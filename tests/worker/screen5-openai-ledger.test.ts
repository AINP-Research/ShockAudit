import { describe, expect, it } from "vitest";

import {
  SCREEN5_OPENAI_LEDGER_STORAGE_KEY,
  Screen5OpenAILedgerStore,
} from "../../src/worker/screen5-openai-ledger";
import { InMemorySixScreenWorkflowStorage } from
  "../../src/worker/six-screen-workflow-store";

const first = "2026-09-21T20:00:00.000Z";

describe("Screen 5 OpenAI persistent ledger", () => {
  it("renews extended capacity once across duplicate calls, restarts, and later usage", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 80, tokens: 1_900_000,
      source: "spent-preview", now: first });
    const input = { acknowledgedByOwner: true as const,
      renewalId: "fnv1a64:0123456789abcdef", window: "extended" as const,
      now: "2026-10-17T14:00:00.000Z" };
    const results = await Promise.all([
      ledger.renewAllowance(input), ledger.renewAllowance(input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ maximumAttempts: 880,
      maximumTokens: 21_900_000, attemptsReserved: 80,
      tokensConsumed: 1_900_000, remainingAttempts: 800,
      remainingTokens: 20_000_000 });
    await ledger.reserve({ reservationId: "unresolved:1", jobId: "unresolved",
      stage: "screen4_event_interpretation", reservedTokens: 56_000,
      now: input.now });
    await ledger.recordDispatch({ reservationId: "unresolved:1", now: input.now });
    const beforeRetry = await ledger.summary();
    const restarted = new Screen5OpenAILedgerStore(storage);
    expect(await restarted.renewAllowance(input)).toEqual(beforeRetry);
    expect(await restarted.reservationStatus("unresolved:1")).toBe("dispatched");
    expect(beforeRetry).toMatchObject({ tokensHeld: 56_000,
      remainingAttempts: 799, remainingTokens: 19_944_000 });
    await expect(restarted.renewAllowance({ ...input, window: "standard" }))
      .rejects.toThrow("different window");
    const stored = await storage.transaction((tx) => tx.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY));
    expect((stored as { policyHistory: unknown[] }).policyHistory).toHaveLength(1);
  });

  it("requires acknowledgement and preserves a held request through a standard renewal", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 2, tokens: 5_000, source: "prior-use", now: first });
    await ledger.reserve({ reservationId: "unknown:1", jobId: "unknown",
      stage: "planning", reservedTokens: 40_000, now: first });
    await ledger.recordDispatch({ reservationId: "unknown:1", now: first });
    const input = { acknowledgedByOwner: true as const,
      renewalId: "fnv1a64:abcdef0123456789", window: "standard" as const, now: first };
    const before = await ledger.summary();
    await expect(ledger.renewAllowance({ ...input, acknowledgedByOwner: false as true }))
      .rejects.toThrow("explicit owner action");
    expect(await ledger.summary()).toEqual(before);
    expect(await ledger.renewAllowance(input)).toMatchObject({
      attemptsReserved: 3, tokensConsumed: 5_000, tokensHeld: 40_000,
      remainingAttempts: 80, remainingTokens: 2_000_000,
    });
  });

  it("reads durable reservation evidence without creating or changing a hold", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    expect(await ledger.reservationStatus("screen4:batch:1")).toBe("absent");
    await ledger.initialize({ attempts: 0, tokens: 0,
      source: "status-fixture", now: first });
    const reservation = { reservationId: "screen4:batch:1",
      jobId: "screen4:batch:1",
      stage: "screen4_event_interpretation" as const,
      reservedTokens: 56_000,
      now: "2026-09-21T20:00:01.000Z" };
    await ledger.reserve(reservation);
    expect(await ledger.reservationStatus(reservation.reservationId))
      .toBe("reserved_not_dispatched");
    expect((await ledger.summary()).tokensHeld).toBe(56_000);
    await ledger.recordDispatch({ reservationId: reservation.reservationId,
      now: "2026-09-21T20:00:02.000Z" });
    expect(await ledger.reservationStatus(reservation.reservationId))
      .toBe("dispatched");
    await ledger.recordReceipt({ reservationId: reservation.reservationId,
      contentFingerprint: "fnv1a64:0123456789abcdef",
      now: "2026-09-21T20:00:03.000Z" });
    expect(await ledger.reservationStatus(reservation.reservationId))
      .toBe("receipt_saved");
    await ledger.settle({ reservationId: reservation.reservationId,
      usage: { promptTokens: 100, completionTokens: 40,
        totalTokens: 140, reasoningTokens: 10, cachedPromptTokens: 0 },
      now: "2026-09-21T20:00:04.000Z" });
    expect(await ledger.reservationStatus(reservation.reservationId))
      .toBe("settled");
    expect((await ledger.summary()).tokensHeld).toBe(0);
    await ledger.reserve({ ...reservation, reservationId: "screen4:batch:2",
      jobId: "screen4:batch:2", now: "2026-09-21T20:00:05.000Z" });
    await ledger.release({ reservationId: "screen4:batch:2",
      reasonCode: "pre_dispatch_cancelled",
      now: "2026-09-21T20:00:06.000Z" });
    expect(await ledger.reservationStatus("screen4:batch:2")).toBe("released");
  });

  it("serializes reservations, settles actual usage, and never lowers imported use", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({
      attempts: 2,
      tokens: 5_000,
      source: "preview-ticket-history-v1",
      now: first,
    });
    const reservations = await Promise.all([
      ledger.reserve({
        reservationId: "job-a:planning:1",
        jobId: "job-a",
        stage: "planning",
        reservedTokens: 40_000,
        now: "2026-09-21T20:00:01.000Z",
      }),
      ledger.reserve({
        reservationId: "job-b:planning:1",
        jobId: "job-b",
        stage: "planning",
        reservedTokens: 40_000,
        now: "2026-09-21T20:00:02.000Z",
      }),
    ]);
    expect(reservations.at(-1)?.attemptsReserved).toBe(4);
    expect((await ledger.summary()).tokensHeld).toBe(80_000);

    const settled = await ledger.settle({
      reservationId: "job-a:planning:1",
      usage: {
        promptTokens: 900,
        completionTokens: 500,
        totalTokens: 1_400,
        reasoningTokens: 200,
        cachedPromptTokens: 0,
      },
      now: "2026-09-21T20:00:03.000Z",
    });
    expect(settled).toMatchObject({
      attemptsReserved: 4,
      attemptsSettled: 3,
      attemptsHeld: 1,
      tokensConsumed: 6_400,
      tokensHeld: 40_000,
      tokensCommitted: 46_400,
    });
    await expect(ledger.initialize({
      attempts: 1,
      tokens: 4_999,
      source: "unsafe-reset",
      now: "2026-09-21T20:00:04.000Z",
    })).rejects.toThrow(/cannot lower/u);
  });

  it("fails closed when aggregate attempts cannot admit another call", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({
      attempts: 80,
      tokens: 20_000,
      source: "exhausted-ticket-history",
      now: first,
    });
    await expect(ledger.reserve({
      reservationId: "job-c:planning:1",
      jobId: "job-c",
      stage: "planning",
      reservedTokens: 40_000,
      now: "2026-09-21T20:00:01.000Z",
    })).rejects.toThrow(/allowance is exhausted/u);
  });

  it("keeps an unknown outcome held across store recreation", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const firstStore = new Screen5OpenAILedgerStore(storage);
    await firstStore.initialize({
      attempts: 0,
      tokens: 0,
      source: "initial-preview-ticket",
      now: first,
    });
    await firstStore.reserve({
      reservationId: "job-unknown:assessment:1",
      jobId: "job-unknown",
      stage: "assessment",
      reservedTokens: 64_000,
      now: "2026-09-21T20:00:01.000Z",
    });
    const restored = new Screen5OpenAILedgerStore(storage);
    expect(await restored.summary()).toMatchObject({
      attemptsReserved: 1,
      attemptsHeld: 1,
      tokensConsumed: 0,
      tokensHeld: 64_000,
      remainingAttempts: 79,
      remainingTokens: 1_936_000,
    });
  });

  it("releases a proven pre-dispatch reservation once without fabricating usage", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({
      attempts: 1,
      tokens: 24_000,
      source: "openai-conservative-floor",
      now: first,
    });
    await ledger.reserve({
      reservationId: "job-local:planning:1",
      jobId: "job-local",
      stage: "planning",
      reservedTokens: 40_000,
      now: "2026-09-21T20:00:01.000Z",
    });

    const released = await ledger.release({
      reservationId: "job-local:planning:1",
      reasonCode: "wrong_transport",
      now: "2026-09-21T20:00:02.000Z",
    });
    const replayed = await ledger.release({
      reservationId: "job-local:planning:1",
      reasonCode: "wrong_transport",
      now: "2026-09-21T20:00:03.000Z",
    });

    expect(released).toEqual(replayed);
    expect(released).toMatchObject({
      attemptsReserved: 1,
      attemptsSettled: 1,
      attemptsHeld: 0,
      tokensConsumed: 24_000,
      tokensHeld: 0,
      tokensCommitted: 24_000,
      remainingAttempts: 79,
      remainingTokens: 1_976_000,
    });
    await expect(ledger.settle({
      reservationId: "job-local:planning:1",
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        reasoningTokens: null,
        cachedPromptTokens: null,
      },
      now: "2026-09-21T20:00:04.000Z",
    })).rejects.toThrow(/settlement is invalid/u);
  });

  it("migrates an untouched v1 allowance while preserving usage and an unknown hold", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v1",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 12, maximumTokens: 200_000,
        importedBase: { attempts: 2, tokens: 5_000,
          source: "pre-v23", importedAt: first },
        events: [{ kind: "reserved", reservationId: "old-run:assessment:1",
          jobId: "old-run", stage: "assessment", reservedTokens: 24_000,
          recordedAt: "2026-09-21T20:00:01.000Z" }],
      });
    });
    const ledger = new Screen5OpenAILedgerStore(storage);
    expect(await ledger.initialize({ attempts: 2, tokens: 5_000,
      source: "pre-v23", now: "2026-09-21T20:00:02.000Z" })).toMatchObject({
      maximumAttempts: 80, maximumTokens: 2_000_000,
      attemptsReserved: 3, tokensConsumed: 5_000, tokensHeld: 24_000,
      remainingAttempts: 77, remainingTokens: 1_971_000,
    });
    const migrated = await storage.transaction((transaction) =>
      transaction.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY));
    expect(migrated).toMatchObject({
      schemaVersion: "screen-05-openai-ledger-v2",
      initialPolicy: { source: "legacy_v1" },
      policyHistory: [{ kind: "policy_updated",
        previousAttempts: 12, previousTokens: 200_000,
        maximumAttempts: 80, maximumTokens: 2_000_000,
        reasonCode: "expanded_preview_policy_migrated" }],
    });
    await expect(ledger.updatePolicy({
      acknowledgedByOwner: false as true, maximumAttempts: 80,
      maximumTokens: 2_000_000, reasonCode: "acknowledged_renewal",
      now: "2026-09-21T20:00:03.000Z",
    })).rejects.toThrow(/acknowledgement/u);
    const unchanged = await ledger.updatePolicy({
      acknowledgedByOwner: true, maximumAttempts: 80,
      maximumTokens: 2_000_000, reasonCode: "acknowledged_renewal",
      now: "2026-09-21T20:00:04.000Z",
    });
    expect(unchanged).toMatchObject({ maximumAttempts: 80,
      maximumTokens: 2_000_000, attemptsReserved: 3,
      tokensConsumed: 5_000, tokensHeld: 24_000,
      remainingTokens: 1_971_000 });
    const restored = new Screen5OpenAILedgerStore(storage);
    expect(await restored.summary()).toEqual(unchanged);
    expect(await restored.initialize({ attempts: 0, tokens: 0,
      source: "routine-reopen", now: "2026-09-21T20:00:05.000Z" }))
      .toEqual(unchanged);
    const stored = await storage.transaction((transaction) =>
      transaction.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY));
    expect(stored).toMatchObject({ policyHistory: [{ kind: "policy_updated",
      previousAttempts: 12, previousTokens: 200_000,
      maximumAttempts: 80, maximumTokens: 2_000_000 }] });
  });

  it("upgrades an already-schema-migrated legacy cap on routine reopen", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v2",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 12, maximumTokens: 200_000,
        importedBase: { attempts: 2, tokens: 5_000,
          source: "pre-v23", importedAt: first },
        events: [{ kind: "reserved", reservationId: "old-run:assessment:1",
          jobId: "old-run", stage: "assessment", reservedTokens: 24_000,
          recordedAt: "2026-09-21T20:00:01.000Z" }],
        initialPolicy: { source: "legacy_v1", maximumAttempts: 12,
          maximumTokens: 200_000 },
        policyHistory: [],
      });
    });
    const summary = await new Screen5OpenAILedgerStore(storage).initialize({
      attempts: 0, tokens: 0, source: "routine-reopen",
      now: "2026-09-21T20:00:02.000Z",
    });
    expect(summary).toMatchObject({ maximumAttempts: 80,
      maximumTokens: 2_000_000, attemptsReserved: 3,
      tokensHeld: 24_000, remainingAttempts: 77,
      remainingTokens: 1_971_000 });
  });

  it("silently doubles an exhausted previous default while preserving use", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    await storage.transaction(async (transaction) => {
      await transaction.put(SCREEN5_OPENAI_LEDGER_STORAGE_KEY, {
        schemaVersion: "screen-05-openai-ledger-v2",
        pilotId: "screen5-openai-luna-standard-v1",
        maximumAttempts: 40,
        maximumTokens: 1_000_000,
        importedBase: {
          attempts: 40,
          tokens: 1_000_000,
          source: "previous-default",
          importedAt: first,
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
    expect(await ledger.initialize({ attempts: 0, tokens: 0,
      source: "routine-reopen", now: "2026-09-21T20:00:02.000Z" }))
      .toMatchObject({
        maximumAttempts: 80,
        maximumTokens: 2_000_000,
        attemptsReserved: 40,
        tokensCommitted: 1_000_000,
        remainingAttempts: 40,
        remainingTokens: 1_000_000,
      });
    const stored = await storage.transaction((transaction) =>
      transaction.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY));
    expect(stored).toMatchObject({ policyHistory: [{
      previousAttempts: 40,
      previousTokens: 1_000_000,
      maximumAttempts: 80,
      maximumTokens: 2_000_000,
      reasonCode: "expanded_preview_policy_migrated",
    }] });
  });

  it("retains an explicit lower owner limit and prevents releasing a dispatched hold", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 0, tokens: 0, source: "new-default",
      now: first });
    await ledger.updatePolicy({ acknowledgedByOwner: true,
      maximumAttempts: 20, maximumTokens: 250_000,
      reasonCode: "owner_lower_limit", now: "2026-09-21T20:00:01.000Z" });
    await ledger.reserve({ reservationId: "new-run:planning:1",
      jobId: "new-run", stage: "planning", reservedTokens: 40_000,
      now: "2026-09-21T20:00:02.000Z" });
    await ledger.recordDispatch({ reservationId: "new-run:planning:1",
      now: "2026-09-21T20:00:03.000Z" });
    await expect(ledger.release({ reservationId: "new-run:planning:1",
      reasonCode: "uncertain_timeout", now: "2026-09-21T20:00:04.000Z" }))
      .rejects.toThrow(/dispatched/u);
    await new Screen5OpenAILedgerStore(storage).initialize({ attempts: 0,
      tokens: 0, source: "new-default", now: "2026-09-21T20:00:05.000Z" });
    expect(await ledger.summary()).toMatchObject({ maximumAttempts: 20,
      maximumTokens: 250_000, attemptsHeld: 1, tokensHeld: 40_000,
      remainingTokens: 210_000 });
  });

  it("settles provider-reported usage even if it exceeds the estimate and freezes allowance", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 0, tokens: 0, source: "test",
      now: first });
    await ledger.updatePolicy({ acknowledgedByOwner: true,
      maximumAttempts: 20, maximumTokens: 60_000,
      reasonCode: "owner_lower_limit", now: "2026-09-21T20:00:01.000Z" });
    await ledger.reserve({ reservationId: "overage:planning:1", jobId: "overage",
      stage: "planning", reservedTokens: 40_000,
      now: "2026-09-21T20:00:02.000Z" });
    const usage = { promptTokens: 40_000, completionTokens: 25_000,
      totalTokens: 65_000, reasoningTokens: 10_000,
      cachedPromptTokens: 500 };
    const settled = await ledger.settle({ reservationId: "overage:planning:1",
      usage, now: "2026-09-21T20:00:03.000Z" });
    expect(settled).toMatchObject({ tokensConsumed: 65_000,
      tokensHeld: 0, tokensCommitted: 65_000, remainingTokens: 0 });
    expect(await ledger.settle({ reservationId: "overage:planning:1",
      usage, now: "2026-09-21T20:00:04.000Z" })).toEqual(settled);
    await expect(ledger.reserve({ reservationId: "overage:planning:2",
      jobId: "overage", stage: "planning", reservedTokens: 40_000,
      now: "2026-09-21T20:00:05.000Z" })).rejects.toThrow(/allowance is exhausted/u);
  });
});
