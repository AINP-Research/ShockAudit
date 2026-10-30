import { describe, expect, it } from "vitest";

import {
  createEvidenceSnapshot,
  projectVisibleClaim,
  selectWorkingEvidencePacket,
  validateEvidenceCollection,
  type EvidenceCollection,
} from "../../src/core/six-screen/evidence";

const retainedText =
  "Covered hospitals must publish machine-readable pricing information. The requirement applies beginning January 1, 2021, subject to the definitions in paragraph (b).";

function collection(): EvidenceCollection {
  return {
    sources: [{
      id: "source-1",
      provider: "federal-register",
      nativeId: "2019-24931",
      canonicalUrl: "https://www.federalregister.gov/documents/2019/11/27/2019-24931/",
      publisher: "Federal Register",
      issuer: "Centers for Medicare & Medicaid Services",
      author: null,
      jurisdiction: "United States",
      role: "official structured record",
      documentType: "final rule",
      language: "en",
      publicationDate: "2019-11-27",
      legalVersionDates: [],
      retrievedAt: "2026-09-12T10:00:00.000Z",
      documentVersionId: "document-1",
      contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion: "federal-register-html-v1",
      textQualityStatus: "usable",
      inspectedText: "full",
    }],
    documentVersions: [{
      id: "document-1",
      sourceId: "source-1",
      representation: "html",
      language: "en",
      versionLabel: "published final rule",
      retrievedAt: "2026-09-12T10:00:00.000Z",
      contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      parserVersion: "federal-register-html-v1",
      parsedTextLength: retainedText.length,
    }],
    passages: [{
      id: "passage-1",
      sourceId: "source-1",
      documentVersionId: "document-1",
      locator: "§ 180.50(a)",
      exactText: retainedText,
      startOffset: 0,
      endOffset: retainedText.length,
      qualification: "Definitions in paragraph (b) remain part of the provision.",
      unresolvedCrossReferences: ["paragraph (b)"],
    }],
    claims: [{
      id: "claim-1",
      eventId: "event-1",
      predicate: "compliance_start",
      typedValue: {
        start: "2021-01-01",
        precision: "day",
        kind: "compliance",
      },
      statement: "The retained provision states a January 1, 2021 compliance start.",
      scope: "Covered hospitals, subject to incorporated definitions",
      supportingPassageIds: ["passage-1"],
      opposingPassageIds: [],
      supportStatus: "direct",
      reviewStatus: "unreviewed",
      criticalFor: ["screen-2-chronology"],
    }],
    conflicts: [],
    requirements: [{
      id: "requirement-1",
      kind: "temporal_stage",
      description: "Establish the compliance start separately from publication.",
      status: "supported",
      criticality: "critical",
      supportingClaimIds: ["claim-1"],
    }],
  };
}

describe("six-screen evidence invariant", () => {
  it("projects a visible fact through claim, passage, document version, and source", () => {
    const projected = projectVisibleClaim("claim-1", collection());
    expect(projected).toMatchObject({
      claimId: "claim-1",
      supportStatus: "direct",
      citations: [{
        passageId: "passage-1",
        documentVersionId: "document-1",
        sourceId: "source-1",
        sourceRole: "official structured record",
        inspectedText: "full",
      }],
    });
    expect(projected.citations[0]!.exactText).toContain("subject to the definitions");
  });

  it("validates exact retained text offsets when parsed text is available", () => {
    const current = collection();
    expect(validateEvidenceCollection(
      current,
      new Map([["document-1", retainedText]]),
    )).toBe(current);
    const changed = collection();
    changed.passages[0]!.exactText = "invented quotation";
    expect(() => validateEvidenceCollection(
      changed,
      new Map([["document-1", retainedText]]),
    )).toThrow(/does not match its stored text offsets/u);
  });

  it("rejects broken source/document bindings and fabricated passage references", () => {
    const brokenDocument = collection();
    brokenDocument.documentVersions[0]!.sourceId = "source-missing";
    expect(() => validateEvidenceCollection(brokenDocument)).toThrow(/document version|missing source/u);

    const brokenClaim = collection();
    brokenClaim.claims[0]!.supportingPassageIds = ["passage-missing"];
    expect(() => validateEvidenceCollection(brokenClaim)).toThrow(/missing passage/u);
  });

  it("requires support for direct claims and opposing evidence for conflicts", () => {
    const direct = collection();
    direct.claims[0]!.supportingPassageIds = [];
    expect(() => validateEvidenceCollection(direct)).toThrow(/requires a retained passage/u);

    const conflicting = collection();
    conflicting.claims[0]!.supportStatus = "conflicting";
    expect(() => validateEvidenceCollection(conflicting)).toThrow(/requires opposing evidence/u);
  });

  it("rejects credentials in retained locators", () => {
    const unsafe = collection();
    unsafe.sources[0]!.canonicalUrl =
      "https://api.example.gov/record/1?api_key=secret";
    expect(() => validateEvidenceCollection(unsafe)).toThrow(/must not contain credentials/u);
  });

  it("creates a deterministic immutable snapshot over all evidence identities", () => {
    const first = createEvidenceSnapshot({
      id: "evidence-1",
      revision: 1,
      eventId: "event-1",
      createdAt: "2026-09-12T10:00:01.000Z",
      collection: collection(),
    });
    const reordered = collection();
    const second = createEvidenceSnapshot({
      id: "evidence-1",
      revision: 1,
      eventId: "event-1",
      createdAt: "2026-09-12T10:00:01.000Z",
      collection: reordered,
    });
    expect(first.snapshotFingerprint).toBe(second.snapshotFingerprint);
    expect(first).toMatchObject({
      sourceIds: ["source-1"],
      documentVersionIds: ["document-1"],
      passageIds: ["passage-1"],
      claimIds: ["claim-1"],
    });
  });

  it("builds a bounded question-specific packet and refuses silent truncation", () => {
    const selected = selectWorkingEvidencePacket({
      allowedSourceIds: ["source-1"],
      requestedClaimIds: ["claim-1"],
      collection: collection(),
      maximumCharacters: 1_000,
    });
    expect(selected).toMatchObject({
      characterCount: retainedText.length,
      claims: [{ id: "claim-1" }],
      passages: [{ id: "passage-1" }],
    });
    expect(() => selectWorkingEvidencePacket({
      allowedSourceIds: ["source-1"],
      requestedClaimIds: ["claim-1"],
      collection: collection(),
      maximumCharacters: 20,
    })).toThrow(/split the question instead of truncating/u);
  });

  it("does not let a model packet cite a source outside the frozen allowlist", () => {
    expect(() => selectWorkingEvidencePacket({
      allowedSourceIds: [],
      requestedClaimIds: ["claim-1"],
      collection: collection(),
    })).toThrow(/disallowed source/u);
  });
});
