import {
  SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
  type PolicyEvidenceRequirementKind,
  type PolicyReviewFailureCode,
  type SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import {
  mergePolicyEvidenceCollections,
  parseOfficialDocumentPolicyEvidence,
  projectPolicyEvidenceClaims,
  type ParsedOfficialDocumentPolicyEvidence,
} from "../core/six-screen/policy-review";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  officialDocumentAccessChallenge,
  visibleOfficialDocumentLinks,
} from "./official-document-html";
import { normalizeOfficialDocumentPayload } from
  "./official-document-normalization";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";
import { govInfoPublicLawPackageFromLocator } from
  "./screen01-govinfo-statute-discovery";

export const SIX_SCREEN_OFFICIAL_DOCUMENT_POLICY_ADAPTER_VERSION =
  "official-document-gap-directed-policy-v9" as const;

const MAXIMUM_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAXIMUM_DOCUMENT_ATTEMPTS = 6;
const MAXIMUM_USEFUL_DOCUMENTS = 4;
const MAXIMUM_RELATIONSHIP_RECORDS = 24;
const MAXIMUM_REDIRECTS = 2;
const DEFAULT_TIMEOUT_MS = 9_000;

export type Screen02OfficialDocumentAcquisitionResult = {
  protocolVersion: typeof SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION;
  focus: "controlling_document" | "related_sources";
  status: "ready" | "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: null;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  parsed: ParsedOfficialDocumentPolicyEvidence | null;
  usage: ResearchTaskOperationUsage;
};

type Candidate = SixScreenWorkflowState["candidates"][number];
type IdentitySource = Candidate["identitySources"][number];

export function preferredScreen02OfficialDocumentSource(
  candidate: Pick<Candidate, "identitySources">,
) {
  return candidate.identitySources.filter((value) =>
    [
      "reviewed_official_document",
      "federal_register_api_excerpt",
      "uk_legislation_document",
      "eu_legal_document",
      "govinfo_public_law",
    ].includes(value.routeId ?? "") &&
    value.accessStatus === "retained_passage" &&
    value.inspectedText !== "metadata_only" &&
    Boolean(value.retainedText?.trim()) &&
    Boolean(value.contentHash)
  ).map((source, index) => {
    const text = source.retainedText ?? "";
    const score =
      (source.inspectedText === "full" ? 12 : 0) +
      (/\b(?:must|shall|required to|may not|has the right to)\b/iu.test(text) ? 5 : 0) +
      (/\b(?:applies to|subject to|threshold|doing business|established in)\b/iu.test(text) ? 4 : 0) +
      (/\b(?:exempt|does not apply|penalt|injunctive|attorney general)\w*\b/iu.test(text) ? 3 : 0) +
      (source.nativeId ? 1 : 0);
    return { source, score, index };
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .at(0)?.source ?? null;
}

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

function supportsIdentity(text: string, candidate: Candidate) {
  const normalizedText = normalize(text);
  if (candidate.formalIdentifiers.some((identifier) => {
    const value = normalize(identifier);
    return value.length >= 4 && normalizedText.includes(value);
  })) return true;
  return [candidate.officialTitle, ...candidate.aliases].some((name) => {
    const words = [...new Set(identityWords(name))];
    if (!words.length) return false;
    const found = words.filter((word) => normalizedText.includes(word)).length;
    return found >= Math.max(2, Math.ceil(words.length * 0.6));
  });
}

function safeUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || url.toString().length > 2_000
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function preferredOfficialTextLocator(value: string) {
  try {
    const url = new URL(value);
    if (
      /^(?:www\.)?leginfo\.legislature\.ca\.gov$/u.test(url.hostname) &&
      url.pathname.endsWith("/billNavClient.xhtml") &&
      /^\d{8,10}[A-Z]{1,4}\d+[A-Z]?$/u.test(
        url.searchParams.get("bill_id") ?? "",
      )
    ) {
      url.pathname = url.pathname.replace(
        /billNavClient\.xhtml$/u,
        "billTextClient.xhtml",
      );
      for (const key of [...url.searchParams.keys()]) {
        if (key !== "bill_id") url.searchParams.delete(key);
      }
      return url.toString();
    }
  } catch { /* safeUrl rejects the original value later. */ }
  const packageId = govInfoPublicLawPackageFromLocator(value);
  if (!packageId) return value;
  try {
    const url = new URL(value);
    const packageRoot = `/content/pkg/${packageId}`;
    if (
      url.pathname === `/app/details/${packageId}` ||
      url.pathname === `/app/details/${packageId}/` ||
      url.pathname === packageRoot || url.pathname === `${packageRoot}/`
    ) {
      return `https://www.govinfo.gov/content/pkg/${packageId}/html/${packageId}.htm`;
    }
  } catch { /* safeUrl rejects the original value later. */ }
  return value;
}

function samePublisherRedirect(from: string, to: string) {
  const left = new URL(from);
  const right = new URL(to);
  const canonical = (host: string) => host.replace(/^www\./u, "");
  return canonical(left.hostname) === canonical(right.hostname) &&
    right.protocol === "https:" && !right.username && !right.password &&
    !right.port && !right.hash;
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256:${Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")).join("")}`;
}

function relationshipPriority(label: string, href: string) {
  const value = `${label} ${href}`.toLocaleLowerCase("en-US");
  const categories = [
    /\b(?:penalt|enforcement|remed|civil action|attorney general)\w*/u,
    /\b(?:commencement|effective|compliance|implementation|transition)\w*/u,
    /\b(?:exempt|exception|exclusion|definition|threshold|applicability)\w*/u,
    /\b(?:amend|history|version|prior|repeal)\w*/u,
    /\b(?:full text|chapter|section|statute|regulation)\w*/u,
  ];
  const index = categories.findIndex((pattern) => pattern.test(value));
  return index < 0 ? null : 100 - index * 10;
}

type RetrievedDocument = {
  source: IdentitySource;
  canonicalUrl: string;
  representation: "html" | "xml" | "text";
  body: string;
  text: string;
  contentHash: string;
  links: Array<{ href: string; label: string }>;
};

async function retrieveDocument(input: {
  fetch: Screen02ConnectorFetch;
  source: IdentitySource;
  locator: string;
  candidate: Candidate;
  timeoutMs: number;
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
}): Promise<RetrievedDocument | null> {
  let current = safeUrl(preferredOfficialTextLocator(input.locator));
  if (!current) return null;
  const visited = new Set<string>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    for (let redirect = 0; redirect <= MAXIMUM_REDIRECTS; redirect += 1) {
      if (input.usage.documentAttempts >= MAXIMUM_DOCUMENT_ATTEMPTS ||
          input.usage.usefulDocuments >= MAXIMUM_USEFUL_DOCUMENTS) return null;
      if (!current || visited.has(current)) return null;
      visited.add(current);
      input.attemptedSources.push(current);
      input.usage.documentAttempts += 1;
      input.usage.transportHops += 1;
      const response = await input.fetch(current, {
        method: "GET",
        headers: {
          accept: "text/html, application/xhtml+xml, application/xml, text/xml, text/plain;q=0.9",
          "cache-control": "no-store",
          "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.redirected) {
        await response.body?.cancel("Automatic redirects are not evidence")
          .catch(() => undefined);
        return null;
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = safeUrl(response.headers.get("location") ?? "", current);
        await response.body?.cancel("Following validated official redirect")
          .catch(() => undefined);
        if (!next || !samePublisherRedirect(current, next)) return null;
        current = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel("Official document response rejected")
          .catch(() => undefined);
        return null;
      }
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAXIMUM_DOCUMENT_BYTES) {
        await response.body?.cancel("Official document exceeds byte bound")
          .catch(() => undefined);
        return null;
      }
      const mediaType = (response.headers.get("content-type") ?? "")
        .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
      if (mediaType === "application/pdf" ||
          (mediaType && !/(?:html|xml|plain)/u.test(mediaType))) {
        await response.body?.cancel("Unsupported official document format")
          .catch(() => undefined);
        return null;
      }
      const body = await readScreen02BoundedResponseText(
        response,
        MAXIMUM_DOCUMENT_BYTES,
      );
      const bytes = new TextEncoder().encode(body).byteLength;
      input.usage.receivedBytes += bytes;
      if (officialDocumentAccessChallenge(body)) return null;
      const normalized = normalizeOfficialDocumentPayload({ body, mediaType });
      const { representation, text } = normalized;
      input.usage.decodedBytes += new TextEncoder().encode(text).byteLength;
      if (!normalized.quality.accepted || text.length < 80 ||
          !supportsIdentity(text, input.candidate)) return null;
      input.usage.usefulDocuments += 1;
      return {
        source: input.source,
        canonicalUrl: response.url && safeUrl(response.url)
          ? response.url
          : current,
        representation,
        body,
        text,
        contentHash: await sha256(body),
        links: representation === "html"
          ? visibleOfficialDocumentLinks(body)
          : [],
      };
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function parsedDocument(input: {
  workflow: SixScreenWorkflowState;
  candidate: Candidate;
  retrievedAt: string;
  document: RetrievedDocument;
  sourceId: string;
  searchedRequirementKinds: readonly PolicyEvidenceRequirementKind[];
  relation: boolean;
}) {
  const confirmed = input.workflow.confirmedShock!;
  return parseOfficialDocumentPolicyEvidence({
    eventId: confirmed.id,
    sourceId: input.sourceId,
    provider: input.document.source.provider ?? input.document.source.publisher,
    nativeId: input.document.source.nativeId ??
      confirmed.formalIdentifiers[0] ?? null,
    canonicalUrl: input.document.canonicalUrl,
    title: input.document.source.title || input.candidate.officialTitle,
    publisher: input.document.source.publisher,
    issuer: confirmed.issuer,
    jurisdiction: confirmed.issuingJurisdiction,
    publicationDate: input.document.source.publishedDate,
    retrievedAt: input.retrievedAt,
    contentHash: input.document.contentHash,
    retainedText: input.document.text,
    representation: input.document.representation,
    acquisitionProvenance: "direct",
    inspectedText: "full",
    sourceRole: input.relation
      ? "source-native related official document acquired to resolve a specific Screen 2 gap"
      : "controlling or issuer-maintained official representation acquired for Screen 2",
    documentVersionLabel: input.relation
      ? "Related official representation as retrieved"
      : "Confirmed official representation as retrieved",
    searchedRequirementKinds: input.searchedRequirementKinds,
  });
}

export async function acquireScreen02OfficialDocumentPolicy(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  focus: "controlling_document" | "related_sources";
  searchedRequirementKinds: readonly PolicyEvidenceRequirementKind[];
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02OfficialDocumentAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const attemptedSources: string[] = [];
  const confirmed = input.workflow.confirmedShock;
  const candidate = input.workflow.candidates.find(
    ({ id }) => id === confirmed?.confirmation.candidateId,
  );
  const finish = (value: Omit<Screen02OfficialDocumentAcquisitionResult,
    "protocolVersion" | "focus" | "usage" | "attemptedSources">) => {
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: input.focus,
      attemptedSources: [...new Set(attemptedSources)],
      usage,
      ...value,
    };
  };
  if (!confirmed || !candidate) {
    return finish({
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: null,
      unresolved: ["confirmed official-document identity"],
      limitation:
        "The saved candidate no longer matches the confirmed policy identity.",
      parsed: null,
    });
  }

  // A trusted API may supply an official legislature locator without having
  // downloaded its contents during Screen 1. Screen 2 must inspect that URL
  // instead of discarding it merely because its current state is metadata-only.
  let sources = candidate.identitySources.filter((source) =>
    safeUrl(source.locator));
  if (input.focus === "controlling_document") {
    const expanded = sources.flatMap((source) => {
      const url = new URL(source.locator);
      if (!/^(?:www\.)?legislation\.gov\.uk$/u.test(url.hostname)) return [];
      const root = /^\/(?:id\/)?(?:ukpga|ukla|asp|anaw|nia)\/\d{4}\/\d+(?=\/|$)/u.exec(url.pathname)?.[0].replace(/^\/id/u, "");
      if (!root) return [];
      // Section 1 is a bounded identity seed, not the whole policy briefing.
      // Honour a supplied historical representation when expanding the Act.
      const supplied = (input.workflow.officialSourceLocators ?? []).flatMap((locator) => {
        const hint = new URL(locator);
        return /^(?:www\.)?legislation\.gov\.uk$/u.test(hint.hostname) &&
          (hint.pathname === root || hint.pathname.startsWith(`${root}/`)) ? [hint] : [];
      })[0];
      const path = supplied?.pathname.replace(/\/(?:data\.xml|contents)\/?$/u, "").replace(/\/$/u, "") ?? root;
      return [{ ...source, locator: `https://www.legislation.gov.uk${path}/data.xml` }];
    });
    sources = [...new Map([...expanded, ...sources].map(source => [source.locator, source])).values()];
  }
  const retrieved: RetrievedDocument[] = [];
  const relationshipLeads: Array<{
    source: IdentitySource;
    locator: string;
    priority: number;
  }> = [];
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (const source of sources.slice(0, 4)) {
    if (usage.documentAttempts >= MAXIMUM_DOCUMENT_ATTEMPTS) break;
    const document = await retrieveDocument({
      fetch: input.fetch,
      source,
      locator: source.locator,
      candidate,
      timeoutMs,
      usage,
      attemptedSources,
    });
    if (!document) continue;
    if (input.focus === "controlling_document") retrieved.push(document);
    for (const link of document.links) {
      if (relationshipLeads.length >= MAXIMUM_RELATIONSHIP_RECORDS) break;
      const locator = safeUrl(link.href, document.canonicalUrl);
      const priority = locator
        ? relationshipPriority(link.label, locator)
        : null;
      if (
        locator && priority !== null && locator !== document.canonicalUrl &&
        samePublisherRedirect(document.canonicalUrl, locator)
      ) relationshipLeads.push({ source, locator, priority });
    }
  }
  if (input.focus === "related_sources") {
    const unique = [...new Map(relationshipLeads.sort((left, right) =>
      right.priority - left.priority).map((lead) => [lead.locator, lead])).values()]
      .slice(0, MAXIMUM_RELATIONSHIP_RECORDS);
    usage.sourceQueries = 1;
    usage.metadataRecords = unique.length;
    for (const lead of unique.slice(0, 4)) {
      if (usage.documentAttempts >= MAXIMUM_DOCUMENT_ATTEMPTS ||
          usage.usefulDocuments >= MAXIMUM_USEFUL_DOCUMENTS) break;
      const document = await retrieveDocument({
        fetch: input.fetch,
        source: lead.source,
        locator: lead.locator,
        candidate,
        timeoutMs,
        usage,
        attemptedSources,
      });
      if (document) retrieved.push(document);
    }
  }

  let collection: ParsedOfficialDocumentPolicyEvidence["collection"] | null = null;
  for (const [index, document] of retrieved.entries()) {
    const parsed = parsedDocument({
      workflow: input.workflow,
      candidate,
      retrievedAt: input.retrievedAt,
      document,
      sourceId: `${document.source.id}-${input.focus}-${index + 1}`.slice(0, 180),
      searchedRequirementKinds: input.searchedRequirementKinds,
      relation: input.focus === "related_sources",
    });
    collection = mergePolicyEvidenceCollections({
      previous: collection,
      next: parsed.collection,
      searchedKinds: input.searchedRequirementKinds,
    });
  }

  if (!collection && input.focus === "controlling_document") {
    const source = preferredScreen02OfficialDocumentSource(candidate);
    if (source?.retainedText && source.contentHash) {
      const normalized = normalizeOfficialDocumentPayload({
        body: source.retainedText,
        mediaType: "text/plain",
      });
      if (!normalized.quality.accepted) {
        return finish({
          status: "waiting_source",
          failureCode: "unparsed",
          documentNumber: null,
          unresolved: [...input.searchedRequirementKinds],
          limitation:
            "The retained identity excerpt failed the legal-text quality gate, so malformed markup was not promoted into Screen 2.",
          parsed: null,
        });
      }
      const parsed = parseOfficialDocumentPolicyEvidence({
        eventId: confirmed.id,
        sourceId: source.id,
        provider: source.provider ?? source.publisher,
        nativeId: source.nativeId ?? confirmed.formalIdentifiers[0] ?? null,
        canonicalUrl: source.locator,
        title: source.title,
        publisher: source.publisher,
        issuer: confirmed.issuer,
        jurisdiction: confirmed.issuingJurisdiction,
        publicationDate: source.publishedDate,
        retrievedAt: source.retrievedAt,
        contentHash: source.contentHash,
        retainedText: normalized.text,
        acquisitionProvenance: "third_party",
        inspectedText: "partial",
        sourceRole:
          "reviewed identity-source description reused after the full official representation was unavailable; not original document bytes",
        documentVersionLabel: "Reviewed identity excerpt",
        searchedRequirementKinds: input.searchedRequirementKinds,
        missingRequirementStatus: "source_unavailable",
      });
      usage.usefulDocuments += 1;
      usage.decodedBytes += new TextEncoder().encode(normalized.text).byteLength;
      return finish({
        status: "partial",
        failureCode: null,
        documentNumber: null,
        unresolved: parsed.unresolved,
        limitation:
          "The controlling official representation could not be acquired in this step. A provenance-labeled identity excerpt was retained as a seed, and source-native follow-up remains queued.",
        parsed,
      });
    }
  }
  if (!collection) {
    return finish({
      status: input.focus === "related_sources" ? "unsupported" : "waiting_source",
      failureCode: input.focus === "related_sources"
        ? "unsupported_format"
        : "source_unavailable",
      documentNumber: null,
      unresolved: [...input.searchedRequirementKinds],
      limitation: input.focus === "related_sources"
        ? "No bounded, same-publisher source-native relationship supplied usable identity-bound HTML, XML, or text. PDF-only and unbound links remain explicit format or route limitations."
        : "The confirmed identity remains saved, but no full official representation was available within this bounded acquisition step.",
      parsed: null,
    });
  }
  const unresolved = collection.requirements.filter(({ status }) =>
    status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  return finish({
    status: unresolved.length ? "partial" : "ready",
    failureCode: null,
    documentNumber: null,
    unresolved,
    limitation: unresolved.length
      ? "The acquired official representations support a substantive partial briefing. Consequential missing or partial requirements remain queued or explicitly unresolved."
      : null,
    parsed: {
      collection,
      projections: projectPolicyEvidenceClaims(collection),
      unresolved,
      status: unresolved.length ? "partial" : "ready",
    },
  });
}
