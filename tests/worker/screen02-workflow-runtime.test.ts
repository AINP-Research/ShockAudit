import { describe, expect, it } from "vitest";

import {
  decodeScreen02WorkflowClientEnvelope,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
  type Screen02AuditDraftSubmission,
} from "../../src/worker/screen02-audit-assessment-security";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
  type Screen02FindDraftSubmission,
} from "../../src/worker/screen02-find-assessment-security";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
  type Screen02WorkflowAction,
  type Screen02WorkflowActionName,
  type Screen02WorkflowSigningConfig,
} from "../../src/worker/screen02-workflow-controller";
import {
  Screen02WorkflowRuntime,
  type Screen02WorkflowSigningKeyring,
} from "../../src/worker/screen02-workflow-runtime";
import {
  InMemoryScreen02WorkflowStore,
  SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
  type Screen02WorkflowStore,
  type Screen02WorkflowStoreRecord,
} from "../../src/worker/screen02-workflow-store";
import {
  buildSourceQualifiedFindDiscoveryFixture,
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";

const openedAt = "2026-08-10T20:00:00.000Z";
const signingConfig: Screen02WorkflowSigningConfig = {
  keyId: "stage5-runtime-test-key",
  key: "stage5-runtime-signing-key-with-at-least-32-bytes",
};

function runtimeHarness(
  store: Screen02WorkflowStore = new InMemoryScreen02WorkflowStore(),
  signing: Screen02WorkflowSigningKeyring = { current: signingConfig },
  mutationCoordinator?: ConstructorParameters<
    typeof Screen02WorkflowRuntime
  >[0]["mutationCoordinator"],
  legacyHostAssessments?: boolean,
) {
  let now = openedAt;
  const counters = new Map<string, number>();
  const runtime = new Screen02WorkflowRuntime({
    store,
    now: () => now,
    createId: (kind) => {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      return `runtime-${kind}-${next}`;
    },
    signing,
    discoverFind: async (state, input) =>
      buildSourceQualifiedFindDiscoveryFixture(state, input),
    ...(mutationCoordinator ? { mutationCoordinator } : {}),
    ...(legacyHostAssessments !== undefined
      ? { legacyHostAssessments }
      : {}),
  });
  return {
    runtime,
    store,
    setNow(value: string) {
      now = value;
    },
  };
}

function actionFrom(
  snapshot: Screen02WorkflowClientSnapshot,
  operationId: string,
  action: Screen02WorkflowActionName,
  payload: Record<string, unknown> = {},
  overrides: Partial<Screen02WorkflowAction> = {},
): Screen02WorkflowAction {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
    operationId,
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    action,
    payload,
    ...overrides,
  };
}

function recordState(record: Screen02WorkflowStoreRecord) {
  const decoded = decodeScreen02WorkflowClientEnvelope(record.stateEnvelope);
  if (!decoded.ok) throw new Error(decoded.message);
  return decoded.state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function candidateSubmission(
  snapshot: Screen02WorkflowClientSnapshot,
): Screen02FindDraftSubmission {
  const requests = snapshot.assessmentBatch?.modelContext.requests;
  if (!Array.isArray(requests)) {
    throw new Error("Expected a signed Find assessment batch.");
  }
  const request = requests.find(
    (candidate) => isRecord(candidate) && candidate.mode === "find-candidate",
  );
  if (!isRecord(request)) {
    throw new Error("Expected a candidate assessment capability.");
  }
  const candidate = request.candidate;
  if (!isRecord(candidate) || typeof candidate.title !== "string") {
    throw new Error("Expected the immutable candidate identity in the capability.");
  }
  const candidateTitle = candidate.title;
  const draftContract = request.draftContract;
  if (!isRecord(draftContract)) {
    throw new Error("Expected a candidate draft contract.");
  }
  const allowedEvidenceSourceIds = draftContract.allowedEvidenceSourceIds;
  if (
    typeof request.requestId !== "string" ||
    typeof request.capabilityToken !== "string" ||
    !Array.isArray(allowedEvidenceSourceIds) ||
    typeof allowedEvidenceSourceIds[0] !== "string"
  ) {
    throw new Error("The candidate capability is incomplete.");
  }
  const evidenceSourceId = allowedEvidenceSourceIds[0];
  return {
    schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: request.capabilityToken,
    requestId: request.requestId,
    draft: {
      studyFit: {
        category: "strong",
        explanation:
          `${candidateTitle}'s official source dates and territorial lead place this candidate inside the bounded study question, subject to later firm-level verification.`,
        evidenceSourceIds: [evidenceSourceId],
      },
      outcomePathway: {
        category: "plausible",
        explanation:
          "The documented compliance duties could redirect engineering resources and product experimentation within the confirmed innovation outcome family.",
        evidenceSourceIds: [evidenceSourceId],
      },
      measurementPotential: {
        category: "possible",
        explanation:
          "The bounded source packet suggests observable coverage indicators, while later verification must establish firm-level exposure differences.",
        evidenceSourceIds: [evidenceSourceId],
      },
      mainConcern:
        "The broad study population is wider than the firms demonstrably covered by the current official-source lead.",
      nextChecks: [
        "Identify observable pre-event indicators of covered activity for sampled firms.",
        "Check whether documented exposure varies across the sampled firms.",
      ],
    },
  };
}

function plannerSubmission(
  snapshot: Screen02WorkflowClientSnapshot,
): Screen02FindDraftSubmission {
  const requests = snapshot.assessmentBatch?.modelContext.requests;
  if (!Array.isArray(requests)) {
    throw new Error("Expected a signed Find planning batch.");
  }
  const request = requests.find(
    (candidate) =>
      isRecord(candidate) && candidate.mode === "find-discovery-plan",
  );
  if (
    !isRecord(request) ||
    typeof request.requestId !== "string" ||
    typeof request.capabilityToken !== "string"
  ) {
    throw new Error("Expected a complete Find planning capability.");
  }
  return {
    schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: request.capabilityToken,
    requestId: request.requestId,
    draft: {
      queryTerms: ["consumer privacy regulation", "data protection law"],
      rationale:
        "Use statutory and common official terminology to improve retrieval recall.",
    },
  };
}

function auditDossierSubmission(
  snapshot: Screen02WorkflowClientSnapshot,
): Screen02AuditDraftSubmission {
  const requests = snapshot.assessmentBatch?.modelContext.requests;
  if (!Array.isArray(requests)) {
    throw new Error("Expected a signed Audit dossier batch.");
  }
  const request = requests.find(
    (candidate) =>
      isRecord(candidate) &&
      isRecord(candidate.sourcePacket) &&
      candidate.sourcePacket.mode === "audit-dossier",
  );
  const sourcePacket = isRecord(request) ? request.sourcePacket : null;
  if (
    !isRecord(request) ||
    !isRecord(sourcePacket) ||
    typeof sourcePacket.requestId !== "string" ||
    typeof request.capabilityToken !== "string"
  ) {
    throw new Error("Expected an Audit dossier capability.");
  }
  const firstSource = Array.isArray(sourcePacket.sources)
    ? sourcePacket.sources[0]
    : null;
  if (!isRecord(firstSource) || typeof firstSource.id !== "string") {
    throw new Error("Expected a bounded Audit dossier source.");
  }
  const evidenceSourceId = firstSource.id;
  const claim = (text: string) => ({
    text,
    evidenceSourceIds: [evidenceSourceId],
    uncertainty: "Screen 3 must verify the operative details and study relevance.",
  });
  return {
    schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: request.capabilityToken,
    requestId: sourcePacket.requestId,
    draft: {
      atAGlance: [
        claim(
          "The possible match is the California Consumer Privacy Act of 2018, commonly called the CCPA.",
        ),
      ],
      whatHappened: claim(
        "California enacted a consumer privacy statute that created consumer rights and duties for covered businesses.",
      ),
      whatChanged: [
        claim(
          "The statute introduced consumer rights and data governance duties that distinguish this event identity.",
        ),
      ],
      timeline: [
        {
          date: "2018-06-28",
          label: "Enactment date lead",
          stage: "enactment",
          evidenceSourceIds: [evidenceSourceId],
          uncertainty: "Screen 3 must verify the focal empirical event clock.",
        },
      ],
      broadCoverage: [
        claim(
          "Some for-profit entities doing business in California may fall within the broad statutory coverage description.",
        ),
      ],
      keyComponents: [
        claim(
          "Consumer rights, disclosure duties, and data governance obligations distinguish this statute from related events.",
        ),
      ],
      relatedVersions: [
        {
          relationship: "amendment",
          identity: {
            canonicalTitle: "California Privacy Rights Act",
            commonNames: ["CPRA"],
            formalIdentifier: "Proposition 24",
            issuer: "California electorate",
            issuingJurisdiction: "California, United States",
            eventType: "Ballot initiative",
            status: "Related later amendment",
          },
          evidenceSourceIds: [evidenceSourceId],
          note:
            "This is a related later version lead and is not merged into the confirmed 2018 identity.",
        },
      ],
      unresolvedFacts: [
        "The focal event stage and organization-level historical coverage remain unverified.",
      ],
    },
  };
}

function storeWithDeliveryDrainGap() {
  const base = new InMemoryScreen02WorkflowStore();
  let announceDeliveryCommit!: () => void;
  const deliveryCommitted = new Promise<void>((resolve) => {
    announceDeliveryCommit = resolve;
  });
  let resumeDelivery!: () => void;
  const deliveryCanReturn = new Promise<void>((resolve) => {
    resumeDelivery = resolve;
  });
  let paused = false;
  const store: Screen02WorkflowStore = {
    create: (input) => base.create(input),
    readOpenOperation: (operationId) =>
      base.readOpenOperation(operationId),
    read: (input) => base.read(input),
    readTrusted: (input) => base.readTrusted(input),
    update: async (input) => {
      const result = await base.update(input);
      if (
        !paused &&
        input.operationKind === "assessment-delivery" &&
        [
          "runtime-find-delivery-gap",
          "runtime-audit-delivery-gap",
        ].includes(input.operationId)
      ) {
        paused = true;
        announceDeliveryCommit();
        await deliveryCanReturn;
      }
      return result;
    },
    updateTrusted: (input) => base.updateTrusted(input),
    retire: (input) => base.retire(input),
    cleanupExpired: (at) => base.cleanupExpired(at),
    nextExpirationAt: () => base.nextExpirationAt(),
  };
  return { store, deliveryCommitted, resumeDelivery };
}

async function searchedRun(harness = runtimeHarness()) {
  const opened = await harness.runtime.open(confirmedWorkflowFindContext());
  harness.setNow("2026-08-10T20:00:10.000Z");
  const planned = await harness.runtime.mutate(
    actionFrom(opened.snapshot, "runtime-find-search", "find-search", {
      criteria: [],
    }),
  );
  const planningRequestId = planned.snapshot.assessmentBatch?.requestIds[0];
  if (!planningRequestId) {
    throw new Error("Expected the automatic ChatGPT planning request.");
  }
  harness.setNow("2026-08-10T20:00:11.000Z");
  const searched = await harness.runtime.mutate(
    actionFrom(
      planned.snapshot,
      "runtime-planner-fallback",
      "assessment-delivery",
      { requestIds: [planningRequestId], delivered: false },
    ),
  );
  return { harness, opened, searched };
}

async function auditDossierRun(harness = runtimeHarness()) {
  const opened = await harness.runtime.open(confirmedWorkflowAuditContext());
  const state = stateFromScreen02WorkflowClientSnapshot(opened.snapshot);
  if (state.mode !== "audit") throw new Error("Expected an Audit state.");
  const matchSnapshotId = state.possibleMatches[0]?.matchSnapshotId;
  if (!matchSnapshotId) throw new Error("Expected a reviewed Audit match.");
  harness.setNow("2026-08-10T20:00:10.000Z");
  const dossier = await harness.runtime.mutate(
    actionFrom(opened.snapshot, "runtime-audit-open", "audit-open", {
      matchSnapshotId,
    }),
  );
  return { harness, opened, dossier };
}

describe("Screen 2 workflow runtime", () => {
  it("applies authenticated ChatGPT planning and automatically starts source discovery", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");
    const planned = await harness.runtime.mutate(
      actionFrom(opened.snapshot, "runtime-plan-find", "find-search", {
        criteria: [],
      }),
    );
    const submission = plannerSubmission(planned.snapshot);

    harness.setNow("2026-08-10T20:00:11.000Z");
    const delivered = await harness.runtime.mutate(
      actionFrom(
        planned.snapshot,
        "runtime-deliver-plan",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );
    harness.setNow("2026-08-10T20:00:12.000Z");
    const notice = await harness.runtime.submitFindDraft(submission);
    expect(notice).toMatchObject({
      disposition: "apply",
      requestId: submission.requestId,
    });

    harness.setNow("2026-08-10T20:00:13.000Z");
    const refreshed = await harness.runtime.mutate(
      actionFrom(delivered.snapshot, "runtime-refresh-planned-find", "refresh"),
    );
    const state = stateFromScreen02WorkflowClientSnapshot(refreshed.snapshot);
    if (state.mode !== "find") throw new Error("Expected a Find state.");
    expect(state.candidates.length).toBeGreaterThan(0);
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      )?.status,
    ).toBe("completed");
    expect(
      state.assessmentRequests.some(
        (request) => request.target.mode === "find-candidate",
      ),
    ).toBe(true);
    expect(state.candidateSets[0]?.manifest.queryMatrix[0]).toMatchObject({
      id: expect.stringContaining("chatgpt-query-plan"),
      query: "consumer privacy regulation | data protection law",
      returnedRecordIds: [],
    });
  });

  it("returns and persists prepared Find assessments for ChatGPT-host completion", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const harness = runtimeHarness(store, { current: signingConfig });
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");

    const searched = await harness.runtime.mutate(
      actionFrom(opened.snapshot, "runtime-server-completion", "find-search", {
        criteria: [],
      }),
    );

    const state = stateFromScreen02WorkflowClientSnapshot(searched.snapshot);
    expect(state.assessmentRequests.length).toBeGreaterThan(0);
    expect(
      state.assessmentRequests.every((request) => request.status === "prepared"),
    ).toBe(true);
    expect(searched.snapshot.assessmentBatch).toMatchObject({
      mode: "find",
      requiredTool: "submit_screen02_find_assessment_draft_v021",
    });
    expect(searched.snapshot.assessmentBatch?.requestIds.length).toBeGreaterThan(0);
    const stored = await store.readTrusted({ runId: searched.snapshot.runId });
    expect(stored).toMatchObject({
      outcome: "found",
      record: {
        stateRevision: searched.snapshot.revision,
        stateFingerprint: searched.snapshot.stateFingerprint,
      },
    });
  });

  it("propagates the current-route switch through deterministic Find runtime mutations", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const harness = runtimeHarness(
      store,
      { current: signingConfig },
      undefined,
      false,
    );
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");

    const searched = await harness.runtime.mutate(
      actionFrom(opened.snapshot, "runtime-current-find", "find-search", {
        criteria: [],
      }),
    );
    const state = stateFromScreen02WorkflowClientSnapshot(searched.snapshot);
    if (state.mode !== "find") throw new Error("Expected Find state.");

    expect(state.candidates.length).toBeGreaterThan(0);
    expect(state.assessmentRequests).toEqual([]);
    expect(searched.snapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(searched.summary).toMatchObject({
      assessmentAvailable: false,
      preparedRequestCount: 0,
    });
    await expect(
      harness.runtime.submitFindDraft({} as Screen02FindDraftSubmission),
    ).rejects.toThrow(/disabled on this route/i);
    await expect(
      harness.runtime.submitAuditDraft({} as Screen02AuditDraftSubmission),
    ).rejects.toThrow(/disabled on this route/i);
  });

  it("allocates server credentials while persisting only the access-token digest", async () => {
    const { runtime, store } = runtimeHarness();
    const opened = await runtime.open(confirmedWorkflowFindContext());

    expect(opened.summary).toMatchObject({
      outcome: "created",
      mode: "find",
    });
    expect(opened.summary).not.toHaveProperty("runId");
    expect(opened.summary).not.toHaveProperty("revision");
    expect(opened.summary).not.toHaveProperty("stateFingerprint");
    expect(opened.snapshot.runId).toMatch(/^s2r_[A-Za-z0-9_-]{43}$/);
    expect(opened.snapshot.accessToken).toMatch(/^s2a_[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(opened.summary)).not.toContain(
      opened.snapshot.accessToken,
    );
    expect(JSON.stringify(opened.snapshot.stateEnvelope)).not.toContain(
      opened.snapshot.accessToken,
    );

    const trusted = await store.readTrusted({ runId: opened.snapshot.runId });
    expect(trusted.outcome).toBe("found");
    if (trusted.outcome !== "found") throw new Error("Run was not stored.");
    expect(trusted.record.accessTokenSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(trusted.record)).not.toContain(
      opened.snapshot.accessToken,
    );
  });

  it("replays an idempotent open with the same private run credentials", async () => {
    const harness = runtimeHarness();
    const baseline = confirmedWorkflowFindContext();
    const operationId = "runtime-idempotent-open";

    const created = await harness.runtime.open(baseline, operationId);
    harness.setNow("2026-08-10T20:01:00.000Z");
    const replayed = await harness.runtime.open(baseline, operationId);

    expect(created.summary.outcome).toBe("created");
    expect(replayed.summary.outcome).toBe("replayed");
    expect(replayed.snapshot.runId).toBe(created.snapshot.runId);
    expect(replayed.snapshot.accessToken).toBe(created.snapshot.accessToken);
    expect(replayed.snapshot.revision).toBe(created.snapshot.revision);
    expect(replayed.snapshot.stateFingerprint).toBe(
      created.snapshot.stateFingerprint,
    );
    const trusted = await harness.store.readTrusted({
      runId: created.snapshot.runId,
    });
    expect(trusted).toMatchObject({
      outcome: "found",
      record: { generation: 0, stateRevision: 0 },
    });
  });

  it("creates and durably replays a blank Audit reset without initial discovery", async () => {
    const harness = runtimeHarness();
    const baseline = confirmedWorkflowAuditContext();
    const operationId = "runtime-idempotent-blank-audit-open";

    const created = await harness.runtime.open(
      baseline,
      operationId,
      "blank",
    );
    const createdState = stateFromScreen02WorkflowClientSnapshot(
      created.snapshot,
    );
    expect(createdState).toMatchObject({
      mode: "audit",
      revision: 0,
      screen01Baseline: baseline,
      sources: [],
      matchSets: [],
      activeMatchSetSnapshotId: null,
      possibleMatches: [],
      dossiers: [],
      identityDecisions: [],
      confirmedIdentity: null,
      assessments: [],
      assessmentRequests: [],
      continuationHistory: [],
    });
    expect(created.summary.message).toMatch(/blank named-shock anchor/i);

    const replayed = await harness.runtime.open(
      baseline,
      operationId,
      "blank",
    );
    expect(replayed.summary.outcome).toBe("replayed");
    expect(replayed.snapshot.runId).toBe(created.snapshot.runId);
    expect(replayed.snapshot.accessToken).toBe(created.snapshot.accessToken);
    expect(replayed.snapshot.stateFingerprint).toBe(
      created.snapshot.stateFingerprint,
    );

    await expect(
      harness.runtime.open(baseline, operationId, "standard"),
    ).rejects.toThrow(/different initialization profile/i);
  });

  it("keeps blank-open replay bound after the Audit run later mutates", async () => {
    const harness = runtimeHarness();
    const baseline = confirmedWorkflowAuditContext();
    const operationId = "runtime-blank-audit-replay-after-mutation";
    const created = await harness.runtime.open(
      baseline,
      operationId,
      "blank",
    );
    harness.setNow("2026-08-10T20:00:10.000Z");
    const revised = await harness.runtime.mutate(
      actionFrom(
        created.snapshot,
        "runtime-blank-audit-revise",
        "audit-revise-anchor",
        {
          fields: {
            shockName: "California Consumer Privacy Act",
            jurisdiction: "California, United States",
            issuingAuthority: "California Legislature",
            approximateYear: "2018",
            versionType: "original",
            distinguishingFeature: null,
            sourceLocator: null,
            clarification: null,
          },
          reason: "Run a fresh identity search after reset.",
        },
      ),
    );
    expect(revised.snapshot.revision).toBeGreaterThan(created.snapshot.revision);

    const replayed = await harness.runtime.open(
      baseline,
      operationId,
      "blank",
    );
    expect(replayed.summary.outcome).toBe("replayed");
    expect(replayed.snapshot.runId).toBe(created.snapshot.runId);
    expect(replayed.snapshot.revision).toBe(revised.snapshot.revision);
    expect(replayed.snapshot.stateFingerprint).toBe(
      revised.snapshot.stateFingerprint,
    );
  });

  it("rejects operationId reuse with a different confirmed Screen 1 baseline", async () => {
    const harness = runtimeHarness();
    const operationId = "runtime-open-baseline-binding";
    const created = await harness.runtime.open(
      confirmedWorkflowFindContext(),
      operationId,
    );

    await expect(
      harness.runtime.open(confirmedWorkflowAuditContext(), operationId),
    ).rejects.toThrow(
      "already bound to a different confirmed Screen 1 baseline",
    );
    await expect(
      harness.store.readTrusted({ runId: created.snapshot.runId }),
    ).resolves.toMatchObject({
      outcome: "found",
      record: { mode: "find", generation: 0 },
    });
  });

  it("converges concurrent idempotent open races on one durable run", async () => {
    const base = new InMemoryScreen02WorkflowStore();
    let releaseReads!: () => void;
    const readsReleased = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    let initialReadCount = 0;
    const createRunIds: string[] = [];
    const store: Screen02WorkflowStore = {
      create: async (input) => {
        createRunIds.push(input.runId);
        return base.create(input);
      },
      readOpenOperation: (operationId) =>
        base.readOpenOperation(operationId),
      read: async (input) => {
        const result = await base.read(input);
        if (result.outcome === "not-found" && initialReadCount < 2) {
          initialReadCount += 1;
          if (initialReadCount === 2) releaseReads();
          await readsReleased;
        }
        return result;
      },
      readTrusted: (input) => base.readTrusted(input),
      update: (input) => base.update(input),
      updateTrusted: (input) => base.updateTrusted(input),
      retire: (input) => base.retire(input),
      cleanupExpired: (at) => base.cleanupExpired(at),
      nextExpirationAt: () => base.nextExpirationAt(),
    };
    const harness = runtimeHarness(store);
    const baseline = confirmedWorkflowAuditContext();

    const results = await Promise.all([
      harness.runtime.open(baseline, "runtime-concurrent-open"),
      harness.runtime.open(baseline, "runtime-concurrent-open"),
    ]);

    expect(results.map((result) => result.summary.outcome).sort()).toEqual([
      "created",
      "replayed",
    ]);
    expect(createRunIds).toHaveLength(2);
    // Both callers may prepare a different random identity before the store
    // transaction chooses one binding. Only the winner is returned.
    expect(new Set(createRunIds)).toHaveLength(2);
    expect(new Set(results.map((result) => result.snapshot.runId))).toHaveLength(
      1,
    );
    expect(
      new Set(results.map((result) => result.snapshot.accessToken)),
    ).toHaveLength(1);
    expect(
      new Set(results.map((result) => result.snapshot.stateFingerprint)),
    ).toHaveLength(1);
    await expect(
      store.readTrusted({ runId: results[0]!.snapshot.runId }),
    ).resolves.toMatchObject({ outcome: "found" });
  });

  it("fails closed when concurrent opens race with different initialization profiles", async () => {
    const base = new InMemoryScreen02WorkflowStore();
    let releaseReads!: () => void;
    const readsReleased = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    let initialReadCount = 0;
    const store: Screen02WorkflowStore = {
      create: (input) => base.create(input),
      readOpenOperation: async (operationId) => {
        const result = await base.readOpenOperation(operationId);
        if (result.outcome === "not-found" && initialReadCount < 2) {
          initialReadCount += 1;
          if (initialReadCount === 2) releaseReads();
          await readsReleased;
        }
        return result;
      },
      read: (input) => base.read(input),
      readTrusted: (input) => base.readTrusted(input),
      update: (input) => base.update(input),
      updateTrusted: (input) => base.updateTrusted(input),
      retire: (input) => base.retire(input),
      cleanupExpired: (at) => base.cleanupExpired(at),
      nextExpirationAt: () => base.nextExpirationAt(),
    };
    const harness = runtimeHarness(store);
    const baseline = confirmedWorkflowAuditContext();
    const operationId = "runtime-concurrent-mixed-initialization";
    const outcomes = await Promise.allSettled([
      harness.runtime.open(baseline, operationId, "standard"),
      harness.runtime.open(baseline, operationId, "blank"),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(Error);
    expect((rejected?.reason as Error).message).toMatch(
      /different initialization profile/i,
    );
    const binding = await store.readOpenOperation(operationId);
    expect(binding).toMatchObject({ outcome: "bound" });
    if (binding.outcome !== "bound") {
      throw new Error("Expected one durable open-operation winner.");
    }
    expect(["standard", "blank"]).toContain(binding.binding.initialState);
  });

  it("replays an idempotent open through the retained previous signing key", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const original = runtimeHarness(store);
    const baseline = confirmedWorkflowFindContext();
    const operationId = "runtime-open-key-rotation";
    const created = await original.runtime.open(baseline, operationId);
    const rotatedSigning: Screen02WorkflowSigningConfig = {
      keyId: "stage5-runtime-rotated-key",
      key: "stage5-runtime-rotated-signing-key-with-at-least-32-bytes",
    };
    const rotated = runtimeHarness(store, {
      current: rotatedSigning,
      previous: signingConfig,
    });

    const replayed = await rotated.runtime.open(baseline, operationId);

    expect(replayed.summary.outcome).toBe("replayed");
    expect(replayed.snapshot.runId).toBe(created.snapshot.runId);
    expect(replayed.snapshot.accessToken).toBe(created.snapshot.accessToken);
  });

  it("fails closed instead of duplicating an active open after its signing key is dropped", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const original = runtimeHarness(store);
    const baseline = confirmedWorkflowFindContext();
    const operationId = "runtime-open-dropped-key";
    const created = await original.runtime.open(baseline, operationId);
    const rotatedSigning: Screen02WorkflowSigningConfig = {
      keyId: "stage5-runtime-new-only-key",
      key: "stage5-runtime-new-only-signing-key-with-at-least-32-bytes",
    };
    const rotated = runtimeHarness(store, { current: rotatedSigning });

    await expect(
      rotated.runtime.open(baseline, operationId),
    ).rejects.toThrow("available signing keys");
    await expect(
      store.read({
        runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken,
      }),
    ).resolves.toMatchObject({ outcome: "authenticated" });
  });

  it("allocates fresh credentials when a retired operation ID is used again", async () => {
    const harness = runtimeHarness();
    const baseline = confirmedWorkflowFindContext();
    const operationId = "runtime-retired-open-does-not-revive";
    const created = await harness.runtime.open(baseline, operationId);

    await expect(
      harness.runtime.retire({
        runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken,
        expectedRevision: created.snapshot.revision,
        expectedStateFingerprint: created.snapshot.stateFingerprint,
      }),
    ).resolves.toMatchObject({ outcome: "retired" });
    await expect(
      harness.store.readOpenOperation(operationId),
    ).resolves.toEqual({ outcome: "not-found" });

    harness.setNow("2026-08-10T20:01:00.000Z");
    const replacement = await harness.runtime.open(baseline, operationId);

    expect(replacement.summary.outcome).toBe("created");
    expect(replacement.snapshot.runId).not.toBe(created.snapshot.runId);
    expect(replacement.snapshot.accessToken).not.toBe(
      created.snapshot.accessToken,
    );
    await expect(
      harness.store.read({
        runId: created.snapshot.runId,
        accessToken: created.snapshot.accessToken,
      }),
    ).resolves.toEqual({ outcome: "not-found" });
  });

  it("allocates fresh credentials after retention cleanup removes an open binding", async () => {
    const harness = runtimeHarness();
    const baseline = confirmedWorkflowFindContext();
    const operationId = "runtime-expired-open-does-not-revive";
    const created = await harness.runtime.open(baseline, operationId);
    const afterIdleExpiry = new Date(
      Date.parse(openedAt) +
        SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS +
        1,
    ).toISOString();

    await expect(
      harness.store.cleanupExpired(afterIdleExpiry),
    ).resolves.toMatchObject({ deletedRunIds: [created.snapshot.runId] });
    await expect(
      harness.store.readOpenOperation(operationId),
    ).resolves.toEqual({ outcome: "not-found" });

    harness.setNow(afterIdleExpiry);
    const replacement = await harness.runtime.open(baseline, operationId);
    expect(replacement.summary.outcome).toBe("created");
    expect(replacement.snapshot.runId).not.toBe(created.snapshot.runId);
    expect(replacement.snapshot.accessToken).not.toBe(
      created.snapshot.accessToken,
    );
  });

  it("stores only an operation digest, derivation nonce, and token digest in the active binding", async () => {
    const harness = runtimeHarness();
    const operationId =
      "runtime-private-open-operation-raw-value-must-not-persist";
    const created = await harness.runtime.open(
      confirmedWorkflowFindContext(),
      operationId,
    );
    const binding = await harness.store.readOpenOperation(operationId);

    expect(binding.outcome).toBe("bound");
    if (binding.outcome !== "bound") {
      throw new Error("Open-operation binding was not stored.");
    }
    expect(binding.binding.operationIdSha256).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(binding.binding.identityNonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(binding.binding.accessTokenSha256).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(JSON.stringify(binding)).not.toContain(operationId);
    expect(JSON.stringify(binding)).not.toContain(
      created.snapshot.accessToken,
    );
  });

  it("validates idempotent open identifiers and preserves unsigned random opens", async () => {
    const unsigned = runtimeHarness(new InMemoryScreen02WorkflowStore(), {
      current: null,
    });

    const opened = await unsigned.runtime.open(confirmedWorkflowFindContext());
    expect(opened.summary.outcome).toBe("created");
    expect(opened.snapshot.assessmentAvailable).toBe(false);
    await expect(
      unsigned.runtime.open(confirmedWorkflowFindContext(), "unsigned-open"),
    ).rejects.toThrow("requires an active signing key");

    const signed = runtimeHarness();
    for (const operationId of ["", " padded ", "x".repeat(201)]) {
      await expect(
        signed.runtime.open(confirmedWorkflowFindContext(), operationId),
      ).rejects.toThrow("must be a bounded canonical identifier");
    }
  });

  it("applies an authenticated action only at its exact canonical CAS coordinates", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");

    const result = await harness.runtime.mutate(
      actionFrom(opened.snapshot, "runtime-exact-cas", "find-search", {
        criteria: [],
      }),
    );

    expect(result.summary.outcome).toBe("applied");
    expect(result.snapshot.revision).toBeGreaterThan(opened.snapshot.revision);
    expect(result.snapshot.stateFingerprint).not.toBe(
      opened.snapshot.stateFingerprint,
    );
    const stored = await harness.store.read({
      runId: result.snapshot.runId,
      accessToken: result.snapshot.accessToken,
    });
    expect(stored.outcome).toBe("authenticated");
    if (stored.outcome !== "authenticated") {
      throw new Error("Run was not authenticated.");
    }
    expect(stored.record).toMatchObject({
      generation: 1,
      stateRevision: result.snapshot.revision,
      stateFingerprint: result.snapshot.stateFingerprint,
    });
  });

  it("reports an exact canonical refresh as refreshed without changing state", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());

    const refreshed = await harness.runtime.mutate(
      actionFrom(opened.snapshot, "runtime-exact-refresh", "refresh"),
    );

    expect(refreshed.summary).toMatchObject({
      outcome: "refreshed",
      mode: "find",
      assessmentAvailable: opened.snapshot.assessmentAvailable,
    });
    expect(refreshed.snapshot.revision).toBe(opened.snapshot.revision);
    expect(refreshed.snapshot.stateFingerprint).toBe(
      opened.snapshot.stateFingerprint,
    );
  });

  it("serializes concurrent successors so one applies and the loser restores the same winner", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");
    const first = actionFrom(
      opened.snapshot,
      "runtime-race-first",
      "find-search",
      { criteria: [] },
    );
    const second = actionFrom(
      opened.snapshot,
      "runtime-race-second",
      "find-search",
      {
        criteria: [
          {
            kind: "only-include",
            text: "Candidate has a binding public source record",
          },
        ],
      },
    );

    const results = await Promise.all([
      harness.runtime.mutate(first),
      harness.runtime.mutate(second),
    ]);

    expect(results.map((result) => result.summary.outcome).sort()).toEqual([
      "applied",
      "conflict",
    ]);
    expect(new Set(results.map((result) => result.snapshot.revision))).toHaveLength(
      1,
    );
    expect(
      new Set(results.map((result) => result.snapshot.stateFingerprint)),
    ).toHaveLength(1);
    const trusted = await harness.store.readTrusted({
      runId: opened.snapshot.runId,
    });
    expect(trusted.outcome).toBe("found");
    if (trusted.outcome !== "found") throw new Error("Run was not stored.");
    expect(trusted.record).toMatchObject({
      generation: 1,
      stateRevision: results[0]!.snapshot.revision,
      stateFingerprint: results[0]!.snapshot.stateFingerprint,
    });
  });

  it("replays an identical operationId retry without applying a second successor", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");
    const action = actionFrom(
      opened.snapshot,
      "runtime-idempotent-operation",
      "find-search",
      { criteria: [] },
    );

    const applied = await harness.runtime.mutate(action);
    const replayed = await harness.runtime.mutate(action);

    expect(applied.summary.outcome).toBe("applied");
    expect(replayed.summary.outcome).toBe("replayed");
    expect(replayed.snapshot.revision).toBe(applied.snapshot.revision);
    expect(replayed.snapshot.stateFingerprint).toBe(
      applied.snapshot.stateFingerprint,
    );
    const trusted = await harness.store.readTrusted({
      runId: opened.snapshot.runId,
    });
    expect(trusted.outcome).toBe("found");
    if (trusted.outcome !== "found") throw new Error("Run was not stored.");
    expect(trusted.record.generation).toBe(1);
    expect(trusted.record.operationReplays).toHaveLength(1);
  });

  it("coalesces concurrent identical host-preparation retries", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const mutationCoordinator: NonNullable<
      ConstructorParameters<typeof Screen02WorkflowRuntime>[0]["mutationCoordinator"]
    > = {
      inFlightMutations: new Map(),
      mutationTails: new Map(),
    };
    const harness = runtimeHarness(
      store,
      { current: signingConfig },
      mutationCoordinator,
    );
    const retryHarness = runtimeHarness(
      store,
      { current: signingConfig },
      mutationCoordinator,
    );
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    harness.setNow("2026-08-10T20:00:10.000Z");
    retryHarness.setNow("2026-08-10T20:00:10.000Z");
    const action = actionFrom(
      opened.snapshot,
      "runtime-concurrent-host-preparation",
      "find-search",
      { criteria: [] },
    );

    const [firstResult, retryResult] = await Promise.all([
      harness.runtime.mutate(action),
      retryHarness.runtime.mutate(action),
    ]);

    expect(firstResult.summary.outcome).toBe("applied");
    expect(retryResult.snapshot.stateFingerprint).toBe(
      firstResult.snapshot.stateFingerprint,
    );
    expect(retryResult.snapshot.assessmentBatch).toEqual(
      firstResult.snapshot.assessmentBatch,
    );
    expect(firstResult.snapshot.assessmentBatch).toMatchObject({
      mode: "find",
      requiredTool: "submit_screen02_find_assessment_draft_v021",
    });
    const state = stateFromScreen02WorkflowClientSnapshot(
      firstResult.snapshot,
    );
    expect(
      state.assessmentRequests.every(
        (request) => request.status === "prepared",
      ),
    ).toBe(true);
  });

  it("rejects a validly shaped token that does not possess the target run", async () => {
    const harness = runtimeHarness();
    const target = await harness.runtime.open(confirmedWorkflowFindContext());
    const other = await harness.runtime.open(confirmedWorkflowFindContext());

    await expect(
      harness.runtime.mutate(
        actionFrom(
          target.snapshot,
          "runtime-wrong-token",
          "find-search",
          { criteria: [] },
          { accessToken: other.snapshot.accessToken },
        ),
      ),
    ).rejects.toThrow("This Screen 2 run is unavailable or expired.");
    const trusted = await harness.store.readTrusted({
      runId: target.snapshot.runId,
    });
    expect(trusted).toMatchObject({
      outcome: "found",
      record: { generation: 0, stateRevision: 0 },
    });
  });

  it("retires immediately only with possession and the current canonical coordinates", async () => {
    const harness = runtimeHarness();
    const opened = await harness.runtime.open(confirmedWorkflowFindContext());
    const other = await harness.runtime.open(confirmedWorkflowFindContext());

    await expect(
      harness.runtime.retire({
        runId: opened.snapshot.runId,
        accessToken: other.snapshot.accessToken,
        expectedRevision: opened.snapshot.revision,
        expectedStateFingerprint: opened.snapshot.stateFingerprint,
      }),
    ).rejects.toThrow("Screen 2 workflow access was rejected.");

    harness.setNow("2026-08-10T20:00:10.000Z");
    const changed = await harness.runtime.mutate(
      actionFrom(
        opened.snapshot,
        "runtime-retirement-race",
        "find-search",
        { criteria: [] },
      ),
    );
    await expect(
      harness.runtime.retire({
        runId: opened.snapshot.runId,
        accessToken: opened.snapshot.accessToken,
        expectedRevision: opened.snapshot.revision,
        expectedStateFingerprint: opened.snapshot.stateFingerprint,
      }),
    ).resolves.toMatchObject({
      outcome: "conflict",
      runId: opened.snapshot.runId,
    });
    await expect(
      harness.store.readTrusted({ runId: opened.snapshot.runId }),
    ).resolves.toMatchObject({ outcome: "found" });

    await expect(
      harness.runtime.retire({
        runId: changed.snapshot.runId,
        accessToken: changed.snapshot.accessToken,
        expectedRevision: changed.snapshot.revision,
        expectedStateFingerprint: changed.snapshot.stateFingerprint,
      }),
    ).resolves.toEqual({
      outcome: "retired",
      runId: changed.snapshot.runId,
      message: "The prior Screen 2 run was deleted after replacement.",
    });
    await expect(
      harness.store.readTrusted({ runId: changed.snapshot.runId }),
    ).resolves.toEqual({ outcome: "not-found" });
    await expect(
      harness.runtime.mutate(
        actionFrom(
          changed.snapshot,
          "runtime-after-retirement",
          "refresh",
        ),
      ),
    ).rejects.toThrow("This Screen 2 run is unavailable or expired.");
    await expect(
      harness.runtime.retire({
        runId: changed.snapshot.runId,
        accessToken: changed.snapshot.accessToken,
        expectedRevision: changed.snapshot.revision,
        expectedStateFingerprint: changed.snapshot.stateFingerprint,
      }),
    ).resolves.toEqual({
      outcome: "already-absent",
      runId: changed.snapshot.runId,
      message: "The retired Screen 2 run was already absent.",
    });
  });

  it("buffers a fast signed receipt, then delivery drains and applies it exactly once", async () => {
    const { harness, searched } = await searchedRun();
    const submission = candidateSubmission(searched.snapshot);
    harness.setNow("2026-08-10T20:00:20.000Z");

    const buffered = await harness.runtime.submitFindDraft(submission);

    expect(buffered).toMatchObject({
      disposition: "buffered-awaiting-delivery",
      requestId: submission.requestId,
    });
    expect(buffered).not.toHaveProperty("revision");
    expect(buffered).not.toHaveProperty("stateFingerprint");
    expect(buffered).not.toHaveProperty("capabilityToken");
    expect(buffered).not.toHaveProperty("receiptToken");
    const beforeDelivery = await harness.store.readTrusted({
      runId: searched.snapshot.runId,
    });
    expect(beforeDelivery.outcome).toBe("found");
    if (beforeDelivery.outcome !== "found") {
      throw new Error("Run was not stored.");
    }
    expect(beforeDelivery.record.bufferedReceipts).toHaveLength(1);

    harness.setNow("2026-08-10T20:00:30.000Z");
    const delivered = await harness.runtime.mutate(
      actionFrom(
        searched.snapshot,
        "runtime-deliver-buffered",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );
    const state = stateFromScreen02WorkflowClientSnapshot(delivered.snapshot);
    expect(delivered.summary.outcome).toBe("applied");
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      )?.status,
    ).toBe("completed");
    if (state.mode !== "find") throw new Error("Expected a Find state.");
    expect(state.assessments).toHaveLength(1);
    const afterDelivery = await harness.store.readTrusted({
      runId: searched.snapshot.runId,
    });
    expect(afterDelivery.outcome).toBe("found");
    if (afterDelivery.outcome !== "found") {
      throw new Error("Run was not stored.");
    }
    expect(afterDelivery.record.bufferedReceipts).toEqual([]);
    const generationAfterDelivery = afterDelivery.record.generation;

    harness.setNow("2026-08-10T20:00:40.000Z");
    const late = await harness.runtime.submitFindDraft(submission);
    expect(late).toMatchObject({
      disposition: "terminal",
    });
    const afterLate = await harness.store.readTrusted({
      runId: searched.snapshot.runId,
    });
    expect(afterLate.outcome).toBe("found");
    if (afterLate.outcome !== "found") throw new Error("Run was not stored.");
    expect(afterLate.record.generation).toBe(generationAfterDelivery);
    expect(afterLate.record.stateRevision).toBe(delivered.snapshot.revision);
    expect(afterLate.record.stateFingerprint).toBe(
      delivered.snapshot.stateFingerprint,
    );
    expect(afterLate.record.bufferedReceipts).toEqual([]);
    const afterLateState = recordState(afterLate.record);
    if (afterLateState.mode !== "find") throw new Error("Expected a Find state.");
    expect(afterLateState.assessments).toHaveLength(1);
  });

  it("keeps the first buffered Find receipt across the delivery-commit to drain gap", async () => {
    const gap = storeWithDeliveryDrainGap();
    const harness = runtimeHarness(gap.store);
    const { searched } = await searchedRun(harness);
    const submission = candidateSubmission(searched.snapshot);
    harness.setNow("2026-08-10T20:00:20.000Z");
    const first = await harness.runtime.submitFindDraft(submission);

    harness.setNow("2026-08-10T20:00:30.000Z");
    const delivering = harness.runtime.mutate(
      actionFrom(
        searched.snapshot,
        "runtime-find-delivery-gap",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );
    await gap.deliveryCommitted;

    let second;
    let duringGap;
    try {
      duringGap = await gap.store.readTrusted({ runId: searched.snapshot.runId });
      expect(duringGap.outcome).toBe("found");
      if (duringGap.outcome !== "found") throw new Error("Run was not stored.");
      expect(duringGap.record.bufferedReceipts).toMatchObject([
        {
          receiptId: first.receiptId,
          requestId: submission.requestId,
          assessmentMode: "find-candidate",
        },
      ]);

      harness.setNow("2026-08-10T20:00:31.000Z");
      second = await harness.runtime.submitFindDraft(submission);
      expect(second).toMatchObject({
        disposition: "terminal",
        requestId: submission.requestId,
      });
      expect(second.receiptId).not.toBe(first.receiptId);

      const afterSecond = await gap.store.readTrusted({
        runId: searched.snapshot.runId,
      });
      expect(afterSecond).toEqual(duringGap);
    } finally {
      gap.resumeDelivery();
    }

    const delivered = await delivering;
    const state = stateFromScreen02WorkflowClientSnapshot(delivered.snapshot);
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      )?.status,
    ).toBe("completed");
    if (state.mode !== "find") throw new Error("Expected a Find state.");
    expect(state.assessments).toHaveLength(1);
    const final = await gap.store.readTrusted({ runId: searched.snapshot.runId });
    expect(final.outcome).toBe("found");
    if (final.outcome !== "found") throw new Error("Run was not stored.");
    expect(final.record.bufferedReceipts).toEqual([]);
    expect(final.record.generation).toBe(duringGap.record.generation + 1);
  });

  it("keeps the first buffered Audit receipt across the delivery-commit to drain gap", async () => {
    const gap = storeWithDeliveryDrainGap();
    const harness = runtimeHarness(gap.store);
    const { dossier } = await auditDossierRun(harness);
    const submission = auditDossierSubmission(dossier.snapshot);
    harness.setNow("2026-08-10T20:00:20.000Z");
    const first = await harness.runtime.submitAuditDraft(submission);

    harness.setNow("2026-08-10T20:00:30.000Z");
    const delivering = harness.runtime.mutate(
      actionFrom(
        dossier.snapshot,
        "runtime-audit-delivery-gap",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );
    await gap.deliveryCommitted;

    let duringGap;
    try {
      duringGap = await gap.store.readTrusted({ runId: dossier.snapshot.runId });
      expect(duringGap.outcome).toBe("found");
      if (duringGap.outcome !== "found") throw new Error("Run was not stored.");
      expect(duringGap.record.bufferedReceipts).toMatchObject([
        {
          receiptId: first.receiptId,
          requestId: submission.requestId,
          assessmentMode: "audit-dossier",
        },
      ]);

      harness.setNow("2026-08-10T20:00:31.000Z");
      const second = await harness.runtime.submitAuditDraft(submission);
      expect(second).toMatchObject({
        disposition: "terminal",
        requestId: submission.requestId,
      });
      expect(second.receiptId).not.toBe(first.receiptId);

      const afterSecond = await gap.store.readTrusted({
        runId: dossier.snapshot.runId,
      });
      expect(afterSecond).toEqual(duringGap);
    } finally {
      gap.resumeDelivery();
    }

    const delivered = await delivering;
    const state = stateFromScreen02WorkflowClientSnapshot(delivered.snapshot);
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      )?.status,
    ).toBe("completed");
    if (state.mode !== "audit") throw new Error("Expected an Audit state.");
    expect(state.dossiers).toHaveLength(1);
    const final = await gap.store.readTrusted({ runId: dossier.snapshot.runId });
    expect(final.outcome).toBe("found");
    if (final.outcome !== "found") throw new Error("Run was not stored.");
    expect(final.record.bufferedReceipts).toEqual([]);
    expect(final.record.generation).toBe(duringGap.record.generation + 1);
  });

  it("retries the same buffered receipt after a concurrent drain conflict", async () => {
    const base = new InMemoryScreen02WorkflowStore();
    let injectDrainConflict = true;
    const store: Screen02WorkflowStore = {
      create: (input) => base.create(input),
      readOpenOperation: (operationId) =>
        base.readOpenOperation(operationId),
      read: (input) => base.read(input),
      readTrusted: (input) => base.readTrusted(input),
      update: (input) => base.update(input),
      updateTrusted: async (input) => {
        if (
          injectDrainConflict &&
          input.operationKind === "drain-find"
        ) {
          injectDrainConflict = false;
          const current = await base.readTrusted({ runId: input.runId });
          if (current.outcome === "not-found") {
            return { outcome: "not-found" };
          }
          return {
            outcome: "conflict",
            record: current.record,
            current: {
              generation: current.record.generation,
              revision: current.record.stateRevision,
              stateFingerprint: current.record.stateFingerprint,
            },
          };
        }
        return base.updateTrusted(input);
      },
      retire: (input) => base.retire(input),
      cleanupExpired: (at) => base.cleanupExpired(at),
      nextExpirationAt: () => base.nextExpirationAt(),
    };
    const harness = runtimeHarness(store);
    const { searched } = await searchedRun(harness);
    const submission = candidateSubmission(searched.snapshot);
    harness.setNow("2026-08-10T20:00:20.000Z");
    await harness.runtime.submitFindDraft(submission);

    harness.setNow("2026-08-10T20:00:30.000Z");
    const delivered = await harness.runtime.mutate(
      actionFrom(
        searched.snapshot,
        "runtime-deliver-after-drain-conflict",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );

    expect(injectDrainConflict).toBe(false);
    const state = stateFromScreen02WorkflowClientSnapshot(delivered.snapshot);
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      )?.status,
    ).toBe("completed");
    const stored = await store.readTrusted({ runId: searched.snapshot.runId });
    expect(stored.outcome).toBe("found");
    if (stored.outcome !== "found") throw new Error("Run was not stored.");
    expect(stored.record.bufferedReceipts).toEqual([]);
  });

  it("applies a signed receipt immediately after canonical delivery", async () => {
    const { harness, searched } = await searchedRun();
    expect(searched.snapshot.assessmentBatch).toMatchObject({
      mode: "find",
      requiredTool: "submit_screen02_find_assessment_draft_v021",
    });
    const submission = candidateSubmission(searched.snapshot);
    harness.setNow("2026-08-10T20:00:20.000Z");
    const delivered = await harness.runtime.mutate(
      actionFrom(
        searched.snapshot,
        "runtime-deliver-first",
        "assessment-delivery",
        { requestIds: [submission.requestId], delivered: true },
      ),
    );

    harness.setNow("2026-08-10T20:00:30.000Z");
    const notice = await harness.runtime.submitFindDraft(submission);

    expect(notice).toMatchObject({
      disposition: "apply",
      requestId: submission.requestId,
    });
    const trusted = await harness.store.readTrusted({
      runId: searched.snapshot.runId,
    });
    expect(trusted.outcome).toBe("found");
    if (trusted.outcome !== "found") throw new Error("Run was not stored.");
    expect(trusted.record.stateRevision).toBeGreaterThan(
      delivered.snapshot.revision,
    );
    const state = recordState(trusted.record);
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === submission.requestId,
      ),
    ).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({
          status: "message-delivered",
          actor: "chatgpt-host",
          note: SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    if (state.mode !== "find") throw new Error("Expected a Find state.");
    expect(state.assessments).toHaveLength(1);
    expect(trusted.record.bufferedReceipts).toEqual([]);
  });
});
