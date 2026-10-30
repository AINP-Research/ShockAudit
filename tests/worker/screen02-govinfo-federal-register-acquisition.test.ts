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
  acquireScreen02GovInfoFederalRegisterRepresentation,
} from
  "../../src/worker/screen02-govinfo-federal-register-acquisition";

const publicationDate = "2018-03-06";
const documentNumber = "2018-03708";
const summaryUrl =
  `https://api.govinfo.gov/packages/FR-${publicationDate}/granules/${documentNumber}/summary`;
const htmlUrl =
  `https://api.govinfo.gov/packages/FR-${publicationDate}/granules/${documentNumber}/htm`;

function confirmedWorkflow() {
  let state = createSixScreenWorkflow({
    runId: "govinfo-acquisition-run",
    studyId: "govinfo-acquisition-study",
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
    locator:
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/order-841",
    publisher: "Federal Register",
    publishedDate: publicationDate,
    authorityTier: "tier-2",
    retrievedAt: "2026-09-12T10:00:02.000Z",
  }];
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: "identity-order-841",
      officialTitle:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      aliases: ["Order 841"],
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      instrumentType: "Rule",
      formalIdentifiers: [documentNumber],
      episode: "final rule",
      versionScope: "published final rule",
      typedDates: [{
        start: publicationDate,
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

function summary(overrides: Record<string, unknown> = {}) {
  return {
    title: "Electric Storage Participation in Markets",
    collectionCode: "FR",
    dateIssued: publicationDate,
    packageId: `FR-${publicationDate}`,
    granuleId: documentNumber,
    download: { txtLink: htmlUrl },
    ...overrides,
  };
}

function documentBody(ownDocumentNumber = documentNumber) {
  return `<!doctype html><html><body><main>
    <p>18 CFR Part 35</p>
    <p>This final rule requires each regional transmission organization to revise its tariff and establish a participation model for electric storage resources.</p>
    <p>This final rule is effective June 4, 2018.</p>
    <p>[FR Doc. ${ownDocumentNumber} Filed 3-5-18; 8:45 am]</p>
  </main></body></html>`;
}

describe("bounded GovInfo Federal Register exact-record acquisition", () => {
  it("does not issue a request when the server credential is absent", async () => {
    const fetch = vi.fn();
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch,
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "source_not_configured",
      attemptedSources: [],
      representation: null,
      usage: { documentAttempts: 0, transportHops: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("binds the exact summary and HTML representation while keeping the key out of every retained locator", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      expect(url).not.toContain("server-secret");
      expect(new Headers(init?.headers).get("x-api-key")).toBe("server-secret");
      if (url === summaryUrl) {
        return new Response(JSON.stringify(summary()), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === htmlUrl) {
        return new Response(documentBody(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch,
      apiKey: "server-secret",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      documentNumber,
      attemptedSources: [summaryUrl, htmlUrl],
      representation: {
        canonicalUrl: htmlUrl,
        representation: "html",
      },
      usage: {
        metadataRecords: 1,
        documentAttempts: 2,
        usefulDocuments: 1,
        transportHops: 2,
      },
    });
    expect(result.representation?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.representation?.parsedText).toContain("participation model");
    expect(JSON.stringify(result)).not.toContain("server-secret");
  });

  it.each([
    [
      "a mismatched summary identity",
      summary({ granuleId: "2018-09999" }),
    ],
    [
      "a representation URL outside the exact granule",
      summary({
        download: {
          txtLink:
            "https://api.govinfo.gov/packages/FR-2018-03-06/granules/2018-09999/htm",
        },
      }),
    ],
  ])("rejects %s before document retrieval", async (_label, payload) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    }));
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch,
      apiKey: "server-secret",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      representation: null,
      usage: { documentAttempts: 1, usefulDocuments: 0 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("treats a rejected configured credential as unavailable configuration, not an empty result", async () => {
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response("unauthorized", { status: 401 }),
      apiKey: "rejected-secret",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "source_not_configured",
      representation: null,
    });
    expect(result.limitation).toContain("rejected");
    expect(JSON.stringify(result)).not.toContain("rejected-secret");
  });

  it("does not retain a credential echoed by a failing connector", async () => {
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch: async () => {
        throw new Error("transport included echoed-secret");
      },
      apiKey: "echoed-secret",
    });
    expect(result).toMatchObject({
      status: "waiting_source",
      failureCode: "source_unavailable",
      representation: null,
    });
    expect(JSON.stringify(result)).not.toContain("echoed-secret");
  });

  it("rejects HTML that names a different Federal Register document", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === summaryUrl
        ? new Response(JSON.stringify(summary()), {
            headers: { "content-type": "application/json" },
          })
        : new Response(documentBody("2018-09999"), {
            headers: { "content-type": "text/html" },
          })
    );
    const result = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: confirmedWorkflow(),
      fetch,
      apiKey: "server-secret",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      representation: null,
      usage: { documentAttempts: 2, usefulDocuments: 0 },
    });
  });
});
