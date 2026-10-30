import { serializeDeterministicJson } from "./screen02-deterministic-json";

export const SCREEN_03_BRIEFING_LIFECYCLE_SCHEMA_VERSION =
  "screen-03-host-briefing-lifecycle-v1" as const;
export const SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION =
  "screen-03-host-briefing-content-v1" as const;
export const SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION =
  "screen-03-host-briefing-proposal-v1" as const;
export const SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION =
  "screen-03-host-briefing-decision-v1" as const;
export const SCREEN_03_BRIEFING_SKILL_VERSION =
  "screen3-shock-briefing-v1" as const;
export const SCREEN_03_BRIEFING_WORKFLOW_VERSION =
  "screen3-host-native-v1" as const;

export const SCREEN_03_BRIEFING_GET_TOOL =
  "get_screen3_briefing_packet" as const;
export const SCREEN_03_BRIEFING_RENDER_TOOL =
  "render_screen3_briefing" as const;
export const SCREEN_03_BRIEFING_CONFIRM_TOOL =
  "confirm_screen3_briefing" as const;
export const SCREEN_03_BRIEFING_GET_INPUT_SCHEMA_VERSION =
  "screen-03-briefing-get-v1" as const;
export const SCREEN_03_BRIEFING_PACKET_SCHEMA_VERSION =
  "screen-03-briefing-packet-v1" as const;
export const SCREEN_03_BRIEFING_RENDER_INPUT_SCHEMA_VERSION =
  "screen-03-briefing-render-v1" as const;
export const SCREEN_03_BRIEFING_RENDER_RESULT_SCHEMA_VERSION =
  "screen-03-briefing-render-result-v1" as const;
export const SCREEN_03_BRIEFING_CONFIRM_INPUT_SCHEMA_VERSION =
  "screen-03-briefing-confirm-v1" as const;
export const SCREEN_03_BRIEFING_CONFIRM_RESULT_SCHEMA_VERSION =
  "screen-03-briefing-confirm-result-v1" as const;
export const SCREEN_03_BRIEFING_BOOTSTRAP_SCHEMA_VERSION =
  "screen-03-host-briefing-bootstrap-v1" as const;
export const SCREEN_03_BRIEFING_NOT_ESTABLISHED_TEXT =
  "Not established by the bounded evidence packet." as const;

export const screen03BriefingStatuses = [
  "complete",
  "evidence-insufficient",
  "evidence-conflicted",
] as const;
export type Screen03BriefingStatus =
  (typeof screen03BriefingStatuses)[number];

export const screen03BriefingFactualSectionKeys = [
  "oneSentenceSummary",
  "whatTheShockIs",
  "whatChanged",
  "whyItMatters",
  "whoIsAffected",
  "eligibilityThresholdsAndExemptions",
  "importantTimingAndTreatmentStages",
  "enforcementAndPenalties",
  "laterChanges",
] as const;
export type Screen03BriefingFactualSectionKey =
  (typeof screen03BriefingFactualSectionKeys)[number];

export type Screen03BriefingSectionEvidenceIds = Record<
  Screen03BriefingFactualSectionKey,
  string[]
>;

export type Screen03BriefingContent = {
  schemaVersion: typeof SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION;
  briefingStatus: Screen03BriefingStatus;
  title: string;
  oneSentenceSummary: string;
  whatTheShockIs: string;
  whatChanged: string;
  whyItMatters: string;
  whoIsAffected: string;
  eligibilityThresholdsAndExemptions: string;
  importantTimingAndTreatmentStages: string;
  enforcementAndPenalties: string;
  laterChanges: string;
  plausiblePathwayToResearcherOutcome: string;
  unresolvedUncertainties: string[];
  acknowledgedMissingEvidenceIds: string[];
  acknowledgedConflictIds: string[];
  sectionEvidenceIds: Screen03BriefingSectionEvidenceIds;
  conciseRationale: string;
  hostModel: string;
};

export type Screen03BriefingProposalProvenance = {
  origin: "chatgpt_host";
  briefingSchemaVersion: typeof SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION;
  skillVersion: typeof SCREEN_03_BRIEFING_SKILL_VERSION;
  workflowVersion: typeof SCREEN_03_BRIEFING_WORKFLOW_VERSION;
  packetId: string;
  packetHash: string;
  eventFingerprint: string;
  sourceRevision: number;
  sourceStateFingerprint: string;
  evidenceIds: string[];
  evidenceSnapshot?: Array<{
    evidenceId: string;
    sourceId: string | null;
    title: string;
    authority: string;
    authorityTier: number;
    publishedDate: string | null;
    permittedLink: string | null;
    language: string;
    reviewStatus: "carried" | "retrieved";
    passageIds: string[];
  }>;
  uncertaintySnapshot?: Array<{
    kind: "missing-evidence" | "unresolved-conflict" | "conflicted-claim";
    id: string;
    description: string;
  }>;
  generatedAt: string;
  hostModel: string;
};

export type Screen03BriefingProposal = {
  schemaVersion: typeof SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION;
  proposalId: string;
  contentHash: string;
  content: Screen03BriefingContent;
  provenance: Screen03BriefingProposalProvenance;
};

export type Screen03BriefingDecision = {
  schemaVersion: typeof SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION;
  decisionId: string;
  proposalId: string;
  action: "confirm" | "revise" | "reject";
  reason: string;
  decidedAt: string;
  contentHash: string | null;
  content: Screen03BriefingContent | null;
};

export type Screen03ConfirmedBriefing = {
  proposalId: string;
  decisionId: string;
  contentHash: string;
  content: Screen03BriefingContent;
  confirmedAt: string;
};

export type Screen03BriefingLifecycle = {
  schemaVersion: typeof SCREEN_03_BRIEFING_LIFECYCLE_SCHEMA_VERSION;
  safeRunRef: string;
  proposals: Screen03BriefingProposal[];
  decisions: Screen03BriefingDecision[];
  activeProposalId: string | null;
  confirmed: Screen03ConfirmedBriefing | null;
  confirmedIsCurrent: boolean;
};

const SAFE_RUN_REF = /^s3ref_[A-Za-z0-9_-]{43,128}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
const FINGERPRINT = /^fnv1a64:[0-9a-f]{16}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})Z$/;
const HOST_MODEL = /^(?:host_model_not_exposed|[A-Za-z0-9][A-Za-z0-9 ._:/()-]{0,119})$/;
const MAX_PROPOSALS = 8;
const MAX_DECISIONS = 16;
const MAX_SECTION = 1_600;
const MAX_TOTAL_CONTENT = 16_000;
const MAX_EVIDENCE_IDS_PER_SECTION = 12;
const MAX_UNCERTAINTIES = 16;
const MAX_MISSING_EVIDENCE_ACKNOWLEDGEMENTS = 8;
const MAX_CONFLICT_ACKNOWLEDGEMENTS = 24;

const contentKeys = [
  "schemaVersion",
  "briefingStatus",
  "title",
  "oneSentenceSummary",
  "whatTheShockIs",
  "whatChanged",
  "whyItMatters",
  "whoIsAffected",
  "eligibilityThresholdsAndExemptions",
  "importantTimingAndTreatmentStages",
  "enforcementAndPenalties",
  "laterChanges",
  "plausiblePathwayToResearcherOutcome",
  "unresolvedUncertainties",
  "acknowledgedMissingEvidenceIds",
  "acknowledgedConflictIds",
  "sectionEvidenceIds",
  "conciseRationale",
  "hostModel",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function canonicalIso(value: unknown): value is string {
  return typeof value === "string" && ISO.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function boundedPlainText(value: unknown, maximum: number): value is string {
  if (
    typeof value !== "string" || value.length < 1 || value.length > maximum ||
    value.trim() !== value || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ||
    /<\/?[A-Za-z][^>]*>/u.test(value) || /(?:javascript|data|vbscript):/iu.test(value) ||
    /\[(?:[^\]]+)\]\((?:[^)]+)\)/u.test(value)
  ) {
    return false;
  }
  return value.normalize("NFKC") === value;
}

function stringIds(
  value: unknown,
  maximum: number,
  pattern = IDENTIFIER,
): value is string[] {
  return Array.isArray(value) && value.length <= maximum &&
    value.every((item) => typeof item === "string" && pattern.test(item)) &&
    new Set(value).size === value.length;
}

function clone<T>(value: T): T {
  return JSON.parse(serializeDeterministicJson(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child, seen);
    }
  }
  return value;
}

export function isScreen03SafeRunRef(value: unknown): value is string {
  return typeof value === "string" && SAFE_RUN_REF.test(value);
}

export function restoreScreen03BriefingContent(
  value: unknown,
): Screen03BriefingContent | null {
  if (!isRecord(value) || !exact(value, contentKeys)) return null;
  if (
    value.schemaVersion !== SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION ||
    !screen03BriefingStatuses.includes(value.briefingStatus as Screen03BriefingStatus) ||
    !boundedPlainText(value.title, 240) ||
    !boundedPlainText(value.oneSentenceSummary, 600) ||
    !boundedPlainText(value.whatTheShockIs, MAX_SECTION) ||
    !boundedPlainText(value.whatChanged, MAX_SECTION) ||
    !boundedPlainText(value.whyItMatters, MAX_SECTION) ||
    !boundedPlainText(value.whoIsAffected, MAX_SECTION) ||
    !boundedPlainText(value.eligibilityThresholdsAndExemptions, MAX_SECTION) ||
    !boundedPlainText(value.importantTimingAndTreatmentStages, MAX_SECTION) ||
    !boundedPlainText(value.enforcementAndPenalties, MAX_SECTION) ||
    !boundedPlainText(value.laterChanges, MAX_SECTION) ||
    !boundedPlainText(value.plausiblePathwayToResearcherOutcome, MAX_SECTION) ||
    !Array.isArray(value.unresolvedUncertainties) ||
    value.unresolvedUncertainties.length > MAX_UNCERTAINTIES ||
    !value.unresolvedUncertainties.every((item) => boundedPlainText(item, 600)) ||
    new Set(value.unresolvedUncertainties).size !== value.unresolvedUncertainties.length ||
    !stringIds(
      value.acknowledgedMissingEvidenceIds,
      MAX_MISSING_EVIDENCE_ACKNOWLEDGEMENTS,
    ) ||
    !stringIds(
      value.acknowledgedConflictIds,
      MAX_CONFLICT_ACKNOWLEDGEMENTS,
    ) ||
    !boundedPlainText(value.conciseRationale, 600) ||
    typeof value.hostModel !== "string" || !HOST_MODEL.test(value.hostModel) ||
    !isRecord(value.sectionEvidenceIds) ||
    !exact(value.sectionEvidenceIds, screen03BriefingFactualSectionKeys)
  ) {
    return null;
  }
  for (const key of screen03BriefingFactualSectionKeys) {
    if (!stringIds(value.sectionEvidenceIds[key], MAX_EVIDENCE_IDS_PER_SECTION)) {
      return null;
    }
  }
  if (serializeDeterministicJson(value).length > MAX_TOTAL_CONTENT) return null;
  return deepFreeze(clone(value) as Screen03BriefingContent);
}

function restoreProposal(value: unknown): Screen03BriefingProposal | null {
  if (
    !isRecord(value) ||
    !exact(value, ["schemaVersion", "proposalId", "contentHash", "content", "provenance"]) ||
    value.schemaVersion !== SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION ||
    typeof value.proposalId !== "string" || !IDENTIFIER.test(value.proposalId) ||
    typeof value.contentHash !== "string" || !DIGEST.test(value.contentHash)
  ) return null;
  const content = restoreScreen03BriefingContent(value.content);
  if (!content || !isRecord(value.provenance)) return null;
  const provenanceKeys = [
    "origin",
    "briefingSchemaVersion",
    "skillVersion",
    "workflowVersion",
    "packetId",
    "packetHash",
    "eventFingerprint",
    "sourceRevision",
    "sourceStateFingerprint",
    "evidenceIds",
    "generatedAt",
    "hostModel",
  ];
  const hasEvidenceSnapshot = Object.hasOwn(value.provenance, "evidenceSnapshot");
  const hasUncertaintySnapshot = Object.hasOwn(
    value.provenance,
    "uncertaintySnapshot",
  );
  if (!exact(value.provenance, [
    ...provenanceKeys,
    ...(hasEvidenceSnapshot ? ["evidenceSnapshot"] : []),
    ...(hasUncertaintySnapshot ? ["uncertaintySnapshot"] : []),
  ])) return null;
  const provenance = value.provenance;
  if (
    provenance.origin !== "chatgpt_host" ||
    provenance.briefingSchemaVersion !== SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION ||
    provenance.skillVersion !== SCREEN_03_BRIEFING_SKILL_VERSION ||
    provenance.workflowVersion !== SCREEN_03_BRIEFING_WORKFLOW_VERSION ||
    typeof provenance.packetId !== "string" || provenance.packetId.length < 1 ||
    provenance.packetId.length > 8_000 ||
    typeof provenance.packetHash !== "string" || !DIGEST.test(provenance.packetHash) ||
    typeof provenance.eventFingerprint !== "string" || !FINGERPRINT.test(provenance.eventFingerprint) ||
    !Number.isSafeInteger(provenance.sourceRevision) ||
    (provenance.sourceRevision as number) < 0 ||
    typeof provenance.sourceStateFingerprint !== "string" ||
    !FINGERPRINT.test(provenance.sourceStateFingerprint) ||
    !stringIds(provenance.evidenceIds, 40) ||
    !canonicalIso(provenance.generatedAt) ||
    provenance.hostModel !== content.hostModel
  ) return null;
  if (hasEvidenceSnapshot) {
    if (!Array.isArray(provenance.evidenceSnapshot) ||
      provenance.evidenceSnapshot.length > 8) return null;
    const snapshotIds = new Set<string>();
    for (const item of provenance.evidenceSnapshot) {
      if (!isRecord(item) || !exact(item, [
        "evidenceId", "sourceId", "title", "authority", "authorityTier",
        "publishedDate", "permittedLink", "language", "reviewStatus",
        "passageIds",
      ]) || typeof item.evidenceId !== "string" || !IDENTIFIER.test(item.evidenceId) ||
        snapshotIds.has(item.evidenceId) ||
        (item.sourceId !== null && !boundedPlainText(item.sourceId, 600)) ||
        !boundedPlainText(item.title, 600) ||
        !boundedPlainText(item.authority, 600) ||
        !Number.isSafeInteger(item.authorityTier) ||
        (item.authorityTier as number) < 1 || (item.authorityTier as number) > 6 ||
        (item.publishedDate !== null && !boundedPlainText(item.publishedDate, 40)) ||
        (item.permittedLink !== null &&
          (!boundedPlainText(item.permittedLink, 2_048) ||
            !item.permittedLink.startsWith("https://"))) ||
        !boundedPlainText(item.language, 80) ||
        !["carried", "retrieved"].includes(item.reviewStatus as string) ||
        !stringIds(item.passageIds, 50)) return null;
      snapshotIds.add(item.evidenceId);
    }
    if ((provenance.evidenceIds as string[]).some((id) => !snapshotIds.has(id))) {
      return null;
    }
  }
  if (hasUncertaintySnapshot) {
    if (!Array.isArray(provenance.uncertaintySnapshot) ||
      provenance.uncertaintySnapshot.length > 32) return null;
    const uncertaintyKeys = new Set<string>();
    for (const item of provenance.uncertaintySnapshot) {
      if (!isRecord(item) || !exact(item, ["kind", "id", "description"]) ||
        ![
          "missing-evidence",
          "unresolved-conflict",
          "conflicted-claim",
        ].includes(item.kind as string) ||
        typeof item.id !== "string" || !IDENTIFIER.test(item.id) ||
        !boundedPlainText(item.description, 600)) return null;
      const key = `${item.kind}:${item.id}`;
      if (uncertaintyKeys.has(key)) return null;
      uncertaintyKeys.add(key);
    }
  }
  return deepFreeze(clone(value) as Screen03BriefingProposal);
}

function restoreDecision(value: unknown): Screen03BriefingDecision | null {
  if (
    !isRecord(value) || !exact(value, [
      "schemaVersion",
      "decisionId",
      "proposalId",
      "action",
      "reason",
      "decidedAt",
      "contentHash",
      "content",
    ]) || value.schemaVersion !== SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION ||
    typeof value.decisionId !== "string" || !IDENTIFIER.test(value.decisionId) ||
    typeof value.proposalId !== "string" || !IDENTIFIER.test(value.proposalId) ||
    !["confirm", "revise", "reject"].includes(value.action as string) ||
    !boundedPlainText(value.reason, 1_000) || !canonicalIso(value.decidedAt)
  ) return null;
  if (value.action === "reject") {
    if (value.content !== null || value.contentHash !== null) return null;
  } else {
    if (typeof value.contentHash !== "string" || !DIGEST.test(value.contentHash) ||
      !restoreScreen03BriefingContent(value.content)) return null;
  }
  return deepFreeze(clone(value) as Screen03BriefingDecision);
}

export function restoreScreen03BriefingLifecycle(
  value: unknown,
): Screen03BriefingLifecycle | null {
  if (
    !isRecord(value) || !exact(value, [
      "schemaVersion",
      "safeRunRef",
      "proposals",
      "decisions",
      "activeProposalId",
      "confirmed",
      "confirmedIsCurrent",
    ]) || value.schemaVersion !== SCREEN_03_BRIEFING_LIFECYCLE_SCHEMA_VERSION ||
    !isScreen03SafeRunRef(value.safeRunRef) ||
    !Array.isArray(value.proposals) || value.proposals.length > MAX_PROPOSALS ||
    !Array.isArray(value.decisions) || value.decisions.length > MAX_DECISIONS ||
    typeof value.confirmedIsCurrent !== "boolean"
  ) return null;
  const proposals = value.proposals.map(restoreProposal);
  const decisions = value.decisions.map(restoreDecision);
  if (proposals.some((item) => item === null) || decisions.some((item) => item === null)) {
    return null;
  }
  const typedProposals = proposals as Screen03BriefingProposal[];
  const typedDecisions = decisions as Screen03BriefingDecision[];
  const proposalIds = new Set(typedProposals.map((item) => item.proposalId));
  const decisionIds = new Set(typedDecisions.map((item) => item.decisionId));
  if (
    proposalIds.size !== typedProposals.length || decisionIds.size !== typedDecisions.length ||
    typedDecisions.some((item) => !proposalIds.has(item.proposalId)) ||
    (value.activeProposalId !== null &&
      (typeof value.activeProposalId !== "string" || !proposalIds.has(value.activeProposalId)))
  ) return null;
  if (value.confirmed !== null) {
    if (!isRecord(value.confirmed) || !exact(value.confirmed, [
      "proposalId",
      "decisionId",
      "contentHash",
      "content",
      "confirmedAt",
    ])) return null;
    const confirmed = value.confirmed;
    const decision = typedDecisions.find((item) =>
      item.decisionId === confirmed.decisionId
    );
    const content = restoreScreen03BriefingContent(confirmed.content);
    if (
      typeof confirmed.proposalId !== "string" ||
      typeof confirmed.decisionId !== "string" ||
      typeof confirmed.contentHash !== "string" || !DIGEST.test(confirmed.contentHash) ||
      !canonicalIso(confirmed.confirmedAt) || !content || !decision ||
      !proposalIds.has(confirmed.proposalId) ||
      decision.action === "reject" || decision.proposalId !== confirmed.proposalId ||
      decision.contentHash !== confirmed.contentHash ||
      serializeDeterministicJson(decision.content) !== serializeDeterministicJson(content) ||
      decision.decidedAt !== confirmed.confirmedAt
    ) return null;
  }
  if (
    (value.confirmed === null && value.confirmedIsCurrent) ||
    (value.confirmedIsCurrent && value.activeProposalId === null)
  ) return null;
  return deepFreeze(clone(value) as Screen03BriefingLifecycle);
}

export function createScreen03BriefingLifecycle(
  safeRunRef: string,
): Screen03BriefingLifecycle {
  if (!isScreen03SafeRunRef(safeRunRef)) {
    throw new Error("Screen 3 briefing safe run reference is invalid.");
  }
  return deepFreeze({
    schemaVersion: SCREEN_03_BRIEFING_LIFECYCLE_SCHEMA_VERSION,
    safeRunRef,
    proposals: [],
    decisions: [],
    activeProposalId: null,
    confirmed: null,
    confirmedIsCurrent: false,
  });
}

export function addScreen03BriefingProposal(
  lifecycleValue: Screen03BriefingLifecycle,
  proposalValue: Screen03BriefingProposal,
): { lifecycle: Screen03BriefingLifecycle; duplicate: boolean } {
  const lifecycle = restoreScreen03BriefingLifecycle(lifecycleValue);
  const proposal = restoreProposal(proposalValue);
  if (!lifecycle || !proposal) {
    throw new Error("Screen 3 briefing proposal failed its exact contract.");
  }
  const sameIdentifier = lifecycle.proposals.find((item) =>
    item.proposalId === proposal.proposalId
  );
  if (sameIdentifier) {
    if (serializeDeterministicJson(sameIdentifier) !== serializeDeterministicJson(proposal)) {
      throw new Error("A Screen 3 briefing proposal identifier cannot be rewritten.");
    }
    return { lifecycle, duplicate: true };
  }
  const samePacketAndContent = lifecycle.proposals.find((item) =>
    item.contentHash === proposal.contentHash &&
    item.provenance.packetHash === proposal.provenance.packetHash
  );
  if (samePacketAndContent) return { lifecycle, duplicate: true };
  if (lifecycle.proposals.length >= MAX_PROPOSALS) {
    throw new Error("Screen 3 briefing proposal history is full.");
  }
  const next = restoreScreen03BriefingLifecycle({
    ...lifecycle,
    proposals: [...lifecycle.proposals, proposal],
    activeProposalId: proposal.proposalId,
  });
  if (!next) throw new Error("Screen 3 briefing proposal integration failed.");
  return { lifecycle: next, duplicate: false };
}

export function addScreen03BriefingDecision(
  lifecycleValue: Screen03BriefingLifecycle,
  decisionValue: Screen03BriefingDecision,
): { lifecycle: Screen03BriefingLifecycle; duplicate: boolean } {
  const lifecycle = restoreScreen03BriefingLifecycle(lifecycleValue);
  const decision = restoreDecision(decisionValue);
  if (!lifecycle || !decision) {
    throw new Error("Screen 3 briefing decision failed its exact contract.");
  }
  const proposal = lifecycle.proposals.find((item) => item.proposalId === decision.proposalId);
  if (!proposal) throw new Error("Screen 3 briefing decision targets an unknown proposal.");
  const duplicate = lifecycle.decisions.find((item) => item.decisionId === decision.decisionId);
  if (duplicate) {
    if (serializeDeterministicJson(duplicate) !== serializeDeterministicJson(decision)) {
      throw new Error("A Screen 3 briefing decision identifier cannot be rewritten.");
    }
    return { lifecycle, duplicate: true };
  }
  if (lifecycle.decisions.length >= MAX_DECISIONS) {
    throw new Error("Screen 3 briefing decision history is full.");
  }
  if (decision.action === "confirm" && decision.contentHash !== proposal.contentHash) {
    throw new Error("A confirmation must preserve the original proposal content.");
  }
  if (decision.action === "confirm" &&
    serializeDeterministicJson(decision.content) !== serializeDeterministicJson(proposal.content)) {
    throw new Error("A confirmation must preserve the original proposal content.");
  }
  const confirmed = decision.action === "reject"
    ? lifecycle.confirmed
    : {
        proposalId: decision.proposalId,
        decisionId: decision.decisionId,
        contentHash: decision.contentHash!,
        content: decision.content!,
        confirmedAt: decision.decidedAt,
      };
  const next = restoreScreen03BriefingLifecycle({
    ...lifecycle,
    decisions: [...lifecycle.decisions, decision],
    activeProposalId: decision.action === "reject"
      ? lifecycle.confirmedIsCurrent
        ? lifecycle.confirmed?.proposalId ?? null
        : null
      : decision.proposalId,
    confirmed,
    confirmedIsCurrent: decision.action === "reject"
      ? lifecycle.confirmedIsCurrent
      : true,
  });
  if (!next) throw new Error("Screen 3 briefing decision integration failed.");
  return { lifecycle: next, duplicate: false };
}

/** Preserve audit history while making pre-change prose visibly noncurrent. */
export function markScreen03BriefingFactsStale(
  lifecycleValue: Screen03BriefingLifecycle,
): Screen03BriefingLifecycle {
  const lifecycle = restoreScreen03BriefingLifecycle(lifecycleValue);
  if (!lifecycle) {
    throw new Error("Screen 3 briefing lifecycle failed its exact contract.");
  }
  if (lifecycle.activeProposalId === null && !lifecycle.confirmedIsCurrent) {
    return lifecycle;
  }
  const stale = restoreScreen03BriefingLifecycle({
    ...lifecycle,
    activeProposalId: null,
    confirmedIsCurrent: false,
  });
  if (!stale) throw new Error("Screen 3 briefing currentness invalidation failed.");
  return stale;
}
