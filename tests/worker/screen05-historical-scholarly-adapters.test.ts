import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  createMechanismLiteratureExecution,
  createMechanismLiteratureExecutionPlan,
  createScholarlyEvidencePacket,
} from "../../src/core/six-screen/mechanism-literature-execution";
import { createMechanismLiteraturePlanInput } from
  "../../src/core/six-screen/mechanism-literature-plan";
import {
  SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
  buildScholarlyDocumentTargets,
  createScholarlyDocumentInspectionInput,
  createScholarlyDocumentInspectionPlan,
  createScholarlyPassagePacket,
  validateScholarlyDocumentAcquisition,
} from "../../src/core/six-screen/mechanism-scholarly-document";
import {
  createScholarlyClaimExtraction,
  createScholarlyClaimPacket,
  createScholarlyClaimReview,
  validateScholarlyClaimCollections,
  validateScholarlyClaimExtractionLineage,
} from "../../src/core/six-screen/mechanism-scholarly-claim-review";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import { acquireScholarlyDocumentPassage } from
  "../../src/worker/screen05-scholarly-document";
import {
  browserEventCardFixtureAt,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";
import { createHistoricalMechanismPlan } from
  "../fixtures/archived-legacy-screen5-plan";

const documentUrl = "https://journal.example.edu/articles/adaptation";
const quote = "Organizations revised their participation process after the rule.";
const at = browserEventCardFixtureAt;

function archivalDocumentContext(options: {
  accessBasis?: "not_confirmed" | "open_access";
  exactDocumentUrl?: string | null;
  inspectionMode?: "partial_text" | "abstract_only";
  permittedHosts?: readonly string[];
} = {}) {
  const fixture = createLockedBrowserEventCardFixture();
  const sources = buildSixScreenSourceRegister();
  const { plan: literaturePlan } = createHistoricalMechanismPlan(fixture.state, {
    snapshotId: "historical-scholar-literature-plan",
    planInput: createMechanismLiteraturePlanInput({
      explanation: { mode: "undecided", text: null },
      suppliedWorks: [{ id: "saved-exact-document", kind: "url", value: documentUrl }],
      preferredConstructs: [],
      feasibleDataSources: [],
      knownAlternativeAccounts: [],
    }),
    capabilities: { openalex: sources.openalex, crossref: sources.crossref },
    createdAt: at(30),
  });
  const executionPlan = createMechanismLiteratureExecutionPlan({
    id: "historical-scholar-execution-plan",
    literaturePlan,
    createdAt: at(31),
  });
  expect(executionPlan.steps.every((step) =>
    step.initialStatus !== "pending"
  )).toBe(true);
  const metadataExecution = createMechanismLiteratureExecution({
    snapshotId: "historical-scholar-metadata-execution",
    ordinal: 1,
    literaturePlan,
    executionPlan,
    previous: null,
    attempt: null,
    newMetadataRecordIds: [],
    recordedAt: at(32),
  });
  const metadataPacket = createScholarlyEvidencePacket({
    snapshotId: "historical-scholar-metadata-packet",
    ordinal: 1,
    literaturePlan,
    execution: metadataExecution,
    previous: null,
    records: [],
    createdAt: at(33),
  });
  const target = buildScholarlyDocumentTargets({
    literaturePlan,
    metadataRecords: [],
  })[0]!;
  const request = createScholarlyDocumentInspectionInput({
    targetId: target.id,
    exactDocumentUrl: options.exactDocumentUrl === undefined
      ? documentUrl : options.exactDocumentUrl,
    accessBasis: options.accessBasis ?? "open_access",
    inspectionMode: options.inspectionMode ?? "partial_text",
    exactPassage: quote,
    passagePurpose: "theoretical_proposition",
    qualification: "This is an adjacent institutional setting.",
  });
  const plan = createScholarlyDocumentInspectionPlan({
    id: "historical-scholar-document-plan",
    literaturePlan,
    metadataExecution,
    metadataPacket,
    metadataRecords: [],
    request,
    priorAcquisitions: [],
    permittedHosts: options.permittedHosts ?? ["journal.example.edu"],
    capabilityTested: true,
    createdAt: at(34),
  });
  const acquire = (fetch: typeof globalThis.fetch) =>
    acquireScholarlyDocumentPassage({
      acquisitionId: "historical-scholar-document-acquisition",
      coordinate: "archived-controlled-1",
      plan,
      fetch,
      now: () => at(35),
      monotonicNow: () => 0,
    });
  return { plan, metadataPacket, acquire };
}

describe("retired Screen 5 scholarly adapters with archival inputs", () => {
  it("requires explicit access and the exact configured URL before any fetch", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response("This request must not be made."));
    for (const [options, outcome] of [
      [{ accessBasis: "not_confirmed" as const }, "rights_not_confirmed"],
      [{ exactDocumentUrl: "https://journal.example.edu/articles/other" },
        "target_url_mismatch"],
      [{ permittedHosts: ["different.example.edu"] },
        "source_family_not_configured"],
    ] as const) {
      const { plan, acquire } = archivalDocumentContext(options);
      expect(plan.initialStatus).toBe(outcome);
      const result = await acquire(fetch);
      expect(result).toMatchObject({
        outcome,
        attemptedUrl: null,
        document: null,
        passage: null,
        usage: { documentAttempts: 0, transportHops: 0 },
      });
      expect(() => validateScholarlyDocumentAcquisition(result)).not.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never follows a redirect and rejects a streamed response over 512 KB", async () => {
    const { plan, acquire } = archivalDocumentContext();
    expect(plan.initialStatus).toBe("pending");
    const redirectFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://other.example.edu/private" },
      }));
    const redirect = await acquire(redirectFetch);
    expect(redirect).toMatchObject({
      outcome: "redirect_not_followed", document: null, passage: null,
      usage: { documentAttempts: 1, transportHops: 1 },
    });
    expect(redirectFetch).toHaveBeenCalledOnce();
    expect(redirectFetch.mock.calls[0]![0]).toBe(documentUrl);
    expect(redirectFetch.mock.calls[0]![1]).toMatchObject({
      redirect: "manual", credentials: "omit", cache: "no-store",
    });

    const cancel = vi.fn();
    const oversizedFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES));
          controller.enqueue(new Uint8Array([1]));
        },
        cancel,
      }), { headers: { "content-type": "text/plain" } }));
    const oversized = await acquire(oversizedFetch);
    expect(oversized).toMatchObject({
      outcome: "response_too_large", document: null, passage: null,
      usage: { documentAttempts: 1, usefulDocuments: 0 },
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(oversized.usage.receivedBytes).toBeLessThanOrEqual(
      SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
    );
  });

  it("retains one exact eligible passage without retaining full text; an abstract remains ineligible", async () => {
    const body = `A preliminary finding. ${quote} A distinct qualifying observation.`;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(body, { headers: { "content-type": "text/plain" } }));
    const { acquire } = archivalDocumentContext();
    const acquisition = await acquire(fetch);
    expect(acquisition.outcome).toBe("passage_retained");
    expect(acquisition.document).toMatchObject({
      canonicalUrl: documentUrl,
      fullTextRetained: false,
      access: { credentialForwarding: false, independentlyVerified: false },
    });
    expect(acquisition.passage).toMatchObject({
      exactText: quote,
      detailedClaimUse: "eligible_for_later_researcher_review",
      startOffset: body.indexOf(quote),
    });
    expect(JSON.stringify(acquisition)).not.toContain(body);
    const { acquire: acquireAbstract } = archivalDocumentContext({
      inspectionMode: "abstract_only",
    });
    const abstract = await acquireAbstract(fetch);
    expect(abstract.outcome).toBe("abstract_passage_retained");
    expect(abstract.passage?.detailedClaimUse).toBe("abstract_only_not_eligible");
    expect(abstract.passage?.qualification).toMatch(/cannot support a detailed/iu);
  });

  it("preserves passage lineage through an explicit researcher extraction and corrected review", async () => {
    const context = archivalDocumentContext();
    const acquisition = await context.acquire(vi.fn<typeof globalThis.fetch>(
      async () => new Response(`Before. ${quote} After.`, {
        headers: { "content-type": "text/plain" },
      }),
    ));
    const passagePacket = createScholarlyPassagePacket({
      snapshotId: "historical-scholar-passage-packet",
      metadataPacket: context.metadataPacket,
      acquisition,
      previous: null,
      acquisitions: [acquisition],
      createdAt: at(36),
    });
    const fields = {
      theoreticalProposition: "Organizations may adapt participation processes.",
      empiricalSetting: "An adjacent regulated market",
      levelOfAnalysis: "Organization",
      measuredVariables: ["documented participation process"],
      relevantResultOrQualification: "No focal-policy effect was estimated.",
      contextualFit: {
        assessment: "adjacent_setting" as const,
        rationale: "The study covers a different policy episode.",
      },
      evidenceLevel: "empirical_evidence_different_setting" as const,
    };
    expect(() => createScholarlyClaimExtraction({
      extractionId: "historical-scholar-forged-model-claim",
      passagePacket, acquisition, priorExtractions: [], fields,
      actor: "model", extractedAt: at(37),
    })).toThrow(/Only an explicit researcher/iu);
    const extraction = createScholarlyClaimExtraction({
      extractionId: "historical-scholar-extraction",
      passagePacket, acquisition, priorExtractions: [], fields,
      actor: "researcher_ui", extractedAt: at(37),
    });
    const corrected = createScholarlyClaimReview({
      reviewId: "historical-scholar-corrected-review",
      extraction, priorReviews: [],
      decision: { mode: "corrected", correction: {
        ...fields,
        relevantResultOrQualification:
          "The cited passage describes an adaptation; no outcome effect was estimated.",
      } },
      rationale: "The original wording overstated the source.",
      actor: "researcher_ui", reviewedAt: at(38),
    });
    const extractionPacket = createScholarlyClaimPacket({
      snapshotId: "historical-scholar-extraction-packet",
      passagePacket, previous: null,
      changeReference: { kind: "claim_extracted", id: extraction.id,
        fingerprint: extraction.extractionFingerprint },
      extractions: [extraction], reviews: [], createdAt: at(37),
    });
    const reviewPacket = createScholarlyClaimPacket({
      snapshotId: "historical-scholar-review-packet",
      passagePacket, previous: extractionPacket,
      changeReference: { kind: "claim_reviewed", id: corrected.id,
        fingerprint: corrected.reviewFingerprint },
      extractions: [extraction], reviews: [corrected], createdAt: at(38),
    });
    expect(reviewPacket).toMatchObject({
      detailedClaims: { acceptedCount: 1 },
      mechanismGeneration: { status: "blocked" },
      mechanismCandidates: [],
      predictionMatrix: null,
    });
    expect(corrected).toMatchObject({
      sourceEvidenceMutation: "none", mechanismMutation: "none",
      acceptedForLaterSynthesis: true,
    });
    expect(() => validateScholarlyClaimCollections({
      acquisitions: [acquisition], passagePackets: [passagePacket],
      extractions: [extraction], reviews: [corrected],
      claimPackets: [extractionPacket, reviewPacket],
    })).not.toThrow();
    const tampered = structuredClone(extraction);
    tampered.acquisitionReference.acquisitionId =
      "historical-scholar-unrelated-acquisition";
    const { extractionFingerprint: _fingerprint, ...body } = tampered;
    tampered.extractionFingerprint = fingerprintSixScreenValue(body);
    expect(() => validateScholarlyClaimExtractionLineage(
      tampered, passagePacket, acquisition,
    )).toThrow(/source lineage/iu);
  });
});
