import { describe, expect, it, vi } from "vitest";

import {
  buildScreen02StudyRelevanceProfile,
} from "../../src/core/screen02-relevance-profile";
import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
} from "../../src/core/host-reasoning-task";
import {
  createScreen02SearchReviewPolicy,
  uniqueExactScreen03QuoteOffsets,
} from "../../src/worker/host-reasoning-task-policies";

const at = "2026-09-03T12:00:00.000Z";
const sourceText =
  "The official statute regulates video games distribution and storefront access.";
const officialSourceLead = {
  url: "https://legislature.example/statutes/digital-storefront",
  title: "Digital storefront statute text",
  issuingBody: "Example Legislature",
  jurisdiction: "Example jurisdiction",
  reasonForRetrieval: "Retrieve the official operative requirements.",
  candidateIdIfKnown: "candidate-1",
};

function profile() {
  return buildScreen02StudyRelevanceProfile({
    scopeFingerprint: fingerprintHostReasoningValue("scope"),
    originalIndustryText: "video gaming",
    sampleGeography: "United States",
    studyPeriod: "2020–2026",
    eventFamily: "regulation",
    at,
  });
}

function facts() {
  return {
    studyProfile: profile(),
    confirmedScope: {
      population: "Video game publishers",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "video gaming",
      studyPeriod: "2020–2026",
      eventFamily: "regulation",
      outcomeFamily: "distribution",
      outcomeFrequency: "annual",
    },
    researcherCriteria: [],
    candidates: [{
      candidateId: "candidate-1",
      title: "Digital storefront statute",
      description: "A rule addressing video games distribution.",
      affectedPopulationFacts: ["Video game publishers"],
      dateLeads: ["Effective in 2025"],
      sources: [{
        sourceId: "source-1",
        title: "Official statute",
        authority: "Legislature",
        locator: "https://leglk.example/statute",
        passages: [{ passageId: "passage-1", text: sourceText }],
      }],
      preliminaryClass: "adjacent" as const,
      exclusionConcerns: [],
      retrievalGaps: [],
    }],
    retrievalGaps: [],
  };
}

function proposal(span = "video games distribution", rankingAdjustment = 2) {
  return {
    profileAdditions: {},
    candidateReviews: [{
      candidateId: "candidate-1",
      proposedClass: "direct" as const,
      industryBridge: "The official source names video games distribution.",
      profileTermsUsed: ["video games"],
      sourceIdsUsed: ["source-1"],
      sourceSpansUsed: [{ sourceId: "source-1", text: span }],
      sampleConnection: "The source addresses firms in the target industry.",
      outcomePathway: "Storefront rules may alter distribution operations.",
      mainMismatchOrUncertainty: "Exposure timing remains for fixed validation.",
      needsFollowUpRetrieval: false,
      rankingAdjustment,
    }],
    followUpQueries: [],
    officialSourceLeads: [officialSourceLead],
    conciseRationale: "The bridge is anchored in one exact official span.",
    hostModel: "host_model_not_exposed" as const,
  };
}

function task() {
  const boundedFacts = facts();
  return createHostReasoningTask({
    taskId: "task-1",
    taskType: "screen02-search-review",
    screen: "screen-02",
    runId: "run-1",
    candidateId: null,
    candidatePoolId: "pool-1",
    selectedEventId: null,
    claimGroupId: null,
    scopeFingerprint: profile().scopeFingerprint,
    candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
    eventFingerprint: null,
    sourcePoolFingerprint: fingerprintHostReasoningValue(["source-1"]),
    inputFingerprint: fingerprintHostReasoningValue(boundedFacts),
    promptVersion: "prompt-v1",
    workflowVersion: "workflow-v1",
    requiredSubmissionSchemaVersion: "screen02-search-review-submission-v1",
    createdAt: at,
    expiresAt: "2026-09-03T12:05:00.000Z",
    retryCount: 0,
    appVersion: "0.4.4",
    uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
    hostModel: "host_model_not_exposed",
  });
}

describe("host reasoning task policy adapters", () => {
  it("uses the strict Screen 2 pool contract and cannot create eligibility", async () => {
    const applyValidated = vi.fn();
    const policy = createScreen02SearchReviewPolicy({
      loadCurrent: () => ({
        runId: "run-1",
        candidatePoolId: "pool-1",
        candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
        scopeFingerprint: profile().scopeFingerprint,
        profile: profile(),
        candidates: [{
          candidateId: "candidate-1",
          sources: [{ sourceId: "source-1", active: true, text: sourceText }],
        }],
        rankings: [{
          candidateId: "candidate-1",
          classification: "mismatch",
          eligible: false,
          baseScore: 40,
        }],
      }),
      applyValidated,
    });
    const value = task();
    const submissionFingerprint = fingerprintHostReasoningValue("submission");
    const validated = await policy.validate({
      task: value,
      boundedFacts: facts(),
      proposal: proposal(),
      allowedSourceIds: ["source-1"],
      proposedSourceIdsReferenced: ["source-1"],
      submissionFingerprint,
      observedAt: "2026-09-03T12:00:02.000Z",
    });
    expect(validated.outcome).toBe("accepted");
    if (validated.outcome !== "accepted") return;
    expect(validated.normalizedProposal).toMatchObject({
      nonCanonical: true,
      review: {
        officialSourceLeads: [officialSourceLead],
      },
      rankings: [{
        candidateId: "candidate-1",
        eligibilityUnchanged: true,
        rankingAdjustment: 0,
        totalScore: 40,
      }],
    });

    await policy.apply?.({
      task: value,
      boundedFacts: facts(),
      normalizedProposal: validated.normalizedProposal,
      sourceIdsReferenced: validated.sourceIdsReferenced,
      resultId: "result-1",
      submissionFingerprint,
      observedAt: "2026-09-03T12:00:02.000Z",
    });
    expect(applyValidated).toHaveBeenCalledOnce();
  });

  it("rejects a normalization-only Screen 2 source span and out-of-bound ranking", async () => {
    const policy = createScreen02SearchReviewPolicy({
      loadCurrent: () => ({
        runId: "run-1",
        candidatePoolId: "pool-1",
        candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
        scopeFingerprint: profile().scopeFingerprint,
        profile: profile(),
        candidates: [{
          candidateId: "candidate-1",
          sources: [{ sourceId: "source-1", active: true, text: sourceText }],
        }],
        rankings: [{
          candidateId: "candidate-1",
          classification: "adjacent",
          eligible: true,
          baseScore: 50,
        }],
      }),
      applyValidated: () => undefined,
    });
    const common = {
      task: task(),
      boundedFacts: facts(),
      allowedSourceIds: ["source-1"],
      proposedSourceIdsReferenced: ["source-1"],
      submissionFingerprint: fingerprintHostReasoningValue("submission"),
      observedAt: "2026-09-03T12:00:02.000Z",
    };
    await expect(policy.validate({
      ...common,
      proposal: proposal("VIDEO GAMES DISTRIBUTION"),
    })).resolves.toMatchObject({ outcome: "rejected" });
    await expect(policy.validate({
      ...common,
      proposal: proposal("video games distribution", 4),
    })).resolves.toMatchObject({ outcome: "rejected" });
  });

  it("rejects Screen 2 source leads with a wrong candidate or unsafe URL authority", async () => {
    const policy = createScreen02SearchReviewPolicy({
      loadCurrent: () => ({
        runId: "run-1",
        candidatePoolId: "pool-1",
        candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
        scopeFingerprint: profile().scopeFingerprint,
        profile: profile(),
        candidates: [{
          candidateId: "candidate-1",
          sources: [{ sourceId: "source-1", active: true, text: sourceText }],
        }],
        rankings: [{
          candidateId: "candidate-1",
          classification: "adjacent",
          eligible: true,
          baseScore: 50,
        }],
      }),
      applyValidated: () => undefined,
    });
    const common = {
      task: task(),
      boundedFacts: facts(),
      allowedSourceIds: ["source-1"],
      proposedSourceIdsReferenced: ["source-1"],
      submissionFingerprint: fingerprintHostReasoningValue("submission"),
      observedAt: "2026-09-03T12:00:02.000Z",
    };
    await expect(policy.validate({
      ...common,
      proposal: {
        ...proposal(),
        officialSourceLeads: [{
          ...officialSourceLead,
          candidateIdIfKnown: "candidate-not-in-frozen-pool",
        }],
      },
    })).resolves.toMatchObject({ outcome: "rejected" });

    for (const url of [
      "https://reader:secret@legislature.example/statute",
      "https://legislature.example:8443/statute",
    ]) {
      await expect(policy.validate({
        ...common,
        proposal: {
          ...proposal(),
          officialSourceLeads: [{ ...officialSourceLead, url }],
        },
      })).resolves.toMatchObject({ outcome: "rejected" });
    }
  });

  it("derives offsets only for one unique byte-for-byte Screen 3 quote", () => {
    expect(uniqueExactScreen03QuoteOffsets(
      "A unique official passage appears here.",
      "official passage",
    )).toEqual({ start: 9, end: 25 });
    expect(uniqueExactScreen03QuoteOffsets(
      "The rule applies. The rule applies.",
      "The rule applies.",
    )).toBeNull();
    expect(uniqueExactScreen03QuoteOffsets(
      "The Rule applies.",
      "the rule applies.",
    )).toBeNull();
  });
});
