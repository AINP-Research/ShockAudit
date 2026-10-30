import type {
  PolicyReviewFailureCode,
  SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import { SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION } from
  "../core/six-screen/contracts";
import {
  parseFederalRegisterPolicyEvidence,
  type ParsedFederalRegisterPolicyEvidence,
} from "../core/six-screen/policy-review";
import type { FederalRegisterPolicyEvidenceFocus } from
  "../core/six-screen/policy-evidence-plan";
import type { FederalRegisterCfrCoordinate } from
  "../core/six-screen/policy-history";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import {
  officialDocumentAccessChallenge,
  primaryOfficialDocumentHtml,
  visibleOfficialDocumentText,
} from "./official-document-html";
import { federalRegisterOwnDocumentNumbers } from
  "./federal-register-document-identity";
import { acquireScreen02GovInfoFederalRegisterRepresentation } from
  "./screen02-govinfo-federal-register-acquisition";
import type { Screen02ConnectorFetch } from "./screen02-connectors";

export const SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_ATTEMPTS = 2;
export const SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_REDIRECTS = 2;
export const SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_TIMEOUT_MS = 10_000;

export type Screen02FederalRegisterExactRepresentation = {
  url: string;
  representation: "html" | "text";
};
type Representation = Screen02FederalRegisterExactRepresentation;

export type Screen02FederalRegisterExactAttemptFailure = {
  ok: false;
  code: PolicyReviewFailureCode;
  limitation: string;
  receivedBytes: number;
  decodedBytes: number;
  transportHops: number;
};

export type Screen02FederalRegisterExactAttemptSuccess = {
  ok: true;
  canonicalUrl: string;
  representation: "html" | "text";
  identityText: string;
  parsedText: string;
  contentHash: string;
  receivedBytes: number;
  decodedBytes: number;
  transportHops: number;
};
type AttemptFailure = Screen02FederalRegisterExactAttemptFailure;
type AttemptSuccess = Screen02FederalRegisterExactAttemptSuccess;

export type Screen02FederalRegisterAcquisitionResult = {
  protocolVersion: typeof SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION;
  focus: FederalRegisterPolicyEvidenceFocus;
  status: "ready" | "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  parsed: ParsedFederalRegisterPolicyEvidence | null;
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
  for (const [provider, units] of Object.entries(source.providerCostUnits)) {
    target.providerCostUnits[provider] =
      (target.providerCostUnits[provider] ?? 0) + units;
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

function exactDocumentNumber(workflow: SixScreenWorkflowState) {
  const values = new Set(
    workflow.confirmedShock?.formalIdentifiers.flatMap((value) =>
      value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []
    ) ?? [],
  );
  return values.size === 1 ? [...values][0]! : null;
}

export function exactFederalRegisterRepresentation(
  value: string,
  documentNumber: string,
): Representation | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.federalregister.gov", "federalregister.gov"].includes(
        url.hostname.toLocaleLowerCase("en-US"),
      ) ||
      url.username || url.password || url.port || url.search || url.hash
    ) return null;
    url.hostname = "www.federalregister.gov";
    const escaped = documentNumber.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const html = new RegExp(
      `^/documents/full_text/html/\\d{4}/\\d{2}/\\d{2}/${escaped}\\.html$`,
      "u",
    );
    const text = new RegExp(
      `^/documents/full_text/text/\\d{4}/\\d{2}/\\d{2}/${escaped}\\.txt$`,
      "u",
    );
    const landing = new RegExp(
      `^/documents/(\\d{4})/(\\d{2})/(\\d{2})/${escaped}(?:/[^/]+)?/?$`,
      "u",
    ).exec(url.pathname);
    if (html.test(url.pathname)) return { url: url.toString(), representation: "html" };
    if (text.test(url.pathname)) return { url: url.toString(), representation: "text" };
    if (landing) return { url: url.toString(), representation: "html" };
    const short = new RegExp(`^/d/${escaped}/?$`, "u");
    return short.test(url.pathname)
      ? { url: url.toString(), representation: "html" }
      : null;
  } catch {
    return null;
  }
}

export function federalRegisterExactDocumentRepresentations(
  locators: readonly string[],
  documentNumber: string,
) {
  const derived: string[] = [];
  for (const value of locators) {
    const representation = exactFederalRegisterRepresentation(
      value,
      documentNumber,
    );
    if (!representation) continue;
    const landing = /^\/documents\/(\d{4})\/(\d{2})\/(\d{2})\/\d{4}-\d{4,6}(?:\/[^/]+)?\/?$/u
      .exec(new URL(representation.url).pathname);
    if (landing) {
      derived.push(
        `https://www.federalregister.gov/documents/full_text/html/${landing[1]}/${landing[2]}/${landing[3]}/${documentNumber}.html`,
        `https://www.federalregister.gov/documents/full_text/text/${landing[1]}/${landing[2]}/${landing[3]}/${documentNumber}.txt`,
      );
    }
    derived.push(representation.url);
  }
  return [...new Set(derived)]
    .map((value) => exactFederalRegisterRepresentation(value, documentNumber))
    .filter((value): value is Representation => Boolean(value))
    .sort((left, right) => {
      const rank = (value: Representation) =>
        value.url.includes("/full_text/html/")
          ? 0
          : value.url.includes("/full_text/text/")
            ? 1
            : 2;
      return rank(left) - rank(right);
    })
    .slice(0, SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_ATTEMPTS);
}

function representationLocators(
  workflow: SixScreenWorkflowState,
  documentNumber: string,
) {
  const candidate = workflow.candidates.find(
    ({ id }) => id === workflow.confirmedShock?.confirmation.candidateId,
  );
  const original = [
    ...(candidate?.identitySources.map(({ locator }) => locator) ?? []),
    ...workflow.officialSourceLocators,
  ];
  return federalRegisterExactDocumentRepresentations(original, documentNumber);
}

function legalEditionLocator(
  workflow: SixScreenWorkflowState,
  documentNumber: string,
) {
  const candidate = workflow.candidates.find(
    ({ id }) => id === workflow.confirmedShock?.confirmation.candidateId,
  );
  for (const { locator } of candidate?.identitySources ?? []) {
    try {
      const url = new URL(locator);
      if (
        url.protocol !== "https:" ||
        url.hostname.toLocaleLowerCase("en-US") !== "www.govinfo.gov" ||
        url.username || url.password || url.port || url.search || url.hash
      ) continue;
      const escaped = documentNumber.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      if (new RegExp(
        `^/content/pkg/FR-\\d{4}-\\d{2}-\\d{2}/pdf/${escaped}\\.pdf$`,
        "u",
      ).test(url.pathname)) return url.toString();
    } catch {
      // A malformed candidate locator cannot enter the evidence collection.
    }
  }
  return undefined;
}

async function boundedText(response: Response) {
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
        SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES + 1,
        receivedBytes + chunk.value.byteLength,
      );
      if (receivedBytes > SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES) {
        await reader.cancel("Federal Register representation byte limit reached")
          .catch(() => undefined);
        throw Object.assign(new Error("Federal Register representation exceeded the byte limit."), {
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

async function fetchWithinTimeout(
  fetchImpl: Screen02ConnectorFetch,
  url: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Federal Register representation timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "text/html, text/plain;q=0.9",
          "cache-control": "no-store",
          "user-agent": "ShockAudit six-screen policy retrieval",
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

export async function fetchRepresentation(input: {
  fetch: Screen02ConnectorFetch;
  representation: Representation;
  documentNumber: string;
  timeoutMs: number;
}): Promise<AttemptFailure | AttemptSuccess> {
  let current = input.representation;
  let receivedBytes = 0;
  let transportHops = 0;
  const visited = new Set<string>();
  try {
    for (
      let redirectCount = 0;
      redirectCount <= SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_REDIRECTS;
      redirectCount += 1
    ) {
      if (visited.has(current.url)) {
        return { ok: false, code: "source_unavailable", limitation: "The Federal Register representation redirect loop was rejected.", receivedBytes, decodedBytes: 0, transportHops };
      }
      visited.add(current.url);
      transportHops += 1;
      const response = await fetchWithinTimeout(
        input.fetch,
        current.url,
        input.timeoutMs,
      );
      if (response.redirected) {
        await response.body?.cancel("Automatic redirects are forbidden").catch(() => undefined);
        return { ok: false, code: "source_unavailable", limitation: "The representation transport auto-followed a redirect and was rejected.", receivedBytes, decodedBytes: 0, transportHops };
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_REDIRECTS) {
          await response.body?.cancel("Redirect limit reached").catch(() => undefined);
          return { ok: false, code: "source_unavailable", limitation: "The Federal Register representation exceeded the redirect limit.", receivedBytes, decodedBytes: 0, transportHops };
        }
        const location = response.headers.get("location");
        const resolved = location
          ? exactFederalRegisterRepresentation(
              new URL(location, current.url).toString(),
              input.documentNumber,
            )
          : null;
        await response.body?.cancel("Following validated manual redirect").catch(() => undefined);
        if (!resolved) {
          return { ok: false, code: "wrong_document", limitation: "A Federal Register redirect did not remain bound to the confirmed document number.", receivedBytes, decodedBytes: 0, transportHops };
        }
        current = resolved;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel("Non-success response").catch(() => undefined);
        return { ok: false, code: "source_unavailable", limitation: `The Federal Register representation returned HTTP ${response.status}.`, receivedBytes, decodedBytes: 0, transportHops };
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) &&
        contentLength > SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_MAX_BYTES
      ) {
        await response.body?.cancel("Declared response too large").catch(() => undefined);
        return { ok: false, code: "response_limit", limitation: "The Federal Register representation exceeded the bounded response size.", receivedBytes, decodedBytes: 0, transportHops };
      }
      const mediaType = (response.headers.get("content-type") ?? "")
        .split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
      if (mediaType !== "text/html" && mediaType !== "text/plain") {
        await response.body?.cancel("Unsupported media type").catch(() => undefined);
        return { ok: false, code: "unsupported_format", limitation: "The Federal Register representation was not declared as HTML or plain text.", receivedBytes, decodedBytes: 0, transportHops };
      }
      let bounded: { text: string; receivedBytes: number };
      try {
        bounded = await boundedText(response);
      } catch (error) {
        const counted = typeof (error as { receivedBytes?: unknown }).receivedBytes === "number"
          ? (error as { receivedBytes: number }).receivedBytes
          : 0;
        return { ok: false, code: "response_limit", limitation: "The Federal Register representation exceeded the bounded response size.", receivedBytes: receivedBytes + counted, decodedBytes: 0, transportHops };
      }
      receivedBytes += bounded.receivedBytes;
      if (mediaType === "text/html" && officialDocumentAccessChallenge(bounded.text)) {
        return { ok: false, code: "source_unavailable", limitation: "The Federal Register returned an access-control interstitial instead of the confirmed document.", receivedBytes, decodedBytes: 0, transportHops };
      }
      const ownNumbers = federalRegisterOwnDocumentNumbers(bounded.text);
      if (ownNumbers.length !== 1 || ownNumbers[0] !== input.documentNumber) {
        return { ok: false, code: "wrong_document", limitation: "The returned representation did not identify itself as the exact confirmed Federal Register document.", receivedBytes, decodedBytes: 0, transportHops };
      }
      const representation = mediaType === "text/html" ? "html" : "text";
      const identityText = representation === "html"
        ? visibleOfficialDocumentText(bounded.text)
        : bounded.text.replace(/\s+/gu, " ").trim();
      const parsedText = representation === "html"
        ? visibleOfficialDocumentText(primaryOfficialDocumentHtml(bounded.text))
        : identityText;
      if (!parsedText) {
        return { ok: false, code: "unparsed", limitation: "The confirmed representation contained no usable visible policy text.", receivedBytes, decodedBytes: 0, transportHops };
      }
      return {
        ok: true,
        canonicalUrl: current.url,
        representation,
        identityText,
        parsedText,
        contentHash: await sha256(bounded.text),
        receivedBytes,
        decodedBytes: new TextEncoder().encode(parsedText).byteLength,
        transportHops,
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "source_unavailable",
      limitation: error instanceof Error
        ? error.message.slice(0, 500)
        : "The Federal Register representation request failed.",
      receivedBytes,
      decodedBytes: 0,
      transportHops,
    };
  }
  return { ok: false, code: "source_unavailable", limitation: "The Federal Register representation request did not complete.", receivedBytes, decodedBytes: 0, transportHops };
}

function failureStatus(code: PolicyReviewFailureCode) {
  return code === "source_unavailable" || code === "response_limit"
    ? "waiting_source" as const
    : "unsupported" as const;
}

export type Screen02FederalRegisterContextAnchor = {
  status: "ready" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  canonicalUrl: string | null;
  contentHash: string | null;
  representation: "html" | "text" | null;
  parsedText: string | null;
  cfrCoordinates: FederalRegisterCfrCoordinate[];
  cfrCoordinate: FederalRegisterCfrCoordinate | null;
  attemptedSources: string[];
  limitation: string | null;
  usage: ResearchTaskOperationUsage;
};

function exactCfrCoordinates(text: string) {
  const coordinates = new Map<string, FederalRegisterCfrCoordinate>();
  for (const match of text.matchAll(
    /\b(\d{1,2})\s+CFR\s+Part\s+(\d{1,4})\b/giu,
  )) {
    const title = String(Number(match[1]));
    const part = String(Number(match[2]));
    if (title === "0" || part === "0") continue;
    coordinates.set(`${title}:${part}`, { title, part });
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})\s+CFR\s+Parts\s+(\d{1,4}(?:\s*,\s*\d{1,4})*(?:\s*,?\s*(?:and|&)\s+\d{1,4})?)\b/giu,
  )) {
    const title = String(Number(match[1]));
    if (title === "0") continue;
    for (const partMatch of match[2]!.matchAll(/\d{1,4}/gu)) {
      const part = String(Number(partMatch[0]));
      if (part === "0") continue;
      coordinates.set(`${title}:${part}`, { title, part });
    }
  }
  return [...coordinates.values()];
}

/**
 * Reinspect the exact contemporaneous Federal Register representation only to
 * establish one source-native CFR title/part coordinate for the history route.
 */
export async function acquireScreen02FederalRegisterContextAnchor(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  govInfoApiKey?: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02FederalRegisterContextAnchor> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const documentNumber = exactDocumentNumber(input.workflow);
  if (!input.workflow.confirmedShock || !documentNumber) {
    return {
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: null,
      canonicalUrl: null,
      contentHash: null,
      representation: null,
      parsedText: null,
      cfrCoordinates: [],
      cfrCoordinate: null,
      attemptedSources: [],
      limitation:
        "The confirmed identity does not contain one exact Federal Register document number.",
      usage,
    };
  }
  const representations = representationLocators(input.workflow, documentNumber);
  if (!representations.length && input.govInfoApiKey === undefined) {
    return {
      status: "unsupported",
      failureCode: "unsupported_format",
      documentNumber,
      canonicalUrl: null,
      contentHash: null,
      representation: null,
      parsedText: null,
      cfrCoordinates: [],
      cfrCoordinate: null,
      attemptedSources: [],
      limitation:
        "No exact Federal Register HTML or text representation was retained with the confirmed identity.",
      usage,
    };
  }
  const attemptedSources: string[] = [];
  let lastFailure: AttemptFailure | null = null;
  let coordinateFallback: {
    attempt: AttemptSuccess;
    cfrCoordinates: FederalRegisterCfrCoordinate[];
  } | null = null;
  for (const representation of representations) {
    attemptedSources.push(representation.url);
    usage.documentAttempts += 1;
    const attempt = await fetchRepresentation({
      fetch: input.fetch,
      representation,
      documentNumber,
      timeoutMs: input.timeoutMs ?? SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_TIMEOUT_MS,
    });
    usage.transportHops += attempt.transportHops;
    usage.receivedBytes += attempt.receivedBytes;
    usage.decodedBytes += attempt.decodedBytes;
    if (!attempt.ok) {
      lastFailure = attempt;
      continue;
    }
    const cfrCoordinates = exactCfrCoordinates(attempt.identityText);
    const cfrCoordinate = cfrCoordinates.length === 1
      ? cfrCoordinates[0]!
      : null;
    if (!cfrCoordinate) {
      coordinateFallback ??= { attempt, cfrCoordinates };
      lastFailure = {
        ok: false,
        code: "cfr_coordinates_unavailable",
        limitation:
          "The exact Federal Register representation did not expose one unambiguous CFR title and part.",
        receivedBytes: 0,
        decodedBytes: 0,
        transportHops: 0,
      };
      if (cfrCoordinates.length > 1) break;
      continue;
    }
    usage.usefulDocuments = 1;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      status: "ready",
      failureCode: null,
      documentNumber,
      canonicalUrl: attempt.canonicalUrl,
      contentHash: attempt.contentHash,
      representation: attempt.representation,
      parsedText: attempt.parsedText,
      cfrCoordinates,
      cfrCoordinate,
      attemptedSources,
      limitation: null,
      usage,
    };
  }
  if (input.govInfoApiKey !== undefined) {
    const govInfo = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: input.workflow,
      fetch: input.fetch,
      apiKey: input.govInfoApiKey,
      monotonicNow: input.monotonicNow,
      timeoutMs: input.timeoutMs ?? SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_TIMEOUT_MS,
    });
    addUsage(usage, govInfo.usage);
    attemptedSources.push(...govInfo.attemptedSources);
    if (govInfo.representation) {
      const attempt: AttemptSuccess = {
        ok: true,
        ...govInfo.representation,
        receivedBytes: 0,
        decodedBytes: 0,
        transportHops: 0,
      };
      const cfrCoordinates = exactCfrCoordinates(attempt.identityText);
      const cfrCoordinate = cfrCoordinates.length === 1
        ? cfrCoordinates[0]!
        : null;
      if (cfrCoordinate) {
        usage.usefulDocuments = Math.max(usage.usefulDocuments, 1);
        usage.activeResearchMs = Math.max(
          0,
          Math.round((input.monotonicNow?.() ?? started) - started),
        );
        return {
          status: "ready",
          failureCode: null,
          documentNumber,
          canonicalUrl: attempt.canonicalUrl,
          contentHash: attempt.contentHash,
          representation: attempt.representation,
          parsedText: attempt.parsedText,
          cfrCoordinates,
          cfrCoordinate,
          attemptedSources,
          limitation: null,
          usage,
        };
      }
      coordinateFallback ??= { attempt, cfrCoordinates };
      lastFailure = {
        ok: false,
        code: "cfr_coordinates_unavailable",
        limitation:
          "The exact GovInfo representation did not expose one unambiguous CFR title and part.",
        receivedBytes: 0,
        decodedBytes: 0,
        transportHops: 0,
      };
    } else if (govInfo.failureCode) {
      lastFailure = {
        ok: false,
        code: govInfo.failureCode,
        limitation: govInfo.limitation ??
          "The GovInfo exact-record fallback did not complete.",
        receivedBytes: 0,
        decodedBytes: 0,
        transportHops: 0,
      };
    }
  }
  usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  if (coordinateFallback) {
    usage.usefulDocuments = 1;
    return {
      status: "unsupported",
      failureCode: "cfr_coordinates_unavailable",
      documentNumber,
      canonicalUrl: coordinateFallback.attempt.canonicalUrl,
      contentHash: coordinateFallback.attempt.contentHash,
      representation: coordinateFallback.attempt.representation,
      parsedText: coordinateFallback.attempt.parsedText,
      cfrCoordinates: coordinateFallback.cfrCoordinates,
      cfrCoordinate: null,
      attemptedSources,
      limitation:
        "The exact Federal Register representation did not expose one unambiguous CFR title and part.",
      usage,
    };
  }
  const failure = lastFailure ?? {
    code: "source_unavailable" as const,
    limitation: "No Federal Register representation completed.",
  };
  return {
    status: failureStatus(failure.code),
    failureCode: failure.code,
    documentNumber,
    canonicalUrl: null,
    contentHash: null,
    representation: null,
    parsedText: null,
    cfrCoordinates: [],
    cfrCoordinate: null,
    attemptedSources,
    limitation: failure.limitation,
    usage,
  };
}

export async function acquireScreen02FederalRegisterPolicy(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  focus?: FederalRegisterPolicyEvidenceFocus;
  govInfoApiKey?: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02FederalRegisterAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const focus = input.focus ?? "core";
  const usage = emptyUsage();
  const documentNumber = exactDocumentNumber(input.workflow);
  if (!input.workflow.confirmedShock || !documentNumber) {
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus,
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: null,
      attemptedSources: [],
      unresolved: ["exact Federal Register document number"],
      limitation: "The confirmed identity does not contain one exact Federal Register document number.",
      parsed: null,
      usage,
    };
  }
  const representations = representationLocators(input.workflow, documentNumber);
  const legalEditionUrl = legalEditionLocator(input.workflow, documentNumber);
  if (!representations.length && input.govInfoApiKey === undefined) {
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus,
      status: "unsupported",
      failureCode: "unsupported_format",
      documentNumber,
      attemptedSources: [],
      unresolved: ["official published-text representation"],
      limitation: "No exact Federal Register HTML or text representation was retained with the confirmed identity.",
      parsed: null,
      usage,
    };
  }
  const attemptedSources: string[] = [];
  let lastFailure: AttemptFailure | null = null;
  for (const representation of representations) {
    attemptedSources.push(representation.url);
    usage.documentAttempts += 1;
    const attempt = await fetchRepresentation({
      fetch: input.fetch,
      representation,
      documentNumber,
      timeoutMs: input.timeoutMs ?? SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_TIMEOUT_MS,
    });
    usage.transportHops += attempt.transportHops;
    usage.receivedBytes += attempt.receivedBytes;
    usage.decodedBytes += attempt.decodedBytes;
    if (!attempt.ok) {
      lastFailure = attempt;
      continue;
    }
    const publicationDate = input.workflow.confirmedShock.typedDates.find(
      ({ kind, start }) => kind === "publication" && start !== null,
    )?.start ?? null;
    const parsed = parseFederalRegisterPolicyEvidence({
      eventId: input.workflow.confirmedShock.id,
      documentNumber,
      canonicalUrl: attempt.canonicalUrl,
      title: input.workflow.confirmedShock.officialTitle,
      issuer: input.workflow.confirmedShock.issuer,
      publicationDate,
      retrievedAt: input.retrievedAt,
      contentHash: attempt.contentHash,
      representation: attempt.representation,
      parsedText: attempt.parsedText,
      focus,
      ...(legalEditionUrl ? { legalEditionUrl } : {}),
    });
    usage.usefulDocuments = 1;
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      focus,
      status: parsed.status,
      failureCode: null,
      documentNumber,
      attemptedSources,
      unresolved: parsed.unresolved,
      limitation: parsed.status === "partial"
        ? "The exact document was retained, but this narrow parser did not locate every required policy fact. Missing facts remain explicit."
        : null,
      parsed,
      usage,
    };
  }
  if (input.govInfoApiKey !== undefined) {
    const govInfo = await acquireScreen02GovInfoFederalRegisterRepresentation({
      workflow: input.workflow,
      fetch: input.fetch,
      apiKey: input.govInfoApiKey,
      monotonicNow: input.monotonicNow,
      timeoutMs: input.timeoutMs ?? SIX_SCREEN_FEDERAL_REGISTER_DOCUMENT_TIMEOUT_MS,
    });
    addUsage(usage, govInfo.usage);
    attemptedSources.push(...govInfo.attemptedSources);
    if (govInfo.representation) {
      const publicationDate = input.workflow.confirmedShock.typedDates.find(
        ({ kind, start }) => kind === "publication" && start !== null,
      )?.start ?? null;
      const parsed = parseFederalRegisterPolicyEvidence({
        eventId: input.workflow.confirmedShock.id,
        documentNumber,
        canonicalUrl: govInfo.representation.canonicalUrl,
        title: input.workflow.confirmedShock.officialTitle,
        issuer: input.workflow.confirmedShock.issuer,
        publicationDate,
        retrievedAt: input.retrievedAt,
        contentHash: govInfo.representation.contentHash,
        representation: govInfo.representation.representation,
        parsedText: govInfo.representation.parsedText,
        focus,
        sourceProvider: "govinfo",
      });
      usage.usefulDocuments = Math.max(usage.usefulDocuments, 1);
      usage.activeResearchMs = Math.max(
        0,
        Math.round((input.monotonicNow?.() ?? started) - started),
      );
      return {
        protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
        focus,
        status: parsed.status,
        failureCode: null,
        documentNumber,
        attemptedSources,
        unresolved: parsed.unresolved,
        limitation: parsed.status === "partial"
          ? "The exact GovInfo representation was retained, but this narrow parser did not locate every required policy fact. Missing facts remain explicit."
          : null,
        parsed,
        usage,
      };
    }
    if (govInfo.failureCode) {
      lastFailure = {
        ok: false,
        code: govInfo.failureCode,
        limitation: govInfo.limitation ??
          "The GovInfo exact-record fallback did not complete.",
        receivedBytes: 0,
        decodedBytes: 0,
        transportHops: 0,
      };
    }
  }
  usage.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  const failure = lastFailure ?? {
    code: "source_unavailable" as const,
    limitation: "No Federal Register representation completed.",
  };
  return {
    protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
    focus,
    status: failureStatus(failure.code),
    failureCode: failure.code,
    documentNumber,
    attemptedSources,
    unresolved: ["official published-text representation"],
    limitation: failure.limitation,
    parsed: null,
    usage,
  };
}
