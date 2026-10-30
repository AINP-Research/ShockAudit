import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertExpectedBuildMarker,
  resolveExpectedBuildMarker,
} from "../../scripts/build-artifact-commit.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("production artifact commit binding", () => {
  it("derives the exact release marker and rejects stale dist output", () => {
    const expectedCommit = "0123456789abcdef0123456789abcdef01234567";
    const marker = resolveExpectedBuildMarker({
      env: { SHOCKAUDIT_EXPECTED_COMMIT: expectedCommit, CI: "true" },
      readGitMarker: () => "deadbee",
    });
    expect(marker).toBe("0123456");
    expect(() => assertExpectedBuildMarker("deadbee", marker)).toThrow(
      /Refusing stale or cross-commit dist output/iu,
    );
    expect(() => assertExpectedBuildMarker(marker, marker)).not.toThrow();
  });

  it("requires a full lowercase expected commit in CI", () => {
    expect(() => resolveExpectedBuildMarker({
      env: { CI: "true" },
      readGitMarker: () => "0123456",
    })).toThrow(/required by the CI release build gate/iu);
    expect(() => resolveExpectedBuildMarker({
      env: { CI: "true", SHOCKAUDIT_EXPECTED_COMMIT: "0123456" },
      readGitMarker: () => "0123456",
    })).toThrow(/full lowercase 40-hex release commit/iu);
  });

  it("accepts Cloudflare's exact native build commit in CI", () => {
    const workersCommit = "89abcdef0123456789abcdef0123456789abcdef";
    expect(resolveExpectedBuildMarker({
      env: {
        CI: "true",
        WORKERS_CI: "1",
        WORKERS_CI_COMMIT_SHA: workersCommit,
      },
      readGitMarker: () => "deadbee",
    })).toBe("89abcde");
    expect(resolveExpectedBuildMarker({
      env: {
        CI: "true",
        SHOCKAUDIT_EXPECTED_COMMIT: workersCommit,
        WORKERS_CI_COMMIT_SHA: workersCommit,
      },
      readGitMarker: () => "deadbee",
    })).toBe("89abcde");
  });

  it("rejects invalid or conflicting Cloudflare commit evidence", () => {
    const expectedCommit = "0123456789abcdef0123456789abcdef01234567";
    const differentCommit = "89abcdef0123456789abcdef0123456789abcdef";
    expect(() => resolveExpectedBuildMarker({
      env: { CI: "true", WORKERS_CI_COMMIT_SHA: "89abcde" },
      readGitMarker: () => "89abcde",
    })).toThrow(/WORKERS_CI_COMMIT_SHA must be the full lowercase 40-hex/iu);
    expect(() => resolveExpectedBuildMarker({
      env: { CI: "true", WORKERS_CI_COMMIT_SHA: "" },
      readGitMarker: () => "89abcde",
    })).toThrow(/WORKERS_CI_COMMIT_SHA must be the full lowercase 40-hex/iu);
    expect(() => resolveExpectedBuildMarker({
      env: {
        CI: "true",
        SHOCKAUDIT_EXPECTED_COMMIT: expectedCommit,
        WORKERS_CI_COMMIT_SHA: differentCommit,
      },
      readGitMarker: () => "0123456",
    })).toThrow(/identify different release commits/iu);
  });

  it("keeps ordinary local builds bound to Git HEAD without extra setup", () => {
    expect(resolveExpectedBuildMarker({
      env: {},
      readGitMarker: () => "abcdef0",
    })).toBe("abcdef0");
  });

  it("passes the exact event commit into the CI build verification step", () => {
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    const buildStep = workflow.match(
      /- name: Compile and verify production artifact([\s\S]*?)- name: Validate frozen generalization benchmarks/u,
    )?.[1];
    expect(buildStep).toContain(
      "SHOCKAUDIT_EXPECTED_COMMIT: ${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(buildStep).toContain("run: timeout 6m npm run build");
  });
});
