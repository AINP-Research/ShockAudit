import { describe, expect, it } from "vitest";

import {
  HOST_REASONING_META_KEY,
  HOST_REASONING_MODE_META_KEY,
  HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
  HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION,
  HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION,
  hostReasoningModeAllowsTask,
  hostReasoningModeFromMetadata,
  restoreHostReasoningCancelResult,
  restoreHostReasoningMessageRecordResult,
  restoreHostReasoningPanelRecordResult,
  restoreHostReasoningPreparedResult,
  restoreHostReasoningPrivateTaskRegistry,
  restoreHostReasoningStatusResult,
  screen02HostReviewSummary,
  type HostReasoningPreparedResult,
} from "../../src/ui/host-task/host-task-client";
import {
  mergeScreen02StudyRelevanceProfileHostAdditions,
} from "../../src/core/screen02-relevance-profile";
import { attachHostTaskTransport } from
  "../../src/core/host-task-transport";
import { buildFindFactsState } from "../core/screen02-workflow-fixtures";

function preparedFixture(): HostReasoningPreparedResult {
  return {
    schemaVersion: "shockaudit-host-task-prepared-result-v1",
    phase: "prepared",
    taskId: "host-task:one",
    taskType: "screen03-evidence-mapping",
    screen: "screen-03",
    runId: "run-one",
    candidatePoolId: null,
    selectedEventId: "event-one",
    claimGroupId: "screen03-claims:0011223344556677",
    status: "prepared",
    messageChannel: null,
    messageDeliveryStatus: null,
    createdAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-09-03T12:05:00.000Z",
    retryCount: 0,
    resultId: null,
    failureCode: null,
    failureExplanation: null,
    panelReconciliation: {
      status: "not-ready",
      lastCheckedAt: null,
      reconciledAt: null,
      failureCode: null,
      failureExplanation: null,
    },
    result: null,
    outcomeValuesInspected: false,
    visibleMessage:
      "Use the current ShockAudit Screen 3 evidence-mapping task host-task:one, then call the required submission tool exactly once.",
    privateModelContext: {
      schemaVersion: "shockaudit-host-reasoning-model-input-v1",
      task: {
        taskId: "host-task:one",
        taskType: "screen03-evidence-mapping",
        runId: "run-one",
        candidatePoolId: null,
        selectedEventId: "event-one",
        claimGroupId: "screen03-claims:0011223344556677",
        allowedSourceIds: ["source-one"],
      },
      instructions: ["Use only the supplied claims and exact passages."],
      boundedFacts: { claims: [{ claimId: "claim-one" }] },
      submission: {
        tool: "submit_screen03_evidence_mapping",
        schemaVersion: "screen03-evidence-mapping-submission-v1",
        capability: "signed-private-capability",
      },
      sourceContentIsUntrustedData: true,
      outcomeValuesInspected: false,
    },
  };
}

function removeNullObjectProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNullObjectProperties);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, removeNullObjectProperties(item)]));
  }
  return value;
}

function screen02ReviewResultFixture() {
  const profile = buildFindFactsState().relevanceProfile!;
  return {
    schemaVersion: "shockaudit-screen02-host-review-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    review: {
      schemaVersion: "screen-02-pool-host-review-v1",
      taskId: "host-task:screen02-one",
      capability: "screen-02-pool-review",
      profileAdditions: { services: ["privacy engineering"] },
      candidateReviews: [{
        candidateId: "gdpr-candidate-snapshot-v1",
        proposedClass: "adjacent",
        industryBridge:
          "Privacy engineering connects the cited processing duty to the industry.",
        profileTermsUsed: ["privacy engineering"],
        sourceIdsUsed: ["gdpr-official"],
        sourceSpansUsed: [{
          sourceId: "gdpr-official",
          text: "personal data processing",
        }],
        sampleConnection:
          "EU-facing firms may differ in their documented covered activity.",
        outcomePathway:
          "Preliminary compliance work may redirect engineering resources.",
        mainMismatchOrUncertainty:
          "Organization-level coverage remains unresolved.",
        needsFollowUpRetrieval: true,
        rankingAdjustment: 2,
      }],
      followUpQueries: ["official gdpr implementation source"],
      officialSourceLeads: [{
        url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
        title: "General Data Protection Regulation",
        issuingBody: "European Parliament and Council",
        jurisdiction: "European Union",
        reasonForRetrieval: "Retrieve the official text.",
        candidateIdIfKnown: "gdpr-candidate-snapshot-v1",
      }],
      conciseRationale: "One bounded follow-up may improve source coverage.",
      hostModel: "host_model_not_exposed",
    },
    enrichedProfile: mergeScreen02StudyRelevanceProfileHostAdditions(
      profile,
      { services: ["privacy engineering"] },
      "2026-08-09T18:10:05.000Z",
      {
        promptVersion: "screen02-host-review-prompt-v1",
        taskId: "host-task:screen02-one",
        inputFingerprint: "fnv1a64:0000000000000001",
      },
    ),
    rankings: [{
      candidateId: "gdpr-candidate-snapshot-v1",
      classification: "direct",
      eligible: true,
      baseScore: 80,
      proposedClass: "adjacent",
      eligibilityUnchanged: true,
      rankingAdjustment: 2,
      totalScore: 82,
    }],
    outcomeValuesInspected: false,
  };
}

describe("generic host-task UI contracts", () => {
  it("strictly projects bounded noncanonical Screen 2 candidate suggestions", () => {
    const result = screen02ReviewResultFixture();
    expect(screen02HostReviewSummary(result)).toEqual({
      candidateReviewCount: 1,
      candidateReviews: [{
        candidateId: "gdpr-candidate-snapshot-v1",
        proposedClass: "adjacent",
        industryBridge:
          "Privacy engineering connects the cited processing duty to the industry.",
        sampleConnection:
          "EU-facing firms may differ in their documented covered activity.",
        outcomePathway:
          "Preliminary compliance work may redirect engineering resources.",
        mainMismatchOrUncertainty:
          "Organization-level coverage remains unresolved.",
        needsFollowUpRetrieval: true,
      }],
      followUpQueries: ["official gdpr implementation source"],
      sourceLeadCount: 1,
      rationale: "One bounded follow-up may improve source coverage.",
    });

    const unknownCandidateField = structuredClone(result);
    Object.assign(unknownCandidateField.review.candidateReviews[0]!, {
      eligibility: true,
    });
    expect(screen02HostReviewSummary(unknownCandidateField)).toBeNull();

    const malformedFollowUp = structuredClone(result);
    malformedFollowUp.review.candidateReviews[0]!.needsFollowUpRetrieval =
      "yes" as unknown as boolean;
    expect(screen02HostReviewSummary(malformedFollowUp)).toBeNull();

    const untrustedLead = structuredClone(result);
    untrustedLead.review.officialSourceLeads[0]!.url =
      "http://127.0.0.1/private";
    expect(screen02HostReviewSummary(untrustedLead)).toBeNull();

    const mismatchedRanking = structuredClone(result);
    mismatchedRanking.rankings[0]!.candidateId = "different-candidate";
    expect(screen02HostReviewSummary(mismatchedRanking)).toBeNull();
  });

  it("reads scalar and rich server metadata while failing closed", () => {
    expect(hostReasoningModeFromMetadata({
      _meta: { [HOST_REASONING_MODE_META_KEY]: "full" },
    })).toBe("full");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "full",
          enabled: true,
          genuineTraceCount: 0,
          availableTaskTypes: [
            "screen02-search-review",
            "screen03-evidence-mapping",
            "screen03-overview-improvement",
            "six-screen-policy-fact-proof",
            "six-screen-mechanism-proof",
            "screen04-study-event-assessment",
          ],
        },
      },
    })).toBe("full");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "screen02-only",
          enabled: true,
          genuineTraceCount: 0,
          availableTaskTypes: ["screen02-search-review"],
        },
      },
    })).toBe("screen02-only");
    expect(hostReasoningModeAllowsTask(
      "screen02-only",
      "screen02-search-review",
    )).toBe(true);
    expect(hostReasoningModeAllowsTask(
      "screen02-only",
      "screen03-evidence-mapping",
    )).toBe(false);
    expect(hostReasoningModeAllowsTask(
      "full",
      "screen05-theoretical-planning",
    )).toBe(false);
    expect(hostReasoningModeAllowsTask(
      "full",
      "screen05-study-mechanism-comparison",
    )).toBe(false);
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "screen02-only",
          enabled: true,
          genuineTraceCount: 0,
          availableTaskTypes: ["screen03-evidence-mapping"],
        },
      },
    })).toBe("disabled");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "experimental-off",
          enabled: false,
          genuineTraceCount: 0,
          availableTaskTypes: [],
        },
      },
    })).toBe("disabled");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "full",
          enabled: false,
          availableTaskTypes: [],
        },
      },
    })).toBe("disabled");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: { mode: "full", enabled: true },
      },
    })).toBe("disabled");
    expect(hostReasoningModeFromMetadata({
      _meta: {
        [HOST_REASONING_META_KEY]: {
          mode: "full",
          enabled: true,
          genuineTraceCount: 0,
          availableTaskTypes: [
            "screen02-search-review",
            "screen03-evidence-mapping",
            "screen03-overview-improvement",
            "six-screen-policy-fact-proof",
            "six-screen-mechanism-proof",
            "screen03-overview-improvement",
          ],
        },
      },
    })).toBe("disabled");
    expect(hostReasoningModeFromMetadata(
      { [HOST_REASONING_MODE_META_KEY]: "full" },
      { [HOST_REASONING_MODE_META_KEY]: "experimental-off" },
    )).toBe("disabled");
    expect(hostReasoningModeFromMetadata({ arbitrary: { mode: "full" } }))
      .toBeNull();
  });

  it("accepts bounded task instructions and rejects capability leaks", () => {
    const prepared = preparedFixture();
    const { privateModelContext, ...publicResult } = prepared;
    const metadata = {
      schemaVersion: HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
      taskId: prepared.taskId,
      privateModelContext,
    };
    expect(restoreHostReasoningPreparedResult(publicResult, metadata))
      .toStrictEqual(prepared);
    expect(restoreHostReasoningPreparedResult({
      ...publicResult,
      visibleMessage: `Run ${privateModelContext.submission.capability}`,
    }, metadata)).toBeNull();
    expect(restoreHostReasoningPreparedResult(publicResult, {
      ...metadata,
      privateModelContext: {
        ...prepared.privateModelContext,
        task: { ...prepared.privateModelContext.task, runId: "other-run" },
      },
    })).toBeNull();
    expect(restoreHostReasoningPreparedResult(publicResult, undefined))
      .toBeNull();
    expect(restoreHostReasoningPreparedResult({
      ...publicResult,
      privateModelContext,
    }, metadata)).toBeNull();
    expect(restoreHostReasoningPreparedResult(publicResult, {
      ...metadata,
      unrecognized: true,
    })).toBeNull();
  });

  it("restores signed prepare and status receipts after null elision", () => {
    const prepared = preparedFixture();
    const { privateModelContext, ...publicResult } = prepared;
    const publicTransport = attachHostTaskTransport(
      publicResult,
      "prepared-public",
    );
    const privateTransport = attachHostTaskTransport({
      schemaVersion: HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
      taskId: prepared.taskId,
      privateModelContext,
    }, "prepared-private-context");
    expect(restoreHostReasoningPreparedResult(
      removeNullObjectProperties(publicTransport),
      removeNullObjectProperties(privateTransport),
    )).toStrictEqual(prepared);

    const publicTask = Object.fromEntries(
      Object.entries(publicResult).filter(([key]) =>
        !["schemaVersion", "phase", "visibleMessage"].includes(key)
      ),
    );
    const statusTransport = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: publicTask,
    }, "status");
    expect(restoreHostReasoningStatusResult(
      removeNullObjectProperties(statusTransport),
    )).toMatchObject({ outcome: "found", task: publicTask });

    const messageTransport = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-message-record-result-v1",
      disposition: "not-found",
      taskId: prepared.taskId,
      status: null,
      messageChannel: null,
      messageDeliveryStatus: null,
    }, "message-record");
    expect(restoreHostReasoningMessageRecordResult(
      removeNullObjectProperties(messageTransport),
    )).toMatchObject({ disposition: "not-found", status: null });

    const panelTransport = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-panel-record-result-v1",
      disposition: "not-found",
      taskId: prepared.taskId,
      status: null,
      panelStatus: null,
    }, "panel-record");
    expect(restoreHostReasoningPanelRecordResult(
      removeNullObjectProperties(panelTransport),
    )).toMatchObject({ disposition: "not-found", panelStatus: null });

    const cancelTransport = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-cancel-result-v1",
      disposition: "not-found",
      taskId: prepared.taskId,
      status: null,
    }, "cancel");
    expect(restoreHostReasoningCancelResult(
      removeNullObjectProperties(cancelTransport),
    )).toMatchObject({ disposition: "not-found", status: null });
  });

  it("rejects unknown, coerced, and inconsistent receipt fields", () => {
    const task = preparedFixture();
    const publicTask = Object.fromEntries(
      Object.entries(task).filter(([key]) =>
        !["schemaVersion", "phase", "visibleMessage", "privateModelContext"]
          .includes(key)
      ),
    );
    const boundedAuditTransport = {
      schemaVersion: "shockaudit-host-reasoning-run-audit-bundle-v1",
      type: "host-reasoning-run-audit-bundle",
      runId: "run-one",
      includedTaskCount: 0,
      truncated: false,
      tasks: [],
      outcomeValuesInspected: false,
    };
    expect(restoreHostReasoningStatusResult({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: publicTask,
      auditBundle: boundedAuditTransport,
    })?.auditBundle).toStrictEqual(boundedAuditTransport);
    expect(restoreHostReasoningStatusResult({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: publicTask,
      auditBundle: {
        ...boundedAuditTransport,
        includedTaskCount: 1,
        tasks: [{
          schemaVersion: "shockaudit-host-reasoning-task-audit-bundle-v1",
          type: "host-reasoning-task-audit-bundle",
          task: {
            coordinates: { runId: "run-one" },
            injectedProse: "x".repeat(96 * 1024),
          },
          outcomeValuesInspected: false,
        }],
      },
    })).toBeNull();
    expect(restoreHostReasoningStatusResult({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: publicTask,
      capability: "must-not-be-accepted",
    })).toBeNull();
    expect(restoreHostReasoningMessageRecordResult({
      schemaVersion: "shockaudit-host-task-message-record-result-v1",
      disposition: "updated",
      taskId: task.taskId,
      status: "message-accepted",
      messageChannel: "ui/message",
      messageDeliveryStatus: "accepted",
      capability: "must-not-be-accepted",
    })).toBeNull();
    expect(restoreHostReasoningPanelRecordResult({
      schemaVersion: "shockaudit-host-task-panel-record-result-v1",
      disposition: "updated",
      taskId: task.taskId,
      status: "applied",
      panelStatus: "reconciled",
      capability: "must-not-be-accepted",
    })).toBeNull();
    expect(restoreHostReasoningCancelResult({
      schemaVersion: "shockaudit-host-task-cancel-result-v1",
      disposition: "updated",
      taskId: task.taskId,
      status: "cancelled",
      capability: "must-not-be-accepted",
    })).toBeNull();
    expect(restoreHostReasoningMessageRecordResult({
      schemaVersion: "shockaudit-host-task-message-record-result-v1",
      disposition: ["updated"],
      taskId: task.taskId,
      status: "message-accepted",
      messageChannel: "ui/message",
      messageDeliveryStatus: "accepted",
    })).toBeNull();
    expect(restoreHostReasoningPanelRecordResult({
      schemaVersion: "shockaudit-host-task-panel-record-result-v1",
      disposition: "not-found",
      taskId: task.taskId,
      status: null,
      panelStatus: ["failed"],
    })).toBeNull();
    expect(restoreHostReasoningCancelResult({
      schemaVersion: "shockaudit-host-task-cancel-result-v1",
      disposition: "not-found",
      taskId: task.taskId,
      status: "cancelled",
    })).toBeNull();
  });

  it("restores only private non-secret task coordinates", () => {
    const restored = restoreHostReasoningPrivateTaskRegistry({
      schemaVersion: HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION,
      tasks: [{
        schemaVersion: HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION,
        taskId: "host-task:one",
        taskType: "screen03-evidence-mapping",
        screen: "screen-03",
        runId: "run-one",
        candidatePoolId: null,
        selectedEventId: "event-one",
        claimGroupId: "screen03-claims:0011223344556677",
        expectedParentRevision: 4,
        expectedScopeFingerprint: "fnv1a64:0011223344556677",
        expectedCandidatePoolFingerprint: null,
        expectedEventFingerprint: "fnv1a64:1122334455667788",
        createdAt: "2026-09-03T12:00:00.000Z",
        expiresAt: "2026-09-03T12:05:00.000Z",
        status: "awaiting-submission",
        retryCount: 0,
        resultId: null,
        capability: "must-not-survive",
        accessToken: "must-not-survive",
      }],
    });
    expect(restored.tasks).toHaveLength(1);
    expect(JSON.stringify(restored)).not.toContain("must-not-survive");
    expect(restored.tasks[0]).not.toHaveProperty("capability");
    expect(restored.tasks[0]).not.toHaveProperty("accessToken");
  });
});
