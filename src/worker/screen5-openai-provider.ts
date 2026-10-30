import type { StudyFirstEventContext } from
  "../core/six-screen/study-first-event-investigation";
import { modelTaskProfile, type ModelTaskId } from
  "../core/six-screen/model-task-profiles";
import type {
  StudyFirstMechanismInput,
  StudyFirstMechanismPlan,
  StudyFirstTheoreticalProblem,
} from "../core/six-screen/study-first-mechanism-comparison";
import {
  SCREEN5_OPENAI_COMPARISON_INPUT_CEILING,
  SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
  SCREEN5_OPENAI_MODEL,
  SCREEN5_OPENAI_PLAN_INPUT_CEILING,
  SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
  SCREEN5_OPENAI_REASONING_EFFORT,
  SCREEN5_OPENAI_SERVICE_TIER,
  createScreen5OpenAIProviderReceipt,
  type Screen5MechanismAssessmentBatchPlan,
  type Screen5MechanismComparisonWire,
  type Screen5MechanismEvidencePacket,
  type Screen5MechanismPlanWire,
  type Screen5MechanismProviderReceipt,
  type Screen5MechanismRateLimit,
  type Screen5MechanismUsage,
  type Screen5MechanismValidationIssue,
} from "../core/six-screen/screen5-mechanism";
import {
  SCREEN5_MECHANISM_SUPPORTED_ASSESSMENT_PROMPT,
  SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT,
  SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT,
  Screen5MechanismWireValidationError,
  normalizeScreen5MechanismPlanWire,
  rateLimitFromHeaders,
  screen5MechanismAssessmentResponseFormat,
  screen5MechanismAssessmentUserData,
  screen5MechanismPlanFromWire,
  screen5MechanismPlanningUserData,
  validateScreen5MechanismComparisonWire,
  validateScreen5MechanismPlanWire,
  type Screen5MechanismAssessmentRequestInput,
} from "./screen5-mechanism-contract";
import {
  SCREEN5_OPENAI_RESPONSES_URL,
  SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES,
  Screen5OpenAITransportError,
  type Screen5OpenAIFailureStage,
  type Screen5OpenAIFetch,
  type Screen5OpenAINetworkInvocation,
  type Screen5OpenAIProviderResponseObservation,
} from "./screen5-openai-transport";

export {
  SCREEN5_OPENAI_RESPONSES_URL,
  Screen5MechanismWireValidationError,
  screen5MechanismPlanFromWire as screen5OpenAIPlanFromWire,
  validateScreen5MechanismComparisonWire as validateScreen5OpenAIComparisonWire,
  validateScreen5MechanismPlanWire as validateScreen5OpenAIPlanWire,
};
export type { Screen5OpenAIFetch };

export type Screen5OpenAIProviderResult<T> = {
  wire: T;
  receipt: Screen5MechanismProviderReceipt;
  modelObserved: string;
  providerRequestId: string | null;
  providerResponseId: string;
  serviceTier: "default";
  latencyMs: number;
  finishReason: "completed";
  usage: Screen5MechanismUsage;
  rateLimit: Screen5MechanismRateLimit;
  estimatedInputTokens: number;
};

export type Screen5OpenAIProviderErrorDetail = {
  code: string;
  retryable: boolean;
  outcomeKnown: boolean;
  dispatched: boolean;
  usage: Screen5MechanismUsage | null;
  rateLimit: Screen5MechanismRateLimit | null;
  providerRequestId: string | null;
  providerResponseId: string | null;
  serviceTier: string | null;
  latencyMs: number | null;
  modelObserved: string | null;
  finishReason: string | null;
  failureStage: Screen5OpenAIFailureStage;
  networkInvocation?: Screen5OpenAINetworkInvocation;
  providerResponse?: Screen5OpenAIProviderResponseObservation;
  httpStatus?: number | null;
  safeCause?: string | null;
  validationIssues?: Screen5MechanismValidationIssue[];
  receipt?: Screen5MechanismProviderReceipt | null;
};

export class Screen5OpenAIProviderError extends Error {
  constructor(
    message: string,
    readonly detail: Screen5OpenAIProviderErrorDetail,
  ) {
    super(message);
    this.name = "Screen5OpenAIProviderError";
  }
}

function responsesFormat(format: {
  json_schema: {
    name: string;
    strict: boolean;
    schema: unknown;
  };
}) {
  return {
    type: "json_schema" as const,
    name: format.json_schema.name,
    strict: format.json_schema.strict,
    schema: format.json_schema.schema,
  };
}

export const SCREEN5_OPENAI_PLANNING_TEXT_FORMAT = responsesFormat(
  SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT,
);

export function screen5OpenAIAssessmentTextFormat(input: Parameters<
  typeof screen5MechanismAssessmentResponseFormat
>[0]) {
  return responsesFormat(screen5MechanismAssessmentResponseFormat(input));
}

export function estimateScreen5OpenAIInputTokens(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  // This is an admission estimate, not provider-reported usage. The framing
  // allowance and 3.5-byte divisor intentionally err above typical JSON text.
  return Math.ceil(bytes / 3.5) + 256;
}

export type BoundedOpenAITextFormat = ReturnType<typeof responsesFormat>;

/** The serialized string measured here is the exact body later dispatched. */
export function prepareBoundedOpenAIStage(input: {
  taskId: ModelTaskId;
  instructions: string;
  userData: unknown;
  textFormat: BoundedOpenAITextFormat;
  /** Readiness measurement still returns oversize estimates for safe UI copy. */
  admit?: boolean;
}) {
  const profile = modelTaskProfile(input.taskId);
  const body = requestEnvelope({
    instructions: input.instructions,
    userData: input.userData,
    textFormat: input.textFormat,
    maxOutputTokens: profile.outputCeiling,
  });
  const immutableRequestBody = JSON.stringify(body);
  const requestByteCount = new TextEncoder().encode(immutableRequestBody)
    .byteLength;
  const inputEstimate = estimateScreen5OpenAIInputTokens(body);
  const result = {
    taskType: input.taskId,
    profileVersion: profile.profileVersion,
    immutableRequestBody,
    inputEstimate,
    estimateMethod: "utf8_json_bytes_divided_by_3_5_plus_256" as const,
    inputCeiling: profile.inputCeiling,
    outputCeiling: profile.outputCeiling,
    requestByteCount,
    authorizationMaximum: profile.reservationTokens,
  };
  if (input.admit !== false &&
      requestByteCount > SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES) {
    throw new Screen5OpenAIProviderError(
      `The ${input.taskId} request body (${requestByteCount} bytes) exceeds its ${SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES}-byte transport ceiling.`,
      { code: "request_body_too_large", retryable: false,
        outcomeKnown: true, dispatched: false, usage: null, rateLimit: null,
        providerRequestId: null, providerResponseId: null, serviceTier: null,
        latencyMs: null, modelObserved: null, finishReason: null,
        failureStage: "admission", networkInvocation: "not_started",
        providerResponse: "not_observed" },
    );
  }
  if (input.admit !== false && inputEstimate > profile.inputCeiling) {
    throw new Screen5OpenAIProviderError(
      `The ${input.taskId} request estimate (${inputEstimate}) exceeds its ${profile.inputCeiling}-token input ceiling.`,
      { code: "input_budget_exceeded", retryable: false,
        outcomeKnown: true, dispatched: false, usage: null, rateLimit: null,
        providerRequestId: null, providerResponseId: null, serviceTier: null,
        latencyMs: null, modelObserved: null, finishReason: null,
        failureStage: "admission", networkInvocation: "not_started",
        providerResponse: "not_observed" },
    );
  }
  return Object.freeze(result);
}

function requestEnvelope(input: {
  instructions: string;
  userData: unknown;
  textFormat: ReturnType<typeof responsesFormat>;
  maxOutputTokens: number;
}) {
  return {
    model: SCREEN5_OPENAI_MODEL,
    instructions: input.instructions,
    input: [{
      role: "user" as const,
      content: [{
        type: "input_text" as const,
        text: JSON.stringify(input.userData),
      }],
    }],
    text: { format: input.textFormat },
    reasoning: { effort: SCREEN5_OPENAI_REASONING_EFFORT },
    max_output_tokens: input.maxOutputTokens,
    service_tier: SCREEN5_OPENAI_SERVICE_TIER,
    store: false,
    stream: false,
  };
}

function usageFromResponse(value: unknown): Screen5MechanismUsage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const usage = value as Record<string, unknown>;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const totalTokens = usage.total_tokens;
  if (
    !Number.isSafeInteger(inputTokens) || (inputTokens as number) < 0 ||
    !Number.isSafeInteger(outputTokens) || (outputTokens as number) < 0 ||
    !Number.isSafeInteger(totalTokens) ||
    totalTokens !== (inputTokens as number) + (outputTokens as number)
  ) return null;
  const outputDetails = typeof usage.output_tokens_details === "object" &&
      usage.output_tokens_details !== null &&
      !Array.isArray(usage.output_tokens_details)
    ? usage.output_tokens_details as Record<string, unknown>
    : null;
  const inputDetails = typeof usage.input_tokens_details === "object" &&
      usage.input_tokens_details !== null &&
      !Array.isArray(usage.input_tokens_details)
    ? usage.input_tokens_details as Record<string, unknown>
    : null;
  const reasoningTokens = outputDetails?.reasoning_tokens;
  const cachedTokens = inputDetails?.cached_tokens;
  if (
    reasoningTokens !== undefined &&
      (!Number.isSafeInteger(reasoningTokens) ||
        (reasoningTokens as number) < 0 ||
        (reasoningTokens as number) > (outputTokens as number)) ||
    cachedTokens !== undefined &&
      (!Number.isSafeInteger(cachedTokens) ||
        (cachedTokens as number) < 0 ||
        (cachedTokens as number) > (inputTokens as number))
  ) return null;
  return {
    promptTokens: inputTokens as number,
    completionTokens: outputTokens as number,
    totalTokens: totalTokens as number,
    reasoningTokens: Number.isSafeInteger(reasoningTokens)
      ? reasoningTokens as number
      : null,
    cachedPromptTokens: Number.isSafeInteger(cachedTokens)
      ? cachedTokens as number
      : null,
  };
}

function safeErrorCode(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,80}$/u.test(value)
    ? value
    : null;
}

function providerErrorMetadata(status: number, value: unknown) {
  const root = typeof value === "object" && value !== null &&
      !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const error = typeof root?.error === "object" && root.error !== null &&
      !Array.isArray(root.error)
    ? root.error as Record<string, unknown>
    : null;
  const providerCode = safeErrorCode(error?.code) ??
    safeErrorCode(error?.type);
  const parameter = typeof error?.param === "string" ? error.param : null;
  let code = `provider_http_${status}`;
  if (status === 401) code = "openai_authentication_failed";
  else if (status === 403) code = "openai_model_access_denied";
  else if (status === 404 && providerCode === "model_not_found") {
    code = "openai_model_access_denied";
  } else if (status === 429 && providerCode &&
      /quota|billing|spend|limit_reached/iu.test(providerCode)) {
    code = "openai_quota_or_spend_limit_reached";
  } else if (status === 429) code = "openai_rate_limited";
  else if (status === 400 && (providerCode === "invalid_json_schema" ||
      /(?:text\.format|json_schema|response_format)/iu.test(parameter ?? ""))) {
    code = "openai_schema_rejected";
  }
  const retryable = status === 408 || status === 409 ||
    code === "openai_rate_limited" || status >= 500;
  const suffix = providerCode ? ` (${providerCode})` : "";
  return {
    code,
    retryable,
    message: `OpenAI returned HTTP ${status}${suffix}.`,
  };
}

function exactLunaModel(value: unknown): value is string {
  return value === SCREEN5_OPENAI_MODEL ||
    (typeof value === "string" &&
      /^gpt-6-luna-\d{4}-\d{2}-\d{2}$/u.test(value));
}

function extractCompletedOutput(root: Record<string, unknown>) {
  const output = Array.isArray(root.output) ? root.output : null;
  if (!output) return { kind: "invalid" as const };
  const texts: string[] = [];
  let refusal: string | null = null;
  let unexpectedTool = false;
  for (const item of output) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { kind: "invalid" as const };
    }
    const record = item as Record<string, unknown>;
    if (record.type === "reasoning") continue;
    if (record.type !== "message") {
      if (typeof record.type === "string" &&
          /call|tool|search|computer|mcp/iu.test(record.type)) {
        unexpectedTool = true;
        continue;
      }
      return { kind: "invalid" as const };
    }
    const content = Array.isArray(record.content) ? record.content : null;
    if (!content) return { kind: "invalid" as const };
    for (const part of content) {
      if (typeof part !== "object" || part === null || Array.isArray(part)) {
        return { kind: "invalid" as const };
      }
      const contentPart = part as Record<string, unknown>;
      if (contentPart.type === "output_text" &&
          typeof contentPart.text === "string") {
        texts.push(contentPart.text);
      } else if (contentPart.type === "refusal" &&
          typeof contentPart.refusal === "string") {
        refusal = contentPart.refusal;
      } else {
        return { kind: "invalid" as const };
      }
    }
  }
  if (unexpectedTool) return { kind: "tool" as const };
  if (refusal !== null) return { kind: "refusal" as const };
  if (texts.length !== 1 || !texts[0]) return { kind: "invalid" as const };
  return { kind: "text" as const, text: texts[0] };
}

/** Shared bounded Responses transport. Each screen supplies its own schema and validator. */
export async function requestBoundedOpenAIStage<T>(input: {
  taskLabel?: "Screen 2" | "Screen 3" | "Screen 4" | "Screen 5" |
    "Screen 6";
  taskId?: ModelTaskId;
  apiKey: string;
  fetch: Screen5OpenAIFetch;
  instructions: string;
  userData: unknown;
  textFormat: ReturnType<typeof responsesFormat>;
  maxOutputTokens: number;
  inputCeiling: number;
  now: () => string;
  monotonicNow?: () => number;
  validate: (value: unknown) => T;
  /** Durable marker before the first possible network invocation. */
  onDispatch?: () => Promise<void>;
  onReceipt?: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
}): Promise<Screen5OpenAIProviderResult<T>> {
  if (!/^[^\s=]{16,4096}$/u.test(input.apiKey ?? "")) {
    throw new Screen5OpenAIProviderError(
      "The server-only OpenAI credential is not configured.",
      {
        code: "configuration_required",
        retryable: false,
        outcomeKnown: true,
        dispatched: false,
        usage: null,
        rateLimit: null,
        providerRequestId: null,
        providerResponseId: null,
        serviceTier: null,
        latencyMs: null,
        modelObserved: null,
        finishReason: null,
        failureStage: "local_configuration",
        networkInvocation: "not_started",
        providerResponse: "not_observed",
      },
    );
  }
  const taskId = input.taskId ?? (input.taskLabel === "Screen 3"
    ? "screen3_design_critique"
    : input.taskLabel === "Screen 6" ? "screen6_challenge_plan"
      : input.maxOutputTokens === SCREEN5_OPENAI_PLAN_OUTPUT_CEILING
        ? "screen5_mechanism_proposal" : "screen5_evidence_assessment");
  const profile = modelTaskProfile(taskId);
  if (profile.inputCeiling !== input.inputCeiling ||
      profile.outputCeiling !== input.maxOutputTokens) {
    throw new Screen5OpenAIProviderError(
      `The ${taskId} request does not match its active task profile.`,
      { code: "task_profile_mismatch", retryable: false,
        outcomeKnown: true, dispatched: false, usage: null, rateLimit: null,
        providerRequestId: null, providerResponseId: null, serviceTier: null,
        latencyMs: null, modelObserved: null, finishReason: null,
        failureStage: "admission", networkInvocation: "not_started",
        providerResponse: "not_observed" },
    );
  }
  const prepared = prepareBoundedOpenAIStage({
    taskId, instructions: input.instructions,
    userData: input.userData, textFormat: input.textFormat,
  });
  const estimatedInputTokens = prepared.inputEstimate;
  // Dispatch the exact serialized body measured by preparation.
  const monotonicNow = input.monotonicNow ?? (() => Date.now());
  const startedAt = monotonicNow();
  if (input.onDispatch) {
    try {
      await input.onDispatch();
    } catch {
      throw new Screen5OpenAIProviderError(
        "The request was not sent because dispatch could not be recorded.",
        { code: "dispatch_marker_failed", retryable: false,
          outcomeKnown: true, dispatched: false, usage: null, rateLimit: null,
          providerRequestId: null, providerResponseId: null, serviceTier: null,
          latencyMs: null, modelObserved: null, finishReason: null,
          failureStage: "persistence", networkInvocation: "not_started",
          providerResponse: "not_observed" },
      );
    }
  }
  let response: Response;
  try {
    response = await input.fetch(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: prepared.immutableRequestBody,
    });
  } catch (caught) {
    if (caught instanceof Screen5OpenAITransportError) {
      const dispatched = caught.detail.networkInvocation === "invoked";
      const outcomeKnown = !dispatched ||
        caught.detail.providerResponse === "observed";
      throw new Screen5OpenAIProviderError(caught.message, {
        code: outcomeKnown
          ? `transport_${caught.detail.safeCause}`
          : "provider_outcome_unknown",
        retryable: !outcomeKnown,
        outcomeKnown,
        dispatched,
        usage: null,
        rateLimit: null,
        providerRequestId: null,
        providerResponseId: null,
        serviceTier: null,
        latencyMs: Math.max(0, Math.ceil(monotonicNow() - startedAt)),
        modelObserved: null,
        finishReason: null,
        ...caught.detail,
      });
    }
    throw new Screen5OpenAIProviderError(
      "The OpenAI request ended without a verifiable provider response.",
      {
        code: "provider_outcome_unknown",
        retryable: true,
        outcomeKnown: false,
        dispatched: true,
        usage: null,
        rateLimit: null,
        providerRequestId: null,
        providerResponseId: null,
        serviceTier: null,
        latencyMs: Math.max(0, Math.ceil(monotonicNow() - startedAt)),
        modelObserved: null,
        finishReason: null,
        failureStage: "network",
        networkInvocation: "unknown",
        providerResponse: "not_observed",
        httpStatus: null,
        safeCause: "network_failure",
      },
    );
  }
  const latencyMs = Math.max(0, Math.ceil(monotonicNow() - startedAt));
  const providerRequestId = response.headers.get("x-request-id");
  const rateLimit = rateLimitFromHeaders(response.headers, input.now());
  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    throw new Screen5OpenAIProviderError(
      "The observed OpenAI response body could not be read.",
      {
        code: "provider_response_body_failed",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage: null,
        rateLimit,
        providerRequestId,
        providerResponseId: null,
        serviceTier: null,
        latencyMs,
        modelObserved: null,
        finishReason: null,
        failureStage: "response_body",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "response_body_failed",
      },
    );
  }
  let payload: unknown = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    if (response.ok) {
      throw new Screen5OpenAIProviderError("OpenAI returned non-JSON data.", {
        code: "provider_response_invalid",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage: null,
        rateLimit,
        providerRequestId,
        providerResponseId: null,
        serviceTier: null,
        latencyMs,
        modelObserved: null,
        finishReason: null,
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "non_json_response",
      });
    }
  }
  const root = typeof payload === "object" && payload !== null &&
      !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const usage = usageFromResponse(root?.usage);
  const providerResponseId = typeof root?.id === "string" ? root.id : null;
  const modelObserved = typeof root?.model === "string" ? root.model : null;
  const serviceTier = typeof root?.service_tier === "string"
    ? root.service_tier
    : null;
  const responseStatus = typeof root?.status === "string" ? root.status : null;
  if (!response.ok) {
    const metadata = providerErrorMetadata(response.status, payload);
    throw new Screen5OpenAIProviderError(metadata.message, {
      code: metadata.code,
      retryable: metadata.retryable,
      outcomeKnown: true,
      dispatched: true,
      usage,
      rateLimit,
      providerRequestId,
      providerResponseId,
      serviceTier,
      latencyMs,
      modelObserved,
      finishReason: responseStatus,
      failureStage: "response_headers",
      networkInvocation: "invoked",
      providerResponse: "observed",
      httpStatus: response.status,
      safeCause: "http_error",
    });
  }
  if (!root || !providerResponseId || !exactLunaModel(modelObserved) ||
      serviceTier !== SCREEN5_OPENAI_SERVICE_TIER || !usage) {
    throw new Screen5OpenAIProviderError(
      "OpenAI did not return the required metered Luna Standard response.",
      {
        code: modelObserved && !exactLunaModel(modelObserved)
          ? "provider_model_mismatch"
          : serviceTier && serviceTier !== SCREEN5_OPENAI_SERVICE_TIER
            ? "provider_service_tier_mismatch"
            : !usage
              ? "provider_usage_missing"
              : "provider_response_invalid",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: responseStatus,
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "invalid_response_envelope",
      },
    );
  }
  if (responseStatus !== "completed") {
    const incomplete = typeof root.incomplete_details === "object" &&
        root.incomplete_details !== null &&
        !Array.isArray(root.incomplete_details)
      ? root.incomplete_details as Record<string, unknown>
      : null;
    const reason = safeErrorCode(incomplete?.reason);
    throw new Screen5OpenAIProviderError(
      responseStatus === "incomplete"
        ? "OpenAI ended the response before structured output completed."
        : "OpenAI returned a non-completed response state.",
      {
        code: responseStatus === "incomplete"
          ? `provider_incomplete_${reason ?? "unknown"}`
          : "provider_response_not_completed",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: responseStatus,
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "response_incomplete",
      },
    );
  }
  const output = extractCompletedOutput(root);
  if (output.kind !== "text") {
    const code = output.kind === "refusal"
      ? "provider_refusal"
      : output.kind === "tool"
        ? "unexpected_tool_request"
        : "provider_output_missing";
    throw new Screen5OpenAIProviderError(
      output.kind === "refusal"
        ? `OpenAI refused the structured ${input.taskLabel ?? "Screen 5"} request.`
        : output.kind === "tool"
          ? "OpenAI attempted an unapproved tool request."
          : "OpenAI completed without one structured text output.",
      {
        code,
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: "completed",
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: code,
      },
    );
  }
  let receipt: Screen5MechanismProviderReceipt;
  try {
    receipt = createScreen5OpenAIProviderReceipt({
      receivedAt: input.now(),
      httpStatus: response.status,
      providerRequestId,
      providerResponseId,
      serviceTier,
      latencyMs,
      modelObserved,
      finishReason: "completed",
      usage,
      rateLimit,
      finalContent: output.text,
    });
  } catch {
    throw new Screen5OpenAIProviderError(
      "The completed OpenAI response exceeded the protected receipt contract.",
      {
        code: "provider_receipt_invalid",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: "completed",
        failureStage: "persistence",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "provider_receipt_invalid",
      },
    );
  }
  if (input.onReceipt) {
    try {
      await input.onReceipt(receipt);
    } catch {
      throw new Screen5OpenAIProviderError(
        "The completed OpenAI response could not be durably receipted.",
        {
          code: "receipt_persistence_failed",
          retryable: false,
          outcomeKnown: true,
          dispatched: true,
          usage,
          rateLimit,
          providerRequestId,
          providerResponseId,
          serviceTier,
          latencyMs,
          modelObserved,
          finishReason: "completed",
          failureStage: "persistence",
          networkInvocation: "invoked",
          providerResponse: "observed",
          httpStatus: response.status,
          safeCause: "receipt_persistence_failed",
          receipt,
        },
      );
    }
  }
  if (usage.promptTokens > input.inputCeiling ||
      usage.completionTokens > input.maxOutputTokens) {
    throw new Screen5OpenAIProviderError(
      "Observed OpenAI usage exceeded the approved request profile.",
      {
        code: "observed_budget_exceeded",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: "completed",
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "observed_budget_exceeded",
        receipt,
      },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.text);
  } catch {
    throw new Screen5OpenAIProviderError(
      "OpenAI's completed output did not contain valid JSON.",
      {
        code: "provider_json_invalid",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: "completed",
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "provider_json_invalid",
        validationIssues: [{ code: "invalid_json", path: "$" }],
        receipt,
      },
    );
  }
  try {
    return {
      wire: input.validate(parsed),
      receipt,
      modelObserved,
      providerRequestId,
      providerResponseId,
      serviceTier: SCREEN5_OPENAI_SERVICE_TIER,
      latencyMs,
      finishReason: "completed",
      usage,
      rateLimit,
      estimatedInputTokens,
    };
  } catch (caught) {
    const validationIssues = caught instanceof Screen5MechanismWireValidationError
      ? caught.issues
      : [{ code: "bounded_contract_failed", path: "$" }];
    throw new Screen5OpenAIProviderError(
      `OpenAI's JSON failed the server's bounded ${input.taskLabel ?? "Screen 5"} validation.`,
      {
        code: "provider_schema_invalid",
        retryable: false,
        outcomeKnown: true,
        dispatched: true,
        usage,
        rateLimit,
        providerRequestId,
        providerResponseId,
        serviceTier,
        latencyMs,
        modelObserved,
        finishReason: "completed",
        failureStage: "model_output",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: response.status,
        safeCause: "provider_schema_invalid",
        validationIssues,
        receipt,
      },
    );
  }
}

/** Local replay of a privately saved provider receipt; it makes no API call. */
export function validateSavedOpenAIReceipt<T>(input: {
  receipt: Screen5MechanismProviderReceipt;
  validate: (value: unknown) => T;
}): T {
  const parsed: unknown = JSON.parse(input.receipt.finalContent);
  return input.validate(parsed);
}

export function screen5OpenAIPlanningInputEstimate(input: Parameters<
  typeof screen5MechanismPlanningUserData
>[0]) {
  return prepareBoundedOpenAIStage({
    taskId: "screen5_mechanism_proposal",
    instructions: SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT,
    userData: screen5MechanismPlanningUserData(input),
    textFormat: SCREEN5_OPENAI_PLANNING_TEXT_FORMAT, admit: false,
  }).inputEstimate;
}

export function screen5OpenAIAssessmentInputEstimate(
  input: Screen5MechanismAssessmentRequestInput,
) {
  const textFormat = screen5OpenAIAssessmentTextFormat({
    candidateIds: input.batch.candidateIds,
    includeFocal: input.batch.includeFocal,
    evidenceIds: input.selectedEvidenceIds ?? [],
    rowIds: input.existingRows.map(({ row_id }) => row_id),
    allowedMergeTargets: input.plan.candidates.map(({ id }) => id),
  });
  return prepareBoundedOpenAIStage({
    taskId: "screen5_evidence_assessment",
    instructions: SCREEN5_MECHANISM_SUPPORTED_ASSESSMENT_PROMPT,
    userData: screen5MechanismAssessmentUserData(input),
    textFormat, admit: false,
  }).inputEstimate;
}

function normalizedTerms(value: string) {
  return new Set(value.normalize("NFKC").toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

/** Selects whole inspected passages against the OpenAI request ceiling. */
export function admitScreen5OpenAIAssessmentRequest(
  input: Omit<Screen5MechanismAssessmentRequestInput, "selectedEvidenceIds">,
) {
  const allEvidenceIds = input.evidencePacket.entries.map(({ evidenceId }) =>
    evidenceId);
  const withoutEvidence = screen5OpenAIAssessmentInputEstimate({
    ...input,
    selectedEvidenceIds: [],
    omittedEvidenceIds: allEvidenceIds,
  });
  if (withoutEvidence > SCREEN5_OPENAI_COMPARISON_INPUT_CEILING) {
    return {
      fits: false as const,
      selectedEvidenceIds: [] as string[],
      omittedEvidenceIds: allEvidenceIds,
      estimatedInputTokens: withoutEvidence,
    };
  }
  const candidateText = input.plan.candidates.filter(({ id }) =>
    input.batch.candidateIds.includes(id)).map((candidate) => [
      candidate.conceptLabel,
      ...candidate.processNodes,
      candidate.distinctionFromFocal,
      candidate.condition ?? "",
    ].join(" ")).join(" ");
  const candidateTerms = normalizedTerms(candidateText);
  const covered = new Set((input.evidencePacket.coverageMap ?? []).filter(
    ({ candidateId }) => candidateId !== null &&
      input.batch.candidateIds.includes(candidateId),
  ).flatMap(({ inspectedEvidenceIds }) => inspectedEvidenceIds));
  const ranked = input.evidencePacket.entries.map((entry, index) => {
    const terms = normalizedTerms(`${entry.title} ${entry.inspectedText}`);
    const overlap = [...candidateTerms].filter((term) => terms.has(term)).length;
    return {
      entry,
      index,
      score: (covered.has(entry.evidenceId) ? 10_000 : 0) + overlap,
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const selectedEvidenceIds: string[] = [];
  let estimatedInputTokens = withoutEvidence;
  for (const { entry } of ranked) {
    const proposed = [...selectedEvidenceIds, entry.evidenceId];
    const estimate = screen5OpenAIAssessmentInputEstimate({
      ...input,
      selectedEvidenceIds: proposed,
      omittedEvidenceIds: allEvidenceIds.filter((id) => !proposed.includes(id)),
    });
    if (estimate <= SCREEN5_OPENAI_COMPARISON_INPUT_CEILING) {
      selectedEvidenceIds.push(entry.evidenceId);
      estimatedInputTokens = estimate;
    }
  }
  const selected = new Set(selectedEvidenceIds);
  return {
    fits: true as const,
    selectedEvidenceIds,
    omittedEvidenceIds: allEvidenceIds.filter((id) => !selected.has(id)),
    estimatedInputTokens,
  };
}

export async function requestScreen5OpenAIPlan(input: {
  apiKey: string;
  fetch: Screen5OpenAIFetch;
  context: StudyFirstEventContext;
  mechanismInput: StudyFirstMechanismInput;
  problem: StudyFirstTheoreticalProblem;
  priorPlans?: StudyFirstMechanismPlan[];
  now: () => string;
  monotonicNow?: () => number;
  onDispatch?: () => Promise<void>;
  onReceipt?: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
}) {
  return requestBoundedOpenAIStage({
    taskId: "screen5_mechanism_proposal",
    apiKey: input.apiKey,
    fetch: input.fetch,
    instructions: SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT,
    userData: screen5MechanismPlanningUserData(input),
    textFormat: SCREEN5_OPENAI_PLANNING_TEXT_FORMAT,
    maxOutputTokens: SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
    inputCeiling: SCREEN5_OPENAI_PLAN_INPUT_CEILING,
    now: input.now,
    monotonicNow: input.monotonicNow,
    onDispatch: input.onDispatch,
    onReceipt: input.onReceipt,
    validate: (value) => validateScreen5MechanismPlanWire(
      normalizeScreen5MechanismPlanWire(value, input.problem),
    ),
  });
}

export async function requestScreen5OpenAIAssessment(input: {
  apiKey: string;
  fetch: Screen5OpenAIFetch;
  context: StudyFirstEventContext;
  mechanismInput: StudyFirstMechanismInput;
  problem: StudyFirstTheoreticalProblem;
  plan: StudyFirstMechanismPlan;
  evidencePacket: Screen5MechanismEvidencePacket;
  batch: Screen5MechanismAssessmentBatchPlan["batches"][number];
  existingRows: Screen5MechanismComparisonWire["row_definitions"];
  priorMechanismSignatures: Array<{
    candidate_id: string;
    concept: string;
    chain: string[];
  }>;
  selectedEvidenceIds: string[];
  omittedEvidenceIds?: string[];
  now: () => string;
  monotonicNow?: () => number;
  onDispatch?: () => Promise<void>;
  onReceipt?: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
}) {
  const textFormat = screen5OpenAIAssessmentTextFormat({
    candidateIds: input.batch.candidateIds,
    includeFocal: input.batch.includeFocal,
    evidenceIds: input.selectedEvidenceIds,
    rowIds: input.existingRows.map(({ row_id }) => row_id),
    allowedMergeTargets: input.plan.candidates.map(({ id }) => id),
  });
  return requestBoundedOpenAIStage({
    taskId: "screen5_evidence_assessment",
    apiKey: input.apiKey,
    fetch: input.fetch,
    instructions: SCREEN5_MECHANISM_SUPPORTED_ASSESSMENT_PROMPT,
    userData: screen5MechanismAssessmentUserData(input),
    textFormat,
    maxOutputTokens: SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
    inputCeiling: SCREEN5_OPENAI_COMPARISON_INPUT_CEILING,
    now: input.now,
    monotonicNow: input.monotonicNow,
    onDispatch: input.onDispatch,
    onReceipt: input.onReceipt,
    validate: (value) => validateScreen5MechanismComparisonWire(
      value,
      new Set(input.selectedEvidenceIds),
      {
        candidateIds: input.batch.candidateIds,
        includeFocal: input.batch.includeFocal,
        rowIds: input.existingRows.map(({ row_id }) => row_id),
        allowedMergeTargets: input.plan.candidates.map(({ id }) => id),
      },
    ),
  });
}
