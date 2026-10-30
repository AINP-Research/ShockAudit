import { describe, expect, it } from "vitest";

import type { StudyFirstMechanismRun } from
  "../../src/core/six-screen/study-first-mechanism-comparison";
import type { HostReasoningPublicTaskState } from
  "../../src/ui/host-task/host-task-client";
import {
  screen5EvidenceOperationId,
  screen5ExecutionDiagnostic,
  studyFirstHostResult,
  studyFirstHostTaskIsTerminal,
} from "../../src/ui/six-screen/screen5-execution";
import {
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  SCREEN05_THEORETICAL_PLANNING_TASK,
} from "../../src/worker/study-first-host-intelligence";

const fingerprint = "fnv1a64:0011223344556677";

function planningResult() {
  return {
    schemaVersion: "shockaudit-screen05-theoretical-planning-result-v1",
    intelligenceKind: "theoretical_mechanism_plan",
    origin: "chatgpt-host",
    nonCanonical: true,
    taskInputFingerprint: fingerprint,
    problemFingerprintInspected: fingerprint,
    mechanismInputFingerprintInspected: fingerprint,
    sourcePoolFingerprintInspected: fingerprint,
    conceptualQuestion: "Which process could connect X and Y?",
    relationshipInterpretation: {
      theoreticalChange: "Customer information access changes",
      direction: "decrease",
      outcomeEndpoint: "Firm performance",
      policyToConstructQualification: "The relationship remains proposed.",
      sourceFieldRefs: ["study.policySideConcept", "study.outcome"],
    },
    candidates: [],
    supplementaryAccounts: [],
    evidenceNeeds: [],
    queryIntents: [{
      id: "direct-link",
      intent: "direct_x_y_open_ended",
      conceptGroups: [["customer information"], ["firm performance"]],
      scopeTerms: ["firms"],
      evidenceNeedIds: [],
    }, {
      id: "boundary-search",
      intent: "contrary_or_boundary",
      conceptGroups: [["information access"], ["boundary condition"]],
      scopeTerms: ["organizations"],
      evidenceNeedIds: [],
    }],
    limitations: ["No scholarly source was inspected during Stage A."],
    planFingerprint: fingerprint,
    scientificMutation: "none",
    researcherDecision: "none",
    outcomeValuesInspected: false,
    hostModel: "host_model_not_exposed",
  };
}

function task(
  status: HostReasoningPublicTaskState["status"],
): HostReasoningPublicTaskState {
  return {
    taskId: "task-one",
    taskType: SCREEN05_THEORETICAL_PLANNING_TASK,
    screen: "screen-05",
    runId: "run-one",
    candidatePoolId: null,
    selectedEventId: "screen5-run-one",
    claimGroupId: null,
    status,
    messageChannel: "ui/message",
    messageDeliveryStatus: "accepted",
    createdAt: "2026-09-21T12:00:00.000Z",
    expiresAt: "2026-09-21T12:05:00.000Z",
    retryCount: 0,
    resultId: status === "applied" ? "result-one" : null,
    failureCode: null,
    failureExplanation: null,
    panelReconciliation: {
      status: status === "applied" ? "pending" : "not-ready",
      lastCheckedAt: null,
      reconciledAt: null,
      failureCode: null,
      failureExplanation: null,
    },
    result: status === "applied" ? planningResult() : null,
    outcomeValuesInspected: false,
  };
}

describe("Screen 5 host execution helpers", () => {
  it("dispatches Stage A to its own strict result schema", () => {
    expect(studyFirstHostResult(
      SCREEN05_THEORETICAL_PLANNING_TASK,
      planningResult(),
    )).toMatchObject({ intelligenceKind: "theoretical_mechanism_plan" });
    expect(studyFirstHostResult(
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      planningResult(),
    )).toBeNull();
    expect(studyFirstHostResult(
      SCREEN05_THEORETICAL_PLANNING_TASK,
      { ...planningResult(), outcomeValuesInspected: true },
    )).toBeNull();
    expect(studyFirstHostResult(
      "screen05-unknown-task" as never,
      planningResult(),
    )).toBeNull();
  });

  it("uses a stable continuation operation for an exact applied plan", () => {
    const input = {
      runId: "run-one",
      planningTaskId: "task-one",
      planningResultId: "result-one",
    };
    expect(screen5EvidenceOperationId(input))
      .toBe(screen5EvidenceOperationId(structuredClone(input)));
    expect(screen5EvidenceOperationId({
      ...input,
      planningResultId: "result-two",
    })).not.toBe(screen5EvidenceOperationId(input));
  });

  it("distinguishes pending work from terminal task states", () => {
    expect(studyFirstHostTaskIsTerminal(task("awaiting-submission")))
      .toBe(false);
    expect(studyFirstHostTaskIsTerminal(task("applied"))).toBe(true);
    expect(studyFirstHostTaskIsTerminal(task("validation-failed"))).toBe(true);
  });

  it("creates an allowlisted diagnostic without private coordinates", () => {
    const run = {
      status: "planning_ready",
      planning: { status: "available_via_signed_host_task" },
      hostComparison: { status: "planning_required" },
      works: [],
      attempts: [],
    } as unknown as StudyFirstMechanismRun;
    const planningTask = task("awaiting-submission");
    const diagnostic = screen5ExecutionDiagnostic({
      hostMode: "full",
      run,
      planningTask,
    });
    expect(diagnostic).toMatchObject({
      planningTaskStatus: "awaiting-submission",
      nextAction: "wait_for_planning",
      evidenceWorkCount: 0,
    });
    expect(JSON.stringify(diagnostic)).not.toContain(planningTask.taskId);
    expect(JSON.stringify(diagnostic)).not.toContain(planningTask.runId);
    expect(JSON.stringify(diagnostic)).not.toContain("accessToken");
  });
});
