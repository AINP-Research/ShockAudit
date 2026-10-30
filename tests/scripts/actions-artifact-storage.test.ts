import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ACTIVE_RELEASE_BRANCH,
  ARTIFACT_CLEANUP_SCHEMA,
  AUTHORIZED_REPOSITORY,
  DELETE_INTERVAL_MS,
  assertApplyEvent,
  assertArtifactIdentity,
  assertManifestAuthorization,
  executeCleanup,
  manifestSha256,
  validateCleanupManifest,
  // The historical cleanup utility is intentionally retained as plain ESM.
  // @ts-expect-error -- no declaration file is shipped for the retired utility.
} from "../../scripts/recover-actions-artifact-storage.mjs";

const releaseHead = "c".repeat(40);
const targetHead = "b".repeat(40);
const authorizationMarker = "<!-- authorized-storage-cleanup:unit-test -->";

function archivePack(artifactCount = 1) {
  return {
    pack_name: "shockaudit-failed-diagnostics-a-01-of-04.tar",
    pack_sha256: "1".repeat(64),
    pack_size_bytes: 8192,
    artifact_count: artifactCount,
    library_file_id: "libfile_pack",
    library_file_object_id: "file_pack",
    restored_byte_identical: true,
  };
}

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    name: "playwright-diagnostics-deadbeef",
    size_in_bytes: 4096,
    digest: `sha256:${"a".repeat(64)}`,
    created_at: "2026-08-01T00:00:00Z",
    expires_at: "2026-11-01T00:00:00Z",
    workflow_run_id: 456,
    workflow_run_attempt: 1,
    head_sha: targetHead,
    head_branch: "agent/obsolete-branch",
    event: "pull_request",
    run_status: "completed",
    run_conclusion: "failure",
    disposition: "delete-archived-failed-diagnostic",
    archive: {
      status: "verified-durable",
      library_file_id: "libfile_pack",
      pack_name: "shockaudit-failed-diagnostics-a-01-of-04.tar",
      pack_sha256: "1".repeat(64),
      pack_size_bytes: 8192,
      tar_member_path: "artifacts/123.zip",
      original_zip_digest: `sha256:${"a".repeat(64)}`,
      restored_byte_identical: true,
    },
    ...overrides,
  };
}

function successTarget(overrides: Record<string, unknown> = {}) {
  return target({
    id: 124,
    name: "playwright-diagnostics-success",
    run_conclusion: "success",
    disposition: "delete-archived-success-diagnostic",
    archive: {
      ...target().archive,
      tar_member_path: "artifacts/124.zip",
    },
    ...overrides,
  });
}

function manifest(targets = [target()]) {
  return {
    schema: ARTIFACT_CLEANUP_SCHEMA,
    repository: AUTHORIZED_REPOSITORY,
    status: "archive-verified-delete-authorized",
    authorization: {
      pr_number: 83,
      branch: ACTIVE_RELEASE_BRANCH,
      trigger_marker: authorizationMarker,
      held_artifact_ids: [9117092225],
    },
    totals: {
      target_count: targets.length,
      target_bytes: targets.reduce(
        (sum, item) => sum + Number(item.size_in_bytes),
        0,
      ),
    },
    protected: {
      formal_evidence: "all",
      main_branch_diagnostics: "all",
      active_pr_diagnostics: "all",
    },
    archive_registry: {
      archive_artifact_count: targets.length,
      archive_original_zip_bytes: targets.reduce(
        (sum, item) => sum + Number(item.size_in_bytes),
        0,
      ),
      master_manifest: {
        library_file_id: "libfile_master",
        library_file_object_id: "file_master",
        sha256: "2".repeat(64),
        restored_byte_identical: true,
      },
      success_manifest: {
        library_file_id: "libfile_success_master",
        library_file_object_id: "file_success_master",
        checksum_library_file_id: "libfile_success_checksums",
        checksum_library_file_object_id: "file_success_checksums",
        sha256: "4".repeat(64),
        restored_byte_identical: true,
      },
      packs: [archivePack(targets.length)],
    },
    targets,
  };
}

function response(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-ratelimit-remaining" ? "999" : null,
    },
    json: async () => body,
    text: async () => body === undefined ? "" : JSON.stringify(body),
  } as Response;
}

function livePr() {
  return {
    number: 83,
    state: "open",
    draft: true,
    body: authorizationMarker,
    base: { ref: "main" },
    head: {
      ref: ACTIVE_RELEASE_BRANCH,
      sha: releaseHead,
      repo: { full_name: AUTHORIZED_REPOSITORY },
    },
  };
}

function targetRun(expected = target()) {
  return {
    id: expected.workflow_run_id,
    event: expected.event,
    status: expected.run_status,
    conclusion: expected.run_conclusion,
    head_sha: expected.head_sha,
    head_branch: expected.head_branch,
    run_attempt: expected.workflow_run_attempt,
  };
}

function actualArtifact(expected = target()) {
  return {
    ...expected,
    expired: false,
    workflow_run: {
      id: expected.workflow_run_id,
      head_sha: expected.head_sha,
      head_branch: expected.head_branch,
    },
  };
}

function router({
  targets = [target()],
  openPulls = [livePr()],
  artifactOverrides = new Map<number, unknown>(),
  deleteStatuses = new Map<number, number>(),
}: {
  targets?: Array<ReturnType<typeof target>>;
  openPulls?: unknown[];
  artifactOverrides?: Map<number, unknown>;
  deleteStatuses?: Map<number, number>;
} = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/actions/artifacts?per_page=1")) {
      return response(200, { total_count: 1 });
    }
    if (url.includes("/actions/artifacts?per_page=100&page=")) {
      return response(200, { total_count: 0, artifacts: [] });
    }
    if (url.endsWith("/pulls/83")) {
      return response(200, livePr());
    }
    if (url.includes("/pulls?state=open")) {
      return response(200, openPulls);
    }
    const runMatch = url.match(/\/actions\/runs\/(\d+)$/u);
    if (runMatch) {
      const runId = Number(runMatch[1]);
      const targetRecord = targets.find((item) => item.workflow_run_id === runId);
      if (targetRecord) {
        return response(200, targetRun(targetRecord));
      }
      return response(404, { message: "missing" });
    }
    const artifactMatch = url.match(/\/actions\/artifacts\/(\d+)$/u);
    if (artifactMatch) {
      const id = Number(artifactMatch[1]);
      if (options?.method === "DELETE") {
        return response(deleteStatuses.get(id) ?? 204);
      }
      if (artifactOverrides.has(id)) {
        const value = artifactOverrides.get(id);
        return value === 404 ? response(404) : response(200, value);
      }
      const targetRecord = targets.find((item) => item.id === id);
      if (targetRecord) {
        return response(200, actualArtifact(targetRecord));
      }
      return response(404);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("Actions artifact storage recovery", () => {
  it("accepts only restored original-byte archives", () => {
    expect(validateCleanupManifest(manifest())).toBeTruthy();
    expect(validateCleanupManifest(manifest([successTarget()]))).toBeTruthy();
    expect(() =>
      validateCleanupManifest(manifest([
        target({ archive: { status: "verified-durable" } }),
      ])),
    ).toThrow(/archive/iu);
    expect(() =>
      validateCleanupManifest(manifest([
        successTarget({ archive: { status: "verified-durable" } }),
      ])),
    ).toThrow(/archive/iu);
  });

  it("binds exact manifest bytes, count, bytes, and the held artifact", () => {
    const input = manifest();
    const bytes = Buffer.from(JSON.stringify(input));
    const digest = manifestSha256(bytes);
    expect(
      assertManifestAuthorization({
        manifest: input,
        manifestBytes: bytes,
        expectedManifestSha256: digest,
        expectedTargetCount: 1,
        expectedTargetBytes: 4096,
        heldArtifactId: 9117092225,
      }),
    ).toBe(digest);
    expect(() =>
      assertManifestAuthorization({
        manifest: input,
        manifestBytes: bytes,
        expectedManifestSha256: "0".repeat(64),
        expectedTargetCount: 1,
        expectedTargetBytes: 4096,
        heldArtifactId: 9117092225,
      }),
    ).toThrow(/digest mismatch/iu);
    expect(() => validateCleanupManifest(manifest([
      target({ id: 9117092225 }),
    ]))).toThrow(/Held artifact/iu);
  });

  it.each([
    ["id", 999],
    ["name", "playwright-diagnostics-changed"],
    ["size_in_bytes", 4097],
    ["created_at", "2026-08-02T00:00:00Z"],
    ["expires_at", "2026-12-01T00:00:00Z"],
    ["digest", `sha256:${"f".repeat(64)}`],
  ])("rejects artifact %s drift", (field, value) => {
    const expected = target();
    expect(() =>
      assertArtifactIdentity(expected, {
        ...actualArtifact(expected),
        [field]: value,
      }),
    ).toThrow(/mismatch/iu);
  });

  it("preflights the complete target set before the first delete", async () => {
    const second = target({
      id: 125,
      size_in_bytes: 2048,
      digest: `sha256:${"e".repeat(64)}`,
      archive: {
        ...target().archive,
        tar_member_path: "artifacts/125.zip",
        original_zip_digest: `sha256:${"e".repeat(64)}`,
      },
    });
    const targets = [target(), second];
    const overrides = new Map<number, unknown>([
      [125, { ...actualArtifact(second), digest: `sha256:${"f".repeat(64)}` }],
    ]);
    const fetchImpl = router({ targets, artifactOverrides: overrides });
    await expect(executeCleanup({
      manifest: manifest(targets),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
    })).rejects.toThrow(/digest/iu);
    expect(fetchImpl.mock.calls.some(([, options]) => options?.method === "DELETE"))
      .toBe(false);
  });

  it("validates live workflow-run identity and excludes every open PR", async () => {
    const openPulls = [
      livePr(),
      {
        number: 81,
        head: {
          ref: target().head_branch,
          sha: target().head_sha,
          repo: { full_name: AUTHORIZED_REPOSITORY },
        },
      },
    ];
    const fetchImpl = router({ openPulls });
    await expect(executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: false,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
    })).rejects.toThrow(/open PR #81/iu);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("/actions/runs/")))
      .toBe(false);
  });

  it("supports verify-only mode without deletion", async () => {
    const fetchImpl = router();
    const journals: unknown[] = [];
    const result = await executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: false,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
      journal: async (entry: unknown) => journals.push(entry),
    });
    expect(result).toMatchObject({
      status: "verified",
      preflight_present_count: 1,
      removed_count: 0,
    });
    expect(fetchImpl.mock.calls.some(([, options]) => options?.method === "DELETE"))
      .toBe(false);
    expect(journals.length).toBeGreaterThanOrEqual(2);
  });

  it("deletes only after preflight and confirms absence with renewed capability", async () => {
    const expected = target();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(200, { total_count: 1 }))
      .mockResolvedValueOnce(response(200, livePr()))
      .mockResolvedValueOnce(response(200, [livePr()]))
      .mockResolvedValueOnce(response(200, targetRun(expected)))
      .mockResolvedValueOnce(response(200, actualArtifact(expected)))
      .mockResolvedValueOnce(response(200, livePr()))
      .mockResolvedValueOnce(response(200, [livePr()]))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, { total_count: 0, artifacts: [] }));
    const journals: Array<Record<string, unknown>> = [];
    const result = await executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
      journal: async (entry: Record<string, unknown>) => journals.push(entry),
    });
    expect(result).toMatchObject({
      status: "completed",
      removed_count: 1,
      removed_bytes: 4096,
      confirmed_absent_count: 1,
      confirmed_absent_bytes: 4096,
    });
    expect(fetchImpl.mock.calls[7]?.[1]).toMatchObject({ method: "DELETE" });
    expect(journals.at(-1)).toMatchObject({ status: "completed" });
  });

  it("journals every outcome and a mid-delete failure", async () => {
    const second = target({
      id: 125,
      size_in_bytes: 2048,
      archive: { ...target().archive, tar_member_path: "artifacts/125.zip" },
    });
    const targets = [target(), second];
    const fetchImpl = router({
      targets,
      deleteStatuses: new Map([[125, 500]]),
    });
    const journals: Array<Record<string, unknown>> = [];
    await expect(executeCleanup({
      manifest: manifest(targets),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
      journal: async (entry: Record<string, unknown>) => journals.push(entry),
      sleepImpl: async () => {},
    })).rejects.toThrow(/deletion failed/iu);
    expect(journals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ removed_count: 1 }),
        expect.objectContaining({
          status: "failed",
          failed_artifact_id: 125,
        }),
      ]),
    );
  });

  it("requires primary-rate-limit headroom before the first delete", async () => {
    const baseFetch = router();
    const fetchImpl = vi.fn(async (url: string, options?: RequestInit) => {
      const result = await baseFetch(url, options);
      return {
        ...result,
        headers: { get: () => "50" },
      } as unknown as Response;
    });
    await expect(executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
    })).rejects.toThrow(/rate-limit budget/iu);
    expect(fetchImpl.mock.calls.some(([, options]) => options?.method === "DELETE"))
      .toBe(false);
  });

  it("renews exact PR authorization immediately before deletion", async () => {
    const baseFetch = router();
    let prReads = 0;
    const fetchImpl = vi.fn(async (url: string, options?: RequestInit) => {
      if (String(url).endsWith("/pulls/83")) {
        prReads += 1;
        if (prReads === 2) {
          return response(200, { ...livePr(), body: "Authorization revoked." });
        }
      }
      return baseFetch(url, options);
    });
    await expect(executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl,
    })).rejects.toThrow(/authorization/iu);
    expect(prReads).toBe(2);
    expect(fetchImpl.mock.calls.some(([, options]) => options?.method === "DELETE"))
      .toBe(false);
  });

  it("waits at least one second between destructive requests", async () => {
    const second = target({
      id: 125,
      size_in_bytes: 2048,
      archive: { ...target().archive, tar_member_path: "artifacts/125.zip" },
    });
    const sleepImpl = vi.fn(async () => {});
    const result = await executeCleanup({
      manifest: manifest([target(), second]),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      fetchImpl: router({ targets: [target(), second] }),
      sleepImpl,
    });
    expect(result.removed_count).toBe(2);
    expect(DELETE_INTERVAL_MS).toBeGreaterThanOrEqual(1_000);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(DELETE_INTERVAL_MS);
  });

  it("requires capability and an explicit rerun before accepting 404", async () => {
    const absent = new Map<number, unknown>([[123, 404]]);
    await expect(executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      resume: false,
      fetchImpl: router({ artifactOverrides: absent }),
    })).rejects.toThrow(/unexpectedly absent/iu);

    const fetchImpl = router({ artifactOverrides: absent });
    const result = await executeCleanup({
      manifest: manifest(),
      repository: AUTHORIZED_REPOSITORY,
      token: "token",
      apply: true,
      expectedHeadSha: releaseHead,
      manifestDigest: "3".repeat(64),
      resume: true,
      fetchImpl,
    });
    expect(result).toMatchObject({
      status: "completed",
      already_absent_count: 1,
      confirmed_absent_count: 1,
    });
  });

  it("binds apply mode to the exact same-repository PR edited event", () => {
    const input = manifest();
    const event = {
      action: "edited",
      changes: { body: { from: "Body before authorization." } },
      repository: { full_name: AUTHORIZED_REPOSITORY },
      pull_request: {
        number: 83,
        body: input.authorization.trigger_marker,
        head: {
          ref: ACTIVE_RELEASE_BRANCH,
          sha: releaseHead,
          repo: { full_name: AUTHORIZED_REPOSITORY },
        },
      },
    };
    const env = {
      SHOCKAUDIT_ARTIFACT_CLEANUP_APPLY: "true",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_HEAD_REF: ACTIVE_RELEASE_BRANCH,
      SHOCKAUDIT_EXPECTED_COMMIT: releaseHead,
    };
    expect(assertApplyEvent({ event, env, localHead: releaseHead, manifest: input }))
      .toBe(releaseHead);
    expect(() =>
      assertApplyEvent({
        event: { ...event, action: "synchronize" },
        env,
        localHead: releaseHead,
        manifest: input,
      }),
    ).toThrow(/one-shot/iu);
    expect(() =>
      assertApplyEvent({
        event: {
          ...event,
          changes: { body: { from: input.authorization.trigger_marker } },
        },
        env,
        localHead: releaseHead,
        manifest: input,
      }),
    ).toThrow(/one-shot addition/iu);
  });

  it("pins the checked-in production cleanup fixture", () => {
    const manifestPath = path.resolve(
      "docs/evidence/actions-artifact-storage-recovery-2026-09-07.json",
    );
    const manifestBytes = readFileSync(manifestPath);
    const fixture = JSON.parse(manifestBytes.toString("utf8"));
    expect(validateCleanupManifest(fixture)).toBeTruthy();
    expect(fixture.totals).toMatchObject({
      target_count: 206,
      target_bytes: 2_702_226_612,
    });
    expect(fixture.authorization.held_artifact_ids).toContain(9117092225);
    expect(fixture.targets).toHaveLength(206);
    expect(fixture.targets.some((item: { id: number }) => item.id === 9117092225))
      .toBe(false);
    expect(fixture.archive_registry).toMatchObject({
      archive_artifact_count: 206,
      archive_original_zip_bytes: 2_702_226_612,
    });
    expect(fixture.archive_registry.packs).toHaveLength(7);
    expect(fixture.execution).toEqual({
      mode: "pending",
      result_artifact_name: null,
      workflow_run_id: null,
      observed_removed_count: 0,
      observed_removed_bytes: 0,
      observed_confirmed_absent_count: 0,
      github_reported_quota_status: "not-yet-recalculated",
    });
    expect(
      fixture.targets.filter(
        (item: { disposition: string }) =>
          item.disposition === "delete-archived-failed-diagnostic",
      ),
    ).toHaveLength(150);
    expect(
      fixture.targets.filter(
        (item: { disposition: string }) =>
          item.disposition === "delete-archived-success-diagnostic",
      ),
    ).toHaveLength(56);

    const scriptBytes = readFileSync(path.resolve(
      "scripts/recover-actions-artifact-storage.mjs",
    ));
    const retiredWorkflowPaths = [
      ".github/workflows/actions-storage-recovery.yml",
      ".github/workflows/actions-storage-probe.yml",
      ".github/workflows/actions-storage-selective-cleanup.yml",
    ].map((pathname) => path.resolve(pathname));
    expect(manifestSha256(manifestBytes)).toBe(
      "14d1f647dbd66b0b0f001f33ad25ac00ecaba5c0451cec72c88f944044934d98",
    );
    expect(manifestSha256(scriptBytes)).toBe(
      "b55740193e33d2dc730085fd6865eaa97371c575d911eeb0f2204ebe1efa8379",
    );
    for (const pathname of retiredWorkflowPaths) {
      expect(existsSync(pathname)).toBe(false);
    }
  });
});
