import { describe, expect, it } from "vitest";

import { buildScreen02RetrievalExecution } from
  "../../src/core/screen02-workflow-types";
import {
  assertScreen02Acceptance,
  hasReviewedScreen02CandidateEvidence,
  requireScreen02RetrievalBudget,
} from "../../scripts/verify-production-matrix.mjs";

function retainedTargetManifest() {
  const recordIds = Array.from({ length: 10 }, (_value, index) =>
    `record-${index + 1}`
  );
  const retrievalExecution = buildScreen02RetrievalExecution({
    baseline: {
      phase: "baseline",
      status: "completed",
      queryIds: ["native-index-route"],
      stoppingReason: "routes-exhausted",
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      roundsExecuted: 1,
      recordsReceived: 10,
      proposalsGenerated: 10,
      uniqueProposalsGenerated: 10,
    },
  });
  return {
    protocolVersion: "screen-02-search-protocol-v4",
    queryMatrix: [{
      id: "native-index-route",
      query: "One bounded native source route",
      purpose: "Supplement ten retained source-backed candidates.",
      returnedRecordIds: recordIds,
    }],
    contextBridges: [],
    retrievalExecution,
    funnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: 10,
      uniqueEventLeads: 10,
      evaluatedUniqueLeads: 10,
      duplicatesRemoved: 0,
      hardScopePassed: 10,
      hardScopeDemonstratedMismatch: 0,
      hardScopeInsufficientEvidence: 0,
      hardScopeMixed: 0,
      sourceQualityPassed: 10,
      substantiveInformationPassed: 10,
      relevancePassed: 10,
      exposureFeasibilityPassed: 10,
      qualifiedCandidates: 10,
      displayedCandidates: 10,
      directCandidates: 10,
      adjacentCandidates: 0,
      broadCandidates: 0,
      mismatchCandidates: 0,
      deeperRetrievalAttempts: 0,
      retrievalFailures: 0,
      hostContribution: 0,
    },
  };
}

describe("production matrix discovery-first admission", () => {
  it("does not require 12 live queries after ten retained candidates qualify", () => {
    expect(() => requireScreen02RetrievalBudget(
      retainedTargetManifest(),
      { caseId: "retained-index-target", generalLegal: true },
    )).not.toThrow();
  });

  it("accepts an honest shortfall with the current qualification codes", () => {
    const scope = {
      population: "Manufacturers",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "Unsupported jurisdiction",
      industry: "Unfamiliar industry",
      studyPeriod: "2010–2020",
      eventFamily: "Regulation",
      outcomeFamily: "Investment",
      outcomeFrequency: "Annual",
    };
    const input = {
      caseId: "s2-honest-shortfall",
      expectedMode: "honest-shortfall",
      scope,
      acceptance: {
        shortfallCondition: "unsupported-native-route",
        allowedStops: ["unsupported"],
      },
    };
    const observation = {
      scope,
      funnel: {
        qualifiedCandidates: 0,
        displayedCandidates: 0,
        hardScopePassed: 0,
        evaluatedUniqueLeads: 1,
      },
      displayed: 0,
      discoveryStatus: "completed-empty",
      stoppingRule: {
        status: "not-met",
        note: "The bounded routes completed without a supported relevant event.",
      },
      retrievalBudget: {
        stoppingReason: "unsupported",
        queryRequestsExecuted: 0,
      },
      exclusions: [{
        qualification: {
          eligible: false,
          exclusionCodes: [
            "industry-mismatch",
            "insufficient-source-quality",
          ],
        },
      }],
      decision: {
        openedCandidateSnapshotId: null,
        tentativeSelectionSnapshotId: null,
        continuedRevision: null,
      },
      handoff: null,
      sourceRoutes: [{
        channel:
          "Coverage limitation · national-primary-source-not-configured",
        status: "not-searched",
        note: "No native national source route is configured for this scope.",
      }],
    };
    expect(() => assertScreen02Acceptance(input, observation)).not.toThrow();
  });

  it("binds a reviewed candidate when a bounded coordinate omits a bridge sentence", () => {
    const evidenceText =
      "The FERC Order 841 Electric Storage Participation Rule, FR Doc. 2018-03708, requires wholesale-market participation models for electric storage resources. Regional transmission organizations and independent system operators must establish those models.";
    const binding = {
      canonicalTitle: "FERC Order 841 Electric Storage Participation Rule",
      formalIdentifier:
        "Order No. 841; 83 FR 9580; FR Doc. 2018-03708",
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      sourceLocator: "https://www.federalregister.gov/d/2018-03708",
      identityPassages: [
        "FERC Order 841 Electric Storage Participation Rule",
        "FR Doc. 2018-03708",
      ],
      industryBridgePassages: [
        "wholesale-market participation models for electric storage resources",
      ],
      populationBridgePassages: [
        "regional transmission organizations and independent system operators",
      ],
    };
    const source = {
      id: "source-order-841",
      title:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      locator: binding.sourceLocator,
      publisher: binding.issuer,
      publishedDate: "2018-03-06",
      channel: "official-final-rule",
      evidenceText,
    };
    const candidate = {
      identity: {
        canonicalTitle: binding.canonicalTitle,
        formalIdentifier: binding.formalIdentifier,
        issuer: binding.issuer,
        issuingJurisdiction: binding.issuingJurisdiction,
      },
      sourceIds: [source.id],
      qualification: {
        evidenceSourceIds: [source.id],
        industryFit: { evidenceSourceIds: [source.id] },
        substantiveOverview: {
          evidenceSourceIds: [source.id],
          sourceGrounding: {
            coordinates: [{
              sourceId: source.id,
              polarity: "affirmative",
              text:
                "The FERC Order 841 Electric Storage Participation Rule, FR Doc. 2018-03708, requires wholesale-market participation models for electric storage resources.",
              matchedIdentityTerms: ["FERC Order 841"],
            }],
          },
        },
      },
    };
    expect(hasReviewedScreen02CandidateEvidence(
      { acceptance: { requiredCandidateEvidence: binding } },
      candidate,
      new Map([[source.id, source]]),
    )).toBe(true);
  });
});
