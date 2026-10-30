import { describe, expect, it } from "vitest";

import {
  beginScreen02FindDiscovery,
  openScreen02FindCandidate,
  screen02FindRelevanceProfile,
  updateScreen02FindRelevanceProfile,
} from "../../src/core/screen02-find-workflow";
import { screen02FindPriorCandidateMatch } from "../../src/core/screen02-find-discovery";
import {
  createScreen02FindState,
  requireScreen02FindState,
  restoreScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  buildFindFactsState,
  buildReadyFindState,
  cloneFixture,
  confirmedWorkflowFindContext,
  fixtureAt,
} from "./screen02-workflow-fixtures";

describe("Screen 2 canonical relevance-profile state", () => {
  it("persists the deterministic profile while retaining old profile-less states", () => {
    const state = createScreen02FindState(
      confirmedWorkflowFindContext("Semiconductor fabrication"),
      "profile-state-run",
      fixtureAt,
    );

    expect(state.relevanceProfile).toMatchObject({
      scopeFingerprint: state.screen01Fingerprint,
      originalIndustryText: "Semiconductor fabrication",
      sampleGeography: "United States",
      studyStartYear: 2016,
      studyEndYear: 2020,
      origin: "fixed-profile",
      createdAt: fixtureAt,
      updatedAt: fixtureAt,
    });

    const compatible = cloneFixture(state);
    delete (compatible as unknown as Record<string, unknown>).relevanceProfile;
    expect(restoreScreen02FindState(compatible)).not.toBeNull();
    expect(screen02FindRelevanceProfile(compatible)).toEqual(
      state.relevanceProfile,
    );
  });

  it("rejects persisted profiles that rewrite confirmed hard scope", () => {
    const state = createScreen02FindState(
      confirmedWorkflowFindContext("Technology"),
      "profile-tamper-run",
      fixtureAt,
    );
    const tamperedIndustry = cloneFixture(state);
    tamperedIndustry.relevanceProfile!.originalIndustryText = "Banking";
    expect(restoreScreen02FindState(tamperedIndustry)).toBeNull();

    const tamperedGeography = cloneFixture(state);
    tamperedGeography.relevanceProfile!.sampleGeography = "European Union";
    expect(restoreScreen02FindState(tamperedGeography)).toBeNull();

    const tamperedEventFamily = cloneFixture(state);
    tamperedEventFamily.relevanceProfile!.eventFamilyTerms = ["natural disaster"];
    expect(restoreScreen02FindState(tamperedEventFamily)).toBeNull();
  });

  it("saves add, remove, and clarification edits without mutating Screen 1", () => {
    const selectedRaw = cloneFixture(buildReadyFindState());
    selectedRaw.decision.history = selectedRaw.decision.history.filter(
      (event) => event.action !== "continued",
    );
    selectedRaw.decision.continuedRevision = null;
    let state = requireScreen02FindState(selectedRaw);
    state = openScreen02FindCandidate(state, {
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      decisionId: "profile-open-candidate",
      at: "2026-08-10T19:40:20.000Z",
    });
    const baselineBefore = cloneFixture(state.screen01Baseline);
    const fingerprintBefore = state.screen01Fingerprint;
    const revisionBefore = state.revision;
    const original = screen02FindRelevanceProfile(state);

    const updated = updateScreen02FindRelevanceProfile(state, {
      expectedProfileUpdatedAt: original.updatedAt,
      edits: {
        canonicalIndustryLabel: "enterprise technology services",
        industryAliases: [
          ...original.industryAliases.filter((term) => term !== "technology"),
          "enterprise software",
        ],
        falseFriends: ["consumer electronics repair"],
      },
      at: "2026-08-10T19:40:21.000Z",
      reason: "Clarify the industry and remove an over-broad alias.",
    });

    expect(updated.revision).toBe(revisionBefore + 1);
    expect(updated.screen01Baseline).toEqual(baselineBefore);
    expect(updated.screen01Fingerprint).toBe(fingerprintBefore);
    expect(updated.relevanceProfile).toMatchObject({
      originalIndustryText: "Technology",
      canonicalIndustryLabel: "enterprise technology services",
      sampleGeography: "United States",
      origin: "researcher-edited",
      updatedAt: "2026-08-10T19:40:21.000Z",
    });
    expect(updated.relevanceProfile!.industryAliases).toContain(
      "enterprise software",
    );
    expect(updated.relevanceProfile!.industryAliases).not.toContain(
      "technology",
    );
    expect(updated.activeCandidateSetSnapshotId).toBeNull();
    expect(updated.candidateSets[0]).toMatchObject({
      status: "stale-profile",
      supersededBySnapshotId: null,
    });
    expect(updated.decision).toMatchObject({
      openedCandidateSnapshotId: null,
      tentativeSelectionSnapshotId: null,
    });
    expect(updated.decision.history.slice(-2).map((event) => event.action)).toEqual([
      "open-cleared",
      "selection-cleared",
    ]);
    const priorCandidate = state.candidates[0]!;
    expect(
      screen02FindPriorCandidateMatch(updated, {
        id: priorCandidate.candidateId,
        title: priorCandidate.identity.canonicalTitle,
      }),
    ).toBeNull();
    expect(requireScreen02FindState(updated)).toEqual(updated);
  });

  it("rejects stale saves, hard-scope edits, edits during retrieval, and sealed runs", () => {
    const base = buildFindFactsState();
    const profile = screen02FindRelevanceProfile(base);
    expect(() =>
      updateScreen02FindRelevanceProfile(base, {
        expectedProfileUpdatedAt: "2026-08-09T17:59:59.000Z",
        edits: { industryAliases: ["technology services"] },
        at: "2026-08-09T18:00:02.000Z",
        reason: "Save a stale editor.",
      }),
    ).toThrow(/changed after this edit was opened/i);
    expect(() =>
      updateScreen02FindRelevanceProfile(base, {
        expectedProfileUpdatedAt: profile.updatedAt,
        edits: {
          sampleGeography: "European Union",
        } as never,
        at: "2026-08-09T18:00:02.000Z",
        reason: "Attempt to rewrite hard scope.",
      }),
    ).toThrow(/fixed by the confirmed Screen 1 scope/i);

    const searching = beginScreen02FindDiscovery(base, {
      discoveryRequestId: "profile-search-in-flight",
      searchRoundId: "profile-search-round",
      candidateSetSnapshotId: "profile-search-set",
      exactRequest: "Find another bounded candidate pool.",
      at: "2026-08-09T18:00:02.000Z",
    });
    expect(() =>
      updateScreen02FindRelevanceProfile(searching, {
        edits: { industryAliases: ["technology services"] },
        at: "2026-08-09T18:00:03.000Z",
        reason: "Do not race active retrieval.",
      }),
    ).toThrow(/discovery is in progress/i);

    expect(() =>
      updateScreen02FindRelevanceProfile(buildFindFactsState(), {
        edits: { eventFamilyTerms: ["natural disaster"] } as never,
        at: "2026-08-09T18:00:02.000Z",
        reason: "Attempt to replace the fixed event family.",
      }),
    ).toThrow(/fixed by the confirmed Screen 1 scope/i);

    expect(() =>
      updateScreen02FindRelevanceProfile(buildReadyFindState(), {
        edits: { industryAliases: ["technology services"] },
        at: "2026-08-10T20:00:00.000Z",
        reason: "Attempt to edit after continuing.",
      }),
    ).toThrow(/sealed/i);
  });
});
