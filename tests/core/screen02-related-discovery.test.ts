import { describe, expect, it } from "vitest";
import {
  SCREEN_02_FIND_RELATED_DISCOVERY_LINK_COUNT,
  buildScreen02FindModelContext,
  deriveScreen02FindRelatedDiscoveryLinks,
  deriveScreen02FindComparison,
  fingerprintScreen02FindRelatedDiscoveryLink,
} from "../../src/core/screen02-find-workflow";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  prepareScreen02AssessmentRequest,
  requireScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  screen02FindAssessmentPartIds,
  screen02FindRelatedDiscoveryProviders,
} from "../../src/core/screen02-workflow-types";
import {
  buildFindFactsState,
  buildReadyFindState,
} from "./screen02-workflow-fixtures";

describe("Screen 2 Find related discovery links", () => {
  it("derives three unique, bounded HTTPS searches from immutable event identity", () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);

    expect(links).toHaveLength(
      SCREEN_02_FIND_RELATED_DISCOVERY_LINK_COUNT,
    );
    expect(links.map((link) => link.provider)).toEqual([
      ...screen02FindRelatedDiscoveryProviders,
    ]);
    expect(new Set(links.map((link) => link.locator)).size).toBe(3);

    for (const link of links) {
      const locator = new URL(link.locator);
      expect(locator.protocol).toBe("https:");
      expect(locator.username).toBe("");
      expect(locator.password).toBe("");
      expect(link.kind).toBe("related-search");
      expect(link.title).not.toContain("not evidence");
      expect(link.title.length).toBeLessThanOrEqual(260);
      expect(link.locator.length).toBeLessThanOrEqual(1_000);
      expect(link.linkFingerprint).toBe(
        fingerprintScreen02FindRelatedDiscoveryLink(link),
      );
      const query =
        locator.searchParams.get("q") ??
        locator.searchParams.get("search") ??
        "";
      expect(query).toContain(candidate.identity.canonicalTitle);
      expect(query).toContain(candidate.identity.formalIdentifier);
    }
  });

  it("keeps navigation searches outside canonical state and evidence sources", () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);
    const stateJson = JSON.stringify(state);

    expect(Object.hasOwn(state, "relatedDiscoveryLinks")).toBe(false);
    expect(candidate.sourceIds).toEqual(["gdpr-official"]);
    expect(state.sources).toHaveLength(1);
    for (const link of links) {
      expect(stateJson).not.toContain(link.locator);
      expect(stateJson).not.toContain(link.relatedLinkId);
      expect(candidate.sourceIds).not.toContain(link.relatedLinkId);
    }
  });

  it("keeps the combined navigation links out of assessment, ranking, and handoff data", () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);
    const prepared = requireScreen02FindState(
      prepareScreen02AssessmentRequest(state, {
        jobId: "related-search-security-job",
        requestId: "related-search-security-request",
        mode: "find-candidate",
        candidateSnapshotId: candidate.candidateSnapshotId,
        attempt: 1,
        requestedPartIds: [...screen02FindAssessmentPartIds],
        at: "2026-08-09T18:00:02.000Z",
      }),
    );
    const assessmentContext = JSON.stringify(
      buildScreen02FindModelContext(prepared),
    );
    const comparison = JSON.stringify(deriveScreen02FindComparison(state));
    const handoff = JSON.stringify(
      buildScreen02WorkflowHandoff(
        buildReadyFindState(),
        "0.2.29",
        "2026-08-09T18:00:10.000Z",
      ),
    );

    for (const link of links) {
      for (const protectedData of [assessmentContext, comparison, handoff]) {
        expect(protectedData).not.toContain(link.relatedLinkId);
        expect(protectedData).not.toContain(link.locator);
      }
    }
  });

  it("bounds unusually long identity text without inventing a destination URL", () => {
    const candidate = structuredClone(buildFindFactsState().candidates[0]!);
    candidate.identity.canonicalTitle = `Policy ${"x".repeat(2_000)}`;
    candidate.identity.formalIdentifier = `ID-${"9".repeat(1_000)}`;

    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);

    expect(links).toHaveLength(3);
    expect(links.every((link) => link.locator.length <= 1_000)).toBe(true);
    expect(
      links.every((link) =>
        [
          "www.google.com",
          "scholar.google.com",
          "en.wikipedia.org",
        ].includes(new URL(link.locator).hostname),
      ),
    ).toBe(true);
  });

  it("strips display-direction controls and preserves whole Unicode code points", () => {
    const candidate = structuredClone(buildFindFactsState().candidates[0]!);
    candidate.identity.canonicalTitle = `Policy \u202eevil.example\u202c ${"😀".repeat(240)}`;
    candidate.identity.formalIdentifier = "REG\r\n999";

    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);

    for (const link of links) {
      expect(link.title).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/u);
      expect(link.locator).not.toContain("%EF%BF%BD");
      expect(new URL(link.locator).hostname).toMatch(
        /^(?:www\.google\.com|scholar\.google\.com|en\.wikipedia\.org)$/u,
      );
    }
  });

  it("keeps astral Unicode in both identity fields within the URL budget", () => {
    const candidate = structuredClone(buildFindFactsState().candidates[0]!);
    candidate.identity.canonicalTitle = "😀".repeat(500);
    candidate.identity.formalIdentifier = "🛰️".repeat(500);

    const links = deriveScreen02FindRelatedDiscoveryLinks(candidate);

    expect(links).toHaveLength(3);
    expect(links.every((link) => link.locator.length <= 1_000)).toBe(true);
    expect(links.every((link) => !link.locator.includes("%EF%BF%BD"))).toBe(
      true,
    );
  });
});
