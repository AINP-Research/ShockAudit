import {
  SCREEN5_OPENAI_MAX_ATTEMPTS,
  SCREEN5_OPENAI_MAX_TOKENS,
  SCREEN5_OPENAI_PILOT_ID,
  type Screen5MechanismBudgetSnapshot,
  type Screen5MechanismUsage,
} from "../core/six-screen/screen5-mechanism";
import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import { LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING,
  LOCAL_MODEL_ALLOWANCE_WINDOWS, type LocalModelAllowanceWindow } from
  "../core/six-screen/model-task-profiles";
import { readModelUsageAccount, modelUsageSummary, migrateModelUsageAccount,
  renewModelUsageAccount, updateModelUsagePolicy, modelReservationStatus,
  reserveModelUsage, recordModelUsage, settlementEvent, useUnlimitedRuntimeUsage } from
  "./screen5-openai-usage-account";

export const SCREEN5_OPENAI_LEDGER_VERSION =
  "screen-05-openai-ledger-v2" as const;
const PREVIOUS_SCREEN5_OPENAI_LEDGER_VERSION =
  "screen-05-openai-ledger-v1" as const;
export const SCREEN5_OPENAI_LEDGER_STORAGE_KEY =
  "__shockaudit-system:screen5-openai-ledger-v1" as const;

type Screen5OpenAILedgerProfile = {
  schemaVersion: string;
  pilotId: string;
  maximumAttempts: number;
  maximumTokens: number;
  storageKey: string;
  label: string;
};

const OPENAI_LEDGER_PROFILE: Screen5OpenAILedgerProfile = {
  schemaVersion: SCREEN5_OPENAI_LEDGER_VERSION,
  pilotId: SCREEN5_OPENAI_PILOT_ID,
  maximumAttempts: SCREEN5_OPENAI_MAX_ATTEMPTS,
  maximumTokens: SCREEN5_OPENAI_MAX_TOKENS,
  storageKey: SCREEN5_OPENAI_LEDGER_STORAGE_KEY,
  label: "OpenAI runtime",
};
const LEGACY_MAXIMUM_ATTEMPTS = 12;
const LEGACY_MAXIMUM_TOKENS = 200_000;
const PREVIOUS_DEFAULT_MAXIMUM_ATTEMPTS = 40;
const PREVIOUS_DEFAULT_MAXIMUM_TOKENS = 1_000_000;

export type Screen5OpenAIPolicyEvent = {
  kind: "policy_updated";
  policyVersion: typeof SCREEN5_OPENAI_LEDGER_VERSION;
  previousAttempts: number;
  previousTokens: number;
  maximumAttempts: number;
  maximumTokens: number;
  reasonCode: string;
  recordedAt: string;
  renewal?: { id: string; window: LocalModelAllowanceWindow };
};

export type Screen5OpenAILedgerEvent =
  | {
      kind: "reserved";
      reservationId: string;
      jobId: string;
      stage: "planning" | "assessment" | "screen3_contextualization" |
        "screen2_policy_interpretation" |
        "screen4_query_plan" | "screen4_event_interpretation" |
        "screen6_contextualization";
      reservedTokens: number;
      recordedAt: string;
    }
  | {
      kind: "dispatched";
      reservationId: string;
      recordedAt: string;
    }
  | {
      kind: "receipt_saved";
      reservationId: string;
      contentFingerprint: string;
      recordedAt: string;
    }
  | {
      kind: "settled";
      reservationId: string;
      actualTokens: number;
      usageFingerprint: string;
      recordedAt: string;
    }
  | {
      kind: "released";
      reservationId: string;
      reasonCode: string;
      recordedAt: string;
    };

export type Screen5OpenAILedger = {
  schemaVersion: string;
  pilotId: string;
  maximumAttempts: number;
  maximumTokens: number;
  importedBase: {
    attempts: number;
    tokens: number;
    source: string;
    importedAt: string;
  };
  events: Screen5OpenAILedgerEvent[];
  /** Absent on an unmodified v1 record, present on v23 records. */
  initialPolicy?: {
    source: "new_default" | "legacy_v1";
    maximumAttempts: number;
    maximumTokens: number;
  };
  policyHistory?: Screen5OpenAIPolicyEvent[];
};

type LedgerTransaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
};

export type Screen5OpenAILedgerStorage = {
  transaction<T>(callback: (transaction: LedgerTransaction) => Promise<T>):
    Promise<T>;
};

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value;
}

function safeInteger(value: unknown, minimum = 0) {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function validateLedger(
  value: unknown,
): Screen5OpenAILedger {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Screen 5 provider ledger is invalid.");
  }
  const ledger = value as Screen5OpenAILedger;
  const legacy = ledger.schemaVersion === PREVIOUS_SCREEN5_OPENAI_LEDGER_VERSION;
  const profile = { ...OPENAI_LEDGER_PROFILE,
    maximumAttempts: ledger.maximumAttempts,
    maximumTokens: ledger.maximumTokens,
  };
  if (
    (!legacy && ledger.schemaVersion !== SCREEN5_OPENAI_LEDGER_VERSION) ||
    ledger.pilotId !== profile.pilotId ||
    !safeInteger(ledger.maximumAttempts, 1) ||
    !safeInteger(ledger.maximumTokens, 1) ||
    ledger.maximumAttempts >
      LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumDispatchedAttempts ||
    ledger.maximumTokens >
      LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumTokens ||
    (legacy && (ledger.maximumAttempts !== LEGACY_MAXIMUM_ATTEMPTS ||
      ledger.maximumTokens !== LEGACY_MAXIMUM_TOKENS)) ||
    !safeInteger(ledger.importedBase?.attempts) ||
    ledger.importedBase.attempts > profile.maximumAttempts ||
    !safeInteger(ledger.importedBase?.tokens) ||
    ledger.importedBase.tokens > profile.maximumTokens ||
    typeof ledger.importedBase.source !== "string" ||
    ledger.importedBase.source.length < 1 ||
    ledger.importedBase.source.length > 200 ||
    !canonicalIso(ledger.importedBase.importedAt) ||
    !Array.isArray(ledger.events) || ledger.events.length > 4_096 ||
    (!legacy && (!ledger.initialPolicy || !Array.isArray(ledger.policyHistory)))
  ) throw new Error("Screen 5 provider ledger is invalid.");
  if (!legacy) {
    const initial = ledger.initialPolicy!;
    const acceptedInitialPolicy = initial.source === "legacy_v1"
      ? initial.maximumAttempts === LEGACY_MAXIMUM_ATTEMPTS &&
        initial.maximumTokens === LEGACY_MAXIMUM_TOKENS
      : initial.source === "new_default" && (
        (initial.maximumAttempts === OPENAI_LEDGER_PROFILE.maximumAttempts &&
          initial.maximumTokens === OPENAI_LEDGER_PROFILE.maximumTokens) ||
        (initial.maximumAttempts === PREVIOUS_DEFAULT_MAXIMUM_ATTEMPTS &&
          initial.maximumTokens === PREVIOUS_DEFAULT_MAXIMUM_TOKENS)
      );
    if (!acceptedInitialPolicy ||
      ledger.policyHistory!.length > 256) {
      throw new Error("Screen 5 provider policy history is invalid.");
    }
    let previousAttempts = initial.maximumAttempts;
    let previousTokens = initial.maximumTokens;
    const renewalIds = new Set<string>();
    for (const event of ledger.policyHistory!) {
      if (event.kind !== "policy_updated" ||
        event.policyVersion !== SCREEN5_OPENAI_LEDGER_VERSION ||
        event.previousAttempts !== previousAttempts ||
        event.previousTokens !== previousTokens ||
        !safeInteger(event.maximumAttempts, 1) ||
        !safeInteger(event.maximumTokens, 1) ||
        event.maximumAttempts >
          LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING
            .maximumDispatchedAttempts ||
        event.maximumTokens >
          LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumTokens ||
        !/^[a-z][a-z0-9_]{0,79}$/u.test(event.reasonCode) ||
        !canonicalIso(event.recordedAt)) {
        throw new Error("Screen 5 provider policy history is invalid.");
      }
      if (event.renewal !== undefined) {
        const renewal = event.renewal;
        if (!renewal || !/^fnv1a64:[0-9a-f]{16}$/u.test(renewal.id) ||
          !["standard", "extended"].includes(renewal.window) ||
          renewalIds.has(renewal.id)) {
          throw new Error("Screen 5 provider renewal history is invalid.");
        }
        renewalIds.add(renewal.id);
      }
      previousAttempts = event.maximumAttempts;
      previousTokens = event.maximumTokens;
    }
    if (previousAttempts !== ledger.maximumAttempts ||
      previousTokens !== ledger.maximumTokens) {
      throw new Error("Screen 5 provider policy history is invalid.");
    }
  }
  const reservations = new Set<string>();
  const settlements = new Set<string>();
  const releases = new Set<string>();
  const dispatches = new Set<string>();
  const receipts = new Set<string>();
  for (const event of ledger.events) {
    if (!canonicalIso(event.recordedAt)) {
      throw new Error("Screen 5 provider ledger timestamp is invalid.");
    }
    if (event.kind === "reserved") {
      if (
        !/^[A-Za-z0-9._:-]{1,200}$/u.test(event.reservationId) ||
        !/^[A-Za-z0-9._:-]{1,200}$/u.test(event.jobId) ||
        !["planning", "assessment", "screen2_policy_interpretation",
          "screen3_contextualization",
          "screen4_query_plan", "screen4_event_interpretation",
          "screen6_contextualization"].includes(event.stage) ||
        !safeInteger(event.reservedTokens, 1) ||
        reservations.has(event.reservationId)
      ) throw new Error("Screen 5 provider reservation is invalid.");
      reservations.add(event.reservationId);
    } else if (event.kind === "dispatched") {
      if (!reservations.has(event.reservationId) ||
        dispatches.has(event.reservationId) ||
        releases.has(event.reservationId)) {
        throw new Error("Screen 5 provider dispatch is invalid.");
      }
      dispatches.add(event.reservationId);
    } else if (event.kind === "receipt_saved") {
      if (!reservations.has(event.reservationId) ||
        receipts.has(event.reservationId) || releases.has(event.reservationId) ||
        !/^fnv1a64:[0-9a-f]{16}$/u.test(event.contentFingerprint)) {
        throw new Error("Screen 5 provider receipt record is invalid.");
      }
      receipts.add(event.reservationId);
    } else if (event.kind === "settled") {
      if (
        !reservations.has(event.reservationId) ||
        settlements.has(event.reservationId) ||
        releases.has(event.reservationId) ||
        !safeInteger(event.actualTokens) ||
        !/^fnv1a64:[0-9a-f]{16}$/u.test(event.usageFingerprint)
      ) throw new Error("Screen 5 provider settlement is invalid.");
      settlements.add(event.reservationId);
      const reservation = ledger.events.find((candidate) =>
        candidate.kind === "reserved" &&
        candidate.reservationId === event.reservationId
      );
      if (!reservation || reservation.kind !== "reserved") {
        throw new Error("Screen 5 provider settlement has no reservation.");
      }
    } else if (
      event.kind !== "released" ||
      !reservations.has(event.reservationId) ||
      dispatches.has(event.reservationId) ||
      settlements.has(event.reservationId) ||
      releases.has(event.reservationId) ||
      !/^[a-z][a-z0-9_]{0,79}$/u.test(event.reasonCode)
    ) {
      throw new Error("Screen 5 provider release is invalid.");
    } else {
      releases.add(event.reservationId);
    }
  }
  const summary = summarizeLedger(ledger);
  // The provider's observed usage remains authoritative even if it exceeds
  // the local estimate or an allowance. Remaining tokens then clamp to zero;
  // no further reservation is admitted until an explicit policy update.
  if (summary.attemptsReserved > profile.maximumAttempts) {
    throw new Error("Screen 5 provider ledger exceeds its attempt cap.");
  }
  return ledger;
}

function summarizeLedger(
  ledger: Screen5OpenAILedger,
): Screen5MechanismBudgetSnapshot {
  const profile = { ...OPENAI_LEDGER_PROFILE,
    maximumAttempts: ledger.maximumAttempts,
    maximumTokens: ledger.maximumTokens,
  };
  const reservations = ledger.events.filter((event) =>
    event.kind === "reserved"
  );
  const settlements = new Map(
    ledger.events.filter((event) => event.kind === "settled")
      .map((event) => [event.reservationId, event]),
  );
  const releases = new Set(
    ledger.events.filter((event) => event.kind === "released")
      .map((event) => event.reservationId),
  );
  let observedTokens = ledger.importedBase.tokens;
  let heldTokens = 0;
  for (const reservation of reservations) {
    if (reservation.kind !== "reserved") continue;
    const settlement = settlements.get(reservation.reservationId);
    if (settlement?.kind === "settled") {
      observedTokens += settlement.actualTokens;
    } else if (!releases.has(reservation.reservationId)) {
      heldTokens += reservation.reservedTokens;
    }
  }
  const attemptsReserved = ledger.importedBase.attempts +
    reservations.length - releases.size;
  const attemptsSettled = ledger.importedBase.attempts + settlements.size;
  const tokensCommitted = observedTokens + heldTokens;
  const lastRenewal = ledger.policyHistory?.findLast((event) => event.renewal)?.renewal;
  return {
    pilotId: profile.pilotId as Screen5MechanismBudgetSnapshot["pilotId"],
    ...(lastRenewal
      ? { lastRenewalId: lastRenewal.id, lastRenewalWindow: lastRenewal.window }
      : {}),
    maximumAttempts: profile.maximumAttempts,
    maximumTokens: profile.maximumTokens,
    attemptsReserved,
    attemptsSettled,
    attemptsHeld: attemptsReserved - attemptsSettled,
    tokensConsumed: observedTokens,
    tokensHeld: heldTokens,
    tokensCommitted,
    remainingAttempts: Math.max(
      0,
      profile.maximumAttempts - attemptsReserved,
    ),
    remainingTokens: Math.max(
      0,
      profile.maximumTokens - tokensCommitted,
    ),
  };
}

/**
 * Upgrade the two superseded built-in allowance policies to the current
 * shared default without requiring an extra UI action. Recorded usage,
 * reservations, receipts, and unknown holds remain exactly as saved. Any
 * explicit owner-authored policy change is preserved.
 */
function applyCurrentDefaultPolicyUpgrade(
  ledger: Screen5OpenAILedger,
  recordedAt: string,
) {
  const automaticHistory = ledger.policyHistory?.every(({ reasonCode }) =>
    reasonCode === "legacy_preview_policy_migrated" ||
    reasonCode === "expanded_preview_policy_migrated" ||
    reasonCode === "owner_approved_v23_local_evaluation" ||
    reasonCode === "owner_approved_fresh_local_window") ?? false;
  if (
    ledger.schemaVersion !== SCREEN5_OPENAI_LEDGER_VERSION ||
    !automaticHistory ||
    (ledger.maximumAttempts >= OPENAI_LEDGER_PROFILE.maximumAttempts &&
      ledger.maximumTokens >= OPENAI_LEDGER_PROFILE.maximumTokens)
  ) return false;
  const maximumAttempts = Math.max(
    ledger.maximumAttempts,
    OPENAI_LEDGER_PROFILE.maximumAttempts,
  );
  const maximumTokens = Math.max(
    ledger.maximumTokens,
    OPENAI_LEDGER_PROFILE.maximumTokens,
  );
  ledger.policyHistory!.push({
    kind: "policy_updated",
    policyVersion: SCREEN5_OPENAI_LEDGER_VERSION,
    previousAttempts: ledger.maximumAttempts,
    previousTokens: ledger.maximumTokens,
    maximumAttempts,
    maximumTokens,
    reasonCode: "expanded_preview_policy_migrated",
    recordedAt,
  });
  ledger.maximumAttempts = maximumAttempts;
  ledger.maximumTokens = maximumTokens;
  return true;
}

export class Screen5OpenAILedgerStore {
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly storage: Screen5OpenAILedgerStorage) {}

  /** Default for every configured application task. Migration records usage
   * and unresolved holds without an activation control or a provider request. */
  async initializeRuntimeUsage(input: {
    attempts: number; tokens: number; source: string; now: string;
  }) {
    await this.initialize(input);
    return this.transaction(async (transaction) => {
      let account = await readModelUsageAccount(transaction);
      if (!account) {
        const ledger = validateLedger(await transaction.get(OPENAI_LEDGER_PROFILE.storageKey));
        account = await migrateModelUsageAccount(transaction, ledger,
          OPENAI_LEDGER_PROFILE.storageKey, summarizeLedger(ledger));
      }
      return useUnlimitedRuntimeUsage(transaction, account);
    });
  }

  /** Backward-compatible helper for local launch scripts and saved tests. */
  async initializeLocalUsage(input: {
    attempts: number; tokens: number; source: string; now: string;
  }) {
    return this.initializeRuntimeUsage(input);
  }

  private async transaction<T>(
    callback: (transaction: LedgerTransaction) => Promise<T>,
  ) {
    const previous = this.transactionTail;
    let release: () => void = () => undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.storage.transaction(callback);
    } finally {
      release();
    }
  }

  async initialize(input: {
    attempts: number;
    tokens: number;
    source: string;
    now: string;
  }) {
    if (
      !safeInteger(input.attempts) ||
      input.attempts > OPENAI_LEDGER_PROFILE.maximumAttempts ||
      !safeInteger(input.tokens) || input.tokens > OPENAI_LEDGER_PROFILE.maximumTokens ||
      !canonicalIso(input.now) || !input.source || input.source.length > 200
    ) throw new Error("Screen 5 provider imported pilot usage is invalid.");
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) {
        if (input.attempts !== 0 || input.tokens !== 0) {
          throw new Error("Imported model usage is sealed after persistent-account migration.");
        }
        return modelUsageSummary(account);
      }
      const existing = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (existing !== undefined) {
        const ledger = validateLedger(existing);
        const noNewImport = input.attempts === 0 && input.tokens === 0;
        if (!noNewImport && (
          input.attempts < ledger.importedBase.attempts ||
          input.tokens < ledger.importedBase.tokens
        )) {
          throw new Error(
            "Screen 5 provider imported usage cannot lower the persistent pilot base.",
          );
        }
        if (!noNewImport && (
          input.attempts !== ledger.importedBase.attempts ||
          input.tokens !== ledger.importedBase.tokens
        )) {
          throw new Error(
            "Screen 5 provider imported usage cannot change after local reservations exist.",
          );
        }
        let changed = false;
        if (ledger.schemaVersion === PREVIOUS_SCREEN5_OPENAI_LEDGER_VERSION) {
          // Preserve every reservation and hold while recording the original
          // policy as the immutable base of the versioned migration history.
          ledger.schemaVersion = SCREEN5_OPENAI_LEDGER_VERSION;
          ledger.initialPolicy = {
            source: "legacy_v1", maximumAttempts: LEGACY_MAXIMUM_ATTEMPTS,
            maximumTokens: LEGACY_MAXIMUM_TOKENS,
          };
          ledger.policyHistory = [];
          changed = true;
        }
        changed = applyCurrentDefaultPolicyUpgrade(
          ledger,
          input.now,
        ) || changed;
        if (changed) {
          validateLedger(ledger);
          await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
        }
        return summarizeLedger(ledger);
      }
      const ledger: Screen5OpenAILedger = {
        schemaVersion: OPENAI_LEDGER_PROFILE.schemaVersion,
        pilotId: OPENAI_LEDGER_PROFILE.pilotId,
        maximumAttempts: OPENAI_LEDGER_PROFILE.maximumAttempts,
        maximumTokens: OPENAI_LEDGER_PROFILE.maximumTokens,
        importedBase: {
          attempts: input.attempts,
          tokens: input.tokens,
          source: input.source,
          importedAt: input.now,
        },
        events: [],
        initialPolicy: {
          source: "new_default",
          maximumAttempts: OPENAI_LEDGER_PROFILE.maximumAttempts,
          maximumTokens: OPENAI_LEDGER_PROFILE.maximumTokens,
        },
        policyHistory: [],
      };
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  /** Explicit owner acknowledgement is required before changing a saved cap. */
  async updatePolicy(input: {
    acknowledgedByOwner: true;
    maximumAttempts: number;
    maximumTokens: number;
    reasonCode: string;
    now: string;
  }) {
    if (input.acknowledgedByOwner !== true ||
      !safeInteger(input.maximumAttempts, 1) ||
      !safeInteger(input.maximumTokens, 1) ||
      input.maximumAttempts >
        LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING
          .maximumDispatchedAttempts ||
      input.maximumTokens >
        LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumTokens ||
      !/^[a-z][a-z0-9_]{0,79}$/u.test(input.reasonCode) ||
      !canonicalIso(input.now)) {
      throw new Error("Screen 5 provider policy update requires explicit owner acknowledgement.");
    }
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return updateModelUsagePolicy(transaction, account, input);
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      const ledger = validateLedger(value);
      if (ledger.schemaVersion === PREVIOUS_SCREEN5_OPENAI_LEDGER_VERSION) {
        ledger.schemaVersion = SCREEN5_OPENAI_LEDGER_VERSION;
        ledger.initialPolicy = { source: "legacy_v1",
          maximumAttempts: LEGACY_MAXIMUM_ATTEMPTS,
          maximumTokens: LEGACY_MAXIMUM_TOKENS };
        ledger.policyHistory = [];
      }
      const current = summarizeLedger(ledger);
      if (input.maximumAttempts < current.attemptsReserved ||
        input.maximumTokens < current.tokensCommitted) {
        throw new Error("Screen 5 provider policy cannot erase consumed use or unknown holds.");
      }
      if (ledger.maximumAttempts === input.maximumAttempts &&
          ledger.maximumTokens === input.maximumTokens) {
        return current;
      }
      ledger.policyHistory!.push({
        kind: "policy_updated",
        policyVersion: SCREEN5_OPENAI_LEDGER_VERSION,
        previousAttempts: ledger.maximumAttempts,
        previousTokens: ledger.maximumTokens,
        maximumAttempts: input.maximumAttempts,
        maximumTokens: input.maximumTokens,
        reasonCode: input.reasonCode,
        recordedAt: input.now,
      });
      ledger.maximumAttempts = input.maximumAttempts;
      ledger.maximumTokens = input.maximumTokens;
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  /** Atomic and replay-safe, including a lost workflow acknowledgement. */
  async renewAllowance(input: {
    acknowledgedByOwner: true;
    renewalId: string;
    window: LocalModelAllowanceWindow;
    now: string;
  }) {
    if (input.acknowledgedByOwner !== true ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(input.renewalId) ||
      !["standard", "extended", "reviewer"].includes(input.window) ||
      !canonicalIso(input.now)) {
      throw new Error("Local allowance renewal requires an explicit owner action and a supported window.");
    }
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return renewModelUsageAccount(transaction, account, input);
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      const ledger = validateLedger(value);
      if (input.window === "reviewer") {
        const migrated = await migrateModelUsageAccount(transaction, ledger,
          OPENAI_LEDGER_PROFILE.storageKey, summarizeLedger(ledger));
        return renewModelUsageAccount(transaction, migrated, input);
      }
      const prior = ledger.policyHistory?.find((event) =>
        event.renewal?.id === input.renewalId);
      if (prior) {
        if (prior.renewal!.window !== input.window) {
          throw new Error("The saved allowance renewal belongs to a different window.");
        }
        return summarizeLedger(ledger);
      }
      if (ledger.schemaVersion === PREVIOUS_SCREEN5_OPENAI_LEDGER_VERSION) {
        ledger.schemaVersion = SCREEN5_OPENAI_LEDGER_VERSION;
        ledger.initialPolicy = { source: "legacy_v1",
          maximumAttempts: LEGACY_MAXIMUM_ATTEMPTS,
          maximumTokens: LEGACY_MAXIMUM_TOKENS };
        ledger.policyHistory = [];
      }
      const current = summarizeLedger(ledger);
      const window = LOCAL_MODEL_ALLOWANCE_WINDOWS[input.window];
      const maximumAttempts = Math.max(ledger.maximumAttempts,
        current.attemptsReserved + window.maximumDispatchedAttempts);
      const maximumTokens = Math.max(ledger.maximumTokens,
        current.tokensCommitted + window.maximumTokens);
      if (maximumAttempts > LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumDispatchedAttempts ||
        maximumTokens > LOCAL_MODEL_ALLOWANCE_CUMULATIVE_CEILING.maximumTokens) {
        throw new Error("The cumulative model usage safety ceiling has been reached.");
      }
      ledger.policyHistory!.push({
        kind: "policy_updated",
        policyVersion: SCREEN5_OPENAI_LEDGER_VERSION,
        previousAttempts: ledger.maximumAttempts,
        previousTokens: ledger.maximumTokens,
        maximumAttempts,
        maximumTokens,
        reasonCode: "owner_approved_fresh_local_window",
        recordedAt: input.now,
        renewal: { id: input.renewalId, window: input.window },
      });
      ledger.maximumAttempts = maximumAttempts;
      ledger.maximumTokens = maximumTokens;
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  async summary() {
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return modelUsageSummary(account);
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      return summarizeLedger(validateLedger(value));
    });
  }

  /** Read-only reservation evidence for a durable pre-dispatch claim recovery. */
  async reservationStatus(reservationId: string): Promise<
    "absent" | "reserved_not_dispatched" | "dispatched" |
    "receipt_saved" | "settled" | "released"
  > {
    if (!/^[A-Za-z0-9._:-]{1,200}$/u.test(reservationId)) {
      throw new Error("Screen 5 provider reservation id is invalid.");
    }
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return modelReservationStatus(transaction, account, reservationId);
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) return "absent";
      const ledger = validateLedger(value);
      const events = ledger.events.filter((event) =>
        event.reservationId === reservationId);
      if (!events.some((event) => event.kind === "reserved")) return "absent";
      if (events.some((event) => event.kind === "released")) return "released";
      if (events.some((event) => event.kind === "settled")) return "settled";
      if (events.some((event) => event.kind === "receipt_saved")) {
        return "receipt_saved";
      }
      if (events.some((event) => event.kind === "dispatched")) {
        return "dispatched";
      }
      return "reserved_not_dispatched";
    });
  }

  async reserve(input: {
    reservationId: string;
    jobId: string;
    stage: "planning" | "assessment" | "screen3_contextualization" |
      "screen2_policy_interpretation" |
      "screen4_query_plan" | "screen4_event_interpretation" |
      "screen6_contextualization";
    reservedTokens: number;
    now: string;
  }) {
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return reserveModelUsage(transaction, account, input);
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      const ledger = validateLedger(value);
      const existing = ledger.events.find((event) =>
        event.kind === "reserved" &&
        event.reservationId === input.reservationId
      );
      if (existing) {
        if (
          existing.kind !== "reserved" || existing.jobId !== input.jobId ||
          existing.stage !== input.stage ||
          existing.reservedTokens !== input.reservedTokens
        ) throw new Error("Screen 5 provider reservation id was reused.");
        return summarizeLedger(ledger);
      }
      if (
        !/^[A-Za-z0-9._:-]{1,200}$/u.test(input.reservationId) ||
        !/^[A-Za-z0-9._:-]{1,200}$/u.test(input.jobId) ||
        !safeInteger(input.reservedTokens, 1) || !canonicalIso(input.now)
      ) throw new Error("Screen 5 provider reservation is invalid.");
      const before = summarizeLedger(ledger);
      if (
        before.remainingAttempts < 1 ||
        before.remainingTokens < input.reservedTokens
      ) throw new Error("Screen 5 provider global pilot allowance is exhausted.");
      ledger.events.push({
        kind: "reserved",
        reservationId: input.reservationId,
        jobId: input.jobId,
        stage: input.stage,
        reservedTokens: input.reservedTokens,
        recordedAt: input.now,
      });
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  async recordDispatch(input: { reservationId: string; now: string }) {
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return recordModelUsage(transaction, account, {
        kind: "dispatched", reservationId: input.reservationId, recordedAt: input.now,
      });
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) throw new Error("Screen 5 provider ledger is not initialized.");
      const ledger = validateLedger(value);
      const existing = ledger.events.find((event) => event.kind === "dispatched" &&
        event.reservationId === input.reservationId);
      if (existing) return summarizeLedger(ledger);
      if (!canonicalIso(input.now)) throw new Error("Screen 5 provider dispatch timestamp is invalid.");
      ledger.events.push({ kind: "dispatched", reservationId: input.reservationId,
        recordedAt: input.now });
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  async recordReceipt(input: { reservationId: string;
    contentFingerprint: string; now: string }) {
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return recordModelUsage(transaction, account, {
        kind: "receipt_saved", reservationId: input.reservationId,
        contentFingerprint: input.contentFingerprint, recordedAt: input.now,
      });
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) throw new Error("Screen 5 provider ledger is not initialized.");
      const ledger = validateLedger(value);
      const existing = ledger.events.find((event) => event.kind === "receipt_saved" &&
        event.reservationId === input.reservationId);
      if (existing) {
        if (existing.kind !== "receipt_saved" ||
          existing.contentFingerprint !== input.contentFingerprint) {
          throw new Error("Screen 5 provider receipt changed after persistence.");
        }
        return summarizeLedger(ledger);
      }
      if (!canonicalIso(input.now)) throw new Error("Screen 5 provider receipt timestamp is invalid.");
      ledger.events.push({ kind: "receipt_saved",
        reservationId: input.reservationId,
        contentFingerprint: input.contentFingerprint, recordedAt: input.now });
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  async settle(input: {
    reservationId: string;
    usage: Screen5MechanismUsage;
    now: string;
  }) {
    if (!safeInteger(input.usage.promptTokens) ||
      !safeInteger(input.usage.completionTokens) ||
      !safeInteger(input.usage.totalTokens) ||
      input.usage.totalTokens !== input.usage.promptTokens +
        input.usage.completionTokens ||
      (input.usage.reasoningTokens !== null &&
        (!safeInteger(input.usage.reasoningTokens) ||
          input.usage.reasoningTokens > input.usage.completionTokens)) ||
      (input.usage.cachedPromptTokens !== null &&
        (!safeInteger(input.usage.cachedPromptTokens) ||
          input.usage.cachedPromptTokens > input.usage.promptTokens))) {
      throw new Error("Screen 5 provider usage cannot be settled.");
    }
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return recordModelUsage(transaction, account, settlementEvent(input));
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      const ledger = validateLedger(value);
      const usageFingerprint = fingerprintSixScreenValue(input.usage);
      const existing = ledger.events.find((event) =>
        event.kind === "settled" &&
        event.reservationId === input.reservationId
      );
      if (existing) {
        if (
          existing.kind !== "settled" ||
          existing.actualTokens !== input.usage.totalTokens ||
          existing.usageFingerprint !== usageFingerprint
        ) throw new Error("Screen 5 provider settlement changed after persistence.");
        return summarizeLedger(ledger);
      }
      if (!canonicalIso(input.now)) {
        throw new Error("Screen 5 provider settlement timestamp is invalid.");
      }
      ledger.events.push({
        kind: "settled",
        reservationId: input.reservationId,
        actualTokens: input.usage.totalTokens,
        usageFingerprint,
        recordedAt: input.now,
      });
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }

  async release(input: {
    reservationId: string;
    reasonCode: string;
    now: string;
  }) {
    return this.transaction(async (transaction) => {
      const account = await readModelUsageAccount(transaction);
      if (account) return recordModelUsage(transaction, account, {
        kind: "released", reservationId: input.reservationId,
        reasonCode: input.reasonCode, recordedAt: input.now,
      });
      const value = await transaction.get(OPENAI_LEDGER_PROFILE.storageKey);
      if (value === undefined) {
        throw new Error("Screen 5 provider ledger is not initialized.");
      }
      const ledger = validateLedger(value);
      const reservation = ledger.events.find((event) =>
        event.kind === "reserved" &&
        event.reservationId === input.reservationId
      );
      if (!reservation || reservation.kind !== "reserved") {
        throw new Error("Screen 5 provider release has no reservation.");
      }
      const settlement = ledger.events.find((event) =>
        event.kind === "settled" &&
        event.reservationId === input.reservationId
      );
      if (settlement) {
        throw new Error("A settled Screen 5 provider reservation cannot be released.");
      }
      const existing = ledger.events.find((event) =>
        event.kind === "released" &&
        event.reservationId === input.reservationId
      );
      if (existing) {
        if (
          existing.kind !== "released" ||
          existing.reasonCode !== input.reasonCode
        ) throw new Error("Screen 5 provider release changed after persistence.");
        return summarizeLedger(ledger);
      }
      if (ledger.events.some((event) => event.kind === "dispatched" &&
        event.reservationId === input.reservationId)) {
        throw new Error("A dispatched Screen 5 provider reservation cannot be released.");
      }
      if (
        !/^[a-z][a-z0-9_]{0,79}$/u.test(input.reasonCode) ||
        !canonicalIso(input.now)
      ) throw new Error("Screen 5 provider release is invalid.");
      ledger.events.push({
        kind: "released",
        reservationId: input.reservationId,
        reasonCode: input.reasonCode,
        recordedAt: input.now,
      });
      validateLedger(ledger);
      await transaction.put(OPENAI_LEDGER_PROFILE.storageKey, ledger);
      return summarizeLedger(ledger);
    });
  }
}
