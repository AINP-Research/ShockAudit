const COMMON_ABBREVIATIONS = new Set([
  "art",
  "arts",
  "dept",
  "dr",
  "e.g",
  "etc",
  "fig",
  "i.e",
  "mr",
  "mrs",
  "ms",
  "no",
  "nos",
  "prof",
  "sec",
  "secs",
  "u.s",
  "v",
  "vs",
]);

const DANGLING_FINAL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "under",
  "upon",
  "which",
  "with",
]);

function normalizedText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function screen03ClaimToken(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function finalWord(value: string) {
  return screen03ClaimToken(
    value.replace(/[.!?]+["'\u2019\u201d)\]]*$/u, ""),
  ).split(" ").at(-1) ?? "";
}

/**
 * Screen 3 review values must read as complete claims, not arbitrary exact
 * substrings cut from a legal page. This remains an extractive gate: it never
 * adds or rewrites source text.
 */
export function screen03ExtractiveClaimIsComplete(value: string) {
  const clean = normalizedText(value);
  const tokens = screen03ClaimToken(clean).split(" ").filter(Boolean);
  const withoutOpeningQuote = clean.replace(/^["'\u2018\u201c([{]+\s*/u, "");
  const enumeratedOpening = /^(?:\([a-z0-9ivxlcdm]+\)|[a-z0-9ivxlcdm]+[.)])\s+/iu.test(
    withoutOpeningQuote,
  );
  const firstCasedLetter = withoutOpeningQuote.match(/\p{L}/u)?.[0] ?? "";
  if (
    clean.length < 12 ||
    tokens.length < 3 ||
    !/[\p{L}\p{N}]/u.test(clean) ||
    (!enumeratedOpening && firstCasedLetter !== firstCasedLetter.toLocaleUpperCase("en-US")) ||
    !/[.!?]+["'\u2019\u201d)\]]*$/u.test(clean) ||
    /^[,;:.!?)}\]\u2019\u201d]|^(?:['\u2019]s)\b/iu.test(clean) ||
    DANGLING_FINAL_WORDS.has(finalWord(clean))
  ) {
    return false;
  }
  return true;
}

function periodEndsSentence(text: string, index: number) {
  const before = text.slice(0, index + 1);
  const after = text.slice(index + 1);
  if (/\d\.$/u.test(before) && /^\d/u.test(after)) return false;

  const token = /([\p{L}.]+)\.$/u.exec(before)?.[1]?.toLocaleLowerCase("en-US") ?? "";
  if (COMMON_ABBREVIATIONS.has(token)) return false;
  if (/^(?:\p{L}\.){1,5}$/u.test(`${token}.`)) return false;

  return true;
}

export function screen03CharacterEndsSentence(text: string, index: number) {
  const character = text[index];
  return character === "!" || character === "?" ||
    (character === "." && periodEndsSentence(text, index));
}

/**
 * Segment normalized official text at real sentence boundaries and discard
 * incomplete leading/trailing window fragments. Semicolons deliberately stay
 * inside the sentence because statutory lists often contain dependent clauses.
 */
export function screen03CompleteExtractiveStatements(
  value: string,
  maximum = 24,
) {
  const text = normalizedText(value);
  const output: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!screen03CharacterEndsSentence(text, index)) {
      continue;
    }
    let end = index + 1;
    while (end < text.length && /[.!?"'\u2019\u201d)\]]/u.test(text[end]!)) {
      end += 1;
    }
    const statement = text.slice(start, end).trim();
    if (screen03ExtractiveClaimIsComplete(statement)) output.push(statement);
    if (output.length >= maximum) break;
    start = end;
    while (start < text.length && /\s/u.test(text[start]!)) start += 1;
    index = start - 1;
  }
  return output;
}

function wordBigrams(value: string) {
  const tokens = screen03ClaimToken(value).split(" ").filter(Boolean);
  if (tokens.length < 2) return new Set(tokens);
  return new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`));
}

const MATERIAL_NUMBER_WORDS = new Set([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "thousand",
  "million",
  "billion",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
]);

const MATERIAL_FREQUENCIES = new Map<string, string>([
  ["annual", "annual"],
  ["annually", "annual"],
  ["yearly", "annual"],
  ["semiannual", "semiannual"],
  ["semiannually", "semiannual"],
  ["biannual", "biannual"],
  ["biannually", "biannual"],
  ["biennial", "biennial"],
  ["biennially", "biennial"],
  ["quarterly", "quarterly"],
  ["monthly", "monthly"],
  ["weekly", "weekly"],
  ["daily", "daily"],
  ["hourly", "hourly"],
]);

const MATERIAL_NEGATIONS = new Set([
  "no",
  "not",
  "never",
  "neither",
  "nor",
  "without",
  "unless",
  "prohibit",
  "prohibited",
  "prohibits",
  "prohibiting",
  "forbid",
  "forbids",
  "forbidden",
  "excluding",
]);

const MATERIAL_SKELETON_OMISSIONS = new Set([
  ...MATERIAL_NUMBER_WORDS,
  ...MATERIAL_FREQUENCIES.keys(),
  ...MATERIAL_NEGATIONS,
  "a",
  "an",
  "the",
  "must",
  "shall",
  "may",
  "should",
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "quarter",
  "quarters",
  "year",
  "years",
]);

function distinctSorted(values: readonly string[]) {
  return [...new Set(values)].sort();
}

export function screen03ClaimMaterialProfile(value: string) {
  const tokens = screen03ClaimToken(value).split(" ").filter(Boolean);
  return {
    numbers: distinctSorted(tokens.filter((token) =>
      /^\d+$/u.test(token) || MATERIAL_NUMBER_WORDS.has(token)
    )),
    frequencies: distinctSorted(tokens.flatMap((token) => {
      const frequency = MATERIAL_FREQUENCIES.get(token);
      return frequency ? [frequency] : [];
    })),
    negated: tokens.some((token) => MATERIAL_NEGATIONS.has(token)),
  };
}

export function screen03ClaimsHaveMaterialDifference(
  left: string,
  right: string,
) {
  const leftProfile = screen03ClaimMaterialProfile(left);
  const rightProfile = screen03ClaimMaterialProfile(right);
  return leftProfile.negated !== rightProfile.negated ||
    leftProfile.numbers.join("\u0000") !== rightProfile.numbers.join("\u0000") ||
    leftProfile.frequencies.join("\u0000") !==
      rightProfile.frequencies.join("\u0000");
}

/**
 * Remove values that can vary materially while retaining the operative claim
 * skeleton used to compare whether two short claims concern the same fact.
 */
export function screen03MaterialInvariantClaimToken(value: string) {
  return screen03ClaimToken(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !/^\d+$/u.test(token))
    .filter((token) => !MATERIAL_SKELETON_OMISSIONS.has(token))
    .join(" ");
}

/** Conservative near-duplicate test: keep distinct duties with different verbs or objects. */
export function screen03ClaimsAreEquivalent(left: string, right: string) {
  const leftToken = screen03ClaimToken(left);
  const rightToken = screen03ClaimToken(right);
  if (leftToken === rightToken) return true;
  if (!leftToken || !rightToken) return false;
  if (screen03ClaimsHaveMaterialDifference(left, right)) return false;

  const leftWords = leftToken.split(" ");
  const rightWords = rightToken.split(" ");
  const shorter = leftWords.length <= rightWords.length ? leftWords : rightWords;
  const longer = leftWords.length <= rightWords.length ? rightWords : leftWords;
  if (
    shorter.length >= 8 &&
    shorter.length / longer.length >= 0.8 &&
    ` ${longer.join(" ")} `.includes(` ${shorter.join(" ")} `)
  ) {
    return true;
  }

  const leftBigrams = wordBigrams(left);
  const rightBigrams = wordBigrams(right);
  if (leftBigrams.size < 4 || rightBigrams.size < 4) return false;
  const overlap = [...leftBigrams].filter((bigram) => rightBigrams.has(bigram)).length;
  return overlap / Math.max(leftBigrams.size, rightBigrams.size) >= 0.9;
}

export function screen03ClaimQualityScore(value: string) {
  if (!screen03ExtractiveClaimIsComplete(value)) return -10_000;
  const tokenCount = screen03ClaimToken(value).split(" ").filter(Boolean).length;
  const conciseScore = tokenCount <= 45
    ? 180 - Math.abs(22 - tokenCount) * 2
    : 90 - (tokenCount - 45) * 3;
  return 1_000 + conciseScore;
}
