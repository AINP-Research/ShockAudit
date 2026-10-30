import { describe, expect, it } from "vitest";
import { openScreen3 } from "../../src/core/six-screen/workflow";
import {
  SCREEN3_CONTEXTUALIZER_VERSION,
  SCREEN3_DESIGN_DIMENSIONS,
  SCREEN3_CONTEXTUALIZER_INPUT_CEILING,
  estimateScreen3Contextualization,
  screen3ContextualPacket,
  validateScreen3ContextualCritique,
} from "../../src/worker/screen3-contextualizer";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

function current() {
  const fixture = createBrowserEventCardFixture();
  const opened = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: {
      population: "U.S. public firms", analysisUnit: "firm-year",
      geography: ["United States", "California"], industry: ["Retail"],
      period: { start: "2010", end: "2025" },
      outcome: "Firm performance", outcomeMeasure: "ROA",
      intendedConstruct: "Historical secondary construct",
      policySideConcept: "Transparency", initialExplanation: "Customer response",
      proposedTreatment: "California firms",
      proposedComparison: "Non-California firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: { mode: "year", year: 2023,
      milestoneReference: null },
    openedAt: "2026-09-24T12:00:00.000Z",
  });
  return { state: opened.state, advice: opened.state.studyDesignAdvices!.at(-1)! };
}

function structuredAssessment() {
  return {
    schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
    concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension, index) => ({
      issue_id: dimension.id,
      specific_heading: dimension.heading,
      status_label: index === 0 ? "Treatment clock needs review" :
        "Requires design evidence",
      relevant_fact_or_proposal:
        `The saved proposal supplies study-specific information for ${dimension.heading.toLowerCase()}.`,
      why_it_matters:
        "This dimension can change the interpretation of the proposed comparison and outcome.",
      unresolved_question: "What does the unit-level evidence show?",
      next_check: "Inspect the corresponding dated unit and period records.",
      check_limit: "This check cannot by itself establish the counterfactual outcome.",
      priority: index < 2 ? "high" as const : "medium" as const,
      priority_reason: "The proposed treatment contrast depends on this condition.",
      documentary_claim_ids: [],
      researcher_input_fields: ["proposedTreatment", "proposedComparison"],
    })),
    synthesis_limit: "This is a prospective assessment, not an observed effect.",
  };
}

describe("bounded Screen 3 contextual critique", () => {
  it("carries the current policy episode and proposed X into a bounded packet", () => {
    const { state, advice } = current();
    const packet = screen3ContextualPacket(state, advice);
    expect(packet.study.policySideConcept).toBe("Transparency");
    expect(packet.current_concerns.length).toBeGreaterThan(0);
    expect(packet.policy.title).toBe(state.confirmedShock?.officialTitle);
    expect(estimateScreen3Contextualization(state, advice))
      .toBeLessThan(SCREEN3_CONTEXTUALIZER_INPUT_CEILING * 0.75);
    expect(packet.policy.claims.some(({ kind }) =>
      kind === "coverage_condition")).toBe(true);
    expect(packet.policy.dated.some(({ stage }) =>
      stage === "legal_effect")).toBe(true);
    expect(packet.policy.claims.find(({ kind }) =>
      kind === "coverage_condition")?.statement)
      .toContain("operators serving the covered market");
  });

  it("requires all six dimensions and canonicalizes harmless wire variation", () => {
    const { advice } = current();
    const candidate = structuredAssessment();
    expect(validateScreen3ContextualCritique(candidate, advice)).toEqual(candidate);
    const normalized = validateScreen3ContextualCritique({ ...candidate,
      concerns: candidate.concerns.map((item) => ({ ...item,
        why_it_matters: `${item.why_it_matters} ${"detail ".repeat(140)}`,
        researcher_input_fields: [
          ...item.researcher_input_fields,
          ...item.researcher_input_fields,
        ],
      })).reverse() }, advice);
    expect(normalized).toMatchObject({
      schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
    });
    expect(normalized.concerns.map((item) => "issue_id" in item
      ? item.issue_id : null)).toEqual(
        SCREEN3_DESIGN_DIMENSIONS.map(({ id }) => id),
      );
    expect("schema_version" in normalized && normalized.concerns[0])
      .toMatchObject({ researcher_input_fields: ["proposedTreatment",
        "proposedComparison"] });
    expect("schema_version" in normalized &&
      normalized.concerns[0]!.why_it_matters.length).toBe(750);
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      concerns: candidate.concerns.slice(0, 5) }, advice))
      .toThrow("invalid specific issue");
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      concerns: candidate.concerns.map((item, index) => index === 0
        ? { ...item, specific_heading: "Generic timing check" } : item) }, advice))
      .toThrow("invalid specific issue");
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      synthesis_limit: "ShockAudit found p = 0.01 for the effect" }, advice))
      .toThrow("unsupplied results");
  });

  it("binds new documentary references to the exact admitted claims", () => {
    const { state, advice } = current();
    const packet = screen3ContextualPacket(state, advice);
    const claimId = packet.policy.claims.find(({ kind }) =>
      kind === "coverage_condition")!.id;
    const base = structuredAssessment();
    const concerns = base.concerns.map((item, index) => index === 0 ? {
      ...item,
      relevant_fact_or_proposal:
        "The retained source describes covered market operators.",
      documentary_claim_ids: [claimId],
    } : item);
    const candidate = { ...base, concerns,
      synthesis_limit: "Eligibility is not observed from the policy record alone." };
    expect(validateScreen3ContextualCritique(candidate, advice, packet))
      .toEqual(candidate);
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      concerns: concerns.map((item, index) => index === 0 ? {
        ...item, documentary_claim_ids: ["another-episode-claim"],
      } : item) },
    advice, packet)).toThrow("$.concerns[0].documentary_claim_ids[0]");
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      concerns: concerns.map((item, index) => index === 0 ? {
        ...item, researcher_input_fields: ["secretKey"],
      } : item) },
    advice, packet)).toThrow("$.concerns[0].researcher_input_fields[0]");
    expect(() => validateScreen3ContextualCritique({ ...candidate,
      concerns: concerns.map((item, index) => index === 0 ? {
        ...item, documentary_claim_ids: undefined,
      } : item) },
    advice, packet)).toThrow("invalid specific issue");
  });

  it("keeps operative duties and baseline despite many exceptions and reports omissions", () => {
    const { state, advice } = current();
    const review = state.policyReview!;
    const base = review.claims.find(({ predicate }) =>
      predicate === "coverage_condition")!;
    review.claims.push({ ...base, claimId: "claim-exception-for-critique",
      predicate: "exemption_rule", statement:
        "A covered operator is exempt when it satisfies the documented small-operator condition, subject to the historical version in force.",
      qualification: "Eligibility must be checked for the relevant year." });
    review.claims.push({ ...base, claimId: "claim-operative-for-critique",
      predicate: "substantive_obligation", statement:
        "Covered operators must provide a specified information notice under the relevant historical version." });
    review.claims.push({ ...base, claimId: "claim-baseline-for-critique",
      predicate: "previous_baseline", statement:
        "The earlier recorded version did not include that specified notice duty." });
    for (let index = 0; index < 42; index += 1) {
      review.claims.push({ ...base, claimId: `claim-extra-${index}`,
        predicate: "exemption_rule",
        statement: `A distinct documented exemption condition ${index} applies in the historical period.` });
    }
    const packet = screen3ContextualPacket(state, advice);
    expect(packet.policy.exception_claim_ids)
      .toContain("claim-exception-for-critique");
    expect(packet.policy.claims.find(({ id }) =>
      id === "claim-exception-for-critique")?.statement)
      .toContain("historical version in force.");
    expect(packet.policy.claims.map(({ id }) => id))
      .toContain("claim-operative-for-critique");
    expect(packet.policy.claims.map(({ id }) => id))
      .toContain("claim-baseline-for-critique");
    expect(packet.policy.omitted.coverage_or_exception).toBeGreaterThan(0);
    expect(packet.policy.omitted.claims).toBeGreaterThan(0);
    expect(packet.policy.claims.length).toBeLessThanOrEqual(32);
    expect(packet.policy.dated.every(({ claim_ids }) =>
      claim_ids.every((id) => packet.policy.claims.some((claim) =>
        claim.id === id)))).toBe(true);
  });
});
