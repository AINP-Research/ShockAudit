import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { IdentityCandidate } from
  "../core/six-screen/contracts";
import type { Screen02FindProposal } from
  "../core/screen02-types";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from
  "./screen02-connectors";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";

export const SCREEN_01_OFFICIAL_POLICY_DOCUMENT_VERSION =
  "screen-01-official-policy-document-v1" as const;

const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_RETAINED_TEXT = 12_000;
const MAX_REDIRECTS = 2;
const UK_PRIMARY_INSTRUMENT_TYPES = new Set([
  "ukpga",
  "ukla",
  "asp",
  "anaw",
  "nia",
  "ukcm",
]);

type IdentitySource = IdentityCandidate["identitySources"][number];

type Representation = {
  url: string;
  provider: "uk-legislation" | "eu-cellar";
  routeId: "uk_legislation_document" | "eu_legal_document";
};

export type Screen01OfficialPolicyDocumentResult = {
  source: IdentitySource | null;
  attempts: number;
  transportHops: number;
  receivedBytes: number;
  decodedBytes: number;
  failure: "source_unavailable" | "unsupported_format" | "wrong_document" | null;
  limitation: string | null;
};

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/&#(\d+);/gu, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/&nbsp;/giu, " ")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&");
}

function visibleText(body: string) {
  if (/<!DOCTYPE[^>]*\[[\s\S]*<!ENTITY/iu.test(body)) {
    throw new Error("Official document contained a prohibited entity declaration.");
  }
  return decodeEntities(body
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " "))
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalized(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/gu, " ");
}

function identityTerms(value: string) {
  const ignored = new Set([
    "a", "an", "and", "for", "of", "the", "to", "act", "order",
    "regulation", "regulations", "rule",
  ]);
  return normalized(value).split(" ").filter((term) =>
    term.length > 2 && !ignored.has(term)
  );
}

function documentSupportsIdentity(
  text: string,
  proposal: Screen02FindProposal,
) {
  const normalizedText = normalized(text);
  const identifier = normalized(proposal.nativeIdentity?.formalIdentifier ?? "");
  if (identifier && normalizedText.includes(identifier)) return true;
  const terms = [...new Set(identityTerms(proposal.title))];
  if (!terms.length) return false;
  const matches = terms.filter((term) => normalizedText.includes(term)).length;
  return matches >= Math.max(1, Math.ceil(terms.length * 0.6));
}

function representationIdentity(
  value: string,
  provider: Representation["provider"],
) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash
    ) return null;
    if (provider === "uk-legislation") {
      if (
        url.hostname !== "www.legislation.gov.uk" &&
        url.hostname !== "legislation.gov.uk"
      ) return null;
      const match = /^\/(?:id\/)?(ukpga|uksi|ukla|asp|ssi|anaw|wsi|nia|nisr|ukcm|ukci)\/(\d{4})\/(\d+)(?:\/|$)/u
        .exec(`${url.pathname.replace(/\/$/u, "")}/`);
      return match ? `${match[1]}/${match[2]}/${match[3]}` : null;
    }
    if (
      url.hostname !== "eur-lex.europa.eu" ||
      !/^\/legal-content\/EN\/TXT(?:\/HTML)?\/?$/u.test(url.pathname)
    ) return null;
    const celex = url.searchParams.get("uri") ?? "";
    return /^CELEX:[A-Za-z0-9._:/-]{1,120}$/u.test(celex)
      ? celex.toUpperCase()
      : null;
  } catch {
    return null;
  }
}

function supportedFinalUrl(value: string, representation: Representation) {
  return representationIdentity(value, representation.provider) ===
    representationIdentity(representation.url, representation.provider);
}

function representations(proposal: Screen02FindProposal): Representation[] {
  const values: Representation[] = [];
  for (const source of proposal.sources) {
    let url: URL;
    try {
      url = new URL(source.locator);
    } catch {
      continue;
    }
    if (
      url.protocol === "https:" &&
      (url.hostname === "www.legislation.gov.uk" ||
        url.hostname === "legislation.gov.uk")
    ) {
      const path = url.pathname.replace(/^\/id(?=\/)/u, "").replace(/\/$/u, "");
      const coordinate = /^\/(ukpga|uksi|ukla|asp|ssi|anaw|wsi|nia|nisr|ukcm|ukci)\/(\d{4})\/(\d+)(?:\/.*)?$/u.exec(
        path,
      );
      if (!coordinate) {
        continue;
      }
      if (UK_PRIMARY_INSTRUMENT_TYPES.has(coordinate[1]!)) {
        const root = `/${coordinate[1]}/${coordinate[2]}/${coordinate[3]}`;
        // Full primary-legislation representations can exceed the bounded
        // identity lane. Official section and introduction fragments retain
        // the same native coordinate while providing usable, bounded text.
        values.push({
          url: `https://www.legislation.gov.uk${root}/section/1/data.xml`,
          provider: "uk-legislation",
          routeId: "uk_legislation_document",
        });
        values.push({
          url: `https://www.legislation.gov.uk${root}/introduction/data.xml`,
          provider: "uk-legislation",
          routeId: "uk_legislation_document",
        });
        continue;
      }
      values.push({
        url: `https://www.legislation.gov.uk${path}/data.xml`,
        provider: "uk-legislation",
        routeId: "uk_legislation_document",
      });
      values.push({
        url: `https://www.legislation.gov.uk${path}`,
        provider: "uk-legislation",
        routeId: "uk_legislation_document",
      });
      continue;
    }
    if (
      url.protocol === "https:" && url.hostname === "eur-lex.europa.eu" &&
      /^\/legal-content\/[A-Z]{2}\/TXT\/?$/u.test(url.pathname) &&
      /^CELEX:[A-Za-z0-9._:/-]{1,120}$/u.test(url.searchParams.get("uri") ?? "")
    ) {
      values.push({
        url: url.toString(),
        provider: "eu-cellar",
        routeId: "eu_legal_document",
      });
    }
  }
  return values.filter((value, index, all) =>
    all.findIndex((other) => other.url === value.url) === index
  );
}

function failure(
  partial: Omit<Screen01OfficialPolicyDocumentResult, "source" | "failure" | "limitation">,
  kind: NonNullable<Screen01OfficialPolicyDocumentResult["failure"]>,
  limitation: string,
): Screen01OfficialPolicyDocumentResult {
  return { ...partial, source: null, failure: kind, limitation };
}

export async function acquireScreen01OfficialPolicyDocument(input: {
  proposal: Screen02FindProposal;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  maximumAttempts: number;
  timeoutMs?: number;
}): Promise<Screen01OfficialPolicyDocumentResult> {
  let attempts = 0;
  let transportHops = 0;
  let receivedBytes = 0;
  let decodedBytes = 0;
  let lastFailure: Screen01OfficialPolicyDocumentResult["failure"] =
    "unsupported_format";
  let lastLimitation =
    "The official metadata record exposed no supported content representation.";
  let wrongDocumentLimitation: string | null = null;
  for (const representation of representations(input.proposal)) {
    if (attempts >= input.maximumAttempts) break;
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);
    try {
      let response: Response | null = null;
      let currentUrl = representation.url;
      const visited = new Set<string>();
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        if (visited.has(currentUrl)) {
          lastFailure = "source_unavailable";
          lastLimitation = "The official content representation entered a redirect loop.";
          response = null;
          break;
        }
        visited.add(currentUrl);
        response = await input.fetch(currentUrl, {
          method: "GET",
          headers: {
            accept: "application/xml, text/xml, text/html, application/xhtml+xml, text/plain",
            "cache-control": "no-store",
            "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
          },
          redirect: "manual",
          cache: "no-store",
          signal: controller.signal,
        });
        transportHops += 1;
        if (response.redirected) {
          await response.body?.cancel("Automatic redirects are forbidden")
            .catch(() => undefined);
          lastFailure = "source_unavailable";
          lastLimitation =
            "The official content transport followed a redirect automatically, so the response was rejected.";
          response = null;
          break;
        }
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        if (redirectCount >= MAX_REDIRECTS) {
          await response.body?.cancel("Redirect limit reached")
            .catch(() => undefined);
          lastFailure = "source_unavailable";
          lastLimitation =
            "The official content representation exceeded the redirect limit.";
          response = null;
          break;
        }
        const location = response.headers.get("location");
        const redirected = location
          ? new URL(location, currentUrl).toString()
          : null;
        await response.body?.cancel("Following validated manual redirect")
          .catch(() => undefined);
        if (!redirected || !supportedFinalUrl(redirected, representation)) {
          lastFailure = "wrong_document";
          lastLimitation =
            "The official content redirect did not remain bound to the same approved instrument identity.";
          wrongDocumentLimitation ??= lastLimitation;
          response = null;
          break;
        }
        currentUrl = redirected;
        response = null;
      }
      if (!response) continue;
      const finalUrl = response.url || currentUrl;
      if (!supportedFinalUrl(finalUrl, representation)) {
        await response.body?.cancel("Final identity mismatch")
          .catch(() => undefined);
        lastFailure = "wrong_document";
        lastLimitation =
          "The official content response did not remain bound to the requested instrument identity.";
        wrongDocumentLimitation ??= lastLimitation;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel("Non-success response")
          .catch(() => undefined);
        lastFailure = "source_unavailable";
        lastLimitation = `The official content representation returned HTTP ${response.status}.`;
        continue;
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES
      ) {
        await response.body?.cancel("Declared response too large")
          .catch(() => undefined);
        lastFailure = "unsupported_format";
        lastLimitation =
          "The official content representation exceeded the bounded response size.";
        continue;
      }
      const contentType = response.headers.get("content-type")?.toLocaleLowerCase("en-US") ?? "";
      if (
        contentType &&
        !/(?:html|xml|plain)/u.test(contentType)
      ) {
        lastFailure = "unsupported_format";
        lastLimitation = `The official content representation used unsupported media type ${contentType.split(";")[0]}.`;
        continue;
      }
      const body = await readScreen02BoundedResponseText(
        response,
        MAX_RESPONSE_BYTES,
      );
      const bodyBytes = new TextEncoder().encode(body).byteLength;
      receivedBytes += bodyBytes;
      const text = visibleText(body);
      decodedBytes += new TextEncoder().encode(text).byteLength;
      if (
        text.length < 80 ||
        /\b(?:captcha|access denied|verify you are human|enable javascript to continue)\b/iu.test(
          text.slice(0, 1_000),
        )
      ) {
        lastFailure = "source_unavailable";
        lastLimitation = "The official content response did not expose usable policy text.";
        continue;
      }
      if (!documentSupportsIdentity(text, input.proposal)) {
        lastFailure = "wrong_document";
        lastLimitation =
          "The retrieved official text did not substantiate the returned title or formal identifier.";
        wrongDocumentLimitation ??= lastLimitation;
        continue;
      }
      const retainedText = text.slice(0, MAX_RETAINED_TEXT);
      const source = input.proposal.sources[0]!;
      const nativeId = input.proposal.nativeIdentity?.formalIdentifier ?? null;
      const identitySource: IdentitySource = {
        id: `${source.id}-screen01-content`.slice(0, 200),
        title: input.proposal.title,
        locator: finalUrl,
        publisher: source.publisher,
        publishedDate: source.publishedDate ?? null,
        authorityTier: `tier-${source.authorityTier}`,
        retrievedAt: input.retrievedAt,
        provider: representation.provider,
        nativeId,
        routeId: representation.routeId,
        routeVersion: SCREEN_01_OFFICIAL_POLICY_DOCUMENT_VERSION,
        accessStatus: "retained_passage",
        inspectedText: "partial",
        contentHash: fingerprintSixScreenValue({ finalUrl, retainedText }),
        retainedText,
        limitation:
          "Bounded official text supports identity and an initial Screen 2 briefing; commencement, applicability, amendments, and historical versions remain review questions unless stated in the retained passage.",
      };
      return {
        source: identitySource,
        attempts,
        transportHops,
        receivedBytes,
        decodedBytes,
        failure: null,
        limitation: identitySource.limitation ?? null,
      };
    } catch (error) {
      lastFailure = error instanceof Error && /byte limit/iu.test(error.message)
        ? "unsupported_format"
        : "source_unavailable";
      lastLimitation = controller.signal.aborted
        ? "The official content request timed out within the bounded identity budget."
        : error instanceof Error && /byte limit/iu.test(error.message)
          ? "The official content representation exceeded the bounded response size."
          : "The official content request failed before usable text was retained.";
    } finally {
      clearTimeout(timeout);
    }
  }
  return failure({
    attempts,
    transportHops,
    receivedBytes,
    decodedBytes,
  }, wrongDocumentLimitation ? "wrong_document" : lastFailure ?? "unsupported_format",
  wrongDocumentLimitation ?? lastLimitation);
}
