/** A display projection of saved task facts, not another task state machine. */
export type AnalysisResultDisplayState =
  | "not_started" | "preparing" | "running" | "receipt_saved"
  | "artifact_saved" | "partial" | "complete" | "complete_zero"
  | "failed_before_dispatch" | "provider_rejected" | "outcome_unknown"
  | "stale" | "configuration_unavailable";

export type AnalysisResultFacts = {
  /** Only a validated result bound to the current scientific input counts. */
  currentArtifact: boolean;
  /** A locally validated artifact may still await aggregate/view restoration. */
  savedArtifact?: boolean;
  rawReceipt?: boolean;
  completedItems?: number;
  pendingItems?: number;
  completedWithNoAdditionalItems?: boolean;
  phase?: "not_started" | "preparing" | "running" | "failed" | "completed";
  failure?: "before_dispatch" | "provider_rejected" | "outcome_unknown" | null;
  stale?: boolean;
  configurationAvailable?: boolean;
};

/** Existing task records supply these facts; screens supply their own language. */
export function projectAnalysisResultState(
  facts: AnalysisResultFacts,
): AnalysisResultDisplayState {
  const completed = facts.completedItems ?? 0;
  const pending = facts.pendingItems ?? 0;
  if (facts.currentArtifact) {
    if (pending > 0) return "partial";
    return completed === 0 && facts.completedWithNoAdditionalItems
      ? "complete_zero" : "complete";
  }
  if (completed > 0) return "partial";
  if (facts.savedArtifact) return "artifact_saved";
  if (facts.rawReceipt) return "receipt_saved";
  if (facts.stale) return "stale";
  if (facts.failure === "outcome_unknown") return "outcome_unknown";
  if (facts.failure === "provider_rejected") return "provider_rejected";
  if (facts.failure === "before_dispatch") return "failed_before_dispatch";
  if (facts.phase === "preparing") return "preparing";
  if (facts.phase === "running") return "running";
  if (facts.configurationAvailable === false) return "configuration_unavailable";
  return "not_started";
}
