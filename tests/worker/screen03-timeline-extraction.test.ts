import { describe, expect, it } from "vitest";

import {
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  requireScreen03ResearchPacket,
  type Screen03ResearchPacket,
} from "../../src/core/screen03-workflow";
import { compileScreen03ExactExcerpts } from "../../src/worker/screen03-timeline-extraction";

const at = "2026-08-13T18:00:00.000Z";

function packet(text: string, metadataText = "") {
  const value: Screen03ResearchPacket = {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt: at,
    upstreamEventFingerprint: "fnv1a64:1111111111111111",
    coverage: {
      queries: [],
      channels: [],
      routes: [],
      stages: [],
      languages: ["English"],
      authorityTiers: [2],
      gaps: [],
      recordsReviewed: 1,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: { rule: "fixture", status: "met", note: "fixture" },
      outcomeValuesInspected: false,
    },
    evidence: [{
      id: "evidence-official",
      sourceId: "source-official",
      title: "Official implementation record",
      locator: "https://oag.ca.gov/example",
      publisher: "California Department of Justice",
      publishedDate: "2020-06-02",
      retrievedAt: at,
      authorityTier: 2,
      channel: "source role: official record",
      contentFingerprint: "fnv1a64:2222222222222222",
      language: "English",
      status: "carried",
      passages: [
        {
          id: "passage-excerpt",
          number: 1,
          text,
          locator: "https://oag.ca.gov/example",
          basis: "source-excerpt",
        },
        ...(metadataText
          ? [{
              id: "passage-metadata",
              number: 2,
              text: metadataText,
              locator: "https://oag.ca.gov/example",
              basis: "source-metadata" as const,
            }]
          : []),
      ],
    }],
    proposals: {
      identity: [{
        id: "proposal-canonical-identity",
        group: "identity",
        label: "Canonical event title",
        value: "Official implementation record",
        critical: true,
        reviewStatus: "proposed",
        editedValue: null,
        support: "direct",
        sourceIds: ["evidence-official"],
        passageIds: ["passage-excerpt"],
        uncertainty: null,
      }],
      overview: [],
      timeline: [],
      component: [],
      eligibility: [],
      amendment: [{
        id: "proposal-enforcement-gap",
        group: "amendment",
        label: "Enforcement timing",
        value: "Unknown — no enforcement start date is established by the active packet.",
        critical: false,
        reviewStatus: "proposed",
        editedValue: null,
        support: "unsupported",
        sourceIds: [],
        passageIds: [],
        uncertainty: "fixture gap",
      }],
      requiredVariable: [],
    },
    contradictions: [],
    outcomeValuesInspected: false,
  };
  return requireScreen03ResearchPacket(value);
}

describe("Screen 3 exact-excerpt timeline compiler", () => {
  it("maps one identity-bound hazard advisory date to the occurrence clock", () => {
    const input = structuredClone(packet(
      "BULLETIN Hurricane Harvey Intermediate Advisory Number 23A NWS National Hurricane Center Miami FL AL092017 100 AM CDT Sat Aug 26 2017. " +
        "HURRICANE HARVEY MAKES A SECOND LANDFALL ON THE NORTHEASTERN SHORE OF COPANO BAY.",
    ));
    input.evidence[0]!.title = "Hurricane HARVEY Advisory 23A";
    input.evidence[0]!.locator =
      "https://www.nhc.noaa.gov/archive/2017/al09/al092017.public_a.023.shtml";
    input.evidence[0]!.publisher = "National Hurricane Center";
    input.evidence[0]!.channel =
      "official hazard advisory · source role: scientific hazard record";
    input.evidence[0]!.sourceRole = "scientific-hazard-record";
    input.evidence[0]!.sourcePlatform = "official-disaster-repository";
    input.evidence[0]!.passages[0]!.locator = input.evidence[0]!.locator;
    input.proposals.identity[0]!.value = "Hurricane HARVEY";

    const result = compileScreen03ExactExcerpts(
      requireScreen03ResearchPacket(input),
      ["Hurricane Harvey"],
    );

    expect(result.proposals.timeline).toEqual([
      expect.objectContaining({
        stage: "occurrence",
        label: "Occurrence or landfall date",
        date: "2017-08-26",
        support: "direct",
        sourceIds: ["evidence-official"],
        passageIds: ["passage-excerpt"],
      }),
    ]);
  });

  it("recovers an explicit public announcement but does not relabel a generic bill first-read action", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "The California Secretary of State announced on December 18, 2017 that proponents were cleared to begin collecting petition signatures. " +
        "AB 375 was read first time on February 9, 2017.",
    ));

    expect(result.proposals.timeline).toEqual([
      expect.objectContaining({
        stage: "announcement",
        label: "Announcement or public-discussion date",
        date: "2017-12-18",
        support: "direct",
        sourceIds: ["evidence-official"],
        passageIds: ["passage-excerpt"],
      }),
    ]);
    expect(result.proposals.timeline.some((proposal) =>
      proposal.date === "2017-02-09"
    )).toBe(false);
  });

  it("recovers signed, effective, and enforcement clocks with exact provenance", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "The California Consumer Privacy Act was signed into law on June 28, 2018. " +
        "It went into effect on January 1, 2020 and will be enforced starting July 1, 2020.",
    ), ["CCPA", "California Consumer Privacy Act"]);

    expect(result.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "enactment", date: "2018-06-28" }),
      expect.objectContaining({ stage: "effective", date: "2020-01-01" }),
      expect.objectContaining({ stage: "enforcement", date: "2020-07-01" }),
    ]));
    for (const proposal of result.proposals.timeline) {
      expect(proposal).toMatchObject({
        support: "direct",
        sourceIds: ["evidence-official"],
        passageIds: ["passage-excerpt"],
        reviewStatus: "proposed",
      });
    }
    expect(result.proposals.identity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Verified common name",
        value: "California Consumer Privacy Act",
        support: "direct",
        sourceIds: ["evidence-official"],
        passageIds: ["passage-excerpt"],
      }),
    ]));
    expect(result.proposals.amendment).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Enforcement timing", support: "unsupported" }),
    ]));
  });

  it("rejects metadata, invalid and malformed dates, and cross-stage pairing", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "The Act was signed into law and went into effect on January 1, 2020. " +
        "It will be enforced starting July 1, 2020. " +
        "It was signed into law on February 30, 2020. " +
        "The pilot was enacted on 2020-01-011. " +
        "12020-02-02 was enacted as a malformed token. " +
        "The amendment was adopted Jan. 2, 2019. " +
        "3 Sept. 2020 was adopted as a later amendment.",
      "Metadata says the Act was signed into law on June 28, 2018.",
    ));
    const pairs = result.proposals.timeline.map(
      (proposal) => `${proposal.stage}:${proposal.date}`,
    );
    expect(pairs).toEqual([
      "effective:2020-01-01",
      "enforcement:2020-07-01",
      "enactment:2019-01-02",
      "amendment:2020-09-03",
    ]);
    expect(pairs).not.toEqual(expect.arrayContaining([
      "enactment:2018-06-28",
      "enactment:2020-01-01",
      "enactment:2020-02-30",
      "enactment:2020-02-02",
    ]));
  });

  it("keeps one deterministic representative and exposes equal-strength conflict", () => {
    const first = packet(
      "The Act went into effect on January 1, 2020. It took effect on February 1, 2020.",
    );
    const result = compileScreen03ExactExcerpts(first);
    expect(result.proposals.timeline).toHaveLength(1);
    expect(result.proposals.timeline[0]).toMatchObject({
      date: "2020-01-01",
      support: "conflicting",
      sourceIds: ["evidence-official"],
      passageIds: ["passage-excerpt"],
    });
    expect(result.contradictions).toEqual([
      expect.objectContaining({
        kind: "source-conflict",
        proposalIds: [result.proposals.timeline[0]!.id],
        status: "unresolved",
      }),
    ]);
  });

  it("keeps distinct same-day renewal and deadline-extension milestones", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "The charter was renewed on April 5, 2014. " +
        "The application deadline was extended on April 5, 2014.",
    ));

    expect(result.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "amendment",
        label: "Charter renewal date",
        date: "2014-04-05",
      }),
      expect.objectContaining({
        stage: "amendment",
        label: "Deadline extension or delay date",
        date: "2014-04-05",
      }),
    ]));
    expect(result.proposals.timeline).toHaveLength(2);
    expect(result.contradictions).toEqual([]);
  });

  it("keeps sequential amendment and repeal milestones distinct", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "The law was amended on January 1, 2020. " +
        "The law was repealed on January 1, 2021.",
    ));

    expect(result.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "amendment",
        label: "Amendment date",
        date: "2020-01-01",
      }),
      expect.objectContaining({
        stage: "amendment",
        label: "Repeal date",
        date: "2021-01-01",
      }),
    ]));
    expect(result.proposals.timeline).toHaveLength(2);
    expect(result.contradictions).toEqual([]);
  });

  it("preserves source-stated phase scope for different effective dates", () => {
    const result = compileScreen03ExactExcerpts(packet(
      "Phase 1 took effect on January 1, 2020. " +
        "Phase 2 took effect on January 1, 2021.",
    ));

    expect(result.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "effective",
        date: "2020-01-01",
        uncertainty: expect.stringContaining("Source scope: Phase 1"),
      }),
      expect.objectContaining({
        stage: "effective",
        date: "2021-01-01",
        uncertainty: expect.stringContaining("Source scope: Phase 2"),
      }),
    ]));
    expect(result.proposals.timeline).toHaveLength(2);
    expect(result.contradictions).toEqual([]);
  });
});
