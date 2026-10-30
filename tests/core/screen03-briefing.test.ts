import { describe, expect, it } from "vitest";

import {
  SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_SKILL_VERSION,
  SCREEN_03_BRIEFING_WORKFLOW_VERSION,
  addScreen03BriefingDecision,
  addScreen03BriefingProposal,
  createScreen03BriefingLifecycle,
  markScreen03BriefingFactsStale,
  restoreScreen03BriefingContent,
  restoreScreen03BriefingLifecycle,
  type Screen03BriefingContent,
  type Screen03BriefingProposal,
} from "../../src/core/screen03-briefing";

const evidence = "screen03-evidence:1";

function content(title: string): Screen03BriefingContent {
  const sectionEvidenceIds = {
    oneSentenceSummary: [evidence],
    whatTheShockIs: [evidence],
    whatChanged: [evidence],
    whyItMatters: [evidence],
    whoIsAffected: [evidence],
    eligibilityThresholdsAndExemptions: [evidence],
    importantTimingAndTreatmentStages: [evidence],
    enforcementAndPenalties: [evidence],
    laterChanges: [evidence],
  };
  return {
    schemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
    briefingStatus: "complete",
    title,
    oneSentenceSummary: `${title} is the selected documented shock.`,
    whatTheShockIs: "The bounded evidence describes the selected policy event.",
    whatChanged: "The bounded evidence records a change in the governing rule.",
    whyItMatters: "The documented rule changes obligations for affected organizations.",
    whoIsAffected: "The cited source identifies the affected organizational population.",
    eligibilityThresholdsAndExemptions: "The cited source defines the applicable scope and exceptions.",
    importantTimingAndTreatmentStages: "The cited source records the relevant implementation stages.",
    enforcementAndPenalties: "The cited source describes the enforcement treatment.",
    laterChanges: "The cited source records the available later treatment version.",
    plausiblePathwayToResearcherOutcome:
      "ChatGPT interpretation: the documented obligations could plausibly affect the selected outcome, but this is an untested research hypothesis.",
    unresolvedUncertainties: [],
    acknowledgedMissingEvidenceIds: [],
    acknowledgedConflictIds: [],
    sectionEvidenceIds,
    conciseRationale:
      "The proposal summarizes only the cited bounded evidence and preserves the interpretation boundary.",
    hostModel: "host_model_not_exposed",
  };
}

function proposal(
  proposalId: string,
  contentHash: string,
  value: Screen03BriefingContent,
): Screen03BriefingProposal {
  return {
    schemaVersion: SCREEN_03_BRIEFING_PROPOSAL_SCHEMA_VERSION,
    proposalId,
    contentHash,
    content: value,
    provenance: {
      origin: "chatgpt_host",
      briefingSchemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
      skillVersion: SCREEN_03_BRIEFING_SKILL_VERSION,
      workflowVersion: SCREEN_03_BRIEFING_WORKFLOW_VERSION,
      packetId: "sa3b-packet-v1.payload.signature",
      packetHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      eventFingerprint: "fnv1a64:0123456789abcdef",
      sourceRevision: 1,
      sourceStateFingerprint: "fnv1a64:fedcba9876543210",
      evidenceIds: [evidence],
      uncertaintySnapshot: [{
        kind: "missing-evidence",
        id: "screen03-gap-1",
        description: "The bounded evidence does not establish eligibility.",
      }],
      generatedAt: "2026-08-20T12:00:00.000Z",
      hostModel: "host_model_not_exposed",
    },
  };
}

describe("Screen 3 host briefing core lifecycle", () => {
  it("rejects unsafe or incomplete exact content", () => {
    const valid = content("Documented shock");
    expect(restoreScreen03BriefingContent(valid)).toEqual(valid);
    expect(restoreScreen03BriefingContent({
      ...valid,
      whatChanged: "<script>alert(1)</script>",
    })).toBeNull();
    const { laterChanges: _laterChanges, ...missingField } = valid;
    expect(restoreScreen03BriefingContent(missingField)).toBeNull();
  });

  it("preserves the prior confirmed version when a later proposal is rejected", () => {
    let lifecycle = createScreen03BriefingLifecycle(
      `s3ref_${"A".repeat(43)}`,
    );
    const firstContent = content("First proposal");
    const first = proposal(
      "briefing-proposal-1",
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      firstContent,
    );
    lifecycle = addScreen03BriefingProposal(lifecycle, first).lifecycle;
    lifecycle = addScreen03BriefingDecision(lifecycle, {
      schemaVersion: SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
      decisionId: "briefing-decision-1",
      proposalId: first.proposalId,
      action: "confirm",
      reason: "The researcher confirmed the source-linked proposal.",
      decidedAt: "2026-08-20T12:01:00.000Z",
      contentHash: first.contentHash,
      content: first.content,
    }).lifecycle;
    const second = proposal(
      "briefing-proposal-2",
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      content("Second proposal"),
    );
    lifecycle = addScreen03BriefingProposal(lifecycle, second).lifecycle;
    lifecycle = addScreen03BriefingDecision(lifecycle, {
      schemaVersion: SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
      decisionId: "briefing-decision-2",
      proposalId: second.proposalId,
      action: "reject",
      reason: "The researcher rejected the later proposal.",
      decidedAt: "2026-08-20T12:02:00.000Z",
      contentHash: null,
      content: null,
    }).lifecycle;

    expect(lifecycle.proposals).toHaveLength(2);
    expect(lifecycle.decisions).toHaveLength(2);
    expect(lifecycle.confirmed).toMatchObject({
      proposalId: first.proposalId,
      decisionId: "briefing-decision-1",
      contentHash: first.contentHash,
    });
    expect(lifecycle.activeProposalId).toBe(first.proposalId);
    expect(lifecycle.confirmedIsCurrent).toBe(true);
    expect(restoreScreen03BriefingLifecycle(lifecycle)).toEqual(lifecycle);
    expect(lifecycle.proposals[0]?.provenance.uncertaintySnapshot).toEqual([
      {
        kind: "missing-evidence",
        id: "screen03-gap-1",
        description: "The bounded evidence does not establish eligibility.",
      },
    ]);
  });

  it("stores a researcher revision separately and marks preserved history stale after facts change", () => {
    let lifecycle = createScreen03BriefingLifecycle(
      `s3ref_${"B".repeat(43)}`,
    );
    const original = proposal(
      "briefing-proposal-revise",
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      content("Original host proposal"),
    );
    lifecycle = addScreen03BriefingProposal(lifecycle, original).lifecycle;
    const revisedContent = content("Researcher revision");
    const revisedHash =
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    lifecycle = addScreen03BriefingDecision(lifecycle, {
      schemaVersion: SCREEN_03_BRIEFING_DECISION_SCHEMA_VERSION,
      decisionId: "briefing-decision-revise",
      proposalId: original.proposalId,
      action: "revise",
      reason: "The researcher retained the citations and revised the wording.",
      decidedAt: "2026-08-20T12:03:00.000Z",
      contentHash: revisedHash,
      content: revisedContent,
    }).lifecycle;

    expect(lifecycle.proposals[0]?.content).toEqual(original.content);
    expect(lifecycle.confirmed).toMatchObject({
      proposalId: original.proposalId,
      contentHash: revisedHash,
      content: revisedContent,
    });
    expect(lifecycle.confirmedIsCurrent).toBe(true);

    const stale = markScreen03BriefingFactsStale(lifecycle);
    expect(stale.proposals).toEqual(lifecycle.proposals);
    expect(stale.decisions).toEqual(lifecycle.decisions);
    expect(stale.confirmed).toEqual(lifecycle.confirmed);
    expect(stale.activeProposalId).toBeNull();
    expect(stale.confirmedIsCurrent).toBe(false);
  });
});
