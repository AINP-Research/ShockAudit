import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INDEX_PATH = new URL(
  "../src/data/screen02-public-event-index.v1.json",
  import.meta.url,
);
const MANIFEST_PATH = new URL(
  "../src/data/screen02-public-event-index.v1.manifest.json",
  import.meta.url,
);
const INDEX_VERSION = "screen-02-public-event-index-2026-10-28-v3";
const CAPTURED_AT = "2026-10-28";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DATE_ROLES = new Set([
  "announcement",
  "adoption",
  "enactment",
  "scheduled_effect",
  "effective",
  "implementation",
  "enforcement",
  "amendment",
  "publication",
  "occurrence",
  "ruling",
  "injunction",
  "invalidation",
  "withdrawal",
  "repeal",
  "supersession",
  "other",
]);

function fail(message) {
  throw new Error(`Public-event index validation failed: ${message}`);
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseArguments(argv) {
  let update = false;
  let source = INDEX_PATH;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--update") {
      update = true;
    } else if (argument === "--source" && argv[index + 1]) {
      source = pathToFileURL(resolve(argv[index + 1]));
      index += 1;
    } else if (argument === "--help") {
      console.log(
        "Usage: node scripts/validate-public-event-index.mjs [--update] [--source <json>]",
      );
      process.exit(0);
    } else {
      fail(`unknown argument ${argument}`);
    }
  }
  return { update, source };
}

function canonicalRecord(record) {
  return {
    ...record,
    capturedAt: record.capturedAt ?? CAPTURED_AT,
    captureOrigin:
      record.captureOrigin ?? "permitted-public-source-inspection",
  };
}

function deduplicateRecords(input) {
  const records = [];
  const serializedById = new Map();
  for (const candidate of input) {
    const record = canonicalRecord(candidate);
    const serialized = JSON.stringify(record);
    const prior = serializedById.get(record.id);
    if (prior === undefined) {
      serializedById.set(record.id, serialized);
      records.push(record);
    } else if (prior !== serialized) {
      fail(`${record.id} has conflicting duplicate records`);
    }
  }
  return records;
}

const options = parseArguments(process.argv.slice(2));
const sourceRecords = JSON.parse(await readFile(options.source, "utf8"));
if (!Array.isArray(sourceRecords)) {
  fail("the versioned index must be an array");
}
const records = deduplicateRecords(sourceRecords);
if (records.length < 30 || records.length > 200) {
  fail("the versioned index must contain 30–200 records");
}

const recordIds = new Set();
const canonicalSources = new Map();
for (const [index, record] of records.entries()) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail(`record ${index + 1} is not an object`);
  }
  if (!nonempty(record.id) || recordIds.has(record.id)) {
    fail(`record ${index + 1} has a missing or duplicate stable id`);
  }
  recordIds.add(record.id);
  if (
    !nonempty(record.title) || !nonempty(record.description) ||
    !ISO_DATE.test(record.capturedAt) ||
    record.captureOrigin !== "permitted-public-source-inspection" ||
    !ISO_DATE.test(record.eventDate) || !nonempty(record.affectedPopulation) ||
    !Array.isArray(record.limitations) || record.limitations.length === 0 ||
    !Array.isArray(record.sources) || record.sources.length === 0 ||
    !Array.isArray(record.dateDetails) || record.dateDetails.length === 0
  ) {
    fail(`${record.id} is missing a required discovery field`);
  }

  const sourcesById = new Map();
  for (const source of record.sources) {
    if (
      !nonempty(source.id) || sourcesById.has(source.id) ||
      !nonempty(source.title) || !nonempty(source.publisher) ||
      !nonempty(source.evidenceText) || !nonempty(source.channel) ||
      !nonempty(source.retrievedAt) || source.authorityTier > 2
    ) {
      fail(`${record.id} has an invalid or duplicate trustworthy source`);
    }
    let locator;
    try {
      locator = new URL(source.locator);
    } catch {
      fail(`${record.id}/${source.id} has an invalid source URL`);
    }
    if (locator.protocol !== "https:") {
      fail(`${record.id}/${source.id} is not an HTTPS source`);
    }
    sourcesById.set(source.id, source);
    const serialized = JSON.stringify(source);
    const prior = canonicalSources.get(source.id);
    if (prior !== undefined && prior !== serialized) {
      fail(`${source.id} has conflicting factual versions`);
    }
    canonicalSources.set(source.id, serialized);
  }

  for (const detail of record.dateDetails) {
    if (
      !ISO_DATE.test(detail.date) || !DATE_ROLES.has(detail.role) ||
      !nonempty(detail.label) || !nonempty(detail.uncertainty) ||
      (detail.identityChronologyOnly !== undefined &&
        typeof detail.identityChronologyOnly !== "boolean") ||
      !Array.isArray(detail.sourceIds) || detail.sourceIds.length === 0 ||
      detail.sourceIds.some((sourceId) => !sourcesById.has(sourceId))
    ) {
      fail(`${record.id} has an invalid or unbound date role`);
    }
  }
  if (!record.dateDetails.some((detail) => detail.date === record.eventDate)) {
    fail(`${record.id} has no labelled role for its display date`);
  }
  for (const sourceId of record.relationshipEvidenceSourceIds ?? []) {
    if (!sourcesById.has(sourceId)) {
      fail(`${record.id} has an unbound industry-relationship source`);
    }
  }
}

const canonicalFingerprint = createHash("sha256")
  .update(JSON.stringify(records))
  .digest("hex");
const eventDates = records.map((record) => record.eventDate).sort();
const manifest = {
  schemaVersion: "screen-02-public-event-index-coverage-v1",
  indexVersion: INDEX_VERSION,
  capturedAt: CAPTURED_AT,
  captureOrigins: [...new Set(records.map((record) => record.captureOrigin))]
    .sort(),
  recordCount: records.length,
  sourceCount: canonicalSources.size,
  eventFamilies: [...new Set(records.map((record) => record.eventFamily))]
    .sort(),
  jurisdictions: [...new Set(records.flatMap((record) => record.geographies))]
    .sort(),
  earliestDate: eventDates[0],
  latestDate: eventDates.at(-1),
  canonicalSha256: canonicalFingerprint,
};

if (options.update) {
  if (JSON.stringify(sourceRecords) !== JSON.stringify(records)) {
    await writeFile(INDEX_PATH, `${JSON.stringify(records, null, 2)}\n`);
  }
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
} else {
  const retainedManifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (JSON.stringify(retainedManifest) !== JSON.stringify(manifest)) {
    fail(
      "the retained coverage manifest is stale; run npm run update:public-event-index",
    );
  }
}

console.log(
  `${options.update ? "Updated" : "Validated"} ${records.length} public events and ${canonicalSources.size} stable sources in screen02-public-event-index.v1.json (${canonicalFingerprint.slice(0, 16)}).`,
);
