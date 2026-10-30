import type {
  Claim,
  EvidenceRequirement,
  Passage,
  PolicyReviewClaimProjection,
  TypedDate,
} from "./contracts";
import {
  validateEvidenceCollection,
  type EvidenceCollection,
} from "./evidence";
import {
  projectPolicyEvidenceClaims,
  unsearchedFederalRegisterPolicyRequirements,
  type ParsedPolicyEvidence,
} from "./policy-review";

export const ECFR_HISTORICAL_POLICY_PARSER_VERSION =
  "ecfr-point-in-time-policy-v3" as const;

export type EcfrContentVersionMetadata = {
  date: string;
  amendmentDate: string;
  issueDate: string;
  identifier: string;
  name: string;
  part: string;
  subpart: string | null;
  title: string;
  type: "section";
  substantive: true;
  removed: boolean;
};

export type EcfrHistoricalPolicyEvidenceInput = {
  eventId: string;
  documentNumber: string;
  policyTitle: string;
  issuer: string;
  retrievedAt: string;
  cfrTitle: string;
  cfrPart: string;
  baselineDate: string;
  legalEffectDate: string;
  effectiveSnapshotDate: string;
  baselineUrl: string;
  effectiveUrl: string;
  versionMetadataUrl: string;
  versionMetadataContentHash: string;
  versionMetadataJsonLength: number;
  versionRecords: EcfrContentVersionMetadata[];
  baselineContentHash: string;
  effectiveContentHash: string;
  baselineXml: string;
  effectiveXml: string;
  annualBaseline?: GovInfoAnnualCfrBaselineEvidence;
};

export type GovInfoAnnualCfrBaselineEvidence = {
  annualEditionDate: string;
  section: string;
  packageId: string;
  granuleId: string;
  searchUrl: string;
  searchQuery: string;
  searchResponseContentHash: string;
  searchResponseJsonLength: number;
  xmlUrl: string;
  xmlContentHash: string;
  xml: string;
};

export type EcfrHistoricalPolicyDeltaSelection = {
  section: string;
  baseline: XmlParagraph;
  changed: XmlParagraph;
};

export type XmlParagraph = {
  text: string;
  start: number;
  end: number;
  section: string | null;
};

type ParsedXmlParagraphs = {
  text: string;
  paragraphs: XmlParagraph[];
};

const TARGET_STOP_WORDS = new Set([
  "and",
  "for",
  "from",
  "into",
  "operated",
  "participation",
  "rule",
  "the",
  "this",
  "with",
]);

function decodedCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);
  if (
    !Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) return " ";
  return String.fromCodePoint(codePoint);
}

function visibleXmlText(value: string) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x([0-9a-f]+);/giu, (_match, digits: string) =>
      decodedCodePoint(digits, 16))
    .replace(/&#([0-9]+);/gu, (_match, digits: string) =>
      decodedCodePoint(digits, 10))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function sectionStarts(xml: string) {
  return [...xml.matchAll(/<DIV8\b([^>]*)>/giu)].map((match) => ({
    index: match.index,
    section: /\bN=["']([^"']+)["']/iu.exec(match[1] ?? "")?.[1] ?? null,
  }));
}

function parseXmlParagraphs(xml: string): ParsedXmlParagraphs {
  const sections = sectionStarts(xml);
  let sectionIndex = -1;
  let cursor = 0;
  const fragments: string[] = [];
  const paragraphs: XmlParagraph[] = [];
  for (const match of xml.matchAll(/<P(?:\s[^>]*)?>([\s\S]*?)<\/P>/giu)) {
    while (
      sections[sectionIndex + 1] &&
      sections[sectionIndex + 1]!.index < match.index
    ) sectionIndex += 1;
    const text = visibleXmlText(match[1] ?? "");
    if (!text) continue;
    if (fragments.length) cursor += 1;
    const start = cursor;
    fragments.push(text);
    cursor += text.length;
    paragraphs.push({
      text,
      start,
      end: cursor,
      section: sections[sectionIndex]?.section ?? null,
    });
  }
  return { text: fragments.join("\n"), paragraphs };
}

function targetTokens(policyTitle: string) {
  return new Set(
    policyTitle.toLocaleLowerCase("en-US").match(/[a-z0-9]+/gu)
      ?.filter((value) => value.length >= 4 && !TARGET_STOP_WORDS.has(value)) ?? [],
  );
}

function overlapScore(text: string, targets: ReadonlySet<string>) {
  const words = new Set(
    text.toLocaleLowerCase("en-US").match(/[a-z0-9]+/gu) ?? [],
  );
  return [...targets].filter((value) => words.has(value)).length;
}

function historicalDelta(input: {
  policyTitle: string;
  baseline: ParsedXmlParagraphs;
  effective: ParsedXmlParagraphs;
  eligibleSections: ReadonlySet<string>;
}) {
  const baselineTexts = new Set(input.baseline.paragraphs.map(({ text }) => text));
  const targets = targetTokens(input.policyTitle);
  const ranked = input.effective.paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      score: baselineTexts.has(paragraph.text)
        ? -1
        : overlapScore(paragraph.text, targets),
    }))
    .filter(({ paragraph, score }) =>
      score >= 2 && paragraph.section !== null &&
      input.eligibleSections.has(paragraph.section) &&
      paragraph.text.length >= 40 && paragraph.text.length <= 4_000)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const changed = ranked[0];
  if (!changed) return null;

  let boundary: XmlParagraph | null = null;
  for (let index = changed.index - 1; index >= 0; index -= 1) {
    const candidate = input.effective.paragraphs[index]!;
    if (
      candidate.section === changed.paragraph.section &&
      baselineTexts.has(candidate.text)
    ) {
      boundary = input.baseline.paragraphs.find((baseline) =>
        baseline.section === candidate.section && baseline.text === candidate.text
      ) ?? null;
      if (boundary) break;
    }
  }
  if (!boundary) {
    for (
      let index = changed.index + 1;
      index < input.effective.paragraphs.length;
      index += 1
    ) {
      const candidate = input.effective.paragraphs[index]!;
      if (
        candidate.section === changed.paragraph.section &&
        baselineTexts.has(candidate.text)
      ) {
        boundary = input.baseline.paragraphs.find((baseline) =>
          baseline.section === candidate.section && baseline.text === candidate.text
        ) ?? null;
        if (boundary) break;
      }
    }
  }
  return boundary
    ? {
        section: changed.paragraph.section!,
        baseline: boundary,
        changed: changed.paragraph,
      }
    : null;
}

function metadataBoundVersionRecords(input: Pick<
  EcfrHistoricalPolicyEvidenceInput,
  "cfrTitle" | "cfrPart" | "legalEffectDate" | "versionRecords"
>) {
  return input.versionRecords.filter((record) =>
    record.title === input.cfrTitle && record.part === input.cfrPart &&
    record.amendmentDate === input.legalEffectDate && record.substantive &&
    record.type === "section" && record.date === record.amendmentDate
  );
}

/** Select the one metadata-bound section delta before any annual-CFR request. */
export function selectEcfrHistoricalPolicyDelta(input: Pick<
  EcfrHistoricalPolicyEvidenceInput,
  | "policyTitle"
  | "cfrTitle"
  | "cfrPart"
  | "legalEffectDate"
  | "versionRecords"
  | "baselineXml"
  | "effectiveXml"
>): EcfrHistoricalPolicyDeltaSelection | null {
  const versionRecords = metadataBoundVersionRecords(input);
  const eligibleSections = new Set(
    versionRecords.map(({ identifier }) => identifier),
  );
  if (!eligibleSections.size) {
    throw new Error(
      "eCFR historical evidence requires exact content-version metadata for at least one section.",
    );
  }
  return historicalDelta({
    policyTitle: input.policyTitle,
    baseline: parseXmlParagraphs(input.baselineXml),
    effective: parseXmlParagraphs(input.effectiveXml),
    eligibleSections,
  });
}

function parseAnnualCfrParagraphs(xml: string, section: string) {
  const sections = [...xml.matchAll(/<SECTION(?:\s[^>]*)?>([\s\S]*?)<\/SECTION>/giu)];
  if (sections.length !== 1) {
    throw new Error(
      "Annual CFR evidence must contain exactly one section representation.",
    );
  }
  return parseXmlParagraphs(
    `<DIV8 N="${section}" TYPE="SECTION">${sections[0]![1] ?? ""}</DIV8>`,
  );
}

function historicalRequirements(
  documentNumber: string,
  claims: readonly Claim[],
): EvidenceRequirement[] {
  const claimByPredicate = new Map(claims.map((claim) => [claim.predicate, claim]));
  return unsearchedFederalRegisterPolicyRequirements(documentNumber).map(
    (requirement) => {
      const predicate = requirement.kind === "previous_baseline"
        ? "previous_baseline"
        : requirement.kind === "version"
          ? "historical_version_change"
          : null;
      if (!predicate) return requirement;
      const claim = claimByPredicate.get(predicate);
      return {
        ...requirement,
        status: claim ? "supported" as const : "not_found" as const,
        supportingClaimIds: claim ? [claim.id] : [],
      };
    },
  );
}

/** Deterministic comparison of two complete, date-specific eCFR part responses. */
export function parseEcfrHistoricalPolicyEvidence(
  input: EcfrHistoricalPolicyEvidenceInput,
): ParsedPolicyEvidence {
  if (input.effectiveSnapshotDate !== input.legalEffectDate) {
    throw new Error(
      "The eCFR point-in-time snapshot date must equal the metadata-bound substantive amendment date.",
    );
  }
  const versionRecords = metadataBoundVersionRecords(input);
  const eligibleSections = new Set(
    versionRecords.map(({ identifier }) => identifier),
  );
  if (!eligibleSections.size) {
    throw new Error(
      "eCFR historical evidence requires exact content-version metadata for at least one section.",
    );
  }
  const baseline = parseXmlParagraphs(input.baselineXml);
  const effective = parseXmlParagraphs(input.effectiveXml);
  const delta = selectEcfrHistoricalPolicyDelta(input);
  let annual:
    | {
        input: GovInfoAnnualCfrBaselineEvidence;
        parsed: ParsedXmlParagraphs;
        boundary: XmlParagraph;
      }
    | null = null;
  if (input.annualBaseline) {
    if (!delta || input.annualBaseline.section !== delta.section) {
      throw new Error(
        "Annual CFR evidence must bind the exact selected historical section.",
      );
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(input.annualBaseline.annualEditionDate) ||
      input.annualBaseline.annualEditionDate >= input.legalEffectDate
    ) {
      throw new Error(
        "Annual CFR evidence must predate the legal-effective amendment.",
      );
    }
    const parsed = parseAnnualCfrParagraphs(
      input.annualBaseline.xml,
      input.annualBaseline.section,
    );
    const boundary = parsed.paragraphs.find(({ text, section }) =>
      section === delta.section && text === delta.baseline.text
    );
    if (!boundary) {
      throw new Error(
        "The official annual CFR section did not contain the selected pre-effective boundary paragraph.",
      );
    }
    annual = { input: input.annualBaseline, parsed, boundary };
  }
  const baselineCoordinate = input.baselineContentHash.slice(-12);
  const effectiveCoordinate = input.effectiveContentHash.slice(-12);
  const metadataCoordinate = input.versionMetadataContentHash.slice(-12);
  const annualCoordinate = annual?.input.xmlContentHash.slice(-12) ?? null;
  const annualSearchCoordinate =
    annual?.input.searchResponseContentHash.slice(-12) ?? null;
  const baselineSourceId =
    `ecfr-source-${input.cfrTitle}-${input.cfrPart}-${input.baselineDate}-${baselineCoordinate}`;
  const effectiveSourceId =
    `ecfr-source-${input.cfrTitle}-${input.cfrPart}-${input.effectiveSnapshotDate}-${effectiveCoordinate}`;
  const metadataSourceId =
    `ecfr-version-source-${input.cfrTitle}-${input.cfrPart}-${input.legalEffectDate}-${metadataCoordinate}`;
  const baselineDocumentId =
    `ecfr-document-${input.cfrTitle}-${input.cfrPart}-${input.baselineDate}-${baselineCoordinate}`;
  const effectiveDocumentId =
    `ecfr-document-${input.cfrTitle}-${input.cfrPart}-${input.effectiveSnapshotDate}-${effectiveCoordinate}`;
  const metadataDocumentId =
    `ecfr-version-document-${input.cfrTitle}-${input.cfrPart}-${input.legalEffectDate}-${metadataCoordinate}`;
  const annualSourceId = annualCoordinate
    ? `govinfo-cfr-source-${input.cfrTitle}-${input.cfrPart}-${delta!.section}-${annual!.input.annualEditionDate}-${annualCoordinate}`
    : null;
  const annualDocumentId = annualCoordinate
    ? `govinfo-cfr-document-${input.cfrTitle}-${input.cfrPart}-${delta!.section}-${annual!.input.annualEditionDate}-${annualCoordinate}`
    : null;
  const annualSearchSourceId = annualSearchCoordinate
    ? `govinfo-cfr-search-source-${input.cfrTitle}-${input.cfrPart}-${delta!.section}-${annual!.input.annualEditionDate}-${annualSearchCoordinate}`
    : null;
  const annualSearchDocumentId = annualSearchCoordinate
    ? `govinfo-cfr-search-document-${input.cfrTitle}-${input.cfrPart}-${delta!.section}-${annual!.input.annualEditionDate}-${annualSearchCoordinate}`
    : null;
  const scope = delta?.changed.section
    ? `${input.cfrTitle} CFR ${delta.changed.section}`
    : `${input.cfrTitle} CFR Part ${input.cfrPart}`;
  const baselinePassageId =
    `ecfr-passage-baseline-${input.cfrTitle}-${input.cfrPart}-${input.baselineDate}-${baselineCoordinate}`;
  const effectivePassageId =
    `ecfr-passage-change-${input.cfrTitle}-${input.cfrPart}-${input.effectiveSnapshotDate}-${effectiveCoordinate}`;
  const annualPassageId = annualCoordinate
    ? `govinfo-cfr-passage-${input.cfrTitle}-${input.cfrPart}-${delta!.section}-${annual!.input.annualEditionDate}-${annualCoordinate}`
    : null;
  const passages: Passage[] = delta
    ? [
        ...(annual && annualPassageId && annualSourceId && annualDocumentId
          ? [{
              id: annualPassageId,
              sourceId: annualSourceId,
              documentVersionId: annualDocumentId,
              locator:
                `${scope} — official annual CFR edition revised ${annual.input.annualEditionDate}`,
              exactText: annual.boundary.text,
              startOffset: annual.boundary.start,
              endOffset: annual.boundary.end,
              qualification:
                `The official annual CFR edition establishes this section text on ${annual.input.annualEditionDate}. It does not by itself establish that no intervening amendment occurred before ${input.legalEffectDate}; the separately retained ${input.baselineDate} eCFR snapshot supplies the immediate pre-effective boundary.`,
              unresolvedCrossReferences: [],
            }]
          : []),
        {
          id: baselinePassageId,
          sourceId: baselineSourceId,
          documentVersionId: baselineDocumentId,
          locator: `${scope} — ${input.baselineDate} point-in-time boundary`,
          exactText: delta.baseline.text,
          startOffset: delta.baseline.start,
          endOffset: delta.baseline.end,
          qualification:
            annual
              ? `This is the nearest unchanged paragraph at the matched amendment boundary in the ${input.baselineDate} pre-effective eCFR snapshot and matches the separately retained official annual CFR edition. It does not establish that no other prior rule or practice existed.`
              : "This is the nearest unchanged paragraph at the matched amendment boundary in the pre-effective snapshot. It does not establish that no other prior rule or practice existed.",
          unresolvedCrossReferences: [],
        },
        {
          id: effectivePassageId,
          sourceId: effectiveSourceId,
          documentVersionId: effectiveDocumentId,
          locator:
            `${scope} — ${input.effectiveSnapshotDate} point-in-time addition for ${input.legalEffectDate} legal effect`,
          exactText: delta.changed.text,
          startOffset: delta.changed.start,
          endOffset: delta.changed.end,
          qualification:
            `This paragraph appears in the ${input.effectiveSnapshotDate} requested-part snapshot but not the ${input.baselineDate} snapshot. Official eCFR content-version metadata binds section ${delta.changed.section} to the ${input.legalEffectDate} substantive amendment date. The comparison is limited to ${input.cfrTitle} CFR Part ${input.cfrPart} and does not use current text.`,
          unresolvedCrossReferences: [],
        },
      ]
    : [];
  const claims: Claim[] = delta
    ? [
        {
          id:
            `ecfr-claim-baseline-${input.documentNumber}-${input.baselineDate}-${annualCoordinate ?? baselineCoordinate}`,
          eventId: input.eventId,
          predicate: "previous_baseline",
          typedValue: {
            cfrTitle: input.cfrTitle,
            cfrPart: input.cfrPart,
            asOf: input.baselineDate,
            ...(annual
              ? {
                  annualEditionAsOf: annual.input.annualEditionDate,
                  immediatePreEffectiveAsOf: input.baselineDate,
                  annualPackageId: annual.input.packageId,
                  annualGranuleId: annual.input.granuleId,
                }
              : {}),
            comparedWith: input.legalEffectDate,
            effectiveSnapshotAsOf: input.effectiveSnapshotDate,
            relationship: annual
              ? "annual_edition_and_immediate_pre_effective_boundary"
              : "immediately_pre_effective_boundary",
          },
          statement:
            annual
              ? `Official annual CFR baseline on ${annual.input.annualEditionDate}, matched to the immediate pre-effective eCFR boundary on ${input.baselineDate}: ${delta.baseline.text}`
              : `Pre-effective boundary on ${input.baselineDate}: ${delta.baseline.text}`,
          scope,
          supportingPassageIds: annualPassageId
            ? [annualPassageId, baselinePassageId]
            : [baselinePassageId],
          opposingPassageIds: [],
          supportStatus: "direct",
          reviewStatus: "unreviewed",
          criticalFor: ["screen-2"],
        },
        {
          id:
            `ecfr-claim-change-${input.documentNumber}-${input.legalEffectDate}-${effectiveCoordinate}`,
          eventId: input.eventId,
          predicate: "historical_version_change",
          typedValue: {
            cfrTitle: input.cfrTitle,
            cfrPart: input.cfrPart,
            baselineAsOf: input.baselineDate,
            effectiveAsOf: input.legalEffectDate,
            effectiveSnapshotAsOf: input.effectiveSnapshotDate,
            contentVersionIdentifiers: [...eligibleSections].sort(),
            contentVersionIssueDates: [
              ...new Set(versionRecords.map(({ issueDate }) => issueDate)),
            ].sort(),
            baselineContentHash: input.baselineContentHash,
            effectiveContentHash: input.effectiveContentHash,
            changed: true,
          },
          statement:
            `Legal-effective addition on ${input.legalEffectDate}, retained from the ${input.effectiveSnapshotDate} eCFR snapshot: ${delta.changed.text}`,
          scope,
          supportingPassageIds: [effectivePassageId],
          opposingPassageIds: [],
          supportStatus: "direct",
          reviewStatus: "unreviewed",
          criticalFor: ["screen-2"],
        },
      ]
    : [];
  const legalVersionDates = (
    date: string,
    kind: TypedDate["kind"],
    passageId: string | null,
  ): TypedDate[] => [{
    start: date,
    end: null,
    precision: "day",
    kind,
    passageIds: passageId ? [passageId] : [],
  }];
  const annualSources: EvidenceCollection["sources"] =
    annual && annualSourceId && annualDocumentId && annualPassageId &&
      annualSearchSourceId && annualSearchDocumentId
      ? [
          {
            id: annualSearchSourceId,
            provider: "govinfo",
            nativeId:
              `CFR:${input.cfrTitle}:${input.cfrPart}:${delta!.section}:${annual.input.annualEditionDate}`,
            canonicalUrl: annual.input.searchUrl,
            publisher: "U.S. Government Publishing Office",
            issuer: null,
            author: null,
            jurisdiction: "United States",
            role:
              "official GovInfo historical Search Service metadata binding one exact annual CFR section result; request coordinates are retained without the server credential",
            documentType: "annual CFR search metadata",
            language: "en",
            publicationDate: annual.input.annualEditionDate,
            legalVersionDates: legalVersionDates(
              annual.input.annualEditionDate,
              "other",
              null,
            ),
            retrievedAt: input.retrievedAt,
            documentVersionId: annualSearchDocumentId,
            contentHash: annual.input.searchResponseContentHash,
            acquisitionProvenance: "direct",
            accessStatus: "available_metadata",
            rightsStatus: "public-government-record",
            parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
            textQualityStatus:
              "bounded official JSON search response parsed with an exact collection, title, part, section, annual-edition date, package, granule, and XML-link match",
            inspectedText: "metadata_only",
          },
          {
            id: annualSourceId,
            provider: "govinfo",
            nativeId: annual.input.granuleId,
            canonicalUrl: annual.input.xmlUrl,
            publisher: "U.S. Government Publishing Office",
            issuer: input.issuer,
            author: null,
            jurisdiction: "United States",
            role:
              "official annual CFR legal-edition section as of its annual revision date; paired with a separate immediate pre-effective eCFR snapshot",
            documentType: "annual CFR edition",
            language: "en",
            publicationDate: annual.input.annualEditionDate,
            legalVersionDates: legalVersionDates(
              annual.input.annualEditionDate,
              "other",
              annualPassageId,
            ),
            retrievedAt: input.retrievedAt,
            documentVersionId: annualDocumentId,
            contentHash: annual.input.xmlContentHash,
            acquisitionProvenance: "direct",
            accessStatus: "retained_passage",
            rightsStatus: "public-government-record",
            parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
            textQualityStatus:
              "bounded official annual-CFR XML section inspected with exact title, part, section, edition date, and retained-span checks",
            inspectedText: "full",
          },
        ]
      : [];
  const annualDocuments: EvidenceCollection["documentVersions"] =
    annual && annualSourceId && annualDocumentId && annualSearchSourceId &&
      annualSearchDocumentId
      ? [
          {
            id: annualSearchDocumentId,
            sourceId: annualSearchSourceId,
            representation: "govinfo-search-json",
            language: "en",
            versionLabel:
              `GovInfo historical CFR search: ${annual.input.searchQuery}`,
            retrievedAt: input.retrievedAt,
            contentHash: annual.input.searchResponseContentHash,
            parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
            parsedTextLength: annual.input.searchResponseJsonLength,
          },
          {
            id: annualDocumentId,
            sourceId: annualSourceId,
            representation: "govinfo-annual-cfr-granule-xml",
            language: "en",
            versionLabel:
              `${annual.input.packageId} / ${annual.input.granuleId}; annual edition ${annual.input.annualEditionDate}`,
            retrievedAt: input.retrievedAt,
            contentHash: annual.input.xmlContentHash,
            parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
            parsedTextLength: annual.parsed.text.length,
          },
        ]
      : [];
  const collection: EvidenceCollection = {
    sources: [
      {
        id: baselineSourceId,
        provider: "ecfr",
        nativeId: `title-${input.cfrTitle}-part-${input.cfrPart}-${input.baselineDate}`,
        canonicalUrl: input.baselineUrl,
        publisher: "Electronic Code of Federal Regulations",
        issuer: input.issuer,
        author: null,
        jurisdiction: "United States",
        role:
          "official eCFR point-in-time source; the eCFR is not the official legal edition of the CFR",
        documentType: "codified regulation",
        language: "en",
        publicationDate: null,
        legalVersionDates: legalVersionDates(
          input.baselineDate,
          "other",
          delta ? baselinePassageId : null,
        ),
        retrievedAt: input.retrievedAt,
        documentVersionId: baselineDocumentId,
        contentHash: input.baselineContentHash,
        acquisitionProvenance: "direct",
        accessStatus: delta ? "retained_passage" : "parsed_text",
        rightsStatus: "public-government-record",
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        textQualityStatus: "processed XML paragraphs inspected with exact retained spans",
        inspectedText: "full",
      },
      {
        id: effectiveSourceId,
        provider: "ecfr",
        nativeId:
          `title-${input.cfrTitle}-part-${input.cfrPart}-${input.effectiveSnapshotDate}`,
        canonicalUrl: input.effectiveUrl,
        publisher: "Electronic Code of Federal Regulations",
        issuer: input.issuer,
        author: null,
        jurisdiction: "United States",
        role:
          "official eCFR point-in-time source; the eCFR is not the official legal edition of the CFR",
        documentType: "codified regulation",
        language: "en",
        publicationDate: null,
        legalVersionDates: legalVersionDates(
          input.legalEffectDate,
          "legal_effect",
          delta ? effectivePassageId : null,
        ).concat(
          input.effectiveSnapshotDate === input.legalEffectDate
            ? []
            : legalVersionDates(
                input.effectiveSnapshotDate,
                "other",
                delta ? effectivePassageId : null,
              ),
        ),
        retrievedAt: input.retrievedAt,
        documentVersionId: effectiveDocumentId,
        contentHash: input.effectiveContentHash,
        acquisitionProvenance: "direct",
        accessStatus: delta ? "retained_passage" : "parsed_text",
        rightsStatus: "public-government-record",
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        textQualityStatus: "processed XML paragraphs inspected with exact retained spans",
        inspectedText: "full",
      },
      {
        id: metadataSourceId,
        provider: "ecfr",
        nativeId:
          `title-${input.cfrTitle}-part-${input.cfrPart}-amendment-${input.legalEffectDate}`,
        canonicalUrl: input.versionMetadataUrl,
        publisher: "Electronic Code of Federal Regulations",
        issuer: null,
        author: null,
        jurisdiction: "United States",
        role:
          "official eCFR content-version metadata binding the retained section to the substantive amendment date; metadata only and not the official legal edition of the CFR",
        documentType: "content-version metadata",
        language: "en",
        publicationDate: null,
        legalVersionDates: legalVersionDates(
          input.legalEffectDate,
          "legal_effect",
          null,
        ),
        retrievedAt: input.retrievedAt,
        documentVersionId: metadataDocumentId,
        contentHash: input.versionMetadataContentHash,
        acquisitionProvenance: "direct",
        accessStatus: "available_metadata",
        rightsStatus: "public-government-record",
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        textQualityStatus:
          "bounded official JSON metadata parsed with exact title, part, amendment date, issue date, section identifier, and snapshot date checks",
        inspectedText: "metadata_only",
      },
      ...annualSources,
    ],
    documentVersions: [
      {
        id: baselineDocumentId,
        sourceId: baselineSourceId,
        representation: "ecfr-processed-xml",
        language: "en",
        versionLabel:
          `${input.cfrTitle} CFR Part ${input.cfrPart} as of ${input.baselineDate}`,
        retrievedAt: input.retrievedAt,
        contentHash: input.baselineContentHash,
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        parsedTextLength: baseline.text.length,
      },
      {
        id: effectiveDocumentId,
        sourceId: effectiveSourceId,
        representation: "ecfr-processed-xml",
        language: "en",
        versionLabel:
          `${input.cfrTitle} CFR Part ${input.cfrPart} as of ${input.effectiveSnapshotDate}; substantive amendment dated ${input.legalEffectDate}`,
        retrievedAt: input.retrievedAt,
        contentHash: input.effectiveContentHash,
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        parsedTextLength: effective.text.length,
      },
      {
        id: metadataDocumentId,
        sourceId: metadataSourceId,
        representation: "ecfr-content-version-metadata-json",
        language: "en",
        versionLabel:
          `eCFR content-version metadata for ${input.cfrTitle} CFR Part ${input.cfrPart}; substantive amendment dated ${input.legalEffectDate}; snapshot ${input.effectiveSnapshotDate}`,
        retrievedAt: input.retrievedAt,
        contentHash: input.versionMetadataContentHash,
        parserVersion: ECFR_HISTORICAL_POLICY_PARSER_VERSION,
        parsedTextLength: input.versionMetadataJsonLength,
      },
      ...annualDocuments,
    ],
    passages,
    claims,
    conflicts: [],
    requirements: historicalRequirements(input.documentNumber, claims),
  };
  const parsedTextByDocumentVersionId = new Map([
    [baselineDocumentId, baseline.text],
    [effectiveDocumentId, effective.text],
  ]);
  if (annual && annualDocumentId) {
    parsedTextByDocumentVersionId.set(annualDocumentId, annual.parsed.text);
  }
  validateEvidenceCollection(collection, parsedTextByDocumentVersionId);
  const projections: PolicyReviewClaimProjection[] =
    projectPolicyEvidenceClaims(collection);
  const unresolved = collection.requirements
    .filter(({ kind, status }) =>
      (kind === "previous_baseline" || kind === "version") &&
      status !== "supported")
    .map(({ kind }) => kind);
  return {
    collection,
    projections,
    unresolved,
    status: unresolved.length ? "partial" : "ready",
  };
}

export const FEDERAL_REGISTER_HISTORICAL_FALLBACK_PARSER_VERSION =
  "federal-register-amendatory-fallback-v1" as const;

export type FederalRegisterCfrCoordinate = {
  title: string;
  part: string;
};

export type FederalRegisterHistoricalFallbackInput = {
  eventId: string;
  documentNumber: string;
  issuer: string;
  publicationDate: string | null;
  legalEffectDate: string;
  retrievedAt: string;
  canonicalUrl: string;
  contentHash: string;
  representation: "html" | "text";
  parsedText: string;
  cfrCoordinates: FederalRegisterCfrCoordinate[];
  reason: "historical_date_unavailable" | "cfr_coordinates_unavailable";
};

type PlainTextSpan = {
  text: string;
  start: number;
  end: number;
};

const FEDERAL_REGISTER_FALLBACK_MAX_COORDINATES = 16;
const FEDERAL_REGISTER_FALLBACK_MAX_PASSAGES = 8;
const FEDERAL_REGISTER_FALLBACK_MAX_PASSAGE_CHARACTERS = 4_000;

function plainTextSentenceSpans(text: string) {
  const values: PlainTextSpan[] = [];
  let cursor = 0;
  for (let index = 0; index < text.length; index += 1) {
    const next = text[index + 1] ?? "";
    if (
      !".!?".includes(text[index]!) ||
      (next !== "" && !/\s/u.test(next))
    ) {
      continue;
    }
    const raw = text.slice(cursor, index + 1);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) {
      const start = cursor + leading;
      values.push({ text: trimmed, start, end: start + trimmed.length });
    }
    cursor = index + 1;
  }
  const raw = text.slice(cursor);
  const leading = raw.length - raw.trimStart().length;
  const trimmed = raw.trim();
  if (trimmed) {
    const start = cursor + leading;
    values.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return values;
}

function amendatoryDirective(text: string) {
  if (/\b(?:propose[sd]?|proposing|would|may|might|could)\s+(?:to\s+)?(?:hereby\s+)?(?:amend|add|revise|remove|redesignate)/iu.test(text)) {
    return false;
  }
  return /\b(?:is|are)\s+(?:hereby\s+)?amended\b/iu.test(text) ||
    /\b(?:Commission|Department|Agency|Secretary|Board|Administrator|Authority|Council|Service|Administration|Bureau|Office)\s+(?:hereby\s+)?amends?\b/iu.test(text) ||
    /\bAmend\s+(?:\u00a7{1,2}\s*|Parts?\b|Sections?\b)/iu.test(text) ||
    /\b(?:Add|Revise|Remove|Redesignate)\s+(?:\u00a7{1,2}|Parts?|Sections?|paragraphs?)\b/iu.test(text);
}

function normalizedFallbackCoordinates(
  values: readonly FederalRegisterCfrCoordinate[],
) {
  if (
    values.length < 1 ||
    values.length > FEDERAL_REGISTER_FALLBACK_MAX_COORDINATES
  ) return [];
  const coordinates = new Map<string, FederalRegisterCfrCoordinate>();
  for (const value of values) {
    if (!/^\d{1,2}$/u.test(value.title) || !/^\d{1,4}$/u.test(value.part)) {
      return [];
    }
    const title = String(Number(value.title));
    const part = String(Number(value.part));
    if (title === "0" || part === "0") return [];
    coordinates.set(`${title}:${part}`, { title, part });
  }
  return [...coordinates.values()];
}

function coordinateMentionScore(
  text: string,
  coordinate: FederalRegisterCfrCoordinate,
) {
  const title = coordinate.title;
  const part = coordinate.part;
  if (new RegExp(
    `(?:\u00a7{1,2}|Sec(?:tion)?\\.?)\\s*${part}(?:\\.|\\b)`,
    "iu",
  ).test(text)) return 4;
  if (new RegExp(
    `\\b${title}\\s+CFR\\s+Parts?\\s+[^.!?]{0,160}\\b${part}\\b`,
    "iu",
  ).test(text)) return 3;
  if (new RegExp(
    `\\bPart\\s+${part}\\b[^.!?]{0,160}\\bTitle\\s+${title}\\b`,
    "iu",
  ).test(text)) return 2;
  return new RegExp(`\\bPart\\s+${part}\\b`, "iu").test(text) ? 1 : 0;
}

function directiveCandidates(text: string) {
  const values = new Map<string, PlainTextSpan>();
  for (const span of plainTextSentenceSpans(text)) {
    if (
      amendatoryDirective(span.text) &&
      span.text.length <= FEDERAL_REGISTER_FALLBACK_MAX_PASSAGE_CHARACTERS
    ) values.set(`${span.start}:${span.end}`, span);
    for (let index = span.text.indexOf(":"); index >= 0; index = span.text.indexOf(":", index + 1)) {
      const prefix = span.text.slice(0, index + 1).trimEnd();
      if (
        !amendatoryDirective(prefix) ||
        prefix.length > FEDERAL_REGISTER_FALLBACK_MAX_PASSAGE_CHARACTERS
      ) continue;
      const shortened = {
        text: prefix,
        start: span.start,
        end: span.start + prefix.length,
      };
      values.set(`${shortened.start}:${shortened.end}`, shortened);
    }
  }
  return [...values.values()];
}

function fallbackAmendatoryPassages(
  text: string,
  coordinates: readonly FederalRegisterCfrCoordinate[],
) {
  const candidates = directiveCandidates(text);
  const selected = new Map<string, PlainTextSpan>();
  for (const coordinate of coordinates) {
    const ranked = candidates
      .map((span) => ({
        span,
        score: coordinateMentionScore(span.text, coordinate) * 10 +
          (span.text.endsWith(":") ? 5 : 0) +
          (/\bto\s+read\s+as\s+follows\b/iu.test(span.text) ? 3 : 0),
      }))
      .filter(({ score }) => score >= 10)
      .sort((left, right) =>
        right.score - left.score || left.span.start - right.span.start
      );
    const best = ranked[0]?.span;
    if (best) selected.set(`${best.start}:${best.end}`, best);
  }
  return [...selected.values()]
    .sort((left, right) => left.start - right.start)
    .slice(0, FEDERAL_REGISTER_FALLBACK_MAX_PASSAGES);
}

function inaccessibleHistoricalRequirements(documentNumber: string) {
  return unsearchedFederalRegisterPolicyRequirements(documentNumber).map(
    (requirement): EvidenceRequirement =>
      requirement.kind === "previous_baseline" || requirement.kind === "version"
        ? { ...requirement, status: "inaccessible" }
        : requirement,
  );
}

/**
 * Retain only source-native amendatory instructions when a codified comparison
 * cannot be completed. These claims intentionally do not satisfy either
 * historical-version requirement.
 */
export function parseFederalRegisterHistoricalFallbackEvidence(
  input: FederalRegisterHistoricalFallbackInput,
): ParsedPolicyEvidence | null {
  const coordinates = normalizedFallbackCoordinates(input.cfrCoordinates);
  if (!coordinates.length) return null;
  const retained = fallbackAmendatoryPassages(input.parsedText, coordinates);
  if (!retained.length) return null;

  const contentCoordinate = input.contentHash.slice(-12);
  const sourceId =
    `fr-source-${input.documentNumber}-${input.representation}-${contentCoordinate}`;
  const documentVersionId =
    `fr-document-${input.documentNumber}-${input.representation}-${contentCoordinate}`;
  const coordinateLabel = coordinates
    .map(({ title, part }) => `${title} CFR Part ${part}`)
    .join(", ");
  const passages: Passage[] = retained.map((span, index) => ({
    id:
      `fr-passage-${input.documentNumber}-${contentCoordinate}-contemporaneous-amendment-${index + 1}`,
    sourceId,
    documentVersionId,
    locator: `Contemporaneous amendatory instruction ${index + 1}`,
    exactText: span.text,
    startOffset: span.start,
    endOffset: span.end,
    qualification:
      "This is an exact amendatory instruction in the contemporaneous Federal Register representation. It does not establish the immediately preceding codified text, the effective-date codified version, or an official CFR legal edition.",
    unresolvedCrossReferences: [],
  }));
  const claims: Claim[] = passages.map((passage, index) => {
    const mentionedCoordinates = coordinates.filter((coordinate) =>
      coordinateMentionScore(passage.exactText, coordinate) > 0
    );
    return {
      id:
        `fr-claim-${input.documentNumber}-${contentCoordinate}-contemporaneous-amendment-${index + 1}`,
      eventId: input.eventId,
      predicate: "contemporaneous_amendment_record",
      typedValue: {
        documentNumber: input.documentNumber,
        publicationDate: input.publicationDate,
        legalEffectDate: input.legalEffectDate,
        cfrCoordinates: mentionedCoordinates,
        relationship: "contemporaneous_amendatory_instruction",
        historicalVersionEstablished: false,
        legalEditionEstablished: false,
        fallbackReason: input.reason,
      },
      statement:
        `Contemporaneous amendatory instruction for ${mentionedCoordinates.map(({ title, part }) => `${title} CFR Part ${part}`).join(", ")}: ${passage.exactText}`,
      scope: `Federal Register document ${input.documentNumber}; ${coordinateLabel}`,
      supportingPassageIds: [passage.id],
      opposingPassageIds: [],
      supportStatus: "direct" as const,
      reviewStatus: "unreviewed" as const,
      criticalFor: ["screen-2"],
    };
  });
  const collection: EvidenceCollection = {
    sources: [{
      id: sourceId,
      provider: "federal-register",
      nativeId: input.documentNumber,
      canonicalUrl: input.canonicalUrl,
      publisher: "Federal Register",
      issuer: input.issuer,
      author: null,
      jurisdiction: "United States",
      role:
        "contemporaneous FederalRegister.gov amendatory-text representation; not the controlling Federal Register legal edition or a codified historical CFR version; controlling edition separately verifiable on GovInfo",
      documentType: "administrative rule",
      language: "en",
      publicationDate: input.publicationDate,
      legalVersionDates: [],
      retrievedAt: input.retrievedAt,
      documentVersionId,
      contentHash: input.contentHash,
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion: FEDERAL_REGISTER_HISTORICAL_FALLBACK_PARSER_VERSION,
      textQualityStatus:
        "visible amendatory text parsed; exact retained spans; codified versions unresolved",
      inspectedText: "full",
    }],
    documentVersions: [{
      id: documentVersionId,
      sourceId,
      representation: input.representation,
      language: "en",
      versionLabel:
        `Contemporaneous FederalRegister.gov representation for FR Doc. ${input.documentNumber}; not a codified CFR edition or controlling Federal Register edition`,
      retrievedAt: input.retrievedAt,
      contentHash: input.contentHash,
      parserVersion: FEDERAL_REGISTER_HISTORICAL_FALLBACK_PARSER_VERSION,
      parsedTextLength: input.parsedText.length,
    }],
    passages,
    claims,
    conflicts: [],
    requirements: inaccessibleHistoricalRequirements(input.documentNumber),
  };
  validateEvidenceCollection(
    collection,
    new Map([[documentVersionId, input.parsedText]]),
  );
  return {
    collection,
    projections: projectPolicyEvidenceClaims(collection),
    unresolved: ["previous_baseline", "version"],
    status: "partial",
  };
}
