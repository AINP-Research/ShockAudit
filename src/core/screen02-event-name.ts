const EVENT_NAME_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
]);

function normalizedEventTokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function withoutTrailingYear(tokens: readonly string[]) {
  if (!/^(?:19|20)\d{2}$/u.test(tokens.at(-1) ?? "")) return [...tokens];
  const withoutYear = tokens.slice(0, -1);
  return withoutYear.at(-1) === "of"
    ? withoutYear.slice(0, -1)
    : withoutYear;
}

function acronym(tokens: readonly string[]) {
  const meaningful = tokens.filter(
    (token) => !EVENT_NAME_STOP_WORDS.has(token) && !/^\d+$/u.test(token),
  );
  if (meaningful.length < 2 || meaningful.length > 12) return null;
  return meaningful.map((token) => token[0]).join("");
}

/**
 * Compatibility matcher for researcher-entered event wording.
 *
 * It uses the same transparent normalization for every event: punctuation and
 * accents are ignored, an optional trailing enactment year is removed, and a
 * bounded initialism may stand for a multi-word name. It contains no event
 * names, aliases, identifiers, jurisdictions, or expected titles.
 */
export function screen02EventWordingMatches(
  left: string,
  right: string,
) {
  const leftTokens = withoutTrailingYear(normalizedEventTokens(left));
  const rightTokens = withoutTrailingYear(normalizedEventTokens(right));
  const leftName = leftTokens.join(" ");
  const rightName = rightTokens.join(" ");
  if (!leftName || !rightName) return false;
  if (leftName === rightName) return true;

  const leftCompact = leftName.replaceAll(" ", "");
  const rightCompact = rightName.replaceAll(" ", "");
  const leftAcronym = acronym(leftTokens);
  const rightAcronym = acronym(rightTokens);
  return (
    leftAcronym !== null && leftAcronym === rightCompact ||
    rightAcronym !== null && rightAcronym === leftCompact
  );
}
