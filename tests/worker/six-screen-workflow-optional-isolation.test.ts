import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { createScreen5OpenAIProviderReceipt } from
  "../../src/core/six-screen/screen5-mechanism";
import {
  SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
  type Screen6Contextualization,
} from
  "../../src/worker/screen6-contextualizer";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
  SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION,
  type SixScreenWorkflowStoreRecord,
} from "../../src/worker/six-screen-workflow-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

function fixture() {
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  const state = createBrowserEventCardFixture().state;
  const authentication = {
    runId: state.runId, accessToken: browserEventCardFixtureAccessToken,
  };
  const key = `six-screen-workflow-v1:${state.runId}`;
  async function seed() {
    await store.create({ state,
      accessToken: authentication.accessToken,
      createInputFingerprint: fingerprintSixScreenValue("optional-isolation"),
      createdAt: browserEventCardFixtureAt(0),
      expiresAt: browserEventCardFixtureAt(1_000),
    });
    return structuredClone(storage.values.get(key)) as SixScreenWorkflowStoreRecord;
  }
  function put(record: SixScreenWorkflowStoreRecord) {
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    storage.values.set(key, structuredClone(record));
  }
  return { storage, store, state, authentication, key, seed, put };
}

function validSavedScreen6Wire(
  plan: ReturnType<typeof createScreen6CurrentPlan>,
): Screen6Contextualization {
  const preferred = [
    ...plan.priorities.filter(({ id }) =>
      id === "exposure-and-comparator" || id === "timing-anticipation-v1"),
    ...(plan.study.selectedComparison ? plan.priorities.filter(({ id }) =>
      id.startsWith("did-") || id.startsWith("rd-")) : []),
    ...plan.priorities,
  ];
  const priorities = preferred.filter((item, index, all) =>
    all.findIndex(({ id }) => id === item.id) === index).slice(0, 3);
  return {
    schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
    dimension_summaries: plan.dimensions.map((dimension) => ({
      dimension_id: dimension.id,
      title: `Review ${dimension.label.toLowerCase()}`,
      known_basis: `The saved plan records ${dimension.state.toLowerCase()}.`,
      specific_concern: dimension.concern,
      next_check: dimension.check,
      material_limit:
        "A prospective check alone does not establish a policy effect.",
      source_refs: [],
      input_refs: ["study.proposedGroups"],
    })),
    priorities: priorities.map((card) => ({
      diagnostic_id: card.id,
      priority_reason: "The proposed comparison needs this bounded check.",
      study_specific_question: "Does the saved comparison meet its assumptions?",
      contextual_procedure: "Review dated records under the saved design.",
      data_needs: "Dated eligibility and outcome records.",
      concerning_pattern: "The proposed groups do not match exposure.",
      alternative_explanation: "Location can misclassify policy exposure.",
      reassurance_limit: "Eligibility alone does not establish comparability.",
      next_action: "Revise the comparison if the concern remains.",
    })),
    claim_boundary: {
      planned_target: plan.boundary.plannedTarget,
      required_assumptions: "Eligibility and the comparison need evidence.",
      stronger_claims_not_established:
        "Component and mechanism effects remain unknown.",
      next_action: "Verify coverage before estimation.",
    },
    remaining_gaps: plan.gaps,
  };
}

function savedScreen6Receipt(wire: unknown) {
  return createScreen5OpenAIProviderReceipt({
    receivedAt: browserEventCardFixtureAt(20),
    httpStatus: 200,
    providerRequestId: "req_saved_screen6",
    providerResponseId: "resp_saved_screen6",
    serviceTier: "default",
    latencyMs: 25,
    modelObserved: "gpt-6-luna",
    finishReason: "completed",
    usage: {
      promptTokens: 900,
      completionTokens: 500,
      totalTokens: 1_400,
      reasoningTokens: 100,
      cachedPromptTokens: 0,
    },
    rateLimit: {
      retryAfterAt: null,
      tokenResetAt: null,
      remainingTokens: null,
    },
    finalContent: JSON.stringify(wire),
  });
}

function completedScreen6Record(input: {
  inputFingerprint: string;
  supplement: unknown;
  receiptWire?: unknown;
  label: string;
}) {
  const suffix = fingerprintSixScreenValue({
    inputFingerprint: input.inputFingerprint,
    label: input.label,
  }).slice("fnv1a64:".length);
  return {
    id: `screen6-plan-${suffix}`,
    inputFingerprint: input.inputFingerprint,
    reservationId: `screen6-contextualization-${suffix}`,
    status: "completed" as const,
    attemptOrdinal: 1,
    claimOperationId: `claim-${input.label}`,
    dispatchState: "dispatched" as const,
    failureCode: null,
    failureStage: null,
    receipt: savedScreen6Receipt(input.receiptWire ?? input.supplement),
    supplement: structuredClone(input.supplement),
    error: null,
    updatedAt: browserEventCardFixtureAt(25),
  };
}

describe("authenticated optional analysis isolation", () => {
  it.each([
    "screen3Contextualizations",
    "screen4InterpretationAttempts",
    "studyFirstMechanismRuns",
    "screen6Personalizations",
  ] as const)("archives an invalid %s entry and keeps authenticated study/source data readable", async (collection) => {
    const target = fixture();
    const record = await target.seed();
    const originalRevision = record.state.revision;
    const originalEvidence = structuredClone(record.state.policyEventCardReviews);
    const originalStudy = structuredClone(record.state.study);
    // A saved response/aggregate can be structurally invalid even when the
    // original state fingerprint is intact. Never repair the source or owner
    // fields to make that model history pass.
    (record.state as unknown as Record<string, unknown>)[collection] = [
      { id: "malformed-optional-analysis", receipt: {
        visibleOutput: "private receipt must remain in the archive",
      } },
    ];
    target.put(record);
    const original = structuredClone(target.storage.values.get(target.key));

    const unauthorized = await target.store.read({
      ...target.authentication, accessToken: `sa6a_${"x".repeat(43)}`,
    });
    expect(unauthorized.outcome).toBe("unauthorized");
    expect(target.storage.values.get(target.key)).toEqual(original);
    expect([...target.storage.values.keys()]
      .filter((key) => key.startsWith("six-screen-optional-analysis-archive-v1:")))
      .toEqual([]);

    const recovered = await target.store.read(target.authentication);
    expect(recovered.outcome).toBe("found");
    if (recovered.outcome !== "found") throw new Error("Expected recovery.");
    expect(recovered.record.state.revision).toBe(originalRevision + 1);
    expect(recovered.record.state.study).toEqual(originalStudy);
    expect(recovered.record.state.policyEventCardReviews).toEqual(originalEvidence);
    expect(recovered.record.state.optionalAnalysisRecovery).toMatchObject({
      schemaVersion: "six-screen-optional-analysis-recovery-v1",
      blockedScreens: [Number(collection === "screen3Contextualizations" ? 3 :
        collection === "screen4InterpretationAttempts" ? 4 :
          collection === "studyFirstMechanismRuns" ? 5 : 6)],
    });
    expect((recovered.record.state as unknown as Record<string, unknown>)[collection])
      .toEqual([]);
    expect(recovered.record.optionalAnalysisIsolations).toMatchObject([{
      schemaVersion: SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION,
      sourceStateFingerprint: record.stateFingerprint,
      items: [{ collection, index: 0,
        safeReason: "invalid_optional_analysis_record" }],
    }]);
    const archived = await target.store.readIsolationArchive(
      target.authentication, record.stateFingerprint);
    expect(archived).toEqual({ outcome: "found", original });
    const openedAgain = await target.store.read(target.authentication);
    expect(openedAgain).toEqual(recovered);
    expect([...target.storage.values.keys()]
      .filter((key) => key.startsWith("six-screen-optional-analysis-archive-v1:")))
      .toHaveLength(1);

    const next = await target.store.mutate({
      ...target.authentication,
      expectedRevision: recovered.record.state.revision,
      operationId: `navigate-after-isolation-${collection}`,
      operationKind: "navigate",
      inputFingerprint: fingerprintSixScreenValue("view"),
      updatedAt: browserEventCardFixtureAt(40),
    }, (state) => ({ state: {
      ...state, revision: state.revision + 1, activeScreen: 2,
      updatedAt: browserEventCardFixtureAt(40),
    }, result: { viewed: 2 } }));
    expect(next.outcome).toBe("updated");
    if (!next.record) throw new Error("Expected the navigated workflow.");
    expect(next.record.optionalAnalysisIsolations).toEqual(
      recovered.record.optionalAnalysisIsolations);
  });

  it("keeps valid earlier analysis while quarantining a later malformed entry", async () => {
    const target = fixture();
    const record = await target.seed();
    const fingerprint = fingerprintSixScreenValue("valid-screen6-plan");
    const suffix = fingerprint.slice("fnv1a64:".length);
    const valid = {
      id: `screen6-plan-${suffix}`,
      inputFingerprint: fingerprint,
      reservationId: `screen6-contextualization-${suffix}`,
      status: "failed" as const,
      dispatchState: "not_dispatched" as const,
      receipt: null, supplement: null, error: "Validation is pending.",
      updatedAt: browserEventCardFixtureAt(25),
    };
    record.state.screen6Personalizations = [valid, {
      ...valid, id: "bad-id", reservationId: "bad-reservation",
    }];
    target.put(record);
    const recovered = await target.store.read(target.authentication);
    expect(recovered.outcome).toBe("found");
    if (recovered.outcome !== "found") throw new Error("Expected recovery.");
    expect(recovered.record.state.screen6Personalizations).toEqual([valid]);
    expect(recovered.record.optionalAnalysisIsolations?.[0]?.items)
      .toMatchObject([{ collection: "screen6Personalizations", index: 1 }]);
  });

  it("keeps genuine current and historical Screen 6 wires bound to their receipts", async () => {
    const target = fixture();
    const record = await target.seed();
    const plan = createScreen6CurrentPlan(record.state);
    const wire = validSavedScreen6Wire(plan);
    const historicalFingerprint = fingerprintSixScreenValue(
      "historical-screen6-plan-without-reconstructable-inputs",
    );
    const current = completedScreen6Record({
      inputFingerprint: plan.inputFingerprint,
      supplement: wire,
      label: "current-plan",
    });
    const historical = completedScreen6Record({
      inputFingerprint: historicalFingerprint,
      supplement: wire,
      label: "historical-read-only",
    });
    record.state.screen6Personalizations = [current, historical];
    target.put(record);

    const reopened = await target.store.read(target.authentication);
    expect(reopened.outcome).toBe("found");
    if (reopened.outcome !== "found") throw new Error("Expected saved wires.");
    expect(reopened.record.state.screen6Personalizations)
      .toEqual([current, historical]);
    expect(reopened.record.optionalAnalysisIsolations).toBeUndefined();
  });

  it("quarantines a Screen 6 supplement that differs from valid receipt content", async () => {
    const target = fixture();
    const record = await target.seed();
    const plan = createScreen6CurrentPlan(record.state);
    const receiptWire = validSavedScreen6Wire(plan);
    const changedSupplement = structuredClone(receiptWire);
    changedSupplement.claim_boundary.next_action =
      "Use a different but still bounded next action.";
    record.state.screen6Personalizations = [completedScreen6Record({
      inputFingerprint: plan.inputFingerprint,
      supplement: changedSupplement,
      receiptWire,
      label: "receipt-mismatch",
    })];
    target.put(record);

    const recovered = await target.store.read(target.authentication);
    expect(recovered.outcome).toBe("found");
    if (recovered.outcome !== "found") throw new Error("Expected recovery.");
    expect(recovered.record.state.screen6Personalizations).toEqual([]);
    expect(recovered.record.optionalAnalysisIsolations?.[0]?.items)
      .toMatchObject([{
        collection: "screen6Personalizations",
        index: 0,
        safeReason: "invalid_optional_analysis_record",
      }]);
  });

  it("fully validates current Screen 6 IDs and bounds historical wires", async () => {
    const currentTarget = fixture();
    const currentRecord = await currentTarget.seed();
    const currentPlan = createScreen6CurrentPlan(currentRecord.state);
    const unboundCurrentWire = validSavedScreen6Wire(currentPlan);
    unboundCurrentWire.dimension_summaries[0]!.source_refs = [
      "bounded-but-not-admitted-source",
    ];
    currentRecord.state.screen6Personalizations = [completedScreen6Record({
      inputFingerprint: currentPlan.inputFingerprint,
      supplement: unboundCurrentWire,
      label: "current-unbound-source",
    })];
    currentTarget.put(currentRecord);
    const currentRecovered = await currentTarget.store.read(
      currentTarget.authentication,
    );
    expect(currentRecovered).toMatchObject({ outcome: "found", record: {
      state: { screen6Personalizations: [] },
      optionalAnalysisIsolations: [{ items: [{
        collection: "screen6Personalizations", index: 0,
      }] }],
    } });

    const historicalTarget = fixture();
    const historicalRecord = await historicalTarget.seed();
    const historicalPlan = createScreen6CurrentPlan(historicalRecord.state);
    const malformedHistoricalWire = validSavedScreen6Wire(historicalPlan);
    malformedHistoricalWire.priorities[0]!.diagnostic_id =
      "invented-historical-diagnostic";
    historicalRecord.state.screen6Personalizations = [completedScreen6Record({
      inputFingerprint: fingerprintSixScreenValue("unreconstructable-plan"),
      supplement: malformedHistoricalWire,
      label: "historical-invalid-enum",
    })];
    historicalTarget.put(historicalRecord);
    const historicalRecovered = await historicalTarget.store.read(
      historicalTarget.authentication,
    );
    expect(historicalRecovered).toMatchObject({ outcome: "found", record: {
      state: { screen6Personalizations: [] },
      optionalAnalysisIsolations: [{ items: [{
        collection: "screen6Personalizations", index: 0,
      }] }],
    } });
  });

  it("continues to reject new invalid optional output at the write boundary", async () => {
    const target = fixture();
    const initial = await target.seed();
    await expect(target.store.mutate({
      ...target.authentication,
      expectedRevision: initial.state.revision,
      operationId: "bad-new-output",
      operationKind: "save_analysis",
      inputFingerprint: fingerprintSixScreenValue("bad-output"),
      updatedAt: browserEventCardFixtureAt(50),
    }, (state) => ({ state: {
      ...state, revision: state.revision + 1,
      screen6Personalizations: [{
        id: "invalid-new-output",
      }] as typeof state.screen6Personalizations,
    }, result: null }))).rejects.toThrow(
      /Screen 6 personalization history|Screen 6 personalization record/u,
    );
    expect(target.storage.values.get(target.key)).toEqual(initial);
  });

  it("projects only a safe recovery summary through the strict registered status tool", async () => {
    const target = fixture();
    const original = await target.seed();
    const privateText = "private synthetic receipt for archival test";
    original.state.screen4InterpretationAttempts = [{
      id: "invalid-interpretation", receipt: { visibleOutput: privateText },
    }] as unknown as typeof original.state.screen4InterpretationAttempts;
    target.put(original);
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "synthetic-isolation-signing-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(55),
      fetch: vi.fn(async () => { throw new Error("No retrieval expected."); }),
    });
    const server = new McpServer({ name: "isolated-analysis", version: "1.0.0" });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "isolated-read", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "get_six_screen_workflow_v1",
        arguments: target.authentication,
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        revision: original.state.revision + 1,
        optionalAnalysisRecovery: {
          schemaVersion: "six-screen-optional-analysis-recovery-v1",
          blockedScreens: [4],
          isolatedCounts: { screen3: 0, screen4: 1, screen5: 0, screen6: 0 },
        },
      });
      expect(JSON.stringify(result)).not.toContain(privateText);
      expect(JSON.stringify(result)).not.toContain(
        "six-screen-optional-analysis-archive-v1:");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("blocks new historical Screen 5 source work before capability probes or fetch", async () => {
    const target = fixture();
    const record = await target.seed();
    const source = vi.fn(async () => { throw new Error("No source work authorized."); });
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      taskStore: new SixScreenResearchTaskStore(target.storage),
      signingKey: "synthetic-isolation-signing-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(50),
      fetch: source,
      autoProbeSourceCapabilities: true,
    });
    const input = { expectedRevision: record.state.revision };
    await expect(runtime.saveMechanismLiteraturePlan(
      target.authentication, { ...input, operationId: "legacy-plan-blocked",
        planInput: {
          explanation: { mode: "stated", text: "A proposed pathway." },
          suppliedWorks: [], preferredConstructs: [],
          feasibleDataSources: [], knownAlternativeAccounts: [],
        } },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    await expect(runtime.continueMechanismLiteratureSearch(
      target.authentication, { ...input, operationId: "legacy-search-blocked" },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    await expect(runtime.inspectScholarlyDocument(
      target.authentication, { ...input, operationId: "legacy-inspect-blocked",
        inspectionInput: {
          targetId: "synthetic-target", exactDocumentUrl: null,
          accessBasis: "not_confirmed", inspectionMode: "abstract_only",
          exactPassage: null, passagePurpose: "theoretical_proposition",
          qualification: null,
        } },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    expect(source).not.toHaveBeenCalled();
  });

  it.each([
    { screen: 3, collection: "screen3Contextualizations" },
    { screen: 4, collection: "screen4InterpretationAttempts" },
    { screen: 5, collection: "studyFirstMechanismRuns" },
    { screen: 6, collection: "screen6Personalizations" },
  ] as const)("blocks another Screen $screen model request after quarantining its attempt", async ({
    screen, collection,
  }) => {
    const target = fixture();
    const original = await target.seed();
    const screen6PlanFingerprint = createScreen6CurrentPlan(
      original.state,
    ).inputFingerprint;
    (original.state as unknown as Record<string, unknown>)[collection] = [{
      id: "malformed-saved-attempt",
      receipt: { visibleOutput: "Retained privately even after failed parsing." },
    }];
    target.put(original);
    const provider = vi.fn(async () => new Response("No dispatch allowed."));
    const source = vi.fn(async () => new Response("No retrieval allowed."));
    const runtime = new SixScreenWorkflowRuntime({
      store: target.store,
      signingKey: "synthetic-isolation-signing-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(50),
      fetch: source,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "synthetic-only-no-network",
      screen5OpenAIFetch: provider,
    });
    const input = { expectedRevision: original.state.revision,
      operationId: `after-quarantine-screen-${screen}` };
    const action = screen === 3
      ? runtime.personalizeScreen3(target.authentication, {
        ...input, expectedAdviceFingerprint: fingerprintSixScreenValue("advice"),
      })
      : screen === 4
        ? runtime.analyzeStudyFirstEvents(target.authentication, {
          ...input,
          expectedInvestigationFingerprint: fingerprintSixScreenValue("scan"),
        })
        : screen === 5
          ? runtime.ensureStudyFirstMechanismJob(target.authentication, {
            ...input,
            expectedInputFingerprint: fingerprintSixScreenValue("input"),
            expectedRunFingerprint: fingerprintSixScreenValue("run"),
          })
          : runtime.personalizeScreen6(target.authentication, {
            ...input, expectedPlanFingerprint: screen6PlanFingerprint,
          });
    await expect(action).rejects.toThrow(
      new RegExp(`Screen ${screen} has a saved analysis record that needs local recovery`, "u"),
    );
    expect(provider).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
    const authenticated = await target.store.read(target.authentication);
    expect(authenticated.outcome).toBe("found");
    expect(authenticated).toMatchObject({ record: {
      optionalAnalysisIsolations: [{ items: [{ collection }] }],
    } });
    const status = await runtime.status(target.authentication);
    expect(status.projection.optionalAnalysisRecovery.blockedScreens)
      .toEqual([screen]);
    expect(status.projection.optionalAnalysisRecovery.isolatedCounts[
      `screen${screen}` as "screen3" | "screen4" | "screen5" | "screen6"
    ]).toBe(1);
  });

  it("removes a private archive with its expired parent workflow", async () => {
    const target = fixture();
    const original = await target.seed();
    original.state.screen3Contextualizations = [{
      id: "invalid-saved-critique",
    }] as typeof original.state.screen3Contextualizations;
    target.put(original);
    await target.store.read(target.authentication);
    expect([...target.storage.values.keys()]
      .filter((key) => key.startsWith("six-screen-optional-analysis-archive-v1:")))
      .toHaveLength(1);
    const cleaned = await target.store.cleanupExpired(browserEventCardFixtureAt(1_001));
    expect(cleaned.deleted).toBe(1);
    expect([...target.storage.values.keys()]
      .filter((key) => key.startsWith("six-screen-optional-analysis-archive-v1:")))
      .toHaveLength(0);
  });

  it("rejects a changed root fingerprint and malformed official evidence without archiving", async () => {
    const target = fixture();
    const original = await target.seed();
    const damagedRoot = structuredClone(original);
    damagedRoot.state.study.outcome = "Tampered without a fingerprint update";
    target.storage.values.set(target.key, damagedRoot);
    await expect(target.store.read(target.authentication))
      .rejects.toThrow(/fingerprint is invalid/u);
    expect([...target.storage.values.keys()]).toEqual(
      expect.not.arrayContaining([expect.stringContaining("archive-v1:")]));

    const damagedEvidence = structuredClone(original);
    damagedEvidence.state.policyEventCardReviews = [{
      id: "forged-review-without-source-lineage",
    }] as typeof damagedEvidence.state.policyEventCardReviews;
    target.put(damagedEvidence);
    await expect(target.store.read(target.authentication)).rejects.toThrow();
    expect(target.storage.values.get(target.key)).toEqual(damagedEvidence);
    expect([...target.storage.values.keys()]
      .filter((key) => key.startsWith("six-screen-optional-analysis-archive-v1:")))
      .toHaveLength(0);
  });
});
