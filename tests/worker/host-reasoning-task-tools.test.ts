import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";

import { readPreparedHostPrivateModelContext } from
  "../../scripts/live-verifier-host-task-result.mjs";

import { fingerprintHostReasoningValue } from "../../src/core/host-reasoning-task";
import { buildScreen02StudyRelevanceProfile } from "../../src/core/screen02-relevance-profile";
import {
  CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  HOST_REASONING_PRIVATE_CONTEXT_META_KEY,
  HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
  HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
  HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
  PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
  SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
  SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
  SUBMIT_SCREEN03_OVERVIEW_TOOL,
  SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
  SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
  HostReasoningTaskRuntime,
} from "../../src/worker/host-reasoning-task-runtime";
import {
  registerHostReasoningTaskTools,
  type HostReasoningToolExposure,
} from "../../src/worker/host-reasoning-task-tools";
import {
  HostReasoningTaskStore,
  InMemoryHostReasoningTaskStoreBackend,
} from "../../src/worker/host-reasoning-task-store";

const connected: Array<{ client: Client; server: McpServer }> = [];
const scopeFingerprint = fingerprintHostReasoningValue("scope");
const poolFingerprint = fingerprintHostReasoningValue("pool");

function runtime() {
  return new HostReasoningTaskRuntime({
    store: new HostReasoningTaskStore(
      new InMemoryHostReasoningTaskStoreBackend(),
    ),
    signing: {
      keyId: "host-task-tool-test-key",
      key: "0123456789abcdef0123456789abcdef",
    },
    now: () => "2026-09-03T12:00:00.000Z",
    createId: (kind) => `${kind}-1`,
    freezeTask: (input) => ({
      taskType: input.taskType,
      runId: input.runId,
      candidatePoolId: input.candidatePoolId,
      selectedEventId: input.selectedEventId,
      claimGroupId: input.claimGroupId,
      scopeFingerprint,
      candidatePoolFingerprint: poolFingerprint,
      eventFingerprint: null,
      boundedFacts: {
        studyProfile: buildScreen02StudyRelevanceProfile({
          scopeFingerprint,
          originalIndustryText: "interactive media",
          sampleGeography: "Example jurisdiction",
          studyPeriod: "2020–2026",
          eventFamily: "regulation",
          at: "2026-09-03T12:00:00.000Z",
        }),
        confirmedScope: {
          population: "Interactive media firms",
          assignmentLevel: "Firm",
          analysisLevel: "Firm",
          geography: "Example jurisdiction",
          industry: "interactive media",
          studyPeriod: "2020–2026",
          eventFamily: "regulation",
          outcomeFamily: "innovation",
          outcomeFrequency: "annual",
        },
        researcherCriteria: [],
        candidates: [{
          candidateId: "candidate-1",
          title: "Official rule",
          description: "A bounded official regulatory candidate.",
          affectedPopulationFacts: [],
          dateLeads: [],
          sources: [{
            sourceId: "source-1",
            title: "Official source",
            authority: "Public authority",
            locator: "https://authority.example/rule",
            passages: [],
          }],
          preliminaryClass: "unclassified" as const,
          exclusionConcerns: [],
          retrievalGaps: [],
        }],
        retrievalGaps: [],
      },
      allowedSourceIds: ["source-1"],
      promptVersion: "prompt-v1",
      workflowVersion: "workflow-v1",
      appVersion: "0.4.4",
      uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
    }),
    authorizeTaskAccess: () => undefined,
    policies: {},
  });
}

async function connect(exposure: HostReasoningToolExposure) {
  const server = new McpServer(
    { name: "host-task-tools-test", version: "0.4.4-test" },
    { instructions: "Isolated host-task tool contract test." },
  );
  const registered = registerHostReasoningTaskTools(server, runtime(), {
    exposure,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return { client, registered };
}

afterEach(async () => {
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
});

describe("host reasoning task MCP registration", () => {
  it("supports disabled, app-only, screen02-only, and full exposure", async () => {
    const disabled = await connect("disabled");
    expect(disabled.registered).toEqual([]);
    expect((await disabled.client.listTools()).tools).toEqual([]);

    const appOnly = await connect("app-only");
    expect(appOnly.registered).toEqual([
      PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
      CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
    ]);

    const screen02Only = await connect("screen02-only");
    expect(screen02Only.registered).toEqual([
      PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
      CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
      SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
    ]);

    const full = await connect("full");
    expect(full.registered).toEqual([
      PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
      CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
      SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
      SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
      SUBMIT_SCREEN03_OVERVIEW_TOOL,
      SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
      SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
      "submit_screen04_study_event_assessment",
    ]);
  });

  it("advertises app-only lifecycle boundaries and UI-less model submissions", async () => {
    const { client } = await connect("full");
    const { tools } = await client.listTools();
    const serializedCatalogBytes = new TextEncoder().encode(
      JSON.stringify({ tools }),
    ).byteLength;
    expect(serializedCatalogBytes).toBeLessThan(64 * 1024);
    const prepare = tools.find((tool) =>
      tool.name === PREPARE_SHOCKAUDIT_HOST_TASK_TOOL
    );
    const status = tools.find((tool) =>
      tool.name === GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL
    );
    const cancel = tools.find((tool) =>
      tool.name === CANCEL_SHOCKAUDIT_HOST_TASK_TOOL
    );
    const delivery = tools.find((tool) =>
      tool.name === RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL
    );
    const panel = tools.find((tool) =>
      tool.name === RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL
    );

    for (const tool of [prepare, status, delivery, panel, cancel]) {
      expect(tool?._meta).toMatchObject({
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      });
      expect(tool?._meta).not.toHaveProperty("openai/outputTemplate");
      expect(tool?._meta).not.toHaveProperty("ui/resourceUri");
      expect(tool?.outputSchema).toBeUndefined();
    }
    expect(prepare?.outputSchema).toBeUndefined();
    expect(JSON.stringify(prepare)).not.toContain("privateModelContext");

    for (const name of [
      SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
      SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
      SUBMIT_SCREEN03_OVERVIEW_TOOL,
      SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
      SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
    ]) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool?._meta).toEqual({ ui: { visibility: ["model"] } });
      expect(tool?._meta).not.toHaveProperty("openai/outputTemplate");
      expect(tool?._meta).not.toHaveProperty("ui/resourceUri");
      expect(tool?.outputSchema).toBeUndefined();
      expect(tool?.description).toMatch(/^This is the required final action/u);
      expect(tool?.description).toContain("Call it exactly once");
      expect(tool?.description).toContain("do not call a packet or render tool");
      expect(tool?.description).toContain("do not answer with prose alone");
    }

    const screen02Submission = tools.find((tool) =>
      tool.name === SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL
    );
    const advertisedInput = screen02Submission?.inputSchema as {
      properties?: Record<string, unknown>;
      anyOf?: Array<{
        properties?: Record<string, unknown>;
      }>;
    } | undefined;
    const strictInput = advertisedInput?.properties
      ? advertisedInput
      : advertisedInput?.anyOf?.find((branch) =>
          branch.properties?.officialSourceLeads !== undefined
        );
    const officialSourceLeadSchema = (
      strictInput as {
        properties?: {
          officialSourceLeads?: {
            items?: {
              properties?: Record<string, unknown>;
              required?: string[];
              additionalProperties?: boolean;
            };
          };
        };
      } | undefined
    )?.properties?.officialSourceLeads?.items;
    expect(Object.keys(officialSourceLeadSchema?.properties ?? {}).sort())
      .toEqual([
        "candidateIdIfKnown",
        "issuingBody",
        "jurisdiction",
        "reasonForRetrieval",
        "title",
        "url",
      ]);
    expect(officialSourceLeadSchema?.required?.sort()).toEqual([
      "candidateIdIfKnown",
      "issuingBody",
      "jurisdiction",
      "reasonForRetrieval",
      "title",
      "url",
    ]);
    expect(officialSourceLeadSchema?.additionalProperties).toBe(false);
  });

  it("keeps the private capability out of visible MCP content", async () => {
    const { client } = await connect("full");
    const response = await client.callTool({
      name: PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
        operationId: "prepare-1",
        taskType: "screen02-search-review",
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        candidatePoolId: "pool-1",
        selectedEventId: null,
        claimGroupId: null,
        expectedScopeFingerprint: scopeFingerprint,
        expectedCandidatePoolFingerprint: poolFingerprint,
        expectedEventFingerprint: null,
        retryOfTaskId: null,
      },
    });
    expect(response.isError).not.toBe(true);
    const structured = response.structuredContent as {
      visibleMessage: string;
      taskId: string;
    };
    const privateMeta = response._meta?.[
      HOST_REASONING_PRIVATE_CONTEXT_META_KEY
    ] as {
      schemaVersion: string;
      taskId: string;
      privateModelContext: { submission: { capability: string } };
    };
    const visibleContent = JSON.stringify(response.content);
    expect(structured).not.toHaveProperty("privateModelContext");
    expect(JSON.stringify(structured)).not.toContain("sahr-capability-v1.");
    expect(privateMeta).toMatchObject({
      schemaVersion: HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
      taskId: structured.taskId,
    });
    expect(privateMeta.privateModelContext.submission.capability)
      .toMatch(/^sahr-capability-v1\./u);
    expect(readPreparedHostPrivateModelContext(response)).not.toBeNull();
    expect(visibleContent).not.toContain(
      privateMeta.privateModelContext.submission.capability,
    );
    expect(structured.visibleMessage).not.toContain(
      privateMeta.privateModelContext.submission.capability,
    );

    const request = await client.callTool({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
        operationId: "message-request-1",
        taskId: structured.taskId,
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        phase: "requested",
        requestOperationId: null,
        channel: "ui/message",
        accepted: null,
        requestedAt: "2026-09-03T12:00:00.000Z",
        resolvedAt: null,
        failureCode: null,
        failureExplanation: null,
      },
    });
    expect(request.isError).not.toBe(true);
    expect(request.structuredContent).toMatchObject({
      disposition: "updated",
      status: "message-requested",
      messageChannel: "ui/message",
      messageDeliveryStatus: "requested",
    });

    const delivery = await client.callTool({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
        operationId: "message-resolution-1",
        taskId: structured.taskId,
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        phase: "resolved",
        requestOperationId: "message-request-1",
        channel: "ui/message",
        accepted: true,
        requestedAt: "2026-09-03T12:00:00.000Z",
        resolvedAt: "2026-09-03T12:00:00.000Z",
        failureCode: null,
        failureExplanation: null,
      },
    });
    expect(delivery.isError).not.toBe(true);
    expect(delivery.structuredContent).toMatchObject({
      disposition: "updated",
      status: "awaiting-submission",
      messageChannel: "ui/message",
      messageDeliveryStatus: "accepted",
    });
    expect(JSON.stringify(delivery.content)).not.toContain(
      privateMeta.privateModelContext.submission.capability,
    );

    const malformedSubmission = await client.callTool({
      name: SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
      arguments: {
        capability: privateMeta.privateModelContext.submission.capability,
      },
    });
    expect(malformedSubmission.isError).not.toBe(true);
    expect(malformedSubmission.structuredContent).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
    expect(JSON.stringify(malformedSubmission)).not.toContain(
      privateMeta.privateModelContext.submission.capability,
    );
  });

  it("records a rejected host-message attempt without accepting conversation content", async () => {
    const { client } = await connect("app-only");
    const prepared = await client.callTool({
      name: PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
        operationId: "prepare-rejected-message",
        taskType: "screen02-search-review",
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        candidatePoolId: "pool-1",
        selectedEventId: null,
        claimGroupId: null,
        expectedScopeFingerprint: scopeFingerprint,
        expectedCandidatePoolFingerprint: poolFingerprint,
        expectedEventFingerprint: null,
        retryOfTaskId: null,
      },
    });
    const taskId = (prepared.structuredContent as { taskId: string }).taskId;

    const malformed = await client.callTool({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
        operationId: "message-rejected-malformed",
        taskId,
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        channel: "unavailable",
        accepted: false,
        requestedAt: "2026-09-03T12:00:00.000Z",
        resolvedAt: "2026-09-03T12:00:00.000Z",
        failureCode: "host-message-unavailable",
        failureExplanation: "No supported host-message route is available.",
        conversationContent: "must not cross this boundary",
      },
    });
    expect(malformed.isError).toBe(true);

    const rejected = await client.callTool({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: {
        schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
        operationId: "message-rejected",
        taskId,
        runId: "run-1",
        accessToken: "s2a_123456789012345678901234567890",
        channel: "unavailable",
        accepted: false,
        requestedAt: "2026-09-03T12:00:00.000Z",
        resolvedAt: "2026-09-03T12:00:00.000Z",
        failureCode: "host-message-unavailable",
        failureExplanation: "No supported host-message route is available.",
      },
    });
    expect(rejected.isError).not.toBe(true);
    expect(rejected.structuredContent).toMatchObject({
      disposition: "updated",
      status: "message-rejected",
      messageChannel: "unavailable",
      messageDeliveryStatus: "rejected",
    });
    expect(JSON.stringify(rejected)).not.toContain("conversationContent");
  });
});
