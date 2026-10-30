import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createCoEventCandidateOccurrence } from
  "../../src/core/six-screen/co-event-execution";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import {
  STUDY_FIRST_EVENT_PRESENTATION_VERSION,
  createCompletedStudyFirstEventInvestigation,
  validateStudyFirstEventInvestigationCollections,
  type StudyFirstEventPresentation,
} from "../../src/core/six-screen/study-first-event-investigation";
import {
  Screen6CurrentPlanPanel,
  screen6ReadablePlanText,
} from "../../src/ui/six-screen/Screen6CurrentPlanPanel";
import { StudyFirstEventInvestigationPanel } from
  "../../src/ui/six-screen/SixScreenApp";
import type { StudyFirstEventInvestigationWorkspace } from
  "../../src/worker/six-screen-workflow-runtime";
import { browserEventCardFixtureAt } from
  "../browser/six-screen-event-card-review-fixture";
import {
  acceptanceCase,
  createValidatedStudyFirstScenario,
  syntheticFixture,
  syntheticMutation,
} from "./ph1-fixture-adapter";

function workspace(
  investigation: NonNullable<StudyFirstEventInvestigationWorkspace["investigation"]>,
): StudyFirstEventInvestigationWorkspace {
  return {
    investigation,
    discoveryTask: {
      taskId: `discovery-${investigation.snapshotId}`,
      state: investigation.status === "planned" ? "not_started" : "complete",
      stage: investigation.status === "planned" ? "preparation" : "complete",
      nextAction: investigation.status === "planned" ? "start" : "none",
      completedStepCount: investigation.status === "planned"
        ? 0 : investigation.plan.steps.length,
      totalStepCount: investigation.plan.steps.length,
      pendingStepCount: investigation.status === "planned"
        ? investigation.plan.steps.length : 0,
      queryCount: 0,
      documentCount: 0,
      recordsReceived: investigation.occurrences.length,
      recordsAccepted: investigation.occurrences.length,
      stopReason: null,
      continuationMode: "panel_driven",
      continuationDisclosure:
        "This controlled task runs only after the explicit panel action.",
    },
    documentedOccurrences: investigation.occurrences,
    refreshAvailable: false,
    sourceVersionCurrent: true,
    interpretationQueue: null,
    interpretationRevisions: [],
    latestScreen5Handoff: null,
    revisions: [{
      snapshotId: investigation.snapshotId,
      contextId: investigation.context.id,
      ordinal: investigation.ordinal,
      status: investigation.status,
      visibleEventCount:
        investigation.presentation?.visibleEventIds.length ?? 0,
      completedAt: investigation.completedAt,
    }],
    claimBoundary:
      "Occurrence evidence does not establish study-specific relevance.",
  };
}

function occurrenceOnlyWorkspace(): StudyFirstEventInvestigationWorkspace {
  const { plannedInvestigation } = createValidatedStudyFirstScenario();
  const occurrence = createCoEventCandidateOccurrence({
    id: "fx10-documented-event",
    providerId: "federal_register",
    sourceNativeId: "fixture-record-1",
    title: "Manufacturing investment subsidy (fictional)",
    description:
      "The controlled official source record documents a fictional investment program.",
    eventFamily: "overlapping_policy",
    formalIdentifiers: ["FIXTURE-2020-1"],
    typedDates: [{
      kind: "effective",
      value: "2020-09-01",
      precision: "day",
      sourceId: "fx10-source",
    }],
    geography: {
      status: "provider_reported",
      labels: ["United States"],
    },
    evidence: [{
      sourceId: "fx10-source",
      title: "Controlled official fixture record",
      locator: "https://example.gov/fixture-record",
      publisher: "Fixture agency",
      publishedDate: "2020-08-20",
      authorityTier: 1,
      retrievedAt: browserEventCardFixtureAt(42),
      evidenceRole: "occurrence_metadata",
      factText: "The controlled record documents the fictional program.",
    }],
    recordedAt: browserEventCardFixtureAt(42),
  });
  const presentationBody = {
    schemaVersion: STUDY_FIRST_EVENT_PRESENTATION_VERSION,
    status: "events_available",
    visibleEventIds: [occurrence.id],
    overflowEventIds: [],
    coverage: {
      attemptedBranches: ["overlapping_policy"],
      completedBranches: ["overlapping_policy"],
      unsupportedBranches: [],
      failedBranches: [],
      sourceRoutesAttempted: 1,
      sourceRoutesSucceeded: 1,
      interpretation: "evidence_bounded",
      semanticAssessment: "unavailable",
      phases: {
        retrieval: "complete",
        inspection: "complete",
        screening: "complete",
        synthesis: "unavailable",
        validation: "unavailable",
        presentation: "complete",
      },
      limitation:
        "Only the documented occurrence is available; optional analysis is absent.",
    },
    completedAt: browserEventCardFixtureAt(43),
  } satisfies Omit<StudyFirstEventPresentation, "presentationFingerprint">;
  const presentation: StudyFirstEventPresentation = {
    ...presentationBody,
    presentationFingerprint: fingerprintSixScreenValue(presentationBody),
  };
  const completed = createCompletedStudyFirstEventInvestigation({
    previous: plannedInvestigation,
    attempts: [],
    occurrences: [occurrence],
    analyses: [],
    presentation,
    startedAt: browserEventCardFixtureAt(42),
    completedAt: browserEventCardFixtureAt(43),
  });
  validateStudyFirstEventInvestigationCollections({
    investigations: [plannedInvestigation, completed],
  });
  return workspace(completed);
}

function occurrences(text: string, value: string) {
  return text.split(value).length - 1;
}

describe("PH1 rendered workflow acceptance", () => {
  it("AC039 / FX06 exposes a start action for a current-version planned Screen 4 task", () => {
    expect(acceptanceCase("AC039").fixture_ids).toContain("FX06");
    const { plannedInvestigation } = createValidatedStudyFirstScenario();
    const onResumeSource = vi.fn();
    const html = renderToStaticMarkup(
      <StudyFirstEventInvestigationPanel
        workspace={workspace(plannedInvestigation)}
        onResumeSource={onResumeSource}
      />,
    );

    expect(html).toContain("Find alternative shocks");
    expect(html).toContain(
      "Any retained alternative shocks appear before study-specific assessment",
    );
    expect(html).toContain("Source discovery task");
    expect(onResumeSource).not.toHaveBeenCalled();
  });

  it("AC043 / FX10 / MU07 presents a source-documented shock before assessment", () => {
    expect(acceptanceCase("AC043").fixture_ids).toContain("FX10");
    expect(syntheticFixture("FX10").id).toBe("FX10");
    expect(syntheticMutation("MU07").id).toBe("MU07");
    const html = renderToStaticMarkup(
      <StudyFirstEventInvestigationPanel
        workspace={occurrenceOnlyWorkspace()}
      />,
    );

    expect(html).toContain("1 alternative shock found");
    expect(html).toContain("Alternative shocks");
    expect(html).toContain("0 of 1 events assessed");
    expect(html).toContain("Manufacturing investment subsidy (fictional)");
    expect(html).toContain("Source documented · assessment pending");
    expect(html).toContain("Source record");
    expect(html).not.toContain("What is documented");
    expect(html).not.toContain("Why it may matter");
    expect(html).not.toContain("What should you check next");
  });

  it("AC060 / FX13 keeps Screen 6 compact before model generation", () => {
    expect(acceptanceCase("AC060").fixture_ids).toContain("FX13");
    const { screen3State } = createValidatedStudyFirstScenario();
    const plan = createScreen6CurrentPlan(screen3State);
    const html = renderToStaticMarkup(
      <Screen6CurrentPlanPanel
        plan={plan}
        personalization={null}
        disabled={false}
        unavailableReason={null}
        onPersonalize={async () => undefined}
      />,
    );

    const preliminaryDetails = html.indexOf(
      '<details class="six-current-plan-preparation"',
    );
    expect.soft(html.match(/class="six-primary"/gu) ?? []).toHaveLength(1);
    expect.soft(html).toContain("Study-specific challenge plan — Not yet generated");
    expect.soft(html).not.toContain(
      "General checks based on saved information",
    );
    expect.soft(preliminaryDetails).toBeGreaterThan(0);
    expect.soft(html).toContain(
      "<summary>Saved evidence coverage used for this summary</summary>",
    );
    expect.soft(html).not.toContain('aria-label="Ten uncertainty dimensions"');
    expect.soft(html).not.toContain('aria-label="Planned diagnostic checks"');
    expect.soft(html).not.toContain("Conditional claim boundary");
  });

  it("AC062 / FX13 / FX17 / MU09 does not repeat full coverage text in main or readable export", () => {
    expect(acceptanceCase("AC062").fixture_ids).toEqual(
      expect.arrayContaining(["FX13", "FX17"]),
    );
    expect(syntheticMutation("MU09").id).toBe("MU09");
    const { screen3State } = createValidatedStudyFirstScenario();
    const plan = createScreen6CurrentPlan(screen3State);
    const coverage =
      "The requirement applies to operators serving the covered market.";
    expect(plan.upstream.policyEvidence.claims.some(
      ({ statement }) => statement === coverage,
    )).toBe(true);

    const html = renderToStaticMarkup(
      <Screen6CurrentPlanPanel
        plan={plan}
        personalization={null}
        disabled={false}
        unavailableReason={null}
        onPersonalize={async () => undefined}
      />,
    );
    const exported = screen6ReadablePlanText(plan, null);

    expect(occurrences(html, coverage)).toBeLessThanOrEqual(1);
    expect(occurrences(exported, coverage)).toBeLessThanOrEqual(1);
  });
});
