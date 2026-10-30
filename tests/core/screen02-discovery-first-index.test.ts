import { describe, expect, it } from "vitest";

import {
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
  PUBLIC_SCREEN02_IDENTITY_ONLY_PROPOSALS,
  SCREEN02_PUBLIC_EVENT_INDEX_COVERAGE,
  PUBLIC_SCREEN02_EVENT_DATE_DETAILS,
  screen02PublicEventIndexMatchesScope,
} from "../../src/core/screen02-public-event-index";
import {
  qualifyAndRankScreen02FindProposals,
} from "../../src/core/screen02-qualification";
import { SCREEN02_DISCOVERY_EVENT_REGISTRY } from
  "../../src/core/screen02-registry";
import {
  buildScreen02StudyRelevanceProfile,
} from "../../src/core/screen02-relevance-profile";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import { groundScreen02ProposalSource } from
  "../../src/core/screen02-source-grounding";
import { confirmedWorkflowFindContext } from "./screen02-workflow-fixtures";

function ukFinancialServicesContext(): Screen01StudyContext {
  const base = confirmedWorkflowFindContext("Financial services", {
    studyPeriod: "2010–2020",
    outcomeFamily: "Risk",
    eventDescriptor: "regulation",
  });
  const sentence =
    "Find a regulation affecting regulated firms in United Kingdom financial services from 2010 to 2020 that may influence risk.";
  return {
    ...base,
    studySentence: sentence,
    contractSourceSentence: sentence,
    scopeContract: {
      ...base.scopeContract,
      population: "Regulated firms",
      geography: "United Kingdom",
      industry: "Financial services",
      outcomeFamily: "Risk",
    },
    revision: base.revision + 1,
  };
}

function discoveryResult(context: Screen01StudyContext, fingerprint: string) {
  const profile = buildScreen02StudyRelevanceProfile({
    scopeFingerprint: fingerprint,
    originalIndustryText: context.scopeContract.industry,
    sampleGeography: context.scopeContract.geography,
    studyPeriod: context.scopeContract.studyPeriod,
    eventFamily: context.scopeContract.eventFamily,
    at: "2026-09-11T00:00:00.000Z",
  });
  const researchText = [
    context.studySentence,
    context.scopeContract.population,
    context.scopeContract.geography,
    context.scopeContract.industry,
    context.scopeContract.eventFamily,
    context.scopeContract.outcomeFamily,
  ].join(" ");
  return qualifyAndRankScreen02FindProposals(
    PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.filter((proposal) =>
      screen02PublicEventIndexMatchesScope(
        proposal.id,
        context.scopeContract.industry,
        context.scopeContract.geography,
        [
          profile.canonicalIndustryLabel,
          ...profile.industryAliases,
          ...profile.internationalVariants,
          ...profile.subsectors,
          ...profile.products,
          ...profile.services,
          ...profile.industryActors,
          ...profile.businessModels,
          ...profile.distributionChannels,
          ...profile.platformRelationships,
          ...profile.regulatedActivities,
          ...profile.workforceRelationships,
          ...profile.supplyChainRelationships,
          ...profile.customerOrUserRelationships,
          ...profile.regulatorySurfaces,
          ...profile.disruptionSurfaces,
        ],
        [
          profile.sampleGeography,
          ...profile.geographyAliases,
          ...profile.possibleIssuingJurisdictions,
          ...profile.jurisdictionAliases,
        ],
      ) === true
    ),
    context,
    {
      scopeFingerprint: fingerprint,
      maximumCandidates: 12,
      studyProfile: profile,
    },
  );
}

describe("Screen 2 discovery-first public event index", () => {
  it("ships a versioned, source-bound index with explicit date roles", () => {
    expect(SCREEN02_PUBLIC_EVENT_INDEX_COVERAGE).toMatchObject({
      schemaVersion: "screen-02-public-event-index-coverage-v1",
      capturedAt: "2026-10-28",
      recordCount: 69,
    });
    for (const [candidateId, details] of Object.entries(
      PUBLIC_SCREEN02_EVENT_DATE_DETAILS,
    )) {
      expect(candidateId).toBeTruthy();
      for (const detail of Object.values(details)) {
        expect(detail.label).toBeTruthy();
        expect(detail.role).toMatch(
          /^(announcement|adoption|enactment|scheduled_effect|effective|implementation|enforcement|amendment|publication|occurrence|ruling|injunction|invalidation|withdrawal|repeal|supersession|other)$/u,
        );
        expect(detail.sourceIds.length).toBeGreaterThan(0);
        expect(detail.uncertainty).toBeTruthy();
      }
    }
  });

  it("retains the full CCPA enactment, effect, enforcement, and CPRA chronology", () => {
    expect(PUBLIC_SCREEN02_EVENT_DATE_DETAILS[
      "registry-us-california-ccpa-2020"
    ]).toMatchObject({
      "2018-06-28": { role: "enactment" },
      "2020-01-01": { role: "effective" },
      "2020-07-01": { role: "enforcement" },
      "2023-01-01": {
        role: "amendment",
        label: "CPRA amendments became operative",
      },
    });
  });

  it("indexes every coauthor-reported policy that previously returned not found", () => {
    expect(PUBLIC_SCREEN02_IDENTITY_ONLY_PROPOSALS.map(({ title }) => title))
      .toEqual(expect.arrayContaining([
        "California SB 1383 — Expansion of Family and Medical Leave",
        "California SB 826 — Women on Corporate Boards",
        "Illinois Artificial Intelligence Video Interview Act",
        "NYC Fair Workweek Law",
        "NYC Local Law 144 — Automated Employment Decision Tools",
        "NYC Congestion Pricing Program (2025)",
        "Oregon Fair Work Week Act",
        "SEC Executive Compensation Clawback Rule (Rule 10D-1)",
        "State Salary History Bans",
        "SEC Climate-Related Disclosure Final Rule",
        "Washington My Health My Data Act",
      ]));
  });

  it("retains the complete FTC noncompete-rule status chronology", () => {
    const proposal = PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.find(({ id }) =>
      id === "index-us-ftc-noncompete-rule-2024"
    );
    expect(proposal).toBeDefined();
    expect(proposal?.nativeIdentity?.status).toMatch(/removed from the CFR/iu);
    expect(PUBLIC_SCREEN02_EVENT_DATE_DETAILS[
      "index-us-ftc-noncompete-rule-2024"
    ]).toMatchObject({
      "2024-05-07": { role: "publication" },
      "2024-08-20": { role: "invalidation" },
      "2024-09-04": { role: "scheduled_effect" },
      "2025-09-05": { role: "invalidation" },
      "2026-02-12": { role: "repeal" },
    });
  });

  it("keeps adoption, publication, effect, and compliance clocks separate", () => {
    expect(PUBLIC_SCREEN02_EVENT_DATE_DETAILS[
      "registry-us-sec-cybersecurity-disclosure-2023"
    ]).toMatchObject({
      "2023-07-26": { role: "adoption" },
      "2023-08-04": { role: "publication" },
      "2023-09-05": { role: "effective" },
      "2023-12-15": { role: "implementation" },
      "2023-12-18": { role: "implementation" },
      "2024-06-15": { role: "implementation" },
    });
    expect(PUBLIC_SCREEN02_EVENT_DATE_DETAILS[
      "index-us-fda-menu-labeling-2014-2018"
    ]).toMatchObject({
      "2014-12-01": { role: "publication" },
      "2018-05-07": { role: "implementation" },
    });
  });

  it("extends the broader retained registry instead of replacing it", () => {
    expect(SCREEN02_DISCOVERY_EVENT_REGISTRY).toHaveLength(63);
    expect(SCREEN02_DISCOVERY_EVENT_REGISTRY.map((proposal) => proposal.id))
      .toEqual(expect.arrayContaining([
        "registry-eu-gdpr-2018",
        "registry-eu-nfrd-2017",
        "registry-eu-digital-markets-act-2023",
        "registry-eu-emissions-trading-2005",
        "registry-us-hurricane-harvey-2017",
        "index-us-dodd-frank-2010",
        "index-us-state-pay-transparency-series-2021-2025",
        "index-us-fda-menu-labeling-2014-2018",
      ]));
    expect(new Set(SCREEN02_DISCOVERY_EVENT_REGISTRY.map((proposal) =>
      proposal.event.eventFamily
    )).size).toBeGreaterThan(1);
  });

  it("matches source-backed facts and geography rather than candidate-id cohorts", () => {
    expect(screen02PublicEventIndexMatchesScope(
      "index-us-fr-2018-03708",
      "Energy",
      "United States",
      ["electric storage", "electricity market"],
    )).toBe(true);
    expect(screen02PublicEventIndexMatchesScope(
      "index-us-fr-2018-03708",
      "Food",
      "United States",
      ["food production", "restaurant"],
    )).toBe(false);
    expect(screen02PublicEventIndexMatchesScope(
      "index-uk-banking-reform-act-2013",
      "Financial services",
      "United States",
      ["banking", "insurance"],
    )).toBe(false);
    expect(screen02PublicEventIndexMatchesScope(
      "unknown-case-label",
      "Energy",
      "United States",
      ["electricity"],
    )).toBeNull();
  });

  const cases: Array<{
    label: string;
    context: Screen01StudyContext;
    minimum: number;
  }> = [
    {
      label: "U.S. public video-gaming firms, 2014–2022, profitability",
      context: confirmedWorkflowFindContext("Video gaming", {
        studyPeriod: "2014–2022",
        outcomeFamily: "Profitability",
        eventDescriptor: "regulation",
      }),
      minimum: 10,
    },
    {
      label: "U.S. public energy firms, 2014–2022, investment",
      context: confirmedWorkflowFindContext("Energy", {
        studyPeriod: "2014–2022",
        outcomeFamily: "Investment",
        eventDescriptor: "regulation",
      }),
      minimum: 10,
    },
    {
      label: "U.K. regulated financial-services firms, 2010–2020, risk",
      context: ukFinancialServicesContext(),
      minimum: 10,
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    it(`admits at least ten distinct candidates for ${testCase.label}`, () => {
      const result = discoveryResult(testCase.context, `scope-index-${index}`);
      const diagnostic = result.evaluated.map(({ proposal, qualification }) => ({
        id: proposal.id,
        title: proposal.title,
        eligible: qualification.eligible,
        class: qualification.classification,
        hardScope: qualification.hardScope.disposition,
        overview: qualification.substantiveOverview.passed,
        source: qualification.sourceQuality.status,
        exposure: qualification.exposureFeasibility.status,
        exclusions: qualification.exclusionCodes,
        overviewFlags: {
          identity: qualification.substantiveOverview.identity,
          change: qualification.substantiveOverview.change,
          date: qualification.substantiveOverview.materialDate,
        },
        directTerms: qualification.industryFit.matchedDirectTerms,
        adjacentTerms: qualification.industryFit.matchedAdjacentTerms,
        grounding: proposal.sources.map((source) => ({
          id: source.id,
          ...groundScreen02ProposalSource(proposal, source),
        })),
      }));
      expect(
        result.selected.length,
        JSON.stringify(diagnostic, null, 2),
      ).toBeGreaterThanOrEqual(testCase.minimum);
      expect(new Set(result.selected.map(({ proposal }) => proposal.id)).size)
        .toBe(result.selected.length);
      for (const { qualification } of result.selected) {
        expect(qualification.candidateAdmission).toMatchObject({
          policyVersion: "screen-02-candidate-admission-v1",
          displayEvidence: { supported: true },
          relevance: { recommended: true },
        });
        expect(
          qualification.candidateAdmission?.screen3VerificationNeeds.length,
        ).toBeGreaterThan(0);
        expect(qualification.classification).not.toBe("mismatch");
      }
    });
  }
});
