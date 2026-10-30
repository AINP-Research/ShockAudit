import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  createEvidenceSnapshot,
  type EvidenceCollection,
} from "../../src/core/six-screen/evidence";
import {
  createPolicyChronologySourcePanel,
  createPolicyChronologySourcePanelForSavedReview,
  validatePolicyChronologySourcePanel,
} from "../../src/core/six-screen/policy-chronology";
import {
  parseEcfrHistoricalPolicyEvidence,
  parseFederalRegisterHistoricalFallbackEvidence,
} from "../../src/core/six-screen/policy-history";
import {
  mergePolicyEvidenceCollections,
  parseFederalRegisterPolicyEvidence,
} from "../../src/core/six-screen/policy-review";

const eventId = "identity-order-841";
const identityFingerprint = fingerprintSixScreenValue({
  eventId,
  documentNumber: "2018-03708",
});
const retrievedAt = "2026-09-12T10:00:00.000Z";
const federalRegisterUrl =
  "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
const legalEditionUrl =
  "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf";

const publishedText = [
  "The Commission requires each regional transmission organization and independent system operator to establish tariff provisions providing a participation model for electric storage resources.",
  "This final rule is effective June 4, 2018.",
  "Each regional transmission organization and independent system operator must submit a compliance filing within 270 days of publication.",
  "They have a further 365 days from that date to implement the tariff changes.",
  "The requirements apply to regional transmission organizations and independent system operators that operate wholesale capacity, energy, or ancillary services markets.",
  "The rule does not exempt small electric storage resources from the participation requirement.",
].join(" ");

function partXml(paragraphs: string[]) {
  return [
    "<?xml version=\"1.0\"?>",
    "<DIV5 N=\"35\" TYPE=\"PART\">",
    "<HEAD>PART 35 - FILING OF RATE SCHEDULES AND TARIFFS</HEAD>",
    "<DIV8 N=\"35.28\" TYPE=\"SECTION\">",
    "<HEAD>35.28 Non-discriminatory open access transmission tariff.</HEAD>",
    ...paragraphs.map((value) => "<P>" + value + "</P>"),
    "</DIV8>",
    "</DIV5>",
  ].join("");
}

function comprehensiveCollection() {
  const common = {
    eventId,
    documentNumber: "2018-03708",
    canonicalUrl: federalRegisterUrl,
    title:
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    issuer: "Federal Energy Regulatory Commission",
    publicationDate: "2018-03-06",
    retrievedAt,
    contentHash: "sha256:" + "a".repeat(64),
    representation: "html" as const,
    parsedText: publishedText,
    legalEditionUrl,
  };
  const core = parseFederalRegisterPolicyEvidence({
    ...common,
    focus: "core",
  });
  const coverage = parseFederalRegisterPolicyEvidence({
    ...common,
    focus: "coverage_exemptions",
  });
  const published = mergePolicyEvidenceCollections({
    previous: core.collection,
    next: coverage.collection,
    searchedKinds: ["coverage", "exemption"],
  });
  const history = parseEcfrHistoricalPolicyEvidence({
    eventId,
    documentNumber: "2018-03708",
    policyTitle: common.title,
    issuer: common.issuer,
    retrievedAt,
    cfrTitle: "18",
    cfrPart: "35",
    baselineDate: "2018-06-03",
    legalEffectDate: "2018-06-04",
    effectiveSnapshotDate: "2018-06-04",
    baselineUrl:
      "https://www.ecfr.gov/api/versioner/v1/full/2018-06-03/title-18.xml?part=35",
    effectiveUrl:
      "https://www.ecfr.gov/api/versioner/v1/full/2018-06-04/title-18.xml?part=35",
    versionMetadataUrl:
      "https://www.ecfr.gov/api/versioner/v1/versions/title-18.json?part=35&issue_date%5Bgte%5D=2018-06-03&issue_date%5Blte%5D=2018-06-11",
    versionMetadataContentHash: "sha256:" + "d".repeat(64),
    versionMetadataJsonLength: 512,
    versionRecords: [{
      date: "2018-06-04",
      amendmentDate: "2018-06-04",
      issueDate: "2018-06-04",
      identifier: "35.28",
      name: "§ 35.28 Non-discriminatory open access transmission tariff.",
      part: "35",
      subpart: null,
      title: "18",
      type: "section",
      substantive: true,
      removed: false,
    }],
    baselineContentHash: "sha256:" + "b".repeat(64),
    effectiveContentHash: "sha256:" + "c".repeat(64),
    baselineXml: partXml([
      "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
    ]),
    effectiveXml: partXml([
      "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
      "(9) Electric storage resources. Each Commission-approved independent system operator and regional transmission organization must have tariff provisions providing a participation model for electric storage resources.",
    ]),
  });
  return mergePolicyEvidenceCollections({
    previous: published,
    next: history.collection,
    searchedKinds: ["previous_baseline", "version"],
  });
}

function snapshot(collection: EvidenceCollection, id = "evidence-order-841-r3") {
  return createEvidenceSnapshot({
    id,
    revision: 3,
    eventId,
    createdAt: "2026-09-12T10:00:01.000Z",
    collection,
  });
}

function conflictCollection(): EvidenceCollection {
  const dates = ["2020-01-01", "2020-02-01"];
  return {
    sources: dates.map((date, index) => ({
      id: "source-conflict-" + (index + 1),
      provider: "official-fixture-" + (index + 1),
      nativeId: "record-" + (index + 1),
      canonicalUrl: "https://example.gov/record/" + (index + 1),
      publisher: "Official publisher " + (index + 1),
      issuer: "Example agency",
      author: null,
      jurisdiction: "United States",
      role: index === 0 ? "controlling legal text" : "official implementation record",
      documentType: "official record",
      language: "en",
      publicationDate: null,
      legalVersionDates: [],
      retrievedAt,
      documentVersionId: "document-conflict-" + (index + 1),
      contentHash: "sha256:" + String(index + 1).repeat(64),
      acquisitionProvenance: "direct" as const,
      accessStatus: "retained_passage" as const,
      rightsStatus: "public-government-record",
      parserVersion: "fixture-v1",
      textQualityStatus: "usable",
      inspectedText: "full" as const,
    })),
    documentVersions: dates.map((_, index) => ({
      id: "document-conflict-" + (index + 1),
      sourceId: "source-conflict-" + (index + 1),
      representation: "html",
      language: "en",
      versionLabel: "version " + (index + 1),
      retrievedAt,
      contentHash: "sha256:" + String(index + 1).repeat(64),
      parserVersion: "fixture-v1",
      parsedTextLength: 50,
    })),
    passages: dates.map((date, index) => ({
      id: "passage-conflict-" + (index + 1),
      sourceId: "source-conflict-" + (index + 1),
      documentVersionId: "document-conflict-" + (index + 1),
      locator: "Dates",
      exactText: "The rule is effective " + date + ".",
      startOffset: null,
      endOffset: null,
      qualification: "The sources state different legal-effective dates.",
      unresolvedCrossReferences: [],
    })),
    claims: dates.map((date, index) => ({
      id: "claim-conflict-" + (index + 1),
      eventId,
      predicate: "legal_effect_date",
      typedValue: { date, stage: "legal_effect" },
      statement: "The rule is effective " + date + ".",
      scope: "Confirmed policy episode",
      supportingPassageIds: ["passage-conflict-" + (index + 1)],
      opposingPassageIds: ["passage-conflict-" + (index === 0 ? 2 : 1)],
      supportStatus: "conflicting" as const,
      reviewStatus: "unreviewed" as const,
      criticalFor: ["screen-2-chronology"],
    })),
    conflicts: [{
      id: "conflict-effective-date",
      eventId,
      predicate: "legal_effect_date",
      claimIds: ["claim-conflict-1", "claim-conflict-2"],
      competingValues: dates.map((date) => ({ date })),
      scopes: ["Confirmed policy episode", "Confirmed policy episode"],
      sourceRoles: ["controlling legal text", "official implementation record"],
      kind: "substantive",
      resolution: null,
      reviewStatus: "unreviewed",
    }],
    requirements: [{
      id: "requirement-effective-date",
      kind: "temporal_stage",
      description: "Resolve the competing legal-effective dates.",
      status: "conflicting",
      criticality: "critical",
      supportingClaimIds: ["claim-conflict-1", "claim-conflict-2"],
    }],
  };
}

describe("deterministic policy chronology and source panel", () => {
  it("separates policy clocks without selecting or inventing a treatment date", () => {
    const collection = comprehensiveCollection();
    const projection = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: snapshot(collection),
      collection,
    });

    expect(projection).toMatchObject({
      binding: {
        eventId,
        identityFingerprint,
        evidenceSnapshotId: "evidence-order-841-r3",
      },
      chronology: {
        absoluteClocks: [
          {
            stage: "publication",
            timing: {
              mode: "absolute",
              start: "2018-03-06",
              precision: "day",
            },
          },
          {
            stage: "legal_effect",
            timing: {
              mode: "absolute",
              start: "2018-06-04",
              precision: "day",
            },
          },
        ],
        relativeClocks: [
          {
            stage: "compliance_filing",
            timing: {
              mode: "relative",
              anchorStage: "publication",
              offsetDays: 270,
              calendarDate: null,
            },
          },
          {
            stage: "implementation",
            timing: {
              mode: "relative",
              anchorStage: "compliance_filing",
              offsetDays: 365,
              calendarDate: null,
            },
          },
        ],
        undatedClocks: [],
      },
      treatmentClockReview: {
        status: "researcher_review_required",
        selectedCandidateId: null,
        selectionOwner: "researcher",
      },
      unresolvedRequirements: [
        expect.objectContaining({
          kind: "enforcement",
          status: "not_yet_searched",
        }),
        expect.objectContaining({
          kind: "penalty",
          status: "not_yet_searched",
        }),
      ],
      interpretationGate: {
        coherentOverview: null,
        consequentialSemanticReview: null,
        reviewedEventCard: null,
        status: "blocked",
        reason: "genuine_intelligence_path_unverified",
      },
    });
    expect(projection.treatmentClockReview.candidates).toHaveLength(4);
    expect(projection.treatmentClockReview.candidates.every(
      ({ selected, status }) => !selected && status === "unreviewed",
    )).toBe(true);

    const filing = projection.chronology.relativeClocks[0]!;
    const implementation = projection.chronology.relativeClocks[1]!;
    expect(implementation.timing).toMatchObject({
      anchorClockId: filing.id,
    });
    expect(JSON.stringify(projection)).not.toContain("2018-12-01");
    expect(JSON.stringify(projection)).not.toContain("2019-12-01");
  });

  it("preserves claim-to-passage-to-version-to-source lineage and source roles", () => {
    const collection = comprehensiveCollection();
    const currentSnapshot = snapshot(collection);
    const projection = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection,
    });

    const legalEffect = projection.chronology.absoluteClocks.find(
      ({ stage }) => stage === "legal_effect",
    )!;
    const claimLineage = legalEffect.lineages.find(
      ({ evidenceKind, direction }) =>
        evidenceKind === "claim_passage" && direction === "supporting",
    )!;
    const source = projection.sourcePanel.sources.find(
      ({ sourceId }) => sourceId === claimLineage.sourceId,
    )!;
    const document = source.documentVersions.find(
      ({ documentVersionId }) =>
        documentVersionId === claimLineage.documentVersionId,
    );
    const passage = source.passages.find(
      ({ passageId }) => passageId === claimLineage.passageId,
    );
    const claim = source.claims.find(
      ({ claimId }) => claimId === claimLineage.claimId,
    );
    expect({ source, document, passage, claim }).toMatchObject({
      source: {
        role: expect.stringContaining("Federal Register"),
        inspectedText: "full",
      },
      document: {
        versionLabel: expect.stringContaining("Published representation"),
      },
      passage: {
        qualification: expect.stringContaining(
          "does not establish when every regulated market implemented",
        ),
      },
      claim: {
        predicate: "legal_effect_date",
      },
    });

    const govInfo = projection.sourcePanel.sources.find(
      ({ provider }) => provider === "govinfo",
    );
    expect(govInfo).toMatchObject({
      role: expect.stringContaining("controlling Federal Register legal-edition locator"),
      inspectedText: "metadata_only",
      accessStatus: "available_metadata",
      passages: [],
      claims: [],
    });
    expect(projection.sourcePanel.sources.filter(
      ({ provider }) => provider === "ecfr",
    )).toHaveLength(3);
    expect(projection.sourcePanel.sources).toContainEqual(
      expect.objectContaining({
        provider: "ecfr",
        inspectedText: "metadata_only",
        passages: [],
      }),
    );
  });

  it("is order-independent, immutable, fingerprinted, and validates its binding", () => {
    const collection = comprehensiveCollection();
    const currentSnapshot = snapshot(collection);
    const first = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection,
    });
    expect(createPolicyChronologySourcePanelForSavedReview({
      review: {
        identityFingerprint,
        evidenceSnapshotId: currentSnapshot.id,
        evidenceSnapshotFingerprint: currentSnapshot.snapshotFingerprint,
      },
      snapshot: currentSnapshot,
      collection,
    })).toEqual(first);
    const reordered: EvidenceCollection = {
      sources: [...collection.sources].reverse(),
      documentVersions: [...collection.documentVersions].reverse(),
      passages: [...collection.passages].reverse(),
      claims: [...collection.claims].reverse(),
      conflicts: [...collection.conflicts].reverse(),
      requirements: [...collection.requirements].reverse(),
    };
    const reorderedSnapshot = snapshot(reordered);
    const second = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: reorderedSnapshot,
      collection: reordered,
    });

    expect(second).toEqual(first);
    expect(first.binding.evidenceSnapshotFingerprint).toBe(
      currentSnapshot.snapshotFingerprint,
    );
    expect(first.binding.evidenceCollectionFingerprint).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/u,
    );
    expect(first.projectionFingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(validatePolicyChronologySourcePanel({
      projection: second,
      identityFingerprint,
      snapshot: reorderedSnapshot,
      collection: reordered,
    })).toBe(second);
    expect(() => createPolicyChronologySourcePanelForSavedReview({
      review: {
        identityFingerprint,
        evidenceSnapshotId: currentSnapshot.id,
        evidenceSnapshotFingerprint: fingerprintSixScreenValue("wrong snapshot"),
      },
      snapshot: currentSnapshot,
      collection,
    })).toThrow(/does not name the supplied immutable evidence snapshot/u);

    const retainedRole = first.sourcePanel.sources[0]!.role;
    collection.sources[0]!.role = "mutated after projection";
    expect(first.sourcePanel.sources[0]!.role).toBe(retainedRole);

    const tampered = structuredClone(first);
    tampered.sourcePanel.sources[0]!.role = "silently upgraded authority";
    expect(() => validatePolicyChronologySourcePanel({
      projection: tampered,
      identityFingerprint,
      snapshot: reorderedSnapshot,
      collection: reordered,
    })).toThrow(/does not match its immutable evidence binding/u);
  });

  it("keeps conflicting dates separate and visible instead of collapsing stages", () => {
    const collection = conflictCollection();
    const currentSnapshot = snapshot(collection, "evidence-conflicting-dates");
    const projection = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection,
    });

    expect(projection.chronology.absoluteClocks.map(({ timing }) =>
      timing.mode === "absolute" ? timing.start : null
    )).toEqual(["2020-01-01", "2020-02-01"]);
    expect(projection.chronology.absoluteClocks.every(
      ({ conflictIds, hasUnresolvedConflict }) =>
        hasUnresolvedConflict &&
        conflictIds.includes("conflict-effective-date"),
    )).toBe(true);
    expect(projection.conflicts).toEqual([
      expect.objectContaining({
        id: "conflict-effective-date",
        resolution: null,
      }),
    ]);
    expect(projection.unresolvedRequirements).toEqual([
      expect.objectContaining({
        requirementId: "requirement-effective-date",
        status: "conflicting",
      }),
    ]);
    expect(projection.sourcePanel.sources.every(
      ({ conflictIds }) => conflictIds.includes("conflict-effective-date"),
    )).toBe(true);
  });

  it("preserves an unstated relative anchor instead of attaching it to publication", () => {
    const parsed = parseFederalRegisterPolicyEvidence({
      eventId,
      documentNumber: "2018-03708",
      canonicalUrl: federalRegisterUrl,
      title: "Electric Storage Participation",
      issuer: "Federal Energy Regulatory Commission",
      publicationDate: "2018-03-06",
      retrievedAt,
      contentHash: "sha256:" + "e".repeat(64),
      representation: "html",
      parsedText: [
        "The Commission requires market operators to establish tariff requirements for electric storage resources.",
        "The rule is effective June 4, 2018.",
        "Market operators implement the tariff requirements within 90 days.",
      ].join(" "),
      focus: "core",
    });
    const currentSnapshot = snapshot(
      parsed.collection,
      "evidence-relative-unknown-anchor",
    );
    const projection = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection: parsed.collection,
    });

    expect(projection.chronology.relativeClocks).toEqual([
      expect.objectContaining({
        stage: "implementation",
        timing: expect.objectContaining({
          mode: "relative",
          anchorStage: null,
          anchorClockId: null,
          offsetDays: 90,
          calendarDate: null,
        }),
      }),
    ]);
  });

  it("rejects claim content bound to a different event even when ids still match", () => {
    const collection = comprehensiveCollection();
    collection.claims[0]!.eventId = "identity-different-policy";
    const currentSnapshot = snapshot(
      collection,
      "evidence-wrong-event-binding",
    );
    expect(() => createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection,
    })).toThrow(/does not match the immutable evidence event/u);

    const conflicting = conflictCollection();
    conflicting.conflicts[0]!.eventId = "identity-different-policy";
    expect(() => createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: snapshot(conflicting, "evidence-wrong-conflict-binding"),
      collection: conflicting,
    })).toThrow(/conflict .* does not match the immutable evidence event/u);
  });

  it("does not promote a bounded amendatory fallback into a codified or legal clock", () => {
    const parsed = parseFederalRegisterHistoricalFallbackEvidence({
      eventId,
      documentNumber: "2018-03708",
      issuer: "Federal Energy Regulatory Commission",
      publicationDate: "2018-03-06",
      legalEffectDate: "2018-06-04",
      retrievedAt,
      canonicalUrl: federalRegisterUrl,
      contentHash: "sha256:" + "d".repeat(64),
      representation: "html",
      parsedText:
        "18 CFR Part 35. Amend § 35.28 by adding paragraph (b)(9) to read as follows:",
      cfrCoordinates: [{ title: "18", part: "35" }],
      reason: "historical_date_unavailable",
    });
    if (!parsed) throw new Error("Expected historical fallback evidence.");
    const currentSnapshot = snapshot(
      parsed.collection,
      "evidence-order-841-fallback",
    );
    const projection = createPolicyChronologySourcePanel({
      identityFingerprint,
      snapshot: currentSnapshot,
      collection: parsed.collection,
    });

    expect(projection.chronology.absoluteClocks.map(({ stage }) => stage))
      .toEqual(["publication"]);
    expect(projection.chronology.relativeClocks).toEqual([]);
    expect(projection.chronology.undatedClocks).toEqual([]);
    expect(projection.unresolvedRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "previous_baseline",
          status: "inaccessible",
        }),
        expect.objectContaining({
          kind: "version",
          status: "inaccessible",
        }),
      ]),
    );
    expect(JSON.stringify(projection.chronology)).not.toContain(
      "2018-06-04",
    );
    expect(projection.sourcePanel.sources[0]).toMatchObject({
      role: expect.stringContaining("not the controlling Federal Register legal edition"),
      inspectedText: "full",
    });
  });
});
