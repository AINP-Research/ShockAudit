import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, resolve } from "node:path";

import worker from "../../src/worker/index";
import type { ShockAuditEnv } from "../../src/worker/server";
import { InMemoryScreen02WorkflowStore } from "../../src/worker/screen02-workflow-store";
import { InMemoryScreen03WorkflowStore } from "../../src/worker/screen03-workflow-store";
import { HostReasoningTaskStore } from
  "../../src/worker/host-reasoning-task-store";
import { SixScreenEvidenceStore } from "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from "../../src/worker/six-screen-research-task-store";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  advanceBrowserFixtureScreen03Evidence,
  deterministicConnectorFetch,
} from "./fixture-worker";
import { SCREEN02_BROWSER_FIXTURE_NOW_ISO } from "./fixture-clock";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};
const nodeBrowserFixtureSigningKey = crypto.randomUUID().replaceAll("-", "");

function safeAssetPath(distRoot: string, pathname: string) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = resolve(distRoot, relative);
  return resolved === resolve(distRoot, "index.html") ||
    resolved.startsWith(`${resolve(distRoot, "assets")}/`)
    ? resolved
    : null;
}

async function assetResponse(distRoot: string, request: Request) {
  const path = safeAssetPath(distRoot, new URL(request.url).pathname);
  if (!path) return new Response("Not found", { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(path)), {
      headers: {
        "content-type":
          contentTypes[extname(path)] ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function startNodeFixtureServer(
  origin: string,
  options: {
    hostReasoningMode?: "app-only" | "screen02-only" | "full";
  } = {},
): Promise<Server> {
  const parsedOrigin = new URL(origin);
  const port = Number(parsedOrigin.port);
  const host = parsedOrigin.hostname;
  const distRoot = resolve(process.cwd(), "dist");
  const canonicalWorkflowStore = new InMemoryScreen02WorkflowStore();
  const canonicalScreen03WorkflowStore = new InMemoryScreen03WorkflowStore();
  const sixScreenStorage = new InMemorySixScreenWorkflowStorage();
  const env: ShockAuditEnv = {
    ASSETS: {
      fetch: (request: Request) => assetResponse(distRoot, request),
    } as unknown as ShockAuditEnv["ASSETS"],
    NOW: () => SCREEN02_BROWSER_FIXTURE_NOW_ISO,
    SCREEN02_SEARCH_EXPANSION_MODE: "on",
    CONNECTOR_FETCH: deterministicConnectorFetch,
    SCREEN02_WORKFLOW_STORE: canonicalWorkflowStore,
    SCREEN03_WORKFLOW_STORE: canonicalScreen03WorkflowStore,
    HOST_REASONING_TASK_STORE: new HostReasoningTaskStore(sixScreenStorage, {
      enforceParentGuard: true,
    }),
    SIX_SCREEN_WORKFLOW_STORE: new SixScreenWorkflowStore(sixScreenStorage),
    SIX_SCREEN_RESEARCH_TASK_STORE:
      new SixScreenResearchTaskStore(sixScreenStorage),
    SIX_SCREEN_EVIDENCE_STORE: new SixScreenEvidenceStore(sixScreenStorage),
    SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen02-node-browser-fixture-v1",
    SCREEN02_WORKFLOW_SIGNING_KEY: nodeBrowserFixtureSigningKey,
    SCREEN02_HOST_ASSESSMENT_DEADLINE_MS: 0,
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
    ...(options.hostReasoningMode
      ? { SHOCKAUDIT_HOST_REASONING_MODE: options.hostReasoningMode }
      : {}),
  };
  const context = {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  };

  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of incoming) {
        chunks.push(
          typeof chunk === "string" ? Buffer.from(chunk) : chunk,
        );
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const request = new Request(
        new URL(incoming.url ?? "/", origin),
        {
          method: incoming.method,
          headers: incoming.headers as Record<string, string>,
          ...(body ? { body } : {}),
        },
      );
      const pathname = new URL(request.url).pathname;
      const response =
        request.method === "POST" &&
          pathname === "/__browser-fixture/advance-screen03-evidence"
        ? new Response(JSON.stringify({
            revision: advanceBrowserFixtureScreen03Evidence(),
          }), {
            headers: { "content-type": "application/json; charset=utf-8" },
          })
        : pathname === "/health" ||
        pathname === "/mcp" ||
        pathname.startsWith("/mcp/")
        ? await worker.fetch(
            request as never,
            env as never,
            context as never,
          )
        : await assetResponse(distRoot, request);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, key) =>
        outgoing.setHeader(key, value),
      );
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => resolveListen());
  });
  return server;
}
