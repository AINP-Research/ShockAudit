import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import packageMetadata from "../../package.json";
import {
  SCREEN_01_UI_RESOURCE_URI,
  LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS,
  RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS,
  SHOCKAUDIT_UI_BUILD_LABEL,
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
  SHOCKAUDIT_RELEASE_LABEL,
  SHOCKAUDIT_VERSION,
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
} from "../../src/version";
import {
  SHOCKAUDIT_HOST_REASONING_META_KEY,
  SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES,
  UI_RESOURCE_MIME,
  UI_RESOURCE_URI,
  hostReasoningMetadata,
  hostReasoningToolExposure,
} from "../../src/worker/server";
import {
  SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
  SCREEN_03_DOCUMENT_MAX_FETCHES,
  SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS,
} from "../../src/worker/screen03-evidence-service";
import { SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID } from
  "../../src/core/six-screen/workflow-response-contract";

describe("ChatGPT UI resource contract", () => {
  it("uses signed ChatGPT-host reasoning without a Cloudflare AI binding", () => {
    const server = readFileSync(
      new URL("../../src/worker/server.ts", import.meta.url),
      "utf8",
    );

    expect(server).toContain('registerScreen01HostDraftTools(server, {');
    expect(server).toContain(
      "registerScreen03WorkflowTools(server, screen03Runtime, {",
    );
    expect(server).toContain(
      "hostNativeDefault: screen03HostNativeDefault",
    );
    expect(server).toContain('legacyHostAssessments: false');
    expect(server).toContain('historicalHostToolVisibility: "app-only"');
    expect(server).toContain("hostReasoningMetadata: hostReasoningMeta");
    expect(server).toContain("hostDraftSigning:");
    expect(server).not.toContain("env.AI");
    expect(server).not.toContain("createScreen03WorkersAi");
  });

  it("routes production Screen 3 retrieval through the fixed official-source adapter", () => {
    const server = readFileSync(
      new URL("../../src/worker/server.ts", import.meta.url),
      "utf8",
    );

    expect(server).toContain(
      "return env.CONNECTOR_FETCH ?? screen02ProductionPeerBoundFetch;",
    );
    expect(server).toContain("fetch: screen02DocumentFetch(env),");
    expect(server).not.toContain(
      "fetch: env.CONNECTOR_FETCH ?? globalThis.fetch.bind(globalThis),",
    );
  });

  it("wires only the dedicated Screen 5 OpenAI transport in server composition", () => {
    const server = readFileSync(
      new URL("../../src/worker/server.ts", import.meta.url),
      "utf8",
    );

    expect(server).toContain(
      "screen5OpenAIFetch: screen5OpenAIInferenceFetch(env),",
    );
    expect(server).toContain("screen5OpenAIMode: env.SHOCKAUDIT_SCREEN5_OPENAI_MODE");
    expect(server).not.toContain("SHOCKAUDIT_SCREEN5_PROVIDER");
    expect(server).not.toContain("SHOCKAUDIT_OPENAI_MODEL");
    expect(server).not.toContain("SHOCKAUDIT_OPENAI_REASONING_EFFORT");
    expect(server).not.toContain("screen5MechanismFetch");
    expect(server).not.toContain("SCREEN5_MECHANISM_FETCH");
    expect(server).not.toContain("GROQ_API_KEY");
  });

  it("maps the host-reasoning release flag and UI metadata fail-closed", () => {
    for (const configured of [undefined, "experimental-off", "on", true]) {
      expect(hostReasoningToolExposure({
        SHOCKAUDIT_HOST_REASONING_MODE: configured as never,
      })).toBe("disabled");
      expect(hostReasoningMetadata({
        SHOCKAUDIT_HOST_REASONING_MODE: configured as never,
      })).toEqual({
        mode: "experimental-off",
        enabled: false,
        genuineTraceCount: 0,
        availableTaskTypes: [],
      });
    }
    expect(hostReasoningToolExposure({
      SHOCKAUDIT_HOST_REASONING_MODE: "app-only",
    })).toBe("app-only");
    expect(hostReasoningMetadata({
      SHOCKAUDIT_HOST_REASONING_MODE: "app-only",
    })).toEqual({
      mode: "app-only",
      enabled: false,
      genuineTraceCount: 0,
      availableTaskTypes: [],
    });
    expect(hostReasoningToolExposure({
      SHOCKAUDIT_HOST_REASONING_MODE: "full",
    })).toBe("full");
    expect(hostReasoningMetadata({
      SHOCKAUDIT_HOST_REASONING_MODE: "full",
    })).toEqual({
      mode: "full",
      enabled: true,
      genuineTraceCount: 0,
      availableTaskTypes: [...SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES],
    });
    expect(SHOCKAUDIT_HOST_REASONING_META_KEY).toBe(
      "shockaudit/hostReasoning",
    );
  });

  it("keeps the documented Screen 3 document budget aligned with runtime bounds", () => {
    expect({
      attempts: SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
      usableSlots: SCREEN_03_DOCUMENT_MAX_FETCHES,
      pdfConversions: SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS,
    }).toEqual({ attempts: 4, usableSlots: 3, pdfConversions: 2 });

    const architecture = readFileSync(
      new URL("../../docs/ARCHITECTURE.md", import.meta.url),
      "utf8",
    );
    const screen03 = readFileSync(
      new URL("../../docs/compatibility/document-acquisition.md", import.meta.url),
      "utf8",
    );
    expect(architecture).toMatch(
      /four additional bounded HTTPS document\s+attempts to fill three usable document-text slots/i,
    );
    expect(architecture).toMatch(
      /production runtime has no model-backed document converter/i,
    );
    expect(screen03).toMatch(
      /four document attempts to fill three usable document-text slots/i,
    );
    expect(screen03).toMatch(
      /PDF[\s\S]{0,160}explicit extraction gap/i,
    );
  });

  it("uses the MCP Apps HTML MIME type", () => {
    expect(UI_RESOURCE_MIME).toBe("text/html;profile=mcp-app");
  });

  it("uses a versioned ui:// resource URI", () => {
    expect(UI_RESOURCE_URI).toBe(SCREEN_01_UI_RESOURCE_URI);
    expect(UI_RESOURCE_URI).toBe(SHOCKAUDIT_UI_RESOURCE_URI);
    expect(UI_RESOURCE_URI).toBe(
      `ui://shockaudit/workspace-v${SHOCKAUDIT_UI_BUILD_LABEL}.html`,
    );
  });

  it("keeps the local repair resource and every deployed UI resource available", () => {
    expect(RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS).not.toContain(
      SHOCKAUDIT_UI_RESOURCE_URI,
    );
    expect(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS).toEqual([
      SHOCKAUDIT_UI_RESOURCE_URI,
      ...LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS,
    ]);
    expect(new Set(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS)).toEqual(new Set([
      SHOCKAUDIT_UI_RESOURCE_URI,
      ...RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS,
    ]));
    expect(new Set(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS).size).toBe(
      SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS.length,
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.6.2-six-screen-integrated-v25-r1.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.2.15.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.2.18.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.2.19.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.2.28.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.01.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.02.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.03.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.04.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.05.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.07.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.08.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.09.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.10.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.11.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.12.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.13.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.14.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.15.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.16.html",
    );
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      "ui://shockaudit/workspace-v0.3.17.html",
    );
  });

  it("keeps the package, server, and UI resource versions aligned", () => {
    expect(SHOCKAUDIT_VERSION).toBe(packageMetadata.version);
    expect(SHOCKAUDIT_VERSION).toBe("0.6.2");
    expect(SHOCKAUDIT_RELEASE_LABEL).toBe("0.6.2");
    expect(SHOCKAUDIT_UI_BUILD_LABEL).toBe(
      "0.6.2-production-v109-r1",
    );
    expect(SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI).toBe(
      "ui://shockaudit/workspace-v0.6.2-production-v109-r1.html",
    );
    expect(SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI).toBe(
      SHOCKAUDIT_UI_RESOURCE_URI,
    );
    expect(SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID).toBe(
      "production-six-screen-handoff-2026-10-25-v109-r1",
    );
    expect(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS).toContain(
      SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
    );
  });

  it("replaces the dark bootstrap text color when the light app mounts", () => {
    const globalCss = readFileSync(
      new URL("../../src/ui/global.css", import.meta.url),
      "utf8",
    );
    expect(globalCss).toMatch(
      /body\s*\{[^}]*background:\s*var\(--paper\);[^}]*color:\s*var\(--ink\);/su,
    );
  });

  it("shows the detailed automatic-research status instead of discarding it", () => {
    const appSource = readFileSync(
      new URL("../../src/ui/six-screen/SixScreenApp.tsx", import.meta.url),
      "utf8",
    );
    expect(appSource.match(/\{policyAutomation\.message \|\|/gu))
      .toHaveLength(2);
  });

  it("keeps Stage 6 verification release-aware and preserves the prior evidence fixtures", () => {
    const evidenceVerifier = readFileSync(
      new URL("../../scripts/verify-stage6-evidence.mjs", import.meta.url),
      "utf8",
    );
    expect(evidenceVerifier).toContain(
      "const expectedReleaseVersion = packageMetadata.version;",
    );
    expect(evidenceVerifier).toContain(
      "parsed.targetReleaseVersion !== expectedReleaseVersion",
    );

    for (const path of [
      "../../docs/evidence/STAGE-6-RUN-MANIFEST.template.json",
      "../../docs/evidence/STAGE-6-ASSESSMENT-UNAVAILABLE-CONTROL.template.json",
      "../../docs/evidence/STAGE-6-NEGATIVE-SECURITY-CONTROL.template.json",
      "../../docs/evidence/STAGE-6-FIXED-FALLBACK-CONTROL.template.json",
    ]) {
      const template = JSON.parse(
        readFileSync(new URL(path, import.meta.url), "utf8"),
      ) as { targetReleaseVersion?: unknown };
      expect(template.targetReleaseVersion, path).toBe("0.3.13");
    }

    const acceptanceIndex = readFileSync(
      new URL(
        "../../docs/evidence/STAGE-6-ACCEPTANCE-INDEX.template.md",
        import.meta.url,
      ),
      "utf8",
    );
    const acceptanceTargetVersion = acceptanceIndex.match(
      /^- Target release version: `([^`]+)`$/m,
    )?.[1];
    expect(acceptanceTargetVersion).toBe("0.3.13");
  });

  it("retires candidate Workers from the current production release path", () => {
    const packageScripts: Record<string, string> = packageMetadata.scripts;
    expect(packageScripts).not.toHaveProperty("deploy:candidate");
    expect(packageScripts).not.toHaveProperty("deploy:candidate:on");
    expect(packageMetadata.overrides).toMatchObject({
      "fast-uri": "3.1.9",
      qs: "6.17.0",
    });

    // These configurations are retained as historical evidence only. No
    // package script, current CI workflow, or deployment runbook may invoke
    // them for v0.4.04.
    const candidateConfig = readFileSync(
      new URL("../../config/previews/wrangler.stage6-preview.jsonc", import.meta.url),
      "utf8",
    );
    expect(candidateConfig).toContain('"name": "shockaudit-stage6-candidate"');
    expect(candidateConfig).toContain('"workers_dev": true');
    expect(candidateConfig).toContain(
      '"SCREEN02_SEARCH_EXPANSION_MODE": "shadow"',
    );
    expect(candidateConfig).not.toMatch(/"routes?"\s*:/);
    expect(candidateConfig).not.toMatch(/"script_name"\s*:/);

    const onCandidateConfig = readFileSync(
      new URL("../../config/previews/wrangler.stage6-on-preview.jsonc", import.meta.url),
      "utf8",
    );
    expect(onCandidateConfig).toContain(
      '"name": "shockaudit-stage6-on-candidate"',
    );
    expect(onCandidateConfig).toContain(
      '"SCREEN02_SEARCH_EXPANSION_MODE": "on"',
    );
    expect(onCandidateConfig).not.toMatch(/"routes?"\s*:/);

    const productionConfig = readFileSync(
      new URL("../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    expect(productionConfig).toContain(
      '"SCREEN02_SEARCH_EXPANSION_MODE": "on"',
    );
    expect(productionConfig).toContain(
      '"SCREEN02_PUBLIC_EVENT_INDEX_MODE": "on"',
    );
    expect(productionConfig).not.toContain(
      '"SCREEN02_SEARCH_EXPANSION_MODE": "shadow"',
    );
    expect(productionConfig).toContain(
      '"SCREEN03_HOST_NATIVE_DEFAULT": "off"',
    );
    expect(productionConfig).toContain(
      '"SHOCKAUDIT_HOST_REASONING_MODE": "experimental-off"',
    );
    expect(productionConfig).toContain("global_fetch_strictly_public");
    expect(productionConfig).not.toContain(
      '"SCREEN03_HOST_NATIVE_DEFAULT": "on"',
    );
    expect(packageMetadata.scripts["deploy:production"]).toBe(
      "node scripts/verify-production-branch.mjs && wrangler deploy",
    );
    expect(packageMetadata.scripts["update:public-event-index"]).toBe(
      "node scripts/validate-public-event-index.mjs --update",
    );
    expect(packageMetadata.scripts["deploy:production"]).not.toContain(
      "verify-production-qualification",
    );
    const currentCi = readFileSync(
      new URL("../../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    expect(currentCi).not.toMatch(/wrangler\.stage6-(?:on-)?preview\.jsonc/);
    expect(currentCi).toContain("scripts/write-release-gate-evidence.mjs");
    expect(
      packageMetadata.scripts["check:post-deployment-acceptance"],
    ).toBe("node scripts/verify-production-qualification.mjs");

    const qualificationManifest = JSON.parse(readFileSync(
      new URL(
        "../../docs/qualification/templates/QUALIFICATION-MANIFEST.template.json",
        import.meta.url,
      ),
      "utf8",
    )) as {
      runtime: Record<string, unknown>;
      candidate: { endpoint: string };
      artifacts: Array<{ id: string }>;
    };
    const productionLive = JSON.parse(readFileSync(
      new URL(
        "../../docs/qualification/templates/PRODUCTION-LIVE-V0404.template.json",
        import.meta.url,
      ),
      "utf8",
    )) as Record<string, unknown>;
    const expansion = JSON.parse(readFileSync(
      new URL(
        "../../docs/qualification/templates/SCREEN2-EXPANSION.template.json",
        import.meta.url,
      ),
      "utf8",
    )) as Record<string, unknown>;
    const broaderDiscovery = JSON.parse(readFileSync(
      new URL(
        "../../docs/qualification/templates/SCREEN2-BROADER-DISCOVERY.template.json",
        import.meta.url,
      ),
      "utf8",
    )) as Record<string, unknown>;
    const networkEgressSecurity = JSON.parse(readFileSync(
      new URL(
        "../../docs/qualification/templates/SCREEN2-NETWORK-EGRESS-SECURITY.template.json",
        import.meta.url,
      ),
      "utf8",
    )) as Record<string, unknown>;
    expect(qualificationManifest.artifacts.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "production-live-v0404",
        "screen2-broader-discovery",
        "screen2-network-egress-security",
      ]),
    );
    expect(qualificationManifest.artifacts.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining(["signed-in-candidate", "signed-in-on-candidate"]),
    );
    expect(qualificationManifest.runtime).toMatchObject({
      productReleaseLabel: "v0.4.08",
      uiResourceUri: "ui://shockaudit/workspace-v0.4.08.html",
      screen2ExpansionMode: "on",
      screen03HostNativeDefault: "off",
      hostReasoningMode: "experimental-off",
    });
    for (const record of [productionLive, expansion, broaderDiscovery]) {
      expect(record.endpointClass).toBe("production");
      expect(record.productionEndpoint).toBe(
        qualificationManifest.candidate.endpoint,
      );
    }
    expect(broaderDiscovery.exactHeadVerified).toBe(false);
    expect(networkEgressSecurity).toMatchObject({
      executionEnvironment: "production-equivalent-isolated-network-harness",
      exactHeadVerified: false,
      productionTransportPathExercised: false,
      privacyBoundaryPassed: false,
    });
    const qualificationVerifier = readFileSync(
      new URL("../../scripts/check-product-qualification.mjs", import.meta.url),
      "utf8",
    );
    expect(qualificationVerifier).toContain(
      "record?.productionEndpoint !== candidate.endpoint",
    );
  });

  it("keeps the independent live gate aligned with the exact canonical catalog", () => {
    const liveGate = readFileSync(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );
    const coreCatalog = liveGate.match(
      /const coreToolNames = \[([\s\S]*?)\];/,
    )?.[1];

    expect(coreCatalog).toBeDefined();
    for (const tool of [
      "open_shockaudit_screen_1",
      "draft_scope_contract",
      "confirm_scope_contract",
      "create_screen02_workflow_v024",
      "create_screen02_workflow_v023",
      "open_shockaudit_screen_2",
      "mutate_screen02_workflow_v024",
      "mutate_screen02_workflow_v021",
      "retire_screen02_workflow_v021",
      "open_screen03_workflow_v030",
      "mutate_screen03_workflow_v030",
    ]) {
      expect(coreCatalog).toContain(`"${tool}"`);
    }
    expect(coreCatalog).not.toContain(
      "submit_screen02_find_assessment_draft_v021",
    );
    expect(coreCatalog).not.toContain(
      "submit_screen02_audit_draft_v021",
    );
    for (const identifier of [
      "screen01HostPrepareTool",
      "screen01HostSubmitTool",
      "screen01HostApplyTool",
      "screen03HostPrepareTool",
      "screen03HostSubmitTool",
      "hostTaskPrepareTool",
      "hostTaskStatusTool",
      "hostTaskRecordMessageTool",
      "hostTaskRecordPanelTool",
      "hostTaskCancelTool",
      "screen02SearchReviewSubmitTool",
      "screen03EvidenceMappingSubmitTool",
      "screen03OverviewSubmitTool",
    ]) {
      expect(liveGate).toContain(identifier);
    }
    const screen01SubmitContract = liveGate.match(
      /\[screen01HostSubmitTool\]:\s*\{([\s\S]*?)\n  \},/,
    )?.[1];
    expect(screen01SubmitContract).toContain('visibility: ["app"]');
    expect(screen01SubmitContract).not.toContain('visibility: ["model"]');
    expect(coreCatalog).not.toContain("discover_shock_options");
    expect(coreCatalog).not.toContain("assess_shock_options");
    expect(liveGate).toContain("function expectedToolNamesForHostMode(mode)");
    expect(liveGate).toContain('if (mode === "full")');
    expect(liveGate).toContain('if (mode === "app-only")');
    expect(liveGate).toContain(
      "const expectedToolNames = expectedToolNamesForHostMode(hostReasoning.mode)",
    );
    expect(liveGate).not.toContain("const expectedToolNames = [");
    expect(liveGate).toContain(
      'const hostReasoningMetaKey = "shockaudit/hostReasoning"',
    );
    const briefingGetContract = liveGate.match(
      /\[screen03BriefingGetTool\]:\s*\{([\s\S]*?)\n  \},/,
    )?.[1];
    const briefingRenderContract = liveGate.match(
      /\[screen03BriefingRenderTool\]:\s*\{([\s\S]*?)\n  \},/,
    )?.[1];
    for (const contract of [briefingGetContract, briefingRenderContract]) {
      expect(contract).toContain('visibility: ["app"]');
      expect(contract).toContain("renders: false");
      expect(contract).toContain("widgetAccessible: true");
    }
    expect(liveGate).toContain("const roundsRequired = 5");
    expect(liveGate).not.toContain("assessmentBatchMaxRequests");
    expect(liveGate).toContain(
      '"shockaudit/screen03HostNativeDefault"',
    );
    expect(liveGate).toContain(
      "result._meta[screen03HostNativeDefaultMetaKey] === false",
    );
    expect(liveGate).toContain('currentHostPath: "not-invoked"');
    expect(liveGate).toContain('currentModelRequest: "none"');
    expect(liveGate).toContain("verifyNoCurrentSkillsSurface");
    expect(liveGate).toContain("SIX_SCREEN_REPLACEMENT_BUILD");
    expect(liveGate).toContain("verifySixScreenReplacementWorkflow");
    expect(liveGate).toContain(
      'shockInput: "Hospital Price Transparency Final Rule"',
    );
    expect(liveGate).toContain('shockInput: "Procurement Act 2023"');
    expect(liveGate).toContain(
      "resolvedPrivate.state.displayedCandidateId !== candidate.id",
    );
    expect(liveGate).toContain('action: "display_identity"');
    expect(liveGate).toContain("`${operationPrefix}-display-candidate`");
    expect(liveGate).toContain(
      "confirmationPrivate.state.displayedCandidateId === candidate.id",
    );
    expect(liveGate).toContain("expectedRouteIds: [");
    expect(liveGate).toContain('"exact_federal_register_document"');
    expect(liveGate).toContain('"federal_register_api_excerpt"');
    expect(liveGate).toContain('"uk_legislation_document"');
    expect(liveGate).not.toContain("expectedRouteId:");
    expect(liveGate).toContain("async function mcpRead(method, params = {})");
    expect(liveGate).toContain("error.status !== 503");
    expect(liveGate).toContain("const resourceReadBatchSize = 8");
    expect(liveGate).toContain(
      'batch.map((uri) => mcpRead("resources/read", { uri }))',
    );
    const screen01LiveRouter = liveGate.match(
      /async function confirmedScreen01Context[\s\S]*?\n}/,
    )?.[0];
    expect(screen01LiveRouter).toContain("SIX_SCREEN_REPLACEMENT_BUILD ||");
    expect(screen01LiveRouter).toContain(
      "confirmedDeterministicScreen01Context",
    );
    expect(liveGate).toContain(
      "const deterministicScreen01Mode =\n      SIX_SCREEN_REPLACEMENT_BUILD || fullHostMode",
    );
    expect(liveGate).toContain(
      "(deterministicScreen01Mode\n        ? deterministicScreen01Rounds",
    );
    expect(liveGate).toContain(
      `return [
    ...coreToolNames,
    ...sixScreenWorkflowToolNames,
    ...historicalPacketRenderToolNames,
  ];`,
    );
    expect(liveGate).not.toContain(
      "...sixScreenWorkflowToolNames,\\n    ...legacyDraftToolNames",
    );
    expect(liveGate).toContain('"submit_six_screen_policy_fact_proof"');
    expect(liveGate).toContain('"submit_six_screen_mechanism_proof"');
    expect(liveGate).toContain('"create_six_screen_workflow_v1"');
    expect(liveGate).toContain('"get_six_screen_workflow_v1"');
    expect(liveGate).toContain('"mutate_six_screen_workflow_v1"');
    expect(liveGate).toContain('"shockaudit-six-screen-public-v1"');
    expect(liveGate).toContain('"io.modelcontextprotocol/skills"');
    expect(liveGate).toContain('exchange.payload?.error?.code === -32601');
    expect(liveGate).not.toContain("verifyScreen03SkillImport");
    expect(liveGate).toContain("snapshot.assessmentBatch === null");
    expect(liveGate).toContain("summary.preparedRequestCount === 0");
    expect(liveGate).toContain("shockaudit-rolldown-runtime-");
    expect(liveGate).toContain("shockaudit-screen02-runtime-");
    expect(liveGate).toContain("shockaudit-screen02-engine-");
    expect(liveGate).toContain("preloadMarkers.size === 1");
    expect(liveGate).toContain("startupBuildMarker === expectedCommit");
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.15.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.16.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.17.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.18.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.19.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.20.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.21.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.22.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.23.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.24.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.25.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.26.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.27.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.28.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.2.29.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.00.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.01.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.02.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.03.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.04.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.05.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.06.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.07.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.08.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.09.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.10.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.11.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.12.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.13.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.14.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.15.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.16.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.3.17.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.01.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.02.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.03.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.04.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.06.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.07.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.08.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.4.09.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.5.1.html"');
    expect(liveGate).toContain('"ui://shockaudit/workspace-v0.6.2.html"');
    expect(LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS).toContain("ui://shockaudit/workspace-v0.4.04.html");
    expect(liveGate).toContain(
      'redirect_domains: [\n      "https://files.oaiusercontent.com",\n      "https://usercontent.openai.com",\n      "https://chatgpt.com",\n      "https://www.google.com",\n      "https://scholar.google.com",\n      "https://en.wikipedia.org",\n      "https://federalregister.gov",\n      "https://www.federalregister.gov",\n      "https://openstates.org",\n      "https://v3.openstates.org",\n      "https://govinfo.gov",\n      "https://www.govinfo.gov",\n      "https://ftc.gov",\n      "https://www.ftc.gov",\n      "https://fema.gov",\n      "https://www.fema.gov",\n      "https://eur-lex.europa.eu",\n      "https://publications.europa.eu",\n      "https://climate.ec.europa.eu",\n      "https://commission.europa.eu",\n      "https://digital-markets-act.ec.europa.eu",\n      "https://legislation.gov.uk",\n      "https://www.legislation.gov.uk",\n      "https://gdacs.org",\n      "https://www.gdacs.org",\n      "https://earthquake.usgs.gov",\n      "https://leginfo.legislature.ca.gov",\n      "https://oag.ca.gov",\n      "https://www.sos.ca.gov",\n      "https://vig.cdn.sos.ca.gov",\n      "https://www.irs.gov",\n      "https://www.nhc.noaa.gov",\n      "https://www.sec.gov",\n    ]',
    );

    const mutateAnnotations = liveGate.match(
      /mutate_screen02_workflow_v021:\s*\{[\s\S]*?annotations:\s*(\[[^\]]+\])/,
    )?.[1];
    expect(mutateAnnotations?.replace(/\s/g, "")).toBe(
      "[false,false,true,true]",
    );
  });

  it("keeps the live gate aligned with the public/private workflow boundary", () => {
    const liveGate = readFileSync(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );
    const summaryKeys = liveGate.match(
      /const summaryKeys = \[([\s\S]*?)\];/,
    )?.[1];
    const snapshotKeys = liveGate.match(
      /const snapshotKeys = \[([\s\S]*?)\];/,
    )?.[1];

    expect(summaryKeys).toBeDefined();
    expect(summaryKeys).not.toContain('"runId"');
    expect(summaryKeys).not.toContain('"revision"');
    expect(summaryKeys).not.toContain('"stateFingerprint"');
    expect(snapshotKeys).toContain('"runId"');
    expect(snapshotKeys).toContain('"accessToken"');
    expect(snapshotKeys).toContain('"revision"');
    expect(snapshotKeys).toContain('"stateFingerprint"');
    expect(snapshotKeys).toContain('"stateEnvelope"');
    expect(snapshotKeys).toContain('"assessmentBatch"');
    expect(liveGate).toContain(
      'new Set(["runId", "revision", "stateFingerprint"])',
    );
    expect(liveGate).toContain(
      'new Set(["accessToken", "stateEnvelope", "assessmentBatch"])',
    );
    expect(liveGate).toContain("sensitiveEvidenceKeys");
    expect(liveGate).toContain('"interpretation",');
    expect(liveGate).toContain('"[access-token-redacted]"');
    expect(liveGate).toContain('"[run-id-redacted]"');
  });

  it("requires repeated Find/Audit auth, CAS, retirement, and saved evidence", () => {
    const liveGate = readFileSync(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(liveGate).toContain(
      "async function confirmedScreen01Context(mode, round, hostReasoning)",
    );
    expect(liveGate).toContain("async function confirmedSignedScreen01Context");
    expect(liveGate).toContain(
      "async function confirmedDeterministicScreen01Context",
    );
    expect(liveGate).toContain('hostReasoning.mode === "full"');
    expect(liveGate).toContain(
      "sameCanonicalJsonValue(application.proposedState?.scope, fixture.scope)",
    );
    expect(liveGate).toContain(
      "sameCanonicalJsonValue(context?.scopeContract, fixture.scope)",
    );
    expect(liveGate).toContain("wrongTokenInput.accessToken = changedToken");
    expect(liveGate).toContain('"replayed"');
    expect(liveGate).toContain('"conflict"');
    expect(liveGate).toContain('"retired"');
    expect(liveGate).toContain('"already-absent"');
    expect(liveGate).toContain("firstActiveAuditMatchSnapshotId");
    expect(liveGate).toContain('"audit-open"');
    expect(liveGate).toContain("openedAudit.snapshot.assessmentBatch === null");
    expect(liveGate).toContain("openedAudit.summary.preparedRequestCount === 0");
    expect(liveGate).toContain("assertDeterministicFindDiscovery");
    expect(liveGate).toContain("driveFindSearchToTerminal({");
    expect(liveGate).toContain('"find-search-continue"');
    expect(liveGate).toContain('const terminalFind = completedFindSearch.current');
    expect(liveGate).toContain("assertDeterministicAuditDossier");
    expect(liveGate).toContain("assertDeterministicAuditAssessment");
    expect(liveGate).toContain('"audit-confirm"');
    expect(liveGate).toContain("confirmedIdentity.confirmationSnapshotId");
    expect(liveGate).toContain("candidate?.qualification?.eligible === true");
    expect(liveGate).toContain(
      'candidate.qualification.classification !== "mismatch"',
    );
    expect(liveGate).toContain(
      "candidate.qualification.evidenceSourceIds.length > 0",
    );
    expect(liveGate).toContain(
      'funnel?.schemaVersion === "screen-02-search-funnel-v2"',
    );
    expect(liveGate).toContain("snapshot.assessmentBatch === null");
    expect(liveGate).toContain("summary.preparedRequestCount === 0");
    expect(liveGate).toContain("summary.completedRequestCount");
    expect(liveGate).toContain("deterministicFindRounds === roundsRequired");
    expect(liveGate).toContain(
      "deterministicAuditDossierRounds === roundsRequired",
    );
    expect(liveGate).toContain(
      "deterministicAuditAssessmentRounds === roundsRequired",
    );
    expect(liveGate).toContain("modelSubmissionCount === 0");
    expect(liveGate).toContain(
      'if (!["screen02-only", "full"].includes(hostReasoning.mode))',
    );
    expect(liveGate).toContain('path: "generic-lifecycle-no-model"');
    expect(liveGate).toContain('modelSubmission: "not-invoked"');
    expect(liveGate).not.toContain("completeScreen02HostAssessments");
    expect(liveGate).not.toContain(
      "submit_screen02_find_assessment_draft_v021",
    );
    expect(liveGate).not.toContain("submit_screen02_audit_draft_v021");
    expect(liveGate).not.toContain("callTool(screen02SearchReviewSubmitTool");
    expect(liveGate).not.toContain(
      "callTool(screen03EvidenceMappingSubmitTool",
    );
    expect(liveGate).not.toContain("callTool(screen03OverviewSubmitTool");
    expect(liveGate).toContain(
      "findImmediateOrientations === roundsRequired",
    );
    expect(liveGate).toContain(
      "auditImmediateOrientations === roundsRequired",
    );
    expect(liveGate).toContain(
      '"screen-02-qualified-preliminary"',
    );
    expect(liveGate).toContain(
      "expectedScreen03InitialOrientationProvenance(parentSnapshot)",
    );
    expect(liveGate).toContain(
      'reviewed.state.orientation.provenance === "screen-03-reviewed"',
    );
    expect(liveGate).toContain("function screen03FactualProposals(state)");
    expect(liveGate.match(/screen03FactualProposals\(state\)\.every/g))
      .toHaveLength(2);
    expect(liveGate).toContain("currentHostRequests: 0");
    expect(liveGate).toContain("currentModelRequests: 0");
    expect(liveGate).toContain(
      "sameCanonicalJsonValue(\n          blankAuditState.screen01Baseline,\n          auditContext,\n        )",
    );
    expect(liveGate).toContain("verifyOriginBehavior");
    expect(liveGate).toContain("verifyBodyLimit");
    expect(liveGate).toContain("expectedCommitIsActive");
    expect(liveGate).toContain('"AWAITING_EXPECTED_COMMIT"');
    expect(liveGate).toContain('initialize("/mcp")');
    expect(liveGate).toContain('initialize("/mcp/")');
    expect(liveGate).toContain('"AWAITING_EXPECTED_MCP_VERSION"');
    expect(liveGate).toContain('"x-shockaudit-mcp-failure-phase"');
    expect(liveGate).toContain("MCP_${error.phase");
    expect(liveGate).toContain('"AWAITING_EXPECTED_MCP_RESPONSE"');
    expect(liveGate).toContain('schemaVersion: "screen-02-retention-policy-v1"');
    expect(liveGate).toContain('cleanup: "durable-object-alarm"');
    expect(liveGate).toContain('"verify-live-mcp.json"');
    expect(liveGate).toContain('"verify-live-mcp.md"');
    expect(liveGate).toContain("for (let round = 1; round <= roundsRequired");
  });
});
