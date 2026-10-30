import { describe, expect, it } from "vitest";

import worker from "../../src/worker/index";
import { confirmedWorkflowFindContext } from "../core/screen02-workflow-fixtures";

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

async function callInitialScreen(
  configured: unknown,
  toolName: "open_shockaudit_screen_1" | "open_shockaudit_screen_2",
) {
  const response = await worker.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        host: "localhost",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: toolName === "open_shockaudit_screen_1"
            ? {}
            : { studyContext: confirmedWorkflowFindContext() },
        },
      }),
    }) as never,
    {
      ASSETS: {
        fetch: async () => new Response("<div id=\"root\"></div>"),
      },
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
      SCREEN03_HOST_NATIVE_DEFAULT: configured,
    } as never,
    executionContext as never,
  );
  expect(response.status).toBe(200);
  const responseText = await response.text();
  const serialized = response.headers.get("content-type")
    ?.includes("text/event-stream")
    ? responseText.split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6)
    : responseText;
  if (!serialized) throw new Error("MCP response contained no JSON payload.");
  return JSON.parse(serialized) as {
    result?: { _meta?: Record<string, unknown> };
  };
}

describe("Screen 3 historical host-briefing release metadata", () => {
  it.each([undefined, "off", "true", true])(
    "fails closed for configuration %j",
    async (configured) => {
      const payload = await callInitialScreen(
        configured,
        "open_shockaudit_screen_1",
      );
      expect(payload.result?._meta?.["shockaudit/screen03HostNativeDefault"])
        .toBe(false);
    },
  );

  it.each([
    "open_shockaudit_screen_1",
    "open_shockaudit_screen_2",
  ] as const)(
    "serializes the compatibility on marker only when explicitly configured for %s",
    async (toolName) => {
      const payload = await callInitialScreen("on", toolName);
      expect(payload.result?._meta?.["shockaudit/screen03HostNativeDefault"])
        .toBe(true);
    },
  );
});
