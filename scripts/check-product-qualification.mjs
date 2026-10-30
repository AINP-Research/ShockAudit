import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusPath = resolve(
  repositoryRoot,
  "docs/qualification/SCREEN-23-GOLD-CORPUS.manifest.json",
);
const expectedCaseIds = [
  "EU-GDPR",
  "UK-COMMENCEMENT",
  "US-FR-RULE",
  "HURRICANE-FEMA-GDACS",
  "EARTHQUAKE-USGS-GDACS",
  "US-CA-CCPA",
  "US-CA-CPRA",
  "MULTILINGUAL-AMBIGUOUS",
];
const canonicalArtifactKinds = new Map([
  ...expectedCaseIds.map((caseId) => [`case:${caseId}`, "case-evidence"]),
  ["human-usability", "human-usability"],
  ["domain-review", "domain-review"],
  ["performance-cost", "performance-cost"],
  ["screen2-expansion", "screen2-expansion"],
  ["screen2-broader-discovery", "screen2-broader-discovery"],
  ["screen2-network-egress-security", "screen2-network-egress-security"],
  ["production-live-v0404", "production-live-v0404"],
  ["owner-approval", "owner-approval"],
]);
const forbidden = [
  [/s2a_[A-Za-z0-9_-]{43,128}/g, "raw Screen 2 access token"],
  [/s2r_[A-Za-z0-9_-]{43,128}/g, "raw Screen 2 run identifier"],
  [
    /sa2[fa]-(?:capability|receipt)-v1\.[A-Za-z0-9_-]{20,}/g,
    "signed capability or receipt token",
  ],
  [/["'](?:accessToken|capabilityToken|receiptToken|responseKey)["']\s*:/g, "private token field"],
  [/["']stateEnvelope["']\s*:/g, "complete private state envelope"],
  [
    /["']?SCREEN02_WORKFLOW_(?:PREVIOUS_)?SIGNING_KEY(?:_ID)?["']?\s*(?:=|:)/g,
    "assigned workflow signing material",
  ],
];

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isHash(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isFullCommit(value) {
  return typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

function isCanonicalTimestamp(value) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function numberAtLeast(value, minimum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum;
}

function integerAtLeast(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function safeArtifactPath(root, value, label, issues) {
  if (typeof value !== "string" || value.trim() === "" || isAbsolute(value)) {
    issues.push(`${label}: path must be a non-empty relative path`);
    return null;
  }
  const path = resolve(root, value);
  const fromRoot = relative(root, path);
  if (fromRoot === "" || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    issues.push(`${label}: path escapes the qualification directory`);
    return null;
  }
  return path;
}

function sameCandidate(record, candidate, label, issues) {
  if (record?.candidateCommit !== candidate.commit) {
    issues.push(`${label}: candidateCommit does not match the frozen candidate`);
  }
  if (record?.appVersion !== candidate.appVersion) {
    issues.push(`${label}: appVersion does not match the frozen candidate`);
  }
}

function checkReviewer(record, label, issues) {
  if (typeof record?.reviewer !== "string" || record.reviewer.trim().length < 2) {
    issues.push(`${label}: reviewer is missing`);
  }
  if (!isCanonicalTimestamp(record?.reviewedAt)) {
    issues.push(`${label}: reviewedAt must be a canonical ISO timestamp`);
  }
}

async function readJson(path, label, issues) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    issues.push(`${label}: file is unavailable (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
  const text = bytes.toString("utf8");
  for (const [pattern, description] of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) issues.push(`${label}: contains ${description}`);
  }
  try {
    return { bytes, parsed: JSON.parse(text) };
  } catch (error) {
    issues.push(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

async function verifyReference(root, reference, label, issues) {
  const path = safeArtifactPath(root, reference?.path, label, issues);
  if (!path) return;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    issues.push(`${label}: referenced file is unavailable (${error instanceof Error ? error.message : String(error)})`);
    return;
  }
  if (!isHash(reference?.sha256)) {
    issues.push(`${label}: sha256 must be a complete SHA-256 digest`);
  } else if (sha256(bytes) !== reference.sha256) {
    issues.push(`${label}: SHA-256 mismatch; the frozen evidence changed`);
  }
}

function validateCorpus(corpus, issues) {
  if (corpus?.schemaVersion !== "shockaudit-screen23-gold-corpus-v1") {
    issues.push("gold corpus: wrong schemaVersion");
  }
  if (corpus?.corpusId !== "screen23-eight-case-v1" || corpus?.status !== "definition-only") {
    issues.push("gold corpus: wrong corpus identity or status");
  }
  const cases = Array.isArray(corpus?.cases) ? corpus.cases : [];
  const ids = cases.map((entry) => entry?.caseId);
  if (ids.length !== expectedCaseIds.length || new Set(ids).size !== expectedCaseIds.length) {
    issues.push("gold corpus: must contain exactly eight unique cases");
  }
  for (const expected of expectedCaseIds) {
    if (!ids.includes(expected)) issues.push(`gold corpus: missing ${expected}`);
  }
  if (!cases.some((entry) => entry?.requiredModes?.includes("find") && entry.requiredModes.includes("audit"))) {
    issues.push("gold corpus: at least one case must exercise both Find and Audit");
  }
  return new Map(cases.map((entry) => [entry.caseId, entry]));
}

async function validateCaseEvidence(record, definition, root, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen23-case-evidence-v1") {
    issues.push(`${label}: wrong schemaVersion`);
  }
  if (record?.caseId !== definition.caseId || record?.corpusId !== "screen23-eight-case-v1") {
    issues.push(`${label}: case or corpus identity mismatch`);
  }
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (record?.frozenSourcePacket?.reviewerApproved !== true) {
    issues.push(`${label}: frozen source packet is not reviewer-approved`);
  }
  if (record?.answerKey?.independentlyAuthored !== true || record?.answerKey?.reviewerApproved !== true) {
    issues.push(`${label}: answer key is not independent and reviewer-approved`);
  }
  await verifyReference(root, record?.frozenSourcePacket, `${label} frozenSourcePacket`, issues);
  await verifyReference(root, record?.answerKey, `${label} answerKey`, issues);

  const search = record?.searchNoRegression;
  for (const key of [
    "baselineCandidatesPreserved",
    "baselineFallbackPassed",
    "identityQualified",
    "jurisdictionQualified",
    "auditAnchorUnchanged",
    "continuationReachable",
  ]) {
    if (search?.[key] !== true) issues.push(`${label}: searchNoRegression.${key} is not true`);
  }
  const facts = record?.factual;
  if (!numberAtLeast(facts?.criticalFactsTotal, 1) || facts?.criticalFactsSupported !== facts?.criticalFactsTotal) {
    issues.push(`${label}: every critical factual item must be supported`);
  }
  if (facts?.falseFacts !== 0) issues.push(`${label}: falseFacts must be zero`);
  for (const key of ["identityCorrect", "jurisdictionCorrect", "operativeComponentsAssessed", "coverageAssessed", "enforcementAndPenaltiesAssessed", "namedGapsPresent"]) {
    if (facts?.[key] !== true) issues.push(`${label}: factual.${key} is not true`);
  }

  const timeline = record?.timeline;
  if (!numberAtLeast(timeline?.criticalStagesTotal, 1) || timeline?.criticalStagesRecalled !== timeline?.criticalStagesTotal) {
    issues.push(`${label}: critical-stage recall must be 100%`);
  }
  if (!numberAtLeast(timeline?.noncriticalStagesTotal, 0) || !numberAtLeast(timeline?.noncriticalStagesRecalled, 0) || (timeline.noncriticalStagesTotal > 0 && timeline.noncriticalStagesRecalled / timeline.noncriticalStagesTotal < 0.8)) {
    issues.push(`${label}: noncritical-stage recall must be at least 80%`);
  }
  if (!numberAtLeast(timeline?.acceptedDates, 1) || timeline?.acceptedDatePrecision !== 1) {
    issues.push(`${label}: accepted-date precision must be 100%`);
  }
  if (timeline?.ambiguousDateGuesses !== 0 || timeline?.mainDateOptionsPreserved !== true) {
    issues.push(`${label}: ambiguous dates were guessed or main-date options were lost`);
  }

  const provenance = record?.provenance;
  if (!numberAtLeast(provenance?.acceptedFields, 1) || provenance?.fullyLinkedFields !== provenance?.acceptedFields) {
    issues.push(`${label}: every accepted field must be fully evidence-linked`);
  }
  for (const key of ["unknownPassageReferences", "fingerprintMismatches", "duplicateRenderedLocators"]) {
    if (provenance?.[key] !== 0) issues.push(`${label}: provenance.${key} must be zero`);
  }
  if (provenance?.actualStageCoverageVerified !== true || provenance?.failedSlotsBackfilled !== true || provenance?.deterministicFallbackPassed !== true) {
    issues.push(`${label}: provenance coverage, backfill, or deterministic fallback did not pass`);
  }

  for (const mode of definition.requiredModes) {
    if (record?.journeys?.[mode] !== "pass") {
      issues.push(`${label}: required ${mode} journey did not pass`);
    }
  }
}

function validateHuman(record, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen23-human-usability-v1") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (!numberAtLeast(record?.nonEngineeringParticipants, 6)) issues.push(`${label}: requires at least six non-engineering participants`);
  if (record?.ownerUserIncluded !== true) issues.push(`${label}: the owner/user must participate`);
  if (!numberAtLeast(record?.independentResearchers, 3)) issues.push(`${label}: requires at least three independent researchers`);
  if (!numberAtLeast(record?.unaidedTaskSuccessRate, 0.85)) issues.push(`${label}: unaided task success is below 85%`);
  if (!numberAtLeast(record?.medianSus, 75)) issues.push(`${label}: median SUS is below 75`);
  if (!numberAtLeast(record?.meanComprehension, 4)) issues.push(`${label}: mean comprehension is below 4/5`);
  if (record?.criticalMisconceptions !== 0) issues.push(`${label}: critical misconceptions must be zero`);
  if (!Array.isArray(record?.taskSuccessRates) || record.taskSuccessRates.length !== 7 || record.taskSuccessRates.some((value) => !numberAtLeast(value, 0.85))) {
    issues.push(`${label}: all seven prescribed tasks require recorded success rates of at least 85%`);
  }
}

function validateDomain(record, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen23-domain-review-v1") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (!numberAtLeast(record?.independentDomainResearchers, 2)) issues.push(`${label}: requires two independent domain researchers`);
  for (const dimension of ["identity", "timing", "coverage", "downstreamActionability"]) {
    if (!numberAtLeast(record?.dimensionMeans?.[dimension], 4)) issues.push(`${label}: ${dimension} mean is below 4/5`);
  }
  if (!numberAtLeast(record?.minimumItemRating, 3)) issues.push(`${label}: an item rating is below 3/5`);
  if (record?.criticalFalsehoods !== 0) issues.push(`${label}: critical falsehoods must be zero`);
}

function validatePerformance(record, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen23-performance-cost-v1") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (!numberAtLeast(record?.samples?.coldOpen, 30) || !numberAtLeast(record?.samples?.warmRestore, 30) || !numberAtLeast(record?.samples?.reviewMutation, 100)) {
    issues.push(`${label}: requires 30 cold, 30 warm, and 100 mutation samples`);
  }
  if (!numberAtLeast(record?.p95Milliseconds?.coldOpen, 0) || record.p95Milliseconds.coldOpen > 10_000) issues.push(`${label}: cold-open p95 exceeds 10 seconds`);
  if (!numberAtLeast(record?.p95Milliseconds?.warmRestore, 0) || record.p95Milliseconds.warmRestore > 2_000) issues.push(`${label}: warm-restore p95 exceeds 2 seconds`);
  if (!numberAtLeast(record?.p95Milliseconds?.reviewMutation, 0) || record.p95Milliseconds.reviewMutation > 2_000) issues.push(`${label}: mutation p95 exceeds 2 seconds`);
  if (record?.codeCapsEnforced !== true || record?.indefiniteRequests !== 0 || record?.privacySafeTelemetryVerified !== true) {
    issues.push(`${label}: caps, bounded completion, or privacy-safe telemetry did not pass`);
  }
  if (!numberAtLeast(record?.cost?.declaredP95JourneyBudget, 0) || !numberAtLeast(record?.cost?.measuredP95JourneyCost, 0) || record.cost.measuredP95JourneyCost > record.cost.declaredP95JourneyBudget) {
    issues.push(`${label}: measured p95 journey cost exceeds the declared budget`);
  }
  if (!numberAtLeast(record?.cost?.regressionPercent, 0) || record.cost.regressionPercent > 10) issues.push(`${label}: cost regression exceeds 10%`);
}

function validateExpansion(record, candidate, runtime, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen2-production-expansion-evaluation-v0404") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (
    runtime.screen2ExpansionMode !== "on" ||
    record?.endpointClass !== "production" ||
    record?.productionEndpoint !== candidate.endpoint ||
    record?.screen2ExpansionMode !== "on"
  ) {
    issues.push(`${label}: expansion must be evaluated against the exact production endpoint in on mode`);
  }
  if (!numberAtLeast(record?.caseCount, 8) || record?.findAndAuditCovered !== true) issues.push(`${label}: all eight cases and both Screen 2 modes require evaluation`);
  if (record?.protectedBaselineParity !== true || record?.baselineZeroResultRegressions !== 0 || record?.auditAnchorChanges !== 0 || record?.unreachableContinuations !== 0) {
    issues.push(`${label}: protected-baseline parity failed`);
  }
  if (
    typeof record?.recallDeltaPercentagePoints !== "number" ||
    !Number.isFinite(record.recallDeltaPercentagePoints) ||
    record.recallDeltaPercentagePoints <= 0
  ) {
    issues.push(`${label}: production expansion requires a positive eligible-source recall gain`);
  }
  if (!numberAtLeast(record?.p95AddedLatencyMilliseconds, 0) || !numberAtLeast(record?.latencyBudgetMilliseconds, 0) || record.p95AddedLatencyMilliseconds > record.latencyBudgetMilliseconds) {
    issues.push(`${label}: expansion latency is unmeasured or over budget`);
  }
  if (!numberAtLeast(record?.p95AddedCostUnits, 0) || !numberAtLeast(record?.costBudgetUnits, 0) || record.p95AddedCostUnits > record.costBudgetUnits) {
    issues.push(`${label}: expansion cost is unmeasured or over budget`);
  }
  if (record?.exactHeadVerified !== true) issues.push(`${label}: production expansion evidence is not bound to exact HEAD`);
}

async function validateBroaderDiscovery(record, root, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen2-broader-discovery-evidence-v1") {
    issues.push(`${label}: wrong schemaVersion`);
  }
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (
    record?.endpointClass !== "production" ||
    record?.productionEndpoint !== candidate.endpoint ||
    record?.exactHeadVerified !== true
  ) {
    issues.push(`${label}: broader-discovery evidence must exercise the exact production endpoint and HEAD`);
  }
  if (record?.frozenExecutionRecord?.reviewerApproved !== true) {
    issues.push(`${label}: frozen broader-discovery execution record is not reviewer-approved`);
  }
  await verifyReference(
    root,
    record?.frozenExecutionRecord,
    `${label} frozenExecutionRecord`,
    issues,
  );

  const journeys = record?.journeys;
  const requiredJourneys = [
    ["gaming", "US-FTC-ESRB-COPPA"],
    ["energy", "US-FERC-ORDER-841"],
  ];
  for (const [journeyName, caseId] of requiredJourneys) {
    const journey = journeys?.[journeyName];
    if (journey?.caseId !== caseId || journey?.mode !== "find") {
      issues.push(`${label}: ${journeyName} journey identity is not the required Find case`);
    }
    for (const key of [
      "visibleFindControlUsed",
      "controllingPrimarySourceRetrieved",
      "sourceBackedQualificationPassed",
      "candidateRenderedInOriginalPanel",
      "candidateSelectedInOriginalPanel",
      "screen3HandoffVerified",
    ]) {
      if (journey?.[key] !== true) {
        issues.push(`${label}: journeys.${journeyName}.${key} is not true`);
      }
    }
  }
  if (
    journeys?.gaming?.discoveredBeyondPriorRegistryAndConnectorResults !== true
  ) {
    issues.push(`${label}: gaming journey did not prove discovery beyond the prior registry and connector results`);
  }

  const emptyResults = record?.emptyResultsRecovery;
  for (const key of [
    "initialQualifiedCountWasZero",
    "widerSearchActionWasVisible",
    "widerSearchCompleted",
    "sourceBackedCandidateRendered",
    "blankResultPanelPrevented",
    "honestShortfallRetainedWhenStillEmpty",
  ]) {
    if (emptyResults?.[key] !== true) {
      issues.push(`${label}: emptyResultsRecovery.${key} is not true`);
    }
  }

  const sourcePolicy = record?.sourcePolicy;
  if (
    !integerAtLeast(sourcePolicy?.newOfficialRouteFamiliesExercised, 1) ||
    !integerAtLeast(sourcePolicy?.previouslyUnregisteredCandidateIdentities, 1)
  ) {
    issues.push(`${label}: broader discovery did not produce a previously unregistered identity through a new official route`);
  }
  for (const key of [
    "fixedQualificationAppliedToEveryCandidate",
    "secondaryLeadsRequiredPrimaryEvidence",
    "sourceCoordinatesVerified",
  ]) {
    if (sourcePolicy?.[key] !== true) {
      issues.push(`${label}: sourcePolicy.${key} is not true`);
    }
  }
  if (
    sourcePolicy?.metadataOnlyCandidatesPromoted !== 0 ||
    sourcePolicy?.secondaryMetadataPromotedToEvidence !== 0
  ) {
    issues.push(`${label}: metadata-only or secondary discovery material was promoted without controlling primary evidence`);
  }
}

async function validateNetworkEgressSecurity(record, root, candidate, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen2-network-egress-security-evidence-v1") {
    issues.push(`${label}: wrong schemaVersion`);
  }
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (
    record?.executionEnvironment !==
      "production-equivalent-isolated-network-harness" ||
    record?.exactHeadVerified !== true ||
    record?.productionTransportPathExercised !== true
  ) {
    issues.push(`${label}: network evidence must exercise the exact-HEAD production transport path in the isolated security harness`);
  }
  if (record?.frozenExecutionRecord?.reviewerApproved !== true) {
    issues.push(`${label}: frozen network execution record is not reviewer-approved`);
  }
  await verifyReference(
    root,
    record?.frozenExecutionRecord,
    `${label} frozenExecutionRecord`,
    issues,
  );

  const dns = record?.dnsResolution;
  for (const key of [
    "authoritativeResolutionBeforeEveryRequest",
    "allAddressAnswersValidated",
    "literalPrivateAndSpecialUseRejected",
    "resolvedPrivateAndSpecialUseRejected",
    "mixedPublicPrivateAnswersRejected",
    "resolutionFailureRejected",
  ]) {
    if (dns?.[key] !== true) {
      issues.push(`${label}: dnsResolution.${key} is not true`);
    }
  }

  const redirects = record?.redirectSecurity;
  for (const key of [
    "everyHopReresolved",
    "everyHopAddressValidated",
    "dnsRebindingBetweenHopsRejected",
  ]) {
    if (redirects?.[key] !== true) {
      issues.push(`${label}: redirectSecurity.${key} is not true`);
    }
  }

  const peer = record?.peerBinding;
  for (const key of [
    "connectedPeerAddressObserved",
    "peerAddressRequiredFromTransport",
    "peerAddressMatchedValidatedResolution",
    "peerMismatchRejected",
    "missingPeerIdentityRejected",
  ]) {
    if (peer?.[key] !== true) {
      issues.push(`${label}: peerBinding.${key} is not true`);
    }
  }

  const coverage = record?.coverage;
  for (const [key, minimum] of [
    ["literalIpv4PrivateAndSpecialUseCases", 20],
    ["literalIpv6PrivateAndSpecialUseCases", 2],
    ["resolvedIpv4PrivateAndSpecialUseCases", 1],
    ["resolvedIpv6PrivateAndSpecialUseCases", 1],
    ["mixedAddressAnswerCases", 1],
    ["dnsRebindingCases", 2],
    ["peerMismatchCases", 1],
    ["allowedPublicIpv4ControlCases", 1],
    ["allowedPublicIpv6ControlCases", 1],
  ]) {
    if (!integerAtLeast(coverage?.[key], minimum)) {
      issues.push(`${label}: coverage.${key} is below ${minimum}`);
    }
  }
  if (
    coverage?.unexpectedOutboundRequests !== 0 ||
    record?.privacyBoundaryPassed !== true
  ) {
    issues.push(`${label}: network harness made an unexpected request or failed its privacy boundary`);
  }
}

function validateProductionLiveV0404(record, candidate, runtime, label, issues) {
  if (record?.schemaVersion !== "shockaudit-production-live-v0404") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (record?.endpointClass !== "production" || record?.productionEndpoint !== candidate.endpoint) {
    issues.push(`${label}: tests must use the exact frozen production endpoint`);
  }
  if (record?.productReleaseLabel !== "v0.4.08" || record?.uiResourceUri !== "ui://shockaudit/workspace-v0.4.08.html") {
    issues.push(`${label}: product label or UI resource URI is not v0.4.08`);
  }
  if (record?.screen2ExpansionMode !== runtime.screen2ExpansionMode || record?.screen03HostNativeDefault !== "off" || record?.hostReasoningMode !== "experimental-off") {
    issues.push(`${label}: live runtime flags do not match the fail-closed v0.4.08 production contract`);
  }
  if (!numberAtLeast(record?.ordinaryCasesPassed, 10) || !numberAtLeast(record?.unsupportedCasesPassed, 2)) issues.push(`${label}: requires 10 ordinary and 2 unsupported signed-in cases`);
  if (record?.screen03RenderedAndOperatedInEveryOrdinaryCase !== true || !numberAtLeast(record?.findEventRecordsApproved, 2) || !numberAtLeast(record?.auditEventRecordsApproved, 2)) {
    issues.push(`${label}: Screen 3 rendering/operation or Find/Audit approvals are incomplete`);
  }
  if (record?.liveVerifierRounds !== 5 || record?.liveVerifierRoundsPassed !== 5 || record?.privacyBoundaryPassed !== true) {
    issues.push(`${label}: exact-commit five-round live/privacy gate did not pass`);
  }
  if (record?.exactHeadVerified !== true || record?.currentCatalogVerified !== true || record?.historicalResourcesVerified !== true) {
    issues.push(`${label}: exact HEAD, current catalog, and historical resource ledger must all be verified`);
  }
}

function validateOwner(record, candidate, runtime, label, issues) {
  if (record?.schemaVersion !== "shockaudit-screen23-owner-approval-v1") issues.push(`${label}: wrong schemaVersion`);
  sameCandidate(record, candidate, label, issues);
  checkReviewer(record, label, issues);
  if (record?.ownerOrUser !== true || record?.explicitApproval !== true) issues.push(`${label}: explicit owner/user approval is missing`);
  const expectedDecision = "approve-v0.4.08-production";
  if (record?.decision !== expectedDecision) issues.push(`${label}: decision must be ${expectedDecision}`);
}

export async function validateProductQualification(inputRoot) {
  const root = resolve(inputRoot);
  const issues = [];
  const [packageFile, corpusFile, qualificationFile] = await Promise.all([
    readJson(resolve(repositoryRoot, "package.json"), "package.json", issues),
    readJson(corpusPath, "gold corpus", issues),
    readJson(resolve(root, "qualification-manifest.json"), "qualification-manifest.json", issues),
  ]);
  if (!packageFile || !corpusFile || !qualificationFile) return { issues, artifactCount: 0 };

  const caseDefinitions = validateCorpus(corpusFile.parsed, issues);
  const manifest = qualificationFile.parsed;
  if (manifest?.schemaVersion !== "shockaudit-screen23-product-qualification-v1") issues.push("qualification-manifest.json: wrong schemaVersion");
  if (manifest?.corpusId !== "screen23-eight-case-v1") issues.push("qualification-manifest.json: wrong corpusId");
  if (!isHash(manifest?.corpusDefinitionSha256) || manifest.corpusDefinitionSha256 !== sha256(corpusFile.bytes)) {
    issues.push("qualification-manifest.json: corpusDefinitionSha256 does not match the canonical eight-case definition");
  }
  const candidate = manifest?.candidate ?? {};
  if (!isFullCommit(candidate.commit)) issues.push("qualification-manifest.json: candidate.commit must be a full commit");
  if (candidate.appVersion !== packageFile.parsed.version) issues.push("qualification-manifest.json: candidate.appVersion must match package.json");
  if (candidate.endpointClass !== "production" || typeof candidate.endpoint !== "string" || candidate.endpoint.length < 8) {
    issues.push("qualification-manifest.json: frozen release must identify the production endpoint");
  }
  if (!isCanonicalTimestamp(manifest?.completedAt)) issues.push("qualification-manifest.json: completedAt must be a canonical ISO timestamp");
  const runtime = manifest?.runtime ?? {};
  if (
    runtime.productReleaseLabel !== "v0.4.08" ||
    runtime.uiResourceUri !== "ui://shockaudit/workspace-v0.4.08.html" ||
    runtime.screen2ExpansionMode !== "on" ||
    runtime.screen03HostNativeDefault !== "off" ||
    runtime.hostReasoningMode !== "experimental-off"
  ) {
    issues.push("qualification-manifest.json: runtime must identify the exact fail-closed v0.4.08 production contract");
  }

  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  const byId = new Map();
  for (const artifact of artifacts) {
    if (typeof artifact?.id !== "string" || byId.has(artifact.id)) {
      issues.push(`qualification-manifest.json: duplicate or invalid artifact id ${String(artifact?.id)}`);
      continue;
    }
    byId.set(artifact.id, artifact);
  }
  for (const [id, kind] of canonicalArtifactKinds) {
    const artifact = byId.get(id);
    if (!artifact) issues.push(`qualification-manifest.json: missing required artifact ${id}`);
    else if (artifact.kind !== kind) issues.push(`qualification-manifest.json: ${id} must have kind ${kind}`);
  }
  for (const id of byId.keys()) {
    if (!canonicalArtifactKinds.has(id)) issues.push(`qualification-manifest.json: unknown artifact ${id}`);
  }

  for (const [id, artifact] of byId) {
    const label = `artifact ${id}`;
    const path = safeArtifactPath(root, artifact.path, label, issues);
    if (!path) continue;
    const file = await readJson(path, label, issues);
    if (!file) continue;
    if (!isHash(artifact.sha256) || artifact.sha256 !== sha256(file.bytes)) {
      issues.push(`${label}: SHA-256 mismatch; the declared evidence changed`);
      continue;
    }
    if (id.startsWith("case:")) {
      const definition = caseDefinitions.get(id.slice(5));
      if (definition) await validateCaseEvidence(file.parsed, definition, root, candidate, label, issues);
    } else if (id === "human-usability") validateHuman(file.parsed, candidate, label, issues);
    else if (id === "domain-review") validateDomain(file.parsed, candidate, label, issues);
    else if (id === "performance-cost") validatePerformance(file.parsed, candidate, label, issues);
    else if (id === "screen2-expansion") validateExpansion(file.parsed, candidate, runtime, label, issues);
    else if (id === "screen2-broader-discovery") await validateBroaderDiscovery(file.parsed, root, candidate, label, issues);
    else if (id === "screen2-network-egress-security") await validateNetworkEgressSecurity(file.parsed, root, candidate, label, issues);
    else if (id === "production-live-v0404") validateProductionLiveV0404(file.parsed, candidate, runtime, label, issues);
    else if (id === "owner-approval") validateOwner(file.parsed, candidate, runtime, label, issues);
  }
  return { issues, artifactCount: artifacts.length };
}

async function main() {
  const root = resolve(process.argv[2] ?? "artifacts/product-qualification");
  const result = await validateProductQualification(root);
  if (result.issues.length > 0) {
    console.error(`Product qualification is NOT complete (${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}):`);
    for (const issue of result.issues) console.error(`- ${issue}`);
    console.error("No post-deployment acceptance was inferred. Complete and review the required evidence described in docs/qualification/PROTOCOL.md.");
    process.exitCode = 1;
    return;
  }
  console.log(`Post-deployment product acceptance passed for ${result.artifactCount} checksum-bound artifacts and the canonical eight-case corpus.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
