import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ARTIFACT_CLEANUP_SCHEMA =
  "shockaudit.github-actions-artifact-cleanup.v1";
export const ACTIVE_RELEASE_BRANCH =
  "feat/v0.4.07-screen2-discovery-recovery";
export const AUTHORIZED_PR_NUMBER = 83;
export const AUTHORIZED_REPOSITORY = "AINP-Research/ShockAudit";
export const DELETE_INTERVAL_MS = 1_100;
export const RATE_LIMIT_SAFETY_BUFFER = 100;
const POST_DELETE_INVENTORY_MAX_PAGES = 10;

function fail(message) {
  throw new Error(message);
}

function requireNonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive safe integer.`);
  }
  return value;
}

function requireSha256(value, label) {
  const normalized = requireNonEmpty(value, label).replace(/^sha256:/u, "");
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    fail(`${label} must be a lowercase SHA-256 digest.`);
  }
  return normalized;
}

function requireCommitSha(value, label) {
  const normalized = requireNonEmpty(value, label);
  if (!/^[0-9a-f]{40}$/u.test(normalized)) {
    fail(`${label} must be a full lowercase commit SHA.`);
  }
  return normalized;
}

function digestHex(digest) {
  return requireSha256(digest, "artifact digest");
}

function endpoint(apiBase, repository, suffix) {
  return `${apiBase}/repos/${repository}${suffix}`;
}

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readResponseMessage(response) {
  const text = await response.text();
  try {
    return JSON.parse(text)?.message ?? text;
  } catch {
    return text;
  }
}

async function requireJson(response, label) {
  if (!response.ok) {
    fail(`${label} failed (${response.status}): ${await readResponseMessage(response)}`);
  }
  return response.json();
}

export function manifestSha256(manifestBytes) {
  return createHash("sha256").update(manifestBytes).digest("hex");
}

export function validateCleanupManifest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Cleanup manifest must be an object.");
  }
  if (input.schema !== ARTIFACT_CLEANUP_SCHEMA) {
    fail(`Unsupported cleanup manifest schema: ${String(input.schema)}`);
  }
  if (input.repository !== AUTHORIZED_REPOSITORY) {
    fail(`Refusing cleanup for repository ${String(input.repository)}.`);
  }
  if (input.status !== "archive-verified-delete-authorized") {
    fail(`Cleanup manifest is not executable: ${String(input.status)}.`);
  }
  if (!Array.isArray(input.targets) || input.targets.length === 0) {
    fail("Cleanup manifest must contain at least one target.");
  }
  if (
    input.authorization?.pr_number !== AUTHORIZED_PR_NUMBER ||
    input.authorization?.branch !== ACTIVE_RELEASE_BRANCH
  ) {
    fail("Cleanup authorization does not identify the approved PR and branch.");
  }
  requireNonEmpty(input.authorization?.trigger_marker, "authorization.trigger_marker");
  const heldIds = input.authorization?.held_artifact_ids;
  if (!Array.isArray(heldIds) || heldIds.length === 0) {
    fail("Cleanup authorization must declare held artifact IDs.");
  }
  for (const id of heldIds) {
    requirePositiveInteger(id, "authorization.held_artifact_ids[]");
  }

  if (input.protected?.formal_evidence !== "all") {
    fail("The manifest must protect every formal evidence artifact.");
  }
  if (input.protected?.main_branch_diagnostics !== "all") {
    fail("The manifest must protect every main-branch diagnostics artifact.");
  }
  if (input.protected?.active_pr_diagnostics !== "all") {
    fail("The manifest must protect every active-PR diagnostics artifact.");
  }

  const packs = input.archive_registry?.packs;
  if (!Array.isArray(packs) || packs.length === 0) {
    fail("Cleanup manifest must contain a durable archive registry.");
  }
  const packByName = new Map();
  for (const [index, pack] of packs.entries()) {
    const prefix = `archive_registry.packs[${index}]`;
    const name = requireNonEmpty(pack?.pack_name, `${prefix}.pack_name`);
    if (packByName.has(name)) {
      fail(`Duplicate archive pack ${name}.`);
    }
    const normalized = {
      pack_name: name,
      pack_sha256: requireSha256(pack?.pack_sha256, `${prefix}.pack_sha256`),
      pack_size_bytes: requirePositiveInteger(
        pack?.pack_size_bytes,
        `${prefix}.pack_size_bytes`,
      ),
      artifact_count: requirePositiveInteger(
        pack?.artifact_count,
        `${prefix}.artifact_count`,
      ),
      library_file_id: requireNonEmpty(
        pack?.library_file_id,
        `${prefix}.library_file_id`,
      ),
      library_file_object_id: requireNonEmpty(
        pack?.library_file_object_id,
        `${prefix}.library_file_object_id`,
      ),
      restored_byte_identical: pack?.restored_byte_identical === true,
    };
    if (!normalized.restored_byte_identical) {
      fail(`Archive pack ${name} lacks a successful restore verification.`);
    }
    packByName.set(name, normalized);
  }
  const master = input.archive_registry?.master_manifest;
  requireNonEmpty(master?.library_file_id, "archive_registry.master_manifest.library_file_id");
  requireNonEmpty(
    master?.library_file_object_id,
    "archive_registry.master_manifest.library_file_object_id",
  );
  requireSha256(master?.sha256, "archive_registry.master_manifest.sha256");
  if (master?.restored_byte_identical !== true) {
    fail("The durable archive master manifest was not restored byte-identically.");
  }
  const successMaster = input.archive_registry?.success_manifest;
  requireNonEmpty(
    successMaster?.library_file_id,
    "archive_registry.success_manifest.library_file_id",
  );
  requireNonEmpty(
    successMaster?.library_file_object_id,
    "archive_registry.success_manifest.library_file_object_id",
  );
  requireNonEmpty(
    successMaster?.checksum_library_file_id,
    "archive_registry.success_manifest.checksum_library_file_id",
  );
  requireNonEmpty(
    successMaster?.checksum_library_file_object_id,
    "archive_registry.success_manifest.checksum_library_file_object_id",
  );
  requireSha256(successMaster?.sha256, "archive_registry.success_manifest.sha256");
  if (successMaster?.restored_byte_identical !== true) {
    fail("The durable success archive manifest was not restored byte-identically.");
  }
  if (
    input.archive_registry?.archive_artifact_count !== input.targets.length ||
    input.archive_registry?.archive_original_zip_bytes !==
      input.totals?.target_bytes
  ) {
    fail("The archive registry does not cover every cleanup target byte.");
  }

  const seen = new Set();
  const packReferenceCounts = new Map();
  let totalBytes = 0;
  for (const [index, target] of input.targets.entries()) {
    const prefix = `targets[${index}]`;
    const id = requirePositiveInteger(target?.id, `${prefix}.id`);
    if (seen.has(id)) {
      fail(`Duplicate artifact id ${id}.`);
    }
    if (heldIds.includes(id)) {
      fail(`Held artifact ${id} cannot be a cleanup target.`);
    }
    seen.add(id);
    const name = requireNonEmpty(target?.name, `${prefix}.name`);
    if (!name.startsWith("playwright-diagnostics")) {
      fail(`Artifact ${id} is not a Playwright diagnostics bundle.`);
    }
    const size = requirePositiveInteger(
      target?.size_in_bytes,
      `${prefix}.size_in_bytes`,
    );
    totalBytes += size;
    digestHex(target?.digest);
    requireNonEmpty(target?.created_at, `${prefix}.created_at`);
    requireNonEmpty(target?.expires_at, `${prefix}.expires_at`);
    requirePositiveInteger(target?.workflow_run_id, `${prefix}.workflow_run_id`);
    requirePositiveInteger(
      target?.workflow_run_attempt,
      `${prefix}.workflow_run_attempt`,
    );
    requireCommitSha(target?.head_sha, `${prefix}.head_sha`);
    const branch = requireNonEmpty(target?.head_branch, `${prefix}.head_branch`);
    if (branch === "main" || branch === ACTIVE_RELEASE_BRANCH) {
      fail(`Artifact ${id} belongs to a protected branch: ${branch}.`);
    }
    if (target?.event !== "pull_request" || target?.run_status !== "completed") {
      fail(`Artifact ${id} is not from a completed pull-request run.`);
    }

    const expectedConclusion = {
      "delete-archived-failed-diagnostic": "failure",
      "delete-archived-success-diagnostic": "success",
    }[target?.disposition];
    if (expectedConclusion) {
      if (target?.run_conclusion !== expectedConclusion) {
        fail(
          `Archived ${expectedConclusion} target ${id} is not from a ${expectedConclusion} run.`,
        );
      }
      const archive = target?.archive;
      const packName = requireNonEmpty(
        archive?.pack_name,
        `${prefix}.archive.pack_name`,
      );
      const pack = packByName.get(packName);
      if (!pack) {
        fail(`Artifact ${id} references an unregistered archive pack.`);
      }
      const tarMemberPath = requireNonEmpty(
        archive?.tar_member_path,
        `${prefix}.archive.tar_member_path`,
      );
      if (
        archive?.status !== "verified-durable" ||
        archive?.library_file_id !== pack.library_file_id ||
        requireSha256(
          archive?.pack_sha256,
          `${prefix}.archive.pack_sha256`,
        ) !== pack.pack_sha256 ||
        archive?.pack_size_bytes !== pack.pack_size_bytes ||
        digestHex(archive?.original_zip_digest) !== digestHex(target.digest) ||
        ![`artifacts/${id}.zip`, `${id}.zip`].includes(tarMemberPath) ||
        archive?.restored_byte_identical !== true
      ) {
        fail(`Artifact ${id} lacks a verified durable original-byte archive.`);
      }
      packReferenceCounts.set(
        packName,
        (packReferenceCounts.get(packName) ?? 0) + 1,
      );
    } else {
      fail(`Artifact ${id} has an unsupported disposition.`);
    }
  }

  for (const [packName, pack] of packByName.entries()) {
    if (packReferenceCounts.get(packName) !== pack.artifact_count) {
      fail(`Archive pack ${packName} does not cover its declared target count.`);
    }
  }

  if (input.totals?.target_count !== input.targets.length) {
    fail("Declared cleanup target count does not match the target list.");
  }
  if (input.totals?.target_bytes !== totalBytes) {
    fail("Declared cleanup bytes do not match the target list.");
  }
  return input;
}

export function assertManifestAuthorization({
  manifest,
  manifestBytes,
  expectedManifestSha256,
  expectedTargetCount,
  expectedTargetBytes,
  heldArtifactId,
}) {
  validateCleanupManifest(manifest);
  const actualDigest = manifestSha256(manifestBytes);
  if (actualDigest !== requireSha256(expectedManifestSha256, "expected manifest SHA-256")) {
    fail(
      `Cleanup manifest digest mismatch: expected ${expectedManifestSha256}, received ${actualDigest}.`,
    );
  }
  if (
    manifest.totals.target_count !== expectedTargetCount ||
    manifest.targets.length !== expectedTargetCount
  ) {
    fail("Cleanup target count does not match the reviewed authorization.");
  }
  if (manifest.totals.target_bytes !== expectedTargetBytes) {
    fail("Cleanup byte total does not match the reviewed authorization.");
  }
  if (!manifest.authorization.held_artifact_ids.includes(heldArtifactId)) {
    fail(`Held artifact ${heldArtifactId} is absent from the protection list.`);
  }
  if (manifest.targets.some((target) => target.id === heldArtifactId)) {
    fail(`Held artifact ${heldArtifactId} appears in the cleanup targets.`);
  }
  return actualDigest;
}

export function assertArtifactIdentity(expected, actual) {
  const exactFields = [
    "id",
    "name",
    "size_in_bytes",
    "created_at",
    "expires_at",
    "digest",
  ];
  for (const field of exactFields) {
    if (actual?.[field] !== expected[field]) {
      fail(
        `Artifact ${expected.id} identity mismatch for ${field}: expected ${String(expected[field])}, received ${String(actual?.[field])}.`,
      );
    }
  }
  if (actual?.expired !== false) {
    fail(`Artifact ${expected.id} is expired and cannot be verified.`);
  }
  if (actual?.workflow_run?.id !== expected.workflow_run_id) {
    fail(`Artifact ${expected.id} workflow-run identity changed.`);
  }
  if (actual?.workflow_run?.head_sha !== expected.head_sha) {
    fail(`Artifact ${expected.id} commit identity changed.`);
  }
  if (actual?.workflow_run?.head_branch !== expected.head_branch) {
    fail(`Artifact ${expected.id} branch identity changed.`);
  }
}

export function assertWorkflowRunIdentity(expected, actual) {
  const pairs = [
    ["id", expected.workflow_run_id],
    ["event", expected.event],
    ["status", expected.run_status],
    ["conclusion", expected.run_conclusion],
    ["head_sha", expected.head_sha],
    ["head_branch", expected.head_branch],
    ["run_attempt", expected.workflow_run_attempt],
  ];
  for (const [field, value] of pairs) {
    if (actual?.[field] !== value) {
      fail(
        `Workflow run ${expected.workflow_run_id} mismatch for ${field}: expected ${String(value)}, received ${String(actual?.[field])}.`,
      );
    }
  }
}

function assertAuthorizedLivePr({ livePr, repository, expectedCommit, marker }) {
  if (
    livePr?.number !== AUTHORIZED_PR_NUMBER ||
    livePr?.state !== "open" ||
    livePr?.draft !== true ||
    livePr?.base?.ref !== "main" ||
    livePr?.head?.ref !== ACTIVE_RELEASE_BRANCH ||
    livePr?.head?.repo?.full_name !== repository ||
    livePr?.head?.sha !== expectedCommit ||
    !String(livePr?.body ?? "").includes(marker)
  ) {
    fail("Live PR identity or cleanup authorization does not match the authorized exact head.");
  }
}

function assertTargetsExcludedFromOpenPulls({ manifest, openPulls, repository }) {
  for (const target of manifest.targets) {
    const owningOpenPr = openPulls.find(
      (pull) =>
        pull?.head?.repo?.full_name === repository &&
        (pull?.head?.ref === target.head_branch ||
          pull?.head?.sha === target.head_sha),
    );
    if (owningOpenPr) {
      fail(`Artifact ${target.id} belongs to open PR #${owningOpenPr.number}.`);
    }
  }
}

async function fetchOpenPullRequests({ apiBase, repository, authHeaders, fetchImpl }) {
  const pulls = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(
      endpoint(
        apiBase,
        repository,
        `/pulls?state=open&per_page=100&page=${page}`,
      ),
      { headers: authHeaders },
    );
    const batch = await requireJson(response, "Open pull-request preflight");
    if (!Array.isArray(batch)) {
      fail("Open pull-request preflight returned a non-array response.");
    }
    pulls.push(...batch);
    if (batch.length < 100) {
      return pulls;
    }
  }
  fail("Open pull-request preflight exceeded the bounded page limit.");
}

async function fetchAllArtifactIds({
  apiBase,
  repository,
  authHeaders,
  fetchImpl,
}) {
  const ids = new Set();
  for (let page = 1; page <= POST_DELETE_INVENTORY_MAX_PAGES; page += 1) {
    const response = await fetchImpl(
      endpoint(
        apiBase,
        repository,
        `/actions/artifacts?per_page=100&page=${page}`,
      ),
      { headers: authHeaders },
    );
    const payload = await requireJson(
      response,
      "Post-delete Actions artifact inventory",
    );
    if (!Array.isArray(payload?.artifacts)) {
      fail("Post-delete Actions artifact inventory is malformed.");
    }
    for (const artifact of payload.artifacts) {
      requirePositiveInteger(artifact?.id, "post-delete artifact id");
      ids.add(artifact.id);
    }
    if (payload.artifacts.length < 100) {
      return ids;
    }
  }
  fail("Post-delete artifact inventory exceeded the bounded page limit.");
}

export async function executeCleanup({
  manifest,
  repository,
  token,
  apply,
  expectedHeadSha,
  manifestDigest,
  resume = false,
  apiBase = "https://api.github.com",
  fetchImpl = fetch,
  journal = async () => {},
  progress = () => {},
  sleepImpl = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  deleteIntervalMs = DELETE_INTERVAL_MS,
}) {
  validateCleanupManifest(manifest);
  if (repository !== manifest.repository) {
    fail(`Runtime repository ${repository} does not match the manifest.`);
  }
  const authToken = requireNonEmpty(token, "GitHub token");
  const expectedCommit = requireCommitSha(expectedHeadSha, "expected PR head SHA");
  const authHeaders = headers(authToken);
  const authorizationMarker = requireNonEmpty(
    manifest.authorization?.trigger_marker,
    "authorization trigger marker",
  );
  if (
    !Number.isSafeInteger(deleteIntervalMs) ||
    deleteIntervalMs < 1_000
  ) {
    fail("Artifact deletion interval must be at least 1,000 milliseconds.");
  }
  let observedRateLimitRemaining = null;
  const trackedFetch = async (...args) => {
    const response = await fetchImpl(...args);
    const rawRemaining = response?.headers?.get?.("x-ratelimit-remaining");
    if (rawRemaining !== null && rawRemaining !== undefined) {
      if (!/^\d+$/u.test(rawRemaining)) {
        fail(`GitHub returned an invalid rate-limit remainder: ${rawRemaining}.`);
      }
      const parsedRemaining = Number(rawRemaining);
      observedRateLimitRemaining = observedRateLimitRemaining === null
        ? parsedRemaining
        : Math.min(observedRateLimitRemaining, parsedRemaining);
    }
    return response;
  };
  const result = {
    schema: "shockaudit.github-actions-artifact-cleanup-result.v1",
    repository,
    manifest_sha256: requireSha256(manifestDigest, "manifest SHA-256"),
    mode: apply ? "apply" : "verify-only",
    resume,
    status: "running",
    started_at: new Date().toISOString(),
    requested_count: manifest.targets.length,
    requested_bytes: manifest.totals.target_bytes,
    preflight_present_count: 0,
    preflight_absent_count: 0,
    removed_count: 0,
    removed_concurrently_count: 0,
    already_absent_count: 0,
    removed_bytes: 0,
    confirmed_absent_count: 0,
    confirmed_absent_bytes: 0,
    artifacts: [],
  };

  const persist = async () => {
    await journal(structuredClone(result));
  };

  try {
    const capability = await trackedFetch(
      endpoint(apiBase, repository, "/actions/artifacts?per_page=1"),
      { headers: authHeaders },
    );
    await requireJson(capability, "Actions artifact capability preflight");

    const livePrResponse = await trackedFetch(
      endpoint(apiBase, repository, `/pulls/${AUTHORIZED_PR_NUMBER}`),
      { headers: authHeaders },
    );
    const livePr = await requireJson(livePrResponse, "Authorized PR preflight");
    assertAuthorizedLivePr({
      livePr,
      repository,
      expectedCommit,
      marker: authorizationMarker,
    });

    const openPulls = await fetchOpenPullRequests({
      apiBase,
      repository,
      authHeaders,
      fetchImpl: trackedFetch,
    });
    assertTargetsExcludedFromOpenPulls({ manifest, openPulls, repository });

    const runCache = new Map();
    const getRun = async (runId) => {
      if (!runCache.has(runId)) {
        const response = await trackedFetch(
          endpoint(apiBase, repository, `/actions/runs/${runId}`),
          { headers: authHeaders },
        );
        runCache.set(
          runId,
          await requireJson(response, `Workflow run ${runId} preflight`),
        );
      }
      return runCache.get(runId);
    };

    for (const target of manifest.targets) {
      assertWorkflowRunIdentity(
        target,
        await getRun(target.workflow_run_id),
      );
    }

    const presentTargets = [];
    for (const target of manifest.targets) {
      const response = await trackedFetch(
        endpoint(apiBase, repository, `/actions/artifacts/${target.id}`),
        { headers: authHeaders },
      );
      if (response.status === 404) {
        if (!resume) {
          fail(
            `Artifact ${target.id} is unexpectedly absent on the first cleanup attempt.`,
          );
        }
        result.preflight_absent_count += 1;
        result.already_absent_count += 1;
        result.artifacts.push({
          id: target.id,
          size_in_bytes: target.size_in_bytes,
          outcome: "already-absent-on-resume",
        });
      } else {
        const actual = await requireJson(
          response,
          `Artifact ${target.id} preflight`,
        );
        assertArtifactIdentity(target, actual);
        presentTargets.push(target);
        result.preflight_present_count += 1;
      }
    }

    const renewedPrResponse = await trackedFetch(
      endpoint(apiBase, repository, `/pulls/${AUTHORIZED_PR_NUMBER}`),
      { headers: authHeaders },
    );
    const renewedPr = await requireJson(
      renewedPrResponse,
      "Renewed authorized PR pre-delete guard",
    );
    assertAuthorizedLivePr({
      livePr: renewedPr,
      repository,
      expectedCommit,
      marker: authorizationMarker,
    });
    const renewedOpenPulls = await fetchOpenPullRequests({
      apiBase,
      repository,
      authHeaders,
      fetchImpl: trackedFetch,
    });
    assertTargetsExcludedFromOpenPulls({
      manifest,
      openPulls: renewedOpenPulls,
      repository,
    });

    if (apply) {
      const requiredRateLimitRemaining =
        presentTargets.length +
        POST_DELETE_INVENTORY_MAX_PAGES +
        RATE_LIMIT_SAFETY_BUFFER;
      result.rate_limit_pre_delete = {
        observed_remaining: observedRateLimitRemaining,
        required_remaining: requiredRateLimitRemaining,
        safety_buffer: RATE_LIMIT_SAFETY_BUFFER,
      };
      if (observedRateLimitRemaining === null) {
        fail("GitHub did not report the primary REST rate-limit remainder.");
      }
      if (observedRateLimitRemaining < requiredRateLimitRemaining) {
        fail(
          `Insufficient GitHub REST rate-limit budget before deletion: ` +
          `${observedRateLimitRemaining} remaining, ${requiredRateLimitRemaining} required.`,
        );
      }
    }

    result.preflight_completed_at = new Date().toISOString();
    result.status = apply ? "preflight-passed" : "verified";
    await persist();
    if (!apply) {
      result.completed_at = new Date().toISOString();
      await persist();
      return result;
    }

    for (const [index, target] of presentTargets.entries()) {
      if (index > 0) {
        await sleepImpl(deleteIntervalMs);
      }
      const response = await trackedFetch(
        endpoint(apiBase, repository, `/actions/artifacts/${target.id}`),
        { method: "DELETE", headers: authHeaders },
      );
      if (response.status === 204) {
        result.removed_count += 1;
        result.removed_bytes += target.size_in_bytes;
        result.artifacts.push({
          id: target.id,
          size_in_bytes: target.size_in_bytes,
          outcome: "removed",
        });
      } else if (response.status === 404) {
        result.removed_concurrently_count += 1;
        result.artifacts.push({
          id: target.id,
          size_in_bytes: target.size_in_bytes,
          outcome: "removed-concurrently-after-preflight",
        });
      } else {
        result.status = "failed";
        result.failed_artifact_id = target.id;
        result.error =
          `Artifact ${target.id} deletion failed (${response.status}): ` +
          (await readResponseMessage(response));
        result.failed_at = new Date().toISOString();
        await persist();
        fail(result.error);
      }
      await persist();
      progress(index + 1, presentTargets.length, target.id, "delete");
    }

    const remainingArtifactIds = await fetchAllArtifactIds({
      apiBase,
      repository,
      authHeaders,
      fetchImpl: trackedFetch,
    });
    for (const target of manifest.targets) {
      if (remainingArtifactIds.has(target.id)) {
        result.status = "failed";
        result.failed_artifact_id = target.id;
        result.error = `Artifact ${target.id} remains present after cleanup.`;
        result.failed_at = new Date().toISOString();
        await persist();
        fail(result.error);
      }
      result.confirmed_absent_count += 1;
      result.confirmed_absent_bytes += target.size_in_bytes;
    }
    result.status = "completed";
    result.completed_at = new Date().toISOString();
    await persist();
    return result;
  } catch (error) {
    if (result.status !== "failed") {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
      result.failed_at = new Date().toISOString();
      await persist();
    }
    throw error;
  }
}

function parseArguments(argv) {
  const options = {
    apply: false,
    manifestPath: null,
    outputPath: null,
    expectedManifestSha256: null,
    expectedTargetCount: null,
    expectedTargetBytes: null,
    heldArtifactId: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      options.apply = true;
    } else if (value === "--manifest") {
      options.manifestPath = argv[++index] ?? null;
    } else if (value === "--output") {
      options.outputPath = argv[++index] ?? null;
    } else if (value === "--expected-manifest-sha256") {
      options.expectedManifestSha256 = argv[++index] ?? null;
    } else if (value === "--expected-target-count") {
      options.expectedTargetCount = Number(argv[++index]);
    } else if (value === "--expected-target-bytes") {
      options.expectedTargetBytes = Number(argv[++index]);
    } else if (value === "--held-artifact-id") {
      options.heldArtifactId = Number(argv[++index]);
    } else {
      fail(`Unknown argument: ${value}`);
    }
  }
  for (const [label, value] of [
    ["--manifest", options.manifestPath],
    ["--output", options.outputPath],
    ["--expected-manifest-sha256", options.expectedManifestSha256],
  ]) {
    if (!value) {
      fail(`Missing required argument ${label}.`);
    }
  }
  requirePositiveInteger(options.expectedTargetCount, "--expected-target-count");
  requirePositiveInteger(options.expectedTargetBytes, "--expected-target-bytes");
  requirePositiveInteger(options.heldArtifactId, "--held-artifact-id");
  return options;
}

async function writeJournal(outputPath, result) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`);
  await rename(temporary, outputPath);
}

export function assertApplyEvent({ event, env, localHead, manifest }) {
  if (env.SHOCKAUDIT_ARTIFACT_CLEANUP_APPLY !== "true") {
    fail("Apply mode requires SHOCKAUDIT_ARTIFACT_CLEANUP_APPLY=true.");
  }
  if (env.GITHUB_EVENT_NAME !== "pull_request" || event?.action !== "edited") {
    fail("Apply mode is restricted to the one-shot pull-request edited event.");
  }
  if (
    event?.pull_request?.number !== AUTHORIZED_PR_NUMBER ||
    event?.pull_request?.head?.ref !== ACTIVE_RELEASE_BRANCH ||
    event?.pull_request?.head?.repo?.full_name !== AUTHORIZED_REPOSITORY ||
    event?.repository?.full_name !== AUTHORIZED_REPOSITORY
  ) {
    fail("Apply mode event does not identify the authorized same-repository PR.");
  }
  const eventHead = requireCommitSha(
    event?.pull_request?.head?.sha,
    "event pull-request head",
  );
  if (
    localHead !== eventHead ||
    env.SHOCKAUDIT_EXPECTED_COMMIT !== eventHead ||
    env.GITHUB_HEAD_REF !== ACTIVE_RELEASE_BRANCH
  ) {
    fail("Checked-out HEAD does not match the authorized workflow event head.");
  }
  const marker = requireNonEmpty(
    manifest.authorization?.trigger_marker,
    "authorization trigger marker",
  );
  if (!String(event?.pull_request?.body ?? "").includes(marker)) {
    fail("The pull request does not carry the exact cleanup authorization marker.");
  }
  const previousBody = event?.changes?.body?.from;
  if (typeof previousBody !== "string" || previousBody.includes(marker)) {
    fail("The event is not the one-shot addition of the cleanup marker.");
  }
  return eventHead;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestBytes = await readFile(options.manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const digest = assertManifestAuthorization({
    manifest,
    manifestBytes,
    expectedManifestSha256: options.expectedManifestSha256,
    expectedTargetCount: options.expectedTargetCount,
    expectedTargetBytes: options.expectedTargetBytes,
    heldArtifactId: options.heldArtifactId,
  });
  let expectedHeadSha = process.env.SHOCKAUDIT_EXPECTED_COMMIT;
  if (options.apply) {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
    const localHead = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expectedHeadSha = assertApplyEvent({
      event,
      env: process.env,
      localHead,
      manifest,
    });
  }

  const resume = Number(process.env.GITHUB_RUN_ATTEMPT ?? "1") > 1;
  const result = await executeCleanup({
    manifest,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN,
    apply: options.apply,
    expectedHeadSha,
    manifestDigest: digest,
    resume,
    apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
    journal: (current) => writeJournal(options.outputPath, current),
    progress(current, total, id) {
      if (current === 1 || current === total || current % 25 === 0) {
        console.log(`Artifact cleanup progress ${current}/${total}: ${id}`);
      }
    },
  });
  console.log(
    `Artifact cleanup ${result.status}: ${result.removed_count} removed, ` +
      `${result.already_absent_count} already absent, ` +
      `${result.confirmed_absent_count} confirmed absent.`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
