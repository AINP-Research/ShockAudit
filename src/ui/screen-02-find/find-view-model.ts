import {
  deriveScreen02FindRelatedDiscoveryLinks,
} from "../../core/screen02-find-workflow";
import {
  screen02FindCandidateGate,
  screen02FindCandidateSelectionGate,
} from "../../core/screen02-workflow-state";
import type {
  Screen02AssessmentRequest,
  Screen02Criterion,
  Screen02CriterionFinding,
  Screen02FindCandidateAssessment,
  Screen02FindCandidateSnapshot,
  Screen02FindRelatedDiscoveryLink,
  Screen02FindState,
  Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";

export type Screen02FindCriterionView = {
  criterion: Screen02Criterion;
  finding: Screen02CriterionFinding | null;
};

export type Screen02FindCandidateView = {
  candidate: Screen02FindCandidateSnapshot;
  sources: Screen02WorkflowSource[];
  relatedDiscoveryLinks: Screen02FindRelatedDiscoveryLink[];
  assessment: Screen02FindCandidateAssessment | null;
  assessmentRequest: Screen02AssessmentRequest | null;
  criteria: Screen02FindCriterionView[];
  gate: {
    eligible: boolean;
    reasons: string[];
    visibleReason: string | null;
  };
  selectionGate: {
    eligible: boolean;
    reasons: string[];
    visibleReason: string | null;
  };
  displayGroup: "comparison" | "excluded" | "unassessed-lead";
  rank: number | null;
  orderingReason: string;
  opened: boolean;
  selected: boolean;
};

export type Screen02FindWorkspaceStatus =
  | "blank"
  | "facts-ready"
  | "partial"
  | "ready"
  | "ready-with-unassessed-leads"
  | "incomplete"
  | "no-suitable-candidate";

export type Screen02FindViewModel = {
  activeSet: Screen02FindState["candidateSets"][number] | null;
  criteria: Screen02Criterion[];
  comparison: Screen02FindCandidateView[];
  bestMatches: Screen02FindCandidateView[];
  broaderMatches: Screen02FindCandidateView[];
  excluded: Screen02FindCandidateView[];
  unassessedLeads: Screen02FindCandidateView[];
  opened: Screen02FindCandidateView | null;
  selected: Screen02FindCandidateView | null;
  status: Screen02FindWorkspaceStatus;
  assessmentCounts: {
    ready: number;
    total: number;
    pending: number;
  };
};

export type Screen02FindCoverageSummary = {
  incomplete: boolean;
  failedRouteCount: number;
  retrievalFailureCount: number;
  stoppingRuleNotMet: boolean;
};

export type Screen02FindTerminalNotice = {
  status: "info" | "success" | "warning" | "error";
  message: string;
};

function activeCandidateSet(state: Screen02FindState) {
  return (
    state.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
    ) ?? null
  );
}

export function screen02FindCoverageSummary(
  state: Screen02FindState,
): Screen02FindCoverageSummary {
  const activeSet = activeCandidateSet(state);
  const failedRouteCount = activeSet?.manifest.channels.filter(
    (channel) => channel.status === "failed",
  ).length ?? 0;
  const retrievalFailureCount =
    activeSet?.manifest.funnel?.retrievalFailures ?? 0;
  const stoppingRuleNotMet = activeSet?.manifest.stoppingRule.status === "not-met";
  return {
    incomplete:
      failedRouteCount > 0 || retrievalFailureCount > 0 || stoppingRuleNotMet,
    failedRouteCount,
    retrievalFailureCount,
    stoppingRuleNotMet,
  };
}

function incompleteCoverageDetail(
  coverage: Screen02FindCoverageSummary,
) {
  const details: string[] = [];
  if (coverage.failedRouteCount > 0) {
    details.push(
      `${coverage.failedRouteCount} source route${
        coverage.failedRouteCount === 1 ? "" : "s"
      } failed`,
    );
  }
  if (coverage.retrievalFailureCount > 0) {
    details.push(
      `${coverage.retrievalFailureCount} deeper retrieval attempt${
        coverage.retrievalFailureCount === 1 ? "" : "s"
      } failed`,
    );
  }
  if (
    coverage.stoppingRuleNotMet &&
    coverage.failedRouteCount === 0 &&
    coverage.retrievalFailureCount === 0
  ) {
    details.push("the recorded stopping rule was not met");
  }
  return details.join("; ");
}

/**
 * Derive the terminal banner from the committed search result rather than
 * treating successful delivery as proof of successful or complete coverage.
 */
export function screen02FindTerminalNotice(
  state: Screen02FindState,
): Screen02FindTerminalNotice {
  const view = buildScreen02FindViewModel(state);
  if (!view.activeSet) {
    return {
      status: "error",
      message:
        "The source search did not produce a complete result. Your criteria remain available; retry the search.",
    };
  }
  const coverage = screen02FindCoverageSummary(state);
  if (coverage.incomplete) {
    const detail = incompleteCoverageDetail(coverage);
    return {
      status: "warning",
      message: view.comparison.length > 0
        ? `Source-backed candidates are available, but source coverage is incomplete: ${detail}. Review the visible candidates and coverage record before deciding whether to search again.`
        : `The search is incomplete: ${detail}. This run cannot support a complete no-match conclusion; review the coverage record and retry or revise the search.`,
    };
  }
  if (view.comparison.length === 0) {
    return {
      status: "info",
      message:
        "The bounded source search completed with no qualified candidates. This does not prove that no suitable event exists; review the coverage record and documented exclusions, revise the guidance, or search more widely.",
    };
  }
  return {
    status: "success",
    message:
      "Source-backed candidates are ready. Review them or search more widely.",
  };
}

function criteriaForSet(
  state: Screen02FindState,
  set: Screen02FindState["candidateSets"][number] | null,
) {
  if (!set) return [];
  const byVersion = new Map(
    state.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  return set.criterionVersionRefs.flatMap((reference) => {
    const criterion = byVersion.get(
      `${reference.criterionId}:${reference.version}`,
    );
    return criterion?.status === "active" ? [criterion] : [];
  });
}

function latestAssessment(
  state: Screen02FindState,
  candidateSnapshotId: string,
) {
  const requestIds = new Set(
    state.assessmentRequests
      .filter(
        (request) =>
          request.target.mode === "find-candidate" &&
          request.target.candidateSnapshotId === candidateSnapshotId,
      )
      .map((request) => request.requestId),
  );
  return (
    [...state.assessments]
      .filter(
        (assessment) =>
          assessment.candidateSnapshotId === candidateSnapshotId &&
          requestIds.has(assessment.requestId),
      )
      .sort((left, right) =>
        right.recordedAt.localeCompare(left.recordedAt),
      )[0] ?? null
  );
}

function latestCandidateRequest(
  state: Screen02FindState,
  candidateSnapshotId: string,
) {
  return (
    [...state.assessmentRequests]
      .filter(
        (request) =>
          request.target.mode === "find-candidate" &&
          request.target.candidateSnapshotId === candidateSnapshotId,
      )
      .sort(
        (left, right) =>
          right.attempt - left.attempt ||
          right.updatedAt.localeCompare(left.updatedAt),
      )[0] ?? null
  );
}

function findingFor(
  state: Screen02FindState,
  candidateSnapshotId: string,
  criterion: Screen02Criterion,
) {
  return (
    state.criterionFindings.find(
      (finding) =>
        finding.candidateSnapshotId === candidateSnapshotId &&
        finding.criterionId === criterion.criterionId &&
        finding.criterionVersion === criterion.version,
    ) ?? null
  );
}

function excludedByCriterion(
  criteria: readonly Screen02FindCriterionView[],
) {
  return criteria.some(({ criterion, finding }) => {
    if (finding?.overrides.at(-1)?.resultingEligibility === "eligible") {
      return false;
    }
    return (
      (criterion.kind === "only-include" &&
        finding?.result === "does-not-meet") ||
      (criterion.kind === "do-not-show" &&
        finding?.result === "violates")
    );
  });
}

function removedFromComparison(
  state: Screen02FindState,
  candidateSnapshotId: string,
) {
  return state.decision.history.some(
    (decision) =>
      decision.candidateSnapshotId === candidateSnapshotId &&
      decision.action === "removed",
  );
}

function isUnassessedLead(
  candidate: Screen02FindCandidateSnapshot,
  request: Screen02AssessmentRequest | null,
) {
  return (
    candidate.origin === "unsupported-lead" ||
    request?.status === "retry-exhausted"
  );
}

function criterionRankBoost(criteria: readonly Screen02FindCriterionView[]) {
  return criteria.filter(
    ({ criterion, finding }) =>
      criterion.kind === "rank-higher" && finding?.result === "meets",
  ).length;
}

function sourceStrength(sources: readonly Screen02WorkflowSource[]) {
  return {
    strongestTier: Math.min(
      ...sources.map((source) => source.authorityTier),
      7,
    ),
    count: sources.length,
  };
}

function visibleGateReason(reasons: readonly string[]) {
  if (reasons.length === 0) return null;
  if (reasons.some((reason) => /assessment is not completed/i.test(reason))) {
    return "Continue becomes available after this candidate’s assessment is ready.";
  }
  if (reasons.some((reason) => /strict criterion/i.test(reason))) {
    return "Resolve or document an allowed override for each unclear required criterion before continuing.";
  }
  if (reasons.some((reason) => /no attached source/i.test(reason))) {
    return "At least one source-backed factual record is required before choosing.";
  }
  if (reasons.some((reason) => /active search snapshot/i.test(reason))) {
    return "This candidate is no longer part of the active search.";
  }
  return "This candidate is not yet eligible to choose.";
}

function visibleSelectionGateReason(reasons: readonly string[]) {
  if (reasons.length === 0) return null;
  if (reasons.some((reason) => /still running/i.test(reason))) {
    return "Choose becomes available when this candidate’s assessment and required criteria finish. The card remains available to review while the assessment is in progress.";
  }
  return visibleGateReason(reasons);
}

function deriveStatus(
  state: Screen02FindState,
  rows: readonly Screen02FindCandidateView[],
  comparison: readonly Screen02FindCandidateView[],
  unassessed: readonly Screen02FindCandidateView[],
): Screen02FindWorkspaceStatus {
  if (!state.activeCandidateSetSnapshotId) return "blank";
  if (comparison.length === 0) {
    return screen02FindCoverageSummary(state).incomplete
      ? "incomplete"
      : "no-suitable-candidate";
  }
  const requests = rows
    .map((row) => row.assessmentRequest)
    .filter((request): request is Screen02AssessmentRequest => request !== null);
  const active = requests.some((request) =>
    [
      "prepared",
      "message-delivered",
      "draft-received",
      "validating",
    ].includes(request.status),
  );
  const partial = requests.some((request) => request.status === "partial");
  const completedCount = comparison.filter(
    (row) =>
      row.candidate.qualification?.eligible === true ||
      row.assessment?.status === "completed",
  ).length;
  if ((active || requests.length === 0) && completedCount === 0) {
    return "facts-ready";
  }
  if (active || partial || completedCount < comparison.length) return "partial";
  return unassessed.length > 0 ? "ready-with-unassessed-leads" : "ready";
}

export function buildScreen02FindViewModel(
  state: Screen02FindState,
): Screen02FindViewModel {
  const set = activeCandidateSet(state);
  const criteria = criteriaForSet(state, set);
  if (!set) {
    return {
      activeSet: null,
      criteria: [],
      comparison: [],
      bestMatches: [],
      broaderMatches: [],
      excluded: [],
      unassessedLeads: [],
      opened: null,
      selected: null,
      status: "blank",
      assessmentCounts: { ready: 0, total: 0, pending: 0 },
    };
  }

  const candidates = new Map(
    state.candidates.map((candidate) => [
      candidate.candidateSnapshotId,
      candidate,
    ]),
  );
  const sources = new Map(state.sources.map((source) => [source.id, source]));
  const rows: Screen02FindCandidateView[] = set.candidateSnapshotIds.flatMap(
    (candidateSnapshotId) => {
      const candidate = candidates.get(candidateSnapshotId);
      if (!candidate) return [];
      const candidateSources = candidate.sourceIds.flatMap((sourceId) => {
        const source = sources.get(sourceId);
        return source ? [source] : [];
      });
      const candidateCriteria = criteria.map((criterion) => ({
        criterion,
        finding: findingFor(state, candidateSnapshotId, criterion),
      }));
      const assessmentRequest = latestCandidateRequest(
        state,
        candidateSnapshotId,
      );
      const coreGate = screen02FindCandidateGate(
        state,
        candidateSnapshotId,
      );
      const selectionGate = screen02FindCandidateSelectionGate(
        state,
        candidateSnapshotId,
      );
      const displayGroup =
        removedFromComparison(state, candidateSnapshotId) ||
        excludedByCriterion(candidateCriteria)
          ? "excluded"
          : isUnassessedLead(candidate, assessmentRequest)
            ? "unassessed-lead"
            : "comparison";
      return [
        {
          candidate,
          sources: candidateSources,
          relatedDiscoveryLinks:
            deriveScreen02FindRelatedDiscoveryLinks(candidate),
          assessment: latestAssessment(state, candidateSnapshotId),
          assessmentRequest,
          criteria: candidateCriteria,
          gate: {
            eligible: coreGate.eligible,
            reasons: [...coreGate.reasons],
            visibleReason: visibleGateReason(coreGate.reasons),
          },
          selectionGate: {
            eligible: selectionGate.eligible,
            reasons: [...selectionGate.reasons],
            visibleReason: visibleSelectionGateReason(selectionGate.reasons),
          },
          displayGroup,
          rank: null,
          orderingReason: "",
          opened:
            state.decision.openedCandidateSnapshotId === candidateSnapshotId,
          selected:
            state.decision.tentativeSelectionSnapshotId ===
            candidateSnapshotId,
        },
      ];
    },
  );

  const compareQualifiedRows = (
    left: Screen02FindCandidateView,
    right: Screen02FindCandidateView,
  ) => {
    const leftStrength = sourceStrength(left.sources);
    const rightStrength = sourceStrength(right.sources);
    const leftQualificationRank =
      left.candidate.qualification?.ranking.rank ?? Number.MAX_SAFE_INTEGER;
    const rightQualificationRank =
      right.candidate.qualification?.ranking.rank ?? Number.MAX_SAFE_INTEGER;
    return (
      criterionRankBoost(right.criteria) -
        criterionRankBoost(left.criteria) ||
      leftQualificationRank - rightQualificationRank ||
      (right.candidate.qualification?.ranking.totalScore ?? -1) -
        (left.candidate.qualification?.ranking.totalScore ?? -1) ||
      leftStrength.strongestTier - rightStrength.strongestTier ||
      rightStrength.count - leftStrength.count ||
      left.candidate.identity.canonicalTitle.localeCompare(
        right.candidate.identity.canonicalTitle,
      ) ||
      left.candidate.candidateSnapshotId.localeCompare(
        right.candidate.candidateSnapshotId,
      )
    );
  };
  const comparisonRows = rows.filter(
    (row) => row.displayGroup === "comparison",
  );
  const bestMatches = comparisonRows
    .filter(
      (row) => row.candidate.qualification?.section !== "broader",
    )
    .sort(compareQualifiedRows);
  const broaderMatches = comparisonRows
    .filter(
      (row) => row.candidate.qualification?.section === "broader",
    )
    .sort(compareQualifiedRows);
  const comparison = [...bestMatches, ...broaderMatches];
  /*
   * Legacy candidates without a v0.4.03 trace remain in the best-match
   * section so historical conversations restore without requalification.
   */
  comparison
    .sort((left, right) => {
      return (
        (left.candidate.qualification?.section === "broader" ? 1 : 0) -
          (right.candidate.qualification?.section === "broader" ? 1 : 0) ||
        compareQualifiedRows(left, right)
      );
    });
  comparison.forEach((row, index) => {
    row.rank = index + 1;
    row.orderingReason =
      row.candidate.qualification?.ranking.explanation ??
      "Historical candidate ordered by any met Rank higher criteria, source authority, source count, and stable title and record tie-breakers.";
  });
  const excluded = rows.filter((row) => row.displayGroup === "excluded");
  const unassessedLeads = rows.filter(
    (row) => row.displayGroup === "unassessed-lead",
  );
  const opened =
    rows.find((row) => row.opened && row.displayGroup !== "excluded") ??
    comparison[0] ??
    unassessedLeads[0] ??
    null;
  const selected =
    rows.find(
      (row) =>
        row.candidate.candidateSnapshotId ===
        state.decision.tentativeSelectionSnapshotId,
    ) ?? null;
  const counted = [...comparison, ...unassessedLeads].filter(
    (row) =>
      row.assessmentRequest !== null || !row.candidate.qualification,
  );
  const ready = counted.filter(
    (row) => row.assessment?.status === "completed",
  ).length;

  return {
    activeSet: set,
    criteria,
    comparison,
    bestMatches,
    broaderMatches,
    excluded,
    unassessedLeads,
    opened,
    selected,
    status: deriveStatus(state, rows, comparison, unassessedLeads),
    assessmentCounts: {
      ready,
      total: counted.length,
      pending: Math.max(0, counted.length - ready),
    },
  };
}
