import { describe, expect, it, vi } from "vitest";

import type { Screen03VerificationState } from "../../src/core/screen03-workflow";
import type { Screen02WorkflowRuntime } from "../../src/worker/screen02-workflow-runtime";
import {
  Screen03WorkflowRuntime,
  screen03HistoricalHostCompatibilityEnabled,
} from "../../src/worker/screen03-workflow-runtime";
import type {
  Screen03WorkflowStore,
  Screen03WorkflowStoreRecord,
} from "../../src/worker/screen03-workflow-store";

const safeRunRef = `s3ref_${"A".repeat(43)}`;
const runId = `s2r_${"B".repeat(43)}`;

function recordFor(
  releaseLabel: "v0.3.14" | "v0.3.15" | "v0.3.16" | "v0.3.17",
) {
  return {
    parentRunId: runId,
    parentGeneration: 1,
    parentRevision: 1,
    handoffProducerAppVersion: "0.3.17",
    expiresAt: "2026-08-22T00:00:00.000Z",
    state: {
      releaseLabel,
      briefing: { safeRunRef },
    } as Screen03VerificationState,
  } as Screen03WorkflowStoreRecord;
}

function runtimeFor(
  record: Screen03WorkflowStoreRecord,
  screen02: object,
) {
  const store = {
    read: vi.fn(async () => ({ outcome: "found" as const, record })),
    readBySafeRunRef: vi.fn(async () => ({
      outcome: "found" as const,
      record,
    })),
  } as unknown as Screen03WorkflowStore;
  return new Screen03WorkflowRuntime({
    store,
    screen02: screen02 as Screen02WorkflowRuntime,
    now: () => "2026-08-21T00:00:00.000Z",
    fetch: vi.fn(),
    hostDraftSigning: {
      current: {
        keyId: "screen03-current-host-path-guard",
        key: "0123456789abcdef0123456789abcdef",
      },
    },
  });
}

describe("Screen 3 historical host-path guard", () => {
  it("recognizes only the two retained historical releases", () => {
    expect(screen03HistoricalHostCompatibilityEnabled({
      releaseLabel: "v0.3.14",
    })).toBe(true);
    expect(screen03HistoricalHostCompatibilityEnabled({
      releaseLabel: "v0.3.15",
    })).toBe(true);
    expect(screen03HistoricalHostCompatibilityEnabled({
      releaseLabel: "v0.3.16",
    })).toBe(false);
    expect(screen03HistoricalHostCompatibilityEnabled({
      releaseLabel: "v0.3.17",
    })).toBe(false);
  });

  it("blocks current draft minting and safe-reference model reads before either path can proceed", async () => {
    const readForScreen03 = vi.fn(async () => ({}));
    const readForScreen03BriefingTrusted = vi.fn(async () => ({}));
    const runtime = runtimeFor(recordFor("v0.3.17"), {
      readForScreen03,
      readForScreen03BriefingTrusted,
    });

    await expect(runtime.prepareHostDraft({
      runId,
      accessToken: `s2a_${"C".repeat(43)}`,
      expectedRevision: 1,
      expectedStateFingerprint: "fnv1a64:0000000000000000",
    })).rejects.toThrow(/unavailable for current workflows/iu);
    await expect(runtime.getBriefingPacket({ safeRunRef })).rejects.toThrow(
      /unavailable for current workflows/iu,
    );
    expect(readForScreen03).toHaveBeenCalledOnce();
    expect(readForScreen03BriefingTrusted).not.toHaveBeenCalled();
  });

  it("leaves the historical safe-reference path reachable for compatibility", async () => {
    const historicalPath = vi.fn(async () => {
      throw new Error("historical-path-reached");
    });
    const runtime = runtimeFor(recordFor("v0.3.15"), {
      readForScreen03BriefingTrusted: historicalPath,
    });

    await expect(runtime.getBriefingPacket({ safeRunRef })).rejects.toThrow(
      "historical-path-reached",
    );
    expect(historicalPath).toHaveBeenCalledOnce();
  });
});
