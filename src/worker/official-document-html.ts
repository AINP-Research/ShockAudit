import { normalizePolicyEvidenceText } from
  "../core/six-screen/policy-text-normalization";

/** Pure response projection. These helpers never grant source authority. */
export function decodeOfficialHtmlText(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
    lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
    laquo: "\u00ab", raquo: "\u00bb", copy: "\u00a9", reg: "\u00ae",
    trade: "\u2122", eacute: "\u00e9", Eacute: "\u00c9",
  };
  return value.replace(
    /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/gu,
    (entity, decimal: string | undefined, hex: string | undefined,
      name: string | undefined) => {
      if (name) return namedEntities[name] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hex ?? "", hex ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 &&
          codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : " ";
    },
  );
}

const OFFICIAL_HTML_MAX_TOKENS = 200_000;
const OFFICIAL_HTML_MAX_DEPTH = 256;
const OFFICIAL_HTML_MAX_TAG_LENGTH = 65_536;

const OFFICIAL_HTML_ALWAYS_HIDDEN = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "script",
  "style",
  "svg",
  "template",
]);

const OFFICIAL_HTML_VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);

type OfficialHtmlFrame = {
  tagName: string;
  hidden: boolean;
  emitted: boolean;
  contentModel: "normal" | "raw-text" | "rcdata" | "plaintext";
  scopeBoundary: boolean;
  link?: {
    href: string;
    text: string[];
  };
  title?: {
    tagName: "h1" | "h2" | "h3" | "title";
    text: string[];
  };
};

type OfficialHtmlProjection = {
  html: string[];
  text: string[];
  links: Array<{ href: string; label: string }>;
  titles: Array<{
    tagName: "h1" | "h2" | "h3" | "title";
    text: string;
  }>;
  metadata: Array<Record<string, string>>;
};

const OFFICIAL_HTML_RAW_TEXT_ELEMENTS = new Set([
  "iframe", "noembed", "noframes", "script", "style", "xmp",
]);
const OFFICIAL_HTML_RCDATA_ELEMENTS = new Set(["textarea", "title"]);
const OFFICIAL_HTML_SCOPE_BOUNDARIES = new Set([
  "noscript", "svg", "template",
]);

function officialHtmlTagEnd(html: string, start: number) {
  let quote = "";
  let awaitingAttributeValue = false;
  const limit = Math.min(html.length, start + OFFICIAL_HTML_MAX_TAG_LENGTH);
  for (let index = start + 1; index < limit; index += 1) {
    const character = html[index]!;
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (awaitingAttributeValue) {
      if (/\s/u.test(character)) continue;
      awaitingAttributeValue = false;
      if (character === '"' || character === "'") quote = character;
      continue;
    }
    if (character === "=") {
      awaitingAttributeValue = true;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function officialHtmlAttributes(openingTag: string) {
  const attributes = new Map<string, string>();
  let index = /^<\s*[a-z][\w:.-]*/iu.exec(openingTag)?.[0].length ?? 1;
  while (index < openingTag.length) {
    while (/\s/u.test(openingTag[index] ?? "")) index += 1;
    if (index >= openingTag.length || /[\/>]/u.test(openingTag[index]!)) break;
    const nameStart = index;
    while (index < openingTag.length &&
      !/[\s=\/>]/u.test(openingTag[index]!)) index += 1;
    const name = openingTag.slice(nameStart, index).toLocaleLowerCase("en-US");
    if (!name) {
      index += 1;
      continue;
    }
    while (/\s/u.test(openingTag[index] ?? "")) index += 1;
    let value = "";
    if (openingTag[index] === "=") {
      index += 1;
      while (/\s/u.test(openingTag[index] ?? "")) index += 1;
      const quote = openingTag[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < openingTag.length && openingTag[index] !== quote) {
          index += 1;
        }
        value = openingTag.slice(valueStart, index);
        if (openingTag[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < openingTag.length &&
          !/[\s>]/u.test(openingTag[index]!)) index += 1;
        value = openingTag.slice(valueStart, index).replace(/\/$/u, "");
      }
    }
    if (!attributes.has(name)) {
      attributes.set(name, decodeOfficialHtmlText(value).trim());
    }
  }
  return attributes;
}

function officialHtmlElementIsHidden(
  tagName: string,
  attributes: ReadonlyMap<string, string>,
) {
  if (OFFICIAL_HTML_ALWAYS_HIDDEN.has(tagName) || attributes.has("hidden")) {
    return true;
  }
  if (attributes.get("aria-hidden")?.toLocaleLowerCase("en-US") === "true") {
    return true;
  }
  const style = (attributes.get("style")?.toLocaleLowerCase("en-US") ?? "")
    .replace(/\/\*[\s\S]*?\*\//gu, "");
  if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!important)?\s*(?:;|$)/u.test(style)) {
    return true;
  }
  if ((tagName === "dialog" || tagName === "details") &&
    !attributes.has("open")) return true;
  return tagName === "input" &&
    attributes.get("type")?.toLocaleLowerCase("en-US") === "hidden";
}

function officialHtmlContentModel(tagName: string): OfficialHtmlFrame["contentModel"] {
  if (OFFICIAL_HTML_RAW_TEXT_ELEMENTS.has(tagName)) return "raw-text";
  if (OFFICIAL_HTML_RCDATA_ELEMENTS.has(tagName)) return "rcdata";
  if (tagName === "plaintext") return "plaintext";
  return "normal";
}

function appendOfficialHtmlVisibleText(
  projection: OfficialHtmlProjection,
  stack: readonly OfficialHtmlFrame[],
  value: string,
) {
  projection.text.push(value);
  for (const frame of stack) {
    frame.link?.text.push(value);
    frame.title?.text.push(value);
  }
}

function finishOfficialHtmlFrame(
  projection: OfficialHtmlProjection,
  frame: OfficialHtmlFrame,
) {
  if (!frame.emitted) return;
  if (frame.link) projection.links.push({
    href: frame.link.href,
    label: decodeOfficialHtmlText(frame.link.text.join(" "))
      .replace(/\s+/gu, " ")
      .trim(),
  });
  if (frame.title) projection.titles.push({
    tagName: frame.title.tagName,
    text: decodeOfficialHtmlText(frame.title.text.join(" "))
      .replace(/\s+/gu, " ")
      .trim(),
  });
}

function officialHtmlRawClosing(
  html: string,
  lowerHtml: string,
  start: number,
  tagName: string,
) {
  const needle = `</${tagName}`;
  let candidate = lowerHtml.indexOf(needle, start);
  while (candidate >= 0) {
    const boundary = html[candidate + needle.length] ?? "";
    if (!boundary || /[\s/>]/u.test(boundary)) {
      const end = officialHtmlTagEnd(html, candidate);
      return end < 0 ? null : { start: candidate, end };
    }
    candidate = lowerHtml.indexOf(needle, candidate + needle.length);
  }
  return null;
}

function projectVisibleOfficialDocumentHtml(html: string) {
  const projection: OfficialHtmlProjection = {
    html: [],
    text: [],
    links: [],
    titles: [],
    metadata: [],
  };
  const lowerHtml = html.toLocaleLowerCase("en-US");
  const stack: OfficialHtmlFrame[] = [];
  let hiddenDepth = 0;
  let cursor = 0;
  let tokens = 0;
  while (cursor < html.length && tokens < OFFICIAL_HTML_MAX_TOKENS) {
    const rawFrame = stack.at(-1);
    if (rawFrame && rawFrame.contentModel !== "normal") {
      if (rawFrame.contentModel === "plaintext") {
        if (hiddenDepth === 0) {
          const tail = html.slice(cursor);
          projection.html.push(tail);
          appendOfficialHtmlVisibleText(projection, stack, tail);
        }
        cursor = html.length;
        break;
      }
      const closing = officialHtmlRawClosing(
        html,
        lowerHtml,
        cursor,
        rawFrame.tagName,
      );
      const contentEnd = closing?.start ?? html.length;
      if (hiddenDepth === 0 && contentEnd > cursor) {
        const content = html.slice(cursor, contentEnd);
        projection.html.push(content);
        appendOfficialHtmlVisibleText(projection, stack, content);
      }
      if (!closing) break;
      if (rawFrame.emitted && hiddenDepth === 0) {
        projection.html.push(html.slice(closing.start, closing.end + 1));
        appendOfficialHtmlVisibleText(projection, stack, " ");
      }
      if (rawFrame.hidden) hiddenDepth -= 1;
      finishOfficialHtmlFrame(projection, rawFrame);
      stack.pop();
      cursor = closing.end + 1;
      tokens += 1;
      continue;
    }

    const opening = html.indexOf("<", cursor);
    if (opening < 0) {
      if (hiddenDepth === 0) {
        const tail = html.slice(cursor);
        projection.html.push(tail);
        appendOfficialHtmlVisibleText(projection, stack, tail);
      }
      break;
    }
    if (opening > cursor && hiddenDepth === 0) {
      const content = html.slice(cursor, opening);
      projection.html.push(content);
      appendOfficialHtmlVisibleText(projection, stack, content);
    }
    if (html.startsWith("<!--", opening)) {
      const end = html.indexOf("-->", opening + 4);
      if (end < 0) break;
      if (hiddenDepth === 0) appendOfficialHtmlVisibleText(projection, stack, " ");
      cursor = end + 3;
      tokens += 1;
      continue;
    }
    const end = officialHtmlTagEnd(html, opening);
    if (end < 0) break;
    const token = html.slice(opening, end + 1);
    const closing = /^<\s*\/\s*([a-z][\w:.-]*)/iu.exec(token);
    if (closing) {
      const tagName = closing[1]!.toLocaleLowerCase("en-US");
      let frameIndex = stack.length - 1;
      while (frameIndex >= 0 && stack[frameIndex]!.tagName !== tagName) {
        if (stack[frameIndex]!.scopeBoundary) {
          frameIndex = -1;
          break;
        }
        frameIndex -= 1;
      }
      if (frameIndex >= 0) {
        const frame = stack[frameIndex]!;
        for (let index = stack.length - 1; index >= frameIndex; index -= 1) {
          const removed = stack[index]!;
          if (removed.hidden) hiddenDepth -= 1;
          finishOfficialHtmlFrame(projection, removed);
        }
        stack.length = frameIndex;
        if (frame.emitted && hiddenDepth === 0) {
          projection.html.push(token);
          appendOfficialHtmlVisibleText(projection, stack, " ");
        }
      }
      cursor = end + 1;
      tokens += 1;
      continue;
    }
    const start = /^<\s*([a-z][\w:.-]*)/iu.exec(token);
    if (!start) {
      // Declarations and processing instructions carry no visible source text.
      // A literal less-than sign that is not tag-shaped remains ordinary text.
      if (hiddenDepth === 0) {
        if (!/^<\s*[!?]/u.test(token)) {
          projection.html.push(token);
          appendOfficialHtmlVisibleText(projection, stack, token);
        } else {
          appendOfficialHtmlVisibleText(projection, stack, " ");
        }
      }
      cursor = end + 1;
      tokens += 1;
      continue;
    }
    const tagName = start[1]!.toLocaleLowerCase("en-US");
    const attributes = officialHtmlAttributes(token);
    const hidden = officialHtmlElementIsHidden(tagName, attributes);
    const emitted = hiddenDepth === 0 && !hidden;
    if (emitted && tagName === "meta" && stack.some((frame) =>
      frame.tagName === "head" && frame.emitted
    )) {
      projection.metadata.push(Object.fromEntries(attributes));
    }
    // In HTML, a trailing slash does not close ordinary elements (`<div/>`).
    // Treating it as closed could expose the tail of `<div hidden/>...`.
    const selfClosing = OFFICIAL_HTML_VOID_ELEMENTS.has(tagName) ||
      (tagName === "svg" && /\/\s*>$/u.test(token));
    if (emitted) projection.html.push(token);
    if (hiddenDepth === 0) appendOfficialHtmlVisibleText(projection, stack, " ");
    if (!selfClosing) {
      if (stack.length >= OFFICIAL_HTML_MAX_DEPTH) break;
      stack.push({
        tagName,
        hidden,
        emitted,
        contentModel: officialHtmlContentModel(tagName),
        scopeBoundary: OFFICIAL_HTML_SCOPE_BOUNDARIES.has(tagName),
        ...(emitted && tagName === "a" && attributes.get("href")
          ? { link: { href: attributes.get("href")!, text: [] } }
          : {}),
        ...(emitted &&
            (tagName === "h1" || tagName === "h2" || tagName === "h3" ||
              tagName === "title")
          ? { title: { tagName, text: [] } }
          : {}),
      });
      if (hidden) hiddenDepth += 1;
    }
    cursor = end + 1;
    tokens += 1;
  }
  return projection;
}

/**
 * Removes markup that is not visibly presented by the source. The bounded
 * tokenizer keeps a visibility stack instead of pairing tags with a regular
 * expression, so nested same-name containers cannot expose an outer hidden
 * tail. Malformed or pathologically deep/token-heavy tails fail closed.
 */
export function stripNonVisibleOfficialDocumentHtml(html: string) {
  return projectVisibleOfficialDocumentHtml(html).html.join("");
}

export function visibleOfficialDocumentText(html: string) {
  // HTML source formatting is not document structure: indentation and line
  // wrapping around otherwise inline elements must not become sentence
  // boundaries for evidence grounding. Collapse it first. If the visible
  // page contains escaped USLM/Akoma Ntoso, the shared legal normalizer will
  // decode that markup and reconstruct its genuine structural boundaries.
  const visibleText = decodeOfficialHtmlText(
    projectVisibleOfficialDocumentHtml(html).text.join(" "),
  ).replace(/\s+/gu, " ").trim();
  return normalizePolicyEvidenceText(visibleText);
}

/** Links whose elements and labels survived the same visibility projection. */
export function visibleOfficialDocumentLinks(html: string) {
  return projectVisibleOfficialDocumentHtml(html).links;
}

/** Structurally parsed visible H1s first, followed by document titles. */
export function visibleOfficialDocumentTitles(html: string) {
  const titles = projectVisibleOfficialDocumentHtml(html).titles;
  return ["h1", "title"].flatMap((tagName) =>
    titles.flatMap((title) =>
      title.tagName === tagName && title.text.length >= 4
        ? [title.text]
        : []
    )
  );
}

/** Visible document headings for source-own identity ambiguity checks. */
export function visibleOfficialDocumentHeadings(html: string) {
  const titles = projectVisibleOfficialDocumentHtml(html).titles;
  return ["h1", "h2", "h3", "title"].flatMap((tagName) =>
    titles.flatMap((title) =>
      title.tagName === tagName && title.text.length >= 4
        ? [title.text]
        : []
    )
  );
}

/** Actual tokenizer-observed meta elements outside hidden/raw-text scopes. */
export function visibleOfficialDocumentMetadata(html: string) {
  return projectVisibleOfficialDocumentHtml(html).metadata;
}

export function officialDocumentElementHtml(html: string, pattern: RegExp) {
  const opening = pattern.exec(html);
  if (!opening) return null;
  const tag = /^<(\w+)/u.exec(opening[0])![1]!;
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, "giu");
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  let closing: RegExpExecArray | null;
  while ((closing = tags.exec(html))) {
    depth += closing[0].startsWith("</") ? -1 : /\/\s*>$/u.test(closing[0]) ? 0 : 1;
    if (depth === 0) return html.slice(opening.index, closing.index + closing[0].length);
  }
  return null;
}

export function primaryOfficialDocumentHtml(html: string) {
  html = stripNonVisibleOfficialDocumentHtml(html);
  for (const pattern of [
    /<div\b[^>]*class=["'][^"']*\beli-container\b[^"']*["'][^>]*>/iu,
    /<article\b[^>]*>/iu,
    /<main\b[^>]*>/iu,
  ]) {
    const container = officialDocumentElementHtml(html, pattern);
    if (container) return container;
  }
  return html;
}

/** Detect a returned access-control interstitial before it can become evidence. */
export function officialDocumentAccessChallenge(html: string) {
  const prefix = html.slice(0, 120_000);
  const visible = visibleOfficialDocumentText(prefix)
    .slice(0, 30_000)
    .toLocaleLowerCase("en-US");
  const infrastructureMarker =
    /\b(?:cf-chl-|challenge-platform|px-captcha|g-recaptcha|hcaptcha|akamai bot manager)\b/iu
      .test(prefix);
  const humanCheck =
    /\b(?:verify (?:that )?you(?:'re| are) (?:a )?(?:human|not a robot)|are you (?:a )?human|unusual traffic|enable javascript and cookies|javascript is disabled)\b/iu
      .test(visible);
  const interstitialTitle =
    /\b(?:just a moment|access denied|security check|robot or human)\b/iu
      .test(visible.slice(0, 1_500));
  const deniedReference =
    /\b(?:reference (?:number|#)|request (?:was )?rejected|permission to access)\b/iu
      .test(visible);
  return (infrastructureMarker && humanCheck) ||
    (interstitialTitle && (humanCheck || deniedReference));
}

function documentAttributes(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/gu)]
    .map((match) => [match[1]!.toLowerCase(), decodeOfficialHtmlText(match[3]!).trim()]));
}

export function eurLexLocatorRecordId(locator: string) {
  try {
    const url = new URL(locator);
    if (url.protocol !== "https:" || url.hostname !== "eur-lex.europa.eu") return null;
    const uris = [...new Set(url.searchParams.getAll("uri"))];
    if (uris.length > 1) return null;
    const celex = /^CELEX:(3\d{4}[RLD]\d{4})$/iu.exec(uris[0] ?? "");
    const eli = /^\/eli\/(reg|dir|dec)\/(\d{4})\/(\d{1,4})\/oj(?:\/(?:eng|en))?\/?$/iu.exec(url.pathname);
    // This is only a requested-record comparison key, never a source fact or citation.
    const eliId = eli ? `3${eli[2]}${({ reg: "R", dir: "L", dec: "D" } as Record<string, string>)[eli[1]!.toLowerCase()]}${eli[3]!.padStart(4, "0")}` : null;
    const celexId = celex?.[1]?.toUpperCase();
    if ((uris.length && !celexId) || (url.pathname.startsWith("/eli/") && !eliId) || (celexId && eliId && celexId !== eliId)) return null;
    return celexId ?? eliId;
  } catch { return null; }
}

export function euPublicationsLocatorRecordId(locator: string) {
  try {
    const url = new URL(locator);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "publications.europa.eu" ||
      url.search ||
      url.hash
    ) return null;
    const match = /^\/resource\/celex\/(3\d{4}[RLD]\d{4})(?:\.([A-Z]{3}))?\/?$/iu
      .exec(url.pathname);
    const language = match?.[2]?.toUpperCase();
    if (language && !Object.values(EU_DOCUMENT_LANGUAGE_CODES).includes(language)) {
      return null;
    }
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

function ukLegislationLocatorCoordinate(locator: string) {
  try {
    const url = new URL(locator);
    if (
      url.protocol !== "https:" ||
      !["legislation.gov.uk", "www.legislation.gov.uk"].includes(
        url.hostname.toLocaleLowerCase("en-US"),
      ) ||
      url.username ||
      url.password ||
      url.port
    ) return null;
    const match = /^\/([a-z][a-z0-9-]{1,31})\/(\d{1,4})\/(\d{1,8})(?:\/|$)/iu
      .exec(url.pathname);
    return match
      ? {
          recordId: `${match[1]!.toLocaleLowerCase("en-US")}/${match[2]}/${match[3]}`,
          year: match[2]!,
        }
      : null;
  } catch {
    return null;
  }
}

export function ukLegislationLocatorRecordId(locator: string) {
  return ukLegislationLocatorCoordinate(locator)?.recordId ?? null;
}

export function euOfficialDocumentRecordId(locator: string) {
  return eurLexLocatorRecordId(locator) ?? euPublicationsLocatorRecordId(locator);
}

const EU_DOCUMENT_LANGUAGE_CODES: Record<string, string> = {
  bg: "BUL", hr: "HRV", cs: "CES", da: "DAN", nl: "NLD", en: "ENG",
  et: "EST", fi: "FIN", fr: "FRA", de: "DEU", el: "ELL", hu: "HUN",
  ga: "GLE", it: "ITA", lv: "LAV", lt: "LIT", mt: "MLT", pl: "POL",
  pt: "POR", ro: "RON", sk: "SLK", sl: "SLV", es: "SPA", sv: "SWE",
};

function exactEuDocumentCoordinate(locator: string) {
  try {
    const url = new URL(locator);
    const publicationsId = euPublicationsLocatorRecordId(locator);
    if (publicationsId) {
      const cellarLanguage =
        /\.([A-Z]{3})\/?$/iu.exec(url.pathname)?.[1]?.toUpperCase() ?? "ENG";
      const language = Object.entries(EU_DOCUMENT_LANGUAGE_CODES)
        .find(([, value]) => value === cellarLanguage)?.[0];
      return language
        ? { recordId: publicationsId, language, cellarLanguage }
        : null;
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "eur-lex.europa.eu" ||
      url.hash
    ) return null;
    const eli = /^\/eli\/(?:reg|dir|dec)\/\d{4}\/\d{1,4}\/oj(?:\/(eng|en))?\/?$/iu
      .exec(url.pathname);
    if (eli && !url.search) {
      return {
        recordId: eurLexLocatorRecordId(locator)!,
        language: "en",
        cellarLanguage: "ENG",
      };
    }
    const content = /^\/legal-content\/([a-z]{2})\/TXT(?:\/(?:HTML|PDF|XML))?\/?$/iu
      .exec(url.pathname);
    const parameters = [...url.searchParams.keys()];
    if (!content || parameters.length !== 1 || parameters[0] !== "uri") return null;
    const recordId = eurLexLocatorRecordId(locator);
    const language = content[1]!.toLowerCase();
    const cellarLanguage = EU_DOCUMENT_LANGUAGE_CODES[language];
    return recordId && cellarLanguage
      ? { recordId, language, cellarLanguage }
      : null;
  } catch {
    return null;
  }
}

/**
 * Derive only exact-record official representations. These are fallback
 * retrieval targets for a CELEX identity already present in the selected
 * source; they never perform free-title discovery.
 */
export function euOfficialDocumentRepresentationLocators(locator: string) {
  const coordinate = exactEuDocumentCoordinate(locator);
  if (!coordinate) return [locator];
  const eurLexHtml = new URL(
    `/legal-content/${coordinate.language.toUpperCase()}/TXT/HTML/`,
    "https://eur-lex.europa.eu",
  );
  eurLexHtml.searchParams.set("uri", `CELEX:${coordinate.recordId}`);
  const cellarXhtml =
    `https://publications.europa.eu/resource/celex/${coordinate.recordId}.${coordinate.cellarLanguage}`;
  const values = [locator, eurLexHtml.toString(), cellarXhtml];
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = (() => {
      try {
        const url = new URL(value);
        return `${url.origin.toLowerCase()}${url.pathname}|${
          [...url.searchParams.entries()].map(([name, item]) =>
            `${name}=${item}`).join("&")}`;
      } catch {
        return value;
      }
    })();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function eurLexDocumentMetadata(html: string) {
  return visibleOfficialDocumentMetadata(html);
}

function leadingEurLexIdentifier(title: string) {
  return /^(?:Regulation|Directive|Decision)\s*(?:\((?:EU|EC|EEC)\)\s*)?(?:No\.?\s*)?\d{4}\/\d{1,6}(?:\/(?:EU|EC|EEC))?\b/iu
    .exec(title)?.[0]?.replace(/\s+/gu, " ").trim();
}

function eurLexFormalIdentifierRecordId(formalIdentifier: string) {
  const formal = /^(Regulation|Directive|Decision)\s*(?:\((?:EU|EC|EEC)\)\s*)?(?:No\.?\s*)?(\d{4})\/(\d{1,6})(?:\/(?:EU|EC|EEC))?$/iu
    .exec(formalIdentifier);
  if (!formal) return null;
  return `3${formal[2]}${({
    regulation: "R",
    directive: "L",
    decision: "D",
  } as Record<string, string>)[formal[1]!.toLowerCase()]}${formal[3]!.padStart(4, "0")}`;
}

/**
 * Bind non-native HTML, XML, JSON, or plain-text representations by the first
 * visible EU instrument identifier. Native EUR-Lex/ELI metadata remains the
 * stronger identity path; this fallback admits no body whose leading
 * identifier names another record.
 */
export function leadingVisibleEuDocumentRecordId(body: string) {
  const visible = visibleOfficialDocumentText(body).slice(0, 20_000);
  const candidates: Array<{ index: number; recordId: string }> = [];
  for (const match of visible.matchAll(/\bCELEX\s*:?\s*(3\d{4}[RLD]\d{4})\b/giu)) {
    candidates.push({
      index: match.index,
      recordId: match[1]!.toUpperCase(),
    });
  }
  for (const match of visible.matchAll(
    /\b(?:Regulation|Directive|Decision)\s*(?:\((?:EU|EC|EEC)\)\s*)?(?:No\.?\s*)?\d{4}\/\d{1,6}(?:\/(?:EU|EC|EEC))?\b/giu,
  )) {
    const recordId = eurLexFormalIdentifierRecordId(match[0]);
    if (recordId) candidates.push({ index: match.index, recordId });
  }
  candidates.sort((left, right) => left.index - right.index);
  return candidates[0]?.recordId ?? null;
}

function eliMetadataCoordinate(value: string) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname !== "data.europa.eu" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) return null;
    const match = /^\/eli\/(reg|dir|dec)\/(\d{4})\/(\d{1,6})\/oj(?:\/([a-z]{2,3}))?\/?$/iu
      .exec(url.pathname);
    if (!match) return null;
    const kind = ({ reg: "R", dir: "L", dec: "D" } as Record<string, string>)[
      match[1]!.toLowerCase()
    ];
    const rawLanguage = match[4]?.toLowerCase() ?? "eng";
    const language = rawLanguage.length === 2
      ? EU_DOCUMENT_LANGUAGE_CODES[rawLanguage]
      : rawLanguage.toUpperCase();
    if (!kind || !language ||
      !Object.values(EU_DOCUMENT_LANGUAGE_CODES).includes(language)) return null;
    return {
      recordId: `3${match[2]}${kind}${match[3]!.padStart(4, "0")}`,
      language,
    };
  } catch {
    return null;
  }
}

/** Bind Publications Office converted XHTML to its exact requested CELEX ID. */
export function readEuPublicationsDocumentIdentity(
  html: string,
  locator: string,
) {
  const recordId = euPublicationsLocatorRecordId(locator);
  if (!recordId) return undefined;
  const primary = primaryOfficialDocumentHtml(html);
  const ownTitleOpenings = [...primary.matchAll(
    /<div\b[^>]*class=["'][^"']*\beli-main-title\b[^"']*["'][^>]*>/giu,
  )];
  if (ownTitleOpenings.length !== 1) return undefined;
  const ownTitle = officialDocumentElementHtml(
    primary,
    /<div\b[^>]*class=["'][^"']*\beli-main-title\b[^"']*["'][^>]*>/iu,
  );
  const title = ownTitle ? visibleOfficialDocumentText(ownTitle) : "";
  if (!title) return undefined;
  const formalIdentifier = leadingEurLexIdentifier(title);
  const metadata = eurLexDocumentMetadata(html);
  const nativeIds = [...new Set(metadata
    .filter((item) => item.name?.toLowerCase() === "wt.z_docid")
    .map((item) => item.content))];
  if (nativeIds.length !== 1 || nativeIds[0] !== recordId) return undefined;
  const requestedLanguage =
    /\.([A-Z]{3})\/?$/iu.exec(new URL(locator).pathname)?.[1]?.toUpperCase() ??
      "ENG";
  const nativeTitles = metadata
    .filter((item) => item.property?.toLowerCase() === "eli:title");
  const matchingTitles = nativeTitles.filter((item) => {
    const coordinate = eliMetadataCoordinate(item.about ?? "");
    return coordinate?.recordId === recordId &&
      coordinate.language === requestedLanguage;
  });
  const normalizeTitle = (value: string) => value.normalize("NFKC")
    .replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
  if (matchingTitles.length !== 1 ||
    normalizeTitle(matchingTitles[0]!.content) !== normalizeTitle(title)) {
    return undefined;
  }
  // English titles supply a second readable formal-identifier check. Other
  // official expressions are instead bound by the exact CELEX native field,
  // requested ISO-639-3 expression, ELI coordinate, and identical own title.
  if (requestedLanguage === "ENG" && (
    !formalIdentifier ||
    eurLexFormalIdentifierRecordId(formalIdentifier) !== recordId
  )) return undefined;
  return {
    recordId,
    title: title.slice(0, 1_600),
    formalIdentifier: formalIdentifier ?? recordId,
  };
}

/** Bind actual native fields and the document's own title to one requested record. */
export function readEurLexDocumentIdentity(html: string, locator: string) {
  const recordId = eurLexLocatorRecordId(locator);
  if (!recordId) return undefined;
  const metadata = eurLexDocumentMetadata(html);
  const ids = [...new Set(metadata.filter((item) => item.name?.toLowerCase() === "wt.z_docid")
    .map((item) => item.content))];
  if (ids.length !== 1 || ids[0] !== recordId) return undefined;
  const declaredLanguage = documentAttributes(/<html\b[^>]*>/iu.exec(html)?.[0] ?? "").lang?.toLowerCase();
  const requestLanguage = /\/legal-content\/([a-z]{2})\//iu.exec(new URL(locator).pathname)?.[1]?.toLowerCase();
  if (declaredLanguage && requestLanguage && declaredLanguage !== requestLanguage) return undefined;
  const language = requestLanguage ?? declaredLanguage;
  const titles = [...new Set(metadata.filter((item) => item.property?.toLowerCase() === "eli:title" &&
    (!language || item.lang?.toLowerCase() === language)).map((item) => item.content))];
  const metadataTitle = titles.length === 1 ? titles[0] : undefined;
  if (!metadataTitle) return undefined;
  const formalIdentifier = leadingEurLexIdentifier(metadataTitle);
  if (!formalIdentifier ||
    eurLexFormalIdentifierRecordId(formalIdentifier) !== recordId) return undefined;
  const primary = primaryOfficialDocumentHtml(html);
  const ownTitle = officialDocumentElementHtml(primary, /<div\b[^>]*class=["'][^"']*\beli-main-title\b[^"']*["'][^>]*>/iu);
  const title = ownTitle ? visibleOfficialDocumentText(ownTitle) : "";
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
  if (normalize(leadingEurLexIdentifier(title) ?? "") !== normalize(formalIdentifier!) || normalize(title) !== normalize(metadataTitle)) return undefined;
  return { recordId, title: title.slice(0, 500), formalIdentifier: formalIdentifier!, metadataTitle };
}

/**
 * Bind a legislation.gov.uk page to the exact record coordinate present in
 * both its requested and canonical locators, then require its native Dublin
 * Core title, year, document title, and own page heading to agree. Page-control
 * headings are deliberately excluded from this native identity projection.
 */
export function readUkLegislationDocumentIdentity(
  html: string,
  locator: string,
) {
  const requested = ukLegislationLocatorCoordinate(locator);
  if (!requested) return undefined;
  const head = officialDocumentElementHtml(html, /<head\b[^>]*>/iu);
  if (!head) return undefined;
  const canonicalLocators = [...head.matchAll(/<link\b[^>]*>/giu)]
    .flatMap((match) => {
      const attributes = officialHtmlAttributes(match[0]);
      const rel = attributes.get("rel")?.toLocaleLowerCase("en-US")
        .split(/\s+/u).filter(Boolean) ?? [];
      const href = attributes.get("href");
      if (!rel.includes("canonical") || !href) return [];
      try {
        return [new URL(href, locator).toString()];
      } catch {
        return [];
      }
    });
  if (canonicalLocators.length !== 1) return undefined;
  const canonical = ukLegislationLocatorCoordinate(canonicalLocators[0]!);
  if (!canonical || canonical.recordId !== requested.recordId) return undefined;

  const projection = projectVisibleOfficialDocumentHtml(html);
  const normalized = (value: string) => value.normalize("NFKC")
    .replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
  const metadataTitles = [...new Map(projection.metadata
    .filter((item) => item.name?.toLocaleLowerCase("en-US") === "dc.title")
    .map((item) => item.content ?? "")
    .filter(Boolean)
    .map((value) => [normalized(value), value])).values()];
  const metadataYears = [...new Set(projection.metadata
    .filter((item) =>
      item.name?.toLocaleLowerCase("en-US") === "legislation.year"
    )
    .map((item) => item.content ?? "")
    .filter(Boolean))];
  const pageTitles = [...new Map(projection.titles
    .filter((item) => item.tagName === "h1")
    .map((item) => item.text)
    .filter(Boolean)
    .map((value) => [normalized(value), value])).values()];
  const documentTitles = [...new Map(projection.titles
    .filter((item) => item.tagName === "title")
    .map((item) => item.text)
    .filter(Boolean)
    .map((value) => [normalized(value), value])).values()];
  if (
    metadataTitles.length !== 1 ||
    metadataYears.length !== 1 ||
    metadataYears[0] !== requested.year ||
    pageTitles.length !== 1 ||
    documentTitles.length !== 1
  ) return undefined;
  const title = metadataTitles[0]!;
  const titleKey = normalized(title);
  if (
    !titleKey ||
    normalized(pageTitles[0]!) !== titleKey ||
    normalized(documentTitles[0]!) !== titleKey
  ) return undefined;
  return {
    recordId: requested.recordId,
    title: title.slice(0, 500),
    formalIdentifier: requested.recordId,
  };
}

/** Native identity readers used by Screen 2 official overview retrieval. */
export function readScreen02OfficialDocumentIdentity(
  html: string,
  locator: string,
) {
  return readEurLexDocumentIdentity(html, locator) ??
    readUkLegislationDocumentIdentity(html, locator);
}
