import {
  SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
  fingerprintScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "./screen02-workflow-handoff";
import {
  screen02DateLeadStages,
  isScreen02ContextLead,
  isFreshScreen02SelectionQualification,
  screen02AssessmentUnavailableScreen03Checks,
  type Screen02ContextLead,
  type Screen02DateLeadStage,
  type Screen02EventIdentity,
  type Screen02WorkflowSourceAuthorityTier,
} from "./screen02-workflow-types";
import { serializeDeterministicJson } from "./screen02-deterministic-json";
import { fingerprintScreen02WorkflowValue } from "./screen02-workflow-state";
import {
  assembleScreen02ShockGlanceFromHandoff,
  requireScreen02ShockGlance,
  type Screen02ShockGlance,
} from "./screen02-shock-glance";
import { isCalendarDate, unambiguousCalendarDate } from "./calendar-date";
import {
  addScreen03BriefingDecision,
  addScreen03BriefingProposal,
  createScreen03BriefingLifecycle,
  markScreen03BriefingFactsStale,
  restoreScreen03BriefingLifecycle,
  screen03BriefingFactualSectionKeys,
  type Screen03BriefingDecision,
  type Screen03BriefingLifecycle,
  type Screen03BriefingProposal,
} from "./screen03-briefing";

/** Product release labels; the v030 workflow contract remains stable. */
export const SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL = "v0.3.00" as const;
export const SHOCKAUDIT_V031_RELEASE_LABEL = "v0.3.01" as const;
export const SHOCKAUDIT_V032_RELEASE_LABEL = "v0.3.02" as const;
export const SHOCKAUDIT_V033_RELEASE_LABEL = "v0.3.03" as const;
export const SHOCKAUDIT_V034_RELEASE_LABEL = "v0.3.04" as const;
export const SHOCKAUDIT_V035_RELEASE_LABEL = "v0.3.05" as const;
export const SHOCKAUDIT_V036_RELEASE_LABEL = "v0.3.06" as const;
export const SHOCKAUDIT_V037_RELEASE_LABEL = "v0.3.07" as const;
export const SHOCKAUDIT_V038_RELEASE_LABEL = "v0.3.08" as const;
export const SHOCKAUDIT_V039_RELEASE_LABEL = "v0.3.09" as const;
export const SHOCKAUDIT_V0310_RELEASE_LABEL = "v0.3.10" as const;
export const SHOCKAUDIT_V0311_RELEASE_LABEL = "v0.3.11" as const;
export const SHOCKAUDIT_V0312_RELEASE_LABEL = "v0.3.12" as const;
export const SHOCKAUDIT_V0313_RELEASE_LABEL = "v0.3.13" as const;
export const SHOCKAUDIT_V0314_RELEASE_LABEL = "v0.3.14" as const;
export const SHOCKAUDIT_V0315_RELEASE_LABEL = "v0.3.15" as const;
export const SHOCKAUDIT_V0316_RELEASE_LABEL = "v0.3.16" as const;
export const SHOCKAUDIT_V0317_RELEASE_LABEL = "v0.3.17" as const;
/** @deprecated Use SHOCKAUDIT_V0317_RELEASE_LABEL for newly created state. */
export const SHOCKAUDIT_V030_RELEASE_LABEL = SHOCKAUDIT_V0317_RELEASE_LABEL;
export type Screen03ReleaseLabel =
  | typeof SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL
  | typeof SHOCKAUDIT_V031_RELEASE_LABEL
  | typeof SHOCKAUDIT_V032_RELEASE_LABEL
  | typeof SHOCKAUDIT_V033_RELEASE_LABEL
  | typeof SHOCKAUDIT_V034_RELEASE_LABEL
  | typeof SHOCKAUDIT_V035_RELEASE_LABEL
  | typeof SHOCKAUDIT_V036_RELEASE_LABEL
  | typeof SHOCKAUDIT_V037_RELEASE_LABEL
  | typeof SHOCKAUDIT_V038_RELEASE_LABEL
  | typeof SHOCKAUDIT_V039_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0310_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0311_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0312_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0313_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0314_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0315_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0316_RELEASE_LABEL
  | typeof SHOCKAUDIT_V0317_RELEASE_LABEL;
export const SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION =
  "screen-03-verification-state-v1" as const;
export const SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION =
  "screen-03-research-packet-v1" as const;
export const SCREEN_03_INTERPRETATION_PROTOCOL_VERSION =
  "screen-03-interpretation-v1" as const;
export const SCREEN_03_ORIENTATION_STATE_SCHEMA_VERSION =
  "screen-03-orientation-state-v1" as const;

export const screen03ProposalGroups = [
  "identity",
  "overview",
  "timeline",
  "component",
  "eligibility",
  "amendment",
  "required-variable",
] as const;
export type Screen03ProposalGroup = (typeof screen03ProposalGroups)[number];

export const screen03ReviewStatuses = [
  "proposed",
  "accepted",
  "edited",
  "rejected",
  "unresolved",
] as const;
export type Screen03ReviewStatus = (typeof screen03ReviewStatuses)[number];

export const screen03SupportStatuses = [
  "direct",
  "indirect",
  "conflicting",
  "unsupported",
] as const;
export type Screen03SupportStatus = (typeof screen03SupportStatuses)[number];

/**
 * Evidence provenance is deliberately more specific than proposal support.
 * The original three values remain valid so retained v1 packets and workflow
 * states restore without a schema rewrite.
 */
export const screen03PassageBases = [
  "source-excerpt",
  "official-record-field",
  "official-document-passage",
  "official-guidance-passage",
  "contextual-secondary",
  "source-metadata",
] as const;
export type Screen03PassageBasis = (typeof screen03PassageBases)[number];

export const screen03OfficialFields = [
  "canonical-title",
  "common-name",
  "formal-identifier",
  "issuer",
  "issuing-jurisdiction",
  "status",
  "event-type",
] as const;
export type Screen03OfficialField = (typeof screen03OfficialFields)[number];

/**
 * Typed source provenance used by every newly assembled evidence item. The
 * optional evidence fields below preserve strict restoration of historical
 * v1 records, whose source role existed only inside the human-readable
 * `channel` string.
 */
export const screen03EvidenceSourceRoles = [
  "controlling-legal-record",
  "precursor-official-record",
  "related-official-record",
  "official-publication-record",
  "administrative-declaration-record",
  "scientific-hazard-record",
  "institutional-hazard-record",
  "official-record",
  "related-secondary-record",
  "researcher-supplied-record",
] as const;
export type Screen03EvidenceSourceRole =
  (typeof screen03EvidenceSourceRoles)[number];

export const screen03SourcePlatforms = [
  "federal-register",
  "govinfo",
  "congress",
  "us-state-official",
  "eur-lex",
  "eu-publications",
  "uk-legislation",
  "national-legislation",
  "regulatory-agency",
  "official-disaster-repository",
  "secondary-publisher",
  "researcher-supplied",
  "other-official",
  "unknown",
] as const;
export type Screen03SourcePlatform = (typeof screen03SourcePlatforms)[number];

export const screen03DocumentTypes = [
  "structured-metadata",
  "html",
  "xml",
  "json",
  "pdf",
  "plain-text",
  "official-guidance",
  "unknown",
] as const;
export type Screen03DocumentType = (typeof screen03DocumentTypes)[number];

export type Screen03Passage = {
  id: string;
  number: number;
  text: string;
  locator: string | null;
  basis: Screen03PassageBasis;
  /** Absent on retained v1 evidence and null on non-field passages. */
  officialField?: Screen03OfficialField | null;
  /** Optional on retained v1 passages; new stale versions set both fields. */
  status?: "active" | "stale";
  contentFingerprint?: string;
};

/**
 * Structured official fields can settle identity only. Substantive claims
 * require an extractive passage. Contextual-secondary material and metadata
 * remain leads regardless of the publisher's authority tier.
 */
export function screen03PassageBasisProvidesDirectSupport(
  basis: Screen03PassageBasis,
  group: Screen03ProposalGroup,
) {
  if (basis === "official-record-field") return group === "identity";
  return basis === "source-excerpt" ||
    basis === "official-document-passage" ||
    basis === "official-guidance-passage";
}

function proposalOfficialField(
  proposal: Pick<Screen03AnyProposal, "group" | "label">,
) {
  const label = proposal.label.trim().toLocaleLowerCase("en-US");
  if (/^canonical (?:event )?title$/u.test(label)) return "canonical-title";
  if (/^(?:verified )?common names?$/u.test(label)) return "common-name";
  if (/^formal identifier$/u.test(label)) return "formal-identifier";
  if (/^(?:issuer|issuing authority)$/u.test(label)) return "issuer";
  if (/^issuing jurisdiction$/u.test(label)) return "issuing-jurisdiction";
  if (/^(?:current )?status$/u.test(label)) return "status";
  if (/^event type$/u.test(label)) return "event-type";
  return null;
}

export function screen03EvidenceItemProvidesAuthoritativeDirectSupport(
  evidence: Screen03EvidenceItem,
) {
  // No tier-3 exception exists until an adapter explicitly defines and tests
  // a qualifying official event-repository policy.
  if (evidence.status === "changed" || evidence.authorityTier > 2) return false;
  if (evidence.sourceRole !== undefined) {
    return ![
      "researcher-supplied-record",
      "related-secondary-record",
      "related-official-record",
      "precursor-official-record",
    ].includes(evidence.sourceRole);
  }
  // Historical v1 records did not carry typed sourceRole. Preserve their
  // prior classification without making this free-text fallback authoritative
  // for any newly assembled evidence.
  const channel = evidence.channel
    .normalize("NFKC")
    .toLocaleLowerCase("en-US");
  return !/(?:researcher|user)[ -]supplied|(?:source role:\s*)?(?:related (?:secondary|official)|precursor official) record|related formal identifier/u
    .test(channel);
}

function screen03EvidenceItemIsOfficialPrecursor(
  evidence: Screen03EvidenceItem,
) {
  if (evidence.status === "changed" || evidence.authorityTier > 2) return false;
  if (evidence.sourceRole !== undefined) {
    return evidence.sourceRole === "precursor-official-record";
  }
  return /(?:source role:\s*)?precursor official record/u.test(
    evidence.channel.normalize("NFKC").toLocaleLowerCase("en-US"),
  );
}

/**
 * A controlling official source can support any compatible factual claim. An
 * official precursor is deliberately narrower: it may establish only the
 * precursor announcement clock, never the selected event's identity,
 * operative components, later milestones, or host-proposed mappings.
 */
export function screen03EvidenceItemProvidesDirectSupportForProposal(
  evidence: Screen03EvidenceItem,
  proposal: Pick<Screen03AnyProposal, "group" | "label"> & {
    stage?: Screen02DateLeadStage;
  },
) {
  if (screen03EvidenceItemProvidesAuthoritativeDirectSupport(evidence)) {
    return true;
  }
  const timelineStage = proposal.stage ??
    proposal.label.trim().toLocaleLowerCase("en-US");
  return proposal.group === "timeline" &&
    timelineStage === "announcement" &&
    screen03EvidenceItemIsOfficialPrecursor(evidence);
}

export function screen03PassageProvidesDirectSupport(
  passage: Screen03Passage,
  proposal: Pick<Screen03AnyProposal, "group" | "label">,
) {
  if (passage.status === "stale") return false;
  if (!screen03PassageBasisProvidesDirectSupport(passage.basis, proposal.group)) {
    return false;
  }
  if (passage.basis !== "official-record-field") return true;
  const expectedField = proposalOfficialField(proposal);
  // Retained passages without a discriminator remain structurally valid but
  // are not silently promoted across identity fields.
  return passage.officialField !== undefined &&
    passage.officialField !== null &&
    passage.officialField === expectedField;
}

export type Screen03EvidenceItem = {
  id: string;
  sourceId: string | null;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  retrievedAt: string;
  authorityTier: Screen02WorkflowSourceAuthorityTier;
  channel: string;
  /** Present on all newly assembled evidence; absent only on retained v1. */
  sourceRole?: Screen03EvidenceSourceRole;
  /** Present on all newly assembled evidence; absent only on retained v1. */
  sourcePlatform?: Screen03SourcePlatform;
  /** Present on all newly assembled evidence; absent only on retained v1. */
  documentType?: Screen03DocumentType;
  contentFingerprint: string;
  language: string;
  status: "carried" | "retrieved" | "changed";
  passages: Screen03Passage[];
};

export type Screen03Proposal = {
  id: string;
  group: Exclude<Screen03ProposalGroup, "timeline">;
  label: string;
  value: string;
  critical: boolean;
  reviewStatus: Screen03ReviewStatus;
  editedValue: string | null;
  support: Screen03SupportStatus;
  sourceIds: string[];
  passageIds: string[];
  uncertainty: string | null;
};

export type Screen03TimelineProposal = {
  id: string;
  group: "timeline";
  label: string;
  value: string;
  critical: boolean;
  reviewStatus: Screen03ReviewStatus;
  editedValue: string | null;
  support: Screen03SupportStatus;
  sourceIds: string[];
  passageIds: string[];
  uncertainty: string | null;
  stage: Screen02DateLeadStage;
  date: string;
};

export type Screen03AnyProposal = Screen03Proposal | Screen03TimelineProposal;

/**
 * Immutable audit material retained whenever one logical source version stops
 * supporting the active review. `staleProposals` snapshot the exact prior
 * mappings and researcher dispositions; they are audit history, not active
 * proposals and therefore cannot be confirmed or locked.
 */
export type Screen03SourceChangeRecord = {
  id: string;
  historyEventId: string;
  sourceId: string;
  detectedAt: string;
  trigger: "mark-source-changed" | "research-refresh";
  previousContentFingerprints: string[];
  observedContentFingerprint: string | null;
  staleEvidenceIds: string[];
  stalePassageIds: string[];
  staleProposals: Screen03AnyProposal[];
  reopenedProposalIds: string[];
  reason: string;
};

export type Screen03DirectSupportSearchRecord = {
  id: string;
  proposalId: string;
  claimFingerprint: string;
  /**
   * Post-search claim/evidence binding. Older records may omit this field and
   * remain valid audit history, but they cannot be presented as current.
   */
  resultBindingFingerprint?: string;
  searchedAt: string;
  previousSupport: Screen03SupportStatus;
  resultingSupport: Screen03SupportStatus | null;
  resultingConfirmable: boolean;
  outcome:
    | "direct-support-found"
    | "no-direct-support-found"
    | "search-incomplete"
    | "claim-no-longer-active";
  evidenceIds: string[];
  passageIds: string[];
  queryIds: string[];
  note: string;
};

export type Screen03ProposalConfirmabilityReason =
  | "confirmable"
  | "no-direct-support"
  | "inactive-direct-support"
  | "incomplete-component"
  | "reviewed-value-not-supported";

export type Screen03ProposalConfirmability = {
  confirmable: true;
  reason: "confirmable";
} | {
  confirmable: false;
  reason: Exclude<Screen03ProposalConfirmabilityReason, "confirmable">;
};

export type Screen03HostEvidenceQuotedSpan = {
  passageId: string;
  start: number;
  end: number;
  text: string;
};

export type Screen03HostEvidenceMapping = {
  claimId: string;
  passageIds: string[];
  quotedSpans: Screen03HostEvidenceQuotedSpan[];
  status: "direct";
};

export type Screen03SupportedFact = {
  claimId: string;
  group: Screen03ProposalGroup;
  label: string;
  value: string;
  evidenceIds: string[];
  passageIds: string[];
};

export type Screen03ProposalGroups = {
  identity: Screen03Proposal[];
  overview: Screen03Proposal[];
  timeline: Screen03TimelineProposal[];
  component: Screen03Proposal[];
  eligibility: Screen03Proposal[];
  amendment: Screen03Proposal[];
  requiredVariable: Screen03Proposal[];
};

export type Screen03ResearchQuery = {
  id: string;
  query: string;
  purpose: string;
  returnedEvidenceIds: string[];
};

export type Screen03ResearchChannel = {
  channel: string;
  status: "searched" | "failed" | "not-searched";
  note: string;
  retrievedAt: string | null;
};

export type Screen03StoppingRule = {
  rule: string;
  status: "met" | "not-met";
  note: string;
};

export type Screen03ResearchCoverage = {
  status: "pending" | "completed" | "incomplete";
  queries: Screen03ResearchQuery[];
  channels: Screen03ResearchChannel[];
  routes: string[];
  stages: string[];
  languages: string[];
  authorityTiers: Screen02WorkflowSourceAuthorityTier[];
  gaps: string[];
  recordsReviewed: number;
  activeEvidenceCount: number;
  exhaustive: false;
  stoppingRule: Screen03StoppingRule;
  outcomeValuesInspected: false;
};

export type Screen03ResearchPacketCoverage = Omit<
  Screen03ResearchCoverage,
  "status"
>;

/**
 * Noncanonical, source-bound reader help. These blocks may explain the
 * verified evidence, but they never replace a proposal value and never enter
 * the locked Event Card.
 */
export type Screen03InterpretationBlock = {
  text: string;
  proposalIds: string[];
  passageIds: string[];
  evidenceIds: string[];
};

export type Screen03Interpretation = {
  protocolVersion: typeof SCREEN_03_INTERPRETATION_PROTOCOL_VERSION;
  origin: "chatgpt-host" | "workers-ai" | "screen02-reuse" | "unavailable";
  nonCanonical: true;
  studyContext: {
    population: string;
    geography: string;
    industry: string;
    studyPeriod: string;
    outcomeFamily: string;
  };
  snapshot: {
    intro: Screen03InterpretationBlock;
    keyPoints: Screen03InterpretationBlock[];
  };
  studyRelevance: {
    sampleConnection: Screen03InterpretationBlock;
    outcomeConnection: Screen03InterpretationBlock;
    caveat: string;
  };
  claimExplanations: Array<{
    proposalId: string;
    proposalFingerprint: string;
    text: string;
    passageIds: string[];
    evidenceIds: string[];
  }>;
  limitations: string[];
  outcomeValuesInspected: false;
};

export type Screen03OrientationRefinement = {
  id: string;
  at: string;
  decision:
    | "accept"
    | "edit"
    | "reject"
    | "unresolved"
    | "confirm-all"
    | "unconfirm-all"
    | "source-changed"
    | "contradiction-resolved"
    | "research-refreshed";
  proposalId: string | null;
  fieldsUsed: string[];
  reason: string;
  previousGlanceFingerprint: string;
  nextGlanceFingerprint: string;
};

/**
 * Preliminary reader orientation carried beside, never into, the verified
 * Event Card. `initial` is immutable provenance; fixed software may rebuild
 * `current` only from explicit Screen 3 review decisions.
 */
export type Screen03OrientationState = {
  schemaVersion: typeof SCREEN_03_ORIENTATION_STATE_SCHEMA_VERSION;
  upstreamEventFingerprint: string;
  initial: Screen02ShockGlance;
  current: Screen02ShockGlance;
  provenance:
    | "screen-02-preliminary"
    | "screen-02-qualified-preliminary"
    | "screen-03-reviewed";
  refinements: Screen03OrientationRefinement[];
};

export type Screen03Contradiction = {
  id: string;
  kind: "date-order" | "source-conflict" | "scope-conflict" | "other";
  proposalIds: string[];
  summary: string;
  status: "unresolved" | "resolved";
  resolution: string | null;
};

export type Screen03ResearchPacket = {
  protocolVersion: typeof SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION;
  researchedAt: string;
  upstreamEventFingerprint: string;
  coverage: Screen03ResearchPacketCoverage;
  contextLeads?: Screen02ContextLead[];
  interpretation?: Screen03Interpretation;
  evidence: Screen03EvidenceItem[];
  proposals: Screen03ProposalGroups;
  contradictions: Screen03Contradiction[];
  outcomeValuesInspected: false;
};

export type Screen03AuditEvent = {
  id: string;
  action:
    | "initialized"
    | "research-integrated"
    | "research-refreshed"
    | "context-refreshed"
    | "direct-support-searched"
    | "host-interpretation-integrated"
    | "host-evidence-mapping-applied"
    | "host-briefing-lifecycle-attached"
    | "host-briefing-proposed"
    | "host-briefing-confirmed"
    | "host-briefing-revised"
    | "host-briefing-rejected"
    | "orientation-attached"
    | "review-field"
    | "select-focal-clock"
    | "resolve-contradiction"
    | "mark-source-changed"
    | "lock-event-card";
  targetId: string | null;
  at: string;
  actor: "fixed-core" | "research-service" | "chatgpt-host" | "researcher";
  reason: string;
  value: string | null;
  previousReviewStatus: Screen03ReviewStatus | null;
  nextReviewStatus: Screen03ReviewStatus | null;
};

export type Screen03LockedAcceptedProposal = {
  id: string;
  group: Screen03ProposalGroup;
  label: string;
  proposedValue: string;
  resolvedValue: string;
  critical: boolean;
  decision: "accepted" | "edited";
  support: Screen03SupportStatus;
  sourceIds: string[];
  passageIds: string[];
  uncertainty: string | null;
  timeline: {
    stage: Screen02DateLeadStage;
    proposedDate: string;
    resolvedDate: string;
  } | null;
};

export type Screen03LockedAcceptedProposalGroups = {
  identity: Screen03LockedAcceptedProposal[];
  overview: Screen03LockedAcceptedProposal[];
  timeline: Screen03LockedAcceptedProposal[];
  component: Screen03LockedAcceptedProposal[];
  eligibility: Screen03LockedAcceptedProposal[];
  amendment: Screen03LockedAcceptedProposal[];
  requiredVariable: Screen03LockedAcceptedProposal[];
};

export type Screen03LockedReviewedProposal = {
  id: string;
  group: Screen03ProposalGroup;
  label: string;
  proposedValue: string;
  resolvedValue: string | null;
  critical: boolean;
  decision: Exclude<Screen03ReviewStatus, "proposed">;
  decisionReason: string;
  decidedAt: string;
  support: Screen03SupportStatus;
  sourceIds: string[];
  passageIds: string[];
  uncertainty: string | null;
  timeline: {
    stage: Screen02DateLeadStage;
    proposedDate: string;
    resolvedDate: string | null;
  } | null;
};

export type Screen03LockedReviewedProposalGroups = {
  identity: Screen03LockedReviewedProposal[];
  overview: Screen03LockedReviewedProposal[];
  timeline: Screen03LockedReviewedProposal[];
  component: Screen03LockedReviewedProposal[];
  eligibility: Screen03LockedReviewedProposal[];
  amendment: Screen03LockedReviewedProposal[];
  requiredVariable: Screen03LockedReviewedProposal[];
};

export type Screen03LockedTimelineEntry = {
  proposalId: string;
  label: string;
  stage: Screen02DateLeadStage;
  proposedDate: string;
  resolvedDate: string;
  sourceIds: string[];
  passageIds: string[];
};

export type Screen03ResolvedEventIdentity = {
  canonicalTitle: string | null;
  commonNames: string[];
  formalIdentifier: string | null;
  issuer: string | null;
  issuingJurisdiction: string | null;
  eventType: string | null;
  status: string | null;
  upstreamProvisionalIdentity: Screen02EventIdentity;
  fieldResolutions: Array<{
    proposalId: string;
    label: string;
    resolvedValue: string;
  }>;
};

export type Screen03LockedEventCard = {
  lockedAt: string;
  eventIdentity: Screen03ResolvedEventIdentity;
  acceptedProposals: Screen03LockedAcceptedProposalGroups;
  reviewedProposals: Screen03LockedReviewedProposalGroups;
  timeline: Screen03LockedTimelineEntry[];
  focalClock: {
    selected: Screen03LockedTimelineEntry | null;
    alternatives: Screen03LockedTimelineEntry[];
  };
  linkedEvidence: Screen03EvidenceItem[];
  contradictions: Screen03Contradiction[];
  limitations: {
    gaps: string[];
    unknownProposalIds: string[];
    rejectedProposalIds: string[];
    unsupportedProposalIds: string[];
    uncertainties: Array<{ proposalId: string; note: string }>;
  };
  researchCoverage: Screen03ResearchCoverage;
  outcomeValuesInspected: false;
  eventCardFingerprint: string;
};

export type Screen03VerificationState = {
  schemaVersion: typeof SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION;
  releaseLabel: Screen03ReleaseLabel;
  status: "loading" | "reviewing" | "locked";
  runId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  upstream: {
    schemaVersion: typeof SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION;
    runId: string;
    eventFingerprint: string;
    handoffFingerprint: string;
  };
  eventIdentity: Screen02EventIdentity;
  researchCoverage: Screen03ResearchCoverage;
  contextLeads?: Screen02ContextLead[];
  orientation?: Screen03OrientationState;
  interpretation?: Screen03Interpretation;
  briefing?: Screen03BriefingLifecycle;
  evidence: Screen03EvidenceItem[];
  /** Optional so retained v1 states restore without a schema rewrite. */
  sourceChanges?: Screen03SourceChangeRecord[];
  /** Optional so retained v1 states restore without a schema rewrite. */
  directSupportSearches?: Screen03DirectSupportSearchRecord[];
  proposals: Screen03ProposalGroups;
  contradictions: Screen03Contradiction[];
  focalClock: {
    selectedProposalId: string | null;
    alternativeProposalIds: string[];
  };
  history: Screen03AuditEvent[];
  lockedEventCard: Screen03LockedEventCard | null;
  outcomeValuesInspected: false;
  integrity: {
    stateFingerprint: string;
  };
};

export type Screen03State = Screen03VerificationState;

export type Screen03Action =
  | {
      type: "review-field";
      proposalId: string;
      decision: "accept" | "edit" | "reject" | "unresolved";
      editedValue?: string;
      reason: string;
      at: string;
    }
  | {
      type: "review-all-fields";
      mode: "confirm" | "unconfirm";
      reason: string;
      at: string;
    }
  | {
      type: "select-focal-clock";
      proposalId: string;
      alternativeProposalIds: string[];
      reason: string;
      at: string;
    }
  | {
      type: "mark-source-changed";
      sourceId: string;
      contentFingerprint: string;
      reason: string;
      at: string;
    }
  | {
      type: "resolve-contradiction";
      contradictionId: string;
      resolution: string;
      reason: string;
      at: string;
    }
  | {
      type: "lock-event-card";
      reason: string;
      at: string;
    };

const ROOT_KEYS = [
  "schemaVersion",
  "releaseLabel",
  "status",
  "runId",
  "revision",
  "createdAt",
  "updatedAt",
  "upstream",
  "eventIdentity",
  "researchCoverage",
  "evidence",
  "proposals",
  "contradictions",
  "focalClock",
  "history",
  "lockedEventCard",
  "outcomeValuesInspected",
  "integrity",
] as const;
const PACKET_KEYS = [
  "protocolVersion",
  "researchedAt",
  "upstreamEventFingerprint",
  "coverage",
  "evidence",
  "proposals",
  "contradictions",
  "outcomeValuesInspected",
] as const;
const COVERAGE_KEYS = [
  "queries",
  "channels",
  "routes",
  "stages",
  "languages",
  "authorityTiers",
  "gaps",
  "recordsReviewed",
  "activeEvidenceCount",
  "exhaustive",
  "stoppingRule",
  "outcomeValuesInspected",
] as const;
const GROUP_KEYS = [
  "identity",
  "overview",
  "timeline",
  "component",
  "eligibility",
  "amendment",
  "requiredVariable",
] as const;
const PROPOSAL_KEYS = [
  "id",
  "group",
  "label",
  "value",
  "critical",
  "reviewStatus",
  "editedValue",
  "support",
  "sourceIds",
  "passageIds",
  "uncertainty",
] as const;
const TIMELINE_PROPOSAL_KEYS = [...PROPOSAL_KEYS, "stage", "date"] as const;
const EVIDENCE_KEYS = [
  "id",
  "sourceId",
  "title",
  "locator",
  "publisher",
  "publishedDate",
  "retrievedAt",
  "authorityTier",
  "channel",
  "contentFingerprint",
  "language",
  "status",
  "passages",
] as const;

const MAX_RESEARCH_PACKET_EVIDENCE = 50;
const MAX_CONTEXT_LEADS = 5;
const MAX_CARRIED_HANDOFF_EVIDENCE = 100;
const MAX_RESEARCH_EVIDENCE_ADDITIONS = 5;
const MAX_STALE_EVIDENCE_VERSIONS = 20;
const MAX_ACTIVE_STATE_EVIDENCE =
  MAX_CARRIED_HANDOFF_EVIDENCE + MAX_RESEARCH_EVIDENCE_ADDITIONS;
const MAX_STATE_EVIDENCE = MAX_ACTIVE_STATE_EVIDENCE +
  MAX_STALE_EVIDENCE_VERSIONS;
const MAX_PASSAGES_PER_EVIDENCE = 50;
const MAX_PROPOSALS_PER_GROUP = 50;
const MAX_HISTORY = 400;
const MAX_CONTRADICTIONS = 80;
const MAX_LIST = 80;
const MAX_INTERPRETATION_KEY_POINTS = 6;
const MAX_CARRIED_PROPOSAL_REFERENCES = 100;
const MAX_SHORT = 600;
const MAX_LONG = 4_000;
const MAX_LOCATOR = 2_048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function assertContextLeads(
  value: unknown,
  label: string,
): asserts value is Screen02ContextLead[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_CONTEXT_LEADS ||
    value.some((lead) => !isScreen02ContextLead(lead))
  ) {
    fail(`${label} is invalid.`);
  }
  const leads = value as Screen02ContextLead[];
  if (new Set(leads.map((lead) => lead.id)).size !== leads.length) {
    fail(`${label} contains duplicate leads.`);
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, i) => key === wanted[i]);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object.`);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string) {
  if (!hasExactKeys(value, keys)) fail(`${label} has unsupported fields.`);
}

function assertString(value: unknown, label: string, max = MAX_SHORT): asserts value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > max) {
    fail(`${label} must be a bounded, trimmed string.`);
  }
}

function assertNullableString(value: unknown, label: string, max = MAX_SHORT): asserts value is string | null {
  if (value !== null) assertString(value, label, max);
}

function assertStringArray(value: unknown, label: string, max = MAX_LIST): asserts value is string[] {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be a bounded array.`);
  const unique = new Set<string>();
  for (const item of value) {
    assertString(item, label);
    if (unique.has(item)) fail(`${label} must not contain duplicates.`);
    unique.add(item);
  }
}

function assertUtcTimestamp(value: unknown, label: string): asserts value is string {
  assertString(value, label, 40);
  if (new Date(value).toISOString() !== value) fail(`${label} must be a canonical UTC timestamp.`);
}

function assertCalendarDate(value: unknown, label: string): asserts value is string {
  if (!isCalendarDate(value)) fail(`${label} must be a real YYYY-MM-DD calendar date.`);
}

function assertPublishedDate(value: unknown, label: string): asserts value is string | null {
  if (value === null) return;
  if (typeof value !== "string" || value.length > 40 || value.trim() !== value || value.length === 0) {
    fail(`${label} must be null or a bounded date string.`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) assertCalendarDate(value, label);
}

function assertFingerprint(value: unknown, label: string): asserts value is string {
  assertString(value, label, 100);
  if (!/^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/.test(value)) {
    fail(`${label} must be a supported content fingerprint.`);
  }
}

function clone<T>(value: T): T {
  serializeDeterministicJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
  }
  return value;
}

export function fingerprintScreen03Value(value: unknown) {
  return fingerprintScreen02WorkflowValue(value);
}

function assertEventIdentity(value: unknown, label: string): asserts value is Screen02EventIdentity {
  assertRecord(value, label);
  assertExactKeys(value, [
    "canonicalTitle",
    "commonNames",
    "formalIdentifier",
    "issuer",
    "issuingJurisdiction",
    "eventType",
    "status",
  ], label);
  assertString(value.canonicalTitle, `${label}.canonicalTitle`);
  assertStringArray(value.commonNames, `${label}.commonNames`, 20);
  assertNullableString(value.formalIdentifier, `${label}.formalIdentifier`);
  assertNullableString(value.issuer, `${label}.issuer`);
  assertNullableString(value.issuingJurisdiction, `${label}.issuingJurisdiction`);
  assertString(value.eventType, `${label}.eventType`);
  assertNullableString(value.status, `${label}.status`);
}

function assertPassages(value: unknown, label: string): asserts value is Screen03Passage[] {
  if (!Array.isArray(value) || value.length > MAX_PASSAGES_PER_EVIDENCE) fail(`${label} must be bounded.`);
  const ids = new Set<string>();
  value.forEach((item, index) => {
    assertRecord(item, `${label}[${index}]`);
    const hasOfficialField = Object.prototype.hasOwnProperty.call(
      item,
      "officialField",
    );
    const hasStatus = Object.prototype.hasOwnProperty.call(item, "status");
    const hasContentFingerprint = Object.prototype.hasOwnProperty.call(
      item,
      "contentFingerprint",
    );
    assertExactKeys(
      item,
      [
        "id",
        "number",
        "text",
        "locator",
        "basis",
        ...(hasOfficialField ? ["officialField"] : []),
        ...(hasStatus ? ["status"] : []),
        ...(hasContentFingerprint ? ["contentFingerprint"] : []),
      ],
      `${label}[${index}]`,
    );
    assertString(item.id, `${label}[${index}].id`);
    if (ids.has(item.id)) fail(`${label} passage IDs must be unique.`);
    ids.add(item.id);
    if (item.number !== index + 1) fail(`${label} passages must be consecutively numbered.`);
    assertString(item.text, `${label}[${index}].text`, MAX_LONG);
    assertNullableString(item.locator, `${label}[${index}].locator`, MAX_LOCATOR);
    if (!screen03PassageBases.includes(item.basis as Screen03PassageBasis)) fail(`${label}[${index}].basis is invalid.`);
    if (
      hasOfficialField &&
      item.officialField !== null &&
      !screen03OfficialFields.includes(item.officialField as Screen03OfficialField)
    ) fail(`${label}[${index}].officialField is invalid.`);
    if (
      item.basis !== "official-record-field" &&
      hasOfficialField &&
      item.officialField !== null
    ) fail(`${label}[${index}] assigns an official field to a non-field passage.`);
    if (hasStatus && !["active", "stale"].includes(item.status as string)) {
      fail(`${label}[${index}].status is invalid.`);
    }
    if (hasContentFingerprint) {
      assertFingerprint(
        item.contentFingerprint,
        `${label}[${index}].contentFingerprint`,
      );
    }
    if (item.status === "stale" && !hasContentFingerprint) {
      fail(`${label}[${index}] stale passages require their prior fingerprint.`);
    }
  });
}

function assertEvidence(
  value: unknown,
  label: string,
  maximumItems = MAX_RESEARCH_PACKET_EVIDENCE,
): asserts value is Screen03EvidenceItem[] {
  if (!Array.isArray(value) || value.length > maximumItems) fail(`${label} must be bounded.`);
  const itemIds = new Set<string>();
  const passageIds = new Set<string>();
  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertRecord(item, itemLabel);
    const hasSourceRole = Object.prototype.hasOwnProperty.call(
      item,
      "sourceRole",
    );
    const hasSourcePlatform = Object.prototype.hasOwnProperty.call(
      item,
      "sourcePlatform",
    );
    const hasDocumentType = Object.prototype.hasOwnProperty.call(
      item,
      "documentType",
    );
    assertExactKeys(item, [
      ...EVIDENCE_KEYS,
      ...(hasSourceRole ? ["sourceRole"] : []),
      ...(hasSourcePlatform ? ["sourcePlatform"] : []),
      ...(hasDocumentType ? ["documentType"] : []),
    ], itemLabel);
    assertString(item.id, `${itemLabel}.id`);
    if (itemIds.has(item.id)) fail(`${label} IDs must be unique.`);
    itemIds.add(item.id);
    assertNullableString(item.sourceId, `${itemLabel}.sourceId`);
    assertString(item.title, `${itemLabel}.title`);
    assertString(item.locator, `${itemLabel}.locator`, MAX_LOCATOR);
    assertString(item.publisher, `${itemLabel}.publisher`);
    assertPublishedDate(item.publishedDate, `${itemLabel}.publishedDate`);
    assertUtcTimestamp(item.retrievedAt, `${itemLabel}.retrievedAt`);
    if (![1, 2, 3, 4, 5, 6].includes(item.authorityTier as number)) fail(`${itemLabel}.authorityTier is invalid.`);
    assertString(item.channel, `${itemLabel}.channel`);
    if (
      hasSourceRole &&
      !screen03EvidenceSourceRoles.includes(
        item.sourceRole as Screen03EvidenceSourceRole,
      )
    ) fail(`${itemLabel}.sourceRole is invalid.`);
    if (
      hasSourcePlatform &&
      !screen03SourcePlatforms.includes(
        item.sourcePlatform as Screen03SourcePlatform,
      )
    ) fail(`${itemLabel}.sourcePlatform is invalid.`);
    if (
      hasDocumentType &&
      !screen03DocumentTypes.includes(
        item.documentType as Screen03DocumentType,
      )
    ) fail(`${itemLabel}.documentType is invalid.`);
    assertFingerprint(item.contentFingerprint, `${itemLabel}.contentFingerprint`);
    assertString(item.language, `${itemLabel}.language`, 80);
    if (!["carried", "retrieved", "changed"].includes(item.status as string)) fail(`${itemLabel}.status is invalid.`);
    assertPassages(item.passages, `${itemLabel}.passages`);
    for (const passage of item.passages as unknown as Screen03Passage[]) {
      if (
        passage.status === "stale" &&
        (item.status !== "changed" ||
          passage.contentFingerprint !== item.contentFingerprint)
      ) {
        fail(`${itemLabel} stale passage lost its source-version binding.`);
      }
      if (
        passage.status === "active" &&
        passage.contentFingerprint !== undefined &&
        passage.contentFingerprint !== item.contentFingerprint
      ) {
        fail(`${itemLabel} active passage targets another source version.`);
      }
      if (passageIds.has(passage.id)) fail("Passage IDs must be globally unique.");
      passageIds.add(passage.id);
    }
  });
}

function assertProposal(
  value: unknown,
  group: Screen03ProposalGroup,
  label: string,
  maximumReferences = MAX_LIST,
): asserts value is Screen03AnyProposal {
  assertRecord(value, label);
  assertExactKeys(value, group === "timeline" ? TIMELINE_PROPOSAL_KEYS : PROPOSAL_KEYS, label);
  assertString(value.id, `${label}.id`);
  if (value.group !== group) fail(`${label}.group does not match its section.`);
  assertString(value.label, `${label}.label`);
  assertString(value.value, `${label}.value`, MAX_LONG);
  if (typeof value.critical !== "boolean") fail(`${label}.critical must be boolean.`);
  if (!screen03ReviewStatuses.includes(value.reviewStatus as Screen03ReviewStatus)) fail(`${label}.reviewStatus is invalid.`);
  assertNullableString(value.editedValue, `${label}.editedValue`, MAX_LONG);
  if (value.reviewStatus === "edited" && value.editedValue === null) fail(`${label} edited fields require editedValue.`);
  if (value.reviewStatus !== "edited" && value.editedValue !== null) fail(`${label} only edited fields may have editedValue.`);
  if (!screen03SupportStatuses.includes(value.support as Screen03SupportStatus)) fail(`${label}.support is invalid.`);
  assertStringArray(value.sourceIds, `${label}.sourceIds`, maximumReferences);
  assertStringArray(value.passageIds, `${label}.passageIds`, maximumReferences);
  assertNullableString(value.uncertainty, `${label}.uncertainty`, MAX_LONG);
  if (group === "timeline") {
    if (!screen02DateLeadStages.includes(value.stage as Screen02DateLeadStage)) fail(`${label}.stage is invalid.`);
    assertCalendarDate(value.date, `${label}.date`);
    if (value.value !== value.date) fail(`${label}.value must equal its date.`);
    if (value.reviewStatus === "edited") assertCalendarDate(value.editedValue, `${label}.editedValue`);
  }
}

function assertProposalGroups(
  value: unknown,
  label: string,
  maximumReferences = MAX_LIST,
): asserts value is Screen03ProposalGroups {
  assertRecord(value, label);
  assertExactKeys(value, GROUP_KEYS, label);
  const ids = new Set<string>();
  const specs: Array<[keyof Screen03ProposalGroups, Screen03ProposalGroup]> = [
    ["identity", "identity"], ["overview", "overview"], ["timeline", "timeline"],
    ["component", "component"], ["eligibility", "eligibility"], ["amendment", "amendment"],
    ["requiredVariable", "required-variable"],
  ];
  for (const [key, group] of specs) {
    const list = value[key];
    if (!Array.isArray(list) || list.length > MAX_PROPOSALS_PER_GROUP) fail(`${label}.${key} must be bounded.`);
    list.forEach((proposal, index) => {
      assertProposal(
        proposal,
        group,
        `${label}.${key}[${index}]`,
        maximumReferences,
      );
      if (ids.has(proposal.id)) fail("Proposal IDs must be globally unique.");
      ids.add(proposal.id);
    });
  }
}

function screen03SourceChangeRecordId(
  record: Omit<Screen03SourceChangeRecord, "id">,
) {
  return `screen03-source-change:${fingerprintScreen03Value(record)}`;
}

function screen03DirectSupportSearchRecordId(
  record: Omit<Screen03DirectSupportSearchRecord, "id">,
) {
  return `screen03-direct-support:${fingerprintScreen03Value(record)}`;
}

function screen03SourceChangeSetFingerprint(
  records: readonly Pick<Screen03SourceChangeRecord, "id">[],
) {
  return fingerprintScreen03Value(
    records.map((record) => record.id).sort((left, right) =>
      left.localeCompare(right)
    ),
  );
}

function screen03ManualSourceChangeHistoryValue(
  records: readonly Pick<Screen03SourceChangeRecord, "id">[],
) {
  return `source-changes:${screen03SourceChangeSetFingerprint(records)}`;
}

function screen03ResearchRefreshHistoryValue(
  researchFingerprint: string,
  records: readonly Pick<Screen03SourceChangeRecord, "id">[],
) {
  return `research:${researchFingerprint};source-changes:${
    screen03SourceChangeSetFingerprint(records)
  }`;
}

function screen03HistoryUsesSourceChangeLedger(event: Screen03AuditEvent) {
  return event.action === "mark-source-changed"
    ? event.value?.startsWith("source-changes:") === true
    : event.action === "research-refreshed" &&
      event.value?.includes(";source-changes:") === true;
}

function assertSourceChanges(
  value: unknown,
  evidence: Screen03EvidenceItem[],
  updatedAt: string,
  history: Screen03AuditEvent[],
): asserts value is Screen03SourceChangeRecord[] {
  if (!Array.isArray(value) || value.length > MAX_HISTORY) {
    fail("screen03State.sourceChanges must be bounded.");
  }
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const historyById = new Map(history.map((event) => [event.id, event]));
  const sourceChangeRecords = value as Screen03SourceChangeRecord[];
  const ids = new Set<string>();
  let previousAt = "";
  value.forEach((entry, index) => {
    const label = `screen03State.sourceChanges[${index}]`;
    assertRecord(entry, label);
    assertExactKeys(entry, [
      "id",
      "historyEventId",
      "sourceId",
      "detectedAt",
      "trigger",
      "previousContentFingerprints",
      "observedContentFingerprint",
      "staleEvidenceIds",
      "stalePassageIds",
      "staleProposals",
      "reopenedProposalIds",
      "reason",
    ], label);
    assertString(entry.id, `${label}.id`);
    if (ids.has(entry.id)) fail("Screen 3 source-change IDs must be unique.");
    ids.add(entry.id);
    assertString(entry.historyEventId, `${label}.historyEventId`);
    assertString(entry.sourceId, `${label}.sourceId`);
    assertUtcTimestamp(entry.detectedAt, `${label}.detectedAt`);
    if (entry.detectedAt < previousAt || entry.detectedAt > updatedAt) {
      fail("Screen 3 source-change timestamps are invalid.");
    }
    previousAt = entry.detectedAt as string;
    if (!["mark-source-changed", "research-refresh"].includes(
      entry.trigger as string,
    )) {
      fail(`${label}.trigger is invalid.`);
    }
    assertStringArray(
      entry.previousContentFingerprints,
      `${label}.previousContentFingerprints`,
      MAX_STALE_EVIDENCE_VERSIONS,
    );
    if ((entry.previousContentFingerprints as string[]).length === 0) {
      fail(`${label} must preserve at least one previous fingerprint.`);
    }
    (entry.previousContentFingerprints as string[]).forEach(
      (fingerprint, fingerprintIndex) =>
        assertFingerprint(
          fingerprint,
          `${label}.previousContentFingerprints[${fingerprintIndex}]`,
        ),
    );
    if (entry.observedContentFingerprint !== null) {
      assertFingerprint(
        entry.observedContentFingerprint,
        `${label}.observedContentFingerprint`,
      );
      if ((entry.previousContentFingerprints as string[]).includes(
        entry.observedContentFingerprint as string,
      )) {
        fail(`${label} cannot report an unchanged fingerprint as changed.`);
      }
    } else if (entry.trigger === "mark-source-changed") {
      fail(`${label} manual source changes require the newly observed fingerprint.`);
    }
    assertStringArray(
      entry.staleEvidenceIds,
      `${label}.staleEvidenceIds`,
      MAX_STALE_EVIDENCE_VERSIONS,
    );
    if ((entry.staleEvidenceIds as string[]).length === 0) {
      fail(`${label} must retain stale evidence.`);
    }
    assertStringArray(
      entry.stalePassageIds,
      `${label}.stalePassageIds`,
      MAX_CARRIED_PROPOSAL_REFERENCES,
    );
    assertStringArray(
      entry.reopenedProposalIds,
      `${label}.reopenedProposalIds`,
      MAX_CARRIED_PROPOSAL_REFERENCES,
    );
    assertString(entry.reason, `${label}.reason`, MAX_LONG);

    const historyEvent = historyById.get(entry.historyEventId as string);
    const expectedAction = entry.trigger === "mark-source-changed"
      ? "mark-source-changed"
      : "research-refreshed";
    if (
      !historyEvent || historyEvent.action !== expectedAction ||
      historyEvent.at !== entry.detectedAt ||
      (entry.trigger === "mark-source-changed" &&
        (historyEvent.targetId !== entry.sourceId ||
          historyEvent.reason !== entry.reason))
    ) {
      fail(`${label} lost its immutable workflow-history binding.`);
    }

    const staleEvidence = (entry.staleEvidenceIds as string[]).map((id) => {
      const item = evidenceById.get(id);
      if (
        !item || item.status !== "changed" ||
        !(entry.previousContentFingerprints as string[]).includes(
          item.contentFingerprint,
        ) || item.passages.some((passage) =>
          passage.status !== "stale" ||
          passage.contentFingerprint !== item.contentFingerprint
        )
      ) {
        fail(`${label} lost its immutable previous evidence version.`);
      }
      return item;
    });
    const preservedFingerprints = [...new Set(
      staleEvidence.map((item) => item.contentFingerprint),
    )].sort((left, right) => left.localeCompare(right));
    const declaredFingerprints = [
      ...(entry.previousContentFingerprints as string[]),
    ].sort((left, right) => left.localeCompare(right));
    if (serializeDeterministicJson(preservedFingerprints) !==
      serializeDeterministicJson(declaredFingerprints)) {
      fail(`${label} previous fingerprints differ from retained evidence.`);
    }
    const stalePassageIds = new Set(
      staleEvidence.flatMap((item) => item.passages.map((passage) => passage.id)),
    );
    const declaredStalePassages = [...(entry.stalePassageIds as string[])]
      .sort((left, right) => left.localeCompare(right));
    const preservedStalePassages = [...stalePassageIds]
      .sort((left, right) => left.localeCompare(right));
    if (serializeDeterministicJson(declaredStalePassages) !==
      serializeDeterministicJson(preservedStalePassages)) {
      fail(`${label} does not enumerate every retained stale passage.`);
    }
    const sameSourceVersions = evidence.filter((item) =>
      staleEvidence.some((prior) =>
        screen03EvidenceRepresentsSameSource(prior, item)
      )
    );
    const activeSameSource = sameSourceVersions.filter((item) =>
      item.status !== "changed"
    );
    const observedVersionRetained = entry.observedContentFingerprint !== null &&
      sameSourceVersions.some((item) =>
        item.contentFingerprint === entry.observedContentFingerprint
      );
    if (
      entry.trigger === "research-refresh" &&
      entry.observedContentFingerprint !== null &&
      !observedVersionRetained
    ) {
      fail(`${label} observed fingerprint lacks retained replacement evidence.`);
    }
    const detectedAt = entry.detectedAt as string;
    const observedContentFingerprint = entry.observedContentFingerprint as
      | string
      | null;
    const manuallyRevalidatedActive =
      entry.trigger === "mark-source-changed" &&
      observedContentFingerprint !== null &&
      activeSameSource.some((item) =>
        item.contentFingerprint === observedContentFingerprint &&
        item.retrievedAt >= detectedAt
      );
    const manuallyRevalidatedThenStaled =
      entry.trigger === "mark-source-changed" &&
      observedContentFingerprint !== null &&
      sourceChangeRecords.slice(index + 1).some((later) =>
        later.previousContentFingerprints.includes(
          observedContentFingerprint,
        ) && later.staleEvidenceIds.some((id) => {
          const laterVersion = evidenceById.get(id);
          return laterVersion !== undefined &&
            laterVersion.contentFingerprint ===
              observedContentFingerprint &&
            staleEvidence.some((prior) =>
              screen03EvidenceRepresentsSameSource(prior, laterVersion)
            );
        })
      );
    if (entry.trigger === "mark-source-changed" &&
      activeSameSource.length > 0 &&
      !manuallyRevalidatedActive &&
      !manuallyRevalidatedThenStaled) {
      fail(`${label} was revalidated with a different source fingerprint.`);
    }
    if (!Array.isArray(entry.staleProposals) ||
      entry.staleProposals.length > MAX_CARRIED_PROPOSAL_REFERENCES) {
      fail(`${label}.staleProposals must be bounded.`);
    }
    const staleEvidenceReferences = new Set(
      staleEvidence.flatMap((item) => [
        item.id,
        ...(item.sourceId === null ? [] : [item.sourceId]),
      ]),
    );
    const allEvidenceReferences = new Set(evidence.flatMap((item) => [
      item.id,
      ...(item.sourceId === null ? [] : [item.sourceId]),
    ]));
    const allPassageOwners = new Map(evidence.flatMap((item) =>
      item.passages.map((passage) => [
        passage.id,
        new Set([item.id, ...(item.sourceId === null ? [] : [item.sourceId])]),
      ] as const)
    ));
    const proposalIds = new Set<string>();
    (entry.staleProposals as unknown[]).forEach((proposal, proposalIndex) => {
      assertRecord(proposal, `${label}.staleProposals[${proposalIndex}]`);
      if (!screen03ProposalGroups.includes(
        proposal.group as Screen03ProposalGroup,
      )) {
        fail(`${label}.staleProposals[${proposalIndex}].group is invalid.`);
      }
      assertProposal(
        proposal,
        proposal.group as Screen03ProposalGroup,
        `${label}.staleProposals[${proposalIndex}]`,
        MAX_CARRIED_PROPOSAL_REFERENCES,
      );
      const typed = proposal as unknown as Screen03AnyProposal;
      if (proposalIds.has(typed.id)) {
        fail(`${label}.staleProposals contains duplicate IDs.`);
      }
      proposalIds.add(typed.id);
      if (typed.sourceIds.some((id) => !allEvidenceReferences.has(id)) ||
        typed.passageIds.some((id) => !allPassageOwners.has(id)) ||
        typed.passageIds.some((id) => !typed.sourceIds.some((sourceId) =>
          allPassageOwners.get(id)?.has(sourceId)
        ))) {
        fail(`${label} contains a stale proposal with rewritten evidence mappings.`);
      }
      if (
        !typed.sourceIds.some((id) => staleEvidenceReferences.has(id)) &&
        !typed.passageIds.some((id) => stalePassageIds.has(id))
      ) {
        fail(`${label} contains a stale proposal outside the changed source.`);
      }
    });
    const expectedReopened = (entry.staleProposals as Screen03AnyProposal[])
      .filter((proposal) => proposal.reviewStatus !== "proposed")
      .map((proposal) => proposal.id)
      .sort((left, right) => left.localeCompare(right));
    const actualReopened = [...(entry.reopenedProposalIds as string[])]
      .sort((left, right) => left.localeCompare(right));
    if (serializeDeterministicJson(actualReopened) !==
      serializeDeterministicJson(expectedReopened)) {
      fail(`${label}.reopenedProposalIds does not match prior decisions.`);
    }
    const { id: _id, ...recordInput } = entry;
    if (entry.id !== screen03SourceChangeRecordId(
      recordInput as Omit<Screen03SourceChangeRecord, "id">,
    )) {
      fail(`${label}.id does not match its immutable record.`);
    }
  });

  const records = sourceChangeRecords;
  for (const event of history) {
    const linked = records.filter((record) =>
      record.historyEventId === event.id
    );
    if (linked.length === 0 && !screen03HistoryUsesSourceChangeLedger(event)) {
      continue;
    }
    if (event.action === "mark-source-changed") {
      if (
        linked.length !== 1 ||
        event.value !== screen03ManualSourceChangeHistoryValue(linked)
      ) {
        fail("A manual source-change event differs from its immutable ledger record.");
      }
      continue;
    }
    if (event.action !== "research-refreshed" || event.value === null) {
      fail("A source-change record references an incompatible history event.");
    }
    const suffix = `;source-changes:${
      screen03SourceChangeSetFingerprint(linked)
    }`;
    if (!event.value.startsWith("research:") || !event.value.endsWith(suffix)) {
      fail("A research-refresh event differs from its immutable source-change ledger.");
    }
    const researchFingerprint = event.value.slice(
      "research:".length,
      -suffix.length,
    );
    assertFingerprint(
      researchFingerprint,
      "research-refresh history fingerprint",
    );
  }
}

function assertQueries(value: unknown, label: string): asserts value is Screen03ResearchQuery[] {
  if (!Array.isArray(value) || value.length > MAX_LIST) fail(`${label} must be bounded.`);
  const ids = new Set<string>();
  value.forEach((query, index) => {
    assertRecord(query, `${label}[${index}]`);
    assertExactKeys(query, ["id", "query", "purpose", "returnedEvidenceIds"], `${label}[${index}]`);
    assertString(query.id, `${label}[${index}].id`);
    if (ids.has(query.id)) fail(`${label} IDs must be unique.`);
    ids.add(query.id);
    assertString(query.query, `${label}[${index}].query`, MAX_LONG);
    assertString(query.purpose, `${label}[${index}].purpose`, MAX_LONG);
    assertStringArray(query.returnedEvidenceIds, `${label}[${index}].returnedEvidenceIds`);
  });
}

function assertDirectSupportSearches(
  value: unknown,
  updatedAt: string,
  history: Screen03AuditEvent[],
): asserts value is Screen03DirectSupportSearchRecord[] {
  if (!Array.isArray(value) || value.length > MAX_HISTORY) {
    fail("screen03State.directSupportSearches must be bounded.");
  }
  const ids = new Set<string>();
  let previousAt = "";
  value.forEach((entry, index) => {
    const label = `screen03State.directSupportSearches[${index}]`;
    assertRecord(entry, label);
    const hasResultBindingFingerprint = Object.prototype.hasOwnProperty.call(
      entry,
      "resultBindingFingerprint",
    );
    assertExactKeys(entry, [
      "id",
      "proposalId",
      "claimFingerprint",
      ...(hasResultBindingFingerprint ? ["resultBindingFingerprint"] : []),
      "searchedAt",
      "previousSupport",
      "resultingSupport",
      "resultingConfirmable",
      "outcome",
      "evidenceIds",
      "passageIds",
      "queryIds",
      "note",
    ], label);
    assertString(entry.id, `${label}.id`);
    if (ids.has(entry.id)) fail("Direct-support search IDs must be unique.");
    ids.add(entry.id);
    assertString(entry.proposalId, `${label}.proposalId`);
    assertFingerprint(entry.claimFingerprint, `${label}.claimFingerprint`);
    if (hasResultBindingFingerprint) {
      assertFingerprint(
        entry.resultBindingFingerprint,
        `${label}.resultBindingFingerprint`,
      );
    }
    assertUtcTimestamp(entry.searchedAt, `${label}.searchedAt`);
    if (entry.searchedAt > updatedAt || entry.searchedAt < previousAt) {
      fail("Direct-support searches must be chronologically ordered within the state.");
    }
    previousAt = entry.searchedAt as string;
    if (!screen03SupportStatuses.includes(entry.previousSupport as Screen03SupportStatus)) {
      fail(`${label}.previousSupport is invalid.`);
    }
    if (
      entry.resultingSupport !== null &&
      !screen03SupportStatuses.includes(entry.resultingSupport as Screen03SupportStatus)
    ) fail(`${label}.resultingSupport is invalid.`);
    if (typeof entry.resultingConfirmable !== "boolean") {
      fail(`${label}.resultingConfirmable must be boolean.`);
    }
    if (![
      "direct-support-found",
      "no-direct-support-found",
      "search-incomplete",
      "claim-no-longer-active",
    ].includes(entry.outcome as string)) fail(`${label}.outcome is invalid.`);
    assertStringArray(entry.evidenceIds, `${label}.evidenceIds`, MAX_LIST);
    assertStringArray(entry.passageIds, `${label}.passageIds`, MAX_LIST);
    assertStringArray(entry.queryIds, `${label}.queryIds`, MAX_LIST);
    assertString(entry.note, `${label}.note`, MAX_LONG);
    const { id: _id, ...recordInput } = entry;
    if (
      entry.id !== screen03DirectSupportSearchRecordId(
        recordInput as Omit<Screen03DirectSupportSearchRecord, "id">,
      )
    ) fail(`${label}.id does not match its immutable record.`);
    const matchingEvents = history.filter((event) =>
      event.action === "direct-support-searched" &&
      event.targetId === entry.proposalId &&
      event.at === entry.searchedAt &&
      event.value === entry.id
    );
    if (
      matchingEvents.length !== 1 ||
      matchingEvents[0]!.actor !== "research-service" ||
      matchingEvents[0]!.reason !== entry.note
    ) fail(`${label} lacks its matching research-service audit event.`);
  });
}

function assertChannels(value: unknown, label: string): asserts value is Screen03ResearchChannel[] {
  if (!Array.isArray(value) || value.length > MAX_LIST) fail(`${label} must be bounded.`);
  value.forEach((channel, index) => {
    assertRecord(channel, `${label}[${index}]`);
    assertExactKeys(channel, ["channel", "status", "note", "retrievedAt"], `${label}[${index}]`);
    assertString(channel.channel, `${label}[${index}].channel`);
    if (!["searched", "failed", "not-searched"].includes(channel.status as string)) fail(`${label}[${index}].status is invalid.`);
    assertString(channel.note, `${label}[${index}].note`, MAX_LONG);
    if (channel.retrievedAt !== null) assertUtcTimestamp(channel.retrievedAt, `${label}[${index}].retrievedAt`);
  });
}

function assertStoppingRule(value: unknown, label: string): asserts value is Screen03StoppingRule {
  assertRecord(value, label);
  assertExactKeys(value, ["rule", "status", "note"], label);
  assertString(value.rule, `${label}.rule`, MAX_LONG);
  if (!["met", "not-met"].includes(value.status as string)) fail(`${label}.status is invalid.`);
  assertString(value.note, `${label}.note`, MAX_LONG);
}

function assertCoverage(
  value: unknown,
  label: string,
  state: boolean,
  maximumActiveEvidence = MAX_RESEARCH_PACKET_EVIDENCE,
): asserts value is Screen03ResearchCoverage | Screen03ResearchPacketCoverage {
  assertRecord(value, label);
  assertExactKeys(value, state ? ["status", ...COVERAGE_KEYS] : COVERAGE_KEYS, label);
  if (state && !["pending", "completed", "incomplete"].includes(value.status as string)) fail(`${label}.status is invalid.`);
  assertQueries(value.queries, `${label}.queries`);
  assertChannels(value.channels, `${label}.channels`);
  assertStringArray(value.routes, `${label}.routes`);
  assertStringArray(value.stages, `${label}.stages`);
  assertStringArray(value.languages, `${label}.languages`);
  if (!Array.isArray(value.authorityTiers) || value.authorityTiers.length > 6 || new Set(value.authorityTiers).size !== value.authorityTiers.length || value.authorityTiers.some((tier) => ![1, 2, 3, 4, 5, 6].includes(tier as number))) {
    fail(`${label}.authorityTiers is invalid.`);
  }
  assertStringArray(value.gaps, `${label}.gaps`);
  if (!Number.isInteger(value.recordsReviewed) || (value.recordsReviewed as number) < 0 || (value.recordsReviewed as number) > 10_000) fail(`${label}.recordsReviewed is invalid.`);
  if (!Number.isInteger(value.activeEvidenceCount) || (value.activeEvidenceCount as number) < 0 || (value.activeEvidenceCount as number) > maximumActiveEvidence) fail(`${label}.activeEvidenceCount is invalid.`);
  if (value.exhaustive !== false || value.outcomeValuesInspected !== false) fail(`${label} must preserve bounded, outcome-blind research.`);
  assertStoppingRule(value.stoppingRule, `${label}.stoppingRule`);
}

function assertContradictions(value: unknown, label: string): asserts value is Screen03Contradiction[] {
  if (!Array.isArray(value) || value.length > MAX_CONTRADICTIONS) fail(`${label} must be bounded.`);
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertRecord(item, itemLabel);
    assertExactKeys(item, ["id", "kind", "proposalIds", "summary", "status", "resolution"], itemLabel);
    assertString(item.id, `${itemLabel}.id`);
    if (ids.has(item.id)) fail(`${label} IDs must be unique.`);
    ids.add(item.id);
    if (!["date-order", "source-conflict", "scope-conflict", "other"].includes(item.kind as string)) fail(`${itemLabel}.kind is invalid.`);
    assertStringArray(item.proposalIds, `${itemLabel}.proposalIds`);
    assertString(item.summary, `${itemLabel}.summary`, MAX_LONG);
    if (!["unresolved", "resolved"].includes(item.status as string)) fail(`${itemLabel}.status is invalid.`);
    assertNullableString(item.resolution, `${itemLabel}.resolution`, MAX_LONG);
    if (item.status === "resolved" && item.resolution === null) fail(`${itemLabel} resolved contradictions require a resolution.`);
    if (item.status === "unresolved" && item.resolution !== null) fail(`${itemLabel} unresolved contradictions cannot have a resolution.`);
  });
}

function allProposals(groups: Screen03ProposalGroups): Screen03AnyProposal[] {
  return [
    ...groups.identity, ...groups.overview, ...groups.timeline, ...groups.component,
    ...groups.eligibility, ...groups.amendment, ...groups.requiredVariable,
  ];
}

/** The one canonical collection of reader-visible factual claims. */
export function screen03FactualClaims(
  groups: Screen03ProposalGroups,
): Screen03AnyProposal[] {
  return [
    ...groups.identity,
    ...groups.overview,
    ...groups.timeline,
    ...groups.component,
    ...groups.eligibility,
    ...groups.amendment,
  ];
}

/** Retained only for validation of cards locked before timeline review. */
function legacyNonTimelineFactualClaims(
  groups: Screen03ProposalGroups,
): Screen03Proposal[] {
  return [
    ...groups.identity,
    ...groups.overview,
    ...groups.component,
    ...groups.eligibility,
    ...groups.amendment,
  ];
}

/** Exact pre-v0.4.02 lock set, retained only to validate historical cards. */
function legacyEvidenceDecisionProposals(
  groups: Screen03ProposalGroups,
): Screen03AnyProposal[] {
  return allProposals(groups).filter(
    (proposal) =>
      proposal.group !== "required-variable" ||
      screen03ProposalIsAssessmentUnavailableCheck(proposal),
  );
}

/**
 * Recognize historical and current assessment-unavailable reminders by their
 * stable IDs. They are planning context, not factual claims or review gates.
 */
export function screen03ProposalIsAssessmentUnavailableCheck(
  proposal: Screen03AnyProposal,
) {
  return proposal.group === "required-variable" &&
    proposal.id.startsWith("carried:assessment-unavailable-check:");
}

/** Stable identity for the factual proposal an explanation describes. */
export function fingerprintScreen03ProposalForInterpretation(
  proposal: Screen03AnyProposal,
) {
  const common = {
    id: proposal.id,
    group: proposal.group,
    label: proposal.label,
    value: proposal.value,
    critical: proposal.critical,
    support: proposal.support,
    sourceIds: [...proposal.sourceIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    passageIds: [...proposal.passageIds].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
  return fingerprintScreen03Value(
    proposal.group === "timeline"
      ? { ...common, stage: proposal.stage, date: proposal.date }
      : common,
  );
}

function screen03DirectSupportSearchEvidenceIds(
  proposal: Screen03AnyProposal,
  evidence: Screen03EvidenceItem[],
) {
  return evidence
    .filter((item) =>
      proposal.sourceIds.includes(item.id) ||
      (item.sourceId !== null && proposal.sourceIds.includes(item.sourceId)) ||
      item.passages.some((passage) =>
        proposal.passageIds.includes(passage.id)
      )
    )
    .map((item) => item.id);
}

function fingerprintScreen03DirectSupportSearchResult(
  proposal: Screen03AnyProposal,
  evidence: Screen03EvidenceItem[],
) {
  const referencedPassageIds = new Set(proposal.passageIds);
  const referencedEvidenceIds = new Set(
    screen03DirectSupportSearchEvidenceIds(proposal, evidence),
  );
  const referencedEvidence = evidence
    .filter((item) => referencedEvidenceIds.has(item.id))
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      status: item.status,
      contentFingerprint: item.contentFingerprint,
      passages: item.passages
        .filter((passage) => referencedPassageIds.has(passage.id))
        .map((passage) => ({
          id: passage.id,
          status: passage.status ?? null,
          contentFingerprint: passage.contentFingerprint ?? null,
          basis: passage.basis,
          officialField: passage.officialField ?? null,
          text: passage.text,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return fingerprintScreen03Value({
    proposalFingerprint: fingerprintScreen03ProposalForInterpretation(
      proposal,
    ),
    displayedValue: resolvedProposalValue(proposal),
    evidence: referencedEvidence,
  });
}

function sameSortedStrings(left: readonly string[], right: readonly string[]) {
  const sortedLeft = [...left].sort((a, b) => a.localeCompare(b));
  const sortedRight = [...right].sort((a, b) => a.localeCompare(b));
  return serializeDeterministicJson(sortedLeft) ===
    serializeDeterministicJson(sortedRight);
}

/**
 * Whether the newest immutable targeted-search result still describes the
 * current claim and exact evidence versions. Legacy records without the
 * post-search binding remain visible in history but are deliberately stale.
 */
export function screen03DirectSupportSearchResultIsCurrent(
  record: Screen03DirectSupportSearchRecord,
  state: Pick<Screen03VerificationState, "proposals" | "evidence">,
) {
  if (!record.resultBindingFingerprint) return false;
  const proposal = screen03FactualClaims(state.proposals).find(
    (candidate) => candidate.id === record.proposalId,
  );
  if (!proposal) return false;
  const evidenceIds = screen03DirectSupportSearchEvidenceIds(
    proposal,
    state.evidence,
  );
  const confirmable = screen03ProposalConfirmability(
    proposal,
    state.evidence,
    resolvedProposalValue(proposal),
    proposal.reviewStatus === "edited",
  ).confirmable;
  if (
    !sameSortedStrings(record.evidenceIds, evidenceIds) ||
    !sameSortedStrings(record.passageIds, proposal.passageIds) ||
    record.resultingSupport !== proposal.support ||
    record.resultingConfirmable !== confirmable ||
    (record.outcome === "direct-support-found") !== confirmable
  ) return false;
  return record.resultBindingFingerprint ===
    fingerprintScreen03DirectSupportSearchResult(proposal, state.evidence);
}

function assertInterpretation(
  value: unknown,
  label: string,
  evidence: Screen03EvidenceItem[],
  groups: Screen03ProposalGroups,
): asserts value is Screen03Interpretation {
  assertRecord(value, label);
  assertExactKeys(value, [
    "protocolVersion",
    "origin",
    "nonCanonical",
    "studyContext",
    "snapshot",
    "studyRelevance",
    "claimExplanations",
    "limitations",
    "outcomeValuesInspected",
  ], label);
  if (value.protocolVersion !== SCREEN_03_INTERPRETATION_PROTOCOL_VERSION) {
    fail(`${label}.protocolVersion is unsupported.`);
  }
  if (![
    "chatgpt-host",
    "workers-ai",
    "screen02-reuse",
    "unavailable",
  ].includes(value.origin as string)) {
    fail(`${label}.origin is invalid.`);
  }
  if (value.nonCanonical !== true || value.outcomeValuesInspected !== false) {
    fail(`${label} must remain noncanonical and outcome-data-blind.`);
  }

  assertRecord(value.studyContext, `${label}.studyContext`);
  assertExactKeys(value.studyContext, [
    "population",
    "geography",
    "industry",
    "studyPeriod",
    "outcomeFamily",
  ], `${label}.studyContext`);
  for (const key of [
    "population",
    "geography",
    "industry",
    "studyPeriod",
    "outcomeFamily",
  ] as const) {
    assertString(
      value.studyContext[key],
      `${label}.studyContext.${key}`,
      MAX_LONG,
    );
  }

  const proposalById = new Map(
    allProposals(groups).map((proposal) => [proposal.id, proposal]),
  );
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const passageById = new Map(
    evidence.flatMap((item) =>
      item.passages.map((passage) => [
        passage.id,
        { item, passage },
      ] as const)
    ),
  );
  const assertReferences = (
    proposalIds: unknown,
    passageIds: unknown,
    evidenceIds: unknown,
    blockLabel: string,
    explanationProposal?: Screen03AnyProposal,
  ) => {
    assertStringArray(proposalIds, `${blockLabel}.proposalIds`, 12);
    assertStringArray(passageIds, `${blockLabel}.passageIds`, 12);
    assertStringArray(evidenceIds, `${blockLabel}.evidenceIds`, 12);
    const typedProposalIds = proposalIds as string[];
    const typedPassageIds = passageIds as string[];
    const typedEvidenceIds = evidenceIds as string[];
    if (typedProposalIds.some((id) => !proposalById.has(id))) {
      fail(`${blockLabel} references an unknown proposal.`);
    }
    const referencedGroups = new Set(
      typedProposalIds.map((id) => proposalById.get(id)!.group),
    );
    const expectedEvidenceIds = new Set<string>();
    for (const passageId of typedPassageIds) {
      const owner = passageById.get(passageId);
      const referenceProposals = explanationProposal
        ? [explanationProposal]
        : typedProposalIds.map((id) => proposalById.get(id)!);
      const directlySupportsReferencedClaim = Boolean(owner) &&
        referenceProposals.some((proposal) =>
          screen03EvidenceItemProvidesDirectSupportForProposal(
            owner!.item,
            proposal,
          ) && screen03PassageProvidesDirectSupport(owner!.passage, proposal)
        );
      if (
        !owner ||
        owner.item.status === "changed" ||
        !directlySupportsReferencedClaim
      ) {
        fail(`${blockLabel} references inactive or nonfactual evidence.`);
      }
      expectedEvidenceIds.add(owner.item.id);
      const passageProposalGroups = new Set(
        allProposals(groups)
          .filter((proposal) => proposal.passageIds.includes(passageId))
          .map((proposal) => proposal.group),
      );
      if (
        explanationProposal
          ? !(
              explanationProposal.passageIds.includes(passageId) ||
              passageProposalGroups.has(explanationProposal.group)
            )
          : ![...referencedGroups].some((group) =>
              passageProposalGroups.has(group)
            )
      ) {
        fail(`${blockLabel} uses evidence outside its referenced claim group.`);
      }
    }
    if (typedEvidenceIds.some((id) => !evidenceById.has(id))) {
      fail(`${blockLabel} references unknown evidence.`);
    }
    const actualOwners = [...expectedEvidenceIds].sort();
    const claimedOwners = [...typedEvidenceIds].sort();
    if (
      actualOwners.length !== claimedOwners.length ||
      actualOwners.some((id, index) => id !== claimedOwners[index])
    ) {
      fail(`${blockLabel} evidence owners do not match its passages.`);
    }
  };
  const assertBlock = (block: unknown, blockLabel: string) => {
    assertRecord(block, blockLabel);
    assertExactKeys(block, [
      "text",
      "proposalIds",
      "passageIds",
      "evidenceIds",
    ], blockLabel);
    assertString(block.text, `${blockLabel}.text`, 1_200);
    assertReferences(
      block.proposalIds,
      block.passageIds,
      block.evidenceIds,
      blockLabel,
    );
  };
  const requireGeneratedReferences = (
    block: Screen03InterpretationBlock,
    blockLabel: string,
  ) => {
    if (
      (value.origin === "workers-ai" || value.origin === "chatgpt-host") &&
      (
        block.proposalIds.length === 0 || block.passageIds.length === 0 ||
        block.evidenceIds.length === 0
      )
    ) {
      fail(`${blockLabel} requires source references for generated reader help.`);
    }
  };

  assertRecord(value.snapshot, `${label}.snapshot`);
  assertExactKeys(value.snapshot, ["intro", "keyPoints"], `${label}.snapshot`);
  assertBlock(value.snapshot.intro, `${label}.snapshot.intro`);
  requireGeneratedReferences(
    value.snapshot.intro as Screen03InterpretationBlock,
    `${label}.snapshot.intro`,
  );
  if (
    !Array.isArray(value.snapshot.keyPoints) ||
    value.snapshot.keyPoints.length > MAX_INTERPRETATION_KEY_POINTS ||
    ((value.origin === "workers-ai" || value.origin === "chatgpt-host") &&
      value.snapshot.keyPoints.length === 0)
  ) {
    fail(`${label}.snapshot.keyPoints must be a bounded array.`);
  }
  value.snapshot.keyPoints.forEach((block, index) => {
    const blockLabel = `${label}.snapshot.keyPoints[${index}]`;
    assertBlock(block, blockLabel);
    requireGeneratedReferences(block as Screen03InterpretationBlock, blockLabel);
  });

  assertRecord(value.studyRelevance, `${label}.studyRelevance`);
  assertExactKeys(value.studyRelevance, [
    "sampleConnection",
    "outcomeConnection",
    "caveat",
  ], `${label}.studyRelevance`);
  assertBlock(
    value.studyRelevance.sampleConnection,
    `${label}.studyRelevance.sampleConnection`,
  );
  requireGeneratedReferences(
    value.studyRelevance.sampleConnection as Screen03InterpretationBlock,
    `${label}.studyRelevance.sampleConnection`,
  );
  assertBlock(
    value.studyRelevance.outcomeConnection,
    `${label}.studyRelevance.outcomeConnection`,
  );
  requireGeneratedReferences(
    value.studyRelevance.outcomeConnection as Screen03InterpretationBlock,
    `${label}.studyRelevance.outcomeConnection`,
  );
  assertString(
    value.studyRelevance.caveat,
    `${label}.studyRelevance.caveat`,
    1_200,
  );

  if (
    !Array.isArray(value.claimExplanations) ||
    value.claimExplanations.length > 50 ||
    (value.origin === "workers-ai" && value.claimExplanations.length === 0)
  ) {
    fail(`${label}.claimExplanations must be a bounded array.`);
  }
  const explanationProposalIds = new Set<string>();
  value.claimExplanations.forEach((explanation, index) => {
    const explanationLabel = `${label}.claimExplanations[${index}]`;
    assertRecord(explanation, explanationLabel);
    assertExactKeys(explanation, [
      "proposalId",
      "proposalFingerprint",
      "text",
      "passageIds",
      "evidenceIds",
    ], explanationLabel);
    assertString(explanation.proposalId, `${explanationLabel}.proposalId`);
    if (explanationProposalIds.has(explanation.proposalId)) {
      fail(`${label}.claimExplanations contains a duplicate proposal.`);
    }
    explanationProposalIds.add(explanation.proposalId);
    const proposal = proposalById.get(explanation.proposalId);
    if (!proposal) fail(`${explanationLabel} references an unknown proposal.`);
    assertFingerprint(
      explanation.proposalFingerprint,
      `${explanationLabel}.proposalFingerprint`,
    );
    if (
      explanation.proposalFingerprint !==
        fingerprintScreen03ProposalForInterpretation(proposal)
    ) {
      fail(`${explanationLabel} is stale for its proposal.`);
    }
    assertString(explanation.text, `${explanationLabel}.text`, 1_200);
    assertReferences(
      [proposal.id],
      explanation.passageIds,
      explanation.evidenceIds,
      explanationLabel,
      proposal,
    );
    const passageIds = explanation.passageIds as string[];
    const evidenceIds = explanation.evidenceIds as string[];
    if (
      (value.origin === "workers-ai" || value.origin === "chatgpt-host") &&
      (
        passageIds.length === 0 ||
        evidenceIds.length === 0
      )
    ) {
      fail(`${explanationLabel} requires source references for generated reader help.`);
    }
  });
  assertStringArray(value.limitations, `${label}.limitations`, 12);
}

function validateReferences(
  evidence: Screen03EvidenceItem[],
  groups: Screen03ProposalGroups,
  contradictions: Screen03Contradiction[],
  queries: Screen03ResearchQuery[],
) {
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const sourceIds = new Set(evidence.flatMap((item) => item.sourceId === null ? [] : [item.sourceId]));
  const passageIds = new Set(evidence.flatMap((item) => item.passages.map((passage) => passage.id)));
  const passageOwner = new Map(
    evidence.flatMap((item) =>
      item.passages.map((passage) => [
        passage.id,
        new Set([item.id, ...(item.sourceId === null ? [] : [item.sourceId])]),
      ] as const),
    ),
  );
  const proposalById = new Map(
    allProposals(groups).map((proposal) => [proposal.id, proposal]),
  );
  const proposalIds = new Set(proposalById.keys());
  for (const proposal of allProposals(groups)) {
    if (proposal.sourceIds.some((id) => !evidenceIds.has(id) && !sourceIds.has(id))) fail(`Proposal ${proposal.id} references unknown evidence.`);
    if (proposal.passageIds.some((id) => !passageIds.has(id))) fail(`Proposal ${proposal.id} references an unknown passage.`);
    if (proposal.passageIds.some((id) => !proposal.sourceIds.some((sourceId) => passageOwner.get(id)?.has(sourceId)))) {
      fail(`Proposal ${proposal.id} has a passage outside its cited sources.`);
    }
    if (proposal.support === "direct" && proposal.passageIds.length === 0) fail(`Direct proposal ${proposal.id} requires an exact passage.`);
  }
  for (const contradiction of contradictions) {
    if (contradiction.proposalIds.some((id) => !proposalIds.has(id))) fail(`Contradiction ${contradiction.id} references an unknown proposal.`);
    if (
      contradiction.status === "unresolved" &&
      (contradiction.kind === "source-conflict" ||
        contradiction.kind === "scope-conflict")
    ) {
      for (const proposalId of contradiction.proposalIds) {
        if (proposalById.get(proposalId)?.support !== "conflicting") {
          fail(
            `Unresolved contradiction ${contradiction.id} requires proposal ${proposalId} to remain conflicting.`,
          );
        }
      }
    }
  }
  for (const query of queries) {
    if (query.returnedEvidenceIds.some((id) => !evidenceIds.has(id) && !sourceIds.has(id))) fail(`Query ${query.id} references unknown evidence.`);
  }
}

function validateResearchPacket(value: unknown): value is Screen03ResearchPacket {
  assertRecord(value, "researchPacket");
  const hasContextLeads = Object.prototype.hasOwnProperty.call(value, "contextLeads");
  const hasInterpretation = Object.prototype.hasOwnProperty.call(
    value,
    "interpretation",
  );
  assertExactKeys(
    value,
    [
      ...PACKET_KEYS,
      ...(hasContextLeads ? ["contextLeads"] : []),
      ...(hasInterpretation ? ["interpretation"] : []),
    ],
    "researchPacket",
  );
  if (value.protocolVersion !== SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION) fail("Research protocol is unsupported.");
  assertUtcTimestamp(value.researchedAt, "researchPacket.researchedAt");
  assertFingerprint(value.upstreamEventFingerprint, "researchPacket.upstreamEventFingerprint");
  assertCoverage(value.coverage, "researchPacket.coverage", false);
  if (hasContextLeads) {
    assertContextLeads(value.contextLeads, "researchPacket.contextLeads");
  }
  assertEvidence(value.evidence, "researchPacket.evidence");
  assertProposalGroups(value.proposals, "researchPacket.proposals");
  assertContradictions(value.contradictions, "researchPacket.contradictions");
  if (hasInterpretation) {
    assertInterpretation(
      value.interpretation,
      "researchPacket.interpretation",
      value.evidence as Screen03EvidenceItem[],
      value.proposals as Screen03ProposalGroups,
    );
  }
  if (value.outcomeValuesInspected !== false) fail("Research must remain outcome-blind.");
  const typed = value as unknown as Screen03ResearchPacket;
  if (allProposals(typed.proposals).some((proposal) => proposal.reviewStatus !== "proposed")) {
    fail("Research packets may propose fields, but cannot record researcher decisions.");
  }
  if (typed.contradictions.some((contradiction) => contradiction.status !== "unresolved" || contradiction.resolution !== null)) {
    fail("Research packets may identify contradictions, but cannot resolve them for the researcher.");
  }
  if (typed.coverage.activeEvidenceCount !== typed.evidence.filter((item) => item.status !== "changed").length) fail("activeEvidenceCount does not match evidence.");
  validateReferences(typed.evidence, typed.proposals, typed.contradictions, typed.coverage.queries);
  return true;
}

export function restoreScreen03ResearchPacket(value: unknown): Screen03ResearchPacket | null {
  try {
    const copy = clone(value);
    validateResearchPacket(copy);
    return deepFreeze(copy as Screen03ResearchPacket);
  } catch {
    return null;
  }
}

export function requireScreen03ResearchPacket(value: unknown) {
  const restored = restoreScreen03ResearchPacket(value);
  if (!restored) fail("Screen 3 research packet failed its exact contract.");
  return restored;
}

function validateHistory(value: unknown, label: string): asserts value is Screen03AuditEvent[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_HISTORY) fail(`${label} must be bounded and nonempty.`);
  const ids = new Set<string>();
  const hostEvidenceResultIds = new Set<string>();
  value.forEach((event, index) => {
    const itemLabel = `${label}[${index}]`;
    assertRecord(event, itemLabel);
    assertExactKeys(event, ["id", "action", "targetId", "at", "actor", "reason", "value", "previousReviewStatus", "nextReviewStatus"], itemLabel);
    assertString(event.id, `${itemLabel}.id`);
    if (ids.has(event.id)) fail("History IDs must be unique.");
    ids.add(event.id);
    if (!["initialized", "research-integrated", "research-refreshed", "context-refreshed", "direct-support-searched", "host-interpretation-integrated", "host-evidence-mapping-applied", "host-briefing-lifecycle-attached", "host-briefing-proposed", "host-briefing-confirmed", "host-briefing-revised", "host-briefing-rejected", "orientation-attached", "review-field", "select-focal-clock", "resolve-contradiction", "mark-source-changed", "lock-event-card"].includes(event.action as string)) fail(`${itemLabel}.action is invalid.`);
    assertNullableString(event.targetId, `${itemLabel}.targetId`);
    assertUtcTimestamp(event.at, `${itemLabel}.at`);
    if (!["fixed-core", "research-service", "chatgpt-host", "researcher"].includes(event.actor as string)) fail(`${itemLabel}.actor is invalid.`);
    assertString(event.reason, `${itemLabel}.reason`, MAX_LONG);
    assertNullableString(event.value, `${itemLabel}.value`, MAX_LONG);
    if (event.previousReviewStatus !== null && !screen03ReviewStatuses.includes(event.previousReviewStatus as Screen03ReviewStatus)) fail(`${itemLabel}.previousReviewStatus is invalid.`);
    if (event.nextReviewStatus !== null && !screen03ReviewStatuses.includes(event.nextReviewStatus as Screen03ReviewStatus)) fail(`${itemLabel}.nextReviewStatus is invalid.`);
    if (event.action === "host-evidence-mapping-applied") {
      if (
        event.actor !== "chatgpt-host" ||
        typeof event.targetId !== "string" || !event.targetId ||
        typeof event.value !== "string" || !event.value ||
        event.previousReviewStatus !== null ||
        event.nextReviewStatus !== null ||
        hostEvidenceResultIds.has(event.value)
      ) {
        fail("Host evidence audit markers must bind one unique result to one claim group.");
      }
      hostEvidenceResultIds.add(event.value);
    }
    if (index > 0 && event.at < (value[index - 1] as Screen03AuditEvent).at) fail("History timestamps must be ordered.");
  });
}

function validateAssessmentUnavailableChecks(
  proposals: Screen03ProposalGroups,
  history: Screen03AuditEvent[],
) {
  const checks = proposals.requiredVariable.filter(
    screen03ProposalIsAssessmentUnavailableCheck,
  );
  if (checks.length === 0) return;
  if (checks.length > screen02AssessmentUnavailableScreen03Checks.length) {
    fail("Screen 3 assessment-unavailable reminders exceed the supported set.");
  }
  const seen = new Set<number>();
  checks.forEach((check) => {
    const match = /^carried:assessment-unavailable-check:(\d+)$/.exec(check.id);
    const index = match ? Number(match[1]) - 1 : -1;
    const expectedValue = screen02AssessmentUnavailableScreen03Checks[index];
    if (
      index < 0 ||
      index >= screen02AssessmentUnavailableScreen03Checks.length ||
      seen.has(index) ||
      check.label !== "Required assessment check" ||
      check.value !== expectedValue ||
      check.support !== "unsupported" ||
      check.sourceIds.length !== 0 ||
      check.passageIds.length !== 0 ||
      check.editedValue !== null ||
      !["proposed", "accepted", "unresolved"].includes(check.reviewStatus)
    ) {
      fail(
        "Assessment-unavailable reminders must retain a recognized Screen 2 identity and historical disposition.",
      );
    }
    seen.add(index);
    if (check.reviewStatus !== "proposed") {
      const finalDecision = [...history].reverse().find(
        (event) =>
          event.action === "review-field" && event.targetId === check.id,
      );
      if (
        !finalDecision ||
        finalDecision.actor !== "researcher" ||
        finalDecision.nextReviewStatus !== check.reviewStatus
      ) {
        fail(
          `Assessment-unavailable check ${check.id} lacks its explicit researcher disposition.`,
        );
      }
    }
  });
}

function stateFingerprintInput(state: Screen03VerificationState) {
  const { integrity: _integrity, ...input } = state;
  return input;
}

function withIntegrity(
  input: Omit<Screen03VerificationState, "integrity"> | Screen03VerificationState,
): Screen03VerificationState {
  const { integrity: _existingIntegrity, ...state } = input as Screen03VerificationState;
  const provisional = { ...state, integrity: { stateFingerprint: "fnv1a64:0000000000000000" } };
  provisional.integrity.stateFingerprint = fingerprintScreen03Value(stateFingerprintInput(provisional));
  return requireScreen03VerificationState(provisional);
}

function resolvedProposalValue(proposal: Screen03AnyProposal) {
  return proposal.reviewStatus === "edited" ? proposal.editedValue! : proposal.value;
}

const orientationSentenceEndingPattern = /[.!?]["')\]]?$/u;

function orientationSentence(
  value: string,
  maximumWords: number,
  maximumCharacters: number,
) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  let bounded = "";
  for (const word of words) {
    const next = `${bounded} ${word}`.trim();
    const completed = orientationSentenceEndingPattern.test(next)
      ? next
      : `${next}.`;
    if (
      next.split(" ").length > maximumWords ||
      completed.length > maximumCharacters
    ) {
      break;
    }
    bounded = next;
  }
  bounded = bounded.replace(/[,;:]$/u, "");
  if (!bounded) return "This detail remains preliminary.";
  return orientationSentenceEndingPattern.test(bounded)
    ? bounded
    : `${bounded}.`;
}

function orientationReviewedProposals(state: Screen03VerificationState) {
  return allProposals(state.proposals).filter(
    (proposal) =>
      proposal.group !== "required-variable" &&
      proposal.reviewStatus !== "proposed",
  );
}

function orientationApprovedProposals(state: Screen03VerificationState) {
  return orientationReviewedProposals(state).filter(
    (proposal) =>
      (proposal.reviewStatus === "accepted" ||
        proposal.reviewStatus === "edited") &&
      screen03ProposalHasActiveDirectSupport(proposal, state.evidence) &&
      !/\b(?:causal(?:ity| mechanism)?|exogene(?:ity|ous)|effect size|effect direction|realized outcomes?)\b/iu.test(
        resolvedProposalValue(proposal),
      ),
  );
}

function rebuildScreen03OrientationGlance(
  state: Screen03VerificationState,
  at: string,
) {
  const orientation = state.orientation;
  if (!orientation) return null;
  const approved = orientationApprovedProposals(state);
  const unresolved = orientationReviewedProposals(state).filter(
    (proposal) => proposal.reviewStatus === "unresolved",
  );
  const rejected = orientationReviewedProposals(state).filter(
    (proposal) => proposal.reviewStatus === "rejected",
  );
  const approvedIn = (group: Screen03ProposalGroup) =>
    approved.filter((proposal) => proposal.group === group);
  const unresolvedIn = (group: Screen03ProposalGroup) =>
    unresolved.filter((proposal) => proposal.group === group);

  const reviewedIdentity = approvedIn("identity")[0];
  const reviewedOverview = approvedIn("overview")[0];
  const identity = reviewedIdentity
    ? resolvedProposalValue(reviewedIdentity)
    : state.eventIdentity.canonicalTitle;
  const summary = reviewedOverview
    ? orientationSentence(resolvedProposalValue(reviewedOverview), 55, 800)
    : orientationSentence(
        `Screen 3 is reviewing ${identity}; no overview statement has yet been confirmed`,
        55,
        800,
      );

  const pointCandidates = [
    ...approvedIn("overview").slice(reviewedOverview ? 1 : 0).map((proposal) =>
      resolvedProposalValue(proposal)
    ),
    ...approvedIn("component").map((proposal) => resolvedProposalValue(proposal)),
    ...approvedIn("amendment").map((proposal) =>
      `Later change: ${resolvedProposalValue(proposal)}`
    ),
    ...unresolved
      .filter((proposal) => [
        "overview",
        "component",
        "amendment",
      ].includes(proposal.group))
      .map((proposal) =>
        `${proposal.label} remains unresolved and its preliminary value still requires verification`
      ),
    "Screen 3 is checking the selected event identity against retained evidence",
    "Only researcher-reviewed, directly supported facts replace preliminary wording here",
    "Coverage, timing, and later changes remain qualified until their fields are resolved",
  ].map((point) => orientationSentence(point, 20, 300));
  const keyPoints = [...new Map(
    pointCandidates.map((point) => [point.toLocaleLowerCase("en-US"), point]),
  ).values()].slice(0, 5);
  while (keyPoints.length < 3) {
    keyPoints.push(orientationSentence(
      `Detailed Event Card field ${keyPoints.length + 1} still requires review`,
      20,
      300,
    ));
  }

  const eligibility = approvedIn("eligibility");
  const unresolvedEligibility = unresolvedIn("eligibility");
  const whoIsAffected = eligibility.length > 0
    ? orientationSentence(
        eligibility.map((proposal) => resolvedProposalValue(proposal)).join(" "),
        40,
        500,
      )
    : unresolvedEligibility.length > 0
      ? orientationSentence(
          "Who is broadly affected remains unresolved in the detailed Screen 3 review",
          40,
          500,
        )
      : orientationSentence(
          "Who is broadly affected has not yet been confirmed on Screen 3",
          40,
          500,
        );

  const timing = approvedIn("timeline")
    .filter((proposal): proposal is Screen03TimelineProposal =>
      proposal.group === "timeline"
    )
    .sort((left, right) =>
      resolvedProposalValue(left).localeCompare(resolvedProposalValue(right))
    );
  const unresolvedTiming = unresolvedIn("timeline");
  const keyTiming = timing.length > 0
    ? orientationSentence(
        timing.map((proposal) =>
          `${proposal.label} is ${resolvedProposalValue(proposal)}`
        ).join(" "),
        40,
        500,
      )
    : unresolvedTiming.length > 0
      ? orientationSentence(
          "Important timing remains unresolved in the detailed Screen 3 review",
          40,
          500,
        )
      : orientationSentence(
          "Important dates have not yet been confirmed on Screen 3",
          40,
          500,
        );

  const unresolvedConflicts = state.contradictions.filter(
    (contradiction) => contradiction.status === "unresolved",
  );
  const caveatLead = unresolvedConflicts.length > 0
    ? `Screen 3 still records ${unresolvedConflicts.length} unresolved evidence conflict${unresolvedConflicts.length === 1 ? "" : "s"}`
    : rejected.length > 0
      ? `${rejected.length} rejected preliminary claim${rejected.length === 1 ? " has" : "s have"} been excluded from this orientation`
      : unresolved.length > 0
        ? `${unresolved.length} reviewed field${unresolved.length === 1 ? " remains" : "s remain"} explicitly unresolved`
        : state.researchCoverage.gaps[0] ??
          "Exact coverage rules, operative dates, and later amendments still require detailed verification";
  const importantCaveat = orientationSentence(
    `${caveatLead}. This orientation does not establish legal coverage, exogeneity, a causal mechanism, or realized effects`,
    35,
    450,
  );
  return requireScreen02ShockGlance({
    ...clone(orientation.initial),
    summary,
    keyPoints,
    whoIsAffected,
    keyTiming,
    importantCaveat,
    // The orientation's source list remains the retained Screen 2 provenance.
    // Screen 3 proposal/passages used for refinement are recorded separately
    // in `fieldsUsed` and remain visible in the factual review below.
    sourceIds: [...orientation.initial.sourceIds],
    updatedAt: at,
  });
}

function refineScreen03Orientation(
  previous: Screen03VerificationState,
  next: Screen03VerificationState,
  input: Omit<Screen03OrientationRefinement,
    "id" | "fieldsUsed" | "previousGlanceFingerprint" | "nextGlanceFingerprint">,
) {
  if (!previous.orientation || !next.orientation) return next.orientation;
  const current = rebuildScreen03OrientationGlance(next, input.at);
  if (!current) return next.orientation;
  const fieldsUsed = orientationReviewedProposals(next)
    .map((proposal) => proposal.id)
    .sort((left, right) => left.localeCompare(right));
  const refinement: Screen03OrientationRefinement = {
    ...input,
    id: `${next.runId}:orientation-refinement:${previous.orientation.refinements.length + 1}`,
    fieldsUsed,
    previousGlanceFingerprint: fingerprintScreen03Value(
      previous.orientation.current,
    ),
    nextGlanceFingerprint: fingerprintScreen03Value(current),
  };
  return {
    ...next.orientation,
    initial: clone(previous.orientation.initial),
    current: clone(current),
    provenance: "screen-03-reviewed" as const,
    refinements: [...previous.orientation.refinements, refinement],
  };
}

function resetScreen03OrientationForResearchRefresh(
  previous: Screen03VerificationState,
  candidate: Screen03VerificationState,
  at: string,
) {
  if (!previous.orientation || !candidate.orientation) {
    return candidate.orientation;
  }
  const current = requireScreen02ShockGlance({
    ...clone(previous.orientation.initial),
    updatedAt: at,
  });
  const refinement: Screen03OrientationRefinement = {
    id: `${candidate.runId}:orientation-refinement:${previous.orientation.refinements.length + 1}`,
    at,
    decision: "research-refreshed",
    proposalId: null,
    fieldsUsed: [],
    reason:
      "The bounded evidence packet changed, so reviewed wording was removed and the original Screen 2 orientation was restored pending new decisions.",
    previousGlanceFingerprint: fingerprintScreen03Value(
      previous.orientation.current,
    ),
    nextGlanceFingerprint: fingerprintScreen03Value(current),
  };
  return {
    ...candidate.orientation,
    initial: clone(previous.orientation.initial),
    current: clone(current),
    provenance: "screen-03-reviewed" as const,
    refinements: [...previous.orientation.refinements, refinement],
  };
}

function lockedAcceptedProposal(proposal: Screen03AnyProposal): Screen03LockedAcceptedProposal {
  if (proposal.reviewStatus !== "accepted" && proposal.reviewStatus !== "edited") {
    fail(`Proposal ${proposal.id} is not accepted for the Event Card.`);
  }
  return {
    id: proposal.id,
    group: proposal.group,
    label: proposal.label,
    proposedValue: proposal.value,
    resolvedValue: resolvedProposalValue(proposal),
    critical: proposal.critical,
    decision: proposal.reviewStatus,
    support: proposal.support,
    sourceIds: [...proposal.sourceIds],
    passageIds: [...proposal.passageIds],
    uncertainty: proposal.uncertainty,
    timeline: proposal.group === "timeline"
      ? {
          stage: proposal.stage,
          proposedDate: proposal.date,
          resolvedDate: resolvedProposalValue(proposal),
        }
      : null,
  };
}

function acceptedGroup<T extends Screen03AnyProposal>(proposals: T[]) {
  return proposals
    .filter((proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited")
    .map(lockedAcceptedProposal);
}

function lockedAcceptedProposalGroups(groups: Screen03ProposalGroups): Screen03LockedAcceptedProposalGroups {
  return {
    identity: acceptedGroup(groups.identity),
    overview: acceptedGroup(groups.overview),
    timeline: acceptedGroup(groups.timeline),
    component: acceptedGroup(groups.component),
    eligibility: acceptedGroup(groups.eligibility),
    amendment: acceptedGroup(groups.amendment),
    requiredVariable: [],
  };
}

function informationalTimelineLockedAcceptedProposalGroups(
  groups: Screen03ProposalGroups,
): Screen03LockedAcceptedProposalGroups {
  return {
    ...lockedAcceptedProposalGroups(groups),
    timeline: [],
  };
}

function legacyLockedAcceptedProposalGroups(
  groups: Screen03ProposalGroups,
): Screen03LockedAcceptedProposalGroups {
  return {
    ...lockedAcceptedProposalGroups(groups),
    timeline: acceptedGroup(groups.timeline),
  };
}

function lockedReviewedProposal(
  proposal: Screen03AnyProposal,
  state: Screen03VerificationState,
): Screen03LockedReviewedProposal {
  if (proposal.reviewStatus === "proposed") {
    fail(`Proposal ${proposal.id} has no researcher decision.`);
  }
  const approved =
    proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited";
  const resolvedValue = approved ? resolvedProposalValue(proposal) : null;
  const decisionEvent = [...state.history]
    .reverse()
    .find(
      (event) =>
        event.action === "review-field" && event.targetId === proposal.id,
    );
  if (!decisionEvent || decisionEvent.nextReviewStatus !== proposal.reviewStatus) {
    fail(`Proposal ${proposal.id} lacks its final human decision event.`);
  }
  return {
    id: proposal.id,
    group: proposal.group,
    label: proposal.label,
    proposedValue: proposal.value,
    resolvedValue,
    critical: proposal.critical,
    decision: proposal.reviewStatus,
    decisionReason: decisionEvent.reason,
    decidedAt: decisionEvent.at,
    support: proposal.support,
    sourceIds: [...proposal.sourceIds],
    passageIds: [...proposal.passageIds],
    uncertainty: proposal.uncertainty,
    timeline: proposal.group === "timeline"
      ? {
          stage: proposal.stage,
          proposedDate: proposal.date,
          resolvedDate: approved ? resolvedValue : null,
        }
      : null,
  };
}

function lockedReviewedProposalGroups(
  groups: Screen03ProposalGroups,
  state: Screen03VerificationState,
): Screen03LockedReviewedProposalGroups {
  const snapshot = (proposal: Screen03AnyProposal) =>
    lockedReviewedProposal(proposal, state);
  return {
    identity: groups.identity.map(snapshot),
    overview: groups.overview.map(snapshot),
    timeline: groups.timeline.map(snapshot),
    component: groups.component.map(snapshot),
    eligibility: groups.eligibility.map(snapshot),
    amendment: groups.amendment.map(snapshot),
    requiredVariable: [],
  };
}

function informationalTimelineLockedReviewedProposalGroups(
  groups: Screen03ProposalGroups,
  state: Screen03VerificationState,
): Screen03LockedReviewedProposalGroups {
  return {
    ...lockedReviewedProposalGroups(groups, state),
    timeline: [],
  };
}

function legacyLockedReviewedProposalGroups(
  groups: Screen03ProposalGroups,
  state: Screen03VerificationState,
): Screen03LockedReviewedProposalGroups {
  const snapshot = (proposal: Screen03AnyProposal) =>
    lockedReviewedProposal(proposal, state);
  return {
    identity: groups.identity.map(snapshot),
    overview: groups.overview.map(snapshot),
    timeline: groups.timeline.map(snapshot),
    component: groups.component.map(snapshot),
    eligibility: groups.eligibility.map(snapshot),
    amendment: groups.amendment.map(snapshot),
    requiredVariable: groups.requiredVariable
      .filter(screen03ProposalIsAssessmentUnavailableCheck)
      .map(snapshot),
  };
}

function lockedTimelineEntry(proposal: Screen03TimelineProposal): Screen03LockedTimelineEntry {
  return {
    proposalId: proposal.id,
    label: proposal.label,
    stage: proposal.stage,
    proposedDate: proposal.date,
    resolvedDate: resolvedProposalValue(proposal),
    sourceIds: [...proposal.sourceIds],
    passageIds: [...proposal.passageIds],
  };
}

function timelineProposalHasActiveSourceLink(
  proposal: Screen03TimelineProposal,
  evidence: Screen03EvidenceItem[],
) {
  if (proposal.support === "unsupported") return false;
  const sourceIds = new Set(proposal.sourceIds);
  const passageIds = new Set(proposal.passageIds);
  return evidence.some(
    (item) =>
      item.status !== "changed" &&
      (sourceIds.has(item.id) ||
        (item.sourceId !== null && sourceIds.has(item.sourceId)) ||
        item.passages.some((passage) => passageIds.has(passage.id))),
  );
}

function resolvedEventIdentity(state: Screen03VerificationState): Screen03ResolvedEventIdentity {
  const identity: Omit<
    Screen03ResolvedEventIdentity,
    "upstreamProvisionalIdentity" | "fieldResolutions"
  > = {
    canonicalTitle: null,
    commonNames: [],
    formalIdentifier: null,
    issuer: null,
    issuingJurisdiction: null,
    eventType: null,
    status: null,
  };
  const accepted = state.proposals.identity.filter(
    (proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited",
  );
  for (const proposal of accepted) {
    const value = resolvedProposalValue(proposal);
    switch (proposalOfficialField(proposal)) {
      case "canonical-title":
        identity.canonicalTitle = value;
        break;
      case "common-name":
        if (!identity.commonNames.includes(value)) identity.commonNames.push(value);
        break;
      case "formal-identifier":
        identity.formalIdentifier = value;
        break;
      case "issuer":
        identity.issuer = value;
        break;
      case "issuing-jurisdiction":
        identity.issuingJurisdiction = value;
        break;
      case "event-type":
        identity.eventType = value;
        break;
      case "status":
        identity.status = value;
        break;
      default:
        break;
    }
  }
  return {
    ...identity,
    upstreamProvisionalIdentity: clone(state.eventIdentity),
    fieldResolutions: accepted.map((proposal) => ({
      proposalId: proposal.id,
      label: proposal.label,
      resolvedValue: resolvedProposalValue(proposal),
    })),
  };
}

function lockedEventCardInputForGate(
  state: Screen03VerificationState,
  lockedAt: string,
  gate: "explicit-timeline" | "informational-timeline" | "legacy-all-evidence",
): Omit<Screen03LockedEventCard, "eventCardFingerprint"> {
  const timelineProposals = gate === "informational-timeline"
    ? state.proposals.timeline.filter((proposal) =>
        timelineProposalHasActiveSourceLink(proposal, state.evidence)
      )
    : state.proposals.timeline.filter(
        (proposal) =>
          proposal.reviewStatus === "accepted" ||
          proposal.reviewStatus === "edited",
      );
  const timeline = timelineProposals.map(lockedTimelineEntry);
  const focalId = state.focalClock.selectedProposalId;
  const selected = focalId === null
    ? null
    : timeline.find((item) => item.proposalId === focalId) ?? null;
  const alternatives = state.focalClock.alternativeProposalIds.map((proposalId) => {
    const entry = timeline.find((item) => item.proposalId === proposalId);
    if (!entry) fail(`Alternative clock ${proposalId} is not an accepted timeline entry.`);
    return entry;
  });
  const factual = gate === "informational-timeline"
    ? legacyNonTimelineFactualClaims(state.proposals)
    : screen03FactualClaims(state.proposals);
  const reviewProposals = gate === "legacy-all-evidence"
    ? legacyEvidenceDecisionProposals(state.proposals)
    : factual;
  const evidenceProposals = gate === "informational-timeline"
    ? [...factual, ...timelineProposals]
    : reviewProposals;
  const linkedSourceIds = new Set(
    evidenceProposals.flatMap((proposal) => proposal.sourceIds),
  );
  const linkedPassageIds = new Set(
    evidenceProposals.flatMap((proposal) => proposal.passageIds),
  );
  const linkedEvidence = state.evidence
    .filter((item) =>
      linkedSourceIds.has(item.id) ||
      (item.sourceId !== null && linkedSourceIds.has(item.sourceId)) ||
      item.passages.some((passage) => linkedPassageIds.has(passage.id)))
    .map((item) => ({
      ...clone(item),
      passages: item.passages.filter((passage) => linkedPassageIds.has(passage.id)).map(clone),
    }));
  return {
    lockedAt,
    eventIdentity: resolvedEventIdentity(state),
    acceptedProposals: gate === "legacy-all-evidence"
      ? legacyLockedAcceptedProposalGroups(state.proposals)
      : gate === "informational-timeline"
      ? informationalTimelineLockedAcceptedProposalGroups(state.proposals)
      : lockedAcceptedProposalGroups(state.proposals),
    reviewedProposals: gate === "legacy-all-evidence"
      ? legacyLockedReviewedProposalGroups(state.proposals, state)
      : gate === "informational-timeline"
      ? informationalTimelineLockedReviewedProposalGroups(
          state.proposals,
          state,
        )
      : lockedReviewedProposalGroups(state.proposals, state),
    timeline,
    focalClock: { selected, alternatives },
    linkedEvidence,
    contradictions: clone(state.contradictions),
    limitations: {
      gaps: [...state.researchCoverage.gaps],
      unknownProposalIds: reviewProposals.filter((proposal) => proposal.reviewStatus === "unresolved").map((proposal) => proposal.id),
      rejectedProposalIds: reviewProposals.filter((proposal) => proposal.reviewStatus === "rejected").map((proposal) => proposal.id),
      unsupportedProposalIds: reviewProposals.filter((proposal) => proposal.support === "unsupported").map((proposal) => proposal.id),
      uncertainties: reviewProposals
        .filter((proposal) => proposal.uncertainty !== null)
        .map((proposal) => ({ proposalId: proposal.id, note: proposal.uncertainty! })),
    },
    researchCoverage: clone(state.researchCoverage),
    outcomeValuesInspected: false,
  };
}

function lockedEventCardInput(
  state: Screen03VerificationState,
  lockedAt: string,
) {
  return lockedEventCardInputForGate(state, lockedAt, "explicit-timeline");
}

function informationalTimelineLockedEventCardInput(
  state: Screen03VerificationState,
  lockedAt: string,
) {
  return lockedEventCardInputForGate(state, lockedAt, "informational-timeline");
}

function legacyLockedEventCardInput(
  state: Screen03VerificationState,
  lockedAt: string,
) {
  return lockedEventCardInputForGate(state, lockedAt, "legacy-all-evidence");
}

function validateLockedEventCard(
  value: unknown,
  state: Screen03VerificationState,
): "none" | "explicit-timeline" | "informational-timeline" | "legacy-all-evidence" {
  if (value === null) return "none";
  assertRecord(value, "lockedEventCard");
  assertExactKeys(value, [
    "lockedAt", "eventIdentity", "acceptedProposals", "reviewedProposals", "timeline", "focalClock",
    "linkedEvidence", "contradictions", "limitations", "researchCoverage",
    "outcomeValuesInspected", "eventCardFingerprint",
  ], "lockedEventCard");
  assertUtcTimestamp(value.lockedAt, "lockedEventCard.lockedAt");
  assertFingerprint(value.eventCardFingerprint, "lockedEventCard.eventCardFingerprint");
  const { eventCardFingerprint: _fingerprint, ...input } = value;
  if (value.eventCardFingerprint !== fingerprintScreen03Value(input)) fail("Event Card fingerprint is invalid.");
  // A context-only refresh may advance state.updatedAt without changing the
  // evidentiary lock. The card retains the time at which it was approved.
  const serialized = serializeDeterministicJson(input);
  const matches = (
    build: (state: Screen03VerificationState, lockedAt: string) =>
      Omit<Screen03LockedEventCard, "eventCardFingerprint">,
  ) => {
    try {
      return serialized === serializeDeterministicJson(
        build(state, value.lockedAt as string),
      );
    } catch {
      return false;
    }
  };
  if (matches(lockedEventCardInput)) {
    return "explicit-timeline";
  }
  if (matches(informationalTimelineLockedEventCardInput)) {
    return "informational-timeline";
  }
  if (matches(legacyLockedEventCardInput)) {
    return "legacy-all-evidence";
  }
  fail("Locked Event Card does not match the reviewed state.");
}

function assertScreen03Orientation(
  value: unknown,
  state: Screen03VerificationState,
) {
  assertRecord(value, "screen03State.orientation");
  assertExactKeys(value, [
    "schemaVersion",
    "upstreamEventFingerprint",
    "initial",
    "current",
    "provenance",
    "refinements",
  ], "screen03State.orientation");
  if (value.schemaVersion !== SCREEN_03_ORIENTATION_STATE_SCHEMA_VERSION) {
    fail("Screen 3 orientation schema is unsupported.");
  }
  assertFingerprint(
    value.upstreamEventFingerprint,
    "screen03State.orientation.upstreamEventFingerprint",
  );
  if (value.upstreamEventFingerprint !== state.upstream.eventFingerprint) {
    fail("Screen 3 orientation targets a different upstream event.");
  }
  const initial = requireScreen02ShockGlance(value.initial);
  const current = requireScreen02ShockGlance(value.current);
  const initialBinding = {
    runId: initial.runId,
    candidateSnapshotId: initial.candidateSnapshotId,
    candidateFingerprint: initial.candidateFingerprint,
    selectedEventId: initial.selectedEventId,
    eventFingerprint: initial.eventFingerprint,
    createdAt: initial.createdAt,
    origin: initial.origin,
  };
  const currentBinding = {
    runId: current.runId,
    candidateSnapshotId: current.candidateSnapshotId,
    candidateFingerprint: current.candidateFingerprint,
    selectedEventId: current.selectedEventId,
    eventFingerprint: current.eventFingerprint,
    createdAt: current.createdAt,
    origin: current.origin,
  };
  if (
    serializeDeterministicJson(initialBinding) !==
      serializeDeterministicJson(currentBinding) ||
    initial.runId !== state.upstream.runId ||
    initial.eventFingerprint !== state.upstream.eventFingerprint ||
    initial.selectedEventId !== state.history[0]?.targetId
  ) {
    fail("Screen 3 orientation lost its exact Screen 2 event binding.");
  }
  if (initial.updatedAt > state.updatedAt || current.updatedAt > state.updatedAt) {
    fail("Screen 3 orientation cannot postdate its workflow state.");
  }
  if (![
    "screen-02-preliminary",
    "screen-02-qualified-preliminary",
    "screen-03-reviewed",
  ].includes(value.provenance as string)) {
    fail("Screen 3 orientation provenance is invalid.");
  }
  if (!Array.isArray(value.refinements) || value.refinements.length > MAX_HISTORY) {
    fail("Screen 3 orientation refinements must be bounded.");
  }
  let previousFingerprint = fingerprintScreen03Value(initial);
  let previousAt = initial.updatedAt;
  const ids = new Set<string>();
  for (const [index, refinement] of value.refinements.entries()) {
    const label = `screen03State.orientation.refinements[${index}]`;
    assertRecord(refinement, label);
    assertExactKeys(refinement, [
      "id",
      "at",
      "decision",
      "proposalId",
      "fieldsUsed",
      "reason",
      "previousGlanceFingerprint",
      "nextGlanceFingerprint",
    ], label);
    assertString(refinement.id, `${label}.id`);
    if (ids.has(refinement.id as string)) fail("Orientation refinement IDs must be unique.");
    ids.add(refinement.id as string);
    assertUtcTimestamp(refinement.at, `${label}.at`);
    if ((refinement.at as string) < previousAt || (refinement.at as string) > state.updatedAt) {
      fail("Orientation refinement timestamps are invalid.");
    }
    previousAt = refinement.at as string;
    if (![
      "accept",
      "edit",
      "reject",
      "unresolved",
      "confirm-all",
      "unconfirm-all",
      "source-changed",
      "contradiction-resolved",
      "research-refreshed",
    ].includes(refinement.decision as string)) {
      fail(`${label}.decision is invalid.`);
    }
    assertNullableString(refinement.proposalId, `${label}.proposalId`);
    assertStringArray(refinement.fieldsUsed, `${label}.fieldsUsed`, MAX_PROPOSALS_PER_GROUP * 7);
    assertString(refinement.reason, `${label}.reason`, MAX_LONG);
    assertFingerprint(refinement.previousGlanceFingerprint, `${label}.previousGlanceFingerprint`);
    assertFingerprint(refinement.nextGlanceFingerprint, `${label}.nextGlanceFingerprint`);
    if (refinement.previousGlanceFingerprint !== previousFingerprint) {
      fail("Screen 3 orientation refinement history is not continuous.");
    }
    previousFingerprint = refinement.nextGlanceFingerprint as string;
  }
  const currentFingerprint = fingerprintScreen03Value(current);
  if (previousFingerprint !== currentFingerprint) {
    fail("Screen 3 orientation history does not resolve to the displayed glance.");
  }
  const refined = value.refinements.length > 0;
  if (
    (refined
      ? value.provenance !== "screen-03-reviewed"
      : ![
          "screen-02-preliminary",
          "screen-02-qualified-preliminary",
        ].includes(value.provenance as string)) ||
    (!refined && fingerprintScreen03Value(initial) !== currentFingerprint) ||
    (refined && current.updatedAt !== previousAt)
  ) {
    fail("Screen 3 orientation provenance and refinement state differ.");
  }
}

function validateState(value: unknown): value is Screen03VerificationState {
  assertRecord(value, "screen03State");
  const hasContextLeads = Object.prototype.hasOwnProperty.call(value, "contextLeads");
  const hasInterpretation = Object.prototype.hasOwnProperty.call(
    value,
    "interpretation",
  );
  const hasOrientation = Object.prototype.hasOwnProperty.call(
    value,
    "orientation",
  );
  const hasBriefing = Object.prototype.hasOwnProperty.call(value, "briefing");
  const hasSourceChanges = Object.prototype.hasOwnProperty.call(
    value,
    "sourceChanges",
  );
  const hasDirectSupportSearches = Object.prototype.hasOwnProperty.call(
    value,
    "directSupportSearches",
  );
  assertExactKeys(
    value,
    [
      ...ROOT_KEYS,
      ...(hasContextLeads ? ["contextLeads"] : []),
      ...(hasOrientation ? ["orientation"] : []),
      ...(hasInterpretation ? ["interpretation"] : []),
      ...(hasBriefing ? ["briefing"] : []),
      ...(hasSourceChanges ? ["sourceChanges"] : []),
      ...(hasDirectSupportSearches ? ["directSupportSearches"] : []),
    ],
    "screen03State",
  );
  if (
    value.schemaVersion !== SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION ||
    ![
      SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
      SHOCKAUDIT_V031_RELEASE_LABEL,
      SHOCKAUDIT_V032_RELEASE_LABEL,
      SHOCKAUDIT_V033_RELEASE_LABEL,
      SHOCKAUDIT_V034_RELEASE_LABEL,
      SHOCKAUDIT_V035_RELEASE_LABEL,
      SHOCKAUDIT_V036_RELEASE_LABEL,
      SHOCKAUDIT_V037_RELEASE_LABEL,
      SHOCKAUDIT_V038_RELEASE_LABEL,
      SHOCKAUDIT_V039_RELEASE_LABEL,
      SHOCKAUDIT_V0310_RELEASE_LABEL,
      SHOCKAUDIT_V0311_RELEASE_LABEL,
      SHOCKAUDIT_V0312_RELEASE_LABEL,
      SHOCKAUDIT_V0313_RELEASE_LABEL,
      SHOCKAUDIT_V0314_RELEASE_LABEL,
      SHOCKAUDIT_V0315_RELEASE_LABEL,
      SHOCKAUDIT_V0316_RELEASE_LABEL,
      SHOCKAUDIT_V0317_RELEASE_LABEL,
    ].includes(value.releaseLabel as Screen03ReleaseLabel)
  ) fail("Screen 3 schema is unsupported.");
  if (!["loading", "reviewing", "locked"].includes(value.status as string)) fail("Screen 3 status is invalid.");
  assertString(value.runId, "screen03State.runId");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0 || (value.revision as number) > MAX_HISTORY) fail("Screen 3 revision is invalid.");
  assertUtcTimestamp(value.createdAt, "screen03State.createdAt");
  assertUtcTimestamp(value.updatedAt, "screen03State.updatedAt");
  if (value.updatedAt < value.createdAt) fail("Screen 3 timestamps are reversed.");
  assertRecord(value.upstream, "screen03State.upstream");
  assertExactKeys(value.upstream, ["schemaVersion", "runId", "eventFingerprint", "handoffFingerprint"], "screen03State.upstream");
  if (value.upstream.schemaVersion !== SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION) fail("Screen 3 requires the v4 handoff.");
  assertString(value.upstream.runId, "screen03State.upstream.runId");
  assertFingerprint(value.upstream.eventFingerprint, "screen03State.upstream.eventFingerprint");
  assertFingerprint(value.upstream.handoffFingerprint, "screen03State.upstream.handoffFingerprint");
  assertEventIdentity(value.eventIdentity, "screen03State.eventIdentity");
  assertCoverage(
    value.researchCoverage,
    "screen03State.researchCoverage",
    true,
    MAX_ACTIVE_STATE_EVIDENCE,
  );
  if (hasContextLeads) {
    assertContextLeads(value.contextLeads, "screen03State.contextLeads");
  }
  assertEvidence(
    value.evidence,
    "screen03State.evidence",
    MAX_STATE_EVIDENCE,
  );
  assertProposalGroups(
    value.proposals,
    "screen03State.proposals",
    MAX_CARRIED_PROPOSAL_REFERENCES,
  );
  validateHistory(value.history, "screen03State.history");
  if (hasDirectSupportSearches) {
    assertDirectSupportSearches(
      value.directSupportSearches,
      value.updatedAt as string,
      value.history as Screen03AuditEvent[],
    );
  } else if ((value.history as Screen03AuditEvent[]).some(
    (event) => event.action === "direct-support-searched",
  )) {
    fail("A direct-support audit event requires its immutable result record.");
  }
  const versionedStaleEvidence = (value.evidence as Screen03EvidenceItem[])
    .filter((item) =>
      item.status === "changed" && item.passages.some((passage) =>
        passage.status === "stale" ||
        passage.contentFingerprint !== undefined
      )
    );
  const ledgerHistory = (value.history as Screen03AuditEvent[]).some(
    screen03HistoryUsesSourceChangeLedger,
  );
  if ((versionedStaleEvidence.length > 0 || ledgerHistory) &&
    !hasSourceChanges) {
    fail("Versioned Screen 3 source changes require their immutable ledger.");
  }
  if (hasSourceChanges) {
    assertSourceChanges(
      value.sourceChanges,
      value.evidence as Screen03EvidenceItem[],
      value.updatedAt as string,
      value.history as Screen03AuditEvent[],
    );
    const recordedStaleEvidenceIds = new Set(
      (value.sourceChanges as Screen03SourceChangeRecord[]).flatMap((record) =>
        record.staleEvidenceIds
      ),
    );
    if (versionedStaleEvidence.some((item) =>
      !recordedStaleEvidenceIds.has(item.id)
    )) {
      fail("Versioned stale evidence is missing from source-change history.");
    }
  }
  if (hasInterpretation) {
    assertInterpretation(
      value.interpretation,
      "screen03State.interpretation",
      value.evidence as Screen03EvidenceItem[],
      value.proposals as Screen03ProposalGroups,
    );
  }
  if (hasBriefing) {
    const briefing = restoreScreen03BriefingLifecycle(value.briefing);
    if (!briefing) fail("screen03State.briefing is invalid.");
    const evidenceIds = new Set(
      (value.evidence as Screen03EvidenceItem[]).map((item) => item.id),
    );
    const activeEvidenceIds = new Set(
      (value.evidence as Screen03EvidenceItem[])
        .filter((item) => item.status !== "changed")
        .map((item) => item.id),
    );
    for (const proposal of briefing.proposals) {
      if (proposal.provenance.eventFingerprint !== value.upstream.eventFingerprint) {
        fail("A Screen 3 briefing proposal targets a different event.");
      }
      if (proposal.provenance.sourceRevision >= (value.revision as number)) {
        fail("A Screen 3 briefing proposal must predate its integration revision.");
      }
      if (proposal.provenance.generatedAt > (value.updatedAt as string)) {
        fail("A Screen 3 briefing proposal cannot postdate the workflow state.");
      }
      const proposalEraEvidenceIds = proposal.provenance.evidenceSnapshot
        ? new Set(proposal.provenance.evidenceSnapshot.map((item) => item.evidenceId))
        : evidenceIds;
      if (proposal.provenance.evidenceIds.some((id) => !proposalEraEvidenceIds.has(id))) {
        fail("A Screen 3 briefing proposal references evidence outside its immutable proposal-era snapshot.");
      }
      const current = briefing.activeProposalId === proposal.proposalId;
      for (const key of screen03BriefingFactualSectionKeys) {
        if (proposal.content.sectionEvidenceIds[key].some((id) => !proposalEraEvidenceIds.has(id))) {
          fail(`A Screen 3 briefing ${key} section references evidence outside its immutable proposal-era snapshot.`);
        }
        if (current && proposal.content.sectionEvidenceIds[key].some(
          (id) => !activeEvidenceIds.has(id)
        )) {
          fail(`The current Screen 3 briefing ${key} section requires active canonical evidence.`);
        }
      }
      if (
        proposal.content.briefingStatus === "complete" &&
        screen03BriefingFactualSectionKeys.some(
          (key) => proposal.content.sectionEvidenceIds[key].length === 0,
        )
      ) {
        fail("A complete Screen 3 briefing requires evidence for every factual section.");
      }
      if (
        proposal.content.briefingStatus !== "complete" &&
        proposal.content.unresolvedUncertainties.length === 0
      ) {
        fail("An incomplete or conflicted Screen 3 briefing must preserve an explicit uncertainty.");
      }
      if (!/ChatGPT interpretation/iu.test(
        proposal.content.plausiblePathwayToResearcherOutcome,
      )) {
        fail("The outcome pathway must be visibly labelled as a ChatGPT interpretation.");
      }
    }
    if (briefing.decisions.some((decision) =>
      decision.decidedAt > (value.updatedAt as string)
    )) {
      fail("A Screen 3 briefing decision cannot postdate the workflow state.");
    }
    const decidedProposalIds = new Set<string>();
    for (const decision of briefing.decisions) {
      if (decidedProposalIds.has(decision.proposalId)) {
        fail("A Screen 3 briefing proposal can have only one terminal researcher decision.");
      }
      decidedProposalIds.add(decision.proposalId);
    }
    if (
      briefing.activeProposalId !== null &&
      decidedProposalIds.has(briefing.activeProposalId) &&
      (!briefing.confirmedIsCurrent ||
        briefing.confirmed?.proposalId !== briefing.activeProposalId)
    ) {
      fail("A decided Screen 3 briefing proposal cannot remain active unless it is the current confirmed briefing.");
    }
    for (const decision of briefing.decisions) {
      if (!decision.content) continue;
      const proposal = briefing.proposals.find((item) =>
        item.proposalId === decision.proposalId
      );
      if (!proposal) fail("A Screen 3 briefing decision lost its proposal provenance.");
      const proposalEraEvidenceIds = proposal.provenance.evidenceSnapshot
        ? new Set(proposal.provenance.evidenceSnapshot.map((item) => item.evidenceId))
        : evidenceIds;
      const current = briefing.confirmedIsCurrent &&
        briefing.confirmed?.decisionId === decision.decisionId;
      for (const key of screen03BriefingFactualSectionKeys) {
        if (decision.content.sectionEvidenceIds[key].some(
          (id) => !proposalEraEvidenceIds.has(id)
        )) {
          fail(`A decided Screen 3 briefing ${key} section references evidence outside its immutable proposal-era snapshot.`);
        }
        if (current && decision.content.sectionEvidenceIds[key].some(
          (id) => !activeEvidenceIds.has(id)
        )) {
          fail(`The current decided Screen 3 briefing ${key} section requires active canonical evidence.`);
        }
      }
      if (
        decision.content.briefingStatus === "complete" &&
        screen03BriefingFactualSectionKeys.some(
          (key) => decision.content!.sectionEvidenceIds[key].length === 0,
        )
      ) {
        fail("A complete decided Screen 3 briefing requires evidence for every factual section.");
      }
      if (
        decision.content.briefingStatus !== "complete" &&
        decision.content.unresolvedUncertainties.length === 0
      ) {
        fail("An incomplete or conflicted decided Screen 3 briefing must preserve an explicit uncertainty.");
      }
      if (!/ChatGPT interpretation/iu.test(
        decision.content.plausiblePathwayToResearcherOutcome,
      )) {
        fail("A decided outcome pathway must be visibly labelled as a ChatGPT interpretation.");
      }
    }
  }
  assertContradictions(value.contradictions, "screen03State.contradictions");
  assertRecord(value.focalClock, "screen03State.focalClock");
  assertExactKeys(value.focalClock, ["selectedProposalId", "alternativeProposalIds"], "screen03State.focalClock");
  assertNullableString(value.focalClock.selectedProposalId, "screen03State.focalClock.selectedProposalId");
  assertStringArray(value.focalClock.alternativeProposalIds, "screen03State.focalClock.alternativeProposalIds");
  if (value.outcomeValuesInspected !== false) fail("Screen 3 must remain outcome-blind.");
  assertRecord(value.integrity, "screen03State.integrity");
  assertExactKeys(value.integrity, ["stateFingerprint"], "screen03State.integrity");
  assertFingerprint(value.integrity.stateFingerprint, "screen03State.integrity.stateFingerprint");
  const state = value as unknown as Screen03VerificationState;
  if (hasOrientation) assertScreen03Orientation(value.orientation, state);
  validateAssessmentUnavailableChecks(state.proposals, state.history);
  if (state.revision !== state.history.length - 1) fail("Screen 3 revision and history differ.");
  if (state.updatedAt !== state.history.at(-1)?.at) fail("Screen 3 updatedAt differs from history.");
  if (state.researchCoverage.activeEvidenceCount !== state.evidence.filter((item) => item.status !== "changed").length) fail("Screen 3 active evidence count differs from evidence.");
  validateReferences(state.evidence, state.proposals, state.contradictions, state.researchCoverage.queries);
  const proposals = new Map(allProposals(state.proposals).map((item) => [item.id, item]));
  if (
    allProposals(state.proposals).some(
      (proposal) =>
        (proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited") &&
        !screen03ProposalIsAssessmentUnavailableCheck(proposal) &&
        !screen03ProposalConfirmability(
          proposal,
          state.evidence,
          resolvedProposalValue(proposal),
          proposal.reviewStatus === "edited",
        ).confirmable,
    )
  ) {
    fail("Accepted and edited fields require a complete reviewed value with active direct passage support.");
  }
  const detectedDateContradictions = detectScreen03DateOrderContradictions(state.proposals.timeline);
  if (detectedDateContradictions.some((detected) => !state.contradictions.some((item) => item.id === detected.id))) {
    fail("A date-order contradiction was omitted from the state.");
  }
  if (state.focalClock.selectedProposalId !== null) {
    const focal = proposals.get(state.focalClock.selectedProposalId);
    if (!focal || focal.group !== "timeline") fail("Focal clock must reference a timeline proposal.");
  }
  if (state.focalClock.alternativeProposalIds.some((id) => !proposals.has(id) || proposals.get(id)?.group !== "timeline" || id === state.focalClock.selectedProposalId)) fail("Alternative clocks are invalid.");
  const lockedCardGate = validateLockedEventCard(state.lockedEventCard, state);
  if ((state.status === "locked") !== (state.lockedEventCard !== null)) fail("Screen 3 lock status and Event Card differ.");
  if (state.status === "locked") {
    const proposalsForLock = lockedCardGate === "explicit-timeline"
      ? screen03FactualClaims(state.proposals)
      : legacyNonTimelineFactualClaims(state.proposals);
    const accepted = proposalsForLock.filter(
      (proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited",
    );
    const acceptedIdentity = state.proposals.identity.filter(
      (proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited",
    );
    if (
      state.researchCoverage.status !== "completed" ||
      proposalsForLock.some((proposal) => proposal.reviewStatus === "proposed") ||
      accepted.some(
        (proposal) =>
          !screen03ProposalConfirmability(
            proposal,
            state.evidence,
            resolvedProposalValue(proposal),
            proposal.reviewStatus === "edited",
          ).confirmable,
      ) ||
      !acceptedIdentity.some((proposal) =>
        screen03ProposalConfirmability(
          proposal,
          state.evidence,
          resolvedProposalValue(proposal),
          proposal.reviewStatus === "edited",
        ).confirmable
      )
    ) {
      fail("Locked state no longer satisfies the Event Card gate.");
    }
  }
  if (state.status === "loading" && state.researchCoverage.status !== "pending") fail("Loading state must have pending research.");
  if (state.status !== "loading" && state.researchCoverage.status === "pending") fail("Reviewed state cannot have pending research.");
  if (state.integrity.stateFingerprint !== fingerprintScreen03Value(stateFingerprintInput(state))) fail("Screen 3 integrity fingerprint is invalid.");
  return true;
}

export function restoreScreen03VerificationState(value: unknown): Screen03VerificationState | null {
  try {
    const copy = clone(value);
    validateState(copy);
    return deepFreeze(copy as Screen03VerificationState);
  } catch {
    return null;
  }
}

export const restoreScreen03State = restoreScreen03VerificationState;

export function requireScreen03VerificationState(value: unknown) {
  const restored = restoreScreen03VerificationState(value);
  if (!restored) fail("Screen 3 verification state failed its exact contract.");
  return restored;
}

export const requireScreen03State = requireScreen03VerificationState;

export function serializeScreen03VerificationState(value: unknown) {
  return serializeDeterministicJson(requireScreen03VerificationState(value));
}

export const serializeScreen03State = serializeScreen03VerificationState;

export function fingerprintScreen03VerificationState(value: unknown) {
  return fingerprintScreen03Value(requireScreen03VerificationState(value));
}

export const fingerprintScreen03State = fingerprintScreen03VerificationState;

function canonicalV4Handoff(handoff: Screen02WorkflowHandoff) {
  const restored = JSON.parse(serializeScreen02WorkflowHandoff(handoff)) as Screen02WorkflowHandoff;
  if (restored.schemaVersion !== SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION) fail("Screen 3 requires screen-02-to-screen-03-event-v4.");
  return restored;
}

export function canonicalizeScreen03EvidenceRetrievedAt(
  value: string,
  fallback: string,
) {
  assertUtcTimestamp(fallback, "fallbackRetrievedAt");
  if (isCalendarDate(value)) return `${value}T00:00:00.000Z`;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  // The v4 handoff also permits a bounded non-date retrieval label.
  return fallback;
}

function carriedEvidence(
  handoff: Screen02WorkflowHandoff,
  fallbackRetrievedAt: string,
) {
  return handoff.sources.map<Screen03EvidenceItem>((source) => {
    const passage = source.evidenceText && source.evidenceText.length <= MAX_LONG
      ? [{
          id: `${source.id}:passage:1`,
          number: 1,
          text: source.evidenceText,
          locator: source.locator,
          basis: source.userProvided ? "source-excerpt" as const : "source-metadata" as const,
        }]
      : [];
    const documentType: Screen03DocumentType = (() => {
      try {
        const path = new URL(source.locator).pathname.toLocaleLowerCase("en-US");
        if (path.endsWith(".pdf")) return "pdf";
        if (/\.(?:xml|atom)$/u.test(path)) return "xml";
        if (/\.(?:json|jsonld)$/u.test(path)) return "json";
        if (/\.(?:html?|xhtml)$/u.test(path)) return "html";
        if (/\.(?:txt|text)$/u.test(path)) return "plain-text";
      } catch {
        // The strict Screen 2 handoff preserves the locator; an unparseable
        // representation remains explicitly unknown here.
      }
      return "unknown";
    })();
    const sourceRole: Screen03EvidenceSourceRole = source.userProvided
      ? "researcher-supplied-record"
      : source.authorityTier <= 2
      ? "official-record"
      : "related-secondary-record";
    return {
      id: source.id,
      sourceId: source.id,
      title: source.title,
      locator: source.locator,
      publisher: source.publisher,
      publishedDate: source.publishedDate,
      retrievedAt: canonicalizeScreen03EvidenceRetrievedAt(
        source.retrievedAt,
        fallbackRetrievedAt,
      ),
      authorityTier: source.authorityTier,
      channel: source.channel,
      sourceRole,
      sourcePlatform: source.userProvided
        ? "researcher-supplied"
        : source.authorityTier <= 2
        ? "other-official"
        : "secondary-publisher",
      documentType,
      contentFingerprint: source.sourceFingerprint,
      language: "und",
      status: "carried",
      passages: passage,
    };
  });
}

function linkedPassages(sourceIds: string[], evidence: Screen03EvidenceItem[]) {
  const linked = evidence.filter((item) => sourceIds.includes(item.id) || (item.sourceId !== null && sourceIds.includes(item.sourceId)));
  return linked.flatMap((item) => item.passages.map((passage) => passage.id));
}

function carriedProposal(
  group: Exclude<Screen03ProposalGroup, "timeline">,
  id: string,
  label: string,
  value: string,
  critical: boolean,
  sourceIds: string[],
  uncertainty: string | null,
  evidence: Screen03EvidenceItem[],
): Screen03Proposal {
  const passageIds = linkedPassages(sourceIds, evidence);
  return {
    id, group, label, value, critical, reviewStatus: "proposed", editedValue: null,
    support: passageIds.length > 0 ? "indirect" : "unsupported",
    sourceIds: [...sourceIds], passageIds, uncertainty,
  };
}

function loadingProposals(handoff: Screen02WorkflowHandoff, evidence: Screen03EvidenceItem[]): Screen03ProposalGroups {
  const identity = handoff.event.identity;
  const identityFields: Array<[string, string, string | null, boolean]> = [
    ["canonical-title", "Canonical title", identity.canonicalTitle, true],
    ...identity.commonNames.map((name, index) =>
      [`common-name-${index + 1}`, "Common name", name, false] as [
        string,
        string,
        string,
        boolean,
      ]
    ),
    ["formal-identifier", "Formal identifier", identity.formalIdentifier, identity.formalIdentifier !== null],
    ["issuer", "Issuing authority", identity.issuer, false],
    ["issuing-jurisdiction", "Issuing jurisdiction", identity.issuingJurisdiction, false],
    ["event-type", "Event type", identity.eventType, false],
    ["status", "Current status", identity.status, false],
  ];
  const sourceIds = handoff.event.sourceIds;
  const mandatoryAssessmentChecks = new Set(
    "status" in handoff.preliminaryAssessment &&
        handoff.preliminaryAssessment.status === "unavailable"
      ? handoff.preliminaryAssessment.mandatoryScreen03Checks
      : [],
  );
  const requiredVariables = [...new Set(handoff.unresolved.questions)];
  const timeline = handoff.event.dateLeads.flatMap<Screen03TimelineProposal>((lead) => {
    const date = unambiguousCalendarDate(lead.date);
    if (!date) {
      requiredVariables.push(`Verify date: ${lead.date.slice(0, 3_800)}`);
      return [];
    }
    const passageIds = linkedPassages(lead.sourceIds, evidence);
    return [{
      id: `carried:timeline:${lead.id}`, group: "timeline", label: lead.label,
      value: date, critical: true, reviewStatus: "proposed", editedValue: null,
      support: passageIds.length > 0 ? "indirect" : "unsupported",
      sourceIds: [...lead.sourceIds], passageIds, uncertainty: lead.uncertainty,
      stage: lead.stage, date,
    }];
  });
  return {
    identity: identityFields.filter((field): field is [string, string, string, boolean] => field[2] !== null).map(([id, label, value, critical]) => carriedProposal("identity", `carried:identity:${id}`, label, value, critical, sourceIds, "Carried from Screen 2; exact operative support remains unverified.", evidence)),
    overview: [carriedProposal("overview", `carried:overview:${handoff.event.description.id}`, "What happened", handoff.event.description.text, true, handoff.event.description.sourceIds, handoff.event.description.uncertainty, evidence)],
    timeline,
    component: [...handoff.event.highLevelChanges.map((claim) => carriedProposal("component", `carried:component:${claim.id}`, "Change", claim.text, true, claim.sourceIds, claim.uncertainty, evidence)), ...handoff.event.keyComponents.map((claim) => carriedProposal("component", `carried:component:${claim.id}`, "Key component", claim.text, false, claim.sourceIds, claim.uncertainty, evidence))],
    eligibility: handoff.event.broadCoverage.map((claim) => carriedProposal("eligibility", `carried:eligibility:${claim.id}`, "Coverage or eligibility", claim.text, true, claim.sourceIds, claim.uncertainty, evidence)),
    amendment: handoff.event.relatedVersions.map((version, index) => carriedProposal("amendment", `carried:amendment:${index + 1}`, `${version.relationship}: ${version.identity.canonicalTitle}`, version.note, false, version.sourceIds, "Related version carried from Screen 2; its relationship remains provisional.", evidence)),
    requiredVariable: requiredVariables.map((question, index) => {
      const mandatory = mandatoryAssessmentChecks.has(question);
      const mandatoryIndex = mandatory
        ? screen02AssessmentUnavailableScreen03Checks.indexOf(
            question as (typeof screen02AssessmentUnavailableScreen03Checks)[number],
          )
        : -1;
      return carriedProposal(
        "required-variable",
        mandatory
          ? `carried:assessment-unavailable-check:${mandatoryIndex + 1}`
          : `carried:required-variable:${index + 1}`,
        mandatory ? "Required assessment check" : "Verification needed",
        question,
        false,
        [],
        mandatory
          ? "Carried forward because the preliminary Screen 2 assessment was unavailable; this planning reminder does not block the Event Card."
          : "Carried from Screen 2.",
        evidence,
      );
    }),
  };
}

const DATE_ORDER: Partial<Record<Screen02DateLeadStage, number>> = {
  announcement: 1,
  rulemaking: 2,
  enactment: 3,
  effective: 4,
  implementation: 5,
  enforcement: 6,
};

function effectiveTimelineDate(proposal: Screen03TimelineProposal) {
  return proposal.reviewStatus === "edited" ? proposal.editedValue! : proposal.date;
}

export function detectScreen03DateOrderContradictions(
  timeline: Screen03TimelineProposal[],
): Screen03Contradiction[] {
  const contradictions: Screen03Contradiction[] = [];
  for (let leftIndex = 0; leftIndex < timeline.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < timeline.length; rightIndex += 1) {
      const left = timeline[leftIndex];
      const right = timeline[rightIndex];
      const leftOrder = DATE_ORDER[left.stage];
      const rightOrder = DATE_ORDER[right.stage];
      if (leftOrder === undefined || rightOrder === undefined || leftOrder === rightOrder) continue;
      const earlier = leftOrder < rightOrder ? left : right;
      const later = leftOrder < rightOrder ? right : left;
      if (effectiveTimelineDate(earlier) <= effectiveTimelineDate(later)) continue;
      contradictions.push({
        id: `date-order:${fingerprintScreen03Value([earlier.id, later.id]).slice("fnv1a64:".length)}`,
        kind: "date-order",
        proposalIds: [earlier.id, later.id],
        summary: `${earlier.stage} date ${effectiveTimelineDate(earlier)} is later than ${later.stage} date ${effectiveTimelineDate(later)}.`,
        status: "unresolved",
        resolution: null,
      });
    }
  }
  return contradictions;
}

function pendingCoverage(evidence: Screen03EvidenceItem[]): Screen03ResearchCoverage {
  return {
    status: "pending",
    queries: [],
    channels: [],
    routes: [],
    stages: [],
    languages: ["und"],
    authorityTiers: [...new Set(evidence.map((item) => item.authorityTier))].sort() as Screen02WorkflowSourceAuthorityTier[],
    gaps: ["Deep, stage-specific official-source research has not completed."],
    recordsReviewed: evidence.length,
    activeEvidenceCount: evidence.length,
    exhaustive: false,
    stoppingRule: {
      rule: "Search bounded official and permitted sources across identity, operative changes, timing, eligibility, amendments, and required variables.",
      status: "not-met",
      note: "Screen 3 opened immediately with carried Screen 2 evidence while deeper research starts.",
    },
    outcomeValuesInspected: false,
  };
}

export function createScreen03LoadingState(
  inputHandoff: Screen02WorkflowHandoff,
  at: string,
  inputGlance?: Screen02ShockGlance,
): Screen03VerificationState {
  assertUtcTimestamp(at, "at");
  const handoff = canonicalV4Handoff(inputHandoff);
  if (at < handoff.builtAt) fail("Screen 3 cannot predate its Screen 2 handoff.");
  const evidence = carriedEvidence(handoff, at);
  if (evidence.length > MAX_CARRIED_HANDOFF_EVIDENCE) {
    fail(
      "The Screen 2 handoff exceeds the Screen 3 carried-evidence bound.",
    );
  }
  const proposals = loadingProposals(handoff, evidence);
  const glance = requireScreen02ShockGlance(
    inputGlance ?? assembleScreen02ShockGlanceFromHandoff(handoff, at),
  );
  if (
    glance.runId !== handoff.runId ||
    glance.selectedEventId !== handoff.event.identitySnapshotId ||
    glance.eventFingerprint !== handoff.integrity.eventFingerprint
  ) {
    fail("Screen 3 shock glance targets a different Screen 2 event.");
  }
  const state: Omit<Screen03VerificationState, "integrity"> = {
    schemaVersion: SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION,
    releaseLabel: SHOCKAUDIT_V0317_RELEASE_LABEL,
    status: "loading",
    runId: handoff.runId,
    revision: 0,
    createdAt: at,
    updatedAt: at,
    upstream: {
      schemaVersion: SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
      runId: handoff.runId,
      eventFingerprint: handoff.integrity.eventFingerprint,
      handoffFingerprint: handoff.integrity.handoffFingerprint,
    },
    eventIdentity: clone(handoff.event.identity),
    researchCoverage: pendingCoverage(evidence),
    contextLeads: [],
    orientation: {
      schemaVersion: SCREEN_03_ORIENTATION_STATE_SCHEMA_VERSION,
      upstreamEventFingerprint: handoff.integrity.eventFingerprint,
      initial: clone(glance),
      current: clone(glance),
      provenance:
        isFreshScreen02SelectionQualification(
          handoff.event.preliminaryQualification,
        )
          ? "screen-02-qualified-preliminary"
          : "screen-02-preliminary",
      refinements: [],
    },
    evidence,
    proposals,
    contradictions: detectScreen03DateOrderContradictions(proposals.timeline),
    focalClock: { selectedProposalId: null, alternativeProposalIds: [] },
    history: [{
      id: "screen03-history:0:initialized",
      action: "initialized",
      targetId: handoff.event.identitySnapshotId,
      at,
      actor: "fixed-core",
      reason: "Opened Screen 3 immediately from the immutable Screen 2 v4 handoff; all carried claims remain provisional.",
      value: handoff.event.identity.canonicalTitle,
      previousReviewStatus: null,
      nextReviewStatus: null,
    }],
    lockedEventCard: null,
    outcomeValuesInspected: false,
  };
  return withIntegrity(state);
}

function mergeEvidence(carried: Screen03EvidenceItem[], researched: Screen03EvidenceItem[]) {
  // The research packet may contain the freshly normalized form of a carried
  // handoff source under a packet-specific evidence ID. Prefer that form by
  // logical source identity so one source cannot enter review with two active
  // fingerprints merely because the raw handoff and packet use different IDs.
  const map = new Map(carried
    .filter((item) => !researched.some((candidate) =>
      screen03EvidenceRepresentsSameSource(item, candidate)
    ))
    .map((item) => [item.id, item]));
  for (const item of researched) map.set(item.id, item);
  return [...map.values()];
}

type Screen03StaleEvidenceVersions = {
  evidence: Screen03EvidenceItem[];
  staleEvidenceIds: string[];
  stalePassageIds: string[];
  sourceReferenceMap: Map<string, string[]>;
  passageReferenceMap: Map<string, string>;
};

function screen03VersionedIdentifier(value: string, suffix: string) {
  const separator = ":stale:";
  return `${value.slice(0, MAX_SHORT - separator.length - suffix.length)}${separator}${suffix}`;
}

function screen03LegacyChangedIdentifier(value: string, suffix: string) {
  const separator = ":legacy-changed:";
  return `${
    value.slice(0, MAX_SHORT - separator.length - suffix.length)
  }${separator}${suffix}`;
}

/**
 * Pre-ledger states marked changed evidence in place, so the next canonical
 * retrieval legitimately reuses its evidence and passage IDs. Move only that
 * recognizable legacy shape aside before merging the active replacement; its
 * original bytes remain retained and the old workflow history stays intact.
 */
function screen03LegacyHistoricalEvidence(
  items: readonly Screen03EvidenceItem[],
  active: readonly Screen03EvidenceItem[],
) {
  const evidenceIds = new Set(active.map((item) => item.id));
  const passageIds = new Set(active.flatMap((item) =>
    item.passages.map((passage) => passage.id)
  ));
  return items.map((item) => {
    const collides = evidenceIds.has(item.id) || item.passages.some((passage) =>
      passageIds.has(passage.id)
    );
    if (!collides) {
      evidenceIds.add(item.id);
      item.passages.forEach((passage) => passageIds.add(passage.id));
      return item;
    }
    if (item.passages.some((passage) =>
      passage.status !== undefined || passage.contentFingerprint !== undefined
    )) {
      fail("Research refresh collided with immutable stale source history.");
    }
    const suffix = fingerprintScreen03Value(item)
      .replace(/[^a-z0-9]/giu, "")
      .slice(-20);
    const migrated = {
      ...clone(item),
      id: screen03LegacyChangedIdentifier(item.id, suffix),
      passages: item.passages.map((passage) => ({
        ...clone(passage),
        id: screen03LegacyChangedIdentifier(passage.id, suffix),
      })),
    };
    if (evidenceIds.has(migrated.id) || migrated.passages.some((passage) =>
      passageIds.has(passage.id)
    )) {
      fail("Legacy Screen 3 source history could not be retained uniquely.");
    }
    evidenceIds.add(migrated.id);
    migrated.passages.forEach((passage) => passageIds.add(passage.id));
    return migrated;
  });
}

function screen03StaleEvidenceVersions(
  items: readonly Screen03EvidenceItem[],
  retained: readonly Screen03EvidenceItem[],
): Screen03StaleEvidenceVersions {
  const evidence = [...retained];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const passageIds = new Set(
    evidence.flatMap((item) => item.passages.map((passage) => passage.id)),
  );
  const staleEvidenceIds: string[] = [];
  const stalePassageIds: string[] = [];
  const sourceReferenceSets = new Map<string, Set<string>>();
  const passageReferenceMap = new Map<string, string>();
  const addSourceReference = (from: string, to: string) => {
    const values = sourceReferenceSets.get(from) ?? new Set<string>();
    values.add(to);
    sourceReferenceSets.set(from, values);
  };

  for (const item of items) {
    const suffix = fingerprintScreen03Value({
      contentFingerprint: item.contentFingerprint,
      passages: item.passages,
    }).replace(/[^a-z0-9]/giu, "").slice(-20);
    const staleId = screen03VersionedIdentifier(item.id, suffix);
    const stalePassages = item.passages.map((passage) => {
      const id = screen03VersionedIdentifier(passage.id, suffix);
      passageReferenceMap.set(passage.id, id);
      stalePassageIds.push(id);
      return {
        ...clone(passage),
        id,
        status: "stale" as const,
        contentFingerprint: item.contentFingerprint,
      };
    });
    const stale = {
      ...clone(item),
      id: staleId,
      status: "changed" as const,
      passages: stalePassages,
    };
    const prior = evidenceById.get(staleId);
    if (!prior) {
      if (stalePassages.some((passage) => passageIds.has(passage.id))) {
        fail("Screen 3 stale passage version collided with retained evidence.");
      }
      evidence.push(stale);
      evidenceById.set(staleId, stale);
      stalePassages.forEach((passage) => passageIds.add(passage.id));
    }
    staleEvidenceIds.push(staleId);
    addSourceReference(item.id, staleId);
    if (item.sourceId !== null) addSourceReference(item.sourceId, staleId);
  }
  if (evidence.filter((item) => item.status === "changed").length >
    MAX_STALE_EVIDENCE_VERSIONS) {
    fail("Screen 3 stale evidence history is full; source content was not overwritten.");
  }
  return {
    evidence,
    staleEvidenceIds: [...new Set(staleEvidenceIds)],
    stalePassageIds: [...new Set(stalePassageIds)],
    sourceReferenceMap: new Map(
      [...sourceReferenceSets].map(([key, values]) => [key, [...values]]),
    ),
    passageReferenceMap,
  };
}

function screen03RemapProposalToStaleEvidence<T extends Screen03AnyProposal>(
  proposal: T,
  versions: Screen03StaleEvidenceVersions,
): T {
  return {
    ...clone(proposal),
    sourceIds: [...new Set(proposal.sourceIds.flatMap((id) =>
      versions.sourceReferenceMap.get(id) ?? [id]
    ))],
    passageIds: proposal.passageIds.map((id) =>
      versions.passageReferenceMap.get(id) ?? id
    ),
  } as T;
}

function screen03ProposalUsesEvidence(
  proposal: Screen03AnyProposal,
  evidence: readonly Screen03EvidenceItem[],
) {
  const sourceIds = new Set(
    evidence.flatMap((item) => [
      item.id,
      ...(item.sourceId === null ? [] : [item.sourceId]),
    ]),
  );
  const passageIds = new Set(
    evidence.flatMap((item) => item.passages.map((passage) => passage.id)),
  );
  return proposal.sourceIds.some((id) => sourceIds.has(id)) ||
    proposal.passageIds.some((id) => passageIds.has(id));
}

function screen03SourceChangeRecord(input: {
  historyEventId: string;
  sourceId: string;
  detectedAt: string;
  trigger: Screen03SourceChangeRecord["trigger"];
  previousEvidence: readonly Screen03EvidenceItem[];
  observedContentFingerprint: string | null;
  versions: Screen03StaleEvidenceVersions;
  proposals: Screen03ProposalGroups;
  reason: string;
}): Screen03SourceChangeRecord {
  const staleProposals = allProposals(input.proposals)
    .filter((proposal) =>
      screen03ProposalUsesEvidence(proposal, input.previousEvidence)
    )
    .map((proposal) =>
      screen03RemapProposalToStaleEvidence(proposal, input.versions)
    );
  const recordInput: Omit<Screen03SourceChangeRecord, "id"> = {
    historyEventId: input.historyEventId,
    sourceId: input.sourceId,
    detectedAt: input.detectedAt,
    trigger: input.trigger,
    previousContentFingerprints: [...new Set(
      input.previousEvidence.map((item) => item.contentFingerprint),
    )].sort((left, right) => left.localeCompare(right)),
    observedContentFingerprint: input.observedContentFingerprint,
    staleEvidenceIds: [...input.versions.staleEvidenceIds],
    stalePassageIds: [...input.versions.stalePassageIds],
    staleProposals,
    reopenedProposalIds: staleProposals
      .filter((proposal) => proposal.reviewStatus !== "proposed")
      .map((proposal) => proposal.id)
      .sort((left, right) => left.localeCompare(right)),
    reason: input.reason,
  };
  return { id: screen03SourceChangeRecordId(recordInput), ...recordInput };
}

function chooseResearchGroups(researched: Screen03ProposalGroups, carried: Screen03ProposalGroups): Screen03ProposalGroups {
  const mandatoryChecks = carried.requiredVariable.filter(
    screen03ProposalIsAssessmentUnavailableCheck,
  );
  const planningInputs = new Map<string, Screen03Proposal>();
  for (const proposal of researched.requiredVariable) {
    // Research packets may propose planning inputs. They remain nonfactual and
    // nonblocking, including the Screen 2 assessment-unavailable reminders.
    planningInputs.set(proposal.id, { ...proposal, critical: false });
  }
  for (const proposal of carried.requiredVariable) {
    if (!screen03ProposalIsAssessmentUnavailableCheck(proposal)) {
      planningInputs.set(proposal.id, proposal);
    }
  }
  for (const check of mandatoryChecks) planningInputs.delete(check.id);
  return {
    identity: researched.identity.length > 0 ? researched.identity : carried.identity,
    overview: researched.overview,
    timeline: researched.timeline.length > 0 ? researched.timeline : carried.timeline,
    component: researched.component,
    eligibility: researched.eligibility,
    amendment: researched.amendment,
    requiredVariable: [...mandatoryChecks, ...planningInputs.values()],
  };
}

function uniqueContradictions(items: Screen03Contradiction[]) {
  const byId = new Map<string, Screen03Contradiction>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}

export function buildScreen03StateFromResearch(
  inputHandoff: Screen02WorkflowHandoff,
  inputPacket: Screen03ResearchPacket,
  at: string,
  inputGlance?: Screen02ShockGlance,
): Screen03VerificationState {
  assertUtcTimestamp(at, "at");
  const handoff = canonicalV4Handoff(inputHandoff);
  const packet = requireScreen03ResearchPacket(inputPacket);
  if (packet.upstreamEventFingerprint !== handoff.integrity.eventFingerprint) fail("Research packet targets a different Screen 2 event.");
  if (packet.researchedAt > at) fail("Research cannot complete after integration time.");
  const loading = createScreen03LoadingState(
    handoff,
    at < handoff.builtAt ? handoff.builtAt : at,
    inputGlance,
  );
  const evidence = mergeEvidence(loading.evidence, packet.evidence);
  if (evidence.length > MAX_ACTIVE_STATE_EVIDENCE) fail("Merged research exceeds the Screen 3 evidence bound.");
  // Rebuild fallback carried proposals against the surviving evidence IDs and
  // passages after logical-source suppression.
  const proposals = chooseResearchGroups(
    packet.proposals,
    loadingProposals(handoff, evidence),
  );
  const contradictions = uniqueContradictions([
    ...packet.contradictions,
    ...detectScreen03DateOrderContradictions(proposals.timeline),
  ]);
  validateReferences(evidence, proposals, contradictions, packet.coverage.queries);
  return withIntegrity({
    ...loading,
    status: "reviewing",
    revision: 1,
    updatedAt: at,
    researchCoverage: {
      status: packet.coverage.stoppingRule.status === "met" ? "completed" : "incomplete",
      ...clone(packet.coverage),
      activeEvidenceCount: evidence.filter((item) => item.status !== "changed").length,
    },
    contextLeads: clone(packet.contextLeads ?? []),
    ...(packet.interpretation
      ? { interpretation: clone(packet.interpretation) }
      : {}),
    evidence,
    proposals,
    contradictions,
    history: [...loading.history, {
      id: "screen03-history:1:research-integrated",
      action: "research-integrated",
      targetId: handoff.event.identitySnapshotId,
      at,
      actor: "research-service",
      reason: "Integrated a bounded, outcome-blind evidence packet; no proposal was auto-confirmed.",
      value: packet.protocolVersion,
      previousReviewStatus: null,
      nextReviewStatus: null,
    }],
  });
}

function sortedStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function withoutRetrievalTimestamps(value: string) {
  return value.replace(
    /\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z/g,
    "<retrieved-at>",
  );
}

function comparableProposal(proposal: Screen03AnyProposal) {
  const common = {
    id: proposal.id,
    group: proposal.group,
    label: proposal.label,
    value: proposal.value,
    critical: proposal.critical,
    support: proposal.support,
    sourceIds: sortedStrings(proposal.sourceIds),
    passageIds: sortedStrings(proposal.passageIds),
    uncertainty: proposal.uncertainty,
  };
  return proposal.group === "timeline"
    ? { ...common, stage: proposal.stage, date: proposal.date }
    : common;
}

/**
 * Canonical research substance, excluding retrieval clocks and human decisions.
 * This lets an explicit refresh preserve decisions when the bounded evidence
 * packet is byte-for-byte different only because it was retrieved later.
 */
function comparableResearchSubstance(state: Screen03VerificationState) {
  const proposalGroup = (items: Screen03AnyProposal[]) =>
    items.map(comparableProposal).sort((left, right) => left.id.localeCompare(right.id));
  return {
    researchCoverage: {
      status: state.researchCoverage.status,
      queries: state.researchCoverage.queries
        .map((query) => ({
          ...query,
          returnedEvidenceIds: sortedStrings(query.returnedEvidenceIds),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      channels: state.researchCoverage.channels
        .map(({ retrievedAt: _retrievedAt, ...channel }) => ({
          ...channel,
          note: withoutRetrievalTimestamps(channel.note),
        }))
        .sort((left, right) => left.channel.localeCompare(right.channel)),
      routes: sortedStrings(state.researchCoverage.routes),
      stages: sortedStrings(state.researchCoverage.stages),
      languages: sortedStrings(state.researchCoverage.languages),
      authorityTiers: [...state.researchCoverage.authorityTiers].sort((left, right) => left - right),
      gaps: sortedStrings(state.researchCoverage.gaps),
      recordsReviewed: state.researchCoverage.recordsReviewed,
      activeEvidenceCount: state.researchCoverage.activeEvidenceCount,
      exhaustive: false as const,
      stoppingRule: state.researchCoverage.stoppingRule,
      outcomeValuesInspected: false as const,
    },
    // Immutable stale versions are audit history, not current research
    // substance. Excluding them lets an unchanged later refresh preserve the
    // current review rather than repeatedly reopening it.
    evidence: state.evidence
      .filter((item) => item.status !== "changed")
      .map(({ retrievedAt: _retrievedAt, ...item }) => ({
        ...item,
        passages: [...item.passages].sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    proposals: {
      identity: proposalGroup(state.proposals.identity),
      overview: proposalGroup(state.proposals.overview),
      timeline: proposalGroup(state.proposals.timeline),
      component: proposalGroup(state.proposals.component),
      eligibility: proposalGroup(state.proposals.eligibility),
      amendment: proposalGroup(state.proposals.amendment),
      requiredVariable: proposalGroup(state.proposals.requiredVariable),
    },
    contradictions: state.contradictions
      .map(({ status: _status, resolution: _resolution, ...contradiction }) => ({
        ...contradiction,
        proposalIds: sortedStrings(contradiction.proposalIds),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    outcomeValuesInspected: false as const,
  };
}

function refreshedResearchProposals(
  previous: Screen03ProposalGroups,
  candidate: Screen03ProposalGroups,
  sourceAffectedProposalIds: ReadonlySet<string>,
) {
  const previousById = new Map(
    allProposals(previous).map((proposal) => [proposal.id, proposal]),
  );
  const candidateIds = new Set(
    allProposals(candidate).map((proposal) => proposal.id),
  );
  const affectedProposalIds = new Set(sourceAffectedProposalIds);
  for (const proposal of allProposals(previous)) {
    if (!candidateIds.has(proposal.id)) affectedProposalIds.add(proposal.id);
  }
  const preserveOrReopen = <T extends Screen03AnyProposal>(proposal: T): T => {
    const prior = previousById.get(proposal.id);
    const unchanged = prior &&
      serializeDeterministicJson(comparableProposal(prior)) ===
        serializeDeterministicJson(comparableProposal(proposal));
    if (unchanged && !affectedProposalIds.has(proposal.id)) {
      return {
        ...proposal,
        reviewStatus: prior.reviewStatus,
        editedValue: prior.editedValue,
      } as T;
    }
    if (prior) affectedProposalIds.add(proposal.id);
    return {
      ...proposal,
      reviewStatus: "proposed",
      editedValue: null,
    } as T;
  };
  return {
    proposals: {
      identity: candidate.identity.map(preserveOrReopen),
      overview: candidate.overview.map(preserveOrReopen),
      timeline: candidate.timeline.map(preserveOrReopen),
      component: candidate.component.map(preserveOrReopen),
      eligibility: candidate.eligibility.map(preserveOrReopen),
      amendment: candidate.amendment.map(preserveOrReopen),
      requiredVariable: candidate.requiredVariable.map(preserveOrReopen),
    } satisfies Screen03ProposalGroups,
    affectedProposalIds,
  };
}

function preferredScreen03Interpretation(
  current: Screen03Interpretation | undefined,
  candidate: Screen03Interpretation | undefined,
) {
  if (!current) return candidate;
  if (!candidate) return current;
  const quality: Record<Screen03Interpretation["origin"], number> = {
    unavailable: 0,
    "screen02-reuse": 1,
    "workers-ai": 2,
    "chatgpt-host": 3,
  };
  if (
    current.origin === candidate.origin &&
    (current.origin === "workers-ai" || current.origin === "chatgpt-host")
  ) {
    // A bounded generated response may contain a valid overview while one or more
    // independently checked claim explanations are omitted. An explicit
    // same-evidence refresh gets one more bounded opportunity to fill those
    // gaps. Keep the first validated overview stable, but retain any newly
    // validated explanation for a proposal that did not already have one.
    const currentProposalIds = new Set(
      current.claimExplanations.map((explanation) => explanation.proposalId),
    );
    const additionalExplanations = candidate.claimExplanations.filter(
      (explanation) => !currentProposalIds.has(explanation.proposalId),
    );
    if (additionalExplanations.length === 0) return current;
    return {
      ...current,
      claimExplanations: [
        ...current.claimExplanations,
        ...additionalExplanations,
      ],
      // An unqualified candidate covered its complete bounded request. Its
      // added explanations therefore resolve the prior partial-output notice;
      // otherwise preserve the honest union of both bounded limitations.
      limitations: candidate.limitations.length === 0
        ? []
        : [...new Set([...current.limitations, ...candidate.limitations])],
    };
  }
  return quality[candidate.origin] > quality[current.origin]
    ? candidate
    : current;
}

function screen03ComparableLocator(value: string) {
  try {
    const locator = new URL(value);
    locator.hash = "";
    return locator.toString().replace(/\/+$/u, "").toLocaleLowerCase("en-US");
  } catch {
    return value.trim().replace(/\/+$/u, "").toLocaleLowerCase("en-US");
  }
}

function screen03EvidenceRepresentsSameSource(
  left: Screen03EvidenceItem,
  right: Screen03EvidenceItem,
) {
  return left.id === right.id ||
    (left.sourceId !== null && right.sourceId !== null &&
      left.sourceId === right.sourceId) ||
    screen03ComparableLocator(left.locator) ===
      screen03ComparableLocator(right.locator);
}

function preserveScreen03RefreshSourceChanges(
  state: Screen03VerificationState,
  candidate: Screen03VerificationState,
  at: string,
  historyEventId: string,
) {
  const candidateActive = candidate.evidence.filter((item) =>
    item.status !== "changed"
  );
  const currentActive = state.evidence.filter((item) =>
    item.status !== "changed"
  );
  const usedCandidateIds = new Set<string>();
  const transitions: Array<{
    previous: Screen03EvidenceItem;
    observed: Screen03EvidenceItem | null;
  }> = [];
  for (const previous of currentActive) {
    const observed = candidateActive.find((item) =>
      !usedCandidateIds.has(item.id) &&
      screen03EvidenceRepresentsSameSource(previous, item)
    ) ?? null;
    if (observed) usedCandidateIds.add(observed.id);
    if (!observed ||
      previous.contentFingerprint !== observed.contentFingerprint) {
      transitions.push({ previous, observed });
    }
  }

  // A manual mark records the exact fingerprint expected from renewed
  // retrieval. Do not let a later packet silently reactivate the stale body
  // or substitute a third, unrecorded version for that pending observation.
  const priorSourceChanges = state.sourceChanges ?? [];
  for (const [recordIndex, record] of priorSourceChanges.entries()) {
    if (
      record.trigger !== "mark-source-changed" ||
      record.observedContentFingerprint === null
    ) continue;
    const stale = record.staleEvidenceIds
      .map((id) => state.evidence.find((item) => item.id === id))
      .filter((item): item is Screen03EvidenceItem => item !== undefined);
    const alreadyRevalidated = currentActive.some((item) =>
      item.contentFingerprint === record.observedContentFingerprint &&
      stale.some((prior) => screen03EvidenceRepresentsSameSource(prior, item))
    );
    const revalidatedThenStaled = priorSourceChanges
      .slice(recordIndex + 1)
      .some((later) =>
        later.previousContentFingerprints.includes(
          record.observedContentFingerprint!,
        ) && later.staleEvidenceIds.some((id) => {
          const laterVersion = state.evidence.find((item) => item.id === id);
          return laterVersion !== undefined && stale.some((prior) =>
            screen03EvidenceRepresentsSameSource(prior, laterVersion)
          );
        })
      );
    if (alreadyRevalidated || revalidatedThenStaled) continue;
    const observedVersions = candidateActive.filter((item) =>
      stale.some((prior) => screen03EvidenceRepresentsSameSource(prior, item))
    );
    if (observedVersions.some((item) =>
      item.contentFingerprint !== record.observedContentFingerprint
    )) {
      fail(
        "Research refresh did not match the fingerprint recorded by the pending source-change review.",
      );
    }
  }

  const priorHistorical = state.evidence.filter((item) =>
    item.status === "changed"
  );
  const historical = screen03LegacyHistoricalEvidence(
    priorHistorical,
    candidate.evidence,
  );
  let evidence = [...candidate.evidence, ...historical];
  const sourceChanges = [...(state.sourceChanges ?? [])];
  const affectedProposalIds = new Set<string>();
  // One proposal can cite several sources that change in the same refresh.
  // Archive every prior version before recording any proposal, so all of its
  // changed-source passages point to retained history even when text vanished.
  const refreshedVersions = screen03StaleEvidenceVersions(
    transitions.map((transition) => transition.previous),
    evidence,
  );
  evidence = refreshedVersions.evidence;
  for (const transition of transitions) {
    const versions = screen03StaleEvidenceVersions(
      [transition.previous],
      evidence,
    );
    evidence = versions.evidence;
    const record = screen03SourceChangeRecord({
      historyEventId,
      sourceId: transition.previous.sourceId ?? transition.previous.id,
      detectedAt: at,
      trigger: "research-refresh",
      previousEvidence: [transition.previous],
      observedContentFingerprint:
        transition.observed?.contentFingerprint ?? null,
      versions: {
        ...versions,
        sourceReferenceMap: refreshedVersions.sourceReferenceMap,
        passageReferenceMap: refreshedVersions.passageReferenceMap,
      },
      proposals: state.proposals,
      reason: transition.observed
        ? "Substantive research retrieved a different content fingerprint for the same logical source; the previous passages and mappings were retained as stale."
        : "Substantive research no longer returned this source; the previous passages and mappings were retained as stale.",
    });
    record.staleProposals.forEach((proposal) =>
      affectedProposalIds.add(proposal.id)
    );
    sourceChanges.push(record);
  }
  if (sourceChanges.length > MAX_HISTORY) {
    fail("Screen 3 source-change history is full; research was not overwritten.");
  }
  if (evidence.length > MAX_STATE_EVIDENCE) {
    fail("Screen 3 evidence-version history is full; research was not overwritten.");
  }
  return { evidence, sourceChanges, affectedProposalIds };
}

/**
 * Integrate independently validated ChatGPT-host reader help without changing
 * evidence, factual proposals, review decisions, focal clocks, or a locked
 * Event Card. The request proof is recorded so a replay can be recognized at
 * the canonical Worker boundary.
 */
export function integrateScreen03HostInterpretation(
  inputState: Screen03VerificationState,
  inputInterpretation: Screen03Interpretation,
  at: string,
  requestProof: string,
): Screen03VerificationState {
  const state = requireScreen03VerificationState(inputState);
  actionTime(state, at);
  assertFingerprint(requestProof, "host interpretation requestProof");
  const interpretation = clone(inputInterpretation);
  if (interpretation.origin !== "chatgpt-host") {
    fail("Only validated ChatGPT-host reader help may enter this boundary.");
  }
  assertInterpretation(
    interpretation,
    "hostInterpretation",
    state.evidence,
    state.proposals,
  );
  // An explicit, freshly signed host request is allowed to refresh the whole
  // noncanonical explanation. Canonical evidence and decisions remain outside
  // this lane and are copied unchanged below.
  const preferred = interpretation;
  assertInterpretation(
    preferred,
    "integratedHostInterpretation",
    state.evidence,
    state.proposals,
  );
  if (
    preferred === state.interpretation ||
    fingerprintScreen03Value(preferred) ===
      fingerprintScreen03Value(state.interpretation ?? null)
  ) {
    return state;
  }
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; host reader help cannot be recorded safely.");
  }
  const entry = historyEvent(
    state,
    "host-interpretation-integrated",
    state.upstream.eventFingerprint,
    at,
    "Validated ChatGPT-host reader help was integrated without changing evidence or researcher decisions.",
    requestProof,
  );
  return withIntegrity({
    ...state,
    interpretation: clone(preferred),
    revision: state.revision + 1,
    updatedAt: at,
    history: [...state.history, entry],
  });
}

/**
 * Compatibility migration for a retained Screen 3 child created before the
 * orientation lane existed. The authenticated parent supplies the exact-bound
 * glance; the migration advances revision and audit history atomically.
 */
export function attachScreen03Orientation(
  inputState: Screen03VerificationState,
  inputGlance: Screen02ShockGlance,
  at: string,
) {
  const state = requireScreen03VerificationState(inputState);
  const glance = requireScreen02ShockGlance(inputGlance);
  if (state.orientation) {
    if (
      state.orientation.initial.runId !== glance.runId ||
      state.orientation.initial.candidateFingerprint !==
        glance.candidateFingerprint ||
      state.orientation.initial.selectedEventId !== glance.selectedEventId ||
      state.orientation.initial.eventFingerprint !== glance.eventFingerprint
    ) {
      fail("An existing Screen 3 orientation cannot be replaced by another event.");
    }
    return state;
  }
  actionTime(state, at);
  if (
    glance.runId !== state.upstream.runId ||
    glance.selectedEventId !== state.history[0]?.targetId ||
    glance.eventFingerprint !== state.upstream.eventFingerprint
  ) {
    fail("The compatibility orientation targets a different Screen 2 event.");
  }
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the compatibility orientation cannot be recorded.");
  }
  const entry = historyEvent(
    state,
    "orientation-attached",
    glance.selectedEventId,
    at,
    "Reconstructed a preliminary orientation from the authenticated retained Screen 2 event without changing Event Card facts.",
    fingerprintScreen03Value(glance),
  );
  return withIntegrity({
    ...state,
    orientation: {
      schemaVersion: SCREEN_03_ORIENTATION_STATE_SCHEMA_VERSION,
      upstreamEventFingerprint: state.upstream.eventFingerprint,
      initial: clone(glance),
      current: clone(glance),
      provenance: "screen-02-preliminary",
      refinements: [],
    },
    revision: state.revision + 1,
    updatedAt: at,
    history: [...state.history, entry],
  });
}

/**
 * Attach the unguessable model-visible run reference before the child is
 * first stored. Passing `at` marks attachment as a legacy migration: the
 * revision, fingerprint, timestamp, and audit history then advance together
 * so a widget never observes a same-revision rewrite.
 */
export function attachScreen03BriefingLifecycle(
  inputState: Screen03VerificationState,
  safeRunRef: string,
  at?: string,
): Screen03VerificationState {
  const state = requireScreen03VerificationState(inputState);
  if (state.briefing) {
    if (state.briefing.safeRunRef !== safeRunRef) {
      fail("A Screen 3 briefing run reference cannot be replaced.");
    }
    return state;
  }
  const briefing = createScreen03BriefingLifecycle(safeRunRef);
  if (at === undefined) {
    return withIntegrity({
      ...state,
      briefing,
    });
  }
  actionTime(state, at);
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the briefing lifecycle cannot be attached.");
  }
  const entry = historyEvent(
    state,
    "host-briefing-lifecycle-attached",
    null,
    at,
    "Attached the host-native briefing lifecycle without changing evidence, factual review decisions, or the Event Card.",
    null,
  );
  return withIntegrity({
    ...state,
    briefing,
    revision: state.revision + 1,
    updatedAt: at,
    history: [...state.history, entry],
  });
}

/** Persist an unconfirmed host proposal without changing any Event Card fact. */
export function integrateScreen03BriefingProposal(
  inputState: Screen03VerificationState,
  inputProposal: Screen03BriefingProposal,
  at: string,
): { state: Screen03VerificationState; duplicate: boolean } {
  const state = requireScreen03VerificationState(inputState);
  actionTime(state, at);
  if (!state.briefing) fail("Screen 3 briefing continuation is unavailable.");
  const added = addScreen03BriefingProposal(state.briefing, inputProposal);
  if (added.duplicate) return { state, duplicate: true };
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the briefing proposal cannot be recorded.");
  }
  const entry = historyEvent(
    state,
    "host-briefing-proposed",
    inputProposal.proposalId,
    at,
    "Stored a source-bounded ChatGPT host proposal for explicit researcher review; no Event Card fact was approved.",
    inputProposal.contentHash,
  );
  return {
    duplicate: false,
    state: withIntegrity({
      ...state,
      briefing: added.lifecycle,
      revision: state.revision + 1,
      updatedAt: at,
      history: [...state.history, entry],
    }),
  };
}

/**
 * Record an explicit researcher confirmation, supported revision, or
 * rejection while retaining every original host proposal and prior decision.
 */
export function decideScreen03Briefing(
  inputState: Screen03VerificationState,
  inputDecision: Screen03BriefingDecision,
  at: string,
): { state: Screen03VerificationState; duplicate: boolean } {
  const state = requireScreen03VerificationState(inputState);
  actionTime(state, at);
  if (!state.briefing) fail("Screen 3 briefing continuation is unavailable.");
  if (inputDecision.decidedAt !== at) {
    fail("Screen 3 briefing decision time must match the canonical action time.");
  }
  const sameIdentifier = state.briefing.decisions.find((decision) =>
    decision.decisionId === inputDecision.decisionId
  );
  if (sameIdentifier) {
    if (
      serializeDeterministicJson(sameIdentifier) !==
        serializeDeterministicJson(inputDecision)
    ) {
      fail("A Screen 3 briefing decision identifier cannot be rewritten.");
    }
    return { state, duplicate: true };
  }
  if (state.briefing.decisions.some((decision) =>
    decision.proposalId === inputDecision.proposalId
  )) {
    fail("A Screen 3 briefing proposal can have only one terminal researcher decision.");
  }
  if (state.briefing.activeProposalId !== inputDecision.proposalId) {
    fail("Only the current active Screen 3 briefing proposal can receive a researcher decision.");
  }
  const added = addScreen03BriefingDecision(state.briefing, inputDecision);
  if (added.duplicate) return { state, duplicate: true };
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the briefing decision cannot be recorded.");
  }
  const action: Screen03AuditEvent["action"] =
    inputDecision.action === "confirm"
      ? "host-briefing-confirmed"
      : inputDecision.action === "revise"
        ? "host-briefing-revised"
        : "host-briefing-rejected";
  const entry = historyEvent(
    state,
    action,
    inputDecision.proposalId,
    at,
    inputDecision.reason,
    inputDecision.decisionId,
  );
  return {
    duplicate: false,
    state: withIntegrity({
      ...state,
      briefing: added.lifecycle,
      revision: state.revision + 1,
      updatedAt: at,
      history: [...state.history, entry],
    }),
  };
}

/**
 * Integrates an explicit bounded research refresh without mutating the stable
 * Screen 2 handoff. Unchanged research preserves every human decision exactly;
 * any substantive packet change creates one new revision and reopens all fields.
 */
function refreshScreen03StateFromResearchBase(
  inputState: Screen03VerificationState,
  inputHandoff: Screen02WorkflowHandoff,
  inputPacket: Screen03ResearchPacket,
  at: string,
): Screen03VerificationState {
  const state = requireScreen03VerificationState(inputState);
  actionTime(state, at);
  const handoff = canonicalV4Handoff(inputHandoff);
  if (
    state.runId !== handoff.runId ||
    state.upstream.runId !== handoff.runId ||
    state.upstream.eventFingerprint !== handoff.integrity.eventFingerprint ||
    state.upstream.handoffFingerprint !== handoff.integrity.handoffFingerprint
  ) {
    fail("Research refresh targets a different canonical Screen 2 handoff.");
  }
  const candidate = buildScreen03StateFromResearch(
    handoff,
    inputPacket,
    at,
    state.orientation?.initial,
  );
  const currentFingerprint = fingerprintScreen03Value(comparableResearchSubstance(state));
  const candidateFingerprint = fingerprintScreen03Value(comparableResearchSubstance(candidate));
  if (currentFingerprint === candidateFingerprint) {
    const currentContext = fingerprintScreen03Value(
      [...(state.contextLeads ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    );
    const candidateContext = fingerprintScreen03Value(
      [...(candidate.contextLeads ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    );
    // Do not replace a valid persisted explanation merely because another
    // temperature-zero model pass used different wording. A later refresh may,
    // however, upgrade unavailable or reused reader help to a validated
    // ChatGPT-host interpretation without reopening a factual decision or
    // changing a locked Event Card.
    const interpretation = preferredScreen03Interpretation(
      state.interpretation,
      candidate.interpretation,
    );
    const currentInterpretation = fingerprintScreen03Value(
      state.interpretation ?? null,
    );
    const candidateInterpretation = fingerprintScreen03Value(
      interpretation ?? null,
    );
    if (
      currentContext === candidateContext &&
      currentInterpretation === candidateInterpretation
    ) return state;
    if (state.history.length >= MAX_HISTORY) {
      fail("Screen 3 history is full; context refresh cannot be recorded safely.");
    }
    const entry = historyEvent(
      state,
      "context-refreshed",
      handoff.event.identitySnapshotId,
      at,
      "Noncanonical context or plain-language interpretation changed; evidence decisions and any locked Event Card were preserved.",
      fingerprintScreen03Value([candidateContext, candidateInterpretation]),
    );
    return withIntegrity({
      ...state,
      contextLeads: clone(candidate.contextLeads ?? []),
      ...(interpretation ? { interpretation: clone(interpretation) } : {}),
      revision: state.revision + 1,
      updatedAt: at,
      history: [...state.history, entry],
    });
  }
  if (state.history.length >= MAX_HISTORY) fail("Screen 3 history is full; refresh cannot be recorded safely.");
  const refreshHistoryEventId =
    `screen03-history:${state.revision + 1}:research-refreshed`;
  const sourceVersionHistory = preserveScreen03RefreshSourceChanges(
    state,
    candidate,
    at,
    refreshHistoryEventId,
  );
  const proposalRefresh = refreshedResearchProposals(
    state.proposals,
    candidate.proposals,
    sourceVersionHistory.affectedProposalIds,
  );
  const refreshedProposalById = new Map(
    allProposals(proposalRefresh.proposals).map((proposal) => [
      proposal.id,
      proposal,
    ]),
  );
  const selectedProposalId = state.focalClock.selectedProposalId;
  const selectedProposal = selectedProposalId === null
    ? undefined
    : refreshedProposalById.get(selectedProposalId);
  const preserveSelectedClock = selectedProposal?.group === "timeline" &&
    (selectedProposal.reviewStatus === "accepted" ||
      selectedProposal.reviewStatus === "edited");
  const focalClock = preserveSelectedClock
    ? {
        selectedProposalId,
        alternativeProposalIds: state.focalClock.alternativeProposalIds.filter(
          (id) => {
            const proposal = refreshedProposalById.get(id);
            return proposal?.group === "timeline" &&
              (proposal.reviewStatus === "accepted" ||
                proposal.reviewStatus === "edited");
          },
        ),
      }
    : { selectedProposalId: null, alternativeProposalIds: [] };
  const previousContradictionById = new Map(
    state.contradictions.map((contradiction) => [
      contradiction.id,
      contradiction,
    ]),
  );
  const contradictions = candidate.contradictions.map((contradiction) => {
    const prior = previousContradictionById.get(contradiction.id);
    const sameRecord = prior && serializeDeterministicJson({
      ...prior,
      status: "unresolved",
      resolution: null,
    }) === serializeDeterministicJson({
      ...contradiction,
      status: "unresolved",
      resolution: null,
    });
    return sameRecord && !contradiction.proposalIds.some((id) =>
        proposalRefresh.affectedProposalIds.has(id)
      )
      ? clone(prior)
      : {
          ...contradiction,
          status: "unresolved" as const,
          resolution: null,
        };
  });
  const entry = historyEvent(
    state,
    "research-refreshed",
    handoff.event.identitySnapshotId,
    at,
    `The normalized bounded research packet changed; ${proposalRefresh.affectedProposalIds.size} affected field decision${proposalRefresh.affectedProposalIds.size === 1 ? " was" : "s were"} reopened while unrelated unchanged decisions were preserved.`,
    screen03ResearchRefreshHistoryValue(
      candidateFingerprint,
      sourceVersionHistory.sourceChanges.filter((record) =>
        record.historyEventId === refreshHistoryEventId
      ),
    ),
  );
  return withIntegrity({
    ...candidate,
    releaseLabel: state.releaseLabel,
    status: "reviewing",
    revision: state.revision + 1,
    createdAt: state.createdAt,
    updatedAt: at,
    evidence: sourceVersionHistory.evidence,
    sourceChanges: sourceVersionHistory.sourceChanges,
    ...(state.directSupportSearches
      ? { directSupportSearches: clone(state.directSupportSearches) }
      : {}),
    proposals: proposalRefresh.proposals,
    contradictions,
    focalClock,
    history: [...state.history, entry],
    lockedEventCard: null,
    ...(candidate.orientation
      ? {
          orientation: resetScreen03OrientationForResearchRefresh(
            state,
            candidate,
            at,
          ),
        }
      : {}),
    ...(state.briefing
      ? { briefing: markScreen03BriefingFactsStale(state.briefing) }
      : {}),
  });
}

/**
 * Integrates a bounded refresh and, when requested, records the result for one
 * exact reader-visible claim. The immutable result is appended even when the
 * normalized evidence packet is unchanged, so the control never degrades into
 * an unobservable full-page refresh.
 */
export function refreshScreen03StateFromResearch(
  inputState: Screen03VerificationState,
  inputHandoff: Screen02WorkflowHandoff,
  inputPacket: Screen03ResearchPacket,
  at: string,
  targetProposalId?: string,
): Screen03VerificationState {
  const state = requireScreen03VerificationState(inputState);
  if (targetProposalId === undefined) {
    return refreshScreen03StateFromResearchBase(
      state,
      inputHandoff,
      inputPacket,
      at,
    );
  }
  assertString(targetProposalId, "targetProposalId", MAX_SHORT);
  if (state.status === "locked") {
    fail("A locked Event Card cannot run a claim-targeted support search.");
  }
  const previous = screen03FactualClaims(state.proposals).find(
    (proposal) => proposal.id === targetProposalId,
  );
  if (!previous) fail("Claim-targeted support search requires an active factual claim.");

  const refreshed = refreshScreen03StateFromResearchBase(
    state,
    inputHandoff,
    inputPacket,
    at,
  );
  if (refreshed.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the direct-support result cannot be recorded.");
  }
  const resulting = screen03FactualClaims(refreshed.proposals).find(
    (proposal) => proposal.id === targetProposalId,
  );
  const confirmability = resulting
    ? screen03ProposalConfirmability(
        resulting,
        refreshed.evidence,
        resolvedProposalValue(resulting),
        resulting.reviewStatus === "edited",
      )
    : { confirmable: false as const, reason: "no-direct-support" as const };
  const queryIds = refreshed.researchCoverage.queries
    .filter((query) =>
      query.purpose.includes(`target-proposal:${targetProposalId}`) ||
      (resulting !== undefined && query.returnedEvidenceIds.some((id) =>
        resulting.sourceIds.includes(id)
      ))
    )
    .map((query) => query.id);
  const evidenceIds = resulting
    ? screen03DirectSupportSearchEvidenceIds(resulting, refreshed.evidence)
    : [];
  const outcome: Screen03DirectSupportSearchRecord["outcome"] = !resulting
    ? "claim-no-longer-active"
    : confirmability.confirmable
    ? "direct-support-found"
    : refreshed.researchCoverage.status === "incomplete"
    ? "search-incomplete"
    : "no-direct-support-found";
  const note = outcome === "direct-support-found"
    ? `Claim-targeted official-source research found active direct support for ${targetProposalId}.`
    : outcome === "search-incomplete"
    ? `Claim-targeted official-source research for ${targetProposalId} remained incomplete; the claim was not promoted.`
    : outcome === "claim-no-longer-active"
    ? `Claim-targeted official-source research completed, but ${targetProposalId} was no longer an active claim.`
    : `Claim-targeted official-source research found no active direct support for ${targetProposalId}; the claim was not promoted.`;
  const recordInput: Omit<Screen03DirectSupportSearchRecord, "id"> = {
    proposalId: targetProposalId,
    claimFingerprint: fingerprintScreen03ProposalForInterpretation(previous),
    resultBindingFingerprint: resulting
      ? fingerprintScreen03DirectSupportSearchResult(
          resulting,
          refreshed.evidence,
        )
      : fingerprintScreen03Value({
          proposalId: targetProposalId,
          active: false,
        }),
    searchedAt: at,
    previousSupport: previous.support,
    resultingSupport: resulting?.support ?? null,
    resultingConfirmable: confirmability.confirmable,
    outcome,
    evidenceIds,
    passageIds: resulting ? [...resulting.passageIds] : [],
    queryIds,
    note,
  };
  const record: Screen03DirectSupportSearchRecord = {
    id: screen03DirectSupportSearchRecordId(recordInput),
    ...recordInput,
  };
  const entry = historyEvent(
    refreshed,
    "direct-support-searched",
    targetProposalId,
    at,
    note,
    record.id,
  );
  return withIntegrity({
    ...refreshed,
    directSupportSearches: [
      ...(refreshed.directSupportSearches ?? []),
      record,
    ],
    revision: refreshed.revision + 1,
    updatedAt: at,
    history: [...refreshed.history, entry],
  });
}

export function screen03ProposalHasActiveDirectSupport(
  proposal: Screen03AnyProposal,
  evidence: Screen03EvidenceItem[],
) {
  if (proposal.support !== "direct" || proposal.passageIds.length === 0) return false;
  const activePassages = new Set(evidence
    .filter((item) =>
      screen03EvidenceItemProvidesDirectSupportForProposal(item, proposal)
    )
    .flatMap((item) => item.passages
      .filter((passage) =>
        screen03PassageProvidesDirectSupport(passage, proposal)
      )
      .map((passage) => passage.id)));
  return proposal.passageIds.every((id) => activePassages.has(id));
}

function directPassageTexts(
  proposal: Screen03AnyProposal,
  evidence: Screen03EvidenceItem[],
) {
  const referenced = new Set(proposal.passageIds);
  return evidence
    .filter((item) =>
      screen03EvidenceItemProvidesDirectSupportForProposal(item, proposal)
    )
    .flatMap((item) => item.passages)
    .filter(
      (passage) =>
        referenced.has(passage.id) &&
        screen03PassageProvidesDirectSupport(passage, proposal),
    )
    .map((passage) => passage.text);
}

const NATURAL_LANGUAGE_MONTH_NAMES = [
  ["january", "jan"],
  ["february", "feb"],
  ["march", "mar"],
  ["april", "apr"],
  ["may"],
  ["june", "jun"],
  ["july", "jul"],
  ["august", "aug"],
  ["september", "sept", "sep"],
  ["october", "oct"],
  ["november", "nov"],
  ["december", "dec"],
] as const;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparableText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function passageStatesEquivalentNaturalLanguageDate(
  text: string,
  calendarDate: string,
) {
  if (!isCalendarDate(calendarDate)) return false;
  const [year, monthValue, dayValue] = calendarDate.split("-");
  const normalizedText = normalizeComparableText(text);
  const numericVariants = [
    calendarDate,
    `${year}-${Number(monthValue)}-${Number(dayValue)}`,
    ...(Number(dayValue) > 12
      ? [
          `${dayValue}-${monthValue}-${year}`,
          `${Number(dayValue)}-${Number(monthValue)}-${year}`,
          `${monthValue}-${dayValue}-${year}`,
          `${Number(monthValue)}-${Number(dayValue)}-${year}`,
        ]
      : []),
  ]
    .map(normalizeComparableText)
    .filter((value, index, values) => values.indexOf(value) === index);
  if (
    numericVariants.some((variant) =>
      ` ${normalizedText} `.includes(` ${variant} `),
    )
  ) {
    return true;
  }
  const monthNames = NATURAL_LANGUAGE_MONTH_NAMES[Number(monthValue) - 1];
  if (!monthNames) return false;
  const monthPattern = monthNames.map(escapeRegularExpression).join("|");
  const day = String(Number(dayValue));
  const dayPattern = Number(dayValue) < 10 ? `0?${day}` : day;
  const ordinal = "(?:st|nd|rd|th)?";
  const boundaryBefore = "(?:^|[^\\p{L}\\p{N}])";
  const boundaryAfter = "(?=$|[^\\p{L}\\p{N}])";
  const sourceText = text.normalize("NFKC");
  const dayFirst = new RegExp(
    `${boundaryBefore}${dayPattern}${ordinal}\\s+(?:${monthPattern})\\.?(?:\\s*,)?\\s+${year}${boundaryAfter}`,
    "iu",
  );
  const monthFirst = new RegExp(
    `${boundaryBefore}(?:${monthPattern})\\.?\\s+${dayPattern}${ordinal}(?:\\s*,)?\\s+${year}${boundaryAfter}`,
    "iu",
  );
  return dayFirst.test(sourceText) || monthFirst.test(sourceText);
}

function reviewedValueHasDirectSupport(
  proposal: Screen03AnyProposal,
  reviewedValue: string,
  evidence: Screen03EvidenceItem[],
  edited: boolean,
) {
  const normalized = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  const value = normalized(reviewedValue);
  const calendarDate =
    proposal.group === "timeline" && isCalendarDate(reviewedValue)
      ? reviewedValue
      : null;
  // A citation binding is an exact normalized token phrase, not an arbitrary
  // substring. This prevents values such as `active` from binding to
  // `inactive`, or `US` from binding to `status`. Non-date edits must also
  // contain at least two meaningful letters/numbers; a one-character edit is
  // too ambiguous to freeze as an evidence-backed fact.
  const meaningfulNonTimelineValue =
    !edited ||
    calendarDate !== null ||
    [...value.replace(/\s+/g, "")].length >= 2;
  return (
    value.length > 0 &&
    meaningfulNonTimelineValue &&
    directPassageTexts(proposal, evidence).some(
      (text) => {
        const passage = normalized(text);
        return ` ${passage} `.includes(` ${value} `) ||
        (calendarDate !== null &&
          passageStatesEquivalentNaturalLanguageDate(text, calendarDate));
      },
    )
  );
}

/**
 * One fixed classifier governs whether a reviewed factual value can enter the
 * verified Event Card. The UI may use the reason to explain an unavailable
 * confirmation without weakening the evidence rule. A correction editor can
 * remain available whenever screen03ProposalHasActiveDirectSupport is true;
 * the submitted correction is then classified with edited=true.
 */
export function screen03ProposalConfirmability(
  proposal: Screen03AnyProposal,
  evidence: Screen03EvidenceItem[],
  reviewedValue = proposal.value,
  edited = false,
): Screen03ProposalConfirmability {
  if (proposal.support !== "direct" || proposal.passageIds.length === 0) {
    return { confirmable: false, reason: "no-direct-support" };
  }
  if (!screen03ProposalHasActiveDirectSupport(proposal, evidence)) {
    return { confirmable: false, reason: "inactive-direct-support" };
  }
  if (!reviewedComponentValueIsComplete(proposal, reviewedValue)) {
    return { confirmable: false, reason: "incomplete-component" };
  }
  if (
    !reviewedValueHasDirectSupport(
      proposal,
      reviewedValue,
      evidence,
      edited,
    )
  ) {
    return { confirmable: false, reason: "reviewed-value-not-supported" };
  }
  return { confirmable: true, reason: "confirmable" };
}

/**
 * Validate host-suggested evidence links without accepting any factual claim.
 * Every quoted span is byte-for-byte anchored in an active authoritative
 * passage, and official fields must match the identity field discriminator.
 */
export function restoreScreen03HostEvidenceMappings(
  value: unknown,
  state: Screen03VerificationState,
): Screen03HostEvidenceMapping[] | null {
  try {
    if (!Array.isArray(value) || value.length > MAX_LIST) return null;
    const proposalById = new Map(
      allProposals(state.proposals).map((proposal) => [proposal.id, proposal]),
    );
    const unresolvedConflictProposalIds = new Set(
      state.contradictions
        .filter((contradiction) => contradiction.status === "unresolved")
        .flatMap((contradiction) => contradiction.proposalIds),
    );
    const passageById = new Map(
      state.evidence.flatMap((evidence) =>
        evidence.passages.map((passage) => [
          passage.id,
          { evidence, passage },
        ] as const)
      ),
    );
    const mappings: Screen03HostEvidenceMapping[] = [];
    const claimIds = new Set<string>();
    for (const [index, candidate] of value.entries()) {
      const label = `hostEvidenceMappings[${index}]`;
      assertRecord(candidate, label);
      assertExactKeys(
        candidate,
        ["claimId", "passageIds", "quotedSpans", "status"],
        label,
      );
      assertString(candidate.claimId, `${label}.claimId`);
      if (claimIds.has(candidate.claimId as string)) return null;
      claimIds.add(candidate.claimId as string);
      const proposal = proposalById.get(candidate.claimId as string);
      if (
        !proposal ||
        unresolvedConflictProposalIds.has(proposal.id) ||
        candidate.status !== "direct"
      ) return null;
      assertStringArray(candidate.passageIds, `${label}.passageIds`, MAX_LIST);
      const passageIds = candidate.passageIds as string[];
      if (passageIds.length === 0 || new Set(passageIds).size !== passageIds.length) {
        return null;
      }
      if (!Array.isArray(candidate.quotedSpans) ||
        candidate.quotedSpans.length === 0 ||
        candidate.quotedSpans.length > MAX_LIST) return null;
      const spans: Screen03HostEvidenceQuotedSpan[] = [];
      for (const [spanIndex, rawSpan] of candidate.quotedSpans.entries()) {
        const spanLabel = `${label}.quotedSpans[${spanIndex}]`;
        assertRecord(rawSpan, spanLabel);
        assertExactKeys(rawSpan, ["passageId", "start", "end", "text"], spanLabel);
        assertString(rawSpan.passageId, `${spanLabel}.passageId`);
        assertString(rawSpan.text, `${spanLabel}.text`, MAX_LONG);
        if (!Number.isSafeInteger(rawSpan.start) ||
          !Number.isSafeInteger(rawSpan.end) ||
          (rawSpan.start as number) < 0 ||
          (rawSpan.end as number) <= (rawSpan.start as number)) return null;
        const owner = passageById.get(rawSpan.passageId as string);
        if (!owner ||
          !passageIds.includes(rawSpan.passageId as string) ||
          !screen03EvidenceItemProvidesDirectSupportForProposal(
            owner.evidence,
            proposal,
          ) ||
          !screen03PassageProvidesDirectSupport(owner.passage, proposal) ||
          owner.passage.text.slice(
              rawSpan.start as number,
              rawSpan.end as number,
            ) !== rawSpan.text) return null;
        spans.push({
          passageId: rawSpan.passageId as string,
          start: rawSpan.start as number,
          end: rawSpan.end as number,
          text: rawSpan.text as string,
        });
      }
      if (passageIds.some((id) => !spans.some((span) => span.passageId === id))) {
        return null;
      }
      const reviewedValue = resolvedProposalValue(proposal);
      const normalizedValue = normalizeComparableText(reviewedValue);
      const exactValueMapped = spans.some((span) => {
        const normalizedSpan = normalizeComparableText(span.text);
        return ` ${normalizedSpan} `.includes(` ${normalizedValue} `) ||
          (proposal.group === "timeline" &&
            isCalendarDate(reviewedValue) &&
            passageStatesEquivalentNaturalLanguageDate(span.text, reviewedValue));
      });
      if (!normalizedValue || !exactValueMapped) return null;
      mappings.push({
        claimId: proposal.id,
        passageIds: [...passageIds],
        quotedSpans: spans,
        status: "direct",
      });
    }
    return mappings;
  } catch {
    return null;
  }
}

export function applyScreen03HostEvidenceMappings(
  state: Screen03VerificationState,
  value: unknown,
) {
  const mappings = restoreScreen03HostEvidenceMappings(value, state);
  if (!mappings) fail("Host evidence mappings failed their fixed contract.");
  let proposals = clone(state.proposals);
  for (const mapping of mappings) {
    const sourceIds = state.evidence
      .filter((evidence) => evidence.passages.some((passage) =>
        mapping.passageIds.includes(passage.id)
      ))
      .map((evidence) => evidence.id);
    proposals = mapProposal(proposals, mapping.claimId, (proposal) => ({
      ...proposal,
      support: "direct",
      sourceIds,
      passageIds: [...mapping.passageIds],
      // The host may suggest evidence links; only a researcher action changes
      // reviewStatus or editedValue.
      reviewStatus: proposal.reviewStatus,
      editedValue: proposal.editedValue,
    }));
  }
  return proposals;
}

export function buildScreen03SupportedFacts(
  state: Screen03VerificationState,
): Screen03SupportedFact[] {
  return screen03FactualClaims(state.proposals)
    .filter((proposal) =>
      screen03ProposalConfirmability(
        proposal,
        state.evidence,
        resolvedProposalValue(proposal),
        proposal.reviewStatus === "edited",
      ).confirmable
    )
    .map((proposal) => ({
      claimId: proposal.id,
      group: proposal.group,
      label: proposal.label,
      value: resolvedProposalValue(proposal),
      evidenceIds: state.evidence
        .filter((evidence) => evidence.passages.some((passage) =>
          proposal.passageIds.includes(passage.id)
        ))
        .map((evidence) => evidence.id),
      passageIds: [...proposal.passageIds],
    }));
}

const HOST_EVIDENCE_MAPPING_FINGERPRINT_PREFIX =
  "Host evidence mapping fingerprint: ";
const HOST_EVIDENCE_APPLICATION_BINDING_PREFIX =
  "Host evidence application binding: ";

function canonicalScreen03HostEvidenceMappings(
  mappings: readonly Screen03HostEvidenceMapping[],
) {
  return mappings.map((mapping) => ({
    claimId: mapping.claimId,
    passageIds: [...mapping.passageIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    quotedSpans: [...mapping.quotedSpans]
      .sort((left, right) =>
        left.passageId.localeCompare(right.passageId) ||
        left.start - right.start ||
        left.end - right.end ||
        left.text.localeCompare(right.text)
      )
      .map((span) => ({ ...span })),
    status: mapping.status,
  })).sort((left, right) => left.claimId.localeCompare(right.claimId));
}

export function fingerprintScreen03HostEvidenceMappings(
  mappings: readonly Screen03HostEvidenceMapping[],
) {
  return fingerprintScreen03Value(
    canonicalScreen03HostEvidenceMappings(mappings),
  );
}

function hostEvidenceMappingFingerprintFromReason(reason: string) {
  const match = new RegExp(
    `${HOST_EVIDENCE_MAPPING_FINGERPRINT_PREFIX}(fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})\\.`,
  ).exec(reason);
  return match?.[1] ?? null;
}

function hostEvidenceApplicationBindingFromReason(reason: string) {
  const match = new RegExp(
    `${HOST_EVIDENCE_APPLICATION_BINDING_PREFIX}(fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})\\.$`,
  ).exec(reason);
  return match?.[1] ?? null;
}

/**
 * Applies a fixed-validated host passage mapping to the canonical Screen 3
 * workflow without recording a researcher decision. Every newly validated
 * result receives one result-bound audit marker, including a complete result
 * that leaves the proposal graph unchanged. Replaying that exact result marker
 * is idempotent. The Event Card itself remains unlocked and every affected
 * claim remains proposed until the researcher reviews it.
 */
export function integrateScreen03HostEvidenceMappings(
  inputState: Screen03VerificationState,
  mappings: unknown,
  input: {
    claimGroupId: string;
    resultId: string;
    applicationBindingFingerprint: string;
    at: string;
  },
): { state: Screen03VerificationState; duplicate: boolean } {
  const state = requireScreen03VerificationState(inputState);
  assertString(input.claimGroupId, "hostEvidence.claimGroupId", MAX_SHORT);
  assertString(input.resultId, "hostEvidence.resultId", MAX_SHORT);
  assertFingerprint(
    input.applicationBindingFingerprint,
    "hostEvidence.applicationBindingFingerprint",
  );
  const restoredMappings = restoreScreen03HostEvidenceMappings(mappings, state);
  if (!restoredMappings) fail("Host evidence mappings failed their fixed contract.");
  const mappingFingerprint = fingerprintScreen03HostEvidenceMappings(
    restoredMappings,
  );
  const proposals = applyScreen03HostEvidenceMappings(state, restoredMappings);
  const resultMarkers = state.history.filter((event) =>
    event.action === "host-evidence-mapping-applied" &&
    event.value === input.resultId
  );
  if (
    resultMarkers.length === 1 &&
    resultMarkers[0]!.actor === "chatgpt-host" &&
    resultMarkers[0]!.targetId === input.claimGroupId &&
    hostEvidenceMappingFingerprintFromReason(resultMarkers[0]!.reason) ===
      mappingFingerprint &&
    hostEvidenceApplicationBindingFromReason(resultMarkers[0]!.reason) ===
      input.applicationBindingFingerprint &&
    serializeDeterministicJson(proposals) ===
      serializeDeterministicJson(state.proposals)
  ) {
    return { state, duplicate: true };
  }
  if (resultMarkers.length > 0) {
    fail("The host evidence result is already bound to a different audit marker.");
  }
  if (state.status === "locked") {
    fail("A locked Event Card cannot receive a host evidence mapping.");
  }
  actionTime(state, input.at);
  if (state.history.length >= MAX_HISTORY) {
    fail("Screen 3 history is full; the host evidence mapping cannot be recorded.");
  }
  const proposalsChanged = serializeDeterministicJson(proposals) !==
    serializeDeterministicJson(state.proposals);
  const entry = historyEvent(
    state,
    "host-evidence-mapping-applied",
    input.claimGroupId,
    input.at,
    (proposalsChanged
      ? "Fixed software validated exact active authoritative passages proposed by the ChatGPT host; no researcher decision was made."
      : "Fixed software validated the complete host evidence result; the canonical proposal graph was already unchanged and no researcher decision was made."
    ) +
      ` ${HOST_EVIDENCE_MAPPING_FINGERPRINT_PREFIX}${mappingFingerprint}.` +
      ` ${HOST_EVIDENCE_APPLICATION_BINDING_PREFIX}${input.applicationBindingFingerprint}.`,
    input.resultId,
  );
  return {
    duplicate: false,
    state: withIntegrity({
      ...state,
      proposals,
      revision: state.revision + 1,
      updatedAt: input.at,
      history: [...state.history, entry],
    }),
  };
}

function confirmabilityFailureMessage(
  result: Screen03ProposalConfirmability,
  edited: boolean,
) {
  switch (result.reason) {
    case "no-direct-support":
    case "inactive-direct-support":
      return "Accepted or edited fields require active direct passage support; otherwise reject them or leave them unresolved.";
    case "incomplete-component":
      return "Accepted or edited component fields require a complete source-backed statement; otherwise leave them unresolved.";
    case "reviewed-value-not-supported":
      return edited
        ? "An edited value must appear in an active direct passage; otherwise reject it or leave it unresolved."
        : "An accepted value must appear as an exact phrase or equivalent date in an active direct passage; otherwise reject it or leave it unresolved.";
    case "confirmable":
      return "The reviewed value is confirmable.";
  }
}

function actionTime(state: Screen03VerificationState, at: string) {
  assertUtcTimestamp(at, "action.at");
  if (at < state.updatedAt) fail("Screen 3 actions cannot move backward in time.");
}

function historyEvent(
  state: Screen03VerificationState,
  action: Screen03AuditEvent["action"],
  targetId: string | null,
  at: string,
  reason: string,
  value: string | null,
  previousReviewStatus: Screen03ReviewStatus | null = null,
  nextReviewStatus: Screen03ReviewStatus | null = null,
): Screen03AuditEvent {
  assertString(reason, "action.reason", MAX_LONG);
  const actor: Screen03AuditEvent["actor"] =
    action === "host-briefing-lifecycle-attached" ||
      action === "orientation-attached"
      ? "fixed-core"
      : action === "host-interpretation-integrated" ||
          action === "host-evidence-mapping-applied" ||
        action === "host-briefing-proposed"
      ? "chatgpt-host"
      : action === "host-briefing-confirmed" ||
          action === "host-briefing-revised" ||
          action === "host-briefing-rejected"
        ? "researcher"
      : action === "research-integrated" ||
          action === "research-refreshed" ||
          action === "context-refreshed" ||
          action === "direct-support-searched"
        ? "research-service"
        : "researcher";
  return {
    id: `screen03-history:${state.revision + 1}:${action}`,
    action, targetId, at, actor,
    reason, value, previousReviewStatus, nextReviewStatus,
  };
}

function mapProposal(
  groups: Screen03ProposalGroups,
  id: string,
  update: (proposal: Screen03AnyProposal) => Screen03AnyProposal,
): Screen03ProposalGroups {
  let found = false;
  const map = <T extends Screen03AnyProposal>(list: T[]) => list.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return update(item) as T;
  });
  const next = {
    identity: map(groups.identity), overview: map(groups.overview), timeline: map(groups.timeline),
    component: map(groups.component), eligibility: map(groups.eligibility), amendment: map(groups.amendment),
    requiredVariable: map(groups.requiredVariable),
  };
  if (!found) fail(`Unknown Screen 3 proposal ${id}.`);
  return next;
}

function reviewState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "review-field" }>,
) {
  if (state.status === "locked") fail("Unlock changed evidence before editing a locked Event Card.");
  const current = allProposals(state.proposals).find((item) => item.id === action.proposalId);
  if (!current) fail(`Unknown Screen 3 proposal ${action.proposalId}.`);
  const isFactualClaim = screen03FactualClaims(state.proposals).some(
    (proposal) => proposal.id === current.id,
  );
  if (!isFactualClaim && current.group !== "timeline") {
    fail(
      "Only a reader-visible factual claim or historical timeline entry can receive a Screen 3 review decision.",
    );
  }
  const nextStatus: Screen03ReviewStatus = action.decision === "accept" ? "accepted" : action.decision === "edit" ? "edited" : action.decision === "reject" ? "rejected" : "unresolved";
  let editedValue: string | null = null;
  if (nextStatus === "edited") {
    assertString(action.editedValue, "action.editedValue", MAX_LONG);
    if (current.group === "timeline") assertCalendarDate(action.editedValue, "action.editedValue");
    editedValue = action.editedValue;
    const confirmability = screen03ProposalConfirmability(
      current,
      state.evidence,
      editedValue,
      true,
    );
    if (!confirmability.confirmable) {
      fail(confirmabilityFailureMessage(confirmability, true));
    }
  } else if (action.editedValue !== undefined) {
    fail("editedValue is only allowed for the edit decision.");
  }
  if (nextStatus === "accepted") {
    const confirmability = screen03ProposalConfirmability(
      current,
      state.evidence,
      current.value,
      false,
    );
    if (!confirmability.confirmable) {
      fail(confirmabilityFailureMessage(confirmability, false));
    }
  }
  const proposals = mapProposal(state.proposals, current.id, (proposal) => ({
    ...proposal,
    reviewStatus: nextStatus,
    editedValue,
  }));
  const acceptedTimelineIds = new Set(
    proposals.timeline
      .filter(
        (proposal) =>
          (proposal.reviewStatus === "accepted" ||
            proposal.reviewStatus === "edited") &&
          screen03ProposalConfirmability(
            proposal,
            state.evidence,
            resolvedProposalValue(proposal),
            proposal.reviewStatus === "edited",
          ).confirmable,
      )
      .map((proposal) => proposal.id),
  );
  const focalClock = acceptedTimelineIds.has(
    state.focalClock.selectedProposalId ?? "",
  )
    ? {
        selectedProposalId: state.focalClock.selectedProposalId,
        alternativeProposalIds: state.focalClock.alternativeProposalIds.filter(
          (id) => acceptedTimelineIds.has(id),
        ),
      }
    : { selectedProposalId: null, alternativeProposalIds: [] };
  const previousDateContradictions = new Map(
    state.contradictions
      .filter((item) => item.kind === "date-order")
      .map((item) => [item.id, item]),
  );
  const detectedDateContradictions = detectScreen03DateOrderContradictions(
    proposals.timeline,
  );
  const contradictions = [
    ...state.contradictions.filter((item) => item.kind !== "date-order"),
    ...detectedDateContradictions.map((detected) => {
      const previous = previousDateContradictions.get(detected.id);
      return previous?.summary === detected.summary ? previous : detected;
    }),
  ];
  const entry = historyEvent(
    state,
    "review-field",
    current.id,
    action.at,
    action.reason,
    editedValue ?? current.value,
    current.reviewStatus,
    nextStatus,
  );
  return withIntegrity({
    ...state,
    revision: state.revision + 1,
    updatedAt: action.at,
    proposals,
    focalClock,
    contradictions: uniqueContradictions(contradictions),
    history: [...state.history, entry],
  });
}

function reviewedComponentValueIsComplete(
  proposal: Screen03AnyProposal,
  reviewedValue: string,
) {
  if (proposal.group !== "component") return true;
  const value = reviewedValue.trim();
  return value.length >= 24 &&
    !/^['’]s\b/i.test(value) &&
    !/(?:[,;:]|\b(?:and|or|the|to))$/i.test(value);
}

function reviewAllState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "review-all-fields" }>,
) {
  if (state.status === "loading") {
    fail("Research must complete before reviewing all Screen 3 claims.");
  }
  if (state.status === "locked") {
    fail("A locked Event Card cannot change its claim review.");
  }

  const changed: Array<{
    previous: Screen03AnyProposal;
    next: Screen03AnyProposal;
  }> = [];
  const classify = <T extends Screen03AnyProposal>(items: T[]) =>
    items.map((proposal) => {
      const confirmable = screen03ProposalConfirmability(
        proposal,
        state.evidence,
        resolvedProposalValue(proposal),
        proposal.reviewStatus === "edited",
      ).confirmable;
      const next = action.mode === "unconfirm"
        ? {
            ...proposal,
            reviewStatus: "proposed" as const,
            editedValue: null,
          }
        : !confirmable ||
            proposal.reviewStatus === "accepted" ||
            proposal.reviewStatus === "edited" ||
            proposal.reviewStatus === "rejected"
        ? proposal
        : {
            ...proposal,
            reviewStatus: "accepted" as const,
            editedValue: null,
          };
      if (
        next.reviewStatus !== proposal.reviewStatus ||
        next.editedValue !== proposal.editedValue
      ) {
        changed.push({ previous: proposal, next });
      }
      return next as T;
    });

  const proposals: Screen03ProposalGroups = {
    identity: classify(state.proposals.identity),
    overview: classify(state.proposals.overview),
    timeline: classify(state.proposals.timeline),
    component: classify(state.proposals.component),
    eligibility: classify(state.proposals.eligibility),
    amendment: classify(state.proposals.amendment),
    requiredVariable: state.proposals.requiredVariable,
  };
  if (changed.length === 0) {
    fail(
      action.mode === "confirm"
        ? "No directly supported Screen 3 claim is awaiting bulk confirmation."
        : "Every Screen 3 claim is already unconfirmed.",
    );
  }
  if (state.history.length + changed.length > MAX_HISTORY) {
    fail("Screen 3 history is full; the all-claims review cannot be recorded safely.");
  }

  const history = [...state.history];
  changed.forEach(({ previous, next }, index) => {
    const revisionState = {
      ...state,
      revision: state.revision + index,
    };
    history.push(historyEvent(
      revisionState,
      "review-field",
      previous.id,
      action.at,
      action.reason,
      next.reviewStatus === "edited" && next.editedValue
        ? next.editedValue
        : next.value,
      previous.reviewStatus,
      next.reviewStatus,
    ));
  });

  const acceptedTimelineIds = new Set(
    proposals.timeline
      .filter((proposal) =>
        (proposal.reviewStatus === "accepted" ||
          proposal.reviewStatus === "edited") &&
        screen03ProposalConfirmability(
          proposal,
          state.evidence,
          resolvedProposalValue(proposal),
          proposal.reviewStatus === "edited",
        ).confirmable
      )
      .map((proposal) => proposal.id),
  );
  const focalClock = acceptedTimelineIds.has(
    state.focalClock.selectedProposalId ?? "",
  )
    ? {
        selectedProposalId: state.focalClock.selectedProposalId,
        alternativeProposalIds: state.focalClock.alternativeProposalIds.filter(
          (id) => acceptedTimelineIds.has(id),
        ),
      }
    : { selectedProposalId: null, alternativeProposalIds: [] };

  return withIntegrity({
    ...state,
    revision: state.revision + changed.length,
    updatedAt: action.at,
    proposals,
    contradictions: state.contradictions,
    focalClock,
    history,
  });
}

function supportedTimeline(state: Screen03VerificationState, id: string) {
  const proposal = state.proposals.timeline.find((item) => item.id === id);
  return proposal &&
      screen03ProposalConfirmability(
        proposal,
        state.evidence,
        resolvedProposalValue(proposal),
        proposal.reviewStatus === "edited",
      ).confirmable
    ? proposal
    : null;
}

function reviewedSupportedTimeline(
  state: Screen03VerificationState,
  id: string,
) {
  const proposal = supportedTimeline(state, id);
  return proposal &&
      (proposal.reviewStatus === "accepted" ||
        proposal.reviewStatus === "edited")
    ? proposal
    : null;
}

function selectClockState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "select-focal-clock" }>,
) {
  if (state.status === "locked") fail("A locked Event Card cannot change its focal clock.");
  if (!supportedTimeline(state, action.proposalId)) fail("Focal clock must be a directly supported timeline field.");
  assertStringArray(action.alternativeProposalIds, "action.alternativeProposalIds");
  // Current timeline dates use the standard factual review controls, but the
  // UI exposes no focal-clock selector. Keep this historical action restorable
  // only for dates already reviewed and directly supported.
  if (!reviewedSupportedTimeline(state, action.proposalId)) return state;
  if (action.alternativeProposalIds.includes(action.proposalId) || action.alternativeProposalIds.some((id) => !reviewedSupportedTimeline(state, id))) fail("Alternative clocks must be distinct directly supported reviewed timeline fields.");
  const entry = historyEvent(state, "select-focal-clock", action.proposalId, action.at, action.reason, action.proposalId);
  return withIntegrity({
    ...state,
    revision: state.revision + 1,
    updatedAt: action.at,
    focalClock: { selectedProposalId: action.proposalId, alternativeProposalIds: [...action.alternativeProposalIds] },
    history: [...state.history, entry],
  });
}

function markChangedState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "mark-source-changed" }>,
) {
  assertFingerprint(action.contentFingerprint, "action.contentFingerprint");
  const allMatching = state.evidence.filter((item) =>
    item.id === action.sourceId || item.sourceId === action.sourceId
  );
  if (allMatching.length === 0) {
    fail(`Unknown Screen 3 source ${action.sourceId}.`);
  }
  const matching = allMatching.filter((item) => item.status !== "changed");
  if (matching.length === 0) {
    fail("The Screen 3 source is already stale and requires renewed retrieval.");
  }
  if (matching.some((item) =>
    item.contentFingerprint === action.contentFingerprint
  )) {
    fail("Changed source must have a different content fingerprint.");
  }
  const matchingIds = new Set(matching.map((item) => item.id));
  const versions = screen03StaleEvidenceVersions(
    matching,
    state.evidence.filter((item) => !matchingIds.has(item.id)),
  );
  const reopened: string[] = [];
  const invalidatedProposalIds = new Set<string>();
  const reopen = (proposal: Screen03AnyProposal) => {
    const linked = screen03ProposalUsesEvidence(proposal, matching);
    if (!linked) return proposal;
    invalidatedProposalIds.add(proposal.id);
    if (proposal.reviewStatus !== "proposed") reopened.push(proposal.id);
    return {
      ...screen03RemapProposalToStaleEvidence(proposal, versions),
      reviewStatus: "proposed" as const,
      editedValue: null,
      support: "unsupported" as const,
    };
  };
  const proposals: Screen03ProposalGroups = {
    identity: state.proposals.identity.map(reopen) as Screen03Proposal[],
    overview: state.proposals.overview.map(reopen) as Screen03Proposal[],
    timeline: state.proposals.timeline.map(reopen) as Screen03TimelineProposal[],
    component: state.proposals.component.map(reopen) as Screen03Proposal[],
    eligibility: state.proposals.eligibility.map(reopen) as Screen03Proposal[],
    amendment: state.proposals.amendment.map(reopen) as Screen03Proposal[],
    requiredVariable: state.proposals.requiredVariable.map(reopen) as Screen03Proposal[],
  };
  const historyEventId =
    `screen03-history:${state.revision + 1}:mark-source-changed`;
  const sourceChange = screen03SourceChangeRecord({
    historyEventId,
    sourceId: action.sourceId,
    detectedAt: action.at,
    trigger: "mark-source-changed",
    previousEvidence: matching,
    observedContentFingerprint: action.contentFingerprint,
    versions,
    proposals: state.proposals,
    reason: action.reason,
  });
  const sourceChanges = [...(state.sourceChanges ?? []), sourceChange];
  if (sourceChanges.length > MAX_HISTORY) {
    fail("Screen 3 source-change history is full; the source was not overwritten.");
  }
  const entry = historyEvent(
    state,
    "mark-source-changed",
    action.sourceId,
    action.at,
    action.reason,
    screen03ManualSourceChangeHistoryValue([sourceChange]),
  );
  const { interpretation: _staleInterpretation, ...stateWithoutInterpretation } =
    state;
  const contradictions = state.contradictions.map((contradiction) =>
    contradiction.status === "unresolved" &&
      (contradiction.kind === "source-conflict" ||
        contradiction.kind === "scope-conflict") &&
      contradiction.proposalIds.some((id) => invalidatedProposalIds.has(id))
      ? {
          ...contradiction,
          status: "resolved" as const,
          resolution:
            `Source ${action.sourceId} changed, so this conflict is no longer active. Its historical disagreement remains recorded and requires renewed retrieval before reactivation.`,
        }
      : contradiction,
  );
  return withIntegrity({
    ...stateWithoutInterpretation,
    status: "reviewing",
    revision: state.revision + 1,
    updatedAt: action.at,
    researchCoverage: {
      ...state.researchCoverage,
      status: "incomplete",
      gaps: [...new Set([...state.researchCoverage.gaps, `Source ${action.sourceId} changed and requires renewed retrieval and review.`])],
      queries: state.researchCoverage.queries.map((query) => ({
        ...query,
        returnedEvidenceIds: [...new Set(query.returnedEvidenceIds.flatMap(
          (id) => versions.sourceReferenceMap.get(id) ?? [id]
        ))],
      })),
      activeEvidenceCount: versions.evidence.filter((item) =>
        item.status !== "changed"
      ).length,
      stoppingRule: { ...state.researchCoverage.stoppingRule, status: "not-met", note: `Source ${action.sourceId} changed after its prior retrieval.` },
    },
    evidence: versions.evidence,
    sourceChanges,
    proposals,
    contradictions,
    focalClock: reopened.includes(state.focalClock.selectedProposalId ?? "")
      ? { selectedProposalId: null, alternativeProposalIds: [] }
      : {
          ...state.focalClock,
          alternativeProposalIds:
            state.focalClock.alternativeProposalIds.filter(
              (id) => !reopened.includes(id),
            ),
        },
    history: [...state.history, entry],
    lockedEventCard: null,
  });
}

function resolveContradictionState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "resolve-contradiction" }>,
) {
  if (state.status === "locked") {
    fail("A locked Event Card cannot change its contradiction review.");
  }
  assertString(action.resolution, "action.resolution", MAX_LONG);
  const current = state.contradictions.find(
    (item) => item.id === action.contradictionId,
  );
  if (!current) {
    fail(`Unknown Screen 3 contradiction ${action.contradictionId}.`);
  }
  const contradictions = state.contradictions.map((item) =>
    item.id === action.contradictionId
      ? {
          ...item,
          status: "resolved" as const,
          resolution: action.resolution,
        }
      : item,
  );
  const entry = historyEvent(
    state,
    "resolve-contradiction",
    current.id,
    action.at,
    action.reason,
    action.resolution,
  );
  return withIntegrity({
    ...state,
    revision: state.revision + 1,
    updatedAt: action.at,
    contradictions,
    history: [...state.history, entry],
    integrity: undefined as never,
  });
}

function lockState(
  state: Screen03VerificationState,
  action: Extract<Screen03Action, { type: "lock-event-card" }>,
) {
  if (state.status === "loading") fail("Research must complete before the Event Card can lock.");
  if (state.status === "locked") fail("The Event Card is already locked.");
  if (state.researchCoverage.status !== "completed") fail("The bounded research stopping rule must be met before lock.");
  const proposals = screen03FactualClaims(state.proposals);
  if (proposals.some((proposal) => proposal.reviewStatus === "proposed")) fail("Every visible factual claim requires an explicit decision before lock.");
  const accepted = proposals.filter(
    (proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited",
  );
  if (accepted.some(
    (proposal) =>
      !screen03ProposalConfirmability(
        proposal,
        state.evidence,
        resolvedProposalValue(proposal),
        proposal.reviewStatus === "edited",
      ).confirmable,
  )) fail("Accepted and edited fields require a complete reviewed value with active direct passage support.");
  const acceptedIdentity = state.proposals.identity.filter(
    (proposal) => proposal.reviewStatus === "accepted" || proposal.reviewStatus === "edited",
  );
  if (!acceptedIdentity.some((proposal) =>
    screen03ProposalConfirmability(
      proposal,
      state.evidence,
      resolvedProposalValue(proposal),
      proposal.reviewStatus === "edited",
    ).confirmable
  )) fail("At least one identity field must be accepted or edited with active direct passage support.");
  const focalId = state.focalClock.selectedProposalId;
  const cardInput = lockedEventCardInput(state, action.at);
  const lockedEventCard: Screen03LockedEventCard = { ...cardInput, eventCardFingerprint: fingerprintScreen03Value(cardInput) };
  const entry = historyEvent(state, "lock-event-card", focalId, action.at, action.reason, lockedEventCard.eventCardFingerprint);
  return withIntegrity({
    ...state,
    status: "locked",
    revision: state.revision + 1,
    updatedAt: action.at,
    history: [...state.history, entry],
    lockedEventCard,
  });
}

export function applyScreen03Action(
  inputState: Screen03VerificationState,
  action: Screen03Action,
): Screen03VerificationState {
  const state = requireScreen03VerificationState(inputState);
  actionTime(state, action.at);
  const next = (() => {
    switch (action.type) {
      case "review-field": return reviewState(state, action);
      case "review-all-fields": return reviewAllState(state, action);
      case "select-focal-clock": return selectClockState(state, action);
      case "resolve-contradiction": return resolveContradictionState(state, action);
      case "mark-source-changed": return markChangedState(state, action);
      case "lock-event-card": return lockState(state, action);
    }
  })();
  const refinementInput = (() => {
    switch (action.type) {
      case "review-field":
        return {
          at: action.at,
          decision: action.decision,
          proposalId: action.proposalId,
          reason: action.reason,
        } as const;
      case "review-all-fields":
        return {
          at: action.at,
          decision: action.mode === "confirm"
            ? "confirm-all" as const
            : "unconfirm-all" as const,
          proposalId: null,
          reason: action.reason,
        };
      case "mark-source-changed":
        return {
          at: action.at,
          decision: "source-changed" as const,
          proposalId: null,
          reason: action.reason,
        };
      case "resolve-contradiction":
        return {
          at: action.at,
          decision: "contradiction-resolved" as const,
          proposalId: null,
          reason: action.reason,
        };
      case "select-focal-clock":
      case "lock-event-card":
        return null;
    }
  })();
  const oriented = refinementInput && next.orientation
    ? withIntegrity({
        ...next,
        orientation: refineScreen03Orientation(state, next, refinementInput),
      })
    : next;
  if (!oriented.briefing) return oriented;
  return withIntegrity({
    ...oriented,
    briefing: markScreen03BriefingFactsStale(oriented.briefing),
  });
}

/** Full immutable handoff fingerprint, useful to reject stale cached Screen 3 state. */
export function fingerprintScreen03UpstreamHandoff(handoff: Screen02WorkflowHandoff) {
  return fingerprintScreen02WorkflowHandoff(canonicalV4Handoff(handoff));
}
