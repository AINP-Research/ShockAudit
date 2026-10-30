import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { sixScreenWorkflowMutationRequestBinding } from "../../src/core/six-screen/workflow-response-contract";
import { screen5SetupRecovered } from "../../src/ui/six-screen/screen5-recovery";
import { analysisArtifactRecovered, screen3AssessmentMutation } from "../../src/ui/six-screen/SixScreenApp";
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { stressStudies } from "../fixtures/stress/studies";
import type { ProposedTreatmentTimingInput } from "../../src/core/six-screen/study-design-advice";
import { StudyDesignAdvicePanel, StudyFirstEventInvestigationPanel, StudyFirstMechanismPanel } from "../../src/ui/six-screen/SixScreenApp";
import { Screen6CurrentPlanPanel } from "../../src/ui/six-screen/Screen6CurrentPlanPanel";
import { createScreen6CurrentPlan } from "../../src/core/six-screen/screen6-current-plan";
import { createScreen6DesignMapProjection } from "../../src/core/six-screen/screen6-design-map";
import { createCompleteReport } from "../../src/ui/six-screen/complete-report-data";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen5OpenAIExecution } from
  "../../src/core/six-screen/screen5-mechanism";
import { createStudyFirstMechanismRun } from
  "../../src/core/six-screen/study-first-mechanism-comparison";
import {
  currentStudyFirstMechanismInputForState,
  currentStudyFirstMechanismRunForState,
  openScreen3,
  openScreen4,
  openScreen5,
  updateStudyContext,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
  sixScreenWorkflowStoreParentRecordKey,
  type SixScreenWorkflowStoreRecord,
} from "../../src/worker/six-screen-workflow-store";
import { SCREEN5_OPENAI_LEDGER_STORAGE_KEY, Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { screen5OpenAIInferenceFetch } from "../../src/worker/server";
import { SCREEN3_CONTEXTUALIZER_VERSION, SCREEN3_DESIGN_DIMENSIONS } from
  "../../src/worker/screen3-contextualizer";
import { registerSixScreenWorkflowTools, validateSixScreenWorkflowProjection } from
  "../../src/worker/six-screen-tools";
import { restoreSixScreenWorkflowToolResponse } from
  "../../src/ui/six-screen/workflow-response";
import {
  SCREEN5_OPENAI_RESPONSES_URL,
  Screen5OpenAITransportError,
} from
  "../../src/worker/screen5-openai-transport";
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
  period: { start: "2010", end: "2022" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection increases",
  initialExplanation: "Through increased customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

const testCitation = {
  authors: ["Synthetic Test Author"], year: 2024, title: "Synthetic mechanism fixture",
  venue: "Synthetic Test Journal", volume: null, issue: null, pages: null,
  doi: null, url: null, full_citation: "Synthetic Test Author (2024). Synthetic mechanism fixture. Synthetic Test Journal.",
  supports: "Synthetic evidence for contract tests only.",
};
const planWire = {
  focal_citations: [testCitation],
  candidates: [
    {
      citations: [testCitation],
      candidate_id: "cost-reallocation",
      concept: "Compliance-resource reallocation",
      chain: ["New duties", "Staff effort", "Operating costs"],
      difference: "Costs can change without customer trust.",
      condition: "Compliance implementation requires material staff effort.",
      direction: {
        mode: "single_hypothesis",
        target_outcome: "Firm performance",
        target_measure: "Return on assets",
        scenarios: [{ sign: "negative", condition: "Costs are not offset", rationale: "Additional operating costs may reduce firm performance.", intermediate_movement: "Higher operating costs", horizon: null }],
        missing_assumption: null,
      },
      evidence_need: "Whether privacy obligations increase firm operating effort.",
      terms: ["privacy regulation", "compliance cost"],
    },
    {
      citations: [testCitation],
      candidate_id: "data-use-adjustment",
      concept: "Data-use adjustment",
      chain: ["Consumer choices", "Data access", "Customer acquisition"],
      difference: "Data access can change acquisition without trust.",
      condition: "Customer choices materially constrain usable data.",
      direction: {
        mode: "conditional_scenarios",
        target_outcome: "Firm performance",
        target_measure: "Return on assets",
        scenarios: [
          { sign: "negative", condition: "Targeting weakens", rationale: "Less precise targeting could reduce sales.", intermediate_movement: "Less effective acquisition", horizon: null },
          { sign: "positive", condition: "Privacy preferences attract customers", rationale: "Higher acquisition could improve performance.", intermediate_movement: "More effective acquisition", horizon: null },
        ],
        missing_assumption: null,
      },
      evidence_need: "Whether privacy choice changes data access and acquisition.",
      terms: ["consumer privacy", "data access", "customer acquisition"],
    },
  ],
  open_xy_terms: ["customer protection", "firm performance"],
  challenge_terms: ["privacy regulation", "boundary condition"],
  qualification: "The policy-to-construct link remains proposed.",
};

const comparisonWire = {
  mechanisms: [
    {
      candidate_id: "m0",
      concept: "Customer trust",
      relation: "focal",
      chain: ["Privacy controls", "Perceived protection", "Retention", "Performance"],
      direction: {
        mechanism_response: "increase",
        outcome_implication: "uncertain",
        basis: "researcher_proposed",
        condition: "Customers notice and value the controls.",
      },
      argument: [{
        text: "The focal process proposes that perceived protection changes customer retention.",
        evidence_ids: [],
        basis: "analytical_hypothesis",
      }],
      fit: "It matches the researcher's firm-level customer pathway.",
      limit: "Suggested literature is unverified and does not establish this pathway in the study sample.",
      theory: null,
      theory_basis: "not_assigned",
    },
  ],
  row_definitions: [{
    row_id: "privacy-costs",
    observation: "Privacy-related staffing and operating cost",
    measure: "Dated privacy hiring and cost records",
    level: "Firm-year",
    timing: "Near the proposed adjustment year",
    caution: "Shared changes in other operating costs would not distinguish the pathways.",
  }],
  cells: [
    {
      row_id: "privacy-costs",
      candidate_id: "m0",
      status: "not_distinguishing",
      text: "No unique increase is required by the trust pathway.",
      evidence_ids: [],
    },
  ],
  dispositions: [
    {
      candidate_id: "cost-reallocation",
      status: "unassessed_evidence",
      reason: "It is substantively distinct, but no admitted inspected source supports a proposition on this pathway.",
      merged_into: null,
    },
    {
      candidate_id: "data-use-adjustment",
      status: "excluded",
      reason: "The bounded packet did not establish study fit.",
      merged_into: null,
    },
  ],
  summary: "Trust and resource reallocation can coexist and require intermediate outcomes to distinguish.",
  gaps: ["Direct CCPA evidence for the proposed firms remains absent."],
};

function publicSourceResponse(url: string) {
  if (url.includes("api.openalex.org")) {
    return new Response(JSON.stringify({
      meta: { count: 1 },
      results: [{
        id: "https://openalex.org/W1234567890",
        doi: "https://doi.org/10.1234/OPENAI.1",
        display_name: "Privacy controls and customer trust",
        authorships: [{ author: { display_name: "Ada Researcher" } }],
        publication_year: 2022,
        publication_date: "2022-01-01",
        primary_location: {
          is_oa: true,
          landing_page_url: "https://journal.example/openai",
          pdf_url: null,
          version: "publishedVersion",
          license: "cc-by",
          source: {
            display_name: "Journal of Privacy Research",
            type: "journal",
            host_organization_name: "Research Publisher",
          },
        },
        best_oa_location: null,
        type: "article",
        language: "en",
        is_retracted: false,
        abstract_inverted_index: {
          Privacy: [0], controls: [1], may: [2], increase: [3],
          customer: [4], trust: [5], and: [6], retention: [7],
        },
        content_urls: { pdf: null, grobid_xml: null },
      }],
    }), { headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({
    message: { items: [{
      DOI: "10.1234/openai.1",
      title: ["Privacy controls and customer trust"],
      author: [{ given: "Ada", family: "Researcher" }],
      publisher: "Research Publisher",
      "container-title": ["Journal of Privacy Research"],
      "published-online": { "date-parts": [[2022, 1, 1]] },
      type: "journal-article",
      URL: "https://doi.org/10.1234/openai.1",
      abstract:
        "<jats:p>Privacy controls may increase customer trust and retention.</jats:p>",
    }] },
  }), { headers: { "content-type": "application/json" } });
}

async function storedReadyScreen5(label: string, scenarioStudy: StudyContextDraft = study,
  scenarioTiming: ProposedTreatmentTimingInput = { mode: "year", year: 2020, milestoneReference: null }) {
  const fixture = createBrowserEventCardFixture();
  const screen3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: scenarioStudy,
    proposedTiming: scenarioTiming,
    openedAt: "2026-09-21T20:00:00.000Z",
  });
  const screen4 = openScreen4(screen3.state, {
    expectedRevision: screen3.state.revision,
    openedAt: "2026-09-21T20:00:01.000Z",
  });
  const screen5 = openScreen5(screen4.state, {
    expectedRevision: screen4.state.revision,
    openedAt: "2026-09-21T20:00:02.000Z",
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: screen5.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue(label),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-23T00:00:00.000Z",
  });
  return { screen5: screen5.state, storage, store };
}

function successfulProviderResponse(input: {
  content: unknown;
  promptTokens: number;
  completionTokens: number;
  requestId: string;
}) {
  return new Response(JSON.stringify({
    id: `resp_${input.requestId}`,
    object: "response",
    status: "completed",
    model: "gpt-6-luna",
    service_tier: "default",
    output: [{
      id: `msg_${input.requestId}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{
        type: "output_text",
        annotations: [],
        text: JSON.stringify(input.content),
      }],
    }],
    usage: {
      input_tokens: input.promptTokens,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: input.completionTokens,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: input.promptTokens + input.completionTokens,
    },
  }), {
    headers: {
      "content-type": "application/json",
      "x-request-id": input.requestId,
      "x-ratelimit-reset-tokens": "1s",
      "x-ratelimit-remaining-tokens": "1000",
    },
  });
}

function authorizationForCompare(
  operationId: string,
  authorizationId = `test-ticket-${operationId}`,
) {
  return {
    authorizationId,
    jobId: `screen5-openai-job-${fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    )}`,
    stages: ["planning", "assessment"] as Array<
      "planning" | "assessment"
    >,
  };
}

describe("durable direct-provider Screen 5 runtime", () => {
  it.each(stressStudies)("stress: $id preserves varied study fields, mechanisms and reports after navigation", async (scenario) => {
    const { screen5, storage, store } = await storedReadyScreen5(`matrix-${scenario.id}`, scenario.study, scenario.timing);
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => new Date(clock += 1_000).toISOString();
    const plan = structuredClone(planWire);
    for (const candidate of plan.candidates) {
      candidate.direction.target_outcome = scenario.study.outcome!;
      candidate.direction.target_measure = scenario.study.outcomeMeasure!;
    }
    const comparison = structuredClone(comparisonWire);
    comparison.row_definitions[0]!.level = scenario.study.analysisUnit!;
    const providerFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => successfulProviderResponse({
      content: JSON.parse(String(init?.body)).text.format.name === "mechanism_plan_v4_with_citations" ? plan : comparison,
      promptTokens: 1_000, completionTokens: 600, requestId: `controlled-${scenario.id}`,
    }));
    const sourceFetch = vi.fn(async () => { throw new Error("Controlled matrix: no external retrieval."); });
    const operationId = `matrix-compare-${scenario.id}`;
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({ store, signingKey: "matrix-test-key-with-more-than-thirty-two-bytes", now,
      fetch: sourceFetch, screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "synthetic-key-never-sent",
      screen5OpenAIFetch: providerFetch, screen5OpenAILedgerStore: ledger,
      screen5OpenAIAuthorization: authorizationForCompare(operationId) });
    const auth = { runId, accessToken };
    let result = await runtime.compareStudyFirstMechanisms(auth, { expectedRevision: screen5.revision, operationId,
      theoreticalPerspective: null, proposedMechanism: scenario.study.initialExplanation! });
    for (const stage of ["plan", "evidence", "assessment"]) {
      const due = result.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.nextEligibleAt;
      if (due) clock = Math.max(clock, Date.parse(due) + 1_000);
      result = await runtime.advanceStudyFirstMechanismJob(auth, { expectedRevision: result.privateSnapshot.revision,
        operationId: `matrix-${scenario.id}-${stage}`, retry: false });
      validateSixScreenWorkflowProjection(result.projection);
    }
    expect(result.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.phase,
      JSON.stringify(result.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.lastError)).toBe("completed");
    const stableRun = result.projection.studyFirstMechanismWorkspace.currentRun!.runFingerprint;
    for (const [visit, screen] of [6, 2, 3, 5, 6].entries()) {
      const input = { expectedRevision: result.privateSnapshot.revision, operationId: `matrix-${scenario.id}-visit-${visit}-${screen}` };
      result = screen === 6 ? await runtime.openScreen6(auth, input) : screen === 2 ? await runtime.openScreen2(auth, input)
        : screen === 3 ? await runtime.openScreen3(auth, { ...input, study: scenario.study, proposedTiming: scenario.timing })
        : await runtime.openScreen5(auth, input);
      validateSixScreenWorkflowProjection(result.projection);
      expect(result.privateSnapshot.state.activeScreen).toBe(screen);
    }
    expect(result.projection.studyFirstMechanismWorkspace.currentRun!.runFingerprint).toBe(stableRun);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(await ledger.summary()).toMatchObject({ policyMode: "unlimited", attemptsSettled: 2, tokensHeld: 0 });
    expect(sourceFetch).not.toHaveBeenCalled();
    const state = result.privateSnapshot.state, projection = result.projection;
    // intendedConstruct is a frozen legacy field, not a current study input.
    for (const [key, value] of Object.entries(scenario.study).filter(([key])=>key!=="intendedConstruct")) expect(state.study[key as keyof typeof state.study]).toEqual(value);
    expect(state.study.intendedConstruct).toBe(screen5.study.intendedConstruct);
    const currentPlan = createScreen6CurrentPlan(state), designMap = createScreen6DesignMapProjection(currentPlan);
    const report = createCompleteReport({state,plan:currentPlan,designMap,generatedAt:now()});
    const html = [
      renderToStaticMarkup(createElement(StudyDesignAdvicePanel, {workspace:projection.causalComparisonWorkspace.studyFirst,
        policyReview:state.policyReview,disabled:false,onDecide:()=>{},onEdit:()=>{}})),
      renderToStaticMarkup(createElement(StudyFirstEventInvestigationPanel, {workspace:projection.studyFirstEventInvestigationWorkspace})),
      renderToStaticMarkup(createElement(StudyFirstMechanismPanel, {workspace:projection.studyFirstMechanismWorkspace,
        study:state.study,context:null,onCompare:()=>{}})),
      renderToStaticMarkup(createElement(Screen6CurrentPlanPanel, {plan:currentPlan,workflowState:state})),
    ];
    for (const page of html) { expect(page.length).toBeGreaterThan(500); expect(page).not.toContain("[object Object]"); }
    expect(html[0]).not.toContain("Suggested models");
    expect(html[0]).toContain("Conditional method guidance");
    expect(JSON.stringify(report)).not.toContain("Suggested models");
    expect(html[2]).toContain(scenario.study.outcome!);
    expect(html[3]).toContain("Create PDF"); expect(html[3]).toContain("Create Word");
    const reportText=JSON.stringify(report.sections);
    expect(reportText).toContain(scenario.study.outcomeMeasure!);
    expect(reportText).toContain(scenario.study.initialExplanation!);
    if (process.env.SHOCKAUDIT_STRESS_QA_DIR) {
      const root=process.env.SHOCKAUDIT_STRESS_QA_DIR; mkdirSync(root,{recursive:true});
      report.title = `${scenario.shock} — controlled stress-test report`;
      writeFileSync(`${root}/${scenario.id}.json`,JSON.stringify(report,null,2));
      writeFileSync(`${root}/${scenario.id}-state.json`,JSON.stringify(state,null,2));
      html.forEach((page,i)=>writeFileSync(`${root}/${scenario.id}-screen${i+3}.html`,page));
    }
  }, 60_000);
  it("reserves two independent Screen 3 attempts for distinct runs with identical science", async () => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision, study,
      proposedTiming: { mode: "year", year: 2020,
        milestoneReference: null },
      openedAt: "2026-09-21T20:00:00.000Z",
    });
    const secondRunId = `sa6r_${"c".repeat(43)}`;
    const secondState = structuredClone(opened.state);
    secondState.runId = secondRunId;
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: opened.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("first-run"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    await store.create({ state: secondState, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("second-run"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    const adviceFingerprint = opened.state.studyDesignAdvices!.at(-1)!
      .adviceFingerprint;
    expect(secondState.studyDesignAdvices!.at(-1)!.adviceFingerprint)
      .toBe(adviceFingerprint);
    const providerFetch = vi.fn(async () => new Response(JSON.stringify({
      error: { code: "rate_limit_exceeded", message: "Synthetic known rejection." },
    }), { status: 429,
      headers: { "content-type": "application/json" } }));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "cross-run-screen3-ledger-test-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger });
    const first = await runtime.personalizeScreen3({ runId, accessToken }, {
      expectedRevision: opened.state.revision,
      operationId: "screen3-first-run", expectedAdviceFingerprint: adviceFingerprint,
    });
    const second = await runtime.personalizeScreen3({
      runId: secondRunId, accessToken }, {
      expectedRevision: secondState.revision,
      operationId: "screen3-second-run", expectedAdviceFingerprint: adviceFingerprint,
    });
    const firstRecord = first.privateSnapshot.state.screen3Contextualizations!.at(-1)!;
    const secondRecord = second.privateSnapshot.state.screen3Contextualizations!.at(-1)!;
    expect(firstRecord.status).toBe("failed");
    expect(secondRecord.status).toBe("failed");
    expect(firstRecord.reservationId).not.toBe(secondRecord.reservationId);
    expect(firstRecord.id).not.toBe(secondRecord.id);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2, attemptsHeld: 2, attemptsSettled: 0,
      tokensHeld: 96_000, remainingAttempts: 800,
    });
  });

  it("retries a known Screen 3 HTTP rejection only after another explicit authorization", async () => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision, study,
      proposedTiming: { mode: "year", year: 2020,
        milestoneReference: null },
      openedAt: "2026-09-21T20:00:00.000Z",
    });
    const advice = opened.state.studyDesignAdvices!.at(-1)!;
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: opened.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("known-screen3-rejection"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    const wire = {
      schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
      concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension, index) => ({
        issue_id: dimension.id,
        specific_heading: dimension.heading,
        status_label: index === 0 ? "Treatment clock needs review" :
          "Requires design evidence",
        relevant_fact_or_proposal:
          `The proposed groups and saved study supply inputs for ${dimension.heading.toLowerCase()}.`,
        why_it_matters: "This condition can change the interpretation of the proposed comparison.",
        unresolved_question: "What does the firm-level evidence show?",
        next_check: "Map dated firm activities and group-period records to the saved rule.",
        check_limit: "This does not establish comparable untreated trends.",
        priority: index < 2 ? "high" as const : "medium" as const,
        priority_reason: "The group split depends on this condition.",
        documentary_claim_ids: [],
        researcher_input_fields: ["proposedTreatment"],
      })),
      synthesis_limit: "The stated groups alone do not prove comparable outcomes.",
    };
    const providerFetch = vi.fn(async () => providerFetch.mock.calls.length === 1
      ? new Response(JSON.stringify({ error: {
          code: "rate_limit_exceeded", message: "Synthetic known rejection." },
        }), { status: 429,
          headers: { "content-type": "application/json" } })
      : successfulProviderResponse({ content: wire,
          promptTokens: 1_600, completionTokens: 500,
          requestId: "screen3-explicit-second-attempt" }));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen3-known-rejection-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch, screen5OpenAILedgerStore: ledger });
    const authentication = { runId, accessToken };
    const firstInput = { expectedRevision: opened.state.revision,
      operationId: "screen3-known-rejection-first",
      expectedAdviceFingerprint: advice.adviceFingerprint };
    const first = await runtime.personalizeScreen3(authentication, firstInput);
    expect(first.projection.causalComparisonWorkspace.studyFirst.contextualization)
      .toMatchObject({ status: "failed", retryEligibility: "new_request",
        dispatchState: "dispatched", failureCode: "openai_rate_limited",
        failureStage: "response_headers" });
    const rejected = first.privateSnapshot.state.screen3Contextualizations!.at(-1)!;
    expect(rejected).toMatchObject({ status: "failed",
      dispatchState: "dispatched", failureCode: "openai_rate_limited",
      failureStage: "response_headers",
      receipt: null, attemptOrdinal: 1 });
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const replay = await runtime.personalizeScreen3(authentication, firstInput);
    expect(replay.privateSnapshot.revision).toBe(first.privateSnapshot.revision);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(replay.privateSnapshot.state.screen3Contextualizations).toHaveLength(1);

    const second = await runtime.personalizeScreen3(authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen3-known-rejection-explicit-second",
      expectedAdviceFingerprint: advice.adviceFingerprint,
    });
    const records = second.privateSnapshot.state.screen3Contextualizations!;
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ status: "failed",
      dispatchState: "dispatched", receipt: null, attemptOrdinal: 1 });
    expect(records[1]).toMatchObject({ status: "completed",
      dispatchState: "dispatched", supplement: wire, attemptOrdinal: 2 });
    expect(records[1]!.reservationId).not.toBe(records[0]!.reservationId);
    expect(records[1]!.id).not.toBe(records[0]!.id);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2, attemptsSettled: 1, attemptsHeld: 1,
      tokensConsumed: 2_100, tokensHeld: 48_000,
    });
    const readOnly = await runtime.status(authentication);
    expect(readOnly.projection.causalComparisonWorkspace.studyFirst.contextualization)
      .toMatchObject({ status: "completed", retryEligibility: "none" });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1, 2])("normalizes and delivers all six Screen 3 cards after %i interrupted artifact saves", async (interruptions) => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision, study,
      proposedTiming: { mode: "year", year: 2020,
        milestoneReference: null },
      openedAt: "2026-09-21T20:00:00.000Z",
    });
    const advice = opened.state.studyDesignAdvices!.at(-1)!;
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: opened.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue(
        "screen3-validation-failure-contract",
      ),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    const recoverableWire = {
      schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
      concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension) => ({
        issue_id: dimension.id,
        specific_heading: dimension.heading,
        status_label: "Requires design evidence",
        relevant_fact_or_proposal:
          `The saved proposal supplies inputs for ${dimension.heading.toLowerCase()}.`,
        why_it_matters: "x".repeat(751),
        unresolved_question: "What does the firm-level evidence show?",
        next_check: "Map firm and period records to the saved assignment rule.",
        check_limit: "This does not establish comparable untreated trends.",
        priority: "medium" as const,
        priority_reason: "The comparison depends on this condition.",
        documentary_claim_ids: [],
        researcher_input_fields: ["proposedTreatment", "proposedTreatment"],
      })).reverse(),
      synthesis_limit:
        "The stated groups alone do not prove comparable untreated outcomes.",
    };
    const providerFetch = vi.fn(async () => successfulProviderResponse({
      content: recoverableWire,
      promptTokens: 1_600,
      completionTokens: 900,
      requestId: "screen3-invalid-bounded-output",
    }));
    const put = storage.put.bind(storage);
    let interruptedSaves = 0;
    const durableValueLimit = 2 * 1024 * 1024;
    let enforceDurableValueLimit = false;
    vi.spyOn(storage, "put").mockImplementation(async (key, value) => {
      const record = value as { state?: { screen3Contextualizations?:
        Array<{ status: string }> } };
      if (key === sixScreenWorkflowStoreParentRecordKey(runId) &&
          record.state?.screen3Contextualizations?.at(-1)?.status === "completed" &&
          interruptedSaves < interruptions) {
        interruptedSaves += 1;
        throw new Error("Synthetic interrupted assessment save.");
      }
      if (enforceDurableValueLimit &&
          key === sixScreenWorkflowStoreParentRecordKey(runId) &&
          new TextEncoder().encode(key + JSON.stringify(value)).byteLength >
            durableValueLimit) {
        throw new Error("Synthetic Durable Object value-size limit.");
      }
      return put(key, value);
    });
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen3-validation-contract-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage) });
    const server = new McpServer({
      name: "screen3-validation-contract", version: "1.0.0",
    });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({
      name: "screen3-validation-contract", version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    let response = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: { runId, accessToken, mutation: {
        action: "personalize_screen3_advice",
        expectedRevision: opened.state.revision,
        operationId: "screen3-invalid-bounded-output",
        expectedAdviceFingerprint: advice.adviceFingerprint,
      } },
    });
    expect(response.isError, JSON.stringify(response)).not.toBe(true);
    if (interruptions === 2) {
      expect(response.structuredContent).toMatchObject({
        causalComparisonWorkspace: { studyFirst: { contextualization: {
          status: "receipt_saved", retryEligibility: "local_revalidation",
          failureCode: "local_artifact_completion_pending",
          failureStage: "persistence", supplement: null,
        } } },
      });
      const saved = await runtime.status({ runId, accessToken });
      const receipt = saved.privateSnapshot.state.screen3Contextualizations!.at(-1)!.receipt;
      expect(receipt?.finalContent).toBe(JSON.stringify(recoverableWire));
      // Model the production record shape that became stuck: older state-only
      // operations retained full public projections in the replay journal.
      // The current record still fits, but one more replay crosses the Durable
      // Object key/value limit unless those redundant projections are removed.
      const parentKey = sixScreenWorkflowStoreParentRecordKey(runId);
      const nearLimit = await storage.get(parentKey) as
        SixScreenWorkflowStoreRecord;
      const legacyProjectionResult = {
        schemaVersion: "shockaudit-six-screen-public-v1",
        runId,
        revision: nearLimit.state.revision,
        activeScreen: nearLimit.state.activeScreen,
        causalComparisonWorkspace: {},
        modelCapability: {},
        padding: "",
      };
      nearLimit.operationReplays.push({
        operationId: "legacy-state-only-public-projection",
        operationKind: "screen3_contextualization_legacy",
        inputFingerprint: fingerprintSixScreenValue("legacy-projection"),
        committedRevision: nearLimit.state.revision,
        mutationOutcome: "unchanged",
        result: legacyProjectionResult,
        completedAt: "2026-09-21T20:00:02.000Z",
      });
      const recordBytes = () => new TextEncoder().encode(
        parentKey + JSON.stringify(nearLimit),
      ).byteLength;
      const paddingBytes = durableValueLimit - 256 - recordBytes();
      expect(paddingBytes).toBeGreaterThan(0);
      legacyProjectionResult.padding = "x".repeat(paddingBytes);
      expect(recordBytes()).toBeLessThan(durableValueLimit);
      await put(parentKey, nearLimit);
      enforceDurableValueLimit = true;
      // Reopening/status cannot dispatch or silently finish a task. The
      // existing explicit local recheck works even with inference offline.
      expect((await runtime.status({ runId, accessToken })).privateSnapshot.revision)
        .toBe(saved.privateSnapshot.revision);
      providerFetch.mockImplementation(async () => {
        throw new Error("Local recovery must not call the provider.");
      });
      response = await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: { runId, accessToken, mutation: {
          action: "personalize_screen3_advice",
          expectedRevision: saved.privateSnapshot.revision,
          operationId: "screen3-local-recheck-after-interrupted-saves",
          expectedAdviceFingerprint: advice.adviceFingerprint,
        } },
      });
      expect(response.isError, JSON.stringify(response)).not.toBe(true);
      const recovered = await store.read({ runId, accessToken });
      if (recovered.outcome !== "found") throw new Error("Missing saved study.");
      expect(recovered.record.state.screen3Contextualizations).toHaveLength(1);
      expect(recovered.record.state.screen3Contextualizations![0]!.receipt).toEqual(receipt);
      expect(recovered.record.operationReplays.find(({ operationId }) =>
        operationId === "legacy-state-only-public-projection")?.result)
        .toBeNull();
      const contextualizationReplays = recovered.record.operationReplays
        .filter(({ operationKind }) =>
          operationKind.startsWith("screen3_contextualization_"));
      expect(contextualizationReplays.length).toBeGreaterThan(0);
      expect(contextualizationReplays.every(({ result }) => result === null))
        .toBe(true);
    }
    expect(response.structuredContent).toMatchObject({
      causalComparisonWorkspace: { studyFirst: { contextualization: {
        status: "completed",
        retryEligibility: "none",
      } } },
    });
    const supplement = (response.structuredContent as {
      causalComparisonWorkspace: { studyFirst: { contextualization: {
        supplement: { concerns: Array<{ issue_id: string;
          why_it_matters: string; researcher_input_fields: string[] }> };
      } } };
    }).causalComparisonWorkspace.studyFirst.contextualization.supplement;
    expect(supplement.concerns.map(({ issue_id }) => issue_id)).toEqual(
      SCREEN3_DESIGN_DIMENSIONS.map(({ id }) => id),
    );
    expect(supplement.concerns[0]!.researcher_input_fields)
      .toEqual(["proposedTreatment"]);
    expect(supplement.concerns[0]!.why_it_matters.length).toBe(750);
    const restored = restoreSixScreenWorkflowToolResponse({
      structuredContent: response.structuredContent,
      metadata: response._meta ?? {},
      trace: { toolName: "mutate_six_screen_workflow_v1", bridgePath: "mcp-app",
        metadataKeys: Object.keys(response._meta ?? {}),
        structuredContentKeys: Object.keys(response.structuredContent ?? {}) },
    });
    const html = renderToStaticMarkup(createElement(StudyDesignAdvicePanel, {
      workspace: restored.projection.causalComparisonWorkspace.studyFirst,
      disabled: false, onContextualize: () => {}, onDecide: () => {}, onEdit: () => {},
    }));
    expect(html.match(/class="six-design-assessment-item"/gu)).toHaveLength(6);
    expect(interruptedSaves).toBe(interruptions);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(await new Screen5OpenAILedgerStore(storage).summary())
      .toMatchObject({ attemptsReserved: 1, attemptsSettled: 1,
        tokensConsumed: 2_500, tokensHeld: 0 });
    await client.close();
    await server.close();
  });

  it("appends a Screen 6 attempt after explicit retry of a saved HTTP rejection", async () => {
    const fixture = createBrowserEventCardFixture();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: fixture.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("known-screen6-rejection"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    const providerFetch = vi.fn(async () => new Response(JSON.stringify({
      error: { code: "rate_limit_exceeded", message: "Synthetic known rejection." },
    }), { status: 429, headers: { "content-type": "application/json" } }));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen6-known-rejection-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch, screen5OpenAILedgerStore: ledger });
    const authentication = { runId, accessToken };
    const opened = await runtime.openScreen6(authentication, {
      expectedRevision: fixture.state.revision,
      operationId: "screen6-known-rejection-open",
    });
    const fingerprint = opened.projection.screen6CurrentPlan.inputFingerprint;
    const firstInput = { expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-known-rejection-first",
      expectedPlanFingerprint: fingerprint };
    const first = await runtime.personalizeScreen6(authentication, firstInput);
    expect(first.projection.screen6Personalization).toMatchObject({
      status: "failed", retryEligibility: "new_request" });
    expect(providerFetch).toHaveBeenCalledTimes(1);
    await runtime.personalizeScreen6(authentication, firstInput);
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const second = await runtime.personalizeScreen6(authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen6-known-rejection-explicit-second",
      expectedPlanFingerprint: fingerprint,
    });
    const records = second.privateSnapshot.state.screen6Personalizations!;
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ status: "failed",
      dispatchState: "dispatched", failureCode: "openai_rate_limited",
      failureStage: "response_headers",
      receipt: null, attemptOrdinal: 1 });
    expect(records[1]).toMatchObject({ status: "failed",
      dispatchState: "dispatched", failureCode: "openai_rate_limited",
      failureStage: "response_headers",
      receipt: null, attemptOrdinal: 2 });
    expect(records[1]!.reservationId).not.toBe(records[0]!.reservationId);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2, attemptsSettled: 0, attemptsHeld: 2,
      tokensHeld: 160_000,
    });
  });

  it("uses the existing Screen 3 assessment action with uncapped local usage and recovers an unknown outcome", async () => {
    const fixture = createBrowserEventCardFixture();

    const opened = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study: { ...study, period: { start: "2010", end: "2025" } },
      proposedTiming: { mode: "year", year: 2023, milestoneReference: null },
      openedAt: "2026-09-21T20:00:00.000Z",
    });
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: opened.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("screen3-unknown-renewal"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z" });
    const ledger = new Screen5OpenAILedgerStore(storage);
    const providerFetch = vi.fn(async (): Promise<Response> => { throw new Error("Synthetic interrupted connection"); });
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen3-unknown-renewal-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({ SCREEN5_OPENAI_FETCH: providerFetch }), screen5OpenAILedgerStore: ledger });
    const server = new McpServer({ name: "screen3-unknown-renewal", version: "1.0.0" });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "screen3-unknown-renewal", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const before = await runtime.status({ runId, accessToken });
      const first = await runtime.personalizeScreen3({ runId, accessToken }, {
        expectedRevision: opened.state.revision, operationId: "unknown-screen3-request",
        expectedAdviceFingerprint: opened.state.studyDesignAdvices!.at(-1)!.adviceFingerprint,
      });
      validateSixScreenWorkflowProjection(first.projection);
      expect(first.projection.causalComparisonWorkspace.studyFirst.contextualization)
        .toMatchObject({ status: "outcome_unknown", retryEligibility: "observe" });
      const failedMutation = { action: "personalize_screen3_advice", operationId: "unknown-screen3-request",
        expectedAdviceFingerprint: opened.state.studyDesignAdvices!.at(-1)!.adviceFingerprint };
      expect(analysisArtifactRecovered(before.privateSnapshot, first.privateSnapshot, failedMutation)).toBe(true);
      expect(analysisArtifactRecovered(before.privateSnapshot, first.privateSnapshot,
        { ...failedMutation, operationId: "unrelated" })).toBe(false);
      const html = renderToStaticMarkup(createElement(StudyDesignAdvicePanel, {
        workspace: first.projection.causalComparisonWorkspace.studyFirst, disabled: false,
        onContextualize: () => {}, onDecide: () => {}, onEdit: () => {},
      }));
      expect(html.match(/>Generate study-specific assessment<\/button>/gu)).toHaveLength(1);
      expect(html).not.toContain("Start a new assessment");
      expect(html).not.toContain("Reviewer mode");
      expect(before.projection.modelCapability.allowance).toMatchObject({ policyMode: "unlimited" });
      expect(providerFetch).toHaveBeenCalledTimes(1);
      expect(await ledger.summary()).toMatchObject({ tokensHeld: 48_000, policyMode: "unlimited" });
      const ready = await runtime.status({ runId, accessToken });
      await runtime.status({ runId, accessToken });
      await runtime.status({ runId, accessToken });
      expect(providerFetch).toHaveBeenCalledTimes(1);
      const wire = { schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
        concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension) => ({
          issue_id: dimension.id, specific_heading: dimension.heading,
          status_label: "Requires design evidence",
          relevant_fact_or_proposal: `The proposed groups supply inputs for ${dimension.heading.toLowerCase()}.`,
          why_it_matters: "This condition can change the interpretation of the proposed comparison.",
          unresolved_question: "What does the firm-level evidence show?",
          next_check: "Map dated firm activities and group-period records to the saved rule.",
          check_limit: "This does not establish comparable untreated trends.",
          priority: "medium", priority_reason: "The group split depends on this condition.",
          documentary_claim_ids: [], researcher_input_fields: ["proposedTreatment"],
        })), synthesis_limit: "The stated groups alone do not prove comparable outcomes." };
      providerFetch.mockImplementationOnce(async () => successfulProviderResponse({
        content: wire, promptTokens: 1_600, completionTokens: 500, requestId: "explicit-after-unknown",
      }));
      const retry = screen3AssessmentMutation({
        expectedRevision: ready.privateSnapshot.revision, operationId: "explicit-retry-after-unknown",
        expectedAdviceFingerprint: failedMutation.expectedAdviceFingerprint });
      const bridge = new SixScreenBridge();
      (bridge as unknown as { app: unknown }).app = {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool: async (request: { name: string; arguments: Record<string, unknown> }) => {
          if (request.name === "mutate_six_screen_workflow_v1") {
            // The retained pre-v60 input schema knows only these fields.
            expect(Object.keys(request.arguments.mutation as object).sort()).toEqual(
              ["action", "expectedRevision", "operationId", "expectedAdviceFingerprint"].sort());
          }
          return JSON.parse(JSON.stringify(await client.callTool(request)));
        },
      };
      const completed = await bridge.callToolWithMetadata("mutate_six_screen_workflow_v1",
        { runId, accessToken, mutation: retry });
      const restored = restoreSixScreenWorkflowToolResponse({ ...completed,
        expectedOperationBinding: sixScreenWorkflowMutationRequestBinding(retry) });
      expect(restored.projection).toMatchObject({ causalComparisonWorkspace: {
        studyFirst: { contextualization: { status: "completed", retryEligibility: "none" } },
      } });
      const visible = renderToStaticMarkup(createElement(StudyDesignAdvicePanel, {
        workspace: restored.projection.causalComparisonWorkspace.studyFirst, disabled: false,
        onContextualize: () => {}, onDecide: () => {}, onEdit: () => {},
      }));
      expect(visible.match(/class="six-design-assessment-item"/gu)).toHaveLength(6);
      for (const dimension of SCREEN3_DESIGN_DIMENSIONS) expect(visible).toContain(dimension.heading);
      const attempts = restored.snapshot.state.screen3Contextualizations!;
      expect(attempts.at(-1)!.retryUnknownAttemptId).toBe(attempts[0]!.id);
      expect(attempts[0]!.status).toBe("outcome_unknown");
      const replayed = await client.callTool({ name: "mutate_six_screen_workflow_v1",
        arguments: { runId, accessToken, mutation: retry } });
      expect(replayed.isError, JSON.stringify(replayed)).not.toBe(true);
      expect(providerFetch).toHaveBeenCalledTimes(2);
      expect(await ledger.summary()).toMatchObject({ attemptsReserved: 2, attemptsSettled: 1,
        tokensHeld: 48_000, tokensConsumed: 2_100, policyMode: "unlimited" });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("renews the legacy allowance through the registered action without erasing spend or dispatching", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "legacy-allowance-registered-renewal",
    );
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v1",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 12, maximumTokens: 200_000,
        importedBase: { attempts: 2, tokens: 5_000,
          source: "historical-preview", importedAt: "2026-09-21T20:00:00.000Z" },
        events: [{ kind: "reserved", reservationId: "unknown:planning:1",
          jobId: "unknown", stage: "planning", reservedTokens: 14_000,
          recordedAt: "2026-09-21T20:00:01.000Z" }],
      });
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    const fetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen5-allowance-renewal-key-longer-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: fetch, screen5OpenAILedgerStore: ledger });
    const server = new McpServer({ name: "allowance-renewal", version: "1.0.0" });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "allowance-renewal", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const mutation = { ...{ runId, accessToken }, mutation: {
      action: "renew_model_allowance", acknowledgedByOwner: true,
      expectedRevision: screen5.revision, operationId: "renew-legacy-local-window",
    } };
    const first = await client.callTool({
      name: "mutate_six_screen_workflow_v1", arguments: mutation,
    });
    expect(first.isError, JSON.stringify(first.structuredContent)).not.toBe(true);
    expect(await ledger.summary()).toMatchObject({
      policyMode: "unlimited", maximumAttempts: 803, maximumTokens: 20_019_000,
      attemptsReserved: 3, tokensConsumed: 5_000,
      tokensHeld: 14_000, remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });
    const duplicate = await client.callTool({
      name: "mutate_six_screen_workflow_v1", arguments: mutation,
    });
    expect(duplicate.isError, JSON.stringify(duplicate.structuredContent))
      .not.toBe(true);
    const stored = await storage.transaction((transaction) =>
      transaction.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY));
    expect(stored).toMatchObject({ policyHistory: [
      { kind: "policy_updated", previousAttempts: 12,
        previousTokens: 200_000, maximumAttempts: 83,
        maximumTokens: 2_019_000,
        reasonCode: "owner_approved_fresh_local_window" },
    ] });
    expect(fetch).not.toHaveBeenCalled();
    await client.close();
    await server.close();
  });

  it("automatically removes the exhausted cumulative allowance without dispatching", async () => {
    const { storage, store } = await storedReadyScreen5(
      "current-allowance-automatic-expansion",
    );
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v2",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 40,
        maximumTokens: 1_000_000,
        importedBase: {
          attempts: 40,
          tokens: 1_000_000,
          source: "exhausted-current-preview",
          importedAt: "2026-09-21T20:00:00.000Z",
        },
        events: [],
        initialPolicy: {
          source: "new_default",
          maximumAttempts: 40,
          maximumTokens: 1_000_000,
        },
        policyHistory: [],
      });
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey:
        "current-allowance-renewal-key-longer-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });

    const reopened = await runtime.status({ runId, accessToken });

    expect(await ledger.summary()).toMatchObject({
      policyMode: "unlimited", maximumAttempts: 840,
      maximumTokens: 21_000_000,
      attemptsReserved: 40,
      tokensCommitted: 1_000_000,
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });
    expect(reopened.projection.modelCapability.allowance).toMatchObject({
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("silently replaces the obsolete legacy cap when an existing run is reopened", async () => {
    const { storage, store } = await storedReadyScreen5(
      "legacy-allowance-automatic-reopen",
    );
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v2",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 12,
        maximumTokens: 200_000,
        importedBase: {
          attempts: 12,
          tokens: 141_023,
          source: "historical-preview",
          importedAt: "2026-09-21T20:00:00.000Z",
        },
        events: [],
        initialPolicy: {
          source: "legacy_v1",
          maximumAttempts: 12,
          maximumTokens: 200_000,
        },
        policyHistory: [],
      });
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "automatic-legacy-migration-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });

    const reopened = await runtime.status({ runId, accessToken });

    expect(reopened.projection.modelCapability).toMatchObject({
      configuration: "ready",
      ledgerState: "valid",
      allowance: {
        policyMode: "unlimited", maximumAttempts: 812,
        maximumTokens: 20_141_023,
        localAttemptsReserved: 12,
        localObservedTokens: 141_023,
        remainingAttempts: 800,
        remainingTokens: 20_000_000,
      },
    });
    expect(await ledger.summary()).toMatchObject({
      policyMode: "unlimited", maximumAttempts: 812,
      maximumTokens: 20_141_023,
      attemptsReserved: 12,
      tokensConsumed: 141_023,
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });
  it("preserves the finalized Screen 5 focal input while a changed Screen 2 context invalidates its result", async () => {
    const { screen5, store } = await storedReadyScreen5(
      "screen5-context-change-preserves-m0",
    );
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "off",
      screen5OpenAIFetch: providerFetch,
    });
    const finalized =
      "It reduces firms’ pool of customer data without assuming a trust pathway.";
    const compared = await runtime.compareStudyFirstMechanisms(
      { runId, accessToken },
      {
        expectedRevision: screen5.revision,
        operationId: "save-final-m0-before-context-change",
        theoreticalPerspective: null,
        proposedMechanism: finalized,
      },
    );
    const revised = updateStudyContext(compared.privateSnapshot.state, {
      expectedRevision: compared.privateSnapshot.state.revision,
      study: {
        ...study,
        analysisUnit: "establishment-year",
        industry: ["Retail"],
        outcome: "Store performance",
        outcomeMeasure: "Store operating margin",
      },
      updatedAt: "2026-09-21T20:00:04.000Z",
    });

    expect(currentStudyFirstMechanismInputForState(revised)).toMatchObject({
      proposedMechanism: finalized,
      revision: 1,
      origin: "researcher_ui",
    });
    expect(currentStudyFirstMechanismRunForState(revised)).toBeNull();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("returns the in-progress checkpoint to a concurrent advance without interrupting it", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-concurrent-advance",
    );
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    let signalInvocation!: () => void;
    const invoked = new Promise<void>((resolve) => {
      signalInvocation = resolve;
    });
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const providerFetch = vi.fn(async () => {
      signalInvocation();
      await responseGate;
      return successfulProviderResponse({
        content: planWire,
        promptTokens: 1_000,
        completionTokens: 600,
        requestId: "request-concurrent-a",
      });
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision,
      operationId: "compare-before-concurrent-advance",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms reduce available customer data, which changes acquisition efficiency.",
    });
    const execution = compared.projection.studyFirstMechanismWorkspace
      .currentRun!.providerExecution!;
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "authorize-before-concurrent-advance",
        expectedExecutionFingerprint: execution.executionFingerprint,
      },
    );
    const firstAdvance = runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "concurrent-advance-owner",
      retry: false,
    });
    await invoked;

    const observer = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "concurrent-advance-observer",
      retry: false,
    });
    expect(observer.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution).toMatchObject({
        phase: "planning_running",
        attempts: [{ status: "running", stage: "planning" }],
        lastError: null,
      });
    expect(providerFetch).toHaveBeenCalledTimes(1);

    releaseResponse();
    const completed = await firstAdvance;
    expect(completed.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.phase).toBe("plan_ready");
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("reconciles a proven pre-dispatch rejection without consuming pilot capacity", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-pre-dispatch-release",
    );
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    const providerFetch = vi.fn(async () => {
      throw new Screen5OpenAITransportError(
        "The provider request was rejected before network invocation.",
        {
          failureStage: "admission",
          networkInvocation: "not_started",
          providerResponse: "not_observed",
          httpStatus: null,
          safeCause: "wrong_method",
        },
      );
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision,
      operationId: "compare-before-local-rejection",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms reduce available customer data, which changes acquisition efficiency.",
    });
    const execution = compared.projection.studyFirstMechanismWorkspace
      .currentRun!.providerExecution!;
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "authorize-before-local-rejection",
        expectedExecutionFingerprint: execution.executionFingerprint,
      },
    );
    const failed = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "advance-local-rejection",
      retry: false,
    });

    expect(failed.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution).toMatchObject({
        phase: "failed",
        attempts: [{
          status: "failed",
          errorCode: "transport_wrong_method",
          failureStage: "admission",
          networkInvocation: "not_started",
          providerResponse: "not_observed",
          httpStatus: null,
          safeCause: "wrong_method",
        }],
        lastError: {
          code: "transport_wrong_method",
          networkInvocation: "not_started",
        },
      });
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 0,
      attemptsSettled: 0,
      attemptsHeld: 0,
      tokensConsumed: 0,
      tokensHeld: 0,
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });
  });

  it("fails locally without source fallback or allowance debit when the inference capability is absent", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-missing-inference-capability",
    );
    const sourceFetch = vi.fn();
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAILedgerStore: ledger,
    });
    const compared = await runtime.compareStudyFirstMechanisms(
      { runId, accessToken },
      {
        expectedRevision: screen5.revision,
        operationId: "compare-without-inference-capability",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms reduce available customer data, which changes acquisition efficiency.",
      },
    );

    expect(compared.projection.studyFirstMechanismWorkspace).toMatchObject({
      currentRun: {
        providerExecution: {
          phase: "configuration_required",
          attempts: [],
        },
      },
      executionReadiness: {
        configuration: "blocked",
        missingSettings: expect.arrayContaining(["SCREEN5_OPENAI_TRANSPORT"]),
        canDispatch: false,
      },
    });
    await expect(runtime.advanceStudyFirstMechanismJob(
      { runId, accessToken },
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "advance-without-inference-capability",
        retry: false,
      },
    )).rejects.toThrow(/not enabled/iu);
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 0,
      tokensConsumed: 0,
      tokensHeld: 0,
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });
  });

  it("blocks on direct setup without using host when a key is present but mode is off", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-mode-off",
    );
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "off",
      screen5OpenAIApiKey: "present-but-must-not-enable",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const compared = await runtime.compareStudyFirstMechanisms(
      { runId, accessToken },
      {
        expectedRevision: screen5.revision,
        operationId: "compare-with-openai-gate-off",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    validateSixScreenWorkflowProjection(compared.projection);
    expect(compared.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        planning: {
          status: "available_via_direct_provider",
          origin: "openai",
        },
        providerExecution: { phase: "configuration_required", attempts: [] },
      });
    expect(compared.projection.studyFirstMechanismWorkspace.executionReadiness)
      .toMatchObject({
        selectedBackend: "off",
        route: "direct_setup_required",
        configuration: "off",
        keyPresent: true,
        nextAction: "configure_direct_mode",
      });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each(["local-preview", "production"] as const)(
    "uses the fixed policy with the key in %s mode",
    async (mode) => {
    const { screen5, storage, store } = await storedReadyScreen5(
      `screen5-openai-fixed-policy-${mode}`,
    );
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-openai-policy-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: mode,
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const compared = await runtime.compareStudyFirstMechanisms(
      { runId, accessToken },
      {
        expectedRevision: screen5.revision,
        operationId: `compare-fixed-openai-policy-${mode}`,
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    expect(compared.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        selectedBackend: "openai",
        model: "gpt-6-luna",
        configuration: "ready",
        route: "direct",
        missingSettings: [],
      });
    expect(compared.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.settings).toMatchObject({
        reasoningEffort: "medium",
        serviceTier: "default",
        store: false,
      });
    await expect(runtime.continueStudyFirstMechanismEvidence(
      { runId, accessToken },
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: `forbidden-host-fallback-fixed-policy-${mode}`,
        planningTaskId: "legacy-host-task",
        planningResultId: "legacy-host-result",
      },
    )).rejects.toThrow(/host Screen 5 inference route is retired/iu);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(await new Screen5OpenAILedgerStore(storage).summary())
      .toMatchObject({ policyMode: "unlimited" });
  });

  it("keeps one unchanged configuration-required OpenAI job without dispatch", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-same-input-migration",
    );
    const providerFetch = vi.fn();
    const authentication = { runId, accessToken };
    const mechanism =
      "Firms improve privacy controls, which increases customer trust and retention.";
    const hostRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "off",
      screen5OpenAIFetch: providerFetch,
    });
    const hostCompared = await hostRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: screen5.revision,
        operationId: "compare-before-direct-mode",
        theoreticalPerspective: null,
        proposedMechanism: mechanism,
      },
    );
    const hostRun = hostCompared.projection.studyFirstMechanismWorkspace
      .currentRun!;
    const savedInput = hostCompared.projection.studyFirstMechanismWorkspace
      .currentInput!;

    const directRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const migrated = await directRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: hostCompared.privateSnapshot.revision,
        operationId: "ensure-direct-route-for-unchanged-input",
        theoreticalPerspective: null,
        proposedMechanism: mechanism,
      },
    );
    const directRun = migrated.projection.studyFirstMechanismWorkspace
      .currentRun!;

    expect(directRun).toMatchObject({
      id: hostRun.id,
      previousRunId: null,
      input: {
        id: savedInput.id,
        revision: savedInput.revision,
        inputFingerprint: savedInput.inputFingerprint,
      },
      planning: {
        origin: "openai",
        status: "available_via_direct_provider",
      },
      providerExecution: {
        phase: "configuration_required",
        attempts: [],
      },
    });
    expect(directRun.id).toBe(hostRun.id);
    expect(migrated.privateSnapshot.state.studyFirstMechanismInputs)
      .toHaveLength(1);
    expect(migrated.privateSnapshot.state.studyFirstMechanismRuns)
      .toHaveLength(1);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("replays an old operation id, then concurrent OpenAI ensures converge", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-old-receipt-then-ensure",
    );
    const authentication = { runId, accessToken };
    const providerFetch = vi.fn();
    const mechanism =
      "Firms improve privacy controls, which increases customer trust and retention.";
    const oldOperationId = "legacy-host-compare-operation";
    const hostRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "off",
    });
    const savedHost = await hostRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: screen5.revision,
        operationId: oldOperationId,
        theoreticalPerspective: null,
        proposedMechanism: mechanism,
      },
    );
    const hostRun = savedHost.projection.studyFirstMechanismWorkspace
      .currentRun!;
    const directRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });

    const replayed = await directRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: savedHost.privateSnapshot.revision,
        operationId: oldOperationId,
        theoreticalPerspective: null,
        proposedMechanism: mechanism,
      },
    );
    expect(replayed.replayed).toBe(true);
    expect(replayed.result).toMatchObject({
      id: hostRun.id,
      planning: { origin: "openai" },
    });
    expect(replayed.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        selectedBackend: "openai",
        migration: "prepared",
        canEnsure: true,
      });

    const ensureInput = {
      expectedRevision: replayed.privateSnapshot.revision,
      expectedInputFingerprint: hostRun.input.inputFingerprint,
      expectedRunFingerprint: hostRun.runFingerprint,
    };
    const ensured = await Promise.allSettled([
      directRuntime.ensureStudyFirstMechanismJob(authentication, {
        ...ensureInput,
        operationId: "ensure-old-host-run-tab-a",
      }),
      directRuntime.ensureStudyFirstMechanismJob(authentication, {
        ...ensureInput,
        operationId: "ensure-old-host-run-tab-b",
      }),
    ]);
    expect(ensured.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(ensured.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const canonical = ensured.find((result) => result.status === "fulfilled")!
      .value;
    const canonicalRun = canonical.projection.studyFirstMechanismWorkspace
      .currentRun!;
    expect(canonicalRun.providerExecution?.id).toBe(
      hostRun.providerExecution?.id,
    );
    expect(canonicalRun.providerExecution?.phase).toBe("planning_queued");
    expect(canonicalRun.executionLineage).toBeUndefined();
    expect(canonical.privateSnapshot.state.studyFirstMechanismInputs)
      .toEqual(savedHost.privateSnapshot.state.studyFirstMechanismInputs);
    expect(canonical.privateSnapshot.state.studyFirstMechanismRuns)
      .toHaveLength(2);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("resumes the same configuration-required job after configuration repair", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-configuration-repair",
    );
    const authentication = { runId, accessToken };
    const providerFetch = vi.fn();
    const blockedRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const blocked = await blockedRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: screen5.revision,
        operationId: "compare-before-key-repair",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    const blockedRun = blocked.projection.studyFirstMechanismWorkspace
      .currentRun!;
    expect(blockedRun.providerExecution?.phase).toBe("configuration_required");

    const repairedRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const repaired = await repairedRuntime.ensureStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: blocked.privateSnapshot.revision,
        operationId: "ensure-after-key-repair",
        expectedInputFingerprint: blockedRun.input.inputFingerprint,
        expectedRunFingerprint: blockedRun.runFingerprint,
      },
    );
    const repairedRun = repaired.projection.studyFirstMechanismWorkspace
      .currentRun!;
    expect(repairedRun.providerExecution).toMatchObject({
      id: blockedRun.providerExecution?.id,
      phase: "planning_queued",
      attempts: [],
    });
    expect(repairedRun.input).toEqual(blockedRun.input);
    expect(repaired.projection.studyFirstMechanismWorkspace.executionReadiness)
      .toMatchObject({
        configuration: "ready",
        authorization: "required",
        canDispatch: false,
        nextAction: "request_execution_authorization",
      });
    await expect(repairedRuntime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: repaired.privateSnapshot.revision,
        operationId: "advance-without-current-ticket",
        retry: false,
      },
    )).rejects.toThrow(/current exact execution authorization/iu);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("keeps the same job and identifies persistent-ledger initialization failure", async () => {
    const { screen5, store } = await storedReadyScreen5(
      "screen5-ledger-initialization-failure",
    );
    const authentication = { runId, accessToken };
    const providerFetch = vi.fn();
    const blockedRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIFetch: providerFetch,
    });
    const blocked = await blockedRuntime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: screen5.revision,
        operationId: "compare-before-ledger-failure",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    const blockedRun = blocked.projection.studyFirstMechanismWorkspace
      .currentRun!;
    const brokenLedger = new Screen5OpenAILedgerStore({
      async transaction<T>(): Promise<T> {
        throw new Error("synthetic storage failure");
      },
    });
    const repairedRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:04.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: brokenLedger,
    });
    const stillBlocked = await repairedRuntime.ensureStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: blocked.privateSnapshot.revision,
        operationId: "ensure-with-broken-ledger",
        expectedInputFingerprint: blockedRun.input.inputFingerprint,
        expectedRunFingerprint: blockedRun.runFingerprint,
      },
    );
    expect(stillBlocked.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution).toMatchObject({
        id: blockedRun.providerExecution?.id,
        phase: "configuration_required",
        attempts: [],
        lastError: {
          code: "persistent_ledger_initialization_failed",
          message: expect.stringContaining("No inference request was sent"),
        },
      });
    expect(stillBlocked.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        configuration: "blocked",
        ledgerState: "invalid",
        nextAction: "configure_pilot_ledger",
      });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("authorizes each revised mechanism job in-tool without PowerShell job coordinates", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-in-tool-authorization",
    );
    const authentication = { runId, accessToken };
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    const providerFetch = vi.fn(async () => successfulProviderResponse({
      content: planWire,
      promptTokens: 1_000,
      completionTokens: 600,
      requestId: `request-plan-${providerFetch.mock.calls.length + 1}`,
    }));
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
      screen5OpenAIAuthorization: {
        authorizationId: "stale-powershell-ticket",
        jobId: "screen5-openai-job-from-an-earlier-input",
        stages: ["planning", "assessment"],
      },
    });
    const firstCompared = await runtime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: screen5.revision,
        operationId: "compare-first-researcher-mechanism",
        theoreticalPerspective: null,
        proposedMechanism:
          "Privacy controls increase customer trust and customer retention.",
      },
    );
    const firstExecution = firstCompared.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    expect(firstCompared.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        authorization: "required",
        canDispatch: false,
      });

    await expect(runtime.authorizeStudyFirstMechanismJob(authentication, {
      expectedRevision: firstCompared.privateSnapshot.revision,
      operationId: "authorize-stale-first-job-view",
      expectedExecutionFingerprint: "fnv1a64:0000000000000000",
    })).rejects.toThrow(/job changed before authorization/iu);
    expect(providerFetch).not.toHaveBeenCalled();

    const firstAuthorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: firstCompared.privateSnapshot.revision,
        operationId: "authorize-first-researcher-mechanism",
        expectedExecutionFingerprint: firstExecution.executionFingerprint,
      },
    );
    const firstAuthorizedExecution = firstAuthorized.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    expect(firstAuthorizedExecution.authorization).toMatchObject({
      jobId: firstExecution.id,
      stages: ["planning", "assessment"],
      source: "authenticated_screen5_action",
    });
    expect(firstAuthorized.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        authorization: "authorized",
        canDispatch: true,
      });
    expect(providerFetch).not.toHaveBeenCalled();

    const firstPlanned = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: firstAuthorized.privateSnapshot.revision,
        operationId: "advance-first-researcher-mechanism",
        retry: false,
      },
    );
    expect(firstPlanned.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.attempts[0]).toMatchObject({
        stage: "planning",
        status: "succeeded",
        authorizationId:
          firstAuthorizedExecution.authorization?.authorizationId,
      });

    const secondCompared = await runtime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: firstPlanned.privateSnapshot.revision,
        operationId: "compare-revised-researcher-mechanism",
        theoreticalPerspective: "information economics",
        proposedMechanism:
          "Reduced customer-data access changes acquisition costs and firm performance.",
      },
    );
    const secondExecution = secondCompared.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    expect(secondExecution.id).not.toBe(firstExecution.id);
    expect(secondExecution.authorization ?? null).toBeNull();
    expect(secondCompared.projection.studyFirstMechanismWorkspace
      .executionReadiness).toMatchObject({
        authorization: "required",
        canDispatch: false,
      });

    const secondAuthorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: secondCompared.privateSnapshot.revision,
        operationId: "authorize-revised-researcher-mechanism",
        expectedExecutionFingerprint: secondExecution.executionFingerprint,
      },
    );
    const secondAuthorizedExecution = secondAuthorized.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    expect(secondAuthorizedExecution.authorization).toMatchObject({
      jobId: secondExecution.id,
      stages: ["planning", "assessment"],
      source: "authenticated_screen5_action",
    });
    expect(secondAuthorizedExecution.authorization?.authorizationId).not.toBe(
      firstAuthorizedExecution.authorization?.authorizationId,
    );

    const secondPlanned = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: secondAuthorized.privateSnapshot.revision,
        operationId: "advance-revised-researcher-mechanism",
        retry: false,
      },
    );
    expect(secondPlanned.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        input: {
          proposedMechanism:
            "Reduced customer-data access changes acquisition costs and firm performance.",
        },
        providerExecution: {
          phase: "plan_ready",
          attempts: [{
            stage: "planning",
            status: "succeeded",
            authorizationId:
              secondAuthorizedExecution.authorization?.authorizationId,
          }],
        },
      });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it("saves a usable configuration-required state without a server key", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-key-missing",
    );
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const compared = await runtime.compareStudyFirstMechanisms(
      { runId, accessToken },
      {
        expectedRevision: screen5.revision,
        operationId: "compare-with-openai-key-missing",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    validateSixScreenWorkflowProjection(compared.projection);
    expect(compared.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        planning: { origin: "openai" },
        providerExecution: {
          phase: "configuration_required",
          attempts: [],
          lastError: { code: "direct_provider_configuration_required" },
        },
      });
    await expect(runtime.advanceStudyFirstMechanismJob(
      { runId, accessToken },
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "advance-with-openai-key-missing",
        retry: false,
      },
    )).rejects.toThrow(/not enabled/iu);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("replays a valid private Stage A receipt after a crash and old failure without another request", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-plan-receipt-replay",
    );
    const canonicalMutate = store.mutate.bind(store);
    const mutateSpy = vi.spyOn(store, "mutate").mockImplementation(
      (mutation, updater) => {
        if (
          mutation.operationKind === "checkpoint_screen5_openai_planning_result" ||
          mutation.operationKind === "checkpoint_screen5_openai_planning_failure"
        ) {
          throw new Error("Injected post-receipt persistence crash.");
        }
        return canonicalMutate(mutation, updater);
      },
    );
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    const providerFetch = vi.fn(async () => successfulProviderResponse({
      content: planWire,
      promptTokens: 1_000,
      completionTokens: 600,
      requestId: "request-plan-receipt-replay",
    }));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: ledger,
    });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision,
      operationId: "compare-plan-receipt-replay",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms improve privacy controls, which increases customer trust and retention.",
    });
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "authorize-plan-receipt-replay",
        expectedExecutionFingerprint: compared.projection
          .studyFirstMechanismWorkspace.currentRun!.providerExecution!
          .executionFingerprint,
      },
    );

    await expect(runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "advance-plan-receipt-crash",
      retry: false,
    })).rejects.toEqual(expect.objectContaining({
      name: "SixScreenWorkflowProblemError",
      message: "ShockAudit could not verify that the workflow action was saved.",
      problem: expect.objectContaining({
        code: "persistence_failure",
        stage: "commit",
        recovery: "check_status",
        safeCauseCodes: ["persistence_failed"],
      }),
    }));
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const afterCrash = await store.read(authentication);
    expect(afterCrash.outcome).toBe("found");
    if (afterCrash.outcome !== "found") throw new Error("Expected saved run.");
    const receiptedRun = currentStudyFirstMechanismRunForState(
      afterCrash.record.state,
    )!;
    expect(receiptedRun.providerExecution).toMatchObject({
      phase: "validating",
      attempts: [{
        stage: "planning",
        status: "running",
        usage: { totalTokens: 1_600 },
        responseReceipt: {
          status: "received",
          providerRequestId: "request-plan-receipt-replay",
        },
      }],
    });
    expect(receiptedRun.providerExecution?.attempts[0]?.responseReceipt
      ?.finalContent).toBe(JSON.stringify(planWire));

    // Simulate an older validator's generic quarantine after the receipt was
    // safely saved. This controlled case is not the owner's inaccessible JSON.
    const previous = receiptedRun.providerExecution!;
    const { schemaVersion: _schemaVersion, provider: _provider,
      modelRequested: _modelRequested, pilotId: _pilotId,
      planPromptVersion: _planPromptVersion,
      comparisonPromptVersion: _comparisonPromptVersion,
      planWireVersion: _planWireVersion,
      comparisonWireVersion: _comparisonWireVersion,
      settings: _settings, executionFingerprint: _executionFingerprint,
      ...executionBody } = previous;
    const priorIssue = { code: "bounded_contract_failed", path: "$" };
    const attempt = structuredClone(previous.attempts[0]!);
    attempt.status = "failed";
    attempt.completedAt = "2026-09-21T20:00:20.000Z";
    attempt.errorCode = "provider_schema_invalid";
    attempt.responseReceipt = { ...attempt.responseReceipt!,
      status: "quarantined", validationIssues: [priorIssue] };
    const execution = createScreen5OpenAIExecution({ ...executionBody,
      phase: "failed", attempts: [attempt],
      updatedAt: "2026-09-21T20:00:20.000Z",
      lastError: { stage: "planning", code: "provider_schema_invalid",
        message: "Earlier bounded check rejected the saved response.",
        retryable: false, occurredAt: "2026-09-21T20:00:20.000Z" } });
    const { schemaVersion: _runVersion, runFingerprint: _runFingerprint,
      ...runBody } = receiptedRun;
    const restoredRun = createStudyFirstMechanismRun({ ...runBody,
      providerExecution: execution });
    const saved = structuredClone(afterCrash.record);
    saved.state.studyFirstMechanismRuns![
      saved.state.studyFirstMechanismRuns!.length - 1] = restoredRun;
    saved.stateFingerprint = fingerprintSixScreenValue(saved.state);
    await storage.put(sixScreenWorkflowStoreParentRecordKey(runId), saved);

    mutateSpy.mockRestore();
    clock = Date.parse("2026-09-21T20:00:21.000Z");
    const recoveryRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAILedgerStore: ledger,
    });
    const replayed = await recoveryRuntime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: afterCrash.record.state.revision,
        operationId: "replay-saved-plan-receipt",
        retry: false,
      },
    );
    const replayedRun = replayed.projection.studyFirstMechanismWorkspace
      .currentRun!;
    expect(replayedRun).toMatchObject({
      planning: { status: "completed", origin: "openai" },
      providerExecution: {
        phase: "plan_ready",
        attempts: [{
          stage: "planning",
          status: "succeeded",
          usage: { totalTokens: 1_600 },
          responseReceipt: { status: "aggregate_saved" },
          wireCheckpoint: { kind: "planning" },
        }],
      },
    });
    expect(replayedRun.providerExecution?.attempts[0]?.responseReceipt &&
      "finalContent" in replayedRun.providerExecution.attempts[0]
        .responseReceipt!).toBe(false);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(replayedRun.providerExecution?.attempts[0]?.validationHistory)
      .toEqual([[priorIssue]]);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 1,
      attemptsSettled: 1,
      attemptsHeld: 0,
      tokensConsumed: 1_600,
      tokensHeld: 0,
    });
  });

  it("normalizes a mechanical Stage A candidate ID without another provider call", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-plan-receipt-quarantine",
    );
    const providerFetch = vi.fn(async () => successfulProviderResponse({
      content: {
        ...planWire,
        candidates: [{
          ...planWire.candidates[0],
          candidate_id: "m0",
        }],
      },
      promptTokens: 900,
      completionTokens: 500,
      requestId: "request-plan-receipt-quarantine",
    }));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z",
      fetch: vi.fn(),
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: ledger,
    });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision,
      operationId: "compare-plan-receipt-quarantine",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms improve privacy controls, which increases customer trust and retention.",
    });
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "authorize-plan-receipt-quarantine",
        expectedExecutionFingerprint: compared.projection
          .studyFirstMechanismWorkspace.currentRun!.providerExecution!
          .executionFingerprint,
      },
    );
    const planned = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "advance-plan-receipt-quarantine",
      retry: false,
    });
    const publicRun = planned.projection.studyFirstMechanismWorkspace
      .currentRun!;
    const publicAttempt = publicRun.providerExecution!.attempts[0]!;
    expect(publicRun).toMatchObject({
      planning: {
        status: "completed",
        origin: "openai",
        plan: {
          candidates: [{ id: "alternative-1" }],
        },
      },
      providerExecution: {
        phase: "plan_ready",
      },
    });
    expect(publicAttempt).toMatchObject({
      status: "succeeded",
      usage: { totalTokens: 1_400 },
      errorCode: null,
      responseReceipt: {
        status: "aggregate_saved",
        validationIssues: [],
      },
      wireCheckpoint: { kind: "planning" },
    });
    expect("finalContent" in publicAttempt.responseReceipt!).toBe(false);
    const privateAttempt = planned.privateSnapshot.state
      .studyFirstMechanismRuns?.at(-1)?.providerExecution?.attempts[0]!;
    expect(privateAttempt.responseReceipt?.finalContent).toContain(
      '"candidate_id":"m0"',
    );
    expect(JSON.stringify(planned.projection)).not.toContain(
      "test-key-never-projected",
    );
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 1,
      attemptsSettled: 1,
      attemptsHeld: 0,
      tokensConsumed: 1_400,
      tokensHeld: 0,
    });
  });

  it("persists B before aggregation and replays a failed aggregate save without another call", async () => {
    const fixture = createBrowserEventCardFixture();
    const screen3 = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      openedAt: "2026-09-21T20:00:00.000Z",
    });
    const screen4 = openScreen4(screen3.state, {
      expectedRevision: screen3.state.revision,
      openedAt: "2026-09-21T20:00:01.000Z",
    });
    const screen5 = openScreen5(screen4.state, {
      expectedRevision: screen4.state.revision,
      openedAt: "2026-09-21T20:00:02.000Z",
    });
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({
      state: screen5.state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue("screen5-mechanism-runtime"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-23T00:00:00.000Z",
    });
    const canonicalMutate = store.mutate.bind(store);
    let rejectAggregateSave = true;
    vi.spyOn(store, "mutate").mockImplementation((mutation, updater) => {
      if (
        rejectAggregateSave &&
        mutation.operationKind === "checkpoint_screen5_openai_assessment_result"
      ) {
        rejectAggregateSave = false;
        throw new Error("Injected aggregate persistence failure.");
      }
      return canonicalMutate(mutation, updater);
    });
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    const providerBodies: Array<Record<string, unknown>> = [];
    const providerUrls: string[] = [];
    const providerFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const destination = String(url);
      if (destination.includes("api.groq.com")) {
        throw new Error("Sentinel observed a forbidden Groq dispatch.");
      }
      providerUrls.push(destination);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      providerBodies.push(body);
      const text = body.text as {
        format: { name: string };
      };
      const planning = text.format.name === "mechanism_plan_v4_with_citations";
      const content = planning ? planWire : comparisonWire;
      const promptTokens = planning ? 1_000 : 2_000;
      const completionTokens = planning ? 600 : 1_000;
      return successfulProviderResponse({
        content,
        promptTokens,
        completionTokens,
        requestId: planning ? "request-a" : "request-b",
      });
    });
    const sourceFetch = vi.fn(async (request: RequestInfo | URL) =>
      publicSourceResponse(String(request)));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: ledger,
    });
    const authentication = { runId, accessToken };
    // Exercise the registered result() projection wrapper at every durable
    // stage of the controlled plan -> evidence -> assessment journey.
    const server = new McpServer({ name: "screen5-journey", version: "1.0.0" });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "screen5-journey", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const toolAdvance = async (revision: number, operationId: string) => {
      const toolName = "mutate_six_screen_workflow_v1";
      const wire = await client.callTool({ name: toolName,
        arguments: { ...authentication,
          mutation: { action: "advance_study_first_mechanism_job",
            expectedRevision: revision, operationId, retry: false } } });
      expect(wire.isError, JSON.stringify(wire.structuredContent)).not.toBe(true);
      const restored = restoreSixScreenWorkflowToolResponse({
        structuredContent: wire.structuredContent,
        metadata: wire._meta ?? {},
        trace: { toolName, bridgePath: "mcp-app",
          metadataKeys: Object.keys(wire._meta ?? {}),
          structuredContentKeys: Object.keys(wire.structuredContent ?? {}) },
      });
      return { projection: restored.projection, privateSnapshot: restored.snapshot };
    };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.state.revision,
      operationId: "compare-openai-screen5",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms improve privacy controls, which increases customer trust and retention.",
    });
    validateSixScreenWorkflowProjection(compared.projection);
    expect(compared.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        planning: { status: "available_via_direct_provider", origin: "openai" },
        providerExecution: { phase: "planning_queued", attempts: [] },
      });

    const duplicateCompare = await runtime.compareStudyFirstMechanisms(
      authentication,
      {
        expectedRevision: compared.privateSnapshot.revision,
        operationId: "compare-openai-screen5-duplicate-click",
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which increases customer trust and retention.",
      },
    );
    expect(duplicateCompare.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.id).toBe(
        compared.projection.studyFirstMechanismWorkspace.currentRun
          ?.providerExecution?.id,
      );
    expect(duplicateCompare.privateSnapshot.state.studyFirstMechanismRuns)
      .toHaveLength(1);
    expect(providerFetch).not.toHaveBeenCalled();

    const queuedExecution = duplicateCompare.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: duplicateCompare.privateSnapshot.revision,
        operationId: "authorize-openai-comparison-in-tool",
        expectedExecutionFingerprint: queuedExecution.executionFingerprint,
      },
    );
    validateSixScreenWorkflowProjection(authorized.projection);
    expect(authorized.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.authorization).toMatchObject({
        jobId: queuedExecution.id,
        stages: ["planning", "assessment"],
      });
    expect(providerFetch).not.toHaveBeenCalled();

    const planned = await toolAdvance(authorized.privateSnapshot.revision,
      "advance-openai-plan");
    expect(planned.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        planning: { status: "completed", origin: "openai" },
        providerExecution: {
          phase: "plan_ready",
          attempts: [{ stage: "planning", status: "succeeded" }],
        },
      });
    expect(sourceFetch).not.toHaveBeenCalled();

    const retrieved = await toolAdvance(planned.privateSnapshot.revision,
      "advance-openai-retrieval");
    const retrievedRun = retrieved.projection.studyFirstMechanismWorkspace
      .currentRun!;
    expect(analysisArtifactRecovered(planned.privateSnapshot, retrieved.privateSnapshot, {
      action: "advance_study_first_mechanism_job", expectedRevision: planned.privateSnapshot.revision,
      operationId: "advance-openai-retrieval" })).toBe(true);
    expect(retrievedRun.works).toHaveLength(0);
    expect(retrievedRun.providerExecution?.phase).toBe("evidence_ready");
    expect(retrievedRun.providerExecution?.evidencePacket?.entries).toHaveLength(0);
    expect(sourceFetch).not.toHaveBeenCalled();

    clock = Date.parse(retrievedRun.providerExecution!.nextEligibleAt!) + 1_000;
    const assessed = await toolAdvance(retrieved.privateSnapshot.revision,
      "advance-openai-assessment");
    const blocked = assessed.projection.studyFirstMechanismWorkspace.currentRun!;
    expect(blocked.providerExecution).toMatchObject({
      phase: "blocked",
      attempts: [
        { stage: "planning", status: "succeeded", usage: { totalTokens: 1_600 } },
        {
          stage: "assessment",
          status: "succeeded",
          usage: { totalTokens: 3_000 },
          responseReceipt: { status: "schema_valid" },
        },
      ],
      comparison: null,
      lastError: { code: "receipt_saved_merge_pending" },
    });
    expect(analysisArtifactRecovered(retrieved.privateSnapshot, assessed.privateSnapshot, {
      action: "advance_study_first_mechanism_job", expectedRevision: retrieved.privateSnapshot.revision,
      operationId: "advance-openai-assessment" })).toBe(true);
    expect(providerBodies).toHaveLength(2);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2,
      attemptsSettled: 2,
      attemptsHeld: 0,
      tokensConsumed: 4_600,
      tokensHeld: 0,
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });

    const rebuilt = await toolAdvance(assessed.privateSnapshot.revision,
      "rebuild-openai-assessment-from-saved-batch");
    const completed = rebuilt.projection.studyFirstMechanismWorkspace.currentRun!;
    expect(completed.providerExecution).toMatchObject({
      phase: "completed",
      attempts: [
        { stage: "planning", status: "succeeded", usage: { totalTokens: 1_600 } },
        { stage: "assessment", status: "succeeded", usage: { totalTokens: 3_000 } },
      ],
      comparison: {
        provider: "openai",
        modelRequested: "gpt-6-luna",
        mechanisms: [
          {
            concept:
              "Firms improve privacy controls, which increases customer trust and retention.",
            relation: "focal",
          },
        ],
      },
    });
    const publicReceipt = completed.providerExecution?.attempts[1]
      ?.responseReceipt;
    expect(publicReceipt).toMatchObject({
      status: "aggregate_saved",
      usage: { totalTokens: 3_000 },
      validationIssues: [],
    });
    expect(publicReceipt && "finalContent" in publicReceipt).toBe(false);
    const privateReceipt = rebuilt.privateSnapshot.state.studyFirstMechanismRuns
      ?.at(-1)?.providerExecution?.attempts[1]?.responseReceipt;
    expect(privateReceipt?.finalContent).toContain('"mechanisms"');
    expect(privateReceipt?.wireFingerprint).toMatch(/^fnv1a64:/u);
    expect(providerBodies).toHaveLength(2);
    const stagePayloads = providerBodies.map((body) => {
      const messages = body.input as Array<{
        role: string;
        content: Array<{ type: string; text: string }>;
      }>;
      return JSON.parse(messages[0]!.content[0]!.text) as Record<string, any>;
    });
    expect(stagePayloads.map((payload) => payload.M0)).toEqual([
      stagePayloads[0]!.M0,
      stagePayloads[0]!.M0,
    ]);
    expect(stagePayloads.map((payload) => payload.study.authority)).toEqual([
      stagePayloads[0]!.study.authority,
      stagePayloads[0]!.study.authority,
    ]);
    expect(stagePayloads.map((payload) => ({ X: payload.X, Y: payload.Y })))
      .toEqual([
        { X: stagePayloads[0]!.X, Y: stagePayloads[0]!.Y },
        { X: stagePayloads[0]!.X, Y: stagePayloads[0]!.Y },
      ]);
    expect(stagePayloads[0]!.M0).toMatchObject({
      exact_researcher_text:
        "Firms improve privacy controls, which increases customer trust and retention.",
      source: "screen5_finalized",
    });
    expect(providerBodies.every((body) =>
      body.model === "gpt-6-luna" &&
      (body.reasoning as { effort: string }).effort === "medium" &&
      body.service_tier === "default" &&
      body.store === false && body.stream === false &&
      !("reasoning_format" in body) && !("response_format" in body)
    )).toBe(true);
    expect(providerUrls).toEqual([
      SCREEN5_OPENAI_RESPONSES_URL,
      SCREEN5_OPENAI_RESPONSES_URL,
    ]);
    expect(JSON.stringify(rebuilt.projection)).not.toContain(
      "test-key-never-projected",
    );
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2,
      attemptsSettled: 2,
      attemptsHeld: 0,
      tokensConsumed: 4_600,
      tokensHeld: 0,
      remainingAttempts: 800,
      remainingTokens: 20_000_000,
    });

    const restoredRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const restored = await restoredRuntime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: rebuilt.privateSnapshot.revision,
        operationId: "read-completed-openai-job",
        retry: false,
      },
    );
    expect(restored.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution?.phase).toBe("completed");
    const openedWire = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: { ...authentication, mutation: { action: "open_screen_6",
        expectedRevision: restored.privateSnapshot.revision,
        operationId: "open-screen6-after-controlled-mechanisms" } },
    });
    expect(openedWire.isError).not.toBe(true);
    expect(openedWire.structuredContent).toMatchObject({ activeScreen: 6,
      screen6CurrentPlan: { schemaVersion: "screen-06-current-study-plan-v3",
        upstream: { mechanisms: { status: "completed",
          assessments: expect.arrayContaining([expect.objectContaining({ concept:
            "Firms improve privacy controls, which increases customer trust and retention." })]) } } } });
    const screen6State = await restoredRuntime.status(authentication);
    const returned4 = await restoredRuntime.openScreen2(authentication, {
      expectedRevision: screen6State.privateSnapshot.revision,
      operationId: "return-to-screen2-with-completed-mechanisms" });
    validateSixScreenWorkflowProjection(returned4.projection);
    const returned5 = await restoredRuntime.openScreen5(authentication, {
      expectedRevision: returned4.privateSnapshot.revision,
      operationId: "return-to-screen5-with-completed-mechanisms" });
    validateSixScreenWorkflowProjection(returned5.projection);
    expect(returned5.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.phase).toBe("completed");
    await client.close();
    await server.close();
    expect(providerFetch).toHaveBeenCalledTimes(2);
  }, 60_000);

  it("holds a rejected B reservation, honors Retry-After, and retries only B once", async () => {
    const { screen5, storage, store } = await storedReadyScreen5(
      "screen5-mechanism-b-retry",
    );
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => {
      const value = new Date(clock).toISOString();
      clock += 1_000;
      return value;
    };
    let assessmentCalls = 0;
    const providerFetch = vi.fn(async (
      _url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body)) as {
        text: { format: { name: string } };
      };
      if (body.text.format.name === "mechanism_plan_v4_with_citations") {
        return successfulProviderResponse({
          content: planWire,
          promptTokens: 1_000,
          completionTokens: 600,
          requestId: "request-a-before-b-retry",
        });
      }
      assessmentCalls += 1;
      if (assessmentCalls === 1) {
        return new Response(JSON.stringify({
          error: { code: "rate_limit_exceeded" },
        }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
            "x-request-id": "request-b-rate-limited",
            "x-ratelimit-reset-tokens": "60s",
            "x-ratelimit-remaining-tokens": "0",
          },
        });
      }
      return successfulProviderResponse({
        content: comparisonWire,
        promptTokens: 2_000,
        completionTokens: 1_000,
        requestId: "request-b-approved-retry",
      });
    });
    const sourceFetch = vi.fn(async (request: RequestInfo | URL) =>
      publicSourceResponse(String(request)));
    const ledger = new Screen5OpenAILedgerStore(storage);
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
      screen5OpenAIAuthorization: authorizationForCompare(
        "compare-openai-b-retry",
      ),
    });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision,
      operationId: "compare-openai-b-retry",
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms improve privacy controls, which increases customer trust and retention.",
    });
    const planned = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: compared.privateSnapshot.revision,
      operationId: "advance-openai-b-retry-plan",
      retry: false,
    });
    const retrieved = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: planned.privateSnapshot.revision,
        operationId: "advance-openai-b-retry-retrieval",
        retry: false,
      },
    );
    clock = Date.parse(
      retrieved.projection.studyFirstMechanismWorkspace.currentRun!
        .providerExecution!.nextEligibleAt!,
    ) + 1_000;
    const rateLimited = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: retrieved.privateSnapshot.revision,
        operationId: "advance-openai-b-rate-limited",
        retry: false,
      },
    );
    const failedExecution = rateLimited.projection
      .studyFirstMechanismWorkspace.currentRun!.providerExecution!;
    expect(failedExecution).toMatchObject({
      phase: "failed",
      retryCount: 0,
      lastError: {
        code: "openai_rate_limited",
        retryable: true,
      },
    });
    expect(failedExecution.nextEligibleAt).not.toBeNull();
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 2,
      attemptsSettled: 1,
      attemptsHeld: 1,
      tokensHeld: 64_000,
    });

    const retryRuntime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes",
      now,
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
      screen5OpenAIAuthorization: authorizationForCompare(
        "compare-openai-b-retry",
        "test-ticket-compare-openai-b-retry-second-assessment",
      ),
    });

    await expect(retryRuntime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: rateLimited.privateSnapshot.revision,
      operationId: "retry-openai-b-too-early",
      retry: true,
    })).rejects.toThrow(/not eligible before/iu);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect((await ledger.summary()).attemptsReserved).toBe(2);

    clock = Date.parse(failedExecution.nextEligibleAt!) + 1_000;
    const retried = await retryRuntime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: rateLimited.privateSnapshot.revision,
        operationId: "retry-openai-b-after-due-time",
        retry: true,
      },
    );
    expect(retried.projection.studyFirstMechanismWorkspace.currentRun
      ?.providerExecution).toMatchObject({
        phase: "completed",
        retryCount: 1,
        attempts: [
          { stage: "planning", status: "succeeded" },
          { stage: "assessment", status: "failed" },
          { stage: "assessment", status: "succeeded" },
        ],
      });
    expect(providerFetch).toHaveBeenCalledTimes(3);
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 3,
      attemptsSettled: 2,
      attemptsHeld: 1,
      tokensConsumed: 4_600,
      tokensHeld: 64_000,
      tokensCommitted: 68_600,
    });
  }, 60_000);

  it("recovers exact saved Screen 5 setup checkpoints after interrupted delivery", async () => {
    const { storage, store } = await storedReadyScreen5("screen5-setup-recovery");
    const providerFetch = vi.fn();
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen5-setup-recovery-key-more-than-thirty-two-bytes",
      now: () => "2026-09-21T20:00:03.000Z", fetch: vi.fn(),
      screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch, screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage) });
    const authentication = { runId, accessToken };
    const before = await runtime.status(authentication);
    const compare = { action: "compare_study_first_mechanisms", expectedRevision: before.privateSnapshot.revision,
      operationId: "compare-setup-recovery", theoreticalPerspective: null,
      proposedMechanism: "Privacy controls increase customer trust and retention." };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, compare);
    expect(screen5SetupRecovered(before.privateSnapshot, compared.privateSnapshot, compare)).toBe(true);
    expect(screen5SetupRecovered(before.privateSnapshot, before.privateSnapshot, compare)).toBe(false);
    expect(screen5SetupRecovered(before.privateSnapshot, compared.privateSnapshot, { ...compare, proposedMechanism: "Different mechanism" })).toBe(false);
    expect(screen5SetupRecovered(before.privateSnapshot, compared.privateSnapshot, { ...compare, operationId: "another-operation" })).toBe(false);
    const run = compared.projection.studyFirstMechanismWorkspace.currentRun!;
    const ensure = { action: "ensure_study_first_mechanism_job", expectedRevision: compared.privateSnapshot.revision,
      operationId: "ensure-setup-recovery", expectedInputFingerprint: run.input.inputFingerprint,
      expectedRunFingerprint: run.runFingerprint };
    const ensured = await runtime.ensureStudyFirstMechanismJob(authentication, ensure);
    expect(screen5SetupRecovered(compared.privateSnapshot, ensured.privateSnapshot, ensure)).toBe(true);
    expect(screen5SetupRecovered(compared.privateSnapshot, ensured.privateSnapshot, { ...ensure, expectedInputFingerprint: "wrong-input" })).toBe(false);
    const authorize = { action: "authorize_study_first_mechanism_job", expectedRevision: ensured.privateSnapshot.revision,
      operationId: "authorize-setup-recovery", expectedExecutionFingerprint: ensured.projection.studyFirstMechanismWorkspace.currentRun!.providerExecution!.executionFingerprint };
    const authorized = await runtime.authorizeStudyFirstMechanismJob(authentication, authorize);
    expect(screen5SetupRecovered(ensured.privateSnapshot, authorized.privateSnapshot, authorize)).toBe(true);
    expect(screen5SetupRecovered(ensured.privateSnapshot, ensured.privateSnapshot, authorize)).toBe(false);
    expect(screen5SetupRecovered(ensured.privateSnapshot, authorized.privateSnapshot, { ...authorize, operationId: "another-operation" })).toBe(false);
    expect(screen5SetupRecovered(ensured.privateSnapshot, { ...authorized.privateSnapshot, runId: "another-workflow" }, authorize)).toBe(false);
    validateSixScreenWorkflowProjection(authorized.projection);
    expect(providerFetch).not.toHaveBeenCalled();
  }, 60_000);

  it("uses saved suggested citations without depending on external catalogues", async () => {
    const { screen5, storage, store } = await storedReadyScreen5("screen5-citation-first");
    let clock = Date.parse("2026-09-21T20:00:03.000Z");
    const now = () => new Date(clock += 1_000).toISOString();
    const providerFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      successfulProviderResponse({ content: JSON.parse(String(init?.body)).text.format.name ===
        "mechanism_plan_v4_with_citations" ? planWire : comparisonWire,
        promptTokens: 1_000, completionTokens: 600, requestId: "citation-first-test" }));
    const sourceFetch = vi.fn(async () => { throw new Error("Synthetic catalogue outage."); });
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "screen5-mechanism-runtime-key-more-than-thirty-two-bytes", now,
      fetch: sourceFetch, screen5OpenAIMode: "local-preview", screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch, screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
      screen5OpenAIAuthorization: authorizationForCompare("compare-citation-first") });
    const authentication = { runId, accessToken };
    const compared = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.revision, operationId: "compare-citation-first",
      theoreticalPerspective: null, proposedMechanism: "Privacy controls increase trust and retention." });
    const planned = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: compared.privateSnapshot.revision, operationId: "citation-first-plan", retry: false });
    const ready = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: planned.privateSnapshot.revision, operationId: "citation-first-evidence", retry: false });
    expect(ready.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.phase, JSON.stringify(ready.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.lastError)).toBe("evidence_ready");
    expect(ready.projection.studyFirstMechanismWorkspace.currentRun?.works).toHaveLength(0);
    clock = Date.parse(ready.projection.studyFirstMechanismWorkspace.currentRun!.providerExecution!.nextEligibleAt!) + 1_000;
    const assessed = await runtime.advanceStudyFirstMechanismJob(authentication, {
      expectedRevision: ready.privateSnapshot.revision, operationId: "citation-first-assessment", retry: false });
    validateSixScreenWorkflowProjection(assessed.projection);
    expect(assessed.projection.studyFirstMechanismWorkspace.currentRun?.providerExecution?.phase).toBe("completed");
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(providerFetch).toHaveBeenCalledTimes(2);
  }, 60_000);
});
