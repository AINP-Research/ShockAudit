/**
 * Immutable Screen 5 record identities from releases before the OpenAI-only
 * cleanup. This module is deliberately data-only: it has no credentials,
 * transport, scheduling, authorization, or record-mutation capability.
 *
 * These literals let the application verify and display original research
 * records without rewriting their signed bytes or attributing old output to a
 * different provider.
 */
export const HISTORICAL_SCREEN5_PROVIDER = "groq" as const;
export const HISTORICAL_SCREEN5_MODEL = "openai/gpt-oss-120b" as const;
export type HistoricalScreen5Provider = typeof HISTORICAL_SCREEN5_PROVIDER;
export type HistoricalScreen5Model = typeof HISTORICAL_SCREEN5_MODEL;
export const HISTORICAL_SCREEN5_PILOT_ID =
  "screen5-groq-free-v9-initial" as const;
export const HISTORICAL_SCREEN5_EXECUTION_VERSION =
  "screen-05-groq-execution-v1" as const;
export const HISTORICAL_SCREEN5_EVIDENCE_PACKET_VERSION =
  "screen-05-groq-evidence-packet-v1" as const;
export const HISTORICAL_SCREEN5_COMPARISON_VERSION =
  "screen-05-groq-mechanism-comparison-v3" as const;
export const HISTORICAL_SCREEN5_V2_COMPARISON_VERSION =
  "screen-05-groq-mechanism-comparison-v2" as const;
export const HISTORICAL_SCREEN5_V1_COMPARISON_VERSION =
  "screen-05-groq-mechanism-comparison-v1" as const;
export const HISTORICAL_SCREEN5_PLAN_WIRE_VERSION =
  "groq-mechanism-plan-wire-v2" as const;
export const HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION =
  "groq-mechanism-plan-wire-v1" as const;
export const HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION =
  "groq-mechanism-assessment-batch-wire-v3" as const;
export const HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION =
  "groq-mechanism-assessment-batch-wire-v2" as const;
export const HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION =
  "groq-mechanism-comparison-wire-v1" as const;
export const HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION =
  "shockaudit-screen5-plan-v2" as const;
export const HISTORICAL_SCREEN5_V1_PLAN_PROMPT_VERSION =
  "shockaudit-screen5-plan-v1" as const;
export const HISTORICAL_SCREEN5_COMPARISON_PROMPT_VERSION =
  "shockaudit-screen5-comparison-v3" as const;
export const HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION =
  "shockaudit-screen5-comparison-v2" as const;
export const HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION =
  "shockaudit-screen5-comparison-v1" as const;
export const HISTORICAL_SCREEN5_PROVIDER_RECEIPT_VERSION =
  "screen-05-groq-provider-receipt-v1" as const;
export const HISTORICAL_SCREEN5_JOB_AUTHORIZATION_VERSION =
  "screen-05-groq-job-authorization-v1" as const;
export const HISTORICAL_SCREEN5_ASSESSMENT_BATCH_PLAN_VERSION =
  "screen-05-groq-assessment-batch-plan-v1" as const;

/** The original bounded profile is used only to validate saved provenance. */
export const HISTORICAL_SCREEN5_MAX_ATTEMPTS = 12;
export const HISTORICAL_SCREEN5_MAX_TOKENS = 100_000;
export const HISTORICAL_SCREEN5_PLAN_RESERVED_TOKENS = 3_800;
export const HISTORICAL_SCREEN5_COMPARISON_RESERVED_TOKENS = 7_400;
export const HISTORICAL_SCREEN5_PLAN_INPUT_CEILING = 1_800;
export const HISTORICAL_SCREEN5_COMPARISON_INPUT_CEILING = 3_400;
export const HISTORICAL_SCREEN5_PLAN_OUTPUT_CEILING = 2_000;
export const HISTORICAL_SCREEN5_COMPARISON_OUTPUT_CEILING = 4_000;

export const HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION =
  "screen-05-openai-execution-v2" as const;
export const HISTORICAL_OPENAI_SCREEN5_COMPARISON_VERSION =
  "screen-05-openai-mechanism-comparison-v4" as const;

export function isHistoricalScreen5Provider(
  value: unknown,
): value is HistoricalScreen5Provider {
  return value === HISTORICAL_SCREEN5_PROVIDER;
}

export function isHistoricalOpenAIScreen5ExecutionVersion(
  value: unknown,
): value is typeof HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION {
  return value === HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION;
}

export function isHistoricalScreen5ProviderExecutionVersion(
  value: unknown,
): value is typeof HISTORICAL_SCREEN5_EXECUTION_VERSION {
  return value === HISTORICAL_SCREEN5_EXECUTION_VERSION;
}
