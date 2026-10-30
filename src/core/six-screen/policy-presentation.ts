import type { PolicyBriefingSection } from "./contracts";

function decodePresentationEntities(value: string) {
  const named: Readonly<Record<string, string>> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"', sect: "§",
  };
  return value.replace(
    /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/gu,
    (entity, decimal: string | undefined, hex: string | undefined,
      name: string | undefined) => {
      if (name) return named[name] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hex ?? "", hex ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 &&
          codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    },
  );
}

function cleanLegacyPresentationMarkup(value: string) {
  let text = value;
  for (let pass = 0; pass < 2; pass += 1) {
    text = decodePresentationEntities(text);
  }
  return text
    .replace(/<!--[\s\S]*?-->|<!DOCTYPE\b[^>]*>/giu, " ")
    .replace(/<!\[CDATA\[|\]\]>/gu, " ")
    .replace(
      /<(?:[\w.-]+:)?(?:meta|metadata|navigation|script|style|toc)\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?(?:meta|metadata|navigation|script|style|toc)\s*>/giu,
      " ",
    )
    .replace(/<\/?(?:[A-Za-z][\w.-]*:)?[A-Za-z][\w.-]*(?:\s[^<>]{0,65536})?\s*\/?>/gu, " ");
}

function normalizedDefinitionTerm(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ").trim();
}

/**
 * Structured legal text often repeats a definition heading immediately before
 * the definition itself, for example "Covered issuer.—The term covered issuer
 * means …". Keep the operative sentence and remove only the duplicated label.
 */
function removeRepeatedDefinitionHeading(value: string) {
  const match = /^(.{2,100}?)\s*(?:[.—–:-]\s*)+(the term\s+(.{2,100}?)\s+means\b[\s\S]*)$/iu
    .exec(value);
  return match && normalizedDefinitionTerm(match[1]!) ===
      normalizedDefinitionTerm(match[3]!)
    ? match[2]!
    : value;
}

export function cleanPolicyPresentationText(value: string) {
  const normalized = cleanLegacyPresentationMarkup(value).normalize("NFKC")
    // Federal Register HTML/text exports sometimes append a rule followed by
    // a dashed footnote block. The exact passage remains available in Source
    // text; the summary stops before that apparatus.
    .split(/\s*-{12,}\s*/u, 1)[0] ?? "";
  const cleaned = normalized.replace(/^\s*\[\s*/u, "")
    .replace(/^\s*(?:\([a-z]+\)\s*)+/iu, "")
    .replace(/^\s*(?:\.{2,}|…+)\s*/u, "")
    .replace(/\\\d{1,3}\\/gu, "")
    .replace(/``|''/gu, '"')
    .replace(/\s*([:;,])\s*\.(?=\s|$)/gu, ".")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/([([{])\s+/gu, "$1")
    .replace(/\s+([)\]}])/gu, "$1")
    .replace(/\s*\[\s*(?:FR|Federal Register)\s+Doc\.?[^\]]*\]\s*/giu, " ")
    .replace(/\s+/gu, " ").trim();
  return removeRepeatedDefinitionHeading(cleaned);
}

/** Presentation-only completeness check. Canonical passages remain unchanged. */
export function isCompletePolicyPresentationSentence(value: string) {
  const text = cleanPolicyPresentationText(value);
  if (!text || text.trim().split(/\s+/u).length < 4 ||
      /(?:[:;,]|[—–-])\s*[.!?]?$/u.test(text) ||
      /^(?:and|but|or|that|which|who|whose)\b(?:\s|,)/iu.test(text) ||
      /^(?:shall|must|may|need not|required to|prohibited from)\b/iu.test(text) ||
      /^(?:as used in|for purposes of)\s+(?:this|the)\s+(?:act|title|section|part)\b.{0,100}\bfollowing definitions?\b/iu
        .test(text) ||
      /\b(?:the following|the earliest of)\s*[:—–-]?\s*[.!?]?$/iu.test(text)) {
    return false;
  }
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["(", ")"], ["[", "]"], ["{", "}"],
  ];
  return pairs.every(([open, close]) => {
    let depth = 0;
    for (const character of text) {
      if (character === open) depth += 1;
      if (character === close) {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  });
}

function proseIdentity(value: string) {
  return cleanPolicyPresentationText(value).replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'").toLocaleLowerCase("en-US");
}

/** One visible finding per exact normalized passage across the briefing.
 * Preserve all evidence links; never edit or deduplicate canonical claims,
 * dates, historical versions, or the exact source passages. */
export function uniquePolicyBriefingSections(sections: PolicyBriefingSection[]) {
  const seen = new Map<string, NonNullable<PolicyBriefingSection["findings"]>[number]>();
  return sections.map((section) => {
    const findings = (section.findings?.length ? section.findings :
      section.paragraphs.map((text) => ({ label: "", text, claimIds: section.claimIds })))
      .flatMap((finding) => {
        const text = cleanPolicyPresentationText(finding.text);
        const key = proseIdentity(text);
        if (!key) return [];
        const previous = seen.get(key);
        if (previous) {
          previous.claimIds = [...new Set([...previous.claimIds, ...finding.claimIds])];
          // A baseline copied into a requirement bucket must not be presented
          // as a new duty. Other complementary labels may describe one passage.
          if (!/(?:prior baseline|before this policy)/iu.test(previous.label) &&
              finding.label &&
              !previous.label.split(" · ").includes(finding.label)) {
            previous.label = [previous.label, finding.label].filter(Boolean).join(" · ");
          }
          return [];
        }
        const copy = { ...finding, text, claimIds: [...new Set(finding.claimIds)] };
        seen.set(key, copy);
        return [copy];
      });
    return { ...section, findings, paragraphs: [] };
  });
}
