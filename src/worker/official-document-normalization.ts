import {
  assessPolicyTextQuality,
  looksLikeStructuredLegalMarkup,
  normalizePolicyEvidenceText,
  type PolicyTextQuality,
} from "../core/six-screen/policy-text-normalization";
import {
  primaryOfficialDocumentHtml,
  visibleOfficialDocumentText,
} from "./official-document-html";

export type NormalizedOfficialDocument = {
  representation: "html" | "xml" | "text";
  text: string;
  quality: PolicyTextQuality;
};

/**
 * One ingestion boundary for official documents. Format is sniffed from the
 * bytes as well as the server header because government endpoints sometimes
 * return USLM/XML as text/plain or omit the XML declaration. Escaped legal
 * markup exposed by an HTML page is normalized in a second bounded pass.
 */
export function normalizeOfficialDocumentPayload(input: {
  body: string;
  mediaType: string;
}): NormalizedOfficialDocument {
  const mediaType = input.mediaType.toLocaleLowerCase("en-US");
  const html = /(?:html|xhtml)/u.test(mediaType) ||
    /<!doctype\s+html\b|<html\b/iu.test(input.body.slice(0, 20_000));
  const structuredLegalMarkup = looksLikeStructuredLegalMarkup(input.body);
  const xml = !html && (
    /(?:xml|uslm|akn)/u.test(mediaType) ||
    /^\s*<\?xml\b/iu.test(input.body) ||
    structuredLegalMarkup
  );
  const representation = html ? "html" as const
    : xml ? "xml" as const
      : "text" as const;
  const visible = html
    ? visibleOfficialDocumentText(primaryOfficialDocumentHtml(input.body))
    : input.body;
  const text = normalizePolicyEvidenceText(visible);
  return { representation, text, quality: assessPolicyTextQuality(text) };
}
