import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  evaluateScreen03Scenario,
  executionFlags,
  parseArguments,
  requireScreen02RetrievalBudget,
  sanitizeEvidence,
  selectCases,
  validateCaseManifest,
} from "../../scripts/verify-production-matrix.mjs";
import {
  localJavaScriptModuleSpecifiers,
  verifyAssetModuleGraph,
} from "../../scripts/verify-asset-module-graph.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const manifestPath = path.join(
  repositoryRoot,
  "scripts/production-matrix-cases.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function everyKey(value: unknown, visit: (key: string) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => everyKey(item, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    visit(key);
    everyKey(item, visit);
  }
}

function structuredObservation() {
  return {
    initial: {
      eventIdentity: {
        canonicalTitle: "General Data Protection Regulation",
        commonNames: ["GDPR"],
        formalIdentifier: "Regulation (EU) 2016/679",
        issuer: "European Parliament and Council",
        issuingJurisdiction: "European Union",
        eventType: "Regulation",
      },
      initialSources: [
        {
          title: "Official record",
          sourcePlatform: "EU official structured metadata",
          publisher: "Publications Office",
          locator: "https://example.eu/record",
          authorityTier: 1,
          status: "retrieved",
          passageCount: 1,
          passageBases: ["official-record-field"],
          officialFields: ["canonical-title"],
        },
      ],
      research: {
        status: "completed",
        queries: [],
        channels: [],
        routes: [],
        stages: [],
        languages: ["en"],
        authorityTiers: [1],
        gaps: [],
        recordsReviewed: 1,
        activeEvidenceCount: 1,
        stoppingRule: { status: "met", note: "Bounded." },
      },
      proposals: [
        {
          group: "identity",
          label: "Canonical title",
          value: "General Data Protection Regulation",
          support: "direct",
          reviewStatus: "proposed",
          uncertainty: null,
          passages: [
            {
              sourceTitle: "Official record",
              sourcePlatform: "EU official structured metadata",
              authorityTier: 1,
              locator: "https://example.eu/record",
              basis: "official-record-field",
              officialField: "canonical-title" as string | null,
              passageNumber: 1,
              exactPassage: "General Data Protection Regulation",
            },
          ],
        },
      ],
      supportCounts: [{ support: "direct", count: 1 }],
      outcomeValuesInspected: false,
    },
    actions: { restoration: "restored-exact-decision" },
  };
}

describe("production matrix input and offline CLI", () => {
  it("runs every case against the exact main release and retains bounded failure evidence", () => {
    const workflow = parseYaml(readFileSync(
      path.join(repositoryRoot, ".github/workflows/live-mcp.yml"),
      "utf8",
    ));
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    const job = workflow.jobs["verify-production-matrix"];
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.needs).toBeUndefined();
    expect(job.permissions).toEqual({ actions: "read", contents: "read" });
    expect(job["continue-on-error"]).toBeUndefined();
    expect(job["timeout-minutes"]).toBe(160);

    const steps = job.steps as Array<{
      uses?: string;
      run?: string;
      if?: string;
      env?: Record<string, string>;
      with?: Record<string, unknown>;
      "continue-on-error"?: boolean;
    }>;
    expect(steps.find((step) => step.uses === "actions/checkout@v4")?.with)
      .toEqual({ ref: "${{ github.sha }}", "fetch-depth": 0 });
    expect(steps.find((step) => step.uses === "actions/setup-node@v4")?.with)
      .toEqual({ "node-version": 22, cache: "npm" });
    expect(steps.some((step) => step.run === "timeout 5m npm ci --no-audit"))
      .toBe(true);
    expect(steps.every((step) => !step["continue-on-error"])).toBe(true);
    const probe = steps.find((step) => step.run?.includes("verify-production-matrix.mjs"));
    expect(probe?.env).toEqual({ SHOCKAUDIT_EXPECTED_COMMIT: "${{ github.sha }}" });
    const command = probe?.run?.match(
      /^timeout 150m node scripts\/verify-production-matrix\.mjs\s+([\s\S]+)$/u,
    );
    expect(command).not.toBeNull();
    const options = parseArguments(command![1]!.trim().split(/\s+/u));
    expect(options.suite).toBe("all");
    expect(options.caseId).toBeNull();
    expect(options.waitSeconds).toBe(1200);
    expect(selectCases(manifest, options.suite, options.caseId)).toHaveLength(22);
    const evidencePath = path.relative(repositoryRoot, options.evidenceDir);
    expect(evidencePath).toBe("artifacts/production-matrix");
    const prepare = steps.find((step) =>
      step.run?.includes("manage-actions-evidence.mjs prepare")
    );
    expect(prepare?.if).toBe("${{ always() && !cancelled() }}");
    expect(prepare?.run).toContain("--profile matrix");
    expect(prepare?.run).toContain("--retention-days 90");
    const upload = steps.find((step) => step.uses === "actions/upload-artifact@v4");
    expect(upload?.if).toContain("steps.prepare_matrix_evidence.outcome == 'success'");
    expect(upload?.with).toEqual({
      name: "production-matrix-${{ github.sha }}-${{ github.run_attempt }}",
      path: "${{ steps.prepare_matrix_evidence.outputs.stage_root }}/",
      "if-no-files-found": "error",
      "retention-days": 90,
      "compression-level": 9,
    });
    const download = steps.find((step) =>
      step.run?.includes("/actions/artifacts/$SHOCKAUDIT_ARTIFACT_ID/zip")
    );
    expect(download?.env?.SHOCKAUDIT_ARTIFACT_ID).toBe(
      "${{ steps.upload_matrix_evidence.outputs.artifact-id }}",
    );
    expect(download?.env?.SHOCKAUDIT_ARTIFACT_DIGEST).toBe(
      "${{ steps.upload_matrix_evidence.outputs.artifact-digest }}",
    );
    expect(steps.find((step) =>
      step.run?.includes("manage-actions-evidence.mjs verify")
    )?.run).toContain("--profile matrix");
    expect(steps.map((step) => step.run ?? "").join("\n"))
      .not.toMatch(/wrangler|deploy:production|verify-live-mcp/iu);
    const liveProbe = workflow.jobs["verify-production"].steps.find(
      (step: { run?: string }) =>
        step.run?.includes("timeout 80m node scripts/verify-live-mcp.mjs"),
    );
    expect(liveProbe?.run).toContain("--wait 1200");
  });

  it("validates exactly 11 Screen 2 and 11 distinct Screen 3 scenarios", () => {
    expect(validateCaseManifest(manifest)).toBe(manifest);
    expect(manifest.screen2).toHaveLength(11);
    expect(manifest.screen3).toHaveLength(11);
    expect(new Set(manifest.screen3.map((item: { scenario: string }) => item.scenario)).size)
      .toBe(11);
    expect(manifest.screen2.filter((item: { repeatSearch: boolean }) => item.repeatSearch))
      .toHaveLength(1);
  });

  it("keeps the case manifest input-only and free of branch fields", () => {
    everyKey(manifest, (key) => {
      if (key !== "expectedMode") expect(key).not.toMatch(/^(?:expected|observed|actual|result|qualification)/iu);
      expect(key).not.toMatch(/branch/iu);
    });
  });

  it("lists all 22 cases without a commit or network access", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/verify-production-matrix.mjs", "--list"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SHOCKAUDIT_EXPECTED_COMMIT: "",
          SHOCKAUDIT_BASE_URL: "https://invalid.example",
        },
      },
    );
    const listed = JSON.parse(output) as { cases: unknown[] };
    expect(listed.cases).toHaveLength(22);
  });

  it("enforces suite, case, wait, and suite/case bounds", () => {
    const parsed = parseArguments([
      "--suite",
      "screen2",
      "--case=s2-cached-repeat",
      "--wait=90",
      "--evidence-dir",
      "./tmp-matrix",
    ]);
    expect(parsed.suite).toBe("screen2");
    expect(parsed.caseId).toBe("s2-cached-repeat");
    expect(parsed.waitSeconds).toBe(90);
    expect(selectCases(manifest, parsed.suite, parsed.caseId)).toHaveLength(1);
    expect(() => parseArguments(["--suite", "everything"])).toThrow(/--suite/u);
    expect(() => parseArguments(["--wait=3601"])).toThrow(/--wait/u);
    expect(() => selectCases(manifest, "screen2", "s3-gdpr")).toThrow(
      /not present/iu,
    );
  });

  it("fails before network access when the full expected commit is absent", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/verify-production-matrix.mjs",
        "--case",
        "s2-cached-repeat",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SHOCKAUDIT_EXPECTED_COMMIT: "",
          SHOCKAUDIT_BASE_URL: "https://invalid.example",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/full 40-hex production commit/iu);
  });
});

describe("production matrix evidence boundaries", () => {
  it("declares simulated, no-human, no-host, non-qualification flags", () => {
    expect(executionFlags).toEqual({
      simulated: true,
      signedIn: false,
      humanInteraction: false,
      genuineHostEvidence: false,
      hostSubmissions: 0,
      formalQualification: false,
    });
  });

  it("has no formal-qualification output path", () => {
    const source = readFileSync(
      path.join(repositoryRoot, "scripts/verify-production-matrix.mjs"),
      "utf8",
    );
    expect(source).not.toMatch(/docs\/qualification/iu);
    expect(source).not.toMatch(/qualification-manifest\.json/iu);
  });

  it("drives each Screen 2 Find search to a terminal canonical result", () => {
    const source = readFileSync(
      path.join(repositoryRoot, "scripts/verify-production-matrix.mjs"),
      "utf8",
    );
    expect(source).toContain("completeScreen02FindSearch(");
    expect(source).toContain('"find-search-continue"');
    expect(source).toContain('readCanonicalWorkflowState(current.snapshot, "find")');
    expect(source.match(/completeScreen02FindSearch\(/gu)).toHaveLength(3);
  });

  it("commit-binds the replacement startup and preserves the legacy import-graph gate", () => {
    const source = readFileSync(
      path.join(repositoryRoot, "scripts/verify-production-matrix.mjs"),
      "utf8",
    );
    expect(source).toContain("SIX_SCREEN_REPLACEMENT_BUILD");
    expect(source).toContain('"create_six_screen_workflow_v1"');
    expect(source).toContain('"get_six_screen_workflow_v1"');
    expect(source).toContain('"mutate_six_screen_workflow_v1"');
    expect(source).toContain('"shockaudit-six-screen-public-v1"');
    expect(source).toContain(
      "`/assets/shockaudit-rolldown-runtime-${expectedCommitShort}.js`",
    );
    expect(source).toContain(
      "`/assets/shockaudit-screen02-runtime-${expectedCommitShort}.js`",
    );
    expect(source).toContain(
      "`/assets/shockaudit-screen02-engine-${expectedCommitShort}.js`",
    );
    expect(source).toContain('fileStem: "Screen02Audit"');
    expect(source).toContain('fileStem: "Screen02Find"');
    expect(source).toContain('fileStem: "host-reasoning-audit"');
    expect(source).toContain("sameJson(assetUrls, expectedAssetUrls)");
    expect(source).toContain("const assetContents = new Map(await Promise.all");
    expect(source).toContain("verifyAssetModuleGraph({");
  });

  it("enforces typed retrieval execution without parsing presentation prose", () => {
    const queryIds = Array.from({ length: 12 }, (_value, index) =>
      `query-${index + 1}`
    );
    const manifest: any = {
      protocolVersion: "screen-02-search-protocol-v4",
      funnel: {
        schemaVersion: "screen-02-search-funnel-v2",
        sourceRecordsRetrieved: 9,
        uniqueEventLeads: 6,
        deeperRetrievalAttempts: 0,
      },
      channels: [{ channel: "presentation", note: "Arbitrary localized text." }],
      queryMatrix: queryIds.map((id) => ({ id })),
      retrievalExecution: {
        schemaVersion: "screen-02-retrieval-execution-v2",
        limits: {
          rawCandidateTarget: 40,
          rawCandidateMaximum: 60,
          qualifiedCandidateTarget: 10,
          minimumGeneralQueryVariants: 12,
          maximumGeneralQueryVariants: 16,
          maximumBaselineRounds: 2,
          maximumDocumentAcquisitions: 24,
          maximumDocumentRedirects: 3,
          documentRequestTimeoutMs: 3_000,
          documentRunTimeoutMs: 45_000,
          documentMaximumBytes: 2 * 1024 * 1024,
          documentTotalBytes: 6 * 1024 * 1024,
          documentConcurrency: 2,
        },
        baseline: {
          phase: "baseline",
          status: "completed",
          queryIds,
          stoppingReason: "routes-exhausted",
          queriesPlanned: 12,
          queriesAttempted: 12,
          queriesSucceeded: 12,
          queriesFailed: 0,
          roundsExecuted: 1,
          recordsReceived: 9,
          proposalsGenerated: 7,
          uniqueProposalsGenerated: 6,
        },
        qualificationRecovery: null,
        aggregate: {
          queriesPlanned: 12,
          queriesAttempted: 12,
          queriesSucceeded: 12,
          queriesFailed: 0,
          roundsExecuted: 1,
          recordsReceived: 9,
          proposalsGenerated: 7,
          uniqueProposalsGenerated: 6,
          terminal: true,
        },
        documentAcquisitions: [],
        outcomeValuesInspected: false,
      },
    };
    expect(requireScreen02RetrievalBudget(manifest)).toMatchObject({
      rawCandidateTarget: 40,
      rawCandidateMaximum: 60,
      qualifiedCandidateTarget: 10,
      queryVariantsPlanned: 12,
      minimumQueryVariants: 12,
      maximumQueryVariants: 16,
      queryRequestsExecuted: 12,
      roundsExecuted: 1,
      maximumRounds: 2,
    });
    manifest.channels[0].note = "完全不同的展示文字";
    expect(requireScreen02RetrievalBudget(manifest).stoppingReason)
      .toBe("routes-exhausted");
    const underBudget = structuredClone(manifest);
    underBudget.retrievalExecution.baseline.queriesPlanned = 11;
    expect(() => requireScreen02RetrievalBudget(underBudget)).toThrow(
      /baseline|12–16-query\/two-round contract/iu,
    );
    const zeroExecution = structuredClone(manifest);
    zeroExecution.retrievalExecution.baseline.queriesAttempted = 0;
    zeroExecution.retrievalExecution.baseline.queriesSucceeded = 0;
    zeroExecution.retrievalExecution.baseline.queryIds = [];
    expect(() => requireScreen02RetrievalBudget(zeroExecution)).toThrow(
      /baseline|aggregate/iu,
    );
    const nonLegal = structuredClone(manifest);
    nonLegal.queryMatrix = queryIds.slice(0, 2).map((id) => ({ id }));
    Object.assign(nonLegal.retrievalExecution.baseline, {
      queryIds: queryIds.slice(0, 2),
      queriesPlanned: 2,
      queriesAttempted: 2,
      queriesSucceeded: 2,
      recordsReceived: 2,
      proposalsGenerated: 2,
      uniqueProposalsGenerated: 2,
    });
    Object.assign(nonLegal.retrievalExecution.aggregate, {
      queriesPlanned: 2,
      queriesAttempted: 2,
      queriesSucceeded: 2,
      recordsReceived: 2,
      proposalsGenerated: 2,
      uniqueProposalsGenerated: 2,
    });
    expect(requireScreen02RetrievalBudget(nonLegal, { generalLegal: false }))
      .toMatchObject({ queryVariantsPlanned: 2 });
  });

  it("recursively verifies literal static and dynamic Screen 2 Find imports", async () => {
    const origin = "https://example.test";
    const marker = "abcdef0";
    const release = "0.4.04";
    const entry = `${origin}/assets/shockaudit-Screen02Find-${marker}.js`;
    const modules = new Map([
      [entry, `import{a}from"./shockaudit-screen02-runtime-${marker}.js";import{b}from"./shockaudit-screen02-engine-${marker}.js";import("./shockaudit-app.js?v=${release}")`],
      [`${origin}/assets/shockaudit-screen02-runtime-${marker}.js`, `import"./shockaudit-rolldown-runtime-${marker}.js";import{b}from"./shockaudit-screen02-engine-${marker}.js"`],
      [`${origin}/assets/shockaudit-screen02-engine-${marker}.js`, `export{a}from"./shockaudit-screen02-runtime-${marker}.js"`],
      [`${origin}/assets/shockaudit-rolldown-runtime-${marker}.js`, "export const runtime=1"],
      [`${origin}/assets/shockaudit-app.js?v=${release}`, `import("./shockaudit-Screen02Find-${marker}.js")`],
    ]);
    expect(localJavaScriptModuleSpecifiers(modules.get(entry)!)).toEqual([
      `./shockaudit-app.js?v=${release}`,
      `./shockaudit-screen02-engine-${marker}.js`,
      `./shockaudit-screen02-runtime-${marker}.js`,
    ]);
    const graph = await verifyAssetModuleGraph({
      entryUrl: entry,
      publicOrigin: origin,
      expectedCommitShort: marker,
      expectedReleaseLabel: release,
      requiredEntrySpecifiers: [
        `./shockaudit-screen02-runtime-${marker}.js`,
        `./shockaudit-screen02-engine-${marker}.js`,
        `./shockaudit-app.js?v=${release}`,
      ],
      fetchModule: async (url) => modules.get(url) ?? "",
    });
    expect(graph.modulePaths).toHaveLength(5);
    expect(graph.edges.length).toBeGreaterThan(5);

    modules.set(
      `${origin}/assets/shockaudit-screen02-engine-${marker}.js`,
      'export{a}from"./shockaudit-screen02-runtime-deadbee.js"',
    );
    await expect(verifyAssetModuleGraph({
      entryUrl: entry,
      publicOrigin: origin,
      expectedCommitShort: marker,
      expectedReleaseLabel: release,
      fetchModule: async (url) => modules.get(url) ?? "",
    })).rejects.toThrow(/unversioned or cross-build/iu);
  });

  it("redacts workflow identifiers, credentials, fingerprints, and raw state", () => {
    const sanitized = sanitizeEvidence({
      caseId: "s3-gdpr",
      runId: "s2r_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
      sourceId: "source-private",
      stateFingerprint: "fnv1a64:0123456789abcdef",
      accessToken: "s2a_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
      rawState: { secret: true },
      note: "request 123e4567-e89b-42d3-a456-426614174000",
    }) as Record<string, unknown>;
    expect(sanitized.caseId).toBe("s3-gdpr");
    expect(sanitized.runId).toBe("[redacted]");
    expect(sanitized.sourceId).toBe("[redacted]");
    expect(sanitized.stateFingerprint).toBe("[redacted]");
    expect(sanitized.accessToken).toBe("[redacted]");
    expect(sanitized.rawState).toBe("[redacted]");
    expect(sanitized.note).toContain("[identifier-redacted]");
  });

  it("passes structured official metadata only with a field-bound identity passage", () => {
    const input = {
      scenario: "structured-metadata",
      claimGroup: "identity",
      targetTerms: ["GDPR", "2016/679"],
    };
    const observation = structuredObservation();
    expect(evaluateScreen03Scenario(input, observation)).toEqual({
      status: "passed",
      reasons: [],
    });
    observation.initial.proposals[0].passages[0].officialField = null;
    const failed = evaluateScreen03Scenario(input, observation);
    expect(failed.status).toBe("failed");
    expect(failed.reasons.join(" ")).toMatch(/structured official field/iu);
  });

  it("requires the corresponding structured field on one active official passage", () => {
    const input = { scenario: "structured-metadata", claimGroup: "identity", targetTerms: ["GDPR"] };
    const split = structuredObservation();
    const original = split.initial.proposals[0]!.passages[0]!;
    split.initial.proposals[0]!.passages = [
      { ...original, officialField: null },
      { ...original, basis: "official-document-passage" },
    ];
    expect(evaluateScreen03Scenario(input, split).status).toBe("failed");
    const wrong = structuredObservation();
    wrong.initial.proposals[0]!.passages[0]!.officialField = "formal-identifier";
    expect(evaluateScreen03Scenario(input, wrong).status).toBe("failed");
    const changed = structuredObservation();
    changed.initial.initialSources[0]!.status = "changed";
    expect(evaluateScreen03Scenario(input, changed).status).toBe("failed");
  });

  it("fails saved-run restoration unless an exact decision restore was observed", () => {
    const observation = structuredObservation();
    const input = {
      scenario: "saved-run-restoration",
      claimGroup: "identity",
      targetTerms: ["GDPR"],
    };
    observation.actions.restoration = "not-attempted";
    expect(evaluateScreen03Scenario(input, observation).status).toBe("failed");
    observation.actions.restoration = "restored-exact-decision";
    expect(evaluateScreen03Scenario(input, observation).status).toBe("passed");
  });
});
