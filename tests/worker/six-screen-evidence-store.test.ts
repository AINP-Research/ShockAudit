import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createEvidenceSnapshot, type EvidenceCollection } from
  "../../src/core/six-screen/evidence";
import { createPolicyChronologySourcePanel } from
  "../../src/core/six-screen/policy-chronology";
import {
  parseEcfrHistoricalPolicyEvidence,
  parseFederalRegisterHistoricalFallbackEvidence,
} from
  "../../src/core/six-screen/policy-history";
import {
  SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES,
  SixScreenEvidenceCapacityError,
  SixScreenEvidenceStore,
} from "../../src/worker/six-screen-evidence-store";
import { InMemorySixScreenWorkflowStorage } from
  "../../src/worker/six-screen-workflow-store";

const runId = `sa6r_${"e".repeat(43)}`;
const accessToken = `sa6a_${"b".repeat(43)}`;

function collection(count = 24, passageLength = 5_000): EvidenceCollection {
  const current: EvidenceCollection = {
    sources: [],
    documentVersions: [],
    passages: [],
    claims: [],
    conflicts: [],
    requirements: [],
  };
  for (let index = 0; index < count; index += 1) {
    const suffix = index.toString().padStart(2, "0");
    const sourceId = `source-${suffix}`;
    const documentVersionId = `document-${suffix}`;
    const passageId = `passage-${suffix}`;
    const claimId = `claim-${suffix}`;
    current.sources.push({
      id: sourceId,
      provider: "federal-register",
      nativeId: `2019-${10_000 + index}`,
      canonicalUrl: `https://www.federalregister.gov/documents/2019/01/01/2019-${10_000 + index}/fixture`,
      publisher: "Federal Register",
      issuer: "Fixture agency",
      author: null,
      jurisdiction: "United States",
      role: index === 0 ? "controlling legal text" : "official structured record",
      documentType: "final rule",
      language: "en",
      publicationDate: "2019-01-01",
      legalVersionDates: [{
        start: "2020-01-01",
        end: null,
        precision: "day",
        kind: index === 0 ? "amendment" : "publication",
        passageIds: [passageId],
      }],
      retrievedAt: "2026-09-12T10:00:00.000Z",
      documentVersionId,
      contentHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion: "fixture-parser-v1",
      textQualityStatus: "usable",
      inspectedText: "full",
    });
    current.documentVersions.push({
      id: documentVersionId,
      sourceId,
      representation: "html",
      language: "en",
      versionLabel: index === 0 ? "historical amendment version" : "published version",
      retrievedAt: "2026-09-12T10:00:00.000Z",
      contentHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      parserVersion: "fixture-parser-v1",
      parsedTextLength: passageLength,
    });
    current.passages.push({
      id: passageId,
      sourceId,
      documentVersionId,
      locator: `§ ${index + 1}`,
      exactText: `${suffix}:${"x".repeat(Math.max(1, passageLength - 3))}`,
      startOffset: 0,
      endOffset: passageLength,
      qualification: index === 0 ? "Subject to the retained exemption schedule." : null,
      unresolvedCrossReferences: index === 0 ? ["Schedule A"] : [],
    });
    current.claims.push({
      id: claimId,
      eventId: "event-1",
      predicate: `fixture_fact_${suffix}`,
      typedValue: suffix,
      statement: `Fixture fact ${suffix}.`,
      scope: "Fixture scope",
      supportingPassageIds: [passageId],
      opposingPassageIds: [],
      supportStatus: "direct",
      reviewStatus: "unreviewed",
      criticalFor: ["screen-2"],
    });
    current.requirements.push({
      id: `requirement-${suffix}`,
      kind: index === 0 ? "exemption" : "other",
      description: `Verify fixture fact ${suffix}.`,
      status: "supported",
      criticality: index === 0 ? "critical" : "contextual",
      supportingClaimIds: [claimId],
    });
  }
  return current;
}

function snapshot(current: EvidenceCollection) {
  return createEvidenceSnapshot({
    id: "evidence-large-1",
    revision: 1,
    eventId: "event-1",
    createdAt: "2026-09-12T10:00:00.000Z",
    collection: current,
  });
}

describe("chunked six-screen evidence store", () => {
  it("retains a limited Federal Register historical fallback across restart and replay", async () => {
    const instruction =
      "Amend \u00a7 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:";
    const parsed = parseFederalRegisterHistoricalFallbackEvidence({
      eventId: "identity-order-841",
      documentNumber: "2018-03708",
      issuer: "Federal Energy Regulatory Commission",
      publicationDate: "2018-03-06",
      legalEffectDate: "2018-06-04",
      retrievedAt: "2026-09-12T10:00:00.000Z",
      canonicalUrl:
        "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
      contentHash: `sha256:${"d".repeat(64)}`,
      representation: "html",
      parsedText: `18 CFR Part 35. 2. ${instruction}`,
      cfrCoordinates: [{ title: "18", part: "35" }],
      reason: "historical_date_unavailable",
    });
    if (!parsed) throw new Error("Expected a retained historical fallback fixture.");
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenEvidenceStore(storage);
    const evidenceSnapshot = createEvidenceSnapshot({
      id: "evidence-order-841-fallback-r3",
      revision: 3,
      eventId: "identity-order-841",
      createdAt: "2026-09-12T10:00:01.000Z",
      collection: parsed.collection,
    });
    const input = {
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: parsed.collection,
      expiresAt: "2026-09-13T10:00:00.000Z",
    };
    const chronologyBeforeRestart = createPolicyChronologySourcePanel({
      identityFingerprint: fingerprintSixScreenValue("identity-order-841"),
      snapshot: evidenceSnapshot,
      collection: parsed.collection,
    });
    expect((await store.create(input)).outcome).toBe("created");

    const resumed = new SixScreenEvidenceStore(storage);
    const read = await resumed.read({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    });
    expect(read).toMatchObject({
      outcome: "found",
      collection: {
        sources: [{
          role: expect.stringContaining("codified historical CFR version"),
        }],
        documentVersions: [{
          versionLabel: expect.stringContaining("not a codified CFR edition"),
        }],
        passages: [{
          exactText: instruction,
          qualification: expect.stringContaining(
            "does not establish the immediately preceding codified text",
          ),
        }],
        claims: [{
          predicate: "contemporaneous_amendment_record",
          typedValue: expect.objectContaining({
            historicalVersionEstablished: false,
            legalEditionEstablished: false,
          }),
        }],
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: "previous_baseline",
            status: "inaccessible",
          }),
          expect.objectContaining({ kind: "version", status: "inaccessible" }),
        ]),
      },
    });
    if (read.outcome !== "found") {
      throw new Error("Expected retained fallback evidence after restart.");
    }
    const chronologyAfterRestart = createPolicyChronologySourcePanel({
      identityFingerprint: fingerprintSixScreenValue("identity-order-841"),
      snapshot: read.manifest.snapshot,
      collection: read.collection,
    });
    expect(chronologyAfterRestart).toEqual(chronologyBeforeRestart);
    expect(
      chronologyAfterRestart.binding.evidenceCollectionFingerprint,
    ).toBe(read.manifest.collectionFingerprint);
    const claimId = parsed.collection.claims[0]!.id;
    expect(await resumed.readVisibleClaim({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    }, claimId)).toMatchObject({
      outcome: "found",
      claim: {
        statement: expect.stringContaining("Contemporaneous amendatory instruction"),
        citations: [{ exactText: instruction }],
      },
    });
    expect((await resumed.create(input)).outcome).toBe("replayed");
  });

  it("immutably round-trips an annual CFR baseline with its immediate eCFR boundary", async () => {
    const boundary =
      "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.";
    const addition =
      "(9) Electric storage resources. Each market operator must provide a participation model for electric storage resources in its tariff.";
    const ecfrXml = (paragraphs: string[]) => `<?xml version="1.0"?>
      <DIV5 N="35" TYPE="PART">
        <DIV8 N="35.28" TYPE="SECTION">
          ${paragraphs.map((value) => `<P>${value}</P>`).join("\n")}
        </DIV8>
      </DIV5>`;
    const annualXmlUrl =
      "https://api.govinfo.gov/packages/CFR-2018-title18-vol1/granules/CFR-2018-title18-vol1-sec35-28/xml";
    const parsed = parseEcfrHistoricalPolicyEvidence({
      eventId: "identity-order-841",
      documentNumber: "2018-03708",
      policyTitle: "Electric Storage Participation Model",
      issuer: "Federal Energy Regulatory Commission",
      retrievedAt: "2026-09-12T10:00:00.000Z",
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
      versionMetadataContentHash: `sha256:${"c".repeat(64)}`,
      versionMetadataJsonLength: 512,
      versionRecords: [{
        date: "2018-06-04",
        amendmentDate: "2018-06-04",
        issueDate: "2018-06-04",
        identifier: "35.28",
        name: "§ 35.28 Open access transmission tariff.",
        part: "35",
        subpart: null,
        title: "18",
        type: "section",
        substantive: true,
        removed: false,
      }],
      baselineContentHash: `sha256:${"a".repeat(64)}`,
      effectiveContentHash: `sha256:${"b".repeat(64)}`,
      baselineXml: ecfrXml([boundary]),
      effectiveXml: ecfrXml([boundary, addition]),
      annualBaseline: {
        annualEditionDate: "2018-04-01",
        section: "35.28",
        packageId: "CFR-2018-title18-vol1",
        granuleId: "CFR-2018-title18-vol1-sec35-28",
        searchUrl: "https://api.govinfo.gov/search",
        searchQuery:
          "collection:(CFR) cfrtitlenum:18 cfrpartnum:35 cfrsectionnum:35.28 publishdate:2018-04-01",
        searchResponseContentHash: `sha256:${"d".repeat(64)}`,
        searchResponseJsonLength: 640,
        xmlUrl: annualXmlUrl,
        xmlContentHash: `sha256:${"e".repeat(64)}`,
        xml: `<?xml version="1.0"?><CFRGRANULE>
          <CFRTITLE>18</CFRTITLE><DATE>2018-04-01</DATE>
          <GRANULENUM>§ 35.28</GRANULENUM>
          <ANCESTORS><ANCESTOR LEVEL="part" IDENTIFIER="35">Part 35</ANCESTOR></ANCESTORS>
          <SECTION><SECTNO>§ 35.28</SECTNO><P>${boundary}</P></SECTION>
        </CFRGRANULE>`,
      },
    });
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenEvidenceStore(storage);
    const evidenceSnapshot = createEvidenceSnapshot({
      id: "evidence-order-841-annual-cfr-r4",
      revision: 4,
      eventId: "identity-order-841",
      createdAt: "2026-09-12T10:00:01.000Z",
      collection: parsed.collection,
    });
    const createInput = {
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: parsed.collection,
      expiresAt: "2026-09-13T10:00:00.000Z",
    };
    expect((await store.create(createInput)).outcome).toBe("created");

    const resumed = new SixScreenEvidenceStore(storage);
    const read = await resumed.read({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    });
    expect(read).toMatchObject({
      outcome: "found",
      collection: {
        sources: expect.arrayContaining([
          expect.objectContaining({
            canonicalUrl: "https://api.govinfo.gov/search",
            inspectedText: "metadata_only",
            contentHash: `sha256:${"d".repeat(64)}`,
          }),
          expect.objectContaining({
            canonicalUrl: annualXmlUrl,
            documentType: "annual CFR edition",
            inspectedText: "full",
            contentHash: `sha256:${"e".repeat(64)}`,
          }),
        ]),
        documentVersions: expect.arrayContaining([
          expect.objectContaining({ representation: "govinfo-search-json" }),
          expect.objectContaining({
            representation: "govinfo-annual-cfr-granule-xml",
          }),
        ]),
      },
    });
    const baselineClaim = parsed.collection.claims.find(
      ({ predicate }) => predicate === "previous_baseline",
    )!;
    expect(await resumed.readVisibleClaim({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    }, baselineClaim.id)).toMatchObject({
      outcome: "found",
      claim: {
        citations: [
          expect.objectContaining({ canonicalUrl: annualXmlUrl }),
          expect.objectContaining({
            canonicalUrl: expect.stringContaining("2018-06-03"),
          }),
        ],
      },
    });
    expect((await resumed.create(createInput)).outcome).toBe("replayed");
  });

  it("round-trips a multi-chunk collection without losing roles, versions, or qualifications", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenEvidenceStore(storage);
    const current = collection();
    const evidenceSnapshot = snapshot(current);
    const created = await store.create({
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: current,
      expiresAt: "2026-09-13T10:00:00.000Z",
    });
    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") throw new Error("Expected evidence create.");
    expect(created.manifest.chunkKeys.length).toBeGreaterThan(1);
    expect(created.manifest.counts).toMatchObject({
      sources: 24,
      documentVersions: 24,
      passages: 24,
      claims: 24,
      requirements: 24,
    });
    expect(JSON.stringify([...storage.values.values()])).not.toContain(accessToken);

    // A fresh store instance models a Worker restart between checkpoint write
    // and resume.
    const resumedStore = new SixScreenEvidenceStore(storage);
    const read = await resumedStore.read({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    });
    expect(read.outcome).toBe("found");
    if (read.outcome !== "found") throw new Error("Expected evidence read.");
    expect(read.collection.sources[0]).toMatchObject({
      role: "controlling legal text",
      legalVersionDates: [{ kind: "amendment" }],
    });
    expect(read.collection.documentVersions[0]?.versionLabel)
      .toBe("historical amendment version");
    expect(read.collection.passages[0]).toMatchObject({
      qualification: "Subject to the retained exemption schedule.",
      unresolvedCrossReferences: ["Schedule A"],
    });
    const visible = await resumedStore.readVisibleClaim({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    }, "claim-00");
    expect(visible).toMatchObject({
      outcome: "found",
      claim: { citations: [{ sourceRole: "controlling legal text" }] },
    });
  });

  it("replays the same immutable snapshot and rejects a conflicting replacement", async () => {
    const store = new SixScreenEvidenceStore(
      new InMemorySixScreenWorkflowStorage(),
    );
    const current = collection(1, 200);
    const evidenceSnapshot = snapshot(current);
    const input = {
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: current,
      expiresAt: "2026-09-13T10:00:00.000Z",
    };
    expect((await store.create(input)).outcome).toBe("created");
    expect((await store.create(input)).outcome).toBe("replayed");
    const changed = structuredClone(current);
    changed.claims[0]!.statement = "Changed after immutable persistence.";
    expect((await store.create({ ...input, collection: changed })).outcome)
      .toBe("conflict");
  });

  it("distinguishes unauthorized access, missing checkpoints, and capacity failure", async () => {
    const store = new SixScreenEvidenceStore(
      new InMemorySixScreenWorkflowStorage(),
    );
    const current = collection(1, 100);
    const evidenceSnapshot = snapshot(current);
    await store.create({
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: current,
      expiresAt: "2026-09-13T10:00:00.000Z",
    });
    expect((await store.read({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken: `sa6a_${"z".repeat(43)}`,
    })).outcome).toBe("unauthorized");
    expect((await store.read({
      runId,
      snapshotId: "missing-snapshot",
      accessToken,
    })).outcome).toBe("not_found");

    const oversized = collection(1, SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES + 1_000);
    expect(() => snapshot(oversized)).not.toThrow();
    await expect(store.create({
      runId,
      accessToken,
      snapshot: snapshot(oversized),
      collection: oversized,
      expiresAt: "2026-09-13T10:00:00.000Z",
    })).rejects.toBeInstanceOf(SixScreenEvidenceCapacityError);
  });

  it("deletes the manifest and all chunks only after expiry", async () => {
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenEvidenceStore(storage);
    const current = collection();
    const evidenceSnapshot = snapshot(current);
    const created = await store.create({
      runId,
      accessToken,
      snapshot: evidenceSnapshot,
      collection: current,
      expiresAt: "2026-09-13T10:00:00.000Z",
    });
    if (created.outcome !== "created") throw new Error("Expected evidence create.");
    expect((await store.cleanupExpired("2026-09-13T09:59:59.000Z")).deleted)
      .toBe(0);
    expect((await store.cleanupExpired("2026-09-13T10:00:00.000Z")).deleted)
      .toBe(1);
    expect((await store.read({
      runId,
      snapshotId: evidenceSnapshot.id,
      accessToken,
    })).outcome).toBe("not_found");
    for (const key of created.manifest.chunkKeys) {
      expect(storage.values.has(key)).toBe(false);
    }
  });
});
