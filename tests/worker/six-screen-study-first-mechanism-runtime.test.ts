import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { SixScreenWorkflowProblemError } from
  "../../src/core/six-screen/workflow-problem";
import { createWorkflowResearchExportBundle } from
  "../../src/core/six-screen/workflow-research-export";
import {
  openScreen3,
  openScreen4,
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

function sourceResponse(request: RequestInfo | URL) {
  const url = String(request);
  if (url.includes("api.openalex.org")) {
    return Promise.resolve(new Response(JSON.stringify({
      meta: { count: 1 },
      results: [{
        id: "https://openalex.org/W9876543210",
        doi: "https://doi.org/10.1234/RUNTIME.1",
        display_name: "Privacy controls and customer response",
        authorships: [{ author: { display_name: "Runtime Researcher" } }],
        publication_year: 2024,
        publication_date: "2024-01-15",
        primary_location: {
          is_oa: true,
          landing_page_url: "https://journal.example/runtime",
          pdf_url: null,
          version: "publishedVersion",
          license: "cc-by",
          source: {
            display_name: "Journal of Customer Response",
            type: "journal",
            host_organization_name: "Research Publisher",
          },
        },
        best_oa_location: null,
        type: "article",
        language: "en",
        is_retracted: false,
        abstract_inverted_index: {
          Privacy: [0], controls: [1], may: [2], increase: [3], trust: [4],
        },
        content_urls: { pdf: null, grobid_xml: null },
      }],
    }), { headers: { "content-type": "application/json" } }));
  }
  return Promise.resolve(new Response(JSON.stringify({
    message: { items: [{
      DOI: "10.1234/runtime.1",
      title: ["Privacy controls and customer response"],
      author: [{ given: "Runtime", family: "Researcher" }],
      publisher: "Research Publisher",
      "container-title": ["Journal of Customer Response"],
      "published-online": { "date-parts": [[2024, 1, 15]] },
      type: "journal-article",
      URL: "https://doi.org/10.1234/runtime.1",
      abstract: "<jats:p>Privacy controls may increase trust.</jats:p>",
    }] },
  }), { headers: { "content-type": "application/json" } }));
}

const planningWire = {
  candidates: [{
    candidate_id: "runtime-compliance-path",
    concept: "Compliance effort",
    chain: [
      "Customer-protection obligations change",
      "Systems and staff effort change",
      "Operating costs or capabilities change",
    ],
    difference: "This process may operate without a change in customer trust.",
    condition: "The sampled firms bear material implementation effort.",
    direction: {
      mode: "single_hypothesis",
      target_outcome: "Firm performance",
      target_measure: "Return on assets",
      scenarios: [{ sign: "negative", condition: "Effort is not offset",
        rationale: "Higher costs may reduce firm performance.",
        intermediate_movement: "Operating costs increase", horizon: null }],
      missing_assumption: null,
    },
    evidence_need:
      "Whether customer-protection duties change organizational resources.",
    terms: ["customer protection", "compliance effort"],
  }, {
    candidate_id: "runtime-data-use-path",
    concept: "Data-use adjustment",
    chain: [
      "Consumer privacy choices change",
      "Usable customer data changes",
      "Acquisition activity changes",
    ],
    difference: "Data access can change without a customer-trust response.",
    condition: "Privacy choices materially constrain usable customer data.",
    direction: {
      mode: "under_specified",
      target_outcome: "Firm performance",
      target_measure: "Return on assets",
      scenarios: [],
      missing_assumption: "The net effect of changed acquisition and response is unknown.",
    },
    evidence_need:
      "Whether privacy choices change data access and acquisition activity.",
    terms: ["consumer privacy", "data access", "customer acquisition"],
  }],
  open_xy_terms: ["customer protection", "firm performance"],
  challenge_terms: ["privacy regulation", "boundary condition"],
  qualification: "The policy-to-construct link remains proposed.",
};

function planningResponse() {
  return new Response(JSON.stringify({
    id: "resp_runtime_planning",
    object: "response",
    status: "completed",
    model: "gpt-6-luna",
    service_tier: "default",
    output: [{
      id: "msg_runtime_planning",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{
        type: "output_text",
        annotations: [],
        text: JSON.stringify(planningWire),
      }],
    }],
    usage: {
      input_tokens: 900,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 500,
      output_tokens_details: { reasoning_tokens: 100 },
      total_tokens: 1_400,
    },
  }), {
    headers: {
      "content-type": "application/json",
      "x-request-id": "runtime-planning-request",
      "x-ratelimit-reset-tokens": "1s",
      "x-ratelimit-remaining-tokens": "1000",
    },
  });
}

describe("durable study-first Screen 5 mechanism runtime", () => {
  it("checkpoints exact input before OpenAI retrieval, replays idempotently, and versions edits", async () => {
    const fixture = createBrowserEventCardFixture();
    const screen3 = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2023,
        milestoneReference: null,
      },
      openedAt: "2026-09-20T22:00:00.000Z",
    });
    const screen4 = openScreen4(screen3.state, {
      expectedRevision: screen3.state.revision,
      openedAt: "2026-09-20T22:00:01.000Z",
    });
    const screen5 = openScreen5(screen4.state, {
      expectedRevision: screen4.state.revision,
      openedAt: "2026-09-20T22:00:02.000Z",
    });
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({
      state: screen5.state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue("screen5-runtime"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-22T00:00:00.000Z",
    });
    const sourceFetch = vi.fn(sourceResponse);
    const providerFetch = vi.fn(async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      expect(String(url)).toBe("https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "gpt-6-luna",
        reasoning: { effort: "medium" },
        service_tier: "default",
        store: false,
      });
      return planningResponse();
    });
    let second = 3;
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey:
        "study-first-screen5-runtime-key-more-than-thirty-two-bytes",
      now: () =>
        `2026-09-20T22:00:${String(second++).padStart(2, "0")}.000Z`,
      fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "runtime-test-key-never-projected",
      screen5OpenAIFetch: screen5OpenAIInferenceFetch({
        SCREEN5_OPENAI_FETCH: providerFetch,
      }),
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const authentication = { runId, accessToken };
    const exactMechanism =
      "Firms improve privacy controls, which may increase customer trust and retention.";
    const first = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.state.revision,
      operationId: "screen5-compare-first",
      theoreticalPerspective: null,
      proposedMechanism: exactMechanism,
    });

    expect(sourceFetch).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
    expect(first.projection.studyFirstMechanismWorkspace).toMatchObject({
      currentInput: {
        revision: 1,
        theoreticalPerspective: null,
        proposedMechanism: exactMechanism,
        origin: "researcher_ui",
      },
      currentRun: {
        ordinal: 1,
        status: "planning_ready",
        input: { proposedMechanism: exactMechanism },
        theoreticalProblem: {
          theoreticalChange: { originalText: "Customer protection" },
          focal: { originalText: exactMechanism },
          outcome: {
            concept: "Firm performance",
            measure: "Return on assets",
          },
        },
        planning: {
          status: "available_via_direct_provider",
          origin: "openai",
          plan: null,
        },
        providerExecution: { phase: "planning_queued", attempts: [] },
        works: [],
      },
      revisions: [{ inputRevision: 1, workCount: 0, abstractCount: 0 }],
    });
    const afterFirst = await store.read({ runId, accessToken });
    expect(afterFirst.outcome).toBe("found");
    if (afterFirst.outcome !== "found") return;
    expect(afterFirst.record.state.studyFirstMechanismInputs).toHaveLength(1);
    expect(afterFirst.record.state.studyFirstMechanismRuns).toHaveLength(1);

    const replay = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: screen5.state.revision,
      operationId: "screen5-compare-first",
      theoreticalPerspective: null,
      proposedMechanism: exactMechanism,
    });
    expect(replay.privateSnapshot.revision).toBe(first.privateSnapshot.revision);
    expect(providerFetch).not.toHaveBeenCalled();

    const execution = first.projection.studyFirstMechanismWorkspace.currentRun!
      .providerExecution!;
    const viewedChallengePlan = await runtime.openScreen6(authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen5-local-view-challenge-plan",
    });
    expect(viewedChallengePlan.projection.activeScreen).toBe(6);
    expect(viewedChallengePlan.projection.studyFirstMechanismWorkspace.currentRun
      ?.input.proposedMechanism).toBe(exactMechanism);
    const authorized = await runtime.authorizeStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: viewedChallengePlan.privateSnapshot.revision,
        operationId: "authorize-screen5-runtime-plan",
        expectedExecutionFingerprint: execution.executionFingerprint,
      },
    );
    const planned = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: authorized.privateSnapshot.revision,
        operationId: "advance-screen5-runtime-plan",
        retry: false,
      },
    );
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(planned.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        planning: {
          status: "completed",
          origin: "openai",
          plan: {
            candidates: expect.arrayContaining([
              expect.objectContaining({ conceptLabel: "Compliance effort" }),
            ]),
          },
        },
        providerExecution: {
          phase: "plan_ready",
          attempts: [{ stage: "planning", status: "succeeded" }],
        },
      });
    const partial = createWorkflowResearchExportBundle({
      state: planned.privateSnapshot.state,
      exportedAt: "2026-09-20T22:10:00.000Z",
    });
    const mechanismsJson = partial.files.find(({ name }) =>
      name === "mechanisms.json")?.content ?? "";
    const challengeJson = partial.files.find(({ name }) =>
      name === "credibility-plan.json")?.content ?? "";
    expect(mechanismsJson).toContain("Compliance effort");
    expect(mechanismsJson).toContain(exactMechanism);
    expect(mechanismsJson).not.toContain("finalContent");
    expect(challengeJson).toContain("currentChallengePlan");
    expect(challengeJson).toContain("Customer protection");
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const evidence = await runtime.advanceStudyFirstMechanismJob(
      authentication,
      {
        expectedRevision: planned.privateSnapshot.revision,
        operationId: "advance-screen5-runtime-retrieval",
        retry: false,
      },
    );
    expect(sourceFetch).toHaveBeenCalledTimes(4);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(evidence.projection.studyFirstMechanismWorkspace.currentRun)
      .toMatchObject({
        status: "scholarly_evidence_ready",
        planning: { status: "completed", origin: "openai" },
        providerExecution: { phase: "evidence_ready" },
        works: [{ access: { level: "abstract_inspected" } }],
      });

    const revisedText =
      "Managers change privacy controls, which may reduce data-use flexibility and alter acquisition costs.";
    const revised = await runtime.compareStudyFirstMechanisms(authentication, {
      expectedRevision: evidence.privateSnapshot.revision,
      operationId: "screen5-compare-revised",
      theoreticalPerspective: "Organizational adaptation",
      proposedMechanism: revisedText,
    });
    expect(sourceFetch).toHaveBeenCalledTimes(4);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(revised.projection.studyFirstMechanismWorkspace).toMatchObject({
      currentInput: {
        revision: 2,
        theoreticalPerspective: "Organizational adaptation",
        proposedMechanism: revisedText,
      },
      currentRun: {
        previousRunId:
          evidence.projection.studyFirstMechanismWorkspace.currentRun?.id,
        providerExecution: { phase: "planning_queued", attempts: [] },
      },
      revisions: expect.arrayContaining([
        expect.objectContaining({ inputRevision: 1 }),
        expect.objectContaining({ inputRevision: 2 }),
      ]),
    });
    const final = await store.read({ runId, accessToken });
    expect(final.outcome).toBe("found");
    if (final.outcome === "found") {
      expect(final.record.state.studyFirstMechanismInputs).toHaveLength(2);
      const runs = final.record.state.studyFirstMechanismRuns ?? [];
      expect(runs.length).toBeGreaterThan(1);
      expect(runs.at(-1)?.input.revision).toBe(2);
      expect(final.record.state.study.initialExplanation).toBe(
        study.initialExplanation,
      );
    }
    const changed = await runtime.updateStudy(authentication, {
      expectedRevision: revised.privateSnapshot.revision,
      operationId: "screen5-revise-industry-preserve-focal",
      study: { ...study, industry: ["Manufacturing", "Retail"] },
    });
    expect(changed.projection.studyFirstMechanismWorkspace.currentRun).toBeNull();
    expect(changed.projection.studyFirstMechanismWorkspace.currentInput)
      .toMatchObject({ proposedMechanism: revisedText,
        theoreticalPerspective: "Organizational adaptation" });
    const plan = createScreen6CurrentPlan(changed.privateSnapshot.state);
    expect(plan.study.focalMechanism).toBe(revisedText);
    expect(plan.upstream.mechanisms.proposals).toEqual([]);
    expect(plan.gaps.join(" ")).toContain("exact finalized focal wording");
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("checks Screen 6 scientific prerequisites when its saved panel is viewed while another screen is active", async () => {
    const fixture = createBrowserEventCardFixture();
    const screen3 = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study,
      proposedTiming: { mode: "year", year: 2023, milestoneReference: null },
      openedAt: "2026-09-20T22:00:00.000Z",
    });
    const screen5 = openScreen5(screen3.state, {
      expectedRevision: screen3.state.revision,
      openedAt: "2026-09-20T22:00:01.000Z",
    });
    const store = new SixScreenWorkflowStore(
      new InMemorySixScreenWorkflowStorage(),
    );
    await store.create({
      state: screen5.state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue("screen6-local-view"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-22T00:00:00.000Z",
    });
    const sourceFetch = vi.fn(async () => {
      throw new Error("Local Screen 6 view cannot dispatch retrieval.");
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "screen6-local-view-test-signing-value-more-than-thirty-two",
      now: () => "2026-09-20T22:00:02.000Z",
      fetch: sourceFetch,
    });
    expect(screen5.state.activeScreen).toBe(5);
    let unavailable: unknown;
    try {
      await runtime.personalizeScreen6({ runId, accessToken }, {
        expectedRevision: screen5.state.revision,
        operationId: "screen6-explicit-local-view-without-model",
        expectedPlanFingerprint: createScreen6CurrentPlan(screen5.state)
          .inputFingerprint,
      });
    } catch (caught) {
      unavailable = caught;
    }
    expect(unavailable).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((unavailable as SixScreenWorkflowProblemError).problem)
      .toMatchObject({
        code: "configuration_unavailable",
        stage: "execution",
        action: "personalize_screen6_plan",
        screen: 6,
        expectedRevision: screen5.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["configuration_unavailable"],
      });
    const unchanged = await runtime.status({ runId, accessToken });
    expect(unchanged.privateSnapshot.revision).toBe(screen5.state.revision);
    expect(sourceFetch).not.toHaveBeenCalled();
  });
});
