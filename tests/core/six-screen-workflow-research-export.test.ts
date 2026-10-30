import { describe, expect, it } from "vitest";

import {
  SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION,
  createWorkflowResearchExportBundle,
  workflowResearchExportAvailability,
} from "../../src/core/six-screen/workflow-research-export";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { createScreen5OpenAIProviderReceipt } from
  "../../src/core/six-screen/screen5-mechanism";
import { createSixScreenWorkflow } from
  "../../src/core/six-screen/workflow";
import {
  SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
  type Screen6Contextualization,
} from "../../src/worker/screen6-contextualizer";
import {
  createFrozenV24Screen6Fixture,
  createLockedBrowserEventCardFixture,
  frozenV24Screen6InputFingerprint,
} from "../browser/six-screen-event-card-review-fixture";

function validCompatibleScreen6Wire(
  plan: ReturnType<typeof createScreen6CurrentPlan>,
): Screen6Contextualization {
  const preferred = [
    ...plan.priorities.filter(({ id }) =>
      id === "exposure-and-comparator" || id === "timing-anticipation-v1"),
    ...(plan.study.selectedComparison ? plan.priorities.filter(({ id }) =>
      id.startsWith("did-") || id.startsWith("rd-")) : []),
    ...plan.priorities,
  ];
  const priorities = preferred.filter((item, index, all) =>
    all.findIndex(({ id }) => id === item.id) === index).slice(0, 3);
  return {
    schema_version: SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
    dimension_summaries: plan.dimensions.map((dimension) => ({
      dimension_id: dimension.id,
      title: `Review ${dimension.label.toLowerCase()}`,
      known_basis: `The saved plan records ${dimension.state.toLowerCase()}.`,
      specific_concern: dimension.concern,
      next_check: dimension.check,
      material_limit:
        "A prospective check alone does not establish a policy effect.",
      source_refs: [],
      input_refs: ["study.proposedGroups"],
    })),
    priorities: priorities.map((card, index) => ({
      diagnostic_id: card.id,
      priority_reason: index === 0
        ? "COMPATIBLE_V24_GUIDANCE: verify the proposed comparison."
        : "The proposed comparison needs this bounded check.",
      study_specific_question: "Does the saved comparison meet its assumptions?",
      contextual_procedure: "Review dated records under the saved design.",
      data_needs: "Dated eligibility and outcome records.",
      concerning_pattern: "The proposed groups do not match exposure.",
      alternative_explanation: "Location can misclassify policy exposure.",
      reassurance_limit: "Eligibility alone does not establish comparability.",
      next_action: "Revise the comparison if the concern remains.",
    })),
    claim_boundary: {
      planned_target: plan.boundary.plannedTarget,
      required_assumptions: "Eligibility and the comparison need evidence.",
      stronger_claims_not_established:
        "Component and mechanism effects remain unknown.",
      next_action: "Verify coverage before estimation.",
    },
    remaining_gaps: plan.gaps,
  };
}

function compatibleScreen6Receipt(wire: Screen6Contextualization) {
  return createScreen5OpenAIProviderReceipt({
    receivedAt: "2026-09-25T13:01:00.000Z",
    httpStatus: 200,
    providerRequestId: "req_compatible_v24",
    providerResponseId: "resp_compatible_v24",
    serviceTier: "default",
    latencyMs: 25,
    modelObserved: "gpt-6-luna",
    finishReason: "completed",
    usage: {
      promptTokens: 900,
      completionTokens: 500,
      totalTokens: 1_400,
      reasoningTokens: 100,
      cachedPromptTokens: 0,
    },
    rateLimit: {
      retryAfterAt: null,
      tokenResetAt: null,
      remainingTokens: null,
    },
    finalContent: JSON.stringify(wire),
  });
}

describe("shared six-screen research export", () => {
  it("creates a manifest-bound partial bundle after identity confirmation", () => {
    const fixture = createLockedBrowserEventCardFixture();
    const availability = workflowResearchExportAvailability(fixture.state);
    expect(availability).toMatchObject({
      available: true,
      completenessStatus: "partial",
      source: "current_partial_snapshot",
    });
    expect(availability.includedModules).toContain("confirmed_identity");
    expect(availability.includedModules).toContain("reviewed_event_card");

    const bundle = createWorkflowResearchExportBundle({
      state: fixture.state,
      exportedAt: "2026-09-15T20:00:00.000Z",
    });
    expect(bundle.schemaVersion).toBe(
      SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION,
    );
    if (bundle.schemaVersion !== SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION) {
      throw new Error("Expected a partial current-snapshot bundle.");
    }
    expect(bundle.completenessStatus).toBe("partial");
    expect(bundle.files.map(({ name }) => name)).toEqual([
      "design-record.md",
      "README.md",
      "study.json",
      "confirmed-shock.json",
      "event-card.json",
      "designs.json",
      "coevents.json",
      "mechanisms.json",
      "credibility-plan.json",
      "sources.csv",
      "claims.csv",
      "search-manifest.json",
      "decisions.json",
      "manifest.json",
    ]);
    expect(bundle.manifest.payloadFileCount).toBe(13);
    expect(bundle.manifest.files).toHaveLength(13);
    expect(bundle.manifest.files.every(({ contentFingerprint }) =>
      /^fnv1a64:[0-9a-f]{16}$/u.test(contentFingerprint))).toBe(true);
    expect(bundle.manifest.workflowSnapshot.revision).toBe(
      fixture.state.revision,
    );
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("capabilityToken");
    expect(serialized).not.toContain('"exactText":"');
    expect(serialized).toContain("causal certificate");
  });

  it("keeps export unavailable before identity resolution", () => {
    const state = createSixScreenWorkflow({
      runId: "partial-export-unresolved-run",
      studyId: "partial-export-unresolved-study",
      study: {
        population: "Organizations",
        analysisUnit: "Organization",
        geography: ["United States"],
        industry: ["Energy"],
        period: { start: "2018", end: "2024" },
        outcome: "Investment",
        intendedConstruct: "Organizational response",
        initialExplanation: null,
        proposedTreatment: null,
        proposedComparison: null,
        resultsPreviouslyInspected: "not_disclosed",
      },
      shockInput: "A policy still awaiting identity resolution",
      createdAt: "2026-09-15T20:00:00.000Z",
    });
    expect(workflowResearchExportAvailability(state)).toMatchObject({
      available: false,
      completenessStatus: "unavailable",
    });
    expect(() => createWorkflowResearchExportBundle({
      state,
      exportedAt: "2026-09-15T20:01:00.000Z",
    })).toThrow(/only after policy identity resolution/iu);
  });

  it("exports a completed compatible v24 Screen 6 artifact without another request", () => {
    const state = createFrozenV24Screen6Fixture().state;
    const plan = createScreen6CurrentPlan(state);
    const legacyFingerprint = frozenV24Screen6InputFingerprint;
    expect(plan.legacyInputFingerprints).toContain(legacyFingerprint);
    const supplement = validCompatibleScreen6Wire(plan);
    state.screen6Personalizations = [{
      id: "screen6-plan-aaaaaaaaaaaaaaaa",
      inputFingerprint: legacyFingerprint,
      reservationId: "screen6-contextualization-bbbbbbbbbbbbbbbb",
      status: "completed",
      attemptOrdinal: 1,
      claimOperationId: "compatible-v24-export",
      dispatchState: "dispatched",
      failureCode: null,
      failureStage: null,
      receipt: compatibleScreen6Receipt(supplement),
      supplement,
      error: null,
      updatedAt: "2026-09-25T13:01:00.000Z",
    }];
    const bundle = createWorkflowResearchExportBundle({
      state,
      exportedAt: "2026-09-25T13:02:00.000Z",
    });
    if (bundle.schemaVersion !== SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION) {
      throw new Error("Expected a partial current-snapshot bundle.");
    }
    const credibility = JSON.parse(bundle.files.find(({ name }) =>
      name === "credibility-plan.json")!.content) as Record<string, unknown>;
    expect(credibility.currentGuidanceStatus)
      .toBe("validated_compatible_v24_contextualization");
    expect(credibility.currentGuidanceInputFingerprint).toBe(legacyFingerprint);
    expect(credibility.currentStudySpecificGuidance).toEqual(supplement);
    expect(JSON.stringify(credibility.currentStudySpecificGuidance))
      .toContain("COMPATIBLE_V24_GUIDANCE");
    expect(bundle.files.find(({ name }) => name === "design-record.md")
      ?.content).toContain("Study-specific challenge plan: saved");
  });
});
