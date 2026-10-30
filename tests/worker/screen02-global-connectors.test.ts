import { describe, expect, it } from "vitest";

import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
  type Screen02Proposal,
} from "../../src/core/screen02-types";
import { screen02SourceSupportsProposalIdentity } from
  "../../src/core/screen02-source-grounding";

import {
  EU_CELLAR_SPARQL_ENDPOINT,
  GDACS_EVENT_SEARCH_ENDPOINT,
  SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES,
  UK_LEGISLATION_ATOM_ENDPOINT,
  USGS_EARTHQUAKE_API_ENDPOINT,
  fetchEuCellarLegalProposals,
  fetchGdacsDisasterProposals,
  fetchUkLegislationProposals,
  fetchUsgsEarthquakeProposals,
} from "../../src/worker/screen02-global-connectors";
import {
  SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH,
  type Screen02ConnectorFetch,
} from "../../src/worker/screen02-connectors";

const retrievedAt = "2026-07-30T12:00:00.000Z";
const shared = {
  retrievedAt,
  startDate: "2020-01-01",
  endDate: "2024-12-31",
  population: "Publicly listed firms",
  outcomeFamily: "Firm performance",
  limit: 3,
  timeoutMs: 500,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chunkedResponseOverLimit(maximumBytes: number) {
  const responseBytes = maximumBytes + 1;
  const chunkBytes = 64 * 1_024;
  let emittedBytes = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const remainingBytes = responseBytes - emittedBytes;
      if (remainingBytes <= 0) return;
      const nextChunkBytes = Math.min(chunkBytes, remainingBytes);
      controller.enqueue(new Uint8Array(nextChunkBytes).fill(0x78));
      emittedBytes += nextChunkBytes;
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body, {
    headers: { "content-type": "application/json" },
  });
  return {
    response,
    wasCancelled: () => cancelled,
  };
}

function requireFindProposal(
  proposal: Screen02Proposal | undefined,
): Screen02FindProposal {
  expect(proposal?.mode).toBe("find");
  if (!proposal || proposal.mode !== "find") {
    throw new Error("Expected a Find proposal.");
  }
  return proposal;
}

describe("Screen 2 first global connector pack", () => {
  it("normalizes live CELLAR prefixes and rejects non-CELEX document identifiers", async () => {
    let query = "";
    const result = await fetchEuCellarLegalProposals({ ...shared,
      query: "General Data Protection Regulation", titleMatch: "all_terms", limit: 4,
      fetch: async (input) => { query = new URL(String(input)).searchParams.get("query")!;
        return jsonResponse({ results: { bindings: ["celex:32022R1234", "32022R1234", "consolidation:2022R1234/20230101", "genpub:2022.1234"].map((celex) => ({
          celex: { value: celex }, title: { value: "General Data Protection Regulation" },
          date: { value: "2022-01-01" }, type: { value: "REG" },
        })) } }); },
    });
    expect(query).toContain(" && ");
    expect(result.proposals).toHaveLength(1);
    expect(requireFindProposal(result.proposals[0]).sources[0]!.locator).toContain("CELEX%3A32022R1234");
    expect(result.diagnostics.invalidRecordsDropped).toBe(2);
    expect(result.diagnostics.duplicateRecordsConsolidated).toBe(1);
  });
  it("looks up a selected directive identifier exactly and rejects a mismatching response record", async () => {
    let requestedUrl = "";
    const result = await fetchEuCellarLegalProposals({
      ...shared,
      query: "Directive (EU) 2022/2555",
      celexId: "32022L2555",
      fetch: async (input) => {
        requestedUrl = String(input);
        return jsonResponse({ results: { bindings: ["32022L2555", "32022L2556"].map((celex) => ({
          celex: { type: "literal", value: celex },
          title: { type: "literal", value: "Directive concerning network and information systems" },
          date: { type: "literal", value: "2022-12-14" },
          type: { type: "uri", value: "http://publications.europa.eu/resource/authority/resource-type/DIR" },
        })) } });
      },
    });
    const query = new URL(requestedUrl).searchParams.get("query");
    expect(query).toContain('FILTER(STR(?celex) = "32022L2555" || LCASE(STR(?celex)) = "celex:32022l2555")');
    expect(query).not.toContain("CONTAINS");
    expect(result.proposals).toHaveLength(1);
    expect(requireFindProposal(result.proposals[0]).nativeIdentity?.formalIdentifier).toBe("32022L2555");
    expect(result.diagnostics.invalidRecordsDropped).toBe(1);
  });

  it("rejects an invalid exact identifier before issuing a request", async () => {
    let requests = 0;
    await expect(fetchEuCellarLegalProposals({
      ...shared,
      query: "selected instrument",
      celexId: '32022L2555" || true',
      fetch: async () => { requests += 1; return jsonResponse({ results: { bindings: [] } }); },
    })).rejects.toThrow(/celexId must identify an exact EU/u);
    expect(requests).toBe(0);
  });

  it("queries EU CELLAR with an encoded SPARQL literal and returns official EU metadata", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const fetchImpl: Screen02ConnectorFetch = async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return jsonResponse({
        results: {
          bindings: [
            {
              work: {
                value:
                  "http://publications.europa.eu/resource/cellar/example",
              },
              celex: { value: "32023R0956" },
              title: {
                value: "Carbon Border Adjustment Mechanism",
              },
              date: { value: "2023-05-16" },
              type: {
                value:
                  "http://publications.europa.eu/resource/authority/resource-type/REG",
              },
            },
          ],
        },
      });
    };
    const query = 'energy "transition" } UNION { ?x ?y ?z';
    const result = await fetchEuCellarLegalProposals({
      ...shared,
      fetch: fetchImpl,
      query,
      queryId: "native-01:eu-cellar",
      queryPurpose: "Profile-driven EU legal recall.",
      language: "fr",
    });

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(
      EU_CELLAR_SPARQL_ENDPOINT,
    );
    expect(url.searchParams.get("format")).toBe(
      "application/sparql-results+json",
    );
    const sparql = url.searchParams.get("query") ?? "";
    expect(sparql).toContain(
      "resource/authority/language/FRA",
    );
    expect(sparql).toContain('LCASE("energy")');
    expect(sparql).toContain('LCASE("transition")');
    expect(sparql).toContain(" || ");
    expect(sparql).not.toContain("} UNION {");
    expect(sparql).toContain("LIMIT 3");
    expect(requestedInit).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      id: "eu-law-32023r0956",
      mode: "find",
      kind: "event",
      nativeIdentity: {
        formalIdentifier: "32023R0956",
        issuer: null,
        issuingJurisdiction: "European Union",
        status: "REG",
      },
      event: {
        eventDate: "2023-05-16",
        eventFamily: "Regulation",
        geographies: ["European Union"],
      },
      sources: [
        {
          authorityTier: 2,
          publisher:
            "Publications Office of the European Union",
          publishedDate: "2023-05-16",
          channel: "EU Publications Office CELLAR SPARQL",
        },
      ],
    });
    expect(
      result.proposals[0]?.sources[0]?.locator,
    ).toContain("eur-lex.europa.eu/legal-content/FR/TXT/");
    expect(result.proposals[0]?.limitations.join(" ")).toMatch(
      /national transposition.*implementation/i,
    );
    expect(requireFindProposal(result.proposals[0]).event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(result.proposals[0])).not.toContain(
      shared.population,
    );
    expect(result.diagnostics).toMatchObject({
      connector: "eu-cellar-sparql-v1",
      recordsReceived: 1,
      recordsAccepted: 1,
      proposalsReturned: 1,
      outcomeValuesInspected: false,
    });
    expect(result.diagnostics.queryMatrix[0]).toMatchObject({
      id: "native-01:eu-cellar",
      purpose: "Profile-driven EU legal recall.",
    });
    expect(result.proposalBindings).toEqual([{
      proposalId: result.proposals[0]?.id,
      queryId: "native-01:eu-cellar",
      returnedRecordIds: ["32023R0956"],
      sourceIds: result.proposals[0]?.sources.map((source) => source.id),
    }]);
  });

  it("maps an official CELLAR DIR record to Directive rather than Regulation", async () => {
    const result = await fetchEuCellarLegalProposals({
      ...shared,
      fetch: async () => jsonResponse({
        results: {
          bindings: [{
            work: {
              value: "http://publications.europa.eu/resource/cellar/nis2",
            },
            celex: { value: "32022L2555" },
            title: { value: "Directive (EU) 2022/2555" },
            date: { value: "2022-12-27" },
            type: {
              value:
                "http://publications.europa.eu/resource/authority/resource-type/DIR",
            },
          }],
        },
      }),
      query: "network information security directive",
    });

    expect(result.proposals).toHaveLength(1);
    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal).toMatchObject({
      nativeIdentity: { status: "DIR" },
      event: { eventFamily: "Directive" },
    });
    expect(proposal.event.eventFamily).not.toBe("Regulation");
  });

  it("parses bounded UK Atom results without resolving entities and enforces the exact date range", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const fetchImpl: Screen02ConnectorFetch = async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      // Captured legislation.gov.uk behavior: anonymous requests receive a
      // 404 HTML response, while an identified fair-use client receives Atom.
      if (!new Headers(init?.headers).get("user-agent")) {
        return new Response("<html><title>Not Found</title></html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response(
        `<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
          <entry>
            <id>http://www.legislation.gov.uk/id/ukpga/2023/12</id>
            <title>Energy &amp; Markets Act 2023</title>
            <ukm:CreationDate Date="2023-07-20"/>
            <published>2025-02-01T00:00:00Z</published>
            <link rel="alternate" href="http://www.legislation.gov.uk/ukpga/2023/12"/>
          </entry>
          <entry>
            <id>http://www.legislation.gov.uk/id/catalog-copy/energy-markets-2023</id>
            <title>Energy &amp; Markets Act 2023</title>
            <ukm:CreationDate Date="2023-07-20"/>
            <link rel="alternate" href="http://www.legislation.gov.uk/ukpga/2023/12"/>
          </entry>
          <entry>
            <id>http://www.legislation.gov.uk/id/ukpga/2019/1</id>
            <title>Outside window</title>
            <ukm:EnactmentDate Date="2019-01-01"/>
          </entry>
        </feed>`,
        {
          headers: {
            "content-type": "application/atom+xml; charset=utf-8",
          },
        },
      );
    };
    const result = await fetchUkLegislationProposals({
      ...shared,
      fetch: fetchImpl,
      query: "energy & markets",
      queryId: "native-02:uk-legislation",
      queryPurpose: "Profile-driven UK legal recall.",
    });

    const url = new URL(requestedUrl);
    expect(url.origin).toBe(
      new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin,
    );
    expect(url.pathname).toBe("/all/2020-2024/data.feed");
    expect(url.searchParams.get("title")).toBe(
      "energy & markets",
    );
    expect(new Headers(requestedInit?.headers).get("user-agent")).toMatch(
      /^ShockAudit research-design tool \(\+https:\/\//u,
    );
    expect(requestedInit).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      title: "Energy & Markets Act 2023",
      nativeIdentity: {
        formalIdentifier: "ukpga/2023/12",
        issuer: null,
        issuingJurisdiction: "United Kingdom",
        status: "Published legislation catalog record",
      },
      event: {
        eventDate: "2023-07-20",
        geographies: ["United Kingdom"],
      },
      sources: [
        {
          locator:
            "https://www.legislation.gov.uk/ukpga/2023/12",
          authorityTier: 2,
        },
      ],
    });
    expect(result.diagnostics).toMatchObject({
      connector: "uk-legislation-atom-v1",
      recordsReceived: 3,
      recordsAccepted: 2,
      invalidRecordsDropped: 1,
      duplicateRecordsConsolidated: 1,
      outcomeValuesInspected: false,
    });
    expect(result.diagnostics.queryMatrix[0]).toMatchObject({
      id: "native-02:uk-legislation",
      purpose: "Profile-driven UK legal recall.",
    });
    expect(result.proposalBindings).toEqual([{
      proposalId: result.proposals[0]?.id,
      queryId: "native-02:uk-legislation",
      returnedRecordIds: [
        "http://www.legislation.gov.uk/id/ukpga/2023/12",
        "http://www.legislation.gov.uk/id/catalog-copy/energy-markets-2023",
      ],
      sourceIds: result.proposals[0]?.sources.map((source) => source.id),
    }]);
    expect(requireFindProposal(result.proposals[0]).event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(result.proposals[0])).not.toContain(
      shared.population,
    );
  });

  it("queries GDACS with bounded filters and does not represent monitoring as a declaration", async () => {
    let requestedUrl = "";
    const fetchImpl: Screen02ConnectorFetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [99.841, 19.912, 7.25],
            },
            properties: {
              eventtype: "TC",
              eventid: 1001,
              episodeid: 2,
              name: "Tropical Cyclone Example",
              fromdate: "2024-08-10T00:00:00Z",
              alertlevel: "orange",
              affectedcountries: [
                { countryname: "Thailand", iso3: "THA" },
              ],
              url: {
                details:
                  "https://www.gdacs.org/report.aspx?eventid=1001&eventtype=TC",
              },
            },
          },
        ],
      });
    };
    const result = await fetchGdacsDisasterProposals({
      ...shared,
      fetch: fetchImpl,
      startDate: "2024-01-01",
      eventTypes: ["TC", "FL"],
      alertLevels: ["red", "orange"],
      countryName: "Thailand",
    });

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(
      GDACS_EVENT_SEARCH_ENDPOINT,
    );
    expect(url.searchParams.get("eventlist")).toBe("TC;FL");
    expect(url.searchParams.get("alertlevel")).toBe(
      "red;orange",
    );
    expect(url.searchParams.get("country")).toBe("Thailand");
    expect(url.searchParams.get("pagesize")).toBe("3");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      id: "gdacs-tc-1001-2",
      nativeIdentity: {
        formalIdentifier: "GDACS-TC-1001-2",
        issuer: null,
        issuingJurisdiction: null,
        status: "orange alert",
      },
      event: {
        eventDate: "2024-08-10",
        eventFamily: "Tropical cyclone disaster",
        geographies: ["Thailand"],
      },
      sources: [
        {
          authorityTier: 3,
          publisher:
            "Global Disaster Alert and Coordination System (GDACS)",
        },
      ],
    });
    expect(result.proposals[0]?.limitations.join(" ")).toMatch(
      /not a national declaration/i,
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).toMatch(
      /Structured source-native fields \(not a verbatim passage\).*Event point coordinates: longitude 99\.841, latitude 19\.912/i,
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).not.toMatch(
      /depth|hazard-footprint coordinates/i,
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).not.toMatch(
      /organization-to/i,
    );
    expect(requireFindProposal(result.proposals[0]).requiredVariables).toEqual(
      expect.arrayContaining([
        "Event point coordinates",
        "Hazard footprint or intensity",
        "Organization-to-event-footprint location linkage",
      ]),
    );
    expect(screen02SourceSupportsProposalIdentity(
      requireFindProposal(result.proposals[0]),
      requireFindProposal(result.proposals[0]).sources[0]!,
    )).toBe(true);
    expect(requireFindProposal(result.proposals[0]).event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(result.proposals[0])).not.toContain(
      shared.population,
    );
    expect(result.diagnostics.outcomeValuesInspected).toBe(false);
    expect(result.proposalBindings).toEqual([{
      proposalId: result.proposals[0]?.id,
      queryId: "gdacs-global-events",
      returnedRecordIds: ["1001"],
      sourceIds: result.proposals[0]?.sources.map((source) => source.id),
    }]);
  });

  it("deduplicates repeated GDACS event IDs across distinct returned episodes", async () => {
    const result = await fetchGdacsDisasterProposals({
      ...shared,
      fetch: async () => jsonResponse({
        type: "FeatureCollection",
        features: [1, 2].map((episodeid) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [99.841, 19.912],
          },
          properties: {
            eventtype: "TC",
            eventid: 1001,
            episodeid,
            name: `Tropical Cyclone Example episode ${episodeid}`,
            fromdate: `2024-08-${String(9 + episodeid).padStart(2, "0")}T00:00:00Z`,
            alertlevel: "orange",
            affectedcountries: [
              { countryname: "Thailand", iso3: "THA" },
            ],
          },
        })),
      }),
      eventTypes: ["TC"],
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.diagnostics.queryMatrix[0]?.returnedRecordIds).toEqual([
      "1001",
    ]);
    expect(result.proposalBindings.map((binding) =>
      binding.returnedRecordIds
    )).toEqual([["1001"], ["1001"]]);
  });

  it("translates the current route ISO codes to GDACS country names", async () => {
    for (const [countryIso3, expectedCountry] of [
      ["USA", "United States"],
      ["GBR", "United Kingdom"],
    ] as const) {
      let requestedUrl = "";
      await fetchGdacsDisasterProposals({
        ...shared,
        countryIso3,
        fetch: async (input) => {
          requestedUrl = String(input);
          return jsonResponse({ type: "FeatureCollection", features: [] });
        },
      });
      expect(new URL(requestedUrl).searchParams.get("country")).toBe(
        expectedCountry,
      );
    }
  });

  it("bounds exact CELLAR and UK request URLs after multilingual percent-encoding", async () => {
    const query = "中".repeat(240);
    let cellarUrl = "";
    const cellar = await fetchEuCellarLegalProposals({
      ...shared,
      query,
      fetch: async (input) => {
        cellarUrl = String(input);
        return jsonResponse({ results: { bindings: [] } });
      },
    });
    let ukUrl = "";
    const uk = await fetchUkLegislationProposals({
      ...shared,
      query,
      fetch: async (input) => {
        ukUrl = String(input);
        return new Response("<feed></feed>", {
          headers: { "content-type": "application/atom+xml" },
        });
      },
    });

    for (const [requestUrl, result] of [
      [cellarUrl, cellar],
      [ukUrl, uk],
    ] as const) {
      expect(requestUrl.length).toBeLessThanOrEqual(
        SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH,
      );
      expect(result.diagnostics.queryMatrix[0]?.query).toBe(
        requestUrl,
      );
      expect(result.diagnostics.queryMatrix[0]?.purpose).toMatch(
        /deterministically shortened/i,
      );
    }
  });

  it("queries USGS with validated geographic bounds and labels scientific metadata as reconnaissance", async () => {
    let requestedUrl = "";
    const fetchImpl: Screen02ConnectorFetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "us7000example",
            geometry: {
              type: "Point",
              coordinates: [99.72, 19.88, 12.4],
            },
            properties: {
              title: "M 6.2 - Northern Thailand",
              place: "Northern Thailand",
              time: Date.UTC(2024, 10, 4, 10, 30),
              mag: 6.2,
              url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000example",
            },
          },
        ],
      });
    };
    const result = await fetchUsgsEarthquakeProposals({
      ...shared,
      fetch: fetchImpl,
      startDate: "2024-01-01",
      minMagnitude: 5,
      geographyLabel: "Researcher-entered Thailand scope",
      boundingBox: {
        minLatitude: 5,
        maxLatitude: 21,
        minLongitude: 97,
        maxLongitude: 106,
      },
    });

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(
      USGS_EARTHQUAKE_API_ENDPOINT,
    );
    expect(url.searchParams.get("format")).toBe("geojson");
    expect(url.searchParams.get("minmagnitude")).toBe("5");
    expect(url.searchParams.get("minlatitude")).toBe("5");
    expect(url.searchParams.get("maxlongitude")).toBe("106");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      id: "usgs-earthquake-us7000example",
      nativeIdentity: {
        formalIdentifier: "us7000example",
        issuer: null,
        issuingJurisdiction: null,
        status: "Scientific earthquake event record",
      },
      event: {
        eventDate: "2024-11-04",
        eventFamily: "Earthquake disaster",
        geographies: ["Northern Thailand"],
      },
      sources: [
        {
          authorityTier: 3,
          publisher: "U.S. Geological Survey (USGS)",
        },
      ],
    });
    expect(result.proposals[0]?.limitations.join(" ")).toMatch(
      /not national or local disaster declarations/i,
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).toMatch(
      /Structured source-native fields \(not a verbatim passage\).*Earthquake point coordinates: longitude 99\.72, latitude 19\.88, depth 12\.4 km/i,
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).not.toMatch(
      /organization-to/i,
    );
    expect(requireFindProposal(result.proposals[0]).requiredVariables).toEqual(
      expect.arrayContaining([
        "Earthquake point coordinates",
        "Organization-to-hazard-footprint location linkage",
      ]),
    );
    expect(result.proposals[0]?.sources[0]?.evidenceText).toContain(
      "USGS event date: 2024-11-04",
    );
    expect(screen02SourceSupportsProposalIdentity(
      requireFindProposal(result.proposals[0]),
      requireFindProposal(result.proposals[0]).sources[0]!,
    )).toBe(true);
    expect(requireFindProposal(result.proposals[0]).event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(result.proposals[0])).not.toContain(
      shared.population,
    );
    expect(JSON.stringify(result.proposals[0])).not.toContain(
      "Researcher-entered Thailand scope",
    );
    expect(result.diagnostics.outcomeValuesInspected).toBe(false);
    expect(result.proposalBindings).toEqual([{
      proposalId: result.proposals[0]?.id,
      queryId: "usgs-fdsn-earthquakes",
      returnedRecordIds: ["us7000example"],
      sourceIds: result.proposals[0]?.sources.map((source) => source.id),
    }]);
  });

  it.each([
    {
      name: "EU CELLAR",
      run: (fetch: Screen02ConnectorFetch) =>
        fetchEuCellarLegalProposals({
          ...shared,
          fetch,
          query: "energy",
        }),
    },
    {
      name: "UK legislation",
      run: (fetch: Screen02ConnectorFetch) =>
        fetchUkLegislationProposals({
          ...shared,
          fetch,
          query: "energy",
        }),
    },
    {
      name: "GDACS",
      run: (fetch: Screen02ConnectorFetch) =>
        fetchGdacsDisasterProposals({
          ...shared,
          fetch,
          eventTypes: ["FL"],
        }),
    },
    {
      name: "USGS",
      run: (fetch: Screen02ConnectorFetch) =>
        fetchUsgsEarthquakeProposals({
          ...shared,
          fetch,
        }),
    },
  ])(
    "fails $name closed on redirects without following the destination",
    async ({ run }) => {
      let requestedInit: RequestInit | undefined;
      const result = await run(async (_input, init) => {
        requestedInit = init;
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://unreviewed.example/target",
          },
        });
      });

      expect(requestedInit?.redirect).toBe("manual");
      expect(result.proposals).toEqual([]);
      expect(result.proposalBindings).toEqual([]);
      expect(result.diagnostics.channels[0]).toMatchObject({
        status: "failed",
      });
      expect(result.diagnostics.channels[0]?.note).toMatch(
        /HTTP 302/,
      );
      expect(result.diagnostics.channels[0]?.note).not.toContain(
        "unreviewed.example",
      );
      expect(result.diagnostics.failureKind).toBe("http");
    },
  );

  it("rejects oversized responses and invalid connector bounds before parsing or retrieval", async () => {
    const oversized = await fetchGdacsDisasterProposals({
      ...shared,
      fetch: async () =>
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": String(
              SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES + 1,
            ),
          },
        }),
    });
    expect(oversized.proposals).toEqual([]);
    expect(oversized.diagnostics.channels[0]?.note).toMatch(
      /byte limit/i,
    );
    expect(oversized.diagnostics.failureKind).toBe("response-limit");

    let called = false;
    await expect(
      fetchUsgsEarthquakeProposals({
        ...shared,
        fetch: async () => {
          called = true;
          return jsonResponse({});
        },
        boundingBox: {
          minLatitude: 30,
          maxLatitude: 20,
          minLongitude: 90,
          maxLongitude: 100,
        },
      }),
    ).rejects.toThrow(/ordered finite latitude/);
    expect(called).toBe(false);
  });

  it("cancels a chunked response without Content-Length before buffering beyond the global byte bound", async () => {
    const streamed = chunkedResponseOverLimit(
      SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES,
    );
    expect(streamed.response.headers.has("content-length")).toBe(
      false,
    );

    const result = await fetchGdacsDisasterProposals({
      ...shared,
      fetch: async () => streamed.response,
    });

    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
      note: expect.stringMatching(/byte limit/i),
    });
    expect(streamed.wasCancelled()).toBe(true);
  });

  it("ignores caller-supplied endpoint fields and always uses exact allowlisted hosts", async () => {
    let requestedUrl = "";
    const fetch: Screen02ConnectorFetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ results: { bindings: [] } });
    };
    const input = {
      ...shared,
      fetch,
      query: "energy",
      endpoint: "https://untrusted.example/collect",
    };
    await fetchEuCellarLegalProposals(input);

    expect(requestedUrl).not.toContain("untrusted.example");
    expect(new URL(requestedUrl).hostname).toBe(
      "publications.europa.eu",
    );
  });
});
