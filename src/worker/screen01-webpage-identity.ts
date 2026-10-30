import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { policySearchUrlCues } from "../core/policy-search-query";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";

/**
 * This route extracts identity cues from one researcher-supplied public page.
 * It does not promote the page to controlling legal evidence. The Worker
 * config also enables global_fetch_strictly_public for outbound subrequests.
 */
export type Screen01WebpageInspection =
  | { status: "lead"; url: string; title: string; cues: string[];
      excerpt: string; receivedBytes: number; hops: number }
  | { status: "unsupported" | "unrelated" | "unavailable";
      reason: string; receivedBytes: number; hops: number };

const MAX_WEBPAGE_BYTES = 180_000;
const MAX_REDIRECTS = 2;
const DEFAULT_WEBPAGE_TIMEOUT_MS = 18_000;
const MAX_WEBPAGE_URL = 2_048;
const MAX_CUE_LENGTH = 300;
const PRIVATE_NAME = /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/iu;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
const URL_DEPENDENT_REQUEST_WORDS = new Set([
  "document", "event", "here", "link", "page", "policy", "shock", "site",
  "source", "this", "unknown", "unsure", "webpage", "website", "workplace",
]);

export function permittedIdentityWebpageUrl(value: string): string | null {
  if (!value || value.length > MAX_WEBPAGE_URL) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
      url.port || url.hash || !host.includes(".") ||
      host.length > 253 || PRIVATE_NAME.test(host) ||
      IPV4.test(host) || host.includes(":") ||
      !/^[a-z0-9.-]+$/u.test(host) ||
      host.split(".").some((label) => !label || label.length > 63 ||
        label.startsWith("-") || label.endsWith("-"))) return null;
    for (const key of url.searchParams.keys()) {
      if (/^(?:token|key|api_?key|access_?token|auth|password|secret)$/iu.test(key)) {
        return null;
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function decodeTitle(value: string): string {
  return value.replace(/<[^>]*>/gu, " ")
    .replace(/&(?:amp|#38);/giu, "&")
    .replace(/&(?:quot|#34);/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'")
    .replace(/&(?:nbsp|#160);/giu, " ")
    .replace(/\s+/gu, " ").trim().slice(0, MAX_CUE_LENGTH);
}

function identityCues(html: string): string[] {
  const candidates = [
    /<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html)?.[1],
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/iu.exec(html)?.[1],
    /<h2\b[^>]*>([\s\S]*?)<\/h2>/iu.exec(html)?.[1],
    /<meta\b(?=[^>]*(?:name|property)=["'](?:og:title|twitter:title)["'])[^>]*content=["']([^"']+)["'][^>]*>/iu.exec(html)?.[1],
    /<meta\b(?=[^>]*name=["']title["'])[^>]*content=["']([^"']+)["'][^>]*>/iu.exec(html)?.[1],
    /<meta\b(?=[^>]*name=["']description["'])[^>]*content=["']([^"']+)["'][^>]*>/iu.exec(html)?.[1],
    /["']headline["']\s*:\s*["']([^"']{3,300})["']/iu.exec(html)?.[1],
  ];
  return [...new Set(candidates.map((item) => decodeTitle(item ?? "")).filter(Boolean))];
}

function meaningfulWords(value: string): string[] {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ")
    .filter((word) => word.length > 2 && !/^(?:18|19|20)\d{2}$/u.test(word) &&
      !["the", "and", "for", "act", "law", "rule", "policy"].includes(word));
}

export function webpageMatchesRequestedPolicy(query: string, cues: string[]): boolean {
  const requested = meaningfulWords(query);
  if (!requested.length) return false;
  const cueWords = new Set(meaningfulWords(cues.join(" ")));
  const initials = cues.flatMap((cue) => {
    const words = cue.toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").split(" ")
      .filter((word) => word.length > 1 &&
        !/^(?:18|19|20)\d{2}$/u.test(word) &&
        !["the", "and", "for", "of", "to"].includes(word));
    return words.length >= 3 ? [words.map((word) => word[0]).join("")] : [];
  });
  if (requested.some((word) => word.length >= 3 &&
      initials.includes(word))) return true;
  const overlapping = requested.filter((word) => cueWords.has(word));
  if (overlapping.length >= Math.max(1, Math.ceil(requested.length * 0.5))) {
    return true;
  }
  // The name field is required, so a researcher who needs the URL fallback
  // may reasonably enter a pointer such as “the policy in this link.” Accept
  // that explicit URL-dependent intent, while a substantive but different
  // policy name still has to overlap the inspected title or heading.
  if (requested.every((word) => URL_DEPENDENT_REQUEST_WORDS.has(word))) {
    return true;
  }
  // One distinctive shared term is useful for an approximate user-entered
  // description (for example, “federal leave protection for workers”). The
  // page remains a non-controlling lead and still requires confirmation.
  return overlapping.some((word) => word.length >= 5);
}

export async function inspectPublicIdentityWebpage(input: {
  url: string;
  name: string;
  fetch: Screen02ConnectorFetch;
  timeoutMs?: number;
}): Promise<Screen01WebpageInspection> {
  const initialUrl = permittedIdentityWebpageUrl(input.url);
  if (!initialUrl) return { status: "unsupported",
    reason: "Use a public HTTPS webpage without credentials, private addresses, fragments or a custom port.",
    receivedBytes: 0, hops: 0 };
  let currentUrl: string = initialUrl;
  let receivedBytes = 0;
  let hops = 0;
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, Math.min(
    20_000,
    input.timeoutMs ?? DEFAULT_WEBPAGE_TIMEOUT_MS,
  ));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await input.fetch(currentUrl, {
        method: "GET", redirect: "manual", signal: controller.signal,
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
        headers: {
          Accept: "text/html, application/xhtml+xml, text/plain;q=0.8",
          "User-Agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
        },
      });
      hops += 1;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        const next: string | null = location
          ? permittedIdentityWebpageUrl(new URL(location, currentUrl).toString()) : null;
        if (!next || redirects === MAX_REDIRECTS) return {
          status: "unsupported", reason: "The webpage redirected outside the permitted public route.",
          receivedBytes, hops,
        };
        currentUrl = next;
        continue;
      }
      if (!response.ok) return { status: "unavailable",
        reason: `The webpage returned HTTP ${response.status}; its content was not inspected.`,
        receivedBytes, hops };
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType &&
          !/^(?:text\/html|text\/plain|application\/xhtml\+xml)\b/iu.test(contentType)) {
        await response.body?.cancel();
        return { status: "unsupported",
          reason: "Only public HTML or plain-text pages can be checked for identity.",
          receivedBytes, hops };
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (declaredLength > MAX_WEBPAGE_BYTES) {
        await response.body?.cancel();
        return { status: "unsupported",
          reason: "The webpage exceeds the bounded identity-reading limit.",
          receivedBytes, hops };
      }
      const reader = response.body?.getReader();
      if (!reader) return { status: "unavailable",
        reason: "The webpage returned no readable body.", receivedBytes, hops };
      const chunks: Uint8Array[] = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        receivedBytes += part.value.byteLength;
        if (receivedBytes > MAX_WEBPAGE_BYTES) {
          await reader.cancel();
          return { status: "unsupported",
            reason: "The webpage exceeds the bounded identity-reading limit.",
            receivedBytes, hops };
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const cues = [...new Set([
        ...identityCues(html),
        ...policySearchUrlCues([currentUrl]),
      ])].slice(0, 12);
      if (!webpageMatchesRequestedPolicy(input.name, cues)) return {
        status: "unrelated",
        reason: "The inspected page title and heading do not identify the entered policy. The page was not treated as a match.",
        receivedBytes, hops,
      };
      const title = [...cues].sort((a, b) =>
        meaningfulWords(b).length - meaningfulWords(a).length)[0]!;
      return { status: "lead", url: currentUrl, title, cues,
        excerpt: cues.join(". ").slice(0, 1_200), receivedBytes, hops };
    }
    return { status: "unsupported",
      reason: "Too many webpage redirects.", receivedBytes, hops };
  } catch (error) {
    return { status: "unavailable",
      reason: controller.signal.aborted
        ? `The public webpage did not respond within ${Math.round(timeoutMs / 1_000)} seconds. ShockAudit continued with its official-source searches instead of treating the URL failure as a policy-search failure.`
        : `The public webpage could not be retrieved (${error instanceof Error && /reviewed fixed official-source adapter/iu.test(error.message) ? "the generic webpage route was unavailable" : "network or publisher response failure"}). ShockAudit continued with its official-source searches instead of treating the URL failure as a policy-search failure.`,
      receivedBytes, hops };
  } finally {
    clearTimeout(timeout);
  }
}
