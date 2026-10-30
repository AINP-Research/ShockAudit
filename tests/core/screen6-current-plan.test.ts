import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan, screen6LocalDimensionSummaries } from
  "../../src/core/six-screen/screen6-current-plan";
import { createStudyDesignSelection } from
  "../../src/core/six-screen/study-design-advice";
import type { Screen6DiagnosticPlan } from
  "../../src/core/six-screen/screen6-diagnostic-plan";
import { openScreen3, openScreen4, type StudyContextDraft } from
  "../../src/core/six-screen/workflow";
import {
  estimateScreen6Contextualization,
  SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
  SCREEN6_CONTEXTUALIZER_INPUT_CEILING,
  screen6ContextualizerPacket,
  validateScreen6Contextualization,
} from "../../src/worker/screen6-contextualizer";
import { Screen6CurrentPlanPanel, screen6EffectiveGuidance,
  screen6ReadablePlanText } from
  "../../src/ui/six-screen/Screen6CurrentPlanPanel";
import type { Screen6PublicPersonalization } from
  "../../src/worker/six-screen-workflow-runtime";
import type { PolicyReview, SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import type { StudyFirstEventInvestigation } from
  "../../src/core/six-screen/study-first-event-investigation";
import {
  createBrowserEventCardFixture,
  browserEventCardFixtureAt,
} from "../browser/six-screen-event-card-review-fixture";

const study: StudyContextDraft = {
  population: "Public manufacturing firms",
  analysisUnit: "firm-year",
  geography: ["California", "United States"],
  industry: ["Manufacturing"],
  period: { start: "2010", end: "2022" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Privacy protection",
  policySideConcept: "Customer information rights",
  initialExplanation: "Through increased customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Other states' firms",
  resultsPreviouslyInspected: "not_disclosed",
};

function studyState() {
  const fixture = createBrowserEventCardFixture();
  return openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study,
    proposedTiming: { mode: "year", year: 2020, milestoneReference: null },
    openedAt: browserEventCardFixtureAt(30),
  }).state;
}

describe("current Screen 6 challenge plan", () => {
  it("opens from saved facts without diagnostic input or model inference", () => {
    const state = studyState();
    const plan = createScreen6CurrentPlan(state);
    expect(plan.modelCalls).toBe(0);
    expect(plan.resultsAssessed).toBe(false);
    expect(plan.dimensions).toHaveLength(10);
    expect(plan.priorities[0]?.id).toBe("exposure-and-comparator");
    expect(plan.priorities.every((item) => item.status === "prerequisites_needed"))
      .toBe(true);
    expect(plan.study.selectedComparison).toBeNull();
    expect(plan.boundary.plannedTarget).toContain("not yet been selected");
    expect(plan.priorities.map((item) => item.id)).not.toContain(
      "did-pre-treatment-dynamics-v1",
    );
    expect(plan.priorities.map((item) => item.id)).not.toContain(
      "rd-eligibility-cutoff-v1",
    );
    expect(plan.gaps.join(" ")).toContain("not established");
    expect(estimateScreen6Contextualization(state, plan)).toBeLessThanOrEqual(
      SCREEN6_CONTEXTUALIZER_INPUT_CEILING);
    expect(screen6ContextualizerPacket(state, plan).admitted_diagnostics.length)
      .toBe(plan.priorities.length);
    const before = renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan, personalization: null, disabled: false,
      unavailableReason: null, onPersonalize: async () => {},
    }));
    expect(before).toContain("Study-specific challenge plan — Not yet generated");
    expect(before).toContain("Generate study-specific challenge plan");
    expect(before).toContain("Shock assessment summary");
    expect(before).toContain("Saved evidence coverage used for this summary");
    expect(before).not.toContain("Preliminary checks from saved evidence");
    expect(before).not.toContain("Uncertainty profile");
    expect(before).toContain(
      "Detailed priorities and checks appear only after the study-specific challenge plan is generated",
    );
    expect(before).toContain("no additional research input is required");
  });

  it("uses a selected method, and changes identity when that decision changes", () => {
    const state = studyState();
    const advice = state.studyDesignAdvices!.at(-1)!;
    const did = advice.options.find((option) =>
      option.family === "difference_in_differences")!;
    expect(did).toBeDefined();
    const selected = createStudyDesignSelection({
      advice,
      decision: { mode: "selected", optionId: did.optionId },
      rationale: "Review this contrast after eligibility evidence is assembled.",
      selectedAt: browserEventCardFixtureAt(31),
    });
    const chosenState = { ...state, studyDesignSelections: [selected] };
    const plan = createScreen6CurrentPlan(chosenState);
    expect(plan.study.selectedComparison).toBe(did.label);
    expect(plan.priorities.map((item) => item.id)).toContain(
      "did-pre-treatment-dynamics-v1",
    );
    expect(plan.priorities.map((item) => item.id)).not.toContain(
      "rd-eligibility-cutoff-v1",
    );
    expect(plan.inputFingerprint).not.toBe(
      createScreen6CurrentPlan(state).inputFingerprint,
    );
    expect(plan.boundary.plannedTarget).toContain("subject to verified assignment");
    expect(estimateScreen6Contextualization(chosenState, plan))
      .toBeLessThanOrEqual(SCREEN6_CONTEXTUALIZER_INPUT_CEILING);
  });

  it("carries previously reported feasibility with provenance and without claiming verification", () => {
    const state = studyState();
    const prior = {
      snapshotId: "prior-diagnostic-planning",
      binding: { studyRevision: state.study.revision,
        identityFingerprint: state.confirmedShock!.identityFingerprint },
      diagnosticInput: {
        inputFingerprint: "fnv1a64:1234567890abcdef",
        outcomeFrequency: { status: "known", value: "annual" },
        preTreatmentPeriods: { status: "available", count: 3,
          description: "Researcher reported" },
      },
    } as unknown as Screen6DiagnosticPlan;
    const plan = createScreen6CurrentPlan({ ...state,
      screen6DiagnosticPlans: [prior] });
    expect(plan.upstream.dataFeasibility.origin).toBe("previous_researcher_report");
    expect(plan.upstream.dataFeasibility.input?.outcomeFrequency.value).toBe("annual");
    expect(plan.gaps.join(" ")).toContain("needs verification");
    expect(plan.inputFingerprint).not.toBe(createScreen6CurrentPlan(state).inputFingerprint);
  });

  it("admits bounded prospective supplements and rejects invented results or IDs", () => {
    const plan = createScreen6CurrentPlan(studyState());
    const priority = {
      diagnostic_id: plan.priorities[0]!.id,
      priority_reason: "The proposed groups do not establish policy coverage.",
      study_specific_question: "Were the proposed firms legally eligible?",
      contextual_procedure: "Reconstruct dated coverage from records.",
      data_needs: "Coverage records for both groups.",
      concerning_pattern: "Comparison firms share the same policy exposure.",
      alternative_explanation: "The recorded location differs from operations.",
      reassurance_limit: "Eligibility does not establish parallel outcomes.",
      next_action: "Revise the comparator before estimation.",
    };
    const valid = {
      schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
      dimension_summaries: screen6LocalDimensionSummaries(plan).map((item) => ({
        dimension_id: item.dimensionId,
        title: item.title,
        known_basis: item.knownBasis,
        specific_concern: item.specificConcern,
        next_check: item.nextCheck,
        material_limit: item.materialLimit,
        source_refs: [], input_refs: item.inputRefs.slice(0, 5),
      })),
      priorities: plan.priorities.slice(0, 3).map((item) =>
        ({ ...priority, diagnostic_id: item.id })),
      claim_boundary: {
        planned_target: plan.boundary.plannedTarget,
        required_assumptions: "Verify policy eligibility and counterfactual exposure.",
        stronger_claims_not_established: "Components and mediation are not isolated.",
        next_action: "Verify eligibility.",
      },
      remaining_gaps: plan.gaps,
    };
    expect(validateScreen6Contextualization(valid, plan)).toEqual(valid);
    expect(() => validateScreen6Contextualization({ ...valid,
      dimension_summaries: valid.dimension_summaries.slice(1),
    }, plan)).toThrow(/bounded fields/u);
    expect(() => validateScreen6Contextualization({ ...valid,
      dimension_summaries: valid.dimension_summaries.map((item, index) =>
        index === 0 ? { ...item, dimension_id: "invented-dimension" } : item),
    }, plan)).toThrow(/bounded fields/u);
    expect(() => validateScreen6Contextualization({ ...valid,
      dimension_summaries: valid.dimension_summaries.map((item, index) =>
        index === 0 ? { ...item, source_refs: ["invented-source-id"] } : item),
    }, plan)).toThrow(/bounded fields/u);
    expect(() => validateScreen6Contextualization({
      ...valid, priorities: [{ ...priority, diagnostic_id: "invented-test" },
        ...valid.priorities.slice(1)],
    }, plan)).toThrow();
    expect(() => validateScreen6Contextualization({
      ...valid, claim_boundary: { ...valid.claim_boundary,
        next_action: "The estimate was 0.4." },
    }, plan)).toThrow(/unsupplied results/u);
  });

  it("uses every validated contextual field in the visible and exported guidance", () => {
    const plan = createScreen6CurrentPlan(studyState());
    const markers = {
      priority_reason: "MODEL_PRIORITY_REASON",
      study_specific_question: "MODEL_STUDY_QUESTION",
      contextual_procedure: "MODEL_PROCEDURE",
      data_needs: "MODEL_DATA_NEEDS",
      concerning_pattern: "MODEL_CONCERN",
      alternative_explanation: "MODEL_ALTERNATIVE",
      reassurance_limit: "MODEL_REASSURANCE_LIMIT",
      next_action: "MODEL_NEXT_ACTION",
    };
    const personalization = {
      status: "completed", inputFingerprint: plan.inputFingerprint,
      supplement: {
        schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
        dimension_summaries: plan.dimensions.map((dimension, index) => ({
          dimension_id: dimension.id,
          title: `MODEL_DIMENSION_TITLE_${index}`,
          known_basis: `MODEL_DIMENSION_BASIS_${index}`,
          specific_concern: `MODEL_DIMENSION_CONCERN_${index}`,
          next_check: `MODEL_DIMENSION_CHECK_${index}`,
          material_limit: `MODEL_DIMENSION_LIMIT_${index}`,
          source_refs: [], input_refs: ["study.proposedGroups"],
        })),
        priorities: plan.priorities.slice(0, 3).reverse().map((card) => ({
          diagnostic_id: card.id, ...markers,
        })),
        claim_boundary: {
          planned_target: "MODEL_TARGET",
          required_assumptions: "MODEL_ASSUMPTIONS",
          stronger_claims_not_established: "MODEL_STRONGER_CLAIMS",
          next_action: "MODEL_BOUNDARY_ACTION",
        }, remaining_gaps: ["MODEL_REMAINING_GAP"],
      },
    } as Screen6PublicPersonalization;
    const effective = screen6EffectiveGuidance(plan, personalization);
    expect(effective.dimensions).toHaveLength(10);
    expect(effective.profileBasis).toBe("validated_model_contextualization");
    expect(effective.cards[0]?.id).toBe(plan.priorities[2]?.id);
    const html = renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan, personalization, disabled: false, unavailableReason: null,
      onPersonalize: async () => {},
    }));
    for (const marker of [...Object.values(markers), "MODEL_TARGET",
      "MODEL_ASSUMPTIONS", "MODEL_STRONGER_CLAIMS", "MODEL_BOUNDARY_ACTION",
      "MODEL_REMAINING_GAP", "MODEL_DIMENSION_TITLE_0",
      "MODEL_DIMENSION_BASIS_0", "MODEL_DIMENSION_CONCERN_0",
      "MODEL_DIMENSION_CHECK_0", "MODEL_DIMENSION_LIMIT_0"]) {
      expect(html).toContain(marker);
      expect(JSON.stringify(effective)).toContain(marker);
      expect(screen6ReadablePlanText(plan, personalization)).toContain(marker);
    }
    expect(effective.cards.find((card) => card.id === plan.priorities[4]?.id)
      ?.practicalCheck.origin).toBe("reviewed_plan");
    expect(html).toContain("Reviewed procedure");
    expect(html).toContain("Prioritized checks for this study");
    expect(html).not.toContain("Generate study-specific challenge plan");
    expect(html).toContain("Reviewed limits");
    expect(html).not.toContain("Text sources:");
    expect(html).not.toContain("No Screen 6 diagnostic result establishes this condition");
  });

  it("reads historical v1 supplements with current local summaries and no extra request", () => {
    const plan = createScreen6CurrentPlan(studyState());
    const historical = {
      status: "completed", inputFingerprint: plan.inputFingerprint,
      supplement: { priorities: [{ diagnostic_id: plan.priorities[0]!.id,
        priority_reason: "ARCHIVED_REASON", next_action: "ARCHIVED_NEXT" }],
        claim_boundary: null, remaining_gaps: [] },
    } as Screen6PublicPersonalization;
    const effective = screen6EffectiveGuidance(plan, historical);
    expect(effective.profileBasis).toBe("local_current_plan");
    expect(effective.dimensions[0]?.title.text).toBe("Who faced the policy requirements?");
    expect(effective.dimensions[0]?.knownBasis.text).toContain(plan.study.policy);
    expect(renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan, personalization: historical, disabled: false, unavailableReason: null,
      onPersonalize: async () => {},
    }))).toContain("Who faced the policy requirements?");
    const archivedHtml = renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan, personalization: null, historicalPersonalization: historical,
      disabled: false, unavailableReason: null, onPersonalize: async () => {},
    }));
    expect(archivedHtml).toContain("Earlier saved model guidance");
    expect(archivedHtml).toContain("ARCHIVED_REASON");
    expect(archivedHtml).toContain("Generate study-specific challenge plan");
    expect(screen6ReadablePlanText(plan, null, historical)).toContain("ARCHIVED_NEXT");
  });

  it("offers receipt revalidation locally even when no new model allowance remains", () => {
    const plan = createScreen6CurrentPlan(studyState());
    const savedReceipt = {
      status: "receipt_saved", retryEligibility: "local_revalidation",
      inputFingerprint: plan.inputFingerprint, supplement: null, error: null,
    } as Screen6PublicPersonalization;
    const html = renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan, personalization: savedReceipt, disabled: false,
      unavailableReason: "No new provider attempts remain.",
      onPersonalize: async () => {},
    }));
    expect(html).toContain("Recheck saved response");
    expect(html).toContain("No new provider request is sent");
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Recheck saved response/u);
  });

  it("invalidates only relevant policy evidence and treatment-timing changes", () => {
    const state = studyState();
    const baseline = createScreen6CurrentPlan(state);
    const review = state.policyReview;
    if (review?.claims.length) {
      const changed = structuredClone(state);
      changed.policyReview!.claims[0]!.statement += " An amended source proposition.";
      const updated = createScreen6CurrentPlan(changed);
      expect(updated.inputFingerprint).not.toBe(baseline.inputFingerprint);
    }
    const changedTiming = structuredClone(state);
    const last = changedTiming.proposedTreatmentTimings?.at(-1);
    if (last) {
      last.year = 2021;
      last.timingFingerprint = "fnv1a64:0000000000000001";
      expect(createScreen6CurrentPlan(changedTiming).inputFingerprint)
        .not.toBe(baseline.inputFingerprint);
    }
  });

  it("traces current policy dates and relevant event pathways with omission accounting", () => {
    const state: SixScreenWorkflowState = structuredClone(studyState());
    const identity = state.confirmedShock!.identityFingerprint;
    state.policyReview = { status: "partial", identityFingerprint: identity,
      evidenceSnapshotFingerprint: "fnv1a64:2222222222222222",
      claims: [{ claimId: "claim-coverage", predicate: "coverage_condition",
        statement: "Coverage depends on company activity, not only a state label.",
        supportStatus: "indirect", qualification: "Historic applicability unresolved",
        citation: { sourceId: "source-coverage", documentVersionId: "v-historic",
          sourceTitle: "Historical coverage record", sourceRole: "official_source",
          canonicalUrl: "https://example.gov/coverage", passageId: "p-coverage" } }],
    } as unknown as PolicyReview;
    state.policyEventCardReviews = [{ status: "locked",
      binding: { identityFingerprint: identity,
        evidenceSnapshotFingerprint: state.policyReview.evidenceSnapshotFingerprint },
      lockedEventCard: { eventCardFingerprint: "fnv1a64:3333333333333333",
        conflicts: [], unresolvedRequirements: [], claims: [],
        chronology: { absoluteClocks: [{ id: "clock-announcement", stage: "announcement",
          label: "Documented announcement", timing: { mode: "absolute",
            start: "2019-04", end: null, precision: "month" },
          statements: [{ claimId: "claim-date" }], lineages: [{ sourceId: "source-date" }],
          conflictIds: [], hasUnresolvedConflict: false, qualifications: [] }],
          relativeClocks: [], undatedClocks: [] },
        treatmentClock: { mode: "no_selection", rationale: "Timing remains disputed." },
      },
    }] as unknown as SixScreenWorkflowState["policyEventCardReviews"];
    const occurrences = Array.from({ length: 9 }, (_, index) => ({
      id: `event-${index}`, title: `Other event ${index}`,
      typedDates: [{ kind: "event", value: `2020-05-${String(index + 1).padStart(2, "0")}`,
        precision: "day", sourceId: `source-${index}` }],
      evidence: [{ sourceId: `source-${index}` }],
      occurrenceStatus: "source_metadata_documented",
      relationToComparison: { status: "not_assessed" },
    }));
    const analyses = occurrences.map((event, index) => ({
      eventId: event.id, relevanceOrder: { priorityBand: index === 8
        ? "high" : "background", stableSortKey: event.id, evidenceBasis: [] },
      affectedActorOrActivity: "Affected activity unverified",
      outcomePathway: index === 8
        ? "Proposed sales disruption affecting return on assets" : "Unknown",
      comparisonImplication: "Differential exposure to examine",
      materialUncertainty: "Company-level exposure unknown",
      interpretationMode: "bounded_evidence_rules",
    }));
    const plannedEventWork = openScreen4(state, {
      expectedRevision: state.revision,
      openedAt: browserEventCardFixtureAt(32),
    }).state.studyFirstEventInvestigations!.at(-1)!;
    state.studyFirstEventInvestigations = [{
      context: plannedEventWork.context,
      status: "completed", investigationFingerprint: "fnv1a64:4444444444444444",
      snapshotId: "event-snapshot", occurrences, analyses,
    }] as unknown as StudyFirstEventInvestigation[];
    const plan = createScreen6CurrentPlan(state);
    expect(plan.upstream.policyEvidence.chronology[0]?.id).toBe("clock-announcement");
    const applicability = screen6LocalDimensionSummaries(plan).find((item) =>
      item.dimensionId === "institutional_evidence");
    expect(applicability?.knownBasis).toContain(
      "who or what is covered");
    expect(applicability?.knownBasis).toContain("recorded qualification");
    expect(plan.upstream.policyEvidence.claims[0]?.statement).toBe(
      "Coverage depends on company activity, not only a state label.");
    expect(plan.upstream.policyEvidence.claims[0]?.qualification).toBe(
      "Historic applicability unresolved");
    expect(applicability?.knownBasis).not.toContain("territorial nexus");
    expect(plan.priorities.find((item) => item.id === "timing-anticipation-v1")
      ?.reason).toContain("2019-04");
    expect(plan.upstream.otherEvents?.occurrences[0]?.id).toBe("event-8");
    expect(plan.upstream.otherEvents?.omittedCount).toBe(3);
    expect(plan.priorities.find((item) => item.id ===
      "coevent-exposure-alternatives-v1")?.reason).toContain("sales disruption");
    const packet = screen6ContextualizerPacket(state, plan);
    expect(packet.policy_evidence.claims[0]?.sourceId).toBe("source-coverage");
    expect(packet.other_events.relevant[0]?.source_ids).toContain("source-8");
    const revised = structuredClone(state);
    revised.policyEventCardReviews![0]!.lockedEventCard!
      .chronology.absoluteClocks[0]!.timing = {
        mode: "absolute", start: "2019-06", end: null, precision: "month" };
    revised.policyEventCardReviews![0]!.lockedEventCard!.eventCardFingerprint =
      "fnv1a64:5555555555555555";
    expect(createScreen6CurrentPlan(revised).inputFingerprint)
      .not.toBe(plan.inputFingerprint);
  });

  it("uses current Screen 2 source dates without a locked historical Event Card", () => {
    const state = structuredClone(studyState());
    state.policyEventCardReviews = [];
    const cited = state.policyReview!.claims[0]!;
    state.policyReview = {
      ...state.policyReview!,
      claims: [...state.policyReview!.claims, {
        ...cited, claimId: "claim-current-announcement",
        predicate: "policy_date",
        statement: "The source records the current policy announcement.",
        citation: { ...cited.citation, passageId: "p-current" },
      }],
      briefing: {
        ...state.policyReview!.briefing!,
        timeline: [{
          claimId: "claim-current-announcement",
          label: "Policy announced",
          date: { kind: "announcement", start: "2018-06-28",
            end: null, precision: "day", passageIds: ["p-current"] },
          statement: "Announcement of the current episode.",
          qualification: null,
        }],
      },
    };
    const plan = createScreen6CurrentPlan(state);
    expect(plan.upstream.policyEvidence.chronology[0]?.timing).toMatchObject({
      mode: "absolute", start: "2018-06-28", precision: "day",
    });
    expect(plan.priorities.find((item) => item.id === "timing-anticipation-v1")
      ?.reason).toContain("2018-06-28");
    expect(plan.study.construct).toBe("Customer information rights");
    expect(plan.study.construct).not.toBe(state.study.intendedConstruct);
  });

  it("reconstructs current dated claims in older Screen 2 reviews without a briefing", () => {
    const state = structuredClone(studyState());
    state.policyEventCardReviews = [];
    expect(state.policyReview?.briefing).toBeUndefined();
    const plan = createScreen6CurrentPlan(state);
    expect(plan.upstream.policyEvidence.chronologyOrigin)
      .toBe("reconstructed_current_claims");
    expect(plan.upstream.policyEvidence.chronology).toEqual(
      expect.arrayContaining([expect.objectContaining({
        timing: expect.objectContaining({ mode: "absolute", start: "2020-03-01" }),
      })]),
    );
  });

  it("separates semantic dependencies without synthesizing a v24 recovery key", () => {
    const state = studyState();
    const plan = createScreen6CurrentPlan(state);
    const transportOnly = structuredClone(state);
    transportOnly.revision += 9;
    transportOnly.updatedAt = browserEventCardFixtureAt(39);
    transportOnly.changeLog = [...transportOnly.changeLog, {
      revision: transportOnly.revision,
      at: transportOnly.updatedAt,
      summary: "Read-only panel reopen checkpoint.",
    }];
    expect(createScreen6CurrentPlan(transportOnly).inputFingerprint)
      .toBe(plan.inputFingerprint);

    const scientificEdit = structuredClone(state);
    scientificEdit.study.outcome = "Employment growth";
    expect(createScreen6CurrentPlan(scientificEdit).inputFingerprint)
      .not.toBe(plan.inputFingerprint);
    expect(plan.dependencyManifest.operational.studyRevision)
      .toBe(state.study.revision);
    expect(plan.legacyInputFingerprints).toEqual([]);
  });

  it("keeps complete repeated legal propositions in evidence without copying them into main guidance", () => {
    const state = studyState();
    const base = state.policyReview!.claims.find((claim) =>
      claim.predicate === "coverage_condition") ?? state.policyReview!.claims[0]!;
    const longRule = "SYNTHETIC COMPLETE RULE: eligibility requires condition A AND condition B, plus threshold X OR threshold Y, unless exemption Z applies in the historical reference period.";
    state.policyReview = {
      ...state.policyReview!,
      claims: Array.from({ length: 12 }, (_, index) => ({
        ...base,
        claimId: `synthetic-coverage-${index}`,
        predicate: "coverage_condition" as const,
        statement: longRule,
        qualification: "Exact boolean logic and the historical exemption must be applied together.",
        citation: {
          ...base.citation,
          passageId: `synthetic-passage-${index}`,
        },
      })),
    };
    const plan = createScreen6CurrentPlan(state);
    const mainGuidance = [
      ...screen6LocalDimensionSummaries(plan).map((item) => item.knownBasis),
      ...plan.priorities.map((item) => item.reason),
    ].join("\n");
    expect(mainGuidance).not.toContain(longRule);
    expect(plan.upstream.policyEvidence.claims).toHaveLength(12);
    expect(plan.upstream.policyEvidence.claims.every((claim) =>
      claim.statement === longRule)).toBe(true);
    expect(mainGuidance).toContain("Apply the linked passages together");
  });
});
