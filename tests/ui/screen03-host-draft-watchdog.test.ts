import { afterEach, describe, expect, it, vi } from "vitest";

const browserEnvironment = vi.hoisted(() => {
  const browserWindow: Record<string, unknown> = { openai: {} };
  browserWindow.parent = browserWindow;
  (globalThis as unknown as { window: Record<string, unknown> }).window =
    browserWindow;
  return browserWindow;
});

import type { Screen03VerificationState } from "../../src/core/screen03-workflow";
import {
  createScreen03HostDraftWatchdog,
  screen03HostDraftStateIsFresh,
  type Screen03HostDraftFreshnessBaseline,
} from "../../src/ui/App";

void browserEnvironment;

afterEach(() => {
  vi.useRealTimers();
});

describe("Screen 3 host-draft reconciliation", () => {
  it("polls canonical state until a missed host notification is reconciled", async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onUnavailable = vi.fn();
    const watchdog = createScreen03HostDraftWatchdog({
      reconcile,
      onUnavailable,
      timeoutMs: 120_000,
      pollIntervalMs: 2_500,
    });

    watchdog.startPolling();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(onUnavailable).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("performs one final canonical read at the absolute deadline", async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn().mockResolvedValue(false);
    const onUnavailable = vi.fn();
    const watchdog = createScreen03HostDraftWatchdog({
      reconcile,
      onUnavailable,
      timeoutMs: 100,
      pollIntervalMs: 40,
    });

    watchdog.startPolling();
    await vi.advanceTimersByTimeAsync(100);

    expect(reconcile).toHaveBeenCalledTimes(3);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcile).toHaveBeenCalledTimes(3);
  });

  it("starts the deadline before task preparation and can be stopped on invalidation", async () => {
    vi.useFakeTimers();
    const timedOutReconcile = vi.fn().mockResolvedValue(false);
    const timedOutUnavailable = vi.fn();
    createScreen03HostDraftWatchdog({
      reconcile: timedOutReconcile,
      onUnavailable: timedOutUnavailable,
      timeoutMs: 100,
      pollIntervalMs: 25,
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(timedOutReconcile).toHaveBeenCalledTimes(1);
    expect(timedOutUnavailable).toHaveBeenCalledTimes(1);

    const stoppedReconcile = vi.fn().mockResolvedValue(false);
    const stoppedUnavailable = vi.fn();
    const stopped = createScreen03HostDraftWatchdog({
      reconcile: stoppedReconcile,
      onUnavailable: stoppedUnavailable,
      timeoutMs: 100,
      pollIntervalMs: 25,
    });
    stopped.startPolling();
    stopped.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(stoppedReconcile).not.toHaveBeenCalled();
    expect(stoppedUnavailable).not.toHaveBeenCalled();
  });

  it("does not schedule another poll when stopped during an in-flight reconciliation", async () => {
    vi.useFakeTimers();
    let resolveReconcile!: (value: boolean) => void;
    const reconcile = vi.fn(() =>
      new Promise<boolean>((resolve) => {
        resolveReconcile = resolve;
      })
    );
    const onUnavailable = vi.fn();
    const watchdog = createScreen03HostDraftWatchdog({
      reconcile,
      onUnavailable,
      timeoutMs: 100,
      pollIntervalMs: 25,
    });

    watchdog.startPolling();
    await vi.advanceTimersByTimeAsync(25);
    expect(reconcile).toHaveBeenCalledTimes(1);

    watchdog.stop();
    resolveReconcile(false);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("cannot remain pending when a canonical reconciliation read never settles", async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn(() => new Promise<boolean>(() => undefined));
    const onUnavailable = vi.fn();
    const watchdog = createScreen03HostDraftWatchdog({
      reconcile,
      onUnavailable,
      timeoutMs: 100,
      pollIntervalMs: 25,
      reconcileTimeoutMs: 20,
    });

    watchdog.startPolling();
    await vi.advanceTimersByTimeAsync(160);

    expect(reconcile).toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("accepts only a newer host integration for the exact Screen 2 parent", () => {
    const baseline: Screen03HostDraftFreshnessBaseline = {
      runId: "screen02-run",
      handoffFingerprint: "fnv1a64:handoff",
      revision: 3,
      stateFingerprint: "fnv1a64:before",
      hostIntegrationEventIds: ["screen03-history:3:host-interpretation-integrated"],
    };
    const candidate = {
      runId: baseline.runId,
      revision: 4,
      upstream: { handoffFingerprint: baseline.handoffFingerprint },
      integrity: { stateFingerprint: "fnv1a64:after" },
      interpretation: { origin: "chatgpt-host" },
      history: [{
        id: "screen03-history:3:host-interpretation-integrated",
        action: "host-interpretation-integrated",
      }],
    } as Screen03VerificationState;

    expect(screen03HostDraftStateIsFresh(candidate, baseline)).toBe(false);

    const fresh = {
      ...candidate,
      history: [
        ...candidate.history,
        {
          id: "screen03-history:4:host-interpretation-integrated",
          action: "host-interpretation-integrated" as const,
        },
      ],
    } as Screen03VerificationState;
    expect(screen03HostDraftStateIsFresh(fresh, baseline)).toBe(true);
    expect(screen03HostDraftStateIsFresh({
      ...fresh,
      upstream: { ...fresh.upstream, handoffFingerprint: "fnv1a64:other" },
    }, baseline)).toBe(false);
    expect(screen03HostDraftStateIsFresh({
      ...fresh,
      revision: baseline.revision,
    }, baseline)).toBe(false);
  });
});
