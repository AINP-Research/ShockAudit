import { describe, expect, it } from "vitest";

import { applyReviewedScreen02AuditDiscovery } from "../../src/core/screen02-audit-discovery";
import {
  applyScreen02AuditAssessmentDraftReceipt,
  applyScreen02AuditDossierDraftReceipt,
  buildScreen02AuditAssessmentPacket,
  buildScreen02AuditDossierPacket,
  confirmScreen02AuditIdentity,
  createScreen02AuditAssessmentDraftReceipt,
  createScreen02AuditDossierDraftReceipt,
  markScreen02AuditRequestDelivered,
  prepareScreen02AuditDossierJob,
} from "../../src/core/screen02-audit-workflow";
import {
  continueScreen02Audit,
  createScreen02AuditState,
  prepareScreen02AssessmentRequest,
  screen02AuditContinuationGate,
} from "../../src/core/screen02-workflow-state";
import type { Screen02AuditState } from "../../src/core/screen02-workflow-types";
import {
  buildAuditIdentityState,
  confirmedWorkflowAuditContext,
  fixtureAt,
} from "../core/screen02-workflow-fixtures";

function stage4AssessmentDraft(sourceId: string) {
  return {
    studyFit: {
      category: "strong",
      explanation:
        "The named privacy statute and study population form a plausible early fit, subject to historical coverage verification.",
      evidenceSourceIds: [sourceId],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy duties may alter compliance costs and access to data used for innovation.",
      evidenceSourceIds: [sourceId],
    },
    coverageRelation: {
      category: "mixed",
      explanation:
        "The U.S. public-firm study population is broader than the statute's historically covered businesses.",
      evidenceSourceIds: [sourceId],
    },
    measurementPotential: {
      category: "difficult",
      explanation:
        "Historical California activity and statutory threshold variables may be incomplete.",
      evidenceSourceIds: [sourceId],
    },
    mainConcern:
      "The original statute, implementing clocks, later amendment, and enforcement could be collapsed incorrectly.",
    nextChecks: [
      "Verify the focal statutory version and event clock.",
      "Verify historical firm-level coverage before defining exposure.",
    ],
  };
}

describe("Stage 4 Audit core vertical slice", () => {
  it("assesses only the exact confirmed CCPA snapshot and opens continuation deterministically", () => {
    let state = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
      mode: "audit-confirmed-event",
      identitySnapshotId: "ccpa-identity-snapshot-v1",
      jobId: "stage4-assessment-job",
      requestId: "stage4-assessment-request",
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
    }) as Screen02AuditState;
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "stage4-assessment-request",
      delivered: true,
      at: "2026-08-09T18:10:10.000Z",
    });
    const packet = buildScreen02AuditAssessmentPacket(
      state,
      "stage4-assessment-request",
    );

    expect(packet.dossier.dossierFingerprint).toBe(
      state.confirmedIdentity?.dossierFingerprint,
    );
    expect(packet.confirmation.confirmationSnapshotId).toBe(
      state.confirmedIdentity?.confirmationSnapshotId,
    );
    expect(packet.outcomeValuesInspected).toBe(false);

    const receipt = createScreen02AuditAssessmentDraftReceipt({
      receiptId: "stage4-assessment-receipt",
      receivedAt: "2026-08-09T18:10:11.000Z",
      submissions: [
        {
          requestId: packet.requestId,
          requestProof: packet.requestProof,
          draft: stage4AssessmentDraft("ccpa-official"),
        },
      ],
    });
    const applied = applyScreen02AuditAssessmentDraftReceipt(state, receipt);
    state = applied.state;

    expect(applied.results).toEqual([
      expect.objectContaining({
        requestId: "stage4-assessment-request",
        status: "completed",
      }),
    ]);
    expect(state.assessments[0]).toMatchObject({
      status: "completed",
      overallJudgment: "worth-exploring",
      overallJudgmentMethod: "fixed-computation",
    });
    expect(screen02AuditContinuationGate(state)).toEqual({
      eligible: true,
      reasons: [],
    });

    const continued = continueScreen02Audit(
      state,
      "stage4-continuation",
      "2026-08-09T18:10:12.000Z",
      "Researcher continued only after exact identity and assessment completion.",
    );
    expect(continued.continuationHistory).toEqual([
      expect.objectContaining({
        confirmationSnapshotId:
          continued.confirmedIdentity?.confirmationSnapshotId,
        dossierSnapshotId: continued.confirmedIdentity?.dossierSnapshotId,
        assessmentId: "stage4-assessment-request:assessment",
      }),
    ]);
    expect("candidateSets" in continued).toBe(false);
    expect("criteria" in continued).toBe(false);
    expect("screen03" in continued).toBe(false);
    expect(() =>
      markScreen02AuditRequestDelivered(continued, {
        requestId: "stage4-assessment-request",
        delivered: true,
        at: "2026-08-09T18:10:13.000Z",
      }),
    ).toThrow(/sealed/);
  });

  it("runs the complete fresh CCPA discovery-to-continuation chain through atomic receipts", () => {
    let state = createScreen02AuditState(
      confirmedWorkflowAuditContext(),
      "stage4-fresh-e2e-run",
      fixtureAt,
    );
    state = applyReviewedScreen02AuditDiscovery(state, {
      matchSetSnapshotId: "stage4-fresh-match-set",
      at: "2026-08-09T18:00:01.000Z",
    });
    const match = state.possibleMatches.find(
      (item) => item.relationship === "supported-alias",
    )!;
    const sourceId = match.sourceIds[0]!;

    state = prepareScreen02AuditDossierJob(state, {
      matchSnapshotId: match.matchSnapshotId,
      jobId: "stage4-fresh-dossier-job",
      requestId: "stage4-fresh-dossier-request",
      at: "2026-08-09T18:00:02.000Z",
    });
    state = markScreen02AuditRequestDelivered(state, {
      requestId: "stage4-fresh-dossier-request",
      delivered: true,
      at: "2026-08-09T18:00:03.000Z",
    });
    const dossierPacket = buildScreen02AuditDossierPacket(
      state,
      "stage4-fresh-dossier-request",
    );
    expect(dossierPacket).not.toHaveProperty("study");
    expect(JSON.stringify(dossierPacket)).not.toContain(
      "U.S. publicly listed technology firms",
    );
    expect(JSON.stringify(dossierPacket)).not.toContain("Innovation");
    const dossierApplied = applyScreen02AuditDossierDraftReceipt(
      state,
      createScreen02AuditDossierDraftReceipt({
        receiptId: "stage4-fresh-dossier-receipt",
        receivedAt: "2026-08-09T18:00:04.000Z",
        submissions: [
          {
            requestId: dossierPacket.requestId,
            requestProof: dossierPacket.requestProof,
            draft: {
              atAGlance: [
                {
                  text: "The reviewed identity is the California Consumer Privacy Act of 2018, commonly called CCPA.",
                  sourceIds: [sourceId],
                  uncertainty: null,
                },
              ],
              whatHappened: {
                text: "California enacted a consumer-privacy statute creating rights and duties for covered businesses.",
                sourceIds: [sourceId],
                uncertainty:
                  "Historical firm coverage and the focal empirical clock remain unverified.",
              },
              whatChanged: [],
              timeline: [],
              broadCoverage: [],
              keyComponents: [],
              relatedVersions: [],
              unresolvedFacts: [
                "Evidence gap — whatChanged: The match-specific source does not establish a bounded change summary.",
                "Evidence gap — timeline: The match-specific source does not establish a complete event timeline.",
                "Evidence gap — broadCoverage: The match-specific source does not establish historical organization-level coverage.",
                "Evidence gap — keyComponents: The match-specific source does not establish a bounded component inventory.",
                "Evidence gap — relatedVersions: The match-specific source does not establish related version identities.",
                "Historical organization-level coverage is unknown.",
                "The appropriate enactment, operative, implementation, or enforcement clock is unresolved.",
              ],
            },
          },
        ],
      }),
    );
    expect(dossierApplied.results[0].status).toBe("completed");
    state = dossierApplied.state;

    state = confirmScreen02AuditIdentity(state, {
      matchSnapshotId: match.matchSnapshotId,
      dossierSnapshotId: state.dossiers[0]!.dossierSnapshotId,
      decisionId: "stage4-fresh-confirm-decision",
      confirmationSnapshotId: "stage4-fresh-confirmation",
      assessmentJobId: "stage4-fresh-assessment-job",
      assessmentRequestId: "stage4-fresh-assessment-request",
      at: "2026-08-09T18:00:05.000Z",
      reason: "Researcher confirmed the reviewed original CCPA identity.",
    });
    expect(state.assessments).toEqual([]);
    expect(state.assessmentRequests.at(-1)?.target.mode).toBe(
      "audit-confirmed-event",
    );

    state = markScreen02AuditRequestDelivered(state, {
      requestId: "stage4-fresh-assessment-request",
      delivered: true,
      at: "2026-08-09T18:00:06.000Z",
    });
    const assessmentPacket = buildScreen02AuditAssessmentPacket(
      state,
      "stage4-fresh-assessment-request",
    );
    expect(assessmentPacket.study).toMatchObject({
      population: "U.S. publicly listed technology firms",
      outcomeFamily: "Innovation",
    });
    const assessmentApplied = applyScreen02AuditAssessmentDraftReceipt(
      state,
      createScreen02AuditAssessmentDraftReceipt({
        receiptId: "stage4-fresh-assessment-receipt",
        receivedAt: "2026-08-09T18:00:07.000Z",
        submissions: [
          {
            requestId: assessmentPacket.requestId,
            requestProof: assessmentPacket.requestProof,
            draft: stage4AssessmentDraft(sourceId),
          },
        ],
      }),
    );
    expect(assessmentApplied.results[0].status).toBe("completed");
    expect(screen02AuditContinuationGate(assessmentApplied.state).eligible).toBe(
      true,
    );

    const continued = continueScreen02Audit(
      assessmentApplied.state,
      "stage4-fresh-continuation",
      "2026-08-09T18:00:08.000Z",
      "Continue only after the fresh exact confirmation and deterministic assessment.",
    );
    expect(continued.continuationHistory).toHaveLength(1);
    expect(continued.outcomeValuesInspected).toBe(false);
    expect("candidateSets" in continued).toBe(false);
  });
});
