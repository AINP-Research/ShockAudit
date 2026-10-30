import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { SixScreenWorkflowProblemError } from
  "../../src/core/six-screen/workflow-problem";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { openScreen3, openScreen4, openScreen5, openScreen6 } from
  "../../src/core/six-screen/workflow";
import { analysisArtifactRecovered } from
  "../../src/ui/six-screen/SixScreenApp";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { restoreSixScreenWorkflowToolResponse } from
  "../../src/ui/six-screen/workflow-response";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { screen3ContextualPacket, SCREEN3_CONTEXTUALIZER_VERSION,
  SCREEN3_DESIGN_DIMENSIONS } from
  "../../src/worker/screen3-contextualizer";
import { SCREEN6_CONTEXTUALIZATION_WIRE_VERSION } from
  "../../src/worker/screen6-contextualizer";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import { InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore } from
  "../../src/worker/six-screen-workflow-store";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt as at,
  browserEventCardFixtureCreatedAt as createdAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const mutateTool = "mutate_six_screen_workflow_v1";
const getTool = "get_six_screen_workflow_v1";
const authentication = { runId, accessToken };
const connected: Array<{ client: Client; server: McpServer }> = [];

afterEach(async () => {
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function response(content: unknown, id: string) {
  return new Response(JSON.stringify({
    id, object: "response", status: "completed", model: "gpt-6-luna",
    service_tier: "default",
    output: [{ id: `msg_${id}`, type: "message", role: "assistant",
      status: "completed", content: [{ type: "output_text",
        annotations: [], text: JSON.stringify(content) }] }],
    usage: { input_tokens: 900, output_tokens: 400, total_tokens: 1_300,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 100 } },
  }), { headers: { "content-type": "application/json",
    "x-request-id": `req_${id}` } });
}

function screen3State() {
  const fixture = createBrowserEventCardFixture();
  return openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: {
      population: "U.S. public energy firms", analysisUnit: "firm-year",
      geography: ["United States", "California"], industry: ["Energy"],
      period: { start: "2018", end: "2024" }, outcome: "Firm performance",
      outcomeMeasure: "Return on assets", intendedConstruct: null,
      policySideConcept: "Participation flexibility",
      initialExplanation: "Market access can change operations.",
      proposedTreatment: "California firms",
      proposedComparison: "Other U.S. firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: { mode: "year", year: 2020,
      milestoneReference: null },
    openedAt: at(40),
  }).state;
}

function screen3Wire(state: ReturnType<typeof screen3State>) {
  const advice = state.studyDesignAdvices!.at(-1)!;
  const packet = screen3ContextualPacket(state, advice);
  const claim = packet.policy.claims.find((item) =>
    item.kind === "coverage_condition") ?? packet.policy.claims[0]!;
  return {
    schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
    concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension, index) => ({
      issue_id: dimension.id,
      specific_heading: dimension.heading,
      status_label: index === 0 ? "Treatment clock needs review" :
        "Requires design evidence",
      relevant_fact_or_proposal: index === 0
        ? `${claim.statement} The researcher proposes California firms versus other U.S. firms.`
        : `The saved proposal supplies exact inputs for ${dimension.heading.toLowerCase()}.`,
      why_it_matters: "This condition can change the interpretation of the proposed comparison and outcome.",
      unresolved_question: "What does the unit-level evidence show?",
      next_check: "Inspect corresponding dated firm and period records.",
      check_limit: "This check alone cannot establish comparable untreated outcomes.",
      priority: index < 2 ? "high" as const : "medium" as const,
      priority_reason: "The proposed comparison depends on this condition.",
      documentary_claim_ids: index === 0 ? [claim.id] : [],
      researcher_input_fields: ["proposedTreatment", "proposedComparison"],
    })),
    synthesis_limit: "A prospective coverage check does not estimate a treatment effect.",
  };
}

function screen6Wire(state: ReturnType<typeof createBrowserEventCardFixture>["state"]) {
  const plan = createScreen6CurrentPlan(state);
  return {
    schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
    dimension_summaries: plan.dimensions.map((dimension) => ({
      dimension_id: dimension.id,
      title: `Check ${dimension.label.toLowerCase()}`,
      known_basis: `The saved study records ${dimension.state.toLowerCase()}.`,
      specific_concern: dimension.concern,
      next_check: dimension.check,
      material_limit: "This check cannot establish a causal policy effect.",
      source_refs: [], input_refs: ["study.proposedGroups"],
    })),
    priorities: plan.priorities.slice(0, 3).map((card) => ({
      diagnostic_id: card.id,
      priority_reason: "Verify the proposed exposure comparison.",
      study_specific_question: "Which sampled firms met the documented policy rule?",
      contextual_procedure: "Compare dated firm records to the retained rule.",
      data_needs: "Dated firm activities and eligibility records.",
      concerning_pattern: "Proposed comparison firms also meet the rule.",
      alternative_explanation: "Geography could misclassify actual exposure.",
      reassurance_limit: "Eligibility does not establish parallel untreated outcomes.",
      next_action: "Revise the comparison if the documented rule requires it.",
    })),
    claim_boundary: {
      planned_target: plan.boundary.plannedTarget,
      required_assumptions: "Actual eligibility and comparability need evidence.",
      stronger_claims_not_established: "Neither a component nor mediation effect is identified.",
      next_action: "Verify coverage before estimation.",
    },
    remaining_gaps: plan.gaps,
  };
}

function screen5State() {
  const opened3 = screen3State();
  const opened4 = openScreen4(opened3, {
    expectedRevision: opened3.revision, openedAt: at(41),
  });
  return openScreen5(opened4.state, {
    expectedRevision: opened4.state.revision, openedAt: at(42),
  }).state;
}

const screen5PlanWire = {
  candidates: [{
    candidate_id: "implementation-costs",
    concept: "Implementation resource costs",
    chain: ["New reporting duty", "Staff time", "Operating costs"],
    difference: "Implementation costs can change without the focal market participation mechanism.",
    condition: "Covered firms devote material resources to reporting.",
    direction: {
      mode: "single_hypothesis",
      target_outcome: "Firm performance",
      target_measure: "Return on assets",
      scenarios: [{ sign: "negative", condition: "Costs are not offset",
        rationale: "Operating costs may reduce measured performance.",
        intermediate_movement: "Higher compliance costs", horizon: null }],
      missing_assumption: null,
    },
    evidence_need: "Whether covered firms actually spent staff time on reporting.",
    terms: ["reporting duty", "operating cost"],
  }],
  open_xy_terms: ["participation rule", "firm performance"],
  challenge_terms: ["market reporting", "resource costs"],
  qualification: "The proposed cost pathway is a hypothesis, not an observed effect.",
};

type BridgePath = "mcp-app" | "chatgpt-compatibility";
type Action = "personalize_screen3_advice" |
  "analyze_study_first_events" | "advance_study_first_mechanism_job" |
  "personalize_screen6_plan";

function screen4Wire(body: unknown) {
  const envelope = body as { input: Array<{ content: Array<{ text: string }> }> };
  const packet = JSON.parse(envelope.input[0]!.content[0]!.text) as {
    events: Array<{ slot_id: string }>;
  };
  return {
    assessments: Object.fromEntries(packet.events.map((event) => [
      event.slot_id,
      {
        what_it_is:
          "An official source documents a change in market reporting.",
        why_it_may_matter:
          "If sampled firms undertake the affected activity, reporting costs could reach measured performance.",
      what_to_check_next: "Match the dated rule to each sampled firm's reporting activity.",
      },
    ])),
  };
}

function controlledScreen4Source(request: RequestInfo | URL) {
  const url = String(request);
  if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(url)) {
    return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }), {
      headers: { "content-type": "application/json" },
    });
  }
  if (url.includes("/api/v1/documents")) {
    return new Response(JSON.stringify({ count: 1, results: [{
      document_number: "2021-12340",
      title: "Market reporting requirements final rule",
      type: "Rule", action: "Final rule.",
      abstract: "The agency changed reporting requirements for covered energy firms.",
      excerpts: ["Covered energy firms must publish specified market reports."],
      html_url:
        "https://www.federalregister.gov/documents/2021/05/10/2021-12340/example",
      raw_text_url:
        "https://www.federalregister.gov/documents/full_text/html/2021/05/10/2021-12340.html",
      publication_date: "2021-05-10", effective_on: "2021-06-10",
      agencies: [{ name: "Official fixture agency" }],
    }] }), { headers: { "content-type": "application/json" } });
  }
  if (url.includes("federalregister.gov")) {
    return new Response("<!doctype html><main><p>Covered energy firms must publish specified market reports. The rule is effective June 10, 2021.</p></main>", {
      headers: { "content-type": "text/html" },
    });
  }
  return new Response("Controlled unavailable source", { status: 503 });
}

/** The MCP server completes the mutation; only delivery to the UI is lost. */
async function harness(action: Action, bridgePath: BridgePath) {
  const state = action === "personalize_screen3_advice"
    ? screen3State()
    : action === "analyze_study_first_events"
      ? screen3State()
    : action === "advance_study_first_mechanism_job"
      ? screen5State()
    : openScreen6(createBrowserEventCardFixture().state, {
      expectedRevision: createBrowserEventCardFixture().state.revision,
      openedAt: at(40),
    }).state;
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({ state, accessToken,
    createInputFingerprint: fingerprintSixScreenValue(`lost-${action}`),
    createdAt, expiresAt: "2026-09-26T12:00:00.000Z" });
  const sourceFetch = vi.fn(async (request: RequestInfo | URL) => {
    if (action === "analyze_study_first_events") {
      return controlledScreen4Source(request);
    }
    throw new Error("Saved policy evidence needs no source call.");
  });
  const providerFetch = vi.fn(async (_request: RequestInfo | URL,
    init?: RequestInit) => response(
      action === "personalize_screen3_advice" ? screen3Wire(state as
        ReturnType<typeof screen3State>) :
        action === "analyze_study_first_events"
          ? screen4Wire(JSON.parse(String(init?.body))) :
          action === "advance_study_first_mechanism_job"
            ? screen5PlanWire : screen6Wire(state),
      `resp_${action}`,
    ));
  let clock = Date.parse("2026-09-24T12:00:00.000Z");
  const runtime = new SixScreenWorkflowRuntime({
    store, signingKey: "lost-delivery-test-key-more-than-thirty-two-bytes",
    now: () => new Date(clock++).toISOString(),
    fetch: sourceFetch,
    taskStore: new SixScreenResearchTaskStore(storage),
    evidenceStore: new SixScreenEvidenceStore(storage),
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "controlled-key-never-projected",
    screen5OpenAIFetch: providerFetch,
    screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
  });
  const server = new McpServer({ name: "lost-delivery", version: "1.0.0" });
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });

  let dropped = false;
  const deliveredCall = vi.fn(async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    if (!dropped && name === mutateTool &&
      (args.mutation as Record<string, unknown>)?.action === action) {
      dropped = true;
      throw new Error("Controlled final tool delivery lost after durable commit");
    }
    return result;
  });
  const bridge = new SixScreenBridge();
  if (bridgePath === "mcp-app") {
    (bridge as unknown as { app: Record<string, unknown> }).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool: ({ name, arguments: args }: {
        name: string; arguments: Record<string, unknown>;
      }) => deliveredCall(name, args),
    };
  } else {
    vi.stubGlobal("window", { openai: {
      callTool: (name: string, args: Record<string, unknown>) =>
        deliveredCall(name, args),
    } });
  }
  const read = async () => restoreSixScreenWorkflowToolResponse(
    await bridge.callToolWithMetadata(getTool, authentication));
  if (action === "analyze_study_first_events") {
    const initial = await read();
    let opened = restoreSixScreenWorkflowToolResponse(
      await bridge.callToolWithMetadata(mutateTool, {
        ...authentication, mutation: {
          action: "open_screen_4", expectedRevision: initial.snapshot.revision,
          operationId: "delivery-fixture-open-screen4",
        },
      }));
    let investigation = opened.snapshot.state.studyFirstEventInvestigations
      ?.at(-1);
    let resumeOrdinal = 0;
    while (!investigation?.presentation && resumeOrdinal < 20) {
      const sourceCallsBefore = sourceFetch.mock.calls.length;
      opened = restoreSixScreenWorkflowToolResponse(
        await bridge.callToolWithMetadata(mutateTool, {
          ...authentication, mutation: {
            action: "open_screen_4",
            expectedRevision: opened.snapshot.revision,
            operationId: `delivery-fixture-resume-screen4-${resumeOrdinal}`,
          },
        }));
      const sourceCallsAfter = sourceFetch.mock.calls.length;
      expect(sourceCallsAfter - sourceCallsBefore).toBeLessThanOrEqual(1);
      expect(providerFetch).not.toHaveBeenCalled();
      investigation = opened.snapshot.state.studyFirstEventInvestigations
        ?.at(-1);
      resumeOrdinal += 1;
    }
    expect(investigation?.presentation?.visibleEventIds.length)
      .toBeGreaterThan(0);
  } else if (action === "advance_study_first_mechanism_job") {
    const initial = await read();
    const compared = restoreSixScreenWorkflowToolResponse(
      await bridge.callToolWithMetadata(mutateTool, {
        ...authentication, mutation: {
          action: "compare_study_first_mechanisms",
          expectedRevision: initial.snapshot.revision,
          operationId: "delivery-fixture-save-focal-mechanism",
          theoreticalPerspective: "Resource dependence",
          proposedMechanism:
            "The participation rule changes firms' market access and operating activity.",
        },
      }));
    const execution = compared.snapshot.state.studyFirstMechanismRuns?.at(-1)
      ?.providerExecution;
    expect(execution?.executionFingerprint).toBeDefined();
    const authorized = restoreSixScreenWorkflowToolResponse(
      await bridge.callToolWithMetadata(mutateTool, {
        ...authentication, mutation: {
          action: "authorize_study_first_mechanism_job",
          expectedRevision: compared.snapshot.revision,
          operationId: "delivery-fixture-authorize-plan",
          expectedExecutionFingerprint: execution!.executionFingerprint,
        },
      }));
    expect(authorized.snapshot.state.studyFirstMechanismRuns?.at(-1)
      ?.providerExecution?.authorization).toBeTruthy();
    expect(providerFetch).not.toHaveBeenCalled();
  }
  return { action, read, bridge, providerFetch, sourceFetch, deliveredCall };
}

describe("registered analysis tool and host bridge after lost final delivery", () => {
  it.each([
    ["personalize_screen3_advice", "mcp-app"],
    ["personalize_screen3_advice", "chatgpt-compatibility"],
    ["analyze_study_first_events", "mcp-app"],
    ["analyze_study_first_events", "chatgpt-compatibility"],
    ["advance_study_first_mechanism_job", "mcp-app"],
    ["advance_study_first_mechanism_job", "chatgpt-compatibility"],
    ["personalize_screen6_plan", "mcp-app"],
    ["personalize_screen6_plan", "chatgpt-compatibility"],
  ] as const)("restores saved %s output over %s without another call", async (
    action, path,
  ) => {
    const target = await harness(action, path);
    const before = await target.read();
    const mutation = action === "personalize_screen3_advice"
      ? { action, expectedRevision: before.snapshot.revision,
        operationId: `lost-delivery-${action}`,
        expectedAdviceFingerprint: before.snapshot.state
          .studyDesignAdvices!.at(-1)!.adviceFingerprint }
      : action === "analyze_study_first_events"
        ? { action, expectedRevision: before.snapshot.revision,
          operationId: `lost-delivery-${action}`,
          expectedInvestigationFingerprint: before.snapshot.state
            .studyFirstEventInvestigations!.at(-1)!.investigationFingerprint }
      : action === "advance_study_first_mechanism_job"
        ? { action, expectedRevision: before.snapshot.revision,
          operationId: `lost-delivery-${action}`, retry: false }
      : { action, expectedRevision: before.snapshot.revision,
        operationId: `lost-delivery-${action}`,
        expectedPlanFingerprint: createScreen6CurrentPlan(before.snapshot.state)
          .inputFingerprint };
    await expect(target.bridge.callToolWithMetadata(mutateTool, {
      ...authentication, mutation,
    })).rejects.toEqual(expect.objectContaining({
      name: "SixScreenWorkflowProblemError",
      message: "The workflow response was interrupted; the action may already be saved.",
      problem: expect.objectContaining({
        code: "delivery_failure",
        stage: "host_delivery",
        action,
        recovery: "check_status",
        safeCauseCodes: ["delivery_interrupted"],
      }),
    } satisfies Partial<SixScreenWorkflowProblemError>));
    const providerCallsAfterAnalysis = target.providerFetch.mock.calls.length;
    expect(providerCallsAfterAnalysis).toBeGreaterThan(0);
    const recovered = await target.read();
    expect(recovered.snapshot.revision).toBeGreaterThan(before.snapshot.revision);
    expect(analysisArtifactRecovered(before.snapshot, recovered.snapshot, mutation))
      .toBe(true);
    if (action === "personalize_screen3_advice") {
      const saved = recovered.snapshot.state.screen3Contextualizations?.at(-1);
      expect(saved).toMatchObject({ status: "completed" });
      const concerns = (saved?.supplement as { concerns: Array<{
        issue_id: string; specific_heading: string;
        relevant_fact_or_proposal: string }> }).concerns;
      expect(concerns).toHaveLength(6);
      expect(concerns[0]).toMatchObject({
        issue_id: "treatment_year_fit",
        specific_heading: "Treatment-year fit",
        relevant_fact_or_proposal: expect.stringContaining("covered market"),
      });
    } else if (action === "analyze_study_first_events") {
      expect(recovered.snapshot.state.screen4InterpretationAttempts?.at(-1))
        .toMatchObject({ status: "completed", result: {
          event_assessments: expect.arrayContaining([
            expect.objectContaining({ event_id: expect.any(String) }),
          ]),
        } });
    } else if (action === "advance_study_first_mechanism_job") {
      expect(recovered.snapshot.state.studyFirstMechanismRuns?.at(-1))
        .toMatchObject({ planning: { status: "completed", plan: {
          candidates: [expect.objectContaining({
            id: "implementation-costs",
          })],
        } } });
    } else {
      expect(recovered.snapshot.state.screen6Personalizations?.at(-1))
        .toMatchObject({ status: "completed", supplement: {
          dimension_summaries: expect.arrayContaining([
            expect.objectContaining({ next_check: expect.any(String) }),
          ]),
        } });
    }
    const sourceCallsAfterAnalysis = target.sourceFetch.mock.calls.length;
    const navigated = restoreSixScreenWorkflowToolResponse(
      await target.bridge.callToolWithMetadata(mutateTool, {
        ...authentication, mutation: {
          action: "open_screen_2",
          expectedRevision: recovered.snapshot.revision,
          operationId: `navigate-after-recovery-${action}`,
        },
      }));
    expect(navigated.snapshot.state.activeScreen).toBe(2);
    expect(navigated.snapshot.state.studyFirstMechanismRuns)
      .toEqual(recovered.snapshot.state.studyFirstMechanismRuns);
    expect(target.providerFetch).toHaveBeenCalledTimes(
      providerCallsAfterAnalysis,
    );
    expect(target.sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterAnalysis);
    const reopened = await target.read();
    expect(reopened.snapshot.stateFingerprint)
      .toBe(navigated.snapshot.stateFingerprint);
    if (action === "personalize_screen3_advice") {
      expect(reopened.snapshot.state.screen3Contextualizations)
        .toEqual(recovered.snapshot.state.screen3Contextualizations);
    } else if (action === "analyze_study_first_events") {
      expect(reopened.snapshot.state.screen4InterpretationAttempts)
        .toEqual(recovered.snapshot.state.screen4InterpretationAttempts);
    } else if (action === "advance_study_first_mechanism_job") {
      expect(reopened.snapshot.state.studyFirstMechanismRuns)
        .toEqual(recovered.snapshot.state.studyFirstMechanismRuns);
    } else {
      expect(reopened.snapshot.state.screen6Personalizations)
        .toEqual(recovered.snapshot.state.screen6Personalizations);
    }
    expect(target.providerFetch).toHaveBeenCalledTimes(
      providerCallsAfterAnalysis,
    );
    if (action !== "analyze_study_first_events") {
      expect(target.sourceFetch).not.toHaveBeenCalled();
    }
    expect(target.deliveredCall.mock.calls.filter(([name]) => name === getTool))
      .toHaveLength(action === "analyze_study_first_events" ||
        action === "advance_study_first_mechanism_job" ? 4 : 3);
  });
});
