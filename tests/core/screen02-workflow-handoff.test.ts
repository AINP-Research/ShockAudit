import { describe, expect, it } from "vitest";

import {
  applyScreen02AuditConfirmedEventFixedFallback,
  markScreen02AuditRequestDelivered,
} from "../../src/core/screen02-audit-workflow";

import {
  SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
  buildScreen02WorkflowHandoff,
  fingerprintScreen02WorkflowHandoff,
  requireScreen02WorkflowHandoff,
  restoreScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoffCompletedAssessment,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_WORKERS_AI_COMPLETION_LIFECYCLE_NOTE,
  type Screen02WorkflowState,
} from "../../src/core/screen02-workflow-types";
import {
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  continueScreen02Audit,
  prepareScreen02AssessmentRequest,
  requireScreen02AuditState,
  requireScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  buildFindFactsState,
  buildAuditIdentityState,
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
} from "./screen02-workflow-fixtures";

function withDeliveredNote<T extends Screen02WorkflowState>(
  state: T,
  requestId: string,
  note: string,
) {
  const copy = cloneFixture(state);
  const request = copy.assessmentRequests.find(
    (candidate) => candidate.requestId === requestId,
  );
  const delivered = request?.lifecycle.find(
    (event) => event.status === "message-delivered",
  );
  if (!delivered) throw new Error("Expected delivered assessment fixture.");
  delivered.note = note;
  return copy as T;
}

function completedAssessment(handoff: Screen02WorkflowHandoff) {
  if ("status" in handoff.preliminaryAssessment) {
    throw new Error("Expected a completed preliminary assessment fixture.");
  }
  return handoff.preliminaryAssessment satisfies Screen02WorkflowHandoffCompletedAssessment;
}

function resignHandoff(handoff: Screen02WorkflowHandoff) {
  handoff.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    handoff.event,
  );
  handoff.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    handoff.history,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    handoff.integrity;
  handoff.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...handoff,
    integrity,
  });
  return handoff;
}

function tamperAndResign(
  handoff: Screen02WorkflowHandoff,
  tamper: (copy: Screen02WorkflowHandoff) => void,
) {
  const copy = cloneFixture(handoff);
  tamper(copy);
  return resignHandoff(copy);
}

describe("v0.2.21 common Screen 2 event handoff", () => {
  it("builds the same event-level shape from Find and Audit", () => {
    const find = buildScreen02WorkflowHandoff(
      buildReadyFindState(),
      "0.2.21",
      "2026-08-09T21:00:00.000Z",
    );
    const audit = buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.2.21",
      "2026-08-09T21:00:01.000Z",
    );

    expect(find.schemaVersion).toBe(
      SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION,
    );
    expect(Object.keys(find.event).sort()).toEqual(
      Object.keys(audit.event).sort(),
    );
    expect(find.event.identity.canonicalTitle).toBe(
      "General Data Protection Regulation",
    );
    expect(audit.event.identity.canonicalTitle).toBe(
      "California Consumer Privacy Act of 2018",
    );
    expect(find.dossierCompletionOrigin).toBeNull();
    expect(audit.dossierCompletionOrigin).toBe(
      "compatibility-model-tool",
    );
    expect(find.decision.mode).toBe("find");
    expect(audit.decision.mode).toBe("audit");
    expect(audit.criteriaFindings).toEqual([]);
  });

  it("emits v4 ChatGPT-host and legacy completion provenance from canonical lifecycle data", () => {
    const findState = withDeliveredNote(
      buildReadyFindState(),
      "find-assessment-request-1",
      SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
    );
    const auditState = withDeliveredNote(
      withDeliveredNote(
        buildReadyAuditState(),
        "ccpa-dossier-request-1",
        SCREEN_02_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
      ),
      "audit-assessment-request-1",
      SCREEN_02_WORKERS_AI_COMPLETION_LIFECYCLE_NOTE,
    );

    const find = buildScreen02WorkflowHandoff(
      requireScreen02FindState(findState),
      "0.2.29",
      "2026-08-09T21:00:00.000Z",
    );
    const audit = buildScreen02WorkflowHandoff(
      requireScreen02AuditState(auditState),
      "0.2.29",
      "2026-08-09T21:00:01.000Z",
    );

    expect(find.schemaVersion).toBe(
      "screen-02-to-screen-03-event-v4",
    );
    expect(completedAssessment(find).completionOrigin).toBe("chatgpt-host");
    expect(find.dossierCompletionOrigin).toBeNull();
    expect(completedAssessment(audit).completionOrigin).toBe("workers-ai");
    expect(audit.dossierCompletionOrigin).toBe("fixed-fallback");
    expect(restoreScreen02WorkflowHandoff(find, findState)).toEqual(find);
    expect(restoreScreen02WorkflowHandoff(audit, auditState)).toEqual(audit);
  });

  it("marks legacy host receipts as compatibility-model-tool and rejects forged v4 origins", () => {
    const state = buildReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.2.29",
      "2026-08-09T21:00:02.000Z",
    );
    expect(completedAssessment(handoff).completionOrigin).toBe(
      "compatibility-model-tool",
    );

    const forged = tamperAndResign(handoff, (copy) => {
      completedAssessment(copy).completionOrigin = "fixed-fallback";
    });
    expect(restoreScreen02WorkflowHandoff(forged, state)).toBeNull();

    const legacy = cloneFixture(handoff) as unknown as Record<string, unknown>;
    legacy.schemaVersion = SCREEN_02_WORKFLOW_HANDOFF_LEGACY_SCHEMA_VERSION;
    delete legacy.dossierCompletionOrigin;
    delete (
      legacy.preliminaryAssessment as Record<string, unknown>
    ).completionOrigin;
    resignHandoff(legacy as unknown as Screen02WorkflowHandoff);
    expect(restoreScreen02WorkflowHandoff(legacy, state)).not.toBeNull();
  });

  it("preserves source-derived dossier fallback provenance", () => {
    const state = cloneFixture(buildReadyAuditState());
    const request = state.assessmentRequests.find(
      (candidate) => candidate.requestId === "ccpa-dossier-request-1",
    );
    const completed = request?.lifecycle.find(
      (event) => event.status === "completed",
    );
    if (!completed) throw new Error("Expected completed dossier lifecycle.");
    completed.note =
      SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE;
    const safe = requireScreen02AuditState(state);
    const handoff = buildScreen02WorkflowHandoff(
      safe,
      "0.3.13",
      "2026-08-09T21:00:03.000Z",
    );
    expect(handoff.dossierCompletionOrigin).toBe("fixed-fallback");
    expect(restoreScreen02WorkflowHandoff(handoff, safe)).toEqual(handoff);
  });

  it("carries a source-derived confirmed-event fallback as a completed fixed-fallback assessment", () => {
    let state = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
      jobId: "handoff-audit-fallback-job",
      requestId: "handoff-audit-fallback-request",
      mode: "audit-confirmed-event",
      identitySnapshotId: "ccpa-identity-snapshot-v1",
      attempt: 1,
      requestedPartIds: [
        "studyFit",
        "outcomePathway",
        "coverageRelation",
        "measurementPotential",
        "mainConcern",
        "nextChecks",
      ],
      at: "2026-08-09T18:10:09.000Z",
    });
    if (state.mode !== "audit") throw new Error("Expected Audit state.");
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "handoff-audit-fallback-request",
      delivered: false,
      at: "2026-08-09T18:10:10.000Z",
    });
    state = applyScreen02AuditConfirmedEventFixedFallback(
      state,
      "handoff-audit-fallback-request",
      "2026-08-09T18:10:11.000Z",
    ).state;
    const completedRequest = state.assessmentRequests.at(-1)!;
    expect(completedRequest.lifecycle.at(-1)?.note).toBe(
      SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
    );
    state = continueScreen02Audit(
      state,
      "handoff-audit-fallback-continuation",
      "2026-08-09T18:10:12.000Z",
      "Researcher continued with the conservative fixed assessment.",
    );

    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.3.13",
      "2026-08-09T18:10:13.000Z",
    );
    const assessment = completedAssessment(handoff);
    expect(assessment).toMatchObject({
      completionOrigin: "fixed-fallback",
      judgment: "not-enough-evidence",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
    });
    expect(handoff.schemaVersion).toBe(SCREEN_02_WORKFLOW_HANDOFF_SCHEMA_VERSION);
    expect(handoff.unresolved.questions).toEqual(
      expect.arrayContaining(assessment.nextChecks),
    );
    expect(restoreScreen02WorkflowHandoff(handoff, state)).toEqual(handoff);
  });

  it("accepts fixed-fallback criterion provenance only with its canonical request ID", () => {
    const base = buildScreen02WorkflowHandoff(
      buildReadyFindState(),
      "0.2.29",
      "2026-08-09T21:00:03.000Z",
    );
    const fallback = tamperAndResign(base, (copy) => {
      copy.criteriaFindings.push({
        findingId: "criterion-fallback-1",
        candidateSnapshotId: copy.event.identitySnapshotId,
        criterionId: "researcher-criterion-1",
        criterionVersion: 1,
        result: "unclear",
        reason: "The conservative fixed fallback cannot resolve this criterion.",
        evidenceSourceIds: [],
        method: "fixed-fallback",
        requestId: "criterion-request-1",
        recordedAt: "2026-08-09T21:00:03.500Z",
        overrides: [],
      });
    });
    expect(() => serializeScreen02WorkflowHandoff(fallback)).not.toThrow();

    const missingRequest = tamperAndResign(fallback, (copy) => {
      copy.criteriaFindings[0]!.requestId = null;
    });
    expect(() => serializeScreen02WorkflowHandoff(missingRequest)).toThrow(
      /failed its contract/i,
    );
  });

  it("carries immutable source-state snapshot fingerprints as exact provenance", () => {
    const findState = buildReadyFindState();
    const auditState = buildReadyAuditState();
    const find = buildScreen02WorkflowHandoff(
      findState,
      "0.2.21",
      "2026-08-09T21:00:02.000Z",
    );
    const audit = buildScreen02WorkflowHandoff(
      auditState,
      "0.2.21",
      "2026-08-09T21:00:03.000Z",
    );

    if (find.provenance.mode !== "find") {
      throw new Error("Expected Find provenance.");
    }
    if (
      audit.provenance.mode !== "audit" ||
      audit.decision.mode !== "audit" ||
      !auditState.confirmedIdentity
    ) {
      throw new Error("Expected Audit provenance.");
    }
    const auditDecision = audit.decision;
    const candidateSet = findState.candidateSets.find(
      (item) =>
        item.candidateSetSnapshotId === findState.activeCandidateSetSnapshotId,
    );
    const candidate = findState.candidates.find(
      (item) => item.candidateSnapshotId === find.event.identitySnapshotId,
    );
    const matchSet = auditState.matchSets.find(
      (item) => item.matchSetSnapshotId === auditDecision.matchSetSnapshotId,
    );
    const match = auditState.possibleMatches.find(
      (item) => item.matchSnapshotId === auditDecision.matchSnapshotId,
    );
    const dossier = auditState.dossiers.find(
      (item) => item.dossierSnapshotId === auditDecision.dossierSnapshotId,
    );

    expect(find.provenance).toEqual({
      mode: "find",
      candidateSetSnapshotId: candidateSet?.candidateSetSnapshotId,
      candidateSetFingerprint: candidateSet?.candidateSetFingerprint,
      candidateSnapshotId: candidate?.candidateSnapshotId,
      candidateFingerprint: candidate?.candidateFingerprint,
    });
    expect(audit.provenance).toEqual({
      mode: "audit",
      matchSetSnapshotId: matchSet?.matchSetSnapshotId,
      matchSetFingerprint: matchSet?.matchSetFingerprint,
      matchSnapshotId: match?.matchSnapshotId,
      matchFingerprint: match?.matchFingerprint,
      dossierSnapshotId: dossier?.dossierSnapshotId,
      dossierFingerprint: dossier?.dossierFingerprint,
      confirmationSnapshotId:
        auditState.confirmedIdentity.confirmationSnapshotId,
      confirmationFingerprint:
        auditState.confirmedIdentity.confirmationFingerprint,
    });
  });

  it("carries only provisional event understanding into Screen 3", () => {
    const handoff = buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.2.21",
      "2026-08-09T21:10:00.000Z",
    );

    expect(handoff.event.settlement).toBe("preliminary-screen-02");
    expect(handoff.event.dateLeads).toHaveLength(2);
    expect(
      handoff.event.dateLeads.every(
        (lead) => lead.status === "provisional",
      ),
    ).toBe(true);
    expect(handoff.unresolved.screen03Boundary).toMatch(
      /Screen 3 must verify what changed/i,
    );
    expect(handoff.unresolved.questions.length).toBeGreaterThan(1);
  });

  it("preserves distinct search limitations reported under one source channel", () => {
    const candidate = cloneFixture(buildReadyFindState());
    const candidateSet = candidate.candidateSets[0]!;
    const sourceChannel = candidateSet.manifest.channels[0]!;
    candidateSet.manifest.channels.push({
      ...sourceChannel,
      note:
        "A second declared source boundary from the same channel remains independently visible.",
    });
    candidateSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(candidateSet);
    const sourceState = requireScreen02FindState(candidate);

    const handoff = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:15:00.000Z",
    );

    expect(handoff.history.searchManifests[0]?.channels).toHaveLength(2);
    expect(
      handoff.history.searchManifests[0]?.channels.map(
        (channel) => channel.channel,
      ),
    ).toEqual([sourceChannel.channel, sourceChannel.channel]);
    expect(restoreScreen02WorkflowHandoff(handoff, sourceState)).toEqual(
      handoff,
    );
  });

  it("consolidates repeated exclusion stages for one record in handoff history", () => {
    const candidate = cloneFixture(buildReadyFindState());
    const candidateSet = candidate.candidateSets[0]!;
    candidateSet.manifest.exclusions.push(
      {
        recordId: "bounded-exclusion-record",
        reason: "Excluded at the bounded raw-pool allowance.",
      },
      {
        recordId: "bounded-exclusion-record",
        reason: "Retained outside the final qualified-candidate limit.",
      },
    );
    candidateSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(candidateSet);
    const sourceState = requireScreen02FindState(candidate);

    const handoff = buildScreen02WorkflowHandoff(
      sourceState,
      "0.6.2",
      "2026-09-11T13:00:00.000Z",
    );
    expect(
      handoff.history.searchManifests[0]!.exclusions.filter(
        (exclusion) =>
          exclusion.recordId === "bounded-exclusion-record",
      ),
    ).toEqual([{
      recordId: "bounded-exclusion-record",
      reason:
        "Excluded at the bounded raw-pool allowance. Retained outside the final qualified-candidate limit.",
    }]);
    expect(restoreScreen02WorkflowHandoff(handoff, sourceState)).toEqual(
      handoff,
    );
  });

  it("rejects a handoff whose bridge no longer matches its cited lead title", () => {
    const candidate = cloneFixture(buildReadyFindState());
    const candidateSet = candidate.candidateSets[0]!;
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
    const sourceState = requireScreen02FindState(candidate);
    const handoff = buildScreen02WorkflowHandoff(
      sourceState,
      "0.4.08",
      "2026-09-08T16:00:00.000Z",
    );
    expect(restoreScreen02WorkflowHandoff(handoff, sourceState)).toEqual(
      handoff,
    );

    const tampered = tamperAndResign(handoff, (copy) => {
      copy.history.searchManifests[0]!.contextLeads![0]!.title =
        "Study names Federal Register 2020-54321";
    });
    expect(restoreScreen02WorkflowHandoff(tampered, sourceState)).toBeNull();
  });

  it("preserves original Audit wording and anchor history without copying study geography into issuer", () => {
    const handoff = buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.2.21",
      "2026-08-09T21:20:00.000Z",
    );

    if (handoff.decision.mode !== "audit") {
      throw new Error("Expected Audit handoff.");
    }
    expect(handoff.decision.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(handoff.history.anchorRevisions).toHaveLength(1);
    expect(handoff.screen01Baseline.scopeContract.geography).toBe(
      "United States",
    );
    expect(handoff.event.identity.issuingJurisdiction).toBe(
      "California, United States",
    );
  });

  it("does not create an Event Card, treatment rule, exposure coding, or legacy representation", () => {
    const serialized = serializeScreen02WorkflowHandoff(
      buildScreen02WorkflowHandoff(
        buildReadyAuditState(),
        "0.2.21",
        "2026-08-09T21:30:00.000Z",
      ),
    );

    for (const forbidden of [
      '"eventCard"',
      '"operativeDate"',
      '"treatmentEligibility"',
      '"eligibilityFunction"',
      '"thresholdAdjudication"',
      '"exemptionAdjudication"',
      '"exposureCoding"',
      '"causalValidity"',
      '"selectedTreatmentVersion"',
      '"representationType"',
      '"candidateConstruct"',
      '"operationalization"',
      '"scorecard"',
      '"likelyServiceLevel"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects additional Screen 3 fields and integrity tampering", () => {
    const sourceState = buildReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:40:00.000Z",
    );
    const injected = cloneFixture(handoff) as unknown as Record<
      string,
      unknown
    >;
    (injected.event as Record<string, unknown>).operativeDate =
      "2018-05-25";
    expect(restoreScreen02WorkflowHandoff(injected, sourceState)).toBeNull();

    const tampered = cloneFixture(handoff);
    tampered.event.identity.canonicalTitle = "Tampered title";
    expect(restoreScreen02WorkflowHandoff(tampered, sourceState)).toBeNull();
  });

  it("rejects recursively smuggled and extra nested fields after fingerprints are recomputed", () => {
    const sourceState = buildReadyAuditState();
    const base = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:41:00.000Z",
    );
    const attacks = [
      tamperAndResign(base, (copy) => {
        const identity = copy.event.relatedVersions[0].identity as unknown as Record<
          string,
          unknown
        >;
        identity.operativeDate = "2020-01-01";
      }),
      tamperAndResign(base, (copy) => {
        const lead = copy.event.dateLeads[0] as unknown as Record<
          string,
          unknown
        >;
        lead.confidence = "high";
      }),
      tamperAndResign(base, (copy) => {
        const query = copy.history.searchManifests[0]
          .queryMatrix[0] as unknown as Record<string, unknown>;
        query.resultScore = 1;
      }),
      tamperAndResign(base, (copy) => {
        const component = completedAssessment(copy)
          .coverageRelation as unknown as Record<string, unknown>;
        component.coverageRule = "verified";
      }),
      tamperAndResign(base, (copy) => {
        const fields = copy.history.anchorRevisions[0]
          .fields as unknown as Record<string, unknown>;
        fields.primaryConstruct = "covered business";
      }),
      tamperAndResign(base, (copy) => {
        const source = copy.sources[0] as unknown as Record<string, unknown>;
        source.notes = "Injected nested field";
        const { sourceFingerprint: _sourceFingerprint, ...fingerprintInput } =
          source;
        source.sourceFingerprint =
          fingerprintScreen02WorkflowValue(fingerprintInput);
      }),
    ];

    for (const attack of attacks) {
      expect(restoreScreen02WorkflowHandoff(attack, sourceState)).toBeNull();
    }
  });

  it("rejects recomputed payloads that break provisional, source, assessment, or criterion truth", () => {
    const sourceState = buildReadyFindState();
    const base = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:42:00.000Z",
    );
    const attacks = [
      tamperAndResign(base, (copy) => {
        (copy.event.description as unknown as Record<string, unknown>).status =
          "verified";
      }),
      tamperAndResign(base, (copy) => {
        copy.event.description.sourceIds = ["uncarried-source"];
      }),
      tamperAndResign(base, (copy) => {
        completedAssessment(copy).judgment = "low-priority";
      }),
      tamperAndResign(base, (copy) => {
        completedAssessment(copy).evidenceSourceIds = [];
      }),
      tamperAndResign(base, (copy) => {
        completedAssessment(copy).coverageRelation = {
          category: "strong",
          explanation: "A Find assessment may not claim audited coverage fit.",
          evidenceSourceIds: [...copy.event.sourceIds],
        };
      }),
      tamperAndResign(base, (copy) => {
        copy.criteriaFindings.push({
          findingId: "forged-finding",
          candidateSnapshotId: copy.event.identitySnapshotId,
          criterionId: "strict-criterion",
          criterionVersion: 1,
          result: "meets",
          reason: "A forged resolved finding with an invalid override.",
          evidenceSourceIds: [...copy.event.sourceIds],
          method: "fixed-rule",
          requestId: null,
          recordedAt: "2026-08-09T21:42:01.000Z",
          overrides: [
            {
              overrideId: "forged-override",
              researcher: "Researcher",
              at: "2026-08-09T21:42:02.000Z",
              reason: "Resolved findings cannot be overridden.",
              priorResult: "meets",
              resultingEligibility: "eligible",
            },
          ],
        });
      }),
    ];

    for (const attack of attacks) {
      expect(restoreScreen02WorkflowHandoff(attack, sourceState)).toBeNull();
    }
  });

  it("rejects recomputed payloads with broken immutable decision and history references", () => {
    const findState = buildReadyFindState();
    const auditState = buildReadyAuditState();
    const find = buildScreen02WorkflowHandoff(
      findState,
      "0.2.21",
      "2026-08-09T21:43:00.000Z",
    );
    const audit = buildScreen02WorkflowHandoff(
      auditState,
      "0.2.21",
      "2026-08-09T21:43:01.000Z",
    );
    const findAttacks = [
      tamperAndResign(find, (copy) => {
        if (copy.decision.mode !== "find") throw new Error("Expected Find.");
        copy.decision.selectionDecisionId =
          copy.decision.continuationDecisionId;
      }),
      tamperAndResign(find, (copy) => {
        copy.unresolved.provisionalClaimIds = [copy.event.description.id];
      }),
      tamperAndResign(find, (copy) => {
        copy.history.decisions.push({
          id: "post-continuation-removal",
          action: "removed",
          targetSnapshotId: copy.event.identitySnapshotId,
          at: "2026-08-09T21:43:02.000Z",
          reason: "A later removal invalidates the selected snapshot.",
        });
      }),
    ];
    const auditAttacks = [
      tamperAndResign(audit, (copy) => {
        if (copy.decision.mode !== "audit") throw new Error("Expected Audit.");
        copy.decision.activeAnchorRevisionId = "unknown-anchor-revision";
      }),
      tamperAndResign(audit, (copy) => {
        if (copy.decision.mode !== "audit") throw new Error("Expected Audit.");
        const continuation = copy.history.decisions.find(
          (item) => item.id === copy.decision.continuationDecisionId,
        );
        if (!continuation) throw new Error("Expected continuation history.");
        continuation.targetSnapshotId = "other-identity-snapshot";
      }),
      tamperAndResign(audit, (copy) => {
        copy.history.decisions.push({
          id: "post-continuation-no-match",
          action: "no-match",
          targetSnapshotId: null,
          at: "2026-08-09T21:43:03.000Z",
          reason: "A later no-match decision invalidates the confirmation.",
        });
      }),
      tamperAndResign(audit, (copy) => {
        if (copy.decision.mode !== "audit") throw new Error("Expected Audit.");
        copy.decision.dossierSnapshotId = "fabricated-dossier-snapshot";
      }),
      tamperAndResign(audit, (copy) => {
        copy.integrity.stateFingerprint = "fnv1a64:not-a-fingerprint";
      }),
    ];

    for (const attack of findAttacks) {
      expect(restoreScreen02WorkflowHandoff(attack, findState)).toBeNull();
    }
    for (const attack of auditAttacks) {
      expect(restoreScreen02WorkflowHandoff(attack, auditState)).toBeNull();
    }
  });

  it("rejects recomputed snapshot-provenance fabrication and smuggling", () => {
    const findState = buildReadyFindState();
    const auditState = buildReadyAuditState();
    const find = buildScreen02WorkflowHandoff(
      findState,
      "0.2.21",
      "2026-08-09T21:44:00.000Z",
    );
    const audit = buildScreen02WorkflowHandoff(
      auditState,
      "0.2.21",
      "2026-08-09T21:44:01.000Z",
    );
    const findAttacks = [
      tamperAndResign(find, (copy) => {
        if (copy.decision.mode !== "find") throw new Error("Expected Find.");
        copy.decision.candidateSetSnapshotId =
          "fabricated-candidate-set-snapshot";
      }),
      tamperAndResign(find, (copy) => {
        if (copy.provenance.mode !== "find") {
          throw new Error("Expected Find provenance.");
        }
        copy.provenance.candidateFingerprint = "fnv1a64:malformed";
      }),
    ];
    const auditAttacks = [
      tamperAndResign(audit, (copy) => {
        if (
          copy.decision.mode !== "audit" ||
          copy.provenance.mode !== "audit"
        ) {
          throw new Error("Expected Audit provenance.");
        }
        copy.decision.dossierSnapshotId = "fabricated-dossier-snapshot";
        copy.provenance.dossierSnapshotId = "fabricated-dossier-snapshot";
      }),
      tamperAndResign(audit, (copy) => {
        if (copy.provenance.mode !== "audit") {
          throw new Error("Expected Audit provenance.");
        }
        copy.provenance.dossierFingerprint =
          "fnv1a64:0000000000000000";
      }),
      tamperAndResign(audit, (copy) => {
        if (
          copy.decision.mode !== "audit" ||
          copy.provenance.mode !== "audit"
        ) {
          throw new Error("Expected Audit provenance.");
        }
        copy.decision.confirmationSnapshotId =
          "fabricated-confirmation-snapshot";
        copy.provenance.confirmationSnapshotId =
          "fabricated-confirmation-snapshot";
      }),
      tamperAndResign(audit, (copy) => {
        const provenance = copy.provenance as unknown as Record<
          string,
          unknown
        >;
        provenance.provenanceNote = "Injected field";
      }),
    ];

    for (const attack of findAttacks) {
      expect(restoreScreen02WorkflowHandoff(attack, findState)).toBeNull();
    }
    for (const attack of auditAttacks) {
      expect(restoreScreen02WorkflowHandoff(attack, auditState)).toBeNull();
    }
  });

  it("rejects a coherent public-FNV dossier rewrite against the canonical source state", () => {
    const sourceState = buildReadyAuditState();
    const original = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:45:00.000Z",
    );
    const rewritten = cloneFixture(original);
    const decision = rewritten.decision;
    const provenance = rewritten.provenance;
    if (
      decision.mode !== "audit" ||
      provenance.mode !== "audit"
    ) {
      throw new Error("Expected Audit provenance.");
    }
    const confirmation = rewritten.history.decisions.find(
      (item) => item.id === decision.confirmationDecisionId,
    );
    if (!confirmation) throw new Error("Expected confirmation history.");

    decision.dossierSnapshotId = "fabricated-dossier-snapshot";
    provenance.dossierSnapshotId = decision.dossierSnapshotId;
    provenance.dossierFingerprint =
      fingerprintScreen02WorkflowValue({
        dossierSnapshotId: decision.dossierSnapshotId,
        fabricated: true,
      });
    provenance.confirmationFingerprint =
      fingerprintScreen02WorkflowValue({
        confirmationSnapshotId: provenance.confirmationSnapshotId,
        identitySnapshotId: decision.identitySnapshotId,
        matchSnapshotId: provenance.matchSnapshotId,
        matchSetSnapshotId: provenance.matchSetSnapshotId,
        anchorRevisionId: decision.activeAnchorRevisionId,
        dossierSnapshotId: provenance.dossierSnapshotId,
        dossierFingerprint: provenance.dossierFingerprint,
        decisionId: decision.confirmationDecisionId,
        confirmedAt: confirmation.at,
      });
    const coherentlyResigned = resignHandoff(rewritten);

    expect(() =>
      serializeScreen02WorkflowHandoff(coherentlyResigned),
    ).not.toThrow();
    expect(
      restoreScreen02WorkflowHandoff(coherentlyResigned, sourceState),
    ).toBeNull();
    expect(() =>
      requireScreen02WorkflowHandoff(coherentlyResigned, sourceState),
    ).toThrow(/source-state contract/i);
  });

  it("round-trips canonically and freezes restored handoffs", () => {
    const sourceState = buildReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      sourceState,
      "0.2.21",
      "2026-08-09T21:50:00.000Z",
    );
    const restored = restoreScreen02WorkflowHandoff(
      JSON.parse(serializeScreen02WorkflowHandoff(handoff)),
      sourceState,
    );

    expect(restored).toEqual(handoff);
    expect(requireScreen02WorkflowHandoff(handoff, sourceState)).toEqual(
      handoff,
    );
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored?.event)).toBe(true);
    expect(fingerprintScreen02WorkflowHandoff(restored)).toBe(
      fingerprintScreen02WorkflowHandoff(handoff),
    );
  });

  it("requires continuation separately from selection or identity confirmation", () => {
    const findRaw = cloneFixture(buildReadyFindState());
    findRaw.decision.history = findRaw.decision.history.filter(
      (event) => event.action !== "continued",
    );
    findRaw.decision.continuedRevision = null;
    const selectedFind = requireScreen02FindState(findRaw);
    expect(() =>
      buildScreen02WorkflowHandoff(
        selectedFind,
        "0.2.21",
        "2026-08-09T22:00:00.000Z",
      ),
    ).toThrow(/separate selection and continuation/i);

    const auditRaw = cloneFixture(buildReadyAuditState());
    auditRaw.continuationHistory = [];
    const confirmedAudit = requireScreen02AuditState(auditRaw);
    expect(() =>
      buildScreen02WorkflowHandoff(
        confirmedAudit,
        "0.2.21",
        "2026-08-09T22:00:01.000Z",
      ),
    ).toThrow(/separate continuation/i);
  });

  it("rejects a factual-only Find state before candidate assessment and choice", () => {
    expect(() =>
      buildScreen02WorkflowHandoff(
        buildFindFactsState(),
        "0.2.21",
        "2026-08-09T22:10:00.000Z",
      ),
    ).toThrow(/selected candidate/i);
  });
});
