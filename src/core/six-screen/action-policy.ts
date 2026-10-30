/**
 * Exhaustive policy for every registered six-screen mutation.
 *
 * Keep transport/recovery decisions here instead of growing another UI-only
 * allowlist.  Adding a mutation requires a policy entry and therefore an
 * explicit statement about external work, recovery, and scientific effect.
 */
export const SIX_SCREEN_MUTATION_ACTIONS = [
  "update_study",
  "update_shock",
  "resolve_shock",
  "display_identity",
  "defer_identity",
  "add_source",
  "confirm_shock",
  "open_screen_2",
  "open_screen_3",
  "rebuild_screen3_guidance",
  "refine_study_design_advice",
  "personalize_screen3_advice",
  "renew_model_allowance",
  "decide_study_design_advice",
  "open_screen_4",
  "refresh_study_first_events",
  "analyze_study_first_events",
  "open_screen_5",
  "compare_study_first_mechanisms",
  "ensure_study_first_mechanism_job",
  "continue_study_first_mechanism_evidence",
  "authorize_study_first_mechanism_job",
  "advance_study_first_mechanism_job",
  "open_screen_6",
  "personalize_screen6_plan",
  "initialize_screen6_uncertainty_profile",
  "save_screen6_diagnostic_plan",
  "record_screen6_diagnostic_result",
  "review_screen6_diagnostic_result",
  "save_screen6_conditional_claim_boundary",
  "record_screen6_research_planning_disposition",
  "create_screen6_research_export",
  "research_policy",
  "continue_policy_research",
  "begin_policy_event_card_review",
  "review_policy_event_card_claim",
  "decide_policy_treatment_clock",
  "lock_policy_event_card",
  "build_causal_comparison",
  "decide_causal_comparison",
  "save_coevent_search_matrix",
  "save_mechanism_literature_plan",
  "continue_mechanism_literature_search",
  "inspect_scholarly_document",
  "extract_scholarly_claim",
  "review_scholarly_claim",
  "prepare_mechanism_synthesis_input",
  "save_mechanism_review",
  "continue_coevent_search",
  "review_coevent_occurrence",
  "review_coevent_relation",
  "review_coevent_duplicate_pair",
  "route_coevent_policy_stage_to_screen_2",
  "acquire_policy_lifecycle_stage_document",
  "review_policy_lifecycle_stage_document",
  "propose_policy_lifecycle_stage_revision",
  "review_policy_lifecycle_stage_revision",
] as const;

export type SixScreenMutationAction =
  (typeof SIX_SCREEN_MUTATION_ACTIONS)[number];

export type SixScreenActionPolicy = {
  externalWork: "none" | "model" | "source" | "mixed";
  scientificEffect:
    | "input"
    | "identity"
    | "navigation"
    | "guidance"
    | "research"
    | "researcher_decision"
    | "analysis"
    | "accounting"
    | "export";
  failureRecovery: "none" | "canonical_status" | "operation_status";
  allowsCompatibleRevisionRebase: boolean;
  destinationScreen: 1 | 2 | 3 | 4 | 5 | 6 | null;
};

const local = (
  scientificEffect: SixScreenActionPolicy["scientificEffect"],
  destinationScreen: SixScreenActionPolicy["destinationScreen"] = null,
): SixScreenActionPolicy => ({
  externalWork: "none",
  scientificEffect,
  failureRecovery: "none",
  allowsCompatibleRevisionRebase: false,
  destinationScreen,
});

const source = (
  scientificEffect: SixScreenActionPolicy["scientificEffect"] = "research",
  destinationScreen: SixScreenActionPolicy["destinationScreen"] = null,
): SixScreenActionPolicy => ({
  externalWork: "source",
  scientificEffect,
  failureRecovery: "canonical_status",
  allowsCompatibleRevisionRebase: false,
  destinationScreen,
});

const model = (
  destinationScreen: 3 | 4 | 5 | 6,
): SixScreenActionPolicy => ({
  externalWork: "model",
  scientificEffect: "analysis",
  failureRecovery: "canonical_status",
  allowsCompatibleRevisionRebase: false,
  destinationScreen,
});

export const SIX_SCREEN_ACTION_POLICIES = {
  update_study: local("input", 1),
  update_shock: local("input", 1),
  resolve_shock: source("identity", 1),
  display_identity: local("identity", 1),
  defer_identity: local("identity", 1),
  add_source: local("identity", 1),
  confirm_shock: local("researcher_decision", 1),
  open_screen_2: local("navigation", 2),
  open_screen_3: {
    externalWork: "none",
    scientificEffect: "guidance",
    failureRecovery: "operation_status",
    allowsCompatibleRevisionRebase: true,
    destinationScreen: 3,
  },
  rebuild_screen3_guidance: {
    externalWork: "none",
    scientificEffect: "guidance",
    failureRecovery: "operation_status",
    allowsCompatibleRevisionRebase: true,
    destinationScreen: 3,
  },
  refine_study_design_advice: local("guidance", 3),
  personalize_screen3_advice: model(3),
  renew_model_allowance: { ...local("accounting"), failureRecovery: "canonical_status" },
  decide_study_design_advice: local("researcher_decision", 3),
  // First entry and an interrupted planned investigation can execute the
  // standard bounded source scan; this is not navigation-only work.
  open_screen_4: source("research", 4),
  refresh_study_first_events: source("research", 4),
  analyze_study_first_events: model(4),
  open_screen_5: local("navigation", 5),
  // These steps save/bind input, prepare the direct job, and authorize its
  // next reservation.  Provider dispatch belongs only to advance_*.
  compare_study_first_mechanisms: {
    ...local("analysis", 5),
    failureRecovery: "canonical_status",
  },
  ensure_study_first_mechanism_job: {
    ...local("analysis", 5),
    failureRecovery: "canonical_status",
  },
  continue_study_first_mechanism_evidence: source("research", 5),
  authorize_study_first_mechanism_job: {
    ...local("accounting", 5),
    failureRecovery: "canonical_status",
  },
  // Depending on its saved checkpoint, one explicit advance can dispatch
  // OpenAI or perform the bounded scholarly retrieval between model stages.
  advance_study_first_mechanism_job: {
    externalWork: "mixed",
    scientificEffect: "analysis",
    failureRecovery: "canonical_status",
    allowsCompatibleRevisionRebase: false,
    destinationScreen: 5,
  },
  open_screen_6: local("navigation", 6),
  personalize_screen6_plan: model(6),
  initialize_screen6_uncertainty_profile: local("guidance", 6),
  save_screen6_diagnostic_plan: local("guidance", 6),
  record_screen6_diagnostic_result: local("input", 6),
  review_screen6_diagnostic_result: local("researcher_decision", 6),
  save_screen6_conditional_claim_boundary: local("guidance", 6),
  record_screen6_research_planning_disposition:
    local("researcher_decision", 6),
  create_screen6_research_export: local("export", 6),
  research_policy: {
    externalWork: "mixed",
    scientificEffect: "research",
    failureRecovery: "canonical_status",
    allowsCompatibleRevisionRebase: false,
    destinationScreen: 2,
  },
  continue_policy_research: {
    externalWork: "mixed",
    scientificEffect: "research",
    failureRecovery: "canonical_status",
    allowsCompatibleRevisionRebase: false,
    destinationScreen: 2,
  },
  begin_policy_event_card_review: local("guidance", 2),
  review_policy_event_card_claim: local("researcher_decision", 2),
  decide_policy_treatment_clock: local("researcher_decision", 2),
  lock_policy_event_card: local("researcher_decision", 2),
  build_causal_comparison: local("guidance", 3),
  decide_causal_comparison: local("researcher_decision", 3),
  save_coevent_search_matrix: local("guidance", 4),
  save_mechanism_literature_plan: local("guidance", 5),
  continue_mechanism_literature_search: source("research", 5),
  inspect_scholarly_document: source("research", 5),
  extract_scholarly_claim: local("guidance", 5),
  review_scholarly_claim: local("researcher_decision", 5),
  prepare_mechanism_synthesis_input: local("guidance", 5),
  save_mechanism_review: local("researcher_decision", 5),
  continue_coevent_search: source("research", 4),
  review_coevent_occurrence: local("researcher_decision", 4),
  review_coevent_relation: local("researcher_decision", 4),
  review_coevent_duplicate_pair: local("researcher_decision", 4),
  route_coevent_policy_stage_to_screen_2: local("researcher_decision", 2),
  acquire_policy_lifecycle_stage_document: source("research", 2),
  review_policy_lifecycle_stage_document:
    local("researcher_decision", 2),
  propose_policy_lifecycle_stage_revision: local("guidance", 2),
  review_policy_lifecycle_stage_revision:
    local("researcher_decision", 2),
} as const satisfies Record<SixScreenMutationAction, SixScreenActionPolicy>;

export function isSixScreenMutationAction(
  value: unknown,
): value is SixScreenMutationAction {
  return typeof value === "string" &&
    Object.hasOwn(SIX_SCREEN_ACTION_POLICIES, value);
}

export function sixScreenActionPolicy(
  value: unknown,
): SixScreenActionPolicy | null {
  return isSixScreenMutationAction(value)
    ? SIX_SCREEN_ACTION_POLICIES[value]
    : null;
}
