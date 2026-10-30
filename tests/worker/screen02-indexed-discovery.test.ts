import { describe, expect, it, vi } from "vitest";

import { beginScreen02FindDiscovery, completeScreen02FindDiscovery } from
  "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  continueScreen02FindCandidate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
} from "../../src/core/screen02-workflow-state";
import { buildScreen02WorkflowHandoff } from
  "../../src/core/screen02-workflow-handoff";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import {
  discoverCanonicalScreen02Find,
  type ShockAuditEnv,
} from "../../src/worker/server";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";

const openedAt = "2026-09-11T05:00:00.000Z";
const startedAt = "2026-09-11T05:00:01.000Z";
const retrievedAt = "2026-09-11T05:00:02.000Z";
const completedAt = "2026-09-11T05:00:03.000Z";

function targetContext(target: "gaming" | "energy" | "uk-finance") {
  if (target === "gaming") {
    return confirmedWorkflowFindContext("Video gaming", {
      eventDescriptor: "regulation",
      studyPeriod: "2014–2022",
      outcomeFamily: "Profitability",
    });
  }
  if (target === "energy") {
    return confirmedWorkflowFindContext("Energy", {
      eventDescriptor: "regulation",
      studyPeriod: "2014–2022",
      outcomeFamily: "Investment",
    });
  }
  const base = confirmedWorkflowFindContext("Financial services", {
    eventDescriptor: "regulation",
    studyPeriod: "2010–2020",
    outcomeFamily: "Risk",
  });
  const sentence =
    "Find a regulation affecting regulated financial-services firms in the United Kingdom from 2010 to 2020 that may influence risk.";
  return {
    ...base,
    studySentence: sentence,
    contractSourceSentence: sentence,
    scopeContract: {
      ...base.scopeContract,
      population: "Regulated firms",
      geography: "United Kingdom",
      industry: "Financial services",
      studyPeriod: "2010–2020",
      outcomeFamily: "Risk",
    },
  } satisfies Screen01StudyContext;
}

function unavailablePublicConnector() {
  return vi.fn<typeof globalThis.fetch>(async () =>
    new Response(JSON.stringify({ count: 0, results: [] }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  );
}

describe("ordinary server discovery from the public-event index", () => {
  it.each([
    ["gaming", "Video gaming"],
    ["energy", "Energy"],
    ["uk-finance", "Financial services"],
  ] as const)(
    "returns ten source-backed %s candidates with live connectors empty",
    async (target, industry) => {
      const initial = createScreen02FindState(
        targetContext(target),
        `indexed-${target}-run`,
        openedAt,
      );
      const state = beginScreen02FindDiscovery(initial, {
        discoveryRequestId: `indexed-${target}-request`,
        searchRoundId: `indexed-${target}-round`,
        candidateSetSnapshotId: `indexed-${target}-set`,
        exactRequest: `Find ten source-backed ${industry} regulation candidates.`,
        at: startedAt,
      });
      const fetch = unavailablePublicConnector();
      const discovery = await discoverCanonicalScreen02Find(
        {
          CONNECTOR_FETCH: fetch,
          SCREEN02_SEARCH_EXPANSION_MODE: "off",
        } as unknown as ShockAuditEnv,
        state,
        {
          searchRoundId: `indexed-${target}-round`,
          at: retrievedAt,
          exactRequest: `Find ten source-backed ${industry} regulation candidates.`,
          maximumCandidates: 10,
          queryPlanning: {
            origin: "fixed-fallback",
            reason: "Use the bounded provider-neutral source plan.",
          },
        },
      );

      expect(discovery.candidates).toHaveLength(10);
      expect(new Set(discovery.candidates.map((candidate) => candidate.candidateId)).size)
        .toBe(10);
      expect(discovery.candidates.every((candidate) =>
        candidate.origin === "registry-reviewed" &&
        candidate.qualification?.eligible === true &&
        candidate.qualification.candidateAdmission?.displayEvidence.supported ===
          true &&
        candidate.qualification.candidateAdmission.relevance.recommended === true &&
        candidate.dateLeads.length > 0 &&
        candidate.sourceIds.length > 0
      )).toBe(true);
      expect(discovery.manifest.funnel).toMatchObject({
        qualifiedCandidates: expect.any(Number),
        displayedCandidates: 10,
        hostContribution: 0,
      });
      expect(fetch).toHaveBeenCalled();
      expect(
        discovery.manifest.queryMatrix.some((entry) =>
          entry.id.endsWith(":public-event-index") &&
          entry.returnedRecordIds.length >= 10
        ),
      ).toBe(true);
      expect(
        discovery.manifest.channels.some((entry) =>
          entry.status === "searched" &&
          entry.channel.startsWith("Public event index ")
        ),
      ).toBe(true);
      expect(discovery.manifest.outcomeValuesInspected).toBe(false);

      const completed = completeScreen02FindDiscovery(state, {
        discoveryRequestId: `indexed-${target}-request`,
        at: completedAt,
        sources: discovery.sources,
        candidates: discovery.candidates,
        manifest: discovery.manifest,
      });
      const selectedCandidate = completed.candidates[0]!;
      expect(screen02FindCandidateSelectionGate(
        completed,
        selectedCandidate.candidateSnapshotId,
      )).toEqual({ eligible: true, reasons: [] });
      const selected = selectScreen02FindCandidate(
        completed,
        selectedCandidate.candidateSnapshotId,
        `indexed-${target}-selection`,
        "2026-09-11T05:00:04.000Z",
        "Investigate this source-backed shock.",
      );
      const continued = continueScreen02FindCandidate(
        selected,
        `indexed-${target}-continuation`,
        "2026-09-11T05:00:05.000Z",
        "Open Screen 3 for strict event verification.",
      );
      const handoff = buildScreen02WorkflowHandoff(
        continued,
        "0.6.2",
        "2026-09-11T05:00:06.000Z",
      );
      expect(handoff).toMatchObject({
        mode: "find",
        destinationScreen: "screen-03",
        outcomeValuesInspected: false,
        event: {
          preliminaryQualification: {
            eligible: true,
            candidateAdmission: {
              displayEvidence: { supported: true },
              relevance: { recommended: true },
            },
          },
        },
      });
      if (process.env.SHOCKAUDIT_PRINT_DISCOVERY_LEDGER === "1") {
        const sourcesById = new Map(discovery.sources.map((source) => [
          source.id,
          source,
        ]));
        console.log(`SHOCKAUDIT_DISCOVERY_LEDGER:${JSON.stringify({
          target,
          candidateCount: discovery.candidates.length,
          indexedContribution: discovery.manifest.queryMatrix.find((entry) =>
            entry.id.endsWith(":public-event-index")
          )?.returnedRecordIds.length ?? 0,
          liveConnectorCalls: fetch.mock.calls.length,
          selectedCandidate: selectedCandidate.identity.canonicalTitle,
          selectionEligible: true,
          screen3Opened: handoff.destinationScreen === "screen-03",
          outcomeValuesInspected: handoff.outcomeValuesInspected,
          candidates: discovery.candidates.map((candidate) => {
            const date = candidate.dateLeads[0]!;
            const source = sourcesById.get(candidate.sourceIds[0]!);
            return {
              title: candidate.identity.canonicalTitle,
              date: date.date,
              dateRole: date.stage,
              fit: candidate.qualification?.classification,
              sourceTitle: source?.title,
              sourceUrl: source?.locator,
              rationale:
                candidate.qualification?.candidateAdmission?.relevance.explanation,
              unresolved:
                candidate.qualification?.candidateAdmission
                  ?.screen3VerificationNeeds[0],
            };
          }),
        })}`);
      }
    },
  );
});
