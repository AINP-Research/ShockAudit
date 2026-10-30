export type Screen02FormalIdentifierRelation =
  | "equivalent"
  | "compatible-partial"
  | "conflict"
  | "different";

export type Screen02FormalIdentifierFamily =
  | "bill"
  | "celex"
  | "european-instrument"
  | "federal-register"
  | "numbered-instrument"
  | "opaque"
  | "public-law";

export type Screen02FormalIdentifierIdentity = Readonly<{
  family: Screen02FormalIdentifierFamily;
  /** Shared coordinate before optional, identity-bearing qualifiers. */
  baseKey: string;
  /** Non-lossy canonical coordinate used only for exact deduplication. */
  exactKey: string;
  specificity: number;
  independentlyScoped: boolean;
  coordinates: Readonly<Record<string, string>>;
}>;

const GENERIC_UPPERCASE_IDENTIFIER_LABELS = new Set([
  "ACT",
  "BILL",
  "CODE",
  "DECREE",
  "DOC",
  "LAW",
  "NO",
  "NOTICE",
  "ORDER",
  "REF",
  "RULE",
  "STATE",
]);

function normalizeFormalIdentifierText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/(?<=\p{L})\.(?=\p{L})/gu, "")
    .replace(/&/gu, " and ")
    .replace(/[’']/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function identity(input: {
  family: Screen02FormalIdentifierFamily;
  baseKey: string;
  exactKey: string;
  independentlyScoped: boolean;
  coordinates?: Readonly<Record<string, string>>;
}): Screen02FormalIdentifierIdentity {
  const coordinates = input.coordinates ?? {};
  return {
    ...input,
    coordinates,
    specificity: Object.keys(coordinates).length,
  };
}

function parseCelex(normalized: string) {
  const match = /^(?:celex )?(\d{1,2}(?:18|19|20|21)\d{2}[a-z]\d{3,8})(?: (\d{2}))?$/u
    .exec(normalized);
  if (!match) return null;
  const record = match[1]!.toLocaleLowerCase("en-US");
  const suffix = match[2] ?? null;
  return identity({
    family: "celex",
    baseKey: `celex ${record}`,
    exactKey: [`celex`, record, suffix].filter(Boolean).join(" "),
    independentlyScoped: true,
    coordinates: suffix ? { suffix } : {},
  });
}

function billChamber(value: string) {
  if (value === "assembly" || value === "a") return "ab";
  if (value === "senate" || value === "s") return "sb";
  if (value === "house" || value === "h") return "hb";
  return value;
}

function parseBill(normalized: string) {
  const match = /^(?:california )?(?:(assembly|senate|house) bill|([ash])\s*b)\s*(?:no |number )?0*(\d{1,6})(?: (.+))?$/u
    .exec(normalized);
  if (!match) return null;
  const chamber = billChamber(match[1] ?? match[2] ?? "");
  const number = String(Number(match[3]));
  let tail = match[4]?.trim() ?? "";
  const coordinates: Record<string, string> = {};

  const consume = (
    pattern: RegExp,
    apply: (matched: RegExpExecArray) => void,
  ) => {
    const matched = pattern.exec(tail);
    if (!matched) return true;
    const after = tail.slice((matched.index ?? 0) + matched[0].length);
    if (pattern.exec(after)) return false;
    apply(matched);
    tail = `${tail.slice(0, matched.index ?? 0)} ${after}`
      .trim().replace(/\s+/gu, " ");
    return true;
  };

  if (!consume(
    /(?:^| )(?:chapter|ch) 0*(\d{1,6})(?= |$)/u,
    (chapter) => {
      coordinates.chapter = String(Number(chapter[1]));
    },
  )) return null;
  if (!consume(
    /(?:^| )(?:statutes|stats)(?: of)? ((?:18|19|20|21)\d{2})(?= |$)/u,
    (statutes) => {
      coordinates.statutesYear = statutes[1]!;
    },
  )) return null;
  if (!consume(
    /(?:^| )(?:session )?((?:18|19|20|21)\d{2}) ((?:18|19|20|21)\d{2}) (reg|regular|special|extraordinary)(?: sess| session)?(?= |$)/u,
    (session) => {
      coordinates.sessionStart = session[1]!;
      coordinates.sessionEnd = session[2]!;
      coordinates.sessionKind = session[3] === "reg"
        ? "regular"
        : session[3]!;
    },
  )) return null;
  if (tail && !/^(?:of|the)(?: (?:of|the))*$/u.test(tail)) return null;

  const baseKey = `${chamber} ${number}`;
  const exactKey = [
    baseKey,
    coordinates.sessionStart
      ? `session ${coordinates.sessionStart} ${coordinates.sessionEnd} ${coordinates.sessionKind}`
      : "",
    coordinates.chapter ? `chapter ${coordinates.chapter}` : "",
    coordinates.statutesYear ? `statutes ${coordinates.statutesYear}` : "",
  ].filter(Boolean).join(" ");
  return identity({
    family: "bill",
    baseKey,
    exactKey,
    independentlyScoped: false,
    coordinates: { chamber, number, ...coordinates },
  });
}

function parseEuropeanInstrument(normalized: string) {
  const tokens = normalized.split(" ").filter((token) =>
    token && token !== "no" && token !== "number"
  );
  const kinds = tokens.filter((token) =>
    ["decision", "directive", "regulation"].includes(token)
  );
  const namespaces = tokens.filter((token) =>
    ["ec", "eec", "eu", "uk"].includes(token)
  );
  const modifiers = tokens.filter((token) =>
    ["delegated", "implementing"].includes(token)
  );
  const commissionCount = tokens.filter((token) => token === "commission")
    .length;
  const numeric = tokens.filter((token) => /^\d{1,8}$/u.test(token));
  const knownCount = kinds.length + namespaces.length + modifiers.length +
    commissionCount + numeric.length;
  if (
    knownCount !== tokens.length || kinds.length > 1 ||
    namespaces.length > 1 || modifiers.length > 1 || commissionCount > 1 ||
    numeric.length !== 2 || (kinds.length === 0 && namespaces.length === 0) ||
    (modifiers.length > 0 && kinds.length === 0)
  ) return null;
  const yearPattern = /^(?:18|19|20|21)\d{2}$/u;
  const firstIsYear = yearPattern.test(numeric[0]!);
  const secondIsYear = yearPattern.test(numeric[1]!);
  if (!firstIsYear && !secondIsYear) return null;
  const year = firstIsYear ? numeric[0]! : numeric[1]!;
  const rawSerial = firstIsYear ? numeric[1]! : numeric[0]!;
  // EUR-Lex legal citations map to the four-character CELEX document-number
  // coordinate. Reject over-width input before numeric canonicalization so a
  // value such as 01234 cannot be shortened to 1234 and used as an exact key.
  if (rawSerial.length > 4) return null;
  const serial = String(Number(rawSerial));
  const kind = kinds[0] ?? null;
  const namespace = namespaces[0] ?? null;
  const modifier = modifiers[0] ?? null;
  const coordinates = Object.fromEntries([
    ["kind", kind],
    ["modifier", modifier],
    ["namespace", namespace],
    ["year", year],
    ["serial", serial],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])));
  const exactKey = [modifier, kind, namespace, year, serial]
    .filter(Boolean).join(" ");
  return identity({
    family: "european-instrument",
    baseKey: `european ${year} ${serial}`,
    exactKey,
    independentlyScoped: namespace !== null,
    coordinates,
  });
}

function parseFederalRegister(normalized: string) {
  const match = /^(?:(?:federal register)|(?:fr doc(?:ument)?)) (?:no |number )?(\d{4}) (\d{4,8})$/u
    .exec(normalized);
  if (!match) return null;
  const exactKey = `federal register ${match[1]} ${String(Number(match[2]))}`;
  return identity({
    family: "federal-register",
    baseKey: exactKey,
    exactKey,
    independentlyScoped: true,
    coordinates: { year: match[1]!, serial: String(Number(match[2])) },
  });
}

function parsePublicLaw(normalized: string) {
  const match = /^(?:public law|pub l)(?: no| number)? 0*(\d{1,3}) 0*(\d{1,5})$/u
    .exec(normalized);
  if (!match) return null;
  const exactKey = `public law ${Number(match[1])} ${Number(match[2])}`;
  return identity({
    family: "public-law",
    baseKey: exactKey,
    exactKey,
    independentlyScoped: true,
    coordinates: { congress: String(Number(match[1])), law: String(Number(match[2])) },
  });
}

function parseNumberedInstrument(normalized: string, raw: string) {
  const match = /^(act|decree|law|order|ordinance|regulation|rule)(?: no| number)?(?: ([a-z]{1,4}))? 0*(\d{1,6})(?:\s*((?:technical )?correction|corr|corrected|corrigendum|[a-z]|\d{1,16}))?$/u
    .exec(normalized);
  if (!match) return null;
  const kind = match[1]!;
  const namespace = match[2] ?? null;
  const number = String(Number(match[3]));
  const rawSuffix = match[4] ?? null;
  // A comma-delimited single letter is ordinarily the following prose article
  // (for example, "Order No. 84, a regulation"), not an identifier suffix.
  // Attached and whitespace-delimited suffix spellings remain identity-bearing.
  if (
    rawSuffix && /^[a-z]$/u.test(rawSuffix) &&
    /,\s*[a-z]\s*$/iu.test(raw)
  ) return null;
  if (
    namespace && ["ec", "eec", "eu", "uk"].includes(namespace) &&
    /^(?:18|19|20|21)\d{2}$/u.test(match[3]!) &&
    /^\d+$/u.test(rawSuffix ?? "")
  ) return null;
  // These are relationship/rendering labels, not a numbered-instrument
  // suffix. They preserve the established lineage aliases while alphanumeric
  // suffixes such as 84-A remain identity-bearing.
  const suffix = rawSuffix && [
      "corr",
      "corrected",
      "correction",
      "corrigendum",
      "technical correction",
    ].includes(rawSuffix)
    ? null
    : rawSuffix;
  const baseKey = [kind, namespace, number].filter(Boolean).join(" ");
  return identity({
    family: "numbered-instrument",
    baseKey,
    exactKey: [baseKey, suffix].filter(Boolean).join(" "),
    independentlyScoped: false,
    coordinates: Object.fromEntries([
      ["kind", kind],
      ["namespace", namespace],
      ["number", number],
      ["suffix", suffix],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))),
  });
}

export function parseScreen02FormalIdentifier(
  value: string | null | undefined,
): Screen02FormalIdentifierIdentity | null {
  const raw = String(value ?? "").normalize("NFKC").trim();
  const normalized = normalizeFormalIdentifierText(raw);
  if (!normalized) return null;
  const parsed = parseCelex(normalized) ??
    parseFederalRegister(normalized) ??
    parseBill(normalized) ??
    parseEuropeanInstrument(normalized) ??
    parsePublicLaw(normalized) ??
    parseNumberedInstrument(normalized, raw);
  if (parsed) return parsed;

  const namespace = [...raw.matchAll(
    /(?:^|[^\p{L}\p{N}])([A-Z][A-Z0-9]{1,3})[\s:/-]+(?:18|19|20|21)\d{2}[\s:/-]+\d{1,8}\b/gu,
  )].find((match) =>
    !GENERIC_UPPERCASE_IDENTIFIER_LABELS.has(match[1]!)
  );
  const normalizedNamespace =
    /^([a-z][a-z0-9]{1,3}) (?:18|19|20|21)\d{2} \d{1,8}$/u.exec(
      normalized,
    );
  return identity({
    family: "opaque",
    baseKey: normalized,
    exactKey: normalized,
    independentlyScoped: Boolean(namespace) || Boolean(
      normalizedNamespace &&
        !GENERIC_UPPERCASE_IDENTIFIER_LABELS.has(
          normalizedNamespace[1]!.toLocaleUpperCase("en-US"),
        ),
    ),
  });
}

function explicitCoordinateConflict(
  left: Screen02FormalIdentifierIdentity,
  right: Screen02FormalIdentifierIdentity,
  keys: readonly string[],
) {
  return keys.some((key) => {
    const leftValue = left.coordinates[key];
    const rightValue = right.coordinates[key];
    return Boolean(leftValue && rightValue && leftValue !== rightValue);
  });
}

function billYearFallsOutsideSession(
  year: string | undefined,
  sessionStart: string | undefined,
  sessionEnd: string | undefined,
) {
  if (!year || !sessionStart || !sessionEnd) return false;
  return Number(year) < Number(sessionStart) || Number(year) > Number(sessionEnd);
}

export function compareScreen02FormalIdentifiers(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
): Screen02FormalIdentifierRelation {
  const left = parseScreen02FormalIdentifier(leftValue);
  const right = parseScreen02FormalIdentifier(rightValue);
  if (!left || !right) return "different";
  if (left.exactKey === right.exactKey && left.family === right.family) {
    return "equivalent";
  }
  if (left.family !== right.family || left.baseKey !== right.baseKey) {
    return "different";
  }
  if (left.family === "european-instrument") {
    return explicitCoordinateConflict(left, right, [
        "kind",
        "modifier",
        "namespace",
      ])
      ? "conflict"
      : "compatible-partial";
  }
  if (left.family === "bill") {
    const conflicts = explicitCoordinateConflict(left, right, [
      "chapter",
      "sessionEnd",
      "sessionKind",
      "sessionStart",
      "statutesYear",
    ]) || billYearFallsOutsideSession(
      left.coordinates.statutesYear,
      right.coordinates.sessionStart,
      right.coordinates.sessionEnd,
    ) || billYearFallsOutsideSession(
      right.coordinates.statutesYear,
      left.coordinates.sessionStart,
      left.coordinates.sessionEnd,
    );
    return conflicts ? "conflict" : "compatible-partial";
  }
  // A missing suffix on a generic local instrument is not a safe alias:
  // Order 84 and Order 84-A identify distinct records.
  return "conflict";
}

export function canonicalScreen02FormalIdentifier(
  value: string | null | undefined,
) {
  return parseScreen02FormalIdentifier(value)?.exactKey ?? null;
}

export function isIndependentlyScopedScreen02FormalIdentifier(
  value: string | null | undefined,
) {
  return parseScreen02FormalIdentifier(value)?.independentlyScoped ?? false;
}
