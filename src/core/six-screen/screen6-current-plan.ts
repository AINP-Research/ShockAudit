import { fingerprintSixScreenValue } from "./canonical";
import type { SixScreenWorkflowState } from "./contracts";
import { readCurrentPolicyEvidence } from "./current-policy-evidence";
import {
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  currentStudyDesignSelection,
  currentProposedTreatmentTiming,
} from "./study-design-advice";
import { currentStudyFirstEventInvestigation } from
  "./study-first-event-investigation";
import {
  currentStudyFirstMechanismContext,
  currentStudyFirstMechanismRunForState,
} from "./workflow";
import {
  SCREEN6_UNCERTAINTY_DIMENSIONS,
  type Screen6UncertaintyDimensionId,
} from "./screen6-uncertainty-profile";
import {
  screen6ReviewedDiagnosticLibrary,
  SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
  type Screen6DiagnosticLibraryEntry,
} from "./screen6-diagnostic-plan";

export const SCREEN6_CURRENT_PLAN_VERSION = "screen-06-current-study-plan-v3" as const;
export const SCREEN6_CONTEXTUALIZER_TASK_VERSION = "screen-06-contextualization-v4" as const;
const SCREEN6_V24_PLAN_VERSION = "screen-06-current-study-plan-v2" as const;
const SCREEN6_V24_CONTEXTUALIZER_TASK_VERSION =
  "screen-06-contextualization-v3" as const;
const SCREEN6_DEPENDENCY_MANIFEST_VERSION =
  "screen-06-dependency-manifest-v1" as const;
type LibraryId = Screen6DiagnosticLibraryEntry["id"];
type PlanCard = {
  id: string;
  label: string;
  category: Screen6DiagnosticLibraryEntry["category"];
  reason: string;
  status: "planned" | "prerequisites_needed";
  prerequisites: string[];
  procedure: string[];
  concern: string[];
  alternatives: string[];
  limits: string[];
  response: string[];
  references: string[];
  dimensionIds: Screen6UncertaintyDimensionId[];
  evidenceRefs?: string[];
};

const relevantPolicyPredicates = new Set([
  "operative_change", "substantive_obligation", "coverage_condition",
  "territorial_nexus", "threshold_condition", "exemption_rule",
  "implementation_schedule", "policy_date", "legal_effect_date",
  "historical_version_change", "contemporaneous_amendment_record",
]);

/** Exact study binding used by the v24 Screen 3 advice coordinate. */
function legacyV24StudyFingerprint(study: SixScreenWorkflowState["study"]) {
  return fingerprintSixScreenValue({
    id: study.id,
    revision: study.revision,
    population: study.population,
    analysisUnit: study.analysisUnit,
    geography: study.geography,
    industry: study.industry,
    period: study.period,
    outcome: study.outcome,
    outcomeMeasure: study.outcomeMeasure ?? null,
    intendedConstruct: study.intendedConstruct,
    policySideConcept: study.policySideConcept ?? null,
    initialExplanation: study.initialExplanation,
    proposedTreatment: study.proposedTreatment,
    proposedComparison: study.proposedComparison,
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  });
}

function legacyV24AdviceFingerprint(
  advice: ReturnType<typeof currentStudyDesignAdvice>,
  state: SixScreenWorkflowState,
) {
  if (!advice) return null;
  const studyFingerprint = legacyV24StudyFingerprint(state.study);
  return advice.binding.studyFingerprint === studyFingerprint
    ? advice.adviceFingerprint : null;
}

function legacyV24SelectionFingerprint(input: {
  selection: ReturnType<typeof currentStudyDesignSelection>;
  adviceFingerprint: string | null;
}) {
  if (!input.selection || !input.adviceFingerprint) return null;
  return input.selection.adviceFingerprint === input.adviceFingerprint
    ? input.selection.selectionFingerprint : null;
}

function currentPolicyEvidence(state: SixScreenWorkflowState) {
  const evidence = readCurrentPolicyEvidence(state);
  const card = [...(state.policyEventCardReviews ?? [])].reverse().find((item) =>
    item.status === "locked" && item.lockedEventCard &&
    item.binding.identityFingerprint === evidence.identityFingerprint &&
    Boolean(evidence.evidenceSnapshotFingerprint) &&
    item.binding.evidenceSnapshotFingerprint === evidence.evidenceSnapshotFingerprint)
    ?.lockedEventCard ?? null;
  const historicalCardChronology = card ? [
    ...card.chronology.absoluteClocks,
    ...card.chronology.relativeClocks,
    ...card.chronology.undatedClocks,
  ].map((clock) => ({ id: clock.id, stage: clock.stage, label: clock.label,
    timing: clock.timing, claimIds: clock.statements.map((item) => item.claimId),
    sourceIds: [...new Set(clock.lineages.map((item) => item.sourceId))],
    conflictIds: clock.conflictIds, hasUnresolvedConflict: clock.hasUnresolvedConflict,
    qualifications: clock.qualifications })) : [];
  const currentChronology = evidence.chronology.map((item) => ({
    id: item.id, stage: item.stage, label: item.label,
    timing: item.date.start
      ? { mode: "absolute" as const, start: item.date.start,
          end: item.date.end, precision: item.date.precision }
      : { mode: "undated" as const,
          reason: "source_did_not_establish_a_normalized_date" as const },
    claimIds: item.claimIds, sourceIds: item.sourceIds,
    documentVersionIds: item.documentVersionIds,
    conflictIds: item.conflictIds,
    hasUnresolvedConflict: item.conflictIds.length > 0,
    qualifications: item.qualification ? [item.qualification] : [],
  }));
  // A bound historical card remains readable for an old incomplete review,
  // with its provenance explicitly distinct from current Screen 2 milestones.
  const chronology = currentChronology.length
    ? currentChronology : historicalCardChronology;
  const reviewedClaims = new Map(card?.claims.map((claim) => [
    claim.claimId, claim]) ?? []);
  const claims = evidence.claims.filter((claim) =>
    relevantPolicyPredicates.has(claim.predicate)).map((claim) => ({
      id: claim.id, kind: claim.predicate, statement: claim.statement,
      support: claim.support, qualification: claim.qualification,
      sourceId: claim.sourceId, sourceTitle: claim.sourceTitle,
      sourceUrl: claim.sourceUrl, sourceRole: claim.sourceRole,
      passageId: claim.passageId,
      documentVersionId: claim.documentVersionId,
      decision: reviewedClaims.get(claim.id)?.decision ?? "unreviewed",
      effectiveStatement: reviewedClaims.get(claim.id)?.effectiveStatement ?? null,
      statementOrigin: reviewedClaims.get(claim.id)?.statementOrigin ?? "evidence_claim",
    }));
  return { status: evidence.status, claims, chronology,
    chronologyOrigin: currentChronology.length ? evidence.chronologyOrigin
      : historicalCardChronology.length ? "historical_reviewed_card" as const
        : evidence.chronologyOrigin,
    treatmentClock: card?.treatmentClock ?? null,
    conflictIds: [...new Set([...evidence.chronology.flatMap((item) =>
      item.conflictIds), ...(card?.conflicts.map((item) => item.id) ?? [])])],
    unresolvedRequirementIds: card?.unresolvedRequirements.map((item) =>
      item.requirementId) ?? [],
    unresolvedEvidence: evidence.unresolved,
    reviewFingerprint: evidence.reviewFingerprint,
    cardFingerprint: card?.eventCardFingerprint ?? null };
}

type CurrentPolicyClaim = ReturnType<typeof currentPolicyEvidence>["claims"][number];

const coverageKindLabels: Record<string, string> = {
  coverage_condition: "who or what is covered",
  territorial_nexus: "where qualifying activity occurs",
  threshold_condition: "size or activity thresholds",
  exemption_rule: "exceptions or exclusions",
};

/**
 * Main guidance names the kind and provenance of the rules without attempting
 * to paraphrase their boolean logic. Exact statements, qualifications and
 * every claim ID remain in `upstream.policyEvidence.claims` for the evidence
 * detail and export. This avoids turning an AND/OR condition or exemption into
 * a lossy eligibility shortcut merely to fit a compact card.
 */
function coverageRecordSummary(claims: CurrentPolicyClaim[]) {
  const uniqueRules = new Map<string, CurrentPolicyClaim>();
  for (const claim of claims) {
    const key = fingerprintSixScreenValue({
      kind: claim.kind,
      statement: claim.effectiveStatement ?? claim.statement,
      qualification: claim.qualification,
      sourceId: claim.sourceId,
      documentVersionId: claim.documentVersionId,
    });
    if (!uniqueRules.has(key)) uniqueRules.set(key, claim);
  }
  const rules = [...uniqueRules.values()];
  const categories = [...new Set(rules.map((claim) =>
    coverageKindLabels[claim.kind] ?? "another applicability condition"))];
  const documentVersions = new Set(rules.map((claim) =>
    `${claim.sourceId}:${claim.documentVersionId ?? "version-unspecified"}`));
  const qualifications = rules.filter((claim) => claim.qualification).length;
  const unresolved = rules.filter((claim) => claim.decision === "unreviewed" ||
    claim.support !== "direct").length;
  if (!rules.length) {
    return {
      text: "No current applicability rule is documented in the source record.",
      ruleCount: 0,
      documentVersionCount: 0,
      categories: [] as string[],
    };
  }
  const categoryText = categories.length === 1 ? categories[0]!
    : categories.length === 2 ? `${categories[0]} and ${categories[1]}`
      : `${categories.slice(0, -1).join(", ")}, and ${categories.at(-1)}`;
  const caveats = [
    qualifications ? `${qualifications} recorded qualification${qualifications === 1 ? "" : "s"}` : null,
    unresolved ? `${unresolved} rule${unresolved === 1 ? "" : "s"} with indirect, conflicting, or unreviewed support` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    text: `The current evidence records ${rules.length} distinct applicability rule${
      rules.length === 1 ? "" : "s"} across ${documentVersions.size} source document version${
      documentVersions.size === 1 ? "" : "s"}, covering ${categoryText}.${
      caveats.length ? ` It also retains ${caveats.join(" and ")}.` : ""} Apply the linked passages together, including their exact conditions and exceptions, before classifying any unit.`,
    ruleCount: rules.length,
    documentVersionCount: documentVersions.size,
    categories,
  };
}

function relevantEvents(eventWork: NonNullable<SixScreenWorkflowState[
  "studyFirstEventInvestigations"]>[number] | null) {
  const occurrences = screen6NamedEventOccurrences(eventWork);
  const analyses = new Map(eventWork?.analyses.map((item) => [item.eventId, item]) ?? []);
  const rank = { high: 0, medium: 1, low: 2, background: 3 };
  const ordered = occurrences.map((item) => ({ item,
    analysis: analyses.get(item.id) ?? null })).sort((a, b) =>
    (rank[a.analysis?.relevanceOrder.priorityBand ?? "background"] -
      rank[b.analysis?.relevanceOrder.priorityBand ?? "background"]) ||
    a.item.id.localeCompare(b.item.id));
  return { selected: ordered.slice(0, 6).map(({ item, analysis }) => ({
    id: item.id, title: item.title, dates: item.typedDates,
    occurrenceStatus: item.occurrenceStatus,
    relationStatus: item.relationToComparison.status,
    relevanceBand: analysis?.relevanceOrder.priorityBand ?? "unassessed",
    relevanceOrigin: analysis?.interpretationMode ?? "not_assessed",
    affectedActivity: analysis?.affectedActorOrActivity ?? null,
    outcomePathway: analysis?.outcomePathway ?? null,
    comparisonImplication: analysis?.comparisonImplication ?? null,
    uncertainty: analysis?.materialUncertainty ?? null,
    sourceIds: item.evidence.map((source) => source.sourceId),
  })), omittedCount: Math.max(0, ordered.length - 6),
    totalCount: ordered.length, selectionRule:
      "Screen 4 relevance band (high first), then stable occurrence ID; omitted records remain in Screen 4." };
}

/** Saved names are useful leads even when a review was interrupted, or a
 * method choice changed its binding. They never become current assessments
 * merely by being carried into the design map or report. */
export function screen6RetainedEventInvestigation(
  state: SixScreenWorkflowState,
): NonNullable<SixScreenWorkflowState["studyFirstEventInvestigations"]>[number] | null {
  const current = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: state.confirmedShock,
    study: state.study,
    entryContext: currentScreen3StudyEntryContext(state),
    timing: currentProposedTreatmentTiming(state),
    advice: currentStudyDesignAdvice(state),
    selection: currentStudyDesignSelection(state),
  });
  if (current && screen6NamedEventOccurrences(current).length) return current;
  const samePolicy = [...(state.studyFirstEventInvestigations ?? [])]
    .reverse().filter((item) => item.context.policy.identityFingerprint ===
      state.confirmedShock?.identityFingerprint &&
      screen6NamedEventOccurrences(item).length);
  return samePolicy.find((item) => item.context.study.revision ===
    state.study.revision) ?? samePolicy[0] ?? current;
}

export function screen6NamedEventOccurrences(
  investigation: NonNullable<SixScreenWorkflowState["studyFirstEventInvestigations"]>[number] | null,
) {
  if (!investigation) return [];
  const visible = investigation.presentation?.visibleEventIds;
  return visible
    ? visible.flatMap((id) => investigation.occurrences.filter((item) =>
        item.id === id))
    : investigation.occurrences.slice(0, 10);
}

/** Read-only view of authenticated durable source results. The small saved
 * workflow placeholder and its integrity fingerprint remain untouched. */
export function screen6StateWithEventSource(
  state: SixScreenWorkflowState,
  source: {
    investigation: NonNullable<SixScreenWorkflowState["studyFirstEventInvestigations"]>[number] | null;
    documentedOccurrences?: NonNullable<SixScreenWorkflowState["studyFirstEventInvestigations"]>[number]["occurrences"];
  },
) {
  const investigation = source.investigation;
  const saved = state.studyFirstEventInvestigations?.find((item) =>
    item.snapshotId === investigation?.snapshotId) ??
    state.studyFirstEventInvestigations?.find((item) =>
      item.snapshotId === investigation?.previousSnapshotId);
  if (!investigation || !saved || saved.context.contextFingerprint !==
      investigation.context.contextFingerprint ||
      saved.plan.planFingerprint !== investigation.plan.planFingerprint) return state;
  let projected = investigation;
  if (investigation.status === "planned" &&
      source.documentedOccurrences?.length) {
    const { investigationFingerprint: _, ...body } = investigation;
    const partial = { ...body, status: "running" as const,
      occurrences: source.documentedOccurrences.slice(0, 10) };
    projected = { ...partial, investigationFingerprint: fingerprintSixScreenValue(partial) };
  }
  return { ...state, studyFirstEventInvestigations:
    state.studyFirstEventInvestigations!.map((item) =>
      item.snapshotId === saved.snapshotId ? projected : item) };
}

/** A read-only, zero-inference plan. The fingerprint binds scientific inputs,
 * not UI/build identifiers. Unknown data remain unknown. */
export function createScreen6CurrentPlan(state: SixScreenWorkflowState) {
  const study = state.study;
  const policy = state.confirmedShock;
  const advice = currentStudyDesignAdvice(state);
  const designCritique = advice ? [...(state.screen3Contextualizations ?? [])]
    .reverse().find((item) => item.adviceFingerprint === advice.adviceFingerprint &&
      item.status === "completed") ?? null : null;
  const selection = currentStudyDesignSelection(state);
  const v24AdviceFingerprint = legacyV24AdviceFingerprint(advice, state);
  const v24SelectionFingerprint = legacyV24SelectionFingerprint({
    selection,
    adviceFingerprint: v24AdviceFingerprint,
  });
  const decision = selection?.decision;
  const selectedOption = decision?.mode === "selected"
    ? advice?.options.find((option) =>
        option.optionId === decision.optionId) ?? null
    : null;
  const timing = currentProposedTreatmentTiming(state);
  const policyEvidence = currentPolicyEvidence(state);
  const mechanism = currentStudyFirstMechanismRunForState(state);
  const mechanismContext = currentStudyFirstMechanismContext(state);
  const currentInput = mechanism?.input ??
    [...(state.studyFirstMechanismInputs ?? [])].reverse().find((item) =>
      item.contextFingerprint === mechanismContext?.contextFingerprint) ?? null;
  // v24 selected these coordinates before the stricter current-context event
  // resolver and historical focal-wording carry-forward were introduced.
  // Keep the exact old selectors frozen here: compatibility must reproduce
  // the coordinate that was actually persisted, not a current approximation
  // with two version strings changed.
  const legacyV24SavedInput = mechanism?.input ??
    [...(state.studyFirstMechanismInputs ?? [])].reverse().find((item) =>
      item.contextFingerprint === mechanismContext?.contextFingerprint) ?? null;
  const legacyV24EventWork = [...(state.studyFirstEventInvestigations ?? [])]
    .reverse().find((item) => item.context.policy.identityFingerprint ===
      policy?.identityFingerprint && item.context.study.revision ===
      study.revision &&
      (item.context.methodSelection?.selectionFingerprint ?? null) ===
      v24SelectionFingerprint) ?? null;
  const lastInput = (state.studyFirstMechanismInputs ?? []).at(-1) ?? null;
  const lastInputRun = lastInput ? [...(state.studyFirstMechanismRuns ?? [])]
    .reverse().find((run) => run.input.inputFingerprint ===
      lastInput.inputFingerprint) : null;
  // Researcher-owned focal wording remains available after a study edit.
  // Earlier analysis is not thereby rebound to the revised scientific context.
  const savedInput = currentInput ?? (lastInputRun?.context.policy
    .identityFingerprint === policy?.identityFingerprint ? lastInput : null);
  const eventWork = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: policy,
    study,
    entryContext: currentScreen3StudyEntryContext(state),
    timing,
    advice,
    selection,
  });
  const eventLeadWork = screen6RetainedEventInvestigation(state);
  const eventContextFit = !eventLeadWork
    ? null
    : eventLeadWork === eventWork
      ? "current" as const
      : eventLeadWork.context.contextFingerprint ===
          eventWork?.context.contextFingerprint
        ? "same_study_earlier_scan" as const
      : eventLeadWork.context.study.revision === study.revision
        ? "same_study_earlier_design" as const
        : "earlier_study" as const;
  const suppliedFeasibility = [...(state.screen6DiagnosticPlans ?? [])].reverse()
    .find((item) => item.binding.studyRevision === study.revision &&
      item.binding.identityFingerprint === policy?.identityFingerprint) ?? null;
  const candidates = mechanism?.planning?.plan?.candidates ?? [];
  const comparison = mechanism?.providerExecution?.comparison ?? null;
  const events = relevantEvents(eventLeadWork);
  const execution = mechanism?.providerExecution ?? null;
  const mechanismStatus = !savedInput ? "no_focal_input" as const
    : !execution ? "focal_saved_without_direct_job" as const
    : execution.phase === "completed" ? "completed" as const
    : ["failed", "blocked", "outcome_unknown"].includes(execution.phase)
      ? "interrupted" as const : "in_progress" as const;
  const refs = {
    planVersion: SCREEN6_CURRENT_PLAN_VERSION,
    contextualizerTaskVersion: SCREEN6_CONTEXTUALIZER_TASK_VERSION,
    studyRevision: study.revision,
    policyFingerprint: policy?.identityFingerprint ?? null,
    policyEvidenceFingerprint: policyEvidence.reviewFingerprint,
    reviewedEventCardFingerprint: policyEvidence.cardFingerprint,
    timingFingerprint: timing?.timingFingerprint ?? null,
    adviceFingerprint: advice?.adviceFingerprint ?? null,
    designCritiqueFingerprint: designCritique?.receipt?.contentFingerprint ?? null,
    selectionFingerprint: selection?.selectionFingerprint ?? null,
    eventFingerprint: eventLeadWork?.investigationFingerprint ?? null,
    finalizedMechanismFingerprint: savedInput?.inputFingerprint ?? null,
    planFingerprint: mechanism?.planning?.plan?.planFingerprint ?? null,
    assessmentFingerprint: comparison?.comparisonFingerprint ?? null,
    mechanismReceiptFingerprints: execution?.attempts.flatMap((attempt) =>
      attempt.responseReceipt ? [attempt.responseReceipt.contentFingerprint] : []) ?? [],
    mechanismPhase: execution?.phase ?? null,
    feasibilityFingerprint: suppliedFeasibility?.diagnosticInput.inputFingerprint ?? null,
    libraryVersion: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
  };
  const legacyV24SnapshotRefs = v24AdviceFingerprint ? {
    ...refs,
    planVersion: SCREEN6_V24_PLAN_VERSION,
    contextualizerTaskVersion: SCREEN6_V24_CONTEXTUALIZER_TASK_VERSION,
    adviceFingerprint: v24AdviceFingerprint,
    designCritiqueFingerprint:
      designCritique?.adviceFingerprint === v24AdviceFingerprint
        ? designCritique.receipt?.contentFingerprint ?? null : null,
    selectionFingerprint: v24SelectionFingerprint,
    eventFingerprint: legacyV24EventWork?.investigationFingerprint ?? null,
    finalizedMechanismFingerprint:
      legacyV24SavedInput?.inputFingerprint ?? null,
  } : null;
  const legacyV24InputFingerprint = legacyV24SnapshotRefs
    ? fingerprintSixScreenValue(legacyV24SnapshotRefs) : null;
  const upstream = {
    study: { revision: study.revision, source: "researcher_saved_study" as const },
    policy: policy ? {
      identityFingerprint: policy.identityFingerprint,
      episode: policy.episode,
      source: "researcher_confirmed_identity" as const,
    } : null,
    policyEvidence,
    treatmentTiming: timing ? {
      mode: timing.mode, year: timing.year,
      precision: timing.precision, milestoneReference: timing.milestoneReference,
      origin: timing.origin, fingerprint: timing.timingFingerprint,
    } : null,
    comparison: {
      decision: selection?.decision ?? { mode: "not_selected" as const },
      selectionFingerprint: selection?.selectionFingerprint ?? null,
      advisoryOptionIds: advice?.options.map((item) => item.optionId) ?? [],
    },
    designConcerns: advice?.warnings.map((warning) => ({
      ruleId: warning.ruleId, severity: warning.severity,
      basis: warning.basis ?? "empirical_requirement",
      message: warning.message, whyItMatters: warning.whyItMatters,
      nextCheck: warning.whatToCheck,
      sourceRefs: warning.triggerEvidenceRefs,
      methodRefs: warning.methodReferenceIds,
    })) ?? [],
    designCritique: designCritique?.supplement ?? null,
    otherEvents: eventLeadWork ? {
      snapshotId: eventLeadWork.snapshotId,
      status: eventLeadWork.status,
      contextFit: eventContextFit,
      retainedNames: screen6NamedEventOccurrences(eventLeadWork).map((event) =>
        ({ id: event.id, title: event.title })),
      coverage: eventLeadWork.presentation ? {
        attemptedBranches:
          eventLeadWork.presentation.coverage.attemptedBranches,
        completedBranches:
          eventLeadWork.presentation.coverage.completedBranches,
        unsupportedBranches:
          eventLeadWork.presentation.coverage.unsupportedBranches,
        failedBranches: eventLeadWork.presentation.coverage.failedBranches,
        sourceRoutesAttempted:
          eventLeadWork.presentation.coverage.sourceRoutesAttempted,
        sourceRoutesSucceeded:
          eventLeadWork.presentation.coverage.sourceRoutesSucceeded,
        semanticAssessment:
          eventLeadWork.presentation.coverage.semanticAssessment,
        limitation: eventLeadWork.presentation.coverage.limitation,
      } : null,
      occurrences: events.selected,
      omittedCount: events.omittedCount,
      totalCount: events.totalCount,
      selectionRule: events.selectionRule,
    } : null,
    mechanisms: {
      status: mechanismStatus,
      phase: execution?.phase ?? null,
      safeFailureCode: execution?.lastError?.code ?? null,
      finalizedFocal: savedInput ? {
        id: savedInput.id,
        originalText: savedInput.proposedMechanism,
        theoreticalPerspective: savedInput.theoreticalPerspective,
        origin: savedInput.origin,
      } : null,
      proposals: candidates.map((item) => ({ id: item.id,
        concept: item.conceptLabel, chain: item.processNodes,
        condition: item.condition, distinction: item.distinctionFromFocal,
        proposedDirection: item.proposedDirection ?? null,
        hypothesisStatus: item.hypothesisStatus })),
      assessments: comparison?.mechanisms.map((item) => ({
        id: item.candidateId ?? item.id, concept: item.concept,
        direction: item.direction ?? null,
        sourceCheckStatus: item.sourceCheckStatus ?? "legacy_unknown",
        support: item.support ?? null,
        chain: item.chain, limit: item.limit,
        evidenceIds: [...new Set(item.argument.flatMap((argument) =>
          argument.evidenceIds))],
      })) ?? [],
      predictions: comparison?.predictions.map((item) => ({
        id: item.id, observation: item.observation,
        measure: item.measure, timing: item.timing,
        patterns: item.patterns.map((pattern) => ({
          mechanismId: pattern.mechanismId, detail: pattern.detail,
          status: pattern.status ?? "legacy_unknown",
          evidenceIds: pattern.evidenceIds ?? [],
        })),
      })) ?? [],
      predictionCount: comparison?.predictions.length ?? 0,
      comparisonSummary: comparison?.summary ?? null,
      comparisonGaps: comparison?.gaps ?? [],
      comparisonDispositions: comparison?.dispositions?.map((item) => ({
        candidateId: item.candidateId,
        status: item.status,
        reason: item.reason,
        mergedInto: item.mergedInto,
      })) ?? [],
      comparisonCompletion: comparison?.completion ? {
        status: comparison.completion.status,
        admittedAdditionalCount:
          comparison.completion.admittedAdditionalCount,
        disposedAdditionalCount:
          comparison.completion.disposedAdditionalCount,
        completedBatchCount: comparison.completion.completedBatchCount,
        totalBatchCount: comparison.completion.totalBatchCount,
      } : comparison ? {
        // Legacy one-response comparisons were complete by construction.
        status: "completed" as const,
        admittedAdditionalCount: Math.max(0,
          comparison.mechanisms.length - 1),
        disposedAdditionalCount: Math.max(0,
          comparison.mechanisms.length - 1),
        completedBatchCount: 1,
        totalBatchCount: 1,
      } : null,
    },
    dataFeasibility: suppliedFeasibility ? {
      origin: "previous_researcher_report" as const,
      snapshotId: suppliedFeasibility.snapshotId,
      input: structuredClone(suppliedFeasibility.diagnosticInput),
      qualification: "Reported availability and assignment structure are carried forward; the plan does not independently verify data coverage or its fit to a newer comparison.",
    } : { origin: "not_supplied" as const, input: null,
      qualification: "Actual availability, frequency, assignment structure, variables and practical constraints have not been supplied." },
    diagnosticResults: {
      status: "not_interpreted_by_this_plan" as const,
      count: state.screen6DiagnosticResults?.length ?? 0,
    },
  };
  const feasibilitySemanticInput = suppliedFeasibility
    ? (() => {
        const { inputFingerprint: _fingerprint, ...content } =
          suppliedFeasibility.diagnosticInput;
        return content;
      })()
    : null;
  const eventCoverage = !eventLeadWork ? "not_available" as const
    : eventContextFit !== "current" ? "incomplete" as const
    : eventLeadWork.status === "completed" ? "complete" as const
      : eventLeadWork.status === "completed_partial" ? "partial" as const
        : "incomplete" as const;
  const mechanismAvailability = !savedInput ? "not_available" as const
    : comparison && execution?.phase === "completed"
      ? "comparison_complete" as const
      : comparison ? "comparison_partial" as const
      : candidates.length ? "proposals_only" as const
        : "focal_only" as const;
  const semanticDependencyInputs = {
    study: {
      population: study.population,
      analysisUnit: study.analysisUnit,
      geography: study.geography,
      industry: study.industry,
      period: study.period,
      outcome: study.outcome,
      outcomeMeasure: study.outcomeMeasure ?? null,
      policySideConcept: study.policySideConcept ?? null,
      initialExplanation: study.initialExplanation,
      proposedTreatment: study.proposedTreatment,
      proposedComparison: study.proposedComparison,
      resultsPreviouslyInspected: study.resultsPreviouslyInspected,
    },
    policy: policy ? {
      identityFingerprint: policy.identityFingerprint,
      officialTitle: policy.officialTitle,
      episode: policy.episode,
    } : null,
    policyEvidence: {
      status: policyEvidence.status,
      claims: policyEvidence.claims,
      chronology: policyEvidence.chronology,
      chronologyOrigin: policyEvidence.chronologyOrigin,
      treatmentClock: policyEvidence.treatmentClock,
      conflictIds: policyEvidence.conflictIds,
      unresolvedRequirementIds: policyEvidence.unresolvedRequirementIds,
      unresolvedEvidence: policyEvidence.unresolvedEvidence,
    },
    treatmentTiming: timing ? {
      mode: timing.mode,
      year: timing.year,
      precision: timing.precision,
      milestoneReference: timing.milestoneReference,
      origin: timing.origin,
    } : null,
    comparison: {
      decision: selection?.decision ?? { mode: "not_selected" as const },
      selectedOption,
      advisoryOptions: advice?.options ?? [],
    },
    design: {
      concerns: upstream.designConcerns,
      critique: upstream.designCritique,
    },
    otherEvents: eventLeadWork ? {
      coverage: eventCoverage,
      contextFit: eventContextFit,
      presentationCoverage: eventLeadWork.presentation ? {
        attemptedBranches:
          eventLeadWork.presentation.coverage.attemptedBranches,
        completedBranches:
          eventLeadWork.presentation.coverage.completedBranches,
        unsupportedBranches:
          eventLeadWork.presentation.coverage.unsupportedBranches,
        failedBranches: eventLeadWork.presentation.coverage.failedBranches,
        sourceRoutesAttempted:
          eventLeadWork.presentation.coverage.sourceRoutesAttempted,
        sourceRoutesSucceeded:
          eventLeadWork.presentation.coverage.sourceRoutesSucceeded,
        semanticAssessment:
          eventLeadWork.presentation.coverage.semanticAssessment,
        limitation: eventLeadWork.presentation.coverage.limitation,
      } : null,
      occurrences: events.selected,
      omittedCount: events.omittedCount,
      totalCount: events.totalCount,
    } : null,
    mechanisms: {
      availability: mechanismAvailability,
      finalizedFocal: upstream.mechanisms.finalizedFocal ? {
        originalText: upstream.mechanisms.finalizedFocal.originalText,
        theoreticalPerspective:
          upstream.mechanisms.finalizedFocal.theoreticalPerspective,
        origin: upstream.mechanisms.finalizedFocal.origin,
      } : null,
      proposals: upstream.mechanisms.proposals,
      assessments: upstream.mechanisms.assessments,
      predictions: upstream.mechanisms.predictions,
      comparisonSummary: upstream.mechanisms.comparisonSummary,
      comparisonGaps: upstream.mechanisms.comparisonGaps,
      comparisonDispositions:
        upstream.mechanisms.comparisonDispositions,
      comparisonCompletion: upstream.mechanisms.comparisonCompletion,
    },
    dataFeasibility: feasibilitySemanticInput,
  };
  const semanticDependencyFingerprints = Object.fromEntries(
    Object.entries(semanticDependencyInputs).map(([name, value]) => [
      name,
      fingerprintSixScreenValue(value),
    ]),
  );
  const dependencyManifest = {
    version: SCREEN6_DEPENDENCY_MANIFEST_VERSION,
    semantic: semanticDependencyFingerprints,
    operational: {
      studyRevision: study.revision,
      eventSnapshotId: eventLeadWork?.snapshotId ?? null,
      eventInvestigationFingerprint:
        eventLeadWork?.investigationFingerprint ?? null,
      mechanismPhase: execution?.phase ?? null,
      mechanismReceiptFingerprints: refs.mechanismReceiptFingerprints,
      feasibilitySnapshotId: suppliedFeasibility?.snapshotId ?? null,
    },
  };
  const inputFingerprint = fingerprintSixScreenValue({
    planVersion: SCREEN6_CURRENT_PLAN_VERSION,
    contextualizerTaskVersion: SCREEN6_CONTEXTUALIZER_TASK_VERSION,
    libraryVersion: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    semantic: semanticDependencyFingerprints,
  });
  const gaps: string[] = [];
  if (!policy) gaps.push("The policy identity has not been confirmed.");
  if (!selection || selection.decision.mode === "no_selection") {
    gaps.push("A causal comparison has not been selected. The proposed groups are not verified exposure groups.");
  }
  if (!eventWork || eventWork.status !== "completed") {
    gaps.push("Other-event research is absent or incomplete; no co-event is assumed to be a confounder.");
  }
  if (!savedInput) gaps.push("A focal mechanism has not been finalized on Screen 5.");
  else if (!currentInput) gaps.push(
    "The exact finalized focal wording is preserved from an earlier study version; its previous alternatives and literature checks do not apply to the revised study until reviewed again.",
  );
  if (!comparison) gaps.push(!currentInput && savedInput
    ? "Alternative mechanisms for the revised study have not been generated; earlier proposals and literature checks remain historical."
    : mechanismStatus === "interrupted"
      ? "Screen 5 assessment stopped; the focal input and any saved proposals remain provisional, not a completed search finding."
      : "Mechanism proposals have not completed source checking and comparison.");
  gaps.push(suppliedFeasibility
    ? "Previously reported data feasibility needs verification for the current comparison; no diagnostic result has been assessed in this plan."
    : "Observed data coverage, assignment counts, dependence, and diagnostic results are not established by the requested study period.");

  const library = screen6ReviewedDiagnosticLibrary();
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const title = policy?.officialTitle ?? "the proposed policy";
  const units = study.analysisUnit ?? "the study units";
  const outcome = study.outcomeMeasure
    ? `${study.outcome ?? "the outcome"} (${study.outcomeMeasure})`
    : study.outcome ?? "the outcome";
  const groupText = [study.proposedTreatment, study.proposedComparison]
    .filter(Boolean).join(" and ") || "the proposed exposed and comparison groups";
  const coverage = policyEvidence.claims.filter(({ kind, decision }) => decision !==
    "rejected" && [
    "coverage_condition", "territorial_nexus", "threshold_condition",
    "exemption_rule"].includes(kind));
  const datedStages = policyEvidence.chronology.filter((item) =>
    item.timing.mode === "absolute").slice(0, 3);
  const stageSummary = datedStages.map((item) =>
    `${item.stage.replaceAll("_", " ")} ${item.timing.mode === "absolute"
      ? `${item.timing.start}${item.timing.end ? `–${item.timing.end}` : ""}` : ""}`).join("; ");
  const coverageSummary = coverageRecordSummary(coverage).text;
  const eventSummary = events.selected.slice(0, 2).map((item) => {
    const pathway = item.outcomePathway?.trim();
    const route = pathway && pathway.length <= 150
      ? pathway : item.affectedActivity
        ? `affected activity: ${item.affectedActivity}` : "exposure route unverified";
    return `${item.title} (${route})`;
  }).join("; ");
  const timingSummary = timing?.mode === "year" && timing.year
    ? `The researcher proposed ${timing.year} (year precision)`
    : timing?.mode === "varies_by_group"
      ? "The researcher reported that different groups may first experience the shock in different years during the study period"
      : timing ? `The researcher recorded ${timing.mode.replaceAll("_", " ")} timing`
      : "No treatment timing is selected";
  const priorities: PlanCard[] = [{
    id: "exposure-and-comparator",
    label: "Verify exposure and comparator eligibility",
    category: "additional_evidence_collection",
    reason: `${title} is being studied among ${groupText} for ${outcome}. ${coverageSummary} Check which companies in each group were eligible in the relevant years; geographic labels alone do not establish exposure.`,
    status: "prerequisites_needed",
    prerequisites: ["Dated policy eligibility rules", "Unit-level historical coverage and comparator exposure"],
    procedure: ["Reconstruct eligibility for each group and date from source-supported rules.", "Check whether proposed comparison units were indirectly exposed."],
    concern: ["Eligibility does not match the proposed group labels or changes over time."],
    alternatives: ["Headquarters location may differ from operational or customer exposure."],
    limits: ["Documented eligibility alone does not establish comparable untreated potential outcomes."],
    response: ["Revise the exposure definition and comparison before estimation."],
    references: [],
    dimensionIds: ["institutional_evidence", "assignment_exposure", "counterfactual_comparison"],
    evidenceRefs: coverage.map((claim) => claim.id),
  }];
  const add = (id: LibraryId, reason: string, needs: string[] = []) => {
    const entry = byId.get(id);
    if (!entry) {
      gaps.push(
        `The reviewed Screen 6 diagnostic ${id} is unavailable in ${SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION}; that check was not added and remains unresolved.`,
      );
      return null;
    }
    const card: PlanCard = {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      reason,
      status: "prerequisites_needed",
      prerequisites: [...entry.prerequisites, ...needs],
      procedure: entry.procedure,
      concern: entry.patternsRaisingConcern,
      alternatives: entry.alternativeExplanations,
      limits: entry.interpretiveLimits,
      response: entry.possibleDesignResponses,
      references: entry.sourceReferences,
      dimensionIds: entry.dimensions,
    };
    priorities.push(card);
    return card;
  };
  if (selectedOption?.family === "difference_in_differences") {
    const prePeriods = suppliedFeasibility?.diagnosticInput.preTreatmentPeriods;
    add("did-pre-treatment-dynamics-v1", prePeriods?.status === "available"
      ? `The selected ${selectedOption.label} compares ${groupText} for ${outcome}; ${prePeriods.count} pre-policy periods were reported, but coverage and eligible group data still need verification.`
      : `The selected ${selectedOption.label} compares ${groupText} for ${outcome}; pre-policy outcome coverage has not been established.`);
    add("did-parallel-trends-sensitivity-v1", `The selected comparison requires a defensible counterfactual trend for ${outcome}; a nonsignificant pretest would not prove it.`);
    if (selectedOption.entryId === "D02") {
      add("did-staggered-adoption-v1", `The selected staggered comparison needs eligible cohort-time contrasts for ${outcome}; already treated units are not automatically valid controls.`);
    }
  }
  if (selectedOption?.family === "regression_discontinuity") {
    add("rd-eligibility-cutoff-v1", `The selected ${selectedOption.label} requires actual assignment variation around its cutoff; a rule mentioning a threshold is insufficient.`);
    add("rd-functional-sensitivity-v1", `The prospective local contrast for ${outcome} depends on support and defensible bandwidth choices.`);
  }
  const timingPriority = add("timing-anticipation-v1", `${timingSummary}. ${stageSummary ||
    "No current dated policy milestone was saved."} Compare the chosen treatment definition with announcement, legal effect and implementation evidence, including conflicts.`,
    ["Observed outcome frequency and actual coverage, if available"]);
  if (timingPriority) {
    timingPriority.evidenceRefs = datedStages.map((item) => item.id);
  }
  const coeventPriority = add("coevent-exposure-alternatives-v1", events.totalCount
    ? `${eventSummary} Compare the dates and differential effects on ${groupText} and ${outcome}; ${events.totalCount} occurrence records are leads, not established confounders${events.omittedCount ? ` (${events.omittedCount} lower-priority records remain in Screen 4)` : ""}.`
    : "Document potentially overlapping events and compare their timing and group exposure; current occurrence coverage is incomplete.");
  if (coeventPriority) {
    coeventPriority.evidenceRefs = events.selected.map((item) => item.id);
  }
  if (selection?.decision.mode === "selected" &&
    selectedOption &&
    /overlap|shared market|neighbor|spillover/iu.test(groupText)) {
    add("interference-spillover-mapping-v1", `Proposed group definitions for ${groupText} raise a possible cross-group exposure pathway; document links before treating the comparator as unaffected.`);
  }
  const assignment = suppliedFeasibility?.diagnosticInput.assignmentStructure;
  add("group-inference-clustering-v1", assignment?.status === "described"
    ? `${units} observations are not independent policy assignments; the researcher reported ${assignment.independentGroupCount ?? "an unknown number of"} independent groups and ${assignment.dependence.replaceAll("_", " ")} dependence, which need verification.`
    : `${units} observations do not reveal the number of independent policy assignments or the dependence structure.`,
    ["Actual assignment-unit count and clustering variables, if available"]);
  add("outcome-sample-continuity-v1", `Check whether measurement or sample entry for ${outcome} changes at the policy stages.`);
  const mechanismPriority = savedInput || candidates.length
    ? add("mechanism-discrimination-v1",
      `The saved focal process is “${savedInput?.proposedMechanism ?? "unavailable"}”. ${candidates.length
      ? `Proposals include ${candidates.slice(0, 2).map((item) =>
        `${item.conceptLabel} (${item.processNodes.join(" → ")})`).join("; ")}.`
      : mechanismStatus === "interrupted" ? "Screen 5 stopped before a completed alternative assessment; zero saved proposals does not mean zero plausible alternatives."
        : "No alternative process has been assessed."} Intermediate observations for ${outcome} are needed to distinguish pathways; status: ${mechanismStatus.replaceAll("_", " ")}.`)
    : null;
  if (mechanismPriority) mechanismPriority.evidenceRefs = [
    ...(savedInput ? [savedInput.id] : []), ...candidates.map((item) => item.id)];
  // A component effect is not identified merely by naming a construct.
  if (study.policySideConcept) add("treatment-package-separability-v1",
    `Interpretation through ${study.policySideConcept} requires variation that separates it from other provisions of ${title}.`);

  const dimensionNames = [
    "Institutional evidence", "Assignment / exposure", "Timing",
    "Counterfactual comparison", "Competing events", "Interference",
    "Treatment versions", "Outcome measurement / sample",
    "Statistical inference", "Mechanism attribution",
  ] as const;
  const dimensionDetail: Record<Screen6UncertaintyDimensionId,
    { state: string; basis: string; concern: string; check: string; refs: string[] }> = {
    institutional_evidence: { state: coverage.length ? "Documented policy claims" : "Policy evidence incomplete",
      basis: coverage.length ? coverageSummary : `Policy review: ${policyEvidence.status}.`,
      concern: "Do the recorded coverage conditions apply to the proposed groups in this episode?",
      check: "Reconstruct year-specific legal eligibility from the cited source versions.",
      refs: coverage.map((item) => item.id) },
    assignment_exposure: { state: "Exposure definition needs checking",
      basis: `Groups proposed: ${groupText}; eligibility is not inferred from location.`,
      concern: "Which companies and years were eligible or indirectly exposed?",
      check: "Map coverage and comparison exposure at the company level.", refs: [] },
    timing: { state: datedStages.length ? "Policy milestones documented" :
      policyEvidence.chronologyOrigin === "evidence_not_retrieved"
        ? "Policy evidence has not been retrieved" :
      policyEvidence.chronologyOrigin === "no_dated_milestone_in_current_claims"
        ? "Inspected claims lack a dated milestone" : "Timing evidence incomplete",
      basis: `${timingSummary}. ${stageSummary ||
        (policyEvidence.chronologyOrigin === "evidence_not_retrieved"
          ? "Policy chronology requires a source read."
          : "The current inspected claims do not supply a dated milestone.")}`,
      concern: "Does the chosen treatment definition overlap anticipation or a later policy stage?",
      check: "Compare source-dated milestones, researcher timing and observed outcome frequency.",
      refs: datedStages.map((item) => item.id) },
    counterfactual_comparison: { state: selectedOption ? "Method selected for review" : "Comparison method undecided",
      basis: selectedOption ? `${selectedOption.label} was selected by the researcher.` : "No causal comparison selected; advisory options are not decisions.",
      concern: "Would the proposed comparison describe an untreated outcome path?",
      check: "Verify eligibility and justify the comparison before estimating.", refs: [] },
    competing_events: { state: eventWork?.status === "completed" ? "Occurrence leads retained" : "Event review incomplete",
      basis: eventSummary || "No current relevant event analysis is available.",
      concern: "Did a co-event differentially affect the groups and measured outcome?",
      check: "Compare event dates and exposure pathways; assess relevance individually.",
      refs: events.selected.map((item) => item.id) },
    interference: { state: "Cross-group links unassessed",
      basis: `Proposed groups: ${groupText}.`, concern: "Could one group's activities expose the comparison group?",
      check: "Map customers, operations and links across the proposed groups.", refs: [] },
    treatment_versions: { state: policyEvidence.chronology.some((item) => item.stage === "amendment")
      ? "Multiple policy stages documented" : "Version distinction unresolved",
      basis: `Episode: ${policy?.episode ?? "unconfirmed"}; ${stageSummary || "no current stage chronology"}.`,
      concern: "Which provision and version could each company have faced?",
      check: "Align dated source versions to the proposed treatment years.",
      refs: policyEvidence.chronology.map((item) => item.id) },
    outcome_measurement_sample_composition: { state: "Observed coverage unverified",
      basis: `${outcome} for ${units}; requested years ${study.period.start}–${study.period.end}.`,
      concern: "Do measurement and sample membership change around the policy stages?",
      check: "Inspect dated measure definitions and entry or exit records.", refs: [] },
    statistical_inference: { state: "Assignment dependence unassessed",
      basis: `The proposed unit is ${units}; independent assignments and dependence are unverified.`,
      concern: "How many independent policy assignments support inference?",
      check: "Identify assignment units and dependence before selecting an inference procedure.", refs: [] },
    mechanism_attribution: { state: mechanismStatus === "interrupted" ? "Assessment interrupted" :
      comparison ? "Mechanisms assessed, attribution unresolved" : "Mechanism assessment pending",
      basis: savedInput ? `Focal process: ${savedInput.proposedMechanism}; ${candidates.length} saved provisional alternatives.` : "No finalized focal process.",
      concern: "Could several pathways explain the same observed outcome?",
      check: "Compare intermediate predictions and evidence without treating signs as mediation.",
      refs: savedInput ? [savedInput.id, ...candidates.map((item) => item.id)] : [] },
  };
  const dimensions = SCREEN6_UNCERTAINTY_DIMENSIONS.map((id, index) => ({
    id,
    label: dimensionNames[index]!,
    ...dimensionDetail[id],
  }));
  const target = selectedOption
    ? `The selected ${selectedOption.label} is intended to examine ${selectedOption.effectTarget} for ${outcome}, subject to verified assignment, timing, and a defensible counterfactual.`
    : "A causal comparison has not yet been selected; a specific causal estimand cannot be stated.";
  const boundary = {
    plannedTarget: target,
    requiredAssumptions: [
      "Historic eligibility and exposure for proposed groups must be established.",
      "The treatment time must align with the researched policy episode and actual measured periods.",
      "The proposed comparator needs a defensible untreated outcome path.",
    ],
    unsupportedClaims: [
      "A policy-package contrast does not isolate a particular provision or theoretical construct without separate variation.",
      "Several plausible pathways do not identify a unique mediating mechanism.",
      "No diagnostic has passed and no treatment effect has been estimated here.",
    ],
    nextAction: selectedOption
      ? "Establish eligibility, comparator exposure, and observed data coverage before running the planned checks."
      : "Choose and justify a comparison after verifying eligibility and the available data; retain this conditional plan meanwhile.",
    recommendation: selectedOption ? "Revise specified parts first" : "Insufficient information for the intended causal claim",
  };
  return {
    schemaVersion: SCREEN6_CURRENT_PLAN_VERSION,
    inputFingerprint,
    snapshotRefs: refs,
    dependencyManifest,
    legacyInputFingerprints: legacyV24InputFingerprint
      ? [legacyV24InputFingerprint] : [],
    upstream,
    study: {
      policy: title,
      episode: policy?.episode ?? null,
      question: mechanism?.planning?.plan?.conceptualQuestion ?? null,
      initialExplanation: study.initialExplanation ?? null,
      construct: study.policySideConcept ?? null,
      policySideConcept: study.policySideConcept ?? null,
      population: study.population,
      unit: study.analysisUnit,
      geography: study.geography,
      industry: study.industry,
      requestedPeriod: study.period,
      outcome: study.outcome,
      measure: study.outcomeMeasure ?? null,
      proposedTreatment: study.proposedTreatment,
      proposedComparison: study.proposedComparison,
      proposedGroups: groupText,
      selectedComparison: selectedOption?.label ?? null,
      advisoryOptions: advice?.options.map((item) => item.label) ?? [],
      focalMechanism: savedInput?.proposedMechanism ?? null,
      focalTheoreticalPerspective: savedInput?.theoreticalPerspective ?? null,
      alternativeCount: candidates.length,
    },
    gaps,
    dimensions,
    priorities,
    boundary,
    libraryVersion: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    status: "plan_only" as const,
    modelCalls: 0 as const,
    resultsAssessed: false as const,
  };
}

export type Screen6CurrentPlan = ReturnType<typeof createScreen6CurrentPlan>;

/** Current semantic coordinate followed by strictly reconstructed legacy
 * coordinates for the same saved v24 inputs. Callers may reuse only a
 * completed, locally validated artifact at one of these exact coordinates. */
export function screen6CompatibleInputFingerprints(plan: Screen6CurrentPlan) {
  return [plan.inputFingerprint, ...plan.legacyInputFingerprints];
}

/** Reader-facing local guidance for old records and plans without a model result.
 * These statements describe saved proposals and evidence, never observed tests. */
export function screen6LocalDimensionSummaries(plan: Screen6CurrentPlan) {
  const groups = plan.study.proposedGroups;
  const outcome = plan.study.measure
    ? `${plan.study.outcome} (${plan.study.measure})` : plan.study.outcome;
  const dated = plan.upstream.policyEvidence.chronology.filter((clock) =>
    clock.timing.mode === "absolute").slice(0, 3);
  const dateText = dated.map((clock) => {
    const timing = clock.timing;
    return `${clock.stage.replaceAll("_", " ")} ${timing.mode === "absolute"
      ? timing.start : "date unresolved"}`;
  }).join("; ");
  const proposed = plan.upstream.treatmentTiming?.mode === "year"
    ? `The researcher proposed ${plan.upstream.treatmentTiming.year} as the treatment year.`
    : plan.upstream.treatmentTiming?.mode === "varies_by_group"
      ? "The researcher reported that different groups may first experience the shock in different years during the study period."
      : plan.upstream.treatmentTiming
      ? `The researcher proposed a ${plan.upstream.treatmentTiming.mode.replaceAll("_", " ")} treatment rule.`
      : "No treatment start has been proposed.";
  const coverageRefs = plan.upstream.policyEvidence.claims.filter((claim) =>
    ["coverage_condition", "territorial_nexus", "threshold_condition",
      "exemption_rule"].includes(claim.kind) && claim.decision !== "rejected")
    .map((claim) => claim.id);
  const coverageSummary = coverageRecordSummary(
    plan.upstream.policyEvidence.claims.filter((claim) =>
      coverageRefs.includes(claim.id)),
  ).text;
  const events = plan.upstream.otherEvents?.occurrences ?? [];
  const eventNames = events.slice(0, 2).map((event) => event.title).join(" and ");
  const focal = plan.study.focalMechanism;
  const summary = {
    institutional_evidence: {
      title: "Who faced the policy requirements?",
      knownBasis: coverageRefs.length
        ? `For ${plan.study.policy}, ${coverageSummary} The proposed groups are ${groups}.`
        : `Applicability conditions for ${plan.study.policy} have not been established in the current review.`,
      specificConcern: "Group names alone do not establish which firms faced the relevant requirements.",
      nextCheck: "Check the historical eligibility rules against firms in both groups, year by year.",
      materialLimit: "Documented legal coverage does not establish actual firm behavior or a comparable counterfactual.",
      inputRefs: ["study.proposedGroups"], sourceRefs: coverageRefs,
    },
    assignment_exposure: {
      title: "Do the groups capture exposure?",
      knownBasis: `The researcher proposes ${groups} for ${outcome}.`,
      specificConcern: "The proposed labels may not identify all directly or indirectly exposed firms.",
      nextCheck: "Map eligible firms and plausible links to the comparison group for each study year.",
      materialLimit: "Neither headquarters location nor a population label proves exposure.",
      inputRefs: ["study.proposedGroups", "study.outcome", "study.measure"], sourceRefs: coverageRefs,
    },
    timing: {
      title: "Which policy episode does the chosen start represent?",
      knownBasis: `${proposed} ${dateText
        ? `The saved policy record dates ${dateText}.`
        : "No current source-dated milestone is available."}`,
      specificConcern: "The proposed start and documented policy stages may refer to different changes.",
      nextCheck: "Identify the intended intervention and compare it with dated implementation and possible response windows.",
      materialLimit: "Policy dates do not establish when firms changed behavior or that anticipation occurred.",
      inputRefs: ["researcher_treatment_timing"],
      sourceRefs: dated.map((clock) => clock.id),
    },
    counterfactual_comparison: {
      title: "What comparison supports the claim?",
      knownBasis: plan.study.selectedComparison
        ? `The researcher selected ${plan.study.selectedComparison} to study ${outcome}.`
        : `The groups ${groups} are proposed; no causal comparison method has been selected.`,
      specificConcern: "The other group's outcome path may differ even without this policy.",
      nextCheck: "Establish policy eligibility, substantive comparability and the data needed for the intended method.",
      materialLimit: "An advisory method option or a nonsignificant pretrend check cannot establish an untreated counterfactual.",
      inputRefs: ["study.proposedGroups", "design_choice"], sourceRefs: [],
    },
    competing_events: {
      title: "Could another event alter the comparison?",
      knownBasis: eventNames
        ? `Screen 4 retains ${eventNames} as documented event leads within its bounded search.`
        : "Screen 4 has not established a current event route to this comparison.",
      specificConcern: `An event could affect ${outcome} differently across ${groups}.`,
      nextCheck: "Compare each event's dates, actual firm exposure and plausible outcome route.",
      materialLimit: "A source-documented occurrence or overlapping date alone does not establish a confounder.",
      inputRefs: ["study.proposedGroups", "study.outcome"],
      sourceRefs: events.slice(0, 2).map((event) => event.id),
    },
    interference: {
      title: "Could one group affect the other?",
      knownBasis: `The researcher proposes ${groups}; links between those firms have not been assessed.`,
      specificConcern: "Customers, suppliers or shared markets could carry a response across the proposed groups.",
      nextCheck: "Map business and market links before treating comparison firms as unaffected.",
      materialLimit: "Geographic separation alone cannot establish absence of spillovers.",
      inputRefs: ["study.proposedGroups"], sourceRefs: [],
    },
    treatment_versions: {
      title: "Which policy version did firms face?",
      knownBasis: dateText
        ? `The saved policy record distinguishes ${dateText}.`
        : "The current policy record has no dated stages to align with firm exposure.",
      specificConcern: "Firms may face different provisions or stages at different times.",
      nextCheck: "Match each dated source version and its requirements to potentially eligible firms and years.",
      materialLimit: "Separate policy dates do not by themselves establish staggered adoption cohorts.",
      inputRefs: ["researcher_treatment_timing"],
      sourceRefs: dated.map((clock) => clock.id),
    },
    outcome_measurement_sample_composition: {
      title: "Is the outcome measured consistently?",
      knownBasis: `The researcher requests ${outcome} for ${plan.study.unit ?? "an unspecified observation unit"} during ${plan.study.requestedPeriod.start ?? "?"}–${plan.study.requestedPeriod.end ?? "?"}.`,
      specificConcern: "Measurement or sample membership could change around the policy stages.",
      nextCheck: "Inspect dated measure definitions, observation coverage and sample entry or exit.",
      materialLimit: "Requested years do not establish actual dataset availability.",
      inputRefs: ["study.outcome", "study.measure", "study.unit", "study.requestedPeriod"], sourceRefs: [],
    },
    statistical_inference: {
      title: "How many independent policy assignments?",
      knownBasis: `The proposed observation unit is ${plan.study.unit ?? "unspecified"}; assignment counts and dependence remain unverified.`,
      specificConcern: "Many observations may reflect few independent policy assignments.",
      nextCheck: "Identify actual assignment units and dependence before choosing an inference procedure.",
      materialLimit: "The number of firm-year rows does not equal the number of independent assignments.",
      inputRefs: ["study.unit"], sourceRefs: [],
    },
    mechanism_attribution: {
      title: "Can the proposed process be distinguished?",
      knownBasis: focal
        ? `The researcher finalized “${focal}” as the focal process; Screen 5 has ${plan.study.alternativeCount} proposed alternatives.`
        : "No finalized focal process is available in the current Screen 5 input.",
      specificConcern: "Several routes could produce the same outcome pattern.",
      nextCheck: "Compare prospective intermediate predictions and source evidence for competing routes.",
      materialLimit: "A policy-package outcome contrast does not identify a unique mediator.",
      inputRefs: focal ? ["mechanisms.focal"] : [],
      sourceRefs: plan.upstream.mechanisms.proposals.slice(0, 3).map((item) => item.id),
    },
  } satisfies Record<Screen6UncertaintyDimensionId, {
    title: string; knownBasis: string; specificConcern: string;
    nextCheck: string; materialLimit: string;
    inputRefs: string[]; sourceRefs: string[];
  }>;
  return SCREEN6_UNCERTAINTY_DIMENSIONS.map((dimensionId) => ({
    dimensionId, ...summary[dimensionId], origin: "local_plan" as const,
  }));
}
