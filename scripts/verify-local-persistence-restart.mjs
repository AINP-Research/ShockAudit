import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerCli = resolve(
  repositoryRoot,
  "node_modules/wrangler/bin/wrangler.js",
);
const persistenceConfig = resolve(
  repositoryRoot,
  "tests/persistence/wrangler.screen3-handoff.jsonc",
);
const persistenceFixturePath =
  "/__persistence-fixture/screen3-handoff";
const operationStatusTool = "get_six_screen_operation_status_v1";
const recoverySnapshotTool = "get_six_screen_recovery_snapshot_v1";
const workerPort = Number(process.env.SHOCKAUDIT_PERSISTENCE_TEST_PORT ?? 8795);
const inspectorPort = Number(
  process.env.SHOCKAUDIT_PERSISTENCE_TEST_INSPECTOR_PORT ?? 18795,
);
const controlledConfigId = `sha256:${"f".repeat(64)}`;
if (!Number.isInteger(workerPort) || !Number.isInteger(inspectorPort) ||
    workerPort < 1 || inspectorPort < 1 || workerPort > 65_535 ||
    inspectorPort > 65_535 || workerPort === inspectorPort) {
  throw new Error("Persistence-test ports must be different valid TCP ports.");
}

const credentialNames = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_EMAIL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CONTROL_PLANE_API_KEY",
  "OPENAI_API_KEY",
  "GOVINFO_API_KEY",
  "CONGRESS_API_KEY",
  "REGULATIONS_API_KEY",
  "LEGISCAN_API_KEY",
  "TAVILY_API_KEY",
  "BRAVE_API_KEY",
  "OPENALEX_API_KEY",
];

function isolatedEnvironment() {
  const environment = { ...process.env, CLOUDFLARE_INCLUDE_PROCESS_ENV: "false" };
  for (const name of credentialNames) delete environment[name];
  // The test performs loopback-only reads. Ambient proxy configuration can
  // otherwise divert localhost in some Node installations before NO_PROXY is
  // evaluated, producing an environment failure unrelated to persistence.
  environment.NODE_USE_ENV_PROXY = "0";
  return environment;
}

function loopbackRequest({ path, method = "GET", headers = {}, body = null,
  timeoutMs = 5_000 }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: workerPort,
      path,
      method,
      headers,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolvePromise({
        status: response.statusCode ?? 0,
        headers: response.headers,
        text: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(
      new Error("The loopback request timed out."),
    ));
    request.on("error", rejectPromise);
    if (body !== null) request.write(body);
    request.end();
  });
}

function parseMcpEnvelope(text, contentType) {
  if (!contentType.includes("text/event-stream")) return JSON.parse(text);
  for (const line of text.split(/\r?\n/u)) {
    if (!line.startsWith("data:")) continue;
    const candidate = line.slice(5).trim();
    if (!candidate || candidate === "[DONE]") continue;
    const envelope = JSON.parse(candidate);
    if (envelope.result !== undefined || envelope.error) return envelope;
  }
  throw new Error("The MCP response contained no JSON-RPC result.");
}

async function callMcpToolResult(name, args, id, extraHeaders = {}) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const response = await loopbackRequest({
    path: "/mcp",
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
      ...extraHeaders,
    },
    body,
    timeoutMs: 30_000,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`MCP ${name} returned HTTP ${response.status}.`);
  }
  const envelope = parseMcpEnvelope(
    response.text,
    String(response.headers["content-type"] ?? ""),
  );
  if (envelope.error) {
    throw new Error(`MCP ${name} failed: ${envelope.error.message ?? "unknown error"}`);
  }
  if (!envelope.result) throw new Error(`MCP ${name} returned no tool result.`);
  return envelope.result;
}

async function callMcpTool(name, args, id) {
  const result = await callMcpToolResult(name, args, id);
  if (result.isError) {
    throw new Error(`MCP ${name} returned a tool error.`);
  }
  return result;
}

async function callMcpToolWithControlledDeliveryLoss(name, args, id) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const response = await loopbackRequest({
    path: "/mcp",
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
      "x-shockaudit-test-drop-open-screen3-response": "true",
    },
    body,
    timeoutMs: 30_000,
  });
  if (response.status !== 502) {
    throw new Error(
      `Controlled response loss returned HTTP ${response.status}, not 502: ` +
      response.text.slice(0, 4_000),
    );
  }
  const failure = JSON.parse(response.text);
  if (failure?.error !== "controlled_delivery_loss_after_durable_commit") {
    throw new Error("The controlled delivery-loss sentinel was missing.");
  }
}

async function fixtureRequest(method) {
  const response = await loopbackRequest({
    path: persistenceFixturePath,
    method,
    headers: { accept: "application/json" },
    timeoutMs: 30_000,
  });
  if (response.status !== 200) {
    throw new Error(`Persistence fixture returned HTTP ${response.status}.`);
  }
  return JSON.parse(response.text);
}

function operationStatus(result) {
  const value = result?.structuredContent?.operationStatus ??
    result?.structuredContent;
  if (!value || value.toolName !== operationStatusTool) {
    throw new Error("The compact operation-status result was missing.");
  }
  return value;
}

function restoredRecoverySnapshot(result) {
  const value = result?.structuredContent;
  if (
    !value ||
    value.toolName !== recoverySnapshotTool ||
    value.encoding !== "canonical-json-gzip-base64-v1" ||
    typeof value.encodedStatePayload !== "string" ||
    typeof value.encodedPublicProjectionPayload !== "string"
  ) {
    throw new Error("The compressed recovery snapshot result was missing.");
  }
  const stateText = gunzipSync(
    Buffer.from(value.encodedStatePayload, "base64"),
  ).toString("utf8");
  const projectionText = gunzipSync(
    Buffer.from(value.encodedPublicProjectionPayload, "base64"),
  ).toString("utf8");
  if (
    Buffer.byteLength(stateText) !== value.canonicalStateBytes ||
    Buffer.byteLength(projectionText) !==
      value.canonicalPublicProjectionBytes
  ) {
    throw new Error("The compressed recovery snapshot byte counts changed.");
  }
  return {
    envelope: value,
    state: JSON.parse(stateText),
    projection: JSON.parse(projectionText),
  };
}

function boundedLog(buffer, chunk) {
  const combined = `${buffer}${String(chunk)}`;
  return combined.slice(-12_000);
}

async function startWorker(stateDirectory, environmentFile, launchId) {
  const args = [
    wranglerCli,
    "dev",
    "--config", persistenceConfig,
    "--local",
    "--ip", "127.0.0.1",
    "--port", String(workerPort),
    "--inspector-ip", "127.0.0.1",
    "--inspector-port", String(inspectorPort),
    "--persist-to", stateDirectory,
    "--env-file", environmentFile,
    "--log-level", "warn",
    "--var", "SCREEN02_SEARCH_EXPANSION_MODE:off",
    "--var", "SCREEN02_PUBLIC_EVENT_INDEX_MODE:off",
    "--var", "SCREEN03_HOST_NATIVE_DEFAULT:off",
    "--var", "SHOCKAUDIT_HOST_REASONING_MODE:experimental-off",
    "--var", "SHOCKAUDIT_SCREEN5_OPENAI_MODE:off",
    "--var", `SHOCKAUDIT_LOCAL_LAUNCH_ID:${launchId}`,
    "--var", `SHOCKAUDIT_LOCAL_CONFIG_ID:${controlledConfigId}`,
  ];
  const child = spawn(process.execPath, args, {
    cwd: repositoryRoot,
    env: isolatedEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output = boundedLog(output, chunk);
  });
  child.stderr.on("data", (chunk) => {
    output = boundedLog(output, chunk);
  });
  const ownedWorker = { child, output: () => output };
  try {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Wrangler exited before readiness.\n${output}`);
      }
      try {
        const response = await loopbackRequest({ path: "/health" });
        if (response.status >= 200 && response.status < 300) {
          const health = JSON.parse(response.text);
          if (health?.ok === true && health?.ready === true &&
              health?.readiness?.mcpRuntime === "durable-object" &&
              health?.localLaunchId === launchId &&
              health?.localConfigId === controlledConfigId) {
            return ownedWorker;
          }
        }
      } catch {
        // The loopback listener is not ready yet.
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
    throw new Error(`Wrangler did not become ready.\n${output}`);
  } catch (error) {
    await stopWorker(ownedWorker);
    throw error;
  }
}

async function stopWorker(worker) {
  if (!worker || worker.child.exitCode !== null) return;
  const interruptExit = new Promise((resolvePromise) =>
    worker.child.once("exit", () => resolvePromise(true)));
  worker.child.kill("SIGINT");
  const exited = await Promise.race([
    interruptExit,
    new Promise((resolvePromise) => setTimeout(() =>
      resolvePromise(false), 10_000)),
  ]);
  if (exited) return;
  if (worker.child.exitCode !== null) return;
  const terminateExit = new Promise((resolvePromise) =>
    worker.child.once("exit", () => resolvePromise(true)));
  worker.child.kill("SIGTERM");
  const terminated = await Promise.race([
    terminateExit,
    new Promise((resolvePromise) => setTimeout(() =>
      resolvePromise(false), 5_000)),
  ]);
  if (!terminated) {
    throw new Error("The exact owned Wrangler child did not stop cleanly.");
  }
}

const controlledRoot = await mkdtemp(
  resolve(tmpdir(), "shockaudit-durable-restart-"),
);
const expectedPrefix = resolve(tmpdir(), "shockaudit-durable-restart-");
if (!controlledRoot.startsWith(expectedPrefix) ||
    controlledRoot.split(sep).at(-1)?.length <=
      "shockaudit-durable-restart-".length) {
  throw new Error("The controlled persistence directory is outside the safe temporary prefix.");
}
const stateDirectory = resolve(controlledRoot, "state");
const environmentFile = resolve(controlledRoot, "offline.env");
await mkdir(stateDirectory, { recursive: true });
await writeFile(environmentFile, "# Intentionally credential-free.\n", "utf8");

let worker;
try {
  worker = await startWorker(
    stateDirectory,
    environmentFile,
    "d".repeat(32),
  );
  const seeded = await fixtureRequest("POST");
  if (
    seeded?.schemaVersion !== "screen3-handoff-persistence-fixture-v1" ||
    typeof seeded.runId !== "string" ||
    typeof seeded.accessToken !== "string" ||
    typeof seeded.revision !== "number" ||
    typeof seeded.stateFingerprint !== "string" ||
    seeded.operationKind !== "open_screen_3" ||
    typeof seeded.operationId !== "string" ||
    typeof seeded.inputFingerprint !== "string" ||
    typeof seeded.changedInputFingerprint !== "string" ||
    !seeded.payload || !seeded.changedPayload
  ) {
    throw new Error("The validated persistence fixture omitted operation coordinates.");
  }
  const authentication = {
    runId: seeded.runId,
    accessToken: seeded.accessToken,
  };
  const mutation = {
    action: seeded.operationKind,
    expectedRevision: seeded.revision,
    operationId: seeded.operationId,
    ...seeded.payload,
  };
  await callMcpToolWithControlledDeliveryLoss(
    "mutate_six_screen_workflow_v1",
    { ...authentication, mutation },
    "screen3-handoff-controlled-delivery-loss",
  );
  await stopWorker(worker);
  worker = undefined;

  worker = await startWorker(
    stateDirectory,
    environmentFile,
    "e".repeat(32),
  );
  const statusRequest = {
    ...authentication,
    operationId: seeded.operationId,
    operationKind: seeded.operationKind,
    inputFingerprint: seeded.inputFingerprint,
  };
  const recoveredStatus = operationStatus(await callMcpTool(
    operationStatusTool,
    statusRequest,
    "screen3-handoff-operation-status-after-restart",
  ));
  if (
    recoveredStatus.lookup !== "committed" ||
    recoveredStatus.commitCertainty !== "committed" ||
    recoveredStatus.runId !== seeded.runId ||
    recoveredStatus.operationKind !== seeded.operationKind ||
    recoveredStatus.inputFingerprint !== seeded.inputFingerprint ||
    recoveredStatus.receiptValidated !== true ||
    recoveredStatus.destination?.screen !== 3 ||
    recoveredStatus.destination?.state !== "current" ||
    recoveredStatus.destination?.displayReady !== true ||
    recoveredStatus.screen3Receipt?.workflowRevision !==
      recoveredStatus.committedRevision ||
    recoveredStatus.revision !== recoveredStatus.committedRevision
  ) {
    throw new Error(
      "The compact status read did not recover the exact current Screen 3 " +
      `receipt: ${JSON.stringify(recoveredStatus)}`,
    );
  }
  const recoveredResultFingerprint = recoveredStatus.resultFingerprint;

  const replayed = await callMcpTool(
    "mutate_six_screen_workflow_v1",
    { ...authentication, mutation },
    "screen3-handoff-identical-operation-replay",
  );
  const replayedSnapshot = replayed._meta?.["shockaudit/sixScreenWorkflow"];
  if (
    replayedSnapshot?.runId !== seeded.runId ||
    replayedSnapshot?.revision !== recoveredStatus.committedRevision ||
    replayedSnapshot?.stateFingerprint !== recoveredStatus.stateFingerprint
  ) {
    throw new Error(
      "The identical operation replay changed the saved workflow or revision.",
    );
  }

  const statusAfterReplay = operationStatus(await callMcpTool(
    operationStatusTool,
    statusRequest,
    "screen3-handoff-operation-status-after-replay",
  ));
  if (
    statusAfterReplay.lookup !== "committed" ||
    statusAfterReplay.committedRevision !== recoveredStatus.committedRevision ||
    statusAfterReplay.stateFingerprint !== recoveredStatus.stateFingerprint ||
    statusAfterReplay.resultFingerprint !== recoveredResultFingerprint ||
    statusAfterReplay.screen3Receipt?.adviceFingerprint !==
      recoveredStatus.screen3Receipt?.adviceFingerprint
  ) {
    throw new Error("The identical replay did not preserve the same receipt.");
  }

  const changedMutation = {
    action: seeded.operationKind,
    expectedRevision: seeded.revision,
    operationId: seeded.operationId,
    ...seeded.changedPayload,
  };
  const changedResult = await callMcpToolResult(
    "mutate_six_screen_workflow_v1",
    { ...authentication, mutation: changedMutation },
    "screen3-handoff-changed-operation-conflict",
  );
  if (changedResult.isError !== true) {
    throw new Error("Changed input reused the operation id without rejection.");
  }
  const conflictStatus = operationStatus(await callMcpTool(
    operationStatusTool,
    {
      ...authentication,
      operationId: seeded.operationId,
      operationKind: seeded.operationKind,
      inputFingerprint: seeded.changedInputFingerprint,
    },
    "screen3-handoff-operation-status-conflict",
  ));
  if (
    conflictStatus.lookup !== "conflict" ||
    conflictStatus.commitCertainty !== "unknown" ||
    conflictStatus.committedRevision !== null ||
    conflictStatus.receiptValidated !== false ||
    conflictStatus.stateFingerprint !== recoveredStatus.stateFingerprint
  ) {
    throw new Error("Changed operation input was not reported as a conflict.");
  }

  const restored = restoredRecoverySnapshot(await callMcpTool(
    recoverySnapshotTool,
    authentication,
    "screen3-handoff-compressed-recovery",
  ));
  if (
    restored.envelope.runId !== seeded.runId ||
    restored.envelope.revision !== recoveredStatus.committedRevision ||
    restored.envelope.stateFingerprint !== recoveredStatus.stateFingerprint ||
    restored.state?.runId !== seeded.runId ||
    restored.state?.revision !== recoveredStatus.committedRevision ||
    restored.state?.activeScreen !== 3 ||
    restored.projection?.runId !== seeded.runId ||
    restored.projection?.revision !== recoveredStatus.committedRevision ||
    restored.projection?.activeScreen !== 3 ||
    JSON.stringify(restored).includes(seeded.accessToken)
  ) {
    throw new Error(
      "The compressed canonical recovery did not restore Screen 3.",
    );
  }
  const counters = await fixtureRequest("GET");
  if (counters?.sourceCalls !== 0) {
    throw new Error("The local-only handoff unexpectedly called a source route.");
  }

  console.log("LOCAL_PERSISTENCE_TESTED: PASS");
  console.log(
    "Screen 3 committed before controlled response loss; its exact receipt " +
    "was recovered after a real isolated Wrangler restart.",
  );
  console.log(
    "The identical operation replay preserved one revision and receipt; " +
    "changed payload reuse was rejected and reported as a conflict.",
  );
  console.log(
    "Provider/source calls: 0 (credentials removed, source transport guarded, " +
    "and only deterministic handoff/status/compressed-recovery actions executed).",
  );
} finally {
  await stopWorker(worker);
  await rm(controlledRoot, { recursive: true, force: true });
}
