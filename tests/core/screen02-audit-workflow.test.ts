import { describe, expect, it } from "vitest";

import { applyReviewedScreen02AuditDiscovery } from "../../src/core/screen02-audit-discovery";
import {
  applyScreen02AuditAssessmentDraftReceipt,
  applyScreen02AuditConfirmedEventFixedFallback,
  applyScreen02AuditDossierDraftReceipt,
  buildScreen02AuditAssessmentPacket,
  buildScreen02AuditDossierPacket,
  confirmScreen02AuditIdentity,
  createScreen02AuditAssessmentDraftReceipt,
  createScreen02AuditDossierDraftReceipt,
  markScreen02AuditRelatedVersion,
  markScreen02AuditRequestDelivered,
  openScreen02AuditMatch,
  prepareScreen02AuditDossierJob,
  reconsiderScreen02AuditIdentity,
  recordScreen02AuditNoMatch,
  rejectScreen02AuditMatch,
  retryScreen02AuditRequest,
  reviseScreen02AuditAnchor,
} from "../../src/core/screen02-audit-workflow";
import {
  createScreen02AuditState,
  restoreScreen02AuditState,
  screen02AuditContinuationGate,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  type Screen02AuditState,
} from "../../src/core/screen02-workflow-types";
import {
  confirmedWorkflowAuditContext,
  fixtureAt,
} from "./screen02-workflow-fixtures";

function freshCcpa() {
  const opened = createScreen02AuditState(
    confirmedWorkflowAuditContext(),
    "audit-workflow-run",
    fixtureAt,
  );
  return applyReviewedScreen02AuditDiscovery(opened, {
    matchSetSnapshotId: "audit-workflow-set-1",
    at: "2026-08-09T18:00:01.000Z",
  });
}

function relationshipMatch(
  state: Screen02AuditState,
  relationship: string,
) {
  const match = state.possibleMatches.find(
    (item) => item.relationship === relationship,
  );
  if (!match) throw new Error(`Missing ${relationship} fixture match.`);
  return match;
}

function fullDossierDraft(state: Screen02AuditState) {
  const primary = relationshipMatch(state, "supported-alias");
  const statuteSource = primary.sourceIds[0]!;
  return {
    atAGlance: [
      {
        text: "The possible match is the California Consumer Privacy Act of 2018, commonly called CCPA.",
        sourceIds: [statuteSource],
        uncertainty: null,
      },
    ],
    whatHappened: {
      text: "California enacted the CCPA as a consumer-privacy statute with rights and duties for covered businesses.",
      sourceIds: [statuteSource],
      uncertainty:
        "Historical organization-level coverage and the focal empirical clock remain unverified.",
    },
    whatChanged: [],
    timeline: [],
    broadCoverage: [],
    keyComponents: [],
    relatedVersions: [],
    unresolvedFacts: [
      "Evidence gap — whatChanged: The statute-only match packet does not establish a bounded change summary.",
      "Evidence gap — timeline: The statute-only match packet does not establish a complete version-specific timeline.",
      "Evidence gap — broadCoverage: The statute-only match packet does not establish historical organization-level coverage.",
      "Evidence gap — keyComponents: The statute-only match packet does not establish a bounded component inventory.",
      "Evidence gap — relatedVersions: Related records have separate match-specific sources and are not evidence for this dossier.",
      "Historical firm-level statutory coverage is unknown.",
      "The enactment, operative, implementation, and enforcement clocks conflict as possible study anchors.",
    ],
  };
}

function completedDossierState() {
  let state = freshCcpa();
  const match = relationshipMatch(state, "supported-alias");
  state = prepareScreen02AuditDossierJob(state, {
    matchSnapshotId: match.matchSnapshotId,
    jobId: "dossier-job-1",
    requestId: "dossier-request-1",
    at: "2026-08-09T18:00:02.000Z",
  });
  state = markScreen02AuditRequestDelivered(state, {
    requestId: "dossier-request-1",
    delivered: true,
    at: "2026-08-09T18:00:03.000Z",
  });
  const packet = buildScreen02AuditDossierPacket(state, "dossier-request-1");
  const receipt = createScreen02AuditDossierDraftReceipt({
    receiptId: "dossier-receipt-1",
    receivedAt: "2026-08-09T18:00:04.000Z",
    submissions: [
      {
        requestId: packet.requestId,
        requestProof: packet.requestProof,
        draft: fullDossierDraft(state),
      },
    ],
  });
  const applied = applyScreen02AuditDossierDraftReceipt(state, receipt);
  expect(applied.results[0].status).toBe("completed");
  return applied.state;
}

function confirmedStateWithIds(
  state: Screen02AuditState,
  suffix = "1",
) {
  const match = relationshipMatch(state, "supported-alias");
  const dossier = state.dossiers.find((item) => item.status === "completed")!;
  return confirmScreen02AuditIdentity(state, {
    matchSnapshotId: match.matchSnapshotId,
    dossierSnapshotId: dossier.dossierSnapshotId,
    decisionId: `confirmation-decision-${suffix}`,
    confirmationSnapshotId: `confirmation-snapshot-${suffix}`,
    assessmentJobId: `confirmed-assessment-job-${suffix}`,
    assessmentRequestId: `confirmed-assessment-request-${suffix}`,
    at: `2026-08-09T18:00:${String(5 + Number(suffix)).padStart(2, "0")}.000Z`,
    reason: "Researcher confirmed the source-backed original CCPA identity.",
  });
}

describe("v2.1 Audit workflow core", () => {
  it("preserves authenticated AI parts when fixed fallback fills only unresolved confirmed-event parts", () => {
    let state = confirmedStateWithIds(completedDossierState());
    const requestId = state.assessmentRequests.at(-1)!.requestId;
    state = markScreen02AuditRequestDelivered(state, {
      requestId,
      delivered: true,
      at: "2026-08-09T18:00:07.000Z",
    });
    const packet = buildScreen02AuditAssessmentPacket(state, requestId);
    const sourceId = packet.sources[0]!.id;
    const aiStudyFit = {
      category: "strong" as const,
      explanation:
        `${packet.match.identity.canonicalTitle} falls inside the confirmed study period, while historical firm coverage still needs verification.`,
      evidenceSourceIds: [sourceId],
    };
    const partial = applyScreen02AuditAssessmentDraftReceipt(
      state,
      createScreen02AuditAssessmentDraftReceipt({
        receiptId: "audit-partial-source-fallback-receipt",
        receivedAt: "2026-08-09T18:00:08.000Z",
        submissions: [{
          requestId,
          requestProof: packet.requestProof,
          draft: { studyFit: aiStudyFit },
        }],
      }),
    );
    expect(partial.results[0]).toMatchObject({
      status: "partial",
      acceptedPartIds: ["studyFit"],
    });

    const completed = applyScreen02AuditConfirmedEventFixedFallback(
      partial.state,
      requestId,
      "2026-08-09T18:00:09.000Z",
    );
    const completedRequest = completed.state.assessmentRequests.find(
      (item) => item.requestId === requestId,
    )!;

    expect(completed.state.assessments).toHaveLength(1);
    expect(completed.assessment.studyFit).toEqual(aiStudyFit);
    expect(completed.assessment.outcomePathway).toMatchObject({
      category: "unclear",
    });
    expect(completed.assessment.coverageRelation).toMatchObject({
      category: "unclear",
    });
    expect(completed.assessment.measurementPotential).toMatchObject({
      category: "unclear",
    });
    expect(completedRequest).toMatchObject({
      status: "completed",
      receiptIds: ["audit-partial-source-fallback-receipt"],
      acceptedPartIds: [
        "studyFit",
        "outcomePathway",
        "coverageRelation",
        "measurementPotential",
        "mainConcern",
        "nextChecks",
      ],
    });
    expect(completedRequest.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "draft-received",
          actor: "chatgpt-host",
        }),
        expect.objectContaining({ status: "partial" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    expect(restoreScreen02AuditState(completed.state)).not.toBeNull();
  });

  it("rejects oversized dossier dates and related-version identity fields", () => {
    let state = freshCcpa();
    const match = relationshipMatch(state, "supported-alias");
    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: match.matchSnapshotId,
      jobId: "bounded-dossier-job",
      requestId: "bounded-dossier-request",
      at: "2026-08-09T18:00:02.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "bounded-dossier-request",
      delivered: true,
      at: "2026-08-09T18:00:03.000Z",
    });
    const packet = buildScreen02AuditDossierPacket(
      state,
      "bounded-dossier-request",
    );
    const sourceId = match.sourceIds[0]!;
    const draft = {
      ...fullDossierDraft(state),
      timeline: [
        {
          date: "2".repeat(201),
          label: "An otherwise bounded event date label.",
          stage: "effective",
          sourceIds: [sourceId],
          uncertainty: null,
        },
      ],
      relatedVersions: [
        {
          relationship: "related-event",
          identity: {
            ...match.identity,
            canonicalTitle: "R".repeat(501),
          },
          sourceIds: [sourceId],
          note: "An otherwise bounded possible related event identity.",
        },
      ],
    };
    const applied = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "bounded-dossier-receipt",
        receivedAt: "2026-08-09T18:00:04.000Z",
        submissions: [
          {
            requestId: packet.requestId,
            requestProof: packet.requestProof,
            draft,
          },
        ],
      }),
    );

    expect(applied.results[0]).toMatchObject({
      status: "partial",
      failures: expect.arrayContaining([
        {
          partId: "timeline",
          codes: ["1:missing-or-oversized-date"],
        },
        {
          partId: "relatedVersions",
          codes: ["1:invalid-identity"],
        },
      ]),
    });
  });

  it("opens without confirmation, rejects only one match, and makes related/no-match dispositions authoritative", () => {
    let state = freshCcpa();
    const primary = relationshipMatch(state, "supported-alias");
    const amendment = relationshipMatch(state, "amendment");
    const rule = relationshipMatch(state, "implementing-rule");

    expect(openScreen02AuditMatch(state, primary.matchSnapshotId).identityConfirmed).toBe(
      false,
    );
    expect(state.confirmedIdentity).toBeNull();

    state = rejectScreen02AuditMatch(state, {
      matchSnapshotId: rule.matchSnapshotId,
      decisionId: "reject-rule",
      at: "2026-08-09T18:00:02.000Z",
      reason: "The implementing rule is not the named original statute.",
    });
    expect(() =>
      prepareScreen02AuditDossierJob(state, {
        matchSnapshotId: rule.matchSnapshotId,
        jobId: "rejected-job",
        requestId: "rejected-request",
        at: "2026-08-09T18:00:03.000Z",
      }),
    ).toThrow(/already rejected/);
    expect(openScreen02AuditMatch(state, primary.matchSnapshotId).match).toBeTruthy();

    state = markScreen02AuditRelatedVersion(state, {
      matchSnapshotId: amendment.matchSnapshotId,
      decisionId: "related-amendment",
      at: "2026-08-09T18:00:03.000Z",
      reason: "CPRA is a related amendment, not the original identity.",
    });
    expect(() =>
      prepareScreen02AuditDossierJob(state, {
        matchSnapshotId: amendment.matchSnapshotId,
        jobId: "related-job",
        requestId: "related-request",
        at: "2026-08-09T18:00:04.000Z",
      }),
    ).toThrow(/already related-version/);

    state = recordScreen02AuditNoMatch(state, {
      decisionId: "no-match-current-set",
      at: "2026-08-09T18:00:04.000Z",
      reason: "None of the remaining records is the intended version.",
    });
    expect(() =>
      prepareScreen02AuditDossierJob(state, {
        matchSnapshotId: primary.matchSnapshotId,
        jobId: "sealed-job",
        requestId: "sealed-request",
        at: "2026-08-09T18:00:05.000Z",
      }),
    ).toThrow(/recorded no match/);
  });

  it("accepts empty dossier sections only with explicit evidence gaps and requires substantive identity facts before confirmation", () => {
    const state = completedDossierState();
    const dossier = state.dossiers[0];

    expect(dossier.status).toBe("completed");
    expect(dossier.whatChanged).toEqual([]);
    expect(dossier.timeline).toEqual([]);
    expect(dossier.broadCoverage).toEqual([]);
    expect(dossier.keyComponents).toEqual([]);
    expect(dossier.relatedVersions).toEqual([]);
    expect(dossier.unresolvedFacts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Evidence gap — whatChanged:/),
        expect.stringMatching(/^Evidence gap — timeline:/),
        expect.stringMatching(/^Evidence gap — broadCoverage:/),
        expect.stringMatching(/^Evidence gap — keyComponents:/),
        expect.stringMatching(/^Evidence gap — relatedVersions:/),
      ]),
    );

    const confirmed = confirmedStateWithIds(state);
    expect(confirmed.confirmedIdentity?.dossierFingerprint).toBe(
      dossier.dossierFingerprint,
    );
    expect(confirmed.assessments).toEqual([]);
    expect(confirmed.assessmentRequests.at(-1)?.target.mode).toBe(
      "audit-confirmed-event",
    );
  });

  it("keeps study context out of the pre-confirmation dossier packet and rejects silent empty sections", () => {
    let state = freshCcpa();
    const match = relationshipMatch(state, "supported-alias");
    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: match.matchSnapshotId,
      jobId: "gap-policy-job",
      requestId: "gap-policy-request-1",
      at: "2026-08-09T18:00:02.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "gap-policy-request-1",
      delivered: true,
      at: "2026-08-09T18:00:03.000Z",
    });
    const packet = buildScreen02AuditDossierPacket(
      state,
      "gap-policy-request-1",
    );
    expect(packet).not.toHaveProperty("study");
    expect(packet.match.sourceIds).toEqual(
      expect.arrayContaining([
        "reviewed:ccpa-statute-ab375",
        "reviewed:ccpa-initiative-circulation-17-0039",
        "reviewed:ccpa-oag-overview",
        "reviewed:ccpa-oag-implementation",
      ]),
    );
    expect(packet.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "reviewed:ccpa-statute-ab375",
        "reviewed:ccpa-initiative-circulation-17-0039",
        "reviewed:ccpa-oag-overview",
        "reviewed:ccpa-oag-implementation",
      ]),
    );
    expect(JSON.stringify(packet)).not.toContain("U.S. firms");
    expect(JSON.stringify(packet)).not.toContain("Innovation");
    expect(packet.exclusions).toContainEqual(
      expect.stringContaining("Evidence gap — <partId>:"),
    );

    const draft = {
      ...fullDossierDraft(state),
      unresolvedFacts: ["The source packet may be incomplete."],
    };
    const applied = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "gap-policy-receipt-1",
        receivedAt: "2026-08-09T18:00:04.000Z",
        submissions: [
          {
            requestId: packet.requestId,
            requestProof: packet.requestProof,
            draft,
          },
        ],
      }),
    );

    expect(applied.results[0]).toMatchObject({
      status: "partial",
      acceptedPartIds: ["atAGlance", "whatHappened"],
    });
    expect(applied.results[0].failures).toEqual(
      expect.arrayContaining([
        {
          partId: "whatChanged",
          codes: ["empty-section-needs-explicit-evidence-gap"],
        },
        expect.objectContaining({
          partId: "unresolvedFacts",
          codes: expect.arrayContaining([
            "missing-empty-section-evidence-gap:whatChanged",
            "missing-empty-section-evidence-gap:timeline",
            "missing-empty-section-evidence-gap:broadCoverage",
            "missing-empty-section-evidence-gap:keyComponents",
            "missing-empty-section-evidence-gap:relatedVersions",
          ]),
        }),
      ]),
    );
    const retried = retryScreen02AuditRequest(applied.state, {
      priorRequestId: "gap-policy-request-1",
      requestId: "gap-policy-request-2",
      at: "2026-08-09T18:00:05.000Z",
    });
    expect(retried.assessmentRequests.at(-1)?.requestedPartIds).toEqual([
      "whatChanged",
      "timeline",
      "broadCoverage",
      "keyComponents",
      "relatedVersions",
      "unresolvedFacts",
    ]);
  });

  it("freezes alternate failed dossier work on confirmation and ignores its late receipt", () => {
    let state = freshCcpa();
    const primary = relationshipMatch(state, "supported-alias");
    const amendment = relationshipMatch(state, "amendment");
    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: primary.matchSnapshotId,
      jobId: "primary-job",
      requestId: "primary-request",
      at: "2026-08-09T18:00:02.000Z",
    });
    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: amendment.matchSnapshotId,
      jobId: "alternate-job",
      requestId: "alternate-request",
      at: "2026-08-09T18:00:02.000Z",
    });
    for (const requestId of ["primary-request", "alternate-request"]) {
      state = markScreen02AuditRequestDelivered(state, {
        requestId,
        delivered: true,
        at: "2026-08-09T18:00:03.000Z",
      });
    }
    const alternatePacket = buildScreen02AuditDossierPacket(
      state,
      "alternate-request",
    );
    const invalidReceipt = createScreen02AuditDossierDraftReceipt({
      receiptId: "alternate-invalid-receipt",
      receivedAt: "2026-08-09T18:00:04.000Z",
      submissions: [
        {
          requestId: alternatePacket.requestId,
          requestProof: alternatePacket.requestProof,
          draft: {},
        },
      ],
    });
    state = applyScreen02AuditDossierDraftReceipt(state, invalidReceipt).state;
    expect(
      state.assessmentRequests.find((item) => item.requestId === "alternate-request")
        ?.status,
    ).toBe("validation-failed");

    const primaryPacket = buildScreen02AuditDossierPacket(state, "primary-request");
    state = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "primary-receipt",
        receivedAt: "2026-08-09T18:00:05.000Z",
        submissions: [
          {
            requestId: primaryPacket.requestId,
            requestProof: primaryPacket.requestProof,
            draft: fullDossierDraft(state),
          },
        ],
      }),
    ).state;
    state = confirmScreen02AuditIdentity(state, {
      matchSnapshotId: primary.matchSnapshotId,
      dossierSnapshotId: state.dossiers.at(-1)!.dossierSnapshotId,
      decisionId: "freeze-confirm-decision",
      confirmationSnapshotId: "freeze-confirm-snapshot",
      assessmentJobId: "freeze-assessment-job",
      assessmentRequestId: "freeze-assessment-request",
      at: "2026-08-09T18:00:06.000Z",
      reason: "Confirm the completed original dossier and freeze alternatives.",
    });
    expect(
      state.assessmentRequests.find((item) => item.requestId === "alternate-request")
        ?.status,
    ).toBe("superseded");
    const late = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "alternate-late-receipt",
        receivedAt: "2026-08-09T18:00:07.000Z",
        submissions: [
          {
            requestId: alternatePacket.requestId,
            requestProof: alternatePacket.requestProof,
            draft: fullDossierDraft(state),
          },
        ],
      }),
    );
    expect(late.results[0].status).toBe("ignored");
    expect(late.state.dossiers).toHaveLength(1);
  });

  it("requires explicit reversal before anchor revision and rejects reused confirmation snapshot IDs", () => {
    const completed = completedDossierState();
    const confirmed = confirmedStateWithIds(completed);
    expect(() =>
      reviseScreen02AuditAnchor(confirmed, {
        anchorRevisionId: "blocked-anchor-v2",
        successorMatchSetSnapshotId: "blocked-set-v2",
        decisionId: "blocked-revision-decision",
        fields: { clarification: "Try another version." },
        at: "2026-08-09T18:00:07.000Z",
        reason: "This must require explicit reversal first.",
      }),
    ).toThrow();

    const reconsidered = reconsiderScreen02AuditIdentity(confirmed, {
      decisionId: "reverse-confirmation-1",
      at: "2026-08-09T18:00:07.000Z",
      reason: "Researcher explicitly reopened identity review.",
    });
    expect(reconsidered.confirmedIdentity).toBeNull();
    const match = relationshipMatch(reconsidered, "supported-alias");
    expect(() =>
      confirmScreen02AuditIdentity(reconsidered, {
        matchSnapshotId: match.matchSnapshotId,
        dossierSnapshotId: reconsidered.dossiers[0].dossierSnapshotId,
        decisionId: "confirmation-decision-2",
        confirmationSnapshotId: "confirmation-snapshot-1",
        assessmentJobId: "confirmed-assessment-job-2",
        assessmentRequestId: "confirmed-assessment-request-2",
        at: "2026-08-09T18:00:08.000Z",
        reason: "A reused immutable confirmation ID must fail.",
      }),
    ).toThrow(/sufficient completed dossier/);
  });

  it("atomically accepts a partial third attempt and records retry exhaustion", () => {
    let state = freshCcpa();
    const match = relationshipMatch(state, "supported-alias");
    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: match.matchSnapshotId,
      jobId: "partial-job",
      requestId: "partial-request-1",
      at: "2026-08-09T18:00:02.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "partial-request-1",
      delivered: true,
      at: "2026-08-09T18:00:03.000Z",
    });
    const firstPacket = buildScreen02AuditDossierPacket(state, "partial-request-1");
    const firstDraft = {
      ...fullDossierDraft(state),
      timeline: "invalid",
      relatedVersions: "invalid",
    };
    let applied = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "partial-receipt-1",
        receivedAt: "2026-08-09T18:00:04.000Z",
        submissions: [
          {
            requestId: firstPacket.requestId,
            requestProof: firstPacket.requestProof,
            draft: firstDraft,
          },
        ],
      }),
    );
    expect(applied.results[0].status).toBe("partial");
    state = retryScreen02AuditRequest(applied.state, {
      priorRequestId: "partial-request-1",
      requestId: "partial-request-2",
      at: "2026-08-09T18:00:05.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "partial-request-2",
      delivered: true,
      at: "2026-08-09T18:00:06.000Z",
    });
    const secondPacket = buildScreen02AuditDossierPacket(state, "partial-request-2");
    state = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "partial-receipt-2",
        receivedAt: "2026-08-09T18:00:07.000Z",
        submissions: [
          {
            requestId: secondPacket.requestId,
            requestProof: secondPacket.requestProof,
            draft: { timeline: "invalid", relatedVersions: "invalid" },
          },
        ],
      }),
    ).state;
    state = retryScreen02AuditRequest(state, {
      priorRequestId: "partial-request-2",
      requestId: "partial-request-3",
      at: "2026-08-09T18:00:08.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "partial-request-3",
      delivered: true,
      at: "2026-08-09T18:00:09.000Z",
    });
    const thirdPacket = buildScreen02AuditDossierPacket(state, "partial-request-3");
    applied = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "partial-receipt-3",
        receivedAt: "2026-08-09T18:00:10.000Z",
        submissions: [
          {
            requestId: thirdPacket.requestId,
            requestProof: thirdPacket.requestProof,
            draft: { timeline: "invalid", relatedVersions: [] },
          },
        ],
      }),
    );

    expect(applied.results[0]).toMatchObject({
      status: "retry-exhausted",
      acceptedPartIds: ["relatedVersions"],
    });
    expect(
      applied.state.assessmentRequests.find(
        (item) => item.requestId === "partial-request-3",
      ),
    ).toMatchObject({ status: "retry-exhausted" });
    expect(applied.state.dossiers.at(-1)?.status).toBe("partial");
    expect(restoreScreen02AuditState(applied.state)).not.toBeNull();
  });

  it("derives a conservative confirmed-event assessment after host delivery is unavailable", () => {
    let state = confirmedStateWithIds(completedDossierState());
    const request = state.assessmentRequests.at(-1)!;
    state = markScreen02AuditRequestDelivered(state, {
      requestId: request.requestId,
      delivered: false,
      at: "2026-08-09T18:00:07.000Z",
    });

    const fallback = applyScreen02AuditConfirmedEventFixedFallback(
      state,
      request.requestId,
      "2026-08-09T18:00:08.000Z",
    );
    const completedRequest = fallback.state.assessmentRequests.find(
      (candidate) => candidate.requestId === request.requestId,
    );

    expect(completedRequest).toMatchObject({
      status: "completed",
      acceptedPartIds: [
        "studyFit",
        "outcomePathway",
        "coverageRelation",
        "measurementPotential",
        "mainConcern",
        "nextChecks",
      ],
    });
    expect(completedRequest?.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "delivery-rejected" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    expect(fallback.assessment).toMatchObject({
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    expect(
      [
        fallback.assessment.studyFit?.explanation,
        fallback.assessment.outcomePathway?.explanation,
        fallback.assessment.coverageRelation?.explanation,
        fallback.assessment.measurementPotential?.explanation,
        fallback.assessment.mainConcern,
        ...fallback.assessment.nextChecks,
      ].join(" "),
    ).toContain("California Consumer Privacy Act of 2018");
    expect(fallback.assessment.evidenceSourceIds.length).toBeGreaterThan(0);
    expect(screen02AuditContinuationGate(fallback.state)).toEqual({
      eligible: true,
      reasons: [],
    });
    expect(restoreScreen02AuditState(fallback.state)).not.toBeNull();
  });
});
