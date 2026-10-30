import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import {
  SCREEN_01_HOST_DRAFT_APPLY_INPUT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
  SCREEN_01_HOST_DRAFT_PREPARE_INPUT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
} from "../../src/core/screen01-host-draft";
import type { Screen01State } from "../../src/core/scope-types";
import { registerScreen01HostDraftTools } from "../../src/worker/screen01-host-draft-tools";

const now = "2026-08-15T18:00:00.000Z";

function state(): Screen01State {
  const sentence =
    "I study how the California Consumer Privacy Act affected innovation among California technology firms from 2016 to 2022.";
  return {
    revision: 3,
    mode: "audit",
    sentence,
    contractSourceSentence: sentence,
    scope: {
      population: "California technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "California",
      industry: "Technology",
      studyPeriod: "2016–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Not specified",
    },
    knownShock: "California Consumer Privacy Act",
    resolvedKeys: [],
    scopeDirty: false,
    confirmed: false,
  };
}

function proposal() {
  return {
    scope: state().scope,
    knownShock: "California Consumer Privacy Act",
  };
}

async function connectedTools() {
  const ids = ["request-1", "capability-1", "receipt-1"];
  const server = new McpServer(
    { name: "ShockAudit Screen 1 host-draft test", version: "0.3.13-test" },
    { instructions: "Test isolated Screen 1 host-draft tools." },
  );
  registerScreen01HostDraftTools(server, {
    signingConfig: {
      keyId: "screen01-mcp-test-key",
      key: "abcdef0123456789abcdef0123456789",
    },
    now: () => now,
    createId: () => ids.shift() ?? "unexpected-id",
  });
  const client = new Client({ name: "Screen 1 tool test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Screen 1 ChatGPT-host MCP tools", () => {
  it("fails closed before registration when the signing key is weak", () => {
    const server = new McpServer({ name: "bad-key", version: "test" });
    expect(() =>
      registerScreen01HostDraftTools(server, {
        signingConfig: { keyId: "bad-key", key: "too-short" },
        now: () => now,
        createId: () => "unused",
      }),
    ).toThrow(/32–4096 bytes/);
  });

  it("advertises one model-only submit tool between app-only prepare and apply", async () => {
    const { client, server } = await connectedTools();
    try {
      const { tools } = await client.listTools();
      const prepare = tools.find(
        (tool) => tool.name === SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
      );
      const submit = tools.find(
        (tool) => tool.name === SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      );
      const apply = tools.find(
        (tool) => tool.name === SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
      );

      expect(prepare?._meta).toMatchObject({
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      });
      expect(submit?._meta?.ui).toEqual({ visibility: ["app"] });
      expect(submit?._meta?.["openai/widgetAccessible"]).toBeUndefined();
      expect(apply?._meta).toMatchObject({
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      });
      expect(Object.keys(prepare?.inputSchema.properties ?? {})).toEqual([
        "schemaVersion",
        "operationId",
        "sourceState",
      ]);
      expect(Object.keys(submit?.inputSchema.properties ?? {})).toEqual([
        "schemaVersion",
        "capabilityToken",
        "requestId",
        "draft",
      ]);
      expect(Object.keys(apply?.inputSchema.properties ?? {})).toEqual([
        "schemaVersion",
        "operationId",
        "sourceState",
        "receiptToken",
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("completes prepare, model submit, and exact-state app apply without persistence", async () => {
    const { client, server } = await connectedTools();
    try {
      const prepared = await client.callTool({
        name: SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
        arguments: {
          schemaVersion: SCREEN_01_HOST_DRAFT_PREPARE_INPUT_SCHEMA_VERSION,
          operationId: "operation-1",
          sourceState: state(),
        },
      });
      expect(prepared.isError).not.toBe(true);
      const task = prepared.structuredContent as {
        requestId: string;
        modelContext: { submission: { capabilityToken: string } };
      };
      expect(task.requestId).toBe("request-1");

      const submitted = await client.callTool({
        name: SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
        arguments: {
          schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: task.modelContext.submission.capabilityToken,
          requestId: task.requestId,
          draft: proposal(),
        },
      });
      expect(submitted.isError).not.toBe(true);
      const notice = submitted.structuredContent as { receiptToken: string };
      expect(notice.receiptToken).toMatch(/^sa1-receipt-v1\./);

      const applied = await client.callTool({
        name: SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
        arguments: {
          schemaVersion: SCREEN_01_HOST_DRAFT_APPLY_INPUT_SCHEMA_VERSION,
          operationId: "operation-1",
          sourceState: state(),
          receiptToken: notice.receiptToken,
        },
      });
      expect(applied.isError).not.toBe(true);
      expect(applied.structuredContent).toMatchObject({
        phase: "applied",
        ok: true,
        operationId: "operation-1",
        requestId: "request-1",
        receiptId: "receipt-1",
        proposedState: {
          revision: 4,
          scopeDirty: false,
          confirmed: false,
        },
      });
      expect(applied.structuredContent).not.toHaveProperty("state");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
