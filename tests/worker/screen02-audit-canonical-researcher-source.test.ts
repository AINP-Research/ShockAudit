import { describe, expect, it } from "vitest";
import worker from "../../src/worker/index";
import type { ShockAuditEnv } from "../../src/worker/server";
import { InMemoryScreen02WorkflowStore } from "../../src/worker/screen02-workflow-store";
import { confirmScopeContract, createInitialState } from "../../src/core/screen01-service";
import { decisionKeys } from "../../src/core/scope-types";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import {
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
  SCREEN_02_WORKFLOW_META_KEY,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import { restoreScreen02AuditState } from "../../src/core/screen02-workflow-state";

const title = "Lakeview Algorithmic Rights Act";

function studyContext() {
  const sentence = `Audit whether the ${title} affected innovation among U.S. publicly listed technology firms from 2022 to 2025.`;
  const initial = createInitialState("audit", sentence);
  const confirmed = confirmScopeContract({
    ...initial,
    sentence,
    contractSourceSentence: sentence,
    knownShock: title,
    scope: {
      population: "U.S. publicly listed technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2022–2025",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!confirmed.ok) throw new Error(confirmed.error);
  return buildScreen01StudyContext(confirmed.state, confirmed.ambiguities);
}

function productionHarness(sourceLocator: string) {
  let requestId = 0;
  const env: ShockAuditEnv = {
    ASSETS: {
      fetch: async () => new Response("<html><body></body></html>", {
        headers: { "content-type": "text/html" },
      }),
    } as unknown as ShockAuditEnv["ASSETS"],
    CONNECTOR_FETCH: async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return url === sourceLocator
        ? new Response(`<html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>The Act requires covered digital firms to disclose automated decision criteria and permit consumers to contest adverse decisions.</p><p>The requirements take effect on January 1, 2024. The legislature enacted this law on May 12, 2023.</p></main></body></html>`, {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        : new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json" },
          });
    },
    NOW: () => "2026-09-06T18:00:00.000Z",
    SCREEN02_SEARCH_EXPANSION_MODE: "off",
    SCREEN02_WORKFLOW_STORE: new InMemoryScreen02WorkflowStore(),
    SCREEN02_WORKFLOW_SIGNING_KEY_ID: "researcher-source-regression",
    SCREEN02_WORKFLOW_SIGNING_KEY: crypto.randomUUID().replaceAll("-", ""),
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
  };
  return async (name: string, args: Record<string, unknown>) => {
    const response = await worker.fetch(new Request("http://localhost/mcp", {
      method: "POST",
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } }),
    }) as never, env as never, { waitUntil: () => undefined, passThroughOnException: () => undefined } as never);
    expect(response.status).toBe(200);
    const text = await response.text();
    const data = response.headers.get("content-type")?.includes("text/event-stream")
      ? text.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
      : text;
    if (!data) throw new Error("Missing MCP response data");
    return JSON.parse(data) as { result?: { isError?: boolean; content?: unknown; _meta?: Record<string, unknown> } };
  };
}

describe("production Audit canonical researcher-source contract", () => {
  it.each([
    "https://official.lakeview.gov.example.org/algorithmic-rights-act",
    "https://legislature.lakeview.gov/algorithmic-rights-act",
    "https://legislation.lakeview.gov.uk/algorithmic-rights-act",
    "https://legislation.europa.eu/algorithmic-rights-act",
  ])("preserves researcher provenance after an empty discovery: %s", async (sourceLocator) => {
    const call = productionHarness(sourceLocator);
    const opened = await call(SCREEN_02_WORKFLOW_CREATE_TOOL_V023, {
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
      operationId: "researcher-source-create",
      studyContext: studyContext(),
    });
    expect(opened.result?.isError, JSON.stringify(opened.result?.content)).not.toBe(true);
    const initial = restoreScreen02WorkflowClientSnapshot(opened.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY]);
    if (!initial) throw new Error("Missing initial canonical snapshot");
    const initialState = stateFromScreen02WorkflowClientSnapshot(initial);
    if (initialState.mode !== "audit") throw new Error("Expected Audit state");
    expect(initialState.possibleMatches).toHaveLength(0);

    const revised = await call("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: "researcher-source-revise",
      runId: initial.runId,
      accessToken: initial.accessToken,
      expectedRevision: initial.revision,
      expectedStateFingerprint: initial.stateFingerprint,
      action: "audit-revise-anchor",
      payload: {
        fields: {
          shockName: title,
          jurisdiction: "United States",
          issuingAuthority: "Lakeview Legislature",
          approximateYear: "2023",
          versionType: "original",
          distinguishingFeature: "Automated decision disclosure rights",
          sourceLocator,
          clarification: "Use the supplied source to resolve the intended act.",
        },
        reason: "Supply an identity source after the bounded search found no matches.",
      },
    });
    expect(revised.result?.isError, JSON.stringify(revised.result?.content)).not.toBe(true);
    const snapshot = restoreScreen02WorkflowClientSnapshot(revised.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY]);
    if (!snapshot) throw new Error("Missing revised canonical snapshot");
    const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
    if (state.mode !== "audit") throw new Error("Expected Audit state");
    expect(restoreScreen02AuditState(state)).toEqual(state);
    expect(state.sources).toHaveLength(1);
    expect(state.possibleMatches).toHaveLength(1);
    const source = state.sources.find((candidate) => candidate.locator === sourceLocator);
    expect(source).toMatchObject({
      userProvided: true,
      authorityTier: 6,
      channel: "researcher-provided-url",
    });
    expect(source?.evidenceText).toContain("permit consumers to contest adverse decisions");
    expect(state.possibleMatches.some((match) => match.sourceIds.includes(source?.id ?? ""))).toBe(true);
  });
});
