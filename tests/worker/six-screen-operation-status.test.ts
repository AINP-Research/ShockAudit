import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_OPERATION_STATUS_TOOL,
  restoreSixScreenOperationStatus,
  type SixScreenOperationStatus,
} from "../../src/core/six-screen/operation-status";
import { createSixScreenRecoverySnapshot } from
  "../../src/core/six-screen/recovery-snapshot";
import {
  SixScreenWorkflowProblemError,
  decodeSixScreenWorkflowProblemText,
} from
  "../../src/core/six-screen/workflow-problem";
import { createSixScreenWorkflowResponseContract } from
  "../../src/core/six-screen/workflow-response-contract";
import {
  rebuildScreen3Guidance,
  type Screen3StartReceipt,
} from "../../src/core/six-screen/workflow";
import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../../src/version";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
  registerSixScreenWorkflowTools,
} from "../../src/worker/six-screen-tools";
import {
  InMemorySixScreenWorkflowStorage,
  SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS,
  SixScreenWorkflowStore,
  type SixScreenWorkflowStoreRecord,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const operationId = "screen3-handoff-status-operation";
const operationKind = "open_screen_3" as const;

function screen3Study() {
  const { id: _id, revision: _revision, ...study } =
    createBrowserEventCardFixture().state.study;
  return {
    ...study,
    outcomeMeasure: study.outcomeMeasure ?? null,
    policySideConcept: study.policySideConcept ?? null,
  };
}

function operationPayload() {
  return {
    study: screen3Study(),
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
    accessToken: browserEventCardFixtureAccessToken,
    createInputFingerprint: fingerprintSixScreenValue("operation-status"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: browserEventCardFixtureAt(1_000),
  });
  const fetch = vi.fn(async () => {
    throw new Error("Compact status must not perform source work.");
  });
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "operation-status-test-key-more-than-thirty-two-bytes",
    now: () => browserEventCardFixtureAt(40),
    fetch,
  });
  const authentication = {
    runId: browserEventCardFixtureRunId,
    accessToken: browserEventCardFixtureAccessToken,
  };
  return { fixture, storage, store, runtime, fetch, authentication };
}

function storedRecord(storage: InMemorySixScreenWorkflowStorage) {
  const entry = [...storage.values.entries()].find(([key]) =>
    key.startsWith("six-screen-workflow-v1:"));
  if (!entry) throw new Error("Expected a saved six-screen workflow.");
  return {
    key: entry[0],
    record: structuredClone(entry[1]) as SixScreenWorkflowStoreRecord,
  };
}

function restore(status: SixScreenOperationStatus) {
  return restoreSixScreenOperationStatus({
    value: JSON.parse(JSON.stringify(status)),
    request: {
      runId: browserEventCardFixtureRunId,
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(operationPayload()),
    },
    expectedAppVersion: SHOCKAUDIT_VERSION,
    expectedUiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
  });
}

describe("compact six-screen operation status", () => {
  it("returns the exact committed Screen 3 receipt without projection or external work", async () => {
    const value = await harness();
    const payload = operationPayload();
    const opened = await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const transaction = vi.spyOn(value.storage, "transaction");
    const get = vi.spyOn(value.storage, "get");
    const put = vi.spyOn(value.storage, "put");
    const beforeStatus = storedRecord(value.storage).record;

    const status = restore(await value.runtime.operationStatus(
      value.authentication,
      {
        operationId,
        operationKind,
        inputFingerprint: fingerprintSixScreenValue(payload),
      },
    ));

    expect(status).toMatchObject({
      runId: browserEventCardFixtureRunId,
      revision: opened.privateSnapshot.revision,
      lookup: "committed",
      commitCertainty: "committed",
      committedRevision: opened.privateSnapshot.revision,
      mutationOutcome: "changed",
      receiptValidated: true,
      destination: {
        screen: 3,
        state: "current",
        displayReady: true,
        localRebuildAvailable: false,
        safeCode: "screen3_guidance_current",
      },
      screen3Receipt: {
        workflowRevision: opened.privateSnapshot.revision,
        studyRevision: opened.privateSnapshot.state.study.revision,
        evidenceStatus: "partial",
      },
    });
    expect(status.inputFingerprint).toBe(fingerprintSixScreenValue(payload));
    expect(JSON.stringify(status)).not.toContain(
      browserEventCardFixtureAccessToken,
    );
    expect(new TextEncoder().encode(JSON.stringify(status)).byteLength)
      .toBeLessThan(64 * 1_024);
    expect(get).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(value.fetch).not.toHaveBeenCalled();
    const afterStatus = storedRecord(value.storage).record;
    expect(afterStatus).toEqual(beforeStatus);
    expect(afterStatus.state.activeScreen).toBe(3);
    expect(afterStatus.state.studyDesignAdvices).toEqual(
      beforeStatus.state.studyDesignAdvices,
    );
  });

  it("keeps missing and in-flight receipts unknown until the atomic write commits", async () => {
    const value = await harness();
    const payload = operationPayload();
    const inputFingerprint = fingerprintSixScreenValue(payload);
    const initial = storedRecord(value.storage).record;
    const initialFingerprint = fingerprintSixScreenValue(initial);
    const canonicalPut = InMemorySixScreenWorkflowStorage.prototype.put.bind(
      value.storage,
    );
    const transaction = vi.spyOn(value.storage, "transaction");
    const put = vi.spyOn(value.storage, "put");

    const missing = restore(await value.runtime.operationStatus(
      value.authentication,
      { operationId, operationKind, inputFingerprint },
    ));
    expect(missing).toMatchObject({
      lookup: "unknown_or_expired",
      commitCertainty: "unknown",
      committedRevision: null,
      receiptValidated: false,
      destination: {
        state: "unknown",
        displayReady: false,
        safeCode: "operation_outcome_unknown",
      },
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(fingerprintSixScreenValue(storedRecord(value.storage).record))
      .toBe(initialFingerprint);

    let reachedWrite!: () => void;
    let releaseWrite!: () => void;
    const writeReached = new Promise<void>((resolve) => {
      reachedWrite = resolve;
    });
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    put.mockImplementation(async (key, record) => {
      reachedWrite();
      await writeReleased;
      return canonicalPut(key, record);
    });

    const pendingMutation = value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    await writeReached;
    const transactionCallsAtBarrier = transaction.mock.calls.length;
    const putCallsAtBarrier = put.mock.calls.length;

    const inFlight = restore(await value.runtime.operationStatus(
      value.authentication,
      { operationId, operationKind, inputFingerprint },
    ));
    const during = storedRecord(value.storage).record;
    const transactionCallsAfterStatus = transaction.mock.calls.length;
    const putCallsAfterStatus = put.mock.calls.length;
    releaseWrite();
    const committed = await pendingMutation;

    expect(inFlight).toMatchObject({
      lookup: "unknown_or_expired",
      commitCertainty: "unknown",
      committedRevision: null,
      receiptValidated: false,
      destination: { state: "unknown", displayReady: false },
    });
    expect(fingerprintSixScreenValue(during)).toBe(initialFingerprint);
    expect(transactionCallsAfterStatus).toBe(transactionCallsAtBarrier);
    expect(putCallsAfterStatus).toBe(putCallsAtBarrier);
    expect(committed.privateSnapshot.revision)
      .toBeGreaterThan(initial.state.revision);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint,
    })).resolves.toMatchObject({
      lookup: "committed",
      commitCertainty: "committed",
      receiptValidated: true,
    });
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("distinguishes unknown and conflicting operation coordinates without replay", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const unknown = await value.runtime.operationStatus(value.authentication, {
      operationId: "screen3-handoff-status-not-retained",
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    });
    expect(unknown).toMatchObject({
      lookup: "unknown_or_expired",
      commitCertainty: "unknown",
      committedRevision: null,
      receiptValidated: false,
      destination: { state: "unknown", displayReady: false },
    });
    const conflict = await value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue({ ...payload, changed: true }),
    });
    expect(conflict).toMatchObject({
      lookup: "conflict",
      commitCertainty: "unknown",
      committedRevision: null,
      receiptValidated: false,
      destination: {
        state: "unavailable",
        displayReady: false,
        safeCode: "operation_identity_conflict",
      },
    });
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("reads through malformed optional output but fails closed on critical core corruption", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const committed = storedRecord(value.storage);
    const malformedOptional = structuredClone(committed.record);
    (malformedOptional.state as unknown as Record<string, unknown>)
      .screen6Personalizations = { invalid: true };
    malformedOptional.stateFingerprint = fingerprintSixScreenValue(
      malformedOptional.state,
    );
    value.storage.values.set(committed.key, malformedOptional);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).resolves.toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: { state: "current", displayReady: true },
    });

    const invalidCore = structuredClone(committed.record);
    (invalidCore.state as unknown as Record<string, unknown>).causalDesignSets =
      { invalid: true };
    invalidCore.stateFingerprint = fingerprintSixScreenValue(
      invalidCore.state,
    );
    value.storage.values.set(committed.key, invalidCore);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).rejects.toMatchObject({
      name: "SixScreenWorkflowProblemError",
      problem: {
        code: "core_state_invalid",
        stage: "request_validation",
        commitCertainty: "unknown",
      },
    });

    const invalidRoot = structuredClone(committed.record);
    invalidRoot.stateFingerprint = fingerprintSixScreenValue(
      "not-the-stored-state",
    );
    value.storage.values.set(committed.key, invalidRoot);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).rejects.toMatchObject({
      name: "SixScreenWorkflowProblemError",
      problem: {
        code: "core_state_invalid",
        stage: "request_validation",
        commitCertainty: "unknown",
      },
    });
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("keeps compact status bounded across large valid source, optional, and receipt histories", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const saved = storedRecord(value.storage);
    const largeRecord = structuredClone(saved.record);
    const largeQualification =
      "Synthetic qualification: (A OR B) AND NOT exempt. ".repeat(20);
    largeRecord.state.officialSourceLocators = Array.from(
      { length: 160 },
      (_, index) =>
        `https://evidence.invalid/fictional-act/version-${index}` +
        `?qualification=${"q".repeat(256)}`,
    );
    largeRecord.state.screen6Personalizations = Array.from(
      { length: 40 },
      (_, index) => {
        const suffix = index.toString(16).padStart(16, "0");
        return {
          id: `screen6-plan-${suffix}`,
          inputFingerprint: fingerprintSixScreenValue({
            syntheticHistoricalPlan: index,
          }),
          reservationId: `screen6-contextualization-${suffix}`,
          status: "failed" as const,
          attemptOrdinal: 1,
          claimOperationId: `large-history-screen6-${index}`,
          dispatchState: "not_dispatched" as const,
          failureCode: "local_configuration",
          failureStage: "local_configuration" as const,
          receipt: null,
          supplement: null,
          error: `Synthetic pre-dispatch failure ${index}. ${"x".repeat(300)}`,
          updatedAt: browserEventCardFixtureAt(50 + index),
        };
      },
    );
    const targetReceipt = largeRecord.operationReplays[0]!;
    largeRecord.operationReplays = [
      targetReceipt,
      ...Array.from(
        { length: SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS - 1 },
        (_, index) => ({
          operationId: `large-supported-history-${index}`,
          operationKind: "synthetic_history_checkpoint",
          inputFingerprint: fingerprintSixScreenValue({ history: index }),
          committedRevision: largeRecord.state.revision,
          mutationOutcome: "unchanged" as const,
          result: {
            synthetic: true,
            index,
            qualification: largeQualification,
          },
          completedAt: browserEventCardFixtureAt(100 + index),
        }),
      ),
    ];
    largeRecord.stateFingerprint = fingerprintSixScreenValue(
      largeRecord.state,
    );
    value.storage.values.set(saved.key, largeRecord);
    const put = vi.spyOn(value.storage, "put");

    const fullRead = await value.store.read(value.authentication);
    expect(fullRead).toMatchObject({ outcome: "found" });
    expect(put).not.toHaveBeenCalled();
    const beforeStatusFingerprint = fingerprintSixScreenValue(
      storedRecord(value.storage).record,
    );
    const status = restore(await value.runtime.operationStatus(
      value.authentication,
      {
        operationId,
        operationKind,
        inputFingerprint: fingerprintSixScreenValue(payload),
      },
    ));
    const encoder = new TextEncoder();
    const fullBytes = encoder.encode(JSON.stringify(largeRecord)).byteLength;
    const statusBytes = encoder.encode(JSON.stringify(status)).byteLength;
    const recovery = await value.runtime.recoverySnapshot(
      value.authentication,
    );
    const recoveryEnvelope = await createSixScreenRecoverySnapshot({
      appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      state: recovery.privateSnapshot.state,
      publicProjection: recovery.projection,
    });
    const recoveryBytes = encoder.encode(
      JSON.stringify(recoveryEnvelope),
    ).byteLength;
    const ordinaryContract = createSixScreenWorkflowResponseContract({
      appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      toolName: "get_six_screen_workflow_v1",
      operationStage: "read",
      publicProjection: recovery.projection,
      privateSnapshot: recovery.privateSnapshot,
    });
    const ordinaryDeliveryBytes = encoder.encode(JSON.stringify({
      structuredContent: recovery.projection,
      _meta: {
        "shockaudit/sixScreenWorkflow": recovery.privateSnapshot,
        "shockaudit/sixScreenWorkflowResponse": ordinaryContract,
      },
    })).byteLength;

    expect(fullBytes).toBeGreaterThan(150_000);
    expect(statusBytes).toBeLessThan(64 * 1_024);
    expect(statusBytes).toBeLessThan(fullBytes / 20);
    expect(recoveryBytes).toBeLessThan(fullBytes);
    expect(recoveryBytes).toBeLessThan(ordinaryDeliveryBytes / 3);
    expect(recoveryEnvelope.canonicalStateBytes).toBeGreaterThan(100_000);
    expect(recoveryEnvelope.encodedStateBytes).toBeLessThan(
      recoveryEnvelope.canonicalStateBytes / 6,
    );
    expect(status).toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: { state: "current", displayReady: true },
    });
    expect(JSON.stringify(status)).not.toContain(largeQualification);
    expect(put).not.toHaveBeenCalled();
    expect(fingerprintSixScreenValue(storedRecord(value.storage).record))
      .toBe(beforeStatusFingerprint);
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("accepts exact legacy receipts but authorizes local rebuild only from validated v26 input", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const original = storedRecord(value.storage);
    const withoutAdvice = structuredClone(original.record);
    withoutAdvice.state.studyDesignAdvices = [];
    withoutAdvice.stateFingerprint = fingerprintSixScreenValue(
      withoutAdvice.state,
    );
    value.storage.values.set(original.key, withoutAdvice);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).resolves.toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: {
        state: "locally_recoverable",
        displayReady: false,
        localRebuildAvailable: true,
      },
    });

    const legacy = structuredClone(withoutAdvice);
    const legacyResult = legacy.operationReplays[0]!.result as
      Record<string, unknown>;
    delete legacyResult.clarifications;
    delete legacyResult.clarificationFingerprint;
    value.storage.values.set(original.key, legacy);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).resolves.toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: {
        state: "unavailable",
        displayReady: false,
        localRebuildAvailable: false,
      },
    });

    const malformed = structuredClone(original.record);
    const malformedResult = malformed.operationReplays[0]!.result as
      Record<string, unknown>;
    malformedResult.clarifications = {
      ...(malformedResult.clarifications as Record<string, unknown>),
      undeclared: true,
    };
    value.storage.values.set(original.key, malformed);
    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    })).resolves.toMatchObject({
      lookup: "committed",
      receiptValidated: false,
      screen3Receipt: null,
      destination: {
        state: "unavailable",
        localRebuildAvailable: false,
        safeCode: "screen3_receipt_clarifications_invalid",
      },
    });
  });

  it("never resurrects an older clarification entry as current local guidance", async () => {
    const value = await harness();
    const payload = operationPayload();
    const sourceInputFingerprint = fingerprintSixScreenValue(payload);
    const opened = await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const sourceReceipt = opened.result as Screen3StartReceipt;
    const refined = await value.runtime.refineStudyDesignAdvice(
      value.authentication,
      {
        expectedRevision: opened.privateSnapshot.revision,
        operationId: "screen3-newer-clarification-entry",
        clarifications: {
          adoptionPattern: "staggered",
          effectInterest: "dynamic",
        },
      },
    );
    const saved = storedRecord(value.storage);
    saved.record.state.studyDesignAdvices =
      saved.record.state.studyDesignAdvices?.filter(({ adviceId }) =>
        adviceId !== sourceReceipt.adviceId);
    saved.record.stateFingerprint = fingerprintSixScreenValue(
      saved.record.state,
    );
    value.storage.values.set(saved.key, saved.record);
    const beforeRecovery = storedRecord(value.storage).record;

    await expect(value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: sourceInputFingerprint,
    })).resolves.toMatchObject({
      lookup: "committed",
      receiptValidated: true,
      destination: {
        state: "unavailable",
        displayReady: false,
        localRebuildAvailable: false,
        safeCode: "screen3_saved_guidance_unavailable",
      },
    });
    expect(() => rebuildScreen3Guidance(beforeRecovery.state, {
      expectedRevision: beforeRecovery.state.revision,
      sourceReceipt,
      rebuiltAt: browserEventCardFixtureAt(95),
    })).toThrow(/not compatible with the current scientific inputs/iu);
    await expect(value.runtime.rebuildScreen3Guidance(
      value.authentication,
      {
        expectedRevision: refined.privateSnapshot.revision,
        operationId: "screen3-reject-obsolete-clarification-rebuild",
        sourceOperationId: operationId,
        sourceInputFingerprint,
      },
    )).rejects.toMatchObject({
      problem: {
        code: "core_state_invalid",
        action: "rebuild_screen3_guidance",
        commitCertainty: "not_committed",
        safeCauseCodes: ["screen3_rebuild_binding_invalid"],
      },
    });
    expect(storedRecord(value.storage).record).toEqual(beforeRecovery);
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("does not disclose whether a run is missing or merely unauthorized", async () => {
    const value = await harness();
    const input = {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(operationPayload()),
    };
    for (const authentication of [
      { ...value.authentication, accessToken: `sa6a_${"z".repeat(43)}` },
      { ...value.authentication, runId: `sa6r_${"z".repeat(43)}` },
    ]) {
      const error = await value.runtime.operationStatus(authentication, input)
        .then(() => null, (caught: unknown) => caught);
      expect(error).toBeInstanceOf(SixScreenWorkflowProblemError);
      expect((error as SixScreenWorkflowProblemError).problem).toMatchObject({
        code: "authorization",
        action: "get_operation_status",
        screen: 3,
        recovery: "reconnect",
      });
      expect((error as Error).message).toBe(
        "This saved workflow could not be authorized.",
      );
    }
  });

  it("validates every nested receipt field and cross-field invariant on restore", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const valid = await value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    });
    const invalidVariants = [
      { screen3Receipt: { ...valid.screen3Receipt!, studyRevision: -1 } },
      { screen3Receipt: { ...valid.screen3Receipt!,
        adviceFingerprint: "fnv1a64:not-valid" } },
      { screen3Receipt: { ...valid.screen3Receipt!, evidenceStatus: "complete" } },
      { screen3Receipt: { ...valid.screen3Receipt!, openedAt: "today" } },
      { committedRevision: valid.revision + 1 },
      { destination: { ...valid.destination, displayReady: true,
        state: "historical" } },
    ];
    for (const patch of invalidVariants) {
      const candidate = { ...valid, ...patch } as SixScreenOperationStatus;
      const { responseFingerprint: _old, ...body } = candidate;
      candidate.responseFingerprint = fingerprintSixScreenValue(body);
      expect(() => restore(candidate)).toThrow(/invalid contract/u);
    }
  });
});

describe("registered compact operation-status tool", () => {
  it("exposes a strict read-only app tool and returns no private workflow snapshot", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const server = new McpServer(
      { name: "operation-status-tool-test", version: "1.0.0" },
      { instructions: "Exercise only app-owned workflow coordinates." },
    );
    registerSixScreenWorkflowTools(server, value.runtime, {
      resultMetadata: () => ({ "shockaudit/safeCapability": "fixture" }),
    });
    const client = new Client({ name: "status-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = (await client.listTools()).tools.find(({ name }) =>
        name === SIX_SCREEN_OPERATION_STATUS_TOOL);
      expect(listed).toMatchObject({
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: {
          ui: { visibility: ["app"] },
          "openai/widgetAccessible": true,
        },
        inputSchema: { additionalProperties: false },
        outputSchema: { additionalProperties: false },
      });
      const response = await client.callTool({
        name: SIX_SCREEN_OPERATION_STATUS_TOOL,
        arguments: {
          ...value.authentication,
          operationId,
          operationKind,
          inputFingerprint: fingerprintSixScreenValue(payload),
        },
      });
      expect(response.isError).not.toBe(true);
      expect(response.structuredContent).toMatchObject({
        lookup: "committed",
        commitCertainty: "committed",
        receiptValidated: true,
        destination: { state: "current", displayReady: true },
      });
      expect(response._meta).toEqual({
        "shockaudit/safeCapability": "fixture",
      });
      expect(response._meta).not.toHaveProperty(SIX_SCREEN_WORKFLOW_META_KEY);
      expect(response._meta).not.toHaveProperty(
        SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
      );
      expect(JSON.stringify(response)).not.toContain(
        browserEventCardFixtureAccessToken,
      );

      const malformed = await client.callTool({
        name: SIX_SCREEN_OPERATION_STATUS_TOOL,
        arguments: {
          ...value.authentication,
          operationId,
          operationKind,
          inputFingerprint: fingerprintSixScreenValue(payload),
          undeclared: true,
        },
      });
      expect(malformed.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
    expect(value.fetch).not.toHaveBeenCalled();
  });

  it("carries identical typed authorization failures for missing and unauthorized runs", async () => {
    const value = await harness();
    const server = new McpServer(
      { name: "operation-status-auth-test", version: "1.0.0" },
    );
    registerSixScreenWorkflowTools(server, value.runtime);
    const client = new Client({ name: "status-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const errors = [];
    try {
      for (const authentication of [
        { ...value.authentication, accessToken: `sa6a_${"z".repeat(43)}` },
        { ...value.authentication, runId: `sa6r_${"z".repeat(43)}` },
      ]) {
        const response = await client.callTool({
          name: SIX_SCREEN_OPERATION_STATUS_TOOL,
          arguments: {
            ...authentication,
            operationId,
            operationKind,
            inputFingerprint: fingerprintSixScreenValue(operationPayload()),
          },
        });
        expect(response.isError).toBe(true);
        const text = response.content.find((item) => item.type === "text");
        if (!text || text.type !== "text") {
          throw new Error("Expected a compact typed error envelope.");
        }
        const problem = decodeSixScreenWorkflowProblemText(text.text);
        expect(problem).toMatchObject({
          code: "authorization",
          action: "get_operation_status",
          screen: 3,
          recovery: "reconnect",
          safeCauseCodes: ["authorization_failed"],
        });
        errors.push(problem);
      }
    } finally {
      await client.close();
      await server.close();
    }
    expect(errors[0]).toEqual(errors[1]);
  });

  it("maps invalid compact output to a response-contract problem", async () => {
    const value = await harness();
    const payload = operationPayload();
    await value.runtime.openScreen3(value.authentication, {
      expectedRevision: value.fixture.state.revision,
      operationId,
      study: payload.study,
      proposedTiming: payload.proposedTiming,
      clarifications: payload.clarifications,
    });
    const valid = await value.runtime.operationStatus(value.authentication, {
      operationId,
      operationKind,
      inputFingerprint: fingerprintSixScreenValue(payload),
    });
    const fakeRuntime = {
      operationStatus: vi.fn(async () => ({ ...valid, undeclared: true })),
    } as unknown as SixScreenWorkflowRuntime;
    const server = new McpServer(
      { name: "operation-status-output-test", version: "1.0.0" },
    );
    registerSixScreenWorkflowTools(server, fakeRuntime);
    const client = new Client({ name: "status-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const response = await client.callTool({
        name: SIX_SCREEN_OPERATION_STATUS_TOOL,
        arguments: {
          ...value.authentication,
          operationId,
          operationKind,
          inputFingerprint: fingerprintSixScreenValue(payload),
        },
      });
      expect(response.isError).toBe(true);
      const text = response.content.find((item) => item.type === "text");
      if (!text || text.type !== "text") throw new Error("Missing problem.");
      expect(decodeSixScreenWorkflowProblemText(text.text)).toMatchObject({
        code: "response_contract",
        stage: "serialization",
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
