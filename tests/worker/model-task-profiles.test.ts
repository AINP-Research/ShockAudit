import { describe, expect, it, vi } from "vitest";

import { MODEL_TASK_PROFILES, modelTaskProfile } from
  "../../src/core/six-screen/model-task-profiles";
import { prepareBoundedOpenAIStage, requestBoundedOpenAIStage } from
  "../../src/worker/screen5-openai-provider";

const format = {
  type: "json_schema" as const, name: "bounded_test", strict: true,
  schema: { type: "object", properties: { answer: { type: "string" } },
    required: ["answer"], additionalProperties: false },
};

describe("v23 model task profiles and full dispatched-envelope admission", () => {
  it("pins separate active profiles and reserves the full input plus output", () => {
    const expected = {
      screen2_source_discovery: [8_000, 4_000],
      screen3_design_critique: [24_000, 24_000],
      screen4_query_plan: [16_000, 16_000],
      screen4_event_interpretation: [32_000, 24_000],
      screen5_mechanism_proposal: [16_000, 24_000],
      screen5_evidence_assessment: [32_000, 32_000],
      screen6_challenge_plan: [48_000, 32_000],
    } as const;
    for (const [taskId, [inputCeiling, outputCeiling]] of
      Object.entries(expected)) {
      const profile = modelTaskProfile(taskId as keyof typeof expected);
      expect(profile).toMatchObject({ inputCeiling, outputCeiling,
        reservationTokens: inputCeiling + outputCeiling });
    }
    expect(Object.keys(MODEL_TASK_PROFILES)).toHaveLength(9);
  });

  it("measures the exact serialized body, including instructions, schema and Unicode", () => {
    const prepared = prepareBoundedOpenAIStage({
      taskId: "screen5_evidence_assessment",
      instructions: "Assess X→M→Y within the given study.",
      userData: { x: "Ångström 🚀", note: "A\nB", evidence: ["one", "two"] },
      textFormat: format,
    });
    const body = JSON.parse(prepared.immutableRequestBody) as Record<string, any>;
    expect(prepared.requestByteCount).toBe(new TextEncoder().encode(
      prepared.immutableRequestBody).byteLength);
    expect(prepared.inputEstimate).toBe(
      Math.ceil(prepared.requestByteCount / 3.5) + 256);
    expect(prepared.authorizationMaximum).toBe(64_000);
    expect(body).toMatchObject({ model: "gpt-6-luna",
      reasoning: { effort: "medium" }, store: false, stream: false,
      service_tier: "default", max_output_tokens: 32_000 });
    expect(body.input[0].content[0].text).toContain("Ångström 🚀");
  });

  it("rejects an over-ceiling schema before dispatch while exposing its exact estimate", () => {
    const input = { taskId: "screen5_mechanism_proposal" as const,
      instructions: "Bounded prompt", userData: { x: "X" },
      textFormat: { ...format, schema: { ...format.schema,
        description: "Q".repeat(70_000) } },
    };
    const measured = prepareBoundedOpenAIStage({ ...input, admit: false });
    expect(measured.inputEstimate).toBeGreaterThan(measured.inputCeiling);
    expect(() => prepareBoundedOpenAIStage(input)).toThrow(
      /request estimate .* exceeds its 16000-token input ceiling/u);
  });

  it("does not fetch if the durable dispatch marker cannot be saved", async () => {
    const fetch = vi.fn();
    const onDispatch = vi.fn(async () => { throw new Error("store unavailable"); });
    await expect(requestBoundedOpenAIStage({
      taskId: "screen3_design_critique", taskLabel: "Screen 3",
      apiKey: "test-server-key-at-least-sixteen-characters",
      fetch, instructions: "Assess design.", userData: { x: "X" },
      textFormat: format, inputCeiling: 24_000, maxOutputTokens: 24_000,
      now: () => "2026-09-24T00:00:00.000Z", onDispatch,
      validate: (value) => value,
    })).rejects.toMatchObject({ detail: {
      code: "dispatch_marker_failed", dispatched: false,
      networkInvocation: "not_started" },
    });
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
