import { describe, expect, it, vi } from "vitest";

import type { SixScreenWorkflowPrivateSnapshot } from
  "../../src/worker/six-screen-workflow-runtime";
import type { Screen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { createScreen6DesignMapProjection } from
  "../../src/core/six-screen/screen6-design-map";
import { screen5MechanismPlanFromWire,
  SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT,
  SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT } from
  "../../src/worker/screen5-mechanism-contract";
import { validateScreen3EntryDraft } from
  "../../src/core/six-screen/screen3-entry-validation";
import { SixScreenWorkflowResponseError } from
  "../../src/ui/six-screen/workflow-response";
import {
  cleanPolicyPresentationText,
  openScreenWithCanonicalRecovery,
  screen5CheckpointIsActive,
} from "../../src/ui/six-screen/SixScreenApp";
import { isCompletePolicyPresentationSentence } from
  "../../src/core/six-screen/policy-presentation";

function designMapPlan(overrides: {
  selectedComparison?: string | null;
  treatmentTiming?: { mode: "year"; year: string; precision: string } |
    { mode: "varies_by_group" } | null;
  otherEvents?: null | { status: "completed" | "completed_partial";
    occurrences: Array<{ title: string }>; omittedCount: number;
    contextFit?: "current" | "same_study_earlier_design" | "earlier_study" };
  focal?: string | null;
  alternatives?: string[];
  outcome?: string;
  episode?: string;
} = {}) {
  const selectedComparison = overrides.selectedComparison === undefined
    ? "Difference-in-differences" : overrides.selectedComparison;
  const timing = overrides.treatmentTiming === undefined
    ? { mode: "year" as const, year: "2021", precision: "year" }
    : overrides.treatmentTiming;
  const events = overrides.otherEvents === undefined ? {
    status: "completed" as const,
    occurrences: [{ title: "Supply disruption" }], omittedCount: 0,
  } : overrides.otherEvents;
  const focal = overrides.focal === undefined
    ? "Managers change hiring plans" : overrides.focal;
  const alternatives = overrides.alternatives ?? ["Operational adaptation"];
  return {
    study: {
      policy: "Policy A", episode: overrides.episode ?? "Enacted",
      selectedComparison, proposedGroups: "Covered firms and comparison firms",
      proposedTreatment: "Covered firms",
      proposedComparison: "Comparison firms",
      outcome: overrides.outcome ?? "Employment", measure: "Employee count",
      unit: "Firm-year", requestedPeriod: { start: "2018", end: "2025" },
    },
    upstream: {
      policyEvidence: {
        claims: [{ kind: "operative_change", decision: "accepted",
          statement: "[ Requires covered firms to provide a new consumer right." },
        { kind: "coverage_condition", decision: "accepted",
          statement: "(c) Business means a qualifying for-profit entity." }],
        conflictIds: [], unresolvedRequirementIds: [],
      },
      treatmentTiming: timing,
      otherEvents: events ? { ...events, totalCount: events.occurrences.length }
        : null,
      mechanisms: {
        finalizedFocal: focal ? { originalText: focal } : null,
        proposals: alternatives.map((concept, index) => ({
          id: `m${index + 1}`, concept,
        })),
      },
      dataFeasibility: {
        origin: "not_supplied",
        qualification: "Observed data coverage has not been supplied.",
      },
      designConcerns: [],
    },
    dimensions: [{ id: "interference", state: "Cross-group links unassessed" }, {
      id: "mechanism_attribution", state: "Attribution unresolved",
    }],
    gaps: selectedComparison ? [] : ["A causal comparison has not been selected."],
    boundary: {
      plannedTarget: selectedComparison
        ? "Estimate the selected comparison conditionally."
        : "A causal estimand cannot yet be stated.",
      requiredAssumptions: ["Exposure must be established."],
      unsupportedClaims: ["The mechanism is not uniquely identified."],
      nextAction: "Verify eligibility before estimation.",
    },
  } as unknown as Screen6CurrentPlan;
}

describe("six-screen presentation polish", () => {
  it("removes source-extraction prefixes without changing substantive text", () => {
    expect(cleanPolicyPresentationText("[ Approved by Governor on May 4"))
      .toBe("Approved by Governor on May 4");
    expect(cleanPolicyPresentationText(
      "(c) Business means (1) a sole proprietorship",
    )).toBe("Business means (1) a sole proprietorship");
    expect(cleanPolicyPresentationText(
      "Regulation S-K,\\1\\ revise Item 601 of Regulation S-K,\\2\\ " +
      "and amend Form 20-F. ---------------------------------------- " +
      "\\1\\ 17 CFR 229.10 et seq.",
    )).toBe(
      "Regulation S-K, revise Item 601 of Regulation S-K, and amend Form 20-F.",
    );
    expect(cleanPolicyPresentationText(
      "&amp;lt;uslm:section&amp;gt;&amp;lt;uslm:text&amp;gt;" +
      "Issuers shall disclose the information." +
      "&amp;lt;/uslm:text&amp;gt;&amp;lt;/uslm:section&amp;gt;",
    )).toBe("Issuers shall disclose the information.");
    expect(cleanPolicyPresentationText(
      "Emerging growth company.—The term emerging growth company means an issuer.",
    )).toBe("The term emerging growth company means an issuer.");
    expect(cleanPolicyPresentationText(
      "....As used in this title, the following definitions shall apply:.",
    )).toBe("As used in this title, the following definitions shall apply.");
  });

  it("rejects broken legal fragments before they reach the Screen 2 briefing", () => {
    expect(isCompletePolicyPresentationSentence(
      "An issuer (as defined under section 2(a) of the Sarbanes-Oxley Act (15 U.S.C.",
    )).toBe(false);
    expect(isCompletePolicyPresentationSentence("Exemption.")).toBe(false);
    expect(isCompletePolicyPresentationSentence(
      "An issuer shall provide audited financial statements.",
    )).toBe(true);
  });

  it("asks ChatGPT for a full citation for the focal and every alternative", () => {
    const schema = SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT.json_schema.schema;
    const candidateSchema = schema.properties.candidates.items as {
      required: readonly string[];
    };
    expect(schema.required).toContain("focal_citations");
    expect(candidateSchema.required).toContain("citations");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT)
      .toContain("suggest one real scholarly work for M0 and one for each alternative");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).not.toContain("OpenAlex");

    const plan = screen5MechanismPlanFromWire({
      context: {
        policy: { officialTitle: "Policy A" },
        study: {
          population: "Firms", analysisUnit: "Firm-year",
          period: { start: "2018", end: "2025" },
          industry: ["Retail"], geography: ["California"],
        },
      } as never,
      problem: {
        theoreticalChange: {
          originalText: "higher compliance pressure", direction: "increase",
          fitExplanation: "Researcher-supplied construct.", fieldRefs: [],
        },
        outcome: { concept: "Employment", measure: "Employee count" },
      } as never,
      wire: {
        focal_citations: [{
          authors: ["Jane Smith"], year: 2020,
          title: "Compliance and organizational adjustment",
          venue: "Journal of Organization Studies", volume: "12",
          issue: "2", pages: "10-30", doi: "10.1000/example",
          url: "https://doi.org/10.1000/example",
          full_citation: "Smith, J. (2020). Compliance and organizational adjustment. Journal of Organization Studies, 12(2), 10-30.",
          supports: "Compliance pressure can change organizational adjustment behavior.",
        }],
        candidates: [{
          candidate_id: "alternative-1", concept: "Operational adaptation",
          chain: ["Managers", "adapt operations", "employment changes"],
          difference: "Focuses on operations rather than the focal process.",
          condition: "Adjustment capacity is available.",
          direction: {
            mode: "single_hypothesis", target_outcome: "Employment",
            target_measure: "Employee count", scenarios: [{
              sign: "positive", condition: "Demand is stable.",
              rationale: "Adaptation supports expansion.",
              intermediate_movement: "Operational capacity increases.",
              horizon: null,
            }], missing_assumption: null,
          },
          evidence_need: "Whether adaptation changes employment.",
          terms: ["operational adaptation", "employment"],
          citations: [{
            authors: ["Alex Lee", "Morgan Chen"], year: 2019,
            title: "Operational adaptation and employment",
            venue: "Administrative Science Quarterly", volume: "64",
            issue: "1", pages: "1-22", doi: null, url: null,
            full_citation: "Lee, A., & Chen, M. (2019). Operational adaptation and employment. Administrative Science Quarterly, 64(1), 1-22.",
            supports: "Operational adaptation may affect workforce demand.",
          }],
        }],
        open_xy_terms: ["compliance pressure employment"],
        challenge_terms: ["boundary condition employment"],
        qualification: "Citations are suggestions for researcher verification.",
      },
    });

    expect(plan.focalSuggestedCitations?.[0]?.citationLabel)
      .toBe("Smith 2020");
    expect(plan.candidates[0]?.suggestedCitations?.[0]?.fullCitation)
      .toContain("Administrative Science Quarterly");
    expect(plan.candidates[0]?.suggestedCitations?.[0]?.verificationStatus)
      .toBe("model_suggested_unverified");
    expect(plan.breadthQualification)
      .toBe("Citations are suggestions for researcher verification.");
  });

  it("requires one of the two visible treatment-timing choices", () => {
    const validation = validateScreen3EntryDraft({
      study: {
        population: "Firms",
        analysisUnit: "Firm-year",
        geography: ["California"],
        industry: [],
        period: { start: "2018", end: "2025" },
        outcome: "Employment",
        intendedConstruct: null,
        initialExplanation: "The policy changes labor demand.",
        proposedTreatment: "Covered firms",
        proposedComparison: "Uncovered firms",
        resultsPreviouslyInspected: "not_disclosed",
      },
      timing: { mode: "undecided", year: null },
    });

    expect(validation.issues.some(({ code }) => code === "proposed_timing"))
      .toBe(true);
  });

  it("recovers a committed Screen 6 navigation without resending it", async () => {
    const saved = {
      state: { activeScreen: 6 },
    } as SixScreenWorkflowPrivateSnapshot;
    const open = vi.fn(async () => {
      throw new SixScreenWorkflowResponseError(
        "response_contract_invalid",
        "The navigation response could not be decoded.",
        {} as never,
      );
    });
    const recover = vi.fn(async () => saved);

    await expect(openScreenWithCanonicalRecovery({
      targetScreen: 6,
      open,
      recover,
    })).resolves.toEqual({ snapshot: saved, recovered: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("holds Screen 6 navigation while the visible Screen 5 result is still saving", () => {
    expect(screen5CheckpointIsActive(new Set([
      "compare-study-first-mechanisms",
    ]))).toBe(true);
    expect(screen5CheckpointIsActive(new Set([
      "advance-direct-screen5",
    ]))).toBe(true);
    expect(screen5CheckpointIsActive(new Set([
      "continue-screen6",
    ]))).toBe(false);
  });

  it("projects a complete Screen 6 design into the six dependency panels", () => {
    const map = createScreen6DesignMapProjection(designMapPlan());

    expect(map.panels.map(({ id }) => id)).toEqual([
      "institutional", "exposure", "counterfactual", "measurement",
      "events", "mechanism",
    ]);
    expect(map.comparison.method).toBe("Difference-in-differences");
    expect(map.panels.find(({ id }) => id === "events")?.rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ value: "Supply disruption" }),
      ]));
    expect(map.panels.find(({ id }) => id === "institutional")?.rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ value: "Law adopted" }),
        expect.objectContaining({
          value: "Business means a qualifying for-profit entity.",
        }),
      ]));
    const visibleText = JSON.stringify(map);
    expect(visibleText).not.toMatch(/source-linked proposition|saved coverage|legal applicability|cross-group links unassessed|event review is planned|no occurrence is currently available/iu);
  });

  it("keeps missing comparison, events, timing and mechanisms explicit", () => {
    const map = createScreen6DesignMapProjection(designMapPlan({
      selectedComparison: null,
      treatmentTiming: null,
      otherEvents: null,
      focal: null,
      alternatives: [],
    }));

    expect(map.comparison.state).toBe("attention");
    expect(map.comparison.method).toBe("Comparison design not selected");
    expect(map.comparison.timing).toContain("not been selected");
    expect(map.panels.find(({ id }) => id === "events")?.state)
      .toBe("attention");
    expect(map.panels.find(({ id }) => id === "mechanism")?.rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ value: "A main mechanism has not been finalized" }),
      ]));
  });

  it("carries staggered shock timing and multiple events without causal labels", () => {
    const longEvent = "A long, source-documented market event title that must remain readable without being assigned a causal role";
    const map = createScreen6DesignMapProjection(designMapPlan({
      treatmentTiming: { mode: "varies_by_group" },
      otherEvents: {
        status: "completed_partial",
        occurrences: [{ title: longEvent }, { title: "Second event" }],
        omittedCount: 1,
      },
    }));

    expect(map.comparison.timing).toContain("different years for different groups");
    const eventPanel = map.panels.find(({ id }) => id === "events");
    expect(eventPanel?.state).toBe("partial");
    expect(eventPanel?.rows.some(({ value }) => value === longEvent)).toBe(true);
    expect(JSON.stringify(eventPanel)).not.toMatch(/confounder/iu);
    expect(map.attention.join(" ")).toContain(longEvent.slice(0, 40));
  });

  it("shows named earlier-context event leads instead of an empty review status", () => {
    const map = createScreen6DesignMapProjection(designMapPlan({
      otherEvents: {
        status: "completed_partial",
        contextFit: "same_study_earlier_design",
        occurrences: [{ title: "State cybersecurity rule change" }],
        omittedCount: 0,
      },
    }));

    const rows = map.panels.find(({ id }) => id === "events")?.rows ?? [];
    expect(rows.some(({ value }) => value ===
      "State cybersecurity rule change")).toBe(true);
    expect(rows.some(({ value }) => value.includes(
      "earlier Screen 4 design context"))).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/review is planned|no occurrence/iu);
  });
});
