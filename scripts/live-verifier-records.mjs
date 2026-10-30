function sameJsonValue(received, expected) {
  if (Object.is(received, expected)) return true;

  if (Array.isArray(received) || Array.isArray(expected)) {
    return (
      Array.isArray(received) &&
      Array.isArray(expected) &&
      received.length === expected.length &&
      expected.every((value, index) =>
        sameJsonValue(received[index], value),
      )
    );
  }

  if (
    !received ||
    !expected ||
    typeof received !== "object" ||
    typeof expected !== "object"
  ) {
    return false;
  }

  const receivedKeys = Object.keys(received).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    receivedKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) =>
      key === receivedKeys[index] &&
      sameJsonValue(received[key], expected[key]),
    )
  );
}

export function sameRecords(received, expected) {
  return (
    Array.isArray(received) &&
    Array.isArray(expected) &&
    sameJsonValue(received, expected)
  );
}

export function isScreen02FindPlanningRequest(request) {
  return (
    (request?.draftContract?.mode ?? request?.mode) ===
    "find-discovery-plan"
  );
}

export function findConnectorRouteDiagnostics(
  manifest,
  connectorId,
  endpoint,
) {
  const channels = Array.isArray(manifest?.channels)
    ? manifest.channels
    : [];
  const queryMatrix = Array.isArray(manifest?.queryMatrix)
    ? manifest.queryMatrix
    : [];
  return {
    channel: channels.find(
      (entry) =>
        entry?.channel === `${connectorId} diagnostics`,
    ),
    queries: queryMatrix.filter(
      (entry) =>
        typeof entry?.query === "string" &&
        (entry.query === endpoint ||
          entry.query.startsWith(`${endpoint}?`)),
    ),
  };
}

export function connectorRouteCompleted(diagnostics) {
  return (
    diagnostics?.channel?.status === "searched" &&
    Array.isArray(diagnostics?.queries) &&
    diagnostics.queries.length > 0 &&
    diagnostics.queries.every((query) =>
      Array.isArray(query?.returnedRecordIds),
    )
  );
}

export function hasExpectedEvidenceProvider(claims, expectedProvider) {
  return (
    typeof expectedProvider === "string" &&
    expectedProvider.length > 0 &&
    Array.isArray(claims) &&
    claims.some((claim) =>
      claim?.citation?.provider === expectedProvider,
    )
  );
}
