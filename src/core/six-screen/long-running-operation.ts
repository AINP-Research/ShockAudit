/**
 * Operations that can cross the host SDK's default one-minute request limit.
 *
 * This registry is deliberately about transport duration, not whether an
 * operation uses a model. Source retrieval and bounded document inspection
 * need the same uncertain-outcome recovery rule as model requests: after a
 * transport interruption the client reads saved status and never resends
 * automatically.
 */
export const SIX_SCREEN_LONG_RUNNING_MUTATION_ACTIONS = [
  "resolve_shock",
  "research_policy",
  "continue_policy_research",
  "open_screen_4",
  "refresh_study_first_events",
  "analyze_study_first_events",
  "continue_coevent_search",
  "acquire_policy_lifecycle_stage_document",
  "personalize_screen3_advice",
  "advance_study_first_mechanism_job",
  "continue_mechanism_literature_search",
  "inspect_scholarly_document",
  "personalize_screen6_plan",
] as const;

export type SixScreenLongRunningMutationAction =
  (typeof SIX_SCREEN_LONG_RUNNING_MUTATION_ACTIONS)[number];

const LONG_RUNNING_MUTATIONS = new Set<string>(
  SIX_SCREEN_LONG_RUNNING_MUTATION_ACTIONS,
);

export function sixScreenMutationAction(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const action = (value as { action?: unknown }).action;
  return typeof action === "string" ? action : null;
}

export function isLongRunningSixScreenMutation(value: unknown): boolean {
  const action = sixScreenMutationAction(value);
  return action !== null && LONG_RUNNING_MUTATIONS.has(action);
}

export function sixScreenMutationTimeoutMs(value: unknown): number {
  return isLongRunningSixScreenMutation(value) ? 360_000 : 60_000;
}
