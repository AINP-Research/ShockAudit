import { describe, expect, it } from "vitest";

import { serializeSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES,
  SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES,
  SIX_SCREEN_WORKFLOW_PROBLEM_CODES,
  SIX_SCREEN_WORKFLOW_PROBLEM_DEFAULTS,
  SIX_SCREEN_WORKFLOW_PROBLEM_DIAGNOSTIC_SCOPES,
  SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES,
  SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES,
  SIX_SCREEN_WORKFLOW_PROBLEM_STAGES,
  SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX,
  SixScreenWorkflowProblemError,
  classifySixScreenWorkflowProblem,
  createSixScreenWorkflowProblem,
  decodeSixScreenWorkflowProblemText,
  encodeSixScreenWorkflowProblemText,
  sanitizeSixScreenWorkflowFieldPath,
  type SixScreenWorkflowProblemCode,
} from "../../src/core/six-screen/workflow-problem";

function codedError(code: string | number, message = "private user text") {
  return Object.assign(new Error(message), { code });
}

describe("six-screen structured workflow problem contract", () => {
  it("enumerates every File 03 category, stage, certainty and recovery value", () => {
    expect(SIX_SCREEN_WORKFLOW_PROBLEM_CODES).toEqual([
      "field_validation", "request_contract", "revision_conflict",
      "operation_identity_conflict", "authorization", "core_state_invalid",
      "execution_failure", "persistence_failure", "projection_failure",
      "response_contract", "delivery_failure", "build_incompatible",
      "configuration_unavailable", "source_unavailable", "provider_rejected",
      "external_outcome_unknown", "unclassified",
    ]);
    expect(SIX_SCREEN_WORKFLOW_PROBLEM_STAGES).toEqual([
      "request_validation", "authorization", "revision_check", "execution",
      "commit", "projection", "serialization", "host_delivery",
      "widget_persistence", "render",
    ]);
    expect(SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES).toEqual([
      "correct_fields", "check_status", "guarded_rebase", "retry_local",
      "restore_local_artifact", "reconnect", "update_client",
      "observe_external", "none",
    ]);
    expect(SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES).toEqual([
      "not_committed", "committed", "unknown",
    ]);
    expect(SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES).toEqual([
      "not_dispatched", "dispatched", "unknown",
    ]);
    expect(SIX_SCREEN_WORKFLOW_PROBLEM_DIAGNOSTIC_SCOPES).toEqual([
      "local_only", "persisted_event",
    ]);
    expect(Object.keys(SIX_SCREEN_WORKFLOW_PROBLEM_DEFAULTS).sort()).toEqual(
      [...SIX_SCREEN_WORKFLOW_PROBLEM_CODES].sort(),
    );
  });

  it("strictly round-trips a canonical safe tool-result envelope", () => {
    const problem = createSixScreenWorkflowProblem({
      code: "revision_conflict",
      operationId: "screen3-save-private-id",
      action: "open_screen_3",
      screen: 2,
      expectedRevision: 8,
      actualRevision: 9,
      fieldIssues: [
        { fieldPath: ["study", "outcome"], code: "required" },
        { fieldPath: "study.period.0", code: "too_small" },
      ],
      safeCauseCodes: ["stale_revision", "stale_revision"],
      occurrenceId: "stored-event-private-id",
    });
    expect(problem).toMatchObject({
      code: "revision_conflict",
      stage: "revision_check",
      action: "open_screen_3",
      screen: 2,
      expectedRevision: 8,
      actualRevision: 9,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      diagnosticScope: "persisted_event",
      fieldIssues: [
        { fieldPath: "study.outcome", code: "required" },
        { fieldPath: "study.period.0", code: "too_small" },
      ],
      safeCauseCodes: ["stale_revision"],
    });
    expect(problem.operationReference).toMatch(/^OP-[0-9A-F]{12}$/u);
    expect(problem.occurrenceReference).toMatch(/^EV-[0-9A-F]{12}$/u);
    expect(problem.diagnosticReference).toMatch(/^SA-[0-9A-F]{12}$/u);
    const text = encodeSixScreenWorkflowProblemText(problem);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(
      SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES,
    );
    expect(decodeSixScreenWorkflowProblemText(text)).toEqual(problem);
  });

  it("retains only the reviewed local Screen 3 rebuild diagnostics", () => {
    for (const safeCauseCode of [
      "screen3_rebuild_binding_invalid",
      "source_operation_conflict",
      "source_receipt_unavailable",
    ] as const) {
      const problem = createSixScreenWorkflowProblem({
        code: safeCauseCode === "source_operation_conflict"
          ? "operation_identity_conflict"
          : safeCauseCode === "source_receipt_unavailable"
            ? "external_outcome_unknown"
            : "core_state_invalid",
        action: "rebuild_screen3_guidance",
        operationId: "screen3-local-rebuild",
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        safeCauseCodes: [safeCauseCode, "not_a_reviewed_safe_code"],
      });
      expect(problem.safeCauseCodes).toEqual([safeCauseCode]);
      expect(decodeSixScreenWorkflowProblemText(
        encodeSixScreenWorkflowProblemText(problem),
      )?.safeCauseCodes).toEqual([safeCauseCode]);
    }
  });

  it("keeps the diagnostic reference stable while occurrence identity varies", () => {
    const first = createSixScreenWorkflowProblem({
      code: "delivery_failure", action: "open_screen_3",
      operationId: "logical-operation", occurrenceId: "attempt-one",
    });
    const second = createSixScreenWorkflowProblem({
      code: "delivery_failure", action: "open_screen_3",
      operationId: "logical-operation", occurrenceId: "attempt-two",
    });
    expect(first.diagnosticReference).toBe(second.diagnosticReference);
    expect(first.occurrenceReference).not.toBe(second.occurrenceReference);
  });

  it("round-trips each permitted stage without deriving policy from prose", () => {
    for (const stage of SIX_SCREEN_WORKFLOW_PROBLEM_STAGES) {
      const problem = createSixScreenWorkflowProblem({
        code: "unclassified", stage, action: "open_screen_3",
      });
      expect(decodeSixScreenWorkflowProblemText(
        encodeSixScreenWorkflowProblemText(problem),
      )?.stage).toBe(stage);
    }
  });

  it("rejects extra keys, forged references, noncanonical JSON and oversize", () => {
    const problem = createSixScreenWorkflowProblem({
      code: "request_contract", action: "open_screen_3",
    });
    const extra = { ...problem, rawMessage: "must not be accepted" };
    expect(() => decodeSixScreenWorkflowProblemText(
      SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX +
        serializeSixScreenValue(extra),
    )).toThrow(/invalid contract shape/iu);
    const forged = { ...problem, diagnosticReference: "SA-000000000000" };
    expect(() => decodeSixScreenWorkflowProblemText(
      SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX +
        serializeSixScreenValue(forged),
    )).toThrow(/diagnostic reference/iu);
    const canonical = encodeSixScreenWorkflowProblemText(problem);
    const noncanonical = canonical.replace("{", "{\n");
    expect(() => decodeSixScreenWorkflowProblemText(noncanonical))
      .toThrow(/canonically encoded/iu);
    const oversize = SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX +
      "x".repeat(SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES);
    expect(() => decodeSixScreenWorkflowProblemText(oversize))
      .toThrow(/size limit/iu);
  });

  it("provides a typed Error whose message and tool text are both safe", () => {
    const problem = createSixScreenWorkflowProblem({
      code: "provider_rejected",
      action: "personalize_screen3_advice",
      operationId: "provider-secret-coordinate",
    });
    const error = new SixScreenWorkflowProblemError(problem);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SixScreenWorkflowProblemError");
    expect(error.message).toBe(
      "The provider rejected the request before a validated result was saved.",
    );
    expect(decodeSixScreenWorkflowProblemText(error.toToolResultText()))
      .toEqual(problem);
    expect(classifySixScreenWorkflowProblem(error)).toEqual(problem);
  });

  it.each<[
    string | number, SixScreenWorkflowProblemCode, string, string
  ]>([
    ["FIELD_VALIDATION", "field_validation", "request_validation",
      "correct_fields"],
    ["INVALID_ARGUMENT", "request_contract", "request_validation", "none"],
    ["STALE_REVISION", "revision_conflict", "revision_check",
      "guarded_rebase"],
    ["OPERATION_CONFLICT", "operation_identity_conflict", "revision_check",
      "none"],
    ["UNAUTHORIZED", "authorization", "authorization", "reconnect"],
    ["AUTHORIZATION_FAILED", "authorization", "authorization", "reconnect"],
    ["AUTHORIZATION_EXPIRED", "authorization", "authorization", "reconnect"],
    ["CORE_STATE_INVALID", "core_state_invalid", "request_validation",
      "none"],
    ["EXECUTION_FAILURE", "execution_failure", "execution", "check_status"],
    ["PERSISTENCE_FAILURE", "persistence_failure", "commit", "check_status"],
    ["PROJECTION_FAILURE", "projection_failure", "projection",
      "restore_local_artifact"],
    ["RESPONSE_FINGERPRINT", "response_contract", "serialization",
      "check_status"],
    ["RESPONSE_CONTRACT_VERSION", "build_incompatible", "serialization",
      "update_client"],
    ["CONFIGURATION_UNAVAILABLE", "configuration_unavailable", "execution",
      "none"],
    ["DELIVERY_FAILURE", "delivery_failure", "host_delivery",
      "check_status"],
    ["SOURCE_UNAVAILABLE", "source_unavailable", "execution", "none"],
    ["PROVIDER_REJECTED", "provider_rejected", "execution", "none"],
    ["EXTERNAL_OUTCOME_UNKNOWN", "external_outcome_unknown", "execution",
      "observe_external"],
  ])("classifies machine code %s without inspecting its message",
    (machineCode, code, stage, recovery) => {
      const problem = classifySixScreenWorkflowProblem(codedError(
        machineCode,
        "MCP error fake stale wording sa6a_PRIVATE user research",
      ), { action: "open_screen_3" });
      expect(problem).toMatchObject({ code, stage, recovery });
    });

  it("uses a supported wrapper's nested machine code instead of its fallback", () => {
    const nested = codedError("REVISION_CONFLICT");
    Object.assign(nested, { expectedRevision: 4, currentRevision: 5 });
    const wrapper = codedError("INVALID_ARGUMENT");
    Object.assign(wrapper, { cause: nested });
    expect(classifySixScreenWorkflowProblem(wrapper, {
      action: "open_screen_3",
    })).toMatchObject({
      code: "revision_conflict",
      expectedRevision: 4,
      actualRevision: 5,
      recovery: "guarded_rebase",
      safeCauseCodes: ["invalid_argument", "stale_revision"],
    });
  });

  it("makes conflicting or unsupported machine evidence non-retryable", () => {
    const conflict = codedError("REVISION_CONFLICT");
    Object.assign(conflict, { cause: codedError("UNAUTHORIZED") });
    expect(classifySixScreenWorkflowProblem(conflict)).toMatchObject({
      code: "unclassified",
      recovery: "none",
      safeCauseCodes: expect.arrayContaining(["conflicting_machine_codes"]),
    });
    expect(classifySixScreenWorkflowProblem(codedError("VENDOR_MAGIC")))
      .toMatchObject({
        code: "unclassified",
        recovery: "none",
        safeCauseCodes: ["unsupported_machine_code"],
      });
  });

  it("bounds cyclic causes without losing a useful safe classification", () => {
    const cyclic = codedError("STALE_REVISION", "Bearer secret research text");
    Object.assign(cyclic, { cause: cyclic });
    const problem = classifySixScreenWorkflowProblem(cyclic, {
      action: "open_screen_3",
      operationId: `sa6a_${"S".repeat(43)}`,
    });
    expect(problem).toMatchObject({
      code: "revision_conflict",
      recovery: "none",
      safeCauseCodes: ["cause_cycle", "stale_revision"],
    });
    const encoded = encodeSixScreenWorkflowProblemText(problem!);
    expect(encoded).not.toContain("Bearer");
    expect(encoded).not.toContain("secret research text");
    expect(encoded).not.toContain("sa6a_");
  });

  it("extracts only bounded structural Zod field paths", () => {
    const error = Object.assign(new Error("raw private validation message"), {
      name: "ZodError",
      issues: [
        { path: ["study", "outcome"], code: "invalid_type",
          message: "private outcome" },
        { path: ["study", "bad field value"], code: "custom" },
        { path: ["accessToken"], code: "custom" },
        { path: ["study", "period", 0], code: "too_small" },
      ],
    });
    const problem = classifySixScreenWorkflowProblem(error, {
      action: "open_screen_3",
    });
    expect(problem).toMatchObject({
      code: "request_contract",
      fieldIssues: [
        { fieldPath: "study.outcome", code: "invalid_type" },
        { fieldPath: "study.period.0", code: "too_small" },
      ],
    });
    expect(encodeSixScreenWorkflowProblemText(problem!))
      .not.toContain("private outcome");
    expect(sanitizeSixScreenWorkflowFieldPath("study.outcome")).toBe(
      "study.outcome",
    );
    expect(sanitizeSixScreenWorkflowFieldPath("$.study.period[0]")).toBe(
      "study.period.0",
    );
    expect(sanitizeSixScreenWorkflowFieldPath("study.bad value")).toBeNull();
    expect(sanitizeSixScreenWorkflowFieldPath("accessToken")).toBeNull();
  });

  it("never serializes raw private or user text from an Error", () => {
    const canaries = [
      `sa6a_${"a".repeat(43)}`,
      `sa6r_${"r".repeat(43)}`,
      "Bearer OWNER_PRIVATE_KEY",
      "https://example.test/?api_key=OWNER_PRIVATE_KEY",
      "private study outcome prose",
    ];
    const error = codedError("INVALID_ARGUMENT", canaries.join(" "));
    Object.assign(error, { requestBody: { study: canaries.join(" ") } });
    const problem = classifySixScreenWorkflowProblem(error, {
      action: canaries[0],
      operationId: canaries[1],
      fieldIssues: [
        { fieldPath: "study.private study outcome prose", code: canaries[2] },
      ],
      occurrenceId: canaries[3],
    });
    const encoded = encodeSixScreenWorkflowProblemText(problem!);
    for (const canary of canaries) expect(encoded).not.toContain(canary);
    expect(problem).toMatchObject({ action: "unknown", fieldIssues: [] });
  });

  it("does not classify or rewrite error-looking research text", () => {
    const research =
      "A source says MCP error, INVALID_ARGUMENT, stale revision, and timeout.";
    expect(classifySixScreenWorkflowProblem(research)).toBeNull();
    expect(decodeSixScreenWorkflowProblemText(research)).toBeNull();
    const generic = new Error(
      "Stale six-screen workflow mutation; current revision is 12.",
    );
    expect(classifySixScreenWorkflowProblem(generic)).toMatchObject({
      code: "unclassified",
      recovery: "none",
    });
    expect(generic.message).toContain("Stale six-screen workflow mutation");
  });

  it("uses machine identity, not English wording, for stable classification", () => {
    const first = classifySixScreenWorkflowProblem(codedError(
      "DELIVERY_FAILURE", "response interrupted",
    ), { action: "open_screen_3", operationId: "same-operation" });
    const second = classifySixScreenWorkflowProblem(codedError(
      "DELIVERY_FAILURE", "completely different localized wording",
    ), { action: "open_screen_3", operationId: "same-operation" });
    expect(first).toEqual(second);
  });
});
