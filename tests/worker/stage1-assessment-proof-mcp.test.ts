import { describe, expect, it } from "vitest";

import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  STAGE1_GDPR_PACKET,
  STAGE1_PROOF_KIND,
  type Stage1AssessmentRequest,
} from "../../src/core/stage1-assessment-proof";
import { STAGE1_PROOF_UI_RESOURCE_URI } from "../../src/version";
import worker from "../../src/worker/index";
import { type ShockAuditEnv } from "../../src/worker/server";

const observedAt = "2026-08-09T16:00:05.000Z";

const env: ShockAuditEnv = {
  ASSETS: {
    fetch: async () =>
      new Response(
        "<!doctype html><html><body><div id=\"root\"></div></body></html>",
        { headers: { "content-type": "text/html" } },
      ),
  } as unknown as ShockAuditEnv["ASSETS"],
  NOW: () => observedAt,
  STAGE1_PREVIEW_ONLY: "true",
  SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT: "true",
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
};

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

async function mcpCall(
  method: string,
  params: Record<string, unknown>,
  id = 1,
) {
  const response = await worker.fetch(
    mcpRequest({ jsonrpc: "2.0", id, method, params }) as never,
    env as never,
    executionContext as never,
  );
  expect(response.status).toBe(200);
  return readMcpPayload(response);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  id = 1,
) {
  return mcpCall(
    "tools/call",
    { name, arguments: args },
    id,
  ) as Promise<{
    result?: {
      isError?: boolean;
      content?: Array<{ type?: string; text?: string }>;
      structuredContent?: Record<string, unknown>;
    };
  }>;
}

function goldDraftArguments(request: Stage1AssessmentRequest) {
  return {
    schemaVersion: STAGE1_DRAFT_SCHEMA_VERSION,
    requestId: request.requestId,
    candidateId: request.candidateId,
    candidateSnapshotId: request.candidateSnapshotId,
    candidateFingerprint: request.candidateFingerprint,
    requestProof: request.requestProof,
    draft: {
      studyFit: {
        category: "strong",
        explanation:
          "The application date falls within 2016–2020, while the territorial-scope lead makes this foreign-issued regulation potentially relevant to U.S. firms.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      outcomePathway: {
        category: "plausible",
        explanation:
          "The GDPR territorial and data-processing obligations may redirect data and engineering resources and constrain product experimentation linked to innovation.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      measurementPotential: {
        category: "possible",
        explanation:
          "EU establishment, EU-facing services, and monitoring activities provide possible public exposure indicators, although firm-level classification remains unverified.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
          "source-eu-gdpr-celex-metadata",
        ],
      },
      mainConcern:
        "U.S. publicly listed technology firms are broader than the organizations demonstrably covered by the available GDPR territorial-scope lead.",
      nextChecks: [
        "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
        "Determine whether exposure varies sufficiently across sampled firms for a credible comparison.",
      ],
    },
  };
}

async function openProof(id = 10) {
  const payload = await callTool(
    "open_stage1_assessment_proof",
    {},
    id,
  );
  expect(payload.result?.isError).not.toBe(true);
  const output = payload.result?.structuredContent as
    | {
        kind?: string;
        phase?: string;
        request?: Stage1AssessmentRequest;
        packet?: typeof STAGE1_GDPR_PACKET;
      }
    | undefined;
  expect(output?.kind).toBe(STAGE1_PROOF_KIND);
  expect(output?.phase).toBe("prepared");
  expect(output?.request).toBeDefined();
  return output as {
    kind: typeof STAGE1_PROOF_KIND;
    phase: "prepared";
    request: Stage1AssessmentRequest;
    packet: typeof STAGE1_GDPR_PACKET;
  };
}

describe("Stage 1 assessment proof MCP contract", () => {
  it("reports a truthful isolated-preview health contract", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/health") as never,
      env as never,
      executionContext as never,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      ready: true,
      service: "ShockAudit",
      mode: "stage1-preview",
      readiness: {
        status: "ready",
        mode: "stage1-preview",
        mcpRuntime: "local-dev-in-process",
        workersAi: "not-applicable",
        assessmentSigning: "not-applicable",
        code: "READY",
      },
      uiResourceUri: STAGE1_PROOF_UI_RESOURCE_URI,
      supportedUiResourceUris: [STAGE1_PROOF_UI_RESOURCE_URI],
    });
    expect(payload).not.toHaveProperty("capabilities");
  });

  it("rejects the Stage 1 catalog when its deployment assertion is absent", async () => {
    const response = await worker.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }) as never,
      {
        ...env,
        SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT: undefined,
      } as never,
      executionContext as never,
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

  it("advertises one UI opener and one UI-less model-only draft tool", async () => {
    const payload = (await mcpCall("tools/list", {}, 2)) as {
      result?: {
        tools?: Array<{
          name?: string;
          inputSchema?: {
            type?: string;
            properties?: Record<string, unknown>;
            required?: string[];
            additionalProperties?: boolean;
          };
          outputSchema?: {
            properties?: Record<string, unknown>;
          };
          _meta?: Record<string, unknown>;
        }>;
      };
    };
    const tools = payload.result?.tools ?? [];
    expect(tools.map((tool) => tool.name)).toEqual([
      "open_stage1_assessment_proof",
      "submit_stage1_assessment_draft",
    ]);
    const opener = tools.find(
      (tool) => tool.name === "open_stage1_assessment_proof",
    );
    const draftTool = tools.find(
      (tool) => tool.name === "submit_stage1_assessment_draft",
    );

    expect(opener).toBeDefined();
    expect(opener?._meta?.["ui/resourceUri"]).toBe(
      STAGE1_PROOF_UI_RESOURCE_URI,
    );
    expect(opener?._meta?.["openai/outputTemplate"]).toBe(
      STAGE1_PROOF_UI_RESOURCE_URI,
    );
    expect(opener?._meta?.ui).toEqual({
      resourceUri: STAGE1_PROOF_UI_RESOURCE_URI,
      visibility: ["model", "app"],
    });
    expect(opener?.inputSchema?.properties).toEqual({});
    expect(opener?.inputSchema?.additionalProperties).toBe(false);

    expect(draftTool).toBeDefined();
    expect(draftTool?._meta?.ui).toEqual({ visibility: ["model"] });
    expect(draftTool?._meta?.["ui/resourceUri"]).toBeUndefined();
    expect(draftTool?._meta?.["openai/outputTemplate"]).toBeUndefined();
    expect(draftTool?._meta?.["openai/widgetAccessible"]).toBeUndefined();
    expect(draftTool?.inputSchema?.additionalProperties).toBe(false);
    expect(Object.keys(draftTool?.inputSchema?.properties ?? {})).toEqual([
      "schemaVersion",
      "requestId",
      "candidateId",
      "candidateSnapshotId",
      "candidateFingerprint",
      "requestProof",
      "draft",
    ]);
    expect(draftTool?.inputSchema?.required).toEqual([
      "schemaVersion",
      "requestId",
      "candidateId",
      "candidateSnapshotId",
      "candidateFingerprint",
      "requestProof",
      "draft",
    ]);
    for (const forbidden of [
      "sessionState",
      "studyContext",
      "expectedRevision",
      "revision",
    ]) {
      expect(draftTool?.inputSchema?.properties).not.toHaveProperty(
        forbidden,
      );
    }
    const draftSchema = draftTool?.inputSchema?.properties?.draft as
      | {
          properties?: Record<string, unknown>;
          required?: string[];
        }
      | undefined;
    expect(Object.keys(draftSchema?.properties ?? {})).toEqual([
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ]);
    expect(draftSchema?.required).toEqual([
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ]);
    const studyFitSchema = draftSchema?.properties?.studyFit as
      | { properties?: Record<string, unknown> }
      | undefined;
    expect(studyFitSchema?.properties?.category).toMatchObject({
      enum: ["strong", "mixed", "weak", "unclear"],
    });
    expect(studyFitSchema?.properties?.evidenceSourceIds).toMatchObject({
      type: "array",
      items: {
        enum: [
          "source-eu-gdpr-regulation-2016-679",
          "source-eu-gdpr-celex-metadata",
        ],
      },
    });
    expect(draftTool?.outputSchema?.properties?.assessment).toBeDefined();
  });

  it("advertises only the isolated proof UI resource", async () => {
    const payload = (await mcpCall("resources/list", {}, 3)) as {
      result?: {
        resources?: Array<{ uri?: string }>;
      };
    };
    expect(payload.result?.resources).toEqual([
      expect.objectContaining({
        uri: STAGE1_PROOF_UI_RESOURCE_URI,
      }),
    ]);
  });

  it("exposes and reads the isolated proof UI resource", async () => {
    const listPayload = (await mcpCall("resources/list", {}, 3)) as {
      result?: { resources?: Array<{ uri?: string; mimeType?: string }> };
    };
    expect(listPayload.result?.resources).toContainEqual(
      expect.objectContaining({
        uri: STAGE1_PROOF_UI_RESOURCE_URI,
        mimeType: "text/html;profile=mcp-app",
      }),
    );

    const readPayload = (await mcpCall(
      "resources/read",
      { uri: STAGE1_PROOF_UI_RESOURCE_URI },
      4,
    )) as {
      result?: {
        contents?: Array<{
          uri?: string;
          mimeType?: string;
          text?: string;
        }>;
      };
    };
    expect(readPayload.result?.contents?.[0]).toMatchObject({
      uri: STAGE1_PROOF_UI_RESOURCE_URI,
      mimeType: "text/html;profile=mcp-app",
    });
    expect(readPayload.result?.contents?.[0]?.text).toContain(
      '<div id="root">',
    );
  });

  it("opens one compact immutable GDPR request", async () => {
    const output = await openProof();

    expect(output.packet).toEqual(STAGE1_GDPR_PACKET);
    expect(output.request).toMatchObject({
      candidateId: STAGE1_GDPR_PACKET.candidate.id,
      candidateSnapshotId:
        STAGE1_GDPR_PACKET.candidate.candidateSnapshotId,
      candidateFingerprint: STAGE1_GDPR_PACKET.candidateFingerprint,
      requiredTool: "submit_stage1_assessment_draft",
      preparedAt: observedAt,
    });
    expect(output.request.requestId).toMatch(/^stage1-proof-/);
    expect(output.request.requestProof).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/,
    );
    const serialized = JSON.stringify(output);
    expect(serialized.length).toBeLessThan(12_000);
    expect(serialized).not.toContain("sessionState");
    expect(serialized).not.toContain("studyContext");
    expect(serialized).not.toContain("expectedRevision");
  });

  it("completes the gold draft with a deterministic receipt and fixed judgment", async () => {
    const open = await openProof(20);
    const args = goldDraftArguments(open.request);
    const firstPayload = await callTool(
      "submit_stage1_assessment_draft",
      args,
      21,
    );
    const secondPayload = await callTool(
      "submit_stage1_assessment_draft",
      args,
      22,
    );
    const first = firstPayload.result?.structuredContent as
      | Record<string, unknown>
      | undefined;
    const second = secondPayload.result?.structuredContent as
      | Record<string, unknown>
      | undefined;

    expect(firstPayload.result?.isError).not.toBe(true);
    expect(first).toMatchObject({
      kind: STAGE1_PROOF_KIND,
      status: "completed",
      requestId: open.request.requestId,
      candidateFingerprint: open.request.candidateFingerprint,
      requestProof: open.request.requestProof,
      selectionGate: { eligible: true },
      assessment: {
        method: "ai-preliminary",
        overallJudgment: "promising-to-verify",
        overallJudgmentMethod: "fixed-computation",
      },
    });
    expect(first?.candidateBeforeFingerprint).toBe(
      first?.candidateAfterFingerprint,
    );
    expect(first?.receiptId).toBe(second?.receiptId);
    expect(first?.draftFingerprint).toBe(second?.draftFingerprint);
    expect(first?.appliedResultFingerprint).toBe(
      second?.appliedResultFingerprint,
    );
    expect(JSON.stringify(first)).not.toMatch(/"score"\s*:/);
  });

  it("rejects draft fact injection and mismatched request identity cleanly", async () => {
    const open = await openProof(30);
    const extraDraftField = goldDraftArguments(open.request);
    extraDraftField.draft = {
      ...extraDraftField.draft,
      title: "Model-rewritten candidate title",
    } as typeof extraDraftField.draft;
    const extraPayload = await callTool(
      "submit_stage1_assessment_draft",
      extraDraftField,
      31,
    );
    expect(extraPayload.result?.isError).not.toBe(true);
    expect(extraPayload.result?.structuredContent).toMatchObject({
      status: "rejected",
      selectionGate: { eligible: false },
    });
    expect(
      (
        extraPayload.result?.structuredContent
          ?.rejectionReasons as string[]
      ).join(" "),
    ).toMatch(/must contain only/i);

    const wrongIdentity = {
      ...goldDraftArguments(open.request),
      candidateSnapshotId: "candidate-snapshot-not-prepared",
    };
    const identityPayload = await callTool(
      "submit_stage1_assessment_draft",
      wrongIdentity,
      32,
    );
    expect(identityPayload.result?.isError).not.toBe(true);
    expect(identityPayload.result?.structuredContent).toMatchObject({
      status: "rejected",
      selectionGate: { eligible: false },
    });
    expect(
      (
        identityPayload.result?.structuredContent
          ?.rejectionReasons as string[]
      ).join(" "),
    ).toMatch(/prepared candidate snapshot/i);
  });

  it("rejects forbidden top-level state through the strict transport schema", async () => {
    const open = await openProof(40);
    const payload = await callTool(
      "submit_stage1_assessment_draft",
      {
        ...goldDraftArguments(open.request),
        sessionState: { revision: 99 },
      },
      41,
    );

    expect(payload.result?.isError).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
    expect(payload.result?.content?.[0]?.text).toMatch(
      /invalid|unrecognized|arguments/i,
    );
  });
});
