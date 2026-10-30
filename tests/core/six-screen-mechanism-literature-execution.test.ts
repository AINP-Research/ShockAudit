import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION,
  SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_LEGACY_VERSION,
  SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION,
  SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION,
  createMechanismLiteratureExecution,
  createMechanismLiteratureExecutionPlan,
  createMechanismLiteratureProviderAttempt,
  createScholarlyEvidencePacket,
  createScholarlyMetadataRecord,
  validateMechanismLiteratureExecutionCollections,
  validateMechanismLiteratureExecutionPlan,
  validateScholarlyEvidencePacket,
  validateScholarlyMetadataRecord,
  type MechanismLiteratureExecution,
  type MechanismLiteratureExecutionPlan,
  type ScholarlyEvidencePacket,
  type ScholarlyMetadataRecord,
} from "../../src/core/six-screen/mechanism-literature-execution";
import { createMechanismLiteraturePlanInput } from
  "../../src/core/six-screen/mechanism-literature-plan";
import {
  applyPolicyEventCardClaimDecision,
  applyPolicyTreatmentClockDecision,
  beginPolicyEventCardReview,
  lockReviewedPolicyEventCard,
  openScreen5,
} from "../../src/core/six-screen/workflow";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";
import { createHistoricalMechanismPlan } from
  "../fixtures/archived-legacy-screen5-plan";

function at(second: number) {
  return new Date(Date.parse("2026-09-15T12:00:00.000Z") + second * 1_000)
    .toISOString();
}

function savedPlan(
  crossrefHealthy: boolean,
  openAlexHealthy = false,
  openAlexConfigured = openAlexHealthy,
) {
  const fixture = createBrowserEventCardFixture();
  let state = fixture.state;
  let begun = beginPolicyEventCardReview(state, {
    expectedRevision: state.revision,
    reviewId: "screen5-execution-review",
    projection: fixture.projection,
    startedAt: at(1),
  });
  state = begun.state;
  let review = begun.review;
  for (const claim of review.claimReviews) {
    const accepted = applyPolicyEventCardClaimDecision(state, {
      expectedRevision: state.revision,
      reviewId: review.id,
      projection: fixture.projection,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: `screen5-execution-accept-${claim.claimId}`,
      claimId: claim.claimId,
      decision: "accepted",
      rationale: "Retain the exact source-linked premise for metadata planning.",
      actor: "researcher_ui",
      decidedAt: at(2 + review.revision),
    });
    state = accepted.state;
    review = accepted.review;
  }
  const clock = applyPolicyTreatmentClockDecision(state, {
    expectedRevision: state.revision,
    reviewId: review.id,
    projection: fixture.projection,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    actionId: "screen5-execution-no-clock",
    decision: { mode: "no_selection" },
    rationale: "No reviewed legal stage establishes unit-level treatment timing.",
    actor: "researcher_ui",
    decidedAt: at(20),
  });
  const locked = lockReviewedPolicyEventCard(clock.state, {
    expectedRevision: clock.state.revision,
    reviewId: clock.review.id,
    projection: fixture.projection,
    expectedReviewRevision: clock.review.revision,
    expectedReviewFingerprint: clock.review.reviewFingerprint,
    actionId: "screen5-execution-lock",
    eventCardSnapshotId: "screen5-execution-event-card",
    rationale: "Lock the reviewed policy record for Screen 5 metadata planning.",
    actor: "researcher_ui",
    lockedAt: at(21),
  });
  const opened = openScreen5(locked.state, {
    expectedRevision: locked.state.revision,
    openedAt: at(22),
  });
  const register = buildSixScreenSourceRegister({
    ...(openAlexConfigured
      ? { configuredSecrets: { OPENALEX_API_KEY: true as const } }
      : {}),
    probes: {
      ...(crossrefHealthy
        ? {
            crossref: {
            at: at(22),
            endpoint: "https://api.crossref.org/v1/works",
            outcome: "success",
            httpStatus: 200,
            note: "Deterministic capability fixture.",
          },
          }
        : {}),
      ...(openAlexHealthy
        ? {
            openalex: {
              at: at(22),
              endpoint: "https://api.openalex.org/works",
              outcome: "success" as const,
              httpStatus: 200,
              note: "Deterministic OpenAlex capability fixture.",
            },
          }
        : {}),
    },
  });
  const saved = createHistoricalMechanismPlan(opened.state, {
    snapshotId: `screen5-literature-plan-${crossrefHealthy ? "healthy" : "default"}`,
    planInput: createMechanismLiteraturePlanInput({
      explanation: {
        mode: "stated",
        text: "The participation process may reduce barriers to market entry.",
      },
      suppliedWorks: [{
        id: "researcher-supplied-doi",
        kind: "doi",
        value: "10.1234/example.2026.1",
      }],
      preferredConstructs: ["organizational adaptation"],
      feasibleDataSources: ["dated participation filings"],
      knownAlternativeAccounts: ["concurrent market redesign"],
    }),
    capabilities: {
      openalex: register.openalex,
      crossref: register.crossref,
    },
    createdAt: at(23),
  });
  const executionPlan = createMechanismLiteratureExecutionPlan({
    id: `screen5-execution-plan-${crossrefHealthy ? "healthy" : "default"}`,
    literaturePlan: saved.plan,
    createdAt: at(24),
  });
  return { literaturePlan: saved.plan, executionPlan };
}

function stepArtifacts(input: {
  literaturePlan: ReturnType<typeof savedPlan>["literaturePlan"];
  executionPlan: MechanismLiteratureExecutionPlan;
  previous: MechanismLiteratureExecution | null;
  previousPacket: ScholarlyEvidencePacket | null;
  cumulativeRecords: ScholarlyMetadataRecord[];
  stepId: string;
  ordinal: number;
}) {
  const step = input.executionPlan.steps.find(({ id }) => id === input.stepId)!;
  const requestUrl =
    `https://api.crossref.org/v1/works?query.bibliographic=${input.ordinal}&rows=5`;
  const attemptId = `screen5-crossref-attempt-${input.ordinal}`;
  const record = createScholarlyMetadataRecord({
    schemaVersion: SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION,
    id: `screen5-crossref-record-${input.ordinal}`,
    providerId: "crossref",
    providerNativeId: `10.1234/example.${input.ordinal}`,
    doi: `10.1234/example.${input.ordinal}`,
    title: `Institutional change study ${input.ordinal}`,
    authors: ["Ada Lovelace", "Research Consortium"],
    publicationYear: 2024,
    publishedDate: "2024-02-29",
    publicationVenue: "Journal of Institutional Change",
    publisher: "Research Publisher",
    workType: "journal-article",
    stableLocator: `https://doi.org/10.1234/example.${input.ordinal}`,
    updateMetadata: {
      status: "none_reported",
      relations: [],
      caveat:
        "Crossref update metadata reports deposited relations only. No reported relation is not evidence that a work is valid, unretracted, or unchanged.",
    },
    source: {
      attemptId,
      stepId: step.id,
      rowId: step.rowId,
      branch: step.branch,
      requestUrl,
      retrievedAt: at(25 + (input.ordinal - 1) * 3 + 1),
    },
    access: {
      route: "crossref_metadata_api",
      metadata: "retrieved",
      abstract: "not_requested",
      fullText: "not_requested",
      appendix: "not_requested",
      inspectedPassageIds: [],
    },
    evidenceRole: "scholarly_metadata_lead",
    detailedClaimSupport: "not_eligible",
    limitation:
      "This record contains Crossref bibliographic metadata only. No abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.",
  });
  const attempt = createMechanismLiteratureProviderAttempt({
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION,
    id: attemptId,
    stepId: step.id,
    rowId: step.rowId,
    branch: step.branch,
    providerId: "crossref",
    startedAt: at(25 + (input.ordinal - 1) * 3),
    completedAt: at(25 + (input.ordinal - 1) * 3 + 1),
    requestUrl,
    queryFingerprint: fingerprintSixScreenValue({
      executionPlanFingerprint: input.executionPlan.planFingerprint,
      stepId: step.id,
      requestUrl,
    }),
    requestedLimit: step.plannedLimit,
    recordsReceived: 1,
    recordsAccepted: 1,
    limitReached: false,
    outcome: "metadata_leads_found",
    failureCode: null,
    note: "One bibliographic metadata lead; no abstract or full text requested.",
    scholarlyMetadataRecordIds: [record.id],
    inspectedTextIds: [],
    usage: {
      sourceQueries: 1,
      metadataRecords: 1,
      documentAttempts: 0,
      usefulDocuments: 0,
      transportHops: 1,
      receivedBytes: 100,
      decodedBytes: 100,
      activeResearchMs: 10,
      cpuMs: 0,
      providerCostUnits: {},
    },
  });
  const recordedAt = at(25 + (input.ordinal - 1) * 3 + 2);
  const execution = createMechanismLiteratureExecution({
    snapshotId: `screen5-execution-${input.ordinal}`,
    ordinal: input.ordinal,
    literaturePlan: input.literaturePlan,
    executionPlan: input.executionPlan,
    previous: input.previous,
    attempt,
    newMetadataRecordIds: [record.id],
    recordedAt,
  });
  const records = [...input.cumulativeRecords, record];
  const packet = createScholarlyEvidencePacket({
    snapshotId: `screen5-evidence-packet-${input.ordinal}`,
    ordinal: input.ordinal,
    literaturePlan: input.literaturePlan,
    execution,
    previous: input.previousPacket,
    records,
    createdAt: recordedAt,
  });
  return { attempt, record, records, execution, packet };
}

function refingerprintRecord(record: ScholarlyMetadataRecord) {
  const { recordFingerprint: _fingerprint, ...body } = record;
  return {
    ...body,
    recordFingerprint: fingerprintSixScreenValue(body),
  } as ScholarlyMetadataRecord;
}

function refingerprintPacket(packet: ScholarlyEvidencePacket) {
  const { packetFingerprint: _fingerprint, ...body } = packet;
  return {
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  } as ScholarlyEvidencePacket;
}

describe("Screen 5 bounded literature execution", () => {
  it("continues to validate immutable Crossref-only v1 execution plans", () => {
    const { literaturePlan, executionPlan } = savedPlan(true);
    const legacy = structuredClone(executionPlan);
    legacy.schemaVersion =
      SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_LEGACY_VERSION;
    legacy.scope = "crossref_metadata_foundation";
    legacy.sourceQueryCeiling = 3;
    legacy.metadataRecordCeiling = 15;
    legacy.claimBoundary =
      "This initial execution plan schedules at most one tested Crossref metadata query per literature branch. It does not schedule OpenAlex, citation expansion, document acquisition, or full-text inspection.";
    const { planFingerprint: _fingerprint, ...body } = legacy;
    legacy.planFingerprint = fingerprintSixScreenValue(body);

    expect(() => validateMechanismLiteratureExecutionPlan(
      legacy,
      literaturePlan,
    )).not.toThrow();
  });

  it("schedules tested OpenAlex before Crossref and validates unvisited location metadata", () => {
    const { executionPlan } = savedPlan(true, true);
    const pending = executionPlan.steps.filter(({ initialStatus }) =>
      initialStatus === "pending");
    expect(pending).toHaveLength(6);
    expect(pending.map(({ providerId }) => providerId)).toEqual([
      "openalex",
      "crossref",
      "openalex",
      "crossref",
      "openalex",
      "crossref",
    ]);
    const record = createScholarlyMetadataRecord({
      schemaVersion: SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION,
      id: "screen5-openalex-record-1",
      providerId: "openalex",
      providerNativeId: "https://openalex.org/W1234567890",
      doi: "10.1234/openalex.1",
      title: "Participation and organizational adaptation",
      authors: ["Ada Lovelace"],
      publicationYear: 2024,
      publishedDate: "2024-02-29",
      publicationVenue: "Journal of Institutional Change",
      publisher: "Research Publisher",
      workType: "article",
      language: "en",
      stableLocator: "https://openalex.org/W1234567890",
      updateMetadata: {
        status: "not_available_from_route",
        relations: [],
        caveat:
          "OpenAlex discovery does not supply Crossref deposited update relations. Its retraction flag is retained separately and must not be treated as a complete update check.",
      },
      openAccessLocationMetadata: {
        status: "locations_reported",
        locations: [{
          landingPageUrl: "https://repository.example/record/1",
          pdfUrl: "https://repository.example/record/1.pdf",
          sourceName: "Institutional Repository",
          sourceType: "repository",
          version: "acceptedVersion",
          license: "cc-by",
          isOpenAccess: true,
        }],
        followedLocations: 0,
        caveat:
          "OpenAlex reported locations are unvisited discovery metadata. They do not establish access rights, document identity, text availability, or evidentiary support.",
      },
      retractionMetadata: {
        status: "not_flagged",
        caveat:
          "The OpenAlex retraction flag is provider metadata only. A false flag is not evidence that the work is valid, unretracted, or unchanged.",
      },
      source: {
        attemptId: "screen5-openalex-attempt-1",
        stepId: pending[0]!.id,
        rowId: pending[0]!.rowId,
        branch: pending[0]!.branch,
        requestUrl:
          "https://api.openalex.org/works?search=participation&per_page=5",
        retrievedAt: at(25),
      },
      access: {
        route: "openalex_works_api",
        metadata: "retrieved",
        abstract: "not_requested",
        fullText: "not_requested",
        appendix: "not_requested",
        inspectedPassageIds: [],
      },
      evidenceRole: "scholarly_metadata_lead",
      detailedClaimSupport: "not_eligible",
      limitation:
        "This record contains OpenAlex work and reported-location metadata only. No reported location, abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.",
    });
    expect(() => validateScholarlyMetadataRecord(record)).not.toThrow();
    const followed = structuredClone(record);
    (followed.openAccessLocationMetadata!.followedLocations as number) = 1;
    expect(() => validateScholarlyMetadataRecord(
      refingerprintRecord(followed),
    )).toThrow(/OpenAlex route metadata/iu);
  });

  it("records an immutable no-route packet without calling it a no-match", () => {
    const { literaturePlan, executionPlan } = savedPlan(false);
    expect(executionPlan.steps.filter(({ initialStatus }) =>
      initialStatus === "pending")).toHaveLength(0);
    expect(executionPlan.steps.filter(({ providerId, initialStatus }) =>
      providerId === "openalex" && initialStatus === "not_configured"))
      .toHaveLength(3);
    expect(executionPlan.steps.filter(({ providerId, initialStatus }) =>
      providerId === "crossref" && initialStatus === "enabled_not_tested"))
      .toHaveLength(3);

    const execution = createMechanismLiteratureExecution({
      snapshotId: "screen5-execution-no-route",
      ordinal: 1,
      literaturePlan,
      executionPlan,
      previous: null,
      attempt: null,
      newMetadataRecordIds: [],
      recordedAt: at(25),
    });
    const packet = createScholarlyEvidencePacket({
      snapshotId: "screen5-evidence-packet-no-route",
      ordinal: 1,
      literaturePlan,
      execution,
      previous: null,
      records: [],
      createdAt: at(25),
    });
    expect(execution).toMatchObject({
      attempt: null,
      status: "complete",
      actualSearchBoundary: {
        sourceQueries: 0,
        metadataRecords: 0,
        documentAttempts: 0,
        stopReason: "no_executable_provider_route",
      },
    });
    expect(packet).toMatchObject({
      status: "no_scholarly_metadata",
      scholarlyMetadataReferences: [],
      inspectedTexts: [],
      scholarlyPassages: [],
      mechanismCandidates: [],
      predictionMatrix: null,
    });
    expect(JSON.stringify({ execution, packet })).not.toMatch(
      /"outcome":"no_match"|"scholarlyText":"inspected"/u,
    );
    expect(() => validateMechanismLiteratureExecutionCollections({
      literaturePlans: [literaturePlan],
      executionPlans: [executionPlan],
      executions: [execution],
      records: [],
      packets: [packet],
    })).not.toThrow();
  });

  it("uses the first configured OpenAlex metadata query as a bounded live capability probe", () => {
    const { executionPlan } = savedPlan(false, false, true);
    expect(executionPlan.steps.filter(({ providerId, initialStatus }) =>
      providerId === "openalex" && initialStatus === "pending"))
      .toHaveLength(3);
    expect(executionPlan.steps.filter(({ providerId, capabilityStatus }) =>
      providerId === "openalex" && capabilityStatus === "configured_not_tested"))
      .toHaveLength(3);
    expect(executionPlan.claimBoundary).toContain(
      "bounded live capability probe",
    );
  });

  it("advances one Crossref metadata step at a time with cumulative packet lineage", () => {
    const { literaturePlan, executionPlan } = savedPlan(true);
    const pending = executionPlan.steps.filter(({ initialStatus }) =>
      initialStatus === "pending");
    expect(pending).toHaveLength(3);
    expect(pending.every(({ providerId, plannedLimit }) =>
      providerId === "crossref" && plannedLimit === 5)).toBe(true);
    expect(executionPlan).toMatchObject({
      scope: "openalex_crossref_metadata_foundation",
      sourceQueryCeiling: 6,
      metadataRecordCeiling: 30,
      standardProfileSourceQueryCeiling: 16,
      standardProfileMetadataRecordCeiling: 80,
      citationNeighborhoodHopLimit: 0,
    });

    const first = stepArtifacts({
      literaturePlan,
      executionPlan,
      previous: null,
      previousPacket: null,
      cumulativeRecords: [],
      stepId: pending[0]!.id,
      ordinal: 1,
    });
    const second = stepArtifacts({
      literaturePlan,
      executionPlan,
      previous: first.execution,
      previousPacket: first.packet,
      cumulativeRecords: first.records,
      stepId: pending[1]!.id,
      ordinal: 2,
    });
    expect(second.execution).toMatchObject({
      ordinal: 2,
      previousExecutionSnapshotId: first.execution.snapshotId,
      status: "active",
      scholarlyMetadataRecordIds: [first.record.id, second.record.id],
      actualSearchBoundary: {
        sourceQueries: 2,
        metadataRecords: 2,
        retainedMetadataRecordCount: 2,
        citationNeighborhoodHops: 0,
        documentAttempts: 0,
      },
      evidenceStatus: {
        scholarlyMetadata: "retrieved",
        scholarlyText: "not_inspected",
        suppliedWorks: "not_inspected",
      },
    });
    expect(second.packet).toMatchObject({
      ordinal: 2,
      binding: {
        previousPacketSnapshotId: first.packet.snapshotId,
        executionSnapshotId: second.execution.snapshotId,
      },
      status: "metadata_only",
      inspectedTexts: [],
      scholarlyPassages: [],
      mechanismCandidates: [],
      predictionMatrix: null,
    });
    expect(() => validateMechanismLiteratureExecutionCollections({
      literaturePlans: [literaturePlan],
      executionPlans: [executionPlan],
      executions: [first.execution, second.execution],
      records: second.records,
      packets: [first.packet, second.packet],
    })).not.toThrow();
  });

  it("rejects re-fingerprinted text claims, invalid dates, and changed lineage", () => {
    const { literaturePlan, executionPlan } = savedPlan(true);
    const stepId = executionPlan.steps.find(({ initialStatus }) =>
      initialStatus === "pending")!.id;
    const artifact = stepArtifacts({
      literaturePlan,
      executionPlan,
      previous: null,
      previousPacket: null,
      cumulativeRecords: [],
      stepId,
      ordinal: 1,
    });

    const textClaim = structuredClone(artifact.record);
    (textClaim.access.fullText as string) = "retrieved";
    expect(() => validateScholarlyMetadataRecord(
      refingerprintRecord(textClaim),
    )).toThrow(/metadata record is invalid/iu);

    const impossibleDate = structuredClone(artifact.record);
    impossibleDate.publishedDate = "2024-02-31";
    expect(() => validateScholarlyMetadataRecord(
      refingerprintRecord(impossibleDate),
    )).toThrow(/publication date/iu);

    const mechanismClaim = structuredClone(artifact.packet);
    (mechanismClaim.mechanismCandidates as unknown[]) = [{
      statement: "Invented mechanism",
    }];
    expect(() => validateScholarlyEvidencePacket({
      packet: refingerprintPacket(mechanismClaim),
      literaturePlan,
      execution: artifact.execution,
      records: artifact.records,
    })).toThrow(/evidence packet is invalid/iu);

    const changedPremise = structuredClone(artifact.packet);
    changedPremise.policyPremiseReferences[0]!.passageIds = ["forged-passage"];
    expect(() => validateScholarlyEvidencePacket({
      packet: refingerprintPacket(changedPremise),
      literaturePlan,
      execution: artifact.execution,
      records: artifact.records,
    })).toThrow(/policy-premise lineage/iu);

    const changedRecord = structuredClone(artifact.record);
    changedRecord.title = "Re-fingerprinted but different metadata";
    expect(() => validateScholarlyEvidencePacket({
      packet: artifact.packet,
      literaturePlan,
      execution: artifact.execution,
      records: [refingerprintRecord(changedRecord)],
    })).toThrow(/scholarly metadata lineage/iu);
  });
});
