import { describe, expect, it } from "vitest";
import { normalizeScreen02AuditModelDraft } from "../../src/worker/screen02-audit-assessment-security";
import { normalizeScreen02FindDiscoveryQueryPlanDraft } from "../../src/core/screen02-find-workflow";
import { restoreScreen03HostInterpretation } from "../../src/worker/screen03-interpretation";

// The production live gate is a plain Node ESM script rather than TypeScript.
// @ts-expect-error The verifier helper intentionally has no generated types.
import { buildScreen02HostDraft, buildScreen03HostDraft } from "../../scripts/live-verifier-host-drafts.mjs";

describe("live verifier ChatGPT-host fixture builders", () => {
  it("constructs bounded Find query planning before source discovery", () => {
    const draft = buildScreen02HostDraft(
      {
        study: {
          eventFamily: "Regulation",
          industry: "Technology",
        },
      },
      {
        mode: "find-discovery-plan",
        draftContract: {
          mode: "find-discovery-plan",
          requestedPartIds: ["queryTerms", "rationale"],
        },
      },
    );

    expect(draft).toEqual({
      queryTerms: [
        "Regulation official announcement",
        "Technology public notice",
      ],
      rationale: expect.stringMatching(/recall.*without asserting event facts/i),
    });
    expect(normalizeScreen02FindDiscoveryQueryPlanDraft(draft)).toEqual(draft);
  });

  it("constructs only the requested Find assessment fields from a signed packet", () => {
    const request = {
      mode: "find-candidate",
      candidate: { title: "Example Privacy Rule" },
      draftContract: {
        mode: "find-candidate",
        requestedPartIds: ["studyFit", "outcomePathway", "nextChecks"],
        allowedCategories: {
          studyFit: ["strong", "mixed", "weak", "unclear"],
          outcomePathway: ["plausible", "limited", "unsupported", "unclear"],
          measurementPotential: ["possible", "difficult", "implausible", "unclear"],
        },
        allowedEvidenceSourceIds: ["official-source"],
      },
    };
    const draft = buildScreen02HostDraft(
      {
        study: {
          population: "U.S. publicly listed technology firms",
          industry: "Technology",
          geography: "United States",
          studyPeriod: "2016–2020",
          outcomeFamily: "Innovation",
        },
      },
      request,
    );

    expect(Object.keys(draft)).toEqual([
      "studyFit",
      "outcomePathway",
      "nextChecks",
    ]);
    expect(draft.studyFit.explanation).toContain(
      "U.S. publicly listed technology firms",
    );
    expect(draft.studyFit.explanation).toContain("Technology");
    expect(draft.outcomePathway.explanation).toContain("Innovation");
    expect(draft.studyFit.evidenceSourceIds).toEqual(["official-source"]);
  });

  it("constructs a complete Audit dossier without inventing related versions", () => {
    const draftContract = {
      mode: "audit-dossier" as const,
      requestedPartIds: [
        "atAGlance",
        "whatHappened",
        "whatChanged",
        "timeline",
        "broadCoverage",
        "keyComponents",
        "relatedVersions",
        "unresolvedFacts",
      ],
      allowedDateLeadStages: ["enactment", "effective"],
      allowedEvidenceSourceIds: ["ccpa-official"],
    };
    const draft = buildScreen02HostDraft(
      {},
      {
        draftContract,
        sourcePacket: {
          match: {
            identity: { canonicalTitle: "California Consumer Privacy Act" },
            dateLeads: [
              { date: "2018-06-28", stage: "enactment" },
            ],
          },
        },
      },
    );

    expect(draft.timeline).toEqual([
      expect.objectContaining({
        date: "2018-06-28",
        stage: "enactment",
        evidenceSourceIds: ["ccpa-official"],
      }),
    ]);
    expect(draft.relatedVersions).toEqual([]);
    expect(draft.unresolvedFacts).toEqual([
      expect.stringMatching(/^Evidence gap — relatedVersions:/),
    ]);
    expect(normalizeScreen02AuditModelDraft(draft, draftContract)).toMatchObject({
      acceptedPartIds: draftContract.requestedPartIds,
      failures: [],
    });
  });

  it("constructs Screen 3 reader help for every bounded proposal only", () => {
    const request = {
      protocolVersion: "screen-03-interpretation-v1" as const,
      event: {
        canonicalTitle: "Example Privacy Rule",
        eventType: "regulation",
        issuingJurisdiction: "United States",
      },
      studyContext: {
        population: "U.S. publicly listed technology firms",
        geography: "United States",
        industry: "Technology",
        studyPeriod: "2016–2020",
        outcomeFamily: "Innovation",
      },
      proposals: [
        {
          proposalId: "proposal-1",
          proposalFingerprint: "fnv1a64:0000000000000001",
          group: "overview" as const,
          label: "Consumer information rights",
          value: "The rule creates consumer rights concerning personal information.",
          critical: true,
          ownPassageIds: ["passage-1"],
          allowedPassageIds: ["passage-1"],
          sourceDiversityAvailable: false,
        },
        {
          proposalId: "proposal-2",
          proposalFingerprint: "fnv1a64:0000000000000002",
          group: "eligibility" as const,
          label: "Covered organizations",
          value: "The rule applies to organizations within its stated coverage boundaries.",
          critical: false,
          ownPassageIds: ["passage-2"],
          allowedPassageIds: ["passage-2"],
          sourceDiversityAvailable: false,
        },
      ],
      passages: [
        {
          passageId: "passage-1",
          evidenceId: "evidence-1",
          sourceId: "source-1",
          text: "The official record describes consumer rights concerning personal information.",
        },
        {
          passageId: "passage-2",
          evidenceId: "evidence-2",
          sourceId: "source-2",
          text: "The official record describes the organizations covered by the rule.",
        },
      ],
      constraints: {
        maximumKeyPoints: 4,
        maximumReferencesPerItem: 4,
        citationsRestrictedToProposalAllowlists: true as const,
        citeOwnPassageForEveryProposalReference: true as const,
        useTwoEvidenceItemsWhenAvailable: true as const,
        plainTextOnly: true as const,
        conditionalOutcomeLanguageOnly: true as const,
        nonCanonicalResearcherOrientationOnly: true as const,
      },
      outcomeValuesInspected: false as const,
    };
    const batch = {
      sourcePacket: {
        request,
      },
    };

    const draft = buildScreen03HostDraft(batch);

    expect(draft.studyRelevance.sampleConnection.text).toContain(
      "U.S. publicly listed technology firms",
    );
    expect(draft.studyRelevance.outcomeConnection.text).toContain("Innovation");
    expect(draft.studyRelevance.outcomeConnection.text).toMatch(/may|hypothesis/);
    expect(draft.claimExplanations.map((item: { proposalId: string }) => item.proposalId))
      .toEqual(["proposal-1", "proposal-2"]);
    expect(restoreScreen03HostInterpretation(draft, request)).toMatchObject({
      origin: "chatgpt-host",
      nonCanonical: true,
      limitations: [],
      outcomeValuesInspected: false,
    });
  });
});
