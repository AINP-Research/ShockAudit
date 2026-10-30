function deterministicJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => deterministicJson(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${deterministicJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Value is not deterministic JSON.");
}

export function fingerprintScreen03VerifierState(state) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(deterministicJson(state))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function screen03RefreshDecisionIsCurrent(state, reviewedProposalId) {
  const latestHistory = state.history?.at(-1);
  if (latestHistory?.action !== "research-refreshed") return false;
  const proposals = [
    ...(state.proposals?.identity ?? []),
    ...(state.proposals?.overview ?? []),
    ...(state.proposals?.timeline ?? []),
    ...(state.proposals?.component ?? []),
    ...(state.proposals?.eligibility ?? []),
    ...(state.proposals?.amendment ?? []),
  ];
  const proposal = proposals.find((item) => item.id === reviewedProposalId);
  if (!proposal) return true;
  const proposalWasAffected = (state.sourceChanges ?? []).some(
    (record) =>
      record.historyEventId === latestHistory.id &&
      record.reopenedProposalIds?.includes(reviewedProposalId),
  );
  const decisionPreserved =
    proposal.reviewStatus === "accepted" ||
    proposal.reviewStatus === "edited";
  return proposalWasAffected ? !decisionPreserved : true;
}
