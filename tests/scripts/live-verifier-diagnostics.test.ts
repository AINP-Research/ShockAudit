import { describe, expect, it } from "vitest";

// @ts-expect-error Plain Node ESM diagnostics intentionally have no generated types.
import { captureFindDiscoveryDiagnostics, liveVerifierFailureDiagnostic } from "../../scripts/live-verifier-diagnostics.mjs";

const privateValue = "PRIVATE-CANARY-DO-NOT-EXPORT";
const qualification = {
  eligible: false,
  classification: "mismatch",
  candidateId: privateValue,
  scopeFingerprint: privateValue,
  cacheKey: privateValue,
  sourceFingerprint: privateValue,
  explanation: privateValue,
  evidenceSourceIds: [privateValue],
  hardScope: {
    passed: true,
    disposition: "supported",
    explanation: privateValue,
  },
  sourceQuality: { status: "limited", explanation: privateValue },
  substantiveOverview: {
    passed: false, identity: true, change: false,
    affectedPopulation: false, materialDate: true, summary: privateValue,
  },
  exposureFeasibility: { status: "unclear", explanation: privateValue },
  exclusionCodes: ["industry-mismatch", "excluded-insufficient-substantive-information"],
};

function emptyFind() {
  return {
    runId: privateValue,
    responseKey: privateValue,
    stateEnvelope: privateValue,
    activeCandidateSetSnapshotId: privateValue,
    discoveryRequests: [{ status: "completed-empty", discoveryRequestId: privateValue, failureCodes: [privateValue] }],
    candidates: [],
    sources: [{ id: privateValue, locator: privateValue }],
    assessments: [],
    assessmentRequests: [],
    candidateSets: [{
      candidateSetSnapshotId: privateValue,
      status: "active",
      candidateSnapshotIds: [] as string[],
      ordering: [] as Array<{ candidateSnapshotId: string; rank: number }>,
      manifest: {
        exactRequest: privateValue,
        outcomeValuesInspected: false,
        queryMatrix: [{ query: privateValue, returnedRecordIds: [privateValue] }],
        contextLeads: [{ id: privateValue, title: privateValue }],
        contextBridges: [{
          status: "no-corroboration",
          formalIdentifier: privateValue,
        }],
        channels: [
          { channel: "federal-register-api-v1 diagnostics", status: "failed", note: privateValue },
          { channel: privateValue, status: privateValue, note: privateValue },
        ],
        exclusions: [
          { recordId: privateValue, reason: privateValue, qualification },
          { recordId: privateValue, reason: privateValue, qualification: { ...qualification, exclusionCodes: [privateValue] } },
        ],
        stoppingRule: { status: "not-met", note: privateValue },
        funnel: {
          schemaVersion: "screen-02-search-funnel-v2", sourceRecordsRetrieved: 7,
          uniqueEventLeads: 5, evaluatedUniqueLeads: 2, qualifiedCandidates: 0,
          displayedCandidates: 0, hardScopePassed: 2,
          hardScopeDemonstratedMismatch: 0, hardScopeInsufficientEvidence: 0,
          hardScopeMixed: 0, deeperRetrievalAttempts: 0,
          // A source-route failure is independent of deeper document attempts.
          retrievalFailures: 1, hostContribution: 0, privateKey: privateValue,
        },
      },
    }],
  };
}

describe("sanitized live Find failure diagnostics", () => {
  it("retains an empty Find funnel, exclusion reasons, and failed route before candidate assertion", () => {
    const input = emptyFind();
    const before = JSON.stringify(input);
    const evidence = captureFindDiscoveryDiagnostics(input, {
      assessmentAvailable: false, preparedRequestCount: 0,
      deliveredRequestCount: 0, completedRequestCount: 0,
    });
    expect(evidence.counts).toMatchObject({
      activeCandidates: 0,
      fixedQualifiedActiveCandidates: 0,
      exclusions: 2,
      queries: 1,
      contextLeads: 1,
      contextBridges: 1,
    });
    expect(evidence.funnel).toMatchObject({ sourceRecordsRetrieved: 7, evaluatedUniqueLeads: 2, displayedCandidates: 0 });
    expect(evidence.discoveryStatuses).toEqual([{ status: "completed-empty", count: 1 }]);
    expect(evidence.sourceRoutes).toContainEqual({ route: "federal-register-api-v1-diagnostics", status: "failed", count: 1 });
    expect(evidence.contextBridgeStatuses).toEqual([
      { status: "no-corroboration", count: 1 },
    ]);
    expect(evidence.exclusions).toContainEqual({ code: "industry-mismatch", count: 1 });
    expect(evidence.gates).toMatchObject({
      selectedCandidateFixedQualified: false,
      hasDisplayedCandidates: false,
      expectedFunnelSchema: true,
      hardScopeDispositionCountsConsistent: true,
      retrievalFailureCountValid: true,
    });
    expect(evidence.qualificationGates[0]).toMatchObject({
      hardScopeDisposition: "supported",
      sourceQualityPassed: true,
      substantiveInformationPassed: false,
      exposureFeasible: true,
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("never echoes arbitrary state identifiers, credentials, provider prose, or unknown vocabularies", () => {
    const encoded = JSON.stringify(captureFindDiscoveryDiagnostics(emptyFind(), { error: privateValue }));
    expect(encoded).not.toContain(privateValue);
    for (const forbidden of ["runId", "responseKey", "stateEnvelope", "candidateId", "recordId", "sourceFingerprint", "cacheKey", "exactRequest", "locator", "explanation"]) {
      expect(encoded).not.toContain(`"${forbidden}"`);
    }
    expect(encoded).toContain('"other-route"');
    expect(encoded).toContain('"unknown"');
  });

  it("uses active candidates and preserves the verifier's eligible ordered selection and fallback", () => {
    const state = emptyFind();
    const active = state.candidateSets[0];
    active.candidateSnapshotIds = ["ineligible", "eligible"];
    active.ordering = [{ candidateSnapshotId: "ineligible", rank: 1 }, { candidateSnapshotId: "eligible", rank: 2 }];
    const candidates = [
      { candidateSnapshotId: "ineligible", qualification },
      { candidateSnapshotId: "eligible", qualification: { ...qualification, eligible: true, classification: "direct" } },
      { candidateSnapshotId: "historical", qualification: { ...qualification, eligible: true, classification: "direct" } },
    ];
    const evidence = captureFindDiscoveryDiagnostics({ ...state, candidates });
    expect(evidence.counts).toMatchObject({ allCandidates: 3, activeCandidates: 2, fixedQualifiedActiveCandidates: 1 });
    expect(evidence.gates.selectedCandidateFixedQualified).toBe(true);
    active.ordering = [];
    expect(captureFindDiscoveryDiagnostics({ ...state, candidates }).gates.selectedCandidateFixedQualified).toBe(true);
  });

  it("distinguishes missing observations from measured zero and maps failures without echoing private errors", () => {
    const missing = captureFindDiscoveryDiagnostics(null);
    expect(missing.funnel.displayedCandidates).toBeNull();
    expect(missing.gates.expectedFunnelSchema).toBe(false);
    expect(missing.activeSetStatus).toBe("unknown");
    const observed = liveVerifierFailureDiagnostic(new Error("Canonical Find state has no fixed-qualified active candidate for Screen 3."));
    expect(observed.code).toBe("SA-LIVE-FIND-NO-FIXED-QUALIFIED-CANDIDATE");
    expect(observed.publicMessage).toBe("Canonical Find state has no fixed-qualified active candidate for Screen 3.");
    expect(liveVerifierFailureDiagnostic(new Error("Round 1 Find did not complete the fixed qualification funnel without retired host assessment work.")).code)
      .toBe("SA-LIVE-FIND-QUALIFICATION-CONTRACT");
    expect(JSON.stringify(liveVerifierFailureDiagnostic(new Error(privateValue)))).not.toContain(privateValue);
  });
});
