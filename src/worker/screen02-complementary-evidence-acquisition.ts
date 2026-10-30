import {
  SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
  type Claim,
  type DocumentVersion,
  type EvidenceRequirement,
  type Passage,
  type PolicyReviewFailureCode,
  type SourceRecord,
  type SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import {
  type EvidenceCollection,
  validateEvidenceCollection,
} from "../core/six-screen/evidence";
import {
  mergePolicyEvidenceCollections,
  projectPolicyEvidenceClaims,
  unsearchedOfficialDocumentPolicyRequirements,
  type ParsedOfficialDocumentPolicyEvidence,
} from "../core/six-screen/policy-review";
import { POLICY_EVIDENCE_REQUIREMENT_KINDS } from
  "../core/six-screen/policy-evidence-plan";
import {
  isPolicyPageBoilerplateText,
  normalizePolicyEvidenceText,
} from "../core/six-screen/policy-text-normalization";
import { isCompletePolicyPresentationSentence } from
  "../core/six-screen/policy-presentation";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import {
  discoverGdeltContextualLeads,
  GDELT_DOC_API_ENDPOINT,
} from "./contextual-discovery";
import {
  officialDocumentAccessChallenge,
  primaryOfficialDocumentHtml,
  visibleOfficialDocumentMetadata,
  visibleOfficialDocumentText,
  visibleOfficialDocumentTitles,
} from "./official-document-html";
import { searchOpenStatesBills } from "./openstates-bills";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import type { Screen2PolicySourceDiscoveryRequest } from
  "./screen2-openai-policy-source-discovery";
import {
  SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS,
  SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS,
  SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
} from
  "./screen02-secure-transport";

export const SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION =
  "screen-02-complementary-evidence-v10" as const;

export const SCREEN02_COMPLEMENTARY_SOURCE_TYPES = [
  "official_explanation",
  "implementation_record",
  "specialist_analysis",
] as const;

export type Screen02ComplementarySourceType =
  (typeof SCREEN02_COMPLEMENTARY_SOURCE_TYPES)[number];

export type Screen02ComplementaryEvidenceLead = {
  url: string;
  sourceType: Screen02ComplementarySourceType;
  reasonForRetrieval: string;
};

export type Screen02ComplementarySourceDiscoveryResult = {
  attempted: boolean;
  urls: readonly string[];
  responseBytes: number;
};

export type Screen02ComplementaryEvidenceAcquisitionResult = {
  protocolVersion: typeof SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION;
  focus: "introductory_context";
  status: "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  parsed: ParsedOfficialDocumentPolicyEvidence | null;
  usage: ResearchTaskOperationUsage;
};

type Candidate = SixScreenWorkflowState["candidates"][number];

type ExplanationInput = {
  eventId: string;
  sourceId: string;
  provider: string;
  nativeId: string;
  canonicalUrl: string;
  title: string;
  publisher: string;
  issuer: string | null;
  author: string | null;
  jurisdiction: string;
  publicationDate: string | null;
  retrievedAt: string;
  contentHash: string;
  text: string;
  representation: string;
  sourceType: Screen02ComplementarySourceType;
  versionScope: string;
  provenanceMode?: "fresh_complementary" | "retained_identity_seed";
};

const MAXIMUM_METADATA_BYTES = 256 * 1024;
const MAXIMUM_CONGRESS_SUMMARY_BYTES = 1024 * 1024;
const MAXIMUM_PAGE_BYTES = 768 * 1024;
const MAXIMUM_PAGE_TEXT = 240_000;
const MAXIMUM_EXPLANATORY_PASSAGES = 18;
const MAXIMUM_PAGE_ATTEMPTS = 6;
const MAXIMUM_REDIRECTS = 2;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CONGRESS_TIMEOUT_MS = 25_000;
const DEFAULT_OPENSTATES_TIMEOUT_MS = 20_000;
// The exact Federal Register API shares the reviewed identity route
// latency envelope; keep other complementary page attempts at eight seconds.
const DEFAULT_FEDERAL_REGISTER_ABSTRACT_TIMEOUT_MS = 12_000;
const DEFAULT_FEDERAL_REGISTER_ABSTRACT_RETRY_TIMEOUT_MS = 20_000;
const MAXIMUM_FEDERAL_REGISTER_ABSTRACT_ATTEMPTS = 2;

const OFFICIAL_PAGE_HOSTS = new Set([
  ...SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS,
  "api.congress.gov",
  "api.govinfo.gov",
  "boe.es",
  "climate.ec.europa.eu",
  "commission.europa.eu",
  "congress.gov",
  "digital-markets-act.ec.europa.eu",
  "dre.pt",
  "elaw.klri.re.kr",
  "elaws.e-gov.go.jp",
  "eur-lex.europa.eu",
  "federalregister.gov",
  "fema.gov",
  "ftc.gov",
  "gesetze-im-internet.de",
  "govinfo.gov",
  "indiacode.nic.in",
  "irishstatutebook.ie",
  "japaneselawtranslation.go.jp",
  "laws-lois.justice.gc.ca",
  "leg.colorado.gov",
  "le.utah.gov",
  "legacylis.virginia.gov",
  "legislation.gov.uk",
  "leginfo.legislature.ca.gov",
  "legifrance.gouv.fr",
  "oag.ca.gov",
  "publications.europa.eu",
  "vig.cdn.sos.ca.gov",
  "www.boe.es",
  "www.cga.ct.gov",
  "www.congress.gov",
  "www.dre.pt",
  "www.federalregister.gov",
  "www.fema.gov",
  "www.ftc.gov",
  "www.gesetze-im-internet.de",
  "www.govinfo.gov",
  "www.indiacode.nic.in",
  "www.irs.gov",
  "www.japaneselawtranslation.go.jp",
  "www.legifrance.gouv.fr",
  "www.legislation.gov.uk",
  "www.oag.ca.gov",
  "www.sec.gov",
  "www.sos.ca.gov",
]);

const SPECIALIST_PAGE_HOSTS = new Set([
  ...SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS,
  "americanbar.org",
  "apnews.com",
  "brookings.edu",
  "hls.harvard.edu",
  "law.stanford.edu",
  "lawfaremedia.org",
  "rand.org",
  "reuters.com",
  "www.americanbar.org",
  "www.apnews.com",
  "www.bbc.com",
  "www.brookings.edu",
  "www.lawfaremedia.org",
  "www.rand.org",
  "www.reuters.com",
]);

function emptyUsage(): ResearchTaskOperationUsage {
  return {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
    activeResearchMs: 0,
    cpuMs: 0,
    providerCostUnits: {},
  };
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

const IDENTITY_STOPWORDS = new Set([
  "a", "an", "and", "act", "for", "law", "of", "order", "regulation",
  "regulations", "rule", "the", "to", "united", "states",
]);

function identityWords(value: string) {
  return normalize(value).split(" ").filter((word) =>
    word.length > 2 && !IDENTITY_STOPWORDS.has(word));
}

function identitySupported(
  text: string,
  candidate: Candidate,
  extraTitle = "",
) {
  const normalizedText = normalize(`${extraTitle} ${text}`);
  if (candidate.formalIdentifiers.some((identifier) => {
    const value = normalize(identifier);
    return value.length >= 4 && normalizedText.includes(value);
  })) return true;
  return [candidate.officialTitle, ...candidate.aliases].some((name) => {
    const exact = normalize(name);
    if (exact.length >= 8 && normalizedText.includes(exact)) return true;
    const words = [...new Set(identityWords(name))];
    if (words.length < 2) return false;
    const found = words.filter((word) => normalizedText.includes(word)).length;
    return found >= Math.max(2, Math.ceil(words.length * .7));
  });
}

function safePageUrl(value: string) {
  if (!value || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash
    ) return null;
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (!OFFICIAL_PAGE_HOSTS.has(host) && !SPECIALIST_PAGE_HOSTS.has(host)) {
      return null;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid)/iu.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeDiscoveredPageUrl(value: string) {
  if (!value || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || !host.includes(".") || host === "localhost" ||
      host.endsWith(".localhost") || host.endsWith(".local") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) || host.includes(":") ||
      /\.pdf$/iu.test(url.pathname)
    ) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid)/iu.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeOfficialUrl(value: unknown, allowedHosts: readonly string[]) {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || !allowedHosts.includes(url.hostname.toLocaleLowerCase("en-US"))
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalHost(value: string) {
  return new URL(value).hostname.toLocaleLowerCase("en-US")
    .replace(/^www\./u, "");
}

function samePublisherRedirect(
  from: string,
  to: string,
  allowDiscoveredPublicHost = false,
) {
  const target = allowDiscoveredPublicHost
    ? safeDiscoveredPageUrl(to)
    : safePageUrl(to);
  return Boolean(target && canonicalHost(from) === canonicalHost(target));
}

function sourceTypeForPage(
  locator: string,
  requested: Screen02ComplementarySourceType,
) {
  const host = new URL(locator).hostname.toLocaleLowerCase("en-US");
  if (requested === "specialist_analysis" || SPECIALIST_PAGE_HOSTS.has(host)) {
    return "specialist_analysis" as const;
  }
  if (requested === "implementation_record" ||
      /\b(?:implementation|compliance|enforcement|guidance|docket)\b/iu.test(locator)) {
    return "implementation_record" as const;
  }
  return "official_explanation" as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum = 2_000) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function canonicalDate(value: unknown) {
  const text = boundedString(value, 80);
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/u.exec(text);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === match[1]
    ? match[1]
    : null;
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256:${Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")).join("")}`;
}

type SentenceSpan = { text: string; start: number; end: number; score: number };

function explanatorySentenceSpans(raw: string) {
  const text = normalizePolicyEvidenceText(raw).slice(0, MAXIMUM_PAGE_TEXT);
  const spans: SentenceSpan[] = [];
  let cursor = 0;
  const finish = (end: number) => {
    const rawSentence = text.slice(cursor, end);
    const leading = rawSentence.length - rawSentence.trimStart().length;
    const sentence = rawSentence.trim();
    cursor = end;
    if (sentence.length < 45 || sentence.length > 1_000) return;
    if (isPolicyPageBoilerplateText(sentence) ||
        !isCompletePolicyPresentationSentence(sentence) ||
        /\b(?:cookie|privacy preferences|sign up|subscribe|all rights reserved)\b/iu.test(sentence)) {
      return;
    }
    let score = 0;
    const explanatoryAction =
      /\b(?:requires?|must|shall|prohibits?|creates?|establishes?|provides?|allows?|authorizes?|amend(?:s|ed|ing)?|repeals?|applies to|covers?|exempts?|implements?|enforces?|enacted|signed|takes? effect|became operative)\b/iu
        .test(sentence) ||
      /\b(?:applicability|coverage|eligibility|scope)\s+(?:varies?|depends?|extends?|includes?)\b/iu
        .test(sentence) ||
      /\b(?:institutions?|entities?|persons?|people|activities|transactions?)\s+(?:is|are)\s+(?:covered|subject to|exempt|excluded)\b/iu
        .test(sentence);
    if (explanatoryAction) score += 6;
    if (/\b(?:act|bill|law|rule|regulation|order|policy|program|requirement|right|agency|commission)\b/iu.test(sentence)) score += 4;
    if (/\b(?:effective|compliance|implementation|enforcement|penalt|remed|exempt|threshold|eligible|covered)\w*\b/iu.test(sentence)) score += 3;
    // A title, identifier, or policy-name match is identity evidence, not an
    // explanatory claim. Retain a sentence only when it states some action or
    // legal/implementation relationship rather than merely naming the policy.
    if (!explanatoryAction) return;
    const start = cursor - rawSentence.length + leading;
    spans.push({ text: sentence, start, end: start + sentence.length, score });
  };
  for (let index = 0; index < text.length; index += 1) {
    if (/[.!?]/u.test(text[index]!) && /\s|$/u.test(text[index + 1] ?? "")) {
      finish(index + 1);
    }
  }
  if (cursor < text.length) finish(text.length);
  const ranked = spans.sort((left, right) =>
    right.score - left.score || left.start - right.start);
  const selected: SentenceSpan[] = [];
  const selectedStarts = new Set<number>();
  const retain = (span: SentenceSpan) => {
    if (
      selected.length >= MAXIMUM_EXPLANATORY_PASSAGES ||
      selectedStarts.has(span.start)
    ) return;
    selected.push(span);
    selectedStarts.add(span.start);
  };
  // Preserve evidence breadth before filling the remaining packet by score.
  // The model can then classify meaning even when the lexical parser would
  // have assigned the wrong box.
  const aspects = [
    /\b(?:amend|replace|repeal|prohibit|require|create|establish|right)\w*\b/iu,
    /\b(?:applies? to|covers?|covered|eligible|institution|employer|employee|consumer|company|business|provider|participant)\w*\b/iu,
    /\b(?:threshold|asset|revenue|exempt|exception|exclude|does not apply)\w*\b/iu,
    /\b(?:effective|operative|compliance|implementation|enforcement|penalt|remed|authority)\w*\b/iu,
  ];
  for (const pattern of aspects) {
    ranked.filter(({ text }) => pattern.test(text)).slice(0, 4)
      .forEach(retain);
  }
  ranked.forEach(retain);
  return {
    text,
    spans: selected.sort((left, right) => left.start - right.start),
  };
}

function sourceRole(
  sourceType: Screen02ComplementarySourceType,
  provenanceMode: NonNullable<ExplanationInput["provenanceMode"]>,
) {
  if (provenanceMode === "retained_identity_seed") {
    return "exact official passage retained during Screen 1 identity resolution and reused for introductory orientation only after fresh complementary routes failed; not an independently acquired explanation or a substitute for provision-level reconstruction";
  }
  if (sourceType === "implementation_record") {
    return "identity-bound official implementation record; contextual support only unless a separate precise documentary claim is retained";
  }
  if (sourceType === "specialist_analysis") {
    return "identity-bound attributed specialist analysis; explanatory evidence, not controlling legal authority or precise policy-condition evidence";
  }
  return "identity-bound official explanation; introductory context distinct from controlling legal text";
}

function sourceDocumentType(
  sourceType: Screen02ComplementarySourceType,
  provenanceMode: NonNullable<ExplanationInput["provenanceMode"]>,
) {
  if (provenanceMode === "retained_identity_seed") {
    return "retained exact official identity passage";
  }
  if (sourceType === "implementation_record") return "official implementation record";
  if (sourceType === "specialist_analysis") return "attributed specialist analysis";
  return "official explanatory material";
}

export function parsePolicyExplanationEvidence(
  input: ExplanationInput,
): ParsedOfficialDocumentPolicyEvidence | null {
  const provenanceMode = input.provenanceMode ?? "fresh_complementary";
  const selected = explanatorySentenceSpans(input.text);
  if (!selected.spans.length) return null;
  const coordinate = input.contentHash.replace(/[^A-Za-z0-9]/gu, "")
    .slice(-16) || "retrieved";
  const sourceId = `explanation-source-${input.sourceId}-${coordinate}`
    .slice(0, 200);
  const documentVersionId =
    `explanation-document-${input.sourceId}-${coordinate}`.slice(0, 200);
  const passages: Passage[] = [];
  const claims: Claim[] = [];
  for (const [index, span] of selected.spans.entries()) {
    const passageId = `explanation-passage-${input.sourceId}-${coordinate}-${index + 1}`
      .slice(0, 200);
    const claimId = `explanation-claim-${input.sourceId}-${coordinate}-${index + 1}`
      .slice(0, 200);
    const qualification = provenanceMode === "retained_identity_seed"
      ? "This exact official passage was retained during identity resolution and supports introductory orientation only. It is not independent explanatory material and cannot establish complete historical coverage, exemptions, enforcement, amendments, or treatment timing."
      : input.sourceType === "specialist_analysis"
      ? "This attributed specialist passage supports introductory orientation only. It cannot verify the controlling law, historical version, exact coverage or exemption, enforcement authority, or treatment-relevant timing."
      : input.sourceType === "implementation_record"
        ? "This official implementation record supports the reported implementation context only. The controlling instrument and historically applicable legal stage remain separate verification questions."
        : "This official explanatory passage supports introductory orientation. Precise legal conditions and dates remain subject to controlling-document and version-specific verification.";
    passages.push({
      id: passageId,
      sourceId,
      documentVersionId,
      locator: `${sourceDocumentType(input.sourceType, provenanceMode)} passage ${index + 1}`,
      exactText: span.text,
      startOffset: span.start,
      endOffset: span.end,
      qualification,
      unresolvedCrossReferences: [],
    });
    claims.push({
      id: claimId,
      eventId: input.eventId,
      predicate: "policy_explanation",
      typedValue: {
        sourceType: input.sourceType,
        author: input.author,
        publicationDate: input.publicationDate,
        versionScope: input.versionScope,
        provenanceMode,
        text: span.text,
      },
      statement: span.text,
      scope: `${input.title}; ${input.versionScope}`,
      supportingPassageIds: [passageId],
      opposingPassageIds: [],
      supportStatus: input.sourceType === "specialist_analysis"
        ? "indirect"
        : "direct",
      reviewStatus: "unreviewed",
      criticalFor: ["screen-2-policy-briefing-introduction"],
    });
  }
  const source: SourceRecord = {
    id: sourceId,
    provider: input.provider,
    nativeId: input.nativeId,
    canonicalUrl: input.canonicalUrl,
    publisher: input.publisher,
    issuer: input.issuer,
    author: input.author,
    jurisdiction: input.jurisdiction,
    role: sourceRole(input.sourceType, provenanceMode),
    documentType: sourceDocumentType(input.sourceType, provenanceMode),
    language: "en",
    publicationDate: input.publicationDate,
    legalVersionDates: [],
    retrievedAt: input.retrievedAt,
    documentVersionId,
    contentHash: input.contentHash,
    acquisitionProvenance: "direct",
    accessStatus: "parsed_text",
    rightsStatus: input.sourceType === "specialist_analysis"
      ? "public-page-inspected; only bounded exact passages retained"
      : "public-government-record",
    parserVersion: SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION,
    textQualityStatus: provenanceMode === "retained_identity_seed"
      ? "immutable Screen 1 official passage reparsed for bounded introductory orientation after fresh complementary retrieval failed; precise legal requirements remain unsearched"
      : "underlying response inspected; bounded explanatory passages retained without promoting contextual claims to precise legal requirements",
    inspectedText: "partial",
  };
  const document: DocumentVersion = {
    id: documentVersionId,
    sourceId,
    representation: input.representation,
    language: "en",
    versionLabel: input.versionScope,
    retrievedAt: input.retrievedAt,
    contentHash: input.contentHash,
    parserVersion: SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION,
    parsedTextLength: selected.text.length,
  };
  const requirements: EvidenceRequirement[] =
    unsearchedOfficialDocumentPolicyRequirements(input.sourceId);
  const collection: EvidenceCollection = {
    sources: [source],
    documentVersions: [document],
    passages,
    claims,
    conflicts: [],
    requirements,
  };
  validateEvidenceCollection(
    collection,
    new Map([[documentVersionId, selected.text]]),
  );
  return {
    collection,
    projections: projectPolicyEvidenceClaims(collection),
    unresolved: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
    status: "partial",
  };
}

async function boundedFetch(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
  maximumBytes: number;
  timeoutMs: number;
  apiKey?: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    input.attemptedSources.push(input.url);
    input.usage.transportHops += 1;
    const response = await input.fetch(input.url, {
      method: "GET",
      headers: {
        accept: "application/json, text/html;q=0.9, text/plain;q=0.8",
        ...(input.apiKey ? { "x-api-key": input.apiKey } : {}),
        "cache-control": "no-store",
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (response.redirected || (!response.ok && !isRedirect)) {
      await response.body?.cancel("Complementary evidence response rejected")
        .catch(() => undefined);
      return null;
    }
    if (isRedirect) {
      await response.body?.cancel("Complementary evidence redirect body omitted")
        .catch(() => undefined);
      return { response, body: "", bytes: 0 };
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > input.maximumBytes) {
      await response.body?.cancel("Complementary evidence exceeded its byte bound")
        .catch(() => undefined);
      return null;
    }
    const body = await readScreen02BoundedResponseText(
      response,
      input.maximumBytes,
    );
    const bytes = new TextEncoder().encode(body).byteLength;
    input.usage.receivedBytes += bytes;
    return { response, body, bytes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function congressCoordinates(candidate: Candidate) {
  const source = candidate.identitySources.find(({ routeId, nativeId }) =>
    routeId === "congress_public_law_bill_text" &&
    /^\d{1,3}\/(?:hr|s|hjres|sjres)\/\d{1,6}$/u.test(nativeId ?? ""));
  const match = /^(\d{1,3})\/(hr|s|hjres|sjres)\/(\d{1,6})$/u
    .exec(source?.nativeId ?? "");
  return source && match
    ? {
        sourceTitle: source.title,
        congress: Number(match[1]),
        type: match[2]!,
        number: Number(match[3]),
      }
    : null;
}

function publicLawCoordinates(candidate: Candidate) {
  for (const source of candidate.identitySources) {
    const match = /\bPLAW-(\d{1,3})publ(\d{1,4})\b/iu.exec(
      `${source.nativeId ?? ""} ${source.locator}`,
    );
    if (match) return {
      congress: Number(match[1]),
      lawNumber: Number(match[2]),
    };
  }
  for (const identifier of candidate.formalIdentifiers) {
    const match = /\bPublic\s+Law\s+(\d{1,3})\s*[-–]\s*(\d{1,4})\b/iu
      .exec(identifier);
    if (match) return {
      congress: Number(match[1]),
      lawNumber: Number(match[2]),
    };
  }
  return null;
}

function billCoordinatesFromLawResponse(value: unknown) {
  if (!isRecord(value)) return null;
  const root = isRecord(value.bill)
    ? value.bill
    : isRecord(value.law)
      ? value.law
      : value;
  const congress = Number(root.congress);
  const number = Number(root.number ?? root.billNumber);
  const type = boundedString(root.type ?? root.billType, 20)
    .toLocaleLowerCase("en-US").replace(/[^a-z]/gu, "");
  if (
    !Number.isSafeInteger(congress) || congress < 1 || congress > 999 ||
    !Number.isSafeInteger(number) || number < 1 || number > 999_999 ||
    !["hr", "s", "hjres", "sjres"].includes(type)
  ) return null;
  return {
    congress,
    type: type as "hr" | "s" | "hjres" | "sjres",
    number,
    title: boundedString(root.title, 2_000),
  };
}

function congressPublicPage(congress: number, type: string, number: number) {
  const typeName: Record<string, string> = {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
  };
  return `https://www.congress.gov/bill/${congress}th-congress/${typeName[type]}/${number}`;
}

async function congressSummary(input: {
  candidate: Candidate;
  eventId: string;
  retrievedAt: string;
  jurisdiction: string;
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  timeoutMs: number;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
}) {
  if (!input.apiKey) return null;
  const congressTimeoutMs = Math.max(
    input.timeoutMs,
    DEFAULT_CONGRESS_TIMEOUT_MS,
  );
  let coordinates = congressCoordinates(input.candidate);
  if (!coordinates) {
    const law = publicLawCoordinates(input.candidate);
    if (law) {
      const lawUrl = `https://api.congress.gov/v3/law/${law.congress}/pub/${law.lawNumber}?format=json`;
      input.usage.sourceQueries += 1;
      const lawResponse = await boundedFetch({
        fetch: input.fetch,
        url: lawUrl,
        usage: input.usage,
        attemptedSources: input.attemptedSources,
        maximumBytes: MAXIMUM_METADATA_BYTES,
        timeoutMs: congressTimeoutMs,
        apiKey: input.apiKey,
      });
      if (lawResponse) {
        let value: unknown;
        try {
          value = JSON.parse(lawResponse.body);
        } catch {
          value = null;
        }
        const bill = billCoordinatesFromLawResponse(value);
        if (bill && bill.congress === law.congress) {
          input.usage.metadataRecords += 1;
          coordinates = {
            sourceTitle: bill.title ||
              input.candidate.identitySources[0]?.title ||
              input.candidate.officialTitle,
            congress: bill.congress,
            type: bill.type,
            number: bill.number,
          };
        }
      }
    }
  }
  if (!coordinates) return null;
  const url = `https://api.congress.gov/v3/bill/${coordinates.congress}/${coordinates.type}/${coordinates.number}/summaries?format=json`;
  input.usage.sourceQueries += 1;
  const fetched = await boundedFetch({
    fetch: input.fetch,
    url,
    usage: input.usage,
    attemptedSources: input.attemptedSources,
    maximumBytes: MAXIMUM_CONGRESS_SUMMARY_BYTES,
    timeoutMs: congressTimeoutMs,
    apiKey: input.apiKey,
  });
  if (!fetched) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(fetched.body);
  } catch {
    return null;
  }
  if (!isRecord(payload) || !isRecord(payload.request) ||
      !Array.isArray(payload.summaries)) return null;
  const request = payload.request;
  if (
    Number(request.congress) !== coordinates.congress ||
    normalize(boundedString(request.billType, 20)) !== coordinates.type ||
    Number(request.billNumber) !== coordinates.number
  ) return null;
  const summaries = payload.summaries.slice(0, 20).flatMap((value) => {
    if (!isRecord(value)) return [];
    const html = boundedString(value.text, 100_000);
    const text = visibleOfficialDocumentText(html);
    if (text.length < 80) return [];
    return [{
      text,
      raw: html,
      actionDate: canonicalDate(value.actionDate),
      updateDate: canonicalDate(value.updateDate),
      actionDesc: boundedString(value.actionDesc, 200) || "Unspecified bill stage",
      versionCode: boundedString(value.versionCode, 20),
    }];
  });
  const selected = summaries.sort((left, right) =>
    Number(right.versionCode === "49") - Number(left.versionCode === "49") ||
    (right.actionDate ?? "").localeCompare(left.actionDate ?? "") ||
    (right.updateDate ?? "").localeCompare(left.updateDate ?? "")
  )[0];
  if (!selected) return null;
  input.usage.metadataRecords += summaries.length;
  input.usage.decodedBytes += new TextEncoder().encode(selected.text).byteLength;
  const parsed = parsePolicyExplanationEvidence({
    eventId: input.eventId,
    sourceId:
      `congress-summary-${coordinates.congress}-${coordinates.type}-${coordinates.number}-${selected.versionCode || "stage"}`,
    provider: "Congress.gov",
    nativeId: `${coordinates.congress}/${coordinates.type}/${coordinates.number}/summaries/${selected.versionCode || "stage"}`,
    canonicalUrl: congressPublicPage(
      coordinates.congress,
      coordinates.type,
      coordinates.number,
    ),
    title: coordinates.sourceTitle,
    publisher: "Congressional Research Service via Congress.gov",
    issuer: "Congressional Research Service",
    author: "Congressional Research Service legislative analysts",
    jurisdiction: input.jurisdiction,
    publicationDate: selected.updateDate ?? selected.actionDate,
    retrievedAt: input.retrievedAt,
    contentHash: await sha256(fetched.body),
    text: selected.text,
    representation: "Congress.gov bill-summary JSON with inspected HTML text",
    sourceType: "official_explanation",
    versionScope:
      `${selected.actionDesc}${selected.actionDate ? ` on ${selected.actionDate}` : ""}; CRS summary version ${selected.versionCode || "unspecified"}; not silently treated as enacted text`,
  });
  if (parsed) input.usage.usefulDocuments += 1;
  return parsed;
}

function addExternalUsage(
  target: ResearchTaskOperationUsage,
  source: ResearchTaskOperationUsage,
) {
  target.sourceQueries += source.sourceQueries;
  target.metadataRecords += source.metadataRecords;
  target.documentAttempts += source.documentAttempts;
  target.usefulDocuments += source.usefulDocuments;
  target.transportHops += source.transportHops;
  target.receivedBytes += source.receivedBytes;
  target.decodedBytes += source.decodedBytes;
  target.cpuMs += source.cpuMs;
  for (const [provider, units] of Object.entries(source.providerCostUnits)) {
    target.providerCostUnits[provider] =
      (target.providerCostUnits[provider] ?? 0) + units;
  }
}

async function openStatesExplanation(input: {
  candidate: Candidate;
  eventId: string;
  retrievedAt: string;
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  timeoutMs: number;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
}) {
  if (!input.apiKey?.trim() ||
      !/\b(?:state legislation|bill|resolution)\b/iu.test(
        input.candidate.instrumentType,
      )) return null;
  const billIdentifier = input.candidate.formalIdentifiers.find((value) =>
    /\b(?:A|AB|ACR|AJR|AR|H|HB|HCR|HF|HJR|HR|S|SB|SCR|SF|SJR|SR|LB|LD)\s*-?\s*\d+[A-Z]?\b/iu
      .test(value));
  const approximateYear = input.candidate.typedDates?.flatMap(({ start }) => {
    if (typeof start !== "string") return [];
    const year = /^((?:18|19|20)\d{2})/u.exec(start)?.[1];
    return year ? [year] : [];
  }).at(0) ?? null;
  const result = await searchOpenStatesBills({
    fetch: input.fetch,
    apiKey: input.apiKey,
    query: billIdentifier ?? input.candidate.officialTitle,
    queryVariants: [
      input.candidate.officialTitle,
      ...input.candidate.aliases,
    ],
    jurisdiction: input.candidate.issuingJurisdiction,
    approximateYear,
    retrievedAt: input.retrievedAt,
    limit: 3,
    maximumRequests: 3,
    timeoutMs: Math.max(input.timeoutMs, DEFAULT_OPENSTATES_TIMEOUT_MS),
  });
  addExternalUsage(input.usage, result.usage);
  if (result.requestUrl) input.attemptedSources.push(result.requestUrl);
  if (result.status !== "searched") return null;
  const matchesRequestedYear = (candidate: typeof result.candidates[number]) =>
    !approximateYear ||
    candidate.formalIdentifiers.some((value) => value.includes(approximateYear)) ||
    candidate.typedDates.some(({ start, end }) =>
      start?.startsWith(approximateYear) || end?.startsWith(approximateYear));
  const matchesJurisdiction = (candidate: typeof result.candidates[number]) => {
    const expected = normalize(input.candidate.issuingJurisdiction);
    const returned = normalize(candidate.issuingJurisdiction);
    return Boolean(
      expected && returned &&
      (expected.includes(returned) || returned.includes(expected)),
    );
  };
  const selected = result.candidates.find((candidate) =>
    matchesRequestedYear(candidate) &&
    matchesJurisdiction(candidate) &&
    input.candidate.formalIdentifiers.some((identifier) =>
      candidate.formalIdentifiers.some((returned) =>
        normalize(returned) === normalize(identifier)))) ??
    result.candidates.find((candidate) =>
      matchesRequestedYear(candidate) &&
      matchesJurisdiction(candidate) &&
      identitySupported(
        `${candidate.officialTitle} ${candidate.displayedDescription}`,
        input.candidate,
        candidate.officialTitle,
      ));
  const source = selected?.identitySources.find(({ routeId }) =>
    routeId === "openstates_bill_search");
  if (
    !selected || !source?.retainedText || !source.contentHash ||
    !identitySupported(
      source.retainedText,
      input.candidate,
      selected.officialTitle,
    )
  ) return null;
  const parsed = parsePolicyExplanationEvidence({
    eventId: input.eventId,
    sourceId: `openstates-explanation-${source.id}`.slice(0, 200),
    provider: source.provider ?? "Open States API",
    nativeId: source.nativeId ?? source.id,
    canonicalUrl: source.locator,
    title: selected.officialTitle,
    publisher: source.publisher,
    issuer: selected.issuer,
    author: selected.issuer,
    jurisdiction: selected.issuingJurisdiction,
    publicationDate: canonicalDate(source.publishedDate),
    retrievedAt: input.retrievedAt,
    contentHash: source.contentHash,
    text: source.retainedText,
    representation:
      "Open States bill metadata with inspected abstract and legislative actions",
    sourceType: "official_explanation",
    versionScope:
      `${selected.versionScope}; Open States is explanatory metadata and the linked legislature document remains controlling`,
  });
  return parsed;
}

async function federalRegisterAbstract(input: {
  candidate: Candidate;
  documentNumber: string | null;
  eventId: string;
  retrievedAt: string;
  jurisdiction: string;
  fetch: Screen02ConnectorFetch;
  timeoutMs: number;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
}) {
  if (!input.documentNumber || !/^\d{4}-\d{4,6}$/u.test(input.documentNumber)) {
    return null;
  }
  const url =
    `https://www.federalregister.gov/api/v1/documents/${input.documentNumber}.json`;
  input.usage.sourceQueries += 1;
  const fetched = await boundedFetch({
    fetch: input.fetch,
    url,
    usage: input.usage,
    attemptedSources: input.attemptedSources,
    maximumBytes: MAXIMUM_METADATA_BYTES,
    timeoutMs: input.timeoutMs,
  });
  if (!fetched) return null;
  let value: unknown;
  try {
    value = JSON.parse(fetched.body);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.document_number !== input.documentNumber) {
    return null;
  }
  const abstract = visibleOfficialDocumentText(boundedString(value.abstract, 100_000));
  const title = boundedString(value.title, 2_000);
  if (abstract.length < 80 || !identitySupported(`${title} ${abstract}`, input.candidate)) {
    return null;
  }
  const agencies = Array.isArray(value.agencies)
    ? value.agencies.slice(0, 12).flatMap((agency) =>
        isRecord(agency) && boundedString(agency.name, 300)
          ? [boundedString(agency.name, 300)]
          : [])
    : [];
  const canonicalUrl = safeOfficialUrl(value.html_url, [
    "federalregister.gov", "www.federalregister.gov",
  ]) ?? url;
  input.usage.metadataRecords += 1;
  input.usage.decodedBytes += new TextEncoder().encode(abstract).byteLength;
  const parsed = parsePolicyExplanationEvidence({
    eventId: input.eventId,
    sourceId: `federal-register-abstract-${input.documentNumber}`,
    provider: "Federal Register API",
    nativeId: input.documentNumber,
    canonicalUrl,
    title: title || input.candidate.officialTitle,
    publisher: "Federal Register",
    issuer: agencies.join("; ") || input.candidate.issuer,
    author: agencies.join("; ") || null,
    jurisdiction: input.jurisdiction,
    publicationDate: canonicalDate(value.publication_date),
    retrievedAt: input.retrievedAt,
    contentHash: await sha256(fetched.body),
    text: abstract,
    representation: "Federal Register exact-document API abstract",
    sourceType: "official_explanation",
    versionScope:
      `Official abstract for FR Doc. ${input.documentNumber}${canonicalDate(value.publication_date) ? ` published ${canonicalDate(value.publication_date)}` : ""}; not controlling published text`,
  });
  if (parsed) input.usage.usefulDocuments += 1;
  return parsed;
}

function retainedFederalRegisterAbstract(input: {
  candidate: Candidate;
  documentNumber: string | null;
  eventId: string;
  jurisdiction: string;
  usage: ResearchTaskOperationUsage;
}) {
  if (!input.documentNumber || !/^\d{4}-\d{4,6}$/u.test(input.documentNumber)) {
    return null;
  }
  const exactApiUrl =
    `https://www.federalregister.gov/api/v1/documents/${input.documentNumber}.json`;
  const source = input.candidate.identitySources.find((candidateSource) =>
    candidateSource.routeId === "federal_register_api_excerpt" &&
    candidateSource.nativeId === input.documentNumber &&
    candidateSource.locator === exactApiUrl &&
    candidateSource.accessStatus === "retained_passage" &&
    candidateSource.inspectedText === "abstract" &&
    typeof candidateSource.contentHash === "string" &&
    candidateSource.contentHash.length > 0 &&
    typeof candidateSource.retainedText === "string"
  );
  if (!source?.retainedText || !source.contentHash) return null;
  const retainedText = visibleOfficialDocumentText(source.retainedText);
  if (
    retainedText.length < 80 ||
    !identitySupported(retainedText, input.candidate, source.title)
  ) return null;
  const parsed = parsePolicyExplanationEvidence({
    eventId: input.eventId,
    sourceId: `federal-register-retained-abstract-${input.documentNumber}`,
    provider: "Federal Register API",
    nativeId: input.documentNumber,
    canonicalUrl: exactApiUrl,
    title: source.title || input.candidate.officialTitle,
    publisher: source.publisher || "Federal Register",
    issuer: input.candidate.issuer,
    author: input.candidate.issuer,
    jurisdiction: input.jurisdiction,
    publicationDate: canonicalDate(source.publishedDate),
    retrievedAt: source.retrievedAt,
    contentHash: source.contentHash,
    text: retainedText,
    representation:
      "Federal Register exact-document API passage retained during Screen 1 identity resolution",
    sourceType: "official_explanation",
    versionScope:
      `Official API passage retained for FR Doc. ${input.documentNumber}${canonicalDate(source.publishedDate) ? ` published ${canonicalDate(source.publishedDate)}` : ""}; reused only after fresh bounded retrieval failed; not controlling published text`,
  });
  if (parsed) {
    input.usage.metadataRecords += 1;
    input.usage.decodedBytes += new TextEncoder().encode(retainedText).byteLength;
    input.usage.usefulDocuments += 1;
  }
  return parsed;
}

const RETAINED_OFFICIAL_INTRODUCTION_ROUTES = new Set([
  "congress_public_law_bill_text",
  "eu_legal_document",
  "govinfo_public_law",
  "reviewed_official_document",
  "uk_legislation_document",
]);

function retainedOfficialIdentityIntroduction(input: {
  candidate: Candidate;
  eventId: string;
  jurisdiction: string;
  usage: ResearchTaskOperationUsage;
}) {
  const source = input.candidate.identitySources.find((candidateSource) => {
    const locator = safePageUrl(candidateSource.locator);
    if (!locator) return false;
    const host = new URL(locator).hostname.toLocaleLowerCase("en-US");
    const routeId = candidateSource.routeId ?? "";
    const exactNativeRoute = routeId !== "reviewed_official_document";
    return (
      RETAINED_OFFICIAL_INTRODUCTION_ROUTES.has(routeId) &&
      OFFICIAL_PAGE_HOSTS.has(host) &&
      (candidateSource.authorityTier === "tier-1" ||
        (exactNativeRoute && candidateSource.authorityTier === "tier-2")) &&
      candidateSource.accessStatus === "retained_passage" &&
      candidateSource.inspectedText !== "metadata_only" &&
      typeof candidateSource.contentHash === "string" &&
      candidateSource.contentHash.length > 0 &&
      typeof candidateSource.retainedText === "string" &&
      candidateSource.retainedText.length > 0
    );
  });
  if (!source?.retainedText || !source.contentHash) return null;
  const canonicalUrl = safePageUrl(source.locator);
  if (!canonicalUrl) return null;
  const retainedText = visibleOfficialDocumentText(source.retainedText);
  if (
    retainedText.length < 80 ||
    !identitySupported(retainedText, input.candidate, source.title)
  ) return null;
  const parsed = parsePolicyExplanationEvidence({
    eventId: input.eventId,
    sourceId: `retained-official-introduction-${source.id}`.slice(0, 200),
    provider: source.provider ?? source.publisher,
    nativeId: source.nativeId ?? source.id,
    canonicalUrl,
    title: source.title || input.candidate.officialTitle,
    publisher: source.publisher,
    issuer: input.candidate.issuer,
    author: input.candidate.issuer,
    jurisdiction: input.jurisdiction,
    publicationDate: canonicalDate(source.publishedDate),
    retrievedAt: source.retrievedAt,
    contentHash: source.contentHash,
    text: retainedText,
    representation:
      "exact official passage retained during Screen 1 identity resolution",
    sourceType: "official_explanation",
    versionScope:
      `Exact official passage retained for ${input.candidate.officialTitle}${
        canonicalDate(source.publishedDate)
          ? ` published ${canonicalDate(source.publishedDate)}`
          : " with publication date not established"
      }; reused only after fresh bounded complementary retrieval failed and not treated as complete controlling text`,
    provenanceMode: "retained_identity_seed",
  });
  if (parsed) {
    input.usage.metadataRecords += 1;
    input.usage.decodedBytes += new TextEncoder().encode(retainedText).byteLength;
    input.usage.usefulDocuments += 1;
  }
  return parsed;
}

function metadataValue(
  metadata: readonly Record<string, string>[],
  names: readonly string[],
) {
  const expected = new Set(names.map((value) => value.toLocaleLowerCase("en-US")));
  for (const item of metadata) {
    const key = (item.name ?? item.property ?? item.itemprop ?? "")
      .toLocaleLowerCase("en-US");
    const value = boundedString(item.content, 2_000);
    if (expected.has(key) && value) return value;
  }
  return null;
}

async function inspectedPage(input: {
  candidate: Candidate;
  eventId: string;
  retrievedAt: string;
  jurisdiction: string;
  fetch: Screen02ConnectorFetch;
  lead: Screen02ComplementaryEvidenceLead;
  index: number;
  timeoutMs: number;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
  markIdentityMismatch: () => void;
  allowDiscoveredPublicHost?: boolean;
}) {
  const safeUrl = input.allowDiscoveredPublicHost
    ? safeDiscoveredPageUrl
    : safePageUrl;
  let current = safeUrl(input.lead.url);
  if (!current || input.usage.documentAttempts >= MAXIMUM_PAGE_ATTEMPTS) {
    return null;
  }
  const first = current;
  const visited = new Set<string>();
  for (let redirect = 0; redirect <= MAXIMUM_REDIRECTS; redirect += 1) {
    if (!current || visited.has(current) ||
        input.usage.documentAttempts >= MAXIMUM_PAGE_ATTEMPTS) return null;
    visited.add(current);
    input.usage.documentAttempts += 1;
    const fetched = await boundedFetch({
      fetch: input.fetch,
      url: current,
      usage: input.usage,
      attemptedSources: input.attemptedSources,
      maximumBytes: MAXIMUM_PAGE_BYTES,
      timeoutMs: input.timeoutMs,
    });
    if (!fetched) return null;
    if ([301, 302, 303, 307, 308].includes(fetched.response.status)) {
      const location = fetched.response.headers.get("location");
      const next: string | null = location
        ? safeUrl(new URL(location, current).toString())
        : null;
      if (!next || !samePublisherRedirect(
        first,
        next,
        input.allowDiscoveredPublicHost,
      )) return null;
      current = next;
      continue;
    }
    const mediaType = (fetched.response.headers.get("content-type") ?? "")
      .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
    if (mediaType && !["text/html", "text/plain"].includes(mediaType)) {
      return null;
    }
    if (officialDocumentAccessChallenge(fetched.body)) return null;
    const html = mediaType === "text/plain" ? "" : fetched.body;
    const text = html
      ? visibleOfficialDocumentText(primaryOfficialDocumentHtml(html))
      : fetched.body.replace(/[\u0000-\u001f\u007f]+/gu, " ")
        .replace(/\s+/gu, " ").trim();
    const metadata = html ? visibleOfficialDocumentMetadata(html) : [];
    const title = metadataValue(metadata, ["og:title", "twitter:title", "dc.title"]) ??
      (html ? visibleOfficialDocumentTitles(html)[0] : null) ??
      input.candidate.officialTitle;
    if (text.length < 60) {
      return null;
    }
    if (!identitySupported(text, input.candidate, title)) {
      input.markIdentityMismatch();
      return null;
    }
    const author = metadataValue(metadata, [
      "author", "article:author", "byl", "dc.creator", "parsely-author",
    ]);
    const publicationDate = canonicalDate(metadataValue(metadata, [
      "article:published_time", "date", "datepublished", "dc.date",
      "parsely-pub-date",
    ]));
    const sourceType = sourceTypeForPage(current, input.lead.sourceType);
    const host = new URL(current).hostname.toLocaleLowerCase("en-US");
    const parsed = parsePolicyExplanationEvidence({
      eventId: input.eventId,
      sourceId: `complementary-page-${input.index + 1}-${host.replace(/[^a-z0-9]+/gu, "-")}`,
      provider: host,
      nativeId: current,
      canonicalUrl: current,
      title: boundedString(title, 1_000) || input.candidate.officialTitle,
      publisher: host,
      issuer: sourceType === "specialist_analysis" ? null : input.candidate.issuer,
      author,
      jurisdiction: input.jurisdiction,
      publicationDate,
      retrievedAt: input.retrievedAt,
      contentHash: await sha256(fetched.body),
      text,
      representation: mediaType || "text/html",
      sourceType,
      versionScope:
        `${sourceType.replaceAll("_", " ")}${publicationDate ? ` published ${publicationDate}` : " with publication date not established"}; page matched the confirmed policy identity; controlling legal version remains separate`,
    });
    if (!parsed) return null;
    input.usage.decodedBytes += new TextEncoder().encode(text).byteLength;
    input.usage.usefulDocuments += 1;
    return parsed;
  }
  return null;
}

function identityPageLeads(candidate: Candidate) {
  return candidate.identitySources.flatMap((source, originalIndex) => {
    const url = safePageUrl(source.locator);
    // Exact Federal Register JSON is handled by its document-number-bound
    // parser, including the single fallback attempt below. Do not spend a
    // generic HTML-page attempt on a representation that parser must reject.
    if (
      !url ||
      source.routeId === "congress_public_law_bill_text" ||
      source.routeId === "federal_register_api_excerpt"
    ) return [];
    const parsed = new URL(url);
    // The complementary page parser accepts bounded HTML/plain text only.
    // Leave PDFs to their dedicated documentary route instead of spending an
    // explanatory attempt on a representation this parser must reject.
    if (/\.pdf$/iu.test(parsed.pathname)) return [];
    const cues = `${source.title} ${parsed.pathname}`;
    const implementation =
      /\b(?:approval|compliance|enforcement|guidance|implement\w*|regulations?)\b/iu
        .test(cues);
    const controlling =
      /\b(?:bill|chapter|enrolled|initiative|legislative text|statute)\b/iu
        .test(cues) || /billTextClient\.xhtml/iu.test(url);
    const explanatory =
      /\b(?:explainer|explanation|frequently asked|overview|privacy|rights)\b/iu
        .test(cues);
    return [{
      url,
      sourceType: implementation
        ? "implementation_record" as const
        : "official_explanation" as const,
      reasonForRetrieval:
        "Inspect the confirmed source page through the independent explanatory parser; do not reuse its Screen 1 excerpt as evidence.",
      priority: controlling ? 2 : explanatory || implementation ? 0 : 1,
      originalIndex,
    }];
  }).sort((left, right) =>
    left.priority - right.priority || left.originalIndex - right.originalIndex
  ).slice(0, 2).map(({ priority: _priority, originalIndex: _index, ...lead }) =>
    lead
  );
}

function missingPolicyExplanationSections(
  collection: EvidenceCollection | null,
): Screen2PolicySourceDiscoveryRequest["missingSections"] {
  const text = collection?.claims.map(({ statement }) => statement).join(" ") ??
    "";
  const missing: Array<
    Screen2PolicySourceDiscoveryRequest["missingSections"][number]
  > = [];
  if (!/\b(?:amend\w*|prohibit\w*|require\w*|create\w*|establish\w*|repeal\w*|replace\w*|expand\w*|restrict\w*|reform\w*|authorize\w*|provide\w*|allow\w*)\b/iu.test(text)) {
    missing.push("what_changed");
  }
  if (!/\b(?:appl(?:y|ies|ied) to|cover\w*|subject to|eligible|employer\w*|employee\w*|institution\w*|compan(?:y|ies)|business\w*|person\w*|people|agency|agencies|organization\w*|provider\w*|participant\w*|consumer\w*|issuer\w*)\b/iu.test(text)) {
    missing.push("coverage");
  }
  if (!/\b(?:enforce\w*|administ\w*|implement\w*|regulator\w*|commission|department|agency|penalt\w*|remed\w*)\b/iu.test(text)) {
    missing.push("enforcement_or_administration");
  }
  if (!/\b(?:effective|operative|takes? effect|compliance|implementation|enacted|signed|adopted|published|amended|repealed)\b/iu.test(text)) {
    missing.push("lifecycle_timing");
  }
  return missing;
}

function dateBefore(value: string, days: number) {
  return new Date(Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`) -
    days * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

export async function acquireScreen02ComplementaryPolicyEvidence(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  publicWebFetch?: Screen02ConnectorFetch;
  discoverAdditionalSources?: (
    request: Screen2PolicySourceDiscoveryRequest,
  ) => Promise<Screen02ComplementarySourceDiscoveryResult>;
  retrievedAt: string;
  documentNumber: string | null;
  congressApiKey?: string;
  openStatesApiKey?: string;
  supportingEvidenceLeads?: readonly Screen02ComplementaryEvidenceLead[];
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02ComplementaryEvidenceAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const attemptedSources: string[] = [];
  const finish = (value: Omit<Screen02ComplementaryEvidenceAcquisitionResult,
    "protocolVersion" | "focus" | "usage" | "attemptedSources">) => {
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "introductory_context" as const,
      attemptedSources: [...new Set(attemptedSources)],
      usage,
      ...value,
    };
  };
  const confirmed = input.workflow.confirmedShock;
  const candidate = input.workflow.candidates.find(
    ({ id }) => id === confirmed?.confirmation.candidateId,
  );
  if (!confirmed || !candidate) {
    return finish({
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: input.documentNumber,
      unresolved: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
      limitation:
        "Complementary evidence cannot run because the saved candidate no longer matches the confirmed policy identity.",
      parsed: null,
    });
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let collection: EvidenceCollection | null = null;
  let identityMismatchObserved = false;
  const merge = (parsed: ParsedOfficialDocumentPolicyEvidence | null) => {
    if (!parsed) return;
    collection = mergePolicyEvidenceCollections({
      previous: collection,
      next: parsed.collection,
      searchedKinds: [],
    });
  };
  const hasExactFederalRegisterIdentity = candidate.identitySources.some(
    ({ routeId, nativeId }) =>
      typeof input.documentNumber === "string" &&
      (
        routeId === "exact_federal_register_document" ||
        routeId === "federal_register_api_excerpt"
      ) &&
      nativeId === input.documentNumber,
  );
  let federalRegisterAttempts = 0;
  const acquireFederalRegisterExplanation = (timeoutMs: number) => {
    federalRegisterAttempts += 1;
    return federalRegisterAbstract({
      candidate,
      documentNumber: input.documentNumber,
      eventId: confirmed.id,
      retrievedAt: input.retrievedAt,
      jurisdiction: confirmed.issuingJurisdiction,
      fetch: input.fetch,
      timeoutMs,
      usage,
      attemptedSources,
    });
  };
  merge(await acquireFederalRegisterExplanation(
    input.timeoutMs ?? DEFAULT_FEDERAL_REGISTER_ABSTRACT_TIMEOUT_MS,
  ));
  merge(await congressSummary({
    candidate,
    eventId: confirmed.id,
    retrievedAt: input.retrievedAt,
    jurisdiction: confirmed.issuingJurisdiction,
    fetch: input.fetch,
    ...(input.congressApiKey !== undefined
      ? { apiKey: input.congressApiKey }
      : {}),
    timeoutMs,
    usage,
    attemptedSources,
  }));
  let openStatesNormalizationFailed = false;
  try {
    merge(await openStatesExplanation({
      candidate,
      eventId: confirmed.id,
      retrievedAt: input.retrievedAt,
      fetch: input.fetch,
      ...(input.openStatesApiKey !== undefined
        ? { apiKey: input.openStatesApiKey }
        : {}),
      timeoutMs,
      usage,
      attemptedSources,
    }));
  } catch {
    // Open States is a complementary explanation route, never the
    // controlling document. Preserve its already-accounted transport usage
    // and continue to independent pages or the retained official identity
    // passage instead of letting one provider-specific normalization defect
    // abort Screen 2. Failures beyond this adapter boundary are classified by
    // the runtime's bounded stage-specific workflow problems.
    openStatesNormalizationFailed = true;
  }

  const submittedLeads = (input.supportingEvidenceLeads ?? []).slice(0, 6)
    .flatMap((lead) => {
      const url = safePageUrl(lead.url);
      return url ? [{ ...lead, url }] : [];
    });
  const publicWebFetch = input.publicWebFetch;
  const discoverAdditionalSources = input.discoverAdditionalSources;
  const discoveryConfigured = Boolean(
    publicWebFetch && discoverAdditionalSources,
  );
  const initialLeadLimit = discoveryConfigured
    ? Math.min(3, MAXIMUM_PAGE_ATTEMPTS)
    : MAXIMUM_PAGE_ATTEMPTS;
  const leads = [...new Map([
    ...submittedLeads,
    ...identityPageLeads(candidate),
  ].map((lead) => [lead.url, lead])).values()].slice(0, initialLeadLimit);

  for (const [index, lead] of leads.entries()) {
    if (usage.documentAttempts >= initialLeadLimit ||
        usage.usefulDocuments >= 4) break;
    merge(await inspectedPage({
      candidate,
      eventId: confirmed.id,
      retrievedAt: input.retrievedAt,
      jurisdiction: confirmed.issuingJurisdiction,
      fetch: input.fetch,
      lead,
      index,
      timeoutMs,
      usage,
      attemptedSources,
      markIdentityMismatch: () => {
        identityMismatchObserved = true;
      },
    }));
  }

  let modelDiscoveryAttempted = false;
  let modelDiscoveredEvidenceRetained = false;
  const missingSections = missingPolicyExplanationSections(collection);
  const coreExplanationMissing = missingSections.includes("what_changed") ||
    missingSections.includes("coverage");
  if (
    coreExplanationMissing &&
    publicWebFetch &&
    discoverAdditionalSources &&
    usage.documentAttempts < MAXIMUM_PAGE_ATTEMPTS
  ) {
    let discovered: Screen02ComplementarySourceDiscoveryResult | null = null;
    try {
      discovered = await discoverAdditionalSources({
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        jurisdiction: confirmed.issuingJurisdiction,
        instrumentType: candidate.instrumentType,
        dateHints: (candidate.typedDates ?? []).flatMap(({ start, end }) =>
          [start, end].filter((value): value is string =>
            typeof value === "string" && value.length > 0
          )).slice(0, 10),
        missingSections,
      });
    } catch {
      // This is a recall fallback. Provider, accounting, or validation
      // failures must leave the deterministic evidence path intact.
    }
    if (discovered?.attempted) {
      modelDiscoveryAttempted = true;
      usage.sourceQueries += 1;
      usage.transportHops += 1;
      const responseBytes = Number.isSafeInteger(discovered.responseBytes) &&
          discovered.responseBytes >= 0
        ? Math.min(discovered.responseBytes, 4 * 1024 * 1024)
        : 0;
      usage.receivedBytes += responseBytes;
      usage.decodedBytes += responseBytes;
      usage.providerCostUnits.openai_web_search = 1;
      const urls = [...new Set(discovered.urls)]
        .flatMap((url) => {
          const safe = safeDiscoveredPageUrl(url);
          return safe ? [safe] : [];
        })
        .slice(0, MAXIMUM_PAGE_ATTEMPTS - usage.documentAttempts);
      usage.metadataRecords += urls.length;
      for (const [offset, url] of urls.entries()) {
        if (usage.documentAttempts >= MAXIMUM_PAGE_ATTEMPTS ||
            usage.usefulDocuments >= 4) break;
        const before = usage.usefulDocuments;
        merge(await inspectedPage({
          candidate,
          eventId: confirmed.id,
          retrievedAt: input.retrievedAt,
          jurisdiction: confirmed.issuingJurisdiction,
          fetch: publicWebFetch,
          lead: {
            url,
            sourceType: "specialist_analysis",
            reasonForRetrieval:
              "OpenAI web search supplied only a cited discovery URL; the underlying public page must be independently fetched, identity-bound, and parsed before any passage is retained.",
          },
          index: leads.length + offset,
          timeoutMs,
          usage,
          attemptedSources,
          allowDiscoveredPublicHost: true,
          markIdentityMismatch: () => {
            identityMismatchObserved = true;
          },
        }));
        if (usage.usefulDocuments > before) {
          modelDiscoveredEvidenceRetained = true;
        }
      }
    }
  }

  // Preserve the existing independent contextual route when the model did
  // not produce a verified page. Once a model-discovered page has passed all
  // checks, do not spend the remaining budget on a recent-news query that is
  // poorly suited to historical policies.
  if (
    !modelDiscoveredEvidenceRetained &&
    usage.documentAttempts < MAXIMUM_PAGE_ATTEMPTS &&
    usage.usefulDocuments < 4
  ) {
    usage.sourceQueries += 1;
    usage.transportHops += 1;
    attemptedSources.push(GDELT_DOC_API_ENDPOINT);
    const contextual = await discoverGdeltContextualLeads({
      fetch: input.fetch,
      query: candidate.officialTitle,
      startDate: dateBefore(input.retrievedAt, 365),
      endDate: input.retrievedAt.slice(0, 10),
      retrievedAt: input.retrievedAt,
      resultLimit: 5,
      timeoutMs: Math.min(timeoutMs, 3_000),
    });
    usage.metadataRecords += contextual.diagnostics.recordsReceived;
    const contextualLeads = contextual.leads.flatMap((lead) => {
      const url = safePageUrl(lead.locator);
      if (!url || leads.some((existing) => existing.url === url)) return [];
      return [{
        url,
        sourceType: "specialist_analysis" as const,
        reasonForRetrieval:
          "GDELT supplied only a discovery lead; inspect the underlying page and independently bind it to the confirmed policy before retaining any passage.",
      }];
    }).slice(0, MAXIMUM_PAGE_ATTEMPTS - usage.documentAttempts);
    for (const [offset, lead] of contextualLeads.entries()) {
      if (usage.documentAttempts >= MAXIMUM_PAGE_ATTEMPTS ||
          usage.usefulDocuments >= 4) break;
      merge(await inspectedPage({
        candidate,
        eventId: confirmed.id,
        retrievedAt: input.retrievedAt,
        jurisdiction: confirmed.issuingJurisdiction,
        fetch: input.fetch,
        lead,
        index: leads.length + offset,
        timeoutMs,
        usage,
        attemptedSources,
        markIdentityMismatch: () => {
          identityMismatchObserved = true;
        },
      }));
    }
  }

  if (
    !collection &&
    hasExactFederalRegisterIdentity &&
    federalRegisterAttempts < MAXIMUM_FEDERAL_REGISTER_ABSTRACT_ATTEMPTS
  ) {
    merge(await acquireFederalRegisterExplanation(
      input.timeoutMs ?? DEFAULT_FEDERAL_REGISTER_ABSTRACT_RETRY_TIMEOUT_MS,
    ));
  }

  if (!collection) {
    merge(retainedFederalRegisterAbstract({
      candidate,
      documentNumber: input.documentNumber,
      eventId: confirmed.id,
      jurisdiction: confirmed.issuingJurisdiction,
      usage,
    }));
  }

  if (!collection) {
    merge(retainedOfficialIdentityIntroduction({
      candidate,
      eventId: confirmed.id,
      jurisdiction: confirmed.issuingJurisdiction,
      usage,
    }));
  }

  if (!collection) {
    return finish({
      status: attemptedSources.length ? "waiting_source" : "unsupported",
      failureCode: attemptedSources.length
        ? identityMismatchObserved
          ? "wrong_document"
          : "source_unavailable"
        : "unsupported_format",
      documentNumber: input.documentNumber,
      unresolved: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
      limitation: openStatesNormalizationFailed
        ? "The state-legislative explanation response could not be normalized, and no independent complementary route yielded a usable passage. This extraction failure does not mean the policy lacks a substantive change or covered population; controlling-document research remains separate."
        : modelDiscoveryAttempted
          ? "Deterministic sources and one model-assisted citation search were exhausted, but no returned public page passed independent retrieval, identity, and extraction checks. This is an evidence-access limitation, not evidence that the policy changed nothing or covered nobody."
          : "No approved complementary route yielded an inspected, identity-bound explanatory passage. This failure does not block controlling-document or other independent evidence steps.",
      parsed: null,
    });
  }
  const projections = projectPolicyEvidenceClaims(collection);
  return finish({
    status: "partial",
    failureCode: null,
    documentNumber: input.documentNumber,
    unresolved: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
    limitation: openStatesNormalizationFailed
      ? "The state-legislative explanation response could not be normalized, so this introduction uses another inspected identity-bound passage. This is an extraction limitation, not evidence that the policy lacks a substantive change or covered population; exact historical coverage, exemptions, enforcement, version scope, and treatment-relevant timing remain separate documentary questions."
      : modelDiscoveredEvidenceRetained
        ? "A web-search citation led to a public page that was independently fetched, identity-bound, and parsed before its attributed explanatory passages were saved. Exact controlling conditions and treatment-relevant timing remain separate documentary questions."
        : "An inspected, identity-bound introduction was saved from complementary evidence. Exact historical coverage, exemptions, enforcement, version scope, and treatment-relevant timing remain separate documentary questions.",
    parsed: {
      collection,
      projections,
      unresolved: [...POLICY_EVIDENCE_REQUIREMENT_KINDS],
      status: "partial",
    },
  });
}
