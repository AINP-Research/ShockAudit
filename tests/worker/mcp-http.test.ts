import { describe, expect, it, vi } from "vitest";

import {
  SHOCKAUDIT_PUBLIC_ORIGIN,
  SHOCKAUDIT_RELEASE_LABEL,
  SHOCKAUDIT_UI_BUILD_LABEL,
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
} from "../../src/version";
import {
  SCREEN_02_WORKFLOW_META_KEY,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import { fingerprintScreen02WorkflowValue } from
  "../../src/core/screen02-workflow-state";
import {
  decryptScreen02WorkflowClientSnapshot,
  exportScreen02ResponseKeyMaterial,
  generateScreen02ResponseKeyMaterial,
  type Screen02SealedResultKind,
} from "../../src/core/screen02-sealed-result";
import worker, { ShockAuditMcp } from "../../src/worker/index";
import { MAX_MCP_BODY_BYTES } from "../../src/worker/mcp-limits";
import {
  SHOCKAUDIT_HOST_REASONING_META_KEY,
  SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES,
  UI_RESOURCE_URI,
  createShockAuditServer,
  type ShockAuditHostReasoningMode,
} from "../../src/worker/server";
import {
  CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
  SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
  SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
  SUBMIT_SCREEN03_OVERVIEW_TOOL,
  SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL,
  SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
  SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
} from "../../src/worker/host-reasoning-task-runtime";
import {
  SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
} from "../../src/worker/screen02-workflow-store";
import type {
  Screen02FindContinuationRecord,
  Screen02FindContinuationWork,
} from "../../src/worker/screen02-find-continuation-store";
import { decodeScreen02FindStoreCheckpoint } from
  "../../src/worker/screen02-find-continuation-checkpoint";
import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
} from "../../src/core/host-reasoning-task";
import { HostReasoningTaskStore } from "../../src/worker/host-reasoning-task-store";
import { confirmedWorkflowFindContext } from "../core/screen02-workflow-fixtures";

const env = {
  ASSETS: {
    fetch: async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/assets/shockaudit-app.js") {
        return new Response("console.log('ShockAudit');", {
          headers: { "content-type": "application/javascript" },
        });
      }
      if (
        /^\/assets\/shockaudit-(?:jsx-runtime|screen02-engine|screen(?:03|04))-(?:[0-9a-f]{7}|local)\.js$/.test(
          pathname,
        )
      ) {
        return new Response("export default function DeferredScreen() {};", {
          headers: { "content-type": "application/javascript" },
        });
      }
      if (pathname === "/assets/shockaudit-app.css") {
        return new Response("body { color: CanvasText; }", {
          headers: { "content-type": "text/css" },
        });
      }
      return new Response(
        '<!doctype html><html><head><link rel="modulepreload" href="/assets/shockaudit-jsx-runtime-0123abc.js"><link rel="modulepreload" href="/assets/shockaudit-screen02-engine-0123abc.js"><link rel="stylesheet" href="/assets/shockaudit-app.css"></head><body><div id="root"></div><script type="module" src="/assets/shockaudit-app.js"></script></body></html>',
        { headers: { "content-type": "text/html" } },
      );
    },
  },
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
};

const validSigningEnv = {
  SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen02-readiness-test-v1",
  SCREEN02_WORKFLOW_SIGNING_KEY: crypto.randomUUID().replaceAll("-", ""),
} as const;
const previousReadinessTestSigningKey = crypto.randomUUID().replaceAll("-", "");

const SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY =
  "__shockaudit-system:screen02-workflow-signing-key-v1";

const context = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

function mcpRequest(
  body: Record<string, unknown>,
  pathname = "/mcp",
  origin = "http://localhost",
) {
  return new Request(`${origin}${pathname}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify(body),
  });
}

async function callWorker(request: Request) {
  return worker.fetch(request as never, env as never, context as never);
}

async function readMcpPayload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) throw new Error(`MCP response contained no SSE data: ${text}`);
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

type Screen02WorkflowToolPayload = {
  result?: {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
};

function screen02WorkflowSnapshot(
  payload: Screen02WorkflowToolPayload,
): Screen02WorkflowClientSnapshot {
  const snapshot = restoreScreen02WorkflowClientSnapshot(
    payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY],
  );
  if (!snapshot) {
    throw new Error(
      `MCP result did not contain a valid private Screen 2 snapshot: ${JSON.stringify(payload.result?.content)}`,
    );
  }
  return snapshot;
}

async function integratedMcpCall(
  method: string,
  params: Record<string, unknown>,
  hostReasoningMode?: ShockAuditHostReasoningMode | string,
) {
  const harness = durableObjectStateHarness();
  const runtime = new ShockAuditMcp(
    harness.state,
    {
      ...env,
      ...validSigningEnv,
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      ...(hostReasoningMode === undefined
        ? {}
        : { SHOCKAUDIT_HOST_REASONING_MODE: hostReasoningMode }),
    } as never,
  );
  const response = await runtime.fetch(mcpRequest({
    jsonrpc: "2.0",
    id: 207,
    method,
    params,
  }));
  expect(response.status).toBe(200);
  return readMcpPayload(response);
}

function durableObjectStateHarness({
  transactionError = null,
  setAlarmError = null,
  setAlarmFailureCount = setAlarmError ? Number.POSITIVE_INFINITY : 0,
}: {
  transactionError?: Error | null;
  setAlarmError?: Error | null;
  setAlarmFailureCount?: number;
} = {}) {
  const records = new Map<string, unknown>();
  let alarmAt: number | null = null;
  let deleteAlarmCalls = 0;
  let setAlarmCalls = 0;
  let transactionCalls = 0;
  const waitUntilPromises: Promise<unknown>[] = [];
  const clone = <T>(value: T) => structuredClone(value);
  const storage = {
    get: async (key: string) =>
      records.has(key) ? clone(records.get(key)) : undefined,
    list: async ({
      prefix = "",
      limit = Number.POSITIVE_INFINITY,
    }: {
      prefix?: string;
      limit?: number;
    }) =>
      new Map(
        [...records.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([left], [right]) => left.localeCompare(right))
          .slice(0, limit)
          .map(([key, value]) => [key, clone(value)]),
      ),
    transaction: async <T>(
      callback: (transaction: DurableObjectTransaction) => Promise<T>,
    ) => {
      transactionCalls += 1;
      if (transactionError) throw transactionError;
      const writes = new Map<string, unknown>();
      const deletions = new Set<string>();
      const transaction = {
        get: async (key: string) => {
          const value = deletions.has(key)
            ? undefined
            : writes.has(key)
              ? writes.get(key)
              : records.get(key);
          return value === undefined ? undefined : clone(value);
        },
        put: async (key: string, value: unknown) => {
          deletions.delete(key);
          writes.set(key, clone(value));
        },
        delete: async (key: string) => {
          writes.delete(key);
          deletions.add(key);
        },
      } as unknown as DurableObjectTransaction;
      const result = await callback(transaction);
      for (const key of deletions) records.delete(key);
      for (const [key, value] of writes) records.set(key, value);
      return result;
    },
    setAlarm: async (scheduledTime: number | Date) => {
      setAlarmCalls += 1;
      if (setAlarmError && setAlarmCalls <= setAlarmFailureCount) {
        throw setAlarmError;
      }
      alarmAt =
        scheduledTime instanceof Date
          ? scheduledTime.getTime()
          : scheduledTime;
    },
    deleteAlarm: async () => {
      deleteAlarmCalls += 1;
      alarmAt = null;
    },
  } as unknown as DurableObjectStorage;
  const state = {
    storage,
    waitUntil: (promise: Promise<unknown>) => {
      waitUntilPromises.push(promise);
    },
  } as unknown as DurableObjectState;
  return {
    state,
    records,
    alarmAt: () => alarmAt,
    deleteAlarmCalls: () => deleteAlarmCalls,
    setAlarmCalls: () => setAlarmCalls,
    settleWaitUntil: async () => {
      await Promise.all(waitUntilPromises.splice(0));
    },
    transactionCalls: () => transactionCalls,
  };
}

function integratedDurableEnv(
  runtime: ShockAuditMcp,
  overrides: Record<string, unknown> = {},
) {
  return {
    ...env,
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
    ...overrides,
    MCP_RUNTIME: {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: (request: Request) => runtime.fetch(request),
      }),
    },
  };
}

async function seedHostReasoningTask(
  storage: DurableObjectStorage,
  {
    runId,
    taskId,
    createdAt,
    expiresAt,
  }: {
    runId: string;
    taskId: string;
    createdAt: string;
    expiresAt: string;
  },
) {
  const boundedInput = {
    study: { industry: "technology" },
    sourceIds: ["source-1"],
  };
  const store = new HostReasoningTaskStore(storage);
  await store.prepare({
    task: createHostReasoningTask({
      taskId,
      taskType: "screen02-search-review",
      screen: "screen-02",
      runId,
      candidateId: null,
      candidatePoolId: "pool-1",
      selectedEventId: null,
      claimGroupId: null,
      scopeFingerprint: fingerprintHostReasoningValue("scope"),
      candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
      eventFingerprint: null,
      sourcePoolFingerprint: fingerprintHostReasoningValue(["source-1"]),
      inputFingerprint: fingerprintHostReasoningValue(boundedInput),
      promptVersion: "prompt-v1",
      workflowVersion: "workflow-v1",
      requiredSubmissionSchemaVersion:
        "screen02-search-review-submission-v1",
      createdAt,
      expiresAt,
      retryCount: 0,
      appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
      hostModel: "host_model_not_exposed",
    }),
    boundedInput,
    allowedSourceIds: ["source-1"],
    operationId: `prepare-${taskId}`,
  });
  return store;
}

describe("Worker HTTP contract", () => {
  it("serves an unauthenticated health check", async () => {
    const response = await callWorker(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ready: true,
      service: "ShockAudit",
      version: SHOCKAUDIT_VERSION,
      readiness: {
        status: "ready",
        mode: "local-dev-in-process",
        mcpRuntime: "local-dev-in-process",
        workersAi: "not-applicable",
        reasoning: "not-applicable",
        assessmentSigning: "not-applicable",
        code: "READY",
      },
      retention: {
        schemaVersion: "screen-02-retention-policy-v1",
        idleHours: 24,
        absoluteDays: 7,
        continuedHours: 1,
        immediateRetirement: true,
        cleanup: "durable-object-alarm",
      },
      capabilities: {
        schemaVersion: "shockaudit-runtime-capabilities-v1",
        sourceRegister: {
          schemaVersion: "shockaudit-source-register-v4",
          sourceCount: 18,
          enabledSourceIds: expect.arrayContaining([
            "federal_register",
            "ecfr",
          ]),
          entries: {
            federal_register: {
              configured: true,
              implemented: true,
              enabled: true,
              status: "enabled_not_tested",
            },
            govinfo: {
              configured: false,
              implemented: true,
              enabled: false,
              status: "not_configured",
            },
          },
        },
        intelligence: {
          configuredMode: "experimental-off",
          exposure: "disabled",
          modelCallable: false,
          actualSignedInProof: false,
        },
        declaredResources: {
          measurementStatus: "declared_not_deployed_measurement",
          mcpRequestMaxBytes: MAX_MCP_BODY_BYTES,
          evidenceChunkMaxBytes: 96_000,
          policyEventCardReviewMaxBytes: 96_000,
        },
      },
      uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
      supportedUiResourceUris:
        SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
    });
  });

  it("never dispatches Screen 5 inference during configured startup or health", async () => {
    const providerFetch = vi.fn(async () => {
      throw new Error("Health must not contact OpenAI.");
    });
    const secret = "health-openai-key-never-projected";
    const launchId = "0123456789abcdef0123456789abcdef";
    const configId = `sha256:${"a".repeat(64)}`;
    const response = await worker.fetch(
      new Request("http://localhost/health") as never,
      {
        ...env,
        OPENAI_API_KEY: secret,
        SHOCKAUDIT_SCREEN5_OPENAI_MODE: "local-preview",
        SHOCKAUDIT_LOCAL_LAUNCH_ID: launchId,
        SHOCKAUDIT_LOCAL_CONFIG_ID: configId,
        SCREEN5_OPENAI_FETCH: providerFetch,
      } as never,
      context as never,
    );
    expect(response.status).toBe(200);
    expect(providerFetch).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain("OPENAI_API_KEY");
    expect(JSON.parse(body)).toMatchObject({
      localLaunchId: launchId,
      localConfigId: configId,
    });
  });

  it("reports keyed-source presence without exposing keys, values, or identifiers", async () => {
    const govInfoSecret = "health-only-govinfo-secret";
    const congressSecret = "health-only-congress-secret";
    const regulationsSecret = "health-only-regulations-secret";
    const openStatesSecret = "health-only-openstates-secret";
    const openAlexSecret = "health-only-openalex-secret";
    const response = await worker.fetch(
      new Request("http://localhost/health") as never,
      {
        ...env,
        GOVINFO_API_KEY: govInfoSecret,
        CONGRESS_API_KEY: congressSecret,
        REGULATIONS_API_KEY: regulationsSecret,
        OPENSTATES_API_KEY: openStatesSecret,
        OPENALEX_API_KEY: openAlexSecret,
        SHOCKAUDIT_HOST_REASONING_MODE: "screen02-only",
      } as never,
      context as never,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(govInfoSecret);
    expect(text).not.toContain(congressSecret);
    expect(text).not.toContain(regulationsSecret);
    expect(text).not.toContain(openStatesSecret);
    expect(text).not.toContain(openAlexSecret);
    expect(text).not.toContain("GOVINFO_API_KEY");
    expect(text).not.toContain("CONGRESS_API_KEY");
    expect(text).not.toContain("REGULATIONS_API_KEY");
    expect(text).not.toContain("OPENSTATES_API_KEY");
    expect(text).not.toContain("OPENALEX_API_KEY");
    const payload = JSON.parse(text) as {
      capabilities: {
        sourceRegister: { entries: Record<string, Record<string, unknown>> };
        intelligence: Record<string, unknown>;
      };
    };
    expect(payload.capabilities.sourceRegister.entries.govinfo).toMatchObject({
      configured: true,
      implemented: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(payload.capabilities.sourceRegister.entries.congress_gov)
      .toMatchObject({
        configured: true,
        implemented: true,
        tested: false,
        enabled: false,
        status: "configured_not_tested",
      });
    expect(payload.capabilities.sourceRegister.entries.regulations_gov)
      .toMatchObject({
        configured: true,
        implemented: true,
        tested: false,
        enabled: false,
        status: "configured_not_tested",
      });
    expect(payload.capabilities.sourceRegister.entries.openstates)
      .toMatchObject({
        configured: true,
        implemented: true,
        tested: false,
        enabled: false,
        status: "configured_not_tested",
      });
    expect(payload.capabilities.sourceRegister.entries.openalex)
      .toMatchObject({
        configured: true,
        implemented: true,
        tested: false,
        enabled: false,
        status: "configured_not_tested",
      });
    expect(payload.capabilities.intelligence).toMatchObject({
      configuredMode: "screen02-only",
      exposure: "model-callable-unverified",
      modelCallable: true,
      actualSignedInProof: false,
      availableTaskTypes: ["screen02-search-review"],
    });
  });

  it("reports keyed sources healthy only after explicit operation-shaped live probes", async () => {
    const requests: string[] = [];
    const connectorFetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requests.push(url);
      const host = new URL(url).hostname;
      if (host === "api.govinfo.gov") {
        return new Response(JSON.stringify({
          results: [{
            collectionCode: "PLAW",
            packageId: "PLAW-115publ391",
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (host === "api.congress.gov") {
        return new Response(JSON.stringify({
          bill: {
            congress: 115,
            type: "S",
            number: "756",
            title: "First Step Act of 2018",
            laws: [{ type: "Public Law", number: "391" }],
          },
        }), { headers: { "content-type": "application/json" } });
      }
      if (host === "api.regulations.gov") {
        return new Response(JSON.stringify({
          data: [{
            id: "FERC-2018-03708",
            attributes: { frDocNum: "2018-03708" },
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (host === "v3.openstates.org") {
        return new Response(JSON.stringify({
          results: [{
            id: "ocd-jurisdiction/country:us/state:ny/government",
            name: "New York",
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (host === "api.openalex.org") {
        return new Response(JSON.stringify({
          meta: { count: 1, page: 1, per_page: 1 },
          results: [{
            id: "https://openalex.org/W1234567890",
            doi: "https://doi.org/10.1234/health.probe",
            display_name: "Difference in differences public policy",
            authorships: [{ author: { display_name: "A. Researcher" } }],
            publication_year: 2025,
            publication_date: "2025-01-01",
            primary_location: null,
            best_oa_location: null,
            type: "article",
            language: "en",
            is_retracted: false,
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected source probe ${url}`);
    });
    const response = await worker.fetch(
      new Request("http://localhost/health?source-probe=live") as never,
      {
        ...env,
        GOVINFO_API_KEY: "live-govinfo-secret",
        CONGRESS_API_KEY: "live-congress-secret",
        REGULATIONS_API_KEY: "live-regulations-secret",
        OPENSTATES_API_KEY: "live-openstates-secret",
        OPENALEX_API_KEY: "live-openalex-secret",
        CONNECTOR_FETCH: connectorFetch,
      } as never,
      context as never,
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(
      /live-(?:govinfo|congress|regulations|openstates|openalex)-secret/u,
    );
    const entries = (JSON.parse(text) as {
      capabilities: { sourceRegister: { entries: Record<string, unknown> } };
    }).capabilities.sourceRegister.entries;
    for (const id of [
      "govinfo", "congress_gov", "regulations_gov", "openstates", "openalex",
    ]) {
      expect(entries[id]).toMatchObject({
        configured: true,
        implemented: true,
        tested: true,
        enabled: true,
        status: "healthy",
      });
    }
    expect(requests).toHaveLength(5);
  });

  it("fails closed when the Durable Object binding is missing without the explicit local opt-in", async () => {
    const unavailableEnv = { ...env } as Record<string, unknown>;
    delete unavailableEnv.SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP;
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 120,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "missing-runtime-test", version: "1" },
        },
      }) as never,
      unavailableEnv as never,
      context as never,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      readiness: {
        status: "not-ready",
        mode: "integrated",
        mcpRuntime: "missing",
        workersAi: "not-applicable",
        reasoning: "chatgpt-host",
        code: "MCP_RUNTIME_UNAVAILABLE",
      },
    });
  });

  it("keeps integrated health ready without a Cloudflare Workers AI binding", async () => {
    const harness = durableObjectStateHarness();
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      } as never,
    );
    const health = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(runtime) as never,
      context as never,
    );
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      ready: true,
      readiness: {
        status: "ready",
        mode: "integrated",
        mcpRuntime: "durable-object",
        workersAi: "not-applicable",
        reasoning: "chatgpt-host",
        assessmentSigning: "ready",
        code: "READY",
      },
    });
  });

  it("bootstraps one persistent private signing pair inside the global Durable Object", async () => {
    const harness = durableObjectStateHarness();
    const runtimeEnv = {
      ...env,
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
    };
    const runtime = new ShockAuditMcp(
      harness.state,
      runtimeEnv as never,
    );
    const durableEnv = integratedDurableEnv(runtime);

    const response = await worker.fetch(
      new Request("https://preview.example/health") as never,
      durableEnv as never,
      context as never,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      ready: true,
      readiness: {
        status: "ready",
        mode: "integrated",
        mcpRuntime: "durable-object",
        workersAi: "not-applicable",
        reasoning: "chatgpt-host",
        assessmentSigning: "ready",
        code: "READY",
      },
    });
    expect(harness.records.size).toBe(1);
    expect(harness.transactionCalls()).toBe(1);
    expect(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY).not.toMatch(
      /^screen02-workflow-(?:v021|expiry-v1):/,
    );
    const stored = harness.records.get(
      SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY,
    ) as { schemaVersion?: string; keyId?: string; key?: string };
    expect(stored).toMatchObject({
      schemaVersion: "screen02-workflow-do-signing-key-v1",
    });
    expect(stored.keyId).toMatch(/^do-bootstrap-[0-9a-f]{24}$/);
    expect(stored.key).toMatch(/^[0-9a-f]{128}$/);
    expect(JSON.stringify(payload)).not.toContain(stored.key);
    expect(JSON.stringify(payload)).not.toContain(stored.keyId);

    const second = await worker.fetch(
      new Request("https://preview.example/health") as never,
      durableEnv as never,
      context as never,
    );
    expect(second.status).toBe(200);
    expect(harness.transactionCalls()).toBe(1);
    expect(
      harness.records.get(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY),
    ).toEqual(stored);

    const restartedRuntime = new ShockAuditMcp(
      harness.state,
      runtimeEnv as never,
    );
    const afterRestart = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(restartedRuntime) as never,
      context as never,
    );
    expect(afterRestart.status).toBe(200);
    expect(harness.transactionCalls()).toBe(2);
    expect(
      harness.records.get(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY),
    ).toEqual(stored);
  });

  it.each([
    {
      name: "an invalid key ID",
      keyId: "invalid key id",
      key: validSigningEnv.SCREEN02_WORKFLOW_SIGNING_KEY,
    },
    {
      name: "a signing key shorter than 32 bytes",
      keyId: validSigningEnv.SCREEN02_WORKFLOW_SIGNING_KEY_ID,
      key: "too-short",
    },
  ])("reports normal integrated health as unavailable with $name", async ({
    keyId,
    key,
  }) => {
    const harness = durableObjectStateHarness();
    const signingEnv = {
      SCREEN02_WORKFLOW_SIGNING_KEY_ID: keyId,
      SCREEN02_WORKFLOW_SIGNING_KEY: key,
    };
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
        ...signingEnv,
      } as never,
    );
    const response = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(runtime, signingEnv) as never,
      context as never,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      readiness: {
        mode: "integrated",
        workersAi: "not-applicable",
        reasoning: "chatgpt-host",
        assessmentSigning: "not-ready",
        code: "SCREEN02_SIGNING_UNAVAILABLE",
      },
    });
    expect(harness.records.size).toBe(0);
    expect(harness.transactionCalls()).toBe(0);
  });

  it("reports normal integrated health ready with the runtime and a valid current signing pair", async () => {
    const harness = durableObjectStateHarness({
      transactionError: new Error(
        "Explicit signing must not touch bootstrap storage.",
      ),
    });
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
        ...validSigningEnv,
      } as never,
    );
    const response = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(runtime, validSigningEnv) as never,
      context as never,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      ready: true,
      readiness: {
        status: "ready",
        mode: "integrated",
        mcpRuntime: "durable-object",
        workersAi: "not-applicable",
        reasoning: "chatgpt-host",
        assessmentSigning: "ready",
        code: "READY",
      },
    });
    expect(JSON.stringify(payload)).not.toContain(
      validSigningEnv.SCREEN02_WORKFLOW_SIGNING_KEY,
    );
    expect(JSON.stringify(payload)).not.toContain(
      validSigningEnv.SCREEN02_WORKFLOW_SIGNING_KEY_ID,
    );
    expect(harness.records.size).toBe(0);
    expect(harness.transactionCalls()).toBe(0);
  });

  it("preserves an explicit previous signing pair without creating a bootstrap key", async () => {
    const explicitKeyring = {
      ...validSigningEnv,
      SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID:
        "screen02-readiness-previous-v1",
      SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY:
        previousReadinessTestSigningKey,
    } as const;
    const harness = durableObjectStateHarness({
      transactionError: new Error(
        "Explicit key rotation must not touch bootstrap storage.",
      ),
    });
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
        ...explicitKeyring,
      } as never,
    );
    const response = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(runtime, explicitKeyring) as never,
      context as never,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(
      explicitKeyring.SCREEN02_WORKFLOW_SIGNING_KEY,
    );
    expect(text).not.toContain(
      explicitKeyring.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY,
    );
    expect(harness.records.size).toBe(0);
    expect(harness.transactionCalls()).toBe(0);
  });

  it("fails health and MCP closed without leaking a bootstrap storage failure", async () => {
    const harness = durableObjectStateHarness({
      transactionError: new Error(
        "sensitive-storage-diagnostic-must-not-escape",
      ),
    });
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      } as never,
    );
    const durableEnv = integratedDurableEnv(runtime);

    const health = await worker.fetch(
      new Request("https://preview.example/health") as never,
      durableEnv as never,
      context as never,
    );
    expect(health.status).toBe(503);
    const healthText = await health.text();
    expect(healthText).toContain("SCREEN02_SIGNING_UNAVAILABLE");
    expect(healthText).not.toContain("sensitive-storage-diagnostic");

    const mcp = await worker.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 121,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "bootstrap-failure-test", version: "1" },
          },
        },
        "/mcp",
        "https://preview.example",
      ) as never,
      durableEnv as never,
      context as never,
    );
    expect(mcp.status).toBe(503);
    const mcpText = await mcp.text();
    expect(mcpText).toContain("SCREEN02_SIGNING_UNAVAILABLE");
    expect(mcpText).not.toContain("sensitive-storage-diagnostic");
    expect(harness.records.size).toBe(0);
  });

  it("fails closed instead of rotating malformed persisted signing material", async () => {
    const harness = durableObjectStateHarness();
    const malformed = {
      schemaVersion: "screen02-workflow-do-signing-key-v1",
      keyId: "do-bootstrap-malformed",
      key: "too-short",
    };
    harness.records.set(
      SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY,
      malformed,
    );
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      } as never,
    );
    const response = await worker.fetch(
      new Request("https://preview.example/health") as never,
      integratedDurableEnv(runtime) as never,
      context as never,
    );
    expect(response.status).toBe(503);
    expect(
      harness.records.get(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY),
    ).toEqual(malformed);
    expect(harness.records.size).toBe(1);
  });

  it("rejects Stage 1 preview mode on the stable production origin", async () => {
    const response = await worker.fetch(
      new Request(`${SHOCKAUDIT_PUBLIC_ORIGIN}/health`) as never,
      {
        ...env,
        ...validSigningEnv,
        STAGE1_PREVIEW_ONLY: "true",
        SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT: "true",
        MCP_RUNTIME: {
          idFromName: (name: string) => ({ name }),
          get: () => ({ fetch: async () => new Response("unused") }),
        },
      } as never,
      context as never,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      readiness: {
        status: "not-ready",
        mode: "invalid-stage1-preview",
        code: "STAGE1_PREVIEW_CONFIGURATION_REJECTED",
      },
    });
  });

  it("rejects the local in-process fallback on the stable production origin", async () => {
    const response = await worker.fetch(
      new Request(`${SHOCKAUDIT_PUBLIC_ORIGIN}/health`) as never,
      env as never,
      context as never,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      readiness: {
        status: "not-ready",
        mode: "integrated",
        mcpRuntime: "missing",
        code: "MCP_RUNTIME_UNAVAILABLE",
      },
    });
  });

  it("fails every route closed when Stage 1 preview mode is invalid", async () => {
    let assetFetches = 0;
    const response = await worker.fetch(
      new Request("https://preview.example/assets/shockaudit-app.js") as never,
      {
        ...env,
        ASSETS: {
          fetch: async () => {
            assetFetches += 1;
            return new Response("console.log('should not be served');");
          },
        },
        STAGE1_PREVIEW_ONLY: "true",
        SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT: undefined,
      } as never,
      context as never,
    );
    expect(response.status).toBe(503);
    expect(assetFetches).toBe(0);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      readiness: {
        mode: "invalid-stage1-preview",
        code: "STAGE1_PREVIEW_CONFIGURATION_REJECTED",
      },
    });
  });

  it("serves cross-origin stable UI assets without stale caching", async () => {
    for (const url of [
      "http://localhost/assets/shockaudit-app.js",
      `http://localhost/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
      "http://localhost/assets/shockaudit-app.css",
      `http://localhost/assets/shockaudit-app.css?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
    ]) {
      const response = await callWorker(new Request(url));
      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cross-origin-resource-policy")).toBe(
        "cross-origin",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain(
        new URL(url).pathname.endsWith(".js")
          ? "application/javascript"
          : "text/css",
      );
    }
  });

  it("serves commit-bound startup preloads and Screen 3/4 chunks with the same fail-closed asset headers", async () => {
    for (const assetName of [
      "shockaudit-jsx-runtime-0123abc.js",
      "shockaudit-screen02-engine-0123abc.js",
      "shockaudit-screen03-0123abc.js",
      "shockaudit-screen04-0123abc.js",
    ]) {
      const response = await callWorker(
        new Request(
          `http://localhost/assets/${assetName}`,
        ),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cross-origin-resource-policy")).toBe(
        "cross-origin",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain(
        "application/javascript",
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("fails closed for stale or ambiguous stable UI asset versions", async () => {
    for (const url of [
      "http://localhost/assets/shockaudit-app.js?v=0.2.22",
      "http://localhost/assets/shockaudit-app.css?v=0.2.22",
      `http://localhost/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}&v=0.2.22`,
      "http://localhost/assets/shockaudit-app.css?v=",
    ]) {
      const response = await callWorker(new Request(url));
      expect(response.status).toBe(410);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cross-origin-resource-policy")).toBe(
        "cross-origin",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      await expect(response.text()).resolves.toContain(
        "UI asset version is retired",
      );
    }
  });

  it("returns a real 404 instead of caching the SPA fallback as an asset", async () => {
    const response = await callWorker(
      new Request("http://localhost/assets/removed-build.js"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "cross-origin",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("routes production MCP requests through the configured compute object", async () => {
    let routedPath = "";
    const routedEnv = {
      ...env,
      ...validSigningEnv,
      MCP_RUNTIME: {
        idFromName: (name: string) => ({ name }),
        get: () => ({
          fetch: async (request: Request) => {
            routedPath = new URL(request.url).pathname;
            return new Response("routed", { status: 207 });
          },
        }),
      },
    };
    const response = await worker.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 12,
          method: "ping",
          params: {},
        },
        "/mcp/",
      ) as never,
      routedEnv as never,
      context as never,
    );
    expect(response.status).toBe(207);
    expect(await response.text()).toBe("routed");
    expect(routedPath).toBe("/mcp");
  });

  it("restores each Screen 2 Find continuation in a fresh MCP runtime instance over the same Durable Object storage", async () => {
    const harness = durableObjectStateHarness();
    const runtimeFetchUrls: string[] = [];
    const connectorRequests: URL[] = [];
    const retrievedAt = "2026-08-10T18:00:00.000Z";
    const rules = [
      "Video Game Platform Accessibility Rule",
      "Interactive Entertainment Privacy Safeguards Rule",
      "Online Game Marketplace Competition Rule",
      "Video Game Publisher Cybersecurity Rule",
      "Digital Game Subscription Transparency Rule",
      "Cloud Gaming Consumer Protection Rule",
    ].map((title, index) => ({
      title,
      documentNumber: `2019-${String(12001 + index)}`,
      date: `2019-0${index + 1}-15`,
    }));
    const connectorFetch = vi.fn(async (
      input: string | URL | Request,
    ) => {
      const url = input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
      connectorRequests.push(url);
      if (url.pathname === "/api/v1/documents.json") {
        return new Response(
          JSON.stringify({
            count: rules.length,
            results: rules.map((rule) => ({
              title: rule.title,
              type: "Rule",
              abstract:
                `Rule ${rule.documentNumber} was published for the video gaming industry.`,
              document_number: rule.documentNumber,
              publication_date: rule.date,
              html_url:
                `https://www.federalregister.gov/d/${rule.documentNumber}`,
              agencies: [{ name: "Digital Markets Commission" }],
            })),
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      const rule = rules.find(
        (candidate) =>
          url.pathname === `/d/${candidate.documentNumber}`,
      );
      if (rule) {
        if (rules.indexOf(rule) < 4) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(
          `<!doctype html><html><head><title>${rule.title}</title></head><body><main><h1>${rule.title}</h1><h2>AGENCY:</h2><p>Digital Markets Commission.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: ${rule.documentNumber}.</p><p>This final rule requires U.S. publicly listed video gaming firms, including video game publishers and online game platforms, to change consumer protection and reporting procedures beginning on ${rule.date}.</p></main></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      if (url.hostname === "www.ftc.gov") {
        return new Response(
          "<!doctype html><html><body><main><p>No matching releases.</p></main></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      return new Response(JSON.stringify({ count: 0, results: [] }), {
        headers: { "content-type": "application/json" },
      });
    });
    const runtimeEnv = {
      ...env,
      ...validSigningEnv,
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      NOW: () => retrievedAt,
      SCREEN02_SEARCH_MONOTONIC_NOW: Date.now,
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
      CONNECTOR_FETCH: connectorFetch,
    };
    const initialRuntime = new ShockAuditMcp(harness.state, runtimeEnv as never);
    const publicEnv = integratedDurableEnv(initialRuntime, {
      ...validSigningEnv,
      CONNECTOR_FETCH: connectorFetch,
    });
    let runtimeInstanceCount = 0;
    publicEnv.MCP_RUNTIME.get = () => ({
      fetch: async (request: Request) => {
        runtimeFetchUrls.push(request.url);
        runtimeInstanceCount += 1;
        return new ShockAuditMcp(harness.state, runtimeEnv as never)
          .fetch(request);
      },
    });
    let rpcId = 300;
    const callTool = async (
      name: string,
      args: Record<string, unknown>,
    ) => {
      rpcId += 1;
      const response = await worker.fetch(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: rpcId,
            method: "tools/call",
            params: { name, arguments: args },
          },
          "/mcp",
          "https://preview.example",
        ) as never,
        publicEnv as never,
        context as never,
      );
      expect(response.status).toBe(200);
      const payload = await readMcpPayload(response) as
        Screen02WorkflowToolPayload & { error?: unknown };
      expect(payload.error).toBeUndefined();
      expect(
        payload.result?.isError,
        JSON.stringify(payload.result?.content),
      ).not.toBe(true);
      return payload;
    };

    const callSealedTool = async (
      name: string,
      args: Record<string, unknown>,
      operationId: string,
      kind: Screen02SealedResultKind,
    ) => {
      const responseKey = await generateScreen02ResponseKeyMaterial();
      const exportedResponseKey =
        await exportScreen02ResponseKeyMaterial(responseKey);
      const payload = await callTool(name, {
        ...args,
        responseKeyId: exportedResponseKey.keyId,
        responseKey: exportedResponseKey.key,
      });
      const snapshot = await decryptScreen02WorkflowClientSnapshot(
        payload.result?.structuredContent?.sealedSnapshot,
        { operationId, kind, responseKey },
      );
      expect(screen02WorkflowSnapshot(payload)).toEqual(snapshot);
      return { payload, snapshot };
    };

    const openOperationId = "http-continuation-open";
    const { snapshot: initial } = await callSealedTool(
      "create_screen02_workflow_v024",
      {
        schemaVersion: "screen-02-workflow-create-v2",
        operationId: openOperationId,
        studyContext: confirmedWorkflowFindContext("Video gaming", {
          eventDescriptor: "regulatory shock",
          studyPeriod: "2014–2022",
        }),
      },
      openOperationId,
      "open",
    );
    const startOperationId = "http-continuation-start";
    const { snapshot: pending } = await callSealedTool(
      "mutate_screen02_workflow_v024",
      {
        schemaVersion: "screen-02-workflow-action-v2",
        operationId: startOperationId,
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
      startOperationId,
      "mutation",
    );
    const pendingState = stateFromScreen02WorkflowClientSnapshot(pending);
    expect(pendingState.mode).toBe("find");
    if (pendingState.mode !== "find") {
      throw new Error("Expected the public continuation fixture to use Find mode.");
    }
    expect(pendingState.discoveryRequests.at(-1)?.status).toBe("searching");
    expect(connectorFetch).not.toHaveBeenCalled();

    let latest = pending;
    let terminal: Screen02WorkflowClientSnapshot | null = null;
    let finalContinuationArgs: Record<string, unknown> | null = null;
    let recordsBeforeTerminal:
      | Map<string, unknown>
      | null = null;
    let continuationCalls = 0;
    for (let index = 1; index <= 16; index += 1) {
      const recordsBeforeCall = structuredClone(harness.records);
      const args = {
        schemaVersion: "screen-02-workflow-action-v2",
        operationId: `http-continuation-${index}`,
        runId: latest.runId,
        accessToken: latest.accessToken,
        expectedRevision: latest.revision,
        expectedStateFingerprint: latest.stateFingerprint,
        action: "find-search-continue",
        payload: {},
      };
      const { snapshot } = await callSealedTool(
        "mutate_screen02_workflow_v024",
        args,
        args.operationId,
        "mutation",
      );
      continuationCalls += 1;
      const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
      if (state.mode !== "find") {
        throw new Error("The continued Screen 2 workflow changed mode.");
      }
      if (state.discoveryRequests.at(-1)?.status === "searching") {
        expect(snapshot.revision).toBe(pending.revision);
        expect(snapshot.stateFingerprint).toBe(pending.stateFingerprint);
        expect(snapshot.stateEnvelope).toEqual(pending.stateEnvelope);
        latest = snapshot;
        continue;
      }
      terminal = snapshot;
      finalContinuationArgs = args;
      recordsBeforeTerminal = recordsBeforeCall;
      break;
    }

    expect(continuationCalls).toBeGreaterThanOrEqual(2);
    expect(terminal).not.toBeNull();
    if (!terminal || !finalContinuationArgs) {
      throw new Error("The bounded continuation did not reach a terminal state.");
    }
    const terminalState = stateFromScreen02WorkflowClientSnapshot(terminal);
    if (terminalState.mode !== "find") {
      throw new Error("The terminal Screen 2 workflow changed mode.");
    }
    expect(terminal.revision).toBe(pending.revision + 1);
    expect(terminalState.discoveryRequests.at(-1)?.status).toMatch(
      /^completed(?:-empty)?$/,
    );
    expect(
      terminalState.candidateSets.at(-1)?.manifest.funnel
        ?.sourceRecordsRetrieved,
    ).toBeGreaterThan(0);
    expect(
      terminalState.candidateSets.at(-1)?.manifest.channels,
    ).toContainEqual(
      expect.objectContaining({
        channel: "Worker continuation request accounting",
      }),
    );
    expect(
      connectorRequests.filter((request) =>
        request.hostname === "www.federalregister.gov" &&
        request.pathname.startsWith("/d/")
      ).length,
    ).toBeGreaterThan(2);

    const connectorCallCountBeforeReplay = connectorFetch.mock.calls.length;
    const { snapshot: replayed } = await callSealedTool(
      "mutate_screen02_workflow_v024",
      finalContinuationArgs,
      finalContinuationArgs.operationId as string,
      "mutation",
    );
    expect(replayed).toEqual(terminal);
    expect(connectorFetch).toHaveBeenCalledTimes(
      connectorCallCountBeforeReplay,
    );

    expect(runtimeFetchUrls).toHaveLength(3 + continuationCalls);
    expect(runtimeInstanceCount).toBe(runtimeFetchUrls.length);
    expect(runtimeFetchUrls.every((url) =>
      new URL(url).origin === "https://preview.example" &&
      new URL(url).pathname === "/mcp"
    )).toBe(true);
    expect(connectorRequests.some((request) =>
      request.pathname.startsWith("/mcp") ||
      request.hostname === "shockaudit.internal"
    )).toBe(false);

    const continuationEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen02-find-continuation-v1:")
    );
    expect(continuationEntry).toBeDefined();
    const continuationRecord = continuationEntry?.[1] as
      | Screen02FindContinuationRecord
      | undefined;
    if (!continuationRecord) {
      throw new Error("The continuation journal was not retained for review.");
    }
    const sourceRequestCount = connectorRequests.filter((request) =>
      request.pathname === "/api/v1/documents.json" ||
      request.hostname === "www.ftc.gov"
    ).length;
    const documentRequestCount = connectorRequests.length - sourceRequestCount;
    expect(continuationRecord.usage).toMatchObject({
      sourceQueries: sourceRequestCount,
      connectorFetches: sourceRequestCount,
      documentAttempts: documentRequestCount,
      transportHops: documentRequestCount,
      redirectHops: 0,
      continuationRequests: continuationCalls,
      platformSubrequests:
        sourceRequestCount + documentRequestCount,
    });
    expect(continuationRecord.journal).toHaveLength(continuationCalls);
    expect(continuationRecord.journal[0]?.reservation).toMatchObject({
      sourceQueries: 19,
      connectorFetches: 19,
      documentAttempts: 2,
      transportHops: 8,
      redirectHops: 6,
    });
    const boundedUsageKeys: Array<keyof Screen02FindContinuationWork> = [
      "sourceQueries",
      "connectorFetches",
      "documentAttempts",
      "transportHops",
      "redirectHops",
      "retries",
      "receivedBytes",
    ];
    for (const entry of continuationRecord.journal) {
      expect(entry.status).toBe("committed");
      expect(entry.actualUsage).not.toBeNull();
      if (!entry.actualUsage) continue;
      for (const key of boundedUsageKeys) {
        const maximum = key === "receivedBytes"
          ? entry.reservation.maximumReceivedBytes
          : entry.reservation[key];
        expect(entry.actualUsage[key]).toBeLessThanOrEqual(maximum);
      }
    }

    if (!recordsBeforeTerminal) {
      throw new Error("The terminal parent predecessor was not retained.");
    }
    const storedTerminal = decodeScreen02FindStoreCheckpoint(
      continuationRecord.checkpoint,
    );
    if (storedTerminal.status !== "complete") {
      throw new Error("The private terminal checkpoint was not complete.");
    }
    const legacyCheckpoint = {
      schemaVersion: "screen-02-find-store-checkpoint-v1",
      step: {
        status: "complete",
        discovery: storedTerminal.discovery,
        // v0.4.8 retained this duplicate execution projection. The v0.5.0
        // decoder deliberately restores only the exact terminal discovery.
        progress: {
          invocationsCompleted: continuationRecord.journal.length,
          invocationDocumentsAttempted:
            continuationRecord.journal.at(-1)?.actualUsage
              ?.documentAttempts ?? 0,
          documentsAttempted: continuationRecord.usage.documentAttempts,
          receivedBytes: continuationRecord.usage.receivedBytes,
          acquisitions:
            storedTerminal.discovery.manifest.retrievalExecution
              ?.documentAcquisitions ?? [],
          attemptedDocumentKeys: [],
          attemptJournal: [],
          ordinaryConnectorExecuted: false,
          recoveryConnectorExecuted: false,
          ordinarySourceQueries: 0,
          recoverySourceQueries: 0,
          ordinaryConnectorFetches: 0,
          recoveryConnectorFetches: 0,
        },
      },
    };
    const { failure: _failure, ...legacyContinuation } = continuationRecord;
    harness.records.clear();
    for (const [key, value] of recordsBeforeTerminal) {
      harness.records.set(key, structuredClone(value));
    }
    harness.records.set(continuationEntry![0], {
      ...legacyContinuation,
      schemaVersion: "screen-02-find-continuation-store-v1",
      status: "completed",
      checkpoint: legacyCheckpoint,
      checkpointFingerprint:
        fingerprintScreen02WorkflowValue(legacyCheckpoint),
    });
    const connectorCountBeforeLegacyReplay = connectorFetch.mock.calls.length;
    const legacyReplayOperationId = "http-continuation-legacy-terminal-replay";
    const { snapshot: legacyReplayed } = await callSealedTool(
      "mutate_screen02_workflow_v024",
      {
        schemaVersion: "screen-02-workflow-action-v2",
        operationId: legacyReplayOperationId,
        runId: latest.runId,
        accessToken: latest.accessToken,
        expectedRevision: latest.revision,
        expectedStateFingerprint: latest.stateFingerprint,
        action: "find-search-continue",
        payload: {},
      },
      legacyReplayOperationId,
      "mutation",
    );
    const legacyReplayedState =
      stateFromScreen02WorkflowClientSnapshot(legacyReplayed);
    expect(legacyReplayedState.mode).toBe("find");
    if (legacyReplayedState.mode !== "find") {
      throw new Error("The legacy terminal replay changed workflow mode.");
    }
    expect(legacyReplayedState.discoveryRequests.at(-1)?.status).toMatch(
      /^completed(?:-empty)?$/,
    );
    expect(legacyReplayed.revision).toBe(pending.revision + 1);
    expect(connectorFetch).toHaveBeenCalledTimes(
      connectorCountBeforeLegacyReplay,
    );
    expect(runtimeInstanceCount).toBe(runtimeFetchUrls.length);
  }, 45_000);

  it("converts an escaping compute-object exception into a bounded phase diagnostic", async () => {
    const response = await worker.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 122,
          method: "ping",
          params: {},
        },
        "/mcp",
        "https://preview.example",
      ) as never,
      {
        ...env,
        ...validSigningEnv,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
        MCP_RUNTIME: {
          idFromName: (name: string) => ({ name }),
          get: () => ({
            fetch: async () => {
              throw new Error(
                "sensitive-compute-object-diagnostic-must-not-escape",
              );
            },
          }),
        },
      } as never,
      context as never,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("x-shockaudit-mcp-failure-phase")).toBe(
      "durable-object-fetch",
    );
    const text = await response.text();
    expect(text).not.toContain("sensitive-compute-object-diagnostic");
    expect(JSON.parse(text)).toMatchObject({
      ok: false,
      ready: false,
      code: "MCP_RUNTIME_REQUEST_FAILED",
      phase: "durable-object-fetch",
      error: expect.stringContaining("Replay the same idempotent operation"),
    });
  });

  it("initializes over stateless Streamable HTTP", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ShockAudit test client",
            version: SHOCKAUDIT_VERSION,
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: { serverInfo?: { name?: string; version?: string } };
    };
    expect(payload.result?.serverInfo?.name).toBe("ShockAudit");
    expect(payload.result?.serverInfo?.version).toBe(SHOCKAUDIT_VERSION);
  });

  it("accepts ChatGPT's connector-discovery Origin", async () => {
    const request = mcpRequest(
      {
        jsonrpc: "2.0",
        id: 101,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ChatGPT connector discovery",
            version: "1.0.0",
          },
        },
      },
      "/mcp",
      "https://shockaudit-preview.example",
    );
    request.headers.set("origin", "https://chatgpt.com");

    const response = await callWorker(request);
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(payload.result?.serverInfo?.name).toBe("ShockAudit");
  });

  it("accepts ChatGPT's connector-discovery CORS preflight", async () => {
    const request = new Request(
      "https://shockaudit-preview.example/mcp",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://chatgpt.com",
          "access-control-request-method": "POST",
          "access-control-request-headers":
            "content-type,mcp-protocol-version",
        },
      },
    );

    const response = await callWorker(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });

  it("rejects untrusted browser Origins", async () => {
    const request = mcpRequest(
      {
        jsonrpc: "2.0",
        id: 102,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "Untrusted browser",
            version: "1.0.0",
          },
        },
      },
      "/mcp",
      "https://shockaudit-preview.example",
    );
    request.headers.set("origin", "https://untrusted.example");

    const response = await callWorker(request);
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain("Invalid Origin");
  });

  it("runs the same stateless MCP contract inside the compute object", async () => {
    const harness = durableObjectStateHarness();
    const runtime = new ShockAuditMcp(harness.state, env as never);
    const response = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ShockAudit compute-object test",
            version: SHOCKAUDIT_VERSION,
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: { serverInfo?: { version?: string } };
    };
    expect(payload.result?.serverInfo?.version).toBe(SHOCKAUDIT_VERSION);
  });

  it("self-heals a poisoned expired workflow before dispatching the next MCP request", async () => {
    const openedAt = "2026-08-10T18:00:00.000Z";
    let now = openedAt;
    const harness = durableObjectStateHarness();
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        NOW: () => now,
      } as never,
    );
    const opened = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 109,
        method: "tools/call",
        params: {
          name: "open_shockaudit_screen_2",
          arguments: {
            studyContext: confirmedWorkflowFindContext(),
            workflowVersion: "2.1",
          },
        },
      }),
    );
    expect(opened.status).toBe(200);
    const recordEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen02-workflow-v021:"),
    );
    if (!recordEntry) throw new Error("Workflow poison fixture was not stored.");
    const [recordKey, current] = recordEntry;
    const expiresAt = (current as { expiresAt: string }).expiresAt;
    harness.records.set(recordKey, {
      ...(current as Record<string, unknown>),
      stateEnvelope: { malformed: true },
    });
    now = expiresAt;

    const initialized = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 110,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ShockAudit poison-recovery test",
            version: SHOCKAUDIT_VERSION,
          },
        },
      }),
    );
    expect(initialized.status).toBe(200);
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen02-workflow-v021:") ||
        key.startsWith("screen02-workflow-expiry-v1:"),
      ),
    ).toBe(false);
  });

  it("self-heals a poisoned expired Screen 3 child before MCP dispatch", async () => {
    const expiresAt = "2026-08-16T18:00:00.000Z";
    const runId = `s2r_${"R".repeat(43)}`;
    const harness = durableObjectStateHarness();
    harness.records.set(`screen03-workflow-v030:${runId}`, {
      expiresAt,
      malformed: true,
    });
    harness.records.set(
      `screen03-workflow-expiry-v1:${expiresAt}:${runId}`,
      runId,
    );
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        ...validSigningEnv,
        NOW: () => expiresAt,
      } as never,
    );

    const response = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 112,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ShockAudit Screen 3 poison-recovery test",
            version: SHOCKAUDIT_VERSION,
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen03-workflow-"),
      ),
    ).toBe(false);
  });

  it("still returns a bounded retention-cleanup 503 for a genuine storage transaction failure", async () => {
    const harness = durableObjectStateHarness({
      transactionError: new Error(
        "sensitive-retention-storage-error-must-not-escape",
      ),
    });
    harness.records.set(
      "screen02-workflow-expiry-v1:malformed",
      "not-a-run-id",
    );
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        ...validSigningEnv,
      } as never,
    );
    const response = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 111,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "ShockAudit storage-failure test",
            version: SHOCKAUDIT_VERSION,
          },
        },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("x-shockaudit-mcp-failure-phase")).toBe(
      "retention-cleanup",
    );
    const text = await response.text();
    expect(text).not.toContain("sensitive-retention-storage-error");
  });

  it("schedules a Durable Object alarm and deletes an idle run at the exact fake-clock boundary", async () => {
    const openedAt = "2026-08-10T18:00:00.000Z";
    let now = openedAt;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(Date.parse(now));
    try {
      const harness = durableObjectStateHarness();
      const runtime = new ShockAuditMcp(
        harness.state,
        {
          ...env,
          NOW: () => now,
        } as never,
      );
      const response = await runtime.fetch(
        mcpRequest({
          jsonrpc: "2.0",
          id: 110,
          method: "tools/call",
          params: {
            name: "open_shockaudit_screen_2",
            arguments: {
              studyContext: confirmedWorkflowFindContext(),
              workflowVersion: "2.1",
            },
          },
        }),
      );
      expect(response.status).toBe(200);
      const payload = (await readMcpPayload(response)) as {
        result?: { isError?: boolean };
      };
      expect(payload.result?.isError).not.toBe(true);

      const expiresAt =
        Date.parse(openedAt) + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS;
      expect(harness.records.size).toBe(3);
      expect(
        harness.records.has(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY),
      ).toBe(true);
      expect(harness.alarmAt()).toBe(expiresAt);

      now = new Date(expiresAt - 1).toISOString();
      dateNow.mockReturnValue(expiresAt - 1);
      await runtime.alarm();
      expect(harness.records.size).toBe(3);
      // Cloudflare alarms are never re-armed less than one second from the
      // current clock, so an intentionally early alarm moves just past the
      // exact expiry rather than spinning immediately.
      expect(harness.alarmAt()).toBe(expiresAt + 999);

      now = new Date(expiresAt).toISOString();
      dateNow.mockReturnValue(expiresAt);
      await runtime.alarm();
      expect(harness.records.size).toBe(1);
      expect(
        harness.records.has(SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY),
      ).toBe(true);
      expect(harness.alarmAt()).toBeNull();
      expect(harness.deleteAlarmCalls()).toBe(1);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("schedules and cleans a host-reasoning task through the shared Durable Object alarm", async () => {
    const createdAt = "2026-09-03T12:00:00.000Z";
    const expiresAt = "2026-09-03T12:00:05.000Z";
    let now = createdAt;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse(createdAt),
    );
    try {
      const harness = durableObjectStateHarness();
      const hostStore = await seedHostReasoningTask(harness.state.storage, {
        runId: "shared-do-run",
        taskId: "shared-do-task",
        createdAt,
        expiresAt,
      });
      const runtime = new ShockAuditMcp(
        harness.state,
        {
          ...env,
          ...validSigningEnv,
          NOW: () => now,
        } as never,
      );
      const response = await runtime.fetch(mcpRequest({
        jsonrpc: "2.0",
        id: 113,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "host-task-alarm-test", version: "1" },
        },
      }));
      expect(response.status).toBe(200);
      expect(harness.alarmAt()).toBe(Date.parse(expiresAt));

      now = expiresAt;
      dateNow.mockReturnValue(Date.parse(expiresAt));
      await runtime.alarm();
      const expired = await hostStore.read("shared-do-task");
      expect(expired.outcome).toBe("found");
      expect(
        expired.outcome === "found" ? expired.record.task.status : null,
      ).toBe("expired");
      expect(await hostStore.nextExpirationAt()).toBeNull();
      expect(harness.alarmAt()).toBeNull();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("retires host-reasoning tasks with their authenticated Screen 2 run", async () => {
    const openedAt = "2026-09-03T13:00:00.000Z";
    const harness = durableObjectStateHarness();
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        ...validSigningEnv,
        NOW: () => openedAt,
      } as never,
    );
    const openedResponse = await runtime.fetch(mcpRequest({
      jsonrpc: "2.0",
      id: 114,
      method: "tools/call",
      params: {
        name: "open_shockaudit_screen_2",
        arguments: {
          studyContext: confirmedWorkflowFindContext(),
          workflowVersion: "2.1",
        },
      },
    }));
    const opened = await readMcpPayload(openedResponse) as {
      result?: { _meta?: Record<string, unknown> };
    };
    const snapshot = opened.result?._meta?.[
      "shockaudit/screen02-workflow-v021"
    ] as {
      runId: string;
      accessToken: string;
      revision: number;
      stateFingerprint: string;
    } | undefined;
    expect(snapshot).toBeDefined();
    if (!snapshot) throw new Error("Expected a private Screen 2 snapshot.");

    const hostTaskIds = Array.from(
      { length: 65 },
      (_, index) => `retired-with-parent-task-${index}`,
    );
    let hostStore: HostReasoningTaskStore | null = null;
    for (const taskId of hostTaskIds) {
      hostStore = await seedHostReasoningTask(harness.state.storage, {
        runId: snapshot.runId,
        taskId,
        createdAt: openedAt,
        expiresAt: "2026-09-03T13:05:00.000Z",
      });
    }
    expect(hostStore).not.toBeNull();
    expect((await hostStore!.read(hostTaskIds[0]!)).outcome).toBe("found");

    const retiredResponse = await runtime.fetch(mcpRequest({
      jsonrpc: "2.0",
      id: 115,
      method: "tools/call",
      params: {
        name: "retire_screen02_workflow_v021",
        arguments: {
          schemaVersion: "screen-02-workflow-retire-v1",
          runId: snapshot.runId,
          accessToken: snapshot.accessToken,
          expectedRevision: snapshot.revision,
          expectedStateFingerprint: snapshot.stateFingerprint,
        },
      },
    }));
    expect(retiredResponse.status).toBe(200);
    const retired = await readMcpPayload(retiredResponse) as {
      result?: { structuredContent?: { outcome?: string } };
    };
    expect(retired.result?.structuredContent?.outcome).toBe("retired");
    expect((await hostStore!.read(hostTaskIds[0]!)).outcome).toBe("not-found");
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("host-reasoning-") ||
        key.startsWith("screen02-workflow-pending-child-cascade-")
      ),
    ).toBe(false);
  });

  it("continues a multi-batch host-task cascade across bounded cleanup alarms", async () => {
    const openedAt = "2026-09-03T10:00:00.000Z";
    let now = openedAt;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse(openedAt),
    );
    try {
      const harness = durableObjectStateHarness();
      const runtime = new ShockAuditMcp(
        harness.state,
        {
          ...env,
          ...validSigningEnv,
          NOW: () => now,
        } as never,
      );
      const openedResponse = await runtime.fetch(mcpRequest({
        jsonrpc: "2.0",
        id: 116,
        method: "tools/call",
        params: {
          name: "open_shockaudit_screen_2",
          arguments: {
            studyContext: confirmedWorkflowFindContext(),
            workflowVersion: "2.1",
          },
        },
      }));
      const opened = await readMcpPayload(openedResponse) as {
        result?: { _meta?: Record<string, unknown> };
      };
      const snapshot = opened.result?._meta?.[
        "shockaudit/screen02-workflow-v021"
      ] as { runId: string } | undefined;
      expect(snapshot).toBeDefined();
      if (!snapshot) throw new Error("Expected a private Screen 2 snapshot.");

      const taskIds = Array.from(
        { length: 65 },
        (_, index) => `alarm-cascade-task-${index}`,
      );
      let hostStore: HostReasoningTaskStore | null = null;
      for (const taskId of taskIds) {
        hostStore = await seedHostReasoningTask(harness.state.storage, {
          runId: snapshot.runId,
          taskId,
          createdAt: openedAt,
          expiresAt: new Date(
            Date.parse(openedAt) +
              SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS +
              60 * 60 * 1_000,
          ).toISOString(),
        });
      }
      expect(hostStore).not.toBeNull();

      const parentExpiresAt =
        Date.parse(openedAt) + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS;
      now = new Date(parentExpiresAt).toISOString();
      dateNow.mockReturnValue(parentExpiresAt);
      await runtime.alarm();
      const remainingAfterFirstAlarm = (await Promise.all(
        taskIds.map((taskId) => hostStore!.read(taskId)),
      )).filter((read) => read.outcome === "found");
      expect(remainingAfterFirstAlarm).toHaveLength(1);
      expect(harness.alarmAt()).toBe(parentExpiresAt + 1_000);

      now = new Date(parentExpiresAt + 1_000).toISOString();
      dateNow.mockReturnValue(parentExpiresAt + 1_000);
      await runtime.alarm();
      expect(
        (await Promise.all(
          taskIds.map((taskId) => hostStore!.read(taskId)),
        )).every((read) => read.outcome === "not-found"),
      ).toBe(true);
      expect(
        [...harness.records.keys()].some((key) =>
          key.startsWith("host-reasoning-") ||
          key.startsWith("screen02-workflow-pending-child-cascade-")
        ),
      ).toBe(false);
      expect(harness.alarmAt()).toBeNull();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("retains and retries a child-cascade marker after a transient host retirement failure", async () => {
    const openedAt = "2026-09-03T08:00:00.000Z";
    let now = openedAt;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse(openedAt),
    );
    try {
      const harness = durableObjectStateHarness();
      const runtime = new ShockAuditMcp(
        harness.state,
        {
          ...env,
          ...validSigningEnv,
          NOW: () => now,
        } as never,
      );
      const openedResponse = await runtime.fetch(mcpRequest({
        jsonrpc: "2.0",
        id: 117,
        method: "tools/call",
        params: {
          name: "open_shockaudit_screen_2",
          arguments: {
            studyContext: confirmedWorkflowFindContext(),
            workflowVersion: "2.1",
          },
        },
      }));
      const opened = await readMcpPayload(openedResponse) as {
        result?: { _meta?: Record<string, unknown> };
      };
      const snapshot = opened.result?._meta?.[
        "shockaudit/screen02-workflow-v021"
      ] as { runId: string } | undefined;
      expect(snapshot).toBeDefined();
      if (!snapshot) throw new Error("Expected a private Screen 2 snapshot.");

      const foreignTaskId = "foreign-cascade-task";
      const foreignRunId = "foreign-cascade-run";
      const hostStore = await seedHostReasoningTask(harness.state.storage, {
        runId: foreignRunId,
        taskId: foreignTaskId,
        createdAt: openedAt,
        expiresAt: new Date(
          Date.parse(openedAt) +
            SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS +
            60 * 60 * 1_000,
        ).toISOString(),
      });
      const corruptIndexKey =
        `host-reasoning-run-v1:${snapshot.runId}:foreign-index`;
      harness.records.set(corruptIndexKey, foreignTaskId);

      const parentExpiresAt =
        Date.parse(openedAt) + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS;
      now = new Date(parentExpiresAt).toISOString();
      dateNow.mockReturnValue(parentExpiresAt);
      await runtime.alarm();
      expect(
        [...harness.records.keys()].some((key) =>
          key.startsWith(
            `screen02-workflow-pending-child-cascade-v1:${snapshot.runId}`,
          )
        ),
      ).toBe(true);
      expect(harness.alarmAt()).toBe(parentExpiresAt + 1_000);

      await hostStore.retireRun(foreignRunId);
      now = new Date(parentExpiresAt + 1_000).toISOString();
      dateNow.mockReturnValue(parentExpiresAt + 1_000);
      await runtime.alarm();
      expect(harness.records.has(corruptIndexKey)).toBe(false);
      expect(
        [...harness.records.keys()].some((key) =>
          key.startsWith(
            `screen02-workflow-pending-child-cascade-v1:${snapshot.runId}`,
          )
        ),
      ).toBe(false);
      expect(harness.alarmAt()).toBeNull();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("preserves a completed MCP response when post-response alarm scheduling is transiently unavailable", async () => {
    const harness = durableObjectStateHarness({
      setAlarmError: new Error(
        "sensitive-alarm-diagnostic-must-not-escape",
      ),
      setAlarmFailureCount: 1,
    });
    const runtime = new ShockAuditMcp(harness.state, env as never);
    const response = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 123,
        method: "tools/call",
        params: {
          name: "open_shockaudit_screen_2",
          arguments: {
            studyContext: confirmedWorkflowFindContext(),
            workflowVersion: "2.1",
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-shockaudit-mcp-retention-status")).toBe(
      "deferred",
    );
    await harness.settleWaitUntil();
    expect(harness.setAlarmCalls()).toBe(2);
    expect(harness.alarmAt()).not.toBeNull();
    const text = await response.text();
    expect(text).not.toContain("sensitive-alarm-diagnostic");
    const payload = (await readMcpPayload(
      new Response(text, {
        status: response.status,
        headers: response.headers,
      }),
    )) as { result?: { isError?: boolean } };
    expect(payload.result?.isError).not.toBe(true);
  });

  it("normalizes a trailing MCP slash to the canonical endpoint", async () => {
    const response = await callWorker(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 11,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "ShockAudit trailing-slash client",
              version: SHOCKAUDIT_VERSION,
            },
          },
        },
        "/mcp/",
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(payload.result?.serverInfo?.name).toBe("ShockAudit");
  });

  it("lists every UI-bearing tool with all exact resource links", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        tools?: Array<{
          name: string;
          _meta?: Record<string, unknown>;
          inputSchema?: { required?: string[] };
        }>;
      };
    };
    const tools = payload.result?.tools ?? [];
    for (const name of [
      "open_shockaudit_screen_1",
      "open_shockaudit_screen_2",
    ]) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool, name).toBeDefined();
      expect(tool?._meta?.["openai/outputTemplate"]).toBe(UI_RESOURCE_URI);
      expect(tool?._meta?.["ui/resourceUri"]).toBe(UI_RESOURCE_URI);
      expect(
        (tool?._meta?.ui as { resourceUri?: string } | undefined)?.resourceUri,
      ).toBe(UI_RESOURCE_URI);
    }
    const discoveryTool = tools.find(
      (candidate) => candidate.name === "discover_shock_options",
    );
    const assessmentTool = tools.find(
      (candidate) => candidate.name === "assess_shock_options",
    );
    expect(discoveryTool).toBeDefined();
    expect(assessmentTool).toBeDefined();
    expect(
      discoveryTool?._meta?.["openai/outputTemplate"],
    ).toBeUndefined();
    expect(
      discoveryTool?._meta?.["ui/resourceUri"],
    ).toBeUndefined();
    expect(
      (
        discoveryTool?._meta?.ui as
          | { resourceUri?: string; visibility?: string[] }
          | undefined
      )?.resourceUri,
    ).toBeUndefined();
    expect(
      (
        discoveryTool?._meta?.ui as
          | { resourceUri?: string; visibility?: string[] }
          | undefined
      )?.visibility,
    ).toContain("app");
    for (const dataTool of [discoveryTool, assessmentTool]) {
      expect(
        dataTool?._meta?.["openai/outputTemplate"],
      ).toBeUndefined();
      expect(dataTool?._meta?.["ui/resourceUri"]).toBeUndefined();
      expect(
        (
          dataTool?._meta?.ui as
            | { resourceUri?: string; visibility?: string[] }
            | undefined
        )?.resourceUri,
      ).toBeUndefined();
      expect(
        (
          dataTool?._meta?.ui as
            | { resourceUri?: string; visibility?: string[] }
            | undefined
        )?.visibility,
      ).toContain("app");
    }
    const confirmTool = tools.find(
      (candidate) => candidate.name === "confirm_scope_contract",
    );
    expect(confirmTool?.inputSchema?.required).not.toContain("revision");
    expect(
      JSON.stringify(tools).length,
    ).toBeLessThan(64 * 1024);
  });

  it("keeps the replacement's experimental-off 22-tool catalog under 64 KiB", async () => {
    const harness = durableObjectStateHarness();
    const runtime = new ShockAuditMcp(
      harness.state,
      {
        ...env,
        ...validSigningEnv,
        SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
      } as never,
    );
    const response = await runtime.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 206,
        method: "tools/list",
        params: {},
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        tools?: Array<{
          name: string;
          annotations?: Record<string, unknown>;
          _meta?: {
            ui?: { visibility?: string[] };
            "openai/widgetAccessible"?: boolean;
          };
          inputSchema?: {
            $schema?: string;
            properties?: Record<string, unknown>;
          };
          outputSchema?: {
            type?: string;
            properties?: Record<string, unknown>;
            required?: string[];
            additionalProperties?: boolean;
          };
        }>;
      };
    };
    const tools = payload.result?.tools ?? [];
    const screen01Output = [
      "screen",
      "ok",
      "error",
      "state",
      "ambiguities",
      "studyContext",
    ];
    const screen02Summary = [
      "schemaVersion",
      "screen",
      "ok",
      "outcome",
      "mode",
      "assessmentAvailable",
      "preparedRequestCount",
      "deliveredRequestCount",
      "completedRequestCount",
      "continuationReady",
      "message",
    ];
    const screen03Result = [
      "schemaVersion",
      "screen",
      "ok",
      "outcome",
      "message",
      "sealedState",
    ];
    const sixScreenProjection = ["schemaVersion"];
    const sixScreenOperationStatus = [
      "schemaVersion", "buildId", "appVersion", "uiResourceUri", "toolName",
      "requestFingerprint", "runId", "revision", "stateFingerprint",
      "operationReference", "operationKind", "inputFingerprint", "lookup",
      "commitCertainty", "committedRevision", "mutationOutcome",
      "completedAt", "resultFingerprint", "receiptValidated",
      "screen3Receipt", "destination", "responseFingerprint",
    ];
    const sixScreenRecoverySnapshot = [
      "schemaVersion", "buildId", "appVersion", "uiResourceUri", "toolName",
      "encoding", "runId", "revision", "stateFingerprint",
      "publicProjectionFingerprint", "canonicalStateBytes",
      "canonicalPublicProjectionBytes", "encodedStateBytes",
      "encodedPublicProjectionBytes", "encodedStatePayload",
      "encodedPublicProjectionPayload", "responseFingerprint",
    ];
    const sixScreenStateChunk = [
      "schemaVersion", "buildId", "appVersion", "uiResourceUri", "toolName",
      "transferId", "runId", "revision", "stateFingerprint",
      "encodedStateBytes", "canonicalStateBytes", "chunkIndex",
      "chunkCount", "chunkBytes", "chunkFingerprint", "encodedStateChunk",
      "responseFingerprint",
    ];
    const expectedOutputKeys: Record<string, string[]> = {
      retire_screen02_workflow_v021: [
        "schemaVersion",
        "screen",
        "ok",
        "outcome",
        "runId",
        "message",
      ],
      mutate_screen02_workflow_v021: screen02Summary,
      mutate_screen02_workflow_v024: [
        ...screen02Summary,
        "sealedSnapshot",
      ],
      open_screen03_workflow_v030: screen03Result,
      mutate_screen03_workflow_v030: screen03Result,
      get_screen3_briefing_packet: [
        "schemaVersion",
        "requiredBriefingStatus",
        "safeRunRef",
        "selectedEventId",
        "canonicalEventName",
        "aliases",
        "jurisdiction",
        "responsibleAuthority",
        "eventType",
        "eventStatus",
        "formalIdentifier",
        "eventFingerprint",
        "screen03Revision",
        "screen03StateFingerprint",
        "claims",
        "evidence",
        "unresolvedConflicts",
        "missingEvidence",
        "studyScope",
        "existingResearcherApprovals",
        "instructions",
        "outcomeValuesInspected",
        "packetId",
        "packetHash",
        "issuedAt",
        "expiresAt",
      ],
      render_screen3_briefing: [
        "schemaVersion",
        "outcome",
        "proposalId",
        "briefing",
        "sources",
        "issues",
        "message",
      ],
      confirm_screen3_briefing: [
        "schemaVersion",
        "outcome",
        "proposalId",
        "decisionId",
        "message",
      ],
      open_shockaudit_screen_1: screen01Output,
      draft_scope_contract: screen01Output,
      confirm_scope_contract: screen01Output,
      create_screen02_workflow_v024: [
        ...screen02Summary,
        "sealedSnapshot",
      ],
      create_screen02_workflow_v023: screen02Summary,
      open_shockaudit_screen_2: [
        "screen",
        "ok",
        "error",
        "sessionState",
        "sessionSummary",
        "assessmentResults",
      ],
      create_six_screen_workflow_v1: sixScreenProjection,
      get_six_screen_workflow_v1: sixScreenProjection,
      get_six_screen_operation_status_v1: sixScreenOperationStatus,
      get_six_screen_recovery_snapshot_v1: sixScreenRecoverySnapshot,
      get_six_screen_workflow_state_chunk_v2: sixScreenStateChunk,
      mutate_six_screen_workflow_v1: sixScreenProjection,
      retire_six_screen_workflow_v1: [
        "schemaVersion",
        "runId",
        "retired",
        "outcomeValuesInspected",
      ],
    };
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      Object.keys(expectedOutputKeys).sort(),
    );
    const toolBytes = Object.fromEntries(tools.map((tool) => [
      tool.name,
      new TextEncoder().encode(JSON.stringify(tool)).byteLength,
    ]));
    // Keep the host Scan Tools catalog below its established release gate.
    expect(
      new TextEncoder().encode(JSON.stringify(tools)).byteLength,
      JSON.stringify(toolBytes),
    ).toBeLessThan(64 * 1024);

    const appOnly = new Set([
      "retire_screen02_workflow_v021",
      "mutate_screen02_workflow_v021",
      "mutate_screen02_workflow_v024",
      "prepare_screen01_scope_draft_v036",
      "submit_screen01_scope_draft_v036",
      "apply_screen01_scope_draft_v036",
      "open_screen03_workflow_v030",
      "mutate_screen03_workflow_v030",
      "prepare_screen03_host_draft_v036",
      "submit_screen03_host_draft_v036",
      "get_screen3_briefing_packet",
      "render_screen3_briefing",
      "confirm_screen3_briefing",
      "create_screen02_workflow_v024",
      "create_screen02_workflow_v023",
      "create_six_screen_workflow_v1",
      "get_six_screen_operation_status_v1",
      "get_six_screen_recovery_snapshot_v1",
      "get_six_screen_workflow_state_chunk_v2",
      "get_six_screen_workflow_v1",
      "mutate_six_screen_workflow_v1",
      "retire_six_screen_workflow_v1",
    ]);
    const modelOnly = new Set<string>();
    const expectedModelInputKeys: Record<string, string[]> = {
      submit_screen01_scope_draft_v036: [
        "schemaVersion",
        "capabilityToken",
        "requestId",
        "draft",
      ],
      submit_screen03_host_draft_v036: [
        "schemaVersion",
        "capabilityToken",
        "requestId",
        "sourcePacket",
        "draft",
      ],
      get_screen3_briefing_packet: [
        "schemaVersion",
        "safeRunRef",
        "selectedEventId",
      ],
      render_screen3_briefing: [
        "schemaVersion",
        "skillVersion",
        "workflowVersion",
        "safeRunRef",
        "packetId",
        "packetHash",
        "selectedEventId",
        "content",
      ],
      open_shockaudit_screen_1: ["mode", "sentence"],
      draft_scope_contract: ["mode", "sentence"],
      confirm_scope_contract: [
        "revision",
        "mode",
        "sentence",
        "contractSourceSentence",
        "scope",
        "knownShock",
        "resolvedKeys",
        "acknowledgedDifferences",
        "scopeDirty",
      ],
      open_shockaudit_screen_2: [
        "studyContext",
        "runId",
        "workflowVersion",
      ],
    };

    for (const tool of tools) {
      expect(tool.outputSchema?.type, tool.name).toBe("object");
      if (tool.name.startsWith("create_six_screen_workflow") ||
          tool.name.startsWith("get_six_screen_workflow") ||
          tool.name.startsWith("mutate_six_screen_workflow")) {
        expect(tool.outputSchema?.additionalProperties, tool.name).toBe(false);
      } else if ([
        "get_screen3_briefing_packet",
        "render_screen3_briefing",
        "confirm_screen3_briefing",
      ].includes(tool.name)) {
        expect(tool.outputSchema?.additionalProperties, tool.name).toBe(false);
      } else if (tool.outputSchema?.additionalProperties !== undefined) {
        expect(tool.outputSchema.additionalProperties, tool.name).toBe(false);
      }
      expect(
        Object.keys(tool.outputSchema?.properties ?? {}).sort(),
        tool.name,
      ).toEqual([...expectedOutputKeys[tool.name]].sort());
      expect(Object.keys(tool.annotations ?? {}).sort(), tool.name).toEqual([
        "destructiveHint",
        "idempotentHint",
        "openWorldHint",
        "readOnlyHint",
      ]);
      expect(tool._meta?.ui?.visibility, tool.name).toEqual(
        appOnly.has(tool.name)
          ? ["app"]
          : modelOnly.has(tool.name)
            ? ["model"]
            : ["model", "app"],
      );
      if (expectedModelInputKeys[tool.name]) {
        expect(tool.inputSchema?.$schema, tool.name).toBe(
          "https://json-schema.org/draft/2020-12/schema",
        );
        expect(
          Object.keys(tool.inputSchema?.properties ?? {}).sort(),
          tool.name,
        ).toEqual([...expectedModelInputKeys[tool.name]].sort());
      }
    }

  });

  it.each([
    {
      label: "an omitted flag",
      configured: undefined,
      advertised: "experimental-off",
      appTools: false,
      modelToolCount: 0,
      historicalPacketTools: true,
      legacyDraftToolCount: 0,
      expectedToolCount: 21,
    },
    {
      label: "experimental-off",
      configured: "experimental-off",
      advertised: "experimental-off",
      appTools: false,
      modelToolCount: 0,
      historicalPacketTools: true,
      legacyDraftToolCount: 0,
      expectedToolCount: 21,
    },
    {
      label: "app-only",
      configured: "app-only",
      advertised: "app-only",
      appTools: true,
      modelToolCount: 0,
      historicalPacketTools: false,
      legacyDraftToolCount: 0,
      expectedToolCount: 24,
    },
    {
      label: "screen02-only",
      configured: "screen02-only",
      advertised: "screen02-only",
      appTools: true,
      modelToolCount: 1,
      historicalPacketTools: false,
      legacyDraftToolCount: 0,
      expectedToolCount: 25,
    },
    {
      label: "full",
      configured: "full",
      advertised: "full",
      appTools: true,
      modelToolCount: 6,
      historicalPacketTools: false,
      legacyDraftToolCount: 0,
      expectedToolCount: 30,
    },
    {
      label: "the obsolete on value",
      configured: "on",
      advertised: "experimental-off",
      appTools: false,
      modelToolCount: 0,
      historicalPacketTools: true,
      legacyDraftToolCount: 0,
      expectedToolCount: 21,
    },
  ] as const)(
    "maps $label to the exact bounded host-tool catalog and UI metadata",
    async ({
      configured,
      advertised,
      appTools,
      modelToolCount,
      historicalPacketTools,
      legacyDraftToolCount,
      expectedToolCount,
    }) => {
      const catalogPayload = await integratedMcpCall(
        "tools/list",
        {},
        configured,
      ) as {
        result?: {
          tools?: Array<{
            name: string;
            annotations?: Record<string, unknown>;
            _meta?: Record<string, unknown> & {
              ui?: { visibility?: string[] };
            };
          }>;
        };
      };
      const tools = catalogPayload.result?.tools ?? [];
      const names = tools.map((tool) => tool.name);
      const lifecycleNames: string[] = [
        PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
        GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
        RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
        RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
        CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
      ];
      const modelNames: string[] = [
        SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
        SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
        SUBMIT_SCREEN03_OVERVIEW_TOOL,
        SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
        SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
        SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL,
      ];
      const legacyDraftNames = [
        "prepare_screen01_scope_draft_v036",
        "submit_screen01_scope_draft_v036",
        "apply_screen01_scope_draft_v036",
        "prepare_screen03_host_draft_v036",
        "submit_screen03_host_draft_v036",
      ];
      const historicalPacketNames = [
        "get_screen3_briefing_packet",
        "render_screen3_briefing",
      ];
      const expectedNames = [
        "open_shockaudit_screen_1",
        "draft_scope_contract",
        "confirm_scope_contract",
        "create_screen02_workflow_v024",
        "create_screen02_workflow_v023",
        "open_shockaudit_screen_2",
        "mutate_screen02_workflow_v024",
        "mutate_screen02_workflow_v021",
        "retire_screen02_workflow_v021",
        "open_screen03_workflow_v030",
        "mutate_screen03_workflow_v030",
        "confirm_screen3_briefing",
        "create_six_screen_workflow_v1",
        "get_six_screen_operation_status_v1",
        "get_six_screen_recovery_snapshot_v1",
        "get_six_screen_workflow_state_chunk_v2",
        "get_six_screen_workflow_v1",
        "mutate_six_screen_workflow_v1",
        "retire_six_screen_workflow_v1",
        ...legacyDraftNames.slice(0, legacyDraftToolCount),
        ...(historicalPacketTools ? historicalPacketNames : []),
        ...(appTools ? lifecycleNames : []),
        ...modelNames.slice(0, modelToolCount),
      ];
      expect(names).toHaveLength(expectedToolCount);
      expect([...names].sort()).toEqual([...expectedNames].sort());

      for (const name of lifecycleNames) {
        expect(names.includes(name), name).toBe(appTools);
      }
      for (const [index, name] of modelNames.entries()) {
        expect(names.includes(name), name).toBe(index < modelToolCount);
      }
      for (const retired of [
        "submit_screen02_find_assessment_draft_v021",
        "submit_screen02_audit_draft_v021",
      ]) {
        expect(names, retired).not.toContain(retired);
      }
      for (const historical of historicalPacketNames) {
        const tool = tools.find((candidate) => candidate.name === historical);
        expect(Boolean(tool), historical).toBe(historicalPacketTools);
        if (!tool) continue;
        expect(tool?._meta?.ui?.visibility, historical).toEqual(["app"]);
        expect(tool?._meta?.["openai/widgetAccessible"], historical).toBe(true);
        expect(tool?._meta, historical).not.toHaveProperty(
          "openai/outputTemplate",
        );
        expect(tool?._meta, historical).not.toHaveProperty("ui/resourceUri");
      }

      for (const [index, legacyDraft] of legacyDraftNames.entries()) {
        expect(names.includes(legacyDraft), legacyDraft).toBe(
          index < legacyDraftToolCount,
        );
      }

      const appOnlyNames = new Set<string>(lifecycleNames);
      for (const name of [...lifecycleNames, ...modelNames]) {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) continue;
        expect(tool.annotations, name).toEqual({
          readOnlyHint: false,
          destructiveHint: name === CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
          idempotentHint: true,
          openWorldHint: false,
        });
        expect(tool._meta?.ui?.visibility, name).toEqual(
          appOnlyNames.has(name) ? ["app"] : ["model"],
        );
        expect(tool._meta, name).not.toHaveProperty("openai/outputTemplate");
        expect(tool._meta, name).not.toHaveProperty("ui/resourceUri");
      }
      const serializedToolBytes = Object.fromEntries(tools.map((tool) => [
        tool.name,
        new TextEncoder().encode(JSON.stringify(tool)).byteLength,
      ]));
      // The full host catalog retains Screen 4, while Screen 5 inference is
      // deliberately absent because the local workflow is OpenAI-only.
      expect(
        new TextEncoder().encode(JSON.stringify(tools)).byteLength,
        JSON.stringify(serializedToolBytes),
      ).toBeLessThan(80 * 1024);

      const openPayload = await integratedMcpCall(
        "tools/call",
        { name: "open_shockaudit_screen_1", arguments: {} },
        configured,
      ) as {
        result?: { _meta?: Record<string, unknown> };
      };
      expect(
        openPayload.result?._meta?.[SHOCKAUDIT_HOST_REASONING_META_KEY],
      ).toEqual({
        mode: advertised,
        enabled: advertised === "full" || advertised === "screen02-only",
        genuineTraceCount: 0,
        availableTaskTypes: advertised === "full"
          ? [...SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES]
          : advertised === "screen02-only"
            ? ["screen02-search-review"]
            : [],
      });
    },
  );

  it.each(["app-only", "screen02-only", "full"] as const)(
    "fails closed when %s host reasoning is configured without its same-DO prerequisites",
    (mode) => {
      expect(() =>
        createShockAuditServer({
          ...env,
          SHOCKAUDIT_HOST_REASONING_MODE: mode,
        } as never)
      ).toThrow(
        `SHOCKAUDIT_HOST_REASONING_MODE=${mode} requires the Screen 2, Screen 3, host-task, and signing runtimes.`,
      );
    },
  );

  it("requires the six-screen parent store before exposing full proof tools", () => {
    expect(() =>
      createShockAuditServer({
        ...env,
        ...validSigningEnv,
        SHOCKAUDIT_HOST_REASONING_MODE: "full",
        SCREEN02_WORKFLOW_STORE: {} as never,
        SCREEN03_WORKFLOW_STORE: {} as never,
        HOST_REASONING_TASK_STORE: {} as never,
      } as never)
    ).toThrow(
      "SHOCKAUDIT_HOST_REASONING_MODE=full requires the replacement six-screen workflow store for proof-task parent binding.",
    );
  });

  it("lists the current and backward-compatible UI resources", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 21,
        method: "resources/list",
        params: {},
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        resources?: Array<{
          uri?: string;
          _meta?: Record<string, unknown>;
        }>;
      };
    };
    expect(
      payload.result?.resources?.map((resource) => resource.uri),
    ).toEqual(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS);
    for (const resource of payload.result?.resources ?? []) {
      expect(resource._meta?.[SHOCKAUDIT_HOST_REASONING_META_KEY]).toEqual({
        mode: "experimental-off",
        enabled: false,
        genuineTraceCount: 0,
        availableTaskTypes: [],
      });
    }
  });

  it("returns HTML for every supported UI resource link", async () => {
    for (const [index, uri] of
      SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS.entries()) {
      const response = await callWorker(
        mcpRequest({
          jsonrpc: "2.0",
          id: 30 + index,
          method: "resources/read",
          params: { uri },
        }),
      );
      expect(response.status).toBe(200);
      const payload = (await readMcpPayload(response)) as {
        result?: {
          contents?: Array<{
            uri?: string;
            mimeType?: string;
            text?: string;
            _meta?: Record<string, unknown> & {
              ui?: {
                csp?: {
                  resourceDomains?: string[];
                };
              };
            };
          }>;
        };
      };
      expect(payload.result?.contents?.[0]?.uri).toBe(uri);
      expect(payload.result?.contents?.[0]?.mimeType).toBe(
        "text/html;profile=mcp-app",
      );
      const html = payload.result?.contents?.[0]?.text ?? "";
      if (uri === SHOCKAUDIT_UI_RESOURCE_URI) {
        expect(html).toContain('<div id="root">');
        expect(html).toContain(
          `http://localhost/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
        );
        expect(html).toContain(
          `http://localhost/assets/shockaudit-app.css?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
        );
        expect(html).toContain(
          "http://localhost/assets/shockaudit-jsx-runtime-0123abc.js",
        );
        expect(html).toContain(
          "http://localhost/assets/shockaudit-screen02-engine-0123abc.js",
        );
        expect(html).not.toContain("data-shockaudit-migration");
      } else {
        expect(html).toContain(
          'data-shockaudit-migration="legacy-resource"',
        );
        expect(html).toContain("Safe migration required");
        expect(html).toContain(`migration target v${SHOCKAUDIT_RELEASE_LABEL}`);
        expect(html).toContain(uri);
        expect(html).not.toContain('<div id="root">');
        expect(html).not.toContain("shockaudit-app.js");
        expect(html).not.toContain("shockaudit-app.css");
      }
      expect(
        payload.result?.contents?.[0]?._meta?.ui?.csp?.resourceDomains,
      ).toEqual([]);
      expect(
        payload.result?.contents?.[0]?._meta?.[
          SHOCKAUDIT_HOST_REASONING_META_KEY
        ],
      ).toEqual({
        mode: "experimental-off",
        enabled: false,
        genuineTraceCount: 0,
        availableTaskTypes: [],
      });
    }
  });

  it("keeps already-versioned workspace asset references idempotent", async () => {
    const versionedAssets = {
      fetch: async () =>
        new Response(
          '<!doctype html><html><head>' +
            `<link rel="stylesheet" href="/assets/shockaudit-app.css?v=${SHOCKAUDIT_UI_BUILD_LABEL}">` +
            '</head><body><div id="root"></div>' +
            `<script type="module" src="/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}"></script>` +
            "</body></html>",
          { headers: { "content-type": "text/html" } },
        ),
    };
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 48,
        method: "resources/read",
        params: { uri: SHOCKAUDIT_UI_RESOURCE_URI },
      }) as never,
      { ...env, ASSETS: versionedAssets } as never,
      context as never,
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: { contents?: Array<{ text?: string }> };
    };
    const html = payload.result?.contents?.[0]?.text ?? "";
    for (const assetName of ["shockaudit-app.js", "shockaudit-app.css"]) {
      const reference =
        `http://localhost/assets/${assetName}?v=${SHOCKAUDIT_UI_BUILD_LABEL}`;
      expect(html.split(reference)).toHaveLength(2);
    }
    expect(html).not.toContain(
      `?v=${SHOCKAUDIT_UI_BUILD_LABEL}?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
    );
  });

  it("binds UI assets and CSP to each MCP request origin", async () => {
    const previewOrigin = "https://stage1-preview.example";
    const response = await callWorker(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 49,
          method: "resources/read",
          params: { uri: SHOCKAUDIT_UI_RESOURCE_URI },
        },
        "/mcp",
        previewOrigin,
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        contents?: Array<{
          text?: string;
          _meta?: {
            ui?: { csp?: { resourceDomains?: string[] } };
            "openai/widgetCSP"?: { redirect_domains?: string[] };
          };
        }>;
      };
    };
    expect(payload.result?.contents?.[0]?.text).toContain(
      `${previewOrigin}/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
    );
    expect(payload.result?.contents?.[0]?.text).not.toContain(
      "https://shockaudit.ainp-research.workers.dev/assets/",
    );
    expect(
      payload.result?.contents?.[0]?._meta?.["openai/widgetCSP"]
        ?.redirect_domains,
    ).toEqual([
      "https://files.oaiusercontent.com",
      "https://usercontent.openai.com",
      "https://chatgpt.com",
      "https://www.google.com",
      "https://scholar.google.com",
      "https://en.wikipedia.org",
      "https://federalregister.gov",
      "https://www.federalregister.gov",
      "https://openstates.org",
      "https://v3.openstates.org",
      "https://govinfo.gov",
      "https://www.govinfo.gov",
      "https://ftc.gov",
      "https://www.ftc.gov",
      "https://fema.gov",
      "https://www.fema.gov",
      "https://eur-lex.europa.eu",
      "https://publications.europa.eu",
      "https://climate.ec.europa.eu",
      "https://commission.europa.eu",
      "https://digital-markets-act.ec.europa.eu",
      "https://legislation.gov.uk",
      "https://www.legislation.gov.uk",
      "https://gdacs.org",
      "https://www.gdacs.org",
      "https://earthquake.usgs.gov",
      "https://leginfo.legislature.ca.gov",
      "https://oag.ca.gov",
      "https://www.sos.ca.gov",
      "https://vig.cdn.sos.ca.gov",
      "https://www.irs.gov",
      "https://www.nhc.noaa.gov",
      "https://www.sec.gov",
    ]);
    expect(
      payload.result?.contents?.[0]?._meta?.ui?.csp?.resourceDomains,
    ).toEqual([previewOrigin]);
  });

  it("runs the Screen 1 tool and returns a nine-field draft", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "open_shockaudit_screen_1",
          arguments: { mode: "find" },
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          screen?: string;
          state?: { scope?: Record<string, string> };
          ambiguities?: unknown[];
          studyContext?: {
            startingPoint?: string;
            scopeContract?: Record<string, string>;
            unresolvedDecisions?: unknown[];
            readyForLaterScreens?: boolean;
          };
        };
      };
    };
    expect(payload.result?.structuredContent?.screen).toBe("screen-01");
    expect(
      Object.keys(payload.result?.structuredContent?.state?.scope ?? {}),
    ).toHaveLength(9);
    expect(payload.result?.structuredContent?.ambiguities).toHaveLength(0);
    expect(
      payload.result?.structuredContent?.studyContext?.startingPoint,
    ).toBe("find");
    expect(
      payload.result?.structuredContent?.studyContext?.scopeContract,
    ).toEqual(payload.result?.structuredContent?.state?.scope);
    expect(
      payload.result?.structuredContent?.studyContext?.unresolvedDecisions,
    ).toEqual(payload.result?.structuredContent?.ambiguities);
    expect(
      payload.result?.structuredContent?.studyContext?.readyForLaterScreens,
    ).toBe(false);
  });

  it("carries every confirmed Screen 1 input through the public MCP boundary", async () => {
    const sentence =
      "Audit whether the California Consumer Privacy Act changed weekly innovation among U.S. exchange-listed technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";
    const knownShock = "California Consumer Privacy Act";
    const scope = {
      population: "U.S. exchange-listed technology firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Weekly",
    };
    const resolvedKeys = [
      "population",
      "assignmentLevel",
      "analysisLevel",
      "geography",
      "industry",
      "studyPeriod",
      "eventFamily",
      "outcomeFamily",
      "outcomeFrequency",
      "knownShock",
    ];
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            revision: 42,
            mode: "audit",
            sentence,
            contractSourceSentence: sentence,
            scope,
            knownShock,
            resolvedKeys,
            scopeDirty: false,
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok?: boolean;
          state?: Record<string, unknown>;
          ambiguities?: unknown[];
          studyContext?: Record<string, unknown>;
        };
      };
    };
    const output = payload.result?.structuredContent;

    expect(output?.ok).toBe(true);
    expect(output?.ambiguities).toEqual([]);
    expect(output?.studyContext).toEqual({
      schemaVersion: "1.0",
      appVersion: SHOCKAUDIT_VERSION,
      sourceScreen: "screen-01",
      startingPoint: "audit",
      studySentence: sentence,
      contractSourceSentence: sentence,
      knownShock,
      scopeContract: scope,
      resolvedKeys,
      unresolvedDecisions: [],
      scopeDirty: false,
      confirmed: true,
      readyForLaterScreens: true,
      revision: 42,
    });
  });

  it("refuses to confirm a direct tool call with a blank field", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            mode: "find",
            sentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            contractSourceSentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            scope: {
              population: " ",
              assignmentLevel: "Firm",
              analysisLevel: "Firm",
              geography: "United States",
              industry: "Manufacturing",
              studyPeriod: "2014–2022",
              eventFamily: "Regulation",
              outcomeFamily: "Profitability",
              outcomeFrequency: "Annual",
            },
            knownShock: "",
            resolvedKeys: ["population"],
            scopeDirty: false,
          },
        },
      }),
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok?: boolean;
          state?: { confirmed?: boolean };
        };
      };
    };
    expect(payload.result?.structuredContent?.ok).toBe(false);
    expect(payload.result?.structuredContent?.state?.confirmed).toBe(false);
  });

  it("accepts public firms when geography is carried in its own field", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            mode: "find",
            sentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            contractSourceSentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            scope: {
              population: "Public firms",
              assignmentLevel: "Firm",
              analysisLevel: "Firm",
              geography: "United States",
              industry: "Manufacturing",
              studyPeriod: "2014–2022",
              eventFamily: "Regulation",
              outcomeFamily: "Profitability",
              outcomeFrequency: "Annual",
            },
            knownShock: "",
            resolvedKeys: [
              "population",
              "assignmentLevel",
              "outcomeFrequency",
            ],
            scopeDirty: false,
          },
        },
      }),
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok?: boolean;
          state?: { confirmed?: boolean };
          ambiguities?: Array<{ key?: string }>;
        };
      };
    };
    expect(payload.result?.structuredContent?.ok).toBe(true);
    expect(payload.result?.structuredContent?.state?.confirmed).toBe(true);
    expect(
      payload.result?.structuredContent?.ambiguities?.some(
        (issue) => issue.key === "population",
      ),
    ).toBe(false);
  });

  it("does not treat scopeDirty as an independent MCP confirmation blocker", async () => {
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            mode: "find",
            sentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            contractSourceSentence:
              "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
            scope: {
              population: "U.S. exchange-listed firms",
              assignmentLevel: "Firm",
              analysisLevel: "Firm",
              geography: "United States",
              industry: "Manufacturing",
              studyPeriod: "2014–2022",
              eventFamily: "Regulation",
              outcomeFamily: "Profitability",
              outcomeFrequency: "Annual",
            },
            knownShock: "",
            resolvedKeys: [
              "population",
              "assignmentLevel",
              "outcomeFrequency",
            ],
            scopeDirty: true,
          },
        },
      }),
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok?: boolean;
          error?: string;
          state?: { confirmed?: boolean };
        };
      };
    };
    expect(payload.result?.structuredContent?.ok).toBe(true);
    expect(payload.result?.structuredContent?.state?.confirmed).toBe(true);
  });

  it("confirms the exact manually aligned video-gaming scope through MCP", async () => {
    const original =
      "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm innovation.";
    const sentence = original.replace(
      "manufacturing firms",
      "video gaming firms",
    );
    const response = await callWorker(
      mcpRequest({
        jsonrpc: "2.0",
        id: 71,
        method: "tools/call",
        params: {
          name: "confirm_scope_contract",
          arguments: {
            revision: 2,
            mode: "find",
            sentence,
            contractSourceSentence: original,
            scope: {
              population: "Public firms",
              assignmentLevel: "Not specified",
              analysisLevel: "Firm",
              geography: "United States",
              industry: "Video gaming",
              studyPeriod: "2014–2022",
              eventFamily: "Regulation",
              outcomeFamily: "Innovation",
              outcomeFrequency: "Not specified",
            },
            knownShock: "",
            resolvedKeys: ["industry"],
            acknowledgedDifferences: [],
            scopeDirty: true,
          },
        },
      }),
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        structuredContent?: {
          ok?: boolean;
          state?: {
            confirmed?: boolean;
            contractSourceSentence?: string;
            scopeDirty?: boolean;
          };
          studyContext?: {
            readyForLaterScreens?: boolean;
            studySentence?: string;
            scopeContract?: { industry?: string };
          };
        };
      };
    };

    expect(payload.result?.structuredContent).toMatchObject({
      ok: true,
      state: {
        confirmed: true,
        contractSourceSentence: sentence,
        scopeDirty: false,
      },
      studyContext: {
        readyForLaterScreens: true,
        studySentence: sentence,
        scopeContract: { industry: "Video gaming" },
      },
    });
  });

  it("rejects oversized MCP request bodies before tool dispatch", async () => {
    const response = await callWorker(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          host: "localhost",
        },
        body: "x".repeat(MAX_MCP_BODY_BYTES + 1),
      }),
    );
    expect(response.status).toBe(413);
  });

  it("keeps the complete-session transport budget at 16 MiB", () => {
    expect(MAX_MCP_BODY_BYTES).toBe(16 * 1024 * 1024);
  });
});
