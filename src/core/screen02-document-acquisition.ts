export const SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION =
  "screen-02-document-acquisition-v1" as const;

/** Persisted overflow sentinels for the 2 MiB item / 6 MiB shared envelope. */
export const SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES =
  2 * 1024 * 1024 + 1;
export const SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES =
  6 * 1024 * 1024 + 1;
/**
 * `latencyMs` spans semaphore wait plus every separately timeout-bounded
 * redirect request, so its sentinel follows the shared run deadline. It is
 * not evidence that an individual request exceeded the 3-second controller.
 */
export const SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS = 45_001;

export const screen02DocumentAcquisitionLevels = [
  "host-official",
  2,
  3,
  4,
] as const;

export type Screen02DocumentAcquisitionLevel =
  (typeof screen02DocumentAcquisitionLevels)[number];

export const screen02DocumentParserPaths = [
  "official-html-visible-text",
  "official-plain-text",
  "not-run",
] as const;

export type Screen02DocumentParserPath =
  (typeof screen02DocumentParserPaths)[number];

export const screen02DocumentParserOutcomes = [
  "parsed",
  "empty",
  "rejected",
  "not-run",
] as const;

export type Screen02DocumentParserOutcome =
  (typeof screen02DocumentParserOutcomes)[number];

export type Screen02DocumentRedirectHop = {
  status: 301 | 302 | 303 | 307 | 308;
  fromUrl: string;
  toUrl: string;
};

/**
 * Candidate-bound transport evidence for one bounded Screen 2 document.
 *
 * URLs are diagnostic projections: query strings, fragments, and credentials
 * are removed before this object can enter workflow state or model context.
 * The fetched request may still require an ordinary non-secret query string,
 * but that value is never copied into this record.
 */
export type Screen02DocumentAcquisition = {
  schemaVersion: typeof SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION;
  acquisitionId: string;
  candidateId: string;
  sourceId: string | null;
  level: Screen02DocumentAcquisitionLevel;
  requestedUrl: string;
  redirectChain: Screen02DocumentRedirectHop[];
  finalUrl: string | null;
  httpStatus: number | null;
  mediaType: "text/html" | "text/plain" | null;
  receivedBytes: number;
  latencyMs: number;
  parserPath: Screen02DocumentParserPath;
  parserOutcome: Screen02DocumentParserOutcome;
  outcome: "succeeded" | "failed";
  failureReason: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maximum && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Diagnostic URLs are deliberately less expressive than fetched URLs. */
export function isSanitizedScreen02AcquisitionUrl(value: unknown) {
  if (!boundedText(value, 2_048)) return false;
  try {
    const url = new URL(value as string);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash && !url.port &&
      url.hostname.length > 0 && !url.hostname.endsWith(".");
  } catch {
    return false;
  }
}

/**
 * Strips values that must never appear in persisted or model-visible
 * transport diagnostics. Invalid locators return null rather than echoing
 * untrusted input.
 */
export function sanitizeScreen02AcquisitionUrl(value: string) {
  if (!value || value.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || !url.hostname ||
      url.hostname.endsWith(".") || url.port
    ) return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    const sanitized = url.toString();
    return isSanitizedScreen02AcquisitionUrl(sanitized) ? sanitized : null;
  } catch {
    return null;
  }
}

/** Removes URLs and query-like secrets from bounded persisted error text. */
export function sanitizeScreen02AcquisitionFailureReason(value: string) {
  const withoutUrls = value.replace(
    /https:\/\/[^\s<>"']+/giu,
    (candidate) => sanitizeScreen02AcquisitionUrl(candidate) ?? "[redacted-url]",
  );
  return withoutUrls
    .replace(/([?&](?:access_?token|api_?key|auth|code|credential|key|password|secret|signature|sig|token)=)[^\s&#]*/giu, "$1[redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500)
    .trim() || "Document acquisition failed without a safe diagnostic.";
}

export function isScreen02DocumentAcquisition(
  value: unknown,
): value is Screen02DocumentAcquisition {
  if (!record(value) || !exactKeys(value, [
    "schemaVersion", "acquisitionId", "candidateId", "sourceId", "level",
    "requestedUrl", "redirectChain", "finalUrl", "httpStatus", "mediaType",
    "receivedBytes", "latencyMs", "parserPath", "parserOutcome", "outcome",
    "failureReason",
  ])) return false;
  if (
    value.schemaVersion !== SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION ||
    !boundedText(value.acquisitionId, 200) ||
    !boundedText(value.candidateId, 200) ||
    !(value.sourceId === null || boundedText(value.sourceId, 200)) ||
    !screen02DocumentAcquisitionLevels.includes(
      value.level as Screen02DocumentAcquisitionLevel,
    ) ||
    !isSanitizedScreen02AcquisitionUrl(value.requestedUrl) ||
    !(value.finalUrl === null ||
      isSanitizedScreen02AcquisitionUrl(value.finalUrl)) ||
    !(value.httpStatus === null ||
      (Number.isSafeInteger(value.httpStatus) &&
        (value.httpStatus as number) >= 100 &&
        (value.httpStatus as number) <= 599)) ||
    ![null, "text/html", "text/plain"].includes(
      value.mediaType as "text/html" | "text/plain" | null,
    ) ||
    !Number.isSafeInteger(value.receivedBytes) ||
    (value.receivedBytes as number) < 0 ||
    (value.receivedBytes as number) >
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES ||
    !Number.isSafeInteger(value.latencyMs) ||
    (value.latencyMs as number) < 0 ||
    (value.latencyMs as number) >
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS ||
    !screen02DocumentParserPaths.includes(
      value.parserPath as Screen02DocumentParserPath,
    ) ||
    !screen02DocumentParserOutcomes.includes(
      value.parserOutcome as Screen02DocumentParserOutcome,
    ) ||
    !["succeeded", "failed"].includes(value.outcome as string) ||
    !(value.failureReason === null || boundedText(value.failureReason, 500)) ||
    !Array.isArray(value.redirectChain) || value.redirectChain.length > 3
  ) return false;
  for (const hop of value.redirectChain) {
    if (!record(hop) || !exactKeys(hop, ["status", "fromUrl", "toUrl"]) ||
      ![301, 302, 303, 307, 308].includes(hop.status as number) ||
      !isSanitizedScreen02AcquisitionUrl(hop.fromUrl) ||
      !isSanitizedScreen02AcquisitionUrl(hop.toUrl)) return false;
  }
  if (value.outcome === "succeeded") {
    const httpStatus = value.httpStatus as number | null;
    return value.failureReason === null && value.finalUrl !== null &&
      httpStatus !== null && httpStatus >= 200 &&
      httpStatus < 300 && value.mediaType !== null &&
      value.parserPath !== "not-run" && value.parserOutcome === "parsed";
  }
  return boundedText(value.failureReason, 500) &&
    value.parserOutcome !== "parsed";
}
