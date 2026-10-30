import { describe, expect, it } from "vitest";

import {
  buildScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  continueScreen02AuditWithoutAssessment,
  continueScreen02FindWithoutAssessment,
  fingerprintScreen02WorkflowValue,
  prepareScreen02AssessmentRequest,
  screen02AuditAssessmentUnavailableContinuationGate,
  screen02AuditContinuationGate,
  screen02FindAssessmentUnavailableContinuationGate,
  screen02FindCandidateGate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  screen02AssessmentUnavailableScreen03Checks,
  screen02AuditAssessmentPartIds,
  screen02FindAssessmentPartIds,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  applyScreen03Action,
  buildScreen03StateFromResearch,
  createScreen03LoadingState,
  fingerprintScreen03Value,
  restoreScreen03VerificationState,
  screen03FactualClaims,
  screen03ProposalIsAssessmentUnavailableCheck,
  type Screen03ResearchPacket,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  buildAuditIdentityState,
  buildFindFactsState,
} from "./screen02-workflow-fixtures";

function unavailableFindHandoff() {
  let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
    jobId: "screen03-find-unavailable-job",
    requestId: "screen03-find-unavailable-request",
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "screen03-find-unavailable-request",
    status: "message-delivered",
    at: "2026-08-09T18:00:03.000Z",
    actor: "chatgpt-host",
  });
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "screen03-find-unavailable-request",
    status: "no-tool-submission",
    at: "2026-08-09T18:00:04.000Z",
    actor: "chatgpt-host",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  expect(
    screen02FindCandidateSelectionGate(
      state,
      "gdpr-candidate-snapshot-v1",
    ),
  ).toEqual({ eligible: true, reasons: [] });
  state = selectScreen02FindCandidate(
    state,
    "gdpr-candidate-snapshot-v1",
    "screen03-find-selection",
    "2026-08-09T18:00:05.000Z",
    "Select the source-backed event after the unavailable assessment state.",
  );
  expect(
    screen02FindCandidateGate(state, "gdpr-candidate-snapshot-v1").eligible,
  ).toBe(false);
  expect(screen02FindAssessmentUnavailableContinuationGate(state)).toEqual({
    eligible: true,
    reasons: [],
    affectedRequestIds: ["screen03-find-unavailable-request"],
  });
  const continued = continueScreen02FindWithoutAssessment(
    state,
    "screen03-find-unavailable-continuation",
    "2026-08-09T18:00:06.000Z",
    "ChatGPT did not return the preliminary assessment.",
    "Continue with all six mandatory Screen 3 checks.",
  );
  return buildScreen02WorkflowHandoff(
    continued,
    "0.3.07",
    "2026-08-09T18:00:07.000Z",
  );
}

function unavailableAuditHandoff() {
  let state = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    jobId: "screen03-audit-unavailable-job",
    requestId: "screen03-audit-unavailable-request",
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: "2026-08-09T18:10:09.000Z",
  });
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "screen03-audit-unavailable-request",
    status: "message-delivered",
    at: "2026-08-09T18:10:10.000Z",
    actor: "chatgpt-host",
  });
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "screen03-audit-unavailable-request",
    status: "timed-out",
    at: "2026-08-09T18:10:11.000Z",
    actor: "chatgpt-host",
  });
  if (state.mode !== "audit") throw new Error("Expected Audit state.");
  expect(screen02AuditContinuationGate(state).eligible).toBe(false);
  expect(screen02AuditAssessmentUnavailableContinuationGate(state)).toEqual({
    eligible: true,
    reasons: [],
    affectedRequestIds: ["screen03-audit-unavailable-request"],
  });
  const continued = continueScreen02AuditWithoutAssessment(
    state,
    "screen03-audit-unavailable-continuation",
    "2026-08-09T18:10:12.000Z",
    "ChatGPT did not return the confirmed-event assessment.",
    "Continue with all six mandatory Screen 3 checks.",
  );
  return buildScreen02WorkflowHandoff(
    continued,
    "0.3.07",
    "2026-08-09T18:10:13.000Z",
  );
}

function researchPacket(
  handoff: Screen02WorkflowHandoff,
): Screen03ResearchPacket {
  const identity = handoff.event.identity.canonicalTitle;
  return {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt: "2026-08-09T20:00:00.000Z",
    upstreamEventFingerprint: handoff.integrity.eventFingerprint,
    coverage: {
      queries: [{
        id: "query-official-identity",
        query: `${identity} official record`,
        purpose: "Verify the selected event identity from an official record.",
        returnedEvidenceIds: ["official-identity-record"],
      }],
      channels: [{
        channel: "official-primary",
        status: "searched",
        note: "The bounded official identity record was reviewed.",
        retrievedAt: "2026-08-09T20:00:00.000Z",
      }],
      routes: ["exact event title"],
      stages: ["identity"],
      languages: ["en"],
      authorityTiers: [1],
      gaps: [],
      recordsReviewed: 1,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after the selected event identity has direct official support.",
        status: "met",
        note: "The bounded identity target was met.",
      },
      outcomeValuesInspected: false,
    },
    evidence: [{
      id: "official-identity-record",
      sourceId: "official-identity-record",
      title: "Official identity record",
      locator: "https://official.example.test/event",
      publisher: "Official authority",
      publishedDate: "2018-01-01",
      retrievedAt: "2026-08-09T20:00:00.000Z",
      authorityTier: 1,
      channel: "official-primary",
      contentFingerprint: fingerprintScreen02WorkflowValue({ identity }),
      language: "en",
      status: "retrieved",
      passages: [{
        id: "official-identity-record:passage:1",
        number: 1,
        text: `The official record identifies ${identity}.`,
        locator: "Identity heading",
        basis: "source-excerpt",
      }],
    }],
    proposals: {
      identity: [{
        id: "verified-canonical-title",
        group: "identity",
        label: "Canonical title",
        value: identity,
        critical: true,
        reviewStatus: "proposed",
        editedValue: null,
        support: "direct",
        sourceIds: ["official-identity-record"],
        passageIds: ["official-identity-record:passage:1"],
        uncertainty: null,
      }],
      overview: [],
      timeline: [],
      component: [],
      eligibility: [],
      amendment: [],
      requiredVariable: [{
        id: "research-planning-input",
        group: "required-variable",
        label: "Later planning input",
        value: "Collect organization-level exposure indicators later.",
        critical: true,
        reviewStatus: "proposed",
        editedValue: null,
        support: "unsupported",
        sourceIds: [],
        passageIds: [],
        uncertainty: "Planning only.",
      }],
    },
    contradictions: [],
    outcomeValuesInspected: false,
  };
}

function apply(
  state: Screen03VerificationState,
  action: Parameters<typeof applyScreen03Action>[1] extends infer Action
    ? Action extends { at: string }
      ? Omit<Action, "at">
      : never
    : never,
  at: string,
) {
  return applyScreen03Action(state, {
    ...action,
    at,
  } as Parameters<typeof applyScreen03Action>[1]);
}

describe.each([
  ["Find", unavailableFindHandoff],
  ["Audit", unavailableAuditHandoff],
] as const)("Screen 3 assessment-unavailable safety contract from %s", (_mode, handoffFactory) => {
  it("preserves all six checks as nonblocking reminders and excludes them from the Event Card", () => {
    const handoff = handoffFactory();
    const loading = createScreen03LoadingState(
      handoff,
      "2026-08-09T19:59:59.000Z",
    );
    const loadingChecks = loading.proposals.requiredVariable.filter(
      screen03ProposalIsAssessmentUnavailableCheck,
    );
    expect(loadingChecks.map((check) => check.value)).toEqual([
      ...screen02AssessmentUnavailableScreen03Checks,
    ]);
    expect(loadingChecks.every((check) =>
      check.reviewStatus === "proposed" && !check.critical
    )).toBe(true);

    let state = buildScreen03StateFromResearch(
      handoff,
      researchPacket(handoff),
      "2026-08-09T20:00:01.000Z",
    );
    const integratedChecks = state.proposals.requiredVariable.filter(
      screen03ProposalIsAssessmentUnavailableCheck,
    );
    expect(integratedChecks.map((check) => check.value)).toEqual([
      ...screen02AssessmentUnavailableScreen03Checks,
    ]);
    expect(state.proposals.requiredVariable.find(
      (proposal) => proposal.id === "research-planning-input",
    )).toMatchObject({ critical: false, reviewStatus: "proposed" });

    state = apply(state, {
      type: "review-all-fields",
      mode: "confirm",
      reason: "Confirm only directly supported factual claims.",
    }, "2026-08-09T20:00:02.000Z");
    expect(state.proposals.identity[0]?.reviewStatus).toBe("accepted");
    expect(state.proposals.requiredVariable.filter(
      screen03ProposalIsAssessmentUnavailableCheck,
    ).every((check) => check.reviewStatus === "proposed")).toBe(true);
    const remainingFactualClaims = screen03FactualClaims(state.proposals)
      .filter((proposal) => proposal.reviewStatus === "proposed");
    expect(remainingFactualClaims.length).toBeGreaterThan(0);
    const firstDecisionAt = Date.parse("2026-08-09T20:00:02.100Z");
    for (const [index, proposal] of remainingFactualClaims.entries()) {
      state = apply(state, {
        type: "review-field",
        proposalId: proposal.id,
        decision: "reject",
        reason:
          "Record an explicit decision for a visible claim that lacks direct support.",
      }, new Date(firstDecisionAt + index).toISOString());
    }
    const checkIds = integratedChecks.map((check) => check.id);
    state = apply(state, {
      type: "lock-event-card",
      reason: "Lock after every visible factual claim has a decision.",
    }, new Date(firstDecisionAt + remainingFactualClaims.length + 1).toISOString());

    expect(state.status).toBe("locked");
    expect(state.lockedEventCard?.acceptedProposals.requiredVariable).toEqual([]);
    expect(state.lockedEventCard?.reviewedProposals.requiredVariable).toEqual([]);
    expect(state.lockedEventCard?.limitations.unknownProposalIds).not.toEqual(
      expect.arrayContaining(checkIds),
    );
    expect(state.lockedEventCard?.limitations.unsupportedProposalIds).not.toEqual(
      expect.arrayContaining(checkIds),
    );
    expect(restoreScreen03VerificationState(state)).toEqual(state);
  });

  it("restores an older state carrying only one assessment reminder", () => {
    const handoff = handoffFactory();
    const legacy = structuredClone(buildScreen03StateFromResearch(
      handoff,
      researchPacket(handoff),
      "2026-08-09T20:00:01.000Z",
    ));
    legacy.proposals.requiredVariable = [
      legacy.proposals.requiredVariable.find(
        screen03ProposalIsAssessmentUnavailableCheck,
      )!,
    ];
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const restored = restoreScreen03VerificationState(legacy);
    expect(restored?.proposals.requiredVariable).toHaveLength(1);
    expect(
      restored?.proposals.requiredVariable.every(
        screen03ProposalIsAssessmentUnavailableCheck,
      ),
    ).toBe(true);
  });
});
