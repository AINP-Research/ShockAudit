import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { IdentityCandidateInput, StudyContextDraft } from
  "../../src/core/six-screen/workflow";
import type { PolicyReview } from
  "../../src/core/six-screen/contracts";
import {
  createFederalRegisterPolicyEvidencePlan,
  recordPolicyEvidencePlanAttempt,
} from "../../src/core/six-screen/policy-evidence-plan";
import { unsearchedFederalRegisterPolicyRequirements } from
  "../../src/core/six-screen/policy-review";
import {
  addOfficialIdentitySource,
  addWorkflowArtifact,
  applyPolicyReview,
  applyIdentityResolution,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  deferDisplayedCandidate,
  displayIdentityCandidate,
  openScreen2,
  updateShockRequest,
  updateStudyContext,
} from "../../src/core/six-screen/workflow";

const t0 = "2026-09-12T10:00:00.000Z";
const t1 = "2026-09-12T10:00:01.000Z";
const t2 = "2026-09-12T10:00:02.000Z";
const t3 = "2026-09-12T10:00:03.000Z";
const t4 = "2026-09-12T10:00:04.000Z";

function study(overrides: Partial<StudyContextDraft> = {}): StudyContextDraft {
  return {
    population: "Hospitals",
    analysisUnit: "Hospital",
    geography: ["United States"],
    industry: ["Health care"],
    period: { start: "2018", end: "2025" },
    outcome: "Operating margin",
    intendedConstruct: "Organizational resilience",
    initialExplanation: "Compliance costs may change operating margins.",
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "no",
    ...overrides,
  };
}

function workflow() {
  return createSixScreenWorkflow({
    runId: "run-1",
    studyId: "study-1",
    study: study(),
    shockInput: "Hospital Transparency Rule",
    requestedJurisdiction: "United States",
    approximateYear: "2019",
    intendedEpisode: "final rule",
    createdAt: t0,
  });
}

function candidate(
  id: string,
  overrides: Partial<IdentityCandidateInput> = {},
): IdentityCandidateInput {
  const identitySources = [{
    id: "source-1",
    title: "Transparency in Coverage",
    locator: "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example",
    publisher: "Federal Register",
    publishedDate: "2019-11-27",
    authorityTier: "primary",
    retrievedAt: t2,
  }];
  return {
    id,
    officialTitle: "Transparency in Coverage",
    aliases: ["Hospital Transparency Rule"],
    issuer: "Centers for Medicare & Medicaid Services",
    issuingJurisdiction: "United States",
    instrumentType: "Final rule",
    formalIdentifiers: ["84 FR 65524"],
    episode: "final rule",
    versionScope: "Final rule published November 27, 2019",
    typedDates: [{
      start: "2019-11-27",
      end: null,
      precision: "day",
      kind: "publication",
      passageIds: ["passage-1"],
    }],
    identitySourceIds: ["source-1"],
    sourceSnapshotId: `snapshot-${id}`,
    sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
    identitySources,
    displayedDescription:
      "The official record identifies a final federal rule published on November 27, 2019. This description establishes identity only; operative duties remain for Screen 2 review.",
    matchExplanation: "The supplied title, issuer, date, and final-rule episode align.",
    materialMismatches: [],
    retrievedAt: t2,
    ...overrides,
  };
}

function withCandidates(inputs: IdentityCandidateInput[]) {
  const started = beginIdentityResolution(workflow(), {
    expectedRevision: 0,
    requestId: "identity-request-1",
    requestedAt: t1,
  });
  return applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: inputs,
    appliedAt: t2,
  });
}

function confirmationInput(
  state: ReturnType<typeof withCandidates>,
  overrides: Partial<Parameters<typeof confirmDisplayedShock>[1]> = {},
) {
  const candidate = state.candidates.find(
    ({ id }) => id === state.displayedCandidateId,
  )!;
  return {
    expectedRevision: state.revision,
    candidateId: candidate.id,
    displayedIdentityFingerprint: candidate.identityFingerprint,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    identityRevision: state.identityRevision,
    interactionId: "interaction-confirm-1",
    decisionId: "decision-confirm-1",
    actor: "researcher_ui" as const,
    confirmedAt: t3,
    ...overrides,
  };
}

function policyReview(
  state: ReturnType<typeof withCandidates>,
): PolicyReview {
  const url =
    "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html";
  const afterExplanation = recordPolicyEvidencePlanAttempt(
    createFederalRegisterPolicyEvidencePlan({
      id: "policy-plan-1",
      identityFingerprint: state.confirmedShock!.identityFingerprint,
      documentNumber: "2019-24931",
      createdAt: t4,
    }),
    {
      stepId: "explanatory-context-2019-24931",
      attemptedAt: t4,
      outcome: "searched",
      failureCode: null,
      note: "An independent official explanation was inspected.",
    },
  );
  const plan = recordPolicyEvidencePlanAttempt(
    afterExplanation,
    {
      stepId: "fr-core-2019-24931",
      attemptedAt: t4,
      outcome: "searched",
      failureCode: null,
      note: "The exact published rule was inspected.",
    },
  );
  const requirements = unsearchedFederalRegisterPolicyRequirements(
    "2019-24931",
  ).map((requirement) => ({
    kind: requirement.kind as PolicyReview["requirements"][number]["kind"],
    description: requirement.description,
    status: requirement.kind === "operative_change"
      ? "supported" as const
      : requirement.kind === "temporal_stage" ||
          requirement.kind === "implementation"
        ? "not_found" as const
        : requirement.status,
    criticality: requirement.criticality,
  }));
  return {
    protocolVersion: "screen-02-federal-register-policy-v2",
    taskId: "policy-task-1",
    status: "partial",
    failureCode: null,
    documentNumber: "2019-24931",
    identityFingerprint: state.confirmedShock!.identityFingerprint,
    evidenceSnapshotId: "policy-evidence-1",
    evidenceSnapshotFingerprint: fingerprintSixScreenValue("policy-evidence"),
    artifactStatus: "current",
    sourceCount: 1,
    passageCount: 1,
    claimCount: 1,
    claims: [{
      claimId: "policy-claim-1",
      predicate: "operative_change",
      statement: "Hospitals must publish standard charges.",
      typedValue: { documentNumber: "2019-24931" },
      supportStatus: "direct",
      qualification: null,
      citation: {
        passageId: "policy-passage-1",
        exactText: "Hospitals must publish standard charges.",
        locator: "Operative change",
        documentVersionId: "policy-document-1",
        sourceId: "policy-source-1",
        sourceTitle: "Hospital Price Transparency Requirements",
        canonicalUrl: url,
        sourceRole: "official Federal Register representation",
        inspectedText: "full",
      },
    }],
    plan,
    progress: {
      searchedSteps: 2,
      totalSteps: 5,
      retainedDocuments: 1,
      chargedDocumentAttempts: 1,
      interruptedOperations: 0,
      receivedBytes: 120,
      activeResearchMs: 5,
      continuationMode: "panel_driven",
    },
    requirements,
    attemptedSources: [url],
    unresolved: requirements
      .filter(({ status }) => status !== "supported")
      .map(({ kind }) => kind),
    limitation: "The next bounded plan step remains available.",
    researchedAt: t4,
    invalidatedAt: null,
    invalidationReason: null,
  };
}

describe("six-screen Screen 1 identity gate", () => {
  it("preserves the exact original shock input and unrelated study fields through correction", () => {
    const initial = workflow();
    const changed = updateShockRequest(initial, {
      expectedRevision: 0,
      shockInput: "Hospital Price Transparency final rule",
      requestedJurisdiction: "United States",
      approximateYear: "2019",
      intendedEpisode: "final rule",
      updatedAt: t1,
    });

    expect(changed.originalShockInput).toBe("Hospital Transparency Rule");
    expect(changed.currentShockInput).toBe("Hospital Price Transparency final rule");
    expect(changed.shockInputHistory.map(({ value }) => value)).toEqual([
      "Hospital Transparency Rule",
      "Hospital Price Transparency final rule",
    ]);
    expect(changed.study).toMatchObject(initial.study);
    expect(changed.confirmedShock).toBeNull();
  });

  it("retires prior-policy source locators from a new active identity request", () => {
    const initial = createSixScreenWorkflow({
      runId: "run-source-scope",
      studyId: "study-source-scope",
      study: study(),
      shockInput: "California Consumer Privacy Act",
      officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
      requestedJurisdiction: "California",
      createdAt: t0,
    });
    const changed = updateShockRequest(initial, {
      expectedRevision: 0,
      shockInput: "Sarbanes-Oxley Act of 2002",
      officialIdentifier: "Public Law 107-204",
      requestedJurisdiction: "United States",
      approximateYear: "2002",
      intendedEpisode: "enactment",
      updatedAt: t1,
    });

    expect(changed.officialSourceLocators).toEqual([]);
    expect(changed.study).toMatchObject(initial.study);
  });

  it("retires a source locator when the requested episode changes", () => {
    const initial = createSixScreenWorkflow({
      runId: "run-source-episode-scope",
      studyId: "study-source-episode-scope",
      study: study(),
      shockInput: "California Consumer Privacy Act",
      officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
      requestedJurisdiction: "California",
      approximateYear: "2018",
      intendedEpisode: "enactment",
      createdAt: t0,
    });
    const changed = updateShockRequest(initial, {
      expectedRevision: 0,
      shockInput: "California Consumer Privacy Act",
      requestedJurisdiction: "California",
      approximateYear: "2020",
      intendedEpisode: "implementation",
      updatedAt: t1,
    });

    expect(changed.officialSourceLocators).toEqual([]);
  });

  it("does not allow same-title candidates from different jurisdictions to substitute for the displayed match", () => {
    let state = withCandidates([
      candidate("federal"),
      candidate("state", {
        issuer: "State Department of Health",
        issuingJurisdiction: "New York",
        formalIdentifiers: ["10 NYCRR 400.1"],
        materialMismatches: ["The issuer and jurisdiction differ from the request."],
      }),
    ]);
    const stateCandidate = state.candidates[1]!;

    expect(() => confirmDisplayedShock(state, confirmationInput(state, {
      candidateId: stateCandidate.id,
      displayedIdentityFingerprint: stateCandidate.identityFingerprint,
      sourceSnapshotId: stateCandidate.sourceSnapshotId,
      sourceSnapshotFingerprint: stateCandidate.sourceSnapshotFingerprint,
    }))).toThrow(/currently displayed/u);

    state = displayIdentityCandidate(state, {
      expectedRevision: 2,
      candidateId: "state",
      displayedAt: t3,
    });
    const confirmed = confirmDisplayedShock(state, confirmationInput(state, {
      expectedRevision: 3,
      candidateId: stateCandidate.id,
      displayedIdentityFingerprint: stateCandidate.identityFingerprint,
      sourceSnapshotId: stateCandidate.sourceSnapshotId,
      sourceSnapshotFingerprint: stateCandidate.sourceSnapshotFingerprint,
    }));
    expect(confirmed.confirmedShock?.issuingJurisdiction).toBe("New York");
  });

  it.each([
    [
      "reused bill number in another session",
      candidate("bill-117", {
        officialTitle: "Hospital Transparency Act",
        issuer: "United States Congress",
        instrumentType: "Bill",
        formalIdentifiers: ["H.R. 123, 117th Congress"],
        episode: "introduced bill",
        versionScope: "117th Congress introduced text",
      }),
      candidate("bill-118", {
        officialTitle: "Hospital Transparency Act",
        issuer: "United States Congress",
        instrumentType: "Bill",
        formalIdentifiers: ["H.R. 123, 118th Congress"],
        episode: "introduced bill",
        versionScope: "118th Congress introduced text",
      }),
    ],
    [
      "proposal versus final rule",
      candidate("proposed", {
        instrumentType: "Proposed rule",
        formalIdentifiers: ["84 FR 65464"],
        episode: "proposed rule",
        versionScope: "Notice of proposed rulemaking",
      }),
      candidate("final", {
        instrumentType: "Final rule",
        episode: "final rule",
        versionScope: "Final rule",
      }),
    ],
    [
      "original law versus amendment",
      candidate("original", {
        officialTitle: "Hospital Transparency Act",
        instrumentType: "Public law",
        formalIdentifiers: ["Pub. L. 115-1"],
        episode: "original enactment",
        versionScope: "Law as enacted in 2017",
      }),
      candidate("amendment", {
        officialTitle: "Hospital Transparency Amendment Act",
        instrumentType: "Public law",
        formalIdentifiers: ["Pub. L. 117-8"],
        episode: "amendment",
        versionScope: "2021 amendment",
      }),
    ],
    [
      "statute versus implementing regulation",
      candidate("statute", {
        officialTitle: "Hospital Transparency Act",
        issuer: "United States Congress",
        instrumentType: "Public law",
        formalIdentifiers: ["Pub. L. 115-1"],
        episode: "original enactment",
        versionScope: "Law as enacted",
      }),
      candidate("implementing-rule", {
        officialTitle: "Hospital Transparency Implementing Rule",
        issuer: "Centers for Medicare & Medicaid Services",
        instrumentType: "Final rule",
        formalIdentifiers: ["84 FR 65524"],
        episode: "implementation",
        versionScope: "Implementing final rule",
      }),
    ],
  ])("keeps %s as distinct confirmable identities", (_label, first, second) => {
    const state = withCandidates([first, second]);
    expect(state.candidates[0]!.identityFingerprint).not.toBe(
      state.candidates[1]!.identityFingerprint,
    );
    expect(() => confirmDisplayedShock(state, confirmationInput(state, {
      candidateId: second.id,
      displayedIdentityFingerprint: state.candidates[1]!.identityFingerprint,
      sourceSnapshotId: second.sourceSnapshotId,
      sourceSnapshotFingerprint: second.sourceSnapshotFingerprint,
    }))).toThrow(/currently displayed/u);
  });

  it("rejects a late identity response after the policy request changes", () => {
    const started = beginIdentityResolution(workflow(), {
      expectedRevision: 0,
      requestId: "identity-old",
      requestedAt: t1,
    });
    const changed = updateShockRequest(started.state, {
      expectedRevision: 1,
      shockInput: "A different final rule",
      requestedJurisdiction: "United States",
      approximateYear: "2020",
      intendedEpisode: "final rule",
      updatedAt: t2,
    });
    expect(() => applyIdentityResolution(changed, {
      expectedRevision: 2,
      request: started.request,
      candidates: [candidate("late")],
      appliedAt: t3,
    })).toThrow(/Stale identity result/u);
  });

  it("rejects tampered identity source snapshots and credential-bearing source URLs", () => {
    const started = beginIdentityResolution(workflow(), {
      expectedRevision: 0,
      requestId: "identity-source-integrity",
      requestedAt: t1,
    });
    const tampered = candidate("tampered", {
      sourceSnapshotFingerprint: fingerprintSixScreenValue("not-the-sources"),
    });
    expect(() => applyIdentityResolution(started.state, {
      expectedRevision: 1,
      request: started.request,
      candidates: [tampered],
      appliedAt: t2,
    })).toThrow(/source snapshot fingerprint is invalid/u);

    const credentialBearingUrl = new URL("https://example.gov/rule");
    credentialBearingUrl.searchParams.set("api_key", "[redacted]");
    expect(() => addOfficialIdentitySource(workflow(), {
      expectedRevision: 0,
      sourceUrl: credentialBearingUrl.toString(),
      interactionId: "credential-source",
      addedAt: t1,
    })).toThrow(/must not contain credentials/u);
  });

  it.each([
    ["identity fingerprint", { displayedIdentityFingerprint: fingerprintSixScreenValue("other") }],
    ["source snapshot", { sourceSnapshotId: "snapshot-other" }],
    ["source fingerprint", { sourceSnapshotFingerprint: fingerprintSixScreenValue("other") }],
    ["original request", { originalRequestFingerprint: fingerprintSixScreenValue("other") }],
    ["current request", { currentRequestFingerprint: fingerprintSixScreenValue("other") }],
    ["identity revision", { identityRevision: 99 }],
  ])("rejects a UI/server mismatch in the %s coordinate", (_label, override) => {
    const state = withCandidates([candidate("federal")]);
    expect(() => confirmDisplayedShock(
      state,
      confirmationInput(state, override),
    )).toThrow(/coordinates do not match/u);
  });

  it("makes confirmation researcher-owned and blocks model or system confirmation", () => {
    const state = withCandidates([candidate("federal")]);
    for (const actor of ["model", "system"] as const) {
      expect(() => confirmDisplayedShock(state, confirmationInput(state, {
        actor,
      }))).toThrow(/researcher UI action/u);
    }
  });

  it("blocks Screen 2 until the exact displayed identity is confirmed", () => {
    const state = withCandidates([candidate("federal")]);
    expect(() => openScreen2(state, {
      expectedRevision: 2,
      openedAt: t3,
    })).toThrow(/researcher-confirmed shock/u);

    const confirmed = confirmDisplayedShock(state, confirmationInput(state));
    const opened = openScreen2(confirmed, {
      expectedRevision: 3,
      openedAt: t4,
    });
    expect(opened.state.activeScreen).toBe(2);
    expect(opened.receipt.confirmedShock.episode).toBe("final rule");
    expect(opened.receipt.confirmedShock.confirmation.actor).toBe("researcher");
  });

  it("keeps source-linked Screen 2 evidence current when study context changes", () => {
    let state = withCandidates([candidate("federal", {
      formalIdentifiers: ["2019-24931"],
    })]);
    state = confirmDisplayedShock(state, confirmationInput(state));
    state = openScreen2(state, {
      expectedRevision: state.revision,
      openedAt: t4,
    }).state;
    state = applyPolicyReview(state, {
      expectedRevision: state.revision,
      review: policyReview(state),
      appliedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(state.policyReview).toMatchObject({
      status: "partial",
      artifactStatus: "current",
      claimCount: 1,
    });
    expect(state.artifacts.at(-1)).toMatchObject({
      screen: 2,
      status: "current",
      snapshotId: "policy-evidence-1",
    });
    state = updateStudyContext(state, {
      expectedRevision: state.revision,
      study: study({ geography: ["United States", "Canada"] }),
      updatedAt: "2026-09-12T10:00:06.000Z",
    });
    expect(state.policyReview).toMatchObject({
      artifactStatus: "current",
      invalidatedAt: null,
      invalidationReason: null,
    });
    expect(state.artifacts.at(-1)).toMatchObject({
      screen: 2,
      status: "current",
      snapshotId: "policy-evidence-1",
    });
  });

  it("preserves study inputs when a candidate is rejected or marked as another version", () => {
    const state = withCandidates([candidate("first"), candidate("second")]);
    const rejected = deferDisplayedCandidate(state, {
      expectedRevision: 2,
      candidateId: "first",
      action: "rejected",
      interactionId: "reject-1",
      decidedAt: t3,
    });
    expect(rejected.study).toEqual(state.study);
    expect(rejected.displayedCandidateId).toBe("second");
    const related = deferDisplayedCandidate(rejected, {
      expectedRevision: 3,
      candidateId: "second",
      action: "different_version",
      interactionId: "related-1",
      note: "I mean the amendment.",
      decidedAt: t4,
    });
    expect(related.study).toEqual(state.study);
    expect(related.candidates).toEqual([]);
    expect(related.candidateDecisions.map(({ action }) => action)).toEqual([
      "rejected",
      "different_version",
    ]);
  });

  it("invalidates confirmation and archives downstream artifacts when identity evidence changes", () => {
    let state = withCandidates([candidate("federal")]);
    state = confirmDisplayedShock(state, confirmationInput(state));
    state = addWorkflowArtifact(state, {
      expectedRevision: 3,
      artifact: {
        snapshotId: "event-card-1",
        screen: 2,
        status: "current",
        dependencies: {
          studyRevision: state.study.revision,
          identityFingerprint: state.confirmedShock!.identityFingerprint,
          eventCardSnapshotId: null,
          selectedDesignSnapshotId: null,
          coeventSnapshotId: null,
          mechanismSnapshotId: null,
        },
        invalidatedAt: null,
        invalidationReason: null,
      },
      addedAt: t4,
    });
    const changed = addOfficialIdentitySource(state, {
      expectedRevision: 4,
      sourceUrl: "https://www.federalregister.gov/documents/2019/11/27/example",
      interactionId: "source-add-1",
      addedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(changed.confirmedShock).toBeNull();
    expect(changed.activeScreen).toBe(1);
    expect(changed.artifacts[0]).toMatchObject({
      status: "archived",
      invalidationReason: "Identity evidence changed and requires reconfirmation.",
    });
  });

  it("keeps outcome measure and policy-side concept separate from legacy fields while invalidating only dependent artifacts", () => {
    let state = withCandidates([candidate("federal")]);
    state = confirmDisplayedShock(state, confirmationInput(state));
    const dependencies = {
      studyRevision: state.study.revision,
      identityFingerprint: state.confirmedShock!.identityFingerprint,
      eventCardSnapshotId: null,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: null,
    };
    for (const screen of [2, 3, 4, 5, 6] as const) {
      state = addWorkflowArtifact(state, {
        expectedRevision: state.revision,
        artifact: {
          snapshotId: `artifact-${screen}`,
          screen,
          status: "current",
          dependencies,
          invalidatedAt: null,
          invalidationReason: null,
        },
        addedAt: `2026-09-12T10:00:${String(screen + 4).padStart(2, "0")}.000Z`,
      });
    }
    const revised = updateStudyContext(state, {
      expectedRevision: state.revision,
      study: study({
        outcomeMeasure: "Return on assets",
        policySideConcept: "Price transparency",
      }),
      updatedAt: "2026-09-12T10:00:20.000Z",
    });
    expect(revised.confirmedShock).not.toBeNull();
    expect(revised.study).toMatchObject({
      outcome: "Operating margin",
      outcomeMeasure: "Return on assets",
      intendedConstruct: "Organizational resilience",
      policySideConcept: "Price transparency",
    });
    expect(revised.artifacts.find(({ screen }) => screen === 2)?.status).toBe("current");
    expect(revised.artifacts.filter(({ screen }) => screen >= 3).every(
      ({ status }) => status === "out_of_date",
    )).toBe(true);

    const historicalOnly = updateStudyContext(revised, {
      expectedRevision: revised.revision,
      study: study({
        outcomeMeasure: "Return on assets",
        policySideConcept: "Price transparency",
        intendedConstruct: "Different historical wording",
      }),
      updatedAt: "2026-09-12T10:00:21.000Z",
    });
    expect(historicalOnly).toEqual(revised);
  });
});
