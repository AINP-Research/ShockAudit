import {
  applyScreen02AuditAssessmentDraftReceipt,
  applyScreen02AuditDossierDraftReceipt,
  type Screen02AuditReceiptApplicationResult,
} from "../core/screen02-audit-workflow";
import { upsertScreen02ShockGlance } from "../core/screen02-shock-glance";
import {
  decodeScreen02AuditWorkflowStateEnvelope,
  encodeScreen02AuditWorkflowStateEnvelope,
  type Screen02AuditWorkflowStateEnvelope,
} from "../core/screen02-audit-workflow-envelope";
import {
  fingerprintScreen02WorkflowState,
  requireScreen02AuditState,
} from "../core/screen02-workflow-state";
import {
  inspectScreen02AuditReceiptDisposition,
  verifySignedScreen02AuditNormalizedReceipt,
  type Screen02AuditReceiptDisposition,
  type Screen02AuditSigningConfig,
} from "./screen02-audit-assessment-security";
import {
  applyScreen02HostOrientationToGlance,
  buildScreen02AuditHostOrientationSupport,
} from "./screen02-host-orientation-security";

export const SCREEN_02_AUDIT_RECEIPT_APPLICATION_SCHEMA_VERSION =
  "screen-02-audit-receipt-application-v1" as const;
export const SCREEN_02_AUDIT_RECEIPT_APPLY_INPUT_SCHEMA_VERSION =
  "screen-02-audit-receipt-apply-input-v1" as const;

export type Screen02AuditReceiptApplicationServiceResult = {
  schemaVersion: typeof SCREEN_02_AUDIT_RECEIPT_APPLICATION_SCHEMA_VERSION;
  disposition: Screen02AuditReceiptDisposition["disposition"];
  reason: string;
  requestId: string;
  receiptId: string;
  predecessorStateRevision: number;
  predecessorStateFingerprint: string;
  successorStateRevision: number;
  successorStateFingerprint: string;
  stateEnvelope: Screen02AuditWorkflowStateEnvelope;
  applicationResults: Screen02AuditReceiptApplicationResult[];
};

/**
 * Stateless Stage 4 receipt/apply boundary. The app supplies a complete bounded
 * Audit envelope plus an authenticated normalized receipt. This worker owns no
 * workflow persistence and invokes no model API; fixed core performs the one
 * atomic state transition after every capability and race check succeeds.
 */
export async function applySignedScreen02AuditReceiptEnvelope(
  input: {
    stateEnvelope: unknown;
    receiptToken: unknown;
  },
  config: Screen02AuditSigningConfig,
): Promise<Screen02AuditReceiptApplicationServiceResult> {
  const decoded = decodeScreen02AuditWorkflowStateEnvelope(
    input.stateEnvelope,
  );
  if (!decoded.ok) {
    throw new Error(
      `Screen 2 Audit receipt application rejected state: ${decoded.code}. ${decoded.message}`,
    );
  }
  const verified = await verifySignedScreen02AuditNormalizedReceipt(
    input.receiptToken,
    config,
  );
  const disposition = inspectScreen02AuditReceiptDisposition(
    decoded.state,
    verified,
  );
  const predecessorStateRevision = decoded.state.revision;
  const predecessorStateFingerprint =
    fingerprintScreen02WorkflowState(decoded.state);
  if (disposition.disposition !== "apply") {
    return {
      schemaVersion: SCREEN_02_AUDIT_RECEIPT_APPLICATION_SCHEMA_VERSION,
      disposition: disposition.disposition,
      reason: disposition.reason,
      requestId: verified.payload.capability.requestId,
      receiptId: verified.payload.receiptId,
      predecessorStateRevision,
      predecessorStateFingerprint,
      successorStateRevision: predecessorStateRevision,
      successorStateFingerprint: predecessorStateFingerprint,
      stateEnvelope: decoded.envelope,
      applicationResults: [],
    };
  }

  // A fast model receipt can be observed before the app persists the host's
  // delivery acknowledgement. Preserve the signed receipt time, but never
  // backdate canonical lifecycle events when that buffered receipt is applied.
  const applicationAt =
    Date.parse(verified.payload.receivedAt) < Date.parse(decoded.state.updatedAt)
      ? decoded.state.updatedAt
      : verified.payload.receivedAt;
  const applied =
    verified.payload.capability.mode === "audit-dossier"
      ? applyScreen02AuditDossierDraftReceipt(
          decoded.state,
          verified.receipt,
          applicationAt,
        )
      : applyScreen02AuditAssessmentDraftReceipt(
          decoded.state,
          verified.receipt,
          applicationAt,
        );
  let successor = applied.state;
  const capability = verified.payload.capability;
  const fixed = successor.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === capability.matchSnapshotId,
  );
  if (fixed) {
    const resolved = applyScreen02HostOrientationToGlance(
      fixed,
      verified.hostOrientation,
      buildScreen02AuditHostOrientationSupport(successor, {
        runId: capability.runId,
        requestId: capability.requestId,
        candidateSnapshotId: capability.matchSnapshotId,
        candidateFingerprint: capability.matchFingerprint,
        dossierSnapshotId: capability.dossierSnapshotId,
      }),
      applicationAt,
    );
    if (resolved.status === "accepted") {
      successor = requireScreen02AuditState({
        ...successor,
        shockGlances: upsertScreen02ShockGlance(
          successor.shockGlances,
          resolved.glance,
        ),
      });
    }
  }
  const successorStateFingerprint = fingerprintScreen02WorkflowState(
    successor,
  );
  return {
    schemaVersion: SCREEN_02_AUDIT_RECEIPT_APPLICATION_SCHEMA_VERSION,
    disposition: "apply",
    reason: disposition.reason,
    requestId: verified.payload.capability.requestId,
    receiptId: verified.payload.receiptId,
    predecessorStateRevision,
    predecessorStateFingerprint,
    successorStateRevision: successor.revision,
    successorStateFingerprint,
    stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(successor),
    applicationResults: applied.results,
  };
}
