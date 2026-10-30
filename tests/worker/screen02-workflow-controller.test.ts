import { describe, expect, it } from "vitest";

import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import {
  SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS,
  decodeScreen02WorkflowClientEnvelope,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  fingerprintScreen02WorkflowState,
  prepareScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import { buildReviewedScreen02FindDiscovery } from "../../src/core/screen02-find-discovery";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
  createScreen02FindAssessmentCapability,
  createSignedScreen02FindNormalizedReceipt,
} from "../../src/worker/screen02-find-assessment-security";
import {
  buildScreen01StudyContext,
} from "../../src/core/study-context";
import { decisionKeys } from "../../src/core/scope-types";
import {
  SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  type Screen02WorkflowState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
  applyCanonicalScreen02FindReceipt,
  applyScreen02WorkflowAction,
  buildScreen02WorkflowAssessmentBatch,
  buildScreen02WorkflowClientSnapshot,
  buildScreen02WorkflowSummary,
  createInitialScreen02WorkflowState,
  type Screen02WorkflowAction,
  type Screen02WorkflowActionName,
  type Screen02WorkflowControllerOptions,
  type Screen02WorkflowSigningConfig,
} from "../../src/worker/screen02-workflow-controller";
import {
  buildAuditIdentityState,
  buildReadyFindState,
  buildSourceQualifiedFindDiscoveryFixture,
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";

const openedAt = "2026-08-10T15:00:00.000Z";
const validSigningConfig: Screen02WorkflowSigningConfig = {
  keyId: "stage5-controller-test-key",
  key: "stage5-controller-signing-key-with-at-least-32-bytes",
};

function controllerHarness(
  signingConfig: Screen02WorkflowSigningConfig | null = validSigningConfig,
  legacyHostAssessments?: boolean,
) {
  let now = openedAt;
  const counters = new Map<string, number>();
  const generatedIds = new Set<string>();
  const options: Screen02WorkflowControllerOptions = {
    now: () => now,
    createId: (kind) => {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      const id = `${kind}-${next}`;
      generatedIds.add(id);
      return id;
    },
    signingConfig,
    discoverFind: async (state, input) =>
      buildSourceQualifiedFindDiscoveryFixture(state, input),
    ...(legacyHostAssessments !== undefined
      ? { legacyHostAssessments }
      : {}),
  };
  return {
    options,
    generatedIds,
    setNow(value: string) {
      now = value;
    },
  };
}

let operationOrdinal = 0;

function workflowAction(
  state: Screen02WorkflowState,
  action: Screen02WorkflowActionName,
  payload: Record<string, unknown> = {},
  overrides: Partial<Screen02WorkflowAction> = {},
): Screen02WorkflowAction {
  operationOrdinal += 1;
  return {
    schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
    operationId: `controller-operation-${operationOrdinal}`,
    runId: state.runId,
    accessToken: "private-controller-test-access-token",
    expectedRevision: state.revision,
    expectedStateFingerprint: fingerprintScreen02WorkflowState(state),
    action,
    payload,
    ...overrides,
  };
}

function gdprAuditContext() {
  const sentence =
    "Audit whether GDPR affected innovation among U.S. firms from 2015 to 2023.";
  const result = confirmScopeContract({
    ...createInitialState("audit"),
    revision: 9,
    sentence,
    contractSourceSentence: sentence,
    knownShock: "GDPR",
    scope: {
      population: "U.S. firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "All industries",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

async function searchedFindState(
  harness = controllerHarness(),
  runId = "controller-find-search",
  criteria: Array<{
    kind: "only-include";
    text: string;
  }> = [
    {
      kind: "only-include",
      text: "Candidate has a binding public source record",
    },
  ],
  relevanceProfileEdit?: Record<string, unknown>,
) {
  const opened = createInitialScreen02WorkflowState(
    confirmedWorkflowFindContext(),
    runId,
    openedAt,
    harness.options,
  );
  if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
  let searchable: Screen02WorkflowState = opened;
  if (relevanceProfileEdit) {
    harness.setNow("2026-08-10T15:00:30.000Z");
    searchable = (
      await applyScreen02WorkflowAction(
        searchable,
        workflowAction(searchable, "find-update-relevance-profile", {
          edit: relevanceProfileEdit,
        }),
        harness.options,
      )
    ).state;
  }
  harness.setNow("2026-08-10T15:01:00.000Z");
  const result = await applyScreen02WorkflowAction(
    searchable,
    workflowAction(searchable, "find-search", {
      criteria,
    }),
    harness.options,
  );
  if (result.state.mode !== "find") throw new Error("Expected a Find result.");
  const planner = result.state.assessmentRequests.find(
    (request) => request.target.mode === "find-discovery-plan",
  );
  if (!planner) return { harness, opened, result, state: result.state };
  harness.setNow("2026-08-10T15:01:01.000Z");
  const fallback = await applyScreen02WorkflowAction(
    result.state,
    workflowAction(result.state, "assessment-delivery", {
      requestIds: [planner.requestId],
      delivered: false,
    }),
    harness.options,
  );
  if (fallback.state.mode !== "find") {
    throw new Error("Expected a Find fallback result.");
  }
  return { harness, opened, result: fallback, state: fallback.state };
}

describe("Screen 2 workflow controller", () => {
  it("persists a Find search and advances it without revising public state until completion", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    let continuationCount = 0;
    const observedInputs: Array<{
      discoveryRequestId: string;
      operationId: string;
      accessToken: string;
    }> = [];
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      continueFind: async (state, input) => {
        continuationCount += 1;
        observedInputs.push({
          discoveryRequestId: input.discoveryRequestId,
          operationId: input.operationId,
          accessToken: input.accessToken,
        });
        if (continuationCount === 1) {
          return {
            status: "pending",
            message: "One bounded retrieval step completed; more work remains.",
          };
        }
        const discovery = buildSourceQualifiedFindDiscoveryFixture(
          state,
          input,
        );
        const capacity = input.preflightCompletion(discovery);
        expect(capacity.canonicalBytes).toBeGreaterThan(0);
        expect(capacity.compressedBytes).toBeGreaterThan(0);
        return {
          status: "complete",
          discovery,
        };
      },
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-continuation",
      openedAt,
      options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");

    harness.setNow("2026-08-10T15:00:30.000Z");
    const started = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    if (started.state.mode !== "find") throw new Error("Expected Find state.");
    const activeDiscovery = started.state.discoveryRequests.at(-1);

    expect(activeDiscovery).toMatchObject({ status: "searching" });
    expect(started.state.revision).toBeGreaterThan(opened.revision);
    expect(started.state.candidates).toEqual([]);
    expect(started.state.candidateSets).toEqual([]);
    expect(started.state.activeCandidateSetSnapshotId).toBeNull();
    expect(continuationCount).toBe(0);

    harness.setNow("2026-08-10T15:00:31.000Z");
    const pending = await applyScreen02WorkflowAction(
      started.state,
      workflowAction(started.state, "find-search-continue"),
      options,
    );
    if (pending.state.mode !== "find") throw new Error("Expected Find state.");

    expect(pending.state).toEqual(started.state);
    expect(pending.state.revision).toBe(started.state.revision);
    expect(pending.state.discoveryRequests.at(-1)?.status).toBe("searching");
    expect(pending.state.candidates).toEqual([]);
    expect(pending.message).toMatch(/more work remains/i);

    harness.setNow("2026-08-10T15:00:32.000Z");
    const completed = await applyScreen02WorkflowAction(
      pending.state,
      workflowAction(pending.state, "find-search-continue"),
      options,
    );
    if (completed.state.mode !== "find") throw new Error("Expected Find state.");
    const completedSet = completed.state.candidateSets.at(-1);

    expect(continuationCount).toBe(2);
    expect(observedInputs).toEqual([
      expect.objectContaining({
        discoveryRequestId: activeDiscovery?.discoveryRequestId,
        accessToken: "private-controller-test-access-token",
      }),
      expect.objectContaining({
        discoveryRequestId: activeDiscovery?.discoveryRequestId,
        accessToken: "private-controller-test-access-token",
      }),
    ]);
    expect(observedInputs[0]?.operationId).not.toBe(
      observedInputs[1]?.operationId,
    );
    expect(completed.state.revision).toBeGreaterThan(pending.state.revision);
    expect(completed.state.discoveryRequests.at(-1)?.status).toBe("completed");
    expect(completed.state.candidates.length).toBeGreaterThan(0);
    expect(completedSet).toMatchObject({
      candidateSetSnapshotId: activeDiscovery?.candidateSetSnapshotId,
      searchRoundId: activeDiscovery?.searchRoundId,
      status: "active",
    });
    expect(completedSet?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining("fixed-query-plan-fallback"),
        }),
      ]),
    );
    expect(completed.message).toMatch(/bounded authenticated continuations/i);
  });

  it("keeps a retryable execution failure on the same public discovery", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    let calls = 0;
    const discoveryIds: string[] = [];
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      continueFind: async (state, input) => {
        calls += 1;
        discoveryIds.push(input.discoveryRequestId);
        if (calls === 1) {
          return {
            status: "failed",
            failureCodes: [
              "continuation-failure-source-unavailability",
              "continuation-stage-source-retrieval",
            ],
            message:
              "The source operation failed safely; one continuation-preserving retry remains.",
            retryable: true,
          };
        }
        return {
          status: "complete",
          discovery: buildSourceQualifiedFindDiscoveryFixture(state, input),
        };
      },
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-execution-retry",
      openedAt,
      options,
    );
    harness.setNow("2026-08-10T15:00:30.000Z");
    const started = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    harness.setNow("2026-08-10T15:00:31.000Z");
    const retryable = await applyScreen02WorkflowAction(
      started.state,
      workflowAction(started.state, "find-search-continue"),
      options,
    );
    if (retryable.state.mode !== "find") throw new Error("Expected Find state.");
    expect(retryable.state).toEqual(started.state);
    expect(retryable.state.discoveryRequests.at(-1)).toMatchObject({
      status: "searching",
      failureCodes: [],
    });
    expect(retryable.message).toMatch(/continuation-preserving retry/i);

    harness.setNow("2026-08-10T15:00:32.000Z");
    const completed = await applyScreen02WorkflowAction(
      retryable.state,
      workflowAction(retryable.state, "find-search-continue"),
      options,
    );
    if (completed.state.mode !== "find") throw new Error("Expected Find state.");
    expect(completed.state.discoveryRequests.at(-1)?.status).toBe("completed");
    expect(new Set(discoveryIds).size).toBe(1);
    expect(calls).toBe(2);
  });

  it("projects a terminal execution failure class into canonical state", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      continueFind: async () => ({
        status: "failed",
        failureCodes: [
          "continuation-failure-parser-identity-rejection",
          "continuation-stage-source-retrieval",
        ],
        message: "The official response failed its document identity check.",
        retryable: false,
      }),
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-terminal-class",
      openedAt,
      options,
    );
    harness.setNow("2026-08-10T15:00:30.000Z");
    const started = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    harness.setNow("2026-08-10T15:00:31.000Z");
    const failed = await applyScreen02WorkflowAction(
      started.state,
      workflowAction(started.state, "find-search-continue"),
      options,
    );
    if (failed.state.mode !== "find") throw new Error("Expected Find state.");
    expect(failed.state.discoveryRequests.at(-1)).toMatchObject({
      status: "failed",
      failureCodes: [
        "continuation-failure-parser-identity-rejection",
        "continuation-stage-source-retrieval",
      ],
    });
  });

  it("rejects every competing Find mutation while source discovery is active", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      continueFind: async () => ({
        status: "pending",
        message: "The bounded source search remains active.",
      }),
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-continuation-serialization",
      openedAt,
      options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
    harness.setNow("2026-08-10T15:00:30.000Z");
    const started = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    if (started.state.mode !== "find") throw new Error("Expected Find state.");

    const competingActions: Array<{
      action: Screen02WorkflowActionName;
      payload?: Record<string, unknown>;
    }> = [
      { action: "find-search", payload: { criteria: [] } },
      { action: "find-update-relevance-profile", payload: { edit: {} } },
      { action: "find-open" },
      { action: "find-remove" },
      { action: "find-retry" },
      { action: "find-override" },
      { action: "find-select" },
      { action: "find-clear-selection" },
      { action: "find-continue" },
      { action: "find-continue-without-assessment" },
    ];

    for (const { action, payload = {} } of competingActions) {
      await expect(
        applyScreen02WorkflowAction(
          started.state,
          workflowAction(started.state, action, payload),
          options,
        ),
      ).rejects.toThrow(/active source search must finish or be retired/i);
    }

    const refreshed = await applyScreen02WorkflowAction(
      started.state,
      workflowAction(started.state, "refresh"),
      options,
    );
    expect(refreshed.state).toEqual(started.state);
  });

  it("runs current Find deterministically without legacy planning or candidate turns", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-current-find",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
    harness.setNow("2026-08-10T15:00:30.000Z");

    const searched = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      harness.options,
    );
    if (searched.state.mode !== "find") throw new Error("Expected Find state.");
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      searched.state,
      "private-current-find-access-token",
      harness.options,
    );

    expect(searched.state.candidates.length).toBeGreaterThan(0);
    expect(searched.state.assessmentRequests).toEqual([]);
    expect(searched.state.candidateSets[0]?.manifest.queryMatrix[0]).toMatchObject({
      id: expect.stringContaining("fixed-query-plan-fallback"),
    });
    expect(searched.message).toMatch(/completed immediately/i);
    expect(snapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });

    const candidate = searched.state.candidates.find(
      (item) => item.qualification?.eligible === true,
    );
    if (!candidate?.qualification) {
      throw new Error("Expected one fixed-qualified deterministic candidate.");
    }
    harness.setNow("2026-08-10T15:00:31.000Z");
    const selected = await applyScreen02WorkflowAction(
      searched.state,
      workflowAction(searched.state, "find-select", {
        candidateSnapshotId: candidate.candidateSnapshotId,
      }),
      harness.options,
    );
    harness.setNow("2026-08-10T15:00:32.000Z");
    const continued = await applyScreen02WorkflowAction(
      selected.state,
      workflowAction(selected.state, "find-continue"),
      harness.options,
    );
    const continuedSnapshot = await buildScreen02WorkflowClientSnapshot(
      continued.state,
      "private-current-find-continuation-access-token",
      harness.options,
    );
    expect(continued.state.assessmentRequests).toEqual([]);
    expect(continued.state.assessments).toEqual([]);
    expect(continuedSnapshot.handoff).toMatchObject({
      schemaVersion: "screen-02-to-screen-03-event-v4",
      mode: "find",
      event: {
        preliminaryQualification: {
          sourceFingerprint: candidate.qualification.sourceFingerprint,
          eligible: true,
        },
      },
      preliminaryAssessment: {
        requestId: `fixed-qualification:no-legacy-request:${candidate.qualification.sourceFingerprint}`,
        judgment: "not-enough-evidence",
        judgmentMethod: "fixed-computation",
        completionOrigin: "fixed-fallback",
        studyFit: { category: "unclear", evidenceSourceIds: [] },
        outcomePathway: { category: "unclear", evidenceSourceIds: [] },
        measurementPotential: { category: "unclear", evidenceSourceIds: [] },
        coverageRelation: null,
        evidenceSourceIds: [],
      },
    });
    const handoffAssessment = continuedSnapshot.handoff?.preliminaryAssessment;
    expect(handoffAssessment && "requestId" in handoffAssessment).toBe(true);
    expect(
      continued.state.assessmentRequests.some(
        (request) =>
          handoffAssessment &&
          "requestId" in handoffAssessment &&
          request.requestId === handoffAssessment.requestId,
      ),
    ).toBe(false);
  });

  it("keeps cold-start reviewed candidates and adds a different qualified candidate on a second deterministic search", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    let discoveryRound = 0;
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      discoverFind: async (state, input) => {
        discoveryRound += 1;
        return discoveryRound === 1
          ? buildReviewedScreen02FindDiscovery(state, input)
          : buildSourceQualifiedFindDiscoveryFixture(state, input);
      },
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-current-find-empty-recovery",
      openedAt,
      options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
    harness.setNow("2026-08-10T15:00:30.000Z");

    const first = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    if (first.state.mode !== "find") throw new Error("Expected Find state.");

    expect(first.state.discoveryRequests.at(-1)?.status).toBe("completed");
    expect(first.state.activeCandidateSetSnapshotId).not.toBeNull();
    expect(first.state.candidateSets.at(-1)?.candidateSnapshotIds.length)
      .toBeGreaterThan(0);
    expect(first.state.assessmentRequests).toEqual([]);
    expect(first.state.candidateSets.at(-1)?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining("fixed-query-plan-fallback"),
        }),
      ]),
    );

    harness.setNow("2026-08-10T15:01:00.000Z");
    const recovered = await applyScreen02WorkflowAction(
      first.state,
      workflowAction(first.state, "find-search", { criteria: [] }),
      options,
    );
    if (recovered.state.mode !== "find") {
      throw new Error("Expected recovered Find state.");
    }

    expect(discoveryRound).toBe(2);
    expect(recovered.state.discoveryRequests.at(-1)?.status).toBe("completed");
    expect(
      recovered.state.candidates.some(
        (candidate) => candidate.qualification?.eligible === true,
      ),
    ).toBe(true);
    expect(recovered.state.assessmentRequests).toEqual([]);
    expect(recovered.state.candidateSets.at(-1)?.manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining("fixed-query-plan-fallback"),
        }),
      ]),
    );
  });

  it("completes the reviewed-registry path while recording reduced coverage when configured discovery fails", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    harness.options.discoverFind = async () => {
      throw new Error("SensitiveVendor transport details must not reach the manifest.");
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-discovery-failure",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
    harness.setNow("2026-08-10T15:00:30.000Z");

    const searched = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      harness.options,
    );
    if (searched.state.mode !== "find") throw new Error("Expected Find state.");
    const manifest = searched.state.candidateSets[0]?.manifest;
    if (!manifest) throw new Error("Expected a completed candidate-set manifest.");

    expect(searched.state.discoveryRequests[0]?.status).toBe("completed");
    expect(searched.state.candidateSets).toHaveLength(1);
    expect(searched.state.candidateSets[0]?.candidateSnapshotIds.length)
      .toBeGreaterThan(0);
    expect(manifest.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "configured-source-discovery",
          status: "failed",
          note: expect.stringMatching(/reduced coverage/i),
        }),
        expect.objectContaining({
          channel: "bounded-reviewed-event-registry",
          status: "searched",
        }),
      ]),
    );
    expect(manifest.queryMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining("configured-discovery-failed"),
          returnedRecordIds: [],
        }),
      ]),
    );
    expect(manifest.funnel).toMatchObject({
      deeperRetrievalAttempts: 0,
      retrievalFailures: 1,
    });
    expect(manifest.stoppingRule).toMatchObject({
      status: "not-met",
      note: expect.stringMatching(/broader search target was not met/i),
    });
    expect(JSON.stringify(manifest)).not.toContain("SensitiveVendor");
    const failureChannel = manifest.channels.find(
      (channel) => channel.channel === "configured-source-discovery",
    );
    expect(failureChannel?.note).not.toMatch(/ChatGPT|host|model|MCP/iu);
  });

  it("persists a bounded researcher relevance-profile edit and stales the active comparison", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-profile-edit",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "find") throw new Error("Expected a Find fixture.");
    harness.setNow("2026-08-10T15:00:30.000Z");
    const searched = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      harness.options,
    );
    if (searched.state.mode !== "find") throw new Error("Expected Find state.");
    const baseline = structuredClone(searched.state.screen01Baseline);
    harness.setNow("2026-08-10T15:01:00.000Z");

    const updated = await applyScreen02WorkflowAction(
      searched.state,
      workflowAction(searched.state, "find-update-relevance-profile", {
        edit: {
          canonicalIndustryLabel: "enterprise technology services",
          industryAliases: ["enterprise software"],
          subsectors: ["cloud software"],
          regulatedActivities: ["software distribution"],
          contrastTerms: ["consumer hardware repair"],
          falseFriends: ["medical technology"],
        },
      }),
      harness.options,
    );
    if (updated.state.mode !== "find") throw new Error("Expected Find state.");

    expect(updated.state.screen01Baseline).toEqual(baseline);
    expect(updated.state.relevanceProfile).toMatchObject({
      originalIndustryText: baseline.scopeContract.industry,
      canonicalIndustryLabel: "enterprise technology services",
      origin: "researcher-edited",
      updatedAt: "2026-08-10T15:01:00.000Z",
    });
    expect(updated.state.activeCandidateSetSnapshotId).toBeNull();
    expect(updated.state.candidateSets.at(-1)?.status).toBe("stale-profile");
    expect(updated.message).toMatch(/run search again/i);
  });

  it("completes current Audit fixed fallbacks without a legacy host turn", async () => {
    const harness = controllerHarness(validSigningConfig, false);
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-current-audit",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "audit") throw new Error("Expected Audit state.");
    const matchSnapshotId = opened.possibleMatches[0]?.matchSnapshotId;
    if (!matchSnapshotId) throw new Error("Expected an Audit match.");
    harness.setNow("2026-08-10T15:01:00.000Z");

    const dossier = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "audit-open", { matchSnapshotId }),
      harness.options,
    );
    if (dossier.state.mode !== "audit") throw new Error("Expected Audit state.");
    expect(dossier.state.dossiers.at(-1)?.status).toBe("completed");
    expect(
      dossier.state.assessmentRequests.some((request) =>
        ["prepared", "message-delivered"].includes(request.status)
      ),
    ).toBe(false);

    harness.setNow("2026-08-10T15:01:01.000Z");
    const confirmed = await applyScreen02WorkflowAction(
      dossier.state,
      workflowAction(dossier.state, "audit-confirm", {
        matchSnapshotId,
        reason: "The researcher confirmed the exact source-linked identity.",
      }),
      harness.options,
    );
    if (confirmed.state.mode !== "audit") throw new Error("Expected Audit state.");
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      confirmed.state,
      "private-current-audit-access-token",
      harness.options,
    );
    expect(confirmed.state.assessments.at(-1)).toMatchObject({
      status: "completed",
      overallJudgment: "not-enough-evidence",
    });
    expect(
      confirmed.state.assessmentRequests.some((request) =>
        ["prepared", "message-delivered"].includes(request.status)
      ),
    ).toBe(false);
    expect(snapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
  });

  it("turns the existing clear-selection mutation into an explicit post-handoff reopen", async () => {
    const harness = controllerHarness(null);
    const continued = buildReadyFindState();
    harness.setNow("2026-08-10T15:00:00.000Z");

    const result = await applyScreen02WorkflowAction(
      continued,
      workflowAction(continued, "find-clear-selection"),
      harness.options,
    );
    if (result.state.mode !== "find") {
      throw new Error("Expected reopened Find state.");
    }
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      result.state,
      "private-reopened-controller-access-token",
      harness.options,
    );

    expect(result.message).toBe(
      "Handed-off choice cleared; the existing Find comparison is open again.",
    );
    expect(result.state.runId).toBe(continued.runId);
    expect(result.state.candidates).toEqual(continued.candidates);
    expect(result.state.assessments).toEqual(continued.assessments);
    expect(result.state.decision.tentativeSelectionSnapshotId).toBeNull();
    expect(result.state.decision.continuedRevision).toBeNull();
    expect(result.state.decision.history.at(-1)).toMatchObject({
      action: "selection-cleared",
      candidateSnapshotId:
        continued.decision.tentativeSelectionSnapshotId,
    });
    expect(snapshot.handoff).toBeNull();
  });

  it("reopens the same comparison, chooses another assessed shock, and builds a replacement handoff", async () => {
    const { harness, state: prepared } = await searchedFindState(
      controllerHarness(),
      "controller-find-reopen-alternative",
      [],
      {
        regulatedActivities: [
          "personal data processing",
          "personal information",
          "connected device manufacturing",
        ],
      },
    );
    let current: Screen02WorkflowState = prepared;
    let clock = Date.parse("2026-08-10T15:02:00.000Z");
    for (;;) {
      const request = current.assessmentRequests.find(
        (candidate) =>
          candidate.target.mode === "find-candidate" &&
          candidate.status === "prepared",
      );
      if (!request) break;
      harness.setNow(new Date(clock).toISOString());
      clock += 1_000;
      const completed = await applyScreen02WorkflowAction(
        current,
        workflowAction(current, "assessment-delivery", {
          requestIds: [request.requestId],
          delivered: false,
        }),
        harness.options,
      );
      current = completed.state;
    }
    if (current.mode !== "find") {
      throw new Error("Expected an assessed Find comparison.");
    }
    expect(current.candidates.length).toBeGreaterThan(1);
    const [firstCandidate, secondCandidate] = current.candidates;
    if (!firstCandidate || !secondCandidate) {
      throw new Error("Expected two alternative Find candidates.");
    }

    harness.setNow(new Date(clock).toISOString());
    clock += 1_000;
    const firstSelection = await applyScreen02WorkflowAction(
      current,
      workflowAction(current, "find-select", {
        candidateSnapshotId: firstCandidate.candidateSnapshotId,
      }),
      harness.options,
    );
    harness.setNow(new Date(clock).toISOString());
    clock += 1_000;
    const firstContinuation = await applyScreen02WorkflowAction(
      firstSelection.state,
      workflowAction(firstSelection.state, "find-continue"),
      harness.options,
    );
    const firstSnapshot = await buildScreen02WorkflowClientSnapshot(
      firstContinuation.state,
      "private-first-handoff-access-token",
      harness.options,
    );
    expect(firstSnapshot.handoff?.event.identity.canonicalTitle).toBe(
      firstCandidate.identity.canonicalTitle,
    );

    harness.setNow(new Date(clock).toISOString());
    clock += 1_000;
    const reopened = await applyScreen02WorkflowAction(
      firstContinuation.state,
      workflowAction(firstContinuation.state, "find-clear-selection"),
      harness.options,
    );
    if (reopened.state.mode !== "find") {
      throw new Error("Expected the Find comparison to reopen.");
    }
    expect(reopened.state.runId).toBe(current.runId);
    expect(reopened.state.candidates).toEqual(current.candidates);
    expect(reopened.state.assessments).toEqual(current.assessments);

    harness.setNow(new Date(clock).toISOString());
    clock += 1_000;
    const secondSelection = await applyScreen02WorkflowAction(
      reopened.state,
      workflowAction(reopened.state, "find-select", {
        candidateSnapshotId: secondCandidate.candidateSnapshotId,
      }),
      harness.options,
    );
    harness.setNow(new Date(clock).toISOString());
    const secondContinuation = await applyScreen02WorkflowAction(
      secondSelection.state,
      workflowAction(secondSelection.state, "find-continue"),
      harness.options,
    );
    const secondSnapshot = await buildScreen02WorkflowClientSnapshot(
      secondContinuation.state,
      "private-second-handoff-access-token",
      harness.options,
    );
    expect(secondSnapshot.runId).toBe(firstSnapshot.runId);
    expect(secondSnapshot.handoff?.event.identity.canonicalTitle).toBe(
      secondCandidate.identity.canonicalTitle,
    );
    expect(secondSnapshot.handoff?.event.identity.canonicalTitle).not.toBe(
      firstSnapshot.handoff?.event.identity.canonicalTitle,
    );
    expect(secondSnapshot.handoff?.integrity.handoffFingerprint).not.toBe(
      firstSnapshot.handoff?.integrity.handoffFingerprint,
    );
  });

  it("keeps every assessment prepared for the signed ChatGPT-host path", async () => {
    const harness = controllerHarness();
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-host-only",
      openedAt,
      harness.options,
    );
    harness.setNow("2026-08-10T15:01:00.000Z");

    const result = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      harness.options,
    );

    expect(result.state.assessmentRequests).toHaveLength(1);
    expect(result.state.assessmentRequests[0]).toMatchObject({
      status: "prepared",
      target: { mode: "find-discovery-plan", searchOrdinal: 1 },
      requestedPartIds: ["queryTerms", "rationale"],
    });
    expect(result.state.mode).toBe("find");
    if (result.state.mode !== "find") throw new Error("Expected Find state.");
    expect(result.state.assessments).toEqual([]);
    expect(result.state.criterionFindings).toEqual([]);

    const snapshot = await buildScreen02WorkflowClientSnapshot(
      result.state,
      "private-host-only-access-token",
      harness.options,
    );
    expect(snapshot.assessmentBatch).toMatchObject({
      mode: "find",
      requiredTool: "submit_screen02_find_assessment_draft_v021",
    });
    expect(snapshot.assessmentBatch?.requestIds).toEqual([
      result.state.assessmentRequests[0]!.requestId,
    ]);
    expect(snapshot.assessmentBatch?.modelContext).toMatchObject({
      requests: [expect.objectContaining({ mode: "find-discovery-plan" })],
    });
  });

  it("keeps a fresh Find run genuinely blank", () => {
    const harness = controllerHarness();
    const state = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-blank",
      openedAt,
      harness.options,
    );

    expect(state).toMatchObject({
      mode: "find",
      revision: 0,
      sources: [],
      criteria: [],
      discoveryRequests: [],
      candidateSets: [],
      activeCandidateSetSnapshotId: null,
      candidates: [],
      assessments: [],
      criterionFindings: [],
      assessmentRequests: [],
      outcomeValuesInspected: false,
    });
    expect(harness.generatedIds).toHaveLength(0);
  });

  it("requests the canonical ten-candidate Find comparison", async () => {
    const harness = controllerHarness();
    let observedMaximum = 0;
    const options: Screen02WorkflowControllerOptions = {
      ...harness.options,
      discoverFind: async (state, input) => {
        observedMaximum = input.maximumCandidates;
        return buildReviewedScreen02FindDiscovery(state, input);
      },
    };
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-ten",
      openedAt,
      options,
    );
    harness.setNow("2026-08-10T15:00:30.000Z");

    const planned = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "find-search", { criteria: [] }),
      options,
    );
    const planningRequest = planned.state.assessmentRequests[0]!;
    harness.setNow("2026-08-10T15:00:31.000Z");
    await applyScreen02WorkflowAction(
      planned.state,
      workflowAction(planned.state, "assessment-delivery", {
        requestIds: [planningRequest.requestId],
        delivered: false,
      }),
      options,
    );

    expect(observedMaximum).toBe(10);
  });

  it("creates factual Find candidates and server-identified candidate and criterion jobs", async () => {
    const { harness, state } = await searchedFindState();
    const candidateRequests = state.assessmentRequests.filter(
      (request) => request.target.mode === "find-candidate",
    );
    const criterionRequests = state.assessmentRequests.filter(
      (request) => request.target.mode === "find-criterion",
    );

    expect(state.candidates.length).toBeGreaterThan(0);
    expect(state.sources.length).toBeGreaterThan(0);
    expect(state.criteria).toHaveLength(1);
    expect(state.assessments).toEqual([]);
    expect(state.criterionFindings).toEqual([]);
    expect(state.outcomeValuesInspected).toBe(false);
    expect(state.candidates.every((candidate) =>
      candidate.description.status === "provisional" &&
      candidate.sourceIds.length > 0 &&
      candidate.sourceIds.every((sourceId) =>
        state.sources.some((source) => source.id === sourceId),
      ),
    )).toBe(true);

    expect(candidateRequests).toHaveLength(state.candidates.length);
    expect(criterionRequests).toHaveLength(state.candidates.length);
    expect(
      [...candidateRequests, ...criterionRequests].every(
        (request) =>
          request.status === "prepared" &&
          harness.generatedIds.has(request.requestId) &&
          harness.generatedIds.has(request.jobId),
      ),
    ).toBe(true);
    expect(
      state.assessmentRequests.find(
        (request) => request.target.mode === "find-discovery-plan",
      ),
    ).toMatchObject({ status: "delivery-rejected" });
    expect(state.candidateSets[0]?.manifest.queryMatrix[0]).toMatchObject({
      id: expect.stringContaining("fixed-query-plan-fallback"),
      returnedRecordIds: [],
    });
    expect(state.criteria.every((criterion) =>
      harness.generatedIds.has(criterion.criterionId),
    )).toBe(true);
    const batch = await buildScreen02WorkflowAssessmentBatch(
      state,
      harness.options,
    );
    expect(batch?.requestIds).toHaveLength(
      SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS,
    );
  });

  it("rejects an early timeout but completes a prepared candidate when the host call itself exceeds the absolute deadline", async () => {
    const { harness, state: prepared } = await searchedFindState(
      controllerHarness(),
      "controller-find-hung-host",
      [],
    );
    const request = prepared.assessmentRequests.find(
      (candidate) => candidate.target.mode === "find-candidate",
    );
    if (!request || request.target.mode !== "find-candidate") {
      throw new Error("Expected a prepared candidate request.");
    }
    const preparedAt = request.lifecycle.find(
      (event) => event.status === "prepared",
    )?.at;
    if (!preparedAt) throw new Error("Expected a canonical prepared timestamp.");

    harness.setNow(
      new Date(Date.parse(preparedAt) + 44_999).toISOString(),
    );
    await expect(
      applyScreen02WorkflowAction(
        prepared,
        workflowAction(prepared, "assessment-timeout", {
          requestId: request.requestId,
        }),
        harness.options,
      ),
    ).rejects.toThrow(/deadline has not elapsed/i);

    harness.setNow(
      new Date(Date.parse(preparedAt) + 45_000).toISOString(),
    );
    const timedOut = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-timeout", {
        requestId: request.requestId,
      }),
      harness.options,
    );
    expect(timedOut.state.mode).toBe("find");
    if (timedOut.state.mode !== "find") throw new Error("Expected Find state.");
    expect(
      timedOut.state.assessmentRequests.find(
        (candidate) => candidate.requestId === request.requestId,
      ),
    ).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({
          status: "service-unavailable",
          note: expect.stringMatching(/host message did not settle/i),
        }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
  });

  it("completes a conservative candidate fallback at the host deadline, ignores a late signed receipt, and records fixed-fallback handoff provenance", async () => {
    const { harness, state: prepared } = await searchedFindState(
      controllerHarness(),
      "controller-find-timeout",
      [],
    );
    const request = prepared.assessmentRequests.find(
      (candidate) => candidate.target.mode === "find-candidate",
    );
    if (!request || request.target.mode !== "find-candidate") {
      throw new Error("Expected a prepared candidate request.");
    }
    const candidateSnapshotId = request.target.candidateSnapshotId;

    const issued = await createScreen02FindAssessmentCapability(
      {
        state: prepared,
        requestId: request.requestId,
        capabilityId: "controller-find-timeout-capability",
        issuedAt: "2026-08-10T15:01:02.000Z",
      },
      validSigningConfig,
    );

    harness.setNow("2026-08-10T15:01:03.000Z");
    const delivered = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-delivery", {
        requestIds: [request.requestId],
        delivered: true,
      }),
      harness.options,
    );
    expect(delivered.deliveredRequestIds).toEqual([request.requestId]);
    expect(
      delivered.state.assessmentRequests.find(
        (candidate) => candidate.requestId === request.requestId,
      ),
    ).toMatchObject({
      status: "message-delivered",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({
          status: "message-delivered",
          actor: "chatgpt-host",
          note: SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });

    harness.setNow("2026-08-10T15:01:48.000Z");
    const timedOut = await applyScreen02WorkflowAction(
      delivered.state,
      workflowAction(delivered.state, "assessment-timeout", {
        requestId: request.requestId,
      }),
      harness.options,
    );
    expect(timedOut.state.mode).toBe("find");
    if (timedOut.state.mode !== "find") throw new Error("Expected Find state.");
    const timedOutFindState = timedOut.state;
    const completedRequest = timedOutFindState.assessmentRequests.find(
      (candidate) => candidate.requestId === request.requestId,
    );
    expect(completedRequest).toMatchObject({
      status: "completed",
      acceptedPartIds: [
        "studyFit",
        "outcomePathway",
        "measurementPotential",
        "mainConcern",
        "nextChecks",
      ],
    });
    expect(completedRequest?.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "message-delivered" }),
        expect.objectContaining({ status: "no-tool-submission" }),
        expect.objectContaining({
          status: "validating",
          actor: "fixed-core",
        }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    const fallbackAssessment = timedOutFindState.assessments.find(
      (assessment) => assessment.requestId === request.requestId,
    );
    expect(fallbackAssessment).toMatchObject({
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "plausible" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    expect(fallbackAssessment?.outcomePathway?.explanation).toContain(
      "privacy-engineering and compliance work",
    );
    expect(fallbackAssessment?.outcomePathway?.explanation).toContain(
      "data-enabled product experiments",
    );
    expect(fallbackAssessment?.outcomePathway?.explanation).toContain(
      "not an observed or established causal effect",
    );
    expect(fallbackAssessment?.outcomePathway?.explanation).not.toContain(
      "bounded sources do not establish how",
    );
    expect(fallbackAssessment?.evidenceSourceIds.length).toBeGreaterThan(0);
    expect(
      fallbackAssessment?.evidenceSourceIds.every((sourceId) =>
        timedOutFindState.candidates
          .find(
            (candidate) =>
              candidate.candidateSnapshotId ===
              candidateSnapshotId,
          )
          ?.sourceIds.includes(sourceId),
      ),
    ).toBe(true);
    expect(timedOut.state.criterionFindings).toEqual([]);
    expect(
      buildScreen02WorkflowSummary(
        timedOut.state,
        false,
        timedOut.message,
      ).completedRequestCount,
    ).toBe(1);

    const signedLateReceipt = await createSignedScreen02FindNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: request.requestId,
          draft: {},
        },
        receiptId: "controller-find-timeout-late-receipt",
        receivedAt: "2026-08-10T15:01:49.000Z",
      },
      validSigningConfig,
    );
    const late = applyCanonicalScreen02FindReceipt(
      timedOut.state,
      signedLateReceipt,
    );
    expect(late).toMatchObject({
      disposition: "terminal",
      requestId: request.requestId,
      receiptId: "controller-find-timeout-late-receipt",
    });
    expect(late.state).toBe(timedOut.state);

    harness.setNow("2026-08-10T15:01:50.000Z");
    const selected = await applyScreen02WorkflowAction(
      timedOut.state,
      workflowAction(timedOut.state, "find-select", {
        candidateSnapshotId,
      }),
      harness.options,
    );
    harness.setNow("2026-08-10T15:01:51.000Z");
    const continued = await applyScreen02WorkflowAction(
      selected.state,
      workflowAction(selected.state, "find-continue"),
      harness.options,
    );
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      continued.state,
      "private-fixed-fallback-handoff-access-token",
      harness.options,
    );
    expect(snapshot.handoff).toMatchObject({
      mode: "find",
      preliminaryAssessment: {
        requestId: request.requestId,
        completionOrigin: "fixed-fallback",
      },
    });
  });

  it("uses the same fixed candidate fallback when host delivery is rejected and leaves no retryable candidate request", async () => {
    const { harness, state: prepared } = await searchedFindState(
      controllerHarness(),
      "controller-find-delivery-retry",
      [],
    );
    const request = prepared.assessmentRequests.find(
      (candidate) => candidate.target.mode === "find-candidate",
    );
    if (!request || request.target.mode !== "find-candidate") {
      throw new Error("Expected a prepared candidate request.");
    }

    harness.setNow("2026-08-10T15:01:02.000Z");
    const unavailable = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-delivery", {
        requestIds: [request.requestId],
        delivered: false,
      }),
      harness.options,
    );
    expect(unavailable.message).toMatch(/source-derived assessment/i);
    expect(
      unavailable.state.assessmentRequests.find(
        (candidate) => candidate.requestId === request.requestId,
      ),
    ).toMatchObject({
      requestId: request.requestId,
      jobId: request.jobId,
      attempt: 1,
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "delivery-rejected" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });

    harness.setNow("2026-08-10T15:01:03.000Z");
    await expect(
      applyScreen02WorkflowAction(
        unavailable.state,
        workflowAction(unavailable.state, "find-retry", {
          candidateSnapshotId: request.target.candidateSnapshotId,
        }),
        harness.options,
      ),
    ).rejects.toThrow(/no retryable find request/i);
  });

  it("automatically discovers reviewed CCPA and GDPR identities on Audit open", () => {
    const ccpaHarness = controllerHarness();
    const ccpa = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-audit-ccpa",
      openedAt,
      ccpaHarness.options,
    );
    const gdprHarness = controllerHarness();
    const gdpr = createInitialScreen02WorkflowState(
      gdprAuditContext(),
      "controller-audit-gdpr",
      openedAt,
      gdprHarness.options,
    );

    expect(ccpa.mode).toBe("audit");
    expect(gdpr.mode).toBe("audit");
    if (ccpa.mode !== "audit" || gdpr.mode !== "audit") {
      throw new Error("Expected Audit states.");
    }
    expect(ccpa.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(ccpa.possibleMatches.map((match) => match.relationship)).toEqual([
      "supported-alias",
      "amendment",
      "implementing-rule",
      "enforcement-action",
    ]);
    expect(ccpa.activeMatchSetSnapshotId).not.toBeNull();
    expect(ccpa.assessmentRequests).toEqual([]);

    expect(gdpr.anchor.originalWording).toBe("GDPR");
    expect(gdpr.possibleMatches).toHaveLength(1);
    expect(gdpr.possibleMatches[0]).toMatchObject({
      relationship: "supported-alias",
      identity: {
        canonicalTitle: "General Data Protection Regulation",
        issuingJurisdiction: "European Union",
      },
    });
    expect(gdpr.screen01Baseline.scopeContract.geography).toBe("United States");
  });

  it("prepares exactly one Audit dossier job and treats repeat open as idempotent", async () => {
    const harness = controllerHarness();
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-audit-open",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "audit") throw new Error("Expected Audit state.");
    const matchSnapshotId = opened.possibleMatches[0]?.matchSnapshotId;
    if (!matchSnapshotId) throw new Error("Expected a reviewed CCPA match.");

    harness.setNow("2026-08-10T15:01:00.000Z");
    const first = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "audit-open", { matchSnapshotId }),
      harness.options,
    );
    expect(first.state.assessmentRequests).toHaveLength(1);
    expect(first.state.assessmentRequests[0]).toMatchObject({
      status: "prepared",
      target: { mode: "audit-dossier", matchSnapshotId },
    });
    expect(
      harness.generatedIds.has(first.state.assessmentRequests[0]!.requestId),
    ).toBe(true);
    expect(
      harness.generatedIds.has(first.state.assessmentRequests[0]!.jobId),
    ).toBe(true);

    const priorRevision = first.state.revision;
    const priorFingerprint = fingerprintScreen02WorkflowState(first.state);
    const generatedCount = harness.generatedIds.size;
    harness.setNow("2026-08-10T15:02:00.000Z");
    const repeated = await applyScreen02WorkflowAction(
      first.state,
      workflowAction(first.state, "audit-open", { matchSnapshotId }),
      harness.options,
    );
    expect(repeated.state.assessmentRequests).toHaveLength(1);
    expect(repeated.state.revision).toBe(priorRevision);
    expect(fingerprintScreen02WorkflowState(repeated.state)).toBe(
      priorFingerprint,
    );
    expect(harness.generatedIds.size).toBe(generatedCount);
    expect(repeated.message).toMatch(/existing dossier request/i);
  });

  it("completes an identity-only source dossier when the Audit host cannot receive the automatic turn", async () => {
    const harness = controllerHarness();
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-audit-dossier-host-unavailable",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "audit") throw new Error("Expected Audit state.");
    const matchSnapshotId = opened.possibleMatches[0]?.matchSnapshotId;
    if (!matchSnapshotId) throw new Error("Expected a reviewed Audit match.");

    harness.setNow("2026-08-10T15:01:00.000Z");
    const prepared = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "audit-open", { matchSnapshotId }),
      harness.options,
    );
    const request = prepared.state.assessmentRequests[0];
    expect(request?.target.mode).toBe("audit-dossier");

    harness.setNow("2026-08-10T15:01:01.000Z");
    const unavailable = await applyScreen02WorkflowAction(
      prepared.state,
      workflowAction(prepared.state, "assessment-delivery", {
        requestIds: [request!.requestId],
        delivered: false,
      }),
      harness.options,
    );
    expect(unavailable.state.mode).toBe("audit");
    if (unavailable.state.mode !== "audit") {
      throw new Error("Expected Audit fallback state.");
    }
    const completedRequest = unavailable.state.assessmentRequests.find(
      (candidate) => candidate.requestId === request!.requestId,
    );
    expect(completedRequest).toMatchObject({
      status: "completed",
      acceptedPartIds: [
        "atAGlance",
        "whatHappened",
        "whatChanged",
        "timeline",
        "broadCoverage",
        "keyComponents",
        "relatedVersions",
        "unresolvedFacts",
      ],
    });
    expect(completedRequest?.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "delivery-rejected" }),
        expect.objectContaining({
          status: "completed",
          note: SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    const dossier = unavailable.state.dossiers.at(-1);
    expect(dossier).toMatchObject({
      status: "completed",
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });
    expect(dossier?.atAGlance).toHaveLength(1);
    expect(dossier?.whatHappened?.sourceIds.length).toBeGreaterThan(0);
    expect(dossier?.unresolvedFacts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Evidence gap — timeline:/),
        expect.stringMatching(/^Evidence gap — broadCoverage:/),
      ]),
    );

    harness.setNow("2026-08-10T15:01:02.000Z");
    const confirmed = await applyScreen02WorkflowAction(
      unavailable.state,
      workflowAction(unavailable.state, "audit-confirm", {
        matchSnapshotId,
        reason: "The researcher confirmed this exact source-linked identity.",
      }),
      harness.options,
    );
    expect(confirmed.state.mode).toBe("audit");
    if (confirmed.state.mode === "audit") {
      expect(confirmed.state.confirmedIdentity).not.toBeNull();
      expect(
        confirmed.state.assessmentRequests.some(
          (candidate) =>
            candidate.target.mode === "audit-confirmed-event" &&
            candidate.status === "prepared",
        ),
      ).toBe(true);
    }
  });

  it("keeps Audit identity review usable when assessment signing is not configured", async () => {
    const harness = controllerHarness(null);
    const opened = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-audit-dossier-no-signing",
      openedAt,
      harness.options,
    );
    if (opened.mode !== "audit") throw new Error("Expected Audit state.");
    const matchSnapshotId = opened.possibleMatches[0]?.matchSnapshotId;
    if (!matchSnapshotId) throw new Error("Expected a reviewed Audit match.");

    harness.setNow("2026-08-10T15:01:00.000Z");
    const result = await applyScreen02WorkflowAction(
      opened,
      workflowAction(opened, "audit-open", { matchSnapshotId }),
      harness.options,
    );
    expect(result.state.mode).toBe("audit");
    if (result.state.mode !== "audit") return;
    expect(result.state.assessmentRequests).toHaveLength(1);
    expect(result.state.assessmentRequests[0]).toMatchObject({
      status: "completed",
      target: { mode: "audit-dossier", matchSnapshotId },
    });
    expect(result.state.assessmentRequests[0]?.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "service-unavailable" }),
        expect.objectContaining({
          status: "completed",
          note: SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    expect(result.state.dossiers.at(-1)).toMatchObject({
      status: "completed",
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });

    harness.setNow("2026-08-10T15:01:01.000Z");
    const confirmed = await applyScreen02WorkflowAction(
      result.state,
      workflowAction(result.state, "audit-confirm", {
        matchSnapshotId,
        reason: "The researcher confirmed the exact source-linked identity.",
      }),
      harness.options,
    );
    expect(confirmed.state.mode).toBe("audit");
    if (confirmed.state.mode !== "audit") return;
    expect(confirmed.state.assessmentRequests.at(-1)).toMatchObject({
      status: "completed",
      target: { mode: "audit-confirmed-event" },
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "service-unavailable" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    expect(confirmed.state.assessments.at(-1)).toMatchObject({
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
    });
  });

  it("completes a conservative Audit assessment when confirmed-event delivery is rejected", async () => {
    const harness = controllerHarness();
    const prepared = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
      jobId: "controller-audit-fallback-job",
      requestId: "controller-audit-fallback-request",
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
    harness.setNow("2026-08-09T18:10:10.000Z");

    const result = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-delivery", {
        requestIds: ["controller-audit-fallback-request"],
        delivered: false,
      }),
      harness.options,
    );
    expect(result.message).toMatch(/conservative source-derived assessment/i);
    expect(result.state.mode).toBe("audit");
    if (result.state.mode !== "audit") return;
    expect(result.state.assessmentRequests.at(-1)).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "delivery-rejected" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    expect(result.state.assessments.at(-1)).toMatchObject({
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
    });
  });

  it("records the bounded timeout before completing the Audit assessment fallback", async () => {
    const harness = controllerHarness();
    const prepared = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
      jobId: "controller-audit-timeout-job",
      requestId: "controller-audit-timeout-request",
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
    harness.setNow("2026-08-09T18:10:10.000Z");
    const delivered = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-delivery", {
        requestIds: ["controller-audit-timeout-request"],
        delivered: true,
      }),
      harness.options,
    );
    harness.setNow("2026-08-09T18:10:55.000Z");

    const result = await applyScreen02WorkflowAction(
      delivered.state,
      workflowAction(delivered.state, "assessment-timeout", {
        requestId: "controller-audit-timeout-request",
      }),
      harness.options,
    );
    expect(result.message).toMatch(/conservative source-derived assessment/i);
    expect(result.state.mode).toBe("audit");
    if (result.state.mode !== "audit") return;
    expect(result.state.assessmentRequests.at(-1)).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "message-delivered" }),
        expect.objectContaining({ status: "no-tool-submission" }),
        expect.objectContaining({ status: "validating" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    expect(result.state.assessments.at(-1)).toMatchObject({
      status: "completed",
      overallJudgment: "not-enough-evidence",
    });
  });

  it("completes the same Audit fallback when the host message promise never settles", async () => {
    const harness = controllerHarness();
    const prepared = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
      jobId: "controller-audit-hung-host-job",
      requestId: "controller-audit-hung-host-request",
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
      at: "2026-08-09T18:20:00.000Z",
    });
    harness.setNow("2026-08-09T18:20:45.000Z");

    const result = await applyScreen02WorkflowAction(
      prepared,
      workflowAction(prepared, "assessment-timeout", {
        requestId: "controller-audit-hung-host-request",
      }),
      harness.options,
    );
    expect(result.state.mode).toBe("audit");
    if (result.state.mode !== "audit") return;
    expect(result.state.assessmentRequests.at(-1)).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "service-unavailable" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    expect(result.state.assessments.at(-1)).toMatchObject({
      status: "completed",
      overallJudgment: "not-enough-evidence",
    });
  });

  it("rejects action run substitution and cross-mode actions", async () => {
    const findHarness = controllerHarness(null);
    const find = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-actions",
      openedAt,
      findHarness.options,
    );
    await expect(
      applyScreen02WorkflowAction(
        find,
        workflowAction(find, "refresh", {}, { runId: "another-run" }),
        findHarness.options,
      ),
    ).rejects.toThrow(/run identity/i);
    await expect(
      applyScreen02WorkflowAction(
        find,
        workflowAction(find, "audit-open", { matchSnapshotId: "not-a-match" }),
        findHarness.options,
      ),
    ).rejects.toThrow(/does not apply to find mode/i);

    const auditHarness = controllerHarness(null);
    const audit = createInitialScreen02WorkflowState(
      confirmedWorkflowAuditContext(),
      "controller-audit-actions",
      openedAt,
      auditHarness.options,
    );
    await expect(
      applyScreen02WorkflowAction(
        audit,
        workflowAction(audit, "find-search", { criteria: [] }),
        auditHarness.options,
      ),
    ).rejects.toThrow(/does not apply to audit mode/i);
  });

  it("strictly restores the private envelope while the public summary exposes no raw state", async () => {
    const harness = controllerHarness();
    const state = createInitialScreen02WorkflowState(
      confirmedWorkflowFindContext(),
      "controller-find-snapshot",
      openedAt,
      harness.options,
    );
    const snapshot = await buildScreen02WorkflowClientSnapshot(
      state,
      "private-snapshot-access-token",
      harness.options,
    );

    expect(decodeScreen02WorkflowClientEnvelope(snapshot.stateEnvelope)).toMatchObject({
      ok: true,
      state: { runId: state.runId, mode: "find", revision: state.revision },
    });
    expect(restoreScreen02WorkflowClientSnapshot(snapshot)).not.toBeNull();
    expect(stateFromScreen02WorkflowClientSnapshot(snapshot)).toEqual(state);

    const extraEnvelopeField = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (extraEnvelopeField.stateEnvelope as Record<string, unknown>).rawState = state;
    expect(restoreScreen02WorkflowClientSnapshot(extraEnvelopeField)).toBeNull();

    const summary = buildScreen02WorkflowSummary(
      state,
      true,
      "Fresh Find state is ready.",
    );
    expect(Object.keys(summary).sort()).toEqual(
      [
        "schemaVersion",
        "screen",
        "ok",
        "outcome",
        "mode",
        "assessmentAvailable",
        "preparedRequestCount",
        "deliveredRequestCount",
        "completedRequestCount",
        "continuationReady",
        "message",
      ].sort(),
    );
    expect(summary).not.toHaveProperty("stateEnvelope");
    expect(summary).not.toHaveProperty("accessToken");
    expect(summary).not.toHaveProperty("runId");
    expect(summary).not.toHaveProperty("revision");
    expect(summary).not.toHaveProperty("stateFingerprint");
    expect(summary).not.toHaveProperty("screen01Baseline");
    expect(summary).not.toHaveProperty("sources");
    expect(summary).not.toHaveProperty("candidates");
    expect(JSON.stringify(summary)).not.toContain("private-snapshot-access-token");
  });

  it("keeps factual discovery usable without signing configuration", async () => {
    const { harness, state } = await searchedFindState(
      controllerHarness(null),
      "controller-find-no-signing",
    );
    expect(state.candidates.length).toBeGreaterThan(0);
    expect(state.assessmentRequests.length).toBeGreaterThan(0);
    expect(
      await buildScreen02WorkflowAssessmentBatch(state, harness.options),
    ).toBeNull();

    const snapshot = await buildScreen02WorkflowClientSnapshot(
      state,
      "private-no-signing-access-token",
      harness.options,
    );
    expect(snapshot.assessmentAvailable).toBe(false);
    expect(snapshot.assessmentBatch).toBeNull();
    expect(restoreScreen02WorkflowClientSnapshot(snapshot)).not.toBeNull();
    expect(
      buildScreen02WorkflowSummary(
        state,
        false,
        "Factual discovery remains available.",
      ).assessmentAvailable,
    ).toBe(false);
  });

  it("keeps a fixed-qualified late candidate selectable while compatibility batches still schedule all of its work", async () => {
    const { harness, state } = await searchedFindState(
      controllerHarness(),
      "controller-find-selected-priority",
      undefined,
      {
        regulatedActivities: [
          "personal data processing",
          "personal information",
          "connected device manufacturing",
        ],
      },
    );
    expect(state.candidates.length).toBeGreaterThan(2);
    const selectedCandidate = state.candidates.at(-1)!;
    const selectedCandidateRequest = state.assessmentRequests.find(
      (request) =>
        request.target.mode === "find-candidate" &&
        request.target.candidateSnapshotId ===
          selectedCandidate.candidateSnapshotId,
    );
    if (!selectedCandidateRequest) {
      throw new Error("Expected the late candidate assessment request.");
    }
    const selectedCriterionRequest = state.assessmentRequests.find(
      (request) =>
        request.target.mode === "find-criterion" &&
        request.target.candidateSnapshotId ===
          selectedCandidate.candidateSnapshotId,
    );
    if (!selectedCriterionRequest) {
      throw new Error("Expected the late candidate criterion request.");
    }
    const preparedRequestIds = state.assessmentRequests
      .filter((request) => request.status === "prepared")
      .map((request) => request.requestId);
    expect(preparedRequestIds.slice(0, 2)).not.toContain(
      selectedCandidateRequest.requestId,
    );

    harness.setNow("2026-08-10T15:02:00.000Z");
    const selected = await applyScreen02WorkflowAction(
      state,
      workflowAction(state, "find-select", {
        candidateSnapshotId: selectedCandidate.candidateSnapshotId,
      }),
      harness.options,
    );
    expect(state.decision.tentativeSelectionSnapshotId).toBeNull();
    expect(selected.state.mode).toBe("find");
    if (selected.state.mode !== "find") throw new Error("Expected Find state.");
    expect(selected.state.decision.tentativeSelectionSnapshotId).toBe(
      selectedCandidate.candidateSnapshotId,
    );
    expect(
      selected.state.assessmentRequests.find(
        (request) => request.requestId === selectedCandidateRequest.requestId,
      )?.status,
    ).toBe("prepared");

    let current: Screen02WorkflowState = selected.state;
    const scheduledRequestIds: string[] = [];
    for (let batchOrdinal = 0; ; batchOrdinal += 1) {
      const batch = await buildScreen02WorkflowAssessmentBatch(
        current,
        harness.options,
      );
      if (!batch) break;
      expect(batch.requestIds.length).toBeGreaterThan(0);
      expect(batch.requestIds.length).toBeLessThanOrEqual(
        SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS,
      );
      scheduledRequestIds.push(...batch.requestIds);
      harness.setNow(
        new Date(
          Date.parse("2026-08-10T15:03:00.000Z") + batchOrdinal * 60_000,
        ).toISOString(),
      );
      current = (
        await applyScreen02WorkflowAction(
          current,
          workflowAction(current, "assessment-delivery", {
            requestIds: batch.requestIds,
            delivered: false,
          }),
          harness.options,
        )
      ).state;
    }

    expect([...scheduledRequestIds].sort()).toEqual(
      [...preparedRequestIds].sort(),
    );
    expect(scheduledRequestIds.slice(0, 2)).toEqual([
      selectedCandidateRequest.requestId,
      selectedCriterionRequest.requestId,
    ]);
    expect(scheduledRequestIds).toContain(selectedCandidateRequest.requestId);
    expect(scheduledRequestIds).toContain(selectedCriterionRequest.requestId);
    expect(
      scheduledRequestIds.indexOf(selectedCandidateRequest.requestId),
    ).toBeLessThan(
      scheduledRequestIds.indexOf(selectedCriterionRequest.requestId),
    );
    expect(current.mode).toBe("find");
    if (current.mode !== "find") throw new Error("Expected Find state.");
    expect(current.decision.tentativeSelectionSnapshotId).toBe(
      selectedCandidate.candidateSnapshotId,
    );
  });
});
