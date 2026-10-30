import {
  HOST_REASONING_MESSAGE_CHANNELS,
  HOST_REASONING_TASK_STATUSES,
  HOST_REASONING_TASK_TYPES,
  fingerprintHostReasoningValue,
  type HostReasoningMessageChannel,
  type HostReasoningTaskStatus,
  type HostReasoningTaskType,
} from "./host-reasoning-task";
import {
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
} from "../version";

export const HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION =
  "shockaudit-host-reasoning-task-audit-bundle-v1" as const;
export const HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE =
  "host-reasoning-task-audit-bundle" as const;
export const HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION =
  "shockaudit-host-reasoning-run-audit-bundle-v1" as const;
export const HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE =
  "host-reasoning-run-audit-bundle" as const;
export const HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS = 32;
export const HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES = 96 * 1024;

export const HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "regulatedActivities",
  "platformRelationships",
  "contrastTerms",
  "falseFriends",
  "jurisdictionAliases",
] as const;

export type HostReasoningScreen02SearchReviewAuditProposal = {
  type: "screen02-search-review";
  normalizedSchemaVersion: "shockaudit-screen02-host-review-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  profileAdditionFields: Array<
    (typeof HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS)[number]
  >;
  candidateReviews: Array<{
    candidateId: string;
    proposedClass: "direct" | "adjacent" | "broad" | "mismatch";
    sourceIdsUsed: string[];
    sourceSpanSourceIds: string[];
    needsFollowUpRetrieval: boolean;
    rankingAdjustment: number;
  }>;
  followUpQueryCount: number;
  officialSourceLeadCount: number;
  rankingCount: number;
  outcomeValuesInspected: false;
};

export type HostReasoningScreen03EvidenceAuditProposal = {
  type: "screen03-evidence-mapping";
  normalizedSchemaVersion: "shockaudit-screen03-host-evidence-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  mappings: Array<{
    claimId: string;
    passageIds: string[];
    quotedSpanRanges: Array<{
      passageId: string;
      start: number;
      end: number;
    }>;
    supportStatus: "direct";
  }>;
  unmappedClaimIds: string[];
  conflictClaimIds: string[];
  sourceIdsReferenced: string[];
  outcomeValuesInspected: false;
};

export type HostReasoningScreen03OverviewAuditProposal = {
  type: "screen03-overview-improvement";
  normalizedSchemaVersion: "shockaudit-screen03-host-overview-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  summaryWordCount: number;
  keyPointCount: number;
  uncertaintyCount: number;
  sourceIds: string[];
  outcomeValuesInspected: false;
};

export type HostReasoningSixScreenPolicyFactProofAuditProposal = {
  type: "six-screen-policy-fact-proof";
  normalizedSchemaVersion:
    "shockaudit-six-screen-policy-fact-proof-result-v1";
  intelligenceKind: "policy_fact_extraction";
  origin: "chatgpt-host";
  nonCanonical: true;
  proofOnly: true;
  referenceCount: number;
  claimIds: string[];
  sourceIds: string[];
  scientificMutation: "none";
  outcomeValuesInspected: false;
};

export type HostReasoningSixScreenMechanismProofAuditProposal = {
  type: "six-screen-mechanism-proof";
  normalizedSchemaVersion:
    "shockaudit-six-screen-mechanism-proof-result-v1";
  intelligenceKind: "mechanism_proposal";
  origin: "chatgpt-host";
  nonCanonical: true;
  proofOnly: true;
  referenceCount: number;
  claimIds: string[];
  sourceIds: string[];
  stepCount: number;
  assumptionCount: number;
  alternativeExplanationCount: number;
  scholarlySupportStatus: "not_supplied_in_frozen_packet";
  causalStatus: "hypothesis_not_estimate";
  scientificMutation: "none";
  outcomeValuesInspected: false;
};

export type HostReasoningScreen04StudyEventAuditProposal = {
  type: "screen04-study-event-assessment";
  normalizedSchemaVersion:
    "shockaudit-screen04-study-event-assessment-result-v2";
  intelligenceKind: "study_event_assessment";
  origin: "chatgpt-host";
  nonCanonical: true;
  chainLinkCount: number;
  uncertaintyCount: number;
  nextCheckCount: number;
  sourceIds: string[];
  causalStatus: "conditional_assessment_not_classification";
  scientificMutation: "none";
  outcomeValuesInspected: false;
};

export type HostReasoningScreen05StudyMechanismAuditProposal = {
  type: "screen05-study-mechanism-comparison";
  normalizedSchemaVersion:
    "shockaudit-screen05-study-mechanism-comparison-result-v2";
  intelligenceKind: "study_mechanism_comparison";
  origin: "chatgpt-host";
  nonCanonical: true;
  mechanismCount: number;
  predictionCount: number;
  evidenceLimitationCount: number;
  sourceIds: string[];
  causalStatus: "conditional_comparison_not_mediation_estimate";
  scientificMutation: "none";
  outcomeValuesInspected: false;
};

export type HostReasoningScreen05TheoreticalPlanAuditProposal = {
  type: "screen05-theoretical-planning";
  normalizedSchemaVersion:
    "shockaudit-screen05-theoretical-planning-result-v1";
  intelligenceKind: "theoretical_mechanism_plan";
  origin: "chatgpt-host";
  nonCanonical: true;
  candidateCount: number;
  evidenceNeedCount: number;
  queryIntentCount: number;
  sourceIds: string[];
  scientificMutation: "none";
  outcomeValuesInspected: false;
};

export type HostReasoningAuditProposal =
  | HostReasoningScreen02SearchReviewAuditProposal
  | HostReasoningScreen03EvidenceAuditProposal
  | HostReasoningScreen03OverviewAuditProposal
  | HostReasoningSixScreenPolicyFactProofAuditProposal
  | HostReasoningSixScreenMechanismProofAuditProposal
  | HostReasoningScreen04StudyEventAuditProposal
  | HostReasoningScreen05TheoreticalPlanAuditProposal
  | HostReasoningScreen05StudyMechanismAuditProposal;

export type HostReasoningTaskAuditBundle = {
  schemaVersion: typeof HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION;
  type: typeof HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE;
  task: {
    taskId: string;
    taskType: HostReasoningTaskType;
    screen: "screen-02" | "screen-03" | "screen-04" | "screen-05";
    status: HostReasoningTaskStatus;
    coordinates: {
      runId: string;
      candidateId: string | null;
      candidatePoolId: string | null;
      selectedEventId: string | null;
      claimGroupId: string | null;
      scopeFingerprint: string;
      candidatePoolFingerprint: string | null;
      eventFingerprint: string | null;
      sourcePoolFingerprint: string;
    };
    promptVersion: string;
    workflowVersion: string;
    requiredSubmissionSchemaVersion: string;
    createdAt: string;
    expiresAt: string;
  };
  release: {
    appVersion: string;
    uiResourceUri: (typeof SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS)[number];
  };
  message: {
    channel: HostReasoningMessageChannel | null;
    disposition: "not-requested" | "requested" | "accepted" | "rejected";
    requestedAt: string | null;
    resolvedAt: string | null;
    acceptedAt: string | null;
  };
  retry: {
    retryCount: 0 | 1;
    retryOfTaskId: string | null;
  };
  submission: {
    disposition: "not-received" | "received";
    receivedAt: string | null;
  };
  validation: {
    disposition: "not-reached" | "pending" | "accepted" | "rejected";
    validatedAt: string | null;
  };
  application: {
    disposition: "not-reached" | "pending" | "applied" | "failed";
    resultOrigin: "chatgpt-host" | null;
    resultId: string | null;
    appliedAt: string | null;
  };
  failure: {
    stage:
      | "message-delivery"
      | "validation"
      | "application"
      | "expiration"
      | "retry"
      | "cancellation"
      | null;
  };
  fingerprints: {
    input: string;
    auditProposal: string | null;
  };
  sourceIds: {
    allowed: string[];
    referenced: string[];
  };
  lifecycle: Array<{
    from: HostReasoningTaskStatus | null;
    to: HostReasoningTaskStatus;
    at: string;
    failed: boolean;
  }>;
  panelReconciliation: {
    status: "not-ready" | "pending" | "reconciled" | "failed";
    lastCheckedAt: string | null;
    reconciledAt: string | null;
    failed: boolean;
  };
  proposal: HostReasoningAuditProposal | null;
  outcomeValuesInspected: false;
};

export type HostReasoningRunAuditBundle = {
  schemaVersion: typeof HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION;
  type: typeof HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE;
  runId: string;
  includedTaskCount: number;
  truncated: boolean;
  tasks: HostReasoningTaskAuditBundle[];
  outcomeValuesInspected: false;
};

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const fingerprintPattern =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const supportedUiResourceUris = new Set<string>(
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
);
const screen02Classes = new Set([
  "direct", "adjacent", "broad", "mismatch",
]);
const panelStatuses = new Set([
  "not-ready", "pending", "reconciled", "failed",
]);
const messageDispositions = new Set([
  "not-requested", "requested", "accepted", "rejected",
]);
const validationDispositions = new Set([
  "not-reached", "pending", "accepted", "rejected",
]);
const applicationDispositions = new Set([
  "not-reached", "pending", "applied", "failed",
]);
const failureStages = new Set([
  "message-delivery", "validation", "application", "expiration", "retry",
  "cancellation",
]);
const failedStatuses = new Set<HostReasoningTaskStatus>([
  "message-rejected", "validation-failed", "expired", "retry-exhausted",
  "cancelled",
]);
const transitions: Record<
  HostReasoningTaskStatus,
  readonly HostReasoningTaskStatus[]
> = {
  prepared: ["message-requested", "expired", "superseded", "cancelled"],
  "message-requested": [
    "message-accepted", "message-rejected", "expired", "superseded",
    "cancelled",
  ],
  "message-accepted": [
    "awaiting-submission", "submission-received", "expired", "superseded",
    "cancelled",
  ],
  "message-rejected": ["retry-exhausted", "superseded"],
  "awaiting-submission": [
    "submission-received", "expired", "superseded", "cancelled",
  ],
  "submission-received": ["validating", "superseded"],
  validating: ["applied", "validation-failed", "expired", "superseded"],
  applied: [],
  "validation-failed": ["retry-exhausted", "superseded"],
  expired: ["retry-exhausted", "superseded"],
  superseded: [],
  "retry-exhausted": [],
  cancelled: ["superseded"],
};

function fail(message: string): never {
  throw new Error(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) fail(`${label} has unrecognized fields.`);
}

function identifier(value: unknown, label: string) {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    fail(`${label} must be a canonical identifier.`);
  }
  return value;
}

function nullableIdentifier(value: unknown, label: string) {
  return value === null ? null : identifier(value, label);
}

function fingerprint(value: unknown, label: string) {
  if (typeof value !== "string" || !fingerprintPattern.test(value)) {
    fail(`${label} must be a canonical fingerprint.`);
  }
  return value;
}

function nullableFingerprint(value: unknown, label: string) {
  return value === null ? null : fingerprint(value, label);
}

function version(value: unknown, label: string) {
  if (typeof value !== "string" || !versionPattern.test(value)) {
    fail(`${label} must be a canonical version.`);
  }
  return value;
}

function supportedUiResourceUri(value: unknown) {
  if (typeof value !== "string" || !supportedUiResourceUris.has(value)) {
    fail("Host audit UI resource URI is not supported.");
  }
  return value as (typeof SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS)[number];
}

function appVersionForSupportedUiResourceUri(
  uiResourceUri: (typeof SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS)[number],
) {
  if (uiResourceUri === SHOCKAUDIT_UI_RESOURCE_URI) {
    return SHOCKAUDIT_VERSION;
  }
  const match = /-v(\d+)\.(\d+)\.(\d+)\.html$/u.exec(uiResourceUri);
  if (!match) fail("Host audit UI resource URI is not supported.");
  return match.slice(1).map((part) => String(Number(part))).join(".");
}

function timestamp(value: unknown, label: string) {
  if (typeof value !== "string") fail(`${label} must be a timestamp.`);
  const milliseconds = Date.parse(value as string);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) fail(`${label} must be a canonical timestamp.`);
  return value as string;
}

function nullableTimestamp(value: unknown, label: string) {
  return value === null ? null : timestamp(value, label);
}

function integer(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" || !Number.isInteger(value) ||
    value < minimum || value > maximum
  ) fail(`${label} must be a bounded integer.`);
  return value as number;
}

function boolean(value: unknown, label: string) {
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value as boolean;
}

function stringArray(
  value: unknown,
  label: string,
  maximum = 100,
  options: { sorted?: boolean; nonempty?: boolean } = {},
) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(`${label} must be a bounded identifier list.`);
  }
  const parsed = value.map((entry, index) =>
    identifier(entry, `${label}[${index}]`)
  );
  if (new Set(parsed).size !== parsed.length) {
    fail(`${label} must contain unique identifiers.`);
  }
  if (options.nonempty && parsed.length === 0) {
    fail(`${label} cannot be empty.`);
  }
  if (options.sorted && parsed.some((entry, index) =>
    index > 0 && parsed[index - 1]!.localeCompare(entry) > 0
  )) fail(`${label} must be sorted.`);
  return parsed;
}

function sourceOrigin(value: unknown, label: string) {
  if (typeof value !== "string" || value.length > 2_048) {
    fail(`${label} must be a bounded public HTTPS URL.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a bounded public HTTPS URL.`);
  }
  const hostname = parsed!.hostname.toLocaleLowerCase("en-US");
  const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/u;
  if (
    parsed!.protocol !== "https:" || parsed!.username !== "" ||
    parsed!.password !== "" || hostname === "localhost" ||
    hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    privateIpv4.test(hostname) || hostname.startsWith("[") ||
    !hostname.includes(".")
  ) fail(`${label} must be a bounded public HTTPS URL.`);
  return parsed!.origin;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireText(value: unknown, label: string, maximum: number) {
  if (
    typeof value !== "string" || value.length < 1 || value.length > maximum ||
    value.trim() !== value
  ) fail(`${label} must be bounded text.`);
  return value as string;
}

function requireTextArray(value: unknown, label: string, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(`${label} must be a bounded text list.`);
  }
  return value.map((entry, index) =>
    requireText(entry, `${label}[${index}]`, 1_200)
  );
}

function wordCount(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function proofReferenceAudit(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    fail(`${label} must contain one to eight references.`);
  }
  const references = value.map((entry, index) => {
    const reference = record(entry, `${label}[${index}]`);
    exact(reference, ["claimId", "sourceId", "passageId"], `${label}[${index}]`);
    return {
      claimId: identifier(reference.claimId, `${label}[${index}].claimId`),
      sourceId: identifier(reference.sourceId, `${label}[${index}].sourceId`),
      passageId: identifier(reference.passageId, `${label}[${index}].passageId`),
    };
  });
  if (new Set(references.map((reference) =>
    `${reference.claimId}\u0000${reference.sourceId}\u0000${reference.passageId}`
  )).size !== references.length) fail(`${label} must contain unique references.`);
  return {
    referenceCount: references.length,
    claimIds: [...new Set(references.map(({ claimId }) => claimId))].sort(),
    sourceIds: [...new Set(references.map(({ sourceId }) => sourceId))].sort(),
  };
}

/**
 * Convert one fixed-policy normalized result into a task-specific structural
 * audit DTO. Textual model output is counted or omitted, never copied.
 */
export function projectHostReasoningAuditProposal(input: {
  taskId: string;
  taskType: HostReasoningTaskType;
  proposal: unknown;
}): HostReasoningAuditProposal {
  const taskId = identifier(input.taskId, "Audit proposal taskId");
  const proposal = record(input.proposal, "Normalized host proposal");
  if (input.taskType === "screen02-search-review") {
    exact(proposal, [
      "schemaVersion", "origin", "nonCanonical", "review",
      "enrichedProfile", "rankings", "outcomeValuesInspected",
    ], "Normalized Screen 2 host result");
    if (
      proposal.schemaVersion !== "shockaudit-screen02-host-review-result-v1" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.rankings) ||
      !proposal.enrichedProfile || typeof proposal.enrichedProfile !== "object"
    ) fail("Normalized Screen 2 host result is invalid.");
    const review = record(proposal.review, "Normalized Screen 2 review");
    exact(review, [
      "schemaVersion", "taskId", "capability", "profileAdditions",
      "candidateReviews", "followUpQueries", "officialSourceLeads",
      "conciseRationale", "hostModel",
    ], "Normalized Screen 2 review");
    if (
      review.schemaVersion !== "screen-02-pool-host-review-v1" ||
      review.taskId !== taskId || review.capability !== "screen-02-pool-review" ||
      review.hostModel !== "host_model_not_exposed"
    ) fail("Normalized Screen 2 review does not match its task.");
    requireText(review.conciseRationale, "Screen 2 rationale", 800);
    const additions = record(
      review.profileAdditions,
      "Screen 2 profile additions",
    );
    const allowedAdditionFields = new Set<string>(
      HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS,
    );
    const profileAdditionFields = Object.entries(additions).map(
      ([field, values]) => {
        if (!allowedAdditionFields.has(field)) {
          fail("Screen 2 profile additions have unrecognized fields.");
        }
        requireTextArray(values, `Screen 2 profile additions.${field}`, 12);
        return field as
          (typeof HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS)[number];
      },
    ).sort();
    if (!Array.isArray(review.candidateReviews) ||
      review.candidateReviews.length > 20) {
      fail("Screen 2 candidate reviews are invalid.");
    }
    const candidateReviews = review.candidateReviews.map((entry, index) => {
      const candidate = record(entry, `Screen 2 candidate review ${index}`);
      exact(candidate, [
        "candidateId", "proposedClass", "industryBridge", "profileTermsUsed",
        "sourceIdsUsed", "sourceSpansUsed", "sampleConnection",
        "outcomePathway", "mainMismatchOrUncertainty",
        "needsFollowUpRetrieval", "rankingAdjustment",
      ], `Screen 2 candidate review ${index}`);
      if (!screen02Classes.has(candidate.proposedClass as string)) {
        fail(`Screen 2 candidate review ${index} has an invalid class.`);
      }
      const sourceIdsUsed = stringArray(
        candidate.sourceIdsUsed,
        `Screen 2 candidate review ${index}.sourceIdsUsed`,
        12,
      ).sort();
      if (!Array.isArray(candidate.sourceSpansUsed) ||
        candidate.sourceSpansUsed.length > 12) {
        fail(`Screen 2 candidate review ${index} has invalid source spans.`);
      }
      const sourceSpanSourceIds = [...new Set(candidate.sourceSpansUsed.map(
        (spanValue, spanIndex) => {
          const span = record(
            spanValue,
            `Screen 2 candidate review ${index}.sourceSpansUsed[${spanIndex}]`,
          );
          exact(span, ["sourceId", "text"], "Screen 2 source span");
          requireText(span.text, "Screen 2 source span text", 500);
          return identifier(span.sourceId, "Screen 2 source span ID");
        },
      ))].sort();
      requireText(candidate.industryBridge, "Screen 2 industry bridge", 640);
      requireTextArray(candidate.profileTermsUsed, "Screen 2 profile terms", 12);
      requireText(candidate.sampleConnection, "Screen 2 sample connection", 640);
      requireText(candidate.outcomePathway, "Screen 2 outcome pathway", 640);
      requireText(
        candidate.mainMismatchOrUncertainty,
        "Screen 2 mismatch or uncertainty",
        400,
      );
      return {
        candidateId: identifier(candidate.candidateId, "Screen 2 candidate ID"),
        proposedClass: candidate.proposedClass as
          HostReasoningScreen02SearchReviewAuditProposal["candidateReviews"][number]["proposedClass"],
        sourceIdsUsed,
        sourceSpanSourceIds,
        needsFollowUpRetrieval: boolean(
          candidate.needsFollowUpRetrieval,
          "Screen 2 follow-up flag",
        ),
        rankingAdjustment: integer(
          candidate.rankingAdjustment,
          "Screen 2 ranking adjustment",
          -3,
          3,
        ),
      };
    });
    if (new Set(candidateReviews.map((entry) => entry.candidateId)).size !==
      candidateReviews.length) fail("Screen 2 candidate IDs must be unique.");
    const followUpQueries = requireTextArray(
      review.followUpQueries,
      "Screen 2 follow-up queries",
      6,
    );
    if (!Array.isArray(review.officialSourceLeads) ||
      review.officialSourceLeads.length > 8) {
      fail("Screen 2 official source leads are invalid.");
    }
    review.officialSourceLeads.forEach(
      (leadValue, index) => {
        const lead = record(leadValue, `Screen 2 source lead ${index}`);
        exact(lead, [
          "url", "title", "issuingBody", "jurisdiction",
          "reasonForRetrieval", "candidateIdIfKnown",
        ], `Screen 2 source lead ${index}`);
        requireText(lead.title, "Screen 2 source lead title", 200);
        if (lead.issuingBody !== null) {
          requireText(lead.issuingBody, "Screen 2 issuing body", 200);
        }
        if (lead.jurisdiction !== null) {
          requireText(lead.jurisdiction, "Screen 2 jurisdiction", 200);
        }
        requireText(
          lead.reasonForRetrieval,
          "Screen 2 retrieval reason",
          400,
        );
        sourceOrigin(lead.url, "Screen 2 source lead URL");
        nullableIdentifier(
          lead.candidateIdIfKnown,
          "Screen 2 source lead candidate ID",
        );
      },
    );
    return {
      type: "screen02-search-review",
      normalizedSchemaVersion: "shockaudit-screen02-host-review-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      profileAdditionFields,
      candidateReviews,
      followUpQueryCount: followUpQueries.length,
      officialSourceLeadCount: review.officialSourceLeads.length,
      rankingCount: proposal.rankings.length,
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "screen03-evidence-mapping") {
    exact(proposal, [
      "schemaVersion", "origin", "nonCanonical", "mappings",
      "unmappedClaimIds", "conflictClaimIds", "conciseRationale",
      "hostModel", "sourceIdsReferenced", "stateFingerprintInspected",
      "sourcePoolFingerprintInspected", "mappingFingerprint",
      "applicationCoordinatesInspected",
      "outcomeValuesInspected",
    ], "Normalized Screen 3 evidence result");
    if (
      proposal.schemaVersion !== "shockaudit-screen03-host-evidence-result-v1" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false || !Array.isArray(proposal.mappings) ||
      proposal.mappings.length > 10
    ) fail("Normalized Screen 3 evidence result is invalid.");
    requireText(proposal.conciseRationale, "Screen 3 evidence rationale", 800);
    const mappings = proposal.mappings.map((mappingValue, index) => {
      const mapping = record(mappingValue, `Screen 3 mapping ${index}`);
      exact(
        mapping,
        ["claimId", "passageIds", "quotedSpans", "status"],
        `Screen 3 mapping ${index}`,
      );
      if (mapping.status !== "direct" || !Array.isArray(mapping.quotedSpans) ||
        mapping.quotedSpans.length < 1 || mapping.quotedSpans.length > 8) {
        fail(`Screen 3 mapping ${index} is invalid.`);
      }
      const passageIds = stringArray(
        mapping.passageIds,
        `Screen 3 mapping ${index}.passageIds`,
        8,
        { nonempty: true },
      );
      const quotedSpanRanges = mapping.quotedSpans.map(
        (spanValue, spanIndex) => {
          const span = record(
            spanValue,
            `Screen 3 mapping ${index}.quotedSpans[${spanIndex}]`,
          );
          exact(span, ["passageId", "start", "end", "text"], "Screen 3 quote");
          const passageId = identifier(span.passageId, "Screen 3 quote passage ID");
          if (!passageIds.includes(passageId)) {
            fail("Screen 3 quote does not belong to its mapping passage list.");
          }
          const start = integer(span.start, "Screen 3 quote start", 0, 1_000_000);
          const end = integer(span.end, "Screen 3 quote end", 1, 1_000_000);
          const text = requireText(span.text, "Screen 3 quote text", 1_000);
          if (end <= start || end - start !== text.length) {
            fail("Screen 3 quote offsets are invalid.");
          }
          return { passageId, start, end };
        },
      );
      return {
        claimId: identifier(mapping.claimId, "Screen 3 mapping claim ID"),
        passageIds,
        quotedSpanRanges,
        supportStatus: "direct" as const,
      };
    });
    if (new Set(mappings.map((entry) => entry.claimId)).size !== mappings.length) {
      fail("Screen 3 mapping claim IDs must be unique.");
    }
    return {
      type: "screen03-evidence-mapping",
      normalizedSchemaVersion: "shockaudit-screen03-host-evidence-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      mappings,
      unmappedClaimIds: stringArray(
        proposal.unmappedClaimIds,
        "Screen 3 unmapped claim IDs",
        15,
        { sorted: true },
      ),
      conflictClaimIds: stringArray(
        proposal.conflictClaimIds,
        "Screen 3 conflict claim IDs",
        15,
        { sorted: true },
      ),
      sourceIdsReferenced: stringArray(
        proposal.sourceIdsReferenced,
        "Screen 3 evidence source IDs",
        100,
        { sorted: true },
      ),
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "six-screen-policy-fact-proof") {
    exact(proposal, [
      "schemaVersion", "intelligenceKind", "origin", "nonCanonical",
      "proofOnly", "taskInputFingerprint", "eventCardFingerprintInspected",
      "sourcePoolFingerprintInspected", "answer", "references",
      "uncertainties", "sourceIdsReferenced", "scientificMutation",
      "researcherDecision", "hostModel", "outcomeValuesInspected",
    ], "Normalized six-screen factual proof result");
    if (
      proposal.schemaVersion !==
        "shockaudit-six-screen-policy-fact-proof-result-v1" ||
      proposal.intelligenceKind !== "policy_fact_extraction" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.proofOnly !== true || proposal.scientificMutation !== "none" ||
      proposal.researcherDecision !== "none" ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Normalized six-screen factual proof result is invalid.");
    fingerprint(proposal.taskInputFingerprint, "Factual proof task fingerprint");
    fingerprint(
      proposal.eventCardFingerprintInspected,
      "Factual proof Event Card fingerprint",
    );
    fingerprint(
      proposal.sourcePoolFingerprintInspected,
      "Factual proof source-pool fingerprint",
    );
    requireText(proposal.answer, "Factual proof answer", 1_000);
    requireTextArray(proposal.uncertainties, "Factual proof uncertainties", 5);
    const references = proofReferenceAudit(
      proposal.references,
      "Factual proof references",
    );
    const sourceIds = stringArray(
      proposal.sourceIdsReferenced,
      "Factual proof source IDs",
      12,
      { sorted: true, nonempty: true },
    );
    if (
      sourceIds.length !== references.sourceIds.length ||
      sourceIds.some((sourceId, index) =>
        sourceId !== references.sourceIds[index]
      )
    ) fail("Factual proof source bindings are invalid.");
    return {
      type: "six-screen-policy-fact-proof",
      normalizedSchemaVersion:
        "shockaudit-six-screen-policy-fact-proof-result-v1",
      intelligenceKind: "policy_fact_extraction",
      origin: "chatgpt-host",
      nonCanonical: true,
      proofOnly: true,
      referenceCount: references.referenceCount,
      claimIds: references.claimIds,
      sourceIds,
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "six-screen-mechanism-proof") {
    exact(proposal, [
      "schemaVersion", "intelligenceKind", "origin", "nonCanonical",
      "proofOnly", "taskInputFingerprint", "eventCardFingerprintInspected",
      "sourcePoolFingerprintInspected", "mechanismHypothesis", "steps",
      "assumptions", "alternativeExplanations", "references",
      "sourceIdsReferenced", "scholarlySupportStatus", "causalStatus",
      "scientificMutation", "researcherDecision", "hostModel",
      "outcomeValuesInspected",
    ], "Normalized six-screen mechanism proof result");
    if (
      proposal.schemaVersion !==
        "shockaudit-six-screen-mechanism-proof-result-v1" ||
      proposal.intelligenceKind !== "mechanism_proposal" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.proofOnly !== true || proposal.scientificMutation !== "none" ||
      proposal.researcherDecision !== "none" ||
      proposal.scholarlySupportStatus !== "not_supplied_in_frozen_packet" ||
      proposal.causalStatus !== "hypothesis_not_estimate" ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Normalized six-screen mechanism proof result is invalid.");
    fingerprint(proposal.taskInputFingerprint, "Mechanism proof task fingerprint");
    fingerprint(
      proposal.eventCardFingerprintInspected,
      "Mechanism proof Event Card fingerprint",
    );
    fingerprint(
      proposal.sourcePoolFingerprintInspected,
      "Mechanism proof source-pool fingerprint",
    );
    requireText(
      proposal.mechanismHypothesis,
      "Mechanism proof hypothesis",
      1_200,
    );
    const steps = requireTextArray(proposal.steps, "Mechanism proof steps", 5);
    const assumptions = requireTextArray(
      proposal.assumptions,
      "Mechanism proof assumptions",
      7,
    );
    const alternatives = requireTextArray(
      proposal.alternativeExplanations,
      "Mechanism proof alternatives",
      4,
    );
    if (steps.length < 2 || assumptions.length < 1) {
      fail("Mechanism proof requires bounded steps and assumptions.");
    }
    const references = proofReferenceAudit(
      proposal.references,
      "Mechanism proof references",
    );
    const sourceIds = stringArray(
      proposal.sourceIdsReferenced,
      "Mechanism proof source IDs",
      12,
      { sorted: true, nonempty: true },
    );
    if (
      sourceIds.length !== references.sourceIds.length ||
      sourceIds.some((sourceId, index) =>
        sourceId !== references.sourceIds[index]
      )
    ) fail("Mechanism proof source bindings are invalid.");
    return {
      type: "six-screen-mechanism-proof",
      normalizedSchemaVersion:
        "shockaudit-six-screen-mechanism-proof-result-v1",
      intelligenceKind: "mechanism_proposal",
      origin: "chatgpt-host",
      nonCanonical: true,
      proofOnly: true,
      referenceCount: references.referenceCount,
      claimIds: references.claimIds,
      sourceIds,
      stepCount: steps.length,
      assumptionCount: assumptions.length,
      alternativeExplanationCount: alternatives.length,
      scholarlySupportStatus: "not_supplied_in_frozen_packet",
      causalStatus: "hypothesis_not_estimate",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "screen04-study-event-assessment") {
    exact(proposal, [
      "schemaVersion", "intelligenceKind", "origin", "nonCanonical",
      "taskInputFingerprint", "contextFingerprintInspected",
      "eventFingerprintInspected", "sourcePoolFingerprintInspected",
      "screeningDisposition", "relationshipType", "focalRelation",
      "documentedChange", "relevanceArgument", "comparisonImplication",
      "argumentLinks", "dimensionalFit", "timingRole", "materialLimitations",
      "nextChecks", "sourceIds", "causalStatus", "hostModel",
      "scientificMutation", "researcherDecision", "outcomeValuesInspected",
    ], "Normalized Screen 4 study-event result");
    if (
      proposal.schemaVersion !==
        "shockaudit-screen04-study-event-assessment-result-v2" ||
      proposal.intelligenceKind !== "study_event_assessment" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.causalStatus !== "conditional_assessment_not_classification" ||
      proposal.scientificMutation !== "none" ||
      proposal.researcherDecision !== "none" ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.argumentLinks) ||
      proposal.argumentLinks.length > 6
    ) fail("Normalized Screen 4 study-event result is invalid.");
    fingerprint(proposal.taskInputFingerprint, "Screen 4 task fingerprint");
    fingerprint(proposal.contextFingerprintInspected, "Screen 4 context fingerprint");
    fingerprint(proposal.eventFingerprintInspected, "Screen 4 event fingerprint");
    fingerprint(proposal.sourcePoolFingerprintInspected, "Screen 4 source fingerprint");
    const linkSourceIds = proposal.argumentLinks.flatMap((value, index) => {
      const link = record(value, `Screen 4 argument link ${index}`);
      return stringArray(link.sourceIds, `Screen 4 argument link ${index} sources`, 8);
    });
    const focalRelation = record(
      proposal.focalRelation,
      "Screen 4 focal relation",
    );
    const sourceIds = [...new Set([
      ...stringArray(proposal.sourceIds, "Screen 4 result sources", 12),
      ...stringArray(
        focalRelation.sourceIds,
        "Screen 4 focal-relation sources",
        8,
      ),
      ...linkSourceIds,
    ])].sort();
    return {
      type: "screen04-study-event-assessment",
      normalizedSchemaVersion:
        "shockaudit-screen04-study-event-assessment-result-v2",
      intelligenceKind: "study_event_assessment",
      origin: "chatgpt-host",
      nonCanonical: true,
      chainLinkCount: proposal.argumentLinks.length,
      uncertaintyCount: requireTextArray(
        proposal.materialLimitations,
        "Screen 4 result limitations",
        8,
      ).length,
      nextCheckCount: requireTextArray(
        proposal.nextChecks,
        "Screen 4 result next checks",
        4,
      ).length,
      sourceIds,
      causalStatus: "conditional_assessment_not_classification",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "screen05-theoretical-planning") {
    exact(proposal, [
      "schemaVersion", "intelligenceKind", "origin", "nonCanonical",
      "taskInputFingerprint", "problemFingerprintInspected",
      "mechanismInputFingerprintInspected", "sourcePoolFingerprintInspected",
      "conceptualQuestion", "relationshipInterpretation", "candidates",
      "supplementaryAccounts", "evidenceNeeds", "queryIntents",
      "limitations", "planFingerprint", "hostModel", "scientificMutation",
      "researcherDecision", "outcomeValuesInspected",
    ], "Normalized Screen 5 theoretical-plan result");
    if (
      proposal.schemaVersion !==
        "shockaudit-screen05-theoretical-planning-result-v1" ||
      proposal.intelligenceKind !== "theoretical_mechanism_plan" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.scientificMutation !== "none" ||
      proposal.researcherDecision !== "none" ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.candidates) || proposal.candidates.length > 6 ||
      !Array.isArray(proposal.evidenceNeeds) ||
      proposal.evidenceNeeds.length > 20 ||
      !Array.isArray(proposal.queryIntents) ||
      proposal.queryIntents.length < 2 || proposal.queryIntents.length > 8
    ) fail("Normalized Screen 5 theoretical-plan result is invalid.");
    fingerprint(proposal.taskInputFingerprint, "Screen 5 plan task fingerprint");
    fingerprint(proposal.problemFingerprintInspected, "Screen 5 problem fingerprint");
    fingerprint(proposal.mechanismInputFingerprintInspected, "Screen 5 mechanism-input fingerprint");
    fingerprint(proposal.sourcePoolFingerprintInspected, "Screen 5 plan source fingerprint");
    fingerprint(proposal.planFingerprint, "Screen 5 plan fingerprint");
    return {
      type: "screen05-theoretical-planning",
      normalizedSchemaVersion:
        "shockaudit-screen05-theoretical-planning-result-v1",
      intelligenceKind: "theoretical_mechanism_plan",
      origin: "chatgpt-host",
      nonCanonical: true,
      candidateCount: proposal.candidates.length,
      evidenceNeedCount: proposal.evidenceNeeds.length,
      queryIntentCount: proposal.queryIntents.length,
      sourceIds: [],
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (input.taskType === "screen05-study-mechanism-comparison") {
    exact(proposal, [
      "schemaVersion", "intelligenceKind", "origin", "nonCanonical",
      "taskInputFingerprint", "contextFingerprintInspected",
      "mechanismRunFingerprintInspected", "sourcePoolFingerprintInspected",
      "focal", "alternatives", "predictionMatrix", "overallQualification",
      "evidenceLimitations", "causalStatus", "hostModel",
      "scientificMutation", "researcherDecision", "outcomeValuesInspected",
    ], "Normalized Screen 5 mechanism-comparison result");
    if (
      proposal.schemaVersion !==
        "shockaudit-screen05-study-mechanism-comparison-result-v2" ||
      proposal.intelligenceKind !== "study_mechanism_comparison" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.causalStatus !==
        "conditional_comparison_not_mediation_estimate" ||
      proposal.scientificMutation !== "none" ||
      proposal.researcherDecision !== "none" ||
      proposal.hostModel !== "host_model_not_exposed" ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.alternatives) || proposal.alternatives.length > 4 ||
      !Array.isArray(proposal.predictionMatrix) ||
      proposal.predictionMatrix.length > 10
    ) fail("Normalized Screen 5 mechanism-comparison result is invalid.");
    fingerprint(proposal.taskInputFingerprint, "Screen 5 task fingerprint");
    fingerprint(proposal.contextFingerprintInspected, "Screen 5 context fingerprint");
    fingerprint(proposal.mechanismRunFingerprintInspected, "Screen 5 run fingerprint");
    fingerprint(proposal.sourcePoolFingerprintInspected, "Screen 5 source fingerprint");
    const cards = [proposal.focal, ...proposal.alternatives];
    const sourceIds = [...new Set([
      ...cards.flatMap((value, index) => {
      const card = record(value, `Screen 5 mechanism card ${index}`);
      const propositions = Array.isArray(card.propositions)
        ? card.propositions
        : fail(`Screen 5 mechanism card ${index} propositions are invalid.`);
      return propositions.flatMap((item, propositionIndex) => {
        const proposition = record(
          item,
          `Screen 5 mechanism card ${index} proposition ${propositionIndex}`,
        );
        return [identifier(
          proposition.workId,
          `Screen 5 mechanism card ${index} proposition work`,
        )];
      });
      }),
      ...proposal.predictionMatrix.flatMap((value, index) => {
        const row = record(value, `Screen 5 prediction row ${index}`);
        return stringArray(
          row.propositionWorkIds,
          `Screen 5 prediction row ${index} works`,
          8,
        );
      }),
    ])].sort();
    return {
      type: "screen05-study-mechanism-comparison",
      normalizedSchemaVersion:
        "shockaudit-screen05-study-mechanism-comparison-result-v2",
      intelligenceKind: "study_mechanism_comparison",
      origin: "chatgpt-host",
      nonCanonical: true,
      mechanismCount: cards.length,
      predictionCount: proposal.predictionMatrix.length,
      evidenceLimitationCount: requireTextArray(
        proposal.evidenceLimitations,
        "Screen 5 evidence limitations",
        10,
      ).length,
      sourceIds,
      causalStatus: "conditional_comparison_not_mediation_estimate",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  exact(proposal, [
    "schemaVersion", "origin", "nonCanonical", "summary", "keyPoints",
    "uncertainties", "sourceIds", "conciseRationale", "hostModel",
    "stateFingerprintInspected", "outcomeValuesInspected",
  ], "Normalized Screen 3 overview result");
  if (
    proposal.schemaVersion !== "shockaudit-screen03-host-overview-result-v1" ||
    proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
    proposal.hostModel !== "host_model_not_exposed" ||
    proposal.outcomeValuesInspected !== false
  ) fail("Normalized Screen 3 overview result is invalid.");
  const summary = requireText(proposal.summary, "Screen 3 overview summary", 1_200);
  const keyPoints = requireTextArray(
    proposal.keyPoints,
    "Screen 3 overview key points",
    5,
  );
  const uncertainties = requireTextArray(
    proposal.uncertainties,
    "Screen 3 overview uncertainties",
    2,
  );
  requireText(proposal.conciseRationale, "Screen 3 overview rationale", 600);
  return {
    type: "screen03-overview-improvement",
    normalizedSchemaVersion: "shockaudit-screen03-host-overview-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    summaryWordCount: wordCount(summary),
    keyPointCount: keyPoints.length,
    uncertaintyCount: uncertainties.length,
    sourceIds: stringArray(
      proposal.sourceIds,
      "Screen 3 overview source IDs",
      20,
      { sorted: true },
    ),
    outcomeValuesInspected: false,
  };
}

function parseAuditProposal(
  value: unknown,
  expectedTaskType: HostReasoningTaskType,
  referencedSourceIds: readonly string[],
): HostReasoningAuditProposal {
  const proposal = record(value, "Host audit proposal");
  if (proposal.type !== expectedTaskType) {
    fail("Host audit proposal type does not match its task.");
  }
  if (expectedTaskType === "screen02-search-review") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "origin", "nonCanonical",
      "profileAdditionFields", "candidateReviews", "followUpQueryCount",
      "officialSourceLeadCount", "rankingCount", "outcomeValuesInspected",
    ], "Screen 2 audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-screen02-host-review-result-v1" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.profileAdditionFields) ||
      !Array.isArray(proposal.candidateReviews) ||
      proposal.candidateReviews.length > 20
    ) fail("Screen 2 audit proposal is invalid.");
    const allowedFields = new Set<string>(
      HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS,
    );
    const profileAdditionFields = proposal.profileAdditionFields.map(
      (field) => {
        if (typeof field !== "string" || !allowedFields.has(field)) {
          fail("Screen 2 audit profile additions are invalid.");
        }
        return field as
          (typeof HOST_REASONING_AUDIT_PROFILE_ADDITION_FIELDS)[number];
      },
    );
    if (
      new Set(profileAdditionFields).size !== profileAdditionFields.length ||
      profileAdditionFields.some((field, index) =>
        index > 0 && profileAdditionFields[index - 1]!.localeCompare(field) > 0
      )
    ) fail("Screen 2 audit profile additions must be unique and sorted.");
    const candidateReviews = proposal.candidateReviews.map((value, index) => {
      const review = record(value, `Screen 2 audit candidate ${index}`);
      exact(review, [
        "candidateId", "proposedClass", "sourceIdsUsed",
        "sourceSpanSourceIds", "needsFollowUpRetrieval", "rankingAdjustment",
      ], `Screen 2 audit candidate ${index}`);
      if (!screen02Classes.has(review.proposedClass as string)) {
        fail(`Screen 2 audit candidate ${index} has an invalid class.`);
      }
      return {
        candidateId: identifier(review.candidateId, "Screen 2 audit candidate ID"),
        proposedClass: review.proposedClass as
          HostReasoningScreen02SearchReviewAuditProposal["candidateReviews"][number]["proposedClass"],
        sourceIdsUsed: stringArray(
          review.sourceIdsUsed,
          "Screen 2 audit cited source IDs",
          12,
          { sorted: true },
        ),
        sourceSpanSourceIds: stringArray(
          review.sourceSpanSourceIds,
          "Screen 2 audit span source IDs",
          12,
        ),
        needsFollowUpRetrieval: boolean(
          review.needsFollowUpRetrieval,
          "Screen 2 audit follow-up flag",
        ),
        rankingAdjustment: integer(
          review.rankingAdjustment,
          "Screen 2 audit ranking adjustment",
          -3,
          3,
        ),
      };
    });
    if (new Set(candidateReviews.map((entry) => entry.candidateId)).size !==
      candidateReviews.length) fail("Screen 2 audit candidate IDs must be unique.");
    const cited = new Set(candidateReviews.flatMap((entry) => [
      ...entry.sourceIdsUsed,
      ...entry.sourceSpanSourceIds,
    ]));
    if (
      cited.size !== referencedSourceIds.length ||
      referencedSourceIds.some((sourceId) => !cited.has(sourceId))
    ) fail("Screen 2 audit proposal source bindings are invalid.");
    return {
      type: "screen02-search-review",
      normalizedSchemaVersion: "shockaudit-screen02-host-review-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      profileAdditionFields,
      candidateReviews,
      followUpQueryCount: integer(
        proposal.followUpQueryCount,
        "Screen 2 audit follow-up query count",
        0,
        6,
      ),
      officialSourceLeadCount: integer(
        proposal.officialSourceLeadCount,
        "Screen 2 audit official-source-lead count",
        0,
        8,
      ),
      rankingCount: integer(
        proposal.rankingCount,
        "Screen 2 audit ranking count",
        0,
        100,
      ),
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "screen03-evidence-mapping") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "origin", "nonCanonical",
      "mappings", "unmappedClaimIds", "conflictClaimIds",
      "sourceIdsReferenced", "outcomeValuesInspected",
    ], "Screen 3 evidence audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-screen03-host-evidence-result-v1" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.outcomeValuesInspected !== false ||
      !Array.isArray(proposal.mappings) || proposal.mappings.length > 10
    ) fail("Screen 3 evidence audit proposal is invalid.");
    const mappings = proposal.mappings.map((value, index) => {
      const mapping = record(value, `Screen 3 evidence audit mapping ${index}`);
      exact(mapping, [
        "claimId", "passageIds", "quotedSpanRanges", "supportStatus",
      ], `Screen 3 evidence audit mapping ${index}`);
      if (mapping.supportStatus !== "direct" ||
        !Array.isArray(mapping.quotedSpanRanges) ||
        mapping.quotedSpanRanges.length < 1 ||
        mapping.quotedSpanRanges.length > 8) {
        fail(`Screen 3 evidence audit mapping ${index} is invalid.`);
      }
      const passageIds = stringArray(
        mapping.passageIds,
        `Screen 3 evidence audit mapping ${index}.passageIds`,
        8,
        { nonempty: true },
      );
      const quotedSpanRanges = mapping.quotedSpanRanges.map(
        (spanValue, spanIndex) => {
          const span = record(
            spanValue,
            `Screen 3 evidence audit mapping ${index}.quotedSpanRanges[${spanIndex}]`,
          );
          exact(span, ["passageId", "start", "end"], "Screen 3 audit quote range");
          const passageId = identifier(
            span.passageId,
            "Screen 3 audit quote passage ID",
          );
          if (!passageIds.includes(passageId)) {
            fail("Screen 3 audit quote range has an unknown passage ID.");
          }
          const start = integer(span.start, "Screen 3 audit quote start", 0, 1_000_000);
          const end = integer(span.end, "Screen 3 audit quote end", 1, 1_000_000);
          if (end <= start) fail("Screen 3 audit quote range is invalid.");
          return { passageId, start, end };
        },
      );
      return {
        claimId: identifier(mapping.claimId, "Screen 3 audit claim ID"),
        passageIds,
        quotedSpanRanges,
        supportStatus: "direct" as const,
      };
    });
    if (new Set(mappings.map((entry) => entry.claimId)).size !== mappings.length) {
      fail("Screen 3 evidence audit claim IDs must be unique.");
    }
    const sourceIdsReferenced = stringArray(
      proposal.sourceIdsReferenced,
      "Screen 3 evidence audit source IDs",
      100,
      { sorted: true },
    );
    if (
      sourceIdsReferenced.length !== referencedSourceIds.length ||
      sourceIdsReferenced.some((sourceId, index) =>
        sourceId !== referencedSourceIds[index]
      )
    ) fail("Screen 3 evidence audit source bindings are invalid.");
    return {
      type: "screen03-evidence-mapping",
      normalizedSchemaVersion: "shockaudit-screen03-host-evidence-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      mappings,
      unmappedClaimIds: stringArray(
        proposal.unmappedClaimIds,
        "Screen 3 evidence audit unmapped claim IDs",
        15,
        { sorted: true },
      ),
      conflictClaimIds: stringArray(
        proposal.conflictClaimIds,
        "Screen 3 evidence audit conflict claim IDs",
        15,
        { sorted: true },
      ),
      sourceIdsReferenced,
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "six-screen-policy-fact-proof") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "intelligenceKind", "origin",
      "nonCanonical", "proofOnly", "referenceCount", "claimIds",
      "sourceIds", "scientificMutation", "outcomeValuesInspected",
    ], "Six-screen factual proof audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-six-screen-policy-fact-proof-result-v1" ||
      proposal.intelligenceKind !== "policy_fact_extraction" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.proofOnly !== true || proposal.scientificMutation !== "none" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Six-screen factual proof audit proposal is invalid.");
    const claimIds = stringArray(
      proposal.claimIds,
      "Factual proof audit claim IDs",
      8,
      { sorted: true, nonempty: true },
    );
    const sourceIds = stringArray(
      proposal.sourceIds,
      "Factual proof audit source IDs",
      8,
      { sorted: true, nonempty: true },
    );
    if (
      sourceIds.length !== referencedSourceIds.length ||
      sourceIds.some((sourceId, index) =>
        sourceId !== referencedSourceIds[index]
      )
    ) fail("Factual proof audit source bindings are invalid.");
    return {
      type: "six-screen-policy-fact-proof",
      normalizedSchemaVersion:
        "shockaudit-six-screen-policy-fact-proof-result-v1",
      intelligenceKind: "policy_fact_extraction",
      origin: "chatgpt-host",
      nonCanonical: true,
      proofOnly: true,
      referenceCount: integer(
        proposal.referenceCount,
        "Factual proof audit reference count",
        1,
        8,
      ),
      claimIds,
      sourceIds,
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "six-screen-mechanism-proof") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "intelligenceKind", "origin",
      "nonCanonical", "proofOnly", "referenceCount", "claimIds",
      "sourceIds", "stepCount", "assumptionCount",
      "alternativeExplanationCount", "scholarlySupportStatus",
      "causalStatus", "scientificMutation", "outcomeValuesInspected",
    ], "Six-screen mechanism proof audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-six-screen-mechanism-proof-result-v1" ||
      proposal.intelligenceKind !== "mechanism_proposal" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.proofOnly !== true || proposal.scientificMutation !== "none" ||
      proposal.scholarlySupportStatus !== "not_supplied_in_frozen_packet" ||
      proposal.causalStatus !== "hypothesis_not_estimate" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Six-screen mechanism proof audit proposal is invalid.");
    const claimIds = stringArray(
      proposal.claimIds,
      "Mechanism proof audit claim IDs",
      8,
      { sorted: true, nonempty: true },
    );
    const sourceIds = stringArray(
      proposal.sourceIds,
      "Mechanism proof audit source IDs",
      8,
      { sorted: true, nonempty: true },
    );
    if (
      sourceIds.length !== referencedSourceIds.length ||
      sourceIds.some((sourceId, index) =>
        sourceId !== referencedSourceIds[index]
      )
    ) fail("Mechanism proof audit source bindings are invalid.");
    return {
      type: "six-screen-mechanism-proof",
      normalizedSchemaVersion:
        "shockaudit-six-screen-mechanism-proof-result-v1",
      intelligenceKind: "mechanism_proposal",
      origin: "chatgpt-host",
      nonCanonical: true,
      proofOnly: true,
      referenceCount: integer(
        proposal.referenceCount,
        "Mechanism proof audit reference count",
        1,
        8,
      ),
      claimIds,
      sourceIds,
      stepCount: integer(
        proposal.stepCount,
        "Mechanism proof audit step count",
        2,
        5,
      ),
      assumptionCount: integer(
        proposal.assumptionCount,
        "Mechanism proof audit assumption count",
        1,
        7,
      ),
      alternativeExplanationCount: integer(
        proposal.alternativeExplanationCount,
        "Mechanism proof audit alternative count",
        0,
        4,
      ),
      scholarlySupportStatus: "not_supplied_in_frozen_packet",
      causalStatus: "hypothesis_not_estimate",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "screen04-study-event-assessment") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "intelligenceKind", "origin",
      "nonCanonical", "chainLinkCount", "uncertaintyCount",
      "nextCheckCount", "sourceIds", "causalStatus",
      "scientificMutation", "outcomeValuesInspected",
    ], "Screen 4 study-event audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-screen04-study-event-assessment-result-v2" ||
      proposal.intelligenceKind !== "study_event_assessment" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.causalStatus !== "conditional_assessment_not_classification" ||
      proposal.scientificMutation !== "none" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Screen 4 study-event audit proposal is invalid.");
    const sourceIds = stringArray(
      proposal.sourceIds,
      "Screen 4 study-event audit sources",
      100,
      { sorted: true, nonempty: true },
    );
    if (
      sourceIds.length !== referencedSourceIds.length ||
      sourceIds.some((sourceId, index) => sourceId !== referencedSourceIds[index])
    ) fail("Screen 4 study-event audit source bindings are invalid.");
    return {
      type: "screen04-study-event-assessment",
      normalizedSchemaVersion:
        "shockaudit-screen04-study-event-assessment-result-v2",
      intelligenceKind: "study_event_assessment",
      origin: "chatgpt-host",
      nonCanonical: true,
      chainLinkCount: integer(proposal.chainLinkCount, "Screen 4 chain count", 0, 6),
      uncertaintyCount: integer(proposal.uncertaintyCount, "Screen 4 uncertainty count", 1, 8),
      nextCheckCount: integer(proposal.nextCheckCount, "Screen 4 next-check count", 0, 4),
      sourceIds,
      causalStatus: "conditional_assessment_not_classification",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "screen05-theoretical-planning") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "intelligenceKind", "origin",
      "nonCanonical", "candidateCount", "evidenceNeedCount",
      "queryIntentCount", "sourceIds", "scientificMutation",
      "outcomeValuesInspected",
    ], "Screen 5 theoretical-plan audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-screen05-theoretical-planning-result-v1" ||
      proposal.intelligenceKind !== "theoretical_mechanism_plan" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.scientificMutation !== "none" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Screen 5 theoretical-plan audit proposal is invalid.");
    const sourceIds = stringArray(
      proposal.sourceIds,
      "Screen 5 theoretical-plan audit sources",
      0,
      { sorted: true },
    );
    if (sourceIds.length || referencedSourceIds.length) {
      fail("Screen 5 theoretical planning cannot reference scholarly sources.");
    }
    return {
      type: "screen05-theoretical-planning",
      normalizedSchemaVersion:
        "shockaudit-screen05-theoretical-planning-result-v1",
      intelligenceKind: "theoretical_mechanism_plan",
      origin: "chatgpt-host",
      nonCanonical: true,
      candidateCount: integer(
        proposal.candidateCount,
        "Screen 5 plan candidate count",
        0,
        6,
      ),
      evidenceNeedCount: integer(
        proposal.evidenceNeedCount,
        "Screen 5 plan evidence-need count",
        0,
        20,
      ),
      queryIntentCount: integer(
        proposal.queryIntentCount,
        "Screen 5 plan query-intent count",
        2,
        8,
      ),
      sourceIds: [],
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  if (expectedTaskType === "screen05-study-mechanism-comparison") {
    exact(proposal, [
      "type", "normalizedSchemaVersion", "intelligenceKind", "origin",
      "nonCanonical", "mechanismCount", "predictionCount",
      "evidenceLimitationCount", "sourceIds", "causalStatus",
      "scientificMutation", "outcomeValuesInspected",
    ], "Screen 5 mechanism-comparison audit proposal");
    if (
      proposal.normalizedSchemaVersion !==
        "shockaudit-screen05-study-mechanism-comparison-result-v2" ||
      proposal.intelligenceKind !== "study_mechanism_comparison" ||
      proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
      proposal.causalStatus !==
        "conditional_comparison_not_mediation_estimate" ||
      proposal.scientificMutation !== "none" ||
      proposal.outcomeValuesInspected !== false
    ) fail("Screen 5 mechanism-comparison audit proposal is invalid.");
    const sourceIds = stringArray(
      proposal.sourceIds,
      "Screen 5 mechanism-comparison audit sources",
      100,
      { sorted: true },
    );
    if (
      sourceIds.length !== referencedSourceIds.length ||
      sourceIds.some((sourceId, index) => sourceId !== referencedSourceIds[index])
    ) fail("Screen 5 mechanism-comparison audit source bindings are invalid.");
    return {
      type: "screen05-study-mechanism-comparison",
      normalizedSchemaVersion:
        "shockaudit-screen05-study-mechanism-comparison-result-v2",
      intelligenceKind: "study_mechanism_comparison",
      origin: "chatgpt-host",
      nonCanonical: true,
      mechanismCount: integer(proposal.mechanismCount, "Screen 5 mechanism count", 1, 5),
      predictionCount: integer(proposal.predictionCount, "Screen 5 prediction count", 0, 10),
      evidenceLimitationCount: integer(proposal.evidenceLimitationCount, "Screen 5 limitation count", 1, 10),
      sourceIds,
      causalStatus: "conditional_comparison_not_mediation_estimate",
      scientificMutation: "none",
      outcomeValuesInspected: false,
    };
  }

  exact(proposal, [
    "type", "normalizedSchemaVersion", "origin", "nonCanonical",
    "summaryWordCount", "keyPointCount", "uncertaintyCount", "sourceIds",
    "outcomeValuesInspected",
  ], "Screen 3 overview audit proposal");
  if (
    proposal.normalizedSchemaVersion !==
      "shockaudit-screen03-host-overview-result-v1" ||
    proposal.origin !== "chatgpt-host" || proposal.nonCanonical !== true ||
    proposal.outcomeValuesInspected !== false
  ) fail("Screen 3 overview audit proposal is invalid.");
  const sourceIds = stringArray(
    proposal.sourceIds,
    "Screen 3 overview audit source IDs",
    20,
    { sorted: true },
  );
  if (
    sourceIds.length !== referencedSourceIds.length ||
    sourceIds.some((sourceId, index) => sourceId !== referencedSourceIds[index])
  ) fail("Screen 3 overview audit source bindings are invalid.");
  return {
    type: "screen03-overview-improvement",
    normalizedSchemaVersion: "shockaudit-screen03-host-overview-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    summaryWordCount: integer(
      proposal.summaryWordCount,
      "Screen 3 overview audit word count",
      60,
      100,
    ),
    keyPointCount: integer(
      proposal.keyPointCount,
      "Screen 3 overview audit key-point count",
      3,
      5,
    ),
    uncertaintyCount: integer(
      proposal.uncertaintyCount,
      "Screen 3 overview audit uncertainty count",
      0,
      2,
    ),
    sourceIds,
    outcomeValuesInspected: false,
  };
}

export function requireHostReasoningTaskAuditBundle(
  value: unknown,
): HostReasoningTaskAuditBundle {
  const audit = record(value, "Host task audit");
  exact(audit, [
    "schemaVersion", "type", "task", "release", "message", "retry",
    "submission", "validation", "application", "failure", "fingerprints",
    "sourceIds", "lifecycle", "panelReconciliation", "proposal",
    "outcomeValuesInspected",
  ], "Host task audit");
  if (
    audit.schemaVersion !== HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION ||
    audit.type !== HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE ||
    audit.outcomeValuesInspected !== false
  ) fail("Host task audit has an invalid schema discriminator.");

  const taskValue = record(audit.task, "Host task audit task");
  exact(taskValue, [
    "taskId", "taskType", "screen", "status", "coordinates",
    "promptVersion", "workflowVersion", "requiredSubmissionSchemaVersion",
    "createdAt", "expiresAt",
  ], "Host task audit task");
  if (!HOST_REASONING_TASK_TYPES.includes(taskValue.taskType as HostReasoningTaskType) ||
    !HOST_REASONING_TASK_STATUSES.includes(taskValue.status as HostReasoningTaskStatus)) {
    fail("Host task audit has an unsupported task type or status.");
  }
  const taskType = taskValue.taskType as HostReasoningTaskType;
  const status = taskValue.status as HostReasoningTaskStatus;
  const coordinatesValue = record(taskValue.coordinates, "Host task audit coordinates");
  exact(coordinatesValue, [
    "runId", "candidateId", "candidatePoolId", "selectedEventId",
    "claimGroupId", "scopeFingerprint", "candidatePoolFingerprint",
    "eventFingerprint", "sourcePoolFingerprint",
  ], "Host task audit coordinates");
  const coordinates = {
    runId: identifier(coordinatesValue.runId, "Host audit run ID"),
    candidateId: nullableIdentifier(coordinatesValue.candidateId, "Host audit candidate ID"),
    candidatePoolId: nullableIdentifier(coordinatesValue.candidatePoolId, "Host audit candidate pool ID"),
    selectedEventId: nullableIdentifier(coordinatesValue.selectedEventId, "Host audit event ID"),
    claimGroupId: nullableIdentifier(coordinatesValue.claimGroupId, "Host audit claim group ID"),
    scopeFingerprint: fingerprint(coordinatesValue.scopeFingerprint, "Host audit scope fingerprint"),
    candidatePoolFingerprint: nullableFingerprint(
      coordinatesValue.candidatePoolFingerprint,
      "Host audit candidate pool fingerprint",
    ),
    eventFingerprint: nullableFingerprint(
      coordinatesValue.eventFingerprint,
      "Host audit event fingerprint",
    ),
    sourcePoolFingerprint: fingerprint(
      coordinatesValue.sourcePoolFingerprint,
      "Host audit source-pool fingerprint",
    ),
  };
  const screen = taskValue.screen;
  const legacyScreen02Coordinates = taskType === "screen02-search-review" &&
    screen === "screen-02" && coordinates.candidateId === null &&
    coordinates.candidatePoolId !== null &&
    coordinates.candidatePoolFingerprint !== null &&
    coordinates.selectedEventId === null && coordinates.claimGroupId === null &&
    coordinates.eventFingerprint === null;
  const legacyScreen03Coordinates =
    (taskType === "screen03-evidence-mapping" ||
      taskType === "screen03-overview-improvement") &&
    screen === "screen-03" && coordinates.candidateId === null &&
    coordinates.candidatePoolId === null &&
    coordinates.candidatePoolFingerprint === null &&
    coordinates.selectedEventId !== null &&
    coordinates.eventFingerprint !== null &&
    (taskType === "screen03-evidence-mapping"
      ? coordinates.claimGroupId !== null
      : coordinates.claimGroupId === null);
  const sixScreenProofCoordinates =
    (taskType === "six-screen-policy-fact-proof" ||
      taskType === "six-screen-mechanism-proof") &&
    screen === (taskType === "six-screen-policy-fact-proof"
      ? "screen-02"
      : "screen-05") &&
    coordinates.candidateId === null && coordinates.candidatePoolId === null &&
    coordinates.candidatePoolFingerprint === null &&
    coordinates.selectedEventId !== null && coordinates.claimGroupId === null &&
    coordinates.eventFingerprint !== null;
  const studyFirstCoordinates =
    (taskType === "screen04-study-event-assessment" ||
      taskType === "screen05-theoretical-planning" ||
      taskType === "screen05-study-mechanism-comparison") &&
    screen === (taskType === "screen04-study-event-assessment"
      ? "screen-04"
      : "screen-05") &&
    coordinates.candidateId === null && coordinates.candidatePoolId === null &&
    coordinates.candidatePoolFingerprint === null &&
    coordinates.selectedEventId !== null && coordinates.claimGroupId === null &&
    coordinates.eventFingerprint !== null;
  if (!legacyScreen02Coordinates && !legacyScreen03Coordinates &&
      !sixScreenProofCoordinates && !studyFirstCoordinates) {
    fail("Host task audit coordinates do not match its task type.");
  }
  const createdAt = timestamp(taskValue.createdAt, "Host audit creation time");
  const expiresAt = timestamp(taskValue.expiresAt, "Host audit expiration time");
  if (expiresAt <= createdAt) fail("Host audit expiration must follow creation.");

  const releaseValue = record(audit.release, "Host audit release");
  exact(releaseValue, ["appVersion", "uiResourceUri"], "Host audit release");
  const uiResourceUri = supportedUiResourceUri(releaseValue.uiResourceUri);
  const appVersion = version(releaseValue.appVersion, "Host audit app version");
  if (appVersion !== appVersionForSupportedUiResourceUri(uiResourceUri)) {
    fail("Host audit app version does not match its UI resource URI.");
  }
  const release = {
    appVersion,
    uiResourceUri,
  };

  const messageValue = record(audit.message, "Host audit message");
  exact(messageValue, [
    "channel", "disposition", "requestedAt", "resolvedAt", "acceptedAt",
  ], "Host audit message");
  if (!messageDispositions.has(messageValue.disposition as string) ||
    (messageValue.channel !== null && !HOST_REASONING_MESSAGE_CHANNELS.includes(
      messageValue.channel as HostReasoningMessageChannel,
    ))) fail("Host audit message contains an invalid enum.");
  const message = {
    channel: messageValue.channel as HostReasoningMessageChannel | null,
    disposition: messageValue.disposition as HostReasoningTaskAuditBundle["message"]["disposition"],
    requestedAt: nullableTimestamp(messageValue.requestedAt, "Host audit message request time"),
    resolvedAt: nullableTimestamp(messageValue.resolvedAt, "Host audit message resolution time"),
    acceptedAt: nullableTimestamp(messageValue.acceptedAt, "Host audit message acceptance time"),
  };
  if (
    (message.disposition === "not-requested") !== (message.channel === null) ||
    (message.disposition === "not-requested") !== (message.requestedAt === null) ||
    (["accepted", "rejected"].includes(message.disposition)) !==
      (message.resolvedAt !== null) ||
    (message.disposition === "accepted") !== (message.acceptedAt !== null) ||
    (message.acceptedAt !== null && message.acceptedAt !== message.resolvedAt)
  ) fail("Host audit message lifecycle is inconsistent.");

  const retryValue = record(audit.retry, "Host audit retry");
  exact(retryValue, ["retryCount", "retryOfTaskId"], "Host audit retry");
  const retryCount = integer(retryValue.retryCount, "Host audit retry count", 0, 1) as 0 | 1;
  const retryOfTaskId = nullableIdentifier(retryValue.retryOfTaskId, "Host audit retry predecessor");
  if ((retryCount === 1) !== (retryOfTaskId !== null)) {
    fail("Host audit retry coordinates are inconsistent.");
  }

  const submissionValue = record(audit.submission, "Host audit submission");
  exact(submissionValue, ["disposition", "receivedAt"], "Host audit submission");
  if (submissionValue.disposition !== "not-received" &&
    submissionValue.disposition !== "received") {
    fail("Host audit submission disposition is invalid.");
  }
  const submission = {
    disposition: submissionValue.disposition as "not-received" | "received",
    receivedAt: nullableTimestamp(
      submissionValue.receivedAt,
      "Host audit submission time",
    ),
  };
  if ((submission.disposition === "received") !== (submission.receivedAt !== null)) {
    fail("Host audit submission lifecycle is inconsistent.");
  }

  const validationValue = record(audit.validation, "Host audit validation");
  exact(validationValue, ["disposition", "validatedAt"], "Host audit validation");
  if (!validationDispositions.has(validationValue.disposition as string)) {
    fail("Host audit validation disposition is invalid.");
  }
  const validation = {
    disposition: validationValue.disposition as HostReasoningTaskAuditBundle["validation"]["disposition"],
    validatedAt: nullableTimestamp(
      validationValue.validatedAt,
      "Host audit validation time",
    ),
  };
  if (["accepted", "rejected"].includes(validation.disposition) !==
    (validation.validatedAt !== null)) {
    fail("Host audit validation lifecycle is inconsistent.");
  }

  const applicationValue = record(audit.application, "Host audit application");
  exact(applicationValue, [
    "disposition", "resultOrigin", "resultId", "appliedAt",
  ], "Host audit application");
  if (!applicationDispositions.has(applicationValue.disposition as string) ||
    (applicationValue.resultOrigin !== null &&
      applicationValue.resultOrigin !== "chatgpt-host")) {
    fail("Host audit application contains an invalid enum.");
  }
  const application = {
    disposition: applicationValue.disposition as HostReasoningTaskAuditBundle["application"]["disposition"],
    resultOrigin: applicationValue.resultOrigin as "chatgpt-host" | null,
    resultId: nullableIdentifier(applicationValue.resultId, "Host audit result ID"),
    appliedAt: nullableTimestamp(applicationValue.appliedAt, "Host audit application time"),
  };
  if (
    (application.disposition === "applied") !==
      (application.resultId !== null && application.appliedAt !== null) ||
    (application.disposition !== "applied" &&
      (application.resultId !== null || application.appliedAt !== null)) ||
    (["pending", "applied", "failed"].includes(application.disposition)) !==
      (application.resultOrigin === "chatgpt-host")
  ) fail("Host audit application lifecycle is inconsistent.");

  const failureValue = record(audit.failure, "Host audit failure");
  exact(failureValue, ["stage"], "Host audit failure");
  if (failureValue.stage !== null && !failureStages.has(failureValue.stage as string)) {
    fail("Host audit failure stage is invalid.");
  }
  const failure = {
    stage: failureValue.stage as HostReasoningTaskAuditBundle["failure"]["stage"],
  };

  const fingerprintsValue = record(audit.fingerprints, "Host audit fingerprints");
  exact(fingerprintsValue, ["input", "auditProposal"], "Host audit fingerprints");
  const fingerprints = {
    input: fingerprint(fingerprintsValue.input, "Host audit input fingerprint"),
    auditProposal: nullableFingerprint(
      fingerprintsValue.auditProposal,
      "Host audit proposal-projection fingerprint",
    ),
  };

  const sourceIdsValue = record(audit.sourceIds, "Host audit source IDs");
  exact(sourceIdsValue, ["allowed", "referenced"], "Host audit source IDs");
  const sourceIds = {
    allowed: stringArray(sourceIdsValue.allowed, "Host audit allowed source IDs", 100, {
      sorted: true,
    }),
    referenced: stringArray(
      sourceIdsValue.referenced,
      "Host audit referenced source IDs",
      100,
      { sorted: true },
    ),
  };
  if (sourceIds.referenced.some((sourceId) => !sourceIds.allowed.includes(sourceId)) ||
    coordinates.sourcePoolFingerprint !==
      fingerprintHostReasoningValue([...sourceIds.allowed].sort())) {
    fail("Host audit source-pool binding is invalid.");
  }

  const lifecycleValues = audit.lifecycle;
  if (!Array.isArray(lifecycleValues) || lifecycleValues.length < 1 ||
    lifecycleValues.length > 32) fail("Host audit lifecycle is invalid.");
  const lifecycle = lifecycleValues.map((value, index) => {
    const event = record(value, `Host audit lifecycle event ${index}`);
    exact(event, ["from", "to", "at", "failed"], `Host audit lifecycle event ${index}`);
    if ((event.from !== null && !HOST_REASONING_TASK_STATUSES.includes(
      event.from as HostReasoningTaskStatus,
    )) || !HOST_REASONING_TASK_STATUSES.includes(event.to as HostReasoningTaskStatus)) {
      fail(`Host audit lifecycle event ${index} has an invalid status.`);
    }
    const from = event.from as HostReasoningTaskStatus | null;
    const to = event.to as HostReasoningTaskStatus;
    const at = timestamp(event.at, `Host audit lifecycle event ${index} time`);
    const failed = boolean(event.failed, `Host audit lifecycle event ${index} failure flag`);
    if (failed !== failedStatuses.has(to)) {
      fail(`Host audit lifecycle event ${index} failure flag is invalid.`);
    }
    if (
      index === 0
        ? from !== null || to !== "prepared" || at !== createdAt
        : from !== (lifecycleValues[index - 1] as Record<string, unknown>).to ||
          !transitions[from!].includes(to) ||
          at < timestamp(
            (lifecycleValues[index - 1] as Record<string, unknown>).at,
            `Host audit lifecycle event ${index - 1} time`,
          )
    ) fail(`Host audit lifecycle event ${index} is not a valid transition.`);
    if (
      at < createdAt ||
      (to === "expired"
        ? at > expiresAt
        : to !== "retry-exhausted" && at >= expiresAt)
    ) {
      fail(`Host audit lifecycle event ${index} is outside task validity.`);
    }
    return { from, to, at, failed };
  });
  if (lifecycle.at(-1)?.to !== status) {
    fail("Host audit lifecycle does not end at task status.");
  }
  const eventAt = (target: HostReasoningTaskStatus) => {
    const matches = lifecycle.filter((event) => event.to === target);
    if (matches.length > 1) {
      fail(`Host audit lifecycle repeats ${target}.`);
    }
    return matches[0]?.at ?? null;
  };
  const messageRequestedEventAt = eventAt("message-requested");
  const messageAcceptedEventAt = eventAt("message-accepted");
  const messageRejectedEventAt = eventAt("message-rejected");
  const messageResolvedEventAt = messageAcceptedEventAt ??
    messageRejectedEventAt;
  if (
    message.requestedAt !== messageRequestedEventAt ||
    message.resolvedAt !== messageResolvedEventAt ||
    message.acceptedAt !== messageAcceptedEventAt ||
    (message.disposition === "not-requested") !==
      (messageRequestedEventAt === null) ||
    (message.disposition === "requested") !==
      (messageRequestedEventAt !== null && messageResolvedEventAt === null) ||
    (message.disposition === "accepted") !==
      (messageAcceptedEventAt !== null) ||
    (message.disposition === "rejected") !==
      (messageRejectedEventAt !== null) ||
    (message.channel === "unavailable" &&
      message.disposition === "accepted")
  ) fail("Host audit message fields do not match its lifecycle.");
  if (submission.receivedAt !== eventAt("submission-received")) {
    fail("Host audit submission fields do not match its lifecycle.");
  }
  const finalizedAt = eventAt("applied") ?? eventAt("validation-failed");
  if (validation.validatedAt !== finalizedAt) {
    fail("Host audit validation fields do not match its lifecycle.");
  }
  if (application.appliedAt !== eventAt("applied")) {
    fail("Host audit application fields do not match its lifecycle.");
  }

  const panelValue = record(audit.panelReconciliation, "Host audit panel reconciliation");
  exact(panelValue, [
    "status", "lastCheckedAt", "reconciledAt", "failed",
  ], "Host audit panel reconciliation");
  if (!panelStatuses.has(panelValue.status as string)) {
    fail("Host audit panel reconciliation status is invalid.");
  }
  const panelReconciliation = {
    status: panelValue.status as HostReasoningTaskAuditBundle["panelReconciliation"]["status"],
    lastCheckedAt: nullableTimestamp(
      panelValue.lastCheckedAt,
      "Host audit panel check time",
    ),
    reconciledAt: nullableTimestamp(
      panelValue.reconciledAt,
      "Host audit panel reconciliation time",
    ),
    failed: boolean(panelValue.failed, "Host audit panel failure flag"),
  };
  const panelTimesValid = panelReconciliation.status === "not-ready" ||
      panelReconciliation.status === "pending"
    ? panelReconciliation.lastCheckedAt === null &&
      panelReconciliation.reconciledAt === null &&
      panelReconciliation.failed === false
    : panelReconciliation.status === "reconciled"
      ? panelReconciliation.lastCheckedAt !== null &&
        panelReconciliation.reconciledAt !== null &&
        panelReconciliation.reconciledAt >= panelReconciliation.lastCheckedAt &&
        panelReconciliation.failed === false
      : panelReconciliation.lastCheckedAt !== null &&
        panelReconciliation.reconciledAt === null &&
        panelReconciliation.failed === true;
  const panelStatusMatchesTask = status === "applied"
    ? panelReconciliation.status !== "not-ready"
    : panelReconciliation.status === "not-ready";
  if (!panelStatusMatchesTask || !panelTimesValid) {
    fail("Host audit panel reconciliation lifecycle is inconsistent.");
  }
  if (
    panelReconciliation.lastCheckedAt !== null &&
    application.appliedAt !== null &&
    panelReconciliation.lastCheckedAt < application.appliedAt
  ) {
    fail("Host audit panel reconciliation predates application.");
  }

  const proposal = audit.proposal === null
    ? null
    : parseAuditProposal(audit.proposal, taskType, sourceIds.referenced);
  const expectedAuditProposalFingerprint = proposal === null
    ? null
    : fingerprintHostReasoningValue({
        schemaVersion: "shockaudit-host-audit-proposal-fingerprint-v1",
        taskType,
        proposal,
      });
  if (fingerprints.auditProposal !== expectedAuditProposalFingerprint) {
    fail("Host audit proposal binding is inconsistent.");
  }
  const proposalRequired = application.disposition !== "not-reached";
  if ((proposal !== null) !== proposalRequired) {
    fail("Host audit proposal does not match its validation stage.");
  }
  const validationFailureRecorded = lifecycle.some(
    (event) => event.to === "validation-failed",
  );
  const stagesMatchStatus = status === "applied"
    ? validation.disposition === "accepted" &&
      application.disposition === "applied" && failure.stage === null
    : validationFailureRecorded
      ? proposal !== null
        ? validation.disposition === "accepted" &&
          application.disposition === "failed"
        : validation.disposition === "rejected" &&
          application.disposition === "not-reached"
      : proposal !== null
        ? (status === "validating" || status === "superseded") &&
          validation.disposition === "pending" &&
          application.disposition === "pending"
        : validation.disposition === "not-reached" &&
          application.disposition === "not-reached";
  if (!stagesMatchStatus) {
    fail("Host audit stage dispositions do not match task status.");
  }
  const expectedFailureStage = status === "message-rejected"
    ? "message-delivery"
    : status === "validation-failed"
      ? application.disposition === "failed" ? "application" : "validation"
      : status === "expired" ? "expiration"
      : status === "retry-exhausted" ? "retry"
      : status === "cancelled" ? "cancellation"
      : null;
  if (failure.stage !== expectedFailureStage) {
    fail("Host audit failure stage does not match task status.");
  }
  for (const at of [
    message.requestedAt, message.resolvedAt, message.acceptedAt,
    submission.receivedAt, validation.validatedAt, application.appliedAt,
  ]) {
    if (at !== null && (at < createdAt || at > expiresAt)) {
      fail("Host audit timestamp is outside task validity.");
    }
  }
  for (const at of [
    panelReconciliation.lastCheckedAt,
    panelReconciliation.reconciledAt,
  ]) {
    if (at !== null && at < createdAt) {
      fail("Host audit panel timestamp precedes task creation.");
    }
  }

  return {
    schemaVersion: HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
    type: HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
    task: {
      taskId: identifier(taskValue.taskId, "Host audit task ID"),
      taskType,
      screen: screen as "screen-02" | "screen-03" | "screen-05",
      status,
      coordinates,
      promptVersion: version(taskValue.promptVersion, "Host audit prompt version"),
      workflowVersion: version(taskValue.workflowVersion, "Host audit workflow version"),
      requiredSubmissionSchemaVersion: version(
        taskValue.requiredSubmissionSchemaVersion,
        "Host audit submission schema version",
      ),
      createdAt,
      expiresAt,
    },
    release,
    message,
    retry: { retryCount, retryOfTaskId },
    submission,
    validation,
    application,
    failure,
    fingerprints,
    sourceIds,
    lifecycle,
    panelReconciliation,
    proposal,
    outcomeValuesInspected: false,
  };
}

export function requireHostReasoningRunAuditBundle(
  value: unknown,
): HostReasoningRunAuditBundle {
  const bundle = record(value, "Host run audit bundle");
  exact(bundle, [
    "schemaVersion", "type", "runId", "includedTaskCount", "truncated",
    "tasks", "outcomeValuesInspected",
  ], "Host run audit bundle");
  if (
    bundle.schemaVersion !== HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION ||
    bundle.type !== HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE ||
    bundle.outcomeValuesInspected !== false ||
    typeof bundle.truncated !== "boolean" || !Array.isArray(bundle.tasks) ||
    bundle.tasks.length > HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS
  ) fail("Host run audit bundle has an invalid schema or bound.");
  const runId = identifier(bundle.runId, "Host run audit run ID");
  const includedTaskCount = integer(
    bundle.includedTaskCount,
    "Host run audit task count",
    0,
    HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS,
  );
  if (includedTaskCount !== bundle.tasks.length) {
    fail("Host run audit task count does not match its tasks.");
  }
  const tasks = bundle.tasks.map(requireHostReasoningTaskAuditBundle);
  if (new Set(tasks.map((entry) => entry.task.taskId)).size !== tasks.length) {
    fail("Host run audit task IDs must be unique.");
  }
  if (tasks.some((entry) => entry.task.coordinates.runId !== runId)) {
    fail("Host run audit contains a task from another run.");
  }
  if (tasks.some((entry, index) => index > 0 && (
    tasks[index - 1]!.task.createdAt.localeCompare(entry.task.createdAt) > 0 ||
    tasks[index - 1]!.task.createdAt === entry.task.createdAt &&
      tasks[index - 1]!.task.taskId.localeCompare(entry.task.taskId) > 0
  ))) fail("Host run audit tasks are not in deterministic order.");
  const byId = new Map(tasks.map((entry) => [entry.task.taskId, entry]));
  for (const task of tasks) {
    if (!task.retry.retryOfTaskId) continue;
    const predecessor = byId.get(task.retry.retryOfTaskId);
    if (!predecessor) {
      // Server exports are an oldest-first prefix. Truncation can omit a
      // later retry, but never the earlier predecessor of an included retry.
      fail("Host run audit retry predecessor is missing.");
    }
    const predecessorTerminalAt = predecessor.lifecycle.at(-1)!.at;
    if (
      predecessor.retry.retryCount !== 0 ||
      !["message-rejected", "validation-failed", "expired"].includes(
        predecessor.task.status,
      ) ||
      task.task.createdAt < predecessorTerminalAt ||
      predecessor.task.taskType !== task.task.taskType ||
      predecessor.task.screen !== task.task.screen ||
      predecessor.task.coordinates.runId !== task.task.coordinates.runId ||
      predecessor.task.coordinates.candidateId !==
        task.task.coordinates.candidateId ||
      predecessor.task.coordinates.scopeFingerprint !==
        task.task.coordinates.scopeFingerprint ||
      predecessor.task.coordinates.candidatePoolId !==
        task.task.coordinates.candidatePoolId ||
      predecessor.task.coordinates.candidatePoolFingerprint !==
        task.task.coordinates.candidatePoolFingerprint ||
      predecessor.task.coordinates.selectedEventId !==
        task.task.coordinates.selectedEventId ||
      predecessor.task.coordinates.eventFingerprint !==
        task.task.coordinates.eventFingerprint ||
      predecessor.task.coordinates.claimGroupId !==
        task.task.coordinates.claimGroupId ||
      predecessor.task.coordinates.sourcePoolFingerprint !==
        task.task.coordinates.sourcePoolFingerprint ||
      predecessor.fingerprints.input !== task.fingerprints.input ||
      predecessor.task.promptVersion !== task.task.promptVersion ||
      predecessor.task.workflowVersion !== task.task.workflowVersion ||
      predecessor.task.requiredSubmissionSchemaVersion !==
        task.task.requiredSubmissionSchemaVersion ||
      predecessor.release.appVersion !== task.release.appVersion ||
      predecessor.release.uiResourceUri !== task.release.uiResourceUri ||
      predecessor.sourceIds.allowed.length !== task.sourceIds.allowed.length ||
      predecessor.sourceIds.allowed.some(
        (sourceId, index) => sourceId !== task.sourceIds.allowed[index],
      )
    ) fail("Host run audit retry does not match its predecessor.");
  }
  const parsed: HostReasoningRunAuditBundle = {
    schemaVersion: HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
    type: HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
    runId,
    includedTaskCount,
    truncated: bundle.truncated,
    tasks,
    outcomeValuesInspected: false,
  };
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength >
    HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES) {
    fail("Host run audit bundle exceeds its byte limit.");
  }
  return clone(parsed);
}

export function restoreHostReasoningRunAuditBundle(
  value: unknown,
): HostReasoningRunAuditBundle | null {
  try {
    return requireHostReasoningRunAuditBundle(value);
  } catch {
    return null;
  }
}
