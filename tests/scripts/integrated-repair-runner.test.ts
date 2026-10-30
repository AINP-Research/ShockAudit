import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const start = read("scripts/windows/Start-ShockAudit-Local-Preview.ps1");
const runner = read("scripts/windows/Test-ShockAudit-Preview.ps1");
const playwright = read("playwright.config.ts");
const inventory = JSON.parse(
  read("tests/browser/release-gate-inventory.json"),
) as {
  tests: Array<{
    file: string;
    title: string;
    expectedStatus: "passed" | "skipped";
    axeAttachments: string[];
  }>;
};

describe("integrated local-repair handoff", () => {
  it("keeps signed-host reasoning off and pins Wrangler inspector sockets", () => {
    expect(start).toContain('$LocalHostReasoningMode = "experimental-off"');
    expect(start).not.toContain('$LocalHostReasoningMode = "full"');
    expect(start).toContain('$InspectorIp = "127.0.0.1"');
    expect(start).toContain("--inspector-ip $InspectorIp");
    expect(start).toContain("--inspector-port $InspectorPort");
    expect(start).toContain(
      '$toolNames -contains "open_shockaudit_screen_1"',
    );
    expect(start).toContain(
      '$toolNames -contains "open_shockaudit_screen_2"',
    );
    expect(start).toContain(
      "App-only internal tools and UI-resource acceptance",
    );
    expect(playwright).toContain(
      "--inspector-ip 127.0.0.1 --inspector-port 18791",
    );
  });

  it("binds verification to a clean exact published branch, commit, and tree", () => {
    expect(runner).toContain("[string]$ExpectedCommit");
    expect(runner).toContain("[string]$ExpectedTree");
    expect(runner).toContain('$PreviewBranch = "codex/local-chatgpt-preview"');
    expect(runner).toContain(
      "status --porcelain=v1 --untracked-files=all",
    );
    expect(runner).toContain('rev-parse "HEAD^{tree}"');
    expect(runner).toContain('refs/remotes/origin/$PreviewBranch');
    expect(runner).toContain("not the approved candidate");
    expect(runner).toContain("local and published preview histories are not aligned");
    expect(runner).toContain("$postGateHead -cne $ExpectedCommit");
    expect(runner).toContain("$postGateTree -cne $ExpectedTree");
    expect(runner).toContain(
      "The automated gates changed the worktree or candidate identity",
    );
    expect(runner).toContain(
      '@("run", "check:release-gates")',
    );
    expect(runner).not.toMatch(/git(?:\.exe)?\s+(?:reset|clean|checkout)\b/iu);
  });

  it("uses a read-only runtime allowlist and never starts live or production work", () => {
    expect(runner).toContain(
      '$AllowedMcpMethods = @("tools/list", "resources/read")',
    );
    expect(runner).toContain(
      "The integrated repair verifier refuses consequential MCP method",
    );
    expect(runner).not.toContain('Method "tools/call"');
    expect(runner).not.toMatch(/wrangler\s+(?:deploy|publish)/iu);
    expect(runner).not.toMatch(/npm(?:\.cmd)?\s+run\s+deploy/iu);
    expect(runner).not.toMatch(/&\s+\$TunnelHelper/u);
    expect(runner).not.toMatch(/&\s+\$StopHelper/u);
    expect(runner).not.toMatch(/playwright\s+install/iu);
    expect(runner).toContain("node_modules\\wrangler\\bin\\wrangler.js");
    expect(runner).toContain('"--persist-to"');
    expect(runner).toContain('"--env-file"');
    expect(runner).toContain("integrated repair verification loads no credentials");
    expect(runner).toContain('"SHOCKAUDIT_SCREEN5_OPENAI_MODE:off"');
    expect(runner).toContain('"SHOCKAUDIT_HOST_REASONING_MODE:experimental-off"');
    expect(runner).toContain('"SCREEN02_SEARCH_EXPANSION_MODE:off"');
    for (const name of [
      "OPENAI_API_KEY",
      "GOVINFO_API_KEY",
      "CONGRESS_API_KEY",
      "REGULATIONS_API_KEY",
      "LEGISCAN_API_KEY",
      "TAVILY_API_KEY",
      "BRAVE_API_KEY",
      "OPENALEX_API_KEY",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_API_KEY",
      "CLOUDFLARE_EMAIL",
      "CLOUDFLARE_ACCOUNT_ID",
    ]) {
      expect(runner).toContain(`"${name}"`);
    }
    expect(runner).toContain("$SavedProcessEnvironment[$name]");
    expect(runner).toContain('BROWSER_TESTED: NOT_RUN');
    expect(runner).toContain('LIVE_QUALITY_TESTED: NOT_RUN');
  });

  it("verifies the built UI and backend identities actually served on loopback", () => {
    expect(runner).toContain("Invoke-RestMethod -Method Get -Uri $HealthUrl");
    expect(runner).toContain('Invoke-ReadOnlyMcp -Method "tools/list"');
    expect(runner).toContain('Invoke-ReadOnlyMcp -Method "resources/read"');
    expect(runner).toContain("SHOCKAUDIT_UI_BUILD_LABEL");
    expect(runner).toContain("SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID");
    expect(runner).toContain("shockaudit-app\\.js");
    expect(runner).toContain("shockaudit-app\\.css");
    expect(runner).toContain(
      'PSObject.Properties["shockaudit/hostReasoning"]',
    );
    expect(runner).toContain("$health.localLaunchId -cne $ControlledRunId");
    expect(runner).toContain("$health.localConfigId -cne $configurationIdentity");
    expect(runner).toContain('$health.readiness.mode -cne "integrated"');
    expect(runner).toContain(
      '$health.readiness.mcpRuntime -cne "durable-object"',
    );
    expect(runner).toContain(
      '$health.capabilities.intelligence.configuredMode -cne "experimental-off"',
    );
    expect(runner).toContain(
      "$health.capabilities.intelligence.modelCallable -ne $false",
    );
    expect(runner).toContain(
      '$expectedAssetOrigin = "http://127.0.0.1:$WorkerPort"',
    );
    expect(runner).toContain(
      "$assetUri.GetLeftPart([UriPartial]::Authority) -cne $expectedAssetOrigin",
    );
    expect(runner).toContain(
      "$assetUri.AbsolutePath -cne $expectedAssetPaths[$assetIndex]",
    );
    expect(runner).toContain('$assetUri.Query -cne "?v=$uiBuildLabel"');
    expect(runner).toContain("LOCAL_BACKEND_AND_UI_READBACK: PASS");
  });

  it("owns and removes only its exact temporary Worker in finally", () => {
    expect(runner).toContain("Get-CimInstance -ClassName Win32_Process");
    expect(runner).toContain("SHOCKAUDIT_LOCAL_LAUNCH_ID:$RunId");
    expect(runner).toContain("--inspector-port\\s+$ExpectedInspectorPort");
    expect(runner).toContain("ShockAudit-IntegratedRepair-$ControlledRunId");
    expect(runner).toContain(
      "^ShockAudit-IntegratedRepair-[a-f0-9]{32}$",
    );
    expect(runner).toContain("Stop-ControlledWorker `");
    expect(runner).toContain("$Process.WaitForExit(10000)");
    expect(runner).toContain(
      "Remove-ControlledRuntimeDirectory -Path $ControlledRuntimeDirectory",
    );
    expect(runner).toContain(
      "The controlled Worker PID no longer has the exact launch identity; it was not stopped.",
    );
  });

  it("tracks the exact 60 discovered browser tests without claiming execution", () => {
    expect(inventory.tests).toHaveLength(60);
    expect(inventory.tests).toContainEqual({
      file: "screen5-openai-runtime.spec.ts",
      title:
        "same saved host run migrates through the normal direct UI and renders mechanisms",
      expectedStatus: "passed",
      axeAttachments: ["screen5-presentation-axe-wcag-a-aa.json"],
    });
    expect(inventory.tests).toContainEqual({
      file: "screen56-current-plan.spec.ts",
      title:
        "Screen 6 withholds details until one generated plan is saved, then exports it",
      expectedStatus: "passed",
      axeAttachments: [],
    });
    for (const title of [
      "shows saving/checking, keeps navigation readable, and restores the exact committed guidance after final-response loss",
      "rebases once across navigation-only revision drift and never dispatches a third attempt",
      "does not retry or apply a stale submitted draft after a substantive concurrent edit",
      "preserves a researcher edit made while a stale handoff is in flight and sends no guarded retry",
    ]) {
      expect(inventory.tests).toContainEqual({
        file: "six-screen-screen3-handoff-recovery.spec.ts",
        title,
        expectedStatus: "passed",
        axeAttachments: [],
      });
    }
    const identities = inventory.tests.map(({ file, title }) =>
      `${file}\u0000${title}`
    );
    expect(new Set(identities).size).toBe(60);
  });
});
