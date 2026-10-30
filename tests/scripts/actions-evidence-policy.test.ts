import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";

// The production helper is deliberately plain Node ESM so Actions can execute
// it without a TypeScript loader.
// @ts-expect-error No declaration file is shipped for the workflow-only ESM.
import { manifestName, normalizeArtifactDigest, prepareEvidence, readEvidencePolicy, reportArtifactInventory, summaryName, verifyEvidence } from "../../scripts/manage-actions-evidence.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const expectedSha = "a".repeat(40);
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});
function temporaryLayout() {
  const root = mkdtempSync(path.join(tmpdir(), "shockaudit-actions-evidence-test-"));
  roots.push(root);
  const sourceRoot = path.join(root, "source");
  const runnerTemp = path.join(root, "runner-temp");
  mkdirSync(sourceRoot);
  mkdirSync(runnerTemp);
  return { root, sourceRoot, runnerTemp };
}

function writeRelative(root: string, pathname: string, bytes: string | Buffer) {
  const destination = path.join(root, ...pathname.split("/"));
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function commonOptions(
  profile: "release" | "diagnostics" | "live" | "matrix",
  sourceRoot: string,
  runnerTemp: string,
  stageName = "stage",
) {
  return {
    profile,
    sourceRoot,
    runnerTemp,
    stageRoot: path.join(runnerTemp, stageName),
    expectedSha,
    repository: "AINP-Research/ShockAudit",
    runId: "34123456789",
    runAttempt: "2",
    retentionDays: profile === "diagnostics" ? 3 : 90,
    finalCandidateSha: profile === "release" ? expectedSha : undefined,
  };
}

function liveSource(sourceRoot: string) {
  writeRelative(
    sourceRoot,
    "artifacts/stage6-live/verify-live-mcp.json",
    `${JSON.stringify({ expectedCommit: expectedSha, status: "passed" })}\n`,
  );
  writeRelative(
    sourceRoot,
    "artifacts/stage6-live/verify-live-mcp.md",
    `Live verification for ${expectedSha}\n`,
  );
}

function sha(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function artifactRecord({
  id,
  size = 1,
  name = `artifact-${id}`,
  digest = `sha256:${"b".repeat(64)}`,
  runId = "34123456789",
  headSha = expectedSha,
  expired = false,
}: {
  id: number;
  size?: number;
  name?: string;
  digest?: string;
  runId?: string;
  headSha?: string;
  expired?: boolean;
}) {
  return {
    id,
    name,
    digest,
    expired,
    size_in_bytes: size,
    workflow_run: { id: Number(runId), head_sha: headSha },
  };
}

function apiResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function releaseSource(sourceRoot: string) {
  const policy = await readEvidencePolicy();
  const release = policy.profiles.release;
  const axeNames = Array.from(
    { length: 4 },
    (_, index) => `journey-${String(index + 1).padStart(2, "0")}-axe-wcag-a-aa.json`,
  );
  const inventory = {
    schemaVersion: "shockaudit-browser-release-inventory-v1",
    tests: [{ axeAttachments: axeNames }],
  };
  const attachments: Array<{
    name: string;
    contentType: string;
    body: string;
    path?: string;
  }> = axeNames.map((name, index) => ({
    name,
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ name, violations: [], index })).toString("base64"),
  }));
  attachments.push({
    name: "non-required-debug.json",
    contentType: "application/json",
    body: Buffer.from('{"debug":true}').toString("base64"),
    path: "/tmp/duplicate-debug.json",
  });
  const report = {
    config: { metadata: { shockauditExactHeadCommit: expectedSha } },
    suites: [{ specs: [{ tests: [{ results: [{ attachments }] }] }] }],
  };
  const reportBytes = `${JSON.stringify(report)}\n`;
  const inventoryBytes = `${JSON.stringify(inventory)}\n`;
  const smokeBytes = `${JSON.stringify({ config: { metadata: { shockauditExactHeadCommit: expectedSha } } })}\n`;
  const exactHead = {
    exactHeadCommit: expectedSha,
    runId: "34123456789",
    runAttempt: "2",
    playwrightEvidence: {
      reportSha256: `sha256:${sha(reportBytes)}`,
      inventorySha256: `sha256:${sha(inventoryBytes)}`,
      wranglerSmokeReportSha256: `sha256:${sha(smokeBytes)}`,
    },
  };
  writeRelative(
    sourceRoot,
    "artifacts/release-gates/exact-head.json",
    `${JSON.stringify(exactHead)}\n`,
  );
  writeRelative(
    sourceRoot,
    "artifacts/release-gates/wrangler-smoke-results.json",
    smokeBytes,
  );
  writeRelative(sourceRoot, "test-results/playwright-results.json", reportBytes);
  writeRelative(
    sourceRoot,
    "tests/browser/release-gate-inventory.json",
    inventoryBytes,
  );
  const checksumLines: string[] = [];
  for (const pathname of release.requiredFiles.filter((name: string) => name.endsWith(".png"))) {
    const bytes = Buffer.from(`png:${pathname}`);
    writeRelative(sourceRoot, pathname, bytes);
    checksumLines.push(`${sha(bytes)}  ${path.basename(pathname)}`);
  }
  writeRelative(
    sourceRoot,
    "artifacts/release-gates/browser-success-screenshots.sha256",
    `${checksumLines.join("\n")}\n`,
  );
  return { axeNames, reportBytes };
}

describe("central Actions evidence policy", () => {
  it("uses the reviewed profile budgets, retention, and repository targets", async () => {
    const policy = await readEvidencePolicy();
    expect(policy.repository).toBe("AINP-Research/ShockAudit");
    expect(policy.inventory).toEqual({
      warningBytes: 100 * 1024 * 1024,
      targetCeilingBytes: 150 * 1024 * 1024,
    });
    expect(policy.profiles.release).toMatchObject({
      retentionDays: [90],
      softLimitBytes: 4 * 1024 * 1024,
      hardLimitBytes: 16 * 1024 * 1024,
    });
    expect(policy.profiles.diagnostics).toMatchObject({
      retentionDays: [3, 7],
      softLimitBytes: 12 * 1024 * 1024,
      hardLimitBytes: 32 * 1024 * 1024,
    });
    expect(policy.profiles.live).toMatchObject({
      retentionDays: [90],
      softLimitBytes: 256 * 1024,
      hardLimitBytes: 1024 * 1024,
    });
    expect(policy.profiles.matrix).toMatchObject({
      retentionDays: [90],
      softLimitBytes: 1024 * 1024,
      hardLimitBytes: 4 * 1024 * 1024,
    });
    expect(policy.profiles.matrix.requiredFiles).toEqual([
      "artifacts/production-matrix/matrix-summary.json",
    ]);
    expect(policy.profiles.matrix.caseFiles).toHaveLength(22);
    expect(policy.markers.finalCandidate).toBe(
      "<!-- shockaudit-final-candidate-evidence:v0.6.2 -->",
    );
  });

  it("prepares and verifies a manifest bound to the exact SHA/run/attempt/profile", async () => {
    const { sourceRoot, runnerTemp } = temporaryLayout();
    liveSource(sourceRoot);
    const options = commonOptions("live", sourceRoot, runnerTemp);
    const prepared = await prepareEvidence(options);
    expect(prepared.manifest).toMatchObject({
      profile: "live",
      repository: "AINP-Research/ShockAudit",
      retentionDays: 90,
      fileCount: 2,
      binding: {
        expectedSha,
        runId: "34123456789",
        runAttempt: "2",
      },
    });
    expect(existsSync(path.join(prepared.stageRoot, manifestName))).toBe(true);
    expect(existsSync(path.join(prepared.stageRoot, summaryName))).toBe(true);
    const verified = await verifyEvidence({ ...options, stageRoot: prepared.stageRoot });
    expect(verified.manifest.preparedBytes).toBe(prepared.manifest.preparedBytes);
    expect(readFileSync(
      path.join(sourceRoot, "artifacts/stage6-live/verify-live-mcp.md"),
      "utf8",
    )).toContain(expectedSha);
  });

  it("extracts exact Axe JSON, compacts duplicate report bodies, and keeps ten PNGs", async () => {
    const { sourceRoot, runnerTemp } = temporaryLayout();
    const { axeNames, reportBytes } = await releaseSource(sourceRoot);
    const options = commonOptions("release", sourceRoot, runnerTemp);
    const prepared = await prepareEvidence(options);
    expect(prepared.manifest.fileCount).toBe(19);
    for (const name of axeNames) {
      expect(existsSync(path.join(
        prepared.stageRoot,
        "artifacts/release-gates/axe",
        name,
      ))).toBe(true);
    }
    const compactReport = JSON.parse(readFileSync(
      path.join(prepared.stageRoot, "test-results/playwright-results.json"),
      "utf8",
    ));
    expect(JSON.stringify(compactReport)).not.toContain('"body":');
    expect(JSON.stringify(compactReport)).not.toContain('"path":"/tmp');
    expect(compactReport._shockauditEvidenceCompaction).toMatchObject({
      sourceReportSha256: `sha256:${sha(reportBytes)}`,
      extractedAxeAttachmentCount: 4,
      omittedNonRequiredAttachmentBodies: 1,
    });
    expect(prepared.manifest.files.filter(
      (entry: { path: string }) => entry.path.endsWith(".png"),
    )).toHaveLength(10);
    await expect(verifyEvidence({ ...options, stageRoot: prepared.stageRoot }))
      .resolves.toMatchObject({ manifest: { profile: "release" } });
  });

  it("rejects missing input, source symlinks, traversal, extra files, and corruption", async () => {
    const missing = temporaryLayout();
    liveSource(missing.sourceRoot);
    rmSync(path.join(
      missing.sourceRoot,
      "artifacts/stage6-live/verify-live-mcp.md",
    ));
    await expect(prepareEvidence(commonOptions("live", missing.sourceRoot, missing.runnerTemp)))
      .rejects.toThrow(/verify-live-mcp\.md|ENOENT/iu);

    const linked = temporaryLayout();
    liveSource(linked.sourceRoot);
    const markdown = path.join(linked.sourceRoot, "artifacts/stage6-live/verify-live-mcp.md");
    rmSync(markdown);
    symlinkSync("verify-live-mcp.json", markdown);
    await expect(prepareEvidence(commonOptions("live", linked.sourceRoot, linked.runnerTemp)))
      .rejects.toThrow(/symbolic link/iu);

    const preparedLayout = temporaryLayout();
    liveSource(preparedLayout.sourceRoot);
    const options = commonOptions("live", preparedLayout.sourceRoot, preparedLayout.runnerTemp);
    const prepared = await prepareEvidence(options);
    writeRelative(prepared.stageRoot, "unexpected.txt", "extra");
    await expect(verifyEvidence({ ...options, stageRoot: prepared.stageRoot }))
      .rejects.toThrow(/extra file/iu);
    rmSync(path.join(prepared.stageRoot, "unexpected.txt"));
    writeFileSync(
      path.join(prepared.stageRoot, "artifacts/stage6-live/verify-live-mcp.md"),
      "corrupted",
    );
    await expect(verifyEvidence({ ...options, stageRoot: prepared.stageRoot }))
      .rejects.toThrow(/checksum|size changed/iu);

    const traversal = temporaryLayout();
    liveSource(traversal.sourceRoot);
    const traversalOptions = commonOptions("live", traversal.sourceRoot, traversal.runnerTemp);
    const traversalPrepared = await prepareEvidence(traversalOptions);
    const manifestPath = path.join(traversalPrepared.stageRoot, manifestName);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.files[0].path = "../escape.json";
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(verifyEvidence({ ...traversalOptions, stageRoot: traversalPrepared.stageRoot }))
      .rejects.toThrow(/traversal/iu);
  });

  it("enforces RUNNER_TEMP, exact markers, retention, and the hard size limit", async () => {
    const outside = temporaryLayout();
    liveSource(outside.sourceRoot);
    await expect(prepareEvidence({
      ...commonOptions("live", outside.sourceRoot, outside.runnerTemp),
      stageRoot: path.join(outside.root, "outside-stage"),
    })).rejects.toThrow(/RUNNER_TEMP/iu);

    const diagnostics = temporaryLayout();
    writeRelative(
      diagnostics.sourceRoot,
      "test-results/failure/test-failed-1.png",
      "bounded screenshot",
    );
    const sevenDay = {
      ...commonOptions("diagnostics", diagnostics.sourceRoot, diagnostics.runnerTemp),
      retentionDays: 7,
    };
    await expect(prepareEvidence(sevenDay)).rejects.toThrow(/active-investigation/iu);
    await expect(prepareEvidence({ ...sevenDay, activeDiagnosticsSha: "b".repeat(40) }))
      .rejects.toThrow(/active-investigation/iu);
    await expect(prepareEvidence({ ...sevenDay, activeDiagnosticsSha: expectedSha }))
      .resolves.toMatchObject({ manifest: { retentionDays: 7 } });

    const ignoredTraces = temporaryLayout();
    writeRelative(
      ignoredTraces.sourceRoot,
      "test-results/failure/trace.zip",
      Buffer.alloc(8_192),
    );
    writeRelative(
      ignoredTraces.sourceRoot,
      "test-results/failure/test-failed-1.png",
      "failure",
    );
    const tracePolicy = structuredClone(await readEvidencePolicy());
    tracePolicy.profiles.diagnostics.softLimitBytes = 2_048;
    tracePolicy.profiles.diagnostics.hardLimitBytes = 4_096;
    const withoutTrace = await prepareEvidence({
      ...commonOptions(
        "diagnostics",
        ignoredTraces.sourceRoot,
        ignoredTraces.runnerTemp,
      ),
      policy: tracePolicy,
    });
    expect(withoutTrace.manifest.files.map(
      (file: { path: string }) => file.path,
    )).toEqual([
      "test-results/failure/test-failed-1.png",
    ]);

    const oversized = temporaryLayout();
    writeRelative(
      oversized.sourceRoot,
      "test-results/failure/test-failed-1.png",
      Buffer.alloc(65),
    );
    const policy = structuredClone(await readEvidencePolicy());
    policy.profiles.diagnostics.softLimitBytes = 32;
    policy.profiles.diagnostics.hardLimitBytes = 64;
    await expect(prepareEvidence({
      ...commonOptions("diagnostics", oversized.sourceRoot, oversized.runnerTemp),
      policy,
    })).rejects.toThrow(/hard limit/iu);

    const release = temporaryLayout();
    await releaseSource(release.sourceRoot);
    await expect(prepareEvidence({
      ...commonOptions("release", release.sourceRoot, release.runnerTemp),
      finalCandidateSha: undefined,
    })).rejects.toThrow(/final-candidate SHA marker/iu);
  });

  it("retains a failed matrix summary but requires every case for a passed matrix", async () => {
    const failed = temporaryLayout();
    writeRelative(
      failed.sourceRoot,
      "artifacts/production-matrix/matrix-summary.json",
      `${JSON.stringify({
        expectedCommit: expectedSha,
        status: "failed",
        cases: [],
      })}\n`,
    );
    const failedOptions = commonOptions(
      "matrix",
      failed.sourceRoot,
      failed.runnerTemp,
    );
    const retained = await prepareEvidence(failedOptions);
    expect(retained.manifest.fileCount).toBe(1);
    await expect(verifyEvidence({
      ...failedOptions,
      stageRoot: retained.stageRoot,
    })).resolves.toMatchObject({ manifest: { profile: "matrix" } });

    const passed = temporaryLayout();
    writeRelative(
      passed.sourceRoot,
      "artifacts/production-matrix/matrix-summary.json",
      `${JSON.stringify({
        expectedCommit: expectedSha,
        status: "passed",
        passedCount: 22,
        failedCount: 0,
        cases: [],
      })}\n`,
    );
    await expect(prepareEvidence(commonOptions(
      "matrix",
      passed.sourceRoot,
      passed.runnerTemp,
    ))).rejects.toThrow(/requires all 22 case files/iu);
  });

  it("normalizes action and REST digests and reports a bounded paginated inventory", async () => {
    const bareDigest = "b".repeat(64);
    expect(normalizeArtifactDigest(bareDigest)).toBe(`sha256:${bareDigest}`);
    expect(normalizeArtifactDigest(`sha256:${bareDigest}`)).toBe(`sha256:${bareDigest}`);
    expect(() => normalizeArtifactDigest("not-a-digest")).toThrow(/SHA-256/iu);

    const firstPage = Array.from({ length: 100 }, (_, index) => artifactRecord({
      id: index + 1,
      size: 10,
    }));
    firstPage[0] = artifactRecord({
      id: 999,
      size: 10,
      name: "release-gates-exact",
    });
    const secondPage = [artifactRecord({ id: 101, size: 10 })];
    const fetchImpl = vi.fn(async (url: string) => {
      return apiResponse({
        total_count: 101,
        artifacts: url.includes("page=2") ? secondPage : firstPage,
      });
    });
    const result = await reportArtifactInventory({
      repository: "AINP-Research/ShockAudit",
      expectedSha,
      runId: "34123456789",
      uploadedArtifactId: "999",
      uploadedArtifactName: "release-gates-exact",
      uploadedArtifactDigest: bareDigest,
      token: "test-token",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      retainedArtifactCount: 101,
      retainedBytes: 1010,
      status: "within-target",
    });
  });

  it("reports warning and ceiling thresholds and fails closed on inventory API errors", async () => {
    const invoke = (size: number, fetchImpl = vi.fn(async () => apiResponse({
      total_count: 1,
      artifacts: [artifactRecord({ id: 999, size, name: "matrix-exact" })],
    }))) => reportArtifactInventory({
      repository: "AINP-Research/ShockAudit",
      expectedSha,
      runId: "34123456789",
      uploadedArtifactId: "999",
      uploadedArtifactName: "matrix-exact",
      uploadedArtifactDigest: "b".repeat(64),
      token: "test-token",
      fetchImpl,
    });
    await expect(invoke((100 * 1024 * 1024) - 1)).resolves.toMatchObject({ status: "within-target" });
    await expect(invoke(100 * 1024 * 1024)).resolves.toMatchObject({ status: "warning" });
    await expect(invoke(150 * 1024 * 1024)).resolves.toMatchObject({ status: "ceiling-exceeded" });
    await expect(invoke(1, vi.fn(async () => apiResponse({ message: "failed" }, 503))))
      .rejects.toThrow(/HTTP 503/iu);
    await expect(invoke(1, vi.fn(async () => apiResponse({
      total_count: 1,
      artifacts: [artifactRecord({
        id: 999,
        size: 1,
        name: "matrix-exact",
        digest: `sha256:${"c".repeat(64)}`,
      })],
    })))).rejects.toThrow(/exact name\/digest\/run\/SHA/iu);
  });

  it("binds release inventory, Wrangler bytes, and Actions run/attempt", async () => {
    const wrongRun = temporaryLayout();
    await releaseSource(wrongRun.sourceRoot);
    const exactPath = path.join(
      wrongRun.sourceRoot,
      "artifacts/release-gates/exact-head.json",
    );
    const exact = JSON.parse(readFileSync(exactPath, "utf8"));
    exact.runAttempt = "1";
    writeFileSync(exactPath, `${JSON.stringify(exact)}\n`);
    await expect(prepareEvidence(commonOptions("release", wrongRun.sourceRoot, wrongRun.runnerTemp)))
      .rejects.toThrow(/run\/attempt/iu);

    const changedInventory = temporaryLayout();
    await releaseSource(changedInventory.sourceRoot);
    const inventoryPath = path.join(
      changedInventory.sourceRoot,
      "tests/browser/release-gate-inventory.json",
    );
    writeFileSync(inventoryPath, `${readFileSync(inventoryPath, "utf8").trim()}\n\n`);
    await expect(prepareEvidence(commonOptions(
      "release",
      changedInventory.sourceRoot,
      changedInventory.runnerTemp,
    ))).rejects.toThrow(/inventory bytes/iu);

    const changedSmoke = temporaryLayout();
    await releaseSource(changedSmoke.sourceRoot);
    const smokePath = path.join(
      changedSmoke.sourceRoot,
      "artifacts/release-gates/wrangler-smoke-results.json",
    );
    writeFileSync(smokePath, `${readFileSync(smokePath, "utf8").trim()}\n\n`);
    await expect(prepareEvidence(commonOptions(
      "release",
      changedSmoke.sourceRoot,
      changedSmoke.runnerTemp,
    ))).rejects.toThrow(/Wrangler smoke bytes/iu);
  });
});

describe("workflow evidence controls", () => {
  it("restores normal gates and cancels only superseded PR checks", () => {
    const source = readFileSync(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
    const workflow = parseYaml(source);
    expect(source).not.toContain("if: ${{ false }}");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
    expect(workflow.jobs["dependency-audits"].strategy.matrix.include).toEqual([
      { label: "runtime" },
      { label: "full" },
    ]);
    expect(workflow.jobs["test-and-build"].permissions).toEqual({
      actions: "read",
      contents: "read",
    });
    expect(source.match(/npm install --global npm@11\.19\.1/gu)).toHaveLength(1);
  });

  it("uploads every marked candidate head and verifies it by artifact ID and digest", () => {
    const workflow = parseYaml(readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ));
    const steps = workflow.jobs["test-and-build"].steps as Array<Record<string, any>>;
    const prepare = steps.find((step) => step.id === "prepare_release_evidence");
    const upload = steps.find((step) => step.id === "upload_release_evidence");
    const download = steps.find((step) => String(step.name).includes("artifact by ID"));
    const verify = steps.find((step) => String(step.name).includes("Verify downloaded exact-HEAD"));
    const report = steps.find((step) => String(step.run).includes("report-inventory"));
    if (!prepare || !upload || !download || !verify || !report) {
      throw new Error("Release evidence workflow steps are incomplete.");
    }
    expect(workflow.on.pull_request.types).toEqual(["opened", "reopened", "synchronize"]);
    expect(prepare.if).toContain("shockaudit-final-candidate-evidence:v0.6.2");
    expect(prepare.if).not.toContain("github.event.action == 'edited'");
    expect(prepare.run).toContain("manage-actions-evidence.mjs prepare");
    expect(upload.with.path).toBe("${{ steps.prepare_release_evidence.outputs.stage_root }}/");
    expect(download.env.SHOCKAUDIT_ARTIFACT_ID).toBe(
      "${{ steps.upload_release_evidence.outputs.artifact-id }}",
    );
    expect(download.env.SHOCKAUDIT_ARTIFACT_DIGEST).toBe(
      "${{ steps.upload_release_evidence.outputs.artifact-digest }}",
    );
    expect(download.run).toContain(
      "/actions/artifacts/$SHOCKAUDIT_ARTIFACT_ID/zip",
    );
    expect(download.run).toContain("sha256sum \"$archive\"");
    expect(download.run).toContain("'sha256:'+actionDigest");
    expect(verify.run).toContain("manage-actions-evidence.mjs verify");
    expect(report.run).toContain("manage-actions-evidence.mjs report-inventory");
  });

  it("uses bounded three-day diagnostics and removes duplicate browser output", () => {
    const workflow = parseYaml(readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ));
    const steps = workflow.jobs["test-and-build"].steps as Array<Record<string, any>>;
    const prepare = steps.find((step) => step.id === "prepare_browser_diagnostics");
    const upload = steps.find((step) => step.name === "Upload bounded browser failure diagnostics");
    if (!prepare || !upload) {
      throw new Error("Diagnostics workflow steps are incomplete.");
    }
    expect(prepare.env.SHOCKAUDIT_DIAGNOSTICS_RETENTION_DAYS).toContain("'7' || '3'");
    expect(prepare.env.SHOCKAUDIT_ACTIVE_DIAGNOSTICS_SHA).toContain(
      "shockaudit-active-diagnostics:{0}",
    );
    expect(upload.with.path).toBe("${{ steps.prepare_browser_diagnostics.outputs.stage_root }}/");
    expect(upload.with["retention-days"]).toBe(
      "${{ steps.prepare_browser_diagnostics.outputs.retention_days }}",
    );
    const playwright = readFileSync(path.join(repositoryRoot, "playwright.config.ts"), "utf8");
    expect(playwright).not.toContain('["html"');
    expect(playwright).toContain('trace: "retain-on-failure"');
    expect(playwright).toContain('screenshot: "only-on-failure"');
    expect(playwright).toContain('video: "off"');
    const browser = readFileSync(
      path.join(repositoryRoot, "tests/browser/six-screen-screen01-screen02.spec.ts"),
      "utf8",
    );
    const helper = browser.match(/async function saveSimulatedScreenshot[\s\S]*?\n\}\n/u)?.[0];
    expect(helper).toContain("artifacts/release-gates/screenshots");
    expect(helper).not.toContain("testInfo.attach");
  });

  it("never cancels production evidence and read-verifies live and matrix artifacts", () => {
    const workflow = parseYaml(readFileSync(
      path.join(repositoryRoot, ".github/workflows/live-mcp.yml"),
      "utf8",
    ));
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
    for (const [jobName, profile] of [
      ["verify-production", "live"],
      ["verify-production-matrix", "matrix"],
    ] as const) {
      const job = workflow.jobs[jobName];
      expect(job.permissions).toEqual({ actions: "read", contents: "read" });
      const steps = job.steps as Array<Record<string, any>>;
      const prepare = steps.find((step) => String(step.run).includes(`--profile ${profile}`) && String(step.run).includes(" prepare"));
      const upload = steps.find((step) => step.uses === "actions/upload-artifact@v4");
      const download = steps.find((step) => String(step.name).includes("artifact by ID"));
      const verify = steps.find((step) => String(step.run).includes(`--profile ${profile}`) && String(step.run).includes(" verify"));
      const report = steps.find((step) => String(step.run).includes("report-inventory"));
      if (!prepare || !upload || !download || !verify || !report) {
        throw new Error(`${profile} evidence workflow steps are incomplete.`);
      }
      expect(prepare).toBeDefined();
      expect(upload.with.path).toContain("outputs.stage_root");
      expect(download.env.SHOCKAUDIT_ARTIFACT_ID).toContain("outputs.artifact-id");
      expect(download.env.SHOCKAUDIT_ARTIFACT_DIGEST).toContain("outputs.artifact-digest");
      expect(download.run).toContain("/actions/artifacts/$SHOCKAUDIT_ARTIFACT_ID/zip");
      expect(download.run).toContain("sha256sum \"$archive\"");
      expect(verify).toBeDefined();
      expect(report.run).toContain("--uploaded-artifact-digest");
    }
  });
});
