import { describe, expect, it } from "vitest";

import {
  parseEcfrHistoricalPolicyEvidence,
  parseFederalRegisterHistoricalFallbackEvidence,
} from "../../src/core/six-screen/policy-history";

const baselineUrl =
  "https://www.ecfr.gov/api/versioner/v1/full/2018-06-03/title-18.xml?part=35";
const effectiveUrl =
  "https://www.ecfr.gov/api/versioner/v1/full/2018-06-04/title-18.xml?part=35";
const versionMetadataUrl =
  "https://www.ecfr.gov/api/versioner/v1/versions/title-18.json?part=35&issue_date%5Bgte%5D=2018-06-03&issue_date%5Blte%5D=2018-06-11";
const annualSearchUrl = "https://api.govinfo.gov/search";
const annualXmlUrl =
  "https://api.govinfo.gov/packages/CFR-2018-title18-vol1/granules/CFR-2018-title18-vol1-sec35-28/xml";

function partXml(paragraphs: string[]) {
  return `<?xml version="1.0"?>
    <DIV5 N="35" TYPE="PART" hierarchy_metadata="{&amp;quot;path&amp;quot;:&amp;quot;/on/_SUBSTITUTE_DATE_/title-18/part-35&amp;quot;,&amp;quot;citation&amp;quot;:&amp;quot;18 CFR Part 35&amp;quot;}">
      <HEAD>PART 35 - FILING OF RATE SCHEDULES AND TARIFFS</HEAD>
      <DIV8 N="35.28" TYPE="SECTION">
        <HEAD>&#xA7; 35.28 Non-discriminatory open access transmission tariff.</HEAD>
        ${paragraphs.map((value) => `<P>${value}</P>`).join("\n")}
      </DIV8>
    </DIV5>`;
}

function input(effectiveXml: string) {
  return {
    eventId: "identity-order-841",
    documentNumber: "2018-03708",
    policyTitle:
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    issuer: "Federal Energy Regulatory Commission",
    retrievedAt: "2026-09-12T10:00:00.000Z",
    cfrTitle: "18",
    cfrPart: "35",
    baselineDate: "2018-06-03",
    legalEffectDate: "2018-06-04",
    effectiveSnapshotDate: "2018-06-04",
    baselineUrl,
    effectiveUrl,
    versionMetadataUrl,
    versionMetadataContentHash: `sha256:${"c".repeat(64)}`,
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
      type: "section" as const,
      substantive: true as const,
      removed: false,
    }],
    baselineContentHash: `sha256:${"a".repeat(64)}`,
    effectiveContentHash: `sha256:${"b".repeat(64)}`,
    baselineXml: partXml([
      "(8) <I>Market Violation</I> means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
    ]),
    effectiveXml,
  };
}

function annualXml(paragraph: string) {
  return `<?xml version="1.0"?>
    <CFRGRANULE>
      <CFRTITLE>18</CFRTITLE>
      <DATE>2018-04-01</DATE>
      <GRANULENUM>§ 35.28</GRANULENUM>
      <ANCESTORS><ANCESTOR LEVEL="part" IDENTIFIER="35">Part 35</ANCESTOR></ANCESTORS>
      <SECTION>
        <SECTNO>§ 35.28</SECTNO>
        <P>${paragraph}</P>
      </SECTION>
    </CFRGRANULE>`;
}

describe("date-specific eCFR policy evidence", () => {
  it("retains an exact pre-effective boundary and a different effective-date addition", () => {
    const parsed = parseEcfrHistoricalPolicyEvidence(input(partXml([
      "(8) <I>Market Violation</I> means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
      "(9) <I>Electric storage resources.</I> Each Commission-approved independent system operator and regional transmission organization must have tariff provisions providing a participation model for electric storage resources.",
    ])));

    expect(parsed).toMatchObject({
      status: "ready",
      unresolved: [],
      collection: {
        sources: [
          expect.objectContaining({
            provider: "ecfr",
            canonicalUrl: baselineUrl,
            inspectedText: "full",
          }),
          expect.objectContaining({
            provider: "ecfr",
            canonicalUrl: effectiveUrl,
            inspectedText: "full",
          }),
          expect.objectContaining({
            provider: "ecfr",
            canonicalUrl: versionMetadataUrl,
            inspectedText: "metadata_only",
          }),
        ],
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: "previous_baseline",
            status: "supported",
          }),
          expect.objectContaining({ kind: "version", status: "supported" }),
        ]),
      },
    });
    expect(parsed.projections.map(({ predicate }) => predicate)).toEqual([
      "previous_baseline",
      "historical_version_change",
    ]);
    expect(parsed.projections[0]).toMatchObject({
      statement: expect.stringContaining("Market Violation"),
      typedValue: {
        asOf: "2018-06-03",
        comparedWith: "2018-06-04",
      },
      citation: { canonicalUrl: baselineUrl },
    });
    expect(parsed.projections[1]).toMatchObject({
      statement: expect.stringContaining("participation model for electric storage"),
      typedValue: {
        baselineAsOf: "2018-06-03",
        effectiveAsOf: "2018-06-04",
        effectiveSnapshotAsOf: "2018-06-04",
        contentVersionIdentifiers: ["35.28"],
        changed: true,
      },
      citation: { canonicalUrl: effectiveUrl },
    });
    expect(JSON.stringify(parsed)).not.toContain("/current/");
  });

  it("keeps both context requirements not found when a delta is unrelated to the policy title", () => {
    const parsed = parseEcfrHistoricalPolicyEvidence(input(partXml([
      "(8) <I>Market Violation</I> means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
      "(9) Paper records must use a revised reporting cover sheet.",
    ])));
    expect(parsed).toMatchObject({
      status: "partial",
      unresolved: ["previous_baseline", "version"],
      collection: {
        claims: [],
        passages: [],
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: "previous_baseline",
            status: "not_found",
          }),
          expect.objectContaining({ kind: "version", status: "not_found" }),
        ]),
      },
    });
  });

  it("makes the official annual CFR passage primary while retaining the immediate eCFR boundary", () => {
    const baselineParagraph =
      "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.";
    const parsed = parseEcfrHistoricalPolicyEvidence({
      ...input(partXml([
        baselineParagraph,
        "(9) Electric storage resources. Each Commission-approved independent system operator and regional transmission organization must have tariff provisions providing a participation model for electric storage resources.",
      ])),
      annualBaseline: {
        annualEditionDate: "2018-04-01",
        section: "35.28",
        packageId: "CFR-2018-title18-vol1",
        granuleId: "CFR-2018-title18-vol1-sec35-28",
        searchUrl: annualSearchUrl,
        searchQuery:
          "collection:(CFR) cfrtitlenum:18 cfrpartnum:35 cfrsectionnum:35.28 publishdate:2018-04-01",
        searchResponseContentHash: `sha256:${"d".repeat(64)}`,
        searchResponseJsonLength: 640,
        xmlUrl: annualXmlUrl,
        xmlContentHash: `sha256:${"e".repeat(64)}`,
        xml: annualXml(baselineParagraph),
      },
    });

    expect(parsed).toMatchObject({
      status: "ready",
      collection: {
        sources: expect.arrayContaining([
          expect.objectContaining({
            provider: "govinfo",
            canonicalUrl: annualSearchUrl,
            inspectedText: "metadata_only",
          }),
          expect.objectContaining({
            provider: "govinfo",
            canonicalUrl: annualXmlUrl,
            documentType: "annual CFR edition",
            inspectedText: "full",
          }),
        ]),
        claims: expect.arrayContaining([expect.objectContaining({
          predicate: "previous_baseline",
          typedValue: expect.objectContaining({
            asOf: "2018-06-03",
            annualEditionAsOf: "2018-04-01",
            immediatePreEffectiveAsOf: "2018-06-03",
            relationship: "annual_edition_and_immediate_pre_effective_boundary",
          }),
          supportingPassageIds: expect.arrayContaining([
            expect.stringContaining("govinfo-cfr-passage"),
            expect.stringContaining("ecfr-passage-baseline"),
          ]),
        })]),
      },
    });
    expect(parsed.projections[0]).toMatchObject({
      predicate: "previous_baseline",
      statement: expect.stringContaining(
        "Official annual CFR baseline on 2018-04-01",
      ),
      citation: {
        canonicalUrl: annualXmlUrl,
        exactText: baselineParagraph,
        inspectedText: "full",
      },
      qualification: expect.stringContaining(
        "does not by itself establish that no intervening amendment occurred",
      ),
    });
    expect(JSON.stringify(parsed)).toContain(annualSearchUrl);
    expect(JSON.stringify(parsed)).not.toContain("api_key");
  });

  it("rejects an annual section that cannot be matched to the immediate boundary", () => {
    expect(() => parseEcfrHistoricalPolicyEvidence({
      ...input(partXml([
        "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
        "(9) Electric storage resources. Each operator must provide a participation model for electric storage resources in its tariff.",
      ])),
      annualBaseline: {
        annualEditionDate: "2018-04-01",
        section: "35.28",
        packageId: "CFR-2018-title18-vol1",
        granuleId: "CFR-2018-title18-vol1-sec35-28",
        searchUrl: annualSearchUrl,
        searchQuery: "exact fixture query",
        searchResponseContentHash: `sha256:${"d".repeat(64)}`,
        searchResponseJsonLength: 20,
        xmlUrl: annualXmlUrl,
        xmlContentHash: `sha256:${"e".repeat(64)}`,
        xml: annualXml("A different annual baseline paragraph."),
      },
    })).toThrow("did not contain the selected pre-effective boundary");
  });
});

describe("contemporaneous Federal Register historical fallback", () => {
  const base = {
    eventId: "identity-order-841",
    documentNumber: "2018-03708",
    issuer: "Federal Energy Regulatory Commission",
    publicationDate: "2018-03-06",
    legalEffectDate: "2018-06-04",
    retrievedAt: "2026-09-12T10:00:00.000Z",
    canonicalUrl:
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
    contentHash: `sha256:${"c".repeat(64)}`,
    representation: "html" as const,
    reason: "historical_date_unavailable" as const,
  };

  it("retains an exact amendatory instruction without claiming a codified version", () => {
    const instruction =
      "Amend \u00a7 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:";
    const parsedText = [
      "18 CFR Part 35",
      "In consideration of the foregoing, the Commission amends Part 35, Chapter I, Title 18, Code of Federal Regulations, as follows:",
      "PART 35\u2014FILING OF RATE SCHEDULES AND TARIFFS 2.",
      instruction,
    ].join(" ");
    const parsed = parseFederalRegisterHistoricalFallbackEvidence({
      ...base,
      parsedText,
      cfrCoordinates: [{ title: "18", part: "35" }],
    });

    expect(parsed).toMatchObject({
      status: "partial",
      unresolved: ["previous_baseline", "version"],
      collection: {
        passages: [{
          exactText: instruction,
          qualification: expect.stringContaining(
            "does not establish the immediately preceding codified text",
          ),
        }],
        claims: [{
          predicate: "contemporaneous_amendment_record",
          typedValue: {
            cfrCoordinates: [{ title: "18", part: "35" }],
            historicalVersionEstablished: false,
            legalEditionEstablished: false,
            fallbackReason: "historical_date_unavailable",
          },
        }],
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: "previous_baseline",
            status: "inaccessible",
            supportingClaimIds: [],
          }),
          expect.objectContaining({
            kind: "version",
            status: "inaccessible",
            supportingClaimIds: [],
          }),
        ]),
      },
    });
    expect(parsed?.projections).toEqual([
      expect.objectContaining({
        predicate: "contemporaneous_amendment_record",
        citation: expect.objectContaining({ exactText: instruction }),
      }),
    ]);
    expect(JSON.stringify(parsed)).not.toContain("/current/");
  });

  it("preserves every named coordinate in one shared multi-part instruction", () => {
    const instruction =
      "The Commission amends 18 CFR Parts 35 and 385 as follows:";
    const parsed = parseFederalRegisterHistoricalFallbackEvidence({
      ...base,
      reason: "cfr_coordinates_unavailable",
      parsedText: `18 CFR Parts 35 and 385. ${instruction}`,
      cfrCoordinates: [
        { title: "18", part: "35" },
        { title: "18", part: "385" },
      ],
    });

    expect(parsed?.collection.passages).toHaveLength(1);
    expect(parsed?.collection.claims[0]).toMatchObject({
      typedValue: {
        cfrCoordinates: [
          { title: "18", part: "35" },
          { title: "18", part: "385" },
        ],
        fallbackReason: "cfr_coordinates_unavailable",
      },
    });
    expect(parsed?.collection.documentVersions[0]?.versionLabel).toContain(
      "not a codified CFR edition",
    );
  });

  it("does not retain a proposal or a coordinate heading as an amendment", () => {
    expect(parseFederalRegisterHistoricalFallbackEvidence({
      ...base,
      parsedText:
        "18 CFR Part 35. The Commission proposes to amend Part 35 after receiving comments.",
      cfrCoordinates: [{ title: "18", part: "35" }],
    })).toBeNull();
  });
});
