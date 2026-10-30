import { visibleOfficialDocumentText } from "./official-document-html";

function identityLabelIsQualified(visibleText: string, index: number) {
  const prefix = visibleText.slice(Math.max(0, index - 100), index)
    .toLocaleLowerCase("en-US");
  return /(?:\brelated|\breferenced|\bbackground|\bprior|\bprevious|\bsuperseded|\bsee)\s*(?:material|document|record|notice|rule|,|:|-)?\s*$/iu
    .test(prefix);
}

/**
 * Return only document identifiers presented as the representation's own
 * Federal Register identity. Related and background citations cannot satisfy
 * the exact-record gate.
 */
export function federalRegisterOwnDocumentNumbers(body: string) {
  const visible = visibleOfficialDocumentText(body);
  const values = new Set<string>();
  for (const match of visible.matchAll(
    /\[\s*FR\s+Doc\.?\s+(\d{4}-\d{4,6})\s+Filed\b[^\]]{0,160}\]/giu,
  )) {
    if (!identityLabelIsQualified(visible, match.index ?? 0)) values.add(match[1]!);
  }
  for (const match of visible.matchAll(
    /\bDocument\s+(?:Number|No\.?)\s*:\s*(\d{4}-\d{4,6})\b/giu,
  )) {
    if (!identityLabelIsQualified(visible, match.index ?? 0)) values.add(match[1]!);
  }
  return [...values];
}
