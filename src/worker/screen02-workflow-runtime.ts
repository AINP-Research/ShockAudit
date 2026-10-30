import {
  SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
  decodeScreen02WorkflowClientEnvelope,
  type Screen02WorkflowClientSnapshot,
  type Screen02WorkflowReceiptNotice,
  type Screen02WorkflowSummary,
} from "../core/screen02-workflow-client";
import {
  buildScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../core/screen02-workflow-handoff";
import {
  encodeScreen02AuditWorkflowStateEnvelope,
} from "../core/screen02-audit-workflow-envelope";
import {
  encodeScreen02FindWorkflowStateEnvelope,
} from "../core/screen02-workflow-envelope";
import {
  createScreen02AuditState,
  fingerprintScreen02WorkflowState,
  requireScreen02WorkflowState,
} from "../core/screen02-workflow-state";
import {
  fingerprintScreen01StudyContext,
  serializeDeterministicJson,
} from "../core/screen02-service";
import { applyScreen02AuditMatchRound } from "../core/screen02-audit-workflow";
import type { Screen02WorkflowState } from "../core/screen02-workflow-types";
import type { Screen01StudyContext } from "../core/scope-types";
import { SHOCKAUDIT_VERSION } from "../version";
import {
  createSignedScreen02AuditNormalizedReceipt,
  verifySignedScreen02AuditNormalizedReceipt,
  type Screen02AuditDraftSubmission,
  type Screen02AuditSignedReceipt,
} from "./screen02-audit-assessment-security";
import {
  assertScreen02FindSigningConfig,
  createSignedScreen02FindNormalizedReceipt,
  verifySignedScreen02FindNormalizedReceipt,
  type Screen02FindDraftSubmission,
  type Screen02FindSignedReceipt,
} from "./screen02-find-assessment-security";
import {
  applyCanonicalScreen02AuditReceipt,
  applyCanonicalScreen02FindReceipt,
  applyScreen02WorkflowAction,
  buildScreen02WorkflowClientSnapshot,
  buildScreen02WorkflowSummary,
  createInitialScreen02WorkflowState,
  completeScreen02FindDiscoveryAfterPlanning,
  type Screen02CanonicalReceiptResult,
  type Screen02WorkflowAction,
  type Screen02WorkflowControllerOptions,
  type Screen02WorkflowSigningConfig,
} from "./screen02-workflow-controller";
import {
  createScreen02WorkflowStoreIdentity,
  type Screen02WorkflowOpenOperationBinding,
  type Screen02WorkflowBufferedReceipt,
  type Screen02WorkflowStore,
  type Screen02WorkflowStoreCoordinates,
  type Screen02WorkflowStoreRecord,
} from "./screen02-workflow-store";

export type Screen02WorkflowSigningKeyring = {
  current: Screen02WorkflowSigningConfig | null;
  previous?: Screen02WorkflowSigningConfig | null;
};

export type Screen02WorkflowMutationCoordinator = {
  inFlightMutations: Map<string, Promise<Screen02WorkflowRuntimeResult>>;
  mutationTails: Map<string, Promise<void>>;
};

export type Screen02WorkflowRuntimeOptions = {
  store: Screen02WorkflowStore;
  now: () => string;
  createId: (kind: string) => string;
  signing: Screen02WorkflowSigningKeyring;
  /** Omission preserves the historical signed model-assessment workflow. */
  legacyHostAssessments?: boolean;
  /** Local deterministic fixtures may shorten the canonical timeout gate. */
  hostAssessmentDeadlineMs?: number;
  mutationCoordinator?: Screen02WorkflowMutationCoordinator;
  discoverFind?: Screen02WorkflowControllerOptions["discoverFind"];
  continueFind?: Screen02WorkflowControllerOptions["continueFind"];
  discoverAudit?: Screen02WorkflowControllerOptions["discoverAudit"];
  /** Optional sibling cleanup; Screen 2 behavior is unchanged when absent. */
  retireScreen03?: (runId: string) => Promise<void>;
};

export type Screen02WorkflowRuntimeResult = {
  summary: Screen02WorkflowSummary;
  snapshot: Screen02WorkflowClientSnapshot;
};

export type Screen02WorkflowInitialState = "standard" | "blank";

function requireInitialState(
  value: unknown,
): Screen02WorkflowInitialState {
  if (value !== "standard" && value !== "blank") {
    throw new Error(
      "Screen 2 workflow opening requires a recognized initialization profile.",
    );
  }
  return value;
}

export type Screen02WorkflowRetireInput = {
  runId: string;
  accessToken: string;
  expectedRevision: number;
  expectedStateFingerprint: string;
};

export type Screen02WorkflowRetireResult = {
  outcome: "retired" | "already-absent" | "conflict";
  runId: string;
  message: string;
};

export type Screen02DownstreamReadInput = {
  runId: string;
  accessToken: string;
  expectedRevision: number;
  expectedStateFingerprint: string;
  /**
   * Compatibility coordinate only. The server still derives every event field
   * from canonical state, then proves that this version reproduces the
   * client's stable v4 handoff fingerprint.
   */
  expectedHandoffProducerAppVersion?: string;
  expectedHandoffFingerprint?: string;
};

export type Screen02DownstreamReadResult = {
  state: Screen02WorkflowState;
  handoff: Screen02WorkflowHandoff;
  generation: number;
  stateFingerprint: string;
  expiresAt: string;
};

export type Screen02BriefingContinuationInput = {
  runId: string;
  accessToken: string;
  expectedGeneration: number;
  expectedRevision: number;
  expectedStateFingerprint: string;
  expectedExpiresAt: string;
  expectedHandoffProducerAppVersion?: string;
  expectedHandoffFingerprint?: string;
};

export type Screen02BriefingTrustedReadInput = Omit<
  Screen02BriefingContinuationInput,
  "accessToken"
>;

export type Screen02BriefingContinuationResult =
  Screen02DownstreamReadResult & {
    snapshot: Screen02WorkflowClientSnapshot;
  };

const SCREEN_02_WORKFLOW_OPEN_OPERATION_MAX_CHARACTERS = 200;
const SCREEN_02_WORKFLOW_OPEN_IDENTITY_SCHEMA_VERSION =
  "screen-02-workflow-open-identity-v1" as const;

type Screen02WorkflowStoreIdentity = ReturnType<
  typeof createScreen02WorkflowStoreIdentity
>;

function requireOpenOperationId(value: unknown) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > SCREEN_02_WORKFLOW_OPEN_OPERATION_MAX_CHARACTERS
  ) {
    throw new Error(
      "Screen 2 open operationId must be a bounded canonical identifier.",
    );
  }
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function mutationCoalescingKey(action: Screen02WorkflowAction) {
  const canonicalRequest = serializeDeterministicJson(action);
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalRequest),
    ),
  );
  return `sha256:${bytesToBase64Url(digest)}`;
}

async function deriveOpenIdentity(
  config: Screen02WorkflowSigningConfig,
  operationId: string,
  identityNonce: string,
): Promise<Screen02WorkflowStoreIdentity> {
  assertScreen02FindSigningConfig(config);
  const keyBytes =
    typeof config.key === "string"
      ? new TextEncoder().encode(config.key)
      : config.key.slice();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const derive = async (purpose: "run" | "access") => {
    const payload = serializeDeterministicJson({
      schemaVersion: SCREEN_02_WORKFLOW_OPEN_IDENTITY_SCHEMA_VERSION,
      purpose,
      operationId,
      identityNonce,
    });
    return bytesToBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(payload),
        ),
      ),
    );
  };
  return {
    runId: `s2r_${await derive("run")}`,
    accessToken: `s2a_${await derive("access")}`,
  };
}

function createOpenIdentityNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function stateEnvelope(state: Screen02WorkflowState) {
  return state.mode === "find"
    ? encodeScreen02FindWorkflowStateEnvelope(state)
    : encodeScreen02AuditWorkflowStateEnvelope(state);
}

function stateFromRecord(record: Screen02WorkflowStoreRecord) {
  const decoded = decodeScreen02WorkflowClientEnvelope(record.stateEnvelope);
  if (!decoded.ok) {
    throw new Error(`Canonical Screen 2 store state is unreadable: ${decoded.message}`);
  }
  const state = requireScreen02WorkflowState(decoded.state);
  if (
    state.runId !== record.runId ||
    state.mode !== record.mode ||
    state.revision !== record.stateRevision ||
    fingerprintScreen02WorkflowState(state) !== record.stateFingerprint
  ) {
    throw new Error("Canonical Screen 2 store metadata does not match its state.");
  }
  return state;
}

function coordinates(record: Screen02WorkflowStoreRecord) {
  return {
    generation: record.generation,
    revision: record.stateRevision,
    stateFingerprint: record.stateFingerprint,
  } satisfies Screen02WorkflowStoreCoordinates;
}

function controllerOptions(
  options: Screen02WorkflowRuntimeOptions,
): Screen02WorkflowControllerOptions {
  return {
    now: options.now,
    createId: options.createId,
    signingConfig: options.signing.current,
    ...(options.legacyHostAssessments !== undefined
      ? { legacyHostAssessments: options.legacyHostAssessments }
      : {}),
    ...(options.hostAssessmentDeadlineMs !== undefined
      ? { hostAssessmentDeadlineMs: options.hostAssessmentDeadlineMs }
      : {}),
    ...(options.discoverFind ? { discoverFind: options.discoverFind } : {}),
    ...(options.continueFind ? { continueFind: options.continueFind } : {}),
    ...(options.discoverAudit ? { discoverAudit: options.discoverAudit } : {}),
  };
}

function activeReceiptBuffer(
  receipts: Screen02WorkflowBufferedReceipt[],
  state: Screen02WorkflowState,
) {
  const active = new Set(
    state.assessmentRequests
      .filter((request) =>
        ["prepared", "message-delivered"].includes(request.status),
      )
      .map((request) => request.requestId),
  );
  return receipts.filter((receipt) => active.has(receipt.requestId));
}

function receiptNotice(
  result: Screen02CanonicalReceiptResult,
): Screen02WorkflowReceiptNotice {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
    phase: "canonical-receipt-result",
    runId: result.state.runId,
    mode: result.state.mode,
    requestId: result.requestId,
    receiptId: result.receiptId,
    disposition: result.disposition,
    reason: result.reason,
  };
}

function runtimeMessage(
  outcome: Screen02WorkflowSummary["outcome"],
  requested: string,
) {
  if (outcome === "conflict") {
    return "Another accepted Screen 2 operation won this revision. The canonical winner was restored; review it before retrying.";
  }
  if (outcome === "replayed") {
    return `The prior result for this operation was replayed safely. ${requested}`;
  }
  return requested;
}

export class Screen02WorkflowRuntime {
  /**
   * Coalesce identical in-isolate retries before any external assessment
   * work starts. Durable replay/CAS remains the authoritative cross-isolate
   * guard; this map only avoids duplicate paid inference while one operation
   * is already running in this Durable Object instance.
   */
  private readonly mutationCoordinator: Screen02WorkflowMutationCoordinator;

  constructor(private readonly options: Screen02WorkflowRuntimeOptions) {
    this.mutationCoordinator = options.mutationCoordinator ?? {
      inFlightMutations: new Map(),
      mutationTails: new Map(),
    };
  }

  /**
   * Authenticate a downstream opener against the retained canonical Screen 2
   * run, then rederive the released v4 handoff server-side. No client-supplied
   * handoff is trusted and this read never mutates the stable Screen 2 state.
   */
  async readForScreen03(
    input: Screen02DownstreamReadInput,
  ): Promise<Screen02DownstreamReadResult> {
    const read = await this.options.store.read({
      runId: input.runId,
      accessToken: input.accessToken,
    });
    if (read.outcome === "not-found" || read.outcome === "unauthorized") {
      throw new Error(
        "This Screen 2 run is unavailable or expired. Return to the confirmed study and open Screen 2 again.",
      );
    }
    const state = stateFromRecord(read.record);
    if (
      state.revision !== input.expectedRevision ||
      read.record.stateFingerprint !== input.expectedStateFingerprint
    ) {
      throw new Error(
        "Screen 2 changed before Screen 3 opened. Review the current canonical event before continuing.",
      );
    }
    const continued =
      state.mode === "find"
        ? state.decision.continuedRevision !== null
        : state.continuationHistory.length > 0;
    if (!continued) {
      throw new Error(
        "Screen 3 cannot open until the chosen shock is locked on Screen 2.",
      );
    }
    const producerAppVersion =
      input.expectedHandoffProducerAppVersion ?? SHOCKAUDIT_VERSION;
    const handoff = buildScreen02WorkflowHandoff(
      state,
      producerAppVersion,
      state.updatedAt,
    );
    if (
      input.expectedHandoffFingerprint !== undefined &&
      handoff.integrity.handoffFingerprint !== input.expectedHandoffFingerprint
    ) {
      throw new Error(
        "The stable Screen 2 handoff no longer matches canonical state. Refresh Screen 2 before opening Screen 3.",
      );
    }
    return {
      state,
      handoff,
      generation: read.record.generation,
      stateFingerprint: read.record.stateFingerprint,
      expiresAt: read.record.expiresAt,
    };
  }

  /**
   * Server-internal, non-mutating parent read used only after the caller has
   * resolved a valid Screen 3 safe-reference index. Exact persisted parent
   * coordinates are mandatory, so the public safe reference never becomes a
   * general run lookup and this method cannot mint or persist credentials.
   */
  async readForScreen03BriefingTrusted(
    input: Screen02BriefingTrustedReadInput,
  ): Promise<Screen02DownstreamReadResult> {
    const read = await this.options.store.readTrusted({ runId: input.runId });
    if (read.outcome === "not-found") {
      throw new Error(
        "This Screen 2 run is unavailable or expired. Return to the confirmed study and open Screen 2 again.",
      );
    }
    if (
      read.record.generation !== input.expectedGeneration ||
      read.record.stateRevision !== input.expectedRevision ||
      read.record.stateFingerprint !== input.expectedStateFingerprint ||
      read.record.expiresAt !== input.expectedExpiresAt
    ) {
      throw new Error(
        "Screen 2 changed before the briefing packet was read. Ask for the current shock briefing again.",
      );
    }
    const state = stateFromRecord(read.record);
    const continued = state.mode === "find"
      ? state.decision.continuedRevision !== null
      : state.continuationHistory.length > 0;
    if (!continued) {
      throw new Error(
        "Screen 3 cannot continue until the chosen shock is locked on Screen 2.",
      );
    }
    const producerAppVersion =
      input.expectedHandoffProducerAppVersion ?? SHOCKAUDIT_VERSION;
    const handoff = buildScreen02WorkflowHandoff(
      state,
      producerAppVersion,
      state.updatedAt,
    );
    if (
      input.expectedHandoffFingerprint !== undefined &&
      handoff.integrity.handoffFingerprint !==
        input.expectedHandoffFingerprint
    ) {
      throw new Error(
        "The stable Screen 2 handoff no longer matches the briefing packet.",
      );
    }
    return {
      state,
      handoff,
      generation: read.record.generation,
      stateFingerprint: read.record.stateFingerprint,
      expiresAt: read.record.expiresAt,
    };
  }

  /**
   * After Screen 3 has verified a signed, current render packet, add one
   * bounded hash-only possession alias and build the complete private parent
   * snapshot for the newly rendered widget. The primary token remains valid,
   * no Screen 2 business state changes, and the raw continuation token is
   * never persisted.
   */
  async continueForScreen03Briefing(
    input: Screen02BriefingContinuationInput,
  ): Promise<Screen02BriefingContinuationResult> {
    if (!this.options.store.addContinuationAccessTokenTrusted) {
      throw new Error(
        "Screen 3 briefing continuation is unavailable on this runtime.",
      );
    }
    const added = await this.options.store.addContinuationAccessTokenTrusted({
      runId: input.runId,
      accessToken: input.accessToken,
      expected: {
        generation: input.expectedGeneration,
        revision: input.expectedRevision,
        stateFingerprint: input.expectedStateFingerprint,
      },
      expectedExpiresAt: input.expectedExpiresAt,
    });
    if (added.outcome === "not-found") {
      throw new Error(
        "This Screen 2 run is unavailable or expired. Return to the confirmed study and open Screen 2 again.",
      );
    }
    if (added.outcome === "conflict") {
      throw new Error(
        "Screen 2 changed before the briefing widget was rendered. Ask ChatGPT to prepare the current shock briefing again.",
      );
    }
    const state = stateFromRecord(added.record);
    const continued = state.mode === "find"
      ? state.decision.continuedRevision !== null
      : state.continuationHistory.length > 0;
    if (!continued) {
      throw new Error(
        "Screen 3 cannot continue until the chosen shock is locked on Screen 2.",
      );
    }
    const producerAppVersion =
      input.expectedHandoffProducerAppVersion ?? SHOCKAUDIT_VERSION;
    const handoff = buildScreen02WorkflowHandoff(
      state,
      producerAppVersion,
      state.updatedAt,
    );
    if (
      input.expectedHandoffFingerprint !== undefined &&
      handoff.integrity.handoffFingerprint !==
        input.expectedHandoffFingerprint
    ) {
      throw new Error(
        "The stable Screen 2 handoff no longer matches the briefing packet.",
      );
    }
    const currentSnapshot = await buildScreen02WorkflowClientSnapshot(
      state,
      input.accessToken,
      controllerOptions(this.options),
    );
    // The generic snapshot builder uses the running release. A Screen 3
    // continuation must instead preserve the producer version that is part of
    // the already-released handoff fingerprint, including a v0.3.13-origin
    // child continued by a v0.3.14 runtime.
    const snapshot: Screen02WorkflowClientSnapshot = {
      ...currentSnapshot,
      handoff,
    };
    return {
      state,
      handoff,
      snapshot,
      generation: added.record.generation,
      stateFingerprint: added.record.stateFingerprint,
      expiresAt: added.record.expiresAt,
    };
  }

  private async replayOpenOperation(
    binding: Screen02WorkflowOpenOperationBinding,
    operationId: string,
    baselineFingerprint: string,
    initialState: Screen02WorkflowInitialState,
  ) {
    if (binding.screen01Fingerprint !== baselineFingerprint) {
      throw new Error(
        "This Screen 2 open operationId is already bound to a different confirmed Screen 1 baseline.",
      );
    }
    if (binding.initialState !== initialState) {
      throw new Error(
        "This Screen 2 open operationId is already bound to a different initialization profile.",
      );
    }
    const seen = new Set<string>();
    for (const config of this.signingCandidates()) {
      if (config.keyId !== binding.signingKeyId) continue;
      const candidate = await deriveOpenIdentity(
        config,
        operationId,
        binding.identityNonce,
      );
      if (seen.has(candidate.runId)) continue;
      seen.add(candidate.runId);
      if (candidate.runId !== binding.runId) continue;
      const existing = await this.options.store.read(candidate);
      if (existing.outcome === "authenticated") {
        return this.openResult(
          existing.record,
          candidate.accessToken,
          baselineFingerprint,
          "replayed",
          initialState,
        );
      }
    }
    throw new Error(
      "ShockAudit cannot replay this active Screen 2 open operation with the available signing keys.",
    );
  }

  async open(
    baseline: Screen01StudyContext,
    operationId?: string,
    initialState: Screen02WorkflowInitialState = "standard",
  ): Promise<Screen02WorkflowRuntimeResult> {
    initialState = requireInitialState(initialState);
    const baselineFingerprint = fingerprintScreen01StudyContext(baseline);
    let identity: Screen02WorkflowStoreIdentity;
    let identityNonce: string | null = null;
    let identitySigningKeyId: string | null = null;
    if (operationId === undefined) {
      identity = createScreen02WorkflowStoreIdentity();
    } else {
      const safeOperationId = requireOpenOperationId(operationId);
      const openOperation = await this.options.store.readOpenOperation(
        safeOperationId,
      );
      if (openOperation.outcome === "bound") {
        return this.replayOpenOperation(
          openOperation.binding,
          safeOperationId,
          baselineFingerprint,
          initialState,
        );
      }
      if (!this.options.signing.current) {
        throw new Error(
          "Idempotent Screen 2 workflow opening requires an active signing key.",
        );
      }
      identityNonce = createOpenIdentityNonce();
      identitySigningKeyId = this.options.signing.current.keyId;
      identity = await deriveOpenIdentity(
        this.options.signing.current,
        safeOperationId,
        identityNonce,
      );
    }
    const at = this.options.now();
    let state =
      initialState === "blank" && baseline.startingPoint === "audit"
        ? createScreen02AuditState(baseline, identity.runId, at)
        : baseline.startingPoint === "audit" && this.options.discoverAudit
        ? createScreen02AuditState(baseline, identity.runId, at)
        : createInitialScreen02WorkflowState(
            baseline,
            identity.runId,
            at,
            controllerOptions(this.options),
          );
    if (
      initialState === "standard" &&
      state.mode === "audit" &&
      this.options.discoverAudit
    ) {
      const discovery = await this.options.discoverAudit(state, {
        matchSetSnapshotId: this.options.createId("audit-match-set"),
        at,
        exactRequest: `Resolve the researcher-named shock from its exact Screen 1 wording: ${state.anchor.originalWording}. Use identity and version anchors globally; do not apply study-fit exclusions.`,
        maximumMatches: 12,
      });
      state = applyScreen02AuditMatchRound(state, discovery);
    }
    const created = await this.options.store.create({
      runId: identity.runId,
      accessToken: identity.accessToken,
      stateEnvelope: stateEnvelope(state),
      ...(operationId && identityNonce && identitySigningKeyId
        ? {
            openOperation: {
              operationId,
              identityNonce,
              signingKeyId: identitySigningKeyId,
              initialState,
            },
          }
        : {}),
    });
    if (created.outcome === "open-operation-raced") {
      if (!operationId) {
        throw new Error(
          "ShockAudit received an invalid idempotent-open race result.",
        );
      }
      return this.replayOpenOperation(
        created.binding,
        operationId,
        baselineFingerprint,
        initialState,
      );
    }
    if (created.outcome === "open-operation-blocked") {
      throw new Error(
        created.reason === "initialization-mismatch"
          ? "This Screen 2 open operationId is already bound to a different initialization profile."
          : "This Screen 2 open operationId is already bound to a different confirmed Screen 1 baseline.",
      );
    }
    if (created.outcome === "unauthorized") {
      throw new Error(
        operationId === undefined
          ? "ShockAudit could not allocate an isolated Screen 2 run."
          : "ShockAudit could not authenticate the idempotent Screen 2 run.",
      );
    }
    if (created.outcome === "conflict" && operationId === undefined) {
      throw new Error("ShockAudit could not allocate an isolated Screen 2 run.");
    }
    return this.openResult(
      created.record,
      identity.accessToken,
      baselineFingerprint,
      operationId === undefined
        ? "created"
        : created.outcome === "created"
          ? "created"
          : "replayed",
      initialState,
    );
  }

  private async openResult(
    record: Screen02WorkflowStoreRecord,
    accessToken: string,
    expectedBaselineFingerprint: string,
    outcome: "created" | "replayed",
    initialState: Screen02WorkflowInitialState,
  ): Promise<Screen02WorkflowRuntimeResult> {
    if (record.screen01Fingerprint !== expectedBaselineFingerprint) {
      throw new Error(
        "This Screen 2 open operationId is already bound to a different confirmed Screen 1 baseline.",
      );
    }
    const canonical = stateFromRecord(record);
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      canonical,
      accessToken,
      controllerOptions(this.options),
    );
    const readyMessage =
      canonical.mode === "find"
        ? "Screen 2 Find is ready. Run the bounded factual search when you are ready."
        : initialState === "blank"
          ? "Screen 2 Audit reset to its blank named-shock anchor. Run a fresh identity search when you are ready."
          : "Screen 2 Audit preserved the named-shock anchor and completed bounded identity discovery.";
    return {
      snapshot,
      summary: buildScreen02WorkflowSummary(
        canonical,
        snapshot.assessmentAvailable,
        runtimeMessage(outcome, readyMessage),
        outcome,
      ),
    };
  }

  async retire(
    input: Screen02WorkflowRetireInput,
  ): Promise<Screen02WorkflowRetireResult> {
    const read = await this.options.store.read({
      runId: input.runId,
      accessToken: input.accessToken,
    });
    if (read.outcome === "unauthorized") {
      throw new Error("Screen 2 workflow access was rejected.");
    }
    if (read.outcome === "not-found") {
      if (this.options.retireScreen03) {
        await this.options.retireScreen03(input.runId);
      }
      return {
        outcome: "already-absent",
        runId: input.runId,
        message: "The retired Screen 2 run was already absent.",
      };
    }
    if (
      read.record.stateRevision !== input.expectedRevision ||
      read.record.stateFingerprint !== input.expectedStateFingerprint
    ) {
      return {
        outcome: "conflict",
        runId: input.runId,
        message:
          "The Screen 2 run changed before retirement. It remains inaccessible from the new workspace and will expire automatically.",
      };
    }
    const retired = await this.options.store.retire({
      runId: input.runId,
      accessToken: input.accessToken,
      expected: coordinates(read.record),
    });
    if (retired.outcome === "unauthorized") {
      throw new Error("Screen 2 workflow access was rejected.");
    }
    if (retired.outcome === "conflict") {
      return {
        outcome: "conflict",
        runId: input.runId,
        message:
          "The Screen 2 run changed before retirement. It remains inaccessible from the new workspace and will expire automatically.",
      };
    }
    if (retired.outcome === "retired" && this.options.retireScreen03) {
      await this.options.retireScreen03(input.runId);
    }
    return {
      outcome:
        retired.outcome === "retired" ? "retired" : "already-absent",
      runId: input.runId,
      message:
        retired.outcome === "retired"
          ? "The prior Screen 2 run was deleted after replacement."
          : "The retired Screen 2 run was already absent.",
    };
  }

  async mutate(
    action: Screen02WorkflowAction,
  ): Promise<Screen02WorkflowRuntimeResult> {
    // Sharing a promise before store authentication is safe only when every
    // authenticated request field is identical. The digest binds the private
    // possession token, exact CAS coordinates, payload, operation, and action
    // without retaining the plaintext token in the coordinator key.
    const key = await mutationCoalescingKey(action);
    const existing = this.mutationCoordinator.inFlightMutations.get(key);
    if (existing) return existing;

    const priorTail = this.mutationCoordinator.mutationTails.get(action.runId);
    let releaseTail!: () => void;
    const ownCompletion = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });
    const ownTail = (priorTail ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => ownCompletion);
    this.mutationCoordinator.mutationTails.set(action.runId, ownTail);
    const pending = (async () => {
      await priorTail?.catch(() => undefined);
      return this.mutateOnce(action);
    })();
    this.mutationCoordinator.inFlightMutations.set(key, pending);
    try {
      return await pending;
    } finally {
      releaseTail();
      if (this.mutationCoordinator.inFlightMutations.get(key) === pending) {
        this.mutationCoordinator.inFlightMutations.delete(key);
      }
      if (this.mutationCoordinator.mutationTails.get(action.runId) === ownTail) {
        this.mutationCoordinator.mutationTails.delete(action.runId);
      }
    }
  }

  private async mutateOnce(
    action: Screen02WorkflowAction,
  ): Promise<Screen02WorkflowRuntimeResult> {
    const read = await this.options.store.read({
      runId: action.runId,
      accessToken: action.accessToken,
    });
    if (read.outcome === "not-found" || read.outcome === "unauthorized") {
      throw new Error(
        "This Screen 2 run is unavailable or expired. Start a fresh run from the confirmed Screen 1 study.",
      );
    }
    const currentState = stateFromRecord(read.record);
    if (action.action === "refresh") {
      const snapshot = await buildScreen02WorkflowClientSnapshot(
        currentState,
        action.accessToken,
        controllerOptions(this.options),
      );
      const conflict =
        action.expectedRevision !== currentState.revision ||
        action.expectedStateFingerprint !== read.record.stateFingerprint;
      return {
        snapshot,
        summary: buildScreen02WorkflowSummary(
          currentState,
          snapshot.assessmentAvailable,
          runtimeMessage(
            conflict ? "conflict" : "refreshed",
            "Canonical Screen 2 state refreshed.",
          ),
          conflict ? "conflict" : "refreshed",
        ),
      };
    }
    const exactPredecessor =
      action.expectedRevision === currentState.revision &&
      action.expectedStateFingerprint === read.record.stateFingerprint;
    const applied = exactPredecessor
      ? await applyScreen02WorkflowAction(
          currentState,
          action,
          controllerOptions(this.options),
        )
      : null;
    if (
      applied &&
      action.action === "find-search-continue" &&
      applied.state.revision === currentState.revision &&
      fingerprintScreen02WorkflowState(applied.state) ===
        read.record.stateFingerprint
    ) {
      // A pending retrieval chunk advances only the authenticated private
      // continuation journal. Do not manufacture a public workflow revision
      // or parent-store generation merely to acknowledge mechanical progress;
      // the continuation store owns durable operation replay for this case.
      const snapshot = await buildScreen02WorkflowClientSnapshot(
        currentState,
        action.accessToken,
        controllerOptions(this.options),
      );
      return {
        snapshot,
        summary: buildScreen02WorkflowSummary(
          currentState,
          snapshot.assessmentAvailable,
          applied.message,
          "applied",
        ),
      };
    }
    const preparedPlan = applied
      ? {
          stateEnvelope: stateEnvelope(applied.state),
          bufferedReceipts: activeReceiptBuffer(
            read.record.bufferedReceipts,
            applied.state,
          ),
          updatedAt: applied.state.updatedAt,
          replayResult: {
            message: applied.message,
            deliveredRequestIds: applied.deliveredRequestIds,
          },
        }
      : null;
    const update = await this.options.store.update({
      runId: action.runId,
      accessToken: action.accessToken,
      // The current generation closes a read/write race, while the revision
      // and fingerprint remain the caller's exact predecessor claim. The
      // store checks operation replay before these coordinates, so an
      // identical network retry returns its prior result instead of conflict.
      expected: {
        generation: read.record.generation,
        revision: action.expectedRevision,
        stateFingerprint: action.expectedStateFingerprint,
      },
      operationId: action.operationId,
      operationKind: action.action,
      mutate: async () => {
        if (!preparedPlan) {
          throw new Error(
            "A stale Screen 2 operation reached an impossible mutation callback.",
          );
        }
        return preparedPlan;
      },
    });
    if (update.outcome === "not-found" || update.outcome === "unauthorized") {
      throw new Error(
        "This Screen 2 run is unavailable or expired. Start a fresh run from the confirmed Screen 1 study.",
      );
    }
    let record = update.record;
    const replay =
      update.outcome !== "conflict" && isRecord(update.replayResult)
        ? update.replayResult
        : {};
    const deliveredRequestIds = Array.isArray(replay.deliveredRequestIds)
      ? replay.deliveredRequestIds.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : [];
    if (update.outcome !== "conflict" && deliveredRequestIds.length > 0) {
      record = await this.drainBuffered(record, deliveredRequestIds);
    }
    const state = stateFromRecord(record);
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      state,
      action.accessToken,
      controllerOptions(this.options),
    );
    const outcome: Screen02WorkflowSummary["outcome"] =
      update.outcome === "updated"
        ? "applied"
        : update.outcome === "replayed"
          ? "replayed"
          : "conflict";
    const message =
      typeof replay.message === "string"
        ? replay.message
        : outcome === "conflict"
          ? "The canonical winner was restored."
          : "Screen 2 operation completed.";
    return {
      snapshot,
      summary: buildScreen02WorkflowSummary(
        state,
        snapshot.assessmentAvailable,
        runtimeMessage(outcome, message),
        outcome,
      ),
    };
  }

  async submitFindDraft(
    submission: Screen02FindDraftSubmission,
  ): Promise<Screen02WorkflowReceiptNotice> {
    if (this.options.legacyHostAssessments === false) {
      throw new Error(
        "Legacy Screen 2 Find assessment submission is disabled on this route.",
      );
    }
    const signed = await this.createFindReceipt(submission);
    return this.commitSignedReceipt("find", signed);
  }

  async submitAuditDraft(
    submission: Screen02AuditDraftSubmission,
  ): Promise<Screen02WorkflowReceiptNotice> {
    if (this.options.legacyHostAssessments === false) {
      throw new Error(
        "Legacy Screen 2 Audit assessment submission is disabled on this route.",
      );
    }
    const signed = await this.createAuditReceipt(submission);
    return this.commitSignedReceipt("audit", signed);
  }

  private signingCandidates() {
    return [this.options.signing.current, this.options.signing.previous].filter(
      (candidate): candidate is Screen02WorkflowSigningConfig => Boolean(candidate),
    );
  }

  private async createFindReceipt(submission: Screen02FindDraftSubmission) {
    let lastError: unknown = null;
    for (const config of this.signingCandidates()) {
      try {
        return await createSignedScreen02FindNormalizedReceipt(
          {
            submission,
            receiptId: this.options.createId("find-receipt"),
            receivedAt: this.options.now(),
          },
          config,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Find assessment signing is unavailable.");
  }

  private async createAuditReceipt(submission: Screen02AuditDraftSubmission) {
    let lastError: unknown = null;
    for (const config of this.signingCandidates()) {
      try {
        return await createSignedScreen02AuditNormalizedReceipt(
          {
            submission,
            receiptId: this.options.createId("audit-receipt"),
            receivedAt: this.options.now(),
          },
          config,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Audit assessment signing is unavailable.");
  }

  private async commitSignedReceipt(
    mode: "find",
    signed: Screen02FindSignedReceipt,
  ): Promise<Screen02WorkflowReceiptNotice>;
  private async commitSignedReceipt(
    mode: "audit",
    signed: Screen02AuditSignedReceipt,
  ): Promise<Screen02WorkflowReceiptNotice>;
  private async commitSignedReceipt(
    mode: "find" | "audit",
    signed: Screen02FindSignedReceipt | Screen02AuditSignedReceipt,
  ) {
    const runId = signed.payload.capability.runId;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const read = await this.options.store.readTrusted({ runId });
      if (read.outcome === "not-found") {
        throw new Error("The signed receipt targets an unavailable Screen 2 run.");
      }
      if (read.record.mode !== mode) {
        throw new Error("The signed receipt cannot cross Screen 2 workflow modes.");
      }
      const state = stateFromRecord(read.record);
      let applied =
        mode === "find"
          ? applyCanonicalScreen02FindReceipt(
              state as Extract<Screen02WorkflowState, { mode: "find" }>,
              signed as Screen02FindSignedReceipt,
            )
          : applyCanonicalScreen02AuditReceipt(
              state as Extract<Screen02WorkflowState, { mode: "audit" }>,
              signed as Screen02AuditSignedReceipt,
            );
      if (
        mode === "find" &&
        applied.disposition === "apply" &&
        (applied.findDiscoveryPlan || applied.findDiscoveryFallbackReason)
      ) {
        applied = {
          ...applied,
          state: await completeScreen02FindDiscoveryAfterPlanning(
            applied.state as Extract<Screen02WorkflowState, { mode: "find" }>,
            applied.findDiscoveryPlan ?? {
              origin: "fixed-fallback",
              reason: applied.findDiscoveryFallbackReason!,
            },
            applied.state.updatedAt,
            controllerOptions(this.options),
          ),
        };
      }
      const priorBuffered = read.record.bufferedReceipts.find(
        (receipt) => receipt.requestId === applied.requestId,
      );
      if (priorBuffered) {
        return receiptNotice({
          ...applied,
          state,
          disposition:
            priorBuffered.receiptId === applied.receiptId
              ? "duplicate"
              : "terminal",
          reason:
            priorBuffered.receiptId === applied.receiptId
              ? "This signed receipt is already buffered awaiting canonical delivery."
              : "A different first valid receipt is already buffered for this request.",
        });
      }
      const bufferedReceipts =
        applied.disposition === "buffered-awaiting-delivery"
          ? [
              ...read.record.bufferedReceipts,
              {
                receiptId: applied.receiptId,
                requestId: applied.requestId,
                assessmentMode: signed.payload.capability.mode,
                receiptToken: signed.receiptToken,
                receivedAt: signed.payload.receivedAt,
              } satisfies Screen02WorkflowBufferedReceipt,
            ]
          : read.record.bufferedReceipts.filter(
              (receipt) => receipt.requestId !== applied.requestId,
            );
      const notice = receiptNotice(applied);
      const changesCanonicalRecord =
        applied.disposition === "apply" ||
        applied.disposition === "buffered-awaiting-delivery" ||
        bufferedReceipts.length !== read.record.bufferedReceipts.length;
      if (!changesCanonicalRecord) {
        return notice;
      }
      const updated = await this.options.store.updateTrusted({
        runId,
        expected: coordinates(read.record),
        operationId: `receipt-${applied.receiptId}`,
        operationKind: `receipt-${mode}`,
        mutate: async () => ({
          stateEnvelope: stateEnvelope(applied.state),
          bufferedReceipts,
          updatedAt:
            applied.state.updatedAt > read.record.updatedAt
              ? applied.state.updatedAt
              : read.record.updatedAt,
          replayResult: notice,
        }),
      });
      if (updated.outcome === "conflict") continue;
      if (updated.outcome === "not-found") {
        throw new Error("The signed receipt target disappeared before commit.");
      }
      if (updated.outcome === "replayed" && isReceiptNotice(updated.replayResult)) {
        return updated.replayResult;
      }
      return notice;
    }
    throw new Error("The signed receipt lost repeated canonical state races; retry safely.");
  }

  private async drainBuffered(
    initial: Screen02WorkflowStoreRecord,
    requestIds: readonly string[],
  ) {
    const allowed = new Set(requestIds);
    let record = initial;
    const receiptIds = initial.bufferedReceipts
      .filter((receipt) => allowed.has(receipt.requestId))
      .map((receipt) => receipt.receiptId);
    for (const receiptId of receiptIds) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const buffered = record.bufferedReceipts.find(
          (receipt) => receipt.receiptId === receiptId,
        );
        if (!buffered) break;
        const signed = await this.verifyBuffered(
          record.mode,
          buffered.receiptToken,
        );
        const state = stateFromRecord(record);
        let applied =
          record.mode === "find"
            ? applyCanonicalScreen02FindReceipt(
                state as Extract<Screen02WorkflowState, { mode: "find" }>,
                signed as Screen02FindSignedReceipt,
              )
            : applyCanonicalScreen02AuditReceipt(
                state as Extract<Screen02WorkflowState, { mode: "audit" }>,
                signed as Screen02AuditSignedReceipt,
              );
        if (
          record.mode === "find" &&
          applied.disposition === "apply" &&
          (applied.findDiscoveryPlan || applied.findDiscoveryFallbackReason)
        ) {
          applied = {
            ...applied,
            state: await completeScreen02FindDiscoveryAfterPlanning(
              applied.state as Extract<Screen02WorkflowState, { mode: "find" }>,
              applied.findDiscoveryPlan ?? {
                origin: "fixed-fallback",
                reason: applied.findDiscoveryFallbackReason!,
              },
              applied.state.updatedAt,
              controllerOptions(this.options),
            ),
          };
        }
        const updated = await this.options.store.updateTrusted({
          runId: record.runId,
          expected: coordinates(record),
          operationId: `drain-${buffered.receiptId}`,
          operationKind: `drain-${record.mode}`,
          mutate: async () => ({
            stateEnvelope: stateEnvelope(applied.state),
            bufferedReceipts: record.bufferedReceipts.filter(
              (receipt) => receipt.receiptId !== buffered.receiptId,
            ),
            updatedAt:
              applied.state.updatedAt > record.updatedAt
                ? applied.state.updatedAt
                : record.updatedAt,
            replayResult: receiptNotice(applied),
          }),
        });
        if (updated.outcome === "updated" || updated.outcome === "replayed") {
          record = updated.record;
          break;
        }
        if (updated.outcome === "not-found") return record;
        const refreshed = await this.options.store.readTrusted({
          runId: record.runId,
        });
        if (refreshed.outcome === "not-found") return record;
        record = refreshed.record;
      }
    }
    return record;
  }

  private async verifyBuffered(
    mode: "find" | "audit",
    receiptToken: string,
  ) {
    let lastError: unknown = null;
    for (const config of this.signingCandidates()) {
      try {
        return mode === "find"
          ? await verifySignedScreen02FindNormalizedReceipt(receiptToken, config)
          : await verifySignedScreen02AuditNormalizedReceipt(receiptToken, config);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Buffered receipt verification is unavailable.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReceiptNotice(value: unknown): value is Screen02WorkflowReceiptNotice {
  return (
    isRecord(value) &&
    value.schemaVersion === SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION &&
    value.phase === "canonical-receipt-result"
  );
}
