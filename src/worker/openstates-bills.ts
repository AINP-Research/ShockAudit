import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { IdentityCandidateInput } from
  "../core/six-screen/workflow";
import { requireSanitizedSourceUrl, type TypedDate } from
  "../core/six-screen/contracts";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import { usStateForScreen02Geography, usStateNameForCode } from
  "./screen02-source-router";

export const OPENSTATES_BILL_ADAPTER_VERSION =
  "openstates-bill-search-v5" as const;

const OPENSTATES_BILLS_ENDPOINT = "https://v3.openstates.org/bills";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const BILL_IDENTIFIER =
  /\b(?:A|AB|ACR|AJR|AR|H|HB|HCR|HF|HJR|HR|S|SB|SCR|SF|SJR|SR|LB|LD)\s*-?\s*\d+[A-Z]?\b/iu;
const SPELLED_BILL_IDENTIFIER =
  /\b(assembly|house|legislative|senate)\s+(bill|concurrent resolution|document|file|joint resolution|resolution)\s+(?:(?:no\.?|number)\s*)?(\d+[A-Z]?)\b/iu;

type OpenStatesLink = { url: string; note?: string };
type OpenStatesBillAction = {
  id: string;
  description: string;
  date: string;
  classification: string[];
  order: number;
};
type OpenStatesBill = {
  id: string;
  session: string;
  jurisdiction: { id: string; name: string; classification: string };
  from_organization: { id: string; name: string; classification: string };
  identifier: string;
  title: string;
  classification?: string[];
  subject?: string[];
  openstates_url: string;
  first_action_date?: string;
  latest_action_date?: string;
  latest_action_description?: string;
  latest_passage_date?: string;
  abstracts?: Array<{ abstract: string; note: string }>;
  other_titles?: Array<{ title: string; note?: string }>;
  other_identifiers?: Array<{ identifier: string; scheme?: string }>;
  actions?: OpenStatesBillAction[];
  sources?: OpenStatesLink[];
  versions?: Array<{
    id: string;
    note: string;
    date: string;
    classification: string;
    links: OpenStatesLink[];
  }>;
  documents?: Array<{
    id: string;
    note: string;
    date: string;
    classification: string;
    links: OpenStatesLink[];
  }>;
};

export type OpenStatesBillSearchResult = {
  status: "searched" | "not_configured" | "source_unavailable";
  candidates: IdentityCandidateInput[];
  bills: OpenStatesBill[];
  requestUrl: string | null;
  limitation: string | null;
  usage: {
    sourceQueries: number;
    metadataRecords: number;
    documentAttempts: number;
    usefulDocuments: number;
    transportHops: number;
    receivedBytes: number;
    decodedBytes: number;
    activeResearchMs: number;
    cpuMs: number;
    providerCostUnits: Record<string, number>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validBill(value: unknown): value is OpenStatesBill {
  if (!isRecord(value) || typeof value.id !== "string" ||
      typeof value.session !== "string" ||
      typeof value.identifier !== "string" || typeof value.title !== "string" ||
      typeof value.openstates_url !== "string" ||
      !isRecord(value.jurisdiction) ||
      typeof value.jurisdiction.name !== "string" ||
      !isRecord(value.from_organization) ||
      typeof value.from_organization.name !== "string") return false;
  try {
    return new URL(value.openstates_url).protocol === "https:";
  } catch {
    return false;
  }
}

function validAction(value: unknown): value is OpenStatesBillAction {
  return isRecord(value) && typeof value.id === "string" &&
    typeof value.description === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(String(value.date)) &&
    Array.isArray(value.classification) &&
    value.classification.every((item) => typeof item === "string") &&
    Number.isFinite(value.order);
}

function billActions(bill: OpenStatesBill) {
  return Array.isArray(bill.actions) ? bill.actions.filter(validAction) : [];
}

function validLink(value: unknown): value is OpenStatesLink {
  return isRecord(value) && typeof value.url === "string" &&
    (value.note === undefined || typeof value.note === "string");
}

function linksFrom(value: unknown) {
  return Array.isArray(value) ? value.filter(validLink) : [];
}

function canonicalStateJurisdiction(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const code = trimmed.toUpperCase();
  if (code === "PR") return "Puerto Rico";
  if (/^[A-Z]{2}$/u.test(code)) return usStateNameForCode(code) ?? trimmed;
  return usStateForScreen02Geography(trimmed)?.name ?? trimmed;
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/gu, " ");
}

function exactBillIdentifier(value: string) {
  const spelled = SPELLED_BILL_IDENTIFIER.exec(value);
  if (spelled) {
    const chamber = spelled[1]!.toLocaleLowerCase("en-US");
    const instrument = spelled[2]!.toLocaleLowerCase("en-US");
    const code = chamber === "assembly"
      ? instrument === "joint resolution" ? "AJR"
        : instrument === "concurrent resolution" ? "ACR"
          : instrument === "resolution" ? "AR" : "AB"
      : chamber === "house"
        ? instrument === "joint resolution" ? "HJR"
          : instrument === "concurrent resolution" ? "HCR"
            : instrument === "resolution" ? "HR"
              : instrument === "file" ? "HF" : "HB"
        : chamber === "senate"
          ? instrument === "joint resolution" ? "SJR"
            : instrument === "concurrent resolution" ? "SCR"
              : instrument === "resolution" ? "SR"
                : instrument === "file" ? "SF" : "SB"
          : instrument === "document" ? "LD" : "LB";
    return `${code} ${spelled[3]!.toUpperCase()}`;
  }
  const match = BILL_IDENTIFIER.exec(value);
  if (!match) return null;
  return match[0].toUpperCase().replace(/\s*-\s*/u, " ")
    .replace(/([A-Z])(?=\d)/u, "$1 ").replace(/\s+/gu, " ").trim();
}

function billYearDistance(bill: OpenStatesBill, approximateYear: string) {
  const years = [bill.session, bill.first_action_date,
    bill.latest_action_date, ...billActions(bill).map(({ date }) => date)]
    .flatMap((value) => typeof value === "string"
      ? [...value.matchAll(/\b(?:18|19|20)\d{2}\b/gu)]
        .map((match) => Number(match[0]))
      : []);
  if (!years.length) return Number.POSITIVE_INFINITY;
  const requested = Number(approximateYear);
  return Math.min(...years.map((year) => Math.abs(year - requested)));
}

const BILL_QUERY_GENERIC_TERMS = new Set([
  "assembly", "bill", "house", "legislative", "number", "senate",
  "state", "states", "united",
]);

function billQueryRelevance(bill: OpenStatesBill, query: string) {
  const queryTerms = normalize(query).split(" ").filter((term) =>
    term.length >= 3 && !BILL_QUERY_GENERIC_TERMS.has(term) &&
    !/^\d+$/u.test(term)
  );
  const billText = normalize([
    bill.title,
    ...(bill.abstracts ?? []).map(({ abstract }) => abstract),
    ...(bill.other_titles ?? []).map(({ title }) => title),
    ...(bill.subject ?? []),
  ].join(" "));
  return queryTerms.reduce((score, term) =>
    score + (billText.split(" ").includes(term) ? 1 : 0), 0);
}

function safeHttps(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    // Provider locators sometimes carry a presentation-only fragment. The
    // workflow source contract intentionally rejects fragments, so retain the
    // canonical document URL rather than allowing one auxiliary locator to
    // invalidate an otherwise verified identity result.
    url.hash = "";
    return requireSanitizedSourceUrl(url.toString());
  } catch {
    return null;
  }
}

function actionKind(action: OpenStatesBillAction): TypedDate["kind"] {
  const text = normalize(`${action?.classification?.join(" ") ?? ""} ${action?.description ?? ""}`);
  if (/\b(?:became law|signed|enacted|chaptered)\b/u.test(text)) return "adoption";
  if (/\b(?:effective|takes effect|operative)\b/u.test(text)) return "legal_effect";
  if (/\b(?:vetoed|withdrawn|failed|died)\b/u.test(text)) return "other";
  if (/\b(?:introduced|filed|prefiled)\b/u.test(text)) return "initiation";
  if (/\b(?:passed|adopted|concurred)\b/u.test(text)) return "adoption";
  return "other";
}

function typedDates(bill: OpenStatesBill): TypedDate[] {
  const actions = billActions(bill)
    .sort((left, right) => left.date.localeCompare(right.date));
  const selected = [
    actions[0],
    ...actions.filter((action) => actionKind(action) === "adoption").slice(-1),
    actions.at(-1),
  ].filter((value, index, values): value is NonNullable<typeof value> =>
    Boolean(value) && values.findIndex((item) => item?.id === value?.id) === index
  );
  if (!selected.length && bill.first_action_date) {
    return [{
      start: bill.first_action_date,
      end: null,
      precision: "day",
      kind: "initiation",
      passageIds: [],
    }];
  }
  return selected.slice(0, 4).map((action) => ({
    start: action.date,
    end: null,
    precision: "day",
    kind: actionKind(action),
    passageIds: [],
  }));
}

function billStatus(bill: OpenStatesBill) {
  const actions = billActions(bill).sort((left, right) =>
    left.date.localeCompare(right.date) || left.order - right.order
  );
  const latest = actions.at(-1);
  const text = normalize(
    `${latest?.classification?.join(" ") ?? ""} ${latest?.description ?? bill.latest_action_description ?? ""}`,
  );
  if (/\b(?:became law|signed|enacted|chaptered)\b/u.test(text)) {
    return "enacted legislation";
  }
  if (/\b(?:vetoed|withdrawn|failed|died)\b/u.test(text)) {
    return "concluded legislative proposal";
  }
  if (/\b(?:passed|adopted|concurred)\b/u.test(text)) {
    return "passed legislative proposal";
  }
  return "legislative proposal";
}

function retainedSummary(bill: OpenStatesBill) {
  const abstracts = (Array.isArray(bill.abstracts) ? bill.abstracts : [])
    .flatMap((value) => isRecord(value) && typeof value.abstract === "string"
      ? [value.abstract] : [])
    .map((abstract) => abstract.trim())
    .filter(Boolean).slice(0, 2);
  const actions = billActions(bill)
    .sort((left, right) => left.date.localeCompare(right.date) ||
      left.order - right.order)
    .slice(-8)
    .map(({ date, description }) => `${date}: ${description}`);
  return [
    `${bill.identifier} — ${bill.title}`,
    ...abstracts,
    actions.length ? `Legislative history: ${actions.join("; ")}` : "",
  ].filter(Boolean).join("\n").slice(0, 12_000);
}

function candidateFromBill(
  bill: OpenStatesBill,
  retrievedAt: string,
  requestedJurisdiction: string | null,
  approximateYear: string | null,
): IdentityCandidateInput {
  const summary = retainedSummary(bill);
  const officialLinks = [
    ...linksFrom(bill.sources),
    ...(Array.isArray(bill.versions) ? bill.versions : [])
      .flatMap((value) => isRecord(value) ? linksFrom(value.links) : []),
    ...(Array.isArray(bill.documents) ? bill.documents : [])
      .flatMap((value) => isRecord(value) ? linksFrom(value.links) : []),
  ].flatMap(({ url, note }) => {
    const safe = safeHttps(url);
    return safe ? [{ url: safe, note }] : [];
  })
    .filter((entry, index, entries) =>
      entries.findIndex(({ url }) => url === entry.url) === index
    ).slice(0, 3);
  const billUuid = /^ocd-bill\/([0-9a-f-]{32,36})$/iu.exec(bill.id)?.[1];
  const apiLocator = billUuid
    ? `${OPENSTATES_BILLS_ENDPOINT}/ocd-bill/${encodeURIComponent(billUuid)}`
    : bill.openstates_url;
  const metadataSource = {
    id: `openstates-${fingerprintSixScreenValue(bill.id).slice(8)}`,
    title: `${bill.identifier} legislative metadata`,
    locator: apiLocator,
    publisher: "Open States",
    publishedDate: bill.latest_action_date || bill.first_action_date || null,
    authorityTier: "tier-2",
    retrievedAt,
    provider: "Open States API",
    nativeId: bill.id,
    routeId: "openstates_bill_search",
    routeVersion: OPENSTATES_BILL_ADAPTER_VERSION,
    accessStatus: "retained_passage" as const,
    inspectedText: "partial" as const,
    contentHash: fingerprintSixScreenValue(summary),
    retainedText: summary,
    limitation:
      "Open States supplies discovery metadata and legislative history. The linked legislature documents remain the controlling sources for legal effect and exact text.",
  };
  const officialSources = officialLinks.map(({ url, note }, index) => ({
    id: `openstates-official-${fingerprintSixScreenValue(`${bill.id}:${url}`).slice(8)}`,
    title: note?.trim() || `${bill.identifier} official legislature source ${index + 1}`,
    locator: url,
    publisher: bill.from_organization.name,
    publishedDate: null,
    authorityTier: "tier-1",
    retrievedAt,
    provider: "Official state legislature",
    nativeId: bill.identifier,
    routeId: "openstates_official_source_locator",
    routeVersion: OPENSTATES_BILL_ADAPTER_VERSION,
    accessStatus: "available_metadata" as const,
    inspectedText: "metadata_only" as const,
    contentHash: null,
    retainedText: null,
    limitation:
      "This official locator was reported by Open States and is retained for controlling-document review; its full text was not silently treated as inspected.",
  }));
  const aliases = [
    ...(Array.isArray(bill.other_titles) ? bill.other_titles : [])
      .flatMap((value) => isRecord(value) && typeof value.title === "string"
        ? [value.title] : []),
    ...(Array.isArray(bill.other_identifiers) ? bill.other_identifiers : [])
      .flatMap((value) => isRecord(value) && typeof value.identifier === "string"
        ? [value.identifier] : []),
  ].map((value) => value.trim()).filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);
  const dates = typedDates(bill);
  const requestedState = canonicalStateJurisdiction(requestedJurisdiction);
  const returnedState = canonicalStateJurisdiction(bill.jurisdiction.name);
  const jurisdictionMismatch = requestedState && returnedState &&
      normalize(requestedState) !== normalize(returnedState)
    ? [`Requested jurisdiction “${requestedJurisdiction}” differs from “${bill.jurisdiction.name}”.`]
    : [];
  const knownYears = [bill.session, bill.first_action_date,
    bill.latest_action_date, ...billActions(bill).map(({ date }) => date)]
    .filter((value): value is string => typeof value === "string");
  const yearMismatch = approximateYear &&
      !knownYears.some((value) => value.includes(approximateYear))
    ? [`The requested approximate year “${approximateYear}” differs from this bill's session and action dates; the year was treated as a clue, not a hard filter.`]
    : [];
  const description = (Array.isArray(bill.abstracts) ? bill.abstracts : [])
    .flatMap((value) => isRecord(value) && typeof value.abstract === "string"
      ? [value.abstract.trim()] : [])
    .find(Boolean) ?? bill.title;
  const identitySources = [metadataSource, ...officialSources];
  return {
    id: `identity-openstates-${fingerprintSixScreenValue(bill.id).slice(8)}`,
    officialTitle: bill.title.trim(),
    aliases,
    issuer: bill.from_organization.name.trim(),
    issuingJurisdiction: bill.jurisdiction.name.trim(),
    instrumentType: bill.classification?.join(", ") || "state legislation",
    formalIdentifiers: [bill.identifier, `Session ${bill.session}`],
    episode: billStatus(bill),
    versionScope:
      `Open States legislative record for session ${bill.session}; controlling text and legal effect require review of the linked official source.`,
    typedDates: dates,
    identitySourceIds: identitySources.map(({ id }) => id),
    sourceSnapshotId:
      `identity-source-openstates-${fingerprintSixScreenValue(bill.id).slice(8)}`,
    sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
    identitySources,
    displayedDescription: description.replace(/\s+/gu, " ").trim().slice(0, 1_200),
    matchExplanation:
      "The entered name, bill identifier, jurisdiction, and session matched an Open States legislative record. Study outcomes and proposed comparison groups were not used for ranking.",
    materialMismatches: [...jurisdictionMismatch, ...yearMismatch],
    retrievedAt,
  };
}

export async function searchOpenStatesBills(input: {
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  query: string;
  /** Ordered aliases from the shared entity-resolution layer. Later variants
   * run only when an earlier query returns no usable bill metadata. */
  queryVariants?: readonly string[];
  jurisdiction?: string | null;
  approximateYear?: string | null;
  retrievedAt: string;
  limit?: number;
  maximumRequests?: number;
  timeoutMs?: number;
  monotonicNow?: () => number;
}): Promise<OpenStatesBillSearchResult> {
  const emptyUsage = {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
    activeResearchMs: 0,
    cpuMs: 0,
    providerCostUnits: {} as Record<string, number>,
  };
  if (!input.apiKey?.trim()) {
    return {
      status: "not_configured",
      candidates: [],
      bills: [],
      requestUrl: null,
      limitation: "Open States is not configured.",
      usage: emptyUsage,
    };
  }
  const limit = Math.max(1, Math.min(10, input.limit ?? 6));
  const maximumRequests = Math.max(
    1,
    Math.min(9, input.maximumRequests ?? 9),
  );
  const approximateYear = /\b(?:18|19|20)\d{2}\b/u.exec(
    input.approximateYear?.trim() ?? "",
  )?.[0] ?? null;
  // Search a wider provider window than the visible result count. Popular
  // policy names often compete with newer bills containing the same words;
  // local jurisdiction/year reranking needs enough candidates to recover the
  // historically relevant measure.
  const retrievalLimit = 10;
  const jurisdiction = canonicalStateJurisdiction(input.jurisdiction);
  const queries = [...new Map([
    input.query,
    ...(input.queryVariants ?? []),
  ].map((value) => value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim().slice(0, 240))
    .filter(Boolean).map((value) => [normalize(value), value])).values()]
    .slice(0, 3);
  const requestUrl = (query: string, page: number) => {
    const url = new URL(OPENSTATES_BILLS_ENDPOINT);
    const identifier = exactBillIdentifier(query);
    // Open States v3 names this repeated array parameter `identifier`
    // (singular). `identifiers` is ignored by the provider, which otherwise
    // turns an exact bill-number lookup into a broad jurisdiction search.
    if (identifier) url.searchParams.append("identifier", identifier);
    else url.searchParams.set("q", query);
    if (jurisdiction) {
      url.searchParams.set("jurisdiction", jurisdiction.slice(0, 120));
    }
    // Session identifiers vary by legislature (for example, "2025-2026" or
    // "2025 Regular Session"). Treat the year as a ranking clue after
    // retrieval instead of sending it as an exact session filter.
    for (const include of ["abstracts", "other_titles", "other_identifiers",
      "actions", "sources", "documents", "versions"]) {
      url.searchParams.append("include", include);
    }
    url.searchParams.set("sort", identifier
      ? "latest_action_desc" : "updated_desc");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(retrievalLimit));
    return url;
  };

  const started = input.monotonicNow?.() ?? Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const discoveredBills: OpenStatesBill[] = [];
    let firstRequestUrl: string | null = null;
    let sourceQueries = 0;
    let metadataRecords = 0;
    let receivedBytes = 0;
    let successfulResponses = 0;
    let failedResponses = 0;
    let partialFailure: string | null = null;
    let requestBudgetExhausted = false;
    let matchedQuery = input.query;
    for (const query of queries) {
      const queryBills: OpenStatesBill[] = [];
      const exactIdentifier = exactBillIdentifier(query);
      for (let page = 1; page <= 3; page += 1) {
        if (sourceQueries >= maximumRequests) {
          requestBudgetExhausted = true;
          break;
        }
        const url = requestUrl(query, page);
        firstRequestUrl ??= url.toString();
        sourceQueries += 1;
        let response: Response;
        try {
          response = await input.fetch(url.toString(), {
            method: "GET",
            redirect: "manual",
            cache: "no-store",
            headers: {
              accept: "application/json",
              "x-api-key": input.apiKey.trim(),
            },
            signal: controller.signal,
          });
        } catch {
          failedResponses += 1;
          partialFailure =
            "One bounded Open States page could not be reached; retained results may be partial.";
          break;
        }
        if (!response.ok) {
          await response.body?.cancel("Open States response rejected")
            .catch(() => undefined);
          failedResponses += 1;
          partialFailure =
            `Open States returned HTTP ${response.status}; retained results may be partial.`;
          break;
        }
        let text: string;
        try {
          text = await readScreen02BoundedResponseText(
            response,
            MAX_RESPONSE_BYTES,
          );
        } catch {
          failedResponses += 1;
          partialFailure =
            "One Open States response exceeded or failed the bounded read; retained results may be partial.";
          break;
        }
        const bytes = new TextEncoder().encode(text).byteLength;
        receivedBytes += bytes;
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
        if (!isRecord(payload) || !Array.isArray(payload.results)) {
          failedResponses += 1;
          partialFailure =
            "Open States returned an invalid bill-search response; retained results may be partial.";
          break;
        }
        successfulResponses += 1;
        const pageBills = payload.results.filter(validBill)
          .slice(0, retrievalLimit);
        metadataRecords += pageBills.length;
        queryBills.push(...pageBills);
        const closestYear = approximateYear && queryBills.length
          ? Math.min(...queryBills.map((bill) =>
              billYearDistance(bill, approximateYear)))
          : null;
        const shouldReadOlderPage = Boolean(page < 3 && (
          (approximateYear && pageBills.length > 0 &&
            closestYear !== null && closestYear > 1) ||
          (exactIdentifier && pageBills.length === retrievalLimit)
        ));
        if (!shouldReadOlderPage) break;
      }
      if (queryBills.length) {
        discoveredBills.push(...queryBills);
        matchedQuery = query;
        break;
      }
      if (requestBudgetExhausted) break;
    }
    if (!successfulResponses && failedResponses) {
      return {
        status: "source_unavailable",
        candidates: [],
        bills: [],
        requestUrl: firstRequestUrl,
        limitation:
          "Open States could not complete any bounded bill-search request; this is not an empty search result.",
        usage: { ...emptyUsage, sourceQueries,
          transportHops: sourceQueries, receivedBytes,
          decodedBytes: receivedBytes,
          activeResearchMs: Math.max(0,
            (input.monotonicNow?.() ?? Date.now()) - started),
          providerCostUnits: { openstates: sourceQueries } },
      };
    }
    const uniqueBills = [...new Map(discoveredBills.map((bill) =>
      [bill.id, bill])).values()];
    const bills = uniqueBills.map((bill, index) => ({ bill, index }))
      .sort((left, right) => approximateYear
        ? billYearDistance(left.bill, approximateYear) -
            billYearDistance(right.bill, approximateYear) ||
          billQueryRelevance(right.bill, matchedQuery) -
            billQueryRelevance(left.bill, matchedQuery) ||
          left.index - right.index
        : exactBillIdentifier(matchedQuery)
          ? billQueryRelevance(right.bill, matchedQuery) -
              billQueryRelevance(left.bill, matchedQuery) ||
            left.index - right.index
          : left.index - right.index)
      .slice(0, limit)
      .map(({ bill }) => bill);
    return {
      status: "searched",
      candidates: bills.map((bill) => candidateFromBill(
        bill,
        input.retrievedAt,
        input.jurisdiction ?? null,
        input.approximateYear ?? null,
      )),
      bills,
      requestUrl: firstRequestUrl,
      limitation: partialFailure ?? (bills.length
        ? "Open States supplied discovery metadata and official legislature locators; Screen 2 must still establish controlling text, legal effect, and historical version."
        : null),
      usage: {
        ...emptyUsage,
        sourceQueries,
        metadataRecords,
        usefulDocuments: bills.length,
        transportHops: sourceQueries,
        receivedBytes,
        decodedBytes: receivedBytes,
        activeResearchMs: Math.max(0,
          (input.monotonicNow?.() ?? Date.now()) - started),
        providerCostUnits: { openstates: sourceQueries },
      },
    };
  } catch {
    const fallbackUrl = queries.length ? requestUrl(queries[0]!, 1).toString() : null;
    return {
      status: "source_unavailable",
      candidates: [],
      bills: [],
      requestUrl: fallbackUrl,
      limitation: "Open States could not be reached within the bounded search; this is not an empty result.",
      usage: { ...emptyUsage, sourceQueries: 1, transportHops: 1,
        activeResearchMs: Math.max(0, (input.monotonicNow?.() ?? Date.now()) - started) },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function openStatesSearchRequest(input: {
  query: string;
  jurisdiction?: string | null;
  limit?: number;
}) {
  const url = new URL(OPENSTATES_BILLS_ENDPOINT);
  const identifier = exactBillIdentifier(input.query);
  if (identifier) url.searchParams.append("identifier", identifier);
  else url.searchParams.set("q", input.query.trim().slice(0, 240));
  const jurisdiction = canonicalStateJurisdiction(input.jurisdiction);
  if (jurisdiction) url.searchParams.set("jurisdiction", jurisdiction.slice(0, 120));
  url.searchParams.set("per_page", String(Math.max(1, Math.min(10,
    input.limit ?? 1))));
  return url.toString();
}
