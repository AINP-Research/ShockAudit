import {
  deriveScreen02AuditJudgment,
  finalizeScreen02AuditAssessmentRequest,
  finalizeScreen02AuditDossierRequest,
  fingerprintScreen02AuditDossier,
  fingerprintScreen02AuditMatchSet,
  fingerprintScreen02WorkflowSource,
  fingerprintScreen02WorkflowValue,
  prepareScreen02AssessmentRequest,
  requireScreen02AuditState,
  screen02AuditContinuationGate,
  transitionScreen02AssessmentRequest,
} from "./screen02-workflow-state";
import {
  assembleScreen02AuditShockGlance,
  upsertScreen02ShockGlance,
} from "./screen02-shock-glance";
import {
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  isScreen02RetainedResultBinding,
  SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  screen02AuditAssessmentPartIds,
  screen02AuditDossierPartIds,
  screen02AuditRelationships,
  screen02AuditVersionTypes,
  screen02CoverageRelationCategories,
  screen02DateLeadStages,
  screen02MeasurementPotentialCategories,
  screen02OutcomePathwayCategories,
  screen02StudyFitCategories,
  type Screen02AssessmentComponent,
  type Screen02AssessmentFailure,
  type Screen02AssessmentRequest,
  type Screen02AuditAnchorFields,
  type Screen02AuditAssessment,
  type Screen02AuditDossier,
  type Screen02AuditPossibleMatch,
  type Screen02AuditRelationship,
  type Screen02AuditState,
  type Screen02CoverageRelationCategory,
  type Screen02DateLead,
  type Screen02EventIdentity,
  type Screen02MeasurementPotentialCategory,
  type Screen02OutcomePathwayCategory,
  type Screen02ProvisionalClaim,
  type Screen02StudyFitCategory,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
} from "./screen02-workflow-types";

export const SCREEN_02_AUDIT_DOSSIER_DRAFT_SCHEMA_VERSION =
  "screen-02-audit-dossier-draft-v1" as const;
export const SCREEN_02_AUDIT_ASSESSMENT_DRAFT_SCHEMA_VERSION =
  "screen-02-audit-assessment-draft-v1" as const;
export const SCREEN_02_AUDIT_RECEIPT_SCHEMA_VERSION =
  "screen-02-audit-draft-receipt-v1" as const;
export const SCREEN_02_AUDIT_DOSSIER_PACKET_SCHEMA_VERSION =
  "screen-02-audit-dossier-packet-v1" as const;
export const SCREEN_02_AUDIT_ASSESSMENT_PACKET_SCHEMA_VERSION =
  "screen-02-audit-assessment-packet-v1" as const;
export const SCREEN_02_AUDIT_SUBMIT_DRAFT_TOOL_V021 =
  "submit_screen02_audit_draft_v021" as const;

const MAX_NARRATIVE = 2_000;
const MAX_MATCHES_PER_SET = 12;
const MAX_TOTAL_MATCHES = 80;
const MAX_TOTAL_SOURCES = 500;
const MAX_SOURCES_PER_MATCH = 50;
const MAX_EVENT_IDENTITY_NAMES = 20;
const MAX_EVENT_IDENTITY_FIELD_LENGTH = 500;
const MAX_DATE_LEAD_DATE_LENGTH = 200;

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : T[K] extends object
      ? Mutable<T[K]>
      : T[K];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function boundedNarrative(value: unknown, maximum = MAX_NARRATIVE) {
  return nonempty(value) && value.trim().length <= maximum;
}

const auditIdentityStopWords = new Set([
  "act",
  "and",
  "for",
  "law",
  "of",
  "on",
  "regulation",
  "regulations",
  "rule",
  "rules",
  "the",
  "to",
]);

function normalizedIdentityGrounding(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function auditNarrativesNameIdentity(
  identity: Screen02EventIdentity,
  narratives: readonly string[],
) {
  const combined = normalizedIdentityGrounding(narratives.join(" "));
  if (!combined) return false;
  const exactAnchors = [
    identity.canonicalTitle,
    ...identity.commonNames,
    identity.formalIdentifier,
  ]
    .filter((value): value is string => nonempty(value))
    .map(normalizedIdentityGrounding)
    .filter((value) => value.length >= 3);
  if (exactAnchors.some((anchor) => combined.includes(anchor))) return true;
  const titleTerms = [
    ...new Set(
      normalizedIdentityGrounding(identity.canonicalTitle)
        .split(" ")
        .filter(
          (term) =>
            term.length >= 3 &&
            !auditIdentityStopWords.has(term) &&
            !/^\d+$/.test(term),
        ),
    ),
  ];
  const matched = titleTerms.filter((term) =>
    new RegExp(`(?:^| )${term}(?: |$)`).test(combined),
  );
  return titleTerms.length > 0 && matched.length >= Math.min(2, titleTerms.length);
}

function requireChronologicalTime(at: string, floor: string, label: string) {
  const atValue = Date.parse(at);
  const floorValue = Date.parse(floor);
  if (
    !Number.isFinite(atValue) ||
    !Number.isFinite(floorValue) ||
    atValue < floorValue
  ) {
    fail(`${label} cannot move backward in time.`);
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const target = [...expected].sort();
  return (
    actual.length === target.length &&
    actual.every((key, index) => key === target[index])
  );
}

function uniqueStrings(value: unknown, maximum = 50): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const result = value.filter(nonempty).map((item) => item.trim());
  if (result.length !== value.length || new Set(result).size !== result.length) {
    return null;
  }
  return result;
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
) {
  return left.length === right.length &&
    left.every((value) => right.includes(value));
}

function requireUpstreamAuditResultBinding(
  manifest: Screen02WorkflowSearchManifest,
  matches: readonly Screen02AuditSearchMatchInput[],
) {
  const binding = manifest.retainedResultBinding;
  if (
    manifest.protocolVersion !== SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION ||
    !isScreen02RetainedResultBinding(binding) ||
    binding.mode !== "audit" ||
    binding.upstreamAccount.sourceRecordsRetrieved !==
      manifest.funnel.sourceRecordsRetrieved ||
    binding.upstreamAccount.uniqueEventLeads !==
      manifest.funnel.uniqueEventLeads ||
    binding.upstreamAccount.uniqueEventLeads !== matches.length ||
    binding.results.length !== matches.length
  ) {
    fail(
      "Audit match round requires an exact upstream-produced retained-result binding.",
    );
  }

  const queryById = new Map(
    manifest.queryMatrix.map((query) => [query.id, query] as const),
  );
  for (const [index, match] of matches.entries()) {
    const result = binding.results[index];
    if (
      !result ||
      result.recordId !== match.matchId ||
      result.snapshotId !== match.matchSnapshotId ||
      result.qualificationLane !== null ||
      !sameStringSet(result.sourceIds, match.sourceIds) ||
      result.origins.some((origin) => origin.kind !== "query-result")
    ) {
      fail(
        "Audit match round binding does not exactly cover its supplied matches.",
      );
    }

    const originSourceIds = new Set<string>();
    for (const origin of result.origins) {
      if (origin.kind !== "query-result") {
        fail("Audit match origins must come from an upstream query result.");
      }
      const query = queryById.get(origin.queryId);
      if (
        !query ||
        origin.returnedRecordIds.some(
          (recordId) => !query.returnedRecordIds.includes(recordId),
        ) ||
        origin.sourceIds.some(
          (sourceId) => !result.sourceIds.includes(sourceId),
        )
      ) {
        fail(
          "Audit match origin does not match its recorded query or source set.",
        );
      }
      origin.sourceIds.forEach((sourceId) => originSourceIds.add(sourceId));
    }
    if (!sameStringSet([...originSourceIds], result.sourceIds)) {
      fail("Audit match origins do not account for every retained source.");
    }
  }
}

function requireWritableAuditState(state: Screen02AuditState) {
  const safe = requireScreen02AuditState(state);
  if (safe.continuationHistory.length > 0) {
    fail(
      "This Audit run already continued and is sealed against later mutation.",
    );
  }
  return safe;
}

function activeAnchorRevision(state: Screen02AuditState) {
  const revision = state.anchor.revisions.find(
    (item) => item.anchorRevisionId === state.anchor.activeRevisionId,
  );
  if (!revision) fail("The active Audit anchor revision is unavailable.");
  return revision;
}

function activeMatchSet(state: Screen02AuditState) {
  return state.matchSets.find(
    (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
  );
}

function activeMatch(state: Screen02AuditState, matchSnapshotId: string) {
  const set = activeMatchSet(state);
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === matchSnapshotId,
  );
  if (
    !set ||
    !match ||
    set.anchorRevisionId !== state.anchor.activeRevisionId ||
    match.matchSetSnapshotId !== set.matchSetSnapshotId ||
    match.anchorRevisionId !== state.anchor.activeRevisionId ||
    !set.possibleMatchSnapshotIds.includes(match.matchSnapshotId)
  ) {
    fail("The possible match is not part of the active Audit snapshot.");
  }
  return match;
}

function supersedable(status: Screen02AssessmentRequest["status"]) {
  return [
    "prepared",
    "message-delivered",
    "draft-received",
    "validating",
    "partial",
    "delivery-rejected",
    "service-unavailable",
    "no-tool-submission",
    "validation-failed",
    "timed-out",
  ].includes(status);
}

function currentMatchDecision(
  state: Screen02AuditState,
  matchSnapshotId: string,
) {
  return state.identityDecisions.findLast(
    (decision) =>
      decision.matchSnapshotId === matchSnapshotId &&
      (decision.action === "rejected" ||
        decision.action === "related-version"),
  );
}

function currentSetNoMatchDecision(state: Screen02AuditState) {
  const set = activeMatchSet(state);
  if (!set) return null;
  return state.identityDecisions.findLast(
    (decision) =>
      decision.action === "no-match" &&
      decision.anchorRevisionId === set.anchorRevisionId &&
      Date.parse(decision.at) >= Date.parse(set.manifest.retrievedAt),
  );
}

function requireUndecidedAuditMatch(
  state: Screen02AuditState,
  matchSnapshotId: string,
) {
  const matchDecision = currentMatchDecision(state, matchSnapshotId);
  if (matchDecision) {
    fail(
      `This Audit match is already ${matchDecision.action}; revise the anchor or run a new immutable match round.`,
    );
  }
  if (currentSetNoMatchDecision(state)) {
    fail(
      "The researcher recorded no match for this Audit snapshot; revise the anchor or run a new match round.",
    );
  }
}

function supersedeRequestsForMatchSet(
  state: Screen02AuditState,
  priorMatchSetSnapshotId: string | null,
  successorSnapshotId: string,
  at: string,
) {
  if (!priorMatchSetSnapshotId) return state;
  let next = state;
  const requestIds = next.assessmentRequests
    .filter(
      (request) =>
        (request.target.mode === "audit-dossier" ||
          request.target.mode === "audit-confirmed-event") &&
        request.target.matchSetSnapshotId === priorMatchSetSnapshotId &&
        supersedable(request.status),
    )
    .map((request) => request.requestId);
  for (const requestId of requestIds) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId,
      status: "superseded",
      at,
      actor: "fixed-core",
      note: "A newer immutable Audit snapshot replaced this request.",
      supersededBySnapshotId: successorSnapshotId,
    }) as Screen02AuditState;
  }
  return next;
}

function pendingManifest(
  anchorRevisionId: string,
  exactRequest: string,
  at: string,
): Screen02WorkflowSearchManifest {
  return {
    // No search has executed yet, so do not manufacture the v4 funnel and
    // retrieval account. The v3 shape is the supported no-execution form.
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
    exactRequest,
    queryMatrix: [
      {
        id: `${anchorRevisionId}:pending-query`,
        query: exactRequest,
        purpose:
          "Preserve the revised named-shock anchor before the next documented identity search.",
        returnedRecordIds: [],
      },
    ],
    channels: [
      {
        channel: "anchor-led-identity-search",
        status: "not-searched",
        note: "A new anchor is active; identity retrieval has not yet run.",
        retrievedAt: null,
      },
    ],
    exclusions: [],
    stoppingRule: {
      rule: "Run a documented anchor-led identity search or record no match.",
      status: "not-started",
      note: "Identity retrieval is pending for this anchor revision.",
    },
    retrievedAt: at,
    outcomeValuesInspected: false,
  };
}

export function reviseScreen02AuditAnchor(
  state: Screen02AuditState,
  input: {
    anchorRevisionId: string;
    successorMatchSetSnapshotId: string;
    decisionId: string;
    fields: Partial<Screen02AuditAnchorFields>;
    at: string;
    reason: string;
  },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit anchor revision time");
  if (
    safe.confirmedIdentity !== null ||
    !nonempty(input.anchorRevisionId) ||
    !nonempty(input.successorMatchSetSnapshotId) ||
    !nonempty(input.decisionId) ||
    !boundedNarrative(input.reason) ||
    safe.anchor.revisions.some(
      (revision) => revision.anchorRevisionId === input.anchorRevisionId,
    ) ||
    safe.matchSets.some(
      (set) => set.matchSetSnapshotId === input.successorMatchSetSnapshotId,
    ) ||
    safe.identityDecisions.some(
      (decision) => decision.decisionId === input.decisionId,
    )
  ) {
    fail(
      "Audit anchor revision requires new bounded revision, match-set, decision, time, and reason fields.",
    );
  }
  const priorRevision = activeAnchorRevision(safe);
  const nextFields: Screen02AuditAnchorFields = {
    ...clone(priorRevision.fields),
    ...clone(input.fields),
  };
  if (
    !nonempty(nextFields.shockName) ||
    !screen02AuditVersionTypes.includes(nextFields.versionType) ||
    Object.entries(nextFields).some(([key, value]) => {
      if (key === "shockName" || key === "versionType") return false;
      return value !== null && !nonempty(value);
    })
  ) {
    fail("The revised Audit anchor contains an invalid structured field.");
  }
  const exactRequest = `Resolve the named shock from the active anchor: ${nextFields.shockName}.`;
  const newRevision = {
    anchorRevisionId: input.anchorRevisionId,
    previousRevisionId: priorRevision.anchorRevisionId,
    fields: nextFields,
    createdAt: input.at,
    reason: input.reason.trim(),
  };
  const setSnapshot = {
    matchSetSnapshotId: input.successorMatchSetSnapshotId,
    anchorRevisionId: input.anchorRevisionId,
    possibleMatchSnapshotIds: [] as string[],
    manifest: pendingManifest(input.anchorRevisionId, exactRequest, input.at),
  };
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  const priorSet = raw.matchSets.find(
    (set) => set.matchSetSnapshotId === raw.activeMatchSetSnapshotId,
  );
  if (priorSet) {
    priorSet.status = "superseded";
    priorSet.supersededBySnapshotId = input.successorMatchSetSnapshotId;
  }
  raw.anchor.revisions.push(newRevision);
  raw.anchor.activeRevisionId = input.anchorRevisionId;
  raw.matchSets.push({
    ...setSnapshot,
    matchSetFingerprint: fingerprintScreen02WorkflowValue(setSnapshot),
    status: "active",
    supersededBySnapshotId: null,
  });
  raw.activeMatchSetSnapshotId = input.successorMatchSetSnapshotId;
  raw.identityDecisions.push({
    decisionId: input.decisionId,
    action: "anchor-revised",
    actor: "researcher",
    anchorRevisionId: input.anchorRevisionId,
    matchSnapshotId: null,
    identitySnapshotId: null,
    dossierSnapshotId: null,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: null,
    at: input.at,
    reason: input.reason.trim(),
  });
  raw.confirmedIdentity = null;
  raw.revision += 1;
  raw.updatedAt = input.at;
  let next = requireScreen02AuditState(raw);
  next = supersedeRequestsForMatchSet(
    next,
    priorSet?.matchSetSnapshotId ?? null,
    input.successorMatchSetSnapshotId,
    input.at,
  );
  return next;
}

export function attachScreen02AuditResearcherSource(
  state: Screen02AuditState,
  input: {
    source: Omit<
      Screen02WorkflowSource,
      "sourceFingerprint" | "userProvided"
    >;
    anchorRevisionId: string;
    successorMatchSetSnapshotId: string;
    decisionId: string;
    shockName?: string;
    clarification?: string;
    at: string;
    reason: string;
  },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Researcher source time");
  if (
    !nonempty(input.source.id) ||
    !nonempty(input.source.title) ||
    !nonempty(input.source.locator) ||
    !nonempty(input.source.publisher) ||
    !nonempty(input.source.channel) ||
    input.source.authorityTier !== 6 ||
    safe.sources.some((source) => source.id === input.source.id) ||
    safe.sources.length >= MAX_TOTAL_SOURCES
  ) {
    fail("Researcher source identity or metadata is invalid or already present.");
  }
  const sourceBase = {
    ...clone(input.source),
    retrievedAt: input.at,
    userProvided: true,
  } satisfies Omit<Screen02WorkflowSource, "sourceFingerprint">;
  const source: Screen02WorkflowSource = {
    ...sourceBase,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
  };
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  raw.sources.push(source);
  raw.revision += 1;
  raw.updatedAt = input.at;
  const sourced = requireScreen02AuditState(raw);
  return reviseScreen02AuditAnchor(sourced, {
    anchorRevisionId: input.anchorRevisionId,
    successorMatchSetSnapshotId: input.successorMatchSetSnapshotId,
    decisionId: input.decisionId,
    fields: {
      ...(input.shockName ? { shockName: input.shockName } : {}),
      sourceLocator: source.locator,
      clarification:
        input.clarification ??
        `Researcher supplied ${source.title} to resolve the named shock.`,
    },
    at: input.at,
    reason: input.reason,
  });
}

export type Screen02AuditSearchMatchInput = {
  matchId: string;
  matchSnapshotId: string;
  identitySnapshotId: string;
  identity: Screen02EventIdentity;
  relationship: Screen02AuditRelationship;
  relationshipReason: string;
  sourceIds: string[];
  limitations: string[];
};

function validateIdentityInput(identity: Screen02EventIdentity) {
  const commonNames = isRecord(identity)
    ? uniqueStrings(identity.commonNames, MAX_EVENT_IDENTITY_NAMES)
    : null;
  if (
    !isRecord(identity) ||
    !exactKeys(identity, [
      "canonicalTitle",
      "commonNames",
      "formalIdentifier",
      "issuer",
      "issuingJurisdiction",
      "eventType",
      "status",
    ]) ||
    !boundedNarrative(
      identity.canonicalTitle,
      MAX_EVENT_IDENTITY_FIELD_LENGTH,
    ) ||
    !boundedNarrative(identity.eventType, MAX_EVENT_IDENTITY_FIELD_LENGTH) ||
    !commonNames ||
    commonNames.some(
      (name) => name.length > MAX_EVENT_IDENTITY_FIELD_LENGTH,
    ) ||
    [
      identity.formalIdentifier,
      identity.issuer,
      identity.issuingJurisdiction,
      identity.status,
    ].some(
      (value) =>
        value !== null &&
        !boundedNarrative(value, MAX_EVENT_IDENTITY_FIELD_LENGTH),
    )
  ) {
    fail("Audit possible-match identity is invalid.");
  }
}

export function applyScreen02AuditMatchRound(
  state: Screen02AuditState,
  input: {
    matchSetSnapshotId: string;
    sources: Screen02WorkflowSource[];
    matches: Screen02AuditSearchMatchInput[];
    manifest: Screen02WorkflowSearchManifest;
    at: string;
  },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit match round time");
  if (safe.confirmedIdentity) {
    fail("Reconsider the confirmed identity before running another match round.");
  }
  if (
    !nonempty(input.matchSetSnapshotId) ||
    safe.matchSets.some(
      (set) => set.matchSetSnapshotId === input.matchSetSnapshotId,
    ) ||
    !Array.isArray(input.matches) ||
    input.matches.length > MAX_MATCHES_PER_SET ||
    safe.possibleMatches.length + input.matches.length > MAX_TOTAL_MATCHES ||
    input.manifest.outcomeValuesInspected !== false
  ) {
    fail("Audit match round identity, size, or outcome-blind contract is invalid.");
  }
  requireUpstreamAuditResultBinding(input.manifest, input.matches);
  const noMatch = safe.identityDecisions.findLast(
    (decision) =>
      decision.action === "no-match" &&
      decision.anchorRevisionId === safe.anchor.activeRevisionId,
  );
  if (noMatch && Date.parse(input.at) <= Date.parse(noMatch.at)) {
    fail("A match round after no-match must use a later immutable timestamp.");
  }
  const sourceById = new Map(safe.sources.map((source) => [source.id, source]));
  for (const source of input.sources) {
    if (
      !nonempty(source.id) ||
      source.sourceFingerprint !== fingerprintScreen02WorkflowSource(source)
    ) {
      fail("Audit match round contains a malformed source snapshot.");
    }
    const prior = sourceById.get(source.id);
    if (prior && prior.sourceFingerprint !== source.sourceFingerprint) {
      fail(`Audit source ${source.id} conflicts with an immutable version.`);
    }
    sourceById.set(source.id, clone(source));
  }
  if (sourceById.size > MAX_TOTAL_SOURCES) {
    fail(`Audit accepts at most ${MAX_TOTAL_SOURCES} source snapshots.`);
  }
  const matchIds = new Set<string>();
  const snapshotIds = new Set<string>();
  const identityIds = new Set<string>();
  const existingMatchIds = new Set(safe.possibleMatches.map((match) => match.matchId));
  const existingSnapshotIds = new Set(
    safe.possibleMatches.map((match) => match.matchSnapshotId),
  );
  const existingIdentityIds = new Set(
    safe.possibleMatches.map((match) => match.identitySnapshotId),
  );
  const anchor = activeAnchorRevision(safe);
  const matches: Screen02AuditPossibleMatch[] = input.matches.map((match) => {
    validateIdentityInput(match.identity);
    const sourceIds = uniqueStrings(match.sourceIds, MAX_SOURCES_PER_MATCH);
    const limitations = uniqueStrings(match.limitations, 20);
    if (
      !nonempty(match.matchId) ||
      !nonempty(match.matchSnapshotId) ||
      !nonempty(match.identitySnapshotId) ||
      !screen02AuditRelationships.includes(match.relationship) ||
      !boundedNarrative(match.relationshipReason) ||
      !sourceIds ||
      sourceIds.length === 0 ||
      sourceIds.some((sourceId) => !sourceById.has(sourceId)) ||
      !limitations ||
      matchIds.has(match.matchId) ||
      snapshotIds.has(match.matchSnapshotId) ||
      identityIds.has(match.identitySnapshotId) ||
      existingMatchIds.has(match.matchId) ||
      existingSnapshotIds.has(match.matchSnapshotId) ||
      existingIdentityIds.has(match.identitySnapshotId)
    ) {
      fail("Audit match identity, relationship, evidence, or uniqueness is invalid.");
    }
    matchIds.add(match.matchId);
    snapshotIds.add(match.matchSnapshotId);
    identityIds.add(match.identitySnapshotId);
    const snapshot = {
      matchId: match.matchId,
      matchSnapshotId: match.matchSnapshotId,
      identitySnapshotId: match.identitySnapshotId,
      matchSetSnapshotId: input.matchSetSnapshotId,
      anchorRevisionId: anchor.anchorRevisionId,
      identity: clone(match.identity),
      relationship: match.relationship,
      relationshipReason: match.relationshipReason.trim(),
      sourceIds,
      limitations,
      recordedAt: input.at,
    };
    return {
      ...snapshot,
      matchFingerprint: fingerprintScreen02WorkflowValue(snapshot),
    };
  });
  const setSnapshot = {
    matchSetSnapshotId: input.matchSetSnapshotId,
    anchorRevisionId: anchor.anchorRevisionId,
    possibleMatchSnapshotIds: matches.map((match) => match.matchSnapshotId),
    manifest: clone(input.manifest),
  };
  const nextSet = {
    ...setSnapshot,
    matchSetFingerprint: fingerprintScreen02WorkflowValue(setSnapshot),
    status: "active" as const,
    supersededBySnapshotId: null,
  };
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  const priorSet = raw.matchSets.find(
    (set) => set.matchSetSnapshotId === raw.activeMatchSetSnapshotId,
  );
  if (priorSet) {
    priorSet.status = "superseded";
    priorSet.supersededBySnapshotId = input.matchSetSnapshotId;
  }
  raw.sources = [...sourceById.values()];
  raw.possibleMatches.push(...clone(matches));
  raw.matchSets.push(nextSet);
  raw.activeMatchSetSnapshotId = input.matchSetSnapshotId;
  raw.revision += 1;
  raw.updatedAt = input.at;
  let next = requireScreen02AuditState(raw);
  next = supersedeRequestsForMatchSet(
    next,
    priorSet?.matchSetSnapshotId ?? null,
    input.matchSetSnapshotId,
    input.at,
  );
  return next;
}

export function openScreen02AuditMatch(
  state: Screen02AuditState,
  matchSnapshotId: string,
) {
  const safe = requireScreen02AuditState(state);
  const match = activeMatch(safe, matchSnapshotId);
  return {
    match: clone(match),
    dossiers: safe.dossiers
      .filter((dossier) => dossier.identitySnapshotId === match.identitySnapshotId)
      .map((dossier) => clone(dossier)),
    decisions: safe.identityDecisions
      .filter((decision) => decision.matchSnapshotId === match.matchSnapshotId)
      .map((decision) => clone(decision)),
    identityConfirmed:
      safe.confirmedIdentity?.matchSnapshotId === match.matchSnapshotId,
  };
}

function appendMatchDecision(
  state: Screen02AuditState,
  input: {
    action: "rejected" | "related-version";
    matchSnapshotId: string;
    decisionId: string;
    at: string;
    reason: string;
  },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit identity decision time");
  if (safe.confirmedIdentity) {
    fail("Reconsider the confirmed identity before recording another match decision.");
  }
  const match = activeMatch(safe, input.matchSnapshotId);
  requireUndecidedAuditMatch(safe, match.matchSnapshotId);
  if (
    !nonempty(input.decisionId) ||
    !boundedNarrative(input.reason) ||
    safe.identityDecisions.some(
      (decision) => decision.decisionId === input.decisionId,
    )
  ) {
    fail("Audit identity decision identity or reason is invalid.");
  }
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  raw.identityDecisions.push({
    decisionId: input.decisionId,
    action: input.action,
    actor: "researcher",
    anchorRevisionId: match.anchorRevisionId,
    matchSnapshotId: match.matchSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    dossierSnapshotId: null,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: null,
    at: input.at,
    reason: input.reason.trim(),
  });
  raw.revision += 1;
  raw.updatedAt = input.at;
  let next = requireScreen02AuditState(raw);
  const requestIds = next.assessmentRequests
    .filter(
      (request) =>
        request.target.mode === "audit-dossier" &&
        request.target.matchSnapshotId === match.matchSnapshotId &&
        supersedable(request.status),
    )
    .map((request) => request.requestId);
  for (const requestId of requestIds) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId,
      status: "superseded",
      at: input.at,
      actor: "fixed-core",
      note: `The researcher marked this match ${input.action}.`,
      supersededBySnapshotId: input.decisionId,
    }) as Screen02AuditState;
  }
  return next;
}

export function rejectScreen02AuditMatch(
  state: Screen02AuditState,
  input: Omit<Parameters<typeof appendMatchDecision>[1], "action">,
) {
  return appendMatchDecision(state, { ...input, action: "rejected" });
}

export function markScreen02AuditRelatedVersion(
  state: Screen02AuditState,
  input: Omit<Parameters<typeof appendMatchDecision>[1], "action">,
) {
  return appendMatchDecision(state, { ...input, action: "related-version" });
}

export function recordScreen02AuditNoMatch(
  state: Screen02AuditState,
  input: { decisionId: string; at: string; reason: string },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit no-match decision time");
  if (
    safe.confirmedIdentity ||
    !activeMatchSet(safe) ||
    !nonempty(input.decisionId) ||
    !boundedNarrative(input.reason) ||
    safe.identityDecisions.some(
      (decision) => decision.decisionId === input.decisionId,
    )
  ) {
    fail("Audit no-match decision requires an active unconfirmed search snapshot.");
  }
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  raw.identityDecisions.push({
    decisionId: input.decisionId,
    action: "no-match",
    actor: "researcher",
    anchorRevisionId: safe.anchor.activeRevisionId,
    matchSnapshotId: null,
    identitySnapshotId: null,
    dossierSnapshotId: null,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: null,
    at: input.at,
    reason: input.reason.trim(),
  });
  raw.revision += 1;
  raw.updatedAt = input.at;
  let next = requireScreen02AuditState(raw);
  const activeSetSnapshotId = safe.activeMatchSetSnapshotId;
  const requestIds = next.assessmentRequests
    .filter(
      (request) =>
        request.target.mode === "audit-dossier" &&
        request.target.matchSetSnapshotId === activeSetSnapshotId &&
        supersedable(request.status),
    )
    .map((request) => request.requestId);
  for (const requestId of requestIds) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId,
      status: "superseded",
      at: input.at,
      actor: "fixed-core",
      note: "The researcher recorded no match for this immutable match set.",
      supersededBySnapshotId: input.decisionId,
    }) as Screen02AuditState;
  }
  return next;
}

export function prepareScreen02AuditDossierJob(
  state: Screen02AuditState,
  input: {
    matchSnapshotId: string;
    jobId: string;
    requestId: string;
    at: string;
  },
) {
  const safe = requireWritableAuditState(state);
  if (safe.confirmedIdentity) {
    fail("A confirmed Audit identity cannot start another dossier job.");
  }
  const match = activeMatch(safe, input.matchSnapshotId);
  requireUndecidedAuditMatch(safe, match.matchSnapshotId);
  return prepareScreen02AssessmentRequest(safe, {
    mode: "audit-dossier",
    identitySnapshotId: match.identitySnapshotId,
    jobId: input.jobId,
    requestId: input.requestId,
    attempt: 1,
    requestedPartIds: [...screen02AuditDossierPartIds],
    at: input.at,
  }) as Screen02AuditState;
}

export function retryScreen02AuditRequest(
  state: Screen02AuditState,
  input: { priorRequestId: string; requestId: string; at: string },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit retry time");
  const prior = safe.assessmentRequests.find(
    (request) => request.requestId === input.priorRequestId,
  );
  if (
    !prior ||
    (prior.target.mode !== "audit-dossier" &&
      prior.target.mode !== "audit-confirmed-event") ||
    prior.attempt >= 3
  ) {
    fail("Audit retry parent was not found or exhausted its budget.");
  }
  if (prior.target.mode === "audit-dossier") {
    if (safe.confirmedIdentity) {
      fail("A confirmed Audit identity cannot retry a dossier request.");
    }
    const match = activeMatch(safe, prior.target.matchSnapshotId);
    requireUndecidedAuditMatch(safe, match.matchSnapshotId);
  }
  const accepted = new Set(
    safe.assessmentRequests
      .filter((request) => request.jobId === prior.jobId)
      .flatMap((request) => request.acceptedPartIds),
  );
  const fullParts =
    prior.target.mode === "audit-dossier"
      ? [...screen02AuditDossierPartIds]
      : [...screen02AuditAssessmentPartIds];
  const unresolved = fullParts.filter((partId) => !accepted.has(partId));
  if (unresolved.length === 0) {
    fail("This Audit request has no unresolved result parts.");
  }
  return prepareScreen02AssessmentRequest(safe, {
    mode: prior.target.mode,
    identitySnapshotId: prior.target.identitySnapshotId,
    jobId: prior.jobId,
    requestId: input.requestId,
    retryOfRequestId: prior.requestId,
    attempt: (prior.attempt + 1) as 2 | 3,
    requestedPartIds: unresolved,
    at: input.at,
  }) as Screen02AuditState;
}

export function markScreen02AuditRequestDelivered(
  state: Screen02AuditState,
  input: {
    requestId: string;
    at: string;
    delivered: boolean;
    note?: string;
  },
) {
  const safe = requireWritableAuditState(state);
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === input.requestId,
  );
  if (
    !request ||
    (request.target.mode !== "audit-dossier" &&
      request.target.mode !== "audit-confirmed-event") ||
    request.status !== "prepared"
  ) {
    fail("Audit request is not awaiting host delivery.");
  }
  if (!input.delivered && request.attempt === 3) {
    return transitionScreen02AssessmentRequest(safe, {
      requestId: request.requestId,
      status: "retry-exhausted",
      at: input.at,
      actor: "fixed-core",
      note:
        input.note ??
        "The host did not accept the final bounded Audit request message.",
      failures: request.requestedPartIds.map((partId) => ({
        partId,
        codes: ["delivery-rejected"],
      })),
    }) as Screen02AuditState;
  }
  return transitionScreen02AssessmentRequest(safe, {
    requestId: request.requestId,
    status: input.delivered ? "message-delivered" : "delivery-rejected",
    at: input.at,
    actor: "chatgpt-host",
    note:
      input.note ??
      (input.delivered
        ? "The host accepted the bounded Audit request message."
        : "The host rejected the bounded Audit request message."),
  }) as Screen02AuditState;
}

export function confirmScreen02AuditIdentity(
  state: Screen02AuditState,
  input: {
    matchSnapshotId: string;
    dossierSnapshotId: string;
    decisionId: string;
    confirmationSnapshotId: string;
    assessmentJobId: string;
    assessmentRequestId: string;
    at: string;
    reason: string;
  },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit confirmation time");
  if (safe.confirmedIdentity) {
    fail("An Audit identity is already confirmed.");
  }
  if (
    activeMatchSet(safe)?.manifest.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION
  ) {
    fail(
      "Audit identity confirmation requires a fresh search with current retrieval execution.",
    );
  }
  const match = activeMatch(safe, input.matchSnapshotId);
  requireUndecidedAuditMatch(safe, match.matchSnapshotId);
  const dossier = safe.dossiers.find(
    (item) =>
      item.dossierSnapshotId === input.dossierSnapshotId &&
      item.identitySnapshotId === match.identitySnapshotId &&
      item.status === "completed",
  );
  if (
    !dossier ||
    match.relationship === "uncertain" ||
    match.sourceIds.length === 0 ||
    dossier.sourceIds.length === 0 ||
    dossier.atAGlance.length === 0 ||
    !dossier.whatHappened ||
    dossier.whatHappened.sourceIds.length === 0 ||
    dossier.unresolvedFacts.length === 0 ||
    !nonempty(input.decisionId) ||
    !nonempty(input.confirmationSnapshotId) ||
    !nonempty(input.assessmentJobId) ||
    !nonempty(input.assessmentRequestId) ||
    !boundedNarrative(input.reason) ||
    safe.identityDecisions.some(
      (decision) => decision.decisionId === input.decisionId,
    ) ||
    safe.identityDecisions.some(
      (decision) =>
        decision.confirmationSnapshotId === input.confirmationSnapshotId,
    )
  ) {
    fail(
      "Audit identity confirmation requires an active source-backed match and sufficient completed dossier.",
    );
  }
  const confirmationBase = {
    confirmationSnapshotId: input.confirmationSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    matchSnapshotId: match.matchSnapshotId,
    matchSetSnapshotId: match.matchSetSnapshotId,
    anchorRevisionId: match.anchorRevisionId,
    dossierSnapshotId: dossier.dossierSnapshotId,
    dossierFingerprint: dossier.dossierFingerprint,
    decisionId: input.decisionId,
    confirmedAt: input.at,
  };
  const confirmation = {
    ...confirmationBase,
    confirmationFingerprint: fingerprintScreen02WorkflowValue(confirmationBase),
  };
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  raw.identityDecisions.push({
    decisionId: input.decisionId,
    action: "confirmed",
    actor: "researcher",
    anchorRevisionId: match.anchorRevisionId,
    matchSnapshotId: match.matchSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    dossierSnapshotId: dossier.dossierSnapshotId,
    confirmationSnapshotId: confirmation.confirmationSnapshotId,
    confirmationFingerprint: confirmation.confirmationFingerprint,
    reversesDecisionId: null,
    at: input.at,
    reason: input.reason.trim(),
  });
  raw.confirmedIdentity = confirmation;
  const fixedGlance = assembleScreen02AuditShockGlance(
    raw as Screen02AuditState,
    match.matchSnapshotId,
    input.at,
  );
  const retainedGlance = raw.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === match.matchSnapshotId,
  );
  raw.shockGlances = upsertScreen02ShockGlance(
    raw.shockGlances,
    retainedGlance &&
        retainedGlance.candidateFingerprint === fixedGlance.candidateFingerprint &&
        retainedGlance.eventFingerprint === fixedGlance.eventFingerprint
      ? retainedGlance
      : fixedGlance,
  );
  raw.revision += 1;
  raw.updatedAt = input.at;
  let confirmed = requireScreen02AuditState(raw);
  const dossierRequestIds = confirmed.assessmentRequests
    .filter(
      (request) =>
        request.target.mode === "audit-dossier" &&
        request.target.matchSetSnapshotId === match.matchSetSnapshotId &&
        supersedable(request.status),
    )
    .map((request) => request.requestId);
  for (const requestId of dossierRequestIds) {
    confirmed = transitionScreen02AssessmentRequest(confirmed, {
      requestId,
      status: "superseded",
      at: input.at,
      actor: "fixed-core",
      note: "Exact identity confirmation froze every unfinished dossier request for this match set.",
      supersededBySnapshotId: confirmation.confirmationSnapshotId,
    }) as Screen02AuditState;
  }
  return prepareScreen02AssessmentRequest(confirmed, {
    mode: "audit-confirmed-event",
    identitySnapshotId: match.identitySnapshotId,
    jobId: input.assessmentJobId,
    requestId: input.assessmentRequestId,
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: input.at,
  }) as Screen02AuditState;
}

export function reconsiderScreen02AuditIdentity(
  state: Screen02AuditState,
  input: { decisionId: string; at: string; reason: string },
) {
  const safe = requireWritableAuditState(state);
  requireChronologicalTime(input.at, safe.updatedAt, "Audit reversal time");
  const confirmation = safe.confirmedIdentity;
  if (
    !confirmation ||
    !nonempty(input.decisionId) ||
    !boundedNarrative(input.reason) ||
    safe.identityDecisions.some(
      (decision) => decision.decisionId === input.decisionId,
    )
  ) {
    fail("Audit reconsideration requires one active confirmation and a new decision.");
  }
  const raw = clone(safe) as Mutable<Screen02AuditState>;
  raw.identityDecisions.push({
    decisionId: input.decisionId,
    action: "reversed",
    actor: "researcher",
    anchorRevisionId: confirmation.anchorRevisionId,
    matchSnapshotId: confirmation.matchSnapshotId,
    identitySnapshotId: confirmation.identitySnapshotId,
    dossierSnapshotId: confirmation.dossierSnapshotId,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: confirmation.decisionId,
    at: input.at,
    reason: input.reason.trim(),
  });
  raw.confirmedIdentity = null;
  raw.revision += 1;
  raw.updatedAt = input.at;
  let next = requireScreen02AuditState(raw);
  const requestIds = next.assessmentRequests
    .filter(
      (request) =>
        request.target.mode === "audit-confirmed-event" &&
        request.target.confirmationSnapshotId ===
          confirmation.confirmationSnapshotId &&
        supersedable(request.status),
    )
    .map((request) => request.requestId);
  for (const requestId of requestIds) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId,
      status: "superseded",
      at: input.at,
      actor: "fixed-core",
      note: "The researcher reconsidered this confirmed Audit identity.",
      supersededBySnapshotId: input.decisionId,
    }) as Screen02AuditState;
  }
  return next;
}

export function screen02AuditRequestProof(request: Screen02AssessmentRequest) {
  const schemaVersion =
    request.target.mode === "audit-dossier"
      ? SCREEN_02_AUDIT_DOSSIER_DRAFT_SCHEMA_VERSION
      : SCREEN_02_AUDIT_ASSESSMENT_DRAFT_SCHEMA_VERSION;
  return fingerprintScreen02WorkflowValue({
    schemaVersion,
    requestId: request.requestId,
    jobId: request.jobId,
    target: request.target,
    attempt: request.attempt,
    requestedPartIds: request.requestedPartIds,
  });
}

export type Screen02AuditDraftSubmission = {
  requestId: string;
  requestProof: string;
  draft: unknown;
};

export type Screen02AuditDraftReceipt = {
  schemaVersion: typeof SCREEN_02_AUDIT_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  kind: "audit-dossier" | "audit-confirmed-event";
  receivedAt: string;
  submissions: Screen02AuditDraftSubmission[];
};

function createScreen02AuditDraftReceipt(input: {
  receiptId: string;
  kind: Screen02AuditDraftReceipt["kind"];
  receivedAt: string;
  submissions: readonly Screen02AuditDraftSubmission[];
}): Screen02AuditDraftReceipt {
  if (!nonempty(input.receiptId) || !nonempty(input.receivedAt)) {
    fail("Audit draft receipt identity and timestamp are required.");
  }
  const requestIds = input.submissions.map((submission) => submission.requestId);
  if (
    requestIds.length === 0 ||
    requestIds.some((requestId) => !nonempty(requestId)) ||
    new Set(requestIds).size !== requestIds.length ||
    input.submissions.some((submission) => !nonempty(submission.requestProof))
  ) {
    fail(
      "Audit draft receipt submissions require unique request IDs and proofs.",
    );
  }
  return {
    schemaVersion: SCREEN_02_AUDIT_RECEIPT_SCHEMA_VERSION,
    receiptId: input.receiptId,
    kind: input.kind,
    receivedAt: input.receivedAt,
    submissions: input.submissions.map((submission) => clone(submission)),
  };
}

export function createScreen02AuditDossierDraftReceipt(input: {
  receiptId: string;
  receivedAt: string;
  submissions: readonly Screen02AuditDraftSubmission[];
}) {
  return createScreen02AuditDraftReceipt({ ...input, kind: "audit-dossier" });
}

export function createScreen02AuditAssessmentDraftReceipt(input: {
  receiptId: string;
  receivedAt: string;
  submissions: readonly Screen02AuditDraftSubmission[];
}) {
  return createScreen02AuditDraftReceipt({
    ...input,
    kind: "audit-confirmed-event",
  });
}

function validateReceiptRoot(receipt: Screen02AuditDraftReceipt) {
  if (
    !isRecord(receipt) ||
    !exactKeys(receipt, [
      "schemaVersion",
      "receiptId",
      "kind",
      "receivedAt",
      "submissions",
    ]) ||
    receipt.schemaVersion !== SCREEN_02_AUDIT_RECEIPT_SCHEMA_VERSION ||
    !nonempty(receipt.receiptId) ||
    !nonempty(receipt.receivedAt) ||
    !["audit-dossier", "audit-confirmed-event"].includes(receipt.kind) ||
    !Array.isArray(receipt.submissions)
  ) {
    fail("Audit draft receipt failed its canonical root contract.");
  }
  const requestIds: string[] = [];
  for (const submission of receipt.submissions) {
    if (
      !isRecord(submission) ||
      !exactKeys(submission, ["requestId", "requestProof", "draft"]) ||
      !nonempty(submission.requestId) ||
      !nonempty(submission.requestProof)
    ) {
      fail("Audit draft receipt contains a malformed submission.");
    }
    requestIds.push(submission.requestId);
  }
  if (requestIds.length === 0 || new Set(requestIds).size !== requestIds.length) {
    fail(
      "Audit draft receipt must contain at least one uniquely targeted submission.",
    );
  }
}

function assertReceiptIdempotency(
  state: Screen02AuditState,
  receipt: Screen02AuditDraftReceipt,
) {
  const boundRequestIds = state.assessmentRequests
    .filter((request) => request.receiptIds.includes(receipt.receiptId))
    .map((request) => request.requestId)
    .sort();
  if (boundRequestIds.length === 0) return;
  const submittedRequestIds = receipt.submissions
    .map((submission) => submission.requestId)
    .sort();
  if (JSON.stringify(boundRequestIds) !== JSON.stringify(submittedRequestIds)) {
    fail(
      "Audit draft receipt ID is already bound to a different submission set.",
    );
  }
}

function provisionalClaimDraft(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
  id: string,
): { value: Screen02ProvisionalClaim | null; codes: string[] } {
  const codes: string[] = [];
  if (
    !isRecord(value) ||
    !exactKeys(value, ["text", "sourceIds", "uncertainty"])
  ) {
    return { value: null, codes: ["invalid-claim-shape"] };
  }
  if (!boundedNarrative(value.text)) codes.push("missing-or-oversized-claim");
  const sourceIds = uniqueStrings(value.sourceIds, MAX_SOURCES_PER_MATCH);
  if (!sourceIds) codes.push("invalid-source-ids");
  if (sourceIds?.length === 0) codes.push("claim-needs-source");
  if (sourceIds?.some((sourceId) => !allowedSourceIds.has(sourceId))) {
    codes.push("source-outside-match");
  }
  if (value.uncertainty !== null && !boundedNarrative(value.uncertainty, 500)) {
    codes.push("invalid-uncertainty");
  }
  return {
    value:
      codes.length === 0
        ? {
            id,
            text: (value.text as string).trim(),
            sourceIds: sourceIds!,
            status: "provisional",
            uncertainty:
              value.uncertainty === null
                ? null
                : (value.uncertainty as string).trim(),
          }
        : null,
    codes,
  };
}

function claimArrayDraft(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
  idPrefix: string,
  maximum = 20,
  allowEmpty = false,
) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > maximum
  ) {
    return {
      value: null as Screen02ProvisionalClaim[] | null,
      codes: ["claim-count-or-shape"],
    };
  }
  const claims: Screen02ProvisionalClaim[] = [];
  const codes: string[] = [];
  value.forEach((claim, index) => {
    const parsed = provisionalClaimDraft(
      claim,
      allowedSourceIds,
      `${idPrefix}:${index + 1}`,
    );
    if (parsed.value) claims.push(parsed.value);
    else codes.push(...parsed.codes.map((code) => `${index + 1}:${code}`));
  });
  return { value: codes.length === 0 ? claims : null, codes };
}

function timelineDraft(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
  idPrefix: string,
) {
  if (!Array.isArray(value) || value.length > 30) {
    return {
      value: null as Screen02DateLead[] | null,
      codes: ["timeline-count-or-shape"],
    };
  }
  const leads: Screen02DateLead[] = [];
  const codes: string[] = [];
  value.forEach((entry, index) => {
    const prefix = `${index + 1}:`;
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ["date", "label", "stage", "sourceIds", "uncertainty"])
    ) {
      codes.push(`${prefix}invalid-date-lead-shape`);
      return;
    }
    const sourceIds = uniqueStrings(entry.sourceIds, MAX_SOURCES_PER_MATCH);
    if (
      !nonempty(entry.date) ||
      entry.date.trim().length > MAX_DATE_LEAD_DATE_LENGTH
    ) {
      codes.push(`${prefix}missing-or-oversized-date`);
    }
    if (!boundedNarrative(entry.label, 500)) codes.push(`${prefix}missing-label`);
    if (!screen02DateLeadStages.includes(entry.stage as never)) {
      codes.push(`${prefix}invalid-stage`);
    }
    if (!sourceIds || sourceIds.length === 0) {
      codes.push(`${prefix}date-lead-needs-source`);
    } else if (sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
      codes.push(`${prefix}source-outside-match`);
    }
    if (entry.uncertainty !== null && !boundedNarrative(entry.uncertainty, 500)) {
      codes.push(`${prefix}invalid-uncertainty`);
    }
    if (codes.some((code) => code.startsWith(prefix))) return;
    leads.push({
      id: `${idPrefix}:${index + 1}`,
      date: (entry.date as string).trim(),
      label: (entry.label as string).trim(),
      stage: entry.stage as Screen02DateLead["stage"],
      sourceIds: sourceIds!,
      status: "provisional",
      uncertainty:
        entry.uncertainty === null
          ? null
          : (entry.uncertainty as string).trim(),
    });
  });
  return { value: codes.length === 0 ? leads : null, codes };
}

function relatedVersionsDraft(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
) {
  if (!Array.isArray(value) || value.length > 20) {
    return {
      value: null as Screen02AuditDossier["relatedVersions"] | null,
      codes: ["related-version-count-or-shape"],
    };
  }
  const related: Screen02AuditDossier["relatedVersions"] = [];
  const codes: string[] = [];
  value.forEach((entry, index) => {
    const prefix = `${index + 1}:`;
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ["relationship", "identity", "sourceIds", "note"])
    ) {
      codes.push(`${prefix}invalid-related-version-shape`);
      return;
    }
    const sourceIds = uniqueStrings(entry.sourceIds, MAX_SOURCES_PER_MATCH);
    if (!screen02AuditRelationships.includes(entry.relationship as never)) {
      codes.push(`${prefix}invalid-relationship`);
    }
    try {
      validateIdentityInput(entry.identity as Screen02EventIdentity);
    } catch {
      codes.push(`${prefix}invalid-identity`);
    }
    if (!sourceIds || sourceIds.length === 0) {
      codes.push(`${prefix}related-version-needs-source`);
    } else if (sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
      codes.push(`${prefix}source-outside-match`);
    }
    if (!boundedNarrative(entry.note)) codes.push(`${prefix}missing-note`);
    if (codes.some((code) => code.startsWith(prefix))) return;
    related.push({
      relationship: entry.relationship as Screen02AuditRelationship,
      identity: clone(entry.identity as Screen02EventIdentity),
      sourceIds: sourceIds!,
      note: (entry.note as string).trim(),
    });
  });
  return { value: codes.length === 0 ? related : null, codes };
}

type DossierDraftValues = Partial<
  Pick<
    Screen02AuditDossier,
    | "atAGlance"
    | "whatHappened"
    | "whatChanged"
    | "timeline"
    | "broadCoverage"
    | "keyComponents"
    | "relatedVersions"
    | "unresolvedFacts"
  >
>;

const dossierEvidenceGapPartIds = [
  "whatChanged",
  "timeline",
  "broadCoverage",
  "keyComponents",
  "relatedVersions",
] as const;

function normalizedEvidenceGap(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasExplicitDossierEvidenceGap(
  unresolvedFacts: string[],
  partId: (typeof dossierEvidenceGapPartIds)[number],
) {
  const prefix = normalizedEvidenceGap(`Evidence gap — ${partId}:`);
  return unresolvedFacts.some((fact) => {
    const normalized = normalizedEvidenceGap(fact);
    return (
      normalized.startsWith(`${prefix} `) &&
      normalized.length > prefix.length + 1
    );
  });
}

function appendDossierFailure(
  failures: Screen02AssessmentFailure[],
  partId: string,
  code: string,
) {
  const existing = failures.find((failure) => failure.partId === partId);
  if (existing) {
    if (!existing.codes.includes(code)) existing.codes.push(code);
    return;
  }
  failures.push({ partId, codes: [code] });
}

function dossierDraftParts(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
  draft: unknown,
) {
  if (request.target.mode !== "audit-dossier") {
    fail("Dossier draft targets the wrong request mode.");
  }
  const target = request.target;
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === target.matchSnapshotId,
  );
  if (!match) fail("Dossier draft target is unavailable.");
  const record = isRecord(draft) ? draft : {};
  if (
    !isRecord(draft) ||
    Object.keys(record).some((key) => !request.requestedPartIds.includes(key))
  ) {
    return {
      values: {} as DossierDraftValues,
      failures: request.requestedPartIds.map((partId) => ({
        partId,
        codes: ["invalid-dossier-draft-shape"],
      })),
    };
  }
  const allowedSourceIds = new Set(match.sourceIds);
  const values: DossierDraftValues = {};
  const failures: Screen02AssessmentFailure[] = [];
  const accept = <K extends keyof DossierDraftValues>(
    partId: K,
    parsed: { value: DossierDraftValues[K] | null; codes: string[] },
  ) => {
    if (parsed.value !== null) values[partId] = parsed.value;
    else failures.push({ partId, codes: parsed.codes });
  };
  for (const partId of request.requestedPartIds) {
    if (partId === "atAGlance") {
      accept(
        partId,
        claimArrayDraft(record[partId], allowedSourceIds, `${request.requestId}:${partId}`, 8),
      );
    } else if (partId === "whatHappened") {
      accept(
        partId,
        provisionalClaimDraft(
          record[partId],
          allowedSourceIds,
          `${request.requestId}:${partId}`,
        ),
      );
    } else if (
      partId === "whatChanged" ||
      partId === "broadCoverage" ||
      partId === "keyComponents"
    ) {
      accept(
        partId,
        claimArrayDraft(
          record[partId],
          allowedSourceIds,
          `${request.requestId}:${partId}`,
          20,
          true,
        ),
      );
    } else if (partId === "timeline") {
      accept(
        partId,
        timelineDraft(record[partId], allowedSourceIds, `${request.requestId}:${partId}`),
      );
    } else if (partId === "relatedVersions") {
      accept(partId, relatedVersionsDraft(record[partId], allowedSourceIds));
    } else if (partId === "unresolvedFacts") {
      const facts = uniqueStrings(record[partId], 20);
      if (
        facts &&
        facts.length > 0 &&
        facts.every((fact) => boundedNarrative(fact, 500))
      ) {
        values.unresolvedFacts = facts;
      } else {
        failures.push({
          partId,
          codes: ["unresolved-fact-count-or-shape"],
        });
      }
    }
  }
  const previous = previousDossier(state, request);
  const unresolvedFacts =
    values.unresolvedFacts ?? previous?.unresolvedFacts ?? [];
  for (const partId of dossierEvidenceGapPartIds) {
    const section = values[partId] ?? previous?.[partId];
    if (
      !Array.isArray(section) ||
      section.length > 0 ||
      hasExplicitDossierEvidenceGap(unresolvedFacts, partId)
    ) {
      continue;
    }
    if (request.requestedPartIds.includes(partId)) {
      delete values[partId];
      appendDossierFailure(
        failures,
        partId,
        "empty-section-needs-explicit-evidence-gap",
      );
    }
    if (request.requestedPartIds.includes("unresolvedFacts")) {
      delete values.unresolvedFacts;
      appendDossierFailure(
        failures,
        "unresolvedFacts",
        `missing-empty-section-evidence-gap:${partId}`,
      );
    }
  }
  return { values, failures };
}

function previousDossier(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
) {
  const requestById = new Map(
    state.assessmentRequests.map((item) => [item.requestId, item]),
  );
  return state.dossiers
    .filter((dossier) => requestById.get(dossier.requestId)?.jobId === request.jobId)
    .sort(
      (left, right) =>
        (requestById.get(left.requestId)?.attempt ?? 0) -
        (requestById.get(right.requestId)?.attempt ?? 0),
    )
    .at(-1) ?? null;
}

function cumulativeDossier(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
  values: DossierDraftValues,
  acceptedPartIds: string[],
  requestStatus: "partial" | "completed" | "retry-exhausted",
  recordedAt: string,
  inheritPrevious = true,
) {
  if (request.target.mode !== "audit-dossier") {
    fail("Dossier result targets the wrong request mode.");
  }
  const previous = inheritPrevious ? previousDossier(state, request) : null;
  const atAGlance = values.atAGlance ?? previous?.atAGlance ?? [];
  const whatHappened = values.whatHappened ?? previous?.whatHappened ?? null;
  const whatChanged = values.whatChanged ?? previous?.whatChanged ?? [];
  const timeline = values.timeline ?? previous?.timeline ?? [];
  const broadCoverage = values.broadCoverage ?? previous?.broadCoverage ?? [];
  const keyComponents = values.keyComponents ?? previous?.keyComponents ?? [];
  const relatedVersions =
    values.relatedVersions ?? previous?.relatedVersions ?? [];
  const unresolvedFacts =
    values.unresolvedFacts ?? previous?.unresolvedFacts ?? [];
  const sourceIds = [
    ...new Set([
      ...atAGlance,
      ...(whatHappened ? [whatHappened] : []),
      ...whatChanged,
      ...timeline,
      ...broadCoverage,
      ...keyComponents,
      ...relatedVersions,
    ].flatMap((item) => item.sourceIds)),
  ];
  const acceptedAcrossJob = new Set(
    state.assessmentRequests
      .filter((item) => item.jobId === request.jobId)
      .flatMap((item) =>
        item.requestId === request.requestId
          ? acceptedPartIds
          : item.acceptedPartIds,
      ),
  );
  const status =
    requestStatus === "completed" &&
    screen02AuditDossierPartIds.every((partId) => acceptedAcrossJob.has(partId))
      ? ("completed" as const)
      : ("partial" as const);
  const base = {
    dossierSnapshotId: `${request.requestId}:dossier`,
    identitySnapshotId: request.target.identitySnapshotId,
    requestId: request.requestId,
    status,
    atAGlance: clone(atAGlance),
    whatHappened: clone(whatHappened),
    whatChanged: clone(whatChanged),
    timeline: clone(timeline),
    broadCoverage: clone(broadCoverage),
    keyComponents: clone(keyComponents),
    relatedVersions: clone(relatedVersions),
    unresolvedFacts: [...unresolvedFacts],
    sourceIds,
    recordedAt,
  };
  return {
    ...base,
    dossierFingerprint: fingerprintScreen02AuditDossier({
      ...base,
      dossierFingerprint: "pending",
    }),
  } satisfies Screen02AuditDossier;
}

function assessmentComponentDraft<Category extends string>(
  value: unknown,
  categories: readonly Category[],
  allowedSourceIds: ReadonlySet<string>,
) {
  const codes: string[] = [];
  if (
    !isRecord(value) ||
    !exactKeys(value, ["category", "explanation", "evidenceSourceIds"])
  ) {
    return {
      value: null as Screen02AssessmentComponent<Category> | null,
      codes: ["invalid-component-shape"],
    };
  }
  if (!categories.includes(value.category as Category)) {
    codes.push("invalid-category");
  }
  if (!boundedNarrative(value.explanation)) {
    codes.push("missing-or-oversized-explanation");
  }
  const evidenceSourceIds = uniqueStrings(value.evidenceSourceIds);
  if (!evidenceSourceIds) codes.push("invalid-evidence-ids");
  if (evidenceSourceIds?.some((sourceId) => !allowedSourceIds.has(sourceId))) {
    codes.push("evidence-outside-confirmed-packet");
  }
  if (value.category !== "unclear" && evidenceSourceIds?.length === 0) {
    codes.push("resolved-category-needs-evidence");
  }
  return {
    value:
      codes.length === 0
        ? {
            category: value.category as Category,
            explanation: (value.explanation as string).trim(),
            evidenceSourceIds: evidenceSourceIds!,
          }
        : null,
    codes,
  };
}

type AuditAssessmentDraftValues = Partial<
  Pick<
    Screen02AuditAssessment,
    | "studyFit"
    | "outcomePathway"
    | "coverageRelation"
    | "measurementPotential"
    | "mainConcern"
    | "nextChecks"
  >
>;

function auditAssessmentNarratives(
  value: AuditAssessmentDraftValues | Screen02AuditAssessment | null,
) {
  if (!value) return [];
  return [
    value.studyFit?.explanation,
    value.outcomePathway?.explanation,
    value.coverageRelation?.explanation,
    value.measurementPotential?.explanation,
    value.mainConcern,
    ...(value.nextChecks ?? []),
  ].filter((item): item is string => nonempty(item));
}

function assessmentDraftParts(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
  draft: unknown,
) {
  if (request.target.mode !== "audit-confirmed-event") {
    fail("Assessment draft targets the wrong request mode.");
  }
  const target = request.target;
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === target.matchSnapshotId,
  );
  const dossier = state.dossiers.find(
    (item) => item.dossierSnapshotId === target.dossierSnapshotId,
  );
  if (!match || !dossier) fail("Assessment draft target is unavailable.");
  const record = isRecord(draft) ? draft : {};
  if (
    !isRecord(draft) ||
    Object.keys(record).some((key) => !request.requestedPartIds.includes(key))
  ) {
    return {
      values: {} as AuditAssessmentDraftValues,
      failures: request.requestedPartIds.map((partId) => ({
        partId,
        codes: ["invalid-assessment-draft-shape"],
      })),
    };
  }
  const allowedSourceIds = new Set([...match.sourceIds, ...dossier.sourceIds]);
  const values: AuditAssessmentDraftValues = {};
  const failures: Screen02AssessmentFailure[] = [];
  for (const partId of request.requestedPartIds) {
    if (partId === "studyFit") {
      const parsed = assessmentComponentDraft(
        record[partId],
        screen02StudyFitCategories,
        allowedSourceIds,
      );
      if (parsed.value) values.studyFit = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "outcomePathway") {
      const parsed = assessmentComponentDraft(
        record[partId],
        screen02OutcomePathwayCategories,
        allowedSourceIds,
      );
      if (parsed.value) values.outcomePathway = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "coverageRelation") {
      const parsed = assessmentComponentDraft(
        record[partId],
        screen02CoverageRelationCategories,
        allowedSourceIds,
      );
      if (parsed.value) values.coverageRelation = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "measurementPotential") {
      const parsed = assessmentComponentDraft(
        record[partId],
        screen02MeasurementPotentialCategories,
        allowedSourceIds,
      );
      if (parsed.value) values.measurementPotential = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "mainConcern") {
      if (boundedNarrative(record[partId])) {
        values.mainConcern = (record[partId] as string).trim();
      } else failures.push({ partId, codes: ["missing-main-concern"] });
    } else if (partId === "nextChecks") {
      const checks = uniqueStrings(record[partId], 3);
      if (
        checks &&
        checks.length > 0 &&
        checks.every((check) => boundedNarrative(check, 500))
      ) {
        values.nextChecks = checks;
      } else failures.push({ partId, codes: ["next-check-count-or-shape"] });
    }
  }
  const currentNarratives = auditAssessmentNarratives(values);
  const priorNarratives = auditAssessmentNarratives(
    previousAuditAssessment(state, request),
  );
  if (
    currentNarratives.length > 0 &&
    !auditNarrativesNameIdentity(match.identity, [
      ...priorNarratives,
      ...currentNarratives,
    ])
  ) {
    const invalidate = (partId: string) => {
      if (!failures.some((failure) => failure.partId === partId)) {
        failures.push({
          partId,
          codes: ["confirmed-identity-grounding-missing"],
        });
      }
    };
    if (values.studyFit) {
      invalidate("studyFit");
      delete values.studyFit;
    }
    if (values.outcomePathway) {
      invalidate("outcomePathway");
      delete values.outcomePathway;
    }
    if (values.coverageRelation) {
      invalidate("coverageRelation");
      delete values.coverageRelation;
    }
    if (values.measurementPotential) {
      invalidate("measurementPotential");
      delete values.measurementPotential;
    }
    if (values.mainConcern) {
      invalidate("mainConcern");
      delete values.mainConcern;
    }
    if (values.nextChecks) {
      invalidate("nextChecks");
      delete values.nextChecks;
    }
  }
  return { values, failures };
}

function previousAuditAssessment(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
) {
  const requestById = new Map(
    state.assessmentRequests.map((item) => [item.requestId, item]),
  );
  return state.assessments
    .filter(
      (assessment) => requestById.get(assessment.requestId)?.jobId === request.jobId,
    )
    .sort(
      (left, right) =>
        (requestById.get(left.requestId)?.attempt ?? 0) -
        (requestById.get(right.requestId)?.attempt ?? 0),
    )
    .at(-1) ?? null;
}

function cumulativeAuditAssessment(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
  values: AuditAssessmentDraftValues,
  acceptedPartIds: string[],
  requestStatus: "partial" | "completed" | "retry-exhausted",
  recordedAt: string,
) {
  if (request.target.mode !== "audit-confirmed-event") {
    fail("Assessment result targets the wrong request mode.");
  }
  const previous = previousAuditAssessment(state, request);
  const studyFit = values.studyFit ?? previous?.studyFit ?? null;
  const outcomePathway = values.outcomePathway ?? previous?.outcomePathway ?? null;
  const coverageRelation =
    values.coverageRelation ?? previous?.coverageRelation ?? null;
  const measurementPotential =
    values.measurementPotential ?? previous?.measurementPotential ?? null;
  const mainConcern = values.mainConcern ?? previous?.mainConcern ?? null;
  const nextChecks = values.nextChecks ?? previous?.nextChecks ?? [];
  const acceptedAcrossJob = [
    ...new Set(
      state.assessmentRequests
        .filter((item) => item.jobId === request.jobId)
        .flatMap((item) =>
          item.requestId === request.requestId
            ? acceptedPartIds
            : item.acceptedPartIds,
        ),
    ),
  ];
  const status =
    requestStatus === "completed" &&
    screen02AuditAssessmentPartIds.every((partId) =>
      acceptedAcrossJob.includes(partId),
    )
      ? ("completed" as const)
      : ("partial" as const);
  const evidenceSourceIds = [
    ...new Set(
      [studyFit, outcomePathway, coverageRelation, measurementPotential].flatMap(
        (component) => component?.evidenceSourceIds ?? [],
      ),
    ),
  ];
  const overallJudgment =
    status === "completed"
      ? deriveScreen02AuditJudgment({
          studyFit: studyFit?.category ?? null,
          outcomePathway: outcomePathway?.category ?? null,
          coverageRelation: coverageRelation?.category ?? null,
          measurementPotential: measurementPotential?.category ?? null,
        })
      : null;
  return {
    assessmentId: `${request.requestId}:assessment`,
    identitySnapshotId: request.target.identitySnapshotId,
    requestId: request.requestId,
    status,
    studyFit,
    outcomePathway,
    coverageRelation,
    measurementPotential,
    mainConcern,
    nextChecks: [...nextChecks],
    evidenceSourceIds,
    acceptedFields: acceptedAcrossJob,
    overallJudgment,
    overallJudgmentMethod: overallJudgment ? ("fixed-computation" as const) : null,
    recordedAt,
  } satisfies Screen02AuditAssessment;
}

export type Screen02AuditReceiptApplicationResult = {
  requestId: string;
  status:
    | "completed"
    | "partial"
    | "retry-exhausted"
    | "validation-failed"
    | "ignored";
  acceptedPartIds: string[];
  failures: Screen02AssessmentFailure[];
  reason: string;
};

function beginReceiptSubmission(
  state: Screen02AuditState,
  receipt: Screen02AuditDraftReceipt,
  submission: Screen02AuditDraftSubmission,
  mode: Screen02AuditDraftReceipt["kind"],
  at: string,
) {
  const request = state.assessmentRequests.find(
    (item) => item.requestId === submission.requestId,
  );
  if (!request || request.target.mode !== mode) {
    return {
      state,
      request: null,
      result: {
        requestId: submission.requestId,
        status: "ignored" as const,
        acceptedPartIds: [],
        failures: [],
        reason: `No matching ${mode} request exists.`,
      },
    };
  }
  if (
    request.receiptIds.includes(receipt.receiptId) ||
    request.status === "completed" ||
    request.status === "retry-exhausted"
  ) {
    return {
      state,
      request: null,
      result: {
        requestId: request.requestId,
        status: "ignored" as const,
        acceptedPartIds: [],
        failures: [],
        reason: "This receipt or immutable Audit target was already applied.",
      },
    };
  }
  if (
    request.status !== "message-delivered" ||
    submission.requestProof !== screen02AuditRequestProof(request)
  ) {
    return {
      state,
      request: null,
      result: {
        requestId: request.requestId,
        status: "ignored" as const,
        acceptedPartIds: [],
        failures: [],
        reason:
          request.status !== "message-delivered"
            ? "Message delivery has not been recorded for this Audit request."
            : "The request proof does not match the immutable Audit target.",
      },
    };
  }
  let next = transitionScreen02AssessmentRequest(state, {
    requestId: request.requestId,
    status: "draft-received",
    at,
    actor: "chatgpt-host",
    note: "A matching model-only Audit draft receipt arrived.",
    receiptId: receipt.receiptId,
  }) as Screen02AuditState;
  next = transitionScreen02AssessmentRequest(next, {
    requestId: request.requestId,
    status: "validating",
    at,
    actor: "fixed-core",
    note: "Fixed code is validating each requested Audit part.",
  }) as Screen02AuditState;
  return {
    state: next,
    request: next.assessmentRequests.find(
      (item) => item.requestId === request.requestId,
    )!,
    result: null,
  };
}

function finishZeroAccepted(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
  failures: Screen02AssessmentFailure[],
  at: string,
) {
  const status =
    request.attempt === 3
      ? ("retry-exhausted" as const)
      : ("validation-failed" as const);
  const next = transitionScreen02AssessmentRequest(state, {
    requestId: request.requestId,
    status,
    at,
    actor: "fixed-core",
    note:
      status === "retry-exhausted"
        ? "No requested Audit part passed fixed validation on the final attempt."
        : "No requested Audit part passed fixed validation.",
    acceptedPartIds: status === "retry-exhausted" ? [] : undefined,
    failures: status === "retry-exhausted" ? failures : undefined,
  }) as Screen02AuditState;
  return {
    state: next,
    result: {
      requestId: request.requestId,
      status,
      acceptedPartIds: [],
      failures,
      reason:
        status === "retry-exhausted"
          ? "No requested Audit part passed before the retry budget was exhausted."
          : "No requested Audit part passed fixed validation.",
    } satisfies Screen02AuditReceiptApplicationResult,
  };
}

export function applyScreen02AuditDossierDraftReceipt(
  state: Screen02AuditState,
  receipt: Screen02AuditDraftReceipt,
  at = receipt.receivedAt,
) {
  validateReceiptRoot(receipt);
  if (receipt.kind !== "audit-dossier") {
    fail("Dossier application received a confirmed-event receipt.");
  }
  let next = requireWritableAuditState(state);
  requireChronologicalTime(at, next.updatedAt, "Audit dossier receipt time");
  assertReceiptIdempotency(next, receipt);
  const results: Screen02AuditReceiptApplicationResult[] = [];
  for (const submission of receipt.submissions) {
    const begun = beginReceiptSubmission(
      next,
      receipt,
      submission,
      "audit-dossier",
      at,
    );
    next = begun.state;
    if (!begun.request) {
      results.push(begun.result!);
      continue;
    }
    const request = begun.request;
    const parsed = dossierDraftParts(next, request, submission.draft);
    const failedIds = new Set(parsed.failures.map((failure) => failure.partId));
    const acceptedPartIds = request.requestedPartIds.filter(
      (partId) => !failedIds.has(partId),
    );
    if (acceptedPartIds.length === 0) {
      const finished = finishZeroAccepted(next, request, parsed.failures, at);
      next = finished.state;
      results.push(finished.result);
      continue;
    }
    const status =
      parsed.failures.length === 0
        ? ("completed" as const)
        : request.attempt === 3
          ? ("retry-exhausted" as const)
          : ("partial" as const);
    const dossier = cumulativeDossier(
      next,
      request,
      parsed.values,
      acceptedPartIds,
      status,
      at,
    );
    next = finalizeScreen02AuditDossierRequest(next, {
      requestId: request.requestId,
      status,
      at,
      note:
        status === "completed"
          ? "Every requested dossier part passed fixed validation."
          : status === "retry-exhausted"
            ? "Valid dossier parts were frozen and remaining failures exhausted the retry budget."
            : "Valid dossier parts were frozen and only failed parts remain retryable.",
      acceptedPartIds,
      failures: parsed.failures,
      dossier,
    });
    results.push({
      requestId: request.requestId,
      status,
      acceptedPartIds,
      failures: parsed.failures,
      reason:
        status === "completed"
          ? "Dossier ready for researcher review."
          : status === "retry-exhausted"
            ? "Some dossier parts are ready; listed failures exhausted the retry budget."
            : "Some dossier parts are ready; only listed parts need retry.",
    });
  }
  return { state: next, results };
}

/**
 * Keep Audit usable when the host cannot deliver its automatic ChatGPT turn.
 * This deliberately creates only an identity-bound, source-linked review aid:
 * no timing, coverage, component, change, or version fact is inferred. Every
 * unsupported section stays empty and is paired with an explicit evidence gap.
 */
export function applyScreen02AuditDossierFixedFallback(
  state: Screen02AuditState,
  requestId: string,
  at: string,
) {
  let next = requireWritableAuditState(state);
  requireChronologicalTime(at, next.updatedAt, "Audit dossier fallback time");
  const request = next.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  );
  const target = request?.target;
  if (
    !request ||
    !target ||
    target.mode !== "audit-dossier" ||
    ![
      "delivery-rejected",
      "service-unavailable",
      "no-tool-submission",
      "validation-failed",
      "partial",
      "retry-exhausted",
    ].includes(request.status)
  ) {
    fail(
      "Audit dossier fixed fallback requires an active unavailable dossier request.",
    );
  }
  const match = next.possibleMatches.find(
    (candidate) =>
      candidate.matchSnapshotId === target.matchSnapshotId &&
      candidate.identitySnapshotId === target.identitySnapshotId,
  );
  const sourceId = match?.sourceIds[0];
  if (!match || !sourceId) {
    fail("Audit dossier fixed fallback requires the immutable match source.");
  }
  next = transitionScreen02AssessmentRequest(next, {
    requestId,
    status: "validating",
    at,
    actor: "fixed-core",
    note:
      "Fixed code is validating a source-derived identity-only dossier after host delivery became unavailable.",
    ...(["partial", "retry-exhausted"].includes(request.status)
      ? { acceptedPartIds: [], failures: [] }
      : {}),
  }) as Screen02AuditState;
  const validatingRequest = next.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  )!;
  const title = match.identity.canonicalTitle.replace(/\s+/g, " ").trim();
  const claim = (text: string) => ({
    text,
    sourceIds: [sourceId],
    uncertainty:
      "Source-derived fixed fallback, not a ChatGPT interpretation; verify the identity and every substantive event fact against the linked source.",
  });
  const allParts: Record<string, unknown> = {
    atAGlance: [
      claim(
        `${title} is the immutable possible-match identity currently under researcher review; this fallback does not confirm the identity or add substantive event facts.`,
      ),
    ],
    whatHappened: claim(
      `${title} is the source-linked possible match returned for the known-shock anchor; the researcher must verify the exact identity and operative version.`,
    ),
    whatChanged: [],
    timeline: [],
    broadCoverage: [],
    keyComponents: [],
    relatedVersions: [],
    unresolvedFacts: [
      `Evidence gap — whatChanged: the fixed fallback did not establish a source-backed substantive change for ${title}.`,
      `Evidence gap — timeline: the fixed fallback did not establish enactment, effective, implementation, or enforcement dates for ${title}.`,
      `Evidence gap — broadCoverage: the fixed fallback did not establish covered people, organizations, or places for ${title}.`,
      `Evidence gap — keyComponents: the fixed fallback did not establish source-backed operative components for ${title}.`,
      `Evidence gap — relatedVersions: the fixed fallback did not establish whether another original act, amendment, implementing rule, or enforcement action is intended.`,
      `Verify ${title}'s exact identity, operative version, dates, coverage, components, and related versions before relying on it.`,
    ],
  };
  const fallbackRequest = {
    ...validatingRequest,
    requestedPartIds: [...screen02AuditDossierPartIds],
  };
  const draft = Object.fromEntries(
    fallbackRequest.requestedPartIds.map((partId) => [
      partId,
      allParts[partId],
    ]),
  );
  const parsed = dossierDraftParts(next, fallbackRequest, draft);
  if (parsed.failures.length > 0) {
    fail("Audit dossier fixed fallback did not pass the canonical dossier parser.");
  }
  const acceptedPartIds = [...validatingRequest.requestedPartIds];
  const dossier = cumulativeDossier(
    next,
    fallbackRequest,
    parsed.values,
    [...screen02AuditDossierPartIds],
    "completed",
    at,
    false,
  );
  next = finalizeScreen02AuditDossierRequest(next, {
    requestId,
    status: "completed",
    at,
    note:
      SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
    acceptedPartIds,
    failures: [],
    dossier,
  });
  return { state: next, dossier };
}

/**
 * Complete a confirmed-event review conservatively when the bounded ChatGPT
 * turn is unavailable. The fixed result is derived only from the immutable
 * researcher confirmation, its frozen dossier, and the confirmed Screen 1
 * study context. It deliberately leaves every evaluative category unclear.
 */
export function applyScreen02AuditConfirmedEventFixedFallback(
  state: Screen02AuditState,
  requestId: string,
  at: string,
) {
  let next = requireWritableAuditState(state);
  requireChronologicalTime(at, next.updatedAt, "Audit assessment fallback time");
  const request = next.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  );
  const target = request?.target;
  if (
    !request ||
    !target ||
    target.mode !== "audit-confirmed-event" ||
    ![
      "delivery-rejected",
      "service-unavailable",
      "no-tool-submission",
      "validation-failed",
      "partial",
      "retry-exhausted",
    ].includes(request.status)
  ) {
    fail(
      "Audit assessment fixed fallback requires an active unavailable confirmed-event request.",
    );
  }
  const confirmation = next.confirmedIdentity;
  const match = next.possibleMatches.find(
    (candidate) =>
      candidate.matchSnapshotId === target.matchSnapshotId &&
      candidate.identitySnapshotId === target.identitySnapshotId,
  );
  const dossier = next.dossiers.find(
    (candidate) =>
      candidate.dossierSnapshotId === target.dossierSnapshotId &&
      candidate.identitySnapshotId === target.identitySnapshotId &&
      candidate.status === "completed",
  );
  if (
    !confirmation ||
    confirmation.confirmationSnapshotId !== target.confirmationSnapshotId ||
    confirmation.confirmationFingerprint !== target.confirmationFingerprint ||
    confirmation.identitySnapshotId !== target.identitySnapshotId ||
    confirmation.dossierSnapshotId !== target.dossierSnapshotId ||
    !match ||
    !dossier
  ) {
    fail(
      "Audit assessment fixed fallback requires the immutable confirmed event and completed dossier.",
    );
  }

  const title = match.identity.canonicalTitle.replace(/\s+/g, " ").trim();
  const scope = next.screen01Baseline.scopeContract;
  const compact = (value: string | null | undefined, maximum = 360) => {
    const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
    return normalized.length <= maximum
      ? normalized
      : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
  };
  const shortTitle = compact(title, 180);
  const allowedSourceIds = new Set([...match.sourceIds, ...dossier.sourceIds]);
  const evidence = (...groups: readonly string[][]) =>
    [
      ...new Set(
        groups
          .flat()
          .filter((sourceId) => allowedSourceIds.has(sourceId)),
      ),
    ].slice(0, 50);
  const identityEvidence = evidence(
    match.sourceIds,
    dossier.atAGlance.flatMap((claim) => claim.sourceIds),
    dossier.whatHappened?.sourceIds ?? [],
  );
  const dateLead = dossier.timeline[0] ?? null;
  const eventClaim =
    dossier.whatChanged[0] ??
    dossier.keyComponents[0] ??
    dossier.whatHappened ??
    dossier.atAGlance[0] ??
    null;
  const coverageClaim = dossier.broadCoverage[0] ?? null;
  const eventFact = eventClaim
    ? `The retained dossier says: ${compact(eventClaim.text)}`
    : "The retained dossier does not establish a substantive change or component.";
  const coverageFact = coverageClaim
    ? `The retained dossier says: ${compact(coverageClaim.text)}`
    : "The retained dossier does not establish historical unit-level coverage.";
  const timingFact = dateLead
    ? `The retained dossier records ${compact(dateLead.label, 160)} (${dateLead.stage}) at ${compact(dateLead.date, 120)} as a provisional date lead.`
    : "The retained dossier does not establish a usable event-stage date.";
  const component = (
    explanation: string,
    evidenceSourceIds: string[],
  ) => ({
    category: "unclear" as const,
    explanation,
    evidenceSourceIds,
  });
  const allParts: Record<string, unknown> = {
    studyFit: component(
      `${title} is the researcher-confirmed event for a study of ${compact(scope.population, 180)} in ${compact(scope.geography, 180)} during ${compact(scope.studyPeriod, 120)}. ${timingFact} Those retained facts do not resolve which event stage or historical coverage rule fits the study, so study fit remains unclear.`,
      evidence(identityEvidence, dateLead?.sourceIds ?? []),
    ),
    outcomePathway: component(
      `${title} is being assessed against the study outcome family ${compact(scope.outcomeFamily, 180)}. ${eventFact} These provisional source-linked facts do not establish a pathway to that outcome, so the outcome pathway remains unclear.`,
      evidence(identityEvidence, eventClaim?.sourceIds ?? []),
    ),
    coverageRelation: component(
      `${title} must be related to the study population ${compact(scope.population, 180)} in ${compact(scope.geography, 180)}. ${coverageFact} The retained facts do not establish historical assignment for the sampled units, so the coverage relation remains unclear.`,
      evidence(identityEvidence, coverageClaim?.sourceIds ?? []),
    ),
    measurementPotential: component(
      `${title} would need a defensible pre-event exposure indicator at the ${compact(scope.assignmentLevel, 120)} assignment level. ${timingFact} The immutable record does not establish that indicator or unit mapping, so measurement potential remains unclear.`,
      evidence(identityEvidence, dateLead?.sourceIds ?? []),
    ),
    mainConcern:
      `${title}: this fixed fallback preserves the confirmed identity and retained source-linked facts, but it cannot resolve the operative event stage, historical coverage rule, outcome pathway, or unit-level exposure measure.`,
    nextChecks: [
      `Verify which retained date lead for ${shortTitle}, if any, is the defensible study event time.`,
      `Verify historical coverage of ${shortTitle} for ${compact(scope.population, 180)} in ${compact(scope.geography, 180)} at the ${compact(scope.assignmentLevel, 120)} level.`,
      `Verify a pre-event exposure measure linking ${shortTitle} to ${compact(scope.outcomeFamily, 180)} without inspecting realized outcome values.`,
    ],
  };
  const acceptedPartIds = new Set(request.acceptedPartIds);
  const fallbackPartIds = request.requestedPartIds.filter(
    (partId) => !acceptedPartIds.has(partId),
  );
  if (fallbackPartIds.length === 0) {
    fail("Audit assessment fixed fallback has no unresolved assessment part.");
  }
  const fallbackRequest = {
    ...request,
    requestedPartIds: fallbackPartIds,
  };
  const draft = Object.fromEntries(
    fallbackRequest.requestedPartIds.map((partId) => [
      partId,
      allParts[partId],
    ]),
  );
  const parsed = assessmentDraftParts(next, fallbackRequest, draft);
  if (parsed.failures.length > 0) {
    fail(
      "Audit assessment fixed fallback did not pass the canonical assessment parser.",
    );
  }
  const assessment = cumulativeAuditAssessment(
    next,
    fallbackRequest,
    parsed.values,
    [...request.requestedPartIds],
    "completed",
    at,
  );
  next = transitionScreen02AssessmentRequest(next, {
    requestId,
    status: "validating",
    at,
    actor: "fixed-core",
    note:
      "Fixed code is validating a conservative assessment derived from the immutable confirmation, dossier, and study context.",
    ...(["partial", "retry-exhausted"].includes(request.status)
      ? { acceptedPartIds: [], failures: [] }
      : {}),
  }) as Screen02AuditState;
  const validatingRequest = next.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  )!;
  next = finalizeScreen02AuditAssessmentRequest(next, {
    requestId,
    status: "completed",
    at,
    note:
      SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
    acceptedPartIds: [...validatingRequest.requestedPartIds],
    failures: [],
    assessment,
  });
  return { state: next, assessment };
}

export function applyScreen02AuditAssessmentDraftReceipt(
  state: Screen02AuditState,
  receipt: Screen02AuditDraftReceipt,
  at = receipt.receivedAt,
) {
  validateReceiptRoot(receipt);
  if (receipt.kind !== "audit-confirmed-event") {
    fail("Assessment application received a dossier receipt.");
  }
  let next = requireWritableAuditState(state);
  requireChronologicalTime(at, next.updatedAt, "Audit assessment receipt time");
  assertReceiptIdempotency(next, receipt);
  const results: Screen02AuditReceiptApplicationResult[] = [];
  for (const submission of receipt.submissions) {
    const begun = beginReceiptSubmission(
      next,
      receipt,
      submission,
      "audit-confirmed-event",
      at,
    );
    next = begun.state;
    if (!begun.request) {
      results.push(begun.result!);
      continue;
    }
    const request = begun.request;
    const parsed = assessmentDraftParts(next, request, submission.draft);
    const failedIds = new Set(parsed.failures.map((failure) => failure.partId));
    const acceptedPartIds = request.requestedPartIds.filter(
      (partId) => !failedIds.has(partId),
    );
    if (acceptedPartIds.length === 0) {
      const finished = finishZeroAccepted(next, request, parsed.failures, at);
      next = finished.state;
      results.push(finished.result);
      continue;
    }
    const status =
      parsed.failures.length === 0
        ? ("completed" as const)
        : request.attempt === 3
          ? ("retry-exhausted" as const)
          : ("partial" as const);
    const assessment = cumulativeAuditAssessment(
      next,
      request,
      parsed.values,
      acceptedPartIds,
      status,
      at,
    );
    next = finalizeScreen02AuditAssessmentRequest(next, {
      requestId: request.requestId,
      status,
      at,
      note:
        status === "completed"
          ? "Every requested confirmed-event assessment part passed fixed validation."
          : status === "retry-exhausted"
            ? "Valid assessment parts were frozen and remaining failures exhausted the retry budget."
            : "Valid assessment parts were frozen and only failed parts remain retryable.",
      acceptedPartIds,
      failures: parsed.failures,
      assessment,
    });
    results.push({
      requestId: request.requestId,
      status,
      acceptedPartIds,
      failures: parsed.failures,
      reason:
        status === "completed"
          ? "Confirmed-event assessment ready."
          : status === "retry-exhausted"
            ? "Some assessment parts are ready; listed failures exhausted the retry budget."
            : "Some assessment parts are ready; only listed parts need retry.",
    });
  }
  return { state: next, results };
}

function requestPacketParts(
  state: Screen02AuditState,
  requestId: string,
  mode: "audit-dossier" | "audit-confirmed-event",
) {
  const safe = requireScreen02AuditState(state);
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === requestId && item.target.mode === mode,
  );
  if (
    !request ||
    !["prepared", "message-delivered"].includes(request.status)
  ) {
    fail("Audit packet requires a prepared or delivered active request.");
  }
  const target = request.target as Extract<
    Screen02AssessmentRequest["target"],
    { mode: typeof mode }
  >;
  const anchorRevision = safe.anchor.revisions.find(
    (item) => item.anchorRevisionId === target.anchorRevisionId,
  )!;
  const match = safe.possibleMatches.find(
    (item) => item.matchSnapshotId === target.matchSnapshotId,
  )!;
  return { safe, request, target, anchorRevision, match };
}

function boundedStudyContext(state: Screen02AuditState) {
  const scope = state.screen01Baseline.scopeContract;
  return {
    population: scope.population,
    geography: scope.geography,
    industry: scope.industry,
    studyPeriod: scope.studyPeriod,
    eventFamily: scope.eventFamily,
    outcomeFamily: scope.outcomeFamily,
    studySentence: state.screen01Baseline.studySentence,
  };
}

export function buildScreen02AuditDossierPacket(
  state: Screen02AuditState,
  requestId: string,
) {
  const { safe, request, target, anchorRevision, match } = requestPacketParts(
    state,
    requestId,
    "audit-dossier",
  );
  const sources = match.sourceIds
    .map((sourceId) => safe.sources.find((source) => source.id === sourceId))
    .filter((source): source is Screen02WorkflowSource => Boolean(source))
    .map((source) => clone(source));
  return {
    schemaVersion: SCREEN_02_AUDIT_DOSSIER_PACKET_SCHEMA_VERSION,
    draftSchemaVersion: SCREEN_02_AUDIT_DOSSIER_DRAFT_SCHEMA_VERSION,
    purpose:
      "Prepare source-grounded provisional identity facts for researcher review before identity confirmation.",
    requestId: request.requestId,
    requestProof: screen02AuditRequestProof(request),
    packetFingerprint: target.packetFingerprint,
    attempt: request.attempt,
    requestedPartIds: [...request.requestedPartIds],
    anchor: {
      originalWording: safe.anchor.originalWording,
      activeRevision: clone(anchorRevision),
    },
    match: clone(match),
    sources,
    allowedValues: {
      relationships: [...screen02AuditRelationships],
      timelineStages: [...screen02DateLeadStages],
    },
    exclusions: [
      "Do not confirm event identity; the researcher owns confirmation.",
      "Do not rewrite the original Screen 1 wording or immutable match facts.",
      "Use only source IDs attached to this exact possible-match snapshot.",
      "Distinguish exact identity or alias from original, amendment, implementing rule, enforcement action, and other related event.",
      "Keep unresolved or conflicting facts explicit and every generated claim provisional.",
      "If whatChanged, timeline, broadCoverage, keyComponents, or relatedVersions is empty, add a specific unresolvedFacts entry beginning `Evidence gap — <partId>:` that states what source evidence is missing; an empty array never implies completeness.",
      "Do not inspect or report realized outcome values, causal validity, or Screen 3 constructs.",
    ],
    outcomeValuesInspected: false as const,
  };
}

export function buildScreen02AuditAssessmentPacket(
  state: Screen02AuditState,
  requestId: string,
) {
  const { safe, request, target, anchorRevision, match } = requestPacketParts(
    state,
    requestId,
    "audit-confirmed-event",
  );
  if (target.mode !== "audit-confirmed-event") {
    fail("Confirmed-event packet target is invalid.");
  }
  const dossier = safe.dossiers.find(
    (item) => item.dossierSnapshotId === target.dossierSnapshotId,
  )!;
  const confirmation = safe.identityDecisions.find(
    (decision) =>
      decision.confirmationSnapshotId === target.confirmationSnapshotId,
  )!;
  const sourceIds = new Set([...match.sourceIds, ...dossier.sourceIds]);
  return {
    schemaVersion: SCREEN_02_AUDIT_ASSESSMENT_PACKET_SCHEMA_VERSION,
    draftSchemaVersion: SCREEN_02_AUDIT_ASSESSMENT_DRAFT_SCHEMA_VERSION,
    purpose:
      "Prepare a source-grounded early research assessment only after exact identity confirmation.",
    requestId: request.requestId,
    requestProof: screen02AuditRequestProof(request),
    packetFingerprint: target.packetFingerprint,
    attempt: request.attempt,
    requestedPartIds: [...request.requestedPartIds],
    anchor: {
      originalWording: safe.anchor.originalWording,
      activeRevision: clone(anchorRevision),
    },
    match: clone(match),
    dossier: clone(dossier),
    confirmation: {
      confirmationSnapshotId: confirmation.confirmationSnapshotId,
      confirmationFingerprint: confirmation.confirmationFingerprint,
      decisionId: confirmation.decisionId,
      confirmedAt: confirmation.at,
    },
    sources: safe.sources
      .filter((source) => sourceIds.has(source.id))
      .map((source) => clone(source)),
    study: boundedStudyContext(safe),
    allowedValues: {
      studyFit: [...screen02StudyFitCategories],
      outcomePathway: [...screen02OutcomePathwayCategories],
      coverageRelation: [...screen02CoverageRelationCategories],
      measurementPotential: [...screen02MeasurementPotentialCategories],
    },
    exclusions: [
      "Assess only the requested post-confirmation components.",
      "Name the exact confirmed event title or one of its listed aliases at least once; generic prose that could describe a different shock is invalid.",
      "Use the dossier claims and any bounded source evidenceText as claim-level context, and cite only the source IDs supporting the facts relied on.",
      "Use only evidence source IDs in this exact confirmed-event packet.",
      "Do not rewrite identity, dossier, anchor, or confirmation snapshots.",
      "Do not submit an overall judgment; fixed code derives it deterministically.",
      "Do not claim verified timing, exposure, exogeneity, causal validity, realized outcomes, or Screen 3 constructs.",
    ],
    outcomeValuesInspected: false as const,
  };
}
