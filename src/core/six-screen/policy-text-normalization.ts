/**
 * Provider-neutral legal-text normalization shared by source adapters,
 * evidence extraction, and the final presentation boundary.
 *
 * The parser is deliberately bounded and does not resolve DTDs or external
 * entities.  It recognizes structural legal markup while leaving ordinary
 * comparison signs and prose untouched.
 */

const MAX_MARKUP_TOKENS = 300_000;
const MAX_TAG_LENGTH = 65_536;

const LEGAL_MARKUP_NAMES = new Set([
  "act", "akomantoso", "article", "bill", "body", "chapter", "clause",
  "content", "document", "enum", "heading", "header", "law", "legislation",
  "level", "num", "paragraph", "p", "p1", "p2", "p3", "quoted-block",
  "quotedblock", "section", "subchapter", "subclause", "subparagraph",
  "subsection", "subtitle", "term", "text", "title",
]);

const BLOCK_NAMES = new Set([
  "act", "article", "bill", "body", "chapter", "clause", "content",
  "document", "heading", "header", "law", "legislation", "level",
  "paragraph", "p", "p1", "p2", "p3", "quoted-block", "quotedblock",
  "section", "subchapter", "subclause", "subparagraph", "subsection",
  "subtitle", "text", "title",
]);

const OMIT_NAMES = new Set([
  "metadata", "meta", "navigation", "script", "style", "svg", "template",
  "toc",
]);

const ENTITY_MAP: Readonly<Record<string, string>> = Object.freeze({
  amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
  sect: "\u00a7", para: "\u00b6", middot: "\u00b7",
});

export function decodePolicyTextEntities(value: string) {
  return value.replace(
    /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/gu,
    (entity, decimal: string | undefined, hex: string | undefined,
      name: string | undefined) => {
      if (name) return ENTITY_MAP[name] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hex ?? "", hex ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : " ";
    },
  );
}

function localName(value: string) {
  return value.toLocaleLowerCase("en-US").split(":").at(-1) ?? "";
}

function tagEnd(value: string, start: number) {
  let quote = "";
  const limit = Math.min(value.length, start + MAX_TAG_LENGTH);
  for (let index = start + 1; index < limit; index += 1) {
    const character = value[index]!;
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function structuralTagNames(value: string) {
  const names: string[] = [];
  const expression = /<\s*\/?\s*([A-Za-z][\w:.-]*)\b[^>]*>/gu;
  for (const match of value.slice(0, 100_000).matchAll(expression)) {
    const name = localName(match[1]!);
    if (LEGAL_MARKUP_NAMES.has(name)) names.push(name);
    if (names.length >= 4) break;
  }
  return names;
}

export function looksLikeStructuredLegalMarkup(value: string) {
  const prefix = value.slice(0, 20_000);
  if (/^\s*(?:<\?xml\b[^>]*>\s*)?<(?:[A-Za-z][\w.-]*:)?(?:act|akomaNtoso|bill|document|law|legislation|section)\b/iu
      .test(prefix)) return true;
  return structuralTagNames(value).length >= 3;
}

function appendBoundary(output: string[]) {
  const last = output.at(-1) ?? "";
  if (!last.endsWith("\n")) output.push("\n");
}

/** Convert XML-like legal structure into bounded readable text. */
export function projectStructuredLegalMarkup(value: string) {
  // External declarations are never resolved. Internal entity subsets are
  // rejected because their declaration syntax can otherwise leak into text;
  // ordinary government-document DOCTYPE declarations are simply skipped.
  if (/<!ENTITY\b|<!DOCTYPE\b[^>]{0,65536}\[/iu.test(value)) return "";
  const output: string[] = [];
  const stack: Array<{ name: string; omitted: boolean }> = [];
  let omittedDepth = 0;
  let cursor = 0;
  let tokens = 0;
  while (cursor < value.length && tokens < MAX_MARKUP_TOKENS) {
    const opening = value.indexOf("<", cursor);
    if (opening < 0) {
      if (omittedDepth === 0) output.push(value.slice(cursor));
      break;
    }
    if (opening > cursor && omittedDepth === 0) {
      output.push(value.slice(cursor, opening));
    }
    if (value.startsWith("<!--", opening)) {
      const end = value.indexOf("-->", opening + 4);
      if (end < 0) break;
      cursor = end + 3;
      tokens += 1;
      continue;
    }
    if (value.startsWith("<![CDATA[", opening)) {
      const end = value.indexOf("]]>", opening + 9);
      if (end < 0) break;
      if (omittedDepth === 0) output.push(value.slice(opening + 9, end));
      cursor = end + 3;
      tokens += 1;
      continue;
    }
    const end = tagEnd(value, opening);
    if (end < 0) {
      if (omittedDepth === 0) output.push(value.slice(opening));
      break;
    }
    const token = value.slice(opening, end + 1);
    if (/^<\s*[!?]/u.test(token)) {
      cursor = end + 1;
      tokens += 1;
      continue;
    }
    const closing = /^<\s*\/\s*([A-Za-z][\w:.-]*)/u.exec(token);
    if (closing) {
      const name = localName(closing[1]!);
      let index = stack.length - 1;
      while (index >= 0 && stack[index]!.name !== name) index -= 1;
      if (index >= 0) {
        for (let position = stack.length - 1; position >= index; position -= 1) {
          if (stack[position]!.omitted) omittedDepth -= 1;
        }
        stack.length = index;
      }
      if (omittedDepth === 0 && BLOCK_NAMES.has(name)) appendBoundary(output);
      cursor = end + 1;
      tokens += 1;
      continue;
    }
    const start = /^<\s*([A-Za-z][\w:.-]*)/u.exec(token);
    if (!start) {
      if (omittedDepth === 0) output.push(token);
      cursor = end + 1;
      tokens += 1;
      continue;
    }
    const name = localName(start[1]!);
    const omitted = OMIT_NAMES.has(name);
    const selfClosing = /\/\s*>$/u.test(token) ||
      ["br", "hr", "img", "input", "link"].includes(name);
    if (omittedDepth === 0 && !omitted && BLOCK_NAMES.has(name)) {
      appendBoundary(output);
    }
    if (!selfClosing) {
      stack.push({ name, omitted });
      if (omitted) omittedDepth += 1;
    }
    cursor = end + 1;
    tokens += 1;
  }
  return decodePolicyTextEntities(output.join(""));
}

function normalizeWhitespace(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ")
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/gu, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

const POLICY_PAGE_BOILERPLATE = [
  /\bdocument citations?\s+citations? are generated automatically from bibliographic data as a convenience and may not be complete or accurate\b/iu,
  /^(?:skip to main content|browse a to z|developer hub|search this site|share this page|download document|toggle navigation|menu|home)$/iu,
  /^(?:accessibility|contact us|copyright|foia|privacy policy|site map|website policies)(?:\s*[|·]\s*.*)?$/iu,
] as const;

/** True only for page furniture or bibliographic disclaimers, never legal text. */
export function isPolicyPageBoilerplateText(value: string) {
  const text = normalizeWhitespace(value);
  if (!text) return false;
  return POLICY_PAGE_BOILERPLATE.some((pattern) => pattern.test(text));
}

/**
 * Remove known provider furniture after HTML main-content selection. Exact
 * legal passages remain untouched; short navigation-only lines are dropped.
 */
export function removePolicyPageBoilerplate(value: string) {
  let text = value.replace(
    /\bdocument citations?\s+citations? are generated automatically from bibliographic data as a convenience and may not be complete or accurate\.?/giu,
    " ",
  );
  text = text.split(/\r?\n/u).filter((line) => {
    const normalized = normalizeWhitespace(line);
    return !normalized || normalized.length > 240 ||
      !isPolicyPageBoilerplateText(normalized);
  }).join("\n");
  return normalizeWhitespace(text);
}

/**
 * Normalize already-visible policy text and defensively unwrap escaped or
 * mislabelled legal markup. Two passes handle HTML pages that expose USLM as
 * escaped text without allowing unbounded recursive decoding.
 */
export function normalizePolicyEvidenceText(value: string) {
  let current = value.replace(/^\uFEFF/u, "");
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodePolicyTextEntities(current);
    if (!looksLikeStructuredLegalMarkup(decoded)) {
      current = decoded;
      const stillEscapedMarkup =
        /&(?:lt|#0*60|#x0*3c);\s*\/?\s*(?:[A-Za-z][\w.-]*:)?(?:act|bill|document|law|legislation|section|text)\b/iu
          .test(decoded);
      if (!stillEscapedMarkup) break;
      continue;
    }
    const projected = projectStructuredLegalMarkup(decoded);
    if (!projected) return "";
    current = projected;
  }
  return removePolicyPageBoilerplate(current);
}

export type PolicyTextQuality = {
  accepted: boolean;
  reason: "accepted" | "empty" | "markup_leak" | "replacement_characters" |
    "unreadable" | "pathological_segment";
  characterCount: number;
  replacementCharacterCount: number;
  longestSegment: number;
};

export function assessPolicyTextQuality(value: string): PolicyTextQuality {
  const text = normalizeWhitespace(value);
  const replacementCharacterCount = (text.match(/\ufffd/gu) ?? []).length;
  const escapedMarkup = /&(?:lt|#0*60|#x0*3c);\s*\/?\s*(?:[A-Za-z][\w.-]*:)?(?:section|subsection|paragraph|subparagraph|text|header|enum|quoted-block)\b/iu
    .test(text);
  const markupLeak = looksLikeStructuredLegalMarkup(text) || escapedMarkup;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const longestSegment = text.split(/\n|(?<=[.!?])\s+/u)
    .reduce((maximum, segment) => Math.max(maximum, segment.length), 0);
  const reason: PolicyTextQuality["reason"] = !text
    ? "empty"
    : markupLeak
      ? "markup_leak"
      : replacementCharacterCount > Math.max(2, Math.floor(text.length / 2_000))
        ? "replacement_characters"
        : letters < Math.min(40, Math.floor(text.length * 0.15))
          ? "unreadable"
          : longestSegment > 12_000
            ? "pathological_segment"
            : "accepted";
  return {
    accepted: reason === "accepted",
    reason,
    characterCount: text.length,
    replacementCharacterCount,
    longestSegment,
  };
}

