import { describe, expect, it } from "vitest";

import {
  buildScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  fingerprintScreen02WorkflowSource,
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_03_INTERPRETATION_PROTOCOL_VERSION,
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION,
  SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
  SHOCKAUDIT_V031_RELEASE_LABEL,
  SHOCKAUDIT_V032_RELEASE_LABEL,
  SHOCKAUDIT_V033_RELEASE_LABEL,
  SHOCKAUDIT_V034_RELEASE_LABEL,
  SHOCKAUDIT_V035_RELEASE_LABEL,
  SHOCKAUDIT_V036_RELEASE_LABEL,
  SHOCKAUDIT_V037_RELEASE_LABEL,
  SHOCKAUDIT_V038_RELEASE_LABEL,
  SHOCKAUDIT_V039_RELEASE_LABEL,
  SHOCKAUDIT_V0310_RELEASE_LABEL,
  SHOCKAUDIT_V0311_RELEASE_LABEL,
  SHOCKAUDIT_V0312_RELEASE_LABEL,
  SHOCKAUDIT_V0313_RELEASE_LABEL,
  SHOCKAUDIT_V0314_RELEASE_LABEL,
  SHOCKAUDIT_V0315_RELEASE_LABEL,
  SHOCKAUDIT_V0317_RELEASE_LABEL,
  applyScreen03HostEvidenceMappings,
  applyScreen03Action,
  buildScreen03SupportedFacts,
  attachScreen03BriefingLifecycle,
  buildScreen03StateFromResearch,
  createScreen03LoadingState,
  fingerprintScreen03VerificationState,
  fingerprintScreen03Value,
  fingerprintScreen03ProposalForInterpretation,
  decideScreen03Briefing,
  integrateScreen03BriefingProposal,
  integrateScreen03HostEvidenceMappings,
  integrateScreen03HostInterpretation,
  refreshScreen03StateFromResearch,
  requireScreen03VerificationState,
  restoreScreen03ResearchPacket,
  restoreScreen03HostEvidenceMappings,
  restoreScreen03VerificationState,
  screen03FactualClaims,
  screen03EvidenceItemProvidesDirectSupportForProposal,
  screen03DirectSupportSearchResultIsCurrent,
  screen03ProposalConfirmability,
  screen03ProposalHasActiveDirectSupport,
  serializeScreen03VerificationState,
  type Screen03Proposal,
  type Screen03Interpretation,
  type Screen03ResearchPacket,
  type Screen03TimelineProposal,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_SKILL_VERSION,
  SCREEN_03_BRIEFING_WORKFLOW_VERSION,
  type Screen03BriefingContent,
} from "../../src/core/screen03-briefing";
import {
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
  workflowSource,
} from "./screen02-workflow-fixtures";

const openedAt = "2026-08-10T12:00:00.000Z";
const researchedAt = "2026-08-10T12:00:01.000Z";

function handoff() {
  return buildScreen02WorkflowHandoff(
    buildReadyFindState(),
    "0.2.29",
    "2026-08-10T11:59:59.000Z",
  );
}

function maximumAuditSourceHandoff() {
  const large = cloneFixture(
    buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.2.29",
      "2026-08-10T11:59:59.000Z",
    ),
  );
  const sources = Array.from({ length: 100 }, (_, index) =>
    workflowSource(
      index === 0
        ? "ccpa-official"
        : `ccpa-support-${String(index + 1).padStart(3, "0")}`,
    ),
  );
  large.sources = sources;
  large.event.sourceIds = sources.map((source) => source.id);
  large.integrity.eventFingerprint =
    fingerprintScreen02WorkflowValue(large.event);
  const {
    handoffFingerprint: _handoffFingerprint,
    ...integrityWithoutHandoff
  } = large.integrity;
  large.integrity.handoffFingerprint =
    fingerprintScreen02WorkflowValue({
      ...large,
      integrity: integrityWithoutHandoff,
    });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(large),
  ) as Screen02WorkflowHandoff;
}

function evidenceFingerprint(seed: string) {
  return fingerprintScreen02WorkflowValue({ seed });
}

function proposal(
  group: Screen03Proposal["group"],
  id: string,
  label: string,
  value: string,
  critical: boolean,
  support: Screen03Proposal["support"] = "direct",
): Screen03Proposal {
  return {
    id,
    group,
    label,
    value,
    critical,
    reviewStatus: "proposed",
    editedValue: null,
    support,
    sourceIds: ["research-source"],
    passageIds: ["research-source:passage:1"],
    uncertainty: null,
  };
}

function timeline(
  id: string,
  stage: Screen03TimelineProposal["stage"],
  date: string,
  critical = true,
): Screen03TimelineProposal {
  return {
    id,
    group: "timeline",
    label: `${stage} date`,
    value: date,
    date,
    stage,
    critical,
    reviewStatus: "proposed",
    editedValue: null,
    support: "direct",
    sourceIds: ["research-source"],
    passageIds: ["research-source:passage:1"],
    uncertainty: null,
  };
}

function researchPacket(
  sourceHandoff: Screen02WorkflowHandoff,
  overrides: {
    identity?: Screen03Proposal[];
    overview?: Screen03Proposal[];
    timeline?: Screen03TimelineProposal[];
    component?: Screen03Proposal[];
    eligibility?: Screen03Proposal[];
    amendment?: Screen03Proposal[];
    requiredVariable?: Screen03Proposal[];
    stoppingStatus?: "met" | "not-met";
  } = {},
): Screen03ResearchPacket {
  const evidence = {
    id: "research-source",
    sourceId: "research-source",
    title: "Official operative record",
    locator: "https://official.example.test/record",
    publisher: "Official authority",
    publishedDate: "2018-05-24",
    retrievedAt: researchedAt,
    authorityTier: 1 as const,
    channel: "official-primary",
    contentFingerprint: evidenceFingerprint("operative-record"),
    language: "en",
    status: "retrieved" as const,
    passages: [
      {
        id: "research-source:passage:1",
        number: 1,
        text: "The official record identifies the General Data Protection Regulation as Regulation (EU) 2016/679 and states that it applies from 25 May 2018.",
        locator: "Article 99(2)",
        basis: "source-excerpt" as const,
      },
    ],
  };
  const packet: Screen03ResearchPacket = {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt,
    upstreamEventFingerprint: sourceHandoff.integrity.eventFingerprint,
    coverage: {
      queries: [
        {
          id: "query-operative-record",
          query: "GDPR operative record application date",
          purpose: "Verify identity and the operative application clock.",
          returnedEvidenceIds: [evidence.id],
        },
      ],
      channels: [
        {
          channel: "official-primary",
          status: "searched",
          note: "The official legal record was reviewed.",
          retrievedAt: researchedAt,
        },
      ],
      routes: ["official-record"],
      stages: ["identity", "effective"],
      languages: ["en"],
      authorityTiers: [1],
      gaps: [],
      recordsReviewed: 1,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after the authoritative identity and operative clock are directly supported.",
        status: overrides.stoppingStatus ?? "met",
        note: "The bounded test packet reached its declared target.",
      },
      outcomeValuesInspected: false,
    },
    evidence: [evidence],
    proposals: {
      identity: overrides.identity ?? [
        proposal("identity", "field-canonical-title", "Canonical title", "General Data Protection Regulation", true),
      ],
      overview: overrides.overview ?? [],
      timeline: overrides.timeline ?? [timeline("field-effective", "effective", "2018-05-25")],
      component: overrides.component ?? [],
      eligibility: overrides.eligibility ?? [],
      amendment: overrides.amendment ?? [],
      requiredVariable: overrides.requiredVariable ?? [],
    },
    contradictions: [],
    outcomeValuesInspected: false,
  };
  const citedValues = Object.values(packet.proposals)
    .flat()
    .filter((item) => item.support === "direct")
    .map((item) =>
      item.group === "timeline"
        ? `${item.stage} date ${item.date}`
        : `${item.label}: ${item.value}`,
    );
  evidence.passages[0].text = `${evidence.passages[0].text} ${citedValues.join(". ")}.`;
  return packet;
}

function interpretationFor(
  packet: Screen03ResearchPacket,
  sourceHandoff: Screen02WorkflowHandoff,
): Screen03Interpretation {
  const proposal = packet.proposals.identity[0]!;
  const passageId = proposal.passageIds[0]!;
  const evidenceId = packet.evidence.find((item) =>
    item.passages.some((passage) => passage.id === passageId)
  )!.id;
  const block = {
    text:
      "The selected regulation establishes a documented rule that the review below checks against the official record.",
    proposalIds: [proposal.id],
    passageIds: [passageId],
    evidenceIds: [evidenceId],
  };
  const scope = sourceHandoff.screen01Baseline.scopeContract;
  return {
    protocolVersion: SCREEN_03_INTERPRETATION_PROTOCOL_VERSION,
    origin: "workers-ai",
    nonCanonical: true,
    studyContext: {
      population: scope.population,
      geography: scope.geography,
      industry: scope.industry,
      studyPeriod: scope.studyPeriod,
      outcomeFamily: scope.outcomeFamily,
    },
    snapshot: {
      intro: {
        ...block,
        text:
          "This reader-oriented summary is separate from the exact claim that requires a decision.",
      },
      keyPoints: [block],
    },
    studyRelevance: {
      sampleConnection: {
        ...block,
        text:
          "The coverage evidence may help determine which study units belong in the potentially exposed sample.",
      },
      outcomeConnection: {
        ...block,
        text:
          "The documented rule could provide a plausible pathway to the selected outcome family without establishing an observed effect.",
      },
      caveat:
        "Any study connection is preliminary and outcome-blind; it does not establish causation, direction, or effect size.",
    },
    claimExplanations: [{
      proposalId: proposal.id,
      proposalFingerprint:
        fingerprintScreen03ProposalForInterpretation(proposal),
      text:
        "This identifies the formal event that the researcher is deciding whether to carry into the Event Card.",
      passageIds: [passageId],
      evidenceIds: [evidenceId],
    }],
    limitations: [
      "The interpretation is explanatory only; the cited passage remains authoritative.",
    ],
    outcomeValuesInspected: false,
  };
}

function unavailableInterpretationFor(
  packet: Screen03ResearchPacket,
  sourceHandoff: Screen02WorkflowHandoff,
): Screen03Interpretation {
  const interpretation = interpretationFor(packet, sourceHandoff);
  const unavailableBlock = (text: string) => ({
    text,
    proposalIds: [],
    passageIds: [],
    evidenceIds: [],
  });
  return {
    ...interpretation,
    origin: "unavailable",
    snapshot: {
      intro: unavailableBlock(
        "A plain-language orientation is unavailable; review the exact claims.",
      ),
      keyPoints: [],
    },
    studyRelevance: {
      sampleConnection: unavailableBlock(
        "Plain-language sample relevance is unavailable.",
      ),
      outcomeConnection: unavailableBlock(
        "Plain-language outcome relevance is unavailable.",
      ),
      caveat: interpretation.studyRelevance.caveat,
    },
    claimExplanations: [],
    limitations: [
      "The interpretation was unavailable; exact passages remain authoritative.",
    ],
  };
}

function researchedState(packetOverrides: Parameters<typeof researchPacket>[1] = {}) {
  const sourceHandoff = handoff();
  return buildScreen03StateFromResearch(
    sourceHandoff,
    researchPacket(sourceHandoff, packetOverrides),
    "2026-08-10T12:00:02.000Z",
  );
}

function act(
  state: Screen03VerificationState,
  action: Parameters<typeof applyScreen03Action>[1] extends infer Action
    ? Action extends { at: string }
      ? Omit<Action, "at">
      : never
    : never,
  at: string,
) {
  return applyScreen03Action(state, {
    ...action,
    at,
  } as Parameters<typeof applyScreen03Action>[1]);
}

describe("Screen 3 v0.3.17 verification core", () => {
  it("opens immediately from the immutable v4 handoff with useful but unconfirmed carried evidence", () => {
    const sourceHandoff = handoff();
    const original = JSON.stringify(sourceHandoff);
    const state = createScreen03LoadingState(sourceHandoff, openedAt);

    expect(state.schemaVersion).toBe(SCREEN_03_VERIFICATION_STATE_SCHEMA_VERSION);
    expect(state.releaseLabel).toBe(SHOCKAUDIT_V0317_RELEASE_LABEL);
    expect(state.orientation).toMatchObject({
      provenance: "screen-02-preliminary",
      upstreamEventFingerprint: sourceHandoff.integrity.eventFingerprint,
      initial: {
        selectedEventId: sourceHandoff.event.identitySnapshotId,
        origin: "fixed-source-derived",
      },
    });
    expect(state.status).toBe("loading");
    expect(state.eventIdentity.canonicalTitle).toBe("General Data Protection Regulation");
    expect(state.evidence).toHaveLength(1);
    expect(state.proposals.timeline[0]).toMatchObject({
      date: "2018-05-25",
      reviewStatus: "proposed",
      support: "unsupported",
    });
    expect(state.researchCoverage).toMatchObject({
      status: "pending",
      exhaustive: false,
      outcomeValuesInspected: false,
    });
    expect(state.outcomeValuesInspected).toBe(false);
    expect(Object.isFrozen(state)).toBe(true);
    expect(JSON.stringify(sourceHandoff)).toBe(original);
  });

  it("keeps the original Screen 2 glance while researcher decisions deterministically refine the displayed orientation", () => {
    const changed = proposal(
      "overview",
      "overview-reviewed",
      "What changed",
      "Covered organizations must follow a revised reporting duty.",
      true,
    );
    const later = proposal(
      "amendment",
      "amendment-reviewed",
      "Later amendment",
      "A later amendment revised a separate implementation stage.",
      false,
    );
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      overview: [changed],
      amendment: [later],
    });
    const initial = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    const originalGlance = initial.orientation!.initial;

    const accepted = act(initial, {
      type: "review-field",
      proposalId: changed.id,
      decision: "accept",
      reason: "The linked official passage directly supports this duty.",
    }, "2026-08-10T12:00:03.000Z");
    expect(accepted.orientation!.initial).toEqual(originalGlance);
    expect(accepted.orientation).toMatchObject({
      provenance: "screen-03-reviewed",
      refinements: [{ decision: "accept", proposalId: changed.id }],
    });
    expect(accepted.orientation!.current.summary).toBe(changed.value);
    expect(accepted.orientation!.refinements[0]!.fieldsUsed).toContain(changed.id);

    const amended = act(accepted, {
      type: "review-field",
      proposalId: later.id,
      decision: "accept",
      reason: "The source distinguishes this later stage.",
    }, "2026-08-10T12:00:04.000Z");
    expect(amended.orientation!.current.keyPoints).toContain(
      `Later change: ${later.value}`,
    );
    expect(amended.orientation!.initial).toEqual(originalGlance);
    expect(amended.orientation!.refinements).toHaveLength(2);
  });

  it("removes rejected wording and keeps unresolved facts visibly qualified", () => {
    const sourceHandoff = handoff();
    const preliminary = createScreen03LoadingState(
      sourceHandoff,
      openedAt,
    ).orientation!.initial.summary;
    const packet = researchPacket(sourceHandoff, {
      overview: [proposal(
        "overview",
        "overview-preliminary",
        "Preliminary overview",
        preliminary,
        true,
      )],
      eligibility: [proposal(
        "eligibility",
        "eligibility-unresolved",
        "Coverage threshold",
        "A proposed coverage threshold applies to specified organizations.",
        true,
        "conflicting",
      )],
    });
    const initial = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    const rejected = act(initial, {
      type: "review-field",
      proposalId: "overview-preliminary",
      decision: "reject",
      reason: "The preliminary overview is not supported as stated.",
    }, "2026-08-10T12:00:03.000Z");
    expect(JSON.stringify(rejected.orientation!.current)).not.toContain(preliminary);
    expect(rejected.orientation!.current.importantCaveat).toContain(
      "rejected preliminary claim",
    );

    const unresolved = act(rejected, {
      type: "review-field",
      proposalId: "eligibility-unresolved",
      decision: "unresolved",
      reason: "The retained sources conflict on the threshold.",
    }, "2026-08-10T12:00:04.000Z");
    expect(unresolved.orientation!.current.whoIsAffected).toContain(
      "remains unresolved",
    );
    expect(unresolved.orientation!.current.importantCaveat).toContain(
      "rejected preliminary claim",
    );
    expect(unresolved.orientation!.refinements.at(-1)).toMatchObject({
      decision: "unresolved",
      proposalId: "eligibility-unresolved",
    });
  });

  it("uses confirmed Screen 3 dates without changing the immutable Screen 2 provenance", () => {
    const initial = researchedState();
    const original = initial.orientation!.initial;
    const confirmed = act(initial, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "accept",
      reason: "The operative date is stated directly in the numbered passage.",
    }, "2026-08-10T12:00:03.000Z");
    expect(confirmed.orientation!.current.keyTiming).toContain("2018-05-25");
    expect(confirmed.orientation!.initial).toEqual(original);
    expect(confirmed.orientation!.current.importantCaveat).toContain(
      "does not establish legal coverage, exogeneity, a causal mechanism, or realized effects",
    );
  });

  it("keeps detailed confirmed eligibility facts inside the compact orientation bounds", () => {
    const coverage = proposal(
      "eligibility",
      "eligibility-reviewed",
      "Covered entities or eligibility",
      "The law applies to qualifying for-profit legal entities doing business in California that collect consumers' personal information and determine the purposes and means of processing it.",
      true,
    );
    const threshold = proposal(
      "eligibility",
      "threshold-reviewed",
      "Eligibility thresholds",
      "The original AB 375 business definition covered qualifying for-profit legal entities doing business in California that collected consumers' personal information, determined the purposes and means of processing it, and met at least one historical threshold: annual gross revenue over $25 million; annually buying, receiving, selling, or sharing for commercial purposes the personal information of 50,000 or more consumers, households, or devices; or deriving 50 percent or more of annual revenue from selling consumers' personal information.",
      true,
    );
    const initial = researchedState({ eligibility: [coverage, threshold] });
    const acceptedCoverage = act(initial, {
      type: "review-field",
      proposalId: coverage.id,
      decision: "accept",
      reason: "The linked official passage directly supports the coverage description.",
    }, "2026-08-10T12:00:03.000Z");
    const acceptedThreshold = act(acceptedCoverage, {
      type: "review-field",
      proposalId: threshold.id,
      decision: "accept",
      reason: "The linked official passage directly supports the historical thresholds.",
    }, "2026-08-10T12:00:04.000Z");
    const glance = acceptedThreshold.orientation!.current;
    const displayedWords = [
      glance.summary,
      ...glance.keyPoints,
      glance.whoIsAffected,
      glance.keyTiming,
      glance.importantCaveat,
    ].join(" ").split(/\s+/u).filter(Boolean).length;

    expect(glance.whoIsAffected.length).toBeLessThanOrEqual(500);
    expect(glance.whoIsAffected).toContain(
      "The original AB 375 business definition",
    );
    expect(displayedWords).toBeLessThanOrEqual(280);
    expect(acceptedThreshold.orientation).toMatchObject({
      provenance: "screen-03-reviewed",
      refinements: [
        { proposalId: coverage.id },
        { proposalId: threshold.id },
      ],
    });
    expect(acceptedThreshold.orientation!.initial).toEqual(
      initial.orientation!.initial,
    );
  });

  it("keeps a fully refined orientation below every field and aggregate prose limit", () => {
    const longSentence = (lead: string, detailWords: number) =>
      `${lead} ${Array.from(
        { length: detailWords },
        (_, index) => `detail${index + 1}`,
      ).join(" ")}.`;
    const overview = proposal(
      "overview",
      "overview-long-reviewed",
      "What changed",
      longSentence("The reviewed overview establishes", 70),
      true,
    );
    const components = Array.from({ length: 4 }, (_, index) =>
      proposal(
        "component",
        `component-long-reviewed-${index + 1}`,
        `Component ${index + 1}`,
        longSentence(`Component ${index + 1} establishes`, 40),
        true,
      )
    );
    const amendment = proposal(
      "amendment",
      "amendment-long-reviewed",
      "Later amendment",
      longSentence("A later amendment establishes", 40),
      true,
    );
    const eligibility = proposal(
      "eligibility",
      "eligibility-long-reviewed",
      "Covered entities or eligibility",
      longSentence("The covered population includes", 70),
      true,
    );
    const initial = researchedState({
      overview: [overview],
      component: components,
      eligibility: [eligibility],
      amendment: [amendment],
    });
    const reviewed = [
      overview,
      ...components,
      amendment,
      eligibility,
      initial.proposals.timeline[0]!,
    ].reduce(
      (state, item, index) => act(state, {
        type: "review-field",
        proposalId: item.id,
        decision: "accept",
        reason: "The linked official passage directly supports this reviewed field.",
      }, new Date(Date.parse("2026-08-10T12:00:03.000Z") + index * 1_000)
        .toISOString()),
      initial,
    );
    const glance = reviewed.orientation!.current;
    const words = (value: string) => value.split(/\s+/u).filter(Boolean).length;
    const displayedWords = [
      glance.summary,
      ...glance.keyPoints,
      glance.whoIsAffected,
      glance.keyTiming,
      glance.importantCaveat,
    ].reduce((total, value) => total + words(value), 0);

    expect(words(glance.summary)).toBeLessThanOrEqual(55);
    expect(glance.keyPoints).toHaveLength(5);
    expect(glance.keyPoints.every((point) => words(point) <= 20)).toBe(true);
    expect(words(glance.whoIsAffected)).toBeLessThanOrEqual(40);
    expect(words(glance.keyTiming)).toBeLessThanOrEqual(40);
    expect(words(glance.importantCaveat)).toBeLessThanOrEqual(35);
    expect(displayedWords).toBeLessThanOrEqual(270);
    expect(reviewed.orientation!.initial).toEqual(initial.orientation!.initial);
  });

  it("restores and mutates fingerprint-valid v0.3.00 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the patch release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.01 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V031_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V031_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the cache-key release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V031_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.02 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V032_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V032_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.03 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V032_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.03 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V033_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V033_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.04 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V033_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.04 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V034_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V034_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.05 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V034_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.05 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V035_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V035_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.07 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V035_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.06 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V036_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V036_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.07 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V036_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.07 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V037_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V037_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.08 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V037_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.08 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V038_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V038_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.09 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V038_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.09 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V039_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V039_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.10 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V039_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.10 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V0310_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V0310_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.11 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V0310_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.11 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V0311_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V0311_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.13 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V0311_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.12 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V0312_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V0312_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.13 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V0312_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("restores and mutates fingerprint-valid v0.3.13 Screen 3 state", () => {
    const current = createScreen03LoadingState(handoff(), openedAt);
    const legacy = cloneFixture(current);
    legacy.releaseLabel = SHOCKAUDIT_V0313_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = requireScreen03VerificationState(legacy);
    expect(restored.releaseLabel).toBe(SHOCKAUDIT_V0313_RELEASE_LABEL);
    const proposalId = restored.proposals.identity[0]!.id;
    const successor = applyScreen03Action(restored, {
      type: "review-field",
      proposalId,
      decision: "reject",
      reason: "Preserve a saved Screen 3 review across the v0.3.14 release.",
      at: "2026-08-10T12:00:00.100Z",
    });

    expect(successor.releaseLabel).toBe(SHOCKAUDIT_V0313_RELEASE_LABEL);
    expect(successor.proposals.identity[0]!.reviewStatus).toBe("rejected");
    expect(restoreScreen03VerificationState(successor)).not.toBeNull();
  });

  it("accepts a source-bound noncanonical interpretation and rejects stale or foreign references", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    packet.interpretation = interpretationFor(packet, sourceHandoff);

    expect(restoreScreen03ResearchPacket(packet)?.interpretation).toEqual(
      packet.interpretation,
    );

    const stale = cloneFixture(packet);
    stale.interpretation!.claimExplanations[0]!.proposalFingerprint =
      "fnv1a64:0000000000000000";
    expect(restoreScreen03ResearchPacket(stale)).toBeNull();

    const foreign = cloneFixture(packet);
    foreign.interpretation!.snapshot.keyPoints[0]!.passageIds = [
      "unknown-passage",
    ];
    expect(restoreScreen03ResearchPacket(foreign)).toBeNull();

    const bareIntro = cloneFixture(packet) as unknown as {
      interpretation: { snapshot: { intro: unknown } };
    };
    bareIntro.interpretation.snapshot.intro =
      "A bare uncited introduction is not part of the contract.";
    expect(restoreScreen03ResearchPacket(bareIntro)).toBeNull();

    const uncitedWorkersAiIntro = cloneFixture(packet);
    uncitedWorkersAiIntro.interpretation!.snapshot.intro.proposalIds = [];
    uncitedWorkersAiIntro.interpretation!.snapshot.intro.passageIds = [];
    uncitedWorkersAiIntro.interpretation!.snapshot.intro.evidenceIds = [];
    expect(restoreScreen03ResearchPacket(uncitedWorkersAiIntro)).toBeNull();
  });

  it("adds a first interpretation without reopening decisions or replacing a locked Event Card", () => {
    const sourceHandoff = handoff();
    const originalPacket = researchPacket(sourceHandoff);
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      originalPacket,
      "2026-08-10T12:00:02.000Z",
    );
    state = act(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Review all supported facts before testing the interpretation lane.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Lock the source-backed Event Card before an interpretation refresh.",
    }, "2026-08-10T12:00:04.000Z");
    const lockedFingerprint = state.lockedEventCard!.eventCardFingerprint;
    const reviewedStatuses = Object.values(state.proposals)
      .flat()
      .map((proposal) => [proposal.id, proposal.reviewStatus]);

    const interpretedPacket = researchPacket(sourceHandoff);
    interpretedPacket.interpretation = interpretationFor(
      interpretedPacket,
      sourceHandoff,
    );
    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      interpretedPacket,
      "2026-08-10T12:00:05.000Z",
    );

    expect(refreshed.status).toBe("locked");
    expect(refreshed.lockedEventCard?.eventCardFingerprint).toBe(
      lockedFingerprint,
    );
    expect(
      Object.values(refreshed.proposals)
        .flat()
        .map((proposal) => [proposal.id, proposal.reviewStatus]),
    ).toEqual(reviewedStatuses);
    expect(refreshed.interpretation?.origin).toBe("workers-ai");
    expect(refreshed.history.at(-1)?.action).toBe("context-refreshed");
  });

  it("integrates ChatGPT-host reader help without changing canonical review or lock boundaries", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    state = act(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Review all supported facts before testing host reader help.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Preserve the locked Event Card while reader help arrives.",
    }, "2026-08-10T12:00:04.000Z");
    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    const proof = "fnv1a64:1234567890abcdef";
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:05.000Z",
      proof,
    );

    expect(integrated.interpretation?.origin).toBe("chatgpt-host");
    expect(integrated.interpretation?.snapshot.keyPoints).toHaveLength(1);
    expect(integrated.revision).toBe(state.revision + 1);
    expect(integrated.evidence).toEqual(state.evidence);
    expect(integrated.proposals).toEqual(state.proposals);
    expect(integrated.focalClock).toEqual(state.focalClock);
    expect(integrated.lockedEventCard).toEqual(state.lockedEventCard);
    expect(integrated.history.at(-1)).toMatchObject({
      action: "host-interpretation-integrated",
      actor: "chatgpt-host",
      value: proof,
    });
    expect(integrateScreen03HostInterpretation(
      integrated,
      host,
      "2026-08-10T12:00:06.000Z",
      proof,
    )).toEqual(integrated);

    const refreshedHost = cloneFixture(host);
    refreshedHost.snapshot.intro.text =
      "A clearer source-bound explanation of the same documented event.";
    const refreshed = integrateScreen03HostInterpretation(
      integrated,
      refreshedHost,
      "2026-08-10T12:00:07.000Z",
      "fnv1a64:fedcba0987654321",
    );
    expect(refreshed.revision).toBe(integrated.revision + 1);
    expect(refreshed.interpretation?.snapshot.intro.text).toBe(
      refreshedHost.snapshot.intro.text,
    );
    expect(refreshed.evidence).toEqual(integrated.evidence);
    expect(refreshed.proposals).toEqual(integrated.proposals);
    expect(refreshed.lockedEventCard).toEqual(integrated.lockedEventCard);
  });

  it("stores a validated host snapshot exactly without mixing source-derived fallback blocks", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      component: [proposal(
        "component",
        "field-reporting-duty",
        "Reporting duty",
        "Covered entities must publish a non-financial statement.",
        true,
      )],
      eligibility: [proposal(
        "eligibility",
        "field-coverage-threshold",
        "Coverage threshold",
        "The rule covers large public-interest entities exceeding 500 employees.",
        true,
      )],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const sourceDerived = unavailableInterpretationFor(packet, sourceHandoff);
    const coverageBlock = blockFor(
      "field-coverage-threshold",
      "The rule covers large public-interest entities exceeding 500 employees.",
    );
    sourceDerived.snapshot = {
      intro: coverageBlock,
      keyPoints: [
        blockFor(
          "field-canonical-title",
          "The documented event is the General Data Protection Regulation.",
        ),
        blockFor(
          "field-reporting-duty",
          "Covered entities must publish a non-financial statement.",
        ),
        blockFor("field-effective", "The rule applies from 25 May 2018."),
      ],
    };
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    const hostDuty = blockFor(
      "field-reporting-duty",
      "In plain terms, covered entities must publish a non-financial statement.",
    );
    const hostTiming = blockFor(
      "field-effective",
      "In plain terms, the main date is 25 May 2018.",
    );
    host.snapshot.keyPoints = [hostDuty, hostTiming];
    const hostLimitations = [...host.limitations];

    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:0123456789abcdef",
    );

    expect(integrated.interpretation?.snapshot.keyPoints).toEqual(
      host.snapshot.keyPoints,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      coverageBlock,
    );
    expect(integrated.interpretation?.snapshot.intro).toEqual(
      host.snapshot.intro,
    );
    expect(integrated.interpretation?.limitations).toEqual(hostLimitations);
    expect(integrated.evidence).toEqual(state.evidence);
    expect(integrated.proposals).toEqual(state.proposals);

    const refreshedHost = cloneFixture(host);
    refreshedHost.snapshot.intro.text =
      "ChatGPT refreshed this source-bound event overview.";
    const refreshed = integrateScreen03HostInterpretation(
      integrated,
      refreshedHost,
      "2026-08-10T12:00:04.000Z",
      "fnv1a64:1123456789abcdef",
    );
    expect(refreshed.revision).toBe(integrated.revision + 1);
    expect(refreshed.interpretation?.snapshot.keyPoints).toEqual(
      refreshedHost.snapshot.keyPoints,
    );
    expect(refreshed.interpretation?.snapshot.intro.text).toBe(
      refreshedHost.snapshot.intro.text,
    );

    const rejected = act(state, {
      type: "review-field",
      proposalId: "field-coverage-threshold",
      decision: "reject",
      reason: "Do not reuse rejected coverage wording in the overview.",
    }, "2026-08-10T12:00:03.000Z");
    const rejectedIntegration = integrateScreen03HostInterpretation(
      rejected,
      host,
      "2026-08-10T12:00:04.000Z",
      "fnv1a64:2123456789abcdef",
    );
    expect(rejectedIntegration.interpretation?.snapshot.keyPoints).toEqual([
      hostDuty,
      hostTiming,
    ]);

    const edited = act(state, {
      type: "review-field",
      proposalId: "field-coverage-threshold",
      decision: "edit",
      editedValue: "large public-interest entities exceeding 500 employees",
      reason: "Use only the reviewed correction, not the original overview wording.",
    }, "2026-08-10T12:00:03.000Z");
    const editedIntegration = integrateScreen03HostInterpretation(
      edited,
      host,
      "2026-08-10T12:00:04.000Z",
      "fnv1a64:3123456789abcdef",
    );
    expect(editedIntegration.interpretation?.snapshot.keyPoints).toEqual([
      hostDuty,
      hostTiming,
    ]);
  });

  it("does not backfill an omitted threshold into a validated host overview", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      component: [proposal(
        "component",
        "field-consumer-rights",
        "Consumer rights",
        "Consumers may request disclosure and deletion of covered personal information.",
        true,
      )],
      timeline: [timeline(
        "field-operative",
        "effective",
        "2020-01-01",
      )],
      eligibility: [
        proposal(
          "eligibility",
          "field-general-coverage",
          "General coverage",
          "Qualifying for-profit entities doing business in California were covered.",
          true,
        ),
        proposal(
          "eligibility",
          "field-original-thresholds",
          "Original eligibility thresholds",
          "Annual gross revenue over $25 million; annually buying, receiving, selling, or sharing for commercial purposes the personal information of 50,000 or more consumers, households, or devices; or deriving 50 percent or more of annual revenues from selling consumers' personal information.",
          true,
        ),
      ],
      amendment: [proposal(
        "amendment",
        "field-later-amendment",
        "Later amendment",
        "A later amendment changed the historical coverage thresholds.",
        true,
      )],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const rights = blockFor(
      "field-consumer-rights",
      "Consumers may request disclosure and deletion of covered personal information.",
    );
    const generalCoverage = blockFor(
      "field-general-coverage",
      "Qualifying for-profit entities doing business in California were covered.",
    );
    const thresholds = blockFor(
      "field-original-thresholds",
      "Original eligibility thresholds: annual gross revenue over $25 million; annually buying, receiving, selling, or sharing for commercial purposes the personal information of 50,000 or more consumers, households, or devices; or deriving 50 percent or more of annual revenues from selling consumers' personal information.",
    );
    const operativeDate = blockFor(
      "field-operative",
      "The law became operative on 2020-01-01.",
    );
    const amendment = blockFor(
      "field-later-amendment",
      "A later amendment changed the historical coverage thresholds.",
    );
    const sourceDerived = interpretationFor(packet, sourceHandoff);
    sourceDerived.snapshot.keyPoints = [
      rights,
      generalCoverage,
      thresholds,
      operativeDate,
      amendment,
    ];
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    host.snapshot.keyPoints = [
      rights,
      generalCoverage,
      operativeDate,
      amendment,
    ];
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:4123456789abcdef",
    );
    const keyPoints = integrated.interpretation?.snapshot.keyPoints ?? [];

    expect(keyPoints).toEqual(host.snapshot.keyPoints);
    expect(keyPoints).not.toContainEqual(thresholds);
    expect(keyPoints.map((block) => block.text).join(" ")).toContain(
      "2020-01-01",
    );
    expect(integrated.evidence).toEqual(state.evidence);
    expect(integrated.proposals).toEqual(state.proposals);
  });

  it("does not mix a source-intro eligibility twin into the host snapshot", () => {
    const sourceHandoff = handoff();
    const thresholdText =
      "The directive applies to large public-interest entities and parent undertakings exceeding 500 employees.";
    const packet = researchPacket(sourceHandoff, {
      component: [
        proposal(
          "component",
          "field-reporting-duty",
          "Reporting duty",
          "Covered entities must publish a non-financial statement.",
          true,
        ),
        proposal(
          "component",
          "field-extractive-coverage-twin",
          "Effective date or application",
          thresholdText,
          true,
        ),
      ],
      timeline: [timeline(
        "field-operative",
        "effective",
        "2017-01-01",
      )],
      eligibility: [
        proposal(
          "eligibility",
          "field-critical-coverage",
          "Covered entities or eligibility",
          thresholdText,
          true,
        ),
        proposal(
          "eligibility",
          "field-subsidiary-exemption",
          "Exemptions",
          "Member states must implement the directive in national law, and specified subsidiary exemptions may apply.",
          true,
        ),
      ],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const sourceThresholdIntro = blockFor(
      "field-extractive-coverage-twin",
      thresholdText,
    );
    const sourceDerived = interpretationFor(packet, sourceHandoff);
    sourceDerived.snapshot = {
      intro: sourceThresholdIntro,
      keyPoints: [
        blockFor(
          "field-reporting-duty",
          "Covered entities must publish a non-financial statement.",
        ),
        blockFor("field-operative", "The rule applies from 2017-01-01."),
        blockFor(
          "field-subsidiary-exemption",
          "Member states must implement the directive in national law, and specified subsidiary exemptions may apply.",
        ),
      ],
    };
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    host.snapshot.intro = blockFor(
      "field-canonical-title",
      "In plain terms, the directive was adopted in 2014.",
    );
    host.snapshot.keyPoints = [
      blockFor(
        "field-reporting-duty",
        "In plain terms, covered entities must publish a non-financial statement.",
      ),
      blockFor("field-operative", "In plain terms, the main date is 2017-01-01."),
      blockFor(
        "field-subsidiary-exemption",
        "Member states must implement the directive in national law, and specified subsidiary exemptions may apply.",
      ),
    ];
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:6123456789abcdef",
    );

    expect(integrated.interpretation?.snapshot.intro).toEqual(
      host.snapshot.intro,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).toEqual(
      host.snapshot.keyPoints,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      sourceThresholdIntro,
    );
    expect(integrated.evidence).toEqual(state.evidence);
    expect(integrated.proposals).toEqual(state.proposals);
  });

  it("keeps the host amendment without source-derived eligibility backfill", () => {
    const sourceHandoff = handoff();
    const amendmentText =
      "The California Privacy Rights Act later amended the CCPA, expanded consumer rights, and added protections beginning January 1, 2023.";
    const hostCoverageText =
      "The law applies to qualifying businesses doing business in California, subject to the applicable statutory thresholds and exemptions.";
    const packet = researchPacket(sourceHandoff, {
      component: [
        proposal(
          "component",
          "field-amendment-component-twin",
          "Rights or protections",
          amendmentText,
          true,
        ),
        proposal(
          "component",
          "field-consumer-rights",
          "Consumer rights",
          "The act created disclosure, deletion, opt-out, and nondiscrimination rights.",
          true,
        ),
        proposal(
          "component",
          "field-host-coverage-component-twin",
          "What it does",
          hostCoverageText,
          true,
        ),
      ],
      overview: [proposal(
        "overview",
        "field-enactment",
        "Enactment or publication",
        "AB 375 was enacted and approved on June 28, 2018.",
        false,
      )],
      timeline: [timeline(
        "field-operative",
        "effective",
        "2020-01-01",
      )],
      eligibility: [
        proposal(
          "eligibility",
          "field-host-coverage",
          "Covered entities or eligibility",
          hostCoverageText,
          true,
        ),
        proposal(
          "eligibility",
          "field-general-coverage",
          "General coverage",
          "The law applies to qualifying businesses doing business in California.",
          true,
        ),
        proposal(
          "eligibility",
          "field-original-thresholds",
          "Original eligibility thresholds",
          "Annual gross revenue over $25 million or covered activity involving 50,000 or more consumers.",
          true,
        ),
      ],
      amendment: [proposal(
        "amendment",
        "field-critical-amendment",
        "Amendments and delays",
        amendmentText,
        true,
      )],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const amendmentIntro = blockFor(
      "field-amendment-component-twin",
      amendmentText,
    );
    const rights = blockFor(
      "field-consumer-rights",
      "The act created disclosure, deletion, opt-out, and nondiscrimination rights.",
    );
    const generalCoverage = blockFor(
      "field-general-coverage",
      "The law applies to qualifying businesses doing business in California.",
    );
    const operativeDate = blockFor(
      "field-operative",
      "The law became operative on 2020-01-01.",
    );
    const thresholds = blockFor(
      "field-original-thresholds",
      "Annual gross revenue over $25 million or covered activity involving 50,000 or more consumers.",
    );
    const hostCoverageComponentTwin = blockFor(
      "field-host-coverage-component-twin",
      hostCoverageText,
    );
    const enactment = blockFor(
      "field-enactment",
      "AB 375 was enacted and approved on June 28, 2018.",
    );
    const hostCoverage = blockFor(
      "field-host-coverage",
      `In plain terms, ${hostCoverageText}`,
    );
    const sourceDerived = interpretationFor(packet, sourceHandoff);
    sourceDerived.snapshot = {
      intro: amendmentIntro,
      keyPoints: [
        rights,
        generalCoverage,
        operativeDate,
        thresholds,
        hostCoverageComponentTwin,
        enactment,
      ],
    };
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    host.snapshot.intro = blockFor(
      "field-canonical-title",
      "In plain terms, this is the California Consumer Privacy Act.",
    );
    host.snapshot.keyPoints = [
      rights,
      hostCoverage,
      operativeDate,
      amendmentIntro,
    ];
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:8123456789abcdef",
    );

    expect(integrated.interpretation?.snapshot.intro).toEqual(
      host.snapshot.intro,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).toEqual(
      host.snapshot.keyPoints,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      hostCoverageComponentTwin,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      generalCoverage,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      thresholds,
    );
    expect(integrated.interpretation?.snapshot.keyPoints[3]?.text).toMatch(
      /later amended[\s\S]*January 1, 2023/i,
    );
    expect(integrated.evidence).toEqual(state.evidence);
    expect(integrated.proposals).toEqual(state.proposals);
  });

  it("does not treat materially different currencies as cross-group eligibility twins", () => {
    const sourceHandoff = handoff();
    const componentText = "Coverage requires annual revenue of $25 million.";
    const packet = researchPacket(sourceHandoff, {
      component: [
        proposal(
          "component",
          "field-dollar-threshold",
          "Coverage threshold",
          componentText,
          true,
        ),
        proposal(
          "component",
          "field-reporting-duty",
          "Reporting duty",
          "Covered entities must publish a non-financial statement.",
          true,
        ),
      ],
      timeline: [timeline(
        "field-operative",
        "effective",
        "2017-01-01",
      )],
      eligibility: [
        proposal(
          "eligibility",
          "field-euro-threshold",
          "Coverage threshold",
          "Coverage requires annual revenue of €25 million.",
          true,
        ),
        proposal(
          "eligibility",
          "field-subsidiary-exemption",
          "Exemptions",
          "Specified subsidiary exemptions may apply.",
          true,
        ),
      ],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const supportingPoints = [
      blockFor(
        "field-reporting-duty",
        "Covered entities must publish a non-financial statement.",
      ),
      blockFor("field-operative", "The rule applies from 2017-01-01."),
      blockFor(
        "field-subsidiary-exemption",
        "Specified subsidiary exemptions may apply.",
      ),
    ];
    const sourceDerived = interpretationFor(packet, sourceHandoff);
    sourceDerived.snapshot = {
      intro: blockFor("field-dollar-threshold", componentText),
      keyPoints: supportingPoints,
    };
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    host.snapshot.keyPoints = supportingPoints;
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:7123456789abcdef",
    );

    expect(integrated.interpretation?.snapshot.keyPoints).toEqual(
      host.snapshot.keyPoints,
    );
    expect(integrated.interpretation?.snapshot.keyPoints).not.toContainEqual(
      sourceDerived.snapshot.intro,
    );
  });

  it("preserves the exact validated host snapshot at the six-point cap", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      overview: [
        proposal(
          "overview",
          "field-context-primary",
          "Primary context",
          "The measure created a statewide privacy framework.",
          false,
        ),
        proposal(
          "overview",
          "field-context-secondary",
          "Secondary context",
          "The measure also established administrative responsibilities.",
          false,
        ),
      ],
      component: [proposal(
        "component",
        "field-consumer-rights",
        "Consumer rights",
        "Consumers may request disclosure of covered personal information.",
        true,
      )],
      timeline: [timeline(
        "field-operative",
        "effective",
        "2020-01-01",
      )],
      eligibility: [
        proposal(
          "eligibility",
          "field-general-coverage",
          "General coverage",
          "Qualifying for-profit entities doing business in California were covered.",
          true,
        ),
        proposal(
          "eligibility",
          "field-original-thresholds",
          "Original eligibility thresholds",
          "Annual gross revenue over $25 million; processing personal information for 50,000 or more consumers; or deriving 50 percent or more of annual revenues from selling consumers' personal information.",
          true,
        ),
      ],
      amendment: [proposal(
        "amendment",
        "field-later-amendment",
        "Later amendment",
        "A later amendment changed the historical coverage thresholds.",
        true,
      )],
    });
    const blockFor = (
      proposalId: string,
      text: string,
    ): Screen03Interpretation["snapshot"]["intro"] => ({
      text,
      proposalIds: [proposalId],
      passageIds: ["research-source:passage:1"],
      evidenceIds: ["research-source"],
    });
    const rights = blockFor(
      "field-consumer-rights",
      "Consumers may request disclosure of covered personal information.",
    );
    const generalCoverage = blockFor(
      "field-general-coverage",
      "Qualifying for-profit entities doing business in California were covered.",
    );
    const operativeDate = blockFor(
      "field-operative",
      "The law became operative on 2020-01-01.",
    );
    const amendment = blockFor(
      "field-later-amendment",
      "A later amendment changed the historical coverage thresholds.",
    );
    const primaryContext = blockFor(
      "field-context-primary",
      "The measure created a statewide privacy framework.",
    );
    const secondaryContext = blockFor(
      "field-context-secondary",
      "The measure also established administrative responsibilities.",
    );
    const thresholds = blockFor(
      "field-original-thresholds",
      "Original eligibility thresholds: annual gross revenue over $25 million; processing personal information for 50,000 or more consumers; or deriving 50 percent or more of annual revenues from selling consumers' personal information.",
    );
    const sourceDerived = interpretationFor(packet, sourceHandoff);
    sourceDerived.snapshot.keyPoints = [
      rights,
      generalCoverage,
      operativeDate,
      amendment,
      primaryContext,
      thresholds,
    ];
    packet.interpretation = sourceDerived;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const host = interpretationFor(packet, sourceHandoff);
    host.origin = "chatgpt-host";
    host.snapshot.keyPoints = [
      rights,
      generalCoverage,
      operativeDate,
      amendment,
      primaryContext,
      secondaryContext,
    ];
    const integrated = integrateScreen03HostInterpretation(
      state,
      host,
      "2026-08-10T12:00:03.000Z",
      "fnv1a64:5123456789abcdef",
    );
    const keyPoints = integrated.interpretation?.snapshot.keyPoints ?? [];

    expect(keyPoints).toHaveLength(6);
    expect(keyPoints).toEqual(host.snapshot.keyPoints);
    expect(keyPoints).toContainEqual(operativeDate);
    expect(keyPoints).toContainEqual(secondaryContext);
    expect(keyPoints).not.toContainEqual(thresholds);
    expect(integrated.revision).toBe(state.revision + 1);
  });

  it("upgrades unavailable reader help to Workers AI without reopening decisions and never downgrades it", () => {
    const sourceHandoff = handoff();
    const unavailablePacket = researchPacket(sourceHandoff);
    unavailablePacket.interpretation = unavailableInterpretationFor(
      unavailablePacket,
      sourceHandoff,
    );
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      unavailablePacket,
      "2026-08-10T12:00:02.000Z",
    );
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "reject",
      reason: "Preserve this decision while reader help is upgraded.",
    }, "2026-08-10T12:00:03.000Z");

    const interpretedPacket = researchPacket(sourceHandoff);
    interpretedPacket.interpretation = interpretationFor(
      interpretedPacket,
      sourceHandoff,
    );
    const upgraded = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      interpretedPacket,
      "2026-08-10T12:00:04.000Z",
    );

    expect(upgraded.interpretation?.origin).toBe("workers-ai");
    expect(upgraded.proposals.identity[0]?.reviewStatus).toBe("rejected");
    expect(upgraded.history.at(-1)?.action).toBe("context-refreshed");

    const laterUnavailablePacket = researchPacket(sourceHandoff);
    laterUnavailablePacket.interpretation = unavailableInterpretationFor(
      laterUnavailablePacket,
      sourceHandoff,
    );
    const preserved = refreshScreen03StateFromResearch(
      upgraded,
      sourceHandoff,
      laterUnavailablePacket,
      "2026-08-10T12:00:05.000Z",
    );
    expect(preserved).toStrictEqual(upgraded);
  });

  it("persists a claim-targeted official-support result even when research substance is unchanged", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    packet.coverage.queries[0]!.purpose =
      "Verify identity and the operative application clock. target-proposal:field-canonical-title";
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const searched = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      packet,
      "2026-08-10T12:00:03.000Z",
      "field-canonical-title",
    );

    expect(searched.revision).toBe(state.revision + 1);
    expect(searched.directSupportSearches).toEqual([
      expect.objectContaining({
        proposalId: "field-canonical-title",
        previousSupport: "direct",
        resultingSupport: "direct",
        resultingConfirmable: true,
        outcome: "direct-support-found",
        evidenceIds: ["research-source"],
        passageIds: ["research-source:passage:1"],
        queryIds: ["query-operative-record"],
      }),
    ]);
    expect(searched.history.at(-1)).toMatchObject({
      action: "direct-support-searched",
      actor: "research-service",
      targetId: "field-canonical-title",
      value: searched.directSupportSearches![0]!.id,
    });
    const searchRecord = searched.directSupportSearches![0]!;
    expect(searchRecord.resultBindingFingerprint).toMatch(/^fnv1a64:/u);
    expect(
      screen03DirectSupportSearchResultIsCurrent(searchRecord, searched),
    ).toBe(true);
    expect(requireScreen03VerificationState(searched)).toStrictEqual(searched);

    const changedPacket = cloneFixture(packet);
    changedPacket.researchedAt = "2026-08-10T12:00:03.500Z";
    changedPacket.evidence[0]!.retrievedAt = changedPacket.researchedAt;
    changedPacket.coverage.channels[0]!.retrievedAt =
      changedPacket.researchedAt;
    changedPacket.evidence[0]!.contentFingerprint = evidenceFingerprint(
      "same-source-new-content-after-targeted-search",
    );
    changedPacket.evidence[0]!.passages[0]!.text +=
      " The official repository now serves a revised source version.";
    const refreshedAfterEvidenceChange = refreshScreen03StateFromResearch(
      searched,
      sourceHandoff,
      changedPacket,
      changedPacket.researchedAt,
    );
    expect(refreshedAfterEvidenceChange.directSupportSearches).toStrictEqual(
      searched.directSupportSearches,
    );
    expect(screen03DirectSupportSearchResultIsCurrent(
      refreshedAfterEvidenceChange.directSupportSearches![0]!,
      refreshedAfterEvidenceChange,
    )).toBe(false);

    const invalidated = act(searched, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("changed-after-targeted-search"),
      reason: "The official source changed after the targeted search.",
    }, "2026-08-10T12:00:04.000Z");
    expect(invalidated.directSupportSearches).toStrictEqual(
      searched.directSupportSearches,
    );
    expect(screen03DirectSupportSearchResultIsCurrent(
      invalidated.directSupportSearches![0]!,
      invalidated,
    )).toBe(false);

    const tampered = cloneFixture(searched);
    tampered.directSupportSearches![0]!.outcome = "no-direct-support-found";
    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it("merges newly validated claim explanations across same-evidence refreshes", () => {
    const sourceHandoff = handoff();
    const overview = proposal(
      "overview",
      "field-overview",
      "What changed",
      "The regulation establishes documented obligations for covered organizations.",
      true,
    );
    const originalPacket = researchPacket(sourceHandoff, {
      overview: [overview],
    });
    originalPacket.interpretation = interpretationFor(
      originalPacket,
      sourceHandoff,
    );
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      originalPacket,
      "2026-08-10T12:00:02.000Z",
    );

    const refreshedPacket = researchPacket(sourceHandoff, {
      overview: [overview],
    });
    const refreshedInterpretation = interpretationFor(
      refreshedPacket,
      sourceHandoff,
    );
    const refreshedProposal = refreshedPacket.proposals.overview[0]!;
    const passageId = refreshedProposal.passageIds[0]!;
    const evidenceId = refreshedPacket.evidence.find((item) =>
      item.passages.some((passage) => passage.id === passageId)
    )!.id;
    refreshedInterpretation.claimExplanations = [{
      proposalId: refreshedProposal.id,
      proposalFingerprint:
        fingerprintScreen03ProposalForInterpretation(refreshedProposal),
      text:
        "This means covered organizations receive a concrete set of duties to follow.",
      passageIds: [passageId],
      evidenceIds: [evidenceId],
    }];
    refreshedInterpretation.limitations = [
      "The second bounded pass supplied a different validated explanation.",
    ];
    refreshedPacket.interpretation = refreshedInterpretation;

    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      refreshedPacket,
      "2026-08-10T12:00:03.000Z",
    );

    expect(
      refreshed.interpretation?.claimExplanations.map((item) => item.proposalId),
    ).toEqual(["field-canonical-title", "field-overview"]);
    expect(refreshed.history.at(-1)?.action).toBe("context-refreshed");
    expect(refreshed.proposals).toStrictEqual(state.proposals);
    expect(refreshed.lockedEventCard).toBe(state.lockedEventCard);
  });

  it("clears an interpretation when one of its source records changes", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    packet.interpretation = interpretationFor(packet, sourceHandoff);
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    const changed = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("changed-operative-record"),
      reason: "The official record changed after interpretation.",
    }, "2026-08-10T12:00:03.000Z");

    expect(changed.interpretation).toBeUndefined();
    expect(restoreScreen03VerificationState(changed)).not.toBeNull();
  });

  it("canonicalizes a valid v4 handoff source with a date-only retrieval record", () => {
    const sourceHandoff = cloneFixture(handoff());
    const source = sourceHandoff.sources[0]!;
    source.retrievedAt = "2026-07-29";
    source.sourceFingerprint = fingerprintScreen02WorkflowSource(source);
    const {
      handoffFingerprint: _handoffFingerprint,
      ...integrityWithoutHandoff
    } = sourceHandoff.integrity;
    sourceHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({
        ...sourceHandoff,
        integrity: integrityWithoutHandoff,
      });
    const validHandoff = JSON.parse(
      serializeScreen02WorkflowHandoff(sourceHandoff),
    ) as Screen02WorkflowHandoff;

    const state = createScreen03LoadingState(validHandoff, openedAt);

    expect(state.evidence[0]?.retrievedAt).toBe(
      "2026-07-29T00:00:00.000Z",
    );
    expect(restoreScreen03VerificationState(state)).not.toBeNull();
  });

  it("opens a connector-enriched v4 handoff with a labelled publication date", () => {
    const sourceHandoff = cloneFixture(handoff());
    const existingLead = sourceHandoff.event.dateLeads[0]!;
    sourceHandoff.event.dateLeads.push({
      ...existingLead,
      id: "fr-2020-93001:publication-date",
      date: "Publication date: 2020-01-01",
      label: "Federal Register publication date lead",
    });
    sourceHandoff.unresolved.provisionalClaimIds = [
      sourceHandoff.event.description.id,
      ...sourceHandoff.event.dateLeads.map((lead) => lead.id),
      ...sourceHandoff.event.broadCoverage.map((claim) => claim.id),
      ...sourceHandoff.event.highLevelChanges.map((claim) => claim.id),
      ...sourceHandoff.event.keyComponents.map((claim) => claim.id),
    ];
    sourceHandoff.integrity.eventFingerprint =
      fingerprintScreen02WorkflowValue(sourceHandoff.event);
    const {
      handoffFingerprint: _handoffFingerprint,
      ...integrityWithoutHandoff
    } = sourceHandoff.integrity;
    sourceHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({
        ...sourceHandoff,
        integrity: integrityWithoutHandoff,
      });
    const validHandoff = JSON.parse(
      serializeScreen02WorkflowHandoff(sourceHandoff),
    ) as Screen02WorkflowHandoff;

    const state = createScreen03LoadingState(validHandoff, openedAt);

    expect(state.proposals.timeline.at(-1)).toMatchObject({
      date: "2020-01-01",
      value: "2020-01-01",
      stage: existingLead.stage,
    });
    expect(restoreScreen03VerificationState(state)).not.toBeNull();
  });

  it.each([
    "Spring 2018",
    "Implementation window: 2018-05-01 through 2018-05-25",
  ])(
    "keeps an unstructured carried date visible without guessing or blocking Screen 3: %s",
    (unstructuredDate) => {
      const sourceHandoff = cloneFixture(handoff());
      sourceHandoff.event.dateLeads[0]!.date = unstructuredDate;
      sourceHandoff.integrity.eventFingerprint =
        fingerprintScreen02WorkflowValue(sourceHandoff.event);
      const {
        handoffFingerprint: _handoffFingerprint,
        ...integrityWithoutHandoff
      } = sourceHandoff.integrity;
      sourceHandoff.integrity.handoffFingerprint =
        fingerprintScreen02WorkflowValue({
          ...sourceHandoff,
          integrity: integrityWithoutHandoff,
        });
      const validHandoff = JSON.parse(
        serializeScreen02WorkflowHandoff(sourceHandoff),
      ) as Screen02WorkflowHandoff;

      const state = createScreen03LoadingState(validHandoff, openedAt);

      expect(state.proposals.timeline).toEqual([]);
      expect(
        state.proposals.requiredVariable.some((proposal) =>
          proposal.value.includes(unstructuredDate),
        ),
      ).toBe(true);
      expect(restoreScreen03VerificationState(state)).not.toBeNull();
    },
  );

  it("opens and integrates research for the maximum 100-source Audit v4 handoff", () => {
    const sourceHandoff = maximumAuditSourceHandoff();
    const loading = createScreen03LoadingState(
      sourceHandoff,
      openedAt,
    );

    expect(sourceHandoff.event.sourceIds).toHaveLength(100);
    expect(loading.evidence).toHaveLength(100);
    expect(loading.proposals.identity[0]?.sourceIds).toHaveLength(
      100,
    );
    expect(restoreScreen03VerificationState(loading)).not.toBeNull();

    const packet = researchPacket(sourceHandoff, {
      identity: [],
      timeline: [],
    });
    const firstEvidence = packet.evidence[0];
    for (let index = 2; index <= 5; index += 1) {
      const id = `research-source-${index}`;
      packet.evidence.push({
        ...cloneFixture(firstEvidence),
        id,
        sourceId: id,
        title: `Official research source ${index}`,
        contentFingerprint: evidenceFingerprint(id),
        passages: [
          {
            ...cloneFixture(firstEvidence.passages[0]),
            id: `${id}:passage:1`,
          },
        ],
      });
    }
    packet.coverage.queries[0].returnedEvidenceIds =
      packet.evidence.map((item) => item.id);
    packet.coverage.recordsReviewed = packet.evidence.length;
    packet.coverage.activeEvidenceCount = packet.evidence.length;

    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    expect(state.status).toBe("reviewing");
    expect(state.evidence).toHaveLength(105);
    expect(state.researchCoverage.activeEvidenceCount).toBe(105);
    expect(state.proposals.identity[0]?.sourceIds).toHaveLength(
      100,
    );
    expect(restoreScreen03VerificationState(state)).not.toBeNull();
  });

  it("deduplicates a normalized carried source without orphaning fallback references", () => {
    const sourceHandoff = handoff();
    const carriedSource = sourceHandoff.sources[0]!;
    const packet = researchPacket(sourceHandoff, {
      identity: [],
      timeline: [],
    });
    const normalized = packet.evidence[0]!;
    normalized.id = "screen03-evidence-gdpr-official-test";
    normalized.sourceId = carriedSource.id;
    normalized.locator = carriedSource.locator;
    normalized.passages[0]!.id = `${normalized.id}:passage:1`;
    packet.coverage.queries[0]!.returnedEvidenceIds = [normalized.id];

    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    const fallbackProposals = [
      ...state.proposals.identity,
      ...state.proposals.timeline,
    ];

    expect(state.evidence.map((item) => item.id)).toEqual([normalized.id]);
    expect(state.researchCoverage.queries[0]!.returnedEvidenceIds).toEqual([
      normalized.id,
    ]);
    expect(fallbackProposals.length).toBeGreaterThan(0);
    expect(fallbackProposals.every((proposal) =>
      proposal.sourceIds.includes(carriedSource.id) &&
      proposal.passageIds.every((id) =>
        normalized.passages.some((passage) => passage.id === id)
      )
    )).toBe(true);

    const expectedFingerprint = evidenceFingerprint("normalized-source-v2");
    const marked = act(state, {
      type: "mark-source-changed",
      sourceId: normalized.id,
      contentFingerprint: expectedFingerprint,
      reason: "The normalized carried source now has a new body.",
    }, "2026-08-10T12:00:03.000Z");
    const replacement = cloneFixture(packet);
    replacement.researchedAt = "2026-08-10T12:00:04.000Z";
    replacement.evidence[0]!.retrievedAt = replacement.researchedAt;
    replacement.evidence[0]!.contentFingerprint = expectedFingerprint;
    replacement.evidence[0]!.passages[0]!.text += " Renewed source body.";
    replacement.coverage.channels[0]!.retrievedAt =
      replacement.researchedAt;
    const refreshed = refreshScreen03StateFromResearch(
      marked,
      sourceHandoff,
      replacement,
      replacement.researchedAt,
    );

    expect(refreshed.evidence.filter((item) => item.status !== "changed"))
      .toEqual([expect.objectContaining({
        id: normalized.id,
        sourceId: carriedSource.id,
        contentFingerprint: expectedFingerprint,
      })]);
    expect(restoreScreen03VerificationState(refreshed)).not.toBeNull();
  });

  it("normalizes bounded research without auto-confirming any proposal", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    expect(restoreScreen03ResearchPacket(packet)).not.toBeNull();

    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    expect(state.status).toBe("reviewing");
    expect(state.researchCoverage.status).toBe("completed");
    expect(state.evidence.map((item) => item.id)).toEqual([
      "gdpr-official",
      "research-source",
    ]);
    expect(state.proposals.identity[0].reviewStatus).toBe("proposed");
    expect(state.history.at(-1)?.action).toBe("research-integrated");
  });

  it("preserves legacy states without context leads and validates the optional context lane", () => {
    const sourceHandoff = handoff();
    const legacyPacket = researchPacket(sourceHandoff);
    expect(Object.hasOwn(legacyPacket, "contextLeads")).toBe(false);
    expect(restoreScreen03ResearchPacket(legacyPacket)).not.toBeNull();

    const packet = cloneFixture(legacyPacket);
    packet.contextLeads = [{
      id: "context-gdpr-implementation",
      title: "Reporting on GDPR implementation",
      locator: "https://press.example.test/gdpr-implementation",
      publisher: "Example Press",
      publishedDate: "2026-08-01",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Discovery lead only; verify against direct evidence.",
    }];
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    expect(state.contextLeads).toStrictEqual(packet.contextLeads);
    expect(restoreScreen03VerificationState(state)).not.toBeNull();

    const legacyState = cloneFixture(state) as Screen03VerificationState & {
      contextLeads?: Screen03VerificationState["contextLeads"];
    };
    delete legacyState.contextLeads;
    const { integrity: _integrity, ...legacyFingerprintInput } = legacyState;
    legacyState.integrity.stateFingerprint =
      fingerprintScreen03Value(legacyFingerprintInput);
    expect(restoreScreen03VerificationState(legacyState)).not.toBeNull();

    const invalidDate = cloneFixture(packet);
    invalidDate.contextLeads![0]!.publishedDate = "2026-02-30";
    expect(restoreScreen03ResearchPacket(invalidDate)).toBeNull();
    const insecureLocator = cloneFixture(packet);
    insecureLocator.contextLeads![0]!.locator = "http://press.example.test/story";
    expect(restoreScreen03ResearchPacket(insecureLocator)).toBeNull();
  });

  it("rejects stale research, invalid dates, unknown fields, and integrity tampering", () => {
    const sourceHandoff = handoff();
    const stalePacket = cloneFixture(researchPacket(sourceHandoff));
    stalePacket.upstreamEventFingerprint = evidenceFingerprint("another-event");
    expect(() => buildScreen03StateFromResearch(sourceHandoff, stalePacket, "2026-08-10T12:00:02.000Z")).toThrow(/different Screen 2 event/);

    const invalidPacket = cloneFixture(researchPacket(sourceHandoff));
    invalidPacket.proposals.timeline[0].date = "2018-02-30";
    invalidPacket.proposals.timeline[0].value = "2018-02-30";
    expect(restoreScreen03ResearchPacket(invalidPacket)).toBeNull();

    const state = researchedState();
    const unknown = cloneFixture(state) as Screen03VerificationState & { surprise?: boolean };
    unknown.surprise = true;
    expect(restoreScreen03VerificationState(unknown)).toBeNull();
    const tampered = cloneFixture(state);
    tampered.eventIdentity.canonicalTitle = "Tampered event";
    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it.each(["source-conflict", "scope-conflict"] as const)(
    "rejects a fingerprint-valid restored state whose unresolved %s leaves an implicated claim nonconflicting",
    (kind) => {
      const injected = cloneFixture(researchedState());
      const implicated = injected.proposals.identity[0]!;
      expect(implicated.support).toBe("direct");
      injected.contradictions.push({
        id: `injected-${kind}`,
        kind,
        proposalIds: [implicated.id],
        summary: "Injected official evidence conflict.",
        status: "unresolved",
        resolution: null,
      });
      const { integrity: _integrity, ...fingerprintInput } = injected;
      injected.integrity.stateFingerprint = fingerprintScreen03Value(
        fingerprintInput,
      );

      expect(restoreScreen03VerificationState(injected)).toBeNull();
      expect(() => requireScreen03VerificationState(injected)).toThrow(
        /failed its exact contract/i,
      );

      implicated.support = "conflicting";
      const { integrity: _oldIntegrity, ...conflictingInput } = injected;
      injected.integrity.stateFingerprint = fingerprintScreen03Value(
        conflictingInput,
      );
      expect(requireScreen03VerificationState(injected)).toStrictEqual(
        injected,
      );

      const changed = act(injected, {
        type: "mark-source-changed",
        sourceId: "research-source",
        contentFingerprint: evidenceFingerprint(`changed-${kind}`),
        reason: "The implicated official source changed after retrieval.",
      }, "2026-08-10T12:00:03.000Z");
      expect(changed.proposals.identity[0]).toMatchObject({
        support: "unsupported",
        reviewStatus: "proposed",
      });
      expect(changed.contradictions.at(-1)).toMatchObject({
        id: `injected-${kind}`,
        status: "resolved",
        resolution: expect.stringMatching(
          /no longer active.*historical disagreement.*renewed retrieval/i,
        ),
      });
      expect(changed.sourceChanges?.at(-1)?.staleProposals).toContainEqual(
        expect.objectContaining({
          id: implicated.id,
          support: "conflicting",
        }),
      );
      expect(requireScreen03VerificationState(changed)).toStrictEqual(changed);
    },
  );

  it("requires direct exact passages for critical acceptance and validates edited calendar dates", () => {
    const indirect = proposal("identity", "field-canonical-title", "Canonical title", "General Data Protection Regulation", true, "indirect");
    const state = researchedState({ identity: [indirect] });
    expect(() => act(state, {
      type: "review-field",
      proposalId: indirect.id,
      decision: "accept",
      reason: "Accept the title.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/direct passage support/);

    const direct = researchedState();
    expect(() => act(direct, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "edit",
      editedValue: "2018-02-30",
      reason: "Try an impossible date.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/real YYYY-MM-DD/);
  });

  it("classifies confirmation with reason codes shared by individual, bulk, and lock gates", () => {
    const completeComponent = proposal(
      "component",
      "field-complete-component",
      "Operative duty",
      "Covered businesses must provide consumers with a complete response.",
      true,
    );
    const state = researchedState({ component: [completeComponent] });
    const component = state.proposals.component[0]!;

    expect(
      screen03ProposalHasActiveDirectSupport(component, state.evidence),
    ).toBe(true);
    expect(
      screen03ProposalConfirmability(component, state.evidence),
    ).toEqual({ confirmable: true, reason: "confirmable" });
    expect(screen03ProposalConfirmability(
      {
        ...component,
        value:
          "covered businesses must provide consumers with a complete response.",
      },
      state.evidence,
    )).toEqual({ confirmable: true, reason: "confirmable" });

    expect(screen03ProposalConfirmability(
      { ...component, support: "indirect" },
      state.evidence,
    )).toEqual({ confirmable: false, reason: "no-direct-support" });
    expect(screen03ProposalConfirmability(
      { ...component, passageIds: [] },
      state.evidence,
    )).toEqual({ confirmable: false, reason: "no-direct-support" });

    const changedEvidence = cloneFixture(state.evidence);
    changedEvidence.find((item) =>
      item.passages.some((passage) =>
        component.passageIds.includes(passage.id)
      )
    )!.status = "changed";
    expect(
      screen03ProposalHasActiveDirectSupport(component, changedEvidence),
    ).toBe(false);
    expect(
      screen03ProposalConfirmability(component, changedEvidence),
    ).toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const metadataEvidence = cloneFixture(state.evidence);
    const metadataPassage = metadataEvidence
      .flatMap((item) => item.passages)
      .find((passage) => component.passageIds.includes(passage.id));
    if (!metadataPassage) throw new Error("Expected the cited component passage.");
    metadataPassage.basis = "source-metadata";
    expect(
      screen03ProposalConfirmability(component, metadataEvidence),
    ).toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const officialFieldEvidence = cloneFixture(state.evidence);
    const componentOfficialField = officialFieldEvidence
      .flatMap((item) => item.passages)
      .find((passage) => component.passageIds.includes(passage.id));
    if (!componentOfficialField) throw new Error("Expected component evidence.");
    componentOfficialField.basis = "official-record-field";
    expect(screen03ProposalConfirmability(component, officialFieldEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const identity = state.proposals.identity[0]!;
    const identityOfficialFieldEvidence = cloneFixture(state.evidence);
    const identityPassage = identityOfficialFieldEvidence
      .flatMap((item) => item.passages)
      .find((passage) => identity.passageIds.includes(passage.id));
    if (!identityPassage) throw new Error("Expected identity evidence.");
    identityPassage.basis = "official-record-field";
    identityPassage.officialField = "canonical-title";
    expect(
      screen03ProposalConfirmability(identity, identityOfficialFieldEvidence),
    ).toEqual({ confirmable: true, reason: "confirmable" });
    identityPassage.officialField = "issuer";
    expect(
      screen03ProposalConfirmability(identity, identityOfficialFieldEvidence),
    ).toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const officialDocumentEvidence = cloneFixture(state.evidence);
    const documentPassage = officialDocumentEvidence
      .flatMap((item) => item.passages)
      .find((passage) => component.passageIds.includes(passage.id));
    if (!documentPassage) throw new Error("Expected document evidence.");
    documentPassage.basis = "official-document-passage";
    expect(screen03ProposalConfirmability(component, officialDocumentEvidence))
      .toEqual({ confirmable: true, reason: "confirmable" });

    const contextualEvidence = cloneFixture(state.evidence);
    const contextualPassage = contextualEvidence
      .flatMap((item) => item.passages)
      .find((passage) => component.passageIds.includes(passage.id));
    if (!contextualPassage) throw new Error("Expected contextual evidence.");
    contextualPassage.basis = "contextual-secondary";
    expect(screen03ProposalConfirmability(component, contextualEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const tierThreeEvidence = cloneFixture(state.evidence);
    tierThreeEvidence.find((item) => item.passages.some((passage) =>
      component.passageIds.includes(passage.id)
    ))!.authorityTier = 3;
    expect(screen03ProposalConfirmability(component, tierThreeEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const researcherEvidence = cloneFixture(state.evidence);
    researcherEvidence.find((item) => item.passages.some((passage) =>
      component.passageIds.includes(passage.id)
    ))!.channel +=
      " · source role: researcher supplied record";
    expect(screen03ProposalConfirmability(component, researcherEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const precursorEvidence = cloneFixture(state.evidence);
    precursorEvidence.find((item) => item.passages.some((passage) =>
      component.passageIds.includes(passage.id)
    ))!.sourceRole = "precursor-official-record";
    const typedPrecursor = precursorEvidence.find((item) =>
      item.passages.some((passage) => component.passageIds.includes(passage.id))
    )!;
    expect(screen03EvidenceItemProvidesDirectSupportForProposal(
      typedPrecursor,
      { group: "timeline", label: "announcement", stage: "announcement" },
    )).toBe(true);
    expect(screen03EvidenceItemProvidesDirectSupportForProposal(
      typedPrecursor,
      { group: "timeline", label: "enactment", stage: "enactment" },
    )).toBe(false);
    expect(screen03EvidenceItemProvidesDirectSupportForProposal(
      typedPrecursor,
      { group: "identity", label: "Canonical event title" },
    )).toBe(false);
    expect(screen03ProposalConfirmability(component, precursorEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    const retainedPrecursorEvidence = cloneFixture(state.evidence);
    const retainedPrecursor = retainedPrecursorEvidence.find((item) =>
      item.passages.some((passage) => component.passageIds.includes(passage.id))
    )!;
    delete retainedPrecursor.sourceRole;
    retainedPrecursor.channel += " · source role: precursor official record";
    expect(screen03ProposalConfirmability(component, retainedPrecursorEvidence))
      .toEqual({ confirmable: false, reason: "inactive-direct-support" });

    expect(screen03ProposalConfirmability(
      component,
      state.evidence,
      "A partial compliance statement ending with and",
    )).toEqual({ confirmable: false, reason: "incomplete-component" });
    expect(screen03ProposalConfirmability(
      component,
      state.evidence,
      "Covered businesses must publish a different complete response.",
    )).toEqual({
      confirmable: false,
      reason: "reviewed-value-not-supported",
    });

    expect(screen03ProposalConfirmability(
      state.proposals.timeline[0]!,
      state.evidence,
    )).toEqual({ confirmable: true, reason: "confirmable" });
    expect(screen03ProposalConfirmability(
      state.proposals.timeline[0]!,
      state.evidence,
      "2018-05-26",
      true,
    )).toEqual({
      confirmable: false,
      reason: "reviewed-value-not-supported",
    });
  });

  it("validates and applies exact host evidence mappings without recording a researcher decision", () => {
    const state = researchedState();
    const claim = state.proposals.identity[0]!;
    const owner = state.evidence.find((evidence) =>
      evidence.passages.some((passage) => claim.passageIds.includes(passage.id))
    )!;
    const passage = owner.passages.find((candidate) =>
      claim.passageIds.includes(candidate.id)
    )!;
    const start = passage.text.indexOf(claim.value);
    expect(start).toBeGreaterThanOrEqual(0);
    const input = [{
      claimId: claim.id,
      passageIds: [passage.id],
      quotedSpans: [{
        passageId: passage.id,
        start,
        end: start + claim.value.length,
        text: claim.value,
      }],
      status: "direct",
    }];
    expect(restoreScreen03HostEvidenceMappings(input, state)).toEqual(input);
    const mapped = applyScreen03HostEvidenceMappings(state, input);
    expect(mapped.identity[0]).toMatchObject({
      support: "direct",
      reviewStatus: "proposed",
      editedValue: null,
      passageIds: [passage.id],
      sourceIds: [owner.id],
    });
    expect(buildScreen03SupportedFacts({ ...state, proposals: mapped }))
      .toContainEqual(expect.objectContaining({ claimId: claim.id }));
    expect(restoreScreen03HostEvidenceMappings([{
      ...input[0],
      quotedSpans: [{ ...input[0].quotedSpans[0], text: "tampered" }],
    }], state)).toBeNull();

    const precursorState = cloneFixture(state);
    const precursorOwner = precursorState.evidence.find((evidence) =>
      evidence.passages.some((candidate) => candidate.id === passage.id)
    )!;
    precursorOwner.sourceRole = "precursor-official-record";
    const precursorPassage = precursorOwner.passages.find(
      (candidate) => candidate.id === passage.id,
    )!;
    precursorPassage.basis = "official-record-field";
    precursorPassage.officialField = "canonical-title";
    expect(restoreScreen03HostEvidenceMappings(input, precursorState)).toBeNull();
  });

  it("records and idempotently replays a canonical marker when a host mapping leaves the graph unchanged", () => {
    const state = researchedState();
    const claimGroupId = "screen03-claims:no-change";
    const resultId = "host-result:no-change";
    const applicationBindingFingerprint = fingerprintScreen03Value({
      taskId: "host-task:no-change",
      resultId,
    });
    const applied = integrateScreen03HostEvidenceMappings(state, [], {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:03.000Z",
    });

    expect(applied.duplicate).toBe(false);
    expect(applied.state.proposals).toEqual(state.proposals);
    expect(applied.state.revision).toBe(state.revision + 1);
    expect(applied.state.integrity.stateFingerprint).not.toBe(
      state.integrity.stateFingerprint,
    );
    expect(applied.state.history.at(-1)).toMatchObject({
      action: "host-evidence-mapping-applied",
      actor: "chatgpt-host",
      targetId: claimGroupId,
      value: resultId,
      previousReviewStatus: null,
      nextReviewStatus: null,
    });

    const replayed = integrateScreen03HostEvidenceMappings(applied.state, [], {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:04.000Z",
    });
    expect(replayed).toEqual({ state: applied.state, duplicate: true });
    expect(replayed.state.history.filter((event) =>
      event.action === "host-evidence-mapping-applied" &&
      event.value === resultId
    )).toHaveLength(1);
    expect(() => integrateScreen03HostEvidenceMappings(applied.state, [], {
      claimGroupId: "screen03-claims:different",
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:04.000Z",
    })).toThrow(/already bound/i);
  });

  it("rejects reusing a host evidence result for a different canonical graph", () => {
    const identity = proposal(
      "identity",
      "field-canonical-title",
      "Canonical title",
      "General Data Protection Regulation",
      true,
      "indirect",
    );
    const state = researchedState({ identity: [identity], timeline: [] });
    const claimGroupId = "screen03-claims:graph-change";
    const resultId = "host-result:graph-change";
    const applicationBindingFingerprint = fingerprintScreen03Value({
      taskId: "host-task:graph-change",
      resultId,
    });
    const marked = integrateScreen03HostEvidenceMappings(state, [], {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:03.000Z",
    });
    const owner = state.evidence.find((evidence) =>
      evidence.passages.some((passage) => identity.passageIds.includes(passage.id))
    )!;
    const passage = owner.passages.find((candidate) =>
      identity.passageIds.includes(candidate.id)
    )!;
    const start = passage.text.indexOf(identity.value);

    expect(() => integrateScreen03HostEvidenceMappings(marked.state, [{
      claimId: identity.id,
      passageIds: [passage.id],
      quotedSpans: [{
        passageId: passage.id,
        start,
        end: start + identity.value.length,
        text: identity.value,
      }],
      status: "direct",
    }], {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:04.000Z",
    })).toThrow(/already bound/i);
  });

  it("rejects replaying one result ID with a different mapping after its first mapping changed the graph", () => {
    const identity = proposal(
      "identity",
      "field-canonical-title",
      "Canonical title",
      "General Data Protection Regulation",
      true,
      "indirect",
    );
    const state = researchedState({ identity: [identity], timeline: [] });
    const owner = state.evidence.find((evidence) =>
      evidence.passages.some((passage) => identity.passageIds.includes(passage.id))
    )!;
    const passage = owner.passages.find((candidate) =>
      identity.passageIds.includes(candidate.id)
    )!;
    const start = passage.text.indexOf(identity.value);
    const mapping = [{
      claimId: identity.id,
      passageIds: [passage.id],
      quotedSpans: [{
        passageId: passage.id,
        start,
        end: start + identity.value.length,
        text: identity.value,
      }],
      status: "direct" as const,
    }];
    const claimGroupId = "screen03-claims:changed-first";
    const resultId = "host-result:changed-first";
    const applicationBindingFingerprint = fingerprintScreen03Value({
      taskId: "host-task:changed-first",
      resultId,
    });
    const applied = integrateScreen03HostEvidenceMappings(state, mapping, {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:03.000Z",
    });
    expect(applied.state.proposals.identity[0]?.support).toBe("direct");

    expect(() => integrateScreen03HostEvidenceMappings(applied.state, [], {
      claimGroupId,
      resultId,
      applicationBindingFingerprint,
      at: "2026-08-10T12:00:04.000Z",
    })).toThrow(/already bound/i);
  });

  it("blocks an incomplete individual acceptance while allowing a complete cited correction", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      component: [proposal(
        "component",
        "field-incomplete-component",
        "Operative duty",
        "A partial compliance statement ending with and",
        true,
      )],
    });
    const corrected =
      "Covered businesses must provide consumers with a complete response.";
    packet.evidence[0]!.passages[0]!.text += ` ${corrected}`;
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    expect(() => act(state, {
      type: "review-field",
      proposalId: "field-incomplete-component",
      decision: "accept",
      reason: "Do not accept an incomplete source fragment.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/complete source-backed statement/i);

    const bulkReviewed = act(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Use the shared confirmation classifier.",
    }, "2026-08-10T12:00:03.000Z");
    expect(bulkReviewed.proposals.component[0]).toMatchObject({
      reviewStatus: "proposed",
      editedValue: null,
    });

    const edited = act(state, {
      type: "review-field",
      proposalId: "field-incomplete-component",
      decision: "edit",
      editedValue: corrected,
      reason: "Replace the fragment with the complete cited sentence.",
    }, "2026-08-10T12:00:03.000Z");
    expect(edited.proposals.component[0]).toMatchObject({
      reviewStatus: "edited",
      editedValue: corrected,
    });
  });

  it.each([
    "25 May 2018",
    "May 25, 2018",
    "25th May 2018",
    "May 25th 2018",
    "25/05/2018",
    "05/25/2018",
    "5/25/2018",
    "2018/5/25",
  ])(
    "binds an edited ISO timeline date to an equivalent direct passage date: %s",
    (passageDate) => {
      const sourceHandoff = handoff();
      const packet = researchPacket(sourceHandoff);
      packet.evidence[0].passages[0].text =
        `The official record states that it applies from ${passageDate}.`;
      let state = buildScreen03StateFromResearch(
        sourceHandoff,
        packet,
        "2026-08-10T12:00:02.000Z",
      );

      state = act(state, {
        type: "review-field",
        proposalId: "field-effective",
        decision: "edit",
        editedValue: "2018-05-25",
        reason: "Normalize the directly stated official date to ISO format.",
      }, "2026-08-10T12:00:03.000Z");

      expect(state.proposals.timeline[0]).toMatchObject({
        reviewStatus: "edited",
        editedValue: "2018-05-25",
      });
    },
  );

  it.each([
    "05 September 2018",
    "September 05, 2018",
    "05th Sept. 2018",
    "Sep 05th, 2018",
  ])(
    "binds padded named-month and abbreviated dates without numeric-locale inference: %s",
    (passageDate) => {
      const sourceHandoff = handoff();
      const packet = researchPacket(sourceHandoff);
      packet.proposals.timeline[0].date = "2018-09-05";
      packet.proposals.timeline[0].value = "2018-09-05";
      packet.evidence[0].passages[0].text =
        `The official record states that it applies from ${passageDate}.`;
      let state = buildScreen03StateFromResearch(
        sourceHandoff,
        packet,
        "2026-08-10T12:00:02.000Z",
      );

      state = act(state, {
        type: "review-field",
        proposalId: "field-effective",
        decision: "edit",
        editedValue: "2018-09-05",
        reason: "Normalize the padded named-month date to ISO format.",
      }, "2026-08-10T12:00:03.000Z");

      expect(state.proposals.timeline[0]).toMatchObject({
        reviewStatus: "edited",
        editedValue: "2018-09-05",
      });
    },
  );

  it("rejects an edited ISO timeline date when the direct passage states a different natural-language date", () => {
    const state = researchedState();
    expect(() => act(state, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "edit",
      editedValue: "2018-05-26",
      reason: "Attempt to normalize an unsupported date.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(
      /must appear in an active direct passage/i,
    );
  });

  it.each(["06/05/2018", "05/06/2018"])(
    "does not guess the locale of an ambiguous numeric passage date: %s",
    (passageDate) => {
      const sourceHandoff = handoff();
      const packet = researchPacket(sourceHandoff);
      packet.proposals.timeline[0].date = "2018-05-06";
      packet.proposals.timeline[0].value = "2018-05-06";
      packet.evidence[0].passages[0].text =
        `The official record states that it applies from ${passageDate}.`;
      const state = buildScreen03StateFromResearch(
        sourceHandoff,
        packet,
        "2026-08-10T12:00:02.000Z",
      );

      expect(() => act(state, {
        type: "review-field",
        proposalId: "field-effective",
        decision: "accept",
        reason: "Do not infer a locale from ambiguous numeric text.",
      }, "2026-08-10T12:00:03.000Z")).toThrow(/exact phrase or equivalent date/);
    },
  );

  it("binds non-timeline edits to whole meaningful token phrases, not substrings", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    packet.evidence[0].passages[0].text =
      "The official record identifies the General Data Protection Regulation and describes the prior status as inactive.";
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );

    for (const editedValue of ["e", "active", "US"]) {
      expect(() => act(state, {
        type: "review-field",
        proposalId: "field-canonical-title",
        decision: "edit",
        editedValue,
        reason: "Attempt an ambiguous or embedded citation match.",
      }, "2026-08-10T12:00:03.000Z")).toThrow(
        /must appear in an active direct passage/i,
      );
    }

    const edited = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "edit",
      editedValue: "Data Protection Regulation",
      reason: "Use the exact meaningful phrase in the cited official passage.",
    }, "2026-08-10T12:00:03.000Z");
    expect(edited.proposals.identity[0]).toMatchObject({
      reviewStatus: "edited",
      editedValue: "Data Protection Regulation",
    });
  });

  it("rejects accepting a value that only appears embedded inside another token", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      identity: [
        proposal(
          "identity",
          "field-status",
          "Current status",
          "active",
          false,
        ),
      ],
    });
    packet.evidence[0].passages[0].text =
      "The official record says the prior measure is inactive.";
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    expect(() => act(state, {
      type: "review-field",
      proposalId: "field-status",
      decision: "accept",
      reason: "Attempt a substring-only acceptance.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(
      /accepted value must appear as an exact phrase/i,
    );
  });

  it("records every successive edited value in append-only review history", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff);
    packet.evidence[0].passages[0].text =
      "The record applies from 25 May 2018, with a correction stating 26 May 2018.";
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    state = act(state, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "edit",
      editedValue: "2018-05-25",
      reason: "Record the first cited date.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "edit",
      editedValue: "2018-05-26",
      reason: "Record the cited correction.",
    }, "2026-08-10T12:00:04.000Z");

    expect(state.history
      .filter((event) => event.targetId === "field-effective")
      .map((event) => event.value))
      .toEqual(["2018-05-25", "2018-05-26"]);
  });

  it("preserves rejected values and decisions before a later supported acceptance", () => {
    let state = researchedState();
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "reject",
      reason: "Recheck the title against the cited passage.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "The exact official passage supports the original title.",
    }, "2026-08-10T12:00:04.000Z");

    expect(state.proposals.identity[0]).toMatchObject({
      value: "General Data Protection Regulation",
      reviewStatus: "accepted",
      editedValue: null,
    });
    expect(state.history.filter((event) => event.targetId === "field-canonical-title").map((event) => [event.previousReviewStatus, event.nextReviewStatus])).toEqual([
      ["proposed", "rejected"],
      ["rejected", "accepted"],
    ]);
  });

  it("collects every reader-visible factual proposal group, including timeline", () => {
    const current = researchedState({
      overview: [proposal(
        "overview",
        "field-overview",
        "What happened",
        "The regulation established directly applicable data-protection duties.",
        true,
      )],
      component: [proposal(
        "component",
        "field-component",
        "What changed",
        "Covered controllers must follow the regulation's data-protection duties.",
        true,
      )],
      eligibility: [proposal(
        "eligibility",
        "field-coverage",
        "Who is covered",
        "Controllers processing personal data within the regulation's scope.",
        true,
      )],
      amendment: [proposal(
        "amendment",
        "field-amendment",
        "Later changes",
        "No later operative change was established by the bounded search.",
        true,
      )],
      requiredVariable: [proposal(
        "required-variable",
        "field-planning",
        "Planning input",
        "Construct a later unit-level coverage indicator.",
        false,
        "unsupported",
      )],
    });

    expect(screen03FactualClaims(current.proposals).map((item) => item.group))
      .toEqual([
        "identity",
        "overview",
        "timeline",
        "component",
        "eligibility",
        "amendment",
      ]);
  });

  it("atomically confirms only supported factual claims and leaves every evidence gap unchanged", () => {
    const unsupportedThreshold = {
      ...proposal(
        "eligibility",
        "field-threshold",
        "Eligibility thresholds",
        "Unknown — no verified threshold is established by the active packet.",
        false,
        "unsupported",
      ),
      sourceIds: [],
      passageIds: [],
    };
    const informational = {
      ...proposal(
        "required-variable",
        "field-required-variable",
        "Required downstream variable",
        "Unit-level exposure classification",
        false,
        "unsupported",
      ),
      sourceIds: [],
      passageIds: [],
    };
    let state = researchedState({
      overview: [proposal(
        "overview",
        "field-overview",
        "What happened",
        "The regulation established directly applicable data-protection duties.",
        true,
      )],
      component: [proposal(
        "component",
        "field-incomplete-component",
        "Event component",
        "A partial compliance statement ending with and",
        true,
      )],
      eligibility: [unsupportedThreshold],
      amendment: [proposal(
        "amendment",
        "field-indirect-amendment",
        "Amendments and delays",
        "A later amendment remains an indirect lead.",
        false,
        "indirect",
      )],
      requiredVariable: [informational],
    });
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "edit",
      editedValue: "Regulation (EU) 2016/679",
      reason: "Preserve the directly cited corrected title.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-overview",
      decision: "reject",
      reason: "Exercise bulk replacement of an earlier field decision.",
    }, "2026-08-10T12:00:04.000Z");

    const original = serializeScreen03VerificationState(state);
    const priorRevision = state.revision;
    const priorHistoryLength = state.history.length;
    const confirmed = act(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Confirm every source-backed claim and preserve evidence gaps.",
    }, "2026-08-10T12:00:05.000Z");

    expect(serializeScreen03VerificationState(state)).toBe(original);
    expect(confirmed.proposals.identity[0]).toMatchObject({
      reviewStatus: "edited",
      editedValue: "Regulation (EU) 2016/679",
    });
    expect(confirmed.proposals.overview[0]?.reviewStatus).toBe("rejected");
    expect(confirmed.proposals.timeline[0]?.reviewStatus).toBe("accepted");
    expect(confirmed.proposals.component[0]?.reviewStatus).toBe("proposed");
    expect(confirmed.proposals.eligibility[0]?.reviewStatus).toBe("proposed");
    expect(confirmed.proposals.amendment[0]?.reviewStatus).toBe("proposed");
    expect(confirmed.proposals.requiredVariable[0]).toMatchObject({
      reviewStatus: "proposed",
      editedValue: null,
    });
    expect(confirmed.revision).toBe(priorRevision + 1);
    expect(confirmed.history).toHaveLength(priorHistoryLength + 1);
    expect(confirmed.history.slice(-1).map((event) => [
      event.action,
      event.targetId,
      event.previousReviewStatus,
      event.nextReviewStatus,
    ])).toEqual([
      ["review-field", "field-effective", "proposed", "accepted"],
    ]);
    expect(requireScreen03VerificationState(confirmed)).toStrictEqual(confirmed);
    expect(() => act(confirmed, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Do not add a duplicate bulk-review revision.",
    }, "2026-08-10T12:00:06.000Z")).toThrow(/no directly supported.*awaiting bulk confirmation/i);
  });

  it("atomically unconfirms factual claims including timeline while preserving planning state", () => {
    const informational = {
      ...proposal(
        "required-variable",
        "field-required-variable",
        "Required downstream variable",
        "Unit-level exposure classification",
        false,
        "unsupported",
      ),
      sourceIds: [],
      passageIds: [],
    };
    let state = researchedState({
      overview: [proposal(
        "overview",
        "field-overview",
        "What happened",
        "The regulation established directly applicable data-protection duties.",
        true,
      )],
      requiredVariable: [informational],
    });
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "edit",
      editedValue: "Regulation (EU) 2016/679",
      reason: "Use the exact official identifier.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "accept",
      reason: "Record an explicit timeline decision before factual bulk review.",
    }, "2026-08-10T12:00:03.500Z");
    state = act(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Complete the bounded evidence review.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: [],
      reason: "Exercise removal of a previously retained compatibility clock.",
    }, "2026-08-10T12:00:05.000Z");

    const factualCount = 3;
    const priorRevision = state.revision;
    const priorHistoryLength = state.history.length;
    const unconfirmed = act(state, {
      type: "review-all-fields",
      mode: "unconfirm",
      reason: "Return every factual claim to review.",
    }, "2026-08-10T12:00:06.000Z");

    expect([
      ...unconfirmed.proposals.identity,
      ...unconfirmed.proposals.overview,
      ...unconfirmed.proposals.component,
      ...unconfirmed.proposals.eligibility,
      ...unconfirmed.proposals.amendment,
    ].every((item) =>
      item.reviewStatus === "proposed" && item.editedValue === null
    )).toBe(true);
    expect(unconfirmed.proposals.timeline[0]?.reviewStatus).toBe("proposed");
    expect(unconfirmed.proposals.requiredVariable[0]?.reviewStatus).toBe("proposed");
    expect(unconfirmed.focalClock).toEqual({
      selectedProposalId: null,
      alternativeProposalIds: [],
    });
    expect(unconfirmed.revision).toBe(priorRevision + factualCount);
    expect(unconfirmed.history).toHaveLength(priorHistoryLength + factualCount);
    expect(unconfirmed.history.slice(-factualCount).every((event) =>
      event.action === "review-field" && event.nextReviewStatus === "proposed"
    )).toBe(true);
    expect(requireScreen03VerificationState(unconfirmed)).toStrictEqual(unconfirmed);
    expect(() => act(unconfirmed, {
      type: "review-all-fields",
      mode: "unconfirm",
      reason: "Do not add a duplicate unconfirm revision.",
    }, "2026-08-10T12:00:07.000Z")).toThrow(/already unconfirmed/i);
  });

  it("rejects bulk review while research is loading, after lock, or when its append-only history has no capacity", () => {
    const loading = createScreen03LoadingState(handoff(), openedAt);
    expect(() => act(loading, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Do not decide fields before bounded research completes.",
    }, "2026-08-10T12:00:00.100Z")).toThrow(/research must complete/i);

    let locked = researchedState();
    locked = act(locked, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Review the directly supported identity and timing claims.",
    }, "2026-08-10T12:00:03.000Z");
    locked = act(locked, {
      type: "lock-event-card",
      reason: "Lock without requiring a selected focal date.",
    }, "2026-08-10T12:00:04.000Z");
    expect(locked.lockedEventCard?.focalClock.selected).toBeNull();
    expect(() => act(locked, {
      type: "review-all-fields",
      mode: "unconfirm",
      reason: "A locked Event Card must remain immutable.",
    }, "2026-08-10T12:00:05.000Z")).toThrow(/locked Event Card/i);

    const nearlyFullSeed = researchedState({
      overview: [proposal(
        "overview",
        "field-overview",
        "What happened",
        "The regulation established directly applicable data-protection duties.",
        true,
      )],
    });
    const nearlyFull = cloneFixture(nearlyFullSeed);
    const firstReviewAt = Date.parse("2026-08-10T12:01:00.000Z");
    const titleProposal = nearlyFull.proposals.identity.find(
      (item) => item.id === "field-canonical-title",
    );
    if (!titleProposal) throw new Error("Expected the canonical-title proposal.");
    nearlyFull.history.push(...Array.from({ length: 398 }, (_, index) => ({
      id: `screen03-history:${index + 2}:review-field`,
      action: "review-field" as const,
      targetId: titleProposal.id,
      at: new Date(firstReviewAt + index).toISOString(),
      actor: "researcher" as const,
      reason: "Fill the bounded append-only history for an atomic capacity test.",
      value: titleProposal.value,
      previousReviewStatus: index === 0
        ? "proposed" as const
        : index % 2 === 0
          ? "rejected" as const
          : "accepted" as const,
      nextReviewStatus: index % 2 === 0
        ? "accepted" as const
        : "rejected" as const,
    })));
    titleProposal.reviewStatus = "rejected";
    nearlyFull.revision = nearlyFull.history.length - 1;
    nearlyFull.updatedAt = nearlyFull.history.at(-1)!.at;
    const { integrity: _nearlyFullIntegrity, ...nearlyFullFingerprintInput } =
      nearlyFull;
    nearlyFull.integrity.stateFingerprint = fingerprintScreen03Value(
      nearlyFullFingerprintInput,
    );
    expect(requireScreen03VerificationState(nearlyFull)).toStrictEqual(
      nearlyFull,
    );
    expect(nearlyFull.history).toHaveLength(400);
    const before = serializeScreen03VerificationState(nearlyFull);
    expect(() => act(nearlyFull, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "This factual bulk update cannot fit atomically.",
    }, "2026-08-10T12:02:00.000Z")).toThrow(/history is full/i);
    expect(serializeScreen03VerificationState(nearlyFull)).toBe(before);
  }, 30_000);

  it("requires an explicit timeline decision but no focal-clock selection before lock", () => {
    let state = researchedState();
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: [],
      reason: "Select the supported informational date.",
    }, "2026-08-10T12:00:03.000Z");
    expect(state.focalClock.selectedProposalId).toBeNull();

    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "The official record directly supports the identity.",
    }, "2026-08-10T12:00:03.000Z");
    expect(() => act(state, {
      type: "lock-event-card",
      reason: "Do not lock an undecided timeline claim.",
    }, "2026-08-10T12:00:04.000Z")).toThrow(/explicit decision/i);
    state = act(state, {
      type: "review-field",
      proposalId: "field-effective",
      decision: "accept",
      reason: "The exact dated passage supports this timeline fact.",
    }, "2026-08-10T12:00:05.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Identity and timeline facts now have explicit decisions.",
    }, "2026-08-10T12:00:06.000Z");

    expect(state.status).toBe("locked");
    expect(state.lockedEventCard?.focalClock.selected).toBeNull();
    expect(state.lockedEventCard?.acceptedProposals.identity.map((item) => item.id)).toEqual(["field-canonical-title"]);
    expect(state.lockedEventCard?.acceptedProposals.timeline.map((item) => item.id))
      .toEqual(["field-effective"]);
    expect(state.lockedEventCard?.reviewedProposals.timeline.map((item) => item.id))
      .toEqual(["field-effective"]);
    expect(state.lockedEventCard?.timeline.map((item) => item.proposalId)).toEqual(["field-effective"]);
    expect(state.lockedEventCard?.linkedEvidence[0]).toMatchObject({
      id: "research-source",
      contentFingerprint: evidenceFingerprint("operative-record"),
      language: "en",
      passages: [{ id: "research-source:passage:1", basis: "source-excerpt" }],
    });
    expect(state.lockedEventCard?.outcomeValuesInspected).toBe(false);
    expect(requireScreen03VerificationState(state)).toStrictEqual(state);
    expect(serializeScreen03VerificationState(state)).toContain("screen-03-verification-state-v1");
    expect(fingerprintScreen03VerificationState(state)).toMatch(/^fnv1a64:/);
  });

  it("locks a complete canonical Event Card while preserving honest unknowns and rejected fields", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      identity: [proposal("identity", "field-canonical-title", "Canonical title", "General Data Protection Regulation", true)],
      timeline: [
        timeline("field-effective", "effective", "2018-05-25"),
        timeline("field-enforcement", "enforcement", "2019-01-01", false),
      ],
    });
    packet.proposals.overview.push(proposal("overview", "field-overview", "What happened", "A directly applicable data-protection regime took effect.", false));
    packet.evidence[0].passages[0].text +=
      " A directly applicable data-protection regime took effect.";
    packet.proposals.eligibility.push({
      ...proposal("eligibility", "field-threshold", "Eligibility threshold", "Unknown after the bounded search", true, "unsupported"),
      sourceIds: [],
      passageIds: [],
      uncertainty: "No authoritative threshold passage was retrieved.",
    });
    packet.proposals.amendment.push(proposal("amendment", "field-amendment", "Possible amendment", "An unverified amendment claim", false));

    let state = buildScreen03StateFromResearch(sourceHandoff, packet, "2026-08-10T12:00:02.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "edit",
      editedValue: "Regulation (EU) 2016/679",
      reason: "Use the official identifier as the resolved canonical title.",
    }, "2026-08-10T12:00:03.000Z");
    for (const proposalId of ["field-effective", "field-enforcement", "field-overview"]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported reviewed value.",
      }, "2026-08-10T12:00:04.000Z");
    }
    state = act(state, {
      type: "review-field",
      proposalId: "field-threshold",
      decision: "unresolved",
      reason: "Keep the unsupported threshold explicit as an unknown.",
    }, "2026-08-10T12:00:05.000Z");
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: ["field-enforcement"],
      reason: "Use effectiveness while preserving enforcement as an alternative clock.",
    }, "2026-08-10T12:00:06.000Z");
    expect(() => act(state, {
      type: "lock-event-card",
      reason: "Attempt before deciding every proposal.",
    }, "2026-08-10T12:00:07.000Z")).toThrow(/visible factual claim requires an explicit/i);
    state = act(state, {
      type: "review-field",
      proposalId: "field-amendment",
      decision: "reject",
      reason: "Reject the unverified amendment claim.",
    }, "2026-08-10T12:00:07.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Freeze all reviewed facts, evidence, clocks, and limitations.",
    }, "2026-08-10T12:00:08.000Z");

    const card = state.lockedEventCard!;
    expect(card.eventIdentity.canonicalTitle).toBe("Regulation (EU) 2016/679");
    expect(card.eventIdentity.upstreamProvisionalIdentity.canonicalTitle).toBe(
      "General Data Protection Regulation",
    );
    expect(card.eventIdentity.fieldResolutions).toEqual([{
      proposalId: "field-canonical-title",
      label: "Canonical title",
      resolvedValue: "Regulation (EU) 2016/679",
    }]);
    expect(card.acceptedProposals.identity[0]).toMatchObject({
      proposedValue: "General Data Protection Regulation",
      resolvedValue: "Regulation (EU) 2016/679",
      decision: "edited",
    });
    expect(card.timeline.map((item) => [item.proposalId, item.stage, item.resolvedDate])).toEqual([
      ["field-effective", "effective", "2018-05-25"],
      ["field-enforcement", "enforcement", "2019-01-01"],
    ]);
    expect(card.focalClock.selected?.proposalId).toBe("field-effective");
    expect(card.focalClock.alternatives.map((item) => item.proposalId)).toEqual(["field-enforcement"]);
    expect(card.limitations).toMatchObject({
      unknownProposalIds: ["field-threshold"],
      rejectedProposalIds: ["field-amendment"],
      unsupportedProposalIds: ["field-threshold"],
    });
    expect(card.reviewedProposals.eligibility[0]).toMatchObject({
      id: "field-threshold",
      proposedValue: "Unknown after the bounded search",
      resolvedValue: null,
      decision: "unresolved",
      decisionReason: "Keep the unsupported threshold explicit as an unknown.",
      sourceIds: [],
      passageIds: [],
    });
    expect(card.reviewedProposals.amendment[0]).toMatchObject({
      id: "field-amendment",
      proposedValue: "An unverified amendment claim",
      resolvedValue: null,
      decision: "rejected",
      decisionReason: "Reject the unverified amendment claim.",
    });
    expect(card.researchCoverage).toStrictEqual(state.researchCoverage);
    expect(card.linkedEvidence[0].passages[0].basis).toBe("source-excerpt");
    expect(card.outcomeValuesInspected).toBe(false);

    const tampered = cloneFixture(state);
    tampered.lockedEventCard!.acceptedProposals.identity[0].resolvedValue = "Tampered value";
    const { eventCardFingerprint: _oldCardFingerprint, ...cardInput } = tampered.lockedEventCard!;
    tampered.lockedEventCard!.eventCardFingerprint = fingerprintScreen02WorkflowValue(cardInput);
    const { integrity: _oldStateIntegrity, ...stateInput } = tampered;
    tampered.integrity.stateFingerprint = fingerprintScreen02WorkflowValue(stateInput);
    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it("keeps a reversed generic stage order visible without blocking lock", () => {
    let state = researchedState({
      timeline: [
        timeline("field-enactment", "enactment", "2019-01-01"),
        timeline("field-effective", "effective", "2018-05-25"),
      ],
    });
    expect(state.contradictions).toHaveLength(1);
    expect(state.contradictions[0]).toMatchObject({ kind: "date-order", status: "unresolved" });

    for (const proposalId of ["field-canonical-title", "field-enactment", "field-effective"]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported field while retaining the timing dispute.",
      }, "2026-08-10T12:00:03.000Z");
    }
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: ["field-enactment"],
      reason: "Retain both source-supported timing scenarios.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Lock while preserving a nonblocking timeline-order warning.",
    }, "2026-08-10T12:00:05.000Z");

    expect(state.status).toBe("locked");
    expect(state.contradictions[0]).toMatchObject({
      kind: "date-order",
      status: "unresolved",
      resolution: null,
    });
    expect(state.lockedEventCard?.contradictions[0]).toMatchObject({
      kind: "date-order",
      status: "unresolved",
    });
  });

  it("locks without forcing evidence decisions on informational actionability items", () => {
    let state = researchedState({
      requiredVariable: [proposal(
        "required-variable",
        "actionability-one",
        "Later analysis will need",
        "Unit-level exposure classification",
        false,
        "unsupported",
      )],
    });
    for (const proposalId of ["field-canonical-title", "field-effective"]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported evidence claim.",
      }, "2026-08-10T12:00:03.000Z");
    }
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: [],
      reason: "Use the supported application date.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Save with the actionability checklist kept informational.",
    }, "2026-08-10T12:00:05.000Z");

    expect(state.proposals.requiredVariable[0]?.reviewStatus).toBe("proposed");
    expect(state.lockedEventCard?.acceptedProposals.requiredVariable).toEqual([]);
    expect(state.lockedEventCard?.reviewedProposals.requiredVariable).toEqual([]);
  });

  it("preserves a resolved date-order contradiction across unrelated field review", () => {
    let state = researchedState({
      timeline: [
        timeline("field-enactment", "enactment", "2019-01-01"),
        timeline("field-effective", "effective", "2018-05-25"),
      ],
    });
    state = act(state, {
      type: "resolve-contradiction",
      contradictionId: state.contradictions[0].id,
      resolution:
        "The records describe distinct legal stages, so retain both dates.",
      reason: "Resolve the stage-order issue from the cited records.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "Accept the separately supported identity field.",
    }, "2026-08-10T12:00:04.000Z");

    expect(state.contradictions[0]).toMatchObject({
      status: "resolved",
      resolution:
        "The records describe distinct legal stages, so retain both dates.",
    });
  });

  it("reopens a resolved date-order contradiction when a cited timeline edit changes its dates", () => {
    const sourceHandoff = handoff();
    const packet = researchPacket(sourceHandoff, {
      timeline: [
        timeline("field-enactment", "enactment", "2019-01-01"),
        timeline("field-effective", "effective", "2018-05-25"),
      ],
    });
    packet.evidence[0].passages[0].text =
      "The record states an enactment date of 2019-01-01, corrected to 2019-01-02, and applies from 25 May 2018.";
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-10T12:00:02.000Z",
    );
    const originalContradictionId = state.contradictions[0].id;
    state = act(state, {
      type: "resolve-contradiction",
      contradictionId: originalContradictionId,
      resolution: "Retain both originally cited stages.",
      reason: "Resolve the original dates.",
    }, "2026-08-10T12:00:03.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-enactment",
      decision: "edit",
      editedValue: "2019-01-02",
      reason: "Use the directly cited correction.",
    }, "2026-08-10T12:00:04.000Z");

    expect(state.contradictions).toHaveLength(1);
    expect(state.contradictions[0]).toMatchObject({
      status: "unresolved",
      resolution: null,
    });
    expect(state.contradictions[0].id).toBe(originalContradictionId);
    expect(state.contradictions[0].summary).toContain("2019-01-02");
  });

  it("invalidates a locked card and reopens every linked decision when source content changes", () => {
    let state = researchedState();
    const previousEvidence = cloneFixture(
      state.evidence.find((item) => item.id === "research-source")!,
    );
    for (const proposalId of ["field-canonical-title", "field-effective"]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported field.",
      }, "2026-08-10T12:00:03.000Z");
    }
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: [],
      reason: "Select the supported operative clock.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Lock the verified Event Card.",
    }, "2026-08-10T12:00:05.000Z");
    state = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("changed-operative-record"),
      reason: "The official record fingerprint changed after retrieval.",
    }, "2026-08-10T12:00:06.000Z");

    expect(state.status).toBe("reviewing");
    expect(state.lockedEventCard).toBeNull();
    expect(state.focalClock.selectedProposalId).toBeNull();
    expect(state.researchCoverage.status).toBe("incomplete");
    const change = state.sourceChanges?.at(-1);
    expect(change).toMatchObject({
      sourceId: "research-source",
      trigger: "mark-source-changed",
      previousContentFingerprints: [previousEvidence.contentFingerprint],
      observedContentFingerprint: evidenceFingerprint(
        "changed-operative-record",
      ),
      reopenedProposalIds: ["field-canonical-title", "field-effective"],
    });
    const staleEvidence = state.evidence.find((item) =>
      change?.staleEvidenceIds.includes(item.id)
    );
    expect(staleEvidence).toMatchObject({
      status: "changed",
      contentFingerprint: previousEvidence.contentFingerprint,
      passages: [expect.objectContaining({
        text: previousEvidence.passages[0]?.text,
        status: "stale",
        contentFingerprint: previousEvidence.contentFingerprint,
      })],
    });
    expect(staleEvidence?.id).not.toBe(previousEvidence.id);
    expect(change?.stalePassageIds).toEqual(
      staleEvidence?.passages.map((passage) => passage.id),
    );
    expect(change?.staleProposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "field-canonical-title",
        reviewStatus: "accepted",
      }),
      expect.objectContaining({
        id: "field-effective",
        reviewStatus: "accepted",
      }),
    ]));
    expect(state.proposals.identity[0].reviewStatus).toBe("proposed");
    expect(state.proposals.timeline[0].reviewStatus).toBe("proposed");
    expect(state.proposals.identity[0].support).toBe("unsupported");
    expect(screen03ProposalConfirmability(
      state.proposals.identity[0],
      state.evidence,
    )).toEqual({ confirmable: false, reason: "no-direct-support" });
    expect(restoreScreen03VerificationState(state)).not.toBeNull();
  });

  it("rejects tampering that rewrites a preserved source-change fingerprint", () => {
    const original = researchedState();
    const changed = act(original, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("new-source-body"),
      reason: "The source body has a new verified digest.",
    }, "2026-08-10T12:00:03.000Z");
    const tampered = cloneFixture(changed);
    tampered.sourceChanges![0]!.previousContentFingerprints[0] =
      evidenceFingerprint("forged-old-body");
    const { integrity: _integrity, ...fingerprintInput } = tampered;
    tampered.integrity.stateFingerprint = fingerprintScreen03Value(
      fingerprintInput,
    );

    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it("rejects a coordinated rewrite of preserved source fingerprints after every local checksum is recomputed", () => {
    let state = researchedState();
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "Create a researcher decision that must remain bound to the old source version.",
    }, "2026-08-10T12:00:03.000Z");
    const changed = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("new-source-body"),
      reason: "The source body has a new verified digest.",
    }, "2026-08-10T12:00:04.000Z");
    const tampered = cloneFixture(changed);
    const change = tampered.sourceChanges![0]!;
    const forgedFingerprint = evidenceFingerprint("forged-old-body");
    change.previousContentFingerprints = [forgedFingerprint];
    for (const evidenceId of change.staleEvidenceIds) {
      const evidence = tampered.evidence.find((item) => item.id === evidenceId)!;
      evidence.contentFingerprint = forgedFingerprint;
      for (const passage of evidence.passages) {
        passage.contentFingerprint = forgedFingerprint;
      }
    }
    const { id: _changeId, ...changeFingerprintInput } = change;
    change.id = `screen03-source-change:${fingerprintScreen03Value(
      changeFingerprintInput,
    )}`;
    const { integrity: _integrity, ...stateFingerprintInput } = tampered;
    tampered.integrity.stateFingerprint = fingerprintScreen03Value(
      stateFingerprintInput,
    );

    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it("requires the source-change ledger and binds its observed fingerprint and prior decision snapshot to history", () => {
    let state = researchedState();
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "Create a decision that the source-change audit must retain.",
    }, "2026-08-10T12:00:03.000Z");
    const changed = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("expected-new-body"),
      reason: "Record the exact newly observed digest.",
    }, "2026-08-10T12:00:04.000Z");
    const resign = (candidate: Screen03VerificationState) => {
      const { integrity: _integrity, ...fingerprintInput } = candidate;
      candidate.integrity.stateFingerprint = fingerprintScreen03Value(
        fingerprintInput,
      );
    };

    const stripped = cloneFixture(changed);
    delete stripped.sourceChanges;
    resign(stripped);
    expect(restoreScreen03VerificationState(stripped)).toBeNull();

    const forgedObservation = cloneFixture(changed);
    const forgedChange = forgedObservation.sourceChanges![0]!;
    forgedChange.observedContentFingerprint = evidenceFingerprint(
      "unrecorded-third-body",
    );
    const { id: _forgedId, ...forgedRecordInput } = forgedChange;
    forgedChange.id = `screen03-source-change:${fingerprintScreen03Value(
      forgedRecordInput,
    )}`;
    resign(forgedObservation);
    expect(restoreScreen03VerificationState(forgedObservation)).toBeNull();

    const erasedDecision = cloneFixture(changed);
    const erasedChange = erasedDecision.sourceChanges![0]!;
    erasedChange.staleProposals = erasedChange.staleProposals.filter(
      (proposal) => proposal.id !== "field-canonical-title",
    );
    erasedChange.reopenedProposalIds = [];
    const { id: _erasedId, ...erasedRecordInput } = erasedChange;
    erasedChange.id = `screen03-source-change:${fingerprintScreen03Value(
      erasedRecordInput,
    )}`;
    resign(erasedDecision);
    expect(restoreScreen03VerificationState(erasedDecision)).toBeNull();
  });

  it("rejects a refresh that substitutes a third fingerprint for a pending changed source", () => {
    const sourceHandoff = handoff();
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      researchPacket(sourceHandoff),
      "2026-08-10T12:00:02.000Z",
    );
    const marked = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: evidenceFingerprint("expected-new-body"),
      reason: "Record the newly observed source digest before retrieval.",
    }, "2026-08-10T12:00:03.000Z");
    const substituted = researchPacket(sourceHandoff);
    substituted.researchedAt = "2026-08-10T12:00:04.000Z";
    substituted.evidence[0]!.retrievedAt = substituted.researchedAt;
    substituted.evidence[0]!.contentFingerprint =
      evidenceFingerprint("unexpected-third-body");
    substituted.coverage.channels[0]!.retrievedAt = substituted.researchedAt;

    expect(() => refreshScreen03StateFromResearch(
      marked,
      sourceHandoff,
      substituted,
      substituted.researchedAt,
    )).toThrow(/did not match the fingerprint recorded/i);
  });

  it("rejects a pending source refresh that returns the expected and a third active version", () => {
    const sourceHandoff = handoff();
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      researchPacket(sourceHandoff),
      "2026-08-10T12:00:02.000Z",
    );
    const expectedFingerprint = evidenceFingerprint("expected-new-body");
    const marked = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: expectedFingerprint,
      reason: "Record the newly observed source digest before retrieval.",
    }, "2026-08-10T12:00:03.000Z");
    const ambiguous = researchPacket(sourceHandoff);
    ambiguous.researchedAt = "2026-08-10T12:00:04.000Z";
    ambiguous.evidence[0]!.retrievedAt = ambiguous.researchedAt;
    ambiguous.evidence[0]!.contentFingerprint = expectedFingerprint;
    const thirdVersion = cloneFixture(ambiguous.evidence[0]!);
    thirdVersion.id = "research-source-third-version";
    thirdVersion.contentFingerprint = evidenceFingerprint(
      "unexpected-third-body",
    );
    thirdVersion.passages[0]!.id =
      "research-source-third-version:passage:1";
    ambiguous.evidence.push(thirdVersion);
    ambiguous.coverage.recordsReviewed = 2;
    ambiguous.coverage.activeEvidenceCount = 2;
    ambiguous.coverage.channels[0]!.retrievedAt = ambiguous.researchedAt;

    expect(() => refreshScreen03StateFromResearch(
      marked,
      sourceHandoff,
      ambiguous,
      ambiguous.researchedAt,
    )).toThrow(/did not match the fingerprint recorded/i);
  });

  it("resolves a manual source observation once and permits two later audited revisions", () => {
    const sourceHandoff = handoff();
    const packetAtVersion = (seed: string, at: string) => {
      const packet = researchPacket(sourceHandoff);
      packet.researchedAt = at;
      packet.evidence[0]!.retrievedAt = at;
      packet.evidence[0]!.contentFingerprint = evidenceFingerprint(seed);
      packet.evidence[0]!.passages[0]!.text += ` Source version ${seed}.`;
      packet.coverage.channels[0]!.retrievedAt = at;
      return packet;
    };
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      researchPacket(sourceHandoff),
      "2026-08-10T12:00:02.000Z",
    );
    const fingerprints = {
      a: state.evidence.find((item) => item.id === "research-source")!
        .contentFingerprint,
      b: evidenceFingerprint("manual-version-b"),
      c: evidenceFingerprint("automatic-version-c"),
      d: evidenceFingerprint("automatic-version-d"),
    };
    state = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: fingerprints.b,
      reason: "Record version B before renewed retrieval.",
    }, "2026-08-10T12:00:03.000Z");
    state = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      packetAtVersion("manual-version-b", "2026-08-10T12:00:04.000Z"),
      "2026-08-10T12:00:04.000Z",
    );
    state = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      packetAtVersion("automatic-version-c", "2026-08-10T12:00:05.000Z"),
      "2026-08-10T12:00:05.000Z",
    );
    state = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      packetAtVersion("automatic-version-d", "2026-08-10T12:00:06.000Z"),
      "2026-08-10T12:00:06.000Z",
    );

    expect(state.sourceChanges?.map((change) => ({
      previous: change.previousContentFingerprints,
      observed: change.observedContentFingerprint,
    }))).toEqual([
      { previous: [fingerprints.a], observed: fingerprints.b },
      { previous: [fingerprints.b], observed: fingerprints.c },
      { previous: [fingerprints.c], observed: fingerprints.d },
    ]);
    expect(state.evidence.filter((item) =>
      item.status === "changed" && item.sourceId === "research-source"
    ).map((item) => item.contentFingerprint)).toEqual([
      fingerprints.a,
      fingerprints.b,
      fingerprints.c,
    ]);
    expect(restoreScreen03VerificationState(state)).not.toBeNull();
  });

  it("does not satisfy a manual observation with a cyclic matching version retained before the mark", () => {
    const sourceHandoff = handoff();
    const packetAtVersion = (seed: string, at: string) => {
      const packet = researchPacket(sourceHandoff);
      packet.researchedAt = at;
      packet.evidence[0]!.retrievedAt = at;
      packet.evidence[0]!.contentFingerprint = evidenceFingerprint(seed);
      packet.evidence[0]!.passages[0]!.text += ` Source version ${seed}.`;
      packet.coverage.channels[0]!.retrievedAt = at;
      return packet;
    };
    const fingerprintB = evidenceFingerprint("cyclic-version-b");
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      packetAtVersion("cyclic-version-b", "2026-08-10T12:00:01.000Z"),
      "2026-08-10T12:00:02.000Z",
    );
    state = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      packetAtVersion("cyclic-version-a", "2026-08-10T12:00:03.000Z"),
      "2026-08-10T12:00:03.000Z",
    );
    state = act(state, {
      type: "mark-source-changed",
      sourceId: "research-source",
      contentFingerprint: fingerprintB,
      reason: "A source reports a return to version B.",
    }, "2026-08-10T12:00:04.000Z");

    const tampered = cloneFixture(state);
    const unrecorded = packetAtVersion(
      "unrecorded-version-c",
      "2026-08-10T12:00:05.000Z",
    ).evidence[0]!;
    tampered.evidence.push(unrecorded);
    tampered.researchCoverage.activeEvidenceCount += 1;
    const { integrity: _integrity, ...fingerprintInput } = tampered;
    tampered.integrity.stateFingerprint = fingerprintScreen03Value(
      fingerprintInput,
    );

    // The older stale B bytes predate the manual mark and therefore cannot
    // authorize active C as though B had first been revalidated.
    expect(restoreScreen03VerificationState(tampered)).toBeNull();
  });

  it("refreshes a retained pre-ledger changed state without overwriting its legacy evidence or history", () => {
    const sourceHandoff = handoff();
    const initial = buildScreen03StateFromResearch(
      sourceHandoff,
      researchPacket(sourceHandoff),
      "2026-08-10T12:00:02.000Z",
    );
    const legacy = cloneFixture(initial);
    delete legacy.orientation;
    legacy.releaseLabel = SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL;
    legacy.revision += 1;
    legacy.updatedAt = "2026-08-10T12:00:03.000Z";
    const expectedFingerprint = evidenceFingerprint("legacy-expected-body");
    const legacyEvidence = legacy.evidence.find((item) =>
      item.id === "research-source"
    )!;
    legacyEvidence.status = "changed";
    // This is the exact pre-ledger behavior: the new digest replaced the old
    // one in place while the old passages and IDs remained.
    legacyEvidence.contentFingerprint = expectedFingerprint;
    for (const candidate of Object.values(legacy.proposals).flat()) {
      if (candidate.sourceIds.includes("research-source")) {
        candidate.reviewStatus = "proposed";
        candidate.editedValue = null;
        candidate.support = "unsupported";
      }
    }
    legacy.researchCoverage = {
      ...legacy.researchCoverage,
      status: "incomplete",
      gaps: ["Source research-source changed and requires renewed retrieval and review."],
      activeEvidenceCount: legacy.evidence.filter((item) =>
        item.status !== "changed"
      ).length,
      stoppingRule: {
        ...legacy.researchCoverage.stoppingRule,
        status: "not-met",
        note: "Source research-source changed after its prior retrieval.",
      },
    };
    legacy.history.push({
      id: `screen03-history:${legacy.revision}:mark-source-changed`,
      action: "mark-source-changed",
      targetId: "research-source",
      at: legacy.updatedAt,
      actor: "researcher",
      reason: "Legacy source-change notice.",
      value: "reopened:",
      previousReviewStatus: null,
      nextReviewStatus: null,
    });
    const { integrity: _legacyIntegrity, ...legacyFingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(
      legacyFingerprintInput,
    );
    expect(restoreScreen03VerificationState(legacy)).not.toBeNull();

    const replacement = researchPacket(sourceHandoff);
    replacement.researchedAt = "2026-08-10T12:00:04.000Z";
    replacement.evidence[0]!.retrievedAt = replacement.researchedAt;
    replacement.evidence[0]!.contentFingerprint = expectedFingerprint;
    replacement.evidence[0]!.passages[0]!.text +=
      " The renewed legacy source body was retrieved.";
    replacement.coverage.channels[0]!.retrievedAt = replacement.researchedAt;
    const refreshed = refreshScreen03StateFromResearch(
      legacy,
      sourceHandoff,
      replacement,
      replacement.researchedAt,
    );

    expect(refreshed.history.slice(0, -1)).toStrictEqual(legacy.history);
    expect(refreshed.evidence.find((item) =>
      item.id === "research-source" && item.status !== "changed"
    )?.contentFingerprint).toBe(expectedFingerprint);
    const retainedLegacy = refreshed.evidence.find((item) =>
      item.status === "changed" &&
      item.sourceId === "research-source" &&
      item.id !== "research-source"
    );
    expect(retainedLegacy).toMatchObject({
      contentFingerprint: expectedFingerprint,
      passages: [expect.objectContaining({
        text: legacyEvidence.passages[0]!.text,
      })],
    });
    expect(retainedLegacy?.passages[0]?.id).not.toBe(
      legacyEvidence.passages[0]!.id,
    );
    expect(refreshed.sourceChanges).toEqual([]);
    expect(requireScreen03VerificationState(refreshed)).toEqual(refreshed);
  });

  it("rejects a critical edit that is not stated in its cited direct passage", () => {
    const state = researchedState();
    expect(() => act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "edit",
      editedValue: "An unrelated researcher assertion",
      reason: "Attempt an unsupported critical correction.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/must appear in an active direct passage/i);
  });

  it("does not approve indirect or uncited edits merely because a field is noncritical", () => {
    const indirect = proposal(
      "identity",
      "field-noncritical",
      "Current status",
      "In force",
      false,
      "indirect",
    );
    const indirectState = researchedState({ identity: [indirect] });
    expect(() => act(indirectState, {
      type: "review-field",
      proposalId: indirect.id,
      decision: "accept",
      reason: "Attempt to approve indirect noncritical context.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/active direct passage support/i);

    const direct = {
      ...proposal(
        "identity",
        "field-noncritical",
        "Current status",
        "General Data Protection Regulation",
        false,
      ),
    };
    const directState = researchedState({ identity: [direct] });
    expect(() => act(directState, {
      type: "review-field",
      proposalId: direct.id,
      decision: "edit",
      editedValue: "An uncited status",
      reason: "Attempt an uncited noncritical correction.",
    }, "2026-08-10T12:00:03.000Z")).toThrow(/must appear in an active direct passage/i);
  });

  it("removes a timing alternative when its proposal is no longer accepted", () => {
    let state = researchedState({
      timeline: [
        timeline("field-effective", "effective", "2018-05-25"),
        timeline("field-enforcement", "enforcement", "2019-01-01", false),
      ],
    });
    for (const proposalId of [
      "field-canonical-title",
      "field-effective",
      "field-enforcement",
    ]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported reviewed value.",
      }, "2026-08-10T12:00:03.000Z");
    }
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: ["field-enforcement"],
      reason: "Preserve the supported enforcement alternative.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "review-field",
      proposalId: "field-enforcement",
      decision: "reject",
      reason: "The enforcement date should no longer be an approved alternative.",
    }, "2026-08-10T12:00:05.000Z");

    expect(state.focalClock).toEqual({
      selectedProposalId: "field-effective",
      alternativeProposalIds: [],
    });
  });

  it("archives all changed sources before recording shared proposal history when both remove passages", () => {
    const sourceHandoff = handoff();
    const original = researchPacket(sourceHandoff);
    const second = cloneFixture(original.evidence[0]!);
    second.id = "second-research-source";
    second.sourceId = "second-research-source";
    second.locator = "https://example.gov/second-official-record";
    second.passages[0]!.id = "second-research-source:passage:1";
    original.evidence.push(second);
    original.coverage.recordsReviewed = 2;
    original.coverage.activeEvidenceCount = 2;
    original.coverage.queries[0]!.returnedEvidenceIds.push(second.id);
    for (const proposal of Object.values(original.proposals).flat()) {
      proposal.sourceIds.push(second.id);
      proposal.passageIds.push(second.passages[0]!.id);
    }
    let state = buildScreen03StateFromResearch(sourceHandoff, original, "2026-08-10T12:00:02.000Z");
    state = act(state, { type: "review-all-fields", mode: "confirm", reason: "Confirm both supported sources." }, "2026-08-10T12:00:03.000Z");
    state = act(state, { type: "lock-event-card", reason: "Lock the reviewed facts." }, "2026-08-10T12:00:04.000Z");
    const oldHistory = cloneFixture(state.history);
    const replacement = cloneFixture(original);
    replacement.researchedAt = "2026-08-10T12:00:05.000Z";
    for (const evidence of replacement.evidence) {
      evidence.retrievedAt = replacement.researchedAt;
      evidence.contentFingerprint = evidenceFingerprint(`${evidence.id}-replacement`);
      evidence.passages = [{
        id: `${evidence.id}:replacement-passage`, number: 1,
        text: "The replacement official notice contains administrative contact details.",
        locator: "Administrative notice", basis: "source-excerpt",
      }];
    }
    for (const proposal of Object.values(replacement.proposals).flat()) {
      proposal.support = "unsupported";
      proposal.sourceIds = [];
      proposal.passageIds = [];
      proposal.uncertainty = "The prior supporting passages are no longer present.";
    }
    const refreshed = refreshScreen03StateFromResearch(state, sourceHandoff, replacement, replacement.researchedAt);
    expect(refreshed.status).toBe("reviewing");
    expect(refreshed.lockedEventCard).toBeNull();
    expect(refreshed.history.slice(0, -1)).toEqual(oldHistory);
    expect(refreshed.sourceChanges).toHaveLength(2);
    for (const [index, record] of refreshed.sourceChanges!.entries()) {
      const prior = original.evidence[index]!;
      expect(record.previousContentFingerprints).toEqual([prior.contentFingerprint]);
      expect(record.staleEvidenceIds).toHaveLength(1);
      const archived = refreshed.evidence.find((evidence) => evidence.id === record.staleEvidenceIds[0])!;
      expect(archived.status).toBe("changed");
      expect(archived.passages.map((passage) => passage.text)).toEqual(prior.passages.map((passage) => passage.text));
      expect(record.stalePassageIds).toEqual(archived.passages.map((passage) => passage.id));
      expect(record.reopenedProposalIds).toEqual(["field-canonical-title", "field-effective"]);
      for (const proposal of record.staleProposals) {
        expect(proposal.reviewStatus).toBe("accepted");
        expect(proposal.passageIds).toHaveLength(2);
        for (const passageId of proposal.passageIds) {
          const owner = refreshed.evidence.find((evidence) => evidence.passages.some((passage) => passage.id === passageId))!;
          expect(owner.status).toBe("changed");
          expect(proposal.sourceIds).toContain(owner.id);
        }
      }
    }
    for (const proposal of screen03FactualClaims(refreshed.proposals)) {
      expect(proposal.reviewStatus).toBe("proposed");
      expect(screen03ProposalConfirmability(proposal, refreshed.evidence).confirmable).toBe(false);
    }
    expect(restoreScreen03VerificationState(JSON.parse(serializeScreen03VerificationState(refreshed))))
      .toEqual(refreshed);
  });

  it("preserves decisions across timestamp-only refreshes and reopens them for changed research", () => {
    const sourceHandoff = handoff();
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      researchPacket(sourceHandoff),
      "2026-08-10T12:00:02.000Z",
    );
    for (const proposalId of ["field-canonical-title", "field-effective"]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported field.",
      }, "2026-08-10T12:00:03.000Z");
    }
    state = act(state, {
      type: "select-focal-clock",
      proposalId: "field-effective",
      alternativeProposalIds: [],
      reason: "Select the directly supported operative clock.",
    }, "2026-08-10T12:00:04.000Z");
    state = act(state, {
      type: "lock-event-card",
      reason: "Lock the reviewed Event Card before refreshing research.",
    }, "2026-08-10T12:00:05.000Z");
    const priorResearchEvidence = cloneFixture(
      state.evidence.find((item) => item.id === "research-source")!,
    );

    const timestampOnly = cloneFixture(researchPacket(sourceHandoff));
    timestampOnly.researchedAt = "2026-08-10T12:00:06.000Z";
    timestampOnly.evidence[0].retrievedAt = timestampOnly.researchedAt;
    timestampOnly.coverage.channels[0].retrievedAt = timestampOnly.researchedAt;
    const unchanged = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      timestampOnly,
      timestampOnly.researchedAt,
    );
    expect(unchanged).toStrictEqual(state);

    const contextOnly = cloneFixture(timestampOnly);
    contextOnly.researchedAt = "2026-08-10T12:00:06.500Z";
    contextOnly.contextLeads = [{
      id: "context-refresh-lead",
      title: "Secondary discussion of implementation",
      locator: "https://press.example.test/implementation",
      publisher: "Example Press",
      publishedDate: "2026-08-01",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Context only; direct verification is still required.",
    }];
    const contextRefreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      contextOnly,
      contextOnly.researchedAt,
    );
    expect(contextRefreshed).toMatchObject({
      status: "locked",
      revision: state.revision + 1,
      lockedEventCard: state.lockedEventCard,
      focalClock: state.focalClock,
      contextLeads: contextOnly.contextLeads,
    });
    expect(contextRefreshed.proposals).toStrictEqual(state.proposals);
    expect(contextRefreshed.history.at(-1)?.action).toBe("context-refreshed");

    const changedPacket = cloneFixture(timestampOnly);
    changedPacket.researchedAt = "2026-08-10T12:00:07.000Z";
    changedPacket.evidence[0].retrievedAt = changedPacket.researchedAt;
    changedPacket.coverage.channels[0].retrievedAt = changedPacket.researchedAt;
    changedPacket.evidence[0].contentFingerprint = evidenceFingerprint("revised-operative-record");
    changedPacket.evidence[0].passages[0].text = "The revised official record identifies the instrument and its application date.";
    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      changedPacket,
      changedPacket.researchedAt,
    );

    expect(refreshed).toMatchObject({
      status: "reviewing",
      revision: state.revision + 1,
      lockedEventCard: null,
      focalClock: { selectedProposalId: null, alternativeProposalIds: [] },
    });
    expect(refreshed.proposals.identity[0].reviewStatus).toBe("proposed");
    expect(refreshed.proposals.timeline[0].reviewStatus).toBe("proposed");
    expect(refreshed.history.slice(0, -1)).toStrictEqual(state.history);
    expect(refreshed.history.at(-1)?.action).toBe("research-refreshed");
    expect(refreshed.outcomeValuesInspected).toBe(false);
    const sourceChange = refreshed.sourceChanges?.at(-1);
    expect(sourceChange).toMatchObject({
      sourceId: "research-source",
      trigger: "research-refresh",
      previousContentFingerprints: [
        priorResearchEvidence.contentFingerprint,
      ],
      observedContentFingerprint:
        changedPacket.evidence[0]?.contentFingerprint,
      reopenedProposalIds: ["field-canonical-title", "field-effective"],
    });
    const priorVersion = refreshed.evidence.find((item) =>
      sourceChange?.staleEvidenceIds.includes(item.id)
    );
    expect(priorVersion).toMatchObject({
      status: "changed",
      contentFingerprint: priorResearchEvidence.contentFingerprint,
      passages: [expect.objectContaining({
        text: priorResearchEvidence.passages[0]?.text,
        status: "stale",
        contentFingerprint: priorResearchEvidence.contentFingerprint,
      })],
    });
    expect(refreshed.evidence.find((item) =>
      item.id === "research-source" && item.status !== "changed"
    )).toMatchObject({
      contentFingerprint: changedPacket.evidence[0]?.contentFingerprint,
      passages: [expect.objectContaining({
        text: changedPacket.evidence[0]?.passages[0]?.text,
      })],
    });
    expect(sourceChange?.staleProposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "field-canonical-title",
        reviewStatus: "accepted",
      }),
      expect.objectContaining({
        id: "field-effective",
        reviewStatus: "accepted",
      }),
    ]));

    const repeatedPacket = cloneFixture(changedPacket);
    repeatedPacket.researchedAt = "2026-08-10T12:00:08.000Z";
    repeatedPacket.evidence[0]!.retrievedAt = repeatedPacket.researchedAt;
    repeatedPacket.coverage.channels[0]!.retrievedAt =
      repeatedPacket.researchedAt;
    expect(refreshScreen03StateFromResearch(
      refreshed,
      sourceHandoff,
      repeatedPacket,
      repeatedPacket.researchedAt,
    )).toStrictEqual(refreshed);

    const legacyState = cloneFixture(state);
    legacyState.releaseLabel = SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL;
    const { integrity: _legacyIntegrity, ...legacyFingerprintInput } =
      legacyState;
    legacyState.integrity.stateFingerprint = fingerprintScreen03Value(
      legacyFingerprintInput,
    );
    const legacyRefreshed = refreshScreen03StateFromResearch(
      legacyState,
      sourceHandoff,
      changedPacket,
      changedPacket.researchedAt,
    );
    expect(legacyRefreshed.releaseLabel).toBe(
      SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
    );
    expect(restoreScreen03VerificationState(legacyRefreshed)).not.toBeNull();
  });

  it("keeps the accepted old fact and decision when a changed source proposes a new factual value", () => {
    const sourceHandoff = handoff();
    const initialPacket = researchPacket(sourceHandoff);
    const oldTitle = initialPacket.proposals.identity[0]!.value;
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      initialPacket,
      "2026-08-10T12:00:02.000Z",
    );
    state = act(state, {
      type: "review-field",
      proposalId: "field-canonical-title",
      decision: "accept",
      reason: "Accept the title supported by the original official source version.",
    }, "2026-08-10T12:00:03.000Z");
    const priorHistory = cloneFixture(state.history);

    const newTitle = "Revised Data Protection Regulation";
    const replacement = cloneFixture(initialPacket);
    replacement.researchedAt = "2026-08-10T12:00:04.000Z";
    replacement.coverage.channels[0]!.retrievedAt = replacement.researchedAt;
    replacement.evidence[0]!.retrievedAt = replacement.researchedAt;
    replacement.evidence[0]!.contentFingerprint = evidenceFingerprint(
      "revised-title-source-body",
    );
    replacement.evidence[0]!.passages[0]!.text =
      `The official record identifies the ${newTitle} and states that it applies from 25 May 2018.`;
    replacement.proposals.identity[0]!.value = newTitle;

    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      replacement,
      replacement.researchedAt,
    );

    expect(refreshed.proposals.identity[0]).toMatchObject({
      id: "field-canonical-title",
      value: newTitle,
      reviewStatus: "proposed",
      editedValue: null,
    });
    expect(refreshed.history.slice(0, -1)).toStrictEqual(priorHistory);
    expect(priorHistory.at(-1)).toMatchObject({
      action: "review-field",
      targetId: "field-canonical-title",
      value: oldTitle,
      previousReviewStatus: "proposed",
      nextReviewStatus: "accepted",
    });
    expect(refreshed.sourceChanges?.at(-1)?.staleProposals).toContainEqual(
      expect.objectContaining({
        id: "field-canonical-title",
        value: oldTitle,
        reviewStatus: "accepted",
        editedValue: null,
      }),
    );
    expect(refreshed.sourceChanges?.at(-1)?.staleProposals).not.toContainEqual(
      expect.objectContaining({
        id: "field-canonical-title",
        value: newTitle,
        reviewStatus: "accepted",
      }),
    );

    const restored = restoreScreen03VerificationState(
      JSON.parse(serializeScreen03VerificationState(refreshed)),
    );
    expect(restored?.proposals.identity[0]).toMatchObject({
      value: newTitle,
      reviewStatus: "proposed",
    });
    expect(restored?.sourceChanges?.at(-1)?.staleProposals).toContainEqual(
      expect.objectContaining({
        id: "field-canonical-title",
        value: oldTitle,
        reviewStatus: "accepted",
      }),
    );
  });

  it("reopens only source-affected decisions during substantive research refresh", () => {
    const sourceHandoff = handoff();
    const initialPacket = researchPacket(sourceHandoff);
    const stableEvidence = {
      ...cloneFixture(initialPacket.evidence[0]!),
      id: "stable-companion-source",
      sourceId: "stable-companion-source",
      title: "Official companion record",
      locator: "https://official.example.test/companion-record",
      contentFingerprint: evidenceFingerprint("stable-companion-record"),
      passages: [{
        ...cloneFixture(initialPacket.evidence[0]!.passages[0]!),
        id: "stable-companion-source:passage:1",
        text: "The official companion record states that implementation uses a stable published framework.",
      }],
    };
    const stableOverview = {
      ...proposal(
        "overview",
        "field-stable-overview",
        "Implementation summary",
        "implementation uses a stable published framework",
        false,
      ),
      sourceIds: [stableEvidence.id],
      passageIds: [stableEvidence.passages[0]!.id],
    };
    initialPacket.evidence.push(stableEvidence);
    initialPacket.proposals.overview = [stableOverview];
    initialPacket.coverage.queries.push({
      id: "query-stable-companion",
      query: "official companion implementation record",
      purpose: "Verify a distinct implementation statement.",
      returnedEvidenceIds: [stableEvidence.id],
    });
    initialPacket.coverage.recordsReviewed = 2;
    initialPacket.coverage.activeEvidenceCount = 2;

    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      initialPacket,
      "2026-08-10T12:00:02.000Z",
    );
    for (const proposalId of [
      "field-canonical-title",
      "field-stable-overview",
    ]) {
      state = act(state, {
        type: "review-field",
        proposalId,
        decision: "accept",
        reason: "Accept the directly supported field independently.",
      }, "2026-08-10T12:00:03.000Z");
    }

    const refreshedPacket = cloneFixture(initialPacket);
    refreshedPacket.researchedAt = "2026-08-10T12:00:04.000Z";
    refreshedPacket.coverage.channels[0]!.retrievedAt =
      refreshedPacket.researchedAt;
    const changedEvidence = refreshedPacket.evidence.find((item) =>
      item.id === "research-source"
    )!;
    changedEvidence.retrievedAt = refreshedPacket.researchedAt;
    changedEvidence.contentFingerprint = evidenceFingerprint(
      "operative-record-revised",
    );
    changedEvidence.passages[0]!.text += " The source now carries a revised body.";

    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      refreshedPacket,
      refreshedPacket.researchedAt,
    );

    expect(refreshed.proposals.identity[0]).toMatchObject({
      id: "field-canonical-title",
      reviewStatus: "proposed",
    });
    expect(refreshed.proposals.overview[0]).toMatchObject({
      id: "field-stable-overview",
      reviewStatus: "accepted",
    });
    expect(refreshed.sourceChanges?.at(-1)?.staleProposals.map(
      (item) => item.id,
    )).not.toContain("field-stable-overview");
    expect(refreshed.sourceChanges?.at(-1)?.reopenedProposalIds).toEqual([
      "field-canonical-title",
    ]);
    expect(restoreScreen03VerificationState(refreshed)).not.toBeNull();
  });

  it("preserves a confirmed proposal-era evidence snapshot when substantive refresh replaces its source", () => {
    const sourceHandoff = handoff();
    const firstPacket = researchPacket(sourceHandoff);
    let state = buildScreen03StateFromResearch(
      sourceHandoff,
      firstPacket,
      "2026-08-10T12:00:02.000Z",
    );
    const beforeBriefingLifecycle = state;
    state = attachScreen03BriefingLifecycle(
      state,
      `s3ref_${"S".repeat(43)}`,
      beforeBriefingLifecycle.updatedAt,
    );
    expect(state.revision).toBe(beforeBriefingLifecycle.revision + 1);
    expect(state.integrity.stateFingerprint).not.toBe(
      beforeBriefingLifecycle.integrity.stateFingerprint,
    );
    expect(state.history.at(-1)).toMatchObject({
      action: "host-briefing-lifecycle-attached",
      actor: "fixed-core",
    });
    const evidence = firstPacket.evidence[0]!;
    const evidenceId = evidence.id;
    const sectionEvidenceIds = {
      oneSentenceSummary: [evidenceId],
      whatTheShockIs: [evidenceId],
      whatChanged: [evidenceId],
      whyItMatters: [evidenceId],
      whoIsAffected: [evidenceId],
      eligibilityThresholdsAndExemptions: [evidenceId],
      importantTimingAndTreatmentStages: [evidenceId],
      enforcementAndPenalties: [evidenceId],
      laterChanges: [evidenceId],
    };
    const content: Screen03BriefingContent = {
      schemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
      briefingStatus: "complete",
      title: "Source-linked overview",
      oneSentenceSummary: "The official record documents the selected shock.",
      whatTheShockIs: "The official record identifies the selected instrument.",
      whatChanged: "The official record describes the operative change.",
      whyItMatters: "The change can alter the institutional study setting.",
      whoIsAffected: "The official record identifies the covered population.",
      eligibilityThresholdsAndExemptions: "The official record defines scope.",
      importantTimingAndTreatmentStages: "The official record defines timing.",
      enforcementAndPenalties: "The official record describes enforcement.",
      laterChanges: "The official record describes available later changes.",
      plausiblePathwayToResearcherOutcome:
        "ChatGPT interpretation: the shock could plausibly affect the outcome, but this is an untested hypothesis.",
      unresolvedUncertainties: [],
      acknowledgedMissingEvidenceIds: [],
      acknowledgedConflictIds: [],
      sectionEvidenceIds,
      conciseRationale: "Every factual section cites the proposal-era source.",
      hostModel: "host_model_not_exposed",
    };
    const proposal = {
      schemaVersion: SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
      proposalId: "briefing-source-snapshot",
      contentHash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      content,
      provenance: {
        origin: "chatgpt_host" as const,
        briefingSchemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
        skillVersion: SCREEN_03_BRIEFING_SKILL_VERSION,
        workflowVersion: SCREEN_03_BRIEFING_WORKFLOW_VERSION,
        packetId: "sa3b-packet-v1.payload.signature",
        packetHash:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        eventFingerprint: state.upstream.eventFingerprint,
        sourceRevision: state.revision,
        sourceStateFingerprint: fingerprintScreen03VerificationState(state),
        evidenceIds: [evidenceId],
        evidenceSnapshot: [{
          evidenceId,
          sourceId: evidence.sourceId,
          title: evidence.title,
          authority: evidence.publisher,
          authorityTier: evidence.authorityTier,
          publishedDate: evidence.publishedDate,
          permittedLink: evidence.locator,
          language: evidence.language,
          reviewStatus: evidence.status as "carried" | "retrieved",
          passageIds: evidence.passages.map((passage) => passage.id),
        }],
        generatedAt: "2026-08-10T12:00:03.000Z",
        hostModel: "host_model_not_exposed",
      },
    };
    state = integrateScreen03BriefingProposal(
      state,
      proposal,
      proposal.provenance.generatedAt,
    ).state;
    const confirmation = {
      schemaVersion: SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
      decisionId: "briefing-source-snapshot-confirm",
      proposalId: proposal.proposalId,
      action: "confirm",
      reason: "The researcher confirms the cited proposal-era overview.",
      decidedAt: "2026-08-10T12:00:04.000Z",
      contentHash: proposal.contentHash,
      content,
    } as const;
    state = decideScreen03Briefing(
      state,
      confirmation,
      confirmation.decidedAt,
    ).state;
    expect(decideScreen03Briefing(
      state,
      confirmation,
      confirmation.decidedAt,
    )).toEqual({ state, duplicate: true });
    expect(() => decideScreen03Briefing(state, {
      ...confirmation,
      decisionId: "briefing-source-snapshot-second-decision",
      reason: "A proposal cannot receive a second terminal decision.",
      decidedAt: "2026-08-10T12:00:04.500Z",
    }, "2026-08-10T12:00:04.500Z")).toThrow(
      /only one terminal researcher decision/i,
    );

    const replacement = cloneFixture(firstPacket);
    replacement.researchedAt = "2026-08-10T12:00:05.000Z";
    const replacementEvidence = replacement.evidence[0]!;
    replacementEvidence.id = "research-source-v2";
    replacementEvidence.sourceId = "research-source-v2";
    replacementEvidence.retrievedAt = replacement.researchedAt;
    replacementEvidence.contentFingerprint = evidenceFingerprint("replacement-source");
    replacementEvidence.passages[0]!.id = "research-source-v2:passage:1";
    replacement.coverage.queries[0]!.returnedEvidenceIds = [
      replacementEvidence.id,
    ];
    replacement.coverage.channels[0]!.retrievedAt = replacement.researchedAt;
    for (const candidate of Object.values(replacement.proposals).flat()) {
      candidate.sourceIds = [replacementEvidence.id];
      candidate.passageIds = [replacementEvidence.passages[0]!.id];
    }
    const refreshed = refreshScreen03StateFromResearch(
      state,
      sourceHandoff,
      replacement,
      replacement.researchedAt,
    );

    expect(refreshed.evidence.map((item) => item.id)).toContain(
      "research-source-v2",
    );
    const sourceChange = refreshed.sourceChanges?.at(-1);
    const staleEvidence = refreshed.evidence.find((item) =>
      sourceChange?.staleEvidenceIds.includes(item.id)
    );
    expect(sourceChange).toMatchObject({
      trigger: "research-refresh",
      previousContentFingerprints: [evidence.contentFingerprint],
      observedContentFingerprint: replacementEvidence.contentFingerprint,
    });
    expect(staleEvidence).toMatchObject({
      status: "changed",
      contentFingerprint: evidence.contentFingerprint,
      passages: [expect.objectContaining({
        text: evidence.passages[0]?.text,
        status: "stale",
        contentFingerprint: evidence.contentFingerprint,
      })],
    });
    expect(staleEvidence?.id).not.toBe(evidenceId);
    expect(refreshed.briefing).toMatchObject({
      activeProposalId: null,
      confirmedIsCurrent: false,
      confirmed: { proposalId: proposal.proposalId },
    });
    expect(refreshed.briefing?.proposals[0]?.provenance.evidenceSnapshot)
      .toEqual(proposal.provenance.evidenceSnapshot);
    expect(refreshed.briefing?.decisions[0]?.content).toEqual(content);
    expect(requireScreen03VerificationState(refreshed)).toEqual(refreshed);
  });
});
