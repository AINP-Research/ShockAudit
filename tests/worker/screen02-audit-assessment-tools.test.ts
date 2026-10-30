import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { markScreen02AuditRequestDelivered } from "../../src/core/screen02-audit-workflow";
import {
  decodeScreen02AuditWorkflowStateEnvelope,
  encodeScreen02AuditWorkflowStateEnvelope,
} from "../../src/core/screen02-audit-workflow-envelope";
import { prepareScreen02AssessmentRequest } from "../../src/core/screen02-workflow-state";
import {
  screen02AuditAssessmentPartIds,
  type Screen02AuditState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
  createScreen02AuditAssessmentCapability,
  type Screen02AuditSigningConfig,
} from "../../src/worker/screen02-audit-assessment-security";
import { SCREEN_02_AUDIT_RECEIPT_APPLY_INPUT_SCHEMA_VERSION } from "../../src/worker/screen02-audit-assessment-service";
import {
  SCREEN_02_AUDIT_APPLY_RECEIPT_TOOL_V021,
  SCREEN_02_AUDIT_SUBMIT_DRAFT_TOOL_V021,
  registerScreen02AuditAssessmentDevelopmentTools,
} from "../../src/worker/screen02-audit-assessment-tools";
import { buildAuditIdentityState } from "../core/screen02-workflow-fixtures";

const signingConfig: Screen02AuditSigningConfig = {
  keyId: "stage4-audit-mcp-test-key",
  key: "0123456789abcdef0123456789abcdef",
};
const requestId = "audit-confirmed-mcp-request-1";
const issuedAt = "2026-08-09T18:12:00.000Z";
const receivedAt = "2026-08-09T18:12:01.000Z";

function preparedState() {
  return prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    jobId: "audit-confirmed-mcp-job-1",
    requestId,
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: issuedAt,
  }) as Screen02AuditState;
}

function validDraft() {
  return {
    studyFit: {
      category: "strong",
      explanation:
        "The source-backed date leads fall inside the confirmed study period and the statute may reach firms in the study population.",
      evidenceSourceIds: ["ccpa-official"],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy compliance duties may redirect engineering resources and alter product experimentation linked to the confirmed outcome family.",
      evidenceSourceIds: ["ccpa-official"],
    },
    coverageRelation: {
      category: "mixed",
      explanation:
        "The confirmed study population is broader than covered businesses, so historical organization-level classification remains necessary.",
      evidenceSourceIds: ["ccpa-official"],
    },
    measurementPotential: {
      category: "difficult",
      explanation:
        "Public disclosures may provide exposure indicators, although organization-level California activity may be incomplete.",
      evidenceSourceIds: ["ccpa-official"],
    },
    mainConcern:
      "Different event stages and related amendments could be collapsed without later fixed verification.",
    nextChecks: [
      "Verify the event stage that best matches the proposed organizational response.",
      "Locate historical indicators needed to classify covered organizations.",
    ],
  };
}

async function connectedTools() {
  const server = new McpServer(
    { name: "ShockAudit Stage 4 test", version: "0.2.21-test" },
    { instructions: "Test the isolated Stage 4 Audit tools." },
  );
  registerScreen02AuditAssessmentDevelopmentTools(server, {
    signingConfig,
    now: () => receivedAt,
    createReceiptId: () => "audit-confirmed-mcp-receipt-1",
  });
  const client = new Client({ name: "Stage 4 test client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Screen 2 Audit Stage 4 development MCP tools", () => {
  it("fails closed before exposing tools when the HMAC key is short", () => {
    const server = new McpServer({ name: "bad-audit-key", version: "test" });
    expect(() =>
      registerScreen02AuditAssessmentDevelopmentTools(server, {
        signingConfig: { keyId: "bad-audit-key", key: "too-short" },
        now: () => receivedAt,
        createReceiptId: () => "unused",
      }),
    ).toThrow(/32–4096 bytes/);
  });

  it("advertises strict model/app visibility without exposing workflow facts to the model submit tool", async () => {
    const { client, server } = await connectedTools();
    try {
      const { tools } = await client.listTools();
      const submit = tools.find(
        (tool) => tool.name === SCREEN_02_AUDIT_SUBMIT_DRAFT_TOOL_V021,
      );
      const apply = tools.find(
        (tool) => tool.name === SCREEN_02_AUDIT_APPLY_RECEIPT_TOOL_V021,
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
      for (const forbidden of [
        "stateEnvelope",
        "screen01Baseline",
        "match",
        "sources",
        "overallJudgment",
      ]) {
        expect(submit?.inputSchema.properties).not.toHaveProperty(forbidden);
      }
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

  it("submits only a bounded model draft and applies its signed receipt through the app-only envelope tool", async () => {
    const prepared = preparedState();
    const capability = await createScreen02AuditAssessmentCapability(
      {
        state: prepared,
        requestId,
        capabilityId: "audit-confirmed-mcp-capability-1",
        issuedAt,
      },
      signingConfig,
    );
    const { client, server } = await connectedTools();
    try {
      const submitted = await client.callTool({
        name: SCREEN_02_AUDIT_SUBMIT_DRAFT_TOOL_V021,
        arguments: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: capability.capabilityToken,
          requestId,
          draft: validDraft(),
          orientation: { summary: "This intentionally partial sibling is rejected." },
        },
      });
      expect(submitted.isError).not.toBe(true);
      const structured = submitted.structuredContent as
        | { receiptToken?: string; acceptedPartIds?: string[] }
        | undefined;
      expect(structured?.receiptToken).toMatch(/^sa2a-receipt-v1\./);
      expect(structured?.acceptedPartIds).toEqual(
        screen02AuditAssessmentPartIds,
      );
      expect(
        (
          submitted.structuredContent as
            | { validationFailures?: unknown[] }
            | undefined
        )?.validationFailures,
      ).toEqual([]);

      const delivered = markScreen02AuditRequestDelivered(prepared, {
        requestId,
        at: "2026-08-09T18:12:00.500Z",
        delivered: true,
      });
      const applied = await client.callTool({
        name: SCREEN_02_AUDIT_APPLY_RECEIPT_TOOL_V021,
        arguments: {
          schemaVersion: SCREEN_02_AUDIT_RECEIPT_APPLY_INPUT_SCHEMA_VERSION,
          stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(delivered),
          receiptToken: structured?.receiptToken,
        },
      });
      expect(applied.isError).not.toBe(true);
      expect(applied.structuredContent).toMatchObject({
        disposition: "apply",
        requestId,
        receiptId: "audit-confirmed-mcp-receipt-1",
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
      const result = applied.structuredContent as
        | {
            predecessorStateRevision: number;
            successorStateRevision: number;
            stateEnvelope?: unknown;
          }
        | undefined;
      expect(result?.successorStateRevision).toBeGreaterThan(
        result?.predecessorStateRevision ?? Number.MAX_SAFE_INTEGER,
      );
      const decoded = decodeScreen02AuditWorkflowStateEnvelope(
        result?.stateEnvelope,
      );
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
