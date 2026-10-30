import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { SixScreenWorkflowProblemError } from
  "../../src/core/six-screen/workflow-problem";
import {
  openScreen3,
  openScreen5,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { screen5OpenAIInferenceFetch } from "../../src/worker/server";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const study: StudyContextDraft = {
  population: "U.S. public manufacturers",
  analysisUnit: "firm-year",
  geography: ["United States", "California"],
  industry: ["Manufacturing"],
  period: { start: "2010", end: "2025" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection",
  initialExplanation: "Through increased customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

async function screen5Harness() {
  const fixture = createBrowserEventCardFixture();
  const screen3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study,
    proposedTiming: { mode: "year", year: 2023, milestoneReference: null },
    openedAt: "2026-09-25T12:00:00.000Z",
  });
  const screen5 = openScreen5(screen3.state, {
    expectedRevision: screen3.state.revision,
    openedAt: "2026-09-25T12:00:01.000Z",
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: screen5.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("typed-screen5"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-26T00:00:00.000Z",
  });
  let tick = 2;
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "typed-failure-runtime-key-more-than-thirty-two-bytes",
    now: () => `2026-09-25T12:00:${String(tick++).padStart(2, "0")}.000Z`,
    fetch: vi.fn(async () => {
      throw new Error("No source call is authorized in this test.");
    }),
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "typed-failure-test-key-never-projected",
    screen5OpenAIFetch: screen5OpenAIInferenceFetch({
      SCREEN5_OPENAI_FETCH: vi.fn(async () => {
        throw new Error("No provider call is authorized in this test.");
      }),
    }),
    screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
  });
  return {
    authentication: { runId, accessToken },
    runtime,
    screen5,
    storage,
    store,
  };
}

function expectProblem(
  caught: unknown,
  expected: Record<string, unknown>,
) {
  expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
  expect((caught as SixScreenWorkflowProblemError).problem)
    .toMatchObject(expected);
  expect(JSON.stringify(caught)).not.toContain(accessToken);
}

describe("typed long-running runtime guards", () => {
  it("stages Screen 4 stale admission before source execution", async () => {
    const target = await screen5Harness();
    let caught: unknown;
    try {
      await target.runtime.openScreen4(target.authentication, {
        expectedRevision: target.screen5.state.revision + 1,
        operationId: "typed-screen4-stale",
      });
    } catch (error) {
      caught = error;
    }
    expectProblem(caught, {
      code: "revision_conflict",
      stage: "revision_check",
      action: "open_screen_4",
      screen: 4,
      expectedRevision: target.screen5.state.revision + 1,
      actualRevision: target.screen5.state.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      safeCauseCodes: ["stale_revision"],
    });

    let unavailable: unknown;
    try {
      await target.runtime.openScreen4(target.authentication, {
        expectedRevision: target.screen5.state.revision,
        operationId: "typed-screen4-task-store-unavailable",
      });
    } catch (error) {
      unavailable = error;
    }
    expectProblem(unavailable, {
      code: "configuration_unavailable",
      stage: "execution",
      action: "open_screen_4",
      screen: 4,
      expectedRevision: target.screen5.state.revision,
      actualRevision: target.screen5.state.revision + 1,
      commitCertainty: "committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["configuration_unavailable"],
    });
    const saved = await target.store.read(target.authentication);
    expect(saved).toMatchObject({
      outcome: "found",
      record: { state: { activeScreen: 4,
        revision: target.screen5.state.revision + 1 } },
    });
  });

  it("distinguishes missing Screen 5 jobs from stale admission without dispatch", async () => {
    const target = await screen5Harness();
    let missingAuthorization: unknown;
    try {
      await target.runtime.authorizeStudyFirstMechanismJob(
        target.authentication,
        {
          expectedRevision: target.screen5.state.revision,
          operationId: "typed-screen5-missing-authorization",
          expectedExecutionFingerprint: "fnv1a64:1111111111111111",
        },
      );
    } catch (error) {
      missingAuthorization = error;
    }
    expectProblem(missingAuthorization, {
      code: "core_state_invalid",
      stage: "request_validation",
      action: "authorize_study_first_mechanism_job",
      screen: 5,
      actualRevision: target.screen5.state.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["core_state_invalid"],
    });

    let missingAdvance: unknown;
    try {
      await target.runtime.advanceStudyFirstMechanismJob(
        target.authentication,
        {
          expectedRevision: target.screen5.state.revision,
          operationId: "typed-screen5-missing-advance",
          retry: false,
        },
      );
    } catch (error) {
      missingAdvance = error;
    }
    expectProblem(missingAdvance, {
      code: "core_state_invalid",
      stage: "request_validation",
      action: "advance_study_first_mechanism_job",
      screen: 5,
      actualRevision: target.screen5.state.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["core_state_invalid"],
    });
  });

  it("separates stale, configuration, and scientific binding failures for a saved Screen 5 job", async () => {
    const target = await screen5Harness();
    const prepared = await target.runtime.compareStudyFirstMechanisms(
      target.authentication,
      {
        expectedRevision: target.screen5.state.revision,
        operationId: "typed-screen5-prepare-job",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms change privacy controls, which may alter customer trust.",
      },
    );
    const execution = prepared.projection.studyFirstMechanismWorkspace
      .currentRun?.providerExecution;
    expect(execution).not.toBeNull();
    expect(execution).not.toBeUndefined();

    let stale: unknown;
    try {
      await target.runtime.authorizeStudyFirstMechanismJob(
        target.authentication,
        {
          expectedRevision: prepared.privateSnapshot.revision - 1,
          operationId: "typed-screen5-stale-authorization",
          expectedExecutionFingerprint: execution!.executionFingerprint,
        },
      );
    } catch (error) {
      stale = error;
    }
    expectProblem(stale, {
      code: "revision_conflict",
      stage: "revision_check",
      action: "authorize_study_first_mechanism_job",
      screen: 5,
      expectedRevision: prepared.privateSnapshot.revision - 1,
      actualRevision: prepared.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      safeCauseCodes: ["stale_revision"],
    });

    let binding: unknown;
    try {
      await target.runtime.authorizeStudyFirstMechanismJob(
        target.authentication,
        {
          expectedRevision: prepared.privateSnapshot.revision,
          operationId: "typed-screen5-wrong-binding",
          expectedExecutionFingerprint: "fnv1a64:2222222222222222",
        },
      );
    } catch (error) {
      binding = error;
    }
    expectProblem(binding, {
      code: "operation_identity_conflict",
      stage: "revision_check",
      action: "authorize_study_first_mechanism_job",
      screen: 5,
      actualRevision: prepared.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["operation_conflict"],
    });

    const offline = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "typed-failure-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-25T12:10:00.000Z",
      fetch: vi.fn(async () => {
        throw new Error("No source call is authorized in this test.");
      }),
    });
    let unavailable: unknown;
    try {
      await offline.authorizeStudyFirstMechanismJob(target.authentication, {
        expectedRevision: prepared.privateSnapshot.revision,
        operationId: "typed-screen5-unavailable-config",
        expectedExecutionFingerprint: execution!.executionFingerprint,
      });
    } catch (error) {
      unavailable = error;
    }
    expectProblem(unavailable, {
      code: "configuration_unavailable",
      stage: "execution",
      action: "authorize_study_first_mechanism_job",
      screen: 5,
      actualRevision: prepared.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["configuration_unavailable"],
    });

    let notAuthorized: unknown;
    try {
      await target.runtime.advanceStudyFirstMechanismJob(
        target.authentication,
        {
          expectedRevision: prepared.privateSnapshot.revision,
          operationId: "typed-screen5-advance-before-authorization",
          retry: false,
        },
      );
    } catch (error) {
      notAuthorized = error;
    }
    expectProblem(notAuthorized, {
      code: "authorization",
      stage: "authorization",
      action: "advance_study_first_mechanism_job",
      screen: 5,
      actualRevision: prepared.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["authorization_failed"],
    });
  });

  it("stages Screen 6 scientific binding and stale revision separately", async () => {
    const target = await screen5Harness();
    const plan = createScreen6CurrentPlan(target.screen5.state);
    let binding: unknown;
    try {
      await target.runtime.personalizeScreen6(target.authentication, {
        expectedRevision: target.screen5.state.revision,
        operationId: "typed-screen6-wrong-binding",
        expectedPlanFingerprint: "fnv1a64:3333333333333333",
      });
    } catch (error) {
      binding = error;
    }
    expectProblem(binding, {
      code: "operation_identity_conflict",
      stage: "revision_check",
      action: "personalize_screen6_plan",
      screen: 6,
      actualRevision: target.screen5.state.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["operation_conflict"],
    });

    let stale: unknown;
    try {
      await target.runtime.personalizeScreen6(target.authentication, {
        expectedRevision: target.screen5.state.revision + 1,
        operationId: "typed-screen6-stale",
        expectedPlanFingerprint: plan.inputFingerprint,
      });
    } catch (error) {
      stale = error;
    }
    expectProblem(stale, {
      code: "revision_conflict",
      stage: "revision_check",
      action: "personalize_screen6_plan",
      screen: 6,
      expectedRevision: target.screen5.state.revision + 1,
      actualRevision: target.screen5.state.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      safeCauseCodes: ["stale_revision"],
    });
  });
});
