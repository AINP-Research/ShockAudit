import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
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

export const SCREEN_01_CONGRESS_STATUTE_IDENTITY_VERSION =
  "congress-public-law-bill-text-v1" as const;

const CONGRESS_API_ORIGIN = "https://api.congress.gov";
const MAXIMUM_METADATA_BYTES = 256 * 1024;
const MAXIMUM_DOCUMENT_BYTES = 2 * 1024 * 1024;

type IdentitySource = IdentityCandidateInput["identitySources"][number];

export type CongressPublicLawIdentityResult = {
  status:
    | "resolved"
    | "not_configured"
    | "source_unavailable"
    | "wrong_document"
    | "unsupported_format";
  source: IdentitySource | null;
  formalIdentifiers: string[];
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

type PublicLawCoordinates = {
  congress: number;
  lawType: "pub" | "priv";
  lawNumber: number;
  lawLabel: "Public Law" | "Private Law";
};

type BillIdentity = {
  congress: number;
  type: "hr" | "s" | "hjres" | "sjres";
  number: number;
  title: string;
};

function emptyUsage() {
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

function boundedString(value: unknown, maximum = 1_000) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function positiveInteger(value: unknown, maximum: number) {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/u.test(value)
      ? Number(value)
      : Number.NaN;
  return Number.isSafeInteger(number) && number >= 1 && number <= maximum
    ? number
    : null;
}

export function congressCoordinatesFromGovInfoPackage(
  packageId: string,
): PublicLawCoordinates | null {
  const match = /^PLAW-(\d{1,3})(publ|priv)(\d{1,4})$/u.exec(packageId);
  if (!match) return null;
  return {
    congress: Number(match[1]),
    lawType: match[2] === "publ" ? "pub" : "priv",
    lawNumber: Number(match[3]),
    lawLabel: match[2] === "publ" ? "Public Law" : "Private Law",
  };
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

const TITLE_STOPWORDS = new Set([
  "a", "an", "and", "act", "for", "of", "the", "to", "law", "public",
]);

function titleWords(value: string) {
  return normalize(value).split(" ").filter((word) =>
    word.length > 1 && !TITLE_STOPWORDS.has(word));
}

function titleSupportsText(title: string, text: string) {
  const terms = [...new Set(titleWords(title))];
  if (!terms.length) return false;
  const normalizedText = normalize(text);
  const found = terms.filter((term) => normalizedText.includes(term)).length;
  return found >= Math.max(2, Math.ceil(terms.length * .5));
}

function billType(value: unknown): BillIdentity["type"] | null {
  const normalized = boundedString(value, 12).toLocaleLowerCase("en-US")
    .replace(/[^a-z]/gu, "");
  return (["hr", "s", "hjres", "sjres"] as const).find((candidate) =>
    candidate === normalized) ?? null;
}

function lawMatches(
  value: unknown,
  coordinates: PublicLawCoordinates,
) {
  if (!isRecord(value)) return false;
  const type = boundedString(value.type, 40).toLocaleLowerCase("en-US");
  const directNumber = positiveInteger(value.number, 9_999);
  const prefixedNumber = directNumber === null
    ? /^(\d{1,3})-(\d{1,4})$/u.exec(boundedString(value.number, 16))
    : null;
  const number = directNumber ?? positiveInteger(prefixedNumber?.[2], 9_999);
  const congress = prefixedNumber
    ? positiveInteger(prefixedNumber[1], 999)
    : coordinates.congress;
  return congress === coordinates.congress &&
    number === coordinates.lawNumber &&
    (coordinates.lawType === "pub"
      ? /public/u.test(type)
      : /private/u.test(type));
}

function parsedBillIdentity(
  value: unknown,
  coordinates: PublicLawCoordinates,
): BillIdentity | null {
  if (!isRecord(value)) return null;
  const root = isRecord(value.bill)
    ? value.bill
    : isRecord(value.law)
      ? value.law
      : value;
  const congress = positiveInteger(root.congress, 999);
  const type = billType(root.type ?? root.billType);
  const number = positiveInteger(root.number ?? root.billNumber, 999_999);
  const title = boundedString(root.title, 2_000);
  const laws = Array.isArray(root.laws) ? root.laws : [];
  if (
    congress !== coordinates.congress || !type || !number || !title ||
    !laws.some((law) => lawMatches(law, coordinates))
  ) return null;
  return { congress, type, number, title };
}

export function congressPublicLawIdentityResponseMatches(
  value: unknown,
  packageId: string,
) {
  const coordinates = congressCoordinatesFromGovInfoPackage(packageId);
  return coordinates !== null &&
    parsedBillIdentity(value, coordinates) !== null;
}

function exactCongressDocumentUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || !["congress.gov", "www.congress.gov"].includes(url.hostname) ||
      url.search || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{1,1500}$/u.test(url.pathname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function textVersionCandidates(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.textVersions)) return [];
  return value.textVersions.slice(0, 20).flatMap((version) => {
    if (!isRecord(version) || !Array.isArray(version.formats)) return [];
    const versionType = boundedString(version.type, 100);
    return version.formats.slice(0, 12).flatMap((format) => {
      if (!isRecord(format)) return [];
      const locator = exactCongressDocumentUrl(format.url);
      if (!locator) return [];
      const formatType = boundedString(format.type, 100);
      const score =
        (/enrolled|public law/iu.test(versionType) ? 40 : 0) +
        (/formatted text|formatted xml/iu.test(formatType) ? 20 : 0) +
        (/\.xml$/iu.test(new URL(locator).pathname) ? 3 : 0);
      return [{ locator, versionType, formatType, score }];
    });
  }).sort((left, right) => right.score - left.score);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function fetchBounded(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  apiKey?: string;
  accept: string;
  maximumBytes: number;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetch(input.url, {
      method: "GET",
      headers: {
        accept: input.accept,
        ...(input.apiKey ? { "x-api-key": input.apiKey } : {}),
        "cache-control": "no-store",
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.redirected || !response.ok) {
      await response.body?.cancel("Congress.gov response rejected")
        .catch(() => undefined);
      return null;
    }
    const body = await readScreen02BoundedResponseText(
      response,
      input.maximumBytes,
    );
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function acquireCongressPublicLawIdentity(input: {
  packageId: string;
  expectedTitle: string;
  retrievedAt: string;
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<CongressPublicLawIdentityResult> {
  const measured = emptyUsage();
  const attemptedSources: string[] = [];
  const finish = (
    status: CongressPublicLawIdentityResult["status"],
    source: IdentitySource | null,
    formalIdentifiers: string[],
    limitation: string | null,
  ): CongressPublicLawIdentityResult => ({
    status,
    source,
    formalIdentifiers,
    limitation,
    attemptedSources,
    usage: measured,
  });
  if (!validApiKey(input.apiKey)) {
    return finish(
      "not_configured",
      null,
      [],
      "Congress.gov exact law/bill resolution requires its approved server-side credential.",
    );
  }
  const coordinates = congressCoordinatesFromGovInfoPackage(input.packageId);
  if (!coordinates) {
    return finish("wrong_document", null, [],
      "The GovInfo package did not contain valid public-law coordinates.");
  }
  const timeoutMs = input.timeoutMs ?? 12_000;
  const lawUrl =
    `${CONGRESS_API_ORIGIN}/v3/law/${coordinates.congress}/${coordinates.lawType}/${coordinates.lawNumber}?format=json`;
  attemptedSources.push(lawUrl);
  measured.sourceQueries += 1;
  measured.transportHops += 1;
  let lawResponse: Awaited<ReturnType<typeof fetchBounded>>;
  try {
    lawResponse = await fetchBounded({
      fetch: input.fetch,
      url: lawUrl,
      apiKey: input.apiKey,
      accept: "application/json",
      maximumBytes: MAXIMUM_METADATA_BYTES,
      timeoutMs,
    });
  } catch {
    return finish("source_unavailable", null, [],
      "Congress.gov did not complete the exact public-law identity request.");
  }
  if (!lawResponse) {
    return finish("source_unavailable", null, [],
      "Congress.gov returned an unusable exact public-law identity response.");
  }
  measured.receivedBytes += new TextEncoder().encode(lawResponse.body).byteLength;
  measured.decodedBytes += new TextEncoder().encode(lawResponse.body).byteLength;
  let parsedLaw: unknown;
  try {
    parsedLaw = JSON.parse(lawResponse.body);
  } catch {
    return finish("source_unavailable", null, [],
      "Congress.gov returned invalid law-identity JSON.");
  }
  const bill = parsedBillIdentity(parsedLaw, coordinates);
  if (!bill) {
    return finish("wrong_document", null, [],
      "Congress.gov did not bind the requested public law to one supported native House, Senate, or joint-resolution identity.");
  }
  measured.metadataRecords += 1;

  const textListUrl =
    `${CONGRESS_API_ORIGIN}/v3/bill/${bill.congress}/${bill.type}/${bill.number}/text?format=json`;
  attemptedSources.push(textListUrl);
  measured.sourceQueries += 1;
  measured.transportHops += 1;
  let textListResponse: Awaited<ReturnType<typeof fetchBounded>>;
  try {
    textListResponse = await fetchBounded({
      fetch: input.fetch,
      url: textListUrl,
      apiKey: input.apiKey,
      accept: "application/json",
      maximumBytes: MAXIMUM_METADATA_BYTES,
      timeoutMs,
    });
  } catch {
    return finish("source_unavailable", null, [],
      "Congress.gov did not complete the exact bill-text representation request.");
  }
  if (!textListResponse) {
    return finish("source_unavailable", null, [],
      "Congress.gov returned an unusable bill-text representation response.");
  }
  const textListBytes = new TextEncoder().encode(textListResponse.body).byteLength;
  measured.receivedBytes += textListBytes;
  measured.decodedBytes += textListBytes;
  let parsedTextList: unknown;
  try {
    parsedTextList = JSON.parse(textListResponse.body);
  } catch {
    return finish("source_unavailable", null, [],
      "Congress.gov returned invalid bill-text representation JSON.");
  }
  const representations = textVersionCandidates(parsedTextList);
  measured.metadataRecords += representations.length;
  const selected = representations[0];
  if (!selected) {
    return finish("unsupported_format", null, [],
      "Congress.gov returned no bounded official HTML, XML, or text representation for the native bill identity.");
  }

  attemptedSources.push(selected.locator);
  measured.documentAttempts += 1;
  measured.transportHops += 1;
  let documentResponse: Awaited<ReturnType<typeof fetchBounded>>;
  try {
    documentResponse = await fetchBounded({
      fetch: input.fetch,
      url: selected.locator,
      accept:
        "text/html, application/xhtml+xml, application/xml, text/xml, text/plain;q=0.9",
      maximumBytes: MAXIMUM_DOCUMENT_BYTES,
      timeoutMs,
    });
  } catch {
    return finish("source_unavailable", null, [],
      "The exact Congress.gov bill text did not complete within the bounded transport.");
  }
  if (!documentResponse || officialDocumentAccessChallenge(documentResponse.body)) {
    return finish("source_unavailable", null, [],
      "The exact Congress.gov bill text was unavailable or returned an access challenge.");
  }
  const documentBytes = new TextEncoder().encode(documentResponse.body).byteLength;
  measured.receivedBytes += documentBytes;
  const mediaType = (documentResponse.response.headers.get("content-type") ?? "")
    .toLocaleLowerCase("en-US");
  const text = /(?:html|xml)/u.test(mediaType) || /<\w+[\s>]/u.test(documentResponse.body)
    ? visibleOfficialDocumentText(documentResponse.body)
    : documentResponse.body.replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ").trim();
  measured.decodedBytes += new TextEncoder().encode(text).byteLength;
  const lawIdentifier = `${coordinates.lawLabel} ${coordinates.congress}-${coordinates.lawNumber}`;
  const nativeBill = `${bill.type.toUpperCase()} ${bill.number} (${bill.congress}th Congress)`;
  if (
    text.length < 200 ||
    (!titleSupportsText(input.expectedTitle, text) &&
      !titleSupportsText(bill.title, text) &&
      !normalize(text).includes(normalize(lawIdentifier)))
  ) {
    return finish("wrong_document", null, [],
      "The retrieved Congress.gov representation did not support the expected title or public-law identity.");
  }
  measured.usefulDocuments += 1;
  const retainedText = text.slice(0, 12_000).trim();
  const source: IdentitySource = {
    id: `congress-${coordinates.congress}-${coordinates.lawType}-${coordinates.lawNumber}-${bill.type}-${bill.number}`,
    title: bill.title,
    locator: selected.locator,
    publisher: "Library of Congress",
    publishedDate: null,
    authorityTier: "tier-1",
    retrievedAt: input.retrievedAt,
    provider: "Congress.gov",
    nativeId: `${bill.congress}/${bill.type}/${bill.number}`,
    routeId: "congress_public_law_bill_text",
    routeVersion: SCREEN_01_CONGRESS_STATUTE_IDENTITY_VERSION,
    accessStatus: "retained_passage",
    inspectedText: "partial",
    contentHash: await sha256(documentResponse.body),
    retainedText,
    limitation:
      "Congress.gov bound the GovInfo public law to this native bill identity and an exact official text representation. The retained passage is a bounded Screen 1 identity seed; GovInfo remains the stronger original public-law evidence route and Screen 2 must reconstruct provisions independently.",
  };
  return finish(
    "resolved",
    source,
    [lawIdentifier, nativeBill],
    null,
  );
}

export function congressIdentityFingerprint(input: {
  source: IdentitySource;
  formalIdentifiers: readonly string[];
}) {
  return fingerprintSixScreenValue(input);
}
