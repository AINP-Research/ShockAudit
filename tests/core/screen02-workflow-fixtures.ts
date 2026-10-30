import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import {
  createScreen02Session,
} from "../../src/core/screen02-service";
import {
  buildScreen02FindDiscoveryFromProposals,
  buildScreen02SearchFunnel,
  type Screen02FindDiscoveryResult,
} from "../../src/core/screen02-find-discovery";
import {
  qualifyAndRankScreen02FindProposals,
  qualifyScreen02FindProposal,
} from "../../src/core/screen02-qualification";
import { restoreScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import {
  buildScreen01StudyContext,
} from "../../src/core/study-context";
import {
  decisionKeys,
  type Screen01StudyContext,
} from "../../src/core/scope-types";
import {
  continueScreen02Audit,
  continueScreen02FindCandidate,
  createScreen02AuditState,
  createScreen02FindState,
  finalizeScreen02FindCandidateAssessmentRequest,
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  prepareScreen02AssessmentRequest,
  requireScreen02AuditState,
  requireScreen02FindState,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  buildScreen02RetainedResultBinding,
  buildScreen02RetrievalExecution,
  screen02AuditAssessmentPartIds,
  screen02AuditDossierPartIds,
  screen02FindAssessmentPartIds,
  type Screen02AuditDossier,
  type Screen02AuditState,
  type Screen02FindCandidateAssessment,
  type Screen02FindState,
  type Screen02RetainedResultOrigin,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
} from "../../src/core/screen02-workflow-types";
import type { Screen02FindProposal } from "../../src/core/screen02-types";
import { frozenScreen02V020LockedAuditEnvelope } from "./screen02-v0.2.20-locked-audit-envelope";

export const fixtureAt = "2026-08-09T18:00:00.000Z";

export function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function confirmedWorkflowFindContext(
  industry = "Technology",
  options: {
    outcomeFamily?: string;
    eventDescriptor?: string;
    studyPeriod?: string;
  } = {},
): Screen01StudyContext {
  const initial = createInitialState("find");
  const outcomeFamily = options.outcomeFamily ?? "Innovation";
  const eventDescriptor = options.eventDescriptor ?? "privacy regulation";
  const studyPeriod = options.studyPeriod ?? "2016–2020";
  const sentencePeriod = studyPeriod.replace(/\s*[–—-]\s*/gu, " to ");
  const sentence = industry === "All industries"
    ? `Find a ${eventDescriptor} affecting U.S. publicly listed firms across all industries from ${sentencePeriod} that may influence ${outcomeFamily.toLocaleLowerCase("en-US")}.`
    : `Find a ${eventDescriptor} affecting U.S. publicly listed ${industry.toLocaleLowerCase("en-US")} firms from ${sentencePeriod} that may influence ${outcomeFamily.toLocaleLowerCase("en-US")}.`;
  const result = confirmScopeContract({
    ...initial,
    revision: 8,
    sentence,
    contractSourceSentence: sentence,
    scope: {
      population: `U.S. publicly listed ${industry.toLocaleLowerCase("en-US")} firms`,
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry,
      studyPeriod,
      eventFamily: "Regulation",
      outcomeFamily,
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

export function confirmedWorkflowAuditContext(
  outcomeFamily = "Innovation",
): Screen01StudyContext {
  const initial = createInitialState("audit");
  const sentence =
    `Audit whether the California Consumer Privacy Act affected ${outcomeFamily.toLocaleLowerCase("en-US")} among U.S. publicly listed technology firms from 2015 to 2023.`;
  const result = confirmScopeContract({
    ...initial,
    revision: 9,
    sentence,
    contractSourceSentence: sentence,
    knownShock: "California Consumer Privacy Act",
    scope: {
      population: "U.S. publicly listed technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily,
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

export function workflowSource(
  id: string,
  overrides: Partial<Omit<Screen02WorkflowSource, "sourceFingerprint">> = {},
): Screen02WorkflowSource {
  const source: Omit<Screen02WorkflowSource, "sourceFingerprint"> = {
    id,
    title: `Official source ${id}`,
    locator: `https://example.test/${id}`,
    publisher: "Official publisher",
    publishedDate: "2018-01-01",
    authorityTier: 1,
    channel: "official-primary",
    retrievedAt: fixtureAt,
    userProvided: false,
    ...overrides,
  };
  return {
    ...source,
    sourceFingerprint: fingerprintScreen02WorkflowValue(source),
  };
}

export function workflowManifest(
  exactRequest: string,
  retainedResultCount = 1,
): Screen02WorkflowSearchManifest {
  const returnedRecordIds = Array.from(
    { length: retainedResultCount },
    (_value, index) => `record-${index + 1}`,
  );
  return {
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
    exactRequest,
    queryMatrix: [
      {
        id: "query-1",
        query: exactRequest,
        purpose: "Locate a bounded official-source event lead.",
        returnedRecordIds,
      },
    ],
    channels: [
      {
        channel: "official-primary",
        status: "searched",
        note: "One bounded official route was searched.",
        retrievedAt: fixtureAt,
      },
    ],
    exclusions: [],
    funnel: {
      schemaVersion: SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
      sourceRecordsRetrieved: retainedResultCount,
      uniqueEventLeads: retainedResultCount,
      evaluatedUniqueLeads: retainedResultCount,
      duplicatesRemoved: 0,
      hardScopePassed: retainedResultCount,
      hardScopeDemonstratedMismatch: 0,
      hardScopeInsufficientEvidence: 0,
      hardScopeMixed: 0,
      sourceQualityPassed: retainedResultCount,
      substantiveInformationPassed: retainedResultCount,
      relevancePassed: retainedResultCount,
      exposureFeasibilityPassed: retainedResultCount,
      qualifiedCandidates: retainedResultCount,
      displayedCandidates: retainedResultCount,
      directCandidates: retainedResultCount,
      adjacentCandidates: 0,
      broadCandidates: 0,
      mismatchCandidates: 0,
      deeperRetrievalAttempts: 0,
      retrievalFailures: 0,
      hostContribution: 0,
    },
    retrievalExecution: buildScreen02RetrievalExecution({
      baseline: {
        phase: "baseline",
        status: "completed",
        queryIds: ["query-1"],
        stoppingReason: "routes-exhausted",
        queriesPlanned: 1,
        queriesAttempted: 1,
        queriesSucceeded: 1,
        queriesFailed: 0,
        roundsExecuted: 1,
        recordsReceived: retainedResultCount,
        proposalsGenerated: retainedResultCount,
        uniqueProposalsGenerated: retainedResultCount,
      },
    }),
    stoppingRule: {
      rule: "Stop after the bounded official-source fixture is recorded.",
      status: "met",
      note: "The fixture event was retained.",
    },
    retrievedAt: fixtureAt,
    outcomeValuesInspected: false,
  };
}

function fixtureQueryOrigin(input: {
  producerRecordId: string;
  sourceIds: readonly string[];
  queryId?: string;
  retrievalLane?: "official-baseline" | "reviewed-registry";
}): Screen02RetainedResultOrigin {
  return {
    kind: "query-result",
    retrievalLane: input.retrievalLane ?? "official-baseline",
    evidenceRole: "identity",
    producerRecordId: input.producerRecordId,
    queryId: input.queryId ?? "query-1",
    returnedRecordIds: [input.producerRecordId],
    sourceIds: [...input.sourceIds],
  };
}

/**
 * Test-only official-source discovery for workflow/controller tests. Each
 * proposal retains the exact passage used by fixed qualification; no expected
 * eligibility is injected, and the production qualifier remains decisive.
 */
export function buildSourceQualifiedFindDiscoveryFixture(
  state: Screen02FindState,
  input: {
    searchRoundId: string;
    at: string;
    exactRequest: string;
    maximumCandidates: number;
  },
): Screen02FindDiscoveryResult {
  const population =
    "U.S. publicly listed technology firms meeting the instrument's coverage conditions";
  const proposal = (facts: {
    id: string;
    title: string;
    formalIdentifier: string;
    issuer: string;
    issuingJurisdiction: string;
    date: string;
    publishedDate: string;
    description: string;
    regulatedActivity: string;
    sourceId: string;
    sourceTitle: string;
    locator: string;
    publisher: string;
  }): Screen02FindProposal => ({
    id: facts.id,
    mode: "find",
    kind: "event",
    title: facts.title,
    description: facts.description,
    nativeIdentity: {
      formalIdentifier: facts.formalIdentifier,
      issuer: facts.issuer,
      issuingJurisdiction: facts.issuingJurisdiction,
      status: "Final instrument",
    },
    event: {
      displayName: facts.title,
      eventDate: facts.date,
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: [population],
    },
    origin: "registry-reviewed",
    provisionalDates: [`Applicable date: ${facts.date}`],
    affectedPopulation: population,
    requiredVariables: [
      "Covered-firm status",
      `${facts.regulatedActivity} exposure indicator`,
      "Applicable date",
    ],
    outcomeLink: {
      text:
        "A preliminary compliance pathway may matter for innovation; no outcome value was inspected.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Screen 3 must verify operative provisions and firm-level coverage.",
    ],
    reasons: [
      "The test fixture retains an exact authoritative passage for fixed qualification.",
    ],
    sources: [{
      id: facts.sourceId,
      title: facts.sourceTitle,
      locator: facts.locator,
      publisher: facts.publisher,
      publishedDate: facts.publishedDate,
      authorityTier: 1,
      channel: "official-primary",
      retrievedAt: input.at,
      evidenceText:
        `${facts.title}, ${facts.formalIdentifier}, was issued by ${facts.issuer} and became applicable on ${facts.date}. ${facts.description} It applies in the United States to ${population} and requires a documented change in ${facts.regulatedActivity}.`,
    }],
  });
  const proposals = [
    proposal({
      id: "registry-eu-gdpr-2018",
      title: "General Data Protection Regulation",
      formalIdentifier: "Regulation (EU) 2016/679",
      issuer: "European Parliament and Council",
      issuingJurisdiction: "European Union",
      date: "2018-05-25",
      publishedDate: "2016-05-04",
      description:
        "The final regulation requires covered technology firms to change personal-data processing and disclosure practices.",
      regulatedActivity: "personal data processing",
      sourceId: "source-eu-gdpr-regulation-2016-679",
      sourceTitle: "Regulation (EU) 2016/679",
      locator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
      publisher: "Official Journal of the European Union",
    }),
    proposal({
      id: "registry-us-california-ccpa-2020",
      title: "California Consumer Privacy Act",
      formalIdentifier: "AB 375",
      issuer: "California Legislature",
      issuingJurisdiction: "California",
      date: "2020-01-01",
      publishedDate: "2018-06-29",
      description:
        "The final statute requires covered technology firms to change personal-information disclosure and consumer-request practices.",
      regulatedActivity: "personal information governance",
      sourceId: "source-us-california-ccpa-ab375",
      sourceTitle: "California Assembly Bill 375, Chapter 55",
      locator:
        "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
      publisher: "California Legislative Information",
    }),
    proposal({
      id: "registry-us-california-iot-security-2020",
      title: "California Security of Connected Devices Law",
      formalIdentifier: "SB 327",
      issuer: "California Legislature",
      issuingJurisdiction: "California",
      date: "2020-01-01",
      publishedDate: "2018-09-28",
      description:
        "The final statute requires covered technology manufacturers to change connected-device security practices.",
      regulatedActivity: "connected device manufacturing",
      sourceId: "source-us-california-sb327-connected-devices",
      sourceTitle: "SB-327 Information privacy: connected devices",
      locator:
        "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB327",
      publisher: "California Legislative Information",
    }),
  ];
  const qualification = qualifyAndRankScreen02FindProposals(
    proposals,
    state.screen01Baseline as unknown as Screen01StudyContext,
    {
      scopeFingerprint: state.screen01Fingerprint,
      maximumCandidates: input.maximumCandidates,
      studyProfile: state.relevanceProfile ?? undefined,
    },
  );
  const selected = qualification.selected.map((entry) => entry.proposal);
  const manifest = workflowManifest(input.exactRequest);
  manifest.retrievedAt = input.at;
  manifest.queryMatrix = manifest.queryMatrix.map((query) => ({
    ...query,
    returnedRecordIds: selected.map((candidate) => candidate.id),
  }));
  manifest.funnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved: proposals.length,
    uniqueEventLeads: proposals.length,
    qualifications: qualification.evaluated.map((entry) => entry.qualification),
    displayedCandidates: selected.length,
  });
  const exclusionsById = new Map<string, {
    recordId: string;
    reason: string;
    qualification: typeof qualification.excluded[number]["qualification"];
  }>();
  for (const entry of qualification.excluded) {
    const prior = exclusionsById.get(entry.proposal.id);
    exclusionsById.set(entry.proposal.id, {
      recordId: entry.proposal.id,
      reason: [...new Set([
        ...(prior ? [prior.reason] : []),
        entry.reason,
      ])].join(" "),
      qualification: entry.qualification,
    });
  }
  manifest.exclusions = [...exclusionsById.values()];
  return buildScreen02FindDiscoveryFromProposals(state, {
    searchRoundId: input.searchRoundId,
    at: input.at,
    proposals: selected,
    qualifications: qualification.selected.map((entry) => entry.qualification),
    manifest,
    resultOrigins: selected.map((candidate) => ({
      proposalId: candidate.id,
      origins: [fixtureQueryOrigin({
        producerRecordId: candidate.id,
        sourceIds: candidate.sources.map((source) => source.id),
      })],
    })),
  });
}

export function buildFindFactsState(
  options: {
    candidate?: "gdpr" | "ccpa" | "minimum-wage";
    outcomeFamily?: string;
  } = {},
): Screen02FindState {
  const candidateKind = options.candidate ?? "gdpr";
  const candidateDefinition = candidateKind === "ccpa"
    ? {
        sourceId: "ccpa-official",
        sourceTitle: "California Consumer Privacy Act of 2018",
        sourceLocator:
          "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3&part=4&lawCode=CIV&title=1.81.5",
        sourcePublisher: "California Legislative Information",
        sourcePublishedDate: "2018-06-28",
        candidateId: "ccpa",
        candidateSnapshotId: "ccpa-candidate-snapshot-v1",
        canonicalTitle: "California Consumer Privacy Act",
        commonNames: ["CCPA"],
        formalIdentifier: "California Civil Code §§ 1798.100–1798.199.100",
        issuer: "California Legislature",
        issuingJurisdiction: "California",
        description:
          "The CCPA gives California consumers privacy rights and places data-use, disclosure, deletion, and opt-out obligations on covered businesses.",
        date: "2020-01-01",
        dateLabel: "Operative date lead",
        broadCoverage:
          "Some for-profit businesses doing business in California and meeting statutory thresholds may be covered.",
        apparentExposureVariables: [
          "California business activity",
          "Consumer-data volume",
          "Statutory revenue or data thresholds",
        ],
        limitation:
          "The current source lead does not establish which sampled firms met the applicable CCPA threshold in each year.",
        eventDescriptor: "privacy regulation",
        studyPeriod: "2016–2023",
      }
    : candidateKind === "minimum-wage"
      ? {
          sourceId: "california-minimum-wage-official",
          sourceTitle: "California Minimum Wage",
          sourceLocator: "https://www.dir.ca.gov/dlse/minimum_wage.htm",
          sourcePublisher: "California Department of Industrial Relations",
          sourcePublishedDate: "2023-12-01",
          candidateId: "california-minimum-wage",
          candidateSnapshotId: "california-minimum-wage-snapshot-v1",
          canonicalTitle: "California Statewide Minimum Wage Increase",
          commonNames: ["California minimum wage"],
          formalIdentifier: "California Labor Code section 1182.12",
          issuer: "California Legislature",
          issuingJurisdiction: "California",
          description:
            "California increased the statewide hourly minimum wage that covered employers must pay workers.",
          date: "2024-01-01",
          dateLabel: "Effective wage lead",
          broadCoverage:
            "Covered California employers must pay at least the applicable statewide minimum wage, subject to specific rules and exceptions.",
          apparentExposureVariables: [
            "Pre-change low-wage employment share",
            "California employee count",
            "Applicable local wage floor",
          ],
          limitation:
            "The current source lead does not establish each sampled firm's worker locations or pre-change wage distribution.",
          eventDescriptor: "labor regulation",
          studyPeriod: "2020–2025",
        }
      : {
          sourceId: "gdpr-official",
          sourceTitle: "Regulation (EU) 2016/679",
          sourceLocator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
          sourcePublisher: "Official Journal of the European Union",
          sourcePublishedDate: "2016-05-04",
          candidateId: "gdpr",
          candidateSnapshotId: "gdpr-candidate-snapshot-v1",
          canonicalTitle: "General Data Protection Regulation",
          commonNames: ["GDPR"],
          formalIdentifier: "Regulation (EU) 2016/679",
          issuer: "European Parliament and Council",
          issuingJurisdiction: "European Union",
          description:
            "The GDPR created a source-backed privacy-regulation event lead.",
          date: "2018-05-25",
          dateLabel: "Application date lead",
          broadCoverage:
            "EU establishments and some qualifying non-EU controllers or processors may be covered.",
          apparentExposureVariables: [
            "EU establishment",
            "EU-facing goods or services",
            "Monitoring of people in the EU",
          ],
          limitation:
            "The U.S. study population is broader than firms demonstrably covered by the current source lead.",
          eventDescriptor: "privacy regulation",
          studyPeriod: "2016–2020",
        };
  const opened = createScreen02FindState(
    confirmedWorkflowFindContext("Technology", {
      outcomeFamily: options.outcomeFamily,
      eventDescriptor: candidateDefinition.eventDescriptor,
      studyPeriod: candidateDefinition.studyPeriod,
    }),
    "workflow-find-run",
    fixtureAt,
  );
  const source = workflowSource(candidateDefinition.sourceId, {
    title: candidateDefinition.sourceTitle,
    locator: candidateDefinition.sourceLocator,
    publisher: candidateDefinition.sourcePublisher,
    publishedDate: candidateDefinition.sourcePublishedDate,
  });
  const candidateBase = {
    candidateId: candidateDefinition.candidateId,
    candidateSnapshotId: candidateDefinition.candidateSnapshotId,
    searchRoundId: "find-round-1",
    origin: "registry-reviewed" as const,
    identity: {
      canonicalTitle: candidateDefinition.canonicalTitle,
      commonNames: candidateDefinition.commonNames,
      formalIdentifier: candidateDefinition.formalIdentifier,
      issuer: candidateDefinition.issuer,
      issuingJurisdiction: candidateDefinition.issuingJurisdiction,
      eventType: "Regulation",
      status: "In force",
    },
    description: {
      id: `${candidateDefinition.candidateId}-description`,
      text: candidateDefinition.description,
      sourceIds: [source.id],
      status: "provisional" as const,
      uncertainty: "Screen 3 must verify operative provisions and timing.",
    },
    dateLeads: [
      {
        id: `${candidateDefinition.candidateId}-application-lead`,
        date: candidateDefinition.date,
        label: candidateDefinition.dateLabel,
        stage: "effective" as const,
        sourceIds: [source.id],
        status: "provisional" as const,
        uncertainty: "The study-relevant event clock remains unverified.",
      },
    ],
    broadCoverage: [
      {
        id: `${candidateDefinition.candidateId}-coverage-lead`,
        text: candidateDefinition.broadCoverage,
        sourceIds: [source.id],
        status: "provisional" as const,
        uncertainty: "Firm-level coverage is not established.",
      },
    ],
    apparentExposureVariables: candidateDefinition.apparentExposureVariables,
    sourceIds: [source.id],
    limitations: [
      candidateDefinition.limitation,
    ],
    recordedAt: fixtureAt,
  };
  const candidate = {
    ...candidateBase,
    candidateFingerprint: fingerprintScreen02WorkflowValue(candidateBase),
  };
  const raw = cloneFixture(opened) as Screen02FindState;
  raw.revision = 1;
  raw.updatedAt = "2026-08-09T18:00:01.000Z";
  raw.sources = [source];
  raw.candidates = [candidate];
  const candidateSetSnapshot = {
    candidateSetSnapshotId: "find-candidate-set-v1",
    searchRoundId: "find-round-1",
    candidateSnapshotIds: [candidate.candidateSnapshotId],
    criterionVersionRefs: [],
    ordering: [
      {
        candidateSnapshotId: candidate.candidateSnapshotId,
        rank: 1,
        reason: "Only retained source-backed candidate in the fixture.",
      },
    ],
    manifest: {
      ...workflowManifest(
        `Find a ${candidateDefinition.eventDescriptor} relevant to the confirmed study.`,
      ),
      retainedResultBinding: buildScreen02RetainedResultBinding(
        "find",
        {
          sourceRecordsRetrieved: 1,
          uniqueEventLeads: 1,
        },
        [{
          recordId: candidate.candidateId,
          snapshotId: candidate.candidateSnapshotId,
          sourceIds: [...candidate.sourceIds],
          qualificationLane: null,
          origins: [fixtureQueryOrigin({
            producerRecordId: "record-1",
            sourceIds: candidate.sourceIds,
          })],
        }],
      ),
    },
  };
  raw.candidateSets = [
    {
      ...candidateSetSnapshot,
      candidateSetFingerprint:
        fingerprintScreen02WorkflowValue(candidateSetSnapshot),
      status: "active",
      supersededBySnapshotId: null,
    },
  ];
  raw.discoveryRequests = [{
    discoveryRequestId: "find-discovery-request-v1",
    searchRoundId: "find-round-1",
    candidateSetSnapshotId: "find-candidate-set-v1",
    exactRequest: candidateSetSnapshot.manifest.exactRequest,
    status: "completed",
    startedAt: fixtureAt,
    updatedAt: raw.updatedAt,
    failureCodes: [],
    supersededByDiscoveryRequestId: null,
    lifecycle: [
      { status: "searching", at: fixtureAt, note: null },
      {
        status: "completed",
        at: raw.updatedAt,
        note: "The fixture discovery retained one immutable candidate.",
      },
    ],
  }];
  raw.activeCandidateSetSnapshotId = "find-candidate-set-v1";
  return requireScreen02FindState(raw);
}

/**
 * Builds one source-bound, fixed-qualified GDPR result for tests whose subject
 * is downstream workflow behavior rather than discovery coverage. The
 * retained passage names every candidate fact used by fixed qualification.
 */
export function buildFixedQualifiedFindState(
  runId = "workflow-fixed-qualified-find-run",
): Screen02FindState {
  const raw = cloneFixture(buildFindFactsState());
  raw.runId = runId;
  const candidate = raw.candidates[0]!;
  const date = candidate.dateLeads[0]?.date ?? "2018-05-25";
  const population =
    "U.S. publicly listed technology firms meeting the regulation's territorial criteria";
  const description =
    "The final regulation requires covered U.S. publicly listed technology firms meeting its territorial criteria to change personal-data processing and disclosure practices beginning in 2018.";
  const source = raw.sources.find((entry) =>
    candidate.sourceIds.includes(entry.id)
  );
  if (!source) throw new Error("Expected the fixed-qualified official source.");
  const { sourceFingerprint: _sourceFingerprint, ...sourceFacts } = source;
  const sourceWithEvidence = {
    ...sourceFacts,
    evidenceText:
      `General Data Protection Regulation, Regulation (EU) 2016/679, was issued by the European Parliament and Council for the European Union and applies beginning 2018-05-25. ${description} Its territorial scope may apply in the United States to ${population} when they offer goods or services to, or monitor, people in the European Union.`,
  };
  raw.sources[raw.sources.indexOf(source)] = {
    ...sourceWithEvidence,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceWithEvidence),
  };
  const proposal: Screen02FindProposal = {
    id: candidate.candidateId,
    mode: "find",
    kind: "event",
    title: candidate.identity.canonicalTitle,
    description,
    nativeIdentity: {
      formalIdentifier: candidate.identity.formalIdentifier,
      issuer: candidate.identity.issuer,
      issuingJurisdiction: candidate.identity.issuingJurisdiction,
      status: candidate.identity.status,
    },
    event: {
      displayName: candidate.identity.canonicalTitle,
      eventDate: date,
      eventFamily: raw.screen01Baseline.scopeContract.eventFamily,
      geographies: ["United States"],
      populations: [population],
    },
    origin: candidate.origin,
    provisionalDates: [date],
    affectedPopulation: population,
    requiredVariables: [...candidate.apparentExposureVariables],
    outcomeLink: {
      text:
        "A preliminary privacy-compliance pathway may matter for innovation, subject to Screen 3 verification.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [...candidate.limitations],
    reasons: ["Retained by the source-bound fixed-qualification fixture."],
    sources: raw.sources
      .filter((entry) => candidate.sourceIds.includes(entry.id))
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
    raw.screen01Baseline as unknown as Screen01StudyContext,
    {
      scopeFingerprint: raw.screen01Fingerprint,
      studyProfile: raw.relevanceProfile ?? undefined,
    },
  );
  if (!qualification.eligible) {
    throw new Error(
      `Expected the fixed-qualified fixture to qualify: ${qualification.exclusionCodes.join(", ")}`,
    );
  }
  const { candidateFingerprint: _candidateFingerprint, ...candidateFacts } = {
    ...candidate,
    description: { ...candidate.description, text: description },
    qualification,
  };
  raw.candidates[0] = {
    ...candidateFacts,
    candidateFingerprint: fingerprintScreen02WorkflowValue(candidateFacts),
  };
  const activeSet = raw.candidateSets.find(
    (set) => set.candidateSetSnapshotId === raw.activeCandidateSetSnapshotId,
  );
  const boundResult = activeSet?.manifest.retainedResultBinding?.results.find(
    (result) => result.snapshotId === candidate.candidateSnapshotId,
  );
  if (!activeSet || !boundResult) {
    throw new Error("Expected the fixed-qualified fixture result binding.");
  }
  boundResult.qualificationLane = qualification.lane;
  activeSet.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(
    activeSet,
  );
  return requireScreen02FindState(raw);
}

function completeRequest(
  state: Screen02FindState | Screen02AuditState,
  requestId: string,
  acceptedPartIds: readonly string[],
  times: {
    delivered: string;
    draft: string;
    validating: string;
    completed: string;
  },
) {
  let next = transitionScreen02AssessmentRequest(state, {
    requestId,
    status: "message-delivered",
    at: times.delivered,
    actor: "chatgpt-host",
  });
  next = transitionScreen02AssessmentRequest(next, {
    requestId,
    status: "draft-received",
    at: times.draft,
    actor: "chatgpt-host",
    receiptId: `${requestId}:receipt`,
  });
  next = transitionScreen02AssessmentRequest(next, {
    requestId,
    status: "validating",
    at: times.validating,
    actor: "fixed-core",
  });
  return transitionScreen02AssessmentRequest(next, {
    requestId,
    status: "completed",
    at: times.completed,
    actor: "fixed-core",
    acceptedPartIds: [...acceptedPartIds],
  });
}

export function buildReadyFindState(): Screen02FindState {
  let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
    jobId: "find-assessment-job-1",
    requestId: "find-assessment-request-1",
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  }) as Screen02FindState;
  for (const transition of [
    {
      status: "message-delivered" as const,
      at: "2026-08-09T18:00:03.000Z",
      actor: "chatgpt-host" as const,
    },
    {
      status: "draft-received" as const,
      at: "2026-08-09T18:00:04.000Z",
      actor: "chatgpt-host" as const,
      receiptId: "find-assessment-request-1:receipt",
    },
    {
      status: "validating" as const,
      at: "2026-08-09T18:00:05.000Z",
      actor: "fixed-core" as const,
    },
  ]) {
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "find-assessment-request-1",
      ...transition,
    }) as Screen02FindState;
  }
  const assessment: Screen02FindCandidateAssessment = {
    assessmentId: "find-assessment-1",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    requestId: "find-assessment-request-1",
    status: "completed",
    studyFit: {
      category: "strong",
      explanation:
        "The application date falls within the study period and the territorial-scope lead makes the foreign-issued event potentially relevant to U.S. firms.",
      evidenceSourceIds: ["gdpr-official"],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy compliance duties may redirect data and engineering resources and alter product experimentation linked to innovation.",
      evidenceSourceIds: ["gdpr-official"],
    },
    measurementPotential: {
      category: "possible",
      explanation:
        "EU establishment, EU-facing services, and monitoring activity provide possible public exposure indicators, subject to Screen 3 verification.",
      evidenceSourceIds: ["gdpr-official"],
    },
    mainConcern:
      "The U.S. technology-firm population is broader than firms demonstrably covered by the current territorial-scope lead.",
    nextChecks: [
      "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
      "Determine whether exposure varies sufficiently across sampled firms.",
    ],
    evidenceSourceIds: ["gdpr-official"],
    acceptedFields: [
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ],
    overallJudgment: "promising-to-verify",
    overallJudgmentMethod: "fixed-computation",
    recordedAt: "2026-08-09T18:00:06.000Z",
  };
  state = finalizeScreen02FindCandidateAssessmentRequest(state, {
    requestId: "find-assessment-request-1",
    status: "completed",
    at: "2026-08-09T18:00:06.000Z",
    note: "The fixture assessment passed fixed validation.",
    acceptedPartIds: [...screen02FindAssessmentPartIds],
    failures: [],
    assessment,
  });
  let ready = requireScreen02FindState(state);
  ready = selectScreen02FindCandidate(
    ready,
    "gdpr-candidate-snapshot-v1",
    "find-selection-1",
    "2026-08-09T18:00:08.000Z",
    "Researcher selected the source-backed GDPR candidate.",
  );
  return continueScreen02FindCandidate(
    ready,
    "find-continuation-1",
    "2026-08-09T18:00:09.000Z",
    "Researcher continued to formal event verification.",
  );
}

export function buildAuditIdentityState(
  context = confirmedWorkflowAuditContext(),
): Screen02AuditState {
  const opened = createScreen02AuditState(
    context,
    "workflow-audit-run",
    fixtureAt,
  );
  const source = workflowSource("ccpa-official", {
    title: "California Consumer Privacy Act of 2018",
    locator:
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
    publisher: "California Legislative Information",
    publishedDate: "2018-06-28",
  });
  const matchBase = {
    matchId: "ccpa-match",
    matchSnapshotId: "ccpa-match-snapshot-v1",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    matchSetSnapshotId: "ccpa-match-set-v1",
    anchorRevisionId: opened.anchor.activeRevisionId,
    identity: {
      canonicalTitle: "California Consumer Privacy Act of 2018",
      commonNames: ["CCPA"],
      formalIdentifier: "AB 375 (Chapter 55, Statutes of 2018)",
      issuer: "California Legislature",
      issuingJurisdiction: "California, United States",
      eventType: "Statute",
      status: "Enacted",
    },
    relationship: "exact" as const,
    relationshipReason:
      "The official title, common acronym, jurisdiction, and enactment year match the named shock.",
    sourceIds: [source.id],
    limitations: [
      "The statute, later regulations, enforcement activity, and later amendments must remain distinguishable.",
    ],
    recordedAt: fixtureAt,
  };
  const match = {
    ...matchBase,
    matchFingerprint: fingerprintScreen02WorkflowValue(matchBase),
  };
  const raw = cloneFixture(opened);
  raw.revision = 1;
  raw.updatedAt = "2026-08-09T18:10:01.000Z";
  raw.sources = [source];
  raw.possibleMatches = [match];
  const matchSetSnapshot = {
    matchSetSnapshotId: "ccpa-match-set-v1",
    anchorRevisionId: opened.anchor.activeRevisionId,
    possibleMatchSnapshotIds: [match.matchSnapshotId],
    manifest: {
      ...workflowManifest(
        "Resolve the named California Consumer Privacy Act.",
      ),
      retainedResultBinding: buildScreen02RetainedResultBinding(
        "audit",
        {
          sourceRecordsRetrieved: 1,
          uniqueEventLeads: 1,
        },
        [{
          recordId: match.matchId,
          snapshotId: match.matchSnapshotId,
          sourceIds: [...match.sourceIds],
          qualificationLane: null,
          origins: [fixtureQueryOrigin({
            producerRecordId: "record-1",
            sourceIds: match.sourceIds,
          })],
        }],
      ),
    },
  };
  raw.matchSets = [
    {
      ...matchSetSnapshot,
      matchSetFingerprint:
        fingerprintScreen02WorkflowValue(matchSetSnapshot),
      status: "active",
      supersededBySnapshotId: null,
    },
  ];
  raw.activeMatchSetSnapshotId = "ccpa-match-set-v1";
  let dossierState = prepareScreen02AssessmentRequest(
    requireScreen02AuditState(raw),
    {
      jobId: "ccpa-dossier-job-1",
      requestId: "ccpa-dossier-request-1",
      mode: "audit-dossier",
      identitySnapshotId: match.identitySnapshotId,
      attempt: 1,
      requestedPartIds: [...screen02AuditDossierPartIds],
      at: "2026-08-09T18:10:02.000Z",
    },
  ) as Screen02AuditState;
  dossierState = completeRequest(
    dossierState,
    "ccpa-dossier-request-1",
    screen02AuditDossierPartIds,
    {
      delivered: "2026-08-09T18:10:03.000Z",
      draft: "2026-08-09T18:10:04.000Z",
      validating: "2026-08-09T18:10:05.000Z",
      completed: "2026-08-09T18:10:06.000Z",
    },
  ) as Screen02AuditState;
  const confirmedRaw = cloneFixture(dossierState);
  confirmedRaw.revision += 1;
  confirmedRaw.updatedAt = "2026-08-09T18:10:07.000Z";
  const dossierSnapshot: Omit<
    Screen02AuditDossier,
    "dossierFingerprint"
  > = {
      dossierSnapshotId: "ccpa-dossier-v1",
      identitySnapshotId: match.identitySnapshotId,
      requestId: "ccpa-dossier-request-1",
      status: "completed",
      atAGlance: [
        {
          id: "ccpa-title-claim",
          text: "The possible match is the California Consumer Privacy Act of 2018, commonly called CCPA.",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty: null,
        },
      ],
      whatHappened: {
        id: "ccpa-summary-claim",
        text: "California enacted a consumer-privacy statute creating rights and business obligations.",
        sourceIds: [source.id],
        status: "provisional",
        uncertainty:
          "Screen 3 must verify the operative provisions and their study relevance.",
      },
      whatChanged: [
        {
          id: "ccpa-change-claim",
          text: "The statute created consumer rights and data-governance duties for covered businesses.",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty:
            "This is a high-level identity explanation, not a verified treatment rule.",
        },
      ],
      timeline: [
        {
          id: "ccpa-enactment-lead",
          date: "2018-06-28",
          label: "Enactment date lead",
          stage: "enactment",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty: "The focal empirical clock remains unverified.",
        },
        {
          id: "ccpa-operative-lead",
          date: "2020-01-01",
          label: "Operative date lead",
          stage: "effective",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty:
            "Screen 3 must verify the exact provision and organization-level coverage.",
        },
      ],
      broadCoverage: [
        {
          id: "ccpa-coverage-claim",
          text: "For-profit entities doing business in California may be covered when historical statutory conditions are met.",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty: "Firm-level eligibility is not established.",
        },
      ],
      keyComponents: [
        {
          id: "ccpa-component-claim",
          text: "Consumer rights, disclosure duties, and data-governance obligations help distinguish the statute.",
          sourceIds: [source.id],
          status: "provisional",
          uncertainty: null,
        },
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
          sourceIds: [source.id],
          note: "Shown as a related later version lead, not merged into the 2018 identity.",
        },
      ],
      unresolvedFacts: [
        "The focal event stage and firm-level historical coverage remain unverified.",
      ],
      sourceIds: [source.id],
      recordedAt: confirmedRaw.updatedAt,
  };
  const dossier = {
    ...dossierSnapshot,
    dossierFingerprint: fingerprintScreen02WorkflowValue(dossierSnapshot),
  };
  confirmedRaw.dossiers = [dossier];
  const confirmationBase = {
    confirmationSnapshotId: "ccpa-confirmation-snapshot-1",
    identitySnapshotId: match.identitySnapshotId,
    matchSnapshotId: match.matchSnapshotId,
    matchSetSnapshotId: "ccpa-match-set-v1",
    anchorRevisionId: opened.anchor.activeRevisionId,
    dossierSnapshotId: dossier.dossierSnapshotId,
    dossierFingerprint: dossier.dossierFingerprint,
    decisionId: "ccpa-confirmation-1",
    confirmedAt: "2026-08-09T18:10:08.000Z",
  };
  const confirmation = {
    ...confirmationBase,
    confirmationFingerprint:
      fingerprintScreen02WorkflowValue(confirmationBase),
  };
  confirmedRaw.identityDecisions = [
    {
      decisionId: "ccpa-confirmation-1",
      action: "confirmed",
      actor: "researcher",
      anchorRevisionId: opened.anchor.activeRevisionId,
      matchSnapshotId: match.matchSnapshotId,
      identitySnapshotId: match.identitySnapshotId,
      dossierSnapshotId: dossier.dossierSnapshotId,
      confirmationSnapshotId: confirmation.confirmationSnapshotId,
      confirmationFingerprint: confirmation.confirmationFingerprint,
      reversesDecisionId: null,
      at: confirmation.confirmedAt,
      reason: "Researcher confirmed this exact statute as the intended shock.",
    },
  ];
  confirmedRaw.confirmedIdentity = confirmation;
  return requireScreen02AuditState(confirmedRaw);
}

export function buildReadyAuditState(): Screen02AuditState {
  let state = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    jobId: "audit-assessment-job-1",
    requestId: "audit-assessment-request-1",
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: "2026-08-09T18:10:09.000Z",
  }) as Screen02AuditState;
  state = completeRequest(
    state,
    "audit-assessment-request-1",
    screen02AuditAssessmentPartIds,
    {
      delivered: "2026-08-09T18:10:10.000Z",
      draft: "2026-08-09T18:10:11.000Z",
      validating: "2026-08-09T18:10:12.000Z",
      completed: "2026-08-09T18:10:13.000Z",
    },
  ) as Screen02AuditState;
  const raw = cloneFixture(state);
  raw.revision += 1;
  raw.updatedAt = "2026-08-09T18:10:14.000Z";
  raw.assessments.push({
    assessmentId: "audit-assessment-1",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    requestId: "audit-assessment-request-1",
    status: "completed",
    studyFit: {
      category: "strong",
      explanation:
        "The enactment and operative-date leads fall within the study period and the statute may affect data-intensive U.S. public firms.",
      evidenceSourceIds: ["ccpa-official"],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Consumer-rights and data-governance duties may change compliance costs and access to data used in product development.",
      evidenceSourceIds: ["ccpa-official"],
    },
    coverageRelation: {
      category: "mixed",
      explanation:
        "The study population is broader than the statute's covered businesses, so historical threshold and California-activity information may be needed.",
      evidenceSourceIds: ["ccpa-official"],
    },
    measurementPotential: {
      category: "difficult",
      explanation:
        "Public revenue and business disclosures may help, but firm-level California activity and historical data-volume measures may be incomplete.",
      evidenceSourceIds: ["ccpa-official"],
    },
    mainConcern:
      "Several event clocks and later amendments could be collapsed into one indicator without deeper verification.",
    nextChecks: [
      "Determine which 2018–2020 event stage best matches the proposed organizational response.",
      "Establish whether sampled firms can be classified using historical statutory conditions.",
    ],
    evidenceSourceIds: ["ccpa-official"],
    acceptedFields: [
      "studyFit",
      "outcomePathway",
      "coverageRelation",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ],
    overallJudgment: "worth-exploring",
    overallJudgmentMethod: "fixed-computation",
    recordedAt: raw.updatedAt,
  });
  const assessed = requireScreen02AuditState(raw);
  return continueScreen02Audit(
    assessed,
    "audit-continuation-1",
    "2026-08-09T18:10:15.000Z",
    "Researcher continued after confirming and assessing the event identity.",
  );
}

export function legacyFindSessionFixture() {
  const baseline = confirmedWorkflowFindContext();
  return createScreen02Session(
    { ...baseline, appVersion: "0.2.20" },
    "legacy-find-run",
  );
}

export function legacyAuditSessionFixture() {
  const baseline = confirmedWorkflowAuditContext();
  return createScreen02Session(
    { ...baseline, appVersion: "0.2.20" },
    "legacy-audit-run",
  );
}

export function legacyLockedAuditSessionFixture() {
  const restored = restoreScreen02StateEnvelope(
    frozenScreen02V020LockedAuditEnvelope,
  );
  if (!restored) {
    throw new Error("The frozen v0.2.20 Audit fixture must remain readable.");
  }
  return restored;
}
