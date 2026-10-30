import {
  SCREEN02_DISCOVERY_EVENT_REGISTRY,
  reviewedScreen02RegistryProposalMatchesResearchText,
} from "./screen02-registry";
import {
  PUBLIC_SCREEN02_EVENT_DATE_DETAILS,
} from "./screen02-public-event-index";
import {
  qualifyAndRankScreen02FindProposals,
  type Screen02CandidateQualification,
} from "./screen02-qualification";
import type { Screen01StudyContext } from "./scope-types";
import { unambiguousCalendarDate } from "./calendar-date";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
} from "./screen02-types";
import {
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
  activeScreen02FindCriteria,
  beginScreen02FindDiscovery,
  completeScreen02FindDiscovery,
  screen02FindRelevanceProfile,
  type Screen02FindSearchCandidateInput,
} from "./screen02-find-workflow";
import {
  fingerprintScreen02WorkflowValue,
  requireScreen02FindState,
} from "./screen02-workflow-state";
import { requireReadyScreen02StudyRelevanceProfile } from
  "./screen02-relevance-profile";
import {
  SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  buildScreen02RetainedResultBinding,
  buildScreen02RetrievalExecution,
  isScreen02SearchFunnel,
  type Screen02DateLeadStage,
  type Screen02FindState,
  type Screen02RetainedResultOrigin,
  type Screen02SearchFunnel,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
} from "./screen02-workflow-types";

const DEFAULT_REVIEWED_RESULT_LIMIT =
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES;

export function buildScreen02SearchFunnel(input: {
  sourceRecordsRetrieved: number;
  uniqueEventLeads: number;
  qualifications: readonly Screen02CandidateQualification[];
  displayedCandidates: number;
  deeperRetrievalAttempts?: number;
  retrievalFailures?: number;
  hostContribution?: number;
}): Screen02SearchFunnel {
  const count = (value: number) =>
    Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const qualifications = [...input.qualifications];
  const hardScope = qualifications.filter((item) => item.hardScope.passed);
  const sourceQuality = qualifications.filter(
    (item) => item.sourceQuality.status !== "insufficient",
  );
  const substantive = sourceQuality.filter(
    (item) => item.substantiveOverview.passed,
  );
  const relevant = substantive.filter(
    (item) => item.classification !== "mismatch",
  );
  const exposure = relevant.filter(
    (item) => item.exposureFeasibility.status !== "infeasible",
  );
  const qualified = qualifications.filter((item) => item.eligible);
  const sourceRecordsRetrieved = count(input.sourceRecordsRetrieved);
  const uniqueEventLeads = count(input.uniqueEventLeads);
  return {
    schemaVersion: SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
    sourceRecordsRetrieved,
    uniqueEventLeads,
    evaluatedUniqueLeads: qualifications.length,
    duplicatesRemoved: Math.max(0, sourceRecordsRetrieved - uniqueEventLeads),
    hardScopePassed: hardScope.length,
    hardScopeDemonstratedMismatch: qualifications.filter((item) =>
      item.hardScope.disposition === "demonstrated-mismatch"
    ).length,
    hardScopeInsufficientEvidence: qualifications.filter((item) =>
      item.hardScope.disposition === "insufficient-evidence"
    ).length,
    hardScopeMixed: qualifications.filter((item) =>
      item.hardScope.disposition === "mixed"
    ).length,
    sourceQualityPassed: sourceQuality.length,
    substantiveInformationPassed: substantive.length,
    relevancePassed: relevant.length,
    exposureFeasibilityPassed: exposure.length,
    qualifiedCandidates: qualified.length,
    displayedCandidates: count(input.displayedCandidates),
    directCandidates: qualifications.filter((item) =>
      item.classification === "direct").length,
    adjacentCandidates: qualifications.filter((item) =>
      item.classification === "adjacent").length,
    broadCandidates: qualifications.filter((item) =>
      item.classification === "broad").length,
    mismatchCandidates: qualifications.filter((item) =>
      item.classification === "mismatch").length,
    deeperRetrievalAttempts: count(input.deeperRetrievalAttempts ?? 0),
    // Selected source-route failures and deeper document failures share this
    // diagnostic counter, so it is independent of the deeper-attempt count.
    retrievalFailures: count(input.retrievalFailures ?? 0),
    hostContribution: count(input.hostContribution ?? 0),
  };
}

type NativeIdentity = {
  commonNames: string[];
  formalIdentifier: string | null;
  issuer: string | null;
  issuingJurisdiction: string | null;
  status: string | null;
};

/**
 * These values are reviewed event facts. They are intentionally not inferred
 * from a publisher, a study geography, or an affected-population string.
 */
const REVIEWED_IDENTITIES: Readonly<Record<string, NativeIdentity>> = {
  "registry-us-sarbanes-oxley-2002": {
    commonNames: ["Sarbanes-Oxley Act", "SOX"],
    formalIdentifier: "Public Law 107-204",
    issuer: "United States Congress",
    issuingJurisdiction: "United States",
    status: "Enacted",
  },
  "registry-us-sec-conflict-minerals-2012": {
    commonNames: ["SEC Conflict Minerals Rule"],
    formalIdentifier: "17 CFR Parts 240 and 249b",
    issuer: "U.S. Securities and Exchange Commission",
    issuingJurisdiction: "United States",
    status: "Adopted",
  },
  "registry-us-tax-cuts-jobs-act-2017": {
    commonNames: ["Tax Cuts and Jobs Act", "TCJA"],
    formalIdentifier: "Public Law 115-97",
    issuer: "United States Congress",
    issuingJurisdiction: "United States",
    status: "Enacted",
  },
  "registry-us-california-ccpa-2020": {
    commonNames: ["California Consumer Privacy Act", "CCPA"],
    formalIdentifier: "California Civil Code § 1798.100 et seq.",
    issuer: "California Legislature",
    issuingJurisdiction: "California, United States",
    status: "In force",
  },
  "registry-us-california-iot-security-2020": {
    commonNames: [
      "Security of Connected Devices",
      "California Senate Bill 327",
      "SB 327",
    ],
    formalIdentifier: "SB 327",
    issuer: "California Legislature",
    issuingJurisdiction: "California, United States",
    status: "Enacted",
  },
  "registry-eu-gdpr-2018": {
    commonNames: ["GDPR"],
    formalIdentifier: "Regulation (EU) 2016/679",
    issuer: "European Parliament and Council",
    issuingJurisdiction: "European Union",
    status: "In force",
  },
  "registry-eu-nfrd-2017": {
    commonNames: ["Non-Financial Reporting Directive", "NFRD"],
    formalIdentifier: "Directive 2014/95/EU",
    issuer: "European Parliament and Council",
    issuingJurisdiction: "European Union",
    status: "Adopted",
  },
  "registry-eu-emissions-trading-2005": {
    commonNames: ["EU Emissions Trading System", "EU ETS"],
    formalIdentifier: "Directive 2003/87/EC",
    issuer: "European Parliament and Council",
    issuingJurisdiction: "European Union",
    status: "In operation",
  },
  "registry-us-hurricane-harvey-2017": {
    commonNames: ["Hurricane Harvey"],
    formalIdentifier: null,
    issuer: null,
    issuingJurisdiction: null,
    status: "Historical occurrence",
  },
};

type ReviewedDateDetail = {
  stage: Screen02DateLeadStage;
  label?: string;
  uncertainty?: string;
};

const REVIEWED_DATE_DETAILS: Readonly<
  Record<string, Readonly<Record<string, ReviewedDateDetail>>>
> = {
  "registry-us-sarbanes-oxley-2002": {
    "2002-07-30": { stage: "enactment" },
  },
  "registry-us-sec-conflict-minerals-2012": {
    "2012-08-22": { stage: "rulemaking" },
    "2012-11-13": { stage: "effective" },
  },
  "registry-us-tax-cuts-jobs-act-2017": {
    "2017-12-22": { stage: "enactment" },
  },
  "registry-us-california-ccpa-2020": {
    "2017-12-18": {
      stage: "announcement",
      label: "Precursor privacy initiative cleared for circulation",
      uncertainty:
        "This is the official circulation date of ballot initiative 17-0039, a precursor to the enacted CCPA. It is not the introduction date of AB 375 and is not automatically the study treatment date.",
    },
    "2018-06-28": {
      stage: "enactment",
      label: "Law enacted",
      uncertainty:
        "The Governor's approval and filing date establishes enactment, but the study-relevant treatment clock may be later.",
    },
    "2020-01-01": {
      stage: "effective",
      label: "Law became operative",
      uncertainty:
        "The statute's operative date does not by itself establish firm-level coverage or the beginning of enforcement.",
    },
  },
  "registry-eu-gdpr-2018": {
    "2016-05-04": { stage: "enactment" },
    "2018-05-25": { stage: "effective" },
  },
  "registry-eu-nfrd-2017": {
    "2014-11-15": {
      stage: "enactment",
      label: "Directive published",
    },
    "2017-01-01": {
      stage: "effective",
      label: "Reporting duties began applying",
    },
  },
  "registry-eu-emissions-trading-2005": {
    "2003-10-13": { stage: "enactment" },
    "2005-01-01": { stage: "implementation" },
  },
  "registry-us-hurricane-harvey-2017": {
    "2017-08-25": { stage: "occurrence" },
  },
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type Screen02FindPriorCandidateMatch =
  | "stable-proposal-id"
  | "normalized-canonical-title";

/**
 * Repeat discovery must not recycle an event merely because the new search
 * round gives it a fresh immutable snapshot ID. Connector proposal IDs are
 * stable when available; normalized titles provide the conservative
 * cross-source fallback approved for the bounded Find pool.
 */
export function screen02FindPriorCandidateMatch(
  state: Screen02FindState,
  proposal: Pick<Screen02FindProposal, "id" | "title">,
): Screen02FindPriorCandidateMatch | null {
  const profileUpdatedAt = Date.parse(
    screen02FindRelevanceProfile(state).updatedAt,
  );
  const currentProfileCandidates = state.candidates.filter(
    (candidate) => Date.parse(candidate.recordedAt) >= profileUpdatedAt,
  );
  if (
    currentProfileCandidates.some(
      (candidate) => candidate.candidateId === proposal.id,
    )
  ) {
    return "stable-proposal-id";
  }
  const title = normalize(proposal.title);
  if (
    title &&
    currentProfileCandidates.some(
      (candidate) =>
        normalize(candidate.identity.canonicalTitle) === title,
    )
  ) {
    return "normalized-canonical-title";
  }
  return null;
}

export function screen02FindPriorCandidateExclusionReason(
  match: Screen02FindPriorCandidateMatch,
) {
  return match === "stable-proposal-id"
    ? "Excluded because this stable event identifier was already shown in a prior Find round."
    : "Excluded because this normalized canonical event title was already shown in a prior Find round.";
}

function terms(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((term) => term.length >= 3),
  );
}

function parseStudyYears(value: string) {
  const years = [...value.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) =>
    Number(match[0]),
  );
  if (years.length === 0) return null;
  return { start: Math.min(...years), end: Math.max(...years) };
}

function proposalDates(proposal: Screen02FindProposal) {
  return [...new Set(
    [proposal.event.eventDate, ...proposal.provisionalDates]
      .map(unambiguousCalendarDate)
      .filter((date): date is string => Boolean(date)),
  )];
}

function unstructuredDateLeads(proposal: Screen02FindProposal) {
  return [...new Set([proposal.event.eventDate, ...proposal.provisionalDates]
    .filter((value) => !unambiguousCalendarDate(value)))];
}

function lexicalPriority(
  proposal: Screen02FindProposal,
  queryTerms: ReadonlySet<string>,
  studyPeriod: string,
) {
  const haystack = terms(
    [
      proposal.title,
      proposal.description,
      proposal.event.displayName,
      proposal.event.eventFamily,
      proposal.affectedPopulation,
      ...proposal.event.populations,
      ...proposal.reasons,
    ].join(" "),
  );
  let overlap = 0;
  for (const term of queryTerms) {
    if (haystack.has(term)) overlap += 1;
  }
  const range = parseStudyYears(studyPeriod);
  const hasPeriodLead =
    range !== null &&
    proposalDates(proposal).some((date) => {
      const year = Number(date.slice(0, 4));
      return year >= range.start && year <= range.end;
    });
  return overlap * 10 + (hasPeriodLead ? 5 : 0);
}

function sourceRecord(
  source: Screen02FindProposal["sources"][number],
  retrievedAt: string,
  userProvided: boolean,
): Screen02WorkflowSource {
  if (
    source.evidenceText !== undefined &&
    (source.evidenceText.trim().length === 0 ||
      source.evidenceText.length > 12_000)
  ) {
    throw new Error("Find source evidence text must be bounded and non-empty.");
  }
  const factual = {
    id: source.id,
    title: source.title,
    locator: source.locator,
    publisher: source.publisher,
    publishedDate: source.publishedDate ?? null,
    authorityTier: source.authorityTier,
    channel: source.channel,
    retrievedAt: source.retrievedAt ?? retrievedAt,
    userProvided,
    ...(source.evidenceText === undefined
      ? {}
      : { evidenceText: source.evidenceText }),
  } satisfies Omit<Screen02WorkflowSource, "sourceFingerprint">;
  return {
    ...factual,
    sourceFingerprint: fingerprintScreen02WorkflowValue(factual),
  };
}

function workflowOrigin(
  proposal: Screen02FindProposal,
): Screen02FindSearchCandidateInput["origin"] {
  if (proposal.origin === "registry-reviewed") return "registry-reviewed";
  if (proposal.origin === "user-provided") return "user-provided";
  if (proposal.origin === "unsupported-lead") return "unsupported-lead";
  if (proposal.origin === "newly-discovered") return "newly-discovered";
  return "unsupported-lead";
}

export function screen02FindCandidateFromProposal(
  proposal: Screen02FindProposal,
  searchRoundId: string,
  recordedAt: string,
  qualification?: Screen02CandidateQualification,
): Screen02FindSearchCandidateInput {
  const reviewedIdentity = REVIEWED_IDENTITIES[proposal.id];
  const identity = {
    commonNames: reviewedIdentity?.commonNames ?? [],
    formalIdentifier:
      proposal.nativeIdentity?.formalIdentifier ??
      reviewedIdentity?.formalIdentifier ??
      null,
    issuer:
      proposal.nativeIdentity?.issuer ?? reviewedIdentity?.issuer ?? null,
    issuingJurisdiction:
      proposal.nativeIdentity?.issuingJurisdiction ??
      reviewedIdentity?.issuingJurisdiction ??
      null,
    status:
      proposal.nativeIdentity?.status ?? reviewedIdentity?.status ?? null,
  };
  const sourceIds = proposal.sources.map((source) => source.id);
  const dates = proposalDates(proposal);
  const sourceEstablishedCoverage = [
    ...new Set(
      proposal.event.populations
        .map((population) => population.trim())
        .filter(
          (population) =>
            population.length > 0 &&
            population !== SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
        ),
    ),
  ];
  const limitations = [
    ...proposal.limitations,
    ...unstructuredDateLeads(proposal).map(
      (value) =>
        `Verify date lead in Screen 3: ${value.slice(0, 300)}`,
    ),
  ];
  if (sourceEstablishedCoverage.length === 0) {
    limitations.push(
      "Returned sources did not establish organizational population coverage; the confirmed Screen 1 population, industry, and geography remain comparison targets, not candidate facts.",
    );
  }
  return {
    candidateId: proposal.id,
    candidateSnapshotId: `${proposal.id}:${searchRoundId}`,
    searchRoundId,
    origin: workflowOrigin(proposal),
    identity: {
      canonicalTitle: proposal.title,
      commonNames: [...identity.commonNames],
      formalIdentifier: identity.formalIdentifier,
      issuer: identity.issuer,
      issuingJurisdiction: identity.issuingJurisdiction,
      eventType: proposal.event.eventFamily,
      status: identity.status,
    },
    description: {
      id: `${proposal.id}:description:${searchRoundId}`,
      text: proposal.description,
      sourceIds,
      status: "provisional",
      uncertainty:
        "This is a factual event lead; Screen 3 must verify the operative identity, timing, and scope.",
    },
    dateLeads: dates.map((date, index) => {
      const indexedDetail = PUBLIC_SCREEN02_EVENT_DATE_DETAILS[proposal.id]?.[date];
      const publicDetail = indexedDetail?.sourceIds.every((sourceId) =>
          sourceIds.includes(sourceId)
        )
        ? indexedDetail
        : undefined;
      const reviewedDetail = REVIEWED_DATE_DETAILS[proposal.id]?.[date];
      const detail = publicDetail
        ? {
            stage: publicDetail.role,
            label: publicDetail.label,
            uncertainty: publicDetail.uncertainty,
            sourceIds: publicDetail.sourceIds,
          }
        : reviewedDetail;
      return {
        id: `${proposal.id}:date-${index + 1}:${searchRoundId}`,
        date,
        label: detail?.label ??
          (index === 0 ? "Main date lead" : "Additional date lead"),
        stage: detail?.stage ?? "other",
        sourceIds: publicDetail ? [...publicDetail.sourceIds] : sourceIds,
        status: "provisional",
        uncertainty: detail?.uncertainty ??
          "The study-relevant operative date and provision remain unverified.",
      };
    }),
    broadCoverage: sourceEstablishedCoverage.map((population, index) => ({
      id: `${proposal.id}:coverage-${index + 1}:${searchRoundId}`,
      text: population,
      sourceIds,
      status: "provisional",
      uncertainty:
        "This source-described population lead is not unit-level exposure or verified eligibility.",
    })),
    apparentExposureVariables: [...proposal.requiredVariables],
    sourceIds,
    limitations,
    recordedAt,
    ...(qualification ? { qualification } : {}),
  };
}

function familyMatches(proposal: Screen02FindProposal, eventFamily: string) {
  const requested = normalize(eventFamily);
  const actual = normalize(proposal.event.eventFamily);
  return !requested || actual.includes(requested) || requested.includes(actual);
}

export type Screen02FindDiscoveryResult = {
  sources: Screen02WorkflowSource[];
  candidates: Screen02FindSearchCandidateInput[];
  manifest: Screen02WorkflowSearchManifest;
};

/** Explicit producer provenance for one proposal before it is materialized. */
export type Screen02FindProposalOriginInput = {
  proposalId: string;
  origins: readonly Screen02RetainedResultOrigin[];
};

/**
 * Converts an already retrieved, deduplicated and ordered proposal set into
 * the canonical v2.1 Find facts. Retrieval remains a worker responsibility;
 * this adapter never invents issuer or jurisdiction facts that the proposal
 * did not carry in a reviewed identity record.
 */
export function buildScreen02FindDiscoveryFromProposals(
  state: Screen02FindState,
  input: {
    searchRoundId: string;
    at: string;
    proposals: readonly Screen02FindProposal[];
    manifest: Screen02WorkflowSearchManifest;
    resultOrigins: readonly Screen02FindProposalOriginInput[];
    qualifications?: readonly Screen02CandidateQualification[];
    /**
     * Canonical candidate ids from the task-bound active pool that fixed
     * software must requalify into a fresh snapshot. Ordinary "find more"
     * rounds omit this and continue excluding previously shown events.
     */
    reconsiderPriorCandidateIds?: readonly string[];
  },
): Screen02FindDiscoveryResult {
  requireScreen02FindState(state);
  if (
    !input.searchRoundId.trim() ||
    input.searchRoundId.length > 200 ||
    !input.at.trim() ||
    input.at.length > 100 ||
    input.proposals.length > SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES
  ) {
    throw new Error(
      `Canonical Find discovery requires a bounded search identity, time, and at most ${SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES} ordered proposals.`,
    );
  }
  const proposalIds = input.proposals.map((proposal) => proposal.id);
  if (
    proposalIds.some((id) => !id.trim() || id.length > 200) ||
    new Set(proposalIds).size !== proposalIds.length
  ) {
    throw new Error("Canonical Find discovery proposal identities must be unique and bounded.");
  }
  if (
    input.manifest.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION ||
    !isScreen02SearchFunnel(input.manifest.funnel) ||
    input.manifest.retainedResultBinding !== undefined ||
    input.manifest.funnel.displayedCandidates !== input.proposals.length
  ) {
    throw new Error(
      "Canonical Find discovery requires an unbound current manifest whose displayed count exactly covers the supplied proposals.",
    );
  }
  const resultOriginIds = input.resultOrigins.map((entry) => entry.proposalId);
  if (
    input.resultOrigins.length !== input.proposals.length ||
    resultOriginIds.some(
      (proposalId) =>
        !proposalId.trim() || proposalId.length > 200 ||
        !proposalIds.includes(proposalId),
    ) ||
    new Set(resultOriginIds).size !== resultOriginIds.length ||
    input.resultOrigins.some(
      (entry) => entry.origins.length === 0 || entry.origins.length > 30,
    )
  ) {
    throw new Error(
      "Canonical Find discovery origins must uniquely and exactly cover every supplied proposal within the bounded origin limit.",
    );
  }
  const originsByProposalId = new Map(
    input.resultOrigins.map((entry) => [
      entry.proposalId,
      [...entry.origins],
    ]),
  );
  const reconsiderPriorCandidateIds = new Set(
    input.reconsiderPriorCandidateIds ?? [],
  );
  if (
    reconsiderPriorCandidateIds.size !==
      (input.reconsiderPriorCandidateIds?.length ?? 0) ||
    reconsiderPriorCandidateIds.size > SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES ||
    [...reconsiderPriorCandidateIds].some(
      (candidateId) =>
        !proposalIds.includes(candidateId) ||
        !state.candidates.some((candidate) =>
          candidate.candidateId === candidateId
        ),
    )
  ) {
    throw new Error(
      "Canonical Find reconsideration must uniquely reference bounded prior candidates present in this proposal set.",
    );
  }
  const qualificationByProposalId = new Map(
    (input.qualifications ?? []).map((qualification) => [
      qualification.candidateId,
      qualification,
    ]),
  );
  if (
    qualificationByProposalId.size !== (input.qualifications?.length ?? 0) ||
    (input.qualifications !== undefined &&
      input.proposals.some(
        (proposal) => !qualificationByProposalId.has(proposal.id),
      ))
  ) {
    throw new Error(
      "Canonical Find discovery qualifications must uniquely cover every supplied proposal.",
    );
  }
  const priorMatches = input.proposals.flatMap((proposal) => {
    if (reconsiderPriorCandidateIds.has(proposal.id)) return [];
    const match = screen02FindPriorCandidateMatch(state, proposal);
    return match ? [{ proposal, match }] : [];
  });
  const priorProposalIds = new Set(
    priorMatches.map(({ proposal }) => proposal.id),
  );
  const proposals = input.proposals.filter(
    (proposal) => !priorProposalIds.has(proposal.id),
  );
  const exhaustedByPriorResults =
    proposals.length === 0 && priorMatches.length > 0;
  const priorSourceById = new Map(
    state.sources.map((source) => [source.id, source]),
  );
  const sourcesById = new Map<string, Screen02WorkflowSource>();
  for (const proposal of proposals) {
    const proposalOrigins = originsByProposalId.get(proposal.id)!;
    for (const source of proposal.sources) {
      const hasPriorResultOrigin = proposalOrigins.some(
        (origin) =>
          origin.kind === "prior-result" &&
          origin.sourceIds.includes(source.id),
      );
      const userProvided = hasPriorResultOrigin
        ? priorSourceById.get(source.id)?.userProvided === true
        : proposalOrigins.some(
            (origin) =>
              origin.kind === "query-result" &&
              (origin.retrievalLane === "researcher-source" ||
                origin.retrievalLane === "researcher-url") &&
              origin.sourceIds.includes(source.id),
          );
      const mapped = sourceRecord(
        source,
        input.at,
        userProvided,
      );
      const prior = sourcesById.get(mapped.id);
      if (prior && prior.sourceFingerprint !== mapped.sourceFingerprint) {
        throw new Error(`Find source ${mapped.id} has conflicting factual versions.`);
      }
      sourcesById.set(mapped.id, mapped);
    }
  }
  const upstreamAccount = {
    sourceRecordsRetrieved: input.manifest.funnel.sourceRecordsRetrieved,
    uniqueEventLeads: input.manifest.funnel.uniqueEventLeads,
  };
  const candidateInputsByProposalId = new Map(
    input.proposals.map((proposal) => [
      proposal.id,
      screen02FindCandidateFromProposal(
        proposal,
        input.searchRoundId,
        input.at,
        qualificationByProposalId.get(proposal.id),
      ),
    ]),
  );
  const completeBinding = buildScreen02RetainedResultBinding(
    "find",
    upstreamAccount,
    input.proposals.map((proposal) => {
      const candidate = candidateInputsByProposalId.get(proposal.id)!;
      return {
        recordId: candidate.candidateId,
        snapshotId: candidate.candidateSnapshotId,
        sourceIds: [...candidate.sourceIds],
        qualificationLane: candidate.qualification?.lane ?? null,
        origins: originsByProposalId.get(proposal.id)!,
      };
    }),
  );
  const retainedProposalIds = new Set(proposals.map((proposal) => proposal.id));
  const retainedResultBinding = buildScreen02RetainedResultBinding(
    "find",
    upstreamAccount,
    completeBinding.results.filter((result) =>
      retainedProposalIds.has(result.recordId)
    ),
  );
  const candidates = proposals.map(
    (proposal) => candidateInputsByProposalId.get(proposal.id)!,
  );
  const manifest: Screen02WorkflowSearchManifest = {
    ...input.manifest,
    ...(priorMatches.length > 0
      ? {
          funnel: {
            ...input.manifest.funnel,
            displayedCandidates: proposals.length,
          },
          exclusions: [
            ...input.manifest.exclusions,
            ...priorMatches.map(({ proposal, match }) => ({
              recordId: proposal.id,
              reason: screen02FindPriorCandidateExclusionReason(match),
            })),
          ],
          stoppingRule: exhaustedByPriorResults
            ? {
                ...input.manifest.stoppingRule,
                status: "met" as const,
                note: `No new candidate remained after excluding ${priorMatches.length} event${priorMatches.length === 1 ? "" : "s"} shown in prior rounds; the bounded supplied pool is exhausted for different results. ${input.manifest.stoppingRule.note}`,
              }
            : input.manifest.stoppingRule,
        }
      : {}),
    retainedResultBinding,
  };
  return {
    sources: [...sourcesById.values()],
    candidates,
    manifest,
  };
}

/**
 * Searches only the bounded reviewed registry. Study geography is treated as
 * a sample descriptor, never as the event's issuing jurisdiction. This is why
 * a cross-border event such as GDPR remains discoverable for a U.S. sample.
 */
export function buildReviewedScreen02FindDiscovery(
  state: Screen02FindState,
  input: {
    searchRoundId: string;
    at: string;
    exactRequest: string;
    maximumCandidates?: number;
  },
): Screen02FindDiscoveryResult {
  const safe = requireScreen02FindState(state);
  if (
    !input.searchRoundId.trim() ||
    input.searchRoundId.length > 200 ||
    !input.at.trim() ||
    input.at.length > 100 ||
    !input.exactRequest.trim() ||
    input.exactRequest.length > 2_000
  ) {
    throw new Error(
      "Reviewed Find discovery requires bounded non-empty identity, time, and request text.",
    );
  }
  const requestedMaximum =
    input.maximumCandidates ?? DEFAULT_REVIEWED_RESULT_LIMIT;
  if (
    !Number.isSafeInteger(requestedMaximum) ||
    requestedMaximum < 1 ||
    requestedMaximum > SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES
  ) {
    throw new Error(
      `Reviewed Find discovery accepts between one and ${SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES} candidates.`,
    );
  }
  const maximumCandidates = requestedMaximum;
  const activeCriteria = activeScreen02FindCriteria(safe);
  const studyProfile = requireReadyScreen02StudyRelevanceProfile(
    screen02FindRelevanceProfile(safe),
  );
  const queryText = [
    input.exactRequest,
    safe.screen01Baseline.scopeContract.population,
    safe.screen01Baseline.scopeContract.industry,
    safe.screen01Baseline.scopeContract.eventFamily,
    studyProfile.canonicalIndustryLabel,
    ...studyProfile.industryAliases,
    ...studyProfile.internationalVariants,
    ...studyProfile.subsectors,
    ...studyProfile.products,
    ...studyProfile.services,
    ...studyProfile.industryActors,
    ...studyProfile.regulatedActivities,
    ...activeCriteria.map((criterion) => criterion.text),
  ].join(" ");
  const family = safe.screen01Baseline.scopeContract.eventFamily;
  const familyRecords = SCREEN02_DISCOVERY_EVENT_REGISTRY.filter(
    (proposal) => familyMatches(proposal, family),
  );
  const matchingFamily = familyRecords.filter((proposal) =>
    reviewedScreen02RegistryProposalMatchesResearchText(proposal, queryText)
  );
  const previouslyShown = matchingFamily.flatMap((proposal) => {
    const match = screen02FindPriorCandidateMatch(safe, proposal);
    return match ? [{ proposal, match }] : [];
  });
  const previouslyShownIds = new Set(
    previouslyShown.map(({ proposal }) => proposal.id),
  );
  const familyMatchesRegistry = matchingFamily.filter(
    (proposal) => !previouslyShownIds.has(proposal.id),
  );
  const qualification = qualifyAndRankScreen02FindProposals(
    familyMatchesRegistry,
    safe.screen01Baseline as unknown as Screen01StudyContext,
    {
      scopeFingerprint: safe.screen01Fingerprint,
      maximumCandidates,
      studyProfile,
    },
  );
  const selected = qualification.selected.map((item) => item.proposal);
  const selectedQualifications = qualification.selected.map(
    (item) => item.qualification,
  );
  const selectedIds = selected.map((proposal) => proposal.id);
  const exactCriterionText = activeCriteria.map(
    (criterion) => `${criterion.kind}: ${criterion.text}`,
  );
  const manifest: Screen02WorkflowSearchManifest = {
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
    exactRequest: input.exactRequest,
    queryMatrix: [
      {
        id: `${input.searchRoundId}:confirmed-scope`,
        query: queryText,
        purpose:
          "Search the bounded reviewed registry using the confirmed event family and research guidance without equating sample geography with issuing jurisdiction.",
        returnedRecordIds: matchingFamily.map((proposal) => proposal.id),
      },
      ...exactCriterionText.map((query, index) => ({
        id: `${input.searchRoundId}:criterion-${index + 1}`,
        query,
        purpose:
          "Expand retrieval vocabulary only; lexical overlap does not establish a criterion finding.",
        returnedRecordIds: selectedIds.filter((id) => {
          const proposal = selected.find((item) => item.id === id)!;
          const proposalTerms = terms(
            [proposal.title, proposal.description, proposal.affectedPopulation].join(
              " ",
            ),
          );
          return [...terms(query)].some((term) => proposalTerms.has(term));
        }),
      })),
    ],
    channels: [
      {
        channel: "bounded-reviewed-event-registry",
        status: "searched",
        note:
          "Reviewed domestic, foreign, and supranational event leads were considered. This channel is deliberately bounded and not a global exhaustive search.",
        retrievedAt: input.at,
      },
    ],
    exclusions: [
      ...SCREEN02_DISCOVERY_EVENT_REGISTRY.filter(
        (proposal) => !familyMatches(proposal, family),
      ).map((proposal) => ({
        recordId: proposal.id,
        reason: `The reviewed record's event family does not match the confirmed ${family} family.`,
      })),
      ...familyRecords.filter((proposal) =>
        !reviewedScreen02RegistryProposalMatchesResearchText(
          proposal,
          queryText,
        )
      ).map((proposal) => ({
        recordId: proposal.id,
        reason:
          "The reviewed digital-regulation record does not match the current research text closely enough to enter this bounded comparison.",
      })),
      ...previouslyShown.map(({ proposal, match }) => ({
        recordId: proposal.id,
        reason: screen02FindPriorCandidateExclusionReason(match),
      })),
      ...[...new Map(
        qualification.excluded.map((excluded) => [
          excluded.proposal.id,
          {
            recordId: excluded.proposal.id,
            reason: qualification.excluded
              .filter((item) => item.proposal.id === excluded.proposal.id)
              .map((item) => item.reason)
              .filter((reason, index, all) => all.indexOf(reason) === index)
              .join(" "),
            qualification: excluded.qualification,
          },
        ]),
      ).values()],
    ],
    funnel: buildScreen02SearchFunnel({
      sourceRecordsRetrieved: familyRecords.length,
      uniqueEventLeads: matchingFamily.length,
      qualifications: qualification.evaluated.map((item) => item.qualification),
      displayedCandidates: selected.length,
    }),
    retrievalExecution: buildScreen02RetrievalExecution({
      baseline: {
        phase: "baseline",
        status: "completed",
        queryIds: [
          `${input.searchRoundId}:confirmed-scope`,
          ...exactCriterionText.map(
            (_query, index) => `${input.searchRoundId}:criterion-${index + 1}`,
          ),
        ],
        stoppingReason:
          matchingFamily.length >= 60
            ? "raw-max"
            : matchingFamily.length >= 40
              ? "raw-target"
              : "routes-exhausted",
        queriesPlanned: 1 + exactCriterionText.length,
        queriesAttempted: 1 + exactCriterionText.length,
        queriesSucceeded: 1 + exactCriterionText.length,
        queriesFailed: 0,
        roundsExecuted: 1,
        recordsReceived: familyRecords.length,
        proposalsGenerated: matchingFamily.length,
        uniqueProposalsGenerated: matchingFamily.length,
      },
    }),
    stoppingRule: {
      rule:
        "Retain source-qualified candidates from the bounded reviewed route; returned titles do not satisfy the candidate target.",
      status:
        selected.length > 0 || previouslyShown.length > 0
          ? "met"
          : "not-met",
      note:
        selected.length > 0
          ? `${qualification.returnedTitleCount} returned title${qualification.returnedTitleCount === 1 ? " was" : "s were"} evaluated and ${selected.length} qualified candidate${selected.length === 1 ? " was" : "s were"} retained.`
          : previouslyShown.length > 0
            ? `No new candidate remained after excluding ${previouslyShown.length} event${previouslyShown.length === 1 ? "" : "s"} shown in prior rounds; the bounded reviewed pool is exhausted for different results.`
          : "No reviewed record matched the confirmed event family.",
    },
    retrievedAt: input.at,
    outcomeValuesInspected: false,
  };
  return buildScreen02FindDiscoveryFromProposals(safe, {
    searchRoundId: input.searchRoundId,
    at: input.at,
    proposals: selected,
    manifest,
    resultOrigins: selected.map((proposal) => ({
      proposalId: proposal.id,
      origins: [{
        kind: "query-result",
        retrievalLane: "reviewed-registry",
        evidenceRole: "identity",
        producerRecordId: proposal.id,
        queryId: `${input.searchRoundId}:confirmed-scope`,
        returnedRecordIds: [proposal.id],
        sourceIds: proposal.sources.map((source) => source.id),
      }],
    })),
    qualifications: selectedQualifications,
  });
}

export function applyScreen02FindDiscovery(
  state: Screen02FindState,
  input: {
    discoveryRequestId: string;
    candidateSetSnapshotId: string;
    searchRoundId: string;
    at: string;
    exactRequest: string;
  },
  discovery: Screen02FindDiscoveryResult,
) {
  const searching = beginScreen02FindDiscovery(state, {
    discoveryRequestId: input.discoveryRequestId,
    candidateSetSnapshotId: input.candidateSetSnapshotId,
    searchRoundId: input.searchRoundId,
    at: input.at,
    exactRequest: input.exactRequest,
  });
  return completeScreen02FindDiscovery(searching, {
    discoveryRequestId: input.discoveryRequestId,
    at: input.at,
    ...discovery,
  });
}

export function applyReviewedScreen02FindDiscovery(
  state: Screen02FindState,
  input: {
    discoveryRequestId: string;
    candidateSetSnapshotId: string;
    searchRoundId: string;
    at: string;
    exactRequest: string;
    maximumCandidates?: number;
  },
) {
  const discovery = buildReviewedScreen02FindDiscovery(state, input);
  return applyScreen02FindDiscovery(state, input, discovery);
}
