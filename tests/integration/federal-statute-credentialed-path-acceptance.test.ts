import { describe, expect, it, vi } from "vitest";

import {
  applyIdentityResolution,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  openScreen2,
} from "../../src/core/six-screen/workflow";
import {
  POLICY_EVIDENCE_REQUIREMENT_KINDS,
} from "../../src/core/six-screen/policy-evidence-plan";
import { createPolicyBriefing } from
  "../../src/core/six-screen/policy-review";
import {
  discoverGovInfoPublicLaws,
  SCREEN_01_GOVINFO_SEARCH_URL,
} from "../../src/worker/screen01-govinfo-statute-discovery";
import { acquireScreen02OfficialDocumentPolicy } from
  "../../src/worker/screen02-official-document-acquisition";

const retrievedAt = "2026-09-17T15:00:00.000Z";

const cases = [
  {
    id: "adaaa",
    title: "ADA Amendments Act of 2008",
    packageId: "PLAW-110publ325",
    congress: 110,
    lawNumber: 325,
    billType: "s",
    billNumber: 3406,
    date: "2008-09-25",
    evidence:
      "SEC. 4. The definition of disability shall be construed in favor of broad coverage of individuals under this Act. The term disability means a physical or mental impairment that substantially limits one or more major life activities. The regarded-as provision shall not apply to impairments that are transitory and minor. SEC. 8. This Act and the amendments made by this Act become effective on January 1, 2009.",
    predicates: [
      "operative_change", "coverage_condition", "exemption_rule",
      "legal_effect_date",
    ],
  },
  {
    id: "tobacco",
    title: "Family Smoking Prevention and Tobacco Control Act",
    packageId: "PLAW-111publ31",
    congress: 111,
    lawNumber: 31,
    billType: "hr",
    billNumber: 1256,
    date: "2009-06-22",
    evidence:
      "SEC. 201. Each tobacco product manufacturer shall cause every cigarette package and advertisement to bear one of the required warnings. This title applies to each tobacco product manufacturer that distributes tobacco products in the United States. Compliance for manufacturers with 350 or more employees begins June 22, 2010, and compliance for manufacturers with fewer than 350 employees begins June 22, 2011. SEC. 103. The Secretary may assess a civil monetary penalty for a violation of this title.",
    predicates: [
      "operative_change", "coverage_condition", "threshold_condition",
      "implementation_schedule", "enforcement_authority", "penalty",
    ],
  },
  {
    id: "dtsa",
    title: "Defend Trade Secrets Act of 2016",
    packageId: "PLAW-114publ153",
    congress: 114,
    lawNumber: 153,
    billType: "s",
    billNumber: 1890,
    date: "2016-05-11",
    evidence:
      "SEC. 2. This Act applies to any misappropriation of a trade secret related to a product or service used in, or intended for use in, interstate or foreign commerce. An employer shall provide notice of the immunity established by this Act in any contract governing trade secrets. A court may grant an injunction and award damages for actual loss. If the trade secret is willfully and maliciously misappropriated, the court may award exemplary damages in an amount not more than 2 times the damages awarded. Effective Date.--The amendments made by this section shall apply with respect to any misappropriation as [[Page 130 STAT. 382]] amended by this section for which any act occurs on or after the date of the enactment of this Act. Approved May 11, 2016.",
    predicates: [
      "coverage_condition", "operative_change", "remedy", "penalty",
      "legal_effect_date",
    ],
  },
] as const;

function workflow(title: string, id: string) {
  return createSixScreenWorkflow({
    runId: `federal-statute-path-${id}`,
    studyId: `federal-statute-study-${id}`,
    study: {
      population: "Organizations",
      analysisUnit: "Organization",
      geography: ["United States"],
      industry: [],
      period: { start: "2000", end: "2026" },
      outcome: "Compliance",
      intendedConstruct: null,
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: title,
    requestedJurisdiction: "United States",
    intendedEpisode: "enactment",
    createdAt: retrievedAt,
  });
}

function officialHtml(input: typeof cases[number]) {
  return `<!doctype html><html><body><main>
    <p>Public Law ${input.congress}-${input.lawNumber}</p>
    <p>This Act may be cited as the “${input.title}”.</p>
    <p>${input.evidence}</p>
    <p>The retained official representation is inspected provision by provision; identity alone is not the policy briefing.</p>
  </main></body></html>`;
}

function providerFetch(input: typeof cases[number]) {
  const congressText =
    `https://www.congress.gov/${input.congress}/plaws/publ${input.lawNumber}/PLAW-${input.congress}publ${input.lawNumber}.htm`;
  return vi.fn(async (request: RequestInfo | URL) => {
    const url = String(request);
    if (url === SCREEN_01_GOVINFO_SEARCH_URL) {
      return new Response(JSON.stringify({ results: [{
        collectionCode: "PLAW",
        title: input.title,
        packageId: input.packageId,
        dateIssued: input.date,
        resultLink:
          `https://api.govinfo.gov/packages/${input.packageId}/summary`,
        governmentAuthor: ["United States Congress"],
      }] }), { headers: { "content-type": "application/json" } });
    }
    if (url.includes(`/v3/law/${input.congress}/pub/${input.lawNumber}`)) {
      return new Response(JSON.stringify({ bill: {
        congress: input.congress,
        type: input.billType.toUpperCase(),
        number: String(input.billNumber),
        title: input.title,
        laws: [{ type: "Public Law", number: String(input.lawNumber) }],
      } }), { headers: { "content-type": "application/json" } });
    }
    if (url.includes(
      `/v3/bill/${input.congress}/${input.billType}/${input.billNumber}/text`,
    )) {
      return new Response(JSON.stringify({ textVersions: [{
        type: "Enrolled Bill",
        formats: [{ type: "Formatted Text", url: congressText }],
      }] }), { headers: { "content-type": "application/json" } });
    }
    if (
      url === congressText ||
      url.includes(`/content/pkg/${input.packageId}/html/${input.packageId}.htm`)
    ) {
      return new Response(officialHtml(input), {
        headers: { "content-type": "text/html" },
      });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  });
}

describe("credential-aware uncataloged federal-statute acceptance", () => {
  it.each(cases)(
    "$title completes name search, native identity, confirmation, and substantive Screen 2 reconstruction",
    async (policy) => {
      const fetch = providerFetch(policy);
      let state = workflow(policy.title, policy.id);
      const begun = beginIdentityResolution(state, {
        expectedRevision: state.revision,
        requestId: `identity-request-${policy.id}`,
        requestedAt: "2026-09-17T15:00:01.000Z",
      });
      const resolution = await discoverGovInfoPublicLaws({
        workflow: begun.state,
        fetch,
        retrievedAt: "2026-09-17T15:00:02.000Z",
        apiKey: "govinfo-fixture-secret",
        congressApiKey: "congress-fixture-secret",
      });
      expect(resolution.status).toBe("resolved");
      expect(resolution.candidates).toHaveLength(1);
      expect(resolution.candidates[0]!.identitySources.map(({ routeId }) =>
        routeId)).toEqual([
          "govinfo_public_law",
          "congress_public_law_bill_text",
        ]);
      expect(resolution.candidates[0]!.formalIdentifiers).toEqual(
        expect.arrayContaining([
          policy.packageId,
          `Public Law ${policy.congress}-${policy.lawNumber}`,
          `${policy.billType.toUpperCase()} ${policy.billNumber} (${policy.congress}th Congress)`,
        ]),
      );

      state = applyIdentityResolution(begun.state, {
        expectedRevision: begun.state.revision,
        request: begun.request,
        candidates: resolution.candidates,
        resolution: {
          taskId: null,
          status: "resolved",
          attemptedSources: resolution.attemptedSources,
          unresolved: [],
          limitation: resolution.limitation,
        },
        appliedAt: "2026-09-17T15:00:03.000Z",
      });
      const candidate = state.candidates[0]!;
      state = confirmDisplayedShock(state, {
        expectedRevision: state.revision,
        candidateId: candidate.id,
        displayedIdentityFingerprint: candidate.identityFingerprint,
        sourceSnapshotId: candidate.sourceSnapshotId,
        sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
        originalRequestFingerprint: state.originalRequestFingerprint,
        currentRequestFingerprint: state.currentRequestFingerprint,
        identityRevision: state.identityRevision,
        interactionId: `identity-confirm-${policy.id}`,
        decisionId: `identity-decision-${policy.id}`,
        actor: "researcher_ui",
        confirmedAt: "2026-09-17T15:00:04.000Z",
      });
      state = openScreen2(state, {
        expectedRevision: state.revision,
        openedAt: "2026-09-17T15:00:05.000Z",
      }).state;
      expect(state.confirmedShock?.confirmation.actor).toBe("researcher");

      const acquisition = await acquireScreen02OfficialDocumentPolicy({
        workflow: state,
        fetch,
        retrievedAt: "2026-09-17T15:00:06.000Z",
        focus: "controlling_document",
        searchedRequirementKinds: POLICY_EVIDENCE_REQUIREMENT_KINDS,
      });
      expect(acquisition.parsed).not.toBeNull();
      const predicates = acquisition.parsed!.projections.map(({ predicate }) =>
        predicate);
      for (const predicate of policy.predicates) {
        expect(predicates, `${policy.id}: missing ${predicate}`).toContain(predicate);
      }
      expect(acquisition.parsed!.projections.every(({ citation }) =>
        citation.canonicalUrl.startsWith("https://") &&
        citation.exactText.length > 0)).toBe(true);
      const briefing = createPolicyBriefing({
        title: policy.title,
        claims: acquisition.parsed!.projections,
        requirements: acquisition.parsed!.collection.requirements,
        generatedAt: "2026-09-17T15:00:07.000Z",
      });
      expect(briefing.overview).toContain(policy.title);
      expect(briefing.whatChanged.claimIds.length).toBeGreaterThan(0);
      expect(briefing.coverage.claimIds.length).toBeGreaterThan(0);
      expect(briefing.unresolvedQuestions.length).toBeGreaterThan(0);
    },
  );
});
