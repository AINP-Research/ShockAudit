import { useEffect, useRef } from "react";

import type { Screen02HostReviewSummary } from "./host-task-client";
import {
  reopenScreen02HostResultMarker,
  scheduleScreen02HostResultAfterPaint,
  type Screen02HostResultMarkerElement,
  type Screen02HostResultRenderMarker,
} from "./screen02-host-post-render";

type CandidateLabel = {
  candidateSnapshotId: string;
  identity: { canonicalTitle: string };
};

export type Screen02HostReviewDetailsProps = {
  review: Screen02HostReviewSummary;
  candidates: readonly CandidateLabel[];
  reconciliationMarker?: Screen02HostResultRenderMarker | null;
  onReconciliationMarkerPainted?: (
    marker: Screen02HostResultRenderMarker,
    element: Screen02HostResultMarkerElement,
  ) => void;
  onReconciliationMarkerRemoved?: (
    marker: Screen02HostResultRenderMarker,
    element: Screen02HostResultMarkerElement,
  ) => void;
};

function classLabel(value: Screen02HostReviewSummary["candidateReviews"][number]["proposedClass"]) {
  return value === "direct"
    ? "Direct"
    : value === "adjacent"
      ? "Adjacent"
      : value === "broad"
        ? "Broad"
        : "Mismatch";
}

export default function Screen02HostReviewDetails({
  review,
  candidates,
  reconciliationMarker = null,
  onReconciliationMarkerPainted,
  onReconciliationMarkerRemoved,
}: Screen02HostReviewDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const onPaintedRef = useRef(onReconciliationMarkerPainted);
  const onRemovedRef = useRef(onReconciliationMarkerRemoved);
  onPaintedRef.current = onReconciliationMarkerPainted;
  onRemovedRef.current = onReconciliationMarkerRemoved;
  const title = (candidateId: string) =>
    candidates.find((candidate) =>
      candidate.candidateSnapshotId === candidateId
    )?.identity.canonicalTitle ?? "Candidate review";

  useEffect(() => {
    const element = detailsRef.current;
    if (!reconciliationMarker || !element) return;
    const requestFrame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : undefined;
    const cancelFrame = typeof window.cancelAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : undefined;
    const cancel = scheduleScreen02HostResultAfterPaint({
      marker: reconciliationMarker,
      element,
      requestFrame,
      cancelFrame,
      // Treat anything other than an affirmatively visible document as
      // non-paint evidence. This includes a prerendered or host-suspended
      // iframe, even if requestAnimationFrame happens to be shimmed there.
      isVisible: () => document.visibilityState === "visible",
      onPainted: (marker, paintedElement) => {
        onPaintedRef.current?.(marker, paintedElement);
      },
    });
    return () => {
      cancel();
      onRemovedRef.current?.(reconciliationMarker, element);
    };
  }, [reconciliationMarker]);

  return (
    <details
      ref={detailsRef}
      data-testid="screen02-host-review-result"
      data-host-result-render-marker={reconciliationMarker?.schemaVersion}
      data-host-run-id={reconciliationMarker?.runId}
      data-host-task-id={reconciliationMarker?.taskId}
      data-host-result-id={reconciliationMarker?.resultId}
      data-host-expected-parent-revision={
        reconciliationMarker?.expectedParentRevision
      }
      data-host-workflow-revision={reconciliationMarker?.workflowRevision}
      data-host-workflow-state-fingerprint={
        reconciliationMarker?.workflowStateFingerprint
      }
      data-host-application-fingerprint={
        reconciliationMarker?.applicationFingerprint
      }
      data-host-result-fingerprint={reconciliationMarker?.resultFingerprint}
      data-host-operation-id={reconciliationMarker?.operationId}
      open={reconciliationMarker ? true : undefined}
      onToggle={(event) => {
        reopenScreen02HostResultMarker(
          event.currentTarget,
          reconciliationMarker,
        );
      }}
    >
      <summary>Review the validated suggestions</summary>
      <p>
        {review.candidateReviewCount} candidate review
        {review.candidateReviewCount === 1 ? "" : "s"}, {" "}
        {review.followUpQueries.length} bounded follow-up quer
        {review.followUpQueries.length === 1 ? "y" : "ies"}, and {" "}
        {review.sourceLeadCount} source lead
        {review.sourceLeadCount === 1 ? "" : "s"} passed the structured
        review boundary.
      </p>
      <p>
        These are preliminary search suggestions, not source facts. They cannot
        establish eligibility, legal coverage, exposure, or a researcher
        decision; source-backed qualification and evidence remain controlling.
      </p>
      <p>{review.rationale}</p>
      {review.candidateReviews.length > 0 && (
        <ol className="s2-find-host-review-candidates">
          {review.candidateReviews.map((candidate) => (
            <li key={candidate.candidateId}>
              <h3>{title(candidate.candidateId)}</h3>
              <dl>
                <div>
                  <dt>Suggested class — not eligibility</dt>
                  <dd>{classLabel(candidate.proposedClass)}</dd>
                </div>
                <div><dt>Industry bridge</dt><dd>{candidate.industryBridge}</dd></div>
                <div><dt>Sample connection</dt><dd>{candidate.sampleConnection}</dd></div>
                <div><dt>Preliminary outcome pathway</dt><dd>{candidate.outcomePathway}</dd></div>
                <div>
                  <dt>Uncertainty and follow-up</dt>
                  <dd>
                    {candidate.mainMismatchOrUncertainty} {" "}
                    {candidate.needsFollowUpRetrieval
                      ? "Additional source retrieval was suggested."
                      : "No additional retrieval was suggested."}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
      {review.followUpQueries.length > 0 && (
        <>
          <h3>Suggested follow-up queries</h3>
          <ul>{review.followUpQueries.map((query, index) => (
            <li key={`${index}:${query}`}>{query}</li>
          ))}</ul>
        </>
      )}
    </details>
  );
}
