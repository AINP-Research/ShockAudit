import {
  applyScreen02FindCandidateDraftReceipt,
  applyScreen02FindCriterionDraftReceipt,
  type Screen02FindReceiptApplicationResult,
} from "../core/screen02-find-workflow";
import { upsertScreen02ShockGlance } from "../core/screen02-shock-glance";
import {
  decodeScreen02FindWorkflowStateEnvelope,
  encodeScreen02FindWorkflowStateEnvelope,
  type Screen02FindWorkflowStateEnvelope,
} from "../core/screen02-workflow-envelope";
import {
  fingerprintScreen02WorkflowState,
  requireScreen02FindState,
} from "../core/screen02-workflow-state";
import {
  inspectScreen02FindReceiptDisposition,
  verifySignedScreen02FindNormalizedReceipt,
  type Screen02FindReceiptDisposition,
  type Screen02FindSigningConfig,
} from "./screen02-find-assessment-security";
import {
  applyScreen02HostOrientationToGlance,
  buildScreen02FindHostOrientationSupport,
} from "./screen02-host-orientation-security";

export const SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION =
  "screen-02-find-receipt-application-v1" as const;
export const SCREEN_02_FIND_RECEIPT_APPLY_INPUT_SCHEMA_VERSION =
  "screen-02-find-receipt-apply-input-v1" as const;

export type Screen02FindReceiptApplicationServiceResult = {
  schemaVersion: typeof SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION;
  disposition: Screen02FindReceiptDisposition["disposition"];
  reason: string;
  requestId: string;
  receiptId: string;
  predecessorStateRevision: number;
  predecessorStateFingerprint: string;
  successorStateRevision: number;
  successorStateFingerprint: string;
  stateEnvelope: Screen02FindWorkflowStateEnvelope;
  applicationResults: Screen02FindReceiptApplicationResult[];
};

/**
 * Stateless worker boundary for the Stage 3 receipt/apply flow. The caller
 * supplies the complete authoritative state envelope and authenticated receipt;
 * this service performs no persistence and invokes no model API.
 */
export async function applySignedScreen02FindReceiptEnvelope(
  input: {
    stateEnvelope: unknown;
    receiptToken: unknown;
  },
  config: Screen02FindSigningConfig,
): Promise<Screen02FindReceiptApplicationServiceResult> {
  const decoded = decodeScreen02FindWorkflowStateEnvelope(input.stateEnvelope);
  if (!decoded.ok) {
    throw new Error(
      `Screen 2 Find receipt application rejected state: ${decoded.code}. ${decoded.message}`,
    );
  }
  const verified = await verifySignedScreen02FindNormalizedReceipt(
    input.receiptToken,
    config,
  );
  const disposition = inspectScreen02FindReceiptDisposition(
    decoded.state,
    verified,
  );
  const predecessorStateRevision = decoded.state.revision;
  const predecessorStateFingerprint =
    fingerprintScreen02WorkflowState(decoded.state);
  if (disposition.disposition !== "apply") {
    return {
      schemaVersion: SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION,
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

  // A model receipt can become observable before the app persists the host's
  // delivery acknowledgement. Preserve the signed receipt time in the receipt,
  // but never backdate the canonical state lifecycle when that buffered receipt
  // is later applied.
  const applicationAt =
    Date.parse(verified.payload.receivedAt) < Date.parse(decoded.state.updatedAt)
      ? decoded.state.updatedAt
      : verified.payload.receivedAt;
  const applied =
    verified.payload.capability.mode === "find-candidate"
      ? applyScreen02FindCandidateDraftReceipt(
          decoded.state,
          verified.receipt,
          applicationAt,
        )
      : applyScreen02FindCriterionDraftReceipt(
          decoded.state,
          verified.receipt,
          applicationAt,
        );
  let successor = applied.state;
  if (verified.payload.capability.mode === "find-candidate") {
    const capability = verified.payload.capability;
    const fixed = successor.shockGlances?.find(
      (glance) =>
        glance.candidateSnapshotId === capability.candidateSnapshotId,
    );
    if (fixed) {
      const resolved = applyScreen02HostOrientationToGlance(
        fixed,
        verified.hostOrientation,
        buildScreen02FindHostOrientationSupport(successor, {
          runId: capability.runId,
          requestId: capability.requestId,
          candidateSnapshotId: capability.candidateSnapshotId,
          candidateFingerprint: capability.candidateFingerprint,
        }),
        applicationAt,
      );
      if (resolved.status === "accepted") {
        successor = requireScreen02FindState({
          ...successor,
          shockGlances: upsertScreen02ShockGlance(
            successor.shockGlances,
            resolved.glance,
          ),
        });
      }
    }
  }
  const successorStateFingerprint = fingerprintScreen02WorkflowState(
    successor,
  );
  return {
    schemaVersion: SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION,
    disposition: "apply",
    reason: disposition.reason,
    requestId: verified.payload.capability.requestId,
    receiptId: verified.payload.receiptId,
    predecessorStateRevision,
    predecessorStateFingerprint,
    successorStateRevision: successor.revision,
    successorStateFingerprint,
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(successor),
    applicationResults: applied.results,
  };
}
