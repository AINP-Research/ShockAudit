import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  currentProposedTreatmentTiming,
  currentStudyDesignAdvice,
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  SIX_SCREEN_TREATMENT_YEAR_MAX,
  SIX_SCREEN_TREATMENT_YEAR_MIN,
  type ProposedTreatmentTimingInput,
  type StudyDesignClarifications,
} from "../../src/core/six-screen/study-design-advice";
import type { StudyContextDraft } from
  "../../src/core/six-screen/workflow";
import { decodeSixScreenWorkflowProblemText } from
  "../../src/core/six-screen/workflow-problem";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
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

const connected: Array<{ client: Client; server: McpServer }> = [];

const completeThresholdClarifications: StudyDesignClarifications = {
  ...EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  assignmentUnit: "Synthetic supplier establishment",
  rd: {
    runningVariable: "Baseline test revenue units",
    cutoff: "100",
    operator: ">=",
    assignmentRule:
      "Baseline test revenue >= 100 AND no fictional exemption",
    treatmentTarget: "eligibility",
    assignmentRelation: "sharp",
    verification: "researcher_reported",
    otherConditions: "No fictional exemption",
    bindingStatus: "binding",
    probabilityJump: "not_reported",
  },
};

function studyDraft(): StudyContextDraft {
  const { study } = createBrowserEventCardFixture().state;
  return {
    population: study.population,
    analysisUnit: study.analysisUnit,
    geography: [...study.geography],
    industry: [...study.industry],
    period: structuredClone(study.period),
    outcome: study.outcome,
    outcomeMeasure: study.outcomeMeasure ?? null,
    intendedConstruct: study.intendedConstruct,
    policySideConcept: study.policySideConcept ?? null,
    initialExplanation: study.initialExplanation,
    proposedTreatment: study.proposedTreatment,
    proposedComparison: study.proposedComparison,
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  };
}

async function registeredTimingHarness() {
  const fixture = createBrowserEventCardFixture();
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: fixture.state,
    accessToken: browserEventCardFixtureAccessToken,
    createInputFingerprint: fingerprintSixScreenValue(
      "v26-registered-timing-acceptance",
    ),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: browserEventCardFixtureAt(1_000),
  });
  let clock = 40;
  const sourceFetch = vi.fn(async () => {
    throw new Error("Timing acceptance must not perform source work.");
  });
  const modelFetch = vi.fn(async () => {
    throw new Error("Timing acceptance must not perform model work.");
  });
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "v26-timing-acceptance-signing-key-over-thirty-two-bytes",
    now: () => browserEventCardFixtureAt(clock++),
    fetch: sourceFetch,
    screen5OpenAIFetch: modelFetch,
  });
  const server = new McpServer(
    { name: "v26-timing-acceptance", version: "1.0.0" },
  );
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({
    name: "v26-timing-acceptance-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return {
    client,
    store,
    sourceFetch,
    modelFetch,
    auth: {
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    },
    initialRevision: fixture.state.revision,
  };
}

async function readState(
  harness: Awaited<ReturnType<typeof registeredTimingHarness>>,
) {
  const read = await harness.store.read(harness.auth);
  expect(read.outcome).toBe("found");
  if (read.outcome !== "found") throw new Error("Expected saved workflow.");
  return read.record.state;
}

async function callOpenScreen3(
  harness: Awaited<ReturnType<typeof registeredTimingHarness>>,
  input: {
    operationId: string;
    expectedRevision: number;
    proposedTiming: unknown;
    clarifications?: unknown;
    study?: StudyContextDraft;
  },
) {
  return harness.client.callTool({
    name: "mutate_six_screen_workflow_v1",
    arguments: {
      ...harness.auth,
      mutation: {
        action: "open_screen_3",
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        study: input.study ?? studyDraft(),
        proposedTiming: input.proposedTiming,
        ...(input.clarifications === undefined
          ? {} : { clarifications: input.clarifications }),
      },
    },
  });
}

function decodedProblem(
  result: Awaited<ReturnType<Client["callTool"]>>,
) {
  const text = result.content.find((item) => item.type === "text")?.text;
  expect(typeof text).toBe("string");
  return decodeSixScreenWorkflowProblemText(String(text));
}

function expectNoExternalCalls(
  harness: Awaited<ReturnType<typeof registeredTimingHarness>>,
) {
  expect(harness.sourceFetch).not.toHaveBeenCalled();
  expect(harness.modelFetch).not.toHaveBeenCalled();
}

afterEach(async () => {
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
});

describe("v26 registered Screen 3 timing acceptance", () => {
  it.each([
    {
      caseId: "AC003",
      mode: "varies_by_group" as const,
      precision: "varies_by_group" as const,
      warning: undefined,
    },
    {
      caseId: "AC004",
      mode: "undecided" as const,
      precision: "unknown" as const,
      warning: "timing-undecided",
    },
  ])("$caseId accepts $mode with an exact null year through the registered tool", async ({
    caseId,
    mode,
    precision,
    warning,
  }) => {
    const harness = await registeredTimingHarness();
    const result = await callOpenScreen3(harness, {
      operationId: `${caseId.toLowerCase()}-${mode}`,
      expectedRevision: harness.initialRevision,
      proposedTiming: { mode, year: null, milestoneReference: null },
    });

    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    const state = await readState(harness);
    expect(state.activeScreen).toBe(3);
    expect(currentProposedTreatmentTiming(state)).toMatchObject({
      mode,
      year: null,
      milestoneReference: null,
      precision,
      origin: "researcher_reported",
    });
    const advice = currentStudyDesignAdvice(state);
    expect(advice?.proposalEcho.timing).toMatchObject({
      mode,
      year: null,
      milestoneReference: null,
      precision,
    });
    expect(advice?.clarifications.adoptionPattern).toBe("unknown");
    expect(advice?.options.find(({ family }) =>
      family === "difference_in_differences")?.timingVariant).toBe(
        mode === "varies_by_group"
          ? "staggered_absorbing_adoption" : "common_timing",
      );
    if (warning) {
      expect(advice?.warnings.map(({ ruleId }) => ruleId)).toContain(warning);
    } else {
      expect(advice?.warnings.map(({ ruleId }) => ruleId))
        .not.toContain("timing-undecided");
    }
    expectNoExternalCalls(harness);
  });

  it("AC005 saves a complete synthetic threshold clarification without certifying an RD", async () => {
    const harness = await registeredTimingHarness();
    const result = await callOpenScreen3(harness, {
      operationId: "ac005-valid-threshold",
      expectedRevision: harness.initialRevision,
      proposedTiming: {
        mode: "year",
        year: 2019,
        milestoneReference: null,
      } satisfies ProposedTreatmentTimingInput,
      clarifications: completeThresholdClarifications,
    });

    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    const state = await readState(harness);
    const advice = currentStudyDesignAdvice(state);
    expect(currentProposedTreatmentTiming(state)).toMatchObject({
      mode: "year",
      year: 2019,
      precision: "year",
    });
    expect(advice?.clarifications.rd).toEqual(
      completeThresholdClarifications.rd,
    );
    expect(advice?.options.find(({ family }) =>
      family === "regression_discontinuity")).toMatchObject({
        entryId: "R01",
        applicability: "conditional_consideration",
        unknowns: expect.arrayContaining([
          expect.stringMatching(/support sufficiently near both sides/iu),
          expect.stringMatching(/sorting\/manipulation/iu),
        ]),
      });
    expect(advice?.options.find(({ family }) =>
      family === "regression_discontinuity")?.prohibitedClaims).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/support.*has been measured/iu),
        ]),
      );
    expectNoExternalCalls(harness);
  });

  it("AC006 rejects an incomplete threshold packet, then saves year-only without stale RD while retaining valid history", async () => {
    const harness = await registeredTimingHarness();
    const historical = await callOpenScreen3(harness, {
      operationId: "ac006-historical-complete-threshold",
      expectedRevision: harness.initialRevision,
      proposedTiming: {
        mode: "year",
        year: 2019,
        milestoneReference: null,
      },
      clarifications: completeThresholdClarifications,
    });
    expect(historical.isError).not.toBe(true);
    const afterHistorical = await readState(harness);
    const historicalAdvice = currentStudyDesignAdvice(afterHistorical);
    expect(historicalAdvice?.clarifications.rd).not.toBeNull();

    const incomplete = await callOpenScreen3(harness, {
      operationId: "ac006-incomplete-threshold-draft",
      expectedRevision: afterHistorical.revision,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: {
        ...EMPTY_STUDY_DESIGN_CLARIFICATIONS,
        rd: {
          runningVariable: "Baseline test revenue units",
          assignmentRule: "",
        },
      },
    });
    expect(incomplete.isError).toBe(true);
    expect(decodedProblem(incomplete)).toMatchObject({
      code: "request_contract",
      stage: "request_validation",
      action: "open_screen_3",
      screen: 3,
      expectedRevision: afterHistorical.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      fieldIssues: expect.arrayContaining([
        expect.objectContaining({ fieldPath: "clarifications.rd.cutoff" }),
      ]),
    });
    expect((await readState(harness)).revision).toBe(afterHistorical.revision);

    const ordinaryYearStudy = {
      ...studyDraft(),
      outcomeMeasure: "Days overdue",
    };
    const yearOnly = await callOpenScreen3(harness, {
      operationId: "ac006-year-only-after-draft",
      expectedRevision: afterHistorical.revision,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      study: ordinaryYearStudy,
    });
    expect(yearOnly.isError, JSON.stringify(yearOnly.content)).not.toBe(true);
    const finalState = await readState(harness);
    expect(currentProposedTreatmentTiming(finalState)).toMatchObject({
      mode: "year",
      year: 2020,
      milestoneReference: null,
      precision: "year",
    });
    expect(finalState.study.outcomeMeasure).toBe("Days overdue");
    expect(currentStudyDesignAdvice(finalState)?.clarifications.rd).toBeNull();
    expect(finalState.studyDesignAdvices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        adviceId: historicalAdvice?.adviceId,
        clarifications: expect.objectContaining({
          rd: completeThresholdClarifications.rd,
        }),
      }),
    ]));
    expectNoExternalCalls(harness);
  });

  it("AC008 accepts exact year boundaries and rejects adjacent, null, decimal, string, and missing values before persistence", async () => {
    const harness = await registeredTimingHarness();
    let state = await readState(harness);
    for (const year of [
      SIX_SCREEN_TREATMENT_YEAR_MIN,
      SIX_SCREEN_TREATMENT_YEAR_MAX,
    ]) {
      const accepted = await callOpenScreen3(harness, {
        operationId: `ac008-boundary-${year}`,
        expectedRevision: state.revision,
        proposedTiming: { mode: "year", year, milestoneReference: null },
      });
      expect(accepted.isError, `boundary ${year}`).not.toBe(true);
      state = await readState(harness);
      expect(currentProposedTreatmentTiming(state)).toMatchObject({
        mode: "year",
        year,
        precision: "year",
      });
    }

    const revisionBeforeInvalidValues = state.revision;
    const invalidValues: Array<[string, Record<string, unknown>, string]> = [
      ["below-minimum", {
        mode: "year", year: SIX_SCREEN_TREATMENT_YEAR_MIN - 1,
        milestoneReference: null,
      }, "too_small"],
      ["above-maximum", {
        mode: "year", year: SIX_SCREEN_TREATMENT_YEAR_MAX + 1,
        milestoneReference: null,
      }, "too_big"],
      ["null", { mode: "year", year: null, milestoneReference: null },
        "invalid_type"],
      ["decimal", { mode: "year", year: 2020.5, milestoneReference: null },
        "invalid_type"],
      ["string", { mode: "year", year: "2020", milestoneReference: null },
        "invalid_type"],
      ["missing", { mode: "year", milestoneReference: null }, "invalid_type"],
    ];
    for (const [label, proposedTiming, issueCode] of invalidValues) {
      const rejected = await callOpenScreen3(harness, {
        operationId: `ac008-invalid-${label}`,
        expectedRevision: revisionBeforeInvalidValues,
        proposedTiming,
      });
      expect(rejected.isError, label).toBe(true);
      expect(decodedProblem(rejected)).toMatchObject({
        code: "request_contract",
        stage: "request_validation",
        action: "open_screen_3",
        screen: 3,
        expectedRevision: revisionBeforeInvalidValues,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        fieldIssues: expect.arrayContaining([
          expect.objectContaining({
            fieldPath: "proposedTiming.year",
            code: issueCode,
          }),
        ]),
      });
      expect((await readState(harness)).revision)
        .toBe(revisionBeforeInvalidValues);
    }
    expectNoExternalCalls(harness);
  });
});
