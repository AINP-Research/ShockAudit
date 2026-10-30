import { describe, expect, it, vi } from "vitest";

import worker from "../../src/worker/index";
import type { ShockAuditEnv } from "../../src/worker/server";

describe("local Secure MCP Tunnel OAuth discovery", () => {
  it.each([
    "/.well-known/oauth-protected-resource/mcp",
    "/.well-known/oauth-protected-resource",
  ])("returns a genuine 404 for the no-auth candidate %s", async (path) => {
    const assetFetch = vi.fn(async () =>
      new Response("<!doctype html><title>SPA fallback</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const response = await worker.fetch(
      new Request(`http://127.0.0.1:8787${path}`) as never,
      {
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
        ASSETS: { fetch: assetFetch } as unknown as ShockAuditEnv["ASSETS"],
      } as never,
      {
        waitUntil: () => undefined,
        passThroughOnException: () => undefined,
      } as never,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(assetFetch).not.toHaveBeenCalled();
  });
});
