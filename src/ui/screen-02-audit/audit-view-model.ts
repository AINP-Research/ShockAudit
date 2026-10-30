import { screen02AuditContinuationGate } from "../../core/screen02-workflow-state";
import type {
  Screen02AssessmentRequest,
  Screen02AuditAssessment,
  Screen02AuditDossier,
  Screen02AuditPossibleMatch,
  Screen02AuditState,
  Screen02ConfirmedIdentity,
  Screen02IdentityDecision,
  Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";

export type Screen02AuditPhase =
  | "identify"
  | "understand"
  | "confirm-or-correct"
  | "assess";

export type Screen02AuditMatchDisposition =
  | "rejected"
  | "related-version"
  | null;

export type Screen02AuditMatchView = {
  match: Screen02AuditPossibleMatch;
  sources: Screen02WorkflowSource[];
  dossier: Screen02AuditDossier | null;
  dossierRequest: Screen02AssessmentRequest | null;
  decisions: Screen02IdentityDecision[];
  disposition: Screen02AuditMatchDisposition;
  currentNoMatchDecision: Screen02IdentityDecision | null;
  opened: boolean;
  confirmed: boolean;
  confirmationGate: {
    eligible: boolean;
    reasons: string[];
    visibleReason: string | null;
  };
};

export type Screen02AuditViewModel = {
  activeMatchSet: Screen02AuditState["matchSets"][number] | null;
  activeAnchor: Screen02AuditState["anchor"]["revisions"][number];
  matches: Screen02AuditMatchView[];
  opened: Screen02AuditMatchView | null;
  confirmed: Screen02AuditMatchView | null;
  confirmedIdentity: Screen02ConfirmedIdentity | null;
  assessment: Screen02AuditAssessment | null;
  assessmentRequest: Screen02AssessmentRequest | null;
  phase: Screen02AuditPhase;
  noMatch: boolean;
  currentNoMatchDecision: Screen02IdentityDecision | null;
  continuationGate: {
    eligible: boolean;
    reasons: string[];
    visibleReason: string | null;
  };
  alreadyContinued: boolean;
};

const retryableStatuses = new Set([
  "delivery-rejected",
  "no-tool-submission",
  "validation-failed",
  "timed-out",
]);

export function isRetryableAuditRequest(
  request: Screen02AssessmentRequest | null,
) {
  return Boolean(
    request &&
      ((request.status === "delivery-rejected" &&
        request.lifecycle.filter((event) => event.status === "prepared").length < 3) ||
        (request.status !== "delivery-rejected" && retryableStatuses.has(request.status) && request.attempt < 3) ||
        (request.status === "partial" && request.attempt < 3)),
  );
}

function activeMatchSet(state: Screen02AuditState) {
  return (
    state.matchSets.find(
      (matchSet) =>
        matchSet.matchSetSnapshotId === state.activeMatchSetSnapshotId &&
        matchSet.status === "active",
    ) ?? null
  );
}

function currentSetNoMatchDecision(
  state: Screen02AuditState,
  set: Screen02AuditViewModel["activeMatchSet"],
) {
  if (!set) return null;
  return (
    state.identityDecisions.findLast(
      (decision) =>
        decision.action === "no-match" &&
        decision.anchorRevisionId === set.anchorRevisionId &&
        Date.parse(decision.at) >= Date.parse(set.manifest.retrievedAt),
    ) ?? null
  );
}

function latestRequest(
  state: Screen02AuditState,
  predicate: (request: Screen02AssessmentRequest) => boolean,
) {
  return (
    [...state.assessmentRequests]
      .filter(predicate)
      .sort(
        (left, right) =>
          right.attempt - left.attempt ||
          right.updatedAt.localeCompare(left.updatedAt),
      )[0] ?? null
  );
}

function dossierForMatch(
  state: Screen02AuditState,
  match: Screen02AuditPossibleMatch,
) {
  return (
    [...state.dossiers]
      .filter(
        (dossier) =>
          dossier.identitySnapshotId === match.identitySnapshotId,
      )
      .sort((left, right) =>
        right.recordedAt.localeCompare(left.recordedAt),
      )[0] ?? null
  );
}

function dossierRequestForMatch(
  state: Screen02AuditState,
  match: Screen02AuditPossibleMatch,
) {
  return latestRequest(
    state,
    (request) =>
      request.target.mode === "audit-dossier" &&
      request.target.matchSnapshotId === match.matchSnapshotId &&
      request.target.identitySnapshotId === match.identitySnapshotId,
  );
}

function confirmationReasons(
  match: Screen02AuditPossibleMatch,
  sources: readonly Screen02WorkflowSource[],
  dossier: Screen02AuditDossier | null,
  decisions: readonly Screen02IdentityDecision[],
  noMatchDecision: Screen02IdentityDecision | null,
) {
  const reasons: string[] = [];
  if (noMatchDecision) {
    reasons.push("The researcher recorded no match for this search snapshot.");
  }
  const latestDecision = decisions.at(-1);
  if (latestDecision?.action === "rejected") {
    reasons.push("The possible match was rejected by the researcher.");
  }
  if (latestDecision?.action === "related-version") {
    reasons.push("The possible match was marked as a related version.");
  }
  if (match.relationship === "uncertain") {
    reasons.push("The relationship to the search anchor is uncertain.");
  }
  if (sources.length === 0 || match.sourceIds.length === 0) {
    reasons.push("The possible match has no attached source.");
  }
  if (!dossier || dossier.status !== "completed") {
    reasons.push("The match-specific provisional dossier is not completed.");
  }
  if (!dossier?.sourceIds.length) {
    reasons.push("The dossier has no attached source.");
  }
  if (!dossier?.atAGlance.length) {
    reasons.push("The dossier has no at-a-glance identity claim.");
  }
  if (!dossier?.whatHappened?.sourceIds.length) {
    reasons.push("The dossier has no source-backed explanation of what happened.");
  }
  if (!dossier?.unresolvedFacts.length) {
    reasons.push("The dossier does not state its unresolved facts.");
  }
  return reasons;
}

function latestMatchDisposition(
  decisions: readonly Screen02IdentityDecision[],
): Screen02AuditMatchDisposition {
  const action = decisions.at(-1)?.action;
  return action === "rejected" || action === "related-version"
    ? action
    : null;
}

const versionAlternativeRelationships = new Set([
  "original",
  "amendment",
  "implementing-rule",
  "enforcement-action",
]);

function matchOrderRank(
  row: Screen02AuditMatchView,
  prioritizeVersionAlternatives: boolean,
) {
  if (row.disposition) return 2;
  if (
    prioritizeVersionAlternatives &&
    versionAlternativeRelationships.has(row.match.relationship)
  ) {
    return 0;
  }
  return 1;
}

function visibleConfirmationReason(
  reasons: readonly string[],
  noMatchDecision: Screen02IdentityDecision | null,
) {
  if (reasons.length === 0) return null;
  if (noMatchDecision) {
    return `No match was recorded for this search snapshot. Recorded reason: ${noMatchDecision.reason}`;
  }
  if (reasons.some((reason) => /was rejected/i.test(reason))) {
    return "This possible match was rejected. Revise the anchor or choose another active match.";
  }
  if (reasons.some((reason) => /related version/i.test(reason))) {
    return "This record was marked as a related version. Choose the intended version before confirmation.";
  }
  if (reasons.some((reason) => /relationship.*uncertain/i.test(reason))) {
    return "The relationship to the search anchor remains uncertain.";
  }
  if (reasons.some((reason) => /dossier is not completed/i.test(reason))) {
    return "Confirm becomes available after the match-specific dossier is complete.";
  }
  if (reasons.some((reason) => /unresolved facts/i.test(reason))) {
    return "The dossier must state its unresolved facts before confirmation.";
  }
  if (reasons.some((reason) => /at-a-glance/i.test(reason))) {
    return "The dossier needs an at-a-glance identity claim before confirmation.";
  }
  if (reasons.some((reason) => /source/i.test(reason))) {
    return "At least one attached source and a source-backed explanation are required before confirmation.";
  }
  return "Resolve the displayed identity uncertainty before confirmation.";
}

function visibleContinuationReason(reasons: readonly string[]) {
  if (reasons.length === 0) return null;
  if (reasons.some((reason) => /not been confirmed/i.test(reason))) {
    return "Confirm the intended shock before continuing.";
  }
  if (reasons.some((reason) => /assessment is not completed/i.test(reason))) {
    return "Continue becomes available after the confirmed-shock assessment is complete.";
  }
  if (reasons.some((reason) => /dossier is not completed/i.test(reason))) {
    return "Complete the foundational shock dossier before continuing.";
  }
  if (reasons.some((reason) => /no longer matches/i.test(reason))) {
    return "Reconsider the identity because the confirmed record no longer matches the active anchor.";
  }
  return "The confirmed event is not yet ready for the Screen 3 handoff.";
}

function assessmentForConfirmation(
  state: Screen02AuditState,
  confirmation: Screen02ConfirmedIdentity | null,
) {
  if (!confirmation) return null;
  return (
    [...state.assessments]
      .filter((assessment) => {
        const request = state.assessmentRequests.find(
          (candidateRequest) =>
            candidateRequest.requestId === assessment.requestId,
        );
        return (
          assessment.identitySnapshotId === confirmation.identitySnapshotId &&
          request?.target.mode === "audit-confirmed-event" &&
          request.target.confirmationSnapshotId ===
            confirmation.confirmationSnapshotId &&
          request.target.dossierSnapshotId === confirmation.dossierSnapshotId
        );
      })
      .sort((left, right) =>
        right.recordedAt.localeCompare(left.recordedAt),
      )[0] ?? null
  );
}

function assessmentRequestForConfirmation(
  state: Screen02AuditState,
  confirmation: Screen02ConfirmedIdentity | null,
) {
  if (!confirmation) return null;
  return latestRequest(
    state,
    (request) =>
      request.target.mode === "audit-confirmed-event" &&
      request.target.confirmationSnapshotId ===
        confirmation.confirmationSnapshotId &&
      request.target.dossierSnapshotId === confirmation.dossierSnapshotId,
  );
}

export function buildScreen02AuditViewModel(
  state: Screen02AuditState,
  openedMatchSnapshotId?: string | null,
): Screen02AuditViewModel {
  const set = activeMatchSet(state);
  const noMatchDecision = currentSetNoMatchDecision(state, set);
  const activeAnchor =
    state.anchor.revisions.find(
      (revision) =>
        revision.anchorRevisionId === state.anchor.activeRevisionId,
    ) ?? state.anchor.revisions.at(-1)!;
  const sourceById = new Map(
    state.sources.map((source) => [source.id, source]),
  );
  const activeMatches = set
    ? set.possibleMatchSnapshotIds.flatMap((matchSnapshotId) => {
        const match = state.possibleMatches.find(
          (candidate) => candidate.matchSnapshotId === matchSnapshotId,
        );
        return match ? [match] : [];
      })
    : [];
  const unorderedMatches = activeMatches.map((match): Screen02AuditMatchView => {
    const sources = match.sourceIds.flatMap((sourceId) => {
      const source = sourceById.get(sourceId);
      return source ? [source] : [];
    });
    const dossier = dossierForMatch(state, match);
    const decisions = state.identityDecisions
      .filter(
        (decision) => decision.matchSnapshotId === match.matchSnapshotId,
      )
      .sort((left, right) => left.at.localeCompare(right.at));
    const reasons = confirmationReasons(
      match,
      sources,
      dossier,
      decisions,
      noMatchDecision,
    );
    return {
      match,
      sources,
      dossier,
      dossierRequest: dossierRequestForMatch(state, match),
      decisions,
      disposition: latestMatchDisposition(decisions),
      currentNoMatchDecision: noMatchDecision,
      opened: false,
      confirmed:
        match.matchSnapshotId === state.confirmedIdentity?.matchSnapshotId &&
        match.identitySnapshotId ===
          state.confirmedIdentity?.identitySnapshotId,
      confirmationGate: {
        eligible: reasons.length === 0,
        reasons,
        visibleReason: visibleConfirmationReason(reasons, noMatchDecision),
      },
    };
  });
  const prioritizeVersionAlternatives = unorderedMatches.some(
    (row) => row.disposition === "related-version",
  );
  const orderedMatches = [...unorderedMatches].sort(
    (left, right) =>
      matchOrderRank(left, prioritizeVersionAlternatives) -
      matchOrderRank(right, prioritizeVersionAlternatives),
  );
  const preferredOpenedId =
    state.confirmedIdentity?.matchSnapshotId ??
    openedMatchSnapshotId ??
    orderedMatches[0]?.match.matchSnapshotId ??
    null;
  const matches = orderedMatches.map((row) => ({
    ...row,
    opened: row.match.matchSnapshotId === preferredOpenedId,
  }));
  const opened = matches.find((match) => match.opened) ?? null;
  const confirmed = matches.find((match) => match.confirmed) ?? null;
  const assessment = assessmentForConfirmation(
    state,
    state.confirmedIdentity,
  );
  const assessmentRequest = assessmentRequestForConfirmation(
    state,
    state.confirmedIdentity,
  );
  const gate = screen02AuditContinuationGate(state);
  const noMatch = Boolean(
    noMatchDecision ||
      (set && set.possibleMatchSnapshotIds.length === 0),
  );
  const phase: Screen02AuditPhase = state.confirmedIdentity
    ? "assess"
    : !set
      ? "identify"
      : noMatch
        ? "confirm-or-correct"
        : opened?.dossier?.status === "completed"
          ? "confirm-or-correct"
          : "understand";
  const alreadyContinued = Boolean(
    state.confirmedIdentity &&
      state.continuationHistory.some(
        (event) =>
          event.confirmationSnapshotId ===
          state.confirmedIdentity?.confirmationSnapshotId,
      ),
  );

  return {
    activeMatchSet: set,
    activeAnchor,
    matches,
    opened,
    confirmed,
    confirmedIdentity: state.confirmedIdentity,
    assessment,
    assessmentRequest,
    phase,
    noMatch,
    currentNoMatchDecision: noMatchDecision,
    continuationGate: {
      eligible: gate.eligible && !alreadyContinued,
      reasons: gate.reasons,
      visibleReason: alreadyContinued
        ? "This confirmed event has already continued to the common Screen 3 handoff."
        : visibleContinuationReason(gate.reasons),
    },
    alreadyContinued,
  };
}
