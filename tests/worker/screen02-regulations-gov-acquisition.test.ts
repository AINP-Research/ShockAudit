import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  applyIdentityResolution,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  openScreen2,
} from "../../src/core/six-screen/workflow";
import { acquireScreen02RegulationsGovPolicy } from
  "../../src/worker/screen02-regulations-gov-acquisition";

const retrievedAt = "2026-09-17T14:00:00.000Z";

function confirmedWorkflow() {
  let state = createSixScreenWorkflow({
    runId: "regulations-gov-run",
    studyId: "regulations-gov-study",
    study: {
      population: "Hospitals",
      analysisUnit: "Hospital",
      geography: ["United States"],
      industry: ["Health care"],
      period: { start: "2018", end: "2024" },
      outcome: "Price disclosure",
      intendedConstruct: null,
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: "Hospital Price Transparency final rule",
    requestedJurisdiction: "United States",
    intendedEpisode: "final rule",
    createdAt: retrievedAt,
  });
  const started = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "request-regulations-gov",
    requestedAt: "2026-09-17T14:00:01.000Z",
  });
  const identitySources = [{
    id: "source-hospital-transparency",
    title: "Hospital Price Transparency Requirements",
    locator:
      "https://www.federalregister.gov/documents/2019/11/27/2019-24931/medicare-and-medicaid-programs-cy-2020-hospital-outpatient-pps-policy-changes-and-payment-rates-and",
    publisher: "Federal Register",
    publishedDate: "2019-11-27",
    authorityTier: "tier-1",
    retrievedAt: "2026-09-17T14:00:02.000Z",
    provider: "Federal Register",
    nativeId: "2019-24931",
    routeId: "exact_federal_register_document",
    accessStatus: "retained_passage" as const,
    inspectedText: "partial" as const,
    contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    retainedText: "FR Doc. 2019-24931 establishes hospital price transparency requirements.",
  }];
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: "identity-hospital-transparency",
      officialTitle: "Hospital Price Transparency Requirements",
      aliases: ["Hospital Price Transparency final rule"],
      issuer: "Centers for Medicare & Medicaid Services",
      issuingJurisdiction: "United States",
      instrumentType: "federal administrative rule",
      formalIdentifiers: ["2019-24931"],
      episode: "final rule",
      versionScope: "2019 published final rule",
      typedDates: [],
      identitySourceIds: identitySources.map(({ id }) => id),
      sourceSnapshotId: "source-snapshot-hospital-transparency",
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription: "The exact Federal Register record identifies the final rule.",
      matchExplanation: "The title and exact FR document number match.",
      materialMismatches: [],
      retrievedAt: "2026-09-17T14:00:02.000Z",
    }],
    appliedAt: "2026-09-17T14:00:02.000Z",
  });
  const candidate = state.candidates[0]!;
  state = confirmDisplayedShock(state, {
    expectedRevision: 2,
    candidateId: candidate.id,
    displayedIdentityFingerprint: candidate.identityFingerprint,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    identityRevision: state.identityRevision,
    interactionId: "interaction-regulations-gov",
    decisionId: "decision-regulations-gov",
    actor: "researcher_ui",
    confirmedAt: "2026-09-17T14:00:03.000Z",
  });
  return openScreen2(state, {
    expectedRevision: 3,
    openedAt: "2026-09-17T14:00:04.000Z",
  }).state;
}

function document(id = "CMS-2019-0150-0001") {
  return {
    id,
    type: "documents",
    attributes: {
      title: "Hospital Price Transparency Requirements",
      documentType: "Rule",
      docketId: "CMS-2019-0150",
      agencyId: "CMS",
      frDocNum: "2019-24931",
      postedDate: "2019-11-27T00:00:00Z",
      effectiveDate: "2020-01-01T00:00:00Z",
      commentStartDate: "2019-08-09T00:00:00Z",
      commentEndDate: "2019-09-27T00:00:00Z",
      withdrawn: false,
    },
  };
}

describe("Regulations.gov administrative-docket acquisition", () => {
  it("retains an exact FR-document/docket binding and stage metadata without legal-text overclaiming", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      requests.push({ url, headers: new Headers(init?.headers) });
      return url.includes("/v4/documents?")
        ? new Response(JSON.stringify({ data: [document()] }), {
            headers: { "content-type": "application/vnd.api+json" },
          })
        : new Response(JSON.stringify({ data: document() }), {
            headers: { "content-type": "application/vnd.api+json" },
          });
    });

    const result = await acquireScreen02RegulationsGovPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt,
      apiKey: "regulations-secret-for-test",
      searchedRequirementKinds: [
        "temporal_stage", "version", "implementation", "enforcement",
      ],
    });

    expect(result.status).toBe("partial");
    expect(result.failureCode).toBeNull();
    expect(result.documentNumber).toBeNull();
    expect(result.parsed?.collection.sources[0]).toMatchObject({
      provider: "Regulations.gov",
      nativeId: "CMS-2019-0150-0001",
      inspectedText: "metadata_only",
    });
    expect(result.parsed?.collection.claims.map(({ predicate }) => predicate))
      .toEqual(expect.arrayContaining([
        "historical_version_change",
        "legal_effect_date",
        "policy_date",
      ]));
    expect(result.parsed?.collection.claims.some(({ predicate }) =>
      predicate === "operative_change" || predicate === "enforcement_authority"
    )).toBe(false);
    expect(result.unresolved).toEqual(expect.arrayContaining([
      "implementation", "enforcement",
    ]));
    expect(result.usage).toMatchObject({
      sourceQueries: 1,
      documentAttempts: 1,
      usefulDocuments: 1,
      transportHops: 2,
    });
    expect(requests).toHaveLength(2);
    expect(requests.every(({ headers }) =>
      headers.get("x-api-key") === "regulations-secret-for-test"
    )).toBe(true);
    expect(requests.every(({ url }) =>
      !url.includes("regulations-secret-for-test")
    )).toBe(true);
  });

  it("reports configuration separately and leaves existing official routes usable", async () => {
    const fetch = vi.fn();
    const result = await acquireScreen02RegulationsGovPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt,
      searchedRequirementKinds: ["version"],
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "source_not_configured",
      parsed: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
