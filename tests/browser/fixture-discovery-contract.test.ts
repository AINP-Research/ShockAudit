import { describe, expect, it } from "vitest";

import {
  beginScreen02FindDiscovery,
  completeScreen02FindDiscovery,
  screen02FindRelevanceProfile,
} from "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  continueScreen02FindCandidate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
} from "../../src/core/screen02-workflow-state";
import { buildScreen02WorkflowHandoff } from
  "../../src/core/screen02-workflow-handoff";
import {
  discoverCanonicalScreen02Find,
  type ShockAuditEnv,
} from "../../src/worker/server";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";
import { deterministicConnectorFetch } from "./fixture-worker";

const retrievedAt = "2026-09-03T12:00:00.000Z";
const ftcGamingApprovalLetterUrl =
  "https://www.ftc.gov/system/files/attachments/press-releases/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program/p024526_commission_letter_approving_modified_esrb_program_and_exhibit_a.pdf";

type DiscoveryInput = Parameters<typeof discoverCanonicalScreen02Find>[2];
type QueryPlanning = DiscoveryInput["queryPlanning"];

type DiscoveryCase = {
  label: string;
  industry: string;
  studyPeriod: string;
  outcomeFamily: string;
  eventDescriptor: string;
  queryPlanning: "fixed" | "host";
  expectedCandidateIds: string[];
  expectedFunnel: NonNullable<
    Awaited<ReturnType<typeof discoverCanonicalScreen02Find>>["manifest"]["funnel"]
  >;
  expectedExclusionIds: string[];
};

const cases: DiscoveryCase[] = [
  {
    label: "Manufacturing 2014–2022 with bounded host vocabulary",
    industry: "Manufacturing",
    studyPeriod: "2014–2022",
    outcomeFamily: "Profitability",
    eventDescriptor: "regulatory shock",
    queryPlanning: "host",
    expectedCandidateIds: [
      "index-us-fr-2014-12164",
      "registry-us-california-iot-security-2020",
    ],
    expectedFunnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: 12,
      uniqueEventLeads: 12,
      evaluatedUniqueLeads: 12,
      duplicatesRemoved: 0,
      hardScopePassed: 2,
      hardScopeDemonstratedMismatch: 0,
      hardScopeInsufficientEvidence: 7,
      hardScopeMixed: 3,
      sourceQualityPassed: 8,
      substantiveInformationPassed: 7,
      relevancePassed: 2,
      exposureFeasibilityPassed: 2,
      qualifiedCandidates: 2,
      displayedCandidates: 2,
      directCandidates: 2,
      adjacentCandidates: 0,
      broadCandidates: 0,
      mismatchCandidates: 10,
      deeperRetrievalAttempts: 10,
      retrievalFailures: 4,
      hostContribution: 2,
    },
    expectedExclusionIds: [
      "index-us-co-equal-pay-2019",
      "index-us-virginia-cdpa-enactment-2021",
      "registry-eu-emissions-trading-2005",
      "registry-eu-gdpr-2018",
      "registry-us-california-ccpa-2020",
      "registry-us-colorado-privacy-act-2023",
      "registry-us-connecticut-data-privacy-act-2023",
      "registry-us-sec-conflict-minerals-2012",
      "registry-us-utah-consumer-privacy-act-2023",
      "registry-us-virginia-consumer-data-protection-2023",
    ],
  },
  {
    label: "Manufacturing 2014–2022 with the fixed fallback",
    industry: "Manufacturing",
    studyPeriod: "2014–2022",
    outcomeFamily: "Profitability",
    eventDescriptor: "regulatory shock",
    queryPlanning: "fixed",
    expectedCandidateIds: [
      "index-us-fr-2014-12164",
      "registry-us-california-iot-security-2020",
    ],
    expectedFunnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: 12,
      uniqueEventLeads: 12,
      evaluatedUniqueLeads: 12,
      duplicatesRemoved: 0,
      hardScopePassed: 2,
      hardScopeDemonstratedMismatch: 0,
      hardScopeInsufficientEvidence: 7,
      hardScopeMixed: 3,
      sourceQualityPassed: 8,
      substantiveInformationPassed: 7,
      relevancePassed: 2,
      exposureFeasibilityPassed: 2,
      qualifiedCandidates: 2,
      displayedCandidates: 2,
      directCandidates: 2,
      adjacentCandidates: 0,
      broadCandidates: 0,
      mismatchCandidates: 10,
      deeperRetrievalAttempts: 10,
      retrievalFailures: 4,
      hostContribution: 0,
    },
    expectedExclusionIds: [
      "index-us-co-equal-pay-2019",
      "index-us-virginia-cdpa-enactment-2021",
      "registry-eu-emissions-trading-2005",
      "registry-eu-gdpr-2018",
      "registry-us-california-ccpa-2020",
      "registry-us-colorado-privacy-act-2023",
      "registry-us-connecticut-data-privacy-act-2023",
      "registry-us-sec-conflict-minerals-2012",
      "registry-us-utah-consumer-privacy-act-2023",
      "registry-us-virginia-consumer-data-protection-2023",
    ],
  },
  {
    label: "Technology 2016–2020 with the fixed fallback",
    industry: "Technology",
    studyPeriod: "2016–2020",
    outcomeFamily: "Innovation",
    eventDescriptor: "privacy regulation",
    queryPlanning: "fixed",
    expectedCandidateIds: [
      "index-us-ftc-esrb-coppa-2018",
      "index-us-nevada-sb220-2019",
      "registry-us-california-ccpa-2020",
      "registry-us-california-iot-security-2020",
    ],
    expectedFunnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: 14,
      uniqueEventLeads: 13,
      evaluatedUniqueLeads: 13,
      duplicatesRemoved: 1,
      hardScopePassed: 3,
      hardScopeDemonstratedMismatch: 6,
      hardScopeInsufficientEvidence: 4,
      hardScopeMixed: 0,
      sourceQualityPassed: 10,
      substantiveInformationPassed: 10,
      relevancePassed: 4,
      exposureFeasibilityPassed: 4,
      qualifiedCandidates: 4,
      displayedCandidates: 4,
      directCandidates: 0,
      adjacentCandidates: 4,
      broadCandidates: 0,
      mismatchCandidates: 9,
      deeperRetrievalAttempts: 8,
      retrievalFailures: 3,
      hostContribution: 0,
    },
    expectedExclusionIds: [
      "index-us-california-aadc-2022",
      "index-us-colorado-privacy-enactment-2021",
      "index-us-virginia-cdpa-enactment-2021",
      "registry-eu-digital-markets-act-2023",
      "registry-eu-gdpr-2018",
      "registry-us-colorado-privacy-act-2023",
      "registry-us-connecticut-data-privacy-act-2023",
      "registry-us-utah-consumer-privacy-act-2023",
      "registry-us-virginia-consumer-data-protection-2023",
    ],
  },
  {
    label: "Technology 2017–2023 with bounded host vocabulary",
    industry: "Technology",
    studyPeriod: "2017–2023",
    outcomeFamily: "Profitability",
    eventDescriptor: "regulatory shock",
    queryPlanning: "host",
    expectedCandidateIds: [
      "index-us-california-aadc-2022",
      "index-us-colorado-privacy-enactment-2021",
      "index-us-ftc-esrb-coppa-2018",
      "index-us-nevada-sb220-2019",
      "index-us-virginia-cdpa-enactment-2021",
      "registry-us-california-ccpa-2020",
      "registry-us-california-iot-security-2020",
      "registry-us-colorado-privacy-act-2023",
      "registry-us-connecticut-data-privacy-act-2023",
      "registry-us-virginia-consumer-data-protection-2023",
    ],
    expectedFunnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: 14,
      uniqueEventLeads: 13,
      evaluatedUniqueLeads: 13,
      duplicatesRemoved: 1,
      hardScopePassed: 9,
      hardScopeDemonstratedMismatch: 0,
      hardScopeInsufficientEvidence: 4,
      hardScopeMixed: 0,
      sourceQualityPassed: 10,
      substantiveInformationPassed: 10,
      relevancePassed: 10,
      exposureFeasibilityPassed: 10,
      qualifiedCandidates: 10,
      displayedCandidates: 10,
      directCandidates: 0,
      adjacentCandidates: 10,
      broadCandidates: 0,
      mismatchCandidates: 3,
      deeperRetrievalAttempts: 8,
      retrievalFailures: 3,
      hostContribution: 2,
    },
    expectedExclusionIds: [
      "registry-eu-digital-markets-act-2023",
      "registry-eu-gdpr-2018",
      "registry-us-utah-consumer-privacy-act-2023",
    ],
  },
];

function planningFor(
  kind: DiscoveryCase["queryPlanning"],
  label: string,
  state: Parameters<typeof screen02FindRelevanceProfile>[0],
): QueryPlanning {
  if (kind === "fixed") {
    return {
      origin: "fixed-fallback",
      reason: "Use the deterministic browser fixture fallback.",
    };
  }
  return {
    origin: "chatgpt-host",
    queryTerms: [
      "California consumer privacy business thresholds",
      "consumer data privacy regulation technology firms",
    ],
    rationale:
      "Add bounded privacy, jurisdiction, and business-coverage vocabulary.",
    requestId: `request-${label}`,
    receiptId: `receipt-${label}`,
    qualificationProfile: screen02FindRelevanceProfile(state),
  };
}

describe("browser fixture canonical Find discovery", () => {
  it.each(cases)("keeps $label source-qualified and fail-closed", async (entry) => {
    const context = confirmedWorkflowFindContext(entry.industry, {
      studyPeriod: entry.studyPeriod,
      outcomeFamily: entry.outcomeFamily,
      eventDescriptor: entry.eventDescriptor,
    });
    const state = createScreen02FindState(
      context,
      `fixture-discovery-${entry.label}`,
      retrievedAt,
    );
    let ftcRecoveryRequests = 0;
    const connectorFetch: typeof deterministicConnectorFetch =
      async (request, init) => {
        const url = request instanceof URL
          ? request
          : typeof request === "string"
            ? new URL(request)
            : null;
        if (
          url &&
          `${url.origin}${url.pathname}` === FTC_PRESS_RELEASES_ENDPOINT
        ) {
          ftcRecoveryRequests += 1;
        }
        return deterministicConnectorFetch(request, init);
      };
    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: connectorFetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: `fixture-round-${entry.label}`,
        at: retrievedAt,
        exactRequest: "Find source-backed candidate shocks.",
        maximumCandidates: 10,
        queryPlanning: planningFor(entry.queryPlanning, entry.label, state),
      },
    );

    expect(ftcRecoveryRequests).toBe(1);
    expect(
      discovery.candidates.map((candidate) => candidate.candidateId).sort(),
    ).toEqual([...entry.expectedCandidateIds].sort());
    expect(discovery.manifest.funnel).toEqual(entry.expectedFunnel);
    expect(
      discovery.manifest.exclusions.map((exclusion) => exclusion.recordId)
        .sort(),
    ).toEqual([...entry.expectedExclusionIds].sort());
    expect(
      discovery.manifest.channels.filter((channel) =>
        channel.status === "failed"
      ),
    ).toEqual([]);
    expect(
      discovery.candidates.every((candidate) =>
        candidate.qualification?.eligible === true &&
        candidate.qualification.substantiveOverview.passed === true &&
        candidate.qualification.evidenceSourceIds.length > 0
      ),
    ).toBe(true);
  });

  it.each([
    {
      label: "U.S. video-gaming FTC recovery",
      industry: "Video gaming",
      outcomeFamily: "Profitability",
      expectedTitle:
        "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program",
      expectedFormalIdentifier: null,
      expectedSourceLocator:
        "https://www.ftc.gov/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program",
      expectedPrimaryLocator: ftcGamingApprovalLetterUrl,
      expectedImportantTiming: "Agency announcement date: 2018-08-14.",
    },
    {
      label: "U.S. energy final-rule discovery",
      industry: "Energy",
      outcomeFamily: "Investment",
      expectedTitle:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      expectedFormalIdentifier: "2018-03708",
      expectedSourceLocator:
        "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
      expectedPrimaryLocator: null,
      expectedImportantTiming: null,
    },
  ])(
    "supports a source-backed direct/adjacent selection and handoff for $label",
    async (entry) => {
      const context = confirmedWorkflowFindContext(entry.industry, {
        studyPeriod: "2014–2022",
        outcomeFamily: entry.outcomeFamily,
        eventDescriptor: "regulation",
      });
      const runId = `fixture-positive-${entry.industry}`;
      const requestId = `fixture-positive-request-${entry.industry}`;
      const roundId = `fixture-positive-round-${entry.industry}`;
      const initial = createScreen02FindState(context, runId, retrievedAt);
      const searching = beginScreen02FindDiscovery(initial, {
        discoveryRequestId: requestId,
        searchRoundId: roundId,
        candidateSetSnapshotId: `fixture-positive-set-${entry.industry}`,
        exactRequest: "Find source-backed candidate shocks.",
        at: "2026-09-03T12:00:01.000Z",
      });
      const discovery = await discoverCanonicalScreen02Find(
        {
          CONNECTOR_FETCH: deterministicConnectorFetch,
          SCREEN02_SEARCH_EXPANSION_MODE: "on",
        } as unknown as ShockAuditEnv,
        searching,
        {
          searchRoundId: roundId,
          at: "2026-09-03T12:00:02.000Z",
          exactRequest: "Find source-backed candidate shocks.",
          maximumCandidates: 10,
          queryPlanning: {
            origin: "fixed-fallback",
            reason: "Use the deterministic browser fixture fallback.",
          },
        },
      );
      const candidate = discovery.candidates.find((item) =>
        item.identity.canonicalTitle === entry.expectedTitle &&
        item.identity.formalIdentifier === entry.expectedFormalIdentifier
      );
      expect(
        candidate,
        JSON.stringify(discovery.manifest.exclusions, null, 2),
      ).toBeDefined();
      expect(candidate?.qualification).toMatchObject({
        eligible: true,
        classification: expect.stringMatching(/^(?:direct|adjacent)$/u),
        substantiveOverview: { passed: true },
      });
      if (entry.expectedImportantTiming) {
        expect(candidate?.qualification?.substantiveOverview.importantTiming)
          .toBe(entry.expectedImportantTiming);
      }
      expect(
        discovery.sources.some((source) =>
          candidate?.sourceIds.includes(source.id) &&
          source.locator === entry.expectedSourceLocator &&
          Boolean(source.evidenceText)
        ),
        JSON.stringify(discovery.sources, null, 2),
      ).toBe(true);
      if (entry.expectedPrimaryLocator) {
        const primaryReference = discovery.sources.find((source) =>
          source.locator === entry.expectedPrimaryLocator
        );
        expect(primaryReference).toMatchObject({
          authorityTier: 1,
          channel: "official-controlling-primary-reference-unparsed",
        });
        expect(primaryReference).not.toHaveProperty("evidenceText");
        expect(candidate?.sourceIds).toContain(primaryReference?.id);
        expect(candidate?.qualification?.evidenceSourceIds)
          .not.toContain(primaryReference?.id);
      }
      expect(discovery.manifest.outcomeValuesInspected).toBe(false);

      const completed = completeScreen02FindDiscovery(searching, {
        discoveryRequestId: requestId,
        at: "2026-09-03T12:00:03.000Z",
        sources: discovery.sources,
        candidates: discovery.candidates,
        manifest: discovery.manifest,
      });
      const persisted = completed.candidates.find((item) =>
        item.candidateId === candidate!.candidateId
      )!;
      expect(
        screen02FindCandidateSelectionGate(
          completed,
          persisted.candidateSnapshotId,
        ),
      ).toEqual({ eligible: true, reasons: [] });
      const selected = selectScreen02FindCandidate(
        completed,
        persisted.candidateSnapshotId,
        `fixture-positive-selection-${entry.industry}`,
        "2026-09-03T12:00:04.000Z",
        "Select the source-qualified regression candidate.",
      );
      const continued = continueScreen02FindCandidate(
        selected,
        `fixture-positive-continuation-${entry.industry}`,
        "2026-09-03T12:00:05.000Z",
        "Carry the selected candidate to Screen 3 for verification.",
      );
      const handoff = buildScreen02WorkflowHandoff(
        continued,
        "0.6.2",
        "2026-09-03T12:00:06.000Z",
      );
      expect(handoff).toMatchObject({
        mode: "find",
        destinationScreen: "screen-03",
        outcomeValuesInspected: false,
        decision: { candidateSnapshotId: persisted.candidateSnapshotId },
        event: {
          identity: {
            canonicalTitle: entry.expectedTitle,
            formalIdentifier: entry.expectedFormalIdentifier,
          },
          preliminaryQualification: {
            eligible: true,
            classification: expect.stringMatching(/^(?:direct|adjacent)$/u),
          },
        },
      });
      expect(
        handoff.sources.some((source) =>
          source.locator === entry.expectedSourceLocator &&
          Boolean(source.evidenceText)
        ),
      ).toBe(true);
      if (entry.expectedPrimaryLocator) {
        const primaryReference = handoff.sources.find((source) =>
          source.locator === entry.expectedPrimaryLocator
        );
        expect(primaryReference).toMatchObject({
          authorityTier: 1,
          channel: "official-controlling-primary-reference-unparsed",
        });
        expect(primaryReference).not.toHaveProperty("evidenceText");
      }
    },
  );
});
