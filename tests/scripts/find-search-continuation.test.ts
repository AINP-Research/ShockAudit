import { describe, expect, it, vi } from "vitest";

// The operational verifier helper is plain Node ESM rather than TypeScript.
// @ts-expect-error The helper intentionally has no generated types.
import { FIND_SEARCH_MAX_TOOL_CALLS, driveFindSearchToTerminal } from "../../scripts/find-search-continuation.mjs";

function result(
  status: string,
  revision = 0,
  discoveryRequestId = "discovery-1",
) {
  return {
    snapshot: {
      revision,
      state: {
        mode: "find",
        discoveryRequests: [{ discoveryRequestId, status }],
      },
    },
  };
}

describe("Find search verifier continuations", () => {
  it("uses fresh sequential continuation calls until the canonical search is terminal", async () => {
    const pending = result("searching", 1);
    const stillPending = result("searching", 1);
    const completed = result("completed", 2);
    const continueSearch = vi.fn()
      .mockResolvedValueOnce(stillPending)
      .mockResolvedValueOnce(completed);

    const driven = await driveFindSearchToTerminal({
      current: pending,
      readState: (current: ReturnType<typeof result>) =>
        current.snapshot.state,
      continueSearch,
      label: "test search",
    });

    expect(driven).toEqual({
      current: completed,
      completedToolCallCount: 3,
      continuationCalls: 2,
      discoveryRequestId: "discovery-1",
      terminalStatus: "completed",
    });
    expect(continueSearch.mock.calls.map(([, progress]) => progress)).toEqual([
      { continuationIndex: 1, completedToolCallCount: 2 },
      { continuationIndex: 2, completedToolCallCount: 3 },
    ]);
  });

  it("returns an already-terminal result without another tool call", async () => {
    const completed = result("completed-empty", 1);
    const continueSearch = vi.fn();

    await expect(driveFindSearchToTerminal({
      current: completed,
      readState: (current: ReturnType<typeof result>) =>
        current.snapshot.state,
      continueSearch,
    })).resolves.toMatchObject({
      current: completed,
      completedToolCallCount: 1,
      continuationCalls: 0,
      discoveryRequestId: "discovery-1",
      terminalStatus: "completed-empty",
    });
    expect(continueSearch).not.toHaveBeenCalled();
  });

  it("fails closed at the same sixteen-call client bound as the product UI", async () => {
    const pending = result("searching", 1);
    const continueSearch = vi.fn(async () => pending);

    await expect(driveFindSearchToTerminal({
      current: pending,
      readState: (current: ReturnType<typeof result>) =>
        current.snapshot.state,
      continueSearch,
      label: "bounded test search",
    })).rejects.toMatchObject({
      code: "find-search-client-continuation-limit",
      message: expect.stringContaining(`${FIND_SEARCH_MAX_TOOL_CALLS}-tool-call`),
    });
    expect(continueSearch).toHaveBeenCalledTimes(15);
  });

  it("rejects a result without a canonical Find discovery status", async () => {
    await expect(driveFindSearchToTerminal({
      current: { snapshot: { state: { mode: "audit" } } },
      readState: (current: { snapshot: { state: unknown } }) =>
        current.snapshot.state,
      continueSearch: vi.fn(),
    })).rejects.toMatchObject({
      code: "find-search-continuation-state-invalid",
    });
  });

  it("rejects a replaced or failed discovery instead of accepting another terminal result", async () => {
    const replaced = vi.fn(async () =>
      result("completed", 2, "discovery-2")
    );
    await expect(driveFindSearchToTerminal({
      current: result("searching", 1),
      readState: (current: ReturnType<typeof result>) =>
        current.snapshot.state,
      continueSearch: replaced,
    })).rejects.toMatchObject({
      code: "find-search-continuation-identity-changed",
    });

    await expect(driveFindSearchToTerminal({
      current: result("failed", 2),
      readState: (current: ReturnType<typeof result>) =>
        current.snapshot.state,
      continueSearch: vi.fn(),
    })).rejects.toMatchObject({
      code: "find-search-continuation-terminal-failed",
    });
  });
});
