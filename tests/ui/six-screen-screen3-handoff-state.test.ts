import { afterEach, describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import {
  createSixScreenWorkflowProblem,
  SixScreenWorkflowProblemError,
} from "../../src/core/six-screen/workflow-problem";
import type { SixScreenOperationStatus } from
  "../../src/core/six-screen/operation-status";
import { EMPTY_STUDY_DESIGN_CLARIFICATIONS } from
  "../../src/core/six-screen/study-design-advice";
import { normalizeScreen3StudyDraft } from
  "../../src/core/six-screen/screen3-entry-validation";
import {
  SixScreenBridge,
  type Screen3HandoffRecovery,
} from "../../src/ui/six-screen/bridge";
import {
  claimScreen3HandoffAction,
  createScreen3HandoffScientificBinding,
  createScreen3HandoffCheckingTask,
  createScreen3HandoffProblemTask,
  createScreen3HandoffSavingTask,
  obsoleteBoundMutationProblem,
  reconcileScreen3HandoffTaskWithCanonical,
  screen3HandoffRecoveryCompatibility,
  screen3HandoffStagePolicy,
  screen3HandoffStatusPlan,
  screen3StatusReceiptMatchesCurrentState,
  screen3WidgetPersistenceFailurePlan,
  shouldReconcileScreen3HandoffAfterCanonicalAcceptance,
  shouldNavigateAfterScreen3Handoff,
} from "../../src/ui/six-screen/screen3-handoff-state";

const recovery: Screen3HandoffRecovery = {
  schemaVersion: "screen-03-handoff-recovery-v1",
  runId: `sa6r_${"r".repeat(43)}`,
  operationId: "screen3-open-0011223344556677",
  operationKind: "open_screen_3",
  inputFingerprint: "fnv1a64:0011223344556677",
  dependencyFingerprint: "fnv1a64:1122334455667788",
  state: "pending",
};

function status(input: {
  lookup?: "committed" | "unknown_or_expired" | "conflict";
  state?: SixScreenOperationStatus["destination"]["state"];
  displayReady?: boolean;
  localRebuildAvailable?: boolean;
}) {
  return {
    lookup: input.lookup ?? "committed",
    destination: {
      screen: 3,
      state: input.state ?? "current",
      displayReady: input.displayReady ?? true,
      localRebuildAvailable: input.localRebuildAvailable ?? false,
      safeCode: "controlled_status",
    },
  } as Pick<SixScreenOperationStatus, "lookup" | "destination">;
}

function currentStateFixture() {
  const identityFingerprint = "fnv1a64:1111111111111111";
  const study = {
    id: "study-one",
    revision: 3,
    population: "RTOs and ISOs",
    analysisUnit: "Market operator",
    geography: ["United States"],
    industry: ["Electric power"],
    period: { start: "2018", end: "2025" },
    outcome: "Operating margin",
    outcomeMeasure: "margin",
    intendedConstruct: null,
    policySideConcept: "market access rules",
    initialExplanation: null,
    proposedTreatment: "operators after 2020",
    proposedComparison: "operators before 2020",
    resultsPreviouslyInspected: "no" as const,
  };
  const studyFingerprint = fingerprintSixScreenValue({
    id: study.id,
    population: study.population,
    analysisUnit: study.analysisUnit,
    geography: study.geography,
    industry: study.industry,
    period: study.period,
    outcome: study.outcome,
    outcomeMeasure: study.outcomeMeasure,
    policySideConcept: study.policySideConcept,
    initialExplanation: study.initialExplanation,
    proposedTreatment: study.proposedTreatment,
    proposedComparison: study.proposedComparison,
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  });
  return {
    state: {
      confirmedShock: { identityFingerprint },
      identityRevision: 1,
      currentRequestFingerprint: "fnv1a64:aaaaaaaaaaaaaaaa",
      policyReview: null,
      policyEventCardReviews: [],
      artifacts: [],
      study,
      proposedTreatmentTimings: [{
        id: "screen3-timing-one",
        identityFingerprint,
        mode: "year",
        year: 2020,
        milestoneReference: null,
        timingFingerprint: "fnv1a64:2222222222222222",
      }],
      screen3StudyEntryContexts: [{
        id: "screen3-entry-one",
        identityFingerprint,
        studyRevision: study.revision,
        studyFingerprint,
        entryFingerprint: "fnv1a64:3333333333333333",
        clarificationFingerprint: fingerprintSixScreenValue(
          EMPTY_STUDY_DESIGN_CLARIFICATIONS,
        ),
      }],
      studyDesignAdvices: [{
        adviceId: "screen3-advice-one",
        adviceFingerprint: "fnv1a64:4444444444444444",
        clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
        binding: {
          identityFingerprint,
          studyRevision: study.revision,
          studyFingerprint,
          clarificationFingerprint: fingerprintSixScreenValue(
            EMPTY_STUDY_DESIGN_CLARIFICATIONS,
          ),
        },
      }],
    } as unknown as SixScreenWorkflowState,
    receipt: {
      workflowRevision: 9,
      studyRevision: study.revision,
      identityFingerprint,
      timingId: "screen3-timing-one",
      timingFingerprint: "fnv1a64:2222222222222222",
      entryContextId: "screen3-entry-one",
      entryContextFingerprint: "fnv1a64:3333333333333333",
      adviceId: "screen3-advice-one",
      adviceFingerprint: "fnv1a64:4444444444444444",
      evidenceStatus: "partial" as const,
      openedAt: "2026-09-25T20:00:00.000Z",
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Screen 2 to Screen 3 handoff state coordinator", () => {
  it("acknowledges saving synchronously and guards a rapid duplicate click", () => {
    const active = new Set<string>();
    expect(claimScreen3HandoffAction(active, "continue-screen3")).toBe(true);
    expect(claimScreen3HandoffAction(active, "continue-screen3")).toBe(false);
    expect(createScreen3HandoffSavingTask(recovery)).toMatchObject({
      operationId: recovery.operationId,
      state: "pending",
      stage: "saving",
      problem: null,
    });
    expect(createScreen3HandoffSavingTask(recovery).message).toContain(
      "No source search or model request",
    );
  });

  it.each([
    [status({}), "restore_current", "checking", "preserve", true],
    [status({ lookup: "unknown_or_expired", state: "unknown",
      displayReady: false }), "outcome_unknown", "outcome_unknown",
      "persist", false],
    [status({ lookup: "conflict", state: "unavailable",
      displayReady: false }), "operation_conflict", "operation_conflict",
      "persist", false],
    [status({ state: "historical", displayReady: false }),
      "saved_historical", "saved_historical", "clear", false],
    [status({ state: "locally_recoverable", displayReady: false,
      localRebuildAvailable: true }), "local_rebuild_required",
      "local_rebuild_required", "persist", false],
    [status({ state: "unavailable", displayReady: false }),
      "saved_display_unavailable", "saved_display_unavailable", "persist",
      false],
  ] as const)(
    "projects exact compact status %# without authorizing a mutation",
    (input, disposition, stage, persistence, refresh) => {
      expect(screen3HandoffStatusPlan(input)).toMatchObject({
        disposition,
        stage,
        persistence,
        requiresCanonicalRefresh: refresh,
        automaticMutation: "never",
      });
    },
  );

  it("separates terminal states from explicit read/local recovery", () => {
    expect(screen3HandoffStagePolicy("outcome_unknown")).toMatchObject({
      canCheckSavedStatus: true,
      sameInputTerminal: false,
      clearsAfterScientificEdit: true,
      automaticMutation: "never",
    });
    expect(screen3HandoffStagePolicy("local_rebuild_required")).toMatchObject({
      canRestoreLocally: true,
      sameInputTerminal: false,
      clearsAfterScientificEdit: true,
      automaticMutation: "never",
    });
    for (const stage of [
      "saved_historical",
      "saved_display_unavailable",
      "operation_conflict",
      "error",
    ] as const) {
      expect(screen3HandoffStagePolicy(stage)).toMatchObject({
        sameInputTerminal: true,
        clearsAfterScientificEdit: true,
        automaticMutation: "never",
      });
    }
  });

  it("keeps known noncommit retryable but makes uncertain delivery status-only", () => {
    const notCommitted = createSixScreenWorkflowProblem({
      code: "revision_conflict",
      action: "open_screen_3",
      operationId: recovery.operationId,
      screen: 3,
      commitCertainty: "not_committed",
    });
    expect(createScreen3HandoffProblemTask({
      recovery,
      problem: notCommitted,
      problemMessage: "Revision changed.",
    })).toMatchObject({ stage: "error", state: "pending" });

    const uncertain = createSixScreenWorkflowProblem({
      code: "delivery_failure",
      action: "open_screen_3",
      operationId: recovery.operationId,
      screen: 3,
      commitCertainty: "unknown",
    });
    const task = createScreen3HandoffProblemTask({
      recovery,
      problem: uncertain,
      problemMessage: "Delivery stopped.",
    });
    expect(task).toMatchObject({
      stage: "outcome_unknown",
      state: "outcome_unknown",
    });
    expect(task.message).toContain("No automatic resend");
    expect(createScreen3HandoffCheckingTask(task)).toMatchObject({
      stage: "checking",
      operationId: recovery.operationId,
    });
  });

  it("does not steal navigation or overwrite draft intent after late success", () => {
    const unchanged = {
      startingDraftVersion: 4,
      currentDraftVersion: 4,
      startingViewVersion: 7,
      currentViewVersion: 7,
      currentScreen: 2,
    };
    expect(shouldNavigateAfterScreen3Handoff(unchanged)).toBe(true);
    expect(shouldNavigateAfterScreen3Handoff({
      ...unchanged,
      currentDraftVersion: 5,
    })).toBe(false);
    expect(shouldNavigateAfterScreen3Handoff({
      ...unchanged,
      currentViewVersion: 8,
      currentScreen: 4,
    })).toBe(false);
  });

  it("rejects an obsolete operation-bound response as uncertain status work", () => {
    const problem = obsoleteBoundMutationProblem({
      binding: {
        operationId: recovery.operationId,
        operationKind: "open_screen_3",
        requestFingerprint: "fnv1a64:5555555555555555",
      },
      incomingRevision: 8,
      currentRevision: 9,
    });
    expect(problem).toMatchObject({
      code: "delivery_failure",
      action: "open_screen_3",
      screen: 3,
      commitCertainty: "unknown",
      dispatchCertainty: "not_dispatched",
      recovery: "check_status",
      safeCauseCodes: ["response_coordinate_mismatch"],
    });
  });

  it("rechecks current receipt coordinates after the full snapshot arrives", () => {
    const fixture = currentStateFixture();
    const currentStatus = {
      ...status({}),
      receiptValidated: true,
      screen3Receipt: fixture.receipt,
    } as Pick<SixScreenOperationStatus,
      "lookup" | "receiptValidated" | "screen3Receipt" | "destination">;
    expect(screen3StatusReceiptMatchesCurrentState({
      status: currentStatus,
      state: fixture.state,
    })).toBe(true);

    const edited = structuredClone(fixture.state);
    edited.study.outcome = "Employment";
    edited.study.revision += 1;
    expect(screen3StatusReceiptMatchesCurrentState({
      status: currentStatus,
      state: edited,
    })).toBe(false);
  });

  it("reclassifies an incompatible restored terminal marker without a read or resend", () => {
    const fixture = currentStateFixture();
    const payload = {
      study: normalizeScreen3StudyDraft(fixture.state.study),
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
    };
    const scientificBinding = createScreen3HandoffScientificBinding(
      fixture.state,
      payload,
    );
    const task = {
      ...recovery,
      inputFingerprint: fingerprintSixScreenValue(payload),
      scientificBinding,
      state: "saved_display_unavailable" as const,
      stage: "saved_display_unavailable" as const,
      message: "The previous display contract was invalid.",
      problem: null,
    };
    expect(screen3HandoffRecoveryCompatibility({
      recovery: task,
      state: fixture.state,
    })).toBe("compatible");
    expect(reconcileScreen3HandoffTaskWithCanonical({
      task,
      state: fixture.state,
    })).toMatchObject({
      task: { stage: "saved_display_unavailable" },
      persistence: "preserve",
      statusRead: "none",
      automaticMutation: "never",
    });

    const newerScientificInput = structuredClone(fixture.state);
    newerScientificInput.study.outcome = "Employment";
    newerScientificInput.study.revision += 1;
    const reconciled = reconcileScreen3HandoffTaskWithCanonical({
      task,
      state: newerScientificInput,
    });
    expect(reconciled).toMatchObject({
      task: {
        stage: "saved_historical",
        state: "committed_display_pending",
        problem: null,
      },
      compatibility: "incompatible",
      persistence: "clear",
      statusRead: "none",
      automaticMutation: "never",
    });
    expect(screen3HandoffStagePolicy(reconciled.task.stage)
      .blocksPrimarySubmit).toBe(false);
    expect(shouldReconcileScreen3HandoffAfterCanonicalAcceptance({
      acceptedCanonicalEpoch: 1,
      markerCanonicalFloor: 0,
    })).toBe(true);
    expect(shouldReconcileScreen3HandoffAfterCanonicalAcceptance({
      acceptedCanonicalEpoch: 1,
      markerCanonicalFloor: 1,
    })).toBe(false);

    const legacy = { ...task, scientificBinding: undefined };
    expect(reconcileScreen3HandoffTaskWithCanonical({
      task: legacy,
      state: fixture.state,
    })).toMatchObject({
      task: { stage: "saved_display_unavailable" },
      compatibility: "unknown_legacy",
      persistence: "preserve",
      statusRead: "none",
      automaticMutation: "never",
    });
    expect(reconcileScreen3HandoffTaskWithCanonical({
      task: legacy,
      state: newerScientificInput,
    })).toMatchObject({
      task: { stage: "saved_historical" },
      compatibility: "incompatible",
      persistence: "clear",
      statusRead: "none",
      automaticMutation: "never",
    });
  });

  it("keeps a committed result accepted when only widget persistence fails", () => {
    expect(screen3WidgetPersistenceFailurePlan()).toEqual({
      canonicalAccepted: true,
      automaticMutation: "never",
      warning:
        "The saved study is available now, but this host could not keep the current panel state for reopening. Check saved status if you reopen it.",
    });
  });

});

describe("compact Screen 3 status contract", () => {
  it("classifies malformed status as a response contract without retry", async () => {
    const callTool = vi.fn(async () => ({
      structuredContent: { malformed: true },
    }));
    const hostWindow: Record<string, unknown> = { openai: { callTool } };
    hostWindow.parent = hostWindow;
    vi.stubGlobal("window", hostWindow);
    const bridge = new SixScreenBridge();

    let caught: unknown;
    try {
      await bridge.getSixScreenOperationStatus({
        accessToken: `sa6a_${"a".repeat(43)}`,
        request: {
          runId: recovery.runId,
          operationId: recovery.operationId,
          operationKind: recovery.operationKind,
          inputFingerprint: recovery.inputFingerprint,
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "response_contract",
      stage: "serialization",
      commitCertainty: "unknown",
      dispatchCertainty: "not_dispatched",
      recovery: "update_client",
      safeCauseCodes: ["response_contract_invalid"],
    });
  });
});
