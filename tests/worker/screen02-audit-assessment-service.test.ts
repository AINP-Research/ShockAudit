import { describe, expect, it } from "vitest";

import { markScreen02AuditRequestDelivered } from "../../src/core/screen02-audit-workflow";
import {
  decodeScreen02AuditWorkflowStateEnvelope,
  encodeScreen02AuditWorkflowStateEnvelope,
  screen02AuditWorkflowEnvelopeIdentity,
} from "../../src/core/screen02-audit-workflow-envelope";
import { prepareScreen02AssessmentRequest } from "../../src/core/screen02-workflow-state";
import {
  screen02AuditAssessmentPartIds,
  type Screen02AuditState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
  createScreen02AuditAssessmentCapability,
  createSignedScreen02AuditNormalizedReceipt,
  type Screen02AuditSigningConfig,
} from "../../src/worker/screen02-audit-assessment-security";
import { applySignedScreen02AuditReceiptEnvelope } from "../../src/worker/screen02-audit-assessment-service";
import { buildAuditIdentityState } from "../core/screen02-workflow-fixtures";

const signingConfig: Screen02AuditSigningConfig = {
  keyId: "stage4-audit-service-test-key",
  key: "fedcba9876543210fedcba9876543210",
};
const requestId = "audit-confirmed-service-request-1";
const issuedAt = "2026-08-09T18:12:00.000Z";
const receivedAt = "2026-08-09T18:12:01.000Z";

function preparedState() {
  return prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    jobId: "audit-confirmed-service-job-1",
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

async function signedReceipt(state = preparedState()) {
  const capability = await createScreen02AuditAssessmentCapability(
    {
      state,
      requestId,
      capabilityId: "audit-confirmed-service-capability-1",
      issuedAt,
    },
    signingConfig,
  );
  return createSignedScreen02AuditNormalizedReceipt(
    {
      submission: {
        schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
        capabilityToken: capability.capabilityToken,
        requestId,
        draft: validDraft(),
      },
      receiptId: "audit-confirmed-service-receipt-1",
      receivedAt,
    },
    signingConfig,
  );
}

describe("Screen 2 Audit stateless receipt service", () => {
  it("buffers a fast receipt until delivery, floors application time, and returns exact CAS coordinates", async () => {
    const prepared = preparedState();
    const signed = await signedReceipt(prepared);
    const awaiting = await applySignedScreen02AuditReceiptEnvelope(
      {
        stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(prepared),
        receiptToken: signed.receiptToken,
      },
      signingConfig,
    );
    expect(awaiting).toMatchObject({
      disposition: "awaiting-delivery",
      requestId,
      receiptId: "audit-confirmed-service-receipt-1",
      predecessorStateRevision: prepared.revision,
      successorStateRevision: prepared.revision,
      predecessorStateFingerprint: expect.stringMatching(
        /^fnv1a64:[0-9a-f]{16}$/,
      ),
      successorStateFingerprint: expect.stringMatching(
        /^fnv1a64:[0-9a-f]{16}$/,
      ),
      applicationResults: [],
    });
    expect(awaiting.successorStateFingerprint).toBe(
      awaiting.predecessorStateFingerprint,
    );

    const deliveredAt = "2026-08-09T18:12:03.000Z";
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId,
      at: deliveredAt,
      delivered: true,
    });
    const applied = await applySignedScreen02AuditReceiptEnvelope(
      {
        stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(delivered),
        receiptToken: signed.receiptToken,
      },
      signingConfig,
    );
    expect(applied).toMatchObject({
      disposition: "apply",
      predecessorStateRevision: delivered.revision,
      predecessorStateFingerprint: expect.stringMatching(
        /^fnv1a64:[0-9a-f]{16}$/,
      ),
      successorStateRevision: expect.any(Number),
      successorStateFingerprint: expect.stringMatching(
        /^fnv1a64:[0-9a-f]{16}$/,
      ),
      applicationResults: [
        expect.objectContaining({
          requestId,
          status: "completed",
          acceptedPartIds: screen02AuditAssessmentPartIds,
        }),
      ],
    });
    expect(applied.successorStateRevision).toBeGreaterThan(
      delivered.revision,
    );
    expect(applied.successorStateFingerprint).not.toBe(
      applied.predecessorStateFingerprint,
    );
    const decoded = decodeScreen02AuditWorkflowStateEnvelope(
      applied.stateEnvelope,
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.message);
    const request = decoded.state.assessmentRequests.find(
      (item) => item.requestId === requestId,
    );
    expect(request?.status).toBe("completed");
    expect(
      request?.lifecycle.find((event) => event.status === "draft-received")?.at,
    ).toBe(deliveredAt);
    expect(decoded.state.assessments.at(-1)).toMatchObject({
      requestId,
      status: "completed",
      overallJudgmentMethod: "fixed-computation",
      recordedAt: deliveredAt,
    });
  });

  it("treats replay as a duplicate and preserves the already-applied envelope", async () => {
    const prepared = preparedState();
    const signed = await signedReceipt(prepared);
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId,
      at: "2026-08-09T18:12:00.500Z",
      delivered: true,
    });
    const applied = await applySignedScreen02AuditReceiptEnvelope(
      {
        stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(delivered),
        receiptToken: signed.receiptToken,
      },
      signingConfig,
    );
    const replayed = await applySignedScreen02AuditReceiptEnvelope(
      {
        stateEnvelope: applied.stateEnvelope,
        receiptToken: signed.receiptToken,
      },
      signingConfig,
    );
    expect(replayed).toMatchObject({
      disposition: "duplicate",
      applicationResults: [],
    });
    expect(replayed.predecessorStateRevision).toBe(
      replayed.successorStateRevision,
    );
    expect(screen02AuditWorkflowEnvelopeIdentity(replayed.stateEnvelope)).toBe(
      screen02AuditWorkflowEnvelopeIdentity(applied.stateEnvelope),
    );
  });

  it("rejects a non-Audit or malformed state capsule before core application", async () => {
    const signed = await signedReceipt();
    await expect(
      applySignedScreen02AuditReceiptEnvelope(
        { stateEnvelope: {}, receiptToken: signed.receiptToken },
        signingConfig,
      ),
    ).rejects.toThrow(/rejected state: envelope-shape/);
  });
});
