const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodedEntity(entity: string) {
  const numeric = entity.startsWith("#x") || entity.startsWith("#X")
    ? Number.parseInt(entity.slice(2), 16)
    : entity.startsWith("#")
      ? Number.parseInt(entity.slice(1), 10)
      : Number.NaN;
  if (Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 0x10ffff &&
      !(numeric >= 0xd800 && numeric <= 0xdfff)) {
    return String.fromCodePoint(numeric);
  }
  return NAMED_ENTITIES[entity.toLocaleLowerCase("en-US")] ??
    `&${entity};`;
}

/** Removes actual markup, then decodes one safe entity layer for React text. */
export function sanitizeScreen5ProviderText(
  value: unknown,
  maximum: number,
) {
  if (typeof value !== "string" || value.length > maximum * 8) return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/<[^>]{0,500}>/gu, " ")
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/giu, (_match, entity) =>
      decodedEntity(entity))
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}
