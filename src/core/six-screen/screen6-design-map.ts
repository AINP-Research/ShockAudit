import type { Screen6CurrentPlan } from "./screen6-current-plan";

export type Screen6DesignMapState = "known" | "partial" | "attention";

export type Screen6DesignMapRow = {
  label: string;
  value: string;
  state: Screen6DesignMapState;
};

export type Screen6DesignMapPanel = {
  id:
    | "institutional"
    | "exposure"
    | "counterfactual"
    | "measurement"
    | "events"
    | "mechanism";
  title: string;
  relation: string;
  state: Screen6DesignMapState;
  statusLabel: string;
  rows: Screen6DesignMapRow[];
};

export type Screen6DesignMapProjection = {
  summary: Array<{ label: string; value: string }>;
  comparison: {
    method: string;
    treatment: string;
    comparisonGroup: string;
    timing: string;
    outcomeTarget: string;
    state: Screen6DesignMapState;
    note: string;
  };
  panels: Screen6DesignMapPanel[];
  attention: string[];
  boundary: {
    plannedTarget: string;
    requiredAssumptions: string[];
    unsupportedClaims: string[];
    nextAction: string;
  };
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.flatMap((value) => value?.trim()
    ? [value.trim()] : []))];
}

function compact(value: string | null | undefined, maximum = 190) {
  const normalized = (value ?? "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  const shortened = normalized.slice(0, maximum - 1).replace(/\s+\S*$/u, "");
  return `${shortened || normalized.slice(0, maximum - 1)}…`;
}

function cleanPolicyText(value: string | null | undefined) {
  return compact((value ?? "")
    .replace(/^\s*\[\s*/u, "")
    .replace(/^\s*\([a-z]\)\s+(?=[\p{L}"'])/iu, "")
    .replace(/^\s*(?:section|sec\.)\s+[\w.-]+\s*[:—-]\s*/iu, ""));
}

function friendlyPolicyEpisode(value: string | null) {
  if (!value?.trim()) return "Policy stage not yet confirmed";
  const normalized = value.trim().toLocaleLowerCase();
  if (/^(?:enacted|adopted|signed(?: into law)?)$/u.test(normalized)) {
    return "Law adopted";
  }
  if (/^(?:effective|in effect)$/u.test(normalized)) return "Policy in effect";
  if (/^(?:announced|announcement)$/u.test(normalized)) {
    return "Policy announced";
  }
  if (/^(?:proposed|proposal)$/u.test(normalized)) return "Policy proposed";
  return cleanPolicyText(value);
}

function timingText(plan: Screen6CurrentPlan) {
  const timing = plan.upstream.treatmentTiming;
  if (!timing) return "Treatment timing has not been selected";
  if (timing.mode === "year") {
    return timing.year
      ? `${timing.year}${timing.precision === "year" ? "" :
        ` (${timing.precision} precision)`}`
      : "A treatment year is expected but not recorded";
  }
  if (timing.mode === "varies_by_group") {
    return "Treatment may begin in different years for different groups";
  }
  return "Treatment timing has not been selected";
}

function panelState(rows: Screen6DesignMapRow[]): Screen6DesignMapState {
  if (rows.some(({ state }) => state === "attention")) return "attention";
  if (rows.some(({ state }) => state === "partial")) return "partial";
  return "known";
}

function panel(input: Omit<Screen6DesignMapPanel, "state" | "statusLabel">) {
  const state = panelState(input.rows);
  return {
    ...input,
    state,
    statusLabel: state === "known" ? "Available"
      : state === "partial" ? "Review needed" : "Information needed",
  } satisfies Screen6DesignMapPanel;
}

function comparisonAssumption(method: string | null) {
  if (!method) return "Select a comparison before its identifying assumption can be assessed.";
  if (/difference|\bdid\b/iu.test(method)) {
    return "Without the policy, treated and comparison groups need sufficiently comparable outcome trends.";
  }
  if (/discontin|\brd\b|cutoff|threshold/iu.test(method)) {
    return "Units close to the assignment cutoff need to be comparable apart from treatment status.";
  }
  if (/synthetic/iu.test(method)) {
    return "The weighted comparison needs to reproduce the treated unit's pre-policy outcome path.";
  }
  return "The comparison group needs to represent the untreated outcome path for the treated group.";
}

function outcomeTarget(plan: Screen6CurrentPlan) {
  const outcome = plan.study.measure
    ? `${plan.study.outcome ?? "the outcome"} (${plan.study.measure})`
    : plan.study.outcome ?? "the study outcome";
  const method = plan.study.selectedComparison ?? "";
  if (/difference|\bdid\b/iu.test(method)) return `Relative change in ${outcome}`;
  if (/discontin|\brd\b|cutoff|threshold/iu.test(method)) {
    return `Local policy contrast in ${outcome}`;
  }
  return `Policy contrast in ${outcome}`;
}

/** Deterministic, reader-facing projection of the canonical Screen 6 plan.
 * It changes presentation only and never turns a dependency into a causal
 * finding or an event lead into an established confounder. */
export function createScreen6DesignMapProjection(
  plan: Screen6CurrentPlan,
): Screen6DesignMapProjection {
  const evidence = plan.upstream.policyEvidence;
  const acceptedClaims = evidence.claims.filter((claim) =>
    claim.decision !== "rejected");
  const policyChange = acceptedClaims.find((claim) =>
    ["operative_change", "substantive_obligation"].includes(claim.kind));
  const coverageClaims = acceptedClaims.filter((claim) => [
    "coverage_condition", "territorial_nexus", "threshold_condition",
    "exemption_rule",
  ].includes(claim.kind));
  const coverageClaim = coverageClaims.find((claim) =>
    claim.decision === "accepted") ?? coverageClaims[0];
  const claimText = (claim: typeof acceptedClaims[number] | undefined) =>
    cleanPolicyText(claim?.effectiveStatement ?? claim?.statement);
  const selectedComparison = plan.study.selectedComparison;
  const timing = timingText(plan);
  const events = plan.upstream.otherEvents;
  const mechanisms = plan.upstream.mechanisms;
  const focal = mechanisms.finalizedFocal?.originalText ?? null;
  const alternatives = mechanisms.proposals.map(({ concept }) => concept);
  const comparisonState: Screen6DesignMapState = selectedComparison
    ? "known" : "attention";
  const evidenceState: Screen6DesignMapState = !evidence.claims.length
    ? "attention"
    : evidence.conflictIds.length || evidence.unresolvedRequirementIds.length
      ? "partial" : "known";
  const proposedTreatment = plan.study.proposedTreatment?.trim() ||
    plan.study.proposedGroups;
  const proposedComparison = plan.study.proposedComparison?.trim() ||
    "The proposed comparison group has not been stated separately";
  const dataPreviouslyReported =
    plan.upstream.dataFeasibility.origin === "previous_researcher_report";

  const namedEvents = events?.retainedNames ?? events?.occurrences ?? [];
  const eventRows: Screen6DesignMapRow[] = namedEvents.length
    ? [
        ...namedEvents.map((event, index) => ({
          label: `Potential event ${index + 1}`,
          value: compact(event.title, 150),
          state: "partial" as const,
        })),
        ...(events?.contextFit && events.contextFit !== "current" ? [{
          label: "Why it needs review",
          value: events.contextFit === "earlier_study"
            ? "These named leads came from an earlier study version; reassess their timing and relevance for the current design."
            : events.contextFit === "same_study_earlier_scan"
              ? "These named leads came from an earlier saved scan. The latest scan retained no names; their earlier assessment remains available for review."
            : "These named leads came from an earlier Screen 4 design context; reassess them against the current comparison.",
          state: "partial" as const,
        }] : events?.status !== "completed" ? [{
          label: "Why it needs review",
          value: "The Screen 4 search is incomplete, so treat these as leads rather than established competing explanations.",
          state: "partial" as const,
        }] : []),
      ]
    : [{
        label: "Potential events",
        value: events?.status === "completed"
          ? "Screen 4 retained no named event for this study window."
          : "Return to Screen 4 and retain any named event that could overlap the comparison.",
        state: "attention",
      }];

  const panels: Screen6DesignMapPanel[] = [
    panel({
      id: "institutional",
      title: "Institutional Foundation",
      relation: "Defines the policy change and who could be covered.",
      rows: [
        { label: "Legal status", value: friendlyPolicyEpisode(
          plan.study.episode), state: plan.study.episode ? "known" : "attention" },
        { label: "Policy change", value: claimText(policyChange) ||
          "The operative policy change still needs to be confirmed from the reviewed materials.",
          state: policyChange ? evidenceState : "attention" },
        { label: "Coverage rule", value: claimText(coverageClaim) ||
          "Who qualifies for the policy remains unresolved.",
          state: coverageClaim ? evidenceState : "attention" },
        ...(evidence.conflictIds.length ? [{
          label: "Open policy question",
          value: "Conflicting policy evidence needs review before exposure is coded.",
          state: "attention" as const,
        }] : []),
      ],
    }),
    panel({
      id: "exposure",
      title: "Exposure & Timing",
      relation: "Translates policy coverage into treated units and treatment timing.",
      rows: [
        { label: "Treated group", value: proposedTreatment,
          state: plan.study.proposedTreatment ? "partial" : "attention" },
        { label: "Comparison group", value: proposedComparison,
          state: plan.study.proposedComparison ? "partial" : "attention" },
        { label: "Treatment timing", value: timing,
          state: plan.upstream.treatmentTiming ? "known" : "attention" },
        { label: "Unit-level exposure", value: coverageClaims.length
          ? plan.upstream.treatmentTiming?.mode === "varies_by_group"
            ? "For each unit, treatment starts in the first year it meets the policy coverage rules."
            : "A unit is treated only when it meets the policy coverage rules in the relevant period."
          : "A unit-by-period exposure rule still needs to be built from the policy coverage conditions.",
          state: coverageClaims.length ? "partial" : "attention" },
      ],
    }),
    panel({
      id: "counterfactual",
      title: "Counterfactual & Interference",
      relation: "States what must be true about the comparison group.",
      rows: [
        { label: "Research design", value: selectedComparison ??
          "No comparison design has been selected", state: comparisonState },
        { label: "Key comparison assumption",
          value: comparisonAssumption(selectedComparison),
          state: selectedComparison ? "partial" : "attention" },
        { label: "Spillover check",
          value: "Check whether treated units, customers, suppliers, or shared markets could also affect the comparison group.",
          state: "partial" },
      ],
    }),
    panel({
      id: "measurement",
      title: "Study Measurement",
      relation: "Defines the outcome and study window being compared.",
      rows: [
        { label: "Outcome", value: plan.study.measure
          ? `${plan.study.outcome ?? "Outcome not specified"} · ${plan.study.measure}`
          : plan.study.outcome ?? "Outcome is not specified",
          state: plan.study.outcome && plan.study.measure ? "known" : "partial" },
        { label: "Unit of analysis", value: plan.study.unit ??
          "Analysis unit is not specified", state: plan.study.unit
            ? "known" : "attention" },
        { label: "Study window", value:
          `${plan.study.requestedPeriod.start ?? "?"}–${
            plan.study.requestedPeriod.end ?? "?"}`,
          state: plan.study.requestedPeriod.start &&
            plan.study.requestedPeriod.end ? "known" : "attention" },
        { label: "Data check", value: dataPreviouslyReported
          ? "Confirm that the reported outcome frequency, assignment structure, and pre/post coverage still match this design."
          : "Confirm outcome frequency, sample composition, treatment assignment, and pre/post data coverage.",
          state: "partial" },
      ],
    }),
    panel({
      id: "events",
      title: "Potential Concurrent Events",
      relation: "Identifies other changes that may overlap the comparison.",
      rows: eventRows,
    }),
    panel({
      id: "mechanism",
      title: "Mechanism & Claim",
      relation: "Limits which theoretical claims the design can support.",
      rows: [
        { label: "Main pathway", value: focal ??
          "A main mechanism has not been finalized", state: focal
            ? "known" : "attention" },
        ...alternatives.slice(0, 2).map((concept, index) => ({
          label: `Alternative pathway ${index + 1}`,
          value: compact(concept, 150),
          state: "partial" as const,
        })),
        ...(alternatives.length > 2 ? [{
          label: "Other alternatives",
          value: compact(alternatives.slice(2).join("; "), 170),
          state: "partial" as const,
        }] : []),
        { label: "Claim limit", value: focal || alternatives.length
          ? "The comparison may be consistent with several pathways; it does not by itself identify one unique mechanism."
          : "Mechanism-specific claims cannot yet be assessed.",
          state: "partial" },
      ],
    }),
  ];

  const eventNames = events?.occurrences.slice(0, 2).map(({ title }) =>
    compact(title, 80)) ?? [];
  const attention = unique([
    !coverageClaims.length
      ? "Define which units satisfy the policy coverage conditions in each study period."
      : "Translate the policy coverage conditions into a unit-by-period treatment indicator.",
    !plan.upstream.treatmentTiming
      ? "Select the policy date or group-specific rule that starts treatment."
      : plan.upstream.treatmentTiming.mode === "varies_by_group"
        ? "Record each group's first treatment year and verify that later analyses preserve staggered timing."
        : null,
    selectedComparison ? comparisonAssumption(selectedComparison)
      : "Choose and justify the comparison that will represent the untreated outcome path.",
    eventNames.length
      ? `Assess whether ${eventNames.join(" and ")} overlaps treatment timing or affects the groups differently.`
      : "Complete Screen 4 with named events that could overlap the study window.",
    dataPreviouslyReported
      ? "Verify that the reported data structure still supports this comparison."
      : "Confirm outcome frequency, sample composition, assignment structure, and pre/post coverage.",
    focal && alternatives.length
      ? "Compare observable predictions for the main and alternative pathways."
      : "Complete the mechanism comparison before making a mechanism-specific claim.",
    evidence.conflictIds.length
      ? "Resolve conflicting policy evidence before finalizing exposure coding."
      : null,
  ]).slice(0, 6);

  return {
    summary: [
      { label: "Policy", value: plan.study.policy },
      { label: "Research Design", value: selectedComparison ?? "Not selected" },
      { label: "Outcome", value: plan.study.measure
        ? `${plan.study.outcome ?? "Outcome not specified"} · ${plan.study.measure}`
        : plan.study.outcome ?? "Not specified" },
      { label: "Period", value:
        `${plan.study.requestedPeriod.start ?? "?"}–${
          plan.study.requestedPeriod.end ?? "?"}` },
    ],
    comparison: {
      method: selectedComparison ?? "Comparison design not selected",
      treatment: proposedTreatment,
      comparisonGroup: proposedComparison,
      timing,
      outcomeTarget: outcomeTarget(plan),
      state: comparisonState,
      note: selectedComparison
        ? "This is the proposed design. Its assumptions and required evidence still need to be checked before estimation."
        : "The groups remain visible, but a causal comparison cannot be stated until a design is selected.",
    },
    panels,
    attention,
    boundary: {
      plannedTarget: plan.boundary.plannedTarget,
      requiredAssumptions: [...plan.boundary.requiredAssumptions],
      unsupportedClaims: [...plan.boundary.unsupportedClaims],
      nextAction: plan.boundary.nextAction,
    },
  };
}
