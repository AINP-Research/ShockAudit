import {
  applyScreen02AuditMatchRound,
  type Screen02AuditSearchMatchInput,
} from "./screen02-audit-workflow";
import {
  fingerprintScreen02WorkflowSource,
  requireScreen02AuditState,
} from "./screen02-workflow-state";
import {
  SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  buildScreen02RetainedResultBinding,
  buildScreen02RetrievalExecution,
  type Screen02AuditAnchorFields,
  type Screen02AuditRelationship,
  type Screen02AuditState,
  type Screen02EventIdentity,
  type Screen02SearchFunnel,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
} from "./screen02-workflow-types";

type ReviewedSource = Omit<
  Screen02WorkflowSource,
  "sourceFingerprint" | "retrievedAt"
> & {
  /**
   * Exact identity scalars captured during review of this fixed official
   * source. These are never copied into mutable Screen 2 state; Screen 3 may
   * recover them only while every immutable source coordinate still matches
   * this catalog entry.
   */
  officialIdentityFields?: Array<{
    field:
      | "canonical-title"
      | "common-name"
      | "formal-identifier"
      | "issuer"
      | "issuing-jurisdiction"
      | "status"
      | "event-type";
    value: string;
  }>;
};

type ReviewedMatch = {
  key: string;
  identity: Screen02EventIdentity;
  relationship: Screen02AuditRelationship;
  sourceKeys: string[];
  relationshipReason: string;
  limitations: string[];
};

type ReviewedRecord = {
  key: string;
  identity: Screen02EventIdentity;
  versionType: Screen02AuditAnchorFields["versionType"];
  relationship: Screen02AuditRelationship;
  sourceKey: keyof typeof reviewedSources;
  supportingSourceKeys?: Array<keyof typeof reviewedSources>;
  aliases: string[];
  signalTerms: string[];
  relatedRecordKeys: string[];
  years: string[];
  relationshipReason: string;
  limitations: string[];
  locatorRequiresIdentitySignal?: boolean;
};

export type Screen02AuditDiscoveryResult = {
  matchSetSnapshotId: string;
  sources: Screen02WorkflowSource[];
  matches: Screen02AuditSearchMatchInput[];
  manifest: Screen02WorkflowSearchManifest;
  at: string;
};

/**
 * Audit identity resolution does not run the Find eligibility gates. Keep the
 * shared v4 funnel explicit without pretending that an identity match passed
 * hard scope, source quality, study relevance, or exposure feasibility.
 */
function auditIdentitySearchFunnel(
  sourceRecordsRetrieved: number,
  uniqueEventLeads: number,
): Screen02SearchFunnel {
  return {
    schemaVersion: SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
    sourceRecordsRetrieved,
    uniqueEventLeads,
    evaluatedUniqueLeads: 0,
    duplicatesRemoved: Math.max(
      0,
      sourceRecordsRetrieved - uniqueEventLeads,
    ),
    hardScopePassed: 0,
    hardScopeDemonstratedMismatch: 0,
    hardScopeInsufficientEvidence: 0,
    hardScopeMixed: 0,
    sourceQualityPassed: 0,
    substantiveInformationPassed: 0,
    relevancePassed: 0,
    exposureFeasibilityPassed: 0,
    qualifiedCandidates: 0,
    displayedCandidates: 0,
    directCandidates: 0,
    adjacentCandidates: 0,
    broadCandidates: 0,
    mismatchCandidates: 0,
    deeperRetrievalAttempts: 0,
    retrievalFailures: 0,
    hostContribution: 0,
  };
}

const reviewedSources = {
  "ccpa-initiative-circulation": {
    id: "reviewed:ccpa-initiative-circulation-17-0039",
    title:
      "Proposed initiative enters circulation: new consumer privacy rights",
    locator:
      "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
    publisher: "California Secretary of State",
    publishedDate: "2017-12-18",
    authorityTier: 1,
    channel: "official-ballot-initiative-announcement",
    userProvided: false,
    evidenceText:
      "The California Secretary of State announced on December 18, 2017 that proposed initiative 17-0039 was cleared to begin collecting petition signatures. This is a precursor consumer-privacy ballot-initiative circulation milestone, not the introduction date of AB 375 and not enactment of the CCPA.",
  },
  "ccpa-statute": {
    id: "reviewed:ccpa-statute-ab375",
    title: "AB-375 Privacy: personal information: businesses",
    locator:
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
    publisher: "California Legislative Information",
    publishedDate: "2018-06-28",
    authorityTier: 1,
    channel: "official-legislation",
    userProvided: false,
    evidenceText:
      "The enrolled AB 375 was approved and filed on June 28, 2018. It enacted the California Consumer Privacy Act of 2018 and made the title operative January 1, 2020. The original act created consumer disclosure, deletion, opt-out, and nondiscrimination rights. Its original business definition covered qualifying for-profit entities doing business in California that collected consumers' personal information and met at least one historical revenue, data-volume, or data-sale threshold. Later amendments changed parts of the coverage rule, so a study must reconstruct the version in force for each year.",
    officialIdentityFields: [{
      field: "canonical-title",
      value: "California Consumer Privacy Act of 2018",
    }],
  },
  "ccpa-overview": {
    id: "reviewed:ccpa-oag-overview",
    title: "California Consumer Privacy Act (CCPA)",
    locator: "https://oag.ca.gov/privacy/ccpa",
    publisher: "California Department of Justice",
    publishedDate: null,
    authorityTier: 2,
    channel: "official-guidance",
    userProvided: false,
    evidenceText:
      "The California Attorney General overview describes CCPA rights and covered-business responsibilities. It explains that the 2020 California Privacy Rights Act amended the CCPA and added protections beginning January 1, 2023; the office generally calls the amended law CCPA rather than treating CPRA as a wholly separate law. The page's current coverage thresholds and exemptions are useful background but do not by themselves establish which historical rule applied to a firm in an earlier study year.",
  },
  "ccpa-oag-implementation": {
    id: "reviewed:ccpa-oag-implementation",
    title: "Attorney General submits CCPA regulations for approval",
    locator:
      "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
    publisher: "California Department of Justice",
    publishedDate: "2020-06-02",
    authorityTier: 2,
    channel: "official-regulator-press-release",
    userProvided: false,
    evidenceText:
      "The California Attorney General reported that the CCPA was signed into law on June 28, 2018, went into effect January 1, 2020, and would be enforced starting July 1, 2020. Screen 3 must fetch the official page before those dates can become direct support.",
  },
  "cpra-amendment": {
    id: "reviewed:cpra-proposition-24",
    title: "Proposition 24: California Privacy Rights Act of 2020",
    locator: "https://vig.cdn.sos.ca.gov/2020/general/pdf/topl-prop24.pdf",
    publisher: "California Secretary of State",
    publishedDate: "2020-11-03",
    authorityTier: 1,
    channel: "official-ballot-measure",
    userProvided: false,
  },
  "ccpa-regulations": {
    id: "reviewed:ccpa-regulations",
    title: "California Consumer Privacy Act Regulations",
    locator: "https://oag.ca.gov/privacy/ccpa/regs",
    publisher: "California Department of Justice",
    publishedDate: null,
    authorityTier: 1,
    channel: "official-rulemaking",
    userProvided: false,
    evidenceText:
      "The California Attorney General states that the CCPA regulations govern compliance, including consumer notices, handling and verifying requests, and rules involving minors. The initial regulations took effect August 14, 2020, amendments took effect March 15, 2021, and later rulemaking authority transferred to the California Privacy Protection Agency. These regulatory dates are distinct from the statute's 2018 enactment and January 1, 2020 operative date.",
  },
  "ccpa-enforcement": {
    id: "reviewed:ccpa-enforcement-sephora",
    title: "Attorney General Bonta Announces Settlement with Sephora",
    locator:
      "https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-settlement-sephora-part-ongoing-enforcement",
    publisher: "California Department of Justice",
    publishedDate: "2022-08-24",
    authorityTier: 1,
    channel: "official-enforcement",
    userProvided: false,
  },
  gdpr: {
    id: "reviewed:gdpr-regulation-2016-679",
    title: "Regulation (EU) 2016/679",
    locator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    publisher: "EUR-Lex",
    publishedDate: "2016-04-27",
    authorityTier: 1,
    channel: "official-legislation",
    userProvided: false,
    officialIdentityFields: [
      {
        field: "canonical-title",
        value: "General Data Protection Regulation",
      },
      {
        field: "formal-identifier",
        value: "Regulation (EU) 2016/679",
      },
    ],
  },
  "gdpr-commission-overview": {
    id: "reviewed:gdpr-commission-legal-framework",
    title: "Legal framework of EU data protection",
    locator:
      "https://commission.europa.eu/law/law-topic/data-protection/legal-framework-eu-data-protection_en",
    publisher: "European Commission",
    publishedDate: null,
    authorityTier: 2,
    channel: "official-guidance",
    userProvided: false,
  },
  dma: {
    id: "reviewed:dma-regulation-2022-1925",
    title: "Regulation (EU) 2022/1925",
    locator: "https://eur-lex.europa.eu/eli/reg/2022/1925/oj",
    publisher: "EUR-Lex",
    publishedDate: "2022-10-12",
    authorityTier: 1,
    channel: "official-legislation",
    userProvided: false,
    officialIdentityFields: [
      {
        field: "canonical-title",
        value:
          "Regulation (EU) 2022/1925 of the European Parliament and of the Council on contestable and fair markets in the digital sector (Digital Markets Act)",
      },
      {
        field: "formal-identifier",
        value: "Regulation (EU) 2022/1925",
      },
    ],
  },
  "dma-commission-overview": {
    id: "reviewed:dma-commission-overview",
    title: "About the Digital Markets Act",
    locator: "https://digital-markets-act.ec.europa.eu/about-dma_en",
    publisher: "European Commission",
    publishedDate: null,
    authorityTier: 2,
    channel: "official-guidance",
    userProvided: false,
  },
} as const satisfies Record<string, ReviewedSource>;

const ccpaIdentity: Screen02EventIdentity = {
  canonicalTitle: "California Consumer Privacy Act of 2018",
  commonNames: ["California Consumer Privacy Act", "CCPA"],
  formalIdentifier: "AB 375 (2017–2018 Reg. Sess.)",
  issuer: "California Legislature",
  issuingJurisdiction: "California, United States",
  eventType: "privacy legislation",
  status: "enacted; subsequently amended",
};

const cpraIdentity: Screen02EventIdentity = {
  canonicalTitle: "California Privacy Rights Act of 2020",
  commonNames: ["California Privacy Rights Act", "CPRA", "Proposition 24"],
  formalIdentifier: "California Proposition 24 (2020)",
  issuer: "California electorate",
  issuingJurisdiction: "California, United States",
  eventType: "ballot initiative and statutory amendment",
  status: "approved; operative provisions implemented",
};

const ccpaRegulationsIdentity: Screen02EventIdentity = {
  canonicalTitle: "California Consumer Privacy Act Regulations",
  commonNames: ["CCPA Regulations"],
  formalIdentifier: "Title 11, California Code of Regulations",
  issuer: "California Department of Justice",
  issuingJurisdiction: "California, United States",
  eventType: "implementing rule",
  status: "adopted and subsequently amended",
};

const ccpaEnforcementIdentity: Screen02EventIdentity = {
  canonicalTitle: "People v. Sephora USA, Inc. CCPA settlement",
  commonNames: ["Sephora CCPA settlement"],
  formalIdentifier: null,
  issuer: "California Department of Justice",
  issuingJurisdiction: "California, United States",
  eventType: "enforcement action",
  status: "settled",
};

const gdprIdentity: Screen02EventIdentity = {
  canonicalTitle: "General Data Protection Regulation",
  commonNames: ["GDPR"],
  formalIdentifier: "Regulation (EU) 2016/679",
  issuer: "European Parliament and Council of the European Union",
  issuingJurisdiction: "European Union",
  eventType: "data-protection regulation",
  status: "in force",
};

const dmaIdentity: Screen02EventIdentity = {
  canonicalTitle:
    "Regulation (EU) 2022/1925 of the European Parliament and of the Council on contestable and fair markets in the digital sector (Digital Markets Act)",
  commonNames: ["EU Digital Markets Act", "Digital Markets Act", "DMA"],
  formalIdentifier: "Regulation (EU) 2022/1925",
  issuer: "European Parliament and Council of the European Union",
  issuingJurisdiction: "European Union",
  eventType: "digital-markets regulation",
  status: "in force",
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function primaryRelationship(
  shockName: string,
  identity: Screen02EventIdentity,
): Screen02AuditRelationship {
  const anchor = normalize(shockName);
  if (
    anchor === normalize(identity.canonicalTitle) ||
    anchor === normalize(identity.formalIdentifier)
  ) {
    return "exact";
  }
  if (identity.commonNames.some((name) => normalize(name) === anchor)) {
    return "supported-alias";
  }
  return "uncertain";
}

const reviewedRecords: ReviewedRecord[] = [
  {
    key: "ccpa",
    identity: ccpaIdentity,
    versionType: "original",
    relationship: "original",
    sourceKey: "ccpa-statute",
    supportingSourceKeys: [
      "ccpa-initiative-circulation",
      "ccpa-overview",
      "ccpa-oag-implementation",
      "ccpa-regulations",
    ],
    aliases: [
      "CCPA original",
      "original CCPA",
      "AB 375",
      reviewedSources["ccpa-statute"].title,
    ],
    signalTerms: [
      "CCPA",
      "California Consumer Privacy Act",
      "AB 375",
    ],
    relatedRecordKeys: [
      "ccpa",
      "cpra",
      "ccpa-regulations",
      "ccpa-enforcement",
    ],
    years: ["2018"],
    relationshipReason:
      "This is the original enacted CCPA record; later amendments, rules, and enforcement acts remain distinct identities.",
    limitations: [
      "The original statute, later amendment, implementing rules, and enforcement acts remain distinct records.",
    ],
  },
  {
    key: "cpra",
    identity: cpraIdentity,
    versionType: "amendment",
    relationship: "amendment",
    sourceKey: "cpra-amendment",
    aliases: ["CPRA amendment", reviewedSources["cpra-amendment"].title],
    signalTerms: [
      "CPRA",
      "California Privacy Rights Act",
      "Proposition 24",
    ],
    relatedRecordKeys: [
      "ccpa",
      "cpra",
      "ccpa-regulations",
      "ccpa-enforcement",
    ],
    years: ["2020"],
    relationshipReason:
      "CPRA is a later statutory amendment and expansion, not an interchangeable identity for the original CCPA enactment.",
    limitations: ["Version-specific effective dates require later verification."],
  },
  {
    key: "ccpa-regulations",
    identity: ccpaRegulationsIdentity,
    versionType: "implementing-rule",
    relationship: "implementing-rule",
    sourceKey: "ccpa-regulations",
    aliases: [
      "CCPA implementing regulations",
      "CCPA implementing rules",
      reviewedSources["ccpa-regulations"].title,
    ],
    signalTerms: ["CCPA regulations", "CCPA implementing rules"],
    relatedRecordKeys: [
      "ccpa",
      "cpra",
      "ccpa-regulations",
      "ccpa-enforcement",
    ],
    years: ["2020"],
    relationshipReason:
      "The regulations implement the CCPA but remain a distinct rulemaking record.",
    limitations: ["Regulatory amendment history requires later verification."],
  },
  {
    key: "ccpa-enforcement",
    identity: ccpaEnforcementIdentity,
    versionType: "enforcement-action",
    relationship: "enforcement-action",
    sourceKey: "ccpa-enforcement",
    aliases: [
      "Sephora CCPA enforcement action",
      "Sephora enforcement action",
      reviewedSources["ccpa-enforcement"].title,
    ],
    signalTerms: ["Sephora CCPA", "CCPA enforcement"],
    relatedRecordKeys: [
      "ccpa",
      "cpra",
      "ccpa-regulations",
      "ccpa-enforcement",
    ],
    years: ["2022"],
    relationshipReason:
      "The settlement is an enforcement act under the CCPA, not the statute itself.",
    limitations: [
      "This reviewed record is one enforcement example, not an exhaustive series.",
    ],
  },
  {
    key: "gdpr",
    identity: gdprIdentity,
    versionType: "original",
    relationship: "original",
    sourceKey: "gdpr",
    supportingSourceKeys: ["gdpr-commission-overview"],
    aliases: [reviewedSources.gdpr.title],
    signalTerms: [
      "GDPR",
      "General Data Protection Regulation",
      "Regulation EU 2016 679",
    ],
    relatedRecordKeys: ["gdpr"],
    years: ["2016"],
    relationshipReason:
      "This is the official GDPR regulation record identified by the structured anchor.",
    limitations: [
      "Study geography and period remain reserved for post-confirmation fit assessment and do not exclude this identity match.",
    ],
  },
  {
    key: "dma",
    identity: dmaIdentity,
    versionType: "original",
    relationship: "original",
    sourceKey: "dma",
    supportingSourceKeys: ["dma-commission-overview"],
    aliases: [reviewedSources.dma.title],
    signalTerms: [
      "DMA",
      "Digital Markets Act",
      "EU Digital Markets Act",
      "Regulation EU 2022 1925",
    ],
    relatedRecordKeys: ["dma"],
    locatorRequiresIdentitySignal: true,
    years: ["2022"],
    relationshipReason:
      "This is the official Digital Markets Act regulation record identified by the structured anchor.",
    limitations: [
      "Gatekeeper designation and service-specific compliance dates remain distinct from the regulation's general application date.",
    ],
  },
];

function identityNames(record: ReviewedRecord) {
  return [
    record.identity.canonicalTitle,
    record.identity.formalIdentifier,
    ...record.identity.commonNames,
  ].filter((value): value is string => Boolean(value));
}

function normalizedLocator(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("en-US").replace(/\/+$/, "");
}

function structuredDirectRelationship(
  fields: Screen02AuditAnchorFields,
  record: ReviewedRecord,
): "exact" | "supported-alias" | null {
  const shockName = normalize(fields.shockName);
  const sourceLocator = normalizedLocator(fields.sourceLocator);
  const positiveIdentityText = [
    positiveAuditRecallText(fields.shockName),
    positiveAuditRecallText(fields.distinguishingFeature),
    positiveAuditRecallText(fields.clarification),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
  const hasPositiveIdentitySignal = [
    ...identityNames(record),
    ...record.aliases,
    ...record.signalTerms,
  ].some((name) => containsNormalizedPhrase(positiveIdentityText, name));
  if (
    sourceLocator.length > 0 &&
    sourceLocator === normalizedLocator(reviewedSources[record.sourceKey].locator) &&
    (!record.locatorRequiresIdentitySignal || hasPositiveIdentitySignal)
  ) {
    return "exact";
  }
  if (
    shockName === normalize(record.identity.canonicalTitle) ||
    shockName === normalize(record.identity.formalIdentifier)
  ) {
    return "exact";
  }
  if (
    [...record.identity.commonNames, ...record.aliases].some(
      (name) => normalize(name) === shockName,
    )
  ) {
    return "supported-alias";
  }
  return null;
}

function containsNormalizedPhrase(value: string, phrase: string) {
  const haystack = ` ${normalize(value)} `;
  const needle = normalize(phrase);
  return needle.length > 0 && haystack.includes(` ${needle} `);
}

function positiveAuditRecallText(value: string | null | undefined) {
  return value?.replace(/\b(?:not(?!\s+only\b)|rather than|instead of|excluding|exclude|without)\b[^.;!?]*/giu, " ");
}

function recordScore(fields: Screen02AuditAnchorFields, record: ReviewedRecord) {
  let score = 0;
  const directRelationship = structuredDirectRelationship(fields, record);
  if (directRelationship) score += 10_000;
  if (
    fields.versionType !== "unspecified" &&
    fields.versionType === record.versionType
  ) {
    score += 20_000;
  }
  if (
    fields.approximateYear &&
    record.years.some((year) => normalize(fields.approximateYear).includes(year))
  ) {
    score += 4_000;
  }
  const distinguishingText = [
    positiveAuditRecallText(fields.distinguishingFeature),
    positiveAuditRecallText(fields.clarification),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
  if (
    distinguishingText &&
    [...identityNames(record), ...record.aliases].some((name) =>
      containsNormalizedPhrase(distinguishingText, name),
    )
  ) {
    score += 3_000;
  }
  const issuingAuthority = fields.issuingAuthority;
  const recordIssuer = record.identity.issuer;
  if (
    issuingAuthority &&
    recordIssuer &&
    (containsNormalizedPhrase(issuingAuthority, recordIssuer) ||
      containsNormalizedPhrase(recordIssuer, issuingAuthority))
  ) {
    score += 500;
  }
  const jurisdiction = fields.jurisdiction;
  const recordJurisdiction = record.identity.issuingJurisdiction;
  if (
    jurisdiction &&
    recordJurisdiction &&
    (containsNormalizedPhrase(jurisdiction, recordJurisdiction) ||
      containsNormalizedPhrase(recordJurisdiction, jurisdiction))
  ) {
    score += 100;
  }
  return score;
}

function reviewedMatches(fields: Screen02AuditAnchorFields): ReviewedMatch[] {
  const identityText = [
    positiveAuditRecallText(fields.shockName),
    positiveAuditRecallText(fields.distinguishingFeature),
    fields.sourceLocator,
    positiveAuditRecallText(fields.clarification),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
  const directRecords = reviewedRecords.filter((record) =>
    structuredDirectRelationship(fields, record),
  );
  const selectedKeys = new Set<string>();
  for (const record of reviewedRecords) {
    const matched =
      directRecords.includes(record) ||
      [...identityNames(record), ...record.aliases, ...record.signalTerms].some(
        (signal) => containsNormalizedPhrase(identityText, signal),
      );
    if (!matched) continue;
    selectedKeys.add(record.key);
    for (const relatedKey of record.relatedRecordKeys) {
      selectedKeys.add(relatedKey);
    }
  }
  if (selectedKeys.size === 0) return [];

  return reviewedRecords
    .map((record, index) => ({
      record,
      index,
      score: recordScore(fields, record),
    }))
    .filter(({ record }) => selectedKeys.has(record.key))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ record }) => {
      const directRelationship = structuredDirectRelationship(fields, record);
      return {
        key: record.key,
        identity: record.identity,
        relationship: directRelationship ?? record.relationship,
        sourceKeys: [record.sourceKey, ...(record.supportingSourceKeys ?? [])],
        relationshipReason: directRelationship
          ? directRelationship === "exact"
            ? "The structured anchor directly identifies this official version record."
            : "The structured anchor uses a reviewed name or alias for this version record."
          : record.relationshipReason,
        limitations: [...record.limitations],
      };
    });
}

function materializeSource(
  state: Screen02AuditState,
  source: ReviewedSource,
  at: string,
) {
  const prior = state.sources.find((item) => item.id === source.id);
  if (prior) return prior;
  const { officialIdentityFields: _officialIdentityFields, ...workflowSource } =
    source;
  const base = { ...workflowSource, retrievedAt: at };
  return {
    ...base,
    sourceFingerprint: fingerprintScreen02WorkflowSource({
      ...base,
      sourceFingerprint: "pending",
    }),
  } satisfies Screen02WorkflowSource;
}

/**
 * Recover identity-only official fields from the fixed reviewed Audit catalog.
 * A matching ID alone is insufficient: every persisted source coordinate must
 * still equal the reviewed record, so a restored or forged variant receives no
 * promotion. Substantive claims continue to require a fetched passage.
 */
export function reviewedScreen02AuditOfficialIdentityFields(
  source: Screen02WorkflowSource,
): NonNullable<ReviewedSource["officialIdentityFields"]> {
  const reviewed = (Object.values(reviewedSources) as ReviewedSource[]).find(
    (candidate) =>
      candidate.title === source.title &&
      candidate.locator === source.locator &&
      candidate.publisher === source.publisher &&
      candidate.publishedDate === source.publishedDate &&
      candidate.authorityTier === source.authorityTier &&
      candidate.channel === source.channel &&
      candidate.userProvided === source.userProvided &&
      candidate.evidenceText === source.evidenceText,
  );
  if (!reviewed?.officialIdentityFields) return [];
  const {
    officialIdentityFields,
    ...reviewedWorkflowSource
  } = reviewed;
  const exactCoordinate = (
    [
      "title",
      "locator",
      "publisher",
      "publishedDate",
      "authorityTier",
      "channel",
      "userProvided",
      "evidenceText",
    ] as const
  ).every((key) => source[key] === reviewedWorkflowSource[key]);
  return exactCoordinate
    ? officialIdentityFields.map((item) => ({ ...item }))
    : [];
}

export function buildReviewedScreen02AuditDiscovery(
  state: Screen02AuditState,
  input: {
    matchSetSnapshotId: string;
    at: string;
    exactRequest?: string;
    maximumMatches?: number;
  },
) {
  const safe = requireScreen02AuditState(state);
  const anchor = safe.anchor.revisions.find(
    (revision) => revision.anchorRevisionId === safe.anchor.activeRevisionId,
  )!;
  const selected = reviewedMatches(anchor.fields).slice(
    0,
    Math.max(0, Math.min(input.maximumMatches ?? 12, 12)),
  );
  const keys = [...new Set(selected.flatMap((match) => match.sourceKeys))];
  const sources = keys.map((key) =>
    materializeSource(safe, reviewedSources[key as keyof typeof reviewedSources], input.at),
  );
  const sourceIdByKey = new Map(
    keys.map((key, index) => [key, sources[index]!.id]),
  );
  const matches: Screen02AuditSearchMatchInput[] = selected.map((match) => ({
    matchId: `${input.matchSetSnapshotId}:${match.key}`,
    matchSnapshotId: `${input.matchSetSnapshotId}:${match.key}:match`,
    identitySnapshotId: `${input.matchSetSnapshotId}:${match.key}:identity`,
    identity: { ...match.identity, commonNames: [...match.identity.commonNames] },
    relationship: match.relationship,
    relationshipReason: match.relationshipReason,
    sourceIds: match.sourceKeys.map((key) => sourceIdByKey.get(key)!),
    limitations: [...match.limitations],
  }));
  const exactRequest =
    input.exactRequest ??
    `Resolve the named shock from the structured anchor: ${anchor.fields.shockName}. Preserve the original wording: ${safe.anchor.originalWording}.`;
  const queryId = `${input.matchSetSnapshotId}:anchor-query`;
  const reviewedRecordIds = selected.map(
    (match) => `reviewed-catalog:${match.key}`,
  );
  const funnel = auditIdentitySearchFunnel(selected.length, matches.length);
  const manifest: Screen02WorkflowSearchManifest = {
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
    exactRequest,
    queryMatrix: [
      {
        id: queryId,
        query: [
          anchor.fields.shockName,
          anchor.fields.jurisdiction,
          anchor.fields.issuingAuthority,
          anchor.fields.approximateYear,
          anchor.fields.versionType,
          anchor.fields.distinguishingFeature,
          anchor.fields.sourceLocator,
          anchor.fields.clarification,
        ]
          .filter(Boolean)
          .join(" | "),
        purpose:
          "Resolve identity and version relationships from the named-shock anchor without study-fit exclusions.",
        returnedRecordIds: reviewedRecordIds,
      },
    ],
    channels: [
      {
        channel: "reviewed-official-records",
        status: "searched",
        note:
          "Reviewed identity records were matched from the active anchor; study geography and period were not hard filters.",
        retrievedAt: input.at,
      },
    ],
    exclusions: [],
    funnel,
    retrievalExecution: buildScreen02RetrievalExecution({
      baseline: {
        phase: "baseline",
        status: "completed",
        queryIds: [queryId],
        stoppingReason: "routes-exhausted",
        queriesPlanned: 1,
        queriesAttempted: 1,
        queriesSucceeded: 1,
        queriesFailed: 0,
        roundsExecuted: 1,
        recordsReceived: selected.length,
        proposalsGenerated: matches.length,
        uniqueProposalsGenerated: matches.length,
      },
    }),
    stoppingRule: {
      rule:
        "Stop after resolving a reviewed official identity record and keeping distinct version relationships visible.",
      status: "met",
      note:
        matches.length > 0
          ? "The reviewed catalog produced an anchor-supported identity set."
          : "No reviewed fixed-catalog identity matched; use a structured researcher source or record no match.",
    },
    retainedResultBinding: buildScreen02RetainedResultBinding(
      "audit",
      {
        sourceRecordsRetrieved: funnel.sourceRecordsRetrieved,
        uniqueEventLeads: funnel.uniqueEventLeads,
      },
      matches.map((match, index) => ({
        recordId: match.matchId,
        snapshotId: match.matchSnapshotId,
        sourceIds: [...match.sourceIds],
        qualificationLane: null,
        origins: [
          {
            kind: "query-result",
            retrievalLane: "reviewed-catalog",
            evidenceRole: "identity",
            producerRecordId: reviewedRecordIds[index]!,
            queryId,
            returnedRecordIds: [reviewedRecordIds[index]!],
            sourceIds: [...match.sourceIds],
          },
        ],
      })),
    ),
    retrievedAt: input.at,
    outcomeValuesInspected: false,
  };
  return {
    matchSetSnapshotId: input.matchSetSnapshotId,
    sources,
    matches,
    manifest,
    at: input.at,
  } satisfies Screen02AuditDiscoveryResult;
}

export function applyReviewedScreen02AuditDiscovery(
  state: Screen02AuditState,
  input: Parameters<typeof buildReviewedScreen02AuditDiscovery>[1],
) {
  return applyScreen02AuditMatchRound(
    state,
    buildReviewedScreen02AuditDiscovery(state, input),
  );
}

export function applyResearcherSourceScreen02AuditDiscovery(
  state: Screen02AuditState,
  input: {
    matchSetSnapshotId: string;
    matchId: string;
    matchSnapshotId: string;
    identitySnapshotId: string;
    identity: Screen02EventIdentity;
    relationship?: "exact" | "supported-alias" | "uncertain";
    relationshipReason: string;
    limitations?: string[];
    at: string;
    exactRequest?: string;
  },
) {
  const safe = requireScreen02AuditState(state);
  const anchor = safe.anchor.revisions.find(
    (revision) => revision.anchorRevisionId === safe.anchor.activeRevisionId,
  )!;
  const source = safe.sources.find(
    (item) =>
      item.userProvided && item.locator === anchor.fields.sourceLocator,
  );
  if (!source) {
    throw new Error(
      "Researcher-source discovery requires the active structured anchor to reference an attached user-provided source.",
    );
  }
  const relationship =
    input.relationship ?? primaryRelationship(anchor.fields.shockName, input.identity);
  const queryId = `${input.matchSetSnapshotId}:researcher-source-query`;
  const funnel = auditIdentitySearchFunnel(1, 1);
  const manifest: Screen02WorkflowSearchManifest = {
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
    exactRequest:
      input.exactRequest ??
      `Resolve ${anchor.fields.shockName} from researcher source ${source.id}.`,
    queryMatrix: [
      {
        id: queryId,
        query: `${anchor.fields.shockName} | ${source.locator}`,
        purpose:
          "Resolve an acronym or named shock through the explicit structured anchor and attached researcher source.",
        returnedRecordIds: [source.id],
      },
    ],
    channels: [
      {
        channel: "researcher-provided-source",
        status: "searched",
        note:
          "The attached source was used only for identity resolution; study-fit exclusions were not applied.",
        retrievedAt: input.at,
      },
    ],
    exclusions: [],
    funnel,
    retrievalExecution: buildScreen02RetrievalExecution({
      baseline: {
        phase: "baseline",
        status: "completed",
        queryIds: [queryId],
        stoppingReason: "routes-exhausted",
        queriesPlanned: 1,
        queriesAttempted: 1,
        queriesSucceeded: 1,
        queriesFailed: 0,
        roundsExecuted: 1,
        recordsReceived: 1,
        proposalsGenerated: 1,
        uniqueProposalsGenerated: 1,
      },
    }),
    stoppingRule: {
      rule: "Stop after recording the source-bound identity for researcher review.",
      status: "met",
      note: "One explicit researcher-source identity record was preserved.",
    },
    retainedResultBinding: buildScreen02RetainedResultBinding(
      "audit",
      {
        sourceRecordsRetrieved: funnel.sourceRecordsRetrieved,
        uniqueEventLeads: funnel.uniqueEventLeads,
      },
      [
        {
          recordId: input.matchId,
          snapshotId: input.matchSnapshotId,
          sourceIds: [source.id],
          qualificationLane: null,
          origins: [
            {
              kind: "query-result",
              retrievalLane: "researcher-source",
              evidenceRole: "identity",
              producerRecordId: source.id,
              queryId,
              returnedRecordIds: [source.id],
              sourceIds: [source.id],
            },
          ],
        },
      ],
    ),
    retrievedAt: input.at,
    outcomeValuesInspected: false,
  };
  return applyScreen02AuditMatchRound(safe, {
    matchSetSnapshotId: input.matchSetSnapshotId,
    sources: [source],
    matches: [
      {
        matchId: input.matchId,
        matchSnapshotId: input.matchSnapshotId,
        identitySnapshotId: input.identitySnapshotId,
        identity: input.identity,
        relationship,
        relationshipReason: input.relationshipReason,
        sourceIds: [source.id],
        limitations: input.limitations ?? [
          "Researcher-provided material remains Tier 6 until independently corroborated.",
        ],
      },
    ],
    manifest,
    at: input.at,
  });
}
