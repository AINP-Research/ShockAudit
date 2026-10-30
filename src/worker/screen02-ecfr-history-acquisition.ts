import {
  SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
  type PolicyReviewFailureCode,
  type SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import {
  parseFederalRegisterHistoricalFallbackEvidence,
  parseEcfrHistoricalPolicyEvidence,
  selectEcfrHistoricalPolicyDelta,
  type EcfrContentVersionMetadata,
} from "../core/six-screen/policy-history";
import type { ParsedPolicyEvidence } from
  "../core/six-screen/policy-review";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import {
  acquireScreen02FederalRegisterContextAnchor,
  type Screen02FederalRegisterContextAnchor,
} from "./screen02-federal-register-acquisition";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { acquireScreen02GovInfoAnnualCfrBaseline } from
  "./screen02-govinfo-cfr-annual-acquisition";

export const SIX_SCREEN_ECFR_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES = 256 * 1024;
export const SIX_SCREEN_ECFR_VERSION_METADATA_MAX_RECORDS = 48;
export const SIX_SCREEN_ECFR_VERSION_LOOKAHEAD_DAYS = 7;
export const SIX_SCREEN_ECFR_DOCUMENT_TIMEOUT_MS = 10_000;
export const SIX_SCREEN_ECFR_HISTORY_ADAPTER_VERSION =
  "six-screen-ecfr-point-in-time-policy-v3" as const;

type EcfrAttempt =
  | {
      ok: true;
      url: string;
      xml: string;
      contentHash: string;
      receivedBytes: number;
      decodedBytes: number;
      transportHops: number;
    }
  | {
      ok: false;
      code: PolicyReviewFailureCode;
      limitation: string;
      receivedBytes: number;
      decodedBytes: number;
      transportHops: number;
    };

type EcfrVersionMetadataAttempt =
  | {
      ok: true;
      url: string;
      contentHash: string;
      jsonLength: number;
      records: EcfrContentVersionMetadata[];
      snapshotDate: string;
      metadataRecords: number;
      receivedBytes: number;
      decodedBytes: number;
      transportHops: number;
    }
  | {
      ok: false;
      code: PolicyReviewFailureCode;
      limitation: string;
      metadataRecords: number;
      receivedBytes: number;
      decodedBytes: number;
      transportHops: number;
    };

export type Screen02EcfrHistoricalAcquisitionResult = {
  protocolVersion: typeof SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION;
  focus: "historical_context";
  status: "ready" | "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  parsed: ParsedPolicyEvidence | null;
  usage: ResearchTaskOperationUsage;
};

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

function addUsage(
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
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${bytesToHex(digest)}`;
}

function exactLegalEffectDate(workflow: SixScreenWorkflowState) {
  const values = new Set(
    workflow.confirmedShock?.typedDates
      .filter(({ kind, precision, start, end }) =>
        kind === "legal_effect" && precision === "day" && end === null &&
        typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(start))
      .map(({ start }) => start!) ?? [],
  );
  if (values.size !== 1) return null;
  const date = [...values][0]!;
  const milliseconds = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) &&
      new Date(milliseconds).toISOString().slice(0, 10) === date
    ? date
    : null;
}

function exactDocumentNumber(workflow: SixScreenWorkflowState) {
  const values = new Set(
    workflow.confirmedShock?.formalIdentifiers.flatMap((value) =>
      value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []
    ) ?? [],
  );
  return values.size === 1 ? [...values][0]! : null;
}

function exactPublicationDate(workflow: SixScreenWorkflowState) {
  const values = new Set(
    workflow.confirmedShock?.typedDates
      .filter(({ kind, precision, start, end }) =>
        kind === "publication" && precision === "day" && end === null &&
        typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(start))
      .map(({ start }) => start!) ?? [],
  );
  return values.size === 1 ? [...values][0]! : null;
}

function contemporaneousFallback(input: {
  workflow: SixScreenWorkflowState;
  anchor: Screen02FederalRegisterContextAnchor;
  effectiveDate: string;
  retrievedAt: string;
  reason: "historical_date_unavailable" | "cfr_coordinates_unavailable";
}) {
  const confirmed = input.workflow.confirmedShock;
  if (
    !confirmed || !input.anchor.documentNumber || !input.anchor.canonicalUrl ||
    !input.anchor.contentHash || !input.anchor.representation ||
    !input.anchor.parsedText || !input.anchor.cfrCoordinates.length
  ) return null;
  return parseFederalRegisterHistoricalFallbackEvidence({
    eventId: confirmed.id,
    documentNumber: input.anchor.documentNumber,
    issuer: confirmed.issuer,
    publicationDate: exactPublicationDate(input.workflow),
    legalEffectDate: input.effectiveDate,
    retrievedAt: input.retrievedAt,
    canonicalUrl: input.anchor.canonicalUrl,
    contentHash: input.anchor.contentHash,
    representation: input.anchor.representation,
    parsedText: input.anchor.parsedText,
    cfrCoordinates: input.anchor.cfrCoordinates,
    reason: input.reason,
  });
}

function amendatorySectionIdentifiers(
  fallback: ParsedPolicyEvidence | null,
  part: string,
) {
  const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const sectionPattern = new RegExp(
    `\\b${escapedPart}\\.[0-9]+(?:[a-z0-9_-]*)\\b`,
    "giu",
  );
  return [
    ...new Set(
      fallback?.collection.passages.flatMap(({ exactText }) =>
        exactText.match(sectionPattern) ?? []
      ) ?? [],
    ),
  ].sort((left, right) => left.localeCompare(right, "en-US"));
}

function precedingDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function dateAfter(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function ecfrUrl(date: string, title: string, part: string) {
  const url = new URL(
    `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml`,
  );
  url.searchParams.set("part", part);
  return url.toString();
}

function ecfrVersionsUrl(input: {
  title: string;
  part: string;
  issueDateStart: string;
  issueDateEnd: string;
}) {
  const url = new URL(
    `https://www.ecfr.gov/api/versioner/v1/versions/title-${input.title}.json`,
  );
  url.searchParams.set("part", input.part);
  url.searchParams.set("issue_date[gte]", input.issueDateStart);
  url.searchParams.set("issue_date[lte]", input.issueDateEnd);
  return url.toString();
}

async function boundedXml(response: Response) {
  if (!response.body) return { xml: "", receivedBytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes = Math.min(
        SIX_SCREEN_ECFR_DOCUMENT_MAX_BYTES + 1,
        receivedBytes + chunk.value.byteLength,
      );
      if (receivedBytes > SIX_SCREEN_ECFR_DOCUMENT_MAX_BYTES) {
        await reader.cancel("eCFR response byte limit reached").catch(() => undefined);
        throw Object.assign(new Error("eCFR response exceeded the byte limit."), {
          receivedBytes,
        });
      }
      fragments.push(decoder.decode(chunk.value, { stream: true }));
    }
    fragments.push(decoder.decode());
    return { xml: fragments.join(""), receivedBytes };
  } finally {
    reader.releaseLock();
  }
}

async function boundedJson(response: Response) {
  if (!response.body) return { json: "", receivedBytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes = Math.min(
        SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES + 1,
        receivedBytes + chunk.value.byteLength,
      );
      if (receivedBytes > SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES) {
        await reader.cancel("eCFR version metadata byte limit reached")
          .catch(() => undefined);
        throw Object.assign(
          new Error("eCFR version metadata exceeded the byte limit."),
          { receivedBytes },
        );
      }
      fragments.push(decoder.decode(chunk.value, { stream: true }));
    }
    fragments.push(decoder.decode());
    return { json: fragments.join(""), receivedBytes };
  } finally {
    reader.releaseLock();
  }
}

async function fetchWithinTimeout(
  fetchImpl: Screen02ConnectorFetch,
  url: string,
  timeoutMs: number,
  accept = "application/xml, text/xml;q=0.9",
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`eCFR request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetchImpl(url, {
        method: "GET",
        headers: {
          accept,
          "cache-control": "no-store",
          "user-agent": "ShockAudit six-screen historical policy retrieval",
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().slice(0, 10) === value;
}

type ParsedEcfrContentVersion = Omit<
  EcfrContentVersionMetadata,
  "type" | "substantive"
> & {
  type: "section" | "appendix";
  substantive: boolean;
};

function metadataRecord(input: unknown): ParsedEcfrContentVersion | null {
  if (
    !isRecord(input) ||
    (input.type !== "section" && input.type !== "appendix") ||
    typeof input.substantive !== "boolean" ||
    typeof input.title !== "string" || typeof input.part !== "string" ||
    !isExactDate(input.date) || !isExactDate(input.amendment_date) ||
    !isExactDate(input.issue_date) || typeof input.identifier !== "string" ||
    !input.identifier.trim() || typeof input.name !== "string" ||
    (input.subpart !== null && typeof input.subpart !== "string") ||
    typeof input.removed !== "boolean"
  ) return null;
  return {
    date: input.date,
    amendmentDate: input.amendment_date,
    issueDate: input.issue_date,
    identifier: input.identifier,
    name: input.name,
    part: input.part,
    subpart: input.subpart,
    title: input.title,
    type: input.type,
    substantive: input.substantive,
    removed: input.removed,
  };
}

async function fetchEcfrVersionMetadata(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  title: string;
  part: string;
  legalEffectDate: string;
  issueDateStart: string;
  issueDateEnd: string;
  expectedSectionIdentifiers: readonly string[];
  timeoutMs: number;
}): Promise<EcfrVersionMetadataAttempt> {
  let receivedBytes = 0;
  let decodedBytes = 0;
  let metadataRecords = 0;
  const failure = (
    code: PolicyReviewFailureCode,
    limitation: string,
  ): EcfrVersionMetadataAttempt => ({
    ok: false,
    code,
    limitation,
    metadataRecords,
    receivedBytes,
    decodedBytes,
    transportHops: 1,
  });
  try {
    const response = await fetchWithinTimeout(
      input.fetch,
      input.url,
      input.timeoutMs,
      "application/json",
    );
    if (response.redirected || [301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel("eCFR version metadata redirects are not accepted")
        .catch(() => undefined);
      return failure(
        "source_unavailable",
        "The eCFR content-version endpoint redirected instead of returning the exact requested metadata window.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel("Non-success eCFR version metadata response")
        .catch(() => undefined);
      if (response.status === 404) {
        return failure(
          "historical_date_unavailable",
          "The eCFR content-version endpoint reported no usable historical metadata (HTTP 404).",
        );
      }
      if (response.status === 400) {
        return failure(
          "unparsed",
          "The eCFR content-version endpoint rejected the bounded query as invalid (HTTP 400).",
        );
      }
      return failure(
        "source_unavailable",
        `The eCFR content-version endpoint returned HTTP ${response.status}.`,
      );
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES
    ) {
      await response.body?.cancel("Declared eCFR version metadata too large")
        .catch(() => undefined);
      return failure(
        "response_limit",
        "The eCFR content-version metadata exceeded the bounded response size.",
      );
    }
    const mediaType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
    if (mediaType !== "application/json") {
      await response.body?.cancel("Unsupported eCFR version metadata media type")
        .catch(() => undefined);
      return failure(
        "unsupported_format",
        "The eCFR content-version response was not declared as JSON.",
      );
    }
    let body: string;
    try {
      const bounded = await boundedJson(response);
      body = bounded.json;
      receivedBytes = bounded.receivedBytes;
    } catch (error) {
      receivedBytes = typeof (error as { receivedBytes?: unknown }).receivedBytes ===
          "number"
        ? (error as { receivedBytes: number }).receivedBytes
        : 0;
      return failure(
        "response_limit",
        "The eCFR content-version metadata exceeded the bounded response size.",
      );
    }
    decodedBytes = new TextEncoder().encode(body).byteLength;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return failure(
        "unparsed",
        "The eCFR content-version response was not valid JSON.",
      );
    }
    if (
      !isRecord(parsed) || !Array.isArray(parsed.content_versions) ||
      !isRecord(parsed.meta) || parsed.meta.title !== input.title ||
      !isRecord(parsed.meta.issue_date) ||
      parsed.meta.issue_date.gte !== input.issueDateStart ||
      parsed.meta.issue_date.lte !== input.issueDateEnd
    ) {
      return failure(
        "wrong_document",
        "The eCFR content-version metadata did not identify the exact title, part, and requested issue-date window.",
      );
    }
    const declaredCount = Number(parsed.meta.result_count);
    if (
      !Number.isSafeInteger(declaredCount) || declaredCount < 0 ||
      declaredCount !== parsed.content_versions.length
    ) {
      return failure(
        "unparsed",
        "The eCFR content-version response reported an inconsistent result count.",
      );
    }
    metadataRecords = Math.min(
      declaredCount,
      SIX_SCREEN_ECFR_VERSION_METADATA_MAX_RECORDS,
    );
    if (declaredCount > SIX_SCREEN_ECFR_VERSION_METADATA_MAX_RECORDS) {
      return failure(
        "response_limit",
        "The eCFR content-version result exceeded the bounded metadata-record limit.",
      );
    }
    const expectedIdentifiers = new Set(input.expectedSectionIdentifiers);
    const relevant: EcfrContentVersionMetadata[] = [];
    let sameDateOtherSection = false;
    for (const value of parsed.content_versions) {
      if (
        !isRecord(value) || value.title !== input.title ||
        value.part !== input.part
      ) {
        return failure(
          "wrong_document",
          "The eCFR content-version result contained a record outside the exact requested CFR coordinate.",
        );
      }
      const record = metadataRecord(value);
      if (!record) {
        return failure(
          "unparsed",
          "The eCFR content-version result contained a malformed metadata record.",
        );
      }
      if (record.date !== record.amendmentDate) {
        return failure(
          "unparsed",
          "The eCFR content-version result violated the documented date-to-amendment-date identity.",
        );
      }
      if (
        record.type === "section" && record.substantive &&
        record.amendmentDate === input.legalEffectDate
      ) {
        if (expectedIdentifiers.has(record.identifier)) {
          relevant.push({ ...record, type: "section", substantive: true });
        } else {
          sameDateOtherSection = true;
        }
      }
    }
    if (!relevant.length) {
      return failure(
        sameDateOtherSection ? "wrong_document" : "historical_date_unavailable",
        sameDateOtherSection
          ? "The eCFR content-version metadata identified a different section than the exact contemporaneous amendatory instruction."
          : `The bounded eCFR version window did not identify a substantive section amendment dated ${input.legalEffectDate} for ${input.title} CFR Part ${input.part}.`,
      );
    }
    relevant.sort((left, right) =>
      left.identifier.localeCompare(right.identifier, "en-US") ||
      left.issueDate.localeCompare(right.issueDate, "en-US")
    );
    return {
      ok: true,
      url: input.url,
      contentHash: await sha256(body),
      jsonLength: body.length,
      records: relevant,
      snapshotDate: input.legalEffectDate,
      metadataRecords,
      receivedBytes,
      decodedBytes,
      transportHops: 1,
    };
  } catch (error) {
    return failure(
      "source_unavailable",
      error instanceof Error
        ? error.message.slice(0, 500)
        : "The eCFR content-version request failed.",
    );
  }
}

function responseMatchesCoordinate(xml: string, title: string, part: string) {
  const decodedMetadata = xml.replaceAll("&amp;quot;", "\"");
  return decodedMetadata.includes(`/title-${title}/part-${part}`) &&
    decodedMetadata.includes(`${title} CFR Part ${part}`) &&
    new RegExp(
      `<DIV5\\b(?=[^>]*\\bN=["']${part}["'])(?=[^>]*\\bTYPE=["']PART["'])[^>]*>`,
      "iu",
    ).test(xml);
}

async function fetchEcfrVersion(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  title: string;
  part: string;
  timeoutMs: number;
}): Promise<EcfrAttempt> {
  let receivedBytes = 0;
  try {
    const response = await fetchWithinTimeout(
      input.fetch,
      input.url,
      input.timeoutMs,
    );
    if (response.redirected || [301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel("eCFR redirects are not accepted").catch(() => undefined);
      return {
        ok: false,
        code: "source_unavailable",
        limitation: "The eCFR point-in-time endpoint redirected instead of returning the exact requested coordinate.",
        receivedBytes,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    if (!response.ok) {
      await response.body?.cancel("Non-success eCFR response").catch(() => undefined);
      const historicalDateFailure = response.status === 400 || response.status === 404;
      return {
        ok: false,
        code: historicalDateFailure
          ? "historical_date_unavailable"
          : "source_unavailable",
        limitation: historicalDateFailure
          ? `The eCFR endpoint reported no matching point-in-time content (HTTP ${response.status}).`
          : `The eCFR point-in-time endpoint returned HTTP ${response.status}.`,
        receivedBytes,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > SIX_SCREEN_ECFR_DOCUMENT_MAX_BYTES
    ) {
      await response.body?.cancel("Declared eCFR response too large").catch(() => undefined);
      return {
        ok: false,
        code: "response_limit",
        limitation: "The eCFR point-in-time response exceeded the bounded response size.",
        receivedBytes,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    const mediaType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
    if (mediaType !== "application/xml" && mediaType !== "text/xml") {
      await response.body?.cancel("Unsupported eCFR media type").catch(() => undefined);
      return {
        ok: false,
        code: "unsupported_format",
        limitation: "The eCFR point-in-time response was not declared as XML.",
        receivedBytes,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    let bounded: { xml: string; receivedBytes: number };
    try {
      bounded = await boundedXml(response);
    } catch (error) {
      const counted = typeof (error as { receivedBytes?: unknown }).receivedBytes === "number"
        ? (error as { receivedBytes: number }).receivedBytes
        : 0;
      return {
        ok: false,
        code: "response_limit",
        limitation: "The eCFR point-in-time response exceeded the bounded response size.",
        receivedBytes: counted,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    receivedBytes = bounded.receivedBytes;
    if (!responseMatchesCoordinate(bounded.xml, input.title, input.part)) {
      return {
        ok: false,
        code: "wrong_document",
        limitation: "The returned eCFR XML did not identify the exact requested title and part.",
        receivedBytes,
        decodedBytes: 0,
        transportHops: 1,
      };
    }
    const decodedBytes = new TextEncoder().encode(bounded.xml).byteLength;
    return {
      ok: true,
      url: input.url,
      xml: bounded.xml,
      contentHash: await sha256(bounded.xml),
      receivedBytes,
      decodedBytes,
      transportHops: 1,
    };
  } catch (error) {
    return {
      ok: false,
      code: "source_unavailable",
      limitation: error instanceof Error
        ? error.message.slice(0, 500)
        : "The eCFR point-in-time request failed.",
      receivedBytes,
      decodedBytes: 0,
      transportHops: 1,
    };
  }
}

function failureStatus(code: PolicyReviewFailureCode) {
  return code === "source_unavailable" || code === "response_limit"
    ? "waiting_source" as const
    : "unsupported" as const;
}

export async function acquireScreen02EcfrHistoricalPolicy(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  govInfoApiKey?: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02EcfrHistoricalAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const documentNumber = exactDocumentNumber(input.workflow);
  const effectiveDate = exactLegalEffectDate(input.workflow);
  if (!input.workflow.confirmedShock || !documentNumber || !effectiveDate) {
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: "unsupported",
      failureCode: "historical_date_unavailable",
      documentNumber,
      attemptedSources: [],
      unresolved: ["previous_baseline", "version"],
      limitation:
        "The confirmed identity does not contain one day-precision legal-effective date for a bounded point-in-time comparison.",
      parsed: null,
      usage,
    };
  }
  const anchor = await acquireScreen02FederalRegisterContextAnchor({
    workflow: input.workflow,
    fetch: input.fetch,
    ...(input.govInfoApiKey !== undefined
      ? { govInfoApiKey: input.govInfoApiKey }
      : {}),
    monotonicNow: input.monotonicNow,
    timeoutMs: input.timeoutMs,
  });
  addUsage(usage, anchor.usage);
  if (
    anchor.status !== "ready" || !anchor.documentNumber ||
    !anchor.cfrCoordinate
  ) {
    const parsed = anchor.failureCode === "cfr_coordinates_unavailable" &&
        anchor.cfrCoordinates.length > 1
      ? contemporaneousFallback({
          workflow: input.workflow,
          anchor,
          effectiveDate,
          retrievedAt: input.retrievedAt,
          reason: "cfr_coordinates_unavailable",
        })
      : null;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: parsed ? "partial" : anchor.status,
      failureCode: parsed ? null : anchor.failureCode,
      documentNumber: anchor.documentNumber,
      attemptedSources: anchor.attemptedSources,
      unresolved: ["previous_baseline", "version"],
      limitation: parsed
        ? `${anchor.limitation ?? "The Federal Register rule names multiple CFR parts."} An exact contemporaneous amendatory instruction was saved, but it does not establish either codified historical version or an official CFR legal edition; no current CFR text was substituted.`
        : anchor.limitation,
      parsed,
      usage,
    };
  }
  const baselineDate = precedingDate(effectiveDate);
  const amendmentAnchor = contemporaneousFallback({
    workflow: input.workflow,
    anchor,
    effectiveDate,
    retrievedAt: input.retrievedAt,
    reason: "historical_date_unavailable",
  });
  const expectedSectionIdentifiers = amendatorySectionIdentifiers(
    amendmentAnchor,
    anchor.cfrCoordinate.part,
  );
  if (!expectedSectionIdentifiers.length) {
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: amendmentAnchor ? "partial" : "unsupported",
      failureCode: amendmentAnchor ? null : "unparsed",
      documentNumber: anchor.documentNumber,
      attemptedSources: anchor.attemptedSources,
      unresolved: ["previous_baseline", "version"],
      limitation: amendmentAnchor
        ? "An exact contemporaneous Federal Register amendatory instruction was saved, but it did not expose a section identifier that could be bound to eCFR content-version metadata. The codified versions remain inaccessible and current text was not substituted."
        : "The exact Federal Register representation did not expose a bounded amendatory section identifier for the historical eCFR comparison.",
      parsed: amendmentAnchor,
      usage,
    };
  }
  const issueDateEnd = dateAfter(
    effectiveDate,
    SIX_SCREEN_ECFR_VERSION_LOOKAHEAD_DAYS,
  );
  const versionMetadataUrl = ecfrVersionsUrl({
    title: anchor.cfrCoordinate.title,
    part: anchor.cfrCoordinate.part,
    issueDateStart: baselineDate,
    issueDateEnd,
  });
  const attemptedSources = [
    ...anchor.attemptedSources,
    versionMetadataUrl,
  ];
  const versionMetadata = await fetchEcfrVersionMetadata({
    fetch: input.fetch,
    url: versionMetadataUrl,
    title: anchor.cfrCoordinate.title,
    part: anchor.cfrCoordinate.part,
    legalEffectDate: effectiveDate,
    issueDateStart: baselineDate,
    issueDateEnd,
    expectedSectionIdentifiers,
    timeoutMs: input.timeoutMs ?? SIX_SCREEN_ECFR_DOCUMENT_TIMEOUT_MS,
  });
  usage.documentAttempts += 1;
  usage.transportHops += versionMetadata.transportHops;
  usage.metadataRecords += versionMetadata.metadataRecords;
  usage.receivedBytes += versionMetadata.receivedBytes;
  usage.decodedBytes += versionMetadata.decodedBytes;
  if (!versionMetadata.ok) {
    const parsed = versionMetadata.code === "historical_date_unavailable"
      ? contemporaneousFallback({
          workflow: input.workflow,
          anchor,
          effectiveDate,
          retrievedAt: input.retrievedAt,
          reason: "historical_date_unavailable",
        })
      : null;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: parsed ? "partial" : failureStatus(versionMetadata.code),
      failureCode: parsed ? null : versionMetadata.code,
      documentNumber: anchor.documentNumber,
      attemptedSources,
      unresolved: ["previous_baseline", "version"],
      limitation: parsed
        ? `${versionMetadata.limitation} An exact contemporaneous Federal Register amendatory instruction was saved, while the codified versions remain inaccessible; no current CFR text was substituted.`
        : `${versionMetadata.limitation} The exact contemporaneous Federal Register record remains retained as fallback context; no current CFR text was substituted.`,
      parsed,
      usage,
    };
  }
  usage.usefulDocuments += 1;
  const baselineUrl = ecfrUrl(
    baselineDate,
    anchor.cfrCoordinate.title,
    anchor.cfrCoordinate.part,
  );
  const effectiveUrl = ecfrUrl(
    versionMetadata.snapshotDate,
    anchor.cfrCoordinate.title,
    anchor.cfrCoordinate.part,
  );
  attemptedSources.push(baselineUrl);
  const baseline = await fetchEcfrVersion({
    fetch: input.fetch,
    url: baselineUrl,
    title: anchor.cfrCoordinate.title,
    part: anchor.cfrCoordinate.part,
    timeoutMs: input.timeoutMs ?? SIX_SCREEN_ECFR_DOCUMENT_TIMEOUT_MS,
  });
  usage.documentAttempts += 1;
  usage.transportHops += baseline.transportHops;
  usage.receivedBytes += baseline.receivedBytes;
  usage.decodedBytes += baseline.decodedBytes;
  if (!baseline.ok) {
    const parsed = baseline.code === "historical_date_unavailable"
      ? contemporaneousFallback({
          workflow: input.workflow,
          anchor,
          effectiveDate,
          retrievedAt: input.retrievedAt,
          reason: "historical_date_unavailable",
        })
      : null;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: parsed ? "partial" : failureStatus(baseline.code),
      failureCode: parsed ? null : baseline.code,
      documentNumber: anchor.documentNumber,
      attemptedSources,
      unresolved: ["previous_baseline", "version"],
      limitation: parsed
        ? `${baseline.limitation} An exact contemporaneous Federal Register amendatory instruction was saved, while the pre-effective and effective-date codified versions remain inaccessible; no current CFR text was substituted.`
        : `${baseline.limitation} The exact contemporaneous Federal Register record remains retained as fallback context; no current CFR text was substituted.`,
      parsed,
      usage,
    };
  }
  usage.usefulDocuments += 1;
  attemptedSources.push(effectiveUrl);
  const effective = await fetchEcfrVersion({
    fetch: input.fetch,
    url: effectiveUrl,
    title: anchor.cfrCoordinate.title,
    part: anchor.cfrCoordinate.part,
    timeoutMs: input.timeoutMs ?? SIX_SCREEN_ECFR_DOCUMENT_TIMEOUT_MS,
  });
  usage.documentAttempts += 1;
  usage.transportHops += effective.transportHops;
  usage.receivedBytes += effective.receivedBytes;
  usage.decodedBytes += effective.decodedBytes;
  if (!effective.ok) {
    const parsed = effective.code === "historical_date_unavailable"
      ? contemporaneousFallback({
          workflow: input.workflow,
          anchor,
          effectiveDate,
          retrievedAt: input.retrievedAt,
          reason: "historical_date_unavailable",
        })
      : null;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus: "historical_context",
      status: parsed ? "partial" : failureStatus(effective.code),
      failureCode: parsed ? null : effective.code,
      documentNumber: anchor.documentNumber,
      attemptedSources,
      unresolved: ["previous_baseline", "version"],
      limitation: parsed
        ? `${effective.limitation} An exact contemporaneous Federal Register amendatory instruction was saved, while the complete effective-date comparison remains inaccessible; no current CFR text was substituted.`
        : `${effective.limitation} The exact contemporaneous Federal Register record remains retained as fallback context; no current CFR text was substituted.`,
      parsed,
      usage,
    };
  }
  usage.usefulDocuments += 1;
  const historicalEvidenceInput = {
    eventId: input.workflow.confirmedShock.id,
    documentNumber: anchor.documentNumber,
    policyTitle: input.workflow.confirmedShock.officialTitle,
    issuer: input.workflow.confirmedShock.issuer,
    retrievedAt: input.retrievedAt,
    cfrTitle: anchor.cfrCoordinate.title,
    cfrPart: anchor.cfrCoordinate.part,
    baselineDate,
    legalEffectDate: effectiveDate,
    effectiveSnapshotDate: versionMetadata.snapshotDate,
    baselineUrl,
    effectiveUrl,
    versionMetadataUrl,
    versionMetadataContentHash: versionMetadata.contentHash,
    versionMetadataJsonLength: versionMetadata.jsonLength,
    versionRecords: versionMetadata.records,
    baselineContentHash: baseline.contentHash,
    effectiveContentHash: effective.contentHash,
    baselineXml: baseline.xml,
    effectiveXml: effective.xml,
  };
  const delta = selectEcfrHistoricalPolicyDelta(historicalEvidenceInput);
  let annualBaseline = undefined;
  let annualLimitation: string | null = null;
  if (delta) {
    const annual = await acquireScreen02GovInfoAnnualCfrBaseline({
      fetch: input.fetch,
      ...(input.govInfoApiKey !== undefined
        ? { apiKey: input.govInfoApiKey }
        : {}),
      cfrTitle: anchor.cfrCoordinate.title,
      cfrPart: anchor.cfrCoordinate.part,
      section: delta.section,
      legalEffectDate: effectiveDate,
      expectedBoundaryText: delta.baseline.text,
      monotonicNow: input.monotonicNow,
      timeoutMs: input.timeoutMs ?? SIX_SCREEN_ECFR_DOCUMENT_TIMEOUT_MS,
    });
    addUsage(usage, annual.usage);
    attemptedSources.push(...annual.attemptedSources);
    if (annual.baseline) {
      annualBaseline = annual.baseline;
    } else {
      annualLimitation =
        `${annual.limitation ?? "The official annual CFR section could not be bound."} The metadata-bound eCFR comparison remains retained, and no annual-CFR result was added.`;
    }
  }
  const parsed = parseEcfrHistoricalPolicyEvidence({
    ...historicalEvidenceInput,
    ...(annualBaseline ? { annualBaseline } : {}),
  });
  usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  const metadataIssueDates = [
    ...new Set(versionMetadata.records.map(({ issueDate }) => issueDate)),
  ].sort();
  const issueDateLimitation = metadataIssueDates.every((date) =>
      date === effectiveDate
    )
    ? null
    : `Official eCFR content-version metadata binds the ${effectiveDate} substantive amendment to eCFR issue date${metadataIssueDates.length === 1 ? "" : "s"} ${metadataIssueDates.join(", ")}. The point-in-time text was requested at the legal-effective amendment date, and current text was not substituted.`;
  return {
    protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
    focus: "historical_context",
    status: parsed.status,
    failureCode: null,
    documentNumber: anchor.documentNumber,
    attemptedSources,
    unresolved: parsed.unresolved,
    limitation: parsed.status === "partial"
      ? `The ${baselineDate} pre-effective snapshot, ${versionMetadata.snapshotDate} resolved eCFR snapshot, and exact content-version metadata were inspected, but no policy-title-bound paragraph change in the metadata-bound sections was retained. Current text was not substituted.`
      : [issueDateLimitation, annualLimitation].filter(Boolean).join(" ") || null,
    parsed,
    usage,
  };
}
