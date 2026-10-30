import { describe, expect, it, vi } from "vitest";

import { fingerprintHostReasoningValue } from "../../src/core/host-reasoning-task";
import {
  buildScreen02SearchFunnel,
} from "../../src/core/screen02-find-discovery";
import { qualifyScreen02FindProposal } from "../../src/core/screen02-qualification";
import {
  encodeScreen02FindWorkflowStateEnvelope,
  restoreScreen02FindWorkflowStateEnvelope,
} from "../../src/core/screen02-workflow-envelope";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  requireScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import type { Screen02FindProposal } from "../../src/core/screen02-types";
import {
  SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION,
  buildScreen02RetainedResultBinding,
  isScreen02HostReviewApplication,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  buildScreen03StateFromResearch,
  fingerprintScreen03Value,
  refreshScreen03StateFromResearch,
  type Screen03ResearchPacket,
  type Screen03SupportStatus,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import { SHOCKAUDIT_VERSION } from "../../src/version";
import {
  HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
  HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
  HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
  SCREEN02_SEARCH_REVIEW_SUBMISSION_SCHEMA_VERSION,
  SCREEN03_EVIDENCE_MAPPING_SUBMISSION_SCHEMA_VERSION,
  SCREEN03_OVERVIEW_SUBMISSION_SCHEMA_VERSION,
  screen02SearchReviewTaskFactsSchema,
  screen03EvidenceMappingTaskFactsSchema,
  screen03OverviewProposalSchema,
  type HostReasoningPrepareInput,
} from "../../src/worker/host-reasoning-task-runtime";
import {
  HostReasoningTaskStore,
  InMemoryHostReasoningTaskStoreBackend,
} from "../../src/worker/host-reasoning-task-store";
import {
  createHostReasoningWorkflowRuntime,
  fingerprintScreen03HostEvidenceApplicationBinding,
  screen02CanonicalCandidateReviewInfluenceById,
  screen03HostClaimGroupId,
  screen03HostSelectedEventId,
  type HostReasoningWorkflowRuntimeOptions,
} from "../../src/worker/host-reasoning-task-workflow";
import {
  createScreen02WorkflowStoreIdentity,
  DurableObjectScreen02WorkflowStore,
  InMemoryScreen02WorkflowStore,
  type Screen02WorkflowStore,
} from "../../src/worker/screen02-workflow-store";
import {
  DurableObjectScreen03WorkflowStore,
  InMemoryScreen03WorkflowStore,
  type Screen03WorkflowStore,
  type Screen03WorkflowStoreRecord,
} from "../../src/worker/screen03-workflow-store";
import {
  buildFindFactsState,
  buildReadyFindState,
  workflowManifest,
  workflowSource,
} from "../core/screen02-workflow-fixtures";

const signing = {
  keyId: "host-workflow-test-key",
  key: "0123456789abcdef0123456789abcdef",
};
const title = "General Data Protection Regulation";
const sourceId = "host-evidence-source";
const passageId = "host-evidence-passage";

function researchPacket(
  eventFingerprint: string,
  support: Screen03SupportStatus,
  passageText = `Canonical title: ${title}.`,
): Screen03ResearchPacket {
  const researchedAt = "2026-08-09T18:10:01.000Z";
  return {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt,
    upstreamEventFingerprint: eventFingerprint,
    coverage: {
      queries: [{
        id: "host-workflow-query",
        query: "official regulation identity",
        purpose: "Verify the selected event identity from an official field.",
        returnedEvidenceIds: [sourceId],
      }],
      channels: [{
        channel: "official-primary",
        status: "searched",
        note: "The official record was reviewed.",
        retrievedAt: researchedAt,
      }],
      routes: ["official-record"],
      stages: ["identity"],
      languages: ["en"],
      authorityTiers: [1],
      gaps: [],
      recordsReviewed: 1,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after the bounded official identity field is recorded.",
        status: "met",
        note: "The bounded fixture reached its declared identity target.",
      },
      outcomeValuesInspected: false,
    },
    evidence: [{
      id: sourceId,
      sourceId,
      title: "Official regulation record",
      locator: "https://official.example.test/regulation",
      publisher: "Official authority",
      publishedDate: "2016-05-04",
      retrievedAt: researchedAt,
      authorityTier: 1,
      channel: "official-primary",
      contentFingerprint: fingerprintScreen03Value(passageText),
      language: "en",
      status: "retrieved",
      passages: [{
        id: passageId,
        number: 1,
        text: passageText,
        locator: "Official title field",
        basis: "official-record-field",
        officialField: "canonical-title",
      }],
    }],
    proposals: {
      identity: [{
        id: "host-canonical-title-claim",
        group: "identity",
        label: "Canonical title",
        value: title,
        critical: true,
        reviewStatus: "proposed",
        editedValue: null,
        support,
        sourceIds: [sourceId],
        passageIds: [passageId],
        uncertainty: support === "direct"
          ? null
          : "The proposed source link still requires fixed validation.",
      }],
      overview: [],
      timeline: [],
      component: [],
      eligibility: [],
      amendment: [],
      requiredVariable: [],
    },
    contradictions: [],
    outcomeValuesInspected: false,
  };
}

function qualifiedScreen02HostParent(runId: string): Screen02FindState {
  const raw = structuredClone(buildFindFactsState());
  raw.runId = runId;
  const originalSource = raw.sources[0];
  if (!originalSource) throw new Error("Expected one official source fixture.");
  const { sourceFingerprint: _sourceFingerprint, ...sourceFacts } = originalSource;
  const sourceWithEvidence = {
    ...sourceFacts,
    evidenceText:
      "The General Data Protection Regulation (Regulation (EU) 2016/679) requires covered U.S. publicly listed technology firms that offer goods or services to, or monitor, people in the European Union to change personal-data processing and disclosure practices beginning on 2018-05-25.",
  };
  raw.sources[0] = {
    ...sourceWithEvidence,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceWithEvidence),
  };
  const prior = raw.candidates[0]!;
  const description = {
    ...prior.description,
    text:
      "The final regulation requires covered public technology firms to change personal-data processing and disclosure practices beginning in 2018.",
  };
  const proposal: Screen02FindProposal = {
    id: prior.candidateId,
    mode: "find",
    kind: "event",
    title: prior.identity.canonicalTitle,
    description: description.text,
    nativeIdentity: {
      formalIdentifier: prior.identity.formalIdentifier,
      issuer: prior.identity.issuer,
      issuingJurisdiction: prior.identity.issuingJurisdiction,
      status: prior.identity.status,
    },
    event: {
      displayName: prior.identity.canonicalTitle,
      eventDate: prior.dateLeads[0]?.date ?? "2018-05-25",
      eventFamily: raw.screen01Baseline.scopeContract.eventFamily,
      geographies: ["United States"],
      populations: ["Covered U.S. publicly listed technology firms"],
    },
    origin: prior.origin,
    provisionalDates: [prior.dateLeads[0]?.date ?? "2018-05-25"],
    affectedPopulation: "Covered U.S. publicly listed technology firms",
    requiredVariables: [...prior.apparentExposureVariables],
    outcomeLink: {
      text:
        "A preliminary privacy-compliance pathway may matter for innovation, subject to Screen 3 verification.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [...prior.limitations],
    reasons: ["Retained by the deterministic host-review callback fixture."],
    sources: raw.sources
      .filter((source) => prior.sourceIds.includes(source.id))
      .map((source) => ({
        id: source.id,
        title: source.title,
        locator: source.locator,
        publisher: source.publisher,
        publishedDate: source.publishedDate,
        authorityTier: source.authorityTier,
        channel: source.channel,
        evidenceText: source.evidenceText,
      })),
  };
  const qualification = qualifyScreen02FindProposal(
    proposal,
    structuredClone(raw.screen01Baseline) as unknown as Parameters<
      typeof qualifyScreen02FindProposal
    >[1],
    {
      scopeFingerprint: raw.screen01Fingerprint,
      studyProfile: raw.relevanceProfile ?? undefined,
    },
  );
  if (!qualification.eligible) {
    throw new Error(
      `Expected the host-review fixture to qualify: ${qualification.exclusionCodes.join(", ")}`,
    );
  }
  const {
    candidateFingerprint: _priorFingerprint,
    ...candidateFacts
  } = {
    ...prior,
    description,
    qualification,
  };
  raw.candidates[0] = {
    ...candidateFacts,
    candidateFingerprint: fingerprintScreen02WorkflowValue(candidateFacts),
  };
  for (const set of raw.candidateSets) {
    const retained = set.manifest.retainedResultBinding?.results.find(
      (result) => result.snapshotId === prior.candidateSnapshotId,
    );
    if (retained) retained.qualificationLane = qualification.lane;
    set.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(set);
  }
  return requireScreen02FindState(raw);
}

async function deterministicHostDiscovery(
  state: Screen02FindState,
  input: Parameters<
    HostReasoningWorkflowRuntimeOptions["discoverScreen02Find"]
  >[1],
) {
  const prior = state.candidates.find((candidate) =>
    candidate.candidateId === "gdpr"
  );
  if (!prior?.qualification?.eligible) {
    throw new Error("Expected the reviewed candidate to remain fixed-qualified.");
  }
  const activeSet = state.candidateSets.find((set) =>
    set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId
  );
  if (!activeSet) throw new Error("Expected the active reviewed candidate pool.");
  const source = workflowSource(
    `host-verified-official:${input.searchRoundId}`,
    {
      title: "Verified GDPR official text",
      locator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
      publisher: "Official Journal of the European Union",
      publishedDate: "2016-05-04",
      retrievedAt: input.at,
      evidenceText:
        "Regulation (EU) 2016/679 applies from 25 May 2018 and establishes personal-data obligations relevant to covered technology firms.",
    },
  );
  const sourceIds = [...new Set([...prior.sourceIds, source.id])];
  const {
    candidateFingerprint: _priorFingerprint,
    qualification: _priorQualification,
    ...priorFacts
  } = prior;
  const eventDate = prior.dateLeads[0]?.date;
  if (!eventDate) {
    throw new Error("Expected the reviewed candidate date lead.");
  }
  const descriptionText =
    "The verified official record retains the GDPR candidate and its source-backed technology-firm relevance for deterministic comparison.";
  const candidateFacts = {
    ...structuredClone(priorFacts),
    candidateSnapshotId: `${prior.candidateId}:${input.searchRoundId}`,
    searchRoundId: input.searchRoundId,
    description: {
      ...structuredClone(prior.description),
      id: `${prior.candidateId}:description:${input.searchRoundId}`,
      sourceIds,
      text: descriptionText,
    },
    dateLeads: prior.dateLeads.map((lead, index) => ({
      ...structuredClone(lead),
      id: `${prior.candidateId}:date-${index + 1}:${input.searchRoundId}`,
      sourceIds,
    })),
    broadCoverage: prior.broadCoverage.map((claim, index) => ({
      ...structuredClone(claim),
      id: `${prior.candidateId}:coverage-${index + 1}:${input.searchRoundId}`,
      sourceIds,
    })),
    sourceIds,
    recordedAt: input.at,
  };
  const population = state.screen01Baseline.scopeContract.population;
  const proposal: Screen02FindProposal = {
    id: candidateFacts.candidateId,
    mode: "find",
    kind: "event",
    title: candidateFacts.identity.canonicalTitle,
    description: candidateFacts.description.text,
    nativeIdentity: {
      formalIdentifier: candidateFacts.identity.formalIdentifier,
      issuer: candidateFacts.identity.issuer,
      issuingJurisdiction: candidateFacts.identity.issuingJurisdiction,
      status: candidateFacts.identity.status,
    },
    event: {
      displayName: candidateFacts.identity.canonicalTitle,
      eventDate,
      eventFamily: state.screen01Baseline.scopeContract.eventFamily,
      geographies: [state.screen01Baseline.scopeContract.geography],
      populations: [population],
    },
    origin: candidateFacts.origin,
    provisionalDates: candidateFacts.dateLeads.map((lead) => lead.date),
    affectedPopulation: population,
    requiredVariables: [...candidateFacts.apparentExposureVariables],
    outcomeLink: {
      text:
        "A preliminary privacy-compliance pathway may matter for innovation, subject to Screen 3 verification.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [...candidateFacts.limitations],
    reasons: [
      "Retained by the deterministic host-review callback fixture after official-source retrieval.",
    ],
    sources: [...state.sources, source]
      .filter((entry) => sourceIds.includes(entry.id))
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        locator: entry.locator,
        publisher: entry.publisher,
        publishedDate: entry.publishedDate,
        authorityTier: entry.authorityTier,
        channel: entry.channel,
        retrievedAt: entry.retrievedAt,
        evidenceText: entry.evidenceText,
      })),
  };
  const qualification = qualifyScreen02FindProposal(
    proposal,
    structuredClone(state.screen01Baseline) as unknown as Parameters<
      typeof qualifyScreen02FindProposal
    >[1],
    {
      scopeFingerprint: state.screen01Fingerprint,
      lane: prior.qualification.lane,
      studyProfile: input.queryPlanning.qualificationProfile,
      candidateReviewInfluenceById:
        input.queryPlanning.candidateReviewInfluenceById,
    },
  );
  if (!qualification.eligible) {
    throw new Error(
      `Expected the host successor fixture to qualify: ${qualification.exclusionCodes.join(", ")}`,
    );
  }
  const candidate = { ...candidateFacts, qualification };
  const manifest = workflowManifest(input.exactRequest);
  const submittedTerms = [...input.queryPlanning.queryTerms];
  const executedTerms = submittedTerms.slice(0, 4);
  const officialSourceLeadAudit = input.queryPlanning.officialSourceLeads.map(
    (lead, index) => ({
      leadId: `host-lead-${index + 1}`,
      leadFingerprint: fingerprintScreen02WorkflowValue({
        schemaVersion: "screen-02-host-official-source-lead-v1",
        lead,
      }),
      contentFingerprint: fingerprintScreen02WorkflowValue(
        source.evidenceText,
      ),
      verificationStatus: "verified" as const,
      resultingSourceId: source.id,
      resultingSourceFingerprint: source.sourceFingerprint,
      resultingSourceStatus: "persisted" as const,
    }),
  );
  return {
    sources: [source],
    candidates: [candidate],
    manifest: {
      ...manifest,
      queryMatrix: manifest.queryMatrix.map((query) => ({
        ...query,
        returnedRecordIds: [candidate.candidateId],
      })),
      channels: manifest.channels.map((channel) => ({
        ...channel,
        retrievedAt: input.at,
      })),
      stoppingRule: {
        rule: "Stop after the bounded deterministic callback fixture returns.",
        status: "met" as const,
        note:
          "The callback fixture retained the reviewed event with one verified official source.",
      },
      funnel: buildScreen02SearchFunnel({
        sourceRecordsRetrieved: 1,
        uniqueEventLeads: 1,
        qualifications: [qualification],
        displayedCandidates: 1,
        hostContribution:
          executedTerms.length + officialSourceLeadAudit.length,
      }),
      retainedResultBinding: buildScreen02RetainedResultBinding(
        "find",
        {
          sourceRecordsRetrieved: 1,
          uniqueEventLeads: 1,
        },
        [{
          recordId: candidate.candidateId,
          snapshotId: candidate.candidateSnapshotId,
          sourceIds,
          qualificationLane: qualification.lane,
          origins: [{
            kind: "prior-result",
            retrievalLane: "host-review-carry-forward",
            evidenceRole: "identity",
            producerRecordId: prior.candidateId,
            priorCandidateSetSnapshotId: activeSet.candidateSetSnapshotId,
            priorCandidateSnapshotId: prior.candidateSnapshotId,
            sourceIds: [...prior.sourceIds],
          }, {
            kind: "query-result",
            retrievalLane: "host-official",
            evidenceRole: "support",
            producerRecordId: candidate.candidateId,
            queryId: "query-1",
            returnedRecordIds: [candidate.candidateId],
            sourceIds: [source.id],
          }],
        }],
      ),
      retrievedAt: input.at,
    },
    verifiedOfficialSourceLeadCount: officialSourceLeadAudit.length,
    hostQueryExecution: {
      submittedTerms,
      plannedTerms: executedTerms,
      executedTerms,
      skipped: submittedTerms.slice(4).map((term) => ({
        term,
        reason: "query-cap" as const,
      })),
    },
    officialSourceLeadAudit,
  };
}

type WorkflowHarness = Awaited<ReturnType<typeof workflowHarness>>;

function screen03ReadInterleavingStore() {
  const base = new InMemoryScreen03WorkflowStore();
  let remainingReads = 0;
  let interleave: ((record: Screen03WorkflowStoreRecord) => Promise<void>) |
    null = null;
  const store: Screen03WorkflowStore = {
    read: async (runId) => {
      const read = await base.read(runId);
      if (interleave && read.outcome === "found") {
        remainingReads -= 1;
        if (remainingReads === 0) {
          const run = interleave;
          interleave = null;
          await run(read.record);
        }
      }
      return read;
    },
    readBySafeRunRef: (safeRunRef) => base.readBySafeRunRef(safeRunRef),
    createOrReplace: (input) => base.createOrReplace(input),
    update: (input) => base.update(input),
    retire: (runId) => base.retire(runId),
    cleanupExpired: (at, limit) => base.cleanupExpired(at, limit),
    nextExpirationAt: () => base.nextExpirationAt(),
  };
  return {
    base,
    store,
    arm(
      reads: number,
      callback: (record: Screen03WorkflowStoreRecord) => Promise<void>,
    ) {
      remainingReads = reads;
      interleave = callback;
    },
  };
}

async function workflowHarness(input: {
  support?: Screen03SupportStatus;
  passageText?: string;
  activeContradiction?: boolean;
  screen02Store?: Screen02WorkflowStore;
  screen03Store?: Screen03WorkflowStore;
  taskStore?: HostReasoningTaskStore;
  discoverScreen02Find?:
    HostReasoningWorkflowRuntimeOptions["discoverScreen02Find"];
} = {}) {
  const identity = createScreen02WorkflowStoreIdentity();
  const rawParent = structuredClone(buildReadyFindState());
  rawParent.runId = identity.runId;
  delete rawParent.shockGlances;
  const parentState = requireScreen02FindState(rawParent);
  const screen02Store = input.screen02Store ??
    new InMemoryScreen02WorkflowStore();
  const parentCreated = await screen02Store.create({
    ...identity,
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(parentState),
  });
  if (parentCreated.outcome !== "created") {
    throw new Error("Expected a canonical Screen 2 parent fixture.");
  }

  const handoff = buildScreen02WorkflowHandoff(
    parentState,
    SHOCKAUDIT_VERSION,
    "2026-08-09T18:10:00.000Z",
  );
  const packet = researchPacket(
    handoff.integrity.eventFingerprint,
    input.support ?? "indirect",
    input.passageText,
  );
  if (input.activeContradiction) {
    packet.proposals.identity[0]!.support = "conflicting";
    packet.proposals.identity[0]!.uncertainty =
      "The active official records conflict on this identity field.";
    packet.contradictions = [{
      id: "host-active-contradiction",
      kind: "source-conflict",
      proposalIds: ["host-canonical-title-claim"],
      summary: "The active records conflict on the canonical title.",
      status: "unresolved",
      resolution: null,
    }];
  }
  const screen03State = buildScreen03StateFromResearch(
    handoff,
    packet,
    "2026-08-09T18:10:02.000Z",
  );
  const screen03Store = input.screen03Store ??
    new InMemoryScreen03WorkflowStore();
  const childCreated = await screen03Store.createOrReplace({
    parentRunId: parentCreated.record.runId,
    parentStateFingerprint: parentCreated.record.stateFingerprint,
    handoffProducerAppVersion: SHOCKAUDIT_VERSION,
    parentGuard: {
      runId: parentCreated.record.runId,
      generation: parentCreated.record.generation,
      revision: parentCreated.record.stateRevision,
      stateFingerprint: parentCreated.record.stateFingerprint,
      expiresAt: parentCreated.record.expiresAt,
    },
    state: screen03State,
    expiresAt: parentCreated.record.expiresAt,
  });
  if (childCreated.outcome !== "created") {
    throw new Error("Expected a canonical Screen 3 child fixture.");
  }

  const taskStore = input.taskStore ?? new HostReasoningTaskStore(
    new InMemoryHostReasoningTaskStoreBackend(),
  );
  let now = "2026-08-09T18:10:03.000Z";
  let id = 0;
  const runtime = createHostReasoningWorkflowRuntime({
    taskStore,
    screen02Store,
    screen03Store,
    signing,
    now: () => now,
    createId: (kind) => `${kind}-${++id}`,
    discoverScreen02Find: input.discoverScreen02Find ?? (async () => {
      throw new Error("Unexpected Screen 2 discovery in this test.");
    }),
  });
  return {
    identity,
    parentState,
    parentRecord: parentCreated.record,
    handoff,
    initialScreen03State: screen03State,
    initialScreen03Record: childCreated.record,
    screen02Store,
    screen03Store,
    taskStore,
    runtime,
    setNow(value: string) {
      now = value;
    },
  };
}

async function screen02HostHarness(input: {
  screen02Store?: Screen02WorkflowStore;
  screen03Store?: Screen03WorkflowStore;
  withStaleScreen03Child?: boolean;
  discoverScreen02Find:
    HostReasoningWorkflowRuntimeOptions["discoverScreen02Find"];
}) {
  const identity = createScreen02WorkflowStoreIdentity();
  const initialState = qualifiedScreen02HostParent(identity.runId);
  const screen02Store = input.screen02Store ??
    new InMemoryScreen02WorkflowStore();
  const created = await screen02Store.create({
    ...identity,
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(initialState),
  });
  if (created.outcome !== "created") {
    throw new Error("Expected a canonical Screen 2 host-review fixture.");
  }
  const taskStore = new HostReasoningTaskStore(
    new InMemoryHostReasoningTaskStoreBackend(),
  );
  const screen03Store = input.screen03Store ??
    new InMemoryScreen03WorkflowStore();
  let staleScreen03State: Screen03VerificationState | null = null;
  if (input.withStaleScreen03Child) {
    const continuedParentRaw = structuredClone(buildReadyFindState());
    continuedParentRaw.runId = identity.runId;
    delete continuedParentRaw.shockGlances;
    const continuedParent = requireScreen02FindState(continuedParentRaw);
    const staleHandoff = buildScreen02WorkflowHandoff(
      continuedParent,
      SHOCKAUDIT_VERSION,
      "2026-08-09T18:10:00.000Z",
    );
    const staleChild = buildScreen03StateFromResearch(
      staleHandoff,
      researchPacket(staleHandoff.integrity.eventFingerprint, "indirect"),
      "2026-08-09T18:10:02.000Z",
    );
    staleScreen03State = staleChild;
    const childCreated = await screen03Store.createOrReplace({
      parentRunId: created.record.runId,
      parentStateFingerprint: created.record.stateFingerprint,
      handoffProducerAppVersion: SHOCKAUDIT_VERSION,
      parentGuard: {
        runId: created.record.runId,
        generation: created.record.generation,
        revision: created.record.stateRevision,
        stateFingerprint: created.record.stateFingerprint,
        expiresAt: created.record.expiresAt,
      },
      state: staleChild,
      expiresAt: created.record.expiresAt,
    });
    if (childCreated.outcome !== "created") {
      throw new Error("Expected a stale Screen 3 child fixture.");
    }
  }
  let now = "2026-08-09T18:10:03.000Z";
  let id = 0;
  const runtime = createHostReasoningWorkflowRuntime({
    taskStore,
    screen02Store,
    screen03Store,
    signing,
    now: () => now,
    createId: (kind) => `screen02-host-${kind}-${++id}`,
    createWorkflowId: (kind) => `screen02-host-${kind}-${++id}`,
    discoverScreen02Find: input.discoverScreen02Find,
  });
  return {
    identity,
    initialState,
    initialRecord: created.record,
    screen02Store,
    screen03Store,
    taskStore,
    runtime,
    staleScreen03State,
    setNow(value: string) {
      now = value;
    },
  };
}

type Screen02HostHarness = Awaited<ReturnType<typeof screen02HostHarness>>;

function staleScreen03PrepareInput(
  target: Screen02HostHarness,
  taskType: "screen03-evidence-mapping" | "screen03-overview-improvement",
): HostReasoningPrepareInput {
  const state = target.staleScreen03State;
  if (!state) throw new Error("Expected a stale Screen 3 child fixture.");
  return {
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: `prepare-stale-${taskType}`,
    taskType,
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    candidatePoolId: null,
    selectedEventId: screen03HostSelectedEventId(state),
    claimGroupId: taskType === "screen03-evidence-mapping"
      ? screen03HostClaimGroupId(state)
      : null,
    expectedScopeFingerprint: target.initialState.screen01Fingerprint,
    expectedCandidatePoolFingerprint: null,
    expectedEventFingerprint: state.upstream.eventFingerprint,
    retryOfTaskId: null,
  };
}

async function prepareDeliveredScreen02HostReview(target: Screen02HostHarness) {
  const active = target.initialState.candidateSets.find((set) =>
    set.candidateSetSnapshotId === target.initialState.activeCandidateSetSnapshotId
  );
  if (!active) throw new Error("Expected an active Screen 2 candidate pool.");
  const prepared = await target.runtime.prepare({
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: "prepare-screen02-review-callback",
    taskType: "screen02-search-review",
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    candidatePoolId: active.candidateSetSnapshotId,
    selectedEventId: null,
    claimGroupId: null,
    expectedScopeFingerprint: target.initialState.screen01Fingerprint,
    expectedCandidatePoolFingerprint: active.candidateSetFingerprint,
    expectedEventFingerprint: null,
    retryOfTaskId: null,
  });
  target.setNow("2026-08-09T18:10:04.000Z");
  await target.runtime.recordMessageDelivery({
    schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
    operationId: "deliver-screen02-review-callback",
    taskId: prepared.taskId,
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    channel: "ui/message",
    accepted: true,
    requestedAt: "2026-08-09T18:10:03.500Z",
    resolvedAt: "2026-08-09T18:10:04.000Z",
    failureCode: null,
    failureExplanation: null,
  });
  target.setNow("2026-08-09T18:10:05.000Z");
  return prepared;
}

function screen02HostReviewSubmission(
  target: Screen02HostHarness,
  prepared: Awaited<ReturnType<Screen02HostHarness["runtime"]["prepare"]>>,
) {
  const candidate = target.initialState.candidates.find(
    (item) => item.qualification?.eligible === true,
  );
  if (!candidate?.qualification) {
    throw new Error("Expected one fixed-qualified Screen 2 candidate.");
  }
  const sourceId = candidate.sourceIds[0]!;
  return {
    schemaVersion: SCREEN02_SEARCH_REVIEW_SUBMISSION_SCHEMA_VERSION,
    taskId: prepared.taskId,
    capability: prepared.privateModelContext.submission.capability,
    profileAdditions: {
      services: ["orbital agronomy"],
    },
    candidateReviews: [{
      candidateId: candidate.candidateSnapshotId,
      proposedClass: candidate.qualification.classification,
      industryBridge:
        "The active source-backed description directly names technology firms.",
      profileTermsUsed: ["technology"],
      sourceIdsUsed: [sourceId],
      sourceSpansUsed: [{ sourceId, text: "technology" }],
      sampleConnection:
        "Covered public technology firms overlap the confirmed study population.",
      outcomePathway:
        "Privacy compliance may change engineering inputs without asserting outcomes.",
      mainMismatchOrUncertainty:
        "Firm-level territorial exposure still requires deterministic verification.",
      needsFollowUpRetrieval: true,
      rankingAdjustment: 2,
    }],
    followUpQueries: ["official GDPR technology-firm coverage"],
    officialSourceLeads: [{
      url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
      title: "General Data Protection Regulation",
      issuingBody: "European Parliament and Council",
      jurisdiction: "European Union",
      reasonForRetrieval:
        "Retrieve bounded official text for the existing candidate.",
      candidateIdIfKnown: candidate.candidateSnapshotId,
    }],
    conciseRationale:
      "The review adds bounded vocabulary, one source lead, and a small rank adjustment.",
    hostModel: "host_model_not_exposed" as const,
  };
}

function hostOnlyServiceProposal(
  state: Screen02FindState,
  service: string,
): Screen02FindProposal {
  const title = "Federal Orbital Agronomy Licensing Rule";
  return {
    id: "host-only-service-rule",
    mode: "find",
    kind: "event",
    title,
    description:
      `The final rule requires public ${service} provider firms to change licensing controls beginning in 2020.`,
    nativeIdentity: {
      formalIdentifier: "RULE-HOST-ONLY-2020",
      issuer: "Example Federal Licensing Authority",
      issuingJurisdiction: "United States",
      status: "Final rule",
    },
    event: {
      displayName: title,
      eventDate: "2020-01-01",
      eventFamily: state.screen01Baseline.scopeContract.eventFamily,
      geographies: ["United States"],
      populations: [`Public ${service} provider firms`],
    },
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: `Public ${service} provider firms`,
    requiredVariables: [
      "Covered-provider status",
      "Effective date",
      "Pre-event exposure indicator",
    ],
    outcomeLink: {
      text:
        "Licensing compliance may change firm inputs, without establishing an outcome effect.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: ["Firm-level coverage requires Screen 3 verification."],
    reasons: ["Returned by a bounded ordinary-search fixture."],
    sources: [{
      id: "host-only-service-source",
      title: "Official licensing rule record",
      locator: "https://official.example.test/host-only-service-rule",
      publisher: "Example Federal Licensing Authority",
      publishedDate: "2020-01-01",
      authorityTier: 1,
      channel: "official-primary",
      evidenceText:
        `${title}. Issuing jurisdiction: United States. The final rule requires public ${service} provider firms to change licensing controls beginning in 2020. Effective date: 2020-01-01.`,
    }],
  };
}

async function readScreen02HostState(target: Screen02HostHarness) {
  const read = await target.screen02Store.read({
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
  });
  if (read.outcome !== "authenticated") {
    throw new Error("Expected the Screen 2 host-review fixture to remain readable.");
  }
  const state = restoreScreen02FindWorkflowStateEnvelope(
    read.record.stateEnvelope,
  );
  if (!state) throw new Error("Expected a valid Screen 2 state envelope.");
  return { record: read.record, state };
}

function screen02PrepareInput(target: WorkflowHarness): HostReasoningPrepareInput {
  const active = target.parentState.candidateSets.find((set) =>
    set.candidateSetSnapshotId ===
      target.parentState.activeCandidateSetSnapshotId
  );
  if (!active) throw new Error("Expected an active Screen 2 candidate pool.");
  return {
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: "prepare-screen02-review",
    taskType: "screen02-search-review",
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    candidatePoolId: active.candidateSetSnapshotId,
    selectedEventId: null,
    claimGroupId: null,
    expectedScopeFingerprint: target.parentState.screen01Fingerprint,
    expectedCandidatePoolFingerprint: active.candidateSetFingerprint,
    expectedEventFingerprint: null,
    retryOfTaskId: null,
  };
}

function screen03PrepareInput(
  target: WorkflowHarness,
  taskType: "screen03-evidence-mapping" | "screen03-overview-improvement",
): HostReasoningPrepareInput {
  const state = target.initialScreen03State;
  return {
    schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
    operationId: `prepare-${taskType}`,
    taskType,
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    candidatePoolId: null,
    selectedEventId: screen03HostSelectedEventId(state),
    claimGroupId: taskType === "screen03-evidence-mapping"
      ? screen03HostClaimGroupId(state)
      : null,
    expectedScopeFingerprint: target.parentState.screen01Fingerprint,
    expectedCandidatePoolFingerprint: null,
    expectedEventFingerprint: state.upstream.eventFingerprint,
    retryOfTaskId: null,
  };
}

async function markMessageDelivered(
  target: WorkflowHarness,
  taskId: string,
  operationId: string,
) {
  target.setNow("2026-08-09T18:10:04.000Z");
  await target.runtime.recordMessageDelivery({
    schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
    operationId,
    taskId,
    runId: target.identity.runId,
    accessToken: target.identity.accessToken,
    channel: "ui/message",
    accepted: true,
    requestedAt: "2026-08-09T18:10:03.500Z",
    resolvedAt: "2026-08-09T18:10:04.000Z",
    failureCode: null,
    failureExplanation: null,
  });
}

async function refreshAuthoritativePassage(
  target: WorkflowHarness,
  passageText: string,
) {
  const current = await target.screen03Store.read(target.identity.runId);
  if (current.outcome !== "found") throw new Error("Expected Screen 3 state.");
  const refreshed = refreshScreen03StateFromResearch(
    current.record.state,
    target.handoff,
    researchPacket(
      target.handoff.integrity.eventFingerprint,
      "indirect",
      passageText,
    ),
    "2026-08-09T18:10:04.500Z",
  );
  const update = await target.screen03Store.update({
    parentRunId: target.parentRecord.runId,
    parentStateFingerprint: target.parentRecord.stateFingerprint,
    handoffProducerAppVersion: SHOCKAUDIT_VERSION,
    parentGuard: {
      runId: target.parentRecord.runId,
      generation: target.parentRecord.generation,
      revision: target.parentRecord.stateRevision,
      stateFingerprint: target.parentRecord.stateFingerprint,
      expiresAt: target.parentRecord.expiresAt,
    },
    expected: {
      generation: current.record.generation,
      revision: current.record.stateRevision,
      stateFingerprint: current.record.stateFingerprint,
    },
    state: refreshed,
    expiresAt: target.parentRecord.expiresAt,
  });
  expect(update.outcome).toBe("updated");
}

function titleMappingSubmission(
  target: WorkflowHarness,
  prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
) {
  const claim = target.initialScreen03State.proposals.identity[0]!;
  const frozenClaims = screen03EvidenceMappingTaskFactsSchema.parse(
    prepared.privateModelContext.boundedFacts,
  ).claims;
  return {
    schemaVersion: SCREEN03_EVIDENCE_MAPPING_SUBMISSION_SCHEMA_VERSION,
    taskId: prepared.taskId,
    capability: prepared.privateModelContext.submission.capability,
    mappings: [{
      claimId: claim.id,
      passageIds: [passageId],
      quotedSpans: [{ passageId, text: claim.value }],
      supportExplanation:
        "The exact official title field contains the proposed title.",
      proposedSupportStatus: "direct",
    }],
    unmappedClaimIds: frozenClaims
      .map((candidate) => candidate.claimId)
      .filter((claimId) => claimId !== claim.id),
    conflictClaimIds: [],
    conciseRationale:
      "The mapping uses one unique exact substring from the active official field.",
    hostModel: "host_model_not_exposed" as const,
  };
}

async function submitTitleMapping(
  target: WorkflowHarness,
  prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
) {
  target.setNow("2026-08-09T18:10:05.000Z");
  return target.runtime.submitScreen03EvidenceMapping(
    titleMappingSubmission(target, prepared),
  );
}

function noChangeMappingSubmission(
  prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
  disposition: "unmapped" | "conflict" = "unmapped",
) {
  const claimIds = screen03EvidenceMappingTaskFactsSchema.parse(
    prepared.privateModelContext.boundedFacts,
  ).claims.map((claim) => claim.claimId);
  return {
    schemaVersion: SCREEN03_EVIDENCE_MAPPING_SUBMISSION_SCHEMA_VERSION,
    taskId: prepared.taskId,
    capability: prepared.privateModelContext.submission.capability,
    mappings: [],
    unmappedClaimIds: disposition === "unmapped" ? claimIds : [],
    conflictClaimIds: disposition === "conflict" ? claimIds : [],
    conciseRationale:
      "Every frozen claim is explicitly classified without changing canonical evidence links.",
    hostModel: "host_model_not_exposed" as const,
  };
}

function overviewSubmission(taskId: string, capability: string) {
  return {
    schemaVersion: SCREEN03_OVERVIEW_SUBMISSION_SCHEMA_VERSION,
    taskId,
    capability,
    summary:
      "General Data Protection Regulation is the supported canonical title of the selected regulation event. The current evidence supports the canonical title General Data Protection Regulation. The selected event type is regulation. The evidence documents the supported canonical title General Data Protection Regulation. This overview states only the supported canonical title General Data Protection Regulation. General Data Protection Regulation is the current supported canonical title.",
    keyPoints: [
      "The supported canonical title is General Data Protection Regulation.",
      "General Data Protection Regulation is the selected regulation event title.",
      "The current evidence supports the canonical title General Data Protection Regulation.",
    ],
    uncertainties: [],
    sourceIds: [sourceId],
    conciseRationale:
      "Every sentence is limited to the supplied supported identity fact.",
    hostModel: "host_model_not_exposed" as const,
  };
}

function sharedDurableStorage() {
  const records = new Map<string, unknown>();
  let tail: Promise<void> = Promise.resolve();
  const clone = <T>(value: T): T => structuredClone(value);
  const locked = async <T>(callback: () => Promise<T>) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  };
  return {
    get: (key: string) => locked(async () =>
      records.has(key) ? clone(records.get(key)) : undefined),
    put: (key: string, value: unknown) => locked(async () => {
      records.set(key, clone(value));
    }),
    delete: (key: string) => locked(async () => records.delete(key)),
    list: ({ prefix = "", limit = Number.POSITIVE_INFINITY }: {
      prefix?: string;
      limit?: number;
    }) => locked(async () => new Map(
      [...records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, limit)
        .map(([key, value]) => [key, clone(value)]),
    )),
    transaction: <T>(
      callback: (transaction: DurableObjectTransaction) => Promise<T>,
    ) => locked(async () => {
      const writes = new Map<string, unknown>();
      const deletions = new Set<string>();
      const transaction = {
        get: async (key: string) => deletions.has(key)
          ? undefined
          : writes.has(key) ? clone(writes.get(key))
          : records.has(key) ? clone(records.get(key)) : undefined,
        put: async (key: string, value: unknown) => {
          deletions.delete(key);
          writes.set(key, clone(value));
        },
        delete: async (key: string) => {
          writes.delete(key);
          deletions.add(key);
          return true;
        },
      } as unknown as DurableObjectTransaction;
      const result = await callback(transaction);
      for (const key of deletions) records.delete(key);
      for (const [key, value] of writes) records.set(key, clone(value));
      return result;
    }),
  } as unknown as DurableObjectStorage;
}

describe("host reasoning workflow integration", () => {
  it("rejects ambiguous candidate snapshot to canonical influence mappings", () => {
    const review = (
      candidateId: string,
    ): Parameters<typeof screen02CanonicalCandidateReviewInfluenceById>[1][number] => ({
      candidateId,
      proposedClass: "direct",
      industryBridge: "The exact source span names the covered industry.",
      profileTermsUsed: ["technology"],
      sourceIdsUsed: ["official-source"],
      sourceSpansUsed: [{
        sourceId: "official-source",
        text: "technology",
      }],
      sampleConnection: "The covered firms overlap the target population.",
      outcomePathway: "Compliance may change firm inputs.",
      mainMismatchOrUncertainty: "Coverage remains to be verified.",
      needsFollowUpRetrieval: true,
      rankingAdjustment: 1,
    });

    expect(() => screen02CanonicalCandidateReviewInfluenceById(
      [
        { candidateSnapshotId: "snapshot-a", candidateId: "canonical-a" },
        { candidateSnapshotId: "snapshot-a", candidateId: "canonical-b" },
      ],
      [review("snapshot-a")],
    )).toThrow("duplicate snapshot ID");
    expect(() => screen02CanonicalCandidateReviewInfluenceById(
      [
        { candidateSnapshotId: "snapshot-a", candidateId: "canonical-a" },
        { candidateSnapshotId: "snapshot-b", candidateId: "canonical-a" },
      ],
      [review("snapshot-a"), review("snapshot-b")],
    )).toThrow("same canonical candidate");
    expect(() => screen02CanonicalCandidateReviewInfluenceById(
      [{ candidateSnapshotId: "snapshot-a", candidateId: "canonical-a" }],
      [review("stale-snapshot")],
    )).toThrow("stale candidate snapshot");
  });

  it("freezes only the authentic Screen 2 coordinates and bounded private facts", async () => {
    const target = await workflowHarness();
    const input = screen02PrepareInput(target);

    await expect(target.runtime.prepare({
      ...input,
      operationId: "wrong-coordinate-operation",
      expectedCandidatePoolFingerprint:
        fingerprintHostReasoningValue("another-pool"),
    })).rejects.toMatchObject({ code: "task-coordinates-changed" });

    const prepared = await target.runtime.prepare(input);
    const facts = screen02SearchReviewTaskFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    );
    expect(facts.confirmedScope).toEqual(
      target.parentState.screen01Baseline.scopeContract,
    );
    expect(facts).not.toHaveProperty("confirmedScope.studySentence");
    expect(facts.candidates.length).toBeLessThanOrEqual(20);
    expect(facts.candidates.every((candidate) =>
      candidate.sources.length <= 6 &&
      candidate.sources.every((source) => source.passages.length <= 2)
    )).toBe(true);
    expect(
      facts.candidates.flatMap((candidate) =>
        candidate.sources.flatMap((source) => source.passages)
      ),
    ).toEqual([]);
    const privateJson = JSON.stringify(prepared.privateModelContext);
    expect(privateJson).not.toContain(target.identity.accessToken);
    expect(JSON.stringify(facts)).not.toMatch(
      /outcomeObservations|outcomeValues\s*":|rawDataset|sampleData|uploadedData/iu,
    );
    expect(prepared.privateModelContext).toMatchObject({
      sourceContentIsUntrustedData: true,
      outcomeValuesInspected: false,
      task: {
        candidatePoolId: input.candidatePoolId,
        runId: target.identity.runId,
      },
    });
  });

  it("applies one bounded Screen 2 host review and replays it without another round", async () => {
    const observedDiscovery: Array<{
      state: Screen02FindState;
      input: Parameters<
        HostReasoningWorkflowRuntimeOptions["discoverScreen02Find"]
      >[1];
    }> = [];
    const target = await screen02HostHarness({
      withStaleScreen03Child: true,
      discoverScreen02Find: async (state, input) => {
        observedDiscovery.push({
          state: structuredClone(state),
          input: structuredClone(input),
        });
        return deterministicHostDiscovery(state, input);
      },
    });
    const originalSet = target.initialState.candidateSets.find((set) =>
      set.candidateSetSnapshotId ===
        target.initialState.activeCandidateSetSnapshotId
    );
    const originalCandidate = target.initialState.candidates.find((candidate) =>
      candidate.qualification?.eligible === true
    );
    if (!originalSet || !originalCandidate) {
      throw new Error("Expected the active fixed-qualified parent fixture.");
    }
    const staleScreen03Task = await target.runtime.prepare(
      staleScreen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    expect((await target.taskStore.read(staleScreen03Task.taskId)).outcome)
      .toBe("found");
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const frozenFacts = screen02SearchReviewTaskFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    );
    const frozenPassage = frozenFacts.candidates[0]?.sources[0]?.passages[0]
      ?.text;
    const activeEvidence = target.initialState.sources.find((source) =>
      source.id === target.initialState.candidates[0]?.sourceIds[0]
    )?.evidenceText;
    expect(frozenPassage).toBeTruthy();
    expect(activeEvidence).toContain(frozenPassage);
    const submission = screen02HostReviewSubmission(target, prepared);
    expect(await target.screen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });
    const receipt = await target.runtime.submitScreen02SearchReview(submission);

    expect(receipt).toMatchObject({
      disposition: "applied",
      status: "applied",
      resultId: expect.any(String),
    });
    expect(observedDiscovery).toHaveLength(1);
    expect(observedDiscovery[0]!.state.relevanceProfile).toMatchObject({
      origin: "chatgpt-host-enriched",
      services: expect.arrayContaining(["orbital agronomy"]),
    });
    expect(observedDiscovery[0]!.input).toMatchObject({
      maximumCandidates: 10,
      queryPlanning: {
        origin: "chatgpt-host",
        queryTerms: ["official gdpr technology firm coverage"],
        requestId: prepared.taskId,
        receiptId: receipt.resultId,
        officialSourceLeads: submission.officialSourceLeads,
        rankingAdjustments: [{
          candidateId: originalCandidate.candidateId,
          adjustment: 2,
        }],
      },
    });
    expect(
      observedDiscovery[0]!.input.queryPlanning.rankingAdjustments[0]
        ?.candidateId,
    ).not.toBe(originalCandidate.candidateSnapshotId);
    expect(
      observedDiscovery[0]!.input.queryPlanning.qualificationProfile,
    ).toEqual(target.initialState.relevanceProfile);
    expect([
      ...observedDiscovery[0]!.input.queryPlanning
        .candidateReviewInfluenceById.entries(),
    ]).toEqual([[originalCandidate.candidateId, {
      proposedClass: submission.candidateReviews[0]!.proposedClass,
      industryBridge: submission.candidateReviews[0]!.industryBridge,
      profileTermsUsed: submission.candidateReviews[0]!.profileTermsUsed,
      sourceIdsUsed: submission.candidateReviews[0]!.sourceIdsUsed,
      sourceSpansUsed: submission.candidateReviews[0]!.sourceSpansUsed,
      sampleConnection: submission.candidateReviews[0]!.sampleConnection,
      outcomePathway: submission.candidateReviews[0]!.outcomePathway,
      mainMismatchOrUncertainty:
        submission.candidateReviews[0]!.mainMismatchOrUncertainty,
      needsFollowUpRetrieval:
        submission.candidateReviews[0]!.needsFollowUpRetrieval,
    }]]);

    const applied = await readScreen02HostState(target);
    expect(applied.state.candidateSets).toHaveLength(
      target.initialState.candidateSets.length + 1,
    );
    const successor = applied.state.candidateSets.find((set) =>
      set.candidateSetSnapshotId ===
        applied.state.activeCandidateSetSnapshotId
    );
    if (!successor) throw new Error("Expected a successor candidate pool.");
    const verifiedSource = applied.state.sources.find((source) =>
      source.id.startsWith("host-verified-official:")
    );
    if (!verifiedSource?.evidenceText || !target.initialState.relevanceProfile) {
      throw new Error("Expected the applied source and deterministic profile.");
    }
    const storedTask = await target.taskStore.read(prepared.taskId);
    if (storedTask.outcome !== "found" || !receipt.resultId) {
      throw new Error("Expected the applied host task and result identifier.");
    }
    const hostQueryExecution = {
      submittedTerms: ["official gdpr technology firm coverage"],
      plannedTerms: ["official gdpr technology firm coverage"],
      executedTerms: ["official gdpr technology firm coverage"],
      skipped: [],
    };
    const officialSourceLeadAudit = [{
      leadId: "host-lead-1",
      leadFingerprint: fingerprintScreen02WorkflowValue(
        {
          schemaVersion: "screen-02-host-official-source-lead-v1",
          lead: submission.officialSourceLeads[0],
        },
      ),
      contentFingerprint: fingerprintScreen02WorkflowValue(
        verifiedSource.evidenceText,
      ),
      verificationStatus: "verified" as const,
      resultingSourceId: verifiedSource.id,
      resultingSourceFingerprint: verifiedSource.sourceFingerprint,
      resultingSourceStatus: "persisted" as const,
    }];
    const rankingAdjustments = [{
      candidateId: originalCandidate.candidateId,
      adjustment: 2,
    }];
    const {
      schemaVersion: submissionSchemaVersion,
      taskId: submissionTaskId,
      capability: _capability,
      ...proposal
    } = submission;
    const expectedSubmissionFingerprint = fingerprintHostReasoningValue({
      schemaVersion: submissionSchemaVersion,
      taskId: submissionTaskId,
      sourceIdsReferenced: [originalCandidate.sourceIds[0]],
      proposal,
    });
    const expectedApplicationWithoutFingerprint = {
      schemaVersion: SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION,
      taskId: prepared.taskId,
      resultId: receipt.resultId,
      resultOrigin: "chatgpt-host" as const,
      taskInputFingerprint: fingerprintHostReasoningValue(
        prepared.privateModelContext.boundedFacts,
      ),
      submissionFingerprint: expectedSubmissionFingerprint,
      originalCandidatePoolId: originalSet.candidateSetSnapshotId,
      originalCandidatePoolFingerprint: originalSet.candidateSetFingerprint,
      successorCandidatePoolId: successor.candidateSetSnapshotId,
      priorProfileFingerprint: fingerprintScreen02WorkflowValue(
        target.initialState.relevanceProfile,
      ),
      profileAdditions: submission.profileAdditions,
      profileAdditionsFingerprint: fingerprintScreen02WorkflowValue(
        submission.profileAdditions,
      ),
      profileAdditionCount: 1,
      appliedProfileFingerprint: fingerprintScreen02WorkflowValue(
        applied.state.relevanceProfile,
      ),
      candidateReviewsFingerprint: fingerprintScreen02WorkflowValue(
        submission.candidateReviews,
      ),
      candidateReviewCount: 1,
      followUpQueriesFingerprint: fingerprintScreen02WorkflowValue(
        hostQueryExecution.submittedTerms,
      ),
      appliedAt: "2026-08-09T18:10:05.001Z",
      followUpQueryCount: 1,
      hostQueryExecution,
      hostQueryExecutionFingerprint: fingerprintScreen02WorkflowValue(
        hostQueryExecution,
      ),
      proposedOfficialSourceLeadCount: 1,
      verifiedOfficialSourceLeadCount: 1,
      officialSourceLeadsFingerprint: fingerprintScreen02WorkflowValue(
        submission.officialSourceLeads,
      ),
      officialSourceLeadAudit,
      officialSourceLeadAuditFingerprint: fingerprintScreen02WorkflowValue(
        officialSourceLeadAudit,
      ),
      rankingAdjustmentCount: 1,
      rankingAdjustments,
      rankingAdjustmentsFingerprint: fingerprintScreen02WorkflowValue(
        rankingAdjustments,
      ),
      validatedRetrievalContributionCount: 2,
      outcomeValuesInspected: false as const,
    };
    const marker = successor.manifest.hostReviewApplication;
    expect(marker).toEqual({
      ...expectedApplicationWithoutFingerprint,
      applicationFingerprint: fingerprintScreen02WorkflowValue(
        expectedApplicationWithoutFingerprint,
      ),
    });
    expect(isScreen02HostReviewApplication(marker)).toBe(true);
    expect([
      marker?.followUpQueryCount,
      marker?.proposedOfficialSourceLeadCount,
      marker?.verifiedOfficialSourceLeadCount,
      marker?.rankingAdjustmentCount,
    ].every((count) => typeof count === "number" && count > 0)).toBe(true);
    expect(applied.state.relevanceProfile).toMatchObject({
      origin: "chatgpt-host-enriched",
      originalIndustryText:
        target.initialState.relevanceProfile?.originalIndustryText,
      services: expect.arrayContaining(["orbital agronomy"]),
      hostEnrichmentCache: [expect.objectContaining({
        taskId: prepared.taskId,
        status: "applied",
        staleReason: null,
        additions: { services: ["orbital agronomy"] },
      })],
    });
    const laterProposal = hostOnlyServiceProposal(
      applied.state,
      "orbital agronomy",
    );
    expect(qualifyScreen02FindProposal(
      laterProposal,
      applied.state.screen01Baseline as unknown as Parameters<
        typeof qualifyScreen02FindProposal
      >[1],
      {
        scopeFingerprint: applied.state.screen01Fingerprint,
        studyProfile: applied.state.relevanceProfile,
      },
    )).toMatchObject({ classification: "direct", eligible: true });
    expect(applied.state.updatedAt).toBe("2026-08-09T18:10:05.001Z");
    expect(successor.manifest.retrievedAt).toBe(
      "2026-08-09T18:10:05.001Z",
    );
    expect(applied.state.candidateSets.find((set) =>
      set.candidateSetSnapshotId === originalSet.candidateSetSnapshotId
    )).toMatchObject({
      status: "superseded",
      supersededBySnapshotId: successor.candidateSetSnapshotId,
    });
    expect(successor.candidateSnapshotIds).toHaveLength(1);
    const refreshedCandidate = applied.state.candidates.find((candidate) =>
      candidate.candidateSnapshotId === successor.candidateSnapshotIds[0]
    );
    expect(refreshedCandidate).toMatchObject({
      candidateId: originalCandidate.candidateId,
      searchRoundId: successor.searchRoundId,
    });
    expect(refreshedCandidate?.candidateSnapshotId).not.toBe(
      originalCandidate.candidateSnapshotId,
    );
    expect(verifiedSource).toMatchObject({
      locator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
      authorityTier: 1,
      userProvided: false,
      evidenceText: expect.stringContaining("Regulation (EU) 2016/679"),
    });
    expect(refreshedCandidate?.sourceIds).toContain(verifiedSource?.id);
    expect(successor.ordering).toEqual([{
      candidateSnapshotId: refreshedCandidate?.candidateSnapshotId,
      rank: 1,
      reason: expect.any(String),
    }]);
    expect(storedTask.record.task).toMatchObject({
      status: "applied",
      submissionReceivedAt: "2026-08-09T18:10:05.000Z",
      appliedAt: "2026-08-09T18:10:05.001Z",
      failureCode: null,
    });
    expect((await target.taskStore.read(staleScreen03Task.taskId)).outcome)
      .toBe("not-found");
    expect(await target.screen03Store.read(target.identity.runId)).toEqual({
      outcome: "not-found",
    });
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({ runIds: [], batchLimitReached: false });

    const stateBeforeReplay = structuredClone(applied.state);
    const recordBeforeReplay = structuredClone(applied.record);
    const replay = await target.runtime.submitScreen02SearchReview(submission);
    expect(replay).toMatchObject({
      disposition: "replayed",
      status: "applied",
      resultId: receipt.resultId,
    });
    expect(observedDiscovery).toHaveLength(1);
    const afterReplay = await readScreen02HostState(target);
    expect(afterReplay.state).toEqual(stateBeforeReplay);
    expect(afterReplay.record).toEqual(recordBeforeReplay);
    expect(afterReplay.state.candidateSets).toHaveLength(
      target.initialState.candidateSets.length + 1,
    );
    expect(afterReplay.state.candidateSets.filter((set) =>
      set.manifest.hostReviewApplication !== undefined
    )).toHaveLength(1);
    await expect(target.runtime.prepare({
      schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
      operationId: "prepare-prohibited-second-host-round",
      taskType: "screen02-search-review",
      runId: target.identity.runId,
      accessToken: target.identity.accessToken,
      candidatePoolId: successor.candidateSetSnapshotId,
      selectedEventId: null,
      claimGroupId: null,
      expectedScopeFingerprint: afterReplay.state.screen01Fingerprint,
      expectedCandidatePoolFingerprint: successor.candidateSetFingerprint,
      expectedEventFingerprint: null,
      retryOfTaskId: null,
    })).rejects.toMatchObject({
      code: "screen02-host-review-already-applied",
    });
  });

  it("recovers an exact applied Screen 2 marker after task finalization is interrupted", async () => {
    let discoveryCalls = 0;
    const target = await screen02HostHarness({
      discoverScreen02Find: async (state, input) => {
        discoveryCalls += 1;
        return deterministicHostDiscovery(state, input);
      },
    });
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const submission = screen02HostReviewSubmission(target, prepared);
    const finalize = vi.spyOn(target.taskStore, "finalizeSubmissionApplied")
      .mockRejectedValueOnce(new Error("task finalization interrupted"));

    await expect(target.runtime.submitScreen02SearchReview(submission))
      .rejects.toThrow("task finalization interrupted");
    expect(discoveryCalls).toBe(1);
    const afterApplication = await readScreen02HostState(target);
    const marker = afterApplication.state.candidateSets.find((candidateSet) =>
      candidateSet.candidateSetSnapshotId ===
        afterApplication.state.activeCandidateSetSnapshotId
    )?.manifest.hostReviewApplication;
    expect(isScreen02HostReviewApplication(marker)).toBe(true);
    const validating = await target.taskStore.read(prepared.taskId);
    expect(validating.outcome === "found" && validating.record.task.status)
      .toBe("validating");

    target.setNow(prepared.expiresAt);
    expect(await target.taskStore.cleanupExpired(prepared.expiresAt)).toBe(1);
    const recovered = await target.runtime.status({
      schemaVersion: HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
      operationId: "status-recover-expired-screen02-application",
      taskId: prepared.taskId,
      runId: target.identity.runId,
      accessToken: target.identity.accessToken,
      acknowledgeResultId: null,
    });

    expect(recovered).toMatchObject({
      outcome: "found",
      task: {
        status: "applied",
        resultId: marker?.resultId,
      },
    });
    expect(discoveryCalls).toBe(1);
    expect(finalize).toHaveBeenCalledTimes(2);
    const afterRecovery = await readScreen02HostState(target);
    expect(afterRecovery.state).toEqual(afterApplication.state);
  });

  it("rejects a Screen 2 host review when bounded discovery fails without changing state", async () => {
    let discoveryCalls = 0;
    const target = await screen02HostHarness({
      withStaleScreen03Child: true,
      discoverScreen02Find: async () => {
        discoveryCalls += 1;
        throw new Error("deterministic source retrieval failed");
      },
    });
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const submission = screen02HostReviewSubmission(target, prepared);
    const before = await readScreen02HostState(target);
    expect(await target.screen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({ runIds: [], batchLimitReached: false });

    const receipt = await target.runtime.submitScreen02SearchReview(submission);

    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
    expect(discoveryCalls).toBe(1);
    const after = await readScreen02HostState(target);
    expect(after.state).toEqual(before.state);
    expect(after.record).toEqual(before.record);
    expect(after.state.candidateSets).toHaveLength(
      target.initialState.candidateSets.length,
    );
    expect(after.state.candidateSets.some((set) =>
      set.manifest.hostReviewApplication !== undefined
    )).toBe(false);
    expect(await target.screen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({ runIds: [], batchLimitReached: false });
    const storedTask = await target.taskStore.read(prepared.taskId);
    expect(storedTask.outcome === "found" && storedTask.record.task).toMatchObject({
      status: "validation-failed",
      failureCode: "authoritative-application-failed",
    });
  });

  it("rejects an official-lead audit not bound to the persisted source", async () => {
    const target = await screen02HostHarness({
      discoverScreen02Find: async (state, input) => {
        const discovery = await deterministicHostDiscovery(state, input);
        discovery.officialSourceLeadAudit![0]!.resultingSourceFingerprint =
          fingerprintScreen02WorkflowValue("different persisted source");
        return discovery;
      },
    });
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const before = await readScreen02HostState(target);

    const receipt = await target.runtime.submitScreen02SearchReview(
      screen02HostReviewSubmission(target, prepared),
    );

    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
    const after = await readScreen02HostState(target);
    expect(after.state).toEqual(before.state);
    expect(after.record).toEqual(before.record);
    expect(after.state.candidateSets.some((candidateSet) =>
      candidateSet.manifest.hostReviewApplication !== undefined
    )).toBe(false);
  });

  it("advances application time at an equal clock while persisting host profile additions", async () => {
    const target = await screen02HostHarness({
      discoverScreen02Find: deterministicHostDiscovery,
    });
    const equalAt = "2026-08-09T18:10:05.000Z";
    const before = await readScreen02HostState(target);
    const timestampAdvancedParent = requireScreen02FindState({
      ...structuredClone(before.state),
      revision: before.state.revision + 1,
      updatedAt: equalAt,
    });
    const parentUpdate = await target.screen02Store.updateTrusted({
      runId: target.identity.runId,
      expected: {
        generation: before.record.generation,
        revision: before.record.stateRevision,
        stateFingerprint: before.record.stateFingerprint,
      },
      operationId: "advance-parent-to-equal-clock",
      operationKind: "test-parent-time",
      mutate: () => ({
        stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(
          timestampAdvancedParent,
        ),
        bufferedReceipts: before.record.bufferedReceipts,
        updatedAt: equalAt,
        replayResult: null,
      }),
    });
    expect(parentUpdate.outcome).toBe("updated");
    const active = timestampAdvancedParent.candidateSets.find((set) =>
      set.candidateSetSnapshotId ===
        timestampAdvancedParent.activeCandidateSetSnapshotId
    );
    if (!active) throw new Error("Expected the active equal-clock pool.");

    target.setNow(equalAt);
    const prepared = await target.runtime.prepare({
      schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
      operationId: "prepare-equal-clock-review",
      taskType: "screen02-search-review",
      runId: target.identity.runId,
      accessToken: target.identity.accessToken,
      candidatePoolId: active.candidateSetSnapshotId,
      selectedEventId: null,
      claimGroupId: null,
      expectedScopeFingerprint: timestampAdvancedParent.screen01Fingerprint,
      expectedCandidatePoolFingerprint: active.candidateSetFingerprint,
      expectedEventFingerprint: null,
      retryOfTaskId: null,
    });
    await target.runtime.recordMessageDelivery({
      schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
      operationId: "deliver-equal-clock-review",
      taskId: prepared.taskId,
      runId: target.identity.runId,
      accessToken: target.identity.accessToken,
      channel: "ui/message",
      accepted: true,
      requestedAt: equalAt,
      resolvedAt: equalAt,
      failureCode: null,
      failureExplanation: null,
    });
    const receipt = await target.runtime.submitScreen02SearchReview(
      screen02HostReviewSubmission(target, prepared),
    );
    expect(receipt).toMatchObject({ disposition: "applied", status: "applied" });

    const applied = await readScreen02HostState(target);
    const successor = applied.state.candidateSets.find((set) =>
      set.candidateSetSnapshotId === applied.state.activeCandidateSetSnapshotId
    );
    expect(applied.state.relevanceProfile).toMatchObject({
      origin: "chatgpt-host-enriched",
      originalIndustryText:
        timestampAdvancedParent.relevanceProfile?.originalIndustryText,
      services: expect.arrayContaining(["orbital agronomy"]),
      updatedAt: "2026-08-09T18:10:05.001Z",
      hostEnrichmentCache: [expect.objectContaining({
        taskId: prepared.taskId,
        status: "applied",
        staleReason: null,
        additions: { services: ["orbital agronomy"] },
        appliedAt: equalAt,
      })],
    });
    expect(applied.state.updatedAt).toBe("2026-08-09T18:10:05.002Z");
    expect(successor?.manifest.hostReviewApplication?.appliedAt).toBe(
      "2026-08-09T18:10:05.002Z",
    );
    const task = await target.taskStore.read(prepared.taskId);
    expect(task.outcome === "found" && task.record.task).toMatchObject({
      submissionReceivedAt: equalAt,
      appliedAt: "2026-08-09T18:10:05.002Z",
    });
  });

  it("retains the durable child-cascade marker when Screen 3 retirement fails", async () => {
    const backingScreen03Store = new InMemoryScreen03WorkflowStore();
    const failingScreen03Store = new Proxy(backingScreen03Store, {
      get(store, property) {
        if (property === "retire") {
          return async () => {
            throw new Error("transient Screen 3 retirement failure");
          };
        }
        const value = Reflect.get(store, property);
        return typeof value === "function" ? value.bind(store) : value;
      },
    }) as Screen03WorkflowStore;
    const target = await screen02HostHarness({
      screen03Store: failingScreen03Store,
      withStaleScreen03Child: true,
      discoverScreen02Find: deterministicHostDiscovery,
    });
    const staleScreen03Task = await target.runtime.prepare(
      staleScreen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const receipt = await target.runtime.submitScreen02SearchReview(
      screen02HostReviewSubmission(target, prepared),
    );

    expect(receipt).toMatchObject({ disposition: "applied", status: "applied" });
    expect(await backingScreen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({
        runIds: [target.identity.runId],
        batchLimitReached: false,
      });
    await expect(target.screen02Store.nextExpirationAt()).resolves.toBe(
      "1970-01-01T00:00:00.000Z",
    );
    const pending = await target.screen02Store.readPendingChildCascade?.(
      target.identity.runId,
    );
    expect(pending).toEqual({
      outcome: "found",
      cascade: {
        kind: "screen03-stale-after-host-review",
        runId: target.identity.runId,
        originatingTaskId: prepared.taskId,
      },
    });
    expect((await target.taskStore.read(prepared.taskId)).outcome).toBe("found");
    expect((await target.taskStore.read(staleScreen03Task.taskId)).outcome)
      .toBe("found");

    await backingScreen03Store.retire(target.identity.runId);
    await expect(target.taskStore.retireRunTaskTypes(
      target.identity.runId,
      ["screen03-evidence-mapping", "screen03-overview-improvement"],
    )).resolves.toEqual({ removed: 1, batchLimitReached: false });
    if (!pending || pending.outcome !== "found") {
      throw new Error("Expected the durable mutation cascade marker.");
    }
    await target.screen02Store.acknowledgePendingChildCascade?.(
      target.identity.runId,
      pending.cascade,
    );
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({ runIds: [], batchLimitReached: false });
    expect(await backingScreen03Store.read(target.identity.runId)).toEqual({
      outcome: "not-found",
    });
    const preserved = await target.taskStore.read(prepared.taskId);
    expect(preserved.outcome === "found" && preserved.record.task).toMatchObject({
      status: "applied",
      resultId: receipt.resultId,
    });
    expect((await target.taskStore.read(staleScreen03Task.taskId)).outcome)
      .toBe("not-found");
  });

  it("rejects a Screen 2 host review on a CAS race and preserves the concurrent deterministic state", async () => {
    const screen02Store = new InMemoryScreen02WorkflowStore();
    let discoveryCalls = 0;
    const target = await screen02HostHarness({
      screen02Store,
      withStaleScreen03Child: true,
      discoverScreen02Find: async (state, input) => {
        discoveryCalls += 1;
        const current = await screen02Store.readTrusted({ runId: state.runId });
        if (current.outcome !== "found") {
          throw new Error("Expected the concurrent Screen 2 parent.");
        }
        const concurrent = await screen02Store.updateTrusted({
          runId: state.runId,
          expected: {
            generation: current.record.generation,
            revision: current.record.stateRevision,
            stateFingerprint: current.record.stateFingerprint,
          },
          operationId: "concurrent-deterministic-refresh",
          operationKind: "test-deterministic-refresh",
          mutate: async () => ({
            stateEnvelope: current.record.stateEnvelope,
            bufferedReceipts: current.record.bufferedReceipts,
            updatedAt: current.record.updatedAt,
            replayResult: { kind: "deterministic-refresh" },
          }),
        });
        expect(concurrent.outcome).toBe("updated");
        return deterministicHostDiscovery(state, input);
      },
    });
    const prepared = await prepareDeliveredScreen02HostReview(target);
    const submission = screen02HostReviewSubmission(target, prepared);
    const before = await readScreen02HostState(target);
    expect(await target.screen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });

    const receipt = await target.runtime.submitScreen02SearchReview(submission);

    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
      resultId: null,
    });
    expect(discoveryCalls).toBe(1);
    const after = await readScreen02HostState(target);
    expect(after.state).toEqual(before.state);
    expect(after.record.generation).toBe(before.record.generation + 1);
    expect(after.record.stateRevision).toBe(before.record.stateRevision);
    expect(after.record.stateFingerprint).toBe(before.record.stateFingerprint);
    expect(after.state.candidateSets).toHaveLength(
      target.initialState.candidateSets.length,
    );
    expect(after.state.relevanceProfile).toEqual(
      target.initialState.relevanceProfile,
    );
    expect(after.state.candidateSets.some((set) =>
      set.manifest.hostReviewApplication !== undefined
    )).toBe(false);
    expect(await target.screen03Store.read(target.identity.runId)).toMatchObject({
      outcome: "found",
    });
    await expect(target.screen02Store.listPendingChildCascades?.()).resolves
      .toEqual({ runIds: [], batchLimitReached: false });
    const storedTask = await target.taskStore.read(prepared.taskId);
    expect(storedTask.outcome === "found" && storedTask.record.task).toMatchObject({
      status: "validation-failed",
      failureCode: "authoritative-application-failed",
    });
  });

  it("rejects a wrong Screen 2 possession token before trusted freezing", async () => {
    const target = await workflowHarness();
    await expect(target.runtime.prepare({
      ...screen02PrepareInput(target),
      operationId: "wrong-token-operation",
      accessToken: `s2a_${"x".repeat(43)}`,
    })).rejects.toMatchObject({ code: "task-access-denied" });
    expect(await target.taskStore.nextExpirationAt()).toBeNull();
  });

  it("rejects a trusted Screen 2 record whose state fingerprint was rebound", async () => {
    const target = await workflowHarness();
    const tamperedStore = new Proxy(target.screen02Store, {
      get(store, property) {
        if (property === "readTrusted") {
          return async (input: { runId: string }) => {
            const read = await store.readTrusted(input);
            return read.outcome === "found"
              ? {
                  outcome: "found" as const,
                  record: {
                    ...read.record,
                    stateFingerprint:
                      fingerprintHostReasoningValue("rebound-state"),
                  },
                }
              : read;
          };
        }
        const value = Reflect.get(store, property, store);
        return typeof value === "function" ? value.bind(store) : value;
      },
    });
    const runtime = createHostReasoningWorkflowRuntime({
      taskStore: new HostReasoningTaskStore(
        new InMemoryHostReasoningTaskStoreBackend(),
      ),
      screen02Store: tamperedStore,
      screen03Store: target.screen03Store,
      signing,
      now: () => "2026-08-09T18:10:03.000Z",
      createId: (kind) => `tamper-${kind}`,
      discoverScreen02Find: async () => {
        throw new Error("Unexpected Screen 2 discovery in this test.");
      },
    });
    await expect(runtime.prepare({
      ...screen02PrepareInput(target),
      operationId: "tampered-record-operation",
    })).rejects.toMatchObject({ code: "task-preparation-failed" });
  });

  it("cannot persist a host task after its same-storage parent retires", async () => {
    const storage = sharedDurableStorage();
    const screen02Store = new DurableObjectScreen02WorkflowStore(storage);
    const screen03Store = new DurableObjectScreen03WorkflowStore(storage);
    const taskStore = new HostReasoningTaskStore(storage, {
      enforceParentGuard: true,
    });
    const target = await workflowHarness({
      screen02Store,
      screen03Store,
      taskStore,
    });
    let releaseFrozenRead!: () => void;
    let markFrozenRead!: () => void;
    const frozenRead = new Promise<void>((resolve) => {
      markFrozenRead = resolve;
    });
    const frozenReadGate = new Promise<void>((resolve) => {
      releaseFrozenRead = resolve;
    });
    const racingScreen02Store = new Proxy(screen02Store, {
      get(store, property) {
        if (property === "readTrusted") {
          return async (input: { runId: string }) => {
            const read = await store.readTrusted(input);
            markFrozenRead();
            await frozenReadGate;
            return read;
          };
        }
        const value = Reflect.get(store, property, store);
        return typeof value === "function" ? value.bind(store) : value;
      },
    });
    const runtime = createHostReasoningWorkflowRuntime({
      taskStore,
      screen02Store: racingScreen02Store,
      screen03Store,
      signing,
      now: () => "2026-08-09T18:10:03.000Z",
      createId: (kind) => `retire-race-${kind}`,
      discoverScreen02Find: async () => {
        throw new Error("Unexpected Screen 2 discovery in this test.");
      },
    });

    const preparation = runtime.prepare({
      ...screen02PrepareInput(target),
      operationId: "prepare-retire-race",
    });
    await frozenRead;
    const cleanup = await screen02Store.cleanupExpired(
      target.parentRecord.expiresAt,
    );
    expect(cleanup.deletedRunIds).toEqual([target.identity.runId]);
    releaseFrozenRead();

    await expect(preparation).rejects.toMatchObject({
      code: "task-parent-unavailable",
    });
    expect(await taskStore.retireRun(target.identity.runId)).toEqual({
      removed: 0,
      batchLimitReached: false,
    });
    expect(await taskStore.nextExpirationAt()).toBeNull();
  });

  it("requires an exact disjoint disposition for every frozen Screen 3 claim", async () => {
    for (const disposition of ["unmapped", "conflict"] as const) {
      const target = await workflowHarness();
      const prepared = await target.runtime.prepare(
        screen03PrepareInput(target, "screen03-evidence-mapping"),
      );
      await markMessageDelivered(
        target,
        prepared.taskId,
        `deliver-valid-${disposition}`,
      );
      target.setNow("2026-08-09T18:10:05.000Z");
      const receipt = await target.runtime.submitScreen03EvidenceMapping(
        noChangeMappingSubmission(prepared, disposition),
      );
      expect(receipt).toMatchObject({
        disposition: "applied",
        status: "applied",
      });
      const current = await target.screen03Store.read(target.identity.runId);
      expect(current.outcome).toBe("found");
      if (current.outcome === "found") {
        expect(current.record.state.proposals).toEqual(
          target.initialScreen03State.proposals,
        );
        expect(current.record.state.history.at(-1)).toMatchObject({
          action: "host-evidence-mapping-applied",
          actor: "chatgpt-host",
          targetId: prepared.claimGroupId,
          value: receipt.resultId,
        });
      }
    }

    const invalidCases = [
      {
        name: "omitted claim",
        build: (
          _target: WorkflowHarness,
          prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
        ) => ({
          ...noChangeMappingSubmission(prepared),
          unmappedClaimIds: [],
        }),
      },
      {
        name: "mapping and unmapped overlap",
        build: (
          target: WorkflowHarness,
          prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
        ) => {
          const submission = titleMappingSubmission(target, prepared);
          return {
            ...submission,
            unmappedClaimIds: [submission.mappings[0]!.claimId],
          };
        },
      },
      {
        name: "mapping and conflict overlap",
        build: (
          target: WorkflowHarness,
          prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
        ) => {
          const submission = titleMappingSubmission(target, prepared);
          return {
            ...submission,
            conflictClaimIds: [submission.mappings[0]!.claimId],
          };
        },
      },
      {
        name: "unmapped and conflict overlap",
        build: (
          _target: WorkflowHarness,
          prepared: Awaited<ReturnType<WorkflowHarness["runtime"]["prepare"]>>,
        ) => {
          const submission = noChangeMappingSubmission(prepared);
          return {
            ...submission,
            conflictClaimIds: [...submission.unmappedClaimIds],
          };
        },
      },
    ];
    for (const invalid of invalidCases) {
      const target = await workflowHarness();
      const prepared = await target.runtime.prepare(
        screen03PrepareInput(target, "screen03-evidence-mapping"),
      );
      await markMessageDelivered(
        target,
        prepared.taskId,
        `deliver-invalid-${invalid.name.replaceAll(" ", "-")}`,
      );
      target.setNow("2026-08-09T18:10:05.000Z");
      await expect(target.runtime.submitScreen03EvidenceMapping(
        invalid.build(target, prepared),
      )).resolves.toMatchObject({
        disposition: "rejected",
        status: "validation-failed",
      });
    }
  });

  it("applies exact Screen 3 mappings canonically without a researcher decision", async () => {
    const target = await workflowHarness();
    const input = screen03PrepareInput(target, "screen03-evidence-mapping");
    const prepared = await target.runtime.prepare(input);
    await markMessageDelivered(target, prepared.taskId, "deliver-evidence-task");
    const claim = target.initialScreen03State.proposals.identity[0]!;
    const receipt = await submitTitleMapping(target, prepared);

    expect(receipt).toMatchObject({
      disposition: "applied",
      status: "applied",
      outcomeValuesInspected: false,
    });
    const read = await target.screen03Store.read(target.identity.runId);
    expect(read.outcome).toBe("found");
    if (read.outcome !== "found") return;
    const mapped = read.record.state.proposals.identity.find((item) =>
      item.id === claim.id
    );
    expect(mapped).toMatchObject({
      support: "direct",
      reviewStatus: "proposed",
      editedValue: null,
      sourceIds: [sourceId],
      passageIds: [passageId],
    });
    expect(read.record.state.status).toBe("reviewing");
    expect(read.record.state.revision).toBe(
      target.initialScreen03State.revision + 1,
    );
    expect(read.record.state.history.at(-1)).toMatchObject({
      action: "host-evidence-mapping-applied",
      actor: "chatgpt-host",
      targetId: input.claimGroupId,
      previousReviewStatus: null,
      nextReviewStatus: null,
    });
  });

  it.each(["direct mapping", "empty mapping"] as const)(
    "rejects a Screen 3 %s when the inspected predecessor loses its CAS race",
    async (kind) => {
      const interleaving = screen03ReadInterleavingStore();
      const target = await workflowHarness({
        screen03Store: interleaving.store,
      });
      const prepared = await target.runtime.prepare(
        screen03PrepareInput(target, "screen03-evidence-mapping"),
      );
      await markMessageDelivered(
        target,
        prepared.taskId,
        `deliver-screen03-${kind.replace(" ", "-")}-race`,
      );
      let concurrentFingerprint: string | null = null;
      interleaving.arm(2, async (predecessor) => {
        const concurrent = refreshScreen03StateFromResearch(
          predecessor.state,
          target.handoff,
          researchPacket(
            target.handoff.integrity.eventFingerprint,
            "indirect",
          ),
          "2026-08-09T18:10:04.500Z",
        );
        const update = await interleaving.base.update({
          parentRunId: target.parentRecord.runId,
          parentStateFingerprint: target.parentRecord.stateFingerprint,
          handoffProducerAppVersion: SHOCKAUDIT_VERSION,
          parentGuard: {
            runId: target.parentRecord.runId,
            generation: target.parentRecord.generation,
            revision: target.parentRecord.stateRevision,
            stateFingerprint: target.parentRecord.stateFingerprint,
            expiresAt: target.parentRecord.expiresAt,
          },
          expected: {
            generation: predecessor.generation,
            revision: predecessor.stateRevision,
            stateFingerprint: predecessor.stateFingerprint,
          },
          state: concurrent,
          expiresAt: target.parentRecord.expiresAt,
        });
        expect(update.outcome).toBe("updated");
        if (update.outcome === "updated") {
          concurrentFingerprint = update.record.stateFingerprint;
        }
      });
      target.setNow("2026-08-09T18:10:05.000Z");

      const receipt = await target.runtime.submitScreen03EvidenceMapping(
        kind === "direct mapping"
          ? titleMappingSubmission(target, prepared)
          : noChangeMappingSubmission(prepared),
      );
      expect(receipt).toMatchObject({
        disposition: "rejected",
        status: "validation-failed",
      });
      expect(concurrentFingerprint).toMatch(/^fnv1a64:/u);
      const current = await target.screen03Store.read(target.identity.runId);
      expect(current.outcome).toBe("found");
      if (current.outcome === "found") {
        expect(current.record.stateFingerprint).toBe(concurrentFingerprint);
        expect(current.record.state.history.some((event) =>
          event.action === "host-evidence-mapping-applied"
        )).toBe(false);
      }
    },
  );

  it("recovers an exact Screen 3 mapping after task finalization is interrupted", async () => {
    const target = await workflowHarness();
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-recover-mapping");
    const finalize = vi.spyOn(target.taskStore, "finalizeSubmissionApplied")
      .mockRejectedValueOnce(new Error("task finalization interrupted"));

    await expect(submitTitleMapping(target, prepared)).rejects.toThrow(
      "task finalization interrupted",
    );
    const afterApplication = await target.screen03Store.read(
      target.identity.runId,
    );
    expect(afterApplication.outcome).toBe("found");
    if (afterApplication.outcome !== "found") return;
    const appliedEvents = afterApplication.record.state.history.filter(
      (event) => event.action === "host-evidence-mapping-applied",
    );
    expect(appliedEvents).toHaveLength(1);
    expect(appliedEvents[0]!.reason).toMatch(
      /Host evidence mapping fingerprint: fnv1a64:[0-9a-f]{16}\. Host evidence application binding: fnv1a64:[0-9a-f]{16}\.$/u,
    );
    const reserved = await target.taskStore.read(prepared.taskId);
    expect(reserved.outcome).toBe("found");
    if (reserved.outcome === "found") {
      const proposal = reserved.record.proposal as {
        mappingFingerprint: string;
        applicationCoordinatesInspected: {
          parent: {
            runId: string;
            generation: number;
            revision: number;
            stateFingerprint: string;
            expiresAt: string;
          };
          predecessor: {
            generation: number;
            revision: number;
            stateFingerprint: string;
            expiresAt: string;
            handoffProducerAppVersion: string;
          };
        };
      };
      expect(proposal).toMatchObject({
        stateFingerprintInspected:
          target.initialScreen03Record.stateFingerprint,
        sourcePoolFingerprintInspected:
          reserved.record.task.sourcePoolFingerprint,
        mappingFingerprint: expect.stringMatching(/^fnv1a64:[0-9a-f]{16}$/u),
        applicationCoordinatesInspected: {
          parent: {
            runId: target.parentRecord.runId,
            generation: target.parentRecord.generation,
            revision: target.parentRecord.stateRevision,
            stateFingerprint: target.parentRecord.stateFingerprint,
            expiresAt: target.parentRecord.expiresAt,
          },
          predecessor: {
            generation: target.initialScreen03Record.generation,
            revision: target.initialScreen03Record.stateRevision,
            stateFingerprint: target.initialScreen03Record.stateFingerprint,
            expiresAt: target.initialScreen03Record.expiresAt,
            handoffProducerAppVersion: SHOCKAUDIT_VERSION,
          },
        },
      });
      const facts = screen03EvidenceMappingTaskFactsSchema.parse(
        reserved.record.boundedInput,
      );
      const expectedBinding =
        fingerprintScreen03HostEvidenceApplicationBinding({
          task: reserved.record.task,
          resultId: appliedEvents[0]!.value!,
          submissionFingerprint: reserved.record.submissionFingerprint!,
          applicationCoordinates: proposal.applicationCoordinatesInspected,
          allowedSourceIds: facts.passages.map((passage) => passage.sourceId),
          mappingFingerprint: proposal.mappingFingerprint,
        });
      expect(appliedEvents[0]!.reason).toContain(
        `Host evidence application binding: ${expectedBinding}.`,
      );
    }

    target.setNow(prepared.expiresAt);
    expect(await target.taskStore.cleanupExpired(prepared.expiresAt)).toBe(1);
    const recovered = await target.runtime.submitScreen03EvidenceMapping(
      titleMappingSubmission(target, prepared),
    );
    expect(recovered).toMatchObject({
      disposition: "applied",
      status: "applied",
      resultId: appliedEvents[0]!.value,
    });
    expect(finalize).toHaveBeenCalledTimes(2);
    const afterRecovery = await target.screen03Store.read(target.identity.runId);
    expect(afterRecovery.outcome).toBe("found");
    if (afterRecovery.outcome === "found") {
      expect(afterRecovery.record.state.history.filter(
        (event) => event.action === "host-evidence-mapping-applied",
      )).toHaveLength(1);
    }
  });

  it("fails closed when interrupted Screen 3 recovery finds an under-bound marker", async () => {
    const target = await workflowHarness();
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(
      target,
      prepared.taskId,
      "deliver-forged-recovery-binding",
    );
    const submission = titleMappingSubmission(target, prepared);
    const finalize = vi.spyOn(target.taskStore, "finalizeSubmissionApplied")
      .mockRejectedValueOnce(new Error("task finalization interrupted"));
    target.setNow("2026-08-09T18:10:05.000Z");
    await expect(target.runtime.submitScreen03EvidenceMapping(submission))
      .rejects.toThrow("task finalization interrupted");

    const afterApplication = await target.screen03Store.read(
      target.identity.runId,
    );
    expect(afterApplication.outcome).toBe("found");
    if (afterApplication.outcome !== "found") return;
    const forged = structuredClone(afterApplication.record.state);
    const marker = forged.history.find((event) =>
      event.action === "host-evidence-mapping-applied"
    );
    if (!marker) throw new Error("Expected an application marker to forge.");
    marker.reason = marker.reason.replace(
      /Host evidence application binding: (?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})\.$/u,
      "Host evidence application binding: fnv1a64:ffffffffffffffff.",
    );
    const { integrity: _integrity, ...fingerprintInput } = forged;
    forged.integrity.stateFingerprint = fingerprintScreen03Value(
      fingerprintInput,
    );
    const forgedUpdate = await target.screen03Store.update({
      parentRunId: target.parentRecord.runId,
      parentStateFingerprint: target.parentRecord.stateFingerprint,
      handoffProducerAppVersion: SHOCKAUDIT_VERSION,
      parentGuard: {
        runId: target.parentRecord.runId,
        generation: target.parentRecord.generation,
        revision: target.parentRecord.stateRevision,
        stateFingerprint: target.parentRecord.stateFingerprint,
        expiresAt: target.parentRecord.expiresAt,
      },
      expected: {
        generation: afterApplication.record.generation,
        revision: afterApplication.record.stateRevision,
        stateFingerprint: afterApplication.record.stateFingerprint,
      },
      state: forged,
      expiresAt: target.parentRecord.expiresAt,
    });
    expect(forgedUpdate.outcome).toBe("updated");

    target.setNow("2026-08-09T18:10:06.000Z");
    expect(await target.runtime.submitScreen03EvidenceMapping(submission))
      .toMatchObject({
        disposition: "replayed",
        status: "validating",
        resultId: null,
      });
    expect(finalize).toHaveBeenCalledTimes(1);
    const task = await target.taskStore.read(prepared.taskId);
    expect(task.outcome === "found" && task.record.task.status).toBe(
      "validating",
    );
  });

  it("recovers a canonical no-change marker after task finalization is interrupted", async () => {
    const target = await workflowHarness();
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(
      target,
      prepared.taskId,
      "deliver-recover-no-change-mapping",
    );
    const before = await target.screen03Store.read(target.identity.runId);
    expect(before.outcome).toBe("found");
    if (before.outcome !== "found") return;
    const finalize = vi.spyOn(target.taskStore, "finalizeSubmissionApplied")
      .mockRejectedValueOnce(new Error("task finalization interrupted"));
    target.setNow("2026-08-09T18:10:05.000Z");
    const submission = noChangeMappingSubmission(prepared);

    await expect(target.runtime.submitScreen03EvidenceMapping(submission))
      .rejects.toThrow("task finalization interrupted");
    const afterApplication = await target.screen03Store.read(
      target.identity.runId,
    );
    expect(afterApplication.outcome).toBe("found");
    if (afterApplication.outcome !== "found") return;
    expect(afterApplication.record.state.proposals).toEqual(
      before.record.state.proposals,
    );
    expect(afterApplication.record.state.revision).toBe(
      before.record.state.revision + 1,
    );
    const markers = afterApplication.record.state.history.filter((event) =>
      event.action === "host-evidence-mapping-applied"
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      actor: "chatgpt-host",
      targetId: prepared.claimGroupId,
    });

    const recovered = await target.runtime.submitScreen03EvidenceMapping(
      submission,
    );
    expect(recovered).toMatchObject({
      disposition: "applied",
      status: "applied",
      resultId: markers[0]!.value,
    });
    expect(finalize).toHaveBeenCalledTimes(2);
    const afterRecovery = await target.screen03Store.read(target.identity.runId);
    expect(afterRecovery.outcome).toBe("found");
    if (afterRecovery.outcome === "found") {
      expect(afterRecovery.record.state.history.filter((event) =>
        event.action === "host-evidence-mapping-applied"
      )).toHaveLength(1);
      expect(afterRecovery.record.state.revision).toBe(
        afterApplication.record.state.revision,
      );
    }
  });

  it("maps from an exact bounded fragment of a long canonical passage", async () => {
    const longPassage = `${"Background context without findings. ".repeat(45)} ` +
      `Canonical title: ${title}. Additional official context.`;
    expect(longPassage.length).toBeGreaterThan(1_000);
    const target = await workflowHarness({ passageText: longPassage });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    const frozenPassage = screen03EvidenceMappingTaskFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    ).passages
      .find((passage) => passage.passageId === passageId)!;
    expect(frozenPassage.text.length).toBeLessThanOrEqual(1_000);
    expect(longPassage.includes(frozenPassage.text)).toBe(true);
    expect(frozenPassage.text).toContain(title);
    expect(frozenPassage.text).not.toContain("[truncated]");
    await markMessageDelivered(target, prepared.taskId, "deliver-long-passage");
    expect(await submitTitleMapping(target, prepared)).toMatchObject({
      disposition: "applied",
      status: "applied",
    });
  });

  it("rejects a mapping when its frozen passage fragment became stale", async () => {
    const original = `${"Original official context. ".repeat(50)} ` +
      `Canonical title: ${title}.`;
    const target = await workflowHarness({ passageText: original });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-stale-fragment");
    await refreshAuthoritativePassage(
      target,
      `${"Updated official context. ".repeat(50)} Canonical title: ${title}.`,
    );
    expect(await submitTitleMapping(target, prepared)).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome === "found" && stored.record.task.failureCode)
      .toBe("inactive-evidence");
  });

  it("rejects a frozen passage fragment that is no longer unique", async () => {
    const original = `Canonical title: ${title}.`;
    const target = await workflowHarness({ passageText: original });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-repeated-fragment");
    await refreshAuthoritativePassage(target, `${original} ${original}`);
    expect(await submitTitleMapping(target, prepared)).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
  });

  it("requires every active Screen 3 contradiction in the claim group to be submitted as a conflict", async () => {
    const target = await workflowHarness({ activeContradiction: true });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    expect(screen03EvidenceMappingTaskFactsSchema.parse(
      prepared.privateModelContext.boundedFacts,
    ).activeContradictions).toEqual([{
      contradictionId: "host-active-contradiction",
      claimIds: ["host-canonical-title-claim"],
      summary: "The active records conflict on the canonical title.",
    }]);
    await markMessageDelivered(target, prepared.taskId, "deliver-conflicted-mapping");

    const receipt = await submitTitleMapping(target, prepared);
    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome === "found" && stored.record.task.failureCode)
      .toBe("active-conflict-unacknowledged");
  });

  it("accepts an active Screen 3 contradiction only through the conflict partition", async () => {
    const target = await workflowHarness({ activeContradiction: true });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-evidence-mapping"),
    );
    await markMessageDelivered(
      target,
      prepared.taskId,
      "deliver-acknowledged-conflict-mapping",
    );
    target.setNow("2026-08-09T18:10:05.000Z");

    expect(await target.runtime.submitScreen03EvidenceMapping(
      noChangeMappingSubmission(prepared, "conflict"),
    )).toMatchObject({ disposition: "applied", status: "applied" });
  });

  it("enforces the compact overview word, point, and uncertainty bounds", () => {
    const {
      schemaVersion: _schemaVersion,
      taskId: _taskId,
      capability: _capability,
      ...valid
    } = overviewSubmission("task", "capability");
    expect(screen03OverviewProposalSchema.parse(valid).summary).toBe(
      valid.summary,
    );
    for (const words of [59, 101]) {
      expect(() => screen03OverviewProposalSchema.parse({
        ...valid,
        summary: Array.from({ length: words }, () => "fact").join(" "),
      })).toThrow(/60–100 words/iu);
    }
    expect(() => screen03OverviewProposalSchema.parse({
      ...valid,
      keyPoints: [
        Array.from({ length: 26 }, () => "fact").join(" "),
        ...valid.keyPoints.slice(1),
      ],
    })).toThrow(/25 words or fewer/iu);
    expect(() => screen03OverviewProposalSchema.parse({
      ...valid,
      uncertainties: ["one", "two", "three"],
    })).toThrow();
  });

  it("validates and stores an overview as noncanonical without changing Screen 3", async () => {
    const target = await workflowHarness({ support: "direct" });
    const before = await target.screen03Store.read(target.identity.runId);
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-overview-improvement"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-overview-task");
    target.setNow("2026-08-09T18:10:05.000Z");
    const receipt = await target.runtime.submitScreen03Overview(
      overviewSubmission(
        prepared.taskId,
        prepared.privateModelContext.submission.capability,
      ),
    );

    expect(receipt).toMatchObject({ disposition: "applied", status: "applied" });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome).toBe("found");
    if (stored.outcome === "found") {
      expect(stored.record.proposal).toMatchObject({
        schemaVersion: "shockaudit-screen03-host-overview-result-v1",
        origin: "chatgpt-host",
        nonCanonical: true,
        outcomeValuesInspected: false,
      });
    }
    const after = await target.screen03Store.read(target.identity.runId);
    expect(after).toEqual(before);
  });

  it("recovers an exact noncanonical overview without changing Screen 3", async () => {
    const target = await workflowHarness({ support: "direct" });
    const before = await target.screen03Store.read(target.identity.runId);
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-overview-improvement"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-recover-overview");
    const submission = overviewSubmission(
      prepared.taskId,
      prepared.privateModelContext.submission.capability,
    );
    const finalize = vi.spyOn(target.taskStore, "finalizeSubmissionApplied")
      .mockRejectedValueOnce(new Error("task finalization interrupted"));
    target.setNow("2026-08-09T18:10:05.000Z");

    await expect(target.runtime.submitScreen03Overview(submission)).rejects
      .toThrow("task finalization interrupted");
    target.setNow(prepared.expiresAt);
    expect(await target.taskStore.cleanupExpired(prepared.expiresAt)).toBe(1);
    const recovered = await target.runtime.submitScreen03Overview(submission);
    expect(recovered).toMatchObject({
      disposition: "applied",
      status: "applied",
      resultId: expect.any(String),
    });
    expect(finalize).toHaveBeenCalledTimes(2);
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome === "found" && stored.record.task.appliedAt)
      .toBe("2026-08-09T18:10:05.000Z");
    expect(await target.screen03Store.read(target.identity.runId)).toEqual(before);
  });

  it("fails closed when overview wording asserts a causal result", async () => {
    const target = await workflowHarness({ support: "direct" });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-overview-improvement"),
    );
    await markMessageDelivered(target, prepared.taskId, "deliver-invalid-overview");
    target.setNow("2026-08-09T18:10:05.000Z");
    const candidate = overviewSubmission(
      prepared.taskId,
      prepared.privateModelContext.submission.capability,
    );
    const receipt = await target.runtime.submitScreen03Overview({
      ...candidate,
      summary: candidate.summary.replace(
        "is the supported canonical title",
        "caused the supported canonical title",
      ),
    });
    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
    const read = await target.taskStore.read(prepared.taskId);
    expect(read.outcome === "found" && read.record.task.failureCode)
      .toBe("screen03-overview-invalid");
  });

  it.each([
    "The Department of Justice administers this regulation.",
    "The regulation carries civil penalties for violations.",
    "The regulation covers every small business.",
    "The canonical title supports General Data Protection Regulation.",
    "General Data Protection Regulation is not the canonical title.",
  ])("rejects an invented ordinary-language overview assertion: %s", async (invented) => {
    const target = await workflowHarness({ support: "direct" });
    const prepared = await target.runtime.prepare(
      screen03PrepareInput(target, "screen03-overview-improvement"),
    );
    await markMessageDelivered(
      target,
      prepared.taskId,
      `deliver-invented-overview-${fingerprintHostReasoningValue(invented).slice(8)}`,
    );
    target.setNow("2026-08-09T18:10:05.000Z");
    const candidate = overviewSubmission(
      prepared.taskId,
      prepared.privateModelContext.submission.capability,
    );
    const receipt = await target.runtime.submitScreen03Overview({
      ...candidate,
      keyPoints: [invented, ...candidate.keyPoints.slice(1)],
    });

    expect(receipt).toMatchObject({
      disposition: "rejected",
      status: "validation-failed",
    });
    const stored = await target.taskStore.read(prepared.taskId);
    expect(stored.outcome === "found" && stored.record.task.failureCode)
      .toBe("screen03-overview-invalid");
  });

  it("coexists on one Durable Object backend and follows cleanup retirement order", async () => {
    const storage = sharedDurableStorage();
    const screen02Store = new DurableObjectScreen02WorkflowStore(storage);
    const screen03Store = new DurableObjectScreen03WorkflowStore(storage);
    const taskStore = new HostReasoningTaskStore(storage, {
      enforceParentGuard: true,
    });
    const target = await workflowHarness({
      screen02Store,
      screen03Store,
      taskStore,
    });
    const prepared = await target.runtime.prepare(screen02PrepareInput(target));
    const taskRead = await taskStore.read(prepared.taskId);
    if (taskRead.outcome !== "found") throw new Error("Expected a host task.");

    expect(await taskStore.cleanupExpired(taskRead.record.task.expiresAt)).toBe(1);
    expect((await taskStore.read(prepared.taskId)).outcome).toBe("found");
    expect((await screen02Store.readTrusted({ runId: target.identity.runId })).outcome)
      .toBe("found");
    expect((await screen03Store.read(target.identity.runId)).outcome).toBe("found");

    const parentCleanup = await screen02Store.cleanupExpired(
      target.parentRecord.expiresAt,
    );
    expect(parentCleanup.deletedRunIds).toContain(target.identity.runId);
    for (const runId of parentCleanup.deletedRunIds) {
      await screen03Store.retire(runId);
      await taskStore.retireRun(runId);
      await screen02Store.acknowledgePendingChildCascade(runId);
    }
    expect((await screen02Store.readTrusted({ runId: target.identity.runId })).outcome)
      .toBe("not-found");
    expect((await screen03Store.read(target.identity.runId)).outcome)
      .toBe("not-found");
    expect((await taskStore.read(prepared.taskId)).outcome).toBe("not-found");
    expect(await taskStore.nextExpirationAt()).toBeNull();
  });
});
