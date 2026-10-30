// Diagnostics deliberately project counts, booleans, and closed vocabularies.
// Never spread canonical state, include identifiers, or echo provider prose.
const list = (value) => Array.isArray(value) ? value : [];
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const vocabulary = (value, allowed) => allowed.includes(value) ? value : "unknown";
const funnelFields = [
  "sourceRecordsRetrieved", "uniqueEventLeads", "evaluatedUniqueLeads",
  "duplicatesRemoved", "hardScopePassed", "hardScopeDemonstratedMismatch",
  "hardScopeInsufficientEvidence", "hardScopeMixed", "sourceQualityPassed",
  "substantiveInformationPassed", "relevancePassed", "exposureFeasibilityPassed",
  "qualifiedCandidates", "displayedCandidates", "directCandidates",
  "adjacentCandidates", "broadCandidates", "mismatchCandidates",
  "deeperRetrievalAttempts", "retrievalFailures", "hostContribution",
];
const exclusionCodes = [
  "hard-scope-mismatch", "hard-scope-insufficient-evidence", "industry-mismatch",
  "excluded-insufficient-substantive-information", "insufficient-source-quality",
  "exposure-infeasible", "broad-result-cap", "candidate-limit",
];
const routes = new Map([
  ["bounded-reviewed-event-registry", "reviewed-registry"],
  ["Federal Register API v1 · rules, proposed rules, and notices", "federal-register"],
  ["OpenFEMA Disaster Declarations Summaries v2", "openfema"],
  ["EU Publications Office CELLAR SPARQL", "eu-cellar"],
  ["UK legislation.gov.uk Atom search", "uk-legislation"],
  ["GDACS global event search", "gdacs"],
  ["USGS FDSN earthquake catalog", "usgs"],
  ["Screen 2 exact retrieval funnel and stopping diagnostics", "retrieval-funnel"],
]);
const connectors = [
  "federal-register", "openfema", "eu-cellar", "uk-legislation", "gdacs", "usgs",
];
const expansionSources = [
  "federal-register-api-v1", "openfema-disaster-declarations-v2",
  "eu-cellar-sparql-v1", "uk-legislation-atom-v1",
  "gdacs-event-search-v1", "usgs-earthquake-catalog-v1", "gdelt-doc-v2",
];
for (const connector of connectors) routes.set(`${connector} diagnostics`, connector);
for (const source of expansionSources) {
  routes.set(`${source} diagnostics`, `${source}-diagnostics`);
  for (const role of ["official", "context"]) {
    routes.set(`Screen 2 ${source} · ${role}`, `${source}-expansion`);
  }
}

function grouped(values, field) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left.localeCompare(right))
    .map(([value, total]) => ({ [field]: value, count: total }));
}

export function captureFindDiscoveryDiagnostics(state, summary = {}) {
  const active = list(state?.candidateSets).find((item) =>
    item?.candidateSetSnapshotId === state?.activeCandidateSetSnapshotId);
  const manifest = active?.manifest;
  const funnel = manifest?.funnel;
  const activeIds = new Set(list(active?.candidateSnapshotIds));
  const candidates = list(state?.candidates);
  const activeCandidates = candidates.filter((item) => activeIds.has(item?.candidateSnapshotId));
  const eligible = activeCandidates.filter((item) => item?.qualification?.eligible === true);
  const qualified = eligible.filter((item) =>
    item.qualification.classification !== "mismatch" &&
    list(item.qualification.evidenceSourceIds).length > 0);
  const qualifications = [
    ...activeCandidates.map((item) => item?.qualification),
    ...list(manifest?.exclusions).map((item) => item?.qualification),
  ].filter(Boolean);
  const routeCounts = new Map();
  for (const channel of list(manifest?.channels)) {
    const route = routes.get(channel?.channel) ?? "other-route";
    const status = vocabulary(channel?.status, ["searched", "not-searched", "failed"]);
    const key = `${route}|${status}`;
    const entry = routeCounts.get(key) ?? { route, status, count: 0 };
    entry.count += 1;
    routeCounts.set(key, entry);
  }
  const candidateById = new Map(candidates.map((item) => [item?.candidateSnapshotId, item]));
  const first = [...list(active?.ordering)]
    .sort((left, right) => left.rank - right.rank)
    .find((item) => activeIds.has(item?.candidateSnapshotId) &&
      candidateById.get(item.candidateSnapshotId)?.qualification?.eligible === true);
  const selectedId = first?.candidateSnapshotId ?? list(active?.candidateSnapshotIds)
    .find((id) => candidateById.get(id)?.qualification?.eligible === true);
  const selectedCandidate = candidateById.get(selectedId);
  return {
    schemaVersion: "shockaudit-live-find-diagnostics-v1",
    activeSetStatus: vocabulary(active?.status, ["active", "superseded", "stale-profile"]),
    discoveryStatuses: grouped(list(state?.discoveryRequests).map((item) =>
      vocabulary(item?.status, ["searching", "completed", "completed-empty", "failed", "superseded"])), "status"),
    counts: {
      allCandidates: candidates.length,
      activeCandidateReferences: activeIds.size,
      activeCandidates: activeCandidates.length,
      eligibleActiveCandidates: eligible.length,
      fixedQualifiedActiveCandidates: qualified.length,
      sources: list(state?.sources).length,
      queries: list(manifest?.queryMatrix).length,
      exclusions: list(manifest?.exclusions).length,
      contextLeads: list(manifest?.contextLeads).length,
      contextBridges: list(manifest?.contextBridges).length,
      assessmentRequests: list(state?.assessmentRequests).length,
      assessments: list(state?.assessments).length,
    },
    funnel: Object.fromEntries(funnelFields.map((key) => [key, count(funnel?.[key])])),
    sourceRoutes: [...routeCounts.values()].sort((left, right) =>
      left.route.localeCompare(right.route) || left.status.localeCompare(right.status)),
    contextBridgeStatuses: grouped(
      list(manifest?.contextBridges).map((bridge) => vocabulary(
        bridge?.status,
        ["corroborated", "no-corroboration", "failed"],
      )),
      "status",
    ),
    exclusions: grouped(list(manifest?.exclusions).flatMap((item) => {
      const codes = list(item?.qualification?.exclusionCodes);
      return codes.length ? [...new Set(codes.map((code) =>
        vocabulary(code, exclusionCodes)))] : ["unclassified-exclusion"];
    }), "code"),
    qualificationGates: qualifications.map((item) => ({
      eligible: item.eligible === true,
      classification: vocabulary(item.classification, ["direct", "adjacent", "broad", "mismatch"]),
      hardScopePassed: item.hardScope?.passed === true,
      hardScopeDisposition: vocabulary(item.hardScope?.disposition, [
        "supported", "demonstrated-mismatch", "insufficient-evidence", "mixed",
      ]),
      sourceQualityPassed: ["high", "adequate", "limited"].includes(item.sourceQuality?.status),
      substantiveInformationPassed: item.substantiveOverview?.passed === true,
      identityPresent: item.substantiveOverview?.identity === true,
      changePresent: item.substantiveOverview?.change === true,
      affectedPopulationPresent: item.substantiveOverview?.affectedPopulation === true,
      materialDatePresent: item.substantiveOverview?.materialDate === true,
      exposureFeasible: item.exposureFeasibility?.status !== "infeasible" &&
        ["documented", "plausible", "unclear"].includes(item.exposureFeasibility?.status),
      hasEvidence: list(item.evidenceSourceIds).length > 0,
    })),
    stoppingRuleStatus: vocabulary(manifest?.stoppingRule?.status, ["not-started", "met", "not-met"]),
    gates: {
      activeSetPresent: Boolean(active),
      activeSetActive: active?.status === "active",
      hasDisplayedCandidates: list(active?.candidateSnapshotIds).length > 0,
      selectedCandidateFixedQualified: selectedCandidate?.qualification?.eligible === true &&
        selectedCandidate.qualification.classification !== "mismatch" &&
        list(selectedCandidate.qualification.evidenceSourceIds).length > 0,
      noLegacyAssessmentRequests: Array.isArray(state?.assessmentRequests) && state.assessmentRequests.length === 0,
      noLegacyAssessments: Array.isArray(state?.assessments) && state.assessments.length === 0,
      assessmentUnavailable: summary.assessmentAvailable === false,
      noPreparedRequests: summary.preparedRequestCount === 0,
      noDeliveredRequests: summary.deliveredRequestCount === 0,
      noCompletedRequests: summary.completedRequestCount === 0,
      expectedFunnelSchema: funnel?.schemaVersion === "screen-02-search-funnel-v2",
      displayedCountMatches: Number.isSafeInteger(funnel?.displayedCandidates) &&
        funnel.displayedCandidates === list(active?.candidateSnapshotIds).length,
      qualifiedCountCoversDisplayed: Number.isSafeInteger(funnel?.qualifiedCandidates) &&
        Number.isSafeInteger(funnel?.displayedCandidates) && funnel.qualifiedCandidates >= funnel.displayedCandidates,
      evaluatedCountCoversQualified: Number.isSafeInteger(funnel?.evaluatedUniqueLeads) &&
        Number.isSafeInteger(funnel?.qualifiedCandidates) && funnel.evaluatedUniqueLeads >= funnel.qualifiedCandidates,
      hardScopeDispositionCountsConsistent:
        Number.isSafeInteger(funnel?.hardScopePassed) &&
        Number.isSafeInteger(funnel?.hardScopeDemonstratedMismatch) &&
        Number.isSafeInteger(funnel?.hardScopeInsufficientEvidence) &&
        Number.isSafeInteger(funnel?.hardScopeMixed) &&
        funnel.hardScopePassed + funnel.hardScopeDemonstratedMismatch +
          funnel.hardScopeInsufficientEvidence + funnel.hardScopeMixed ===
            funnel.evaluatedUniqueLeads,
      retrievalFailureCountValid:
        Number.isSafeInteger(funnel?.retrievalFailures) &&
        funnel.retrievalFailures >= 0,
      outcomeValuesNotInspected: manifest?.outcomeValuesInspected === false,
    },
  };
}

export function liveVerifierFailureDiagnostic(error) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Canonical Find state has no fixed-qualified active candidate for Screen 3.") {
    return {
      code: "SA-LIVE-FIND-NO-FIXED-QUALIFIED-CANDIDATE",
      publicMessage: "Canonical Find state has no fixed-qualified active candidate for Screen 3.",
    };
  }
  if (/^Round [1-5] Find did not complete the fixed qualification funnel without retired host assessment work\.$/.test(message)) {
    return {
      code: "SA-LIVE-FIND-QUALIFICATION-CONTRACT",
      publicMessage: "Find did not complete the fixed qualification funnel without retired host assessment work.",
    };
  }
  return {
    code: "SA-LIVE-CONTRACT-FAILURE",
    publicMessage: "Live verification failed after the recorded completed step. See the retained sanitized gate failure.",
  };
}
