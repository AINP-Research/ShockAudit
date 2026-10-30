import { describe, expect, it } from "vitest";
import { fingerprintSixScreenValue } from "../../src/core/six-screen/canonical";
import { Screen5OpenAILedgerStore, SCREEN5_OPENAI_LEDGER_STORAGE_KEY } from
  "../../src/worker/screen5-openai-ledger";
import { MODEL_USAGE_ACCOUNT_KEY } from "../../src/worker/screen5-openai-usage-account";
import { InMemorySixScreenWorkflowStorage } from "../../src/worker/six-screen-workflow-store";

const now = "2026-10-17T19:00:00.000Z";
const renewal = (id: string, window: "reviewer" | "standard" | "extended" = "reviewer") => ({
  acknowledgedByOwner: true as const, renewalId: fingerprintSixScreenValue(id), window, now,
});
const usage = { promptTokens: 48_000, completionTokens: 32_000, totalTokens: 80_000,
  reasoningTokens: 1_000, cachedPromptTokens: 0 };

describe("persistent local model usage", () => {
  it.each(["new", "legacy", "reviewer", "bounded"])(
    "automatically opens %s local usage without activation or loss of prior records", async (saved) => {
      const storage = new InMemorySixScreenWorkflowStorage();
      const ledger = new Screen5OpenAILedgerStore(storage);
      if (saved !== "new") {
        await ledger.initialize({ attempts: 80, tokens: 1_900_000, source: "old-use", now });
        await ledger.renewAllowance(renewal("old-extended", "extended"));
        await ledger.reserve({ reservationId: "old-unknown", jobId: "old",
          stage: "screen3_contextualization", reservedTokens: 48_000, now });
        await ledger.recordDispatch({ reservationId: "old-unknown", now });
        if (saved !== "legacy") await ledger.renewAllowance(renewal("old-reviewer"));
        if (saved === "bounded") await ledger.renewAllowance(renewal("old-standard", "standard"));
      }
      const initialized = await ledger.initializeLocalUsage({ attempts: 0, tokens: 0, source: "local-app", now });
      expect(initialized).toMatchObject({ policyMode: "unlimited", accountingVersion: "persistent-v3",
        tokensConsumed: saved === "new" ? 0 : 1_900_000,
        tokensHeld: saved === "new" ? 0 : 48_000,
        attemptsReserved: saved === "new" ? 0 : 81 });
      expect(await storage.get(MODEL_USAGE_ACCOUNT_KEY)).toMatchObject({
        maximumAttempts: null, maximumTokens: null });
      const restarted = new Screen5OpenAILedgerStore(storage);
      expect(await restarted.initializeLocalUsage({ attempts: 0, tokens: 0, source: "reopen", now }))
        .toEqual(initialized);
      if (saved !== "new") expect(await restarted.reservationStatus("old-unknown")).toBe("dispatched");
    });

  it("reads legacy reviewer receipts and preserves historical usage, unknown holds, and replay", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 80, tokens: 1_900_000, source: "prior-usage", now });
    await ledger.renewAllowance(renewal("earlier", "extended"));
    const hold = { reservationId: "old:unknown", jobId: "old", stage: "screen3_contextualization" as const,
      reservedTokens: 48_000, now };
    await ledger.reserve(hold);
    await ledger.recordDispatch({ reservationId: hold.reservationId, now });
    const legacy = await storage.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY);
    const enabled = await ledger.renewAllowance(renewal("enable"));
    expect(enabled).toMatchObject({ policyMode: "reviewer", accountingVersion: "persistent-v3",
      attemptsReserved: 81, attemptsHeld: 1, tokensConsumed: 1_900_000, tokensHeld: 48_000 });
    const restarted = new Screen5OpenAILedgerStore(storage);
    expect(await restarted.initialize({ attempts: 0, tokens: 0, source: "reopen", now })).toEqual(enabled);
    expect(await restarted.renewAllowance(renewal("enable"))).toEqual(enabled);
    expect(await restarted.renewAllowance(renewal("earlier", "extended"))).toEqual(enabled);
    await expect(restarted.renewAllowance(renewal("earlier"))).rejects.toThrow(/different window/u);
    expect(await restarted.reserve(hold)).toEqual(enabled);
    expect(await restarted.reservationStatus(hold.reservationId)).toBe("dispatched");
    await expect(restarted.release({ reservationId: hold.reservationId, reasonCode: "unknown", now }))
      .rejects.toThrow(/dispatched/u);
    expect(await storage.get(SCREEN5_OPENAI_LEDGER_STORAGE_KEY)).toEqual(legacy);
    await expect(restarted.renewAllowance(renewal("enable", "standard"))).rejects.toThrow(/different window/u);
  });

  it("continues past the former token and 4096-event lifetime ceilings with one durable record per request", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initializeLocalUsage({ attempts: 0, tokens: 0, source: "stress", now });
    for (let i = 0; i < 1_300; i += 1) {
      const reservationId = `reviewer-${i}`;
      await ledger.reserve({ reservationId, jobId: reservationId,
        stage: "screen6_contextualization", reservedTokens: 80_000, now });
      await ledger.recordDispatch({ reservationId, now });
      await ledger.recordReceipt({ reservationId, contentFingerprint: fingerprintSixScreenValue(i), now });
      await ledger.settle({ reservationId, usage, now });
    }
    const restarted = new Screen5OpenAILedgerStore(storage);
    const final = await restarted.summary();
    expect(final).toMatchObject({ policyMode: "unlimited", attemptsReserved: 1_300,
      attemptsSettled: 1_300, tokensConsumed: 104_000_000, tokensHeld: 0 });
    expect(JSON.stringify(await storage.get(MODEL_USAGE_ACCOUNT_KEY)).length).toBeLessThan(1_000);
    expect(await restarted.reservationStatus("reviewer-0")).toBe("settled");
    expect(await restarted.settle({ reservationId: "reviewer-0", usage, now })).toEqual(final);
    expect(await restarted.reserve({ reservationId: "reviewer-0", jobId: "reviewer-0",
      stage: "screen6_contextualization", reservedTokens: 80_000, now })).toEqual(final);
    const oldWidgetRenewal = await restarted.renewAllowance(renewal("old-widget", "standard"));
    expect(oldWidgetRenewal).toMatchObject({ policyMode: "unlimited", tokensConsumed: 104_000_000,
      remainingAttempts: 800, remainingTokens: 20_000_000 });
    expect(await restarted.initializeLocalUsage({ attempts: 0, tokens: 0, source: "restart", now }))
      .toEqual(oldWidgetRenewal);

  }, 30_000);

  it("reserves concurrently and settles exactly once while preserving pre-dispatch release", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const ledger = new Screen5OpenAILedgerStore(storage);
    await ledger.initialize({ attempts: 0, tokens: 0, source: "concurrency", now });
    await expect(ledger.renewAllowance({ ...renewal("denied"), acknowledgedByOwner: false as true }))
      .rejects.toThrow(/explicit owner/u);
    expect(await storage.get(MODEL_USAGE_ACCOUNT_KEY)).toBeUndefined();
    await ledger.renewAllowance(renewal("enable"));
    const request = { reservationId: "same", jobId: "same", stage: "assessment" as const, reservedTokens: 80_000, now };
    await Promise.all([ledger.reserve(request), ledger.reserve(request)]);
    expect(await ledger.summary()).toMatchObject({ attemptsReserved: 1, tokensHeld: 80_000 });
    await Promise.all([ledger.settle({ reservationId: "same", usage, now }),
      ledger.settle({ reservationId: "same", usage, now })]);
    expect(await ledger.summary()).toMatchObject({ attemptsReserved: 1, tokensConsumed: 80_000, tokensHeld: 0 });
    await expect(ledger.settle({ reservationId: "same", usage: { ...usage, cachedPromptTokens: 1 }, now }))
      .rejects.toThrow(/changed after persistence/u);
    await ledger.reserve({ ...request, reservationId: "pre-dispatch" });
    await ledger.release({ reservationId: "pre-dispatch", reasonCode: "local_failure", now });
    expect(await ledger.reservationStatus("pre-dispatch")).toBe("released");
    expect(await ledger.summary()).toMatchObject({ attemptsReserved: 1, tokensConsumed: 80_000, tokensHeld: 0 });
  });
});
