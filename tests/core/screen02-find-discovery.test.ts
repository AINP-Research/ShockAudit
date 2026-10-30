import { describe, expect, it } from "vitest";
import {
  applyReviewedScreen02FindDiscovery,
  applyScreen02FindDiscovery,
  buildScreen02FindDiscoveryFromProposals,
  buildReviewedScreen02FindDiscovery,
  screen02FindCandidateFromProposal,
} from "../../src/core/screen02-find-discovery";
import { deduplicateScreen02Proposals } from "../../src/core/screen02-discovery";
import { qualifyScreen02FindProposal } from
  "../../src/core/screen02-qualification";
import { REVIEWED_SCREEN02_EVENT_REGISTRY } from "../../src/core/screen02-registry";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
} from "../../src/core/screen02-types";
import {
  replaceScreen02FindCriteria,
  updateScreen02FindRelevanceProfile,
} from "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  fingerprintScreen02FindCandidateSet,
  restoreScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  confirmedWorkflowFindContext,
  workflowManifest,
} from "./screen02-workflow-fixtures";

const at = "2026-08-10T15:00:00.000Z";

function blankFindState() {
  return createScreen02FindState(
    confirmedWorkflowFindContext(),
    "stage-3-reviewed-discovery",
    at,
  );
}

function sourceBoundTechnologyProposal(): Screen02FindProposal {
  const title = "Public Technology Data Safeguards Rule";
  const description =
    "The final rule requires U.S. publicly listed technology firms to change product-data safeguards and engineering duties beginning in 2019.";
  return {
    id: "source-bound-technology-rule",
    mode: "find",
    kind: "event",
    title,
    description,
    nativeIdentity: {
      formalIdentifier: "Rule No. 2019-42",
      issuer: "Example Federal Agency",
      issuingJurisdiction: "United States",
      status: "Final rule",
    },
    event: {
      displayName: title,
      eventDate: "2019-09-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. publicly listed technology firms"],
    },
    origin: "newly-discovered",
    provisionalDates: ["Effective date: 2019-09-01"],
    affectedPopulation: "U.S. publicly listed technology firms",
    requiredVariables: [
      "Covered-firm status",
      "Effective date",
      "Pre-event exposure indicator",
    ],
    outcomeLink: {
      text:
        "Product-data compliance is a preliminary innovation pathway, not an observed effect.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: ["Screen 3 must verify operative provisions."],
    reasons: ["Returned by a bounded official-source fixture."],
    sources: [{
      id: "source-bound-technology-rule-source",
      title,
      locator: "https://www.federalregister.gov/d/rule-no-2019-42",
      publisher: "Example Federal Agency",
      publishedDate: "2019-08-01",
      authorityTier: 1,
      channel: "official-primary",
      evidenceText:
        `${title}. Rule No. 2019-42. Issuing jurisdiction: United States. ${description} Affected population: U.S. publicly listed technology firms. Effective date: 2019-09-01.`,
    }],
  };
}

function proposalFixtureManifest(
  exactRequest: string,
  proposals: readonly Screen02FindProposal[],
  retrievedAt = at,
) {
  const manifest = workflowManifest(exactRequest, proposals.length);
  manifest.retrievedAt = retrievedAt;
  manifest.queryMatrix[0]!.returnedRecordIds = proposals.map(
    (proposal) => proposal.id,
  );
  manifest.channels = manifest.channels.map((channel) => ({
    ...channel,
    retrievedAt,
  }));
  return manifest;
}

function proposalFixtureOrigins(proposals: readonly Screen02FindProposal[]) {
  return proposals.map((proposal) => ({
    proposalId: proposal.id,
    origins: [{
      kind: "query-result" as const,
      retrievalLane: "official-baseline" as const,
      evidenceRole: "identity" as const,
      producerRecordId: proposal.id,
      queryId: "query-1",
      returnedRecordIds: [proposal.id],
      sourceIds: proposal.sources.map((source) => source.id),
    }],
  }));
}

describe("Screen 2 Find reviewed discovery", () => {
  it("does not retain GDPR solely because a named registry record once bypassed topical filtering", () => {
    const result = buildReviewedScreen02FindDiscovery(blankFindState(), {
      searchRoundId: "reviewed-round-1",
      at,
      exactRequest:
        "Find a privacy regulation relevant to U.S. technology firms between 2016 and 2020.",
    });

    const gdpr = result.candidates.find(
      (candidate) => candidate.candidateId === "registry-eu-gdpr-2018",
    );
    expect(gdpr).toBeUndefined();
  });

  it("preserves the NFRD publication and financial-year application stages", () => {
    const reviewed = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (proposal) => proposal.id === "registry-eu-nfrd-2017",
    );
    expect(reviewed?.mode).toBe("find");
    if (!reviewed || reviewed.mode !== "find") {
      throw new Error("Expected the reviewed NFRD record.");
    }

    const candidate = screen02FindCandidateFromProposal(
      reviewed,
      "nfrd-reviewed-round",
      at,
    );

    expect(candidate.dateLeads).toContainEqual(
      expect.objectContaining({
        date: "2014-11-15",
        stage: "enactment",
        label: "Directive published",
      }),
    );
    expect(candidate.dateLeads).toContainEqual(
      expect.objectContaining({
        date: "2017-01-01",
        stage: "effective",
        label: "Reporting duties began applying",
      }),
    );
  });

  it("carries the reviewed California connected-devices identity into Find", () => {
    const reviewed = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (proposal) =>
        proposal.id === "registry-us-california-iot-security-2020",
    );
    expect(reviewed?.mode).toBe("find");
    if (!reviewed || reviewed.mode !== "find") {
      throw new Error("Expected the reviewed California connected-devices record.");
    }

    const candidate = screen02FindCandidateFromProposal(
      reviewed,
      "california-connected-devices-reviewed-round",
      at,
    );

    expect(candidate.identity).toEqual({
      canonicalTitle: "California Security of Connected Devices Law",
      commonNames: [
        "Security of Connected Devices",
        "California Senate Bill 327",
        "SB 327",
      ],
      formalIdentifier: "SB 327",
      issuer: "California Legislature",
      issuingJurisdiction: "California, United States",
      eventType: "Regulation",
      status: "Enacted",
    });
    expect(candidate.sourceIds).toContain(
      "source-us-california-sb327-connected-devices",
    );
  });

  it("keeps requested scope out of source-backed coverage unless source metadata establishes a population", () => {
    const baseline = blankFindState().screen01Baseline.scopeContract;
    const requestedScopeEcho = [
      baseline.population,
      baseline.industry,
      baseline.geography,
    ].join(" | ");
    const reviewed = REVIEWED_SCREEN02_EVENT_REGISTRY[0]!;
    const connectorProposal = {
      ...structuredClone(reviewed),
      id: "connector-provenance-candidate",
      origin: "newly-discovered" as const,
      description: "An official connector returned event identity and timing metadata.",
      nativeIdentity: {
        formalIdentifier: "Connector record 42",
        issuer: "Connector Authority",
        issuingJurisdiction: "Connector Jurisdiction",
        status: "In force",
      },
      event: {
        ...structuredClone(reviewed.event),
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: requestedScopeEcho,
      requiredVariables: ["Organization-to-covered-entity linkage"],
    };

    const unknown = screen02FindCandidateFromProposal(
      connectorProposal,
      "provenance-round",
      at,
    );

    expect(unknown.broadCoverage).toEqual([]);
    expect(unknown.identity).toMatchObject({
      formalIdentifier: "Connector record 42",
      issuer: "Connector Authority",
      issuingJurisdiction: "Connector Jurisdiction",
      status: "In force",
    });
    expect(unknown.limitations.join(" ")).toContain(
      "comparison targets, not candidate facts",
    );
    expect(JSON.stringify(unknown)).not.toContain(requestedScopeEcho);

    const sourceEstablished = screen02FindCandidateFromProposal(
      {
        ...connectorProposal,
        event: {
          ...connectorProposal.event,
          populations: ["SEC-reporting issuers described by returned metadata"],
        },
      },
      "source-coverage-round",
      at,
    );
    expect(sourceEstablished.broadCoverage.map((claim) => claim.text)).toEqual([
      "SEC-reporting issuers described by returned metadata",
    ]);
    expect(JSON.stringify(sourceEstablished.broadCoverage)).not.toContain(
      requestedScopeEcho,
    );
  });

  it("canonicalizes and deduplicates dates when a reviewed CCPA record is enriched by Federal Register metadata", () => {
    const reviewed = structuredClone(
      REVIEWED_SCREEN02_EVENT_REGISTRY.find(
        (proposal) => proposal.id === "registry-us-california-ccpa-2020",
      )!,
    );
    const connector = {
      ...structuredClone(reviewed),
      id: "fr-2020-93001",
      origin: "newly-discovered" as const,
      nativeIdentity: {
        formalIdentifier: "2020-93001",
        issuer: "Browser Fixture Agency",
        issuingJurisdiction: "United States",
        status: "Rule",
      },
      event: {
        ...structuredClone(reviewed.event),
        eventDate: "2020-01-01",
      },
      provisionalDates: [
        "Publication date: 2020-01-01",
        "Reported effective date: 2020-01-01",
      ],
      sources: [
        {
          ...structuredClone(reviewed.sources[0]!),
          id: "fr-source-2020-93001",
          title: "California Consumer Privacy Act",
          locator: "https://www.federalregister.gov/d/2020-93001",
          publisher: "Browser Fixture Agency",
          publishedDate: "2020-01-01",
          authorityTier: 2 as const,
          channel: "federal-register-api",
        },
      ],
    };
    const merged = deduplicateScreen02Proposals([reviewed, connector])
      .proposals.find(
        (proposal) => proposal.id === "registry-us-california-ccpa-2020",
      );
    expect(merged?.mode).toBe("find");
    if (!merged || merged.mode !== "find") {
      throw new Error("Expected the reviewed CCPA record to remain canonical.");
    }

    const candidate = screen02FindCandidateFromProposal(
      merged,
      "ccpa-merged-round",
      at,
    );

    expect(candidate.dateLeads.map((lead) => lead.date)).toEqual([
      "2020-01-01",
      "2017-12-18",
      "2018-06-28",
    ]);
    expect(candidate.dateLeads[0]).toMatchObject({
      label: "Law became operative",
      stage: "effective",
    });
    expect(candidate.dateLeads).toContainEqual(
      expect.objectContaining({
        date: "2017-12-18",
        stage: "announcement",
        label: "Precursor privacy initiative cleared for circulation",
        uncertainty: expect.stringMatching(
          /precursor.+not the introduction date of AB 375/i,
        ),
      }),
    );
    expect(candidate.dateLeads).toContainEqual(
      expect.objectContaining({
        date: "2018-06-28",
        stage: "enactment",
        label: "Law enacted",
      }),
    );
    expect(candidate.dateLeads[0]).toMatchObject({
      date: "2020-01-01",
      stage: "effective",
      label: "Law became operative",
    });
    expect(candidate.dateLeads.some((lead) => lead.date === "2018-01-03"))
      .toBe(false);
    expect(JSON.stringify(candidate.dateLeads)).not.toContain(
      "Publication date:",
    );
    expect(candidate.sourceIds).toContain("fr-source-2020-93001");
  });

  it("keeps ambiguous and non-calendar date leads as visible Screen 3 verification needs", () => {
    const reviewed = structuredClone(
      REVIEWED_SCREEN02_EVENT_REGISTRY.find(
        (proposal) => proposal.id === "registry-us-california-ccpa-2020",
      )!,
    );
    reviewed.event.eventDate =
      "Implementation window: 2020-01-01 through 2020-02-01";
    reviewed.provisionalDates = [
      "Spring 2021",
      "Spring 2021",
    ];

    const candidate = screen02FindCandidateFromProposal(
      reviewed,
      "unstructured-date-round",
      at,
    );

    expect(candidate.dateLeads).toEqual([]);
    expect(candidate.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Implementation window: 2020-01-01 through 2020-02-01",
        ),
        expect.stringContaining("Spring 2021"),
      ]),
    );
    expect(candidate.limitations.join(" ")).toContain(
      "Verify date lead in Screen 3",
    );
    expect(
      candidate.limitations.filter((item) => item.includes("Spring 2021")),
    ).toHaveLength(1);
  });

  it("commits an immutable, outcome-blind cold-start set from retained indexed passages", () => {
    const next = applyReviewedScreen02FindDiscovery(blankFindState(), {
      discoveryRequestId: "reviewed-discovery-1",
      candidateSetSnapshotId: "reviewed-set-1",
      searchRoundId: "reviewed-round-1",
      at,
      exactRequest: "Find a source-backed regulation for the confirmed study.",
      maximumCandidates: 3,
    });

    expect(next.activeCandidateSetSnapshotId).toBe("reviewed-set-1");
    expect(next.discoveryRequests).toEqual([
      expect.objectContaining({
        discoveryRequestId: "reviewed-discovery-1",
        status: "completed",
        searchRoundId: "reviewed-round-1",
        candidateSetSnapshotId: "reviewed-set-1",
      }),
    ]);
    expect(next.candidates.length).toBeGreaterThan(0);
    expect(next.candidates.length).toBeLessThanOrEqual(3);
    expect(next.candidates.every((candidate) =>
      candidate.qualification?.candidateAdmission?.displayEvidence.supported ===
        true
    )).toBe(true);
    expect(next.outcomeValuesInspected).toBe(false);
    const activeSet = next.candidateSets.find(
      (set) => set.candidateSetSnapshotId === next.activeCandidateSetSnapshotId,
    );
    expect(activeSet?.manifest.outcomeValuesInspected).toBe(false);
    expect(activeSet?.manifest.funnel).toMatchObject({
      schemaVersion: "screen-02-search-funnel-v2",
      displayedCandidates: next.candidates.length,
      retrievalFailures: 0,
      hostContribution: 0,
    });
    expect(activeSet?.manifest.funnel?.sourceRecordsRetrieved).toBeGreaterThan(
      0,
    );
    expect(activeSet?.manifest.funnel?.evaluatedUniqueLeads).toBeGreaterThanOrEqual(
      next.candidates.length,
    );
    expect(
      activeSet!.manifest.funnel!.hardScopePassed +
        activeSet!.manifest.funnel!.hardScopeDemonstratedMismatch +
        activeSet!.manifest.funnel!.hardScopeInsufficientEvidence +
        activeSet!.manifest.funnel!.hardScopeMixed,
    ).toBe(activeSet!.manifest.funnel!.evaluatedUniqueLeads);
    const historical = structuredClone(next);
    const historicalSet = historical.candidateSets.find(
      (set) => set.candidateSetSnapshotId === historical.activeCandidateSetSnapshotId,
    )!;
    historicalSet.manifest.protocolVersion = "screen-02-search-protocol-v3";
    delete historicalSet.manifest.funnel;
    delete historicalSet.manifest.retrievalExecution;
    delete historicalSet.manifest.retainedResultBinding;
    historicalSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(historicalSet);
    expect(restoreScreen02FindState(historical)).not.toBeNull();

    const malformed = structuredClone(next);
    const malformedSet = malformed.candidateSets.find(
      (set) => set.candidateSetSnapshotId === malformed.activeCandidateSetSnapshotId,
    )!;
    malformedSet.manifest.funnel!.displayedCandidates =
      malformedSet.manifest.funnel!.qualifiedCandidates + 1;
    malformedSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(malformedSet);
    expect(restoreScreen02FindState(malformed)).toBeNull();
    const dispositionTamper = structuredClone(next);
    const dispositionTamperSet = dispositionTamper.candidateSets.find(
      (set) =>
        set.candidateSetSnapshotId ===
          dispositionTamper.activeCandidateSetSnapshotId,
    )!;
    dispositionTamperSet.manifest.funnel!.hardScopeInsufficientEvidence += 1;
    dispositionTamperSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(dispositionTamperSet);
    expect(restoreScreen02FindState(dispositionTamper)).toBeNull();
    const retrievalTamper = structuredClone(next);
    const retrievalTamperSet = retrievalTamper.candidateSets.find(
      (set) =>
        set.candidateSetSnapshotId === retrievalTamper.activeCandidateSetSnapshotId,
    )!;
    retrievalTamperSet.manifest.funnel!.retrievalFailures = -1;
    retrievalTamperSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(retrievalTamperSet);
    expect(restoreScreen02FindState(retrievalTamper)).toBeNull();
    expect(activeSet?.manifest.channels[0]?.note).toContain(
      "deliberately bounded and not a global exhaustive search",
    );
    expect(activeSet?.manifest.exclusions.some((item) =>
      (item.qualification?.exclusionCodes.length ?? 0) > 0,
    )).toBe(true);
    expect(JSON.stringify(next.candidates)).not.toMatch(
      /likelyServiceLevel|outcomeLink|authorityScore|overallScore/,
    );

  });

  it("uses optional criteria only as disclosed retrieval vocabulary", () => {
    const state = replaceScreen02FindCriteria(
      blankFindState(),
      [
        {
          criterionId: "government-imposed",
          kind: "only-include",
          text: "Government imposed",
          exactRequest: "Only include government-imposed shocks.",
          source: "researcher",
        },
      ],
      {
        at,
        reason: "Researcher added optional retrieval guidance.",
      },
    );
    const result = buildReviewedScreen02FindDiscovery(state, {
      searchRoundId: "reviewed-round-criteria",
      at,
      exactRequest: "Find privacy regulation candidates.",
    });

    expect(result.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        query: "only-include: Government imposed",
        purpose: expect.stringContaining(
          "lexical overlap does not establish a criterion finding",
        ),
      }),
    );
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) =>
      candidate.qualification?.candidateAdmission?.displayEvidence.supported ===
        true
    )).toBe(true);
  });

  it("records the raw-target stop when the reviewed corpus crosses forty matching leads", () => {
    let state = updateScreen02FindRelevanceProfile(blankFindState(), {
      edits: {
        regulatedActivities: [
          "personal data processing",
          "consumer privacy",
        ],
      },
      at: "2026-08-10T15:00:00.500Z",
      reason: "Exercise the enlarged privacy-regulation corpus.",
    });
    state = replaceScreen02FindCriteria(state, [
      {
        criterionId: "government-imposed",
        kind: "only-include",
        text: "Government imposed",
        exactRequest: "Only include government-imposed shocks.",
        source: "researcher",
      },
      {
        criterionId: "proprietary-employee-data",
        kind: "do-not-show",
        text: "Requires proprietary employee data",
        exactRequest:
          "Do not show shocks that require proprietary employee data.",
        source: "researcher",
      },
    ], {
      at: "2026-08-10T15:00:01.000Z",
      reason: "Match the vertical-slice retrieval scope.",
    });

    const result = buildReviewedScreen02FindDiscovery(state, {
      searchRoundId: "reviewed-round-raw-target",
      at: "2026-08-10T15:00:02.000Z",
      exactRequest:
        "Run a new bounded reviewed privacy-regulation search for the confirmed study.",
      maximumCandidates: 3,
    });

    expect(result.manifest.retrievalExecution?.baseline).toMatchObject({
      stoppingReason: "raw-target",
      uniqueProposalsGenerated: expect.any(Number),
    });
    expect(
      result.manifest.retrievalExecution?.baseline.uniqueProposalsGenerated,
    ).toBeGreaterThanOrEqual(40);
  });

  it("rejects unbounded discovery requests and result limits", () => {
    expect(() =>
      buildReviewedScreen02FindDiscovery(blankFindState(), {
        searchRoundId: "reviewed-round-invalid",
        at,
        exactRequest: "x".repeat(2_001),
      }),
    ).toThrow(/bounded/i);
    expect(() =>
      buildReviewedScreen02FindDiscovery(blankFindState(), {
        searchRoundId: "reviewed-round-invalid-limit",
        at,
        exactRequest: "Find a regulation.",
        maximumCandidates: 11,
      }),
    ).toThrow(/one and 10/i);
  });

  it("uses qualified-candidate limits while admitting only source-bound indexed facts", () => {
    const first = applyReviewedScreen02FindDiscovery(blankFindState(), {
      discoveryRequestId: "reviewed-discovery-ten-1",
      candidateSetSnapshotId: "reviewed-set-ten-1",
      searchRoundId: "reviewed-round-ten-1",
      at,
      exactRequest: "Find up to ten source-backed regulation candidates.",
      maximumCandidates: 10,
    });

    expect(first.candidates.length).toBeGreaterThan(0);
    expect(first.candidates.length).toBeLessThanOrEqual(10);
    expect(first.candidates.every((candidate) =>
      candidate.qualification?.candidateAdmission?.displayEvidence.supported ===
        true
    )).toBe(true);

    const second = applyReviewedScreen02FindDiscovery(first, {
      discoveryRequestId: "reviewed-discovery-ten-2",
      candidateSetSnapshotId: "reviewed-set-ten-2",
      searchRoundId: "reviewed-round-ten-2",
      at,
      exactRequest: "Find different source-backed regulation candidates.",
      maximumCandidates: 10,
    });

    const secondActiveSet = second.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
          second.activeCandidateSetSnapshotId,
    );
    expect(secondActiveSet).toBeDefined();
    const secondVisible = second.candidates.filter((candidate) =>
      secondActiveSet?.candidateSnapshotIds.includes(
        candidate.candidateSnapshotId,
      )
    );
    expect(secondVisible.some((candidate) =>
      first.candidates.some(
        (prior) => prior.candidateId === candidate.candidateId,
      )
    )).toBe(false);

    const third = buildReviewedScreen02FindDiscovery(second, {
      searchRoundId: "reviewed-round-ten-3",
      at,
      exactRequest: "Find any remaining source-backed regulation candidates.",
      maximumCandidates: 10,
    });

    expect(third.candidates.every((candidate) =>
      [...first.candidates, ...secondVisible].every(
        (prior) => prior.candidateId !== candidate.candidateId,
      )
    )).toBe(true);
    expect(third.manifest.exclusions.some((entry) =>
      entry.qualification?.lane === "reviewed-registry" &&
      entry.qualification.eligible === false
    )).toBe(true);
    expect(third.manifest.stoppingRule.rule).toMatch(
      /returned titles do not satisfy the candidate target/i,
    );
  });

  it("reconsiders an explicitly bound prior candidate as a fresh snapshot", () => {
    const initial = blankFindState();
    const proposal = sourceBoundTechnologyProposal();
    const qualification = qualifyScreen02FindProposal(
      proposal,
      confirmedWorkflowFindContext(),
      { scopeFingerprint: initial.screen01Fingerprint },
    );
    expect(qualification).toMatchObject({
      classification: "direct",
      eligible: true,
    });
    const first = applyScreen02FindDiscovery(initial, {
      discoveryRequestId: "reviewed-discovery-reconsider-1",
      candidateSetSnapshotId: "reviewed-set-reconsider-1",
      searchRoundId: "reviewed-round-reconsider-1",
      at,
      exactRequest: "Find source-backed regulation candidates.",
    }, buildScreen02FindDiscoveryFromProposals(initial, {
      searchRoundId: "reviewed-round-reconsider-1",
      at,
      proposals: [proposal],
      manifest: proposalFixtureManifest(
        "Find source-backed regulation candidates.",
        [proposal],
      ),
      resultOrigins: proposalFixtureOrigins([proposal]),
      qualifications: [qualification],
    }));
    const prior = first.candidates.find((candidate) =>
      candidate.qualification?.eligible === true
    );
    if (!prior?.qualification) {
      throw new Error("Expected one fixed-qualified reviewed candidate.");
    }
    const exactRequest = "Reconsider the task-bound reviewed candidate.";
    const ordinary = buildScreen02FindDiscoveryFromProposals(first, {
      searchRoundId: "reviewed-round-reconsider-ordinary",
      at,
      proposals: [proposal],
      manifest: proposalFixtureManifest(exactRequest, [proposal]),
      resultOrigins: proposalFixtureOrigins([proposal]),
      qualifications: [prior.qualification],
    });
    expect(ordinary.candidates).toEqual([]);
    expect(ordinary.manifest.funnel?.displayedCandidates).toBe(0);
    expect(ordinary.manifest.exclusions).toEqual([
      expect.objectContaining({
        recordId: prior.candidateId,
        reason: expect.stringMatching(/already shown in a prior Find round/i),
      }),
    ]);

    const reconsidered = buildScreen02FindDiscoveryFromProposals(first, {
      searchRoundId: "reviewed-round-reconsider-2",
      at,
      proposals: [proposal],
      manifest: proposalFixtureManifest(exactRequest, [proposal]),
      resultOrigins: proposalFixtureOrigins([proposal]),
      qualifications: [prior.qualification],
      reconsiderPriorCandidateIds: [prior.candidateId],
    });

    expect(reconsidered.candidates).toHaveLength(1);
    expect(reconsidered.candidates[0]).toMatchObject({
      candidateId: prior.candidateId,
      candidateSnapshotId:
        `${prior.candidateId}:reviewed-round-reconsider-2`,
      searchRoundId: "reviewed-round-reconsider-2",
      qualification: prior.qualification,
    });
    expect(reconsidered.candidates[0]?.candidateSnapshotId).not.toBe(
      prior.candidateSnapshotId,
    );
    expect(reconsidered.manifest.exclusions).toEqual([]);
  });
});
