export const SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION =
  "shockaudit-screen02-host-result-render-marker-v1" as const;

export type Screen02HostResultRenderMarker = {
  schemaVersion: typeof SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION;
  runId: string;
  taskId: string;
  resultId: string;
  expectedParentRevision: number;
  workflowRevision: number;
  workflowStateFingerprint: string;
  applicationFingerprint: string;
  resultFingerprint: string;
  operationId: string;
};

export type Screen02HostResultMarkerElement = {
  isConnected: boolean;
  open: boolean;
  dataset: {
    hostResultRenderMarker?: string;
    hostRunId?: string;
    hostTaskId?: string;
    hostResultId?: string;
    hostExpectedParentRevision?: string;
    hostWorkflowRevision?: string;
    hostWorkflowStateFingerprint?: string;
    hostApplicationFingerprint?: string;
    hostResultFingerprint?: string;
    hostOperationId?: string;
  };
};

export function screen02HostResultRenderMarkerMatches(
  left: Screen02HostResultRenderMarker | null | undefined,
  right: Screen02HostResultRenderMarker | null | undefined,
) {
  return Boolean(
    left && right &&
      left.schemaVersion === right.schemaVersion &&
      left.runId === right.runId &&
      left.taskId === right.taskId &&
      left.resultId === right.resultId &&
      left.expectedParentRevision === right.expectedParentRevision &&
      left.workflowRevision === right.workflowRevision &&
      left.workflowStateFingerprint === right.workflowStateFingerprint &&
      left.applicationFingerprint === right.applicationFingerprint &&
      left.resultFingerprint === right.resultFingerprint &&
      left.operationId === right.operationId,
  );
}

export function screen02HostResultMarkerElementMatches(
  element: Screen02HostResultMarkerElement | null | undefined,
  marker: Screen02HostResultRenderMarker,
) {
  return Boolean(
    element?.isConnected && element.open &&
      element.dataset.hostResultRenderMarker === marker.schemaVersion &&
      element.dataset.hostRunId === marker.runId &&
      element.dataset.hostTaskId === marker.taskId &&
      element.dataset.hostResultId === marker.resultId &&
      element.dataset.hostExpectedParentRevision ===
        String(marker.expectedParentRevision) &&
      element.dataset.hostWorkflowRevision ===
        String(marker.workflowRevision) &&
      element.dataset.hostWorkflowStateFingerprint ===
        marker.workflowStateFingerprint &&
      element.dataset.hostApplicationFingerprint ===
        marker.applicationFingerprint &&
      element.dataset.hostResultFingerprint === marker.resultFingerprint &&
      element.dataset.hostOperationId === marker.operationId,
  );
}

/** Keep the exact pending result expanded until its paint barrier settles. */
export function reopenScreen02HostResultMarker(
  element: Screen02HostResultMarkerElement,
  marker: Screen02HostResultRenderMarker | null | undefined,
) {
  if (!marker || element.open) return false;
  element.open = true;
  return true;
}

type AnimationFrameRequest = (callback: FrameRequestCallback) => number;
type AnimationFrameCancel = (handle: number) => void;

/**
 * A mounted DOM node is not evidence that its contents were painted. Wait for
 * one complete frame and enter the callback from the following frame. Hidden,
 * removed, collapsed, superseded, or attribute-mutated markers fail closed.
 */
export function scheduleScreen02HostResultAfterPaint(input: {
  marker: Screen02HostResultRenderMarker;
  element: Screen02HostResultMarkerElement;
  requestFrame?: AnimationFrameRequest;
  cancelFrame?: AnimationFrameCancel;
  isVisible?: () => boolean;
  onPainted: (
    marker: Screen02HostResultRenderMarker,
    element: Screen02HostResultMarkerElement,
  ) => void;
}) {
  const requestFrame = input.requestFrame;
  const cancelFrame = input.cancelFrame;
  const isVisible = input.isVisible ?? (() => true);
  let cancelled = false;
  let firstFrame: number | null = null;
  let secondFrame: number | null = null;

  if (!requestFrame || !cancelFrame) return () => undefined;

  const markerIsPaintable = () =>
    !cancelled && isVisible() &&
    screen02HostResultMarkerElementMatches(input.element, input.marker);

  firstFrame = requestFrame(() => {
    firstFrame = null;
    if (!markerIsPaintable()) return;
    secondFrame = requestFrame(() => {
      secondFrame = null;
      if (!markerIsPaintable()) return;
      input.onPainted(input.marker, input.element);
    });
  });

  return () => {
    cancelled = true;
    if (firstFrame !== null) cancelFrame(firstFrame);
    if (secondFrame !== null) cancelFrame(secondFrame);
    firstFrame = null;
    secondFrame = null;
  };
}

export type Screen02HostResultPostPaintOutcome<T> =
  | { outcome: "acknowledged"; acknowledgement: T }
  | { outcome: "stale" }
  | { outcome: "persistence-failed" }
  | { outcome: "acknowledgement-rejected" };

export function claimScreen02HostResultAcknowledgement(
  lease: { current: string | null },
  operationId: string,
) {
  if (lease.current !== null) return false;
  lease.current = operationId;
  return true;
}

export function releaseScreen02HostResultAcknowledgement(
  lease: { current: string | null },
  operationId: string,
) {
  if (lease.current !== operationId) return false;
  lease.current = null;
  return true;
}

/**
 * Runs only after the exact marker reports a paint. Persistence and every
 * identity check are repeated before the server acknowledgement is allowed.
 */
export async function finalizeScreen02HostResultAfterPaint<T>(input: {
  marker: Screen02HostResultRenderMarker;
  isCurrent: (marker: Screen02HostResultRenderMarker) => boolean;
  persist: (marker: Screen02HostResultRenderMarker) => Promise<boolean>;
  acknowledge: (marker: Screen02HostResultRenderMarker) => Promise<T>;
  acknowledgementMatches: (
    acknowledgement: T,
    marker: Screen02HostResultRenderMarker,
  ) => boolean;
}): Promise<Screen02HostResultPostPaintOutcome<T>> {
  if (!input.isCurrent(input.marker)) return { outcome: "stale" };
  if (!await input.persist(input.marker)) {
    return { outcome: "persistence-failed" };
  }
  if (!input.isCurrent(input.marker)) return { outcome: "stale" };
  const acknowledgement = await input.acknowledge(input.marker);
  if (!input.isCurrent(input.marker)) return { outcome: "stale" };
  if (!input.acknowledgementMatches(acknowledgement, input.marker)) {
    return { outcome: "acknowledgement-rejected" };
  }
  return { outcome: "acknowledged", acknowledgement };
}
