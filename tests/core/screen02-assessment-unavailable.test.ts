import { describe, expect, it } from "vitest";

import {
  restoreScreen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION,
  buildScreen02WorkflowHandoff,
  restoreScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  continueScreen02AuditWithoutAssessment,
  continueScreen02FindWithoutAssessment,
  createScreen02AuditState,
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowValue,
  prepareScreen02AssessmentRequest,
  selectScreen02FindCandidate,
  screen02AuditAssessmentUnavailableContinuationGate,
  screen02AuditContinuationGate,
  screen02FindAssessmentUnavailableContinuationGate,
  screen02FindCandidateGate,
  screen02FindCandidateSelectionGate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  screen02AuditAssessmentPartIds,
  screen02AssessmentUnavailableScreen03Checks,
  screen02FindAssessmentPartIds,
  type Screen02WorkflowState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
  applyScreen02WorkflowAction,
  buildScreen02WorkflowClientSnapshot,
  type Screen02WorkflowAction,
  type Screen02WorkflowActionName,
  type Screen02WorkflowControllerOptions,
} from "../../src/worker/screen02-workflow-controller";
import {
  buildAuditIdentityState,
  buildFindFactsState,
  buildReadyFindState,
  cloneFixture,
  confirmedWorkflowAuditContext,
} from "./screen02-workflow-fixtures";

function exhaustTransport(
  state: Screen02WorkflowState,
  requestId: string,
  times: readonly string[],
) {
  let next = state;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId,
      status: "delivery-rejected",
      at: times[attempt * 2]!,
      actor: "chatgpt-host",
    });
    if (attempt < 2) {
      next = transitionScreen02AssessmentRequest(next, {
        requestId,
        status: "prepared",
        at: times[attempt * 2 + 1]!,
        actor: "fixed-core",
        note: "Retry the same immutable request transport.",
      });
    }
  }
  return next;
}

function findWithRequest() {
  const state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
    jobId: "find-unavailable-job",
    requestId: "find-unavailable-request",
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  return state;
}

function auditWithRequest() {
  const identity = buildAuditIdentityState();
  const state = prepareScreen02AssessmentRequest(identity, {
    jobId: "audit-unavailable-job",
    requestId: "audit-unavailable-request",
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: "2026-08-09T18:10:09.000Z",
  });
  if (state.mode !== "audit") throw new Error("Expected Audit state.");
  return state;
}

function options(
  now: string,
  assessmentServiceAvailable = true,
): Screen02WorkflowControllerOptions {
  let ordinal = 0;
  return {
    now: () => now,
    createId: (kind) => `${kind}-${++ordinal}`,
    signingConfig: assessmentServiceAvailable
      ? {
          keyId: "assessment-unavailable-test-key",
          key: "assessment-unavailable-test-signing-key-32-bytes",
        }
      : null,
  };
}

function action(
  state: Screen02WorkflowState,
  name: Screen02WorkflowActionName,
  payload: Record<string, unknown>,
): Screen02WorkflowAction {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
    operationId: `${name}-operation`,
    runId: state.runId,
    accessToken: "test-access-token",
    expectedRevision: state.revision,
    expectedStateFingerprint: fingerprintScreen02WorkflowState(state),
    action: name,
    payload,
  };
}

function resign<T extends Screen02WorkflowHandoff | Record<string, unknown>>(
  handoff: T,
) {
  const typed = handoff as unknown as Screen02WorkflowHandoff;
  typed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    typed.event,
  );
  typed.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    typed.history,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    typed.integrity;
  typed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...handoff,
    integrity,
  });
  return handoff;
}

describe("fixed fallback and historical assessment-unavailable continuation", () => {
  it("completes a conservative Find assessment when signing is unavailable while preserving historical unavailable handoffs", async () => {
    let unselectedWithoutService = prepareScreen02AssessmentRequest(
      buildFindFactsState(),
      {
        jobId: "find-service-unavailable-job",
        requestId: "find-service-unavailable-request",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T18:00:02.000Z",
      },
    );
    unselectedWithoutService = transitionScreen02AssessmentRequest(
      unselectedWithoutService,
      {
        requestId: "find-service-unavailable-request",
        status: "service-unavailable",
        at: "2026-08-09T18:00:03.000Z",
        actor: "fixed-core",
      },
    );
    if (unselectedWithoutService.mode !== "find") {
      throw new Error("Expected Find state.");
    }
    expect(
      screen02FindCandidateSelectionGate(
        unselectedWithoutService,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(true);
    const selectedWithoutService = await applyScreen02WorkflowAction(
      unselectedWithoutService,
      action(unselectedWithoutService, "find-select", {
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      }),
      options("2026-08-09T18:00:04.000Z", false),
    );
    if (selectedWithoutService.state.mode !== "find") {
      throw new Error("Expected Find state.");
    }
    expect(
      selectedWithoutService.state.assessmentRequests.find(
        (request) => request.requestId === "find-service-unavailable-request",
      )?.status,
    ).toBe("completed");
    expect(
      selectedWithoutService.state.assessments.find(
        (assessment) =>
          assessment.requestId === "find-service-unavailable-request",
      ),
    ).toMatchObject({
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: {
        category: "plausible",
        explanation: expect.stringContaining(
          "privacy-engineering and compliance work that may redirect research and development",
        ),
      },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    expect(
      screen02FindAssessmentUnavailableContinuationGate(
        selectedWithoutService.state,
      ).eligible,
    ).toBe(false);
    expect(
      screen02FindCandidateGate(
        selectedWithoutService.state,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(true);

    const serviceUnavailable = await applyScreen02WorkflowAction(
      selectedWithoutService.state,
      action(selectedWithoutService.state, "find-continue", {}),
      options("2026-08-09T18:00:05.000Z", false),
    );
    expect(
      serviceUnavailable.state.assessmentRequests.find(
        (request) => request.requestId === "find-service-unavailable-request",
      )?.status,
    ).toBe("completed");
    const currentHandoff = buildScreen02WorkflowHandoff(
      serviceUnavailable.state,
      "0.3.13",
      "2026-08-09T18:00:06.000Z",
    );
    expect(currentHandoff.schemaVersion).toBe(
      SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
    );
    expect(currentHandoff.preliminaryAssessment).toMatchObject({
      completionOrigin: "fixed-fallback",
      judgment: "not-enough-evidence",
    });

    const pending = findWithRequest();
    expect(
      screen02FindCandidateSelectionGate(
        pending,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);
    expect(
      screen02FindAssessmentUnavailableContinuationGate(pending).eligible,
    ).toBe(false);

    const exhausted = exhaustTransport(pending, "find-unavailable-request", [
      "2026-08-09T18:00:04.000Z",
      "2026-08-09T18:00:05.000Z",
      "2026-08-09T18:00:06.000Z",
      "2026-08-09T18:00:07.000Z",
      "2026-08-09T18:00:08.000Z",
    ]);
    if (exhausted.mode !== "find") throw new Error("Expected Find state.");
    expect(
      screen02FindCandidateSelectionGate(
        exhausted,
        "gdpr-candidate-snapshot-v1",
      ),
    ).toEqual({ eligible: true, reasons: [] });
    const selectedExhausted = selectScreen02FindCandidate(
      exhausted,
      "gdpr-candidate-snapshot-v1",
      "find-unavailable-selection",
      "2026-08-09T18:00:09.000Z",
      "Researcher selected the candidate after terminal transport failure.",
    );
    expect(
      screen02FindCandidateGate(
        selectedExhausted,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);
    expect(
      screen02FindAssessmentUnavailableContinuationGate(selectedExhausted),
    ).toEqual({
      eligible: true,
      reasons: [],
      affectedRequestIds: ["find-unavailable-request"],
    });
    const result = await applyScreen02WorkflowAction(
      selectedExhausted,
      action(selectedExhausted, "find-continue-without-assessment", {
        reason: "The host could not deliver the assessment request.",
        acknowledgment:
          "I understand that Screen 3 must perform every mandatory check.",
      }),
      options("2026-08-09T18:00:10.000Z"),
    );
    if (result.state.mode !== "find") throw new Error("Expected Find state.");
    const handoff = buildScreen02WorkflowHandoff(
      result.state,
      "0.2.29",
      "2026-08-09T18:00:11.000Z",
    );
    expect(handoff.schemaVersion).toBe(
      SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION,
    );
    expect(handoff.preliminaryAssessment).toEqual(
      expect.objectContaining({
        status: "unavailable",
        affectedRequestIds: ["find-unavailable-request"],
        mandatoryScreen03Checks: [
          ...screen02AssessmentUnavailableScreen03Checks,
        ],
      }),
    );
    expect(handoff.preliminaryAssessment).not.toHaveProperty("assessmentId");
    expect(handoff.preliminaryAssessment).not.toHaveProperty("judgment");
    expect(handoff.dossierCompletionOrigin).toBeNull();
    expect(handoff.unresolved.questions).toEqual(
      expect.arrayContaining([...screen02AssessmentUnavailableScreen03Checks]),
    );
    expect(restoreScreen02WorkflowHandoff(handoff, result.state)).toEqual(
      handoff,
    );
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      result.state,
      "private-unavailable-snapshot-access-token",
      options("2026-08-09T18:00:11.000Z"),
    );
    expect(snapshot.handoff?.preliminaryAssessment).toMatchObject({
      status: "unavailable",
      affectedRequestIds: ["find-unavailable-request"],
    });
    expect(restoreScreen02WorkflowClientSnapshot(snapshot)).toEqual(snapshot);
  });

  it("restores a historical Find unavailable continuation after a silent host failure and keeps completed handoffs byte-shaped", () => {
    let state: Screen02WorkflowState = findWithRequest();
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "find-unavailable-request",
      status: "message-delivered",
      at: "2026-08-09T18:00:04.000Z",
      actor: "chatgpt-host",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "find-unavailable-request",
      status: "no-tool-submission",
      at: "2026-08-09T18:00:05.000Z",
      actor: "chatgpt-host",
    });
    if (state.mode !== "find") throw new Error("Expected Find state.");
    expect(
      screen02FindCandidateSelectionGate(
        state,
        "gdpr-candidate-snapshot-v1",
      ),
    ).toEqual({ eligible: true, reasons: [] });
    state = selectScreen02FindCandidate(
      state,
      "gdpr-candidate-snapshot-v1",
      "find-first-no-tool-selection",
      "2026-08-09T18:00:06.000Z",
      "Researcher selected the candidate after the no-tool terminal state.",
    );
    expect(
      screen02FindCandidateGate(state, "gdpr-candidate-snapshot-v1").eligible,
    ).toBe(false);
    expect(
      screen02FindAssessmentUnavailableContinuationGate(state),
    ).toEqual({
      eligible: true,
      reasons: [],
      affectedRequestIds: ["find-unavailable-request"],
    });
    const continued = continueScreen02FindWithoutAssessment(
      state,
      "first-no-tool-continuation",
      "2026-08-09T18:00:07.000Z",
      "No tool submission arrived.",
      "Screen 3 must complete every mandatory check.",
    );
    expect(continued.decision.history.at(-1)?.action).toBe(
      "continued-without-assessment",
    );

    const completed = buildScreen02WorkflowHandoff(
      buildReadyFindState(),
      "0.2.29",
      "2026-08-09T18:00:11.000Z",
    );
    expect(completed.schemaVersion).toBe(
      SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
    );
    expect(completed.preliminaryAssessment).not.toHaveProperty("status");
    expect(completed.preliminaryAssessment).toHaveProperty("assessmentId");
  });

  it("restores a historical confirmed-Audit unavailable continuation after a timed-out host assessment", () => {
    let state: Screen02WorkflowState = auditWithRequest();
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "audit-unavailable-request",
      status: "message-delivered",
      at: "2026-08-09T18:10:10.000Z",
      actor: "chatgpt-host",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "audit-unavailable-request",
      status: "timed-out",
      at: "2026-08-09T18:10:11.000Z",
      actor: "chatgpt-host",
    });
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    expect(screen02AuditContinuationGate(state).eligible).toBe(false);
    expect(
      screen02AuditAssessmentUnavailableContinuationGate(state),
    ).toEqual({
      eligible: true,
      reasons: [],
      affectedRequestIds: ["audit-unavailable-request"],
    });
    const continued = continueScreen02AuditWithoutAssessment(
        state,
        "first-timeout-continuation",
        "2026-08-09T18:10:12.000Z",
        "The confirmed-event assessment timed out.",
        "Screen 3 must complete every mandatory check.",
      );
    const continuation = continued.continuationHistory.at(-1);
    expect(continuation && "assessmentDisposition" in continuation).toBe(true);
    if (!continuation || !("assessmentDisposition" in continuation)) {
      throw new Error("Expected an assessment-unavailable Audit continuation.");
    }
    expect(continuation.assessmentDisposition.status).toBe("unavailable");
  });

  it("uses a fixed Audit assessment when signing is unavailable and preserves the historical transport-exhaustion handoff", async () => {
    const unconfirmed = createScreen02AuditState(
      confirmedWorkflowAuditContext(),
      "unconfirmed-audit-run",
      "2026-08-09T18:09:00.000Z",
    );
    expect(() =>
      continueScreen02AuditWithoutAssessment(
        unconfirmed,
        "invalid-unconfirmed-continuation",
        "2026-08-09T18:09:01.000Z",
        "Assessment is unavailable.",
        "I acknowledge the mandatory Screen 3 checks.",
      ),
    ).toThrow(/identity has not been confirmed/i);

    const pending = auditWithRequest();
    const unavailableRefresh = await applyScreen02WorkflowAction(
      pending,
      action(pending, "refresh", {}),
      options("2026-08-09T18:10:09.000Z", false),
    );
    if (unavailableRefresh.state.mode !== "audit") {
      throw new Error("Expected Audit state.");
    }
    expect(
      unavailableRefresh.state.assessmentRequests.find(
        (request) => request.requestId === "audit-unavailable-request",
      )?.status,
    ).toBe("completed");
    expect(unavailableRefresh.state.assessments.at(-1)).toMatchObject({
      requestId: "audit-unavailable-request",
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    expect(
      screen02AuditAssessmentUnavailableContinuationGate(
        unavailableRefresh.state,
      ).eligible,
    ).toBe(false);
    expect(screen02AuditContinuationGate(unavailableRefresh.state).eligible)
      .toBe(true);
    const currentResult = await applyScreen02WorkflowAction(
      unavailableRefresh.state,
      action(unavailableRefresh.state, "audit-continue", {}),
      options("2026-08-09T18:10:10.000Z", false),
    );
    const currentHandoff = buildScreen02WorkflowHandoff(
      currentResult.state,
      "0.3.13",
      "2026-08-09T18:10:11.000Z",
    );
    expect(currentHandoff.preliminaryAssessment).toMatchObject({
      completionOrigin: "fixed-fallback",
      judgment: "not-enough-evidence",
    });

    await expect(
      applyScreen02WorkflowAction(
        pending,
        action(pending, "audit-continue-without-assessment", {
          reason: "The host could not deliver the confirmed-event assessment.",
          acknowledgment:
            "I accept that the preliminary assessment is absent and Screen 3 checks are mandatory.",
        }),
        options("2026-08-09T18:10:10.000Z"),
      ),
    ).rejects.toThrow(/not terminal/i);

    const exhausted = exhaustTransport(pending, "audit-unavailable-request", [
      "2026-08-09T18:10:10.000Z",
      "2026-08-09T18:10:11.000Z",
      "2026-08-09T18:10:12.000Z",
      "2026-08-09T18:10:13.000Z",
      "2026-08-09T18:10:14.000Z",
    ]);
    if (exhausted.mode !== "audit") throw new Error("Expected Audit state.");
    const result = await applyScreen02WorkflowAction(
      exhausted,
      action(exhausted, "audit-continue-without-assessment", {
        reason: "The host could not deliver the confirmed-event assessment.",
        acknowledgment:
          "I accept that the preliminary assessment is absent and Screen 3 checks are mandatory.",
      }),
      options("2026-08-09T18:10:15.000Z"),
    );
    if (result.state.mode !== "audit") throw new Error("Expected Audit state.");
    const handoff = buildScreen02WorkflowHandoff(
      result.state,
      "0.2.29",
      "2026-08-09T18:10:16.000Z",
    );
    expect(handoff.preliminaryAssessment).toMatchObject({
      status: "unavailable",
      affectedRequestIds: ["audit-unavailable-request"],
    });
    expect(handoff.preliminaryAssessment).not.toHaveProperty("assessmentId");
    expect(handoff.dossierCompletionOrigin).toBe(
      "compatibility-model-tool",
    );
    expect(restoreScreen02WorkflowHandoff(handoff, result.state)).toEqual(
      handoff,
    );
  });

  it("requires bounded acknowledgment and source-state-bound exception details", async () => {
    const pending = auditWithRequest();
    const exhausted = exhaustTransport(pending, "audit-unavailable-request", [
      "2026-08-09T18:10:10.000Z",
      "2026-08-09T18:10:11.000Z",
      "2026-08-09T18:10:12.000Z",
      "2026-08-09T18:10:13.000Z",
      "2026-08-09T18:10:14.000Z",
    ]);
    if (exhausted.mode !== "audit") throw new Error("Expected Audit state.");
    await expect(
      applyScreen02WorkflowAction(
        exhausted,
        action(exhausted, "audit-continue-without-assessment", {
          reason: "Assessment delivery was exhausted.",
          acknowledgment: "",
        }),
        options("2026-08-09T18:10:15.000Z"),
      ),
    ).rejects.toThrow(/bounded non-empty string/i);

    const continued = continueScreen02AuditWithoutAssessment(
      exhausted,
      "audit-unavailable-continuation",
      "2026-08-09T18:10:15.000Z",
      "Assessment delivery was exhausted.",
      "I acknowledge that Screen 3 must complete every listed check.",
    );
    const handoff = buildScreen02WorkflowHandoff(
      continued,
      "0.2.29",
      "2026-08-09T18:10:16.000Z",
    );
    const tampered = cloneFixture(handoff);
    if (!("status" in tampered.preliminaryAssessment)) {
      throw new Error("Expected unavailable disposition.");
    }
    tampered.preliminaryAssessment.researcherAcknowledgment =
      "A different acknowledgment.";
    resign(tampered);
    expect(restoreScreen02WorkflowHandoff(tampered, continued)).toBeNull();

    const unavailableUnderV2 = cloneFixture(handoff) as unknown as Record<
      string,
      unknown
    >;
    unavailableUnderV2.schemaVersion =
      SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION;
    delete unavailableUnderV2.dossierCompletionOrigin;
    resign(unavailableUnderV2);
    expect(
      restoreScreen02WorkflowHandoff(unavailableUnderV2, continued),
    ).toBeNull();

    const legacyUnavailable = cloneFixture(handoff) as unknown as Record<
      string,
      unknown
    >;
    legacyUnavailable.schemaVersion =
      SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION;
    delete legacyUnavailable.dossierCompletionOrigin;
    resign(legacyUnavailable);
    expect(
      restoreScreen02WorkflowHandoff(legacyUnavailable, continued),
    ).not.toBeNull();

    const completedState = buildReadyFindState();
    const completedUnderV3 = cloneFixture(
      buildScreen02WorkflowHandoff(
        completedState,
        "0.2.29",
        "2026-08-09T18:10:17.000Z",
      ),
    );
    const completedUnderV3Record = completedUnderV3 as unknown as Record<
      string,
      unknown
    >;
    completedUnderV3Record.schemaVersion =
      SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION;
    delete completedUnderV3Record.dossierCompletionOrigin;
    delete (
      completedUnderV3Record.preliminaryAssessment as Record<string, unknown>
    ).completionOrigin;
    resign(completedUnderV3);
    expect(
      restoreScreen02WorkflowHandoff(completedUnderV3, completedState),
    ).toBeNull();
  });
});
