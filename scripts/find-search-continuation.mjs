export const FIND_SEARCH_MAX_TOOL_CALLS = 16;

function continuationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function driveFindSearchToTerminal({
  current,
  readState,
  continueSearch,
  initialToolCallCount = 1,
  maximumToolCalls = FIND_SEARCH_MAX_TOOL_CALLS,
  label = "Find search",
}) {
  if (
    typeof readState !== "function" ||
    typeof continueSearch !== "function" ||
    !Number.isSafeInteger(initialToolCallCount) ||
    initialToolCallCount < 0 ||
    !Number.isSafeInteger(maximumToolCalls) ||
    maximumToolCalls < 1 ||
    initialToolCallCount > maximumToolCalls
  ) {
    throw continuationError(
      `${label} received an invalid client continuation contract.`,
      "find-search-continuation-contract-invalid",
    );
  }

  let latest = current;
  let completedToolCallCount = initialToolCallCount;
  let continuationCalls = 0;
  let discoveryRequestId = null;

  while (true) {
    const state = readState(latest);
    const discovery = state?.mode === "find" &&
        Array.isArray(state.discoveryRequests)
      ? state.discoveryRequests.at(-1)
      : null;
    if (!discovery || typeof discovery.status !== "string") {
      throw continuationError(
        `${label} did not expose its canonical discovery status.`,
        "find-search-continuation-state-invalid",
      );
    }
    if (
      typeof discovery.discoveryRequestId !== "string" ||
      discovery.discoveryRequestId.length === 0
    ) {
      throw continuationError(
        `${label} did not expose its canonical discovery identity.`,
        "find-search-continuation-state-invalid",
      );
    }
    discoveryRequestId ??= discovery.discoveryRequestId;
    if (discovery.discoveryRequestId !== discoveryRequestId) {
      throw continuationError(
        `${label} changed discovery identity during client continuation.`,
        "find-search-continuation-identity-changed",
      );
    }
    if (
      discovery.status === "completed" ||
      discovery.status === "completed-empty"
    ) {
      return {
        current: latest,
        completedToolCallCount,
        continuationCalls,
        discoveryRequestId,
        terminalStatus: discovery.status,
      };
    }
    if (discovery.status !== "searching") {
      const failureCodes = discovery.status === "failed" &&
          Array.isArray(discovery.failureCodes)
        ? discovery.failureCodes.filter((code) =>
            typeof code === "string" &&
            /^[a-z0-9][a-z0-9-]{0,119}$/u.test(code)
          ).slice(0, 20)
        : [];
      const typedFailureCode = failureCodes.find((code) =>
        code.startsWith("continuation-failure-")
      );
      const error = continuationError(
        `${label} ended with unsupported discovery status ${discovery.status}${
          failureCodes.length > 0 ? ` (${failureCodes.join(", ")})` : ""
        }.`,
        typedFailureCode ?? "find-search-continuation-terminal-failed",
      );
      const lifecycle = Array.isArray(discovery.lifecycle)
        ? discovery.lifecycle
        : [];
      const publicFailureMessage = lifecycle.findLast((event) =>
        event && typeof event === "object" && event.status === "failed" &&
        typeof event.note === "string"
      )?.note;
      if (typeof publicFailureMessage === "string") {
        error.publicFailureMessage = publicFailureMessage;
      }
      error.failureCodes = failureCodes;
      throw error;
    }
    if (completedToolCallCount >= maximumToolCalls) {
      throw continuationError(
        `${label} remained searching after the bounded ${maximumToolCalls}-tool-call client continuation limit.`,
        "find-search-client-continuation-limit",
      );
    }

    continuationCalls += 1;
    completedToolCallCount += 1;
    latest = await continueSearch(latest, {
      continuationIndex: continuationCalls,
      completedToolCallCount,
    });
    if (latest === null || latest === undefined) {
      throw continuationError(
        `${label} returned no result for continuation ${continuationCalls}.`,
        "find-search-continuation-result-missing",
      );
    }
  }
}
