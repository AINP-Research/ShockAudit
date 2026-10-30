import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS,
  SHOCKAUDIT_UI_BUILD_LABEL,
} from "../../src/version";
import {
  createUiResourceMeta,
  readUiHtml,
  type ShockAuditEnv,
} from "../../src/worker/server";

function localAssets() {
  const fetch = vi.fn(async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/") {
      return new Response(
        '<!doctype html><html><head><meta name="shockaudit-ui-delivery" content="self-contained" /><link rel="stylesheet" href="/assets/shockaudit-app.css?v=' +
          SHOCKAUDIT_UI_BUILD_LABEL +
          '"></head><body><div id="root"></div><script type="module" src="/assets/shockaudit-app.js?v=' +
          SHOCKAUDIT_UI_BUILD_LABEL +
          '"></script></body></html>',
      );
    }
    if (pathname === "/assets/shockaudit-app.js") {
      return new Response(
        'console.log("ShockAudit");const diagnostic="/assets/shockaudit-app.js";const mixed="</ScRiPt><script src=\"/assets/shockaudit-app.js\"></script><p>must-not-render</p>";',
      );
    }
    if (pathname === "/assets/shockaudit-app.css") {
      return new Response(
        'body{color:CanvasText}body::after{content:"</StYlE><p>must-not-render</p>"}',
      );
    }
    return new Response("missing", { status: 404 });
  });
  return { fetch };
}

describe("local ChatGPT UI delivery", () => {
  it("inlines the local preview bundle so ChatGPT never fetches loopback assets", async () => {
    const ASSETS = localAssets();
    const html = await readUiHtml(
      { ASSETS } as unknown as ShockAuditEnv,
      "http://127.0.0.1:8787",
    );

    expect(html).toContain(
      '<script type="application/octet-stream" id="shockaudit-css-payload" data-shockaudit-inline="css">',
    );
    expect(html).toContain(
      '<script type="application/octet-stream" id="shockaudit-js-payload" data-shockaudit-inline="js">',
    );
    expect(html).toContain(
      '<script type="module" data-shockaudit-bootstrap="bundle">',
    );
    expect(html).toContain("URL.createObjectURL(new Blob(");
    expect(html).toContain("await import(shockAuditModuleUrl)");
    expect(html).not.toContain('console.log("ShockAudit");');
    expect(html).not.toContain("</ScRiPt>");
    expect(html).not.toContain("</StYlE>");
    expect(html).not.toMatch(
      /<(?:script|link)\b[^>]*(?:src|href)=["'][^"']*\/assets\/shockaudit-/u,
    );
    expect(html).not.toContain("127.0.0.1:8787/assets");

    const jsPayload = /id="shockaudit-js-payload"[^>]*>([^<]+)<\/script>/u
      .exec(html)?.[1] ?? "";
    const cssPayload = /id="shockaudit-css-payload"[^>]*>([^<]+)<\/script>/u
      .exec(html)?.[1] ?? "";
    expect(Buffer.from(jsPayload, "base64").toString("utf8")).toContain(
      'const mixed="</ScRiPt><script src=\"/assets/shockaudit-app.js\"></script><p>must-not-render</p>";',
    );
    expect(Buffer.from(cssPayload, "base64").toString("utf8")).toContain(
      'body::after{content:"</StYlE><p>must-not-render</p>"}',
    );
    expect(ASSETS.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not advertise loopback static-resource domains and declares display modes before mount", () => {
    const localMeta = createUiResourceMeta("http://127.0.0.1:8787");
    expect(localMeta.ui.csp.resourceDomains).toEqual([]);
    expect(localMeta["openai/widgetCSP"].resource_domains).toEqual([]);
    expect(localMeta["openai/ui"].availableDisplayModes).toEqual([
      "inline",
      "fullscreen",
    ]);

    const productionMeta = createUiResourceMeta(
      "https://shockaudit.ainp-research.workers.dev",
    );
    expect(productionMeta.ui.csp.resourceDomains).toEqual([
      "https://shockaudit.ainp-research.workers.dev",
    ]);
  });

  it("lets the host open its signed report link without permitting file-service fetches in the widget", () => {
    const meta = createUiResourceMeta("http://127.0.0.1:8787");
    expect(meta["openai/widgetCSP"].redirect_domains).toContain("https://files.oaiusercontent.com");
    expect(meta.ui.csp.connectDomains).toEqual([]);
    expect(meta.ui.csp.resourceDomains).toEqual([]);
  });

  it("keeps the local dev command on the self-contained build without changing the standard release build", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    const vite = readFileSync(
      new URL("../../vite.config.ts", import.meta.url),
      "utf8",
    );
    const launcher = readFileSync(
      new URL("../../scripts/windows/Start-ShockAudit-Local-Preview.ps1", import.meta.url),
      "utf8",
    );

    expect(RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r4.html",
    );
    expect(RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r3.html",
    );
    expect(RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r2.html",
    );
    expect(RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r1.html",
    );
    expect(packageJson.scripts.dev).toContain("build:local-preview");
    expect(packageJson.scripts.build).toContain("verify-build-artifact.mjs");
    expect(packageJson.scripts["build:local-preview"]).toContain(
      "verify-local-preview-artifact.mjs",
    );
    expect(vite).toContain(
      'process.env.npm_lifecycle_event === "build:local-preview"',
    );
    expect(vite).toContain(
      "codeSplitting: selfContainedLocalPreview ? false : {",
    );
    expect(vite).toContain(
      "Do not run the release-only two-pass Terser convergence step",
    );
    expect(launcher).toContain(
      "Still building/starting the local-only Worker...",
    );
    expect(launcher).toContain('method = "resources/read"');
    expect(launcher).toContain('$toolPayload.PSObject.Properties["error"]');
    expect(launcher).toContain('$resourcePayload.PSObject.Properties["error"]');
    expect(launcher).toContain("UI RESOURCE CHECK NEEDS ATTENTION");
    expect(launcher).toContain(
      "The Worker is healthy and remains running.",
    );
    expect(launcher).toContain('data-shockaudit-inline="js"');
    expect(launcher).toContain('data-shockaudit-inline="css"');
    expect(launcher).toContain(
      "Do not scan embedded JavaScript text for",
    );
  });
});
