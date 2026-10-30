import { afterEach, describe, expect, it, vi } from "vitest";

import {
  draftScopeContract,
  scopeContextMarkdown,
} from "../../src/core/screen01-service";
import { requireReadyScreen01Context } from "../../src/core/study-context";
import {
  decisionKeys,
  fieldKeys,
  type Ambiguity,
  type ScopeContract,
  type Screen01State,
  type Screen01StudyContext,
  type Screen01WidgetSnapshot,
} from "../../src/core/scope-types";
import {
  buildModelContextUpdate,
  ShockAuditBridge,
} from "../../src/ui/mcp-bridge";
import { SHOCKAUDIT_VERSION } from "../../src/version";
import worker from "../../src/worker/index";

const env = {
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
  ASSETS: {
    fetch: async () =>
      new Response(
        '<!doctype html><html><body><div id="root"></div></body></html>',
        { headers: { "content-type": "text/html" } },
      ),
  },
};

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

function mcpRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify(body),
  });
}

async function readMcpPayload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) throw new Error(`MCP response contained no SSE data: ${text}`);
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Screen 1 canonical research-context handoff", () => {
  it("preserves one exact payload from MCP through widget restoration, ChatGPT, and the later-screen gate", async () => {
    const auditQuestion =
      "Audit whether the California Consumer Privacy Act changed weekly innovation among U.S. exchange-listed technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";
    const knownShock = "California Consumer Privacy Act";
    const auditScope: ScopeContract = {
      population: "U.S. exchange-listed technology firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Weekly",
    };
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            revision: 42,
            mode: "audit",
            sentence: auditQuestion,
            contractSourceSentence: auditQuestion,
            scope: auditScope,
            knownShock,
            resolvedKeys: decisionKeys,
            scopeDirty: false,
          },
        },
      }) as never,
      env as never,
      executionContext as never,
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok: boolean;
          state: Screen01State;
          ambiguities: Ambiguity[];
          studyContext: Screen01StudyContext;
        };
      };
    };
    const output = payload.result?.structuredContent;
    expect(output?.ok).toBe(true);
    expect(output?.ambiguities).toEqual([]);

    const expectedContext: Screen01StudyContext = {
      schemaVersion: "1.0",
      appVersion: SHOCKAUDIT_VERSION,
      sourceScreen: "screen-01",
      startingPoint: "audit",
      studySentence: auditQuestion,
      contractSourceSentence: auditQuestion,
      knownShock,
      scopeContract: auditScope,
      resolvedKeys: decisionKeys,
      unresolvedDecisions: [],
      scopeDirty: false,
      confirmed: true,
      readyForLaterScreens: true,
      revision: 42,
    };
    expect(output?.studyContext).toEqual(expectedContext);
    expect(Object.keys(output?.studyContext.scopeContract ?? {})).toEqual(
      fieldKeys,
    );

    const findQuestion =
      "Find a regulatory shock affecting annual profitability among U.S. exchange-listed manufacturing firms with state-level assignment and firm-level analysis from 2014 to 2022.";
    const findDraft = draftScopeContract({
      mode: "find",
      sentence: findQuestion,
    }).state;
    const snapshot: Screen01WidgetSnapshot = {
      state: output!.state,
      draftsByMode: {
        find: findDraft,
        audit: output!.state,
      },
      ambiguities: output!.ambiguities,
      studyContext: output!.studyContext,
    };
    let savedWidgetState: Record<string, unknown> | undefined;
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          screen02: { selectedCandidate: "existing-screen-2-state" },
        },
        setWidgetState: async (value: Record<string, unknown>) => {
          savedWidgetState = value;
        },
      },
    });

    await new ShockAuditBridge().saveState(snapshot);

    const savedPrivateState = savedWidgetState?.privateContent as
      | Record<string, unknown>
      | undefined;
    expect(savedPrivateState?.screen02).toEqual({
      selectedCandidate: "existing-screen-2-state",
    });
    vi.stubGlobal("window", {
      openai: { widgetState: savedWidgetState },
    });
    const restored = new ShockAuditBridge().getInitialSnapshot();

    expect(restored?.state).toEqual(output!.state);
    expect(restored?.draftsByMode.find?.sentence).toBe(findQuestion);
    expect(restored?.draftsByMode.audit).toEqual(output!.state);
    expect(restored?.studyContext).toEqual(expectedContext);

    const markdown = scopeContextMarkdown(restored!.studyContext);
    const chatGptUpdate = buildModelContextUpdate(
      { text: {}, structuredContent: {} },
      markdown,
      restored!.studyContext,
    );
    expect(chatGptUpdate?.structuredContent).toEqual({
      screen: "screen-01",
      studyContext: expectedContext,
    });
    expect(chatGptUpdate?.content).toEqual([
      { type: "text", text: markdown },
    ]);

    const laterScreenContext = requireReadyScreen01Context(
      restored!.studyContext,
    );
    expect(laterScreenContext).toEqual(expectedContext);
    expect(laterScreenContext).not.toBe(restored!.studyContext);
  });
});
