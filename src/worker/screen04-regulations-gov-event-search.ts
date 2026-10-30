import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import {
  createCoEventCandidateOccurrence,
  type CoEventCandidateOccurrence,
} from "../core/six-screen/co-event-execution";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";

export const SCREEN04_REGULATIONS_GOV_EVENT_SEARCH_VERSION =
  "screen04-regulations-gov-event-search-v1" as const;
export const SCREEN04_REGULATIONS_GOV_PAGE_SIZE = 5;
export const SCREEN04_REGULATIONS_GOV_MAX_RESPONSE_BYTES = 512 * 1024;

const ENDPOINT = "https://api.regulations.gov/v4/documents";

type ParsedDocument = {
  id: string;
  title: string;
  documentType: string | null;
  docketId: string | null;
  agencyId: string | null;
  federalRegisterNumber: string | null;
  postedDate: string | null;
  effectiveDate: string | null;
  commentStartDate: string | null;
  commentEndDate: string | null;
  withdrawn: boolean | null;
};

export type Screen04RegulationsGovEventSearchResult = {
  status: "searched" | "not_configured" | "source_unavailable";
  candidates: CoEventCandidateOccurrence[];
  diagnostics: {
    provider: "regulations_gov";
    adapterVersion: typeof SCREEN04_REGULATIONS_GOV_EVENT_SEARCH_VERSION;
    requestUrl: string | null;
    recordsReceived: number;
    recordsAccepted: number;
    invalidRecordsDropped: number;
    outOfWindowRecordsDropped: number;
    limitation: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function calendarDate(value: unknown) {
  const date = boundedText(value, 40).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === date
    ? date : null;
}

function relationshipId(value: unknown, kind: string) {
  if (!isRecord(value) || !isRecord(value.relationships)) return null;
  const relationship = value.relationships[kind];
  if (!isRecord(relationship) || !isRecord(relationship.data)) return null;
  return boundedText(relationship.data.id, 100) || null;
}

function parsedDocument(value: unknown): ParsedDocument | null {
  if (!isRecord(value)) return null;
  const attributes = isRecord(value.attributes) ? value.attributes : {};
  const id = boundedText(value.id, 100);
  const title = boundedText(attributes.title, 1_000);
  if (!/^[A-Za-z0-9._-]{3,100}$/u.test(id) || !title) return null;
  const federalRegisterNumber = boundedText(
    attributes.frDocNum ?? attributes.frDocumentNumber,
    40,
  );
  return {
    id,
    title,
    documentType: boundedText(attributes.documentType, 120) || null,
    docketId: boundedText(attributes.docketId, 100) ||
      relationshipId(value, "docket"),
    agencyId: boundedText(attributes.agencyId, 100) ||
      relationshipId(value, "agency"),
    federalRegisterNumber:
      /^\d{4}-\d{4,6}$/u.test(federalRegisterNumber)
        ? federalRegisterNumber : null,
    postedDate: calendarDate(attributes.postedDate),
    effectiveDate: calendarDate(attributes.effectiveDate),
    commentStartDate: calendarDate(attributes.commentStartDate),
    commentEndDate: calendarDate(attributes.commentEndDate),
    withdrawn: typeof attributes.withdrawn === "boolean"
      ? attributes.withdrawn : null,
  };
}

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function publicConcept(value: string) {
  return value.normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/gu, " ").trim().slice(0, 300);
}

function occurrence(input: {
  document: ParsedDocument;
  retrievedAt: string;
}) {
  const document = input.document;
  const sourceCoordinate = fingerprintSixScreenValue({
    provider: "regulations_gov",
    documentId: document.id,
  }).slice("fnv1a64:".length);
  const sourceId = `regulations-${sourceCoordinate}`;
  const dates = [
    ...(document.effectiveDate ? [{
      kind: "effective" as const,
      value: document.effectiveDate,
      precision: "day" as const,
      sourceId,
    }] : []),
    ...(document.commentStartDate ? [{
      kind: "event" as const,
      value: document.commentStartDate,
      precision: "day" as const,
      sourceId,
    }] : []),
    ...(document.postedDate ? [{
      kind: "publication" as const,
      value: document.postedDate,
      precision: "day" as const,
      sourceId,
    }] : []),
  ];
  if (!dates.length) return null;
  const identifiers = [...new Set([
    document.id,
    document.docketId,
    document.federalRegisterNumber,
  ].filter((value): value is string => Boolean(value)))];
  const stages = [
    document.postedDate ? `posted ${document.postedDate}` : null,
    document.commentStartDate
      ? `comment period opened ${document.commentStartDate}` : null,
    document.commentEndDate
      ? `comment period closed ${document.commentEndDate}` : null,
    document.effectiveDate
      ? `provider-reported effective date ${document.effectiveDate}` : null,
    document.withdrawn === true ? "marked withdrawn" : null,
  ].filter((value): value is string => Boolean(value));
  const publisher = document.agencyId
    ? `${document.agencyId} via Regulations.gov`
    : "Regulations.gov";
  const description = [
    `Regulations.gov records this ${document.documentType ??
      "administrative document"}${document.docketId
      ? ` in docket ${document.docketId}` : ""}.`,
    stages.length ? `The returned administrative metadata reports ${
      stages.join(", ")}.` : "",
    "The metadata does not by itself establish the operative duty, covered firms, or treatment exposure.",
  ].filter(Boolean).join(" ");
  return createCoEventCandidateOccurrence({
    id: `coevent-regulations-${sourceCoordinate}`,
    providerId: "regulations_gov",
    sourceNativeId: document.id,
    title: document.title,
    description,
    eventFamily: /rule|regulation/iu.test(document.documentType ?? "")
      ? "Federal regulation docket record"
      : "Federal administrative docket record",
    formalIdentifiers: identifiers,
    typedDates: dates,
    geography: {
      status: "provider_reported",
      labels: ["United States"],
    },
    evidence: [{
      sourceId,
      title: document.title,
      locator: `https://www.regulations.gov/document/${document.id}`,
      publisher,
      publishedDate: document.postedDate,
      authorityTier: 1,
      retrievedAt: input.retrievedAt,
      evidenceRole: "occurrence_metadata",
      factText: description,
    }],
    recordedAt: input.retrievedAt,
  });
}

export async function searchScreen04RegulationsGovEvents(input: {
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  query: string;
  startDate: string;
  endDate: string;
  retrievedAt: string;
  timeoutMs?: number;
}): Promise<Screen04RegulationsGovEventSearchResult> {
  if (!calendarDate(input.startDate) || !calendarDate(input.endDate) ||
      input.startDate > input.endDate) {
    throw new Error(
      "Regulations.gov co-event search requires a valid date window.",
    );
  }
  const query = publicConcept(input.query);
  if (query.length < 2) {
    throw new Error(
      "Regulations.gov co-event search requires a bounded public concept.",
    );
  }
  const diagnostics: Screen04RegulationsGovEventSearchResult["diagnostics"] = {
    provider: "regulations_gov",
    adapterVersion: SCREEN04_REGULATIONS_GOV_EVENT_SEARCH_VERSION,
    requestUrl: null,
    recordsReceived: 0,
    recordsAccepted: 0,
    invalidRecordsDropped: 0,
    outOfWindowRecordsDropped: 0,
    limitation:
      "Regulations.gov administrative metadata is not controlling legal text and does not establish firm-level exposure.",
  };
  const result = (
    status: Screen04RegulationsGovEventSearchResult["status"],
    candidates: CoEventCandidateOccurrence[] = [],
  ) => ({ status, candidates, diagnostics });
  if (!validApiKey(input.apiKey)) {
    diagnostics.limitation =
      "Regulations.gov discovery was not attempted because the server-side REGULATIONS_API_KEY is unavailable.";
    return result("not_configured");
  }
  const apiKey = input.apiKey!;
  const url = new URL(ENDPOINT);
  url.searchParams.set("filter[searchTerm]", query);
  url.searchParams.set("page[size]", String(
    SCREEN04_REGULATIONS_GOV_PAGE_SIZE,
  ));
  url.searchParams.set("sort", "-postedDate");
  diagnostics.requestUrl = url.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 18_000);
  try {
    const response = await input.fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/vnd.api+json, application/json",
        "x-api-key": apiKey,
        "cache-control": "no-store",
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.redirected || !response.ok) {
      await response.body?.cancel("Regulations.gov response rejected")
        .catch(() => undefined);
      diagnostics.limitation =
        `Regulations.gov returned an unusable response (HTTP ${response.status}); no absence of events was inferred.`;
      return result("source_unavailable");
    }
    const body = await readScreen02BoundedResponseText(
      response,
      SCREEN04_REGULATIONS_GOV_MAX_RESPONSE_BYTES,
    );
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      diagnostics.limitation =
        "Regulations.gov returned invalid JSON; no absence of events was inferred.";
      return result("source_unavailable");
    }
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      diagnostics.limitation =
        "Regulations.gov returned an invalid response shape; no absence of events was inferred.";
      return result("source_unavailable");
    }
    const candidates: CoEventCandidateOccurrence[] = [];
    diagnostics.recordsReceived = Math.min(
      payload.data.length,
      SCREEN04_REGULATIONS_GOV_PAGE_SIZE,
    );
    for (const value of payload.data.slice(
      0,
      SCREEN04_REGULATIONS_GOV_PAGE_SIZE,
    )) {
      const document = parsedDocument(value);
      if (!document) {
        diagnostics.invalidRecordsDropped += 1;
        continue;
      }
      const referenceDate = document.effectiveDate ??
        document.commentStartDate ?? document.postedDate;
      if (!referenceDate || referenceDate < input.startDate ||
          referenceDate > input.endDate) {
        diagnostics.outOfWindowRecordsDropped += 1;
        continue;
      }
      const candidate = occurrence({ document, retrievedAt: input.retrievedAt });
      if (!candidate) {
        diagnostics.invalidRecordsDropped += 1;
        continue;
      }
      candidates.push(candidate);
    }
    diagnostics.recordsAccepted = candidates.length;
    return result("searched", candidates);
  } catch {
    diagnostics.limitation =
      "The Regulations.gov request did not complete; no absence of events was inferred.";
    return result("source_unavailable");
  } finally {
    clearTimeout(timer);
  }
}
