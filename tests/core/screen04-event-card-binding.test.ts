import { describe, expect, it } from "vitest";

import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { fingerprintScreen02WorkflowValue } from "../../src/core/screen02-workflow-state";
import {
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  applyScreen03Action,
  buildScreen03StateFromResearch,
  createScreen03LoadingState,
  type Screen03Proposal,
  type Screen03ResearchPacket,
  type Screen03TimelineProposal,
} from "../../src/core/screen03-workflow";
import {
  compileScreen04EventCardBinding,
  screen04EntryGate,
  screen04EventCardBindingIsCurrent,
} from "../../src/core/screen04-event-card-binding";
import {
  buildReadyAuditState,
  buildReadyFindState,
} from "./screen02-workflow-fixtures";

function proposal(
  group: Screen03Proposal["group"],
  id: string,
  label: string,
  value: string,
): Screen03Proposal {
  return {
    id,
    group,
    label,
    value,
    critical: true,
    reviewStatus: "proposed",
    editedValue: null,
    support: "direct",
    sourceIds: ["official-source"],
    passageIds: ["official-source:passage:1"],
    uncertainty: null,
  };
}

function fixture() {
  const handoff = buildScreen02WorkflowHandoff(
    buildReadyFindState(),
    "0.3.17",
    "2026-08-23T12:00:00.000Z",
  );
  const timeline: Screen03TimelineProposal = {
    ...proposal(
      "overview",
      "effective-date",
      "Effective date",
      "2020-01-01",
    ),
    group: "timeline",
    stage: "effective",
    date: "2020-01-01",
  };
  const eligibility = proposal(
    "eligibility",
    "eligibility-prose",
    "Eligibility threshold and exemption",
    "Businesses above a revenue threshold may be covered unless exempt.",
  );
  const component = proposal(
    "component",
    "component-duty",
    "Substantive duty",
    "Covered businesses must satisfy the verified duty.",
  );
  const cited = [
    "General Data Protection Regulation",
    timeline.value,
    eligibility.value,
    component.value,
  ].join(". ");
  const packet: Screen03ResearchPacket = {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt: "2026-08-23T12:00:02.000Z",
    upstreamEventFingerprint: handoff.integrity.eventFingerprint,
    coverage: {
      queries: [{
        id: "query-1",
        query: "official rule",
        purpose: "Verify identity, clock, eligibility, and duty.",
        returnedEvidenceIds: ["official-source"],
      }],
      channels: [{
        channel: "official-primary",
        status: "searched",
        note: "Official record reviewed.",
        retrievedAt: "2026-08-23T12:00:02.000Z",
      }],
      routes: ["official-record"],
      stages: ["identity", "effective", "eligibility", "component"],
      languages: ["en"],
      authorityTiers: [1],
      gaps: [],
      recordsReviewed: 1,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after the bounded factual fields are directly supported.",
        status: "met",
        note: "Fixture stopping rule met.",
      },
      outcomeValuesInspected: false,
    },
    evidence: [{
      id: "official-source",
      sourceId: "official-source",
      title: "Official record",
      locator: "https://official.example.test/rule",
      publisher: "Official authority",
      publishedDate: "2020-01-01",
      retrievedAt: "2026-08-23T12:00:02.000Z",
      authorityTier: 1,
      channel: "official-primary",
      contentFingerprint: fingerprintScreen02WorkflowValue({ cited }),
      language: "en",
      status: "retrieved",
      passages: [{
        id: "official-source:passage:1",
        number: 1,
        text: cited,
        locator: "section 1",
        basis: "source-excerpt",
      }],
    }],
    proposals: {
      identity: [proposal(
        "identity",
        "canonical-title",
        "Canonical title",
        "General Data Protection Regulation",
      )],
      overview: [],
      timeline: [timeline],
      component: [component],
      eligibility: [eligibility],
      amendment: [],
      requiredVariable: [],
    },
    contradictions: [],
    outcomeValuesInspected: false,
  };
  let state = buildScreen03StateFromResearch(
    handoff,
    packet,
    "2026-08-23T12:00:03.000Z",
  );
  const reviewing = state;
  state = applyScreen03Action(state, {
    type: "review-all-fields",
    mode: "confirm",
    reason: "Confirm the directly supported fixture facts.",
    at: "2026-08-23T12:00:04.000Z",
  });
  state = applyScreen03Action(state, {
    type: "select-focal-clock",
    proposalId: "effective-date",
    alternativeProposalIds: [],
    reason: "Select the verified effective date.",
    at: "2026-08-23T12:00:05.000Z",
  });
  state = applyScreen03Action(state, {
    type: "lock-event-card",
    reason: "Lock the completed factual review.",
    at: "2026-08-23T12:00:06.000Z",
  });
  return { handoff, reviewing, locked: state };
}

describe("Screen 3 to Screen 4 exact Event Card binding", () => {
  it("blocks entry before lock with the required reader copy", () => {
    const { handoff, reviewing } = fixture();
    expect(screen04EntryGate(reviewing, handoff)).toEqual({
      ready: false,
      code: "SCREEN04_EVENT_CARD_NOT_LOCKED",
      title: "Finish verifying the shock first",
      message:
        "Resolve all visible factual claims and lock the Event Card before auditing exposure in your sample.",
    });
    expect(screen04EntryGate(createScreen03LoadingState(
      handoff,
      "2026-08-23T12:00:01.000Z",
    ), handoff).ready).toBe(false);
  });

  it("preserves exact identity while projecting a small set of exposure dimensions", () => {
    const { handoff, locked } = fixture();
    const binding = compileScreen04EventCardBinding(locked, handoff);

    expect(binding).toMatchObject({
      screen02: {
        runId: handoff.runId,
        mode: "find",
        selectedEventId: handoff.event.identitySnapshotId,
        selectedEventFingerprint: handoff.integrity.eventFingerprint,
        handoffFingerprint: handoff.integrity.handoffFingerprint,
      },
      screen03: {
        runId: locked.runId,
        stateFingerprint: locked.integrity.stateFingerprint,
      },
      eventCard: {
        fingerprint: locked.lockedEventCard!.eventCardFingerprint,
      },
      verifiedShockName: "General Data Protection Regulation",
      assignmentUnit: [],
      geographicCoverage: [],
    });
    expect(binding.schemaVersion).toBe("screen-03-to-screen-04-event-card-v2");
    expect(binding.eligibilityConditions).toHaveLength(1);
    expect(binding.thresholds).toHaveLength(1);
    expect(binding.exemptions).toHaveLength(1);
    expect(binding.treatmentComponents).toHaveLength(1);
    expect(binding.exposureDimensions.map((item) => item.kind)).toEqual([
      "organization-type",
      "threshold",
      "exemption",
      "implementation-stage",
      "treatment-component",
    ]);
    expect(binding.exposureDimensions[0]).toMatchObject({
      id: "screen04-exposure-organization-type",
      label: "Eligible organization type",
    });
    expect(binding.compilerLimitations.map((item) => item.code)).toEqual([
      "SCREEN04_ASSIGNMENT_UNIT_NOT_MACHINE_TYPED",
      "SCREEN04_GEOGRAPHIC_RULE_NOT_MACHINE_TYPED",
      "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED",
      "SCREEN04_EXEMPTION_RULE_NOT_MACHINE_TYPED",
    ]);
    expect(binding.bindingFingerprint).toMatch(/^fnv1a64:[a-f0-9]{16}$/u);
  });

  it("rejects a different Screen 2 handoff and ignores context-only state fingerprints for staleness", () => {
    const { handoff, locked } = fixture();
    const binding = compileScreen04EventCardBinding(locked, handoff);
    const wrongHandoff = buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.3.17",
      "2026-08-23T12:00:00.000Z",
    );
    expect(() => compileScreen04EventCardBinding(locked, wrongHandoff)).toThrow(
      /do not match exactly/u,
    );

    const contextOnly = structuredClone(binding);
    contextOnly.screen03.stateFingerprint = "fnv1a64:1111111111111111";
    contextOnly.bindingFingerprint = "fnv1a64:2222222222222222";
    expect(screen04EventCardBindingIsCurrent(binding, contextOnly)).toBe(true);
  });
});
