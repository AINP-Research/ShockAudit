import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type {
  Claim,
  EvidenceRequirement,
  Passage,
  PolicyEvidenceRequirementKind,
  PolicyReviewFailureCode,
  SixScreenWorkflowState,
  SourceRecord,
  DocumentVersion,
  TypedDate,
} from "../core/six-screen/contracts";
import {
  projectPolicyEvidenceClaims,
  type ParsedOfficialDocumentPolicyEvidence,
} from "../core/six-screen/policy-review";
import { validateEvidenceCollection } from
  "../core/six-screen/evidence";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from
  "./screen02-secure-transport";

export const SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION =
  "regulations-gov-administrative-docket-v1" as const;

const REGULATIONS_API_ORIGIN = "https://api.regulations.gov";
const MAXIMUM_RESPONSE_BYTES = 384 * 1024;
const MAXIMUM_SEARCH_RESULTS = 5;
const MAXIMUM_DETAIL_ATTEMPTS = 3;

type RegulationsDocument = {
  id: string;
  title: string;
  documentType: string | null;
  docketId: string | null;
  agencyId: string | null;
  frDocumentNumber: string | null;
  postedDate: string | null;
  effectiveDate: string | null;
  commentStartDate: string | null;
  commentEndDate: string | null;
  withdrawn: boolean | null;
};

export type Screen02RegulationsGovAcquisitionResult = {
  status: "ready" | "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: null;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  parsed: ParsedOfficialDocumentPolicyEvidence | null;
  usage: ResearchTaskOperationUsage;
};

function emptyUsage(): ResearchTaskOperationUsage {
  return {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
    activeResearchMs: 0,
    cpuMs: 0,
    providerCostUnits: {},
  };
}

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum = 1_000) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function calendarDate(value: unknown) {
  const text = boundedText(value, 40).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === text
    ? text
    : null;
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US").replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

const STOPWORDS = new Set([
  "a", "an", "and", "for", "of", "the", "to", "rule", "regulation",
  "regulations", "final", "proposed", "notice",
]);

function significantWords(value: string) {
  return normalize(value).split(" ").filter((word) =>
    word.length > 2 && !STOPWORDS.has(word));
}

function titleSimilarity(left: string, right: string) {
  const leftWords = new Set(significantWords(left));
  const rightWords = new Set(significantWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / new Set([...leftWords, ...rightWords]).size;
}

function relationshipId(value: unknown, kind: string) {
  if (!isRecord(value) || !isRecord(value.relationships)) return null;
  const relationship = value.relationships[kind];
  if (!isRecord(relationship) || !isRecord(relationship.data)) return null;
  return boundedText(relationship.data.id, 100) || null;
}

function parsedDocument(value: unknown): RegulationsDocument | null {
  if (!isRecord(value)) return null;
  const id = boundedText(value.id, 100);
  const attributes = isRecord(value.attributes) ? value.attributes : {};
  const title = boundedText(attributes.title, 2_000);
  if (!id || !/^[A-Za-z0-9._-]{3,100}$/u.test(id) || !title) return null;
  const frDocumentNumber = boundedText(
    attributes.frDocNum ?? attributes.frDocumentNumber,
    40,
  );
  const docket = boundedText(attributes.docketId, 100) ||
    relationshipId(value, "docket");
  return {
    id,
    title,
    documentType: boundedText(attributes.documentType, 120) || null,
    docketId: docket || null,
    agencyId: boundedText(attributes.agencyId, 100) ||
      relationshipId(value, "agency") || null,
    frDocumentNumber: /^\d{4}-\d{4,6}$/u.test(frDocumentNumber)
      ? frDocumentNumber
      : null,
    postedDate: calendarDate(attributes.postedDate),
    effectiveDate: calendarDate(attributes.effectiveDate),
    commentStartDate: calendarDate(attributes.commentStartDate),
    commentEndDate: calendarDate(attributes.commentEndDate),
    withdrawn: typeof attributes.withdrawn === "boolean"
      ? attributes.withdrawn
      : null,
  };
}

function exactFederalRegisterNumber(workflow: SixScreenWorkflowState) {
  const values = [
    ...(workflow.confirmedShock?.formalIdentifiers ?? []),
    ...workflow.candidates.flatMap(({ formalIdentifiers }) => formalIdentifiers),
  ];
  for (const value of values) {
    const match = /\b\d{4}-\d{4,6}\b/u.exec(value);
    if (match) return match[0];
  }
  return null;
}

function searchTerm(workflow: SixScreenWorkflowState) {
  return (exactFederalRegisterNumber(workflow) ??
    workflow.confirmedShock?.officialTitle ?? workflow.currentShockInput)
    .replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ")
    .trim().slice(0, 300);
}

async function fetchJson(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  apiKey: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetch(input.url, {
      method: "GET",
      headers: {
        accept: "application/vnd.api+json, application/json",
        "x-api-key": input.apiKey,
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
      return null;
    }
    const body = await readScreen02BoundedResponseText(
      response,
      MAXIMUM_RESPONSE_BYTES,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
    return { body, parsed };
  } finally {
    clearTimeout(timer);
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function typedDate(value: string, kind: TypedDate["kind"], passageId: string) {
  return {
    start: value,
    end: null,
    precision: "day" as const,
    kind,
    passageIds: [passageId],
  };
}

function evidenceFromDocument(input: {
  workflow: SixScreenWorkflowState;
  document: RegulationsDocument;
  rawBody: string;
  retrievedAt: string;
  searchedRequirementKinds: readonly PolicyEvidenceRequirementKind[];
  contentHash: string;
}) {
  const confirmed = input.workflow.confirmedShock!;
  const coordinate = fingerprintSixScreenValue({
    id: input.document.id,
    hash: input.contentHash,
  }).slice("fnv1a64:".length);
  const sourceId = `regulations-source-${coordinate}`;
  const documentVersionId = `regulations-document-${coordinate}`;
  const passages: Passage[] = [];
  const claims: Claim[] = [];
  const legalVersionDates: TypedDate[] = [];
  const addClaim = (inputClaim: {
    predicate: Claim["predicate"];
    statement: string;
    exactText: string;
    typedValue: unknown;
    qualification: string;
    criticalFor: string[];
  }) => {
    const index = claims.length + 1;
    const passageId = `regulations-passage-${coordinate}-${index}`;
    const claimId = `regulations-claim-${coordinate}-${index}`;
    passages.push({
      id: passageId,
      sourceId,
      documentVersionId,
      locator: `Regulations.gov document metadata field set ${index}`,
      exactText: inputClaim.exactText,
      startOffset: null,
      endOffset: null,
      qualification: inputClaim.qualification,
      unresolvedCrossReferences: [],
    });
    claims.push({
      id: claimId,
      eventId: confirmed.id,
      predicate: inputClaim.predicate,
      typedValue: inputClaim.typedValue,
      statement: inputClaim.statement,
      scope: `Regulations.gov administrative record ${input.document.id}`,
      supportingPassageIds: [passageId],
      opposingPassageIds: [],
      supportStatus: "direct",
      reviewStatus: "unreviewed",
      criticalFor: inputClaim.criticalFor,
    });
    return { passageId, claimId };
  };

  const bindingText = JSON.stringify({
    documentId: input.document.id,
    docketId: input.document.docketId,
    federalRegisterDocumentNumber: input.document.frDocumentNumber,
    documentType: input.document.documentType,
    title: input.document.title,
    agencyId: input.document.agencyId,
    withdrawn: input.document.withdrawn,
  });
  const binding = addClaim({
    predicate: "historical_version_change",
    statement:
      `Regulations.gov binds administrative document ${input.document.id}` +
      `${input.document.docketId ? ` to docket ${input.document.docketId}` : ""}` +
      `${input.document.frDocumentNumber ? ` and FR Doc. ${input.document.frDocumentNumber}` : ""}; its recorded type is ${input.document.documentType ?? "unspecified"}.`,
    exactText: bindingText,
    typedValue: {
      provider: "Regulations.gov",
      documentId: input.document.id,
      docketId: input.document.docketId,
      federalRegisterDocumentNumber: input.document.frDocumentNumber,
      documentType: input.document.documentType,
      withdrawn: input.document.withdrawn,
      evidentiaryScope: "administrative docket identity and version context only",
    },
    qualification:
      "This supports administrative record identity and docket/version context only. It is not controlling legal text and does not prove implementation, enforcement, or sample exposure.",
    criticalFor: ["screen-2-policy-version-context"],
  });

  const dateClaims: string[] = [];
  for (const [field, value, kind] of [
    ["postedDate", input.document.postedDate, "publication"],
    ["effectiveDate", input.document.effectiveDate, "legal_effect"],
    ["commentStartDate", input.document.commentStartDate, "announcement"],
    ["commentEndDate", input.document.commentEndDate, "other"],
  ] as const) {
    if (!value) continue;
    const dateClaim = addClaim({
      predicate: kind === "legal_effect" ? "legal_effect_date" : "policy_date",
      statement: `Regulations.gov reports ${field} ${value} for administrative document ${input.document.id}.`,
      exactText: JSON.stringify({ [field]: value }),
      typedValue: {
        providerField: field,
        date: {
          start: value,
          end: null,
          precision: "day",
          kind,
          passageIds: [],
        },
        evidentiaryScope: field.startsWith("comment")
          ? "public participation window, not a compliance deadline"
          : "provider-reported administrative-document date",
      },
      qualification: field.startsWith("comment")
        ? "A comment window is a rulemaking-stage date, not an implementation or compliance deadline."
        : field === "effectiveDate"
          ? "The provider-reported effective date must be reconciled with the controlling Federal Register text before use."
          : "The posting date is distinct from legal effect, compliance, enforcement, and empirical treatment.",
      criticalFor: ["screen-2-policy-timeline"],
    });
    const valueRecord = claims.at(-1)!.typedValue as {
      date: TypedDate;
    };
    valueRecord.date.passageIds = [dateClaim.passageId];
    legalVersionDates.push(typedDate(value, kind, dateClaim.passageId));
    dateClaims.push(dateClaim.claimId);
  }

  const searched = new Set(input.searchedRequirementKinds);
  const requirements: EvidenceRequirement[] = [
    ["operative_change", "Retain the operative legal change."],
    ["previous_baseline", "Establish the prior rule or practice."],
    ["coverage", "Retain formal coverage and thresholds."],
    ["exemption", "Retain express exemptions or exclusions."],
    ["temporal_stage", "Retain distinct administrative and legal stages."],
    ["version", "Bind the relevant document and docket version."],
    ["implementation", "Retain an implementation or compliance schedule."],
    ["enforcement", "Retain enforcement authority and remedies."],
    ["penalty", "Retain provision-specific sanctions."],
  ].map(([kind, description]) => {
    const requirementKind = kind as PolicyEvidenceRequirementKind;
    const supportingClaimIds = requirementKind === "version"
      ? [binding.claimId]
      : requirementKind === "temporal_stage"
        ? dateClaims
        : [];
    return {
      id: `regulations-requirement-${coordinate}-${requirementKind}`,
      kind: requirementKind,
      description,
      status: supportingClaimIds.length
        ? "supported" as const
        : searched.has(requirementKind)
          ? "searched_not_found" as const
          : "not_yet_searched" as const,
      criticality: requirementKind === "temporal_stage"
        ? "critical" as const
        : requirementKind === "version" || requirementKind === "implementation" ||
            requirementKind === "enforcement"
          ? "material" as const
          : "contextual" as const,
      supportingClaimIds,
    };
  });
  const source: SourceRecord = {
    id: sourceId,
    provider: "Regulations.gov",
    nativeId: input.document.id,
    canonicalUrl: `https://www.regulations.gov/document/${input.document.id}`,
    publisher: "U.S. General Services Administration",
    issuer: input.document.agencyId,
    author: null,
    jurisdiction: "United States",
    role:
      "official administrative-docket metadata used only for document identity, stage dates, and unresolved implementation/enforcement questions; not legal or policy text",
    documentType: input.document.documentType ?? "administrative docket document",
    language: "en",
    publicationDate: input.document.postedDate,
    legalVersionDates,
    retrievedAt: input.retrievedAt,
    documentVersionId,
    contentHash: input.contentHash,
    acquisitionProvenance: "direct",
    accessStatus: "parsed_text",
    rightsStatus: "public-government-record",
    parserVersion: SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION,
    textQualityStatus:
      "selected official API metadata fields inspected; no attachment or substantive legal text inferred",
    inspectedText: "metadata_only",
  };
  const documentVersion: DocumentVersion = {
    id: documentVersionId,
    sourceId,
    representation: "regulations.gov-v4-json-metadata",
    language: "en",
    versionLabel: "Regulations.gov administrative-document metadata",
    retrievedAt: input.retrievedAt,
    contentHash: input.contentHash,
    parserVersion: SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION,
    parsedTextLength: input.rawBody.length,
  };
  const collection = {
    sources: [source],
    documentVersions: [documentVersion],
    passages,
    claims,
    conflicts: [],
    requirements,
  };
  validateEvidenceCollection(collection);
  const unresolved = requirements.filter(({ status }) =>
    status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  return {
    collection,
    projections: projectPolicyEvidenceClaims(collection),
    unresolved,
    status: unresolved.length ? "partial" as const : "ready" as const,
  };
}

export async function acquireScreen02RegulationsGovPolicy(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  apiKey?: string;
  searchedRequirementKinds: readonly PolicyEvidenceRequirementKind[];
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02RegulationsGovAcquisitionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const usage = emptyUsage();
  const attemptedSources: string[] = [];
  const finish = (
    value: Omit<Screen02RegulationsGovAcquisitionResult,
      "usage" | "attemptedSources">,
  ): Screen02RegulationsGovAcquisitionResult => {
    usage.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return { ...value, usage, attemptedSources: [...new Set(attemptedSources)] };
  };
  if (!validApiKey(input.apiKey)) {
    return finish({
      status: "unsupported",
      failureCode: "source_not_configured",
      documentNumber: null,
      unresolved: [...input.searchedRequirementKinds],
      limitation:
        "Regulations.gov administrative-docket evidence requires its approved server-side credential; existing Federal Register and eCFR routes remain available.",
      parsed: null,
    });
  }
  if (!input.workflow.confirmedShock ||
      normalize(input.workflow.confirmedShock.issuingJurisdiction) !==
        "united states") {
    return finish({
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: null,
      unresolved: [...input.searchedRequirementKinds],
      limitation:
        "Regulations.gov is reserved for a confirmed United States federal administrative identity.",
      parsed: null,
    });
  }
  const term = searchTerm(input.workflow);
  if (term.length < 2) {
    return finish({
      status: "unsupported",
      failureCode: "wrong_document",
      documentNumber: null,
      unresolved: [...input.searchedRequirementKinds],
      limitation: "The confirmed policy supplied no bounded docket search term.",
      parsed: null,
    });
  }
  const timeoutMs = input.timeoutMs ?? 12_000;
  const searchUrl = new URL(`${REGULATIONS_API_ORIGIN}/v4/documents`);
  searchUrl.searchParams.set("filter[searchTerm]", term);
  searchUrl.searchParams.set("page[size]", String(MAXIMUM_SEARCH_RESULTS));
  searchUrl.searchParams.set("sort", "-postedDate");
  attemptedSources.push(searchUrl.toString());
  usage.sourceQueries += 1;
  usage.transportHops += 1;
  let search: Awaited<ReturnType<typeof fetchJson>>;
  try {
    search = await fetchJson({
      fetch: input.fetch,
      url: searchUrl.toString(),
      apiKey: input.apiKey!,
      timeoutMs,
    });
  } catch {
    search = null;
  }
  if (!search || !isRecord(search.parsed) || !Array.isArray(search.parsed.data)) {
    return finish({
      status: "waiting_source",
      failureCode: "source_unavailable",
      documentNumber: null,
      unresolved: [...input.searchedRequirementKinds],
      limitation:
        "The bounded Regulations.gov document search did not return usable JSON; no absence of docket evidence was inferred.",
      parsed: null,
    });
  }
  const searchBytes = new TextEncoder().encode(search.body).byteLength;
  usage.receivedBytes += searchBytes;
  usage.decodedBytes += searchBytes;
  const expectedFr = exactFederalRegisterNumber(input.workflow);
  const expectedTitle = input.workflow.confirmedShock.officialTitle;
  const leads = search.parsed.data.slice(0, MAXIMUM_SEARCH_RESULTS)
    .flatMap((value) => {
      const document = parsedDocument(value);
      return document ? [{
        document,
        score: (expectedFr && document.frDocumentNumber === expectedFr ? 100 : 0) +
          titleSimilarity(expectedTitle, document.title) * 50 +
          (/rule/iu.test(document.documentType ?? "") ? 10 : 0),
      }] : [];
    }).sort((left, right) => right.score - left.score);
  usage.metadataRecords += leads.length;
  for (const lead of leads.slice(0, MAXIMUM_DETAIL_ATTEMPTS)) {
    if (lead.score < (expectedFr ? 80 : 20)) continue;
    const detailUrl = `${REGULATIONS_API_ORIGIN}/v4/documents/${lead.document.id}`;
    attemptedSources.push(detailUrl);
    usage.documentAttempts += 1;
    usage.transportHops += 1;
    let detail: Awaited<ReturnType<typeof fetchJson>>;
    try {
      detail = await fetchJson({
        fetch: input.fetch,
        url: detailUrl,
        apiKey: input.apiKey!,
        timeoutMs,
      });
    } catch {
      detail = null;
    }
    if (!detail || !isRecord(detail.parsed)) continue;
    const document = parsedDocument(detail.parsed.data);
    if (!document) continue;
    if (expectedFr && document.frDocumentNumber !== expectedFr) continue;
    if (!expectedFr && titleSimilarity(expectedTitle, document.title) < .4) {
      continue;
    }
    const detailBytes = new TextEncoder().encode(detail.body).byteLength;
    usage.receivedBytes += detailBytes;
    usage.decodedBytes += detailBytes;
    usage.usefulDocuments += 1;
    const parsed = evidenceFromDocument({
      workflow: input.workflow,
      document,
      rawBody: detail.body,
      retrievedAt: input.retrievedAt,
      searchedRequirementKinds: input.searchedRequirementKinds,
      contentHash: await sha256(detail.body),
    });
    return finish({
      status: parsed.status,
      failureCode: null,
      documentNumber: null,
      unresolved: parsed.unresolved,
      limitation:
        "Regulations.gov supplied bounded administrative-document and docket metadata. Federal Register/eCFR or another controlling official source remains authoritative for legal obligations, coverage, exemptions, enforcement, and sanctions; missing metadata is not evidence of absence.",
      parsed,
    });
  }
  return finish({
    status: "partial",
    failureCode: "wrong_document",
    documentNumber: null,
    unresolved: [...input.searchedRequirementKinds],
    limitation:
      "Regulations.gov returned document leads, but none passed the exact Federal Register number or source-title binding. No looser docket was substituted.",
    parsed: null,
  });
}
