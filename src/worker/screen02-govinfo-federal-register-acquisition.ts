import type {
  PolicyReviewFailureCode,
  SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import { federalRegisterOwnDocumentNumbers } from
  "./federal-register-document-identity";
import {
  officialDocumentAccessChallenge,
  primaryOfficialDocumentHtml,
  visibleOfficialDocumentText,
} from "./official-document-html";
import type { Screen02ConnectorFetch } from "./screen02-connectors";

export const SIX_SCREEN_GOVINFO_FEDERAL_REGISTER_ADAPTER_VERSION =
  "govinfo-federal-register-exact-granule-v1" as const;
export const SIX_SCREEN_GOVINFO_SUMMARY_MAX_BYTES = 128 * 1024;
export const SIX_SCREEN_GOVINFO_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const SIX_SCREEN_GOVINFO_TIMEOUT_MS = 10_000;

export type GovInfoFederalRegisterRepresentation = {
  canonicalUrl: string;
  representation: "html";
  identityText: string;
  parsedText: string;
  contentHash: string;
};

export type Screen02GovInfoFederalRegisterAcquisitionResult = {
  status: "ready" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  attemptedSources: string[];
  limitation: string | null;
  representation: GovInfoFederalRegisterRepresentation | null;
  usage: ResearchTaskOperationUsage;
};

type Failure = {
  code: PolicyReviewFailureCode;
  status: "waiting_source" | "unsupported";
  limitation: string;
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

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function summaryUrl(publicationDate: string, documentNumber: string) {
  return `https://api.govinfo.gov/packages/FR-${publicationDate}/granules/${documentNumber}/summary`;
}

function exactDownloadUrl(
  value: unknown,
  publicationDate: string,
  documentNumber: string,
) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.hostname !== "api.govinfo.gov" ||
      url.username || url.password || url.port || url.search || url.hash
    ) return null;
    const expected =
      `/packages/FR-${publicationDate}/granules/${documentNumber}/htm`;
    return url.pathname === expected ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function boundedText(response: Response, maximumBytes: number) {
  if (!response.body) return { text: "", receivedBytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes = Math.min(
        maximumBytes + 1,
        receivedBytes + chunk.value.byteLength,
      );
      if (receivedBytes > maximumBytes) {
        await reader.cancel("GovInfo response byte limit reached")
          .catch(() => undefined);
        throw Object.assign(new Error("GovInfo response exceeded its byte limit."), {
          receivedBytes,
        });
      }
      fragments.push(decoder.decode(chunk.value, { stream: true }));
    }
    fragments.push(decoder.decode());
    return { text: fragments.join(""), receivedBytes };
  } finally {
    reader.releaseLock();
  }
}

async function fetchWithinTimeout(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  apiKey: string;
  accept: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`GovInfo exact-record request timed out after ${input.timeoutMs} ms.`));
    }, input.timeoutMs);
  });
  try {
    return await Promise.race([
      input.fetch(input.url, {
        method: "GET",
        headers: {
          accept: input.accept,
          "cache-control": "no-store",
          "user-agent": "ShockAudit six-screen GovInfo policy retrieval",
          "x-api-key": input.apiKey,
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

function responseFailure(response: Response, label: string): Failure | null {
  if (response.redirected || [301, 302, 303, 307, 308].includes(response.status)) {
    return {
      code: "source_unavailable",
      status: "waiting_source",
      limitation: `The GovInfo ${label} redirected instead of returning the exact requested record.`,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      code: "source_not_configured",
      status: "unsupported",
      limitation:
        "GovInfo rejected the configured server credential. No empty-result claim was recorded.",
    };
  }
  if (response.status === 429 || response.status >= 500) {
    return {
      code: "source_unavailable",
      status: "waiting_source",
      limitation: `The GovInfo ${label} returned HTTP ${response.status}.`,
    };
  }
  if (!response.ok) {
    return {
      code: "wrong_document",
      status: "unsupported",
      limitation: `GovInfo did not return the exact confirmed record (HTTP ${response.status}).`,
    };
  }
  return null;
}

function contentLengthFailure(response: Response, maximumBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maximumBytes;
}

function bytesFromError(error: unknown) {
  return typeof (error as { receivedBytes?: unknown })?.receivedBytes === "number"
    ? (error as { receivedBytes: number }).receivedBytes
    : 0;
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

function failedResult(input: {
  usage: ResearchTaskOperationUsage;
  documentNumber: string | null;
  attemptedSources: string[];
  failure: Failure;
  started: number;
  monotonicNow?: () => number;
}): Screen02GovInfoFederalRegisterAcquisitionResult {
  input.usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? input.started) - input.started),
  );
  return {
    status: input.failure.status,
    failureCode: input.failure.code,
    documentNumber: input.documentNumber,
    attemptedSources: input.attemptedSources,
    limitation: input.failure.limitation,
    representation: null,
    usage: input.usage,
  };
}

/**
 * Retrieve one exact Federal Register granule through GovInfo. The server key
 * travels only in the X-Api-Key header and is never retained in a locator,
 * result, task record, or evidence snapshot.
 */
export async function acquireScreen02GovInfoFederalRegisterRepresentation(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02GovInfoFederalRegisterAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const documentNumber = exactDocumentNumber(input.workflow);
  const publicationDate = exactPublicationDate(input.workflow);
  const attemptedSources: string[] = [];
  const fail = (failure: Failure) => failedResult({
    usage,
    documentNumber,
    attemptedSources,
    failure,
    started,
    monotonicNow: input.monotonicNow,
  });

  if (!input.workflow.confirmedShock || !documentNumber || !publicationDate) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "GovInfo exact-record retrieval requires one confirmed Federal Register document number and one day-precision publication date.",
    });
  }
  if (!validApiKey(input.apiKey)) {
    return fail({
      code: "source_not_configured",
      status: "unsupported",
      limitation:
        "GovInfo exact-record retrieval is unavailable because its server credential is not configured.",
    });
  }

  const timeoutMs = input.timeoutMs ?? SIX_SCREEN_GOVINFO_TIMEOUT_MS;
  const exactSummaryUrl = summaryUrl(publicationDate, documentNumber);
  attemptedSources.push(exactSummaryUrl);
  usage.documentAttempts += 1;
  usage.transportHops += 1;
  let summaryResponse: Response;
  try {
    summaryResponse = await fetchWithinTimeout({
      fetch: input.fetch,
      url: exactSummaryUrl,
      apiKey: input.apiKey!,
      accept: "application/json",
      timeoutMs,
    });
  } catch {
    return fail({
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        "The GovInfo exact-record summary request did not complete within the bounded transport.",
    });
  }
  const summaryFailure = responseFailure(summaryResponse, "granule summary");
  if (summaryFailure) {
    await summaryResponse.body?.cancel("GovInfo summary rejected").catch(() => undefined);
    return fail(summaryFailure);
  }
  if (contentLengthFailure(summaryResponse, SIX_SCREEN_GOVINFO_SUMMARY_MAX_BYTES)) {
    await summaryResponse.body?.cancel("GovInfo summary too large").catch(() => undefined);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The GovInfo granule summary exceeded the bounded response size.",
    });
  }
  const summaryMediaType = (summaryResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
  if (summaryMediaType !== "application/json") {
    await summaryResponse.body?.cancel("GovInfo summary format rejected")
      .catch(() => undefined);
    return fail({
      code: "unsupported_format",
      status: "unsupported",
      limitation: "The GovInfo granule summary was not declared as JSON.",
    });
  }
  let summaryBody: string;
  try {
    const bounded = await boundedText(
      summaryResponse,
      SIX_SCREEN_GOVINFO_SUMMARY_MAX_BYTES,
    );
    summaryBody = bounded.text;
    usage.receivedBytes += bounded.receivedBytes;
  } catch (error) {
    usage.receivedBytes += bytesFromError(error);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The GovInfo granule summary exceeded the bounded response size.",
    });
  }
  usage.decodedBytes += new TextEncoder().encode(summaryBody).byteLength;

  let summary: unknown;
  try {
    summary = JSON.parse(summaryBody);
  } catch {
    return fail({
      code: "unparsed",
      status: "unsupported",
      limitation: "The GovInfo granule summary was not valid JSON.",
    });
  }
  const packageId = `FR-${publicationDate}`;
  if (
    !isRecord(summary) || summary.collectionCode !== "FR" ||
    summary.packageId !== packageId || summary.granuleId !== documentNumber ||
    summary.dateIssued !== publicationDate || !isRecord(summary.download)
  ) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The GovInfo granule summary did not identify the exact confirmed Federal Register document and publication date.",
    });
  }
  const downloadUrl = exactDownloadUrl(
    summary.download.txtLink,
    publicationDate,
    documentNumber,
  );
  if (!downloadUrl) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The GovInfo summary did not supply a same-record bounded HTML representation.",
    });
  }
  usage.metadataRecords = 1;
  attemptedSources.push(downloadUrl);
  usage.documentAttempts += 1;
  usage.transportHops += 1;

  let documentResponse: Response;
  try {
    documentResponse = await fetchWithinTimeout({
      fetch: input.fetch,
      url: downloadUrl,
      apiKey: input.apiKey!,
      accept: "text/html",
      timeoutMs,
    });
  } catch {
    return fail({
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        "The GovInfo exact-record HTML request did not complete within the bounded transport.",
    });
  }
  const documentFailure = responseFailure(documentResponse, "HTML representation");
  if (documentFailure) {
    await documentResponse.body?.cancel("GovInfo document rejected")
      .catch(() => undefined);
    return fail(documentFailure);
  }
  if (contentLengthFailure(documentResponse, SIX_SCREEN_GOVINFO_DOCUMENT_MAX_BYTES)) {
    await documentResponse.body?.cancel("GovInfo document too large")
      .catch(() => undefined);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The GovInfo Federal Register representation exceeded the bounded response size.",
    });
  }
  const documentMediaType = (documentResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
  if (documentMediaType !== "text/html") {
    await documentResponse.body?.cancel("GovInfo document format rejected")
      .catch(() => undefined);
    return fail({
      code: "unsupported_format",
      status: "unsupported",
      limitation: "The GovInfo Federal Register representation was not declared as HTML.",
    });
  }
  let body: string;
  try {
    const bounded = await boundedText(
      documentResponse,
      SIX_SCREEN_GOVINFO_DOCUMENT_MAX_BYTES,
    );
    body = bounded.text;
    usage.receivedBytes += bounded.receivedBytes;
  } catch (error) {
    usage.receivedBytes += bytesFromError(error);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The GovInfo Federal Register representation exceeded the bounded response size.",
    });
  }
  if (officialDocumentAccessChallenge(body)) {
    return fail({
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        "GovInfo returned an access-control interstitial instead of the confirmed document.",
    });
  }
  const ownDocumentNumbers = federalRegisterOwnDocumentNumbers(body);
  if (
    ownDocumentNumbers.length !== 1 ||
    ownDocumentNumbers[0] !== documentNumber
  ) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The GovInfo representation did not identify itself as the exact confirmed Federal Register document.",
    });
  }
  const identityText = visibleOfficialDocumentText(body);
  const parsedText = visibleOfficialDocumentText(
    primaryOfficialDocumentHtml(body),
  );
  if (!parsedText) {
    return fail({
      code: "unparsed",
      status: "unsupported",
      limitation:
        "The exact GovInfo representation contained no usable visible policy text.",
    });
  }
  usage.usefulDocuments = 1;
  usage.decodedBytes += new TextEncoder().encode(parsedText).byteLength;
  usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  return {
    status: "ready",
    failureCode: null,
    documentNumber,
    attemptedSources,
    limitation: null,
    representation: {
      canonicalUrl: downloadUrl,
      representation: "html",
      identityText,
      parsedText,
      contentHash: await sha256(body),
    },
    usage,
  };
}
