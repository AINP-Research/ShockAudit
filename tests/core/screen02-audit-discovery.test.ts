import { describe, expect, it } from "vitest";

import {
  applyResearcherSourceScreen02AuditDiscovery,
  applyReviewedScreen02AuditDiscovery,
  buildReviewedScreen02AuditDiscovery,
  reviewedScreen02AuditOfficialIdentityFields,
} from "../../src/core/screen02-audit-discovery";
import {
  attachScreen02AuditResearcherSource,
  reviseScreen02AuditAnchor,
} from "../../src/core/screen02-audit-workflow";
import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import { createScreen02AuditState } from "../../src/core/screen02-workflow-state";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decisionKeys } from "../../src/core/scope-types";
import { fixtureAt } from "./screen02-workflow-fixtures";

function auditContext(knownShock: string, studySentence?: string) {
  const sentence =
    studySentence ??
    "Audit whether a privacy regulation affected innovation among U.S. firms from 2015 to 2023.";
  const result = confirmScopeContract({
    ...createInitialState("audit"),
    revision: 9,
    sentence,
    contractSourceSentence: sentence,
    knownShock,
    scope: {
      population: "U.S. firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "All industries",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) {
    throw new Error(
      `${result.error} ${result.ambiguities.map((item) => `${item.key}:${item.title}`).join(" | ")}`,
    );
  }
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

describe("v2.1 Audit anchor-led discovery", () => {
  it("preserves the original CCPA wording and keeps identity/version records distinct", () => {
    const opened = createScreen02AuditState(
      auditContext("CCPA"),
      "audit-discovery-ccpa",
      fixtureAt,
    );
    const round = buildReviewedScreen02AuditDiscovery(opened, {
      matchSetSnapshotId: "ccpa-reviewed-set-1",
      at: "2026-08-09T18:00:01.000Z",
    });
    const state = applyReviewedScreen02AuditDiscovery(opened, {
      matchSetSnapshotId: "ccpa-reviewed-set-1",
      at: "2026-08-09T18:00:01.000Z",
    });

    expect(state.anchor.originalWording).toBe("CCPA");
    expect(round.matches.map((match) => match.relationship)).toEqual([
      "supported-alias",
      "amendment",
      "implementing-rule",
      "enforcement-action",
    ]);
    expect(
      state.possibleMatches.map((match) => [
        match.identity.canonicalTitle,
        match.sourceIds,
      ]),
    ).toEqual([
      [
        "California Consumer Privacy Act of 2018",
        [
          "reviewed:ccpa-statute-ab375",
          "reviewed:ccpa-initiative-circulation-17-0039",
          "reviewed:ccpa-oag-overview",
          "reviewed:ccpa-oag-implementation",
          "reviewed:ccpa-regulations",
        ],
      ],
      [
        "California Privacy Rights Act of 2020",
        ["reviewed:cpra-proposition-24"],
      ],
      [
        "California Consumer Privacy Act Regulations",
        ["reviewed:ccpa-regulations"],
      ],
      [
        "People v. Sephora USA, Inc. CCPA settlement",
        ["reviewed:ccpa-enforcement-sephora"],
      ],
    ]);
    expect(state.matchSets.at(-1)?.manifest.exclusions).toEqual([]);
    expect(state.matchSets.at(-1)?.manifest.outcomeValuesInspected).toBe(false);
    expect(
      round.sources.find(
        (source) =>
          source.id === "reviewed:ccpa-initiative-circulation-17-0039",
      ),
    ).toMatchObject({
      locator:
        "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
      publisher: "California Secretary of State",
      authorityTier: 1,
      channel: "official-ballot-initiative-announcement",
      publishedDate: "2017-12-18",
      evidenceText: expect.stringMatching(
        /precursor.+not the introduction date of AB 375/i,
      ),
    });
    expect(
      round.sources.find(
        (source) => source.id === "reviewed:ccpa-statute-ab375",
      )?.evidenceText,
    ).toContain("operative January 1, 2020");
    const controllingSource = round.sources.find(
      (source) => source.id === "reviewed:ccpa-statute-ab375",
    )!;
    expect(
      reviewedScreen02AuditOfficialIdentityFields(controllingSource),
    ).toEqual([{
      field: "canonical-title",
      value: "California Consumer Privacy Act of 2018",
    }]);
    expect(reviewedScreen02AuditOfficialIdentityFields({
      ...controllingSource,
      locator: `${controllingSource.locator}#altered`,
    })).toEqual([]);
    expect(
      round.sources.find(
        (source) => source.id === "reviewed:ccpa-oag-overview",
      )?.evidenceText,
    ).toContain("historical rule");
    expect(
      round.sources.find(
        (source) => source.id === "reviewed:ccpa-oag-implementation",
      ),
    ).toMatchObject({
      locator:
        "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
      publisher: "California Department of Justice",
      authorityTier: 2,
      channel: "official-regulator-press-release",
      publishedDate: "2020-06-02",
    });
    expect(
      round.sources.find(
        (source) => source.id === "reviewed:ccpa-regulations",
      )?.evidenceText,
    ).toContain("August 14, 2020");
  });

  it.each([
    {
      anchor: "CCPA original",
      title: "California Consumer Privacy Act of 2018",
      relationship: "supported-alias",
      sourceId: "reviewed:ccpa-statute-ab375",
    },
    {
      anchor: "CPRA",
      title: "California Privacy Rights Act of 2020",
      relationship: "supported-alias",
      sourceId: "reviewed:cpra-proposition-24",
    },
    {
      anchor: "CCPA implementing regulations",
      title: "California Consumer Privacy Act Regulations",
      relationship: "supported-alias",
      sourceId: "reviewed:ccpa-regulations",
    },
    {
      anchor: "Attorney General Bonta Announces Settlement with Sephora",
      title: "People v. Sephora USA, Inc. CCPA settlement",
      relationship: "supported-alias",
      sourceId: "reviewed:ccpa-enforcement-sephora",
    },
    {
      anchor: "GDPR",
      title: "General Data Protection Regulation",
      relationship: "supported-alias",
      sourceId: "reviewed:gdpr-regulation-2016-679",
    },
    {
      anchor: "EU Digital Markets Act",
      title:
        "Regulation (EU) 2022/1925 of the European Parliament and of the Council on contestable and fair markets in the digital sector (Digital Markets Act)",
      relationship: "supported-alias",
      sourceId: "reviewed:dma-regulation-2022-1925",
    },
  ])(
    "resolves the direct $anchor anchor to its own reviewed version record",
    ({ anchor, title, relationship, sourceId }) => {
      const opened = createScreen02AuditState(
        auditContext(anchor),
        `audit-discovery-${anchor.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        fixtureAt,
      );
      const round = buildReviewedScreen02AuditDiscovery(opened, {
        matchSetSnapshotId: `direct-${sourceId}`,
        at: "2026-08-09T18:00:01.000Z",
      });

      expect(round.matches[0]).toMatchObject({
        identity: { canonicalTitle: title },
        relationship,
        sourceIds: expect.arrayContaining([sourceId]),
      });
    },
  );

  it("uses structured version, year, clarification, and official locator fields to order an ambiguous family anchor", () => {
    const opened = createScreen02AuditState(
      auditContext("CCPA"),
      "audit-discovery-structured-cpra",
      fixtureAt,
    );
    const revised = reviseScreen02AuditAnchor(opened, {
      anchorRevisionId: "structured-cpra-anchor-v2",
      successorMatchSetSnapshotId: "structured-cpra-pending-set",
      decisionId: "structured-cpra-revision-decision",
      fields: {
        approximateYear: "2020",
        versionType: "amendment",
        jurisdiction: "California, United States",
        issuingAuthority: "California electorate",
        distinguishingFeature: "Proposition 24 ballot amendment",
        sourceLocator:
          "https://vig.cdn.sos.ca.gov/2020/general/pdf/topl-prop24.pdf",
        clarification: "The intended version is CPRA, not the 2018 original.",
      },
      at: "2026-08-09T18:00:01.000Z",
      reason: "The researcher clarified the intended CCPA-family version.",
    });
    const round = buildReviewedScreen02AuditDiscovery(revised, {
      matchSetSnapshotId: "structured-cpra-reviewed-set",
      at: "2026-08-09T18:00:02.000Z",
    });

    expect(round.matches[0]).toMatchObject({
      identity: { canonicalTitle: "California Privacy Rights Act of 2020" },
      relationship: "exact",
      sourceIds: ["reviewed:cpra-proposition-24"],
    });
    expect(round.matches[1]).toMatchObject({
      identity: { canonicalTitle: "California Consumer Privacy Act of 2018" },
      relationship: "supported-alias",
      sourceIds: expect.arrayContaining(["reviewed:ccpa-statute-ab375"]),
    });
  });

  it("matches GDPR for a U.S. study without geography or period hard exclusion", () => {
    const sentence =
      "Audit whether GDPR affected innovation among U.S. firms from 2015 to 2023.";
    const opened = createScreen02AuditState(
      auditContext("GDPR", sentence),
      "audit-discovery-gdpr",
      fixtureAt,
    );
    const state = applyReviewedScreen02AuditDiscovery(opened, {
      matchSetSnapshotId: "gdpr-reviewed-set-1",
      at: "2026-08-09T18:00:01.000Z",
    });

    expect(state.screen01Baseline.scopeContract.geography).toBe("United States");
    expect(state.possibleMatches).toHaveLength(1);
    expect(state.possibleMatches[0].identity.canonicalTitle).toBe(
      "General Data Protection Regulation",
    );
    expect(state.possibleMatches[0].relationship).toBe("supported-alias");
    expect(state.possibleMatches[0].sourceIds).toEqual([
      "reviewed:gdpr-regulation-2016-679",
      "reviewed:gdpr-commission-legal-framework",
    ]);
    expect(state.matchSets.at(-1)?.manifest.exclusions).toEqual([]);
    const controllingSource = state.sources.find(
      (source) => source.id === "reviewed:gdpr-regulation-2016-679",
    )!;
    expect(
      reviewedScreen02AuditOfficialIdentityFields(controllingSource),
    ).toEqual([
      {
        field: "canonical-title",
        value: "General Data Protection Regulation",
      },
      {
        field: "formal-identifier",
        value: "Regulation (EU) 2016/679",
      },
    ]);
    expect(reviewedScreen02AuditOfficialIdentityFields({
      ...controllingSource,
      title: "Altered source title",
    })).toEqual([]);
  });

  it("keeps the DMA distinct from GDPR and carries its first-party overview", () => {
    const opened = createScreen02AuditState(
      auditContext("EU Digital Markets Act"),
      "audit-discovery-dma",
      fixtureAt,
    );
    const round = buildReviewedScreen02AuditDiscovery(opened, {
      matchSetSnapshotId: "dma-reviewed-set-1",
      at: "2026-09-11T14:00:00.000Z",
    });

    expect(round.matches).toHaveLength(1);
    expect(round.matches[0]).toMatchObject({
      identity: {
        canonicalTitle:
          "Regulation (EU) 2022/1925 of the European Parliament and of the Council on contestable and fair markets in the digital sector (Digital Markets Act)",
        formalIdentifier: "Regulation (EU) 2022/1925",
      },
      relationship: "supported-alias",
      sourceIds: [
        "reviewed:dma-regulation-2022-1925",
        "reviewed:dma-commission-overview",
      ],
    });
    expect(round.sources.at(-1)).toMatchObject({
      locator: "https://digital-markets-act.ec.europa.eu/about-dma_en",
      publisher: "European Commission",
      authorityTier: 2,
      channel: "official-guidance",
    });
  });

  it("supports an acronym outside the fixed catalog through an attached researcher source", () => {
    const opened = createScreen02AuditState(
      auditContext(
        "XYZRA",
        "Audit whether the XYZRA regulation affected innovation among U.S. firms from 2015 to 2023.",
      ),
      "audit-discovery-researcher",
      fixtureAt,
    );
    const sourced = attachScreen02AuditResearcherSource(opened, {
      source: {
        id: "researcher:xyzra-source",
        title: "Official XYZRA act text supplied by researcher",
        locator: "https://example.test/xyzra",
        publisher: "Researcher-supplied official locator",
        publishedDate: "2024-01-01",
        authorityTier: 6,
        channel: "researcher-provided",
        retrievedAt: "2026-08-09T18:00:01.000Z",
      },
      anchorRevisionId: "xyzra-anchor-v2",
      successorMatchSetSnapshotId: "xyzra-pending-set",
      decisionId: "xyzra-source-decision",
      clarification: "XYZRA expands to the Example Zero-Disclosure Rights Act.",
      at: "2026-08-09T18:00:01.000Z",
      reason: "Researcher supplied the exact official act locator.",
    });
    const state = applyResearcherSourceScreen02AuditDiscovery(sourced, {
      matchSetSnapshotId: "xyzra-source-set",
      matchId: "xyzra-match",
      matchSnapshotId: "xyzra-match-v1",
      identitySnapshotId: "xyzra-identity-v1",
      identity: {
        canonicalTitle: "Example Zero-Disclosure Rights Act",
        commonNames: ["XYZRA"],
        formalIdentifier: "Act 2024-17",
        issuer: "Example Legislature",
        issuingJurisdiction: "Example Jurisdiction",
        eventType: "statute",
        status: "enacted",
      },
      relationshipReason:
        "The attached researcher source supports XYZRA as the act's common acronym.",
      at: "2026-08-09T18:00:02.000Z",
    });

    expect(state.anchor.originalWording).toBe("XYZRA");
    expect(state.anchor.revisions).toHaveLength(2);
    expect(state.possibleMatches.at(-1)?.relationship).toBe("supported-alias");
    expect(state.sources.at(-1)?.authorityTier).toBe(6);
    expect(state.sources.at(-1)?.userProvided).toBe(true);
  });
});
