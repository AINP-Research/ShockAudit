import {
  restoreScreen03VerificationState,
  type Screen03Action,
  type Screen03VerificationState,
} from "./screen03-workflow";
import {
  restoreScreen03SealedResult,
  type Screen03SealedResult,
} from "./screen03-sealed-result";

export const SCREEN_03_WORKFLOW_OPEN_TOOL_V030 =
  "open_screen03_workflow_v030" as const;
export const SCREEN_03_WORKFLOW_MUTATE_TOOL_V030 =
  "mutate_screen03_workflow_v030" as const;
export const SCREEN_03_WORKFLOW_OPEN_SCHEMA_VERSION =
  "screen-03-workflow-open-v1" as const;
export const SCREEN_03_WORKFLOW_MUTATION_SCHEMA_VERSION =
  "screen-03-workflow-mutation-v1" as const;
export const SCREEN_03_WORKFLOW_RESULT_SCHEMA_VERSION =
  "screen-03-workflow-result-v1" as const;

export type Screen03ClientAction =
  | Omit<Extract<Screen03Action, { type: "review-field" }>, "at">
  | Omit<Extract<Screen03Action, { type: "review-all-fields" }>, "at">
  | Omit<Extract<Screen03Action, { type: "select-focal-clock" }>, "at">
  | Omit<Extract<Screen03Action, { type: "resolve-contradiction" }>, "at">
  | Omit<Extract<Screen03Action, { type: "mark-source-changed" }>, "at">
  | Omit<Extract<Screen03Action, { type: "lock-event-card" }>, "at">;

export type Screen03WorkflowResult = {
  schemaVersion: typeof SCREEN_03_WORKFLOW_RESULT_SCHEMA_VERSION;
  screen: "screen-03";
  ok: boolean;
  outcome: "opened" | "restored" | "replaced" | "applied" | "conflict";
  message: string;
  state: Screen03VerificationState;
};

export type Screen03WorkflowSealedSummary = Omit<
  Screen03WorkflowResult,
  "state"
> & {
  sealedState: Screen03SealedResult;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

const RESPONSE_KEYS = [
  "schemaVersion",
  "screen",
  "ok",
  "outcome",
  "message",
] as const;

function restoreResponse<T>(
  value: unknown,
  payloadKey: "state" | "sealedState",
  restorePayload: (payload: unknown) => T | null,
) {
  if (
    !record(value) ||
    !exact(value, [...RESPONSE_KEYS, payloadKey]) ||
    value.schemaVersion !== SCREEN_03_WORKFLOW_RESULT_SCHEMA_VERSION ||
    value.screen !== "screen-03" ||
    typeof value.ok !== "boolean" ||
    !["opened", "restored", "replaced", "applied", "conflict"].includes(
      String(value.outcome),
    ) ||
    typeof value.message !== "string" ||
    value.message.trim() !== value.message ||
    value.message.length < 1 ||
    value.message.length > 2_000
  ) {
    return null;
  }
  const payload = restorePayload(value[payloadKey]);
  if (!payload || value.ok !== (value.outcome !== "conflict")) return null;
  return {
    schemaVersion: SCREEN_03_WORKFLOW_RESULT_SCHEMA_VERSION,
    screen: "screen-03" as const,
    ok: value.ok,
    outcome: value.outcome as Screen03WorkflowResult["outcome"],
    message: value.message,
    [payloadKey]: payload,
  };
}

export function restoreScreen03WorkflowResult(
  value: unknown,
): Screen03WorkflowResult | null {
  return restoreResponse(
    value,
    "state",
    restoreScreen03VerificationState,
  ) as Screen03WorkflowResult | null;
}

export function restoreScreen03WorkflowSealedSummary(
  value: unknown,
): Screen03WorkflowSealedSummary | null {
  return restoreResponse(
    value,
    "sealedState",
    restoreScreen03SealedResult,
  ) as Screen03WorkflowSealedSummary | null;
}
