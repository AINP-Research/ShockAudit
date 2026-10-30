import { describe, expect, it } from "vitest";
import { gzipSync } from "fflate";

import { buildScreen02SearchFunnel } from
  "../../src/core/screen02-find-discovery";
import {
  SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION,
  SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
  SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
} from "../../src/core/screen02-qualification";
import {
  buildScreen02WorkflowHandoff,
  restoreScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import { confirmScreen02AuditIdentity } from
  "../../src/core/screen02-audit-workflow";
import {
  SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING,
  SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
  decodeScreen02FindWorkflowStateEnvelope,
} from "../../src/core/screen02-workflow-envelope";
import { serializeDeterministicJson } from "../../src/core/screen02-service";
import {
  createScreen03LoadingState,
} from "../../src/core/screen03-workflow";
import {
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  continueScreen02Audit,
  continueScreen02FindCandidate,
  fingerprintScreen02AuditMatchSet,
  requireScreen02FindState,
  restoreScreen02AuditState,
  restoreScreen02FindState,
  screen02AuditContinuationGate,
  screen02FindCandidateGate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
} from "../../src/core/screen02-workflow-state";
import {
  screen02FindGlanceEvent,
  fingerprintScreen02ShockGlanceEvent,
} from "../../src/core/screen02-shock-glance";
import {
  SCREEN_02_SEARCH_FUNNEL_LEGACY_SCHEMA_VERSION,
  SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
  SCREEN_02_FIND_STATE_KIND,
  SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION,
  SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
  isScreen02RetrievalExecution,
  migrateScreen02RetrievalExecution,
  screen02DocumentAcquisitionMatchesSource,
  type Screen02AuditState,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import { sanitizeScreen02AcquisitionUrl } from
  "../../src/core/screen02-document-acquisition";
import {
  buildFixedQualifiedFindState,
  buildAuditIdentityState,
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
} from "./screen02-workflow-fixtures";

function checksum(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function persistedLegacyEnvelope(state: Screen02FindState) {
  const canonicalJson = serializeDeterministicJson(state);
  const raw = new TextEncoder().encode(canonicalJson);
  const compressed = gzipSync(raw);
  let binary = "";
  for (const byte of compressed) binary += String.fromCharCode(byte);
  return {
    schemaVersion: SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
    workflowSchemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
    stateKind: SCREEN_02_FIND_STATE_KIND,
    encoding: SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: checksum(canonicalJson),
    payload: btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
      .replace(/=+$/u, ""),
  };
}

function readdressFindState(raw: Screen02FindState) {
  const candidate = raw.candidates[0]!;
  const { candidateFingerprint: _candidateFingerprint, ...candidateInput } =
    candidate;
  candidate.candidateFingerprint = fingerprintScreen02WorkflowValue(
    candidateInput,
  );
  const set = raw.candidateSets[0]!;
  set.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(set);
  for (const request of raw.assessmentRequests) {
    if (request.target.mode !== "find-candidate") continue;
    request.target.candidateFingerprint = candidate.candidateFingerprint;
    request.target.packetFingerprint = fingerprintScreen02WorkflowValue({
      mode: request.target.mode,
      screen01Fingerprint: raw.screen01Fingerprint,
      candidate,
      sources: raw.sources.filter((source) =>
        candidate.sourceIds.includes(source.id)
      ),
    });
  }
  for (const glance of raw.shockGlances ?? []) {
    glance.candidateFingerprint = candidate.candidateFingerprint;
    glance.eventFingerprint = fingerprintScreen02ShockGlanceEvent(
      screen02FindGlanceEvent(candidate),
    );
  }
  return raw;
}

function readdressAuditState(raw: Screen02AuditState) {
  for (const set of raw.matchSets) {
    set.matchSetFingerprint = fingerprintScreen02AuditMatchSet(set);
  }
  const setById = new Map(raw.matchSets.map((set) =>
    [set.matchSetSnapshotId, set] as const
  ));
  const matchById = new Map(raw.possibleMatches.map((match) =>
    [match.matchSnapshotId, match] as const
  ));
  const anchorById = new Map(raw.anchor.revisions.map((revision) =>
    [revision.anchorRevisionId, revision] as const
  ));
  const dossierById = new Map(raw.dossiers.map((dossier) =>
    [dossier.dossierSnapshotId, dossier] as const
  ));
  const confirmationById = new Map(raw.identityDecisions.flatMap((decision) =>
    decision.confirmationSnapshotId
      ? [[decision.confirmationSnapshotId, decision] as const]
      : []
  ));
  for (const request of raw.assessmentRequests) {
    const target = request.target;
    if (
      target.mode !== "audit-dossier" &&
      target.mode !== "audit-confirmed-event"
    ) continue;
    const set = setById.get(target.matchSetSnapshotId)!;
    const match = matchById.get(target.matchSnapshotId)!;
    const anchorRevision = anchorById.get(target.anchorRevisionId)!;
    target.matchSetFingerprint = set.matchSetFingerprint;
    const packetInput: Record<string, unknown> = {
      mode: target.mode,
      screen01Fingerprint: raw.screen01Fingerprint,
      anchorRevision,
      matchSet: {
        anchorRevisionId: target.anchorRevisionId,
        anchorRevisionFingerprint: target.anchorRevisionFingerprint,
        matchSetSnapshotId: target.matchSetSnapshotId,
        matchSetFingerprint: target.matchSetFingerprint,
        matchSnapshotId: target.matchSnapshotId,
        identitySnapshotId: target.identitySnapshotId,
        matchFingerprint: target.matchFingerprint,
      },
      match,
      sources: raw.sources.filter((source) =>
        match.sourceIds.includes(source.id)
      ),
    };
    if (target.mode === "audit-confirmed-event") {
      const dossier = dossierById.get(target.dossierSnapshotId)!;
      const decision = confirmationById.get(target.confirmationSnapshotId)!;
      packetInput.dossier = dossier;
      packetInput.confirmation = {
        confirmationSnapshotId: decision.confirmationSnapshotId!,
        confirmationFingerprint: decision.confirmationFingerprint!,
        identitySnapshotId: match.identitySnapshotId,
        matchSnapshotId: match.matchSnapshotId,
        matchSetSnapshotId: match.matchSetSnapshotId,
        anchorRevisionId: match.anchorRevisionId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        dossierFingerprint: dossier.dossierFingerprint,
        decisionId: decision.decisionId,
        confirmedAt: decision.at,
      };
      packetInput.sources = raw.sources.filter((source) =>
        new Set([...match.sourceIds, ...dossier.sourceIds]).has(source.id)
      );
    }
    target.packetFingerprint = fingerprintScreen02WorkflowValue(packetInput);
  }
  return raw;
}

function currentQualifiedReadyState() {
  const raw = cloneFixture(buildReadyFindState());
  const qualification = buildFixedQualifiedFindState().candidates[0]!
    .qualification!;
  raw.candidates[0]!.qualification = cloneFixture(qualification);
  raw.candidateSets[0]!.manifest.funnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved: 1,
    uniqueEventLeads: 1,
    qualifications: [qualification],
    displayedCandidates: 1,
  });
  raw.candidateSets[0]!.manifest.retainedResultBinding!.results[0]!
    .qualificationLane = qualification.lane;
  return requireScreen02FindState(readdressFindState(raw));
}

function downgradeQualification(value: unknown) {
  const qualification = cloneFixture(value) as Record<string, unknown>;
  qualification.version = SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION;
  const hardScope = qualification.hardScope as Record<string, unknown>;
  delete hardScope.disposition;
  delete hardScope.evidenceState;
  delete hardScope.relevanceState;
  delete hardScope.mismatchKeys;
  delete hardScope.insufficientEvidenceKeys;
  const overview = qualification.substantiveOverview as Record<string, unknown>;
  delete overview.sourceGrounding;
  qualification.exclusionCodes = (qualification.exclusionCodes as string[])
    .map((code) =>
      code === "hard-scope-insufficient-evidence"
        ? "hard-scope-mismatch"
        : code
    )
    .filter((code, index, codes) => codes.indexOf(code) === index);
  return qualification;
}

function downgradeQualificationToV3(value: unknown) {
  const qualification = cloneFixture(value) as Record<string, unknown>;
  qualification.version = SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION;
  qualification.cacheKey = (qualification.cacheKey as string).replace(
    `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:`,
    "",
  );
  const hardScope = qualification.hardScope as Record<string, unknown>;
  delete hardScope.evidenceState;
  delete hardScope.relevanceState;
  const overview = qualification.substantiveOverview as Record<string, unknown>;
  delete overview.sourceGrounding;
  return qualification;
}

function downgradeManifest(manifest: Record<string, unknown>) {
  manifest.protocolVersion = SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
  delete manifest.retrievalExecution;
  delete manifest.retainedResultBinding;
  const exclusions = manifest.exclusions as Array<Record<string, unknown>>;
  for (const exclusion of exclusions) {
    if (exclusion.qualification) {
      exclusion.qualification = downgradeQualification(
        exclusion.qualification,
      );
    }
  }
  const funnel = manifest.funnel as Record<string, unknown> | undefined;
  if (!funnel) return;
  funnel.schemaVersion = SCREEN_02_SEARCH_FUNNEL_LEGACY_SCHEMA_VERSION;
  delete funnel.hardScopeDemonstratedMismatch;
  delete funnel.hardScopeInsufficientEvidence;
  delete funnel.hardScopeMixed;
  delete funnel.retrievalFailures;
}

function legacyV0406State(current: Screen02FindState) {
  const legacy = cloneFixture(current);
  legacy.candidates[0]!.qualification = downgradeQualification(
    legacy.candidates[0]!.qualification,
  ) as never;
  downgradeManifest(
    legacy.candidateSets[0]!.manifest as unknown as Record<string, unknown>,
  );
  return readdressFindState(legacy);
}

function legacyV0406Handoff(
  current: Screen02WorkflowHandoff,
  legacyState: Screen02FindState,
) {
  const legacy = cloneFixture(current);
  legacy.event.preliminaryQualification = downgradeQualification(
    legacy.event.preliminaryQualification,
  ) as never;
  for (const manifest of legacy.history.searchManifests) {
    downgradeManifest(manifest as unknown as Record<string, unknown>);
  }
  if (legacy.provenance.mode !== "find") throw new Error("Expected Find.");
  legacy.provenance.candidateFingerprint =
    legacyState.candidates[0]!.candidateFingerprint;
  legacy.provenance.candidateSetFingerprint =
    legacyState.candidateSets[0]!.candidateSetFingerprint;
  legacy.integrity.stateFingerprint =
    fingerprintScreen02WorkflowValue(legacyState);
  legacy.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    legacy.event,
  );
  legacy.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    legacy.history,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    legacy.integrity;
  legacy.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...legacy,
    integrity,
  });
  return legacy;
}

function readdressHandoff(raw: Screen02WorkflowHandoff) {
  raw.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(raw.event);
  raw.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    raw.history,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    raw.integrity;
  raw.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...raw,
    integrity,
  });
  return raw;
}

describe("v0.4.06 Screen 2 embedded-schema restoration", () => {
  it("requires funnel, retrieval execution, and retained-result binding on current v4 state and handoff manifests", () => {
    const current = currentQualifiedReadyState();
    for (const missing of [
      "funnel",
      "retrievalExecution",
      "retainedResultBinding",
    ] as const) {
      const tamperedState = cloneFixture(current);
      delete tamperedState.candidateSets[0]!.manifest[missing];
      tamperedState.candidateSets[0]!.candidateSetFingerprint =
        fingerprintScreen02FindCandidateSet(tamperedState.candidateSets[0]!);
      expect(restoreScreen02FindState(tamperedState)).toBeNull();

      const tamperedHandoff = cloneFixture(buildScreen02WorkflowHandoff(
        current,
        "0.4.08",
        "2026-09-08T18:00:00.000Z",
      ));
      delete tamperedHandoff.history.searchManifests[0]![missing];
      tamperedHandoff.integrity.historyFingerprint =
        fingerprintScreen02WorkflowValue(tamperedHandoff.history);
      const { handoffFingerprint: _fingerprint, ...integrity } =
        tamperedHandoff.integrity;
      tamperedHandoff.integrity.handoffFingerprint =
        fingerprintScreen02WorkflowValue({
          ...tamperedHandoff,
          integrity,
        });
      expect(restoreScreen02WorkflowHandoff(tamperedHandoff, current))
        .toBeNull();
    }
  });

  it("keeps a re-fingerprinted v4-to-v3 Find projection viewable but read-only", () => {
    const current = currentQualifiedReadyState();
    const downgraded = cloneFixture(current);
    downgraded.candidateSets[0]!.manifest.protocolVersion =
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    delete downgraded.candidateSets[0]!.manifest.retrievalExecution;
    delete downgraded.candidateSets[0]!.manifest.retainedResultBinding;
    downgraded.candidateSets[0]!.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(downgraded.candidateSets[0]!);

    const restored = restoreScreen02FindState(downgraded);
    expect(restored).not.toBeNull();
    const candidateSnapshotId = restored!.candidates[0]!.candidateSnapshotId;
    expect(screen02FindCandidateSelectionGate(
      restored!,
      candidateSnapshotId,
    )).toMatchObject({
      eligible: false,
      reasons: [expect.stringMatching(/historical|retrieval execution/iu)],
    });
    expect(screen02FindCandidateGate(restored!, candidateSnapshotId))
      .toMatchObject({
        eligible: false,
        reasons: [expect.stringMatching(/historical|retrieval execution/iu)],
      });
    expect(() => buildScreen02WorkflowHandoff(
      restored!,
      "0.4.08",
      "2026-09-08T18:00:01.000Z",
    )).toThrow(/blocked|historical|retrieval execution/iu);

    const selected = cloneFixture(downgraded);
    selected.decision.history = selected.decision.history.filter(
      (event) => event.action !== "continued",
    );
    selected.decision.continuedRevision = null;
    selected.updatedAt = selected.decision.history.at(-1)!.at;
    const restoredSelected = restoreScreen02FindState(selected)!;
    expect(() => continueScreen02FindCandidate(
      restoredSelected,
      "downgraded-continuation",
      "2026-09-08T18:00:02.000Z",
      "Attempted continuation without a current retrieval execution.",
    )).toThrow(/historical|retrieval execution/iu);

    const unselected = cloneFixture(selected);
    unselected.decision.history = unselected.decision.history.filter(
      (event) => event.action !== "tentatively-selected",
    );
    unselected.decision.tentativeSelectionSnapshotId = null;
    unselected.shockGlances = [];
    unselected.updatedAt =
      unselected.decision.history.at(-1)?.at ?? unselected.createdAt;
    const restoredUnselected = restoreScreen02FindState(unselected)!;
    expect(() => selectScreen02FindCandidate(
      restoredUnselected,
      candidateSnapshotId,
      "downgraded-selection",
      "2026-09-08T18:00:03.000Z",
      "Attempted selection without a current retrieval execution.",
    )).toThrow(/historical|retrieval execution/iu);

    const downgradedHandoff = cloneFixture(buildScreen02WorkflowHandoff(
      current,
      "0.4.08",
      "2026-09-08T18:00:04.000Z",
    ));
    const handoffManifest = downgradedHandoff.history.searchManifests.at(-1)!;
    handoffManifest.protocolVersion =
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    delete handoffManifest.retrievalExecution;
    delete handoffManifest.retainedResultBinding;
    downgradedHandoff.integrity.historyFingerprint =
      fingerprintScreen02WorkflowValue(downgradedHandoff.history);
    const { handoffFingerprint: _fingerprint, ...integrity } =
      downgradedHandoff.integrity;
    downgradedHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({
        ...downgradedHandoff,
        integrity,
      });
    expect(() => createScreen03LoadingState(
      downgradedHandoff,
      "2026-09-08T18:00:05.000Z",
    )).toThrow(/contract|v4|handoff/iu);

    const refreshedHandoff = cloneFixture(buildScreen02WorkflowHandoff(
      current,
      "0.4.08",
      "2026-09-08T18:00:04.000Z",
    ));
    const retainedLegacyManifest = cloneFixture(
      refreshedHandoff.history.searchManifests[0]!,
    );
    retainedLegacyManifest.protocolVersion =
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    delete retainedLegacyManifest.retrievalExecution;
    delete retainedLegacyManifest.retainedResultBinding;
    refreshedHandoff.history.searchManifests.unshift(retainedLegacyManifest);
    refreshedHandoff.integrity.historyFingerprint =
      fingerprintScreen02WorkflowValue(refreshedHandoff.history);
    const { handoffFingerprint: _refreshedFingerprint, ...refreshedIntegrity } =
      refreshedHandoff.integrity;
    refreshedHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({
        ...refreshedHandoff,
        integrity: refreshedIntegrity,
      });
    expect(() => createScreen03LoadingState(
      refreshedHandoff,
      "2026-09-08T18:00:06.000Z",
    )).not.toThrow();
  });

  it("keeps a downgraded Audit match set viewable but blocks continuation and handoff", () => {
    const downgraded = cloneFixture(buildReadyAuditState());
    const activeSet = downgraded.matchSets.find((set) =>
      set.matchSetSnapshotId === downgraded.activeMatchSetSnapshotId
    )!;
    activeSet.manifest.protocolVersion =
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    delete activeSet.manifest.retrievalExecution;
    delete activeSet.manifest.retainedResultBinding;
    const restored = restoreScreen02AuditState(
      readdressAuditState(downgraded),
    );
    expect(restored).not.toBeNull();
    expect(screen02AuditContinuationGate(restored!)).toMatchObject({
      eligible: false,
      reasons: [expect.stringMatching(/historical|retrieval execution/iu)],
    });

    const beforeContinuation = cloneFixture(restored!);
    beforeContinuation.continuationHistory = [];
    beforeContinuation.revision -= 1;
    beforeContinuation.updatedAt = "2026-08-09T18:10:14.000Z";
    const restoredBeforeContinuation = restoreScreen02AuditState(
      beforeContinuation,
    );
    expect(restoredBeforeContinuation).not.toBeNull();
    expect(() => continueScreen02Audit(
      restoredBeforeContinuation!,
      "downgraded-audit-continuation",
      "2026-09-08T18:10:15.000Z",
      "Attempted Audit continuation without current retrieval execution.",
    )).toThrow(/historical|retrieval execution/iu);
    expect(() => buildScreen02WorkflowHandoff(
      restored!,
      "0.4.08",
      "2026-09-08T18:10:15.000Z",
    )).toThrow(/blocked|historical|retrieval execution/iu);

    const beforeConfirmation = cloneFixture(buildAuditIdentityState());
    beforeConfirmation.identityDecisions = [];
    beforeConfirmation.confirmedIdentity = null;
    const beforeConfirmationSet = beforeConfirmation.matchSets.find((set) =>
      set.matchSetSnapshotId === beforeConfirmation.activeMatchSetSnapshotId
    )!;
    beforeConfirmationSet.manifest.protocolVersion =
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    delete beforeConfirmationSet.manifest.retrievalExecution;
    delete beforeConfirmationSet.manifest.retainedResultBinding;
    const restoredBeforeConfirmation = restoreScreen02AuditState(
      readdressAuditState(beforeConfirmation),
    );
    expect(restoredBeforeConfirmation).not.toBeNull();
    expect(() => confirmScreen02AuditIdentity(restoredBeforeConfirmation!, {
      matchSnapshotId: "ccpa-match-snapshot-v1",
      dossierSnapshotId: "ccpa-dossier-v1",
      decisionId: "downgraded-audit-confirmation",
      confirmationSnapshotId: "downgraded-audit-confirmation-snapshot",
      assessmentJobId: "downgraded-audit-assessment-job",
      assessmentRequestId: "downgraded-audit-assessment-request",
      at: "2026-09-08T18:10:15.000Z",
      reason: "Attempted confirmation without current retrieval execution.",
    })).toThrow(/fresh search|retrieval execution/iu);
  });

  it("binds current retrieval acquisitions to retained state candidates and sources", () => {
    const current = currentQualifiedReadyState();
    const candidate = current.candidates[0]!;
    const sourceId = candidate.sourceIds[0]!;
    const sourceLocator = sanitizeScreen02AcquisitionUrl(
      current.sources.find((source) => source.id === sourceId)!.locator,
    )!;
    const withAcquisition = cloneFixture(current);
    withAcquisition.candidateSets[0]!.manifest.funnel!
      .deeperRetrievalAttempts = 1;
    withAcquisition.candidateSets[0]!.manifest.retrievalExecution!
      .documentAcquisitions = [{
        schemaVersion: "screen-02-document-acquisition-v1",
        acquisitionId: "state-bound-acquisition-1",
        candidateId: candidate.candidateId,
        sourceId,
        level: 2,
        requestedUrl: sourceLocator,
        redirectChain: [],
        finalUrl: sourceLocator,
        httpStatus: 200,
        mediaType: "text/html",
        receivedBytes: 1_024,
        latencyMs: 25,
        parserPath: "official-html-visible-text",
        parserOutcome: "parsed",
        outcome: "succeeded",
        failureReason: null,
      }];
    withAcquisition.candidateSets[0]!.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(withAcquisition.candidateSets[0]!);
    expect(() => requireScreen02FindState(withAcquisition)).not.toThrow();

    const aliasRedirect = cloneFixture(withAcquisition);
    const aliasUrl = new URL(sourceLocator);
    aliasUrl.hostname = `www.${aliasUrl.hostname}`;
    const aliasTrace = aliasRedirect.candidateSets[0]!.manifest
      .retrievalExecution!.documentAcquisitions[0]!;
    aliasTrace.redirectChain = [{
      status: 302,
      fromUrl: sourceLocator,
      toUrl: aliasUrl.toString(),
    }];
    aliasTrace.finalUrl = aliasUrl.toString();
    aliasRedirect.candidateSets[0]!.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(aliasRedirect.candidateSets[0]!);
    expect(restoreScreen02FindState(aliasRedirect)).not.toBeNull();

    const boundHandoff = buildScreen02WorkflowHandoff(
      requireScreen02FindState(withAcquisition),
      "0.4.08",
      "2026-09-08T18:06:00.000Z",
    );
    expect(() => createScreen03LoadingState(
      boundHandoff,
      "2026-09-08T18:06:01.000Z",
    )).not.toThrow();
    for (const mutate of [
      (handoff: Screen02WorkflowHandoff) => {
        const trace = handoff.history.searchManifests[0]!
          .retrievalExecution!.documentAcquisitions[0]!;
        trace.requestedUrl = "https://unrelated-public.example/document";
        trace.finalUrl = "https://unrelated-public.example/document";
      },
      (handoff: Screen02WorkflowHandoff) => {
        const manifest = handoff.history.searchManifests[0]!;
        manifest.queryMatrix[0]!.returnedRecordIds.push(
          "returned-only-candidate",
        );
        manifest.retrievalExecution!.documentAcquisitions[0]!.candidateId =
          "returned-only-candidate";
      },
    ]) {
      const tamperedHandoff = cloneFixture(boundHandoff);
      mutate(tamperedHandoff);
      readdressHandoff(tamperedHandoff);
      expect(() => createScreen03LoadingState(
        tamperedHandoff,
        "2026-09-08T18:06:01.000Z",
      )).toThrow(/contract|handoff/iu);
    }

    const unretainedTrace = cloneFixture(withAcquisition);
    unretainedTrace.candidateSets[0]!.manifest.queryMatrix[0]!
      .returnedRecordIds.push("unretained-candidate");
    const unretainedAcquisition = unretainedTrace.candidateSets[0]!.manifest
      .retrievalExecution!.documentAcquisitions[0]!;
    unretainedAcquisition.candidateId = "unretained-candidate";
    unretainedAcquisition.sourceId = null;
    unretainedTrace.candidateSets[0]!.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(unretainedTrace.candidateSets[0]!);
    expect(restoreScreen02FindState(unretainedTrace)).not.toBeNull();

    for (const mutate of [
      (state: typeof withAcquisition) => {
        state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!.candidateId = "ghost-candidate";
      },
      (state: typeof withAcquisition) => {
        state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!.sourceId = "ghost-source";
      },
      (state: typeof withAcquisition) => {
        state.candidateSets[0]!.manifest.queryMatrix[0]!.returnedRecordIds
          .push("unretained-candidate");
        const trace = state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!;
        trace.candidateId = "unretained-candidate";
        trace.sourceId = sourceId;
      },
      (state: typeof withAcquisition) => {
        const trace = state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!;
        trace.requestedUrl = "https://public-agency.example/document";
        trace.finalUrl = "https://public-agency.example/document";
      },
      (state: typeof withAcquisition) => {
        const trace = state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!;
        trace.redirectChain = [{
          status: 302,
          fromUrl: trace.requestedUrl,
          toUrl: "https://other-public-agency.example/document",
        }];
        trace.finalUrl = "https://other-public-agency.example/document";
      },
      (state: typeof withAcquisition) => {
        const trace = state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!;
        trace.requestedUrl = "https://localhost/document";
        trace.finalUrl = "https://localhost/document";
      },
      (state: typeof withAcquisition) => {
        state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!.receivedBytes = 2_097_153;
      },
      (state: typeof withAcquisition) => {
        state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!.latencyMs = 45_001;
      },
      (state: typeof withAcquisition) => {
        const trace = state.candidateSets[0]!.manifest.retrievalExecution!
          .documentAcquisitions[0]!;
        trace.redirectChain = [{
          status: 302,
          fromUrl: trace.requestedUrl,
          toUrl: "https://agency.gov/next",
        }];
        trace.finalUrl = null;
        trace.httpStatus = null;
        trace.mediaType = null;
        trace.parserPath = "not-run";
        trace.parserOutcome = "not-run";
        trace.outcome = "failed";
        trace.failureReason = "The redirected request failed.";
      },
    ]) {
      const tampered = cloneFixture(withAcquisition);
      mutate(tampered);
      tampered.candidateSets[0]!.candidateSetFingerprint =
        fingerprintScreen02FindCandidateSet(tampered.candidateSets[0]!);
      expect(restoreScreen02FindState(tampered)).toBeNull();
    }

    const aggregateOverflow = cloneFixture(withAcquisition);
    const seed = aggregateOverflow.candidateSets[0]!.manifest
      .retrievalExecution!.documentAcquisitions[0]!;
    aggregateOverflow.candidateSets[0]!.manifest.retrievalExecution!
      .documentAcquisitions = Array.from({ length: 4 }, (_value, index) => ({
        ...cloneFixture(seed),
        acquisitionId: `state-bound-acquisition-${index + 1}`,
        receivedBytes: index < 3 ? 2_097_152 : 1,
      }));
    aggregateOverflow.candidateSets[0]!.manifest.funnel!
      .deeperRetrievalAttempts = 4;
    aggregateOverflow.candidateSets[0]!.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(aggregateOverflow.candidateSets[0]!);
    expect(restoreScreen02FindState(aggregateOverflow)).toBeNull();
  });

  it("allows only producer-equivalent official redirect families for source attribution", () => {
    const current = currentQualifiedReadyState();
    const source = cloneFixture(current.sources[0]!);
    source.locator =
      "https://www.federalregister.gov/documents/2026/09/08/2026-12345/example-rule";
    const acquisition = {
      schemaVersion: "screen-02-document-acquisition-v1" as const,
      acquisitionId: "federal-register-govinfo-binding",
      candidateId: current.candidates[0]!.candidateId,
      sourceId: source.id,
      level: 2 as const,
      requestedUrl: source.locator,
      redirectChain: [{
        status: 302 as const,
        fromUrl: source.locator,
        toUrl:
          "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-12345.pdf",
      }],
      finalUrl:
        "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-12345.pdf",
      httpStatus: 200,
      mediaType: "text/html" as const,
      receivedBytes: 1_024,
      latencyMs: 25,
      parserPath: "official-html-visible-text" as const,
      parserOutcome: "parsed" as const,
      outcome: "succeeded" as const,
      failureReason: null,
    };
    expect(screen02DocumentAcquisitionMatchesSource(acquisition, source))
      .toBe(true);

    const wrongRecord = cloneFixture(acquisition);
    wrongRecord.redirectChain[0]!.toUrl =
      "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-99999.pdf";
    wrongRecord.finalUrl = wrongRecord.redirectChain[0]!.toUrl;
    expect(screen02DocumentAcquisitionMatchesSource(wrongRecord, source))
      .toBe(false);

    const sameHostWrongRecord = cloneFixture(acquisition);
    sameHostWrongRecord.redirectChain[0]!.toUrl =
      "https://www.federalregister.gov/d/2026-99999";
    sameHostWrongRecord.finalUrl =
      sameHostWrongRecord.redirectChain[0]!.toUrl;
    expect(screen02DocumentAcquisitionMatchesSource(
      sameHostWrongRecord,
      source,
    )).toBe(false);

    const govInfoSource = cloneFixture(source);
    govInfoSource.locator =
      "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-12345.pdf";
    const sameFamilyWrongRecord = cloneFixture(acquisition);
    sameFamilyWrongRecord.requestedUrl = govInfoSource.locator;
    sameFamilyWrongRecord.redirectChain = [{
      status: 302,
      fromUrl: govInfoSource.locator,
      toUrl:
        "https://govinfo.gov/content/pkg/FR-2026-09-08/html/2026-99999.htm",
    }];
    sameFamilyWrongRecord.finalUrl =
      sameFamilyWrongRecord.redirectChain[0]!.toUrl;
    expect(screen02DocumentAcquisitionMatchesSource(
      sameFamilyWrongRecord,
      govInfoSource,
    )).toBe(false);

    const federalIndexSource = cloneFixture(source);
    federalIndexSource.locator = "https://www.federalregister.gov/";
    const noInitialIdMultiHopMismatch = cloneFixture(acquisition);
    noInitialIdMultiHopMismatch.requestedUrl = federalIndexSource.locator;
    noInitialIdMultiHopMismatch.redirectChain = [
      {
        status: 302,
        fromUrl: federalIndexSource.locator,
        toUrl: "https://www.federalregister.gov/d/2026-12345",
      },
      {
        status: 302,
        fromUrl: "https://www.federalregister.gov/d/2026-12345",
        toUrl: "https://www.federalregister.gov/d/2026-99999",
      },
    ];
    noInitialIdMultiHopMismatch.finalUrl =
      noInitialIdMultiHopMismatch.redirectChain[1]!.toUrl;
    expect(screen02DocumentAcquisitionMatchesSource(
      noInitialIdMultiHopMismatch,
      federalIndexSource,
    )).toBe(false);

    const unapprovedFederalRegisterHost = cloneFixture(acquisition);
    unapprovedFederalRegisterHost.redirectChain[0]!.toUrl =
      "https://public-inspection.federalregister.gov/2026-12345.pdf";
    unapprovedFederalRegisterHost.finalUrl =
      unapprovedFederalRegisterHost.redirectChain[0]!.toUrl;
    expect(screen02DocumentAcquisitionMatchesSource(
      unapprovedFederalRegisterHost,
      source,
    )).toBe(false);

    for (const rejectedLocator of [
      "https://public-inspection.federalregister.gov/2026-12345.pdf",
      "https://europa.eu/legal-content/EN/TXT/",
    ]) {
      const rejectedSource = cloneFixture(source);
      rejectedSource.locator = rejectedLocator;
      const rejectedSameHostTrace = cloneFixture(acquisition);
      rejectedSameHostTrace.requestedUrl = rejectedLocator;
      rejectedSameHostTrace.redirectChain = [];
      rejectedSameHostTrace.finalUrl = rejectedLocator;
      expect(screen02DocumentAcquisitionMatchesSource(
        rejectedSameHostTrace,
        rejectedSource,
      )).toBe(false);
    }

    const europaSource = cloneFixture(source);
    europaSource.locator = "https://op.europa.eu/legal-content/EN/TXT/";
    const europaFamilyRedirect = cloneFixture(acquisition);
    europaFamilyRedirect.requestedUrl =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/";
    europaFamilyRedirect.redirectChain = [{
      status: 302,
      fromUrl: europaFamilyRedirect.requestedUrl,
      toUrl: europaSource.locator,
    }];
    europaFamilyRedirect.finalUrl = europaSource.locator;
    expect(screen02DocumentAcquisitionMatchesSource(
      europaFamilyRedirect,
      europaSource,
    )).toBe(true);
  });

  it("rejects impossible current retrieval phase and aggregate metrics", () => {
    const current = currentQualifiedReadyState();
    type RetrievalExecution = NonNullable<
      (typeof current.candidateSets)[number]["manifest"]["retrievalExecution"]
    >;
    for (const mutate of [
      (execution: RetrievalExecution) => {
        execution.baseline.roundsExecuted = 0;
        execution.aggregate.roundsExecuted = 0;
      },
      (execution: RetrievalExecution) => {
        execution.baseline.recordsReceived = 0;
        execution.aggregate.recordsReceived = 0;
      },
      (execution: RetrievalExecution) => {
        execution.aggregate.queriesAttempted += 1;
      },
    ]) {
      const tampered = cloneFixture(current);
      mutate(tampered.candidateSets[0]!.manifest.retrievalExecution!);
      tampered.candidateSets[0]!.candidateSetFingerprint =
        fingerprintScreen02FindCandidateSet(tampered.candidateSets[0]!);
      expect(restoreScreen02FindState(tampered)).toBeNull();
    }
  });

  it("caps every baseline path and validates the recovery query identifier", () => {
    const current = currentQualifiedReadyState();
    const execution = cloneFixture(
      current.candidateSets[0]!.manifest.retrievalExecution!,
    );
    expect(isScreen02RetrievalExecution(execution)).toBe(true);

    const baselineOverflow = cloneFixture(execution);
    baselineOverflow.baseline = {
      ...baselineOverflow.baseline,
      status: "failed",
      stoppingReason: "source-failure",
      queryIds: Array.from({ length: 17 }, (_value, index) =>
        `overflow-query-${index + 1}`),
      queriesPlanned: 17,
      queriesAttempted: 17,
      queriesSucceeded: 0,
      queriesFailed: 17,
      roundsExecuted: 2,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    };
    baselineOverflow.aggregate = {
      ...baselineOverflow.baseline,
      terminal: true,
    } as typeof baselineOverflow.aggregate;
    delete (baselineOverflow.aggregate as Record<string, unknown>).phase;
    delete (baselineOverflow.aggregate as Record<string, unknown>).status;
    delete (baselineOverflow.aggregate as Record<string, unknown>).queryIds;
    delete (baselineOverflow.aggregate as Record<string, unknown>)
      .stoppingReason;
    expect(isScreen02RetrievalExecution(baselineOverflow)).toBe(false);

    const withRecovery = cloneFixture(execution);
    withRecovery.qualificationRecovery = {
      phase: "qualification-recovery",
      status: "completed",
      stoppingReason: "qualification-recovery-completed",
      queryIds: ["recovery-query"],
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      roundsExecuted: 1,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    };
    withRecovery.aggregate.queriesPlanned += 1;
    withRecovery.aggregate.queriesAttempted += 1;
    withRecovery.aggregate.queriesSucceeded += 1;
    withRecovery.aggregate.roundsExecuted += 1;
    expect(isScreen02RetrievalExecution(withRecovery)).toBe(true);
    withRecovery.qualificationRecovery.queryIds = [" recovery-query "];
    expect(isScreen02RetrievalExecution(withRecovery)).toBe(false);
  });

  it("migrates a v1 recovery status to an explicit v2 stopping reason", () => {
    const current = currentQualifiedReadyState();
    const legacy = cloneFixture(current);
    const set = legacy.candidateSets[0]!;
    const execution = cloneFixture(set.manifest.retrievalExecution!);
    execution.qualificationRecovery = {
      phase: "qualification-recovery",
      status: "completed",
      stoppingReason: "qualification-recovery-completed",
      queryIds: ["recovery-query"],
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      roundsExecuted: 1,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    };
    execution.aggregate.queriesPlanned += 1;
    execution.aggregate.queriesAttempted += 1;
    execution.aggregate.queriesSucceeded += 1;
    execution.aggregate.roundsExecuted += 1;
    const legacyExecution = execution as unknown as Record<string, unknown>;
    legacyExecution.schemaVersion =
      SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION;
    delete (legacyExecution.qualificationRecovery as Record<string, unknown>)
      .stoppingReason;

    const migrated = migrateScreen02RetrievalExecution(legacyExecution);
    expect(migrated).toMatchObject({
      schemaVersion: SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
      qualificationRecovery: {
        status: "completed",
        stoppingReason: "qualification-recovery-completed",
      },
    });
    expect(migrated?.aggregate).toEqual(execution.aggregate);

    set.manifest.queryMatrix.push({
      id: "recovery-query",
      query: "One legacy bounded qualification-recovery query",
      purpose: "Preserve the exact recorded recovery activity.",
      returnedRecordIds: [],
    });
    set.manifest.retrievalExecution = legacyExecution as never;
    set.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(set);
    const restored = restoreScreen02FindState(legacy);
    expect(restored?.candidateSets[0]?.manifest.retrievalExecution)
      .toMatchObject({
        schemaVersion: SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
        qualificationRecovery: {
          stoppingReason: "qualification-recovery-completed",
        },
      });
    if (!restored) throw new Error("Expected migrated Screen 2 state.");
    const currentHandoff = buildScreen02WorkflowHandoff(
      restored,
      "0.4.08",
      "2026-09-08T20:00:00.000Z",
    );
    const legacyHandoff = cloneFixture(currentHandoff);
    const handoffExecution = legacyHandoff.history.searchManifests[0]!
      .retrievalExecution! as unknown as Record<string, unknown>;
    handoffExecution.schemaVersion =
      SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION;
    delete (handoffExecution.qualificationRecovery as Record<string, unknown>)
      .stoppingReason;
    legacyHandoff.integrity.historyFingerprint =
      fingerprintScreen02WorkflowValue(legacyHandoff.history);
    const { handoffFingerprint: _ignored, ...integrity } =
      legacyHandoff.integrity;
    legacyHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({
        ...legacyHandoff,
        integrity,
      });
    expect(restoreScreen02WorkflowHandoff(legacyHandoff, restored))
      .toMatchObject({
        history: {
          searchManifests: [{
            retrievalExecution: {
              schemaVersion: SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
              qualificationRecovery: {
                stoppingReason: "qualification-recovery-completed",
              },
            },
          }],
        },
      });
  });

  it("migrates the failed v1 recovery status to its exact v2 stop", () => {
    const current = currentQualifiedReadyState();
    const legacy = cloneFixture(
      current.candidateSets[0]!.manifest.retrievalExecution!,
    ) as unknown as Record<string, any>;
    legacy.schemaVersion = SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION;
    legacy.qualificationRecovery = {
      phase: "qualification-recovery",
      status: "failed",
      queryIds: ["failed-recovery-query"],
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 0,
      queriesFailed: 1,
      roundsExecuted: 1,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    };
    legacy.aggregate.queriesPlanned += 1;
    legacy.aggregate.queriesAttempted += 1;
    legacy.aggregate.queriesFailed += 1;
    legacy.aggregate.roundsExecuted += 1;

    expect(migrateScreen02RetrievalExecution(legacy)).toMatchObject({
      schemaVersion: SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
      qualificationRecovery: {
        status: "failed",
        stoppingReason: "qualification-recovery-failed",
      },
    });
  });

  it("cross-checks v4 funnel record, lead, and document-attempt totals", () => {
    const current = currentQualifiedReadyState();
    for (const mutate of [
      (state: typeof current) => {
        const execution = state.candidateSets[0]!.manifest.retrievalExecution!;
        execution.baseline.recordsReceived = 2;
        execution.aggregate.recordsReceived = 2;
      },
      (state: typeof current) => {
        const manifest = state.candidateSets[0]!.manifest;
        manifest.funnel!.sourceRecordsRetrieved = 2;
        manifest.funnel!.duplicatesRemoved = 1;
        manifest.retrievalExecution!.baseline.recordsReceived = 2;
        manifest.retrievalExecution!.baseline.proposalsGenerated = 2;
        manifest.retrievalExecution!.baseline.uniqueProposalsGenerated = 2;
        manifest.retrievalExecution!.aggregate.recordsReceived = 2;
        manifest.retrievalExecution!.aggregate.proposalsGenerated = 2;
        manifest.retrievalExecution!.aggregate.uniqueProposalsGenerated = 2;
      },
      (state: typeof current) => {
        state.candidateSets[0]!.manifest.funnel!.deeperRetrievalAttempts = 1;
      },
    ]) {
      const tampered = cloneFixture(current);
      mutate(tampered);
      tampered.candidateSets[0]!.candidateSetFingerprint =
        fingerprintScreen02FindCandidateSet(tampered.candidateSets[0]!);
      expect(restoreScreen02FindState(tampered)).toBeNull();
    }
  });

  it("binds current Find and Audit manifests to their exact retained results", () => {
    const zeroExecution = (
      execution: NonNullable<Screen02FindState["candidateSets"][number]["manifest"]["retrievalExecution"]>,
    ) => {
      execution.baseline = {
        phase: "baseline",
        status: "unsupported",
        queryIds: [],
        stoppingReason: "unsupported",
        queriesPlanned: 0,
        queriesAttempted: 0,
        queriesSucceeded: 0,
        queriesFailed: 0,
        roundsExecuted: 0,
        recordsReceived: 0,
        proposalsGenerated: 0,
        uniqueProposalsGenerated: 0,
      };
      execution.qualificationRecovery = null;
      execution.aggregate = {
        queriesPlanned: 0,
        queriesAttempted: 0,
        queriesSucceeded: 0,
        queriesFailed: 0,
        roundsExecuted: 0,
        recordsReceived: 0,
        proposalsGenerated: 0,
        uniqueProposalsGenerated: 0,
        terminal: true,
      };
      execution.documentAcquisitions = [];
    };

    const find = cloneFixture(currentQualifiedReadyState());
    const findSet = find.candidateSets[0]!;
    zeroExecution(findSet.manifest.retrievalExecution!);
    findSet.manifest.queryMatrix.forEach((query) => {
      query.returnedRecordIds = [];
    });
    findSet.manifest.funnel = buildScreen02SearchFunnel({
      sourceRecordsRetrieved: 0,
      uniqueEventLeads: 0,
      qualifications: [],
      displayedCandidates: 0,
    });
    findSet.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(
      findSet,
    );
    expect(restoreScreen02FindState(find)).toBeNull();

    for (const mutate of [
      (binding: NonNullable<typeof findSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.recordId = "same-count-unrelated-candidate";
      },
      (binding: NonNullable<typeof findSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.snapshotId =
          "same-count-unrelated-candidate-snapshot";
      },
      (binding: NonNullable<typeof findSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.sourceIds = ["same-count-unrelated-source"];
      },
    ]) {
      const substituted = cloneFixture(currentQualifiedReadyState());
      const substitutedSet = substituted.candidateSets[0]!;
      mutate(substitutedSet.manifest.retainedResultBinding!);
      substitutedSet.candidateSetFingerprint =
        fingerprintScreen02FindCandidateSet(substitutedSet);
      expect(restoreScreen02FindState(substituted)).toBeNull();
    }

    const audit = cloneFixture(buildAuditIdentityState());
    audit.dossiers = [];
    audit.identityDecisions = [];
    audit.confirmedIdentity = null;
    audit.assessments = [];
    audit.assessmentRequests = [];
    audit.continuationHistory = [];
    audit.shockGlances = [];
    const auditSet = audit.matchSets.find((item) =>
      item.matchSetSnapshotId === audit.activeMatchSetSnapshotId
    )!;
    zeroExecution(auditSet.manifest.retrievalExecution!);
    auditSet.manifest.queryMatrix.forEach((query) => {
      query.returnedRecordIds = [];
    });
    auditSet.manifest.funnel = buildScreen02SearchFunnel({
      sourceRecordsRetrieved: 0,
      uniqueEventLeads: 0,
      qualifications: [],
      displayedCandidates: 0,
    });
    auditSet.matchSetFingerprint = fingerprintScreen02AuditMatchSet(auditSet);
    expect(restoreScreen02AuditState(audit)).toBeNull();

    for (const mutate of [
      (binding: NonNullable<typeof auditSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.recordId = "same-count-unrelated-match";
      },
      (binding: NonNullable<typeof auditSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.snapshotId =
          "same-count-unrelated-match-snapshot";
      },
      (binding: NonNullable<typeof auditSet.manifest.retainedResultBinding>) => {
        binding.results[0]!.sourceIds = ["same-count-unrelated-source"];
      },
    ]) {
      const substituted = cloneFixture(buildAuditIdentityState());
      const substitutedSet = substituted.matchSets.find((item) =>
        item.matchSetSnapshotId === substituted.activeMatchSetSnapshotId
      )!;
      mutate(substitutedSet.manifest.retainedResultBinding!);
      substitutedSet.matchSetFingerprint =
        fingerprintScreen02AuditMatchSet(substitutedSet);
      expect(restoreScreen02AuditState(substituted)).toBeNull();
    }
  });

  it("binds Audit retrieval acquisitions to retained matches and sources", () => {
    const current = cloneFixture(buildAuditIdentityState());
    current.dossiers = [];
    current.identityDecisions = [];
    current.confirmedIdentity = null;
    current.assessments = [];
    current.assessmentRequests = [];
    current.continuationHistory = [];
    current.shockGlances = [];
    const set = current.matchSets.find((item) =>
      item.matchSetSnapshotId === current.activeMatchSetSnapshotId
    )!;
    const match = current.possibleMatches.find((item) =>
      item.matchSetSnapshotId === set.matchSetSnapshotId
    )!;
    const sourceLocator = sanitizeScreen02AcquisitionUrl(
      current.sources.find((source) => source.id === match.sourceIds[0])!
        .locator,
    )!;
    set.manifest.funnel!.deeperRetrievalAttempts = 1;
    set.manifest.retrievalExecution!.documentAcquisitions = [{
      schemaVersion: "screen-02-document-acquisition-v1",
      acquisitionId: "audit-bound-acquisition-1",
      candidateId: match.matchId,
      sourceId: match.sourceIds[0]!,
      level: 2,
      requestedUrl: sourceLocator,
      redirectChain: [],
      finalUrl: sourceLocator,
      httpStatus: 200,
      mediaType: "text/html",
      receivedBytes: 1_024,
      latencyMs: 25,
      parserPath: "official-html-visible-text",
      parserOutcome: "parsed",
      outcome: "succeeded",
      failureReason: null,
    }];
    set.matchSetFingerprint = fingerprintScreen02AuditMatchSet(set);
    expect(restoreScreen02AuditState(current)).not.toBeNull();

    const tampered = cloneFixture(current);
    const tamperedSet = tampered.matchSets.find((item) =>
      item.matchSetSnapshotId === tampered.activeMatchSetSnapshotId
    )!;
    tamperedSet.manifest.retrievalExecution!.documentAcquisitions[0]!
      .sourceId = "ghost-source";
    tamperedSet.matchSetFingerprint = fingerprintScreen02AuditMatchSet(
      tamperedSet,
    );
    expect(restoreScreen02AuditState(tampered)).toBeNull();
  });

  it("decodes migrated eligible history but blocks new selection, continuation, handoff, and Screen 3 provenance", () => {
    const current = currentQualifiedReadyState();
    const legacyContinued = legacyV0406State(current);
    const restoredContinued = restoreScreen02FindState(legacyContinued);
    expect(restoredContinued).not.toBeNull();
    const candidateSnapshotId =
      restoredContinued!.candidates[0]!.candidateSnapshotId;
    expect(restoredContinued!.candidates[0]!.qualification).toMatchObject({
      eligible: true,
      migrationProvenance: { sourceEvidenceReconstructed: false },
      substantiveOverview: { sourceGrounding: { coordinates: [] } },
    });
    expect(screen02FindCandidateSelectionGate(
      restoredContinued!,
      candidateSnapshotId,
    )).toMatchObject({
      eligible: false,
      reasons: [expect.stringMatching(/historical|source grounding/iu)],
    });
    expect(screen02FindCandidateGate(
      restoredContinued!,
      candidateSnapshotId,
    ).eligible).toBe(false);
    expect(() => buildScreen02WorkflowHandoff(
      restoredContinued!,
      "0.4.08",
      "2026-09-08T18:01:00.000Z",
    )).toThrow(/blocked|source grounding|historical/iu);

    const selectedLegacy = cloneFixture(legacyContinued);
    selectedLegacy.decision.history = selectedLegacy.decision.history.filter(
      (event) => event.action !== "continued",
    );
    selectedLegacy.decision.continuedRevision = null;
    selectedLegacy.updatedAt = selectedLegacy.decision.history.at(-1)!.at;
    const restoredSelected = restoreScreen02FindState(selectedLegacy);
    expect(restoredSelected).not.toBeNull();
    expect(() => continueScreen02FindCandidate(
      restoredSelected!,
      "migrated-continuation",
      "2026-09-08T18:02:00.000Z",
      "Attempted continuation of historical qualification.",
    )).toThrow(/historical|source grounding/iu);

    const unselectedLegacy = cloneFixture(selectedLegacy);
    unselectedLegacy.decision.history = unselectedLegacy.decision.history
      .filter((event) => event.action !== "tentatively-selected");
    unselectedLegacy.decision.tentativeSelectionSnapshotId = null;
    unselectedLegacy.shockGlances = [];
    unselectedLegacy.updatedAt =
      unselectedLegacy.decision.history.at(-1)?.at ?? unselectedLegacy.createdAt;
    const restoredUnselected = restoreScreen02FindState(unselectedLegacy);
    expect(restoredUnselected).not.toBeNull();
    expect(() => selectScreen02FindCandidate(
      restoredUnselected!,
      candidateSnapshotId,
      "migrated-selection",
      "2026-09-08T18:03:00.000Z",
      "Attempted selection of historical qualification.",
    )).toThrow(/historical|source grounding/iu);

    const currentHandoff = cloneFixture(buildScreen02WorkflowHandoff(
      current,
      "0.4.08",
      "2026-09-08T18:04:00.000Z",
    ));
    currentHandoff.event.preliminaryQualification = cloneFixture(
      restoredContinued!.candidates[0]!.qualification!,
    );
    currentHandoff.integrity.eventFingerprint =
      fingerprintScreen02WorkflowValue(currentHandoff.event);
    const { handoffFingerprint: _fingerprint, ...integrity } =
      currentHandoff.integrity;
    currentHandoff.integrity.handoffFingerprint =
      fingerprintScreen02WorkflowValue({ ...currentHandoff, integrity });
    expect(() => createScreen03LoadingState(
      currentHandoff,
      "2026-09-08T18:05:00.000Z",
    )).toThrow();
  });

  it("restores an integrity-valid v3 saved state without fabricating v4 source coordinates", () => {
    const legacy = cloneFixture(currentQualifiedReadyState());
    legacy.candidates[0]!.qualification = downgradeQualificationToV3(
      legacy.candidates[0]!.qualification,
    ) as never;
    const restored = restoreScreen02FindState(readdressFindState(legacy));

    expect(restored?.candidates[0]?.qualification).toMatchObject({
      version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
      hardScope: {
        evidenceState: "supported",
        relevanceState: "within-scope",
      },
      substantiveOverview: { sourceGrounding: { coordinates: [] } },
      migrationProvenance: {
        fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
        method: "derived-retained-v3-disposition",
        sourceEvidenceReconstructed: false,
      },
    });
  });

  it("verifies old fingerprints before migrating qualification v2 and funnel v1", () => {
    const current = currentQualifiedReadyState();
    const legacy = legacyV0406State(current);
    const restored = restoreScreen02FindState(legacy);

    expect(restored).not.toBeNull();
    expect(restored?.candidates[0]?.qualification?.version).toBe(
      SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
    );
    expect(restored?.candidates[0]?.qualification).toMatchObject({
      hardScope: {
        evidenceState: "supported",
        relevanceState: "within-scope",
      },
      substantiveOverview: {
        sourceGrounding: { coordinates: [] },
      },
      migrationProvenance: {
        fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION,
        method: "derived-retained-v2-checks",
        sourceEvidenceReconstructed: false,
      },
    });
    expect(restored?.candidateSets[0]?.manifest.funnel?.schemaVersion).toBe(
      SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
    );
    expect(restored?.candidateSets[0]?.manifest.funnel?.retrievalFailures)
      .toBe(0);
    expect(restored?.candidateSets[0]?.manifest).toMatchObject({
      protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
    });
    expect(restored?.candidateSets[0]?.manifest.retrievalExecution)
      .toBeUndefined();

    const tampered = cloneFixture(legacy);
    tampered.candidates[0]!.description.text = "Tampered persisted fact.";
    expect(restoreScreen02FindState(tampered)).toBeNull();
  });

  it("rejects a handoff carrying a migrated eligible qualification until it is refreshed", () => {
    const currentState = currentQualifiedReadyState();
    const legacyState = legacyV0406State(currentState);
    const currentHandoff = buildScreen02WorkflowHandoff(
      currentState,
      "0.4.06",
      "2026-08-10T20:00:00.000Z",
    );
    const legacyHandoff = legacyV0406Handoff(
      currentHandoff,
      legacyState,
    );

    expect(
      restoreScreen02WorkflowHandoff(legacyHandoff, legacyState),
    ).toBeNull();

    const tampered = cloneFixture(legacyHandoff);
    tampered.event.description.text = "Tampered handoff fact.";
    expect(
      restoreScreen02WorkflowHandoff(tampered, legacyState),
    ).toBeNull();
  });

  it("decodes the original canonical v0.4.06 envelope before returning migrated state", () => {
    const current = currentQualifiedReadyState();
    const legacy = legacyV0406State(current);
    const decoded = decodeScreen02FindWorkflowStateEnvelope(
      persistedLegacyEnvelope(legacy),
    );

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(decoded.state.candidates[0]?.qualification).toMatchObject({
      version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
      substantiveOverview: { sourceGrounding: { coordinates: [] } },
      migrationProvenance: {
        fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION,
        sourceEvidenceReconstructed: false,
      },
    });
  });
});
