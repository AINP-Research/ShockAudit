import { describe, expect, it } from "vitest";

import {
  SCREEN_02_SOURCE_CATALOG,
  SCREEN_02_SOURCE_CATALOG_VERSION,
  planScreen02SourceRoutes,
} from "../../src/worker/screen02-source-router";

function connectorIds(input: {
  routes: ArrayLike<{ connectorId: string }>;
}) {
  return Array.from(input.routes, (route) => route.connectorId);
}

describe("Screen 2 global source router", () => {
  it("publishes a versioned catalog with unique connector IDs, explicit hosts, languages, and limitations", () => {
    expect(SCREEN_02_SOURCE_CATALOG_VERSION).toBe(
      "screen-02-source-catalog-v2",
    );
    expect(
      new Set(
        SCREEN_02_SOURCE_CATALOG.map((entry) => entry.id),
      ).size,
    ).toBe(SCREEN_02_SOURCE_CATALOG.length);

    for (const entry of SCREEN_02_SOURCE_CATALOG) {
      expect(entry.requestHosts.length).toBeGreaterThan(0);
      expect(entry.languages.length).toBeGreaterThan(0);
      expect(entry.coverageStatement).not.toBe("");
      expect(entry.limitations.length).toBeGreaterThan(0);
      for (const host of entry.requestHosts) {
        expect(host).toMatch(/^[a-z0-9.-]+$/);
        expect(host).not.toContain("*");
      }
    }
  });

  it("routes legal scopes only to their matching jurisdiction source", () => {
    expect(
      connectorIds(
        planScreen02SourceRoutes({
          geography: "United States",
          eventFamily: "Regulation",
        }),
      ),
    ).toEqual([
      "federal-register-api-v1",
      "ftc-press-releases-html-v1",
    ]);
    expect(
      connectorIds(
        planScreen02SourceRoutes({
          geography: "European Union",
          eventFamily: "legislation",
        }),
      ),
    ).toEqual(["eu-cellar-sparql-v1"]);
    expect(
      connectorIds(
        planScreen02SourceRoutes({
          geography: "United Kingdom",
          eventFamily: "legal policy",
        }),
      ),
    ).toEqual(["uk-legislation-atom-v1"]);
  });

  it("states the Federal Register boundary without implying that all non-U.S. law is excluded", () => {
    const federalRegister = SCREEN_02_SOURCE_CATALOG.find(
      (entry) => entry.id === "federal-register-api-v1",
    );
    expect(federalRegister).toBeDefined();
    expect(federalRegister?.coverageStatement).toContain(
      "U.S. federal rules",
    );
    expect(federalRegister?.coverageStatement).toContain(
      "supported foreign and supranational legal scopes use separate jurisdiction-specific routes",
    );
    expect(federalRegister?.limitations).toContain(
      "This Federal Register connector does not search U.S. state, local, tribal, or other nonfederal legal sources.",
    );
    expect(federalRegister?.limitations.join(" ")).not.toContain(
      "foreign, or supranational law",
    );

    const plan = planScreen02SourceRoutes({
      geography: "United States",
      eventFamily: "Regulation",
    });
    expect(plan.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: "federal-register-api-v1",
          coverageStatement: federalRegister?.coverageStatement,
          limitations: federalRegister?.limitations,
        }),
        expect.objectContaining({
          connectorId: "ftc-press-releases-html-v1",
        }),
      ]),
    );
  });

  it("never substitutes a U.S. source for an unsupported non-U.S. legal scope", () => {
    const plan = planScreen02SourceRoutes({
      geography: "China",
      eventFamily: "Regulation",
    });

    expect(plan.fallbackPolicy).toBe(
      "never-cross-jurisdiction",
    );
    expect(plan.routes).toEqual([]);
    expect(connectorIds(plan)).not.toContain(
      "federal-register-api-v1",
    );
    expect(connectorIds(plan)).not.toContain(
      "openfema-disaster-declarations-v2",
    );
    expect(plan.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "national-primary-source-not-configured",
          requiresHostDiscovery: true,
        }),
        expect.objectContaining({
          code: "source-language-resolution-required",
          requiresHostDiscovery: true,
        }),
      ]),
    );
    const primaryGap = plan.coverageGaps.find(
      (gap) => gap.code === "national-primary-source-not-configured",
    );
    expect(primaryGap?.message).toContain(
      "A suitable jurisdiction-specific source must be identified and disclosed before candidates can be proposed.",
    );
    expect(primaryGap?.message).not.toMatch(
      /ChatGPT|host|model|MCP|provider|fallback/i,
    );
  });

  it("does not convert a regional study geography into issuer equality, but honors explicit bounded issuer hints", () => {
    const unsupported = planScreen02SourceRoutes({
      geography: "Northern Europe",
      eventFamily: "Electricity regulation",
    });
    expect(unsupported.jurisdiction).toEqual({
      kind: "other",
      label: "Northern Europe",
      usState: null,
    });
    expect(connectorIds(unsupported)).toEqual([]);
    expect(unsupported.coverageGaps[0]?.message).toContain(
      "Study geography was not converted into an issuing jurisdiction",
    );

    const plan = planScreen02SourceRoutes({
      geography: "Northern Europe",
      eventFamily: "Electricity regulation",
      possibleIssuingJurisdictions: [
        "European Union",
        "United Kingdom",
      ],
    });
    expect(connectorIds(plan)).toEqual([
      "eu-cellar-sparql-v1",
      "uk-legislation-atom-v1",
    ]);
    expect(plan.routes[0]?.useWhen).toContain(
      "possible-issuer or possible-issuing-jurisdiction hint",
    );
    expect(plan.routes[1]?.useWhen).toContain(
      "possible-issuer or possible-issuing-jurisdiction hint",
    );
    expect(plan.routingSignals).toMatchObject({
      studyGeography: "Northern Europe",
      matchedIssuerJurisdictions: [
        "european-union",
        "united-kingdom",
      ],
    });
    expect(plan.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "national-primary-source-not-configured",
          message: expect.stringContaining(
            "study geography remains separate from issuer identity",
          ),
          requiresHostDiscovery: true,
        }),
        expect.objectContaining({
          code: "source-language-resolution-required",
          message: expect.stringContaining(
            "authoritative national-language coverage",
          ),
          requiresHostDiscovery: true,
        }),
      ]),
    );
  });

  it("uses explicit issuer metadata rather than sample-region aliases and records unsupported hints", () => {
    const nordic = planScreen02SourceRoutes({
      geography: "Nordic countries",
      eventFamily: "Regulation",
    });
    expect(connectorIds(nordic)).toEqual([]);

    const named = planScreen02SourceRoutes({
      geography: "Norway, Sweden, and the United Kingdom",
      eventFamily: "Energy law",
    });
    expect(connectorIds(named)).toEqual([]);

    const hinted = planScreen02SourceRoutes({
      geography: "Nordic countries",
      eventFamily: "Regulation",
      possibleIssuers: ["European Commission"],
      possibleIssuingJurisdictions: ["Canada"],
    });
    expect(connectorIds(hinted)).toEqual(["eu-cellar-sparql-v1"]);
    expect(hinted.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported-issuer-jurisdiction",
          message: expect.stringContaining("Canada"),
        }),
      ]),
    );

    const stateIssuer = planScreen02SourceRoutes({
      geography: "Worldwide",
      eventFamily: "Regulation",
      possibleIssuers: ["California Legislature"],
      possibleIssuingJurisdictions: ["California"],
    });
    expect(connectorIds(stateIssuer)).toEqual([]);
    expect(stateIssuer.routingSignals.matchedIssuerJurisdictions).toEqual([]);
    expect(stateIssuer.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported-issuer-jurisdiction",
          message: expect.stringMatching(/California/),
        }),
      ]),
    );

    const federalIssuer = planScreen02SourceRoutes({
      geography: "Worldwide",
      eventFamily: "Regulation",
      possibleIssuers: ["U.S. Environmental Protection Agency"],
    });
    expect(connectorIds(federalIssuer)).toEqual([
      "federal-register-api-v1",
    ]);
    expect(federalIssuer.routingSignals.matchedIssuerJurisdictions).toEqual([
      "united-states",
    ]);
  });

  it("uses global hazard sources without treating them as national declaration coverage", () => {
    const thailand = planScreen02SourceRoutes({
      geography: "Thailand",
      eventFamily: "Earthquake disaster",
    });

    expect(connectorIds(thailand)).toEqual([
      "gdacs-event-search-v1",
      "usgs-earthquake-catalog-v1",
    ]);
    expect(connectorIds(thailand)).not.toContain(
      "openfema-disaster-declarations-v2",
    );
    expect(thailand.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "hazard-metadata-is-not-declaration",
          requiresHostDiscovery: false,
        }),
        expect.objectContaining({
          code: "national-declaration-source-not-configured",
          requiresHostDiscovery: true,
        }),
      ]),
    );
    const declarationGap = thailand.coverageGaps.find(
      (gap) => gap.code === "national-declaration-source-not-configured",
    );
    expect(declarationGap?.message).toContain(
      "A suitable jurisdiction-specific administrative source must be identified and disclosed before candidates can be proposed.",
    );
    expect(declarationGap?.message).not.toMatch(
      /ChatGPT|host|model|MCP|provider|fallback/i,
    );

    const worldwide = planScreen02SourceRoutes({
      geography: "Worldwide",
      eventFamily: "seismic hazard",
    });
    expect(connectorIds(worldwide)).toEqual([
      "gdacs-event-search-v1",
      "usgs-earthquake-catalog-v1",
    ]);
    expect(
      worldwide.coverageGaps.some(
        (gap) =>
          gap.code ===
          "national-declaration-source-not-configured",
      ),
    ).toBe(false);
  });

  it("retains U.S. administrative coverage only for an exact U.S. disaster scope", () => {
    const us = planScreen02SourceRoutes({
      geography: "USA",
      eventFamily: "Flood disaster",
    });
    expect(connectorIds(us)).toEqual([
      "openfema-disaster-declarations-v2",
      "gdacs-event-search-v1",
    ]);

    const combined = planScreen02SourceRoutes({
      geography: "United States and Canada",
      eventFamily: "Flood disaster",
    });
    expect(connectorIds(combined)).toEqual([
      "gdacs-event-search-v1",
    ]);
    expect(connectorIds(combined)).not.toContain(
      "openfema-disaster-declarations-v2",
    );
  });

  it("recognizes full U.S. state geographies without treating an ambiguous country name as a state", () => {
    const california = planScreen02SourceRoutes({
      geography: "State of California, United States",
      eventFamily: "Flood disaster",
    });
    expect(california.jurisdiction).toEqual({
      kind: "united-states",
      label: "California",
      usState: {
        code: "CA",
        name: "California",
      },
    });
    expect(connectorIds(california)).toEqual([
      "openfema-disaster-declarations-v2",
      "gdacs-event-search-v1",
    ]);

    const georgiaCountry = planScreen02SourceRoutes({
      geography: "Georgia",
      eventFamily: "Flood disaster",
    });
    expect(georgiaCountry.jurisdiction).toEqual({
      kind: "other",
      label: "Georgia",
      usState: null,
    });
    expect(connectorIds(georgiaCountry)).toEqual([
      "gdacs-event-search-v1",
    ]);

    const georgiaState = planScreen02SourceRoutes({
      geography: "Georgia, USA",
      eventFamily: "Flood disaster",
    });
    expect(georgiaState.jurisdiction.usState).toEqual({
      code: "GA",
      name: "Georgia",
    });
  });
});
