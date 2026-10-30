import { describe, expect, it } from "vitest";

import { fingerprintHostReasoningValue } from
  "../../src/core/host-reasoning-task";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  createStudyFirstMechanismInput,
  createStudyFirstMechanismRun,
  createStudyFirstScholarlyWork,
  createStudyFirstTheoreticalProblem,
} from "../../src/core/six-screen/study-first-mechanism-comparison";
import {
  currentStudyFirstEventInvestigation,
} from "../../src/core/six-screen/study-first-event-investigation";
import {
  commitStudyFirstEventInvestigation,
  commitStudyFirstMechanismRun,
  currentStudyFirstMechanismContext,
  openScreen3,
  openScreen4,
  openScreen5,
  saveStudyFirstMechanismInput,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import {
  HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
  HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
} from "../../src/worker/host-reasoning-task-runtime";
import {
  HostReasoningTaskStore,
} from "../../src/worker/host-reasoning-task-store";
import { createHostReasoningWorkflowRuntime } from
  "../../src/worker/host-reasoning-task-workflow";
import { executeStudyFirstEventInvestigation } from
  "../../src/worker/screen04-study-first-investigation";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import { InMemoryScreen02WorkflowStore } from
  "../../src/worker/screen02-workflow-store";
import { InMemoryScreen03WorkflowStore } from
  "../../src/worker/screen03-workflow-store";
import {
  SCREEN04_STUDY_EVENT_ASSESSMENT_SUBMISSION_SCHEMA_VERSION,
  SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  SCREEN05_THEORETICAL_PLANNING_TASK,
  buildStudyFirstHostTaskContext,
  screen04StudyEventAssessmentFactsSchema,
  screen04StudyEventAssessmentResultSchema,
  screen05StudyMechanismComparisonFactsSchema,
  screen05StudyMechanismComparisonResultSchema,
  screen05TheoreticalPlanningFactsSchema,
  screen05TheoreticalPlanningResultSchema,
  validateAndNormalizeStudyFirstHostResult,
} from "../../src/worker/study-first-host-intelligence";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const signing = {
  keyId: "study-first-host-test-key",
  key: "study-first-host-test-key-material-more-than-thirty-two-bytes",
};

const study: StudyContextDraft = {
  population: "U.S. public manufacturers",
  analysisUnit: "firm-year",
  geography: ["United States", "California"],
  industry: ["Manufacturing"],
  period: { start: "2010", end: "2025" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection",
  initialExplanation: "Through increased customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

function eventFetch(request: RequestInfo | URL) {
  const url = String(request);
  const body = /openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(url)
    ? {
        DisasterDeclarationsSummaries: [{
          id: "fema-study-first-host",
          disasterNumber: 4999,
          state: "CA",
          declarationType: "DR",
          declarationDate: "2022-02-10T00:00:00.000Z",
          incidentType: "Flood",
          declarationTitle: "PACIFIC FLOOD FIXTURE",
          incidentBeginDate: "2022-02-01T00:00:00.000Z",
          incidentEndDate: "2022-02-05T00:00:00.000Z",
          designatedArea: "Fixture County",
        }],
      }
    : {
        count: 1,
        results: [{
          document_number: "2021-12345",
          title: "Provider-neutral Participation Final Rule amendment",
          type: "Rule",
          abstract:
            "The Example Commission amends the Provider-neutral Participation Final Rule and changes covered-entity obligations.",
          action: "Final rule.",
          excerpts: [
            "The agency amends the Provider-neutral Participation Final Rule through these regulations.",
          ],
          html_url:
            "https://www.federalregister.gov/documents/2021/05/20/2021-12345/example",
          publication_date: "2021-05-20",
          effective_on: "2021-06-21",
          agencies: [{ name: "Federal fixture agency" }],
        }],
      };
  return Promise.resolve(new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  }));
}

async function target(mode: "evidence" | "planning" = "evidence") {
  const fixture = createBrowserEventCardFixture();
  const screen3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study,
    proposedTiming: {
      mode: "year",
      year: 2023,
      milestoneReference: null,
    },
    openedAt: "2026-09-20T21:00:00.000Z",
  });
  const screen4 = openScreen4(screen3.state, {
    expectedRevision: screen3.state.revision,
    openedAt: "2026-09-20T21:00:01.000Z",
  });
  const planned = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations:
      screen4.state.studyFirstEventInvestigations,
    confirmedShock: screen4.state.confirmedShock,
    study: screen4.state.study,
    entryContext: screen4.state.screen3StudyEntryContexts!.at(-1)!,
    timing: screen4.state.proposedTreatmentTimings!.at(-1)!,
    advice: screen4.state.studyDesignAdvices!.at(-1)!,
    selection: null,
  });
  if (!planned) throw new Error("Missing planned Screen 4 investigation.");
  let eventTick = 2;
  let monotonic = 0;
  const executed = await executeStudyFirstEventInvestigation({
    investigation: planned,
    fetch: eventFetch,
    now: () =>
      `2026-09-20T21:00:${String(eventTick++).padStart(2, "0")}.000Z`,
    monotonicNow: () => (monotonic += 5),
    sourceRegister: buildSixScreenSourceRegister({}),
  });
  const committed4 = commitStudyFirstEventInvestigation(screen4.state, {
    expectedRevision: screen4.state.revision,
    plannedSnapshotId: planned.snapshotId,
    expectedPlanFingerprint: planned.plan.planFingerprint,
    attempts: executed.attempts,
    occurrences: executed.occurrences,
    analyses: executed.analyses,
    presentation: executed.presentation!,
    startedAt: executed.startedAt!,
    completedAt: executed.completedAt!,
  });
  const screen5 = openScreen5(committed4.state, {
    expectedRevision: committed4.state.revision,
    openedAt: "2026-09-20T21:01:00.000Z",
  });
  const mechanismContext = currentStudyFirstMechanismContext(
    screen5.state,
    "2026-09-20T21:01:01.000Z",
  );
  if (!mechanismContext) throw new Error("Missing Screen 5 context.");
  const mechanismInput = createStudyFirstMechanismInput({
    id: "study-first-host-input",
    revision: 1,
    contextFingerprint: mechanismContext.contextFingerprint,
    theoreticalPerspective: null,
    proposedMechanism:
      "Firms change privacy controls, which may increase customer trust and retention.",
    savedAt: "2026-09-20T21:01:01.000Z",
  });
  const savedInput = saveStudyFirstMechanismInput(screen5.state, {
    expectedRevision: screen5.state.revision,
    mechanismInput,
    savedAt: "2026-09-20T21:01:01.000Z",
  });
  const work = createStudyFirstScholarlyWork({
    id: "study-first-work-trust",
    providerIds: [{ provider: "crossref", nativeId: "10.1234/trust" }],
    doi: "10.1234/trust",
    title: "Privacy controls and customer trust",
    authors: ["Ada Researcher"],
    publicationYear: 2024,
    publicationVenue: "Journal of Organizational Response",
    publisher: "Research Publisher",
    workType: "journal-article",
    stableLocators: ["https://doi.org/10.1234/trust"],
    versionCaveat: "Only the member-deposited abstract was inspected.",
    updateOrRetraction: {
      retractedFlag: "not_checked",
      updateRelations: [],
    },
    access: {
      level: "abstract_inspected",
      abstractText:
        "Privacy controls may increase customer trust under stated conditions.",
      abstractSource: "crossref_member_deposit",
      reportedOpenLocations: [],
    },
    claimBoundary:
      "The abstract supports only a limited privacy-control and trust statement.",
  });
  const theoreticalProblem = createStudyFirstTheoreticalProblem({
    id: "study-first-host-problem",
    context: mechanismContext,
    mechanismInput,
  });
  const mechanismRun = mode === "planning"
    ? createStudyFirstMechanismRun({
      id: "study-first-host-planning-run",
      ordinal: 1,
      previousRunId: null,
      context: mechanismContext,
      input: mechanismInput,
      inputAssessment: {
        status: "ready",
        clarification: null,
        processSignals: ["causal connector", "response verb"],
      },
      theoreticalProblem,
      planning: {
        status: "available_via_signed_host_task",
        taskId: null,
        resultId: null,
        plan: null,
        limitation: "Stage A runs before scholarly retrieval.",
      },
      searchPlan: {
        queries: [],
        providerQueryCeiling: 2,
        providerOperationCeiling: 4,
        intentQueries: [],
        metadataRecordCeiling: 10,
        abstractInspectionCeiling: 10,
        publicationWindowRule:
          "study_period_does_not_limit_scholarship_publication_year",
      },
      attempts: [],
      works: [],
      status: "planning_ready",
      hostComparison: {
        status: "planning_required",
        taskId: null,
        limitation: "Stage A has not run.",
      },
      phases: {
        retrieval: "not_needed",
        textInspection: "not_needed",
        screening: "not_needed",
        synthesis: "pending",
        validation: "pending",
        presentation: "partial",
      },
      createdAt: "2026-09-20T21:01:02.000Z",
    })
    : createStudyFirstMechanismRun({
    id: "study-first-host-run",
    ordinal: 1,
    previousRunId: null,
    context: mechanismContext,
    input: mechanismInput,
    inputAssessment: {
      status: "ready",
      clarification: null,
      processSignals: ["causal connector", "response verb"],
    },
    theoreticalProblem,
    searchPlan: {
      queries: ["privacy controls customer trust"],
      providerQueryCeiling: 2,
      providerOperationCeiling: 4,
      intentQueries: [{
        intent: "focal_process",
        provider: "crossref",
        query: "privacy controls customer trust",
      }],
      metadataRecordCeiling: 10,
      abstractInspectionCeiling: 10,
      publicationWindowRule:
        "study_period_does_not_limit_scholarship_publication_year",
    },
    attempts: [{
      provider: "crossref",
      query: "privacy controls customer trust",
      status: "completed",
      requestUrl: "https://api.crossref.org/works?query.bibliographic=privacy",
      recordsReceived: 1,
      recordsRetained: 1,
      abstractsInspected: 1,
      failureReason: null,
    }],
    works: [work],
    status: "scholarly_evidence_ready",
    hostComparison: {
      status: "available_via_signed_host_task",
      taskId: null,
      limitation: "Conditional synthesis only.",
    },
    phases: {
      retrieval: "complete",
      textInspection: "complete",
      screening: "complete",
      synthesis: "pending",
      validation: "pending",
      presentation: "complete",
    },
    createdAt: "2026-09-20T21:01:02.000Z",
  });
  const committed5 = commitStudyFirstMechanismRun(savedInput.state, {
    expectedRevision: savedInput.state.revision,
    run: mechanismRun,
    savedAt: "2026-09-20T21:01:02.000Z",
  });

  const storage = new InMemorySixScreenWorkflowStorage();
  const sixScreenStore = new SixScreenWorkflowStore(storage);
  await sixScreenStore.create({
    state: committed5.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("study-first-host"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-22T00:00:00.000Z",
  });
  const read = await sixScreenStore.read({ runId, accessToken });
  if (read.outcome !== "found") throw new Error("Missing host parent.");
  let now = "2026-09-20T21:02:00.000Z";
  let id = 0;
  const taskStore = new HostReasoningTaskStore(storage, {
    enforceParentGuard: true,
  });
  const host = createHostReasoningWorkflowRuntime({
    taskStore,
    screen02Store: new InMemoryScreen02WorkflowStore(),
    screen03Store: new InMemoryScreen03WorkflowStore(),
    sixScreenStore,
    signing,
    now: () => now,
    createId: (kind) => `study-first-${kind}-${++id}`,
    discoverScreen02Find: async () => {
      throw new Error("Study-first host tests must not invoke Screen 2 discovery.");
    },
  });
  return {
    host,
    taskStore,
    sixScreenStore,
    state: committed5.state,
    stateFingerprint: read.record.stateFingerprint,
    setNow(value: string) {
      now = value;
    },
  };
}

async function prepareDelivered(
  value: Awaited<ReturnType<typeof target>>,
  taskType:
    | typeof SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
    | typeof SCREEN05_THEORETICAL_PLANNING_TASK
    | typeof SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  selectedEventId: string,
) {
  const minute = taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
    ? "02"
    : taskType === SCREEN05_THEORETICAL_PLANNING_TASK
      ? "03"
      : "04";
  value.setNow(`2026-09-20T21:${minute}:00.000Z`);
  const context = buildStudyFirstHostTaskContext(
    value.state,
    taskType,
    selectedEventId,
  );
  const prepared = await value.host.prepare({
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: `prepare-${taskType}-${selectedEventId}`,
    taskType,
    runId,
    accessToken,
    candidatePoolId: null,
    selectedEventId,
    claimGroupId: null,
    expectedScopeFingerprint: value.stateFingerprint,
    expectedCandidatePoolFingerprint: null,
    expectedEventFingerprint: context.eventFingerprint,
    retryOfTaskId: null,
  });
  value.setNow(`2026-09-20T21:${minute}:01.000Z`);
  await value.host.recordMessageDelivery({
    schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
    operationId: `deliver-${taskType}-${selectedEventId}`,
    taskId: prepared.taskId,
    runId,
    accessToken,
    channel: "ui/message",
    accepted: true,
    requestedAt: `2026-09-20T21:${minute}:00.500Z`,
    resolvedAt: `2026-09-20T21:${minute}:01.000Z`,
    failureCode: null,
    failureExplanation: null,
  });
  value.setNow(`2026-09-20T21:${minute}:02.000Z`);
  return prepared;
}

function validateRetiredScreen5Contract(
  value: Awaited<ReturnType<typeof target>>,
  taskType:
    | typeof SCREEN05_THEORETICAL_PLANNING_TASK
    | typeof SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  selectedEventId: string,
  proposal: unknown,
) {
  const frozen = buildStudyFirstHostTaskContext(
    value.state,
    taskType,
    selectedEventId,
  );
  return validateAndNormalizeStudyFirstHostResult({
    task: {
      taskType,
      selectedEventId: frozen.selectedEventId,
      inputFingerprint: fingerprintHostReasoningValue(frozen.facts),
      eventFingerprint: frozen.eventFingerprint,
      sourcePoolFingerprint: fingerprintHostReasoningValue(
        frozen.allowedSourceIds,
      ),
    } as never,
    currentState: value.state,
    boundedFacts: frozen.facts,
    proposal,
  });
}

describe("study-first signed host intelligence", () => {
  it("runs Stage A with zero scholarly records and preserves X, M0, Y, and typed discovery intents", async () => {
    const value = await target("planning");
    const frozen = buildStudyFirstHostTaskContext(
      value.state,
      SCREEN05_THEORETICAL_PLANNING_TASK,
      "study-first-host-planning-run",
    );
    const facts = screen05TheoreticalPlanningFactsSchema.parse(
      frozen.facts,
    );
    expect(frozen.allowedSourceIds).toEqual([]);
    expect(facts.theoreticalProblem).toMatchObject({
      theoreticalChange: {
        originalText: "Customer protection",
        direction: "unknown",
      },
      focal: {
        originalText:
          "Firms change privacy controls, which may increase customer trust and retention.",
      },
      outcome: {
        concept: "Firm performance",
        measure: "Return on assets",
      },
    });
    const result = validateRetiredScreen5Contract(
      value,
      SCREEN05_THEORETICAL_PLANNING_TASK,
      "study-first-host-planning-run",
      {
      conceptualQuestion:
        "How could customer protection affect firm performance through processes other than customer trust?",
      relationshipInterpretation: {
        theoreticalChange: "Customer protection",
        direction: "unknown",
        outcomeEndpoint: "Firm performance measured by return on assets",
        policyToConstructQualification:
          "The researcher proposes customer protection as X; the policy record does not establish a pure construct intervention.",
        sourceFieldRefs: ["study.policySideConcept", "study.outcome"],
      },
      candidates: [{
        id: "candidate-compliance-effort",
        conceptLabel: "Compliance effort",
        actor: "Managers and compliance staff",
        processNodes: [
          "Customer-protection obligations change",
          "Managers allocate systems and staff effort",
          "Operating costs and capabilities may change",
          "Return on assets may change under cost and asset conditions",
        ],
        contextualConditions: [
          "The sampled firms must bear material implementation effort.",
          "Cost or capability changes must reach the firm-year outcome.",
        ],
        distinctionFromFocal:
          "This pathway can operate even if customer trust remains unchanged.",
        perspective: "Organizational adaptation",
        perspectiveOrigin: "analyst_suggested",
        relationToFocal: "competing_same_pattern",
        hypothesisStatus: "provisional",
      }],
      supplementaryAccounts: [{
        id: "account-industry-exposure",
        category: "boundary_condition",
        label: "Industry exposure",
        explanation:
          "Implementation effort may differ by data intensity; this conditions rather than mediates the pathway.",
      }],
      evidenceNeeds: [{
        id: "need-compliance-effort",
        candidateId: "candidate-compliance-effort",
        propositionToInvestigate:
          "Customer-protection obligations change organizational implementation effort or operating resources.",
        purpose: "support",
        priority: "high",
      }],
      queryIntents: [{
        id: "intent-direct-x-y",
        intent: "direct_x_y_open_ended",
        conceptGroups: [["customer protection"], ["firm performance", "return on assets"]],
        scopeTerms: ["firms"],
        evidenceNeedIds: [],
      }, {
        id: "intent-compliance-effort",
        intent: "alternative_pathway",
        conceptGroups: [["customer protection"], ["compliance effort", "implementation cost"]],
        scopeTerms: ["organizations"],
        evidenceNeedIds: ["need-compliance-effort"],
      }, {
        id: "intent-contrary-boundary",
        intent: "contrary_or_boundary",
        conceptGroups: [["customer protection"], ["boundary condition", "null relationship"]],
        scopeTerms: ["firms"],
        evidenceNeedIds: ["need-compliance-effort"],
      }],
      limitations: [
        "No scholarly source has been retrieved or inspected in Stage A.",
      ],
      hostModel: "host_model_not_exposed",
      },
    );
    expect(screen05TheoreticalPlanningResultSchema.parse(result)).toMatchObject({
      intelligenceKind: "theoretical_mechanism_plan",
      candidates: [{ conceptLabel: "Compliance effort" }],
      scientificMutation: "none",
      researcherDecision: "none",
    });
  });

  it("validates and persists a bounded queue result for two different Screen 4 events", async () => {
    const value = await target();
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: value.state.studyFirstEventInvestigations,
      confirmedShock: value.state.confirmedShock,
      study: value.state.study,
      entryContext: value.state.screen3StudyEntryContexts!.at(-1)!,
      timing: value.state.proposedTreatmentTimings!.at(-1)!,
      advice: value.state.studyDesignAdvices!.at(-1)!,
      selection: null,
    })!;
    const visibleOccurrences = investigation.presentation!.visibleEventIds
      .map((id) => investigation.occurrences.find((item) => item.id === id)!);
    expect(visibleOccurrences.length).toBeGreaterThanOrEqual(2);
    expect(visibleOccurrences.length).toBeLessThanOrEqual(10);
    const originalEvents = visibleOccurrences.filter(({ providerId }) =>
      providerId === "federal_register" || providerId === "openfema");
    expect(originalEvents).toHaveLength(2);
    const additionalEvents = visibleOccurrences.filter(({ providerId }) =>
      providerId === "reviewed_official_documents");
    expect(additionalEvents.length).toBeGreaterThan(0);
    expect(additionalEvents.some(({ geography }) =>
      geography.labels.includes("United Kingdom"))).toBe(false);
    for (const occurrence of additionalEvents) {
      expect(occurrence.evidence.length).toBeGreaterThan(0);
      expect(occurrence.evidence.every(({ sourceId, locator }) =>
        Boolean(sourceId) && /^https?:\/\//u.test(locator))).toBe(true);
    }

    for (const eventId of originalEvents.map(({ id }) => id)) {
      const prepared = await prepareDelivered(
        value,
        SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
        eventId,
      );
      const facts = screen04StudyEventAssessmentFactsSchema.parse(
        prepared.privateModelContext.boundedFacts,
      );
      const sourceId = facts.event.sources[0]!.sourceId;
      const receipt = await value.host.submitScreen04StudyEventAssessment({
        schemaVersion:
          SCREEN04_STUDY_EVENT_ASSESSMENT_SUBMISSION_SCHEMA_VERSION,
        taskId: prepared.taskId,
        capability: prepared.privateModelContext.submission.capability,
        screeningDisposition: "unresolved",
        relationshipType: "uncertain",
        focalRelation: {
          status: "unresolved",
          targetInstrument: null,
          sourceIds: [],
          explanation:
            "The bounded packet does not establish an action on the exact focal instrument.",
        },
        documentedChange: facts.event.summary,
        relevanceArgument:
          "This documented event could matter only if its affected activity reaches sampled firms during the proposed contrast.",
        comparisonImplication:
          "The comparison may be affected only if exposure or response differs across the proposed groups.",
        argumentLinks: [],
        dimensionalFit: {
          populationOrActivity: "unknown",
          analysisLevel: "unknown",
          geography: "plausible_with_condition",
          industry: "unknown",
          temporalContrast: "plausible_with_condition",
          outcomeOrMeasure: "unknown",
          groupDifferential: "unknown",
        },
        timingRole:
          "The documented date may overlap the study window; persistence and the relation to proposed treatment timing remain unresolved.",
        materialLimitations: [
          "Unit-level exposure and differential response were not inspected.",
        ],
        nextChecks: [
          "Map the affected activity and dated exposure to both proposed groups.",
        ],
        sourceIds: [sourceId],
        causalStatus: "conditional_assessment_not_classification",
        hostModel: "host_model_not_exposed",
      });
      expect(receipt).toMatchObject({
        disposition: "applied",
        status: "applied",
      });
      const stored = await value.taskStore.read(prepared.taskId);
      expect(stored.outcome).toBe("found");
      if (stored.outcome === "found") {
        expect(screen04StudyEventAssessmentResultSchema.parse(
          stored.record.proposal,
        ).argumentLinks).toEqual([]);
      }
    }
  });

  it("validates and stores Screen 4 and Screen 5 results without scientific mutation", async () => {
    const value = await target();
    const originalFingerprint = value.stateFingerprint;
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: value.state.studyFirstEventInvestigations,
      confirmedShock: value.state.confirmedShock,
      study: value.state.study,
      entryContext: value.state.screen3StudyEntryContexts!.at(-1)!,
      timing: value.state.proposedTreatmentTimings!.at(-1)!,
      advice: value.state.studyDesignAdvices!.at(-1)!,
      selection: null,
    })!;
    const eventId = investigation.presentation!.visibleEventIds[0]!;
    const screen4 = await prepareDelivered(
      value,
      SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
      eventId,
    );
    const eventFacts = screen04StudyEventAssessmentFactsSchema.parse(
      screen4.privateModelContext.boundedFacts,
    );
    const sourceId = eventFacts.event.sources[0]!.sourceId;
    const eventReceipt = await value.host.submitScreen04StudyEventAssessment({
      schemaVersion:
        SCREEN04_STUDY_EVENT_ASSESSMENT_SUBMISSION_SCHEMA_VERSION,
      taskId: screen4.taskId,
      capability: screen4.privateModelContext.submission.capability,
      screeningDisposition: "main",
      relationshipType: "related_policy_stage",
      focalRelation: {
        status: "source_linked",
        targetInstrument: "Provider-neutral Participation Final Rule",
        sourceIds: [sourceId],
        explanation:
          "The inspected source names the Provider-neutral Participation Final Rule and states that the agency amends it.",
      },
      documentedChange:
        "The agency documents an amendment to the Provider-neutral Participation Final Rule.",
      relevanceArgument:
        "This may change the content or timing of the saved focal intervention and therefore the treatment definition used for the proposed comparison.",
      comparisonImplication:
        "The comparison could be mis-timed if the implementation stage differs from the saved 2023 treatment year; this does not establish differential firm exposure.",
      argumentLinks: [{
        from: "Documented implementing regulations",
        to: "Focal-policy treatment definition",
        status: "source_documented",
        sourceIds: [sourceId],
        assumption: null,
      }, {
        from: "Focal-policy treatment definition",
        to: "Firm performance",
        status: "unresolved",
        sourceIds: [],
        assumption:
          "A specific changed obligation would need to reach sampled firms through a performance-relevant process.",
      }],
      dimensionalFit: {
        populationOrActivity: "unknown",
        analysisLevel: "unknown",
        geography: "plausible_with_condition",
        industry: "unknown",
        temporalContrast: "plausible_with_condition",
        outcomeOrMeasure: "unknown",
        groupDifferential: "unknown",
      },
      timingRole:
        "The documented date precedes the proposed 2023 treatment year, so the correct operative stage and persistence remain unresolved.",
      materialLimitations: [
        "The record does not establish firm-level exposure or an outcome response.",
      ],
      nextChecks: [
        "Link historical reporting obligations to sampled firms in both groups.",
      ],
      sourceIds: [sourceId],
      causalStatus: "conditional_assessment_not_classification",
      hostModel: "host_model_not_exposed",
    });
    expect(eventReceipt).toMatchObject({
      disposition: "applied",
      status: "applied",
    });
    const storedEvent = await value.taskStore.read(screen4.taskId);
    expect(storedEvent.outcome).toBe("found");
    if (storedEvent.outcome === "found") {
      expect(screen04StudyEventAssessmentResultSchema.parse(
        storedEvent.record.proposal,
      )).toMatchObject({
        scientificMutation: "none",
        researcherDecision: "none",
        outcomeValuesInspected: false,
      });
    }

    const screen5 = buildStudyFirstHostTaskContext(
      value.state,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
    );
    const mechanismFacts = screen05StudyMechanismComparisonFactsSchema.parse(
      screen5.facts,
    );
    const workId = mechanismFacts.works[0]!.workId;
    const mechanismResult = validateRetiredScreen5Contract(
      value,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
      {
        focal: {
          id: "mechanism-trust",
          conceptLabel: "Customer trust pathway",
          perspective: null,
          perspectiveOrigin: "not_assigned",
          processChain: [
            "Privacy controls become more credible",
            "Customer trust may increase",
            "Retention could change",
          ],
          connectedArgument:
            "More credible privacy controls may increase customer trust and retention, which could reach firm performance if customer responses aggregate to sampled firms.",
          fitToStudy:
            "This could reach firm-year performance only if customer responses aggregate to sampled firms.",
          evidenceStatus: "source_linked",
          propositions: [{
            workId,
            supportedStatement:
              "Privacy controls may increase customer trust under stated conditions.",
            sourceRole: "theoretical",
            transferLimit:
              "The abstract does not study CCPA or public manufacturers.",
          }],
          materialTransferLimit:
            "The abstract does not establish a CCPA effect for public manufacturers.",
          relationToFocal: "focal",
        },
        alternatives: [{
          id: "mechanism-cost",
          conceptLabel: "Compliance-cost pathway",
          perspective: null,
          perspectiveOrigin: "analyst_suggested",
          processChain: [
            "New obligations require organizational effort",
            "Operating costs could change",
          ],
          connectedArgument:
            "Organizational effort could raise operating costs and place pressure on firm performance even if customer trust does not change.",
          fitToStudy:
            "A firm-year cost path may reach the same performance outcome.",
          evidenceStatus: "analytical_hypothesis",
          propositions: [],
          materialTransferLimit:
            "No cost measure or causal estimate was inspected.",
          relationToFocal: "competing_same_pattern",
        }],
        predictionMatrix: [{
          id: "prediction-trust",
          observationConcept: "Customer trust and retention",
          candidateMeasure: "A dated, validated customer trust or retention measure",
          dataSource: null,
          timing: "After credible privacy-control changes",
          level: "Customer linked to firm",
          aggregationRequirement:
            "Customer responses must be linked and aggregated to the firm-year unit.",
          conditions: "A defensible aggregation link would be required.",
          feasibility: "unknown",
          distinction: "distinguishing",
          propositionWorkIds: [workId],
          patterns: [{
            mechanismId: "mechanism-trust",
            expectedPattern:
              "Trust could change before firm performance if the focal path operates.",
          }, {
            mechanismId: "mechanism-cost",
            expectedPattern: "No unique trust prediction is established.",
          }],
        }],
        overallQualification:
          "The total-effect design alone would not identify either mechanism.",
        evidenceLimitations: [
          "Only one abstract was inspected and feasibility remains unknown.",
        ],
        causalStatus: "conditional_comparison_not_mediation_estimate",
        hostModel: "host_model_not_exposed",
      },
    );
    expect(screen05StudyMechanismComparisonResultSchema.parse(
      mechanismResult,
    )).toMatchObject({
      scientificMutation: "none",
      researcherDecision: "none",
      outcomeValuesInspected: false,
    });

    const after = await value.sixScreenStore.read({ runId, accessToken });
    expect(after.outcome).toBe("found");
    if (after.outcome === "found") {
      expect(after.record.stateFingerprint).toBe(originalFingerprint);
    }
  });

  it("rejects an invented Screen 5 scholarly reference", async () => {
    const value = await target();
    expect(() => validateRetiredScreen5Contract(
      value,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
      {
      focal: {
        id: "invented-mechanism",
        conceptLabel: "Invented support",
        perspective: null,
        perspectiveOrigin: "analyst_suggested",
        processChain: ["Policy may change behavior", "Outcome could change"],
        connectedArgument:
          "The policy may change behavior and the outcome under unresolved conditions.",
        fitToStudy: "This may fit only under unresolved assumptions.",
        evidenceStatus: "source_linked",
        propositions: [{
          workId: "invented-work",
          supportedStatement: "Invented support may change behavior.",
          sourceRole: "theoretical",
          transferLimit: "The cited work is not in the frozen packet.",
        }],
        materialTransferLimit: "The cited work is not in the frozen packet.",
        relationToFocal: "focal",
      },
      alternatives: [],
      predictionMatrix: [{
        id: "invented-prediction",
        observationConcept: "Intermediate response",
        candidateMeasure: "Unspecified intermediate response measure",
        dataSource: null,
        timing: "Unknown",
        level: "Firm",
        aggregationRequirement: "No aggregation rule is established.",
        conditions: "Unknown",
        feasibility: "unknown",
        distinction: "insufficient_evidence",
        propositionWorkIds: [],
        patterns: [{
          mechanismId: "invented-mechanism",
          expectedPattern: "A response might precede the outcome.",
        }],
      }],
      overallQualification: "This remains conditional.",
      evidenceLimitations: ["The source boundary is unresolved."],
      causalStatus: "conditional_comparison_not_mediation_estimate",
      hostModel: "host_model_not_exposed",
      },
    )).toThrow(/frozen scholarly boundary/iu);
  });

  it("accepts an unsupported focal hypothesis, zero rivals, zero prediction rows, and ordinary negation", async () => {
    const value = await target();
    const result = validateRetiredScreen5Contract(
      value,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
      {
      focal: {
        id: "unsupported-focal",
        conceptLabel: "Customer trust pathway",
        perspective: null,
        perspectiveOrigin: "researcher_supplied",
        processChain: [
          "Privacy controls become more credible",
          "Customer trust may increase",
          "Retention could change",
        ],
        connectedArgument:
          "The researcher proposes that privacy controls may increase customer trust and retention, then reach firm performance.",
        fitToStudy:
          "Customer responses would need a defensible link to the firm-year outcome.",
        evidenceStatus: "analytical_hypothesis",
        propositions: [],
        materialTransferLimit:
          "The bounded packet does not supply a directly supporting passage for the full focal chain.",
        relationToFocal: "focal",
      },
      alternatives: [],
      predictionMatrix: [],
      overallQualification:
        "The available abstract does not prove the proposed mechanism, and no adequately supported rival or distinguishing row was identified.",
      evidenceLimitations: [
        "The focal process remains an unsupported analytical hypothesis.",
      ],
      causalStatus: "conditional_comparison_not_mediation_estimate",
      hostModel: "host_model_not_exposed",
      },
    );
    expect(screen05StudyMechanismComparisonResultSchema.parse(result))
      .toMatchObject({
        focal: { id: "unsupported-focal" },
        alternatives: [],
        predictionMatrix: [],
        scientificMutation: "none",
      });
  });

  it("rejects semantic non-support even when the submitted work ID is valid", async () => {
    const value = await target();
    const frozen = buildStudyFirstHostTaskContext(
      value.state,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
    );
    const facts = screen05StudyMechanismComparisonFactsSchema.parse(
      frozen.facts,
    );
    const validWorkId = facts.works[0]!.workId;
    expect(() => validateRetiredScreen5Contract(
      value,
      SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
      "study-first-host-run",
      {
      focal: {
        id: "semantic-mismatch",
        conceptLabel: "Customer trust pathway",
        perspective: null,
        perspectiveOrigin: "analyst_suggested",
        processChain: ["Privacy controls may change", "Customer trust may change"],
        connectedArgument:
          "Privacy controls may change customer trust under unresolved conditions.",
        fitToStudy: "The pathway may fit only with a firm-level aggregation link.",
        evidenceStatus: "source_linked",
        propositions: [{
          workId: validWorkId,
          supportedStatement:
            "Executive compensation raises patenting and product innovation.",
          sourceRole: "empirical",
          transferLimit: "The setting and outcome do not match this study.",
        }],
        materialTransferLimit:
          "The stated proposition is unrelated to the inspected abstract.",
        relationToFocal: "focal",
      },
      alternatives: [],
      predictionMatrix: [],
      overallQualification: "The comparison remains conditional.",
      evidenceLimitations: ["Only one abstract was inspected."],
      causalStatus: "conditional_comparison_not_mediation_estimate",
      hostModel: "host_model_not_exposed",
      },
    )).toThrow(/frozen scholarly boundary/iu);
  });
});
