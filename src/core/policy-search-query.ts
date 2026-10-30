/**
 * Shared deterministic query expansion for policy identity and co-event
 * discovery. The variants broaden provider retrieval only. They never create
 * an identity, legal stage, date, or substantive claim without source-backed
 * provider records and the ordinary verification gates.
 */

const GENERIC_POLICY_WORDS = new Set([
  "a", "an", "and", "act", "bill", "code", "for", "law", "laws", "of",
  "policy", "regulation", "regulations", "rule", "rules", "state", "states",
  "the", "to", "united", "us",
]);

const URL_PATH_WORDS = new Set([
  "about", "app", "article", "bill", "bills", "content", "details",
  "document", "documents", "faces", "html", "index", "law", "laws",
  "legislation", "news", "page", "pages", "policy", "press", "release",
  "resources", "rule", "rules", "search", "view", "www",
]);

function clean(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/[’‘]/gu, "'")
    .replace(/[“”]/gu, "\"")
    .replace(/\s+/gu, " ").trim();
}

export function normalizePolicySearchText(value: string) {
  return clean(value).normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function useful(value: string) {
  const normalized = normalizePolicySearchText(value);
  if (normalized.length < 3 || normalized.length > 300) return false;
  const words = normalized.split(" ");
  return words.some((word) =>
    word.length >= 3 && /\p{L}/u.test(word) &&
      !GENERIC_POLICY_WORDS.has(word)
  );
}

function addVariant(
  variants: string[],
  seen: Set<string>,
  value: string | null | undefined,
) {
  const candidate = clean(value ?? "").slice(0, 300);
  const key = normalizePolicySearchText(candidate);
  if (!candidate || !useful(candidate) || seen.has(key)) return;
  seen.add(key);
  variants.push(candidate);
}

function readableUrlCues(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [];
  }
  if (url.protocol !== "https:") return [];
  const cues: string[] = [];
  for (const key of [
    "title", "name", "bill_id", "bill", "document_number", "document",
    "packageId", "package_id", "law", "query", "q",
  ]) {
    const parameter = url.searchParams.get(key);
    if (parameter) cues.push(parameter);
  }
  const pathWords = url.pathname.split("/").flatMap((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Preserve the literal segment when percent decoding is malformed.
    }
    return decoded.replace(/\.(?:aspx?|html?|pdf|txt|xml)$/iu, "")
      .replace(/[_-]+/gu, " ").split(/\s+/gu);
  }).filter((word) => {
    const normalized = normalizePolicySearchText(word);
    return normalized.length >= 2 && !URL_PATH_WORDS.has(normalized) &&
      !/^[a-f0-9]{16,}$/iu.test(normalized);
  });
  if (pathWords.length >= 2) cues.push(pathWords.slice(-12).join(" "));
  return cues;
}

export function policySearchUrlCues(urls: readonly string[]) {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    for (const cue of readableUrlCues(url)) addVariant(values, seen, cue);
  }
  return values.slice(0, 8);
}

function parentheticalVariants(value: string) {
  const variants: string[] = [];
  const without = value.replace(/\s*\([^)]{2,80}\)\s*/gu, " ").trim();
  if (without !== value) variants.push(without);
  for (const match of value.matchAll(/\(([^)]{2,80})\)/gu)) {
    if (match[1]) variants.push(match[1]);
  }
  return variants;
}

function yearNeutralVariant(value: string) {
  return value
    .replace(/\s+(?:of\s+)?(?:18|19|20)\d{2}\s*$/iu, "")
    .replace(/\s*\((?:18|19|20)\d{2}\)\s*$/u, "")
    .replace(/\s*\((?:18|19|20)\d{2}\s*[–—-]\s*(?:18|19|20)?\d{2}\)\s*$/u, "")
    .trim();
}

function familyNeutralVariant(value: string) {
  return value.replace(/^\s*(?:u\.?s\.?\s+)?state[ -]level\s+/iu, "")
    .replace(/\s*\((?:18|19|20)\d{2}\s*[–—-]\s*(?:18|19|20)?\d{2}\)\s*$/u, "")
    .trim();
}

function distinctiveVariant(value: string) {
  const words = normalizePolicySearchText(value).split(" ").filter((word) =>
    word.length >= 3 && !GENERIC_POLICY_WORDS.has(word) &&
    !/^(?:18|19|20)\d{2}$/u.test(word)
  );
  return words.length >= 2 ? words.slice(0, 12).join(" ") : "";
}

export function policySearchQueryVariants(input: {
  name: string;
  aliases?: readonly string[];
  identifiers?: readonly string[];
  urls?: readonly string[];
  contextTerms?: readonly string[];
  maximum?: number;
}) {
  const maximum = Math.max(1, Math.min(16, input.maximum ?? 8));
  const variants: string[] = [];
  const seen = new Set<string>();
  const seeds = [
    input.name,
    ...(input.aliases ?? []),
    ...policySearchUrlCues(input.urls ?? []),
    ...(input.identifiers ?? []),
    ...(input.contextTerms ?? []),
  ];
  for (const seed of seeds) {
    addVariant(variants, seen, seed);
    for (const candidate of parentheticalVariants(clean(seed))) {
      addVariant(variants, seen, candidate);
    }
    addVariant(variants, seen, yearNeutralVariant(clean(seed)));
    addVariant(variants, seen, familyNeutralVariant(clean(seed)));
    addVariant(variants, seen, distinctiveVariant(seed));
    if (variants.length >= maximum) break;
  }
  return variants.slice(0, maximum);
}
