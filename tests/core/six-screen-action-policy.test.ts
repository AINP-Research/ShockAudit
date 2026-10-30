import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  SIX_SCREEN_ACTION_POLICIES,
  SIX_SCREEN_MUTATION_ACTIONS,
  isSixScreenMutationAction,
  sixScreenActionPolicy,
} from "../../src/core/six-screen/action-policy";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const registeredToolsSource = readFileSync(
  new URL("../../src/worker/six-screen-tools.ts", import.meta.url),
  "utf8",
);

function sourceBetween(start: string, end: string) {
  const startIndex = registeredToolsSource.indexOf(start);
  const endIndex = registeredToolsSource.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not inspect registered mutation source: ${start}`);
  }
  return registeredToolsSource.slice(startIndex, endIndex);
}

function matches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe("six-screen mutation action policy", () => {
  it("declares exactly one policy for every unique action", () => {
    expect(new Set(SIX_SCREEN_MUTATION_ACTIONS).size)
      .toBe(SIX_SCREEN_MUTATION_ACTIONS.length);
    expect(Object.keys(SIX_SCREEN_ACTION_POLICIES).sort())
      .toEqual([...SIX_SCREEN_MUTATION_ACTIONS].sort());
  });

  it("matches the real registered mutation union and every dispatch branch", () => {
    // The complete action union is intentionally private to the registered
    // tool: the advertised wire schema remains z.unknown to stay within the
    // host catalog ceiling. Inspecting the implementation here makes adding a
    // schema action without a recovery policy (or without a handler) a test
    // failure instead of a silent fall-through to openScreen2.
    const schemaSource = sourceBetween(
      "const mutationSchema = z.discriminatedUnion",
      "const mutationWireSchema =",
    );
    const schemaActions = matches(
      schemaSource,
      /action:\s*z\.literal\("([a-z0-9_]+)"\)/gu,
    );
    expect(new Set(schemaActions).size).toBe(schemaActions.length);
    expect([...schemaActions].sort())
      .toEqual([...SIX_SCREEN_MUTATION_ACTIONS].sort());

    const dispatchSource = sourceBetween(
      "const response = mutation.action",
      "return result(\n        response.projection",
    );
    const explicitDispatchActions = matches(
      dispatchSource,
      /mutation\.action\s*===\s*"([a-z0-9_]+)"/gu,
    );
    expect(new Set(explicitDispatchActions).size)
      .toBe(explicitDispatchActions.length);
    expect(dispatchSource).toMatch(
      /mutation\.action\s*===\s*"open_screen_3"\s*\?\s*await runtime\.openScreen3\(/u,
    );
    expect(dispatchSource).toMatch(
      /mutation\.action\s*===\s*"open_screen_4"\s*\?\s*await runtime\.openScreen4\(/u,
    );
    expect(dispatchSource).toMatch(
      /:\s*await runtime\.openScreen2\(\s*authentication,\s*common,\s*\);/u,
    );
    expect([...explicitDispatchActions, "open_screen_2"].sort())
      .toEqual([...SIX_SCREEN_MUTATION_ACTIONS].sort());
  });

  it("keeps the Screen 2 to Screen 3 handoff local and receipt-recoverable", () => {
    expect(sixScreenActionPolicy("open_screen_3")).toEqual({
      externalWork: "none",
      scientificEffect: "guidance",
      failureRecovery: "operation_status",
      allowsCompatibleRevisionRebase: true,
      destinationScreen: 3,
    });
  });

  it("keeps model, source, and local operations distinct", () => {
    expect(sixScreenActionPolicy("personalize_screen3_advice")?.externalWork)
      .toBe("model");
    expect(sixScreenActionPolicy("open_screen_4")?.externalWork)
      .toBe("source");
    expect(sixScreenActionPolicy("refresh_study_first_events")?.externalWork)
      .toBe("source");
    expect(sixScreenActionPolicy("continue_coevent_search")?.externalWork)
      .toBe("source");
    expect(sixScreenActionPolicy("add_source")?.externalWork).toBe("none");
    expect(sixScreenActionPolicy("compare_study_first_mechanisms")
      ?.externalWork).toBe("none");
    expect(sixScreenActionPolicy("authorize_study_first_mechanism_job")
      ?.externalWork).toBe("none");
    expect(sixScreenActionPolicy("advance_study_first_mechanism_job")
      ?.externalWork).toBe("mixed");
    expect(sixScreenActionPolicy("open_screen_6")?.externalWork).toBe("none");
    expect(isSixScreenMutationAction("unregistered_action")).toBe(false);
    expect(sixScreenActionPolicy("unregistered_action")).toBeNull();
  });

  it("executes open_screen_3 through local store state without source or provider work", async () => {
    const fixture = createBrowserEventCardFixture();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({
      state: fixture.state,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue(
        "action-policy-open-screen-3",
      ),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: browserEventCardFixtureAt(1_000),
    });
    const sourceFetch = vi.fn(async () => {
      throw new Error("open_screen_3 must not perform source retrieval");
    });
    const providerFetch = vi.fn(async () => {
      throw new Error("open_screen_3 must not dispatch provider inference");
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "action-policy-test-signing-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(40),
      fetch: sourceFetch,
      screen5OpenAIFetch: providerFetch,
    });
    const keysBefore = [...storage.values.keys()].sort();
    const study = fixture.state.study;
    const input = {
      expectedRevision: fixture.state.revision,
      operationId: "action-policy-open-screen-3",
      study: {
        population: study.population,
        analysisUnit: study.analysisUnit,
        geography: study.geography,
        industry: study.industry,
        period: study.period,
        outcome: study.outcome,
        outcomeMeasure: study.outcomeMeasure ?? null,
        intendedConstruct: study.intendedConstruct,
        policySideConcept: study.policySideConcept ?? null,
        initialExplanation: study.initialExplanation,
        proposedTreatment: study.proposedTreatment,
        proposedComparison: study.proposedComparison,
        resultsPreviouslyInspected: study.resultsPreviouslyInspected,
      },
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
    };

    const opened = await runtime.openScreen3({
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    }, input);
    expect(opened).toMatchObject({
      replayed: false,
      mutationOutcome: "changed",
      projection: { activeScreen: 3 },
    });
    expect([...storage.values.keys()].sort()).toEqual(keysBefore);
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();

    const replay = await runtime.openScreen3({
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    }, input);
    expect(replay).toMatchObject({
      replayed: true,
      mutationOutcome: "replayed",
      privateSnapshot: { revision: opened.privateSnapshot.revision },
    });
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
