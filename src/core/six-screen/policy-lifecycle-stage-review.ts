import { fingerprintSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  type TypedDate,
} from "./contracts";
import type { CoEventCandidateOccurrence } from "./co-event-execution";
import type { CoEventPolicyLifecycleHandoff } from
  "./co-event-policy-lifecycle-handoff";
import {
  validateResourceAccount,
  type ResearchTaskOperationUsage,
} from "./research-task";

export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_ACQUISITION_VERSION =
  "screen-02-policy-lifecycle-stage-acquisition-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_DISPOSITION_VERSION =
  "screen-02-policy-lifecycle-stage-disposition-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION =
  "screen-02-policy-lifecycle-stage-source-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_ACQUISITIONS = 64;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_DISPOSITIONS = 128;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVIEW_MAX_BYTES = 256_000;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF = 2;
export const SIX_SCREEN_POLICY_LIFECYCLE_MAX_RETAINED_PASSAGE_CHARACTERS =
  24_000;

export const POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY =
  "This bounded Screen 2 action retains an exact official-document identity and selected source passages for researcher disposition. Acquisition alone does not establish that the document belongs to the focal policy lifecycle. Accept, reject, or defer records a researcher decision for later Event Card review; it does not silently change chronology, rewrite or lock an Event Card, classify an independent event, assess a causal relation, or add a control." as const;

export type PolicyLifecycleStageDocumentOutcome =
  | "document_retained"
  | "source_unavailable"
  | "wrong_document"
  | "unsupported_source"
  | "unsupported_format"
  | "response_limit"
  | "unparsed";

export type PolicyLifecycleStageDocumentFailureCode = Exclude<
  PolicyLifecycleStageDocumentOutcome,
  "document_retained"
>;

export type PolicyLifecycleStageFocalAnchorKind =
  | "formal_identifier"
  | "official_title";

export type PolicyLifecycleStageOfficialSource = {
  schemaVersion: typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION;
  sourceId: string;
  documentVersionId: string;
  provider: "federal_register";
  nativeDocumentNumber: string;
  title: string;
  publisher: string;
  issuer: string | null;
  author: string | null;
  jurisdiction: "United States";
  role: "official structured record";
  documentType: "Federal Register publication representation";
  language: "en";
  canonicalUrl: string;
  publicationDate: string | null;
  legalVersionDates: TypedDate[];
  retrievedAt: string;
  representation: "html" | "text";
  contentHash: string;
  acquisitionProvenance: "direct";
  accessStatus: "retained_passage";
  rightsStatus: "public-government-record";
  parserVersion: string;
  textQualityStatus: "visible-text parsed; bounded exact retained spans";
  inspectedText: "partial";
  parsedTextLength: number;
  retainedPassages: Array<{
    id: string;
    sourceId: string;
    documentVersionId: string;
    exactText: string;
    locator: string;
    startOffset: number;
    endOffset: number;
    focalPolicyAnchorKinds: PolicyLifecycleStageFocalAnchorKind[];
    qualification: string;
    unresolvedCrossReferences: string[];
  }>;
  focalPolicyReferenceStatus:
    | "exact_identifier_found"
    | "exact_title_found"
    | "not_found_in_retained_passages";
  sourceSnapshotFingerprint: string;
};

export type PolicyLifecycleStageDocumentAcquisition = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_ACQUISITION_VERSION;
  id: string;
  ordinal: number;
  handoffReference: {
    handoffId: string;
    handoffFingerprint: string;
    candidateId: string;
    candidateFingerprint: string;
    targetPolicyEventCardReviewId: string;
  };
  adapter: {
    provider: "federal_register";
    version: string;
  };
  requestedBy: "researcher";
  executedBy: "deterministic_adapter";
  attemptedSources: string[];
  outcome: PolicyLifecycleStageDocumentOutcome;
  failureCode: PolicyLifecycleStageDocumentFailureCode | null;
  limitation: string | null;
  source: PolicyLifecycleStageOfficialSource | null;
  usage: ResearchTaskOperationUsage;
  acquiredAt: string;
  chronologyMutation: "none";
  eventCardMutation: "none";
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY;
  acquisitionFingerprint: string;
};

export type PolicyLifecycleStageDispositionDecision =
  | "accepted_for_event_card_review"
  | "rejected_as_focal_policy_stage"
  | "deferred";

export type PolicyLifecycleStageDisposition = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_DISPOSITION_VERSION;
  id: string;
  ordinal: number;
  handoffReference: {
    handoffId: string;
    handoffFingerprint: string;
    targetPolicyEventCardReviewId: string;
  };
  acquisitionReference: {
    acquisitionId: string;
    acquisitionFingerprint: string;
    sourceSnapshotFingerprint: string;
  };
  decision: PolicyLifecycleStageDispositionDecision;
  rationale: string;
  actor: "researcher";
  reviewedAt: string;
  legalVerificationStatus: "researcher_decision_not_legal_verification";
  sourceDocumentPreserved: true;
  chronologyMutation: "none";
  eventCardMutation: "none";
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY;
  dispositionFingerprint: string;
};

type OfficialSourceBody = Omit<
  PolicyLifecycleStageOfficialSource,
  "sourceSnapshotFingerprint"
>;
type AcquisitionBody = Omit<
  PolicyLifecycleStageDocumentAcquisition,
  "acquisitionFingerprint"
>;
type DispositionBody = Omit<
  PolicyLifecycleStageDisposition,
  "dispositionFingerprint"
>;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max: number) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${max} characters.`,
    );
  }
  return value;
}

function validateLegalVersionDate(value: TypedDate) {
  if (
    ![
      "announcement",
      "adoption",
      "publication",
      "scheduled_effect",
      "legal_effect",
      "compliance",
      "implementation",
      "enforcement",
      "amendment",
      "injunction",
      "invalidation",
      "withdrawal",
      "suspension",
      "repeal",
      "supersession",
      "other",
    ].includes(value.kind) ||
    !["day", "month", "year", "interval", "unknown"].includes(
      value.precision,
    ) ||
    (value.start !== null && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(
      value.start,
    )) ||
    (value.end !== null && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(
      value.end,
    )) ||
    (value.start === null && value.end === null) ||
    value.passageIds.some((id) => {
      try {
        requireBoundedIdentifier(id, "Policy-lifecycle legal-date passage id");
        return false;
      } catch {
        return true;
      }
    }) ||
    new Set(value.passageIds).size !== value.passageIds.length
  ) throw new Error("Policy-lifecycle legal-version date is invalid.");
}

function requireExactFederalRegisterDocumentUrl(
  value: string,
  documentNumber: string,
) {
  const canonical = requireSanitizedSourceUrl(value);
  const url = new URL(canonical);
  const escaped = documentNumber.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (
    !["www.federalregister.gov", "federalregister.gov"].includes(
      url.hostname.toLocaleLowerCase("en-US"),
    ) || url.port || url.search || ![
      new RegExp(
        `^/documents/full_text/(?:html|text)/\\d{4}/\\d{2}/\\d{2}/${escaped}\\.(?:html|txt)$`,
        "u",
      ),
      new RegExp(
        `^/documents/\\d{4}/\\d{2}/\\d{2}/${escaped}(?:/[^/]+)?/?$`,
        "u",
      ),
      new RegExp(`^/d/${escaped}/?$`, "u"),
    ].some((pattern) => pattern.test(url.pathname))
  ) throw new Error(
    "Policy-lifecycle source URL must identify the exact Federal Register document.",
  );
  return canonical;
}

function exactCandidateFederalRegisterDocumentNumber(
  candidate: CoEventCandidateOccurrence,
) {
  const values = new Set([
    candidate.sourceNativeId,
    ...candidate.formalIdentifiers,
  ].flatMap((value) => value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []));
  return values.size === 1 ? [...values][0]! : null;
}

export function policyLifecycleStagePublicationDate(
  candidate: CoEventCandidateOccurrence,
) {
  return candidate.typedDates.find(({ kind }) => kind === "publication")
    ?.value ?? candidate.evidence.find(({ publishedDate }) => publishedDate)
    ?.publishedDate ?? null;
}

export function policyLifecycleStageLegalVersionDates(
  candidate: CoEventCandidateOccurrence,
) {
  const values: TypedDate[] = candidate.typedDates
    .filter(({ kind }) => kind === "effective")
    .map(({ value, precision }) => ({
      start: value,
      end: null,
      precision,
      kind: "legal_effect",
      passageIds: [],
    }));
  return values.filter((value, index) =>
    values.findIndex((candidateValue) =>
      candidateValue.start === value.start &&
      candidateValue.precision === value.precision
    ) === index);
}

function sourceBody(source: PolicyLifecycleStageOfficialSource) {
  const { sourceSnapshotFingerprint: _fingerprint, ...body } = source;
  return body;
}

function acquisitionBody(acquisition: PolicyLifecycleStageDocumentAcquisition) {
  const { acquisitionFingerprint: _fingerprint, ...body } = acquisition;
  return body;
}

function dispositionBody(disposition: PolicyLifecycleStageDisposition) {
  const { dispositionFingerprint: _fingerprint, ...body } = disposition;
  return body;
}

function validateOfficialSource(source: PolicyLifecycleStageOfficialSource) {
  if (
    source.schemaVersion !== SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION ||
    source.provider !== "federal_register" ||
    source.jurisdiction !== "United States" ||
    source.role !== "official structured record" ||
    source.documentType !== "Federal Register publication representation" ||
    source.language !== "en" ||
    source.acquisitionProvenance !== "direct" ||
    source.accessStatus !== "retained_passage" ||
    source.rightsStatus !== "public-government-record" ||
    source.textQualityStatus !==
      "visible-text parsed; bounded exact retained spans" ||
    source.inspectedText !== "partial" ||
    !["html", "text"].includes(source.representation) ||
    source.sourceSnapshotFingerprint !==
      fingerprintSixScreenValue(sourceBody(source)) ||
    !/^\d{4}-\d{4,6}$/u.test(source.nativeDocumentNumber) ||
    !/^sha256:[0-9a-f]{64}$/u.test(source.contentHash) ||
    !Number.isSafeInteger(source.parsedTextLength) ||
    source.parsedTextLength < 1 ||
    ![
      "exact_identifier_found",
      "exact_title_found",
      "not_found_in_retained_passages",
    ].includes(source.focalPolicyReferenceStatus)
  ) throw new Error("Stored policy-lifecycle official source is invalid.");
  requireBoundedIdentifier(source.sourceId, "Policy-lifecycle source id");
  requireBoundedIdentifier(
    source.documentVersionId,
    "Policy-lifecycle document version id",
  );
  requireFingerprint(
    source.sourceSnapshotFingerprint,
    "Policy-lifecycle source fingerprint",
  );
  requireText(source.title, "Policy-lifecycle source title", 1_000);
  requireText(source.publisher, "Policy-lifecycle source publisher", 500);
  if (source.issuer !== null) {
    requireText(source.issuer, "Policy-lifecycle source issuer", 500);
  }
  if (source.author !== null) {
    requireText(source.author, "Policy-lifecycle source author", 500);
  }
  requireText(source.parserVersion, "Policy-lifecycle parser version", 200);
  requireExactFederalRegisterDocumentUrl(
    source.canonicalUrl,
    source.nativeDocumentNumber,
  );
  requireCanonicalInstant(source.retrievedAt, "Policy-lifecycle source retrieval");
  if (
    source.publicationDate !== null &&
    !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(source.publicationDate)
  ) throw new Error("Policy-lifecycle publication date is invalid.");
  if (
    source.legalVersionDates.length > 16 ||
    new Set(source.legalVersionDates.map((date) =>
      fingerprintSixScreenValue(date))).size !== source.legalVersionDates.length
  ) throw new Error("Policy-lifecycle legal-version dates are invalid.");
  source.legalVersionDates.forEach(validateLegalVersionDate);
  if (!source.retainedPassages.length || source.retainedPassages.length > 6) {
    throw new Error("Policy-lifecycle source passages are invalid.");
  }
  let passageCharacters = 0;
  const passageIds = new Set<string>();
  let identifierFound = false;
  let titleFound = false;
  let previousPassageEnd = -1;
  for (const passage of source.retainedPassages) {
    requireBoundedIdentifier(passage.id, "Policy-lifecycle passage id");
    if (passageIds.has(passage.id)) {
      throw new Error("Policy-lifecycle passage ids must be unique.");
    }
    passageIds.add(passage.id);
    if (
      passage.sourceId !== source.sourceId ||
      passage.documentVersionId !== source.documentVersionId
    ) throw new Error("Policy-lifecycle passage binding is invalid.");
    requireText(passage.exactText, "Policy-lifecycle exact passage", 8_000);
    requireText(passage.locator, "Policy-lifecycle passage locator", 500);
    requireText(passage.qualification, "Policy-lifecycle qualification", 1_000);
    if (
      !Number.isSafeInteger(passage.startOffset) ||
      !Number.isSafeInteger(passage.endOffset) ||
      passage.startOffset < 0 ||
      passage.startOffset < previousPassageEnd ||
      passage.endOffset <= passage.startOffset ||
      passage.endOffset - passage.startOffset !== passage.exactText.length ||
      passage.endOffset > source.parsedTextLength ||
      new Set(passage.focalPolicyAnchorKinds).size !==
        passage.focalPolicyAnchorKinds.length ||
      passage.focalPolicyAnchorKinds.some((kind) =>
        !["formal_identifier", "official_title"].includes(kind))
      || passage.unresolvedCrossReferences.length > 20
      || new Set(passage.unresolvedCrossReferences).size !==
        passage.unresolvedCrossReferences.length
    ) throw new Error("Policy-lifecycle passage coordinates are invalid.");
    for (const reference of passage.unresolvedCrossReferences) {
      requireText(
        reference,
        "Policy-lifecycle unresolved cross-reference",
        500,
      );
    }
    passageCharacters += passage.exactText.length;
    previousPassageEnd = passage.endOffset;
    identifierFound ||= passage.focalPolicyAnchorKinds.includes(
      "formal_identifier",
    );
    titleFound ||= passage.focalPolicyAnchorKinds.includes("official_title");
  }
  if (
    passageCharacters >
      SIX_SCREEN_POLICY_LIFECYCLE_MAX_RETAINED_PASSAGE_CHARACTERS ||
    source.legalVersionDates.some(({ passageIds: supportingPassageIds }) =>
      supportingPassageIds.some((id) => !passageIds.has(id))) ||
    (source.focalPolicyReferenceStatus === "exact_identifier_found" &&
      !identifierFound) ||
    (source.focalPolicyReferenceStatus === "exact_title_found" &&
      (identifierFound || !titleFound)) ||
    (source.focalPolicyReferenceStatus ===
        "not_found_in_retained_passages" && (identifierFound || titleFound))
  ) throw new Error("Policy-lifecycle focal-policy anchors are invalid.");
  return source;
}

export function createPolicyLifecycleStageOfficialSource(
  body: OfficialSourceBody,
) {
  const source = {
    ...structuredClone(body),
    sourceSnapshotFingerprint: fingerprintSixScreenValue(body),
  };
  return validateOfficialSource(source);
}

export function createPolicyLifecycleStageDocumentAcquisition(input: {
  id: string;
  ordinal: number;
  handoff: CoEventPolicyLifecycleHandoff;
  candidate: CoEventCandidateOccurrence;
  adapterVersion: string;
  attemptedSources: string[];
  outcome: PolicyLifecycleStageDocumentOutcome;
  failureCode: PolicyLifecycleStageDocumentFailureCode | null;
  limitation: string | null;
  source: PolicyLifecycleStageOfficialSource | null;
  usage: ResearchTaskOperationUsage;
  acquiredAt: string;
}) {
  requireBoundedIdentifier(input.id, "Policy-lifecycle acquisition id");
  requireCanonicalInstant(input.acquiredAt, "Policy-lifecycle acquisition time");
  requireText(input.adapterVersion, "Policy-lifecycle adapter version", 200);
  const expectedDocumentNumber =
    exactCandidateFederalRegisterDocumentNumber(input.candidate);
  if (
    input.handoff.candidateReference.candidateId !== input.candidate.id ||
    input.handoff.candidateReference.candidateFingerprint !==
      input.candidate.candidateFingerprint ||
    input.handoff.candidateReference.providerId !== "federal_register" ||
    input.candidate.providerId !== "federal_register" ||
    !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 ||
    new Set(input.attemptedSources).size !== input.attemptedSources.length ||
    input.attemptedSources.length > 2 ||
    ((input.attemptedSources.length > 0 || input.source) &&
      !expectedDocumentNumber)
  ) throw new Error("Policy-lifecycle acquisition lineage is invalid.");
  input.attemptedSources.forEach((value) =>
    requireExactFederalRegisterDocumentUrl(
      value,
      expectedDocumentNumber!,
    ));
  validateResourceAccount(input.usage, "Policy-lifecycle acquisition usage");
  if (
    ![
      "document_retained",
      "source_unavailable",
      "wrong_document",
      "unsupported_source",
      "unsupported_format",
      "response_limit",
      "unparsed",
    ].includes(input.outcome) ||
    input.usage.documentAttempts !== input.attemptedSources.length ||
    (input.outcome === "document_retained" &&
      (input.failureCode !== null || !input.source ||
        !input.attemptedSources.length ||
        input.usage.usefulDocuments !== 1)) ||
    (input.outcome !== "document_retained" &&
      (input.failureCode !== input.outcome || input.source !== null ||
        input.usage.usefulDocuments !== 0 || !input.limitation))
  ) throw new Error("Policy-lifecycle acquisition outcome is inconsistent.");
  if (input.source) {
    validateOfficialSource(input.source);
    const expectedPublishers = new Set(
      input.candidate.evidence.map(({ publisher }) => publisher),
    );
    if (
      input.source.nativeDocumentNumber !== expectedDocumentNumber ||
      input.source.title !== input.candidate.title ||
      !expectedPublishers.has(input.source.publisher) ||
      input.source.publicationDate !==
        policyLifecycleStagePublicationDate(input.candidate) ||
      fingerprintSixScreenValue(input.source.legalVersionDates) !==
        fingerprintSixScreenValue(
          policyLifecycleStageLegalVersionDates(input.candidate),
        ) ||
      input.source.retrievedAt < input.candidate.recordedAt ||
      input.source.retrievedAt > input.acquiredAt
    ) throw new Error("Policy-lifecycle source identity is inconsistent.");
  }
  const body: AcquisitionBody = {
    schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_ACQUISITION_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    handoffReference: {
      handoffId: input.handoff.id,
      handoffFingerprint: input.handoff.handoffFingerprint,
      candidateId: input.candidate.id,
      candidateFingerprint: input.candidate.candidateFingerprint,
      targetPolicyEventCardReviewId:
        input.handoff.destination.policyEventCardReviewId,
    },
    adapter: {
      provider: "federal_register",
      version: input.adapterVersion,
    },
    requestedBy: "researcher",
    executedBy: "deterministic_adapter",
    attemptedSources: [...input.attemptedSources],
    outcome: input.outcome,
    failureCode: input.failureCode,
    limitation: input.limitation,
    source: input.source ? structuredClone(input.source) : null,
    usage: structuredClone(input.usage),
    acquiredAt: input.acquiredAt,
    chronologyMutation: "none",
    eventCardMutation: "none",
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY,
  };
  const acquisition = {
    ...body,
    acquisitionFingerprint: fingerprintSixScreenValue(body),
  };
  return validatePolicyLifecycleStageDocumentAcquisition(
    acquisition,
    input.handoff,
    input.candidate,
  );
}

export function validatePolicyLifecycleStageDocumentAcquisition(
  acquisition: PolicyLifecycleStageDocumentAcquisition,
  handoff: CoEventPolicyLifecycleHandoff,
  candidate: CoEventCandidateOccurrence,
) {
  const expectedDocumentNumber =
    exactCandidateFederalRegisterDocumentNumber(candidate);
  if (
    acquisition.schemaVersion !==
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_ACQUISITION_VERSION ||
    acquisition.acquisitionFingerprint !==
      fingerprintSixScreenValue(acquisitionBody(acquisition)) ||
    acquisition.handoffReference.handoffId !== handoff.id ||
    acquisition.handoffReference.handoffFingerprint !==
      handoff.handoffFingerprint ||
    acquisition.handoffReference.candidateId !== candidate.id ||
    acquisition.handoffReference.candidateFingerprint !==
      candidate.candidateFingerprint ||
    acquisition.handoffReference.targetPolicyEventCardReviewId !==
      handoff.destination.policyEventCardReviewId ||
    acquisition.adapter.provider !== "federal_register" ||
    acquisition.requestedBy !== "researcher" ||
    acquisition.executedBy !== "deterministic_adapter" ||
    acquisition.chronologyMutation !== "none" ||
    acquisition.eventCardMutation !== "none" ||
    acquisition.independentEventClassification !== "not_assessed" ||
    acquisition.relationToComparison.status !== "not_assessed" ||
    acquisition.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    acquisition.claimBoundary !== POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY ||
    !Number.isSafeInteger(acquisition.ordinal) || acquisition.ordinal < 1 ||
    acquisition.acquiredAt < handoff.routedAt
  ) throw new Error("Policy-lifecycle acquisition is invalid or changed.");
  requireBoundedIdentifier(acquisition.id, "Policy-lifecycle acquisition id");
  requireFingerprint(
    acquisition.acquisitionFingerprint,
    "Policy-lifecycle acquisition fingerprint",
  );
  requireCanonicalInstant(
    acquisition.acquiredAt,
    "Policy-lifecycle acquisition time",
  );
  requireText(
    acquisition.adapter.version,
    "Policy-lifecycle adapter version",
    200,
  );
  if (
    new Set(acquisition.attemptedSources).size !==
      acquisition.attemptedSources.length ||
    acquisition.attemptedSources.length > 2 ||
    ((acquisition.attemptedSources.length > 0 || acquisition.source) &&
      !expectedDocumentNumber)
  ) throw new Error("Policy-lifecycle attempted-source list is invalid.");
  acquisition.attemptedSources.forEach((value) =>
    requireExactFederalRegisterDocumentUrl(
      value,
      expectedDocumentNumber!,
    ));
  validateResourceAccount(
    acquisition.usage,
    "Policy-lifecycle acquisition usage",
  );
  if (
    ![
      "document_retained",
      "source_unavailable",
      "wrong_document",
      "unsupported_source",
      "unsupported_format",
      "response_limit",
      "unparsed",
    ].includes(acquisition.outcome) ||
    acquisition.usage.documentAttempts !==
      acquisition.attemptedSources.length ||
    (acquisition.outcome === "document_retained" &&
      (acquisition.failureCode !== null || !acquisition.source ||
        !acquisition.attemptedSources.length ||
        acquisition.usage.usefulDocuments !== 1)) ||
    (acquisition.outcome !== "document_retained" &&
      (acquisition.failureCode !== acquisition.outcome ||
        acquisition.source !== null ||
        acquisition.usage.usefulDocuments !== 0 || !acquisition.limitation))
  ) throw new Error("Policy-lifecycle acquisition outcome was changed.");
  if (acquisition.source) {
    validateOfficialSource(acquisition.source);
    const expectedPublishers = new Set(
      candidate.evidence.map(({ publisher }) => publisher),
    );
    if (
      acquisition.source.nativeDocumentNumber !== expectedDocumentNumber ||
      acquisition.source.title !== candidate.title ||
      !expectedPublishers.has(acquisition.source.publisher) ||
      acquisition.source.publicationDate !==
        policyLifecycleStagePublicationDate(candidate) ||
      fingerprintSixScreenValue(acquisition.source.legalVersionDates) !==
        fingerprintSixScreenValue(
          policyLifecycleStageLegalVersionDates(candidate),
        ) ||
      acquisition.source.retrievedAt < candidate.recordedAt ||
      acquisition.source.retrievedAt > acquisition.acquiredAt
    ) throw new Error("Policy-lifecycle source identity was changed.");
  }
  return acquisition;
}

export function createPolicyLifecycleStageDisposition(input: {
  id: string;
  ordinal: number;
  handoff: CoEventPolicyLifecycleHandoff;
  acquisition: PolicyLifecycleStageDocumentAcquisition;
  decision: PolicyLifecycleStageDispositionDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can dispose a possible policy-stage document.",
    );
  }
  requireBoundedIdentifier(input.id, "Policy-lifecycle disposition id");
  requireCanonicalInstant(input.reviewedAt, "Policy-lifecycle disposition time");
  const rationale = requireText(
    input.rationale,
    "Policy-lifecycle disposition rationale",
    2_000,
  );
  if (
    ![
      "accepted_for_event_card_review",
      "rejected_as_focal_policy_stage",
      "deferred",
    ].includes(input.decision) ||
    !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 ||
    input.acquisition.outcome !== "document_retained" ||
    !input.acquisition.source ||
    input.acquisition.handoffReference.handoffId !== input.handoff.id ||
    input.reviewedAt < input.acquisition.acquiredAt ||
    (input.decision === "accepted_for_event_card_review" &&
      input.acquisition.source.focalPolicyReferenceStatus ===
        "not_found_in_retained_passages")
  ) throw new Error(
    "Policy-stage disposition requires current retained official evidence; acceptance also requires an exact focal-policy anchor.",
  );
  const body: DispositionBody = {
    schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_DISPOSITION_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    handoffReference: {
      handoffId: input.handoff.id,
      handoffFingerprint: input.handoff.handoffFingerprint,
      targetPolicyEventCardReviewId:
        input.handoff.destination.policyEventCardReviewId,
    },
    acquisitionReference: {
      acquisitionId: input.acquisition.id,
      acquisitionFingerprint: input.acquisition.acquisitionFingerprint,
      sourceSnapshotFingerprint:
        input.acquisition.source.sourceSnapshotFingerprint,
    },
    decision: input.decision,
    rationale,
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    legalVerificationStatus: "researcher_decision_not_legal_verification",
    sourceDocumentPreserved: true,
    chronologyMutation: "none",
    eventCardMutation: "none",
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY,
  };
  const disposition = {
    ...body,
    dispositionFingerprint: fingerprintSixScreenValue(body),
  };
  return validatePolicyLifecycleStageDisposition(
    disposition,
    input.handoff,
    input.acquisition,
  );
}

export function validatePolicyLifecycleStageDisposition(
  disposition: PolicyLifecycleStageDisposition,
  handoff: CoEventPolicyLifecycleHandoff,
  acquisition: PolicyLifecycleStageDocumentAcquisition,
) {
  if (
    disposition.schemaVersion !==
      SIX_SCREEN_POLICY_LIFECYCLE_STAGE_DISPOSITION_VERSION ||
    disposition.dispositionFingerprint !==
      fingerprintSixScreenValue(dispositionBody(disposition)) ||
    disposition.handoffReference.handoffId !== handoff.id ||
    disposition.handoffReference.handoffFingerprint !==
      handoff.handoffFingerprint ||
    disposition.handoffReference.targetPolicyEventCardReviewId !==
      handoff.destination.policyEventCardReviewId ||
    disposition.acquisitionReference.acquisitionId !== acquisition.id ||
    disposition.acquisitionReference.acquisitionFingerprint !==
      acquisition.acquisitionFingerprint ||
    disposition.acquisitionReference.sourceSnapshotFingerprint !==
      acquisition.source?.sourceSnapshotFingerprint ||
    acquisition.outcome !== "document_retained" || !acquisition.source ||
    ![
      "accepted_for_event_card_review",
      "rejected_as_focal_policy_stage",
      "deferred",
    ].includes(disposition.decision) ||
    (disposition.decision === "accepted_for_event_card_review" &&
      acquisition.source.focalPolicyReferenceStatus ===
        "not_found_in_retained_passages") ||
    disposition.actor !== "researcher" ||
    disposition.reviewedAt < acquisition.acquiredAt ||
    disposition.legalVerificationStatus !==
      "researcher_decision_not_legal_verification" ||
    disposition.sourceDocumentPreserved !== true ||
    disposition.chronologyMutation !== "none" ||
    disposition.eventCardMutation !== "none" ||
    disposition.independentEventClassification !== "not_assessed" ||
    disposition.relationToComparison.status !== "not_assessed" ||
    disposition.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    disposition.claimBoundary !== POLICY_LIFECYCLE_STAGE_REVIEW_BOUNDARY ||
    !Number.isSafeInteger(disposition.ordinal) || disposition.ordinal < 1
  ) throw new Error("Policy-lifecycle disposition is invalid or changed.");
  requireBoundedIdentifier(disposition.id, "Policy-lifecycle disposition id");
  requireFingerprint(
    disposition.dispositionFingerprint,
    "Policy-lifecycle disposition fingerprint",
  );
  requireCanonicalInstant(
    disposition.reviewedAt,
    "Policy-lifecycle disposition time",
  );
  requireText(
    disposition.rationale,
    "Policy-lifecycle disposition rationale",
    2_000,
  );
  return disposition;
}

export function validatePolicyLifecycleStageReviewCollections(input: {
  handoffs: readonly CoEventPolicyLifecycleHandoff[];
  candidates: readonly CoEventCandidateOccurrence[];
  acquisitions: readonly PolicyLifecycleStageDocumentAcquisition[];
  dispositions: readonly PolicyLifecycleStageDisposition[];
}) {
  if (
    input.acquisitions.length >
      SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_ACQUISITIONS ||
    input.dispositions.length >
      SIX_SCREEN_POLICY_LIFECYCLE_MAX_STAGE_DISPOSITIONS ||
    bytes({
      acquisitions: input.acquisitions,
      dispositions: input.dispositions,
    }) > SIX_SCREEN_POLICY_LIFECYCLE_STAGE_REVIEW_MAX_BYTES ||
    new Set(input.acquisitions.map(({ id }) => id)).size !==
      input.acquisitions.length ||
    new Set(input.acquisitions.flatMap(({ source }) =>
      source ? [source.sourceId] : [])).size !==
      input.acquisitions.filter(({ source }) => source).length ||
    new Set(input.acquisitions.flatMap(({ source }) =>
      source ? [source.documentVersionId] : [])).size !==
      input.acquisitions.filter(({ source }) => source).length ||
    new Set(input.dispositions.map(({ id }) => id)).size !==
      input.dispositions.length
  ) throw new Error("Stored policy-lifecycle stage review exceeds capacity.");
  const handoffMap = new Map(input.handoffs.map((value) => [value.id, value]));
  const candidateMap = new Map(input.candidates.map((value) => [value.id, value]));
  const acquisitionMap = new Map(
    input.acquisitions.map((value) => [value.id, value]),
  );
  const acquisitionsByHandoff = new Map<
    string,
    PolicyLifecycleStageDocumentAcquisition[]
  >();
  let previousAcquiredAt: string | null = null;
  input.acquisitions.forEach((acquisition, index) => {
    const handoff = handoffMap.get(acquisition.handoffReference.handoffId);
    const candidate = candidateMap.get(acquisition.handoffReference.candidateId);
    if (
      !handoff || !candidate || acquisition.ordinal !== index + 1 ||
      (previousAcquiredAt !== null &&
        acquisition.acquiredAt < previousAcquiredAt)
    ) throw new Error("Stored policy-lifecycle acquisition references are invalid.");
    validatePolicyLifecycleStageDocumentAcquisition(
      acquisition,
      handoff,
      candidate,
    );
    const prior = acquisitionsByHandoff.get(handoff.id) ?? [];
    if (
      prior.length >=
        SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF ||
      prior.some(({ outcome }) => outcome === "document_retained") ||
      (prior.length && prior.at(-1)?.outcome !== "source_unavailable")
    ) throw new Error("Stored policy-lifecycle acquisition retry is invalid.");
    prior.push(acquisition);
    acquisitionsByHandoff.set(handoff.id, prior);
    previousAcquiredAt = acquisition.acquiredAt;
  });
  let previousReviewedAt: string | null = null;
  input.dispositions.forEach((disposition, index) => {
    const handoff = handoffMap.get(disposition.handoffReference.handoffId);
    const acquisition = acquisitionMap.get(
      disposition.acquisitionReference.acquisitionId,
    );
    if (
      !handoff || !acquisition || disposition.ordinal !== index + 1 ||
      (previousReviewedAt !== null && disposition.reviewedAt < previousReviewedAt) ||
      acquisitionsByHandoff.get(handoff.id)?.at(-1)?.id !== acquisition.id
    ) throw new Error("Stored policy-lifecycle disposition references are invalid.");
    validatePolicyLifecycleStageDisposition(
      disposition,
      handoff,
      acquisition,
    );
    previousReviewedAt = disposition.reviewedAt;
  });
  return input;
}
