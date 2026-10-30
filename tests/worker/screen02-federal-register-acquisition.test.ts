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
import {
  acquireScreen02FederalRegisterPolicy,
  SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES,
} from "../../src/worker/screen02-federal-register-acquisition";

const landing =
  "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";

function confirmedWorkflow() {
  let state = createSixScreenWorkflow({
    runId: "policy-acquisition-run",
    studyId: "policy-acquisition-study",
    study: {
      population: "RTOs and ISOs",
      analysisUnit: "Market operator",
      geography: ["United States"],
      industry: ["Electric power"],
      period: { start: "2017", end: "2021" },
      outcome: "Storage participation",
      intendedConstruct: "Market access",
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: "FERC Order 841 (2018-03708)",
    requestedJurisdiction: "United States",
    approximateYear: "2018",
    intendedEpisode: "final rule",
    createdAt: "2026-09-12T10:00:00.000Z",
  });
  const started = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "request-order-841",
    requestedAt: "2026-09-12T10:00:01.000Z",
  });
  const identitySources = [{
    id: "source-order-841",
    title: "Order 841",
    locator: landing,
    publisher: "Federal Register",
    publishedDate: "2018-03-06",
    authorityTier: "tier-2",
    retrievedAt: "2026-09-12T10:00:02.000Z",
  }];
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: "identity-order-841",
      officialTitle: "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      aliases: ["Order 841"],
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      instrumentType: "Rule",
      formalIdentifiers: ["2018-03708"],
      episode: "final rule",
      versionScope: "published final rule",
      typedDates: [{
        start: "2018-03-06",
        end: null,
        precision: "day",
        kind: "publication",
        passageIds: [],
      }],
      identitySourceIds: ["source-order-841"],
      sourceSnapshotId: "identity-source-order-841",
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription: "The official metadata identifies Order 841.",
      matchExplanation: "The exact document number matches.",
      materialMismatches: [],
      retrievedAt: "2026-09-12T10:00:02.000Z",
    }],
    appliedAt: "2026-09-12T10:00:02.000Z",
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
    interactionId: "interaction-order-841",
    decisionId: "decision-order-841",
    actor: "researcher_ui",
    confirmedAt: "2026-09-12T10:00:03.000Z",
  });
  return openScreen2(state, {
    expectedRevision: 3,
    openedAt: "2026-09-12T10:00:04.000Z",
  }).state;
}

function ownDocumentBody(documentNumber = "2018-03708") {
  return `<!doctype html><html><body><main>
    <p>This final rule requires each regional transmission organization to revise its tariff and establish a participation model for electric storage resources.</p>
    <p>This final rule is effective June 4, 2018.</p>
    <p>Each RTO/ISO must file the tariff changes needed to implement the requirements of this Final Rule within 270 days of the publication date of this Final Rule in the Federal Register.</p>
    <p>We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.</p>
    <p>This Final Rule requires each RTO/ISO to implement market rules applicable to electric storage resources, as defined herein, that voluntarily seek to participate in the RTO/ISO markets; this Final Rule does not require electric storage resources to participate in those markets.</p>
    <p>We clarify that this Final Rule does not exempt an electric storage resource that is participating in RTO/ISO capacity markets from any applicable penalties for non-performance.</p>
    <p>[FR Doc. ${documentNumber} Filed 3-5-18; 8:45 am]</p>
  </main></body></html>`;
}

describe("controlled six-screen Federal Register acquisition", () => {
  it("falls back to the exact raw-text representation without weakening document identity", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      return url.includes("/full_text/html/")
        ? new Response(ownDocumentBody("2018-09999"), {
            headers: { "content-type": "text/html" },
          })
        : new Response(ownDocumentBody().replace(/<[^>]+>/gu, " "), {
            headers: { "content-type": "text/plain" },
          });
    });
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      documentNumber: "2018-03708",
      usage: { documentAttempts: 2, usefulDocuments: 1, transportHops: 2 },
    });
    expect(result.attemptedSources[1]).toContain("/full_text/text/");
    expect(result.parsed?.collection.sources[0]).toMatchObject({
      nativeId: "2018-03708",
      inspectedText: "full",
    });
  });

  it.each([
    [
      "wrong document",
      () => new Response(ownDocumentBody("2018-09999"), {
        headers: { "content-type": "text/html" },
      }),
      "wrong_document",
      "unsupported",
    ],
    [
      "unsupported media type",
      () => new Response("%PDF fixture", {
        headers: { "content-type": "application/pdf" },
      }),
      "unsupported_format",
      "unsupported",
    ],
    [
      "access-control interstitial",
      () => new Response("<html><title>Just a moment</title><body><div class='cf-chl-test'>Verify that you are human. Enable JavaScript and cookies.</div></body></html>", {
        headers: { "content-type": "text/html" },
      }),
      "source_unavailable",
      "waiting_source",
    ],
  ] as const)("records %s as a typed failure with no evidence", async (
    _label,
    response,
    failureCode,
    status,
  ) => {
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => response(),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({ status, failureCode, parsed: null });
    expect(result.usage.usefulDocuments).toBe(0);
    expect(result.attemptedSources).toHaveLength(2);
  });

  it.each([
    "Related Document Number: 2018-03708.",
    "For background, see [FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]",
  ])("does not bind a related citation as the response's own identity: %s", async (marker) => {
    const body = ownDocumentBody().replace(
      "[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]",
      marker,
    );
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response(body, {
        headers: { "content-type": "text/html" },
      }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      parsed: null,
    });
  });

  it("counts an oversized streamed body before rejecting it at the representation boundary", async () => {
    const oversized = `${"x".repeat(SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES + 1)} [FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]`;
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response(oversized, {
        headers: { "content-type": "text/html" },
      }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "waiting_source",
      failureCode: "response_limit",
      parsed: null,
    });
    expect(result.usage.receivedBytes).toBeGreaterThan(
      SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES,
    );
    expect(result.usage.receivedBytes).toBeLessThanOrEqual(
      2 * (SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES + 1),
    );
  });

  it("keeps a missing implementation schedule explicit instead of deriving it from the effective date", async () => {
    const withoutImplementation = ownDocumentBody().replace(
      /<p>Each RTO\/ISO must file[\s\S]*?<\/p>\s*<p>We will allow each RTO\/ISO[\s\S]*?<\/p>/u,
      "",
    );
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response(withoutImplementation, {
        headers: { "content-type": "text/html" },
      }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result.status).toBe("partial");
    expect(result.unresolved).toContain("implementation");
    expect(result.parsed?.projections.map(({ predicate }) => predicate))
      .toEqual(["operative_change", "legal_effect_date"]);
    expect(result.parsed?.collection.requirements).toContainEqual(
      expect.objectContaining({
        kind: "implementation",
        status: "searched_not_found",
        supportingClaimIds: [],
      }),
    );
  });

  it("extracts source-grounded coverage and non-exemption in the targeted continuation focus", async () => {
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response(ownDocumentBody(), {
        headers: { "content-type": "text/html" },
      }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
      focus: "coverage_exemptions",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      focus: "coverage_exemptions",
      parsed: {
        collection: {
          requirements: expect.arrayContaining([
            expect.objectContaining({ kind: "coverage", status: "supported" }),
            expect.objectContaining({ kind: "exemption", status: "supported" }),
            expect.objectContaining({
              kind: "previous_baseline",
              status: "not_yet_searched",
            }),
          ]),
        },
      },
    });
    expect(result.parsed?.projections.map(({ predicate }) => predicate)).toEqual([
      "operative_change",
      "legal_effect_date",
      "implementation_schedule",
      "coverage_condition",
      "exemption_rule",
    ]);
    expect(result.parsed?.projections.find(({ predicate }) =>
      predicate === "coverage_condition")?.statement).toContain(
      "voluntarily seek to participate",
    );
    expect(result.parsed?.projections.find(({ predicate }) =>
      predicate === "exemption_rule")?.typedValue).toEqual({
      documentNumber: "2018-03708",
      disposition: "not_exempt",
    });
  });

  it("rejects redirects that escape the exact Federal Register record", async () => {
    const fetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://example.com/other-document" },
    }));
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      parsed: null,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses the exact GovInfo granule only after the retained Federal Register representations fail", async () => {
    const summaryUrl =
      "https://api.govinfo.gov/packages/FR-2018-03-06/granules/2018-03708/summary";
    const htmlUrl =
      "https://api.govinfo.gov/packages/FR-2018-03-06/granules/2018-03708/htm";
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url.includes("federalregister.gov/documents/full_text/")) {
        return new Response("temporarily unavailable", { status: 503 });
      }
      expect(new Headers(init?.headers).get("x-api-key")).toBe("govinfo-secret");
      if (url === summaryUrl) {
        return new Response(JSON.stringify({
          collectionCode: "FR",
          dateIssued: "2018-03-06",
          packageId: "FR-2018-03-06",
          granuleId: "2018-03708",
          download: { txtLink: htmlUrl },
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === htmlUrl) {
        return new Response(ownDocumentBody(), {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const result = await acquireScreen02FederalRegisterPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      govInfoApiKey: "govinfo-secret",
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      attemptedSources: expect.arrayContaining([summaryUrl, htmlUrl]),
      usage: {
        documentAttempts: 4,
        usefulDocuments: 1,
        transportHops: 4,
        metadataRecords: 1,
      },
      parsed: {
        collection: {
          sources: [expect.objectContaining({
            provider: "govinfo",
            publisher: "U.S. Government Publishing Office",
            canonicalUrl: htmlUrl,
            inspectedText: "full",
          })],
        },
      },
    });
    expect(result.parsed?.projections[0]?.citation.sourceRole).toContain(
      "without treating a second representation as independent corroboration",
    );
    expect(result.parsed?.projections[0]?.citation.sourceTitle).toBe(
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    );
    expect(JSON.stringify(result)).not.toContain("govinfo-secret");
  });
});
