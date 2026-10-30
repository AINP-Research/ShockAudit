import { fingerprintSixScreenValue } from "./canonical";
import type {
  PolicyReviewClaimProjection,
  SixScreenWorkflowState,
  TypedDate,
} from "./contracts";
import { createPolicyBriefing } from "./policy-review";

export const CURRENT_POLICY_EVIDENCE_VERSION =
  "current-policy-evidence-v1" as const;

export type CurrentPolicyClaim = {
  id: string;
  predicate: PolicyReviewClaimProjection["predicate"];
  statement: string;
  support: PolicyReviewClaimProjection["supportStatus"];
  qualification: string | null;
  typedDate: TypedDate | null;
  passageId: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceRole: string;
  documentVersionId: string;
  versionLabel: string | null;
};

export type CurrentPolicyMilestone = {
  id: string;
  label: string;
  stage: TypedDate["kind"];
  date: TypedDate;
  claimIds: string[];
  sourceIds: string[];
  documentVersionIds: string[];
  conflictIds: string[];
  qualification: string | null;
};

export type CurrentPolicyEvidence = {
  schemaVersion: typeof CURRENT_POLICY_EVIDENCE_VERSION;
  identityFingerprint: string | null;
  episode: string | null;
  status: "not_researched" | "review_not_current" |
    NonNullable<SixScreenWorkflowState["policyReview"]>["status"];
  chronologyOrigin: "current_briefing" | "reconstructed_current_claims" |
    "no_dated_milestone_in_current_claims" | "evidence_not_retrieved" |
    "review_not_current";
  evidenceSnapshotFingerprint: string | null;
  reviewFingerprint: string | null;
  chronology: CurrentPolicyMilestone[];
  claims: CurrentPolicyClaim[];
  coverageClaimIds: string[];
  exceptionClaimIds: string[];
  undatedClaimIds: string[];
  requirements: Array<{ kind: string; status: string; description: string }>;
  unresolved: string[];
};

const coveragePredicates = new Set<CurrentPolicyClaim["predicate"]>([
  "coverage_condition", "territorial_nexus", "threshold_condition",
  "exemption_rule",
]);

function claimDate(claim: PolicyReviewClaimProjection): TypedDate | null {
  if (!claim.typedValue || typeof claim.typedValue !== "object" ||
    Array.isArray(claim.typedValue)) return null;
  const value = claim.typedValue as Record<string, unknown>;
  if (value.date && typeof value.date === "object" &&
    !Array.isArray(value.date)) {
    const date = value.date as Partial<TypedDate>;
    if ((typeof date.start === "string" || date.start === null) &&
      (typeof date.end === "string" || date.end === null) &&
      typeof date.precision === "string" && typeof date.kind === "string" &&
      Array.isArray(date.passageIds)) return structuredClone(date as TypedDate);
  }
  // Older source-bound claims stored a simple date and stage. Preserve their
  // recorded precision without inventing a publication or legal-effect date.
  if (typeof value.date === "string") return {
    start: value.date, end: null,
    precision: /^\d{4}-\d{2}-\d{2}$/u.test(value.date) ? "day"
      : /^\d{4}-\d{2}$/u.test(value.date) ? "month"
      : /^\d{4}$/u.test(value.date) ? "year" : "unknown",
    kind: value.stage === "legal_effect" ? "legal_effect" : "other",
    passageIds: [claim.citation.passageId],
  };
  return null;
}

/** Only the confirmed, current Screen 2 episode supplies documentary facts.
 * Historical reviews remain in saved state but cannot leak into this view. */
export function readCurrentPolicyEvidence(
  state: SixScreenWorkflowState,
): CurrentPolicyEvidence {
  const identity = state.confirmedShock;
  const matching = state.policyReview?.identityFingerprint ===
    identity?.identityFingerprint ? state.policyReview : null;
  const review = matching && (matching.artifactStatus === "current" ||
    matching.artifactStatus === undefined) ? matching : null;
  const emptyStatus = matching ? "review_not_current" as const
    : "not_researched" as const;
  const emptyOrigin = matching ? "review_not_current" as const
    : "evidence_not_retrieved" as const;
  if (!identity || !review) return {
    schemaVersion: CURRENT_POLICY_EVIDENCE_VERSION,
    identityFingerprint: identity?.identityFingerprint ?? null,
    episode: identity?.episode ?? null,
    status: emptyStatus, chronologyOrigin: emptyOrigin,
    evidenceSnapshotFingerprint: null, reviewFingerprint: null,
    chronology: [], claims: [], coverageClaimIds: [], exceptionClaimIds: [],
    undatedClaimIds: [], requirements: [], unresolved: [],
  };

  const claims: CurrentPolicyClaim[] = (review.claims ?? []).map((claim) => ({
    id: claim.claimId, predicate: claim.predicate,
    statement: claim.statement, support: claim.supportStatus,
    qualification: claim.qualification, typedDate: claimDate(claim),
    passageId: claim.citation.passageId,
    sourceId: claim.citation.sourceId,
    sourceTitle: claim.citation.sourceTitle,
    sourceUrl: claim.citation.canonicalUrl,
    sourceRole: claim.citation.sourceRole,
    documentVersionId: claim.citation.documentVersionId,
    versionLabel: claim.citation.versionLabel ?? null,
  }));
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  // A pre-briefing saved review can be reconstructed from its original cited
  // claims. No locked Event Card, researcher year, or other identity is needed.
  const canReconstruct = Array.isArray(review.requirements) &&
    Boolean(review.researchedAt) && (review.claims ?? []).every((claim) =>
      Boolean(claim.citation?.canonicalUrl));
  const briefing = review.briefing ?? (canReconstruct ? createPolicyBriefing({
    title: identity.officialTitle, claims: review.claims,
    requirements: review.requirements, generatedAt: review.researchedAt,
    studyPeriod: state.study.period,
    interpretation: review.interpretation,
  }) : null);
  const usedClaimIds = new Set<string>();
  const milestone = (input: {
    id: string; label: string; date: TypedDate; claimIds: string[];
    qualification: string | null;
  }): CurrentPolicyMilestone => {
    const linked = input.claimIds.flatMap((id) => {
      const claim = byId.get(id);
      return claim ? [claim] : [];
    });
    return { ...input, stage: input.date.kind,
      date: structuredClone(input.date),
      sourceIds: [...new Set(linked.map(({ sourceId }) => sourceId))],
      documentVersionIds: [...new Set(linked.map(({ documentVersionId }) =>
        documentVersionId))],
      conflictIds: linked.filter(({ support }) => support === "conflicting")
        .map(({ id }) => id),
    };
  };
  const chronology = [...(briefing?.timeline ?? []),
    ...(briefing?.laterTimeline ?? [])].map((item) => {
      const claimIds = (item.claimIds?.length ? item.claimIds : [item.claimId])
        .filter((id) => byId.has(id));
      claimIds.forEach((id) => usedClaimIds.add(id));
      return milestone({ id: item.claimId, label: item.label,
        date: item.date, claimIds, qualification: item.qualification });
    }).filter(({ claimIds }) => claimIds.length > 0);
  // The briefing limits the number of displayed milestones. Retain other
  // source-dated propositions in the full accessor for downstream selection.
  for (const claim of claims) {
    if (!claim.typedDate?.start || usedClaimIds.has(claim.id)) continue;
    chronology.push(milestone({ id: claim.id,
      label: claim.typedDate.kind.replaceAll("_", " "),
      date: claim.typedDate, claimIds: [claim.id],
      qualification: claim.qualification }));
  }
  chronology.sort((left, right) =>
    (left.date.start ?? "9999").localeCompare(right.date.start ?? "9999") ||
    left.stage.localeCompare(right.stage) || left.id.localeCompare(right.id));
  const coverageClaimIds = claims.filter((claim) =>
    coveragePredicates.has(claim.predicate)).map(({ id }) => id);
  const exceptionClaimIds = claims.filter((claim) =>
    claim.predicate === "exemption_rule").map(({ id }) => id);
  return {
    schemaVersion: CURRENT_POLICY_EVIDENCE_VERSION,
    identityFingerprint: identity.identityFingerprint,
    episode: identity.episode,
    status: review.status,
    chronologyOrigin: chronology.length
      ? review.briefing ? "current_briefing" : "reconstructed_current_claims"
      : "no_dated_milestone_in_current_claims",
    evidenceSnapshotFingerprint: review.evidenceSnapshotFingerprint,
    reviewFingerprint: fingerprintSixScreenValue({
      identityFingerprint: identity.identityFingerprint, episode: identity.episode,
      evidenceSnapshotFingerprint: review.evidenceSnapshotFingerprint,
      claims: review.claims ?? [], requirements: review.requirements ?? [],
      briefing: review.briefing ?? null, period: state.study.period,
    }),
    chronology, claims, coverageClaimIds, exceptionClaimIds,
    undatedClaimIds: [...new Set([
      ...(briefing?.undatedTimelineClaimIds ?? []),
      ...claims.filter((claim) => !claim.typedDate?.start && [
        "policy_date", "implementation_schedule", "historical_version_change",
        "contemporaneous_amendment_record",
      ].includes(claim.predicate)).map(({ id }) => id),
    ])],
    requirements: (review.requirements ?? []).map(({ kind, status, description }) => ({
      kind, status, description,
    })),
    unresolved: [...new Set([
      ...(review.unresolved ?? []), ...(briefing?.unresolvedQuestions ?? []),
      ...(review.limitation ? [review.limitation] : []),
    ])],
  };
}
