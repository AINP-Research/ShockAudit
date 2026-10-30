import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SCREEN5_OPENAI_ADAPTER_VERSION,
  SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
  SCREEN5_OPENAI_EXECUTION_VERSION,
  SCREEN5_OPENAI_MODEL,
  SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
  SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION,
  PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION,
  createScreen5OpenAIExecution,
  createScreen5OpenAIProviderReceipt,
  validateScreen5MechanismExecution,
  type Screen5MechanismExecution,
} from "../../src/core/six-screen/screen5-mechanism";
import {
  HISTORICAL_SCREEN5_COMPARISON_INPUT_CEILING,
  HISTORICAL_SCREEN5_COMPARISON_OUTPUT_CEILING,
  HISTORICAL_SCREEN5_COMPARISON_PROMPT_VERSION,
  HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
  HISTORICAL_SCREEN5_EXECUTION_VERSION,
  HISTORICAL_SCREEN5_MODEL,
  HISTORICAL_SCREEN5_PILOT_ID,
  HISTORICAL_SCREEN5_PLAN_INPUT_CEILING,
  HISTORICAL_SCREEN5_PLAN_OUTPUT_CEILING,
  HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION,
  HISTORICAL_SCREEN5_PLAN_WIRE_VERSION,
  HISTORICAL_SCREEN5_PROVIDER,
} from "../../src/core/six-screen/screen5-historical-record";

const now = "2026-09-23T09:00:00.000Z";

function executionInput() {
  return {
    id: "screen5-openai-contract-job",
    phase: "planning_queued" as const,
    problemFingerprint: fingerprintSixScreenValue("problem"),
    inputFingerprint: fingerprintSixScreenValue("input"),
    attempts: [],
    budgetSnapshot: null,
    evidencePacket: null,
    comparison: null,
    nextEligibleAt: null,
    retryCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("Screen 5 OpenAI execution compatibility contract", () => {
  it("pins Luna, medium reasoning, Standard processing, no storage, and bounded output", () => {
    const execution = createScreen5OpenAIExecution(executionInput());

    expect(execution).toMatchObject({
      schemaVersion: SCREEN5_OPENAI_EXECUTION_VERSION,
      provider: "openai",
      modelRequested: SCREEN5_OPENAI_MODEL,
      settings: {
        reasoningEffort: "medium",
        includeReasoning: false,
        stream: false,
        serviceTier: "default",
        store: false,
        adapterVersion: SCREEN5_OPENAI_ADAPTER_VERSION,
        planCompletionCeiling: SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
        comparisonCompletionCeiling:
          SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
      },
    });

    for (const settings of [
      { ...execution.settings, reasoningEffort: "high" },
      { ...execution.settings, serviceTier: "priority" },
      { ...execution.settings, store: true },
    ]) {
      expect(() => validateScreen5MechanismExecution({
        ...execution,
        settings: settings as typeof execution.settings,
      })).toThrow(/invalid or changed/iu);
    }
  });

  it("records OpenAI response identity and usage without exposing reasoning text", () => {
    const receipt = createScreen5OpenAIProviderReceipt({
      receivedAt: now,
      httpStatus: 200,
      providerRequestId: "req_contract",
      providerResponseId: "resp_contract",
      serviceTier: "default",
      latencyMs: 1_234,
      modelObserved: "gpt-6-luna-2026-09-01",
      finishReason: "completed",
      usage: {
        promptTokens: 1_000,
        completionTokens: 700,
        totalTokens: 1_700,
        reasoningTokens: 300,
        cachedPromptTokens: 200,
      },
      rateLimit: {
        retryAfterAt: null,
        tokenResetAt: null,
        remainingTokens: null,
      },
      finalContent: '{"synthetic":true}',
    });

    expect(receipt).toMatchObject({
      schemaVersion: SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION,
      providerRequestId: "req_contract",
      providerResponseId: "resp_contract",
      serviceTier: "default",
      latencyMs: 1_234,
      usage: {
        completionTokens: 700,
        reasoningTokens: 300,
        totalTokens: 1_700,
      },
    });
    expect(receipt.usage.totalTokens).toBe(
      receipt.usage.promptTokens + receipt.usage.completionTokens,
    );
    expect(JSON.stringify(receipt)).not.toContain("reasoning text");
  });

  it("retains a maximum bounded Unicode receipt and rejects one byte beyond the private cap", () => {
    const base = {
      receivedAt: now, httpStatus: 200,
      providerRequestId: "req_unicode", providerResponseId: "resp_unicode",
      serviceTier: "default", latencyMs: 1,
      modelObserved: "gpt-6-luna", finishReason: "completed",
      usage: { promptTokens: 3_000, completionTokens: 32_000,
        totalTokens: 35_000, reasoningTokens: 8_000,
        cachedPromptTokens: 0 },
      rateLimit: { retryAfterAt: null, tokenResetAt: null,
        remainingTokens: null },
    } as const;
    const max = "🚀".repeat(128_000);
    expect(new TextEncoder().encode(max).byteLength).toBe(512_000);
    expect(createScreen5OpenAIProviderReceipt({ ...base,
      finalContent: max }).finalContent).toBe(max);
    expect(() => createScreen5OpenAIProviderReceipt({ ...base,
      finalContent: `${max}🚀` })).toThrow(/receipt is invalid/u);
  });

  it("keeps historical Groq executions readable with truthful provenance", () => {
    const body = {
      schemaVersion: HISTORICAL_SCREEN5_EXECUTION_VERSION,
      provider: HISTORICAL_SCREEN5_PROVIDER,
      modelRequested: HISTORICAL_SCREEN5_MODEL,
      pilotId: HISTORICAL_SCREEN5_PILOT_ID,
      planPromptVersion: HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION,
      comparisonPromptVersion: HISTORICAL_SCREEN5_COMPARISON_PROMPT_VERSION,
      planWireVersion: HISTORICAL_SCREEN5_PLAN_WIRE_VERSION,
      comparisonWireVersion: HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
      settings: {
        reasoningEffort: "medium" as const,
        includeReasoning: false as const,
        stream: false as const,
        planInputCeiling: HISTORICAL_SCREEN5_PLAN_INPUT_CEILING,
        planCompletionCeiling: HISTORICAL_SCREEN5_PLAN_OUTPUT_CEILING,
        comparisonInputCeiling: HISTORICAL_SCREEN5_COMPARISON_INPUT_CEILING,
        comparisonCompletionCeiling:
          HISTORICAL_SCREEN5_COMPARISON_OUTPUT_CEILING,
      },
      ...executionInput(),
      id: "historical-groq-job",
    };
    const historical = {
      ...body,
      executionFingerprint: fingerprintSixScreenValue(body),
    } as Screen5MechanismExecution;

    expect(validateScreen5MechanismExecution(historical)).toBe(historical);
    expect(historical).toMatchObject({
      provider: "groq",
      modelRequested: "openai/gpt-oss-120b",
    });
    expect(historical.schemaVersion).not.toBe(SCREEN5_OPENAI_EXECUTION_VERSION);
  });

  it("keeps the v22 OpenAI execution settings attached to saved v3 records", () => {
    const current = createScreen5OpenAIExecution(executionInput());
    const { executionFingerprint: _unused, ...body } = current;
    const earlier = {
      ...body,
      schemaVersion: PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION,
      settings: {
        ...body.settings,
        planInputCeiling: 2_000, planCompletionCeiling: 12_000,
        comparisonInputCeiling: 4_000, comparisonCompletionCeiling: 20_000,
      },
      budgetSnapshot: {
        pilotId: current.pilotId,
        maximumAttempts: 12, maximumTokens: 200_000,
        attemptsReserved: 0, attemptsSettled: 0, attemptsHeld: 0,
        tokensConsumed: 0, tokensHeld: 0, tokensCommitted: 0,
        remainingAttempts: 12, remainingTokens: 200_000,
      },
    } satisfies Omit<Screen5MechanismExecution, "executionFingerprint">;
    expect(validateScreen5MechanismExecution({ ...earlier,
      executionFingerprint: fingerprintSixScreenValue(earlier) }))
      .toMatchObject({ schemaVersion: PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION,
        settings: { planInputCeiling: 2_000 } });
  });
});
