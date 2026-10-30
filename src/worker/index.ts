import {
  SHOCKAUDIT_PUBLIC_ORIGIN,
  SHOCKAUDIT_UI_BUILD_LABEL,
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
  STAGE1_PROOF_UI_RESOURCE_URI,
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
} from "../version";
import { MAX_MCP_BODY_BYTES } from "./mcp-limits";
import { SCREEN_02_WORKFLOW_RETENTION_PUBLIC_POLICY } from "./screen02-retention-policy";
import type { HostReasoningTaskStore } from "./host-reasoning-task-store";
import type { Screen02WorkflowStore } from "./screen02-workflow-store";
import type { Screen03WorkflowStore } from "./screen03-workflow-store";
import type { ShockAuditEnv } from "./server";
import type { SixScreenRuntimeHostReasoningMode } from
  "./six-screen-runtime-capabilities";

type ShockAuditWorkerEnv = ShockAuditEnv & {
  MCP_RUNTIME?: DurableObjectNamespace;
};

type Screen02WorkflowSigningEnvironment = Pick<
  ShockAuditEnv,
  | "SCREEN02_WORKFLOW_SIGNING_KEY_ID"
  | "SCREEN02_WORKFLOW_SIGNING_KEY"
  | "SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID"
  | "SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY"
>;

type ShockAuditRuntimeReadiness = {
  ready: boolean;
  status: "ready" | "not-ready";
  mode:
    | "integrated"
    | "stage1-preview"
    | "local-dev-in-process"
    | "invalid-stage1-preview";
  mcpRuntime:
    | "durable-object"
    | "local-dev-in-process"
    | "missing";
  /** Legacy readiness field retained for old clients; v0.3.13 makes no Workers AI calls. */
  workersAi: "not-applicable";
  reasoning: "chatgpt-host" | "not-applicable";
  assessmentSigning: "ready" | "not-ready" | "not-applicable";
  code:
    | "READY"
    | "MCP_RUNTIME_UNAVAILABLE"
    | "SCREEN02_SIGNING_UNAVAILABLE"
    | "STAGE1_PREVIEW_CONFIGURATION_REJECTED";
};

const WORKFLOW_SIGNING_KEY_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const WORKFLOW_SIGNING_KEY_MIN_BYTES = 32;
const WORKFLOW_SIGNING_KEY_MAX_BYTES = 4 * 1024;
const WORKFLOW_BOOTSTRAP_KEY_BYTES = 64;
const WORKFLOW_BOOTSTRAP_ID_BYTES = 12;
const WORKFLOW_BOOTSTRAP_RECORD_SCHEMA_VERSION =
  "screen02-workflow-do-signing-key-v1" as const;
const SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY =
  "__shockaudit-system:screen02-workflow-signing-key-v1";
const MCP_RUNTIME_OBJECT_NAME = "shockaudit-mcp-v1";
const MCP_RUNTIME_SIGNING_READINESS_PATH =
  "/__shockaudit-internal/screen02-signing-readiness-v1";
const MCP_RUNTIME_SIGNING_READINESS_HEADER =
  "x-shockaudit-internal-signing-readiness";

type Screen02WorkflowBootstrapRecord = {
  schemaVersion: typeof WORKFLOW_BOOTSTRAP_RECORD_SCHEMA_VERSION;
  keyId: string;
  key: string;
};

/**
 * Mirrors the shared constraints enforced by the Find and Audit signing
 * parsers. This lightweight check keeps /health independent of the full MCP
 * schema bundle and never returns key material or key identifiers.
 */
function workflowSigningPairReady(
  keyId: unknown,
  key: unknown,
) {
  if (
    typeof keyId !== "string" ||
    !WORKFLOW_SIGNING_KEY_ID_PATTERN.test(keyId) ||
    typeof key !== "string"
  ) {
    return false;
  }
  const keyBytes = new TextEncoder().encode(key).byteLength;
  return (
    keyBytes >= WORKFLOW_SIGNING_KEY_MIN_BYTES &&
    keyBytes <= WORKFLOW_SIGNING_KEY_MAX_BYTES
  );
}

function explicitWorkflowSigningEnvironment(
  env: ShockAuditEnv,
): Screen02WorkflowSigningEnvironment | null {
  const currentConfigured =
    env.SCREEN02_WORKFLOW_SIGNING_KEY_ID !== undefined ||
    env.SCREEN02_WORKFLOW_SIGNING_KEY !== undefined;
  const previousConfigured =
    env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID !== undefined ||
    env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY !== undefined;

  if (!currentConfigured && !previousConfigured) return null;
  if (
    !workflowSigningPairReady(
      env.SCREEN02_WORKFLOW_SIGNING_KEY_ID,
      env.SCREEN02_WORKFLOW_SIGNING_KEY,
    ) ||
    (previousConfigured &&
      !workflowSigningPairReady(
        env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID,
        env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY,
      ))
  ) {
    throw new Error("Screen 2 workflow signing configuration is invalid.");
  }

  return {
    SCREEN02_WORKFLOW_SIGNING_KEY_ID:
      env.SCREEN02_WORKFLOW_SIGNING_KEY_ID,
    SCREEN02_WORKFLOW_SIGNING_KEY:
      env.SCREEN02_WORKFLOW_SIGNING_KEY,
    ...(previousConfigured
      ? {
          SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID:
            env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID,
          SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY:
            env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY,
        }
      : {}),
  };
}

function exactRecordKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function requireWorkflowBootstrapRecord(
  value: unknown,
): Screen02WorkflowBootstrapRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !exactRecordKeys(value as Record<string, unknown>, [
      "schemaVersion",
      "keyId",
      "key",
    ])
  ) {
    throw new Error("Stored Screen 2 signing material is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== WORKFLOW_BOOTSTRAP_RECORD_SCHEMA_VERSION ||
    !workflowSigningPairReady(record.keyId, record.key)
  ) {
    throw new Error("Stored Screen 2 signing material is invalid.");
  }
  return {
    schemaVersion: WORKFLOW_BOOTSTRAP_RECORD_SCHEMA_VERSION,
    keyId: record.keyId as string,
    key: record.key as string,
  };
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function createWorkflowBootstrapRecord(): Screen02WorkflowBootstrapRecord {
  return {
    schemaVersion: WORKFLOW_BOOTSTRAP_RECORD_SCHEMA_VERSION,
    keyId: `do-bootstrap-${randomHex(WORKFLOW_BOOTSTRAP_ID_BYTES)}`,
    key: randomHex(WORKFLOW_BOOTSTRAP_KEY_BYTES),
  };
}

function signingUnavailableReadiness(): ShockAuditRuntimeReadiness {
  return {
    ready: false,
    status: "not-ready",
    mode: "integrated",
    mcpRuntime: "durable-object",
    workersAi: "not-applicable",
    reasoning: "chatgpt-host",
    assessmentSigning: "not-ready",
    code: "SCREEN02_SIGNING_UNAVAILABLE",
  };
}

function runtimeObject(env: ShockAuditWorkerEnv) {
  if (!env.MCP_RUNTIME) return null;
  const objectId = env.MCP_RUNTIME.idFromName(MCP_RUNTIME_OBJECT_NAME);
  return env.MCP_RUNTIME.get(objectId);
}

async function durableObjectSigningReady(env: ShockAuditWorkerEnv) {
  const object = runtimeObject(env);
  if (!object) return false;
  try {
    const response = await object.fetch(
      new Request(
        `https://shockaudit.internal${MCP_RUNTIME_SIGNING_READINESS_PATH}`,
        { method: "POST" },
      ),
    );
    return (
      response.status === 204 &&
      response.headers.get(MCP_RUNTIME_SIGNING_READINESS_HEADER) === "ready"
    );
  } catch {
    return false;
  }
}

function runtimeReadiness(
  request: Request,
  env: ShockAuditWorkerEnv,
): ShockAuditRuntimeReadiness {
  const requestOrigin = new URL(request.url).origin;
  const stableProductionOrigin = requestOrigin === SHOCKAUDIT_PUBLIC_ORIGIN;
  const stage1PreviewRequested = env.STAGE1_PREVIEW_ONLY === "true";
  const stage1PreviewAuthorized =
    env.SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT === "true" &&
    !stableProductionOrigin;
  const localInProcessAuthorized =
    env.SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP === "true" &&
    !stableProductionOrigin;

  const mcpRuntime = env.MCP_RUNTIME
    ? "durable-object"
    : localInProcessAuthorized
      ? "local-dev-in-process"
      : "missing";

  if (stage1PreviewRequested && !stage1PreviewAuthorized) {
    return {
      ready: false,
      status: "not-ready",
      mode: "invalid-stage1-preview",
      mcpRuntime,
      workersAi: "not-applicable",
      reasoning: "not-applicable",
      assessmentSigning: "not-applicable",
      code: "STAGE1_PREVIEW_CONFIGURATION_REJECTED",
    };
  }

  if (mcpRuntime === "missing") {
    return {
      ready: false,
      status: "not-ready",
      mode: stage1PreviewRequested ? "stage1-preview" : "integrated",
      mcpRuntime,
      workersAi: "not-applicable",
      reasoning: stage1PreviewRequested
        ? "not-applicable"
        : "chatgpt-host",
      assessmentSigning: stage1PreviewRequested
        ? "not-applicable"
        : "not-ready",
      code: "MCP_RUNTIME_UNAVAILABLE",
    };
  }

  if (stage1PreviewRequested) {
    return {
      ready: true,
      status: "ready",
      mode: "stage1-preview",
      mcpRuntime,
      workersAi: "not-applicable",
      reasoning: "not-applicable",
      assessmentSigning: "not-applicable",
      code: "READY",
    };
  }

  if (mcpRuntime === "local-dev-in-process") {
    return {
      ready: true,
      status: "ready",
      mode: "local-dev-in-process",
      mcpRuntime,
      workersAi: "not-applicable",
      reasoning: "not-applicable",
      assessmentSigning: "not-applicable",
      code: "READY",
    };
  }

  // Integrated signing readiness is resolved inside the single global
  // Durable Object. That object either validates explicit deployment keys or
  // atomically loads/creates its private persistent bootstrap key. Public
  // /health probes that boundary before returning this provisional status.
  return {
    ready: true,
    status: "ready",
    mode: "integrated",
    mcpRuntime,
    workersAi: "not-applicable",
    reasoning: "chatgpt-host",
    assessmentSigning: "ready",
    code: "READY",
  };
}

function publicReadiness(readiness: ShockAuditRuntimeReadiness) {
  return {
    status: readiness.status,
    mode: readiness.mode,
    mcpRuntime: readiness.mcpRuntime,
    workersAi: readiness.workersAi,
    reasoning: readiness.reasoning,
    assessmentSigning: readiness.assessmentSigning,
    code: readiness.code,
  };
}

function configuredSourceSecretPresence(
  env: ShockAuditWorkerEnv,
  secretNames: readonly string[],
) {
  return Object.fromEntries(
    secretNames.map((name) => [
      name,
      typeof (env as Record<string, unknown>)[name] === "string" &&
        ((env as Record<string, unknown>)[name] as string).length > 0,
    ]),
  );
}

async function publicRuntimeCapabilities(
  env: ShockAuditWorkerEnv,
  probeLiveSources = false,
) {
  const [
    { buildSixScreenRuntimeCapabilityReport },
    { SIX_SCREEN_SECRET_NAMES },
  ] = await Promise.all([
    import("./six-screen-runtime-capabilities"),
    import("./six-screen-source-register"),
  ]);
  const configuredSecrets = configuredSourceSecretPresence(
    env,
    SIX_SCREEN_SECRET_NAMES,
  );
  const probes = probeLiveSources
    ? await (async () => {
      const [
        { probeConfiguredSixScreenSources },
        { screen02ProductionPeerBoundFetch },
      ] = await Promise.all([
        import("./six-screen-source-capability-probes"),
        import("./screen02-secure-transport"),
      ]);
      return probeConfiguredSixScreenSources({
        fetch: env.CONNECTOR_FETCH ?? screen02ProductionPeerBoundFetch,
        now: () => new Date().toISOString(),
        secrets: {
          govInfoApiKey: env.GOVINFO_API_KEY,
          congressApiKey: env.CONGRESS_API_KEY,
          regulationsApiKey: env.REGULATIONS_API_KEY,
          openStatesApiKey: env.OPENSTATES_API_KEY,
          openAlexApiKey: env.OPENALEX_API_KEY,
        },
        includeCrossref: false,
      });
    })()
    : undefined;
  return buildSixScreenRuntimeCapabilityReport({
    configuredSecrets,
    probes,
    hostReasoningMode: env.SHOCKAUDIT_HOST_REASONING_MODE as
      | SixScreenRuntimeHostReasoningMode
      | undefined,
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const MCP_RUNTIME_FAILURE_PHASE_HEADER =
  "x-shockaudit-mcp-failure-phase" as const;
const MCP_RUNTIME_RETENTION_STATUS_HEADER =
  "x-shockaudit-mcp-retention-status" as const;

type McpRuntimeFailurePhase =
  | "durable-object-fetch"
  | "retention-cleanup"
  | "handler-dispatch"
  | "response-finalization"
  | "retention-scheduling";

function reportMcpRuntimeFailure(phase: McpRuntimeFailurePhase) {
  // Keep this diagnostic deliberately finite and free of exception text: a
  // storage, transport, or provider error can contain deployment internals.
  console.error(
    JSON.stringify({
      message: "ShockAudit MCP runtime phase failed.",
      phase,
    }),
  );
}

function mcpRuntimeFailureResponse(phase: McpRuntimeFailurePhase) {
  reportMcpRuntimeFailure(phase);
  const response = json(
    {
      ok: false,
      ready: false,
      service: "ShockAudit",
      version: SHOCKAUDIT_VERSION,
      code: "MCP_RUNTIME_REQUEST_FAILED",
      phase,
      error:
        "ShockAudit could not complete this MCP request. Replay the same idempotent operation before attempting a different mutation.",
    },
    503,
  );
  response.headers.set(MCP_RUNTIME_FAILURE_PHASE_HEADER, phase);
  return response;
}

async function serveStaticAsset(
  request: Request,
  env: ShockAuditEnv,
) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isStableWorkspaceAsset =
    pathname === "/assets/shockaudit-app.js" ||
    pathname === "/assets/shockaudit-app.css";
  const requestedVersions = url.searchParams.getAll("v");
  if (
    isStableWorkspaceAsset &&
    requestedVersions.length > 0 &&
    (requestedVersions.length !== 1 ||
      requestedVersions[0] !== SHOCKAUDIT_UI_BUILD_LABEL)
  ) {
    return new Response(
      "This saved ShockAudit UI asset version is retired. Refresh the app to load the safe workspace migration screen.",
      {
        status: 410,
        headers: {
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
          "cross-origin-resource-policy": "cross-origin",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  if (pathname.startsWith("/assets/")) {
    const contentType = headers.get("content-type") ?? "";
    if (!response.ok || contentType.includes("text/html")) {
      return new Response("Asset not found.", {
        status: 404,
        headers: {
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
          "cross-origin-resource-policy": "cross-origin",
          "x-content-type-options": "nosniff",
        },
      });
    }
    headers.set("cache-control", "no-store");
  }
  headers.set("access-control-allow-origin", "*");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function boundMcpRequest(request: Request) {
  if (!request.body) return request;

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_MCP_BODY_BYTES) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MCP_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request, { body });
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactPublicOutputPropertySchema(value: unknown) {
  if (!isJsonRecord(value)) return {};

  const compact: Record<string, unknown> = {};
  for (const key of ["type", "const", "enum"] as const) {
    if (value[key] !== undefined) compact[key] = value[key];
  }
  if (Object.keys(compact).length > 0) return compact;

  for (const key of ["anyOf", "oneOf"] as const) {
    if (Array.isArray(value[key])) {
      compact[key] = value[key].map(compactPublicOutputPropertySchema);
      break;
    }
  }
  return compact;
}

function compactStrictPublicSchema(
  value: unknown,
  preservePatterns = false,
): unknown {
  if (!isJsonRecord(value)) return {};

  if (typeof value.$ref === "string") {
    return { $ref: value.$ref };
  }

  const compact: Record<string, unknown> = {};
  const scalarKeys = preservePatterns
    ? ["$schema", "type", "const", "enum", "pattern"] as const
    : ["type", "const", "enum"] as const;
  for (const key of scalarKeys) {
    if (value[key] !== undefined) compact[key] = value[key];
  }
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(value[key])) {
      compact[key] = value[key].map((item) =>
        compactStrictPublicSchema(item, preservePatterns)
      );
    }
  }
  if (isJsonRecord(value.properties)) {
    compact.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, property]) => [
        key,
        compactStrictPublicSchema(property, preservePatterns),
      ]),
    );
    if (Array.isArray(value.required)) {
      compact.required = [...value.required];
    }
    compact.additionalProperties = false;
  }
  if (value.items !== undefined) {
    compact.items = compactStrictPublicSchema(
      value.items,
      preservePatterns,
    );
  }
  if (isJsonRecord(value.$defs)) {
    compact.$defs = Object.fromEntries(
      Object.entries(value.$defs).map(([key, definition]) => [
        key,
        compactStrictPublicSchema(definition, preservePatterns),
      ]),
    );
  }
  return compact;
}

/**
 * The registered Zod output schemas remain the runtime validation boundary.
 * Most legacy `tools/list` entries need only the exact top-level
 * structured-content contract for client discovery; repeating every nested
 * result constraint exceeded the host's finite catalog budget. The new Screen
 * 3 evidence packet is different: ChatGPT must be able to reason over its
 * declared nested fields, so its public projection keeps a recursively strict
 * structural schema while dropping only redundant validation bounds.
 */
function compactPublicOutputSchema(value: unknown) {
  if (
    !isJsonRecord(value) ||
    value.type !== "object" ||
    !isJsonRecord(value.properties)
  ) {
    return value;
  }

  const properties = Object.fromEntries(
    Object.entries(value.properties).map(([key, property]) => [
      key,
      compactPublicOutputPropertySchema(property),
    ]),
  );
  return {
    type: "object",
    properties,
    ...(Array.isArray(value.required)
      ? { required: [...value.required] }
      : {}),
    additionalProperties: false,
  };
}

function compactToolsListPayload(value: unknown) {
  if (!isJsonRecord(value) || !isJsonRecord(value.result)) return null;
  const tools = value.result.tools;
  if (!Array.isArray(tools)) return null;
  const compactAppInputTools = new Set([
    "prepare_screen01_scope_draft_v036",
    "apply_screen01_scope_draft_v036",
    "mutate_screen02_workflow_v021",
    "mutate_screen02_workflow_v024",
    "create_screen02_workflow_v023",
    "create_screen02_workflow_v024",
    "mutate_screen03_workflow_v030",
    "create_six_screen_workflow_v1",
    "get_six_screen_workflow_v1",
    "get_six_screen_operation_status_v1",
    "get_six_screen_recovery_snapshot_v1",
    "mutate_six_screen_workflow_v1",
    "retire_six_screen_workflow_v1",
  ]);

  return {
    ...value,
    result: {
      ...value.result,
      tools: tools.map((tool) =>
        isJsonRecord(tool)
          ? {
              ...tool,
              // These app-only tools receive code-owned payloads. Preserve
              // their complete recursive structure, enums, literals,
              // requiredness, patterns, and closed-object boundaries while
              // omitting duplicate UI-irrelevant length/range metadata. The
              // registered Zod schemas remain the validation boundary.
              ...(typeof tool.name === "string" &&
                  compactAppInputTools.has(tool.name)
                ? {
                    inputSchema: compactStrictPublicSchema(
                      tool.inputSchema,
                      true,
                    ),
                  }
                : {}),
              outputSchema:
                tool.name === "get_screen3_briefing_packet"
                  ? compactStrictPublicSchema(tool.outputSchema)
                  : compactPublicOutputSchema(tool.outputSchema),
            }
          : tool,
      ),
    },
  };
}

async function isToolsListRequest(request: Request) {
  try {
    const value: unknown = await request.clone().json();
    return isJsonRecord(value) && value.method === "tools/list";
  } catch {
    return false;
  }
}

async function compactToolsListResponse(response: Response) {
  if (!response.ok) return response;

  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.clone().text();
  let projectedText: string | null = null;

  if (contentType.includes("text/event-stream")) {
    let changed = false;
    const lines = responseText.split("\n").map((line) => {
      const match = /^(data:\s?)(.*)$/.exec(line);
      if (!match) return line;
      try {
        const projected = compactToolsListPayload(JSON.parse(match[2]));
        if (!projected) return line;
        changed = true;
        return `${match[1]}${JSON.stringify(projected)}`;
      } catch {
        return line;
      }
    });
    if (changed) projectedText = lines.join("\n");
  } else if (contentType.includes("application/json")) {
    try {
      const projected = compactToolsListPayload(JSON.parse(responseText));
      if (projected) projectedText = JSON.stringify(projected);
    } catch {
      // Preserve the original MCP response when its framing is not JSON.
    }
  }

  if (projectedText === null) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(projectedText, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function runMcpRequest(
  request: Request,
  transportEnv: ShockAuditEnv,
  context: ExecutionContext,
  serverEnv: ShockAuditEnv = transportEnv,
) {
  const boundedRequest = await boundMcpRequest(request);
  if (!boundedRequest) {
    return json(
      {
        error: "MCP request body exceeds the 16 MiB application limit.",
      },
      413,
    );
  }
  // Keep the public router's isolate small: schema libraries and the complete
  // MCP server load only when the Durable Object executes an MCP request.
  const [{ createMcpHandler }, { createShockAuditServer }] =
    await Promise.all([
      import("agents/mcp/server"),
      import("./server"),
    ]);
  const publicOrigin = new URL(boundedRequest.url).origin;
  const endpointHostname = new URL(publicOrigin).hostname;
  const toolsListRequest = await isToolsListRequest(boundedRequest);
  const response = await createMcpHandler(
    () => createShockAuditServer(serverEnv, publicOrigin),
    {
      route: "/mcp",
      legacy: "stateless",
      responseMode: "auto",
      // ChatGPT includes its browser Origin while scanning a developer-mode
      // MCP connection. Preserve the handler's endpoint/local development
      // origins while allowing only ChatGPT's documented web host—never a
      // wildcard—to pass that required DNS-rebinding protection.
      allowedOriginHostnames: [
        endpointHostname,
        "chatgpt.com",
        "localhost",
        "127.0.0.1",
        "[::1]",
      ],
    },
  )(boundedRequest, transportEnv, context);
  return toolsListRequest
    ? compactToolsListResponse(response)
    : response;
}

/**
 * The public Worker remains a lightweight router. All MCP schema handling and
 * Screen 2 computation runs inside this free SQLite-backed Durable Object,
 * whose CPU budget is appropriate for the growing multi-screen workflow.
 */
export class ShockAuditMcp {
  private bootstrapSigningPromise:
    | Promise<Screen02WorkflowSigningEnvironment>
    | null = null;
  private readonly screen02WorkflowMutationCoordinator: NonNullable<
    ShockAuditEnv["SCREEN02_WORKFLOW_MUTATION_COORDINATOR"]
  > = {
    inFlightMutations: new Map(),
    mutationTails: new Map(),
  };

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: ShockAuditEnv,
  ) {}

  private async bootstrapSigningEnvironment() {
    const record = await this.state.storage.transaction(
      async (transaction) => {
        const existing = await transaction.get(
          SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY,
        );
        if (existing !== undefined) {
          return requireWorkflowBootstrapRecord(existing);
        }
        const created = createWorkflowBootstrapRecord();
        await transaction.put(
          SCREEN02_WORKFLOW_BOOTSTRAP_STORAGE_KEY,
          created,
        );
        return created;
      },
    );
    return {
      SCREEN02_WORKFLOW_SIGNING_KEY_ID: record.keyId,
      SCREEN02_WORKFLOW_SIGNING_KEY: record.key,
    } satisfies Screen02WorkflowSigningEnvironment;
  }

  private workflowSigningEnvironment() {
    if (this.env.STAGE1_PREVIEW_ONLY === "true") {
      return Promise.resolve({});
    }
    const explicit = explicitWorkflowSigningEnvironment(this.env);
    if (explicit) return Promise.resolve(explicit);
    if (!this.bootstrapSigningPromise) {
      this.bootstrapSigningPromise =
        this.bootstrapSigningEnvironment().catch((error) => {
          this.bootstrapSigningPromise = null;
          throw error;
        });
    }
    return this.bootstrapSigningPromise;
  }

  private async internalSigningReadiness() {
    try {
      await this.workflowSigningEnvironment();
      return new Response(null, {
        status: 204,
        headers: {
          "cache-control": "no-store",
          [MCP_RUNTIME_SIGNING_READINESS_HEADER]: "ready",
        },
      });
    } catch {
      return new Response(null, {
        status: 503,
        headers: {
          "cache-control": "no-store",
          [MCP_RUNTIME_SIGNING_READINESS_HEADER]: "not-ready",
        },
      });
    }
  }

  private retentionNow() {
    return this.env.NOW?.() ?? new Date().toISOString();
  }

  private async drainPendingChildCascades(
    screen02Store: Screen02WorkflowStore,
    screen03Store: Screen03WorkflowStore,
    hostReasoningTaskStore: HostReasoningTaskStore,
  ) {
    // Bound each pass to four parent runs and one 64-row host-task batch per
    // run. Remaining markers keep the retry epoch indexed for a later alarm.
    const pending = await screen02Store.listPendingChildCascades?.(4);
    if (!pending || !screen02Store.acknowledgePendingChildCascade) return;
    for (const runId of pending.runIds) {
      try {
        const pendingRead = await screen02Store.readPendingChildCascade?.(runId);
        if (pendingRead?.outcome === "not-found") continue;
        const cascade = pendingRead?.outcome === "found"
          ? pendingRead.cascade
          : {
              kind: "parent-retired" as const,
              runId,
              originatingTaskId: null,
            };
        await screen03Store.retire(runId);
        const hostRetirement = cascade.kind === "parent-retired"
          ? await hostReasoningTaskStore.retireRun(runId)
          : await hostReasoningTaskStore.retireRunTaskTypes(runId, [
              "screen03-evidence-mapping",
              "screen03-overview-improvement",
            ]);
        if (!hostRetirement.batchLimitReached) {
          await screen02Store.acknowledgePendingChildCascade(runId, cascade);
        }
      } catch {
        // The durable marker remains indexed at the retry epoch. Continue
        // other bounded cascades and let the next request or alarm retry this
        // exact run without losing the already-deleted parent coordinate.
        reportMcpRuntimeFailure("retention-cleanup");
      }
    }
  }

  private async scheduleCleanup(nextExpirationAt: string | null) {
    if (!nextExpirationAt) {
      await this.state.storage.deleteAlarm();
      return;
    }
    const requested = Date.parse(nextExpirationAt);
    const alarmAt = Math.max(Date.now() + 1_000, requested);
    await this.state.storage.setAlarm(alarmAt);
  }

  async fetch(request: Request) {
    if (
      new URL(request.url).pathname ===
      MCP_RUNTIME_SIGNING_READINESS_PATH
    ) {
      return this.internalSigningReadiness();
    }
    const context = {
      waitUntil: (promise: Promise<unknown>) =>
        this.state.waitUntil(promise),
      passThroughOnException: () => undefined,
    } as ExecutionContext;
    let signingEnvironment: Screen02WorkflowSigningEnvironment;
    try {
      signingEnvironment = await this.workflowSigningEnvironment();
    } catch {
      const readiness = signingUnavailableReadiness();
      return json(
        {
          ok: false,
          ready: false,
          service: "ShockAudit",
          version: SHOCKAUDIT_VERSION,
          error:
            "ShockAudit's Screen 2 assessment signing configuration is unavailable.",
          readiness: publicReadiness(readiness),
        },
        503,
      );
    }
    const [
      { DurableObjectScreen02WorkflowStore },
      { Screen02FindContinuationStore },
      { DurableObjectScreen03WorkflowStore },
      { HostReasoningTaskStore },
      { SixScreenWorkflowStore },
      { SixScreenResearchTaskStore },
      { SixScreenEvidenceStore },
      { Screen5OpenAILedgerStore },
      { Screen4AssessmentStore },
    ] = await Promise.all([
      import("./screen02-workflow-store"),
      import("./screen02-find-continuation-store"),
      import("./screen03-workflow-store"),
      import("./host-reasoning-task-store"),
      import("./six-screen-workflow-store"),
      import("./six-screen-research-task-store"),
      import("./six-screen-evidence-store"),
      import("./screen5-openai-ledger"),
      import("./screen4-assessment-store"),
    ]);
    const store = new DurableObjectScreen02WorkflowStore(
      this.state.storage,
    );
    const screen03Store = new DurableObjectScreen03WorkflowStore(
      this.state.storage,
    );
    const screen02FindContinuationStore = new Screen02FindContinuationStore(
      this.state.storage,
      { enforceParentGuard: true },
    );
    const hostReasoningTaskStore = new HostReasoningTaskStore(
      this.state.storage,
      { enforceParentGuard: true },
    );
    const sixScreenWorkflowStore = new SixScreenWorkflowStore(
      this.state.storage,
    );
    const sixScreenResearchTaskStore = new SixScreenResearchTaskStore(
      this.state.storage,
    );
    const sixScreenEvidenceStore = new SixScreenEvidenceStore(
      this.state.storage,
    );
    const screen5OpenAILedgerStore = new Screen5OpenAILedgerStore(
      this.state.storage,
    );
    const screen4AssessmentStore = new Screen4AssessmentStore(
      this.state.storage,
    );
    try {
      const retentionNow = this.retentionNow();
      // All stores share this Durable Object backend. Keep their bounded
      // cleanup transactions sequential instead of making them compete inside
      // the same request.
      await store.cleanupExpired(retentionNow);
      await this.drainPendingChildCascades(
        store,
        screen03Store,
        hostReasoningTaskStore,
      );
      await screen02FindContinuationStore.cleanupExpired(retentionNow);
      await screen03Store.cleanupExpired(retentionNow);
      await hostReasoningTaskStore.cleanupExpired(retentionNow);
      await sixScreenWorkflowStore.cleanupExpired(retentionNow);
      await sixScreenResearchTaskStore.cleanupExpired(retentionNow);
      await sixScreenEvidenceStore.cleanupExpired(retentionNow);
      await screen4AssessmentStore.cleanupExpired(retentionNow);
    } catch {
      return mcpRuntimeFailureResponse("retention-cleanup");
    }
    let response: Response;
    try {
      response = await runMcpRequest(
        request,
        this.env,
        context,
        {
          ...this.env,
          SCREEN02_WORKFLOW_STORE: store,
          SCREEN02_FIND_CONTINUATION_STORE:
            screen02FindContinuationStore,
          SCREEN03_WORKFLOW_STORE: screen03Store,
          HOST_REASONING_TASK_STORE: hostReasoningTaskStore,
          SIX_SCREEN_WORKFLOW_STORE: sixScreenWorkflowStore,
          SIX_SCREEN_RESEARCH_TASK_STORE: sixScreenResearchTaskStore,
          SIX_SCREEN_EVIDENCE_STORE: sixScreenEvidenceStore,
          SCREEN4_ASSESSMENT_STORE: screen4AssessmentStore,
          SCREEN5_OPENAI_LEDGER_STORE: screen5OpenAILedgerStore,
          SCREEN02_WORKFLOW_MUTATION_COORDINATOR:
            this.screen02WorkflowMutationCoordinator,
          ...signingEnvironment,
        },
      );
    } catch {
      return mcpRuntimeFailureResponse("handler-dispatch");
    }
    let body: ArrayBuffer;
    try {
      // The stateless MCP handler may finish a tool call while its finite SSE
      // response body is being consumed. Finalize that body before reading the
      // expiry index; otherwise a newly created record can miss its alarm.
      body = await response.arrayBuffer();
    } catch {
      return mcpRuntimeFailureResponse("response-finalization");
    }
    let retentionSchedulingDeferred = false;
    try {
      const expirations = await Promise.all([
        store.nextExpirationAt(),
        screen02FindContinuationStore.nextExpirationAt(),
        screen03Store.nextExpirationAt(),
        hostReasoningTaskStore.nextExpirationAt(),
        sixScreenWorkflowStore.nextExpirationAt(),
        sixScreenResearchTaskStore.nextExpirationAt(),
        sixScreenEvidenceStore.nextExpirationAt(),
        screen4AssessmentStore.nextExpirationAt(),
      ]);
      await this.scheduleCleanup(
        expirations
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null,
      );
    } catch {
      // The canonical mutation and its finite response are already complete.
      // Preserve that result: the persistent expiry index remains available
      // for the next request or alarm to retry instead of replacing a valid
      // tool response with an unhandled Worker exception.
      retentionSchedulingDeferred = true;
      reportMcpRuntimeFailure("retention-scheduling");
      try {
        this.state.waitUntil(
          (async () => {
            try {
              const expirations = await Promise.all([
                store.nextExpirationAt(),
                screen02FindContinuationStore.nextExpirationAt(),
                screen03Store.nextExpirationAt(),
                hostReasoningTaskStore.nextExpirationAt(),
                sixScreenWorkflowStore.nextExpirationAt(),
                sixScreenResearchTaskStore.nextExpirationAt(),
                sixScreenEvidenceStore.nextExpirationAt(),
                screen4AssessmentStore.nextExpirationAt(),
              ]);
              await this.scheduleCleanup(
                expirations
                  .filter((value): value is string => Boolean(value))
                  .sort()[0] ?? null,
              );
            } catch {
              // This is the single bounded best-effort retry. Keep its failure
              // observable through the same finite phase without allowing a
              // background rejection or provider/storage detail to escape.
              reportMcpRuntimeFailure("retention-scheduling");
            }
          })(),
        );
      } catch {
        reportMcpRuntimeFailure("retention-scheduling");
      }
    }
    const headers = new Headers(response.headers);
    if (retentionSchedulingDeferred) {
      headers.set(MCP_RUNTIME_RETENTION_STATUS_HEADER, "deferred");
    }
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  async alarm() {
    const [
      { DurableObjectScreen02WorkflowStore },
      { Screen02FindContinuationStore },
      { DurableObjectScreen03WorkflowStore },
      { HostReasoningTaskStore },
      { SixScreenWorkflowStore },
      { SixScreenResearchTaskStore },
      { SixScreenEvidenceStore },
      { Screen4AssessmentStore },
    ] = await Promise.all([
      import("./screen02-workflow-store"),
      import("./screen02-find-continuation-store"),
      import("./screen03-workflow-store"),
      import("./host-reasoning-task-store"),
      import("./six-screen-workflow-store"),
      import("./six-screen-research-task-store"),
      import("./six-screen-evidence-store"),
      import("./screen4-assessment-store"),
    ]);
    const store = new DurableObjectScreen02WorkflowStore(
      this.state.storage,
    );
    const screen03Store = new DurableObjectScreen03WorkflowStore(
      this.state.storage,
    );
    const screen02FindContinuationStore = new Screen02FindContinuationStore(
      this.state.storage,
      { enforceParentGuard: true },
    );
    const hostReasoningTaskStore = new HostReasoningTaskStore(
      this.state.storage,
      { enforceParentGuard: true },
    );
    const sixScreenWorkflowStore = new SixScreenWorkflowStore(
      this.state.storage,
    );
    const sixScreenResearchTaskStore = new SixScreenResearchTaskStore(
      this.state.storage,
    );
    const sixScreenEvidenceStore = new SixScreenEvidenceStore(
      this.state.storage,
    );
    const screen4AssessmentStore = new Screen4AssessmentStore(
      this.state.storage,
    );
    const retentionNow = this.retentionNow();
    await store.cleanupExpired(retentionNow);
    await this.drainPendingChildCascades(
      store,
      screen03Store,
      hostReasoningTaskStore,
    );
    await screen02FindContinuationStore.cleanupExpired(retentionNow);
    await screen03Store.cleanupExpired(retentionNow);
    await hostReasoningTaskStore.cleanupExpired(retentionNow);
    await sixScreenWorkflowStore.cleanupExpired(retentionNow);
    await sixScreenResearchTaskStore.cleanupExpired(retentionNow);
    await sixScreenEvidenceStore.cleanupExpired(retentionNow);
    await screen4AssessmentStore.cleanupExpired(retentionNow);
    const expirations = await Promise.all([
      store.nextExpirationAt(),
      screen02FindContinuationStore.nextExpirationAt(),
      screen03Store.nextExpirationAt(),
      hostReasoningTaskStore.nextExpirationAt(),
      sixScreenWorkflowStore.nextExpirationAt(),
      sixScreenResearchTaskStore.nextExpirationAt(),
      sixScreenEvidenceStore.nextExpirationAt(),
      screen4AssessmentStore.nextExpirationAt(),
    ]);
    await this.scheduleCleanup(
      expirations
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null,
    );
  }
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const readiness = runtimeReadiness(request, env);

    if (readiness.mode === "invalid-stage1-preview") {
      return json(
        {
          ok: false,
          ready: false,
          service: "ShockAudit",
          version: SHOCKAUDIT_VERSION,
          error:
            "Stage 1 preview mode is not authorized for this deployment.",
          readiness: publicReadiness(readiness),
        },
        503,
      );
    }

    // The local Secure MCP Tunnel probes RFC 9728 protected-resource
    // metadata before it forwards MCP traffic. ShockAudit intentionally has
    // no OAuth metadata, so return a real 404 instead of the SPA fallback's
    // index.html response. tunnel-client treats all-candidate 404s as the
    // expected no-auth MCP case.
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      return json({ error: "not_found" }, 404);
    }

    if (url.pathname === "/health") {
      const stage1PreviewOnly = readiness.mode === "stage1-preview";
      const effectiveReadiness =
        readiness.ready &&
        readiness.mode === "integrated" &&
        readiness.mcpRuntime === "durable-object" &&
        !(await durableObjectSigningReady(env))
          ? signingUnavailableReadiness()
          : readiness;
      return json(
        {
          ok: effectiveReadiness.ready,
          ready: effectiveReadiness.ready,
          service: "ShockAudit",
          version: SHOCKAUDIT_VERSION,
          ...(typeof env.SHOCKAUDIT_LOCAL_LAUNCH_ID === "string" &&
              /^[a-f0-9]{32}$/u.test(env.SHOCKAUDIT_LOCAL_LAUNCH_ID) &&
              typeof env.SHOCKAUDIT_LOCAL_CONFIG_ID === "string" &&
              /^sha256:[a-f0-9]{64}$/u.test(env.SHOCKAUDIT_LOCAL_CONFIG_ID)
            ? {
                localLaunchId: env.SHOCKAUDIT_LOCAL_LAUNCH_ID,
                localConfigId: env.SHOCKAUDIT_LOCAL_CONFIG_ID,
              }
            : {}),
          readiness: publicReadiness(effectiveReadiness),
          retention: SCREEN_02_WORKFLOW_RETENTION_PUBLIC_POLICY,
          ...(stage1PreviewOnly
            ? {}
            : {
              capabilities: await publicRuntimeCapabilities(
                env,
                url.searchParams.get("source-probe") === "live",
              ),
            }),
          ...(stage1PreviewOnly
            ? {
                mode: "stage1-preview",
                uiResourceUri: STAGE1_PROOF_UI_RESOURCE_URI,
                supportedUiResourceUris: [STAGE1_PROOF_UI_RESOURCE_URI],
              }
            : {
                uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
                supportedUiResourceUris:
                  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
              }),
        },
        effectiveReadiness.ready ? 200 : 503,
      );
    }

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      if (!readiness.ready) {
        const error =
          readiness.code === "MCP_RUNTIME_UNAVAILABLE"
            ? "ShockAudit's Durable Object MCP runtime is unavailable."
            : "ShockAudit's signed ChatGPT-host task configuration is unavailable.";
        return json(
          {
            ok: false,
            ready: false,
            service: "ShockAudit",
            version: SHOCKAUDIT_VERSION,
            error,
            readiness: publicReadiness(readiness),
          },
          503,
        );
      }
      const handlerUrl = new URL(url);
      handlerUrl.pathname = "/mcp";
      const handlerRequest =
        url.pathname === "/mcp"
          ? request
          : new Request(handlerUrl, request);
      try {
        const object = runtimeObject(env);
        if (object) {
          return await object.fetch(handlerRequest);
        }
      } catch {
        return mcpRuntimeFailureResponse("durable-object-fetch");
      }
      // Only the explicit local-development/test readiness mode can reach
      // this in-process fallback. The stable production origin always rejects
      // it, even if the escape-hatch variable is accidentally configured.
      return runMcpRequest(handlerRequest, env, context);
    }

    return serveStaticAsset(request, env);
  },
} satisfies ExportedHandler<ShockAuditWorkerEnv>;
