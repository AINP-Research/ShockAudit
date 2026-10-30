import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  join(process.cwd(), "scripts/verify-build-artifact.mjs"),
  "utf8",
);

describe("replacement deferred build artifact guard", () => {
  it("budgets the Screen 3 handoff contract inside startup", () => {
    expect(verifier).toContain(
      '"screen3-handoff-contract": { raw: 30 * 1024, gzip: 9 * 1024 }',
    );
    expect(verifier).toContain(
      "startupSupportChunkName !== undefined",
    );
  });

  it("declares one narrow Screen 6 current-plan chunk budget", () => {
    expect(verifier).toContain(
      '"Screen6CurrentPlanPanel": { raw: 24 * 1024, gzip: 7 * 1024 }',
    );
    expect(verifier).toContain(
      "for (const logicalName of Object.keys(replacementDeferredChunkBudgets))",
    );
    expect(verifier).toContain(
      "The replacement build must emit exactly one commit-bound ${logicalName} chunk",
    );
    expect(verifier).toContain(
      "expectedAssetNames.push(...Object.values(replacementDeferredChunkNames))",
    );
    expect(verifier).toContain(
      "...Object.values(replacementDeferredChunkNames),",
    );
  });

  it("keeps the v109 app narrow and the aggregate startup ceiling unchanged", () => {
    expect(verifier).toContain("raw: 1_216 * 1024");
    expect(verifier).toContain("gzip: 306 * 1024");
    expect(verifier).toContain("raw: 1_310 * 1024");
    expect(verifier).toContain("gzip: 340 * 1024");
    expect(verifier).toContain(
      "The aggregate startup JavaScript exceeded its unchanged release budget",
    );
  });

  it("retains exact unexpected-asset and paired-build rejection", () => {
    expect(verifier).toContain(
      "JSON.stringify(emittedAssetNames) !==\n  JSON.stringify(expectedAssetNames)",
    );
    expect(verifier).toContain(
      "dist/assets must contain only the stable app/CSS and exactly declared startup/deferred chunks",
    );
    expect(verifier).toContain(
      "!owner.includes(chunkName)",
    );
    expect(verifier).toContain(
      "!deferred.includes(`./shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`)",
    );
  });
});
