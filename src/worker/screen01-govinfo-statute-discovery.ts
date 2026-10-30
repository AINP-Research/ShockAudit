import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { SixScreenWorkflowState, TypedDate } from
  "../core/six-screen/contracts";
import type { IdentityCandidateInput } from
  "../core/six-screen/workflow";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  officialDocumentAccessChallenge,
  visibleOfficialDocumentText,
} from "./official-document-html";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";
import { acquireCongressPublicLawIdentity } from
  "./screen01-congress-statute-identity";

export const SCREEN_01_GOVINFO_STATUTE_DISCOVERY_VERSION =
  "govinfo-public-law-name-discovery-v3" as const;
export const SCREEN_01_GOVINFO_SEARCH_URL =
  "https://api.govinfo.gov/search" as const;

const MAXIMUM_SEARCH_BYTES = 256 * 1024;
const MAXIMUM_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAXIMUM_RESULTS = 10;
const MAXIMUM_VALIDATED_DOCUMENTS = 3;

export type Screen01GovInfoStatuteDiscoveryResult = {
  status: "resolved" | "no_match" | "source_unavailable" | "not_configured";
  candidates: IdentityCandidateInput[];
  attemptedSources: string[];
  limitation: string | null;
  usage: {
    sourceQueries: number;
    metadataRecords: number;
    documentAttempts: number;
    usefulDocuments: number;
    transportHops: number;
    receivedBytes: number;
    decodedBytes: number;
  };
};

type GovInfoSearchResult = {
  title: string;
  packageId: string;
  dateIssued: string | null;
  resultLink: string;
  governmentAuthor: string[];
  relatedIdentifiers: string[];
};

function usage() {
  return {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
  };
}

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? value
    : null;
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

const GENERIC = new Set([
  "a", "an", "and", "act", "for", "law", "of", "public", "the", "to",
]);

function words(value: string) {
  return normalize(value).split(" ").filter((word) =>
    word.length > 1 && !GENERIC.has(word) && !/^\d{4}$/u.test(word));
}

function similarity(query: string, names: readonly string[]) {
  const queryText = normalize(query);
  const queryWords = new Set(words(query));
  let best = 0;
  for (const name of names) {
    const text = normalize(name);
    if (!text) continue;
    if (queryText === text) return 1;
    if (text.includes(queryText) || queryText.includes(text)) best = Math.max(best, .92);
    const nameWords = new Set(words(name));
    const overlap = [...queryWords].filter((word) => nameWords.has(word)).length;
    const union = new Set([...queryWords, ...nameWords]).size;
    if (union) best = Math.max(best, overlap / union);
  }
  return best;
}

function escapedSearchPhrase(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")
    .replace(/\s+/gu, " ").trim().slice(0, 300);
}

function exactPackageId(value: unknown) {
  return typeof value === "string" && /^PLAW-\d{1,3}(?:publ|priv)\d{1,4}$/u.test(value)
    ? value
    : null;
}

function exactResultLink(value: unknown, packageId: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "api.govinfo.gov" &&
        url.pathname === `/packages/${packageId}/summary` && !url.search &&
        !url.hash
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function stringValues(value: unknown) {
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function parsedSearchResult(value: unknown): GovInfoSearchResult | null {
  if (!isRecord(value) || value.collectionCode !== "PLAW") return null;
  const packageId = exactPackageId(value.packageId);
  const title = typeof value.title === "string"
    ? value.title.replace(/\s+/gu, " ").trim().slice(0, 1_000)
    : "";
  const resultLink = packageId ? exactResultLink(value.resultLink, packageId) : null;
  if (!packageId || !title || !resultLink) return null;
  return {
    title,
    packageId,
    dateIssued: canonicalDate(value.dateIssued),
    resultLink,
    governmentAuthor: stringValues(value.governmentAuthor),
    relatedIdentifiers: [
      ...stringValues(value.billNumber),
      ...stringValues(value.relatedLink),
      ...stringValues(value.suDocClassNumber),
    ],
  };
}

function publicLawCoordinates(packageId: string) {
  const match = /^PLAW-(\d{1,3})(publ|priv)(\d{1,4})$/u.exec(packageId)!;
  return {
    congress: Number(match[1]),
    lawType: match[2] === "publ" ? "Public Law" : "Private Law",
    lawNumber: Number(match[3]),
    formalIdentifier:
      `${match[2] === "publ" ? "Public Law" : "Private Law"} ${Number(match[1])}-${Number(match[3])}`,
  };
}

function originalHtmlUrl(packageId: string) {
  return `https://www.govinfo.gov/content/pkg/${packageId}/html/${packageId}.htm`;
}

function shortTitles(text: string) {
  const titles = [...text.matchAll(
    /\bthis\s+(?:act|title|division|subtitle|section)\s+may\s+be\s+cited\s+as\s+(?:the\s+)?(?:``|[“"'‘])?(.{3,180}?\bAct(?:\s+of\s+\d{4})?)(?:''|[”"'’])?[.;]/giu,
  )].map((match) => match[1]!.replace(/\s+/gu, " ").trim());
  return [...new Map(titles.map((title) => [normalize(title), title])).values()]
    .slice(0, 8);
}

function identifierAppears(text: string, packageId: string) {
  const coordinates = publicLawCoordinates(packageId);
  const normalized = normalize(text);
  return normalized.includes(normalize(coordinates.formalIdentifier)) ||
    normalized.includes(normalize(packageId)) ||
    /\b(?:public|private) law\b/iu.test(text.slice(0, 20_000));
}

function evidenceSeed(text: string) {
  // Identity review retains one contiguous, byte-derived slice. Reordering
  // selected sentences would make offsets and provenance ambiguous and would
  // still not amount to Screen 2 reconstruction of the complete instrument.
  return text.slice(0, 12_000).trim();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function typedDates(dateIssued: string | null, passageIds: string[]): TypedDate[] {
  return dateIssued
    ? [{
        start: dateIssued,
        end: null,
        precision: "day",
        kind: "publication",
        passageIds,
      }]
    : [];
}

async function fetchWithinTimeout(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  apiKey?: string;
  method: "GET" | "POST";
  body?: string;
  accept: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    return await input.fetch(input.url, {
      method: input.method,
      headers: {
        accept: input.accept,
        ...(input.body ? { "content-type": "application/json" } : {}),
        ...(input.apiKey ? { "x-api-key": input.apiKey } : {}),
        "cache-control": "no-store",
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      ...(input.body ? { body: input.body } : {}),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function govInfoPublicLawPackageFromLocator(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" ||
        !["govinfo.gov", "www.govinfo.gov"].includes(url.hostname)) return null;
    const match = /^\/(?:app\/details|content\/pkg)\/(PLAW-\d{1,3}(?:publ|priv)\d{1,4})(?:\/|$)/u
      .exec(url.pathname);
    return exactPackageId(match?.[1]) ?? null;
  } catch {
    return null;
  }
}

export async function discoverGovInfoPublicLaws(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  apiKey?: string;
  congressApiKey?: string;
  /** Ordered aliases supplied by the shared entity-resolution layer. The
   * original entered name remains first and later variants run only when an
   * earlier GovInfo search returns no package metadata. */
  queryVariants?: readonly string[];
  timeoutMs?: number;
}): Promise<Screen01GovInfoStatuteDiscoveryResult> {
  const measured = usage();
  const attemptedSources: string[] = [];
  const finish = (
    status: Screen01GovInfoStatuteDiscoveryResult["status"],
    candidates: IdentityCandidateInput[],
    limitation: string | null,
  ): Screen01GovInfoStatuteDiscoveryResult => ({
    status, candidates, limitation, attemptedSources, usage: measured,
  });
  if (!validApiKey(input.apiKey)) {
    return finish(
      "not_configured",
      [],
      "GovInfo public-law discovery requires the approved server-side GOVINFO_API_KEY credential.",
    );
  }
  const explicitPackages = input.workflow.officialSourceLocators.map(
    govInfoPublicLawPackageFromLocator,
  ).filter((value): value is string => value !== null);
  const timeoutMs = input.timeoutMs ?? 12_000;
  let records: GovInfoSearchResult[] = [];
  if (explicitPackages.length) {
    records = [...new Set(explicitPackages)].map((packageId) => ({
      title: input.workflow.currentShockInput,
      packageId,
      dateIssued: null,
      resultLink: `https://api.govinfo.gov/packages/${packageId}/summary`,
      governmentAuthor: [],
      relatedIdentifiers: [],
    }));
  } else {
    const variants = [...new Set([
      input.workflow.currentShockInput,
      ...(input.queryVariants ?? []),
    ].map(escapedSearchPhrase).filter(Boolean))].slice(0, 3);
    if (!variants.length) {
      return finish("no_match", [],
        "The statute name was empty after normalization.");
    }
    let completedSearches = 0;
    let failedSearches = 0;
    for (const phrase of variants) {
      const body = JSON.stringify({
        query: `collection:(PLAW) \"${phrase}\"`,
        pageSize: String(MAXIMUM_RESULTS),
        offsetMark: "*",
        resultLevel: "package",
        sorts: [{ field: "score", sortOrder: "DESC" }],
      });
      attemptedSources.push(
        `${SCREEN_01_GOVINFO_SEARCH_URL} (name variant ${completedSearches + failedSearches + 1})`,
      );
      measured.sourceQueries += 1;
      measured.transportHops += 1;
      let response: Response;
      try {
        response = await fetchWithinTimeout({
          fetch: input.fetch,
          url: SCREEN_01_GOVINFO_SEARCH_URL,
          apiKey: input.apiKey!,
          method: "POST",
          body,
          accept: "application/json",
          timeoutMs,
        });
      } catch {
        failedSearches += 1;
        continue;
      }
      if (response.redirected || !response.ok ||
          (response.headers.get("content-type") ?? "").split(";", 1)[0] !==
            "application/json") {
        await response.body?.cancel("GovInfo public-law search rejected")
          .catch(() => undefined);
        failedSearches += 1;
        continue;
      }
      let bodyText: string;
      try {
        bodyText = await readScreen02BoundedResponseText(
          response,
          MAXIMUM_SEARCH_BYTES,
        );
      } catch {
        failedSearches += 1;
        continue;
      }
      completedSearches += 1;
      const bytes = new TextEncoder().encode(bodyText).byteLength;
      measured.receivedBytes += bytes;
      measured.decodedBytes += bytes;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        failedSearches += 1;
        completedSearches -= 1;
        continue;
      }
      const values = isRecord(parsed) && Array.isArray(parsed.results)
        ? parsed.results.slice(0, MAXIMUM_RESULTS)
        : [];
      measured.metadataRecords += values.length;
      records = values.flatMap((value) => {
        const parsedRecord = parsedSearchResult(value);
        return parsedRecord ? [parsedRecord] : [];
      });
      if (records.length) break;
    }
    if (!completedSearches && failedSearches) {
      return finish("source_unavailable", [],
        "The GovInfo public-law name variants did not complete through the bounded transport.");
    }
  }

  const candidates: IdentityCandidateInput[] = [];
  const congressLimitations: string[] = [];
  for (const record of records) {
    if (candidates.length >= MAXIMUM_VALIDATED_DOCUMENTS) break;
    const locator = originalHtmlUrl(record.packageId);
    attemptedSources.push(locator);
    measured.documentAttempts += 1;
    measured.transportHops += 1;
    let response: Response;
    try {
      response = await fetchWithinTimeout({
        fetch: input.fetch,
        url: locator,
        method: "GET",
        accept: "text/html",
        timeoutMs,
      });
    } catch {
      continue;
    }
    if (response.redirected || !response.ok ||
        (response.headers.get("content-type") ?? "").toLocaleLowerCase("en-US")
          .startsWith("application/pdf")) {
      await response.body?.cancel("GovInfo public-law representation rejected")
        .catch(() => undefined);
      continue;
    }
    let html: string;
    try {
      html = await readScreen02BoundedResponseText(
        response,
        MAXIMUM_DOCUMENT_BYTES,
      );
    } catch {
      continue;
    }
    const received = new TextEncoder().encode(html).byteLength;
    measured.receivedBytes += received;
    if (officialDocumentAccessChallenge(html)) continue;
    const text = visibleOfficialDocumentText(html);
    measured.decodedBytes += new TextEncoder().encode(text).byteLength;
    if (text.length < 200 || !identifierAppears(text, record.packageId)) continue;
    const titles = shortTitles(text);
    const matchScore = similarity(input.workflow.currentShockInput, [
      ...titles,
      record.title,
      publicLawCoordinates(record.packageId).formalIdentifier,
    ]);
    if (!explicitPackages.includes(record.packageId) && matchScore < .55) continue;
    const coordinates = publicLawCoordinates(record.packageId);
    const officialTitle = titles[0] ?? record.title;
    const aliases = [...new Set([
      ...titles,
      record.title,
      coordinates.formalIdentifier,
    ].map((value) => value.replace(/\s+/gu, " ").trim()).filter(Boolean))];
    const retainedText = evidenceSeed(text);
    if (!retainedText) continue;
    const sourceId = `govinfo-${record.packageId}-html`;
    const identitySource = {
      id: sourceId,
      title: officialTitle,
      locator,
      publisher: "U.S. Government Publishing Office",
      publishedDate: record.dateIssued,
      authorityTier: "tier-1",
      retrievedAt: input.retrievedAt,
      provider: "GovInfo",
      nativeId: record.packageId,
      routeId: "govinfo_public_law",
      routeVersion: SCREEN_01_GOVINFO_STATUTE_DISCOVERY_VERSION,
      accessStatus: "retained_passage" as const,
      inspectedText: "partial" as const,
      contentHash: await sha256(html),
      retainedText,
      limitation:
        "The exact original public-law HTML was inspected for identity and a bounded seed was retained. Screen 2 must reacquire or reuse the immutable representation to reconstruct later sections, amendments, implementation, exemptions, and sanctions.",
    };
    const congress = candidates.length === 0 && input.congressApiKey
      ? await acquireCongressPublicLawIdentity({
          packageId: record.packageId,
          expectedTitle: officialTitle,
          retrievedAt: input.retrievedAt,
          fetch: input.fetch,
          apiKey: input.congressApiKey,
          timeoutMs,
        })
      : null;
    if (congress) {
      attemptedSources.push(...congress.attemptedSources);
      measured.sourceQueries += congress.usage.sourceQueries;
      measured.metadataRecords += congress.usage.metadataRecords;
      measured.documentAttempts += congress.usage.documentAttempts;
      measured.usefulDocuments += congress.usage.usefulDocuments;
      measured.transportHops += congress.usage.transportHops;
      measured.receivedBytes += congress.usage.receivedBytes;
      measured.decodedBytes += congress.usage.decodedBytes;
      if (congress.status !== "resolved" && congress.limitation) {
        congressLimitations.push(congress.limitation);
      }
    }
    const sourceSnapshot = [
      identitySource,
      ...(congress?.source ? [congress.source] : []),
    ];
    const sourceSnapshotFingerprint = fingerprintSixScreenValue(sourceSnapshot);
    const datePassageIds: string[] = [];
    const dates = typedDates(record.dateIssued, datePassageIds);
    const summarySentences = retainedText.match(/[^.!?]{20,500}[.!?](?=\s|$)/gu)
      ?.filter((value) => /\b(?:must|shall|required|prohibited|applies|effective|penalt|short title)\w*\b/iu.test(value))
      .slice(0, 4) ?? [];
    const description = [
      `${officialTitle} is the short or source-supported title found in ${coordinates.formalIdentifier}, package ${record.packageId}.`,
      record.dateIssued
        ? `GovInfo dates this original public-law package ${record.dateIssued}.`
        : "The approval/publication date remains to be confirmed from package metadata.",
      ...summarySentences,
      "This identity match does not select a provision-level treatment date or substitute later regulations for the statute.",
    ].join(" ").replace(/\s+/gu, " ").trim().slice(0, 1_450);
    candidates.push({
      id: `identity-govinfo-${record.packageId}`,
      officialTitle,
      aliases,
      issuer: record.governmentAuthor[0] ?? "United States Congress",
      issuingJurisdiction: "United States",
      instrumentType: "federal statute (public law)",
      formalIdentifiers: [...new Set([
        coordinates.formalIdentifier,
        record.packageId,
        ...record.relatedIdentifiers,
        ...(congress?.formalIdentifiers ?? []),
      ])].slice(0, 12),
      episode: input.workflow.intendedEpisode?.trim() ||
        "enactment and source-documented statutory stages",
      versionScope:
        `Original ${coordinates.lawType.toLocaleLowerCase("en-US")} package ${record.packageId}; later amendments and codified versions are separate evidence questions`,
      typedDates: dates,
      identitySourceIds: sourceSnapshot.map(({ id }) => id),
      sourceSnapshotId: `govinfo-source-snapshot-${record.packageId}`,
      sourceSnapshotFingerprint,
      identitySources: sourceSnapshot,
      displayedDescription: description,
      matchExplanation: congress?.source
        ? "GovInfo's documented package-level Search Service returned this public law for the normalized name; the original public-law HTML was inspected, and Congress.gov independently bound the law coordinates to a native bill identity and exact official text representation. Ranking did not use desired outcomes, comparison groups, or publication appeal."
        : "GovInfo's documented package-level Search Service returned this public law for the normalized name; the original HTML and its own short-title/public-law markers were then inspected. Ranking did not use desired outcomes, comparison groups, or publication appeal.",
      materialMismatches: [],
      retrievedAt: input.retrievedAt,
    });
    measured.usefulDocuments += 1;
  }
  return candidates.length
    ? finish(
        "resolved",
        candidates,
        congressLimitations.length
          ? `GovInfo supplied a validated public-law candidate, but the configured Congress.gov enrichment remained incomplete: ${congressLimitations.join(" ")}`
          : null,
      )
    : finish(
        records.length ? "no_match" : "no_match",
        [],
        records.length
          ? "GovInfo returned public-law leads, but none passed exact package, original-text, and title/identifier binding."
          : "GovInfo completed the bounded public-law search without a validated match.",
      );
}
