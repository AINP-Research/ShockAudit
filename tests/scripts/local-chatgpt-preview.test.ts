import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const setup = read("scripts/windows/Setup-ShockAudit-Local-Preview.ps1");
const worker = read("scripts/windows/Start-ShockAudit-Local-Preview.ps1");
const tunnel = read("scripts/windows/Start-ShockAudit-Tunnel.ps1");
const stop = read("scripts/windows/Stop-ShockAudit-Local-Preview.ps1");
const configureOpenAI = read("scripts/windows/Configure-ShockAudit-OpenAI.ps1");
const helpers = [setup, worker, tunnel, stop, configureOpenAI];
const docs = read("docs/LOCAL-CHATGPT-PREVIEW.md");

describe("local ChatGPT preview infrastructure", () => {
  it("pins the dedicated branch, tunnel, and exact loopback MCP target", () => {
    for (const source of [setup, worker, tunnel, docs]) {
      expect(source).toContain("codex/local-chatgpt-preview");
    }
    expect(tunnel).toContain("tunnel_6aad607472bc81919f2e4caa13eec606");
    expect(tunnel).toContain("http://127.0.0.1:8787/mcp");
    expect(docs).toContain("tunnel_6aad607472bc81919f2e4caa13eec606");
    expect(docs).toContain("http://127.0.0.1:8787/mcp");
  });

  it("keeps every helper free of deployment and production mutation commands", () => {
    for (const source of helpers) {
      expect(source).not.toMatch(/wrangler\s+deploy/i);
      expect(source).not.toMatch(/npm(?:\.cmd)?\s+run\s+deploy/i);
      expect(source).not.toMatch(/wrangler\s+(?:publish|secret|kv|d1|r2|queues?|routes?)(?:\s|$)/i);
      expect(source).not.toMatch(/\s--remote(?:\s|["'])/i);
    }
    expect(worker).toContain("call npm.cmd run dev -- --local");
    expect(worker).toContain("--ip 127.0.0.1");
    expect(worker).toContain("--port 8787");
    expect(worker).toContain("--persist-to");
    expect(stop).toContain("Get-CimInstance -ClassName Win32_Process");
    expect(stop).toContain("the recorded PID now belongs to a different program");
  });

  it("checks Node, dependencies, build/start, health, and MCP tools", () => {
    expect(setup).toContain("$nodeVersion.Major -lt 22");
    expect(setup).toContain('@("ci", "--no-audit", "--no-fund")');
    expect(worker).toContain("ls --depth=0");
    expect(worker).toContain("npm development command no longer performs the expected local build");
    expect(worker).toContain("http://127.0.0.1:8787/health");
    expect(worker).toContain("http://127.0.0.1:8787/mcp");
    expect(worker).toContain('"method":"tools/list"');
    expect(worker).toContain("open_shockaudit_screen_1");
    expect(worker).toContain("open_shockaudit_screen_2");
    expect(worker).toContain(
      "App-only internal tools and UI-resource acceptance",
    );
  });

  it("uses the same validated self-contained build for setup and startup", () => {
    const { scripts } = JSON.parse(read("package.json"));
    expect(setup).toContain('@("run", "build:local-preview")');
    expect(setup).not.toContain('@("run", "build")');
    expect(scripts.dev).toContain("npm run build:local-preview &&");
    expect(scripts["build:local-preview"]).toContain(
      "node scripts/verify-local-preview-artifact.mjs",
    );
    expect(scripts["build:local-preview"]).toContain("tsc --noEmit");
  });

  it("prompts securely, runs doctor first, and declares success only after readiness", () => {
    expect(tunnel).toMatch(/Read-Host[^\n]+-AsSecureString/);
    expect(tunnel).toContain(
      '[Environment]::SetEnvironmentVariable("CONTROL_PLANE_API_KEY", $plainKey, "Process")',
    );
    expect(tunnel).toContain(
      '[Environment]::SetEnvironmentVariable("CONTROL_PLANE_API_KEY", $null, "Process")',
    );
    expect(tunnel).toContain("ZeroFreeBSTR");
    expect(tunnel).not.toMatch(/(?:sk|sess)-[A-Za-z0-9_-]{12,}/);

    const doctorIndex = tunnel.indexOf("doctor --profile");
    const runIndex = tunnel.indexOf('"run",');
    expect(doctorIndex).toBeGreaterThan(0);
    expect(runIndex).toBeGreaterThan(doctorIndex);
    expect(tunnel).toContain("Test-ShockAuditWorker");
    expect(tunnel).toContain("Test-TunnelReadiness");
    expect(read("src/worker/index.ts")).toContain(
      'url.pathname === "/.well-known/oauth-protected-resource/mcp"',
    );
    const wrangler = read("wrangler.jsonc");
    expect(wrangler).toContain('"/.well-known/oauth-protected-resource"');
    expect(wrangler).toContain('"/.well-known/oauth-protected-resource/mcp"');

    expect(setup).not.toMatch(/Write-Host\s+"READY[:"]?/);
    expect(worker).not.toMatch(/Write-Host\s+"READY[:"]?/);
    expect(stop).not.toMatch(/Write-Host\s+"READY[:"]?/);
    expect(tunnel.match(/Write-Host\s+"READY:/g)).toHaveLength(1);
  });

  it("tracks only blank secret names plus exact safe OpenAI settings and ignores local secret files", () => {
    const example = read(".dev.vars.example");
    const expectedSecretNames = [
      "GOVINFO_API_KEY",
      "CONGRESS_API_KEY",
      "REGULATIONS_API_KEY",
      "LEGISCAN_API_KEY",
      "TAVILY_API_KEY",
      "BRAVE_API_KEY",
      "OPENALEX_API_KEY",
      "OPENAI_API_KEY",
    ];
    for (const name of expectedSecretNames) {
      expect(example).toMatch(new RegExp(`^${name}=$`, "mu"));
    }
    expect(example).toContain("SHOCKAUDIT_SCREEN5_OPENAI_MODE=local-preview");
    expect(example).not.toContain("SHOCKAUDIT_SCREEN5_PROVIDER=");
    expect(example).not.toContain("SHOCKAUDIT_OPENAI_MODEL=");
    expect(example).not.toContain("SHOCKAUDIT_OPENAI_REASONING_EFFORT=");
    expect(example).not.toContain("GROQ_API_KEY");
    expect(example).not.toContain("SHOCKAUDIT_GROQ_");
    expect(example).not.toMatch(/(?:gsk_|sk-|sess-)[A-Za-z0-9_-]{12,}/u);

    for (const path of [
      ".dev.vars",
      ".dev.vars.local",
      ".dev.vars.rollback",
      ".env",
      ".env.local",
      "local-secrets/example.txt",
      "credentials/example.json",
      "example.local.secret",
      "example.secret",
      "example.key",
      "example.pem",
      "example.p12",
      "example.pfx",
    ]) {
      expect(() =>
        execFileSync("git", ["check-ignore", "--no-index", "--quiet", "--", path], {
          cwd: root,
          stdio: "ignore",
        }),
      ).not.toThrow();
    }
    expect(() =>
      execFileSync(
        "git",
        ["check-ignore", "--no-index", "--quiet", "--", ".dev.vars.example"],
        { cwd: root, stdio: "ignore" },
      ),
    ).toThrow();
  });

  it("removes the obsolete helper and restarts stale same-version workers safely", () => {
    expect(existsSync(join(root, "Configure-ShockAudit-Groq.ps1"))).toBe(false);
    expect(configureOpenAI).toContain('"GROQ_API_KEY"');
    expect(configureOpenAI).toContain('"SHOCKAUDIT_SCREEN5_PROVIDER"');
    expect(configureOpenAI).toContain('"SHOCKAUDIT_OPENAI_MODEL"');
    expect(configureOpenAI).toContain('"SHOCKAUDIT_OPENAI_REASONING_EFFORT"');
    expect(configureOpenAI).toContain('Set-DevVar -Target $lines -Name "OPENAI_API_KEY"');
    expect(configureOpenAI).toContain('Set-DevVar -Target $lines -Name "SHOCKAUDIT_SCREEN5_OPENAI_MODE"');
    expect(configureOpenAI).toContain(".dev.vars.rollback");
    expect(configureOpenAI).toContain("git check-ignore -q -- .dev.vars.rollback");
    expect(configureOpenAI).toContain("local settings read-back");
    expect(worker).toContain("SHOCKAUDIT_LOCAL_LAUNCH_ID");
    expect(worker).toContain("SHOCKAUDIT_LOCAL_CONFIG_ID");
    expect(worker).toContain(
      "[Parameter(Mandatory = $true)][AllowEmptyString()][string]$LaunchId",
    );
    expect(worker).toContain(
      "[Parameter(Mandatory = $true)][AllowNull()]$Health",
    );
    expect(worker).toContain("Stopping the recorded stale local Worker");
    expect(worker).toContain("no unrelated process was killed");
  });

  it("documents the exact software, buttons, safety boundary, and stop path", () => {
    for (const phrase of [
      "Git for Windows",
      "Node.js 22 LTS",
      "Download tunnel-client",
      "Security and login",
      "Developer mode",
      "plus (+)",
      "Connection",
      "Tunnel",
      "Create",
      "Scan tools",
      "Stop-ShockAudit-Local-Preview.ps1",
      "Do not open or merge a pull request",
    ]) {
      expect(docs).toContain(phrase);
    }
  });
});
