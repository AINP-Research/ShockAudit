import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createSixScreenWorkflow } from
  "../../src/core/six-screen/workflow";
import {
  InMemorySixScreenWorkflowStorage,
  SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS,
  SixScreenWorkflowStore,
  type SixScreenWorkflowOperationReplay,
  type SixScreenWorkflowStoreRecord,
} from "../../src/worker/six-screen-workflow-store";

const RUN_ID = `sa6r_${"r".repeat(43)}`;
const ACCESS_TOKEN = `sa6a_${"a".repeat(43)}`;
const CREATED_AT = "2026-09-25T10:00:00.000Z";
const COMPLETED_AT = "2026-09-25T10:00:01.000Z";
const EXPIRES_AT = "2026-09-26T10:00:00.000Z";
const OPERATION_ID = "open-screen-3-operation-1";
const OPERATION_KIND = "open_screen_3";
const INPUT_FINGERPRINT = fingerprintSixScreenValue({
  screen: 3,
  expectedRevision: 0,
});

async function fixture() {
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  const state = createSixScreenWorkflow({
    runId: RUN_ID,
    studyId: "receipt-recovery-study",
    study: {
      population: "Hospitals",
      analysisUnit: "hospital-year",
      geography: ["United States"],
      industry: ["Health care"],
      period: { start: "2018", end: "2025" },
      outcome: "Operating margin",
      outcomeMeasure: "Annual operating margin",
      intendedConstruct: "Organizational resilience",
      policySideConcept: "External transparency requirement",
      initialExplanation:
        "The requirement could change information available to market participants.",
      proposedTreatment: "Hospitals proposed as exposed",
      proposedComparison: "Hospitals proposed as a comparison",
      resultsPreviouslyInspected: "no",
    },
    shockInput: "Hospital Transparency Rule",
    createdAt: CREATED_AT,
  });
  const created = await store.create({
    state,
    accessToken: ACCESS_TOKEN,
    createInputFingerprint: fingerprintSixScreenValue("create-receipt-fixture"),
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  });
  expect(created.outcome).toBe("created");
  return {
    storage,
    store,
    state,
    authentication: { runId: RUN_ID, accessToken: ACCESS_TOKEN },
  };
}

function storedRecord(storage: InMemorySixScreenWorkflowStorage) {
  const entry = [...storage.values.entries()].find(([key]) =>
    key.startsWith("six-screen-workflow-v1:"));
  if (!entry) throw new Error("Expected the workflow record fixture.");
  return {
    key: entry[0],
    record: structuredClone(entry[1]) as SixScreenWorkflowStoreRecord,
  };
}

async function commitReceipt(
  value: Awaited<ReturnType<typeof fixture>>,
  result: unknown = {
    privateReceiptVersion: 1,
    actionSpecificPayload: { deliberately: "not store-validated" },
  },
) {
  return value.store.mutate({
    ...value.authentication,
    expectedRevision: value.state.revision,
    operationId: OPERATION_ID,
    operationKind: OPERATION_KIND,
    inputFingerprint: INPUT_FINGERPRINT,
    updatedAt: COMPLETED_AT,
  }, (state) => ({ state, result }));
}

function lookupInput(overrides: Partial<{
  runId: string;
  accessToken: string;
  operationId: string;
  operationKind: string;
  inputFingerprint: string;
}> = {}) {
  return {
    runId: RUN_ID,
    accessToken: ACCESS_TOKEN,
    operationId: OPERATION_ID,
    operationKind: OPERATION_KIND,
    inputFingerprint: INPUT_FINGERPRINT,
    ...overrides,
  };
}

describe("six-screen operation receipt store", () => {
  it("returns an exact private committed receipt without transaction or write work", async () => {
    const value = await fixture();
    const result = {
      privateReceiptVersion: 1,
      actionSpecificPayload: [{ arbitrary: true }, "opaque"],
    };
    const committed = await commitReceipt(value, result);
    expect(committed.outcome).toBe("unchanged");
    const transaction = vi.spyOn(value.storage, "transaction");
    const put = vi.spyOn(value.storage, "put");

    const lookup = await value.store.readOperationReceipt(lookupInput());

    expect(lookup).toMatchObject({
      outcome: "committed",
      result,
      receipt: {
        operationId: OPERATION_ID,
        operationKind: OPERATION_KIND,
        inputFingerprint: INPUT_FINGERPRINT,
        committedRevision: 0,
        mutationOutcome: "unchanged",
        result,
        completedAt: COMPLETED_AT,
      },
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("distinguishes unknown or expired, conflicts, unauthorized, and missing workflows", async () => {
    const value = await fixture();
    await commitReceipt(value);

    await expect(value.store.readOperationReceipt(lookupInput({
      operationId: "receipt-no-longer-retained",
    }))).resolves.toMatchObject({ outcome: "unknown_or_expired" });
    await expect(value.store.readOperationReceipt(lookupInput({
      operationKind: "open_screen_4",
    }))).resolves.toMatchObject({
      outcome: "conflict",
      committedOperationKind: OPERATION_KIND,
      committedInputFingerprint: INPUT_FINGERPRINT,
    });
    await expect(value.store.readOperationReceipt(lookupInput({
      inputFingerprint: fingerprintSixScreenValue("different-input"),
    }))).resolves.toMatchObject({ outcome: "conflict" });
    await expect(value.store.readOperationReceipt(lookupInput({
      accessToken: `sa6a_${"z".repeat(43)}`,
    }))).resolves.toEqual({ outcome: "unauthorized" });
    await expect(value.store.readOperationReceipt(lookupInput({
      runId: `sa6r_${"z".repeat(43)}`,
    }))).resolves.toEqual({ outcome: "not_found" });
  });

  it("does not quarantine, migrate, or write malformed optional analysis while recovering a receipt", async () => {
    const value = await fixture();
    await commitReceipt(value);
    const { key, record } = storedRecord(value.storage);
    (record.state as unknown as Record<string, unknown>)
      .screen3Contextualizations = { malformed: true };
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    value.storage.values.set(key, record);
    const transaction = vi.spyOn(value.storage, "transaction");
    const put = vi.spyOn(value.storage, "put");

    const lookup = await value.store.readOperationReceipt(lookupInput());

    expect(lookup.outcome).toBe("committed");
    expect(transaction).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect((storedRecord(value.storage).record.state as unknown as
      Record<string, unknown>).screen3Contextualizations)
      .toEqual({ malformed: true });
  });

  it("keeps core collection validation strict on the read-only path", async () => {
    const value = await fixture();
    await commitReceipt(value);
    const { key, record } = storedRecord(value.storage);
    (record.state as unknown as Record<string, unknown>).causalDesignSets =
      { malformed: true };
    record.stateFingerprint = fingerprintSixScreenValue(record.state);
    value.storage.values.set(key, record);

    await expect(value.store.readOperationReceipt(lookupInput()))
      .rejects.toThrow(/causal design set collection is invalid/u);

    await expect(value.store.readOperationReceipt(lookupInput({
      accessToken: `sa6a_${"z".repeat(43)}`,
    }))).resolves.toEqual({ outcome: "unauthorized" });
  });

  it("accepts legacy receipts without mutationOutcome", async () => {
    const value = await fixture();
    await commitReceipt(value);
    const { key, record } = storedRecord(value.storage);
    delete record.operationReplays[0]!.mutationOutcome;
    value.storage.values.set(key, record);

    const lookup = await value.store.readOperationReceipt(lookupInput());

    expect(lookup.outcome).toBe("committed");
    if (lookup.outcome === "committed") {
      expect(lookup.receipt).not.toHaveProperty("mutationOutcome");
    }
  });

  const invalidJournals: Array<{
    label: string;
    mutate: (record: SixScreenWorkflowStoreRecord) => void;
  }> = [
    {
      label: "more than the bounded 64 receipts",
      mutate: (record) => {
        const receipt = record.operationReplays[0]!;
        record.operationReplays = Array.from(
          { length: SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS + 1 },
          (_, index): SixScreenWorkflowOperationReplay => ({
            ...receipt,
            operationId: `bounded-operation-${index}`,
          }),
        );
      },
    },
    {
      label: "duplicate operation ids",
      mutate: (record) => {
        record.operationReplays.push(structuredClone(record.operationReplays[0]!));
      },
    },
    {
      label: "an invalid operation id",
      mutate: (record) => {
        record.operationReplays[0]!.operationId = "bad operation id";
      },
    },
    {
      label: "an invalid operation kind",
      mutate: (record) => {
        record.operationReplays[0]!.operationKind = "bad operation kind";
      },
    },
    {
      label: "an invalid input fingerprint",
      mutate: (record) => {
        record.operationReplays[0]!.inputFingerprint = "fnv1a64:not-a-hash";
      },
    },
    {
      label: "a revision newer than canonical state",
      mutate: (record) => {
        record.operationReplays[0]!.committedRevision =
          record.state.revision + 1;
      },
    },
    {
      label: "an invalid mutation outcome",
      mutate: (record) => {
        record.operationReplays[0]!.mutationOutcome = "pending" as
          "changed";
      },
    },
    {
      label: "a missing private result property",
      mutate: (record) => {
        delete (record.operationReplays[0] as
          Partial<SixScreenWorkflowOperationReplay>).result;
      },
    },
    {
      label: "an invalid completion time",
      mutate: (record) => {
        record.operationReplays[0]!.completedAt = "yesterday";
      },
    },
  ];

  for (const scenario of invalidJournals) {
    it(`rejects a replay journal with ${scenario.label}`, async () => {
      const value = await fixture();
      await commitReceipt(value);
      const { key, record } = storedRecord(value.storage);
      scenario.mutate(record);
      value.storage.values.set(key, record);

      await expect(value.store.readOperationReceipt(lookupInput()))
        .rejects.toThrow(/operation replay/u);
    });
  }

  it("validates lookup coordinates before reading storage", async () => {
    const value = await fixture();
    const get = vi.spyOn(value.storage, "get");

    await expect(value.store.readOperationReceipt(lookupInput({
      operationId: "bad operation id",
    }))).rejects.toThrow(/operation id is invalid/u);
    await expect(value.store.readOperationReceipt(lookupInput({
      operationKind: "bad operation kind",
    }))).rejects.toThrow(/operation kind is invalid/u);
    await expect(value.store.readOperationReceipt(lookupInput({
      inputFingerprint: "fnv1a64:not-a-hash",
    }))).rejects.toThrow(/input fingerprint is invalid/u);
    expect(get).not.toHaveBeenCalled();
  });
});
