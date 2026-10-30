import { describe, expect, it } from "vitest";

import { encodeScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import {
  continueScreen02FindCandidate,
  continueScreen02FindWithoutAssessment,
  createScreen02AuditState,
  createScreen02FindState,
  deriveScreen02AuditJudgment,
  deriveScreen02PreliminaryJudgment,
  finalizeScreen02FindCandidateAssessmentRequest,
  finalizeScreen02FindCriterionAssessmentRequest,
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowSource,
  fingerprintScreen02WorkflowValue,
  fingerprintScreen02FindCandidateSet,
  prepareScreen02AssessmentRequest,
  readCompatibleScreen02State,
  requireScreen02AuditState,
  requireScreen02FindState,
  restoreScreen02AuditState,
  restoreScreen02FindState,
  restoreScreen02WorkflowState,
  screen02AuditAssessmentUnavailableContinuationGate,
  screen02AuditContinuationGate,
  screen02FindAssessmentUnavailableContinuationGate,
  screen02FindCandidateGate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
  serializeScreen02WorkflowState,
  startUpdatedScreen02FromLegacy,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  clearScreen02FindSelection,
} from "../../src/core/screen02-find-workflow";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  assembleScreen02FindShockGlance,
  resolveScreen02ShockGlance,
} from "../../src/core/screen02-shock-glance";
import { buildScreen02WorkflowClientSnapshot } from "../../src/worker/screen02-workflow-controller";
import {
  SCREEN_02_AUDIT_STATE_KIND,
  SCREEN_02_FIND_STATE_KIND,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
  screen02AuditAssessmentPartIds,
  screen02FindAssessmentPartIds,
  type Screen02AuditState,
  type Screen02FindState,
  type Screen02FindCandidateAssessment,
  type Screen02CriterionFinding,
} from "../../src/core/screen02-workflow-types";
import {
  buildAuditIdentityState,
  buildFindFactsState,
  buildFixedQualifiedFindState,
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
  fixtureAt,
  legacyFindSessionFixture,
  legacyLockedAuditSessionFixture,
  workflowSource,
} from "./screen02-workflow-fixtures";
import { frozenScreen02V020LockedAuditEnvelope } from "./screen02-v0.2.20-locked-audit-envelope";

function unselectedReadyFindState() {
  const raw = cloneFixture(buildReadyFindState());
  raw.decision = {
    openedCandidateSnapshotId: null,
    tentativeSelectionSnapshotId: null,
    continuedRevision: null,
    history: [],
  };
  return requireScreen02FindState(raw);
}

function appendAuditReversal(
  state: Screen02AuditState,
  decisionId: string,
  at: string,
) {
  const raw = cloneFixture(state);
  const confirmation = raw.confirmedIdentity;
  if (!confirmation) throw new Error("Expected an active Audit confirmation fixture.");
  raw.revision += 1;
  raw.updatedAt = at;
  raw.identityDecisions.push({
    decisionId,
    action: "reversed",
    actor: "researcher",
    anchorRevisionId: confirmation.anchorRevisionId,
    matchSnapshotId: confirmation.matchSnapshotId,
    identitySnapshotId: confirmation.identitySnapshotId,
    dossierSnapshotId: confirmation.dossierSnapshotId,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: confirmation.decisionId,
    at,
    reason: "Researcher reconsidered the identity confirmation.",
  });
  raw.confirmedIdentity = null;
  return raw;
}

function applyCriteriaSnapshot(
  raw: Screen02FindState,
  criterionVersionRefs: Array<{ criterionId: string; version: number }>,
  candidateSetSnapshotId: string,
) {
  const active = raw.candidateSets.find(
    (set) => set.candidateSetSnapshotId === raw.activeCandidateSetSnapshotId,
  );
  if (!active) throw new Error("Expected an active candidate set fixture.");
  active.status = "superseded";
  active.supersededBySnapshotId = candidateSetSnapshotId;
  const snapshot = {
    candidateSetSnapshotId,
    searchRoundId: active.searchRoundId,
    candidateSnapshotIds: [...active.candidateSnapshotIds],
    criterionVersionRefs: cloneFixture(criterionVersionRefs),
    ordering: cloneFixture(active.ordering),
    manifest: cloneFixture(active.manifest),
  };
  raw.candidateSets.push({
    ...snapshot,
    candidateSetFingerprint: fingerprintScreen02WorkflowValue(snapshot),
    status: "active",
    supersededBySnapshotId: null,
  });
  raw.activeCandidateSetSnapshotId = candidateSetSnapshotId;
  raw.revision += 1;
  return raw;
}

function completeCriterionRequest(
  state: Screen02FindState,
  input: {
    jobId: string;
    requestId: string;
    candidateSnapshotId: string;
    criterionId: string;
    criterionVersion: number;
  },
) {
  const partId = `${input.candidateSnapshotId}:${input.criterionId}:${input.criterionVersion}`;
  let next = prepareScreen02AssessmentRequest(state, {
    ...input,
    mode: "find-criterion",
    attempt: 1,
    requestedPartIds: [partId],
    at: "2026-08-09T19:28:00.000Z",
  });
  for (const transition of [
    {
      status: "message-delivered" as const,
      at: "2026-08-09T19:28:01.000Z",
      actor: "chatgpt-host" as const,
    },
    {
      status: "draft-received" as const,
      at: "2026-08-09T19:28:02.000Z",
      actor: "chatgpt-host" as const,
      receiptId: `${input.requestId}:receipt`,
    },
    {
      status: "validating" as const,
      at: "2026-08-09T19:28:03.000Z",
      actor: "fixed-core" as const,
    },
  ]) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId: input.requestId,
      ...transition,
    });
  }
  return next as Screen02FindState;
}

describe("v0.2.21 Screen 2 workflow state contracts", () => {
  it("blocks a Find choice while its assessment is active, then keeps selection and continuation coherent", () => {
    const facts = buildFindFactsState();
    const candidateSnapshotId = facts.candidates[0]?.candidateSnapshotId;
    if (!candidateSnapshotId) throw new Error("Expected a factual candidate.");

    expect(
      screen02FindCandidateSelectionGate(facts, candidateSnapshotId),
    ).toEqual({
      eligible: false,
      reasons: ["Candidate assessment is still running."],
    });
    expect(
      screen02FindCandidateGate(facts, candidateSnapshotId).eligible,
    ).toBe(false);
    expect(() =>
      selectScreen02FindCandidate(
        facts,
        candidateSnapshotId,
        "blocked-active-assessment-selection",
        facts.updatedAt,
        "Researcher attempted to select an actively assessed candidate.",
      ),
    ).toThrow(/assessment is still running/i);

    const ready = unselectedReadyFindState();
    expect(
      screen02FindCandidateSelectionGate(ready, candidateSnapshotId),
    ).toEqual({ eligible: true, reasons: [] });
    expect(screen02FindCandidateGate(ready, candidateSnapshotId)).toEqual({
      eligible: true,
      reasons: [],
    });
    const selected = selectScreen02FindCandidate(
      ready,
      candidateSnapshotId,
      "completed-assessment-selection",
      "2026-08-09T19:00:00.000Z",
      "Researcher tentatively selected a source-backed factual event.",
    );
    expect(selected.decision.tentativeSelectionSnapshotId).toBe(
      candidateSnapshotId,
    );
    expect(screen02FindCandidateGate(selected, candidateSnapshotId)).toEqual({
      eligible: true,
      reasons: [],
    });
    const continued = continueScreen02FindCandidate(
      selected,
      "completed-assessment-continuation",
      "2026-08-09T19:00:01.000Z",
      "Researcher continued after the completed assessment.",
    );
    expect(continued.decision.history.at(-1)?.action).toBe("continued");
  });

  it("keeps a previous grounding-policy qualification readable but blocks selection and continuation", () => {
    const raw = cloneFixture(buildFixedQualifiedFindState());
    const candidate = raw.candidates[0];
    if (!candidate?.qualification) {
      throw new Error("Expected a qualified Find candidate.");
    }
    candidate.qualification.cacheKey = candidate.qualification.cacheKey
      .replace(":policy-v4:", ":policy-v3:");
    const { candidateFingerprint: _fingerprint, ...candidateValue } = candidate;
    candidate.candidateFingerprint = fingerprintScreen02WorkflowValue(
      candidateValue,
    );
    const previousPolicy = requireScreen02FindState(raw);

    expect(screen02FindCandidateSelectionGate(
      previousPolicy,
      candidate.candidateSnapshotId,
    )).toMatchObject({
      eligible: false,
      reasons: [expect.stringMatching(/historical|source grounding/iu)],
    });
    expect(() => selectScreen02FindCandidate(
      previousPolicy,
      candidate.candidateSnapshotId,
      "previous-policy-selection",
      "2026-09-09T12:55:00.000Z",
      "Attempted selection before current-policy requalification.",
    )).toThrow(/historical|source grounding/iu);

    const selected = cloneFixture(selectScreen02FindCandidate(
      buildFixedQualifiedFindState(),
      candidate.candidateSnapshotId,
      "current-policy-selection-before-restore",
      "2026-09-09T12:55:01.000Z",
      "Selected while the current grounding policy was still fresh.",
    ));
    const selectedCandidate = selected.candidates.find((item) =>
      item.candidateSnapshotId === candidate.candidateSnapshotId
    );
    if (!selectedCandidate?.qualification) {
      throw new Error("Expected the selected candidate qualification.");
    }
    selectedCandidate.qualification.cacheKey =
      selectedCandidate.qualification.cacheKey.replace(
        ":policy-v4:",
        ":policy-v3:",
      );
    const {
      candidateFingerprint: _selectedFingerprint,
      ...selectedCandidateValue
    } = selectedCandidate;
    selectedCandidate.candidateFingerprint = fingerprintScreen02WorkflowValue(
      selectedCandidateValue,
    );
    selected.shockGlances = selected.shockGlances?.map((glance) =>
      glance.candidateSnapshotId === selectedCandidate.candidateSnapshotId
        ? assembleScreen02FindShockGlance(
          selected,
          selectedCandidate.candidateSnapshotId,
          glance.createdAt,
        )
        : glance
    );
    const restoredSelected = requireScreen02FindState(selected);
    expect(() => continueScreen02FindCandidate(
      restoredSelected,
      "previous-policy-continuation",
      "2026-09-09T12:55:02.000Z",
      "Attempted continuation before current-policy requalification.",
    )).toThrow(/historical|source grounding/iu);
  });

  it("undoes a handed-off Find choice without resetting the comparison and permits another candidate", async () => {
    const raw = cloneFixture(unselectedReadyFindState());
    const original = raw.candidates[0];
    const activeSet = raw.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        raw.activeCandidateSetSnapshotId,
    );
    if (!original || !activeSet) {
      throw new Error("Expected an active Find comparison fixture.");
    }
    const {
      candidateFingerprint: _originalFingerprint,
      ...originalCandidateBase
    } = original;
    const alternativeBase = {
      ...cloneFixture(originalCandidateBase),
      candidateId: "gdpr-related-version",
      candidateSnapshotId: "gdpr-related-candidate-snapshot-v1",
      identity: {
        ...cloneFixture(original.identity),
        canonicalTitle: "Related privacy regulation candidate",
        commonNames: ["Related candidate"],
        formalIdentifier: "Related privacy instrument",
      },
      description: {
        ...cloneFixture(original.description),
        id: "gdpr-related-description",
        text: "A second source-backed privacy-regulation event lead.",
      },
      dateLeads: original.dateLeads.map((lead) => ({
        ...cloneFixture(lead),
        id: `${lead.id}-related`,
      })),
      broadCoverage: original.broadCoverage.map((claim) => ({
        ...cloneFixture(claim),
        id: `${claim.id}-related`,
      })),
    };
    raw.candidates.push({
      ...alternativeBase,
      candidateFingerprint:
        fingerprintScreen02WorkflowValue(alternativeBase),
    });
    activeSet.candidateSnapshotIds.push(
      alternativeBase.candidateSnapshotId,
    );
    activeSet.ordering.push({
      candidateSnapshotId: alternativeBase.candidateSnapshotId,
      rank: activeSet.ordering.length + 1,
      reason: "Retained as the second source-backed comparison candidate.",
    });
    activeSet.manifest.retainedResultBinding!.results.push({
      recordId: alternativeBase.candidateId,
      snapshotId: alternativeBase.candidateSnapshotId,
      sourceIds: [...alternativeBase.sourceIds],
      qualificationLane: alternativeBase.qualification?.lane ?? null,
      origins: [{
        kind: "query-result",
        retrievalLane: "official-baseline",
        evidenceRole: "identity",
        producerRecordId: "record-2",
        queryId: "query-1",
        returnedRecordIds: ["record-2"],
        sourceIds: [...alternativeBase.sourceIds],
      }],
    });
    activeSet.manifest.retainedResultBinding!.upstreamAccount = {
      sourceRecordsRetrieved: 2,
      uniqueEventLeads: 2,
    };
    activeSet.manifest.queryMatrix[0]!.returnedRecordIds.push("record-2");
    Object.assign(activeSet.manifest.retrievalExecution!.baseline, {
      recordsReceived: 2,
      proposalsGenerated: 2,
      uniqueProposalsGenerated: 2,
    });
    Object.assign(activeSet.manifest.retrievalExecution!.aggregate, {
      recordsReceived: 2,
      proposalsGenerated: 2,
      uniqueProposalsGenerated: 2,
    });
    Object.assign(activeSet.manifest.funnel!, {
      sourceRecordsRetrieved: 2,
      uniqueEventLeads: 2,
      evaluatedUniqueLeads: 2,
      hardScopePassed: 2,
      sourceQualityPassed: 2,
      substantiveInformationPassed: 2,
      relevancePassed: 2,
      exposureFeasibilityPassed: 2,
      qualifiedCandidates: 2,
      displayedCandidates: 2,
      directCandidates: 2,
    });
    activeSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(activeSet);

    let state = requireScreen02FindState(raw);
    state = prepareScreen02AssessmentRequest(state, {
      jobId: "alternative-find-assessment-job",
      requestId: "alternative-find-assessment-request",
      mode: "find-candidate",
      candidateSnapshotId: alternativeBase.candidateSnapshotId,
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:00:00.000Z",
    }) as Screen02FindState;
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "alternative-find-assessment-request",
      status: "delivery-rejected",
      at: "2026-08-09T19:00:01.000Z",
      actor: "chatgpt-host",
    }) as Screen02FindState;
    state = selectScreen02FindCandidate(
      state,
      original.candidateSnapshotId,
      "first-candidate-selection",
      "2026-08-09T19:00:02.000Z",
      "Researcher first selected the assessed candidate.",
    );
    const firstContinued = continueScreen02FindCandidate(
      state,
      "first-candidate-continuation",
      "2026-08-09T19:00:03.000Z",
      "Researcher first continued to Screen 3.",
    );
    const firstHandoff = buildScreen02WorkflowHandoff(
      firstContinued,
      "0.3.13",
      firstContinued.updatedAt,
    );
    const preservedCandidateCount = firstContinued.candidates.length;
    const preservedAssessmentCount = firstContinued.assessments.length;
    const firstGlances = cloneFixture(firstContinued.shockGlances ?? []);

    const reopened = clearScreen02FindSelection(firstContinued, {
      decisionId: "screen3-back-selection-clear",
      at: "2026-08-09T19:00:04.000Z",
      reason:
        "Researcher returned from Screen 3 and reopened the existing comparison.",
    });

    expect(reopened.runId).toBe(firstContinued.runId);
    expect(reopened.candidates).toHaveLength(preservedCandidateCount);
    expect(reopened.assessments).toHaveLength(preservedAssessmentCount);
    expect(reopened.shockGlances).toEqual(firstGlances);
    expect(reopened.decision.tentativeSelectionSnapshotId).toBeNull();
    expect(reopened.decision.continuedRevision).toBeNull();
    expect(reopened.decision.history.slice(-2).map((event) => event.action))
      .toEqual(["continued", "selection-cleared"]);
    const reopenedSnapshot = await buildScreen02WorkflowClientSnapshot(
      reopened,
      "reopened-find-private-access-token",
      {
        now: () => reopened.updatedAt,
        createId: (kind) => `reopened-${kind}`,
        signingConfig: null,
      },
    );
    expect(reopenedSnapshot.handoff).toBeNull();

    const selectedAlternative = selectScreen02FindCandidate(
      reopened,
      alternativeBase.candidateSnapshotId,
      "alternative-candidate-selection",
      "2026-08-09T19:00:05.000Z",
      "Researcher selected another retained candidate.",
    );
    const alternativeContinued = continueScreen02FindWithoutAssessment(
      selectedAlternative,
      "alternative-candidate-continuation",
      "2026-08-09T19:00:06.000Z",
      "ChatGPT assessment delivery was unavailable for the alternative candidate.",
      "The researcher accepted the listed mandatory Screen 3 checks.",
    );
    const alternativeHandoff = buildScreen02WorkflowHandoff(
      alternativeContinued,
      "0.3.13",
      alternativeContinued.updatedAt,
    );

    expect(alternativeContinued.decision.tentativeSelectionSnapshotId).toBe(
      alternativeBase.candidateSnapshotId,
    );
    expect(alternativeContinued.shockGlances).toHaveLength(2);
    const currentGlance = resolveScreen02ShockGlance(
      alternativeContinued,
      alternativeHandoff,
    );
    expect(currentGlance?.candidateSnapshotId).toBe(
      alternativeBase.candidateSnapshotId,
    );
    expect(currentGlance?.summary).not.toBe(firstGlances[0]?.summary);
    expect(alternativeContinued.decision.continuedRevision).toBe(
      alternativeContinued.revision,
    );
    expect(alternativeHandoff.event.identity.canonicalTitle).toBe(
      "Related privacy regulation candidate",
    );
    expect(alternativeHandoff.integrity.handoffFingerprint).not.toBe(
      firstHandoff.integrity.handoffFingerprint,
    );
  });

  it("makes a source-backed Screen 3 handoff available after the first rejected host delivery", () => {
    let find = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "find-host-capability-job",
      requestId: "find-host-capability-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:00:01.000Z",
    });
    if (find.mode !== "find") throw new Error("Expected Find state.");
    expect(
      screen02FindCandidateSelectionGate(
        find,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);
    find = requireScreen02FindState(
      transitionScreen02AssessmentRequest(find, {
        requestId: "find-host-capability-request",
        status: "delivery-rejected",
        at: "2026-08-09T19:00:02.000Z",
        actor: "chatgpt-host",
      }),
    );
    expect(
      screen02FindCandidateSelectionGate(
        find,
        "gdpr-candidate-snapshot-v1",
      ),
    ).toEqual({ eligible: true, reasons: [] });
    find = selectScreen02FindCandidate(
      find,
      "gdpr-candidate-snapshot-v1",
      "find-host-capability-selection",
      "2026-08-09T19:00:03.000Z",
      "Researcher selected a source-backed event after terminal delivery failure.",
    );
    expect(
      screen02FindCandidateGate(find, "gdpr-candidate-snapshot-v1").eligible,
    ).toBe(false);
    expect(screen02FindAssessmentUnavailableContinuationGate(find)).toEqual({
      eligible: true,
      reasons: [],
      affectedRequestIds: ["find-host-capability-request"],
    });

    const audit = transitionScreen02AssessmentRequest(
      prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
        jobId: "audit-host-capability-job",
        requestId: "audit-host-capability-request",
        mode: "audit-confirmed-event",
        identitySnapshotId: "ccpa-identity-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02AuditAssessmentPartIds],
        at: "2026-08-09T19:10:01.000Z",
      }),
      {
        requestId: "audit-host-capability-request",
        status: "delivery-rejected",
        at: "2026-08-09T19:10:02.000Z",
        actor: "chatgpt-host",
      },
    );
    if (audit.mode !== "audit") throw new Error("Expected Audit state.");
    expect(screen02AuditAssessmentUnavailableContinuationGate(audit)).toEqual({
      eligible: true,
      reasons: [],
      affectedRequestIds: ["audit-host-capability-request"],
    });
  });
  it("creates genuinely separate, exact-key Find and Audit roots", () => {
    const find = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "find-root",
      fixtureAt,
    );
    const audit = createScreen02AuditState(
      confirmedWorkflowAuditContext(),
      "audit-root",
      fixtureAt,
    );

    expect(find.schemaVersion).toBe(SCREEN_02_WORKFLOW_SCHEMA_VERSION);
    expect(find.stateKind).toBe(SCREEN_02_FIND_STATE_KIND);
    expect(audit.stateKind).toBe(SCREEN_02_AUDIT_STATE_KIND);
    expect("candidateSets" in find).toBe(true);
    expect("anchor" in find).toBe(false);
    expect("anchor" in audit).toBe(true);
    expect("candidateSets" in audit).toBe(false);

    expect(
      restoreScreen02FindState({ ...find, anchor: audit.anchor }),
    ).toBeNull();
    expect(
      restoreScreen02AuditState({ ...audit, candidateSets: [] }),
    ).toBeNull();
  });

  it("strictly rejects prerelease schema-2.1 Find shapes instead of synthesizing canonical fields", () => {
    const canonical = buildReadyFindState();
    expect(restoreScreen02FindState(canonical)).not.toBeNull();

    const missingDiscoveryRequests = cloneFixture(canonical);
    delete (missingDiscoveryRequests as unknown as Record<string, unknown>)
      .discoveryRequests;
    expect(restoreScreen02FindState(missingDiscoveryRequests)).toBeNull();

    const missingContinuationSeal = cloneFixture(canonical);
    delete (
      missingContinuationSeal.decision as unknown as Record<string, unknown>
    ).continuedRevision;
    expect(restoreScreen02FindState(missingContinuationSeal)).toBeNull();

    const prereleaseTarget = cloneFixture(canonical);
    const target = prereleaseTarget.assessmentRequests[0]!
      .target as unknown as Record<string, unknown>;
    target.candidateSetSnapshotId = canonical.activeCandidateSetSnapshotId;
    target.candidateSetFingerprint =
      canonical.candidateSets[0]!.candidateSetFingerprint;
    expect(restoreScreen02FindState(prereleaseTarget)).toBeNull();
  });

  it("preserves the exact confirmed Screen 1 baseline and freezes restored state", () => {
    const find = buildFindFactsState();
    const restored = restoreScreen02WorkflowState(
      JSON.parse(serializeScreen02WorkflowState(find)),
    );

    expect(restored).not.toBeNull();
    expect(restored?.screen01Baseline).toEqual(
      confirmedWorkflowFindContext(),
    );
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored?.screen01Baseline)).toBe(true);
    expect(Object.isFrozen(restored?.sources)).toBe(true);

    const tampered = cloneFixture(find);
    (
      tampered.screen01Baseline.scopeContract as {
        geography: string;
      }
    ).geography = "European Union";
    expect(restoreScreen02FindState(tampered)).toBeNull();
  });

  it("content-addresses factual candidate and identity snapshots", () => {
    const find = buildFindFactsState();
    const findTamper = cloneFixture(find);
    findTamper.candidates[0].identity.canonicalTitle = "Rewritten event";
    expect(restoreScreen02FindState(findTamper)).toBeNull();
    const findSetTamper = cloneFixture(find);
    findSetTamper.candidateSets[0].manifest.exactRequest =
      "Rewritten search request";
    expect(restoreScreen02FindState(findSetTamper)).toBeNull();

    const audit = buildAuditIdentityState();
    const auditTamper = cloneFixture(audit);
    auditTamper.possibleMatches[0].identity.issuer = "Rewritten issuer";
    expect(restoreScreen02AuditState(auditTamper)).toBeNull();
    const dossierTamper = cloneFixture(audit);
    dossierTamper.dossiers[0].whatHappened!.text = "Rewritten dossier";
    expect(restoreScreen02AuditState(dossierTamper)).toBeNull();
    const readdressedDossier = cloneFixture(audit);
    readdressedDossier.dossiers[0].whatHappened!.text =
      "Rewritten dossier using the same attached source.";
    const {
      dossierFingerprint: _priorDossierFingerprint,
      ...readdressedDossierInput
    } = readdressedDossier.dossiers[0];
    readdressedDossier.dossiers[0].dossierFingerprint =
      fingerprintScreen02WorkflowValue(readdressedDossierInput);
    expect(restoreScreen02AuditState(readdressedDossier)).toBeNull();

    const sourceEscape = cloneFixture(audit);
    const unrelatedSource = workflowSource("unrelated-dossier-source");
    sourceEscape.sources.push(unrelatedSource);
    sourceEscape.dossiers[0].sourceIds.push(unrelatedSource.id);
    sourceEscape.dossiers[0].whatHappened!.sourceIds.push(
      unrelatedSource.id,
    );
    const {
      dossierFingerprint: _escapedDossierFingerprint,
      ...escapedDossierInput
    } = sourceEscape.dossiers[0];
    sourceEscape.dossiers[0].dossierFingerprint =
      fingerprintScreen02WorkflowValue(escapedDossierInput);
    sourceEscape.confirmedIdentity!.dossierFingerprint =
      sourceEscape.dossiers[0].dossierFingerprint;
    const {
      confirmationFingerprint: _priorConfirmationFingerprint,
      ...confirmationInput
    } = sourceEscape.confirmedIdentity!;
    sourceEscape.confirmedIdentity!.confirmationFingerprint =
      fingerprintScreen02WorkflowValue(confirmationInput);
    sourceEscape.identityDecisions[0].confirmationFingerprint =
      sourceEscape.confirmedIdentity!.confirmationFingerprint;
    expect(restoreScreen02AuditState(sourceEscape)).toBeNull();
    const confirmationTamper = cloneFixture(audit);
    confirmationTamper.confirmedIdentity!.confirmedAt =
      "2026-08-09T18:10:59.000Z";
    expect(restoreScreen02AuditState(confirmationTamper)).toBeNull();
  });

  it("uses the exact Stage 0 categorical derivation without a displayed score", () => {
    expect(
      deriveScreen02PreliminaryJudgment({
        studyFit: "strong",
        outcomePathway: "plausible",
        measurementPotential: "possible",
      }),
    ).toBe("promising-to-verify");
    expect(
      deriveScreen02PreliminaryJudgment({
        studyFit: "mixed",
        outcomePathway: "plausible",
        measurementPotential: "difficult",
      }),
    ).toBe("worth-exploring");
    expect(
      deriveScreen02PreliminaryJudgment({
        studyFit: "weak",
        outcomePathway: "plausible",
        measurementPotential: "possible",
      }),
    ).toBe("low-priority");
    expect(
      deriveScreen02PreliminaryJudgment({
        studyFit: "strong",
        outcomePathway: "unclear",
        measurementPotential: "possible",
      }),
    ).toBe("not-enough-evidence");
    expect(
      deriveScreen02AuditJudgment({
        studyFit: "strong",
        outcomePathway: "plausible",
        coverageRelation: "mixed",
        measurementPotential: "difficult",
      }),
    ).toBe("worth-exploring");
  });

  it("keeps message delivery distinct from assessment completion", () => {
    const prepared = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "delivery-only-job",
      requestId: "delivery-only-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:00:00.000Z",
    }) as Screen02FindState;
    const delivered = transitionScreen02AssessmentRequest(prepared, {
      requestId: "delivery-only-request",
      status: "message-delivered",
      at: "2026-08-09T19:00:01.000Z",
      actor: "chatgpt-host",
    }) as Screen02FindState;

    expect(delivered.assessmentRequests[0].status).toBe(
      "message-delivered",
    );
    expect(delivered.assessments).toHaveLength(0);
    expect(
      screen02FindCandidateGate(
        delivered,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);
    expect(
      serializeScreen02WorkflowState(delivered),
    ).not.toContain("expectedRevision");
  });

  it("does not stale an in-flight assessment when an ordinary review action changes revision", () => {
    const prepared = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "revision-independent-job",
      requestId: "revision-independent-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:10:00.000Z",
    }) as Screen02FindState;
    const reviewedRaw = cloneFixture(prepared);
    reviewedRaw.revision += 1;
    reviewedRaw.updatedAt = "2026-08-09T19:10:01.000Z";
    reviewedRaw.decision.openedCandidateSnapshotId =
      "gdpr-candidate-snapshot-v1";
    reviewedRaw.decision.history.push({
      decisionId: "open-during-request",
      action: "opened",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      at: reviewedRaw.updatedAt,
      reason: "Researcher inspected the factual card.",
    });
    const reviewed = requireScreen02FindState(reviewedRaw);
    const delivered = transitionScreen02AssessmentRequest(reviewed, {
      requestId: "revision-independent-request",
      status: "message-delivered",
      at: "2026-08-09T19:10:02.000Z",
      actor: "chatgpt-host",
    });

    expect(delivered.revision).toBeGreaterThan(prepared.revision);
    expect(delivered.assessmentRequests.at(-1)?.target).toMatchObject({
      mode: "find-candidate",
      candidateSnapshotId:
      "gdpr-candidate-snapshot-v1",
    });
  });

  it("enforces the canonical lifecycle and complete-target accounting", () => {
    const prepared = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "invalid-transition-job",
      requestId: "invalid-transition-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:20:00.000Z",
    });
    expect(() =>
      transitionScreen02AssessmentRequest(prepared, {
        requestId: "invalid-transition-request",
        status: "completed",
        at: "2026-08-09T19:20:01.000Z",
        actor: "fixed-core",
        acceptedPartIds: [...screen02FindAssessmentPartIds],
      }),
    ).toThrow(/cannot move/i);
  });

  it("enforces attempt lineage and retries only unresolved result parts", () => {
    expect(() =>
      prepareScreen02AssessmentRequest(buildFindFactsState(), {
        jobId: "attempt-budget-job",
        requestId: "attempt-budget-request-2",
        retryOfRequestId: "missing-request-1",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 2,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:23:00.000Z",
      }),
    ).toThrow(/prior attempt/i);

    let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "targeted-retry-job",
      requestId: "targeted-retry-1",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:23:01.000Z",
    });
    for (const transition of [
      {
        status: "message-delivered" as const,
        at: "2026-08-09T19:23:02.000Z",
        actor: "chatgpt-host" as const,
      },
      {
        status: "draft-received" as const,
        at: "2026-08-09T19:23:03.000Z",
        actor: "chatgpt-host" as const,
        receiptId: "targeted-retry-1:receipt",
      },
      {
        status: "validating" as const,
        at: "2026-08-09T19:23:04.000Z",
        actor: "fixed-core" as const,
      },
    ]) {
      state = transitionScreen02AssessmentRequest(state, {
        requestId: "targeted-retry-1",
        ...transition,
      });
    }
    const failures = screen02FindAssessmentPartIds
      .filter(
        (partId) => partId !== "studyFit" && partId !== "mainConcern",
      )
      .map((partId) => ({ partId, codes: ["missing-or-invalid"] }));
    const partialAssessment: Screen02FindCandidateAssessment = {
      assessmentId: "targeted-retry-partial-assessment",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      requestId: "targeted-retry-1",
      status: "partial",
      studyFit: {
        category: "strong",
        explanation: "The event remains within the confirmed study scope.",
        evidenceSourceIds: ["gdpr-official"],
      },
      outcomePathway: null,
      measurementPotential: null,
      mainConcern: "The missing components require a targeted retry.",
      nextChecks: [],
      evidenceSourceIds: ["gdpr-official"],
      acceptedFields: ["studyFit", "mainConcern"],
      overallJudgment: null,
      overallJudgmentMethod: null,
      recordedAt: "2026-08-09T19:23:05.500Z",
    };
    state = finalizeScreen02FindCandidateAssessmentRequest(
      state as Screen02FindState,
      {
        requestId: "targeted-retry-1",
        status: "partial",
        at: "2026-08-09T19:23:05.500Z",
        note: "Fixture retained valid parts for targeted retry.",
        acceptedPartIds: ["studyFit", "mainConcern"],
        failures,
        assessment: partialAssessment,
      },
    );
    const retryParts = screen02FindAssessmentPartIds.filter(
      (partId) => partId !== "studyFit" && partId !== "mainConcern",
    );
    state = prepareScreen02AssessmentRequest(state, {
      jobId: "targeted-retry-job",
      requestId: "targeted-retry-2",
      retryOfRequestId: "targeted-retry-1",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 2,
      requestedPartIds: retryParts,
      at: "2026-08-09T19:23:06.000Z",
    });

    expect(state.assessmentRequests.at(-1)).toMatchObject({
      rootRequestId: "targeted-retry-1",
      retryOfRequestId: "targeted-retry-1",
      requestedPartIds: retryParts,
    });
    expect(() =>
      prepareScreen02AssessmentRequest(state, {
        jobId: "targeted-retry-job",
        requestId: "bad-targeted-retry",
        retryOfRequestId: "targeted-retry-2",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 3,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:23:07.000Z",
      }),
    ).toThrow(/prior attempt|unresolved result parts/i);
  });

  it("isolates one model job per packet and rejects result-bearing delivery failures or unrelated supersession", () => {
    const first = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "isolated-job-1",
      requestId: "isolated-request-1",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:23:20.000Z",
    });
    expect(() =>
      prepareScreen02AssessmentRequest(first, {
        jobId: "isolated-job-2",
        requestId: "isolated-request-2",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:23:21.000Z",
      }),
    ).toThrow(/already has an authoritative model job/i);
    expect(() =>
      transitionScreen02AssessmentRequest(first, {
        requestId: "isolated-request-1",
        status: "delivery-rejected",
        at: "2026-08-09T19:23:22.000Z",
        actor: "chatgpt-host",
        acceptedPartIds: [...screen02FindAssessmentPartIds],
      }),
    ).toThrow(/validated partial or completed result/i);

    const criterionRaw = cloneFixture(buildFindFactsState());
    criterionRaw.criteria.push({
      criterionId: "unrelated-pointer-criterion",
      version: 1,
      kind: "only-include",
      status: "active",
      statusReason: "Researcher added a semantic criterion.",
      text: "Candidate has public exposure indicators",
      exactRequest: "Only include candidates with public exposure indicators.",
      evaluator: "source-backed-ai",
      source: "researcher",
      createdAt: "2026-08-09T19:23:23.000Z",
    });
    criterionRaw.criteria.push({
      criterionId: "second-unrelated-criterion",
      version: 1,
      kind: "only-include",
      status: "active",
      statusReason: "Researcher added another semantic criterion.",
      text: "Candidate has a domestic issuer",
      exactRequest: "Only include candidates with a domestic issuer.",
      evaluator: "source-backed-ai",
      source: "researcher",
      createdAt: "2026-08-09T19:23:23.500Z",
    });
    applyCriteriaSnapshot(
      criterionRaw,
      [
        { criterionId: "unrelated-pointer-criterion", version: 1 },
        { criterionId: "second-unrelated-criterion", version: 1 },
      ],
      "find-candidate-set-unrelated-pointer",
    );
    let unrelated = prepareScreen02AssessmentRequest(
      requireScreen02FindState(criterionRaw),
      {
        jobId: "candidate-pointer-job",
        requestId: "candidate-pointer-request",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:23:24.000Z",
      },
    );
    unrelated = prepareScreen02AssessmentRequest(unrelated, {
      jobId: "criterion-pointer-job",
      requestId: "criterion-pointer-request",
      mode: "find-criterion",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "unrelated-pointer-criterion",
      criterionVersion: 1,
      attempt: 1,
      requestedPartIds: [
        "gdpr-candidate-snapshot-v1:unrelated-pointer-criterion:1",
      ],
      at: "2026-08-09T19:23:25.000Z",
    });
    expect(() =>
      transitionScreen02AssessmentRequest(unrelated, {
        requestId: "candidate-pointer-request",
        status: "superseded",
        at: "2026-08-09T19:23:26.000Z",
        actor: "fixed-core",
        supersededByRequestId: "criterion-pointer-request",
      }),
    ).toThrow(/unrelated replacement/i);

    unrelated = prepareScreen02AssessmentRequest(unrelated, {
      jobId: "second-criterion-pointer-job",
      requestId: "second-criterion-pointer-request",
      mode: "find-criterion",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "second-unrelated-criterion",
      criterionVersion: 1,
      attempt: 1,
      requestedPartIds: [
        "gdpr-candidate-snapshot-v1:second-unrelated-criterion:1",
      ],
      at: "2026-08-09T19:23:27.000Z",
    });
    expect(() =>
      transitionScreen02AssessmentRequest(unrelated, {
        requestId: "criterion-pointer-request",
        status: "superseded",
        at: "2026-08-09T19:23:28.000Z",
        actor: "fixed-core",
        supersededByRequestId: "second-criterion-pointer-request",
      }),
    ).toThrow(/canonical contract/i);
  });

  it("binds in-flight packets to immutable source versions", () => {
    const prepared = prepareScreen02AssessmentRequest(
      buildFindFactsState(),
      {
        jobId: "source-bound-job",
        requestId: "source-bound-request",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:24:00.000Z",
      },
    ) as Screen02FindState;
    const tampered = cloneFixture(prepared);
    tampered.sources[0].title = "Changed official source version";
    tampered.sources[0].sourceFingerprint =
      fingerprintScreen02WorkflowSource(tampered.sources[0]);

    expect(restoreScreen02FindState(tampered)).toBeNull();
  });

  it("rejects a late result after the active Find candidate set changes", () => {
    const prepared = prepareScreen02AssessmentRequest(
      buildFindFactsState(),
      {
        jobId: "old-set-job",
        requestId: "old-set-request",
        mode: "find-candidate",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:25:00.000Z",
      },
    ) as Screen02FindState;
    const replacedRaw = cloneFixture(prepared);
    replacedRaw.candidateSets[0].status = "superseded";
    replacedRaw.candidateSets[0].supersededBySnapshotId =
      "find-candidate-set-v2";
    const priorCandidate = replacedRaw.candidates[0];
    const {
      candidateFingerprint: _priorFingerprint,
      ...candidateSnapshot
    } = priorCandidate;
    const replacementCandidateBase = {
      ...candidateSnapshot,
      candidateId: "gdpr-refresh",
      candidateSnapshotId: "gdpr-candidate-snapshot-v2",
      searchRoundId: "find-round-2",
      description: {
        ...candidateSnapshot.description,
        id: "gdpr-description-v2",
      },
      dateLeads: candidateSnapshot.dateLeads.map((lead, index) => ({
        ...lead,
        id: `gdpr-date-lead-v2-${index + 1}`,
      })),
      broadCoverage: candidateSnapshot.broadCoverage.map((coverage, index) => ({
        ...coverage,
        id: `gdpr-coverage-lead-v2-${index + 1}`,
      })),
      recordedAt: "2026-08-09T19:25:01.000Z",
    };
    const replacementCandidate = {
      ...replacementCandidateBase,
      candidateFingerprint:
        fingerprintScreen02WorkflowValue(replacementCandidateBase),
    };
    replacedRaw.candidates.push(replacementCandidate);
    const replacementManifest = cloneFixture(
      replacedRaw.candidateSets[0].manifest,
    );
    replacementManifest.retainedResultBinding = {
      ...replacementManifest.retainedResultBinding!,
      results: [{
        recordId: replacementCandidate.candidateId,
        snapshotId: replacementCandidate.candidateSnapshotId,
        sourceIds: [...replacementCandidate.sourceIds],
        qualificationLane: replacementCandidate.qualification?.lane ?? null,
        origins: [{
          kind: "query-result",
          retrievalLane: "official-baseline",
          evidenceRole: "identity",
          producerRecordId: "record-1",
          queryId: "query-1",
          returnedRecordIds: ["record-1"],
          sourceIds: [...replacementCandidate.sourceIds],
        }],
      }],
    };
    const replacementSetBase = {
      candidateSetSnapshotId: "find-candidate-set-v2",
      searchRoundId: "find-round-2",
      candidateSnapshotIds: [replacementCandidate.candidateSnapshotId],
      criterionVersionRefs: [],
      ordering: [
        {
          candidateSnapshotId: replacementCandidate.candidateSnapshotId,
          rank: 1,
          reason: "Refreshed source-backed candidate snapshot.",
        },
      ],
      manifest: replacementManifest,
    };
    replacedRaw.candidateSets.push({
      ...replacementSetBase,
      candidateSetFingerprint:
        fingerprintScreen02WorkflowValue(replacementSetBase),
      status: "active",
      supersededBySnapshotId: null,
    });
    replacedRaw.discoveryRequests.push({
      discoveryRequestId: "find-discovery-request-v2",
      searchRoundId: "find-round-2",
      candidateSetSnapshotId: "find-candidate-set-v2",
      exactRequest: replacementManifest.exactRequest,
      status: "completed",
      startedAt: "2026-08-09T19:25:01.000Z",
      updatedAt: "2026-08-09T19:25:02.000Z",
      failureCodes: [],
      supersededByDiscoveryRequestId: null,
      lifecycle: [
        {
          status: "searching",
          at: "2026-08-09T19:25:01.000Z",
          note: null,
        },
        {
          status: "completed",
          at: "2026-08-09T19:25:02.000Z",
          note: "The replacement fixture retained one immutable candidate.",
        },
      ],
    });
    replacedRaw.activeCandidateSetSnapshotId = "find-candidate-set-v2";
    replacedRaw.revision += 1;
    replacedRaw.updatedAt = "2026-08-09T19:25:02.000Z";
    const replaced = requireScreen02FindState(replacedRaw);

    expect(() =>
      transitionScreen02AssessmentRequest(replaced, {
        requestId: "old-set-request",
        status: "message-delivered",
        at: "2026-08-09T19:25:03.000Z",
        actor: "chatgpt-host",
      }),
    ).toThrow(/only supersession/i);
    expect(() =>
      transitionScreen02AssessmentRequest(replaced, {
        requestId: "old-set-request",
        status: "superseded",
        at: "2026-08-09T19:25:03.500Z",
        actor: "fixed-core",
        supersededBySnapshotId: "find-candidate-set-v1",
      }),
    ).toThrow(/canonical contract/i);
    const superseded = transitionScreen02AssessmentRequest(replaced, {
      requestId: "old-set-request",
      status: "superseded",
      at: "2026-08-09T19:25:04.000Z",
      actor: "fixed-core",
      supersededBySnapshotId: "find-candidate-set-v2",
    });
    expect(superseded.assessmentRequests[0].status).toBe("superseded");
  });

  it("binds each assessment mode to the correct immutable snapshot kind", () => {
    const facts = buildFindFactsState();
    expect(() =>
      prepareScreen02AssessmentRequest(facts, {
        jobId: "wrong-find-snapshot-kind-job",
        requestId: "wrong-find-snapshot-kind",
        mode: "find-candidate",
        candidateSnapshotId: "find-candidate-set-v1",
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T19:21:00.000Z",
      }),
    ).toThrow(/active Find snapshot/i);

    const prepared = prepareScreen02AssessmentRequest(facts, {
      jobId: "fingerprint-bound-job",
      requestId: "fingerprint-bound-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:21:01.000Z",
    }) as Screen02FindState;
    const tampered = cloneFixture(prepared);
    tampered.assessmentRequests[0].target.packetFingerprint =
      "fnv1a64:0000000000000000";
    expect(restoreScreen02FindState(tampered)).toBeNull();
  });

  it("records explicit request supersession and rejects late completion", () => {
    let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "retry-job",
      requestId: "superseded-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T19:22:00.000Z",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "superseded-request",
      status: "message-delivered",
      at: "2026-08-09T19:22:01.000Z",
      actor: "chatgpt-host",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "superseded-request",
      status: "draft-received",
      at: "2026-08-09T19:22:02.000Z",
      actor: "chatgpt-host",
      receiptId: "superseded-request:receipt",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "superseded-request",
      status: "validating",
      at: "2026-08-09T19:22:03.000Z",
      actor: "fixed-core",
    });
    const supersededFailures = screen02FindAssessmentPartIds
      .filter((partId) => partId !== "studyFit")
      .map((partId) => ({ partId, codes: ["missing-or-invalid"] }));
    const supersededPartial: Screen02FindCandidateAssessment = {
      assessmentId: "superseded-request:assessment",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      requestId: "superseded-request",
      status: "partial",
      studyFit: {
        category: "strong",
        explanation: "The event remains within the confirmed study scope.",
        evidenceSourceIds: ["gdpr-official"],
      },
      outcomePathway: null,
      measurementPotential: null,
      mainConcern: null,
      nextChecks: [],
      evidenceSourceIds: ["gdpr-official"],
      acceptedFields: ["studyFit"],
      overallJudgment: null,
      overallJudgmentMethod: null,
      recordedAt: "2026-08-09T19:22:04.000Z",
    };
    state = finalizeScreen02FindCandidateAssessmentRequest(
      state as Screen02FindState,
      {
        requestId: "superseded-request",
        status: "partial",
        at: "2026-08-09T19:22:04.000Z",
        note: "Fixture retained one valid part before replacement.",
        acceptedPartIds: ["studyFit"],
        failures: supersededFailures,
        assessment: supersededPartial,
      },
    );
    state = prepareScreen02AssessmentRequest(state, {
      jobId: "retry-job",
      requestId: "replacement-request",
      retryOfRequestId: "superseded-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 2,
      requestedPartIds: screen02FindAssessmentPartIds.filter(
        (partId) => partId !== "studyFit",
      ),
      at: "2026-08-09T19:22:05.000Z",
    });
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "superseded-request",
      status: "superseded",
      at: "2026-08-09T19:22:06.000Z",
      actor: "fixed-core",
      supersededByRequestId: "replacement-request",
    });

    expect(state.assessmentRequests[0]).toMatchObject({
      status: "superseded",
      supersededByRequestId: "replacement-request",
    });
    expect(() =>
      transitionScreen02AssessmentRequest(state, {
        requestId: "superseded-request",
        status: "message-delivered",
        at: "2026-08-09T19:22:07.000Z",
        actor: "chatgpt-host",
      }),
    ).toThrow(/cannot move/i);
  });

  it("applies strict criteria independently from the candidate assessment", () => {
    const raw = cloneFixture(unselectedReadyFindState());
    raw.criteria = [
      {
        criterionId: "public-data",
        version: 1,
        kind: "only-include",
        status: "active",
        statusReason: "Researcher added this strict criterion.",
        text: "Exposure indicators are publicly available",
        exactRequest: "Only include shocks with public exposure indicators.",
        evaluator: "source-backed-ai",
        source: "researcher",
        createdAt: "2026-08-09T19:30:00.000Z",
      },
    ];
    applyCriteriaSnapshot(
      raw,
      [{ criterionId: "public-data", version: 1 }],
      "find-candidate-set-public-data",
    );
    const validating = completeCriterionRequest(
      requireScreen02FindState(raw),
      {
        jobId: "public-data-job",
        requestId: "public-data-request",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        criterionId: "public-data",
        criterionVersion: 1,
      },
    );
    const finding: Screen02CriterionFinding = {
        findingId: "finding-public-data",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        criterionId: "public-data",
        criterionVersion: 1,
        result: "unclear",
        reason:
          "The current source lead does not establish public firm-level exposure indicators.",
        evidenceSourceIds: ["gdpr-official"],
        method: "source-backed-ai",
        requestId: "public-data-request",
        recordedAt: "2026-08-09T19:30:01.000Z",
        overrides: [],
    };
    const blocked = finalizeScreen02FindCriterionAssessmentRequest(
      validating,
      {
        requestId: "public-data-request",
        status: "completed",
        at: "2026-08-09T19:30:01.000Z",
        note: "Fixture criterion finding passed fixed validation.",
        acceptedPartIds: [
          "gdpr-candidate-snapshot-v1:public-data:1",
        ],
        failures: [],
        finding,
      },
    );
    expect(
      screen02FindCandidateGate(
        blocked,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);

    const overriddenRaw = cloneFixture(blocked);
    overriddenRaw.criterionFindings[0].overrides.push({
      overrideId: "override-public-data",
      researcher: "Researcher",
      at: "2026-08-09T19:30:02.000Z",
      reason:
        "Proceed provisionally while treating public observability as an unresolved Screen 3 verification task.",
      priorResult: "unclear",
      resultingEligibility: "eligible",
    });
    const overridden = requireScreen02FindState(overriddenRaw);
    expect(
      screen02FindCandidateGate(
        overridden,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(true);

    const invalidOverride = cloneFixture(overridden);
    invalidOverride.criterionFindings[0].result = "technical-failure";
    invalidOverride.criterionFindings[0].overrides[0].priorResult =
      "technical-failure";
    expect(restoreScreen02FindState(invalidOverride)).toBeNull();

    const selfDeclaredFixed = cloneFixture(blocked);
    selfDeclaredFixed.criterionFindings[0].method = "fixed-rule";
    selfDeclaredFixed.criterionFindings[0].requestId = null;
    expect(restoreScreen02FindState(selfDeclaredFixed)).toBeNull();

    const fixedFallback = cloneFixture(blocked);
    fixedFallback.criterionFindings[0].method = "fixed-fallback";
    fixedFallback.criterionFindings[0].evidenceSourceIds = [];
    expect(restoreScreen02FindState(fixedFallback)).not.toBeNull();

    fixedFallback.criterionFindings[0].result = "meets";
    fixedFallback.criterionFindings[0].evidenceSourceIds = ["gdpr-official"];
    expect(restoreScreen02FindState(fixedFallback)).toBeNull();
  });

  it("binds source-backed criterion findings to the exact candidate, set, and criterion version", () => {
    const raw = cloneFixture(buildFindFactsState());
    raw.criteria = [
      {
        criterionId: "public-data",
        version: 1,
        kind: "only-include",
        status: "active",
        statusReason: "Researcher added the criterion.",
        text: "Exposure indicators are publicly available",
        exactRequest: "Only include events with public exposure indicators.",
        evaluator: "source-backed-ai",
        source: "researcher",
        createdAt: "2026-08-09T19:29:00.000Z",
      },
    ];
    applyCriteriaSnapshot(
      raw,
      [{ criterionId: "public-data", version: 1 }],
      "find-candidate-set-source-backed-criterion",
    );
    let state = prepareScreen02AssessmentRequest(
      requireScreen02FindState(raw),
      {
        jobId: "criterion-job-1",
        requestId: "criterion-request-1",
        mode: "find-criterion",
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        criterionId: "public-data",
        criterionVersion: 1,
        attempt: 1,
        requestedPartIds: [
          "gdpr-candidate-snapshot-v1:public-data:1",
        ],
        at: "2026-08-09T19:29:01.000Z",
      },
    );
    for (const transition of [
      {
        status: "message-delivered" as const,
        at: "2026-08-09T19:29:02.000Z",
        actor: "chatgpt-host" as const,
      },
      {
        status: "draft-received" as const,
        at: "2026-08-09T19:29:03.000Z",
        actor: "chatgpt-host" as const,
        receiptId: "criterion-request-1:receipt",
      },
      {
        status: "validating" as const,
        at: "2026-08-09T19:29:04.000Z",
        actor: "fixed-core" as const,
      },
    ]) {
      state = transitionScreen02AssessmentRequest(state, {
        requestId: "criterion-request-1",
        ...transition,
      });
    }
    const finding: Screen02CriterionFinding = {
      findingId: "public-data-ai-finding",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "public-data",
      criterionVersion: 1,
      result: "unclear",
      reason: "The current source does not establish public firm-level indicators.",
      evidenceSourceIds: ["gdpr-official"],
      method: "source-backed-ai",
      requestId: "criterion-request-1",
      recordedAt: "2026-08-09T19:29:06.000Z",
      overrides: [],
    };
    const findingState = finalizeScreen02FindCriterionAssessmentRequest(
      state as Screen02FindState,
      {
        requestId: "criterion-request-1",
        status: "completed",
        at: "2026-08-09T19:29:06.000Z",
        note: "Fixture criterion finding passed fixed validation.",
        acceptedPartIds: [
          "gdpr-candidate-snapshot-v1:public-data:1",
        ],
        failures: [],
        finding,
      },
    );
    expect(findingState.criterionFindings).toHaveLength(1);

    const criterionTamper = cloneFixture(findingState);
    criterionTamper.criteria[0].text = "Rewritten criterion";
    expect(restoreScreen02FindState(criterionTamper)).toBeNull();
  });

  it("permits requestless findings only for a canonical fixed evaluator", () => {
    const raw = cloneFixture(buildFindFactsState());
    raw.criteria = [
      {
        criterionId: "attached-source",
        version: 1,
        kind: "only-include",
        status: "active",
        statusReason: "Researcher enabled the built-in source-presence gate.",
        text: "Candidate has an attached source-backed description",
        exactRequest:
          "Only include candidates with at least one attached source and a source-backed description.",
        evaluator: "fixed-candidate-source-presence-v1",
        source: "researcher",
        createdAt: "2026-08-09T19:29:10.000Z",
      },
    ];
    applyCriteriaSnapshot(
      raw,
      [{ criterionId: "attached-source", version: 1 }],
      "find-candidate-set-fixed-source-gate",
    );
    raw.criterionFindings.push({
      findingId: "attached-source-finding",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "attached-source",
      criterionVersion: 1,
      result: "meets",
      reason: "The candidate and its description cite the attached official source.",
      evidenceSourceIds: ["gdpr-official"],
      method: "fixed-rule",
      requestId: null,
      recordedAt: "2026-08-09T19:29:11.000Z",
      overrides: [],
    });
    const fixed = requireScreen02FindState(raw);
    expect(fixed.criterionFindings).toHaveLength(1);

    const forgedMeaning = cloneFixture(fixed);
    forgedMeaning.criteria[0].text = "Candidate is issued domestically";
    expect(restoreScreen02FindState(forgedMeaning)).toBeNull();

    const forgedResult = cloneFixture(fixed);
    forgedResult.criterionFindings[0].result = "does-not-meet";
    forgedResult.criterionFindings[0].evidenceSourceIds = [];
    expect(restoreScreen02FindState(forgedResult)).toBeNull();
  });

  it("keeps criterion removal append-only and fails continuation closed after a new blocker", () => {
    const removableRaw = cloneFixture(unselectedReadyFindState());
    removableRaw.criteria = [
      {
        criterionId: "public-data",
        version: 1,
        kind: "only-include",
        status: "active",
        statusReason: "Researcher added the criterion.",
        text: "Exposure indicators are publicly available",
        exactRequest: "Only include events with public exposure indicators.",
        evaluator: "source-backed-ai",
        source: "researcher",
        createdAt: "2026-08-09T19:31:00.000Z",
      },
      {
        criterionId: "public-data",
        version: 2,
        kind: "only-include",
        status: "removed",
        statusReason: "Researcher removed this preference.",
        text: "Exposure indicators are publicly available",
        exactRequest: "Remove the public-indicator requirement.",
        evaluator: "source-backed-ai",
        source: "researcher",
        createdAt: "2026-08-09T19:31:01.000Z",
      },
    ];
    const removable = requireScreen02FindState(removableRaw);
    expect(
      screen02FindCandidateGate(
        removable,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(true);

    const selectedBeforeBlocker = selectScreen02FindCandidate(
      unselectedReadyFindState(),
      "gdpr-candidate-snapshot-v1",
      "pre-blocker-selection",
      "2026-08-09T19:31:02.000Z",
      "Researcher selected the candidate before adding a strict criterion.",
    );
    const selectedRaw = cloneFixture(selectedBeforeBlocker);
    selectedRaw.criteria.push({
      criterionId: "must-be-domestic",
      version: 1,
      kind: "only-include",
      status: "active",
      statusReason: "Researcher added a new strict criterion.",
      text: "The issuing jurisdiction must be domestic",
      exactRequest: "Only include domestically issued events.",
      evaluator: "source-backed-ai",
      source: "researcher",
      createdAt: "2026-08-09T19:31:03.000Z",
    });
    applyCriteriaSnapshot(
      selectedRaw,
      [{ criterionId: "must-be-domestic", version: 1 }],
      "find-candidate-set-domestic-criterion",
    );
    const selectedButBlocked = requireScreen02FindState(selectedRaw);
    expect(selectedButBlocked.decision.tentativeSelectionSnapshotId).toBe(
      "gdpr-candidate-snapshot-v1",
    );
    expect(
      screen02FindCandidateGate(
        selectedButBlocked,
        "gdpr-candidate-snapshot-v1",
      ).eligible,
    ).toBe(false);
    expect(() =>
      continueScreen02FindCandidate(
        selectedButBlocked,
        "blocked-continuation",
        "2026-08-09T19:31:04.000Z",
        "Attempted to continue after the new criterion.",
      ),
    ).toThrow(/blocked/i);
  });

  it("requires a dossier before Audit confirmation and an assessment before continuation", () => {
    const identified = buildAuditIdentityState();
    expect(screen02AuditContinuationGate(identified).eligible).toBe(false);

    const noDossier = cloneFixture(identified);
    noDossier.dossiers[0].status = "partial";
    expect(restoreScreen02AuditState(noDossier)).toBeNull();

    const ready = buildReadyAuditState();
    expect(screen02AuditContinuationGate(ready).eligible).toBe(true);
    expect(ready.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(ready.screen01Baseline.scopeContract.geography).toBe(
      "United States",
    );
    expect(
      ready.possibleMatches[0].identity.issuingJurisdiction,
    ).toBe("California, United States");
  });

  it("rejects research assessment state before Audit identity confirmation", () => {
    const raw = cloneFixture(buildReadyAuditState());
    raw.confirmedIdentity = null;
    raw.continuationHistory = [];
    expect(restoreScreen02AuditState(raw)).toBeNull();
  });

  it("rejects a second active Audit confirmation without an intervening reversal", () => {
    const raw = cloneFixture(buildAuditIdentityState());
    const active = raw.confirmedIdentity!;
    const secondBase = {
      confirmationSnapshotId: "ccpa-confirmation-snapshot-2",
      identitySnapshotId: active.identitySnapshotId,
      matchSnapshotId: active.matchSnapshotId,
      matchSetSnapshotId: active.matchSetSnapshotId,
      anchorRevisionId: active.anchorRevisionId,
      dossierSnapshotId: active.dossierSnapshotId,
      dossierFingerprint: active.dossierFingerprint,
      decisionId: "ccpa-confirmation-2",
      confirmedAt: "2026-08-09T19:45:00.000Z",
    };
    const second = {
      ...secondBase,
      confirmationFingerprint: fingerprintScreen02WorkflowValue(secondBase),
    };
    raw.identityDecisions.push({
      decisionId: second.decisionId,
      action: "confirmed",
      actor: "researcher",
      anchorRevisionId: second.anchorRevisionId,
      matchSnapshotId: second.matchSnapshotId,
      identitySnapshotId: second.identitySnapshotId,
      dossierSnapshotId: second.dossierSnapshotId,
      confirmationSnapshotId: second.confirmationSnapshotId,
      confirmationFingerprint: second.confirmationFingerprint,
      reversesDecisionId: null,
      at: second.confirmedAt,
      reason: "Attempted to replace an active confirmation.",
    });
    raw.confirmedIdentity = second;
    raw.revision += 1;
    raw.updatedAt = second.confirmedAt;

    expect(restoreScreen02AuditState(raw)).toBeNull();
  });

  it.each(["rejected", "related-version"] as const)(
    "rejects %s after an active Audit confirmation without reversal",
    (action) => {
      const raw = cloneFixture(buildAuditIdentityState());
      const active = raw.confirmedIdentity!;
      raw.identityDecisions.push({
        decisionId: `ccpa-${action}-after-confirmation`,
        action,
        actor: "researcher",
        anchorRevisionId: active.anchorRevisionId,
        matchSnapshotId: active.matchSnapshotId,
        identitySnapshotId: active.identitySnapshotId,
        dossierSnapshotId: null,
        confirmationSnapshotId: null,
        confirmationFingerprint: null,
        reversesDecisionId: null,
        at: "2026-08-09T19:46:00.000Z",
        reason: "Attempted to decide a match before reversing confirmation.",
      });
      raw.confirmedIdentity = null;
      raw.revision += 1;
      raw.updatedAt = "2026-08-09T19:46:00.000Z";

      expect(restoreScreen02AuditState(raw)).toBeNull();
    },
  );

  it("derives one active Audit confirmation from replay and rejects a double reversal", () => {
    const confirmed = buildAuditIdentityState();
    const reversedRaw = appendAuditReversal(
      confirmed,
      "ccpa-reversal-1",
      "2026-08-09T19:50:00.000Z",
    );
    const unclearedPointer = cloneFixture(reversedRaw);
    unclearedPointer.confirmedIdentity = cloneFixture(confirmed.confirmedIdentity);
    expect(restoreScreen02AuditState(unclearedPointer)).toBeNull();

    const reversed = requireScreen02AuditState(reversedRaw);
    expect(reversed.dossiers).toHaveLength(1);
    expect(reversed.assessments).toHaveLength(0);
    expect(reversed.continuationHistory).toHaveLength(0);
    expect(screen02AuditContinuationGate(reversed).eligible).toBe(false);

    const doubleReversal = cloneFixture(reversed);
    const prior = confirmed.confirmedIdentity!;
    doubleReversal.revision += 1;
    doubleReversal.updatedAt = "2026-08-09T19:51:00.000Z";
    doubleReversal.identityDecisions.push({
      decisionId: "ccpa-reversal-2",
      action: "reversed",
      actor: "researcher",
      anchorRevisionId: prior.anchorRevisionId,
      matchSnapshotId: prior.matchSnapshotId,
      identitySnapshotId: prior.identitySnapshotId,
      dossierSnapshotId: prior.dossierSnapshotId,
      confirmationSnapshotId: null,
      confirmationFingerprint: null,
      reversesDecisionId: prior.decisionId,
      at: doubleReversal.updatedAt,
      reason: "Attempted to reverse the same confirmation twice.",
    });
    expect(restoreScreen02AuditState(doubleReversal)).toBeNull();
  });

  it("requires one revision-sealed final Audit continuation", () => {
    const ready = buildReadyAuditState();
    expect(ready.continuationHistory[0]?.continuedRevision).toBe(ready.revision);

    const multiple = cloneFixture(ready);
    multiple.continuationHistory.push({
      ...cloneFixture(multiple.continuationHistory[0]!),
      continuationId: "audit-continuation-2",
      reason: "Attempted a second continuation.",
    });
    expect(restoreScreen02AuditState(multiple)).toBeNull();

    const nonFinal = cloneFixture(ready);
    nonFinal.revision += 1;
    nonFinal.updatedAt = "2026-08-09T19:52:00.000Z";
    nonFinal.continuationHistory[0]!.continuedRevision = nonFinal.revision;
    expect(restoreScreen02AuditState(nonFinal)).toBeNull();
  });

  it("never emits a legacy Audit representation or Screen 3 treatment object", () => {
    const serialized = serializeScreen02WorkflowState(buildReadyAuditState());
    for (const forbidden of [
      '"kind":"representation"',
      '"representationType"',
      '"candidateConstruct"',
      '"operationalization"',
      '"primaryRepresentationType"',
      '"primaryConstruct"',
      '"likelyServiceLevel"',
      '"scorecard"',
      '"operativeDate"',
      '"eligibilityFunction"',
      '"exposureCoding"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    const injected = cloneFixture(buildReadyAuditState()) as unknown as Record<
      string,
      unknown
    >;
    injected.representationType = "whole-package";
    expect(restoreScreen02AuditState(injected)).toBeNull();
  });

  it("restores v0.2.20 sessions and envelopes only as read-only compatibility state", () => {
    const findLegacy = legacyFindSessionFixture();
    const auditLegacy = legacyLockedAuditSessionFixture();
    const envelope = encodeScreen02StateEnvelope(findLegacy);
    const auditEnvelope = frozenScreen02V020LockedAuditEnvelope;

    expect(auditLegacy).toMatchObject({
      schemaVersion: "2.0",
      mode: "audit",
      revision: 3,
      screen01Baseline: { appVersion: "0.2.20" },
      selectedItemId: "legacy-ccpa-whole-package",
      lockedChoice: {
        status: "locked",
        itemId: "legacy-ccpa-whole-package",
        primaryRepresentationType: "whole-package",
        downstreamStatus: "screen-03-ready",
      },
    });
    expect(auditLegacy.items[0]).toMatchObject({
      id: "legacy-ccpa-whole-package",
      kind: "representation",
      representationType: "whole-package",
    });
    expect(auditLegacy.interaction.itemVersions).toHaveLength(1);
    expect(auditLegacy.interaction.itemVersions[0].item).toMatchObject({
      id: "legacy-ccpa-whole-package",
      kind: "representation",
      representationType: "whole-package",
    });

    const findRead = readCompatibleScreen02State(findLegacy);
    expect(findRead).toMatchObject({
      format: "v0.2.20-session",
      writable: false,
      restartDisposition: "start-updated-find-from-baseline",
    });
    expect(readCompatibleScreen02State(envelope)).toMatchObject({
      format: "v0.2.20-envelope",
      writable: false,
    });
    expect(readCompatibleScreen02State(auditLegacy)).toMatchObject({
      format: "v0.2.20-session",
      writable: false,
      restartDisposition: "restart-audit-identity-resolution",
    });
    expect(readCompatibleScreen02State(auditEnvelope)).toMatchObject({
      format: "v0.2.20-envelope",
      writable: false,
      restartDisposition: "restart-audit-identity-resolution",
    });
    const auditRead = readCompatibleScreen02State(auditLegacy);
    expect(Object.isFrozen(auditRead)).toBe(true);
    expect(Object.isFrozen(auditRead && !auditRead.writable ? auditRead.legacySession : null)).toBe(true);
    expect(() =>
      serializeScreen02WorkflowState(
        auditLegacy as unknown as Screen02FindState,
      ),
    ).toThrow(/legacy read-only/i);
    expect(restoreScreen02WorkflowState(auditLegacy)).toBeNull();
    expect(restoreScreen02WorkflowState(auditEnvelope)).toBeNull();
    expect(() =>
      prepareScreen02AssessmentRequest(
        auditLegacy as unknown as Screen02FindState,
        {
          jobId: "legacy-write-attempt",
          requestId: "legacy-write-attempt-1",
          mode: "find-candidate",
          candidateSnapshotId: "legacy-ccpa-whole-package",
          attempt: 1,
          requestedPartIds: [...screen02FindAssessmentPartIds],
          at: "2026-08-09T20:09:00.000Z",
        },
      ),
    ).toThrow(/canonical contract/i);

    if (!findRead || findRead.writable) {
      throw new Error("Expected a read-only legacy Find state.");
    }
    const restarted = startUpdatedScreen02FromLegacy(
      findRead,
      "updated-find-run",
      "2026-08-09T20:10:00.000Z",
    );
    expect(restarted.runId).toBe("updated-find-run");
    expect(restarted.screen01Baseline).toEqual(
      findLegacy.screen01Baseline,
    );
    expect(restarted.mode).toBe("find");
    expect(restarted.mode === "find" && restarted.candidates).toEqual([]);

    if (!auditRead || auditRead.writable) {
      throw new Error("Expected a read-only legacy Audit state.");
    }
    const restartedAudit = startUpdatedScreen02FromLegacy(
      auditRead,
      "updated-audit-run",
      "2026-08-09T20:11:00.000Z",
    );
    expect(restartedAudit.mode).toBe("audit");
    if (restartedAudit.mode !== "audit") {
      throw new Error("Expected a restarted Audit state.");
    }
    expect(restartedAudit.screen01Baseline).toEqual(
      auditLegacy.screen01Baseline,
    );
    expect(restartedAudit.confirmedIdentity).toBeNull();
    expect(restartedAudit.possibleMatches).toEqual([]);
    expect(restartedAudit.dossiers).toEqual([]);
    expect(restartedAudit.identityDecisions).toEqual([]);
    expect(restartedAudit.assessments).toEqual([]);
    expect(restartedAudit.assessmentRequests).toEqual([]);
    expect(restartedAudit.continuationHistory).toEqual([]);
  });

  it("keeps deterministic state fingerprints independent of object property order", () => {
    const state = buildReadyFindState();
    const reordered = Object.fromEntries(
      Object.entries(cloneFixture(state)).reverse(),
    );
    expect(fingerprintScreen02WorkflowState(state)).toBe(
      fingerprintScreen02WorkflowState(
        restoreScreen02WorkflowState(reordered)!,
      ),
    );
  });

  it("enforces the released canonical and compressed transport capacity gate", () => {
    const oversized = cloneFixture(buildFindFactsState());
    oversized.sources[0].title = "x".repeat(2 * 1024 * 1024);
    expect(restoreScreen02FindState(oversized)).toBeNull();
  });

  it("binds a context bridge identifier to the cited lead's visible title", () => {
    const raw = cloneFixture(buildFindFactsState());
    const candidateSet = raw.candidateSets.find(
      (set) => set.candidateSetSnapshotId === raw.activeCandidateSetSnapshotId,
    );
    if (!candidateSet) throw new Error("Expected an active candidate set.");
    candidateSet.manifest.queryMatrix.push({
      id: "context-bridge-query-x",
      query:
        "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=2020-12345",
      purpose: "Independently retrieve the exact official record.",
      returnedRecordIds: ["2020-12345"],
    });
    candidateSet.manifest.contextLeads = [{
      id: "context-lead-x",
      title: "Study names Federal Register 2020-12345",
      locator: "https://context.example/study-x",
      publisher: "Context publisher",
      publishedDate: "2020-01-01",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Context only; direct official confirmation is required.",
    }];
    candidateSet.manifest.contextBridges = [{
      schemaVersion: "screen-02-context-official-bridge-v1",
      contextualLeadId: "context-lead-x",
      bridgeQueryId: "context-bridge-query-x",
      formalIdentifier: "2020-12345",
      returnedOfficialRecordIds: ["2020-12345"],
      status: "corroborated",
    }];
    candidateSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(candidateSet);
    expect(restoreScreen02FindState(raw)).not.toBeNull();

    const tampered = cloneFixture(raw);
    const tamperedSet = tampered.candidateSets.find(
      (set) => set.candidateSetSnapshotId === tampered.activeCandidateSetSnapshotId,
    )!;
    tamperedSet.manifest.contextLeads![0]!.title =
      "Study names Federal Register 2020-54321";
    tamperedSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(tamperedSet);
    expect(restoreScreen02FindState(tampered)).toBeNull();
  });

  it("requires a distinct continuation decision after Find selection", () => {
    const ready = buildReadyFindState();
    const raw = cloneFixture(ready);
    raw.decision.history = raw.decision.history.filter(
      (event) => event.action !== "continued",
    );
    raw.decision.continuedRevision = null;
    const selected = requireScreen02FindState(raw);
    const continued = continueScreen02FindCandidate(
      selected,
      "replacement-continuation",
      "2026-08-09T20:00:00.000Z",
      "Researcher explicitly continued.",
    );
    expect(continued.decision.history.at(-1)?.action).toBe("continued");
  });
});
