import {
  fingerprintScreen02Session,
  restoreScreen02Session,
  summarizeScreen02Sources,
} from "./screen02-service";
import {
  fingerprintScreen01StudyContext,
  sameDeterministicJson,
  serializeDeterministicJson,
} from "./screen02-deterministic-json";
import { assertScreen02StateEnvelopeCapacity } from "./screen02-state-capacity";
import type { Mode, Screen01StudyContext } from "./scope-types";
import type {
  DeepReadonly,
  Screen02DeferredQuestion,
  Screen02EvidenceStatus,
  Screen02ExternalShockPlausibilityDetail,
  Screen02PopulationApplicabilityDetail,
  Screen02PreliminaryAssessment,
  Screen02OutcomePathwayDetail,
  Screen02AuditItem,
  Screen02FindItem,
  Screen02HardFilterResult,
  Screen02InteractionRequestEvent,
  Screen02Item,
  Screen02ItemVersion,
  Screen02LikelyServiceLevel,
  Screen02PreferenceCriterion,
  Screen02PreferenceSet,
  Screen02Rejection,
  Screen02Scorecard,
  Screen02SearchRound,
  Screen02SelectionEvent,
  Screen02Session,
  Screen02Source,
  Screen02SourceSummary,
} from "./screen02-types";
import { requireReadyScreen01Context } from "./study-context";

export const SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION =
  "screen-02-to-screen-03-v1" as const;

/**
 * The v1 handoff is frozen v0.2.20 compatibility output. v0.2.21 writes the
 * separate current `screen-02-to-screen-03-event-v4` contract and must never relabel
 * a v1 payload as though the new producer emitted it.
 */
export const SCREEN_02_TO_SCREEN_03_V1_PRODUCER_VERSION = "0.2.20" as const;

/** Explicit producer compatibility for the released v1 handoff contract. */
export const SCREEN_02_TO_SCREEN_03_COMPATIBLE_PRODUCER_VERSIONS = [
  "0.2.17",
  "0.2.18",
  "0.2.19",
  "0.2.20",
] as const;

export const SCREEN_02_TO_SCREEN_03_HISTORY_SCHEMA_VERSION =
  "screen-02-history-v1" as const;

export const SCREEN_03_VERIFICATION_TASK_SCHEMA_VERSION =
  "screen-03-verification-task-v1" as const;

export type Screen02EventMatchMethod =
  | "discovered"
  | "exact-name"
  | "controlled-alias"
  | "researcher-confirmed";

/**
 * Find stores native event items. Audit still stores a source-backed event
 * match in the released whole-package compatibility shape, then normalizes it
 * here to the identical event payload with mode="audit" so Screen 3 never sees
 * a downstream representation union.
 */
export type Screen02HandoffEventRecord = Screen02FindItem["event"] & {
  researcherAnchor: string | null;
  matchMethod: Screen02EventMatchMethod;
  identityEvidenceSourceIds: string[];
};

export type Screen02HandoffPreliminaryAssessment =
  Screen02PreliminaryAssessment;

export type Screen02HandoffEventItem = Omit<
  Screen02FindItem,
  | "mode"
  | "kind"
  | "event"
  | "externalShockPlausibility"
  | "populationApplicability"
  | "outcomePathway"
  | "preliminaryAssessment"
> & {
  mode: Mode;
  kind: "event";
  event: Screen02HandoffEventRecord;
  externalShockPlausibility:
    | Screen02ExternalShockPlausibilityDetail
    | null;
  populationApplicability:
    | Screen02PopulationApplicabilityDetail
    | null;
  outcomePathway: Screen02OutcomePathwayDetail | null;
  preliminaryAssessment?: Screen02HandoffPreliminaryAssessment;
};

export type Screen03VerificationTaskCategory =
  | "event-identity"
  | "source-authority"
  | "timing"
  | "coverage"
  | "assignment"
  | "exposure"
  | "variation"
  | "externality"
  | "outcome-pathway"
  | "search-criterion"
  | "researcher-deferred"
  | "limitation";

export type Screen03VerificationTask = {
  schemaVersion: typeof SCREEN_03_VERIFICATION_TASK_SCHEMA_VERSION;
  id: string;
  category: Screen03VerificationTaskCategory;
  prompt: string;
  reason: string;
  evidenceSourceIds: string[];
  originatingRevision: number;
  status: "open";
};

export type Screen02HandoffSourceRole =
  | "event-record-lead"
  | "event-identity"
  | "assessment-support"
  | "population-coverage";

export type Screen02HandoffSourceProvenance = {
  sourceId: string;
  sourceFingerprint: string;
  introducedAtRevision: number;
  introducedByRoundId: string | null;
  queryIds: string[];
  roles: Screen02HandoffSourceRole[];
};

export type Screen02HandoffMethodRecord = {
  evidenceStatus: Screen02EvidenceStatus;
  sourceSummary: Screen02SourceSummary;
  hardFilters: Screen02HardFilterResult[];
  scorecard: Screen02Scorecard;
  externalShockPlausibility:
    | Screen02ExternalShockPlausibilityDetail
    | null;
  populationApplicability:
    | Screen02PopulationApplicabilityDetail
    | null;
  outcomePathway: Screen02OutcomePathwayDetail | null;
  outcomeLink: Screen02HandoffEventItem["outcomeLink"];
  likelyServiceLevel: Screen02LikelyServiceLevel;
  requiredVariables: string[];
  reasons: string[];
  limitations: string[];
  preliminaryAssessment?: Screen02HandoffPreliminaryAssessment;
};

export type Screen02HandoffHistory = {
  schemaVersion: typeof SCREEN_02_TO_SCREEN_03_HISTORY_SCHEMA_VERSION;
  preferences: Screen02PreferenceSet;
  interactionRequestHistory: Screen02InteractionRequestEvent[];
  itemVersions: Screen02ItemVersion[];
  searchRounds: Screen02SearchRound[];
  rejections: Screen02Rejection[];
  selectionHistory: Screen02SelectionEvent[];
  deferredQuestions: Screen02DeferredQuestion[];
  downstreamInvalidationCount: number;
};

export type Screen02ToScreen03Handoff = {
  schemaVersion: typeof SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION;
  sourceScreen: "screen-02";
  destinationScreen: "screen-03";
  producerAppVersion: string;
  sourceSessionSchemaVersion: Screen02Session["schemaVersion"];
  runId: string;
  revision: number;
  mode: Mode;
  screen01Baseline: DeepReadonly<Screen01StudyContext>;
  screen01Fingerprint: string;
  lock: {
    itemId: string;
    itemVersionId: string;
    selectedRoundId: string;
    itemFingerprint: string;
    lockedAtRevision: number;
  };
  lockedEvent: Screen02HandoffEventItem;
  sourceProvenance: Screen02HandoffSourceProvenance[];
  methodRecord: Screen02HandoffMethodRecord;
  unresolved: {
    verificationTasks: Screen03VerificationTask[];
    unverifiedCriteria: Screen02PreferenceCriterion[];
    deferredQuestions: Screen02DeferredQuestion[];
  };
  history: Screen02HandoffHistory;
  outcomeValuesInspected: false;
  integrity: {
    sessionFingerprint: string;
    baselineFingerprint: string;
    lockedItemFingerprint: string;
    historyFingerprint: string;
    handoffFingerprint: string;
  };
};

const handoffKeys = [
  "schemaVersion",
  "sourceScreen",
  "destinationScreen",
  "producerAppVersion",
  "sourceSessionSchemaVersion",
  "runId",
  "revision",
  "mode",
  "screen01Baseline",
  "screen01Fingerprint",
  "lock",
  "lockedEvent",
  "sourceProvenance",
  "methodRecord",
  "unresolved",
  "history",
  "outcomeValuesInspected",
  "integrity",
] as const;

const lockKeys = [
  "itemId",
  "itemVersionId",
  "selectedRoundId",
  "itemFingerprint",
  "lockedAtRevision",
] as const;

const integrityKeys = [
  "sessionFingerprint",
  "baselineFingerprint",
  "lockedItemFingerprint",
  "historyFingerprint",
  "handoffFingerprint",
] as const;

const preliminaryAssessmentKeys = [
  "schemaVersion",
  "method",
  "judgment",
  "studyFit",
  "affectedPopulation",
  "outcomeMechanism",
  "mainConcern",
  "evidenceSourceIds",
  "nextChecks",
  "rootNativeRoundId",
  "assessedAtRevision",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
  );
}

function cloneExact<T>(value: T): T {
  serializeDeterministicJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function fingerprintValue(value: unknown) {
  const serialized = serializeDeterministicJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isHandoffPreliminaryAssessment(
  value: unknown,
): value is Screen02HandoffPreliminaryAssessment {
  if (!isRecord(value) || !hasExactKeys(value, preliminaryAssessmentKeys)) {
    return false;
  }
  return (
    value.schemaVersion === "screen02-preliminary-assessment-v1" &&
    value.method === "ai-preliminary" &&
    [
      "promising-to-verify",
      "worth-exploring",
      "low-priority",
      "not-enough-evidence",
    ].includes(String(value.judgment)) &&
    typeof value.studyFit === "string" &&
    value.studyFit.trim().length > 0 &&
    ((typeof value.affectedPopulation === "string" &&
      value.affectedPopulation.trim().length > 0) ||
      value.affectedPopulation === null) &&
    ((typeof value.outcomeMechanism === "string" &&
      value.outcomeMechanism.trim().length > 0) ||
      value.outcomeMechanism === null) &&
    typeof value.mainConcern === "string" &&
    value.mainConcern.trim().length > 0 &&
    isStringArray(value.evidenceSourceIds) &&
    new Set(value.evidenceSourceIds).size === value.evidenceSourceIds.length &&
    isStringArray(value.nextChecks) &&
    value.nextChecks.length >= 1 &&
    value.nextChecks.length <= 2 &&
    value.nextChecks.every((entry) => entry.trim().length > 0) &&
    typeof value.rootNativeRoundId === "string" &&
    value.rootNativeRoundId.length > 0 &&
    Number.isSafeInteger(value.assessedAtRevision) &&
    Number(value.assessedAtRevision) >= 0
  );
}

function isHandoffEventItem(value: unknown): value is Screen02HandoffEventItem {
  if (!isRecord(value) || value.kind !== "event") return false;
  if (value.mode !== "find" && value.mode !== "audit") return false;
  if (!isRecord(value.event) || !Array.isArray(value.sources)) return false;
  const sources = value.sources;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.event.displayName === "string" &&
    typeof value.event.eventDate === "string" &&
    typeof value.event.eventFamily === "string" &&
    isStringArray(value.event.geographies) &&
    isStringArray(value.event.populations) &&
    (typeof value.event.researcherAnchor === "string" ||
      value.event.researcherAnchor === null) &&
    [
      "discovered",
      "exact-name",
      "controlled-alias",
      "researcher-confirmed",
    ].includes(String(value.event.matchMethod)) &&
    isStringArray(value.event.identityEvidenceSourceIds) &&
    (value.externalShockPlausibility === null ||
      isRecord(value.externalShockPlausibility)) &&
    (value.populationApplicability === null ||
      isRecord(value.populationApplicability)) &&
    (value.outcomePathway === null || isRecord(value.outcomePathway)) &&
    (value.preliminaryAssessment === undefined ||
      isHandoffPreliminaryAssessment(value.preliminaryAssessment)) &&
    sources.every(
      (source) => isRecord(source) && typeof source.id === "string",
    ) &&
    (value.preliminaryAssessment === undefined ||
      value.preliminaryAssessment.evidenceSourceIds.every((sourceId) =>
        sources.some(
          (source) => isRecord(source) && source.id === sourceId,
        ),
      ))
  );
}

function preliminaryAssessmentFor(
  item: Screen02Item | Screen02HandoffEventItem,
) {
  const value = (
    item as unknown as {
      preliminaryAssessment?: unknown;
    }
  ).preliminaryAssessment;
  if (value === undefined) return undefined;
  if (!isHandoffPreliminaryAssessment(value)) {
    fail(
      "The locked Screen 2 preliminary assessment is malformed.",
    );
  }
  const sourceIds = new Set(item.sources.map((source) => source.id));
  if (!value.evidenceSourceIds.every((sourceId) => sourceIds.has(sourceId))) {
    fail(
      "The locked Screen 2 preliminary assessment cites an unattached source.",
    );
  }
  return cloneExact(value);
}

function rankNeutralItem<T extends { rank: number }>(item: T) {
  return { ...cloneExact(item), rank: 1 };
}

function activeVersionForLockedItem(
  session: Screen02Session,
  item: Screen02Item,
) {
  const round = session.interaction.searchRounds.at(-1);
  if (!round) {
    fail("Screen 2 has no search round to anchor the locked event.");
  }
  const activeVersionIds = new Set(round.activeItemVersionIds);
  const matches = session.interaction.itemVersions.filter(
    (version) =>
      activeVersionIds.has(version.versionId) &&
      version.itemId === item.id &&
      sameDeterministicJson(version.item, rankNeutralItem(item)),
  );
  if (matches.length !== 1) {
    fail(
      "The locked Screen 2 event does not resolve to exactly one active item version.",
    );
  }
  return { round, version: matches[0]! };
}

function normalizedIdentityName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function commonEventItemFields(item: Screen02Item) {
  const preliminaryAssessment = preliminaryAssessmentFor(item);
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    origin: item.origin,
    provisionalDates: cloneExact(item.provisionalDates),
    affectedPopulation: item.affectedPopulation,
    requiredVariables: cloneExact(item.requiredVariables),
    outcomeLink: cloneExact(item.outcomeLink),
    likelyServiceLevel: item.likelyServiceLevel,
    limitations: cloneExact(item.limitations),
    reasons: cloneExact(item.reasons),
    provisional: item.provisional,
    evidenceStatus: item.evidenceStatus,
    sources: cloneExact(item.sources),
    sourceSummary: cloneExact(item.sourceSummary),
    hardFilters: cloneExact(item.hardFilters),
    scorecard: cloneExact(item.scorecard),
    externalShockPlausibility: item.externalShockPlausibility
      ? cloneExact(item.externalShockPlausibility)
      : null,
    populationApplicability: item.populationApplicability
      ? cloneExact(item.populationApplicability)
      : null,
    outcomePathway: item.outcomePathway
      ? cloneExact(item.outcomePathway)
      : null,
    ...(preliminaryAssessment ? { preliminaryAssessment } : {}),
    rank: item.rank,
  };
}

function exactOverlappingIdentitySources(
  item: Screen02AuditItem,
  evidenceSources: readonly Screen02Source[],
) {
  const evidenceById = new Map(
    evidenceSources.map((source) => [source.id, source]),
  );
  return item.sources.filter((source) => {
    const evidence = evidenceById.get(source.id);
    // Assessment may add authority metadata to the item-level copy after the
    // round evidence is recorded. Stable id + locator prove that both records
    // refer to the same retrieved source without requiring those derived
    // annotations to be byte-identical.
    return evidence !== undefined && source.locator === evidence.locator;
  });
}

/**
 * Audit still stores its source-backed event match in the released
 * `representation` compatibility shape. Only a whole-package item explicitly
 * tied to round-level identity evidence may cross this adapter. No Screen 1
 * geography is copied into the event's issuing jurisdictions: the legacy card
 * does not retain that source fact, so the canonical event leaves it unknown.
 */
function normalizeLockedEvent(
  mode: Mode,
  baseline: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
  item: Screen02Item,
  rounds: readonly Screen02SearchRound[],
): Screen02HandoffEventItem {
  if (mode === "find") {
    if (item.mode !== "find" || item.kind !== "event") {
      fail("The locked Find item is not an event record.");
    }
    return {
      ...commonEventItemFields(item),
      mode: "find",
      kind: "event",
      event: {
        ...cloneExact(item.event),
        researcherAnchor: null,
        matchMethod: "discovered",
        identityEvidenceSourceIds: item.sources.map((source) => source.id),
      },
    };
  }

  if (
    item.mode !== "audit" ||
    item.kind !== "representation" ||
    item.representationType !== "whole-package"
  ) {
    fail(
      "Screen 3 requires one locked event record. Legacy Audit representation items must be resolved to a source-backed event first.",
    );
  }
  const anchor = baseline.knownShock;
  let identitySources: Screen02Source[] = [];
  const evidenceRound = [...rounds].reverse().find((candidateRound) => {
    const evidence = candidateRound.shockEvidence;
    if (
      !evidence ||
      evidence.anchorShock !== anchor ||
      !evidence.proposalIds.includes(item.id)
    ) {
      return false;
    }
    identitySources = exactOverlappingIdentitySources(
      item,
      evidence.sources,
    );
    return identitySources.length > 0;
  });
  if (
    !anchor ||
    item.anchorShock !== anchor ||
    !evidenceRound ||
    identitySources.length === 0
  ) {
    fail(
      "The locked Audit compatibility item is not tied to exact round-level identity evidence for the Screen 1 shock.",
    );
  }
  const matchMethod: Screen02EventMatchMethod =
    normalizedIdentityName(item.title) === normalizedIdentityName(anchor)
      ? "exact-name"
      : "controlled-alias";
  return {
    ...commonEventItemFields(item),
    mode: "audit",
    kind: "event",
    event: {
      displayName: item.title,
      eventDate: item.provisionalDates[0] ?? "",
      eventFamily: baseline.scopeContract.eventFamily,
      // Deliberately empty. Study geography is a search boundary, not proof
      // of the event's issuing jurisdiction.
      geographies: [],
      populations: item.affectedPopulation
        ? [item.affectedPopulation]
        : [],
      researcherAnchor: anchor,
      matchMethod,
      identityEvidenceSourceIds: identitySources.map((source) => source.id),
    },
  };
}

function currentCriteria(session: Screen02Session) {
  const round = session.interaction.searchRounds.at(-1);
  if (!round) return [];
  const ids = new Set(round.preferenceCriteriaIds);
  return session.interaction.preferences.criteria.filter((criterion) =>
    ids.has(criterion.id),
  );
}

function unverifiedCriteria(session: Screen02Session) {
  const round = session.interaction.searchRounds.at(-1);
  if (round?.stage !== "native-retrieval") return [];
  return currentCriteria(session).filter(
    (criterion) => criterion.kind === "require" || criterion.kind === "avoid",
  );
}

function validEvidenceIds(item: Screen02HandoffEventItem, ids: readonly string[]) {
  const available = new Set(item.sources.map((source) => source.id));
  return [...new Set(ids.filter((id) => available.has(id)))];
}

function sourceEstablishedPopulationFor(
  item: Screen02HandoffEventItem,
) {
  const value = item.populationApplicability?.sourceEstablishedPopulation;
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    !isStringArray(value.evidenceSourceIds)
  ) {
    return null;
  }
  return {
    text: value.text,
    evidenceSourceIds: validEvidenceIds(item, value.evidenceSourceIds),
  };
}

export function deriveScreen03VerificationTasks(
  session: Screen02Session,
  item: Screen02HandoffEventItem,
): Screen03VerificationTask[] {
  const drafts: Array<
    Omit<Screen03VerificationTask, "schemaVersion" | "id" | "status">
  > = [];
  const add = (
    category: Screen03VerificationTaskCategory,
    prompt: string,
    reason: string,
    evidenceSourceIds: readonly string[] = [],
  ) => {
    const normalized = prompt.trim().toLocaleLowerCase("en-US");
    if (!normalized || drafts.some((draft) => draft.prompt.trim().toLocaleLowerCase("en-US") === normalized)) {
      return;
    }
    drafts.push({
      category,
      prompt: prompt.trim(),
      reason: reason.trim(),
      evidenceSourceIds: validEvidenceIds(item, evidenceSourceIds),
      originatingRevision: session.revision,
    });
  };

  const documentedAuthority = item.sources.some((source) =>
    ["connector-native", "system-domain-rule", "researcher-confirmed"].includes(
      source.authorityAssessment?.method ?? "",
    ),
  );
  if (!documentedAuthority) {
    add(
      "source-authority",
      "Confirm the issuing authority and the controlling role of the attached source.",
      "Screen 2 located a source, but its authority has not been independently established.",
      item.sources.map((source) => source.id),
    );
  }

  for (const filter of item.hardFilters.filter((entry) => entry.status === "review")) {
    add(
      filter.key === "studyPeriod" ? "timing" : "coverage",
      `Resolve the provisional ${filter.key} match before defining treatment.`,
      filter.reason,
    );
  }

  const preliminaryAssessment = preliminaryAssessmentFor(item);
  if (preliminaryAssessment) {
    for (const nextCheck of preliminaryAssessment.nextChecks) {
      add(
        "assignment",
        nextCheck,
        `The preliminary assessment identified this main concern: ${preliminaryAssessment.mainConcern}`,
        preliminaryAssessment.evidenceSourceIds,
      );
    }
  }

  const populationApplicability = item.populationApplicability;
  if (!populationApplicability) {
    add(
      "coverage",
      "Establish how the event's documented coverage relates to the locked study population and the candidate's native affected population.",
      "Screen 2 has not completed a population-applicability assessment.",
    );
  } else {
    const sourcePopulation = sourceEstablishedPopulationFor(item);
    const coverageEvidenceSourceIds = validEvidenceIds(item, [
      ...populationApplicability.evidenceSourceIds,
      ...(sourcePopulation?.evidenceSourceIds ?? []),
    ]);
    const coveragePrompt = sourcePopulation
      ? {
          "documented-direct":
            `Verify that the cited coverage rule directly reaches the source-described population (${sourcePopulation.text}) and map it to each focal organization in the locked study population.`,
          "documented-conditional":
            `Verify the cited eligibility or implementation conditions defining the source-described population (${sourcePopulation.text}) and identify which focal organizations satisfy them.`,
          "plausible-indirect":
            `Verify how the source-described population (${sourcePopulation.text}) creates indirect exposure for focal organizations and construct an organization-level exposure mapping.`,
          unlikely:
            `Test whether any defensible relation exists between the source-described population (${sourcePopulation.text}) and the focal organizations before retaining this event as a treatment candidate.`,
          unknown:
            `Resolve how the source-described population (${sourcePopulation.text}) relates to the locked study population before defining treatment.`,
        }[populationApplicability.category]
      : "Locate a controlling source passage that identifies or delimits the candidate-specific affected population, then relate it to the locked study population before defining treatment.";
    const populationEvidenceReason = sourcePopulation
      ? `The cited sources describe the candidate population as: ${sourcePopulation.text}.`
      : "The current cited sources do not establish a candidate-specific affected population.";
    add(
      "coverage",
      coveragePrompt,
      `Screen 2 classified population applicability as ${populationApplicability.category}: ${populationApplicability.reason} ${populationEvidenceReason}`,
      coverageEvidenceSourceIds,
    );
    for (const unresolved of populationApplicability.unresolved) {
      add(
        "coverage",
        unresolved,
        `${populationApplicability.reason} ${populationEvidenceReason}`,
        coverageEvidenceSourceIds,
      );
    }
  }

  const timing = item.scorecard.componentDetails.timeSupport;
  if (timing.category === "unknown" || item.scorecard.components.timeSupport === null) {
    add(
      "timing",
      "Verify announcement, adoption, operative, implementation, and enforcement dates before choosing the treatment clock.",
      timing.reason,
      timing.evidenceSourceIds,
    );
  }
  for (const unresolved of timing.unresolved) {
    add("timing", unresolved, timing.reason, timing.evidenceSourceIds);
  }

  const exposure = item.scorecard.componentDetails.exposureObservability;
  if (
    exposure.category === "unknown" ||
    item.scorecard.components.exposureObservability === null
  ) {
    add(
      "exposure",
      "Determine whether the event's formal and realized exposure can be linked to each focal organization.",
      exposure.reason,
      exposure.evidenceSourceIds,
    );
  }
  for (const unresolved of exposure.unresolved) {
    add("exposure", unresolved, exposure.reason, exposure.evidenceSourceIds);
  }

  const outcomePathway = item.outcomePathway;
  if (!outcomePathway || outcomePathway.category === "unclear") {
    add(
      "outcome-pathway",
      "Verify the event feature, organizational channel, and outcome-family connection without using realized outcome values.",
      outcomePathway?.reason ??
        "Screen 2 has not completed a source-grounded outcome-pathway assessment.",
      outcomePathway?.evidenceSourceIds ?? [],
    );
  }
  for (const unresolved of outcomePathway?.unresolved ?? []) {
    add(
      "outcome-pathway",
      unresolved,
      outcomePathway?.reason ?? "The preliminary outcome pathway remains unresolved.",
      outcomePathway?.evidenceSourceIds ?? [],
    );
  }

  const variation = item.scorecard.componentDetails.variation;
  if (variation.category === "unknown" || item.scorecard.components.variation === null) {
    add(
      "variation",
      "Verify that exposure varies across organizations, jurisdictions, thresholds, phases, or timing.",
      variation.reason,
      variation.evidenceSourceIds,
    );
  }
  for (const unresolved of variation.unresolved) {
    add("variation", unresolved, variation.reason, variation.evidenceSourceIds);
  }

  const externality = item.externalShockPlausibility;
  if (!externality || externality.category === "unknown") {
    add(
      "externality",
      "Use pre-outcome evidence to assess anticipation, selection, reverse causation, and confounding concerns.",
      externality?.reason ??
        "Screen 2 has not completed an external-shock plausibility assessment.",
      externality?.evidenceSourceIds ?? [],
    );
  }
  for (const unresolved of externality?.unresolved ?? []) {
    add(
      "externality",
      unresolved,
      externality?.reason ?? "External-shock plausibility remains unresolved.",
      externality?.evidenceSourceIds ?? [],
    );
  }

  for (const criterion of unverifiedCriteria(session)) {
    add(
      "search-criterion",
      `Verify the unresolved ${criterion.kind === "require" ? "Only include" : "Do not show"} criterion: ${criterion.text}`,
      `Screen 2 retained this researcher criterion without a completed semantic review (${criterion.id}).`,
    );
  }
  for (const question of session.interaction.deferredQuestions) {
    add("researcher-deferred", question.exactRequest, question.reason);
  }
  for (const limitation of item.limitations) {
    add("limitation", limitation, "This limitation was retained on the locked Screen 2 event.");
  }

  if (drafts.length === 0) {
    add(
      "assignment",
      "Verify the event identity, controlling source, operative date, coverage rule, and exposure mapping.",
      "Screen 2 selection is a lead for verification, not a confirmed natural-experiment design.",
      item.sources.map((source) => source.id),
    );
  }

  return drafts.slice(0, 100).map((draft, index) => ({
    schemaVersion: SCREEN_03_VERIFICATION_TASK_SCHEMA_VERSION,
    id: `screen03-task-${String(index + 1).padStart(3, "0")}`,
    ...draft,
    status: "open",
  }));
}

function assessmentEvidenceIds(item: Screen02HandoffEventItem) {
  const preliminaryAssessment = preliminaryAssessmentFor(item);
  return new Set([
    ...(item.externalShockPlausibility?.evidenceSourceIds ?? []),
    ...(item.populationApplicability?.evidenceSourceIds ?? []),
    ...(sourceEstablishedPopulationFor(item)?.evidenceSourceIds ?? []),
    ...(item.outcomePathway?.evidenceSourceIds ?? []),
    ...Object.values(item.scorecard.componentDetails).flatMap(
      (detail) => detail.evidenceSourceIds,
    ),
    ...(preliminaryAssessment?.evidenceSourceIds ?? []),
  ]);
}

function deriveSourceProvenance(
  session: Screen02Session,
  item: Screen02HandoffEventItem,
) {
  const assessmentIds = assessmentEvidenceIds(item);
  const populationCoverageIds = new Set(
    sourceEstablishedPopulationFor(item)?.evidenceSourceIds ?? [],
  );
  const identityIds = new Set(item.event.identityEvidenceSourceIds ?? []);
  return item.sources.map((source) => {
    const containingVersions = session.interaction.itemVersions.filter(
      (version) =>
        version.itemId === item.id &&
        version.item.sources.some((candidate) => candidate.id === source.id),
    );
    const firstVersion = containingVersions.sort(
      (left, right) => left.recordedAtRevision - right.recordedAtRevision,
    )[0];
    const firstRound = firstVersion
      ? session.interaction.searchRounds.find((round) =>
          round.assessedItemVersionIds.includes(firstVersion.versionId),
        )
      : undefined;
    const roles: Screen02HandoffSourceRole[] = ["event-record-lead"];
    if (identityIds.has(source.id)) roles.push("event-identity");
    if (assessmentIds.has(source.id)) roles.push("assessment-support");
    if (populationCoverageIds.has(source.id)) {
      roles.push("population-coverage");
    }
    return {
      sourceId: source.id,
      sourceFingerprint: fingerprintValue(source),
      introducedAtRevision: firstVersion?.recordedAtRevision ?? 0,
      introducedByRoundId: firstRound?.id ?? null,
      queryIds:
        firstRound?.manifest.queryMatrix
          .filter((query) => query.returnedRecordIds?.includes(item.id))
          .map((query) => query.id) ?? [],
      roles,
    } satisfies Screen02HandoffSourceProvenance;
  });
}

function methodRecordFor(item: Screen02HandoffEventItem): Screen02HandoffMethodRecord {
  const preliminaryAssessment = preliminaryAssessmentFor(item);
  return cloneExact({
    evidenceStatus: item.evidenceStatus,
    sourceSummary: item.sourceSummary,
    hardFilters: item.hardFilters,
    scorecard: item.scorecard,
    externalShockPlausibility: item.externalShockPlausibility ?? null,
    populationApplicability: item.populationApplicability ?? null,
    outcomePathway: item.outcomePathway ?? null,
    outcomeLink: item.outcomeLink,
    likelyServiceLevel: item.likelyServiceLevel,
    requiredVariables: item.requiredVariables,
    reasons: item.reasons,
    limitations: item.limitations,
    ...(preliminaryAssessment ? { preliminaryAssessment } : {}),
  });
}

function historyFor(session: Screen02Session): Screen02HandoffHistory {
  return cloneExact({
    schemaVersion: SCREEN_02_TO_SCREEN_03_HISTORY_SCHEMA_VERSION,
    preferences: session.interaction.preferences,
    interactionRequestHistory: session.interaction.interactionRequestHistory,
    itemVersions: session.interaction.itemVersions,
    searchRounds: session.interaction.searchRounds,
    rejections: session.interaction.rejections,
    selectionHistory: session.interaction.selectionHistory,
    deferredQuestions: session.interaction.deferredQuestions,
    downstreamInvalidationCount: session.interaction.downstreamInvalidationCount,
  });
}

function handoffFingerprintInput(handoff: Screen02ToScreen03Handoff) {
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    handoff.integrity;
  return { ...handoff, integrity };
}

export function buildScreen02ToScreen03Handoff(
  session: Screen02Session,
): Screen02ToScreen03Handoff {
  const safe = restoreScreen02Session(session);
  if (!safe) fail("Screen 2 session failed integrity validation.");
  if (!safe.lockedChoice) {
    fail("Screen 2 must contain an explicit locked choice before Screen 3.");
  }
  if (safe.interaction.pendingRequest || safe.interaction.pendingScopeRevision) {
    fail("Screen 2 still has unresolved pending work and cannot enter Screen 3.");
  }

  const candidate = safe.items.find((item) => item.id === safe.lockedChoice?.itemId);
  if (!candidate) {
    fail("The locked Screen 2 item is missing from the active result set.");
  }
  if (candidate.sources.length === 0 || candidate.sourceSummary.uniqueSourceCount === 0) {
    fail("The locked Screen 2 event must contain at least one factual source.");
  }
  if (
    candidate.evidenceStatus === "fictional-demonstration" ||
    candidate.likelyServiceLevel === "stop" ||
    candidate.hardFilters.some((filter) => filter.status === "fail")
  ) {
    fail("The locked Screen 2 event does not pass the Screen 3 handoff gate.");
  }
  const { round, version } = activeVersionForLockedItem(safe, candidate);
  const lockedEvent = normalizeLockedEvent(
    safe.mode,
    safe.screen01Baseline,
    candidate,
    safe.interaction.searchRounds,
  );
  const history = historyFor(safe);
  const integrityWithoutHandoff = {
    sessionFingerprint: fingerprintScreen02Session(safe),
    baselineFingerprint: safe.screen01Fingerprint,
    lockedItemFingerprint: safe.lockedChoice.itemFingerprint,
    historyFingerprint: fingerprintValue(history),
  };
  const provisional = {
    schemaVersion: SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION,
    sourceScreen: "screen-02" as const,
    destinationScreen: "screen-03" as const,
    producerAppVersion: SCREEN_02_TO_SCREEN_03_V1_PRODUCER_VERSION,
    sourceSessionSchemaVersion: safe.schemaVersion,
    runId: safe.runId,
    revision: safe.revision,
    mode: safe.mode,
    screen01Baseline: cloneExact(safe.screen01Baseline),
    screen01Fingerprint: safe.screen01Fingerprint,
    lock: {
      itemId: candidate.id,
      itemVersionId: version.versionId,
      selectedRoundId: round.id,
      itemFingerprint: safe.lockedChoice.itemFingerprint,
      lockedAtRevision: safe.lockedChoice.lockedAtRevision,
    },
    lockedEvent,
    sourceProvenance: deriveSourceProvenance(safe, lockedEvent),
    methodRecord: methodRecordFor(lockedEvent),
    unresolved: {
      verificationTasks: deriveScreen03VerificationTasks(safe, lockedEvent),
      unverifiedCriteria: cloneExact(unverifiedCriteria(safe)),
      deferredQuestions: cloneExact(safe.interaction.deferredQuestions),
    },
    history,
    outcomeValuesInspected: false as const,
    integrity: {
      ...integrityWithoutHandoff,
      handoffFingerprint: "pending",
    },
  } satisfies Screen02ToScreen03Handoff;
  provisional.integrity.handoffFingerprint = fingerprintValue(
    handoffFingerprintInput(provisional),
  );
  assertScreen02StateEnvelopeCapacity(serializeDeterministicJson(provisional));
  return deepFreeze(cloneExact(provisional));
}

function restoredBaseline(value: unknown) {
  if (!isRecord(value)) return null;
  try {
    const baseline = requireReadyScreen01Context(
      value as unknown as Screen01StudyContext,
    );
    return sameDeterministicJson(baseline, value) ? baseline : null;
  } catch {
    return null;
  }
}

function sourceById(item: Screen02HandoffEventItem, sourceId: string) {
  return item.sources.find((source) => source.id === sourceId) ?? null;
}

export function restoreScreen02ToScreen03Handoff(
  value: unknown,
): Screen02ToScreen03Handoff | null {
  try {
    const clone = cloneExact(value) as unknown;
    if (!isRecord(clone) || !hasExactKeys(clone, handoffKeys)) return null;
    if (
      clone.schemaVersion !== SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION ||
      clone.sourceScreen !== "screen-02" ||
      clone.destinationScreen !== "screen-03" ||
      typeof clone.producerAppVersion !== "string" ||
      !(
        SCREEN_02_TO_SCREEN_03_COMPATIBLE_PRODUCER_VERSIONS as readonly string[]
      ).includes(clone.producerAppVersion) ||
      (clone.mode !== "find" && clone.mode !== "audit") ||
      !Number.isSafeInteger(clone.revision) ||
      clone.outcomeValuesInspected !== false
    ) {
      return null;
    }
    const baseline = restoredBaseline(clone.screen01Baseline);
    if (
      !baseline ||
      baseline.startingPoint !== clone.mode ||
      clone.screen01Fingerprint !== fingerprintScreen01StudyContext(baseline)
    ) {
      return null;
    }
    if (!isRecord(clone.lock) || !hasExactKeys(clone.lock, lockKeys)) return null;
    const lock = clone.lock;
    if (!isHandoffEventItem(clone.lockedEvent)) return null;
    const item = clone.lockedEvent;
    if (
      item.mode !== clone.mode ||
      item.id !== lock.itemId ||
      item.sources.length === 0 ||
      item.sourceSummary.uniqueSourceCount === 0 ||
      item.hardFilters.some((filter) => filter.status === "fail") ||
      item.evidenceStatus === "fictional-demonstration" ||
      item.likelyServiceLevel === "stop"
    ) {
      return null;
    }
    if (
      clone.mode === "audit" &&
      (item.event.researcherAnchor !== baseline.knownShock ||
        !item.event.matchMethod ||
        item.event.matchMethod === "discovered")
    ) {
      return null;
    }
    if (
      !sameDeterministicJson(
        item.sourceSummary,
        summarizeScreen02Sources(item.sources),
      ) ||
      !sameDeterministicJson(clone.methodRecord, methodRecordFor(item))
    ) {
      return null;
    }
    if (!Array.isArray(clone.sourceProvenance)) return null;
    const provenance = clone.sourceProvenance as unknown[];
    if (provenance.length !== item.sources.length) return null;
    for (const record of provenance) {
      if (!isRecord(record) || typeof record.sourceId !== "string") return null;
      const source = sourceById(item, record.sourceId);
      if (!source || record.sourceFingerprint !== fingerprintValue(source)) return null;
    }
    if (!isRecord(clone.history) || !isRecord(clone.unresolved)) return null;
    const history = clone.history as unknown as Screen02HandoffHistory;
    if (
      history.schemaVersion !== SCREEN_02_TO_SCREEN_03_HISTORY_SCHEMA_VERSION ||
      !Array.isArray(history.itemVersions) ||
      !Array.isArray(history.searchRounds) ||
      !Array.isArray(history.selectionHistory) ||
      !Array.isArray(history.deferredQuestions)
    ) {
      return null;
    }
    const preliminaryAssessment = preliminaryAssessmentFor(item);
    if (preliminaryAssessment) {
      const rootNativeRound = history.searchRounds.find(
        (round) =>
          round.id === preliminaryAssessment.rootNativeRoundId &&
          round.stage === "native-retrieval",
      );
      const assessmentRound = history.searchRounds.find(
        (round) =>
          round.stage === "preliminary-assessment" &&
          round.rootNativeRoundId === preliminaryAssessment.rootNativeRoundId &&
          round.revision === preliminaryAssessment.assessedAtRevision &&
          round.assessmentResults?.some(
            (result) =>
              result.itemId === item.id && result.status === "assessed",
          ),
      );
      if (
        !rootNativeRound ||
        !assessmentRound ||
        preliminaryAssessment.assessedAtRevision <= rootNativeRound.revision ||
        preliminaryAssessment.assessedAtRevision > Number(clone.revision)
      ) {
        return null;
      }
    }
    const selectedVersion = history.itemVersions.find(
      (version) => version.versionId === lock.itemVersionId,
    );
    const selectedRound = history.searchRounds.find(
      (round) => round.id === lock.selectedRoundId,
    );
    const latestRound = history.searchRounds.at(-1);
    const lastSelection = history.selectionHistory.at(-1);
    const selectedVersionIndex = selectedRound?.activeItemVersionIds.indexOf(
      String(lock.itemVersionId),
    ) ?? -1;
    const originalSelectedItem = selectedVersion
      ? {
          ...cloneExact(selectedVersion.item),
          rank: selectedVersionIndex + 1,
        }
      : null;
    let expectedLockedEvent: Screen02HandoffEventItem | null = null;
    if (selectedRound && originalSelectedItem && selectedVersionIndex >= 0) {
      try {
        expectedLockedEvent = normalizeLockedEvent(
          clone.mode as Mode,
          baseline,
          originalSelectedItem,
          history.searchRounds,
        );
      } catch {
        return null;
      }
    }
    if (
      !selectedVersion ||
      selectedVersion.itemId !== item.id ||
      !selectedRound ||
      selectedRound !== latestRound ||
      !selectedRound.activeItemVersionIds.includes(selectedVersion.versionId) ||
      selectedVersion.itemFingerprint !==
        fingerprintValue(rankNeutralItem(originalSelectedItem!)) ||
      lock.itemFingerprint !== fingerprintValue(originalSelectedItem) ||
      !expectedLockedEvent ||
      !sameDeterministicJson(expectedLockedEvent, item) ||
      lastSelection?.action !== "locked" ||
      lastSelection.itemId !== item.id ||
      lastSelection.revision !== lock.lockedAtRevision ||
      history.searchRounds.some((round) => round.manifest.outcomeValuesInspected !== false)
    ) {
      return null;
    }
    if (!isRecord(clone.integrity) || !hasExactKeys(clone.integrity, integrityKeys)) {
      return null;
    }
    const candidate = clone as unknown as Screen02ToScreen03Handoff;
    if (
      candidate.integrity.baselineFingerprint !== candidate.screen01Fingerprint ||
      candidate.integrity.lockedItemFingerprint !== candidate.lock.itemFingerprint ||
      candidate.integrity.historyFingerprint !== fingerprintValue(candidate.history) ||
      candidate.integrity.handoffFingerprint !==
        fingerprintValue(handoffFingerprintInput(candidate))
    ) {
      return null;
    }
    assertScreen02StateEnvelopeCapacity(serializeDeterministicJson(candidate));
    return deepFreeze(candidate);
  } catch {
    return null;
  }
}

export function requireReadyScreen02ToScreen03Handoff(value: unknown) {
  const restored = restoreScreen02ToScreen03Handoff(value);
  if (!restored) {
    fail("Screen 2 handoff failed Screen 3 integrity validation.");
  }
  return restored;
}

export function serializeScreen02ToScreen03Handoff(value: unknown) {
  const restored = requireReadyScreen02ToScreen03Handoff(value);
  return serializeDeterministicJson(restored);
}

export function fingerprintScreen02ToScreen03Handoff(value: unknown) {
  return fingerprintValue(requireReadyScreen02ToScreen03Handoff(value));
}

export function sourceRecordsForScreen03(
  handoff: Screen02ToScreen03Handoff,
): readonly Screen02Source[] {
  return handoff.lockedEvent.sources;
}
