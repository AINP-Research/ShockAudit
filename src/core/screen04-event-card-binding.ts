import {
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "./screen02-workflow-handoff";
import {
  fingerprintScreen03Value,
  requireScreen03VerificationState,
  type Screen03LockedAcceptedProposal,
  type Screen03LockedTimelineEntry,
} from "./screen03-workflow";

export const SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION =
  "screen-03-to-screen-04-event-card-v2" as const;

export const SCREEN_04_EXPOSURE_DIMENSION_KINDS = [
  "geography",
  "organization-type",
  "threshold",
  "exemption",
  "implementation-stage",
  "treatment-component",
  "amendment-version",
] as const;

export type Screen04ExposureDimensionKind =
  (typeof SCREEN_04_EXPOSURE_DIMENSION_KINDS)[number];

/**
 * A bounded reader-facing projection of the locked Event Card. Claim and
 * evidence identifiers remain available only for integrity and audit tests;
 * ordinary Screen 4 controls render the label and summary.
 */
export type Screen04ExposureDimension = {
  id: `screen04-exposure-${Screen04ExposureDimensionKind}`;
  kind: Screen04ExposureDimensionKind;
  label: string;
  summary: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
};

export type Screen04BoundEventCardClaim = {
  proposalId: string;
  label: string;
  resolvedValue: string;
  sourceIds: readonly string[];
  passageIds: readonly string[];
};

export type Screen04EventCardBinding = {
  schemaVersion: typeof SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION;
  screen02: {
    runId: string;
    mode: "find" | "audit";
    selectedEventId: string;
    selectedEventFingerprint: string;
    handoffFingerprint: string;
  };
  screen03: {
    runId: string;
    stateFingerprint: string;
  };
  eventCard: {
    id: string;
    version: string;
    fingerprint: string;
    lockedAt: string;
  };
  verifiedShockName: string;
  verifiedTimeline: readonly Screen03LockedTimelineEntry[];
  focalClock: {
    selected: Screen03LockedTimelineEntry | null;
    alternatives: readonly Screen03LockedTimelineEntry[];
  };
  assignmentUnit: readonly Screen04BoundEventCardClaim[];
  geographicCoverage: readonly Screen04BoundEventCardClaim[];
  eligibilityConditions: readonly Screen04BoundEventCardClaim[];
  thresholds: readonly Screen04BoundEventCardClaim[];
  exemptions: readonly Screen04BoundEventCardClaim[];
  treatmentComponents: readonly Screen04BoundEventCardClaim[];
  amendmentsAndVersions: readonly Screen04BoundEventCardClaim[];
  exposureDimensions: readonly Screen04ExposureDimension[];
  unresolvedLimitations: {
    gaps: readonly string[];
    unknownProposalIds: readonly string[];
    rejectedProposalIds: readonly string[];
    unsupportedProposalIds: readonly string[];
    uncertainties: readonly { proposalId: string; note: string }[];
  };
  compilerLimitations: readonly {
    code:
      | "SCREEN04_ASSIGNMENT_UNIT_NOT_MACHINE_TYPED"
      | "SCREEN04_GEOGRAPHIC_RULE_NOT_MACHINE_TYPED"
      | "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED"
      | "SCREEN04_EXEMPTION_RULE_NOT_MACHINE_TYPED";
    message: string;
  }[];
  linkedEvidenceIds: readonly string[];
  bindingFingerprint: string;
};

export type Screen04EntryGateResult =
  | {
      ready: false;
      code: "SCREEN04_EVENT_CARD_NOT_LOCKED" | "SCREEN04_BINDING_INVALID";
      title: "Finish verifying the shock first";
      message: string;
    }
  | { ready: true; binding: Screen04EventCardBinding };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function structuralHandoff(value: unknown): Screen02WorkflowHandoff {
  return JSON.parse(serializeScreen02WorkflowHandoff(value)) as Screen02WorkflowHandoff;
}

function claim(proposal: Screen03LockedAcceptedProposal): Screen04BoundEventCardClaim {
  return {
    proposalId: proposal.id,
    label: proposal.label,
    resolvedValue: proposal.resolvedValue,
    sourceIds: [...proposal.sourceIds],
    passageIds: [...proposal.passageIds],
  };
}

function verifiedName(
  canonicalTitle: string | null,
  formalIdentifier: string | null,
  provisionalTitle: string,
): string {
  return canonicalTitle ?? formalIdentifier ?? provisionalTitle;
}

const dimensionLabels: Record<Screen04ExposureDimensionKind, string> = {
  geography: "Geographic coverage",
  "organization-type": "Eligible organization type",
  threshold: "Threshold or qualifying condition",
  exemption: "Exemption",
  "implementation-stage": "Implementation stage",
  "treatment-component": "Treatment component",
  "amendment-version": "Amendment or version",
};

function normalizedClaimText(claimValue: Screen04BoundEventCardClaim): string {
  return `${claimValue.label} ${claimValue.resolvedValue}`
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ")
    .trim();
}

function eligibilityDimensions(
  claimValue: Screen04BoundEventCardClaim,
): Array<Exclude<
  Screen04ExposureDimensionKind,
  "implementation-stage" | "treatment-component" | "amendment-version"
>> {
  const text = normalizedClaimText(claimValue);
  const dimensions: Array<Exclude<
    Screen04ExposureDimensionKind,
    "implementation-stage" | "treatment-component" | "amendment-version"
  >> = [];
  if (
    /\b(geograph|jurisdiction|location|located|headquarter|incorporat|residen|establishment|facilit|operat(?:e|es|ing|ion)|doing business|state|country|province|territor|california)\b/iu.test(
      text,
    )
  ) {
    dimensions.push("geography");
  }
  if (
    /\b(business(?:es)?|compan(?:y|ies)|firms?|entit(?:y|ies)|organizations?|corporations?|nonprofits?|employers?|controllers?|processors?)\b/iu.test(
      text,
    )
  ) {
    dimensions.push("organization-type");
  }
  if (
    /\b(threshold|revenue|turnover|sales|assets?|employees?|workers?|records?|consumers?|customers?|percent|percentage|annual receipts?|public float|market capitalization|at least|more than|less than|greater than|\$|€|£)\b/iu.test(
      text,
    )
  ) {
    dimensions.push("threshold");
  }
  if (/\b(exempt|exemption|except|exclude|excluded|carve[- ]?out)\b/iu.test(text)) {
    dimensions.push("exemption");
  }
  return dimensions.length > 0 ? Array.from(new Set(dimensions)) : [
    "organization-type",
  ];
}

function uniqueClaims(
  claims: readonly Screen04BoundEventCardClaim[],
): Screen04BoundEventCardClaim[] {
  const seen = new Set<string>();
  return claims.filter((claimValue) => {
    const key = claimValue.resolvedValue
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/\s+/gu, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dimensionSummary(
  kind: Screen04ExposureDimensionKind,
  claims: readonly Screen04BoundEventCardClaim[],
): string {
  if (kind === "implementation-stage") {
    return "Verified dates describe when different stages of the shock occurred.";
  }
  if (kind === "treatment-component") {
    return `${claims.length} verified treatment component${claims.length === 1 ? "" : "s"} may need a distinct sample representation.`;
  }
  if (kind === "amendment-version") {
    return `${claims.length} verified amendment or version${claims.length === 1 ? "" : "s"} may change exposure over time.`;
  }
  if (claims.length === 0) {
    return dimensionLabels[kind];
  }
  const values = uniqueClaims(claims).map((claimValue) => claimValue.resolvedValue);
  const shown = values.slice(0, 2);
  const suffix = values.length > shown.length
    ? `; plus ${values.length - shown.length} related verified condition${values.length - shown.length === 1 ? "" : "s"}`
    : "";
  return `${shown.join("; ")}${suffix}`.slice(0, 600);
}

function exposureDimensions(input: {
  eligibility: readonly Screen04BoundEventCardClaim[];
  timeline: readonly Screen03LockedTimelineEntry[];
  components: readonly Screen04BoundEventCardClaim[];
  amendments: readonly Screen04BoundEventCardClaim[];
}): Screen04ExposureDimension[] {
  const grouped = new Map<
    Screen04ExposureDimensionKind,
    Screen04BoundEventCardClaim[]
  >();
  for (const claimValue of input.eligibility) {
    for (const kind of eligibilityDimensions(claimValue)) {
      grouped.set(kind, [...(grouped.get(kind) ?? []), claimValue]);
    }
  }
  if (input.timeline.length > 0) grouped.set("implementation-stage", []);
  if (input.components.length > 0) {
    grouped.set("treatment-component", [...input.components]);
  }
  if (input.amendments.length > 0) {
    grouped.set("amendment-version", [...input.amendments]);
  }
  return SCREEN_04_EXPOSURE_DIMENSION_KINDS.flatMap((kind) => {
    const claims = grouped.get(kind);
    if (!claims) return [];
    const unique = uniqueClaims(claims);
    return [{
      id: `screen04-exposure-${kind}` as const,
      kind,
      label: dimensionLabels[kind],
      summary: dimensionSummary(kind, unique),
      claimIds: unique.map((claimValue) => claimValue.proposalId),
      evidenceIds: Array.from(
        new Set(unique.flatMap((claimValue) => claimValue.sourceIds)),
      ),
    }];
  });
}

/**
 * Compile a Screen 4 binding only from the structurally valid exact Screen 2
 * handoff and the fingerprint-valid locked Screen 3 state.
 */
export function compileScreen04EventCardBinding(
  screen03Value: unknown,
  screen02HandoffValue: unknown,
): Screen04EventCardBinding {
  const screen03 = requireScreen03VerificationState(screen03Value);
  const handoff = structuralHandoff(screen02HandoffValue);
  if (screen03.status !== "locked" || screen03.lockedEventCard === null) {
    throw new Error("Screen 4 requires a locked Screen 3 Event Card.");
  }
  if (
    screen03.upstream.runId !== handoff.runId ||
    screen03.upstream.eventFingerprint !== handoff.integrity.eventFingerprint ||
    screen03.upstream.handoffFingerprint !== handoff.integrity.handoffFingerprint
  ) {
    throw new Error(
      "Screen 2 and Screen 3 identities do not match exactly; Screen 4 binding was refused.",
    );
  }
  const card = screen03.lockedEventCard;
  const eligibility = card.acceptedProposals.eligibility.map(claim);
  const components = card.acceptedProposals.component.map(claim);
  const amendments = card.acceptedProposals.amendment.map(claim);
  const categorizedEligibility = {
    geography: eligibility.filter(
      (claimValue) => eligibilityDimensions(claimValue).includes("geography"),
    ),
    organizationType: eligibility.filter(
      (claimValue) =>
        eligibilityDimensions(claimValue).includes("organization-type"),
    ),
    threshold: eligibility.filter(
      (claimValue) => eligibilityDimensions(claimValue).includes("threshold"),
    ),
    exemption: eligibility.filter(
      (claimValue) => eligibilityDimensions(claimValue).includes("exemption"),
    ),
  };
  const bindingWithoutFingerprint = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: handoff.runId,
      mode: handoff.mode,
      selectedEventId: handoff.event.identitySnapshotId,
      selectedEventFingerprint: handoff.integrity.eventFingerprint,
      handoffFingerprint: handoff.integrity.handoffFingerprint,
    },
    screen03: {
      runId: screen03.runId,
      stateFingerprint: screen03.integrity.stateFingerprint,
    },
    eventCard: {
      id: `screen03:${screen03.runId}:event-card`,
      version: `locked-at:${card.lockedAt}`,
      fingerprint: card.eventCardFingerprint,
      lockedAt: card.lockedAt,
    },
    verifiedShockName: verifiedName(
      card.eventIdentity.canonicalTitle,
      card.eventIdentity.formalIdentifier,
      handoff.event.identity.canonicalTitle,
    ),
    verifiedTimeline: clone(card.timeline),
    focalClock: clone(card.focalClock),
    // Screen 3 v1 stores these semantics as reviewed prose, not executable
    // typed fields. Never infer a rule from labels or wording.
    assignmentUnit: [],
    geographicCoverage: categorizedEligibility.geography,
    eligibilityConditions: categorizedEligibility.organizationType,
    thresholds: categorizedEligibility.threshold,
    exemptions: categorizedEligibility.exemption,
    treatmentComponents: components,
    amendmentsAndVersions: amendments,
    exposureDimensions: exposureDimensions({
      eligibility,
      timeline: card.timeline,
      components,
      amendments,
    }),
    unresolvedLimitations: clone(card.limitations),
    compilerLimitations: [
      {
        code: "SCREEN04_ASSIGNMENT_UNIT_NOT_MACHINE_TYPED" as const,
        message:
          "The locked Screen 3 contract has no machine-typed assignment-unit field. A researcher-confirmed typed rule is required before assignment-unit checks can execute.",
      },
      {
        code: "SCREEN04_GEOGRAPHIC_RULE_NOT_MACHINE_TYPED" as const,
        message:
          "The locked Screen 3 contract has no machine-typed geographic exposure rule. Screen 4 will not infer one from reviewed prose.",
      },
      {
        code: "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED" as const,
        message:
          "The locked Screen 3 contract has no machine-typed threshold operator, value, unit, or historical measurement date.",
      },
      {
        code: "SCREEN04_EXEMPTION_RULE_NOT_MACHINE_TYPED" as const,
        message:
          "The locked Screen 3 contract has no machine-typed exemption precedence rule.",
      },
    ],
    linkedEvidenceIds: card.linkedEvidence.map((item) => item.id),
  };
  const binding: Screen04EventCardBinding = {
    ...bindingWithoutFingerprint,
    bindingFingerprint: fingerprintScreen03Value(bindingWithoutFingerprint),
  };
  return clone(binding);
}

export function screen04EntryGate(
  screen03Value: unknown,
  screen02HandoffValue: unknown,
): Screen04EntryGateResult {
  try {
    const screen03 = requireScreen03VerificationState(screen03Value);
    if (screen03.status !== "locked" || screen03.lockedEventCard === null) {
      return {
        ready: false,
        code: "SCREEN04_EVENT_CARD_NOT_LOCKED",
        title: "Finish verifying the shock first",
        message:
          "Resolve all visible factual claims and lock the Event Card before auditing exposure in your sample.",
      };
    }
    return {
      ready: true,
      binding: compileScreen04EventCardBinding(screen03, screen02HandoffValue),
    };
  } catch {
    return {
      ready: false,
      code: "SCREEN04_BINDING_INVALID",
      title: "Finish verifying the shock first",
      message:
        "The Screen 3 state and selected event did not pass exact identity and fingerprint validation.",
    };
  }
}

export function screen04EventCardBindingIsCurrent(
  binding: Screen04EventCardBinding,
  current: Screen04EventCardBinding,
): boolean {
  return (
    binding.screen02.runId === current.screen02.runId &&
    binding.screen02.selectedEventId === current.screen02.selectedEventId &&
    binding.screen02.selectedEventFingerprint ===
      current.screen02.selectedEventFingerprint &&
    binding.screen03.runId === current.screen03.runId &&
    binding.screen02.handoffFingerprint === current.screen02.handoffFingerprint &&
    binding.eventCard.fingerprint === current.eventCard.fingerprint
  );
}
