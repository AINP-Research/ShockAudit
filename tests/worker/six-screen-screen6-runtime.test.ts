import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { SixScreenWorkflowProblemError } from
  "../../src/core/six-screen/workflow-problem";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
  SCREEN6_CONTEXTUALIZER_INPUT_CEILING,
  SCREEN6_CONTEXTUALIZER_OUTPUT_CEILING } from
  "../../src/worker/screen6-contextualizer";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
  type SixScreenWorkflowStoreRecord,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const diagnosticInput = {
  preTreatmentPeriods: {
    status: "available" as const,
    count: 4,
    description: "2016 through 2019",
  },
  postTreatmentPeriods: {
    status: "available" as const,
    count: 4,
    description: "2020 through 2023",
  },
  outcomeFrequency: { status: "known" as const, value: "annual" },
  assignmentStructure: {
    status: "described" as const,
    description: "Assignment varies across twelve market groups.",
    timingPattern: "single_time" as const,
    dependence: "grouped_or_clustered" as const,
    independentGroupCount: 12,
    groupingVariables: ["market_id"],
  },
  feasibleDiagnosticVariables: {
    status: "available" as const,
    values: ["outcome", "market_id"],
  },
  practicalConstraints: {
    status: "none_reported" as const,
    values: [],
  },
  reportedConcerns: [
    "outcome_or_sample_discontinuity" as const,
    "group_level_assignment_or_dependence" as const,
  ],
};

const diagnosticResultInput = {
  resultKind: "quantitative" as const,
  provenance: {
    kind: "user_reported" as const,
    sourceDescription: "Researcher-entered output from the declared model",
  },
  summary: "The focal estimate remains imprecise under clustered inference.",
  reportedStatistics: [{
    label: "Policy estimate",
    estimate: 0.12,
    standardError: 0.08,
    confidenceInterval: { levelPercent: 95, lower: -0.04, upper: 0.28 },
    pValue: 0.14,
  }],
  covariance: {
    status: "not_applicable" as const,
    dimension: null,
    values: [],
  },
  uncertaintyContext: {
    status: "assessed" as const,
    description: "Cluster-robust uncertainty is reported.",
  },
  specificationContext:
    "Annual outcome model with market fixed effects and clustered uncertainty.",
  power: {
    status: "assessed" as const,
    description: "The interval includes substantively important effects.",
  },
  multipleTesting: {
    status: "not_applicable" as const,
    description: "One prespecified focal estimate was inspected.",
  },
  sampleComposition: {
    status: "assessed" as const,
    description: "The same market groups enter each period.",
  },
  precision: {
    status: "assessed" as const,
    description: "The interval is too wide to exclude important effects.",
  },
  postInspectionChange: {
    status: "none_reported" as const,
    description: null,
  },
};

async function harness() {
  const fixture = createBrowserEventCardFixture();
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  const evidenceStore = new SixScreenEvidenceStore(storage);
  const taskStore = new SixScreenResearchTaskStore(storage);
  await store.create({
    state: fixture.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("screen-6-fixture"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-20T12:00:00.000Z",
  });
  const fetch = vi.fn(async () => {
    throw new Error("Screen 6 foundation must not make a source request.");
  });
  let tick = 30;
  const createRuntime = () => new SixScreenWorkflowRuntime({
    store,
    evidenceStore,
    taskStore,
    signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
    now: () => browserEventCardFixtureAt(tick++),
    fetch,
  });
  return {
    authentication: { runId, accessToken },
    createRuntime,
    fetch,
    fixture,
    runtime: createRuntime(),
    storage,
    store,
  };
}

function validContextualWire(plan: ReturnType<typeof createScreen6CurrentPlan>) {
  return {
    schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
    dimension_summaries: plan.dimensions.map((dimension) => ({
      dimension_id: dimension.id,
      title: `Review ${dimension.label.toLowerCase()}`,
      known_basis: `The study records ${dimension.state.toLowerCase()}.`,
      specific_concern: dimension.concern,
      next_check: dimension.check,
      material_limit: "A planned check does not establish a policy effect.",
      source_refs: [], input_refs: ["study.proposedGroups"],
    })),
    priorities: plan.priorities.slice(0, 3).map((card) => ({
      diagnostic_id: card.id,
      priority_reason: "Verify exposure before relying on this comparison.",
      study_specific_question: "Which firms meet the documented rule?",
      contextual_procedure: "Compare eligibility and proposed groups by year.",
      data_needs: "Dated eligibility and unit records.",
      concerning_pattern: "The comparison group also meets the rule.",
      alternative_explanation: "Location can misclassify exposure.",
      reassurance_limit: "Eligibility does not prove comparability.",
      next_action: "Revise the proposed groups if necessary.",
    })),
    claim_boundary: {
      planned_target: plan.boundary.plannedTarget,
      required_assumptions: "Coverage and counterfactual trends need evidence.",
      stronger_claims_not_established: "Component and mechanism effects remain unknown.",
      next_action: "Verify coverage before estimation.",
    },
    remaining_gaps: plan.gaps,
  };
}

function successfulContextualResponse(wire: unknown, id = "resp_screen6_recovery") {
  return new Response(JSON.stringify({
    id, object: "response", status: "completed", model: "gpt-6-luna",
    service_tier: "default",
    output: [{ id: `msg_${id}`, type: "message", role: "assistant",
      status: "completed", content: [{ type: "output_text",
        annotations: [], text: JSON.stringify(wire) }] }],
    usage: { input_tokens: 900, output_tokens: 500,
      total_tokens: 1_400,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 100 } },
  }), { headers: { "content-type": "application/json",
    "x-request-id": id } });
}

describe("Screen 6 uncertainty-profile runtime", () => {
  it("authorizes one bounded contextualization, persists the receipt privately, and reopens without a call", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-context-open",
    });
    const plan = opened.projection.screen6CurrentPlan;
    expect(plan.dimensions).toHaveLength(10);
    expect(plan.resultsAssessed).toBe(false);
    const priority = {
      priority_reason: "The proposed study needs verified policy coverage.",
      study_specific_question: "Which firms meet the eligibility rule?",
      contextual_procedure: "Compare dated unit records to the official rule.",
      data_needs: "Dated policy and unit eligibility records.",
      concerning_pattern: "Comparison units also meet the rule.",
      alternative_explanation: "Location is a poor proxy for exposure.",
      reassurance_limit: "Eligibility alone does not verify comparability.",
      next_action: "Revise the proposed groups if needed.",
    };
    const wire = {
      schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
      dimension_summaries: plan.dimensions.map((dimension) => ({
        dimension_id: dimension.id,
        title: `Review ${dimension.label.toLowerCase()}`,
        known_basis: `The saved study records ${dimension.state.toLowerCase()}.`,
        specific_concern: dimension.concern,
        next_check: dimension.check,
        material_limit: "No prospective check by itself establishes a causal effect.",
        source_refs: [], input_refs: ["study.proposedGroups"],
      })),
      priorities: plan.priorities.slice(0, 3).map((card) =>
        ({ diagnostic_id: card.id, ...priority })),
      claim_boundary: {
        planned_target: plan.boundary.plannedTarget,
        required_assumptions: "Actual eligibility and the comparison must be supported.",
        stronger_claims_not_established: "Neither a component nor mediation is identified.",
        next_action: "Verify coverage before estimation.",
      },
      remaining_gaps: plan.gaps,
    };
    const providerFetch = vi.fn(async (_url: RequestInfo | URL, request?: RequestInit) => {
      const envelope = JSON.parse(String(request?.body));
      expect(envelope.text.format.name).toBe(
        SCREEN6_CONTEXTUALIZATION_WIRE_VERSION);
      expect(envelope.store).toBe(false);
      expect(envelope.max_output_tokens).toBe(
        SCREEN6_CONTEXTUALIZER_OUTPUT_CEILING);
      return new Response(JSON.stringify({
        id: "resp_screen6-contextualized",
        object: "response",
        status: "completed",
        model: "gpt-6-luna",
        service_tier: "default",
        output: [{ id: "msg_screen6-contextualized", type: "message",
          role: "assistant", status: "completed",
          content: [{ type: "output_text", annotations: [],
            text: JSON.stringify(wire) }] }],
        usage: { input_tokens: 900, output_tokens: 500,
          total_tokens: 1_400,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 100 } },
      }), { headers: { "content-type": "application/json",
        "x-request-id": "screen6-contextualized" } });
    });
    let tick = 41;
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++),
      fetch: target.fetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(target.storage),
    });
    const authorized = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-contextualize-once",
      expectedPlanFingerprint: plan.inputFingerprint,
    });
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(authorized.projection.screen6Personalization).toMatchObject({
      status: "completed", supplement: wire, usage: { totalTokens: 1_400 },
    });
    expect(authorized.projection.screen6Personalization).not.toHaveProperty("receipt");
    expect(authorized.privateSnapshot.state.screen6Personalizations?.[0])
      .toMatchObject({ status: "completed",
        receipt: { providerResponseId: "resp_screen6-contextualized" } });
    const reopened = await runtime.status(target.authentication);
    expect(reopened.projection.screen6Personalization?.status).toBe("completed");
    const again = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: authorized.privateSnapshot.revision,
      operationId: "screen6-contextualize-duplicate",
      expectedPlanFingerprint: plan.inputFingerprint,
    });
    expect(again.projection.screen6Personalization?.status).toBe("completed");
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("quarantines an unusable returned supplement and does not request it again", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-invalid-context-open",
    });
    const providerFetch = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_screen6-invalid-context",
      object: "response", status: "completed", model: "gpt-6-luna",
      service_tier: "default",
      output: [{ id: "msg_screen6-invalid-context", type: "message",
        role: "assistant", status: "completed", content: [{
          type: "output_text", annotations: [],
          text: JSON.stringify({ priorities: [], claim_boundary: {
            planned_target: "The estimate was 0.4.",
            required_assumptions: "Unknown", stronger_claims_not_established: "Unknown",
            next_action: "Unknown",
          }, remaining_gaps: [] }),
        }] }],
      usage: { input_tokens: 500, output_tokens: 300, total_tokens: 800,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 } },
    }), { headers: { "content-type": "application/json" } }));
    let tick = 41;
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++),
      fetch: target.fetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(target.storage),
    });
    const failed = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-invalid-context-once",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(failed.projection.screen6Personalization?.status).toBe("validation_failed");
    expect(failed.projection.screen6Personalization?.supplement).toBeNull();
    expect(failed.privateSnapshot.state.screen6Personalizations?.[0]?.receipt)
      .toMatchObject({ providerResponseId: "resp_screen6-invalid-context" });
    const repeated = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: failed.privateSnapshot.revision,
      operationId: "screen6-invalid-context-again",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(repeated.projection.screen6CurrentPlan.status).toBe("plan_only");
    expect(repeated.projection.screen6Personalization?.status)
      .toBe("validation_failed");
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("releases a proven pre-dispatch failure and records a distinct explicit retry", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-retry-open",
    });
    const wire = validContextualWire(opened.projection.screen6CurrentPlan);
    const canonicalMutate = target.store.mutate.bind(target.store);
    let rejectMarker = true;
    vi.spyOn(target.store, "mutate").mockImplementation((mutation, updater) => {
      if (rejectMarker && mutation.operationKind ===
        "screen6_contextualization_dispatch") {
        rejectMarker = false;
        throw new Error("Injected pre-dispatch storage failure.");
      }
      return canonicalMutate(mutation, updater);
    });
    const providerFetch = vi.fn(async () => successfulContextualResponse(wire));
    const ledger = new Screen5OpenAILedgerStore(target.storage);
    let tick = 41;
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: target.fetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });
    const first = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-retry-first",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(first.projection.screen6Personalization).toMatchObject({
      status: "failed", retryEligibility: "new_request",
    });
    expect(first.privateSnapshot.state.screen6Personalizations?.[0])
      .toMatchObject({ attemptOrdinal: 1,
        dispatchState: "not_dispatched" });
    expect(providerFetch).not.toHaveBeenCalled();
    expect(await ledger.summary()).toMatchObject({
      attemptsHeld: 0, tokensHeld: 0,
    });
    const second = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen6-retry-second-explicit",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(second.projection.screen6Personalization).toMatchObject({
      status: "completed", retryEligibility: "none",
    });
    expect(second.privateSnapshot.state.screen6Personalizations)
      .toMatchObject([{ status: "failed", attemptOrdinal: 1 },
        { status: "completed", attemptOrdinal: 2,
          id: expect.stringMatching(/-a2$/u),
          reservationId: expect.stringMatching(/-a2$/u) }]);
    expect(await ledger.summary()).toMatchObject({
      attemptsSettled: 1, attemptsHeld: 0, tokensConsumed: 1_400,
    });
  });

  it("restores a saved receipt locally without an OpenAI key after navigation", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-receipt-open",
    });
    const wire = validContextualWire(opened.projection.screen6CurrentPlan);
    const canonicalMutate = target.store.mutate.bind(target.store);
    let rejectCompleted = true;
    vi.spyOn(target.store, "mutate").mockImplementation((mutation, updater) => {
      if (rejectCompleted && mutation.operationKind ===
        "screen6_contextualization_receipt_completed") {
        rejectCompleted = false;
        throw new Error("Injected completion persistence failure.");
      }
      return canonicalMutate(mutation, updater);
    });
    let tick = 41;
    const providerFetch = vi.fn(async () => {
      const current = await target.runtime.status(target.authentication);
      await target.runtime.openScreen6(target.authentication, {
        expectedRevision: current.privateSnapshot.revision,
        operationId: "screen6-navigate-while-request-in-flight",
      });
      return successfulContextualResponse(wire, "resp_screen6_replayed");
    });
    const ledger = new Screen5OpenAILedgerStore(target.storage);
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: target.fetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });
    const first = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-receipt-first",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(first.projection.screen6Personalization).toMatchObject({
      status: "receipt_saved", retryEligibility: "local_revalidation",
      providerResponseId: "resp_screen6_replayed",
    });
    expect(first.privateSnapshot.state.screen6Personalizations?.[0]?.receipt)
      .toMatchObject({ providerResponseId: "resp_screen6_replayed" });
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const offline = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: target.fetch,
    });
    const restored = await offline.personalizeScreen6(target.authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen6-receipt-recheck-without-provider",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(restored.projection.screen6Personalization).toMatchObject({
      status: "completed", supplement: wire,
    });
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(await ledger.summary()).toMatchObject({
      attemptsSettled: 1, attemptsHeld: 0, tokensConsumed: 1_400,
    });
  });

  it("retains an unknown response when protected receipt persistence fails", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-unsaved-open",
    });
    const canonicalMutate = target.store.mutate.bind(target.store);
    vi.spyOn(target.store, "mutate").mockImplementation((mutation, updater) => {
      if (mutation.operationKind === "screen6_contextualization_receipt" ||
          mutation.operationKind ===
            "screen6_contextualization_receipt_completed") {
        throw new Error("Injected receipt persistence failure.");
      }
      return canonicalMutate(mutation, updater);
    });
    const providerFetch = vi.fn(async () => successfulContextualResponse(
      validContextualWire(opened.projection.screen6CurrentPlan),
      "resp_screen6_unpersisted"));
    const ledger = new Screen5OpenAILedgerStore(target.storage);
    let tick = 41;
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "screen-6-runtime-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: target.fetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: ledger,
    });
    const first = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-unsaved-first",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(first.projection.screen6Personalization).toMatchObject({
      status: "outcome_unknown", retryEligibility: "observe",
    });
    expect(first.privateSnapshot.state.screen6Personalizations?.[0])
      .toMatchObject({ receipt: null,
        failureCode: "receipt_persistence_failed" });
    const again = await runtime.personalizeScreen6(target.authentication, {
      expectedRevision: first.privateSnapshot.revision,
      operationId: "screen6-unsaved-do-not-resend",
      expectedPlanFingerprint: opened.projection.screen6CurrentPlan.inputFingerprint,
    });
    expect(again.projection.screen6Personalization?.status)
      .toBe("outcome_unknown");
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(await ledger.summary()).toMatchObject({
      attemptsHeld: 1, tokensHeld: SCREEN6_CONTEXTUALIZER_INPUT_CEILING +
        SCREEN6_CONTEXTUALIZER_OUTPUT_CEILING,
    });
  });

  it("persists, projects, replays, and restores the deterministic profile without I/O", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-runtime",
    });
    expect(opened.projection).toMatchObject({
      activeScreen: 6,
      canOpenScreen6: true,
      canInitializeScreen6UncertaintyProfile: true,
      screen6Prerequisites: {
        ready: true,
        blockers: [],
      },
      screen6UncertaintyWorkspace: { profile: null },
    });

    const input = {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen6-initialize-runtime",
    };
    const initialized = await target.runtime
      .initializeScreen6UncertaintyProfile(target.authentication, input);
    expect(target.fetch).not.toHaveBeenCalled();
    expect(initialized.replayed).toBe(false);
    expect(initialized.projection).toMatchObject({
      activeScreen: 6,
      canInitializeScreen6UncertaintyProfile: false,
      screen6UncertaintyWorkspace: {
        profile: {
          ordinal: 1,
          diagnosticPlanning: { status: "not_started", cards: [] },
          resultsReview: { status: "not_supplied", history: [] },
          credibilitySummary: {
            aggregateScore: null,
            universalBadge: null,
            certification: "not_available",
          },
        },
        revisions: [{
          ordinal: 1,
          gapCount: 8,
          artifactStatus: "current",
        }],
      },
    });

    const replayed = await target.runtime
      .initializeScreen6UncertaintyProfile(target.authentication, input);
    expect(replayed.replayed).toBe(true);
    expect(replayed.privateSnapshot.revision).toBe(
      initialized.privateSnapshot.revision,
    );

    const planInput = {
      expectedRevision: initialized.privateSnapshot.revision,
      operationId: "screen6-diagnostic-plan-runtime",
      diagnosticInput,
    };
    const planned = await target.runtime.saveScreen6DiagnosticPlan(
      target.authentication,
      planInput,
    );
    expect(planned.replayed).toBe(false);
    expect(planned.projection).toMatchObject({
      canSaveScreen6DiagnosticPlan: true,
      screen6UncertaintyWorkspace: {
        diagnosticPlan: {
          ordinal: 1,
          selectedDiagnosticIds: [
            "outcome-sample-continuity-v1",
            "group-inference-clustering-v1",
          ],
          resultsReview: { status: "not_supplied", history: [] },
          nonOutputs: {
            diagnosticResults: [],
            aggregateScore: null,
            universalBadge: null,
            certification: "not_available",
            conditionalClaimBoundary: null,
            disposition: null,
            designRecord: null,
          },
        },
        diagnosticPlanRevisions: [{
          ordinal: 1,
          cardCount: 2,
          artifactStatus: "current",
        }],
      },
    });
    expect(planned.projection.screen6UncertaintyWorkspace.diagnosticPlan?.cards
      .every(({ status, result }) => status === "planned" && result === null))
      .toBe(true);
    const planReplay = await target.runtime.saveScreen6DiagnosticPlan(
      target.authentication,
      planInput,
    );
    expect(planReplay.replayed).toBe(true);
    expect(planReplay.privateSnapshot.revision).toBe(
      planned.privateSnapshot.revision,
    );

    const restored = await target.createRuntime().status(
      target.authentication,
    );
    expect(restored.projection.screen6UncertaintyWorkspace.profile)
      .toEqual(initialized.projection.screen6UncertaintyWorkspace.profile);
    expect(restored.projection.screen6UncertaintyWorkspace.diagnosticPlan)
      .toEqual(planned.projection.screen6UncertaintyWorkspace.diagnosticPlan);
    expect(restored.privateSnapshot.state.screen6UncertaintyProfiles)
      .toHaveLength(1);
    expect(restored.privateSnapshot.state.screen6DiagnosticPlans)
      .toHaveLength(1);
    expect(target.fetch).not.toHaveBeenCalled();
  });

  it("rejects a stale initialization before writing a profile", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-stale-runtime",
    });
    let stale: unknown;
    try {
      await target.runtime.initializeScreen6UncertaintyProfile(
        target.authentication,
        {
          expectedRevision: target.fixture.state.revision,
          operationId: "screen6-initialize-stale-runtime",
        },
      );
    } catch (caught) {
      stale = caught;
    }
    expect(stale).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((stale as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "revision_conflict",
      stage: "revision_check",
      action: "initialize_screen6_uncertainty_profile",
      screen: 6,
      expectedRevision: target.fixture.state.revision,
      actualRevision: opened.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      safeCauseCodes: ["stale_revision"],
    });
    expect(opened.privateSnapshot.state.screen6UncertaintyProfiles).toEqual([]);
    expect(target.fetch).not.toHaveBeenCalled();
  });

  it("persists, replays, projects, reviews, and restores result intake without I/O", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-result-runtime",
    });
    const initialized = await target.runtime.initializeScreen6UncertaintyProfile(
      target.authentication,
      {
        expectedRevision: opened.privateSnapshot.revision,
        operationId: "screen6-initialize-result-runtime",
      },
    );
    const planned = await target.runtime.saveScreen6DiagnosticPlan(
      target.authentication,
      {
        expectedRevision: initialized.privateSnapshot.revision,
        operationId: "screen6-plan-result-runtime",
        diagnosticInput,
      },
    );
    const plan = planned.projection.screen6UncertaintyWorkspace.diagnosticPlan;
    const card = plan?.cards.find(({ libraryEntryId }) =>
      libraryEntryId === "group-inference-clustering-v1");
    if (!plan || !card) throw new Error("Expected Screen 6 diagnostic card.");
    const input = {
      expectedRevision: planned.privateSnapshot.revision,
      operationId: "screen6-record-result-runtime",
      cardId: card.id,
      expectedPlanFingerprint: plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput: diagnosticResultInput,
    };
    const recorded = await target.runtime.recordScreen6DiagnosticResult(
      target.authentication,
      input,
    );
    expect(recorded.replayed).toBe(false);
    expect(recorded.projection).toMatchObject({
      canRecordScreen6DiagnosticResult: true,
      canReviewScreen6DiagnosticResult: true,
      screen6UncertaintyWorkspace: {
        diagnosticResults: [{
          binding: { cardId: card.id },
          provenance: {
            kind: "user_reported",
            calculationReproducibility: "not_reproducible_from_submission",
          },
          reviewReadiness: { status: "complete_for_researcher_review" },
          nonOutputs: {
            assumptionEstablished: false,
            aggregateScore: null,
            certification: "not_available",
          },
        }],
        diagnosticResultReviews: [],
        diagnosticResultRevisions: [{
          cardId: card.id,
          artifactStatus: "current",
        }],
      },
    });
    expect(target.fetch).not.toHaveBeenCalled();
    const replayed = await target.runtime.recordScreen6DiagnosticResult(
      target.authentication,
      input,
    );
    expect(replayed.replayed).toBe(true);
    expect(replayed.privateSnapshot.revision).toBe(
      recorded.privateSnapshot.revision,
    );
    const result = recorded.projection.screen6UncertaintyWorkspace
      .diagnosticResults[0]!;
    const reviewed = await target.runtime.reviewScreen6DiagnosticResult(
      target.authentication,
      {
        expectedRevision: recorded.privateSnapshot.revision,
        operationId: "screen6-review-result-runtime",
        resultId: result.id,
        expectedResultFingerprint: result.resultFingerprint,
        decision: "concern_reduced",
        rationale:
          "The narrow inference concern is reduced under the declared clustered specification, subject to precision limits.",
        followUpActions: [],
      },
    );
    expect(reviewed.projection).toMatchObject({
      canReviewScreen6DiagnosticResult: false,
      screen6UncertaintyWorkspace: {
        diagnosticResultReviews: [{
          resultReference: { resultId: result.id },
          decision: "concern_reduced",
          assumptionEstablished: false,
          certification: "not_available",
        }],
        diagnosticResultReviewRevisions: [{
          resultId: result.id,
          decision: "concern_reduced",
          artifactStatus: "current",
        }],
      },
    });
    const restored = await target.createRuntime().status(
      target.authentication,
    );
    expect(restored.projection.screen6UncertaintyWorkspace.diagnosticResults)
      .toEqual(reviewed.projection.screen6UncertaintyWorkspace.diagnosticResults);
    expect(restored.projection.screen6UncertaintyWorkspace
      .diagnosticResultReviews).toEqual(
        reviewed.projection.screen6UncertaintyWorkspace.diagnosticResultReviews,
      );
    expect(target.fetch).not.toHaveBeenCalled();

    const entry = [...target.storage.values.entries()].find(([key]) =>
      key.startsWith("six-screen-workflow-v1:"));
    if (!entry) throw new Error("Expected stored Screen 6 result workflow.");
    const [key, storedValue] = entry;
    const record = structuredClone(storedValue) as SixScreenWorkflowStoreRecord;
    const storedResult = record.state.screen6DiagnosticResults?.[0];
    if (!storedResult) throw new Error("Expected stored Screen 6 result.");
    storedResult.nonOutputs.aggregateScore = 87 as never;
    const { resultFingerprint: _fingerprint, ...resultBody } = storedResult;
    storedResult.resultFingerprint = fingerprintSixScreenValue(resultBody);
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    target.storage.values.set(key, record);
    await expect(target.store.read(target.authentication)).rejects.toThrow(
      /diagnostic result is invalid/iu,
    );
  });

  it("persists, replays, projects, and restores the conditional boundary and planning disposition without I/O", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-boundary-runtime",
    });
    const initialized = await target.runtime.initializeScreen6UncertaintyProfile(
      target.authentication,
      {
        expectedRevision: opened.privateSnapshot.revision,
        operationId: "screen6-initialize-boundary-runtime",
      },
    );
    const planned = await target.runtime.saveScreen6DiagnosticPlan(
      target.authentication,
      {
        expectedRevision: initialized.privateSnapshot.revision,
        operationId: "screen6-plan-boundary-runtime",
        diagnosticInput,
      },
    );
    const plan = planned.projection.screen6UncertaintyWorkspace.diagnosticPlan;
    if (!plan) throw new Error("Expected Screen 6 diagnostic plan.");
    const input = {
      expectedRevision: planned.privateSnapshot.revision,
      operationId: "screen6-save-boundary-runtime",
      expectedPlanFingerprint: plan.planFingerprint,
      claimInput: {
        intendedClaimLevel: "package_effect" as const,
        targetDescription:
          "the effect of legal eligibility for the policy package on the stated outcome",
      },
    };
    const saved = await target.runtime.saveScreen6ConditionalClaimBoundary(
      target.authentication,
      input,
    );
    expect(saved.replayed).toBe(false);
    expect(saved.projection).toMatchObject({
      canSaveScreen6ConditionalClaimBoundary: true,
      canRecordScreen6ResearchPlanningDisposition: true,
      screen6UncertaintyWorkspace: {
        conditionalClaimBoundary: {
          intendedClaim: {
            claimLevel: "package_effect",
            relationshipToCurrentDesign:
              "current_design_target_not_established",
            resultsAware: false,
          },
          preparation: {
            networkRequests: 0,
            modelCalls: 0,
            localRoutineCalls: 0,
          },
          nonOutputs: {
            causalCertification: "not_available",
            aggregateScore: null,
            credibilityPlanExport: null,
            reportBundle: null,
            designRecord: null,
          },
        },
        conditionalClaimBoundaryRevisions: [{
          ordinal: 1,
          claimLevel: "package_effect",
          artifactStatus: "current",
        }],
      },
    });
    const replayed = await target.runtime.saveScreen6ConditionalClaimBoundary(
      target.authentication,
      input,
    );
    expect(replayed.replayed).toBe(true);
    expect(replayed.privateSnapshot.revision).toBe(
      saved.privateSnapshot.revision,
    );
    const boundary = saved.projection.screen6UncertaintyWorkspace
      .conditionalClaimBoundary;
    if (!boundary) throw new Error("Expected conditional claim boundary.");
    const disposition = await target.runtime
      .recordScreen6ResearchPlanningDisposition(target.authentication, {
        expectedRevision: saved.privateSnapshot.revision,
        operationId: "screen6-record-disposition-runtime",
        expectedBoundaryFingerprint: boundary.boundaryFingerprint,
        decision: "current_information_insufficient_for_intended_claim",
        rationale:
          "A current selected comparison is not available for the intended package-effect claim.",
        specifiedRevisions: [],
      });
    expect(disposition.projection).toMatchObject({
      canRecordScreen6ResearchPlanningDisposition: false,
      canCreateScreen6ResearchExport: true,
      screen6UncertaintyWorkspace: {
        researchPlanningDisposition: {
          decision: "current_information_insufficient_for_intended_claim",
          recommendationType: "research_planning_not_causal_certification",
          automaticDesignMutation: "none",
          attributionUpgrade: "none",
          causalCertification: "not_available",
          aggregateScore: null,
          designRecord: null,
        },
        researchPlanningDispositionRevisions: [{
          ordinal: 1,
          decision: "current_information_insufficient_for_intended_claim",
          artifactStatus: "current",
        }],
        researchExport: null,
        researchExportRevisions: [],
      },
    });
    const exportInput = {
      expectedRevision: disposition.privateSnapshot.revision,
      operationId: "screen6-create-research-export-runtime",
      expectedDispositionFingerprint:
        disposition.projection.screen6UncertaintyWorkspace
          .researchPlanningDisposition!.dispositionFingerprint,
    };
    const exported = await target.runtime.createScreen6ResearchExport(
      target.authentication,
      exportInput,
    );
    expect(exported.replayed).toBe(false);
    expect(exported.projection).toMatchObject({
      canCreateScreen6ResearchExport: false,
      screen6UncertaintyWorkspace: {
        researchExport: {
          completeness: { status: "partial" },
          designRecord: {
            recordStatus: "final_current_snapshot_partial",
          },
          preparation: {
            actor: "researcher",
            method: "deterministic_fixed_software",
            networkRequests: 0,
            modelCalls: 0,
            localRoutineCalls: 0,
            exportAction: "explicit",
          },
          nonOutputs: {
            treatmentEffectEstimate: null,
            aggregateScore: null,
            causalCertification: "not_available",
            assumptionProof: null,
            attributionUpgrade: null,
            automaticDesignMutation: null,
          },
        },
        researchExportRevisions: [{
          ordinal: 1,
          completenessStatus: "partial",
          artifactStatus: "current",
        }],
      },
    });
    const exportReplay = await target.runtime.createScreen6ResearchExport(
      target.authentication,
      exportInput,
    );
    expect(exportReplay.replayed).toBe(true);
    expect(exportReplay.privateSnapshot.revision).toBe(
      exported.privateSnapshot.revision,
    );
    const restored = await target.createRuntime().status(
      target.authentication,
    );
    expect(restored.projection.screen6UncertaintyWorkspace
      .conditionalClaimBoundary).toEqual(boundary);
    expect(restored.projection.screen6UncertaintyWorkspace
      .researchPlanningDisposition).toEqual(
        disposition.projection.screen6UncertaintyWorkspace
          .researchPlanningDisposition,
      );
    expect(restored.projection.screen6UncertaintyWorkspace.researchExport)
      .toEqual(exported.projection.screen6UncertaintyWorkspace.researchExport);
    expect(restored.privateSnapshot.state.screen6ResearchExports)
      .toHaveLength(1);
    expect(target.fetch).not.toHaveBeenCalled();
  });

  it("rejects re-fingerprinted favorable-status tampering during durable read", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-tamper-runtime",
    });
    await target.runtime.initializeScreen6UncertaintyProfile(
      target.authentication,
      {
        expectedRevision: opened.privateSnapshot.revision,
        operationId: "screen6-initialize-tamper-runtime",
      },
    );
    const entry = [...target.storage.values.entries()].find(([key]) =>
      key.startsWith("six-screen-workflow-v1:"));
    if (!entry) throw new Error("Expected stored Screen 6 workflow.");
    const [key, storedValue] = entry;
    const record = structuredClone(storedValue) as SixScreenWorkflowStoreRecord;
    const profile = record.state.screen6UncertaintyProfiles?.[0];
    if (!profile) throw new Error("Expected stored Screen 6 profile.");
    profile.dimensions[0]!.state = "concern_reduced_under_stated_assumptions";
    const { profileFingerprint: _fingerprint, ...profileBody } = profile;
    profile.profileFingerprint = fingerprintSixScreenValue(profileBody);
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    target.storage.values.set(key, record);

    await expect(target.store.read(target.authentication)).rejects.toThrow(
      /uncertainty profile is invalid/iu,
    );
  });

  it("rejects re-fingerprinted diagnostic-card tampering during durable read", async () => {
    const target = await harness();
    const opened = await target.runtime.openScreen6(target.authentication, {
      expectedRevision: target.fixture.state.revision,
      operationId: "screen6-open-plan-tamper-runtime",
    });
    const initialized = await target.runtime.initializeScreen6UncertaintyProfile(
      target.authentication,
      {
        expectedRevision: opened.privateSnapshot.revision,
        operationId: "screen6-initialize-plan-tamper-runtime",
      },
    );
    await target.runtime.saveScreen6DiagnosticPlan(target.authentication, {
      expectedRevision: initialized.privateSnapshot.revision,
      operationId: "screen6-plan-tamper-runtime",
      diagnosticInput,
    });
    const entry = [...target.storage.values.entries()].find(([key]) =>
      key.startsWith("six-screen-workflow-v1:"));
    if (!entry) throw new Error("Expected stored Screen 6 workflow.");
    const [key, storedValue] = entry;
    const record = structuredClone(storedValue) as SixScreenWorkflowStoreRecord;
    const plan = record.state.screen6DiagnosticPlans?.[0];
    if (!plan) throw new Error("Expected stored Screen 6 diagnostic plan.");
    plan.cards[0]!.patternsRaisingConcern[0] =
      "No pattern can ever raise concern.";
    const { planFingerprint: _fingerprint, ...planBody } = plan;
    plan.planFingerprint = fingerprintSixScreenValue(planBody);
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    target.storage.values.set(key, record);

    await expect(target.store.read(target.authentication)).rejects.toThrow(
      /diagnostic plan is invalid/iu,
    );
    expect(target.fetch).not.toHaveBeenCalled();
  });
});
