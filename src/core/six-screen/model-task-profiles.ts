/** Active local inference allowances. These are application settings, not API limits. */
export const MODEL_TASK_PROFILE_VERSION = "shockaudit-local-model-task-profiles-v24" as const;

function profile(inputCeiling: number, outputCeiling: number) {
  return Object.freeze({
    profileVersion: MODEL_TASK_PROFILE_VERSION,
    inputCeiling,
    outputCeiling,
    // Reserve the full admitted input and output allowance. Provider reasoning
    // tokens are included in output tokens, never charged a second time.
    reservationTokens: inputCeiling + outputCeiling,
    ordinaryFixtureHeadroomTarget: 0.25,
  });
}

export const MODEL_TASK_PROFILES = Object.freeze({
  screen1_existing_intelligence: profile(16_000, 16_000),
  screen2_existing_intelligence: profile(32_000, 24_000),
  screen2_source_discovery: profile(8_000, 4_000),
  screen3_design_critique: profile(24_000, 24_000),
  screen4_query_plan: profile(16_000, 16_000),
  screen4_event_interpretation: profile(32_000, 24_000),
  screen5_mechanism_proposal: profile(16_000, 24_000),
  screen5_evidence_assessment: profile(32_000, 32_000),
  screen6_challenge_plan: profile(48_000, 32_000),
});

export type ModelTaskId = keyof typeof MODEL_TASK_PROFILES;
export function modelTaskProfile<T extends ModelTaskId>(taskId: T) {
  return MODEL_TASK_PROFILES[taskId];
}

export const LOCAL_MODEL_ALLOWANCE_POLICY_VERSION =
  "shockaudit-local-model-allowance-v24" as const;
export const LOCAL_MODEL_ALLOWANCE_DEFAULTS = Object.freeze({
  maximumTokens: 2_000_000,
  maximumDispatchedAttempts: 80,
});

/** Numeric compatibility for older readiness contracts, refreshed on every
 * read. This is not a cumulative quota for local ShockAudit. */
export const LOCAL_MODEL_USAGE_ADMISSION_HEADROOM = Object.freeze({
  maximumTokens: 20_000_000,
  maximumDispatchedAttempts: 800,
});

/** Historical renewal values retained for saved receipts and older clients. */
export const LOCAL_MODEL_ALLOWANCE_WINDOWS = Object.freeze({
  standard: LOCAL_MODEL_ALLOWANCE_DEFAULTS,
  extended: Object.freeze({
    maximumTokens: 20_000_000,
    maximumDispatchedAttempts: 800,
  }),
  reviewer: LOCAL_MODEL_USAGE_ADMISSION_HEADROOM,
});
export type LocalModelAllowanceWindow = keyof typeof LOCAL_MODEL_ALLOWANCE_WINDOWS;

export function localModelAllowanceBlocker(
  allowance: { remainingAttempts: number; remainingTokens: number },
  requiredTokens: number,
) {
  return `ShockAudit's model usage guard has ${allowance.remainingAttempts.toLocaleString()} attempts and ${allowance.remainingTokens.toLocaleString()} tokens available. This assessment needs one attempt and room for up to ${requiredTokens.toLocaleString()} tokens. Please retry after earlier requests finish; contact the operator if this persists.`;
}

/**
 * Absolute storage guard for explicitly renewed local-preview allowances.
 * Each owner-approved renewal grants one fresh DEFAULTS-sized window while
 * keeping prior usage and unknown holds in the audit ledger. This guard is
 * deliberately much larger than a single window, but still bounds malformed
 * policy history and never represents an OpenAI account or billing limit.
 */
export const LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING = Object.freeze({
  maximumTokens: 100_000_000,
  maximumDispatchedAttempts: 4_000,
});
