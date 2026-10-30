import { describe, expect, it } from "vitest";

import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  STAGE1_GDPR_PACKET,
  createStage1ProofOpenResult,
  createStage1ProofRequest,
  evaluateStage1AssessmentDraft,
  isStage1AssessmentResult,
  isStage1ProofOpenResult,
  serializeStage1Canonical,
  stage1Fingerprint,
  type Stage1AssessmentDraftInput,
} from "../../src/core/stage1-assessment-proof";

const preparedAt = "2026-08-09T16:00:00.000Z";
const observedAt = "2026-08-09T16:00:05.000Z";
const requestId = "stage1-proof-00000000-0000-4000-8000-000000000001";

function goldInput(): Stage1AssessmentDraftInput {
  const request = createStage1ProofRequest(preparedAt, requestId);
  return {
    schemaVersion: STAGE1_DRAFT_SCHEMA_VERSION,
    requestId: request.requestId,
    candidateId: request.candidateId,
    candidateSnapshotId: request.candidateSnapshotId,
    candidateFingerprint: request.candidateFingerprint,
    requestProof: request.requestProof,
    draft: {
      studyFit: {
        category: "strong",
        explanation:
          "The stated application date falls within 2016–2020, while the territorial-scope lead makes this foreign-issued regulation potentially relevant to U.S. firms.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      outcomePathway: {
        category: "plausible",
        explanation:
          "The GDPR territorial and data-processing obligations may redirect data and engineering resources and constrain product experimentation linked to innovation.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      measurementPotential: {
        category: "possible",
        explanation:
          "EU establishment, EU-facing services, and monitoring activities provide possible public exposure indicators, although firm-level classification remains unverified.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
          "source-eu-gdpr-celex-metadata",
        ],
      },
      mainConcern:
        "U.S. publicly listed technology firms are broader than the organizations demonstrably covered by the available GDPR territorial-scope lead.",
      nextChecks: [
        "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
        "Determine whether exposure varies sufficiently across sampled firms for a credible comparison.",
      ],
    },
  };
}

describe("Stage 1 assessment proof core", () => {
  it("freezes one stable, compact GDPR packet and request identity", () => {
    const first = createStage1ProofOpenResult(preparedAt, requestId);
    const second = createStage1ProofOpenResult(preparedAt, requestId);

    expect(first).toEqual(second);
    expect(first.packet).toEqual(STAGE1_GDPR_PACKET);
    expect(first.packet.candidateFingerprint).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/,
    );
    expect(first.request.requestProof).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/,
    );
    expect(serializeStage1Canonical(first)).not.toContain(
      "sessionState",
    );
    expect(serializeStage1Canonical(first)).not.toContain(
      "expectedRevision",
    );
  });

  it("accepts the gold draft and derives Promising to verify in fixed code", () => {
    const before = serializeStage1Canonical(STAGE1_GDPR_PACKET);
    const result = evaluateStage1AssessmentDraft(
      goldInput(),
      observedAt,
    );

    expect(result.status).toBe("completed");
    expect(result.assessment?.overallJudgment).toBe(
      "promising-to-verify",
    );
    expect(result.assessment?.overallJudgmentMethod).toBe(
      "fixed-computation",
    );
    expect(result.selectionGate.eligible).toBe(true);
    expect(result.candidateBeforeFingerprint).toBe(
      result.candidateAfterFingerprint,
    );
    expect(serializeStage1Canonical(STAGE1_GDPR_PACKET)).toBe(
      before,
    );
  });

  it("produces deterministic receipts while excluding timestamps from fingerprints", () => {
    const first = evaluateStage1AssessmentDraft(
      goldInput(),
      observedAt,
    );
    const second = evaluateStage1AssessmentDraft(
      goldInput(),
      "2026-08-09T16:00:10.000Z",
    );

    expect(first.receiptId).toBe(second.receiptId);
    expect(first.appliedResultFingerprint).toBe(
      second.appliedResultFingerprint,
    );
    expect(first.draftFingerprint).toBe(second.draftFingerprint);
  });

  it.each([
    ["candidateId", "wrong-candidate"],
    ["candidateSnapshotId", "wrong-snapshot"],
    ["candidateFingerprint", "fnv1a64:0000000000000000"],
    ["requestProof", "fnv1a64:0000000000000000"],
  ] as const)("rejects a mismatched %s", (field, value) => {
    const input = { ...goldInput(), [field]: value };
    const result = evaluateStage1AssessmentDraft(input, observedAt);

    expect(result.status).toBe("rejected");
    expect(result.selectionGate.eligible).toBe(false);
    expect(result.rejectionReasons.length).toBeGreaterThan(0);
  });

  it("rejects extra candidate facts instead of letting the model rewrite them", () => {
    const input = goldInput();
    input.draft = {
      ...(input.draft as Record<string, unknown>),
      title: "A model-rewritten title",
    };
    const result = evaluateStage1AssessmentDraft(input, observedAt);

    expect(result.status).toBe("rejected");
    expect(result.rejectionReasons.join(" ")).toMatch(
      /must contain only/i,
    );
  });

  it("rejects unattached and duplicate evidence IDs", () => {
    const input = goldInput();
    const draft = input.draft as Record<string, Record<string, unknown>>;
    draft.studyFit.evidenceSourceIds = [
      "source-not-attached",
      "source-not-attached",
    ];
    const result = evaluateStage1AssessmentDraft(input, observedAt);

    expect(result.status).toBe("rejected");
    expect(result.rejectionReasons.join(" ")).toMatch(
      /unique source IDs|not attached/i,
    );
  });

  it("derives Not enough evidence when one validated component is Unclear", () => {
    const input = goldInput();
    const draft = input.draft as Record<string, Record<string, unknown>>;
    draft.measurementPotential = {
      category: "unclear",
      explanation:
        "The current evidence packet does not establish a defensible organization-level exposure indicator for the study population.",
      evidenceSourceIds: [],
    };
    const result = evaluateStage1AssessmentDraft(input, observedAt);

    expect(result.status).toBe("completed");
    expect(result.assessment?.overallJudgment).toBe(
      "not-enough-evidence",
    );
  });

  it("uses an explicit categorical table without a hidden component score", () => {
    const mixed = goldInput();
    const mixedDraft = mixed.draft as Record<
      string,
      Record<string, unknown>
    >;
    mixedDraft.studyFit.category = "mixed";
    mixedDraft.measurementPotential.category = "difficult";
    expect(
      evaluateStage1AssessmentDraft(mixed, observedAt).assessment
        ?.overallJudgment,
    ).toBe("worth-exploring");

    const weak = goldInput();
    const weakDraft = weak.draft as Record<
      string,
      Record<string, unknown>
    >;
    weakDraft.outcomePathway.category = "unsupported";
    expect(
      evaluateStage1AssessmentDraft(weak, observedAt).assessment
        ?.overallJudgment,
    ).toBe("low-priority");
  });

  it("rejects model-supplied scores, overall labels, and outcome claims", () => {
    const extra = goldInput();
    extra.draft = {
      ...(extra.draft as Record<string, unknown>),
      overallJudgment: "promising-to-verify",
      score: 92,
    };
    expect(
      evaluateStage1AssessmentDraft(extra, observedAt).status,
    ).toBe("rejected");

    const outcomeClaim = goldInput();
    const draft = outcomeClaim.draft as Record<
      string,
      Record<string, unknown>
    >;
    draft.outcomePathway.explanation =
      "The realized outcome and statistically significant effect estimate prove causality for innovation after the GDPR application date.";
    const result = evaluateStage1AssessmentDraft(
      outcomeClaim,
      observedAt,
    );
    expect(result.status).toBe("rejected");
    expect(result.rejectionReasons.join(" ")).toMatch(
      /outcome or causal-validity claim/i,
    );
  });

  it("keeps fingerprints sensitive to factual packet changes", () => {
    const changed = {
      ...STAGE1_GDPR_PACKET,
      candidate: {
        ...STAGE1_GDPR_PACKET.candidate,
        mainDateLead: "2018-05-26",
      },
    };
    expect(stage1Fingerprint(changed)).not.toBe(
      stage1Fingerprint(STAGE1_GDPR_PACKET),
    );
  });

  it("deep-freezes the exported packet independently of the invariant basis", () => {
    expect(Object.isFrozen(STAGE1_GDPR_PACKET)).toBe(true);
    expect(Object.isFrozen(STAGE1_GDPR_PACKET.candidate)).toBe(true);
    expect(
      Object.isFrozen(STAGE1_GDPR_PACKET.candidate.limitations),
    ).toBe(true);
    expect(() => {
      (STAGE1_GDPR_PACKET.candidate as { title: string }).title =
        "Mutated title";
    }).toThrow();

    const result = evaluateStage1AssessmentDraft(
      goldInput(),
      observedAt,
    );
    expect(result.candidateBeforeFingerprint).toBe(
      result.candidateAfterFingerprint,
    );
  });

  it("strictly authenticates open and assessment receipt shapes at the UI boundary", () => {
    const opened = createStage1ProofOpenResult(preparedAt, requestId);
    const result = evaluateStage1AssessmentDraft(
      goldInput(),
      observedAt,
    );
    expect(isStage1ProofOpenResult(opened)).toBe(true);
    expect(isStage1AssessmentResult(result)).toBe(true);
    expect(
      isStage1ProofOpenResult({ ...opened, score: 99 }),
    ).toBe(false);
    expect(
      isStage1AssessmentResult({ ...result, score: 99 }),
    ).toBe(false);
    expect(
      isStage1AssessmentResult({
        ...result,
        selectionGate: {
          ...result.selectionGate,
          candidateTitle: "Injected fact",
        },
      }),
    ).toBe(false);
    const { assessment: _assessment, ...missingAssessment } = result;
    expect(isStage1AssessmentResult(missingAssessment)).toBe(false);
  });
});
