import { describe, expect, it } from "vitest";

import {
  SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
  SCREEN_03_BRIEFING_PACKET_SCHEMA_VERSION,
  screen03BriefingFactualSectionKeys,
  type Screen03BriefingContent,
  type Screen03BriefingSectionEvidenceIds,
} from "../../src/core/screen03-briefing";
import {
  validateScreen03BriefingContentAgainstPacket,
  type Screen03BriefingPacketBody,
} from "../../src/worker/screen03-briefing-security";

const evidenceId = "screen03-evidence-1";

function packet(input: {
  missingEvidence?: string[];
  conflictedClaim?: boolean;
} = {}): Screen03BriefingPacketBody {
  const conflicted = input.conflictedClaim ?? false;
  const missingEvidence = (input.missingEvidence ?? []).map(
    (description, index) => ({
      missingEvidenceId: `screen03-gap-${index + 1}`,
      description,
    }),
  );
  return {
    schemaVersion: SCREEN_03_BRIEFING_PACKET_SCHEMA_VERSION,
    requiredBriefingStatus: conflicted
      ? "evidence-conflicted"
      : missingEvidence.length > 0
        ? "evidence-insufficient"
        : "complete",
    safeRunRef: `s3ref_${"A".repeat(43)}`,
    selectedEventId: "screen02-event-1",
    canonicalEventName: "Documented policy shock",
    aliases: ["Example policy alias"],
    jurisdiction: "Example jurisdiction",
    responsibleAuthority: "Example authority",
    eventType: "policy",
    eventStatus: "operative",
    formalIdentifier: "EX-1",
    eventFingerprint: "fnv1a64:0123456789abcdef",
    screen03Revision: 1,
    screen03StateFingerprint: "fnv1a64:fedcba9876543210",
    claims: [{
      proposalId: "screen03-proposal-1",
      group: "overview",
      label: "Documented change",
      proposedValue: "The official record documents a change.",
      reviewedValue: null,
      fieldLevelReviewStatus: "proposed",
      supportStatus: conflicted ? "conflicting" : "direct",
      factStatus: conflicted ? "conflicted" : "verified-provisional",
      critical: true,
      evidenceIds: [evidenceId],
      passageIds: ["screen03-passage-1"],
      uncertainty: conflicted ? "Controlling records disagree." : null,
      conflictIds: [],
    }],
    evidence: [{
      evidenceId,
      sourceId: "screen03-source-1",
      title: "Official record",
      authority: "Example authority",
      authorityTier: 1,
      publishedDate: "2026-08-01",
      retrievedAt: "2026-08-02T12:00:00.000Z",
      contentFingerprint: "fnv1a64:0011223344556677",
      permittedLink: "https://example.gov/record",
      language: "en",
      reviewStatus: "retrieved",
      passages: [{
        passageId: "screen03-passage-1",
        number: 1,
        text: "The official record documents the policy change.",
        locator: "https://example.gov/record#change",
        basis: "source-excerpt",
      }],
    }],
    unresolvedConflicts: [],
    missingEvidence,
    studyScope: {
      confirmed: true,
      studySentence: "Study the documented shock in the confirmed population.",
      population: "Confirmed population",
      assignmentLevel: "Organization",
      analysisLevel: "Organization",
      geography: "Example jurisdiction",
      industry: "All covered industries",
      studyPeriod: "2025-2027",
      eventFamily: "Policy",
      outcomeFamily: "Organizational outcome",
      outcomeFrequency: "Monthly",
    },
    existingResearcherApprovals: [],
    instructions: {
      verifiedFacts: "Use only verified packet facts.",
      provisionalFacts: "Keep provisional facts provisional.",
      conflictsAndUnknowns: "Preserve every conflict and unknown.",
      interpretationBoundary: "Label interpretation as interpretation.",
    },
    outcomeValuesInspected: false,
  };
}

function content(
  briefingStatus: Screen03BriefingContent["briefingStatus"],
  unresolvedUncertainties: string[],
  acknowledgements: {
    missingEvidenceIds?: string[];
    conflictIds?: string[];
  } = {},
): Screen03BriefingContent {
  const sectionEvidenceIds = Object.fromEntries(
    screen03BriefingFactualSectionKeys.map((key) => [key, [evidenceId]]),
  ) as Screen03BriefingSectionEvidenceIds;
  return {
    schemaVersion: SCREEN_03_BRIEFING_CONTENT_SCHEMA_VERSION,
    briefingStatus,
    title: "Documented policy shock",
    oneSentenceSummary: "The official evidence documents the selected shock.",
    whatTheShockIs: "The packet identifies a documented policy shock.",
    whatChanged: "The cited record documents the change.",
    whyItMatters: "The documented change may alter the study setting.",
    whoIsAffected: "The cited record identifies the covered population.",
    eligibilityThresholdsAndExemptions: "The cited record defines the applicable scope.",
    importantTimingAndTreatmentStages: "The cited record identifies the relevant timing.",
    enforcementAndPenalties: "The cited record describes enforcement treatment.",
    laterChanges: "The cited record describes the available later changes.",
    plausiblePathwayToResearcherOutcome:
      "ChatGPT interpretation: the shock could plausibly affect the selected outcome, but this is an untested hypothesis.",
    unresolvedUncertainties,
    acknowledgedMissingEvidenceIds:
      acknowledgements.missingEvidenceIds ?? [],
    acknowledgedConflictIds: acknowledgements.conflictIds ?? [],
    sectionEvidenceIds,
    conciseRationale: "The briefing separates evidence from interpretation.",
    hostModel: "host_model_not_exposed",
  };
}

describe("Screen 3 host briefing packet validation", () => {
  it("requires the machine status and exact missing-evidence acknowledgements while allowing natural paraphrase", () => {
    const boundedPacket = packet({
      missingEvidence: ["Eligibility evidence is not established."],
    });
    const gapId = boundedPacket.missingEvidence[0]!.missingEvidenceId;
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("complete", [], { missingEvidenceIds: [gapId] }),
      boundedPacket,
    )).toThrow(/must copy requiredBriefingStatus.*evidence-insufficient/i);
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("evidence-insufficient", [
        "The available records do not make the eligibility boundary clear.",
      ]),
      boundedPacket,
    )).toThrow(/every and only current missing-evidence ID/i);
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("evidence-insufficient", [
        "The available records do not make the eligibility boundary clear.",
      ], { missingEvidenceIds: [gapId, "foreign-gap"] }),
      boundedPacket,
    )).toThrow(/every and only current missing-evidence ID/i);
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("evidence-insufficient", ["e"], {
        missingEvidenceIds: [gapId],
      }),
      boundedPacket,
    )).toThrow(/substantive natural-language uncertainty/i);
    expect(validateScreen03BriefingContentAgainstPacket(
      content("evidence-insufficient", [
        "The available records do not make the eligibility boundary clear.",
      ], { missingEvidenceIds: [gapId] }),
      boundedPacket,
    ).content.briefingStatus).toBe("evidence-insufficient");
  });

  it("requires conflicted status and exact conflict acknowledgements", () => {
    const boundedPacket = packet({ conflictedClaim: true });
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("complete", [], {
        conflictIds: ["screen03-proposal-1"],
      }),
      boundedPacket,
    )).toThrow(/must copy requiredBriefingStatus.*evidence-conflicted/i);
    expect(() => validateScreen03BriefingContentAgainstPacket(
      content("evidence-conflicted", [
        "The controlling records point to materially different treatments.",
      ], { conflictIds: ["screen03-proposal"] }),
      boundedPacket,
    )).toThrow(/every and only current conflict ID/i);
    expect(validateScreen03BriefingContentAgainstPacket(
      content("evidence-conflicted", [
        "The controlling records point to materially different treatments.",
      ], { conflictIds: ["screen03-proposal-1"] }),
      boundedPacket,
    ).content.briefingStatus).toBe("evidence-conflicted");
  });

  it("rejects confident uncited factual text and evidence IDs outside the packet", () => {
    const boundedPacket = packet({
      missingEvidence: ["Coverage remains incomplete."],
    });
    const gapId = boundedPacket.missingEvidence[0]!.missingEvidenceId;
    const uncited = content("evidence-insufficient", [
      "The bounded source set does not fully establish coverage.",
    ], { missingEvidenceIds: [gapId] });
    uncited.sectionEvidenceIds.whoIsAffected = [];
    uncited.whoIsAffected = "All California businesses are affected.";
    expect(() => validateScreen03BriefingContentAgainstPacket(
      uncited,
      boundedPacket,
    )).toThrow(/exact bounded-evidence fallback/i);
    uncited.whoIsAffected =
      "Not established by the bounded evidence packet.";
    expect(validateScreen03BriefingContentAgainstPacket(
      uncited,
      boundedPacket,
    ).content.whoIsAffected).toBe(
      "Not established by the bounded evidence packet.",
    );

    const foreign = content("evidence-insufficient", [
      "The bounded source set does not fully establish coverage.",
    ], { missingEvidenceIds: [gapId] });
    foreign.sectionEvidenceIds.whatChanged = ["foreign-evidence"];
    expect(() => validateScreen03BriefingContentAgainstPacket(
      foreign,
      boundedPacket,
    )).toThrow(/outside the current packet/i);
  });

  it("accepts the exact worst-case bounded acknowledgement sets with one substantive paraphrase", () => {
    const boundedPacket = packet({
      missingEvidence: Array.from(
        { length: 8 },
        (_, index) => `Bounded evidence gap ${index + 1} remains unresolved.`,
      ),
    });
    const sourceClaim = boundedPacket.claims[0]!;
    boundedPacket.claims = Array.from({ length: 8 }, (_, index) => ({
      ...sourceClaim,
      proposalId: `screen03-conflicted-claim-${index + 1}`,
      supportStatus: "conflicting" as const,
      factStatus: "conflicted" as const,
      uncertainty: `The controlling record differs for claim ${index + 1}.`,
    }));
    boundedPacket.unresolvedConflicts = Array.from(
      { length: 8 },
      (_, index) => ({
        conflictId: `screen03-conflict-${index + 1}`,
        kind: "record-conflict",
        proposalIds: [boundedPacket.claims[index]!.proposalId],
        summary: `Official records disagree for bounded conflict ${index + 1}.`,
      }),
    );
    boundedPacket.requiredBriefingStatus = "evidence-conflicted";
    const conflictIds = [
      ...boundedPacket.unresolvedConflicts.map((item) => item.conflictId),
      ...boundedPacket.claims.map((item) => item.proposalId),
    ];
    expect(conflictIds).toHaveLength(16);
    const validated = validateScreen03BriefingContentAgainstPacket(
      content("evidence-conflicted", [
        "Several official records conflict while other bounded coverage questions remain unresolved.",
      ], {
        missingEvidenceIds: boundedPacket.missingEvidence.map(
          (item) => item.missingEvidenceId,
        ),
        conflictIds,
      }),
      boundedPacket,
    );
    expect(validated.content.acknowledgedMissingEvidenceIds).toHaveLength(8);
    expect(validated.content.acknowledgedConflictIds).toHaveLength(16);
    expect(validated.content.unresolvedUncertainties).toHaveLength(1);
  });
});
