import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Screen 5 OpenAI-only operational boundary", () => {
  it("retires the live Groq workflow and keeps Groq out of server composition", async () => {
    await expect(access(".github/workflows/groq-screen5-preview-pilot.yml"))
      .rejects.toThrow();
    const server = await readFile("src/worker/server.ts", "utf8");
    const runtime = await readFile(
      "src/worker/six-screen-workflow-runtime.ts",
      "utf8",
    );
    expect(server).not.toContain("GROQ_API_KEY");
    expect(server).not.toContain("SCREEN5_MECHANISM_FETCH");
    expect(server).not.toContain("api.groq.com");
    expect(runtime).not.toContain("api.groq.com");
    expect(runtime).not.toContain("screen5MechanismImportedUsage");
    expect(runtime).toContain(
      "The legacy ChatGPT-host Screen 5 inference route is retired.",
    );
    const productionGate = await readFile(
      "scripts/check-prohibited-production-paths.mjs",
      "utf8",
    );
    expect(productionGate).toContain(
      '"src/worker/screen5-openai-transport.ts"',
    );
    expect(productionGate).toContain(
      '"src/worker/six-screen-workflow-runtime.ts"',
    );
    expect(productionGate).toContain(
      "production requires its encrypted provider keys and explicit runtime mode",
    );
    const productionConfig = await readFile("wrangler.jsonc", "utf8");
    expect(productionConfig).toContain(
      '"SHOCKAUDIT_SCREEN5_OPENAI_MODE": "production"',
    );
    expect(productionConfig).toContain(
      '"required": ["OPENAI_API_KEY", "OPENSTATES_API_KEY"]',
    );
    expect(productionConfig).not.toMatch(/"OPENAI_API_KEY"\s*:/u);
  });

  it("removes Screen 5 from active host preparation, submission, and UI resume routes", async () => {
    const hostWorkflow = await readFile(
      "src/worker/host-reasoning-task-workflow.ts",
      "utf8",
    );
    const hostTools = await readFile(
      "src/worker/host-reasoning-task-tools.ts",
      "utf8",
    );
    const ui = await readFile("src/ui/six-screen/SixScreenApp.tsx", "utf8");
    expect(hostWorkflow).toContain('"screen5-host-route-retired"');
    expect(hostWorkflow).toContain(
      "Screen 5 host reasoning is retired; the local workflow uses its OpenAI-only direct job.",
    );
    expect(hostTools).not.toMatch(
      /server\.registerTool\(\s*SUBMIT_SCREEN05_(?:THEORETICAL_PLANNING|STUDY_MECHANISM_COMPARISON)_TOOL/gu,
    );
    expect(ui).toContain(
      "Historical Screen 5 host state is view-only. ShockAudit",
    );
    expect(ui).toContain(
      "will not prepare, deliver, poll, retry, or resume this task",
    );
    expect(ui).not.toContain("onResumeHost");
    expect(ui).not.toContain("onRunHost");
    expect(ui).toContain(
      "No signed host task was prepared or delivered.",
    );
  });

  it("requires a user action before advancing a saved direct Screen 5 job", async () => {
    const ui = await readFile("src/ui/six-screen/SixScreenApp.tsx", "utf8");
    expect(ui.match(/\badvanceDirectScreen5\s*\(/gu)).toHaveLength(2);
    expect(ui).toContain(
      "await advanceDirectScreen5(false, true, accepted);",
    );
    expect(ui).toContain("onAdvanceProvider={advanceDirectScreen5}");
    expect(ui).not.toContain('addEventListener("visibilitychange"');
    expect(ui).not.toMatch(/setInterval\([^)]*advanceDirectScreen5/gu);
    expect(ui).toContain("Continue evidence checks");
    expect(ui).toContain(
      "Continuing authorizes another bounded model assessment",
    );
  });

  it("makes the OpenAI Windows helper ignored-file only, masked, and zero-network", async () => {
    const text = await readFile("scripts/windows/Configure-ShockAudit-OpenAI.ps1", "utf8");
    expect(text).toContain(
      'Read-Host "OpenAI API key (input hidden; never printed)" -AsSecureString',
    );
    expect(text).toContain("ZeroFreeBSTR");
    expect(text).toContain('Join-Path $repoRoot ".dev.vars"');
    expect(text).toContain("git check-ignore");
    expect(text).toContain("git check-ignore -q -- .dev.vars.rollback");
    expect(text).toContain("git ls-files -- .dev.vars");
    expect(text).toContain("$trackedDevVars.Count -gt 0");
    expect(text).toContain('Set-DevVar -Target $lines -Name "OPENAI_API_KEY"');
    expect(text).toContain(
      'Set-DevVar -Target $lines -Name "SHOCKAUDIT_SCREEN5_OPENAI_MODE"',
    );
    expect(text).toContain('"GROQ_API_KEY"');
    expect(text).toContain('"SHOCKAUDIT_SCREEN5_PROVIDER"');
    expect(text).toContain('"SHOCKAUDIT_OPENAI_MODEL"');
    expect(text).toContain('"SHOCKAUDIT_OPENAI_REASONING_EFFORT"');
    expect(text).toContain(".dev.vars.rollback");
    expect(text).toContain("local settings read-back");
    expect(text).toContain("No network request or inference was made");
    expect(text).not.toMatch(
      /Invoke-WebRequest|Invoke-RestMethod|curl|chat\/completions|\/v1\/responses/iu,
    );
    expect(text).not.toMatch(/Write-Host[^\n]*(plainKey|OPENAI_API_KEY=)/iu);
  });

  it("removes all retired Groq executors instead of leaving callable stubs", async () => {
    for (const path of [
      "Configure-ShockAudit-Groq.ps1",
      "src/worker/screen5-groq-transport.ts",
      "scripts/validate-groq-pilot-request.mjs",
    ]) {
      await expect(access(path)).rejects.toThrow();
    }
    const contract = await readFile(
      "src/worker/screen5-mechanism-contract.ts",
      "utf8",
    );
    expect(contract).not.toMatch(/fetch\s*\(|Authorization|api\.groq\.com/iu);
  });

  it("confines the retired provider identity to the data-only history module", async () => {
    const activePaths = [
      "src/core/six-screen/screen5-mechanism.ts",
      "src/core/six-screen/study-first-mechanism-comparison.ts",
      "src/worker/screen5-mechanism-contract.ts",
      "src/worker/screen5-openai-provider.ts",
      "src/worker/screen5-openai-transport.ts",
      "src/worker/screen5-openai-ledger.ts",
      "src/worker/six-screen-workflow-runtime.ts",
      "src/worker/server.ts",
    ];
    for (const path of activePaths) {
      const source = await readFile(path, "utf8");
      expect(source, path).not.toContain('"groq"');
      expect(source, path).not.toMatch(
        /api\.groq\.com|\/v1\/chat\/completions|GROQ_API_KEY/iu,
      );
    }
    const history = await readFile(
      "src/core/six-screen/screen5-historical-record.ts",
      "utf8",
    );
    expect(history).toContain('HISTORICAL_SCREEN5_PROVIDER = "groq"');
    expect(history).not.toMatch(
      /^\s*import\s|fetch\s*\(|Bearer\s|api\.groq\.com|GROQ_API_KEY/imu,
    );
  });
});
