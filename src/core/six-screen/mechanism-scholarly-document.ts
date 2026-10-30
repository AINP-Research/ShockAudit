import { fingerprintSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
} from "./contracts";
import type { MechanismLiteraturePlan } from "./mechanism-literature-plan";
import {
  validateScholarlyEvidencePacket,
  validateScholarlyMetadataRecord,
  type MechanismLiteratureExecution,
  type ScholarlyEvidencePacket,
  type ScholarlyMetadataRecord,
} from "./mechanism-literature-execution";

export const SIX_SCREEN_SCHOLARLY_DOCUMENT_INPUT_VERSION =
  "screen-05-scholarly-document-input-v1" as const;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_PLAN_VERSION =
  "screen-05-scholarly-document-plan-v1" as const;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_VERSION =
  "screen-05-inspected-scholarly-document-v1" as const;
export const SIX_SCREEN_SCHOLARLY_PASSAGE_VERSION =
  "screen-05-scholarly-passage-v1" as const;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION =
  "screen-05-scholarly-document-acquisition-v1" as const;
export const SIX_SCREEN_SCHOLARLY_PASSAGE_PACKET_VERSION =
  "screen-05-scholarly-passage-packet-v1" as const;

export const SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS = 16;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_HISTORY = 384;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_USEFUL_DOCUMENTS = 8;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES = 512_000;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RETAINED_PASSAGE_CHARACTERS =
  4_000;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS = 20_000;
export const SIX_SCREEN_SCHOLARLY_DOCUMENT_COLLECTION_MAX_BYTES = 4_000_000;

const DOCUMENT_PLAN_BOUNDARY =
  "This plan permits one exact, researcher-selected scholarly URL request only after an explicit access-rights assertion and a tested host-family gate. It follows no redirect, DOI resolution, metadata link, citation, or embedded resource.";
const ACQUISITION_BOUNDARY =
  "A retained passage records normalized visible text and exact offsets from one fetched representation. It is eligible only for later researcher review; it is not itself a theory claim, empirical conclusion, mechanism, prediction, measure recommendation, or causal estimate.";
const PASSAGE_PACKET_BOUNDARY =
  "This immutable packet may contain source-linked scholarly passages, but no detailed scholarly claim has been extracted or researcher-reviewed and no mechanism or prediction may be generated. Abstract-only text remains ineligible for detailed claim support.";

export type ScholarlyDocumentAccessBasis =
  | "not_confirmed"
  | "open_access"
  | "researcher_authorized_access";

export type ScholarlyDocumentInspectionMode =
  | "partial_text"
  | "abstract_only";

export type ScholarlyPassagePurpose =
  | "theoretical_proposition"
  | "empirical_result_or_qualification"
  | "empirical_setting_or_measure"
  | "boundary_condition"
  | "contrary_evidence"
  | "other";

export type ScholarlyDocumentInspectionInput = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_DOCUMENT_INPUT_VERSION;
  targetId: string;
  exactDocumentUrl: string | null;
  accessBasis: ScholarlyDocumentAccessBasis;
  inspectionMode: ScholarlyDocumentInspectionMode;
  exactPassage: string | null;
  passagePurpose: ScholarlyPassagePurpose;
  qualification: string | null;
  inputFingerprint: string;
};

export type ScholarlyDocumentTarget = {
  id: string;
  origin:
    | "researcher_supplied_work"
    | "crossref_metadata_record"
    | "openalex_metadata_record";
  originId: string;
  originFingerprint: string;
  originKind:
    | MechanismLiteraturePlan["input"]["suppliedWorks"][number]["kind"]
    | "crossref_record"
    | "openalex_record";
  doi: string | null;
  title: string | null;
  retainedLocator: string | null;
  routeRequirement:
    | "exact_url_available"
    | "exact_document_url_required"
    | "unsupported_identifier";
  targetFingerprint: string;
};

export type ScholarlyDocumentSourceFamily =
  | "researcher_supplied_exact_url"
  | "researcher_bound_doi_document"
  | "crossref_bound_doi_document"
  | "crossref_bound_url_document"
  | "openalex_bound_doi_document"
  | "openalex_bound_url_document"
  | "doi_resolver_locator"
  | "unsupported_identifier";

export type ScholarlyDocumentPlanInitialStatus =
  | "pending"
  | "rights_not_confirmed"
  | "unsupported_identifier"
  | "exact_document_url_required"
  | "target_url_mismatch"
  | "doi_resolver_not_document"
  | "source_family_not_configured"
  | "source_family_not_tested"
  | "publisher_limit_reached"
  | "document_attempt_budget_exhausted"
  | "useful_document_budget_exhausted";

export type ScholarlyDocumentInspectionPlan = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_DOCUMENT_PLAN_VERSION;
  id: string;
  ordinal: number;
  binding: {
    literaturePlanSnapshotId: string;
    literaturePlanFingerprint: string;
    metadataExecutionSnapshotId: string;
    metadataExecutionFingerprint: string;
    metadataPacketSnapshotId: string;
    metadataPacketFingerprint: string;
    previousAcquisitionId: string | null;
  };
  target: ScholarlyDocumentTarget;
  input: ScholarlyDocumentInspectionInput;
  sourceFamily: ScholarlyDocumentSourceFamily;
  capability: {
    adapterVersion: "screen-05-exact-scholarly-html-v1";
    hostname: string | null;
    configured: boolean;
    tested: boolean;
    enabled: boolean;
    credentialForwarding: false;
  };
  initialStatus: ScholarlyDocumentPlanInitialStatus;
  budgets: {
    documentAttempts: 1;
    usefulDocuments: 1;
    transportHops: 1;
    maximumResponseBytes: 512_000;
    maximumDecodedBytes: 512_000;
    maximumActiveResearchMs: 20_000;
    automaticRetries: 0;
    redirectHops: 0;
    citationHops: 0;
    embeddedResources: 0;
  };
  claimBoundary: typeof DOCUMENT_PLAN_BOUNDARY;
  createdAt: string;
  planFingerprint: string;
};

export type ScholarlyInspectedDocument = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_DOCUMENT_VERSION;
  id: string;
  sourceId: string;
  documentVersionId: string;
  targetReference: {
    targetId: string;
    targetFingerprint: string;
    origin: ScholarlyDocumentTarget["origin"];
    originId: string;
    originFingerprint: string;
  };
  sourceFamily: Exclude<
    ScholarlyDocumentSourceFamily,
    "doi_resolver_locator" | "unsupported_identifier"
  >;
  canonicalUrl: string;
  title: string;
  doi: string | null;
  identityVerification:
    | "doi_metadata_match"
    | "exact_researcher_supplied_url";
  representation: "html" | "plain_text";
  mediaType: "text/html" | "text/plain";
  language: string;
  retrievedAt: string;
  etag: string | null;
  lastModified: string | null;
  versionLabel: string;
  contentHash: string;
  normalizedTextHash: string;
  receivedBytes: number;
  normalizedTextCharacters: number;
  parserVersion: "visible-scholarly-text-v1";
  inspectionStatus: ScholarlyDocumentInspectionMode;
  access: {
    basis: Exclude<ScholarlyDocumentAccessBasis, "not_confirmed">;
    assertedBy: "researcher_ui";
    independentlyVerified: false;
    credentialForwarding: false;
  };
  fullTextRetained: false;
  passageIds: string[];
  documentFingerprint: string;
};

export type ScholarlyInspectedPassage = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_PASSAGE_VERSION;
  id: string;
  sourceId: string;
  documentVersionId: string;
  sourceTextHash: string;
  quoteHash: string;
  exactText: string;
  locator: string;
  startOffset: number;
  endOffset: number;
  inspectionStatus: ScholarlyDocumentInspectionMode;
  purpose: ScholarlyPassagePurpose;
  qualification: string;
  detailedClaimUse:
    | "eligible_for_later_researcher_review"
    | "abstract_only_not_eligible";
  passageFingerprint: string;
};

export type ScholarlyDocumentAcquisitionOutcome =
  | "passage_retained"
  | "abstract_passage_retained"
  | Exclude<ScholarlyDocumentPlanInitialStatus, "pending">
  | "source_unavailable"
  | "timed_out"
  | "redirect_not_followed"
  | "http_failure"
  | "unsupported_format"
  | "response_too_large"
  | "access_challenge"
  | "document_identity_mismatch"
  | "unparsed_document"
  | "passage_not_found"
  | "passage_ambiguous";

export type ScholarlyDocumentUsage = {
  sourceQueries: 0;
  metadataRecords: 0;
  documentAttempts: number;
  usefulDocuments: number;
  transportHops: number;
  receivedBytes: number;
  decodedBytes: number;
  activeResearchMs: number;
  cpuMs: number;
  providerCostUnits: Record<string, number>;
};

export type ScholarlyDocumentAcquisition = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION;
  id: string;
  ordinal: number;
  plan: ScholarlyDocumentInspectionPlan;
  startedAt: string;
  completedAt: string;
  attemptedUrl: string | null;
  outcome: ScholarlyDocumentAcquisitionOutcome;
  failureCode: Exclude<
    ScholarlyDocumentAcquisitionOutcome,
    "passage_retained" | "abstract_passage_retained"
  > | null;
  note: string;
  usage: ScholarlyDocumentUsage;
  document: ScholarlyInspectedDocument | null;
  passage: ScholarlyInspectedPassage | null;
  claimBoundary: typeof ACQUISITION_BOUNDARY;
  acquisitionFingerprint: string;
};

export type ScholarlyPassagePacket = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_PASSAGE_PACKET_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: ScholarlyDocumentInspectionPlan["binding"] & {
    acquisitionId: string;
    acquisitionFingerprint: string;
    previousPassagePacketSnapshotId: string | null;
  };
  acquisitionReferences: Array<{
    acquisitionId: string;
    acquisitionFingerprint: string;
    outcome: ScholarlyDocumentAcquisitionOutcome;
  }>;
  documentReferences: Array<{
    documentId: string;
    documentFingerprint: string;
    documentVersionId: string;
    contentHash: string;
    inspectionStatus: ScholarlyDocumentInspectionMode;
  }>;
  passageReferences: Array<{
    passageId: string;
    passageFingerprint: string;
    documentVersionId: string;
    exactOffsets: { start: number; end: number };
    detailedClaimUse: ScholarlyInspectedPassage["detailedClaimUse"];
  }>;
  eligiblePassageIds: string[];
  abstractOnlyPassageIds: string[];
  detailedClaims: {
    status: "not_extracted_or_reviewed";
    claimIds: [];
  };
  mechanismGeneration: {
    status: "blocked";
    reasons: [
      "genuine_intelligence_path_unverified",
      "scholarly_claims_not_reviewed",
    ];
  };
  mechanismCandidates: [];
  predictionMatrix: null;
  claimBoundary: typeof PASSAGE_PACKET_BOUNDARY;
  createdAt: string;
  packetFingerprint: string;
};

type InputBody = Omit<ScholarlyDocumentInspectionInput, "inputFingerprint">;
type TargetBody = Omit<ScholarlyDocumentTarget, "targetFingerprint">;
type PlanBody = Omit<ScholarlyDocumentInspectionPlan, "planFingerprint">;
type DocumentBody = Omit<ScholarlyInspectedDocument, "documentFingerprint">;
type PassageBody = Omit<ScholarlyInspectedPassage, "passageFingerprint">;
type AcquisitionBody = Omit<
  ScholarlyDocumentAcquisition,
  "acquisitionFingerprint"
>;
type PacketBody = Omit<ScholarlyPassagePacket, "packetFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, maximum: number) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(`${label} must be canonical text within its bounded length.`);
  }
  return value;
}

function requireOptionalText(
  value: string | null,
  label: string,
  maximum: number,
) {
  if (value !== null) requireText(value, label, maximum);
}

function requireNonnegative(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`);
  }
}

function canonicalDoi(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function canonicalScholarlyVisibleText(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function inputBody(input: ScholarlyDocumentInspectionInput): InputBody {
  const { inputFingerprint: _fingerprint, ...body } = input;
  return body;
}

export function createScholarlyDocumentInspectionInput(
  input: Omit<ScholarlyDocumentInspectionInput, "schemaVersion" | "inputFingerprint">,
): ScholarlyDocumentInspectionInput {
  requireBoundedIdentifier(input.targetId, "Scholarly document target id");
  const exactDocumentUrl = input.exactDocumentUrl === null
    ? null
    : requireSanitizedSourceUrl(input.exactDocumentUrl);
  if (exactDocumentUrl && new URL(exactDocumentUrl).port) {
    throw new Error(
      "Scholarly exact document URLs must use the default HTTPS port.",
    );
  }
  if (![
    "not_confirmed",
    "open_access",
    "researcher_authorized_access",
  ].includes(input.accessBasis)) {
    throw new Error("Scholarly document access basis is invalid.");
  }
  if (!["partial_text", "abstract_only"].includes(input.inspectionMode)) {
    throw new Error("Scholarly document inspection mode is invalid.");
  }
  if (![
    "theoretical_proposition",
    "empirical_result_or_qualification",
    "empirical_setting_or_measure",
    "boundary_condition",
    "contrary_evidence",
    "other",
  ].includes(input.passagePurpose)) {
    throw new Error("Scholarly passage purpose is invalid.");
  }
  const exactPassage = input.exactPassage === null
    ? null
    : canonicalScholarlyVisibleText(input.exactPassage);
  const qualification = input.qualification === null
    ? null
    : canonicalScholarlyVisibleText(input.qualification);
  requireOptionalText(
    exactPassage,
    "Scholarly exact passage",
    SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RETAINED_PASSAGE_CHARACTERS,
  );
  requireOptionalText(qualification, "Scholarly passage qualification", 1_400);
  if (
    input.accessBasis !== "not_confirmed" && exactDocumentUrl !== null &&
    exactPassage === null
  ) {
    throw new Error("An executable scholarly inspection requires an exact passage.");
  }
  const body: InputBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_INPUT_VERSION,
    ...structuredClone(input),
    exactDocumentUrl,
    exactPassage,
    qualification,
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  };
}

export function validateScholarlyDocumentInspectionInput(
  input: ScholarlyDocumentInspectionInput,
) {
  const recreated = createScholarlyDocumentInspectionInput(inputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_SCHOLARLY_DOCUMENT_INPUT_VERSION ||
    input.inputFingerprint !== recreated.inputFingerprint
  ) throw new Error("Scholarly document input fingerprint is invalid.");
  return input;
}

function target(body: TargetBody): ScholarlyDocumentTarget {
  return {
    ...body,
    targetFingerprint: fingerprintSixScreenValue(body),
  };
}

export function buildScholarlyDocumentTargets(input: {
  literaturePlan: MechanismLiteraturePlan;
  metadataRecords: readonly ScholarlyMetadataRecord[];
}) {
  const supplied = input.literaturePlan.input.suppliedWorks.map((work) => {
    const doi = work.kind === "doi" ? canonicalDoi(work.value) : null;
    const locator = work.kind === "url"
      ? requireSanitizedSourceUrl(work.value)
      : null;
    return target({
      id: `scholarly-document-target-supplied-${work.id}`,
      origin: "researcher_supplied_work",
      originId: work.id,
      originFingerprint: fingerprintSixScreenValue(work),
      originKind: work.kind,
      doi,
      title: work.kind === "citation" ? work.value : null,
      retainedLocator: locator,
      routeRequirement: work.kind === "url"
        ? "exact_url_available"
        : work.kind === "doi"
          ? "exact_document_url_required"
          : "unsupported_identifier",
    });
  });
  const records = input.metadataRecords.map((record) => {
    validateScholarlyMetadataRecord(record);
    const provider = record.providerId;
    return target({
      id: `scholarly-document-target-${provider}-${record.id}`,
      origin: provider === "openalex"
        ? "openalex_metadata_record"
        : "crossref_metadata_record",
      originId: record.id,
      originFingerprint: record.recordFingerprint,
      originKind: provider === "openalex"
        ? "openalex_record"
        : "crossref_record",
      doi: record.doi,
      title: record.title,
      retainedLocator: record.stableLocator,
      routeRequirement: record.doi
        ? "exact_document_url_required"
        : "unsupported_identifier",
    });
  });
  const targets = [...supplied, ...records];
  if (targets.length > 104 || new Set(targets.map(({ id }) => id)).size !==
      targets.length) {
    throw new Error("Scholarly document targets are invalid or exceed capacity.");
  }
  return targets;
}

function canonicalHost(value: string) {
  const host = value.trim().toLocaleLowerCase("en-US");
  if (
    !host || host.length > 253 || host.includes(":") ||
    host === "localhost" || host.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) ||
    !host.split(".").every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)
    )
  ) throw new Error("Scholarly document permitted host is invalid.");
  return host;
}

function sourceFamily(
  target: ScholarlyDocumentTarget,
  exactDocumentUrl: string | null,
): ScholarlyDocumentSourceFamily {
  if (target.routeRequirement === "unsupported_identifier") {
    return "unsupported_identifier";
  }
  if (exactDocumentUrl) {
    const hostname = new URL(exactDocumentUrl).hostname;
    if (hostname === "doi.org" || hostname.endsWith(".doi.org")) {
      return "doi_resolver_locator";
    }
  }
  if (target.origin === "researcher_supplied_work") {
    return target.originKind === "url"
      ? "researcher_supplied_exact_url"
      : "researcher_bound_doi_document";
  }
  if (target.origin === "openalex_metadata_record") {
    return target.doi
      ? "openalex_bound_doi_document"
      : "openalex_bound_url_document";
  }
  return target.doi
    ? "crossref_bound_doi_document"
    : "crossref_bound_url_document";
}

function expectedInitialStatus(input: {
  target: ScholarlyDocumentTarget;
  request: ScholarlyDocumentInspectionInput;
  sourceFamily: ScholarlyDocumentSourceFamily;
  configured: boolean;
  tested: boolean;
  priorAcquisitions: readonly ScholarlyDocumentAcquisition[];
}) : ScholarlyDocumentPlanInitialStatus {
  if (input.target.routeRequirement === "unsupported_identifier") {
    return "unsupported_identifier";
  }
  if (input.request.accessBasis === "not_confirmed") {
    return "rights_not_confirmed";
  }
  if (!input.request.exactDocumentUrl) return "exact_document_url_required";
  if (
    input.target.originKind === "url" &&
    input.request.exactDocumentUrl !== input.target.retainedLocator
  ) return "target_url_mismatch";
  if (input.sourceFamily === "doi_resolver_locator") {
    return "doi_resolver_not_document";
  }
  if (!input.configured) return "source_family_not_configured";
  if (!input.tested) return "source_family_not_tested";
  if (
    input.priorAcquisitions.length >=
      SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS
  ) return "document_attempt_budget_exhausted";
  if (input.priorAcquisitions.filter(({ document }) => document).length >=
      SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_USEFUL_DOCUMENTS) {
    return "useful_document_budget_exhausted";
  }
  const hostname = new URL(input.request.exactDocumentUrl).hostname;
  if (input.priorAcquisitions.some((acquisition) =>
    acquisition.usage.documentAttempts > 0 && acquisition.attemptedUrl &&
    new URL(acquisition.attemptedUrl).hostname === hostname
  )) return "publisher_limit_reached";
  return "pending";
}

function planBody(plan: ScholarlyDocumentInspectionPlan): PlanBody {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return body;
}

export function createScholarlyDocumentInspectionPlan(input: {
  id: string;
  literaturePlan: MechanismLiteraturePlan;
  metadataExecution: MechanismLiteratureExecution;
  metadataPacket: ScholarlyEvidencePacket;
  metadataRecords: readonly ScholarlyMetadataRecord[];
  request: ScholarlyDocumentInspectionInput;
  priorAcquisitions: readonly ScholarlyDocumentAcquisition[];
  permittedHosts: readonly string[];
  capabilityTested: boolean;
  createdAt: string;
}) {
  requireBoundedIdentifier(input.id, "Scholarly document plan id");
  requireCanonicalInstant(input.createdAt, "Scholarly document plan createdAt");
  validateScholarlyDocumentInspectionInput(input.request);
  validateScholarlyEvidencePacket({
    packet: input.metadataPacket,
    literaturePlan: input.literaturePlan,
    execution: input.metadataExecution,
    records: input.metadataRecords,
  });
  if (input.metadataExecution.status !== "complete") {
    throw new Error("Scholarly document inspection requires completed metadata planning.");
  }
  input.priorAcquisitions.forEach(validateScholarlyDocumentAcquisition);
  const targets = buildScholarlyDocumentTargets({
    literaturePlan: input.literaturePlan,
    metadataRecords: input.metadataRecords,
  });
  const selected = targets.find(({ id }) => id === input.request.targetId);
  if (!selected) throw new Error("Scholarly document target is not in the packet.");
  const hosts = [...new Set(input.permittedHosts.map(canonicalHost))];
  if (hosts.length > 16) throw new Error("Scholarly document host family is too broad.");
  const hostname = input.request.exactDocumentUrl
    ? new URL(input.request.exactDocumentUrl).hostname.toLocaleLowerCase("en-US")
    : null;
  const configured = hostname !== null && hosts.includes(hostname);
  const family = sourceFamily(selected, input.request.exactDocumentUrl);
  const initialStatus = expectedInitialStatus({
    target: selected,
    request: input.request,
    sourceFamily: family,
    configured,
    tested: input.capabilityTested,
    priorAcquisitions: input.priorAcquisitions,
  });
  const body: PlanBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_PLAN_VERSION,
    id: input.id,
    ordinal: input.priorAcquisitions.length + 1,
    binding: {
      literaturePlanSnapshotId: input.literaturePlan.snapshotId,
      literaturePlanFingerprint: input.literaturePlan.planFingerprint,
      metadataExecutionSnapshotId: input.metadataExecution.snapshotId,
      metadataExecutionFingerprint: input.metadataExecution.executionFingerprint,
      metadataPacketSnapshotId: input.metadataPacket.snapshotId,
      metadataPacketFingerprint: input.metadataPacket.packetFingerprint,
      previousAcquisitionId: input.priorAcquisitions.at(-1)?.id ?? null,
    },
    target: selected,
    input: structuredClone(input.request),
    sourceFamily: family,
    capability: {
      adapterVersion: "screen-05-exact-scholarly-html-v1",
      hostname,
      configured,
      tested: input.capabilityTested,
      enabled: initialStatus === "pending",
      credentialForwarding: false,
    },
    initialStatus,
    budgets: {
      documentAttempts: 1,
      usefulDocuments: 1,
      transportHops: 1,
      maximumResponseBytes:
        SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
      maximumDecodedBytes:
        SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES,
      maximumActiveResearchMs: SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS,
      automaticRetries: 0,
      redirectHops: 0,
      citationHops: 0,
      embeddedResources: 0,
    },
    claimBoundary: DOCUMENT_PLAN_BOUNDARY,
    createdAt: input.createdAt,
  };
  const plan = {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScholarlyDocumentInspectionPlan(plan, {
    literaturePlan: input.literaturePlan,
    metadataExecution: input.metadataExecution,
    metadataPacket: input.metadataPacket,
    metadataRecords: input.metadataRecords,
    priorAcquisitions: input.priorAcquisitions,
  });
}

export function validateScholarlyDocumentInspectionPlan(
  plan: ScholarlyDocumentInspectionPlan,
  context: {
    literaturePlan: MechanismLiteraturePlan;
    metadataExecution: MechanismLiteratureExecution;
    metadataPacket: ScholarlyEvidencePacket;
    metadataRecords: readonly ScholarlyMetadataRecord[];
    priorAcquisitions: readonly ScholarlyDocumentAcquisition[];
  },
) {
  validateScholarlyDocumentInspectionInput(plan.input);
  const target = buildScholarlyDocumentTargets({
    literaturePlan: context.literaturePlan,
    metadataRecords: context.metadataRecords,
  }).find(({ id }) => id === plan.target.id);
  if (
    plan.schemaVersion !== SIX_SCREEN_SCHOLARLY_DOCUMENT_PLAN_VERSION ||
    plan.planFingerprint !== fingerprintSixScreenValue(planBody(plan)) ||
    !target || target.targetFingerprint !== plan.target.targetFingerprint ||
    plan.input.targetId !== plan.target.id ||
    plan.binding.literaturePlanSnapshotId !== context.literaturePlan.snapshotId ||
    plan.binding.literaturePlanFingerprint !== context.literaturePlan.planFingerprint ||
    plan.binding.metadataExecutionSnapshotId !== context.metadataExecution.snapshotId ||
    plan.binding.metadataExecutionFingerprint !==
      context.metadataExecution.executionFingerprint ||
    plan.binding.metadataPacketSnapshotId !== context.metadataPacket.snapshotId ||
    plan.binding.metadataPacketFingerprint !== context.metadataPacket.packetFingerprint ||
    plan.binding.previousAcquisitionId !==
      (context.priorAcquisitions.at(-1)?.id ?? null) ||
    plan.ordinal !== context.priorAcquisitions.length + 1 ||
    plan.sourceFamily !== sourceFamily(plan.target, plan.input.exactDocumentUrl) ||
    plan.capability.adapterVersion !== "screen-05-exact-scholarly-html-v1" ||
    typeof plan.capability.configured !== "boolean" ||
    typeof plan.capability.tested !== "boolean" ||
    typeof plan.capability.enabled !== "boolean" ||
    plan.capability.credentialForwarding !== false ||
    plan.capability.hostname !== (plan.input.exactDocumentUrl
      ? new URL(plan.input.exactDocumentUrl).hostname.toLocaleLowerCase("en-US")
      : null) ||
    plan.capability.enabled !== (plan.initialStatus === "pending") ||
    plan.initialStatus !== expectedInitialStatus({
      target: plan.target,
      request: plan.input,
      sourceFamily: plan.sourceFamily,
      configured: plan.capability.configured,
      tested: plan.capability.tested,
      priorAcquisitions: context.priorAcquisitions,
    }) ||
    plan.claimBoundary !== DOCUMENT_PLAN_BOUNDARY ||
    plan.budgets.documentAttempts !== 1 ||
    plan.budgets.usefulDocuments !== 1 ||
    plan.budgets.transportHops !== 1 ||
    plan.budgets.maximumResponseBytes !== 512_000 ||
    plan.budgets.maximumDecodedBytes !== 512_000 ||
    plan.budgets.maximumActiveResearchMs !== 20_000 ||
    plan.budgets.automaticRetries !== 0 || plan.budgets.redirectHops !== 0 ||
    plan.budgets.citationHops !== 0 || plan.budgets.embeddedResources !== 0
  ) throw new Error("Scholarly document inspection plan is invalid.");
  requireBoundedIdentifier(plan.id, "Scholarly document plan id");
  requireCanonicalInstant(plan.createdAt, "Scholarly document plan createdAt");
  requireFingerprint(plan.binding.metadataPacketFingerprint, "Metadata packet fingerprint");
  return plan;
}

function documentBody(document: ScholarlyInspectedDocument): DocumentBody {
  const { documentFingerprint: _fingerprint, ...body } = document;
  return body;
}

export function createScholarlyInspectedDocument(input: DocumentBody) {
  const document = {
    ...structuredClone(input),
    documentFingerprint: fingerprintSixScreenValue(input),
  };
  return validateScholarlyInspectedDocument(document);
}

export function validateScholarlyInspectedDocument(
  document: ScholarlyInspectedDocument,
) {
  if (
    document.schemaVersion !== SIX_SCREEN_SCHOLARLY_DOCUMENT_VERSION ||
    document.documentFingerprint !==
      fingerprintSixScreenValue(documentBody(document)) ||
    ![
      "researcher_supplied_exact_url",
      "researcher_bound_doi_document",
      "crossref_bound_doi_document",
      "crossref_bound_url_document",
      "openalex_bound_doi_document",
      "openalex_bound_url_document",
    ].includes(document.sourceFamily) ||
    !["doi_metadata_match", "exact_researcher_supplied_url"].includes(
      document.identityVerification,
    ) ||
    !["html", "plain_text"].includes(document.representation) ||
    !["text/html", "text/plain"].includes(document.mediaType) ||
    (document.representation === "html") !==
      (document.mediaType === "text/html") ||
    !["partial_text", "abstract_only"].includes(document.inspectionStatus) ||
    !["open_access", "researcher_authorized_access"].includes(
      document.access.basis,
    ) ||
    !/^sha256:[0-9a-f]{64}$/u.test(document.contentHash) ||
    !/^sha256:[0-9a-f]{64}$/u.test(document.normalizedTextHash) ||
    document.fullTextRetained !== false ||
    document.parserVersion !== "visible-scholarly-text-v1" ||
    document.access.assertedBy !== "researcher_ui" ||
    document.access.independentlyVerified !== false ||
    document.access.credentialForwarding !== false ||
    document.passageIds.length !== 1
  ) throw new Error("Inspected scholarly document is invalid.");
  [document.id, document.sourceId, document.documentVersionId,
    document.targetReference.targetId, document.targetReference.originId,
    ...document.passageIds].forEach((id) =>
      requireBoundedIdentifier(id, "Inspected scholarly document coordinate")
    );
  requireSanitizedSourceUrl(document.canonicalUrl);
  requireText(document.title, "Inspected scholarly document title", 2_000);
  requireText(document.language, "Inspected scholarly document language", 40);
  requireText(document.versionLabel, "Inspected scholarly version label", 1_000);
  requireOptionalText(document.etag, "Inspected scholarly ETag", 500);
  requireOptionalText(
    document.lastModified,
    "Inspected scholarly Last-Modified",
    500,
  );
  requireCanonicalInstant(document.retrievedAt, "Inspected scholarly document retrievedAt");
  requireNonnegative(document.receivedBytes, "Scholarly received bytes");
  requireNonnegative(
    document.normalizedTextCharacters,
    "Scholarly normalized text characters",
  );
  if (
    document.receivedBytes > SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES ||
    document.normalizedTextCharacters < 1 ||
    document.doi !== null && !/^10\.\d{4,9}\/[\S]+$/iu.test(document.doi) ||
    (document.identityVerification === "doi_metadata_match") !==
      (document.doi !== null)
  ) throw new Error("Inspected scholarly document identity is invalid.");
  requireFingerprint(document.targetReference.targetFingerprint, "Scholarly target fingerprint");
  requireFingerprint(document.targetReference.originFingerprint, "Scholarly origin fingerprint");
  return document;
}

function passageBody(passage: ScholarlyInspectedPassage): PassageBody {
  const { passageFingerprint: _fingerprint, ...body } = passage;
  return body;
}

export function createScholarlyInspectedPassage(input: PassageBody) {
  const passage = {
    ...structuredClone(input),
    passageFingerprint: fingerprintSixScreenValue(input),
  };
  return validateScholarlyInspectedPassage(passage);
}

export function validateScholarlyInspectedPassage(
  passage: ScholarlyInspectedPassage,
) {
  if (
    passage.schemaVersion !== SIX_SCREEN_SCHOLARLY_PASSAGE_VERSION ||
    passage.passageFingerprint !== fingerprintSixScreenValue(passageBody(passage)) ||
    !["partial_text", "abstract_only"].includes(passage.inspectionStatus) ||
    ![
      "theoretical_proposition",
      "empirical_result_or_qualification",
      "empirical_setting_or_measure",
      "boundary_condition",
      "contrary_evidence",
      "other",
    ].includes(passage.purpose) ||
    !/^sha256:[0-9a-f]{64}$/u.test(passage.sourceTextHash) ||
    !/^sha256:[0-9a-f]{64}$/u.test(passage.quoteHash) ||
    passage.startOffset < 0 || passage.endOffset <= passage.startOffset ||
    passage.endOffset - passage.startOffset !== passage.exactText.length ||
    passage.detailedClaimUse !== (passage.inspectionStatus === "abstract_only"
      ? "abstract_only_not_eligible"
      : "eligible_for_later_researcher_review")
  ) throw new Error("Inspected scholarly passage is invalid.");
  [passage.id, passage.sourceId, passage.documentVersionId].forEach((id) =>
    requireBoundedIdentifier(id, "Scholarly passage coordinate")
  );
  requireText(
    passage.exactText,
    "Scholarly passage text",
    SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RETAINED_PASSAGE_CHARACTERS,
  );
  requireText(passage.locator, "Scholarly passage locator", 500);
  requireText(passage.qualification, "Scholarly passage qualification", 2_000);
  return passage;
}

function usageValid(usage: ScholarlyDocumentUsage) {
  for (const [key, value] of Object.entries(usage)) {
    if (key === "providerCostUnits") continue;
    requireNonnegative(value as number, `Scholarly document usage ${key}`);
  }
  if (
    usage.sourceQueries !== 0 || usage.metadataRecords !== 0 ||
    usage.documentAttempts > 1 || usage.usefulDocuments > 1 ||
    usage.transportHops > 1 ||
    usage.receivedBytes > SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES ||
    usage.decodedBytes > SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_RESPONSE_BYTES ||
    usage.activeResearchMs > SIX_SCREEN_SCHOLARLY_DOCUMENT_TIMEOUT_MS ||
    Object.keys(usage.providerCostUnits).length
  ) throw new Error("Scholarly document usage exceeds its bounded contract.");
}

function acquisitionBody(
  acquisition: ScholarlyDocumentAcquisition,
): AcquisitionBody {
  const { acquisitionFingerprint: _fingerprint, ...body } = acquisition;
  return body;
}

export function createScholarlyDocumentAcquisition(input: AcquisitionBody) {
  const acquisition = {
    ...structuredClone(input),
    acquisitionFingerprint: fingerprintSixScreenValue(input),
  };
  return validateScholarlyDocumentAcquisition(acquisition);
}

export function validateScholarlyDocumentAcquisition(
  acquisition: ScholarlyDocumentAcquisition,
) {
  const outcomes: readonly ScholarlyDocumentAcquisitionOutcome[] = [
    "passage_retained",
    "abstract_passage_retained",
    "rights_not_confirmed",
    "unsupported_identifier",
    "exact_document_url_required",
    "target_url_mismatch",
    "doi_resolver_not_document",
    "source_family_not_configured",
    "source_family_not_tested",
    "publisher_limit_reached",
    "document_attempt_budget_exhausted",
    "useful_document_budget_exhausted",
    "source_unavailable",
    "timed_out",
    "redirect_not_followed",
    "http_failure",
    "unsupported_format",
    "response_too_large",
    "access_challenge",
    "document_identity_mismatch",
    "unparsed_document",
    "passage_not_found",
    "passage_ambiguous",
  ];
  const success = acquisition.outcome === "passage_retained" ||
    acquisition.outcome === "abstract_passage_retained";
  if (
    acquisition.schemaVersion !==
      SIX_SCREEN_SCHOLARLY_DOCUMENT_ACQUISITION_VERSION ||
    acquisition.acquisitionFingerprint !==
      fingerprintSixScreenValue(acquisitionBody(acquisition)) ||
    !outcomes.includes(acquisition.outcome) ||
    acquisition.ordinal !== acquisition.plan.ordinal ||
    acquisition.failureCode !== (success ? null : acquisition.outcome) ||
    Boolean(acquisition.document) !== success ||
    Boolean(acquisition.passage) !== success ||
    acquisition.claimBoundary !== ACQUISITION_BOUNDARY ||
    (acquisition.plan.initialStatus !== "pending" &&
      acquisition.outcome !== acquisition.plan.initialStatus) ||
    (acquisition.plan.initialStatus === "pending" &&
      (acquisition.attemptedUrl !== acquisition.plan.input.exactDocumentUrl ||
        acquisition.usage.documentAttempts !== 1 ||
        acquisition.usage.transportHops !== 1)) ||
    (acquisition.plan.initialStatus !== "pending" &&
      (acquisition.attemptedUrl !== null ||
        acquisition.usage.documentAttempts !== 0 ||
        acquisition.usage.usefulDocuments !== 0 ||
        acquisition.usage.transportHops !== 0 ||
        acquisition.usage.receivedBytes !== 0 ||
        acquisition.usage.decodedBytes !== 0 ||
        acquisition.usage.activeResearchMs !== 0 ||
        acquisition.usage.cpuMs !== 0)) ||
    (success && acquisition.usage.usefulDocuments !== 1) ||
    (!success && acquisition.usage.usefulDocuments !== 0)
  ) throw new Error("Scholarly document acquisition is invalid.");
  requireBoundedIdentifier(acquisition.id, "Scholarly document acquisition id");
  requireCanonicalInstant(acquisition.startedAt, "Scholarly acquisition startedAt");
  requireCanonicalInstant(acquisition.completedAt, "Scholarly acquisition completedAt");
  if (
    Date.parse(acquisition.plan.createdAt) > Date.parse(acquisition.startedAt) ||
    Date.parse(acquisition.startedAt) > Date.parse(acquisition.completedAt)
  ) throw new Error("Scholarly document acquisition chronology is invalid.");
  requireText(acquisition.note, "Scholarly acquisition note", 2_000);
  usageValid(acquisition.usage);
  if (acquisition.attemptedUrl) {
    if (
      acquisition.attemptedUrl !== acquisition.plan.input.exactDocumentUrl
    ) throw new Error("Scholarly acquisition attempted a different URL.");
    requireSanitizedSourceUrl(acquisition.attemptedUrl);
  }
  if (acquisition.document && acquisition.passage) {
    validateScholarlyInspectedDocument(acquisition.document);
    validateScholarlyInspectedPassage(acquisition.passage);
    if (
      acquisition.document.targetReference.targetId !== acquisition.plan.target.id ||
      acquisition.document.targetReference.targetFingerprint !==
        acquisition.plan.target.targetFingerprint ||
      acquisition.document.targetReference.originId !==
        acquisition.plan.target.originId ||
      acquisition.document.targetReference.originFingerprint !==
        acquisition.plan.target.originFingerprint ||
      acquisition.document.sourceFamily !== acquisition.plan.sourceFamily ||
      acquisition.document.canonicalUrl !== acquisition.attemptedUrl ||
      acquisition.document.inspectionStatus !==
        acquisition.plan.input.inspectionMode ||
      acquisition.document.access.basis !== acquisition.plan.input.accessBasis ||
      acquisition.document.passageIds[0] !== acquisition.passage.id ||
      acquisition.document.receivedBytes !== acquisition.usage.receivedBytes ||
      acquisition.passage.sourceId !== acquisition.document.sourceId ||
      acquisition.passage.documentVersionId !==
        acquisition.document.documentVersionId ||
      acquisition.passage.sourceTextHash !==
        acquisition.document.normalizedTextHash ||
      acquisition.passage.exactText !== acquisition.plan.input.exactPassage ||
      acquisition.passage.inspectionStatus !==
        acquisition.plan.input.inspectionMode ||
      acquisition.passage.purpose !== acquisition.plan.input.passagePurpose ||
      acquisition.outcome !== (acquisition.passage.inspectionStatus ===
          "abstract_only"
        ? "abstract_passage_retained"
        : "passage_retained") ||
      (acquisition.plan.target.doi !== null &&
        acquisition.document.doi !== acquisition.plan.target.doi)
    ) throw new Error("Scholarly retained document/passage lineage is invalid.");
  }
  return acquisition;
}

function packetBody(packet: ScholarlyPassagePacket): PacketBody {
  const { packetFingerprint: _fingerprint, ...body } = packet;
  return body;
}

export function createScholarlyPassagePacket(input: {
  snapshotId: string;
  metadataPacket: ScholarlyEvidencePacket;
  acquisition: ScholarlyDocumentAcquisition;
  previous: ScholarlyPassagePacket | null;
  acquisitions: readonly ScholarlyDocumentAcquisition[];
  createdAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Scholarly passage packet id");
  requireCanonicalInstant(input.createdAt, "Scholarly passage packet createdAt");
  input.acquisitions.forEach(validateScholarlyDocumentAcquisition);
  if (
    input.acquisitions.at(-1)?.id !== input.acquisition.id ||
    input.acquisition.plan.binding.metadataPacketSnapshotId !==
      input.metadataPacket.snapshotId ||
    input.acquisition.plan.binding.metadataPacketFingerprint !==
      input.metadataPacket.packetFingerprint
  ) throw new Error("Scholarly passage packet requires exact cumulative acquisitions.");
  const documents = input.acquisitions.flatMap(({ document }) =>
    document ? [document] : []
  );
  const passages = input.acquisitions.flatMap(({ passage }) =>
    passage ? [passage] : []
  );
  const body: PacketBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_PASSAGE_PACKET_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.acquisition.ordinal,
    binding: {
      ...structuredClone(input.acquisition.plan.binding),
      acquisitionId: input.acquisition.id,
      acquisitionFingerprint: input.acquisition.acquisitionFingerprint,
      previousPassagePacketSnapshotId: input.previous?.snapshotId ?? null,
    },
    acquisitionReferences: input.acquisitions.map((acquisition) => ({
      acquisitionId: acquisition.id,
      acquisitionFingerprint: acquisition.acquisitionFingerprint,
      outcome: acquisition.outcome,
    })),
    documentReferences: documents.map((document) => ({
      documentId: document.id,
      documentFingerprint: document.documentFingerprint,
      documentVersionId: document.documentVersionId,
      contentHash: document.contentHash,
      inspectionStatus: document.inspectionStatus,
    })),
    passageReferences: passages.map((passage) => ({
      passageId: passage.id,
      passageFingerprint: passage.passageFingerprint,
      documentVersionId: passage.documentVersionId,
      exactOffsets: {
        start: passage.startOffset,
        end: passage.endOffset,
      },
      detailedClaimUse: passage.detailedClaimUse,
    })),
    eligiblePassageIds: passages.filter(({ detailedClaimUse }) =>
      detailedClaimUse === "eligible_for_later_researcher_review"
    ).map(({ id }) => id),
    abstractOnlyPassageIds: passages.filter(({ detailedClaimUse }) =>
      detailedClaimUse === "abstract_only_not_eligible"
    ).map(({ id }) => id),
    detailedClaims: {
      status: "not_extracted_or_reviewed",
      claimIds: [],
    },
    mechanismGeneration: {
      status: "blocked",
      reasons: [
        "genuine_intelligence_path_unverified",
        "scholarly_claims_not_reviewed",
      ],
    },
    mechanismCandidates: [],
    predictionMatrix: null,
    claimBoundary: PASSAGE_PACKET_BOUNDARY,
    createdAt: input.createdAt,
  };
  const packet = {
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScholarlyPassagePacket(packet, {
    metadataPacket: input.metadataPacket,
    acquisition: input.acquisition,
    previous: input.previous,
    acquisitions: input.acquisitions,
  });
}

export function validateScholarlyPassagePacket(
  packet: ScholarlyPassagePacket,
  context: {
    metadataPacket: ScholarlyEvidencePacket;
    acquisition: ScholarlyDocumentAcquisition;
    previous: ScholarlyPassagePacket | null;
    acquisitions: readonly ScholarlyDocumentAcquisition[];
  },
) {
  const documents = context.acquisitions.flatMap(({ document }) =>
    document ? [document] : []
  );
  const passages = context.acquisitions.flatMap(({ passage }) =>
    passage ? [passage] : []
  );
  if (
    packet.schemaVersion !== SIX_SCREEN_SCHOLARLY_PASSAGE_PACKET_VERSION ||
    packet.packetFingerprint !== fingerprintSixScreenValue(packetBody(packet)) ||
    packet.ordinal !== context.acquisition.ordinal ||
    packet.binding.metadataPacketSnapshotId !== context.metadataPacket.snapshotId ||
    packet.binding.metadataPacketFingerprint !== context.metadataPacket.packetFingerprint ||
    packet.binding.acquisitionId !== context.acquisition.id ||
    packet.binding.acquisitionFingerprint !==
      context.acquisition.acquisitionFingerprint ||
    packet.binding.previousPassagePacketSnapshotId !==
      (context.previous?.snapshotId ?? null) ||
    packet.acquisitionReferences.length !== context.acquisitions.length ||
    packet.documentReferences.length !== documents.length ||
    packet.passageReferences.length !== passages.length ||
    packet.detailedClaims.status !== "not_extracted_or_reviewed" ||
    packet.detailedClaims.claimIds.length !== 0 ||
    packet.mechanismGeneration.status !== "blocked" ||
    packet.mechanismGeneration.reasons.join("\u0000") !==
      "genuine_intelligence_path_unverified\u0000scholarly_claims_not_reviewed" ||
    packet.mechanismCandidates.length !== 0 || packet.predictionMatrix !== null ||
    packet.claimBoundary !== PASSAGE_PACKET_BOUNDARY ||
    bytes(packet) > SIX_SCREEN_SCHOLARLY_DOCUMENT_COLLECTION_MAX_BYTES
  ) throw new Error("Scholarly passage packet is invalid.");
  requireBoundedIdentifier(packet.snapshotId, "Scholarly passage packet id");
  requireCanonicalInstant(packet.createdAt, "Scholarly passage packet createdAt");
  for (const [index, reference] of packet.acquisitionReferences.entries()) {
    const acquisition = context.acquisitions[index];
    if (
      !acquisition || reference.acquisitionId !== acquisition.id ||
      reference.acquisitionFingerprint !== acquisition.acquisitionFingerprint ||
      reference.outcome !== acquisition.outcome
    ) throw new Error("Scholarly passage packet changed acquisition lineage.");
  }
  for (const [index, reference] of packet.documentReferences.entries()) {
    const document = documents[index];
    if (!document || reference.documentId !== document.id ||
        reference.documentFingerprint !== document.documentFingerprint ||
        reference.documentVersionId !== document.documentVersionId ||
        reference.contentHash !== document.contentHash ||
        reference.inspectionStatus !== document.inspectionStatus) {
      throw new Error("Scholarly passage packet changed document lineage.");
    }
  }
  for (const [index, reference] of packet.passageReferences.entries()) {
    const passage = passages[index];
    if (!passage || reference.passageId !== passage.id ||
        reference.passageFingerprint !== passage.passageFingerprint ||
        reference.documentVersionId !== passage.documentVersionId ||
        reference.exactOffsets.start !== passage.startOffset ||
        reference.exactOffsets.end !== passage.endOffset ||
        reference.detailedClaimUse !== passage.detailedClaimUse) {
      throw new Error("Scholarly passage packet changed passage lineage.");
    }
  }
  const eligible = passages.filter(({ detailedClaimUse }) =>
    detailedClaimUse === "eligible_for_later_researcher_review"
  ).map(({ id }) => id);
  const abstracts = passages.filter(({ detailedClaimUse }) =>
    detailedClaimUse === "abstract_only_not_eligible"
  ).map(({ id }) => id);
  if (
    packet.eligiblePassageIds.join("\u0000") !== eligible.join("\u0000") ||
    packet.abstractOnlyPassageIds.join("\u0000") !== abstracts.join("\u0000")
  ) throw new Error("Scholarly passage eligibility is inconsistent.");
  return packet;
}

export function validateScholarlyDocumentCollections(input: {
  literaturePlans: readonly MechanismLiteraturePlan[];
  metadataExecutions: readonly MechanismLiteratureExecution[];
  metadataRecords: readonly ScholarlyMetadataRecord[];
  metadataPackets: readonly ScholarlyEvidencePacket[];
  acquisitions: readonly ScholarlyDocumentAcquisition[];
  passagePackets: readonly ScholarlyPassagePacket[];
}) {
  if (
    input.acquisitions.length > SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_HISTORY ||
    input.passagePackets.length !== input.acquisitions.length ||
    bytes({ acquisitions: input.acquisitions, passagePackets: input.passagePackets }) >
      SIX_SCREEN_SCHOLARLY_DOCUMENT_COLLECTION_MAX_BYTES
  ) throw new Error("Stored scholarly document history exceeds its bounded contract.");
  const planMap = new Map(input.literaturePlans.map((plan) =>
    [plan.snapshotId, plan]
  ));
  const executionMap = new Map(input.metadataExecutions.map((execution) =>
    [execution.snapshotId, execution]
  ));
  const packetMap = new Map(input.metadataPackets.map((packet) =>
    [packet.snapshotId, packet]
  ));
  const packetIds = new Set<string>();
  const acquisitionIds = new Set<string>();
  for (const [index, acquisition] of input.acquisitions.entries()) {
    validateScholarlyDocumentAcquisition(acquisition);
    if (acquisitionIds.has(acquisition.id)) {
      throw new Error("Stored scholarly acquisition ids must be unique.");
    }
    acquisitionIds.add(acquisition.id);
    const literaturePlan = planMap.get(
      acquisition.plan.binding.literaturePlanSnapshotId,
    );
    const execution = executionMap.get(
      acquisition.plan.binding.metadataExecutionSnapshotId,
    );
    const metadataPacket = packetMap.get(
      acquisition.plan.binding.metadataPacketSnapshotId,
    );
    if (!literaturePlan || !execution || !metadataPacket) {
      throw new Error("Stored scholarly acquisition lost its metadata parent.");
    }
    const records = execution.scholarlyMetadataRecordIds.map((id) => {
      const record = input.metadataRecords.find(({ id: found }) => found === id);
      if (!record) throw new Error("Stored scholarly acquisition lost metadata.");
      return record;
    });
    const prior = input.acquisitions.slice(0, index).filter((item) =>
      item.plan.binding.metadataPacketSnapshotId === metadataPacket.snapshotId
    );
    validateScholarlyDocumentInspectionPlan(acquisition.plan, {
      literaturePlan,
      metadataExecution: execution,
      metadataPacket,
      metadataRecords: records,
      priorAcquisitions: prior,
    });
    const packet = input.passagePackets[index];
    if (!packet || packetIds.has(packet.snapshotId)) {
      throw new Error("Stored scholarly passage packet ids are invalid.");
    }
    packetIds.add(packet.snapshotId);
    const priorPackets = input.passagePackets.slice(0, index).filter((item) =>
      item.binding.metadataPacketSnapshotId === metadataPacket.snapshotId
    );
    validateScholarlyPassagePacket(packet, {
      metadataPacket,
      acquisition,
      previous: priorPackets.at(-1) ?? null,
      acquisitions: [...prior, acquisition],
    });
  }
  return input;
}
