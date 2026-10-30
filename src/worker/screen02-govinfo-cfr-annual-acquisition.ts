import type { PolicyReviewFailureCode } from
  "../core/six-screen/contracts";
import type { GovInfoAnnualCfrBaselineEvidence } from
  "../core/six-screen/policy-history";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import type { Screen02ConnectorFetch } from "./screen02-connectors";

export const SIX_SCREEN_GOVINFO_ANNUAL_CFR_ADAPTER_VERSION =
  "govinfo-annual-cfr-exact-section-v1" as const;
export const SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES = 128 * 1024;
export const SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES = 512 * 1024;
export const SIX_SCREEN_GOVINFO_ANNUAL_CFR_TIMEOUT_MS = 10_000;
export const SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL =
  "https://api.govinfo.gov/search" as const;

export type Screen02GovInfoAnnualCfrAcquisitionResult = {
  status: "ready" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  attemptedSources: string[];
  limitation: string | null;
  baseline: GovInfoAnnualCfrBaselineEvidence | null;
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

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function exactDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().slice(0, 10) === value;
}

/** Return the latest annual CFR revision date strictly before legal effect. */
export function annualCfrRevisionDate(
  title: string,
  legalEffectDate: string,
) {
  if (!/^\d{1,2}$/u.test(title) || !exactDate(legalEffectDate)) return null;
  const titleNumber = Number(title);
  if (
    titleNumber < 1 || titleNumber > 50 || String(titleNumber) !== title
  ) return null;
  const monthDay = titleNumber <= 16
    ? "01-01"
    : titleNumber <= 27
      ? "04-01"
      : titleNumber <= 41
        ? "07-01"
        : "10-01";
  const effectYear = Number(legalEffectDate.slice(0, 4));
  const sameYearRevision = `${effectYear}-${monthDay}`;
  const editionYear = legalEffectDate > sameYearRevision
    ? effectYear
    : effectYear - 1;
  return editionYear >= 1997 ? `${editionYear}-${monthDay}` : null;
}

function validCoordinate(title: string, part: string, section: string) {
  if (!/^\d{1,2}$/u.test(title) || !/^\d{1,4}$/u.test(part)) return false;
  if (
    Number(title) < 1 || Number(title) > 50 || Number(part) < 1 ||
    String(Number(title)) !== title || String(Number(part)) !== part
  ) return false;
  return new RegExp(`^${part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.[0-9]+[a-z0-9-]*$`, "iu")
    .test(section);
}

function searchQuery(input: {
  title: string;
  part: string;
  section: string;
  annualEditionDate: string;
}) {
  return [
    "collection:(CFR)",
    `cfrtitlenum:${input.title}`,
    `cfrpartnum:${input.part}`,
    `cfrsectionnum:${input.section}`,
    `publishdate:${input.annualEditionDate}`,
  ].join(" ");
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
        await reader.cancel("GovInfo annual CFR response byte limit reached")
          .catch(() => undefined);
        throw Object.assign(
          new Error("GovInfo annual CFR response exceeded its byte limit."),
          { receivedBytes },
        );
      }
      fragments.push(decoder.decode(chunk.value, { stream: true }));
    }
    fragments.push(decoder.decode());
    return { text: fragments.join(""), receivedBytes };
  } finally {
    reader.releaseLock();
  }
}

function bytesFromError(error: unknown) {
  return typeof (error as { receivedBytes?: unknown })?.receivedBytes === "number"
    ? (error as { receivedBytes: number }).receivedBytes
    : 0;
}

function contentLengthFailure(response: Response, maximumBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maximumBytes;
}

function responseFailure(response: Response, label: string): Failure | null {
  if (response.redirected || [301, 302, 303, 307, 308].includes(response.status)) {
    return {
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        `The GovInfo ${label} redirected instead of returning the exact requested record.`,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      code: "source_not_configured",
      status: "unsupported",
      limitation:
        "GovInfo rejected the configured server credential. No annual-CFR result was retained.",
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
      limitation:
        `GovInfo did not return the exact annual CFR section (HTTP ${response.status}).`,
    };
  }
  return null;
}

async function fetchWithinTimeout(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  apiKey: string;
  method: "GET" | "POST";
  accept: string;
  timeoutMs: number;
  body?: string;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(
        `GovInfo annual CFR request timed out after ${input.timeoutMs} ms.`,
      ));
    }, input.timeoutMs);
  });
  try {
    return await Promise.race([
      input.fetch(input.url, {
        method: input.method,
        headers: {
          accept: input.accept,
          ...(input.body ? { "content-type": "application/json" } : {}),
          "cache-control": "no-store",
          "user-agent": "ShockAudit six-screen annual CFR retrieval",
          "x-api-key": input.apiKey,
        },
        ...(input.body ? { body: input.body } : {}),
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

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${bytesToHex(digest)}`;
}

function exactApiUrl(value: unknown, expectedPath: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.hostname !== "api.govinfo.gov" ||
      url.username || url.password || url.port || url.search || url.hash ||
      url.pathname !== expectedPath
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodedCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);
  if (
    !Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) return " ";
  return String.fromCodePoint(codePoint);
}

function visibleXmlText(value: string) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x([0-9a-f]+);/giu, (_match, digits: string) =>
      decodedCodePoint(digits, 16))
    .replace(/&#([0-9]+);/gu, (_match, digits: string) =>
      decodedCodePoint(digits, 10))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function exactTagText(xml: string, tag: string) {
  const matches = [...xml.matchAll(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "giu"),
  )];
  return matches.length === 1 ? visibleXmlText(matches[0]![1] ?? "") : null;
}

function tagTexts(xml: string, tag: string) {
  return [...xml.matchAll(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "giu"),
  )].map((match) => visibleXmlText(match[1] ?? ""));
}

function attribute(attributes: string, name: string) {
  return new RegExp(`\\b${name}=["']([^"']+)["']`, "iu")
    .exec(attributes)?.[1] ?? null;
}

function hasPartAncestor(xml: string, part: string) {
  const ancestorBlocks = [...xml.matchAll(
    /<ANCESTORS(?:\s[^>]*)?>([\s\S]*?)<\/ANCESTORS>/giu,
  )];
  if (ancestorBlocks.length !== 1) return false;
  const ancestors = ancestorBlocks[0]![1] ?? "";
  const structuredAncestor =
    [...ancestors.matchAll(/<ANCESTOR\b([^>]*)\/?\s*>/giu)]
      .some((match) => {
        const attributes = match[1] ?? "";
        return attribute(attributes, "LEVEL")
            ?.toLocaleLowerCase("en-US") === "part" &&
          attribute(attributes, "IDENTIFIER") === part;
      });
  if (structuredAncestor) return true;
  return [...ancestors.matchAll(/<PARENT\b([^>]*)>/giu)].some((match) =>
    attribute(match[1] ?? "", "HEADING")
      ?.toLocaleUpperCase("en-US").replace(/\s+/gu, " ").trim() ===
      `PART ${part}`
  );
}

function normalizedSectionLabel(value: string | null) {
  return value?.replace(/^\s*(?:\u00c2)?\u00a7{1,2}\s*/u, "")
    .replace(/\s+/gu, "") ?? null;
}

function annualXmlMatches(input: {
  xml: string;
  title: string;
  part: string;
  section: string;
  annualEditionDate: string;
  expectedBoundaryText: string;
}) {
  if (!/^\s*(?:<\?xml[\s\S]*?\?>\s*)?<CFRGRANULE\b/iu.test(input.xml)) {
    return false;
  }
  const sections = [...input.xml.matchAll(
    /<SECTION(?:\s[^>]*)?>([\s\S]*?)<\/SECTION>/giu,
  )];
  const sectionLabels = sections.length === 1
    ? tagTexts(sections[0]![0], "SECTNO").map(normalizedSectionLabel)
    : [];
  if (
    sections.length !== 1 || exactTagText(input.xml, "CFRTITLE") !== input.title ||
    exactTagText(input.xml, "DATE") !== input.annualEditionDate ||
    normalizedSectionLabel(exactTagText(input.xml, "GRANULENUM")) !== input.section ||
    sectionLabels.length < 1 || sectionLabels.some((value) =>
      value !== input.section) || !hasPartAncestor(input.xml, input.part)
  ) return false;
  return [...sections[0]![1]!.matchAll(/<P(?:\s[^>]*)?>([\s\S]*?)<\/P>/giu)]
    .some((match) => visibleXmlText(match[1] ?? "") === input.expectedBoundaryText);
}

function failedResult(input: {
  usage: ResearchTaskOperationUsage;
  attemptedSources: string[];
  failure: Failure;
  started: number;
  monotonicNow?: () => number;
}): Screen02GovInfoAnnualCfrAcquisitionResult {
  input.usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? input.started) - input.started),
  );
  return {
    status: input.failure.status,
    failureCode: input.failure.code,
    attemptedSources: input.attemptedSources,
    limitation: input.failure.limitation,
    baseline: null,
    usage: input.usage,
  };
}

/** Retrieve one exact historical annual-CFR section after eCFR selects it. */
export async function acquireScreen02GovInfoAnnualCfrBaseline(input: {
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  cfrTitle: string;
  cfrPart: string;
  section: string;
  legalEffectDate: string;
  expectedBoundaryText: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02GovInfoAnnualCfrAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const attemptedSources: string[] = [];
  const fail = (failure: Failure) => failedResult({
    usage,
    attemptedSources,
    failure,
    started,
    monotonicNow: input.monotonicNow,
  });
  if (
    !validCoordinate(input.cfrTitle, input.cfrPart, input.section) ||
    !exactDate(input.legalEffectDate) || !input.expectedBoundaryText.trim()
  ) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "Annual CFR retrieval requires one exact title, part, selected section, legal-effective date, and pre-effective boundary paragraph.",
    });
  }
  if (!validApiKey(input.apiKey)) {
    return fail({
      code: "source_not_configured",
      status: "unsupported",
      limitation:
        "The official annual CFR route is unavailable because the GovInfo server credential is not configured.",
    });
  }
  const annualEditionDate = annualCfrRevisionDate(
    input.cfrTitle,
    input.legalEffectDate,
  );
  if (!annualEditionDate) {
    return fail({
      code: "historical_date_unavailable",
      status: "unsupported",
      limitation:
        "The required strictly pre-effective annual CFR edition predates GovInfo's bounded 1997-and-later historical coverage.",
    });
  }

  const query = searchQuery({
    title: input.cfrTitle,
    part: input.cfrPart,
    section: input.section,
    annualEditionDate,
  });
  const searchBody = JSON.stringify({
    query,
    pageSize: "2",
    offsetMark: "*",
    historical: true,
    sorts: [{ field: "publishdate", sortOrder: "DESC" }],
  });
  const timeoutMs = input.timeoutMs ?? SIX_SCREEN_GOVINFO_ANNUAL_CFR_TIMEOUT_MS;
  attemptedSources.push(SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL);
  usage.sourceQueries = 1;
  usage.documentAttempts = 1;
  usage.transportHops = 1;
  let searchResponse: Response;
  try {
    searchResponse = await fetchWithinTimeout({
      fetch: input.fetch,
      url: SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL,
      apiKey: input.apiKey!,
      method: "POST",
      accept: "application/json",
      timeoutMs,
      body: searchBody,
    });
  } catch {
    return fail({
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        "The GovInfo historical CFR search did not complete within the bounded transport.",
    });
  }
  const searchFailure = responseFailure(searchResponse, "historical CFR search");
  if (searchFailure) {
    await searchResponse.body?.cancel("GovInfo annual CFR search rejected")
      .catch(() => undefined);
    return fail(searchFailure);
  }
  if (contentLengthFailure(
    searchResponse,
    SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES,
  )) {
    await searchResponse.body?.cancel("GovInfo annual CFR search too large")
      .catch(() => undefined);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation:
        "The GovInfo historical CFR search exceeded the bounded response size.",
    });
  }
  const searchMediaType = (searchResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
  if (searchMediaType !== "application/json") {
    await searchResponse.body?.cancel("GovInfo annual CFR search format rejected")
      .catch(() => undefined);
    return fail({
      code: "unsupported_format",
      status: "unsupported",
      limitation: "The GovInfo historical CFR search was not declared as JSON.",
    });
  }
  let searchJson: string;
  try {
    const bounded = await boundedText(
      searchResponse,
      SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES,
    );
    searchJson = bounded.text;
    usage.receivedBytes += bounded.receivedBytes;
  } catch (error) {
    usage.receivedBytes += bytesFromError(error);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation:
        "The GovInfo historical CFR search exceeded the bounded response size.",
    });
  }
  usage.decodedBytes += new TextEncoder().encode(searchJson).byteLength;
  let search: unknown;
  try {
    search = JSON.parse(searchJson);
  } catch {
    return fail({
      code: "unparsed",
      status: "unsupported",
      limitation: "The GovInfo historical CFR search was not valid JSON.",
    });
  }
  const results = isRecord(search) && Array.isArray(search.results)
    ? search.results
    : [];
  usage.metadataRecords = Math.min(results.length, 2);
  if (
    !isRecord(search) || search.count !== 1 || results.length !== 1 ||
    !isRecord(results[0])
  ) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The exact historical CFR search did not return one unique annual section result.",
    });
  }
  const result = results[0];
  const year = annualEditionDate.slice(0, 4);
  const packagePattern = new RegExp(
    `^CFR-${year}-title${input.cfrTitle}-vol[1-9][0-9]*$`,
    "u",
  );
  const packageId = typeof result.packageId === "string" &&
      packagePattern.test(result.packageId)
    ? result.packageId
    : null;
  const expectedGranuleSuffix = `sec${input.section.replaceAll(".", "-")}`;
  const granuleId = packageId && typeof result.granuleId === "string" &&
      result.granuleId === `${packageId}-${expectedGranuleSuffix}`
    ? result.granuleId
    : null;
  const resultLink = packageId && granuleId
    ? exactApiUrl(
        result.resultLink,
        `/packages/${packageId}/granules/${granuleId}/summary`,
      )
    : null;
  const xmlUrl = packageId && granuleId && isRecord(result.download)
    ? exactApiUrl(
        result.download.xmlLink,
        `/packages/${packageId}/granules/${granuleId}/xml`,
      )
    : null;
  if (
    result.collectionCode !== "CFR" || result.dateIssued !== annualEditionDate ||
    !packageId || !granuleId || !resultLink || !xmlUrl
  ) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The GovInfo search result did not bind the exact annual CFR collection, date, title, part, section, package, granule, and XML representation.",
    });
  }
  usage.usefulDocuments = 1;
  attemptedSources.push(xmlUrl);
  usage.documentAttempts += 1;
  usage.transportHops += 1;
  let xmlResponse: Response;
  try {
    xmlResponse = await fetchWithinTimeout({
      fetch: input.fetch,
      url: xmlUrl,
      apiKey: input.apiKey!,
      method: "GET",
      accept: "application/xml, text/xml;q=0.9",
      timeoutMs,
    });
  } catch {
    return fail({
      code: "source_unavailable",
      status: "waiting_source",
      limitation:
        "The exact annual CFR XML request did not complete within the bounded transport.",
    });
  }
  const xmlFailure = responseFailure(xmlResponse, "annual CFR XML");
  if (xmlFailure) {
    await xmlResponse.body?.cancel("GovInfo annual CFR XML rejected")
      .catch(() => undefined);
    return fail(xmlFailure);
  }
  if (contentLengthFailure(
    xmlResponse,
    SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES,
  )) {
    await xmlResponse.body?.cancel("GovInfo annual CFR XML too large")
      .catch(() => undefined);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The exact annual CFR XML exceeded the bounded response size.",
    });
  }
  const xmlMediaType = (xmlResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
  if (xmlMediaType !== "application/xml" && xmlMediaType !== "text/xml") {
    await xmlResponse.body?.cancel("GovInfo annual CFR XML format rejected")
      .catch(() => undefined);
    return fail({
      code: "unsupported_format",
      status: "unsupported",
      limitation: "The exact annual CFR representation was not declared as XML.",
    });
  }
  let xml: string;
  try {
    const bounded = await boundedText(
      xmlResponse,
      SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES,
    );
    xml = bounded.text;
    usage.receivedBytes += bounded.receivedBytes;
  } catch (error) {
    usage.receivedBytes += bytesFromError(error);
    return fail({
      code: "response_limit",
      status: "waiting_source",
      limitation: "The exact annual CFR XML exceeded the bounded response size.",
    });
  }
  usage.decodedBytes += new TextEncoder().encode(xml).byteLength;
  if (!annualXmlMatches({
    xml,
    title: input.cfrTitle,
    part: input.cfrPart,
    section: input.section,
    annualEditionDate,
    expectedBoundaryText: input.expectedBoundaryText,
  })) {
    return fail({
      code: "wrong_document",
      status: "unsupported",
      limitation:
        "The GovInfo annual CFR XML did not match the exact title, part, section, edition date, and selected pre-effective boundary paragraph.",
    });
  }
  usage.usefulDocuments += 1;
  usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  return {
    status: "ready",
    failureCode: null,
    attemptedSources,
    limitation: null,
    baseline: {
      annualEditionDate,
      section: input.section,
      packageId,
      granuleId,
      searchUrl: SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL,
      searchQuery: query,
      searchResponseContentHash: await sha256(searchJson),
      searchResponseJsonLength: searchJson.length,
      xmlUrl,
      xmlContentHash: await sha256(xml),
      xml,
    },
    usage,
  };
}
