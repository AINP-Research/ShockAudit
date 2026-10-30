import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  POLICY_EVIDENCE_REQUIREMENT_KINDS,
  activateHistoricalPolicyEvidencePlan,
  adaptPolicyEvidencePlanToBriefingQuality,
  createFederalRegisterPolicyEvidencePlan,
  createOfficialDocumentPolicyEvidencePlan,
  policyEvidenceExecutionForStep,
  policyEvidenceFocusForStep,
  recordPolicyEvidencePlanAttempt,
  validatePolicyEvidencePlan,
} from "../../src/core/six-screen/policy-evidence-plan";

const createdAt = "2026-09-12T10:00:00.000Z";

function plan() {
  return createFederalRegisterPolicyEvidencePlan({
    id: "policy-plan-order-841",
    identityFingerprint: fingerprintSixScreenValue("order-841"),
    documentNumber: "2018-03708",
    createdAt,
  });
}

describe("six-screen policy evidence plan", () => {
  it("starts an official policy with controlling text and skips extra routes only after every box is sufficient", () => {
    const initial = createOfficialDocumentPolicyEvidencePlan({
      id: "official-plan-public-law",
      identityFingerprint: fingerprintSixScreenValue("public-law"),
      jurisdiction: "United States",
      sourceId: "govinfo-public-law",
      instrumentFamily: "federal_statute",
      createdAt,
    });
    expect(initial.steps.map(({ sourceRoute }) => sourceRoute)).toEqual([
      "confirmed_official_document",
      "complementary_policy_explanations",
      "official_document_relationships",
    ]);
    expect(initial.nextStepId).toBe("official-document-govinfo-public-law");
    const searched = recordPolicyEvidencePlanAttempt(initial, {
      stepId: initial.nextStepId!,
      attemptedAt: "2026-09-12T10:00:01.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Controlling text inspected.",
    });
    const adapted = adaptPolicyEvidencePlanToBriefingQuality(searched, {
      updatedAt: "2026-09-12T10:00:01.000Z",
      quality: {
        assessedAt: "2026-09-12T10:00:01.000Z",
        readyForSynthesis: true,
        requiresAdditionalSources: false,
        boxes: [
          "overview", "what_changed", "coverage", "timeline",
          "implementation_enforcement",
        ].map((box) => ({
          box: box as "overview",
          status: "sufficient" as const,
          supportingClaimIds: ["claim-1"],
          missingRequirementKinds: [],
          note: "Sufficient.",
        })),
      },
    });
    expect(adapted.nextStepId).toBeNull();
    expect(adapted.steps.map(({ status }) => status)).toEqual([
      "searched", "not_needed", "not_needed",
    ]);
    expect(adapted.steps.slice(1).every(({ attempts }) => attempts === 0))
      .toBe(true);
  });

  it("binds every substantive requirement to a policy-specific ordered route", () => {
    const value = plan();
    expect(validatePolicyEvidencePlan(value)).toEqual(value);
    expect(value.nextStepId).toBe("explanatory-context-2018-03708");
    expect(new Set(value.steps.flatMap(({ requirementKinds }) => requirementKinds)))
      .toEqual(new Set(POLICY_EVIDENCE_REQUIREMENT_KINDS));
    expect(policyEvidenceExecutionForStep(value, value.nextStepId!)).toEqual({
      sourceRoute: "complementary_policy_explanations",
      focus: "introductory_context",
    });
    expect(value.steps.at(-1)).toMatchObject({
      sourceRoute: "federal_register_ecfr_history",
      status: "not_started",
      requirementKinds: ["previous_baseline", "version"],
      note: null,
    });
  });

  it("advances through core, coverage, enforcement, and historical routes", () => {
    const afterExplanation = recordPolicyEvidencePlanAttempt(plan(), {
      stepId: "explanatory-context-2018-03708",
      attemptedAt: "2026-09-12T10:00:00.500Z",
      outcome: "searched",
      failureCode: null,
      note: "Introductory explanation saved.",
    });
    expect(afterExplanation.nextStepId).toBe("fr-core-2018-03708");
    expect(policyEvidenceFocusForStep(
      afterExplanation,
      afterExplanation.nextStepId!,
    )).toBe("core");
    const afterCore = recordPolicyEvidencePlanAttempt(afterExplanation, {
      stepId: "fr-core-2018-03708",
      attemptedAt: "2026-09-12T10:00:01.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Core facts saved.",
    });
    expect(afterCore.nextStepId).toBe("fr-coverage-2018-03708");
    expect(policyEvidenceFocusForStep(afterCore, afterCore.nextStepId!))
      .toBe("coverage_exemptions");
    const afterCoverage = recordPolicyEvidencePlanAttempt(afterCore, {
      stepId: "fr-coverage-2018-03708",
      attemptedAt: "2026-09-12T10:00:02.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Coverage facts saved.",
    });
    expect(afterCoverage.nextStepId).toBe("fr-enforcement-2018-03708");
    expect(policyEvidenceExecutionForStep(
      afterCoverage,
      afterCoverage.nextStepId!,
    )).toEqual({
      sourceRoute: "confirmed_federal_register_record",
      focus: "enforcement",
    });
    const afterEnforcement = recordPolicyEvidencePlanAttempt(afterCoverage, {
      stepId: "fr-enforcement-2018-03708",
      attemptedAt: "2026-09-12T10:00:03.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Enforcement and sanctions searched.",
    });
    expect(afterEnforcement.nextStepId).toBe("fr-context-2018-03708");
    expect(policyEvidenceExecutionForStep(
      afterEnforcement,
      afterEnforcement.nextStepId!,
    )).toEqual({
      sourceRoute: "federal_register_ecfr_history",
      focus: "historical_context",
    });
    const afterHistory = recordPolicyEvidencePlanAttempt(afterEnforcement, {
      stepId: "fr-context-2018-03708",
      attemptedAt: "2026-09-12T10:00:04.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Historical versions saved.",
    });
    expect(afterHistory.nextStepId).toBeNull();
    expect(afterHistory.steps.map(({ status }) => status)).toEqual([
      "searched",
      "searched",
      "searched",
      "searched",
      "searched",
    ]);
  });

  it("activates the exact legacy blocked step without changing completed attempts", () => {
    const afterExplanation = recordPolicyEvidencePlanAttempt(plan(), {
      stepId: "explanatory-context-2018-03708",
      attemptedAt: "2026-09-12T10:00:00.500Z",
      outcome: "searched",
      failureCode: null,
      note: "Introductory explanation saved.",
    });
    const afterCore = recordPolicyEvidencePlanAttempt(afterExplanation, {
      stepId: "fr-core-2018-03708",
      attemptedAt: "2026-09-12T10:00:01.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Core facts saved.",
    });
    const savedCurrent = recordPolicyEvidencePlanAttempt(afterCore, {
      stepId: "fr-coverage-2018-03708",
      attemptedAt: "2026-09-12T10:00:02.000Z",
      outcome: "searched",
      failureCode: null,
      note: "Coverage facts saved.",
    });
    const legacy = structuredClone(savedCurrent);
    legacy.steps = legacy.steps.filter(({ id }) =>
      id !== "fr-enforcement-2018-03708" &&
      id !== "explanatory-context-2018-03708");
    const context = legacy.steps.find(({ id }) =>
      id === "fr-context-2018-03708")!;
    context.sourceRoute = "future_official_context_routes";
    context.status = "blocked";
    context.note = "Historical route was not implemented.";
    legacy.nextStepId = null;
    const activated = activateHistoricalPolicyEvidencePlan(legacy);
    expect(activated.steps.find(({ id }) => id === "fr-core-2018-03708"))
      .toMatchObject({ status: "searched", attempts: 1 });
    expect(activated.steps.find(({ id }) => id === "fr-coverage-2018-03708"))
      .toMatchObject({ status: "searched", attempts: 1 });
    expect(activated.steps.find(({ id }) =>
      id === "explanatory-context-2018-03708")).toMatchObject({
        sourceRoute: "complementary_policy_explanations",
        status: "not_started",
        attempts: 0,
      });
    expect(activated.steps.find(({ id }) =>
      id === "fr-context-2018-03708")).toMatchObject({
      sourceRoute: "federal_register_ecfr_history",
      status: "not_started",
      attempts: 0,
    });
    expect(activated.steps.find(({ id }) =>
      id === "fr-enforcement-2018-03708")).toMatchObject({
      sourceRoute: "confirmed_federal_register_record",
      status: "not_started",
      requirementKinds: ["enforcement", "penalty"],
    });
    expect(activated.nextStepId).toBe("explanatory-context-2018-03708");
  });

  it("adds a bounded Regulations.gov docket step only when that provider is enabled", () => {
    const withoutCredential = plan();
    expect(withoutCredential.steps.some(({ sourceRoute }) =>
      sourceRoute === "regulations_gov_docket")).toBe(false);
    const enabled = createFederalRegisterPolicyEvidencePlan({
      id: "policy-plan-order-841-regulations",
      identityFingerprint: fingerprintSixScreenValue("order-841-regulations"),
      documentNumber: "2018-03708",
      createdAt,
      regulationsGovEnabled: true,
    });
    const step = enabled.steps.find(({ sourceRoute }) =>
      sourceRoute === "regulations_gov_docket")!;
    expect(step).toMatchObject({
      priority: 5,
      requirementKinds: [
        "temporal_stage", "version", "implementation", "enforcement",
      ],
      status: "not_started",
    });
    expect(enabled.steps.find(({ sourceRoute }) =>
      sourceRoute === "federal_register_ecfr_history")?.priority).toBe(6);
    expect(policyEvidenceExecutionForStep(enabled, step.id)).toEqual({
      sourceRoute: "regulations_gov_docket",
      focus: "administrative_context",
    });
    const migrated = activateHistoricalPolicyEvidencePlan(plan(), {
      regulationsGovEnabled: true,
    });
    expect(migrated.steps.filter(({ sourceRoute }) =>
      sourceRoute === "regulations_gov_docket")).toHaveLength(1);
  });

  it("continues untouched independent routes before retrying a waiting source", () => {
    const waiting = recordPolicyEvidencePlanAttempt(plan(), {
      stepId: "explanatory-context-2018-03708",
      attemptedAt: "2026-09-12T10:00:01.000Z",
      outcome: "waiting_source",
      failureCode: "source_unavailable",
      note: "The source timed out.",
    });
    expect(waiting.nextStepId).toBe("fr-core-2018-03708");
    let progressed = waiting;
    for (const [index, stepId] of [
      "fr-core-2018-03708",
      "fr-coverage-2018-03708",
      "fr-enforcement-2018-03708",
      "fr-context-2018-03708",
    ].entries()) {
      progressed = recordPolicyEvidencePlanAttempt(progressed, {
        stepId,
        attemptedAt: `2026-09-12T10:00:0${index + 2}.000Z`,
        outcome: "searched",
        failureCode: null,
        note: "Independent route searched.",
      });
    }
    expect(progressed.nextStepId).toBe("explanatory-context-2018-03708");
    const exhausted = recordPolicyEvidencePlanAttempt(progressed, {
      stepId: "explanatory-context-2018-03708",
      attemptedAt: "2026-09-12T10:00:06.000Z",
      outcome: "waiting_source",
      failureCode: "source_unavailable",
      note: "The source timed out again.",
    });
    expect(exhausted.nextStepId).toBeNull();
    expect(exhausted.steps.find(({ id }) =>
      id === "explanatory-context-2018-03708")).toMatchObject({
      status: "blocked",
      attempts: 2,
      note: expect.stringContaining("single bounded retry was exhausted"),
    });
  });
});
