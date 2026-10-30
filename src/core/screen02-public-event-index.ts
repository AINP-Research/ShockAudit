import recordsJson from "../data/screen02-public-event-index.v1.json" with {
  type: "json",
};
import type {
  Screen02FindProposal,
  Screen02Source,
} from "./screen02-types";

export const SCREEN02_PUBLIC_EVENT_INDEX_VERSION =
  "screen-02-public-event-index-2026-10-28-v3" as const;
export const SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT = "2026-10-28" as const;

export const screen02PublicEventDateRoles = [
  "announcement",
  "adoption",
  "enactment",
  "scheduled_effect",
  "effective",
  "implementation",
  "enforcement",
  "amendment",
  "publication",
  "occurrence",
  "ruling",
  "injunction",
  "invalidation",
  "withdrawal",
  "repeal",
  "supersession",
  "other",
] as const;
export type Screen02PublicEventDateRole =
  (typeof screen02PublicEventDateRoles)[number];

export type Screen02PublicEventDateDetail = {
  date: string;
  role: Screen02PublicEventDateRole;
  label: string;
  sourceIds: string[];
  uncertainty: string;
  /** Retain later lifecycle context for direct policy review without changing
   * the bounded event episode used by broad discovery. */
  identityChronologyOnly?: boolean;
};

type Screen02PublicEventIndexRecord = {
  id: string;
  /** Available for exact identity lookup without changing broad discovery cohorts. */
  identitySearchOnly?: boolean;
  title: string;
  description: string;
  eventDate: string;
  eventFamily: string;
  capturedAt: string;
  captureOrigin: "permitted-public-source-inspection";
  geographies: string[];
  populations: string[];
  affectedPopulation: string;
  requiredVariables: string[];
  outcomeHypothesis: string;
  limitations: string[];
  reasons: string[];
  nativeIdentity: NonNullable<Screen02FindProposal["nativeIdentity"]>;
  relationshipEvidenceSourceIds?: string[];
  dateDetails: Screen02PublicEventDateDetail[];
  sources: Screen02Source[];
};

function fail(message: string): never {
  throw new Error(`Invalid Screen 2 public-event index: ${message}`);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireRecords(value: unknown): Screen02PublicEventIndexRecord[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    fail("records must be a non-empty bounded array");
  }
  const ids = new Set<string>();
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      fail(`record ${index + 1} must be an object`);
    }
    const record = candidate as unknown as Screen02PublicEventIndexRecord;
    if (!nonempty(record.id) || ids.has(record.id)) {
      fail(`record ${index + 1} has a missing or duplicate stable id`);
    }
    ids.add(record.id);
    if (
      !nonempty(record.title) || !nonempty(record.description) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(record.eventDate) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(record.capturedAt) ||
      record.captureOrigin !== "permitted-public-source-inspection" ||
      !nonempty(record.eventFamily) || !Array.isArray(record.geographies) ||
      record.geographies.length === 0 || !Array.isArray(record.populations) ||
      record.populations.length === 0 || !nonempty(record.affectedPopulation) ||
      !Array.isArray(record.requiredVariables) ||
      !nonempty(record.outcomeHypothesis) || !Array.isArray(record.limitations) ||
      record.limitations.length === 0 || !Array.isArray(record.reasons) ||
      record.reasons.length === 0 || !record.nativeIdentity ||
      !Array.isArray(record.dateDetails) || record.dateDetails.length === 0 ||
      !Array.isArray(record.sources) || record.sources.length === 0 ||
      (record.identitySearchOnly !== undefined &&
        typeof record.identitySearchOnly !== "boolean")
    ) {
      fail(`${record.id} is missing required concise event fields`);
    }
    const sourceIds = new Set(record.sources.map((source) => source.id));
    if (
      sourceIds.size !== record.sources.length ||
      record.sources.some((source) =>
        !nonempty(source.id) || !nonempty(source.title) ||
        !nonempty(source.locator) || !nonempty(source.publisher) ||
        !nonempty(source.channel) || !nonempty(source.evidenceText) ||
        !nonempty(source.retrievedAt) || source.authorityTier > 5
      )
    ) {
      fail(`${record.id} has an invalid, duplicate, or unsupported source`);
    }
    if (
      record.relationshipEvidenceSourceIds?.some((id) => !sourceIds.has(id)) ||
      record.dateDetails.some((detail) =>
        !/^\d{4}-\d{2}-\d{2}$/u.test(detail.date) ||
        !screen02PublicEventDateRoles.includes(detail.role) ||
        !nonempty(detail.label) || !nonempty(detail.uncertainty) ||
        (detail.identityChronologyOnly !== undefined &&
          typeof detail.identityChronologyOnly !== "boolean") ||
        !Array.isArray(detail.sourceIds) || detail.sourceIds.length === 0 ||
        detail.sourceIds.some((id) => !sourceIds.has(id))
      ) ||
      !record.dateDetails.some((detail) => detail.date === record.eventDate)
    ) {
      fail(`${record.id} has an invalid source-bound date or relationship`);
    }
    return structuredClone(record);
  });
}

const INDEX_RECORDS = requireRecords(recordsJson);

const PUBLIC_INDEX_RECORDS_BY_ID = new Map(
  INDEX_RECORDS.map((record) => [record.id, record] as const),
);

const PUBLIC_INDEX_GENERIC_MATCH_TERMS = new Set([
  "all", "and", "any", "business", "businesses", "company", "companies",
  "consumer", "consumers", "data", "digital", "firm", "firms", "industry",
  "industries", "information", "online", "organization", "organizations",
  "platform", "platforms", "public", "provider", "providers", "sector",
  "sectors", "service", "services", "states", "the", "united", "user",
  "users", "kingdom", "operation", "operations", "production",
]);

function singularPublicIndexToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && token.length > 4 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizePublicIndexSearchText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/gu, " and ")
    .replace(/['’]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")
    .split(" ")
    .map(singularPublicIndexToken)
    .join(" ");
}

function publicIndexSearchTerms(values: readonly string[]) {
  return [...new Set(values
    .map(normalizePublicIndexSearchText)
    .filter((value) =>
      value.length >= 4 && !PUBLIC_INDEX_GENERIC_MATCH_TERMS.has(value)
    ))];
}

function publicIndexTextContains(text: string, term: string) {
  return ` ${text} `.includes(` ${term} `);
}

/**
 * Search the source-backed record itself, never an ID prefix or case label.
 * This is a deliberately conservative first-pass retrieval filter; final
 * relevance still belongs to the common qualifier. Callers may supply the
 * current profile's aliases, products, actors, and activities so adjacent
 * records remain discoverable without treating generic organization words as
 * an industry bridge.
 */
export function screen02PublicEventIndexMatchesScope(
  proposalId: string,
  industry: string,
  geography: string,
  profileIndustryTerms: readonly string[] = [],
  profileGeographyTerms: readonly string[] = [],
) {
  const record = PUBLIC_INDEX_RECORDS_BY_ID.get(proposalId);
  if (!record) return null;
  const geographyText = normalizePublicIndexSearchText([
    ...record.geographies,
    record.nativeIdentity.issuingJurisdiction,
  ].filter(nonempty).join(" "));
  const geographyTerms = publicIndexSearchTerms([
    geography,
    ...profileGeographyTerms,
  ]);
  if (
    geographyTerms.length === 0 ||
    !geographyTerms.some((term) => publicIndexTextContains(geographyText, term))
  ) {
    return false;
  }

  const industryText = normalizePublicIndexSearchText([
    record.title,
    record.description,
    record.affectedPopulation,
    ...record.populations,
    ...record.reasons,
    ...record.sources.flatMap((source) => [source.title, source.evidenceText]),
  ].join(" "));
  const industryTerms = publicIndexSearchTerms([
    industry,
    ...profileIndustryTerms,
  ]);
  return industryTerms.length > 0 && industryTerms.some((term) =>
    publicIndexTextContains(industryText, term)
  );
}

function provisionalIndexAssessments(): NonNullable<
  Screen02FindProposal["assessments"]
> {
  return {
    exposureObservability: {
      value: null,
      reason:
        "Screen 2 has documentary support for investigation, but organization-level exposure and linkage remain Screen 3 work.",
    },
    timeSupport: {
      value: null,
      reason:
        "The indexed date keeps its documented role; Screen 3 must choose and verify any treatment clock.",
    },
    variation: {
      value: null,
      reason:
        "Usable comparison variation remains unknown until the selected event is investigated against the research sample.",
    },
  };
}

function publicEventIndexProposal(
  record: Screen02PublicEventIndexRecord,
): Screen02FindProposal {
  return {
    id: record.id,
    mode: "find",
    kind: "event",
    title: record.title,
    description: record.description,
    nativeIdentity: structuredClone(record.nativeIdentity),
    ...(record.relationshipEvidenceSourceIds
      ? { relationshipEvidenceSourceIds: [...record.relationshipEvidenceSourceIds] }
      : {}),
    event: {
      displayName: record.title,
      eventDate: record.eventDate,
      eventFamily: record.eventFamily,
      geographies: [...record.geographies],
      populations: [...record.populations],
    },
    origin: "registry-reviewed",
    provisionalDates: record.dateDetails
      .filter((detail) => !detail.identityChronologyOnly)
      .map((detail) => detail.date),
    affectedPopulation: record.affectedPopulation,
    requiredVariables: [...record.requiredVariables],
    outcomeLink: {
      text: record.outcomeHypothesis,
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      ...record.limitations,
      "Selection starts an investigation; it does not confirm the event, treatment clock, coverage, exposure, or causal design.",
    ],
    reasons: [...record.reasons],
    sources: record.sources.map((source) => structuredClone(source)),
    assessments: provisionalIndexAssessments(),
  };
}

export const PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS:
  readonly Screen02FindProposal[] = INDEX_RECORDS
    .filter((record) => !record.identitySearchOnly)
    .map(publicEventIndexProposal);

/** Direct-name policy lookup can use these records without adding them to the
 * broad Screen 2 event-discovery candidate pool. */
export const PUBLIC_SCREEN02_IDENTITY_ONLY_PROPOSALS:
  readonly Screen02FindProposal[] = INDEX_RECORDS
    .filter((record) => record.identitySearchOnly)
    .map(publicEventIndexProposal);

export const PUBLIC_SCREEN02_EVENT_DATE_DETAILS: Readonly<
  Record<string, Readonly<Record<string, Screen02PublicEventDateDetail>>>
> = Object.fromEntries(INDEX_RECORDS.map((record) => [
  record.id,
  Object.fromEntries(record.dateDetails.map((detail) => [
    detail.date,
    structuredClone(detail),
  ])),
]));

export const SCREEN02_PUBLIC_EVENT_INDEX_COVERAGE = Object.freeze({
  schemaVersion: "screen-02-public-event-index-coverage-v1",
  indexVersion: SCREEN02_PUBLIC_EVENT_INDEX_VERSION,
  capturedAt: SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT,
  captureOrigin: "bounded public-source ingestion",
  recordCaptureOrigins: [...new Set(INDEX_RECORDS.map((record) =>
    record.captureOrigin
  ))].sort(),
  reviewClaim: "Source records were inspected for this release; no Worker or human-review identity is fabricated.",
  recordCount: INDEX_RECORDS.length,
  eventFamilies: [...new Set(INDEX_RECORDS.map((record) => record.eventFamily))]
    .sort(),
  jurisdictions: [...new Set(INDEX_RECORDS.flatMap((record) =>
    record.geographies
  ))].sort(),
  earliestDate: [...INDEX_RECORDS.map((record) => record.eventDate)].sort()[0],
  latestDate: [...INDEX_RECORDS.map((record) => record.eventDate)].sort().at(-1),
  sourceCount: new Set(INDEX_RECORDS.flatMap((record) =>
    record.sources.map((source) => source.id)
  )).size,
});
