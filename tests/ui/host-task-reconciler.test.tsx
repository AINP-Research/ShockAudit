import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import HostTaskStatusPanel from "../../src/ui/host-task/HostTaskStatusPanel";
import {
  HOST_TASK_ATTEMPT_TIMEOUT_MS,
  HOST_TASK_DEADLINE_MS,
  HOST_TASK_POLL_INTERVAL_MS,
  createHostTaskReconciler,
} from "../../src/ui/host-task/host-task-reconciler";

describe("same-panel host task reconciliation", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the 2.5 second poll interval and 45 second absolute deadline", () => {
    expect(HOST_TASK_POLL_INTERVAL_MS).toBe(2_500);
    expect(HOST_TASK_DEADLINE_MS).toBe(45_000);
    expect(HOST_TASK_ATTEMPT_TIMEOUT_MS).toBe(5_000);
  });

  it("deduplicates an interval read and a manual check", async () => {
    vi.useFakeTimers();
    let finish!: (complete: boolean) => void;
    const reconcile = vi.fn(
      () => new Promise<boolean>((resolve) => { finish = resolve; }),
    );
    const controller = createHostTaskReconciler({
      reconcile,
      onTimeout: vi.fn(),
      onRetry: vi.fn(),
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(HOST_TASK_POLL_INTERVAL_MS);
    const manual = controller.reconcileNow();
    expect(reconcile).toHaveBeenCalledOnce();
    finish(true);
    await expect(manual).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(HOST_TASK_POLL_INTERVAL_MS * 2);
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it("stops at timeout and permits only one explicit retry", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const onRetry = vi.fn();
    const controller = createHostTaskReconciler({
      reconcile: vi.fn(async () => false),
      onTimeout,
      onRetry,
      pollIntervalMs: 5,
      deadlineMs: 20,
    });

    controller.start();
    expect(controller.retry()).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(onTimeout).toHaveBeenCalledOnce();

    controller.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(onTimeout).toHaveBeenCalledOnce();

    expect(controller.retry()).toBe(true);
    expect(controller.retry()).toBe(false);
    expect(onRetry).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(20);
    expect(onTimeout).toHaveBeenCalledTimes(2);
    expect(controller.retry()).toBe(false);
  });

  it("keeps the absolute deadline when a status read never settles", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const reconcile = vi.fn(() => new Promise<boolean>(() => undefined));
    const controller = createHostTaskReconciler({
      reconcile,
      onTimeout,
      onRetry: vi.fn(),
      pollIntervalMs: 5,
      deadlineMs: 20,
      attemptTimeoutMs: 7,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(19);
    expect(onTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(controller.retry()).toBe(true);
  });

  it("bounds a manual status read that never settles", async () => {
    vi.useFakeTimers();
    const controller = createHostTaskReconciler({
      reconcile: vi.fn(() => new Promise<boolean>(() => undefined)),
      onTimeout: vi.fn(),
      onRetry: vi.fn(),
      attemptTimeoutMs: 7,
    });

    const check = controller.reconcileNow();
    await vi.advanceTimersByTimeAsync(6);
    let settled = false;
    void check.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(check).resolves.toBe(false);
  });

  it("ignores a late result after timeout and lets the retry own the next cycle", async () => {
    vi.useFakeTimers();
    let finishFirst!: (complete: boolean) => void;
    const reconcile = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        finishFirst = resolve;
      }))
      .mockResolvedValue(false);
    const onTimeout = vi.fn();
    const onRetry = vi.fn();
    const controller = createHostTaskReconciler({
      reconcile,
      onTimeout,
      onRetry,
      pollIntervalMs: 5,
      deadlineMs: 10,
      attemptTimeoutMs: 20,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(onTimeout).toHaveBeenCalledOnce();

    finishFirst(true);
    await Promise.resolve();
    expect(controller.retry()).toBe(true);
    expect(onRetry).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("invalidates a manual check that is still pending when retry starts", async () => {
    vi.useFakeTimers();
    let finishManual!: (complete: boolean) => void;
    const reconcile = vi.fn()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        finishManual = resolve;
      }))
      .mockResolvedValue(false);
    const controller = createHostTaskReconciler({
      reconcile,
      onTimeout: vi.fn(),
      onRetry: vi.fn(),
      pollIntervalMs: 5,
      deadlineMs: 10,
      attemptTimeoutMs: 20,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(10);
    const manual = controller.reconcileNow();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(2);

    expect(controller.retry()).toBe(true);
    finishManual(true);
    await expect(manual).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(5);
    expect(reconcile).toHaveBeenCalledTimes(3);
  });

  it("renders a polite status and explicit manual/retry actions", () => {
    const html = renderToStaticMarkup(
      <HostTaskStatusPanel
        task={{
          taskId: "review-1",
          phase: "timed-out",
          title: "ChatGPT relevance review",
          message: "The source-backed result is still available.",
          retryCount: 0,
        }}
        onCheck={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Check again");
    expect(html).toContain("Retry once");
  });
});
