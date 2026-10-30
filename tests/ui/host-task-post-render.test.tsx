import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Screen02HostReviewDetails from
  "../../src/ui/host-task/Screen02HostReviewDetails";
import {
  claimScreen02HostResultAcknowledgement,
  finalizeScreen02HostResultAfterPaint,
  reopenScreen02HostResultMarker,
  releaseScreen02HostResultAcknowledgement,
  scheduleScreen02HostResultAfterPaint,
  screen02HostResultMarkerElementMatches,
  screen02HostResultRenderMarkerMatches,
  SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
  type Screen02HostResultMarkerElement,
  type Screen02HostResultRenderMarker,
} from "../../src/ui/host-task/screen02-host-post-render";

const marker: Screen02HostResultRenderMarker = {
  schemaVersion: SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
  runId: "run-one",
  taskId: "host-task:one",
  resultId: "host-result:one",
  expectedParentRevision: 4,
  workflowRevision: 5,
  workflowStateFingerprint: "fnv1a64:0011223344556677",
  applicationFingerprint: "fnv1a64:1122334455667788",
  resultFingerprint: "fnv1a64:2233445566778899",
  operationId: "screen02-refresh:one",
};

function markerElement(
  overrides: Partial<Screen02HostResultMarkerElement> = {},
): Screen02HostResultMarkerElement {
  return {
    isConnected: true,
    open: true,
    dataset: {
      hostResultRenderMarker: marker.schemaVersion,
      hostRunId: marker.runId,
      hostTaskId: marker.taskId,
      hostResultId: marker.resultId,
      hostExpectedParentRevision: String(marker.expectedParentRevision),
      hostWorkflowRevision: String(marker.workflowRevision),
      hostWorkflowStateFingerprint: marker.workflowStateFingerprint,
      hostApplicationFingerprint: marker.applicationFingerprint,
      hostResultFingerprint: marker.resultFingerprint,
      hostOperationId: marker.operationId,
    },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("Screen 2 host-result post-render reconciliation", () => {
  it("renders an open exact result marker without exposing private authority", () => {
    const html = renderToStaticMarkup(
      <Screen02HostReviewDetails
        review={{
          candidateReviewCount: 0,
          candidateReviews: [],
          followUpQueries: ["official implementation source"],
          sourceLeadCount: 1,
          rationale: "Bounded validated suggestions only.",
        }}
        candidates={[]}
        reconciliationMarker={marker}
      />,
    );

    expect(html).toContain('data-testid="screen02-host-review-result"');
    expect(html).toContain(
      `data-host-result-render-marker="${marker.schemaVersion}"`,
    );
    expect(html).toContain(`data-host-run-id="${marker.runId}"`);
    expect(html).toContain(`data-host-task-id="${marker.taskId}"`);
    expect(html).toContain(`data-host-result-id="${marker.resultId}"`);
    expect(html).toContain(
      `data-host-expected-parent-revision="${marker.expectedParentRevision}"`,
    );
    expect(html).toContain(
      `data-host-workflow-revision="${marker.workflowRevision}"`,
    );
    expect(html).toContain(
      `data-host-workflow-state-fingerprint="${marker.workflowStateFingerprint}"`,
    );
    expect(html).toContain(
      `data-host-application-fingerprint="${marker.applicationFingerprint}"`,
    );
    expect(html).toContain(
      `data-host-result-fingerprint="${marker.resultFingerprint}"`,
    );
    expect(html).toContain(
      `data-host-operation-id="${marker.operationId}"`,
    );
    expect(html).toMatch(/<details[^>]* open=""/u);
    expect(html).toContain("Bounded validated suggestions only.");
    expect(html).not.toContain("accessToken");
    expect(html).not.toContain("capability");
  });

  it("requires every exact marker field plus a connected, open element", () => {
    expect(screen02HostResultMarkerElementMatches(markerElement(), marker))
      .toBe(true);
    expect(screen02HostResultRenderMarkerMatches(marker, { ...marker }))
      .toBe(true);
    expect(screen02HostResultRenderMarkerMatches(marker, {
      ...marker,
      operationId: "another-operation",
    })).toBe(false);

    const mutations: Array<(element: Screen02HostResultMarkerElement) => void> = [
      (element) => { element.isConnected = false; },
      (element) => { element.open = false; },
      (element) => { element.dataset.hostResultRenderMarker = undefined; },
      (element) => { element.dataset.hostRunId = "another-run"; },
      (element) => { element.dataset.hostTaskId = "another-task"; },
      (element) => { element.dataset.hostResultId = "another-result"; },
      (element) => { element.dataset.hostExpectedParentRevision = "3"; },
      (element) => { element.dataset.hostWorkflowRevision = "6"; },
      (element) => {
        element.dataset.hostWorkflowStateFingerprint =
          "fnv1a64:ffffffffffffffff";
      },
      (element) => {
        element.dataset.hostApplicationFingerprint =
          "fnv1a64:ffffffffffffffff";
      },
      (element) => {
        element.dataset.hostResultFingerprint =
          "fnv1a64:ffffffffffffffff";
      },
      (element) => { element.dataset.hostOperationId = "another-operation"; },
    ];
    for (const mutate of mutations) {
      const element = markerElement();
      mutate(element);
      expect(screen02HostResultMarkerElementMatches(element, marker)).toBe(false);
    }
  });

  it("keeps the pending result expanded until its paint barrier settles", () => {
    const element = markerElement({ open: false });
    expect(reopenScreen02HostResultMarker(element, marker)).toBe(true);
    expect(element.open).toBe(true);
    expect(reopenScreen02HostResultMarker(element, marker)).toBe(false);

    element.open = false;
    expect(reopenScreen02HostResultMarker(element, null)).toBe(false);
    expect(element.open).toBe(false);
  });

  it("reports paint only from the second visible animation frame", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    });
    const cancelFrame = vi.fn((handle: number) => callbacks.delete(handle));
    const onPainted = vi.fn();
    const cancel = scheduleScreen02HostResultAfterPaint({
      marker,
      element: markerElement(),
      requestFrame,
      cancelFrame,
      isVisible: () => true,
      onPainted,
    });
    const runNextFrame = () => {
      const next = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      if (!next) throw new Error("Expected an animation frame.");
      callbacks.delete(next[0]);
      next[1](0);
    };

    expect(onPainted).not.toHaveBeenCalled();
    runNextFrame();
    expect(onPainted).not.toHaveBeenCalled();
    runNextFrame();
    expect(onPainted).toHaveBeenCalledOnce();
    expect(onPainted).toHaveBeenCalledWith(marker, expect.any(Object));
    cancel();
  });

  it("cancels superseded frames and fails closed for hidden or stale markers", () => {
    const frames: FrameRequestCallback[] = [];
    const requestFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };
    const onPainted = vi.fn();
    const cancel = scheduleScreen02HostResultAfterPaint({
      marker,
      element: markerElement(),
      requestFrame,
      cancelFrame: vi.fn(),
      isVisible: () => true,
      onPainted,
    });
    cancel();
    frames[0]?.(0);
    expect(onPainted).not.toHaveBeenCalled();

    let visible = true;
    const staleElement = markerElement();
    const staleFrames: FrameRequestCallback[] = [];
    scheduleScreen02HostResultAfterPaint({
      marker,
      element: staleElement,
      requestFrame: (callback) => {
        staleFrames.push(callback);
        return staleFrames.length;
      },
      cancelFrame: vi.fn(),
      isVisible: () => visible,
      onPainted,
    });
    staleFrames[0]?.(0);
    staleElement.dataset.hostResultId = "superseded-result";
    visible = false;
    staleFrames[1]?.(0);
    expect(onPainted).not.toHaveBeenCalled();

    scheduleScreen02HostResultAfterPaint({
      marker,
      element: markerElement(),
      onPainted,
    })();
    expect(onPainted).not.toHaveBeenCalled();
  });

  it("awaits strict persistence and rechecks identity before acknowledgement", async () => {
    const persistence = deferred<boolean>();
    const acknowledgement = deferred<{ resultId: string }>();
    const order: string[] = [];
    const acknowledge = vi.fn(() => {
      order.push("acknowledge");
      return acknowledgement.promise;
    });
    const operation = finalizeScreen02HostResultAfterPaint({
      marker,
      isCurrent: () => {
        order.push("current");
        return true;
      },
      persist: () => {
        order.push("persist");
        return persistence.promise;
      },
      acknowledge,
      acknowledgementMatches: (value) => {
        order.push("match");
        return value.resultId === marker.resultId;
      },
    });

    await Promise.resolve();
    expect(acknowledge).not.toHaveBeenCalled();
    persistence.resolve(true);
    await Promise.resolve();
    expect(acknowledge).toHaveBeenCalledOnce();
    acknowledgement.resolve({ resultId: marker.resultId });
    await expect(operation).resolves.toMatchObject({ outcome: "acknowledged" });
    expect(order).toEqual([
      "current",
      "persist",
      "current",
      "acknowledge",
      "current",
      "match",
    ]);
  });

  it("never acknowledges failed persistence or a navigation/stale settlement", async () => {
    const acknowledge = vi.fn(async () => ({ resultId: marker.resultId }));
    await expect(finalizeScreen02HostResultAfterPaint({
      marker,
      isCurrent: () => true,
      persist: async () => false,
      acknowledge,
      acknowledgementMatches: () => true,
    })).resolves.toEqual({ outcome: "persistence-failed" });
    expect(acknowledge).not.toHaveBeenCalled();

    const persistence = deferred<boolean>();
    let activeScreen: 1 | 2 = 2;
    const late = finalizeScreen02HostResultAfterPaint({
      marker,
      isCurrent: () => activeScreen === 2,
      persist: () => persistence.promise,
      acknowledge,
      acknowledgementMatches: () => true,
    });
    activeScreen = 1;
    persistence.resolve(true);
    await expect(late).resolves.toEqual({ outcome: "stale" });
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("rejects an acknowledgement that settles after the exact panel is stale", async () => {
    const acknowledgement = deferred<{ resultId: string }>();
    let current = true;
    const acknowledge = vi.fn(() => acknowledgement.promise);
    const late = finalizeScreen02HostResultAfterPaint({
      marker,
      isCurrent: () => current,
      persist: async () => true,
      acknowledge,
      acknowledgementMatches: (value) =>
        value.resultId === marker.resultId,
    });
    await vi.waitFor(() => expect(acknowledge).toHaveBeenCalledOnce());

    current = false;
    acknowledgement.resolve({ resultId: marker.resultId });
    await expect(late).resolves.toEqual({ outcome: "stale" });
  });

  it("leases one exact operation across duplicate paint reports", () => {
    const lease = { current: null as string | null };
    expect(claimScreen02HostResultAcknowledgement(lease, marker.operationId))
      .toBe(true);
    expect(claimScreen02HostResultAcknowledgement(lease, marker.operationId))
      .toBe(false);
    expect(claimScreen02HostResultAcknowledgement(lease, "new-operation"))
      .toBe(false);
    expect(releaseScreen02HostResultAcknowledgement(lease, "new-operation"))
      .toBe(false);
    expect(releaseScreen02HostResultAcknowledgement(lease, marker.operationId))
      .toBe(true);
    expect(claimScreen02HostResultAcknowledgement(lease, "new-operation"))
      .toBe(true);
  });
});
