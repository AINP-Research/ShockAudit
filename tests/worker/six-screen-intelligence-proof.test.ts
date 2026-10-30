import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
  HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
  HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
} from "../../src/worker/host-reasoning-task-runtime";
import {
  HostReasoningTaskStore,
} from "../../src/worker/host-reasoning-task-store";
import { createHostReasoningWorkflowRuntime } from
  "../../src/worker/host-reasoning-task-workflow";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import {
  sixScreenMechanismProofFactsSchema,
  sixScreenMechanismProofResultSchema,
  sixScreenPolicyFactProofFactsSchema,
  sixScreenPolicyFactProofResultSchema,
  SIX_SCREEN_MECHANISM_PROOF_SUBMISSION_SCHEMA_VERSION,
  SIX_SCREEN_POLICY_FACT_PROOF_SUBMISSION_SCHEMA_VERSION,
} from "../../src/worker/six-screen-intelligence-proof";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { InMemoryScreen02WorkflowStore } from
  "../../src/worker/screen02-workflow-store";
import { InMemoryScreen03WorkflowStore } from
  "../../src/worker/screen03-workflow-store";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const signing = {
  keyId: "six-screen-proof-test-key",
  key: "six-screen-proof-test-key-material-more-than-thirty-two-bytes",
};

async function lockedProofTarget() {
  const fixture = createBrowserEventCardFixture();
  const storage = new InMemorySixScreenWorkflowStorage();
  const sixScreenStore = new SixScreenWorkflowStore(storage);
  const evidenceStore = new SixScreenEvidenceStore(storage);
  const researchTaskStore = new SixScreenResearchTaskStore(storage);
  await sixScreenStore.create({
    state: fixture.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("proof-fixture"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-14T12:00:00.000Z",
  });
  await evidenceStore.create({
    runId,
    accessToken,
    snapshot: fixture.evidenceSnapshot,
    collection: fixture.collection,
    expiresAt: "2026-09-14T12:00:00.000Z",
  });
  let tick = 6;
  const workflow = new SixScreenWorkflowRuntime({
    store: sixScreenStore,
    evidenceStore,
    taskStore: researchTaskStore,
    signingKey: "six-screen-proof-workflow-key-more-than-thirty-two-bytes",
    now: () => browserEventCardFixtureAt(tick++),
    fetch: async () => {
      throw new Error("Proof fixture must not fetch another source.");
    },
  });
  const authentication = { runId, accessToken };
  let revision = fixture.state.revision;
  let reviewResult = await workflow.beginPolicyEventCardReview(authentication, {
    expectedRevision: revision,
    operationId: "proof-begin-review",
  });
  revision = reviewResult.privateSnapshot.revision;
  let review = reviewResult.review;
  for (const claim of review.claimReviews) {
    reviewResult = await workflow.reviewPolicyEventCardClaim(authentication, {
      expectedRevision: revision,
      operationId: `proof-accept-${claim.claimId}`,
      reviewId: review.id,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      claimId: claim.claimId,
      decision: "accepted",
      rationale: "Accept the exact source-linked fact for bounded proof input.",
    });
    revision = reviewResult.privateSnapshot.revision;
    review = reviewResult.review;
  }
  const clock = await workflow.decidePolicyTreatmentClock(authentication, {
    expectedRevision: revision,
    operationId: "proof-no-clock",
    reviewId: review.id,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    decision: { mode: "no_selection" },
    rationale: "No legal clock establishes unit-level treatment.",
  });
  revision = clock.privateSnapshot.revision;
  review = clock.review;
  const locked = await workflow.lockPolicyEventCard(authentication, {
    expectedRevision: revision,
    operationId: "proof-lock-card",
    reviewId: review.id,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    rationale: "Lock the reviewed source packet for the proof harness.",
  });
  const lockedRead = await sixScreenStore.read({ runId, accessToken });
  if (lockedRead.outcome !== "found") {
    throw new Error("Expected a locked six-screen proof fixture.");
  }
  const taskStore = new HostReasoningTaskStore(storage, {
    enforceParentGuard: true,
  });
  let now = "2026-09-12T12:05:00.000Z";
  let id = 0;
  const host = createHostReasoningWorkflowRuntime({
    taskStore,
    screen02Store: new InMemoryScreen02WorkflowStore(),
    screen03Store: new InMemoryScreen03WorkflowStore(),
    sixScreenStore,
    signing,
    now: () => now,
    createId: (kind) => `six-proof-${kind}-${++id}`,
    discoverScreen02Find: async () => {
      throw new Error("Six-screen proof must not invoke legacy discovery.");
    },
  });
  const event = locked.privateSnapshot.state.confirmedShock!;
  const eventCard = locked.eventCard;
  return {
    host,
    taskStore,
    sixScreenStore,
    workflow,
    lockedRecord: lockedRead.record,
    event,
    eventCard,
    setNow(value: string) {
      now = value;
    },
  };
}

type ProofTarget = Awaited<ReturnType<typeof lockedProofTarget>>;

async function prepareDelivered(
  target: ProofTarget,
  taskType:
    | "six-screen-policy-fact-proof"
    | "six-screen-mechanism-proof",
  ordinal: number,
) {
  target.setNow(`2026-09-12T12:0${5 + ordinal}:00.000Z`);
  const prepared = await target.host.prepare({
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: `proof-prepare-${ordinal}`,
    taskType,
    runId,
    accessToken,
    candidatePoolId: null,
    selectedEventId: target.event.id,
    claimGroupId: null,
    expectedScopeFingerprint: target.lockedRecord.stateFingerprint,
    expectedCandidatePoolFingerprint: null,
    expectedEventFingerprint: target.eventCard.eventCardFingerprint,
    retryOfTaskId: null,
  });
  target.setNow(`2026-09-12T12:0${5 + ordinal}:01.000Z`);
  await target.host.recordMessageDelivery({
    schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
    operationId: `proof-message-${ordinal}`,
    taskId: prepared.taskId,
    runId,
    accessToken,
    channel: "ui/message",
    accepted: true,
    requestedAt: `2026-09-12T12:0${5 + ordinal}:00.500Z`,
    resolvedAt: `2026-09-12T12:0${5 + ordinal}:01.000Z`,
    failureCode: null,
    failureExplanation: null,
  });
  target.setNow(`2026-09-12T12:0${5 + ordinal}:02.000Z`);
  return prepared;
}

describe("six-screen signed-in intelligence proof readiness", () => {
  it("persists factual and mechanism proof results without changing scientific state", async () => {
    const target = await lockedProofTarget();
    const originalStateFingerprint = target.lockedRecord.stateFingerprint;

    const factual = await prepareDelivered(
      target,
      "six-screen-policy-fact-proof",
      0,
    );
    expect(factual).toMatchObject({
      screen: "screen-02",
      selectedEventId: target.event.id,
      candidatePoolId: null,
      claimGroupId: null,
      status: "prepared",
    });
    const factualFacts = sixScreenPolicyFactProofFactsSchema.parse(
      factual.privateModelContext.boundedFacts,
    );
    const factualReference = factualFacts.evidence.sourceFacts[0]!;
    const factualReceipt = await target.host.submitSixScreenPolicyFactProof({
      schemaVersion: SIX_SCREEN_POLICY_FACT_PROOF_SUBMISSION_SCHEMA_VERSION,
      taskId: factual.taskId,
      capability: factual.privateModelContext.submission.capability,
      answer:
        "Covered operators must establish a market-participation process under the reviewed rule.",
      references: [{
        claimId: factualReference.claimId,
        sourceId: factualReference.sourceId,
        passageId: factualReference.passageId,
      }],
      uncertainties: [],
      hostModel: "host_model_not_exposed",
    });
    expect(factualReceipt).toMatchObject({
      taskType: "six-screen-policy-fact-proof",
      disposition: "applied",
      status: "applied",
      outcomeValuesInspected: false,
    });
    const factualStored = await target.taskStore.read(factual.taskId);
    expect(factualStored.outcome).toBe("found");
    if (factualStored.outcome === "found") {
      const result = sixScreenPolicyFactProofResultSchema.parse(
        factualStored.record.proposal,
      );
      if (factualReference.qualification) {
        expect(result.uncertainties).toContain(
          factualReference.qualification,
        );
      }
    }

    const mechanism = await prepareDelivered(
      target,
      "six-screen-mechanism-proof",
      1,
    );
    expect(mechanism.screen).toBe("screen-05");
    const mechanismFacts = sixScreenMechanismProofFactsSchema.parse(
      mechanism.privateModelContext.boundedFacts,
    );
    const mechanismReference = mechanismFacts.evidence.sourceFacts[0]!;
    const mechanismReceipt = await target.host.submitSixScreenMechanismProof({
      schemaVersion: SIX_SCREEN_MECHANISM_PROOF_SUBMISSION_SCHEMA_VERSION,
      taskId: mechanism.taskId,
      capability: mechanism.privateModelContext.submission.capability,
      mechanismHypothesis:
        "A market-participation process could change participation among covered operators by lowering procedural uncertainty.",
      steps: [
        "Covered operators establish the reviewed market-participation process.",
        "Lower procedural uncertainty could alter market participation decisions.",
      ],
      assumptions: [
        "Operators understand and can use the new process during the study period.",
      ],
      alternativeExplanations: [
        "Concurrent market conditions could change participation independently.",
      ],
      references: [{
        claimId: mechanismReference.claimId,
        sourceId: mechanismReference.sourceId,
        passageId: mechanismReference.passageId,
      }],
      scholarlySupportStatus: "not_supplied_in_frozen_packet",
      causalStatus: "hypothesis_not_estimate",
      hostModel: "host_model_not_exposed",
    });
    expect(mechanismReceipt).toMatchObject({
      taskType: "six-screen-mechanism-proof",
      disposition: "applied",
      status: "applied",
    });

    target.setNow("2026-09-12T12:07:03.000Z");
    const status = await target.host.status({
      schemaVersion: HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
      operationId: "proof-status-audit",
      taskId: mechanism.taskId,
      runId,
      accessToken,
      acknowledgeResultId: mechanismReceipt.resultId,
      includeRunAudit: true,
    });
    expect(status.task).toMatchObject({
      status: "applied",
      panelReconciliation: { status: "reconciled" },
      result: {
        intelligenceKind: "mechanism_proposal",
        proofOnly: true,
        nonCanonical: true,
        scientificMutation: "none",
        researcherDecision: "none",
        causalStatus: "hypothesis_not_estimate",
        scholarlySupportStatus: "not_supplied_in_frozen_packet",
        outcomeValuesInspected: false,
      },
    });
    const mechanismResult = sixScreenMechanismProofResultSchema.parse(
      status.task?.result,
    );
    if (mechanismReference.qualification) {
      expect(mechanismResult.assumptions).toContain(
        `Source qualification: ${mechanismReference.qualification}`,
      );
    }
    expect(status.outcome).toBe("found");
    if (status.outcome === "found") {
      expect(status.auditBundle?.tasks.map((task) => task.proposal?.type))
        .toEqual([
          "six-screen-policy-fact-proof",
          "six-screen-mechanism-proof",
        ]);
    }
    const after = await target.sixScreenStore.read({ runId, accessToken });
    expect(after.outcome).toBe("found");
    if (after.outcome === "found") {
      expect(after.record.stateFingerprint).toBe(originalStateFingerprint);
      expect(after.record.state.policyEventCardReviews?.at(-1)?.lockedEventCard)
        .toEqual(target.eventCard);
    }
  });

  it("rejects a source reference outside the frozen packet", async () => {
    const target = await lockedProofTarget();
    const prepared = await prepareDelivered(
      target,
      "six-screen-policy-fact-proof",
      0,
    );
    const facts = sixScreenPolicyFactProofFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    );
    const reference = facts.evidence.sourceFacts[0]!;
    const receipt = await target.host.submitSixScreenPolicyFactProof({
      schemaVersion: SIX_SCREEN_POLICY_FACT_PROOF_SUBMISSION_SCHEMA_VERSION,
      taskId: prepared.taskId,
      capability: prepared.privateModelContext.submission.capability,
      answer:
        "Covered operators must establish a market-participation process under the reviewed rule.",
      references: [{
        claimId: reference.claimId,
        sourceId: "invented-source",
        passageId: reference.passageId,
      }],
      uncertainties: [],
      hostModel: "host_model_not_exposed",
    });
    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome).toBe("found");
    if (stored.outcome === "found") {
      expect(stored.record.task.failureCode).toBe("unknown-source");
      expect(stored.record.proposal).toBeNull();
    }
  });

  it("rejects an assertive mechanism statement that is not labeled hypothetical", async () => {
    const target = await lockedProofTarget();
    const prepared = await prepareDelivered(
      target,
      "six-screen-mechanism-proof",
      0,
    );
    const facts = sixScreenMechanismProofFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    );
    const reference = facts.evidence.sourceFacts[0]!;
    const receipt = await target.host.submitSixScreenMechanismProof({
      schemaVersion: SIX_SCREEN_MECHANISM_PROOF_SUBMISSION_SCHEMA_VERSION,
      taskId: prepared.taskId,
      capability: prepared.privateModelContext.submission.capability,
      mechanismHypothesis:
        "The market-participation process changes participation among covered operators by lowering procedural uncertainty.",
      steps: [
        "Covered operators establish the reviewed market-participation process.",
        "Lower procedural uncertainty changes market participation decisions.",
      ],
      assumptions: ["Operators can use the process during the study period."],
      alternativeExplanations: [],
      references: [{
        claimId: reference.claimId,
        sourceId: reference.sourceId,
        passageId: reference.passageId,
      }],
      scholarlySupportStatus: "not_supplied_in_frozen_packet",
      causalStatus: "hypothesis_not_estimate",
      hostModel: "host_model_not_exposed",
    });
    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
  });

  it("rejects a validly shaped submission after its six-screen parent changes", async () => {
    const target = await lockedProofTarget();
    const prepared = await prepareDelivered(
      target,
      "six-screen-mechanism-proof",
      0,
    );
    const facts = sixScreenMechanismProofFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    );
    const reference = facts.evidence.sourceFacts[0]!;
    const study = target.lockedRecord.state.study;
    await target.workflow.updateStudy({ runId, accessToken }, {
      expectedRevision: target.lockedRecord.state.revision,
      operationId: "proof-change-parent",
      study: {
        population: study.population,
        analysisUnit: study.analysisUnit,
        geography: study.geography,
        industry: study.industry,
        period: study.period,
        outcome: study.outcome,
        intendedConstruct: study.intendedConstruct,
        initialExplanation:
          "A revised, researcher-owned explanation changes the frozen proof parent.",
        proposedTreatment: study.proposedTreatment,
        proposedComparison: study.proposedComparison,
        resultsPreviouslyInspected: study.resultsPreviouslyInspected,
      },
    });

    const receipt = await target.host.submitSixScreenMechanismProof({
      schemaVersion: SIX_SCREEN_MECHANISM_PROOF_SUBMISSION_SCHEMA_VERSION,
      taskId: prepared.taskId,
      capability: prepared.privateModelContext.submission.capability,
      mechanismHypothesis:
        "A market-participation process could change participation among covered operators by lowering procedural uncertainty.",
      steps: [
        "Covered operators establish the reviewed market-participation process.",
        "Lower procedural uncertainty could alter market participation decisions.",
      ],
      assumptions: ["Operators can use the process during the study period."],
      alternativeExplanations: [],
      references: [{
        claimId: reference.claimId,
        sourceId: reference.sourceId,
        passageId: reference.passageId,
      }],
      scholarlySupportStatus: "not_supplied_in_frozen_packet",
      causalStatus: "hypothesis_not_estimate",
      hostModel: "host_model_not_exposed",
    });

    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome).toBe("found");
    if (stored.outcome === "found") {
      expect(stored.record.task.failureCode).toBe(
        "six-screen-proof-validation-failed",
      );
    }
  });
});
