import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
  SCREEN_02_WORKFLOW_META_KEY,
  SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX,
  restoreScreen02WorkflowCorrelation,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
  type Screen02WorkflowSummary,
} from "../../src/core/screen02-workflow-client";
import {
  SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
  SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
} from "../../src/core/screen02-discovery";
import {
  decryptScreen02WorkflowClientSnapshot,
  exportScreen02ResponseKeyMaterial,
  generateScreen02ResponseKeyMaterial,
  restoreScreen02SealedResult,
  type Screen02ExportedResponseKeyMaterial,
  type Screen02ResponseKeyMaterial,
  type Screen02SealedResultKind,
} from "../../src/core/screen02-sealed-result";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import {
  SCREEN_02_SOURCE_POLICY_VERSION,
  type Screen02FindProposal,
} from "../../src/core/screen02-types";
import { decisionKeys } from "../../src/core/scope-types";
import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decodeScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import worker from "../../src/worker/index";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { FEDERAL_REGISTER_API_ENDPOINT } from "../../src/worker/screen02-connectors";
import {
  CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
} from "../../src/worker/crossref-contextual-discovery";
import { CONTEXTUAL_DISCOVERY_CHANNEL } from
  "../../src/worker/contextual-discovery";
import {
  EU_CELLAR_SPARQL_ENDPOINT,
  UK_LEGISLATION_ATOM_ENDPOINT,
} from "../../src/worker/screen02-global-connectors";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
} from "../../src/worker/screen02-workflow-controller";
import {
  SHOCKAUDIT_HOST_REASONING_META_KEY,
  type ShockAuditEnv,
} from "../../src/worker/server";
import type {
  Screen02ContextSearchLead,
  Screen02ContextSearchProvider,
} from "../../src/worker/screen02-search-expansion";
import { InMemoryScreen02WorkflowStore } from "../../src/worker/screen02-workflow-store";
import {
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";

const FEDERAL_REGISTER_RESPONSE_FIELDS = [
  "document_number",
  "title",
  "type",
  "abstract",
  "action",
  "excerpts",
  "html_url",
  "pdf_url",
  "raw_text_url",
  "body_html_url",
  "publication_date",
  "effective_on",
  "agencies",
] as const;

type ListedTool = {
  name?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
  };
  outputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    anyOf?: unknown[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  _meta?: Record<string, unknown>;
};

type ToolCallPayload = {
  error?: unknown;
  result?: {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
};

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};
const workflowMcpTestSigningKey = crypto.randomUUID().replaceAll("-", "");

afterEach(() => {
  vi.restoreAllMocks();
});

function mcpRequest(
  body: Record<string, unknown>,
  protocolVersion?: string,
) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
      ...(protocolVersion
        ? { "MCP-Protocol-Version": protocolVersion }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

async function readMcpPayload(response: Response) {
  const responseText = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = responseText
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) {
      throw new Error(`MCP response contained no SSE data: ${responseText}`);
    }
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(responseText) as Record<string, unknown>;
}

function productionHarness(overrides: Partial<ShockAuditEnv> = {}) {
  const store = new InMemoryScreen02WorkflowStore();
  let now = "2026-08-10T18:00:00.000Z";
  let requestId = 0;
  const env: ShockAuditEnv = {
    ASSETS: {
      fetch: async () =>
        new Response(
          '<!doctype html><html><body><div id="root"></div></body></html>',
          { headers: { "content-type": "text/html" } },
        ),
    } as unknown as ShockAuditEnv["ASSETS"],
    CONNECTOR_FETCH: async () =>
      new Response(JSON.stringify({ count: 0, results: [] }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    NOW: () => now,
    SCREEN02_SEARCH_EXPANSION_MODE: "off",
    SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
    SCREEN02_WORKFLOW_STORE: store,
    SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen02-mcp-test-v1",
    SCREEN02_WORKFLOW_SIGNING_KEY: workflowMcpTestSigningKey,
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
    ...overrides,
  };

  const call = async (
    method: string,
    params: Record<string, unknown>,
    protocolVersion?: string,
  ) => {
    requestId += 1;
    const response = await worker.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: requestId,
          method,
          params,
        },
        protocolVersion,
      ) as never,
      env as never,
      executionContext as never,
    );
    expect(response.status).toBe(200);
    return readMcpPayload(response);
  };

  return {
    store,
    setNow: (value: string) => {
      now = value;
    },
    call,
    callTool: (
      name: string,
      args: Record<string, unknown>,
    ) =>
      call("tools/call", { name, arguments: args }) as Promise<ToolCallPayload>,
  };
}

function workflowSnapshot(payload: ToolCallPayload) {
  const value = payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY];
  const restored = restoreScreen02WorkflowClientSnapshot(value);
  if (!restored) {
    throw new Error("MCP result did not contain a valid private workflow snapshot.");
  }
  return restored;
}

function createCanonicalWorkflow(
  harness: ReturnType<typeof productionHarness>,
  studyContext: Screen01StudyContext,
  operationId: string,
) {
  return harness.callTool(SCREEN_02_WORKFLOW_CREATE_TOOL_V023, {
    schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
    operationId,
    studyContext,
  });
}

async function rejectFindPlannerAndDiscover(
  harness: ReturnType<typeof productionHarness>,
  plannedPayload: ToolCallPayload,
  operationId: string,
) {
  const planned = workflowSnapshot(plannedPayload);
  const state = stateFromScreen02WorkflowClientSnapshot(planned);
  if (state.mode !== "find") throw new Error("Expected Find state.");
  const requestIds = state.assessmentRequests
    .filter(
      (request) =>
        request.target.mode === "find-discovery-plan" &&
        request.status === "prepared",
    )
    .map((request) => request.requestId);
  if (requestIds.length === 0) {
    expect(planned.assessmentAvailable).toBe(false);
    expect(planned.assessmentBatch).toBeNull();
    expect(
      state.assessmentRequests.some(
        (request) => request.target.mode === "find-discovery-plan",
      ),
    ).toBe(false);
    return plannedPayload;
  }
  expect(requestIds).toHaveLength(1);
  return harness.callTool("mutate_screen02_workflow_v021", {
    schemaVersion: "screen-02-workflow-action-v1",
    operationId,
    runId: planned.runId,
    accessToken: planned.accessToken,
    expectedRevision: planned.revision,
    expectedStateFingerprint: planned.stateFingerprint,
    action: "assessment-delivery",
    payload: { requestIds, delivered: false },
  });
}

function exactCcpaProfitabilityAuditContext() {
  const sentence =
    "Audit whether the California Consumer Privacy Act of 2018 affected annual profitability among U.S. public technology firms from 2017 to 2023.";
  const initial = createInitialState("audit", sentence);
  const confirmed = confirmScopeContract({
    ...initial,
    revision: 1,
    resolvedKeys: [...decisionKeys],
  });
  if (!confirmed.ok) {
    throw new Error(`Exact CCPA test context did not confirm: ${confirmed.error}`);
  }
  return buildScreen01StudyContext(confirmed.state, confirmed.ambiguities);
}

function contextualFindLead(
  retrievedAt: string,
  id = "contextual-technology-rule",
): Screen02FindProposal {
  const title = "Contextual Technology Resilience Rule";
  return {
    id,
    mode: "find",
    kind: "event",
    title,
    description:
      "An unverified contextual lead that requires direct official-source confirmation.",
    nativeIdentity: {
      formalIdentifier: null,
      issuer: null,
      issuingJurisdiction: "United States",
      status: null,
    },
    event: {
      displayName: title,
      eventDate: "2019-05-20",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["Technology firms"],
    },
    // The server must overwrite this provider assertion to unsupported-lead.
    origin: "newly-discovered",
    provisionalDates: ["Reported date: 2019-05-20"],
    affectedPopulation: "Technology firms",
    requiredVariables: ["Verified operative date", "Verified coverage"],
    outcomeLink: {
      text: "Any innovation pathway remains an unverified hypothesis.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: ["This contextual result is not authoritative evidence."],
    reasons: ["A feature-gated host context provider returned this lead."],
    sources: [
      {
        id: `${id}-source`,
        title,
        locator: `https://context.invalid/${id}`,
        publisher: "Unverified context provider",
        publishedDate: "2019-05-20",
        authorityTier: 6,
        authorityAssessment: {
          method: "unverified",
          reason: "Contextual discovery is a lead pending direct support.",
          policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
        },
        channel: "feature-gated-context-lead",
        retrievedAt,
      },
    ],
  };
}

function contextualLaneLead(input: {
  retrievedAt: string;
  id: string;
  title: string;
  channel: string;
  publishedDate?: string;
}): Screen02ContextSearchLead {
  const base = contextualFindLead(input.retrievedAt, input.id);
  const publishedDate = input.publishedDate ?? "2021-05-20";
  const locator = `https://context.invalid/${input.id}`;
  return {
    recordId: input.id,
    canonicalIdentity: input.title,
    // Hidden provider identity is deliberately false. The bridge must inspect
    // the user-visible title and nothing else.
    formalIdentifier: "2099-99999",
    issuingJurisdiction: "Elsewhere",
    locator,
    value: {
      ...base,
      title: input.title,
      description:
        "Hidden contextual prose names 2098-88888 but must never trigger verification.",
      nativeIdentity: {
        formalIdentifier: "2097-77777",
        issuer: "Unverified publisher",
        issuingJurisdiction: "Elsewhere",
        status: null,
      },
      event: {
        ...base.event,
        displayName: input.title,
        eventDate: publishedDate,
      },
      sources: [{
        ...base.sources[0]!,
        id: `${input.id}-source`,
        title: input.title,
        locator,
        publisher: "Unverified metadata publisher 2096-66666",
        publishedDate,
        channel: input.channel,
      }],
    },
  };
}

function screen02ExpansionTelemetry(log: {
  mock: { calls: unknown[][] };
}) {
  return log.mock.calls.flatMap((call) => {
    const value = call[0];
    if (typeof value !== "string") return [];
    try {
      const record = JSON.parse(value) as Record<string, unknown>;
      return record.event === "screen02_search_expansion" ? [record] : [];
    } catch {
      return [];
    }
  });
}

async function discoverFixedPlanFind(
  overrides: Partial<ShockAuditEnv>,
  operationPrefix: string,
  studyContext: Screen01StudyContext = confirmedWorkflowFindContext(),
) {
  const harness = productionHarness(overrides);
  const opened = await createCanonicalWorkflow(
    harness,
    studyContext,
    `${operationPrefix}-open`,
  );
  const initial = workflowSnapshot(opened);
  const planned = await harness.callTool(
    "mutate_screen02_workflow_v021",
    {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: `${operationPrefix}-search`,
      runId: initial.runId,
      accessToken: initial.accessToken,
      expectedRevision: initial.revision,
      expectedStateFingerprint: initial.stateFingerprint,
      action: "find-search",
      payload: { criteria: [] },
    },
  );
  const mutation = await rejectFindPlannerAndDiscover(
    harness,
    planned,
    `${operationPrefix}-fixed-plan`,
  );
  const state = stateFromScreen02WorkflowClientSnapshot(
    workflowSnapshot(mutation),
  );
  if (state.mode !== "find") throw new Error("Expected Find state.");
  return state;
}

async function freshResponseKey() {
  const responseKey = await generateScreen02ResponseKeyMaterial();
  const exportedResponseKey =
    await exportScreen02ResponseKeyMaterial(responseKey);
  return { responseKey, exportedResponseKey };
}

const compactSummaryKeys = [
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
].sort();

function expectPrivateSnapshotBoundary(
  payload: ToolCallPayload,
  snapshot: Screen02WorkflowClientSnapshot,
  includesHostReasoningMetadata = false,
) {
  const summary = payload.result?.structuredContent;
  expect(Object.keys(summary ?? {}).sort()).toEqual(compactSummaryKeys);
  expect(JSON.stringify(summary).length).toBeLessThan(2_000);
  expect(summary).not.toHaveProperty("accessToken");
  expect(summary).not.toHaveProperty("stateEnvelope");
  expect(summary).not.toHaveProperty("assessmentBatch");
  expect(summary).not.toHaveProperty("runId");
  expect(summary).not.toHaveProperty("revision");
  expect(summary).not.toHaveProperty("stateFingerprint");
  expect(JSON.stringify(summary)).not.toContain(snapshot.accessToken);
  expect(JSON.stringify(payload.result?.content)).not.toContain(
    snapshot.accessToken,
  );
  expect(Object.keys(payload.result?._meta ?? {})).toEqual([
    ...(includesHostReasoningMetadata
      ? [SHOCKAUDIT_HOST_REASONING_META_KEY]
      : []),
    SCREEN_02_WORKFLOW_META_KEY,
    SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  ]);
  expect(payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY]).toEqual(
    snapshot,
  );
  expect(
    restoreScreen02WorkflowCorrelation(
      payload.result?._meta?.[SCREEN_02_WORKFLOW_CORRELATION_META_KEY],
    ),
  ).toMatchObject({
    runId: snapshot.runId,
    mode: snapshot.mode,
    revision: snapshot.revision,
    stateFingerprint: snapshot.stateFingerprint,
  });
}

async function expectSealedPrivateSnapshotBoundary(
  payload: ToolCallPayload,
  snapshot: Screen02WorkflowClientSnapshot,
  operationId: string,
  kind: Screen02SealedResultKind,
  responseKey: Screen02ResponseKeyMaterial,
  exportedResponseKey: Screen02ExportedResponseKeyMaterial,
  additionalSecrets: string[] = [],
  includesScreen03ReleaseFlag = false,
) {
  const structuredContent = payload.result?.structuredContent;
  expect(Object.keys(structuredContent ?? {}).sort()).toEqual(
    [...compactSummaryKeys, "sealedSnapshot"].sort(),
  );
  expect(structuredContent).not.toHaveProperty("accessToken");
  expect(structuredContent).not.toHaveProperty("stateEnvelope");
  expect(structuredContent).not.toHaveProperty("assessmentBatch");
  expect(structuredContent).not.toHaveProperty("runId");
  expect(structuredContent).not.toHaveProperty("revision");
  expect(structuredContent).not.toHaveProperty("stateFingerprint");

  const sealedSnapshot = restoreScreen02SealedResult(
    structuredContent?.sealedSnapshot,
  );
  expect(sealedSnapshot).toMatchObject({
    schemaVersion: "screen-02-workflow-sealed-result-v1",
    algorithm: "A256GCM",
    kind,
    operationId,
    keyId: exportedResponseKey.keyId,
  });
  const decrypted = await decryptScreen02WorkflowClientSnapshot(
    sealedSnapshot,
    { operationId, kind, responseKey },
  );
  expect(decrypted).toEqual(snapshot);

  const publicResult = JSON.stringify({
    content: payload.result?.content,
    structuredContent,
  });
  for (const secret of [
    snapshot.runId,
    snapshot.accessToken,
    snapshot.stateEnvelope.payload,
    exportedResponseKey.key,
    ...additionalSecrets,
  ]) {
    expect(secret.length).toBeGreaterThan(0);
    expect(publicResult).not.toContain(secret);
  }
  expect(Object.keys(payload.result?._meta ?? {})).toEqual([
    ...(includesScreen03ReleaseFlag
      ? [
          SHOCKAUDIT_HOST_REASONING_META_KEY,
          "shockaudit/screen03HostNativeDefault",
        ]
      : []),
    SCREEN_02_WORKFLOW_META_KEY,
    SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  ]);
  expect(payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY]).toEqual(
    snapshot,
  );
  expect(
    restoreScreen02WorkflowCorrelation(
      payload.result?._meta?.[SCREEN_02_WORKFLOW_CORRELATION_META_KEY],
    ),
  ).toMatchObject({
    runId: snapshot.runId,
    mode: snapshot.mode,
    revision: snapshot.revision,
    stateFingerprint: snapshot.stateFingerprint,
  });
}

describe("canonical Screen 2 production MCP wiring", () => {
  it("advertises only the bounded canonical production catalog", async () => {
    const harness = productionHarness();
    const payload = (await harness.call("tools/list", {})) as {
      result?: { tools?: ListedTool[] };
    };
    const tools = payload.result?.tools ?? [];
    const names = tools.map((tool) => tool.name);
    expect([...names].sort()).toEqual(
      [
        "open_shockaudit_screen_1",
        "draft_scope_contract",
        "confirm_scope_contract",
        SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
        SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
        "open_shockaudit_screen_2",
        SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
        "mutate_screen02_workflow_v021",
        "retire_screen02_workflow_v021",
      ].sort(),
    );

    for (const absent of [
      "open_stage1_assessment_proof",
      "submit_stage1_assessment_draft",
      "discover_shock_options",
      "assess_shock_options",
    ]) {
      expect(names, absent).not.toContain(absent);
    }
    for (const present of [
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
      "open_shockaudit_screen_2",
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
      "mutate_screen02_workflow_v021",
      "retire_screen02_workflow_v021",
    ]) {
      expect(names, present).toContain(present);
    }
    expect(names).not.toContain("submit_screen02_find_assessment_draft_v021");
    expect(names).not.toContain("submit_screen02_audit_draft_v021");

    const opener = tools.find(
      (tool) => tool.name === "open_shockaudit_screen_2",
    );
    const legacyCreator = tools.find(
      (tool) => tool.name === SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
    );
    const creator = tools.find(
      (tool) => tool.name === SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
    );
    const confirm = tools.find(
      (tool) => tool.name === "confirm_scope_contract",
    );
    const legacyMutate = tools.find(
      (tool) => tool.name === "mutate_screen02_workflow_v021",
    );
    const mutate = tools.find(
      (tool) => tool.name === SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
    );
    const retire = tools.find(
      (tool) => tool.name === "retire_screen02_workflow_v021",
    );
    expect(
      (opener?._meta?.ui as { visibility?: string[] } | undefined)?.visibility,
    ).toEqual(["model", "app"]);
    expect(opener?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(
      (creator?._meta?.ui as { visibility?: string[] } | undefined)
        ?.visibility,
    ).toEqual(["app"]);
    expect(creator?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(creator?._meta?.["openai/outputTemplate"]).toBeUndefined();
    expect(creator?._meta?.["ui/resourceUri"]).toBeUndefined();
    expect(Object.keys(opener?.outputSchema?.properties ?? {}).sort()).toEqual(
      [
        "screen",
        "ok",
        "error",
        "sessionState",
        "sessionSummary",
        "assessmentResults",
      ].sort(),
    );
    expect(Object.keys(creator?.outputSchema?.properties ?? {}).sort()).toEqual(
      [...compactSummaryKeys, "sealedSnapshot"].sort(),
    );
    expect(
      Object.keys(legacyCreator?.outputSchema?.properties ?? {}).sort(),
    ).toEqual(compactSummaryKeys);
    expect(creator?.inputSchema?.properties).toHaveProperty("responseKeyId");
    expect(creator?.inputSchema?.properties).toHaveProperty("responseKey");
    expect(creator?.inputSchema?.properties?.initialState).toMatchObject({
      type: "string",
      enum: ["standard", "blank"],
    });
    expect(Object.keys(mutate?.outputSchema?.properties ?? {}).sort()).toEqual(
      [...compactSummaryKeys, "sealedSnapshot"].sort(),
    );
    expect(
      Object.keys(legacyMutate?.outputSchema?.properties ?? {}).sort(),
    ).toEqual(compactSummaryKeys);
    expect(mutate?.inputSchema?.properties).toHaveProperty("responseKeyId");
    expect(mutate?.inputSchema?.properties).toHaveProperty("responseKey");
    expect(
      (confirm?._meta?.ui as { visibility?: string[] } | undefined)?.visibility,
    ).toContain("app");
    expect(confirm?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(
      (mutate?._meta?.ui as { visibility?: string[] } | undefined)?.visibility,
    ).toEqual(["app"]);
    expect(
      (retire?._meta?.ui as { visibility?: string[] } | undefined)?.visibility,
    ).toEqual(["app"]);

    expect(opener?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(creator?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(mutate?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(retire?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(new Set(names).size).toBe(9);
    expect(
      new TextEncoder().encode(JSON.stringify(tools)).byteLength,
    ).toBeLessThan(64 * 1024);
  });

  it("keeps the versioned creator as one object schema on the 2025 MCP wire projection", async () => {
    const harness = productionHarness();
    const protocolVersion = "2025-06-18";
    const initialized = (await harness.call(
      "initialize",
      {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "ShockAudit protocol projection test", version: "1" },
      },
      protocolVersion,
    )) as { result?: { protocolVersion?: string } };
    expect(initialized.result?.protocolVersion).toBe(protocolVersion);

    const listed = (await harness.call(
      "tools/list",
      {},
      protocolVersion,
    )) as { result?: { tools?: ListedTool[] } };
    const creator = listed.result?.tools?.find(
      (tool) => tool.name === SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
    );
    expect(creator?.outputSchema?.type).toBe("object");
    expect(creator?.outputSchema?.anyOf).toBeUndefined();
    expect(creator?.outputSchema?.properties).not.toHaveProperty("result");

    const payload = (await harness.call(
      "tools/call",
      {
        name: SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
        arguments: {
          schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
          operationId: "mcp-2025-projection-open",
          studyContext: confirmedWorkflowFindContext(),
        },
      },
      protocolVersion,
    )) as ToolCallPayload;
    const snapshot = workflowSnapshot(payload);
    expectPrivateSnapshotBoundary(payload, snapshot, true);
    expect(payload.result?.structuredContent).not.toHaveProperty("result");
    expect(payload.result?.structuredContent).toMatchObject({
      schemaVersion: "screen-02-workflow-summary-v1",
      outcome: "created",
      mode: "find",
    });
  });

  it("seals exact Find and Audit opening snapshots into structuredContent without plaintext secrets", async () => {
    const harness = productionHarness();
    const cases = [
      ["find", confirmedWorkflowFindContext()],
      ["audit", confirmedWorkflowAuditContext()],
    ] as const;

    for (const [mode, studyContext] of cases) {
      const operationId = `mcp-v024-${mode}-sealed-open`;
      const { responseKey, exportedResponseKey } = await freshResponseKey();
      const payload = await harness.callTool(
        SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
        {
          schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
          operationId,
          responseKeyId: exportedResponseKey.keyId,
          responseKey: exportedResponseKey.key,
          studyContext,
        },
      );
      expect(
        payload.result?.isError,
        JSON.stringify(payload.result?.content),
      ).not.toBe(true);
      const snapshot = workflowSnapshot(payload);
      expect(payload.result?.structuredContent).toMatchObject({
        schemaVersion: "screen-02-workflow-summary-v1",
        outcome: "created",
        mode,
      });
      await expectSealedPrivateSnapshotBoundary(
        payload,
        snapshot,
        operationId,
        "open",
        responseKey,
        exportedResponseKey,
        [],
        true,
      );
    }
  });

  it("rejects mismatched response-key material before creating a canonical run", async () => {
    const harness = productionHarness();
    const operationId = "mcp-v024-invalid-key-preflight-open";
    const valid = await freshResponseKey();
    const other = await freshResponseKey();
    const invalid = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      {
        schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
        operationId,
        responseKeyId: other.exportedResponseKey.keyId,
        responseKey: valid.exportedResponseKey.key,
        studyContext: confirmedWorkflowFindContext(),
      },
    );
    expect(invalid.result?.isError).toBe(true);

    const created = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      {
        schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
        operationId,
        responseKeyId: valid.exportedResponseKey.keyId,
        responseKey: valid.exportedResponseKey.key,
        studyContext: confirmedWorkflowFindContext(),
      },
    );
    expect(created.result?.isError).not.toBe(true);
    expect(created.result?.structuredContent).toMatchObject({
      outcome: "created",
      mode: "find",
    });
  });

  it("creates, replays, and intent-binds a blank app-only Audit reset", async () => {
    const harness = productionHarness();
    const operationId = "mcp-v024-blank-audit-reset-open";
    const key = await freshResponseKey();
    const args = {
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
      operationId,
      responseKeyId: key.exportedResponseKey.keyId,
      responseKey: key.exportedResponseKey.key,
      initialState: "blank",
      studyContext: confirmedWorkflowAuditContext(),
    };
    const created = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      args,
    );
    expect(created.result?.isError).not.toBe(true);
    const snapshot = workflowSnapshot(created);
    const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
    expect(state).toMatchObject({
      mode: "audit",
      revision: 0,
      sources: [],
      matchSets: [],
      activeMatchSetSnapshotId: null,
      possibleMatches: [],
      dossiers: [],
      identityDecisions: [],
      confirmedIdentity: null,
      assessments: [],
      assessmentRequests: [],
      continuationHistory: [],
    });
    expect(created.result?.structuredContent).toMatchObject({
      outcome: "created",
      mode: "audit",
      preparedRequestCount: 0,
    });

    const replayed = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      args,
    );
    expect(replayed.result?.isError).not.toBe(true);
    expect(workflowSnapshot(replayed)).toMatchObject({
      runId: snapshot.runId,
      accessToken: snapshot.accessToken,
      stateFingerprint: snapshot.stateFingerprint,
    });
    expect(replayed.result?.structuredContent).toMatchObject({
      outcome: "replayed",
    });

    const changedIntentKey = await freshResponseKey();
    const changedIntent = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      {
        ...args,
        responseKeyId: changedIntentKey.exportedResponseKey.keyId,
        responseKey: changedIntentKey.exportedResponseKey.key,
        initialState: "standard",
      },
    );
    expect(changedIntent.result?.isError).toBe(true);
    expect(JSON.stringify(changedIntent.result?.content)).toMatch(
      /different initialization profile/i,
    );

    const invalidIntent = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      { ...args, operationId: `${operationId}-invalid`, initialState: true },
    );
    expect(invalidIntent.result?.isError).toBe(true);
  });

  it("seals the exact deterministic Audit mutation without exposing private state", async () => {
    const harness = productionHarness();
    const openOperationId = "mcp-v024-audit-open-for-mutation";
    const openKey = await freshResponseKey();
    const opened = await harness.callTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      {
        schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
        operationId: openOperationId,
        responseKeyId: openKey.exportedResponseKey.keyId,
        responseKey: openKey.exportedResponseKey.key,
        studyContext: confirmedWorkflowAuditContext(),
      },
    );
    const openedSnapshot = workflowSnapshot(opened);
    const openedState = stateFromScreen02WorkflowClientSnapshot(openedSnapshot);
    if (openedState.mode !== "audit") throw new Error("Expected Audit state.");
    const activeMatch = openedState.possibleMatches.find(
      (match) =>
        match.matchSetSnapshotId === openedState.activeMatchSetSnapshotId,
    );
    expect(activeMatch).toBeDefined();

    const operationId = "mcp-v024-audit-open-dossier";
    const mutationKey = await freshResponseKey();
    const otherMutationKey = await freshResponseKey();
    const mismatchedKeyMutation = await harness.callTool(
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
      {
        schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
        operationId,
        responseKeyId: otherMutationKey.exportedResponseKey.keyId,
        responseKey: mutationKey.exportedResponseKey.key,
        runId: openedSnapshot.runId,
        accessToken: openedSnapshot.accessToken,
        expectedRevision: openedSnapshot.revision,
        expectedStateFingerprint: openedSnapshot.stateFingerprint,
        action: "audit-open",
        payload: { matchSnapshotId: activeMatch?.matchSnapshotId },
      },
    );
    expect(mismatchedKeyMutation.result?.isError).toBe(true);

    const mutated = await harness.callTool(
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
      {
        schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
        operationId,
        responseKeyId: mutationKey.exportedResponseKey.keyId,
        responseKey: mutationKey.exportedResponseKey.key,
        runId: openedSnapshot.runId,
        accessToken: openedSnapshot.accessToken,
        expectedRevision: openedSnapshot.revision,
        expectedStateFingerprint: openedSnapshot.stateFingerprint,
        action: "audit-open",
        payload: { matchSnapshotId: activeMatch?.matchSnapshotId },
      },
    );
    expect(
      mutated.result?.isError,
      JSON.stringify(mutated.result?.content),
    ).not.toBe(true);
    const mutatedSnapshot = workflowSnapshot(mutated);
    const mutatedState = stateFromScreen02WorkflowClientSnapshot(
      mutatedSnapshot,
    );
    if (mutatedState.mode !== "audit") throw new Error("Expected Audit state.");
    expect(mutatedSnapshot.assessmentAvailable).toBe(false);
    expect(mutatedSnapshot.assessmentBatch).toBeNull();
    expect(
      mutatedState.assessmentRequests.find(
        (request) => request.target.mode === "audit-dossier",
      ),
    ).toMatchObject({ status: "completed" });
    expect(mutatedState.dossiers).toHaveLength(1);
    expect(mutated.result?.structuredContent).toMatchObject({
      outcome: "applied",
      mode: "audit",
      assessmentAvailable: false,
      preparedRequestCount: 0,
      completedRequestCount: 1,
    });
    await expectSealedPrivateSnapshotBoundary(
      mutated,
      mutatedSnapshot,
      operationId,
      "mutation",
      mutationKey.responseKey,
      mutationKey.exportedResponseKey,
    );
  });

  it("opens isolated Find and Audit runs with compact public summaries", async () => {
    const harness = productionHarness();
    const findContext = confirmedWorkflowFindContext();
    const findPayload = await createCanonicalWorkflow(
      harness,
      findContext,
      "client-supplied-find-open-operation",
    );
    expect(findPayload.result?.isError).not.toBe(true);
    const findSnapshot = workflowSnapshot(findPayload);
    const findSummary = findPayload.result
      ?.structuredContent as Screen02WorkflowSummary;
    expectPrivateSnapshotBoundary(findPayload, findSnapshot, true);
    expect(findSummary).toMatchObject({
      screen: "screen-02",
      ok: true,
      outcome: "created",
      mode: "find",
      preparedRequestCount: 0,
    });
    expect(findSnapshot.runId).toMatch(/^s2r_[A-Za-z0-9_-]{43}$/);
    expect(findSnapshot.accessToken).toMatch(/^s2a_[A-Za-z0-9_-]{43}$/);
    expect(findSnapshot.runId).not.toBe(
      "client-supplied-find-open-operation",
    );
    const findState = stateFromScreen02WorkflowClientSnapshot(findSnapshot);
    expect(findState).toMatchObject({
      runId: findSnapshot.runId,
      mode: "find",
      revision: 0,
      screen01Baseline: findContext,
      candidates: [],
      assessmentRequests: [],
    });

    const auditContext = confirmedWorkflowAuditContext();
    const auditPayload = await createCanonicalWorkflow(
      harness,
      auditContext,
      "client-supplied-audit-open-operation",
    );
    expect(auditPayload.result?.isError).not.toBe(true);
    const auditSnapshot = workflowSnapshot(auditPayload);
    const auditSummary = auditPayload.result
      ?.structuredContent as Screen02WorkflowSummary;
    expectPrivateSnapshotBoundary(auditPayload, auditSnapshot, true);
    expect(auditSnapshot.runId).toMatch(/^s2r_[A-Za-z0-9_-]{43}$/);
    expect(auditSnapshot.accessToken).toMatch(/^s2a_[A-Za-z0-9_-]{43}$/);
    expect(auditSnapshot.runId).not.toBe(
      "client-supplied-audit-open-operation",
    );
    const auditState = stateFromScreen02WorkflowClientSnapshot(auditSnapshot);
    expect(auditSummary).toMatchObject({
      screen: "screen-02",
      ok: true,
      outcome: "created",
      mode: "audit",
      preparedRequestCount: 0,
    });
    expect(auditSnapshot.assessmentAvailable).toBe(false);
    expect(auditSnapshot.assessmentBatch).toBeNull();
    expect(auditState.mode).toBe("audit");
    if (auditState.mode !== "audit") throw new Error("Expected Audit state.");
    expect(auditState.screen01Baseline).toEqual(auditContext);
    expect(auditState.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(
      auditState.possibleMatches.map((match) => match.relationship),
    ).toEqual([
      "supported-alias",
      "amendment",
      "implementing-rule",
      "enforcement-action",
    ]);
    expect(auditState.activeMatchSetSnapshotId).not.toBeNull();

    const activeMatch = auditState.possibleMatches.find(
      (match) =>
        match.matchSetSnapshotId === auditState.activeMatchSetSnapshotId,
    );
    expect(activeMatch).toBeDefined();
    const openedDossierPayload = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-open-active-match",
        runId: auditSnapshot.runId,
        accessToken: auditSnapshot.accessToken,
        expectedRevision: auditSnapshot.revision,
        expectedStateFingerprint: auditSnapshot.stateFingerprint,
        action: "audit-open",
        payload: { matchSnapshotId: activeMatch?.matchSnapshotId },
      },
    );
    expect(openedDossierPayload.result?.isError).not.toBe(true);
    const openedDossierSnapshot = workflowSnapshot(openedDossierPayload);
    const openedDossierSummary = openedDossierPayload.result
      ?.structuredContent as Screen02WorkflowSummary;
    expectPrivateSnapshotBoundary(
      openedDossierPayload,
      openedDossierSnapshot,
    );
    expect(openedDossierSummary).toMatchObject({
      screen: "screen-02",
      ok: true,
      outcome: "applied",
      mode: "audit",
      assessmentAvailable: false,
      preparedRequestCount: 0,
      completedRequestCount: 1,
    });
    expect(openedDossierSnapshot.revision).toBe(auditSnapshot.revision + 4);
    expect(openedDossierSnapshot.assessmentBatch).toBeNull();
    const openedDossierState = stateFromScreen02WorkflowClientSnapshot(
      openedDossierSnapshot,
    );
    if (openedDossierState.mode !== "audit") {
      throw new Error("Expected Audit state.");
    }
    expect(
      openedDossierState.assessmentRequests.find(
        (request) => request.target.mode === "audit-dossier",
      ),
    ).toMatchObject({ status: "completed" });
    expect(openedDossierState.dossiers).toHaveLength(1);
  });

  it("opens the canonical workflow through the v0.2.20-compatible runId field", async () => {
    const harness = productionHarness();
    const studyContext = confirmedWorkflowFindContext();
    const payload = await harness.callTool("open_shockaudit_screen_2", {
      studyContext,
      runId: `${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}compatibility-test`,
    });

    expect(payload.result?.isError).not.toBe(true);
    const snapshot = workflowSnapshot(payload);
    expect(payload.result?.structuredContent).toMatchObject({
      screen: "screen-02",
      ok: true,
      error: "",
      sessionSummary: {
        runId: `${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}compatibility-test`,
        mode: "find",
      },
    });
    expect(Object.keys(payload.result?.structuredContent ?? {}).sort()).toEqual(
      ["screen", "ok", "error", "sessionState", "sessionSummary"].sort(),
    );
    expect(
      restoreScreen02WorkflowCorrelation(
        payload.result?._meta?.[SCREEN_02_WORKFLOW_CORRELATION_META_KEY],
      ),
    ).toMatchObject({
      operationId: `${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}compatibility-test`,
      kind: "open",
      runId: snapshot.runId,
    });
    expect(
      stateFromScreen02WorkflowClientSnapshot(snapshot).screen01Baseline,
    ).toEqual(studyContext);
  });

  it("ranks live-shaped official results after an explicit Audit anchor revision", async () => {
    const connectorRequests: URL[] = [];
    const documentNumber = "2018-audit-official-ranking";
    const connectorTitle = "California Consumer Privacy Reporting Rule";
    const connectorUrl =
      `https://www.federalregister.gov/d/${documentNumber}`;
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        connectorRequests.push(url);
        if (`${url.origin}${url.pathname}` === FEDERAL_REGISTER_API_ENDPOINT) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [
                {
                  title: connectorTitle,
                  type: "Rule",
                  abstract:
                    "An official privacy reporting rule associated with California consumer privacy requirements and covered technology businesses.",
                  document_number: documentNumber,
                  publication_date: "2018-06-28",
                  effective_on: "2020-01-01",
                  html_url: connectorUrl,
                  agencies: [{ name: "Privacy Rulemaking Agency" }],
                },
              ],
            }),
            {
              headers: {
                "content-type": "application/json; charset=utf-8",
              },
            },
          );
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });

    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-live-shaped-official-ranking",
    );

    expect(opened.result?.isError, JSON.stringify(opened.result?.content)).not.toBe(true);
    expect(connectorRequests).toHaveLength(0);
    const initialSnapshot = workflowSnapshot(opened);
    const initialState = stateFromScreen02WorkflowClientSnapshot(initialSnapshot);
    if (initialState.mode !== "audit") throw new Error("Expected Audit state.");
    const activeRevision = initialState.anchor.revisions.find(
      (revision) => revision.anchorRevisionId === initialState.anchor.activeRevisionId,
    );
    expect(activeRevision).toBeDefined();
    const revised = await harness.callTool("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: "mcp-audit-live-shaped-official-ranking-revise",
      runId: initialSnapshot.runId,
      accessToken: initialSnapshot.accessToken,
      expectedRevision: initialSnapshot.revision,
      expectedStateFingerprint: initialSnapshot.stateFingerprint,
      action: "audit-revise-anchor",
      payload: {
        fields: {
          shockName: connectorTitle,
          jurisdiction: "United States",
          issuingAuthority: "Privacy Rulemaking Agency",
          approximateYear: "2018",
          versionType: "original",
          distinguishingFeature: "Privacy reporting requirements",
          sourceLocator: null,
          clarification: "Rerun bounded official-source identity discovery.",
        },
        reason: "Exercise the explicit Audit identity-discovery route.",
      },
    });
    expect(revised.result?.isError, JSON.stringify(revised.result?.content)).not.toBe(true);
    expect(connectorRequests.length).toBeGreaterThan(0);
    const snapshot = workflowSnapshot(revised);
    const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
    expect(state.mode).toBe("audit");
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    expect(
      state.possibleMatches.some(
        (match) =>
          match.identity.canonicalTitle === connectorTitle &&
          match.sourceIds.some((sourceId) =>
            state.sources.some(
              (source) =>
                source.id === sourceId && source.locator === connectorUrl,
            ),
          ),
      ),
    ).toBe(true);
  });

  it("revises a wrong Audit match through a researcher URL and opens its match-specific dossier", async () => {
    const officialPageUrl =
      "https://official.lakeview.gov.example.org/algorithmic-rights-act";
    const pageTitle = "Lakeview Algorithmic Rights Act of 2024";
    const hiddenScriptText = "THIS SCRIPT TEXT MUST NOT BECOME EVIDENCE";
    const visibleBody = [
      `<main><h1>${pageTitle}</h1>`,
      "<p>The Lakeview Algorithmic Rights Act creates public rights and duties for automated decisions.</p>",
      `<p>${"Official provision text retained as bounded identity evidence. ".repeat(500)}</p></main>`,
    ].join("");
    const pageFetches: Array<{ url: string; init?: RequestInit }> = [];
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input, init) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        if (url.toString() === officialPageUrl) {
          pageFetches.push({ url: url.toString(), init });
          return new Response(
            `<!doctype html><html><head><title>${pageTitle}</title><script>${hiddenScriptText}</script></head><body>${visibleBody}</body></html>`,
            {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "last-modified": "Sun, 12 May 2024 14:30:00 GMT",
              },
            },
          );
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-revise-open",
    );
    const initial = workflowSnapshot(opened);
    const initialState = stateFromScreen02WorkflowClientSnapshot(initial);
    if (initialState.mode !== "audit") throw new Error("Expected Audit state.");
    const wrongMatch = initialState.possibleMatches[0];
    const wrongMatchSetSnapshotId = initialState.activeMatchSetSnapshotId;
    if (!wrongMatch || !wrongMatchSetSnapshotId) {
      throw new Error("Expected the initial reviewed CCPA match.");
    }
    expect(wrongMatch.identity.canonicalTitle).toBe(
      "California Consumer Privacy Act of 2018",
    );

    harness.setNow("2026-08-10T18:04:00.000Z");
    const revised = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-revise-with-official-url",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "audit-revise-anchor",
        payload: {
          fields: {
            shockName: "Lakeview Algorithmic Rights Act",
            jurisdiction: "United States",
            issuingAuthority: "Lakeview Legislature",
            approximateYear: "2024",
            versionType: "original",
            distinguishingFeature: "Rights governing automated decisions",
            sourceLocator: officialPageUrl,
            clarification:
              "Use the supplied official act page instead of the initial CCPA match.",
          },
          reason:
            "The initial reviewed record was not the shock the researcher intended.",
        },
      },
    );
    expect(
      revised.result?.isError,
      JSON.stringify(revised.result?.content),
    ).not.toBe(true);
    expect(pageFetches).toHaveLength(1);
    expect(pageFetches[0]?.url).toBe(officialPageUrl);
    expect(pageFetches[0]?.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(new Headers(pageFetches[0]?.init?.headers).get("accept")).toContain(
      "text/html",
    );

    const revisedSnapshot = workflowSnapshot(revised);
    expectPrivateSnapshotBoundary(revised, revisedSnapshot);
    expect(revised.result?.structuredContent).toMatchObject({
      ok: true,
      outcome: "applied",
      mode: "audit",
    });
    const revisedState = stateFromScreen02WorkflowClientSnapshot(
      revisedSnapshot,
    );
    if (revisedState.mode !== "audit") throw new Error("Expected Audit state.");
    const pageSource = revisedState.sources.find(
      (source) => source.locator === officialPageUrl,
    );
    expect(pageSource).toMatchObject({
      title: pageTitle,
      publisher: "official.lakeview.gov.example.org",
      publishedDate: "2024-05-12",
      authorityTier: 6,
      channel: "researcher-provided-url",
      userProvided: true,
    });
    expect(pageSource?.evidenceText).toContain(
      "creates public rights and duties for automated decisions",
    );
    expect(pageSource?.evidenceText).not.toContain(hiddenScriptText);
    expect(pageSource?.evidenceText?.length).toBeGreaterThan(1_000);
    expect(pageSource?.evidenceText?.length).toBeLessThanOrEqual(12_000);

    const pageMatch = revisedState.possibleMatches.find((match) =>
      match.sourceIds.includes(pageSource?.id ?? ""),
    );
    expect(pageMatch).toMatchObject({
      relationship: "supported-alias",
      identity: {
        canonicalTitle: pageTitle,
        issuer: "Lakeview Legislature",
        issuingJurisdiction: "United States",
      },
      sourceIds: [pageSource?.id],
    });
    expect(pageMatch?.relationshipReason).toContain(
      "page title directly matches or contains",
    );
    const activeMatchSet = revisedState.matchSets.find(
      (matchSet) =>
        matchSet.matchSetSnapshotId === revisedState.activeMatchSetSnapshotId,
    );
    expect(activeMatchSet?.possibleMatchSnapshotIds[0]).toBe(
      pageMatch?.matchSnapshotId,
    );
    expect(activeMatchSet?.possibleMatchSnapshotIds).toContain(
      pageMatch?.matchSnapshotId,
    );
    expect(activeMatchSet?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: officialPageUrl,
          returnedRecordIds: [pageSource?.id],
        }),
      ]),
    );
    expect(activeMatchSet?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "researcher-provided-url",
          status: "searched",
          note: expect.stringContaining("bounded visible text"),
        }),
      ]),
    );
    expect(activeMatchSet?.manifest.outcomeValuesInspected).toBe(false);
    expect(revisedState.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(
      revisedState.anchor.revisions.find(
        (revision) =>
          revision.anchorRevisionId === revisedState.anchor.activeRevisionId,
      )?.fields.shockName,
    ).toBe("Lakeview Algorithmic Rights Act");
    expect(
      revisedState.possibleMatches.find(
        (match) => match.matchSnapshotId === wrongMatch.matchSnapshotId,
      ),
    ).toEqual(wrongMatch);
    expect(
      revisedState.matchSets.find(
        (matchSet) =>
          matchSet.matchSetSnapshotId === wrongMatchSetSnapshotId,
      )?.status,
    ).toBe("superseded");
    expect(activeMatchSet?.possibleMatchSnapshotIds).not.toContain(
      wrongMatch.matchSnapshotId,
    );

    harness.setNow("2026-08-10T18:05:00.000Z");
    const openedDossier = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-open-researcher-url-match",
        runId: revisedSnapshot.runId,
        accessToken: revisedSnapshot.accessToken,
        expectedRevision: revisedSnapshot.revision,
        expectedStateFingerprint: revisedSnapshot.stateFingerprint,
        action: "audit-open",
        payload: { matchSnapshotId: pageMatch?.matchSnapshotId },
      },
    );
    expect(
      openedDossier.result?.isError,
      JSON.stringify(openedDossier.result?.content),
    ).not.toBe(true);
    const dossierSnapshot = workflowSnapshot(openedDossier);
    const dossierState = stateFromScreen02WorkflowClientSnapshot(
      dossierSnapshot,
    );
    if (dossierState.mode !== "audit") throw new Error("Expected Audit state.");
    const dossierRequest = dossierState.assessmentRequests.find(
      (request) =>
        request.target.mode === "audit-dossier" &&
        request.target.matchSnapshotId === pageMatch?.matchSnapshotId,
    );
    expect(dossierRequest).toMatchObject({ status: "completed" });
    expect(dossierSnapshot.assessmentAvailable).toBe(false);
    expect(dossierSnapshot.assessmentBatch).toBeNull();
    expect(
      dossierState.dossiers.find(
        (dossier) => dossier.requestId === dossierRequest?.requestId,
      ),
    ).toMatchObject({
      status: "completed",
      identitySnapshotId: pageMatch?.identitySnapshotId,
      sourceIds: [pageSource?.id],
      whatHappened: { sourceIds: [pageSource?.id] },
      unresolvedFacts: expect.arrayContaining([
        expect.stringMatching(/evidence gap/i),
      ]),
    });
    expect(
      dossierState.possibleMatches.some(
        (match) => match.matchSnapshotId === wrongMatch.matchSnapshotId,
      ),
    ).toBe(true);
  });

  it("merges the official CCPA overview URL into the reviewed original identity without a sparse duplicate", async () => {
    const officialPageUrl = "https://oag.ca.gov/privacy/ccpa";
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        if (url.toString() === officialPageUrl) {
          return new Response(
            "<!doctype html><html><head><title>California Consumer Privacy Act (CCPA)</title></head><body><main><h1>California Consumer Privacy Act</h1><p>Official California Department of Justice overview.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-ccpa-official-url-open",
    );
    const initial = workflowSnapshot(opened);

    harness.setNow("2026-08-10T18:04:00.000Z");
    const revised = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-ccpa-official-url-revise",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "audit-revise-anchor",
        payload: {
          fields: {
            shockName: "California Consumer Privacy Act",
            jurisdiction: "California, United States",
            issuingAuthority: "California Legislature",
            approximateYear: "2018",
            versionType: "original",
            distinguishingFeature: "AB 375 original statute",
            sourceLocator: officialPageUrl,
            clarification: "This OAG page describes the CCPA identity I mean.",
          },
          reason: "Attach the official California Department of Justice overview.",
        },
      },
    );
    expect(revised.result?.isError, JSON.stringify(revised.result?.content)).not.toBe(
      true,
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(revised),
    );
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    const activeSet = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    );
    const researcherUrlSource = state.sources.find(
      (source) =>
        source.locator === officialPageUrl &&
        source.channel === "researcher-provided-url" &&
        source.userProvided,
    );
    expect(researcherUrlSource).toBeDefined();
    const activeMatches = (activeSet?.possibleMatchSnapshotIds ?? []).flatMap(
      (matchSnapshotId) => {
        const match = state.possibleMatches.find(
          (candidate) => candidate.matchSnapshotId === matchSnapshotId,
        );
        return match ? [match] : [];
      },
    );
    const originalMatches = activeMatches.filter(
      (match) =>
        match.identity.canonicalTitle ===
        "California Consumer Privacy Act of 2018",
    );

    expect(originalMatches).toHaveLength(1);
    expect(originalMatches[0]).toMatchObject({
      relationship: expect.stringMatching(/^(exact|supported-alias)$/),
      identity: {
        issuer: "California Legislature",
        issuingJurisdiction: "California, United States",
        status: "enacted; subsequently amended",
      },
      sourceIds: expect.arrayContaining([
        "reviewed:ccpa-statute-ab375",
        "reviewed:ccpa-initiative-circulation-17-0039",
        "reviewed:ccpa-oag-overview",
        "reviewed:ccpa-regulations",
      ]),
    });
    expect(
      activeMatches.filter((match) =>
        match.matchSnapshotId.includes("researcher-url"),
      ),
    ).toHaveLength(0);
    expect(activeSet?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: officialPageUrl,
          returnedRecordIds: [researcherUrlSource?.id],
        }),
      ]),
    );
    expect(activeSet?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "researcher-provided-url",
          status: "searched",
          note: expect.stringContaining("no duplicate match was created"),
        }),
      ]),
    );
  });

  it("runs the exact CCPA profitability URL consensus into a deterministic source-linked dossier", async () => {
    const officialPageUrl = "https://oag.ca.gov/privacy/ccpa";
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        if (url.toString() === officialPageUrl) {
          return new Response(
            "<!doctype html><html><head><title>California Consumer Privacy Act (CCPA)</title></head><body><main><h1>California Consumer Privacy Act</h1><p>The CCPA gives consumers more control over personal information that businesses collect and imposes duties on covered businesses.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const context = exactCcpaProfitabilityAuditContext();

    const created = await createCanonicalWorkflow(
      harness,
      context,
      "mcp-exact-ccpa-profitability-create",
    );
    const initial = workflowSnapshot(created);
    const initialState = stateFromScreen02WorkflowClientSnapshot(initial);
    if (initialState.mode !== "audit") throw new Error("Expected Audit state.");
    expect(initialState.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(initialState.screen01Baseline.scopeContract).toMatchObject({
      geography: "United States",
      studyPeriod: "2017–2023",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    });
    expect(initialState.anchor.revisions[0]?.fields).toMatchObject({
      shockName: "California Consumer Privacy Act",
      jurisdiction: null,
      issuingAuthority: null,
      approximateYear: null,
      versionType: "unspecified",
    });

    harness.setNow("2026-08-10T18:21:00.000Z");
    const revised = await harness.callTool("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: "mcp-exact-ccpa-profitability-revise",
      runId: initial.runId,
      accessToken: initial.accessToken,
      expectedRevision: initial.revision,
      expectedStateFingerprint: initial.stateFingerprint,
      action: "audit-revise-anchor",
      payload: {
        fields: {
          shockName: "California Consumer Privacy Act",
          jurisdiction: "California, United States",
          issuingAuthority: "California Legislature",
          approximateYear: "2018",
          versionType: "original",
          distinguishingFeature: "AB 375 original statute",
          sourceLocator: officialPageUrl,
          clarification: "The official OAG page confirms the CCPA identity intended in Screen 1.",
        },
        reason: "Attach the official OAG page before confirming the shock identity.",
      },
    });
    expect(revised.result?.isError, JSON.stringify(revised.result?.content)).not.toBe(
      true,
    );
    const revisedSnapshot = workflowSnapshot(revised);
    const revisedState = stateFromScreen02WorkflowClientSnapshot(revisedSnapshot);
    if (revisedState.mode !== "audit") throw new Error("Expected Audit state.");
    const activeSet = revisedState.matchSets.find(
      (set) => set.matchSetSnapshotId === revisedState.activeMatchSetSnapshotId,
    );
    const activeMatches = (activeSet?.possibleMatchSnapshotIds ?? []).flatMap(
      (matchSnapshotId) => {
        const match = revisedState.possibleMatches.find(
          (candidate) => candidate.matchSnapshotId === matchSnapshotId,
        );
        return match ? [match] : [];
      },
    );
    const ccpaMatches = activeMatches.filter(
      (match) =>
        match.identity.canonicalTitle ===
        "California Consumer Privacy Act of 2018",
    );
    expect(ccpaMatches).toHaveLength(1);
    const ccpaMatch = ccpaMatches[0]!;
    expect(ccpaMatch).toMatchObject({
      identity: {
        issuer: "California Legislature",
        issuingJurisdiction: "California, United States",
      },
      sourceIds: expect.arrayContaining([
        "reviewed:ccpa-statute-ab375",
        "reviewed:ccpa-initiative-circulation-17-0039",
        "reviewed:ccpa-oag-overview",
        "reviewed:ccpa-regulations",
      ]),
    });
    expect(
      activeMatches.filter((match) =>
        match.matchSnapshotId.includes("researcher-url"),
      ),
    ).toHaveLength(0);

    harness.setNow("2026-08-10T18:22:00.000Z");
    const opened = await harness.callTool("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: "mcp-exact-ccpa-profitability-open",
      runId: revisedSnapshot.runId,
      accessToken: revisedSnapshot.accessToken,
      expectedRevision: revisedSnapshot.revision,
      expectedStateFingerprint: revisedSnapshot.stateFingerprint,
      action: "audit-open",
      payload: { matchSnapshotId: ccpaMatch.matchSnapshotId },
    });
    expect(opened.result?.isError, JSON.stringify(opened.result?.content)).not.toBe(
      true,
    );
    const dossierSnapshot = workflowSnapshot(opened);
    const dossierState = stateFromScreen02WorkflowClientSnapshot(dossierSnapshot);
    if (dossierState.mode !== "audit") throw new Error("Expected Audit state.");
    const dossierRequest = dossierState.assessmentRequests.find(
      (request) => request.target.mode === "audit-dossier",
    );
    expect(dossierRequest?.status).toBe("completed");
    expect(dossierSnapshot.assessmentAvailable).toBe(false);
    expect(dossierSnapshot.assessmentBatch).toBeNull();
    expect(dossierState.dossiers).toHaveLength(1);
    expect(dossierState.dossiers[0]).toMatchObject({
      requestId: dossierRequest?.requestId,
      status: "completed",
      identitySnapshotId: ccpaMatch.identitySnapshotId,
      sourceIds: ["reviewed:ccpa-statute-ab375"],
      whatHappened: {
        sourceIds: ["reviewed:ccpa-statute-ab375"],
        uncertainty: expect.stringMatching(/fixed fallback/i),
      },
      unresolvedFacts: expect.arrayContaining([
        expect.stringMatching(/evidence gap/i),
      ]),
    });
  });

  it("records a failed researcher URL route and exclusion without treating the URL as evidence", async () => {
    const unsupportedUrl =
      "https://official.lakeview.gov.example.org/algorithmic-rights-data";
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        if (url.toString() === unsupportedUrl) {
          return new Response(JSON.stringify({ title: "not an identity page" }), {
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-source-open",
    );
    const initial = workflowSnapshot(opened);

    harness.setNow("2026-08-10T18:04:30.000Z");
    const revised = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-revise-with-failed-url",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "audit-revise-anchor",
        payload: {
          fields: {
            shockName: "Lakeview Algorithmic Rights Act",
            jurisdiction: "United States",
            issuingAuthority: "Lakeview Legislature",
            approximateYear: "2024",
            versionType: "original",
            distinguishingFeature: "Rights governing automated decisions",
            sourceLocator: unsupportedUrl,
            clarification: "Inspect this supplied official URL.",
          },
          reason: "The researcher supplied a possible official identity page.",
        },
      },
    );
    expect(
      revised.result?.isError,
      JSON.stringify(revised.result?.content),
    ).not.toBe(true);
    const snapshot = workflowSnapshot(revised);
    const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    expect(state.sources.some((source) => source.locator === unsupportedUrl)).toBe(
      false,
    );
    const activeSet = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    );
    expect(activeSet?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "researcher-provided-url",
          status: "failed",
          note: "The researcher URL returned an unsupported content type.",
        }),
      ]),
    );
    expect(activeSet?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: unsupportedUrl,
          returnedRecordIds: [],
        }),
      ]),
    );
    expect(activeSet?.manifest.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "The researcher URL returned an unsupported content type.",
        }),
      ]),
    );
  });

  it("uses an uploaded PDF filename only as provisional identity metadata and discloses that text was not extracted", async () => {
    const documentUrl =
      "https://files.openai.example.org/download?file_id=file_lakeview_act";
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        if (url.toString() === documentUrl) {
          return new Response("%PDF-1.7 bounded fixture", {
            headers: {
              "content-type": "application/pdf",
              "content-disposition":
                'attachment; filename="Lakeview_Algorithmic_Rights_Act.pdf"',
            },
          });
        }
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-route-open",
    );
    const initial = workflowSnapshot(opened);

    harness.setNow("2026-08-10T18:04:45.000Z");
    const revised = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-audit-revise-with-uploaded-pdf",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "audit-revise-anchor",
        payload: {
          fields: {
            shockName: "Lakeview Algorithmic Rights Act",
            jurisdiction: "United States",
            issuingAuthority: "Lakeview Legislature",
            approximateYear: "2024",
            versionType: "original",
            distinguishingFeature: "Researcher-uploaded official PDF",
            sourceLocator: documentUrl,
            clarification: "Use the uploaded document as an identity lead.",
          },
          reason: "Inspect the researcher-uploaded PDF as provisional identity material.",
        },
      },
    );
    expect(
      revised.result?.isError,
      JSON.stringify(revised.result?.content),
    ).not.toBe(true);
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(revised),
    );
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    const source = state.sources.find((item) =>
      item.title === "Lakeview Algorithmic Rights Act" &&
      item.channel === "researcher-provided-url"
    );
    expect(source).toMatchObject({
      title: "Lakeview Algorithmic Rights Act",
      locator: "https://files.openai.example.org/download",
      channel: "researcher-provided-url",
      userProvided: true,
    });
    expect(source).not.toHaveProperty("evidenceText");
    const match = state.possibleMatches.find((item) =>
      item.sourceIds.includes(source?.id ?? ""),
    );
    expect(match).toMatchObject({
      relationship: "exact",
      limitations: expect.arrayContaining([
        expect.stringContaining("No document text was extracted"),
      ]),
    });
    const activeSet = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    );
    expect(activeSet?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "researcher-provided-url",
          status: "searched",
          note: expect.stringContaining("no document text was extracted"),
        }),
      ]),
    );
    expect(activeSet?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: "https://files.openai.example.org/download",
        }),
      ]),
    );
  });

  it("does not consult legacy assessment signing material on the deterministic route", async () => {
    const harness = productionHarness({
      SCREEN02_WORKFLOW_SIGNING_KEY_ID: "invalid signing key id",
      SCREEN02_WORKFLOW_SIGNING_KEY: "x".repeat(64),
    });
    const opened = await harness.callTool("open_shockaudit_screen_2", {
      studyContext: confirmedWorkflowFindContext(),
      workflowVersion: "2.1",
    });
    const initial = workflowSnapshot(opened);
    const searched = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-invalid-signing-find-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const snapshot = workflowSnapshot(searched);
    const state = stateFromScreen02WorkflowClientSnapshot(snapshot);

    expect(searched.result?.isError).not.toBe(true);
    expect(snapshot.assessmentAvailable).toBe(false);
    expect(snapshot.assessmentBatch).toBeNull();
    expect(searched.result?.structuredContent).toMatchObject({
      assessmentAvailable: false,
      preparedRequestCount: 0,
    });
    expect(state.mode).toBe("find");
    if (state.mode !== "find") throw new Error("Expected Find state.");
    // The legacy reviewed registry now uses the same retained-passage gates
    // as every other lane, so an offline deterministic search may validly be
    // empty. This regression is about signing-material independence.
    expect(state.candidates).toEqual([]);
    expect(state.assessmentRequests).toEqual([]);
  });

  it("commits one exact-CAS Find search and rejects wrong-token and stale forks", async () => {
    const harness = productionHarness();
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext(),
      "mcp-find-cas-open",
    );
    const initial = workflowSnapshot(opened);
    harness.setNow("2026-08-10T18:01:00.000Z");
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-search-1",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: {
          criteria: [
            {
              kind: "only-include",
              text: "Candidate has a binding public source record",
            },
          ],
        },
      },
    );
    expect(
      plannedMutation.result?.isError,
      JSON.stringify(plannedMutation.result?.content),
    ).not.toBe(true);
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-search-1-fixed-plan",
    );
    const successor = workflowSnapshot(mutation);
    const summary = mutation.result
      ?.structuredContent as Screen02WorkflowSummary;
    expectPrivateSnapshotBoundary(mutation, successor);
    expect(summary).toMatchObject({
      ok: true,
      outcome: "applied",
      mode: "find",
      assessmentAvailable: false,
      preparedRequestCount: 0,
    });
    expect(successor.revision).toBeGreaterThan(initial.revision);
    expect(successor.assessmentAvailable).toBe(false);
    expect(successor.assessmentBatch).toBeNull();
    const successorState = stateFromScreen02WorkflowClientSnapshot(successor);
    expect(successorState.mode).toBe("find");
    if (successorState.mode !== "find") throw new Error("Expected Find state.");
    expect(successorState.candidates).toEqual([]);
    expect(successorState.assessmentRequests).toEqual([]);
    expect(
      successorState.candidates.every(
        (candidate) => candidate.qualification !== undefined,
      ),
    ).toBe(true);

    const wrongToken = `${successor.accessToken.slice(0, -1)}${
      successor.accessToken.endsWith("A") ? "B" : "A"
    }`;
    const rejected = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-wrong-token",
        runId: successor.runId,
        accessToken: wrongToken,
        expectedRevision: successor.revision,
        expectedStateFingerprint: successor.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    expect(rejected.result?.isError).toBe(true);
    expect(rejected.result?.content?.[0]?.text).toMatch(
      /unavailable or expired/i,
    );

    harness.setNow("2026-08-10T18:02:00.000Z");
    const stale = await harness.callTool("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1",
      operationId: "mcp-stale-find-search",
      runId: initial.runId,
      accessToken: initial.accessToken,
      expectedRevision: initial.revision,
      expectedStateFingerprint: initial.stateFingerprint,
      action: "find-search",
      payload: { criteria: [] },
    });
    expect(stale.result?.isError).not.toBe(true);
    const staleSummary = stale.result
      ?.structuredContent as Screen02WorkflowSummary;
    const staleSnapshot = workflowSnapshot(stale);
    expect(staleSummary).toMatchObject({
      ok: false,
      outcome: "conflict",
    });
    expect(staleSnapshot.revision).toBe(successor.revision);
    expect(staleSnapshot.stateFingerprint).toBe(successor.stateFingerprint);
    const stored = await harness.store.read({
      runId: successor.runId,
      accessToken: successor.accessToken,
    });
    expect(stored).toMatchObject({
      outcome: "authenticated",
      record: {
        generation: 1,
        stateRevision: successor.revision,
        stateFingerprint: successor.stateFingerprint,
      },
    });
  });

  it("routes canonical Find search through the official connector and persists its proposal and manifest", async () => {
    const connectorRequests: URL[] = [];
    const connectorTitle =
      "Public Technology Privacy and Innovation Safeguards Rule";
    const documentNumber = "2019-connector-reachability";
    const isNativeQueryRequest = (url: URL) =>
      `${url.origin}${url.pathname}` === FEDERAL_REGISTER_API_ENDPOINT;
    const isFtcRecoveryRequest = (url: URL) =>
      `${url.origin}${url.pathname}` === FTC_PRESS_RELEASES_ENDPOINT;
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        connectorRequests.push(url);
        if (!isNativeQueryRequest(url)) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                title: connectorTitle,
                type: "Rule",
                abstract:
                  "The Public Technology Privacy and Innovation Safeguards Rule requires publicly listed technology firms in the United States to implement product-data safeguards and documented engineering duties relevant to innovation research.",
                document_number: documentNumber,
                publication_date: "2019-07-15",
                effective_on: "2019-09-01",
                html_url: `https://www.federalregister.gov/d/${documentNumber}`,
                agencies: [{ name: "Connector Reachability Agency" }],
              },
            ],
          }),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
            },
          },
        );
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext(),
      "mcp-find-assessment-open",
    );
    const initial = workflowSnapshot(opened);

    harness.setNow("2026-08-10T18:03:00.000Z");
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-official-connector-reachability",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );

    expect(
      plannedMutation.result?.isError,
      JSON.stringify(plannedMutation.result?.content),
    ).not.toBe(true);
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-official-connector-reachability-fixed-plan",
    );
    const nativeQueryRequests = connectorRequests.filter(isNativeQueryRequest);
    expect(nativeQueryRequests).toHaveLength(
      SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
    );
    const requestUrl = nativeQueryRequests[0]!;
    expect(requestUrl.searchParams.get("conditions[term]")).toBe(
      "Technology",
    );
    expect(
      requestUrl.searchParams.get("conditions[publication_date][gte]"),
    ).toBe("2016-01-01");
    expect(
      requestUrl.searchParams.get("conditions[publication_date][lte]"),
    ).toBe("2020-12-31");
    expect(requestUrl.searchParams.get("order")).toBe("relevance");
    expect(requestUrl.searchParams.get("per_page")).toBe("5");
    expect(
      requestUrl.searchParams.getAll("conditions[type][]"),
    ).toEqual(["RULE", "PRORULE", "NOTICE"]);
    expect(requestUrl.searchParams.getAll("fields[]")).toEqual(
      FEDERAL_REGISTER_RESPONSE_FIELDS,
    );

    const successor = workflowSnapshot(mutation);
    const state = stateFromScreen02WorkflowClientSnapshot(successor);
    expect(state.mode).toBe("find");
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const connectorCandidate = state.candidates.find(
      (candidate) => candidate.identity.canonicalTitle === connectorTitle,
    );
    expect(connectorCandidate).toMatchObject({
      origin: "newly-discovered",
      identity: {
        canonicalTitle: connectorTitle,
        formalIdentifier: documentNumber,
        issuer: "Connector Reachability Agency",
        issuingJurisdiction: "United States",
        eventType: "Regulation",
        status: "Rule",
      },
    });
    expect(connectorCandidate?.sourceIds).toHaveLength(1);
    expect(
      state.assessmentRequests.some(
        (request) =>
          request.target.mode === "find-candidate" &&
          request.target.candidateSnapshotId ===
            connectorCandidate?.candidateSnapshotId,
      ),
    ).toBe(false);
    expect(connectorCandidate?.qualification).toMatchObject({
      eligible: true,
      substantiveOverview: { passed: true },
    });
    const connectorSource = state.sources.find(
      (source) => source.id === connectorCandidate?.sourceIds[0],
    );
    expect(connectorSource).toMatchObject({
      title: connectorTitle,
      publisher: "Connector Reachability Agency",
      channel:
        "Federal Register API v1 · rules, proposed rules, and notices",
      userProvided: false,
    });

    const activeSet = state.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
    );
    expect(activeSet).toBeDefined();
    expect(activeSet?.candidateSnapshotIds).toContain(
      connectorCandidate?.candidateSnapshotId,
    );
    const connectorQuery = activeSet?.manifest.queryMatrix.find(
      (query) => query.returnedRecordIds.includes(documentNumber),
    );
    expect(connectorQuery).toMatchObject({
      query: requestUrl.toString(),
      returnedRecordIds: [documentNumber],
    });
    expect(connectorQuery?.purpose).toContain(
      "confirmed industry phrase: Technology",
    );
    expect(activeSet?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "federal-register-api-v1 diagnostics",
          status: "searched",
          retrievedAt: "2026-08-10T18:03:00.000Z",
          note: expect.stringContaining("accepted: 16"),
        }),
        expect.objectContaining({
          channel: expect.stringContaining("exact retrieval funnel"),
          // One qualified result does not satisfy the ten-candidate target;
          // exhausting the bounded query budget is recorded as reduced recall.
          status: "failed",
          note: expect.stringContaining(
            "retained 1 unique raw event leads after common semantic deduplication",
          ),
        }),
      ]),
    );
    expect(activeSet?.manifest.stoppingRule).toMatchObject({
      status: "met",
      rule: expect.stringContaining(
        "qualified candidates",
      ),
      note: expect.stringContaining(
        "bounded search, not a claim that all possible shocks were found",
      ),
    });
    expect(activeSet?.manifest.outcomeValuesInspected).toBe(false);
    const firstRoundSubstantiveRequestCount = connectorRequests.filter(
      (url) => !isNativeQueryRequest(url) && !isFtcRecoveryRequest(url),
    ).length;
    expect(connectorRequests.filter(isFtcRecoveryRequest)).toHaveLength(1);
    const firstRoundSubstantiveChannel = activeSet?.manifest.channels.find(
      (channel) =>
        channel.channel === "Bounded substantive-information retrieval ladder",
    );
    expect(firstRoundSubstantiveChannel).toBeDefined();
    const firstRoundSubstantiveBudget = firstRoundSubstantiveChannel?.note.match(
      /attempted (\d+)\/(\d+) bounded documents/iu,
    );
    expect(firstRoundSubstantiveBudget).not.toBeNull();
    const firstRoundSubstantiveAttempts = Number(
      firstRoundSubstantiveBudget?.[1],
    );
    const firstRoundSubstantiveLimit = Number(
      firstRoundSubstantiveBudget?.[2],
    );
    expect(firstRoundSubstantiveAttempts).toBeLessThanOrEqual(
      firstRoundSubstantiveLimit,
    );
    expect(firstRoundSubstantiveRequestCount).toBe(
      firstRoundSubstantiveAttempts,
    );

    harness.setNow("2026-08-10T18:04:00.000Z");
    const differentPlannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-official-connector-different",
        runId: successor.runId,
        accessToken: successor.accessToken,
        expectedRevision: successor.revision,
        expectedStateFingerprint: successor.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );

    expect(
      differentPlannedMutation.result?.isError,
      JSON.stringify(differentPlannedMutation.result?.content),
    ).not.toBe(true);
    const differentMutation = await rejectFindPlannerAndDiscover(
      harness,
      differentPlannedMutation,
      "mcp-find-official-connector-different-fixed-plan",
    );
    const differentSnapshot = workflowSnapshot(differentMutation);
    const differentState = stateFromScreen02WorkflowClientSnapshot(
      differentSnapshot,
    );
    expect(differentState.mode).toBe("find");
    if (differentState.mode !== "find") throw new Error("Expected Find state.");
    const differentSet = differentState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        differentState.activeCandidateSetSnapshotId,
    );
    const allNativeQueryRequests = connectorRequests.filter(
      isNativeQueryRequest,
    );
    expect(allNativeQueryRequests).toHaveLength(
      SCREEN02_NATIVE_QUERY_MAX_VARIANTS * 2,
    );
    const substantiveDocumentRequests = connectorRequests.filter(
      (url) => !isNativeQueryRequest(url) && !isFtcRecoveryRequest(url),
    );
    const allFtcRecoveryRequests = connectorRequests.filter(
      isFtcRecoveryRequest,
    );
    expect(allFtcRecoveryRequests).toHaveLength(2);
    const substantiveRetrievalChannel = differentSet?.manifest.channels.find(
      (channel) =>
        channel.channel === "Bounded substantive-information retrieval ladder",
    );
    expect(substantiveRetrievalChannel).toBeDefined();
    const substantiveBudget = substantiveRetrievalChannel?.note.match(
      /attempted (\d+)\/(\d+) bounded documents/iu,
    );
    expect(substantiveBudget).not.toBeNull();
    const substantiveAttempts = Number(substantiveBudget?.[1]);
    const substantiveAttemptLimit = Number(substantiveBudget?.[2]);
    expect(substantiveAttempts).toBeLessThanOrEqual(
      substantiveAttemptLimit,
    );
    expect(
      substantiveDocumentRequests.length - firstRoundSubstantiveRequestCount,
    ).toBe(substantiveAttempts);
    expect(connectorRequests).toHaveLength(
      allNativeQueryRequests.length + allFtcRecoveryRequests.length +
        substantiveDocumentRequests.length,
    );
    expect(differentSet?.candidateSnapshotIds).not.toContain(
      connectorCandidate?.candidateSnapshotId,
    );
    expect(
      differentSet?.candidateSnapshotIds.some((candidateSnapshotId) =>
        state.candidates.some(
          (candidate) =>
            candidate.candidateSnapshotId === candidateSnapshotId,
        ),
      ),
    ).toBe(false);
    expect(differentState.discoveryRequests.at(-1)?.status).toBe(
      "completed-empty",
    );
    expect(differentSet?.manifest.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: expect.stringMatching(/already shown in a prior Find round/i),
        }),
      ]),
    );
    expect(differentSet?.manifest.stoppingRule).toMatchObject({
      status: "met",
      note: expect.stringMatching(
        /returned title.*qualified candidate/i,
      ),
    });
  });

  it("fills the canonical Find comparison to ten without notice-page crowd-out", async () => {
    const titles = [
      "Digital Privacy Rights Rule",
      "Cybersecurity Incident Reporting Standard",
      "Cross-Border Data Transfer Controls",
      "Algorithmic Accountability Requirements",
      "Online Platform Portability Rule",
      "Connected Device Security Rule",
      "Biometric Consent Safeguards",
      "Cloud Service Resilience Standard",
      "Automated Decision Transparency Rule",
      "Consumer Data Deletion Rule",
      "Critical Technology Export Controls",
      "Electronic Records Accessibility Standard",
    ];
    const connectorRequests: URL[] = [];
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        connectorRequests.push(url);
        const returnedTitles = connectorRequests.length === 1
          ? titles.slice(0, 8)
          : titles.slice(5);
        return new Response(
          JSON.stringify({
            count: titles.length,
            results: returnedTitles.map((title) => {
              const index = titles.indexOf(title);
              return {
              title,
              type: "Rule",
              abstract:
                `${title} establishes a distinct binding technology-sector requirement for covered organizations.`,
              document_number: `2019-ten-candidate-${index + 1}`,
              publication_date:
                `2019-${String((index % 12) + 1).padStart(2, "0")}-15`,
              effective_on:
                `2019-${String((index % 12) + 1).padStart(2, "0")}-20`,
              html_url:
                `https://www.federalregister.gov/d/2019-ten-candidate-${index + 1}`,
              agencies: [{ name: `Technology Agency ${index + 1}` }],
              };
            }),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext(),
      "mcp-find-ten-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-ten-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-ten-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );

    const nativeQueryRequests = connectorRequests.filter(
      (request) => request.pathname === "/api/v1/documents.json",
    );
    expect(nativeQueryRequests).toHaveLength(
      SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
    );
    expect(
      nativeQueryRequests[0]!.searchParams.getAll("conditions[type][]"),
    ).toEqual(["RULE", "PRORULE", "NOTICE"]);
    expect(
      nativeQueryRequests[0]!.searchParams.getAll("fields[]"),
    ).toEqual(FEDERAL_REGISTER_RESPONSE_FIELDS);
    expect(state.mode).toBe("find");
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const activeSet = state.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
    );
    expect(activeSet?.candidateSnapshotIds).toHaveLength(10);
    expect(state.candidates).toHaveLength(10);
  });

  it("uses the bounded full-authoritative-document ladder before admitting a sparse record", async () => {
    const requests: URL[] = [];
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requests.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Video Game Platform Accessibility Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-06.",
                document_number: "2019-12345",
                publication_date: "2019-06-06",
                pdf_url:
                  "https://www.govinfo.gov/content/pkg/FR-2019-06-06/pdf/2019-12345.pdf",
                html_url:
                  "https://www.federalregister.gov/d/2019-12345",
                agencies: [{ name: "Digital Accessibility Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.pathname === "/d/2019-12345") {
          return new Response(
            "<!doctype html><html><head><title>Video Game Platform Accessibility Rule</title></head><body><main><h1>Video Game Platform Accessibility Rule</h1><h2>AGENCY:</h2><p>Digital Accessibility Agency.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: 2019-12345.</p><p>The final rule applies throughout the United States to U.S. publicly listed video gaming firms, including covered video game publishers and online game platforms.</p><p>It requires those firms to change accessibility procedures for digital products and services beginning in 2019.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        if (url.hostname === "www.govinfo.gov") {
          return new Response("%PDF-1.7 bounded fixture", {
            headers: { "content-type": "application/pdf" },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-sparse-overview-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-sparse-overview-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-sparse-overview-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const candidate = state.candidates.find(
      (item) => item.candidateId === "fr-2019-12345",
    );
    const activeSet = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    expect(requests.some((url) =>
      url.pathname === "/d/2019-12345"
    )).toBe(true);
    expect(requests.some((url) => url.hostname === "www.govinfo.gov")).toBe(
      false,
    );
    expect(candidate?.qualification?.substantiveOverview).toMatchObject({
      passed: true,
      whatChanged: expect.stringMatching(/accessibility procedures/i),
      whoMayBeAffected: expect.stringMatching(/video game publishers/i),
      importantTiming: expect.stringMatching(/beginning in 2019/i),
    });
    expect(candidate?.sourceIds).toEqual(
      expect.arrayContaining([
        "fr-source-2019-12345",
        "fr-source-html-2019-12345",
      ]),
    );
    expect(state.sources).toContainEqual(
      expect.objectContaining({
        locator: "https://www.federalregister.gov/d/2019-12345",
        evidenceText: expect.stringMatching(/accessibility procedures/i),
      }),
    );
    expect(activeSet?.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining(
          "substantive-overview:full-official-document",
        ),
        returnedRecordIds: ["fr-2019-12345"],
      }),
    );
  });

  it("binds a legitimate canonical redirect to a content-addressed final source", async () => {
    const requests: URL[] = [];
    const initialLocator =
      "https://www.federalregister.gov/d/2019-12346";
    const finalLocator =
      "https://www.federalregister.gov/documents/2019/06/06/2019-12346/video-game-platform-accessibility-rule";
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requests.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Video Game Platform Accessibility Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-06.",
                document_number: "2019-12346",
                publication_date: "2019-06-06",
                html_url: initialLocator,
                agencies: [{ name: "Digital Accessibility Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.toString() === initialLocator) {
          return new Response(null, {
            status: 302,
            headers: { location: finalLocator },
          });
        }
        if (url.toString() === finalLocator) {
          return new Response(
            "<!doctype html><html><head><title>Video Game Platform Accessibility Rule</title></head><body><main><h1>Video Game Platform Accessibility Rule</h1><h2>AGENCY:</h2><p>Digital Accessibility Agency.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: 2019-12346.</p><p>The final rule requires U.S. publicly listed video gaming firms, including covered video game publishers and online game platforms, to change accessibility procedures for digital products and services beginning in 2019.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-canonical-redirect-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-canonical-redirect-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-canonical-redirect-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const candidate = state.candidates.find(
      (item) => item.candidateId === "fr-2019-12346",
    );
    const finalSource = state.sources.find(
      (source) => source.locator === finalLocator,
    );
    const initialSource = state.sources.find(
      (source) => source.locator === initialLocator,
    );
    expect(requests.map((url) => url.toString())).toEqual(
      expect.arrayContaining([initialLocator, finalLocator]),
    );
    expect(candidate?.qualification?.substantiveOverview.passed).toBe(true);
    expect(finalSource).toMatchObject({
      id: expect.stringContaining("official-document-"),
      locator: finalLocator,
      channel: "official-document-redirect-verified",
      evidenceText: expect.stringMatching(/accessibility procedures/i),
    });
    expect(candidate?.sourceIds).toContain(finalSource?.id);
    expect(initialSource?.evidenceText).not.toMatch(/accessibility procedures/i);
  });

  it("rejects unrelated response bytes returned from the proposal's own URL", async () => {
    const locator =
      "https://www.federalregister.gov/d/rule-no-12345-video-game";
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Video Game Platform Accessibility Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-06.",
                document_number: "Rule No. 12345",
                publication_date: "2019-06-06",
                html_url: locator,
                agencies: [{ name: "Digital Accessibility Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.toString() === locator) {
          return new Response(
            "<!doctype html><html><head><title>Unrelated Hospital Reporting Rule</title></head><body><main><h1>Unrelated Hospital Reporting Rule</h1><p>Rule No. 12345 and the Video Game Platform Accessibility Rule are cited only for comparison. This separate final rule requires video game publishers to change accessibility procedures beginning in 2019.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-same-url-wrong-body-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-same-url-wrong-body-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-same-url-wrong-body-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");

    expect(state.candidates.some(
      (candidate) => candidate.candidateId === "fr-rule-no-12345",
    )).toBe(false);
    expect(state.sources.some((source) =>
      source.locator === locator &&
      /accessibility procedures/i.test(source.evidenceText ?? "")
    )).toBe(false);
  });

  it.each([
    ["unrelated title", "Unrelated Hospital Reporting Rule"],
    [
      "distinct title containing the candidate title",
      "Repeal of Video Game Platform Accessibility Rule",
    ],
  ])("rejects an official redirect with a distinct final identity: %s", async (
    _case,
    finalTitle,
  ) => {
    const initialLocator =
      "https://www.federalregister.gov/d/2019-record-a-video-game";
    const unrelatedLocator =
      "https://www.federalregister.gov/d/2019-record-b-healthcare";
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Video Game Platform Accessibility Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-06.",
                document_number: "2019-record-a-video-game",
                publication_date: "2019-06-06",
                html_url: initialLocator,
                agencies: [{ name: "Digital Accessibility Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.toString() === initialLocator) {
          return new Response(null, {
            status: 302,
            headers: { location: unrelatedLocator },
          });
        }
        if (url.toString() === unrelatedLocator) {
          return new Response(
            `<!doctype html><html><head><title>${finalTitle}</title></head><body><main><h1>${finalTitle}</h1><p>The Video Game Platform Accessibility Rule is mentioned only as a comparison. This separate final rule requires covered video game publishers and online game platforms to change accessibility procedures for digital products and services beginning in 2019.</p></main></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-cross-record-redirect-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-cross-record-redirect-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-cross-record-redirect-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");

    expect(state.candidates.some(
      (item) => item.candidateId === "fr-2019-record-a-video-game",
    )).toBe(false);
    expect(state.sources.some((source) =>
      source.locator === initialLocator &&
      /accessibility procedures/i.test(source.evidenceText ?? "")
    )).toBe(false);
    expect(state.sources.some((source) =>
      source.locator === unrelatedLocator
    )).toBe(false);
    const manifest = state.candidateSets.at(-1)!.manifest;
    expect(manifest.channels.find((channel) => channel.channel === "Bounded substantive-information retrieval ladder")?.note).toContain("Document failures:");
    expect(manifest.exclusions.some((entry) => entry.reason.includes("Document failures:"))).toBe(true);
  });

  it("uses an allowlisted Level 3 official explainer only after the full authoritative page remains sparse", async () => {
    const requests: URL[] = [];
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requests.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Video Game Accessibility Implementation Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-06.",
                document_number: "2019-12347",
                publication_date: "2019-06-06",
                html_url:
                  "https://www.federalregister.gov/d/2019-12347",
                agencies: [{ name: "Digital Accessibility Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (
          url.pathname === "/d/2019-12347" &&
          !url.searchParams.has("faq")
        ) {
          return new Response(
            "<!doctype html><html><head><title>Video Game Accessibility Implementation Rule</title></head><body><h1>Video Game Accessibility Implementation Rule</h1><h2>AGENCY:</h2><p>Digital Accessibility Agency.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: 2019-12347.</p><p>See the linked material.</p><a href=\"/d/2019-12347?faq=implementation\">Official implementation FAQ</a></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        if (
          url.pathname === "/d/2019-12347" &&
          url.searchParams.get("faq") === "implementation"
        ) {
          return new Response(
            "<!doctype html><html><head><title>Video Game Accessibility Implementation Rule</title></head><body><main><h1>Video Game Accessibility Implementation Rule</h1><p>Digital Accessibility Agency implementation FAQ.</p><p>Document Number: 2019-12347.</p><p>The final rule applies throughout the United States to U.S. publicly listed video gaming firms, including covered video game publishers and online game platforms.</p><p>It requires those firms to change digital-product accessibility testing and user-support procedures beginning in 2019.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-level3-overview-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-level3-overview-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-level3-overview-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const candidate = state.candidates.find(
      (item) => item.candidateId === "fr-2019-12347",
    );
    const activeSet = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    expect(requests.findIndex((url) =>
      url.pathname === "/d/2019-12347" && !url.searchParams.has("faq")
    )).toBeLessThan(requests.findIndex((url) =>
      url.pathname === "/d/2019-12347" &&
      url.searchParams.get("faq") === "implementation"
    ));
    expect(candidate?.qualification?.substantiveOverview).toMatchObject({
      passed: true,
      whatChanged: expect.stringMatching(/accessibility testing/i),
      whoMayBeAffected: expect.stringMatching(/video game publishers/i),
    });
    expect(candidate?.sourceIds).toEqual(
      expect.arrayContaining([
        expect.stringContaining("official-explainer"),
      ]),
    );
    expect(state.sources).toContainEqual(
      expect.objectContaining({
        locator:
          "https://www.federalregister.gov/d/2019-12347",
        authorityTier: 2,
        channel: "official-explanatory-material",
        evidenceText: expect.stringMatching(/accessibility testing/i),
      }),
    );
    expect(activeSet?.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining(
          "substantive-overview:official-explanatory-material",
        ),
        returnedRecordIds: ["fr-2019-12347"],
      }),
    );
  }, 30_000);

  it("keeps Level 4 contextual orientation out of qualification and Screen 3 evidence inputs", async () => {
    const officialTitle = "Video Game Sparse Coverage Notice";
    const contextId = "context-video-game-sparse-coverage";
    const provider: Screen02ContextSearchProvider = async (input) => {
      const lead = contextualFindLead(input.retrievedAt, contextId);
      return [{
        recordId: contextId,
        canonicalIdentity: `Independent context on ${officialTitle}`,
        issuingJurisdiction: "United States",
        locator: "https://www.reuters.com/legal/video-game-sparse-coverage",
        value: {
          ...lead,
          title: officialTitle,
          event: {
            ...lead.event,
            displayName: officialTitle,
          },
          sources: lead.sources.map((source) => ({
            ...source,
            title: "Reuters legal context",
            locator:
              "https://www.reuters.com/legal/video-game-sparse-coverage",
            publisher: "Reuters",
          })),
        },
      }];
    };
    const requests: URL[] = [];
    const harness = productionHarness({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requests.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: officialTitle,
                type: "Notice",
                abstract:
                  "Notice published in the Federal Register on 2019-06-06.",
                document_number: "2019-context-only-video-game",
                publication_date: "2019-06-06",
                html_url:
                  "https://www.federalregister.gov/d/2019-context-only-video-game",
                agencies: [{ name: "Digital Services Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.pathname === "/d/2019-context-only-video-game") {
          return new Response(
            "<!doctype html><html><body><p>Official publication metadata only.</p></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        if (
          url.hostname === "www.reuters.com" &&
          url.pathname === "/legal/video-game-sparse-coverage"
        ) {
          return new Response(
            "<!doctype html><html><body><main><p>A Reuters report says the notice may require some digital game providers to change consumer-support procedures, but the official record available to ShockAudit does not establish the covered population.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-level4-context-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-level4-context-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-level4-context-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const activeSet = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    const exclusion = activeSet?.manifest.exclusions.find(
      (entry) => entry.recordId === "fr-2019-context-only-video-game",
    );

    expect(requests.some((url) =>
      url.hostname === "www.reuters.com" &&
      url.pathname === "/legal/video-game-sparse-coverage"
    )).toBe(true);
    expect(
      state.candidates.some((candidate) =>
        candidate.candidateId === "fr-2019-context-only-video-game"
      ),
    ).toBe(false);
    expect(exclusion?.qualification).toMatchObject({
      eligible: false,
      hardScope: { disposition: "insufficient-evidence" },
      exclusionCodes: expect.arrayContaining([
        "excluded-insufficient-substantive-information",
      ]),
    });
    expect(exclusion?.reason).toMatch(
      /Level 4 high-quality context.*did not qualify.*will not enter Screen 3 evidence/is,
    );
    expect(activeSet?.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining(
          "substantive-overview:contextual-orientation",
        ),
        returnedRecordIds: ["fr-2019-context-only-video-game"],
      }),
    );
    expect(activeSet?.manifest.contextLeads).toContainEqual(
      expect.objectContaining({
        id: contextId,
        locator: "https://www.reuters.com/legal/video-game-sparse-coverage",
        sourceRole: "contextual-secondary",
      }),
    );
    expect(state.sources.some((source) =>
      source.locator ===
        "https://www.reuters.com/legal/video-game-sparse-coverage"
    )).toBe(false);
  });

  it("rejects a sparse VRS body without its own Federal Register identity marker", async () => {
    const requests: URL[] = [];
    const harness = productionHarness({
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requests.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title:
                  "Improving Video Relay Service and Direct Video Calling",
                type: "Proposed Rule",
                abstract:
                  "Proposed Rule published in the Federal Register on 2019-06-06.",
                document_number: "2019-11744",
                publication_date: "2019-06-06",
                html_url: "https://www.federalregister.gov/d/2019-11744",
                agencies: [{ name: "Federal Communications Commission" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.pathname === "/d/2019-11744") {
          return new Response(
            `<!doctype html><html><head><title>Improving Video Relay Service and Direct Video Calling</title><meta name="description" content="FCC 19-39 proposes permanently permitting communications assistants to handle Video Relay Service calls at home."></head><body><h1>Improving Video Relay Service and Direct Video Calling</h1><p>The proposal would allow up to two weeks of service for new or porting users while database registration is verified, with compensation only after verification.</p><p>It also proposes login and authentication procedures for enterprise and public videophones to improve VRS and guard against waste, fraud, and abuse.</p><p>The proposed rule was published on 2019-06-06. Comments were due 2019-08-05 and replies were due 2019-09-04.</p></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext("Video gaming", {
        eventDescriptor: "regulatory shock",
        studyPeriod: "2014–2022",
      }),
      "mcp-find-vrs-full-document-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-vrs-full-document-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-vrs-full-document-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const activeSet = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    const exclusion = activeSet?.manifest.exclusions.find(
      (entry) => entry.recordId === "fr-2019-11744",
    );

    expect(requests.some((url) => url.pathname === "/d/2019-11744")).toBe(true);
    expect(
      state.candidates.some(
        (candidate) => candidate.candidateId === "fr-2019-11744",
      ),
    ).toBe(false);
    expect(exclusion?.qualification).toMatchObject({
      classification: "mismatch",
      eligible: false,
      hardScope: { disposition: "insufficient-evidence" },
      outcomeFit: { status: "not-evaluated" },
      exclusionCodes: expect.arrayContaining([
        "industry-mismatch",
        "excluded-insufficient-substantive-information",
      ]),
      substantiveOverview: {
        identity: false,
        // The response omits an `FR Doc. 2019-11744` marker. The same official
        // URL cannot bind its bytes to this proposal, so body-only facts and
        // ungrounded API identity metadata both fail closed.
        change: false,
        affectedPopulation: false,
        materialDate: false,
        passed: false,
        evidenceSourceIds: [],
        whatTheShockIs: expect.stringContaining(
          "Improving Video Relay Service and Direct Video Calling",
        ),
        whatChanged: "",
        whoMayBeAffected: "",
        importantTiming: "",
        whyItMayMatterForStudy: expect.stringMatching(
          /Preliminary research-design hypothesis/i,
        ),
        mainUncertainty: expect.any(String),
        explanation: expect.stringContaining(
          "lacks enough substantive source information",
        ),
      },
    });
    expect(activeSet?.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining(
          "substantive-overview:full-official-document",
        ),
        returnedRecordIds: [],
      }),
    );
  });

  it("persists exact manufacturing and video-gaming qualification scores and exclusions from the same mixed records", async () => {
    const mixedResults = [
      {
        title: "Manufacturing Facility Product-Safety Rule",
        type: "Rule",
        abstract:
          "The final rule requires public manufacturing firms and covered manufacturers to change product-safety controls at production facilities beginning in 2019.",
        document_number: "2019-manufacturing-scope",
        publication_date: "2019-03-15",
        html_url:
          "https://www.federalregister.gov/d/2019-manufacturing-scope",
        agencies: [{ name: "Manufacturing Standards Agency" }],
      },
      {
        title: "Video Game Platform Consumer-Protection Rule",
        type: "Rule",
        abstract:
          "The final rule requires video game publishers and online game platforms to change account and product disclosures for users beginning in 2019.",
        document_number: "2019-video-gaming-scope",
        publication_date: "2019-04-15",
        html_url:
          "https://www.federalregister.gov/d/2019-video-gaming-scope",
        agencies: [{ name: "Interactive Entertainment Agency" }],
      },
      {
        title: "Improving Video Relay Service and Direct Video Calling",
        type: "Proposed Rule",
        abstract:
          "Improving Video Relay Service and Direct Video Calling (FCC 19-39) would permanently permit communications assistants to handle Video Relay Service calls at home and establish login and authentication procedures for enterprise and public videophones to guard against waste, fraud, and abuse. The proposed measure applies to Video Relay Service providers and new or porting users while database registration is verified, allowing up to two weeks of service with compensation only after verification.",
        document_number: "2019-11744",
        publication_date: "2019-06-06",
        html_url: "https://www.federalregister.gov/d/2019-11744",
        agencies: [{ name: "Federal Communications Commission" }],
      },
      {
        title: "Cross-Industry Corporate Disclosure Rule",
        type: "Rule",
        abstract:
          "The final rule requires qualifying public companies and covered businesses across industries to change organization-level disclosures beginning in 2019.",
        document_number: "2019-cross-industry",
        publication_date: "2019-08-15",
        html_url:
          "https://www.federalregister.gov/d/2019-cross-industry",
        agencies: [{ name: "Corporate Disclosure Agency" }],
      },
      {
        title: "Migratory Wildlife Habitat Conservation Rule",
        type: "Rule",
        abstract:
          "The final rule requires wildlife refuge managers to change habitat conservation plans beginning in 2019.",
        document_number: "2019-wildlife-habitat",
        publication_date: "2019-09-15",
        html_url:
          "https://www.federalregister.gov/d/2019-wildlife-habitat",
        agencies: [{ name: "Wildlife Conservation Agency" }],
      },
    ];

    const acceptanceReports: unknown[] = [];

    for (const industry of ["Manufacturing", "Video gaming"] as const) {
      const harness = productionHarness({
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({ count: mixedResults.length, results: mixedResults }),
            { headers: { "content-type": "application/json" } },
          ),
      });
      const opened = await createCanonicalWorkflow(
        harness,
        confirmedWorkflowFindContext(industry, {
          eventDescriptor: "regulatory shock",
          studyPeriod: "2014–2022",
        }),
        `mcp-find-industry-qualification-${industry.replace(/\s+/g, "-")}`,
      );
      const initial = workflowSnapshot(opened);
      const plannedMutation = await harness.callTool(
        "mutate_screen02_workflow_v021",
        {
          schemaVersion: "screen-02-workflow-action-v1",
          operationId: `mcp-find-industry-search-${industry.replace(/\s+/g, "-")}`,
          runId: initial.runId,
          accessToken: initial.accessToken,
          expectedRevision: initial.revision,
          expectedStateFingerprint: initial.stateFingerprint,
          action: "find-search",
          payload: { criteria: [] },
        },
      );
      const mutation = await rejectFindPlannerAndDiscover(
        harness,
        plannedMutation,
        `mcp-find-industry-fixed-plan-${industry.replace(/\s+/g, "-")}`,
      );
      const state = stateFromScreen02WorkflowClientSnapshot(
        workflowSnapshot(mutation),
      );
      if (state.mode !== "find") throw new Error("Expected Find state.");
      const activeSet = state.candidateSets.find(
        (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
      );
      expect(activeSet).toBeDefined();
      const directId =
        industry === "Manufacturing"
          ? "fr-2019-manufacturing-scope"
          : "fr-2019-video-gaming-scope";
      const wrongIndustryId =
        industry === "Manufacturing"
          ? "fr-2019-video-gaming-scope"
          : "fr-2019-manufacturing-scope";
      const direct = state.candidates.find(
        (candidate) => candidate.candidateId === directId,
      );
      expect(
        direct,
        JSON.stringify(
          {
            candidateIds: state.candidates.map((candidate) =>
              candidate.candidateId),
            targetExclusion: activeSet!.manifest.exclusions.find(
              (exclusion) => exclusion.recordId === directId,
            ),
          },
          null,
          2,
        ),
      ).toBeDefined();
      expect(direct?.qualification).toMatchObject({
        candidateId: directId,
        classification: "direct",
        section: "best-match",
        eligible: true,
        ranking: {
          rank: expect.any(Number),
          totalScore: expect.any(Number),
        },
      });
      expect(
        Number.isFinite(direct?.qualification?.retrieval.bm25Score),
      ).toBe(true);
      expect(state.candidates.some(
        (candidate) => candidate.candidateId === wrongIndustryId,
      )).toBe(false);
      const wrongIndustry = activeSet!.manifest.exclusions.find(
        (exclusion) => exclusion.recordId === wrongIndustryId,
      );
      expect(wrongIndustry?.qualification).toMatchObject({
        classification: "mismatch",
        eligible: false,
        outcomeFit: { status: "not-evaluated" },
        exclusionCodes: expect.arrayContaining(["industry-mismatch"]),
      });
      const vrs = activeSet!.manifest.exclusions.find(
        (exclusion) => exclusion.recordId === "fr-2019-11744",
      );
      expect(vrs?.qualification).toMatchObject({
        classification: "mismatch",
        eligible: false,
        hardScope: { disposition: "insufficient-evidence" },
        substantiveOverview: {
          identity: true,
          change: true,
          affectedPopulation: true,
          materialDate: false,
          passed: false,
        },
        outcomeFit: { status: "not-evaluated" },
        exclusionCodes: expect.arrayContaining([
          "industry-mismatch",
          "excluded-insufficient-substantive-information",
        ]),
      });
      expect(activeSet!.manifest.exclusions).toContainEqual(
        expect.objectContaining({
          recordId: "fr-2019-wildlife-habitat",
          qualification: expect.objectContaining({
            classification: "mismatch",
            eligible: false,
          }),
        }),
      );
      acceptanceReports.push({
        industry,
        queryMatrix: activeSet!.manifest.queryMatrix.map((query) => ({
          id: query.id,
          query: query.query,
          purpose: query.purpose,
          returnedRecordIds: query.returnedRecordIds,
        })),
        retained: state.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          sourceCount: candidate.sourceIds.length,
          classification: candidate.qualification?.classification,
          industryExplanation:
            candidate.qualification?.industryFit.explanation,
          outcomeExplanation: candidate.qualification?.outcomeFit.explanation,
          score: candidate.qualification?.ranking.totalScore,
          rank: candidate.qualification?.ranking.rank,
        })),
        excluded: activeSet!.manifest.exclusions.map((entry) => ({
          candidateId: entry.recordId,
          classification: entry.qualification?.classification,
          exclusionCodes: entry.qualification?.exclusionCodes,
        })),
        sourceCounts: activeSet!.manifest.channels,
      });
      expect(activeSet!.manifest.stoppingRule).toMatchObject({
        status: "met",
        rule: expect.stringContaining("returned titles do not satisfy"),
        note: expect.stringMatching(/returned title.*qualified candidate/i),
      });
    }
    if (process.env.SHOCKAUDIT_REPORT_SCREEN02 === "1") {
      console.log(
        `SCREEN02_V0403_ACCEPTANCE ${JSON.stringify(acceptanceReports)}`,
      );
    }
  });

  it("completes distinct qualified Find flows for manufacturing, video gaming, banking, and energy", async () => {
    const records = [
      {
        title: "Manufacturing Facility Product-Safety Rule",
        abstract:
          "The final rule requires public manufacturing firms and covered manufacturers to change product-safety controls at production facilities beginning in 2019.",
        document_number: "2019-e2e-manufacturing",
      },
      {
        title: "Video Game Platform Consumer-Protection Rule",
        abstract:
          "The final rule requires video game publishers and online game platforms to change account and product disclosures for users beginning in 2019.",
        document_number: "2019-e2e-video-gaming",
      },
      {
        title: "Bank Liquidity and Workforce Reporting Rule",
        abstract:
          "The final rule requires public banking firms, banks, and depository institutions to change liquidity reporting and staffing processes beginning in 2019.",
        document_number: "2019-e2e-banking",
      },
      {
        title: "Electric Utility Grid-Investment Rule",
        abstract:
          "The final rule requires public energy firms, electric utilities, and power producers to change grid-investment planning beginning in 2019.",
        document_number: "2019-e2e-energy",
      },
      {
        title: "Migratory Wildlife Habitat Conservation Rule",
        abstract:
          "The rule requires wildlife refuge managers to change habitat conservation plans beginning in 2019.",
        document_number: "2019-e2e-wildlife",
      },
    ].map((record, index) => ({
      ...record,
      type: "Rule",
      publication_date: `2019-${String(index + 1).padStart(2, "0")}-15`,
      html_url:
        `https://www.federalregister.gov/d/${record.document_number}`,
      agencies: [{ name: "Cross-industry qualification fixture agency" }],
    }));
    const cases = [
      {
        industry: "Manufacturing",
        outcomeFamily: "Innovation",
        expected: "fr-2019-e2e-manufacturing",
      },
      {
        industry: "Video gaming",
        outcomeFamily: "Innovation",
        expected: "fr-2019-e2e-video-gaming",
      },
      {
        industry: "Banking",
        outcomeFamily: "Employment",
        expected: "fr-2019-e2e-banking",
      },
      {
        industry: "Energy",
        outcomeFamily: "Investment",
        expected: "fr-2019-e2e-energy",
      },
    ] as const;
    const leadingLists: string[][] = [];

    for (const testCase of cases) {
      const harness = productionHarness({
        CONNECTOR_FETCH: async () => new Response(
          JSON.stringify({ count: records.length, results: records }),
          { headers: { "content-type": "application/json" } },
        ),
      });
      const opened = await createCanonicalWorkflow(
        harness,
        confirmedWorkflowFindContext(testCase.industry, {
          eventDescriptor: "regulatory shock",
          studyPeriod: "2014–2022",
          outcomeFamily: testCase.outcomeFamily,
        }),
        `mcp-find-e2e-${testCase.industry.replace(/\s+/gu, "-")}`,
      );
      const initial = workflowSnapshot(opened);
      const planned = await harness.callTool(
        "mutate_screen02_workflow_v021",
        {
          schemaVersion: "screen-02-workflow-action-v1",
          operationId: `mcp-find-e2e-search-${testCase.industry.replace(/\s+/gu, "-")}`,
          runId: initial.runId,
          accessToken: initial.accessToken,
          expectedRevision: initial.revision,
          expectedStateFingerprint: initial.stateFingerprint,
          action: "find-search",
          payload: { criteria: [] },
        },
      );
      const discovered = await rejectFindPlannerAndDiscover(
        harness,
        planned,
        `mcp-find-e2e-fixed-${testCase.industry.replace(/\s+/gu, "-")}`,
      );
      const state = stateFromScreen02WorkflowClientSnapshot(
        workflowSnapshot(discovered),
      );
      if (state.mode !== "find") throw new Error("Expected Find state.");
      const activeSet = state.candidateSets.find(
        (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
      );
      const visible = activeSet?.candidateSnapshotIds.map((id) =>
        state.candidates.find((candidate) => candidate.candidateSnapshotId === id)!,
      ) ?? [];
      leadingLists.push(visible.map((candidate) => candidate.candidateId));

      const expectedCandidate = visible.find(
        (candidate) => candidate.candidateId === testCase.expected,
      );
      expect(
        expectedCandidate,
        JSON.stringify(
          visible.map((candidate) => ({
            candidateId: candidate.candidateId,
            classification: candidate.qualification?.classification,
            score: candidate.qualification?.ranking.totalScore,
            industryFit: candidate.qualification?.industryFit,
            exclusionCodes: candidate.qualification?.exclusionCodes,
          })).concat((activeSet?.manifest.exclusions ?? []).map((entry) => ({
            candidateId: `excluded:${entry.recordId}`,
            classification: entry.qualification?.classification,
            score: entry.qualification?.ranking.totalScore,
            industryFit: entry.qualification?.industryFit,
            exclusionCodes: entry.qualification?.exclusionCodes,
          }))),
          null,
          2,
        ),
      ).toBeDefined();
      expect(expectedCandidate?.qualification).toMatchObject({
        classification: "direct",
        section: "best-match",
        eligible: true,
        substantiveOverview: { passed: true },
      });
      expect(visible.every((candidate) =>
        candidate.qualification?.classification !== "mismatch" &&
        candidate.qualification?.substantiveOverview.passed === true
      )).toBe(true);
      expect(activeSet?.manifest.exclusions).toContainEqual(
        expect.objectContaining({
          recordId: "fr-2019-e2e-wildlife",
          qualification: expect.objectContaining({
            classification: "mismatch",
            eligible: false,
          }),
        }),
      );
      expect(
        activeSet?.manifest.exclusions.some(
          (entry) => entry.qualification?.hardScope.passed === false,
        ),
      ).toBe(true);
    }

    expect(leadingLists[0]).not.toEqual(leadingLists[1]);
  }, 60_000);

  it("defaults expansion off, keeps shadow identical, and preserves the full off-mode Find prefix in on mode", async () => {
    const run = async (mode: "off" | "shadow" | "on" | undefined) => {
      const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
        async (input) => {
          const url = input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
          const expanded =
            (url.searchParams.get("conditions[term]") ?? "Technology") !==
            "Technology";
          return new Response(
            JSON.stringify({
              count: expanded ? 1 : 0,
              results: expanded
                ? [
                    {
                      title: "Expanded Official Technology Rule",
                      type: "Rule",
                      abstract: "Official technology regulation metadata.",
                      document_number: "2019-expanded-shadow",
                      publication_date: "2019-04-01",
                      html_url:
                        "https://www.federalregister.gov/d/2019-expanded-shadow",
                      agencies: [{ name: "Technology Agency" }],
                    },
                  ]
                : [],
            }),
            { headers: { "content-type": "application/json" } },
          );
        };
      const ticks = [0, 4, 11, 12];
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const harness = productionHarness({
        CONNECTOR_FETCH: connectorFetch,
        SCREEN02_SEARCH_EXPANSION_MODE: mode,
        SCREEN02_SEARCH_MONOTONIC_NOW: () => ticks.shift() ?? 12,
      });
      const opened = await createCanonicalWorkflow(
        harness,
        confirmedWorkflowFindContext(),
        `mcp-find-expansion-${mode ?? "default"}`,
      );
      const initial = workflowSnapshot(opened);
      const plannedMutation = await harness.callTool(
        "mutate_screen02_workflow_v021",
        {
          schemaVersion: "screen-02-workflow-action-v1",
          operationId: `mcp-find-expansion-${mode ?? "default"}-search`,
          runId: initial.runId,
          accessToken: initial.accessToken,
          expectedRevision: initial.revision,
          expectedStateFingerprint: initial.stateFingerprint,
          action: "find-search",
          payload: { criteria: [] },
        },
      );
      const mutation = await rejectFindPlannerAndDiscover(
        harness,
        plannedMutation,
        `mcp-find-expansion-${mode ?? "default"}-fixed-plan`,
      );
      const state = stateFromScreen02WorkflowClientSnapshot(
        workflowSnapshot(mutation),
      );
      const telemetry = screen02ExpansionTelemetry(log);
      log.mockRestore();
      if (state.mode !== "find") throw new Error("Expected Find state.");
      return {
        candidateTitles: state.candidates.map(
          (candidate) => candidate.identity.canonicalTitle,
        ),
        manifest: state.candidateSets.find(
          (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
        )?.manifest,
        telemetry,
      };
    };

    const implicitDefault = await run(undefined);
    const off = await run("off");
    const shadow = await run("shadow");
    const on = await run("on");
    expect(implicitDefault.candidateTitles).toEqual(off.candidateTitles);
    expect(implicitDefault.telemetry).toHaveLength(1);
    expect(implicitDefault.telemetry[0]).toMatchObject({
      mode: "off",
      status: "off",
      expandedQueryCount: 0,
    });
    expect(shadow.candidateTitles).toEqual(off.candidateTitles);
    const stableNativePrefix = (manifest: typeof shadow.manifest) =>
      (manifest?.queryMatrix ?? [])
        .filter((query) =>
          query.purpose.includes(
            "Query-plan version: screen-02-native-query-plan-v1",
          ),
        )
        .slice(0, SCREEN02_NATIVE_QUERY_MIN_VARIANTS)
        .map((query) => ({
          ...query,
          id: query.id.replace(
            /^find-search-round-[^:]+:/,
            "find-search-round:<id>:",
          ),
        }));
    expect(stableNativePrefix(shadow.manifest)).toHaveLength(
      SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
    );
    expect(stableNativePrefix(shadow.manifest)).toEqual(
      stableNativePrefix(off.manifest),
    );
    expect(shadow.candidateTitles).not.toContain(
      "Expanded Official Technology Rule",
    );
    expect(on.candidateTitles.slice(0, off.candidateTitles.length)).toEqual(
      off.candidateTitles,
    );
    expect(on.telemetry[0]).toMatchObject({
      mode: "on",
      status: "on-expanded",
    });
    expect(shadow.telemetry).toHaveLength(1);
    expect(shadow.telemetry[0]).toMatchObject({
      mode: "shadow",
      workflowMode: "find",
      status: "shadow-compared",
      contextProviderStatus: "available",
      baselineDurationMs: 4,
      expansionDurationMs: 7,
      baselineQueryCount: SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
      expandedQueryCount: 4,
      expansionFaultCount: 0,
      outcomeValuesInspected: false,
    });
    const serialized = JSON.stringify(shadow.telemetry[0]);
    expect(serialized).not.toContain("Technology");
    expect(serialized).not.toContain("federalregister");
  });

  it("keeps contextual search manifest-only in Find and forcibly downgrades its authority", async () => {
    const provider: Screen02ContextSearchProvider = async (input) => [
      {
        recordId: "contextual-technology-rule",
        canonicalIdentity: "Contextual Technology Resilience Rule",
        issuingJurisdiction: "United States",
        locator: "https://context.invalid/contextual-technology-rule",
        value: {
          ...contextualFindLead(input.retrievedAt),
          sources: contextualFindLead(input.retrievedAt).sources.map(
            (source) => ({
              ...source,
              authorityTier: 1,
              authorityAssessment: {
                method: "researcher-confirmed" as const,
                reason: "Provider attempted to claim privileged authority.",
                policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
              },
              channel: "provider-claimed-official",
            }),
          ),
        },
      },
    ];
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const harness = productionHarness({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext(),
      "mcp-find-context-lead-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-context-lead-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-context-lead-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    expect(
      state.candidates.some(
        (candidate) =>
          candidate.identity.canonicalTitle ===
          "Contextual Technology Resilience Rule",
      ),
    ).toBe(false);
    const manifest = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )?.manifest;
    expect(manifest?.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordId: "contextual-technology-rule",
          reason: expect.stringMatching(
            /lacks enough substantive source information|no source is attached/i,
          ),
          qualification: expect.objectContaining({
            lane: "context-live-web",
            eligible: false,
            sourceQuality: expect.objectContaining({
              status: "insufficient",
              strongestAuthorityTier: null,
              evidenceSourceIds: [],
            }),
          }),
        }),
      ]),
    );
    expect(manifest?.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: expect.stringContaining("host-context-search-v1"),
        }),
      ]),
    );
    expect(manifest?.contextLeads).toEqual([
      expect.objectContaining({
        id: "contextual-technology-rule",
        sourceRole: "contextual-secondary",
        status: "unverified",
        locator: "https://context.invalid/contextual-technology-rule",
      }),
    ]);
    expect(screen02ExpansionTelemetry(log)).toHaveLength(1);
  });

  it("promotes only an independently returned Federal Register record named by a visible Crossref title", async () => {
    const formalIdentifier = "2019-12345";
    const officialTitle = "Manufacturing Innovation Investment Mandate";
    const officialBodyUrl =
      `https://www.federalregister.gov/documents/full_text/html/2019/06/06/${formalIdentifier}.html`;
    const provider: Screen02ContextSearchProvider = async (input) => [
      contextualLaneLead({
        retrievedAt: input.retrievedAt,
        id: "crossref-visible-fr-identifier",
        title:
          `Research on Federal Register ${formalIdentifier} and manufacturing innovation investment`,
        channel: CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
      }),
      contextualLaneLead({
        retrievedAt: input.retrievedAt,
        id: "reporting-without-identifier",
        title: "Reporting on manufacturing innovation investment",
        channel: CONTEXTUAL_DISCOVERY_CHANNEL,
      }),
    ];
    const connectorQueries: string[] = [];
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (`${url.origin}${url.pathname}` !== FEDERAL_REGISTER_API_ENDPOINT) {
          if (
            url.hostname === "www.federalregister.gov" &&
            url.pathname.includes(formalIdentifier)
          ) {
            return new Response(
              `<!doctype html><html lang="en"><head><title>${officialTitle}</title></head><body><main><h1>AGENCY:</h1><p>Federal Innovation Commission.</p><h1>ACTION:</h1><p>Final rule.</p><h1>SUMMARY:</h1><p>On January 1, 2020, Federal Register document ${formalIdentifier}, the ${officialTitle}, requires every U.S. publicly listed manufacturing firm to adopt new research-investment controls.</p><h1>DATES:</h1><p>This final rule is effective January 1, 2020.</p><p>[FR Doc. ${formalIdentifier} Filed 6-5-19; 8:45 am]</p></main></body></html>`,
              { headers: { "content-type": "text/html" } },
            );
          }
          return new Response("<html><body>No matching action.</body></html>", {
            headers: { "content-type": "text/html" },
          });
        }
        const query = url.searchParams.get("conditions[term]") ?? "";
        connectorQueries.push(query);
        return new Response(JSON.stringify(
          query === formalIdentifier
            ? {
                count: 1,
                results: [{
                  document_number: formalIdentifier,
                  title: officialTitle,
                  type: "Rule",
                  abstract:
                    `On January 1, 2020, Federal Register document ${formalIdentifier}, the ${officialTitle}, requires every U.S. publicly listed manufacturing firm to adopt new research-investment controls.`,
                  action: "Final rule.",
                  publication_date: "2019-06-06",
                  effective_on: "2020-01-01",
                  html_url:
                    `https://www.federalregister.gov/documents/2019/06/06/${formalIdentifier}/manufacturing-innovation-investment-mandate`,
                  body_html_url: officialBodyUrl,
                  agencies: [{
                    name: "Federal Innovation Commission",
                  }],
                }],
              }
            : { count: 0, results: [] },
        ), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      };
    const state = await discoverFixedPlanFind({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
      CONNECTOR_FETCH: connectorFetch,
    }, "mcp-crossref-official-bridge-positive", confirmedWorkflowFindContext(
      "Manufacturing",
      {
        studyPeriod: "2016–2022",
        outcomeFamily: "Innovation",
        eventDescriptor: "regulation",
      },
    ));
    expect(
      state.candidates.map((candidate) => candidate.identity.canonicalTitle),
    ).toContain(officialTitle);
    expect(
      state.candidates.some((candidate) =>
        candidate.identity.canonicalTitle.includes("Research on Federal")
      ),
    ).toBe(false);
    expect(connectorQueries.filter((query) => query === formalIdentifier))
      .toHaveLength(1);
    expect(connectorQueries).not.toContain("2099-99999");
    expect(connectorQueries).not.toContain("2098-88888");
    expect(connectorQueries).not.toContain("2097-77777");
    expect(connectorQueries).not.toContain("2096-66666");
    const manifest = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )?.manifest;
    const bridgeQuery = manifest?.queryMatrix.find((query) =>
      query.query.includes(encodeURIComponent(formalIdentifier)) ||
      query.query.includes(formalIdentifier)
    );
    expect(bridgeQuery).toMatchObject({
      returnedRecordIds: [formalIdentifier],
    });
    expect(manifest?.contextLeads?.map((lead) => lead.id)).toEqual([
      "crossref-visible-fr-identifier",
      "reporting-without-identifier",
    ]);
    expect(manifest?.contextBridges).toEqual([{
      schemaVersion: "screen-02-context-official-bridge-v1",
      contextualLeadId: "crossref-visible-fr-identifier",
      bridgeQueryId: bridgeQuery?.id,
      formalIdentifier,
      returnedOfficialRecordIds: [formalIdentifier],
      status: "corroborated",
    }]);
  });

  it("keeps Crossref and reporting metadata lead-only when official corroboration returns no record", async () => {
    const formalIdentifier = "2020-54321";
    const provider: Screen02ContextSearchProvider = async (input) => [
      contextualLaneLead({
        retrievedAt: input.retrievedAt,
        id: "reporting-uncorroborated-fr-identifier",
        title: `Report mentions Federal Register ${formalIdentifier}`,
        channel: CONTEXTUAL_DISCOVERY_CHANNEL,
      }),
    ];
    const requestedIdentifiers: string[] = [];
    const state = await discoverFixedPlanFind({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (`${url.origin}${url.pathname}` === FEDERAL_REGISTER_API_ENDPOINT) {
          const query = url.searchParams.get("conditions[term]") ?? "";
          if (query === formalIdentifier) requestedIdentifiers.push(query);
          return new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("<html><body>No match.</body></html>", {
          headers: { "content-type": "text/html" },
        });
      },
    }, "mcp-reporting-official-bridge-negative");

    expect(requestedIdentifiers).toEqual([formalIdentifier]);
    expect(state.candidates.some((candidate) =>
      candidate.identity.canonicalTitle.includes(formalIdentifier)
    )).toBe(false);
    const manifest = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )?.manifest;
    expect(manifest?.contextLeads).toEqual([
      expect.objectContaining({
        id: "reporting-uncorroborated-fr-identifier",
        sourceRole: "contextual-secondary",
        status: "unverified",
      }),
    ]);
    expect(manifest?.queryMatrix).toEqual(expect.arrayContaining([
      expect.objectContaining({
        query: expect.stringContaining(formalIdentifier),
        returnedRecordIds: [],
      }),
    ]));
    const bridgeQuery = manifest?.queryMatrix.find((query) =>
      query.query.includes(formalIdentifier)
    );
    expect(manifest?.contextBridges).toEqual([{
      schemaVersion: "screen-02-context-official-bridge-v1",
      contextualLeadId: "reporting-uncorroborated-fr-identifier",
      bridgeQueryId: bridgeQuery?.id,
      formalIdentifier,
      returnedOfficialRecordIds: [],
      status: "no-corroboration",
    }]);
  });

  it("does not treat an X query returning Federal Register Y as corroboration", async () => {
    const requestedIdentifier = "2020-12345";
    const unrelatedIdentifier = "2020-54321";
    const provider: Screen02ContextSearchProvider = async (input) => [
      contextualLaneLead({
        retrievedAt: input.retrievedAt,
        id: "reporting-fr-x-returned-y",
        title: `Report mentions Federal Register ${requestedIdentifier}`,
        channel: CONTEXTUAL_DISCOVERY_CHANNEL,
      }),
    ];
    const state = await discoverFixedPlanFind({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (`${url.origin}${url.pathname}` !== FEDERAL_REGISTER_API_ENDPOINT) {
          return new Response("<html><body>No match.</body></html>", {
            headers: { "content-type": "text/html" },
          });
        }
        if (
          url.searchParams.get("conditions[term]") !== requestedIdentifier
        ) {
          return new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: unrelatedIdentifier,
            title: "Unrelated official record",
            type: "Rule",
            abstract: "A different Federal Register document.",
            publication_date: "2020-05-01",
            html_url:
              `https://www.federalregister.gov/documents/2020/05/01/${unrelatedIdentifier}/unrelated-record`,
            agencies: [{ name: "Unrelated Agency" }],
          }],
        }), {
          headers: { "content-type": "application/json" },
        });
      },
    }, "mcp-context-official-bridge-x-returned-y");

    expect(state.candidates.some((candidate) =>
      candidate.identity.formalIdentifier === unrelatedIdentifier
    )).toBe(false);
    const manifest = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )?.manifest;
    const bridge = manifest?.contextBridges?.[0];
    expect(bridge).toMatchObject({
      contextualLeadId: "reporting-fr-x-returned-y",
      formalIdentifier: requestedIdentifier,
      returnedOfficialRecordIds: [],
      status: "no-corroboration",
    });
    expect(manifest?.queryMatrix.find(
      (query) => query.id === bridge?.bridgeQueryId,
    )?.returnedRecordIds).toEqual([]);
  });

  it("keeps the contextual-to-official bridge comparison-only in shadow mode", async () => {
    const formalIdentifier = "2021-65432";
    const provider: Screen02ContextSearchProvider = async (input) => [
      contextualLaneLead({
        retrievedAt: input.retrievedAt,
        id: "shadow-crossref-fr-identifier",
        title: `Study names Federal Register ${formalIdentifier}`,
        channel: CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
      }),
    ];
    let bridgeRequests = 0;
    const state = await discoverFixedPlanFind({
      SCREEN02_SEARCH_EXPANSION_MODE: "shadow",
      SCREEN02_CONTEXT_SEARCH: provider,
      CONNECTOR_FETCH: async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (
          `${url.origin}${url.pathname}` === FEDERAL_REGISTER_API_ENDPOINT &&
          url.searchParams.get("conditions[term]") === formalIdentifier
        ) bridgeRequests += 1;
        return new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json" },
        });
      },
    }, "mcp-context-official-bridge-shadow");

    expect(bridgeRequests).toBe(0);
    expect(state.candidates.some((candidate) =>
      candidate.identity.canonicalTitle.includes(formalIdentifier)
    )).toBe(false);
    const manifest = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )?.manifest;
    expect(manifest?.contextLeads).toBeUndefined();
    expect(manifest?.contextBridges).toBeUndefined();
    expect(manifest?.queryMatrix.some((query) =>
      query.query.includes(formalIdentifier)
    )).toBe(false);
  });

  it("returns the unchanged Find baseline when a contextual provider never resolves", async () => {
    vi.useFakeTimers();
    const observedSignals: AbortSignal[] = [];
    let acknowledgeProvider: (() => void) | null = null;
    const providerInvoked = new Promise<void>((resolve) => {
      acknowledgeProvider = resolve;
    });
    const provider: Screen02ContextSearchProvider = async (input) => {
      observedSignals.push(input.signal);
      acknowledgeProvider?.();
      return new Promise(() => undefined);
    };
    const harness = productionHarness({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
    });
    try {
      const opened = await createCanonicalWorkflow(
        harness,
        confirmedWorkflowFindContext(),
        "mcp-find-context-deadline-open",
      );
      const initial = workflowSnapshot(opened);
      const pendingMutation = harness.callTool(
        "mutate_screen02_workflow_v021",
        {
          schemaVersion: "screen-02-workflow-action-v1",
          operationId: "mcp-find-context-deadline-search",
          runId: initial.runId,
          accessToken: initial.accessToken,
          expectedRevision: initial.revision,
          expectedStateFingerprint: initial.stateFingerprint,
          action: "find-search",
          payload: { criteria: [] },
        },
      );
      await providerInvoked;
      await vi.advanceTimersByTimeAsync(3_200);
      const plannedMutation = await pendingMutation;
      const mutation = await rejectFindPlannerAndDiscover(
        harness,
        plannedMutation,
        "mcp-find-context-deadline-fixed-plan",
      );
      const state = stateFromScreen02WorkflowClientSnapshot(
        workflowSnapshot(mutation),
      );
      if (state.mode !== "find") throw new Error("Expected Find state.");
      expect(observedSignals[0]?.aborted).toBe(true);
      expect(state.discoveryRequests.at(-1)?.status).toMatch(
        /^completed(?:-empty)?$/,
      );
      expect(state.candidateSets.at(-1)?.manifest).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pre-caps oversized contextual arrays at each declared result limit", async () => {
    const provider: Screen02ContextSearchProvider = async (input) =>
      Array.from({ length: 1_000 }, (_, index) => {
        const lead = contextualFindLead(
          input.retrievedAt,
          `oversized-context-${input.stage}-${index}`,
        );
        return {
          recordId: lead.id,
          canonicalIdentity: lead.title,
          issuingJurisdiction: "United States",
          locator: lead.sources[0]?.locator,
          value: lead,
        };
      });
    const harness = productionHarness({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowFindContext(),
      "mcp-find-context-array-cap-open",
    );
    const initial = workflowSnapshot(opened);
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-context-array-cap-search",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-context-array-cap-fixed-plan",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(mutation),
    );
    if (state.mode !== "find") throw new Error("Expected Find state.");
    const active = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    const contextualQueries = active?.manifest.queryMatrix.filter((query) =>
      query.id.includes("host-context-search-v1")
    ) ?? [];
    expect(contextualQueries.length).toBeGreaterThan(0);
    expect(
      contextualQueries.every(
        (query) => (query.returnedRecordIds?.length ?? 0) <= 20,
      ),
    ).toBe(true);
  });

  it("never turns an Audit context lead into a confirmable identity match", async () => {
    const provider: Screen02ContextSearchProvider = async (input) => {
      const lead = contextualFindLead(
        input.retrievedAt,
        "contextual-audit-ccpa",
      );
      return [
        {
          recordId: lead.id,
          canonicalIdentity: "California Consumer Privacy Act",
          issuingJurisdiction: "United States",
          locator: lead.sources[0]?.locator,
          value: {
            ...lead,
            title: "California Consumer Privacy Act Context Lead",
            event: {
              ...lead.event,
              displayName: "California Consumer Privacy Act Context Lead",
            },
          },
        },
      ];
    };
    const harness = productionHarness({
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_CONTEXT_SEARCH: provider,
    });
    const opened = await createCanonicalWorkflow(
      harness,
      confirmedWorkflowAuditContext(),
      "mcp-audit-context-lead-open",
    );
    const state = stateFromScreen02WorkflowClientSnapshot(
      workflowSnapshot(opened),
    );
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    expect(
      state.possibleMatches.some(
        (match) =>
          match.identity.canonicalTitle ===
          "California Consumer Privacy Act Context Lead",
      ),
    ).toBe(false);
    expect(
      state.sources.some(
        (source) => source.channel === "feature-gated-context-lead",
      ),
    ).toBe(false);
    const active = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    );
    expect(active?.manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: expect.stringContaining("host-context-search-v1"),
        }),
      ]),
    );
    expect(active?.manifest.contextLeads).toEqual([
      expect.objectContaining({
        id: "contextual-audit-ccpa",
        sourceRole: "contextual-secondary",
        status: "unverified",
      }),
    ]);
  });

  it("keeps Audit's final protected baseline as an identical prefix when on-mode additions fill spare slots", async () => {
    const shockName = "National Technology Privacy Rule";
    const sentence =
      `Audit whether the ${shockName} affected innovation among U.S. publicly listed technology firms from 2015 to 2023.`;
    const initial = createInitialState("audit");
    const confirmed = confirmScopeContract({
      ...initial,
      revision: 9,
      sentence,
      contractSourceSentence: sentence,
      knownShock: shockName,
      scope: {
        population: "U.S. publicly listed technology firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "United States",
        industry: "Technology",
        studyPeriod: "2015–2023",
        eventFamily: "Regulation",
        outcomeFamily: "Innovation",
        outcomeFrequency: "Annual",
      },
      resolvedKeys: [...decisionKeys],
      scopeDirty: false,
    });
    if (!confirmed.ok) {
      throw new Error(`Protected-prefix Audit context did not confirm: ${confirmed.error}`);
    }
    const studyContext = buildScreen01StudyContext(
      confirmed.state,
      confirmed.ambiguities,
    );
    const baselineTitle =
      `${shockName} Baseline Administrative Rule`;
    const expandedTitle =
      `${shockName} Expanded Compliance Rule`;
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (`${url.origin}${url.pathname}` !== FEDERAL_REGISTER_API_ENDPOINT) {
          return new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
        const query = url.searchParams.get("conditions[term]") ?? "";
        const expanded = query !== shockName;
        const title = expanded ? expandedTitle : baselineTitle;
        const documentNumber = expanded
          ? "2019-audit-expanded-prefix"
          : "2018-audit-baseline-prefix";
        return new Response(
          JSON.stringify({
            count: 1,
            results: [{
              title,
              type: "Rule",
              abstract:
                `${title} is an official privacy regulation record associated with the named federal shock anchor.`,
              document_number: documentNumber,
              publication_date: expanded ? "2019-03-15" : "2018-06-28",
              effective_on: "2020-01-01",
              html_url: `https://www.federalregister.gov/d/${documentNumber}`,
              agencies: [{ name: "Privacy Rulemaking Agency" }],
            }],
          }),
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      };
    const contextProvider: Screen02ContextSearchProvider = async (input) => {
      const lead = contextualFindLead(
        input.retrievedAt,
        "contextual-audit-prefix-spare-slot",
      );
      return [{
        recordId: lead.id,
        canonicalIdentity: shockName,
        issuingJurisdiction: "United States",
        locator: lead.sources[0]?.locator,
        value: lead,
      }];
    };
    const run = async (mode: "off" | "on") => {
      const harness = productionHarness({
        CONNECTOR_FETCH: connectorFetch,
        SCREEN02_SEARCH_EXPANSION_MODE: mode,
        ...(mode === "on" ? { SCREEN02_CONTEXT_SEARCH: contextProvider } : {}),
      });
      const opened = await createCanonicalWorkflow(
        harness,
        studyContext,
        `mcp-audit-protected-prefix-${mode}`,
      );
      const initialSnapshot = workflowSnapshot(opened);
      const revised = await harness.callTool(
        "mutate_screen02_workflow_v021",
        {
          schemaVersion: "screen-02-workflow-action-v1",
          operationId: `mcp-audit-protected-prefix-revise-${mode}`,
          runId: initialSnapshot.runId,
          accessToken: initialSnapshot.accessToken,
          expectedRevision: initialSnapshot.revision,
          expectedStateFingerprint: initialSnapshot.stateFingerprint,
          action: "audit-revise-anchor",
          payload: {
            fields: {
              shockName,
              jurisdiction: "United States",
              issuingAuthority: "Privacy Rulemaking Agency",
              approximateYear: "2018",
              versionType: "original",
              distinguishingFeature: null,
              sourceLocator: null,
              clarification: null,
            },
            reason:
              "Resolve the federal identity with the structured Audit anchor.",
          },
        },
      );
      expect(
        revised.result?.isError,
        JSON.stringify(revised.result?.content),
      ).not.toBe(true);
      const state = stateFromScreen02WorkflowClientSnapshot(
        workflowSnapshot(revised),
      );
      if (state.mode !== "audit") throw new Error("Expected Audit state.");
      const sourceById = new Map(
        state.sources.map((source) => [source.id, source]),
      );
      const visibleMatches = state.possibleMatches.map((match) => ({
        canonicalTitle: match.identity.canonicalTitle,
        formalIdentifier: match.identity.formalIdentifier,
        relationship: match.relationship,
        sourceLocators: match.sourceIds
          .map((sourceId) => sourceById.get(sourceId)?.locator ?? sourceId)
          .sort(),
      }));
      const active = state.matchSets.find(
        (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
      );
      return { visibleMatches, active };
    };

    const off = await run("off");
    const on = await run("on");
    expect(off.visibleMatches.length).toBeLessThan(10);
    expect(off.visibleMatches.map((match) => match.canonicalTitle)).toContain(
      baselineTitle,
    );
    expect(on.visibleMatches.length).toBeGreaterThan(off.visibleMatches.length);
    expect(on.visibleMatches.slice(0, off.visibleMatches.length)).toEqual(
      off.visibleMatches,
    );
    expect(
      on.visibleMatches.slice(off.visibleMatches.length).map(
        (match) => match.canonicalTitle,
      ),
    ).toEqual([expandedTitle]);
    expect(
      on.visibleMatches.some((match) =>
        match.canonicalTitle.includes("Contextual Technology Resilience Rule")
      ),
    ).toBe(false);
    expect(on.active?.manifest.contextLeads).toEqual([
      expect.objectContaining({
        id: "contextual-audit-prefix-spare-slot",
        sourceRole: "contextual-secondary",
        status: "unverified",
      }),
    ]);
    const expandedQuery = on.active?.manifest.queryMatrix.find((query) =>
      query.returnedRecordIds.includes("2019-audit-expanded-prefix")
    );
    expect(expandedQuery).toMatchObject({
      id: expect.stringContaining("federal-register-"),
      query: expect.stringContaining(FEDERAL_REGISTER_API_ENDPOINT),
      returnedRecordIds: ["2019-audit-expanded-prefix"],
    });
    expect(
      on.active?.manifest.retainedResultBinding?.results.some((result) =>
        result.origins.some(
          (origin) =>
            origin.kind === "query-result" &&
            origin.queryId === expandedQuery?.id &&
            origin.returnedRecordIds.includes("2019-audit-expanded-prefix"),
        )
      ),
    ).toBe(true);
  });

  it("does not infer EU or UK issuer routes from a Northern Europe study geography", async () => {
    const sentence =
      "Find a regulatory shock affecting electricity firms in Northern Europe from 2021 to 2024 that may influence profitability.";
    const baseContext = confirmedWorkflowFindContext();
    const studyContext = {
      ...baseContext,
      studySentence: sentence,
      contractSourceSentence: sentence,
      scopeContract: {
        ...baseContext.scopeContract,
        population: "Electricity firms",
        geography: "Northern Europe",
        industry: "Electricity",
        studyPeriod: "2021–2024",
        eventFamily: "Regulation",
        outcomeFamily: "Profitability",
      },
      revision: 21,
    };
    const connectorRequests: URL[] = [];
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input, init) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
        connectorRequests.push(url);
        if (`${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT) {
          const query = url.searchParams.get("query") ?? "";
          expect(query).toContain('LCASE("electricity")');
          expect(query).toContain("2021-01-01");
          expect(query).toContain("2024-12-31");
          return new Response(
            JSON.stringify({
              results: {
                bindings: [
                  {
                    work: {
                      value:
                        "http://publications.europa.eu/resource/cellar/electricity-market-design",
                    },
                    celex: { value: "32024R1747" },
                    title: {
                      value: "Electricity Market Design Regulation",
                    },
                    date: { value: "2024-06-13" },
                    type: {
                      value:
                        "http://publications.europa.eu/resource/authority/resource-type/REG",
                    },
                  },
                ],
              },
            }),
            {
              headers: {
                "content-type": "application/json; charset=utf-8",
              },
            },
          );
        }
        if (url.origin === new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin) {
          expect(url.pathname).toBe("/all/2021-2024/data.feed");
          expect(url.searchParams.get("title")).toBe(
            "Electricity Regulation",
          );
          expect(new Headers(init?.headers).get("user-agent")).toMatch(
            /^ShockAudit research-design tool \(\+https:\/\//u,
          );
          return new Response(
            `<?xml version="1.0" encoding="utf-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
              <entry>
                <id>https://www.legislation.gov.uk/id/ukpga/2023/52</id>
                <title>Electricity Market Reform Act 2023</title>
                <ukm:EnactmentDate Date="2023-10-26"/>
                <link rel="alternate" href="https://www.legislation.gov.uk/ukpga/2023/52"/>
              </entry>
            </feed>`,
            {
              headers: {
                "content-type": "application/atom+xml; charset=utf-8",
              },
            },
          );
        }
        throw new Error(`Unexpected Northern Europe connector: ${url}`);
      };
    const harness = productionHarness({ CONNECTOR_FETCH: connectorFetch });
    const opened = await createCanonicalWorkflow(
      harness,
      studyContext,
      "mcp-northern-europe-open",
    );
    const initial = workflowSnapshot(opened);

    harness.setNow("2026-08-10T18:06:00.000Z");
    const plannedMutation = await harness.callTool(
      "mutate_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "mcp-find-northern-europe-electricity",
        runId: initial.runId,
        accessToken: initial.accessToken,
        expectedRevision: initial.revision,
        expectedStateFingerprint: initial.stateFingerprint,
        action: "find-search",
        payload: { criteria: [] },
      },
    );

    expect(
      plannedMutation.result?.isError,
      JSON.stringify(plannedMutation.result?.content),
    ).not.toBe(true);
    const mutation = await rejectFindPlannerAndDiscover(
      harness,
      plannedMutation,
      "mcp-find-northern-europe-electricity-fixed-plan",
    );
    expect(connectorRequests.filter((url) =>
      `${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT ||
      url.origin === new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin
    )).toHaveLength(0);
    const successor = workflowSnapshot(mutation);
    const state = stateFromScreen02WorkflowClientSnapshot(successor);
    expect(state.mode).toBe("find");
    if (state.mode !== "find") throw new Error("Expected Find state.");
    expect(state.candidates).toEqual([]);
    expect(
      state.assessmentRequests.filter(
        (request) => request.target.mode === "find-candidate",
      ),
    ).toHaveLength(0);
    expect(state.sources).toEqual([]);

    const activeSet = state.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
    );
    expect(activeSet).toBeDefined();
    const sparseOfficialExclusions = activeSet!.manifest.exclusions.filter(
      (exclusion) =>
        exclusion.qualification?.lane === "official-source" &&
        exclusion.qualification.exclusionCodes.includes(
          "excluded-insufficient-substantive-information",
        ),
    );
    expect(sparseOfficialExclusions).toHaveLength(0);
    const limitationChannels = activeSet!.manifest.channels.filter(
      (channel) => channel.channel.startsWith("Coverage limitation ·"),
    );
    expect(limitationChannels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel:
            "Coverage limitation · national-primary-source-not-configured",
          status: "not-searched",
          note: expect.stringContaining(
            "No native official legal-source connector is configured for Northern Europe",
          ),
        }),
        expect.objectContaining({
          channel:
            "Coverage limitation · source-language-resolution-required",
          status: "not-searched",
          note: expect.stringContaining(
            "authoritative source language or languages for Northern Europe have not been resolved",
          ),
        }),
      ]),
    );
    expect(activeSet?.manifest.stoppingRule).toMatchObject({
      status: "met",
      note: expect.stringMatching(
        /selected 0 routes.*executed 0 through 0 bounded requests.*unsupported-route.*bounded search, not a claim that all possible shocks were found/i,
      ),
    });
    expect(activeSet?.manifest.outcomeValuesInspected).toBe(false);
  });

  it("keeps omitted workflowVersion as a legacy read-only open shape", async () => {
    const harness = productionHarness();
    const context = confirmedWorkflowFindContext();
    const payload = await harness.callTool("open_shockaudit_screen_2", {
      studyContext: context,
      runId: "legacy-mcp-open",
    });
    expect(payload.result?.isError).not.toBe(true);
    const output = payload.result?.structuredContent;
    expect(output).toMatchObject({
      screen: "screen-02",
      ok: true,
      error: "",
      sessionSummary: {
        runId: "legacy-mcp-open",
        mode: "find",
        revision: 0,
        sessionLocation: "state-envelope",
      },
    });
    expect(Object.keys(output ?? {}).sort()).toEqual(
      ["screen", "ok", "error", "sessionState", "sessionSummary"].sort(),
    );
    expect(output).not.toHaveProperty("accessToken");
    expect(output).not.toHaveProperty("outcome");
    expect(
      payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY],
    ).toBeUndefined();
    const decoded = decodeScreen02StateEnvelope(output?.sessionState);
    expect(decoded).toMatchObject({
      ok: true,
      session: {
        runId: "legacy-mcp-open",
        mode: "find",
        screen01Baseline: context,
      },
    });
  });
});
