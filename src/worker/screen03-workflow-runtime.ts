import {
  applyScreen03Action,
  attachScreen03Orientation,
  attachScreen03BriefingLifecycle,
  buildScreen03StateFromResearch,
  decideScreen03Briefing,
  fingerprintScreen03VerificationState,
  integrateScreen03BriefingProposal,
  integrateScreen03HostInterpretation,
  refreshScreen03StateFromResearch,
  screen03FactualClaims,
  screen03ProposalConfirmability,
  SHOCKAUDIT_V0314_RELEASE_LABEL,
  SHOCKAUDIT_V0315_RELEASE_LABEL,
  type Screen03Action,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import {
  resolveScreen02ShockGlance,
} from "../core/screen02-shock-glance";
import {
  SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_RENDER_RESULT_SCHEMA_VERSION,
  restoreScreen03BriefingContent,
  type Screen03BriefingContent,
  type Screen03BriefingDecision,
  type Screen03BriefingProposal,
} from "../core/screen03-briefing";
import {
  SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION,
  isScreen03HostDraftReceiptNotice,
  type Screen03HostDraftReceiptNotice,
} from "../core/screen03-host-draft-client";
import type {
  Screen02DownstreamReadResult,
  Screen02WorkflowRuntime,
} from "./screen02-workflow-runtime";
import {
  researchScreen03Evidence,
  type Screen03EvidenceServiceInput,
} from "./screen03-evidence-service";
import { compileScreen03ExactExcerpts } from "./screen03-timeline-extraction";
import {
  interpretScreen03Packet,
  restoreScreen03HostInterpretation,
} from "./screen03-interpretation";
import {
  authenticateScreen03HostDraftSubmission,
  createScreen03HostDraftCapability,
  reconstructScreen03HostDraftSourcePacket,
  screen03HostDraftParentGuard,
  type Screen03HostDraftBatch,
  type Screen03HostDraftSigningConfig,
} from "./screen03-host-draft-security";
import {
  SCREEN_03_BRIEFING_PROVENANCE_CONSTANTS,
  authenticateScreen03BriefingPacket,
  buildScreen03BriefingPacketBody,
  createScreen03BriefingContinuation,
  createScreen03BriefingPacket,
  deriveScreen02BriefingContinuationAccessToken,
  screen03BriefingPacketHash,
  screen03BriefingSha256,
  validateScreen03BriefingContentAgainstPacket,
  verifyScreen03BriefingContinuation,
  verifyScreen03BriefingPacket,
  type Screen03BriefingContinuation,
  type Screen03BriefingPacket,
  type Screen03BriefingPacketCapability,
} from "./screen03-briefing-security";
import type {
  Screen03WorkflowStore,
  Screen03WorkflowStoreRecord,
} from "./screen03-workflow-store";

export type Screen03ParentCoordinates = {
  runId: string;
  accessToken: string;
  expectedRevision: number;
  expectedStateFingerprint: string;
  expectedHandoffProducerAppVersion?: string;
  expectedHandoffFingerprint?: string;
};

export type Screen03WorkflowOpenInput = Screen03ParentCoordinates & {
  operationId: string;
  refresh?: boolean;
  targetProposalId?: string;
};

export type Screen03WorkflowMutationInput = Screen03ParentCoordinates & {
  operationId: string;
  expectedScreen03Revision: number;
  expectedScreen03StateFingerprint: string;
  action:
    | Omit<Extract<Screen03Action, { type: "review-field" }>, "at">
    | Omit<Extract<Screen03Action, { type: "review-all-fields" }>, "at">
    | Omit<Extract<Screen03Action, { type: "select-focal-clock" }>, "at">
    | Omit<Extract<Screen03Action, { type: "resolve-contradiction" }>, "at">
    | Omit<Extract<Screen03Action, { type: "mark-source-changed" }>, "at">
    | Omit<Extract<Screen03Action, { type: "lock-event-card" }>, "at">;
};

export type Screen03WorkflowContinuationMutationInput = {
  operationId: string;
  responseKeyId?: string;
  responseKey?: string;
  continuationToken: string;
  expectedScreen03Revision: number;
  expectedScreen03StateFingerprint: string;
  action: Screen03WorkflowMutationInput["action"];
};

export type Screen03BriefingGetInput = {
  safeRunRef: string;
};

export type Screen03BriefingRenderInput = {
  safeRunRef: string;
  packetId: string;
  packetHash: string;
  selectedEventId: string;
  content: Screen03BriefingContent;
};

export type Screen03BriefingConfirmInput = {
  continuationToken: string;
  proposalId: string;
  expectedScreen03Revision: number;
  expectedScreen03StateFingerprint: string;
  decision:
    | { action: "confirm" | "reject"; reason: string }
    | { action: "revise"; reason: string; content: Screen03BriefingContent };
};

export type Screen03BriefingPrivateBootstrap = {
  screen02Workflow: Awaited<ReturnType<
    Screen02WorkflowRuntime["continueForScreen03Briefing"]
  >>["snapshot"];
  widget: {
    schemaVersion: "screen-03-workflow-widget-v1";
    state: Screen03VerificationState;
    activeScreen: 3;
  };
  continuationToken: string;
  continuationExpiresAt: string;
  responseKeyId: string;
  responseKey: string;
};

export type Screen03BriefingRenderResult = {
  schemaVersion: typeof SCREEN_03_BRIEFING_RENDER_RESULT_SCHEMA_VERSION;
  outcome: "proposed" | "duplicate" | "conflict";
  safeRunRef: string;
  packetId: string;
  packetHash: string;
  proposalId: string | null;
  state: Screen03VerificationState;
  message: string;
  privateBootstrap: Screen03BriefingPrivateBootstrap;
};

export type Screen03BriefingConfirmResult = {
  schemaVersion: typeof SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION;
  outcome: "confirmed" | "revised" | "rejected" | "duplicate" | "conflict";
  proposalId: string;
  decisionId: string;
  state: Screen03VerificationState;
  message: string;
  privateBootstrap: Screen03BriefingPrivateBootstrap;
};

export type Screen03WorkflowRuntimeResult = {
  outcome: "opened" | "restored" | "replaced" | "applied" | "conflict";
  state: Screen03VerificationState;
  message: string;
};

export {
  SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION,
  isScreen03HostDraftReceiptNotice,
};
export type { Screen03HostDraftReceiptNotice };

export type Screen03WorkflowRuntimeOptions = {
  store: Screen03WorkflowStore;
  screen02: Screen02WorkflowRuntime;
  now: () => string;
  fetch: Screen03EvidenceServiceInput["fetch"];
  convertDocument?: Screen03EvidenceServiceInput["convertDocument"];
  synthesizer?: Screen03EvidenceServiceInput["synthesizer"];
  contextSearch?: Screen03EvidenceServiceInput["contextSearch"];
  onTelemetry?: Screen03EvidenceServiceInput["onTelemetry"];
  hostDraftSigning?: {
    current: Screen03HostDraftSigningConfig;
    previous?: Screen03HostDraftSigningConfig;
  };
  createHostDraftId?: (kind: "capability" | "request") => string;
  createBriefingId?: (
    kind: "safe-run-ref" | "packet" | "continuation" | "decision",
  ) => string;
};

function coordinates(record: Screen03WorkflowStoreRecord) {
  return {
    revision: record.stateRevision,
    stateFingerprint: record.stateFingerprint,
    generation: record.generation,
  };
}

const SCREEN03_BRIEFING_SNAPSHOT_DESCRIPTION_MAX = 600;
const SCREEN03_BRIEFING_SNAPSHOT_TRUNCATION_MARKER = " [truncated]";

function boundedBriefingSnapshotDescription(description: string) {
  if (description.length <= SCREEN03_BRIEFING_SNAPSHOT_DESCRIPTION_MAX) {
    return description;
  }
  return `${description.slice(
    0,
    SCREEN03_BRIEFING_SNAPSHOT_DESCRIPTION_MAX -
      SCREEN03_BRIEFING_SNAPSHOT_TRUNCATION_MARKER.length,
  ).trimEnd()}${SCREEN03_BRIEFING_SNAPSHOT_TRUNCATION_MARKER}`;
}

function parentGuard(parent: Screen02DownstreamReadResult) {
  return {
    runId: parent.state.runId,
    generation: parent.generation,
    revision: parent.state.revision,
    stateFingerprint: parent.stateFingerprint,
    expiresAt: parent.expiresAt,
  };
}

/**
 * The Screen 3 host-draft and briefing protocols are retained only so an
 * already-open historical v0.3.14/v0.3.15 workflow remains recoverable. New
 * v0.3.17 workflows use the fixed Screen 2 orientation carried into Screen 3
 * and must never mint or accept a separate Screen 3 model request.
 */
export function screen03HistoricalHostCompatibilityEnabled(
  state: Pick<Screen03VerificationState, "releaseLabel">,
) {
  return state.releaseLabel === SHOCKAUDIT_V0314_RELEASE_LABEL ||
    state.releaseLabel === SHOCKAUDIT_V0315_RELEASE_LABEL;
}

function requireHistoricalScreen03HostCompatibility(
  state: Pick<Screen03VerificationState, "releaseLabel">,
) {
  if (!screen03HistoricalHostCompatibilityEnabled(state)) {
    throw new Error(
      "Screen 3 host drafting is unavailable for current workflows; use the fixed Screen 2 orientation.",
    );
  }
}

export class Screen03WorkflowRuntime {
  constructor(private readonly options: Screen03WorkflowRuntimeOptions) {}

  private parent(input: Screen03ParentCoordinates) {
    return this.options.screen02.readForScreen03(input);
  }

  private hostDraftId(kind: "capability" | "request") {
    return this.options.createHostDraftId?.(kind) ??
      `s3h_${kind}_${crypto.randomUUID()}`;
  }

  private randomBase64Url() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
      .replace(/=+$/u, "");
  }

  private briefingId(
    kind: "safe-run-ref" | "packet" | "continuation" | "decision",
  ) {
    const supplied = this.options.createBriefingId?.(kind);
    if (supplied) return supplied;
    return kind === "safe-run-ref"
      ? `s3ref_${this.randomBase64Url()}`
      : `s3b_${kind.replaceAll("-", "_")}_${crypto.randomUUID()}`;
  }

  private responseKeyPair() {
    return {
      responseKeyId: this.randomBase64Url(),
      responseKey: this.randomBase64Url(),
    };
  }

  private briefingProposalReplayMessage(
    state: Screen03VerificationState,
    proposalId: string,
  ) {
    const lifecycle = state.briefing;
    const latestDecision = [...(lifecycle?.decisions ?? [])]
      .reverse()
      .find((decision) => decision.proposalId === proposalId);
    if (latestDecision?.action === "reject") {
      return "This ChatGPT host proposal was already rejected. Its audit record remains preserved.";
    }
    if (
      lifecycle?.confirmedIsCurrent &&
      lifecycle.confirmed?.proposalId === proposalId
    ) {
      return latestDecision?.action === "revise"
        ? "A researcher revision of this ChatGPT host proposal is already confirmed and current."
        : "This ChatGPT host proposal is already confirmed and current.";
    }
    if (latestDecision?.action === "confirm" || latestDecision?.action === "revise") {
      return "This proposal has a recorded researcher decision, but it is no longer the current briefing for the canonical facts and evidence.";
    }
    return "This ChatGPT host proposal was already saved. Researcher review is still required.";
  }

  private signingCandidates() {
    const ring = this.options.hostDraftSigning;
    if (!ring) {
      throw new Error(
        "Host-native Screen 3 briefing signing is not configured for this deployment.",
      );
    }
    return [ring.current, ring.previous].filter(
      (candidate): candidate is Screen03HostDraftSigningConfig =>
        candidate !== undefined,
    );
  }

  private async recordBySafeRunRef(safeRunRef: string) {
    const readBySafeRunRef = this.options.store.readBySafeRunRef;
    if (!readBySafeRunRef) {
      throw new Error("Screen 3 briefing safe-reference lookup is unavailable.");
    }
    const read = await readBySafeRunRef.call(this.options.store, safeRunRef);
    if (read.outcome === "not-found" ||
      Date.parse(read.record.expiresAt) <= Date.parse(this.options.now())) {
      throw new Error(
        "This Screen 3 briefing run is unavailable or expired. Reopen Screen 3 and ask ChatGPT again.",
      );
    }
    if (read.record.state.briefing?.safeRunRef !== safeRunRef) {
      throw new Error("The Screen 3 briefing run reference does not match canonical state.");
    }
    requireHistoricalScreen03HostCompatibility(read.record.state);
    return read.record;
  }

  private trustedParentForBriefing(record: Screen03WorkflowStoreRecord) {
    if (record.parentGeneration === undefined ||
      record.parentRevision === undefined ||
      record.handoffProducerAppVersion === undefined) {
      throw new Error(
        "Reopen Screen 3 before requesting a host-native briefing.",
      );
    }
    return this.options.screen02.readForScreen03BriefingTrusted({
      runId: record.parentRunId,
      expectedGeneration: record.parentGeneration,
      expectedRevision: record.parentRevision,
      expectedStateFingerprint: record.parentStateFingerprint,
      expectedExpiresAt: record.expiresAt,
      expectedHandoffProducerAppVersion:
        record.handoffProducerAppVersion,
      expectedHandoffFingerprint: record.handoffFingerprint,
    });
  }

  private async verifyPacketWithRing(packetId: string) {
    const observedAt = this.options.now();
    let lastError: unknown;
    for (const signing of this.signingCandidates()) {
      try {
        return {
          capability: await verifyScreen03BriefingPacket(
            packetId,
            signing,
            observedAt,
          ),
          signing,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async authenticatePacketWithRing(packetId: string) {
    let lastError: unknown;
    for (const signing of this.signingCandidates()) {
      try {
        return {
          capability: await authenticateScreen03BriefingPacket(
            packetId,
            signing,
          ),
          signing,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async verifyContinuationWithRing(continuationToken: string) {
    const observedAt = this.options.now();
    let lastError: unknown;
    for (const signing of this.signingCandidates()) {
      try {
        return await verifyScreen03BriefingContinuation(
          continuationToken,
          signing,
          observedAt,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async getBriefingPacket(
    input: Screen03BriefingGetInput,
  ): Promise<Screen03BriefingPacket> {
    const record = await this.recordBySafeRunRef(input.safeRunRef);
    const parent = await this.trustedParentForBriefing(record);
    const signing = this.signingCandidates()[0]!;
    return createScreen03BriefingPacket({
      record,
      handoff: parent.handoff,
      packetNonce: this.briefingId("packet"),
      issuedAt: this.options.now(),
    }, signing);
  }

  private async briefingBootstrap(input: {
    record: Screen03WorkflowStoreRecord;
    capability: Screen03BriefingPacketCapability;
    contentHash: string;
    packetSigning: Screen03HostDraftSigningConfig;
  }): Promise<Screen03BriefingPrivateBootstrap> {
    requireHistoricalScreen03HostCompatibility(input.record.state);
    const accessToken = await deriveScreen02BriefingContinuationAccessToken({
      capability: input.capability,
      contentHash: input.contentHash,
    }, input.packetSigning);
    const continued = await this.options.screen02.continueForScreen03Briefing({
      runId: input.record.parentRunId,
      accessToken,
      expectedGeneration: input.capability.parentGeneration,
      expectedRevision: input.capability.parentRevision,
      expectedStateFingerprint: input.capability.parentStateFingerprint,
      expectedExpiresAt: input.capability.parentExpiresAt,
      expectedHandoffProducerAppVersion:
        input.capability.handoffProducerAppVersion,
      expectedHandoffFingerprint: input.capability.handoffFingerprint,
    });
    const currentSigning = this.signingCandidates()[0]!;
    const continuation = await createScreen03BriefingContinuation({
      record: input.record,
      continuationId: this.briefingId("continuation"),
      issuedAt: this.options.now(),
    }, currentSigning);
    return {
      screen02Workflow: continued.snapshot,
      widget: {
        schemaVersion: "screen-03-workflow-widget-v1",
        state: input.record.state,
        activeScreen: 3,
      },
      continuationToken: continuation.continuationToken,
      continuationExpiresAt: continuation.continuation.expiresAt,
      ...this.responseKeyPair(),
    };
  }

  async renderBriefing(
    input: Screen03BriefingRenderInput,
  ): Promise<Screen03BriefingRenderResult> {
    const { capability, signing } = await this.verifyPacketWithRing(
      input.packetId,
    );
    if (
      input.safeRunRef !== capability.safeRunRef ||
      input.packetHash !== capability.packetHash ||
      input.selectedEventId !== capability.selectedEventId
    ) {
      throw new Error(
        "The Screen 3 briefing render request targets a different packet or event.",
      );
    }
    const record = await this.recordBySafeRunRef(input.safeRunRef);
    if (
      record.parentStateFingerprint !== capability.parentStateFingerprint ||
      record.handoffProducerAppVersion !==
        capability.handoffProducerAppVersion ||
      record.handoffFingerprint !== capability.handoffFingerprint ||
      record.state.upstream.eventFingerprint !== capability.eventFingerprint
    ) {
      throw new Error(
        "The selected run or event changed after the Screen 3 briefing packet was read.",
      );
    }
    const parent = await this.trustedParentForBriefing(record);
    const packetBody = buildScreen03BriefingPacketBody(
      record.state,
      parent.handoff,
    );
    if (await screen03BriefingPacketHash(
      record.state,
      parent.handoff,
    ) !== capability.packetHash) {
      throw new Error(
        "The Screen 3 briefing packet hash is stale or does not match canonical evidence.",
      );
    }
    const preliminaryContent = restoreScreen03BriefingContent(input.content);
    if (!preliminaryContent ||
      preliminaryContent.hostModel !== "host_model_not_exposed") {
      throw new Error(
        "The Screen 3 host briefing is malformed, unsafe, oversized, or contains unverified host-model metadata.",
      );
    }
    const contentHash = await screen03BriefingSha256(preliminaryContent);
    const existingProposal = record.state.briefing?.proposals.find(
      (proposal) =>
        proposal.provenance.packetHash === capability.packetHash &&
        proposal.contentHash === contentHash,
    );
    if (existingProposal) {
      const privateBootstrap = await this.briefingBootstrap({
        record,
        capability,
        contentHash,
        packetSigning: signing,
      });
      return {
        schemaVersion: SCREEN_03_BRIEFING_RENDER_RESULT_SCHEMA_VERSION,
        outcome: "duplicate",
        safeRunRef: input.safeRunRef,
        packetId: input.packetId,
        packetHash: input.packetHash,
        proposalId: existingProposal.proposalId,
        state: record.state,
        message: this.briefingProposalReplayMessage(
          record.state,
          existingProposal.proposalId,
        ),
        privateBootstrap,
      };
    }
    const validated = validateScreen03BriefingContentAgainstPacket(
      input.content,
      packetBody,
    );
    const proposalDigest = await screen03BriefingSha256({
      packetHash: capability.packetHash,
      contentHash,
    });
    const proposalId = `s3bp_${proposalDigest.slice("sha256:".length, 55)}`;
    const proposal: Screen03BriefingProposal = {
      schemaVersion: SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
      proposalId,
      contentHash,
      content: validated.content,
      provenance: {
        origin: "chatgpt_host",
        ...SCREEN_03_BRIEFING_PROVENANCE_CONSTANTS,
        packetId: input.packetId,
        packetHash: capability.packetHash,
        eventFingerprint: capability.eventFingerprint,
        sourceRevision: capability.screen03Revision,
        sourceStateFingerprint: capability.screen03StateFingerprint,
        evidenceIds: validated.evidenceIds,
        evidenceSnapshot: packetBody.evidence.map((item) => ({
          evidenceId: item.evidenceId,
          sourceId: item.sourceId,
          title: item.title,
          authority: item.authority,
          authorityTier: item.authorityTier,
          publishedDate: item.publishedDate,
          permittedLink: item.permittedLink,
          language: item.language,
          reviewStatus: item.reviewStatus as "carried" | "retrieved",
          passageIds: item.passages.map((passage) => passage.passageId),
        })),
        uncertaintySnapshot: [
          ...packetBody.missingEvidence.map((item) => ({
            kind: "missing-evidence" as const,
            id: item.missingEvidenceId,
            description: boundedBriefingSnapshotDescription(item.description),
          })),
          ...packetBody.unresolvedConflicts.map((item) => ({
            kind: "unresolved-conflict" as const,
            id: item.conflictId,
            description: boundedBriefingSnapshotDescription(item.summary),
          })),
          ...packetBody.claims
            .filter((item) =>
              item.factStatus === "conflicted" ||
              item.supportStatus === "conflicting"
            )
            .map((item) => ({
              kind: "conflicted-claim" as const,
              id: item.proposalId,
              description: boundedBriefingSnapshotDescription(
                item.uncertainty ?? item.label,
              ),
            })),
        ],
        generatedAt: this.options.now(),
        hostModel: "host_model_not_exposed",
      },
    };
    const integrated = integrateScreen03BriefingProposal(
      record.state,
      proposal,
      proposal.provenance.generatedAt,
    );
    const update = await this.options.store.update({
      parentRunId: record.parentRunId,
      parentStateFingerprint: capability.parentStateFingerprint,
      handoffProducerAppVersion: capability.handoffProducerAppVersion,
      parentGuard: {
        runId: record.parentRunId,
        generation: capability.parentGeneration,
        revision: capability.parentRevision,
        stateFingerprint: capability.parentStateFingerprint,
        expiresAt: capability.parentExpiresAt,
      },
      expected: coordinates(record),
      state: integrated.state,
      expiresAt: capability.parentExpiresAt,
    });
    const winner = update.record;
    const winnerProposal = winner.state.briefing?.proposals.find(
      (candidate) =>
        candidate.provenance.packetHash === capability.packetHash &&
        candidate.contentHash === contentHash,
    );
    const outcome = update.outcome === "conflict" || update.outcome === "existing"
      ? winnerProposal
        ? "duplicate"
        : "conflict"
      : integrated.duplicate
        ? "duplicate"
        : "proposed";
    const canonicalProposal = outcome === "conflict"
      ? undefined
      : winnerProposal ?? winner.state.briefing?.proposals.find(
        (candidate) => candidate.proposalId === proposalId,
      );
    if (outcome !== "conflict" && !canonicalProposal) {
      throw new Error(
        "The canonical Screen 3 briefing proposal was not persisted.",
      );
    }
    const canonicalProposalId = canonicalProposal?.proposalId ?? null;
    const privateBootstrap = await this.briefingBootstrap({
      record: winner,
      capability,
      contentHash,
      packetSigning: signing,
    });
    return {
      schemaVersion: SCREEN_03_BRIEFING_RENDER_RESULT_SCHEMA_VERSION,
      outcome,
      safeRunRef: input.safeRunRef,
      packetId: input.packetId,
      packetHash: input.packetHash,
      proposalId: canonicalProposalId,
      state: winner.state,
      message: outcome === "proposed"
        ? "ChatGPT host proposal saved — researcher review required. Review the newest ShockAudit Screen 3 card attached to this render result; the earlier card remains an unchanged snapshot. No Event Card fact was approved."
        : outcome === "duplicate"
          ? this.briefingProposalReplayMessage(
              winner.state,
              canonicalProposalId!,
            )
          : "Another Screen 3 action finished first. The current review was restored; read a fresh packet before retrying.",
      privateBootstrap,
    };
  }

  async confirmBriefing(
    input: Screen03BriefingConfirmInput,
  ): Promise<Screen03BriefingConfirmResult> {
    const continuation = await this.verifyContinuationWithRing(
      input.continuationToken,
    );
    const read = await this.options.store.read(continuation.runId);
    if (read.outcome === "not-found") {
      throw new Error("The Screen 3 briefing review is unavailable or expired.");
    }
    const record = read.record;
    requireHistoricalScreen03HostCompatibility(record.state);
    if (
      record.parentStateFingerprint !== continuation.parentStateFingerprint ||
      record.handoffProducerAppVersion !==
        continuation.handoffProducerAppVersion ||
      record.handoffFingerprint !== continuation.handoffFingerprint ||
      record.state.upstream.eventFingerprint !== continuation.eventFingerprint ||
      record.state.briefing?.safeRunRef !== continuation.safeRunRef
    ) {
      throw new Error("The Screen 3 briefing continuation targets a different run or event.");
    }
    const proposal = record.state.briefing.proposals.find(
      (candidate) => candidate.proposalId === input.proposalId,
    );
    if (!proposal) {
      throw new Error("The requested ChatGPT host proposal is not in canonical Screen 3 state.");
    }
    let content: Screen03BriefingContent | null = null;
    let contentHash: string | null = null;
    if (input.decision.action === "confirm") {
      content = proposal.content;
      contentHash = proposal.contentHash;
    } else if (input.decision.action === "revise") {
      content = restoreScreen03BriefingContent(input.decision.content);
      if (!content || content.hostModel !== "host_model_not_exposed") {
        throw new Error(
          "The revised Screen 3 briefing is malformed, unsafe, oversized, or contains unverified host-model metadata.",
        );
      }
      contentHash = await screen03BriefingSha256(content);
    }
    const decisionDigest = await screen03BriefingSha256({
      proposalId: input.proposalId,
      action: input.decision.action,
      reason: input.decision.reason,
      contentHash,
    });
    const decisionId = `s3bd_${decisionDigest.slice("sha256:".length, 55)}`;
    const priorDecision = record.state.briefing.decisions.find(
      (candidate) => candidate.decisionId === decisionId,
    );
    const archivedPacket = await this.authenticatePacketWithRing(
      proposal.provenance.packetId,
    );
    if (
      archivedPacket.capability.safeRunRef !== record.state.briefing.safeRunRef ||
      archivedPacket.capability.parentStateFingerprint !== record.parentStateFingerprint ||
      archivedPacket.capability.handoffProducerAppVersion !==
        record.handoffProducerAppVersion ||
      archivedPacket.capability.handoffFingerprint !== record.handoffFingerprint ||
      archivedPacket.capability.eventFingerprint !== record.state.upstream.eventFingerprint ||
      archivedPacket.capability.packetHash !== proposal.provenance.packetHash
    ) {
      throw new Error(
        "The archived Screen 3 briefing proposal provenance does not match the current run.",
      );
    }
    if (priorDecision) {
      const privateBootstrap = await this.briefingBootstrap({
        record,
        capability: archivedPacket.capability,
        contentHash: proposal.contentHash,
        packetSigning: archivedPacket.signing,
      });
      return {
        schemaVersion: SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
        outcome: "duplicate",
        proposalId: input.proposalId,
        decisionId,
        state: record.state,
        message: "This explicit briefing decision was already recorded.",
        privateBootstrap,
      };
    }
    if (
      record.stateRevision !== input.expectedScreen03Revision ||
      record.stateFingerprint !== input.expectedScreen03StateFingerprint
    ) {
      const privateBootstrap = await this.briefingBootstrap({
        record,
        capability: archivedPacket.capability,
        contentHash: proposal.contentHash,
        packetSigning: archivedPacket.signing,
      });
      return {
        schemaVersion: SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
        outcome: "conflict",
        proposalId: input.proposalId,
        decisionId,
        state: record.state,
        message:
          "Screen 3 changed before this briefing decision. Review the current proposal before trying again.",
        privateBootstrap,
      };
    }
    const parent = await this.trustedParentForBriefing(record);
    const packetBody = buildScreen03BriefingPacketBody(
      record.state,
      parent.handoff,
    );
    const currentPacketHash = await screen03BriefingPacketHash(
      record.state,
      parent.handoff,
    );
    if (
      input.decision.action !== "reject" &&
      currentPacketHash !== proposal.provenance.packetHash
    ) {
      const privateBootstrap = await this.briefingBootstrap({
        record,
        capability: archivedPacket.capability,
        contentHash: proposal.contentHash,
        packetSigning: archivedPacket.signing,
      });
      return {
        schemaVersion: SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
        outcome: "conflict",
        proposalId: input.proposalId,
        decisionId,
        state: record.state,
        message:
          "Canonical Screen 3 facts, evidence, conflicts, or study scope changed after this proposal was rendered. Read a fresh packet and render a current briefing before confirming or revising it.",
        privateBootstrap,
      };
    }
    const terminalDecision = record.state.briefing.decisions.find(
      (candidate) => candidate.proposalId === input.proposalId,
    );
    const isCurrentConfirmation =
      record.state.briefing.confirmedIsCurrent &&
      record.state.briefing.confirmed?.proposalId === input.proposalId;
    if (
      record.state.briefing.activeProposalId !== input.proposalId ||
      terminalDecision ||
      isCurrentConfirmation
    ) {
      throw new Error(
        "Only the current active, still-pending Screen 3 briefing proposal can receive a new researcher decision.",
      );
    }
    if (input.decision.action === "confirm") {
      content = validateScreen03BriefingContentAgainstPacket(
        proposal.content,
        packetBody,
      ).content;
    } else if (input.decision.action === "revise") {
      content = validateScreen03BriefingContentAgainstPacket(
        content,
        packetBody,
      ).content;
    }
    const decidedAt = this.options.now();
    const decision: Screen03BriefingDecision = {
      schemaVersion: "screen-03-host-briefing-decision-v1",
      decisionId,
      proposalId: input.proposalId,
      action: input.decision.action,
      reason: input.decision.reason,
      decidedAt,
      contentHash,
      content,
    };
    const decided = decideScreen03Briefing(
      record.state,
      decision,
      decidedAt,
    );
    const update = await this.options.store.update({
      parentRunId: continuation.runId,
      parentStateFingerprint: continuation.parentStateFingerprint,
      handoffProducerAppVersion:
        continuation.handoffProducerAppVersion,
      parentGuard: {
        runId: continuation.runId,
        generation: continuation.parentGeneration,
        revision: continuation.parentRevision,
        stateFingerprint: continuation.parentStateFingerprint,
        expiresAt: continuation.parentExpiresAt,
      },
      expected: coordinates(record),
      state: decided.state,
      expiresAt: continuation.parentExpiresAt,
    });
    if (update.outcome === "conflict" || update.outcome === "existing") {
      const winner = update.record.state.briefing?.decisions.find(
        (candidate) => candidate.decisionId === decisionId,
      );
      const privateBootstrap = await this.briefingBootstrap({
        record: update.record,
        capability: archivedPacket.capability,
        contentHash: proposal.contentHash,
        packetSigning: archivedPacket.signing,
      });
      return {
        schemaVersion: SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
        outcome: winner ? "duplicate" : "conflict",
        proposalId: input.proposalId,
        decisionId,
        state: update.record.state,
        message: winner
          ? "This explicit briefing decision was already recorded."
          : "Another Screen 3 action finished first. Review the current proposal before trying again.",
        privateBootstrap,
      };
    }
    const outcome = input.decision.action === "confirm"
      ? "confirmed"
      : input.decision.action === "revise"
        ? "revised"
        : "rejected";
    const privateBootstrap = await this.briefingBootstrap({
      record: update.record,
      capability: archivedPacket.capability,
      contentHash: proposal.contentHash,
      packetSigning: archivedPacket.signing,
    });
    return {
      schemaVersion: SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION,
      outcome,
      proposalId: input.proposalId,
      decisionId,
      state: update.record.state,
      message: outcome === "confirmed"
        ? "The researcher confirmed this Screen 3 briefing proposal."
        : outcome === "revised"
          ? "The researcher saved a schema- and evidence-reference-validated revision after human review; the original ChatGPT proposal remains in history."
          : "The researcher rejected this ChatGPT proposal; any previously confirmed briefing remains preserved.",
      privateBootstrap,
    };
  }

  /**
   * Refresh the model-hidden continuation for an already authenticated Screen
   * 3 iframe. This lets a slow researcher continue after the earlier scoped
   * token expires without granting authority to the public safe run ref.
   */
  async refreshAuthenticatedBriefingBootstrap(
    input: Screen03ParentCoordinates,
  ): Promise<Screen03BriefingPrivateBootstrap> {
    const parent = await this.parent(input);
    const read = await this.options.store.read(input.runId);
    if (read.outcome === "not-found" || !read.record.state.briefing) {
      throw new Error("Open Screen 3 before refreshing briefing continuation.");
    }
    const record = read.record;
    requireHistoricalScreen03HostCompatibility(record.state);
    if (
      record.parentStateFingerprint !== parent.stateFingerprint ||
      record.handoffProducerAppVersion !== parent.handoff.producerAppVersion ||
      record.handoffFingerprint !== parent.handoff.integrity.handoffFingerprint
    ) {
      throw new Error("The selected event changed before briefing continuation was refreshed.");
    }
    const continued = await this.options.screen02.continueForScreen03Briefing({
      runId: input.runId,
      accessToken: input.accessToken,
      expectedGeneration: parent.generation,
      expectedRevision: parent.state.revision,
      expectedStateFingerprint: parent.stateFingerprint,
      expectedExpiresAt: parent.expiresAt,
      expectedHandoffProducerAppVersion: parent.handoff.producerAppVersion,
      expectedHandoffFingerprint: parent.handoff.integrity.handoffFingerprint,
    });
    const signing = this.signingCandidates()[0]!;
    const continuation = await createScreen03BriefingContinuation({
      record,
      continuationId: this.briefingId("continuation"),
      issuedAt: this.options.now(),
    }, signing);
    return {
      screen02Workflow: continued.snapshot,
      widget: {
        schemaVersion: "screen-03-workflow-widget-v1",
        state: record.state,
        activeScreen: 3,
      },
      continuationToken: continuation.continuationToken,
      continuationExpiresAt: continuation.continuation.expiresAt,
      ...this.responseKeyPair(),
    };
  }

  async prepareHostDraft(
    input: Screen03ParentCoordinates,
  ): Promise<Screen03HostDraftBatch> {
    const signing = this.options.hostDraftSigning?.current;
    if (!signing) {
      throw new Error(
        "ChatGPT-host explanation is not configured for this deployment.",
      );
    }
    const parent = await this.parent(input);
    const read = await this.options.store.read(input.runId);
    if (read.outcome === "not-found") {
      throw new Error(
        "The canonical Screen 3 review is unavailable. Open Screen 3 before requesting its explanation.",
      );
    }
    const record = read.record;
    requireHistoricalScreen03HostCompatibility(record.state);
    if (
      record.parentStateFingerprint !== parent.stateFingerprint ||
      record.handoffFingerprint !== parent.handoff.integrity.handoffFingerprint
    ) {
      throw new Error(
        "The locked Screen 2 event changed. Reopen Screen 3 before requesting its explanation.",
      );
    }
    const issuedAt = this.options.now();
    return createScreen03HostDraftCapability({
      state: record.state,
      handoff: parent.handoff,
      parentGuard: parentGuard(parent),
      screen03Generation: record.generation,
      capabilityId: this.hostDraftId("capability"),
      requestId: this.hostDraftId("request"),
      issuedAt,
    }, signing);
  }

  async submitHostDraft(
    submission: unknown,
  ): Promise<Screen03HostDraftReceiptNotice> {
    const ring = this.options.hostDraftSigning;
    if (!ring) {
      throw new Error(
        "ChatGPT-host explanation is not configured for this deployment.",
      );
    }
    const observedAt = this.options.now();
    let authenticated: Awaited<
      ReturnType<typeof authenticateScreen03HostDraftSubmission>
    > | null =
      null;
    let lastError: unknown;
    for (const signing of [ring.current, ring.previous].filter(
      (candidate): candidate is Screen03HostDraftSigningConfig =>
        candidate !== undefined,
    )) {
      try {
        authenticated = await authenticateScreen03HostDraftSubmission(
          submission,
          signing,
          observedAt,
        );
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!authenticated) throw lastError;
    const {
      capability,
      requestProof,
      sourcePacket: legacySourcePacket,
      draft,
    } = authenticated;
    const notice = (
      disposition: Screen03HostDraftReceiptNotice["disposition"],
      reason: string,
    ): Screen03HostDraftReceiptNotice => ({
      schemaVersion: SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION,
      phase: "canonical-receipt-result",
      runId: capability.runId,
      requestId: capability.requestId,
      disposition,
      reason,
    });
    const read = await this.options.store.read(capability.runId);
    if (read.outcome === "not-found") {
      return notice(
        "stale",
        "The canonical Screen 3 review is no longer available. Reopen Screen 3 and try again.",
      );
    }
    const record = read.record;
    if (!screen03HistoricalHostCompatibilityEnabled(record.state)) {
      return notice(
        "stale",
        "This Screen 3 host explanation belongs to a retired workflow path; current workflows use the fixed Screen 2 orientation.",
      );
    }
    const alreadyApplied = record.state.history.some(
      (event) =>
        event.action === "host-interpretation-integrated" &&
        event.value === requestProof,
    );
    if (alreadyApplied) {
      return notice(
        "duplicate",
        "This explanation was already saved; no Screen 3 decision changed.",
      );
    }
    if (
      record.parentStateFingerprint !== capability.parentStateFingerprint ||
      record.handoffFingerprint !== capability.handoffFingerprint ||
      record.generation !== capability.screen03Generation ||
      record.stateRevision !== capability.screen03Revision ||
      record.stateFingerprint !== capability.screen03StateFingerprint
    ) {
      return notice(
        "stale",
        "Screen 3 changed while the explanation was being prepared. Request a fresh explanation for the current review.",
      );
    }
    let sourcePacket: Awaited<
      ReturnType<typeof reconstructScreen03HostDraftSourcePacket>
    >;
    try {
      sourcePacket = await reconstructScreen03HostDraftSourcePacket({
        state: record.state,
        capability,
        legacySourcePacket,
      });
    } catch {
      return notice(
        "stale",
        "The signed explanation request no longer matches canonical Screen 3 evidence. Request a fresh explanation for the current review.",
      );
    }
    const interpretation = restoreScreen03HostInterpretation(
      draft,
      sourcePacket.request,
    );
    if (!interpretation) {
      return notice(
        "rejected",
        "ChatGPT's explanation could not be safely grounded in the bounded Screen 3 sources. Try a fresh explanation; exact facts and quotes remain available.",
      );
    }
    const next = integrateScreen03HostInterpretation(
      record.state,
      interpretation,
      observedAt,
      requestProof,
    );
    if (
      fingerprintScreen03VerificationState(next) === record.stateFingerprint
    ) {
      return notice(
        "duplicate",
        "The current explanation already matches this validated draft; no Screen 3 decision changed.",
      );
    }
    if (record.handoffProducerAppVersion === undefined) {
      return notice(
        "stale",
        "Reopen Screen 3 before saving this explanation so the original handoff version can be verified.",
      );
    }
    let update: Awaited<ReturnType<Screen03WorkflowStore["update"]>>;
    try {
      update = await this.options.store.update({
        parentRunId: capability.runId,
        parentStateFingerprint: capability.parentStateFingerprint,
        handoffProducerAppVersion:
          record.handoffProducerAppVersion,
        parentGuard: screen03HostDraftParentGuard(capability),
        expected: coordinates(record),
        state: next,
        expiresAt: capability.parentExpiresAt,
      });
    } catch {
      return notice(
        "stale",
        "The selected event changed or expired before the explanation could be saved. Reopen Screen 3 and try again.",
      );
    }
    if (update.outcome === "conflict" || update.outcome === "existing") {
      if (update.record.state.history.some(
        (event) =>
          event.action === "host-interpretation-integrated" &&
          event.value === requestProof,
      )) {
        return notice(
          "duplicate",
          "This explanation was already saved; no Screen 3 decision changed.",
        );
      }
      return notice(
        "conflict",
        "Another Screen 3 action finished first. Request a fresh explanation for the current review.",
      );
    }
    return notice(
      "applied",
      "The plain-language explanation is ready. Exact claims, citations, and review decisions remain unchanged.",
    );
  }

  async open(
    input: Screen03WorkflowOpenInput,
  ): Promise<Screen03WorkflowRuntimeResult> {
    if (input.targetProposalId !== undefined && !input.refresh) {
      throw new Error(
        "Claim-targeted support search requires an explicit research refresh.",
      );
    }
    const parent = await this.parent(input);
    const handoffFingerprint = parent.handoff.integrity.handoffFingerprint;
    let existing = await this.options.store.read(input.runId);
    const retainedGlance = resolveScreen02ShockGlance(
      parent.state,
      parent.handoff,
    );
    const historicalBriefingState = existing.outcome === "found" &&
      (existing.record.state.releaseLabel === "v0.3.14" ||
        existing.record.state.releaseLabel === "v0.3.15");
    if (
      existing.outcome === "found" &&
      existing.record.parentStateFingerprint === parent.stateFingerprint &&
      existing.record.handoffFingerprint === handoffFingerprint &&
      (!existing.record.state.orientation ||
        (historicalBriefingState && !existing.record.state.briefing) ||
        existing.record.parentGeneration === undefined ||
        existing.record.parentRevision === undefined ||
        existing.record.handoffProducerAppVersion === undefined)
    ) {
      const migrationAt = this.options.now();
      const orientedState = existing.record.state.orientation || !retainedGlance
        ? existing.record.state
        : attachScreen03Orientation(
            existing.record.state,
            retainedGlance,
            migrationAt,
          );
      const migratedState = !historicalBriefingState || orientedState.briefing
        ? orientedState
        : attachScreen03BriefingLifecycle(
            orientedState,
            this.briefingId("safe-run-ref"),
            migrationAt,
          );
      const migrated = await this.options.store.update({
        parentRunId: input.runId,
        parentStateFingerprint: parent.stateFingerprint,
        handoffProducerAppVersion: parent.handoff.producerAppVersion,
        parentGuard: parentGuard(parent),
        expected: coordinates(existing.record),
        state: migratedState,
        expiresAt: parent.expiresAt,
      });
      existing = { outcome: "found", record: migrated.record };
    }
    if (
      input.targetProposalId !== undefined &&
      (
        existing.outcome !== "found" ||
        existing.record.parentStateFingerprint !== parent.stateFingerprint ||
        existing.record.handoffProducerAppVersion !==
          parent.handoff.producerAppVersion ||
        existing.record.handoffFingerprint !== handoffFingerprint
      )
    ) {
      throw new Error(
        "Claim-targeted support search requires a current Screen 3 review for this exact parent handoff.",
      );
    }
    if (
      existing.outcome === "found" &&
      existing.record.parentStateFingerprint === parent.stateFingerprint &&
      existing.record.handoffProducerAppVersion ===
        parent.handoff.producerAppVersion &&
      existing.record.handoffFingerprint === handoffFingerprint
    ) {
      if (input.refresh) {
        const researchedAt = this.options.now();
        const targetProposal = input.targetProposalId !== undefined
          ? screen03FactualClaims(existing.record.state.proposals).find(
              (proposal) => proposal.id === input.targetProposalId,
            )
          : undefined;
        if (input.targetProposalId !== undefined && !targetProposal) {
          throw new Error(
            "Claim-targeted support search requires a current reader-visible factual claim.",
          );
        }
        if (targetProposal && existing.record.state.status === "locked") {
          throw new Error(
            "A locked Event Card cannot run a claim-targeted support search.",
          );
        }
        const factualPacket = compileScreen03ExactExcerpts(await researchScreen03Evidence({
          handoff: parent.handoff,
          fetch: this.options.fetch,
          retrievedAt: researchedAt,
          ...(targetProposal
            ? {
                targetClaim: {
                  proposalId: targetProposal.id,
                  group: targetProposal.group,
                  label: targetProposal.label,
                  value: targetProposal.reviewStatus === "edited"
                    ? targetProposal.editedValue!
                    : targetProposal.value,
                  sourceIds: [...targetProposal.sourceIds],
                  passageIds: [...targetProposal.passageIds],
                  ...(targetProposal.group === "timeline"
                    ? { stage: targetProposal.stage }
                    : {}),
                },
              }
            : {}),
          ...(this.options.convertDocument
            ? { convertDocument: this.options.convertDocument }
            : {}),
          ...(this.options.synthesizer
            ? { synthesizer: this.options.synthesizer }
            : {}),
          ...(this.options.contextSearch
            ? { contextSearch: this.options.contextSearch }
            : {}),
          ...(this.options.onTelemetry
            ? { onTelemetry: this.options.onTelemetry }
            : {}),
        }), parent.handoff.event.identity.commonNames);
        const packet = await interpretScreen03Packet({
          handoff: parent.handoff,
          packet: factualPacket,
        });
        // Official-source fetches yield the Durable Object input gate. Recheck
        // the authenticated parent before consulting or writing the child so a
        // concurrent parent retirement/upstream mutation cannot be followed by
        // a stale Screen 3 result.
        const confirmedParent = await this.parent(input);
        const refreshed = refreshScreen03StateFromResearch(
          existing.record.state,
          confirmedParent.handoff,
          packet,
          researchedAt,
          input.targetProposalId,
        );
        if (
          fingerprintScreen03VerificationState(refreshed) ===
          existing.record.stateFingerprint
        ) {
          // A researcher mutation may have committed while research was in
          // flight even when the fetched evidence itself did not change.
          // Return the canonical winner instead of the pre-fetch snapshot.
          const canonical = await this.options.store.read(input.runId);
          if (canonical.outcome === "not-found") {
            throw new Error(
              "The canonical Screen 3 review became unavailable during the research refresh.",
            );
          }
          if (
            canonical.record.parentStateFingerprint !==
              confirmedParent.stateFingerprint ||
            canonical.record.handoffFingerprint !== handoffFingerprint ||
            canonical.record.generation !== existing.record.generation ||
            canonical.record.stateRevision !== existing.record.stateRevision ||
            canonical.record.stateFingerprint !== existing.record.stateFingerprint
          ) {
            return {
              outcome: "conflict",
              state: canonical.record.state,
              message:
                "Another Screen 3 operation won during the research refresh. The canonical review was restored; inspect it before retrying.",
            };
          }
          return {
            outcome: "restored",
            state: canonical.record.state,
            message:
              "The bounded official-source search found no normalized evidence change, so every Screen 3 decision was preserved.",
          };
        }
        const update = await this.options.store.update({
          parentRunId: input.runId,
          parentStateFingerprint: confirmedParent.stateFingerprint,
          handoffProducerAppVersion:
            confirmedParent.handoff.producerAppVersion,
          parentGuard: parentGuard(confirmedParent),
          expected: coordinates(existing.record),
          state: refreshed,
          expiresAt: confirmedParent.expiresAt,
        });
        if (update.outcome === "conflict" || update.outcome === "existing") {
          return {
            outcome: "conflict",
            state: update.record.state,
            message:
              "Another Screen 3 operation won during the research refresh. The canonical review was restored; inspect it before retrying.",
          };
        }
        return {
          outcome: "replaced",
          state: update.record.state,
          message: input.targetProposalId
            ? refreshed.directSupportSearches?.at(-1)?.note ??
              "The claim-targeted official-source search was recorded."
            : refreshed.history.at(-1)?.action === "context-refreshed"
            ? "Noncanonical context or plain-language interpretation changed. Screen 3 updated that reader-help lane while preserving every evidence decision, timeline state, and locked Event Card."
            : "The normalized evidence packet changed. Screen 3 preserved its audit history, invalidated any locked Event Card, and reopened every factual claim for review.",
        };
      }
      return {
        outcome: "restored",
        state: existing.record.state,
        message:
          "The canonical Screen 3 evidence review was restored with its decisions intact.",
      };
    }

    const researchedAt = this.options.now();
    const factualPacket = compileScreen03ExactExcerpts(await researchScreen03Evidence({
      handoff: parent.handoff,
      fetch: this.options.fetch,
      retrievedAt: researchedAt,
      ...(this.options.convertDocument
        ? { convertDocument: this.options.convertDocument }
        : {}),
      ...(this.options.synthesizer
        ? { synthesizer: this.options.synthesizer }
        : {}),
      ...(this.options.contextSearch
        ? { contextSearch: this.options.contextSearch }
        : {}),
      ...(this.options.onTelemetry
        ? { onTelemetry: this.options.onTelemetry }
        : {}),
    }), parent.handoff.event.identity.commonNames);
    const packet = await interpretScreen03Packet({
      handoff: parent.handoff,
      packet: factualPacket,
    });
    // Research performs external I/O, so authenticate the retained parent a
    // second time immediately before creating/replacing its Screen 3 child.
    const confirmedParent = await this.parent(input);
    const glance = resolveScreen02ShockGlance(
      confirmedParent.state,
      confirmedParent.handoff,
      researchedAt,
    );
    const state = buildScreen03StateFromResearch(
      confirmedParent.handoff,
      packet,
      researchedAt,
      glance ?? undefined,
    );
    const stored = await this.options.store.createOrReplace({
      parentRunId: input.runId,
      parentStateFingerprint: confirmedParent.stateFingerprint,
      handoffProducerAppVersion:
        confirmedParent.handoff.producerAppVersion,
      parentGuard: parentGuard(confirmedParent),
      state,
      expiresAt: confirmedParent.expiresAt,
    });
    const winner = stored.record.state;
    const outcome =
      stored.outcome === "existing"
        ? "restored"
        : stored.outcome === "replaced"
          ? "replaced"
          : "opened";
    return {
      outcome,
      state: winner,
      message:
        outcome === "restored"
          ? "The canonical Screen 3 evidence review was restored with its decisions intact."
          : outcome === "replaced"
            ? "Screen 3 restarted from the current locked event because its upstream fingerprint changed."
            : "Screen 3 completed its bounded event-specific evidence search. Review every consequential field before locking the Event Card.",
    };
  }

  async mutate(
    input: Screen03WorkflowMutationInput | Screen03WorkflowContinuationMutationInput,
  ): Promise<Screen03WorkflowRuntimeResult> {
    const usesContinuation = "continuationToken" in input;
    const continuation = usesContinuation
      ? await this.verifyContinuationWithRing(input.continuationToken)
      : null;
    const parent = usesContinuation
      ? null
      : await this.parent(input as Screen03WorkflowMutationInput);
    const runId = usesContinuation
      ? continuation!.runId
      : (input as Screen03WorkflowMutationInput).runId;
    const read = await this.options.store.read(runId);
    if (read.outcome === "not-found") {
      throw new Error(
        "The canonical Screen 3 review is unavailable. Reopen it from the locked Screen 2 event.",
      );
    }
    const record = read.record;
    const parentStateFingerprint = continuation?.parentStateFingerprint ??
      parent!.stateFingerprint;
    const canonicalHandoffFingerprint = continuation?.handoffFingerprint ??
      parent!.handoff.integrity.handoffFingerprint;
    if (
      record.parentStateFingerprint !== parentStateFingerprint ||
      record.handoffFingerprint !== canonicalHandoffFingerprint ||
      (continuation !== null &&
        (record.state.upstream.eventFingerprint !== continuation.eventFingerprint ||
          record.handoffProducerAppVersion !==
            continuation.handoffProducerAppVersion ||
          record.state.briefing?.safeRunRef !== continuation.safeRunRef))
    ) {
      throw new Error(
        "The locked Screen 2 event changed. Return to Screen 2 and reopen Screen 3 from the canonical event.",
      );
    }
    if (continuation !== null) {
      await this.trustedParentForBriefing(record);
    }
    if (
      record.stateRevision !== input.expectedScreen03Revision ||
      record.stateFingerprint !== input.expectedScreen03StateFingerprint
    ) {
      return {
        outcome: "conflict",
        state: record.state,
        message:
          "Another Screen 3 decision won this revision. The canonical review was restored; inspect it before retrying.",
      };
    }
    const next = applyScreen03Action(record.state, {
      ...input.action,
      at: this.options.now(),
    } as Screen03Action);
    const update = await this.options.store.update({
      parentRunId: runId,
      parentStateFingerprint,
      handoffProducerAppVersion: continuation?.handoffProducerAppVersion ??
        parent!.handoff.producerAppVersion,
      parentGuard: continuation === null
        ? parentGuard(parent!)
        : {
            runId: continuation.runId,
            generation: continuation.parentGeneration,
            revision: continuation.parentRevision,
            stateFingerprint: continuation.parentStateFingerprint,
            expiresAt: continuation.parentExpiresAt,
          },
      expected: coordinates(record),
      state: next,
      expiresAt: continuation?.parentExpiresAt ?? parent!.expiresAt,
    });
    if (update.outcome === "conflict" || update.outcome === "existing") {
      return {
        outcome: "conflict",
        state: update.record.state,
        message:
          "Another Screen 3 decision won this revision. The canonical review was restored; inspect it before retrying.",
      };
    }
    if (
      update.record.stateFingerprint !==
      fingerprintScreen03VerificationState(update.record.state)
    ) {
      throw new Error("The stored Screen 3 result failed its integrity check.");
    }
    return {
      outcome: "applied",
      state: update.record.state,
      message:
        update.record.state.status === "locked"
          ? "The evidence-backed Event Card is locked for this run."
          : input.action.type === "review-all-fields"
            ? (() => {
                const factual = screen03FactualClaims(
                  update.record.state.proposals,
                );
                if (input.action.mode === "unconfirm") {
                  return `All ${factual.length} Screen 3 claims were returned to review without deleting evidence.`;
                }
                const confirmed = factual.filter((proposal) =>
                  (proposal.reviewStatus === "accepted" ||
                    proposal.reviewStatus === "edited") &&
                  screen03ProposalConfirmability(
                    proposal,
                    update.record.state.evidence,
                    proposal.reviewStatus === "edited"
                      ? proposal.editedValue!
                      : proposal.value,
                    proposal.reviewStatus === "edited",
                  ).confirmable
                ).length;
                const rejected = factual.filter((proposal) =>
                  proposal.reviewStatus === "rejected"
                ).length;
                const stillNeedsReview = factual.length - confirmed - rejected;
                return `${confirmed} active, directly supported Screen 3 claim${confirmed === 1 ? " is" : "s are"} confirmed, including eligible timeline entries; ${stillNeedsReview} indirect, unsupported, stale, conflicting, or otherwise unconfirmable claim${stillNeedsReview === 1 ? " remains" : "s remain"} unchanged and need${stillNeedsReview === 1 ? "s" : ""} manual review.${rejected > 0 ? ` ${rejected} previously rejected claim${rejected === 1 ? " remains" : "s remain"} unchanged as completed researcher decision${rejected === 1 ? "" : "s"}.` : ""}`;
              })()
          : "The Screen 3 review decision was saved to the canonical workflow.",
    };
  }
}
