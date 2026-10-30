import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  type Screen02Item,
  type Screen02OutcomePathwayCategory,
  type Screen02OutcomePathwayDetail,
  type Screen02PreferenceCriterion,
  type Screen02PreferenceKind,
  type Screen02ScoreComponentKey,
  type Screen02SearchRequestType,
  type Screen02SearchRound,
  type Screen02SemanticDecision,
  type Screen02Session,
} from "../../core/screen02-types";
import { scoreScreen02NativeIndustryRelevance } from
  "../../core/screen02-native-industry-relevance";
import type { HostView } from "../mcp-bridge";
import {
  branchCopy,
  preferenceKindCopy,
  workflowSteps,
} from "./content";
import "./screen-02.css";

export type Screen02PreferenceDraft = {
  kind: Screen02PreferenceKind;
  text: string;
};

export type Screen02Notice = {
  status: "info" | "pending" | "success" | "warning" | "error";
  message: string;
};

type InteractiveSearchRequest = Extract<
  Screen02SearchRequestType,
  "find-more" | "refine" | "none-fit"
>;

export type Screen02Props = {
  session: Screen02Session;
  hostView: HostView;
  researchNotice?: Screen02Notice | null;
  onSelect: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onLock: () => void;
  onUnlock: (reason: string) => void;
  onRequestSearch: (
    requestType: InteractiveSearchRequest,
    exactRequest: string,
    criteria: Screen02PreferenceDraft[],
  ) => void;
  onRequestAiReview?: (itemIds?: string[]) => void;
  onExpandCoverage?: () => void;
  onBack: () => void;
  onReset: () => void;
  onRequestFullscreen: () => void | Promise<unknown>;
  /**
   * Production leaves this empty. The optional value makes the local,
   * ephemeral review state renderable in focused server-side UI tests.
   */
  initialReviewedItemId?: string | null;
};

const preliminaryAiInference = "Preliminary AI inference" as const;
const coverageExpansionNote =
  "Coverage expansion asks ChatGPT to target uncovered state, local, tribal, foreign, or supranational sources. Any new lead remains provisional until verified; this is not a claim of comprehensive coverage.";

type AssessmentBasis =
  | "Recorded metadata"
  | typeof preliminaryAiInference
  | "Verification needed";

type AssessmentPoint = {
  id: string;
  title: string;
  judgment: string;
  basis: AssessmentBasis;
  explanation: string;
  evidenceTitles: string[];
};

type PrimaryJudgment = {
  title: string;
  judgment: string;
  basis: AssessmentBasis;
  explanation: string;
};

type EvidenceAtAGlance = {
  sourceCount: number;
  sourceTypes: string[];
  issuingAuthorities: string[];
  publicationDates: string[];
  timingLeads: string[];
  studyPopulation: string;
  sourceEstablishedPopulation: string;
  sourceEstablishedPopulationEvidenceTitles: string[];
  candidateApplicability: string;
  candidateApplicabilityBasis: AssessmentBasis;
};

type PopulationApplicabilityCategory =
  | "documented-direct"
  | "documented-conditional"
  | "plausible-indirect"
  | "unlikely"
  | "unknown";

type SourceEstablishedPopulation = {
  text: string;
  evidenceSourceIds: string[];
};

type PopulationApplicabilityDetail = {
  category: PopulationApplicabilityCategory;
  sourceEstablishedPopulation: SourceEstablishedPopulation | null;
  reason: string;
  evidenceSourceIds: string[];
  unresolved: string[];
  confidence?: "low" | "medium" | "high";
};

type CandidateTriageContext = {
  industry?: string;
  studyPopulation?: string;
  semanticDecision?: Screen02SemanticDecision | null;
};

export type CandidateTriageView = {
  aiEnriched: boolean;
  fit: PrimaryJudgment;
  outcome: PrimaryJudgment;
  feasibility: PrimaryJudgment;
  evidence: EvidenceAtAGlance;
  verificationTasks: string[];
  technicalPoints: AssessmentPoint[];
};

type CompactPreliminaryAssessment = {
  judgment: string;
  studyFit: string;
  affectedPopulation: string | null;
  outcomeMechanism: string | null;
  mainConcern: string;
  nextChecks: string[];
  evidenceSourceIds: string[];
};

export type CandidatePreliminaryBrief = {
  judgment: string;
  studyFit: string;
  affectedPopulation: string;
  outcomeMechanism: string;
  mainConcern: string;
  nextChecks: string[];
  evidenceSourceIds: string[];
  evidenceTitles: string[];
  source: "compact" | "legacy";
};

const preferenceKinds = ["require", "prefer", "avoid"] as const;

const emptyPreferenceInputs: Record<Screen02PreferenceKind, string> = {
  require: "",
  prefer: "",
  avoid: "",
};

function humanize(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemDate(item: Screen02Item) {
  if (item.provisionalDates.length > 0) {
    return item.provisionalDates[0] ?? "Date not yet established";
  }
  if (item.mode === "find" && item.event.eventDate) {
    return item.event.eventDate;
  }
  return "Date not yet established";
}

function itemGeography(item: Screen02Item) {
  return item.mode === "find"
    ? item.event.geographies.join(" · ") || "Geography not yet established"
    : "Issuing geography not yet established";
}

function itemType(item: Screen02Item) {
  return item.mode === "find"
    ? item.event.eventFamily
    : "Event identity match";
}

type Screen02Source = Screen02Item["sources"][number];

function sourceAuthorityView(source: Screen02Source) {
  const method = source.authorityAssessment?.method;
  const independentlySupported =
    method === "connector-native" ||
    method === "system-domain-rule" ||
    method === "researcher-confirmed";

  if (source.isFictionalDemo) {
    return {
      label: "Demonstration source",
      official: false,
      documented: false,
    };
  }
  if (independentlySupported && source.authorityTier <= 2) {
    return {
      label: "Official source",
      official: true,
      documented: true,
    };
  }
  if (independentlySupported && source.authorityTier <= 4) {
    return {
      label: "Supporting source",
      official: false,
      documented: true,
    };
  }
  if (method === "ai-rubric") {
    return {
      label: "Source authority needs verification",
      official: false,
      documented: false,
    };
  }
  return {
    label: "Authority not established",
    official: false,
    documented: false,
  };
}

function strongestSourceDescription(item: Screen02Item) {
  if (item.sources.length === 0) return "No source located";
  const authorityViews = item.sources.map(sourceAuthorityView);
  if (authorityViews.some((view) => view.official)) {
    return "Official documentation located";
  }
  if (authorityViews.some((view) => view.documented)) {
    return "Supporting documentation located";
  }
  if (item.sources.some((source) => source.authorityAssessment?.method === "ai-rubric")) {
    return "Source authority needs verification";
  }
  return "Source located · authority not established";
}

function populationApplicabilityForItem(
  item: Screen02Item,
): PopulationApplicabilityDetail | null {
  const value = (
    item as Screen02Item & {
      populationApplicability?: Partial<PopulationApplicabilityDetail>;
    }
  ).populationApplicability;
  if (
    !value ||
    ![
      "documented-direct",
      "documented-conditional",
      "plausible-indirect",
      "unlikely",
      "unknown",
    ].includes(String(value.category)) ||
    typeof value.reason !== "string"
  ) {
    return null;
  }
  const rawSourcePopulation = value.sourceEstablishedPopulation;
  const sourceEstablishedPopulation =
    rawSourcePopulation &&
    typeof rawSourcePopulation === "object" &&
    typeof rawSourcePopulation.text === "string" &&
    Array.isArray(rawSourcePopulation.evidenceSourceIds)
      ? {
          text: rawSourcePopulation.text,
          evidenceSourceIds: rawSourcePopulation.evidenceSourceIds.filter(
            (id): id is string => typeof id === "string",
          ),
        }
      : null;
  return {
    category: value.category as PopulationApplicabilityCategory,
    sourceEstablishedPopulation,
    reason: value.reason,
    evidenceSourceIds: Array.isArray(value.evidenceSourceIds)
      ? value.evidenceSourceIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    unresolved: Array.isArray(value.unresolved)
      ? value.unresolved.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    confidence:
      value.confidence === "low" ||
      value.confidence === "medium" ||
      value.confidence === "high"
        ? value.confidence
        : undefined,
  };
}

const populationApplicabilityLabels: Record<
  PopulationApplicabilityCategory,
  string
> = {
  "documented-direct": "Direct coverage documented",
  "documented-conditional": "Conditional coverage documented",
  "plausible-indirect": "Indirect exposure is plausible",
  unlikely: "Coverage appears unlikely",
  unknown: "Coverage not yet established",
};

const outcomePathwayLabels: Record<
  Screen02OutcomePathwayCategory,
  string
> = {
  "source-anchored-specific": "Source-anchored pathway",
  "conditional-or-indirect": "Conditional or indirect pathway",
  unclear: "Pathway remains unclear",
  unlikely: "Pathway appears unlikely",
};

function outcomePathwayForItem(
  item: Screen02Item,
): Screen02OutcomePathwayDetail | null {
  return item.outcomePathway?.method === "ai-rubric"
    ? item.outcomePathway
    : null;
}

function assessmentExplanation(
  reason: string,
  confidence: "low" | "medium" | "high" | undefined,
  unresolved: readonly string[],
) {
  return [
    reason,
    confidence ? `Preliminary confidence: ${humanize(confidence)}.` : "",
    unresolved.length > 0
      ? `Unresolved: ${unresolved.join(" · ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function candidateCoverageView(
  item: Screen02Item,
  allowCurrentAi: boolean,
) {
  const applicability = allowCurrentAi
    ? populationApplicabilityForItem(item)
    : null;
  if (applicability) {
    return {
      label: populationApplicabilityLabels[applicability.category],
      explanation: applicability.reason,
      sourceEstablishedPopulation:
        applicability.sourceEstablishedPopulation?.text.trim() ||
        "Not established by the current cited sources.",
      evidenceTitles: evidenceTitlesForIds(
        item,
        applicability.sourceEstablishedPopulation?.evidenceSourceIds ?? [],
      ),
      basis: preliminaryAiInference,
      unresolved: applicability.unresolved,
    };
  }
  return {
    label: "Not established from the current record",
    explanation:
      "The native connector used the Screen 1 population as a provisional linkage target. It did not establish which organizations this candidate formally or practically covers.",
    sourceEstablishedPopulation:
      "Not established by the current cited sources.",
    evidenceTitles: [] as string[],
    basis: "Verification needed" as const,
    unresolved: [] as string[],
  };
}

function currentRound(session: Screen02Session) {
  return session.interaction.searchRounds.at(-1) ?? null;
}

function currentPreliminaryAssessmentResult(
  session: Screen02Session,
  itemId: string,
) {
  for (
    let index = session.interaction.searchRounds.length - 1;
    index >= 0;
    index -= 1
  ) {
    const result = session.interaction.searchRounds[index]?.assessmentResults?.find(
      (candidate) => candidate.itemId === itemId,
    );
    if (result) return result;
  }
  return null;
}

function preliminaryAssessmentNeedsRetry(
  session: Screen02Session,
  item: Screen02Item,
) {
  return (
    compactPreliminaryAssessmentForItem(item) === null &&
    currentPreliminaryAssessmentResult(session, item.id)?.status ===
      "needs-retry"
  );
}

export function screen02WhyUsefulReasons(
  session: Screen02Session,
  item: Screen02Item,
  semanticReviewStatus = screen02SemanticReviewStatus(session),
) {
  if (semanticReviewStatus !== "reviewed") return [];
  const reviewRound = currentRound(session);
  if (reviewRound?.stage !== "ai-review" || !reviewRound.parentRoundId) {
    return [];
  }
  const parentRound = session.interaction.searchRounds.find(
    (round) => round.id === reviewRound.parentRoundId,
  );
  if (!parentRound) return [];
  const parentVersionIds = new Set(parentRound.activeItemVersionIds);
  const parentVersion = session.interaction.itemVersions.find(
    (version) =>
      parentVersionIds.has(version.versionId) &&
      version.itemId === item.id,
  );
  if (!parentVersion) {
    // Compatibility records from the early redesign may lack a versioned
    // parent snapshot. Their reviewed reasons already crossed the assessment
    // validation boundary.
    return [...item.reasons];
  }
  const normalizeReason = (reason: string) =>
    reason.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  const nativeReasons = new Set(
    parentVersion.item.reasons.map(normalizeReason),
  );
  return item.reasons.filter(
    (reason) => !nativeReasons.has(normalizeReason(reason)),
  );
}

function currentAuditEvidenceRound(session: Screen02Session) {
  if (session.mode !== "audit") return null;
  const round = currentRound(session);
  if (!round) return null;
  if (round.shockEvidence) return round;
  if (round.stage !== "ai-review" || !round.parentRoundId) return null;
  const parent = session.interaction.searchRounds.find(
    (candidate) => candidate.id === round.parentRoundId,
  );
  return parent?.shockEvidence ? parent : null;
}

function currentAuditShockEvidence(session: Screen02Session) {
  return currentAuditEvidenceRound(session)?.shockEvidence ?? null;
}

function hasExpandableCoverageRound(session: Screen02Session) {
  const round = currentRound(session);
  const nativeRound =
    round?.stage === "native-retrieval"
      ? round
      : round?.stage === "ai-review" && round.parentRoundId
        ? session.interaction.searchRounds.find(
            (candidate) =>
              candidate.id === round.parentRoundId &&
              candidate.stage === "native-retrieval",
          ) ?? null
        : null;
  return Boolean(
    nativeRound && nativeRound.requestType !== "initial",
  );
}

function auditWorkingItem(
  session: Screen02Session,
  visibleItems: Screen02Item[],
  reviewedItemId: string | null,
) {
  const reviewed = visibleItems.find(
    (item) => item.id === reviewedItemId,
  );
  if (reviewed) return reviewed;
  const selected = visibleItems.find(
    (item) => item.id === session.selectedItemId,
  );
  if (selected) return selected;
  return (
    visibleItems.find(
      (item) =>
        item.mode === "audit" &&
        item.representationType === "whole-package",
    ) ??
    visibleItems[0] ??
    null
  );
}

function isInitialFindRound(
  session: Screen02Session,
  round: Screen02SearchRound | null,
) {
  return session.mode === "find" && round?.requestType === "initial";
}

/**
 * The cumulative item ledger remains available for reproducibility, but the
 * researcher-facing list shows only the current round. Initial Find registry
 * records are intentionally hidden until the researcher runs a search.
 */
export function currentVisibleScreen02Items(session: Screen02Session) {
  const round = currentRound(session);
  if (!round || isInitialFindRound(session, round)) return [];

  const rejected = new Set(
    session.interaction.rejections.map((entry) => entry.itemId),
  );
  const byId = new Map(session.items.map((item) => [item.id, item]));
  return round.itemIdsRetained
    .map((id) => byId.get(id))
    .filter(
      (item): item is Screen02Item =>
        item !== undefined && !rejected.has(item.id),
    );
}

function currentCriteria(session: Screen02Session) {
  const round = currentRound(session);
  if (!round || round.requestType === "initial") return [];
  return criteriaForRound(session, round);
}

function currentSemanticDecision(
  session: Screen02Session,
  itemId: string,
) {
  const round = currentRound(session);
  if (round?.stage !== "ai-review") return null;
  return (
    round.semanticDecisions?.find(
      (decision) =>
        decision.itemId === itemId && decision.decision === "retained",
    ) ?? null
  );
}

function criteriaForRound(
  session: Screen02Session,
  round: Screen02SearchRound,
) {
  const ids = new Set(round.preferenceCriteriaIds);
  return session.interaction.preferences.criteria.filter((criterion) =>
    ids.has(criterion.id),
  );
}

export type Screen02SemanticReviewStatus =
  | "not-requested"
  | "awaiting-review"
  | "review-incomplete"
  | "review-unavailable"
  | "reviewed";

function roundCompletesSemanticReview(
  session: Screen02Session,
  round: Screen02SearchRound,
) {
  if (round.stage === "preliminary-assessment") {
    const results = round.assessmentResults ?? [];
    const resultById = new Map(
      results.map((result) => [result.itemId, result]),
    );
    const rejectedItemIds = new Set(
      session.interaction.rejections.map((entry) => entry.itemId),
    );
    const displayedItemIds = round.itemIdsRetained.filter(
      (itemId) => !rejectedItemIds.has(itemId),
    );
    return (
      Boolean(round.rootNativeRoundId) &&
      results.length === round.itemIdsRetained.length &&
      resultById.size === results.length &&
      displayedItemIds.length > 0 &&
      displayedItemIds.every((itemId) => {
        const item = session.items.find(
          (candidate) => candidate.id === itemId,
        );
        return (
          resultById.get(itemId)?.status === "assessed" &&
          item?.preliminaryAssessment?.rootNativeRoundId ===
            round.rootNativeRoundId
        );
      })
    );
  }
  const rounds = session.interaction.searchRounds;
  const roundIndex = rounds.findIndex(
    (candidate) => candidate.id === round.id,
  );
  const parent = roundIndex > 0 ? rounds[roundIndex - 1] : null;
  if (
    !parent ||
    round.parentRoundId !== parent.id ||
    round.stage !== "ai-review" ||
    parent.stage !== "native-retrieval" ||
    parent.parentRoundId !== undefined ||
    parent.requestType === "initial" ||
    !Array.isArray(round.semanticDecisions)
  ) {
    return false;
  }

  const expectedItemIds = new Set(parent.itemIdsRetained);
  const decisionsByItemId = new Map(
    round.semanticDecisions.map((decision) => [
      decision.itemId,
      decision,
    ]),
  );
  if (
    decisionsByItemId.size !== round.semanticDecisions.length ||
    decisionsByItemId.size !== expectedItemIds.size ||
    [...decisionsByItemId.keys()].some(
      (itemId) => !expectedItemIds.has(itemId),
    )
  ) {
    return false;
  }

  const strictParentCriterionIds = new Set(
    criteriaForRound(session, parent)
      .filter(
        (criterion) =>
          criterion.kind === "require" ||
          criterion.kind === "avoid",
      )
      .map((criterion) => criterion.id),
  );
  const parentCriterionIds = new Set(parent.preferenceCriteriaIds);
  const childProposalIds = new Set(round.proposalIdsReceived);
  const childResultIds = new Set(round.itemIdsRetained);
  const allowedScopeMismatchFields = new Set([
    "industry",
    "outcomeFamily",
  ]);
  const decisionsComplete = parent.itemIdsRetained.every((itemId) => {
    const decision = decisionsByItemId.get(itemId);
    const scopeMismatchFields = decision?.scopeMismatchFields ?? [];
    if (
      !decision ||
      decision.criterionIds.some(
        (criterionId) => !parentCriterionIds.has(criterionId),
      ) ||
      new Set(scopeMismatchFields).size !== scopeMismatchFields.length ||
      scopeMismatchFields.some(
        (field) => !allowedScopeMismatchFields.has(field),
      )
    ) {
      return false;
    }
    if (decision.decision === "retained") {
      return (
        scopeMismatchFields.length === 0 &&
        childProposalIds.has(itemId) &&
        childResultIds.has(itemId)
      );
    }
    return (
      !childProposalIds.has(itemId) &&
      !childResultIds.has(itemId) &&
      (decision.criterionIds.length > 0 ||
        scopeMismatchFields.length > 0) &&
      decision.criterionIds.every((criterionId) =>
        strictParentCriterionIds.has(criterionId),
      )
    );
  });
  if (!decisionsComplete) return false;

  const itemsById = new Map(session.items.map((item) => [item.id, item]));
  return round.itemIdsRetained.every((itemId) => {
    const item = itemsById.get(itemId);
    return item !== undefined && itemHasCompleteCurrentAiReview(item);
  });
}

function itemHasCompleteCurrentAiReview(item: Screen02Item) {
  if (item.preliminaryAssessment?.method === "ai-preliminary") {
    return true;
  }
  return (
    item.externalShockPlausibility?.method === "ai-rubric" &&
    item.populationApplicability?.method === "ai-rubric" &&
    item.outcomePathway?.method === "ai-rubric" &&
    item.outcomeLink.status === "ai-hypothesis" &&
    (
      ["exposureObservability", "timeSupport", "variation"] as const
    ).every(
      (component) =>
        item.scorecard.componentDetails[component].method === "ai-rubric",
    )
  );
}

export function screen02SemanticReviewStatus(
  session: Screen02Session,
  researchNotice: Screen02Notice | null = null,
): Screen02SemanticReviewStatus {
  const round = currentRound(session);
  if (!round || round.requestType === "initial") return "not-requested";
  if (roundCompletesSemanticReview(session, round)) return "reviewed";

  const noticeDescribesActiveReview =
    researchNotice?.status === "pending" &&
    /\b(?:AI|semantic|interpret|assessment|global review|source[- ]expansion)\b/i.test(
      researchNotice.message,
    );
  const noticeSaysReviewUnavailable =
    (researchNotice?.status === "warning" ||
      researchNotice?.status === "error") &&
    /\b(?:AI|semantic|interpret|host|unavailable)\b/i.test(
      researchNotice.message,
    );
  if (noticeSaysReviewUnavailable) return "review-unavailable";
  if (noticeDescribesActiveReview) return "awaiting-review";
  return "review-incomplete";
}

export function screen02HasCompletedAiReview(
  session: Screen02Session,
) {
  const round = currentRound(session);
  const rejectedItemIds = new Set(
    session.interaction.rejections.map((entry) => entry.itemId),
  );
  const displayedItemIds =
    round?.itemIdsRetained.filter(
      (itemId) => !rejectedItemIds.has(itemId),
    ) ?? [];
  return (
    round !== null &&
    roundCompletesSemanticReview(session, round) &&
    displayedItemIds.length > 0 &&
    displayedItemIds.every((itemId) => {
      const item = session.items.find(
        (candidate) => candidate.id === itemId,
      );
      return item !== undefined && itemHasCompleteCurrentAiReview(item);
    })
  );
}

export function screen02SemanticDecisionLock(
  semanticReviewStatus: Screen02SemanticReviewStatus,
) {
  return semanticReviewStatus === "awaiting-review";
}

export function screen02StrictCriteriaDecisionLock(
  session: Screen02Session,
  semanticReviewStatus: Screen02SemanticReviewStatus,
) {
  return (
    screen02SemanticDecisionLock(semanticReviewStatus) &&
    currentCriteria(session).some(
      (criterion) =>
        criterion.kind === "require" || criterion.kind === "avoid",
    )
  );
}

export function collectVisiblePreferenceDrafts(
  inputs: Record<Screen02PreferenceKind, string>,
) {
  const seen = new Set<string>();
  return preferenceKinds.flatMap((kind) => {
    const text = inputs[kind].trim();
    const key = `${kind}:${text.toLocaleLowerCase()}`;
    if (!text || seen.has(key)) return [];
    seen.add(key);
    return [{ kind, text }];
  });
}

export function buildScreen02InteractiveSearchRequest(
  mode: Screen02Session["mode"],
  requestedType: InteractiveSearchRequest,
  inputs: Record<Screen02PreferenceKind, string>,
  explanation = "",
) {
  const criteria = collectVisiblePreferenceDrafts(inputs);
  const trimmedExplanation = explanation.trim();
  const effectiveRequestType =
    requestedType === "find-more" && criteria.length > 0
      ? "refine"
      : requestedType;
  const target =
    mode === "find"
      ? "candidate shocks inside the locked Screen 1 scope"
      : "source-backed event matches for the exact known shock";
  const exactRequest =
    effectiveRequestType === "none-fit"
      ? `None of the current ${mode === "find" ? "candidate shocks" : "event matches"} fit. Search for a genuinely different current result set using only the criteria shown now.${
          trimmedExplanation
            ? ` Researcher explanation: ${trimmedExplanation}`
            : ""
        }`
      : `Search for ${target} using only the criteria currently shown in Screen 2. Blank fields are intentional and prior criteria must not be carried into this search.${
          trimmedExplanation
            ? ` Researcher explanation: ${trimmedExplanation}`
            : ""
        }`;

  return {
    requestType: effectiveRequestType,
    exactRequest,
    criteria,
    hadExplanation: Boolean(trimmedExplanation),
  };
}

function evidenceTitlesForIds(item: Screen02Item, sourceIds: string[]) {
  const sourceTitles = new Map(
    item.sources.map((source) => [source.id, source.title]),
  );
  return sourceIds.map(
    (id) =>
      sourceTitles.get(id) ??
      "Supporting record retained in the technical record",
  );
}

function assessmentEvidenceTitles(
  item: Screen02Item,
  sourceIds: string[],
  emptyState: string,
) {
  const titles = evidenceTitlesForIds(item, sourceIds);
  return titles.length > 0 ? titles : [emptyState];
}

function evidenceTitles(
  item: Screen02Item,
  component: Screen02ScoreComponentKey,
) {
  return evidenceTitlesForIds(
    item,
    item.scorecard.componentDetails[component].evidenceSourceIds,
  );
}

function componentPoint(
  item: Screen02Item,
  component: "exposureObservability" | "timeSupport" | "variation",
  title: string,
  labels: [string, string, string],
  allowCurrentAi: boolean,
): AssessmentPoint {
  const detail = item.scorecard.componentDetails[component];
  const value = item.scorecard.components[component];
  if (detail.method === "ai-rubric" && !allowCurrentAi) {
    return {
      id: component,
      title,
      judgment: "Needs verification",
      basis: "Verification needed",
      explanation:
        "The current search has not completed a fresh AI judgment for this dimension.",
      evidenceTitles: [],
    };
  }
  if (value === null || detail.category === "unknown") {
    const aiAssessed = detail.method === "ai-rubric";
    return {
      id: component,
      title,
      judgment: "Needs verification",
      basis: aiAssessed
        ? preliminaryAiInference
        : "Verification needed",
      explanation:
        detail.reason ||
        "The available record does not yet support a preliminary judgment.",
      evidenceTitles: aiAssessed
        ? evidenceTitles(item, component)
        : [],
    };
  }

  const judgment =
    value >= 75 ? labels[0] : value >= 45 ? labels[1] : labels[2];
  const basis: AssessmentBasis =
    detail.method === "ai-rubric"
        ? preliminaryAiInference
        : detail.method === "system-computed"
          ? "Recorded metadata"
          : "Verification needed";
  return {
    id: component,
    title,
    judgment,
    basis,
    explanation:
      detail.method === "researcher-specified"
        ? `${detail.reason} This researcher-specified judgment has not yet been independently assessed by ShockAudit.`
        : detail.reason,
    evidenceTitles: evidenceTitles(item, component),
  };
}

function uniqueNonempty(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase("en-US");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function verificationTasksForItem(
  item: Screen02Item,
  allowCurrentAi: boolean,
  outcomeFamily: string,
) {
  const candidateSpecificTasks: string[] = [];
  const dimensionTasks: string[] = [];
  const populationFilter = item.hardFilters.find(
    (filter) => filter.key === "population",
  );
  const sourceViews = item.sources.map(sourceAuthorityView);
  const hasDocumentedSource = sourceViews.some((view) => view.documented);
  const hasOperativeDateLead = item.provisionalDates.some((date) =>
    /\b(?:effective|implementation|implemented|operative|commencement)\b/i.test(
      date,
    ),
  );
  const exposure = item.scorecard.componentDetails.exposureObservability;
  const timing = item.scorecard.componentDetails.timeSupport;
  const variation = item.scorecard.componentDetails.variation;
  const externality = allowCurrentAi
    ? item.externalShockPlausibility
    : undefined;
  const applicability = allowCurrentAi
    ? populationApplicabilityForItem(item)
    : null;
  const pathway = allowCurrentAi
    ? outcomePathwayForItem(item)
    : null;

  if (
    pathway &&
    (pathway.category === "unclear" ||
      pathway.category === "unlikely")
  ) {
    candidateSpecificTasks.push(
      pathway.unresolved[0]
        ? `Resolve the outcome-pathway question for “${item.title}”: ${pathway.unresolved[0]}`
        : `Test the outcome-pathway concern for “${item.title}”: ${pathway.reason}`,
    );
  } else if (applicability?.unresolved[0]) {
    candidateSpecificTasks.push(
      `Resolve the coverage question for “${item.title}”: ${applicability.unresolved[0]}`,
    );
  } else if (item.limitations[0]) {
    candidateSpecificTasks.push(
      `Verify this candidate-specific limitation for “${item.title}”: ${item.limitations[0]}`,
    );
  } else {
    candidateSpecificTasks.push(
      `Verify the controlling record, operative status, and organization-level coverage for “${item.title}”.`,
    );
  }

  if (item.sources.length === 0) {
    dimensionTasks.push(
      `Locate a controlling or official source that documents “${item.title}”.`,
    );
  } else if (!hasDocumentedSource) {
    dimensionTasks.push(
      `Confirm the issuing authority for “${item.title}” and replace discovery leads with an authoritative source.`,
    );
  }
  if (
    populationFilter?.status !== "pass" ||
    !applicability ||
    applicability.category === "unknown" ||
    applicability.category === "documented-conditional" ||
    applicability.category === "plausible-indirect"
  ) {
    dimensionTasks.push(
      `Confirm whether the formal coverage rule for “${item.title}” reaches the Screen 1 study population.`,
    );
  }
  if (!hasOperativeDateLead || timing.category === "unknown") {
    dimensionTasks.push(
      `Identify the announcement and operative implementation dates for “${item.title}”; do not assume that publication is the treatment date.`,
    );
  }
  if (
    !allowCurrentAi ||
    item.outcomeLink.status !== "ai-hypothesis" ||
    !pathway ||
    pathway.category === "unclear" ||
    pathway.category === "unlikely"
  ) {
    dimensionTasks.push(
      `Assess the proposed pathway from “${item.title}” to ${outcomeFamily}; the current connector text is an unassessed lead.`,
    );
  }
  if (
    exposure.category === "unknown" ||
    item.scorecard.components.exposureObservability === null
  ) {
    dimensionTasks.push(
      `Determine how exposure to “${item.title}” can be measured and linked to each focal organization.`,
    );
  }
  if (
    variation.category === "unknown" ||
    item.scorecard.components.variation === null
  ) {
    dimensionTasks.push(
      `Check whether exposure to “${item.title}” varies across organizations, thresholds, jurisdictions, phases, or timing.`,
    );
  }
  if (!externality || externality.category === "unknown") {
    dimensionTasks.push(
      `Use pre-outcome evidence for “${item.title}” to assess anticipation, selection, reverse causation, and confounding concerns.`,
    );
  }
  for (const unresolved of [
    ...(pathway?.unresolved ?? []),
    ...(externality?.unresolved ?? []),
    ...exposure.unresolved,
    ...timing.unresolved,
    ...variation.unresolved,
  ]) {
    if (!/^verification is required\.?$/i.test(unresolved.trim())) {
      candidateSpecificTasks.push(
        `Resolve for “${item.title}”: ${unresolved}`,
      );
    }
  }
  for (const limitation of item.limitations.slice(1)) {
    candidateSpecificTasks.push(
      `Verify for “${item.title}”: ${limitation}`,
    );
  }
  const concreteTasks = uniqueNonempty([
    candidateSpecificTasks[0] ?? "",
    ...dimensionTasks,
    ...candidateSpecificTasks.slice(1),
  ]).slice(0, 3);
  return concreteTasks.length > 0
    ? concreteTasks
    : [
        "Confirm the operative event date, coverage rule, exposure mapping, and comparison variation against the attached source.",
      ];
}

function evidenceAtAGlanceForItem(
  item: Screen02Item,
  allowCurrentAi: boolean,
  studyPopulation: string,
): EvidenceAtAGlance {
  const coverage = candidateCoverageView(item, allowCurrentAi);
  return {
    sourceCount: item.sourceSummary.uniqueSourceCount,
    sourceTypes: uniqueNonempty(
      item.sources.map((source) => sourceAuthorityView(source).label),
    ),
    issuingAuthorities: uniqueNonempty(
      item.sources.map((source) => source.publisher),
    ),
    publicationDates: uniqueNonempty(
      item.sources.flatMap((source) =>
        source.publishedDate ? [source.publishedDate] : [],
      ),
    ),
    timingLeads: uniqueNonempty(item.provisionalDates),
    studyPopulation,
    sourceEstablishedPopulation: coverage.sourceEstablishedPopulation,
    sourceEstablishedPopulationEvidenceTitles: coverage.evidenceTitles,
    candidateApplicability: `${coverage.label}. ${coverage.explanation}`,
    candidateApplicabilityBasis: coverage.basis,
  };
}

export function candidateTriageForScreen02Item(
  item: Screen02Item,
  allowCurrentAi = true,
  outcomeFamily = "the focal outcome",
  context: CandidateTriageContext = {},
): CandidateTriageView {
  const hardFail = item.hardFilters.some((filter) => filter.status === "fail");
  const hardReview = item.hardFilters.some(
    (filter) => filter.status === "review",
  );
  const industry = context.industry?.trim() ?? "";
  const studyPopulation =
    context.studyPopulation?.trim() || item.affectedPopulation;
  const semanticDecision = context.semanticDecision ?? null;
  const nativeIndustryRelevance =
    item.mode === "find" && industry
      ? scoreScreen02NativeIndustryRelevance(item, industry)
      : null;
  const populationApplicability = allowCurrentAi
    ? populationApplicabilityForItem(item)
    : null;
  const outcomePathway = allowCurrentAi
    ? outcomePathwayForItem(item)
    : null;
  const nativePopulationReview = item.hardFilters.some(
    (filter) =>
      filter.key === "population" && filter.status === "review",
  );
  const resolvedPopulationReview = Boolean(
    allowCurrentAi &&
      nativePopulationReview &&
      populationApplicability?.category === "documented-direct",
  );
  const unresolvedHardReviews = item.hardFilters.filter(
    (filter) =>
      filter.status === "review" &&
      !(
        resolvedPopulationReview &&
        filter.key === "population"
      ),
  );
  const unresolvedHardReview = unresolvedHardReviews.length > 0;
  const unresolvedNonPopulationHardReview = unresolvedHardReviews.some(
    (filter) => filter.key !== "population",
  );
  const unresolvedFeasibilityHardReview = item.hardFilters.some(
    (filter) =>
      filter.status === "review" &&
      !(
        filter.key === "population" &&
        allowCurrentAi &&
        (populationApplicability?.category === "documented-direct" ||
          populationApplicability?.category === "documented-conditional")
      ),
  );
  const externality = allowCurrentAi
    ? item.externalShockPlausibility
    : undefined;

  const populationScopeNote = populationApplicability
    ? populationApplicability.category === "documented-direct"
      ? `The candidate-specific population assessment clears the provisional population review for triage: ${populationApplicability.reason}`
      : populationApplicability.category === "documented-conditional"
        ? `The candidate-specific population assessment keeps the match conditional: ${populationApplicability.reason}`
        : populationApplicability.category === "plausible-indirect"
          ? `The candidate-specific population assessment supports only indirect applicability and keeps the match under review: ${populationApplicability.reason}`
          : populationApplicability.category === "unlikely"
            ? `The candidate-specific population assessment indicates a population mismatch: ${populationApplicability.reason}`
            : `The candidate-specific population assessment leaves population fit unresolved: ${populationApplicability.reason}`
    : "";
  const scopeJudgment = hardFail
    ? "Mismatch"
    : populationApplicability?.category === "unlikely"
      ? "Mismatch"
      : !populationApplicability && allowCurrentAi && nativePopulationReview
        ? "Unresolved match"
        : populationApplicability?.category === "unknown"
          ? "Unresolved match"
          : populationApplicability?.category === "documented-conditional" ||
              populationApplicability?.category === "plausible-indirect"
            ? unresolvedNonPopulationHardReview
              ? "Partial match"
              : "Conditional match"
            : unresolvedHardReview
              ? "Partial match"
              : "Clear match";

  const scopePoint: AssessmentPoint = {
    id: "scope",
    title: "Match with your study",
    judgment: scopeJudgment,
    basis: allowCurrentAi && populationApplicability
      ? preliminaryAiInference
      : "Recorded metadata",
    explanation:
      item.hardFilters.length > 0
        ? `${item.hardFilters.map((filter) => filter.reason).join(" ")}${
            populationScopeNote
              ? ` ${populationScopeNote}`
              : ""
          }`
        : "No fixed scope check has been recorded.",
    evidenceTitles: [],
  };

  const sourceCount = item.sources.length;
  const authorityViews = item.sources.map(sourceAuthorityView);
  const officialSourceCount = authorityViews.filter(
    (view) => view.official,
  ).length;
  const documentedSourceCount = authorityViews.filter(
    (view) => view.documented,
  ).length;
  const sourcePoint: AssessmentPoint = {
    id: "documentation",
    title: "Documentation basis",
    judgment:
      sourceCount === 0
        ? "No documented source yet"
        : officialSourceCount > 0
          ? "Strong basis"
          : documentedSourceCount > 0
            ? "Supporting documentation"
            : "Authority not established",
    basis: sourceCount === 0 ? "Verification needed" : "Recorded metadata",
    explanation:
      sourceCount === 0
        ? "No source record is available for this candidate."
        : `${sourceCount} unique ${
            sourceCount === 1 ? "source was" : "sources were"
          } located. ${strongestSourceDescription(item)}.`,
    evidenceTitles: item.sources.map((source) => source.title),
  };

  const externalityJudgments = {
    plausible: "Plausible",
    mixed: "Mixed",
    "major-concern": "Major concern",
    unknown: "Needs verification",
  } as const;
  const externalityPoint: AssessmentPoint = externality
    ? {
        id: "externality",
        title: "External-shock plausibility",
        judgment: externalityJudgments[externality.category],
        basis: preliminaryAiInference,
        explanation: externality.reason,
        evidenceTitles: evidenceTitlesForIds(
          item,
          externality.evidenceSourceIds,
        ),
      }
    : {
        id: "externality",
        title: "External-shock plausibility",
        judgment: "Needs verification",
        basis: "Verification needed",
        explanation: allowCurrentAi
          ? "No preliminary external-shock judgment is recorded for this candidate."
          : "The current search has not completed a fresh AI judgment about external-shock plausibility.",
        evidenceTitles: [],
      };

  const populationPoint: AssessmentPoint = populationApplicability
    ? {
        id: "population-applicability",
        title: "Population applicability",
        judgment:
          populationApplicabilityLabels[populationApplicability.category],
        basis: preliminaryAiInference,
        explanation: assessmentExplanation(
          populationApplicability.reason,
          populationApplicability.confidence,
          populationApplicability.unresolved,
        ),
        evidenceTitles: assessmentEvidenceTitles(
          item,
          populationApplicability.evidenceSourceIds,
          "No attached source was cited for a candidate-specific coverage determination.",
        ),
      }
    : {
        id: "population-applicability",
        title: "Population applicability",
        judgment: "Coverage not yet assessed",
        basis: "Verification needed",
        explanation:
          "The factual connector copied the Screen 1 population as a linkage target; it did not establish candidate-specific coverage.",
        evidenceTitles: [],
      };

  const outcomePathwayPoint: AssessmentPoint = outcomePathway
    ? {
        id: "outcome-pathway",
        title: "Outcome-pathway evidence",
        judgment: outcomePathwayLabels[outcomePathway.category],
        basis: preliminaryAiInference,
        explanation: assessmentExplanation(
          outcomePathway.reason,
          outcomePathway.confidence,
          outcomePathway.unresolved,
        ),
        evidenceTitles: assessmentEvidenceTitles(
          item,
          outcomePathway.evidenceSourceIds,
          "No attached source was cited for a more specific outcome pathway.",
        ),
      }
    : {
        id: "outcome-pathway",
        title: "Outcome-pathway evidence",
        judgment: "Pathway not yet assessed",
        basis: "Verification needed",
        explanation:
          "The current connector text is an unassessed pathway lead, not a source-grounded outcome-pathway judgment.",
        evidenceTitles: [],
      };

  const points = [
    scopePoint,
    populationPoint,
    outcomePathwayPoint,
    externalityPoint,
    componentPoint(
      item,
      "exposureObservability",
      "Exposure-rule clarity",
      ["Relatively clear", "Linkage required", "Unclear"],
      allowCurrentAi,
    ),
    componentPoint(
      item,
      "variation",
      "Comparison potential",
      ["Promising", "Limited", "Major concern"],
      allowCurrentAi,
    ),
    componentPoint(
      item,
      "timeSupport",
      "Timing practicality",
      ["Comfortable", "Complex", "Poor fit"],
      allowCurrentAi,
    ),
    sourcePoint,
  ];
  const assessedOutcomePathway =
    allowCurrentAi &&
    item.outcomeLink.status === "ai-hypothesis" &&
    outcomePathway
      ? outcomePathway
      : null;
  const aiComponents = [
    "exposureObservability",
    "timeSupport",
    "variation",
  ] as const;
  const knownMajorConcern =
    populationApplicability?.category === "unlikely" ||
    outcomePathway?.category === "unlikely" ||
    externality?.category === "major-concern" ||
    (allowCurrentAi &&
      aiComponents.some(
        (component) =>
          item.scorecard.componentDetails[component].method === "ai-rubric" &&
          item.scorecard.components[component] !== null &&
          (item.scorecard.components[component] as number) < 45,
      ));
  const aiUnresolved =
    !externality ||
    externality.category === "unknown" ||
    !populationApplicability ||
    populationApplicability.category === "unknown" ||
    !outcomePathway ||
    outcomePathway.category === "unclear" ||
    item.outcomeLink.status !== "ai-hypothesis" ||
    aiComponents.some(
      (component) =>
        item.scorecard.componentDetails[component].method !== "ai-rubric" ||
        item.scorecard.componentDetails[component].category === "unknown" ||
        item.scorecard.components[component] === null,
    );
  const documentedSource = item.sources
    .map(sourceAuthorityView)
    .some((view) => view.documented);

  const scopeReviewReason = unresolvedHardReviews[0]?.reason;
  const substantiveFitReasons = uniqueNonempty([
    semanticDecision
      ? `Comparative review for “${item.title}”: ${semanticDecision.reason}`
      : "",
    nativeIndustryRelevance
      ? `Source-derived industry check for “${item.title}”: ${nativeIndustryRelevance.reason}`
      : "",
    populationApplicability
      ? `Population applicability for “${item.title}”: ${populationApplicability.reason}`
      : "",
    scopeReviewReason ?? "",
  ]);

  let fitJudgment: string;
  if (hardFail) {
    fitJudgment = "Does not fit";
  } else if (!allowCurrentAi) {
    fitJudgment =
      nativeIndustryRelevance?.status === "mismatch"
        ? "Weak industry fit"
        : nativeIndustryRelevance?.status === "clear-fit"
          ? hardReview
            ? "Promising source match"
            : "Clear source match"
          : "Possible industry fit";
  } else if (
    !populationApplicability ||
    populationApplicability.category === "unknown"
  ) {
    fitJudgment = "Population fit unresolved";
  } else if (populationApplicability?.category === "unlikely") {
    fitJudgment = "Weak population fit";
  } else if (
    populationApplicability?.category === "documented-direct" &&
    nativeIndustryRelevance?.status !== "mismatch" &&
    item.hardFilters.every(
      (filter) =>
        filter.status === "pass" || filter.key === "population",
    )
  ) {
    fitJudgment = "Clear fit";
  } else if (
    populationApplicability?.category === "documented-conditional" ||
    populationApplicability?.category === "plausible-indirect"
  ) {
    fitJudgment = "Conditional fit";
  } else {
    fitJudgment = unresolvedHardReview ? "Possible fit" : "Clear fit";
  }

  const fit: PrimaryJudgment = {
    title: "Fit with your study",
    judgment: fitJudgment,
    basis: allowCurrentAi
      ? preliminaryAiInference
      : "Recorded metadata",
    explanation: hardFail
      ? "A recorded fixed-scope check conflicts with the confirmed Screen 1 boundary."
      : substantiveFitReasons.length > 0
        ? substantiveFitReasons.slice(0, 3).join(" ")
        : allowCurrentAi
          ? "The comparative review retained this candidate, but its substantive fit still needs to be documented."
          : "The source record passed the available fixed checks, but candidate-specific industry and population applicability remain unassessed.",
  };
  const outcome: PrimaryJudgment = {
    title: `Why it may affect ${outcomeFamily}`,
    judgment: assessedOutcomePathway
      ? outcomePathwayLabels[assessedOutcomePathway.category]
      : allowCurrentAi
        ? "Pathway assessment incomplete"
        : "Unassessed pathway lead",
    basis: assessedOutcomePathway
      ? preliminaryAiInference
      : "Verification needed",
    explanation: assessedOutcomePathway
      ? assessedOutcomePathway.reason.trim().toLocaleLowerCase("en-US") ===
        item.outcomeLink.text.trim().toLocaleLowerCase("en-US")
        ? assessedOutcomePathway.reason
        : `${assessedOutcomePathway.reason} Candidate-specific mechanism: ${item.outcomeLink.text}`
      : item.outcomeLink.text,
  };

  const knownComponentEntries = aiComponents
    .map((component) => ({
      component,
      value: item.scorecard.components[component],
      detail: item.scorecard.componentDetails[component],
    }))
    .filter(
      (entry): entry is typeof entry & { value: number } =>
        entry.value !== null,
    )
    .sort((left, right) => right.value - left.value);
  const componentTitles: Record<(typeof aiComponents)[number], string> = {
    exposureObservability: "Exposure-rule clarity",
    timeSupport: "Timing practicality",
    variation: "Comparison potential",
  };
  // aiComponents is ordered by published score weight, so the first unknown
  // with a substantive evidence gap is the strongest unresolved dimension.
  const unresolvedComponentBottleneck = aiComponents
    .map((component) => ({
      component,
      value: item.scorecard.components[component],
      detail: item.scorecard.componentDetails[component],
    }))
    .filter(
      ({ value, detail }) =>
        value === null || detail.category === "unknown",
    )
    .map(({ component, detail }) => {
      const substantiveUnresolved = detail.unresolved.find(
        (entry) =>
          !/^verification is required\.?$/i.test(entry.trim()) &&
          !/^the available evidence does not support/i.test(entry.trim()),
      );
      const detailText =
        substantiveUnresolved ||
        detail.reason.trim() ||
        detail.unresolved[0] ||
        "The available evidence does not support a judgment.";
      return `${componentTitles[component]} remains unresolved: ${detailText}`;
    })[0];
  const strongestKnownSupport = allowCurrentAi
    ? populationApplicability?.category === "documented-direct"
      ? populationApplicability.reason
      : outcomePathway?.category === "source-anchored-specific"
        ? outcomePathway.reason
        : knownComponentEntries[0]?.detail.reason ||
          (documentedSource
            ? `${strongestSourceDescription(item)} for “${item.title}”.`
            : `The current record identifies “${item.title}” as a factual discovery lead.`)
    : nativeIndustryRelevance?.status === "clear-fit"
      ? nativeIndustryRelevance.reason
      : documentedSource
        ? `${strongestSourceDescription(item)} for “${item.title}”.`
        : item.provisionalDates.length > 0
          ? `The current record supplies a timing lead for “${item.title}”: ${item.provisionalDates[0]}.`
          : `The current record identifies “${item.title}” as a discovery lead.`;
  const lowestKnownComponent = [...knownComponentEntries].sort(
    (left, right) => left.value - right.value,
  )[0];
  const lowestSevereComponent = [...knownComponentEntries]
    .sort((left, right) => left.value - right.value)
    .find((entry) => entry.value < 45);
  const hardFailReason = item.hardFilters.find(
    (filter) => filter.status === "fail",
  )?.reason;
  const mainUnresolvedBottleneck = allowCurrentAi
    ? hardFailReason ||
      (externality?.category === "major-concern"
        ? externality.reason
        : "") ||
      lowestSevereComponent?.detail.unresolved[0] ||
      lowestSevereComponent?.detail.reason ||
      (outcomePathway?.category === "unlikely"
        ? outcomePathway.reason
        : "") ||
      (populationApplicability?.category === "unlikely"
        ? populationApplicability.reason
        : "") ||
      unresolvedComponentBottleneck ||
      (outcomePathway?.category === "unclear"
        ? outcomePathway.unresolved[0] || outcomePathway.reason
        : "") ||
      (populationApplicability?.category === "unknown"
        ? populationApplicability.reason
        : "") ||
      (externality?.category === "unknown" ? externality.reason : "") ||
      lowestKnownComponent?.detail.unresolved[0] ||
      outcomePathway?.unresolved[0] ||
      populationApplicability?.unresolved[0] ||
      scopeReviewReason ||
      item.limitations[0] ||
      lowestKnownComponent?.detail.reason ||
      "Formal exposure and comparison construction still require verification."
    : scopeReviewReason ||
      item.limitations[0] ||
      "Exposure mapping and comparison variation have not yet received a comparative assessment.";

  let feasibilityJudgment: string;
  let feasibilityExplanation: string;
  const minimumAiComponentScore =
    knownComponentEntries.length === aiComponents.length
      ? Math.min(...knownComponentEntries.map((entry) => entry.value))
      : null;
  const overallFeasibilityScore =
    item.scorecard.overall ?? item.scorecard.overallRange.minimum;
  const fullyAssessedForBanding =
    allowCurrentAi &&
    !aiUnresolved &&
    !unresolvedFeasibilityHardReview &&
    documentedSource &&
    minimumAiComponentScore !== null;
  if (
    hardFail ||
    item.likelyServiceLevel === "stop" ||
    item.evidenceStatus === "fictional-demonstration" ||
    sourceCount === 0 ||
    knownMajorConcern
  ) {
    feasibilityJudgment = "Weak lead";
    feasibilityExplanation =
      sourceCount === 0
        ? `No factual source is attached to “${item.title}”, so it remains a discovery lead.`
        : `Strongest current support: ${strongestKnownSupport} Main unresolved bottleneck: ${mainUnresolvedBottleneck}`;
  } else if (fullyAssessedForBanding) {
    feasibilityJudgment =
      overallFeasibilityScore >= 75 && minimumAiComponentScore >= 70
        ? "Strong preliminary feasibility"
        : overallFeasibilityScore >= 60 && minimumAiComponentScore >= 55
          ? "Worth investigating"
          : "Material feasibility caveats";
    feasibilityExplanation =
      `Strongest current support: ${strongestKnownSupport} Main unresolved bottleneck: ${mainUnresolvedBottleneck}`;
  } else if (!allowCurrentAi) {
    feasibilityJudgment = documentedSource
      ? nativeIndustryRelevance?.status === "clear-fit"
        ? "Promising factual lead"
        : "Factual lead to investigate"
      : "Discovery lead only";
    feasibilityExplanation = `Strongest current support: ${strongestKnownSupport} Main unresolved bottleneck: ${mainUnresolvedBottleneck}`;
  } else {
    feasibilityJudgment = "Needs targeted checking";
    feasibilityExplanation =
      `Strongest current support: ${strongestKnownSupport} Main unresolved bottleneck: ${mainUnresolvedBottleneck}`;
  }

  return {
    aiEnriched: allowCurrentAi,
    fit,
    outcome,
    feasibility: {
      title: "Early feasibility",
      judgment: feasibilityJudgment,
      basis: allowCurrentAi
        ? preliminaryAiInference
        : "Recorded metadata",
      explanation: feasibilityExplanation,
    },
    evidence: evidenceAtAGlanceForItem(
      item,
      allowCurrentAi,
      studyPopulation,
    ),
    verificationTasks: verificationTasksForItem(
      item,
      allowCurrentAi,
      outcomeFamily,
    ),
    technicalPoints: points,
  };
}

function compactPreliminaryAssessmentForItem(
  item: Screen02Item,
): CompactPreliminaryAssessment | null {
  const value = (
    item as Screen02Item & { preliminaryAssessment?: unknown }
  ).preliminaryAssessment;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CompactPreliminaryAssessment>;
  const requiredText = [
    candidate.judgment,
    candidate.studyFit,
    candidate.mainConcern,
  ];
  if (
    requiredText.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    ) ||
    !Array.isArray(candidate.nextChecks) ||
    !Array.isArray(candidate.evidenceSourceIds) ||
    (candidate.affectedPopulation !== null &&
      (typeof candidate.affectedPopulation !== "string" ||
        candidate.affectedPopulation.trim().length === 0)) ||
    (candidate.outcomeMechanism !== null &&
      (typeof candidate.outcomeMechanism !== "string" ||
        candidate.outcomeMechanism.trim().length === 0))
  ) {
    return null;
  }
  return {
    judgment: candidate.judgment!.trim(),
    studyFit: candidate.studyFit!.trim(),
    affectedPopulation: candidate.affectedPopulation?.trim() ?? null,
    outcomeMechanism: candidate.outcomeMechanism?.trim() ?? null,
    mainConcern: candidate.mainConcern!.trim(),
    nextChecks: candidate.nextChecks
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 2),
    evidenceSourceIds: candidate.evidenceSourceIds.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    ),
  };
}

function plainPreliminaryJudgment(value: string, item: Screen02Item) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (
    normalized === "promising to verify" ||
    normalized === "strong preliminary feasibility"
  ) {
    return "Promising to verify";
  }
  if (
    normalized === "worth exploring" ||
    normalized === "worth investigating" ||
    normalized === "needs targeted checking" ||
    normalized === "promising factual lead" ||
    normalized === "factual lead to investigate"
  ) {
    return "Worth exploring";
  }
  if (
    normalized === "low priority" ||
    normalized === "weak lead" ||
    normalized === "material feasibility caveats"
  ) {
    return "Low priority";
  }
  if (
    normalized === "not enough evidence" ||
    normalized === "discovery lead only"
  ) {
    return "Not enough evidence";
  }
  return item.sources.length > 0 ? "Worth exploring" : "Not enough evidence";
}

function plainAssessmentText(value: string) {
  return value
    .replace(/Comparative review for “[^”]+”:\s*/giu, "")
    .replace(/\bComparative review\b/giu, "Criteria assessment")
    .replace(/Source-derived industry check for “[^”]+”:\s*/giu, "")
    .replace(/Population applicability for “[^”]+”:\s*/giu, "")
    .replace(/Candidate-specific mechanism:\s*/giu, "")
    .replace(
      /\bthe Screen 1 (?:(?:target|study) )?population\b/giu,
      "the study population",
    )
    .replace(
      /\bScreen 1 (?:(?:target|study) )?population\b/giu,
      "study population",
    )
    .replace(/\bafter semantic review\b/giu, "after reviewing the candidate evidence")
    .replace(/\bsemantic review\b/giu, "criteria assessment")
    .replace(/\bScreen 1\b/giu, "the study")
    .replace(/\bScreen 3\b/giu, "the next verification step")
    .replace(/\bnative connector\b/giu, "source search")
    .replace(/\bfixed-scope\b/giu, "study-scope")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyEvidenceSourceIds(item: Screen02Item) {
  const applicability = populationApplicabilityForItem(item);
  const pathway = outcomePathwayForItem(item);
  const ids = uniqueNonempty([
    ...(applicability?.sourceEstablishedPopulation?.evidenceSourceIds ?? []),
    ...(applicability?.evidenceSourceIds ?? []),
    ...(pathway?.evidenceSourceIds ?? []),
    ...(item.externalShockPlausibility?.evidenceSourceIds ?? []),
    ...item.scorecard.componentDetails.exposureObservability.evidenceSourceIds,
    ...item.scorecard.componentDetails.timeSupport.evidenceSourceIds,
    ...item.scorecard.componentDetails.variation.evidenceSourceIds,
  ]);
  return ids.length > 0 ? ids : item.sources.map((source) => source.id);
}

function evidenceTitlesForBrief(item: Screen02Item, sourceIds: string[]) {
  const sources = new Map(item.sources.map((source) => [source.id, source]));
  return uniqueNonempty(
    sourceIds.flatMap((sourceId) => {
      const source = sources.get(sourceId);
      return source ? [source.title] : [];
    }),
  );
}

export function candidatePreliminaryBriefForScreen02Item(
  item: Screen02Item,
  allowLegacyReview = true,
  outcomeFamily = "the focal outcome",
  context: CandidateTriageContext = {},
): CandidatePreliminaryBrief | null {
  const compact = compactPreliminaryAssessmentForItem(item);
  if (compact) {
    return {
      ...compact,
      judgment: plainPreliminaryJudgment(compact.judgment, item),
      studyFit: plainAssessmentText(compact.studyFit),
      affectedPopulation: compact.affectedPopulation
        ? plainAssessmentText(compact.affectedPopulation)
        : "Current sources do not yet establish which organizations are affected.",
      outcomeMechanism: compact.outcomeMechanism
        ? plainAssessmentText(compact.outcomeMechanism)
        : `Current evidence does not yet support a candidate-specific pathway to ${outcomeFamily}.`,
      mainConcern: plainAssessmentText(compact.mainConcern),
      nextChecks: compact.nextChecks.map(plainAssessmentText),
      evidenceTitles: evidenceTitlesForBrief(
        item,
        compact.evidenceSourceIds,
      ),
      source: "compact",
    };
  }
  if (!allowLegacyReview) return null;

  const triage = candidateTriageForScreen02Item(
    item,
    true,
    outcomeFamily,
    context,
  );
  const coverage = candidateCoverageView(item, true);
  const applicability = populationApplicabilityForItem(item);
  const nativeIndustryRelevance =
    item.mode === "find" && context.industry?.trim()
      ? scoreScreen02NativeIndustryRelevance(item, context.industry.trim())
      : null;
  const scopeConcern = item.hardFilters.find(
    (filter) => filter.status === "fail" || filter.status === "review",
  );
  const legacyStudyFit =
    scopeConcern?.status === "fail"
      ? scopeConcern.reason
      : applicability?.reason ||
        nativeIndustryRelevance?.reason ||
        context.semanticDecision?.reason ||
        triage.fit.explanation;
  const bottleneckMarker = /Main unresolved bottleneck:\s*/iu;
  const bottleneckParts = triage.feasibility.explanation.split(
    bottleneckMarker,
  );
  const mainConcern =
    bottleneckParts.length > 1
      ? bottleneckParts.slice(1).join(" ")
      : item.limitations[0] ||
        "The exact exposure rule and comparison strategy still need verification.";
  const evidenceSourceIds = legacyEvidenceSourceIds(item);
  const affectedPopulation =
    coverage.sourceEstablishedPopulation ===
    "Not established by the current cited sources."
      ? "Current sources do not yet establish which organizations are affected."
      : coverage.sourceEstablishedPopulation;
  return {
    judgment: plainPreliminaryJudgment(
      triage.feasibility.judgment,
      item,
    ),
    studyFit: plainAssessmentText(legacyStudyFit),
    affectedPopulation: plainAssessmentText(affectedPopulation),
    outcomeMechanism: plainAssessmentText(triage.outcome.explanation),
    mainConcern: plainAssessmentText(mainConcern),
    nextChecks: triage.verificationTasks
      .slice(0, 2)
      .map(plainAssessmentText),
    evidenceSourceIds,
    evidenceTitles: evidenceTitlesForBrief(item, evidenceSourceIds),
    source: "legacy",
  };
}

function CandidateRecordStatus({
  item,
}: {
  item: Screen02Item;
}) {
  const authorityViews = item.sources.map(sourceAuthorityView);
  const documentationLabel =
    item.evidenceStatus === "fictional-demonstration"
      ? "Demonstration record"
      : item.sources.length === 0
        ? "No documentation located"
        : authorityViews.some((view) => view.official)
          ? "Official documentation"
          : authorityViews.some((view) => view.documented)
            ? "Supporting documentation"
            : "Source authority unverified";
  return (
    <span
      className={`s2-evidence-status ${
        item.sources.length > 0 &&
        item.evidenceStatus !== "fictional-demonstration"
          ? ""
          : "s2-evidence-status--caution"
      }`}
    >
      <span aria-hidden="true">{item.sources.length > 0 ? "●" : "◇"}</span>
      {documentationLabel}
    </span>
  );
}

function CandidateTriagePanel({
  item,
  semanticReviewStatus,
  outcomeFamily,
  industry,
  studyPopulation,
  semanticDecision,
  assessmentNeedsRetry = false,
  retryDisabled = false,
  onRetryAssessment,
}: {
  item: Screen02Item;
  semanticReviewStatus: Screen02SemanticReviewStatus;
  outcomeFamily: string;
  industry: string;
  studyPopulation: string;
  semanticDecision: Screen02SemanticDecision | null;
  assessmentNeedsRetry?: boolean;
  retryDisabled?: boolean;
  onRetryAssessment?: () => void;
}) {
  const brief = candidatePreliminaryBriefForScreen02Item(
    item,
    semanticReviewStatus === "reviewed",
    outcomeFamily,
    { industry, studyPopulation, semanticDecision },
  );
  const evidenceSources = brief
    ? brief.evidenceSourceIds.flatMap((sourceId) => {
        const source = item.sources.find((candidate) => candidate.id === sourceId);
        return source ? [source] : [];
      })
    : [];
  return (
    <section
      className="s2-preliminary-assessment"
      aria-labelledby={`s2-assessment-${item.id}`}
    >
      <div className="s2-assessment-heading">
        <div>
          <span className="s2-section-kicker">Preliminary assessment</span>
          <h3 id={`s2-assessment-${item.id}`}>
            Should you investigate this shock?
          </h3>
        </div>
        {brief && (
          <div className="s2-overall-view">
            <span>Preliminary judgment</span>
            <strong data-testid="screen02-preliminary-judgment">
              {brief.judgment}
            </strong>
          </div>
        )}
      </div>
      {brief ? (
        <>
          <p className="s2-assessment-caution">
            This brief helps compare candidates. The event, exposure rule, and
            research design still require verification.
          </p>
          <div className="s2-assessment-brief-grid">
            <article data-testid="screen02-study-fit">
              <h4>Study fit</h4>
              <p>{brief.studyFit}</p>
            </article>
            <article data-testid="screen02-affected-population">
              <h4>Who appears affected</h4>
              <p>{brief.affectedPopulation}</p>
            </article>
            <article data-testid="screen02-outcome-pathway">
              <h4>How it may affect {outcomeFamily}</h4>
              <p>{brief.outcomeMechanism}</p>
            </article>
            <article data-testid="screen02-main-concern">
              <h4>Main concern</h4>
              <p>{brief.mainConcern}</p>
            </article>
          </div>

          <section
            className="s2-next-checks"
            data-testid="screen02-next-checks"
          >
            <h4>What to check next</h4>
            {brief.nextChecks.length > 0 ? (
              <ol>
                {brief.nextChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ol>
            ) : (
              <p>Confirm the event record and organization-level exposure.</p>
            )}
          </section>

          <section
            className="s2-assessment-evidence"
            data-testid="screen02-evidence-basis"
          >
            <div>
              <h4>Evidence</h4>
              <span>
                {evidenceSources.length} cited {evidenceSources.length === 1 ? "source" : "sources"}
              </span>
            </div>
            {evidenceSources.length > 0 ? (
              <ul>
                {evidenceSources.map((source) => {
                  const linked = /^https?:\/\//i.test(source.locator);
                  return (
                    <li key={source.id}>
                      {linked ? (
                        <a href={source.locator} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      ) : (
                        <strong>{source.title}</strong>
                      )}
                      <span>{source.publisher}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                The assessment does not yet cite a source for these judgments.
              </p>
            )}
          </section>
        </>
      ) : (
        <div
          className="s2-assessment-neutral"
          data-testid="screen02-assessment-neutral"
          role="status"
        >
          <strong>
            {semanticReviewStatus === "awaiting-review"
              ? "Preliminary assessment in progress"
              : "Preliminary assessment not completed"}
          </strong>
          <p>
            {semanticReviewStatus === "awaiting-review"
              ? "You can review the factual record and sources while the assessment is prepared."
              : "The factual record and sources remain available. Retry the assessment to add a candidate-specific study fit, outcome pathway, and feasibility concern."}
          </p>
          {assessmentNeedsRetry && onRetryAssessment && (
            <button
              className="s2-secondary-action s2-assessment-retry"
              type="button"
              disabled={retryDisabled}
              onClick={onRetryAssessment}
            >
              Retry this assessment
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SourceList({ item }: { item: Screen02Item }) {
  if (item.sources.length === 0) {
    return (
      <p className="s2-no-sources">
        No source record is available yet. Treat the candidate as a discovery
        lead rather than a documented shock.
      </p>
    );
  }
  return (
    <ul className="s2-source-list" aria-label="Located sources">
      {item.sources.map((source) => {
        const linked = /^https?:\/\//i.test(source.locator);
        const sourceClass = sourceAuthorityView(source).label;
        return (
          <li key={source.id}>
            <span>
              {linked ? (
                <a href={source.locator} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : (
                <strong>{source.title}</strong>
              )}
              <small>
                {source.publisher}
                {source.publishedDate ? ` · ${source.publishedDate}` : ""}
              </small>
            </span>
            <span>{sourceClass}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PreferenceSummary({
  criteria,
  semanticReviewStatus,
  semanticDecision,
}: {
  criteria: Screen02PreferenceCriterion[];
  semanticReviewStatus: Screen02SemanticReviewStatus;
  semanticDecision: Screen02SemanticDecision | null;
}) {
  if (criteria.length === 0) {
    return (
      <p className="s2-no-preferences">
        No additional search criteria were recorded for this result set.
      </p>
    );
  }
  const awaitingSemanticReview =
    semanticReviewStatus === "awaiting-review";
  const reviewUnavailable =
    semanticReviewStatus === "review-unavailable";
  const reviewIncomplete =
    semanticReviewStatus === "review-incomplete";
  return (
    <section className="s2-preference-summary">
      <h4>Match with your search criteria</h4>
      {reviewUnavailable ? (
        <p className="s2-preference-warning">
          These criteria were recorded but could not be assessed. You may
          revise them, run another search, or choose a candidate while treating
          the criteria as unverified.
        </p>
      ) : awaitingSemanticReview || reviewIncomplete ? (
        <p className="s2-preference-warning">
          These criteria are recorded, but their assessment has not completed.
          You may retry the assessment, revise the search, or choose a
          candidate while treating the criteria as unverified.
        </p>
      ) : (
        <>
          <h5>Why this result appears</h5>
          <p>
            {semanticDecision
              ? plainAssessmentText(semanticDecision.reason)
              : "This result was retained after the criteria assessment."}
          </p>
        </>
      )}
      <ul>
        {criteria.map((criterion) => (
          <li key={criterion.id}>
            <strong>{preferenceKindCopy[criterion.kind].label}</strong>{" "}
            {criterion.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function candidateSelectable(
  _session: Screen02Session,
  item: Screen02Item,
) {
  return (
    item.likelyServiceLevel !== "stop" &&
    item.evidenceStatus !== "fictional-demonstration" &&
    item.hardFilters.every((filter) => filter.status !== "fail")
  );
}

function CandidateResultRow({
  item,
  reviewed,
  chosen,
  locked,
  semanticReviewStatus,
  semanticDecision,
  industry,
  outcomeFamily,
  studyPopulation,
  onReview,
  assessmentNeedsRetry,
  retryDisabled,
  onRetryAssessment,
}: {
  item: Screen02Item;
  reviewed: boolean;
  chosen: boolean;
  locked: boolean;
  semanticReviewStatus: Screen02SemanticReviewStatus;
  semanticDecision: Screen02SemanticDecision | null;
  industry: string;
  outcomeFamily: string;
  studyPopulation: string;
  onReview: () => void;
  assessmentNeedsRetry: boolean;
  retryDisabled: boolean;
  onRetryAssessment?: () => void;
}) {
  const brief = candidatePreliminaryBriefForScreen02Item(
    item,
    semanticReviewStatus === "reviewed",
    outcomeFamily,
    { industry, studyPopulation, semanticDecision },
  );
  return (
    <li data-testid="screen02-result-card" data-item-id={item.id}>
      <button
        type="button"
        className={[
          "s2-result-row",
          reviewed ? "s2-result-row--reviewed" : "",
          chosen ? "s2-result-row--chosen" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={reviewed}
        aria-controls="s2-candidate-detail"
        onClick={onReview}
      >
        <span className="s2-result-title">
          <span>
            <CandidateRecordStatus item={item} />
            {chosen && (
              <small className="s2-chosen-badge">
                {locked ? "Chosen and ready" : "Chosen shock"}
              </small>
            )}
          </span>
          <strong>{item.title}</strong>
          <small>{item.description}</small>
        </span>
        <span className="s2-result-facts">
          <span>
            <small>Date</small>
            {itemDate(item)}
          </span>
          <span>
            <small>Type</small>
            {itemType(item)}
          </span>
          <span>
            <small>Geography</small>
            {itemGeography(item)}
          </span>
          {brief && (
            <span>
              <small>Preliminary view</small>
              {brief.judgment}
            </span>
          )}
        </span>
        {semanticReviewStatus === "reviewed" && semanticDecision && (
          <small className="s2-result-match-reason">
            <strong>Why this result appears:</strong>{" "}
            {plainAssessmentText(semanticDecision.reason)}
          </small>
        )}
        <span className="s2-review-affordance">
          {reviewed ? "Reviewing" : "Review details"}
          <span aria-hidden="true">→</span>
        </span>
      </button>
      {assessmentNeedsRetry && onRetryAssessment && (
        <button
          className="s2-result-retry"
          type="button"
          disabled={retryDisabled}
          onClick={onRetryAssessment}
        >
          Retry assessment
        </button>
      )}
    </li>
  );
}

function CandidateDetail({
  session,
  item,
  criteria,
  semanticReviewStatus,
  interactionLocked,
  semanticDecisionLocked,
  strictCriteriaDecisionLocked,
  onRequestAiReview,
  onChoose,
  onReject,
}: {
  session: Screen02Session;
  item: Screen02Item | null;
  criteria: Screen02PreferenceCriterion[];
  semanticReviewStatus: Screen02SemanticReviewStatus;
  interactionLocked: boolean;
  semanticDecisionLocked: boolean;
  strictCriteriaDecisionLocked: boolean;
  onRequestAiReview?: Screen02Props["onRequestAiReview"];
  onChoose: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejectionReason, setRejectionReason] = useState(
    "This option does not fit my current research criteria.",
  );
  if (!item) {
    return (
      <section
        id="s2-candidate-detail"
        className="s2-candidate-detail s2-candidate-detail--empty"
        aria-live="polite"
      >
        <span aria-hidden="true">⌕</span>
        <strong>{branchCopy[session.mode].reviewPrompt}</strong>
        <p>
          Reviewing a result does not choose it or change the confirmed Screen
          1 boundary.
        </p>
      </section>
    );
  }

  const chosen = session.selectedItemId === item.id;
  const itemId = item.id;
  const locked = session.lockedChoice?.itemId === item.id;
  const selectable = candidateSelectable(session, item);
  const semanticDecision = currentSemanticDecision(session, item.id);
  const assessmentNeedsRetry = preliminaryAssessmentNeedsRetry(session, item);

  function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = rejectionReason.trim();
    if (reason) onReject(itemId, reason);
  }

  return (
    <article
      id="s2-candidate-detail"
      className="s2-candidate-detail"
      aria-live="polite"
      aria-labelledby={`s2-detail-title-${item.id}`}
    >
      <header className="s2-detail-header">
        <div>
          <span className="s2-section-kicker">
            {branchCopy[session.mode].itemKind} under review
          </span>
          <h2 id={`s2-detail-title-${item.id}`}>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        <CandidateRecordStatus item={item} />
      </header>

      <dl className="s2-detail-facts">
        <div>
          <dt>Date or timing lead</dt>
          <dd>{itemDate(item)}</dd>
        </div>
        <div>
          <dt>Geography</dt>
          <dd>{itemGeography(item)}</dd>
        </div>
        <div>
          <dt>Event or match type</dt>
          <dd>{itemType(item)}</dd>
        </div>
        <div>
          <dt>Documentation</dt>
          <dd>{strongestSourceDescription(item)}</dd>
        </div>
      </dl>

      {item.mode === "audit" && (
        <section className="s2-representation-detail">
          <h3>Known-shock identity record</h3>
          <p>
            <strong>Exact shock:</strong> {item.anchorShock}
          </p>
          <p>
            <strong>Possible event match:</strong> {item.title}
          </p>
          <p>
            Dates, rules, exposure, and empirical representation still need
            verification.
          </p>
        </section>
      )}

      <CandidateTriagePanel
        item={item}
        semanticReviewStatus={semanticReviewStatus}
        outcomeFamily={session.screen01Baseline.scopeContract.outcomeFamily}
        industry={session.screen01Baseline.scopeContract.industry}
        studyPopulation={session.screen01Baseline.scopeContract.population}
        semanticDecision={semanticDecision}
        assessmentNeedsRetry={assessmentNeedsRetry}
        retryDisabled={interactionLocked || semanticDecisionLocked}
        onRetryAssessment={
          onRequestAiReview
            ? () => onRequestAiReview([item.id])
            : undefined
        }
      />

      <section className="s2-card-section">
        <div className="s2-card-section-heading">
          <div>
            <span className="s2-section-kicker">Evidence record</span>
            <h3>Located sources</h3>
          </div>
          <strong>
            {item.sourceSummary.uniqueSourceCount} unique{" "}
            {item.sourceSummary.uniqueSourceCount === 1 ? "source" : "sources"}
          </strong>
        </div>
        <SourceList item={item} />
      </section>

      <PreferenceSummary
        criteria={criteria}
        semanticReviewStatus={semanticReviewStatus}
        semanticDecision={semanticDecision}
      />

      <footer className="s2-detail-actions">
        <div>
          {interactionLocked ? (
            <button
              className="s2-secondary-action"
              type="button"
              disabled
              title="Candidate decisions are paused while the current review completes"
            >
              Remove from consideration
            </button>
          ) : (
            <details className="s2-reject-control">
              <summary>Remove from consideration</summary>
              <form onSubmit={submitRejection}>
                <label htmlFor={`reject-${item.id}`}>Reason</label>
                <textarea
                  id={`reject-${item.id}`}
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
                <button
                  className="s2-secondary-action"
                  type="submit"
                  disabled={!rejectionReason.trim()}
                >
                  Move to prior decisions
                </button>
              </form>
            </details>
          )}
          <button
            className="s2-primary-action"
            type="button"
            disabled={
              !selectable ||
              chosen ||
              interactionLocked ||
              semanticDecisionLocked
            }
            title={
              semanticDecisionLocked
                ? strictCriteriaDecisionLocked
                  ? "Choosing is paused until the required criteria are assessed"
                  : "Choosing is paused until the preliminary assessment returns"
                : interactionLocked
                  ? "Candidate decisions are paused while the current action completes"
                : undefined
            }
            onClick={() => onChoose(item.id)}
          >
            {locked
              ? "Chosen and ready"
              : chosen
                ? "Chosen shock"
                : selectable
                  ? session.mode === "find"
                    ? "Choose this shock"
                    : "This is my shock"
                  : "Not eligible to choose"}
          </button>
        </div>
      </footer>
    </article>
  );
}

function AuditSearchWorkspace({
  session,
  semanticReviewStatus,
  onRequestSearch,
  onRequestAiReview,
  onExpandCoverage,
  onBack,
}: {
  session: Screen02Session;
  semanticReviewStatus: Screen02SemanticReviewStatus;
  onRequestSearch: Screen02Props["onRequestSearch"];
  onRequestAiReview?: Screen02Props["onRequestAiReview"];
  onExpandCoverage?: Screen02Props["onExpandCoverage"];
  onBack: () => void;
}) {
  const [guidance, setGuidance] = useState("");
  const pending = session.interaction.pendingRequest;
  const locked = session.lockedChoice !== null;
  const scopeRevision = session.interaction.pendingScopeRevision;
  const semanticReviewPending =
    semanticReviewStatus === "awaiting-review";
  const strictCriteriaDecisionLocked =
    screen02StrictCriteriaDecisionLock(
      session,
      semanticReviewStatus,
    );
  const editingDisabled =
    locked ||
    pending !== null ||
    scopeRevision !== null ||
    (semanticReviewPending && strictCriteriaDecisionLocked);
  const evidence = currentAuditShockEvidence(session);
  const hasCurrentResults = currentVisibleScreen02Items(session).length > 0;
  const coverageCanExpand = hasExpandableCoverageRound(session);
  const aiReviewControlVisible =
    Boolean(onRequestAiReview) &&
    hasCurrentResults &&
    (semanticReviewStatus === "not-requested" ||
      semanticReviewStatus === "awaiting-review" ||
      semanticReviewStatus === "review-incomplete" ||
      semanticReviewStatus === "review-unavailable") &&
    !locked &&
    pending === null &&
    scopeRevision === null;
  const canRequestAiReview =
    aiReviewControlVisible && !semanticReviewPending;

  function requestAuditSearch() {
    if (editingDisabled) return;
    const clarification = guidance.trim();
    onRequestSearch(
      "find-more",
      `Search factual background for the exact Screen 1 known shock ${JSON.stringify(
        session.screen01Baseline.knownShock,
      )}.${
        clarification
          ? ` Researcher clarification about the intended match: ${clarification}`
          : ""
      }`,
      clarification
        ? [{ kind: "prefer", text: clarification }]
        : [],
    );
  }

  return (
    <section
      className="s2-audit-search-panel"
      aria-labelledby="s2-audit-search-title"
    >
      <div className="s2-audit-search-heading">
        <div>
          <span className="s2-section-kicker">Shock identity search</span>
          <h2 id="s2-audit-search-title">
            Check that ShockAudit found the event you meant
          </h2>
          <p>
            Search official-source leads for the exact shock recorded on
            Screen 1. Add a note if an issuing body, jurisdiction, year, or
            formal title would help distinguish the intended event.
          </p>
        </div>
        <span className="s2-audit-anchor-badge">Screen 1 name locked</span>
      </div>

      <label className="s2-audit-guidance" htmlFor="s2-audit-guidance">
        <strong>Optional clarification for this search</strong>
        <textarea
          id="s2-audit-guidance"
          value={guidance}
          onChange={(event) => setGuidance(event.target.value)}
          placeholder="e.g., the California privacy statute enacted in 2018, not a later amendment"
          disabled={editingDisabled}
        />
        <span>
          This note refines the search record. To replace the shock name
          itself, return to Screen 1 so the confirmed baseline remains
          auditable.
        </span>
      </label>

      {pending && (
        <section className="s2-pending-request" aria-live="polite">
          <strong>
            {pending.status === "sending"
              ? "Starting the known-shock search"
              : "Waiting for the known-shock search"}
          </strong>
          <p>{pending.exactText}</p>
        </section>
      )}

      {semanticReviewPending && pending === null && (
        <section
          className="s2-semantic-review-lock"
          role="status"
          aria-live="polite"
        >
          <strong>
            {strictCriteriaDecisionLocked
              ? "Preliminary assessment and required-criteria review are in progress"
              : "Preliminary assessment is in progress"}
          </strong>
          <p>
            {strictCriteriaDecisionLocked
              ? "You may review the current factual record, but the known-shock search, clarification, confirmation, source expansion, and event verification are paused until the required criteria are assessed."
              : "You can keep reviewing or confirm this shock, and you may start another search while the assessment is prepared."}
          </p>
        </section>
      )}

      <div className="s2-search-actions s2-audit-search-actions">
        <button
          data-testid="screen02-audit-search-button"
          className="s2-primary-action"
          type="button"
          disabled={editingDisabled}
          aria-busy={
            pending !== null ||
            (semanticReviewPending && strictCriteriaDecisionLocked)
          }
          title={
            semanticReviewPending && strictCriteriaDecisionLocked
              ? "The known-shock search can resume after the preliminary assessment completes"
              : undefined
          }
          onClick={requestAuditSearch}
        >
          {semanticReviewPending && strictCriteriaDecisionLocked
            ? "Preliminary assessment in progress"
            : evidence
            ? "Find/resolve shock matches again"
            : "Find/resolve shock matches"}
        </button>
        <button
          className="s2-secondary-action"
          type="button"
          disabled={editingDisabled}
          onClick={onBack}
        >
          Correct the shock name in Screen 1
        </button>
        {aiReviewControlVisible && (
          <button
            data-testid="screen02-ai-review-button"
            className="s2-secondary-action"
            type="button"
            disabled={!canRequestAiReview}
            title={
              semanticReviewPending
                ? "The current preliminary assessment must finish before another can start"
                : undefined
            }
            onClick={() => onRequestAiReview?.()}
          >
            {semanticReviewPending
              ? "Preliminary assessment in progress"
              : semanticReviewStatus === "review-unavailable" ||
            semanticReviewStatus === "review-incomplete"
              ? "Retry preliminary assessment"
              : "Add preliminary assessment"}
          </button>
        )}
        {onExpandCoverage && coverageCanExpand && (
          <button
            data-testid="screen02-expand-coverage-button"
            className="s2-secondary-action"
            type="button"
            disabled={
              editingDisabled
            }
            title={
              semanticReviewPending && strictCriteriaDecisionLocked
                ? "Source expansion becomes available when the current preliminary assessment finishes"
                : undefined
            }
            onClick={onExpandCoverage}
          >
            {semanticReviewPending && strictCriteriaDecisionLocked
              ? "Source expansion available after assessment"
              : "Expand source coverage"}
          </button>
        )}
      </div>

      {onExpandCoverage && coverageCanExpand && (
        <p className="s2-coverage-expansion-note">{coverageExpansionNote}</p>
      )}

      {scopeRevision && (
        <p className="s2-scope-control-note" role="status">
          Search is paused until the requested boundary change is resolved on
          Screen 1.
        </p>
      )}
    </section>
  );
}

function AuditIdentityPanel({
  session,
  items,
  activeItemId,
  onReview,
}: {
  session: Screen02Session;
  items: Screen02Item[];
  activeItemId: string | null;
  onReview: (id: string) => void;
}) {
  const evidence = currentAuditShockEvidence(session);
  const current = currentRound(session);
  const searched = Boolean(
    current && current.requestType !== "initial",
  );
  const candidateNames =
    items.length > 0
      ? items.map((item) => item.title)
      : evidence?.candidateNames ?? [];
  const sources = evidence?.sources ?? [];

  return (
    <section
      className="s2-audit-identity-panel"
      aria-labelledby="s2-audit-identity-title"
      data-testid="screen02-audit-identity"
    >
      <div className="s2-audit-identity-heading">
        <div>
          <span className="s2-section-kicker">Possible matches</span>
          <h2 id="s2-audit-identity-title">
            {candidateNames.length === 0
              ? searched
                ? "No source-backed name match was located"
                : "Search for the named shock"
              : candidateNames.length === 1
                ? "One possible match was located"
                : `${candidateNames.length} possible matches were located`}
          </h2>
          <p>
            The name entered on Screen 1 remains the authoritative research
            anchor until you explicitly confirm the match below or correct it
            on Screen 1.
          </p>
        </div>
        <span
          className={`s2-audit-match-status ${
            candidateNames.length > 0
              ? "s2-audit-match-status--found"
              : ""
          }`}
        >
          {candidateNames.length > 0 ? "Match to review" : "Not confirmed"}
        </span>
      </div>

      <div className="s2-audit-entered-name">
        <span>Entered on Screen 1</span>
        <strong>{session.screen01Baseline.knownShock}</strong>
      </div>

      {items.length > 0 ? (
        <ul className="s2-audit-match-list">
          {items.map((item) => (
            <li className="s2-audit-match-choice" key={item.id}>
              <button
                className="s2-audit-match-button"
                type="button"
                aria-pressed={activeItemId === item.id}
                onClick={() => onReview(item.id)}
              >
                <span aria-hidden="true">
                  {activeItemId === item.id ? "✓" : "→"}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    Possible name match ·{" "}
                    {item.sourceSummary.uniqueSourceCount}{" "}
                    {item.sourceSummary.uniqueSourceCount === 1
                      ? "source"
                      : "sources"}
                  </small>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : candidateNames.length > 0 ? (
        <ul className="s2-audit-match-list">
          {candidateNames.map((name) => (
            <li key={name}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{name}</strong>
                <small>
                  Possible name match; factual and legal details still need
                  verification.
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="s2-audit-no-match">
          {searched
            ? "The completed bounded search did not return an exact-name or controlled-alias record. This does not establish that the shock does not exist. Add clarification, search again, or correct the name on Screen 1."
            : "Run the known-shock search to locate official names, date leads, affected populations, and source records."}
        </p>
      )}

      {evidence && (
        <dl className="s2-audit-evidence-facts">
          <div>
            <dt>Date leads</dt>
            <dd>
              {evidence.provisionalDates.join(" · ") ||
                "No date lead located"}
            </dd>
          </div>
          <div>
            <dt>Affected-population leads</dt>
            <dd>
              {evidence.affectedPopulations.join(" · ") ||
                "No population lead located"}
            </dd>
          </div>
          <div>
            <dt>Identity sources</dt>
            <dd>{sources.length}</dd>
          </div>
        </dl>
      )}

      {sources.length > 0 && (
        <section className="s2-audit-identity-sources">
          <h3>Sources supporting the possible match</h3>
          <ul className="s2-source-list">
            {sources.map((source) => {
              const authority = sourceAuthorityView(source);
              return (
                <li key={source.id}>
                  <span>
                    <a href={source.locator} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                    <small>
                      {source.publisher}
                      {source.publishedDate
                        ? ` · ${source.publishedDate}`
                        : ""}
                    </small>
                  </span>
                  <span>{authority.label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function AuditDossier({
  session,
  item,
  semanticReviewStatus,
  interactionLocked,
  semanticDecisionLocked,
  onRequestAiReview,
  onConfirm,
}: {
  session: Screen02Session;
  item: Screen02Item | null;
  semanticReviewStatus: Screen02SemanticReviewStatus;
  interactionLocked: boolean;
  semanticDecisionLocked: boolean;
  onRequestAiReview?: Screen02Props["onRequestAiReview"];
  onConfirm: (id: string) => void;
}) {
  const evidence = currentAuditShockEvidence(session);
  if (!item) {
    return (
      <section className="s2-audit-dossier s2-audit-dossier--empty">
        <span aria-hidden="true">⌕</span>
        <strong>No event match is available yet.</strong>
        <p>
          Search the known shock to populate its identity evidence and early
          assessment.
        </p>
      </section>
    );
  }

  const chosen = session.selectedItemId === item.id;
  const locked = session.lockedChoice?.itemId === item.id;
  const identitySourceCount =
    item.sourceSummary.uniqueSourceCount > 0
      ? item.sourceSummary.uniqueSourceCount
      : evidence?.sources.length ?? 0;
  const identitySupported = identitySourceCount > 0;
  const selectable = candidateSelectable(session, item);
  const dates = evidence?.provisionalDates ?? item.provisionalDates;
  const assessmentNeedsRetry = preliminaryAssessmentNeedsRetry(session, item);

  return (
    <article
      className="s2-audit-dossier"
      aria-labelledby="s2-audit-dossier-title"
      data-testid="screen02-audit-dossier"
    >
      <header className="s2-audit-dossier-header">
        <div>
          <span className="s2-section-kicker">Known-shock dossier</span>
          <h2 id="s2-audit-dossier-title">{item.title}</h2>
          <p>
            Factual background and a preliminary assessment for the shock
            entered as “{session.screen01Baseline.knownShock}”.
          </p>
        </div>
        <span
          className={`s2-audit-match-status ${
            identitySupported ? "s2-audit-match-status--found" : ""
          }`}
        >
          {identitySupported ? "Identity evidence located" : "Evidence needed"}
        </span>
      </header>

      <dl className="s2-detail-facts s2-audit-dossier-facts">
        <div>
          <dt>Date or timing leads</dt>
          <dd>{dates.join(" · ") || "Not yet established"}</dd>
        </div>
        <div>
          <dt>Geography</dt>
          <dd>{session.screen01Baseline.scopeContract.geography}</dd>
        </div>
        <div>
          <dt>Event family</dt>
          <dd>{session.screen01Baseline.scopeContract.eventFamily}</dd>
        </div>
      </dl>

      <CandidateTriagePanel
        item={item}
        semanticReviewStatus={semanticReviewStatus}
        outcomeFamily={session.screen01Baseline.scopeContract.outcomeFamily}
        industry={session.screen01Baseline.scopeContract.industry}
        studyPopulation={session.screen01Baseline.scopeContract.population}
        semanticDecision={currentSemanticDecision(session, item.id)}
        assessmentNeedsRetry={assessmentNeedsRetry}
        retryDisabled={interactionLocked || semanticDecisionLocked}
        onRetryAssessment={
          onRequestAiReview
            ? () => onRequestAiReview([item.id])
            : undefined
        }
      />

      <footer className="s2-audit-confirmation">
        <div>
          <strong>Is this the shock you intended?</strong>
          <p>
            Confirming the identity records your decision. Event timing,
            eligibility, exposure, and causal validity still need verification.
          </p>
        </div>
        <button
          className="s2-primary-action"
          type="button"
          disabled={
            !selectable ||
            !identitySupported ||
            chosen ||
            interactionLocked ||
            semanticDecisionLocked
          }
          title={
            semanticDecisionLocked
              ? "Confirmation is paused until the required criteria are assessed"
              : interactionLocked
                ? "Confirmation is paused while the current action completes"
              : undefined
          }
          onClick={() => onConfirm(item.id)}
        >
          {locked
            ? "Confirmed and ready"
            : chosen
              ? "Shock confirmed"
              : identitySupported
                ? "This is my shock"
                : "Search evidence before confirming"}
        </button>
      </footer>
    </article>
  );
}

function CriteriaWorkspace({
  session,
  semanticReviewStatus,
  onRequestSearch,
  onRequestAiReview,
  onExpandCoverage,
}: {
  session: Screen02Session;
  semanticReviewStatus: Screen02SemanticReviewStatus;
  onRequestSearch: Screen02Props["onRequestSearch"];
  onRequestAiReview?: Screen02Props["onRequestAiReview"];
  onExpandCoverage?: Screen02Props["onExpandCoverage"];
}) {
  const [inputs, setInputs] =
    useState<Record<Screen02PreferenceKind, string>>(
      emptyPreferenceInputs,
    );
  const [explanation, setExplanation] = useState("");
  const locked = session.lockedChoice !== null;
  const pending = session.interaction.pendingRequest;
  const scopeRevision = session.interaction.pendingScopeRevision;
  const semanticReviewPending =
    semanticReviewStatus === "awaiting-review";
  const strictCriteriaDecisionLocked =
    screen02StrictCriteriaDecisionLock(
      session,
      semanticReviewStatus,
    );
  const editingDisabled =
    locked ||
    pending !== null ||
    scopeRevision !== null ||
    (semanticReviewPending && strictCriteriaDecisionLocked);
  const actionDisabled = editingDisabled;
  const latestCriteria = currentCriteria(session);
  const criteriaAwaitSemanticReview =
    latestCriteria.length > 0 &&
    semanticReviewStatus === "awaiting-review";
  const criteriaReviewUnavailable =
    latestCriteria.length > 0 &&
    semanticReviewStatus === "review-unavailable";
  const criteriaReviewIncomplete =
    latestCriteria.length > 0 &&
    semanticReviewStatus === "review-incomplete";
  const visibleCriteria = collectVisiblePreferenceDrafts(inputs);
  const coverageCanExpand = hasExpandableCoverageRound(session);
  const aiReviewControlVisible =
    Boolean(onRequestAiReview) &&
    currentVisibleScreen02Items(session).length > 0 &&
    (semanticReviewStatus === "not-requested" ||
      semanticReviewStatus === "awaiting-review" ||
      semanticReviewStatus === "review-incomplete" ||
      semanticReviewStatus === "review-unavailable") &&
    !locked &&
    pending === null &&
    scopeRevision === null;
  const aiReviewCanBeRequested =
    aiReviewControlVisible && !semanticReviewPending;

  function requestSearch(requestType: InteractiveSearchRequest) {
    if (actionDisabled) return;
    const request = buildScreen02InteractiveSearchRequest(
      session.mode,
      requestType,
      inputs,
      explanation,
    );
    onRequestSearch(
      request.requestType,
      request.exactRequest,
      request.criteria,
    );
  }

  return (
    <section
      className="s2-interaction-panel"
      aria-labelledby="s2-refine-title"
    >
      <div className="s2-interaction-heading">
        <div>
          <span className="s2-section-kicker">Optional search guidance</span>
          <h2 id="s2-refine-title">Refine the candidate search</h2>
          <p>
            All fields may be left blank. Each search uses what is currently
            shown here; clearing a field means it should not guide the next
            result set.
          </p>
        </div>
      </div>

      <div className="s2-preference-columns">
        {preferenceKinds.map((kind) => (
          <label
            className={`s2-preference-entry s2-preference-entry--${kind}`}
            htmlFor={`s2-${kind}-criterion`}
            key={kind}
          >
            <strong>{preferenceKindCopy[kind].label}</strong>
            <span id={`s2-${kind}-criterion-help`}>
              {preferenceKindCopy[kind].help}
            </span>
            <input
              id={`s2-${kind}-criterion`}
              aria-describedby={`s2-${kind}-criterion-help`}
              value={inputs[kind]}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  [kind]: event.target.value,
                }))
              }
              placeholder={preferenceKindCopy[kind].placeholder}
              disabled={editingDisabled}
            />
          </label>
        ))}
      </div>

      <label className="s2-refinement-request" htmlFor="s2-refinement-request">
        <strong>Optional context for this search</strong>
        <textarea
          id="s2-refinement-request"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="Add a short explanation only when the three fields do not capture what you mean."
          disabled={editingDisabled}
        />
      </label>

      {latestCriteria.length > 0 && (
        <section
          className={`s2-latest-criteria ${
            criteriaAwaitSemanticReview
              ? "s2-latest-criteria--awaiting"
              : criteriaReviewUnavailable ||
                  criteriaReviewIncomplete
                ? "s2-latest-criteria--unavailable"
              : ""
          }`}
        >
          <strong>
            {criteriaAwaitSemanticReview
              ? "Criteria assessment in progress — not yet applied"
              : criteriaReviewUnavailable
                ? "Criteria recorded — assessment needs retry"
                : criteriaReviewIncomplete
                  ? "Criteria recorded — assessment not completed"
              : "Criteria applied to the latest result set"}
          </strong>
          <ul>
            {latestCriteria.map((criterion) => (
              <li key={criterion.id}>
                <span>{preferenceKindCopy[criterion.kind].label}</span>
                {criterion.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending && (
        <section className="s2-pending-request" aria-live="polite">
          <strong>
            {pending.status === "sending"
              ? "Starting the candidate search and assessment"
              : "Waiting for the candidate search"}
          </strong>
          <p>{pending.exactText}</p>
          {pending.criteria.length > 0 && (
            <ul>
              {pending.criteria.map((criterion, index) => (
                <li key={`${criterion.kind}-${criterion.text}-${index}`}>
                  <strong>{preferenceKindCopy[criterion.kind].label}</strong>{" "}
                  {criterion.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {semanticReviewPending && pending === null && (
        <section
          className="s2-semantic-review-lock"
          role="status"
          aria-live="polite"
        >
          <strong>
            {strictCriteriaDecisionLocked
              ? "Preliminary assessment and required-criteria review are in progress"
              : "Preliminary assessment is in progress"}
          </strong>
          <p>
            {strictCriteriaDecisionLocked
              ? "You can browse the current factual records while this turn completes. Search and criteria edits, candidate decisions, source expansion, and event verification are paused until the required criteria are assessed."
              : "You can keep comparing candidates, choose a shock, or start another search while this assessment is prepared."}
          </p>
        </section>
      )}

      <div className="s2-search-actions">
        <button
          data-testid="screen02-search-button"
          className="s2-primary-action"
          type="button"
          disabled={actionDisabled}
          aria-busy={
            pending !== null ||
            (semanticReviewPending && strictCriteriaDecisionLocked)
          }
          title={
            semanticReviewPending && strictCriteriaDecisionLocked
              ? "A new search can start after the preliminary assessment completes"
              : undefined
          }
          onClick={() => requestSearch("find-more")}
        >
          {semanticReviewPending && strictCriteriaDecisionLocked
            ? "Preliminary assessment in progress"
            : session.mode === "find"
            ? onRequestAiReview
              ? visibleCriteria.length > 0
                ? "Find and assess candidate shocks using these criteria"
                : "Find and assess candidate shocks"
              : visibleCriteria.length > 0
                ? "Find candidate shocks using these criteria"
                : "Find candidate shocks"
            : visibleCriteria.length > 0
              ? "Find/resolve shock matches using this guidance"
              : "Find/resolve shock matches"}
        </button>
        {currentVisibleScreen02Items(session).length > 0 && (
          <button
            className="s2-secondary-action"
            type="button"
            disabled={actionDisabled}
            onClick={() => requestSearch("none-fit")}
          >
            Search for different results
          </button>
        )}
        {aiReviewControlVisible && (
          <button
            data-testid="screen02-ai-review-button"
            className="s2-secondary-action"
            type="button"
            disabled={!aiReviewCanBeRequested}
            title={
              semanticReviewPending
                ? "The current preliminary assessment must finish before another can start"
                : undefined
            }
            onClick={() => onRequestAiReview?.()}
          >
            {semanticReviewPending
              ? "Preliminary assessment in progress"
              : semanticReviewStatus === "review-unavailable" ||
            semanticReviewStatus === "review-incomplete"
              ? "Retry preliminary assessment"
              : "Run preliminary assessment"}
          </button>
        )}
        {onExpandCoverage && coverageCanExpand && (
            <button
              data-testid="screen02-expand-coverage-button"
              className="s2-secondary-action"
              type="button"
              disabled={
                editingDisabled
              }
              title={
                semanticReviewPending && strictCriteriaDecisionLocked
                  ? "Source expansion becomes available when the current preliminary assessment finishes"
                  : undefined
              }
              onClick={onExpandCoverage}
            >
              {semanticReviewPending && strictCriteriaDecisionLocked
                ? "Source expansion available after assessment"
                : "Expand source coverage"}
            </button>
          )}
      </div>

      {onExpandCoverage && coverageCanExpand && (
        <p className="s2-coverage-expansion-note">{coverageExpansionNote}</p>
      )}

      {locked && (
        <p className="s2-locked-control-note" role="status">
          This choice is ready for event verification. Reopen the choice before
          running another search.
        </p>
      )}
      {scopeRevision && (
        <p className="s2-scope-control-note" role="status">
          Search is paused until the requested boundary change is resolved on
          Screen 1.
        </p>
      )}
    </section>
  );
}

function BoundaryFollowups({
  session,
  onBack,
}: {
  session: Screen02Session;
  onBack: () => void;
}) {
  const scopeRevision = session.interaction.pendingScopeRevision;
  const deferredQuestions = session.interaction.deferredQuestions;
  if (!scopeRevision && deferredQuestions.length === 0) return null;
  return (
    <section className="s2-followup-stack" aria-label="Recorded follow-ups">
      {scopeRevision && (
        <article className="s2-scope-revision" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <span className="s2-section-kicker">
              Screen 1 revision required
            </span>
            <h2>Resolve this boundary request before choosing a shock</h2>
            <p>{scopeRevision.reason}</p>
            <p>
              <strong>Requested change:</strong> {scopeRevision.exactRequest}
            </p>
          </div>
          <button type="button" onClick={onBack}>
            Return to Screen 1
          </button>
        </article>
      )}
      {deferredQuestions.length > 0 && (
        <details className="s2-deferred-questions">
          <summary>
            Questions preserved for later verification (
            {deferredQuestions.length})
          </summary>
          <ol>
            {deferredQuestions.map((question) => (
              <li key={question.id}>
                <strong>{question.exactRequest}</strong>
                <span>{question.reason}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function readableChannelName(channel: string) {
  const known: Record<string, string> = {
    "official-primary": "Official primary sources",
    "administrative-data": "Administrative data",
    "legal-policy": "Legislation and policy records",
    "scholarly-research": "Scholarly research",
    "credible-reporting": "Credible reporting",
  };
  return known[channel] ?? humanize(channel.replace(/\s+diagnostics$/i, ""));
}

function groupedExclusions(round: Screen02SearchRound) {
  const counts = new Map<string, number>();
  for (const exclusion of round.manifest.exclusions) {
    const label =
      exclusion.filter === "studyPeriod"
        ? "Outside the study period"
        : exclusion.filter === "geography"
          ? "Wrong geography"
          : exclusion.filter === "eventFamily"
            ? "Wrong event type"
            : exclusion.filter === "population"
              ? "Population mismatch"
              : "Invalid or unsupported record";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()];
}

function ReproducibilityRecord({
  round,
  session,
}: {
  round: Screen02SearchRound;
  session: Screen02Session;
}) {
  const itemTitles = new Map(
    session.items.map((item) => [item.id, item.title]),
  );
  const criterionTexts = new Map(
    session.interaction.preferences.criteria.map((criterion) => [
      criterion.id,
      criterion.text,
    ]),
  );
  return (
    <details className="s2-reproducibility-record">
      <summary>Search record (optional)</summary>
      <p>
        This record preserves the request, sources, searches, and exclusions
        behind the summary above.
      </p>
      <dl>
        <div>
          <dt>Exact request</dt>
          <dd>{round.exactRequest}</dd>
        </div>
        <div>
          <dt>Recorded time</dt>
          <dd>{round.retrievedAt}</dd>
        </div>
        <div>
          <dt>Search protocol</dt>
          <dd>{round.searchProtocolVersion}</dd>
        </div>
        <div>
          <dt>Retrieval formula</dt>
          <dd>{round.discovery.formulaVersion}</dd>
        </div>
        <div>
          <dt>Logged retrieval text</dt>
          <dd>{round.discovery.query || "No retrieval text recorded"}</dd>
        </div>
        <div>
          <dt>Outcome safeguard</dt>
          <dd>
            Outcome values inspected:{" "}
            {round.manifest.outcomeValuesInspected ? "Yes" : "No"}
          </dd>
        </div>
      </dl>
      <section>
        <h3>Queries</h3>
        {round.manifest.queryMatrix.length > 0 ? (
          <ul>
            {round.manifest.queryMatrix.map((query) => (
              <li key={query.id}>
                <strong>{query.purpose}</strong>
                <code>{query.query}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>No query was recorded.</p>
        )}
      </section>
      <section>
        <h3>Source channels</h3>
        <ul>
          {round.manifest.channels.map((channel, index) => (
            <li key={`${channel.channel}-${index}`}>
              <strong>
                {channel.channel} · {channel.status}
              </strong>
              <span>{channel.note}</span>
            </li>
          ))}
        </ul>
      </section>
      {Array.isArray(round.semanticDecisions) && (
        <section>
          <h3>Criteria decisions</h3>
          {round.semanticDecisions.length > 0 ? (
            <ul>
              {round.semanticDecisions.map((decision) => (
                <li key={decision.itemId}>
                  <strong>
                    {itemTitles.get(decision.itemId) ?? decision.itemId} ·{" "}
                    {humanize(decision.decision)}
                  </strong>
                  <span>{plainAssessmentText(decision.reason)}</span>
                  {decision.criterionIds.length > 0 && (
                    <span>
                      Criteria:{" "}
                      {decision.criterionIds
                        .map(
                          (criterionId) =>
                            criterionTexts.get(criterionId) ?? criterionId,
                        )
                        .join(" · ")}
                    </span>
                  )}
                  {(decision.scopeMismatchFields?.length ?? 0) > 0 && (
                    <span>
                      Locked study-boundary mismatch:{" "}
                      {(decision.scopeMismatchFields ?? [])
                        .map((field) =>
                          field === "outcomeFamily"
                            ? "Outcome family"
                            : "Industry",
                        )
                        .join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No candidate needed a separate criteria decision.</p>
          )}
        </section>
      )}
      <section>
        <h3>Result ordering record</h3>
        {round.discovery.rankings.length > 0 ? (
          <ol>
            {round.discovery.rankings.map((ranking) => (
              <li key={`${ranking.proposalId}-${ranking.stableProposalId}`}>
                <strong>
                  Rank {ranking.rank}: {ranking.proposalId}
                </strong>
                <span>
                  Stored score {ranking.rankScore.toFixed(4)} ·{" "}
                  {ranking.stableProposalId}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No ranking record was stored.</p>
        )}
      </section>
      <section>
        <h3>Exact exclusions</h3>
        {round.manifest.exclusions.length > 0 ? (
          <ul>
            {round.manifest.exclusions.map((exclusion, index) => (
              <li key={`${exclusion.proposalId}-${exclusion.filter}-${index}`}>
                <strong>{exclusion.proposalId}</strong>
                <span>{exclusion.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No exclusion was recorded.</p>
        )}
      </section>
    </details>
  );
}

function CoverageSummary({ session }: { session: Screen02Session }) {
  const round = currentRound(session);
  const searchedRound =
    round && round.requestType !== "initial" ? round : null;
  if (!searchedRound) {
    return (
      <section
        className="s2-coverage-panel s2-coverage-panel--empty"
        aria-labelledby="s2-coverage-title"
      >
        <span className="s2-coverage-icon" aria-hidden="true">
          ◎
        </span>
        <div>
          <span className="s2-section-kicker">What this search covered</span>
          <h2 id="s2-coverage-title">No search has been run yet</h2>
          <p>
            {session.mode === "find"
              ? "Run the search above to create a current candidate list and a reproducible source record."
              : "Search the exact known shock above to create an identity-evidence record and a reproducible account of the sources covered."}
          </p>
        </div>
      </section>
    );
  }

  const searchedChannels = searchedRound.manifest.channels
    .filter(
      (channel) =>
        channel.status === "searched" &&
        !/\bdiagnostics\b/i.test(channel.channel),
    )
    .map((channel) => readableChannelName(channel.channel));
  const exclusions = groupedExclusions(searchedRound);
  const limitations = [
    ...new Set(
      searchedRound.manifest.channels
        .filter(
          (channel) =>
            channel.status === "failed" ||
            channel.channel.startsWith("Coverage limitation ·") ||
            /route was not searched because/i.test(channel.note),
        )
        .map((channel) =>
          channel.note
            .replace(
              /\s*Host-assisted discovery required:\s*(?:yes|no)\.\s*$/i,
              "",
            )
            .trim(),
        )
        .filter(Boolean),
    ),
  ];
  const received = searchedRound.manifest.coverage.proposalsReceived;
  const retained = searchedRound.itemIdsRetained.length;
  const semanticDecisions = searchedRound.semanticDecisions ?? [];
  const semanticRetained = semanticDecisions.filter(
    (decision) => decision.decision === "retained",
  );
  const semanticExcluded = semanticDecisions.filter(
    (decision) => decision.decision === "excluded",
  );
  const itemTitles = new Map(
    session.items.map((item) => [item.id, item.title]),
  );

  return (
    <section
      className="s2-coverage-panel"
      aria-labelledby="s2-coverage-title"
    >
      <div className="s2-coverage-intro">
        <span className="s2-coverage-icon" aria-hidden="true">
          ◎
        </span>
        <div>
          <span className="s2-section-kicker">What this search covered</span>
          <h2 id="s2-coverage-title">Current search summary</h2>
          <p>
            {searchedChannels.length > 0
              ? `Searched ${searchedChannels.join(" and ")}. `
              : "No source channel completed successfully. "}
            ShockAudit checked {received} submitted{" "}
            {session.mode === "find" ? "candidate" : "event match"}{" "}
            {received === 1 ? "record" : "records"} and retained {retained}{" "}
            {session.mode === "find"
              ? retained === 1
                ? "candidate"
                : "candidates"
              : retained === 1
                ? "event match"
                : "event matches"}
            .
            ChatGPT may have considered additional records before returning
            this set; that total is not available here. This was a
            bounded search, not proof that {session.mode === "find"
              ? "no other shock exists"
              : "the event identity or background is complete"}.
          </p>
        </div>
      </div>
      <dl className="s2-coverage-counts">
        <div>
          <dt>
            {session.mode === "find"
              ? "Records checked"
              : "Event matches submitted"}
          </dt>
          <dd>{received}</dd>
        </div>
        <div>
          <dt>
            {session.mode === "find"
              ? "Results retained"
              : "Event matches retained"}
          </dt>
          <dd>{retained}</dd>
        </div>
        <div>
          <dt>Source records attached</dt>
          <dd>{searchedRound.manifest.coverage.uniqueSourcesLocated}</dd>
        </div>
      </dl>
      {searchedRound.stage === "ai-review" && (
        <section className="s2-semantic-coverage">
          <strong>How your criteria affected the results</strong>
          <p>
            ChatGPT assessed {semanticDecisions.length}{" "}
            {semanticDecisions.length === 1 ? "candidate" : "candidates"}:{" "}
            {semanticRetained.length} kept and {semanticExcluded.length}{" "}
            excluded. Ranking preferences affect order; only required or
            excluded conditions can remove a candidate.
          </p>
          {semanticExcluded.length > 0 && (
            <ul>
              {semanticExcluded.map((decision) => (
                <li key={decision.itemId}>
                  <strong>
                    {itemTitles.get(decision.itemId) ?? decision.itemId}
                  </strong>
                  <span>{decision.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {limitations.length > 0 && (
        <section className="s2-grouped-exclusions s2-search-limitations">
          <strong>Limits to keep in mind</strong>
          <p>
            These live-source routes were unavailable, skipped, or bounded;
            they may limit {session.mode === "find"
              ? "which shocks appear in the current result set"
              : "the identity evidence and factual background shown for this shock"}.
            {" "}Each limitation applies to the named connector or route in
            this search record; it is not a blanket statement about all
            ShockAudit source coverage.
          </p>
          <ul>
            {limitations.map((limitation) => (
              <li key={limitation}>
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {exclusions.length > 0 && (
        <section className="s2-grouped-exclusions">
          <strong>Why submitted records were excluded</strong>
          <ul>
            {exclusions.map(([label, count]) => (
              <li key={label}>
                <span>{label}</span>
                <b>{count}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ReproducibilityRecord round={searchedRound} session={session} />
    </section>
  );
}

export function logicalScreen02Searches(session: Screen02Session) {
  const nonInitialRounds = session.interaction.searchRounds.filter(
    (round) => round.requestType !== "initial",
  );
  const searches: Array<{
    nativeRound: Screen02SearchRound | null;
    resultRound: Screen02SearchRound;
  }> = [];
  for (let index = 0; index < nonInitialRounds.length; index += 1) {
    const round = nonInitialRounds[index]!;
    if (round.stage === "native-retrieval") {
      let resultRound = round;
      let nextIndex = index + 1;
      const legacyReview = nonInitialRounds[nextIndex];
      if (
        legacyReview?.stage === "ai-review" &&
        legacyReview.parentRoundId === round.id
      ) {
        resultRound = legacyReview;
        nextIndex += 1;
      }
      while (nextIndex < nonInitialRounds.length) {
        const assessment = nonInitialRounds[nextIndex]!;
        if (
          assessment.stage !== "preliminary-assessment" ||
          assessment.rootNativeRoundId !== round.id ||
          assessment.assessmentParentRoundId !== resultRound.id
        ) {
          break;
        }
        resultRound = assessment;
        nextIndex += 1;
      }
      searches.push({ nativeRound: round, resultRound });
      index = nextIndex - 1;
    } else {
      searches.push({
        nativeRound: null,
        resultRound: round,
      });
    }
  }
  return searches;
}

function PriorDecisionRecord({ session }: { session: Screen02Session }) {
  const logicalSearches = logicalScreen02Searches(session);
  const earlierSearches = logicalSearches.slice(0, -1);
  const hasHistory =
    earlierSearches.length > 0 ||
    session.interaction.rejections.length > 0 ||
    session.interaction.selectionHistory.length > 0;
  if (!hasHistory) return null;
  const itemTitles = new Map(
    session.items.map((item) => [item.id, item.title]),
  );
  return (
    <details className="s2-prior-decisions">
      <summary>Earlier searches and decisions</summary>
      {earlierSearches.length > 0 && (
        <section>
          <h3>Earlier searches</h3>
          <ol>
            {earlierSearches.map(({ resultRound: round }) => (
              <li key={round.id}>
                <strong>{humanize(round.requestType)}</strong>
                <span>{round.exactRequest}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {session.interaction.rejections.length > 0 && (
        <section>
          <h3>Removed from consideration</h3>
          <ul>
            {session.interaction.rejections.map((rejection) => (
              <li key={rejection.id}>
                <strong>
                  {itemTitles.get(rejection.itemId) ?? rejection.itemId}
                </strong>
                <span>{rejection.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {session.interaction.selectionHistory.length > 0 && (
        <section>
          <h3>Choice history</h3>
          <ol>
            {session.interaction.selectionHistory.map((entry) => (
              <li key={entry.id}>
                <strong>{humanize(entry.action)}</strong>
                <span>
                  {entry.itemId
                    ? itemTitles.get(entry.itemId) ?? entry.itemId
                    : "No active choice"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </details>
  );
}

function ChosenShock({
  session,
  chosenItem,
  interactionLocked,
  onLock,
  onUnlock,
}: {
  session: Screen02Session;
  chosenItem: Screen02Item | null;
  interactionLocked: boolean;
  onLock: () => void;
  onUnlock: (reason: string) => void;
}) {
  const locked = session.lockedChoice !== null;
  const sourceHandoffBlocked =
    chosenItem !== null && chosenItem.sourceSummary.uniqueSourceCount === 0;
  const assessmentBlocked =
    chosenItem !== null && !screen02HasCompletedAiReview(session);
  return (
    <section
      className={`s2-chosen-shock ${
        chosenItem ? "s2-chosen-shock--active" : ""
      } ${locked ? "s2-chosen-shock--ready" : ""}`}
      aria-live="polite"
    >
      <div>
        <span className="s2-section-kicker">Your decision</span>
        <h2>{session.mode === "find" ? "Chosen shock" : "Confirmed shock"}</h2>
        {chosenItem ? (
          <>
            <strong>
              {session.mode === "find"
                ? chosenItem.title
                : session.screen01Baseline.knownShock}
            </strong>
            <p>
              {locked
                ? "This choice is ready to move into formal event and timing verification."
                : sourceHandoffBlocked
                  ? session.mode === "find"
                    ? "This lead can remain tentatively chosen, but it needs at least one factual source before event verification can begin."
                    : "The event identity is tentatively confirmed, but it needs an attached factual source before event verification can begin."
                  : assessmentBlocked
                    ? "This choice is recorded. Finish the preliminary assessments for the displayed shocks before event verification begins."
                  : session.mode === "find"
                    ? "Reviewing another result will not replace this choice. Use its Choose button if you decide to change it."
                    : "The named shock is confirmed. Continue when you are ready to verify the event, timing, and treatment details."}
            </p>
          </>
        ) : (
          <p>
            {session.mode === "find" ? (
              <>
                No shock has been chosen. Review candidates above, then use
                <strong> Choose this shock</strong> when one is worth carrying
                forward.
              </>
            ) : (
              <>
                The known shock has not been confirmed. Review the possible
                match and dossier above, then use
                <strong> This is my shock</strong> when it is the event you
                intended.
              </>
            )}
          </p>
        )}
      </div>
      {chosenItem &&
        (locked ? (
          <button
            className="s2-secondary-action"
            type="button"
            disabled={interactionLocked}
            title={
              interactionLocked
                ? "Candidate decisions are paused while the preliminary assessment completes"
                : undefined
            }
            onClick={() =>
              onUnlock(
                session.mode === "find"
                  ? "The researcher reopened Screen 2 to compare or change the chosen shock."
                  : "The researcher reopened Screen 2 to reconsider the confirmed known-shock match.",
              )
            }
          >
            {session.mode === "find"
              ? "Change chosen shock"
              : "Reconsider confirmed shock"}
          </button>
        ) : (
          <button
            className="s2-primary-action"
            type="button"
            disabled={
              interactionLocked ||
              sourceHandoffBlocked ||
              assessmentBlocked
            }
            title={
              interactionLocked
                ? "Event verification is paused while the preliminary assessment completes"
                : sourceHandoffBlocked
                ? "Locate at least one factual source before event verification"
                : assessmentBlocked
                  ? "Finish the preliminary assessments before event verification"
                : undefined
            }
            onClick={onLock}
          >
            Continue: Verify the event
          </button>
        ))}
    </section>
  );
}

export default function Screen02({
  session,
  hostView,
  researchNotice = null,
  onSelect,
  onReject,
  onLock,
  onUnlock,
  onRequestSearch,
  onRequestAiReview,
  onExpandCoverage,
  onBack,
  onReset,
  onRequestFullscreen,
  initialReviewedItemId = null,
}: Screen02Props) {
  const [reviewedItemId, setReviewedItemId] = useState<string | null>(
    initialReviewedItemId,
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const copy = branchCopy[session.mode];
  const baseline = session.screen01Baseline;
  const steps = workflowSteps[session.mode];
  const visibleItems = useMemo(
    () => currentVisibleScreen02Items(session),
    [session],
  );
  const visibleIds = useMemo(
    () => new Set(visibleItems.map((item) => item.id)),
    [visibleItems],
  );
  const reviewedItem =
    visibleItems.find((item) => item.id === reviewedItemId) ?? null;
  const chosenItem =
    session.items.find((item) => item.id === session.selectedItemId) ?? null;
  const auditItem = auditWorkingItem(
    session,
    visibleItems,
    reviewedItemId,
  );
  const criteria = currentCriteria(session);
  const semanticReviewStatus = screen02SemanticReviewStatus(
    session,
    researchNotice,
  );
  const latestRound = currentRound(session);
  const isInitialEmptyState =
    session.mode === "find" &&
    (!latestRound || isInitialFindRound(session, latestRound));
  const strictCriteriaDecisionLocked =
    screen02StrictCriteriaDecisionLock(
      session,
      semanticReviewStatus,
    );
  const semanticDecisionLocked = strictCriteriaDecisionLocked;
  const assessmentTurnPending =
    semanticReviewStatus === "awaiting-review";
  const interactionLocked =
    session.interaction.pendingRequest !== null ||
    session.interaction.pendingScopeRevision !== null ||
    (assessmentTurnPending && strictCriteriaDecisionLocked);
  const screenThreeReady =
    session.lockedChoice !== null &&
    !semanticDecisionLocked &&
    !assessmentTurnPending;

  useEffect(() => {
    if (reviewedItemId && !visibleIds.has(reviewedItemId)) {
      setReviewedItemId(null);
    }
  }, [reviewedItemId, visibleIds]);

  useEffect(() => {
    if (!resetDialogOpen) return;
    globalThis.requestAnimationFrame?.(() =>
      resetCancelRef.current?.focus(),
    );
  }, [resetDialogOpen]);

  function closeResetDialog() {
    setResetDialogOpen(false);
    globalThis.requestAnimationFrame?.(() =>
      resetTriggerRef.current?.focus(),
    );
  }

  function confirmReset() {
    setReviewedItemId(null);
    setResetDialogOpen(false);
    onReset();
  }

  function trapResetDialogFocus(
    event: ReactKeyboardEvent<HTMLElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeResetDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <main className="s2-shell" data-testid="screen02-workspace">
      <header className="s2-app-header">
        <div className="s2-brand-lockup" aria-label="ShockAudit">
          <span className="s2-brand-waves" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="s2-brand-name">ShockAudit</span>
          <span className="s2-brand-descriptor">
            Natural experiment design workspace
          </span>
        </div>
        <div className="s2-header-actions">
          <button
            ref={resetTriggerRef}
            className="s2-reset-button"
            type="button"
            onClick={() => setResetDialogOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={resetDialogOpen}
            title={
              session.mode === "find"
                ? "Clear Screen 2 and return to a blank search without changing Screen 1"
                : "Clear the known-shock search and assessment without changing Screen 1"
            }
          >
            <span className="s2-reset-label-long">Reset Screen 2</span>
            <span className="s2-reset-label-short" aria-hidden="true">
              Reset
            </span>
          </button>
          {hostView.canFullscreen &&
            hostView.displayMode !== "fullscreen" && (
              <button
                className="s2-fullscreen-button"
                type="button"
                onClick={() => void onRequestFullscreen()}
                aria-label="Open ShockAudit fullscreen"
              >
                <span className="s2-fullscreen-label-long">Fullscreen</span>
                <span className="s2-fullscreen-label-short" aria-hidden="true">
                  ⛶
                </span>
              </button>
            )}
          <a
            className="s2-version-badge"
            href={`https://github.com/AINP-Research/ShockAudit/commit/${__SHOCKAUDIT_COMMIT__}`}
            target="_blank"
            rel="noreferrer"
            title="Open this exact source-code version on GitHub"
          >
            <span className="s2-version-label-long">
              v{__SHOCKAUDIT_VERSION__} ·{" "}
            </span>
            {__SHOCKAUDIT_COMMIT__}
          </a>
        </div>
      </header>

      <div
        className="s2-reset-backdrop"
        role="presentation"
        hidden={!resetDialogOpen}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeResetDialog();
        }}
      >
        <section
          className="s2-reset-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="s2-reset-dialog-title"
          aria-describedby="s2-reset-dialog-description"
          onKeyDown={trapResetDialogFocus}
        >
          <span className="s2-section-kicker">Keep Screen 1 unchanged</span>
          <h2 id="s2-reset-dialog-title">Reset Screen 2?</h2>
          <p id="s2-reset-dialog-description">
            {session.mode === "find"
              ? "This clears Screen 2 criteria, current results, prior decisions, the reviewed candidate, and the chosen shock. It returns Screen 2 to a blank search state while preserving the confirmed Screen 1 study boundary exactly."
              : "This clears the Screen 2 source search, possible matches, assessment, and confirmation decision. The exact known-shock name and confirmed Screen 1 study boundary remain unchanged."}
          </p>
          <div className="s2-reset-dialog-actions">
            <button
              ref={resetCancelRef}
              className="s2-secondary-action"
              type="button"
              onClick={closeResetDialog}
            >
              Cancel
            </button>
            <button
              className="s2-danger-action"
              type="button"
              onClick={confirmReset}
            >
              Reset Screen 2
            </button>
          </div>
        </section>
      </div>

      <div className="s2-workspace-body">
        <aside className="s2-progress-rail" aria-label="ShockAudit workflow">
          <ol>
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const completed = stepNumber === 1;
              const active = stepNumber === 2;
              const unlocked = stepNumber === 3 && screenThreeReady;
              return (
                <li
                  className={[
                    completed ? "s2-step--completed" : "",
                    active ? "s2-step--active" : "",
                    unlocked ? "s2-step--unlocked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={step}
                >
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-disabled={!active && !completed}
                    aria-label={`Step ${stepNumber}: ${step}${
                      completed
                        ? ", complete"
                        : unlocked
                          ? ", ready"
                          : active
                            ? ", current"
                            : ""
                    }`}
                    onClick={completed ? onBack : undefined}
                    tabIndex={completed || active ? 0 : -1}
                  >
                    <span className="s2-step-number" aria-hidden="true">
                      {completed ? "✓" : stepNumber}
                    </span>
                    <span className="s2-step-label">{step}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="s2-main-workspace">
          <div className="s2-mobile-progress" aria-label="Workflow progress">
            <button type="button" onClick={onBack}>
              <span aria-hidden="true">←</span>
              Screen 1
            </button>
            <span>Step 2 of 8</span>
            <strong>
              {screenThreeReady
                ? "Ready to verify the event"
                : session.mode === "find"
                  ? "Choose a shock"
                  : "Confirm the known shock"}
            </strong>
          </div>

          <header className="s2-title-block">
            <span>{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
            {researchNotice && (
              <p
                data-testid="screen02-research-notice"
                className={`s2-research-notice s2-research-notice--${researchNotice.status}`}
                role={researchNotice.status === "error" ? "alert" : "status"}
              >
                {researchNotice.message}
              </p>
            )}
          </header>

          <section
            className="s2-baseline-strip"
            aria-labelledby="s2-baseline-title"
          >
            <span className="s2-lock-mark" aria-hidden="true">
              <i />
            </span>
            <div className="s2-baseline-copy">
              <span className="s2-baseline-heading">
                <span>
                  <strong id="s2-baseline-title">
                    Confirmed Screen 1 study boundary
                  </strong>
                  <small>
                    Read-only here. Return to Screen 1 if the research boundary
                    needs to change.
                  </small>
                </span>
              </span>
              <p>{baseline.studySentence}</p>
              {session.mode === "audit" && baseline.knownShock && (
                <div className="s2-known-shock">
                  <span>Exact known shock</span>
                  <strong>{baseline.knownShock}</strong>
                </div>
              )}
              <dl>
                <div>
                  <dt>Population</dt>
                  <dd>{baseline.scopeContract.population}</dd>
                </div>
                <div>
                  <dt>Geography</dt>
                  <dd>{baseline.scopeContract.geography}</dd>
                </div>
                <div>
                  <dt>Study period</dt>
                  <dd>{baseline.scopeContract.studyPeriod}</dd>
                </div>
                <div>
                  <dt>Event family</dt>
                  <dd>{baseline.scopeContract.eventFamily}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>{baseline.scopeContract.outcomeFamily}</dd>
                </div>
              </dl>
            </div>
          </section>

          <BoundaryFollowups session={session} onBack={onBack} />
          {session.mode === "find" ? (
            <>
              <CriteriaWorkspace
                key={session.runId}
                session={session}
                semanticReviewStatus={semanticReviewStatus}
                onRequestSearch={onRequestSearch}
                onRequestAiReview={onRequestAiReview}
                onExpandCoverage={onExpandCoverage}
              />
              <CoverageSummary session={session} />

              <section
                data-testid="screen02-results"
                className="s2-candidate-section"
                aria-labelledby="s2-candidates-title"
              >
                <div className="s2-collection-heading">
                  <div>
                    <span className="s2-section-kicker">
                      Current result set · {visibleItems.length}{" "}
                      {visibleItems.length === 1 ? "result" : "results"}
                    </span>
                    <h2 id="s2-candidates-title">{copy.collectionTitle}</h2>
                    <p>{copy.collectionDescription}</p>
                  </div>
                  <div className="s2-selection-note">
                    <span aria-hidden="true">i</span>
                    Reviewing is not choosing. Open several results before
                    deciding which shock to carry forward.
                  </div>
                </div>

                <div className="s2-results-workspace">
                  <section
                    className="s2-result-list-panel"
                    aria-label={copy.collectionTitle}
                  >
                    {visibleItems.length > 0 ? (
                      <ol className="s2-result-list">
                        {visibleItems.map((item) => (
                          <CandidateResultRow
                            key={item.id}
                            item={item}
                            reviewed={item.id === reviewedItemId}
                            chosen={item.id === session.selectedItemId}
                            locked={item.id === session.lockedChoice?.itemId}
                            semanticReviewStatus={semanticReviewStatus}
                            semanticDecision={currentSemanticDecision(
                              session,
                              item.id,
                            )}
                            industry={baseline.scopeContract.industry}
                            outcomeFamily={baseline.scopeContract.outcomeFamily}
                            studyPopulation={baseline.scopeContract.population}
                            onReview={() => setReviewedItemId(item.id)}
                            assessmentNeedsRetry={
                              preliminaryAssessmentNeedsRetry(session, item)
                            }
                            retryDisabled={
                              interactionLocked || semanticDecisionLocked
                            }
                            onRetryAssessment={
                              onRequestAiReview
                                ? () => onRequestAiReview([item.id])
                                : undefined
                            }
                          />
                        ))}
                      </ol>
                    ) : (
                      <div className="s2-empty-state" role="status">
                        <span aria-hidden="true">⌕</span>
                        <strong>
                          {isInitialEmptyState
                            ? copy.emptyMessage
                            : semanticReviewStatus === "awaiting-review"
                              ? "No candidate has been retained yet."
                              : "No candidate shocks were retained in this search."}
                        </strong>
                        <p>
                          {isInitialEmptyState
                            ? `Add criteria only if useful, then run ${
                                onRequestAiReview
                                  ? "Find and assess candidate shocks"
                                  : "Find candidate shocks"
                              }. Blank criteria are valid.`
                            : semanticReviewStatus === "awaiting-review"
                              ? "The current AI review is still in progress. Results will appear here only after they pass the current search."
                              : "This bounded search found no eligible result. Review the coverage and criteria, then revise the fields or run another search; this does not prove that no suitable shock exists."}
                        </p>
                      </div>
                    )}
                  </section>

                  <CandidateDetail
                    session={session}
                    item={reviewedItem}
                    criteria={criteria}
                    semanticReviewStatus={semanticReviewStatus}
                    interactionLocked={interactionLocked}
                    semanticDecisionLocked={semanticDecisionLocked}
                    strictCriteriaDecisionLocked={
                      strictCriteriaDecisionLocked
                    }
                    onRequestAiReview={onRequestAiReview}
                    onChoose={onSelect}
                    onReject={onReject}
                  />
                </div>
              </section>
            </>
          ) : (
            <>
              <AuditSearchWorkspace
                key={session.runId}
                session={session}
                semanticReviewStatus={semanticReviewStatus}
                onRequestSearch={onRequestSearch}
                onRequestAiReview={onRequestAiReview}
                onExpandCoverage={onExpandCoverage}
                onBack={onBack}
              />
              <AuditIdentityPanel
                session={session}
                items={visibleItems}
                activeItemId={auditItem?.id ?? null}
                onReview={setReviewedItemId}
              />
              <CoverageSummary session={session} />
              <section
                data-testid="screen02-results"
                className="s2-candidate-section s2-audit-dossier-section"
                aria-labelledby="s2-audit-assessment-title"
              >
                <div className="s2-collection-heading">
                  <div>
                    <span className="s2-section-kicker">
                      Factual background and early assessment
                    </span>
                    <h2 id="s2-audit-assessment-title">
                      {copy.collectionTitle}
                    </h2>
                    <p>{copy.collectionDescription}</p>
                  </div>
                  <div className="s2-selection-note">
                    <span aria-hidden="true">i</span>
                    Confirming the event identity does not verify its timing,
                    eligibility rule, exposure, or causal validity.
                  </div>
                </div>
                <AuditDossier
                  session={session}
                  item={auditItem}
                  semanticReviewStatus={semanticReviewStatus}
                  interactionLocked={interactionLocked}
                  semanticDecisionLocked={semanticDecisionLocked}
                  onRequestAiReview={onRequestAiReview}
                  onConfirm={onSelect}
                />
              </section>
            </>
          )}

          <PriorDecisionRecord session={session} />
          <ChosenShock
            session={session}
            chosenItem={chosenItem}
            interactionLocked={
              interactionLocked ||
              semanticDecisionLocked
            }
            onLock={onLock}
            onUnlock={onUnlock}
          />
        </section>
      </div>
    </main>
  );
}
