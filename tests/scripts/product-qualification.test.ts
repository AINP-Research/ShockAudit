import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { validateProductQualification } from "../../scripts/check-product-qualification.mjs";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const corpusPath = join(repositoryRoot, "docs/qualification/SCREEN-23-GOLD-CORPUS.manifest.json");
const candidateCommit = "1".repeat(40);
const reviewedAt = "2026-08-13T12:00:00.000Z";
const temporaryDirectories = new Set<string>();

function digest(content: string | Buffer) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

afterEach(async () => {
  await Promise.all([...temporaryDirectories].map((path) => rm(path, { recursive: true, force: true })));
  temporaryDirectories.clear();
});

async function buildCompleteBundle() {
  const root = await mkdtemp(join(tmpdir(), "shockaudit-product-qualification-"));
  temporaryDirectories.add(root);
  await mkdir(join(root, "cases"));
  await mkdir(join(root, "packets"));
  await mkdir(join(root, "answer-keys"));
  await mkdir(join(root, "reports"));
  const corpusBytes = await readFile(corpusPath);
  const corpus = JSON.parse(corpusBytes.toString("utf8")) as { cases: Array<{ caseId: string }> };
  const packageMetadata = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8")) as { version: string };
  const artifacts: Array<{ id: string; kind: string; path: string; sha256: string }> = [];

  async function addArtifact(id: string, kind: string, path: string, record: unknown) {
    const content = `${JSON.stringify(record, null, 2)}\n`;
    await writeFile(join(root, path), content, "utf8");
    artifacts.push({ id, kind, path, sha256: digest(content) });
  }

  const candidateFields = {
    candidateCommit,
    appVersion: packageMetadata.version,
    reviewer: "Qualification reviewer",
    reviewedAt,
  };
  for (const definition of corpus.cases) {
    const packetPath = `packets/${definition.caseId}.json`;
    const answerPath = `answer-keys/${definition.caseId}.json`;
    const packet = `${JSON.stringify({ caseId: definition.caseId, frozen: true })}\n`;
    const answer = `${JSON.stringify({ caseId: definition.caseId, independentlyAuthored: true })}\n`;
    await writeFile(join(root, packetPath), packet, "utf8");
    await writeFile(join(root, answerPath), answer, "utf8");
    await addArtifact(`case:${definition.caseId}`, "case-evidence", `cases/${definition.caseId}.json`, {
      schemaVersion: "shockaudit-screen23-case-evidence-v1",
      corpusId: "screen23-eight-case-v1",
      caseId: definition.caseId,
      ...candidateFields,
      frozenSourcePacket: { path: packetPath, sha256: digest(packet), reviewerApproved: true },
      answerKey: { path: answerPath, sha256: digest(answer), independentlyAuthored: true, reviewerApproved: true },
      searchNoRegression: {
        baselineCandidatesPreserved: true,
        baselineFallbackPassed: true,
        identityQualified: true,
        jurisdictionQualified: true,
        auditAnchorUnchanged: true,
        continuationReachable: true,
      },
      factual: {
        criticalFactsTotal: 4,
        criticalFactsSupported: 4,
        falseFacts: 0,
        identityCorrect: true,
        jurisdictionCorrect: true,
        operativeComponentsAssessed: true,
        coverageAssessed: true,
        enforcementAndPenaltiesAssessed: true,
        namedGapsPresent: true,
      },
      timeline: {
        criticalStagesTotal: 4,
        criticalStagesRecalled: 4,
        noncriticalStagesTotal: 5,
        noncriticalStagesRecalled: 4,
        acceptedDates: 4,
        acceptedDatePrecision: 1,
        ambiguousDateGuesses: 0,
        mainDateOptionsPreserved: true,
      },
      provenance: {
        acceptedFields: 8,
        fullyLinkedFields: 8,
        unknownPassageReferences: 0,
        fingerprintMismatches: 0,
        duplicateRenderedLocators: 0,
        actualStageCoverageVerified: true,
        failedSlotsBackfilled: true,
        deterministicFallbackPassed: true,
      },
      journeys: { find: "pass", audit: "pass" },
    });
  }

  await addArtifact("human-usability", "human-usability", "human-usability.json", {
    schemaVersion: "shockaudit-screen23-human-usability-v1",
    ...candidateFields,
    nonEngineeringParticipants: 6,
    ownerUserIncluded: true,
    independentResearchers: 3,
    unaidedTaskSuccessRate: 0.9,
    taskSuccessRates: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    medianSus: 80,
    meanComprehension: 4.2,
    criticalMisconceptions: 0,
  });
  await addArtifact("domain-review", "domain-review", "domain-review.json", {
    schemaVersion: "shockaudit-screen23-domain-review-v1",
    ...candidateFields,
    independentDomainResearchers: 2,
    dimensionMeans: { identity: 4.5, timing: 4.2, coverage: 4.1, downstreamActionability: 4.3 },
    minimumItemRating: 3,
    criticalFalsehoods: 0,
  });
  await addArtifact("performance-cost", "performance-cost", "performance-cost.json", {
    schemaVersion: "shockaudit-screen23-performance-cost-v1",
    ...candidateFields,
    samples: { coldOpen: 30, warmRestore: 30, reviewMutation: 100 },
    p95Milliseconds: { coldOpen: 9_000, warmRestore: 1_500, reviewMutation: 1_500 },
    codeCapsEnforced: true,
    indefiniteRequests: 0,
    privacySafeTelemetryVerified: true,
    cost: { declaredP95JourneyBudget: 2, measuredP95JourneyCost: 1.5, regressionPercent: 5 },
  });
  await addArtifact("screen2-expansion", "screen2-expansion", "screen2-expansion.json", {
    schemaVersion: "shockaudit-screen2-production-expansion-evaluation-v0404",
    ...candidateFields,
    endpointClass: "production",
    productionEndpoint: "https://production.example.test",
    screen2ExpansionMode: "on",
    exactHeadVerified: true,
    caseCount: 8,
    findAndAuditCovered: true,
    protectedBaselineParity: true,
    baselineZeroResultRegressions: 0,
    auditAnchorChanges: 0,
    unreachableContinuations: 0,
    recallDeltaPercentagePoints: 2,
    p95AddedLatencyMilliseconds: 500,
    latencyBudgetMilliseconds: 1_000,
    p95AddedCostUnits: 0.1,
    costBudgetUnits: 0.2,
  });
  const broaderDiscoveryReportPath =
    "reports/screen2-broader-discovery.json";
  const broaderDiscoveryReport = `${JSON.stringify({
    schemaVersion: "shockaudit-sanitized-broader-discovery-execution-v1",
    candidateCommit,
    cases: ["US-FTC-ESRB-COPPA", "US-FERC-ORDER-841"],
  })}\n`;
  await writeFile(
    join(root, broaderDiscoveryReportPath),
    broaderDiscoveryReport,
    "utf8",
  );
  await addArtifact(
    "screen2-broader-discovery",
    "screen2-broader-discovery",
    "screen2-broader-discovery.json",
    {
      schemaVersion: "shockaudit-screen2-broader-discovery-evidence-v1",
      ...candidateFields,
      endpointClass: "production",
      productionEndpoint: "https://production.example.test",
      exactHeadVerified: true,
      frozenExecutionRecord: {
        path: broaderDiscoveryReportPath,
        sha256: digest(broaderDiscoveryReport),
        reviewerApproved: true,
      },
      journeys: {
        gaming: {
          caseId: "US-FTC-ESRB-COPPA",
          mode: "find",
          visibleFindControlUsed: true,
          controllingPrimarySourceRetrieved: true,
          sourceBackedQualificationPassed: true,
          candidateRenderedInOriginalPanel: true,
          candidateSelectedInOriginalPanel: true,
          screen3HandoffVerified: true,
          discoveredBeyondPriorRegistryAndConnectorResults: true,
        },
        energy: {
          caseId: "US-FERC-ORDER-841",
          mode: "find",
          visibleFindControlUsed: true,
          controllingPrimarySourceRetrieved: true,
          sourceBackedQualificationPassed: true,
          candidateRenderedInOriginalPanel: true,
          candidateSelectedInOriginalPanel: true,
          screen3HandoffVerified: true,
        },
      },
      emptyResultsRecovery: {
        initialQualifiedCountWasZero: true,
        widerSearchActionWasVisible: true,
        widerSearchCompleted: true,
        sourceBackedCandidateRendered: true,
        blankResultPanelPrevented: true,
        honestShortfallRetainedWhenStillEmpty: true,
      },
      sourcePolicy: {
        newOfficialRouteFamiliesExercised: 1,
        previouslyUnregisteredCandidateIdentities: 1,
        fixedQualificationAppliedToEveryCandidate: true,
        secondaryLeadsRequiredPrimaryEvidence: true,
        sourceCoordinatesVerified: true,
        metadataOnlyCandidatesPromoted: 0,
        secondaryMetadataPromotedToEvidence: 0,
      },
    },
  );
  const networkReportPath =
    "reports/screen2-network-egress-security.json";
  const networkReport = `${JSON.stringify({
    schemaVersion: "shockaudit-sanitized-network-egress-execution-v1",
    candidateCommit,
    result: "pass",
  })}\n`;
  await writeFile(join(root, networkReportPath), networkReport, "utf8");
  await addArtifact(
    "screen2-network-egress-security",
    "screen2-network-egress-security",
    "screen2-network-egress-security.json",
    {
      schemaVersion:
        "shockaudit-screen2-network-egress-security-evidence-v1",
      ...candidateFields,
      executionEnvironment: "production-equivalent-isolated-network-harness",
      exactHeadVerified: true,
      productionTransportPathExercised: true,
      frozenExecutionRecord: {
        path: networkReportPath,
        sha256: digest(networkReport),
        reviewerApproved: true,
      },
      dnsResolution: {
        authoritativeResolutionBeforeEveryRequest: true,
        allAddressAnswersValidated: true,
        literalPrivateAndSpecialUseRejected: true,
        resolvedPrivateAndSpecialUseRejected: true,
        mixedPublicPrivateAnswersRejected: true,
        resolutionFailureRejected: true,
      },
      redirectSecurity: {
        everyHopReresolved: true,
        everyHopAddressValidated: true,
        dnsRebindingBetweenHopsRejected: true,
      },
      peerBinding: {
        connectedPeerAddressObserved: true,
        peerAddressRequiredFromTransport: true,
        peerAddressMatchedValidatedResolution: true,
        peerMismatchRejected: true,
        missingPeerIdentityRejected: true,
      },
      coverage: {
        literalIpv4PrivateAndSpecialUseCases: 20,
        literalIpv6PrivateAndSpecialUseCases: 2,
        resolvedIpv4PrivateAndSpecialUseCases: 1,
        resolvedIpv6PrivateAndSpecialUseCases: 1,
        mixedAddressAnswerCases: 1,
        dnsRebindingCases: 2,
        peerMismatchCases: 1,
        allowedPublicIpv4ControlCases: 1,
        allowedPublicIpv6ControlCases: 1,
        unexpectedOutboundRequests: 0,
      },
      privacyBoundaryPassed: true,
    },
  );
  await addArtifact("production-live-v0404", "production-live-v0404", "production-live-v0404.json", {
    schemaVersion: "shockaudit-production-live-v0404",
    ...candidateFields,
    endpointClass: "production",
    productionEndpoint: "https://production.example.test",
    productReleaseLabel: "v0.4.08",
    uiResourceUri: "ui://shockaudit/workspace-v0.4.08.html",
    screen2ExpansionMode: "on",
    screen03HostNativeDefault: "off",
    hostReasoningMode: "experimental-off",
    ordinaryCasesPassed: 10,
    unsupportedCasesPassed: 2,
    screen03RenderedAndOperatedInEveryOrdinaryCase: true,
    findEventRecordsApproved: 2,
    auditEventRecordsApproved: 2,
    liveVerifierRounds: 5,
    liveVerifierRoundsPassed: 5,
    privacyBoundaryPassed: true,
    exactHeadVerified: true,
    currentCatalogVerified: true,
    historicalResourcesVerified: true,
  });
  await addArtifact("owner-approval", "owner-approval", "owner-approval.json", {
    schemaVersion: "shockaudit-screen23-owner-approval-v1",
    ...candidateFields,
    ownerOrUser: true,
    explicitApproval: true,
    decision: "approve-v0.4.08-production",
  });
  const manifest = {
    schemaVersion: "shockaudit-screen23-product-qualification-v1",
    corpusId: "screen23-eight-case-v1",
    corpusDefinitionSha256: digest(corpusBytes),
    completedAt: reviewedAt,
    candidate: {
      commit: candidateCommit,
      appVersion: packageMetadata.version,
      endpointClass: "production",
      endpoint: "https://production.example.test",
    },
    runtime: {
      productReleaseLabel: "v0.4.08",
      uiResourceUri: "ui://shockaudit/workspace-v0.4.08.html",
      screen2ExpansionMode: "on",
      screen03HostNativeDefault: "off",
      hostReasoningMode: "experimental-off",
    },
    artifacts,
  };
  await writeFile(join(root, "qualification-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { root, manifest };
}

async function rewriteArtifact(
  root: string,
  manifest: Awaited<ReturnType<typeof buildCompleteBundle>>["manifest"],
  id: string,
  mutate: (record: Record<string, unknown>) => void,
) {
  const artifact = manifest.artifacts.find((entry) => entry.id === id);
  if (!artifact) throw new Error(`Missing test artifact ${id}.`);
  const artifactPath = join(root, artifact.path);
  const record = JSON.parse(
    await readFile(artifactPath, "utf8"),
  ) as Record<string, unknown>;
  mutate(record);
  const content = `${JSON.stringify(record, null, 2)}\n`;
  await writeFile(artifactPath, content, "utf8");
  artifact.sha256 = digest(content);
  await writeFile(
    join(root, "qualification-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

describe("Screen 2–3 product qualification verifier", () => {
  it("accepts a complete checksum-bound eight-case qualification bundle", async () => {
    const { root } = await buildCompleteBundle();
    const result = await validateProductQualification(root);
    expect(result.issues).toEqual([]);
    expect(result.artifactCount).toBe(16);
  });

  it("requires a passing rate for every prescribed human-usability task", async () => {
    const { root, manifest } = await buildCompleteBundle();
    await rewriteArtifact(root, manifest, "human-usability", (record) => {
      record.taskSuccessRates = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
    });
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "artifact human-usability: all seven prescribed tasks require recorded success rates of at least 85%",
    );
  });

  it("requires positive eligible-source recall gain before expansion promotion", async () => {
    const { root, manifest } = await buildCompleteBundle();
    await rewriteArtifact(root, manifest, "screen2-expansion", (record) => {
      record.recallDeltaPercentagePoints = 0;
    });
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "artifact screen2-expansion: production expansion requires a positive eligible-source recall gain",
    );
  });

  it("fails clearly when required qualification evidence is incomplete", async () => {
    const { root, manifest } = await buildCompleteBundle();
    manifest.artifacts = manifest.artifacts.filter((entry) => entry.id !== "human-usability");
    await writeFile(join(root, "qualification-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const result = await validateProductQualification(root);
    expect(result.issues).toContain("qualification-manifest.json: missing required artifact human-usability");
  });

  it("requires post-deployment evidence to identify the production endpoint", async () => {
    const { root, manifest } = await buildCompleteBundle();
    const tamperedManifest = structuredClone(manifest) as typeof manifest & {
      candidate: { endpointClass: string };
    };
    tamperedManifest.candidate.endpointClass = "isolated-candidate";
    await writeFile(join(root, "qualification-manifest.json"), `${JSON.stringify(tamperedManifest, null, 2)}\n`, "utf8");
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "qualification-manifest.json: frozen release must identify the production endpoint",
    );
  });

  it("rejects a manifest whose canonical corpus binding was tampered", async () => {
    const { root, manifest } = await buildCompleteBundle();
    manifest.corpusDefinitionSha256 = `sha256:${"0".repeat(64)}`;
    await writeFile(join(root, "qualification-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const result = await validateProductQualification(root);
    expect(result.issues).toContain("qualification-manifest.json: corpusDefinitionSha256 does not match the canonical eight-case definition");
  });

  it("detects changed bytes in a frozen packet", async () => {
    const { root } = await buildCompleteBundle();
    await writeFile(join(root, "packets/EU-GDPR.json"), "changed after review\n", "utf8");
    const result = await validateProductQualification(root);
    expect(result.issues).toContain("artifact case:EU-GDPR frozenSourcePacket: SHA-256 mismatch; the frozen evidence changed");
  });

  it("detects changed bytes in a frozen broader-discovery execution record", async () => {
    const { root } = await buildCompleteBundle();
    await writeFile(
      join(root, "reports/screen2-broader-discovery.json"),
      "changed after review\n",
      "utf8",
    );
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "artifact screen2-broader-discovery frozenExecutionRecord: SHA-256 mismatch; the frozen evidence changed",
    );
  });

  it("requires the exact v0.4.08 production-live artifact", async () => {
    const { root, manifest } = await buildCompleteBundle();
    manifest.artifacts = manifest.artifacts.filter(
      (entry) => entry.id !== "production-live-v0404",
    );
    await writeFile(
      join(root, "qualification-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "qualification-manifest.json: missing required artifact production-live-v0404",
    );
  });

  it("requires checksum-bound broader-discovery and network-egress evidence", async () => {
    const { root, manifest } = await buildCompleteBundle();
    manifest.artifacts = manifest.artifacts.filter(
      (entry) => entry.id !== "screen2-broader-discovery" &&
        entry.id !== "screen2-network-egress-security",
    );
    await writeFile(
      join(root, "qualification-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    const result = await validateProductQualification(root);
    expect(result.issues).toEqual(expect.arrayContaining([
      "qualification-manifest.json: missing required artifact screen2-broader-discovery",
      "qualification-manifest.json: missing required artifact screen2-network-egress-security",
    ]));
  });

  it("rejects broader discovery that promotes metadata without primary evidence", async () => {
    const { root, manifest } = await buildCompleteBundle();
    await rewriteArtifact(
      root,
      manifest,
      "screen2-broader-discovery",
      (record) => {
        const sourcePolicy = record.sourcePolicy as Record<string, unknown>;
        sourcePolicy.secondaryMetadataPromotedToEvidence = 1;
      },
    );
    const result = await validateProductQualification(root);
    expect(result.issues).toContain(
      "artifact screen2-broader-discovery: metadata-only or secondary discovery material was promoted without controlling primary evidence",
    );
  });

  it("rejects network evidence without resolver, rebinding, and peer binding proof", async () => {
    const { root, manifest } = await buildCompleteBundle();
    await rewriteArtifact(
      root,
      manifest,
      "screen2-network-egress-security",
      (record) => {
        const dns = record.dnsResolution as Record<string, unknown>;
        const redirects = record.redirectSecurity as Record<string, unknown>;
        const peer = record.peerBinding as Record<string, unknown>;
        dns.resolvedPrivateAndSpecialUseRejected = false;
        redirects.dnsRebindingBetweenHopsRejected = false;
        peer.peerAddressMatchedValidatedResolution = false;
      },
    );
    const result = await validateProductQualification(root);
    expect(result.issues).toEqual(expect.arrayContaining([
      "artifact screen2-network-egress-security: dnsResolution.resolvedPrivateAndSpecialUseRejected is not true",
      "artifact screen2-network-egress-security: redirectSecurity.dnsRebindingBetweenHopsRejected is not true",
      "artifact screen2-network-egress-security: peerBinding.peerAddressMatchedValidatedResolution is not true",
    ]));
  });
});
