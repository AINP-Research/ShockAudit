import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(root, "tests/benchmarks/fixtures");
const screen02Path = resolve(fixtureRoot, "screen02-generalization-v1.json");
const screen03Path = resolve(fixtureRoot, "screen03-evidence-confirmability-v1.json");
const issues = [];

async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    issues.push(`${relative(root, path)}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function canonicalTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function strings(value) {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "") &&
    new Set(value).size === value.length;
}

function requiredKeys(record, keys, label, closed = true) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    issues.push(`${label}: must be an object`);
    return false;
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      issues.push(`${label}: missing ${key}`);
    }
  }
  if (closed) {
    for (const key of Object.keys(record)) {
      if (!keys.includes(key)) issues.push(`${label}: unexpected ${key}`);
    }
  }
  return true;
}

function validateEnvelope(value, schemaVersion, benchmarkId, minimum, label) {
  if (!requiredKeys(value, ["schemaVersion", "benchmarkId", "frozen", "productionImportForbidden", "reviewedAt", "cases"], label)) return [];
  if (value.schemaVersion !== schemaVersion) issues.push(`${label}: wrong schemaVersion`);
  if (value.benchmarkId !== benchmarkId) issues.push(`${label}: wrong benchmarkId`);
  if (value.frozen !== true || value.productionImportForbidden !== true) {
    issues.push(`${label}: fixture must be frozen and forbidden from production imports`);
  }
  if (!canonicalTimestamp(value.reviewedAt)) issues.push(`${label}: reviewedAt must be canonical ISO-8601`);
  if (!Array.isArray(value.cases) || value.cases.length < minimum) {
    issues.push(`${label}: requires at least ${minimum} cases`);
    return [];
  }
  return value.cases;
}

function validateScreen02(value) {
  const cases = validateEnvelope(
    value,
    "shockaudit-screen02-generalization-benchmark-v1",
    "screen02-cross-domain-v1",
    12,
    "Screen 2 benchmark",
  );
  const keys = ["scopeId", "population", "industry", "geography", "studyPeriod", "eventFamily", "outcomeFamily", "candidateId", "expectedMaximumClass", "expectedExclusion", "rationale", "sourceIds", "candidateInput", "reviewedAt"];
  const identities = new Set();
  for (const [index, item] of cases.entries()) {
    const label = `Screen 2 case ${index + 1}`;
    if (!requiredKeys(item, keys, label)) continue;
    const identity = `${item.scopeId}:${item.candidateId}`;
    if (identities.has(identity)) issues.push(`${label}: duplicate scope/candidate identity`);
    identities.add(identity);
    if (!["direct", "adjacent", "broad", "mismatch"].includes(item.expectedMaximumClass)) issues.push(`${label}: invalid expectedMaximumClass`);
    if (item.expectedMaximumClass === "mismatch" && typeof item.expectedExclusion !== "string") issues.push(`${label}: mismatch requires an exclusion`);
    if (item.expectedMaximumClass !== "mismatch" && item.expectedExclusion !== null) issues.push(`${label}: eligible case must use null expectedExclusion`);
    if (!strings(item.sourceIds)) issues.push(`${label}: sourceIds must be unique non-empty strings`);
    if (typeof item.rationale !== "string" || item.rationale.length < 20) issues.push(`${label}: rationale is too short`);
    if (requiredKeys(
      item.candidateInput,
      ["title", "industryEvidence", "affectedPopulation"],
      `${label} candidateInput`,
    )) {
      for (const [key, candidateValue] of Object.entries(item.candidateInput)) {
        if (typeof candidateValue !== "string" || candidateValue.trim().length < 2) {
          issues.push(`${label}: candidateInput.${key} must be non-empty text`);
        }
      }
    }
    if (!canonicalTimestamp(item.reviewedAt)) issues.push(`${label}: reviewedAt must be canonical ISO-8601`);
  }
  const text = JSON.stringify(cases).toLowerCase();
  for (const expected of ["video gaming", "financial services", "energy and utilities", "healthcare", "cloud software", "packaged food", "all industries", "disaster"]) {
    if (!text.includes(expected)) issues.push(`Screen 2 benchmark: missing cross-domain coverage for ${expected}`);
  }
  for (const [label, present] of [
    ["automotive or transportation", cases.some((item) => /automotive|transportation/iu.test(item.industry))],
    ["hospitality or service industry", cases.some((item) => /hospitality|service/iu.test(item.industry))],
    ["eligible private-firm population", cases.some((item) => /private firms?/iu.test(item.population) && item.expectedMaximumClass !== "mismatch")],
    ["Medicare-and-Medicaid mismatch", cases.some((item) => /medicare/iu.test(`${item.candidateId} ${item.rationale}`) && /medicaid/iu.test(`${item.candidateId} ${item.rationale}`) && item.expectedMaximumClass === "mismatch")],
  ]) {
    if (!present) issues.push(`Screen 2 benchmark: missing ${label} coverage`);
  }
  if (!cases.some((item) => item.expectedMaximumClass === "mismatch" && /generic/i.test(item.rationale))) {
    issues.push("Screen 2 benchmark: missing generic-word false-positive control");
  }
}

function validateScreen03(value) {
  const cases = validateEnvelope(
    value,
    "shockaudit-screen03-evidence-confirmability-benchmark-v1",
    "screen03-cross-platform-v1",
    16,
    "Screen 3 benchmark",
  );
  const keys = ["eventId", "claimId", "claimType", "sourcePlatform", "sourceId", "authorityTier", "evidenceBasis", "expectedSupportClass", "expectedConfirmability", "expectedReason", "exactOfficialSupport", "input", "actions", "scenarioTags", "reviewedAt"];
  const identities = new Set();
  const tags = new Set();
  for (const [index, item] of cases.entries()) {
    const label = `Screen 3 case ${index + 1}`;
    if (!requiredKeys(item, keys, label)) continue;
    const identity = `${item.eventId}:${item.claimId}`;
    if (identities.has(identity)) issues.push(`${label}: duplicate event/claim identity`);
    identities.add(identity);
    if (!Number.isInteger(item.authorityTier) || item.authorityTier < 1 || item.authorityTier > 6) issues.push(`${label}: authorityTier must be 1 through 6`);
    if (!strings(item.scenarioTags)) issues.push(`${label}: scenarioTags must be unique non-empty strings`);
    for (const tag of item.scenarioTags ?? []) tags.add(tag);
    if (item.expectedConfirmability !== (item.expectedSupportClass === "direct")) issues.push(`${label}: only direct support may be confirmable`);
    if (item.expectedConfirmability && item.actions?.confirm !== "enabled-and-persists") issues.push(`${label}: confirmable control must enable and persist`);
    if (!item.expectedConfirmability && item.actions?.confirm !== "disabled") issues.push(`${label}: nonconfirmable control must be disabled`);
    if (item.expectedSupportClass === "direct" && !item.exactOfficialSupport) issues.push(`${label}: direct support requires exact official content`);
    const inputKeys = [
      "group", "label", "value", "proposalSupport", "sourceRole",
      "sourcePlatform", "documentType", "evidenceStatus", "passages",
      "conflict", "sourceChange",
    ];
    if (requiredKeys(item.input, inputKeys, `${label} input`)) {
      if (![
        "identity", "overview", "timeline", "component", "eligibility",
        "amendment", "required-variable",
      ].includes(item.input.group)) issues.push(`${label}: input.group is invalid`);
      if (![
        "direct", "indirect", "conflicting", "unsupported",
      ].includes(item.input.proposalSupport)) {
        issues.push(`${label}: input.proposalSupport is invalid`);
      }
      if (![
        "controlling-legal-record", "precursor-official-record",
        "related-official-record", "official-publication-record",
        "administrative-declaration-record", "scientific-hazard-record",
        "institutional-hazard-record", "official-record",
        "related-secondary-record", "researcher-supplied-record",
      ].includes(item.input.sourceRole)) issues.push(`${label}: input.sourceRole is invalid`);
      if (![
        "federal-register", "govinfo", "congress", "us-state-official",
        "eur-lex", "eu-publications", "uk-legislation",
        "national-legislation", "regulatory-agency",
        "official-disaster-repository", "secondary-publisher",
        "researcher-supplied", "other-official", "unknown",
      ].includes(item.input.sourcePlatform)) {
        issues.push(`${label}: input.sourcePlatform is invalid`);
      }
      if (![
        "structured-metadata", "html", "xml", "json", "pdf",
        "plain-text", "official-guidance", "unknown",
      ].includes(item.input.documentType)) {
        issues.push(`${label}: input.documentType is invalid`);
      }
      if (!["retrieved", "changed"].includes(item.input.evidenceStatus)) {
        issues.push(`${label}: input.evidenceStatus is invalid`);
      }
      if (
        typeof item.input.label !== "string" || !item.input.label.trim() ||
        typeof item.input.value !== "string" || !item.input.value.trim() ||
        typeof item.input.conflict !== "boolean" ||
        !Array.isArray(item.input.passages) || item.input.passages.length > 4
      ) {
        issues.push(`${label}: input text, conflict, or passages are invalid`);
      } else {
        item.input.passages.forEach((passage, passageIndex) => {
          const passageLabel = `${label} input passage ${passageIndex + 1}`;
          if (!requiredKeys(
            passage,
            ["text", "basis", "officialField"],
            passageLabel,
          )) return;
          if (typeof passage.text !== "string" || !passage.text.trim()) {
            issues.push(`${passageLabel}: text must be non-empty`);
          }
          if (![
            "source-excerpt", "official-record-field",
            "official-document-passage", "official-guidance-passage",
            "contextual-secondary", "source-metadata",
          ].includes(passage.basis)) issues.push(`${passageLabel}: basis is invalid`);
          if (passage.officialField !== null && ![
            "canonical-title", "common-name", "formal-identifier", "issuer",
            "issuing-jurisdiction", "status", "event-type",
          ].includes(passage.officialField)) {
            issues.push(`${passageLabel}: officialField is invalid`);
          }
        });
      }
      if (
        item.input.conflict !== true &&
        item.input.proposalSupport === "conflicting"
      ) issues.push(`${label}: conflicting support requires input.conflict`);
      if (item.input.conflict === true && item.input.passages?.length < 2) {
        issues.push(`${label}: a conflict requires at least two passages`);
      }
      if (
        !item.input.sourceChange ||
        !requiredKeys(
          item.input.sourceChange,
          ["targetRelation", "preChangeDecision"],
          `${label} input sourceChange`,
        )
      ) {
        // requiredKeys records the exact structural failure.
      } else {
        if (![
          "claim-linked-source", "unlinked-control-source",
        ].includes(item.input.sourceChange.targetRelation)) {
          issues.push(`${label}: input.sourceChange.targetRelation is invalid`);
        }
        if (![
          "accept", "unresolved",
        ].includes(item.input.sourceChange.preChangeDecision)) {
          issues.push(`${label}: input.sourceChange.preChangeDecision is invalid`);
        }
      }
    }
    const actionKeys = ["confirm", "correct", "unresolved", "reject", "restore", "sourceChange", "hostMapping"];
    if (requiredKeys(item.actions, actionKeys, `${label} actions`)) {
      if (item.actions.unresolved !== "available-and-persists" || item.actions.reject !== "available-and-persists") issues.push(`${label}: unresolved and reject decisions must persist`);
      if (item.actions.restore !== "preserves-decision") issues.push(`${label}: restore must preserve the decision`);
    }
    if (!canonicalTimestamp(item.reviewedAt)) issues.push(`${label}: reviewedAt must be canonical ISO-8601`);
  }
  for (const tag of ["gdpr", "ccpa", "us-state-law", "us-federal", "another-eu-instrument", "non-eu-national", "disaster", "structured-metadata", "official-html", "official-xml", "official-json", "official-pdf", "secondary-source-lead", "inaccessible-document", "malformed-document", "changed-source", "unfamiliar-event", "find-to-screen3", "audit-to-screen3", "saved-run-restoration", "wrong-event"]) {
    if (!tags.has(tag)) issues.push(`Screen 3 benchmark: missing scenario tag ${tag}`);
  }
}

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else output.push(path);
  }
  return output;
}

async function verifyProductionIsolation() {
  const forbiddenFragments = [
    "tests/benchmarks",
    "screen02-generalization-v1.json",
    "screen03-evidence-confirmability-v1.json",
  ];
  for (const path of await filesBelow(resolve(root, "src"))) {
    const text = await readFile(path, "utf8");
    for (const fragment of forbiddenFragments) {
      if (text.includes(fragment)) {
        issues.push(`${relative(root, path)}: production code imports or names benchmark-only data (${fragment})`);
      }
    }
  }
}

validateScreen02(await json(screen02Path));
validateScreen03(await json(screen03Path));
await verifyProductionIsolation();

if (issues.length > 0) {
  console.error(`Generalization benchmark gate failed (${issues.length} issue${issues.length === 1 ? "" : "s"}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Validated frozen Screen 2 and Screen 3 generalization benchmarks; production imports remain absent.");
}
