import { gunzipSync } from "node:zlib";

const workflowEnvelopeKeys = [
  "schemaVersion",
  "workflowSchemaVersion",
  "stateKind",
  "encoding",
  "uncompressedBytes",
  "compressedBytes",
  "checksum",
  "payload",
];
const maxCanonicalWorkflowBytes = 2 * 1024 * 1024;
const maxCompressedWorkflowBytes = 196_608;
const maxEncodedWorkflowCharacters = 262_144;

export const serverAssessmentFallbackReasons = Object.freeze([
  "inference-timeout",
  "inference-error",
  "response-invalid",
  "draft-rejected",
  "completion-unavailable",
  "canonical-rejected",
  "local-fixed",
]);

const serverAssessmentFallbackReasonPattern = new RegExp(
  `^fixed-fallback-(${serverAssessmentFallbackReasons.join("|")})-(find|audit)-receipt-` +
    "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  "u",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function serializeDeterministicJsonValue(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeDeterministicJsonValue).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeDeterministicJsonValue(value[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Value is not deterministic JSON.");
}

export function sameCanonicalJsonValue(left, right) {
  try {
    return (
      serializeDeterministicJsonValue(left) ===
      serializeDeterministicJsonValue(right)
    );
  } catch {
    return false;
  }
}

function checksumBytes(bytes) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function fingerprintCanonicalJsonValue(value) {
  return checksumBytes(
    new TextEncoder().encode(serializeDeterministicJsonValue(value)),
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function federalRegisterIdentifierFromVisibleTitle(title) {
  if (typeof title !== "string") return null;
  const normalized = title
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
  const identifiers = [
    ...normalized.matchAll(/\b(?:19|20)\d{2}-\d{4,6}\b/gu),
  ].map((match) => match[0]);
  const distinct = [...new Set(identifiers)];
  return distinct.length === 1 ? distinct[0] : null;
}

function bridgeQueryMatchesIdentifier(query, identifier) {
  if (typeof query !== "string" ||
      !/^(?:19|20)\d{2}-\d{4,6}$/u.test(identifier ?? "")) return false;
  try {
    const url = new URL(query);
    return url.protocol === "https:" &&
      url.hostname === "www.federalregister.gov" &&
      url.port === "" && !url.username && !url.password && !url.hash &&
      url.pathname === "/api/v1/documents.json" &&
      url.searchParams.getAll("conditions[term]").length === 1 &&
      url.searchParams.get("conditions[term]") === identifier;
  } catch {
    return false;
  }
}

function boundedBridgeCoordinate(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 200 && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/**
 * Independently validate the persisted contextual-lead → official-record
 * edge. The verifier intentionally does not rely on the product validator,
 * because a consistently wrong producer and consumer must still fail here.
 */
export function screen02ContextBridgeMismatches(
  manifest,
  label = "Screen 2 manifest",
) {
  if (!isRecord(manifest)) return [`${label} is not an object.`];
  if (!Object.prototype.hasOwnProperty.call(manifest, "contextBridges")) {
    return [];
  }
  const issues = [];
  const bridges = manifest.contextBridges;
  if (!Array.isArray(bridges) || bridges.length > 1) {
    return [`${label} has an invalid bounded contextBridges collection.`];
  }
  const leads = Array.isArray(manifest.contextLeads)
    ? manifest.contextLeads
    : [];
  const queries = Array.isArray(manifest.queryMatrix)
    ? manifest.queryMatrix
    : [];
  if (leads.length > 5 || new Set(leads.map((lead) => lead?.id)).size !==
      leads.length) {
    issues.push(`${label} has invalid or duplicate contextual lead IDs.`);
  }
  if (new Set(queries.map((query) => query?.id)).size !== queries.length) {
    issues.push(`${label} has duplicate bridge query coordinates.`);
  }
  for (const [index, bridge] of bridges.entries()) {
    const bridgeLabel = `${label}.contextBridges[${index}]`;
    if (!hasExactKeys(bridge, [
      "schemaVersion", "contextualLeadId", "bridgeQueryId",
      "formalIdentifier", "returnedOfficialRecordIds", "status",
    ]) ||
      bridge.schemaVersion !== "screen-02-context-official-bridge-v1" ||
      !boundedBridgeCoordinate(bridge.contextualLeadId) ||
      !boundedBridgeCoordinate(bridge.bridgeQueryId) ||
      !/^(?:19|20)\d{2}-\d{4,6}$/u.test(bridge.formalIdentifier ?? "") ||
      !["corroborated", "no-corroboration", "failed"].includes(
        bridge.status,
      ) ||
      !Array.isArray(bridge.returnedOfficialRecordIds) ||
      bridge.returnedOfficialRecordIds.length > 5 ||
      new Set(bridge.returnedOfficialRecordIds).size !==
        bridge.returnedOfficialRecordIds.length ||
      bridge.returnedOfficialRecordIds.some(
        (identifier) => identifier !== bridge.formalIdentifier,
      )) {
      issues.push(`${bridgeLabel} has an invalid typed bridge shape.`);
      continue;
    }
    const returned = bridge.returnedOfficialRecordIds;
    if ((bridge.status === "corroborated" &&
        (returned.length !== 1 || returned[0] !== bridge.formalIdentifier)) ||
      (bridge.status !== "corroborated" && returned.length !== 0)) {
      issues.push(`${bridgeLabel} status contradicts its official results.`);
    }
    const lead = leads.find((item) =>
      isRecord(item) && item.id === bridge.contextualLeadId
    );
    if (!lead || federalRegisterIdentifierFromVisibleTitle(lead.title) !==
        bridge.formalIdentifier) {
      issues.push(`${bridgeLabel} is not bound to one identifier in its cited lead title.`);
    }
    const query = queries.find((item) =>
      isRecord(item) && item.id === bridge.bridgeQueryId
    );
    if (!query || !bridgeQueryMatchesIdentifier(
      query.query,
      bridge.formalIdentifier,
    ) || !sameCanonicalJsonValue(
      query.returnedRecordIds,
      bridge.returnedOfficialRecordIds,
    )) {
      issues.push(`${bridgeLabel} is not bound to its exact official query result.`);
    }
  }
  return issues;
}

const sourceDerivedCompletionNotes = new Set([
  "ChatGPT dossier delivery was unavailable; fixed code completed an identity-only source-derived fixed fallback dossier with explicit evidence gaps before researcher review.",
  "ChatGPT confirmed-event assessment delivery was unavailable; fixed code completed a conservative source-derived fixed fallback assessment with unclear categories and explicit evidence limits before researcher continuation.",
  "ChatGPT candidate review was unavailable; fixed code completed a conservative source-derived candidate assessment with explicit evidence limits before researcher choice.",
]);
const hostCompletionNote =
  "The ChatGPT host accepted this bounded assessment request; only its authenticated model-tool receipt can complete the request.";
const workersAiCompletionNote =
  "The server-side Workers AI preliminary draft was produced; fixed code will validate every requested part before it becomes canonical.";
const fixedFallbackCompletionNote =
  "Workers AI did not produce a usable preliminary draft; the server selected a conservative fixed fallback, which fixed code will validate before it becomes canonical.";
const screen03Boundary =
  "Screen 3 must verify what changed, when it changed, and which organizations were formally covered.";

function completionOriginForCanonicalRequest(state, requestId) {
  const request = state.assessmentRequests?.find((item) =>
    item?.requestId === requestId
  );
  if (!request || request.status !== "completed") return null;
  if (request.lifecycle?.some((event) =>
    sourceDerivedCompletionNotes.has(event?.note)
  )) return "fixed-fallback";
  const delivered = [...(request.lifecycle ?? [])]
    .reverse()
    .find((event) => event?.status === "message-delivered");
  if (delivered?.note === hostCompletionNote) return "chatgpt-host";
  if (delivered?.note === workersAiCompletionNote) return "workers-ai";
  if (delivered?.note === fixedFallbackCompletionNote) return "fixed-fallback";
  return "compatibility-model-tool";
}

function completedAssessmentProjection(state, assessment, coverageRelation) {
  const completionOrigin = completionOriginForCanonicalRequest(
    state,
    assessment?.requestId,
  );
  if (!assessment || !completionOrigin) return null;
  return {
    assessmentId: assessment.assessmentId,
    requestId: assessment.requestId,
    judgment: assessment.overallJudgment,
    judgmentMethod: "fixed-computation",
    completionOrigin,
    studyFit: cloneJson(assessment.studyFit),
    outcomePathway: cloneJson(assessment.outcomePathway),
    coverageRelation: cloneJson(coverageRelation),
    measurementPotential: cloneJson(assessment.measurementPotential),
    mainConcern: assessment.mainConcern,
    nextChecks: [...assessment.nextChecks],
    evidenceSourceIds: [...assessment.evidenceSourceIds],
  };
}

function fixedQualificationAssessmentProjection(qualification) {
  const sourceFingerprint = qualification?.sourceFingerprint;
  if (typeof sourceFingerprint !== "string") return null;
  const conservativeComponent = (explanation) => ({
    category: "unclear",
    explanation,
    evidenceSourceIds: [],
  });
  return {
    assessmentId: `fixed-qualification:${sourceFingerprint}`,
    requestId: `fixed-qualification:no-legacy-request:${sourceFingerprint}`,
    judgment: "not-enough-evidence",
    judgmentMethod: "fixed-computation",
    completionOrigin: "fixed-fallback",
    studyFit: conservativeComponent(
      "Screen 2 fixed qualification screened this candidate for relevance; Screen 3 must verify the event against direct official evidence.",
    ),
    outcomePathway: conservativeComponent(
      "The fixed qualification does not establish a realized or causal outcome pathway.",
    ),
    coverageRelation: null,
    measurementPotential: conservativeComponent(
      "Measurement feasibility remains unverified until the Event Card and exposure boundary are reviewed.",
    ),
    mainConcern: qualification.substantiveOverview?.mainUncertainty,
    nextChecks: [
      "Verify the event identity, timing, covered units, and exposure boundary against direct official evidence in Screen 3.",
    ],
    evidenceSourceIds: [],
  };
}

function projectedSearchManifests(manifests, selectedCandidateId, sourceIds) {
  const carried = new Set(sourceIds);
  return cloneJson(manifests).map((manifest) => {
    const exclusionsByRecordId = new Map();
    for (const exclusion of manifest.exclusions ?? []) {
      const prior = exclusionsByRecordId.get(exclusion.recordId);
      const qualification = exclusion.qualification ?? prior?.qualification;
      exclusionsByRecordId.set(exclusion.recordId, {
        recordId: exclusion.recordId,
        reason: [...new Set([
          ...(prior ? [prior.reason] : []),
          exclusion.reason,
        ])].join(" "),
        ...(qualification ? { qualification: cloneJson(qualification) } : {}),
      });
    }
    manifest.exclusions = [...exclusionsByRecordId.values()];
    const acquisitions = manifest.retrievalExecution?.documentAcquisitions;
    if (Array.isArray(acquisitions)) {
      manifest.retrievalExecution.documentAcquisitions = acquisitions.map(
        (acquisition) => acquisition.candidateId === selectedCandidateId &&
            acquisition.sourceId !== null && carried.has(acquisition.sourceId)
          ? acquisition
          : { ...acquisition, sourceId: null },
      );
    }
    return manifest;
  });
}

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((item) => right.includes(item));
}

const researcherRetainedResultLanes = new Set([
  "researcher-source",
  "researcher-url",
]);
const reviewedRetainedResultLanes = new Set([
  "reviewed-registry",
  "reviewed-catalog",
]);
const officialRetainedResultLanes = new Set([
  "official-baseline",
  "official-expansion",
  "qualification-recovery",
  "context-official-bridge",
  "host-official",
]);

function selectedRetainedResultView(
  manifests,
  expected,
  mode,
  event,
  state,
  label,
) {
  const issues = [];
  const current = Array.isArray(manifests)
    ? manifests.filter((manifest) =>
      manifest?.protocolVersion === "screen-02-search-protocol-v4"
    )
    : [];
  if (current.length === 0) {
    return { issues, hasCurrentBinding: false, result: null };
  }

  const distinctBindings = [];
  for (const [index, manifest] of current.entries()) {
    const binding = manifest?.retainedResultBinding;
    if (!isRecord(binding) ||
        binding.schemaVersion !== "screen-02-retained-result-binding-v2" ||
        binding.mode !== mode || !isRecord(binding.upstreamAccount) ||
        !Array.isArray(binding.results)) {
      issues.push(`${label} current manifest ${index} has no valid v2 retained-result binding.`);
      continue;
    }
    if (!isRecord(manifest.funnel) ||
        binding.upstreamAccount.sourceRecordsRetrieved !==
          manifest.funnel.sourceRecordsRetrieved ||
        binding.upstreamAccount.uniqueEventLeads !==
          manifest.funnel.uniqueEventLeads) {
      issues.push(`${label} current manifest ${index} retained-result account differs from its funnel.`);
    }

    const selected = binding.results.filter((result) =>
      isRecord(result) && result.snapshotId === expected.snapshotId
    );
    if (selected.length > 1) {
      issues.push(`${label} current manifest ${index} repeats the selected retained result.`);
      continue;
    }
    const result = selected[0];
    if (!result) continue;

    const existing = distinctBindings.find((item) =>
      sameCanonicalJsonValue(item.binding, binding)
    );
    if (!existing) distinctBindings.push({ binding, result, manifest, index });

    if (result.recordId !== expected.recordId ||
        result.snapshotId !== expected.snapshotId ||
        !sameStringSet(result.sourceIds, expected.sourceIds) ||
        result.qualificationLane !== expected.qualificationLane) {
      issues.push(`${label} selected retained-result coordinates differ from canonical state.`);
    }
    const resultSources = new Set(
      Array.isArray(result.sourceIds) ? result.sourceIds : [],
    );
    const accountedSources = new Set();
    const queryById = new Map(
      (Array.isArray(manifest.queryMatrix) ? manifest.queryMatrix : [])
        .filter(isRecord)
        .map((query) => [query.id, query]),
    );
    const baselineQueryIds = new Set(
      Array.isArray(manifest.retrievalExecution?.baseline?.queryIds)
        ? manifest.retrievalExecution.baseline.queryIds
        : [],
    );
    const recoveryQueryIds = new Set(
      Array.isArray(
        manifest.retrievalExecution?.qualificationRecovery?.queryIds,
      )
        ? manifest.retrievalExecution.qualificationRecovery.queryIds
        : [],
    );
    if (!Array.isArray(result.origins) || result.origins.length === 0) {
      issues.push(`${label} selected retained result has no upstream origins.`);
    } else {
      for (const origin of result.origins) {
        if (!isRecord(origin) || !Array.isArray(origin.sourceIds) ||
            origin.sourceIds.some((sourceId) => !resultSources.has(sourceId))) {
          issues.push(`${label} selected retained-result origin cites an unrelated source.`);
          continue;
        }
        origin.sourceIds.forEach((sourceId) => accountedSources.add(sourceId));
        if (origin.kind === "query-result") {
          const query = queryById.get(origin.queryId);
          if (!query || !Array.isArray(query.returnedRecordIds) ||
              !Array.isArray(origin.returnedRecordIds) ||
              origin.returnedRecordIds.some((recordId) =>
                !query.returnedRecordIds.includes(recordId)
              ) ||
              (origin.retrievalLane === "official-baseline" &&
                !baselineQueryIds.has(origin.queryId)) ||
              (origin.retrievalLane === "qualification-recovery" &&
                !recoveryQueryIds.has(origin.queryId))) {
            issues.push(`${label} selected retained-result origin differs from its query result.`);
          }
          if (origin.retrievalLane === "context-official-bridge") {
            const bridge = (
              Array.isArray(manifest.contextBridges)
                ? manifest.contextBridges
                : []
            ).find((candidate) =>
              isRecord(candidate) &&
              candidate.bridgeQueryId === origin.queryId
            );
            if (!bridge || bridge.status !== "corroborated" ||
                !sameStringSet(
                  origin.returnedRecordIds,
                  bridge.returnedOfficialRecordIds,
                )) {
              issues.push(`${label} selected retained-result origin differs from its context bridge.`);
            }
          }
          const originSources = origin.sourceIds.map((sourceId) =>
            state.sources?.find((source) => source?.id === sourceId)
          );
          if (researcherRetainedResultLanes.has(origin.retrievalLane) &&
              originSources.some((source) => source?.userProvided !== true)) {
            issues.push(`${label} selected researcher origin cites a non-researcher source.`);
          }
          const maximumAuthorityTier = reviewedRetainedResultLanes.has(
              origin.retrievalLane,
            )
            ? 2
            : officialRetainedResultLanes.has(origin.retrievalLane)
            ? 3
            : null;
          const requiresOfficialEvidence =
            mode === "find" && maximumAuthorityTier !== null ||
            mode === "audit" && origin.evidenceRole === "identity" &&
              !researcherRetainedResultLanes.has(origin.retrievalLane);
          if (requiresOfficialEvidence &&
              (maximumAuthorityTier === null || originSources.some((source) =>
                !source || source.userProvided === true ||
                !Number.isInteger(source.authorityTier) ||
                source.authorityTier > maximumAuthorityTier
              ))) {
            issues.push(`${label} selected official identity origin lacks official evidence.`);
          }
        } else if (origin.kind === "prior-result" && mode === "find") {
          const application = manifest.hostReviewApplication;
          const priorSet = state.candidateSets?.find((set) =>
            set?.candidateSetSnapshotId === origin.priorCandidateSetSnapshotId
          );
          const priorCandidate = state.candidates?.find((candidate) =>
            candidate?.candidateSnapshotId ===
              origin.priorCandidateSnapshotId
          );
          if (!isRecord(application) ||
              application.originalCandidatePoolId !==
                origin.priorCandidateSetSnapshotId ||
              priorSet?.candidateSetFingerprint !==
                application.originalCandidatePoolFingerprint ||
              !priorSet?.candidateSnapshotIds?.includes(
                origin.priorCandidateSnapshotId,
              ) || priorCandidate?.candidateId !== origin.producerRecordId ||
              result.recordId !== priorCandidate?.candidateId ||
              !sameStringSet(origin.sourceIds, priorCandidate?.sourceIds)) {
            issues.push(`${label} selected carry-forward origin differs from its prior result.`);
          }
        } else {
          issues.push(`${label} selected retained result has an invalid origin kind.`);
        }
      }
    }
    if (!sameStringSet([...accountedSources], [...resultSources])) {
      issues.push(`${label} selected retained-result origins do not account for its sources.`);
    }

    const eventSourceIds = Array.isArray(event?.sourceIds) ? event.sourceIds : [];
    if (event?.identitySnapshotId !== expected.identitySnapshotId ||
        (mode === "find"
          ? !sameStringSet(result.sourceIds, eventSourceIds)
          : !Array.isArray(result.sourceIds) || result.sourceIds.some(
            (sourceId) => !eventSourceIds.includes(sourceId)
          ))) {
      issues.push(`${label} selected retained result is not coherent with its event projection.`);
    }
  }

  if (distinctBindings.length !== 1) {
    issues.push(`${label} must resolve the selected snapshot through exactly one distinct retained-result binding.`);
  }
  return {
    issues,
    hasCurrentBinding: true,
    result: distinctBindings.length === 1 ? distinctBindings[0].result : null,
  };
}

function selectedRetainedResultMismatches(state, handoff, expected) {
  const mode = state.mode;
  const canonicalManifests = mode === "find"
    ? state.candidateSets?.map((set) => set.manifest)
    : state.matchSets?.map((set) => set.manifest);
  const canonical = selectedRetainedResultView(
    canonicalManifests,
    expected.selectedBinding,
    mode,
    expected.event,
    state,
    "canonical Screen 2 history",
  );
  const projected = selectedRetainedResultView(
    handoff.history?.searchManifests,
    expected.selectedBinding,
    mode,
    handoff.event,
    state,
    "handoff history",
  );
  const issues = [...canonical.issues, ...projected.issues];
  if (canonical.hasCurrentBinding !== projected.hasCurrentBinding) {
    issues.push("handoff retained-result binding generation differs from canonical history.");
  }
  const reconstructed = canonical.result && Array.isArray(
    canonical.result.origins,
  ) && {
    recordId: expected.selectedBinding.recordId,
    snapshotId: expected.selectedBinding.snapshotId,
    sourceIds: [...expected.selectedBinding.sourceIds],
    qualificationLane: expected.selectedBinding.qualificationLane,
    origins: cloneJson(canonical.result.origins),
  };
  if (reconstructed && projected.result &&
      !sameCanonicalJsonValue(reconstructed, projected.result)) {
    issues.push("handoff selected retained-result binding differs from canonical history.");
  }
  return issues;
}

function sourceFingerprintIssues(sources, label) {
  const issues = [];
  for (const [index, source] of sources.entries()) {
    if (!isRecord(source) || typeof source.sourceFingerprint !== "string") {
      issues.push(`${label}.sources[${index}] omitted its source fingerprint.`);
      continue;
    }
    const { sourceFingerprint, ...input } = source;
    if (sourceFingerprint !== fingerprintCanonicalJsonValue(input)) {
      issues.push(`${label}.sources[${index}] has a false source fingerprint.`);
    }
  }
  return issues;
}

function findHandoffProjection(state) {
  const candidateSnapshotId = state.decision?.tentativeSelectionSnapshotId;
  const candidate = state.candidates?.find((item) =>
    item?.candidateSnapshotId === candidateSnapshotId
  );
  const candidateSet = state.candidateSets?.find((item) =>
    item?.candidateSetSnapshotId === state.activeCandidateSetSnapshotId
  );
  if (!candidate || !candidateSet) return null;
  const selectionIndex = state.decision.history.findLastIndex((item) =>
    item?.action === "tentatively-selected" &&
      item.candidateSnapshotId === candidateSnapshotId
  );
  const selection = state.decision.history[selectionIndex];
  const continuation = state.decision.history.slice(selectionIndex + 1)
    .find((item) => ["continued", "continued-without-assessment"].includes(
      item?.action,
    ) && item.candidateSnapshotId === candidateSnapshotId);
  if (!selection || !continuation) return null;
  const unavailable = continuation.action === "continued-without-assessment";
  const assessment = [...state.assessments].reverse().find((item) => {
    const request = state.assessmentRequests.find((candidateRequest) =>
      candidateRequest?.requestId === item?.requestId
    );
    return item?.candidateSnapshotId === candidateSnapshotId &&
      item.status === "completed" && request?.target?.mode === "find-candidate";
  });
  const preliminaryAssessment = unavailable
    ? cloneJson(continuation.assessmentDisposition)
    : assessment
      ? completedAssessmentProjection(state, assessment, null)
      : fixedQualificationAssessmentProjection(candidate.qualification);
  if (!preliminaryAssessment) return null;
  const event = {
    identitySnapshotId: candidate.candidateSnapshotId,
    identity: cloneJson(candidate.identity),
    description: cloneJson(candidate.description),
    dateLeads: cloneJson(candidate.dateLeads),
    broadCoverage: cloneJson(candidate.broadCoverage),
    highLevelChanges: [],
    keyComponents: [],
    relatedVersions: [],
    sourceIds: [...candidate.sourceIds],
    limitations: [...candidate.limitations],
    settlement: "preliminary-screen-02",
    ...(candidate.qualification
      ? { preliminaryQualification: cloneJson(candidate.qualification) }
      : {}),
  };
  const criterionKeys = new Set(candidateSet.criterionVersionRefs.map((ref) =>
    `${ref.criterionId}:${ref.version}`
  ));
  const criteriaFindings = state.criterionFindings.filter((item) =>
    item.candidateSnapshotId === candidateSnapshotId &&
      criterionKeys.has(`${item.criterionId}:${item.criterionVersion}`)
  );
  const sources = state.sources.filter((source) =>
    candidate.sourceIds.includes(source.id)
  );
  const history = {
    searchManifests: projectedSearchManifests(
      state.candidateSets.map((set) => set.manifest),
      candidate.candidateId,
      candidate.sourceIds,
    ),
    anchorRevisions: [],
    decisions: state.decision.history.map((item) => ({
      id: item.decisionId,
      action: item.action,
      targetSnapshotId: item.candidateSnapshotId,
      at: item.at,
      reason: item.reason,
    })),
  };
  const nextChecks = "nextChecks" in preliminaryAssessment
    ? preliminaryAssessment.nextChecks
    : preliminaryAssessment.mandatoryScreen03Checks;
  return {
    decision: {
      mode: "find",
      candidateSetSnapshotId: candidateSet.candidateSetSnapshotId,
      candidateSnapshotId,
      selectionDecisionId: selection.decisionId,
      continuationDecisionId: continuation.decisionId,
    },
    provenance: {
      mode: "find",
      candidateSetSnapshotId: candidateSet.candidateSetSnapshotId,
      candidateSetFingerprint: candidateSet.candidateSetFingerprint,
      candidateSnapshotId: candidate.candidateSnapshotId,
      candidateFingerprint: candidate.candidateFingerprint,
    },
    event,
    preliminaryAssessment,
    dossierCompletionOrigin: null,
    criteriaFindings: cloneJson(criteriaFindings),
    sources: cloneJson(sources),
    history,
    unresolved: {
      questions: [...candidate.limitations, ...nextChecks],
      provisionalClaimIds: [
        event.description.id,
        ...event.dateLeads.map((item) => item.id),
        ...event.broadCoverage.map((item) => item.id),
      ],
      screen03Boundary,
    },
    selectedBinding: {
      recordId: candidate.candidateId,
      snapshotId: candidate.candidateSnapshotId,
      sourceIds: [...candidate.sourceIds],
      qualificationLane: candidate.qualification?.lane ?? null,
      identitySnapshotId: candidate.candidateSnapshotId,
    },
    fingerprints: {
      candidate: fingerprintCanonicalJsonValue((({
        candidateFingerprint: _ignored,
        ...input
      }) => input)(candidate)),
      candidateSet: fingerprintCanonicalJsonValue((({
        candidateSetFingerprint: _ignored,
        status: _status,
        supersededBySnapshotId: _successor,
        ...input
      }) => input)(candidateSet)),
    },
  };
}

function auditHandoffProjection(state) {
  const confirmed = state.confirmedIdentity;
  const continuation = state.continuationHistory?.at(-1);
  if (!confirmed || !continuation) return null;
  const match = state.possibleMatches.find((item) =>
    item.matchSnapshotId === confirmed.matchSnapshotId
  );
  const matchSet = state.matchSets.find((item) =>
    item.matchSetSnapshotId === confirmed.matchSetSnapshotId
  );
  const dossier = state.dossiers.find((item) =>
    item.dossierSnapshotId === continuation.dossierSnapshotId
  );
  const confirmation = state.identityDecisions.find((item) =>
    item.decisionId === confirmed.decisionId
  );
  if (!match || !matchSet || !dossier || !confirmation) return null;
  const unavailable = Object.prototype.hasOwnProperty.call(
    continuation,
    "assessmentDisposition",
  );
  const assessment = unavailable ? null : state.assessments.find((item) =>
    item.assessmentId === continuation.assessmentId
  );
  const preliminaryAssessment = unavailable
    ? cloneJson(continuation.assessmentDisposition)
    : completedAssessmentProjection(state, assessment, assessment?.coverageRelation);
  if (!preliminaryAssessment) return null;
  const eventSourceIds = [...new Set([
    ...match.sourceIds,
    ...dossier.sourceIds,
  ])];
  const event = {
    identitySnapshotId: match.identitySnapshotId,
    identity: cloneJson(match.identity),
    description: cloneJson(dossier.whatHappened),
    dateLeads: cloneJson(dossier.timeline),
    broadCoverage: cloneJson(dossier.broadCoverage),
    highLevelChanges: cloneJson(dossier.whatChanged),
    keyComponents: cloneJson(dossier.keyComponents),
    relatedVersions: cloneJson(dossier.relatedVersions),
    sourceIds: eventSourceIds,
    limitations: [...match.limitations, ...dossier.unresolvedFacts],
    settlement: "preliminary-screen-02",
  };
  const sources = state.sources.filter((source) =>
    eventSourceIds.includes(source.id)
  );
  const history = {
    searchManifests: projectedSearchManifests(
      state.matchSets.map((set) => set.manifest),
      match.matchId,
      eventSourceIds,
    ),
    anchorRevisions: cloneJson(state.anchor.revisions),
    decisions: [
      ...state.identityDecisions.map((item) => ({
        id: item.decisionId,
        action: item.action,
        targetSnapshotId: item.identitySnapshotId,
        at: item.at,
        reason: item.reason,
      })),
      ...state.continuationHistory.map((item) => ({
        id: item.continuationId,
        action: Object.prototype.hasOwnProperty.call(
          item,
          "assessmentDisposition",
        ) ? "continued-without-assessment" : "continued",
        targetSnapshotId: item.identitySnapshotId,
        at: item.at,
        reason: item.reason,
      })),
    ],
  };
  const nextChecks = "nextChecks" in preliminaryAssessment
    ? preliminaryAssessment.nextChecks
    : preliminaryAssessment.mandatoryScreen03Checks;
  return {
    decision: {
      mode: "audit",
      originalWording: state.anchor.originalWording,
      activeAnchorRevisionId: state.anchor.activeRevisionId,
      matchSetSnapshotId: matchSet.matchSetSnapshotId,
      matchSnapshotId: match.matchSnapshotId,
      identitySnapshotId: match.identitySnapshotId,
      dossierSnapshotId: dossier.dossierSnapshotId,
      confirmationSnapshotId: confirmed.confirmationSnapshotId,
      confirmationDecisionId: confirmation.decisionId,
      continuationDecisionId: continuation.continuationId,
    },
    provenance: {
      mode: "audit",
      matchSetSnapshotId: matchSet.matchSetSnapshotId,
      matchSetFingerprint: matchSet.matchSetFingerprint,
      matchSnapshotId: match.matchSnapshotId,
      matchFingerprint: match.matchFingerprint,
      dossierSnapshotId: dossier.dossierSnapshotId,
      dossierFingerprint: dossier.dossierFingerprint,
      confirmationSnapshotId: confirmed.confirmationSnapshotId,
      confirmationFingerprint: confirmed.confirmationFingerprint,
    },
    event,
    preliminaryAssessment,
    dossierCompletionOrigin: completionOriginForCanonicalRequest(
      state,
      dossier.requestId,
    ),
    criteriaFindings: [],
    sources: cloneJson(sources),
    history,
    unresolved: {
      questions: [...dossier.unresolvedFacts, ...nextChecks],
      provisionalClaimIds: [
        event.description.id,
        ...event.dateLeads.map((item) => item.id),
        ...event.broadCoverage.map((item) => item.id),
        ...event.highLevelChanges.map((item) => item.id),
        ...event.keyComponents.map((item) => item.id),
      ],
      screen03Boundary,
    },
    selectedBinding: {
      recordId: match.matchId,
      snapshotId: match.matchSnapshotId,
      sourceIds: [...match.sourceIds],
      qualificationLane: null,
      identitySnapshotId: match.identitySnapshotId,
    },
    fingerprints: {
      match: fingerprintCanonicalJsonValue((({
        matchFingerprint: _ignored,
        ...input
      }) => input)(match)),
      matchSet: fingerprintCanonicalJsonValue((({
        matchSetFingerprint: _ignored,
        status: _status,
        supersededBySnapshotId: _successor,
        ...input
      }) => input)(matchSet)),
      dossier: fingerprintCanonicalJsonValue((({
        dossierFingerprint: _ignored,
        ...input
      }) => input)(dossier)),
      confirmation: fingerprintCanonicalJsonValue((({
        confirmationFingerprint: _ignored,
        ...input
      }) => input)(confirmed)),
    },
  };
}

/**
 * Compare a Screen 2→3 handoff against an independently reconstructed view of
 * the decrypted canonical state. Recomputing the handoff's own checksum alone
 * cannot detect a producer that consistently projects the wrong candidate.
 */
export function screen02HandoffCanonicalMismatches(state, handoff) {
  if (!isRecord(state) || !isRecord(handoff)) {
    return ["Canonical Screen 2 state or handoff is not an object."];
  }
  const issues = [];
  const expected = state.mode === "find"
    ? findHandoffProjection(state)
    : state.mode === "audit"
      ? auditHandoffProjection(state)
      : null;
  if (!expected) return ["Canonical Screen 2 continuation cannot be projected."];
  for (const [field, value] of Object.entries({
    decision: expected.decision,
    provenance: expected.provenance,
    event: expected.event,
    preliminaryAssessment: expected.preliminaryAssessment,
    dossierCompletionOrigin: expected.dossierCompletionOrigin,
    criteriaFindings: expected.criteriaFindings,
    sources: expected.sources,
    history: expected.history,
    unresolved: expected.unresolved,
  })) {
    if (!sameCanonicalJsonValue(handoff[field], value)) {
      issues.push(`handoff.${field} differs from canonical Screen 2 state.`);
    }
  }
  issues.push(...selectedRetainedResultMismatches(state, handoff, expected));
  if (handoff.schemaVersion !== "screen-02-to-screen-03-event-v4" ||
      handoff.sourceScreen !== "screen-02" ||
      handoff.destinationScreen !== "screen-03" ||
      handoff.sourceSessionSchemaVersion !== state.schemaVersion ||
      handoff.runId !== state.runId || handoff.revision !== state.revision ||
      handoff.mode !== state.mode ||
      !sameCanonicalJsonValue(handoff.screen01Baseline, state.screen01Baseline) ||
      handoff.screen01Fingerprint !== state.screen01Fingerprint ||
      handoff.outcomeValuesInspected !== false) {
    issues.push("handoff root coordinates differ from canonical Screen 2 state.");
  }
  const stateFingerprint = fingerprintCanonicalJsonValue(state);
  if (handoff.integrity?.stateFingerprint !== stateFingerprint) {
    issues.push("handoff.integrity.stateFingerprint is not the canonical state fingerprint.");
  }
  const eventFingerprint = fingerprintCanonicalJsonValue(expected.event);
  if (handoff.integrity?.eventFingerprint !== eventFingerprint) {
    issues.push("handoff.integrity.eventFingerprint is not the selected event fingerprint.");
  }
  const historyFingerprint = fingerprintCanonicalJsonValue(expected.history);
  if (handoff.integrity?.historyFingerprint !== historyFingerprint) {
    issues.push("handoff.integrity.historyFingerprint is not the canonical history fingerprint.");
  }
  if (state.mode === "find") {
    if (expected.provenance.candidateFingerprint !==
        expected.fingerprints.candidate) {
      issues.push("canonical candidateFingerprint is false.");
    }
    if (expected.provenance.candidateSetFingerprint !==
        expected.fingerprints.candidateSet) {
      issues.push("canonical candidateSetFingerprint is false.");
    }
  } else {
    for (const key of ["match", "matchSet", "dossier", "confirmation"]) {
      if (expected.provenance[`${key}Fingerprint`] !==
          expected.fingerprints[key]) {
        issues.push(`canonical ${key}Fingerprint is false.`);
      }
    }
  }
  issues.push(...sourceFingerprintIssues(expected.sources, "handoff"));
  for (const [index, manifest] of expected.history.searchManifests.entries()) {
    issues.push(...screen02ContextBridgeMismatches(
      manifest,
      `canonical search manifest ${index}`,
    ));
  }
  for (const [index, manifest] of (handoff.history?.searchManifests ?? [])
    .entries()) {
    issues.push(...screen02ContextBridgeMismatches(
      manifest,
      `handoff search manifest ${index}`,
    ));
  }
  if (isRecord(handoff.integrity)) {
    const { handoffFingerprint: _ignored, ...integrity } = handoff.integrity;
    if (handoff.integrity.handoffFingerprint !== fingerprintCanonicalJsonValue({
      ...handoff,
      integrity,
    })) issues.push("handoff.integrity.handoffFingerprint is false.");
  } else {
    issues.push("handoff.integrity is absent.");
  }
  return [...new Set(issues)];
}

export function assertScreen02HandoffMatchesCanonicalState(
  state,
  handoff,
  label = "Screen 2→3 handoff",
) {
  const issues = screen02HandoffCanonicalMismatches(state, handoff);
  assert(
    issues.length === 0,
    `${label} differs from canonical Screen 2 evidence: ${issues.join(" ")}`,
  );
}

export function readCanonicalWorkflowState(snapshot, expectedMode) {
  assert(
    expectedMode === "find" || expectedMode === "audit",
    "Canonical workflow state reader requires Find or Audit mode.",
  );
  assert(isRecord(snapshot), "Canonical Screen 2 snapshot was not an object.");
  const envelope = snapshot.stateEnvelope;
  assert(
    hasExactKeys(envelope, workflowEnvelopeKeys) &&
      envelope.schemaVersion === "screen-02-workflow-state-envelope-v1" &&
      envelope.workflowSchemaVersion === "2.1" &&
      envelope.stateKind === `screen-02-${expectedMode}` &&
      envelope.encoding === "gzip-base64url" &&
      Number.isSafeInteger(envelope.uncompressedBytes) &&
      envelope.uncompressedBytes > 0 &&
      envelope.uncompressedBytes <= maxCanonicalWorkflowBytes &&
      Number.isSafeInteger(envelope.compressedBytes) &&
      envelope.compressedBytes > 0 &&
      envelope.compressedBytes <= maxCompressedWorkflowBytes &&
      envelope.checksum === snapshot.stateFingerprint &&
      typeof envelope.payload === "string" &&
      envelope.payload.length > 0 &&
      envelope.payload.length <= maxEncodedWorkflowCharacters &&
      /^[A-Za-z0-9_-]+$/u.test(envelope.payload),
    `Canonical ${expectedMode} snapshot returned an invalid private state envelope.`,
  );

  const compressed = Buffer.from(envelope.payload, "base64url");
  assert(
    compressed.byteLength === envelope.compressedBytes &&
      compressed.toString("base64url") === envelope.payload,
    `Canonical ${expectedMode} snapshot returned a malformed private state payload.`,
  );

  let raw;
  try {
    raw = gunzipSync(compressed, { maxOutputLength: maxCanonicalWorkflowBytes });
  } catch {
    throw new Error(
      `Canonical ${expectedMode} snapshot returned an unreadable private state payload.`,
    );
  }
  assert(
    raw.byteLength === envelope.uncompressedBytes,
    `Canonical ${expectedMode} snapshot returned a private state payload with the wrong length.`,
  );
  assert(
    checksumBytes(raw) === envelope.checksum,
    `Canonical ${expectedMode} snapshot returned a private state payload with the wrong checksum.`,
  );

  let canonicalJson;
  let state;
  try {
    canonicalJson = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    state = JSON.parse(canonicalJson);
  } catch {
    throw new Error(
      `Canonical ${expectedMode} snapshot returned invalid private state JSON.`,
    );
  }
  assert(
    JSON.stringify(state) === canonicalJson,
    `Canonical ${expectedMode} snapshot returned noncanonical private state JSON.`,
  );
  assert(
    isRecord(state) &&
      state.schemaVersion === "2.1" &&
      state.stateKind === `screen-02-${expectedMode}` &&
      state.mode === expectedMode &&
      state.runId === snapshot.runId &&
      state.revision === snapshot.revision &&
      Array.isArray(state.assessmentRequests) &&
      Array.isArray(state.assessments) &&
      (snapshot.mode === undefined || snapshot.mode === expectedMode) &&
      (expectedMode === "find"
        ? Array.isArray(state.candidateSets) && Array.isArray(state.candidates)
        : Array.isArray(state.matchSets) &&
          Array.isArray(state.possibleMatches) &&
          Array.isArray(state.dossiers)),
    `Canonical ${expectedMode} snapshot returned the wrong private state contract.`,
  );
  return state;
}

export function readServerAssessmentFallbackReason(request, expectedMode) {
  assert(
    expectedMode === "find" || expectedMode === "audit",
    "Server assessment fallback reader requires Find or Audit mode.",
  );
  assert(
    isRecord(request) && Array.isArray(request.receiptIds),
    "Server assessment fallback omitted its private receipt identity.",
  );
  const matches = request.receiptIds.flatMap((receiptId) => {
    if (typeof receiptId !== "string") return [];
    const match = serverAssessmentFallbackReasonPattern.exec(receiptId);
    if (!match || match[2] !== expectedMode) return [];
    return [match[1]];
  });
  assert(
    matches.length === 1,
    `Server ${expectedMode} assessment fallback omitted one bounded diagnostic reason.`,
  );
  return matches[0];
}

export function firstActiveAuditMatchSnapshotId(snapshot) {
  const state = readCanonicalWorkflowState(snapshot, "audit");
  assert(
    typeof state.activeMatchSetSnapshotId === "string",
    "Canonical Audit discovery returned no active match set.",
  );

  const activeSet = state.matchSets.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.matchSetSnapshotId === state.activeMatchSetSnapshotId &&
      candidate.status === "active" &&
      Array.isArray(candidate.possibleMatchSnapshotIds),
  );
  const matchSnapshotId = activeSet?.possibleMatchSnapshotIds?.[0];
  assert(
    typeof matchSnapshotId === "string" && matchSnapshotId.length > 0,
    "Canonical Audit discovery returned no active possible match.",
  );
  const match = state.possibleMatches.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.matchSetSnapshotId === state.activeMatchSetSnapshotId &&
      candidate.matchSnapshotId === matchSnapshotId,
  );
  assert(match, "Canonical Audit discovery returned an inconsistent active match.");
  return matchSnapshotId;
}
