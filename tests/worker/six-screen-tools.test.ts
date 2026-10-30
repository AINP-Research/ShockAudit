import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from
  "../../src/core/six-screen/canonical";
import { decodeSixScreenWorkflowProblemText } from
  "../../src/core/six-screen/workflow-problem";
import {
  SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
  restoreSixScreenRecoverySnapshot,
} from "../../src/core/six-screen/recovery-snapshot";
import { readCurrentPolicyEvidence } from
  "../../src/core/six-screen/current-policy-evidence";
import { openScreen6 } from "../../src/core/six-screen/workflow";
import { EMPTY_STUDY_DESIGN_CLARIFICATIONS } from
  "../../src/core/six-screen/study-design-advice";
import {
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  decodeSixScreenWorkflowPayload,
  encodeSixScreenWorkflowPayload,
  sixScreenWorkflowResponseContractBody,
  sixScreenWorkflowStateTransferId,
  type SixScreenWorkflowResponseContract,
} from "../../src/core/six-screen/workflow-response-contract";
import {
  restoreSixScreenWorkflowToolResponse,
  workflowSnapshotResponseDisposition,
  type SixScreenWorkflowResponseTrace,
} from "../../src/ui/six-screen/workflow-response";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import {
  SIX_SCREEN_MUTATION_OUTCOME_META_KEY,
  SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY,
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
  registerSixScreenWorkflowTools,
} from "../../src/worker/six-screen-tools";
import {
  SixScreenWorkflowRuntime,
  type SixScreenWorkflowPrivateSnapshot,
} from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import {
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../../src/version";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const connected: Array<{ client: Client; server: McpServer }> = [];

async function harness(
  resultMetadata?: () => Record<string, unknown>,
  sourceMode: "normal" | "empty" | "error" = "normal",
) {
  let federalDocumentReads = 0;
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (sourceMode === "error") {
      return new Response("Controlled source outage", { status: 503 });
    }
    if (sourceMode === "empty") {
      return new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (!String(input).includes("/api/v1/documents")) {
      federalDocumentReads += 1;
      if (federalDocumentReads > 1) {
        return new Response(JSON.stringify({ unavailable: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        "<!doctype html><html><body><main><p>This final rule requires hospitals to implement disclosure requirements and publish standard charges.</p><p>This final rule is effective January 1, 2020.</p><p>[FR Doc. 2019-24931 Filed 11-26-19; 8:45 am]</p></main></body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    return new Response(JSON.stringify({
      count: 1,
      results: [{
        document_number: "2019-24931",
        title: "Hospital Transparency Final Rule",
        type: "Rule",
        abstract: "Hospitals must publish standard charges.",
        action: "Final rule.",
        excerpts: ["Hospitals must publish standard charges."],
        html_url:
          "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example",
        raw_text_url:
          "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html",
        publication_date: "2019-11-27",
        effective_on: "2020-01-01",
        agencies: [{ name: "Centers for Medicare & Medicaid Services" }],
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const runtime = new SixScreenWorkflowRuntime({
    store: new SixScreenWorkflowStore(storage),
    taskStore: new SixScreenResearchTaskStore(storage),
    evidenceStore: new SixScreenEvidenceStore(storage),
    signingKey: "six-screen-tools-test-key-with-more-than-thirty-two-bytes",
    now: () => "2026-09-12T10:00:00.000Z",
    fetch,
  });
  const server = new McpServer(
    { name: "six-screen-tools-test", version: "1.0.0" },
    { instructions: "Test the six-screen app-only tool surface." },
  );
  registerSixScreenWorkflowTools(server, runtime, { resultMetadata });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return { client, fetch };
}

afterEach(async () => {
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
});

const createArguments = {
  operationId: "create-1",
  shockInput: "Hospital Transparency Rule",
  requestedJurisdiction: "United States",
  approximateYear: "2019",
  intendedEpisode: "final rule",
  study: {
    population: "Hospitals",
    analysisUnit: "Hospital",
    geography: ["United States"],
    industry: ["Health care"],
    period: { start: "2018", end: "2025" },
    outcome: "Operating margin",
    intendedConstruct: "Organizational resilience",
    initialExplanation: null,
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "no",
  },
};

const emptyStudy = {
  population: null,
  analysisUnit: null,
  geography: [],
  industry: [],
  period: { start: null, end: null },
  outcome: null,
  outcomeMeasure: null,
  intendedConstruct: null,
  policySideConcept: null,
  initialExplanation: null,
  proposedTreatment: null,
  proposedComparison: null,
  resultsPreviouslyInspected: "not_disclosed",
} as const;

type SerializedWorkflowToolResult = {
  isError?: boolean;
  structuredContent: Record<string, unknown>;
  _meta: Record<string, unknown>;
};

function serializedWorkflowResult(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as SerializedWorkflowToolResult;
}

function elideNullObjectFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(elideNullObjectFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null)
      .map(([key, entry]) => [key, elideNullObjectFields(entry)]),
  );
}

function responseTrace(
  result: SerializedWorkflowToolResult,
  toolName: string,
): SixScreenWorkflowResponseTrace {
  return {
    toolName,
    bridgePath: "mcp-app",
    metadataKeys: Object.keys(result._meta),
    structuredContentKeys: Object.keys(result.structuredContent),
  };
}

function restoreSerializedWorkflowResult(
  result: SerializedWorkflowToolResult,
  toolName: string,
  current: SixScreenWorkflowPrivateSnapshot | null,
) {
  const restored = restoreSixScreenWorkflowToolResponse({
    structuredContent: result.structuredContent,
    metadata: result._meta,
    trace: responseTrace(result, toolName),
  });
  expect(workflowSnapshotResponseDisposition(current, restored.snapshot))
    .toBe("accept");
  return restored;
}

describe("six-screen MCP app operations", () => {
  it("returns a name-only Screen 1 study through create/get/mutate and replays a committed mutation without source work", async () => {
    const { client, fetch } = await harness();
    const createdWire = serializedWorkflowResult(await client.callTool({
      name: "create_six_screen_workflow_v1",
      arguments: {
        operationId: "screen1-schema-regression-create",
        shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      },
    }));
    expect(createdWire.isError, JSON.stringify(createdWire.structuredContent))
      .not.toBe(true);
    expect(createdWire.structuredContent).toMatchObject({
      activeScreen: 1,
      confirmedShock: null,
      study: { population: null, outcomeMeasure: null },
      screen6CurrentPlan: {
        status: "plan_only", modelCalls: 0, resultsAssessed: false,
        upstream: { policy: null },
      },
      screen6Personalization: null,
      screen6UncertaintyWorkspace: { profile: null },
    });
    const created = restoreSerializedWorkflowResult(
      createdWire, "create_six_screen_workflow_v1", null,
    );
    const auth = {
      runId: created.snapshot.runId,
      accessToken: created.snapshot.accessToken,
    };
    expect(JSON.stringify(createdWire.structuredContent))
      .not.toContain(auth.accessToken);
    expect(fetch).not.toHaveBeenCalled();

    const readWire = serializedWorkflowResult(await client.callTool({
      name: "get_six_screen_workflow_v1", arguments: auth,
    }));
    const read = restoreSerializedWorkflowResult(
      readWire, "get_six_screen_workflow_v1", created.snapshot,
    );
    expect(read.snapshot.stateFingerprint).toBe(created.snapshot.stateFingerprint);
    const mutation = {
      action: "update_study",
      expectedRevision: read.snapshot.revision,
      operationId: "screen1-schema-regression-saved-update",
      study: { ...emptyStudy, population: "California firms" },
    };
    // The client loses this response after the server has committed it.
    const lostWire = serializedWorkflowResult(await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: { ...auth, mutation },
    }));
    expect(lostWire.isError).not.toBe(true);
    const sourceCallsAfterCommit = fetch.mock.calls.length;
    const replayWire = serializedWorkflowResult(await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: { ...auth, mutation },
    }));
    expect(replayWire._meta[SIX_SCREEN_MUTATION_OUTCOME_META_KEY])
      .toBe("replayed");
    expect(replayWire.structuredContent).toEqual(lostWire.structuredContent);
    const replay = restoreSerializedWorkflowResult(
      replayWire, "mutate_six_screen_workflow_v1", read.snapshot,
    );
    const reopenedWire = serializedWorkflowResult(await client.callTool({
      name: "get_six_screen_workflow_v1", arguments: auth,
    }));
    const reopened = restoreSerializedWorkflowResult(
      reopenedWire, "get_six_screen_workflow_v1", replay.snapshot,
    );
    expect(reopened.snapshot.state.study.population).toBe("California firms");
    expect(reopened.snapshot.stateFingerprint).toBe(replay.snapshot.stateFingerprint);
    expect(fetch).toHaveBeenCalledTimes(sourceCallsAfterCommit);
    expect(fetch).not.toHaveBeenCalled();
    for (const wire of [createdWire, readWire, lostWire, replayWire, reopenedWire]) {
      const contract = wire._meta[
        SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
      ] as SixScreenWorkflowResponseContract;
      expect(fingerprintSixScreenValue(wire.structuredContent))
        .toBe(contract.publicProjectionFingerprint);
      expect(fingerprintSixScreenValue(sixScreenWorkflowResponseContractBody(contract)))
        .toBe(contract.responseFingerprint);
      // Response v6 intentionally moves the response peer with the new
      // structured-chunk protocol so a cached v5 app cannot misread it.
      expect(contract.buildId).toBe(
        "production-six-screen-handoff-2026-10-25-v109-r1",
      );
      expect(contract.uiResourceUri).toBe(
        SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      );
      expect(contract.uiResourceUri).toBe(SHOCKAUDIT_UI_RESOURCE_URI);
      expect(wire.structuredContent).not.toHaveProperty("accessToken");
    }
  });

  it("admits v24 recovery projection through registered create/get/mutate but rejects an undeclared top-level key", async () => {
    const { client } = await harness();
    const createName = "create_six_screen_workflow_v1";
    const getName = "get_six_screen_workflow_v1";
    const mutateName = "mutate_six_screen_workflow_v1";
    const createdWire = serializedWorkflowResult(await client.callTool({
      name: createName, arguments: {
        operationId: "v23-strict-create", shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
      },
    }));
    expect(createdWire.isError).not.toBe(true);
    const created = restoreSerializedWorkflowResult(createdWire, createName, null);
    const auth = { runId: created.snapshot.runId,
      accessToken: created.snapshot.accessToken };
    const readWire = serializedWorkflowResult(await client.callTool({
      name: getName, arguments: auth,
    }));
    const read = restoreSerializedWorkflowResult(readWire, getName,
      created.snapshot);
    const mutatedWire = serializedWorkflowResult(await client.callTool({
      name: mutateName, arguments: { ...auth, mutation: {
        action: "update_study", expectedRevision: read.snapshot.revision,
        operationId: "v23-strict-update", study: {
          ...emptyStudy, policySideConcept: "Transparency",
          outcome: "Firm performance", outcomeMeasure: "ROA",
          proposedTreatment: "California firms",
          proposedComparison: "Non-California firms",
        },
      } },
    }));
    expect(mutatedWire.isError, JSON.stringify(mutatedWire.structuredContent))
      .not.toBe(true);
    const mutated = restoreSerializedWorkflowResult(mutatedWire,
      mutateName, read.snapshot);
    expect(mutated.projection.study).toMatchObject({
      policySideConcept: "Transparency", outcomeMeasure: "ROA",
    });
    expect(mutated.projection.optionalAnalysisRecovery).toEqual({
      schemaVersion: "six-screen-optional-analysis-recovery-v1",
      blockedScreens: [],
      isolatedCounts: { screen3: 0, screen4: 0, screen5: 0, screen6: 0 },
    });
    expect(mutated.projection.studyFirstEventInvestigationWorkspace)
      .toMatchObject({ refreshAvailable: false,
        sourceVersionCurrent: false });
    expect(mutated.projection.screen6CurrentPlan).toMatchObject({
      upstream: { policyEvidence: { status: "not_researched" } },
    });

    let injectedProjection: unknown = { ...mutatedWire.structuredContent,
      undeclared_v23_public_key: "must be rejected" };
    const fakeRuntime = { status: vi.fn(async () => ({
      projection: injectedProjection,
      privateSnapshot: mutated.snapshot,
    })) } as unknown as SixScreenWorkflowRuntime;
    const server = new McpServer(
      { name: "v23-strict-projection", version: "1.0.0" },
    );
    registerSixScreenWorkflowTools(server, fakeRuntime);
    const injectedClient = new Client({ name: "v23-strict", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await injectedClient.connect(clientTransport);
    connected.push({ client: injectedClient, server });
    const rejected = await injectedClient.callTool({
      name: getName, arguments: auth,
    });
    expect(rejected.isError).toBe(true);
    const nested = structuredClone(mutated.projection);
    Object.assign(nested.causalComparisonWorkspace.studyFirst, { contextualization: {
      id: "screen3-critique-contract-test",
      inputFingerprint: "fnv1a64:1111111111111111",
      status: "failed", retryEligibility: "new_request",
      dispatchState: "not_dispatched", failureCode: "pre_dispatch_failure",
      supplement: null, error: "Stopped before dispatch.",
      providerResponseId: null, usage: null,
      undeclared_screen3_key: "must be rejected",
    } });
    injectedProjection = nested;
    const rejectedNested = await injectedClient.callTool({
      name: getName, arguments: auth,
    });
    expect(rejectedNested.isError).toBe(true);

    const recoveryProjection = structuredClone(mutated.projection) as any;
    recoveryProjection.causalComparisonWorkspace.studyFirst.contextualization = {
      id: "screen3-critique-contract-recovery",
      inputFingerprint: "fnv1a64:1111111111111111",
      status: "failed",
      retryEligibility: "new_request",
      dispatchState: "not_dispatched",
      failureCode: "pre_dispatch_failure",
      failureStage: "local_configuration",
      supplement: null,
      error: "Stopped before dispatch.",
      providerResponseId: null,
      usage: null,
    };
    recoveryProjection.studyFirstEventInvestigationWorkspace.discoveryTask = {
      taskId: "screen4-discovery-contract-recovery",
      state: "outcome_unknown",
      stage: "source_retrieval",
      nextAction: "observe",
      completedStepCount: 1,
      totalStepCount: 2,
      pendingStepCount: 1,
      queryCount: 1,
      documentCount: 0,
      recordsReceived: 3,
      recordsAccepted: 1,
      stopReason: "The dispatched outcome is not yet known.",
      continuationMode: "panel_driven",
      continuationDisclosure: "Reopening reads the saved checkpoint.",
    };
    recoveryProjection.studyFirstEventInvestigationWorkspace
      .interpretationQueue = {
        taskFingerprint: "fnv1a64:4444444444444444",
        status: "outcome_unknown",
        retryEligibility: "observe",
        results: [],
        error: "The dispatched model outcome is unknown.",
        diagnostic: {
          taskType: "screen4_event_interpretation",
          stage: "network",
          code: "provider_transport_unknown",
          dispatchState: "unknown",
          receiptSaved: false,
          issuePaths: [],
        },
        completedCount: 0,
        totalCount: 1,
        readiness: {
          canDispatch: false,
          blocker: "Observe the saved attempt before retrying.",
          batchCount: 0,
          maximumReservationTokens: 0,
          nextReservationTokens: 0,
          availableTokens: null,
          availableAttempts: null,
        },
      };
    recoveryProjection.modelCapability.allowance = {
      maximumAttempts: 4,
      maximumTokens: 20_000,
      conservativePriorAttempts: 0,
      conservativePriorTokens: 0,
      localAttemptsReserved: 1,
      localObservedTokens: 0,
      localHeldTokens: 5_000,
      remainingAttempts: 3,
      remainingTokens: 15_000,
    };
    recoveryProjection.screen6Personalization = {
      id: "screen6-plan-contract-recovery",
      inputFingerprint: "fnv1a64:2222222222222222",
      status: "failed",
      retryEligibility: "new_request",
      dispatchState: "not_dispatched",
      failureCode: "pre_dispatch_failure",
      failureStage: "local_configuration",
      supplement: null,
      error: "Stopped before dispatch.",
      providerResponseId: null,
      usage: null,
    };
    recoveryProjection.screen6HistoricalPersonalization = {
      id: "screen6-plan-contract-historical",
      inputFingerprint: "fnv1a64:3333333333333333",
      status: "completed",
      retryEligibility: "none",
      dispatchState: "dispatched",
      failureCode: null,
      failureStage: null,
      supplement: {
        remaining_gaps: ["Historical eligibility remains unverified."],
      },
      error: null,
      providerResponseId: "resp_contract_historical",
      usage: {
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140,
        reasoningTokens: 10,
        cachedPromptTokens: 0,
      },
    };
    injectedProjection = recoveryProjection;
    const acceptedRecovery = serializedWorkflowResult(
      await injectedClient.callTool({ name: getName, arguments: auth }),
    );
    expect(acceptedRecovery.isError,
      JSON.stringify(acceptedRecovery.structuredContent)).not.toBe(true);
    expect(acceptedRecovery.structuredContent).toMatchObject({
      causalComparisonWorkspace: { studyFirst: { contextualization: {
        failureStage: "local_configuration",
        dispatchState: "not_dispatched",
      } } },
      studyFirstEventInvestigationWorkspace: { discoveryTask: {
        state: "outcome_unknown", nextAction: "observe",
      }, interpretationQueue: {
        status: "outcome_unknown",
        diagnostic: { stage: "network", dispatchState: "unknown" },
      } },
      modelCapability: { allowance: { localHeldTokens: 5_000 } },
      screen6Personalization: {
        failureStage: "local_configuration",
        retryEligibility: "new_request",
      },
      screen6HistoricalPersonalization: {
        status: "completed", dispatchState: "dispatched",
      },
      screen6CurrentPlan: { dependencyManifest: {
        version: "screen-06-dependency-manifest-v1",
      } },
    });

    const nestedContractMutations: Array<[
      label: string,
      mutate: (projection: any) => void,
    ]> = [
      ["causal workspace", (projection) => {
        projection.causalComparisonWorkspace.undeclared = true;
      }],
      ["causal study-first workspace", (projection) => {
        projection.causalComparisonWorkspace.studyFirst.undeclared = true;
      }],
      ["Screen 3 recovery", (projection) => {
        projection.causalComparisonWorkspace.studyFirst
          .contextualization.undeclared = true;
      }],
      ["Screen 4 discovery recovery", (projection) => {
        projection.studyFirstEventInvestigationWorkspace
          .discoveryTask.undeclared = true;
      }],
      ["Screen 4 interpretation recovery", (projection) => {
        projection.studyFirstEventInvestigationWorkspace
          .interpretationQueue.diagnostic.undeclared = true;
      }],
      ["model allowance", (projection) => {
        projection.modelCapability.allowance.undeclared = true;
      }],
      ["Screen 6 dependency manifest", (projection) => {
        projection.screen6CurrentPlan.dependencyManifest
          .operational.undeclared = true;
      }],
      ["Screen 6 recovery", (projection) => {
        projection.screen6Personalization.undeclared = true;
      }],
      ["historical Screen 6 supplement", (projection) => {
        projection.screen6HistoricalPersonalization
          .supplement.undeclared = true;
      }],
    ];
    for (const [label, mutateProjection] of nestedContractMutations) {
      const invalidProjection = structuredClone(recoveryProjection);
      mutateProjection(invalidProjection);
      injectedProjection = invalidProjection;
      const rejectedContract = await injectedClient.callTool({
        name: getName, arguments: auth,
      });
      expect(rejectedContract.isError, label).toBe(true);
    }
  });

  it("preserves current policy claim and date lineage through registered read and Screen 3 mutation", async () => {
    const fixture = createBrowserEventCardFixture();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: fixture.state,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue("v23-policy-lineage"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: browserEventCardFixtureAt(1_000),
    });
    const fetch = vi.fn(async () => {
      throw new Error("Opening design advice must not fetch another source.");
    });
    const runtime = new SixScreenWorkflowRuntime({ store,
      signingKey: "v23-lineage-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(40), fetch,
    });
    const server = new McpServer({ name: "v23-lineage", version: "1.0.0" });
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "v23-lineage-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    connected.push({ client, server });
    const auth = { runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken };
    const getName = "get_six_screen_workflow_v1";
    const mutateName = "mutate_six_screen_workflow_v1";
    const readWire = serializedWorkflowResult(await client.callTool({
      name: getName, arguments: auth,
    }));
    const read = restoreSerializedWorkflowResult(readWire, getName, null);
    const original = readCurrentPolicyEvidence(read.snapshot.state);
    expect(original.coverageClaimIds).toContain("claim-coverage");
    expect(original.chronology.find(({ stage }) => stage === "legal_effect"))
      .toMatchObject({ date: { start: "2020-03-01" },
        sourceIds: ["source-provider-neutral-official-fixture"] });
    const study = fixture.state.study;
    const openedWire = serializedWorkflowResult(await client.callTool({
      name: mutateName, arguments: { ...auth, mutation: {
        action: "open_screen_3", expectedRevision: read.snapshot.revision,
        operationId: "v23-lineage-open-screen3",
        study: { population: study.population,
          analysisUnit: study.analysisUnit, geography: study.geography,
          industry: study.industry, period: study.period,
          outcome: study.outcome, outcomeMeasure: study.outcomeMeasure ?? null,
          intendedConstruct: study.intendedConstruct,
          policySideConcept: study.policySideConcept ?? null,
          initialExplanation: study.initialExplanation,
          proposedTreatment: study.proposedTreatment,
          proposedComparison: study.proposedComparison,
          resultsPreviouslyInspected: study.resultsPreviouslyInspected },
        proposedTiming: { mode: "year", year: 2023,
          milestoneReference: null },
      } },
    }));
    expect(openedWire.isError, JSON.stringify(openedWire.structuredContent))
      .not.toBe(true);
    const opened = restoreSerializedWorkflowResult(openedWire,
      mutateName, read.snapshot);
    const reopenedWire = serializedWorkflowResult(await client.callTool({
      name: getName, arguments: auth,
    }));
    const reopened = restoreSerializedWorkflowResult(reopenedWire,
      getName, opened.snapshot);
    const after = readCurrentPolicyEvidence(reopened.snapshot.state);
    expect(after.reviewFingerprint).toBe(original.reviewFingerprint);
    expect(after.coverageClaimIds).toContain("claim-coverage");
    expect(after.chronology.find(({ stage }) => stage === "legal_effect"))
      .toMatchObject({ claimIds: ["claim-effective"],
        sourceIds: ["source-provider-neutral-official-fixture"] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps empty results and provider outages distinct through MCP without repeating source work on replay", async () => {
    for (const sourceMode of ["empty", "error"] as const) {
      const { client, fetch } = await harness(undefined, sourceMode);
      const createdWire = serializedWorkflowResult(await client.callTool({
        name: "create_six_screen_workflow_v1",
        arguments: {
          operationId: `unlisted-policy-${sourceMode}-create`,
          shockInput: "Unlisted Federal Maritime Privacy Ordinance ZXQ",
          requestedJurisdiction: "United States",
          study: emptyStudy,
        },
      }));
      const created = restoreSerializedWorkflowResult(
        createdWire, "create_six_screen_workflow_v1", null,
      );
      const auth = { runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken };
      const mutation = { action: "resolve_shock", expectedRevision: 0,
        operationId: `unlisted-policy-${sourceMode}-resolve` };
      const firstWire = serializedWorkflowResult(await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: { ...auth, mutation },
      }));
      expect(firstWire.isError).not.toBe(true);
      const resolved = restoreSerializedWorkflowResult(
        firstWire, "mutate_six_screen_workflow_v1", created.snapshot,
      );
      expect(firstWire.structuredContent).toMatchObject({
        confirmedShock: null,
        candidates: [],
        identityResolution: { status: sourceMode === "error"
          ? "source_unavailable" : "not_resolved" },
        screen6Personalization: null,
      });
      expect(fetch.mock.calls.length).toBeGreaterThan(0);
      const sourceCalls = fetch.mock.calls.length;
      const replayWire = serializedWorkflowResult(await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: { ...auth, mutation },
      }));
      expect(replayWire._meta[SIX_SCREEN_MUTATION_OUTCOME_META_KEY])
        .toBe("replayed");
      expect(replayWire.structuredContent).toEqual(firstWire.structuredContent);
      const replay = restoreSerializedWorkflowResult(
        replayWire, "mutate_six_screen_workflow_v1", resolved.snapshot,
      );
      const reopenedWire = serializedWorkflowResult(await client.callTool({
        name: "get_six_screen_workflow_v1", arguments: auth,
      }));
      const reopened = restoreSerializedWorkflowResult(
        reopenedWire, "get_six_screen_workflow_v1", replay.snapshot,
      );
      expect(reopened.snapshot.stateFingerprint).toBe(replay.snapshot.stateFingerprint);
      expect(fetch).toHaveBeenCalledTimes(sourceCalls);
    }
  });

  it("reopens a saved Screen 6 library plan through the registered get tool without model calls", async () => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen6(fixture.state, {
      expectedRevision: fixture.state.revision,
      openedAt: browserEventCardFixtureAt(25),
    });
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({
      state: opened.state,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue("registered-screen6-read"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: browserEventCardFixtureAt(1_000),
    });
    const fetch = vi.fn(async () => {
      throw new Error("Screen 6 read must not fetch any source or model.");
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      signingKey: "registered-screen6-read-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(26),
      fetch,
    });
    const server = new McpServer(
      { name: "screen6-registered-read", version: "1.0.0" },
    );
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({ name: "screen6-read", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    connected.push({ client, server });
    const auth = {
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    };
    const firstWire = serializedWorkflowResult(await client.callTool({
      name: "get_six_screen_workflow_v1", arguments: auth,
    }));
    expect(firstWire.isError).not.toBe(true);
    expect(firstWire.structuredContent).toMatchObject({
      activeScreen: 6,
      screen6CurrentPlan: { schemaVersion: "screen-06-current-study-plan-v3",
        status: "plan_only", modelCalls: 0, resultsAssessed: false,
        dimensions: expect.any(Array) },
      screen6Personalization: null,
    });
    expect((firstWire.structuredContent.screen6CurrentPlan as {
      dimensions: unknown[];
    }).dimensions).toHaveLength(10);
    const first = restoreSerializedWorkflowResult(
      firstWire, "get_six_screen_workflow_v1", null,
    );
    const reopenedWire = serializedWorkflowResult(await client.callTool({
      name: "get_six_screen_workflow_v1", arguments: auth,
    }));
    const reopened = restoreSerializedWorkflowResult(
      reopenedWire, "get_six_screen_workflow_v1", first.snapshot,
    );
    expect(reopened.snapshot.stateFingerprint).toBe(first.snapshot.stateFingerprint);
    expect(reopenedWire.structuredContent.screen6CurrentPlan)
      .toEqual(firstWire.structuredContent.screen6CurrentPlan);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("carries authoritative host capability metadata on the ordinary six-screen response path", async () => {
    const capability = {
      "shockaudit/hostReasoning": {
        mode: "full",
        enabled: true,
        genuineTraceCount: 0,
        availableTaskTypes: [
          "screen02-search-review",
          "screen03-evidence-mapping",
          "screen03-overview-improvement",
          "six-screen-policy-fact-proof",
          "six-screen-mechanism-proof",
          "screen04-study-event-assessment",
        ],
      },
    };
    const { client } = await harness(() => capability);
    const response = serializedWorkflowResult(await client.callTool({
      name: "create_six_screen_workflow_v1",
      arguments: {
        operationId: "capability-create",
        shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      },
    }));
    expect(response._meta).toMatchObject(capability);
    expect(response.structuredContent).not.toHaveProperty(
      "shockaudit/hostReasoning",
    );
    const bridge = new SixScreenBridge();
    const callServerTool = vi.fn(async () => response);
    (bridge as unknown as {
      app: {
        getHostCapabilities: () => { serverTools: object };
        callServerTool: typeof callServerTool;
      };
    }).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };
    expect(bridge.getHostReasoningMode()).toBeNull();
    await bridge.callToolWithMetadata(
      "create_six_screen_workflow_v1",
      { operationId: "bridge-capability-create" },
    );
    expect(bridge.getHostReasoningMode()).toBe("full");
  });

  it("keeps every state/confirmation operation app-only", async () => {
    const { client } = await harness();
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "create_six_screen_workflow_v1",
      "get_six_screen_workflow_v1",
      "retire_six_screen_workflow_v1",
      "get_six_screen_workflow_state_chunk_v2",
      "get_six_screen_recovery_snapshot_v1",
      "get_six_screen_operation_status_v1",
      "mutate_six_screen_workflow_v1",
    ]);
    for (const tool of tools) {
      expect(tool._meta).toMatchObject({
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      });
    }
  });

  it("returns one compressed canonical recovery copy without private coordinates", async () => {
    const { client } = await harness();
    const createTool = "create_six_screen_workflow_v1";
    const createdWire = serializedWorkflowResult(await client.callTool({
      name: createTool,
      arguments: {
        operationId: "compressed-recovery-create",
        shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      },
    }));
    const created = restoreSerializedWorkflowResult(
      createdWire,
      createTool,
      null,
    );

    const recovery = await client.callTool({
      name: SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
      arguments: {
        runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken,
      },
    });
    expect(recovery.isError).not.toBe(true);
    const restored = await restoreSixScreenRecoverySnapshot({
      value: recovery.structuredContent,
      expectedRunId: created.snapshot.runId,
      expectedAppVersion: SHOCKAUDIT_VERSION,
      expectedUiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
    });
    expect(restored.state).toEqual(created.snapshot.state);
    expect(restored.publicProjection).toMatchObject({
      runId: created.snapshot.runId,
      revision: created.snapshot.revision,
    });
    expect(JSON.stringify(recovery)).not.toContain(
      created.snapshot.accessToken,
    );
    expect(restored.envelope.encodedStateBytes +
      restored.envelope.encodedPublicProjectionBytes).toBeLessThan(
        restored.envelope.canonicalStateBytes +
          restored.envelope.canonicalPublicProjectionBytes,
      );
  });

  it("accepts serialized create/read/update/resolve/confirm responses and reconciles replayed or delayed receipts", async () => {
    const { client, fetch } = await harness();
    const createTool = "create_six_screen_workflow_v1";
    const readTool = "get_six_screen_workflow_v1";
    const mutateTool = "mutate_six_screen_workflow_v1";
    const createdWire = serializedWorkflowResult(await client.callTool({
      name: createTool,
      arguments: {
        operationId: "serialized-create-ccpa-name-only",
        shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      },
    }));
    const created = restoreSerializedWorkflowResult(
      createdWire,
      createTool,
      null,
    );
    const createdContract = createdWire._meta[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    expect(createdContract).toMatchObject({
      schemaVersion: "shockaudit-six-screen-workflow-response-v6",
      buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
      stateEncoding: "canonical-json-gzip-base64-v1",
      publicProjectionEncoding: "canonical-json-gzip-base64-v1",
      runId: created.snapshot.runId,
      revision: created.snapshot.revision,
    });
    expect(JSON.parse(decodeSixScreenWorkflowPayload({
      encodedPayload: createdContract.encodedPublicProjectionPayload,
      encodedBytes: createdContract.encodedPublicProjectionBytes,
      canonicalBytes: createdContract.canonicalPublicProjectionBytes,
    })))
      .toEqual(createdWire.structuredContent);
    expect(created.snapshot.state).toMatchObject({
      currentShockInput: "California Consumer Privacy Act",
      study: { population: null, outcomeMeasure: null },
    });

    const readWire = serializedWorkflowResult(await client.callTool({
      name: readTool,
      arguments: {
        runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken,
      },
    }));
    const read = restoreSerializedWorkflowResult(
      readWire,
      readTool,
      created.snapshot,
    );

    const populatedStudy = {
      population: "Entreprises françaises — Ω",
      analysisUnit: "firm-year",
      geography: ["Île-de-France"],
      industry: [],
      period: { start: "2018", end: "2025" },
      outcome: "Rendement après conformité",
      outcomeMeasure: null,
      intendedConstruct: "Résilience organisationnelle",
      policySideConcept: null,
      initialExplanation: "How did CCPA change firm outcomes?",
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "not_disclosed",
    };
    const updatedWire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: read.snapshot.runId,
        accessToken: read.snapshot.accessToken,
        mutation: {
          action: "update_study",
          expectedRevision: read.snapshot.revision,
          operationId: "serialized-update-non-ascii-study",
          study: populatedStudy,
        },
      },
    }));
    const updated = restoreSerializedWorkflowResult(
      updatedWire,
      mutateTool,
      read.snapshot,
    );
    expect(updated.snapshot.state.study).toMatchObject({
      ...populatedStudy,
      // Historical wording submitted through update cannot become a second
      // active shock construct or overwrite an existing legacy record.
      intendedConstruct: null,
      policySideConcept: null,
    });

    const resolvedWire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: updated.snapshot.runId,
        accessToken: updated.snapshot.accessToken,
        mutation: {
          action: "resolve_shock",
          expectedRevision: updated.snapshot.revision,
          operationId: "serialized-resolve-ccpa-name-only",
        },
      },
    }));
    const resolved = restoreSerializedWorkflowResult(
      resolvedWire,
      mutateTool,
      updated.snapshot,
    );
    const projection = resolvedWire.structuredContent as {
      revision: number;
      identityRevision: number;
      candidates: Array<{
        id: string;
        identityFingerprint: string;
        sourceSnapshotId: string;
        sourceSnapshotFingerprint: string;
      }>;
    };
    expect(projection.candidates).toHaveLength(1);
    expect(projection.candidates[0]?.id).toContain("ccpa");

    const candidate = projection.candidates[0]!;
    const confirmationMutation = {
      action: "confirm_shock",
      expectedRevision: resolved.snapshot.revision,
      operationId: "serialized-confirm-ccpa-name-only",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.snapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.snapshot.state.currentRequestFingerprint,
      identityRevision: projection.identityRevision,
    };
    const confirmedWire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: resolved.snapshot.runId,
        accessToken: resolved.snapshot.accessToken,
        mutation: confirmationMutation,
      },
    }));
    const confirmed = restoreSerializedWorkflowResult(
      confirmedWire,
      mutateTool,
      resolved.snapshot,
    );
    expect(confirmed.snapshot.state.confirmedShock?.officialTitle).toBe(
      "California Consumer Privacy Act",
    );

    const delayedResolved = restoreSixScreenWorkflowToolResponse({
      structuredContent: resolvedWire.structuredContent,
      metadata: resolvedWire._meta,
      trace: responseTrace(resolvedWire, mutateTool),
    });
    expect(workflowSnapshotResponseDisposition(
      confirmed.snapshot,
      delayedResolved.snapshot,
    )).toBe("obsolete");

    const replayedConfirmationWire = serializedWorkflowResult(
      await client.callTool({
        name: mutateTool,
        arguments: {
          runId: resolved.snapshot.runId,
          accessToken: resolved.snapshot.accessToken,
          mutation: confirmationMutation,
        },
      }),
    );
    const replayedConfirmation = restoreSerializedWorkflowResult(
      replayedConfirmationWire,
      mutateTool,
      confirmed.snapshot,
    );
    expect(replayedConfirmation.snapshot.stateFingerprint).toBe(
      confirmed.snapshot.stateFingerprint,
    );

    const restoredSavedWire = serializedWorkflowResult(await client.callTool({
      name: readTool,
      arguments: {
        runId: confirmed.snapshot.runId,
        accessToken: confirmed.snapshot.accessToken,
      },
    }));
    const restoredSaved = restoreSerializedWorkflowResult(
      restoredSavedWire,
      readTool,
      confirmed.snapshot,
    );
    expect(restoredSaved.snapshot.stateFingerprint).toBe(
      confirmed.snapshot.stateFingerprint,
    );

    const screen3Study = {
      population: "Fabricants Ω — Québec",
      analysisUnit: "firm-year",
      geography: ["United States", "CA"],
      industry: ["Advanced manufacturing"],
      period: { start: "2018", end: "2025" },
      outcome: "Rendement après conformité",
      outcomeMeasure: null,
      intendedConstruct: "Résilience organisationnelle",
      policySideConcept: "Protection des clients",
      initialExplanation: "Par la confiance des clients — hypothèse.",
      proposedTreatment: "Entreprises californiennes",
      proposedComparison: "Entreprises hors Californie",
      resultsPreviouslyInspected: "not_disclosed",
    };
    const opened3Wire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: restoredSaved.snapshot.runId,
        accessToken: restoredSaved.snapshot.accessToken,
        mutation: {
          action: "open_screen_3",
          expectedRevision: restoredSaved.snapshot.revision,
          operationId: "serialized-open-screen3-no-method",
          study: screen3Study,
          proposedTiming: {
            mode: "year",
            year: 2020,
            milestoneReference: null,
          },
          clarifications: {
            ...EMPTY_STUDY_DESIGN_CLARIFICATIONS,
            rd: {
              runningVariable: "Prior-year annual revenue (USD)",
              cutoff: "25000000", operator: ">=",
              assignmentRule: "Eligibility if prior-year annual revenue (USD) >= 25000000 in 2020",
              treatmentTarget: "eligibility", assignmentRelation: "unknown",
              verification: "researcher_reported", otherConditions: null,
              bindingStatus: "unknown", probabilityJump: "not_reported",
            },
          },
        },
      },
    }));
    const opened3 = restoreSerializedWorkflowResult(
      opened3Wire,
      mutateTool,
      restoredSaved.snapshot,
    );
    expect(opened3.snapshot.state.studyDesignSelections).toEqual([]);
    expect(opened3.snapshot.state.studyDesignAdvices?.at(-1)?.clarifications.rd)
      .toMatchObject({ cutoff: "25000000", verification: "researcher_reported" });
    expect((opened3Wire.structuredContent as { causalComparisonWorkspace: {
      studyFirst: { advice: { clarifications: { rd: { runningVariable: string } } } } } })
      .causalComparisonWorkspace.studyFirst.advice.clarifications.rd.runningVariable)
      .toBe("Prior-year annual revenue (USD)");

    const opened4Wire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: opened3.snapshot.runId,
        accessToken: opened3.snapshot.accessToken,
        mutation: {
          action: "open_screen_4",
          expectedRevision: opened3.snapshot.revision,
          operationId: "serialized-open-screen4-auto-scan",
        },
      },
    }));
    const opened4 = restoreSerializedWorkflowResult(
      opened4Wire,
      mutateTool,
      opened3.snapshot,
    );
    const investigation = opened4.snapshot.state
      .studyFirstEventInvestigations?.at(-1);
    expect(investigation).toMatchObject({
      context: {
        study: {
          population: "Fabricants Ω — Québec",
          outcomeMeasure: null,
        },
        methodSelection: null,
      },
      status: "completed_partial",
      presentation: {
        status: "completed_partial",
      },
    });
    expect(opened4Wire.structuredContent).toMatchObject({
      studyFirstEventInvestigationWorkspace: {
        discoveryTask: {
          state: "complete",
          completedStepCount: 19,
          pendingStepCount: 0,
          nextAction: "none",
        },
      },
    });
    // One explicit entry drains the bounded source plan while retaining one
    // durable checkpoint per step; unsupported routes do not dispatch.
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    expect(opened4.snapshot.state.studyDesignSelections).toEqual([]);
    const opened4Contract = opened4Wire._meta[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    expect(JSON.parse(decodeSixScreenWorkflowPayload({
      encodedPayload: opened4Contract.encodedPublicProjectionPayload,
      encodedBytes: opened4Contract.encodedPublicProjectionBytes,
      canonicalBytes: opened4Contract.canonicalPublicProjectionBytes,
    })))
      .toEqual(opened4Wire.structuredContent);

    const nullElidedScreen4 = structuredClone(opened4Wire);
    nullElidedScreen4.structuredContent = elideNullObjectFields(
      nullElidedScreen4.structuredContent,
    ) as Record<string, unknown>;
    const restoredNullElided = restoreSixScreenWorkflowToolResponse({
      structuredContent: nullElidedScreen4.structuredContent,
      metadata: nullElidedScreen4._meta,
      trace: responseTrace(nullElidedScreen4, mutateTool),
    });
    expect(restoredNullElided.snapshot.state
      .studyFirstEventInvestigations?.at(-1)?.context.methodSelection).toBeNull();
    expect(restoredNullElided.snapshot.state.study.outcomeMeasure).toBeNull();
    expect(restoredNullElided.snapshot.state.study.population).toBe(
      "Fabricants Ω — Québec",
    );

    const opened5Wire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: opened4.snapshot.runId,
        accessToken: opened4.snapshot.accessToken,
        mutation: {
          action: "open_screen_5",
          expectedRevision: opened4.snapshot.revision,
          operationId: "serialized-open-screen5-exact-scan",
        },
      },
    }));
    const opened5 = restoreSerializedWorkflowResult(
      opened5Wire,
      mutateTool,
      opened4.snapshot,
    );
    expect(opened5.snapshot.state.studyFirstEventScreen5Handoffs?.at(-1))
      .toMatchObject({
        investigationSnapshotId: investigation!.snapshotId,
        optionalMethodSelectionId: null,
      });

    const sourceCallsBeforeReplay = fetch.mock.calls.length;
    const replayedOpen4Wire = serializedWorkflowResult(await client.callTool({
      name: mutateTool,
      arguments: {
        runId: opened3.snapshot.runId,
        accessToken: opened3.snapshot.accessToken,
        mutation: {
          action: "open_screen_4",
          expectedRevision: opened3.snapshot.revision,
          operationId: "serialized-open-screen4-auto-scan",
        },
      },
    }));
    const replayedOpen4 = restoreSerializedWorkflowResult(
      replayedOpen4Wire,
      mutateTool,
      opened5.snapshot,
    );
    expect(fetch).toHaveBeenCalledTimes(sourceCallsBeforeReplay);
    expect(replayedOpen4.snapshot.state.studyFirstEventInvestigations)
      .toHaveLength(2);
    expect(replayedOpen4.snapshot.state.studyFirstEventInvestigations?.at(-1)
      ?.investigationFingerprint).toBe(investigation?.investigationFingerprint);
    expect(replayedOpen4.snapshot.state.studyFirstEventScreen5Handoffs)
      .toEqual(opened5.snapshot.state.studyFirstEventScreen5Handoffs);
  });

  it("distinguishes invalid serialized coordinates and restores canonical state and public payloads instead of changed legacy objects", async () => {
    const { client } = await harness();
    const toolName = "create_six_screen_workflow_v1";
    const original = serializedWorkflowResult(await client.callTool({
      name: toolName,
      arguments: {
        operationId: "serialized-contract-tamper-fixture",
        shockInput: "California Consumer Privacy Act",
        study: emptyStudy,
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      },
    }));
    const assertFailure = (
      mutate: (result: SerializedWorkflowToolResult) => void,
      expectedCode: string,
    ) => {
      const candidate = structuredClone(original);
      mutate(candidate);
      try {
        restoreSixScreenWorkflowToolResponse({
          structuredContent: candidate.structuredContent,
          metadata: candidate._meta,
          trace: responseTrace(candidate, toolName),
        });
        throw new Error("Expected the serialized response to be rejected.");
      } catch (caught) {
        expect(caught).toMatchObject({ code: expectedCode });
      }
    };
    const updateContract = (
      result: SerializedWorkflowToolResult,
      update: (contract: SixScreenWorkflowResponseContract) => void,
    ) => {
      const contract = result._meta[
        SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
      ] as SixScreenWorkflowResponseContract;
      update(contract);
      contract.stateTransferId = sixScreenWorkflowStateTransferId({
        runId: contract.runId,
        revision: contract.revision,
        stateFingerprint: contract.stateFingerprint,
        encodedStateBytes: contract.encodedStateBytes,
        canonicalStateBytes: contract.canonicalStateBytes,
      });
      contract.responseFingerprint = fingerprintSixScreenValue(
        sixScreenWorkflowResponseContractBody(contract),
      );
    };

    assertFailure((candidate) => updateContract(candidate, (contract) => {
      contract.runId = `sa6r_${"x".repeat(43)}`;
    }), "run_id");
    assertFailure((candidate) => updateContract(candidate, (contract) => {
      contract.revision += 1;
    }), "revision");
    assertFailure((candidate) => updateContract(candidate, (contract) => {
      contract.stateFingerprint = "fnv1a64:ffffffffffffffff";
      const wrapper = candidate._meta[SIX_SCREEN_WORKFLOW_META_KEY] as {
        stateFingerprint: string;
      };
      wrapper.stateFingerprint = contract.stateFingerprint;
    }), "state_fingerprint");
    assertFailure((candidate) => updateContract(candidate, (contract) => {
      contract.encodedPublicProjectionPayload += "AAAA";
      contract.encodedPublicProjectionBytes = new TextEncoder().encode(
        contract.encodedPublicProjectionPayload,
      ).byteLength;
    }), "public_payload");
    assertFailure((candidate) => updateContract(candidate, (contract) => {
      const canonicalPublic = JSON.parse(
        decodeSixScreenWorkflowPayload({
          encodedPayload: contract.encodedPublicProjectionPayload,
          encodedBytes: contract.encodedPublicProjectionBytes,
          canonicalBytes: contract.canonicalPublicProjectionBytes,
        }),
      ) as Record<string, unknown>;
      canonicalPublic.statusMessage = "Changed canonical public value";
      const encoded = encodeSixScreenWorkflowPayload(serializeSixScreenValue(
        canonicalPublic,
      ));
      contract.encodedPublicProjectionPayload = encoded.encodedPayload;
      contract.encodedPublicProjectionBytes = encoded.encodedBytes;
      contract.canonicalPublicProjectionBytes = encoded.canonicalBytes;
    }), "public_fingerprint");
    assertFailure((candidate) => updateContract(candidate, (contract) => {
      const canonicalPublic = JSON.parse(
        decodeSixScreenWorkflowPayload({
          encodedPayload: contract.encodedPublicProjectionPayload,
          encodedBytes: contract.encodedPublicProjectionBytes,
          canonicalBytes: contract.canonicalPublicProjectionBytes,
        }),
      ) as Record<string, unknown>;
      canonicalPublic.runId = `sa6r_${"p".repeat(43)}`;
      const encoded = encodeSixScreenWorkflowPayload(serializeSixScreenValue(
        canonicalPublic,
      ));
      contract.encodedPublicProjectionPayload = encoded.encodedPayload;
      contract.encodedPublicProjectionBytes = encoded.encodedBytes;
      contract.canonicalPublicProjectionBytes = encoded.canonicalBytes;
      contract.publicProjectionFingerprint = fingerprintSixScreenValue(
        canonicalPublic,
      );
    }), "public_run_id");

    const transformedLegacyObject = structuredClone(original);
    const transformedContract = transformedLegacyObject._meta[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    const legacy = transformedLegacyObject._meta[
      SIX_SCREEN_WORKFLOW_META_KEY
    ] as Record<string, unknown>;
    legacy.state = elideNullObjectFields(JSON.parse(
      decodeSixScreenWorkflowPayload({
        encodedPayload: transformedContract.encodedStatePayload,
        encodedBytes: transformedContract.encodedStateBytes,
        canonicalBytes: transformedContract.canonicalStateBytes,
      }),
    ));
    const restored = restoreSixScreenWorkflowToolResponse({
      structuredContent: transformedLegacyObject.structuredContent,
      metadata: transformedLegacyObject._meta,
      trace: responseTrace(transformedLegacyObject, toolName),
    });
    expect(restored.recoveredTransformedLegacyState).toBe(true);
    expect(restored.snapshot.state).toMatchObject({
      currentShockInput: "California Consumer Privacy Act",
      approximateYear: null,
      officialIdentifier: null,
      study: { population: null, outcome: null },
    });
    expect(restored.diagnostic.comparisons).toMatchObject({
      contractRunEqualsStateRun: true,
      contractRevisionEqualsStateRevision: true,
      stateFingerprintEqual: true,
      legacyStateMatchesCanonicalPayload: false,
    });

    const transformedLegacyPublic = elideNullObjectFields(
      structuredClone(original),
    ) as SerializedWorkflowToolResult;
    const legacyPublic = transformedLegacyPublic.structuredContent;
    expect(
      Object.keys(original.structuredContent)
        .filter((key) => !(key in legacyPublic))
        .sort(),
    ).toEqual([
      "approximateYear",
      "confirmedShock",
      "identityResolution",
      "intendedEpisode",
      "officialIdentifier",
      "policyEventCardWorkspace",
      "policyLifecycleStageReviewWorkspace",
      "policyReview",
      "requestedJurisdiction",
      "screen6HistoricalPersonalization",
      "screen6Personalization",
    ]);
    const publicContract = transformedLegacyPublic._meta[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    expect(fingerprintSixScreenValue(legacyPublic)).not.toBe(
      publicContract.publicProjectionFingerprint,
    );
    const bridge = new SixScreenBridge();
    const callServerTool = vi.fn(async () => transformedLegacyPublic);
    (bridge as unknown as {
      app: {
        getHostCapabilities: () => { serverTools: object };
        callServerTool: typeof callServerTool;
      };
    }).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };
    const bridgedPublic = await bridge.callToolWithMetadata<
      Record<string, unknown>
    >(toolName, { operationId: "bridge-public-transform-reproduction" });
    expect(bridgedPublic.trace).toMatchObject({
      toolName,
      bridgePath: "mcp-app",
    });
    const restoredPublic = restoreSixScreenWorkflowToolResponse(
      bridgedPublic,
    );
    expect(restoredPublic.recoveredTransformedLegacyState).toBe(false);
    expect(restoredPublic.recoveredTransformedLegacyProjection).toBe(true);
    expect(restoredPublic.projection).toMatchObject({
      officialIdentifier: null,
      requestedJurisdiction: null,
      confirmedShock: null,
      policyReview: null,
      study: { population: null, outcome: null },
    });
    expect(restoredPublic.diagnostic.comparisons).toMatchObject({
      contractRunEqualsPublicRun: true,
      contractRevisionEqualsPublicRevision: true,
      publicFingerprintEqual: true,
      receivedPublicFingerprintEqual: false,
      legacyPublicMatchesCanonicalPayload: false,
      receivedPublicRunEqualsCanonicalPublicRun: true,
      receivedPublicRevisionEqualsCanonicalPublicRevision: true,
    });
    expect(restoredPublic.diagnostic.shape.publicDifferences).toEqual(
      expect.arrayContaining([
        "public.officialIdentifier: missing key",
        "public.policyReview: missing key",
      ]),
    );
    const serializedDiagnostic = JSON.stringify(restored.diagnostic);
    const wrapper = transformedLegacyObject._meta[
      SIX_SCREEN_WORKFLOW_META_KEY
    ] as { accessToken: string };
    expect(serializedDiagnostic).not.toContain(wrapper.accessToken);
  });

  it("keeps the exact review workspace widget-only while returning a compact public projection", async () => {
    const workflowRunId = `sa6r_${"r".repeat(43)}`;
    const workflowAccessToken = `sa6a_${"a".repeat(43)}`;
    const workspace = {
      schemaVersion: "screen-02-policy-event-card-workspace-v1",
      availability: "ready",
      unavailableReason: null,
      reviewStatus: "in_review",
      projection: { sourcePanel: { sources: [{ exactPassage: "Widget-only evidence" }] } },
      activeReview: null,
      revisions: [],
    };
    const stageWorkspace = {
      schemaVersion: "screen-02-policy-lifecycle-stage-workspace-v1",
      entries: [{
        handoffId: "coevent-policy-lifecycle-handoff-one",
        handoffFingerprint: "fnv1a64:4444444444444444",
        targetPolicyEventCardReviewId: "policy-event-card-review-two",
        candidateProviderId: "federal_register",
        adapterAvailability: "ready",
        acquisitions: [],
        latestAcquisition: null,
        dispositions: [],
        latestDisposition: null,
        proposals: [],
        latestProposal: null,
        proposalReviews: [],
        latestProposalReview: null,
        chronologyStageOptions: ["implementation"],
        sourceDateOptions: [],
        canAcquire: true,
        canRetry: false,
        canDispose: false,
        canProposeRevision: false,
        canReviewRevision: false,
      }],
      claimBoundary:
        "Official-document acquisition and researcher disposition are preserved separately. Neither action silently changes chronology or the Event Card.",
    };
    const projection = {
      schemaVersion: "shockaudit-six-screen-public-v1",
      runId: workflowRunId,
      revision: 1,
      activeScreen: 2,
      optionalAnalysisRecovery: {
        schemaVersion: "six-screen-optional-analysis-recovery-v1",
        blockedScreens: [],
        isolatedCounts: { screen3: 0, screen4: 0, screen5: 0, screen6: 0 },
      },
      status: "shock_confirmed",
      statusMessage: "Screen 2 review is open.",
      study: {},
      originalShockInput: "Example rule",
      currentShockInput: "Example rule",
      officialSourceLocators: [],
      officialIdentifier: null,
      requestedJurisdiction: null,
      approximateYear: null,
      intendedEpisode: null,
      identityRevision: 1,
      identityResolution: null,
      candidates: [],
      confirmedShock: null,
      policyReview: null,
      policyEventCardWorkspace: workspace,
      policyLifecycleStageReviewWorkspace: stageWorkspace,
      causalComparisonWorkspace: {
        schemaVersion: "screen-03-causal-comparison-workspace-v1",
        methodLibraryVersion: "screen-03-causal-method-library-v1",
        methodLibrary: [],
        designSet: null,
        decision: null,
        revisions: [],
        studyFirst: { contextualization: null },
      },
      coEventSearchWorkspace: {
        schemaVersion: "screen-04-coevent-search-workspace-v1",
        matrix: null,
        executionPlan: null,
        execution: null,
        attempts: [],
        candidates: [],
        discoveryLeads: [],
        occurrenceReviews: [],
        duplicateReviews: [],
        relationReviews: [],
        policyLifecycleHandoffs: [],
        revisions: [],
        executionRevisions: [],
      },
      studyFirstEventInvestigationWorkspace: {
        investigation: null,
        latestScreen5Handoff: null,
        revisions: [],
        claimBoundary: "No study-first event investigation is current.",
      },
      studyFirstMechanismWorkspace: {
        schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
        currentInput: null,
        currentRun: {
          planning: { plan: { candidates: [{
            id: "proposed-process",
            hypothesisStatus: "provisional",
            proposedDirection: { mode: "single_hypothesis",
              scenarios: [{ sign: "negative" }] },
          }] } },
          providerExecution: { comparison: { mechanisms: [{
            id: "assessed-process",
            direction: { outcome_implication: "decrease" },
            sourceCheckStatus: "checked_relevant_text",
          }] } },
        },
        previousCompatibleRun: null,
        revisions: [],
        claimBoundary: "No study-first mechanism comparison is current.",
      },
      mechanismLiteratureWorkspace: {
        schemaVersion: "screen-05-mechanism-literature-workspace-v1",
        plan: null,
        revisions: [],
        claimBoundary:
          "A saved literature plan is not a literature review, mechanism analysis, prediction matrix, or causal finding.",
      },
      screen6CurrentPlan: {
        schemaVersion: "screen-06-current-study-plan-v2",
        status: "plan_only",
        modelCalls: 0,
        resultsAssessed: false,
      },
      screen6Personalization: {
        id: "screen6-plan-1111111111111111",
        status: "completed",
        supplement: { remaining_gaps: ["Historical eligibility is unverified."] },
        usage: { totalTokens: 120 },
      },
      screen6UncertaintyWorkspace: {
        schemaVersion: "screen-06-uncertainty-workspace-v1",
        profile: null,
        diagnosticPlan: null,
        diagnosticResults: [],
        diagnosticResultReviews: [],
        conditionalClaimBoundary: null,
        researchPlanningDisposition: null,
        researchExport: null,
        revisions: [],
        diagnosticPlanRevisions: [],
        diagnosticResultRevisions: [],
        diagnosticResultReviewRevisions: [],
        conditionalClaimBoundaryRevisions: [],
        researchPlanningDispositionRevisions: [],
        researchExportRevisions: [],
        claimBoundary:
          "The initial uncertainty profile is a gap inventory, not a diagnostic result.",
      },
      screen3Prerequisites: {
        ready: false,
        blockers: [],
        currentEventCardSnapshotId: null,
      },
      screen4Prerequisites: {
        ready: false,
        blockers: [],
        mode: null,
        modeLabel: null,
        currentEventCardSnapshotId: null,
        currentDesignSetSnapshotId: null,
        currentDesignDecisionSnapshotId: null,
      },
      screen5Prerequisites: {
        ready: false,
        blockers: [],
        limitations: [],
        currentEventCardSnapshotId: null,
        currentDesignSetSnapshotId: null,
        currentDesignDecisionSnapshotId: null,
        currentCoEventSnapshotId: null,
      },
      screen6Prerequisites: {
        ready: true,
        blockers: [],
        limitations: [],
        currentEventCardSnapshotId: null,
        currentDesignDecisionSnapshotId: null,
        currentCoEventSnapshotId: null,
        currentMechanismInputSnapshotId: null,
      },
      canOpenScreen2: true,
      canOpenScreen3: false,
      canOpenScreen4: false,
      canOpenScreen5: false,
      canOpenScreen6: true,
      canResearchPolicy: false,
      canContinuePolicy: false,
      canBuildCausalComparison: false,
      canDecideCausalComparison: false,
      canSaveCoEventSearchMatrix: false,
      canContinueCoEventSearch: false,
      canReviewCoEventOccurrence: false,
      canReviewCoEventDuplicates: false,
      canReviewCoEventRelations: false,
      canSaveMechanismLiteraturePlan: false,
      canCompareStudyFirstMechanisms: false,
      canContinueMechanismLiteratureSearch: false,
      canInspectScholarlyDocument: false,
      canExtractScholarlyClaim: false,
      canReviewScholarlyClaim: false,
      canPrepareMechanismSynthesisInput: false,
      canSaveMechanismReview: false,
      canInitializeScreen6UncertaintyProfile: false,
      canSaveScreen6DiagnosticPlan: false,
      canRecordScreen6DiagnosticResult: false,
      canReviewScreen6DiagnosticResult: false,
      canSaveScreen6ConditionalClaimBoundary: false,
      canRecordScreen6ResearchPlanningDisposition: false,
      canCreateScreen6ResearchExport: false,
      continuationDisclosure: "Status reads do not advance retrieval.",
    };
    const privateState = {
      schemaVersion: "shockaudit-six-screen-workflow-v1" as const,
      runId: workflowRunId,
      revision: 1,
    };
    const privateSnapshot = {
      schemaVersion: "shockaudit-six-screen-private-v1" as const,
      runId: workflowRunId,
      accessToken: workflowAccessToken,
      revision: 1,
      stateFingerprint: fingerprintSixScreenValue(privateState),
      state: privateState,
    };
    const fakeRuntime = {
      status: vi.fn(async () => ({ projection, privateSnapshot })),
      openScreen4: vi.fn(async () => ({ projection, privateSnapshot })),
      openScreen5: vi.fn(async () => ({ projection, privateSnapshot })),
      openScreen6: vi.fn(async () => ({ projection, privateSnapshot })),
      initializeScreen6UncertaintyProfile: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      saveScreen6DiagnosticPlan: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      recordScreen6DiagnosticResult: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewScreen6DiagnosticResult: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      saveScreen6ConditionalClaimBoundary: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      recordScreen6ResearchPlanningDisposition: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      createScreen6ResearchExport: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      saveCoEventSearchMatrix: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      saveMechanismLiteraturePlan: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      continueMechanismLiteratureSearch: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      inspectScholarlyDocument: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      extractScholarlyClaim: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewScholarlyClaim: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      prepareMechanismSynthesisInput: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      saveMechanismReview: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      continueCoEventSearch: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewCoEventOccurrence: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewCoEventDuplicatePair: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      routeCoEventPolicyStageToScreen2: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      acquirePolicyLifecycleStageDocument: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewPolicyLifecycleStageDocument: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      proposePolicyLifecycleStageRevision: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
      reviewPolicyLifecycleStageRevision: vi.fn(async () => ({
        projection,
        privateSnapshot,
      })),
    } as unknown as SixScreenWorkflowRuntime;
    const server = new McpServer(
      { name: "six-screen-widget-only-test", version: "1.0.0" },
      { instructions: "Test widget-only review transport." },
    );
    registerSixScreenWorkflowTools(server, fakeRuntime);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    connected.push({ client, server });

    const response = await client.callTool({
      name: "get_six_screen_workflow_v1",
      arguments: { runId: workflowRunId, accessToken: workflowAccessToken },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      policyEventCardWorkspace: null,
      policyLifecycleStageReviewWorkspace: null,
      studyFirstMechanismWorkspace: { currentRun: {
        planning: { plan: { candidates: [{ proposedDirection: {
          scenarios: [{ sign: "negative" }],
        } }] } },
        providerExecution: { comparison: { mechanisms: [{
          direction: { outcome_implication: "decrease" },
          sourceCheckStatus: "checked_relevant_text",
        }] } },
      } },
      screen6CurrentPlan: { status: "plan_only", modelCalls: 0 },
      screen6Personalization: {
        status: "completed",
        supplement: { remaining_gaps: ["Historical eligibility is unverified."] },
      },
    });
    expect(response.structuredContent)
      .not.toHaveProperty("screen6Personalization.receipt");
    expect(JSON.stringify(response.structuredContent)).not.toContain(
      "Widget-only evidence",
    );
    expect(response._meta?.[
      SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
    ]).toEqual(workspace);
    expect(response._meta?.[
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY
    ]).toEqual(stageWorkspace);

    const opened = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "open_screen_4",
          expectedRevision: 1,
          operationId: "open-screen-4-wire-test",
        },
      },
    });
    expect(opened.isError).not.toBe(true);
    expect(fakeRuntime.openScreen4).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "open-screen-4-wire-test",
      },
    );
    const screen5Opened = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "open_screen_5",
          expectedRevision: 1,
          operationId: "open-screen-5-wire-test",
        },
      },
    });
    expect(screen5Opened.isError).not.toBe(true);
    expect(fakeRuntime.openScreen5).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "open-screen-5-wire-test",
      },
    );
    const screen6Opened = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "open_screen_6",
          expectedRevision: 1,
          operationId: "open-screen-6-wire-test",
        },
      },
    });
    expect(screen6Opened.isError).not.toBe(true);
    expect(fakeRuntime.openScreen6).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "open-screen-6-wire-test",
      },
    );
    const screen6Initialized = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "initialize_screen6_uncertainty_profile",
          expectedRevision: 1,
          operationId: "initialize-screen-6-wire-test",
        },
      },
    });
    expect(screen6Initialized.isError).not.toBe(true);
    expect(fakeRuntime.initializeScreen6UncertaintyProfile).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "initialize-screen-6-wire-test",
      },
    );
    const diagnosticInput = {
      preTreatmentPeriods: {
        status: "available",
        count: 4,
        description: "2016 through 2019",
      },
      postTreatmentPeriods: {
        status: "available",
        count: 4,
        description: "2020 through 2023",
      },
      outcomeFrequency: { status: "known", value: "annual" },
      assignmentStructure: {
        status: "described",
        description: "Assignment varies across market groups.",
        timingPattern: "single_time",
        dependence: "grouped_or_clustered",
        independentGroupCount: 12,
        groupingVariables: ["market_id"],
      },
      feasibleDiagnosticVariables: {
        status: "available",
        values: ["outcome", "market_id"],
      },
      practicalConstraints: {
        status: "none_reported",
        values: [],
      },
      reportedConcerns: ["outcome_or_sample_discontinuity"],
    };
    const screen6PlanSaved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_screen6_diagnostic_plan",
          expectedRevision: 1,
          operationId: "save-screen-6-plan-wire-test",
          diagnosticInput,
        },
      },
    });
    expect(screen6PlanSaved.isError).not.toBe(true);
    expect(fakeRuntime.saveScreen6DiagnosticPlan).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "save-screen-6-plan-wire-test",
        diagnosticInput,
      },
    );
    const diagnosticResultInput = {
      resultKind: "quantitative",
      provenance: {
        kind: "user_reported",
        sourceDescription: "Researcher-entered declared-model output",
      },
      summary: "The estimate remained imprecise.",
      reportedStatistics: [{
        label: "Policy estimate",
        estimate: 0.12,
        standardError: 0.08,
        confidenceInterval: {
          levelPercent: 95,
          lower: -0.04,
          upper: 0.28,
        },
        pValue: 0.14,
      }],
      covariance: {
        status: "not_applicable",
        dimension: null,
        values: [],
      },
      uncertaintyContext: {
        status: "assessed",
        description: "Cluster-robust uncertainty was reported.",
      },
      specificationContext: "Annual declared model with market fixed effects.",
      power: {
        status: "assessed",
        description: "The interval includes important effects.",
      },
      multipleTesting: {
        status: "not_applicable",
        description: "One focal estimate was inspected.",
      },
      sampleComposition: {
        status: "assessed",
        description: "The same markets enter each period.",
      },
      precision: {
        status: "assessed",
        description: "The interval is substantively wide.",
      },
      postInspectionChange: {
        status: "none_reported",
        description: null,
      },
    };
    const screen6ResultRecorded = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "record_screen6_diagnostic_result",
          expectedRevision: 1,
          operationId: "record-screen-6-result-wire-test",
          cardId: "screen6-card-one",
          expectedPlanFingerprint: "fnv1a64:1111111111111111",
          expectedCardFingerprint: "fnv1a64:2222222222222222",
          resultInput: diagnosticResultInput,
        },
      },
    });
    expect(screen6ResultRecorded.isError).not.toBe(true);
    expect(fakeRuntime.recordScreen6DiagnosticResult).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "record-screen-6-result-wire-test",
        cardId: "screen6-card-one",
        expectedPlanFingerprint: "fnv1a64:1111111111111111",
        expectedCardFingerprint: "fnv1a64:2222222222222222",
        resultInput: diagnosticResultInput,
      },
    );
    const screen6ResultInjection = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "record_screen6_diagnostic_result",
          expectedRevision: 1,
          operationId: "inject-screen-6-result-status-wire-test",
          cardId: "screen6-card-one",
          expectedPlanFingerprint: "fnv1a64:1111111111111111",
          expectedCardFingerprint: "fnv1a64:2222222222222222",
          resultInput: diagnosticResultInput,
          certification: "causally_valid",
        },
      },
    });
    expect(screen6ResultInjection.isError).toBe(true);
    expect(fakeRuntime.recordScreen6DiagnosticResult).toHaveBeenCalledTimes(1);
    const screen6ResultReviewed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_screen6_diagnostic_result",
          expectedRevision: 1,
          operationId: "review-screen-6-result-wire-test",
          resultId: "screen6-result-one",
          expectedResultFingerprint: "fnv1a64:3333333333333333",
          decision: "inconclusive",
          rationale: "Precision remains too limited for a narrower conclusion.",
          followUpActions: ["Assess an additional prespecified specification."],
        },
      },
    });
    expect(screen6ResultReviewed.isError).not.toBe(true);
    expect(fakeRuntime.reviewScreen6DiagnosticResult).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "review-screen-6-result-wire-test",
        resultId: "screen6-result-one",
        expectedResultFingerprint: "fnv1a64:3333333333333333",
        decision: "inconclusive",
        rationale: "Precision remains too limited for a narrower conclusion.",
        followUpActions: ["Assess an additional prespecified specification."],
      },
    );
    const claimInput = {
      intendedClaimLevel: "package_effect",
      targetDescription:
        "the effect of legal eligibility for the policy package on operating margin",
    };
    const screen6BoundarySaved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_screen6_conditional_claim_boundary",
          expectedRevision: 1,
          operationId: "save-screen-6-boundary-wire-test",
          expectedPlanFingerprint: "fnv1a64:4444444444444444",
          claimInput,
        },
      },
    });
    expect(screen6BoundarySaved.isError).not.toBe(true);
    expect(fakeRuntime.saveScreen6ConditionalClaimBoundary).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "save-screen-6-boundary-wire-test",
        expectedPlanFingerprint: "fnv1a64:4444444444444444",
        claimInput,
      },
    );
    const screen6BoundaryInjection = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_screen6_conditional_claim_boundary",
          expectedRevision: 1,
          operationId: "inject-screen-6-boundary-wire-test",
          expectedPlanFingerprint: "fnv1a64:4444444444444444",
          claimInput: {
            ...claimInput,
            causalCertification: "valid",
          },
        },
      },
    });
    expect(screen6BoundaryInjection.isError).toBe(true);
    expect(fakeRuntime.saveScreen6ConditionalClaimBoundary)
      .toHaveBeenCalledTimes(1);
    const screen6DispositionRecorded = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "record_screen6_research_planning_disposition",
          expectedRevision: 1,
          operationId: "record-screen-6-disposition-wire-test",
          expectedBoundaryFingerprint: "fnv1a64:5555555555555555",
          decision: "revise_specified_parts_first",
          rationale: "Clarify component separability before estimation.",
          specifiedRevisions: [
            "Retain the package-level target unless separability is established.",
          ],
        },
      },
    });
    expect(screen6DispositionRecorded.isError).not.toBe(true);
    expect(fakeRuntime.recordScreen6ResearchPlanningDisposition)
      .toHaveBeenCalledWith(
        { runId: workflowRunId, accessToken: workflowAccessToken },
        {
          expectedRevision: 1,
          operationId: "record-screen-6-disposition-wire-test",
          expectedBoundaryFingerprint: "fnv1a64:5555555555555555",
          decision: "revise_specified_parts_first",
          rationale: "Clarify component separability before estimation.",
          specifiedRevisions: [
            "Retain the package-level target unless separability is established.",
          ],
        },
      );
    const screen6ExportCreated = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "create_screen6_research_export",
          expectedRevision: 1,
          operationId: "create-screen-6-export-wire-test",
          expectedDispositionFingerprint: "fnv1a64:6666666666666666",
        },
      },
    });
    expect(screen6ExportCreated.isError).not.toBe(true);
    expect(fakeRuntime.createScreen6ResearchExport).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "create-screen-6-export-wire-test",
        expectedDispositionFingerprint: "fnv1a64:6666666666666666",
      },
    );
    const screen6ExportInjection = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "create_screen6_research_export",
          expectedRevision: 1,
          operationId: "inject-screen-6-export-wire-test",
          expectedDispositionFingerprint: "fnv1a64:6666666666666666",
          causalCertification: "valid",
        },
      },
    });
    expect(screen6ExportInjection.isError).toBe(true);
    expect(fakeRuntime.createScreen6ResearchExport).toHaveBeenCalledTimes(1);
    const resultInjection = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_screen6_diagnostic_plan",
          expectedRevision: 1,
          operationId: "inject-screen-6-result-wire-test",
          diagnosticInput,
          diagnosticResult: { status: "passed" },
        },
      },
    });
    expect(resultInjection.isError).toBe(true);
    expect(fakeRuntime.saveScreen6DiagnosticPlan).toHaveBeenCalledTimes(1);
    const literaturePlanSaved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_mechanism_literature_plan",
          expectedRevision: 1,
          operationId: "save-screen-5-literature-plan-wire-test",
          planInput: {
            explanation: { mode: "undecided", text: null },
            suppliedWorks: [{
              id: "researcher-citation-one",
              kind: "citation",
              value: "Example Author (2026), Example study",
            }],
            preferredConstructs: ["organizational adaptation"],
            feasibleDataSources: ["dated participation filings"],
            knownAlternativeAccounts: ["concurrent market redesign"],
          },
        },
      },
    });
    expect(literaturePlanSaved.isError).not.toBe(true);
    expect(fakeRuntime.saveMechanismLiteraturePlan).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        operationId: "save-screen-5-literature-plan-wire-test",
        planInput: expect.objectContaining({
          explanation: { mode: "undecided", text: null },
        }),
      }),
    );
    const literatureContinued = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "continue_mechanism_literature_search",
          expectedRevision: 1,
          operationId: "continue-screen-5-literature-wire-test",
        },
      },
    });
    expect(literatureContinued.isError).not.toBe(true);
    expect(fakeRuntime.continueMechanismLiteratureSearch).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "continue-screen-5-literature-wire-test",
      },
    );
    const documentInspected = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "inspect_scholarly_document",
          expectedRevision: 1,
          operationId: "inspect-screen-5-document-wire-test",
          inspectionInput: {
            targetId: "scholarly-document-target-wire-test",
            exactDocumentUrl: "https://fixtures.example/article",
            accessBasis: "open_access",
            inspectionMode: "partial_text",
            exactPassage: "One exact scholarly passage.",
            passagePurpose: "theoretical_proposition",
            qualification: "Retained for later researcher review.",
          },
        },
      },
    });
    expect(documentInspected.isError).not.toBe(true);
    expect(fakeRuntime.inspectScholarlyDocument).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "inspect-screen-5-document-wire-test",
        inspectionInput: {
          targetId: "scholarly-document-target-wire-test",
          exactDocumentUrl: "https://fixtures.example/article",
          accessBasis: "open_access",
          inspectionMode: "partial_text",
          exactPassage: "One exact scholarly passage.",
          passagePurpose: "theoretical_proposition",
          qualification: "Retained for later researcher review.",
        },
      },
    );
    const claimFields = {
      theoreticalProposition:
        "Participation rules can change organizational entry-cost evaluation.",
      empiricalSetting: "Organizations in a regulated market.",
      levelOfAnalysis: "Organization",
      measuredVariables: ["perceived entry cost"],
      relevantResultOrQualification:
        "The passage does not report a causal estimate.",
      contextualFit: {
        assessment: "adjacent_setting",
        rationale: "The source setting is adjacent to the focal study.",
      },
      evidenceLevel: "empirical_evidence_different_setting",
    };
    const claimExtracted = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "extract_scholarly_claim",
          expectedRevision: 1,
          operationId: "extract-screen-5-claim-wire-test",
          passageId: "scholarly-passage-wire-test",
          expectedPassageFingerprint: "fnv1a64:5555555555555555",
          fields: claimFields,
        },
      },
    });
    expect(claimExtracted.isError).not.toBe(true);
    expect(fakeRuntime.extractScholarlyClaim).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "extract-screen-5-claim-wire-test",
        passageId: "scholarly-passage-wire-test",
        expectedPassageFingerprint: "fnv1a64:5555555555555555",
        fields: claimFields,
      },
    );
    const claimReviewed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_scholarly_claim",
          expectedRevision: 1,
          operationId: "review-screen-5-claim-wire-test",
          extractionId: "scholarly-claim-extraction-wire-test",
          expectedExtractionFingerprint: "fnv1a64:6666666666666666",
          decision: {
            mode: "corrected",
            correction: {
              ...claimFields,
              theoreticalProposition: "Corrected proposition.",
            },
          },
          rationale: "The corrected wording stays within the exact passage.",
        },
      },
    });
    expect(claimReviewed.isError).not.toBe(true);
    expect(fakeRuntime.reviewScholarlyClaim).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        operationId: "review-screen-5-claim-wire-test",
        extractionId: "scholarly-claim-extraction-wire-test",
        expectedExtractionFingerprint: "fnv1a64:6666666666666666",
        decision: expect.objectContaining({ mode: "corrected" }),
      }),
    );
    const synthesisInputPrepared = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "prepare_mechanism_synthesis_input",
          expectedRevision: 1,
          operationId: "prepare-screen-5-synthesis-input-wire-test",
          expectedClaimPacketFingerprint: "fnv1a64:7777777777777777",
        },
      },
    });
    expect(synthesisInputPrepared.isError).not.toBe(true);
    expect(fakeRuntime.prepareMechanismSynthesisInput).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "prepare-screen-5-synthesis-input-wire-test",
        expectedClaimPacketFingerprint: "fnv1a64:7777777777777777",
      },
    );
    const mechanismDraft = {
      intendedClaim: "compare_mechanisms_without_identification",
      focalMechanismId: "mechanism-a",
      mechanisms: [{
        id: "mechanism-a",
        label: "Researcher mechanism",
        role: "focal",
        decision: "retained",
        causalSequence: ["Policy changes an input.", "The outcome responds."],
        theoreticalAnchor: "Researcher-supplied anchor",
        policyConnection: "Researcher-supplied policy connection",
        contextualFit: "Researcher-supplied contextual fit",
        uncertainty: "Researcher-supplied uncertainty",
        evidenceLevel: "researcher_hypothesis",
        acceptedClaimReferences: [],
        researcherRationale: "Researcher-supplied rationale",
      }],
      predictions: [{
        id: "prediction-a",
        observation: "An observable response is recorded.",
        feasibleMeasure: "Researcher-supplied measure",
        timing: "First post-policy period",
        dataSource: "Researcher-supplied data source",
        feasibility: "feasible_now",
        priority: "high",
        assumptions: [],
        patterns: [{
          mechanismId: "mechanism-a",
          direction: "increase",
          detail: "The observable response increases.",
        }],
      }],
      overallRationale: "Researcher-supplied overall rationale",
    };
    const mechanismReviewSaved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_mechanism_review",
          expectedRevision: 1,
          operationId: "save-screen-5-mechanism-review-wire-test",
          expectedSynthesisInputFingerprint: "fnv1a64:8888888888888888",
          draft: mechanismDraft,
        },
      },
    });
    expect(mechanismReviewSaved.isError).not.toBe(true);
    expect(fakeRuntime.saveMechanismReview).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "save-screen-5-mechanism-review-wire-test",
        expectedSynthesisInputFingerprint: "fnv1a64:8888888888888888",
        draft: mechanismDraft,
      },
    );
    const saved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "save_coevent_search_matrix",
          expectedRevision: 1,
          operationId: "save-screen-4-matrix-wire-test",
          scopeInput: {
            anticipationLookback: { amount: 1, unit: "years" },
            contextLookforward: { amount: 6, unit: "months" },
            knownCoEvents: [],
            importantEntities: [],
            includeMeasurementChanges: true,
          },
        },
      },
    });
    expect(saved.isError).not.toBe(true);
    expect(fakeRuntime.saveCoEventSearchMatrix).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        operationId: "save-screen-4-matrix-wire-test",
      }),
    );
    const continued = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "continue_coevent_search",
          expectedRevision: 1,
          operationId: "continue-screen-4-provider-wire-test",
        },
      },
    });
    expect(continued.isError).not.toBe(true);
    expect(fakeRuntime.continueCoEventSearch).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      {
        expectedRevision: 1,
        operationId: "continue-screen-4-provider-wire-test",
      },
    );
    const occurrenceReviewed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_coevent_occurrence",
          expectedRevision: 1,
          operationId: "review-screen-4-occurrence-wire-test",
          candidateId: "coevent-candidate-one",
          expectedCandidateFingerprint: "fnv1a64:1111111111111111",
          decision: {
            mode: "corrected",
            correction: {
              title: "Researcher-corrected occurrence title",
              typedDates: [{ kind: "effective", value: "2021-06" }],
              affectedActivityOrPopulationLabels: ["Market operators"],
              geographyLabels: [],
            },
          },
          rationale:
            "Keep the correction researcher-supplied and separate from source metadata.",
        },
      },
    });
    expect(occurrenceReviewed.isError).not.toBe(true);
    expect(fakeRuntime.reviewCoEventOccurrence).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        candidateId: "coevent-candidate-one",
        decision: expect.objectContaining({ mode: "corrected" }),
      }),
    );
    const duplicateReviewed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_coevent_duplicate_pair",
          expectedRevision: 1,
          operationId: "review-screen-4-duplicate-wire-test",
          leftCandidateId: "coevent-candidate-one",
          leftCandidateFingerprint: "fnv1a64:1111111111111111",
          rightCandidateId: "coevent-candidate-two",
          rightCandidateFingerprint: "fnv1a64:2222222222222222",
          decision: {
            mode: "same_event_representation",
            canonicalCandidateId: "coevent-candidate-one",
          },
          rationale:
            "Link these representations without deleting either occurrence record.",
        },
      },
    });
    expect(duplicateReviewed.isError).not.toBe(true);
    expect(fakeRuntime.reviewCoEventDuplicatePair).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        leftCandidateId: "coevent-candidate-one",
        rightCandidateId: "coevent-candidate-two",
        decision: expect.objectContaining({
          mode: "same_event_representation",
        }),
      }),
    );
    const policyStageRouted = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "route_coevent_policy_stage_to_screen_2",
          expectedRevision: 1,
          operationId: "route-screen-4-policy-stage-wire-test",
          candidateId: "coevent-candidate-one",
          expectedCandidateFingerprint: "fnv1a64:1111111111111111",
          expectedOccurrenceReviewId: "coevent-occurrence-review-one",
          expectedOccurrenceReviewFingerprint: "fnv1a64:3333333333333333",
          stageKind: "litigation_or_court_order",
          rationale:
            "This retained order may postpone the focal rule and needs Event Card review.",
        },
      },
    });
    expect(policyStageRouted.isError).not.toBe(true);
    expect(fakeRuntime.routeCoEventPolicyStageToScreen2).toHaveBeenCalledWith(
      { runId: workflowRunId, accessToken: workflowAccessToken },
      expect.objectContaining({
        expectedRevision: 1,
        candidateId: "coevent-candidate-one",
        expectedOccurrenceReviewId: "coevent-occurrence-review-one",
        stageKind: "litigation_or_court_order",
      }),
    );
    const acquired = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "acquire_policy_lifecycle_stage_document",
          expectedRevision: 1,
          operationId: "acquire-screen-2-policy-stage-wire-test",
          handoffId: "coevent-policy-lifecycle-handoff-one",
          expectedHandoffFingerprint: "fnv1a64:4444444444444444",
        },
      },
    });
    expect(acquired.isError).not.toBe(true);
    expect(fakeRuntime.acquirePolicyLifecycleStageDocument)
      .toHaveBeenCalledWith(
        { runId: workflowRunId, accessToken: workflowAccessToken },
        {
          expectedRevision: 1,
          operationId: "acquire-screen-2-policy-stage-wire-test",
          handoffId: "coevent-policy-lifecycle-handoff-one",
          expectedHandoffFingerprint: "fnv1a64:4444444444444444",
        },
      );
    expect(acquired.structuredContent).toMatchObject({
      policyLifecycleStageReviewWorkspace: null,
    });
    expect(acquired._meta?.[
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY
    ]).toEqual(stageWorkspace);

    const disposed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_policy_lifecycle_stage_document",
          expectedRevision: 1,
          operationId: "dispose-screen-2-policy-stage-wire-test",
          handoffId: "coevent-policy-lifecycle-handoff-one",
          expectedHandoffFingerprint: "fnv1a64:4444444444444444",
          acquisitionId: "policy-lifecycle-acquisition-one",
          expectedAcquisitionFingerprint: "fnv1a64:5555555555555555",
          decision: "deferred",
          rationale:
            "Retain the exact source while postponing any Event Card judgment.",
        },
      },
    });
    expect(disposed.isError).not.toBe(true);
    expect(fakeRuntime.reviewPolicyLifecycleStageDocument)
      .toHaveBeenCalledWith(
        { runId: workflowRunId, accessToken: workflowAccessToken },
        expect.objectContaining({
          expectedRevision: 1,
          handoffId: "coevent-policy-lifecycle-handoff-one",
          acquisitionId: "policy-lifecycle-acquisition-one",
          decision: "deferred",
        }),
      );

    const proposed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "propose_policy_lifecycle_stage_revision",
          expectedRevision: 1,
          operationId: "propose-screen-2-policy-stage-wire-test",
          handoffId: "coevent-policy-lifecycle-handoff-one",
          expectedHandoffFingerprint: "fnv1a64:4444444444444444",
          dispositionId: "policy-lifecycle-disposition-one",
          expectedDispositionFingerprint: "fnv1a64:6666666666666666",
          chronologyStage: "implementation",
          sourceDateId: null,
          rationale:
            "Propose an undated implementation stage without applying it.",
        },
      },
    });
    expect(proposed.isError).not.toBe(true);
    expect(fakeRuntime.proposePolicyLifecycleStageRevision)
      .toHaveBeenCalledWith(
        { runId: workflowRunId, accessToken: workflowAccessToken },
        expect.objectContaining({
          expectedRevision: 1,
          handoffId: "coevent-policy-lifecycle-handoff-one",
          dispositionId: "policy-lifecycle-disposition-one",
          chronologyStage: "implementation",
          sourceDateId: null,
        }),
      );

    const proposalReviewed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "review_policy_lifecycle_stage_revision",
          expectedRevision: 1,
          operationId: "review-screen-2-policy-stage-proposal-wire-test",
          proposalId: "policy-lifecycle-proposal-one",
          expectedProposalFingerprint: "fnv1a64:7777777777777777",
          decision: "accepted_for_event_card_revision",
          rationale:
            "Accept this proposal only for a later explicit Event Card lock.",
        },
      },
    });
    expect(proposalReviewed.isError).not.toBe(true);
    expect(fakeRuntime.reviewPolicyLifecycleStageRevision)
      .toHaveBeenCalledWith(
        { runId: workflowRunId, accessToken: workflowAccessToken },
        expect.objectContaining({
          expectedRevision: 1,
          proposalId: "policy-lifecycle-proposal-one",
          decision: "accepted_for_event_card_revision",
        }),
      );

    const rejectedUnknownField = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: {
          action: "acquire_policy_lifecycle_stage_document",
          expectedRevision: 1,
          operationId: "acquire-screen-2-policy-stage-forged-field",
          handoffId: "coevent-policy-lifecycle-handoff-one",
          expectedHandoffFingerprint: "fnv1a64:4444444444444444",
          chronologyMutation: "replace",
        },
      },
    });
    expect(rejectedUnknownField.isError).toBe(true);
    expect(fakeRuntime.acquirePolicyLifecycleStageDocument)
      .toHaveBeenCalledTimes(1);
    Object.assign(projection, { undeclaredRegressionSentinel: true });
    const rejectedExtra = await client.callTool({
      name: "get_six_screen_workflow_v1",
      arguments: { runId: workflowRunId, accessToken: workflowAccessToken },
    });
    expect(rejectedExtra.isError).toBe(true);
    expect(JSON.stringify(rejectedExtra.content))
      .toContain("undeclaredRegressionSentinel");
  });

  it("keeps the possession token out of structured content and applies an exact researcher confirmation", async () => {
    const { client } = await harness();
    const created = await client.callTool({
      name: "create_six_screen_workflow_v1",
      arguments: createArguments,
    });
    expect(created.isError, JSON.stringify(created)).not.toBe(true);
    expect(created.structuredContent).toMatchObject({
      revision: 0,
      activeScreen: 1,
      status: "identity_input",
      originalShockInput: "Hospital Transparency Rule",
      confirmedShock: null,
    });
    expect(created.structuredContent).not.toHaveProperty("accessToken");
    const privateSnapshot = created._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as {
      runId: string;
      accessToken: string;
    };
    expect(privateSnapshot.accessToken).toMatch(/^sa6a_/u);
    expect(privateSnapshot).not.toHaveProperty("state");
    const createdContract = created._meta?.[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    expect(JSON.stringify(created).length).toBeLessThan(
      createdContract.canonicalStateBytes * 3 +
        createdContract.canonicalPublicProjectionBytes * 3,
    );

    const resolved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: privateSnapshot.runId,
        accessToken: privateSnapshot.accessToken,
        mutation: {
          action: "resolve_shock",
          expectedRevision: 0,
          operationId: "resolve-1",
        },
      },
    });
    expect(resolved.isError).not.toBe(true);
    expect(resolved._meta?.[SIX_SCREEN_MUTATION_OUTCOME_META_KEY]).toBe(
      "changed",
    );
    const projection = resolved.structuredContent as {
      revision: number;
      candidates: Array<{
        id: string;
        identityFingerprint: string;
        sourceSnapshotId: string;
        sourceSnapshotFingerprint: string;
      }>;
      identityRevision: number;
    };
    const resolvedPrivate = resolved._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as
      typeof privateSnapshot;
    const resolvedContract = resolved._meta?.[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    const resolvedState = JSON.parse(decodeSixScreenWorkflowPayload({
      encodedPayload: resolvedContract.encodedStatePayload,
      encodedBytes: resolvedContract.encodedStateBytes,
      canonicalBytes: resolvedContract.canonicalStateBytes,
    })) as {
      originalRequestFingerprint: string;
      currentRequestFingerprint: string;
    };
    const replayedResolution = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: privateSnapshot.runId,
        accessToken: privateSnapshot.accessToken,
        mutation: {
          action: "resolve_shock",
          expectedRevision: 0,
          operationId: "resolve-1",
        },
      },
    });
    expect(replayedResolution.isError).not.toBe(true);
    expect(replayedResolution.structuredContent).toEqual(
      resolved.structuredContent,
    );
    expect(
      replayedResolution._meta?.[SIX_SCREEN_MUTATION_OUTCOME_META_KEY],
    ).toBe("replayed");
    const candidate = projection.candidates[0]!;
    const confirmed = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: resolvedPrivate.runId,
        accessToken: resolvedPrivate.accessToken,
        mutation: {
          action: "confirm_shock",
          expectedRevision: projection.revision,
          operationId: "confirm-1",
          candidateId: candidate.id,
          displayedIdentityFingerprint: candidate.identityFingerprint,
          sourceSnapshotId: candidate.sourceSnapshotId,
          sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
          originalRequestFingerprint:
            resolvedState.originalRequestFingerprint,
          currentRequestFingerprint:
            resolvedState.currentRequestFingerprint,
          identityRevision: projection.identityRevision,
        },
      },
    });
    expect(confirmed.isError).not.toBe(true);
    expect(confirmed.structuredContent).toMatchObject({
      revision: 3,
      status: "shock_confirmed",
      canOpenScreen2: true,
      confirmedShock: {
        episode: "adoption or final rule",
        formalIdentifiers: ["2019-24931"],
      },
    });
    const confirmedPrivate = confirmed._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as
      typeof resolvedPrivate;
    const opened = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: confirmedPrivate.runId,
        accessToken: confirmedPrivate.accessToken,
        mutation: {
          action: "open_screen_2",
          expectedRevision: 3,
          operationId: "open-2",
        },
      },
    });
    expect(opened.isError).not.toBe(true);
    const openedPrivate = opened._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as
      typeof resolvedPrivate;
    const researched = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: openedPrivate.runId,
        accessToken: openedPrivate.accessToken,
        mutation: {
          action: "research_policy",
          expectedRevision: 4,
          operationId: "research-policy-1",
        },
      },
    });
    expect(researched.isError, JSON.stringify(researched.content)).not.toBe(true);
    expect(researched._meta?.[SIX_SCREEN_MUTATION_OUTCOME_META_KEY]).toBe(
      "changed",
    );
    expect(researched.structuredContent).toMatchObject({
      revision: 5,
      activeScreen: 2,
      canResearchPolicy: false,
      canContinuePolicy: true,
      policyReview: {
        status: "unsupported",
        failureCode: "unsupported_format",
        claims: [],
        plan: {
          nextStepId: "explanatory-context-2019-24931",
          steps: [
            expect.objectContaining({
              sourceRoute: "complementary_policy_explanations",
              status: "waiting_source",
            }),
            expect.objectContaining({ status: "blocked" }),
            expect.objectContaining({ status: "blocked" }),
            expect.objectContaining({ status: "blocked" }),
            expect.objectContaining({ status: "blocked" }),
          ],
        },
      },
    });
    const replayedResearch = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: openedPrivate.runId,
        accessToken: openedPrivate.accessToken,
        mutation: {
          action: "research_policy",
          expectedRevision: 4,
          operationId: "research-policy-1",
        },
      },
    });
    expect(replayedResearch.isError).not.toBe(true);
    expect(replayedResearch.structuredContent).toEqual(
      researched.structuredContent,
    );
    expect(
      replayedResearch._meta?.[SIX_SCREEN_MUTATION_OUTCOME_META_KEY],
    ).toBe("replayed");
    const researchedPrivate = researched._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as
      typeof openedPrivate;
    const clientAuthoredProjection = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: researchedPrivate.runId,
        accessToken: researchedPrivate.accessToken,
        mutation: {
          action: "begin_policy_event_card_review",
          expectedRevision: 5,
          operationId: "begin-policy-review-forged-projection",
          projection: { claims: [{ statement: "Client-authored policy fact" }] },
        },
      },
    });
    expect(clientAuthoredProjection.isError).toBe(true);
    const unavailableReview = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: researchedPrivate.runId,
        accessToken: researchedPrivate.accessToken,
        mutation: {
          action: "begin_policy_event_card_review",
          expectedRevision: 5,
          operationId: "begin-policy-review-without-evidence",
        },
      },
    });
    expect(unavailableReview.isError).toBe(true);
    expect(decodeSixScreenWorkflowProblemText(String(
      (unavailableReview.content?.find(({ type }) => type === "text") as
        { text?: string } | undefined)?.text,
    ))).toMatchObject({
      code: "unclassified",
      action: "begin_policy_event_card_review",
      screen: 2,
      expectedRevision: 5,
      commitCertainty: "unknown",
      dispatchCertainty: "unknown",
      safeCauseCodes: ["unclassified_error"],
    });
    const unavailableDecisionActions = [
      {
        action: "review_policy_event_card_claim",
        expectedRevision: 5,
        operationId: "review-policy-claim-without-evidence",
        reviewId: "review-1",
        expectedReviewRevision: 0,
        expectedReviewFingerprint: "fnv1a64:0000000000000000",
        claimId: "claim-1",
        decision: "needs_more_evidence",
        rationale: "The immutable source evidence is unavailable.",
      },
      {
        action: "decide_policy_treatment_clock",
        expectedRevision: 5,
        operationId: "review-policy-clock-without-evidence",
        reviewId: "review-1",
        expectedReviewRevision: 0,
        expectedReviewFingerprint: "fnv1a64:0000000000000000",
        decision: { mode: "no_selection" },
        rationale: "No treatment clock can be selected from unavailable evidence.",
      },
      {
        action: "lock_policy_event_card",
        expectedRevision: 5,
        operationId: "lock-policy-card-without-evidence",
        reviewId: "review-1",
        expectedReviewRevision: 0,
        expectedReviewFingerprint: "fnv1a64:0000000000000000",
        rationale: "This lock must fail without immutable evidence.",
      },
    ];
    for (const mutation of unavailableDecisionActions) {
      const unavailable = await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: {
          runId: researchedPrivate.runId,
          accessToken: researchedPrivate.accessToken,
          mutation,
        },
      });
      expect(unavailable.isError).toBe(true);
      expect(decodeSixScreenWorkflowProblemText(String(
        (unavailable.content?.find(({ type }) => type === "text") as
          { text?: string } | undefined)?.text,
      ))).toMatchObject({
        code: "unclassified",
        action: mutation.action,
        screen: 2,
        expectedRevision: 5,
        commitCertainty: "unknown",
        dispatchCertainty: "unknown",
        safeCauseCodes: ["unclassified_error"],
      });
    }
    const unavailableContinuation = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: researchedPrivate.runId,
        accessToken: researchedPrivate.accessToken,
        mutation: {
          action: "continue_policy_research",
          expectedRevision: 5,
          operationId: "continue-policy-1",
        },
      },
    });
    expect(unavailableContinuation.isError).not.toBe(true);
    expect(unavailableContinuation.structuredContent).toMatchObject({
      revision: 6,
      canContinuePolicy: false,
      policyReview: {
        plan: {
          nextStepId: null,
          steps: expect.arrayContaining([
            expect.objectContaining({
              sourceRoute: "complementary_policy_explanations",
              status: "blocked",
              attempts: 2,
            }),
            expect.objectContaining({
              id: "fr-core-2019-24931",
              status: "blocked",
            }),
          ]),
        },
      },
    });
  });

  it("rejects stale or mismatched confirmation coordinates at the tool boundary", async () => {
    const { client } = await harness();
    const created = await client.callTool({
      name: "create_six_screen_workflow_v1",
      arguments: createArguments,
    });
    const privateSnapshot = created._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as {
      runId: string;
      accessToken: string;
    };
    const resolved = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: privateSnapshot.runId,
        accessToken: privateSnapshot.accessToken,
        mutation: {
          action: "resolve_shock",
          expectedRevision: 0,
          operationId: "resolve-1",
        },
      },
    });
    expect(resolved.isError, JSON.stringify(resolved.content)).not.toBe(true);
    const projection = resolved.structuredContent as {
      revision: number;
      candidates: Array<{
        id: string;
        identityFingerprint: string;
        sourceSnapshotId: string;
        sourceSnapshotFingerprint: string;
      }>;
      identityRevision: number;
    };
    const resolvedPrivate = resolved._meta?.[SIX_SCREEN_WORKFLOW_META_KEY] as {
      runId: string;
      accessToken: string;
    };
    const resolvedContract = resolved._meta?.[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    const resolvedState = JSON.parse(decodeSixScreenWorkflowPayload({
      encodedPayload: resolvedContract.encodedStatePayload,
      encodedBytes: resolvedContract.encodedStateBytes,
      canonicalBytes: resolvedContract.canonicalStateBytes,
    })) as {
      originalRequestFingerprint: string;
      currentRequestFingerprint: string;
    };
    const candidate = projection.candidates[0]!;
    const rejected = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: resolvedPrivate.runId,
        accessToken: resolvedPrivate.accessToken,
        mutation: {
          action: "confirm_shock",
          expectedRevision: projection.revision,
          operationId: "confirm-wrong",
          candidateId: candidate.id,
          displayedIdentityFingerprint: candidate.identityFingerprint,
          sourceSnapshotId: "identity-source-wrong",
          sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
          originalRequestFingerprint:
            resolvedState.originalRequestFingerprint,
          currentRequestFingerprint:
            resolvedState.currentRequestFingerprint,
          identityRevision: projection.identityRevision,
        },
      },
    });
    expect(rejected.isError).toBe(true);
    expect(decodeSixScreenWorkflowProblemText(String(
      (rejected.content?.find(({ type }) => type === "text") as
        { text?: string } | undefined)?.text,
    ))).toMatchObject({
      code: "execution_failure",
      action: "confirm_shock",
      screen: 1,
      expectedRevision: projection.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      safeCauseCodes: ["execution_failed"],
    });
  });
});
