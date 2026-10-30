import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireFingerprint,
  type Claim,
  type ConflictRecord,
  type EvidenceRequirement,
  type EvidenceSnapshot,
  type InspectedText,
  type PolicyReview,
  type ReviewStatus,
  type SourceAccessStatus,
  type SupportStatus,
  type TypedDate,
} from "./contracts";
import {
  validateEvidenceCollection,
  validateEvidenceSnapshot,
  type EvidenceCollection,
} from "./evidence";

export const SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION =
  "screen-02-policy-chronology-source-panel-v1" as const;

export type PolicyChronologyStage =
  | "legislative_initiation"
  | "announcement"
  | "adoption"
  | "publication"
  | "scheduled_effect"
  | "legal_effect"
  | "compliance"
  | "compliance_filing"
  | "implementation"
  | "enforcement"
  | "amendment"
  | "injunction"
  | "invalidation"
  | "withdrawal"
  | "suspension"
  | "repeal"
  | "supersession";

export type PolicyChronologyTiming =
  | {
      mode: "absolute";
      start: string;
      end: string | null;
      precision: TypedDate["precision"];
    }
  | {
      mode: "relative";
      anchorStage: PolicyChronologyStage | null;
      anchorClockId: string | null;
      offsetDays: number;
      relation: "no_later_than_days_after";
      calendarDate: null;
    }
  | {
      mode: "undated";
      reason: "source_did_not_establish_a_normalized_date";
    };

export type PolicyChronologyLineage = {
  evidenceKind: "claim_passage" | "source_metadata";
  direction: "supporting" | "opposing" | "metadata";
  claimId: string | null;
  passageId: string | null;
  documentVersionId: string;
  sourceId: string;
};

export type PolicyChronologyStatement = {
  claimId: string;
  predicate: string;
  statement: string;
  scope: string;
  supportStatus: SupportStatus;
  reviewStatus: ReviewStatus;
};

export type PolicyChronologyClock = {
  id: string;
  stage: PolicyChronologyStage;
  label: string;
  timing: PolicyChronologyTiming;
  statements: PolicyChronologyStatement[];
  lineages: PolicyChronologyLineage[];
  qualifications: string[];
  conflictIds: string[];
  hasUnresolvedConflict: boolean;
};

export type PolicyTreatmentClockCandidate = {
  id: string;
  clockId: string;
  stage: PolicyChronologyStage;
  label: string;
  timing: PolicyChronologyTiming;
  evidenceBasis: "claim_linked" | "source_metadata";
  status: "unreviewed";
  selected: false;
  selectionOwner: "researcher";
  qualification: string;
};

export type PolicySourcePanelPassage = {
  passageId: string;
  documentVersionId: string;
  locator: string;
  exactText: string;
  startOffset: number | null;
  endOffset: number | null;
  qualification: string | null;
  unresolvedCrossReferences: string[];
  supportingClaimIds: string[];
  opposingClaimIds: string[];
};

export type PolicySourcePanelClaim = {
  claimId: string;
  predicate: string;
  statement: string;
  typedValue: unknown;
  scope: string;
  supportingPassageIds: string[];
  opposingPassageIds: string[];
  supportStatus: SupportStatus;
  reviewStatus: ReviewStatus;
  criticalFor: string[];
  conflictIds: string[];
};

export type PolicySourcePanelDocumentVersion = {
  documentVersionId: string;
  representation: string;
  language: string;
  versionLabel: string | null;
  retrievedAt: string;
  contentHash: string | null;
  parserVersion: string | null;
  parsedTextLength: number | null;
};

export type PolicySourcePanelSource = {
  sourceId: string;
  provider: string;
  nativeId: string;
  canonicalUrl: string;
  publisher: string;
  issuer: string | null;
  author: string | null;
  jurisdiction: string | null;
  role: string;
  documentType: string;
  language: string;
  publicationDate: string | null;
  legalVersionDates: TypedDate[];
  retrievedAt: string;
  contentHash: string | null;
  acquisitionProvenance: "direct" | "third_party" | "upload";
  accessStatus: SourceAccessStatus;
  rightsStatus: string;
  parserVersion: string | null;
  textQualityStatus: string;
  inspectedText: InspectedText;
  documentVersions: PolicySourcePanelDocumentVersion[];
  passages: PolicySourcePanelPassage[];
  claims: PolicySourcePanelClaim[];
  qualificationCount: number;
  unresolvedCrossReferenceCount: number;
  conflictIds: string[];
};

export type PolicyUnresolvedRequirement = {
  requirementId: string;
  kind: EvidenceRequirement["kind"];
  description: string;
  status: Exclude<
    EvidenceRequirement["status"],
    "supported" | "not_applicable"
  >;
  criticality: EvidenceRequirement["criticality"];
  supportingClaimIds: string[];
};

export type PolicyChronologySourcePanelProjection = {
  schemaVersion: typeof SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION;
  binding: {
    eventId: string;
    identityFingerprint: string;
    evidenceSnapshotId: string;
    evidenceSnapshotRevision: number;
    evidenceSnapshotFingerprint: string;
    evidenceCollectionFingerprint: string;
  };
  chronology: {
    absoluteClocks: PolicyChronologyClock[];
    relativeClocks: PolicyChronologyClock[];
    undatedClocks: PolicyChronologyClock[];
  };
  treatmentClockReview: {
    status: "researcher_review_required" | "no_candidate_available";
    selectedCandidateId: null;
    selectionOwner: "researcher";
    candidates: PolicyTreatmentClockCandidate[];
  };
  sourcePanel: {
    sourceCount: number;
    documentVersionCount: number;
    retainedPassageCount: number;
    claimCount: number;
    sources: PolicySourcePanelSource[];
  };
  unresolvedRequirements: PolicyUnresolvedRequirement[];
  conflicts: ConflictRecord[];
  interpretationGate: {
    coherentOverview: null;
    consequentialSemanticReview: null;
    reviewedEventCard: null;
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  projectionFingerprint: string;
};

export type PolicyChronologySavedReviewBinding = Pick<
  PolicyReview,
  | "identityFingerprint"
  | "evidenceSnapshotId"
  | "evidenceSnapshotFingerprint"
>;

type ClockDraft = PolicyChronologyClock;

const STAGE_ORDER: Record<PolicyChronologyStage, number> = {
  legislative_initiation: 0,
  announcement: 1,
  adoption: 2,
  publication: 3,
  scheduled_effect: 4,
  legal_effect: 5,
  compliance: 6,
  compliance_filing: 7,
  implementation: 8,
  enforcement: 9,
  amendment: 10,
  injunction: 11,
  invalidation: 12,
  withdrawal: 13,
  suspension: 14,
  repeal: 15,
  supersession: 16,
};

const STAGE_LABELS: Record<PolicyChronologyStage, string> = {
  legislative_initiation: "Legislative initiation",
  announcement: "Announcement",
  adoption: "Adoption",
  publication: "Publication",
  scheduled_effect: "Scheduled effective date",
  legal_effect: "Legal effect",
  compliance: "Compliance",
  compliance_filing: "Compliance filing deadline",
  implementation: "Implementation deadline",
  enforcement: "Enforcement",
  amendment: "Amendment",
  injunction: "Stay or injunction",
  invalidation: "Judicial invalidation or vacatur",
  withdrawal: "Withdrawal",
  suspension: "Suspension",
  repeal: "Repeal",
  supersession: "Supersession",
};

const TREATMENT_QUALIFICATIONS: Record<PolicyChronologyStage, string> = {
  legislative_initiation:
    "A legislative initiation can be used only for a researcher-defined information-event design; it is not legal effect or implementation.",
  announcement:
    "An announcement can be used only for a researcher-defined information-event design; it is not legal effect or implementation.",
  adoption:
    "Adoption is a candidate policy-stage clock, not proof that covered units were treated on that date.",
  publication:
    "Publication is a candidate information clock, not legal effect, compliance, implementation, or proof of unit-level treatment.",
  scheduled_effect:
    "A scheduled effective date is not proof that the policy actually took effect; later stays, injunctions, or invalidation must be reviewed first.",
  legal_effect:
    "Legal effect is a candidate legal clock, not proof that every covered unit implemented the change on that date.",
  compliance:
    "A compliance date is a candidate legal or administrative clock; sample-level treatment still requires researcher review.",
  compliance_filing:
    "A filing deadline is a candidate administrative clock, not proof that implementation or unit-level exposure occurred then.",
  implementation:
    "An implementation deadline is a candidate clock, not proof of one uniform actual implementation date across units.",
  enforcement:
    "An enforcement stage is a candidate clock only when it matches the intended episode and reviewed research construct.",
  amendment:
    "An amendment date is a candidate clock only for the reviewed amendment episode; it cannot silently replace the confirmed episode.",
  injunction:
    "A stay or injunction changes the legal timeline and cannot be treated as implementation of the challenged policy.",
  invalidation:
    "Judicial invalidation or vacatur is a later legal-status event, not implementation of the invalidated policy.",
  withdrawal:
    "Withdrawal ends or abandons a policy episode; it does not establish prior implementation.",
  suspension:
    "A suspension date is a candidate clock whose design meaning requires explicit researcher review.",
  repeal:
    "A repeal date is a candidate clock whose design meaning requires explicit researcher review.",
  supersession:
    "Supersession identifies a replacement legal episode and cannot silently reuse the prior policy's treatment clock.",
};

const CLAIM_STAGE_BY_PREDICATE = new Map<string, PolicyChronologyStage>([
  ["legislative_initiation_date", "legislative_initiation"],
  ["announcement_date", "announcement"],
  ["adoption_date", "adoption"],
  ["publication_date", "publication"],
  ["scheduled_effect_date", "scheduled_effect"],
  ["legal_effect_date", "legal_effect"],
  ["compliance_date", "compliance"],
  ["compliance_start", "compliance"],
  ["compliance_filing_date", "compliance_filing"],
  ["implementation_date", "implementation"],
  ["enforcement_date", "enforcement"],
  ["amendment_date", "amendment"],
  ["injunction_date", "injunction"],
  ["invalidation_date", "invalidation"],
  ["withdrawal_date", "withdrawal"],
  ["suspension_date", "suspension"],
  ["repeal_date", "repeal"],
  ["supersession_date", "supersession"],
]);

const TYPED_DATE_STAGE: Readonly<
  Partial<Record<TypedDate["kind"], PolicyChronologyStage>>
> = {
  announcement: "announcement",
  adoption: "adoption",
  publication: "publication",
  scheduled_effect: "scheduled_effect",
  legal_effect: "legal_effect",
  compliance: "compliance",
  implementation: "implementation",
  enforcement: "enforcement",
  amendment: "amendment",
  injunction: "injunction",
  invalidation: "invalidation",
  withdrawal: "withdrawal",
  suspension: "suspension",
  repeal: "repeal",
  supersession: "supersession",
};

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: string) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value);
  if (!match) return false;
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return false;
  if (day === null) return true;
  const year = Number(match[1]);
  const date = new Date(Date.UTC(year, month! - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day;
}

function requireDate(value: string, label: string) {
  if (!validDate(value)) throw new Error(label + " must preserve a valid date.");
  return value;
}

function inferredPrecision(value: string): TypedDate["precision"] {
  return value.length === 4 ? "year" : value.length === 7 ? "month" : "day";
}

function boundedDayOffset(value: unknown) {
  return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 100_000
    ? value
    : null;
}

function normalizedPrecision(
  value: unknown,
  start: string,
  end: string | null,
): TypedDate["precision"] {
  if (
    value === "day" || value === "month" || value === "year" ||
    value === "interval" || value === "unknown"
  ) return end !== null ? "interval" : value;
  return end !== null ? "interval" : inferredPrecision(start);
}

function stableId(prefix: string, value: unknown) {
  return prefix + "-" + fingerprintSixScreenValue(value).slice("fnv1a64:".length);
}

function normalizedCollection(collection: EvidenceCollection): EvidenceCollection {
  const byId = <T extends { id: string }>(values: readonly T[]) =>
    [...values]
      .sort((left, right) => compareText(left.id, right.id))
      .map((value) => structuredClone(value));
  return {
    sources: byId(collection.sources),
    documentVersions: byId(collection.documentVersions),
    passages: byId(collection.passages),
    claims: byId(collection.claims),
    conflicts: byId(collection.conflicts),
    requirements: byId(collection.requirements),
  };
}

function timingKey(stage: PolicyChronologyStage, timing: PolicyChronologyTiming) {
  return fingerprintSixScreenValue({ stage, timing });
}

function uniqueSorted<T>(values: readonly T[], key: (value: T) => string) {
  const unique = new Map<string, T>();
  for (const value of values) if (!unique.has(key(value))) unique.set(key(value), value);
  return [...unique.values()].sort((left, right) =>
    compareText(key(left), key(right))
  );
}

function statementForClaim(
  claim: Claim,
): PolicyChronologyStatement {
  return {
    claimId: claim.id,
    predicate: claim.predicate,
    statement: claim.statement,
    scope: claim.scope,
    supportStatus: claim.supportStatus,
    reviewStatus: claim.reviewStatus,
  };
}

function buildProjectionBody(input: {
  identityFingerprint: string;
  snapshot: EvidenceSnapshot;
  collection: EvidenceCollection;
}) {
  requireFingerprint(input.identityFingerprint, "Policy chronology identity fingerprint");
  validateEvidenceSnapshot(input.snapshot, input.collection);
  for (const claim of input.collection.claims) {
    if (claim.eventId !== input.snapshot.eventId) {
      throw new Error(
        "Policy chronology claim " + claim.id +
          " does not match the immutable evidence event.",
      );
    }
  }
  for (const conflict of input.collection.conflicts) {
    if (conflict.eventId !== input.snapshot.eventId) {
      throw new Error(
        "Policy chronology conflict " + conflict.id +
          " does not match the immutable evidence event.",
      );
    }
  }

  const collection = normalizedCollection(input.collection);
  const passageById = new Map(collection.passages.map((value) => [value.id, value]));
  const documentsBySourceId = new Map<
    string,
    EvidenceCollection["documentVersions"]
  >();
  const passagesBySourceId = new Map<string, EvidenceCollection["passages"]>();
  const claimsBySourceId = new Map<string, EvidenceCollection["claims"]>();
  const supportingClaimIdsByPassageId = new Map<string, string[]>();
  const opposingClaimIdsByPassageId = new Map<string, string[]>();
  const conflictIdsByClaimId = new Map<string, string[]>();
  const unresolvedConflictIds = new Set(
    collection.conflicts
      .filter(({ resolution }) => resolution === null)
      .map(({ id }) => id),
  );
  const append = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const values = map.get(key);
    if (values) values.push(value);
    else map.set(key, [value]);
  };
  for (const document of collection.documentVersions) {
    append(documentsBySourceId, document.sourceId, document);
  }
  for (const passage of collection.passages) {
    append(passagesBySourceId, passage.sourceId, passage);
  }
  for (const claim of collection.claims) {
    const sourceIds = new Set<string>();
    for (const passageId of claim.supportingPassageIds) {
      append(supportingClaimIdsByPassageId, passageId, claim.id);
      sourceIds.add(passageById.get(passageId)!.sourceId);
    }
    for (const passageId of claim.opposingPassageIds) {
      append(opposingClaimIdsByPassageId, passageId, claim.id);
      sourceIds.add(passageById.get(passageId)!.sourceId);
    }
    for (const sourceId of sourceIds) {
      append(claimsBySourceId, sourceId, claim);
    }
  }
  for (const conflict of collection.conflicts) {
    for (const claimId of conflict.claimIds) {
      append(conflictIdsByClaimId, claimId, conflict.id);
    }
  }
  const conflictIdsForClaim = (claimId: string) =>
    [...new Set(conflictIdsByClaimId.get(claimId) ?? [])].sort(compareText);
  const clocks = new Map<string, ClockDraft>();

  const claimLineages = (claim: Claim) => [
    ...claim.supportingPassageIds.map((passageId): PolicyChronologyLineage => {
      const passage = passageById.get(passageId)!;
      return {
        evidenceKind: "claim_passage",
        direction: "supporting",
        claimId: claim.id,
        passageId,
        documentVersionId: passage.documentVersionId,
        sourceId: passage.sourceId,
      };
    }),
    ...claim.opposingPassageIds.map((passageId): PolicyChronologyLineage => {
      const passage = passageById.get(passageId)!;
      return {
        evidenceKind: "claim_passage",
        direction: "opposing",
        claimId: claim.id,
        passageId,
        documentVersionId: passage.documentVersionId,
        sourceId: passage.sourceId,
      };
    }),
  ];

  const addClock = (inputClock: {
    stage: PolicyChronologyStage;
    timing: PolicyChronologyTiming;
    statements?: PolicyChronologyStatement[];
    lineages: PolicyChronologyLineage[];
    qualifications?: string[];
    conflictIds?: string[];
  }) => {
    const key = timingKey(inputClock.stage, inputClock.timing);
    let clock = clocks.get(key);
    if (!clock) {
      clock = {
        id: stableId("policy-clock-" + inputClock.stage, {
          stage: inputClock.stage,
          timing: inputClock.timing,
        }),
        stage: inputClock.stage,
        label: STAGE_LABELS[inputClock.stage],
        timing: structuredClone(inputClock.timing),
        statements: [],
        lineages: [],
        qualifications: [],
        conflictIds: [],
        hasUnresolvedConflict: false,
      };
      clocks.set(key, clock);
    }
    clock.statements = uniqueSorted(
      [...clock.statements, ...(inputClock.statements ?? [])],
      (value) => value.claimId,
    );
    clock.lineages = uniqueSorted(
      [...clock.lineages, ...inputClock.lineages],
      (value) => [
        value.evidenceKind,
        value.direction,
        value.claimId ?? "",
        value.passageId ?? "",
        value.documentVersionId,
        value.sourceId,
      ].join(":"),
    );
    clock.qualifications = [...new Set([
      ...clock.qualifications,
      ...(inputClock.qualifications ?? []).filter((value) => value.trim()),
    ])].sort(compareText);
    clock.conflictIds = [...new Set([
      ...clock.conflictIds,
      ...(inputClock.conflictIds ?? []),
    ])].sort(compareText);
    clock.hasUnresolvedConflict = clock.conflictIds.some((conflictId) =>
      unresolvedConflictIds.has(conflictId)
    );
    return clock;
  };

  for (const source of collection.sources) {
    if (source.publicationDate !== null) {
      const publicationDate = requireDate(
        source.publicationDate,
        "Source " + source.id + " publicationDate",
      );
      addClock({
        stage: "publication",
        timing: {
          mode: "absolute",
          start: publicationDate,
          end: null,
          precision: inferredPrecision(publicationDate),
        },
        lineages: [{
          evidenceKind: "source_metadata",
          direction: "metadata",
          claimId: null,
          passageId: null,
          documentVersionId: source.documentVersionId,
          sourceId: source.id,
        }],
      });
    }
    for (const typedDate of source.legalVersionDates) {
      const stage = TYPED_DATE_STAGE[typedDate.kind];
      if (!stage) continue;
      if (typedDate.start === null) {
        addClock({
          stage,
          timing: {
            mode: "undated",
            reason: "source_did_not_establish_a_normalized_date",
          },
          lineages: [{
            evidenceKind: "source_metadata",
            direction: "metadata",
            claimId: null,
            passageId: null,
            documentVersionId: source.documentVersionId,
            sourceId: source.id,
          }],
        });
        continue;
      }
      const start = requireDate(
        typedDate.start,
        "Source " + source.id + " legal version start",
      );
      const end = typedDate.end === null
        ? null
        : requireDate(
            typedDate.end,
            "Source " + source.id + " legal version end",
          );
      const lineages = typedDate.passageIds.length
        ? typedDate.passageIds.map((passageId): PolicyChronologyLineage => {
            const passage = passageById.get(passageId);
            if (!passage || passage.sourceId !== source.id) {
              throw new Error(
                "Source " + source.id +
                  " legal version date names a passage outside that source.",
              );
            }
            return {
              evidenceKind: "source_metadata",
              direction: "metadata",
              claimId: null,
              passageId,
              documentVersionId: passage.documentVersionId,
              sourceId: source.id,
            };
          })
        : [{
            evidenceKind: "source_metadata" as const,
            direction: "metadata" as const,
            claimId: null,
            passageId: null,
            documentVersionId: source.documentVersionId,
            sourceId: source.id,
          }];
      addClock({
        stage,
        timing: {
          mode: "absolute",
          start,
          end,
          precision: end !== null ? "interval" : typedDate.precision,
        },
        lineages,
        qualifications: typedDate.passageIds.flatMap((passageId) => {
          const value = passageById.get(passageId)?.qualification;
          return value ? [value] : [];
        }),
      });
    }
  }

  for (const claim of collection.claims) {
    if (claim.predicate === "implementation_schedule") continue;
    const typedValue = isRecord(claim.typedValue) ? claim.typedValue : null;
    const typedStage = typedValue &&
      typeof typedValue.stage === "string" &&
      Object.hasOwn(STAGE_ORDER, typedValue.stage)
      ? typedValue.stage as PolicyChronologyStage
      : typedValue &&
          typeof typedValue.kind === "string" &&
          Object.hasOwn(STAGE_ORDER, typedValue.kind)
        ? typedValue.kind as PolicyChronologyStage
        : null;
    const stage = CLAIM_STAGE_BY_PREDICATE.get(claim.predicate) ?? typedStage;
    if (!stage || claim.supportingPassageIds.length < 1) continue;
    const lineages = claimLineages(claim);
    const qualifications = lineages.flatMap(({ passageId }) => {
      const value = passageId ? passageById.get(passageId)?.qualification : null;
      return value ? [value] : [];
    });
    const rawStart = typedValue && typeof typedValue.date === "string"
      ? typedValue.date
      : typedValue && typeof typedValue.start === "string"
        ? typedValue.start
        : null;
    const rawEnd = typedValue && typeof typedValue.end === "string"
      ? typedValue.end
      : null;
    const timing: PolicyChronologyTiming = rawStart
      ? {
          mode: "absolute",
          start: requireDate(
            rawStart,
            "Claim " + claim.id + " chronology date",
          ),
          end: rawEnd
            ? requireDate(rawEnd, "Claim " + claim.id + " chronology end")
            : null,
          precision: normalizedPrecision(
            typedValue?.precision,
            rawStart,
            rawEnd,
          ),
        }
      : {
          mode: "undated",
          reason: "source_did_not_establish_a_normalized_date",
        };
    addClock({
      stage,
      timing,
      statements: [statementForClaim(claim)],
      lineages,
      qualifications,
      conflictIds: conflictIdsForClaim(claim.id),
    });
  }

  const publicationClocks = () => [...clocks.values()]
    .filter(({ stage }) => stage === "publication");
  const publicationAnchorFor = (lineages: readonly PolicyChronologyLineage[]) => {
    const sourceIds = new Set(lineages.map(({ sourceId }) => sourceId));
    const matched = publicationClocks().filter((clock) =>
      clock.lineages.some(({ sourceId }) => sourceIds.has(sourceId))
    );
    const candidates = matched.length ? matched : publicationClocks();
    return candidates.length === 1 ? candidates[0]!.id : null;
  };

  for (const claim of collection.claims) {
    if (
      claim.predicate !== "implementation_schedule" ||
      claim.supportingPassageIds.length < 1
    ) continue;
    const value = isRecord(claim.typedValue) ? claim.typedValue : {};
    const lineages = claimLineages(claim);
    const qualifications = [
      ...lineages.flatMap(({ passageId }) => {
        const qualification = passageId
          ? passageById.get(passageId)?.qualification
          : null;
        return qualification ? [qualification] : [];
      }),
      "Relative deadlines remain relative in this projection; no calendar date or actual unit-level implementation is inferred.",
    ];
    const conflicts = conflictIdsForClaim(claim.id);
    const statement = statementForClaim(claim);
    const filingDays = boundedDayOffset(
      value.filingDeadlineDaysAfterPublication,
    );
    const implementationDays = boundedDayOffset(
      value.implementationWindowDaysAfterFilingDeadline,
    );
    const publicationAnchorId = publicationAnchorFor(lineages);
    const filingClock = filingDays === null
      ? null
      : addClock({
          stage: "compliance_filing",
          timing: {
            mode: "relative",
            anchorStage: "publication",
            anchorClockId: publicationAnchorId,
            offsetDays: filingDays,
            relation: "no_later_than_days_after",
            calendarDate: null,
          },
          statements: [statement],
          lineages,
          qualifications,
          conflictIds: conflicts,
        });
    if (implementationDays !== null) {
      const statedAnchorStage = filingClock
        ? "compliance_filing" as const
        : value.anchor === "publication"
          ? "publication" as const
          : value.anchor === "filing_deadline"
            ? "compliance_filing" as const
            : null;
      addClock({
        stage: "implementation",
        timing: {
          mode: "relative",
          anchorStage: statedAnchorStage,
          anchorClockId: filingClock?.id ??
            (statedAnchorStage === "publication" ? publicationAnchorId : null),
          offsetDays: implementationDays,
          relation: "no_later_than_days_after",
          calendarDate: null,
        },
        statements: [statement],
        lineages,
        qualifications,
        conflictIds: conflicts,
      });
    } else if (filingDays === null) {
      addClock({
        stage: "implementation",
        timing: {
          mode: "undated",
          reason: "source_did_not_establish_a_normalized_date",
        },
        statements: [statement],
        lineages,
        qualifications,
        conflictIds: conflicts,
      });
    }
  }

  const clockValues = [...clocks.values()];
  const compareClock = (left: PolicyChronologyClock, right: PolicyChronologyClock) => {
    if (left.timing.mode === "absolute" && right.timing.mode === "absolute") {
      return compareText(left.timing.start, right.timing.start) ||
        STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage] ||
        compareText(left.id, right.id);
    }
    if (left.timing.mode === "relative" && right.timing.mode === "relative") {
      return STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage] ||
        left.timing.offsetDays - right.timing.offsetDays ||
        compareText(left.id, right.id);
    }
    return STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage] ||
      compareText(left.id, right.id);
  };
  const absoluteClocks = clockValues
    .filter(({ timing }) => timing.mode === "absolute")
    .sort(compareClock);
  const relativeClocks = clockValues
    .filter(({ timing }) => timing.mode === "relative")
    .sort(compareClock);
  const undatedClocks = clockValues
    .filter(({ timing }) => timing.mode === "undated")
    .sort(compareClock);
  const candidateClocks = [
    ...absoluteClocks,
    ...relativeClocks,
    ...undatedClocks,
  ];
  const candidates = candidateClocks.map(
    (clock): PolicyTreatmentClockCandidate => ({
      id: stableId("treatment-clock-candidate", clock.id),
      clockId: clock.id,
      stage: clock.stage,
      label: clock.label,
      timing: structuredClone(clock.timing),
      evidenceBasis: clock.statements.length ? "claim_linked" : "source_metadata",
      status: "unreviewed",
      selected: false,
      selectionOwner: "researcher",
      qualification: TREATMENT_QUALIFICATIONS[clock.stage],
    }),
  );

  const sourcePanelSources = collection.sources.map(
    (source): PolicySourcePanelSource => {
      const documents = (documentsBySourceId.get(source.id) ?? [])
        .map((document): PolicySourcePanelDocumentVersion => ({
          documentVersionId: document.id,
          representation: document.representation,
          language: document.language,
          versionLabel: document.versionLabel,
          retrievedAt: document.retrievedAt,
          contentHash: document.contentHash,
          parserVersion: document.parserVersion,
          parsedTextLength: document.parsedTextLength,
        }))
        .sort((left, right) =>
          compareText(left.documentVersionId, right.documentVersionId)
        );
      const sourcePassages = (passagesBySourceId.get(source.id) ?? [])
        .map((passage): PolicySourcePanelPassage => ({
          passageId: passage.id,
          documentVersionId: passage.documentVersionId,
          locator: passage.locator,
          exactText: passage.exactText,
          startOffset: passage.startOffset,
          endOffset: passage.endOffset,
          qualification: passage.qualification,
          unresolvedCrossReferences: [...passage.unresolvedCrossReferences]
            .sort(compareText),
          supportingClaimIds: [
            ...new Set(
              supportingClaimIdsByPassageId.get(passage.id) ?? [],
            ),
          ].sort(compareText),
          opposingClaimIds: [
            ...new Set(
              opposingClaimIdsByPassageId.get(passage.id) ?? [],
            ),
          ].sort(compareText),
        }))
        .sort((left, right) => compareText(left.passageId, right.passageId));
      const sourceClaims = (claimsBySourceId.get(source.id) ?? [])
        .map((claim): PolicySourcePanelClaim => ({
          claimId: claim.id,
          predicate: claim.predicate,
          statement: claim.statement,
          typedValue: structuredClone(claim.typedValue),
          scope: claim.scope,
          supportingPassageIds: [...claim.supportingPassageIds].sort(compareText),
          opposingPassageIds: [...claim.opposingPassageIds].sort(compareText),
          supportStatus: claim.supportStatus,
          reviewStatus: claim.reviewStatus,
          criticalFor: [...claim.criticalFor].sort(compareText),
          conflictIds: conflictIdsForClaim(claim.id),
        }))
        .sort((left, right) => compareText(left.claimId, right.claimId));
      const sourceConflictIds = [...new Set(
        sourceClaims.flatMap(({ conflictIds }) => conflictIds),
      )].sort(compareText);
      return {
        sourceId: source.id,
        provider: source.provider,
        nativeId: source.nativeId,
        canonicalUrl: source.canonicalUrl,
        publisher: source.publisher,
        issuer: source.issuer,
        author: source.author,
        jurisdiction: source.jurisdiction,
        role: source.role,
        documentType: source.documentType,
        language: source.language,
        publicationDate: source.publicationDate,
        legalVersionDates: structuredClone(source.legalVersionDates),
        retrievedAt: source.retrievedAt,
        contentHash: source.contentHash,
        acquisitionProvenance: source.acquisitionProvenance,
        accessStatus: source.accessStatus,
        rightsStatus: source.rightsStatus,
        parserVersion: source.parserVersion,
        textQualityStatus: source.textQualityStatus,
        inspectedText: source.inspectedText,
        documentVersions: documents,
        passages: sourcePassages,
        claims: sourceClaims,
        qualificationCount: sourcePassages.filter(
          ({ qualification }) => qualification !== null,
        ).length,
        unresolvedCrossReferenceCount: sourcePassages.reduce(
          (total, passage) =>
            total + passage.unresolvedCrossReferences.length,
          0,
        ),
        conflictIds: sourceConflictIds,
      };
    },
  );

  const unresolvedRequirements = collection.requirements.flatMap(
    (requirement): PolicyUnresolvedRequirement[] =>
      requirement.status === "supported" ||
        requirement.status === "not_applicable"
        ? []
        : [{
            requirementId: requirement.id,
            kind: requirement.kind,
            description: requirement.description,
            status: requirement.status,
            criticality: requirement.criticality,
            supportingClaimIds: [...requirement.supportingClaimIds]
              .sort(compareText),
          }],
  ).sort((left, right) => {
    const criticality = { critical: 0, material: 1, contextual: 2 };
    return criticality[left.criticality] - criticality[right.criticality] ||
      compareText(left.kind, right.kind) ||
      compareText(left.requirementId, right.requirementId);
  });

  return {
    schemaVersion: SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION,
    binding: {
      eventId: input.snapshot.eventId,
      identityFingerprint: input.identityFingerprint,
      evidenceSnapshotId: input.snapshot.id,
      evidenceSnapshotRevision: input.snapshot.revision,
      evidenceSnapshotFingerprint: input.snapshot.snapshotFingerprint,
      evidenceCollectionFingerprint: fingerprintSixScreenValue(collection),
    },
    chronology: {
      absoluteClocks,
      relativeClocks,
      undatedClocks,
    },
    treatmentClockReview: {
      status: candidates.length
        ? "researcher_review_required" as const
        : "no_candidate_available" as const,
      selectedCandidateId: null,
      selectionOwner: "researcher" as const,
      candidates,
    },
    sourcePanel: {
      sourceCount: collection.sources.length,
      documentVersionCount: collection.documentVersions.length,
      retainedPassageCount: collection.passages.length,
      claimCount: collection.claims.length,
      sources: sourcePanelSources,
    },
    unresolvedRequirements,
    conflicts: collection.conflicts.map((value) => structuredClone(value)),
    interpretationGate: {
      coherentOverview: null,
      consequentialSemanticReview: null,
      reviewedEventCard: null,
      status: "blocked" as const,
      reason: "genuine_intelligence_path_unverified" as const,
    },
  };
}

/**
 * Builds a display/review input from one immutable evidence snapshot. This
 * function performs no semantic synthesis and never chooses a treatment clock.
 */
export function createPolicyChronologySourcePanel(input: {
  identityFingerprint: string;
  snapshot: EvidenceSnapshot;
  collection: EvidenceCollection;
}): PolicyChronologySourcePanelProjection {
  const body = buildProjectionBody(input);
  return {
    ...body,
    projectionFingerprint: fingerprintSixScreenValue(body),
  };
}

export function createPolicyChronologySourcePanelForSavedReview(input: {
  review: PolicyChronologySavedReviewBinding;
  snapshot: EvidenceSnapshot;
  collection: EvidenceCollection;
}) {
  if (
    input.review.evidenceSnapshotId === null ||
    input.review.evidenceSnapshotFingerprint === null ||
    input.review.evidenceSnapshotId !== input.snapshot.id ||
    input.review.evidenceSnapshotFingerprint !==
      input.snapshot.snapshotFingerprint
  ) {
    throw new Error(
      "Saved policy review does not name the supplied immutable evidence snapshot.",
    );
  }
  return createPolicyChronologySourcePanel({
    identityFingerprint: input.review.identityFingerprint,
    snapshot: input.snapshot,
    collection: input.collection,
  });
}

export function validatePolicyChronologySourcePanel(input: {
  projection: PolicyChronologySourcePanelProjection;
  identityFingerprint: string;
  snapshot: EvidenceSnapshot;
  collection: EvidenceCollection;
}) {
  validateEvidenceCollection(input.collection);
  const expected = createPolicyChronologySourcePanel(input);
  if (
    input.projection.schemaVersion !==
      SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION ||
    input.projection.projectionFingerprint !== expected.projectionFingerprint ||
    !sameSixScreenValue(input.projection, expected)
  ) {
    throw new Error(
      "Policy chronology/source-panel projection does not match its immutable evidence binding.",
    );
  }
  return input.projection;
}
