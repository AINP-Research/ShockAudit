export const HOST_TASK_POLL_INTERVAL_MS = 2_500;
export const HOST_TASK_DEADLINE_MS = 45_000;
export const HOST_TASK_ATTEMPT_TIMEOUT_MS = 5_000;

export type HostTaskReconciler = {
  start: () => void;
  reconcileNow: () => Promise<boolean>;
  retry: () => boolean;
  stop: () => void;
};

export function createHostTaskReconciler(input: {
  reconcile: () => Promise<boolean>;
  onTimeout: () => void;
  onRetry: () => void;
  pollIntervalMs?: number;
  deadlineMs?: number;
  attemptTimeoutMs?: number;
}): HostTaskReconciler {
  const pollIntervalMs = input.pollIntervalMs ?? HOST_TASK_POLL_INTERVAL_MS;
  const deadlineMs = input.deadlineMs ?? HOST_TASK_DEADLINE_MS;
  const attemptTimeoutMs =
    input.attemptTimeoutMs ?? HOST_TASK_ATTEMPT_TIMEOUT_MS;
  let active = true;
  let started = false;
  let initialStartUsed = false;
  let timedOut = false;
  let retryUsed = false;
  let generation = 0;
  let inFlight: {
    generation: number;
    promise: Promise<boolean>;
  } | null = null;
  let pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const clearTimers = () => {
    if (pollTimer !== null) globalThis.clearTimeout(pollTimer);
    if (deadlineTimer !== null) globalThis.clearTimeout(deadlineTimer);
    pollTimer = null;
    deadlineTimer = null;
  };

  const pause = () => {
    started = false;
    generation += 1;
    inFlight = null;
    clearTimers();
  };

  const stop = () => {
    active = false;
    timedOut = false;
    pause();
  };

  const settleWithinAttemptTimeout = (
    operation: Promise<boolean>,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(false);
      }, attemptTimeoutMs);

      operation.then(
        (complete) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timeout);
          resolve(complete);
        },
        () => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timeout);
          resolve(false);
        },
      );
    });

  const reconcileOnce = () => {
    if (!active) return Promise.resolve(false);
    const operationGeneration = generation;
    if (inFlight?.generation === operationGeneration) return inFlight.promise;

    const operation = settleWithinAttemptTimeout(
      Promise.resolve().then(input.reconcile),
    ).then((complete) => (
      active && generation === operationGeneration ? complete : false
    ));
    const tracked = operation.finally(() => {
      if (inFlight?.promise === tracked) inFlight = null;
    });
    inFlight = { generation: operationGeneration, promise: tracked };
    return tracked;
  };

  const schedule = () => {
    if (!active || !started || pollTimer !== null) return;
    const scheduledGeneration = generation;
    pollTimer = globalThis.setTimeout(async () => {
      pollTimer = null;
      if (
        !active ||
        !started ||
        generation !== scheduledGeneration
      ) return;
      if (await reconcileOnce()) {
        stop();
        return;
      }
      schedule();
    }, pollIntervalMs);
  };
  const armDeadline = () => {
    if (!active || !started) return;
    if (deadlineTimer !== null) globalThis.clearTimeout(deadlineTimer);
    const deadlineGeneration = generation;
    deadlineTimer = globalThis.setTimeout(() => {
      deadlineTimer = null;
      if (
        !active ||
        !started ||
        generation !== deadlineGeneration
      ) return;
      pause();
      timedOut = true;
      input.onTimeout();
    }, deadlineMs);
  };

  return {
    start: () => {
      if (!active || started || initialStartUsed) return;
      initialStartUsed = true;
      timedOut = false;
      started = true;
      armDeadline();
      schedule();
    },
    reconcileNow: async () => {
      const complete = await reconcileOnce();
      if (complete) stop();
      return complete;
    },
    retry: () => {
      if (!active || !timedOut || retryUsed || started) return false;
      retryUsed = true;
      timedOut = false;
      pause();
      started = true;
      input.onRetry();
      armDeadline();
      schedule();
      return true;
    },
    stop,
  };
}
