import {
  SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION,
  SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
  SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS,
  SIX_SCREEN_SCHOLARLY_DOCUMENT_VERSION,
  SIX_SCREEN_SCHOLARLY_PASSAGE_VERSION,
  canonicalScholarlyVisibleText,
  createScholarlyDocumentAcquisition,
  createScholarlyInspectedDocument,
  createScholarlyInspectedPassage,
  type ScholarlyDocumentAcquisition,
  type ScholarlyDocumentAcquisitionOutcome,
  type ScholarlyDocumentInspectionPlan,
  type ScholarlyDocumentUsage,
  type ScholarlyInspectedDocument,
} from "../core/six-screen/mechanism-scholarly-document";
import {
  officialDocumentAccessChallenge,
  primaryOfficialDocumentHtml,
  visibleOfficialDocumentMetadata,
  visibleOfficialDocumentText,
  visibleOfficialDocumentTitles,
} from "./official-document-html";
import type { Screen02ConnectorFetch } from "./screen02-connectors";

export const SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION =
  "screen-05-exact-scholarly-html-v1" as const;

function emptyUsage(): ScholarlyDocumentUsage {
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

function bytesToHex(bytes: Uint8Array) {
  return Array.from(
    bytes,
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", digestInput.buffer),
  );
  return `sha256:${bytesToHex(digest)}`;
}

class ScholarlyResponseTooLarge extends Error {}

async function readBoundedResponseBytes(
  response: Response,
  maximumBytes: number,
) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength > maximumBytes - receivedBytes) {
        try {
          await reader.cancel("Scholarly response byte limit reached");
        } catch {
          // Rejection is already final; cancellation is best effort.
        }
        throw new ScholarlyResponseTooLarge(
          "Scholarly response exceeded the byte limit.",
        );
      }
      chunks.push(chunk.value);
      receivedBytes += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function boundedHeader(value: string | null, maximum: number) {
  if (!value) return null;
  const normalized = canonicalScholarlyVisibleText(value);
  return normalized && normalized.length <= maximum ? normalized : null;
}

function canonicalDoi(value: string | null | undefined) {
  if (!value) return null;
  const normalized = canonicalScholarlyVisibleText(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "")
    .replace(/^doi:\s*/iu, "")
    .toLocaleLowerCase("en-US");
  return /^10\.\d{4,9}\/[\p{L}\p{N}._;()/:+\-]+$/iu.test(normalized)
    ? normalized
    : null;
}

function metadataValue(
  metadata: readonly Record<string, string>[],
  names: readonly string[],
) {
  const accepted = new Set(names.map((name) =>
    name.toLocaleLowerCase("en-US")
  ));
  for (const item of metadata) {
    const name = (item.name ?? item.property ?? "")
      .toLocaleLowerCase("en-US");
    if (!accepted.has(name)) continue;
    const value = boundedHeader(item.content ?? item.value ?? null, 2_000);
    if (value) return value;
  }
  return null;
}

function responseUrlMatches(response: Response, requested: string) {
  if (!response.url) return true;
  try {
    const actual = new URL(response.url);
    actual.hash = "";
    return actual.toString() === requested;
  } catch {
    return false;
  }
}

function preflightNote(status: Exclude<
  ScholarlyDocumentInspectionPlan["initialStatus"],
  "pending"
>) {
  const notes: Record<typeof status, string> = {
    rights_not_confirmed:
      "No request was made because the researcher did not confirm an access basis.",
    unsupported_identifier:
      "No request was made because this supplied identifier has no exact-document route in the first adapter.",
    exact_document_url_required:
      "No request was made because a DOI or metadata locator is not itself an exact document URL.",
    target_url_mismatch:
      "No request was made because a researcher-supplied URL target may only fetch that exact saved URL.",
    doi_resolver_not_document:
      "No request was made because a DOI resolver locator is metadata identity, not an inspected document, and redirects are not followed.",
    source_family_not_configured:
      "No request was made because this exact scholarly host is outside the configured source family.",
    source_family_not_tested:
      "No request was made because this configured scholarly host has not passed the exact adapter probe.",
    publisher_limit_reached:
      "No request was made because the one-request-per-publisher ceiling was already used.",
    document_attempt_budget_exhausted:
      "No request was made because the 16-attempt mechanism-document ceiling was reached.",
    useful_document_budget_exhausted:
      "No request was made because the eight-useful-document ceiling was reached.",
  };
  return notes[status];
}

function failureNote(outcome: ScholarlyDocumentAcquisitionOutcome) {
  const notes: Partial<Record<ScholarlyDocumentAcquisitionOutcome, string>> = {
    source_unavailable:
      "The exact scholarly document request failed; this is not evidence that the work is unavailable everywhere.",
    timed_out:
      "The exact scholarly document request reached its 20-second ceiling and was not retried.",
    redirect_not_followed:
      "The exact URL returned a redirect. No location was followed or treated as a document.",
    http_failure:
      "The exact URL returned a non-success HTTP response; no scholarly text was retained.",
    unsupported_format:
      "The response was not bounded HTML or plain text. PDF and other formats remain unsupported in this slice.",
    response_too_large:
      "The response exceeded 512,000 bytes and no text was retained.",
    access_challenge:
      "The response was an access-control interstitial rather than scholarly text.",
    document_identity_mismatch:
      "The returned representation did not preserve the exact requested URL/DOI identity.",
    unparsed_document:
      "The response contained no usable normalized visible text.",
    passage_not_found:
      "The researcher-supplied passage was not found in the normalized visible text.",
    passage_ambiguous:
      "The researcher-supplied passage appeared more than once; a unique exact passage is required.",
  };
  return notes[outcome] ?? "The scholarly document attempt was not retained.";
}

function failed(input: {
  id: string;
  ordinal: number;
  plan: ScholarlyDocumentInspectionPlan;
  startedAt: string;
  completedAt: string;
  attemptedUrl: string | null;
  outcome: Exclude<
    ScholarlyDocumentAcquisitionOutcome,
    "passage_retained" | "abstract_passage_retained"
  >;
  usage: ScholarlyDocumentUsage;
  note?: string;
}) {
  return createScholarlyDocumentAcquisition({
    schemaVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    plan: input.plan,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    attemptedUrl: input.attemptedUrl,
    outcome: input.outcome,
    failureCode: input.outcome,
    note: input.note ?? failureNote(input.outcome),
    usage: input.usage,
    document: null,
    passage: null,
    claimBoundary:
      "A retained passage records normalized visible text and exact offsets from one fetched representation. It is eligible only for later researcher review; it is not itself a theory claim, empirical conclusion, mechanism, prediction, measure recommendation, or causal estimate.",
  });
}

export async function acquireScholarlyDocumentPassage(input: {
  acquisitionId: string;
  coordinate: string;
  plan: ScholarlyDocumentInspectionPlan;
  fetch: Screen02ConnectorFetch;
  now: () => string;
  monotonicNow?: () => number;
}): Promise<ScholarlyDocumentAcquisition> {
  const startedAt = input.now();
  const usage = emptyUsage();
  const clock = input.monotonicNow ?? Date.now;
  const startedMs = clock();
  const finish = () => {
    usage.activeResearchMs = Math.min(
      SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS,
      Math.max(0, Math.round(clock() - startedMs)),
    );
  };
  if (input.plan.initialStatus !== "pending") {
    return failed({
      id: input.acquisitionId,
      ordinal: input.plan.ordinal,
      plan: input.plan,
      startedAt,
      completedAt: input.now(),
      attemptedUrl: null,
      outcome: input.plan.initialStatus,
      usage,
      note: preflightNote(input.plan.initialStatus),
    });
  }
  const requestedUrl = input.plan.input.exactDocumentUrl!;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS);
  usage.documentAttempts = 1;
  usage.transportHops = 1;
  try {
    let response: Response;
    try {
      response = await input.fetch(requestedUrl, {
        method: "GET",
        headers: {
          accept: "text/html, text/plain;q=0.9",
          "accept-encoding": "identity",
          "user-agent":
            "ShockAudit scholarly inspection (+https://shockaudit.ainp-research.workers.dev/)",
        },
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
    } catch {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: timedOut ? "timed_out" : "source_unavailable",
        usage,
      });
    }
    if (response.status >= 300 && response.status < 400) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "redirect_not_followed",
        usage,
      });
    }
    if (!response.ok || response.status !== 200) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "http_failure",
        usage,
      });
    }
    const mediaType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
    if (mediaType !== "text/html" && mediaType !== "text/plain") {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "unsupported_format",
        usage,
      });
    }
    let rawBody: Uint8Array;
    try {
      rawBody = await readBoundedResponseBytes(
        response,
        SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
      );
    } catch (caught) {
      if (caught instanceof ScholarlyResponseTooLarge) {
        usage.receivedBytes = SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES;
      }
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: timedOut
          ? "timed_out"
          : caught instanceof ScholarlyResponseTooLarge
            ? "response_too_large"
            : "source_unavailable",
        usage,
      });
    }
    usage.receivedBytes = rawBody.byteLength;
    const body = new TextDecoder().decode(rawBody);
    if (mediaType === "text/html" && officialDocumentAccessChallenge(body)) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "access_challenge",
        usage,
      });
    }
    if (!responseUrlMatches(response, requestedUrl)) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "document_identity_mismatch",
        usage,
      });
    }
    const metadata = mediaType === "text/html"
      ? visibleOfficialDocumentMetadata(body)
      : [];
    const returnedDoi = canonicalDoi(metadataValue(metadata, [
      "citation_doi",
      "dc.identifier",
      "dc.identifier.doi",
      "prism.doi",
      "bepress_citation_doi",
    ]));
    if (
      input.plan.target.doi !== null &&
      returnedDoi !== input.plan.target.doi
    ) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "document_identity_mismatch",
        usage,
      });
    }
    const visible = canonicalScholarlyVisibleText(
      mediaType === "text/html"
        ? visibleOfficialDocumentText(primaryOfficialDocumentHtml(body))
        : body,
    );
    if (!visible) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "unparsed_document",
        usage,
      });
    }
    usage.decodedBytes = new TextEncoder().encode(visible).byteLength;
    if (usage.decodedBytes > SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES) {
      usage.decodedBytes = SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES;
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "response_too_large",
        usage,
      });
    }
    const quote = input.plan.input.exactPassage!;
    const startOffset = visible.indexOf(quote);
    if (startOffset < 0) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "passage_not_found",
        usage,
      });
    }
    if (visible.lastIndexOf(quote) !== startOffset) {
      finish();
      return failed({
        id: input.acquisitionId,
        ordinal: input.plan.ordinal,
        plan: input.plan,
        startedAt,
        completedAt: input.now(),
        attemptedUrl: requestedUrl,
        outcome: "passage_ambiguous",
        usage,
      });
    }
    const sourceId = `scholarly-source-${input.coordinate}`;
    const documentVersionId = `scholarly-document-version-${input.coordinate}`;
    const passageId = `scholarly-passage-${input.coordinate}`;
    const normalizedTextHash = await sha256(visible);
    const quoteHash = await sha256(quote);
    const contentHash = await sha256(rawBody);
    const completedAt = input.now();
    const qualification = input.plan.input.inspectionMode === "abstract_only"
      ? `${input.plan.input.qualification ?? "No additional researcher qualification was supplied."} Abstract-only text cannot support a detailed measure, result, or mechanism claim.`
      : `${input.plan.input.qualification ?? "No additional researcher qualification was supplied."} This exact passage is retained for later researcher review; it does not by itself establish the proposed use.`;
    const passage = createScholarlyInspectedPassage({
      schemaVersion: SIX_SCREEN_SCHOLARLY_PASSAGE_VERSION,
      id: passageId,
      sourceId,
      documentVersionId,
      sourceTextHash: normalizedTextHash,
      quoteHash,
      exactText: quote,
      locator:
        `normalized visible-text offsets ${startOffset}-${startOffset + quote.length}`,
      startOffset,
      endOffset: startOffset + quote.length,
      inspectionStatus: input.plan.input.inspectionMode,
      purpose: input.plan.input.passagePurpose,
      qualification,
      detailedClaimUse: input.plan.input.inspectionMode === "abstract_only"
        ? "abstract_only_not_eligible"
        : "eligible_for_later_researcher_review",
    });
    const title = mediaType === "text/html"
      ? metadataValue(metadata, ["citation_title", "dc.title", "og:title"]) ??
        visibleOfficialDocumentTitles(body)[0] ?? input.plan.target.title
      : input.plan.target.title;
    const language = mediaType === "text/html"
      ? metadataValue(metadata, ["citation_language", "dc.language"]) ??
        "undetermined"
      : "undetermined";
    const etag = boundedHeader(response.headers.get("etag"), 500);
    const lastModified = boundedHeader(
      response.headers.get("last-modified"),
      500,
    );
    const document = createScholarlyInspectedDocument({
      schemaVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_VERSION,
      id: `scholarly-document-${input.coordinate}`,
      sourceId,
      documentVersionId,
      targetReference: {
        targetId: input.plan.target.id,
        targetFingerprint: input.plan.target.targetFingerprint,
        origin: input.plan.target.origin,
        originId: input.plan.target.originId,
        originFingerprint: input.plan.target.originFingerprint,
      },
      sourceFamily: input.plan.sourceFamily as ScholarlyInspectedDocument["sourceFamily"],
      canonicalUrl: requestedUrl,
      title: canonicalScholarlyVisibleText(title ?? requestedUrl).slice(0, 2_000),
      doi: input.plan.target.doi,
      identityVerification: input.plan.target.doi
        ? "doi_metadata_match"
        : "exact_researcher_supplied_url",
      representation: mediaType === "text/html" ? "html" : "plain_text",
      mediaType,
      language: canonicalScholarlyVisibleText(language).slice(0, 40) ||
        "undetermined",
      retrievedAt: completedAt,
      etag,
      lastModified,
      versionLabel: etag
        ? `etag ${etag}`
        : lastModified
          ? `last-modified ${lastModified}`
          : `retrieved snapshot ${completedAt}`,
      contentHash,
      normalizedTextHash,
      receivedBytes: usage.receivedBytes,
      normalizedTextCharacters: visible.length,
      parserVersion: "visible-scholarly-text-v1",
      inspectionStatus: input.plan.input.inspectionMode,
      access: {
        basis: input.plan.input.accessBasis as Exclude<
          typeof input.plan.input.accessBasis,
          "not_confirmed"
        >,
        assertedBy: "researcher_ui",
        independentlyVerified: false,
        credentialForwarding: false,
      },
      fullTextRetained: false,
      passageIds: [passage.id],
    });
    usage.usefulDocuments = 1;
    finish();
    return createScholarlyDocumentAcquisition({
      schemaVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION,
      id: input.acquisitionId,
      ordinal: input.plan.ordinal,
      plan: input.plan,
      startedAt,
      completedAt,
      attemptedUrl: requestedUrl,
      outcome: input.plan.input.inspectionMode === "abstract_only"
        ? "abstract_passage_retained"
        : "passage_retained",
      failureCode: null,
      note: input.plan.input.inspectionMode === "abstract_only"
        ? "One exact abstract passage was retained with offsets; it remains ineligible for detailed claim support."
        : "One exact partial-text passage was retained with URL, version, content hashes, and offsets for later researcher review.",
      usage,
      document,
      passage,
      claimBoundary:
        "A retained passage records normalized visible text and exact offsets from one fetched representation. It is eligible only for later researcher review; it is not itself a theory claim, empirical conclusion, mechanism, prediction, measure recommendation, or causal estimate.",
    });
  } finally {
    clearTimeout(timer);
  }
}
