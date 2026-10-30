import type { Screen01StudyContext } from "./scope-types";
import { screen02EventWordingMatches } from "./screen02-event-name";
import {
  isCompatibleScreen02CandidateQualification,
  isScreen02CandidateQualification,
  migrateScreen02CandidateQualification,
  type Screen02CandidateQualification,
} from "./screen02-qualification-codec";
import {
  fingerprintScreen01StudyContext,
  serializeDeterministicJson,
} from "./screen02-deterministic-json";
import {
  isScreen02ContextOfficialBridgeProvenance,
  screen02FederalRegisterBridgeQueryMatchesIdentifier,
  screen02VisibleTitleFederalRegisterIdentifier,
} from "./screen02-context-bridge";
import { requireReadyScreen01Context } from "./study-context";
import {
  SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_WORKERS_AI_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
  screen02AssessmentUnavailableScreen03Checks,
  screen02AuditRelationships,
  screen02AuditVersionTypes,
  screen02CoverageRelationCategories,
  screen02CriterionFindingResults,
  screen02DateLeadStages,
  screen02MeasurementPotentialCategories,
  screen02OutcomePathwayCategories,
  screen02PreliminaryJudgments,
  screen02StudyFitCategories,
  isScreen02ContextLead,
  isScreen02HostReviewApplication,
  isScreen02RetainedResultBinding,
  isCompatibleScreen02RetrievalExecution,
  isScreen02RetrievalExecution,
  isFreshScreen02SelectionQualification,
  isCompatibleScreen02SearchFunnel,
  isScreen02SearchFunnel,
  screen02DocumentAcquisitionMatchesSource,
  screen02SearchFunnelMatchesRetrievalExecution,
  migrateScreen02RetrievalExecution,
  migrateScreen02SearchFunnel,
  type Screen02AssessmentComponent,
  type Screen02AssessmentUnavailableDisposition,
  type Screen02AuditAnchorRevision,
  type Screen02AuditRelatedVersion,
  type Screen02CriterionFinding,
  type Screen02CoverageRelationCategory,
  type Screen02ContextLead,
  type Screen02DateLead,
  type Screen02EventIdentity,
  type Screen02MeasurementPotentialCategory,
  type Screen02OutcomePathwayCategory,
  type Screen02PreliminaryJudgment,
  type Screen02ProvisionalClaim,
  type Screen02StudyFitCategory,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
  type Screen02WorkflowState,
} from "./screen02-workflow-types";
import {
  deriveScreen02AuditJudgment,
  deriveScreen02PreliminaryJudgment,
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowSource,
  fingerprintScreen02WorkflowValue,
  requireScreen02WorkflowState,
  screen02AuditContinuationGate,
  screen02AuditAssessmentUnavailableContinuationGate,
  screen02FindCandidateGate,
  screen02FindAssessmentUnavailableContinuationGate,
} from "./screen02-workflow-state";

export const SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION =
  "screen-02-to-screen-03-event-v4" as const;
export const SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION =
  "screen-02-to-screen-03-event-v4" as const;
export const SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION =
  "screen-02-to-screen-03-event-v2" as const;
export const SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION =
  "screen-02-to-screen-03-event-v3" as const;

export const screen02WorkflowCompletionOrigins = [
  "chatgpt-host",
  "workers-ai",
  "fixed-fallback",
  "compatibility-model-tool",
] as const;
export type Screen02WorkflowCompletionOrigin =
  (typeof screen02WorkflowCompletionOrigins)[number];

export type Screen02WorkflowHandoffEvent = {
  identitySnapshotId: string;
  identity: Screen02EventIdentity;
  description: Screen02ProvisionalClaim;
  dateLeads: Screen02DateLead[];
  broadCoverage: Screen02ProvisionalClaim[];
  highLevelChanges: Screen02ProvisionalClaim[];
  keyComponents: Screen02ProvisionalClaim[];
  relatedVersions: Screen02AuditRelatedVersion[];
  sourceIds: string[];
  limitations: string[];
  settlement: "preliminary-screen-02";
  /**
   * Source-backed Screen 2 screening trace. It is explicitly preliminary and
   * cannot replace Screen 3 verification or a verified Event Card.
   */
  preliminaryQualification?: Screen02CandidateQualification;
};

export type Screen02WorkflowHandoffCompletedAssessment = {
  assessmentId: string;
  requestId: string;
  judgment: Screen02PreliminaryJudgment;
  judgmentMethod: "fixed-computation";
  completionOrigin: Screen02WorkflowCompletionOrigin;
  studyFit: Screen02AssessmentComponent<Screen02StudyFitCategory>;
  outcomePathway: Screen02AssessmentComponent<Screen02OutcomePathwayCategory>;
  coverageRelation: Screen02AssessmentComponent<Screen02CoverageRelationCategory> | null;
  measurementPotential: Screen02AssessmentComponent<Screen02MeasurementPotentialCategory>;
  mainConcern: string;
  nextChecks: string[];
  evidenceSourceIds: string[];
};

export type Screen02WorkflowHandoffAssessment =
  | Screen02WorkflowHandoffCompletedAssessment
  | Screen02AssessmentUnavailableDisposition;

export type Screen02WorkflowHandoffDecision =
  | {
      mode: "find";
      candidateSetSnapshotId: string;
      candidateSnapshotId: string;
      selectionDecisionId: string;
      continuationDecisionId: string;
    }
  | {
      mode: "audit";
      originalWording: string;
      activeAnchorRevisionId: string;
      matchSetSnapshotId: string;
      matchSnapshotId: string;
      identitySnapshotId: string;
      dossierSnapshotId: string;
      confirmationSnapshotId: string;
      confirmationDecisionId: string;
      continuationDecisionId: string;
    };

export type Screen02WorkflowHandoffProvenance =
  | {
      mode: "find";
      candidateSetSnapshotId: string;
      candidateSetFingerprint: string;
      candidateSnapshotId: string;
      candidateFingerprint: string;
    }
  | {
      mode: "audit";
      matchSetSnapshotId: string;
      matchSetFingerprint: string;
      matchSnapshotId: string;
      matchFingerprint: string;
      dossierSnapshotId: string;
      dossierFingerprint: string;
      confirmationSnapshotId: string;
      confirmationFingerprint: string;
    };

export type Screen02WorkflowHandoffHistory = {
  searchManifests: Screen02WorkflowSearchManifest[];
  anchorRevisions: Screen02AuditAnchorRevision[];
  decisions: Array<{
    id: string;
    action: string;
    targetSnapshotId: string | null;
    at: string;
    reason: string;
  }>;
};

export type Screen02WorkflowHandoff = {
  schemaVersion:
    | typeof SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION
    | typeof SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION
    | typeof SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION
    | typeof SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION;
  sourceScreen: "screen-02";
  destinationScreen: "screen-03";
  producerAppVersion: string;
  sourceSessionSchemaVersion: typeof SCREEN_02_WORKFLOW_SCHEMA_VERSION;
  runId: string;
  revision: number;
  mode: "find" | "audit";
  builtAt: string;
  screen01Baseline: Screen01StudyContext;
  screen01Fingerprint: string;
  decision: Screen02WorkflowHandoffDecision;
  provenance: Screen02WorkflowHandoffProvenance;
  event: Screen02WorkflowHandoffEvent;
  preliminaryAssessment: Screen02WorkflowHandoffAssessment;
  dossierCompletionOrigin: Screen02WorkflowCompletionOrigin | null;
  criteriaFindings: Screen02CriterionFinding[];
  sources: Screen02WorkflowSource[];
  unresolved: {
    questions: string[];
    provisionalClaimIds: string[];
    screen03Boundary: string;
  };
  history: Screen02WorkflowHandoffHistory;
  outcomeValuesInspected: false;
  integrity: {
    stateFingerprint: string;
    eventFingerprint: string;
    historyFingerprint: string;
    handoffFingerprint: string;
  };
};

const rootKeys = [
  "schemaVersion",
  "sourceScreen",
  "destinationScreen",
  "producerAppVersion",
  "sourceSessionSchemaVersion",
  "runId",
  "revision",
  "mode",
  "builtAt",
  "screen01Baseline",
  "screen01Fingerprint",
  "decision",
  "provenance",
  "event",
  "preliminaryAssessment",
  "dossierCompletionOrigin",
  "criteriaFindings",
  "sources",
  "unresolved",
  "history",
  "outcomeValuesInspected",
  "integrity",
] as const;

function clone<T>(value: T): T {
  serializeDeterministicJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function latestCompletedFindAssessment(
  state: Extract<Screen02WorkflowState, { mode: "find" }>,
  candidateSnapshotId: string,
) {
  return [...state.assessments]
    .reverse()
    .find(
      (item) => {
        const request = state.assessmentRequests.find(
          (candidateRequest) => candidateRequest.requestId === item.requestId,
        );
        return (
          item.candidateSnapshotId === candidateSnapshotId &&
          item.status === "completed" &&
          request?.target.mode === "find-candidate"
        );
      },
    );
}

function completionOriginForRequest(
  state: Screen02WorkflowState,
  requestId: string,
): Screen02WorkflowCompletionOrigin {
  const request = state.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  );
  if (!request || request.status !== "completed") {
    fail(
      "Screen 2 handoff completion provenance requires the completed canonical request.",
    );
  }
  if (
    request.lifecycle.some(
      (event) =>
        event.note ===
          SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE ||
        event.note ===
          SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE ||
        event.note ===
          SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
    )
  ) {
    return "fixed-fallback";
  }
  const delivered = [...request.lifecycle]
    .reverse()
    .find((event) => event.status === "message-delivered");
  if (
    delivered?.note === SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE
  ) {
    return "chatgpt-host";
  }
  if (
    delivered?.note === SCREEN_02_WORKERS_AI_COMPLETION_LIFECYCLE_NOTE
  ) {
    return "workers-ai";
  }
  if (
    delivered?.note === SCREEN_02_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE
  ) {
    return "fixed-fallback";
  }
  return "compatibility-model-tool";
}

function normalizedAssessment(input: {
  assessmentId: string;
  requestId: string;
  overallJudgment: Screen02PreliminaryJudgment | null;
  overallJudgmentMethod: "fixed-computation" | null;
  completionOrigin: Screen02WorkflowCompletionOrigin;
  studyFit: Screen02WorkflowHandoffCompletedAssessment["studyFit"] | null;
  outcomePathway: Screen02WorkflowHandoffCompletedAssessment["outcomePathway"] | null;
  coverageRelation: Screen02WorkflowHandoffCompletedAssessment["coverageRelation"];
  measurementPotential:
    | Screen02WorkflowHandoffCompletedAssessment["measurementPotential"]
    | null;
  mainConcern: string | null;
  nextChecks: string[];
  evidenceSourceIds: string[];
}): Screen02WorkflowHandoffCompletedAssessment {
  if (
    !input.overallJudgment ||
    input.overallJudgmentMethod !== "fixed-computation" ||
    !input.studyFit ||
    !input.outcomePathway ||
    !input.measurementPotential ||
    !input.mainConcern
  ) {
    fail("Completed Screen 2 assessment is missing a required field.");
  }
  return {
    assessmentId: input.assessmentId,
    requestId: input.requestId,
    judgment: input.overallJudgment,
    judgmentMethod: "fixed-computation",
    completionOrigin: input.completionOrigin,
    studyFit: clone(input.studyFit),
    outcomePathway: clone(input.outcomePathway),
    coverageRelation: clone(input.coverageRelation),
    measurementPotential: clone(input.measurementPotential),
    mainConcern: input.mainConcern,
    nextChecks: [...input.nextChecks],
    evidenceSourceIds: [...input.evidenceSourceIds],
  };
}

function fixedQualificationHandoffAssessment(
  qualification: Screen02CandidateQualification,
): Screen02WorkflowHandoffCompletedAssessment {
  const sourceBoundFingerprint = qualification.sourceFingerprint;
  const conservativeComponent = (explanation: string) => ({
    category: "unclear" as const,
    explanation,
    evidenceSourceIds: [],
  });
  return {
    // The v4 handoff keeps its established assessment-shaped compatibility
    // boundary. These stable IDs identify a fixed qualification projection;
    // they are deliberately not canonical assessment-request IDs.
    assessmentId: `fixed-qualification:${sourceBoundFingerprint}`,
    requestId: `fixed-qualification:no-legacy-request:${sourceBoundFingerprint}`,
    judgment: deriveScreen02PreliminaryJudgment({
      studyFit: "unclear",
      outcomePathway: "unclear",
      measurementPotential: "unclear",
    }) ?? "not-enough-evidence",
    judgmentMethod: "fixed-computation",
    completionOrigin: "fixed-fallback",
    studyFit: conservativeComponent(
      "Screen 2 fixed qualification screened this candidate for relevance; Screen 3 must verify the event against direct official evidence.",
    ),
    outcomePathway: conservativeComponent(
      "The fixed qualification does not establish a realized or causal outcome pathway.",
    ),
    coverageRelation: null,
    measurementPotential: conservativeComponent(
      "Measurement feasibility remains unverified until the Event Card and exposure boundary are reviewed.",
    ),
    mainConcern: qualification.substantiveOverview.mainUncertainty,
    nextChecks: [
      "Verify the event identity, timing, covered units, and exposure boundary against direct official evidence in Screen 3.",
    ],
    evidenceSourceIds: [],
  };
}

function eventClaimIds(event: Screen02WorkflowHandoffEvent) {
  return [
    event.description.id,
    ...event.dateLeads.map((lead) => lead.id),
    ...event.broadCoverage.map((claim) => claim.id),
    ...event.highLevelChanges.map((claim) => claim.id),
    ...event.keyComponents.map((claim) => claim.id),
  ];
}

function finishHandoff(
  partial: Omit<Screen02WorkflowHandoff, "integrity">,
  stateFingerprint: string,
) {
  const integrityWithoutHandoff = {
    stateFingerprint,
    eventFingerprint: fingerprintScreen02WorkflowValue(partial.event),
    historyFingerprint: fingerprintScreen02WorkflowValue(partial.history),
  };
  const handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...partial,
    integrity: integrityWithoutHandoff,
  });
  const handoff: Screen02WorkflowHandoff = {
    ...partial,
    integrity: { ...integrityWithoutHandoff, handoffFingerprint },
  };
  return requireStructurallyValidScreen02WorkflowHandoff(handoff);
}

function screen02HandoffSearchManifests(
  manifests: readonly Screen02WorkflowSearchManifest[],
  selectedCandidateId: string,
  carriedSourceIds: ReadonlySet<string>,
) {
  const projected = manifests.map((manifest) => clone(manifest));
  for (const manifest of projected) {
    const exclusionsByRecordId = new Map<
      string,
      Screen02WorkflowSearchManifest["exclusions"][number]
    >();
    for (const exclusion of manifest.exclusions) {
      const prior = exclusionsByRecordId.get(exclusion.recordId);
      const qualification = exclusion.qualification ?? prior?.qualification;
      exclusionsByRecordId.set(exclusion.recordId, {
        recordId: exclusion.recordId,
        reason: [...new Set([
          ...(prior ? [prior.reason] : []),
          exclusion.reason,
        ])].join(" "),
        ...(qualification ? { qualification: clone(qualification) } : {}),
      });
    }
    // One source record can cross multiple bounded exclusion stages. Preserve
    // every distinct reason while emitting the handoff's unambiguous one-row
    // per-record history; a later fixed qualification is the final verdict.
    manifest.exclusions = [...exclusionsByRecordId.values()];
    if (!manifest.retrievalExecution) continue;
    manifest.retrievalExecution.documentAcquisitions =
      manifest.retrievalExecution.documentAcquisitions.map((acquisition) =>
        acquisition.candidateId === selectedCandidateId &&
          acquisition.sourceId !== null &&
          carriedSourceIds.has(acquisition.sourceId)
          ? acquisition
          : { ...acquisition, sourceId: null }
      );
  }
  return projected;
}

export function buildScreen02WorkflowHandoff(
  state: Screen02WorkflowState,
  producerAppVersion: string,
  builtAt: string,
): Screen02WorkflowHandoff {
  const safe = requireScreen02WorkflowState(state);
  if (!producerAppVersion.trim() || !builtAt.trim()) {
    fail("Handoff producer version and timestamp are required.");
  }
  const stateFingerprint = fingerprintScreen02WorkflowState(safe);

  if (safe.mode === "find") {
    const candidateSnapshotId = safe.decision.tentativeSelectionSnapshotId;
    if (!candidateSnapshotId) fail("Find handoff needs a selected candidate.");
    const candidate = safe.candidates.find(
      (item) => item.candidateSnapshotId === candidateSnapshotId,
    )!;
    const candidateSet = safe.candidateSets.find(
      (item) => item.candidateSetSnapshotId === safe.activeCandidateSetSnapshotId,
    )!;
    const selectionIndex = safe.decision.history.findLastIndex(
      (item) =>
        item.action === "tentatively-selected" &&
        item.candidateSnapshotId === candidateSnapshotId,
    );
    const selection = safe.decision.history[selectionIndex];
    const continuation = safe.decision.history
      .slice(selectionIndex + 1)
      .find(
        (item) =>
          ["continued", "continued-without-assessment"].includes(item.action) &&
          item.candidateSnapshotId === candidateSnapshotId,
      );
    if (!selection || !continuation) {
      fail("Find handoff requires separate selection and continuation decisions.");
    }
    const assessmentUnavailable =
      continuation.action === "continued-without-assessment";
    const gate = assessmentUnavailable
      ? screen02FindAssessmentUnavailableContinuationGate(safe)
      : screen02FindCandidateGate(safe, candidateSnapshotId);
    if (!gate.eligible) {
      fail(`Find handoff is blocked: ${gate.reasons.join(" ")}`);
    }
    const assessment = assessmentUnavailable
      ? null
      : latestCompletedFindAssessment(safe, candidateSnapshotId) ?? null;
    const fixedQualification = isFreshScreen02SelectionQualification(
        candidate.qualification,
      )
      ? candidate.qualification
      : null;
    if (!assessmentUnavailable && !assessment && !fixedQualification) {
      fail("Find handoff requires a completed assessment.");
    }
    const handoffAssessment = assessmentUnavailable
      ? clone(continuation.assessmentDisposition)
      : assessment
        ? normalizedAssessment({
            ...assessment,
            completionOrigin: completionOriginForRequest(
              safe,
              assessment.requestId,
            ),
            coverageRelation: null,
          })
        : fixedQualificationHandoffAssessment(fixedQualification!);
    const handoffNextChecks = "nextChecks" in handoffAssessment
      ? handoffAssessment.nextChecks
      : handoffAssessment.mandatoryScreen03Checks;
    const event: Screen02WorkflowHandoffEvent = {
      identitySnapshotId: candidate.candidateSnapshotId,
      identity: clone(candidate.identity),
      description: clone(candidate.description),
      dateLeads: clone(candidate.dateLeads),
      broadCoverage: clone(candidate.broadCoverage),
      highLevelChanges: [],
      keyComponents: [],
      relatedVersions: [],
      sourceIds: [...candidate.sourceIds],
      limitations: [...candidate.limitations],
      settlement: "preliminary-screen-02",
      ...(candidate.qualification
        ? { preliminaryQualification: clone(candidate.qualification) }
        : {}),
    };
    const appliedCriterionKeys = new Set(
      candidateSet.criterionVersionRefs.map(
        (ref) => `${ref.criterionId}:${ref.version}`,
      ),
    );
    const criteriaFindings = safe.criterionFindings.filter(
      (item) =>
        item.candidateSnapshotId === candidateSnapshotId &&
        appliedCriterionKeys.has(
          `${item.criterionId}:${item.criterionVersion}`,
        ),
    );
    const sources = safe.sources.filter((source) => candidate.sourceIds.includes(source.id));
    const history: Screen02WorkflowHandoffHistory = {
      searchManifests: screen02HandoffSearchManifests(
        safe.candidateSets.map((set) => set.manifest),
        candidate.candidateId,
        new Set(candidate.sourceIds),
      ),
      anchorRevisions: [],
      decisions: safe.decision.history.map((item) => ({
        id: item.decisionId,
        action: item.action,
        targetSnapshotId: item.candidateSnapshotId,
        at: item.at,
        reason: item.reason,
      })),
    };
    return finishHandoff(
      {
        schemaVersion: assessmentUnavailable
          ? SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION
          : SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
        sourceScreen: "screen-02",
        destinationScreen: "screen-03",
        producerAppVersion,
        sourceSessionSchemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
        runId: safe.runId,
        revision: safe.revision,
        mode: "find",
        builtAt,
        screen01Baseline: clone(safe.screen01Baseline as Screen01StudyContext),
        screen01Fingerprint: safe.screen01Fingerprint,
        decision: {
          mode: "find",
          candidateSetSnapshotId: candidateSet.candidateSetSnapshotId,
          candidateSnapshotId,
          selectionDecisionId: selection.decisionId,
          continuationDecisionId: continuation.decisionId,
        },
        provenance: {
          mode: "find",
          candidateSetSnapshotId: candidateSet.candidateSetSnapshotId,
          candidateSetFingerprint: candidateSet.candidateSetFingerprint,
          candidateSnapshotId: candidate.candidateSnapshotId,
          candidateFingerprint: candidate.candidateFingerprint,
        },
        event,
        preliminaryAssessment: handoffAssessment,
        dossierCompletionOrigin: null,
        criteriaFindings: clone(criteriaFindings),
        sources: clone(sources),
        unresolved: {
          questions: [
            ...candidate.limitations,
            ...handoffNextChecks,
          ],
          provisionalClaimIds: eventClaimIds(event),
          screen03Boundary,
        },
        history,
        outcomeValuesInspected: false,
      },
      stateFingerprint,
    );
  }

  if (!safe.confirmedIdentity) {
    fail("Audit handoff requires a confirmed identity.");
  }
  const confirmedIdentity = safe.confirmedIdentity;
  const continuation = safe.continuationHistory.at(-1);
  if (
    !continuation ||
    continuation.identitySnapshotId !== confirmedIdentity.identitySnapshotId ||
    continuation.confirmationSnapshotId !==
      confirmedIdentity.confirmationSnapshotId
  ) {
    fail("Audit handoff requires a separate continuation decision.");
  }
  const assessmentUnavailable = "assessmentDisposition" in continuation;
  const gate = assessmentUnavailable
    ? screen02AuditAssessmentUnavailableContinuationGate(safe)
    : screen02AuditContinuationGate(safe);
  if (!gate.eligible) {
    fail(`Audit handoff is blocked: ${gate.reasons.join(" ")}`);
  }
  const match = safe.possibleMatches.find(
    (item) => item.matchSnapshotId === safe.confirmedIdentity!.matchSnapshotId,
  )!;
  const matchSet = safe.matchSets.find(
    (item) => item.matchSetSnapshotId === match.matchSetSnapshotId,
  )!;
  const dossier = safe.dossiers.find(
    (item) =>
      item.dossierSnapshotId === continuation.dossierSnapshotId,
  )!;
  const assessment = assessmentUnavailable
    ? null
    : safe.assessments.find(
        (item) => item.assessmentId === continuation.assessmentId,
      ) ?? null;
  if (!assessmentUnavailable && !assessment) {
    fail("Audit handoff requires a completed assessment.");
  }
  const confirmation = safe.identityDecisions.find(
    (item) => item.decisionId === safe.confirmedIdentity!.decisionId,
  )!;
  const event: Screen02WorkflowHandoffEvent = {
    identitySnapshotId: match.identitySnapshotId,
    identity: clone(match.identity),
    description: clone(dossier.whatHappened!),
    dateLeads: clone(dossier.timeline),
    broadCoverage: clone(dossier.broadCoverage),
    highLevelChanges: clone(dossier.whatChanged),
    keyComponents: clone(dossier.keyComponents),
    relatedVersions: clone(dossier.relatedVersions),
    sourceIds: [...new Set([...match.sourceIds, ...dossier.sourceIds])],
    limitations: [...match.limitations, ...dossier.unresolvedFacts],
    settlement: "preliminary-screen-02",
  };
  const sources = safe.sources.filter((source) => event.sourceIds.includes(source.id));
  const history: Screen02WorkflowHandoffHistory = {
    searchManifests: screen02HandoffSearchManifests(
      safe.matchSets.map((set) => set.manifest),
      match.matchId,
      new Set(event.sourceIds),
    ),
    anchorRevisions: clone(safe.anchor.revisions),
    decisions: [
      ...safe.identityDecisions.map((item) => ({
        id: item.decisionId,
        action: item.action,
        targetSnapshotId: item.identitySnapshotId,
        at: item.at,
        reason: item.reason,
      })),
      ...safe.continuationHistory.map((item) => ({
        id: item.continuationId,
        action:
          "assessmentDisposition" in item
            ? "continued-without-assessment"
            : "continued",
        targetSnapshotId: item.identitySnapshotId,
        at: item.at,
        reason: item.reason,
      })),
    ],
  };
  return finishHandoff(
    {
      schemaVersion: assessmentUnavailable
        ? SCREEN_02_WORKFLOW_HANDOFF_UNAVAILABLE_SCHEMA_VERSION
        : SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
      sourceScreen: "screen-02",
      destinationScreen: "screen-03",
      producerAppVersion,
      sourceSessionSchemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
      runId: safe.runId,
      revision: safe.revision,
      mode: "audit",
      builtAt,
      screen01Baseline: clone(safe.screen01Baseline as Screen01StudyContext),
      screen01Fingerprint: safe.screen01Fingerprint,
      decision: {
        mode: "audit",
        originalWording: safe.anchor.originalWording,
        activeAnchorRevisionId: safe.anchor.activeRevisionId,
        matchSetSnapshotId: matchSet.matchSetSnapshotId,
        matchSnapshotId: match.matchSnapshotId,
        identitySnapshotId: match.identitySnapshotId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        confirmationSnapshotId:
          safe.confirmedIdentity.confirmationSnapshotId,
        confirmationDecisionId: confirmation.decisionId,
        continuationDecisionId: continuation.continuationId,
      },
      provenance: {
        mode: "audit",
        matchSetSnapshotId: matchSet.matchSetSnapshotId,
        matchSetFingerprint: matchSet.matchSetFingerprint,
        matchSnapshotId: match.matchSnapshotId,
        matchFingerprint: match.matchFingerprint,
        dossierSnapshotId: dossier.dossierSnapshotId,
        dossierFingerprint: dossier.dossierFingerprint,
        confirmationSnapshotId:
          safe.confirmedIdentity.confirmationSnapshotId,
        confirmationFingerprint:
          safe.confirmedIdentity.confirmationFingerprint,
      },
      event,
      preliminaryAssessment: assessmentUnavailable
        ? clone(continuation.assessmentDisposition)
        : normalizedAssessment({
            ...assessment!,
            completionOrigin: completionOriginForRequest(
              safe,
              assessment!.requestId,
            ),
          }),
      dossierCompletionOrigin: completionOriginForRequest(
        safe,
        dossier.requestId,
      ),
      criteriaFindings: [],
      sources: clone(sources),
      unresolved: {
        questions: [
          ...dossier.unresolvedFacts,
          ...(assessmentUnavailable
            ? continuation.assessmentDisposition.mandatoryScreen03Checks
            : assessment!.nextChecks),
        ],
        provisionalClaimIds: eventClaimIds(event),
        screen03Boundary,
      },
      history,
      outcomeValuesInspected: false,
    },
    stateFingerprint,
  );
}

function handoffFingerprintInput(value: Screen02WorkflowHandoff) {
  const { handoffFingerprint: _handoffFingerprint, ...integrity } = value.integrity;
  return { ...value, integrity };
}

function projectCurrentHandoffToLegacy(
  current: Screen02WorkflowHandoff,
  schemaVersion:
    | typeof SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION
    | typeof SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION,
) {
  const projected = clone(current) as unknown as Record<string, unknown>;
  projected.schemaVersion = schemaVersion;
  delete projected.dossierCompletionOrigin;
  const assessment = projected.preliminaryAssessment;
  if (isRecord(assessment) && !("status" in assessment)) {
    delete assessment.completionOrigin;
  }
  const integrity = projected.integrity;
  if (!isRecord(integrity)) {
    fail("Legacy handoff projection requires integrity metadata.");
  }
  const { handoffFingerprint: _handoffFingerprint, ...withoutHandoff } =
    integrity;
  integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...projected,
    integrity: withoutHandoff,
  });
  return requireStructurallyValidScreen02WorkflowHandoff(projected);
}

const fingerprintPattern = /^fnv1a64:[0-9a-f]{16}$/;

const screen03Boundary =
  "Screen 3 must verify what changed, when it changed, and which organizations were formally covered.";

const forbiddenScreen03Keys = new Set([
  "eventCard",
  "operativeDate",
  "finalOperativeDate",
  "treatmentEligibility",
  "treatmentRule",
  "eligibilityFunction",
  "thresholdAdjudication",
  "exemptionAdjudication",
  "exposureCoding",
  "organizationLevelExposure",
  "causalValidity",
  "selectedTreatmentVersion",
  "representationType",
  "primaryRepresentationType",
  "candidateConstruct",
  "primaryConstruct",
  "operationalization",
  "scorecard",
  "likelyServiceLevel",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}

function isEnumValue(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && fingerprintPattern.test(value);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((item) => right.includes(item))
  );
}

function containsForbiddenScreen03Key(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (!value || typeof value !== "object" || seen.has(value as object)) {
    return false;
  }
  seen.add(value as object);
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenScreen03Key(item, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).some(
    ([key, child]) =>
      forbiddenScreen03Keys.has(key) ||
      containsForbiddenScreen03Key(child, seen),
  );
}

function validateIdentity(value: unknown): value is Screen02EventIdentity {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, [
      "canonicalTitle",
      "commonNames",
      "formalIdentifier",
      "issuer",
      "issuingJurisdiction",
      "eventType",
      "status",
    ]) &&
    isNonEmptyString(value.canonicalTitle) &&
    isStringArray(value.commonNames) &&
    isNullableString(value.formalIdentifier) &&
    isNullableString(value.issuer) &&
    isNullableString(value.issuingJurisdiction) &&
    isNonEmptyString(value.eventType) &&
    isNullableString(value.status)
  );
}

function validateClaim(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
): value is Screen02ProvisionalClaim {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["id", "text", "sourceIds", "status", "uncertainty"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.text) &&
    isStringArray(value.sourceIds) &&
    value.sourceIds.every((id) => allowedSourceIds.has(id)) &&
    value.status === "provisional" &&
    isNullableString(value.uncertainty)
  );
}

function validateDateLead(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
): value is Screen02DateLead {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, [
      "id",
      "date",
      "label",
      "stage",
      "sourceIds",
      "status",
      "uncertainty",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.label) &&
    isEnumValue(value.stage, screen02DateLeadStages) &&
    isStringArray(value.sourceIds) &&
    value.sourceIds.every((id) => allowedSourceIds.has(id)) &&
    value.status === "provisional" &&
    isNullableString(value.uncertainty)
  );
}

function validateRelatedVersion(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
): value is Screen02AuditRelatedVersion {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["relationship", "identity", "sourceIds", "note"]) &&
    isEnumValue(value.relationship, screen02AuditRelationships) &&
    validateIdentity(value.identity) &&
    isStringArray(value.sourceIds) &&
    value.sourceIds.every((id) => allowedSourceIds.has(id)) &&
    isNonEmptyString(value.note)
  );
}

function validateSource(value: unknown): value is Screen02WorkflowSource {
  if (!isRecord(value)) return false;
  const sourceKeys = [
    "id",
    "sourceFingerprint",
    "title",
    "locator",
    "publisher",
    "publishedDate",
    "authorityTier",
    "channel",
    "retrievedAt",
    "userProvided",
    ...(Object.hasOwn(value, "evidenceText") ? ["evidenceText"] : []),
  ];
  if (
    !hasExactKeys(value, sourceKeys) ||
    !isNonEmptyString(value.id) ||
    !isFingerprint(value.sourceFingerprint) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.locator) ||
    !isNonEmptyString(value.publisher) ||
    !isNullableString(value.publishedDate) ||
    ![1, 2, 3, 4, 5, 6].includes(value.authorityTier as number) ||
    !isNonEmptyString(value.channel) ||
    !isNonEmptyString(value.retrievedAt) ||
    typeof value.userProvided !== "boolean" ||
    (value.userProvided && value.authorityTier !== 6) ||
    (Object.hasOwn(value, "evidenceText") &&
      (typeof value.evidenceText !== "string" ||
        value.evidenceText.trim().length === 0 ||
        value.evidenceText.length > 12_000))
  ) {
    return false;
  }
  return (
    value.sourceFingerprint ===
    fingerprintScreen02WorkflowSource(
      value as unknown as Screen02WorkflowSource,
    )
  );
}

function validateAssessmentComponent(
  value: unknown,
  categories: readonly string[],
  allowedSourceIds: ReadonlySet<string>,
) {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["category", "explanation", "evidenceSourceIds"]) &&
    isEnumValue(value.category, categories) &&
    isNonEmptyString(value.explanation) &&
    isStringArray(value.evidenceSourceIds) &&
    value.evidenceSourceIds.every((id) => allowedSourceIds.has(id)) &&
    (value.category === "unclear" || value.evidenceSourceIds.length > 0)
  );
}

function validateAssessment(
  value: unknown,
  mode: "find" | "audit",
  allowedSourceIds: ReadonlySet<string>,
  requireCompletionOrigin: boolean,
): value is Screen02WorkflowHandoffCompletedAssessment {
  if (!isRecord(value)) return false;
  const expectedKeys = [
    "assessmentId",
    "requestId",
    "judgment",
    "judgmentMethod",
    "studyFit",
    "outcomePathway",
    "coverageRelation",
    "measurementPotential",
    "mainConcern",
    "nextChecks",
    "evidenceSourceIds",
    ...(requireCompletionOrigin ? ["completionOrigin"] : []),
  ];
  if (
    !hasExactKeys(value, expectedKeys) ||
    !isNonEmptyString(value.assessmentId) ||
    !isNonEmptyString(value.requestId) ||
    !isEnumValue(value.judgment, screen02PreliminaryJudgments) ||
    value.judgmentMethod !== "fixed-computation" ||
    (requireCompletionOrigin &&
      !isEnumValue(value.completionOrigin, screen02WorkflowCompletionOrigins)) ||
    !validateAssessmentComponent(
      value.studyFit,
      screen02StudyFitCategories,
      allowedSourceIds,
    ) ||
    !validateAssessmentComponent(
      value.outcomePathway,
      screen02OutcomePathwayCategories,
      allowedSourceIds,
    ) ||
    !validateAssessmentComponent(
      value.measurementPotential,
      screen02MeasurementPotentialCategories,
      allowedSourceIds,
    ) ||
    !isNonEmptyString(value.mainConcern) ||
    !isStringArray(value.nextChecks) ||
    value.nextChecks.length === 0 ||
    !isStringArray(value.evidenceSourceIds) ||
    value.evidenceSourceIds.some((id) => !allowedSourceIds.has(id))
  ) {
    return false;
  }

  const commonComponentEvidenceSourceIds = [
    ...(value.studyFit as Screen02AssessmentComponent<string>)
      .evidenceSourceIds,
    ...(value.outcomePathway as Screen02AssessmentComponent<string>)
      .evidenceSourceIds,
    ...(value.measurementPotential as Screen02AssessmentComponent<string>)
      .evidenceSourceIds,
  ];
  if (mode === "find") {
    if (
      value.coverageRelation !== null ||
      !sameStringSet(
        value.evidenceSourceIds,
        [...new Set(commonComponentEvidenceSourceIds)],
      )
    ) {
      return false;
    }
    const derived = deriveScreen02PreliminaryJudgment({
      studyFit: (value.studyFit as Record<string, unknown>).category as string,
      outcomePathway: (value.outcomePathway as Record<string, unknown>)
        .category as string,
      measurementPotential: (value.measurementPotential as Record<string, unknown>)
        .category as string,
    });
    return value.judgment === derived;
  }

  if (
    !validateAssessmentComponent(
      value.coverageRelation,
      screen02CoverageRelationCategories,
      allowedSourceIds,
    )
  ) {
    return false;
  }
  const aggregateEvidenceSourceIds = [
    ...commonComponentEvidenceSourceIds,
    ...(value.coverageRelation as Screen02AssessmentComponent<string>)
      .evidenceSourceIds,
  ];
  if (
    !sameStringSet(
      value.evidenceSourceIds,
      [...new Set(aggregateEvidenceSourceIds)],
    )
  ) {
    return false;
  }
  const derived = deriveScreen02AuditJudgment({
    studyFit: (value.studyFit as Record<string, unknown>).category as string,
    outcomePathway: (value.outcomePathway as Record<string, unknown>)
      .category as string,
    coverageRelation: (value.coverageRelation as Record<string, unknown>)
      .category as string,
    measurementPotential: (value.measurementPotential as Record<string, unknown>)
      .category as string,
  });
  return value.judgment === derived;
}

function validateUnavailableAssessment(
  value: unknown,
): value is Screen02AssessmentUnavailableDisposition {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, [
      "status",
      "reason",
      "affectedRequestIds",
      "recordedAt",
      "researcherAcknowledgment",
      "mandatoryScreen03Checks",
    ]) &&
    value.status === "unavailable" &&
    isNonEmptyString(value.reason) &&
    value.reason.trim() === value.reason &&
    value.reason.length <= 2_000 &&
    isStringArray(value.affectedRequestIds) &&
    value.affectedRequestIds.length >= 1 &&
    value.affectedRequestIds.length <= 80 &&
    value.affectedRequestIds.every((requestId) => requestId.length <= 200) &&
    isNonEmptyString(value.recordedAt) &&
    Number.isFinite(Date.parse(value.recordedAt)) &&
    isNonEmptyString(value.researcherAcknowledgment) &&
    value.researcherAcknowledgment.trim() === value.researcherAcknowledgment &&
    value.researcherAcknowledgment.length <= 2_000 &&
    isStringArray(value.mandatoryScreen03Checks) &&
    value.mandatoryScreen03Checks.length ===
      screen02AssessmentUnavailableScreen03Checks.length &&
    value.mandatoryScreen03Checks.every(
      (check, index) =>
        check === screen02AssessmentUnavailableScreen03Checks[index],
    )
  );
}

function validateCriterionFinding(
  value: unknown,
  candidateSnapshotId: string,
  allowedSourceIds: ReadonlySet<string>,
): value is Screen02CriterionFinding {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "findingId",
      "candidateSnapshotId",
      "criterionId",
      "criterionVersion",
      "result",
      "reason",
      "evidenceSourceIds",
      "method",
      "requestId",
      "recordedAt",
      "overrides",
    ]) ||
    !isNonEmptyString(value.findingId) ||
    value.candidateSnapshotId !== candidateSnapshotId ||
    !isNonEmptyString(value.criterionId) ||
    !Number.isSafeInteger(value.criterionVersion) ||
    (value.criterionVersion as number) < 1 ||
    !isEnumValue(value.result, screen02CriterionFindingResults) ||
    !isNonEmptyString(value.reason) ||
    !isStringArray(value.evidenceSourceIds) ||
    value.evidenceSourceIds.some((id) => !allowedSourceIds.has(id)) ||
    !isEnumValue(value.method, [
      "source-backed-ai",
      "fixed-fallback",
      "fixed-rule",
    ]) ||
    !isNullableString(value.requestId) ||
    ((value.method === "source-backed-ai" ||
      value.method === "fixed-fallback") &&
      !isNonEmptyString(value.requestId)) ||
    (value.method === "fixed-rule" && value.requestId !== null) ||
    !isNonEmptyString(value.recordedAt) ||
    !Array.isArray(value.overrides) ||
    (value.overrides.length > 0 && value.result !== "unclear")
  ) {
    return false;
  }

  const overrideIds: string[] = [];
  for (const override of value.overrides) {
    if (
      !isRecord(override) ||
      !hasExactKeys(override, [
        "overrideId",
        "researcher",
        "at",
        "reason",
        "priorResult",
        "resultingEligibility",
      ]) ||
      !isNonEmptyString(override.overrideId) ||
      !isNonEmptyString(override.researcher) ||
      !isNonEmptyString(override.at) ||
      !isNonEmptyString(override.reason) ||
      !isEnumValue(override.priorResult, screen02CriterionFindingResults) ||
      override.priorResult !== value.result ||
      !isEnumValue(override.resultingEligibility, ["eligible", "ineligible"])
    ) {
      return false;
    }
    overrideIds.push(override.overrideId);
  }
  return new Set(overrideIds).size === overrideIds.length;
}

function validateSearchManifest(
  value: unknown,
  mode: "find" | "audit",
  allowLegacyEmbeddedSchemas = false,
): value is Screen02WorkflowSearchManifest {
  if (!isRecord(value)) return false;
  const hasContextLeads = Object.prototype.hasOwnProperty.call(
    value,
    "contextLeads",
  );
  const hasContextBridges = Object.prototype.hasOwnProperty.call(
    value,
    "contextBridges",
  );
  const hasFunnel = Object.prototype.hasOwnProperty.call(value, "funnel");
  const hasHostReviewApplication = Object.prototype.hasOwnProperty.call(
    value,
    "hostReviewApplication",
  );
  const hasRetrievalExecution = Object.prototype.hasOwnProperty.call(
    value,
    "retrievalExecution",
  );
  const hasRetainedResultBinding = Object.prototype.hasOwnProperty.call(
    value,
    "retainedResultBinding",
  );
  if (
    !hasExactKeys(value, [
      "protocolVersion",
      "exactRequest",
      "queryMatrix",
      "channels",
      "exclusions",
      ...(hasRetrievalExecution ? ["retrievalExecution"] : []),
      ...(hasRetainedResultBinding ? ["retainedResultBinding"] : []),
      ...(hasFunnel ? ["funnel"] : []),
      ...(hasHostReviewApplication ? ["hostReviewApplication"] : []),
      ...(hasContextLeads ? ["contextLeads"] : []),
      ...(hasContextBridges ? ["contextBridges"] : []),
      "stoppingRule",
      "retrievedAt",
      "outcomeValuesInspected",
    ]) ||
    (value.protocolVersion !== SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
      value.protocolVersion !==
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION) ||
    (value.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION
      ? hasRetrievalExecution || hasRetainedResultBinding
      : !hasFunnel || !hasRetrievalExecution || !hasRetainedResultBinding) ||
    !isNonEmptyString(value.exactRequest) ||
    !Array.isArray(value.queryMatrix) ||
    !Array.isArray(value.channels) ||
    !Array.isArray(value.exclusions) ||
    !isNonEmptyString(value.retrievedAt) ||
    value.outcomeValuesInspected !== false
  ) {
    return false;
  }

  const queryIds: string[] = [];
  for (const query of value.queryMatrix) {
    if (
      !isRecord(query) ||
      !hasExactKeys(query, ["id", "query", "purpose", "returnedRecordIds"]) ||
      !isNonEmptyString(query.id) ||
      !isNonEmptyString(query.query) ||
      !isNonEmptyString(query.purpose) ||
      !isStringArray(query.returnedRecordIds)
    ) {
      return false;
    }
    queryIds.push(query.id);
  }
  if (new Set(queryIds).size !== queryIds.length) return false;
  if (hasRetrievalExecution) {
    if (!(allowLegacyEmbeddedSchemas
      ? isCompatibleScreen02RetrievalExecution(value.retrievalExecution)
      : isScreen02RetrievalExecution(value.retrievalExecution))) return false;
    const compatibleExecution = migrateScreen02RetrievalExecution(
      value.retrievalExecution,
    );
    if (!compatibleExecution) return false;
    const executionQueryIds = [
      ...compatibleExecution.baseline.queryIds,
      ...(compatibleExecution.qualificationRecovery?.queryIds ?? []),
    ];
    const queryIdSet = new Set(queryIds);
    if (executionQueryIds.some((queryId) => !queryIdSet.has(queryId))) {
      return false;
    }
  }
  if (
    hasRetainedResultBinding &&
    (!isScreen02RetainedResultBinding(value.retainedResultBinding) ||
      value.retainedResultBinding.mode !== mode)
  ) return false;

  for (const channel of value.channels) {
    if (
      !isRecord(channel) ||
      !hasExactKeys(channel, ["channel", "status", "note", "retrievedAt"]) ||
      !isNonEmptyString(channel.channel) ||
      !isEnumValue(channel.status, ["searched", "not-searched", "failed"]) ||
      !isNonEmptyString(channel.note) ||
      !isNullableString(channel.retrievedAt)
    ) {
      return false;
    }
  }

  const excludedRecordIds: string[] = [];
  for (const exclusion of value.exclusions) {
    if (
      !isRecord(exclusion) ||
      !hasExactKeys(exclusion, [
        "recordId",
        "reason",
        ...(Object.hasOwn(exclusion, "qualification")
          ? ["qualification"]
          : []),
      ]) ||
      !isNonEmptyString(exclusion.recordId) ||
      !isNonEmptyString(exclusion.reason)
    ) {
      return false;
    }
    if (Object.hasOwn(exclusion, "qualification")) {
      const qualification = exclusion.qualification;
      if (
        !(allowLegacyEmbeddedSchemas
          ? isCompatibleScreen02CandidateQualification(qualification)
          : isScreen02CandidateQualification(qualification)) ||
        (qualification as { candidateId: string }).candidateId !==
          exclusion.recordId
      ) return false;
    }
    excludedRecordIds.push(exclusion.recordId);
  }
  if (new Set(excludedRecordIds).size !== excludedRecordIds.length) {
    return false;
  }

  if (
    hasFunnel &&
    !(allowLegacyEmbeddedSchemas
      ? isCompatibleScreen02SearchFunnel(value.funnel)
      : isScreen02SearchFunnel(value.funnel))
  ) return false;
  if (
    hasRetrievalExecution && isScreen02SearchFunnel(value.funnel) &&
    !screen02SearchFunnelMatchesRetrievalExecution(
      value.funnel,
      migrateScreen02RetrievalExecution(value.retrievalExecution),
    )
  ) return false;
  if (
    hasHostReviewApplication &&
    !isScreen02HostReviewApplication(value.hostReviewApplication)
  ) return false;

  const contextualLeadById = new Map<string, Screen02ContextLead>();
  if (hasContextLeads) {
    if (
      !Array.isArray(value.contextLeads) ||
      value.contextLeads.length > 5 ||
      value.contextLeads.some((lead) => !isScreen02ContextLead(lead))
    ) {
      return false;
    }
    const leadIds = value.contextLeads.map((lead) => lead.id);
    if (new Set(leadIds).size !== leadIds.length) return false;
    for (const lead of value.contextLeads) {
      contextualLeadById.set(lead.id, lead);
    }
  }

  if (hasContextBridges) {
    if (
      !Array.isArray(value.contextBridges) ||
      value.contextBridges.length > 1 ||
      value.contextBridges.some(
        (bridge) => !isScreen02ContextOfficialBridgeProvenance(bridge),
      )
    ) {
      return false;
    }
    const queryById = new Map(value.queryMatrix.map((query) => [
      query.id,
      query,
    ]));
    for (const bridge of value.contextBridges) {
      const lead = contextualLeadById.get(bridge.contextualLeadId);
      const query = queryById.get(bridge.bridgeQueryId);
      if (
        !lead ||
        screen02VisibleTitleFederalRegisterIdentifier(lead.title) !==
          bridge.formalIdentifier ||
        !query ||
        !screen02FederalRegisterBridgeQueryMatchesIdentifier(
          query.query,
          bridge.formalIdentifier,
        ) ||
        serializeDeterministicJson(query.returnedRecordIds) !==
          serializeDeterministicJson(bridge.returnedOfficialRecordIds)
      ) {
        return false;
      }
    }
  }

  return (
    isRecord(value.stoppingRule) &&
    hasExactKeys(value.stoppingRule, ["rule", "status", "note"]) &&
    isNonEmptyString(value.stoppingRule.rule) &&
    isEnumValue(value.stoppingRule.status, ["not-started", "met", "not-met"]) &&
    isNonEmptyString(value.stoppingRule.note)
  );
}

function validateAnchorRevision(
  value: unknown,
  expectedPreviousRevisionId: string | null,
): value is Screen02AuditAnchorRevision {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "anchorRevisionId",
      "previousRevisionId",
      "fields",
      "createdAt",
      "reason",
    ]) ||
    !isNonEmptyString(value.anchorRevisionId) ||
    value.previousRevisionId !== expectedPreviousRevisionId ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.reason) ||
    !isRecord(value.fields) ||
    !hasExactKeys(value.fields, [
      "shockName",
      "jurisdiction",
      "issuingAuthority",
      "approximateYear",
      "versionType",
      "distinguishingFeature",
      "sourceLocator",
      "clarification",
    ]) ||
    !isNonEmptyString(value.fields.shockName) ||
    !isNullableString(value.fields.jurisdiction) ||
    !isNullableString(value.fields.issuingAuthority) ||
    !isNullableString(value.fields.approximateYear) ||
    !isEnumValue(value.fields.versionType, screen02AuditVersionTypes) ||
    !isNullableString(value.fields.distinguishingFeature) ||
    !isNullableString(value.fields.sourceLocator) ||
    !isNullableString(value.fields.clarification)
  ) {
    return false;
  }
  return true;
}

function validateHistory(
  value: unknown,
  mode: "find" | "audit",
  allowLegacyEmbeddedSchemas = false,
): value is Screen02WorkflowHandoffHistory {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["searchManifests", "anchorRevisions", "decisions"]) ||
    !Array.isArray(value.searchManifests) ||
    !value.searchManifests.every((manifest) =>
      validateSearchManifest(manifest, mode, allowLegacyEmbeddedSchemas)
    ) ||
    !Array.isArray(value.anchorRevisions) ||
    !Array.isArray(value.decisions)
  ) {
    return false;
  }

  if (mode === "find" && value.anchorRevisions.length !== 0) return false;
  if (mode === "audit" && value.anchorRevisions.length === 0) return false;
  const anchorRevisionIds: string[] = [];
  for (const revision of value.anchorRevisions) {
    const previousRevisionId = anchorRevisionIds.at(-1) ?? null;
    if (!validateAnchorRevision(revision, previousRevisionId)) return false;
    anchorRevisionIds.push(revision.anchorRevisionId);
  }
  if (new Set(anchorRevisionIds).size !== anchorRevisionIds.length) return false;

  const allowedActions =
    mode === "find"
      ? [
          "opened",
          "open-cleared",
          "tentatively-selected",
          "selection-cleared",
          "removed",
          "continued",
          "continued-without-assessment",
        ]
      : [
          "confirmed",
          "related-version",
          "rejected",
          "anchor-revised",
          "reversed",
          "no-match",
          "continued",
          "continued-without-assessment",
        ];
  const decisionIds: string[] = [];
  let projectedFindSelection: string | null = null;
  for (const item of value.decisions) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["id", "action", "targetSnapshotId", "at", "reason"]) ||
      !isNonEmptyString(item.id) ||
      !isEnumValue(item.action, allowedActions) ||
      !isNullableString(item.targetSnapshotId) ||
      !isNonEmptyString(item.at) ||
      !isNonEmptyString(item.reason)
    ) {
      return false;
    }

    const requiresTarget =
      mode === "find"
        ? [
            "opened",
            "open-cleared",
            "tentatively-selected",
            "removed",
            "continued",
            "continued-without-assessment",
          ].includes(
            item.action,
          )
        : [
            "confirmed",
            "related-version",
            "rejected",
            "reversed",
            "continued",
            "continued-without-assessment",
          ].includes(item.action);
    const forbidsTarget =
      mode === "audit" &&
      ["anchor-revised", "no-match"].includes(item.action);
    if (
      (requiresTarget && item.targetSnapshotId === null) ||
      (forbidsTarget && item.targetSnapshotId !== null)
    ) {
      return false;
    }

    if (mode === "find") {
      if (item.action === "tentatively-selected") {
        projectedFindSelection = item.targetSnapshotId as string;
      } else if (item.action === "selection-cleared") {
        if (
          item.targetSnapshotId !== null &&
          item.targetSnapshotId !== projectedFindSelection
        ) {
          return false;
        }
        projectedFindSelection = null;
      } else if (
        item.action === "removed" &&
        item.targetSnapshotId === projectedFindSelection
      ) {
        projectedFindSelection = null;
      } else if (
        ["continued", "continued-without-assessment"].includes(item.action) &&
        item.targetSnapshotId !== projectedFindSelection
      ) {
        return false;
      }
    }
    decisionIds.push(item.id);
  }
  return new Set(decisionIds).size === decisionIds.length;
}

function selectedRetainedResultMatchesHandoff(
  history: Screen02WorkflowHandoffHistory,
  event: Screen02WorkflowHandoffEvent,
  decision: Screen02WorkflowHandoffDecision,
) {
  const currentManifests = history.searchManifests.filter(
    (manifest) =>
      manifest.protocolVersion === SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  );
  // A genuinely historical v3 handoff has no retained-result binding. Do not
  // manufacture one while restoring that compatibility shape.
  if (currentManifests.length === 0) return true;

  const selectedSnapshotId = decision.mode === "find"
    ? decision.candidateSnapshotId
    : decision.matchSnapshotId;
  const distinctProducerBindings = new Map<
    string,
    NonNullable<
      Screen02WorkflowSearchManifest["retainedResultBinding"]
    >["results"][number]
  >();
  for (const manifest of currentManifests) {
    const binding = manifest.retainedResultBinding;
    if (!binding) return false;
    const selectedResults = binding.results.filter(
      (result) => result.snapshotId === selectedSnapshotId,
    );
    if (selectedResults.length > 1) return false;
    const selectedResult = selectedResults[0];
    if (!selectedResult) continue;
    distinctProducerBindings.set(
      serializeDeterministicJson(binding),
      selectedResult,
    );
  }
  // Find filtering can create successor sets which repeat the exact immutable
  // producer manifest. Those byte-identical repetitions are one binding; a
  // second, conflicting producer binding for the selected snapshot is not.
  if (distinctProducerBindings.size !== 1) return false;
  const selectedResult = distinctProducerBindings.values().next().value;
  if (!selectedResult || selectedResult.snapshotId !== selectedSnapshotId) {
    return false;
  }

  if (decision.mode === "find") {
    const qualification = event.preliminaryQualification;
    return (
      event.identitySnapshotId === decision.candidateSnapshotId &&
      sameStringSet(selectedResult.sourceIds, event.sourceIds) &&
      selectedResult.qualificationLane === (qualification?.lane ?? null) &&
      (!qualification || selectedResult.recordId === qualification.candidateId)
    );
  }

  const eventSourceIds = new Set(event.sourceIds);
  return (
    event.identitySnapshotId === decision.identitySnapshotId &&
    selectedResult.qualificationLane === null &&
    selectedResult.sourceIds.every((sourceId) => eventSourceIds.has(sourceId))
  );
}

function validateEvent(
  value: unknown,
  mode: "find" | "audit",
  allowLegacyEmbeddedSchemas = false,
): value is Screen02WorkflowHandoffEvent {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "identitySnapshotId",
      "identity",
      "description",
      "dateLeads",
      "broadCoverage",
      "highLevelChanges",
      "keyComponents",
      "relatedVersions",
      "sourceIds",
      "limitations",
      "settlement",
      ...(Object.hasOwn(value, "preliminaryQualification")
        ? ["preliminaryQualification"]
        : []),
    ]) ||
    !isNonEmptyString(value.identitySnapshotId) ||
    !validateIdentity(value.identity) ||
    !isStringArray(value.sourceIds) ||
    !isStringArray(value.limitations) ||
    value.settlement !== "preliminary-screen-02" ||
    !Array.isArray(value.dateLeads) ||
    !Array.isArray(value.broadCoverage) ||
    !Array.isArray(value.highLevelChanges) ||
    !Array.isArray(value.keyComponents) ||
    !Array.isArray(value.relatedVersions)
  ) {
    return false;
  }

  if (Object.hasOwn(value, "preliminaryQualification")) {
    const qualification = value.preliminaryQualification;
    if (!(allowLegacyEmbeddedSchemas
      ? isCompatibleScreen02CandidateQualification(qualification)
      : isScreen02CandidateQualification(qualification))) return false;
    const compatibleQualification = qualification as {
      eligible: boolean;
      evidenceSourceIds: string[];
    };
    if (
      compatibleQualification.eligible !== true ||
      compatibleQualification.evidenceSourceIds.some(
        (id) => !(value.sourceIds as string[]).includes(id),
      )
    ) return false;
  }

  if (
    mode === "find" &&
    (value.highLevelChanges.length > 0 ||
      value.keyComponents.length > 0 ||
      value.relatedVersions.length > 0)
  ) {
    return false;
  }
  const allowedSourceIds = new Set(value.sourceIds);
  if (!validateClaim(value.description, allowedSourceIds)) return false;
  if (!value.dateLeads.every((lead) => validateDateLead(lead, allowedSourceIds))) {
    return false;
  }
  for (const claims of [
    value.broadCoverage,
    value.highLevelChanges,
    value.keyComponents,
  ]) {
    if (!claims.every((claim) => validateClaim(claim, allowedSourceIds))) {
      return false;
    }
  }
  if (
    !value.relatedVersions.every((related) =>
      validateRelatedVersion(related, allowedSourceIds),
    )
  ) {
    return false;
  }

  const claimIds = eventClaimIds(value as unknown as Screen02WorkflowHandoffEvent);
  return new Set(claimIds).size === claimIds.length;
}

function validateProvenance(
  value: unknown,
  mode: "find" | "audit",
): value is Screen02WorkflowHandoffProvenance {
  if (!isRecord(value) || value.mode !== mode) return false;
  if (mode === "find") {
    return (
      hasExactKeys(value, [
        "mode",
        "candidateSetSnapshotId",
        "candidateSetFingerprint",
        "candidateSnapshotId",
        "candidateFingerprint",
      ]) &&
      isNonEmptyString(value.candidateSetSnapshotId) &&
      isFingerprint(value.candidateSetFingerprint) &&
      isNonEmptyString(value.candidateSnapshotId) &&
      isFingerprint(value.candidateFingerprint)
    );
  }
  return (
    hasExactKeys(value, [
      "mode",
      "matchSetSnapshotId",
      "matchSetFingerprint",
      "matchSnapshotId",
      "matchFingerprint",
      "dossierSnapshotId",
      "dossierFingerprint",
      "confirmationSnapshotId",
      "confirmationFingerprint",
    ]) &&
    isNonEmptyString(value.matchSetSnapshotId) &&
    isFingerprint(value.matchSetFingerprint) &&
    isNonEmptyString(value.matchSnapshotId) &&
    isFingerprint(value.matchFingerprint) &&
    isNonEmptyString(value.dossierSnapshotId) &&
    isFingerprint(value.dossierFingerprint) &&
    isNonEmptyString(value.confirmationSnapshotId) &&
    isFingerprint(value.confirmationFingerprint)
  );
}

function validateHandoff(
  value: Record<string, unknown>,
  allowLegacyEmbeddedSchemas = false,
) {
  const currentSchema =
    value.schemaVersion === SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION;
  const legacyCompletedSchema =
    value.schemaVersion === SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION;
  const legacyUnavailableSchema =
    value.schemaVersion ===
    SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION;
  if (
    containsForbiddenScreen03Key(value) ||
    !hasExactKeys(
      value,
      currentSchema
        ? rootKeys
        : rootKeys.filter((key) => key !== "dossierCompletionOrigin"),
    )
  ) {
    return false;
  }
  if (
    (!currentSchema && !legacyCompletedSchema && !legacyUnavailableSchema) ||
    value.sourceScreen !== "screen-02" ||
    value.destinationScreen !== "screen-03" ||
    value.sourceSessionSchemaVersion !== SCREEN_02_WORKFLOW_SCHEMA_VERSION ||
    !["find", "audit"].includes(value.mode as string) ||
    value.outcomeValuesInspected !== false ||
    typeof value.producerAppVersion !== "string" ||
    !value.producerAppVersion.trim() ||
    typeof value.builtAt !== "string" ||
    !value.builtAt.trim() ||
    typeof value.runId !== "string" ||
    !value.runId.trim() ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0
  ) {
    return false;
  }
  const mode = value.mode as "find" | "audit";
  if (!isRecord(value.screen01Baseline)) return false;
  let baseline: Screen01StudyContext;
  try {
    baseline = requireReadyScreen01Context(
      clone(value.screen01Baseline) as Screen01StudyContext,
    );
  } catch {
    return false;
  }
  if (
    baseline.startingPoint !== mode ||
    !isFingerprint(value.screen01Fingerprint) ||
    value.screen01Fingerprint !== fingerprintScreen01StudyContext(baseline)
  ) {
    return false;
  }

  if (!validateEvent(value.event, mode, allowLegacyEmbeddedSchemas)) return false;
  const event = value.event;
  if (
    currentSchema && event.preliminaryQualification?.eligible === true &&
    !isFreshScreen02SelectionQualification(event.preliminaryQualification)
  ) return false;
  const eventSourceIds = new Set(event.sourceIds);

  if (!Array.isArray(value.sources) || !value.sources.every(validateSource)) {
    return false;
  }
  const sources = value.sources as Screen02WorkflowSource[];
  const carriedSourceIds = sources.map((source) => source.id);
  if (
    new Set(carriedSourceIds).size !== carriedSourceIds.length ||
    !sameStringSet(event.sourceIds, carriedSourceIds)
  ) {
    return false;
  }

  const assessmentUnavailable = validateUnavailableAssessment(
    value.preliminaryAssessment,
  );
  const completedAssessment = validateAssessment(
    value.preliminaryAssessment,
    mode,
    eventSourceIds,
    currentSchema,
  );
  if (!assessmentUnavailable && !completedAssessment) {
    return false;
  }
  if (
    (assessmentUnavailable && !currentSchema && !legacyUnavailableSchema) ||
    (completedAssessment && !currentSchema && !legacyCompletedSchema)
  ) {
    return false;
  }
  if (
    currentSchema &&
    (mode === "find"
      ? value.dossierCompletionOrigin !== null
      : !isEnumValue(
          value.dossierCompletionOrigin,
          screen02WorkflowCompletionOrigins,
        ))
  ) {
    return false;
  }
  const assessment = value.preliminaryAssessment;

  if (!Array.isArray(value.criteriaFindings)) return false;
  if (mode === "audit" && value.criteriaFindings.length !== 0) return false;
  const findingIds: string[] = [];
  const criterionIds: string[] = [];
  for (const finding of value.criteriaFindings) {
    if (
      !validateCriterionFinding(
        finding,
        event.identitySnapshotId,
        eventSourceIds,
      )
    ) {
      return false;
    }
    findingIds.push(finding.findingId);
    criterionIds.push(finding.criterionId);
  }
  if (
    new Set(findingIds).size !== findingIds.length ||
    new Set(criterionIds).size !== criterionIds.length
  ) {
    return false;
  }

  if (!validateHistory(value.history, mode, allowLegacyEmbeddedSchemas)) return false;
  const history = value.history;
  if (
    currentSchema &&
    history.searchManifests.at(-1)?.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION
  ) return false;
  const carriedSourceById = new Map(sources.map((source) =>
    [source.id, source] as const
  ));
  for (const manifest of history.searchManifests) {
    for (const acquisition of
      manifest.retrievalExecution?.documentAcquisitions ?? []) {
      if (acquisition.sourceId === null) continue;
      const source = carriedSourceById.get(acquisition.sourceId);
      if (
        !source ||
        !screen02DocumentAcquisitionMatchesSource(acquisition, source) ||
        (mode === "find" && event.preliminaryQualification &&
          acquisition.candidateId !==
            event.preliminaryQualification.candidateId)
      ) return false;
    }
  }

  if (!validateProvenance(value.provenance, mode)) return false;
  const provenance = value.provenance;

  if (!isRecord(value.decision)) return false;
  const decisionKeys =
    mode === "find"
      ? [
          "mode",
          "candidateSetSnapshotId",
          "candidateSnapshotId",
          "selectionDecisionId",
          "continuationDecisionId",
        ]
      : [
          "mode",
          "originalWording",
          "activeAnchorRevisionId",
          "matchSetSnapshotId",
          "matchSnapshotId",
          "identitySnapshotId",
          "dossierSnapshotId",
          "confirmationSnapshotId",
          "confirmationDecisionId",
          "continuationDecisionId",
        ];
  if (
    !hasExactKeys(value.decision, decisionKeys) ||
    value.decision.mode !== mode
  ) {
    return false;
  }

  const decision = value.decision;
  const decisionStringKeys =
    mode === "find"
      ? [
          "candidateSetSnapshotId",
          "candidateSnapshotId",
          "selectionDecisionId",
          "continuationDecisionId",
        ]
      : [
          "originalWording",
          "activeAnchorRevisionId",
          "matchSetSnapshotId",
          "matchSnapshotId",
          "identitySnapshotId",
          "dossierSnapshotId",
          "confirmationSnapshotId",
          "confirmationDecisionId",
          "continuationDecisionId",
        ];
  if (decisionStringKeys.some((key) => !isNonEmptyString(decision[key]))) {
    return false;
  }

  if (mode === "find") {
    if (
      provenance.mode !== "find" ||
      decision.candidateSetSnapshotId !==
        provenance.candidateSetSnapshotId ||
      decision.candidateSnapshotId !== provenance.candidateSnapshotId ||
      decision.candidateSnapshotId !== event.identitySnapshotId
    ) {
      return false;
    }
    let projectedSelection: string | null = null;
    for (const item of history.decisions) {
      if (item.action === "tentatively-selected") {
        projectedSelection = item.targetSnapshotId;
      } else if (item.action === "selection-cleared") {
        projectedSelection = null;
      } else if (
        item.action === "removed" &&
        item.targetSnapshotId === projectedSelection
      ) {
        projectedSelection = null;
      }
    }
    if (projectedSelection !== decision.candidateSnapshotId) return false;
    const selectionIndex = history.decisions.findIndex(
      (item) => item.id === decision.selectionDecisionId,
    );
    const continuationIndex = history.decisions.findIndex(
      (item) => item.id === decision.continuationDecisionId,
    );
    const selection = history.decisions[selectionIndex];
    const continuation = history.decisions[continuationIndex];
    if (
      !selection ||
      selection.action !== "tentatively-selected" ||
      selection.targetSnapshotId !== decision.candidateSnapshotId ||
      !continuation ||
      continuation.action !==
        (assessmentUnavailable
          ? "continued-without-assessment"
          : "continued") ||
      continuation.targetSnapshotId !== decision.candidateSnapshotId ||
      selectionIndex >= continuationIndex
    ) {
      return false;
    }
    if (
      assessmentUnavailable &&
      ((assessment as Screen02AssessmentUnavailableDisposition).recordedAt !==
        continuation.at ||
        (assessment as Screen02AssessmentUnavailableDisposition).reason !==
          continuation.reason)
    ) {
      return false;
    }
  } else {
    if (provenance.mode !== "audit") return false;
    let projectedIdentity: string | null = null;
    for (const item of history.decisions) {
      if (item.action === "confirmed") {
        projectedIdentity = item.targetSnapshotId;
      } else if (
        item.action === "anchor-revised" ||
        item.action === "no-match" ||
        ((item.action === "related-version" ||
          item.action === "rejected" ||
          item.action === "reversed") &&
          item.targetSnapshotId === projectedIdentity)
      ) {
        projectedIdentity = null;
      }
    }
    if (
      decision.matchSetSnapshotId !== provenance.matchSetSnapshotId ||
      decision.matchSnapshotId !== provenance.matchSnapshotId ||
      decision.dossierSnapshotId !== provenance.dossierSnapshotId ||
      decision.confirmationSnapshotId !==
        provenance.confirmationSnapshotId ||
      decision.identitySnapshotId !== event.identitySnapshotId ||
      projectedIdentity !== decision.identitySnapshotId ||
      !screen02EventWordingMatches(
        decision.originalWording as string,
        baseline.knownShock,
      ) ||
      history.anchorRevisions.at(-1)?.anchorRevisionId !==
        decision.activeAnchorRevisionId ||
      history.anchorRevisions[0]?.fields.shockName !== baseline.knownShock
    ) {
      return false;
    }
    const confirmationIndex = history.decisions.findIndex(
      (item) => item.id === decision.confirmationDecisionId,
    );
    const continuationIndex = history.decisions.findIndex(
      (item) => item.id === decision.continuationDecisionId,
    );
    const confirmation = history.decisions[confirmationIndex];
    const continuation = history.decisions[continuationIndex];
    if (
      !confirmation ||
      confirmation.action !== "confirmed" ||
      confirmation.targetSnapshotId !== decision.identitySnapshotId ||
      !continuation ||
      continuation.action !==
        (assessmentUnavailable
          ? "continued-without-assessment"
          : "continued") ||
      continuation.targetSnapshotId !== decision.identitySnapshotId ||
      confirmationIndex >= continuationIndex
    ) {
      return false;
    }
    if (
      assessmentUnavailable &&
      ((assessment as Screen02AssessmentUnavailableDisposition).recordedAt !==
        continuation.at ||
        (assessment as Screen02AssessmentUnavailableDisposition).reason !==
          continuation.reason)
    ) {
      return false;
    }
    if (
      provenance.confirmationFingerprint !==
      fingerprintScreen02WorkflowValue({
        confirmationSnapshotId: provenance.confirmationSnapshotId,
        identitySnapshotId: decision.identitySnapshotId,
        matchSnapshotId: provenance.matchSnapshotId,
        matchSetSnapshotId: provenance.matchSetSnapshotId,
        anchorRevisionId: decision.activeAnchorRevisionId,
        dossierSnapshotId: provenance.dossierSnapshotId,
        dossierFingerprint: provenance.dossierFingerprint,
        decisionId: decision.confirmationDecisionId,
        confirmedAt: confirmation.at,
      })
    ) {
      return false;
    }
  }

  if (
    !selectedRetainedResultMatchesHandoff(
      history,
      event,
      decision as unknown as Screen02WorkflowHandoffDecision,
    )
  ) {
    return false;
  }

  if (!isRecord(value.unresolved)) return false;
  const unresolved = value.unresolved;
  if (
    !hasExactKeys(unresolved, [
      "questions",
      "provisionalClaimIds",
      "screen03Boundary",
    ]) ||
    !isStringArray(unresolved.questions) ||
    !isStringArray(unresolved.provisionalClaimIds) ||
    unresolved.screen03Boundary !== screen03Boundary
  ) {
    return false;
  }
  const questions = unresolved.questions;
  const provisionalClaimIds = unresolved.provisionalClaimIds;
  const expectedClaimIds = eventClaimIds(event);
  const assessmentQuestions = assessmentUnavailable
    ? (assessment as Screen02AssessmentUnavailableDisposition)
        .mandatoryScreen03Checks
    : (assessment as Screen02WorkflowHandoffCompletedAssessment).nextChecks;
  if (
    !assessmentQuestions.every((question) => questions.includes(question)) ||
    provisionalClaimIds.length !== expectedClaimIds.length ||
    !provisionalClaimIds.every((id, index) => id === expectedClaimIds[index])
  ) {
    return false;
  }

  if (!isRecord(value.integrity)) return false;
  if (
    !hasExactKeys(value.integrity, [
      "stateFingerprint",
      "eventFingerprint",
      "historyFingerprint",
      "handoffFingerprint",
    ]) ||
    !isFingerprint(value.integrity.stateFingerprint) ||
    !isFingerprint(value.integrity.eventFingerprint) ||
    !isFingerprint(value.integrity.historyFingerprint) ||
    !isFingerprint(value.integrity.handoffFingerprint)
  ) {
    return false;
  }
  const candidate = value as unknown as Screen02WorkflowHandoff;
  return (
    candidate.integrity.eventFingerprint ===
      fingerprintScreen02WorkflowValue(candidate.event) &&
    candidate.integrity.historyFingerprint ===
      fingerprintScreen02WorkflowValue(candidate.history) &&
    candidate.integrity.handoffFingerprint ===
      fingerprintScreen02WorkflowValue(handoffFingerprintInput(candidate))
  );
}

function restoreStructurallyValidScreen02WorkflowHandoff(
  value: unknown,
  allowLegacyEmbeddedSchemas = false,
): Screen02WorkflowHandoff | null {
  try {
    if (!isRecord(value)) return null;
    const copy = clone(value);
    if (!validateHandoff(copy, allowLegacyEmbeddedSchemas)) return null;
    return deepFreeze(copy as unknown as Screen02WorkflowHandoff);
  } catch {
    return null;
  }
}

function requireStructurallyValidScreen02WorkflowHandoff(value: unknown) {
  const restored = restoreStructurallyValidScreen02WorkflowHandoff(value);
  if (!restored) fail("Screen 2 workflow handoff failed its contract.");
  return restored;
}

function migrateHandoffSearchManifest(
  manifest: Screen02WorkflowSearchManifest,
) {
  if (manifest.retrievalExecution) {
    const retrievalExecution = migrateScreen02RetrievalExecution(
      manifest.retrievalExecution,
    );
    if (!retrievalExecution) return false;
    manifest.retrievalExecution = retrievalExecution;
  }
  const qualificationByCandidateId = new Map<
    string,
    Screen02CandidateQualification
  >();
  for (const exclusion of manifest.exclusions) {
    if (!exclusion.qualification) continue;
    const qualification = migrateScreen02CandidateQualification(
      exclusion.qualification,
    );
    if (!qualification) return false;
    exclusion.qualification = qualification;
    qualificationByCandidateId.set(qualification.candidateId, qualification);
  }
  if (!manifest.funnel) return true;
  const recovered = {
    demonstratedMismatch: 0,
    insufficientEvidence: 0,
    mixed: 0,
  };
  for (const qualification of qualificationByCandidateId.values()) {
    if (qualification.hardScope.disposition === "demonstrated-mismatch") {
      recovered.demonstratedMismatch += 1;
    } else if (
      qualification.hardScope.disposition === "insufficient-evidence"
    ) {
      recovered.insufficientEvidence += 1;
    } else if (qualification.hardScope.disposition === "mixed") {
      recovered.mixed += 1;
    }
  }
  const funnel = migrateScreen02SearchFunnel(manifest.funnel, recovered);
  if (!funnel) return false;
  manifest.funnel = funnel;
  return true;
}

function migrateWorkflowHandoffEmbeddedSchemas(
  legacy: Screen02WorkflowHandoff,
  sourceState: Screen02WorkflowState,
) {
  const migrated = clone(legacy);
  if (migrated.event.preliminaryQualification) {
    const qualification = migrateScreen02CandidateQualification(
      migrated.event.preliminaryQualification,
    );
    if (!qualification) return null;
    migrated.event.preliminaryQualification = qualification;
  }
  if (
    migrated.history.searchManifests.some(
      (manifest) => !migrateHandoffSearchManifest(manifest),
    )
  ) return null;

  const provenance = migrated.provenance;
  if (provenance.mode === "find" && sourceState.mode === "find") {
    const set = sourceState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
          provenance.candidateSetSnapshotId,
    );
    const candidate = sourceState.candidates.find(
      (item) =>
        item.candidateSnapshotId === provenance.candidateSnapshotId,
    );
    if (!set || !candidate) return null;
    provenance.candidateSetFingerprint = set.candidateSetFingerprint;
    provenance.candidateFingerprint = candidate.candidateFingerprint;
  } else if (
    provenance.mode === "audit" &&
    sourceState.mode === "audit"
  ) {
    const set = sourceState.matchSets.find(
      (matchSet) =>
        matchSet.matchSetSnapshotId === provenance.matchSetSnapshotId,
    );
    if (!set) return null;
    provenance.matchSetFingerprint = set.matchSetFingerprint;
  } else {
    return null;
  }

  migrated.integrity.stateFingerprint =
    fingerprintScreen02WorkflowState(sourceState);
  migrated.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    migrated.event,
  );
  migrated.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    migrated.history,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    migrated.integrity;
  migrated.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...migrated,
    integrity,
  });
  return migrated;
}

export function restoreScreen02WorkflowHandoff(
  value: unknown,
  sourceState: Screen02WorkflowState,
): Screen02WorkflowHandoff | null {
  try {
    const canonicalState = requireScreen02WorkflowState(sourceState);
    let restored = restoreStructurallyValidScreen02WorkflowHandoff(value);
    if (!restored) {
      const compatible = restoreStructurallyValidScreen02WorkflowHandoff(
        value,
        true,
      );
      if (!compatible) return null;
      const migrated = migrateWorkflowHandoffEmbeddedSchemas(
        compatible,
        canonicalState,
      );
      if (!migrated) return null;
      restored = restoreStructurallyValidScreen02WorkflowHandoff(migrated);
      if (!restored) return null;
    }
    const currentExpected = buildScreen02WorkflowHandoff(
      canonicalState,
      restored.producerAppVersion,
      restored.builtAt,
    );
    const expected =
      restored.schemaVersion ===
        SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION ||
      restored.schemaVersion ===
        SCREEN_02_WORKFLOW_HANDOFF_LEGACY_UNAVAILABLE_SCHEMA_VERSION
        ? projectCurrentHandoffToLegacy(currentExpected, restored.schemaVersion)
        : currentExpected;
    return serializeDeterministicJson(restored) ===
      serializeDeterministicJson(expected)
      ? restored
      : null;
  } catch {
    return null;
  }
}

export function requireScreen02WorkflowHandoff(
  value: unknown,
  sourceState: Screen02WorkflowState,
) {
  const restored = restoreScreen02WorkflowHandoff(value, sourceState);
  if (!restored) {
    fail(
      "Screen 2 workflow handoff failed its source-state contract.",
    );
  }
  return restored;
}

export function serializeScreen02WorkflowHandoff(value: unknown) {
  return serializeDeterministicJson(
    requireStructurallyValidScreen02WorkflowHandoff(value),
  );
}

export function fingerprintScreen02WorkflowHandoff(value: unknown) {
  return fingerprintScreen02WorkflowValue(
    requireStructurallyValidScreen02WorkflowHandoff(value),
  );
}
