import type {
  Screen03AnyProposal,
  Screen03EvidenceItem,
  Screen03ProposalGroups,
  Screen03SupportStatus,
  Screen03TimelineProposal,
} from "../core/screen03-workflow";
import { screen03ProposalConfirmability } from "../core/screen03-workflow";
import {
  screen03ClaimQualityScore,
  screen03ClaimsAreEquivalent,
  screen03ClaimsHaveMaterialDifference,
  screen03ClaimToken,
  screen03MaterialInvariantClaimToken,
} from "./screen03-claim-quality";
import { screen03EvidenceSourceRole } from "./screen03-evidence-synthesis";

export type Screen03SourceFusionConflict = {
  representativeProposalId: string;
  group: Exclude<Screen03AnyProposal["group"], "required-variable">;
  summary: string;
};

export type Screen03SourceFusionResult = {
  proposals: Screen03ProposalGroups;
  conflicts: Screen03SourceFusionConflict[];
};

function supportRank(value: Screen03SupportStatus) {
  switch (value) {
    case "direct":
      return 4;
    case "conflicting":
      return 3;
    case "indirect":
      return 2;
    case "unsupported":
      return 1;
  }
}

function evidenceRoleRank(item: Screen03EvidenceItem) {
  switch (screen03EvidenceSourceRole(item)) {
    case "controlling-legal-record":
      return 7;
    case "official-publication-record":
      return 6;
    case "administrative-declaration-record":
    case "scientific-hazard-record":
      return 5;
    case "official-record":
      return 4;
    case "institutional-hazard-record":
      return 3;
    case "related-official-record":
      return 2;
    case "precursor-official-record":
    case "related-secondary-record":
    case "researcher-supplied-record":
      return 1;
  }
}

function directPassageSupports(
  proposal: Screen03AnyProposal,
  evidenceById: ReadonlyMap<string, Screen03EvidenceItem>,
) {
  const result = screen03ProposalConfirmability(
    proposal,
    [...evidenceById.values()],
  );
  return result.confirmable || result.reason === "incomplete-component";
}

function selectedIdentityEvidenceIds(
  proposals: Screen03ProposalGroups,
  evidenceById: ReadonlyMap<string, Screen03EvidenceItem>,
) {
  const supported = proposals.identity.filter(
    (proposal) => proposal.support !== "unsupported",
  );
  const formal = supported.filter((proposal) =>
    /^formal identifier$/iu.test(proposal.label.trim())
  );
  const candidates = (formal.length > 0
    ? formal
    : supported.filter((proposal) =>
        /^(?:canonical event title|issuer|issuing jurisdiction)$/iu.test(
          proposal.label.trim(),
        )
      )).flatMap((proposal) => proposal.sourceIds);
  return new Set(candidates.filter((sourceId) => {
    const item = evidenceById.get(sourceId);
    return item !== undefined &&
      ![
        "related-official-record",
        "precursor-official-record",
        "related-secondary-record",
      ].includes(screen03EvidenceSourceRole(item));
  }));
}

function representativeScore(
  proposal: Screen03AnyProposal,
  evidenceById: ReadonlyMap<string, Screen03EvidenceItem>,
  selectedEvidenceIds: ReadonlySet<string>,
) {
  const owners = proposal.sourceIds
    .map((sourceId) => evidenceById.get(sourceId))
    .filter((item): item is Screen03EvidenceItem => Boolean(item))
    .filter((item) => item.status !== "changed");
  const identityGrounding = owners.some((item) =>
      selectedEvidenceIds.has(item.id)
    )
    ? 20_000
    : owners.some(
        (item) => screen03EvidenceSourceRole(item) === "related-official-record",
      )
      ? 2_000
      : 0;
  const directness = supportRank(proposal.support) * 2_000 +
    (directPassageSupports(proposal, evidenceById) ? 1_500 : 0);
  const authority = owners.reduce(
    (best, item) => Math.max(
      best,
      (7 - item.authorityTier) * 300 + evidenceRoleRank(item) * 40,
    ),
    0,
  );
  const status = owners.some((item) => item.status === "carried") ? 60 : 0;
  const specificity = Math.max(-500, screen03ClaimQualityScore(proposal.value));
  return identityGrounding + directness + authority + status + specificity;
}

function bestSupport(proposals: readonly Screen03AnyProposal[]) {
  return [...proposals]
    .sort((left, right) => supportRank(right.support) - supportRank(left.support))[0]!
    .support;
}

function mergeEquivalentReferences(
  preferred: Screen03AnyProposal,
  equivalent: readonly Screen03AnyProposal[],
) {
  const exactValue = equivalent.every((proposal) =>
    proposal.value === preferred.value
  );
  if (!exactValue) {
    return {
      ...preferred,
      critical: equivalent.some((proposal) => proposal.critical),
    } as Screen03AnyProposal;
  }
  const direct = equivalent.filter((proposal) => proposal.support === "direct");
  const referenced = direct.length > 0 ? direct : equivalent;
  return {
    ...preferred,
    critical: equivalent.some((proposal) => proposal.critical),
    support: bestSupport(equivalent),
    sourceIds: [...new Set(referenced.flatMap((proposal) => proposal.sourceIds))],
    passageIds: [...new Set(referenced.flatMap((proposal) => proposal.passageIds))],
    uncertainty:
      preferred.uncertainty ??
      equivalent.find((proposal) => proposal.uncertainty)?.uncertainty ??
      null,
  } as Screen03AnyProposal;
}

function timelineMilestoneType(proposal: Screen03TimelineProposal) {
  const text = screen03ClaimToken(
    `${proposal.label} ${proposal.uncertainty ?? ""}`,
  );
  if (/\b(?:amend|delay|extend|extension|deadline|postpon|repeal|supersed)\w*\b/u.test(text)) {
    return "amendment";
  }
  if (/\b(?:enforc|penalt|sanction|inspection)\w*\b/u.test(text)) {
    return "enforcement";
  }
  if (/\b(?:effective|application|operative|in force|commenc)\w*\b/u.test(text)) {
    return "effective";
  }
  if (/\b(?:enact|adopt|assent|sign)\w*\b/u.test(text)) return "enactment";
  if (/\b(?:implement|compliance|phase|rollout)\w*\b/u.test(text)) {
    return "implementation";
  }
  if (/\b(?:occurrence|incident|origin|landfall|earthquake)\w*\b/u.test(text)) {
    return "occurrence";
  }
  if (
    ["announcement", "rulemaking"].includes(proposal.stage) &&
    /\b(?:announc|notice|publication|public discussion)\w*\b/u.test(text)
  ) {
    return "public-notice";
  }
  return proposal.stage;
}

function timelineSemanticLabel(proposal: Screen03TimelineProposal) {
  const boilerplate = new Set([
    "application",
    "announcement",
    "commencement",
    "date",
    "effective",
    "enactment",
    "enforcement",
    "discussion",
    "document",
    "initial",
    "lead",
    "milestone",
    "notice",
    "operative",
    "or",
    "publication",
    "public",
    "reported",
    "rulemaking",
    "signing",
    "start",
  ]);
  return screen03ClaimToken(proposal.label)
    .split(" ")
    .filter((token) => !boilerplate.has(token))
    .join(" ");
}

function timelineScope(proposal: Screen03TimelineProposal) {
  const tokens = screen03ClaimToken(
    `${proposal.label} ${proposal.uncertainty ?? ""}`,
  ).split(" ").filter(Boolean);
  const anchors = /^(?:small|large|business|businesses|entity|entities|phase|group|class|threshold|before|after)$/u;
  const qualifier = /^(?:\d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/u;
  return tokens
    .filter((token, index) =>
      anchors.test(token) ||
      (
        qualifier.test(token) &&
        (anchors.test(tokens[index - 1] ?? "") ||
          anchors.test(tokens[index + 1] ?? ""))
      )
    )
    .join(" ");
}

function timelineSemanticScope(proposal: Screen03TimelineProposal) {
  return [timelineSemanticLabel(proposal), timelineScope(proposal)]
    .filter(Boolean)
    .join(" ");
}

function equivalentFact(
  left: Screen03AnyProposal,
  right: Screen03AnyProposal,
) {
  if (left.group !== right.group) return false;
  if (left.group === "timeline" && right.group === "timeline") {
    if (
      left.date !== right.date ||
      timelineMilestoneType(left) !== timelineMilestoneType(right)
    ) {
      return false;
    }
    const leftScope = timelineSemanticScope(left);
    const rightScope = timelineSemanticScope(right);
    const labelsCompatible = leftScope === rightScope ||
      (
        leftScope.length > 0 &&
        rightScope.length > 0 &&
        screen03ClaimsAreEquivalent(leftScope, rightScope)
      );
    return labelsCompatible;
  }
  if (left.group === "identity" && right.group === "identity") {
    return screen03ClaimToken(left.label) === screen03ClaimToken(right.label) &&
      screen03ClaimsAreEquivalent(left.value, right.value);
  }
  return screen03ClaimsAreEquivalent(left.value, right.value);
}

function deduplicateEquivalentFacts(
  proposals: readonly Screen03AnyProposal[],
  evidenceById: ReadonlyMap<string, Screen03EvidenceItem>,
  selectedEvidenceIds: ReadonlySet<string>,
) {
  const distinct: Screen03AnyProposal[] = [];
  for (const proposal of proposals) {
    const index = distinct.findIndex((candidate) =>
      equivalentFact(candidate, proposal)
    );
    if (index < 0) {
      distinct.push({ ...proposal });
      continue;
    }
    const candidates = [distinct[index]!, proposal];
    const preferred = [...candidates].sort((left, right) =>
      representativeScore(right, evidenceById, selectedEvidenceIds) -
        representativeScore(left, evidenceById, selectedEvidenceIds) ||
      left.id.localeCompare(right.id)
    )[0]!;
    distinct[index] = mergeEquivalentReferences(preferred, candidates);
  }
  return distinct;
}

function timelineConflictSlot(proposal: Screen03TimelineProposal) {
  return `${timelineMilestoneType(proposal)}:${timelineSemanticScope(proposal)}`;
}

function semanticLabel(proposal: Screen03AnyProposal) {
  const label = screen03ClaimToken(proposal.label);
  if (
    proposal.group === "component" &&
    /^(?:event component|operative duty or component|implementation or compliance)$/u
      .test(label)
  ) {
    return "operative component";
  }
  return label;
}

function materialInvariantSignature(value: string) {
  return screen03MaterialInvariantClaimToken(value);
}

function conflictSlot(proposal: Screen03AnyProposal) {
  if (proposal.group === "identity") {
    return {
      key: `identity:${screen03ClaimToken(proposal.label)}`,
      requiresMaterialDifference: false,
    };
  }
  if (proposal.group === "timeline") {
    return {
      key: `timeline:${timelineConflictSlot(proposal)}`,
      requiresMaterialDifference: false,
    };
  }
  if (
    ["overview", "component", "eligibility", "amendment"].includes(
      proposal.group,
    )
  ) {
    const signature = materialInvariantSignature(proposal.value);
    if (!signature) return null;
    return {
      key: `${proposal.group}:${semanticLabel(proposal)}:${signature}`,
      // The old four-token floor avoided grouping short modal paraphrases such
      // as “must file” and “shall file.” Short skeletons are safe only when the
      // candidates actually disagree on a number, frequency, or polarity.
      requiresMaterialDifference: signature.split(" ").length < 4,
    };
  }
  return null;
}

function fuseConflictingSlots(
  proposals: readonly Screen03AnyProposal[],
  evidenceById: ReadonlyMap<string, Screen03EvidenceItem>,
  selectedEvidenceIds: ReadonlySet<string>,
) {
  const fixed: Screen03AnyProposal[] = [];
  const conflicts: Screen03SourceFusionConflict[] = [];
  const groups = new Map<string, {
    proposals: Screen03AnyProposal[];
    requiresMaterialDifference: boolean;
  }>();
  for (const proposal of proposals) {
    const slot = conflictSlot(proposal);
    if (!slot) {
      fixed.push(proposal);
      continue;
    }
    const group = groups.get(slot.key) ?? {
      proposals: [],
      requiresMaterialDifference: slot.requiresMaterialDifference,
    };
    group.proposals.push(proposal);
    groups.set(slot.key, group);
  }
  for (const group of groups.values()) {
    const candidates = group.proposals;
    const distinctValues = [...new Set(candidates.map((item) => item.value))];
    if (distinctValues.length < 2) {
      fixed.push(candidates[0]!);
      continue;
    }
    if (
      group.requiresMaterialDifference &&
      !candidates.some((left, index) =>
        candidates.slice(index + 1).some((right) =>
          screen03ClaimsHaveMaterialDifference(left.value, right.value)
        )
      )
    ) {
      fixed.push(...candidates);
      continue;
    }
    const ranked = [...candidates].sort((left, right) =>
      representativeScore(right, evidenceById, selectedEvidenceIds) -
        representativeScore(left, evidenceById, selectedEvidenceIds) ||
      left.id.localeCompare(right.id)
    );
    const preferred = ranked[0]!;
    if (preferred.group === "required-variable") {
      // required-variable proposals do not have semantic conflict slots.
      fixed.push(...ranked);
      continue;
    }
    const comparableOfficialCandidates = ranked.filter((proposal) =>
      directPassageSupports(proposal, evidenceById)
    );
    if (comparableOfficialCandidates.length < 2) {
      fixed.push(preferred);
      continue;
    }
    const conflicted = {
      ...preferred,
      support: "conflicting" as const,
      sourceIds: [...new Set(
        comparableOfficialCandidates.flatMap((proposal) => proposal.sourceIds),
      )],
      passageIds: [...new Set(
        comparableOfficialCandidates.flatMap((proposal) => proposal.passageIds),
      )],
      uncertainty:
        "Comparable official sources state materially different values; researcher resolution is required.",
    } as Screen03AnyProposal;
    fixed.push(conflicted);
    conflicts.push({
      representativeProposalId: conflicted.id,
      group: conflicted.group as Exclude<
        Screen03AnyProposal["group"],
        "required-variable"
      >,
      summary: `Comparable official sources disagree on ${screen03ClaimToken(
        conflicted.label,
      ) || conflicted.group}: ${comparableOfficialCandidates
        .map((proposal) => proposal.value.trim().slice(0, 180))
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(" | ")}.`,
    });
  }
  return { proposals: fixed, conflicts };
}

function typedGroup<Group extends keyof Screen03ProposalGroups>(
  group: Group,
  proposals: readonly Screen03AnyProposal[],
) {
  return proposals.filter((proposal) =>
    proposal.group === (group === "requiredVariable" ? "required-variable" : group)
  ) as Screen03ProposalGroups[Group];
}

/**
 * Collapse repeated representations of one fact without collapsing distinct
 * milestones or duties. Equivalent corroboration contributes provenance to
 * one representative. Overlapping conflicts retain the highest-ranked source
 * and exact ties use the stable proposal ID as the deterministic tiebreaker.
 */
export function fuseScreen03ProposalSources(
  proposals: Screen03ProposalGroups,
  evidence: readonly Screen03EvidenceItem[],
): Screen03SourceFusionResult {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const selectedEvidenceIds = selectedIdentityEvidenceIds(
    proposals,
    evidenceById,
  );
  const equivalent = deduplicateEquivalentFacts(
    Object.values(proposals).flat() as Screen03AnyProposal[],
    evidenceById,
    selectedEvidenceIds,
  );
  const fused = fuseConflictingSlots(
    equivalent,
    evidenceById,
    selectedEvidenceIds,
  );
  return {
    proposals: {
      identity: typedGroup("identity", fused.proposals),
      overview: typedGroup("overview", fused.proposals),
      timeline: typedGroup("timeline", fused.proposals),
      component: typedGroup("component", fused.proposals),
      eligibility: typedGroup("eligibility", fused.proposals),
      amendment: typedGroup("amendment", fused.proposals),
      requiredVariable: typedGroup("requiredVariable", fused.proposals),
    },
    conflicts: fused.conflicts,
  };
}
