import "./host-task-status-panel.css";

export type HostTaskPhase =
  | "idle"
  | "starting"
  | "waiting"
  | "applying"
  | "completed"
  | "timed-out"
  | "failed";

export type HostTaskStatus = {
  taskId: string;
  phase: HostTaskPhase;
  title: string;
  message: string;
  requestedAt?: string;
  settledAt?: string;
  route?: "ui/message" | "sendFollowUpMessage" | "unavailable";
  retryCount?: 0 | 1;
};

export type HostTaskStatusPanelProps = {
  task: HostTaskStatus;
  busy?: boolean;
  onCheck: () => void;
  onRetry?: () => void;
};

const terminalPhases = new Set<HostTaskPhase>([
  "completed",
  "timed-out",
  "failed",
]);

export function HostTaskStatusPanel({
  task,
  busy = false,
  onCheck,
  onRetry,
}: HostTaskStatusPanelProps) {
  const terminal = terminalPhases.has(task.phase);
  const retryAvailable =
    Boolean(onRetry) &&
    (task.phase === "timed-out" || task.phase === "failed") &&
    (task.retryCount ?? 0) === 0;

  return (
    <section
      className={`host-task host-task--${task.phase}`}
      aria-labelledby={`host-task-title-${task.taskId}`}
      data-testid="host-task-status-panel"
    >
      <div>
        <h2 id={`host-task-title-${task.taskId}`}>{task.title}</h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          {task.message}
        </p>
      </div>
      <div className="host-task__actions">
        <button
          type="button"
          disabled={busy || task.phase === "starting" || task.phase === "applying"}
          aria-busy={busy || undefined}
          onClick={onCheck}
        >
          {busy ? "Checking…" : terminal ? "Check again" : "Check for result"}
        </button>
        {retryAvailable && (
          <button type="button" disabled={busy} onClick={onRetry}>
            Retry once
          </button>
        )}
      </div>
    </section>
  );
}

export default HostTaskStatusPanel;
