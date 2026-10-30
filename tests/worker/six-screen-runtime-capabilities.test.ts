import { describe, expect, it } from "vitest";

import { HOST_REASONING_TASK_TYPES } from
  "../../src/core/host-reasoning-task";
import {
  SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_MAX_BYTES,
  SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_VERSION,
  buildSixScreenRuntimeCapabilityReport,
} from "../../src/worker/six-screen-runtime-capabilities";

describe("six-screen runtime capability report", () => {
  it("reports every source status and labels code-declared limits as unmeasured", () => {
    const report = buildSixScreenRuntimeCapabilityReport();

    expect(report).toMatchObject({
      schemaVersion: SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_VERSION,
      sourceRegister: {
        schemaVersion: "shockaudit-source-register-v4",
        sourceCount: 18,
        enabledSourceIds: [
          "crossref",
          "ecfr",
          "eu_cellar",
          "federal_register",
          "gdacs",
          "gdelt",
          "openfema",
          "reviewed_official_documents",
          "uk_legislation",
          "usgs",
        ],
        statusCounts: {
          not_configured: 8,
          configured_not_tested: 0,
          enabled_not_tested: 10,
          healthy: 0,
          degraded: 0,
          quota_exhausted: 0,
          policy_blocked: 0,
          unsupported_for_request: 0,
        },
      },
      intelligence: {
        configuredMode: "experimental-off",
        exposure: "disabled",
        modelCallable: false,
        actualSignedInProof: false,
        genuineTraceCount: 0,
        availableTaskTypes: [],
        blocker: {
          stage: "authorization",
          code: "SIGNED_IN_ROUND_TRIP_NOT_RECORDED",
        },
      },
      declaredResources: {
        schemaVersion: "six-screen-declared-resource-profile-v1",
        measurementStatus: "declared_not_deployed_measurement",
        mcpRequestMaxBytes: 16 * 1024 * 1024,
        evidenceChunkMaxBytes: 96_000,
        policyEventCardReviewMaxBytes: 96_000,
        researchProfileVersion: "six-screen-research-profiles-v1",
        researchProfiles: {
          "policy-standard": {
            kind: "policy",
            limits: {
              activeResearchMs: 120_000,
              decodedBytes: 32 * 1024 * 1024,
            },
          },
          "policy-deep": {
            kind: "policy",
            limits: {
              activeResearchMs: 300_000,
              decodedBytes: 64 * 1024 * 1024,
            },
          },
        },
      },
    });
    expect(new TextEncoder().encode(JSON.stringify(report)).byteLength)
      .toBeLessThanOrEqual(SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_MAX_BYTES);
  });

  it("accepts only secret-presence booleans and never returns secret names", () => {
    const report = buildSixScreenRuntimeCapabilityReport({
      configuredSecrets: {
        GOVINFO_API_KEY: true,
        CONGRESS_API_KEY: true,
        REGULATIONS_API_KEY: true,
        OPENSTATES_API_KEY: true,
        OPENALEX_API_KEY: true,
      },
    });

    expect(report.sourceRegister.entries.govinfo).toMatchObject({
      configured: true,
      implemented: true,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(report.sourceRegister.entries.congress_gov).toMatchObject({
      configured: true,
      implemented: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(report.sourceRegister.entries.regulations_gov).toMatchObject({
      configured: true,
      implemented: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(report.sourceRegister.entries.openalex).toMatchObject({
      configured: true,
      implemented: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(report.sourceRegister.entries.openstates).toMatchObject({
      configured: true,
      implemented: true,
      tested: false,
      enabled: false,
      status: "configured_not_tested",
    });
    expect(report.sourceRegister.statusCounts).toMatchObject({
      not_configured: 3,
      configured_not_tested: 5,
      enabled_not_tested: 10,
      policy_blocked: 0,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("GOVINFO_API_KEY");
    expect(serialized).not.toContain("CONGRESS_API_KEY");
    expect(serialized).not.toContain("REGULATIONS_API_KEY");
    expect(serialized).not.toContain("OPENSTATES_API_KEY");
    expect(serialized).not.toContain("OPENALEX_API_KEY");
  });

  it("distinguishes configured host exposure from missing signed-in proof", () => {
    const full = buildSixScreenRuntimeCapabilityReport({
      hostReasoningMode: "full",
    });
    expect(full.intelligence).toMatchObject({
      configuredMode: "full",
      exposure: "model-callable-unverified",
      modelCallable: true,
      actualSignedInProof: false,
      genuineTraceCount: 0,
      availableTaskTypes: HOST_REASONING_TASK_TYPES.filter((taskType) =>
        !taskType.startsWith("screen05-")
      ),
      blocker: { code: "SIGNED_IN_ROUND_TRIP_NOT_RECORDED" },
    });

    const appOnly = buildSixScreenRuntimeCapabilityReport({
      hostReasoningMode: "app-only",
    });
    expect(appOnly.intelligence).toMatchObject({
      configuredMode: "app-only",
      exposure: "app-only-unverified",
      modelCallable: false,
      actualSignedInProof: false,
      availableTaskTypes: [],
    });
  });
});
