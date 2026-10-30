import { describe, expect, it } from "vitest";

import {
  SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
  SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
  SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
  SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
} from "../../src/core/screen03-workflow-client";
import {
  SCREEN_03_BRIEFING_CONFIRM_INPUT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_CONFIRM_TOOL,
  SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_GET_TOOL,
  SCREEN_03_BRIEFING_NOT_ESTABLISHED_TEXT,
  SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_RENDER_TOOL,
  SCREEN_03_BRIEFING_SKILL_VERSION,
  SCREEN_03_BRIEFING_WORKFLOW_VERSION,
  screen03BriefingFactualSectionKeys,
  type Screen03BriefingContent,
  type Screen03BriefingSectionEvidenceIds,
} from "../../src/core/screen03-briefing";
import {
  decryptScreen03VerificationState,
} from "../../src/core/screen03-sealed-result";
import {
  exportScreen02ResponseKeyMaterial,
  generateScreen02ResponseKeyMaterial,
} from "../../src/core/screen02-sealed-result";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import { requireScreen02FindState } from "../../src/core/screen02-workflow-state";
import {
  attachScreen03BriefingLifecycle,
  fingerprintScreen03Value,
  fingerprintScreen03VerificationState,
  requireScreen03VerificationState,
  screen03FactualClaims,
  screen03ProposalConfirmability,
} from "../../src/core/screen03-workflow";
import worker from "../../src/worker/index";
import type { ShockAuditEnv } from "../../src/worker/server";
import {
  createScreen02WorkflowStoreIdentity,
  InMemoryScreen02WorkflowStore,
} from "../../src/worker/screen02-workflow-store";
import { InMemoryScreen03WorkflowStore } from "../../src/worker/screen03-workflow-store";
import type { Screen03BriefingPacket } from "../../src/worker/screen03-briefing-security";
import { buildReadyFindState } from "../core/screen02-workflow-fixtures";

type ListedTool = {
  name?: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  outputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
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

function expectRecursivelyStrictOutputSchema(
  schema: unknown,
  path: string,
): void {
  expect(typeof schema, path).toBe("object");
  expect(schema, path).not.toBeNull();
  expect(Array.isArray(schema), path).toBe(false);
  const record = schema as Record<string, unknown>;
  if (typeof record.$ref === "string") return;

  for (const unionKey of ["anyOf", "oneOf", "allOf"] as const) {
    if (record[unionKey] === undefined) continue;
    expect(Array.isArray(record[unionKey]), `${path}.${unionKey}`).toBe(true);
    for (const [index, variant] of
      (record[unionKey] as unknown[]).entries()) {
      expectRecursivelyStrictOutputSchema(
        variant,
        `${path}.${unionKey}[${index}]`,
      );
    }
  }

  if (record.type === "object") {
    expect(record.additionalProperties, path).toBe(false);
    expect(typeof record.properties, `${path}.properties`).toBe("object");
    expect(record.properties, `${path}.properties`).not.toBeNull();
    for (const [key, property] of Object.entries(
      record.properties as Record<string, unknown>,
    )) {
      expectRecursivelyStrictOutputSchema(property, `${path}.${key}`);
    }
  }
  if (record.type === "array") {
    expect(record.items, `${path}.items`).toBeDefined();
    expectRecursivelyStrictOutputSchema(record.items, `${path}.items`);
  }
  if (record.$defs !== undefined) {
    expect(typeof record.$defs, `${path}.$defs`).toBe("object");
    for (const [key, definition] of Object.entries(
      record.$defs as Record<string, unknown>,
    )) {
      expectRecursivelyStrictOutputSchema(
        definition,
        `${path}.$defs.${key}`,
      );
    }
  }
}

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

function mcpRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
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

function mcpBriefingContent(packet: Screen03BriefingPacket): Screen03BriefingContent {
  const conflictedClaims = packet.claims.filter((claim) =>
    claim.factStatus === "conflicted" || claim.supportStatus === "conflicting"
  );
  const briefingStatus = packet.requiredBriefingStatus;
  const evidenceId = packet.evidence[0]?.evidenceId;
  const sectionEvidenceIds = Object.fromEntries(
    screen03BriefingFactualSectionKeys.map((key) => [
      key,
      evidenceId ? [evidenceId] : [],
    ]),
  ) as Screen03BriefingSectionEvidenceIds;
  const factual = evidenceId
    ? "The bounded official evidence establishes this factual section."
    : SCREEN_03_BRIEFING_NOT_ESTABLISHED_TEXT;
  return {
    schemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
    briefingStatus,
    title: "Plain-language shock briefing",
    oneSentenceSummary: factual,
    whatTheShockIs: factual,
    whatChanged: factual,
    whyItMatters: factual,
    whoIsAffected: factual,
    eligibilityThresholdsAndExemptions: factual,
    importantTimingAndTreatmentStages: factual,
    enforcementAndPenalties: factual,
    laterChanges: factual,
    plausiblePathwayToResearcherOutcome:
      "ChatGPT interpretation: the shock could plausibly affect the selected outcome, but this remains an untested hypothesis.",
    unresolvedUncertainties: briefingStatus === "complete"
      ? []
      : [
          "The bounded records leave material coverage or conflict questions unresolved and require cautious interpretation.",
        ],
    acknowledgedMissingEvidenceIds: packet.missingEvidence.map(
      (item) => item.missingEvidenceId,
    ),
    acknowledgedConflictIds: [...new Set([
      ...packet.unresolvedConflicts.map((item) => item.conflictId),
      ...conflictedClaims.map((item) => item.proposalId),
    ])],
    sectionEvidenceIds,
    conciseRationale:
      "The proposed overview preserves the bounded source and interpretation boundaries.",
    hostModel: "host_model_not_exposed",
  };
}

function productionHarness(options: { officialEvidence?: boolean } = {}) {
  const screen02Store = new InMemoryScreen02WorkflowStore();
  const screen03Store = new InMemoryScreen03WorkflowStore();
  let requestId = 0;
  let connectorCalls = 0;
  const env: ShockAuditEnv = {
    ASSETS: {
      fetch: async () =>
        new Response(
          '<!doctype html><html><body><div id="root"></div></body></html>',
          { headers: { "content-type": "text/html" } },
        ),
    } as unknown as ShockAuditEnv["ASSETS"],
    CONNECTOR_FETCH: async (input) => {
      connectorCalls += 1;
      if (options.officialEvidence) {
        const url = new URL(String(input));
        if (url.hostname === "publications.europa.eu") {
          return new Response(JSON.stringify({
            results: {
              bindings: [{
                work: {
                  value:
                    "http://publications.europa.eu/resource/cellar/gdpr-mcp",
                },
                celex: { value: "32016R0679" },
                title: { value: "General Data Protection Regulation" },
                date: { value: "2016-05-04" },
                type: {
                  value:
                    "http://publications.europa.eu/resource/authority/resource-type/REG",
                },
              }],
            },
          }), {
            headers: { "content-type": "application/json" },
          });
        }
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response(
            `<html lang="en"><body><main>
              <h1>General Data Protection Regulation</h1>
              <p>Regulation (EU) 2016/679 protects natural persons with regard to processing personal data.</p>
              <p>It applies from 25 May 2018. Enforcement and exemptions remain subject to the controlling provisions.</p>
            </main></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
      }
      return new Response(JSON.stringify({ count: 0, results: [] }), {
        headers: { "content-type": "application/json" },
      });
    },
    NOW: () => "2026-08-09T18:10:00.000Z",
    SCREEN02_WORKFLOW_STORE: screen02Store,
    SCREEN03_WORKFLOW_STORE: screen03Store,
    SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen03-mcp-test-v1",
    SCREEN02_WORKFLOW_SIGNING_KEY:
      "ShockAudit-Screen03-MCP-test-signing-key-2026-08-12",
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
    SCREEN03_HOST_NATIVE_DEFAULT: "off",
  };
  const call = async (method: string, params: Record<string, unknown>) => {
    requestId += 1;
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: requestId,
        method,
        params,
      }) as never,
      env as never,
      executionContext as never,
    );
    expect(response.status).toBe(200);
    return readMcpPayload(response);
  };
  return {
    screen02Store,
    screen03Store,
    connectorCalls: () => connectorCalls,
    call,
    callTool: (name: string, args: Record<string, unknown>) =>
      call("tools/call", {
        name,
        arguments: args,
      }) as Promise<ToolCallPayload>,
  };
}

async function seedHistoricalBriefingChild(
  harness: ReturnType<typeof productionHarness>,
  runId: string,
  parent: {
    generation: number;
    stateRevision: number;
    stateFingerprint: string;
    expiresAt: string;
  },
) {
  const child = await harness.screen03Store.read(runId);
  if (child.outcome !== "found" || !child.record.handoffProducerAppVersion) {
    throw new Error("Expected a current Screen 3 child to migrate for compatibility testing.");
  }
  const raw = structuredClone(child.record.state);
  raw.releaseLabel = "v0.3.15";
  delete raw.orientation;
  delete raw.briefing;
  const { integrity: _integrity, ...fingerprintInput } = raw;
  const historical = requireScreen03VerificationState({
    ...fingerprintInput,
    integrity: {
      stateFingerprint: fingerprintScreen03Value(fingerprintInput),
    },
  });
  const state = attachScreen03BriefingLifecycle(
    historical,
    `s3ref_${"A".repeat(43)}`,
  );
  const update = await harness.screen03Store.update({
    parentRunId: runId,
    parentStateFingerprint: child.record.parentStateFingerprint,
    handoffProducerAppVersion: child.record.handoffProducerAppVersion,
    parentGuard: {
      runId,
      generation: parent.generation,
      revision: parent.stateRevision,
      stateFingerprint: parent.stateFingerprint,
      expiresAt: parent.expiresAt,
    },
    expected: {
      revision: child.record.stateRevision,
      stateFingerprint: child.record.stateFingerprint,
      generation: child.record.generation,
    },
    state,
    expiresAt: child.record.expiresAt,
  });
  if (update.outcome !== "updated") {
    throw new Error("Expected the historical Screen 3 fixture migration.");
  }
}

describe("Screen 3 production MCP boundary", () => {
  it("advertises strict app-only opener and mutation contracts", async () => {
    const harness = productionHarness();
    const payload = (await harness.call("tools/list", {})) as {
      result?: { tools?: ListedTool[] };
    };
    const tools = payload.result?.tools ?? [];
    const open = tools.find(
      (tool) => tool.name === SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
    );
    const mutate = tools.find(
      (tool) => tool.name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
    );
    const getBriefing = tools.find(
      (tool) => tool.name === SCREEN_03_BRIEFING_GET_TOOL,
    );
    const renderBriefing = tools.find(
      (tool) => tool.name === SCREEN_03_BRIEFING_RENDER_TOOL,
    );
    const confirmBriefing = tools.find(
      (tool) => tool.name === SCREEN_03_BRIEFING_CONFIRM_TOOL,
    );

    expect(open?.inputSchema?.properties).toMatchObject({
      refresh: { type: "boolean" },
      targetProposalId: { type: "string" },
    });

    for (const tool of [open, mutate]) {
      expect(tool).toBeDefined();
      expect(tool?._meta?.ui).toEqual({ visibility: ["app"] });
      expect(tool?._meta?.["openai/widgetAccessible"]).toBe(true);
      expect(tool?._meta?.["ui/resourceUri"]).toBeUndefined();
      expect(tool?._meta?.["openai/outputTemplate"]).toBeUndefined();
      expect(tool?.inputSchema?.type).toBe("object");
      if (tool?.inputSchema?.additionalProperties !== undefined) {
        expect(tool.inputSchema.additionalProperties).toBe(false);
      }
      if (tool?.outputSchema?.additionalProperties !== undefined) {
        expect(tool.outputSchema.additionalProperties).toBe(false);
      }
      expect(Object.keys(tool?.outputSchema?.properties ?? {}).sort()).toEqual(
        [
          "schemaVersion",
          "screen",
          "ok",
          "outcome",
          "message",
          "sealedState",
        ].sort(),
      );
    }

    expect(open?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(Object.keys(open?.inputSchema?.properties ?? {}).sort()).toEqual(
      [
        "schemaVersion",
        "operationId",
        "responseKeyId",
        "responseKey",
        "runId",
        "accessToken",
        "expectedRevision",
        "expectedStateFingerprint",
        "expectedHandoffProducerAppVersion",
        "expectedHandoffFingerprint",
        "refresh",
        "targetProposalId",
      ].sort(),
    );
    expect(open?.inputSchema?.required?.sort()).toEqual([
      "schemaVersion",
      "operationId",
      "responseKeyId",
      "responseKey",
      "runId",
      "accessToken",
      "expectedRevision",
      "expectedStateFingerprint",
    ].sort());

    expect(mutate?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
    const mutationWireContract = JSON.stringify(mutate?.inputSchema);
    for (const action of [
      "review-field",
      "review-all-fields",
      "select-focal-clock",
      "resolve-contradiction",
      "mark-source-changed",
      "lock-event-card",
    ]) {
      expect(mutationWireContract).toContain(action);
    }
    expect(mutationWireContract).toContain("sha256:");

    expect(getBriefing?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
    expect(getBriefing?._meta?.ui).toEqual({ visibility: ["app"] });
    expect(getBriefing?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(getBriefing?._meta?.["ui/resourceUri"]).toBeUndefined();
    expect(getBriefing?._meta?.["openai/outputTemplate"]).toBeUndefined();
    expect(Object.keys(getBriefing?.inputSchema?.properties ?? {}).sort()).toEqual(
      ["schemaVersion", "safeRunRef", "selectedEventId"].sort(),
    );
    expect(getBriefing?.inputSchema?.required?.sort()).toEqual(
      ["schemaVersion", "safeRunRef", "selectedEventId"].sort(),
    );
    expect(renderBriefing?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(renderBriefing?._meta?.ui).toEqual({ visibility: ["app"] });
    expect(renderBriefing?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(renderBriefing?._meta?.["ui/resourceUri"]).toBeUndefined();
    expect(renderBriefing?._meta?.["openai/outputTemplate"]).toBeUndefined();
    expect(renderBriefing?.description).toMatch(
      /compatibility-only.*current workflows.*one-submission host-task protocol/is,
    );
    expect(
      renderBriefing?._meta?.["openai/toolInvocation/invoked"],
    ).toBe("Briefing rendered — review the newest ShockAudit card");
    expect(Object.keys(renderBriefing?.inputSchema?.properties ?? {}).sort()).toEqual(
      [
        "schemaVersion",
        "skillVersion",
        "workflowVersion",
        "safeRunRef",
        "packetId",
        "packetHash",
        "selectedEventId",
        "content",
      ].sort(),
    );
    expect(Object.keys(renderBriefing?.outputSchema?.properties ?? {}).sort()).toEqual(
      [
        "schemaVersion",
        "outcome",
        "proposalId",
        "briefing",
        "sources",
        "issues",
        "message",
      ].sort(),
    );
    expect(confirmBriefing?._meta?.ui).toEqual({ visibility: ["app"] });
    expect(confirmBriefing?._meta?.["openai/widgetAccessible"]).toBe(true);
    expect(confirmBriefing?._meta?.["ui/resourceUri"]).toBeUndefined();
    expect(confirmBriefing?._meta?.["openai/outputTemplate"]).toBeUndefined();
    expect(confirmBriefing?.description).toMatch(
      /source-referenced, packet-validated proposal/i,
    );
    expect(confirmBriefing?.description).not.toMatch(/source-validated/i);
    expect(
      confirmBriefing?._meta?.["openai/toolInvocation/invoked"],
    ).toBe("Researcher briefing decision check complete");
    for (const tool of [getBriefing, renderBriefing, confirmBriefing]) {
      expect(tool?.inputSchema?.additionalProperties).toBe(false);
      expect(tool?.outputSchema?.additionalProperties).toBe(false);
    }
    expectRecursivelyStrictOutputSchema(
      getBriefing?.outputSchema,
      SCREEN_03_BRIEFING_GET_TOOL,
    );
  });

  it("rejects a claim target unless the app explicitly requests a research refresh", async () => {
    const harness = productionHarness();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exportedResponseKey =
      await exportScreen02ResponseKeyMaterial(responseKey);
    const result = await harness.callTool(SCREEN_03_WORKFLOW_OPEN_TOOL_V030, {
      schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
      operationId: "screen03-target-without-refresh",
      responseKeyId: exportedResponseKey.keyId,
      responseKey: exportedResponseKey.key,
      runId: `s2r_${"R".repeat(43)}`,
      accessToken: `s2a_${"A".repeat(43)}`,
      expectedRevision: 0,
      expectedStateFingerprint: "fnv1a64:1234567890abcdef",
      targetProposalId: "screen03-proposal-current-claim",
    });

    expect(result.result?.isError).toBe(true);
    expect(JSON.stringify(result.result?.content)).toMatch(
      /targetProposalId.*refresh|requires refresh/i,
    );
    expect(harness.connectorCalls()).toBe(0);
  });

  it("keeps render and confirmation secrets in hidden metadata while returning a complete refreshed bootstrap", async () => {
    const harness = productionHarness();
    const identity = createScreen02WorkflowStoreIdentity();
    const raw = structuredClone(buildReadyFindState());
    raw.runId = identity.runId;
    delete raw.shockGlances;
    const parentState = requireScreen02FindState(raw);
    const created = await harness.screen02Store.create({
      ...identity,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(parentState),
    });
    if (created.outcome !== "created") throw new Error("Expected Screen 2 fixture.");
    const openKey = await generateScreen02ResponseKeyMaterial();
    const exportedOpenKey = await exportScreen02ResponseKeyMaterial(openKey);
    const open = await harness.callTool(SCREEN_03_WORKFLOW_OPEN_TOOL_V030, {
      schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
      operationId: "screen03-host-native-mcp-open",
      responseKeyId: exportedOpenKey.keyId,
      responseKey: exportedOpenKey.key,
      runId: identity.runId,
      accessToken: identity.accessToken,
      expectedRevision: created.record.stateRevision,
      expectedStateFingerprint: created.record.stateFingerprint,
    });
    expect(open.result?.isError, JSON.stringify(open.result?.content)).not.toBe(true);
    let opened = await decryptScreen03VerificationState(
      open.result?.structuredContent?.sealedState,
      {
        operationId: "screen03-host-native-mcp-open",
        kind: "open",
        responseKey: openKey,
      },
    );
    expect(opened.orientation?.current.summary).toBeTruthy();
    expect(opened.briefing).toBeUndefined();
    expect(open.result?._meta?.["shockaudit/screen03Bootstrap"]).toBeUndefined();
    await seedHistoricalBriefingChild(harness, identity.runId, created.record);
    const historicalOpenKey = await generateScreen02ResponseKeyMaterial();
    const exportedHistoricalOpenKey =
      await exportScreen02ResponseKeyMaterial(historicalOpenKey);
    const historicalOpen = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
        operationId: "screen03-host-native-mcp-historical-open",
        responseKeyId: exportedHistoricalOpenKey.keyId,
        responseKey: exportedHistoricalOpenKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
      },
    );
    expect(
      historicalOpen.result?.isError,
      JSON.stringify(historicalOpen.result?.content),
    ).not.toBe(true);
    opened = await decryptScreen03VerificationState(
      historicalOpen.result?.structuredContent?.sealedState,
      {
        operationId: "screen03-host-native-mcp-historical-open",
        kind: "open",
        responseKey: historicalOpenKey,
      },
    );
    expect(opened.releaseLabel).toBe("v0.3.15");
    expect(opened.orientation?.current.summary).toBeTruthy();
    const safeRunRef = opened.briefing?.safeRunRef;
    if (!safeRunRef) throw new Error("Expected the safe briefing reference.");
    const selectedEventId = parentState.decision.tentativeSelectionSnapshotId;
    if (!selectedEventId) throw new Error("Expected the selected event ID.");
    const connectorCallsBeforeBriefing = harness.connectorCalls();
    const mismatchedGet = await harness.callTool(SCREEN_03_BRIEFING_GET_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION,
      safeRunRef,
      selectedEventId: "another-event-snapshot",
    });
    expect(mismatchedGet.result?.isError).toBe(true);
    expect(JSON.stringify(mismatchedGet.result?.structuredContent) ?? "").not.toMatch(
      /sa3b-packet-v1/,
    );
    const get = await harness.callTool(SCREEN_03_BRIEFING_GET_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION,
      safeRunRef,
      selectedEventId,
    });
    expect(get.result?.isError, JSON.stringify(get.result?.content)).not.toBe(true);
    const fnvPacket = get.result?.structuredContent as unknown as Screen03BriefingPacket;
    expect(fnvPacket.aliases).toEqual(parentState.candidates.find(
      (candidate) => candidate.candidateSnapshotId === selectedEventId,
    )?.identity.commonNames);
    expect(fnvPacket.evidence[0]).toMatchObject({
      retrievedAt: expect.stringMatching(/Z$/),
      contentFingerprint: expect.stringMatching(
        /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/,
      ),
    });

    const child = await harness.screen03Store.read(identity.runId);
    if (child.outcome !== "found") {
      throw new Error("Expected the canonical Screen 3 child.");
    }
    if (!child.record.handoffProducerAppVersion) {
      throw new Error("Expected the original handoff producer version.");
    }
    const { integrity: _integrity, ...stateWithoutIntegrity } =
      child.record.state;
    if (stateWithoutIntegrity.evidence.length < 1 ||
      stateWithoutIntegrity.evidence.length > 3) {
      throw new Error("Expected a bounded MCP evidence fixture baseline.");
    }
    const expandedEvidence = [...stateWithoutIntegrity.evidence];
    while (expandedEvidence.length < 3) {
      const ordinal = expandedEvidence.length + 1;
      const added = structuredClone(stateWithoutIntegrity.evidence[0]);
      if (!added) throw new Error("Expected an evidence fixture.");
      added.id = `screen03-mcp-sha-evidence-${ordinal}`;
      added.sourceId = `screen03-mcp-sha-source-${ordinal}`;
      added.title = `Bounded SHA-256 evidence record ${ordinal}`;
      added.passages = added.passages.map((passage, index) => ({
        ...passage,
        id: `screen03-mcp-sha-passage-${ordinal}-${index + 1}`,
      }));
      expandedEvidence.push(added);
    }
    const evidence = expandedEvidence.map((item, index) => ({
      ...item,
      contentFingerprint: `sha256:${(index + 1).toString(16).padStart(64, "0")}`,
    }));
    const fingerprintInput = {
      ...stateWithoutIntegrity,
      evidence,
      researchCoverage: {
        ...stateWithoutIntegrity.researchCoverage,
        activeEvidenceCount: evidence.length,
      },
    };
    const shaState = requireScreen03VerificationState({
      ...fingerprintInput,
      integrity: {
        stateFingerprint: fingerprintScreen03Value(fingerprintInput),
      },
    });
    const shaUpdate = await harness.screen03Store.update({
      parentRunId: identity.runId,
      parentStateFingerprint: child.record.parentStateFingerprint,
      handoffProducerAppVersion: child.record.handoffProducerAppVersion,
      parentGuard: {
        runId: identity.runId,
        generation: created.record.generation,
        revision: created.record.stateRevision,
        stateFingerprint: created.record.stateFingerprint,
        expiresAt: created.record.expiresAt,
      },
      expected: {
        revision: child.record.stateRevision,
        stateFingerprint: child.record.stateFingerprint,
        generation: child.record.generation,
      },
      state: shaState,
      expiresAt: child.record.expiresAt,
    });
    if (shaUpdate.outcome !== "updated") {
      throw new Error("Expected the SHA-256 fixture update.");
    }

    const shaGet = await harness.callTool(SCREEN_03_BRIEFING_GET_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION,
      safeRunRef,
      selectedEventId,
    });
    expect(
      shaGet.result?.isError,
      JSON.stringify(shaGet.result?.content),
    ).not.toBe(true);
    const packet = shaGet.result
      ?.structuredContent as unknown as Screen03BriefingPacket;
    expect(packet.evidence).toHaveLength(3);
    expect(packet.evidence.every((item) =>
      /^sha256:[0-9a-f]{64}$/.test(item.contentFingerprint)
    )).toBe(true);
    expect(packet).toMatchObject({
      safeRunRef,
      selectedEventId,
      screen03Revision: shaUpdate.record.stateRevision,
      screen03StateFingerprint: shaUpdate.record.stateFingerprint,
    });
    const missingVersions = await harness.callTool(
      SCREEN_03_BRIEFING_RENDER_TOOL,
      {
        schemaVersion: SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
        safeRunRef,
        packetId: packet.packetId,
        packetHash: packet.packetHash,
        selectedEventId: packet.selectedEventId,
        content: mcpBriefingContent(packet),
      },
    );
    expect(missingVersions.result?.isError).toBe(true);
    const wrongSkillVersion = await harness.callTool(
      SCREEN_03_BRIEFING_RENDER_TOOL,
      {
        schemaVersion: SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
        skillVersion: "screen3-shock-briefing-v0",
        workflowVersion: SCREEN_03_BRIEFING_WORKFLOW_VERSION,
        safeRunRef,
        packetId: packet.packetId,
        packetHash: packet.packetHash,
        selectedEventId: packet.selectedEventId,
        content: mcpBriefingContent(packet),
      },
    );
    expect(wrongSkillVersion.result?.isError).toBe(true);
    const wrongWorkflowVersion = await harness.callTool(
      SCREEN_03_BRIEFING_RENDER_TOOL,
      {
        schemaVersion: SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
        skillVersion: SCREEN_03_BRIEFING_SKILL_VERSION,
        workflowVersion: "screen3-host-native-v0",
        safeRunRef,
        packetId: packet.packetId,
        packetHash: packet.packetHash,
        selectedEventId: packet.selectedEventId,
        content: mcpBriefingContent(packet),
      },
    );
    expect(wrongWorkflowVersion.result?.isError).toBe(true);
    const render = await harness.callTool(SCREEN_03_BRIEFING_RENDER_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
      skillVersion: SCREEN_03_BRIEFING_SKILL_VERSION,
      workflowVersion: SCREEN_03_BRIEFING_WORKFLOW_VERSION,
      safeRunRef,
      packetId: packet.packetId,
      packetHash: packet.packetHash,
      selectedEventId: packet.selectedEventId,
      content: mcpBriefingContent(packet),
    });
    expect(render.result?.isError, JSON.stringify(render.result?.content)).not.toBe(true);
    expect(render.result?.structuredContent?.outcome).toBe("proposed");
    expect(harness.connectorCalls()).toBe(connectorCallsBeforeBriefing);
    const renderPublic = JSON.stringify(render.result?.structuredContent);
    expect(renderPublic).not.toMatch(
      /continuationToken|accessToken|responseKey|screen02Workflow|privateBootstrap|safeRunRef|packetId|packetHash/i,
    );
    expect(render.result?.structuredContent?.briefing).toEqual(
      mcpBriefingContent(packet),
    );
    expect(render.result?.structuredContent?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceId: packet.evidence[0]?.evidenceId,
          permittedLink: packet.evidence[0]?.permittedLink,
        }),
      ]),
    );
    expect(render.result?.structuredContent?.issues).toEqual([
      ...packet.missingEvidence.map((item) => ({
        kind: "missing-evidence",
        id: item.missingEvidenceId,
        description: item.description,
      })),
      ...packet.unresolvedConflicts.map((item) => ({
        kind: "unresolved-conflict",
        id: item.conflictId,
        description: item.summary,
      })),
      ...packet.claims
        .filter((item) =>
          item.factStatus === "conflicted" ||
          item.supportStatus === "conflicting"
        )
        .map((item) => ({
          kind: "conflicted-claim",
          id: item.proposalId,
          description: item.uncertainty ?? item.label,
        })),
    ]);
    const renderMeta = render.result?._meta ?? {};
    expect(renderMeta["shockaudit/screen02Workflow"]).toBeDefined();
    expect(renderMeta["shockaudit/screen03Workflow"]).toBeDefined();
    expect(renderMeta["shockaudit/screen03HostNativeDefault"]).toBe(false);
    const renderBootstrap = renderMeta["shockaudit/screen03Bootstrap"] as {
      continuationToken?: string;
      widget?: { state?: unknown };
    };
    expect(renderBootstrap.continuationToken).toMatch(
      /^sa3b-continuation-v1\./,
    );
    const renderedWidget = renderBootstrap.widget as {
      state: typeof opened;
    };
    const proposalId = renderedWidget.state.briefing?.activeProposalId;
    if (!proposalId) throw new Error("Expected the active briefing proposal ID.");
    expect(render.result?.structuredContent?.proposalId).toBe(proposalId);
    const malformedRevision = await harness.callTool(
      SCREEN_03_BRIEFING_CONFIRM_TOOL,
      {
        schemaVersion: SCREEN_03_BRIEFING_CONFIRM_INPUT_SCHEMA_VERSION,
        continuationToken: renderBootstrap.continuationToken,
        proposalId,
        expectedScreen03Revision: renderedWidget.state.revision,
        expectedScreen03StateFingerprint:
          fingerprintScreen03VerificationState(renderedWidget.state),
        decision: {
          action: "revise",
          reason: "This malformed revision must fail before persistence.",
          content: { title: "Incomplete" },
        },
      },
    );
    expect(malformedRevision.result?.isError).toBe(true);
    const connectorCallsBeforeRecovery = harness.connectorCalls();
    const recoveryKey = await generateScreen02ResponseKeyMaterial();
    const exportedRecoveryKey = await exportScreen02ResponseKeyMaterial(
      recoveryKey,
    );
    const recovery = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
        operationId: "screen03-host-native-mcp-recovery",
        responseKeyId: exportedRecoveryKey.keyId,
        responseKey: exportedRecoveryKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
        refresh: false,
      },
    );
    expect(recovery.result?.isError).not.toBe(true);
    const recoveredState = await decryptScreen03VerificationState(
      recovery.result?.structuredContent?.sealedState,
      {
        operationId: "screen03-host-native-mcp-recovery",
        kind: "open",
        responseKey: recoveryKey,
      },
    );
    expect(recoveredState).toEqual(renderedWidget.state);
    expect(harness.connectorCalls()).toBe(connectorCallsBeforeRecovery);
    const recoveryMeta = recovery.result?._meta ?? {};
    const recoveryBootstrap = recoveryMeta[
      "shockaudit/screen03Bootstrap"
    ] as { continuationToken?: string };
    expect(recoveryBootstrap.continuationToken).toMatch(
      /^sa3b-continuation-v1\./,
    );
    const confirm = await harness.callTool(SCREEN_03_BRIEFING_CONFIRM_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_CONFIRM_INPUT_SCHEMA_VERSION,
      continuationToken: recoveryBootstrap.continuationToken,
      proposalId,
      expectedScreen03Revision: renderedWidget.state.revision,
      expectedScreen03StateFingerprint:
        fingerprintScreen03VerificationState(renderedWidget.state),
      decision: {
        action: "confirm",
        reason: "The researcher confirms the source-linked overview.",
      },
    });
    expect(confirm.result?.isError, JSON.stringify(confirm.result?.content)).not.toBe(true);
    const confirmPublic = JSON.stringify(confirm.result?.structuredContent);
    expect(confirmPublic).not.toMatch(
      /continuationToken|accessToken|responseKey|screen02Workflow|privateBootstrap/i,
    );
    expect(confirm.result?.structuredContent?.outcome).toBe("confirmed");
    const confirmMeta = confirm.result?._meta ?? {};
    expect(confirmMeta["shockaudit/screen02Workflow"]).toBeDefined();
    expect(confirmMeta["shockaudit/screen03Workflow"]).toBeDefined();
    expect(confirmMeta["shockaudit/screen03Bootstrap"]).toMatchObject({
      schemaVersion: "screen-03-host-briefing-bootstrap-v1",
      continuationToken: expect.stringMatching(/^sa3b-continuation-v1\./),
    });
  });

  it("returns no phantom proposal or losing briefing when a different render wins the CAS race", async () => {
    const harness = productionHarness();
    const identity = createScreen02WorkflowStoreIdentity();
    const raw = structuredClone(buildReadyFindState());
    raw.runId = identity.runId;
    delete raw.shockGlances;
    const parentState = requireScreen02FindState(raw);
    const created = await harness.screen02Store.create({
      ...identity,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(parentState),
    });
    if (created.outcome !== "created") throw new Error("Expected Screen 2 fixture.");
    const openKey = await generateScreen02ResponseKeyMaterial();
    const exportedOpenKey = await exportScreen02ResponseKeyMaterial(openKey);
    const open = await harness.callTool(SCREEN_03_WORKFLOW_OPEN_TOOL_V030, {
      schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
      operationId: "screen03-host-native-mcp-race-open",
      responseKeyId: exportedOpenKey.keyId,
      responseKey: exportedOpenKey.key,
      runId: identity.runId,
      accessToken: identity.accessToken,
      expectedRevision: created.record.stateRevision,
      expectedStateFingerprint: created.record.stateFingerprint,
    });
    expect(open.result?.isError).not.toBe(true);
    let opened = await decryptScreen03VerificationState(
      open.result?.structuredContent?.sealedState,
      {
        operationId: "screen03-host-native-mcp-race-open",
        kind: "open",
        responseKey: openKey,
      },
    );
    expect(opened.briefing).toBeUndefined();
    await seedHistoricalBriefingChild(harness, identity.runId, created.record);
    const historicalOpenKey = await generateScreen02ResponseKeyMaterial();
    const exportedHistoricalOpenKey =
      await exportScreen02ResponseKeyMaterial(historicalOpenKey);
    const historicalOpen = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
        operationId: "screen03-host-native-mcp-race-historical-open",
        responseKeyId: exportedHistoricalOpenKey.keyId,
        responseKey: exportedHistoricalOpenKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
      },
    );
    expect(
      historicalOpen.result?.isError,
      JSON.stringify(historicalOpen.result?.content),
    ).not.toBe(true);
    opened = await decryptScreen03VerificationState(
      historicalOpen.result?.structuredContent?.sealedState,
      {
        operationId: "screen03-host-native-mcp-race-historical-open",
        kind: "open",
        responseKey: historicalOpenKey,
      },
    );
    const safeRunRef = opened.briefing?.safeRunRef;
    if (!safeRunRef) throw new Error("Expected the safe briefing reference.");
    const selectedEventId = parentState.decision.tentativeSelectionSnapshotId;
    if (!selectedEventId) throw new Error("Expected the selected event ID.");
    const get = await harness.callTool(SCREEN_03_BRIEFING_GET_TOOL, {
      schemaVersion: SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION,
      safeRunRef,
      selectedEventId,
    });
    expect(get.result?.isError).not.toBe(true);
    const packet = get.result?.structuredContent as unknown as Screen03BriefingPacket;
    const baseContent = mcpBriefingContent(packet);
    const losingContent = {
      ...baseContent,
      title: "Losing render must never be published",
    };
    const winningContent = {
      ...baseContent,
      title: "Persisted canonical render",
    };

    const originalUpdate = harness.screen03Store.update.bind(
      harness.screen03Store,
    );
    let renderUpdateCount = 0;
    let releaseFirstUpdate!: () => void;
    const firstUpdateMayContinue = new Promise<void>((resolve) => {
      releaseFirstUpdate = resolve;
    });
    let firstUpdateReached!: () => void;
    const firstUpdateIsWaiting = new Promise<void>((resolve) => {
      firstUpdateReached = resolve;
    });
    harness.screen03Store.update = async (input) => {
      renderUpdateCount += 1;
      if (renderUpdateCount === 1) {
        firstUpdateReached();
        await firstUpdateMayContinue;
      }
      return originalUpdate(input);
    };
    const renderArgs = {
      schemaVersion: SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION,
      skillVersion: SCREEN_03_BRIEFING_SKILL_VERSION,
      workflowVersion: SCREEN_03_BRIEFING_WORKFLOW_VERSION,
      safeRunRef,
      packetId: packet.packetId,
      packetHash: packet.packetHash,
      selectedEventId: packet.selectedEventId,
    };
    const losingRenderPromise = harness.callTool(
      SCREEN_03_BRIEFING_RENDER_TOOL,
      { ...renderArgs, content: losingContent },
    );
    await firstUpdateIsWaiting;
    let winningRender: ToolCallPayload;
    try {
      winningRender = await harness.callTool(
        SCREEN_03_BRIEFING_RENDER_TOOL,
        { ...renderArgs, content: winningContent },
      );
    } finally {
      releaseFirstUpdate();
    }
    const losingRender = await losingRenderPromise;

    expect(winningRender.result?.isError).not.toBe(true);
    expect(winningRender.result?.structuredContent).toMatchObject({
      outcome: "proposed",
      briefing: winningContent,
    });
    expect(losingRender.result?.isError).not.toBe(true);
    expect(losingRender.result?.structuredContent).toMatchObject({
      outcome: "conflict",
      proposalId: null,
      briefing: null,
      sources: [],
      issues: [],
    });
    expect(JSON.stringify(losingRender.result?.structuredContent)).not.toContain(
      losingContent.title,
    );

    type BriefingBootstrap = {
      widget?: {
        state?: {
          briefing?: {
            proposals?: Array<{
              proposalId: string;
              content: Screen03BriefingContent;
            }>;
          };
        };
      };
    };
    const canonicalBootstrap = losingRender.result?._meta?.[
      "shockaudit/screen03Bootstrap"
    ] as BriefingBootstrap;
    const canonicalProposals = canonicalBootstrap.widget?.state?.briefing
      ?.proposals ?? [];
    expect(canonicalProposals).toHaveLength(1);
    expect(canonicalProposals[0]?.content).toEqual(winningContent);
    expect(JSON.stringify(canonicalBootstrap)).not.toContain(
      losingContent.title,
    );
    for (const render of [winningRender, losingRender]) {
      const proposalId = render.result?.structuredContent?.proposalId;
      if (typeof proposalId !== "string") continue;
      const bootstrap = render.result?._meta?.[
        "shockaudit/screen03Bootstrap"
      ] as BriefingBootstrap;
      expect(
        bootstrap.widget?.state?.briefing?.proposals?.some(
          (proposal) => proposal.proposalId === proposalId,
        ),
      ).toBe(true);
    }
  });

  it("returns only opaque sealed state for open and mutation while the app key restores the canonical review", async () => {
    const harness = productionHarness({ officialEvidence: true });
    const identity = createScreen02WorkflowStoreIdentity();
    const raw = structuredClone(buildReadyFindState());
    raw.runId = identity.runId;
    delete raw.shockGlances;
    const parentState = requireScreen02FindState(raw);
    const created = await harness.screen02Store.create({
      ...identity,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(parentState),
    });
    if (created.outcome !== "created") throw new Error("Expected Screen 2 fixture.");

    const openOperationId = "screen03-mcp-sealed-open";
    const openResponseKey = await generateScreen02ResponseKeyMaterial();
    const exportedOpenKey =
      await exportScreen02ResponseKeyMaterial(openResponseKey);
    const openedPayload = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
        operationId: openOperationId,
        responseKeyId: exportedOpenKey.keyId,
        responseKey: exportedOpenKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
      },
    );
    expect(
      openedPayload.result?.isError,
      JSON.stringify(openedPayload.result?.content),
    ).not.toBe(true);
    const openedWire = openedPayload.result?.structuredContent;
    expect(Object.keys(openedWire ?? {}).sort()).toEqual(
      [
        "schemaVersion",
        "screen",
        "ok",
        "outcome",
        "message",
        "sealedState",
      ].sort(),
    );
    expect(openedWire).not.toHaveProperty("state");
    const openedJson = JSON.stringify(openedWire);
    for (const plaintextMarker of [
      parentState.screen01Baseline.studySentence,
      '"evidence"',
      '"proposals"',
      '"history"',
      '"reviewStatus"',
    ]) {
      expect(openedJson).not.toContain(plaintextMarker);
    }
    const opened = await decryptScreen03VerificationState(
      openedWire?.sealedState,
      {
        operationId: openOperationId,
        kind: "open",
        responseKey: openResponseKey,
      },
    );
    expect(opened.runId).toBe(identity.runId);
    expect(opened.evidence).toBeDefined();
    expect(opened.history.length).toBeGreaterThan(0);
    expect(opened.orientation?.current.summary).toBeTruthy();
    expect(opened.briefing).toBeUndefined();
    expect(openedPayload.result?._meta?.["shockaudit/screen03Bootstrap"])
      .toBeUndefined();
    expect(openedPayload.result?._meta?.["shockaudit/screen02Workflow"])
      .toBeUndefined();
    expect(openedPayload.result?._meta?.["shockaudit/screen03Workflow"])
      .toMatchObject({ activeScreen: 3 });

    const proposal = screen03FactualClaims(opened.proposals).find(
      (candidate) => !screen03ProposalConfirmability(
        candidate,
        opened.evidence,
      ).confirmable,
    );
    if (!proposal) throw new Error("Expected an unconfirmable Screen 3 claim.");
    const mutationOperationId = "screen03-mcp-sealed-mutation";
    const mutationResponseKey = await generateScreen02ResponseKeyMaterial();
    const exportedMutationKey =
      await exportScreen02ResponseKeyMaterial(mutationResponseKey);
    const decisionReason = "Keep this proposal explicitly unresolved for review.";
    const mutationPayload = await harness.callTool(
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
        operationId: mutationOperationId,
        responseKeyId: exportedMutationKey.keyId,
        responseKey: exportedMutationKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
        expectedScreen03Revision: opened.revision,
        expectedScreen03StateFingerprint:
          fingerprintScreen03VerificationState(opened),
        action: {
          type: "review-field",
          proposalId: proposal.id,
          decision: "unresolved",
          reason: decisionReason,
        },
      },
    );
    expect(mutationPayload.result?.isError).not.toBe(true);
    const mutationWire = mutationPayload.result?.structuredContent;
    expect(mutationWire).not.toHaveProperty("state");
    const mutationJson = JSON.stringify(mutationWire);
    expect(mutationJson).not.toContain(proposal.id);
    expect(mutationJson).not.toContain(decisionReason);
    expect(mutationJson).not.toContain('"history"');
    const mutated = await decryptScreen03VerificationState(
      mutationWire?.sealedState,
      {
        operationId: mutationOperationId,
        kind: "mutation",
        responseKey: mutationResponseKey,
      },
    );
    expect(mutated.revision).toBe(opened.revision + 1);
    expect(mutated.history.at(-1)).toMatchObject({
      action: "review-field",
      targetId: proposal.id,
      reason: decisionReason,
    });

    const bulkOperationId = "screen03-mcp-sealed-bulk-confirm";
    const bulkResponseKey = await generateScreen02ResponseKeyMaterial();
    const exportedBulkKey =
      await exportScreen02ResponseKeyMaterial(bulkResponseKey);
    const bulkReason =
      "Confirm every directly supported claim and preserve all evidence gaps.";
    const beforeBulk = screen03FactualClaims(mutated.proposals);
    const bulkEligibleIds = beforeBulk
      .filter((item) =>
        item.reviewStatus === "proposed" &&
        screen03ProposalConfirmability(item, mutated.evidence).confirmable
      )
      .map((item) => item.id);
    expect(bulkEligibleIds.length).toBeGreaterThan(0);
    const bulkPayload = await harness.callTool(
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
        operationId: bulkOperationId,
        responseKeyId: exportedBulkKey.keyId,
        responseKey: exportedBulkKey.key,
        runId: identity.runId,
        accessToken: identity.accessToken,
        expectedRevision: created.record.stateRevision,
        expectedStateFingerprint: created.record.stateFingerprint,
        expectedScreen03Revision: mutated.revision,
        expectedScreen03StateFingerprint:
          fingerprintScreen03VerificationState(mutated),
        action: {
          type: "review-all-fields",
          mode: "confirm",
          reason: bulkReason,
        },
      },
    );
    expect(
      bulkPayload.result?.isError,
      JSON.stringify(bulkPayload.result?.content),
    ).not.toBe(true);
    const bulkWire = bulkPayload.result?.structuredContent;
    expect(bulkWire).not.toHaveProperty("state");
    const bulkWireJson = JSON.stringify(bulkWire);
    expect(bulkWireJson).not.toContain(proposal.id);
    expect(bulkWireJson).not.toContain(bulkReason);
    expect(bulkWireJson).not.toContain('"history"');
    const bulkReviewed = await decryptScreen03VerificationState(
      bulkWire?.sealedState,
      {
        operationId: bulkOperationId,
        kind: "mutation",
        responseKey: bulkResponseKey,
      },
    );
    const factual = screen03FactualClaims(bulkReviewed.proposals);
    expect(bulkReviewed.revision).toBeGreaterThan(mutated.revision);
    expect(factual.length).toBeGreaterThan(0);
    expect(factual.filter((item) => bulkEligibleIds.includes(item.id)).every(
      (item) => item.reviewStatus === "accepted",
    )).toBe(true);
    const beforeBulkById = new Map(beforeBulk.map((item) => [item.id, item]));
    expect(factual.filter((item) => !bulkEligibleIds.includes(item.id)).every(
      (item) => {
        const prior = beforeBulkById.get(item.id);
        return prior?.reviewStatus === item.reviewStatus &&
          prior.editedValue === item.editedValue;
      },
    )).toBe(true);
    expect(
      bulkReviewed.proposals.requiredVariable.every(
        (item) => item.reviewStatus === "proposed",
      ),
    ).toBe(true);
    expect(bulkReviewed.history.slice(mutated.history.length).map((event) =>
      event.targetId
    )).toEqual(bulkEligibleIds);
    expect(bulkReviewed.history.slice(mutated.history.length).every((event) =>
      event.action === "review-field" &&
      event.nextReviewStatus === "accepted" &&
      event.reason === bulkReason
    )).toBe(true);
  });

  it("rejects client-supplied handoffs and missing canonical parents before research or persistence", async () => {
    const harness = productionHarness();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exportedResponseKey =
      await exportScreen02ResponseKeyMaterial(responseKey);
    const coordinates = {
      schemaVersion: SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION,
      operationId: "screen03-client-handoff-rejected",
      responseKeyId: exportedResponseKey.keyId,
      responseKey: exportedResponseKey.key,
      runId: `s2r_${"R".repeat(43)}`,
      accessToken: `s2a_${"A".repeat(43)}`,
      expectedRevision: 8,
      expectedStateFingerprint: "fnv1a64:1234567890abcdef",
    };
    const injected = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        ...coordinates,
        handoff: {
          schemaVersion: "screen-02-to-screen-03-event-v4",
          event: { identity: { canonicalTitle: "Client substitute" } },
        },
      },
    );
    expect(injected.result?.isError).toBe(true);
    expect(JSON.stringify(injected.result?.content)).toMatch(
      /unrecognized|invalid|unsupported/i,
    );

    const missing = await harness.callTool(
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      {
        ...coordinates,
        operationId: "screen03-missing-parent",
      },
    );
    expect(missing.result?.isError).toBe(true);
    expect(JSON.stringify(missing.result?.content)).toMatch(
      /unavailable|expired/i,
    );
    expect(harness.connectorCalls()).toBe(0);
    await expect(harness.screen03Store.read(coordinates.runId)).resolves.toEqual(
      { outcome: "not-found" },
    );
    await expect(
      harness.screen02Store.readTrusted({ runId: coordinates.runId }),
    ).resolves.toEqual({ outcome: "not-found" });
  });

  it("rejects unknown mutation fields before touching either canonical store", async () => {
    const harness = productionHarness();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exportedResponseKey =
      await exportScreen02ResponseKeyMaterial(responseKey);
    const runId = `s2r_${"R".repeat(43)}`;
    const payload = await harness.callTool(
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
        operationId: "screen03-invalid-mutation-shape",
        responseKeyId: exportedResponseKey.keyId,
        responseKey: exportedResponseKey.key,
        runId,
        accessToken: `s2a_${"A".repeat(43)}`,
        expectedRevision: 8,
        expectedStateFingerprint: "fnv1a64:1234567890abcdef",
        expectedScreen03Revision: 1,
        expectedScreen03StateFingerprint: "fnv1a64:fedcba0987654321",
        action: {
          type: "lock-event-card",
          reason: "Attempt a malformed mutation.",
          outcomeValue: 94721,
        },
      },
    );

    expect(payload.result?.isError).toBe(true);

    const injectedBulkIds = await harness.callTool(
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
        operationId: "screen03-invalid-bulk-targets",
        responseKeyId: exportedResponseKey.keyId,
        responseKey: exportedResponseKey.key,
        runId,
        accessToken: `s2a_${"A".repeat(43)}`,
        expectedRevision: 8,
        expectedStateFingerprint: "fnv1a64:1234567890abcdef",
        expectedScreen03Revision: 1,
        expectedScreen03StateFingerprint: "fnv1a64:fedcba0987654321",
        action: {
          type: "review-all-fields",
          mode: "confirm",
          reason: "The server must derive the canonical factual set.",
          proposalIds: ["client-selected-subset"],
        },
      },
    );
    expect(injectedBulkIds.result?.isError).toBe(true);
    expect(JSON.stringify(injectedBulkIds.result?.content)).toMatch(
      /unrecognized|invalid|unsupported/i,
    );

    const invalidBulkMode = await harness.callTool(
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      {
        schemaVersion: SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION,
        operationId: "screen03-invalid-bulk-mode",
        responseKeyId: exportedResponseKey.keyId,
        responseKey: exportedResponseKey.key,
        runId,
        accessToken: `s2a_${"A".repeat(43)}`,
        expectedRevision: 8,
        expectedStateFingerprint: "fnv1a64:1234567890abcdef",
        expectedScreen03Revision: 1,
        expectedScreen03StateFingerprint: "fnv1a64:fedcba0987654321",
        action: {
          type: "review-all-fields",
          mode: "approve-everything",
          reason: "Reject an unsupported bulk mode.",
        },
      },
    );
    expect(invalidBulkMode.result?.isError).toBe(true);
    expect(JSON.stringify(invalidBulkMode.result?.content)).toMatch(
      /invalid|unsupported/i,
    );
    expect(harness.connectorCalls()).toBe(0);
    await expect(harness.screen03Store.read(runId)).resolves.toEqual({
      outcome: "not-found",
    });
    await expect(harness.screen02Store.readTrusted({ runId })).resolves.toEqual(
      { outcome: "not-found" },
    );
  });
});
