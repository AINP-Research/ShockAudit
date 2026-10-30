import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import {
  markScreen02FindRequestsDelivered,
} from "../../src/core/screen02-find-workflow";
import {
  decodeScreen02FindWorkflowStateEnvelope,
  encodeScreen02FindWorkflowStateEnvelope,
} from "../../src/core/screen02-workflow-envelope";
import { prepareScreen02AssessmentRequest } from "../../src/core/screen02-workflow-state";
import {
  screen02FindAssessmentPartIds,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
  createScreen02FindAssessmentCapability,
  type Screen02FindSigningConfig,
} from "../../src/worker/screen02-find-assessment-security";
import {
  SCREEN_02_FIND_RECEIPT_APPLY_INPUT_SCHEMA_VERSION,
} from "../../src/worker/screen02-find-assessment-service";
import {
  SCREEN_02_FIND_APPLY_RECEIPT_TOOL_V021,
  SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021,
  registerScreen02FindAssessmentDevelopmentTools,
} from "../../src/worker/screen02-find-assessment-tools";
import { buildFindFactsState } from "../core/screen02-workflow-fixtures";

const signingConfig: Screen02FindSigningConfig = {
  keyId: "stage3-mcp-test-key",
  key: "fedcba9876543210fedcba9876543210",
};
const requestId = "find-mcp-request-1";
const issuedAt = "2026-08-09T18:00:02.000Z";
const receivedAt = "2026-08-09T18:00:03.000Z";

function preparedState() {
  return prepareScreen02AssessmentRequest(buildFindFactsState(), {
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    jobId: "find-mcp-job-1",
    requestId,
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: issuedAt,
  }) as Screen02FindState;
}

function validDraft() {
  return {
    studyFit: {
      category: "strong",
      explanation:
        "GDPR has an application date inside the study period, and its territorial-scope lead could reach firms in the confirmed population.",
      evidenceSourceIds: ["gdpr-official"],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy compliance duties may redirect engineering resources and affect product experimentation tied to the confirmed innovation family.",
      evidenceSourceIds: ["gdpr-official"],
    },
    measurementPotential: {
      category: "possible",
      explanation:
        "EU-facing services and monitoring activity provide possible public indicators, while firm-level classification remains unverified.",
      evidenceSourceIds: ["gdpr-official"],
    },
    mainConcern:
      "The confirmed U.S. population is broader than firms demonstrably covered by the current territorial-scope source lead.",
    nextChecks: [
      "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
    ],
  };
}

async function connectedTools() {
  const server = new McpServer(
    { name: "ShockAudit Stage 3 test", version: "0.2.21-test" },
    { instructions: "Test the isolated Stage 3 Find tools." },
  );
  registerScreen02FindAssessmentDevelopmentTools(server, {
    signingConfig,
    now: () => receivedAt,
    createReceiptId: () => "find-mcp-receipt-1",
  });
  const client = new Client({ name: "Stage 3 test client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Screen 2 Find Stage 3 development MCP tools", () => {
  it("fails registration before exposing tools when the signing key is short", () => {
    const server = new McpServer({ name: "bad-key", version: "test" });
    expect(() =>
      registerScreen02FindAssessmentDevelopmentTools(server, {
        signingConfig: { keyId: "bad-key", key: "too-short" },
        now: () => receivedAt,
        createReceiptId: () => "unused",
      }),
    ).toThrow(/32–4096 bytes/);
  });

  it("advertises exact model/app visibility and strict input/output JSON schemas", async () => {
    const { client, server } = await connectedTools();
    try {
      const { tools } = await client.listTools();
      const submit = tools.find(
        (tool) => tool.name === SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021,
      );
      const apply = tools.find(
        (tool) => tool.name === SCREEN_02_FIND_APPLY_RECEIPT_TOOL_V021,
      );

      expect(submit?._meta?.ui).toEqual({ visibility: ["model"] });
      expect(submit?._meta?.["ui/resourceUri"]).toBeUndefined();
      expect(submit?.inputSchema.additionalProperties).toBe(false);
      expect(Object.keys(submit?.inputSchema.properties ?? {})).toEqual([
        "schemaVersion",
        "capabilityToken",
        "requestId",
        "draft",
        "orientation",
      ]);
      expect(submit?.inputSchema.properties).not.toHaveProperty(
        "stateEnvelope",
      );
      expect(submit?.inputSchema.properties).not.toHaveProperty("candidate");
      expect(submit?.outputSchema?.additionalProperties).toBe(false);
      expect(Object.keys(submit?.outputSchema?.properties ?? {})).toEqual([
        "schemaVersion",
        "phase",
        "requestId",
        "receiptId",
        "mode",
        "acceptedPartIds",
        "validationFailures",
        "receiptToken",
      ]);

      expect(apply?._meta?.ui).toEqual({ visibility: ["app"] });
      expect(apply?._meta?.["openai/widgetAccessible"]).toBe(true);
      expect(apply?.inputSchema.additionalProperties).toBe(false);
      expect(Object.keys(apply?.inputSchema.properties ?? {})).toEqual([
        "schemaVersion",
        "stateEnvelope",
        "receiptToken",
      ]);
      expect(apply?.outputSchema?.additionalProperties).toBe(false);
      expect(Object.keys(apply?.outputSchema?.properties ?? {})).toEqual([
        "schemaVersion",
        "disposition",
        "reason",
        "requestId",
        "receiptId",
        "predecessorStateRevision",
        "predecessorStateFingerprint",
        "successorStateRevision",
        "successorStateFingerprint",
        "stateEnvelope",
        "applicationResults",
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("submits a model draft and applies its receipt without server persistence", async () => {
    const prepared = preparedState();
    const capability = await createScreen02FindAssessmentCapability(
      {
        state: prepared,
        requestId,
        capabilityId: "find-mcp-capability-1",
        issuedAt,
      },
      signingConfig,
    );
    const { client, server } = await connectedTools();
    try {
      const submitted = await client.callTool({
        name: SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021,
        arguments: {
          schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: capability.capabilityToken,
          requestId,
          draft: validDraft(),
          orientation: { summary: "This intentionally partial sibling is rejected." },
        },
      });
      expect(submitted.isError).not.toBe(true);
      const receiptToken = (
        submitted.structuredContent as { receiptToken?: string } | undefined
      )?.receiptToken;
      expect(receiptToken).toMatch(/^sa2f-receipt-v1\./);
      expect(
        (submitted.structuredContent as { validationFailures?: unknown[] })
          .validationFailures,
      ).toEqual([]);

      const delivered = markScreen02FindRequestsDelivered(
        prepared,
        [requestId],
        { at: "2026-08-09T18:00:02.500Z", delivered: true },
      );
      const applied = await client.callTool({
        name: SCREEN_02_FIND_APPLY_RECEIPT_TOOL_V021,
        arguments: {
          schemaVersion: SCREEN_02_FIND_RECEIPT_APPLY_INPUT_SCHEMA_VERSION,
          stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(delivered),
          receiptToken,
        },
      });
      expect(applied.isError).not.toBe(true);
      expect(applied.structuredContent).toMatchObject({
        disposition: "apply",
        requestId,
        receiptId: "find-mcp-receipt-1",
        predecessorStateRevision: delivered.revision,
        predecessorStateFingerprint: expect.stringMatching(
          /^fnv1a64:[0-9a-f]{16}$/,
        ),
        successorStateRevision: expect.any(Number),
        successorStateFingerprint: expect.stringMatching(
          /^fnv1a64:[0-9a-f]{16}$/,
        ),
        applicationResults: [expect.objectContaining({ status: "completed" })],
      });
      expect(
        (applied.structuredContent as { successorStateRevision: number })
          .successorStateRevision,
      ).toBeGreaterThan(delivered.revision);
      const envelope = (
        applied.structuredContent as { stateEnvelope?: unknown } | undefined
      )?.stateEnvelope;
      const decoded = decodeScreen02FindWorkflowStateEnvelope(envelope);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) throw new Error(decoded.message);
      expect(
        decoded.state.assessmentRequests.find(
          (request) => request.requestId === requestId,
        )?.status,
      ).toBe("completed");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
