import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { isLongRunningSixScreenMutation } from
  "../../src/core/six-screen/long-running-operation";
import { analysisArtifactRecovered } from
  "../../src/ui/six-screen/SixScreenApp";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
} from "../browser/six-screen-event-card-review-fixture";
import {
  acceptanceCase,
  createValidatedStudyFirstScenario,
  privateSnapshot,
  syntheticFixture,
  syntheticMutation,
} from "./ph1-fixture-adapter";

describe("PH1 acceptance recovery and readiness", () => {
  it("AC003 / FX02 / FX14 classifies Screen 4 discovery as long-running", () => {
    expect(acceptanceCase("AC003").fixture_ids).toEqual(
      expect.arrayContaining(["FX02", "FX14"]),
    );
    expect(isLongRunningSixScreenMutation({
      action: "open_screen_4",
    })).toBe(true);
    expect(isLongRunningSixScreenMutation({
      action: "refresh_study_first_events",
    })).toBe(true);
  });

  it("AC003 / FX06 / MU04 classifies a committed Screen 4 discovery as recoverable", () => {
    expect(acceptanceCase("AC003").title).toMatch(/long actions/iu);
    expect(syntheticFixture("FX06").id).toBe("FX06");
    expect(syntheticMutation("MU04").id).toBe("MU04");

    const { screen3State, screen4State, plannedInvestigation } =
      createValidatedStudyFirstScenario();
    const recovered = analysisArtifactRecovered(
      privateSnapshot(screen3State),
      privateSnapshot(screen4State),
      {
        action: "open_screen_4",
        expectedRevision: screen3State.revision,
        operationId: "ac003-open-screen-4-lost-delivery",
        expectedInvestigationFingerprint:
          plannedInvestigation.investigationFingerprint,
      },
    );

    expect(recovered).toBe(true);
  });

  it("AC017 / FX24 reports model readiness without inventing a Screen 5 job", async () => {
    expect(acceptanceCase("AC017").fixture_ids).toContain("FX24");
    expect(syntheticFixture("FX24").production_compatible).toBe(false);

    const { screen3State } = createValidatedStudyFirstScenario();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({
      state: screen3State,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue("ac017-fx24"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-30T00:00:00.000Z",
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({
      attempts: 0,
      tokens: 0,
      source: "AC017 / FX24 controlled readiness fixture",
      now: "2026-09-25T12:00:00.000Z",
    });
    const sourceFetch = vi.fn(async () => {
      throw new Error("AC017 forbids external source dispatch.");
    });
    const modelFetch = vi.fn(async () => {
      throw new Error("AC017 forbids external model dispatch.");
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "ac017-readiness-signing-key-more-than-thirty-two-bytes",
      now: () => "2026-09-25T12:00:01.000Z",
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "controlled-test-key-never-dispatched",
      screen5OpenAIFetch: modelFetch,
      screen5OpenAILedgerStore: ledger,
    });

    const status = await runtime.status({
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    });
    const workspace = status.projection.studyFirstMechanismWorkspace;

    expect(workspace.currentRun).toBeNull();
    expect(workspace.executionReadiness).toMatchObject({
      configuration: "ready",
      keyPresent: true,
      credentialStatus: "not_tested",
      authorization: "not_applicable",
      activeExecutionId: null,
    });
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(modelFetch).not.toHaveBeenCalled();
  });
});
