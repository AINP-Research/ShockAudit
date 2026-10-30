import { fingerprintSixScreenValue } from "./canonical";
import {
  SIX_SCREEN_EVIDENCE_SCHEMA_VERSION,
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  type Claim,
  type ConflictRecord,
  type DocumentVersion,
  type EvidenceRequirement,
  type EvidenceSnapshot,
  type Passage,
  type SourceRecord,
} from "./contracts";

export type EvidenceCollection = {
  sources: SourceRecord[];
  documentVersions: DocumentVersion[];
  passages: Passage[];
  claims: Claim[];
  conflicts: ConflictRecord[];
  requirements: EvidenceRequirement[];
};

export type VisibleClaimProjection = {
  claimId: string;
  statement: string;
  supportStatus: Claim["supportStatus"];
  reviewStatus: Claim["reviewStatus"];
  citations: {
    passageId: string;
    exactText: string;
    locator: string;
    documentVersionId: string;
    sourceId: string;
    sourceTitle: string;
    canonicalUrl: string;
    sourceRole: string;
    inspectedText: SourceRecord["inspectedText"];
  }[];
  opposingCitations: string[];
};

function uniqueIds<T extends { id: string }>(values: readonly T[], label: string) {
  const ids = new Set<string>();
  for (const value of values) {
    requireBoundedIdentifier(value.id, `${label} id`);
    if (ids.has(value.id)) throw new Error(`${label} ids must be unique.`);
    ids.add(value.id);
  }
  return ids;
}

function exactTextAtOffsets(
  passage: Passage,
  parsedTextByDocumentVersionId?: ReadonlyMap<string, string>,
) {
  if (passage.startOffset === null && passage.endOffset === null) return;
  if (
    passage.startOffset === null || passage.endOffset === null ||
    passage.startOffset < 0 || passage.endOffset <= passage.startOffset
  ) {
    throw new Error(`Passage ${passage.id} has invalid text offsets.`);
  }
  const parsed = parsedTextByDocumentVersionId?.get(passage.documentVersionId);
  if (!parsed) return;
  if (parsed.slice(passage.startOffset, passage.endOffset) !== passage.exactText) {
    throw new Error(`Passage ${passage.id} does not match its stored text offsets.`);
  }
}

export function validateEvidenceCollection(
  collection: EvidenceCollection,
  parsedTextByDocumentVersionId?: ReadonlyMap<string, string>,
) {
  const sourceIds = uniqueIds(collection.sources, "Source");
  const documentIds = uniqueIds(collection.documentVersions, "Document version");
  const passageIds = uniqueIds(collection.passages, "Passage");
  const claimIds = uniqueIds(collection.claims, "Claim");
  uniqueIds(collection.conflicts, "Conflict");
  uniqueIds(collection.requirements, "Evidence requirement");

  const sourceById = new Map(collection.sources.map((source) => [source.id, source]));
  const documentById = new Map(
    collection.documentVersions.map((document) => [document.id, document]),
  );
  const passageById = new Map(
    collection.passages.map((passage) => [passage.id, passage]),
  );

  for (const source of collection.sources) {
    requireSanitizedSourceUrl(source.canonicalUrl);
    requireCanonicalInstant(source.retrievedAt, `Source ${source.id} retrievedAt`);
    if (!documentIds.has(source.documentVersionId)) {
      throw new Error(`Source ${source.id} names a missing document version.`);
    }
    const document = documentById.get(source.documentVersionId)!;
    if (document.sourceId !== source.id) {
      throw new Error(`Source ${source.id} does not own its named document version.`);
    }
  }

  for (const document of collection.documentVersions) {
    if (!sourceIds.has(document.sourceId)) {
      throw new Error(`Document version ${document.id} names a missing source.`);
    }
    requireCanonicalInstant(
      document.retrievedAt,
      `Document version ${document.id} retrievedAt`,
    );
  }

  for (const passage of collection.passages) {
    const source = sourceById.get(passage.sourceId);
    const document = documentById.get(passage.documentVersionId);
    if (!source || !document || document.sourceId !== source.id) {
      throw new Error(`Passage ${passage.id} has a broken source/document binding.`);
    }
    if (!passage.exactText.trim()) {
      throw new Error(`Passage ${passage.id} cannot contain empty retained text.`);
    }
    exactTextAtOffsets(passage, parsedTextByDocumentVersionId);
  }

  for (const claim of collection.claims) {
    if (!claim.statement.trim() || !claim.predicate.trim()) {
      throw new Error(`Claim ${claim.id} requires a predicate and statement.`);
    }
    const cited = [...claim.supportingPassageIds, ...claim.opposingPassageIds];
    if (cited.some((id) => !passageIds.has(id))) {
      throw new Error(`Claim ${claim.id} names a missing passage.`);
    }
    if (claim.supportStatus === "direct" && claim.supportingPassageIds.length < 1) {
      throw new Error(`Direct claim ${claim.id} requires a retained passage.`);
    }
    if (claim.supportStatus === "unsupported" && claim.supportingPassageIds.length) {
      throw new Error(`Unsupported claim ${claim.id} cannot cite supporting passages.`);
    }
    if (claim.supportStatus === "conflicting" && claim.opposingPassageIds.length < 1) {
      throw new Error(`Conflicting claim ${claim.id} requires opposing evidence.`);
    }
  }

  for (const conflict of collection.conflicts) {
    if (conflict.claimIds.length < 2 || conflict.claimIds.some((id) => !claimIds.has(id))) {
      throw new Error(`Conflict ${conflict.id} must bind at least two stored claims.`);
    }
    if (conflict.competingValues.length !== conflict.claimIds.length) {
      throw new Error(`Conflict ${conflict.id} must preserve each competing value.`);
    }
  }

  for (const requirement of collection.requirements) {
    if (requirement.supportingClaimIds.some((id) => !claimIds.has(id))) {
      throw new Error(`Evidence requirement ${requirement.id} names a missing claim.`);
    }
    if (
      requirement.status === "supported" &&
      requirement.supportingClaimIds.length < 1
    ) {
      throw new Error(`Supported requirement ${requirement.id} requires a claim.`);
    }
    const subrequirements = requirement.subrequirements ?? [];
    if (new Set(subrequirements.map(({ id }) => id)).size !== subrequirements.length) {
      throw new Error(`Evidence requirement ${requirement.id} has duplicate subrequirements.`);
    }
    for (const subrequirement of subrequirements) {
      requireBoundedIdentifier(
        subrequirement.id,
        `Evidence requirement ${requirement.id} subrequirement id`,
      );
      if (!subrequirement.label.trim()) {
        throw new Error(`Evidence requirement ${requirement.id} has an unlabeled subrequirement.`);
      }
      if (subrequirement.supportingClaimIds.some((id) => !claimIds.has(id))) {
        throw new Error(
          `Evidence requirement ${requirement.id} subrequirement names a missing claim.`,
        );
      }
      if (
        subrequirement.status === "supported" &&
        subrequirement.supportingClaimIds.length < 1
      ) {
        throw new Error(
          `Supported subrequirement ${subrequirement.id} requires a claim.`,
        );
      }
    }
  }
  return collection;
}

export function createEvidenceSnapshot(input: {
  id: string;
  revision: number;
  eventId: string;
  createdAt: string;
  collection: EvidenceCollection;
}): EvidenceSnapshot {
  validateEvidenceCollection(input.collection);
  requireBoundedIdentifier(input.id, "Evidence snapshot id");
  requireCanonicalInstant(input.createdAt, "Evidence snapshot createdAt");
  const body = {
    schemaVersion: SIX_SCREEN_EVIDENCE_SCHEMA_VERSION,
    id: input.id,
    revision: input.revision,
    eventId: input.eventId,
    createdAt: input.createdAt,
    sourceIds: input.collection.sources.map(({ id }) => id).sort(),
    documentVersionIds: input.collection.documentVersions.map(({ id }) => id).sort(),
    passageIds: input.collection.passages.map(({ id }) => id).sort(),
    claimIds: input.collection.claims.map(({ id }) => id).sort(),
    conflictIds: input.collection.conflicts.map(({ id }) => id).sort(),
    requirementIds: input.collection.requirements.map(({ id }) => id).sort(),
  };
  return {
    ...body,
    snapshotFingerprint: fingerprintSixScreenValue(body),
  };
}

export function validateEvidenceSnapshot(
  snapshot: EvidenceSnapshot,
  collection: EvidenceCollection,
) {
  validateEvidenceCollection(collection);
  if (snapshot.schemaVersion !== SIX_SCREEN_EVIDENCE_SCHEMA_VERSION) {
    throw new Error("Evidence snapshot schema version is unsupported.");
  }
  requireFingerprint(snapshot.snapshotFingerprint, "Evidence snapshot fingerprint");
  const expected = createEvidenceSnapshot({
    id: snapshot.id,
    revision: snapshot.revision,
    eventId: snapshot.eventId,
    createdAt: snapshot.createdAt,
    collection,
  });
  if (snapshot.snapshotFingerprint !== expected.snapshotFingerprint) {
    throw new Error("Evidence snapshot fingerprint does not match its collection.");
  }
  return snapshot;
}

/**
 * Enforces the manual's visible-claim invariant:
 * projection -> claim -> passage -> document version -> source/retrieval.
 */
export function projectVisibleClaim(
  claimId: string,
  collection: EvidenceCollection,
): VisibleClaimProjection {
  validateEvidenceCollection(collection);
  const claim = collection.claims.find(({ id }) => id === claimId);
  if (!claim) throw new Error(`Visible claim ${claimId} is not stored.`);
  const passageById = new Map(collection.passages.map((item) => [item.id, item]));
  const documentById = new Map(
    collection.documentVersions.map((item) => [item.id, item]),
  );
  const sourceById = new Map(collection.sources.map((item) => [item.id, item]));
  const citations = claim.supportingPassageIds.map((passageId) => {
    const passage = passageById.get(passageId)!;
    const document = documentById.get(passage.documentVersionId)!;
    const source = sourceById.get(document.sourceId)!;
    return {
      passageId,
      exactText: passage.exactText,
      locator: passage.locator,
      documentVersionId: document.id,
      sourceId: source.id,
      sourceTitle: source.publisher,
      canonicalUrl: source.canonicalUrl,
      sourceRole: source.role,
      inspectedText: source.inspectedText,
    };
  });
  return {
    claimId: claim.id,
    statement: claim.statement,
    supportStatus: claim.supportStatus,
    reviewStatus: claim.reviewStatus,
    citations,
    opposingCitations: [...claim.opposingPassageIds],
  };
}

export function selectWorkingEvidencePacket(input: {
  allowedSourceIds: readonly string[];
  requestedClaimIds: readonly string[];
  collection: EvidenceCollection;
  maximumCharacters?: number;
}) {
  validateEvidenceCollection(input.collection);
  const maximumCharacters = Math.min(
    Math.max(input.maximumCharacters ?? 64_000, 1),
    64_000,
  );
  const allowedSources = new Set(input.allowedSourceIds);
  const claimById = new Map(input.collection.claims.map((claim) => [claim.id, claim]));
  const passageById = new Map(
    input.collection.passages.map((passage) => [passage.id, passage]),
  );
  const selectedClaims: Claim[] = [];
  const passageIds = new Set<string>();
  for (const claimId of input.requestedClaimIds) {
    const claim = claimById.get(claimId);
    if (!claim) throw new Error(`Evidence packet claim ${claimId} is missing.`);
    for (const passageId of [...claim.supportingPassageIds, ...claim.opposingPassageIds]) {
      const passage = passageById.get(passageId)!;
      if (!allowedSources.has(passage.sourceId)) {
        throw new Error(`Evidence packet claim ${claimId} references a disallowed source.`);
      }
      passageIds.add(passageId);
    }
    selectedClaims.push(claim);
  }
  const passages = input.collection.passages.filter(({ id }) => passageIds.has(id));
  const characterCount = passages.reduce((total, passage) => total + passage.exactText.length, 0);
  if (characterCount > maximumCharacters) {
    throw new Error("Evidence packet exceeds its bounded text profile; split the question instead of truncating evidence.");
  }
  return {
    claims: selectedClaims,
    passages,
    sources: input.collection.sources.filter(({ id }) => allowedSources.has(id)),
    characterCount,
    packetFingerprint: fingerprintSixScreenValue({
      claims: selectedClaims,
      passages,
      allowedSourceIds: [...allowedSources].sort(),
    }),
  };
}
