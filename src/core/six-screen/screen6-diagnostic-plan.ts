import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
} from "./contracts";
import {
  validateCausalDesignDecision,
  validateCausalDesignSet,
  type CausalDesignDecision,
  type CausalDesignSet,
} from "./causal-comparison";
import {
  SCREEN6_UNCERTAINTY_DIMENSIONS,
  validateScreen6UncertaintyProfile,
  type Screen6UncertaintyDimensionId,
  type Screen6UncertaintyProfile,
  type Screen6UncertaintyState,
} from "./screen6-uncertainty-profile";

export const SIX_SCREEN_DIAGNOSTIC_INPUT_VERSION =
  "screen-06-diagnostic-input-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION =
  "screen-06-reviewed-diagnostic-library-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_PLAN_VERSION =
  "screen-06-diagnostic-plan-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS = 24;
export const SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_BYTES = 160_000;
export const SIX_SCREEN_DIAGNOSTIC_PLAN_COLLECTION_MAX_BYTES = 2_000_000;

export const SCREEN6_DIAGNOSTIC_CATEGORIES = [
  "design_check",
  "statistical_test",
  "sensitivity_analysis",
  "additional_evidence_collection",
] as const;

export type Screen6DiagnosticCategory =
  (typeof SCREEN6_DIAGNOSTIC_CATEGORIES)[number];

export const SCREEN6_RESEARCHER_REPORTED_CONCERNS = [
  "remaining_trend_concern",
  "announcement_before_implementation",
  "staggered_adoption",
  "relevant_coevent",
  "comparison_contamination",
  "package_component_ambiguity",
  "outcome_or_sample_discontinuity",
  "proposed_negative_control",
  "group_level_assignment_or_dependence",
  "unique_mechanism_claim",
] as const;

export type Screen6ResearcherReportedConcern =
  (typeof SCREEN6_RESEARCHER_REPORTED_CONCERNS)[number];

export const SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS = [
  "did-pre-treatment-dynamics-v1",
  "did-parallel-trends-sensitivity-v1",
  "timing-anticipation-v1",
  "did-staggered-adoption-v1",
  "rd-eligibility-cutoff-v1",
  "rd-functional-sensitivity-v1",
  "coevent-exposure-alternatives-v1",
  "interference-spillover-mapping-v1",
  "treatment-package-separability-v1",
  "outcome-sample-continuity-v1",
  "negative-control-justification-v1",
  "group-inference-clustering-v1",
  "mechanism-discrimination-v1",
] as const;

export type Screen6DiagnosticLibraryEntryId =
  (typeof SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS)[number];

type Screen6MethodSourceReference =
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8"
  | "M9"
  | "M10"
  | "M11";

export type Screen6DiagnosticLibraryEntry = {
  id: Screen6DiagnosticLibraryEntryId;
  version: typeof SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION;
  reviewStatus: "reviewed_initial_library";
  label: string;
  dimensions: Screen6UncertaintyDimensionId[];
  trigger: string;
  category: Screen6DiagnosticCategory;
  consequence: "blocking_if_triggered" | "priority";
  prerequisites: string[];
  requiredData: string[];
  purpose: string;
  procedure: string[];
  allowedCalculations: string[];
  patternsRaisingConcern: string[];
  alternativeExplanations: string[];
  interpretiveLimits: string[];
  sourceReferences: Screen6MethodSourceReference[];
  possibleDesignResponses: string[];
};

const LIBRARY = [
  {
    id: "did-pre-treatment-dynamics-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Pre-treatment dynamics and substantive trend assessment",
    dimensions: ["counterfactual_comparison"],
    trigger: "A difference-in-differences comparison is selected.",
    category: "statistical_test",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A selected difference-in-differences comparison",
      "Repeated pre-treatment outcomes for the treated and eligible comparator groups",
      "A declared treatment clock and event-time coding",
    ],
    requiredData: [
      "Pre-treatment outcome observations",
      "Treatment-group and comparator-group identifiers",
      "Treatment or eligibility timing",
    ],
    purpose:
      "Inspect whether pre-treatment dynamics are substantively compatible with the proposed counterfactual comparison and quantify their uncertainty.",
    procedure: [
      "Plot and estimate pre-treatment group differences using the declared event-time and comparison definitions.",
      "Report uncertainty and assess the magnitude and direction of pre-treatment differences substantively.",
    ],
    allowedCalculations: [
      "Reviewed event-time contrasts with uncertainty",
      "Descriptive pre-treatment group trends under the saved exposure definition",
    ],
    patternsRaisingConcern: [
      "Materially diverging pre-treatment paths",
      "Imprecise estimates that cannot rule out consequential divergence",
      "Results that depend on one pre-period or one comparator definition",
    ],
    alternativeExplanations: [
      "Low power or noisy outcomes",
      "Changing sample composition",
      "Anticipation or another event before the selected treatment clock",
    ],
    interpretiveLimits: [
      "A nonsignificant pretrend test does not prove parallel trends.",
      "The design must not be selected solely because a pretest appears reassuring.",
    ],
    sourceReferences: ["M1", "M3"],
    possibleDesignResponses: [
      "Revise or justify the comparator",
      "Narrow the period or population prospectively",
      "Retain the unresolved counterfactual limitation",
      "Decline the intended causal claim if the comparison remains misleading",
    ],
  },
  {
    id: "did-parallel-trends-sensitivity-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Sensitivity to stated deviations from parallel trends",
    dimensions: ["counterfactual_comparison"],
    trigger:
      "A difference-in-differences comparison leaves a consequential counterfactual-trend concern.",
    category: "sensitivity_analysis",
    consequence: "priority",
    prerequisites: [
      "A selected difference-in-differences comparison",
      "A prospectively stated class or magnitude of plausible trend deviations",
      "The estimates and uncertainty inputs required by a pinned reviewed routine",
    ],
    requiredData: [
      "Event-time estimates and their covariance information",
      "A documented sensitivity restriction or range",
    ],
    purpose:
      "Assess how the intended conclusion changes under explicitly stated departures from parallel trends.",
    procedure: [
      "State the allowed trend-deviation restriction before interpreting the sensitivity range.",
      "Use only a pinned and tested implementation when calculation is enabled.",
    ],
    allowedCalculations: [
      "Sensitivity bounds from a pinned reviewed parallel-trends routine",
    ],
    patternsRaisingConcern: [
      "The intended conclusion changes under substantively small allowed deviations",
      "The chosen bound is doing most of the inferential work",
    ],
    alternativeExplanations: [
      "Imprecision in the underlying event-time estimates",
      "A sensitivity range that is poorly matched to the institutional setting",
    ],
    interpretiveLimits: [
      "The chosen sensitivity restriction is an assumption, not an empirically established fact.",
      "A favorable bound does not certify parallel trends.",
    ],
    sourceReferences: ["M4"],
    possibleDesignResponses: [
      "Narrow the claim to conclusions robust within the stated range",
      "Seek a more defensible comparator",
      "Retain the limitation or decline the claim",
    ],
  },
  {
    id: "timing-anticipation-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Anticipation and alternative timing definitions",
    dimensions: ["timing"],
    trigger:
      "An announcement or other information event may precede implementation or exposure.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "Distinct source-supported policy dates or intervals",
      "A saved treatment-clock decision",
      "Outcome observations around plausible anticipation windows where available",
    ],
    requiredData: [
      "Announcement, adoption, legal-effect, compliance, enforcement, and implementation timing where relevant",
      "Unit-level timing or exposure evidence where available",
    ],
    purpose:
      "Determine whether behavior could respond before the selected treatment clock and whether alternative clocks change the intended contrast.",
    procedure: [
      "Map each supported policy stage to the saved exposure definition.",
      "Compare prospectively justified timing definitions without searching for a favorable coefficient.",
    ],
    allowedCalculations: [
      "Outcome-blind event-time recoding under reviewed timing definitions",
      "Descriptive exposure counts by timing definition",
    ],
    patternsRaisingConcern: [
      "Outcome movement or exposure changes before the selected clock",
      "Material reclassification under equally plausible timing definitions",
    ],
    alternativeExplanations: [
      "A different contemporaneous event",
      "Reporting or sample-composition changes",
      "Imprecise unit-level implementation dates",
    ],
    interpretiveLimits: [
      "Earlier response may reflect anticipation or another event.",
      "The treatment date must not be moved mechanically to improve significance.",
    ],
    sourceReferences: ["M1", "M2"],
    possibleDesignResponses: [
      "Revise and document the exposure clock",
      "Model or exclude a prospectively justified anticipation interval",
      "Retain timing uncertainty in the claim boundary",
    ],
  },
  {
    id: "did-staggered-adoption-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Cohort-time contrasts and comparator eligibility audit",
    dimensions: ["timing", "counterfactual_comparison"],
    trigger:
      "Treatment or eligibility timing varies across groups in a difference-in-differences design.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A selected difference-in-differences comparison",
      "Group-specific first-treatment or first-eligibility dates",
      "Explicit not-yet-treated or never-treated comparator rules",
    ],
    requiredData: [
      "Assignment cohort identifiers",
      "Group-time treatment status",
      "Outcome observations in eligible cohort-time cells",
    ],
    purpose:
      "Identify admissible cohort-time comparisons and avoid already-treated comparator contamination.",
    procedure: [
      "Map adoption cohorts and every cohort-time comparator used by the planned analysis.",
      "Flag comparisons that use already-treated or otherwise ineligible units.",
    ],
    allowedCalculations: [
      "Cohort-time cell counts",
      "Reviewed cohort-time contrasts using eligible comparators",
    ],
    patternsRaisingConcern: [
      "Important contrasts rely on already-treated groups",
      "Sparse or absent eligible comparator cells",
      "Results dominated by a small adoption cohort",
    ],
    alternativeExplanations: [
      "True treatment-effect heterogeneity",
      "Composition changes across cohorts",
      "Different policy versions across adoption cohorts",
    ],
    interpretiveLimits: [
      "Not-yet-treated and never-treated groups are valid comparators only under stated assumptions.",
      "A conventional two-way fixed-effects coefficient is not a universal solution to heterogeneous effects.",
    ],
    sourceReferences: ["M2"],
    possibleDesignResponses: [
      "Use an eligible cohort-time comparison",
      "Narrow the supported cohorts or estimand",
      "Retain the contamination limitation or choose another comparison",
    ],
  },
  {
    id: "rd-eligibility-cutoff-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Eligibility discontinuity, sorting, and predetermined continuity",
    dimensions: ["assignment_exposure", "counterfactual_comparison"],
    trigger: "A threshold-eligibility comparison is selected.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A complete reviewed eligibility rule with a binding cutoff",
      "The historically correct running variable and reference period",
      "Sufficient support near the cutoff",
    ],
    requiredData: [
      "Running-variable values",
      "Eligibility or treatment status",
      "Predetermined variables near the cutoff",
    ],
    purpose:
      "Verify that the reviewed cutoff changes eligibility and assess sorting, heaping, and continuity of predetermined characteristics.",
    procedure: [
      "Reconstruct the complete eligibility rule and verify the treatment or eligibility discontinuity.",
      "Inspect the running-variable distribution and predetermined-variable continuity near the cutoff.",
    ],
    allowedCalculations: [
      "Reviewed local treatment-discontinuity summaries",
      "Pinned density or manipulation diagnostics where their assumptions fit",
      "Predetermined-variable continuity estimates",
    ],
    patternsRaisingConcern: [
      "No discontinuity in policy eligibility or treatment",
      "Institutionally unexplained sorting, heaping, or support loss at the cutoff",
      "Material predetermined-variable discontinuities",
    ],
    alternativeExplanations: [
      "A discrete or administratively rounded running variable",
      "Measurement error",
      "A coincident reporting threshold rather than behavioral sorting",
    ],
    interpretiveLimits: [
      "No single density or balance check mechanically proves or disproves regression-discontinuity validity.",
      "Heaping and discrete running variables require design-specific care.",
    ],
    sourceReferences: ["M5", "M6"],
    possibleDesignResponses: [
      "Correct the historical assignment variable",
      "Narrow the local population",
      "Revise the estimand or decline the cutoff design",
    ],
  },
  {
    id: "rd-functional-sensitivity-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Bandwidth, functional-form, and local-population sensitivity",
    dimensions: ["counterfactual_comparison", "statistical_inference"],
    trigger:
      "A threshold-eligibility comparison requires local functional and support choices.",
    category: "sensitivity_analysis",
    consequence: "priority",
    prerequisites: [
      "A selected threshold-eligibility comparison",
      "Running-variable support around the reviewed cutoff",
      "Prospectively reviewed bandwidth and functional choices",
    ],
    requiredData: [
      "Outcome and running-variable values near the cutoff",
      "Eligibility or treatment status",
    ],
    purpose:
      "Assess whether the local conclusion depends materially on reviewed bandwidth, functional-form, or support choices.",
    procedure: [
      "Apply only prospectively justified local specifications and bandwidth choices.",
      "Report how each choice changes support, precision, and the local population represented.",
    ],
    allowedCalculations: [
      "Pinned local-polynomial estimates and uncertainty",
      "Reviewed bandwidth and support summaries",
    ],
    patternsRaisingConcern: [
      "Large changes across defensible local specifications",
      "Loss of common support or a very small effective local sample",
      "A conclusion dependent on an arbitrary cutoff or bandwidth search",
    ],
    alternativeExplanations: [
      "Precision changes as bandwidth changes",
      "Different local populations represented by different windows",
      "Outcome nonlinearity unrelated to the policy",
    ],
    interpretiveLimits: [
      "Sensitivity choices change the local estimand, support, and precision.",
      "Arbitrary cutoff searches for favorable results are not allowed.",
    ],
    sourceReferences: ["M5", "M6"],
    possibleDesignResponses: [
      "Narrow the local estimand",
      "Collect more suitable local data",
      "Retain functional-form uncertainty or revise the design",
    ],
  },
  {
    id: "coevent-exposure-alternatives-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Co-event exposure mapping and comparison alternatives",
    dimensions: ["competing_events"],
    trigger: "A potentially relevant co-event is reported or retained for review.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A source-supported co-event occurrence",
      "A selected or explicitly proposed focal comparison",
      "A defensible mapping from the co-event to study units and time",
    ],
    requiredData: [
      "Co-event timing, scope, and unit exposure",
      "Focal policy exposure and comparison-group definitions",
    ],
    purpose:
      "Assess whether a co-event differentially enters the intended contrast and whether defensible comparison or sample alternatives address it.",
    procedure: [
      "Map co-event exposure without treating temporal overlap as causal classification.",
      "Compare prospectively defensible exposure, sample, or comparator alternatives.",
    ],
    allowedCalculations: [
      "Outcome-blind overlap and exposure counts",
      "Reviewed alternative-sample or alternative-comparator estimates when enabled",
    ],
    patternsRaisingConcern: [
      "Co-event exposure aligns differentially with focal treatment status",
      "The intended conclusion changes under a defensible alternative comparison",
    ],
    alternativeExplanations: [
      "Changed precision or sample composition",
      "A population change induced by the alternative comparison",
      "Incorrect co-event exposure measurement",
    ],
    interpretiveLimits: [
      "Temporal overlap alone does not establish confounding, mediation, or independence.",
      "A changed result does not automatically establish a causal verdict or justify adding a control.",
    ],
    sourceReferences: ["M8"],
    possibleDesignResponses: [
      "Revise the exposure or comparator",
      "Narrow the sample or estimand",
      "Retain the co-event limitation",
      "Decline the causal claim if separation is not defensible",
    ],
  },
  {
    id: "interference-spillover-mapping-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Spillover mapping and alternative exposure definitions",
    dimensions: ["interference", "counterfactual_comparison"],
    trigger:
      "The researcher reports possible comparison contamination, spillovers, displacement, or shared-market exposure.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A stated interference pathway",
      "Unit relationships or market links relevant to the pathway",
      "A saved focal exposure and comparison definition",
    ],
    requiredData: [
      "Direct exposure and plausible spillover links",
      "Unit locations, networks, suppliers, customers, or shared markets as relevant",
    ],
    purpose:
      "Map possible spillovers and assess how alternative exposure definitions change the population and intended effect.",
    procedure: [
      "Define the interference pathway and exposure mapping before examining outcome results.",
      "Compare prospectively justified direct, neighboring, or market-level exposure definitions.",
    ],
    allowedCalculations: [
      "Outcome-blind spillover exposure counts",
      "Reviewed alternative-exposure estimates when enabled",
    ],
    patternsRaisingConcern: [
      "Comparator units have plausible indirect exposure",
      "Results depend materially on excluding connected or neighboring units",
    ],
    alternativeExplanations: [
      "Population and precision changes after exclusions",
      "Shared shocks rather than treatment spillovers",
      "Misspecified network or geographic links",
    ],
    interpretiveLimits: [
      "Excluding possible neighbors changes the target population.",
      "Direct and spillover effects require explicit assumptions and are not interchangeable.",
    ],
    sourceReferences: ["M9"],
    possibleDesignResponses: [
      "Revise the exposure definition",
      "Target a market-level or spillover-aware estimand",
      "Narrow the population or retain the interference limitation",
    ],
  },
  {
    id: "treatment-package-separability-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Package and component separability",
    dimensions: ["treatment_versions", "mechanism_attribution"],
    trigger:
      "The intended claim separates a component even though policy components or versions may move together.",
    category: "additional_evidence_collection",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A source-supported map of package components and versions",
      "A component-specific target claim",
      "Potential independent variation in the named component",
    ],
    requiredData: [
      "Component-specific timing and exposure",
      "Other package components and policy versions received by each unit",
    ],
    purpose:
      "Determine whether the data and institutional record contain variation that can distinguish the named component from the policy package.",
    procedure: [
      "Map package components, versions, and their unit-level variation.",
      "Identify whether the named component varies independently under a defensible comparison.",
    ],
    allowedCalculations: [
      "Outcome-blind component and package exposure cross-tabulations",
    ],
    patternsRaisingConcern: [
      "The named component always changes with the rest of the package",
      "Apparent timing differences do not create independent exposure variation",
      "Treatment versions are pooled despite substantively different content",
    ],
    alternativeExplanations: [
      "Administrative timing differences without behavioral separation",
      "Measurement error in component exposure",
      "A package effect operating through multiple coexisting pathways",
    ],
    interpretiveLimits: [
      "Different implementation dates alone may be insufficient to identify a component effect.",
      "A package-level target must remain when component separability is not established.",
    ],
    sourceReferences: ["M8"],
    possibleDesignResponses: [
      "Retain a package-level estimand",
      "Collect independent component-exposure evidence",
      "Narrow or abandon the component-specific claim",
    ],
  },
  {
    id: "outcome-sample-continuity-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Outcome measurement and sample continuity",
    dimensions: ["outcome_measurement_sample_composition"],
    trigger:
      "The researcher reports a possible outcome-definition, reporting-rule, attrition, or sample discontinuity.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A stable outcome definition or a documented crosswalk across versions",
      "Observation and sample-inclusion rules over the study period",
      "Missingness or attrition indicators where relevant",
    ],
    requiredData: [
      "Outcome metadata and reporting rules by period",
      "Sample-entry, exit, and missingness information",
    ],
    purpose:
      "Assess whether changes in observed records reflect changes in measurement or sample composition rather than the underlying behavior.",
    procedure: [
      "Compare outcome definitions, reporting systems, and sample rules across the study window.",
      "Describe entry, exit, missingness, and composition around the policy clock.",
    ],
    allowedCalculations: [
      "Outcome-blind sample counts and missingness rates",
      "Reviewed measurement-crosswalk summaries",
    ],
    patternsRaisingConcern: [
      "A reporting or coding change coincides with treatment timing",
      "Differential attrition, missingness, entry, or exit across comparison groups",
      "Results depend on a changing outcome definition",
    ],
    alternativeExplanations: [
      "Real changes in participation or reporting behavior",
      "Administrative system migration",
      "Changed eligibility for inclusion in the observed dataset",
    ],
    interpretiveLimits: [
      "Changes in observed records may not equal changes in the underlying behavior.",
      "Sample restrictions can change the target population and precision.",
    ],
    sourceReferences: ["M8"],
    possibleDesignResponses: [
      "Construct and justify a consistent outcome",
      "Narrow the period or population",
      "Report composition effects separately",
      "Retain the measurement limitation",
    ],
  },
  {
    id: "negative-control-justification-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Negative-control justification",
    dimensions: ["counterfactual_comparison"],
    trigger: "The researcher proposes a negative-control outcome or exposure.",
    category: "design_check",
    consequence: "priority",
    prerequisites: [
      "A named suspected bias or confounding pathway",
      "A reason the focal treatment cannot causally affect the proposed control",
      "A reason the control remains exposed to the suspected bias",
    ],
    requiredData: [
      "The proposed control variable or exposure",
      "Institutional and theoretical support for both negative-control conditions",
    ],
    purpose:
      "Assess whether a proposed negative control can detect the suspected bias without sharing the focal causal pathway.",
    procedure: [
      "Document why the focal treatment should not affect the control.",
      "Document why the suspected bias should affect or be reflected in the control.",
    ],
    allowedCalculations: [
      "A reviewed negative-control association with uncertainty after both conditions are justified",
    ],
    patternsRaisingConcern: [
      "The focal treatment plausibly affects the proposed control",
      "The control is unrelated to the suspected bias",
      "The control relationship changes with sample or specification choices",
    ],
    alternativeExplanations: [
      "A genuine treatment pathway to the control",
      "Measurement error in the control",
      "A different bias process than the one the control was chosen to detect",
    ],
    interpretiveLimits: [
      "A placebo outcome is not valid merely because the focal theory does not mention it.",
      "A reassuring negative-control result does not certify absence of confounding.",
    ],
    sourceReferences: ["M10"],
    possibleDesignResponses: [
      "Choose a better justified negative control",
      "Seek direct evidence about the suspected bias",
      "Retain the unresolved bias limitation",
    ],
  },
  {
    id: "group-inference-clustering-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Assignment unit, dependence, and clustering",
    dimensions: ["assignment_exposure", "statistical_inference"],
    trigger:
      "Assignment or material dependence occurs at a group level, or the researcher reports that concern.",
    category: "design_check",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "The unit at which treatment is assigned or exposure varies",
      "A substantive map of dependence induced by assignment, sampling, geography, or markets",
      "The number and size of independent assignment groups",
    ],
    requiredData: [
      "Assignment-group identifiers",
      "Analysis-unit identifiers",
      "Group counts and sizes",
    ],
    purpose:
      "Align the inferential unit and uncertainty calculation with the assignment and dependence structure, including few-group risk.",
    procedure: [
      "Identify the source of treatment variation and plausible dependence before choosing an uncertainty routine.",
      "Report independent group counts and whether the planned routine is supported in that setting.",
    ],
    allowedCalculations: [
      "Outcome-blind group counts and size distributions",
      "Pinned reviewed clustered or few-group uncertainty procedures when enabled",
    ],
    patternsRaisingConcern: [
      "Few independent treatment-assignment groups",
      "The planned uncertainty unit is below the assignment or dependence level",
      "One or a few groups dominate the contrast",
    ],
    alternativeExplanations: [
      "Dependence generated by sampling rather than treatment assignment",
      "Multiple plausible clustering dimensions",
      "Unequal group sizes or leverage",
    ],
    interpretiveLimits: [
      "Many unit-period rows do not guarantee many independent treatment assignments.",
      "Clustering choices require a substantive justification, not a universal default.",
    ],
    sourceReferences: ["M11"],
    possibleDesignResponses: [
      "Align uncertainty with the assignment level",
      "Use a reviewed few-group method if supported",
      "Narrow the inferential claim or retain the precision limitation",
    ],
  },
  {
    id: "mechanism-discrimination-v1",
    version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
    reviewStatus: "reviewed_initial_library",
    label: "Discriminating evidence for a unique mechanism claim",
    dimensions: ["mechanism_attribution"],
    trigger: "The intended claim uniquely attributes the effect to a mechanism.",
    category: "additional_evidence_collection",
    consequence: "blocking_if_triggered",
    prerequisites: [
      "A reviewed mechanism set and prediction matrix",
      "At least one observation that discriminates the focal pathway from alternatives",
      "A measurement plan that avoids conditioning on an unjustified post-treatment variable",
    ],
    requiredData: [
      "Mechanism-specific measures and timing",
      "Measures bearing on viable alternative pathways",
      "The Screen 5 discriminating evidence plan",
    ],
    purpose:
      "Implement evidence that can distinguish the focal mechanism from viable alternatives without treating consistency as identification.",
    procedure: [
      "Carry forward the source-grounded discriminating predictions from Screen 5.",
      "Specify which observations favor, weaken, or fail to distinguish each pathway.",
    ],
    allowedCalculations: [
      "Only calculations specified by a reviewed mechanism-evidence plan and supported implementation",
    ],
    patternsRaisingConcern: [
      "The same pattern is predicted by multiple viable mechanisms",
      "Mechanism timing is inconsistent with the proposed sequence",
      "The plan relies only on a post-treatment mediator association",
    ],
    alternativeExplanations: [
      "Coexisting mechanisms",
      "A common cause of the mediator and outcome",
      "Measurement that does not uniquely represent the proposed pathway",
    ],
    interpretiveLimits: [
      "Evidence consistent with a pathway does not alone identify mediation.",
      "A total policy effect does not automatically identify its mechanism.",
    ],
    sourceReferences: ["M7"],
    possibleDesignResponses: [
      "Retain a package-effect claim",
      "Collect discriminating mechanism evidence",
      "Present multiple mechanisms as viable",
      "Abandon the unique mechanism claim",
    ],
  },
] satisfies Screen6DiagnosticLibraryEntry[];

export const INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY:
  readonly Screen6DiagnosticLibraryEntry[] = Object.freeze(LIBRARY);

export const SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT =
  fingerprintSixScreenValue(INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY);

export type Screen6PeriodAvailability = {
  status: "available" | "unavailable" | "not_assessed";
  count: number | null;
  description: string | null;
};

export type Screen6DiagnosticPlanInput = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_INPUT_VERSION;
  preTreatmentPeriods: Screen6PeriodAvailability;
  postTreatmentPeriods: Screen6PeriodAvailability;
  outcomeFrequency: {
    status: "known" | "not_assessed";
    value: string | null;
  };
  assignmentStructure: {
    status: "described" | "not_assessed";
    description: string | null;
    timingPattern:
      | "single_time"
      | "staggered"
      | "rolling_or_continuous"
      | "not_assessed";
    dependence:
      | "independent_units"
      | "grouped_or_clustered"
      | "not_assessed";
    independentGroupCount: number | null;
    groupingVariables: string[];
  };
  feasibleDiagnosticVariables: {
    status: "available" | "none_identified" | "not_assessed";
    values: string[];
  };
  practicalConstraints: {
    status: "reported" | "none_reported" | "not_assessed";
    values: string[];
  };
  reportedConcerns: Screen6ResearcherReportedConcern[];
  inputFingerprint: string;
};

export type Screen6DiagnosticSelectionContext = {
  selectedDesignFamily:
    | CausalDesignSet["options"][number]["family"]
    | null;
  policyTarget: CausalDesignSet["input"]["policyTarget"] | null;
  hasCoEventSnapshot: boolean;
  hasMechanismSnapshot: boolean;
  diagnosticInput: Screen6DiagnosticPlanInput;
};

export type Screen6DiagnosticSelection = {
  entryId: Screen6DiagnosticLibraryEntryId;
  triggerReasons: string[];
};

export type Screen6DiagnosticCard = {
  id: string;
  libraryEntryId: Screen6DiagnosticLibraryEntryId;
  libraryVersion: typeof SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION;
  libraryFingerprint: string;
  priorityRank: number;
  displayTier: "primary" | "additional";
  blocking: boolean;
  status: "planned";
  result: null;
  resultInterpretation: null;
  label: string;
  dimensions: Screen6UncertaintyDimensionId[];
  category: Screen6DiagnosticCategory;
  exactConcern: string;
  triggerReasons: string[];
  policyDesignOrCoEventBasis: string;
  sourceSnapshotIds: string[];
  requiredData: string[];
  missingPrerequisites: string[];
  procedure: string[];
  allowedCalculations: string[];
  patternsRaisingConcern: string[];
  alternativeExplanations: string[];
  interpretiveLimits: string[];
  sourceReferences: Screen6MethodSourceReference[];
  responseIfConcernRemains: string[];
};

export type Screen6DiagnosticPlan = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_PLAN_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    profileSnapshotId: string;
    profileFingerprint: string;
    profileInputFingerprint: string;
    studyRevision: number;
    identityFingerprint: string;
  };
  designContext: {
    status: "selected" | "no_selection" | "not_assessed";
    designSetSnapshotId: string | null;
    designSetFingerprint: string | null;
    decisionSnapshotId: string | null;
    decisionFingerprint: string | null;
    selectedDesignSnapshotId: string | null;
    selectedDesignFingerprint: string | null;
    selectedDesignLabel: string | null;
    selectedDesignFamily:
      | CausalDesignSet["options"][number]["family"]
      | null;
    policyTarget: CausalDesignSet["input"]["policyTarget"] | null;
    assignmentUnit: string | null;
    analysisUnit: string | null;
    timingDefinition: string | null;
  };
  diagnosticInput: Screen6DiagnosticPlanInput;
  diagnosticInputGaps: string[];
  methodLibrary: {
    version: typeof SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION;
    fingerprint: string;
    reviewStatus: "reviewed_initial_library";
    entryCount: 13;
  };
  methodSupport: {
    status: "reviewed_design_family" | "no_selected_design";
    issueList: string[];
  };
  selectedDiagnosticIds: Screen6DiagnosticLibraryEntryId[];
  priorityPlan: {
    status:
      | "within_normal_range"
      | "below_normal_range_due_to_available_triggers"
      | "exceeds_normal_range_to_show_blockers"
      | "no_reviewed_trigger";
    primaryCardCount: number;
    additionalCardCount: number;
    rankingBasis:
      "identification_consequence_then_recorded_feasibility_then_reviewed_order";
  };
  cards: Screen6DiagnosticCard[];
  dimensions: Array<{
    dimension: Screen6UncertaintyDimensionId;
    label: string;
    state: Extract<
      Screen6UncertaintyState,
      "not_assessed" | "planned" | "evidence_needed"
    >;
    diagnosticCardIds: string[];
    unresolvedLimitations: string[];
  }>;
  resultsReview: {
    status: "not_supplied";
    history: [];
  };
  nonOutputs: {
    diagnosticResults: [];
    aggregateScore: null;
    universalBadge: null;
    certification: "not_available";
    conditionalClaimBoundary: null;
    disposition: null;
    designRecord: null;
  };
  preparation: {
    actor: "researcher";
    method: "deterministic_reviewed_library";
    networkRequests: 0;
    modelCalls: 0;
  };
  planningInputFingerprint: string;
  claimBoundary: string;
  createdAt: string;
  planFingerprint: string;
};

type DiagnosticPlanBody = Omit<Screen6DiagnosticPlan, "planFingerprint">;

const PLAN_CLAIM_BOUNDARY =
  "This is a prospective challenge plan selected deterministically from the reviewed Screen 6 library. No diagnostic has run, no result has been supplied, and no card is passed or failed. The plan creates no aggregate credibility score, universal badge, causal certificate, conditional claim boundary, disposition, or Design Record.";

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 2_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(`${label} must be non-empty canonical text of at most ${max} characters.`);
  }
  return value;
}

function nullableText(value: string | null, label: string, max = 2_000) {
  if (value !== null) requireText(value, label, max);
  return value;
}

function textList(
  values: readonly string[],
  label: string,
  maxEntries: number,
  maxText = 1_000,
) {
  if (
    values.length > maxEntries ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, maxText));
  return values;
}

function inputBody(input: Screen6DiagnosticPlanInput) {
  const {
    schemaVersion: _schemaVersion,
    inputFingerprint: _inputFingerprint,
    ...body
  } = input;
  return body;
}

function period(
  value: Screen6PeriodAvailability,
  label: string,
): Screen6PeriodAvailability {
  if (![
    "available",
    "unavailable",
    "not_assessed",
  ].includes(value.status)) throw new Error(`${label} status is invalid.`);
  if (
    value.count !== null &&
    (!Number.isSafeInteger(value.count) || value.count < 0 || value.count > 10_000)
  ) throw new Error(`${label} count is invalid.`);
  nullableText(value.description, `${label} description`, 1_000);
  if (
    (value.status === "available" && (!value.count || value.count < 1)) ||
    (value.status === "unavailable" && value.count !== 0) ||
    (value.status === "not_assessed" &&
      (value.count !== null || value.description !== null))
  ) throw new Error(`${label} status does not match its details.`);
  return structuredClone(value);
}

export function createScreen6DiagnosticPlanInput(input: Omit<
  Screen6DiagnosticPlanInput,
  "schemaVersion" | "inputFingerprint"
>): Screen6DiagnosticPlanInput {
  const preTreatmentPeriods = period(
    input.preTreatmentPeriods,
    "Screen 6 pre-treatment periods",
  );
  const postTreatmentPeriods = period(
    input.postTreatmentPeriods,
    "Screen 6 post-treatment periods",
  );
  if (
    input.outcomeFrequency.status === "known"
      ? input.outcomeFrequency.value === null
      : input.outcomeFrequency.status !== "not_assessed" ||
        input.outcomeFrequency.value !== null
  ) throw new Error("Screen 6 outcome-frequency status is invalid.");
  nullableText(
    input.outcomeFrequency.value,
    "Screen 6 outcome frequency",
    500,
  );
  const assignment = input.assignmentStructure;
  if (![
    "single_time",
    "staggered",
    "rolling_or_continuous",
    "not_assessed",
  ].includes(assignment.timingPattern) || ![
    "independent_units",
    "grouped_or_clustered",
    "not_assessed",
  ].includes(assignment.dependence)) {
    throw new Error("Screen 6 assignment structure is invalid.");
  }
  if (
    assignment.independentGroupCount !== null &&
    (!Number.isSafeInteger(assignment.independentGroupCount) ||
      assignment.independentGroupCount < 1 ||
      assignment.independentGroupCount > 1_000_000)
  ) throw new Error("Screen 6 independent-group count is invalid.");
  textList(
    assignment.groupingVariables,
    "Screen 6 grouping variables",
    20,
    500,
  );
  if (assignment.status === "described") {
    if (assignment.description === null) {
      throw new Error("Screen 6 described assignment structure needs a description.");
    }
    requireText(
      assignment.description,
      "Screen 6 assignment description",
      2_000,
    );
    if (
      assignment.dependence !== "grouped_or_clustered" &&
      (assignment.independentGroupCount !== null ||
        assignment.groupingVariables.length > 0)
    ) throw new Error("Screen 6 group details require grouped or clustered dependence.");
  } else if (
    assignment.status !== "not_assessed" ||
    assignment.description !== null ||
    assignment.timingPattern !== "not_assessed" ||
    assignment.dependence !== "not_assessed" ||
    assignment.independentGroupCount !== null ||
    assignment.groupingVariables.length > 0
  ) throw new Error("Screen 6 unassessed assignment structure cannot contain details.");
  const variables = input.feasibleDiagnosticVariables;
  textList(
    variables.values,
    "Screen 6 feasible diagnostic variables",
    40,
    500,
  );
  if (
    !["available", "none_identified", "not_assessed"].includes(
      variables.status,
    ) ||
    (variables.status === "available") !== (variables.values.length > 0)
  ) throw new Error("Screen 6 feasible-variable status is invalid.");
  const constraints = input.practicalConstraints;
  textList(
    constraints.values,
    "Screen 6 practical constraints",
    30,
    1_000,
  );
  if (
    !["reported", "none_reported", "not_assessed"].includes(
      constraints.status,
    ) ||
    (constraints.status === "reported") !== (constraints.values.length > 0)
  ) throw new Error("Screen 6 practical-constraint status is invalid.");
  if (
    input.reportedConcerns.length >
      SCREEN6_RESEARCHER_REPORTED_CONCERNS.length ||
    new Set(input.reportedConcerns).size !== input.reportedConcerns.length ||
    input.reportedConcerns.some((value) =>
      !SCREEN6_RESEARCHER_REPORTED_CONCERNS.includes(value))
  ) throw new Error("Screen 6 reported concerns must be a bounded reviewed list.");
  const body = {
    schemaVersion: SIX_SCREEN_DIAGNOSTIC_INPUT_VERSION,
    preTreatmentPeriods,
    postTreatmentPeriods,
    outcomeFrequency: structuredClone(input.outcomeFrequency),
    assignmentStructure: structuredClone(input.assignmentStructure),
    feasibleDiagnosticVariables:
      structuredClone(input.feasibleDiagnosticVariables),
    practicalConstraints: structuredClone(input.practicalConstraints),
    reportedConcerns: [...input.reportedConcerns],
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(inputBody({
      ...body,
      inputFingerprint: "",
    })),
  };
}

export function validateScreen6DiagnosticPlanInput(
  input: Screen6DiagnosticPlanInput,
) {
  const recreated = createScreen6DiagnosticPlanInput(inputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_INPUT_VERSION ||
    !sameSixScreenValue(input, recreated)
  ) throw new Error("Screen 6 diagnostic input is invalid or noncanonical.");
  requireFingerprint(
    input.inputFingerprint,
    "Screen 6 diagnostic input fingerprint",
  );
  return input;
}

function validateLibrary() {
  if (
    INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY.length !== 13 ||
    SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT !==
      fingerprintSixScreenValue(INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY)
  ) throw new Error("Screen 6 reviewed diagnostic library is invalid.");
  for (const [index, entry] of INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY.entries()) {
    if (
      entry.id !== SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS[index] ||
      entry.version !== SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION ||
      entry.reviewStatus !== "reviewed_initial_library" ||
      !SCREEN6_DIAGNOSTIC_CATEGORIES.includes(entry.category) ||
      !entry.dimensions.length ||
      entry.dimensions.some((dimension) =>
        !SCREEN6_UNCERTAINTY_DIMENSIONS.includes(dimension)) ||
      !entry.sourceReferences.length
    ) throw new Error("Screen 6 reviewed diagnostic library is invalid.");
    requireText(entry.label, "Screen 6 diagnostic label", 500);
    requireText(entry.trigger, "Screen 6 diagnostic trigger", 1_000);
    requireText(entry.purpose, "Screen 6 diagnostic purpose", 2_000);
    for (const [label, values] of [
      ["prerequisites", entry.prerequisites],
      ["required data", entry.requiredData],
      ["procedure", entry.procedure],
      ["allowed calculations", entry.allowedCalculations],
      ["patterns", entry.patternsRaisingConcern],
      ["alternative explanations", entry.alternativeExplanations],
      ["interpretive limits", entry.interpretiveLimits],
      ["responses", entry.possibleDesignResponses],
    ] as const) textList(values, `Screen 6 diagnostic ${label}`, 16, 2_000);
  }
  return INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY;
}

export function screen6ReviewedDiagnosticLibrary() {
  return structuredClone(validateLibrary());
}

const CONCERN_ENTRY: Record<
  Screen6ResearcherReportedConcern,
  Screen6DiagnosticLibraryEntryId
> = {
  remaining_trend_concern: "did-parallel-trends-sensitivity-v1",
  announcement_before_implementation: "timing-anticipation-v1",
  staggered_adoption: "did-staggered-adoption-v1",
  relevant_coevent: "coevent-exposure-alternatives-v1",
  comparison_contamination: "interference-spillover-mapping-v1",
  package_component_ambiguity: "treatment-package-separability-v1",
  outcome_or_sample_discontinuity: "outcome-sample-continuity-v1",
  proposed_negative_control: "negative-control-justification-v1",
  group_level_assignment_or_dependence: "group-inference-clustering-v1",
  unique_mechanism_claim: "mechanism-discrimination-v1",
};

const RESEARCHER_CONCERN_LABELS: Record<
  Screen6ResearcherReportedConcern,
  string
> = {
  remaining_trend_concern: "remaining counterfactual-trend concern",
  announcement_before_implementation:
    "announcement or information exposure before implementation",
  staggered_adoption: "staggered treatment or eligibility timing",
  relevant_coevent: "a potentially relevant co-event",
  comparison_contamination: "comparison contamination or spillovers",
  package_component_ambiguity: "package or component ambiguity",
  outcome_or_sample_discontinuity:
    "an outcome-measurement or sample-composition discontinuity",
  proposed_negative_control: "a proposed negative control",
  group_level_assignment_or_dependence:
    "group-level assignment or dependence",
  unique_mechanism_claim: "an intended unique mechanism claim",
};

export function selectScreen6ReviewedDiagnostics(
  context: Screen6DiagnosticSelectionContext,
): Screen6DiagnosticSelection[] {
  validateScreen6DiagnosticPlanInput(context.diagnosticInput);
  validateLibrary();
  const reasons = new Map<Screen6DiagnosticLibraryEntryId, string[]>();
  const add = (entryId: Screen6DiagnosticLibraryEntryId, reason: string) => {
    const current = reasons.get(entryId) ?? [];
    if (!current.includes(reason)) current.push(reason);
    reasons.set(entryId, current);
  };
  if (context.selectedDesignFamily === "difference_in_differences") {
    add(
      "did-pre-treatment-dynamics-v1",
      "The current researcher-selected comparison is difference-in-differences.",
    );
    add(
      "did-parallel-trends-sensitivity-v1",
      "The selected difference-in-differences comparison retains an unverified counterfactual-trend assumption.",
    );
  }
  if (context.selectedDesignFamily === "threshold_eligibility") {
    add(
      "rd-eligibility-cutoff-v1",
      "The current researcher-selected comparison uses a reviewed eligibility cutoff.",
    );
    add(
      "rd-functional-sensitivity-v1",
      "The selected threshold comparison requires reviewed local support and functional choices.",
    );
  }
  if (
    context.selectedDesignFamily === "difference_in_differences" &&
    context.diagnosticInput.assignmentStructure.timingPattern === "staggered"
  ) add(
    "did-staggered-adoption-v1",
    "The researcher described staggered assignment timing for the selected difference-in-differences comparison.",
  );
  if (
    context.diagnosticInput.assignmentStructure.dependence ===
      "grouped_or_clustered"
  ) add(
    "group-inference-clustering-v1",
    "The researcher described grouped or clustered assignment or dependence.",
  );
  if (context.policyTarget === "policy_component") add(
    "treatment-package-separability-v1",
    "The current Screen 3 target is a policy-component claim.",
  );
  for (const concern of context.diagnosticInput.reportedConcerns) {
    const entryId = CONCERN_ENTRY[concern];
    if (
      (concern === "remaining_trend_concern" ||
        concern === "staggered_adoption") &&
      context.selectedDesignFamily !== "difference_in_differences"
    ) continue;
    add(
      entryId,
      `The researcher explicitly reported ${RESEARCHER_CONCERN_LABELS[concern]}.`,
    );
    if (concern === "relevant_coevent" && !context.hasCoEventSnapshot) {
      add(
        entryId,
        "No current Screen 4 occurrence-work snapshot is available to characterize the reported co-event.",
      );
    }
    if (concern === "unique_mechanism_claim" && !context.hasMechanismSnapshot) {
      add(
        entryId,
        "No current Screen 5 literature or synthesis-input snapshot is available to ground the reported mechanism claim.",
      );
    }
  }
  return SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS
    .filter((entryId) => reasons.has(entryId))
    .map((entryId) => ({
      entryId,
      triggerReasons: reasons.get(entryId)!,
    }));
}

function designContext(input: {
  profile: Screen6UncertaintyProfile;
  designSet: CausalDesignSet | null;
  designDecision: CausalDesignDecision | null;
}): Screen6DiagnosticPlan["designContext"] {
  const binding = input.profile.binding.design;
  if (!binding) {
    if (input.designSet || input.designDecision) {
      throw new Error("Screen 6 diagnostic plan received design data absent from its profile.");
    }
    return {
      status: "not_assessed",
      designSetSnapshotId: null,
      designSetFingerprint: null,
      decisionSnapshotId: null,
      decisionFingerprint: null,
      selectedDesignSnapshotId: null,
      selectedDesignFingerprint: null,
      selectedDesignLabel: null,
      selectedDesignFamily: null,
      policyTarget: null,
      assignmentUnit: null,
      analysisUnit: null,
      timingDefinition: null,
    };
  }
  if (!input.designSet || !input.designDecision) {
    throw new Error("Screen 6 diagnostic plan lost its bound design decision.");
  }
  validateCausalDesignSet(input.designSet);
  validateCausalDesignDecision(input.designDecision, input.designSet);
  if (
    input.designSet.snapshotId !== binding.designSetSnapshotId ||
    input.designSet.designSetFingerprint !== binding.designSetFingerprint ||
    input.designDecision.snapshotId !== binding.decisionSnapshotId ||
    input.designDecision.decisionFingerprint !== binding.decisionFingerprint ||
    input.designDecision.decision !== binding.decision ||
    (input.designDecision.selectedDesign?.snapshotId ?? null) !==
      binding.selectedDesignSnapshotId
  ) throw new Error("Screen 6 diagnostic plan design binding is stale or mismatched.");
  const selected = input.designDecision.selectedDesign;
  return {
    status: selected ? "selected" : "no_selection",
    designSetSnapshotId: input.designSet.snapshotId,
    designSetFingerprint: input.designSet.designSetFingerprint,
    decisionSnapshotId: input.designDecision.snapshotId,
    decisionFingerprint: input.designDecision.decisionFingerprint,
    selectedDesignSnapshotId: selected?.snapshotId ?? null,
    selectedDesignFingerprint: selected?.selectedDesignFingerprint ?? null,
    selectedDesignLabel: selected?.label ?? null,
    selectedDesignFamily: selected?.family ?? null,
    policyTarget: input.designSet.input.policyTarget,
    assignmentUnit: selected?.assignmentUnit ?? null,
    analysisUnit: selected?.analysisUnit ?? null,
    timingDefinition: selected?.timingDefinition ?? null,
  };
}

function diagnosticInputGaps(input: Screen6DiagnosticPlanInput) {
  const gaps: string[] = [];
  if (input.preTreatmentPeriods.status === "not_assessed") {
    gaps.push("Available pre-treatment periods have not been assessed.");
  } else if (input.preTreatmentPeriods.status === "unavailable") {
    gaps.push("The researcher reports no available pre-treatment periods.");
  }
  if (input.postTreatmentPeriods.status === "not_assessed") {
    gaps.push("Available post-treatment periods have not been assessed.");
  } else if (input.postTreatmentPeriods.status === "unavailable") {
    gaps.push("The researcher reports no available post-treatment periods.");
  }
  if (input.outcomeFrequency.status === "not_assessed") {
    gaps.push("Outcome frequency has not been assessed.");
  }
  if (input.assignmentStructure.status === "not_assessed") {
    gaps.push("Assignment and group structure have not been assessed.");
  } else {
    if (input.assignmentStructure.timingPattern === "not_assessed") {
      gaps.push("Assignment timing has not been assessed.");
    }
    if (input.assignmentStructure.dependence === "not_assessed") {
      gaps.push("Dependence structure has not been assessed.");
    } else if (
      input.assignmentStructure.dependence === "grouped_or_clustered"
    ) {
      if (input.assignmentStructure.independentGroupCount === null) {
        gaps.push("The independent group count has not been recorded.");
      }
      if (input.assignmentStructure.groupingVariables.length === 0) {
        gaps.push("Grouping variables have not been recorded.");
      }
    }
  }
  if (input.feasibleDiagnosticVariables.status === "not_assessed") {
    gaps.push("Feasible diagnostic variables have not been assessed.");
  } else if (input.feasibleDiagnosticVariables.status === "none_identified") {
    gaps.push("No feasible diagnostic variables have been identified.");
  }
  if (input.practicalConstraints.status === "not_assessed") {
    gaps.push("Practical constraints have not been assessed.");
  }
  return gaps;
}

function methodIssues(input: {
  design: Screen6DiagnosticPlan["designContext"];
  diagnosticInput: Screen6DiagnosticPlanInput;
}) {
  const issues: string[] = [];
  if (input.design.status === "not_assessed") {
    issues.push(
      "No current Screen 3 design decision is bound; the plan cannot prescribe a design-specific estimator.",
    );
  } else if (input.design.status === "no_selection") {
    issues.push(
      "Screen 3 records no selected comparison; the plan retains only concern-specific documentary work and cannot prescribe an estimator.",
    );
  }
  for (const concern of input.diagnosticInput.reportedConcerns) {
    if (
      (concern === "remaining_trend_concern" ||
        concern === "staggered_adoption") &&
      input.design.selectedDesignFamily !== "difference_in_differences"
    ) issues.push(
      `The researcher reported ${RESEARCHER_CONCERN_LABELS[concern]}, but no difference-in-differences design is selected; the reviewed DiD routine was not added.`,
    );
  }
  return issues;
}

function sourceSnapshotIds(
  entry: Screen6DiagnosticLibraryEntry,
  profile: Screen6UncertaintyProfile,
  design: Screen6DiagnosticPlan["designContext"],
) {
  const values: Array<string | null> = [];
  if (
    entry.dimensions.includes("institutional_evidence") ||
    entry.dimensions.includes("timing") ||
    entry.dimensions.includes("treatment_versions")
  ) values.push(profile.binding.eventCardReference?.eventCardSnapshotId ?? null);
  if (
    entry.dimensions.includes("assignment_exposure") ||
    entry.dimensions.includes("counterfactual_comparison") ||
    entry.dimensions.includes("interference") ||
    entry.dimensions.includes("statistical_inference")
  ) values.push(design.decisionSnapshotId);
  if (entry.dimensions.includes("competing_events")) {
    values.push(profile.binding.coEvent?.snapshotId ?? null);
  }
  if (entry.dimensions.includes("mechanism_attribution")) {
    values.push(
      profile.binding.mechanismReview?.reviewSnapshotId ??
        profile.binding.mechanismInput?.snapshotId ?? null,
    );
  }
  return [...new Set(values.filter((value): value is string => value !== null))];
}

function basis(
  entry: Screen6DiagnosticLibraryEntry,
  profile: Screen6UncertaintyProfile,
  design: Screen6DiagnosticPlan["designContext"],
) {
  if (entry.id === "coevent-exposure-alternatives-v1") {
    return profile.binding.coEvent
      ? `Researcher-reported co-event concern linked to current Screen 4 ${profile.binding.coEvent.kind} snapshot ${profile.binding.coEvent.snapshotId}. Relation and confounding status remain unassessed.`
      : "Researcher-reported co-event concern; no current Screen 4 occurrence-work snapshot is available.";
  }
  if (design.status === "selected") {
    return `Current researcher-selected ${design.selectedDesignFamily!.replaceAll("_", " ")} comparison: ${design.selectedDesignLabel}.`;
  }
  return design.status === "no_selection"
    ? "Current Screen 3 decision records no selected comparison; this card is concern-specific and not an estimator prescription."
    : "No current Screen 3 design decision is bound; this card is concern-specific and not an estimator prescription.";
}

function missingPrerequisites(input: {
  entry: Screen6DiagnosticLibraryEntry;
  profile: Screen6UncertaintyProfile;
  design: Screen6DiagnosticPlan["designContext"];
  diagnosticInput: Screen6DiagnosticPlanInput;
}) {
  const missing: string[] = [];
  const id = input.entry.id;
  const needsSelectedDesign = [
    "did-pre-treatment-dynamics-v1",
    "did-parallel-trends-sensitivity-v1",
    "did-staggered-adoption-v1",
    "rd-eligibility-cutoff-v1",
    "rd-functional-sensitivity-v1",
    "coevent-exposure-alternatives-v1",
    "interference-spillover-mapping-v1",
  ].includes(id);
  if (needsSelectedDesign && input.design.status !== "selected") {
    missing.push("A current researcher-selected comparison is not available.");
  }
  if (
    id.startsWith("did-") || id === "timing-anticipation-v1"
  ) {
    if (input.diagnosticInput.preTreatmentPeriods.status !== "available") {
      missing.push("Available pre-treatment periods are not established.");
    }
  }
  if (
    input.entry.category === "statistical_test" ||
    input.entry.category === "sensitivity_analysis"
  ) {
    if (input.diagnosticInput.outcomeFrequency.status !== "known") {
      missing.push("Outcome frequency is not recorded.");
    }
    if (
      input.diagnosticInput.feasibleDiagnosticVariables.status !== "available"
    ) missing.push("Feasible diagnostic variables are not identified.");
  }
  if (
    id === "did-staggered-adoption-v1" ||
    id === "rd-eligibility-cutoff-v1" ||
    id === "group-inference-clustering-v1"
  ) {
    if (input.diagnosticInput.assignmentStructure.status !== "described") {
      missing.push("Assignment and group structure are not described.");
    }
  }
  if (id === "group-inference-clustering-v1") {
    if (
      input.diagnosticInput.assignmentStructure.status === "described" &&
      input.diagnosticInput.assignmentStructure.dependence !==
        "grouped_or_clustered"
    ) {
      missing.push(
        "Grouped assignment or dependence is not established in the recorded structure.",
      );
    }
    if (
      input.diagnosticInput.assignmentStructure.dependence ===
        "grouped_or_clustered"
    ) {
      if (
        input.diagnosticInput.assignmentStructure.independentGroupCount === null
      ) missing.push("The independent group count is not recorded.");
      if (
        input.diagnosticInput.assignmentStructure.groupingVariables.length === 0
      ) missing.push("Clustering or grouping variables are not recorded.");
    }
  }
  if (
    id === "coevent-exposure-alternatives-v1" &&
    !input.profile.binding.coEvent
  ) missing.push("No current Screen 4 occurrence-work snapshot is bound.");
  if (
    id === "mechanism-discrimination-v1" &&
    !input.profile.binding.mechanismReview
  ) missing.push("No current researcher-authored Screen 5 mechanism review and prediction matrix is bound.");
  return [...new Set(missing)];
}

function cards(input: {
  snapshotId: string;
  profile: Screen6UncertaintyProfile;
  design: Screen6DiagnosticPlan["designContext"];
  diagnosticInput: Screen6DiagnosticPlanInput;
  selections: Screen6DiagnosticSelection[];
}) {
  const library = validateLibrary();
  const selected = input.selections.map((selection) => {
    const entry = library.find(({ id }) => id === selection.entryId)!;
    return {
      entry,
      selection,
      missing: missingPrerequisites({
        entry,
        profile: input.profile,
        design: input.design,
        diagnosticInput: input.diagnosticInput,
      }),
    };
  });
  const ordered = [...selected].sort((left, right) => {
    const consequence = Number(right.entry.consequence === "blocking_if_triggered") -
      Number(left.entry.consequence === "blocking_if_triggered");
    const feasibility = left.missing.length - right.missing.length;
    return consequence || feasibility ||
      SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS.indexOf(left.entry.id) -
        SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS.indexOf(right.entry.id);
  });
  let primaryCount = 0;
  return ordered.map(({ entry, selection, missing }, index) => {
    const blocking = entry.consequence === "blocking_if_triggered";
    const displayTier = blocking || primaryCount < 7
      ? "primary" as const
      : "additional" as const;
    if (displayTier === "primary") primaryCount += 1;
    return {
      id: `${input.snapshotId}-${entry.id}`,
      libraryEntryId: entry.id,
      libraryVersion: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
      libraryFingerprint: SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT,
      priorityRank: index + 1,
      displayTier,
      blocking,
      status: "planned" as const,
      result: null,
      resultInterpretation: null,
      label: entry.label,
      dimensions: [...entry.dimensions],
      category: entry.category,
      exactConcern: entry.trigger,
      triggerReasons: [...selection.triggerReasons],
      policyDesignOrCoEventBasis: basis(entry, input.profile, input.design),
      sourceSnapshotIds: sourceSnapshotIds(entry, input.profile, input.design),
      requiredData: [...entry.requiredData],
      missingPrerequisites: [...missing],
      procedure: [...entry.procedure],
      allowedCalculations: [...entry.allowedCalculations],
      patternsRaisingConcern: [...entry.patternsRaisingConcern],
      alternativeExplanations: [...entry.alternativeExplanations],
      interpretiveLimits: [...entry.interpretiveLimits],
      sourceReferences: [...entry.sourceReferences],
      responseIfConcernRemains: [...entry.possibleDesignResponses],
    } satisfies Screen6DiagnosticCard;
  });
}

function dimensionPlans(
  profile: Screen6UncertaintyProfile,
  plannedCards: Screen6DiagnosticCard[],
): Screen6DiagnosticPlan["dimensions"] {
  return profile.dimensions.map((dimension) => {
    const linked = plannedCards.filter((card) =>
      card.dimensions.includes(dimension.dimension));
    const baselineState = dimension.state === "not_assessed" ||
        dimension.state === "evidence_needed"
      ? dimension.state
      : (() => {
          throw new Error(
            "Screen 6 diagnostic planning requires an initial non-result profile.",
          );
        })();
    return {
      dimension: dimension.dimension,
      label: dimension.label,
      state: linked.length ? "planned" : baselineState,
      diagnosticCardIds: linked.map(({ id }) => id),
      unresolvedLimitations: [
        dimension.unresolvedLimitation,
        ...linked.flatMap(({ missingPrerequisites: values }) => values),
      ].filter((value, index, values) => values.indexOf(value) === index),
    };
  });
}

function priorityPlan(
  plannedCards: Screen6DiagnosticCard[],
): Screen6DiagnosticPlan["priorityPlan"] {
  const primaryCardCount = plannedCards.filter(({ displayTier }) =>
    displayTier === "primary").length;
  const additionalCardCount = plannedCards.length - primaryCardCount;
  const status = plannedCards.length === 0
    ? "no_reviewed_trigger" as const
    : primaryCardCount < 3
    ? "below_normal_range_due_to_available_triggers" as const
    : primaryCardCount > 7
    ? "exceeds_normal_range_to_show_blockers" as const
    : "within_normal_range" as const;
  return {
    status,
    primaryCardCount,
    additionalCardCount,
    rankingBasis:
      "identification_consequence_then_recorded_feasibility_then_reviewed_order",
  };
}

function buildPlanBody(input: {
  snapshotId: string;
  ordinal: number;
  profile: Screen6UncertaintyProfile;
  designSet: CausalDesignSet | null;
  designDecision: CausalDesignDecision | null;
  diagnosticInput: Screen6DiagnosticPlanInput;
  createdAt: string;
}): DiagnosticPlanBody {
  const design = designContext(input);
  const selections = selectScreen6ReviewedDiagnostics({
    selectedDesignFamily: design.selectedDesignFamily,
    policyTarget: design.policyTarget,
    hasCoEventSnapshot: Boolean(input.profile.binding.coEvent),
    hasMechanismSnapshot: Boolean(input.profile.binding.mechanismReview),
    diagnosticInput: input.diagnosticInput,
  });
  const plannedCards = cards({
    snapshotId: input.snapshotId,
    profile: input.profile,
    design,
    diagnosticInput: input.diagnosticInput,
    selections,
  });
  const issues = methodIssues({
    design,
    diagnosticInput: input.diagnosticInput,
  });
  return {
    schemaVersion: SIX_SCREEN_DIAGNOSTIC_PLAN_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      profileSnapshotId: input.profile.snapshotId,
      profileFingerprint: input.profile.profileFingerprint,
      profileInputFingerprint: input.profile.inputFingerprint,
      studyRevision: input.profile.binding.studyRevision,
      identityFingerprint: input.profile.binding.identityFingerprint,
    },
    designContext: design,
    diagnosticInput: structuredClone(input.diagnosticInput),
    diagnosticInputGaps: diagnosticInputGaps(input.diagnosticInput),
    methodLibrary: {
      version: SIX_SCREEN_DIAGNOSTIC_LIBRARY_VERSION,
      fingerprint: SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT,
      reviewStatus: "reviewed_initial_library",
      entryCount: 13,
    },
    methodSupport: {
      status: design.status === "selected"
        ? "reviewed_design_family"
        : "no_selected_design",
      issueList: issues,
    },
    selectedDiagnosticIds: selections.map(({ entryId }) => entryId),
    priorityPlan: priorityPlan(plannedCards),
    cards: plannedCards,
    dimensions: dimensionPlans(input.profile, plannedCards),
    resultsReview: { status: "not_supplied", history: [] },
    nonOutputs: {
      diagnosticResults: [],
      aggregateScore: null,
      universalBadge: null,
      certification: "not_available",
      conditionalClaimBoundary: null,
      disposition: null,
      designRecord: null,
    },
    preparation: {
      actor: "researcher",
      method: "deterministic_reviewed_library",
      networkRequests: 0,
      modelCalls: 0,
    },
    planningInputFingerprint: fingerprintSixScreenValue({
      profileFingerprint: input.profile.profileFingerprint,
      diagnosticInputFingerprint: input.diagnosticInput.inputFingerprint,
      methodLibraryFingerprint: SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT,
    }),
    claimBoundary: PLAN_CLAIM_BOUNDARY,
    createdAt: input.createdAt,
  };
}

export function createScreen6DiagnosticPlan(input: {
  snapshotId: string;
  ordinal: number;
  profile: Screen6UncertaintyProfile;
  designSet: CausalDesignSet | null;
  designDecision: CausalDesignDecision | null;
  diagnosticInput: Screen6DiagnosticPlanInput;
  actor: "researcher_ui" | "model" | "system";
  createdAt: string;
}): Screen6DiagnosticPlan {
  requireBoundedIdentifier(input.snapshotId, "Screen 6 diagnostic-plan id");
  requireCanonicalInstant(input.createdAt, "Screen 6 diagnostic-plan createdAt");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 6 diagnostic-plan ordinal is invalid.");
  }
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can save a Screen 6 diagnostic plan.");
  }
  validateScreen6UncertaintyProfile(input.profile);
  validateScreen6DiagnosticPlanInput(input.diagnosticInput);
  const body = buildPlanBody(input);
  const plan = {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScreen6DiagnosticPlan(plan, {
    profile: input.profile,
    designSet: input.designSet,
    designDecision: input.designDecision,
  });
}

function planBody(plan: Screen6DiagnosticPlan): DiagnosticPlanBody {
  const { planFingerprint: _planFingerprint, ...body } = plan;
  return body;
}

export function validateScreen6DiagnosticPlan(
  plan: Screen6DiagnosticPlan,
  parents: {
    profile: Screen6UncertaintyProfile;
    designSet: CausalDesignSet | null;
    designDecision: CausalDesignDecision | null;
  },
) {
  validateScreen6UncertaintyProfile(parents.profile);
  validateScreen6DiagnosticPlanInput(plan.diagnosticInput);
  const expected = buildPlanBody({
    snapshotId: plan.snapshotId,
    ordinal: plan.ordinal,
    profile: parents.profile,
    designSet: parents.designSet,
    designDecision: parents.designDecision,
    diagnosticInput: plan.diagnosticInput,
    createdAt: plan.createdAt,
  });
  if (
    plan.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_PLAN_VERSION ||
    plan.planFingerprint !== fingerprintSixScreenValue(planBody(plan)) ||
    !sameSixScreenValue(planBody(plan), expected) ||
    plan.cards.some((card) =>
      card.status !== "planned" || card.result !== null ||
      card.resultInterpretation !== null) ||
    plan.dimensions.some(({ state }) =>
      state !== "not_assessed" && state !== "planned" &&
      state !== "evidence_needed") ||
    plan.preparation.networkRequests !== 0 ||
    plan.preparation.modelCalls !== 0 ||
    bytes(plan) > SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_BYTES
  ) throw new Error("Screen 6 diagnostic plan is invalid.");
  requireBoundedIdentifier(plan.snapshotId, "Screen 6 diagnostic-plan id");
  requireCanonicalInstant(plan.createdAt, "Screen 6 diagnostic-plan createdAt");
  requireFingerprint(plan.planFingerprint, "Screen 6 diagnostic-plan fingerprint");
  requireFingerprint(
    plan.planningInputFingerprint,
    "Screen 6 diagnostic planning-input fingerprint",
  );
  requireFingerprint(
    plan.binding.identityFingerprint,
    "Screen 6 diagnostic-plan identity fingerprint",
  );
  requireFingerprint(
    plan.binding.profileFingerprint,
    "Screen 6 diagnostic-plan profile fingerprint",
  );
  return plan;
}

export function validateScreen6DiagnosticPlanCollection(input: {
  plans: readonly Screen6DiagnosticPlan[];
  profiles: readonly Screen6UncertaintyProfile[];
  designSets: readonly CausalDesignSet[];
  designDecisions: readonly CausalDesignDecision[];
}) {
  if (
    input.plans.length > SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS ||
    bytes(input.plans) > SIX_SCREEN_DIAGNOSTIC_PLAN_COLLECTION_MAX_BYTES
  ) throw new Error("Stored Screen 6 diagnostic-plan history exceeds its bounded contract.");
  const ids = new Set<string>();
  const inputs = new Set<string>();
  for (const [index, plan] of input.plans.entries()) {
    if (
      plan.ordinal !== index + 1 || ids.has(plan.snapshotId) ||
      inputs.has(plan.planningInputFingerprint)
    ) throw new Error("Stored Screen 6 diagnostic-plan lineage is not unique.");
    ids.add(plan.snapshotId);
    inputs.add(plan.planningInputFingerprint);
    const profile = input.profiles.find(({ snapshotId }) =>
      snapshotId === plan.binding.profileSnapshotId);
    if (!profile) {
      throw new Error("Stored Screen 6 diagnostic plan lost its uncertainty profile.");
    }
    const designBinding = profile.binding.design;
    const designSet = designBinding
      ? input.designSets.find(({ snapshotId }) =>
          snapshotId === designBinding.designSetSnapshotId) ?? null
      : null;
    const designDecision = designBinding
      ? input.designDecisions.find(({ snapshotId }) =>
          snapshotId === designBinding.decisionSnapshotId) ?? null
      : null;
    validateScreen6DiagnosticPlan(plan, {
      profile,
      designSet,
      designDecision,
    });
  }
  return input;
}
