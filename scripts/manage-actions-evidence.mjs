import { constants as fsConstants } from "node:fs";
import {
  appendFile,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const policyPath = resolve(repositoryRoot, "scripts/actions-evidence-policy.json");
export const manifestName = "shockaudit-evidence-manifest.json";
export const summaryName = "shockaudit-evidence-summary.md";
const manifestSchemaVersion = "shockaudit-actions-evidence-manifest-v1";
const shaPattern = /^[0-9a-f]{40}$/u;
const positiveIntegerPattern = /^[1-9][0-9]*$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const bareDigestPattern = /^[0-9a-f]{64}$/u;
const inventoryPageSize = 100;
const inventoryPageLimit = 20;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function json(bytes, label) {
  try {
    return JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeArtifactDigest(value, label = "Artifact digest") {
  const digest = String(value ?? "").toLowerCase();
  if (bareDigestPattern.test(digest)) return `sha256:${digest}`;
  assert(digestPattern.test(digest), `${label} must be a SHA-256 digest.`);
  return digest;
}

function safeRelativePath(value, label = "Evidence path") {
  assert(typeof value === "string" && value.length > 0, `${label} is empty.`);
  assert(!value.includes("\\") && !value.includes("\0"), `${label} contains an unsafe separator.`);
  assert(/^[A-Za-z0-9._/-]+$/u.test(value), `${label} contains unsupported characters.`);
  assert(!value.startsWith("/") && !value.endsWith("/"), `${label} must be a relative file path.`);
  const segments = value.split("/");
  assert(
    segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    `${label} contains traversal or an empty segment.`,
  );
  return value;
}

function within(root, pathname) {
  const rel = relative(resolve(root), resolve(pathname));
  return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep);
}

function resolveEvidencePath(root, relativePath) {
  const safe = safeRelativePath(relativePath);
  const pathname = resolve(root, ...safe.split("/"));
  assert(within(root, pathname), `Evidence path escapes its root: ${safe}.`);
  return pathname;
}

async function requireDirectoryWithoutSymlink(pathname, label) {
  const details = await lstat(pathname);
  assert(details.isDirectory() && !details.isSymbolicLink(), `${label} must be a real directory.`);
  const resolved = await realpath(pathname);
  assert(resolved === resolve(pathname), `${label} must not traverse a symbolic link.`);
}

async function requireSafeFile(root, relativePath) {
  const safe = safeRelativePath(relativePath);
  let current = resolve(root);
  for (const segment of safe.split("/")) {
    current = resolve(current, segment);
    const details = await lstat(current);
    assert(!details.isSymbolicLink(), `Evidence path must not contain a symbolic link: ${safe}.`);
  }
  const details = await lstat(current);
  assert(details.isFile(), `Evidence input must be a regular file: ${safe}.`);
  const handle = await open(
    current,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
  );
  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function optionalSafeFile(root, relativePath) {
  try {
    return await requireSafeFile(root, relativePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

async function walkAllowedTree(sourceRoot, definition) {
  const rootRelative = safeRelativePath(definition.root, "Allowed tree root");
  const rootPath = resolveEvidencePath(sourceRoot, rootRelative);
  let rootDetails;
  try {
    rootDetails = await lstat(rootPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  }
  assert(rootDetails.isDirectory() && !rootDetails.isSymbolicLink(), `Allowed tree must be a real directory: ${rootRelative}.`);
  const pattern = new RegExp(definition.fileNamePattern, "u");
  const files = [];
  async function visit(directoryPath, directoryRelative) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = `${directoryRelative}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error(`Allowed evidence tree contains a symbolic link: ${relativePath}.`);
      }
      if (entry.isDirectory()) {
        await visit(resolve(directoryPath, entry.name), relativePath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(relativePath);
      }
    }
  }
  await visit(rootPath, rootRelative);
  return files;
}

function validateEvidencePolicy(policy) {
  assert(policy.schemaVersion === "shockaudit-actions-evidence-policy-v1", "Actions evidence policy schema is unsupported.");
  assert(policy.repository === "AINP-Research/ShockAudit", "Actions evidence policy repository is invalid.");
  assert(
    policy.inventory?.warningBytes === 100 * 1024 * 1024 &&
      policy.inventory?.targetCeilingBytes === 150 * 1024 * 1024,
    "Actions evidence repository inventory targets are invalid.",
  );
  assert(
    policy.markers?.finalCandidate === "<!-- shockaudit-final-candidate-evidence:v0.6.2 -->" &&
      policy.markers?.activeDiagnostics === "<!-- shockaudit-active-diagnostics:{sha} -->",
    "Actions evidence workflow markers are invalid.",
  );
  assert(
    policy.profiles &&
      JSON.stringify(Object.keys(policy.profiles).sort()) ===
        JSON.stringify(["diagnostics", "live", "matrix", "release"]),
    "Actions evidence profiles are missing or unexpected.",
  );
  for (const [name, profile] of Object.entries(policy.profiles)) {
    assert(
      Number.isSafeInteger(profile.softLimitBytes) &&
        Number.isSafeInteger(profile.hardLimitBytes) &&
        profile.softLimitBytes > 0 &&
        profile.softLimitBytes <= profile.hardLimitBytes,
      `${name} evidence size budget is invalid.`,
    );
    assert(
      Array.isArray(profile.retentionDays) &&
        profile.retentionDays.length > 0 &&
        profile.retentionDays.every((days) => Number.isSafeInteger(days) && days > 0),
      `${name} evidence retention is invalid.`,
    );
    const declaredPaths = [
      ...(profile.requiredFiles ?? []),
      ...(profile.optionalFiles ?? []),
      ...(profile.caseFiles ?? []),
    ];
    declaredPaths.forEach((pathname) => safeRelativePath(pathname, `${name} policy path`));
    assert(new Set(declaredPaths).size === declaredPaths.length, `${name} evidence policy repeats a file path.`);
    for (const tree of profile.allowedTrees ?? []) {
      safeRelativePath(tree.root, `${name} allowed tree`);
      assert(typeof tree.fileNamePattern === "string", `${name} allowed tree pattern is missing.`);
      new RegExp(tree.fileNamePattern, "u");
    }
  }
  return policy;
}

export async function readEvidencePolicy() {
  return validateEvidencePolicy(
    json(await readFile(policyPath), "Actions evidence policy"),
  );
}

function normalizeOptions(options, policy) {
  const profile = String(options.profile ?? "");
  const profilePolicy = policy.profiles[profile];
  assert(profilePolicy, `Unknown Actions evidence profile: ${profile || "(empty)"}.`);
  const expectedSha = String(options.expectedSha ?? "").toLowerCase();
  assert(shaPattern.test(expectedSha), "Expected evidence SHA must be a full lowercase 40-hex commit.");
  const repository = String(options.repository ?? "");
  assert(repository === policy.repository, `Evidence repository must be ${policy.repository}.`);
  const runId = String(options.runId ?? "");
  const runAttempt = String(options.runAttempt ?? "");
  assert(positiveIntegerPattern.test(runId), "Actions run ID must be a positive integer.");
  assert(positiveIntegerPattern.test(runAttempt), "Actions run attempt must be a positive integer.");
  const retentionDays = Number(options.retentionDays);
  assert(
    Number.isSafeInteger(retentionDays) && profilePolicy.retentionDays.includes(retentionDays),
    `Retention ${options.retentionDays} is not permitted for ${profile}.`,
  );
  const finalCandidateSha = options.finalCandidateSha == null
    ? null
    : String(options.finalCandidateSha).toLowerCase();
  const activeDiagnosticsSha = options.activeDiagnosticsSha == null || options.activeDiagnosticsSha === ""
    ? null
    : String(options.activeDiagnosticsSha).toLowerCase();
  if (profile === "release") {
    assert(finalCandidateSha === expectedSha, "Release evidence requires the exact final-candidate SHA marker.");
  } else {
    assert(finalCandidateSha === null, "Only release evidence accepts a final-candidate SHA marker.");
  }
  if (profile === "diagnostics" && retentionDays === 7) {
    assert(activeDiagnosticsSha === expectedSha, "Seven-day diagnostics require the exact active-investigation SHA marker.");
  } else {
    assert(activeDiagnosticsSha === null, "An active diagnostics marker is valid only for seven-day diagnostics.");
  }
  return {
    ...options,
    profile,
    profilePolicy,
    expectedSha,
    repository,
    runId,
    runAttempt,
    retentionDays,
    finalCandidateSha,
    activeDiagnosticsSha,
  };
}

function requireCommitInJson(bytes, relativePath, expectedSha) {
  const value = json(bytes, relativePath);
  const observed = value.exactHeadCommit ?? value.expectedCommit;
  assert(observed === expectedSha, `${relativePath} is not bound to exact commit ${expectedSha}.`);
  return value;
}

function allAttachments(report) {
  const attachments = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (Array.isArray(value.attachments)) attachments.push(...value.attachments);
    Object.values(value).forEach(visit);
  };
  visit(report);
  return attachments;
}

function decodedBase64(body, label) {
  assert(typeof body === "string" && body.length > 0, `${label} has no embedded bytes.`);
  const bytes = Buffer.from(body, "base64");
  assert(bytes.length > 0, `${label} decodes to an empty file.`);
  const canonical = body.replace(/=+$/u, "");
  assert(bytes.toString("base64").replace(/=+$/u, "") === canonical, `${label} is not canonical base64.`);
  return bytes;
}

function extractAxeEvidence(payloads) {
  const reportPath = "test-results/playwright-results.json";
  const inventoryPath = "tests/browser/release-gate-inventory.json";
  const report = json(payloads.get(reportPath), reportPath);
  const inventory = json(payloads.get(inventoryPath), inventoryPath);
  assert(Array.isArray(inventory.tests), "Browser release inventory has no tests.");
  const expectedNames = inventory.tests.flatMap((test) => test.axeAttachments ?? []);
  assert(expectedNames.length > 0, "Release evidence requires at least one named Axe JSON file.");
  assert(
    new Set(expectedNames).size === expectedNames.length,
    "Release evidence requires uniquely named Axe JSON files.",
  );
  const expected = new Set(expectedNames);
  const found = new Map();
  for (const attachment of allAttachments(report)) {
    if (!attachment || typeof attachment !== "object" || !expected.has(attachment.name)) continue;
    assert(!found.has(attachment.name), `Playwright report repeats Axe attachment ${attachment.name}.`);
    const bytes = decodedBase64(attachment.body, `Axe attachment ${attachment.name}`);
    json(bytes, `Axe attachment ${attachment.name}`);
    found.set(attachment.name, bytes);
  }
  assert(found.size === expected.size, `Playwright report retained ${found.size}/${expected.size} required Axe JSON files.`);
  return [...found.entries()].map(([name, bytes]) => ({
    path: `artifacts/release-gates/axe/${safeRelativePath(name, "Axe attachment name")}`,
    bytes,
    kind: "derived-axe-json",
  }));
}

function compactPlaywrightReport(payloads, axeEntries) {
  const reportPath = "test-results/playwright-results.json";
  const sourceBytes = payloads.get(reportPath);
  const report = json(sourceBytes, reportPath);
  assert(report._shockauditEvidenceCompaction === undefined, "Playwright report is already compacted.");
  const axeByName = new Map(
    axeEntries.map((entry) => [entry.path.split("/").at(-1), entry.bytes]),
  );
  let extractedAxeAttachmentCount = 0;
  let omittedNonRequiredAttachmentBodies = 0;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (Array.isArray(value.attachments)) {
      for (const attachment of value.attachments) {
        if (!attachment || typeof attachment !== "object") continue;
        if (typeof attachment.body === "string") {
          const bytes = decodedBase64(attachment.body, `Playwright attachment ${attachment.name ?? "(unnamed)"}`);
          attachment.bodySha256 = `sha256:${sha256(bytes)}`;
          attachment.bodySizeBytes = bytes.length;
          delete attachment.body;
          if (axeByName.has(attachment.name)) {
            assert(axeByName.get(attachment.name).equals(bytes), `Extracted Axe bytes changed for ${attachment.name}.`);
            extractedAxeAttachmentCount += 1;
          } else {
            omittedNonRequiredAttachmentBodies += 1;
          }
        }
        if (typeof attachment.path === "string") {
          delete attachment.path;
          attachment.pathAttachmentOmitted = true;
        }
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(report);
  assert(extractedAxeAttachmentCount === axeByName.size, "Not every required Axe body was extracted from the Playwright report.");
  report._shockauditEvidenceCompaction = {
    schemaVersion: "shockaudit-playwright-evidence-compaction-v1",
    sourceReportSha256: `sha256:${sha256(sourceBytes)}`,
    extractedAxeAttachmentCount,
    omittedNonRequiredAttachmentBodies,
  };
  return Buffer.from(`${JSON.stringify(report)}\n`);
}

function verifyCompactedPlaywrightReport(payloads) {
  const reportPath = "test-results/playwright-results.json";
  const report = json(payloads.get(reportPath), reportPath);
  const inventory = json(
    payloads.get("tests/browser/release-gate-inventory.json"),
    "tests/browser/release-gate-inventory.json",
  );
  const expectedNames = new Set(inventory.tests.flatMap((test) => test.axeAttachments ?? []));
  const compaction = report._shockauditEvidenceCompaction;
  assert(
    compaction?.schemaVersion === "shockaudit-playwright-evidence-compaction-v1" &&
      compaction.extractedAxeAttachmentCount === expectedNames.size &&
      /^sha256:[0-9a-f]{64}$/u.test(compaction.sourceReportSha256),
    "Compacted Playwright report has an invalid source/report binding.",
  );
  const exactHead = json(
    payloads.get("artifacts/release-gates/exact-head.json"),
    "artifacts/release-gates/exact-head.json",
  );
  assert(
    exactHead?.playwrightEvidence?.reportSha256 === compaction.sourceReportSha256,
    "Compacted Playwright report does not match the report validated by exact-HEAD evidence.",
  );
  const foundAxe = new Set();
  for (const attachment of allAttachments(report)) {
    assert(attachment?.body === undefined && attachment?.path === undefined, "Compacted Playwright report retained duplicate attachment bytes or paths.");
    if (!expectedNames.has(attachment?.name)) continue;
    assert(!foundAxe.has(attachment.name), `Compacted Playwright report repeats ${attachment.name}.`);
    const axePath = `artifacts/release-gates/axe/${attachment.name}`;
    const bytes = payloads.get(axePath);
    assert(
      Buffer.isBuffer(bytes) &&
        attachment.bodySizeBytes === bytes.length &&
        attachment.bodySha256 === `sha256:${sha256(bytes)}`,
      `Compacted Playwright metadata does not match extracted Axe bytes for ${attachment.name}.`,
    );
    json(bytes, axePath);
    foundAxe.add(attachment.name);
  }
  assert(foundAxe.size === expectedNames.size, `Compacted release evidence retained ${foundAxe.size}/${expectedNames.size} Axe files.`);
  return report;
}

function verifyReleaseScreenshotChecksums(payloads, requiredFiles) {
  const checksumPath = "artifacts/release-gates/browser-success-screenshots.sha256";
  const text = payloads.get(checksumPath)?.toString("utf8") ?? "";
  const pngPaths = requiredFiles.filter((pathname) => pathname.endsWith(".png"));
  const expected = new Map(pngPaths.map((pathname) => [pathname.split("/").at(-1), pathname]));
  const observed = new Map();
  for (const line of text.trim().split("\n")) {
    const match = line.match(/^([0-9a-f]{64}) {2}([^/]+\.png)$/u);
    assert(match, "Curated screenshot checksum file has an unsafe or malformed entry.");
    assert(expected.has(match[2]) && !observed.has(match[2]), `Curated screenshot checksum has an unexpected or duplicate file: ${match[2]}.`);
    observed.set(match[2], match[1]);
  }
  assert(observed.size === expected.size, `Curated screenshot checksum retained ${observed.size}/${expected.size} files.`);
  for (const [name, pathname] of expected) {
    assert(observed.get(name) === sha256(payloads.get(pathname)), `Curated screenshot checksum does not match ${name}.`);
  }
}

function validateContentBindings(profile, payloads, options) {
  if (profile === "release") {
    const exactHead = requireCommitInJson(payloads.get("artifacts/release-gates/exact-head.json"), "artifacts/release-gates/exact-head.json", options.expectedSha);
    const reportBytes = payloads.get("test-results/playwright-results.json");
    const inventoryBytes = payloads.get("tests/browser/release-gate-inventory.json");
    const smokeBytes = payloads.get("artifacts/release-gates/wrangler-smoke-results.json");
    const report = json(reportBytes, "test-results/playwright-results.json");
    assert(
      String(exactHead.runId) === options.runId &&
        String(exactHead.runAttempt) === options.runAttempt,
      "Exact-HEAD release evidence is not bound to the current Actions run/attempt.",
    );
    assert(
      exactHead?.playwrightEvidence?.inventorySha256 === `sha256:${sha256(inventoryBytes)}`,
      "Browser inventory bytes differ from the inventory validated by exact-HEAD evidence.",
    );
    assert(
      exactHead?.playwrightEvidence?.wranglerSmokeReportSha256 === `sha256:${sha256(smokeBytes)}`,
      "Wrangler smoke bytes differ from the report validated by exact-HEAD evidence.",
    );
    assert(report?.config?.metadata?.shockauditExactHeadCommit === options.expectedSha, "Playwright evidence is not bound to the exact release SHA.");
    if (report._shockauditEvidenceCompaction) {
      verifyCompactedPlaywrightReport(payloads);
    } else {
      assert(
        exactHead?.playwrightEvidence?.reportSha256 === `sha256:${sha256(reportBytes)}`,
        "Playwright report bytes differ from the report validated by exact-HEAD evidence.",
      );
    }
    const smoke = json(smokeBytes, "artifacts/release-gates/wrangler-smoke-results.json");
    assert(smoke?.config?.metadata?.shockauditExactHeadCommit === options.expectedSha, "Wrangler smoke evidence is not bound to the exact release SHA.");
    verifyReleaseScreenshotChecksums(payloads, options.profilePolicy.requiredFiles);
  } else if (profile === "live") {
    requireCommitInJson(payloads.get("artifacts/stage6-live/verify-live-mcp.json"), "artifacts/stage6-live/verify-live-mcp.json", options.expectedSha);
  } else if (profile === "matrix") {
    const summary = json(
      payloads.get("artifacts/production-matrix/matrix-summary.json"),
      "artifacts/production-matrix/matrix-summary.json",
    );
    const retainedCasePaths = options.profilePolicy.caseFiles.filter(
      (pathname) => payloads.has(pathname),
    );
    if (summary.status === "passed") {
      assert(
        retainedCasePaths.length === options.profilePolicy.caseFiles.length,
        `Passed production matrix evidence requires all ${options.profilePolicy.caseFiles.length} case files.`,
      );
    } else {
      assert(
        summary.status === "failed" || summary.status === "running",
        "Production matrix summary has an unsupported evidence status.",
      );
    }
    for (const pathname of [
      ...options.profilePolicy.requiredFiles,
      ...retainedCasePaths,
    ]) {
      const value = requireCommitInJson(payloads.get(pathname), pathname, options.expectedSha);
      if (pathname.includes("/cases/")) {
        assert(
          value.caseId === pathname.split("/").at(-1).replace(/\.json$/u, ""),
          `${pathname} does not contain its allowlisted case identity.`,
        );
        if (summary.status === "passed") {
          assert(value.status === "passed", `${pathname} is not a passed case in passed matrix evidence.`);
        }
      }
    }
    if (summary.status === "passed") {
      const expectedCaseIds = options.profilePolicy.caseFiles.map(
        (pathname) => pathname.split("/").at(-1).replace(/\.json$/u, ""),
      );
      const summaryCaseIds = Array.isArray(summary.cases)
        ? summary.cases.map((item) => item?.caseId)
        : [];
      assert(
        summary.passedCount === expectedCaseIds.length &&
          summary.failedCount === 0 &&
          JSON.stringify([...summaryCaseIds].sort()) === JSON.stringify([...expectedCaseIds].sort()),
        "Passed production matrix summary does not account for every allowlisted case.",
      );
    }
  }
}

async function gatherPayloads(options) {
  const payloads = new Map();
  for (const pathname of options.profilePolicy.requiredFiles ?? []) {
    payloads.set(pathname, await requireSafeFile(options.sourceRoot, pathname));
  }
  for (const pathname of options.profilePolicy.optionalFiles ?? []) {
    const bytes = await optionalSafeFile(options.sourceRoot, pathname);
    if (bytes !== null) payloads.set(pathname, bytes);
  }
  for (const pathname of options.profilePolicy.caseFiles ?? []) {
    const bytes = await optionalSafeFile(options.sourceRoot, pathname);
    if (bytes !== null) payloads.set(pathname, bytes);
  }
  for (const definition of options.profilePolicy.allowedTrees ?? []) {
    for (const pathname of await walkAllowedTree(options.sourceRoot, definition)) {
      if (!payloads.has(pathname)) {
        payloads.set(pathname, await requireSafeFile(options.sourceRoot, pathname));
      }
    }
  }
  assert(
    payloads.size >= (options.profilePolicy.minimumFileCount ?? 0),
    `${options.profile} evidence has no relevant files to retain.`,
  );
  validateContentBindings(options.profile, payloads, options);
  if (options.profilePolicy.extractAxeAttachments) {
    const axeEntries = extractAxeEvidence(payloads);
    payloads.set(
      "test-results/playwright-results.json",
      compactPlaywrightReport(payloads, axeEntries),
    );
    for (const entry of axeEntries) payloads.set(entry.path, entry.bytes);
  }
  return payloads;
}

async function writePayload(stageRoot, pathname, bytes) {
  const destination = resolveEvidencePath(stageRoot, pathname);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  const written = await requireSafeFile(stageRoot, pathname);
  assert(written.equals(bytes), `Staged evidence changed while writing ${pathname}.`);
}

function summaryText(manifest) {
  const budgetLabel = manifest.budget.status === "within-soft-limit"
    ? "within the soft target"
    : "above the soft target (retained as a bounded justified exception)";
  return [
    "## ShockAudit Actions evidence",
    "",
    `- Profile: \`${manifest.profile}\``,
    `- Exact commit: \`${manifest.binding.expectedSha}\``,
    `- Actions run/attempt: \`${manifest.binding.runId}/${manifest.binding.runAttempt}\``,
    `- Files: ${manifest.fileCount}`,
    `- Prepared bytes: ${manifest.preparedBytes} (${budgetLabel})`,
    `- Hard limit: ${manifest.budget.hardLimitBytes} bytes`,
    `- Retention: ${manifest.retentionDays} days`,
    "",
  ].join("\n");
}

async function writeMetadata(stageRoot, baseManifest) {
  let preparedBytes = baseManifest.payloadBytes;
  let manifest;
  let summary;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = preparedBytes <= baseManifest.budget.softLimitBytes
      ? "within-soft-limit"
      : "soft-limit-exceeded";
    manifest = {
      ...baseManifest,
      preparedBytes,
      budget: { ...baseManifest.budget, status },
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    summary = summaryText(manifest);
    const next = baseManifest.payloadBytes + manifestBytes.length + Buffer.byteLength(summary);
    if (next === preparedBytes) {
      await writeFile(resolveEvidencePath(stageRoot, manifestName), manifestBytes, { flag: "wx", mode: 0o600 });
      await writeFile(resolveEvidencePath(stageRoot, summaryName), summary, { flag: "wx", mode: 0o600 });
      return manifest;
    }
    preparedBytes = next;
  }
  throw new Error("Evidence metadata size did not stabilize.");
}

async function appendSummary(summaryPath, text) {
  if (!summaryPath) return;
  await appendFile(summaryPath, text, "utf8");
}

export async function prepareEvidence(rawOptions) {
  const policy = validateEvidencePolicy(
    rawOptions.policy ?? await readEvidencePolicy(),
  );
  const options = normalizeOptions(rawOptions, policy);
  const sourceRoot = resolve(options.sourceRoot ?? repositoryRoot);
  const runnerTemp = resolve(options.runnerTemp ?? "");
  const stageRoot = resolve(options.stageRoot ?? "");
  assert(options.runnerTemp && options.stageRoot, "Runner temp and evidence stage root are required.");
  await requireDirectoryWithoutSymlink(sourceRoot, "Evidence source root");
  await requireDirectoryWithoutSymlink(runnerTemp, "RUNNER_TEMP");
  assert(within(runnerTemp, stageRoot), "Evidence stage root must be a dedicated child of RUNNER_TEMP.");
  try {
    await lstat(stageRoot);
    throw new Error("Evidence stage root must not already exist.");
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) throw error;
  }
  const normalized = { ...options, sourceRoot, runnerTemp, stageRoot };
  await mkdir(stageRoot, { recursive: false, mode: 0o700 });
  try {
    const payloads = await gatherPayloads(normalized);
    const entries = [];
    for (const [pathname, bytes] of [...payloads.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      await writePayload(stageRoot, pathname, bytes);
      entries.push({
        path: pathname,
        sizeBytes: bytes.length,
        sha256: `sha256:${sha256(bytes)}`,
      });
    }
    const payloadBytes = entries.reduce((total, entry) => total + entry.sizeBytes, 0);
    assert(payloadBytes <= normalized.profilePolicy.hardLimitBytes, `${normalized.profile} evidence payload exceeds its ${normalized.profilePolicy.hardLimitBytes}-byte hard limit.`);
    const baseManifest = {
      schemaVersion: manifestSchemaVersion,
      repository: normalized.repository,
      profile: normalized.profile,
      generatedAt: new Date().toISOString(),
      binding: {
        expectedSha: normalized.expectedSha,
        runId: normalized.runId,
        runAttempt: normalized.runAttempt,
        ...(normalized.finalCandidateSha ? { finalCandidateSha: normalized.finalCandidateSha } : {}),
        ...(normalized.activeDiagnosticsSha ? { activeDiagnosticsSha: normalized.activeDiagnosticsSha } : {}),
      },
      retentionDays: normalized.retentionDays,
      fileCount: entries.length,
      payloadBytes,
      budget: {
        softLimitBytes: normalized.profilePolicy.softLimitBytes,
        hardLimitBytes: normalized.profilePolicy.hardLimitBytes,
      },
      files: entries,
    };
    const manifest = await writeMetadata(stageRoot, baseManifest);
    assert(manifest.preparedBytes <= normalized.profilePolicy.hardLimitBytes, `${normalized.profile} prepared evidence exceeds its hard limit after metadata.`);
    await appendSummary(normalized.summaryPath, summaryText(manifest));
    return { stageRoot, manifest };
  } catch (error) {
    await rm(stageRoot, { recursive: true, force: true });
    throw error;
  }
}

async function walkAllFiles(root) {
  const files = [];
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const pathname = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Downloaded evidence contains a symbolic link: ${pathname}.`);
      if (entry.isDirectory()) await visit(resolve(directory, entry.name), pathname);
      else if (entry.isFile()) files.push(pathname);
      else throw new Error(`Downloaded evidence contains a non-regular entry: ${pathname}.`);
    }
  }
  await visit(root);
  return files.sort();
}

function allowedDiagnosticPath(pathname, profilePolicy) {
  if ((profilePolicy.optionalFiles ?? []).includes(pathname)) return true;
  return (profilePolicy.allowedTrees ?? []).some((definition) => {
    const prefix = `${definition.root}/`;
    return pathname.startsWith(prefix) && new RegExp(definition.fileNamePattern, "u").test(pathname.split("/").at(-1));
  });
}

function expectedPayloadPaths(profile, profilePolicy, payloads) {
  if (profile === "diagnostics") {
    const paths = [...payloads.keys()];
    assert(paths.length >= (profilePolicy.minimumFileCount ?? 0), "Downloaded diagnostics contain no relevant evidence files.");
    assert(paths.every((pathname) => allowedDiagnosticPath(pathname, profilePolicy)), "Downloaded diagnostics contain a file outside the policy allowlist.");
    return paths.sort();
  }
  const expected = [...(profilePolicy.requiredFiles ?? [])];
  for (const pathname of profilePolicy.caseFiles ?? []) {
    if (payloads.has(pathname)) expected.push(pathname);
  }
  if (profilePolicy.extractAxeAttachments) {
    const inventory = json(payloads.get("tests/browser/release-gate-inventory.json"), "Browser release inventory");
    for (const test of inventory.tests ?? []) {
      for (const name of test.axeAttachments ?? []) expected.push(`artifacts/release-gates/axe/${name}`);
    }
  }
  return expected.sort();
}

export async function verifyEvidence(rawOptions) {
  const policy = validateEvidencePolicy(
    rawOptions.policy ?? await readEvidencePolicy(),
  );
  const options = normalizeOptions(rawOptions, policy);
  const runnerTemp = resolve(options.runnerTemp ?? "");
  const stageRoot = resolve(options.stageRoot ?? "");
  assert(options.runnerTemp && options.stageRoot, "Runner temp and downloaded evidence root are required.");
  await requireDirectoryWithoutSymlink(runnerTemp, "RUNNER_TEMP");
  assert(within(runnerTemp, stageRoot), "Downloaded evidence root must be a dedicated child of RUNNER_TEMP.");
  await requireDirectoryWithoutSymlink(stageRoot, "Downloaded evidence root");
  const manifestBytes = await requireSafeFile(stageRoot, manifestName);
  const manifest = json(manifestBytes, "Downloaded evidence manifest");
  assert(manifest.schemaVersion === manifestSchemaVersion, "Downloaded evidence manifest schema is unsupported.");
  assert(
    typeof manifest.generatedAt === "string" &&
      new Date(manifest.generatedAt).toISOString() === manifest.generatedAt,
    "Downloaded evidence manifest timestamp is invalid.",
  );
  assert(manifest.repository === options.repository && manifest.profile === options.profile, "Downloaded evidence profile or repository changed.");
  assert(manifest.retentionDays === options.retentionDays, "Downloaded evidence retention binding changed.");
  assert(
    manifest.binding?.expectedSha === options.expectedSha &&
      manifest.binding?.runId === options.runId &&
      manifest.binding?.runAttempt === options.runAttempt,
    "Downloaded evidence SHA/run/attempt binding changed.",
  );
  if (options.profile === "release") {
    assert(manifest.binding.finalCandidateSha === options.expectedSha, "Downloaded release evidence lost its final-candidate binding.");
  }
  if (options.profile === "diagnostics" && options.retentionDays === 7) {
    assert(manifest.binding.activeDiagnosticsSha === options.expectedSha, "Downloaded diagnostics lost their active-investigation binding.");
  }
  assert(Array.isArray(manifest.files) && manifest.files.length === manifest.fileCount, "Downloaded evidence manifest file count changed.");
  const payloads = new Map();
  let payloadBytes = 0;
  for (const entry of manifest.files) {
    const pathname = safeRelativePath(entry?.path, "Manifest evidence path");
    assert(!payloads.has(pathname), `Downloaded evidence manifest repeats ${pathname}.`);
    const bytes = await requireSafeFile(stageRoot, pathname);
    assert(bytes.length === entry.sizeBytes, `Downloaded evidence size changed for ${pathname}.`);
    assert(`sha256:${sha256(bytes)}` === entry.sha256, `Downloaded evidence checksum changed for ${pathname}.`);
    payloads.set(pathname, bytes);
    payloadBytes += bytes.length;
  }
  const expected = expectedPayloadPaths(options.profile, options.profilePolicy, payloads);
  assert(JSON.stringify([...payloads.keys()].sort()) === JSON.stringify(expected), "Downloaded evidence has a missing or unexpected allowlisted payload file.");
  const allFiles = await walkAllFiles(stageRoot);
  const permitted = [...expected, manifestName, summaryName].sort();
  assert(JSON.stringify(allFiles) === JSON.stringify(permitted), "Downloaded evidence contains a missing or extra file.");
  assert(payloadBytes === manifest.payloadBytes, "Downloaded evidence payload byte total changed.");
  const summaryBytes = await requireSafeFile(stageRoot, summaryName);
  assert(
    summaryBytes.equals(Buffer.from(summaryText(manifest))),
    "Downloaded evidence summary changed.",
  );
  const preparedBytes = (await Promise.all(allFiles.map(async (pathname) => (await stat(resolveEvidencePath(stageRoot, pathname))).size)))
    .reduce((total, size) => total + size, 0);
  assert(preparedBytes === manifest.preparedBytes, "Downloaded evidence prepared byte total changed.");
  assert(
    manifest.budget?.softLimitBytes === options.profilePolicy.softLimitBytes &&
      manifest.budget?.hardLimitBytes === options.profilePolicy.hardLimitBytes &&
      manifest.budget?.status === (
        preparedBytes <= options.profilePolicy.softLimitBytes
          ? "within-soft-limit"
          : "soft-limit-exceeded"
      ) &&
      preparedBytes <= options.profilePolicy.hardLimitBytes,
    "Downloaded evidence budget binding changed or exceeds the hard limit.",
  );
  validateContentBindings(options.profile, payloads, options);
  await appendSummary(options.summaryPath, `${summaryText(manifest)}- Download verification: exact file inventory and SHA-256 bytes passed.\n\n`);
  return { stageRoot, manifest };
}

function inventoryStatus(retainedBytes, policy) {
  if (retainedBytes >= policy.inventory.targetCeilingBytes) {
    return "ceiling-exceeded";
  }
  if (retainedBytes >= policy.inventory.warningBytes) return "warning";
  return "within-target";
}

async function githubJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  assert(response.ok, `GitHub artifact inventory request failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error("GitHub artifact inventory response is not valid JSON.");
  }
}

export async function reportArtifactInventory(rawOptions) {
  const policy = validateEvidencePolicy(
    rawOptions.policy ?? await readEvidencePolicy(),
  );
  const repository = String(rawOptions.repository ?? "");
  const expectedSha = String(rawOptions.expectedSha ?? "").toLowerCase();
  const runId = String(rawOptions.runId ?? "");
  const uploadedArtifactId = String(rawOptions.uploadedArtifactId ?? "");
  const uploadedArtifactName = String(rawOptions.uploadedArtifactName ?? "");
  const uploadedArtifactDigest = normalizeArtifactDigest(
    rawOptions.uploadedArtifactDigest,
    "Uploaded artifact digest",
  );
  const token = String(rawOptions.token ?? "");
  assert(repository === policy.repository, `Artifact inventory repository must be ${policy.repository}.`);
  assert(shaPattern.test(expectedSha), "Artifact inventory SHA must be a full lowercase 40-hex commit.");
  assert(positiveIntegerPattern.test(runId), "Artifact inventory run ID must be a positive integer.");
  assert(positiveIntegerPattern.test(uploadedArtifactId), "Uploaded artifact ID must be a positive integer.");
  assert(uploadedArtifactName.length > 0 && uploadedArtifactName.length <= 255, "Uploaded artifact name is invalid.");
  assert(token.length > 0, "GITHUB_TOKEN is required for the read-only artifact inventory.");

  const fetchImpl = rawOptions.fetchImpl ?? fetch;
  const artifacts = [];
  let totalCount = null;
  for (let page = 1; page <= inventoryPageLimit; page += 1) {
    const url = `https://api.github.com/repos/${repository}/actions/artifacts?per_page=${inventoryPageSize}&page=${page}`;
    const value = await githubJson(url, token, fetchImpl);
    assert(Number.isSafeInteger(value?.total_count) && value.total_count >= 0, "GitHub artifact inventory has an invalid total count.");
    assert(Array.isArray(value.artifacts), "GitHub artifact inventory has no artifact list.");
    if (totalCount === null) totalCount = value.total_count;
    else assert(value.total_count === totalCount, "GitHub artifact inventory changed during bounded pagination.");
    artifacts.push(...value.artifacts);
    if (artifacts.length >= value.total_count || value.artifacts.length < inventoryPageSize) break;
    if (page === inventoryPageLimit) {
      throw new Error(`GitHub artifact inventory exceeds the ${inventoryPageLimit * inventoryPageSize}-artifact bounded pagination limit.`);
    }
  }

  const byId = new Map();
  for (const artifact of artifacts) {
    const id = String(artifact?.id ?? "");
    assert(positiveIntegerPattern.test(id), "GitHub artifact inventory contains an invalid artifact ID.");
    assert(!byId.has(id), `GitHub artifact inventory repeats artifact ${id}.`);
    assert(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes >= 0, `GitHub artifact ${id} has an invalid size.`);
    assert(typeof artifact.expired === "boolean", `GitHub artifact ${id} has no expiration status.`);
    byId.set(id, artifact);
  }
  assert(byId.size === totalCount, `GitHub artifact inventory returned ${byId.size}/${totalCount} artifacts.`);

  const uploaded = byId.get(uploadedArtifactId);
  assert(uploaded && uploaded.expired === false, "The just-uploaded evidence artifact is absent or expired in the repository inventory.");
  assert(
    uploaded.name === uploadedArtifactName &&
      uploaded.digest === uploadedArtifactDigest &&
      String(uploaded.workflow_run?.id) === runId &&
      uploaded.workflow_run?.head_sha === expectedSha,
    "The repository inventory does not bind the uploaded artifact to its exact name/digest/run/SHA.",
  );

  const retained = [...byId.values()].filter((artifact) => artifact.expired === false);
  const retainedBytes = retained.reduce((total, artifact) => total + artifact.size_in_bytes, 0);
  const status = inventoryStatus(retainedBytes, policy);
  const result = {
    repository,
    retainedArtifactCount: retained.length,
    retainedBytes,
    warningBytes: policy.inventory.warningBytes,
    targetCeilingBytes: policy.inventory.targetCeilingBytes,
    status,
  };
  await appendSummary(
    rawOptions.summaryPath,
    [
      "## Repository artifact inventory",
      "",
      `- Current non-expired artifacts: ${result.retainedArtifactCount}`,
      `- API-reported retained bytes: ${result.retainedBytes}`,
      `- Policy status: \`${result.status}\``,
      "",
    ].join("\n"),
  );
  return result;
}

function parseCli(argv) {
  const [command, ...tokens] = argv;
  assert(
    command === "prepare" || command === "verify" || command === "report-inventory",
    "Usage: manage-actions-evidence.mjs <prepare|verify|report-inventory> [options].",
  );
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    assert(key?.startsWith("--") && value !== undefined, `Invalid evidence option near ${key ?? "(end)"}.`);
    const camel = key.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    assert([
      "profile", "sourceRoot", "stageRoot", "runnerTemp", "expectedSha",
      "repository", "runId", "runAttempt", "retentionDays",
      "finalCandidateSha", "activeDiagnosticsSha", "summaryPath",
      "uploadedArtifactId", "uploadedArtifactName", "uploadedArtifactDigest",
    ].includes(camel), `Unknown evidence option: ${key}.`);
    assert(values[camel] === undefined, `Duplicate evidence option: ${key}.`);
    values[camel] = value;
  }
  return { command, values };
}

async function writeOutputs(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `stage_root=${result.stageRoot}`,
      `retention_days=${result.manifest.retentionDays}`,
      `prepared_bytes=${result.manifest.preparedBytes}`,
      `budget_status=${result.manifest.budget.status}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, values } = parseCli(process.argv.slice(2));
    const options = {
      ...values,
      sourceRoot: values.sourceRoot ?? process.env.GITHUB_WORKSPACE,
      runnerTemp: values.runnerTemp ?? process.env.RUNNER_TEMP,
      expectedSha: values.expectedSha ?? process.env.SHOCKAUDIT_EXPECTED_COMMIT,
      repository: values.repository ?? process.env.GITHUB_REPOSITORY,
      runId: values.runId ?? process.env.GITHUB_RUN_ID,
      runAttempt: values.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT,
      summaryPath: values.summaryPath ?? process.env.GITHUB_STEP_SUMMARY,
    };
    if (command === "report-inventory") {
      const result = await reportArtifactInventory({
        ...options,
        token: process.env.GITHUB_TOKEN,
        uploadedArtifactId: values.uploadedArtifactId ?? process.env.SHOCKAUDIT_ARTIFACT_ID,
        uploadedArtifactName: values.uploadedArtifactName ?? process.env.SHOCKAUDIT_ARTIFACT_NAME,
        uploadedArtifactDigest: values.uploadedArtifactDigest ?? process.env.SHOCKAUDIT_ARTIFACT_DIGEST,
      });
      if (result.status !== "within-target") {
        console.warn(
          `::warning title=ShockAudit repository artifact inventory::${result.retainedBytes} retained bytes; warning ${result.warningBytes}; engineering ceiling ${result.targetCeilingBytes}.`,
        );
      }
      if (result.status === "ceiling-exceeded") {
        throw new Error(`Repository artifact inventory exceeds the ${result.targetCeilingBytes}-byte engineering ceiling; reviewed capacity action is required.`);
      }
      console.log(`Reported repository artifact inventory: ${result.retainedArtifactCount} artifacts, ${result.retainedBytes} bytes (${result.status}).`);
    } else {
      const result = command === "prepare"
        ? await prepareEvidence(options)
        : await verifyEvidence(options);
      await writeOutputs(result);
      if (result.manifest.budget.status === "soft-limit-exceeded") {
        console.warn(
          `::warning title=ShockAudit evidence soft limit exceeded::${result.manifest.profile} evidence prepared ${result.manifest.preparedBytes} bytes; hard limit ${result.manifest.budget.hardLimitBytes} bytes.`,
        );
      }
      console.log(`${command === "prepare" ? "Prepared" : "Verified"} ${result.manifest.profile} evidence: ${result.manifest.fileCount} files, ${result.manifest.preparedBytes} bytes.`);
    }
  } catch (error) {
    console.error(`Actions evidence ${process.argv[2] ?? "operation"} failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
