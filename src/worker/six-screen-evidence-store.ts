import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type {
  Claim,
  ConflictRecord,
  DocumentVersion,
  EvidenceRequirement,
  EvidenceSnapshot,
  Passage,
  SourceRecord,
} from "../core/six-screen/contracts";
import {
  projectVisibleClaim,
  validateEvidenceCollection,
  validateEvidenceSnapshot,
  type EvidenceCollection,
} from "../core/six-screen/evidence";
import type { SixScreenWorkflowStorage } from
  "./six-screen-workflow-store";

export const SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION =
  "shockaudit-six-screen-evidence-store-v1" as const;
export const SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES = 96_000;
export const SIX_SCREEN_EVIDENCE_CLEANUP_BATCH_SIZE = 16;

const MANIFEST_PREFIX = "six-screen-evidence-v1:";
const CHUNK_PREFIX = "six-screen-evidence-chunk-v1:";
const EXPIRY_PREFIX = "six-screen-evidence-expiry-v1:";
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^sa6a_[A-Za-z0-9_-]{43}$/u;

type EvidenceEntity =
  | { kind: "sources"; value: SourceRecord }
  | { kind: "documentVersions"; value: DocumentVersion }
  | { kind: "passages"; value: Passage }
  | { kind: "claims"; value: Claim }
  | { kind: "conflicts"; value: ConflictRecord }
  | { kind: "requirements"; value: EvidenceRequirement };

type EvidenceChunk = {
  schemaVersion: typeof SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION;
  snapshotId: string;
  index: number;
  entities: EvidenceEntity[];
};

export type SixScreenEvidenceManifest = {
  schemaVersion: typeof SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION;
  runId: string;
  snapshotId: string;
  accessTokenSha256: string;
  snapshot: EvidenceSnapshot;
  collectionFingerprint: string;
  chunkKeys: string[];
  counts: Record<EvidenceEntity["kind"], number>;
  createdAt: string;
  expiresAt: string;
};

export type SixScreenEvidenceAuthentication = {
  runId: string;
  snapshotId: string;
  accessToken: string;
};

export class SixScreenEvidenceCapacityError extends Error {
  readonly code = "checkpoint_capacity" as const;
}

function requireInstant(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO instant.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant.`);
  }
  return value;
}

function requireId(value: string, label: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

function requireAuthentication(authentication: SixScreenEvidenceAuthentication) {
  if (!RUN_ID_PATTERN.test(authentication.runId)) {
    throw new Error("Six-screen evidence run id is invalid.");
  }
  requireId(authentication.snapshotId, "Six-screen evidence snapshot id");
  if (!ACCESS_TOKEN_PATTERN.test(authentication.accessToken)) {
    throw new Error("Six-screen evidence access token is invalid.");
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${bytesToHex(digest)}`;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let different = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    different |= (leftBytes[index % leftBytes.length] ?? 0) ^
      (rightBytes[index % rightBytes.length] ?? 0);
  }
  return different === 0;
}

function normalizedCollection(collection: EvidenceCollection): EvidenceCollection {
  return {
    sources: [...collection.sources].sort((left, right) => left.id.localeCompare(right.id)),
    documentVersions: [...collection.documentVersions]
      .sort((left, right) => left.id.localeCompare(right.id)),
    passages: [...collection.passages].sort((left, right) => left.id.localeCompare(right.id)),
    claims: [...collection.claims].sort((left, right) => left.id.localeCompare(right.id)),
    conflicts: [...collection.conflicts].sort((left, right) => left.id.localeCompare(right.id)),
    requirements: [...collection.requirements]
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function entities(collection: EvidenceCollection): EvidenceEntity[] {
  return [
    ...collection.sources.map((value) => ({ kind: "sources" as const, value })),
    ...collection.documentVersions.map((value) => ({
      kind: "documentVersions" as const,
      value,
    })),
    ...collection.passages.map((value) => ({ kind: "passages" as const, value })),
    ...collection.claims.map((value) => ({ kind: "claims" as const, value })),
    ...collection.conflicts.map((value) => ({ kind: "conflicts" as const, value })),
    ...collection.requirements.map((value) => ({
      kind: "requirements" as const,
      value,
    })),
  ];
}

function chunkEntities(snapshotId: string, values: EvidenceEntity[]) {
  const chunks: EvidenceChunk[] = [];
  let current: EvidenceEntity[] = [];
  for (const entity of values) {
    const proposed: EvidenceChunk = {
      schemaVersion: SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION,
      snapshotId,
      index: chunks.length,
      entities: [...current, entity],
    };
    if (
      new TextEncoder().encode(JSON.stringify(proposed)).byteLength >
        SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES
    ) {
      if (!current.length) {
        throw new SixScreenEvidenceCapacityError(
          `Evidence entity ${entity.value.id} exceeds the checkpoint chunk capacity.`,
        );
      }
      chunks.push({ ...proposed, index: chunks.length, entities: current });
      const single = { ...proposed, index: chunks.length, entities: [entity] };
      if (
        new TextEncoder().encode(JSON.stringify(single)).byteLength >
          SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES
      ) {
        throw new SixScreenEvidenceCapacityError(
          `Evidence entity ${entity.value.id} exceeds the checkpoint chunk capacity.`,
        );
      }
      current = [entity];
    } else {
      current.push(entity);
    }
  }
  if (current.length || !chunks.length) {
    chunks.push({
      schemaVersion: SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION,
      snapshotId,
      index: chunks.length,
      entities: current,
    });
  }
  return chunks;
}

function manifestKey(runId: string, snapshotId: string) {
  return `${MANIFEST_PREFIX}${runId}:${snapshotId}`;
}

function chunkKey(runId: string, snapshotId: string, index: number) {
  return `${CHUNK_PREFIX}${runId}:${snapshotId}:${index.toString().padStart(5, "0")}`;
}

function expiryKey(expiresAt: string, runId: string, snapshotId: string) {
  return `${EXPIRY_PREFIX}${expiresAt}:${runId}:${snapshotId}`;
}

function requireManifest(value: unknown): SixScreenEvidenceManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored six-screen evidence manifest is invalid.");
  }
  const manifest = value as Partial<SixScreenEvidenceManifest>;
  if (
    manifest.schemaVersion !== SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION ||
    typeof manifest.runId !== "string" || !RUN_ID_PATTERN.test(manifest.runId) ||
    typeof manifest.snapshotId !== "string" || !manifest.snapshot ||
    manifest.snapshot.id !== manifest.snapshotId ||
    typeof manifest.accessTokenSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(manifest.accessTokenSha256) ||
    typeof manifest.collectionFingerprint !== "string" ||
    !/^fnv1a64:[0-9a-f]{16}$/u.test(manifest.collectionFingerprint) ||
    !Array.isArray(manifest.chunkKeys) || !manifest.counts
  ) {
    throw new Error("Stored six-screen evidence manifest is invalid.");
  }
  requireId(manifest.snapshotId, "Stored evidence snapshot id");
  requireInstant(manifest.createdAt, "Stored evidence createdAt");
  requireInstant(manifest.expiresAt, "Stored evidence expiresAt");
  return manifest as SixScreenEvidenceManifest;
}

function collectionFromChunks(chunks: EvidenceChunk[]): EvidenceCollection {
  const collection: EvidenceCollection = {
    sources: [],
    documentVersions: [],
    passages: [],
    claims: [],
    conflicts: [],
    requirements: [],
  };
  for (const chunk of chunks.sort((left, right) => left.index - right.index)) {
    for (const entity of chunk.entities) {
      (collection[entity.kind] as Array<typeof entity.value>).push(entity.value);
    }
  }
  return collection;
}

export class SixScreenEvidenceStore {
  constructor(private readonly storage: SixScreenWorkflowStorage) {}

  async create(input: {
    runId: string;
    accessToken: string;
    snapshot: EvidenceSnapshot;
    collection: EvidenceCollection;
    expiresAt: string;
  }) {
    requireAuthentication({
      runId: input.runId,
      snapshotId: input.snapshot.id,
      accessToken: input.accessToken,
    });
    requireInstant(input.expiresAt, "Evidence expiry");
    const collection = normalizedCollection(input.collection);
    validateEvidenceSnapshot(input.snapshot, collection);
    const collectionFingerprint = fingerprintSixScreenValue(collection);
    const chunks = chunkEntities(input.snapshot.id, entities(collection));
    const accessTokenSha256 = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = manifestKey(input.runId, input.snapshot.id);
      const existingValue = await transaction.get(key);
      if (existingValue !== undefined) {
        const existing = requireManifest(existingValue);
        return constantTimeEqual(existing.accessTokenSha256, accessTokenSha256) &&
            existing.collectionFingerprint === collectionFingerprint &&
            existing.snapshot.snapshotFingerprint === input.snapshot.snapshotFingerprint
          ? { outcome: "replayed" as const, manifest: existing }
          : { outcome: "conflict" as const };
      }
      const chunkKeys = chunks.map((_, index) =>
        chunkKey(input.runId, input.snapshot.id, index)
      );
      for (const [index, chunk] of chunks.entries()) {
        await transaction.put(chunkKeys[index], chunk);
      }
      const manifest: SixScreenEvidenceManifest = {
        schemaVersion: SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION,
        runId: input.runId,
        snapshotId: input.snapshot.id,
        accessTokenSha256,
        snapshot: structuredClone(input.snapshot),
        collectionFingerprint,
        chunkKeys,
        counts: {
          sources: collection.sources.length,
          documentVersions: collection.documentVersions.length,
          passages: collection.passages.length,
          claims: collection.claims.length,
          conflicts: collection.conflicts.length,
          requirements: collection.requirements.length,
        },
        createdAt: input.snapshot.createdAt,
        expiresAt: input.expiresAt,
      };
      await transaction.put(key, manifest);
      await transaction.put(expiryKey(input.expiresAt, input.runId, input.snapshot.id), {
        runId: input.runId,
        snapshotId: input.snapshot.id,
        expiresAt: input.expiresAt,
      });
      return { outcome: "created" as const, manifest };
    });
  }

  async read(authentication: SixScreenEvidenceAuthentication) {
    requireAuthentication(authentication);
    const value = await this.storage.get(
      manifestKey(authentication.runId, authentication.snapshotId),
    );
    if (value === undefined) return { outcome: "not_found" as const };
    const manifest = requireManifest(value);
    const token = await sha256(authentication.accessToken);
    if (!constantTimeEqual(manifest.accessTokenSha256, token)) {
      return { outcome: "unauthorized" as const };
    }
    const chunks: EvidenceChunk[] = [];
    for (const key of manifest.chunkKeys) {
      const chunk = await this.storage.get(key) as EvidenceChunk | undefined;
      if (
        !chunk || chunk.schemaVersion !== SIX_SCREEN_EVIDENCE_STORE_SCHEMA_VERSION ||
        chunk.snapshotId !== manifest.snapshotId
      ) {
        throw new Error("Stored evidence checkpoint is incomplete.");
      }
      chunks.push(structuredClone(chunk));
    }
    const collection = collectionFromChunks(chunks);
    validateEvidenceCollection(collection);
    validateEvidenceSnapshot(manifest.snapshot, collection);
    if (fingerprintSixScreenValue(collection) !== manifest.collectionFingerprint) {
      throw new Error("Stored evidence collection fingerprint is invalid.");
    }
    return {
      outcome: "found" as const,
      manifest,
      collection,
    };
  }

  async retireRun(input: { runId: string; accessToken: string }, limit = 64) {
    if (!RUN_ID_PATTERN.test(input.runId) ||
        !ACCESS_TOKEN_PATTERN.test(input.accessToken) ||
        !Number.isInteger(limit) || limit < 1 || limit > 64) {
      throw new Error("Evidence retirement coordinates are invalid.");
    }
    const entries = await this.storage.list({
      prefix: `${MANIFEST_PREFIX}${input.runId}:`,
      limit: limit + 1,
    });
    if (entries.size > limit) {
      return { outcome: "capacity" as const, removed: 0 };
    }
    const token = await sha256(input.accessToken);
    const manifests = [...entries.entries()].map(([key, value]) => ({
      key,
      manifest: requireManifest(value),
    }));
    if (manifests.some(({ manifest }) =>
      manifest.runId !== input.runId ||
      !constantTimeEqual(manifest.accessTokenSha256, token)
    )) return { outcome: "unauthorized" as const, removed: 0 };
    await this.storage.transaction(async (transaction) => {
      for (const { key, manifest } of manifests) {
        const current = await transaction.get(key);
        if (current === undefined) continue;
        const verified = requireManifest(current);
        if (verified.runId !== input.runId ||
            !constantTimeEqual(verified.accessTokenSha256, token)) {
          throw new Error("Evidence checkpoint changed during retirement.");
        }
        for (const chunk of verified.chunkKeys) {
          await transaction.delete(chunk);
        }
        await transaction.delete(expiryKey(
          verified.expiresAt,
          verified.runId,
          verified.snapshotId,
        ));
        await transaction.delete(key);
      }
    });
    return { outcome: "retired" as const, removed: manifests.length };
  }

  async readVisibleClaim(
    authentication: SixScreenEvidenceAuthentication,
    claimId: string,
  ) {
    const read = await this.read(authentication);
    if (read.outcome !== "found") return read;
    return {
      outcome: "found" as const,
      manifest: read.manifest,
      claim: projectVisibleClaim(claimId, read.collection),
    };
  }

  async cleanupExpired(now: string) {
    requireInstant(now, "Evidence cleanup time");
    const entries = await this.storage.list({
      prefix: EXPIRY_PREFIX,
      limit: SIX_SCREEN_EVIDENCE_CLEANUP_BATCH_SIZE,
    });
    let deleted = 0;
    for (const [key, marker] of entries) {
      if (!marker || typeof marker !== "object" || Array.isArray(marker)) continue;
      const record = marker as Record<string, unknown>;
      if (
        typeof record.expiresAt !== "string" || record.expiresAt > now ||
        typeof record.runId !== "string" || typeof record.snapshotId !== "string"
      ) continue;
      await this.storage.transaction(async (transaction) => {
        const manifestValue = await transaction.get(
          manifestKey(record.runId as string, record.snapshotId as string),
        );
        if (manifestValue !== undefined) {
          const manifest = requireManifest(manifestValue);
          if (manifest.expiresAt > now) return;
          for (const chunk of manifest.chunkKeys) await transaction.delete(chunk);
          await transaction.delete(
            manifestKey(manifest.runId, manifest.snapshotId),
          );
        }
        await transaction.delete(key);
        deleted += 1;
      });
    }
    return {
      deleted,
      batchLimitReached: entries.size >= SIX_SCREEN_EVIDENCE_CLEANUP_BATCH_SIZE,
    };
  }

  async nextExpirationAt() {
    const entries = await this.storage.list({ prefix: EXPIRY_PREFIX, limit: 1 });
    const marker = entries.values().next().value as Record<string, unknown> | undefined;
    return typeof marker?.expiresAt === "string" ? marker.expiresAt : null;
  }
}
