import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { sixScreenWorkflowMutationRequestBinding } from
  "../../src/core/six-screen/workflow-response-contract";
import { SixScreenWorkflowProblemError } from
  "../../src/core/six-screen/workflow-problem";
import {
  SixScreenWorkflowResponseError,
  restoreSixScreenWorkflowToolResponse,
} from "../../src/ui/six-screen/workflow-response";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  SIX_SCREEN_MUTATION_OUTCOME_META_KEY,
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
  registerSixScreenWorkflowTools,
} from "../../src/worker/six-screen-tools";
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

const sourceOperationId = "screen3-v26-source-operation";
const rebuildOperationId = "screen3-v26-local-rebuild";

function submittedStudy() {
  const { id: _id, revision: _revision, ...study } =
    createBrowserEventCardFixture().state.study;
  return {
    ...study,
    outcomeMeasure: study.outcomeMeasure ?? null,
    policySideConcept: study.policySideConcept ?? null,
  };
}

function sourcePayload() {
  return {
    study: submittedStudy(),
    proposedTiming: {
      mode: "year" as const,
      year: 2020,
      milestoneReference: null,
    },
    clarifications: null,
  };
}

async function harness() {
  const fixture = createBrowserEventCardFixture();
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: fixture.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("v26-screen3-rebuild"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: browserEventCardFixtureAt(1_000),
  });
  let tick = 40;
  const sourceFetch = vi.fn(async () => {
    throw new Error("Local Screen 3 recovery must not search a source.");
  });
  const providerFetch = vi.fn(async () => {
    throw new Error("Local Screen 3 recovery must not call a model.");
  });
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "screen3-local-rebuild-test-key-more-than-thirty-two-bytes",
    now: () => browserEventCardFixtureAt(tick++),
    fetch: sourceFetch,
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "test-only-never-projected",
    screen5OpenAIFetch: providerFetch,
  });
  return {
    fixture,
    storage,
    store,
    runtime,
    sourceFetch,
    providerFetch,
    authentication: { runId, accessToken },
  };
}

function savedRecord(storage: InMemorySixScreenWorkflowStorage) {
  const entry = [...storage.values.entries()].find(([key]) =>
    key.startsWith("six-screen-workflow-v1:"));
  if (!entry) throw new Error("Expected a saved six-screen workflow.");
  return {
    key: entry[0],
    record: structuredClone(entry[1]) as SixScreenWorkflowStoreRecord,
  };
}

async function saveRecord(
  storage: InMemorySixScreenWorkflowStorage,
  key: string,
  record: SixScreenWorkflowStoreRecord,
) {
  record.stateFingerprint = fingerprintSixScreenValue(record.state);
  await storage.put(key, record);
}

async function openAndRemoveAdvice(value: Awaited<ReturnType<typeof harness>>) {
  const payload = sourcePayload();
  const opened = await value.runtime.openScreen3(value.authentication, {
    expectedRevision: value.fixture.state.revision,
    operationId: sourceOperationId,
    ...payload,
  });
  const adviceId = (opened.result as { adviceId: string }).adviceId;
  const { key, record } = savedRecord(value.storage);
  record.state.studyDesignAdvices = record.state.studyDesignAdvices?.filter(
    (advice) => advice.adviceId !== adviceId,
  );
  await saveRecord(value.storage, key, record);
  return {
    payload,
    opened,
    sourceInputFingerprint: fingerprintSixScreenValue(payload),
  };
}

function rebuildInput(input: {
  expectedRevision: number;
  sourceInputFingerprint: string;
  operationId?: string;
}) {
  return {
    expectedRevision: input.expectedRevision,
    operationId: input.operationId ?? rebuildOperationId,
    sourceOperationId,
    sourceInputFingerprint: input.sourceInputFingerprint,
  };
}

function expectNoExternalCalls(value: Awaited<ReturnType<typeof harness>>) {
  expect(value.sourceFetch).not.toHaveBeenCalled();
  expect(value.providerFetch).not.toHaveBeenCalled();
}

describe("Screen 3 receipt-bound local guidance rebuild", () => {
  it("rebuilds an exact v26 receipt, replays idempotently, and restores compact status after response loss", async () => {
    const value = await harness();
    const missing = await openAndRemoveAdvice(value);
    const before = await value.runtime.operationStatus(value.authentication, {
      operationId: sourceOperationId,
      operationKind: "open_screen_3",
      inputFingerprint: missing.sourceInputFingerprint,
    });
    expect(before).toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: {
        state: "locally_recoverable",
        displayReady: false,
        localRebuildAvailable: true,
        safeCode: "screen3_guidance_rebuild_available",
      },
    });

    const input = rebuildInput({
      expectedRevision: missing.opened.privateSnapshot.revision,
      sourceInputFingerprint: missing.sourceInputFingerprint,
    });
    // Treat the returned value as lost after the durable mutation completed.
    const completedThenLost = await value.runtime.rebuildScreen3Guidance(
      value.authentication,
      input,
    );
    expect(completedThenLost).toMatchObject({
      replayed: false,
      changed: true,
      mutationOutcome: "changed",
      result: {
        runId,
        sourceWorkflowRevision: missing.opened.privateSnapshot.revision,
        studyRevision: missing.opened.privateSnapshot.state.study.revision,
        entryContextId: (missing.opened.result as { entryContextId: string })
          .entryContextId,
        entryContextFingerprint: (missing.opened.result as {
          entryContextFingerprint: string;
        }).entryContextFingerprint,
        adviceId: (missing.opened.result as { adviceId: string }).adviceId,
        adviceFingerprint: (missing.opened.result as {
          adviceFingerprint: string;
        }).adviceFingerprint,
        rebuiltAt: expect.stringMatching(/^2026-09-[0-9]{2}T/u),
      },
      projection: {
        runId,
        activeScreen: 3,
      },
    });
    expect(completedThenLost.privateSnapshot.state.studyDesignAdvices)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          adviceId: (missing.opened.result as { adviceId: string }).adviceId,
          adviceFingerprint: (missing.opened.result as {
            adviceFingerprint: string;
          }).adviceFingerprint,
        }),
      ]));

    const recovered = await value.runtime.operationStatus(
      value.authentication,
      {
        operationId: sourceOperationId,
        operationKind: "open_screen_3",
        inputFingerprint: missing.sourceInputFingerprint,
      },
    );
    expect(recovered).toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: {
        state: "current",
        displayReady: true,
        localRebuildAvailable: false,
        safeCode: "screen3_guidance_current",
      },
    });

    const replay = await value.runtime.rebuildScreen3Guidance(
      value.authentication,
      input,
    );
    expect(replay).toMatchObject({
      replayed: true,
      changed: false,
      mutationOutcome: "replayed",
      result: completedThenLost.result,
      privateSnapshot: {
        revision: completedThenLost.privateSnapshot.revision,
        stateFingerprint: completedThenLost.privateSnapshot.stateFingerprint,
      },
    });
    const stored = savedRecord(value.storage).record;
    expect(stored.operationReplays.filter(({ operationId }) =>
      operationId === rebuildOperationId)).toHaveLength(1);
    expectNoExternalCalls(value);
  });

  it("strictly binds the source operation and source input fingerprint", async () => {
    const value = await harness();
    const missing = await openAndRemoveAdvice(value);
    const revision = missing.opened.privateSnapshot.revision;

    await expect(value.runtime.rebuildScreen3Guidance(
      value.authentication,
      rebuildInput({
        expectedRevision: revision,
        sourceInputFingerprint: fingerprintSixScreenValue({ wrong: true }),
        operationId: "screen3-rebuild-wrong-input-binding",
      }),
    )).rejects.toMatchObject({
      problem: {
        code: "operation_identity_conflict",
        action: "rebuild_screen3_guidance",
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        safeCauseCodes: ["source_operation_conflict"],
      },
    });

    await expect(value.runtime.rebuildScreen3Guidance(
      value.authentication,
      {
        ...rebuildInput({
          expectedRevision: revision,
          sourceInputFingerprint: missing.sourceInputFingerprint,
          operationId: "screen3-rebuild-wrong-operation-binding",
        }),
        sourceOperationId: "screen3-source-operation-not-retained",
      },
    )).rejects.toMatchObject({
      problem: {
        code: "external_outcome_unknown",
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        safeCauseCodes: ["source_receipt_unavailable"],
      },
    });
    const stored = savedRecord(value.storage).record;
    expect(stored.state.studyDesignAdvices).toEqual([]);
    expect(stored.operationReplays.some(({ operationKind }) =>
      operationKind === "rebuild_screen3_guidance")).toBe(false);
    expectNoExternalCalls(value);
  });

  it.each([
    {
      name: "legacy receipt without the retained rebuild inputs",
      alter: (record: SixScreenWorkflowStoreRecord) => {
        const replay = record.operationReplays.find(({ operationId }) =>
          operationId === sourceOperationId)!;
        const result = replay.result as Record<string, unknown>;
        delete result.clarifications;
        delete result.clarificationFingerprint;
      },
    },
    {
      name: "malformed receipt with a mismatched clarification fingerprint",
      alter: (record: SixScreenWorkflowStoreRecord) => {
        const replay = record.operationReplays.find(({ operationId }) =>
          operationId === sourceOperationId)!;
        (replay.result as Record<string, unknown>).clarificationFingerprint =
          "fnv1a64:0000000000000000";
      },
    },
  ])("rejects a $name without guessing or changing state", async ({ alter }) => {
    const value = await harness();
    const missing = await openAndRemoveAdvice(value);
    const { key, record } = savedRecord(value.storage);
    alter(record);
    await saveRecord(value.storage, key, record);
    const before = savedRecord(value.storage).record;

    await expect(value.runtime.rebuildScreen3Guidance(
      value.authentication,
      rebuildInput({
        expectedRevision: before.state.revision,
        sourceInputFingerprint: missing.sourceInputFingerprint,
        operationId: `screen3-rebuild-reject-${before.generation}`,
      }),
    )).rejects.toMatchObject({
      problem: {
        code: "core_state_invalid",
        action: "rebuild_screen3_guidance",
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        safeCauseCodes: ["screen3_rebuild_binding_invalid"],
      },
    });
    expect(savedRecord(value.storage).record).toEqual(before);
    expectNoExternalCalls(value);
  });

  it("rejects historical scientific input and leaves rebase decisions to the UI", async () => {
    const value = await harness();
    const payload = sourcePayload();
    const opened = await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId: sourceOperationId,
      ...payload,
    });
    const edited = await value.runtime.updateStudy(value.authentication, {
      expectedRevision: opened.privateSnapshot.revision,
      operationId: "screen3-scientific-edit",
      study: {
        ...payload.study,
        outcome: "Employment",
        outcomeMeasure: "Full-time equivalent employees",
      },
    });
    const beforeHistoricalAttempt = savedRecord(value.storage).record;
    await expect(value.runtime.rebuildScreen3Guidance(
      value.authentication,
      rebuildInput({
        expectedRevision: edited.privateSnapshot.revision,
        sourceInputFingerprint: fingerprintSixScreenValue(payload),
        operationId: "screen3-rebuild-historical",
      }),
    )).rejects.toMatchObject({
      problem: {
        code: "core_state_invalid",
        safeCauseCodes: ["screen3_rebuild_binding_invalid"],
      },
    });
    expect(savedRecord(value.storage).record).toEqual(beforeHistoricalAttempt);

    // A compatible receipt with a stale transport revision is also rejected;
    // the runtime does not silently refresh or retry the mutation.
    const second = await harness();
    const missing = await openAndRemoveAdvice(second);
    const advanced = await second.runtime.openScreen2(second.authentication, {
      expectedRevision: missing.opened.privateSnapshot.revision,
      operationId: "screen3-rebuild-view-advance",
    });
    const beforeStaleAttempt = savedRecord(second.storage).record;
    let stale: unknown;
    try {
      await second.runtime.rebuildScreen3Guidance(
        second.authentication,
        rebuildInput({
          expectedRevision: missing.opened.privateSnapshot.revision,
          sourceInputFingerprint: missing.sourceInputFingerprint,
          operationId: "screen3-rebuild-stale-ui-owned",
        }),
      );
    } catch (error) {
      stale = error;
    }
    expect(stale).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((stale as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "revision_conflict",
      action: "rebuild_screen3_guidance",
      expectedRevision: missing.opened.privateSnapshot.revision,
      actualRevision: advanced.privateSnapshot.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
    });
    expect(savedRecord(second.storage).record).toEqual(beforeStaleAttempt);
    expectNoExternalCalls(value);
    expectNoExternalCalls(second);
  });
});

describe("registered Screen 3 local guidance rebuild", () => {
  it("runs through the strict mutation tool and returns a bound canonical response", async () => {
    const value = await harness();
    const missing = await openAndRemoveAdvice(value);
    const server = new McpServer(
      { name: "screen3-rebuild-tool-test", version: "1.0.0" },
    );
    registerSixScreenWorkflowTools(server, value.runtime);
    const client = new Client({ name: "screen3-rebuild-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const mutation = {
        action: "rebuild_screen3_guidance" as const,
        expectedRevision: missing.opened.privateSnapshot.revision,
        operationId: rebuildOperationId,
        sourceOperationId,
        sourceInputFingerprint: missing.sourceInputFingerprint,
      };
      const response = await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: {
          ...value.authentication,
          mutation,
        },
      });
      expect(response.isError).not.toBe(true);
      expect(response.structuredContent).toMatchObject({
        runId,
        activeScreen: 3,
        causalComparisonWorkspace: {
          studyFirst: {
            advice: {
              adviceId: (missing.opened.result as { adviceId: string }).adviceId,
              adviceFingerprint: (missing.opened.result as {
                adviceFingerprint: string;
              }).adviceFingerprint,
            },
          },
        },
      });
      const metadata = response._meta as Record<string, unknown>;
      expect(metadata[SIX_SCREEN_MUTATION_OUTCOME_META_KEY]).toBe("changed");
      const compactWorkflowMetadata = metadata[
        SIX_SCREEN_WORKFLOW_META_KEY
      ] as Record<string, unknown>;
      expect(compactWorkflowMetadata).toMatchObject({
        runId,
        revision: missing.opened.privateSnapshot.revision + 1,
      });
      expect(compactWorkflowMetadata).not.toHaveProperty("state");
      expect(metadata[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]).toMatchObject({
        toolName: "mutate_six_screen_workflow_v1",
        operationStage: "mutation:rebuild_screen3_guidance",
        operationBinding: {
          operationId: rebuildOperationId,
          operationKind: "rebuild_screen3_guidance",
          requestFingerprint: fingerprintSixScreenValue({
            action: "rebuild_screen3_guidance",
            sourceOperationId,
            sourceInputFingerprint: missing.sourceInputFingerprint,
          }),
        },
      });

      const responseTrace = {
        toolName: "mutate_six_screen_workflow_v1",
        bridgePath: "mcp-app" as const,
        metadataKeys: Object.keys(metadata).sort(),
        structuredContentKeys: Object.keys(
          response.structuredContent as Record<string, unknown>,
        ).sort(),
      };
      const expectedOperationBinding =
        sixScreenWorkflowMutationRequestBinding(mutation);
      expect(restoreSixScreenWorkflowToolResponse({
        structuredContent: response.structuredContent,
        metadata,
        trace: responseTrace,
        expectedOperationBinding,
      }).snapshot).toMatchObject({
        runId,
        revision: missing.opened.privateSnapshot.revision + 1,
        state: {
          studyDesignAdvices: expect.arrayContaining([
            expect.objectContaining({
              adviceId: (missing.opened.result as { adviceId: string }).adviceId,
            }),
          ]),
        },
      });
      let bindingFailure: unknown;
      try {
        restoreSixScreenWorkflowToolResponse({
          structuredContent: response.structuredContent,
          metadata,
          trace: responseTrace,
          expectedOperationBinding: {
            ...expectedOperationBinding,
            operationId: "different-screen3-rebuild-operation",
          },
        });
      } catch (caught) {
        bindingFailure = caught;
      }
      expect(bindingFailure).toBeInstanceOf(SixScreenWorkflowResponseError);
      expect((bindingFailure as SixScreenWorkflowResponseError).code)
        .toBe("operation_binding");

      const undeclared = await client.callTool({
        name: "mutate_six_screen_workflow_v1",
        arguments: {
          ...value.authentication,
          mutation: { ...mutation, undeclared: true },
        },
      });
      expect(undeclared.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
    expectNoExternalCalls(value);
  });
});
