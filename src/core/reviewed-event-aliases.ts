/**
 * Versioned reviewed event-name data. Named events may appear here as curated
 * data; consumers must apply the same generic matching and domain policies to
 * every record and must never branch on a record ID or title.
 */
export const REVIEWED_EVENT_ALIAS_DATA_VERSION =
  "reviewed-event-aliases-2026-09-03-v1" as const;

export type ReviewedEventMechanismDomain = "privacy";

export type ReviewedEventAliasRecord = {
  canonicalName: string;
  aliases: readonly string[];
  eventFamily: "Regulation";
  mechanismDomains: readonly ReviewedEventMechanismDomain[];
};

export const REVIEWED_EVENT_ALIAS_RECORDS = [
  {
    canonicalName: "California Consumer Privacy Act",
    aliases: [
      "California Consumer Privacy Act of 2018",
      "California Consumer Privacy Act",
      "CCPA",
    ],
    eventFamily: "Regulation",
    mechanismDomains: ["privacy"],
  },
  {
    canonicalName: "California Privacy Rights Act",
    aliases: [
      "California Privacy Rights Act of 2020",
      "California Privacy Rights Act",
      "Proposition 24",
      "CPRA",
    ],
    eventFamily: "Regulation",
    mechanismDomains: ["privacy"],
  },
  {
    canonicalName: "General Data Protection Regulation",
    aliases: [
      "EU General Data Protection Regulation",
      "General Data Protection Regulation",
      "GDPR",
    ],
    eventFamily: "Regulation",
    mechanismDomains: ["privacy"],
  },
  {
    canonicalName: "Sarbanes–Oxley Act",
    aliases: [
      "Sarbanes-Oxley Act of 2002",
      "Sarbanes-Oxley Act",
      "Sarbanes–Oxley Act",
      "SOX Act",
      "SOX",
    ],
    eventFamily: "Regulation",
    mechanismDomains: [],
  },
] as const satisfies readonly ReviewedEventAliasRecord[];

export type ReviewedEventAliasMatch = {
  record: ReviewedEventAliasRecord;
  matchedAlias: string;
};

export function normalizeReviewedEventAliasText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function matchReviewedEventAliases(
  value: string,
): ReviewedEventAliasMatch[] {
  const normalizedValue = normalizeReviewedEventAliasText(value);
  if (!normalizedValue) return [];
  const paddedValue = ` ${normalizedValue} `;
  const matches: ReviewedEventAliasMatch[] = [];
  for (const record of REVIEWED_EVENT_ALIAS_RECORDS) {
    const matchedAlias = [...record.aliases]
      .sort((left, right) => right.length - left.length)
      .find((alias) => {
        const normalizedAlias = normalizeReviewedEventAliasText(alias);
        return normalizedAlias.length > 0 &&
          paddedValue.includes(` ${normalizedAlias} `);
      });
    if (matchedAlias) matches.push({ record, matchedAlias });
  }
  return matches;
}

export function reviewedEventHasMechanismDomain(
  value: string,
  domain: ReviewedEventMechanismDomain,
) {
  return matchReviewedEventAliases(value).some(({ record }) =>
    record.mechanismDomains.includes(domain)
  );
}
