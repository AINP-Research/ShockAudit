import { describe, expect, it } from "vitest";

import {
  completeScreen02FindDiscovery,
  beginScreen02FindDiscovery,
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
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
} from "../../src/core/screen02-relevance-profile";
import {
  discoverCanonicalScreen02Find,
  type ShockAuditEnv,
} from "../../src/worker/server";
import {
  FEDERAL_REGISTER_API_ENDPOINT,
  type Screen02ConnectorFetch,
} from "../../src/worker/screen02-connectors";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";

const openedAt = "2026-09-07T12:00:00.000Z";
const searchStartedAt = "2026-09-07T12:00:01.000Z";
const retrievedAt = "2026-09-07T12:00:02.000Z";
const completedAt = "2026-09-07T12:00:03.000Z";
const selectedAt = "2026-09-07T12:00:04.000Z";
const continuedAt = "2026-09-07T12:00:05.000Z";
const handoffAt = "2026-09-07T12:00:06.000Z";

const order841ProposalDocumentNumber = "2016-28194";
const order841DocumentNumber = "2018-03708";
const order841RehearingDocumentNumber = "2019-10742";
const order841Title =
  "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
const order841ProposalBodyHtml =
  "https://www.federalregister.gov/documents/full_text/html/2016/11/30/2016-28194.html";
const order841ProposalRawText =
  "https://www.federalregister.gov/documents/full_text/text/2016/11/30/2016-28194.txt";
const order841ProposalLandingPage =
  "https://www.federalregister.gov/documents/2016/11/30/2016-28194/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
const order841BodyHtml =
  "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
const order841RawText =
  "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt";
const order841LandingPage =
  "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
const order841RehearingBodyHtml =
  "https://www.federalregister.gov/documents/full_text/html/2019/05/23/2019-10742.html";
const order841RehearingRawText =
  "https://www.federalregister.gov/documents/full_text/text/2019/05/23/2019-10742.txt";
const order841RehearingLandingPage =
  "https://www.federalregister.gov/documents/2019/05/23/2019-10742/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";

// Frozen official-record replay: the metadata fields and operative facts model
// Federal Register document 2018-03708. The fixture deliberately contains no
// firm outcome observations or claimed treatment effects.
const order841Metadata = {
  count: 3,
  // Preserve the observed relevance order: the 2016 proposal precedes the
  // final Order 841 rule, followed by the later rehearing rule. Formal
  // identifiers, rather than the repeated title, keep the lifecycle records
  // distinct through the common deduplication and qualification pipeline.
  results: [
    {
      document_number: order841ProposalDocumentNumber,
      title: order841Title,
      type: "Proposed Rule",
      action: "Notice of proposed rulemaking.",
      abstract:
        "The Federal Energy Regulatory Commission is proposing to amend its regulations under the Federal Power Act to remove barriers to electric storage resources and distributed energy resource aggregations in capacity, energy, and ancillary service markets operated by regional transmission organizations and independent system operators.",
      html_url: order841ProposalLandingPage,
      pdf_url:
        "https://www.govinfo.gov/content/pkg/FR-2016-11-30/pdf/2016-28194.pdf",
      body_html_url: order841ProposalBodyHtml,
      raw_text_url: order841ProposalRawText,
      publication_date: "2016-11-30",
      effective_on: null,
      agencies: [{ name: "Federal Energy Regulatory Commission" }],
    },
    {
      document_number: order841DocumentNumber,
      title: order841Title,
      type: "Rule",
      action: "Final rule.",
      abstract:
        "The Federal Energy Regulatory Commission is amending its regulations to remove barriers to electric storage participation in capacity, energy, and ancillary service markets operated by regional transmission organizations and independent system operators.",
      html_url: order841LandingPage,
      pdf_url:
        "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
      body_html_url: order841BodyHtml,
      raw_text_url: order841RawText,
      publication_date: "2018-03-06",
      effective_on: "2018-06-04",
      agencies: [{ name: "Federal Energy Regulatory Commission" }],
    },
    {
      document_number: order841RehearingDocumentNumber,
      title: order841Title,
      type: "Rule",
      action: "Order on rehearing and clarification.",
      abstract:
        "The Federal Energy Regulatory Commission addresses petitions for rehearing and clarification and generally affirms Order No. 841, which amended its regulations to remove barriers to electric storage participation in capacity, energy, and ancillary service markets operated by regional transmission organizations and independent system operators.",
      html_url: order841RehearingLandingPage,
      pdf_url:
        "https://www.govinfo.gov/content/pkg/FR-2019-05-23/pdf/2019-10742.pdf",
      body_html_url: order841RehearingBodyHtml,
      raw_text_url: order841RehearingRawText,
      publication_date: "2019-05-23",
      effective_on: "2019-08-21",
      agencies: [{ name: "Federal Energy Regulatory Commission" }],
    },
  ],
};

const order841ProposalFullText = `<!doctype html>
<html lang="en">
  <head><title>${order841Title}</title></head>
  <body>
    <main>
      <h1>AGENCY:</h1><p>Federal Energy Regulatory Commission.</p>
      <h1>ACTION:</h1><p>Notice of proposed rulemaking.</p>
      <h1>SUMMARY:</h1><p>The Commission proposes to require each regional transmission organization and independent system operator to establish a participation model for electric storage resources.</p>
      <h1>DATES:</h1><p>Comments are due February 13, 2017. If adopted, the proposed rule would take effect in 2017.</p>
      <p>[FR Doc. ${order841ProposalDocumentNumber} Filed 11-29-16; 8:45 am]</p>
    </main>
  </body>
</html>`;

const order841FullText = `<!doctype html>
<html lang="en">
  <head><title>${order841Title}</title></head>
  <body>
    <main>
      <h1>AGENCY:</h1><p>Federal Energy Regulatory Commission.</p>
      <h1>ACTION:</h1><p>Final rule.</p>
      <h1>SUMMARY:</h1><p>This final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources.</p>
      <p>The participation model permits electric storage resources to participate in capacity, energy, and ancillary service markets while recognizing their physical and operational characteristics.</p>
      <h1>DATES:</h1><p>This final rule is effective June 4, 2018.</p>
      <p>[FR Doc. ${order841DocumentNumber} Filed 3-5-18; 8:45 am]</p>
    </main>
  </body>
</html>`;

const order841RehearingFullText = `<!doctype html>
<html lang="en">
  <head><title>${order841Title}</title></head>
  <body>
    <main>
      <h1>AGENCY:</h1><p>Federal Energy Regulatory Commission.</p>
      <h1>ACTION:</h1><p>Order on rehearing and clarification.</p>
      <h1>SUMMARY:</h1><p>This rule generally affirms Order No. 841, which requires each regional transmission organization and independent system operator to establish a participation model for electric storage resources.</p>
      <h1>DATES:</h1><p>This rule is effective August 21, 2019.</p>
      <p>[FR Doc. ${order841RehearingDocumentNumber} Filed 5-22-19; 8:45 am]</p>
    </main>
  </body>
</html>`;

const federalRegisterDocumentBodies = new Map<string, string>([
  [order841ProposalBodyHtml, order841ProposalFullText],
  [order841ProposalRawText, order841ProposalFullText],
  [order841ProposalLandingPage, order841ProposalFullText],
  [order841BodyHtml, order841FullText],
  [order841RawText, order841FullText],
  [order841LandingPage, order841FullText],
  [order841RehearingBodyHtml, order841RehearingFullText],
  [order841RehearingRawText, order841RehearingFullText],
  [order841RehearingLandingPage, order841RehearingFullText],
]);

function frozenOrder841Fetch() {
  const federalRegisterSearches: URL[] = [];
  const federalRegisterDocuments: URL[] = [];
  const ftcSearches: URL[] = [];
  const unavailableCrossBorderRegistryDocuments: URL[] = [];
  const unexpectedRequests: string[] = [];

  const fetch: Screen02ConnectorFetch = async (input) => {
    const url = new URL(String(input));
    if (url.toString().startsWith(FEDERAL_REGISTER_API_ENDPOINT)) {
      federalRegisterSearches.push(url);
      return new Response(JSON.stringify(order841Metadata), {
        headers: { "content-type": "application/json" },
      });
    }
    const federalRegisterBody = federalRegisterDocumentBodies.get(
      url.toString(),
    );
    if (federalRegisterBody) {
      federalRegisterDocuments.push(url);
      return new Response(federalRegisterBody, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.toString().startsWith(FTC_PRESS_RELEASES_ENDPOINT)) {
      ftcSearches.push(url);
      return new Response(
        "<!doctype html><html><body><main><div class=\"view-empty\"><p>No results found for these filters.</p></div></main></body></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    if (
      ["eur-lex.europa.eu", "climate.ec.europa.eu"].includes(url.hostname)
    ) {
      // The common open-world pipeline also checks its reviewed EU ETS lead
      // for an energy scope. Keep that independent cross-border lane bounded
      // and explicitly unavailable in this U.S.-source acceptance replay.
      unavailableCrossBorderRegistryDocuments.push(url);
      return new Response("Unavailable in the focused acceptance fixture.", {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    unexpectedRequests.push(url.toString());
    throw new Error(`Acceptance fixture rejected unexpected request: ${url}`);
  };

  return {
    fetch,
    federalRegisterSearches,
    federalRegisterDocuments,
    ftcSearches,
    unavailableCrossBorderRegistryDocuments,
    unexpectedRequests,
  };
}

describe("Screen 2 U.S. energy regulation discovery acceptance", () => {
  it("qualifies and permits selection of an official Order 841-style candidate without observing outcomes", async () => {
    const context = confirmedWorkflowFindContext("Energy", {
      studyPeriod: "2014–2022",
      outcomeFamily: "Investment",
      eventDescriptor: "regulation",
    });
    const initial = createScreen02FindState(
      context,
      "energy-discovery-acceptance",
      openedAt,
    );
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "energy-discovery-request",
      searchRoundId: "energy-discovery-round",
      candidateSetSnapshotId: "energy-discovery-set",
      exactRequest:
        "Find source-backed U.S. energy regulations without inspecting outcomes.",
      at: searchStartedAt,
    });
    const replay = frozenOrder841Fetch();

    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: replay.fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
      } as unknown as ShockAuditEnv,
      searching,
      {
        searchRoundId: "energy-discovery-round",
        at: retrievedAt,
        exactRequest:
          "Find source-backed U.S. energy regulations without inspecting outcomes.",
        maximumCandidates: 10,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Exercise the deterministic canonical discovery pipeline.",
        },
      },
    );

    const candidate = discovery.candidates.find(
      (item) => item.identity.formalIdentifier === order841DocumentNumber,
    );
    const proposedCandidateId = `fr-${order841ProposalDocumentNumber}`;
    const proposedExclusion = discovery.manifest.exclusions.find(
      (item) => item.recordId === proposedCandidateId,
    );
    const rehearingCandidate = discovery.candidates.find(
      (item) =>
        item.identity.formalIdentifier === order841RehearingDocumentNumber,
    );
    expect(discovery.candidates).toHaveLength(10);
    expect(
      candidate,
      JSON.stringify(discovery.manifest.exclusions, null, 2),
    ).toBeDefined();
    expect(candidate?.identity).toMatchObject({
      canonicalTitle: order841Title,
      formalIdentifier: order841DocumentNumber,
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      eventType: "Regulation",
    });
    expect(candidate?.qualification).toMatchObject({
      eligible: true,
      hardScope: { passed: true, blockingKeys: [] },
      substantiveOverview: { passed: true },
      sourceQuality: { status: "high" },
    });
    expect(["direct", "adjacent"]).toContain(
      candidate?.qualification?.classification,
    );
    expect(candidate?.qualification?.evidenceSourceIds.length).toBeGreaterThan(
      0,
    );
    const groundedOrder841Passages = candidate?.qualification
      ?.substantiveOverview.sourceGrounding.coordinates
      .map((coordinate) => coordinate.text)
      .join(" ") ?? "";
    expect(groundedOrder841Passages).toMatch(
      /final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources/i,
    );
    expect(candidate?.sourceIds.length).toBeGreaterThan(0);
    expect(
      discovery.candidates.some(
        (item) =>
          item.identity.formalIdentifier === order841ProposalDocumentNumber,
      ),
    ).toBe(false);
    expect(proposedExclusion).toMatchObject({
      recordId: proposedCandidateId,
      qualification: {
        candidateId: proposedCandidateId,
        eligible: false,
        hardScope: {
          passed: false,
          disposition: "insufficient-evidence",
          insufficientEvidenceKeys: expect.arrayContaining(["studyPeriod"]),
        },
      },
    });
    expect(rehearingCandidate).toBeDefined();
    expect(rehearingCandidate?.candidateId).not.toBe(candidate?.candidateId);
    expect(
      candidate?.sourceIds.every(
        (sourceId) => !sourceId.includes(order841ProposalDocumentNumber),
      ),
    ).toBe(true);
    expect(
      discovery.sources
        .filter((source) => candidate?.sourceIds.includes(source.id))
        .some(
          (source) =>
            source.locator === order841BodyHtml &&
            source.evidenceText?.includes(
              "requires each regional transmission organization",
            ),
        ),
      JSON.stringify(
        discovery.sources.filter((source) =>
          candidate?.sourceIds.includes(source.id)
        ),
        null,
        2,
      ),
    ).toBe(true);

    expect(replay.federalRegisterSearches).toHaveLength(
      SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
    );
    expect(
      replay.federalRegisterSearches.every((url) =>
        url.searchParams.get("conditions[publication_date][gte]") ===
          "2014-01-01" &&
        url.searchParams.get("conditions[publication_date][lte]") ===
          "2022-12-31" &&
        ["RULE", "PRORULE", "NOTICE"].every((type) =>
          url.searchParams.getAll("conditions[type][]").includes(type)
        ) &&
        url.searchParams.getAll("fields[]").includes("body_html_url")
      ),
    ).toBe(true);
    expect(replay.federalRegisterDocuments.map(String)).toContain(
      order841BodyHtml,
    );
    expect(replay.federalRegisterDocuments.map(String)).toContain(
      order841ProposalBodyHtml,
    );
    expect(replay.federalRegisterDocuments.map(String)).toContain(
      order841RehearingBodyHtml,
    );
    expect(replay.ftcSearches).toHaveLength(1);
    expect(replay.ftcSearches[0]?.searchParams.get("search")).toBe("energy");
    expect(replay.ftcSearches[0]?.searchParams.has("items_per_page")).toBe(
      false,
    );
    expect(replay.unavailableCrossBorderRegistryDocuments).toHaveLength(2);
    expect(replay.unexpectedRequests).toEqual([]);

    expect(discovery.manifest).toMatchObject({
      exactRequest:
        "Find source-backed U.S. energy regulations without inspecting outcomes.",
      outcomeValuesInspected: false,
      funnel: {
        qualifiedCandidates: expect.any(Number),
        displayedCandidates: expect.any(Number),
      },
    });
    expect(discovery.manifest.funnel?.qualifiedCandidates).toBeGreaterThan(0);
    expect(discovery.manifest.funnel?.displayedCandidates).toBeGreaterThan(0);
    expect(
      discovery.manifest.queryMatrix.some(
        (entry) =>
          entry.returnedRecordIds.join("|") === [
            order841ProposalDocumentNumber,
            order841DocumentNumber,
            order841RehearingDocumentNumber,
          ].join("|") &&
          entry.query.startsWith(FEDERAL_REGISTER_API_ENDPOINT),
      ),
    ).toBe(true);
    expect(
      discovery.manifest.queryMatrix.some(
        (entry) =>
          entry.returnedRecordIds.includes(candidate!.candidateId) &&
          entry.id.includes("substantive-overview"),
      ),
    ).toBe(true);
    expect(
      discovery.manifest.channels.some(
        (entry) =>
          entry.status === "searched" &&
          entry.channel.includes("ftc-press-releases-html-v1"),
      ),
    ).toBe(true);
    expect(
      discovery.manifest.channels.some(
        (entry) =>
          entry.status === "searched" &&
          entry.channel.startsWith("Public event index "),
      ),
    ).toBe(true);

    const completed = completeScreen02FindDiscovery(searching, {
      discoveryRequestId: "energy-discovery-request",
      at: completedAt,
      sources: discovery.sources,
      candidates: discovery.candidates,
      manifest: discovery.manifest,
    });
    const persisted = completed.candidates.find(
      (item) => item.candidateId === candidate!.candidateId,
    );
    expect(persisted).toBeDefined();
    expect(
      screen02FindCandidateSelectionGate(
        completed,
        persisted!.candidateSnapshotId,
      ),
    ).toEqual({ eligible: true, reasons: [] });
    const selected = selectScreen02FindCandidate(
      completed,
      persisted!.candidateSnapshotId,
      "energy-discovery-selection",
      selectedAt,
      "Confirm that a fixed-qualified candidate is selection-capable.",
    );
    expect(selected.decision.tentativeSelectionSnapshotId).toBe(
      persisted!.candidateSnapshotId,
    );
    expect(selected.outcomeValuesInspected).toBe(false);

    const continued = continueScreen02FindCandidate(
      selected,
      "energy-discovery-continuation",
      continuedAt,
      "Carry the source-qualified selection to Screen 3 for verification.",
    );
    const handoff = buildScreen02WorkflowHandoff(
      continued,
      "0.6.2",
      handoffAt,
    );
    expect(handoff).toMatchObject({
      mode: "find",
      producerAppVersion: "0.6.2",
      outcomeValuesInspected: false,
      decision: {
        candidateSnapshotId: persisted!.candidateSnapshotId,
        selectionDecisionId: "energy-discovery-selection",
        continuationDecisionId: "energy-discovery-continuation",
      },
      event: {
        identity: {
          canonicalTitle: order841Title,
          formalIdentifier: order841DocumentNumber,
          issuer: "Federal Energy Regulatory Commission",
          issuingJurisdiction: "United States",
        },
        preliminaryQualification: {
          eligible: true,
          substantiveOverview: { passed: true },
        },
      },
    });
    expect(
      handoff.sources.some(
        (source) =>
          source.locator === order841BodyHtml &&
          source.evidenceText?.includes(
            "requires each regional transmission organization",
          ),
      ),
    ).toBe(true);
    expect(
      handoff.history.searchManifests.some(
        (manifest) =>
          manifest.outcomeValuesInspected === false &&
          manifest.queryMatrix.some((entry) =>
            entry.returnedRecordIds.includes(order841DocumentNumber)
          ),
      ),
    ).toBe(true);
  });
});
