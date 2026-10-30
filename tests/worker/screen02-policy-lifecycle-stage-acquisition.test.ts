import { describe, expect, it, vi } from "vitest";

import { createCoEventCandidateOccurrence } from
  "../../src/core/six-screen/co-event-execution";
import { acquireScreen02PolicyLifecycleStageDocument } from
  "../../src/worker/screen02-policy-lifecycle-stage-acquisition";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

const landing =
  "https://www.federalregister.gov/documents/2021/06/21/2021-54321/example";

function candidate() {
  return createCoEventCandidateOccurrence({
    id: "policy-lifecycle-stage-candidate",
    providerId: "federal_register",
    sourceNativeId: "2021-54321",
    title: "Capacity Market Reliability Implementation Rule",
    description:
      "The commission reported a later implementation-stage document.",
    eventFamily: "policy_or_regulatory_change",
    formalIdentifiers: ["2021-54321"],
    typedDates: [{
      kind: "publication",
      value: "2021-06-21",
      precision: "day",
      sourceId: "policy-lifecycle-stage-source-metadata",
    }],
    geography: { status: "provider_reported", labels: ["United States"] },
    evidence: [{
      sourceId: "policy-lifecycle-stage-source-metadata",
      title: "Capacity Market Reliability Implementation Rule",
      locator: landing,
      publisher: "Federal Energy Regulatory Commission",
      publishedDate: "2021-06-21",
      authorityTier: 1,
      retrievedAt: "2026-09-14T13:00:00.000Z",
      evidenceRole: "occurrence_metadata",
    }],
    recordedAt: "2026-09-14T13:00:00.000Z",
  });
}

function ownDocumentBody(input: {
  documentNumber?: string;
  includeFocalIdentifier?: boolean;
} = {}) {
  const documentNumber = input.documentNumber ?? "2021-54321";
  return `<!doctype html><html><body><main>
    <p>This implementation order concerns the capacity-market schedule.</p>
    ${input.includeFocalIdentifier === false
      ? ""
      : "<p>The commission applies this schedule to 2020-12345.</p>"}
    <p>No causal or comparison-specific conclusion appears in this document.</p>
    <p>[FR Doc. ${documentNumber} Filed 6-18-21; 8:45 am]</p>
  </main></body></html>`;
}

describe("bounded Screen 2 policy-lifecycle document acquisition", () => {
  it("retains exact official passages and a deterministic focal-policy anchor", async () => {
    const fetch = vi.fn(async (_request: RequestInfo | URL) =>
      new Response(ownDocumentBody(), {
      status: 200,
      headers: { "content-type": "text/html" },
      }));
    const result = await acquireScreen02PolicyLifecycleStageDocument({
      candidate: candidate(),
      confirmedShock: createBrowserEventCardFixture().state.confirmedShock!,
      coordinate: "adapter-success",
      fetch,
      retrievedAt: "2026-09-14T13:00:01.000Z",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]![0])).toContain(
      "/documents/full_text/html/2021/06/21/2021-54321.html",
    );
    expect(result).toMatchObject({
      outcome: "document_retained",
      failureCode: null,
      usage: {
        documentAttempts: 1,
        usefulDocuments: 1,
        transportHops: 1,
      },
      source: {
        provider: "federal_register",
        nativeDocumentNumber: "2021-54321",
        issuer: null,
        jurisdiction: "United States",
        role: "official structured record",
        documentType: "Federal Register publication representation",
        language: "en",
        legalVersionDates: [],
        acquisitionProvenance: "direct",
        accessStatus: "retained_passage",
        rightsStatus: "public-government-record",
        textQualityStatus:
          "visible-text parsed; bounded exact retained spans",
        inspectedText: "partial",
        focalPolicyReferenceStatus: "exact_identifier_found",
      },
    });
    expect(result.source?.retainedPassages[0]?.exactText).toContain(
      "2020-12345",
    );
    expect(result.source?.retainedPassages[0]?.focalPolicyAnchorKinds)
      .toContain("formal_identifier");
    expect(result.source?.retainedPassages[0]).toMatchObject({
      sourceId: "policy-lifecycle-source-adapter-success",
      documentVersionId: "policy-lifecycle-document-adapter-success",
      unresolvedCrossReferences: [],
    });
    expect(result.source?.sourceSnapshotFingerprint).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/u,
    );
  });

  it("retains a document without upgrading a missing focal-policy anchor", async () => {
    const result = await acquireScreen02PolicyLifecycleStageDocument({
      candidate: candidate(),
      confirmedShock: createBrowserEventCardFixture().state.confirmedShock!,
      coordinate: "adapter-no-anchor",
      fetch: async () => new Response(ownDocumentBody({
        includeFocalIdentifier: false,
      }), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      retrievedAt: "2026-09-14T13:00:02.000Z",
    });
    expect(result).toMatchObject({
      outcome: "document_retained",
      source: {
        focalPolicyReferenceStatus: "not_found_in_retained_passages",
      },
    });
    expect(result.source?.retainedPassages[0]?.qualification).toMatch(
      /does not establish/iu,
    );
  });

  it("caps many dispersed focal anchors inside the retained-passage budget", async () => {
    const confirmedShock = structuredClone(
      createBrowserEventCardFixture().state.confirmedShock!,
    );
    confirmedShock.formalIdentifiers = Array.from(
      { length: 20 },
      (_, index) => `FOCAL-${String(index + 1).padStart(2, "0")}`,
    );
    const paragraphs = confirmedShock.formalIdentifiers.map((identifier) =>
      `<p>${"bounded context ".repeat(115)}${identifier}</p>`).join("");
    const result = await acquireScreen02PolicyLifecycleStageDocument({
      candidate: candidate(),
      confirmedShock,
      coordinate: "adapter-many-anchors",
      fetch: async () => new Response(
        `<!doctype html><html><body><main>${paragraphs}<p>[FR Doc. 2021-54321 Filed 6-18-21; 8:45 am]</p></main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
      retrievedAt: "2026-09-14T13:00:02.000Z",
    });
    expect(result.outcome).toBe("document_retained");
    expect(result.source?.retainedPassages.length).toBeLessThanOrEqual(6);
    expect(result.source?.retainedPassages.every(({ exactText }) =>
      exactText.length <= 8_000)).toBe(true);
    expect(result.source?.retainedPassages.reduce(
      (total, { exactText }) => total + exactText.length,
      0,
    )).toBeLessThanOrEqual(24_000);
  });

  it.each([
    [
      "wrong document",
      () => new Response(ownDocumentBody({ documentNumber: "2021-99999" }), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      "wrong_document",
    ],
    [
      "source outage",
      () => new Response(null, { status: 503 }),
      "source_unavailable",
    ],
    [
      "unsupported media",
      () => new Response("%PDF fixture", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
      "unsupported_format",
    ],
  ])("records %s without retaining source text", async (
    _label,
    response,
    expected,
  ) => {
    const fetch = vi.fn(async (_request: RequestInfo | URL) => response());
    const result = await acquireScreen02PolicyLifecycleStageDocument({
      candidate: candidate(),
      confirmedShock: createBrowserEventCardFixture().state.confirmedShock!,
      coordinate: `adapter-${expected}`,
      fetch,
      retrievedAt: "2026-09-14T13:00:03.000Z",
    });
    expect(result.outcome).toBe(expected);
    expect(result.failureCode).toBe(expected);
    expect(result.source).toBeNull();
    expect(result.usage.usefulDocuments).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(
      expected === "source_unavailable" ? 2 : 1,
    );
    expect(result.usage.documentAttempts).toBe(
      expected === "source_unavailable" ? 2 : 1,
    );
  });
});
