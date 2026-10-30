import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { selectRepositoryCheck } from
  "../../scripts/run-repository-check.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("repository check routing", () => {
  it("keeps the complete suite as the default repository check", () => {
    expect(selectRepositoryCheck({})).toBe("check:full");
  });

  it("uses the bounded duplicate-free check only for an exact Workers Builds commit", () => {
    expect(selectRepositoryCheck({
      WORKERS_CI_COMMIT_SHA: "a".repeat(40),
    })).toBe("check:cloudflare");
    expect(() => selectRepositoryCheck({
      WORKERS_CI_COMMIT_SHA: "not-a-commit",
    })).toThrow(/40-character commit/u);
  });

  it("preserves full local checks and guarded production deployment", () => {
    const packageJson = JSON.parse(readFileSync(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    ));
    expect(packageJson.scripts.check).toBe(
      "node scripts/run-repository-check.mjs",
    );
    expect(packageJson.scripts["check:full"]).toBe(
      "npm run test:release && npm run build && npm run check:release-gates",
    );
    expect(packageJson.scripts["check:cloudflare"]).toBe(
      "npm run build && npm run check:release-gates",
    );
    expect(packageJson.scripts.deploy).toBe(
      "npm run check && npm run deploy:production",
    );
  });
});
