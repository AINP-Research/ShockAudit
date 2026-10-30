import type { HostTaskStatus } from "./HostTaskStatusPanel";
import type { HostReasoningMode } from "./host-task-client";

type ReopenedScreen03Coordinates = {
  runId: string;
  selectedEventId: string | null;
  eventFingerprint: string;
  stateFingerprint: string;
  activeSourceIds: readonly string[];
};

type Screen03OverviewCoordinates = {
  runId: string;
  selectedEventId: string;
  expectedEventFingerprint: string;
};

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

type HostOverviewSuggestion = {
  summary: string;
  keyPoints: string[];
  uncertainties: string[];
  sourceIds: string[];
};

function hostOverviewSuggestion(value: unknown): HostOverviewSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== "shockaudit-screen03-host-overview-result-v1" ||
    candidate.origin !== "chatgpt-host" || candidate.nonCanonical !== true ||
    typeof candidate.summary !== "string" ||
    !Array.isArray(candidate.keyPoints) ||
    !candidate.keyPoints.every((item) => typeof item === "string") ||
    !Array.isArray(candidate.uncertainties) ||
    !candidate.uncertainties.every((item) => typeof item === "string") ||
    !Array.isArray(candidate.sourceIds) ||
    !candidate.sourceIds.every((item) => typeof item === "string") ||
    candidate.outcomeValuesInspected !== false
  ) return null;
  return {
    summary: candidate.summary,
    keyPoints: [...candidate.keyPoints] as string[],
    uncertainties: [...candidate.uncertainties] as string[],
    sourceIds: [...candidate.sourceIds] as string[],
  };
}

/**
 * Overview prose stays noncanonical, but it may be shown only beside the
 * precise Screen 3 state and active sources the fixed validator inspected.
 */
export function screen03HostOverviewResultIsCurrent(
  result: unknown,
  reopened: ReopenedScreen03Coordinates,
  coordinates: Screen03OverviewCoordinates,
) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return false;
  }
  const candidate = result as Record<string, unknown>;
  const sourceIds = candidate.sourceIds;
  const activeSourceIds = new Set(reopened.activeSourceIds);
  return exactKeys(candidate, [
    "schemaVersion", "origin", "nonCanonical", "summary", "keyPoints",
    "uncertainties", "sourceIds", "conciseRationale", "hostModel",
    "stateFingerprintInspected", "outcomeValuesInspected",
  ]) &&
    candidate.schemaVersion ===
      "shockaudit-screen03-host-overview-result-v1" &&
    candidate.origin === "chatgpt-host" && candidate.nonCanonical === true &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.keyPoints) &&
    candidate.keyPoints.every((item) => typeof item === "string") &&
    Array.isArray(candidate.uncertainties) &&
    candidate.uncertainties.every((item) => typeof item === "string") &&
    Array.isArray(sourceIds) && sourceIds.length > 0 &&
    sourceIds.every((item) =>
      typeof item === "string" && activeSourceIds.has(item)
    ) &&
    new Set(sourceIds).size === sourceIds.length &&
    typeof candidate.conciseRationale === "string" &&
    candidate.hostModel === "host_model_not_exposed" &&
    candidate.outcomeValuesInspected === false &&
    reopened.runId === coordinates.runId &&
    reopened.selectedEventId === coordinates.selectedEventId &&
    reopened.eventFingerprint === coordinates.expectedEventFingerprint &&
    candidate.stateFingerprintInspected === reopened.stateFingerprint;
}

export function Screen03HostOverview({
  overview,
  hostReasoningMode,
  hostOverviewTaskStatus,
  hostOverviewResult,
  onRequestOverviewImprovement,
}: {
  overview: {
    title: string;
    summary: string;
    sectionLabel: string;
    keyPoints: string[];
  };
  hostReasoningMode?: HostReasoningMode;
  hostOverviewTaskStatus?: HostTaskStatus | null;
  hostOverviewResult?: unknown | null;
  onRequestOverviewImprovement?: () => void;
}) {
  const improved = hostOverviewSuggestion(hostOverviewResult);
  const taskActive = Boolean(
    hostOverviewTaskStatus &&
      ["starting", "waiting", "applying"].includes(
        hostOverviewTaskStatus.phase,
      ),
  );
  return (
    <section
      className="s3-section s3-brief s3-orientation"
      aria-labelledby="s3-brief-title"
      data-testid="screen03-understand-shock"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Brief overview</span>
          <h2 id="s3-brief-title">Understand this shock</h2>
        </div>
        {hostReasoningMode === "full" && onRequestOverviewImprovement && (
          <button
            type="button"
            className="s3-primary"
            disabled={taskActive}
            aria-busy={taskActive || undefined}
            data-testid="screen03-request-overview-improvement"
            onClick={onRequestOverviewImprovement}
          >
            Improve this explanation with ChatGPT
          </button>
        )}
      </div>
      <article
        className="s3-orientation__content"
        aria-labelledby="s3-orientation-event-title"
      >
        <h3 id="s3-orientation-event-title" className="s3-orientation__title">
          {overview.title}
        </h3>
        <p
          className="s3-orientation__summary"
          data-testid="screen03-orientation-summary"
        >
          {overview.summary}
        </p>
        {overview.keyPoints.length > 0 && (
          <section
            className="s3-orientation__points"
            aria-labelledby="s3-orientation-points-title"
          >
            <h4 id="s3-orientation-points-title">{overview.sectionLabel}</h4>
            <ul data-testid="screen03-orientation-key-points">
              {overview.keyPoints.map((point, index) => (
                <li key={`${index}:${point}`}>{point}</li>
              ))}
            </ul>
          </section>
        )}
        {improved && (
          <aside
            className="s3-orientation__host-suggestion"
            aria-labelledby="s3-host-overview-title"
            data-testid="screen03-host-overview-suggestion"
          >
            <span className="s3-eyebrow">
              Validated optional wording · noncanonical
            </span>
            <h4 id="s3-host-overview-title">ChatGPT overview suggestion</h4>
            <p>{improved.summary}</p>
            {improved.keyPoints.length > 0 && (
              <ul>{improved.keyPoints.map((point, index) => (
                <li key={`${index}:${point}`}>{point}</li>
              ))}</ul>
            )}
            {improved.uncertainties.length > 0 && (
              <p>
                <strong>Uncertainties:</strong>{" "}
                {improved.uncertainties.join(" · ")}
              </p>
            )}
            <small>
              Checked against {improved.sourceIds.length} current source
              {improved.sourceIds.length === 1 ? "" : "s"}. This wording does
              not replace the fixed orientation or any verified Event Card fact.
            </small>
          </aside>
        )}
      </article>
    </section>
  );
}
