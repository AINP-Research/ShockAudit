import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL(
  "../../scripts/verify-local-persistence-restart.mjs",
  import.meta.url,
), "utf8");
const fixtureWorker = readFileSync(new URL(
  "../persistence/screen3-handoff-fixture-worker.ts",
  import.meta.url,
), "utf8");
const fixtureConfig = readFileSync(new URL(
  "../persistence/wrangler.screen3-handoff.jsonc",
  import.meta.url,
), "utf8");
const packageJson = JSON.parse(readFileSync(new URL(
  "../../package.json",
  import.meta.url,
), "utf8")) as { scripts?: Record<string, string> };

describe("isolated Screen 3 handoff durable-restart verifier", () => {
  it("uses one guarded temporary persistence root across two Wrangler processes", () => {
    expect(script).toContain(
      'mkdtemp(\n  resolve(tmpdir(), "shockaudit-durable-restart-")',
    );
    expect(script.match(/startWorker\(\n    stateDirectory/gu)).toHaveLength(2);
    expect(script).toContain("controlledRoot.startsWith(expectedPrefix)");
    expect(script).toContain(
      "rm(controlledRoot, { recursive: true, force: true })",
    );
    expect(script).not.toMatch(/\.wrangler|\.dev\.vars/iu);
    expect(script).toContain('request as httpRequest');
    expect(script).toContain('hostname: "127.0.0.1"');
    expect(script).toContain('environment.NODE_USE_ENV_PROXY = "0"');
    expect(script).toContain('const controlledConfigId = `sha256:${"f".repeat(64)}`');
    expect(script).toContain('"d".repeat(32)');
    expect(script).toContain('"e".repeat(32)');
    expect(script).toContain("health?.localConfigId === controlledConfigId");
    expect(script).toContain(
      '"tests/persistence/wrangler.screen3-handoff.jsonc"',
    );
  });

  it("uses the production Durable Object, store, runtime and registered MCP tools", () => {
    expect(fixtureWorker).toContain(
      'import worker, { ShockAuditMcp } from "../../src/worker/index"',
    );
    expect(fixtureWorker).toContain(
      "export class ShockAuditPersistenceMcp extends ShockAuditMcp",
    );
    expect(fixtureWorker).toContain(
      "new SixScreenWorkflowStore(this.fixtureState.storage)",
    );
    expect(fixtureWorker).toContain("return worker.fetch(request as never, env, context)");
    expect(fixtureConfig).toContain(
      '"class_name": "ShockAuditPersistenceMcp"',
    );
    expect(fixtureConfig).toContain(
      '"new_sqlite_classes": ["ShockAuditPersistenceMcp"]',
    );
    expect(script).toContain('"mutate_six_screen_workflow_v1"');
    expect(script).toContain('"get_six_screen_operation_status_v1"');
    expect(script).toContain('"get_six_screen_recovery_snapshot_v1"');
    expect(script).not.toContain('"get_six_screen_workflow_v1"');
    expect(script).not.toContain('"create_six_screen_workflow_v1"');
  });

  it("drops delivery only after the production mutation response completes", () => {
    expect(fixtureWorker).toContain(
      "const response = await super.fetch(request)",
    );
    expect(fixtureWorker).toContain("await response.arrayBuffer()");
    expect(fixtureWorker).toContain(
      'completedText.includes(\'"isError":true\')',
    );
    expect(fixtureWorker).toContain(
      'error: "controlled_delivery_loss_after_durable_commit"',
    );
    expect(script).toContain(
      '"x-shockaudit-test-drop-open-screen3-response": "true"',
    );
    expect(script).toContain('recoveredStatus.lookup !== "committed"');
    expect(script).toContain("recoveredStatus.receiptValidated !== true");
    expect(script).toContain(
      'recoveredStatus.destination?.state !== "current"',
    );
  });

  it("checks exact replay stability and changed-payload conflict after restart", () => {
    expect(script).toContain(
      '"screen3-handoff-identical-operation-replay"',
    );
    expect(script).toContain(
      "replayedSnapshot?.revision !== recoveredStatus.committedRevision",
    );
    expect(script).toContain(
      "statusAfterReplay.resultFingerprint !== recoveredResultFingerprint",
    );
    expect(script).toContain(
      '"screen3-handoff-changed-operation-conflict"',
    );
    expect(script).toContain("changedResult.isError !== true");
    expect(script).toContain('conflictStatus.lookup !== "conflict"');
    expect(script).toContain("restored.state?.activeScreen !== 3");
    expect(script).toContain(
      '"screen3-handoff-compressed-recovery"',
    );
    expect(script).toContain("gunzipSync(");
  });

  it("removes credentials and fail-closes every source transport", () => {
    for (const credential of [
      "OPENAI_API_KEY",
      "GOVINFO_API_KEY",
      "CONGRESS_API_KEY",
      "REGULATIONS_API_KEY",
      "LEGISCAN_API_KEY",
      "TAVILY_API_KEY",
      "BRAVE_API_KEY",
      "OPENALEX_API_KEY",
    ]) expect(script).toContain(`"${credential}"`);
    expect(script).toContain("delete environment[name]");
    expect(script).toContain("SCREEN02_SEARCH_EXPANSION_MODE:off");
    expect(script).toContain("SCREEN02_PUBLIC_EVENT_INDEX_MODE:off");
    expect(script).toContain("SHOCKAUDIT_SCREEN5_OPENAI_MODE:off");
    expect(fixtureWorker).toContain(
      '"The persistence fixture forbids every source transport."',
    );
    expect(script).toContain("counters?.sourceCalls !== 0");
    expect(script).toContain("Provider/source calls: 0");
    expect(script).not.toMatch(/personalize_|analyze_|resolve_shock/u);
    expect(packageJson.scripts?.["check:local-persistence"])
      .toBe("node scripts/verify-local-persistence-restart.mjs");
  });
});
