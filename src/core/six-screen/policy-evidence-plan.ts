import {
  SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION,
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type PolicyEvidencePlan,
  type PolicyEvidencePlanStep,
  type PolicyBriefingQualityAssessment,
  type PolicyEvidenceRequirementKind,
  type PolicyReviewFailureCode,
} from "./contracts";

export const POLICY_EVIDENCE_REQUIREMENT_KINDS = [
  "operative_change",
  "previous_baseline",
  "coverage",
  "exemption",
  "temporal_stage",
  "version",
  "implementation",
  "enforcement",
  "penalty",
] as const satisfies readonly PolicyEvidenceRequirementKind[];

export const POLICY_EVIDENCE_CORE_KINDS = [
  "operative_change",
  "temporal_stage",
  "implementation",
] as const satisfies readonly PolicyEvidenceRequirementKind[];

export const POLICY_EVIDENCE_COVERAGE_KINDS = [
  "coverage",
  "exemption",
] as const satisfies readonly PolicyEvidenceRequirementKind[];

export const POLICY_EVIDENCE_ENFORCEMENT_KINDS = [
  "enforcement",
  "penalty",
] as const satisfies readonly PolicyEvidenceRequirementKind[];

export type FederalRegisterPolicyEvidenceFocus =
  | "core"
  | "coverage_exemptions"
  | "enforcement";

export type PolicyEvidenceStepExecution =
  | {
      sourceRoute: "complementary_policy_explanations";
      focus: "introductory_context";
    }
  | {
      sourceRoute: "confirmed_federal_register_record";
      focus: FederalRegisterPolicyEvidenceFocus;
    }
  | {
      sourceRoute: "federal_register_ecfr_history";
      focus: "historical_context";
    }
  | {
      sourceRoute: "regulations_gov_docket";
      focus: "administrative_context";
    }
  | {
      sourceRoute: "confirmed_official_document";
      focus: "controlling_document";
    }
  | {
      sourceRoute: "official_document_relationships";
      focus: "related_sources";
    };

function nextStep(steps: readonly PolicyEvidencePlanStep[]) {
  const ordered = [...steps].sort((left, right) =>
    left.priority - right.priority || left.id.localeCompare(right.id, "en-US")
  );
  // An unavailable provider must not suppress an independent route. Complete
  // each untouched step before spending the plan's one bounded retry on a
  // waiting source; blocked steps are terminal only for themselves.
  return ordered.find(({ status }) => status === "not_started")?.id ??
    ordered.find(({ status }) => status === "waiting_source")?.id ?? null;
}

export function createFederalRegisterPolicyEvidencePlan(input: {
  id: string;
  identityFingerprint: string;
  documentNumber: string;
  createdAt: string;
  regulationsGovEnabled?: boolean;
}): PolicyEvidencePlan {
  requireBoundedIdentifier(input.id, "Policy evidence plan id");
  requireFingerprint(
    input.identityFingerprint,
    "Policy evidence plan identity fingerprint",
  );
  requireCanonicalInstant(input.createdAt, "Policy evidence plan createdAt");
  if (!/^\d{4}-\d{4,6}$/u.test(input.documentNumber)) {
    throw new Error("Policy evidence plan Federal Register document number is invalid.");
  }
  const steps: PolicyEvidencePlanStep[] = [
    {
      id: `explanatory-context-${input.documentNumber}`,
      label: "Independent policy explanation",
      objective:
        `Inspect the exact Federal Register record's official abstract plus bounded identity-matched explanatory or implementation pages. Retain source-attributed orientation without treating it as controlling text or a treatment date.`,
      requirementKinds: [],
      sourceRoute: "complementary_policy_explanations",
      priority: 1,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    },
    {
      id: `fr-core-${input.documentNumber}`,
      label: "Published rule and timing",
      objective:
        `Inspect the exact published representation for FR Doc. ${input.documentNumber} and retain the operative change, legal-effect stage, and implementation schedule separately.`,
      requirementKinds: [...POLICY_EVIDENCE_CORE_KINDS],
      sourceRoute: "confirmed_federal_register_record",
      priority: 2,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    },
    {
      id: `fr-coverage-${input.documentNumber}`,
      label: "Formal coverage and exemptions",
      objective:
        `Reinspect the same exact FR Doc. ${input.documentNumber} for stated organizational or activity conditions and explicit exemption or non-exemption provisions.`,
      requirementKinds: [...POLICY_EVIDENCE_COVERAGE_KINDS],
      sourceRoute: "confirmed_federal_register_record",
      priority: 3,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    },
    {
      id: `fr-enforcement-${input.documentNumber}`,
      label: "Enforcement, remedies, and sanctions",
      objective:
        `Inspect FR Doc. ${input.documentNumber} for an identified enforcing authority, remedies, and any stated penalty amount, unit, trigger, or cure process without treating an enforcement keyword as a sanction.`,
      requirementKinds: [...POLICY_EVIDENCE_ENFORCEMENT_KINDS],
      sourceRoute: "confirmed_federal_register_record",
      priority: 4,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    },
    {
      id: `fr-context-${input.documentNumber}`,
      label: "Prior baseline and historical versions",
      objective:
        "Compare date-specific eCFR text at the confirmed CFR coordinate immediately before and on the rule's legal-effective date, while retaining the contemporaneous Federal Register record as the fallback context source.",
      requirementKinds: ["previous_baseline", "version"],
      sourceRoute: "federal_register_ecfr_history",
      priority: 5,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    },
  ];
  if (input.regulationsGovEnabled) {
    const historical = steps.find(({ sourceRoute }) =>
      sourceRoute === "federal_register_ecfr_history");
    if (historical) historical.priority = 6;
    steps.push({
      id: `regulations-context-${input.documentNumber}`,
      label: "Administrative docket and stage record",
      objective:
        `Search Regulations.gov for an exact FR Doc. ${input.documentNumber} binding, inspect one exact document record, and retain only docket identity and provider-reported stage dates. Do not treat metadata as controlling legal text or evidence that implementation or enforcement occurred.`,
      requirementKinds: ["temporal_stage", "version", "implementation", "enforcement"],
      sourceRoute: "regulations_gov_docket",
      priority: 5,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: null,
    });
  }
  return {
    schemaVersion: SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION,
    id: input.id,
    identityFingerprint: input.identityFingerprint,
    documentNumber: input.documentNumber,
    jurisdiction: "United States",
    instrumentFamily: "federal_rule",
    steps,
    nextStepId: nextStep(steps),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function createOfficialDocumentPolicyEvidencePlan(input: {
  id: string;
  identityFingerprint: string;
  jurisdiction: string;
  sourceId: string;
  instrumentFamily?: "federal_statute" | "official_document";
  createdAt: string;
}): PolicyEvidencePlan {
  requireBoundedIdentifier(input.id, "Policy evidence plan id");
  requireFingerprint(
    input.identityFingerprint,
    "Policy evidence plan identity fingerprint",
  );
  requireBoundedIdentifier(input.sourceId, "Official document source id");
  requireCanonicalInstant(input.createdAt, "Policy evidence plan createdAt");
  if (!input.jurisdiction.trim() || input.jurisdiction.length > 300) {
    throw new Error("Policy evidence plan jurisdiction is invalid.");
  }
  const explanation: PolicyEvidencePlanStep = {
    id: `explanatory-context-${input.sourceId}`.slice(0, 200),
    label: "Independent policy explanation",
    objective:
      "Inspect bounded official explanations, implementation records, and appropriately attributed specialist analysis that are independently bound to the confirmed policy. Save introductory claims without using them to complete precise historical coverage, exemptions, enforcement, or treatment timing.",
    requirementKinds: [],
    sourceRoute: "complementary_policy_explanations",
    priority: 2,
    status: "not_started",
    attempts: 0,
    lastAttemptedAt: null,
    failureCode: null,
    note: null,
  };
  const step: PolicyEvidencePlanStep = {
    id: `official-document-${input.sourceId}`.slice(0, 200),
    label: "Confirmed official policy document",
    objective:
      "Acquire and inspect the confirmed controlling representation, reusing verified cached text only when adequate. Reconstruct provisions, coverage, timing, exemptions, enforcement, and sanctions independently without inferring sample exposure.",
    requirementKinds: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
    sourceRoute: "confirmed_official_document",
    priority: 1,
    status: "not_started",
    attempts: 0,
    lastAttemptedAt: null,
    failureCode: null,
    note: null,
  };
  const related: PolicyEvidencePlanStep = {
    id: `official-relationships-${input.sourceId}`.slice(0, 200),
    label: "Referenced implementation and legal-history sources",
    objective:
      "Follow a bounded set of source-native links that answer unresolved baseline, definition, exemption, commencement, enforcement, penalty, amendment, or version questions. Arbitrary crawling and guessed historical URLs are forbidden.",
    requirementKinds: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
    sourceRoute: "official_document_relationships",
    priority: 3,
    status: "not_started",
    attempts: 0,
    lastAttemptedAt: null,
    failureCode: null,
    note: null,
  };
  return {
    schemaVersion: SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION,
    id: input.id,
    identityFingerprint: input.identityFingerprint,
    documentNumber: null,
    jurisdiction: input.jurisdiction,
    instrumentFamily: input.instrumentFamily ?? "official_document",
    steps: [step, explanation, related],
    nextStepId: step.id,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function policyEvidenceFocusForStep(
  plan: PolicyEvidencePlan,
  stepId: string,
): FederalRegisterPolicyEvidenceFocus {
  const execution = policyEvidenceExecutionForStep(plan, stepId);
  if (execution.sourceRoute !== "confirmed_federal_register_record") {
    throw new Error("Policy evidence step is not available through the exact-record route.");
  }
  return execution.focus;
}

export function policyEvidenceExecutionForStep(
  plan: PolicyEvidencePlan,
  stepId: string,
): PolicyEvidenceStepExecution {
  const step = plan.steps.find(({ id }) => id === stepId);
  if (!step || step.sourceRoute === "future_official_context_routes") {
    throw new Error("Policy evidence step is not available through a tested source route.");
  }
  if (step.sourceRoute === "complementary_policy_explanations") {
    if (step.requirementKinds.length !== 0) {
      throw new Error("Complementary policy explanation step cannot complete precise evidence requirements.");
    }
    return { sourceRoute: step.sourceRoute, focus: "introductory_context" };
  }
  if (step.sourceRoute === "federal_register_ecfr_history") {
    if (
      step.requirementKinds.length !== 2 ||
      !step.requirementKinds.includes("previous_baseline") ||
      !step.requirementKinds.includes("version")
    ) {
      throw new Error("Historical policy evidence step has invalid requirements.");
    }
    return { sourceRoute: step.sourceRoute, focus: "historical_context" };
  }
  if (step.sourceRoute === "regulations_gov_docket") {
    if (
      plan.instrumentFamily !== "federal_rule" ||
      step.requirementKinds.some((kind) => ![
        "temporal_stage", "version", "implementation", "enforcement",
      ].includes(kind))
    ) {
      throw new Error("Regulations.gov policy evidence step has invalid requirements.");
    }
    return { sourceRoute: step.sourceRoute, focus: "administrative_context" };
  }
  if (step.sourceRoute === "confirmed_official_document") {
    if (
      (plan.instrumentFamily !== "official_document" &&
        plan.instrumentFamily !== "federal_statute") ||
      step.requirementKinds.some((kind) =>
        !POLICY_EVIDENCE_REQUIREMENT_KINDS.includes(kind)
      )
    ) {
      throw new Error("Official-document policy evidence step has invalid requirements.");
    }
    return { sourceRoute: step.sourceRoute, focus: "controlling_document" };
  }
  if (step.sourceRoute === "official_document_relationships") {
    if (
      (plan.instrumentFamily !== "official_document" &&
        plan.instrumentFamily !== "federal_statute") ||
      step.requirementKinds.some((kind) =>
        !POLICY_EVIDENCE_REQUIREMENT_KINDS.includes(kind)
      )
    ) {
      throw new Error("Official relationship evidence step has invalid requirements.");
    }
    return { sourceRoute: step.sourceRoute, focus: "related_sources" };
  }
  if (step.requirementKinds.every((kind) =>
    POLICY_EVIDENCE_CORE_KINDS.includes(
      kind as (typeof POLICY_EVIDENCE_CORE_KINDS)[number],
    ))) return { sourceRoute: step.sourceRoute, focus: "core" };
  if (step.requirementKinds.every((kind) =>
    POLICY_EVIDENCE_COVERAGE_KINDS.includes(
      kind as (typeof POLICY_EVIDENCE_COVERAGE_KINDS)[number],
    ))) return { sourceRoute: step.sourceRoute, focus: "coverage_exemptions" };
  if (step.requirementKinds.every((kind) =>
    POLICY_EVIDENCE_ENFORCEMENT_KINDS.includes(
      kind as (typeof POLICY_EVIDENCE_ENFORCEMENT_KINDS)[number],
    ))) return { sourceRoute: step.sourceRoute, focus: "enforcement" };
  throw new Error("Policy evidence step has no bounded parser focus.");
}

/**
 * Older saved v1 plans intentionally blocked this step before the eCFR route
 * existed. Expose that exact saved step through the tested route without
 * changing any completed attempt or creating a new research budget.
 */
export function activateHistoricalPolicyEvidencePlan(
  current: PolicyEvidencePlan,
  options: { regulationsGovEnabled?: boolean } = {},
) {
  const plan = structuredClone(current);
  // v0.5.2 plans did not represent enforcement or penalties and official
  // documents ended after the cached identity excerpt. Upgrade only the plan;
  // completed attempts and stored evidence remain immutable.
  const covered = new Set(plan.steps.flatMap(({ requirementKinds }) =>
    requirementKinds));
  if (!plan.steps.some(({ sourceRoute }) =>
    sourceRoute === "complementary_policy_explanations")) {
    for (const step of plan.steps) step.priority += 1;
    const anchor = plan.documentNumber ??
      plan.steps.find(({ sourceRoute }) =>
        sourceRoute === "confirmed_official_document")?.id ?? plan.id;
    plan.steps.push({
      id: `explanatory-context-${anchor}`.slice(0, 200),
      label: "Independent policy explanation",
      objective:
        "Inspect bounded official explanations, implementation records, and appropriately attributed specialist analysis independently of controlling-document parsing. These contextual claims cannot complete precise historical coverage, exemptions, enforcement, or treatment timing.",
      requirementKinds: [],
      sourceRoute: "complementary_policy_explanations",
      priority: 1,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note:
        "Added by the complementary-evidence plan migration; prior saved evidence and completed attempts are unchanged.",
    });
  }
  if (plan.instrumentFamily === "federal_rule") {
    const anchor = plan.documentNumber ?? "record";
    if (!covered.has("enforcement") || !covered.has("penalty")) {
      plan.steps.push({
        id: `fr-enforcement-${anchor}`,
        label: "Enforcement, remedies, and sanctions",
        objective:
          `Inspect the confirmed publication for enforcement authority, remedies, and stated sanctions without inferring them from generic enforcement language.`,
        requirementKinds: [...POLICY_EVIDENCE_ENFORCEMENT_KINDS],
        sourceRoute: "confirmed_federal_register_record",
        priority: 4,
        status: "not_started",
        attempts: 0,
        lastAttemptedAt: null,
        failureCode: null,
        note: "Added by the v0.6 evidence-plan migration; prior saved evidence is unchanged.",
      });
      const context = plan.steps.find((step) =>
        step.sourceRoute === "federal_register_ecfr_history" ||
        step.sourceRoute === "future_official_context_routes");
      if (context) context.priority = Math.max(context.priority, 5);
    }
    if (
      options.regulationsGovEnabled &&
      !plan.steps.some(({ sourceRoute }) =>
        sourceRoute === "regulations_gov_docket")
    ) {
      const historical = plan.steps.find(({ sourceRoute }) =>
        sourceRoute === "federal_register_ecfr_history" ||
        sourceRoute === "future_official_context_routes");
      if (historical) historical.priority = Math.max(historical.priority, 6);
      plan.steps.push({
        id: `regulations-context-${anchor}`,
        label: "Administrative docket and stage record",
        objective:
          `Search Regulations.gov for an exact FR Doc. ${anchor} binding and retain bounded docket identity and stage metadata without substituting it for controlling legal text.`,
        requirementKinds: [
          "temporal_stage", "version", "implementation", "enforcement",
        ],
        sourceRoute: "regulations_gov_docket",
        priority: 5,
        status: "not_started",
        attempts: 0,
        lastAttemptedAt: null,
        failureCode: null,
        note:
          "Added by the credential-aware v0.6 evidence-plan migration; prior saved evidence is unchanged.",
      });
    }
  } else if (!plan.steps.some(({ sourceRoute }) =>
    sourceRoute === "official_document_relationships")) {
    const controlling = plan.steps.find(({ sourceRoute }) =>
      sourceRoute === "confirmed_official_document");
    const sourceCoordinate = controlling?.id ?? plan.id;
    if (controlling) controlling.requirementKinds = [...new Set([
      ...controlling.requirementKinds,
      "enforcement" as const,
      "penalty" as const,
    ])];
    plan.steps.push({
      id: `official-relationships-${sourceCoordinate}`.slice(0, 200),
      label: "Referenced implementation and legal-history sources",
      objective:
        "Follow bounded source-native relationships for unresolved definitions, commencement, enforcement, sanctions, amendments, and historical versions.",
      requirementKinds: [
        "previous_baseline",
        "version",
        "exemption",
        "implementation",
        "enforcement",
        "penalty",
      ],
      sourceRoute: "official_document_relationships",
      priority: 3,
      status: "not_started",
      attempts: 0,
      lastAttemptedAt: null,
      failureCode: null,
      note: "Added by the v0.6 evidence-plan migration; prior saved evidence is unchanged.",
    });
  }
  const legacy = plan.steps.find((step) =>
    step.sourceRoute === "future_official_context_routes" &&
    step.requirementKinds.length === 2 &&
    step.requirementKinds.includes("previous_baseline") &&
    step.requirementKinds.includes("version") &&
    step.status === "blocked" &&
    step.attempts === 0 &&
    step.lastAttemptedAt === null &&
    step.failureCode === null
  );
  if (legacy) {
    legacy.sourceRoute = "federal_register_ecfr_history";
    legacy.status = "not_started";
    legacy.note =
      "This saved step is now available through a bounded, date-specific eCFR comparison. Current text is never substituted for the requested historical dates.";
  }
  plan.nextStepId = nextStep(plan.steps);
  validatePolicyEvidencePlan(plan);
  return plan;
}

export function recordPolicyEvidencePlanAttempt(
  current: PolicyEvidencePlan,
  input: {
    stepId: string;
    attemptedAt: string;
    outcome: "searched" | "waiting_source" | "blocked";
    failureCode: PolicyReviewFailureCode | null;
    note: string | null;
  },
) {
  const plan = structuredClone(current);
  requireCanonicalInstant(input.attemptedAt, "Policy evidence step attemptedAt");
  const step = plan.steps.find(({ id }) => id === input.stepId);
  if (!step || step.sourceRoute === "future_official_context_routes") {
    throw new Error("Policy evidence plan cannot advance an unknown or unavailable step.");
  }
  if (
    step.status === "searched" || step.status === "not_needed" ||
    step.status === "blocked"
  ) {
    throw new Error(`Policy evidence step is already ${step.status}.`);
  }
  step.attempts += 1;
  step.lastAttemptedAt = input.attemptedAt;
  step.failureCode = input.failureCode;
  step.note = input.note;
  step.status = input.outcome === "waiting_source" && step.attempts >= 2
    ? "blocked"
    : input.outcome;
  if (step.status === "blocked" && input.outcome === "waiting_source") {
    step.note = input.note
      ? `${input.note} The single bounded retry was exhausted.`
      : "The single bounded retry was exhausted.";
  }
  plan.updatedAt = input.attemptedAt;
  plan.nextStepId = nextStep(plan.steps);
  validatePolicyEvidencePlan(plan);
  return plan;
}

export function validatePolicyEvidencePlan(plan: PolicyEvidencePlan) {
  if (plan.schemaVersion !== SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION) {
    throw new Error("Policy evidence plan schema version is unsupported.");
  }
  requireBoundedIdentifier(plan.id, "Policy evidence plan id");
  requireFingerprint(plan.identityFingerprint, "Policy evidence plan identity fingerprint");
  requireCanonicalInstant(plan.createdAt, "Policy evidence plan createdAt");
  requireCanonicalInstant(plan.updatedAt, "Policy evidence plan updatedAt");
  if (
    plan.instrumentFamily === "federal_rule" &&
    (plan.jurisdiction !== "United States" ||
      !plan.documentNumber ||
      !/^\d{4}-\d{4,6}$/u.test(plan.documentNumber))
  ) {
    throw new Error("Federal policy evidence plan coordinates are invalid.");
  }
  if (
    (plan.instrumentFamily === "official_document" ||
      plan.instrumentFamily === "federal_statute") &&
    (plan.documentNumber !== null || !plan.jurisdiction.trim())
  ) {
    throw new Error("Official-document policy evidence plan coordinates are invalid.");
  }
  if (!plan.steps.length || new Set(plan.steps.map(({ id }) => id)).size !== plan.steps.length) {
    throw new Error("Policy evidence plan requires unique steps.");
  }
  const coveredKinds = new Set<PolicyEvidenceRequirementKind>();
  for (const step of plan.steps) {
    requireBoundedIdentifier(step.id, "Policy evidence step id");
    if (!step.label.trim() || !step.objective.trim()) {
      throw new Error("Policy evidence steps require a label and objective.");
    }
    if (!Number.isSafeInteger(step.priority) || step.priority < 1) {
      throw new Error("Policy evidence step priority is invalid.");
    }
    if (!Number.isSafeInteger(step.attempts) || step.attempts < 0) {
      throw new Error("Policy evidence step attempt count is invalid.");
    }
    if ((step.lastAttemptedAt === null) !== (step.attempts === 0)) {
      throw new Error("Policy evidence step attempts do not match its timestamp.");
    }
    if (
      step.sourceRoute === "future_official_context_routes" &&
      (step.status !== "blocked" || step.attempts !== 0)
    ) {
      throw new Error("An unimplemented policy evidence route must remain blocked and unattempted.");
    }
    if (step.lastAttemptedAt) {
      requireCanonicalInstant(step.lastAttemptedAt, "Policy evidence step attemptedAt");
    }
    for (const kind of step.requirementKinds) coveredKinds.add(kind);
    if (step.status === "not_started" && (step.attempts || step.failureCode)) {
      throw new Error("An unstarted policy evidence step cannot report an attempt.");
    }
    if (step.status === "searched" && step.failureCode) {
      throw new Error("A searched policy evidence step cannot report a failure.");
    }
    if (
      step.status === "not_needed" &&
      (step.attempts !== 0 || step.lastAttemptedAt !== null ||
        step.failureCode !== null || !step.note)
    ) {
      throw new Error("A not-needed policy evidence step must explain an unattempted adaptive skip.");
    }
    if (
      (step.status === "waiting_source" ||
        (step.status === "blocked" && step.attempts > 0)) &&
      !step.failureCode
    ) {
      throw new Error("A failed policy evidence step requires a failure code.");
    }
  }
  if (POLICY_EVIDENCE_REQUIREMENT_KINDS.some((kind) => !coveredKinds.has(kind))) {
    throw new Error("Policy evidence plan omits a required evidence category.");
  }
  if (plan.nextStepId !== nextStep(plan.steps)) {
    throw new Error("Policy evidence plan next step is inconsistent with its saved steps.");
  }
  return plan;
}

/**
 * Route only the evidence gaps that remain after a completed source step.
 * This does not change retained claims or mark an unsearched source as
 * searched. It records an explicit, auditable `not_needed` decision instead.
 */
export function adaptPolicyEvidencePlanToBriefingQuality(
  current: PolicyEvidencePlan,
  input: {
    quality: PolicyBriefingQualityAssessment;
    updatedAt: string;
  },
) {
  const plan = structuredClone(current);
  requireCanonicalInstant(input.updatedAt, "Adaptive policy evidence plan updatedAt");
  if (plan.instrumentFamily === "federal_rule") return plan;

  const overview = input.quality.boxes.find(({ box }) => box === "overview");
  const explanation = plan.steps.find(({ sourceRoute }) =>
    sourceRoute === "complementary_policy_explanations");
  if (explanation?.status === "not_started" &&
      overview?.status === "sufficient") {
    explanation.status = "not_needed";
    explanation.note =
      "The controlling source already supplied a sufficient policy overview, so an additional explanatory page was not requested.";
  }

  const related = plan.steps.find(({ sourceRoute }) =>
    sourceRoute === "official_document_relationships");
  if (related?.status === "not_started") {
    if (!input.quality.requiresAdditionalSources) {
      related.status = "not_needed";
      related.note =
        "Every Screen 2 information box met its source-evidence standard, so no additional related source was requested.";
    } else {
      const missingKinds = new Set(input.quality.boxes.flatMap(
        ({ missingRequirementKinds }) => missingRequirementKinds,
      ));
      const focusedKinds = related.requirementKinds.filter((kind) =>
        missingKinds.has(kind));
      if (focusedKinds.length) {
        related.requirementKinds = focusedKinds;
        related.note =
          `Adaptive retrieval is limited to unresolved ${focusedKinds.join(", ").replaceAll("_", " ")} evidence.`;
      }
    }
  }
  plan.updatedAt = input.updatedAt;
  plan.nextStepId = nextStep(plan.steps);
  validatePolicyEvidencePlan(plan);
  return plan;
}
