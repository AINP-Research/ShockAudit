import { describe, expect, it } from "vitest";

import { sourceCapabilityForRequest } from
  "../../src/core/six-screen/capabilities";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";

describe("six-screen source capability register", () => {
  it("distinguishes implemented, configured, tested, and enabled status", () => {
    const register = buildSixScreenSourceRegister();
    expect(register.federal_register).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: true,
      status: "enabled_not_tested",
      adapterVersion: "six-screen-federal-register-policy-v4",
      operations: {
        resolveIdentity: true,
        searchRecords: true,
        getRecord: true,
        listRepresentations: true,
        fetchRepresentation: true,
      },
      supportedFormats: ["json", "html", "text"],
    });
    expect(register.federal_register.limitation).toContain("formal-coverage");
    expect(register.federal_register.limitation).toContain("explicit exemption");
    expect(register.federal_register.limitation).toContain("CFR title/part");
    expect(register.ecfr).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: true,
      status: "enabled_not_tested",
      adapterVersion: "six-screen-ecfr-point-in-time-policy-v3",
      operations: {
        getRecord: true,
        listRepresentations: true,
        fetchRepresentation: true,
      },
      supportedFormats: ["json", "xml"],
    });
    expect(register.ecfr.limitation).toContain("does not substitute current text");
    expect(register.ecfr.limitation).toContain("inconsistent version dates");
    expect(register.govinfo).toMatchObject({
      implemented: true,
      configured: false,
      tested: false,
      enabled: false,
      status: "not_configured",
      adapterVersion:
        "govinfo-public-law-name-discovery-v3+govinfo-federal-register-exact-granule-v1+govinfo-annual-cfr-exact-section-v1",
      operations: {
        searchRecords: true,
        getRecord: true,
        listRepresentations: true,
        fetchRepresentation: true,
      },
      supportedFormats: ["json", "html", "xml"],
    });
    expect(register.openalex).toMatchObject({
      implemented: true,
      configured: false,
      enabled: false,
      status: "not_configured",
      adapterVersion: "screen-05-openalex-literature-evidence-v4",
      documentFamilies: [
        "scholarly_metadata",
        "scholarly_abstract",
        "open_location_metadata",
      ],
      operations: {
        searchRecords: true,
        getRecord: false,
        fetchRepresentation: false,
      },
      supportedFormats: ["json"],
    });
    expect(register.openalex.limitation).toContain("unvisited leads");
    expect(register.congress_gov).toMatchObject({
      implemented: true,
      configured: false,
      tested: false,
      enabled: false,
      status: "not_configured",
      operations: {
        resolveIdentity: true,
        searchRecords: false,
        getRecord: true,
        listRepresentations: true,
        fetchRepresentation: true,
      },
    });
    expect(register.congress_gov.limitation).toContain(
      "not represented as providing free-text statute search",
    );
    expect(register.regulations_gov).toMatchObject({
      implemented: true,
      configured: false,
      tested: false,
      enabled: false,
      status: "not_configured",
      operations: {
        searchRecords: true,
        getRecord: true,
        fetchRepresentation: false,
      },
    });
    expect(register.regulations_gov.limitation).toContain(
      "never controlling legal text",
    );
    expect(register.crossref).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: true,
      status: "enabled_not_tested",
      adapterVersion:
        "crossref-contextual-discovery-v1+screen-05-crossref-literature-evidence-v2",
      documentFamilies: ["scholarly_metadata", "scholarly_abstract"],
      operations: {
        searchRecords: true,
        fetchRepresentation: false,
      },
    });
    expect(register.crossref.historicalCoverage).toContain(
      "deposited update metadata",
    );
    expect(register.crossref.limitation).toContain(
      "Metadata-only records support no detailed claim",
    );
    expect(register.gdelt).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: true,
      operations: {
        searchRecords: true,
        getRecord: false,
        fetchRepresentation: false,
      },
    });
    expect(register.gdelt.limitation).toContain(
      "discovery index, not a policy authority",
    );
    expect(register.reviewed_official_documents.documentFamilies).toEqual(
      expect.arrayContaining([
        "official_explanation",
        "implementation_record",
        "specialist_analysis",
      ]),
    );
  });

  it("uses only secret-presence booleans and enables a tested keyed route without retaining the key name", () => {
    const register = buildSixScreenSourceRegister({
      configuredSecrets: { GOVINFO_API_KEY: true },
      probes: {
        govinfo: {
          at: "2026-09-12T10:00:00.000Z",
          endpoint: "https://api.govinfo.gov/collections",
          outcome: "success",
          httpStatus: 200,
          note: "Harmless probe fixture.",
        },
      },
    });
    expect(register.govinfo).toMatchObject({
      configured: true,
      tested: true,
      implemented: true,
      enabled: true,
      status: "healthy",
    });
    expect(JSON.stringify(register)).not.toContain("GOVINFO_API_KEY");
  });

  it("enables OpenAlex only when both key presence and a healthy probe are recorded", () => {
    const register = buildSixScreenSourceRegister({
      configuredSecrets: { OPENALEX_API_KEY: true },
      probes: {
        openalex: {
          at: "2026-09-12T10:00:00.000Z",
          endpoint: "https://api.openalex.org/works",
          outcome: "success",
          httpStatus: 200,
          note: "Harmless OpenAlex fixture probe.",
        },
      },
    });
    expect(register.openalex).toMatchObject({
      configured: true,
      tested: true,
      implemented: true,
      enabled: true,
      status: "healthy",
    });
    expect(JSON.stringify(register)).not.toContain("OPENALEX_API_KEY");
  });

  it("keeps Congress.gov and Regulations.gov implementation, configuration, testing, and enablement explicit", () => {
    const configured = buildSixScreenSourceRegister({
      configuredSecrets: {
        CONGRESS_API_KEY: true,
        REGULATIONS_API_KEY: true,
      },
    });
    expect(configured.congress_gov).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(configured.regulations_gov).toMatchObject({
      implemented: true,
      configured: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    const probed = buildSixScreenSourceRegister({
      configuredSecrets: {
        CONGRESS_API_KEY: true,
        REGULATIONS_API_KEY: true,
      },
      probes: {
        congress_gov: {
          at: "2026-09-17T14:00:00.000Z",
          endpoint: "https://api.congress.gov/v3/law/118/pub/42",
          outcome: "success",
          httpStatus: 200,
          note: "Exact public-law identity fixture probe.",
        },
        regulations_gov: {
          at: "2026-09-17T14:00:00.000Z",
          endpoint: "https://api.regulations.gov/v4/documents",
          outcome: "success",
          httpStatus: 200,
          note: "Bounded administrative-document fixture probe.",
        },
      },
    });
    expect(probed.congress_gov).toMatchObject({
      tested: true,
      enabled: true,
      status: "healthy",
    });
    expect(probed.regulations_gov).toMatchObject({
      tested: true,
      enabled: true,
      status: "healthy",
    });
  });

  it("records healthy, degraded, quota, and request-unsupported states separately", () => {
    const baseProbe = {
      at: "2026-09-12T10:00:00.000Z",
      httpStatus: 200,
      note: "Harmless fixture probe.",
    } as const;
    const register = buildSixScreenSourceRegister({
      probes: {
        federal_register: {
          ...baseProbe,
          endpoint: "https://www.federalregister.gov/api/v1/documents.json",
          outcome: "success",
        },
        crossref: {
          ...baseProbe,
          endpoint: "https://api.crossref.org/v1/works",
          outcome: "rate_limited",
          httpStatus: 429,
        },
        uk_legislation: {
          ...baseProbe,
          endpoint: "https://www.legislation.gov.uk/all/data.feed",
          outcome: "failure",
          httpStatus: 503,
        },
      },
    });
    expect(register.federal_register.status).toBe("healthy");
    expect(register.crossref).toMatchObject({
      status: "quota_exhausted",
      enabled: false,
    });
    expect(register.uk_legislation).toMatchObject({
      status: "degraded",
      enabled: false,
    });
    expect(sourceCapabilityForRequest(register.federal_register, {
      jurisdiction: "Canada",
      documentFamily: "administrative_rule",
      language: "en",
    })).toMatchObject({
      status: "unsupported_for_request",
      enabled: false,
    });
  });

  it("rejects a probe record that would retain a credential-bearing URL", () => {
    const credentialBearingEndpoint = new URL(
      "https://www.federalregister.gov/api/v1/documents.json",
    );
    credentialBearingEndpoint.searchParams.set("api_key", "[redacted]");
    expect(() => buildSixScreenSourceRegister({
      probes: {
        federal_register: {
          at: "2026-09-12T10:00:00.000Z",
          endpoint: credentialBearingEndpoint.toString(),
          outcome: "success",
          httpStatus: 200,
          note: "Unsafe fixture.",
        },
      },
    })).toThrow(/sanitized/u);
  });
});
