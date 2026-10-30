export const SCREEN_02_CONTEXT_OFFICIAL_BRIDGE_SCHEMA_VERSION =
  "screen-02-context-official-bridge-v1" as const;

/**
 * Machine-readable provenance for the one bounded transition from a
 * contextual title to an independently returned official record.
 */
export type Screen02ContextOfficialBridgeProvenance = {
  schemaVersion: typeof SCREEN_02_CONTEXT_OFFICIAL_BRIDGE_SCHEMA_VERSION;
  contextualLeadId: string;
  bridgeQueryId: string;
  formalIdentifier: string;
  returnedOfficialRecordIds: string[];
  status: "corroborated" | "no-corroboration" | "failed";
};

const SCREEN02_FEDERAL_REGISTER_DOCUMENT_NUMBER =
  /^(?:19|20)\d{2}-\d{4,6}$/u;
const SCREEN02_FEDERAL_REGISTER_DOCUMENT_NUMBER_IN_VISIBLE_TITLE =
  /\b(?:19|20)\d{2}-\d{4,6}\b/gu;

/**
 * Accept only the Federal Register's canonical ASCII document-number shape.
 * NFKC collapses harmless compatibility forms before the strict whole-value
 * check; whitespace, prefixes, suffixes, controls, and ambiguous prose remain
 * invalid.
 */
export function canonicalScreen02FederalRegisterFormalIdentifier(
  value: unknown,
) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC");
  return SCREEN02_FEDERAL_REGISTER_DOCUMENT_NUMBER.test(normalized)
    ? normalized
    : null;
}

/**
 * Extract exactly one unambiguous Federal Register document number from the
 * bounded visible title. No description, URL, publisher, or provider prose is
 * eligible to create this bridge.
 */
export function screen02VisibleTitleFederalRegisterIdentifier(title: string) {
  const normalized = title
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
  const matches = [
    ...normalized.matchAll(
      SCREEN02_FEDERAL_REGISTER_DOCUMENT_NUMBER_IN_VISIBLE_TITLE,
    ),
  ].map((match) => match[0]);
  const distinct = [...new Set(matches)];
  if (distinct.length !== 1) return null;
  return canonicalScreen02FederalRegisterFormalIdentifier(distinct[0]);
}

export function screen02FederalRegisterBridgeQueryMatchesIdentifier(
  query: unknown,
  formalIdentifier: unknown,
) {
  const canonical = canonicalScreen02FederalRegisterFormalIdentifier(
    formalIdentifier,
  );
  if (!canonical || typeof query !== "string") return false;
  try {
    const url = new URL(query);
    return url.protocol === "https:" &&
      url.hostname === "www.federalregister.gov" &&
      url.port === "" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname === "/api/v1/documents.json" &&
      url.searchParams.getAll("conditions[term]").length === 1 &&
      url.searchParams.get("conditions[term]") === canonical;
  } catch {
    return false;
  }
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maximum && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

export function isScreen02ContextOfficialBridgeProvenance(
  value: unknown,
): value is Screen02ContextOfficialBridgeProvenance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = [
    "schemaVersion",
    "contextualLeadId",
    "bridgeQueryId",
    "formalIdentifier",
    "returnedOfficialRecordIds",
    "status",
  ];
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(record, key))
  ) return false;
  if (
    record.schemaVersion !==
      SCREEN_02_CONTEXT_OFFICIAL_BRIDGE_SCHEMA_VERSION ||
    !boundedText(record.contextualLeadId, 200) ||
    !boundedText(record.bridgeQueryId, 200) ||
    canonicalScreen02FederalRegisterFormalIdentifier(
      record.formalIdentifier,
    ) !== record.formalIdentifier
  ) return false;
  if (
    !Array.isArray(record.returnedOfficialRecordIds) ||
    record.returnedOfficialRecordIds.length > 5 ||
    record.returnedOfficialRecordIds.some(
      (id) =>
        !boundedText(id, 200) ||
        canonicalScreen02FederalRegisterFormalIdentifier(id) !== id ||
        id !== record.formalIdentifier,
    ) ||
    new Set(record.returnedOfficialRecordIds).size !==
      record.returnedOfficialRecordIds.length
  ) return false;
  if (
    record.status !== "corroborated" &&
    record.status !== "no-corroboration" &&
    record.status !== "failed"
  ) return false;
  return record.status === "corroborated"
    ? record.returnedOfficialRecordIds.length === 1 &&
        record.returnedOfficialRecordIds[0] === record.formalIdentifier
    : record.returnedOfficialRecordIds.length === 0;
}
