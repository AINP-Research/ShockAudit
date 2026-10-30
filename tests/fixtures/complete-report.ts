import { createBrowserEventCardFixture } from "../browser/six-screen-event-card-review-fixture";
import { openScreen3, openScreen4, decideStudyDesignAdvice } from "../../src/core/six-screen/workflow";
import { fingerprintSixScreenValue } from "../../src/core/six-screen/canonical";
import { currentStudyDesignAdvice } from "../../src/core/six-screen/study-design-advice";
import { createCoEventCandidateOccurrence } from "../../src/core/six-screen/co-event-execution";
import { createStudyFirstMechanismInput, createStudyFirstMechanismPlan,
  createStudyFirstMechanismRun, createStudyFirstTheoreticalProblem,
  assessStudyFirstMechanismInput } from "../../src/core/six-screen/study-first-mechanism-comparison";
import type { StudyFirstMechanismPlan } from "../../src/core/six-screen/study-first-mechanism-comparison";

export function completeReportFixture(alternativeCount = 6) {
  const time = "2026-09-30T10:00:00.000Z";
  const source = createBrowserEventCardFixture();
  const opened3 = openScreen3(source.state, {
    expectedRevision: source.state.revision,
    study: {
      population: "U.S. public manufacturing firms", analysisUnit: "firm-year",
      geography: ["California", "United States"], industry: ["Manufacturing"],
      period: { start: "2010", end: "2025" },
      outcome: "Firm performance", outcomeMeasure: "Return on assets",
      intendedConstruct: "Firm performance", policySideConcept: "Customer information rights",
      initialExplanation: "Privacy rules change the customer information available for firm decisions.",
      proposedTreatment: "California firms", proposedComparison: "Non-California firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: { mode: "year", year: 2020, milestoneReference: null }, openedAt: time,
  });
  const advice = currentStudyDesignAdvice(opened3.state)!;
  const method = advice.options.find((item) => item.family === "difference_in_differences")!;
  const selected = decideStudyDesignAdvice(opened3.state, {
    expectedRevision: opened3.state.revision, adviceId: advice.adviceId,
    expectedAdviceFingerprint: advice.adviceFingerprint,
    decision: { mode: "selected", optionId: method.optionId },
    rationale: "Retain this comparison for the synthetic report fixture.", selectedAt: time,
  });
  const state = openScreen4(selected.state, {
    expectedRevision: selected.state.revision, openedAt: time,
  }).state;
  const planned = state.studyFirstEventInvestigations!.at(-1)!;
  const names = ["Regional manufacturing credit rule", "Manufacturing supply-chain disruption",
    "State energy-pricing change", "Cross-state customer disclosure rule",
    "Manufacturing reporting standard revision", "Regional flood disruption",
    "Public-company disclosure amendment", "Regional transport disruption"];
  const occurrences = names.map((title, index) => createCoEventCandidateOccurrence({
    id: `report-event-${index + 1}`, providerId: "federal_register",
    sourceNativeId: `synthetic-event-${index + 1}`, title,
    description: `${title}: synthetic source metadata for checking report content and pagination.`,
    eventFamily: "independent market change", formalIdentifiers: [],
    typedDates: [{ kind: "event", value: `2021-0${index + 1}-01`, precision: "day", sourceId: `report-source-${index + 1}` }],
    geography: { status: "provider_reported", labels: ["United States"] },
    evidence: [{ sourceId: `report-source-${index + 1}`, title: `${title} source`,
      locator: `https://example.test/report/event-${index + 1}`, publisher: "Synthetic fixture",
      publishedDate: "2021-01-01", authorityTier: 2, retrievedAt: time,
      evidenceRole: "occurrence_metadata" }], recordedAt: time,
  }));
  const { investigationFingerprint: _eventFingerprint, ...eventBody } = planned;
  const retained = { ...eventBody, status: "running" as const, occurrences };
  state.studyFirstEventInvestigations = [{ ...retained,
    investigationFingerprint: fingerprintSixScreenValue(retained) }];
  const context = retained.context;
  const mechanismInput = createStudyFirstMechanismInput({ id: "report-focal", revision: 1,
    contextFingerprint: context.contextFingerprint, theoreticalPerspective: null,
    proposedMechanism: "Firms reduce collected customer data, changing information available for product and marketing decisions.", savedAt: time });
  const labels = ["Privacy compliance spending", "Customer trust and purchasing",
    "Data substitution and analytical capacity", "Competitive reallocation",
    "Marketing efficiency", "Managerial caution", "Supplier coordination",
    "Operational adaptation", "Product differentiation", "Organizational learning"];
  const candidates: StudyFirstMechanismPlan["candidates"] = labels.slice(0, alternativeCount).map((label, index) => ({
    id: `m${index + 1}`, conceptLabel: label, actor: "Firm decision makers",
    processNodes: ["Privacy protection changes", `${label} changes organizational decisions`, "Firm performance changes"],
    condition: "The intermediate response occurs in the study population.",
    contextualConditions: ["The proposed process can be measured at firm-year level."],
    distinctionFromFocal: `${label} describes a different intermediate response from reduced customer data collection.`,
    perspective: null, perspectiveOrigin: "not_assigned", relationToFocal: "unresolved", hypothesisStatus: "provisional",
    proposedDirection: { mode: "single_hypothesis", target_outcome: "Firm performance",
      target_measure: "Return on assets", scenarios: [{ sign: index % 2 ? "positive" : "negative",
        condition: "The intermediate response dominates offsetting changes.",
        rationale: "This is a conditional proposal in synthetic report data, not an observed effect.",
        intermediate_movement: "The intermediate process changes", horizon: null }], missing_assumption: null },
    suggestedCitations: [{ id: `fixture-citation-${index + 1}`, authors: ["Fixture Author, É."],
      publicationYear: 2024, title: `Synthetic scholarly record ${index + 1}`,
      publicationVenue: "Synthetic Journal", volume: "12", issue: "3", pages: "20–35",
      doi: null, stableUrl: `https://example.test/literature/${index + 1}`,
      citationLabel: "Fixture Author, 2024",
      fullCitation: `Fixture Author, É. (2024). Synthetic scholarly record ${index + 1}. Synthetic Journal, 12(3), 20–35.`,
      supportScope: "A fixture proposition used to verify citation rendering.", verificationStatus: "model_suggested_unverified" }],
  }));
  const plan = createStudyFirstMechanismPlan({
    conceptualQuestion: "Which distinct pathways could connect privacy protection to firm performance?",
    relationshipInterpretation: { theoreticalChange: "Privacy protection changes",
      direction: "change", outcomeEndpoint: "Firm performance", policyToConstructQualification: "A proposed transfer to this study.",
      sourceFieldRefs: ["study.policySideConcept", "study.outcome"] }, candidates,
    supplementaryAccounts: [], evidenceNeeds: candidates.map((candidate, index) => ({
      id: `need-${index + 1}`, candidateId: candidate.id,
      propositionToInvestigate: `Measure ${candidate.conceptLabel} and establish its timing.`, purpose: "support", priority: "medium" })),
    queryIntents: [{ id: "direct", intent: "direct_x_y_open_ended",
      conceptGroups: [["privacy"], ["firm performance"]], scopeTerms: ["firms"], evidenceNeedIds: [] },
    { id: "boundary", intent: "contrary_or_boundary", conceptGroups: [["privacy"], ["boundary condition"]],
      scopeTerms: ["firms"], evidenceNeedIds: [] }], limitations: ["Synthetic planning fixture."],
  });
  const problem = createStudyFirstTheoreticalProblem({ id: "report-theory", context, mechanismInput });
  const run = createStudyFirstMechanismRun({ id: "report-mechanism-run", ordinal: 1, previousRunId: null,
    context, input: mechanismInput, inputAssessment: assessStudyFirstMechanismInput({
      theoreticalPerspective: null, proposedMechanism: mechanismInput.proposedMechanism,
      policyTitle: context.policy.officialTitle, outcome: context.study.outcome! }), theoreticalProblem: problem,
    planning: { status: "completed", origin: "test_probe_boundary", taskId: null, resultId: null,
      providerAttemptId: null, plan, limitation: "Synthetic fixture, no inference or external retrieval." },
    searchPlan: { queries: [], providerQueryCeiling: 2, metadataRecordCeiling: 10,
      abstractInspectionCeiling: 10, publicationWindowRule: "study_period_does_not_limit_scholarship_publication_year" },
    attempts: [], works: [], status: "planning_ready",
    hostComparison: { status: "not_started", taskId: null, limitation: "Synthetic fixture." }, createdAt: time,
  });
  state.studyFirstMechanismInputs = [mechanismInput];
  state.studyFirstMechanismRuns = [run];
  return state;
}
