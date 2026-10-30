import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  type TypedDate,
} from "./contracts";
import type {
  CoEventPolicyLifecycleHandoff,
  CoEventPolicyLifecycleStageKind,
} from "./co-event-policy-lifecycle-handoff";
import type {
  PolicyEventCardReviewState,
  PolicyReviewedEventCard,
} from "./policy-event-card-review";
import type {
  PolicyChronologyClock,
  PolicyChronologyStage,
  PolicyChronologyTiming,
} from "./policy-chronology";
import type {
  PolicyLifecycleStageDisposition,
  PolicyLifecycleStageDocumentAcquisition,
  PolicyLifecycleStageOfficialSource,
} from "./policy-lifecycle-stage-review";

export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_PROPOSAL_VERSION =
  "screen-02-policy-lifecycle-stage-revision-proposal-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_REVIEW_VERSION =
  "screen-02-policy-lifecycle-stage-revision-review-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_EVENT_CARD_VERSION =
  "screen-02-policy-lifecycle-stage-event-card-contribution-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_REVISION_PROPOSALS = 64;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_REVISION_REVIEWS = 128;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_REVISION_REVIEWS_PER_PROPOSAL = 2;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_MAX_BYTES = 192_000;

export const POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY =
  "This source-bound proposal preserves the official document, typed source date, exact focal-policy passages, qualifications, and researcher interpretation separately. Proposing or reviewing it does not change chronology or an Event Card. Only a later explicit Event Card lock may include an accepted proposal; rejection or deferral leaves both artifacts unchanged. It does not classify an independent event, assess a causal relation, or add a control." as const;

export const POLICY_LIFECYCLE_STAGE_CHRONOLOGY_STAGES = [
  "legislative_initiation",
  "announcement",
  "adoption",
  "publication",
  "scheduled_effect",
  "legal_effect",
  "compliance",
  "compliance_filing",
  "implementation",
  "enforcement",
  "amendment",
  "injunction",
  "invalidation",
  "withdrawal",
  "suspension",
  "repeal",
  "supersession",
] as const satisfies readonly PolicyChronologyStage[];

const STAGE_ORDER = new Map(
  POLICY_LIFECYCLE_STAGE_CHRONOLOGY_STAGES.map((stage, index) => [stage, index]),
);

const STAGE_LABELS: Record<PolicyChronologyStage, string> = {
  legislative_initiation: "Legislative initiation",
  announcement: "Announcement",
  adoption: "Adoption",
  publication: "Publication",
  scheduled_effect: "Scheduled effective date",
  legal_effect: "Legal effect",
  compliance: "Compliance",
  compliance_filing: "Compliance filing deadline",
  implementation: "Implementation",
  enforcement: "Enforcement",
  amendment: "Amendment",
  injunction: "Stay or injunction",
  invalidation: "Judicial invalidation or vacatur",
  withdrawal: "Withdrawal",
  suspension: "Suspension",
  repeal: "Repeal",
  supersession: "Supersession",
};

const COMPATIBLE_STAGES: Record<
  CoEventPolicyLifecycleStageKind,
  readonly PolicyChronologyStage[]
> = {
  implementation_delay: ["implementation"],
  litigation_or_court_order: [
    "announcement",
    "scheduled_effect",
    "legal_effect",
    "enforcement",
    "injunction",
    "invalidation",
    "suspension",
  ],
  amendment: ["amendment"],
  suspension: ["suspension"],
  repeal: ["repeal"],
  enforcement: ["enforcement"],
  other: POLICY_LIFECYCLE_STAGE_CHRONOLOGY_STAGES,
};

export type PolicyLifecycleStageSourceDateOption = {
  id: string;
  origin: "publication_metadata" | "legal_version_metadata";
  label: string;
  typedDate: TypedDate;
  timing: Extract<PolicyChronologyTiming, { mode: "absolute" }>;
};

export type PolicyLifecycleStageRevisionProposal = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_PROPOSAL_VERSION;
  id: string;
  ordinal: number;
  handoffReference: {
    handoffId: string;
    handoffFingerprint: string;
    targetPolicyEventCardReviewId: string;
  };
  acquisitionReference: {
    acquisitionId: string;
    acquisitionFingerprint: string;
    sourceSnapshotFingerprint: string;
  };
  dispositionReference: {
    dispositionId: string;
    dispositionFingerprint: string;
    decision: "accepted_for_event_card_review";
  };
  targetEventCardReviewReference: {
    reviewId: string;
    reviewSeriesId: string;
    reviewOrdinal: number;
    baseProjectionFingerprint: string;
  };
  sourceReference: {
    sourceId: string;
    documentVersionId: string;
    nativeDocumentNumber: string;
    title: string;
    canonicalUrl: string;
    contentHash: string;
    sourceSnapshotFingerprint: string;
  };
  stage: {
    handoffStageKind: CoEventPolicyLifecycleStageKind;
    chronologyStage: PolicyChronologyStage;
    label: string;
    timing: PolicyChronologyTiming;
    sourceDateId: string | null;
    sourceTypedDate: TypedDate | null;
    clockId: string;
    statementId: string;
    statement: string;
    scope: string;
    supportStatus: "indirect";
    reviewStatus: "unreviewed";
    focalPolicyPassageLineages: Array<{
      passageId: string;
      sourceId: string;
      documentVersionId: string;
      focalPolicyAnchorKinds: Array<"formal_identifier" | "official_title">;
      qualification: string;
      unresolvedCrossReferences: string[];
    }>;
    qualifications: string[];
  };
  rationale: string;
  actor: "researcher";
  proposedAt: string;
  chronologyMutation: "proposal_only";
  eventCardMutation: "proposal_only";
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY;
  proposalFingerprint: string;
};

export type PolicyLifecycleStageRevisionDecision =
  | "accepted_for_event_card_revision"
  | "rejected"
  | "deferred";

export type PolicyLifecycleStageRevisionReview = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_REVIEW_VERSION;
  id: string;
  ordinal: number;
  proposalReference: {
    proposalId: string;
    proposalFingerprint: string;
    targetPolicyEventCardReviewId: string;
  };
  decision: PolicyLifecycleStageRevisionDecision;
  rationale: string;
  actor: "researcher";
  reviewedAt: string;
  legalVerificationStatus: "researcher_interpretation_not_legal_verification";
  sourceDocumentPreserved: true;
  chronologyMutation: "none";
  eventCardMutation: "none";
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY;
  reviewFingerprint: string;
};

export type PolicyLifecycleStageEventCardContribution = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_EVENT_CARD_VERSION;
  proposalReference: {
    proposalId: string;
    proposalFingerprint: string;
  };
  reviewReference: {
    reviewId: string;
    reviewFingerprint: string;
    decision: "accepted_for_event_card_revision";
  };
  targetPolicyEventCardReviewId: string;
  sourceReference: PolicyLifecycleStageRevisionProposal["sourceReference"];
  handoffStageKind: CoEventPolicyLifecycleStageKind;
  sourceDateId: string | null;
  sourceTypedDate: TypedDate | null;
  focalPolicyPassageLineages:
    PolicyLifecycleStageRevisionProposal["stage"]["focalPolicyPassageLineages"];
  proposalRationale: string;
  reviewRationale: string;
  clock: PolicyChronologyClock;
  inclusionStatus: "included_by_explicit_event_card_lock";
  includedAt: string;
  sourceDocumentPreserved: true;
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY;
  contributionFingerprint: string;
};

type ProposalBody = Omit<
  PolicyLifecycleStageRevisionProposal,
  "proposalFingerprint"
>;
type ReviewBody = Omit<
  PolicyLifecycleStageRevisionReview,
  "reviewFingerprint"
>;
type ContributionBody = Omit<
  PolicyLifecycleStageEventCardContribution,
  "contributionFingerprint"
>;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireText(value: string, label: string, maximum = 2_000) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${maximum} characters.`,
    );
  }
  return value;
}

function validDate(value: string) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value);
  if (!match) return false;
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return false;
  if (day === null) return true;
  const date = new Date(Date.UTC(Number(match[1]), month! - 1, day));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function inferredPrecision(value: string): TypedDate["precision"] {
  return value.length === 4 ? "year" : value.length === 7 ? "month" : "day";
}

function proposalBody(value: PolicyLifecycleStageRevisionProposal) {
  const { proposalFingerprint: _fingerprint, ...body } = value;
  return body;
}

function reviewBody(value: PolicyLifecycleStageRevisionReview) {
  const { reviewFingerprint: _fingerprint, ...body } = value;
  return body;
}

function contributionBody(value: PolicyLifecycleStageEventCardContribution) {
  const { contributionFingerprint: _fingerprint, ...body } = value;
  return body;
}

export function policyLifecycleStageChronologyOptions(
  handoffStageKind: CoEventPolicyLifecycleStageKind,
) {
  return [...COMPATIBLE_STAGES[handoffStageKind]];
}

export function policyLifecycleStageSourceDateOptions(
  source: PolicyLifecycleStageOfficialSource,
) {
  const dates: Array<{
    origin: PolicyLifecycleStageSourceDateOption["origin"];
    typedDate: TypedDate;
  }> = [];
  if (source.publicationDate) {
    dates.push({
      origin: "publication_metadata",
      typedDate: {
        start: source.publicationDate,
        end: null,
        precision: inferredPrecision(source.publicationDate),
        kind: "publication",
        passageIds: [],
      },
    });
  }
  dates.push(...source.legalVersionDates.flatMap((typedDate) =>
    typedDate.start
      ? [{
          origin: "legal_version_metadata" as const,
          typedDate: structuredClone(typedDate),
        }]
      : []
  ));
  const unique = new Map<string, typeof dates[number]>();
  for (const value of dates) {
    const key = fingerprintSixScreenValue(value);
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()].map((value): PolicyLifecycleStageSourceDateOption => {
    const typedDate = value.typedDate;
    const id = `policy-lifecycle-source-date-${fingerprintSixScreenValue({
      sourceSnapshotFingerprint: source.sourceSnapshotFingerprint,
      ...value,
    }).slice("fnv1a64:".length)}`;
    return {
      id,
      origin: value.origin,
      label: `${typedDate.kind.replaceAll("_", " ")} · ${typedDate.start}`,
      typedDate: structuredClone(typedDate),
      timing: {
        mode: "absolute",
        start: typedDate.start!,
        end: typedDate.end,
        precision: typedDate.end ? "interval" : typedDate.precision,
      },
    };
  });
}

function passageLineages(source: PolicyLifecycleStageOfficialSource) {
  return source.retainedPassages.flatMap((passage) =>
    passage.focalPolicyAnchorKinds.length
      ? [{
          passageId: passage.id,
          sourceId: passage.sourceId,
          documentVersionId: passage.documentVersionId,
          focalPolicyAnchorKinds: [...passage.focalPolicyAnchorKinds],
          qualification: passage.qualification,
          unresolvedCrossReferences: [...passage.unresolvedCrossReferences],
        }]
      : []
  );
}

function stageStatement(input: {
  sourceTitle: string;
  chronologyStage: PolicyChronologyStage;
  focalPolicyTitle: string;
}) {
  return `The researcher proposes reviewing ${input.sourceTitle} as a ${STAGE_LABELS[
    input.chronologyStage
  ].toLocaleLowerCase("en-US")} stage of ${input.focalPolicyTitle}.`;
}

function proposalStage(input: {
  proposalId: string;
  handoff: CoEventPolicyLifecycleHandoff;
  acquisition: PolicyLifecycleStageDocumentAcquisition;
  chronologyStage: PolicyChronologyStage;
  sourceDateId: string | null;
}) {
  const source = input.acquisition.source!;
  const options = policyLifecycleStageSourceDateOptions(source);
  const selected = input.sourceDateId === null
    ? null
    : options.find(({ id }) => id === input.sourceDateId) ?? null;
  if (input.sourceDateId !== null && !selected) {
    throw new Error("The lifecycle-stage proposal selected a date outside the retained official-source metadata.");
  }
  if (!policyLifecycleStageChronologyOptions(
    input.handoff.proposedStage.kind,
  ).includes(input.chronologyStage)) {
    throw new Error("The selected chronology stage is incompatible with the routed possible-stage category.");
  }
  const coordinate = fingerprintSixScreenValue({
    proposalId: input.proposalId,
    handoffFingerprint: input.handoff.handoffFingerprint,
    sourceSnapshotFingerprint: source.sourceSnapshotFingerprint,
  }).slice("fnv1a64:".length);
  const timing: PolicyChronologyTiming = selected
    ? structuredClone(selected.timing)
    : {
        mode: "undated",
        reason: "source_did_not_establish_a_normalized_date",
      };
  const qualifications = [
    selected
      ? `The retained date remains ${selected.typedDate.kind.replaceAll("_", " ")} source metadata; the researcher-selected chronology-stage label does not retype the source date.`
      : "No normalized source date was selected; the possible stage remains in the undated chronology group.",
    "The retained passages establish the focal-policy anchor recorded by the acquisition, not the proposed lifecycle relationship or its causal meaning.",
    input.acquisition.limitation ??
      "Only bounded exact official-document passages were retained.",
  ];
  return {
    handoffStageKind: input.handoff.proposedStage.kind,
    chronologyStage: input.chronologyStage,
    label: `${STAGE_LABELS[input.chronologyStage]} review · ${source.title}`,
    timing,
    sourceDateId: selected?.id ?? null,
    sourceTypedDate: selected ? structuredClone(selected.typedDate) : null,
    clockId: `policy-lifecycle-stage-clock-${coordinate}`,
    statementId: `policy-lifecycle-stage-statement-${coordinate}`,
    statement: stageStatement({
      sourceTitle: source.title,
      chronologyStage: input.chronologyStage,
      focalPolicyTitle: input.handoff.focalPolicyReference.officialTitle,
    }),
    scope: `Possible focal-policy lifecycle stage from handoff ${input.handoff.id}.`,
    supportStatus: "indirect" as const,
    reviewStatus: "unreviewed" as const,
    focalPolicyPassageLineages: passageLineages(source),
    qualifications,
  };
}

export function createPolicyLifecycleStageRevisionProposal(input: {
  id: string;
  ordinal: number;
  handoff: CoEventPolicyLifecycleHandoff;
  acquisition: PolicyLifecycleStageDocumentAcquisition;
  disposition: PolicyLifecycleStageDisposition;
  targetReview: PolicyEventCardReviewState;
  chronologyStage: PolicyChronologyStage;
  sourceDateId: string | null;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  proposedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can propose a lifecycle-stage Event Card revision.");
  }
  requireBoundedIdentifier(input.id, "Lifecycle-stage revision proposal id");
  requireCanonicalInstant(input.proposedAt, "Lifecycle-stage proposal time");
  const rationale = requireText(
    input.rationale,
    "Lifecycle-stage proposal rationale",
  );
  const source = input.acquisition.source;
  if (
    !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 ||
    !source || input.acquisition.outcome !== "document_retained" ||
    input.disposition.decision !== "accepted_for_event_card_review" ||
    input.disposition.handoffReference.handoffId !== input.handoff.id ||
    input.disposition.acquisitionReference.acquisitionId !==
      input.acquisition.id ||
    input.handoff.destination.policyEventCardReviewId !== input.targetReview.id ||
    input.targetReview.status !== "in_review" ||
    input.targetReview.lockedEventCard !== null ||
    input.proposedAt < input.disposition.reviewedAt
  ) {
    throw new Error("A lifecycle-stage proposal requires the active routed review and an accepted retained document.");
  }
  const body: ProposalBody = {
    schemaVersion:
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_PROPOSAL_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    handoffReference: {
      handoffId: input.handoff.id,
      handoffFingerprint: input.handoff.handoffFingerprint,
      targetPolicyEventCardReviewId:
        input.handoff.destination.policyEventCardReviewId,
    },
    acquisitionReference: {
      acquisitionId: input.acquisition.id,
      acquisitionFingerprint: input.acquisition.acquisitionFingerprint,
      sourceSnapshotFingerprint: source.sourceSnapshotFingerprint,
    },
    dispositionReference: {
      dispositionId: input.disposition.id,
      dispositionFingerprint: input.disposition.dispositionFingerprint,
      decision: "accepted_for_event_card_review",
    },
    targetEventCardReviewReference: {
      reviewId: input.targetReview.id,
      reviewSeriesId: input.targetReview.seriesId,
      reviewOrdinal: input.targetReview.ordinal,
      baseProjectionFingerprint:
        input.targetReview.binding.projectionFingerprint,
    },
    sourceReference: {
      sourceId: source.sourceId,
      documentVersionId: source.documentVersionId,
      nativeDocumentNumber: source.nativeDocumentNumber,
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      contentHash: source.contentHash,
      sourceSnapshotFingerprint: source.sourceSnapshotFingerprint,
    },
    stage: proposalStage({
      proposalId: input.id,
      handoff: input.handoff,
      acquisition: input.acquisition,
      chronologyStage: input.chronologyStage,
      sourceDateId: input.sourceDateId,
    }),
    rationale,
    actor: "researcher",
    proposedAt: input.proposedAt,
    chronologyMutation: "proposal_only",
    eventCardMutation: "proposal_only",
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY,
  };
  const proposal = {
    ...body,
    proposalFingerprint: fingerprintSixScreenValue(body),
  };
  return validatePolicyLifecycleStageRevisionProposal(proposal, {
    handoff: input.handoff,
    acquisition: input.acquisition,
    disposition: input.disposition,
    targetReview: input.targetReview,
  });
}

export function validatePolicyLifecycleStageRevisionProposal(
  proposal: PolicyLifecycleStageRevisionProposal,
  references?: {
    handoff: CoEventPolicyLifecycleHandoff;
    acquisition: PolicyLifecycleStageDocumentAcquisition;
    disposition: PolicyLifecycleStageDisposition;
    targetReview: PolicyEventCardReviewState;
  },
) {
  if (
    proposal.schemaVersion !==
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_PROPOSAL_VERSION ||
    proposal.proposalFingerprint !==
      fingerprintSixScreenValue(proposalBody(proposal)) ||
    !Number.isSafeInteger(proposal.ordinal) || proposal.ordinal < 1 ||
    proposal.actor !== "researcher" ||
    proposal.chronologyMutation !== "proposal_only" ||
    proposal.eventCardMutation !== "proposal_only" ||
    proposal.independentEventClassification !== "not_assessed" ||
    proposal.relationToComparison.status !== "not_assessed" ||
    proposal.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    proposal.claimBoundary !== POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY ||
    proposal.stage.supportStatus !== "indirect" ||
    proposal.stage.reviewStatus !== "unreviewed" ||
    !POLICY_LIFECYCLE_STAGE_CHRONOLOGY_STAGES.includes(
      proposal.stage.chronologyStage,
    ) ||
    !policyLifecycleStageChronologyOptions(
      proposal.stage.handoffStageKind,
    ).includes(proposal.stage.chronologyStage)
  ) {
    throw new Error("Lifecycle-stage revision proposal is invalid or changed.");
  }
  requireBoundedIdentifier(proposal.id, "Lifecycle-stage revision proposal id");
  requireFingerprint(
    proposal.proposalFingerprint,
    "Lifecycle-stage revision proposal fingerprint",
  );
  requireCanonicalInstant(proposal.proposedAt, "Lifecycle-stage proposal time");
  requireText(proposal.rationale, "Lifecycle-stage proposal rationale");
  requireBoundedIdentifier(
    proposal.targetEventCardReviewReference.reviewId,
    "Lifecycle-stage target review id",
  );
  requireFingerprint(
    proposal.targetEventCardReviewReference.baseProjectionFingerprint,
    "Lifecycle-stage base projection fingerprint",
  );
  requireFingerprint(
    proposal.sourceReference.sourceSnapshotFingerprint,
    "Lifecycle-stage source snapshot fingerprint",
  );
  requireBoundedIdentifier(
    proposal.sourceReference.sourceId,
    "Lifecycle-stage source id",
  );
  requireBoundedIdentifier(
    proposal.sourceReference.documentVersionId,
    "Lifecycle-stage document version id",
  );
  requireSanitizedSourceUrl(proposal.sourceReference.canonicalUrl);
  requireText(proposal.sourceReference.title, "Lifecycle-stage source title", 1_000);
  if (
    !/^\d{4}-\d{4,6}$/u.test(proposal.sourceReference.nativeDocumentNumber) ||
    !/^sha256:[0-9a-f]{64}$/u.test(proposal.sourceReference.contentHash)
  ) throw new Error("Lifecycle-stage official-source identity is invalid.");
  requireText(proposal.stage.label, "Lifecycle-stage chronology label", 1_500);
  requireText(proposal.stage.statement, "Lifecycle-stage proposal statement", 3_000);
  requireText(proposal.stage.scope, "Lifecycle-stage proposal scope", 1_000);
  requireBoundedIdentifier(proposal.stage.clockId, "Lifecycle-stage clock id");
  requireBoundedIdentifier(proposal.stage.statementId, "Lifecycle-stage statement id");
  if (
    !proposal.stage.qualifications.length ||
    proposal.stage.qualifications.length > 8 ||
    proposal.stage.focalPolicyPassageLineages.length < 1 ||
    proposal.stage.focalPolicyPassageLineages.length > 6 ||
    new Set(proposal.stage.focalPolicyPassageLineages.map(({ passageId }) =>
      passageId)).size !== proposal.stage.focalPolicyPassageLineages.length
  ) throw new Error("Lifecycle-stage proposal evidence lineage is invalid.");
  proposal.stage.qualifications.forEach((value) =>
    requireText(value, "Lifecycle-stage proposal qualification", 2_000));
  for (const lineage of proposal.stage.focalPolicyPassageLineages) {
    requireBoundedIdentifier(lineage.passageId, "Lifecycle-stage passage id");
    requireBoundedIdentifier(lineage.sourceId, "Lifecycle-stage passage source id");
    requireBoundedIdentifier(
      lineage.documentVersionId,
      "Lifecycle-stage passage document version id",
    );
    requireText(lineage.qualification, "Lifecycle-stage passage qualification", 1_000);
    if (
      !lineage.focalPolicyAnchorKinds.length ||
      new Set(lineage.focalPolicyAnchorKinds).size !==
        lineage.focalPolicyAnchorKinds.length ||
      lineage.unresolvedCrossReferences.length > 20
    ) throw new Error("Lifecycle-stage focal-policy passage binding is invalid.");
  }
  if (proposal.stage.timing.mode === "relative") {
    throw new Error("A lifecycle-stage document proposal cannot invent a relative deadline.");
  }
  if (proposal.stage.sourceDateId === null) {
    if (
      proposal.stage.sourceTypedDate !== null ||
      proposal.stage.timing.mode !== "undated"
    ) throw new Error("An undated lifecycle-stage proposal contains a source date.");
  } else if (
    !proposal.stage.sourceTypedDate ||
    proposal.stage.timing.mode !== "absolute" ||
    !validDate(proposal.stage.timing.start) ||
    proposal.stage.sourceTypedDate.start !== proposal.stage.timing.start ||
    proposal.stage.sourceTypedDate.end !== proposal.stage.timing.end ||
    (proposal.stage.sourceTypedDate.end !== null
      ? proposal.stage.timing.precision !== "interval"
      : proposal.stage.sourceTypedDate.precision !==
        proposal.stage.timing.precision)
  ) {
    throw new Error("Lifecycle-stage source date and chronology timing are inconsistent.");
  }
  if (references) {
    const { handoff, acquisition, disposition, targetReview } = references;
    const source = acquisition.source;
    const expectedStage = source
      ? proposalStage({
          proposalId: proposal.id,
          handoff,
          acquisition,
          chronologyStage: proposal.stage.chronologyStage,
          sourceDateId: proposal.stage.sourceDateId,
        })
      : null;
    if (
      !source || acquisition.outcome !== "document_retained" ||
      disposition.decision !== "accepted_for_event_card_review" ||
      proposal.handoffReference.handoffId !== handoff.id ||
      proposal.handoffReference.handoffFingerprint !==
        handoff.handoffFingerprint ||
      proposal.handoffReference.targetPolicyEventCardReviewId !==
        handoff.destination.policyEventCardReviewId ||
      proposal.acquisitionReference.acquisitionId !== acquisition.id ||
      proposal.acquisitionReference.acquisitionFingerprint !==
        acquisition.acquisitionFingerprint ||
      proposal.acquisitionReference.sourceSnapshotFingerprint !==
        source.sourceSnapshotFingerprint ||
      proposal.dispositionReference.dispositionId !== disposition.id ||
      proposal.dispositionReference.dispositionFingerprint !==
        disposition.dispositionFingerprint ||
      proposal.targetEventCardReviewReference.reviewId !== targetReview.id ||
      proposal.targetEventCardReviewReference.reviewSeriesId !==
        targetReview.seriesId ||
      proposal.targetEventCardReviewReference.reviewOrdinal !==
        targetReview.ordinal ||
      proposal.targetEventCardReviewReference.baseProjectionFingerprint !==
        targetReview.binding.projectionFingerprint ||
      proposal.sourceReference.sourceId !== source.sourceId ||
      proposal.sourceReference.documentVersionId !== source.documentVersionId ||
      proposal.sourceReference.nativeDocumentNumber !==
        source.nativeDocumentNumber ||
      proposal.sourceReference.title !== source.title ||
      proposal.sourceReference.canonicalUrl !== source.canonicalUrl ||
      proposal.sourceReference.contentHash !== source.contentHash ||
      proposal.sourceReference.sourceSnapshotFingerprint !==
        source.sourceSnapshotFingerprint ||
      proposal.stage.handoffStageKind !== handoff.proposedStage.kind ||
      !expectedStage || !sameSixScreenValue(proposal.stage, expectedStage) ||
      proposal.proposedAt < disposition.reviewedAt
    ) throw new Error("Lifecycle-stage revision proposal lineage is invalid.");
  }
  return proposal;
}

export function createPolicyLifecycleStageRevisionReview(input: {
  id: string;
  ordinal: number;
  proposal: PolicyLifecycleStageRevisionProposal;
  decision: PolicyLifecycleStageRevisionDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can review a lifecycle-stage revision proposal.");
  }
  requireBoundedIdentifier(input.id, "Lifecycle-stage revision review id");
  requireCanonicalInstant(input.reviewedAt, "Lifecycle-stage revision review time");
  const rationale = requireText(input.rationale, "Lifecycle-stage revision review rationale");
  validatePolicyLifecycleStageRevisionProposal(input.proposal);
  if (
    !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 ||
    ![
      "accepted_for_event_card_revision",
      "rejected",
      "deferred",
    ].includes(input.decision) || input.reviewedAt < input.proposal.proposedAt
  ) throw new Error("Lifecycle-stage revision review is invalid.");
  const body: ReviewBody = {
    schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_REVIEW_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    proposalReference: {
      proposalId: input.proposal.id,
      proposalFingerprint: input.proposal.proposalFingerprint,
      targetPolicyEventCardReviewId:
        input.proposal.targetEventCardReviewReference.reviewId,
    },
    decision: input.decision,
    rationale,
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    legalVerificationStatus:
      "researcher_interpretation_not_legal_verification",
    sourceDocumentPreserved: true,
    chronologyMutation: "none",
    eventCardMutation: "none",
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY,
  };
  const review = {
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  };
  return validatePolicyLifecycleStageRevisionReview(review, input.proposal);
}

export function validatePolicyLifecycleStageRevisionReview(
  review: PolicyLifecycleStageRevisionReview,
  proposal?: PolicyLifecycleStageRevisionProposal,
) {
  if (
    review.schemaVersion !==
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_REVIEW_VERSION ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1 ||
    ![
      "accepted_for_event_card_revision",
      "rejected",
      "deferred",
    ].includes(review.decision) || review.actor !== "researcher" ||
    review.legalVerificationStatus !==
      "researcher_interpretation_not_legal_verification" ||
    review.sourceDocumentPreserved !== true ||
    review.chronologyMutation !== "none" || review.eventCardMutation !== "none" ||
    review.independentEventClassification !== "not_assessed" ||
    review.relationToComparison.status !== "not_assessed" ||
    review.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    review.claimBoundary !== POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY
  ) throw new Error("Lifecycle-stage revision review is invalid or changed.");
  requireBoundedIdentifier(review.id, "Lifecycle-stage revision review id");
  requireBoundedIdentifier(
    review.proposalReference.proposalId,
    "Lifecycle-stage revision proposal id",
  );
  requireFingerprint(
    review.proposalReference.proposalFingerprint,
    "Lifecycle-stage revision proposal fingerprint",
  );
  requireFingerprint(
    review.reviewFingerprint,
    "Lifecycle-stage revision review fingerprint",
  );
  requireCanonicalInstant(review.reviewedAt, "Lifecycle-stage revision review time");
  requireText(review.rationale, "Lifecycle-stage revision review rationale");
  if (proposal && (
    review.proposalReference.proposalId !== proposal.id ||
    review.proposalReference.proposalFingerprint !==
      proposal.proposalFingerprint ||
    review.proposalReference.targetPolicyEventCardReviewId !==
      proposal.targetEventCardReviewReference.reviewId ||
    review.reviewedAt < proposal.proposedAt
  )) throw new Error("Lifecycle-stage revision review lineage is invalid.");
  return review;
}

function contributionStage(
  proposal: PolicyLifecycleStageRevisionProposal,
  review: PolicyLifecycleStageRevisionReview,
) {
  const lineages: PolicyChronologyClock["lineages"] = [
    {
      evidenceKind: "source_metadata",
      direction: "metadata",
      claimId: null,
      passageId: null,
      documentVersionId: proposal.sourceReference.documentVersionId,
      sourceId: proposal.sourceReference.sourceId,
    },
    ...proposal.stage.focalPolicyPassageLineages.map((lineage) => ({
      evidenceKind: "claim_passage" as const,
      direction: "supporting" as const,
      claimId: proposal.stage.statementId,
      passageId: lineage.passageId,
      documentVersionId: lineage.documentVersionId,
      sourceId: lineage.sourceId,
    })),
  ];
  return {
    id: proposal.stage.clockId,
    stage: proposal.stage.chronologyStage,
    label: proposal.stage.label,
    timing: structuredClone(proposal.stage.timing),
    statements: [{
      claimId: proposal.stage.statementId,
      predicate: "policy_lifecycle_stage_revision",
      statement: proposal.stage.statement,
      scope: proposal.stage.scope,
      supportStatus: "indirect" as const,
      reviewStatus: "accepted" as const,
    }],
    lineages,
    qualifications: [
      ...structuredClone(proposal.stage.qualifications),
      `Researcher proposal rationale: ${proposal.rationale}`,
      `Researcher acceptance rationale: ${review.rationale}`,
    ],
    conflictIds: [],
    hasUnresolvedConflict: false,
  } satisfies PolicyChronologyClock;
}

function buildContribution(input: {
  proposal: PolicyLifecycleStageRevisionProposal;
  review: PolicyLifecycleStageRevisionReview;
  includedAt: string;
}) {
  const body: ContributionBody = {
    schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_EVENT_CARD_VERSION,
    proposalReference: {
      proposalId: input.proposal.id,
      proposalFingerprint: input.proposal.proposalFingerprint,
    },
    reviewReference: {
      reviewId: input.review.id,
      reviewFingerprint: input.review.reviewFingerprint,
      decision: "accepted_for_event_card_revision",
    },
    targetPolicyEventCardReviewId:
      input.proposal.targetEventCardReviewReference.reviewId,
    sourceReference: structuredClone(input.proposal.sourceReference),
    handoffStageKind: input.proposal.stage.handoffStageKind,
    sourceDateId: input.proposal.stage.sourceDateId,
    sourceTypedDate: structuredClone(input.proposal.stage.sourceTypedDate),
    focalPolicyPassageLineages: structuredClone(
      input.proposal.stage.focalPolicyPassageLineages,
    ),
    proposalRationale: input.proposal.rationale,
    reviewRationale: input.review.rationale,
    clock: contributionStage(input.proposal, input.review),
    inclusionStatus: "included_by_explicit_event_card_lock",
    includedAt: input.includedAt,
    sourceDocumentPreserved: true,
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY,
  };
  return {
    ...body,
    contributionFingerprint: fingerprintSixScreenValue(body),
  };
}

export function createPolicyLifecycleStageEventCardContribution(input: {
  proposal: PolicyLifecycleStageRevisionProposal;
  review: PolicyLifecycleStageRevisionReview;
  includedAt: string;
}) {
  validatePolicyLifecycleStageRevisionProposal(input.proposal);
  validatePolicyLifecycleStageRevisionReview(input.review, input.proposal);
  requireCanonicalInstant(input.includedAt, "Lifecycle-stage Event Card inclusion time");
  if (
    input.review.decision !== "accepted_for_event_card_revision" ||
    input.includedAt < input.review.reviewedAt
  ) throw new Error("Only an accepted lifecycle-stage revision may enter an Event Card lock.");
  const contribution = buildContribution(input);
  return validatePolicyLifecycleStageEventCardContribution(contribution, {
    proposal: input.proposal,
    review: input.review,
  });
}

export function validatePolicyLifecycleStageEventCardContribution(
  contribution: PolicyLifecycleStageEventCardContribution,
  references?: {
    proposal: PolicyLifecycleStageRevisionProposal;
    review: PolicyLifecycleStageRevisionReview;
  },
) {
  if (
    contribution.schemaVersion !==
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_EVENT_CARD_VERSION ||
    contribution.contributionFingerprint !==
      fingerprintSixScreenValue(contributionBody(contribution)) ||
    contribution.reviewReference.decision !==
      "accepted_for_event_card_revision" ||
    contribution.inclusionStatus !==
      "included_by_explicit_event_card_lock" ||
    contribution.sourceDocumentPreserved !== true ||
    contribution.independentEventClassification !== "not_assessed" ||
    contribution.relationToComparison.status !== "not_assessed" ||
    contribution.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    contribution.claimBoundary !== POLICY_LIFECYCLE_STAGE_REVISION_BOUNDARY ||
    contribution.clock.statements.length !== 1 ||
    contribution.clock.statements[0]?.supportStatus !== "indirect" ||
    contribution.clock.statements[0]?.reviewStatus !== "accepted" ||
    contribution.clock.hasUnresolvedConflict !== false ||
    contribution.clock.conflictIds.length !== 0
  ) throw new Error("Lifecycle-stage Event Card contribution is invalid or changed.");
  requireFingerprint(
    contribution.contributionFingerprint,
    "Lifecycle-stage Event Card contribution fingerprint",
  );
  requireBoundedIdentifier(
    contribution.proposalReference.proposalId,
    "Lifecycle-stage Event Card proposal id",
  );
  requireFingerprint(
    contribution.proposalReference.proposalFingerprint,
    "Lifecycle-stage Event Card proposal fingerprint",
  );
  requireBoundedIdentifier(
    contribution.reviewReference.reviewId,
    "Lifecycle-stage Event Card proposal-review id",
  );
  requireFingerprint(
    contribution.reviewReference.reviewFingerprint,
    "Lifecycle-stage Event Card proposal-review fingerprint",
  );
  requireBoundedIdentifier(
    contribution.targetPolicyEventCardReviewId,
    "Lifecycle-stage target Event Card review id",
  );
  requireCanonicalInstant(
    contribution.includedAt,
    "Lifecycle-stage Event Card inclusion time",
  );
  requireBoundedIdentifier(
    contribution.sourceReference.sourceId,
    "Lifecycle-stage Event Card source id",
  );
  requireBoundedIdentifier(
    contribution.sourceReference.documentVersionId,
    "Lifecycle-stage Event Card document version id",
  );
  requireSanitizedSourceUrl(contribution.sourceReference.canonicalUrl);
  if (
    !/^\d{4}-\d{4,6}$/u.test(
      contribution.sourceReference.nativeDocumentNumber,
    ) ||
    !/^sha256:[0-9a-f]{64}$/u.test(contribution.sourceReference.contentHash) ||
    !POLICY_LIFECYCLE_STAGE_CHRONOLOGY_STAGES.includes(
      contribution.clock.stage,
    ) ||
    contribution.clock.timing.mode === "relative" ||
    contribution.focalPolicyPassageLineages.length < 1 ||
    contribution.focalPolicyPassageLineages.length > 6
  ) throw new Error("Lifecycle-stage Event Card source or clock is invalid.");
  requireText(
    contribution.proposalRationale,
    "Lifecycle-stage Event Card proposal rationale",
  );
  requireText(
    contribution.reviewRationale,
    "Lifecycle-stage Event Card review rationale",
  );
  requireBoundedIdentifier(
    contribution.clock.id,
    "Lifecycle-stage Event Card clock id",
  );
  requireText(
    contribution.clock.label,
    "Lifecycle-stage Event Card clock label",
    1_500,
  );
  const statement = contribution.clock.statements[0]!;
  requireBoundedIdentifier(
    statement.claimId,
    "Lifecycle-stage Event Card statement id",
  );
  requireText(
    statement.statement,
    "Lifecycle-stage Event Card statement",
    3_000,
  );
  requireText(statement.scope, "Lifecycle-stage Event Card scope", 1_000);
  const expectedLineages: PolicyChronologyClock["lineages"] = [
    {
      evidenceKind: "source_metadata",
      direction: "metadata",
      claimId: null,
      passageId: null,
      documentVersionId: contribution.sourceReference.documentVersionId,
      sourceId: contribution.sourceReference.sourceId,
    },
    ...contribution.focalPolicyPassageLineages.map((lineage) => ({
      evidenceKind: "claim_passage" as const,
      direction: "supporting" as const,
      claimId: statement.claimId,
      passageId: lineage.passageId,
      documentVersionId: lineage.documentVersionId,
      sourceId: lineage.sourceId,
    })),
  ];
  if (
    !sameSixScreenValue(contribution.clock.lineages, expectedLineages) ||
    new Set(contribution.focalPolicyPassageLineages.map(({ passageId }) =>
      passageId)).size !== contribution.focalPolicyPassageLineages.length ||
    contribution.focalPolicyPassageLineages.some((lineage) =>
      lineage.sourceId !== contribution.sourceReference.sourceId ||
      lineage.documentVersionId !==
        contribution.sourceReference.documentVersionId) ||
    (contribution.sourceDateId === null
      ? contribution.sourceTypedDate !== null ||
        contribution.clock.timing.mode !== "undated"
      : !contribution.sourceTypedDate ||
        contribution.clock.timing.mode !== "absolute" ||
        contribution.sourceTypedDate.start !==
          contribution.clock.timing.start ||
        contribution.sourceTypedDate.end !== contribution.clock.timing.end)
  ) throw new Error("Lifecycle-stage Event Card lineage or source date is invalid.");
  if (references) {
    const expected = buildContribution({
      proposal: references.proposal,
      review: references.review,
      includedAt: contribution.includedAt,
    });
    if (!sameSixScreenValue(contribution, expected)) {
      throw new Error("Lifecycle-stage Event Card contribution lineage is invalid.");
    }
  }
  return contribution;
}

function compareClocks(
  left: PolicyChronologyClock,
  right: PolicyChronologyClock,
) {
  if (left.timing.mode === "absolute" && right.timing.mode === "absolute") {
    return compareText(left.timing.start, right.timing.start) ||
      (STAGE_ORDER.get(left.stage)! - STAGE_ORDER.get(right.stage)!) ||
      compareText(left.id, right.id);
  }
  if (left.timing.mode === "relative" && right.timing.mode === "relative") {
    return (STAGE_ORDER.get(left.stage)! - STAGE_ORDER.get(right.stage)!) ||
      left.timing.offsetDays - right.timing.offsetDays ||
      compareText(left.id, right.id);
  }
  return (STAGE_ORDER.get(left.stage)! - STAGE_ORDER.get(right.stage)!) ||
    compareText(left.id, right.id);
}

export function mergePolicyLifecycleStageContributionsIntoChronology(
  chronology: PolicyReviewedEventCard["chronology"],
  contributions: readonly PolicyLifecycleStageEventCardContribution[],
) {
  const existingIds = new Set([
    ...chronology.absoluteClocks,
    ...chronology.relativeClocks,
    ...chronology.undatedClocks,
  ].map(({ id }) => id));
  for (const contribution of contributions) {
    validatePolicyLifecycleStageEventCardContribution(contribution);
    if (existingIds.has(contribution.clock.id)) {
      throw new Error("Lifecycle-stage clock collides with an existing Event Card chronology clock.");
    }
    existingIds.add(contribution.clock.id);
  }
  const added = contributions.map(({ clock }) => structuredClone(clock));
  return {
    absoluteClocks: [
      ...structuredClone(chronology.absoluteClocks),
      ...added.filter(({ timing }) => timing.mode === "absolute"),
    ].sort(compareClocks),
    relativeClocks: [
      ...structuredClone(chronology.relativeClocks),
      ...added.filter(({ timing }) => timing.mode === "relative"),
    ].sort(compareClocks),
    undatedClocks: [
      ...structuredClone(chronology.undatedClocks),
      ...added.filter(({ timing }) => timing.mode === "undated"),
    ].sort(compareClocks),
  };
}

function latestByProposal(
  reviews: readonly PolicyLifecycleStageRevisionReview[],
) {
  const map = new Map<string, PolicyLifecycleStageRevisionReview>();
  for (const review of reviews) {
    map.set(review.proposalReference.proposalId, review);
  }
  return map;
}

export function policyLifecycleStageContributionsForEventCardLock(input: {
  targetReview: PolicyEventCardReviewState;
  handoffs: readonly CoEventPolicyLifecycleHandoff[];
  dispositions: readonly PolicyLifecycleStageDisposition[];
  proposals: readonly PolicyLifecycleStageRevisionProposal[];
  reviews: readonly PolicyLifecycleStageRevisionReview[];
  lockedAt: string;
}) {
  const handoffs = input.handoffs.filter(({ destination }) =>
    destination.policyEventCardReviewId === input.targetReview.id);
  const latestReviews = latestByProposal(input.reviews);
  const contributions: PolicyLifecycleStageEventCardContribution[] = [];
  for (const handoff of handoffs) {
    const latestDisposition = input.dispositions.filter(({ handoffReference }) =>
      handoffReference.handoffId === handoff.id).at(-1);
    if (!latestDisposition) {
      throw new Error("Dispose the routed lifecycle-stage document before locking its Event Card revision.");
    }
    if (latestDisposition.decision !== "accepted_for_event_card_review") {
      continue;
    }
    const proposal = input.proposals.find(({ handoffReference }) =>
      handoffReference.handoffId === handoff.id);
    if (!proposal) {
      throw new Error("Create the source-grounded lifecycle-stage proposal before locking this Event Card revision.");
    }
    const review = latestReviews.get(proposal.id);
    if (!review) {
      throw new Error("Review the source-grounded lifecycle-stage proposal before locking this Event Card revision.");
    }
    if (review.decision === "accepted_for_event_card_revision") {
      contributions.push(createPolicyLifecycleStageEventCardContribution({
        proposal,
        review,
        includedAt: input.lockedAt,
      }));
    }
  }
  return contributions.sort((left, right) =>
    compareText(
      left.proposalReference.proposalId,
      right.proposalReference.proposalId,
    )
  );
}

export function validatePolicyLifecycleStageRevisionCollections(input: {
  handoffs: readonly CoEventPolicyLifecycleHandoff[];
  acquisitions: readonly PolicyLifecycleStageDocumentAcquisition[];
  dispositions: readonly PolicyLifecycleStageDisposition[];
  proposals: readonly PolicyLifecycleStageRevisionProposal[];
  reviews: readonly PolicyLifecycleStageRevisionReview[];
  eventCardReviews: readonly PolicyEventCardReviewState[];
}) {
  if (
    input.proposals.length >
      SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_REVISION_PROPOSALS ||
    input.reviews.length >
      SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_REVISION_REVIEWS ||
    bytes({ proposals: input.proposals, reviews: input.reviews }) >
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVISION_MAX_BYTES ||
    new Set(input.proposals.map(({ id }) => id)).size !==
      input.proposals.length ||
    new Set(input.reviews.map(({ id }) => id)).size !== input.reviews.length ||
    new Set(input.proposals.map(({ handoffReference }) =>
      handoffReference.handoffId)).size !== input.proposals.length
  ) throw new Error("Stored lifecycle-stage revision review exceeds bounded capacity.");
  const handoffMap = new Map(input.handoffs.map((value) => [value.id, value]));
  const acquisitionMap = new Map(
    input.acquisitions.map((value) => [value.id, value]),
  );
  const dispositionMap = new Map(
    input.dispositions.map((value) => [value.id, value]),
  );
  const eventCardReviewMap = new Map(
    input.eventCardReviews.map((value) => [value.id, value]),
  );
  const proposalMap = new Map<string, PolicyLifecycleStageRevisionProposal>();
  let previousProposalAt: string | null = null;
  input.proposals.forEach((proposal, index) => {
    const handoff = handoffMap.get(proposal.handoffReference.handoffId);
    const acquisition = acquisitionMap.get(
      proposal.acquisitionReference.acquisitionId,
    );
    const disposition = dispositionMap.get(
      proposal.dispositionReference.dispositionId,
    );
    const targetReview = eventCardReviewMap.get(
      proposal.targetEventCardReviewReference.reviewId,
    );
    const latestDispositionAtProposal = input.dispositions.filter((value) =>
      value.handoffReference.handoffId ===
        proposal.handoffReference.handoffId &&
      value.reviewedAt <= proposal.proposedAt).at(-1);
    if (
      !handoff || !acquisition || !disposition || !targetReview ||
      latestDispositionAtProposal?.id !== disposition.id ||
      input.dispositions.some((value) =>
        value.handoffReference.handoffId ===
          proposal.handoffReference.handoffId &&
        value.ordinal > disposition.ordinal) ||
      proposal.ordinal !== index + 1 ||
      (previousProposalAt !== null &&
        proposal.proposedAt < previousProposalAt)
    ) throw new Error("Stored lifecycle-stage proposal references are invalid.");
    validatePolicyLifecycleStageRevisionProposal(proposal, {
      handoff,
      acquisition,
      disposition,
      targetReview,
    });
    proposalMap.set(proposal.id, proposal);
    previousProposalAt = proposal.proposedAt;
  });
  const reviewsByProposal = new Map<string, PolicyLifecycleStageRevisionReview[]>();
  let previousReviewAt: string | null = null;
  input.reviews.forEach((review, index) => {
    const proposal = proposalMap.get(review.proposalReference.proposalId);
    if (
      !proposal || review.ordinal !== index + 1 ||
      (previousReviewAt !== null && review.reviewedAt < previousReviewAt)
    ) throw new Error("Stored lifecycle-stage revision-review references are invalid.");
    validatePolicyLifecycleStageRevisionReview(review, proposal);
    const prior = reviewsByProposal.get(proposal.id) ?? [];
    if (
      prior.length >=
        SIX_SCREEN_POLICY_LIFECYCLE_MAX_REVISION_REVIEWS_PER_PROPOSAL ||
      (prior.length && prior.at(-1)?.decision !== "deferred")
    ) throw new Error("Stored lifecycle-stage revision-review sequence is invalid.");
    prior.push(review);
    reviewsByProposal.set(proposal.id, prior);
    previousReviewAt = review.reviewedAt;
  });
  for (const eventCardReview of input.eventCardReviews) {
    const eventCard = eventCardReview.lockedEventCard;
    if (!eventCard) continue;
    const contributions = eventCard.lifecycleStageRevisions ?? [];
    const contributionProposalIds = new Set<string>();
    for (const contribution of contributions) {
      const proposal = proposalMap.get(
        contribution.proposalReference.proposalId,
      );
      const review = proposal
        ? reviewsByProposal.get(proposal.id)?.at(-1)
        : null;
      if (
        !proposal || !review ||
        review.decision !== "accepted_for_event_card_revision" ||
        proposal.targetEventCardReviewReference.reviewId !==
          eventCardReview.id || contribution.includedAt !== eventCard.reviewedAt ||
        contributionProposalIds.has(proposal.id)
      ) throw new Error("Locked Event Card lifecycle-stage references are invalid.");
      validatePolicyLifecycleStageEventCardContribution(contribution, {
        proposal,
        review,
      });
      contributionProposalIds.add(proposal.id);
    }
    const expectedAccepted = input.proposals.filter((proposal) =>
      proposal.targetEventCardReviewReference.reviewId === eventCardReview.id &&
      reviewsByProposal.get(proposal.id)?.at(-1)?.decision ===
        "accepted_for_event_card_revision").map(({ id }) => id).sort(compareText);
    if (!sameSixScreenValue(
      [...contributionProposalIds].sort(compareText),
      expectedAccepted,
    )) throw new Error("Locked Event Card omitted an accepted lifecycle-stage revision.");
  }
  return input;
}
