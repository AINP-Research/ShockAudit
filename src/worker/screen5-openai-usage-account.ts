import { fingerprintSixScreenValue } from "../core/six-screen/canonical";
import { LOCAL_MODEL_ALLOWANCE_WINDOWS, LOCAL_MODEL_USAGE_ADMISSION_HEADROOM,
  type LocalModelAllowanceWindow } from
  "../core/six-screen/model-task-profiles";
import { SCREEN5_OPENAI_PILOT_ID, type Screen5MechanismBudgetSnapshot,
  type Screen5MechanismUsage } from "../core/six-screen/screen5-mechanism";
import type { Screen5OpenAILedger, Screen5OpenAILedgerEvent } from
  "./screen5-openai-ledger";

/** Per-reservation records prevent a lifetime event-array ceiling. The old
 * ledger stays sealed as migration evidence; its reservations are read lazily. */
export const MODEL_USAGE_ACCOUNT_KEY = "__shockaudit-system:model-usage-account-v3";
type Transaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
};
type Account = {
  schemaVersion: "model-usage-account-v3";
  policyMode: "bounded" | "reviewer" | "unlimited";
  maximumAttempts: number | null;
  maximumTokens: number | null;
  attemptsReserved: number;
  attemptsSettled: number;
  tokensConsumed: number;
  tokensHeld: number;
  legacyKey: string;
  legacyFingerprint: string;
  lastRenewalId?: string;
  lastRenewalWindow?: LocalModelAllowanceWindow;
};
type Reservation = { reservationId: string; events: Screen5OpenAILedgerEvent[] };
type Reserved = Extract<Screen5OpenAILedgerEvent, { kind: "reserved" }>;
const key = (kind: string, id: string) => `${MODEL_USAGE_ACCOUNT_KEY}:${kind}:${fingerprintSixScreenValue(id)}`;
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const iso = (s: string) => Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const identifier = (s: string) => /^[A-Za-z0-9._:-]{1,200}$/u.test(s);
const hash = (s: string) => /^fnv1a64:[0-9a-f]{16}$/u.test(s);

export async function readModelUsageAccount(t: Transaction): Promise<Account | null> {
  const value = await t.get(MODEL_USAGE_ACCOUNT_KEY);
  if (value === undefined) return null;
  const a = value as Account;
  if (!a || a.schemaVersion !== "model-usage-account-v3" ||
    !["bounded", "reviewer", "unlimited"].includes(a.policyMode) ||
    ![a.attemptsReserved, a.attemptsSettled, a.tokensConsumed, a.tokensHeld]
      .every(integer) || a.attemptsSettled > a.attemptsReserved ||
    !integer(a.tokensConsumed + a.tokensHeld) ||
    typeof a.legacyKey !== "string" || !hash(a.legacyFingerprint) ||
    (a.lastRenewalId !== undefined && !hash(a.lastRenewalId)) ||
    (a.lastRenewalWindow !== undefined && !Object.hasOwn(LOCAL_MODEL_ALLOWANCE_WINDOWS, a.lastRenewalWindow)) ||
    (a.policyMode !== "bounded"
      ? a.maximumAttempts !== null || a.maximumTokens !== null
      : !integer(a.maximumAttempts) || !integer(a.maximumTokens) ||
        a.maximumAttempts < a.attemptsReserved)) {
    throw new Error("The persistent model usage account is invalid.");
  }
  return a;
}

export function modelUsageSummary(a: Account): Screen5MechanismBudgetSnapshot {
  const committed = a.tokensConsumed + a.tokensHeld;
  const headroom = LOCAL_MODEL_USAGE_ADMISSION_HEADROOM;
  // Older task interfaces require numeric readiness. These are always-fresh
  // admission headroom, not a finite lifetime quota, for configured runtime use.
  const maximumAttempts = a.maximumAttempts ?? a.attemptsReserved + headroom.maximumDispatchedAttempts;
  const maximumTokens = a.maximumTokens ?? committed + headroom.maximumTokens;
  if (!integer(maximumAttempts) || !integer(maximumTokens)) {
    throw new Error("Model usage exceeds safe accounting precision.");
  }
  return { pilotId: SCREEN5_OPENAI_PILOT_ID, policyMode: a.policyMode,
    ...(a.lastRenewalId ? { lastRenewalId: a.lastRenewalId, lastRenewalWindow: a.lastRenewalWindow } : {}),
    accountingVersion: "persistent-v3", maximumAttempts, maximumTokens,
    attemptsReserved: a.attemptsReserved, attemptsSettled: a.attemptsSettled,
    attemptsHeld: a.attemptsReserved - a.attemptsSettled,
    tokensConsumed: a.tokensConsumed, tokensHeld: a.tokensHeld,
    tokensCommitted: committed,
    remainingAttempts: Math.max(0, maximumAttempts - a.attemptsReserved),
    remainingTokens: Math.max(0, maximumTokens - committed) };
}

export async function migrateModelUsageAccount(t: Transaction, ledger: Screen5OpenAILedger,
  legacyKey: string, summary: Screen5MechanismBudgetSnapshot) {
  const a: Account = { schemaVersion: "model-usage-account-v3", policyMode: "reviewer",
    maximumAttempts: null, maximumTokens: null,
    attemptsReserved: summary.attemptsReserved, attemptsSettled: summary.attemptsSettled,
    tokensConsumed: summary.tokensConsumed, tokensHeld: summary.tokensHeld,
    ...(summary.lastRenewalId ? { lastRenewalId: summary.lastRenewalId,
      lastRenewalWindow: summary.lastRenewalWindow } : {}),
    legacyKey, legacyFingerprint: fingerprintSixScreenValue(ledger) };
  // Preserve replay protection for renewals issued before the migration, too.
  for (const event of ledger.policyHistory ?? []) {
    if (event.renewal) await t.put(key("renewal", event.renewal.id), {
      renewalId: event.renewal.id, window: event.renewal.window, now: event.recordedAt,
    });
  }
  await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  return a;
}

/** Configured local and production runtimes use uncapped cumulative accounting. Retain
 * historical policy values only for compatibility with saved v60 records. */
export async function useUnlimitedRuntimeUsage(t: Transaction, a: Account) {
  if (a.policyMode !== "unlimited") {
    a.policyMode = "unlimited";
    a.maximumAttempts = null;
    a.maximumTokens = null;
    await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  }
  return modelUsageSummary(a);
}

async function reservation(t: Transaction, a: Account, id: string): Promise<Reservation> {
  if (!identifier(id)) throw new Error("Model reservation ID is invalid.");
  const saved = await t.get(key("reservation", id));
  if (saved !== undefined) {
    const r = saved as Reservation;
    if (r?.reservationId !== id || !Array.isArray(r.events) || r.events.length > 5 ||
      r.events.some((e) => e.reservationId !== id)) {
      throw new Error("The saved model reservation is invalid.");
    }
    return r;
  }
  const legacy = await t.get(a.legacyKey) as Screen5OpenAILedger;
  if (fingerprintSixScreenValue(legacy) !== a.legacyFingerprint) {
    throw new Error("The sealed model usage migration source changed.");
  }
  return { reservationId: id, events: legacy.events.filter((e) => e.reservationId === id) };
}

export async function modelReservationStatus(t: Transaction, a: Account, id: string) {
  const r = await reservation(t, a, id);
  if (r.events.some((e) => e.kind === "released")) return "released" as const;
  if (r.events.some((e) => e.kind === "settled")) return "settled" as const;
  if (r.events.some((e) => e.kind === "receipt_saved")) return "receipt_saved" as const;
  if (r.events.some((e) => e.kind === "dispatched")) return "dispatched" as const;
  return r.events.length ? "reserved_not_dispatched" as const : "absent" as const;
}

export async function renewModelUsageAccount(t: Transaction, a: Account, input: {
  renewalId: string; window: LocalModelAllowanceWindow; now: string;
}) {
  const renewalKey = key("renewal", input.renewalId);
  const prior = await t.get(renewalKey) as typeof input | undefined;
  if (prior) {
    if (prior.renewalId !== input.renewalId || prior.window !== input.window) {
      throw new Error("The saved allowance renewal belongs to a different window.");
    }
    return modelUsageSummary(a);
  }
  if (!hash(input.renewalId) || !iso(input.now) ||
    !Object.hasOwn(LOCAL_MODEL_ALLOWANCE_WINDOWS, input.window)) {
    throw new Error("The model allowance policy request is invalid.");
  }
  const previousPolicy = { mode: a.policyMode, attempts: a.maximumAttempts, tokens: a.maximumTokens };
  const window = LOCAL_MODEL_ALLOWANCE_WINDOWS[input.window];
  // An older widget may still send a renewal. Acknowledging that receipt must
  // not restore a cumulative cap in the current local application.
  if (a.policyMode !== "unlimited") {
    a.policyMode = input.window === "reviewer" ? "reviewer" : "bounded";
    a.maximumAttempts = a.policyMode === "reviewer" ? null : a.attemptsReserved + window.maximumDispatchedAttempts;
    a.maximumTokens = a.policyMode === "reviewer" ? null : a.tokensConsumed + a.tokensHeld + window.maximumTokens;
  }
  a.lastRenewalId = input.renewalId;
  a.lastRenewalWindow = input.window;
  const result = modelUsageSummary(a);
  await t.put(renewalKey, { ...input, previousPolicy });
  await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  return result;
}

export async function updateModelUsagePolicy(t: Transaction, a: Account, input: {
  maximumAttempts: number; maximumTokens: number; reasonCode: string; now: string;
}) {
  if (a.policyMode === "unlimited") return modelUsageSummary(a);
  if (input.maximumAttempts < a.attemptsReserved ||
    input.maximumTokens < a.tokensConsumed + a.tokensHeld) {
    throw new Error("Model policy cannot erase consumed use or unknown holds.");
  }
  await t.put(key("policy", fingerprintSixScreenValue({ previous: a, input })),
    { previous: a, input });
  a.policyMode = "bounded";
  a.maximumAttempts = input.maximumAttempts;
  a.maximumTokens = input.maximumTokens;
  await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  return modelUsageSummary(a);
}

export async function reserveModelUsage(t: Transaction, a: Account, input: Omit<Reserved, "kind" | "recordedAt"> & { now: string }) {
  if (!identifier(input.jobId) || !integer(input.reservedTokens) || input.reservedTokens < 1 ||
    !iso(input.now) || !["planning", "assessment",
      "screen2_policy_interpretation", "screen3_contextualization",
      "screen4_query_plan", "screen4_event_interpretation", "screen6_contextualization"].includes(input.stage)) {
    throw new Error("Model reservation is invalid.");
  }
  const r = await reservation(t, a, input.reservationId);
  const prior = r.events.find((e) => e.kind === "reserved");
  if (prior) {
    if (prior.jobId !== input.jobId || prior.stage !== input.stage || prior.reservedTokens !== input.reservedTokens) {
      throw new Error("Model reservation id was reused.");
    }
    return modelUsageSummary(a);
  }
  if (a.policyMode === "bounded" &&
    (a.attemptsReserved >= a.maximumAttempts! ||
      a.tokensConsumed + a.tokensHeld + input.reservedTokens > a.maximumTokens!)) {
    throw new Error("Screen 5 provider global pilot allowance is exhausted.");
  }
  r.events.push({ kind: "reserved", reservationId: input.reservationId, jobId: input.jobId,
    stage: input.stage, reservedTokens: input.reservedTokens, recordedAt: input.now });
  a.attemptsReserved += 1;
  a.tokensHeld += input.reservedTokens;
  const result = modelUsageSummary(a);
  await t.put(key("reservation", input.reservationId), r);
  await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  return result;
}

export async function recordModelUsage(t: Transaction, a: Account, event: Exclude<Screen5OpenAILedgerEvent, Reserved>) {
  if (!iso(event.recordedAt)) throw new Error("Model usage timestamp is invalid.");
  const r = await reservation(t, a, event.reservationId);
  const reserved = r.events.find((e) => e.kind === "reserved");
  if (!reserved) throw new Error("Model usage has no reservation.");
  const prior = r.events.find((e) => e.kind === event.kind);
  if (prior) {
    const { recordedAt: _at, ...priorFact } = prior;
    const { recordedAt: _newAt, ...newFact } = event;
    if (fingerprintSixScreenValue(priorFact) !== fingerprintSixScreenValue(newFact)) {
      throw new Error("Model usage changed after persistence.");
    }
    return modelUsageSummary(a);
  }
  const terminal = r.events.some((e) => e.kind === "settled" || e.kind === "released");
  if (terminal || (event.kind === "released" && r.events.some((e) => e.kind === "dispatched" || e.kind === "receipt_saved"))) {
    throw new Error("A dispatched or settled model reservation cannot be released or reused.");
  }
  if ((event.kind === "receipt_saved" && !hash(event.contentFingerprint)) ||
    (event.kind === "settled" && (!integer(event.actualTokens) || !hash(event.usageFingerprint))) ||
    (event.kind === "released" && !/^[a-z][a-z0-9_]{0,79}$/u.test(event.reasonCode))) {
    throw new Error("Model usage event is invalid.");
  }
  if (event.kind === "settled") {
    a.attemptsSettled += 1;
    a.tokensConsumed += event.actualTokens;
    a.tokensHeld -= reserved.reservedTokens;
  } else if (event.kind === "released") {
    a.attemptsReserved -= 1;
    a.tokensHeld -= reserved.reservedTokens;
  }
  r.events.push(event);
  const result = modelUsageSummary(a);
  await t.put(key("reservation", event.reservationId), r);
  await t.put(MODEL_USAGE_ACCOUNT_KEY, a);
  return result;
}

export function settlementEvent(input: { reservationId: string; usage: Screen5MechanismUsage; now: string }): Exclude<Screen5OpenAILedgerEvent, Reserved> {
  return { kind: "settled", reservationId: input.reservationId, actualTokens: input.usage.totalTokens,
    usageFingerprint: fingerprintSixScreenValue(input.usage), recordedAt: input.now };
}
