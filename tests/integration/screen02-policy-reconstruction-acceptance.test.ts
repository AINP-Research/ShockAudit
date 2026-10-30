import { describe, expect, it } from "vitest";

import manifestJson from
  "../fixtures/screen02-policy-reconstruction-cases.v0.6.0.json";
import type {
  EvidenceRequirement,
  PolicyReviewClaimProjection,
  TypedDate,
} from "../../src/core/six-screen/contracts";
import { POLICY_EVIDENCE_REQUIREMENT_KINDS } from
  "../../src/core/six-screen/policy-evidence-plan";
import {
  createPolicyBriefing,
  mergePolicyEvidenceCollections,
  parseOfficialDocumentPolicyEvidence,
  projectPolicyEvidenceClaims,
} from "../../src/core/six-screen/policy-review";

type ManifestDocument = {
  sourceId: string;
  provider: string;
  publisher: string;
  issuer: string;
  jurisdiction: string;
  nativeId: string;
  officialLocator: string;
  versionLabel: string;
  acquiredSections: string[];
  evidenceText: string;
};

type ExpectedFact = {
  predicate: PolicyReviewClaimProjection["predicate"];
  contains: string;
  locatorContains: string;
};

type ExpectedDate = {
  kind: TypedDate["kind"];
  start: string;
  affectedContains?: string;
};

type AcceptanceCase = {
  caseId: string;
  policyName: string;
  sourceFamily: string;
  nativeId: string;
  catalogStatus: "present" | "absent";
  cohort: "development" | "verification";
  firstAttempt: string;
  nameOnlyDiscovery: string;
  suppliedSourceIdentification: string;
  federalDiscoveryPath?: string[];
  documents: ManifestDocument[];
  expectedFacts: ExpectedFact[];
  expectedDates: ExpectedDate[];
  expectedRequirementStatuses: Partial<Record<
    EvidenceRequirement["kind"],
    EvidenceRequirement["status"]
  >>;
  knownGaps: string[];
};

const manifest = manifestJson as {
  schemaVersion: string;
  cohortDisclosure: string;
  successRule: string;
  knownBlockers: Array<{ id: string; status: string; detail: string }>;
  cases: AcceptanceCase[];
};
const positiveCases = manifest.cases.filter(({ nameOnlyDiscovery }) =>
  nameOnlyDiscovery !== "blocked_unsupported_route");

function reconstruct(policy: AcceptanceCase) {
  let collection = null as ReturnType<
    typeof parseOfficialDocumentPolicyEvidence
  >["collection"] | null;
  policy.documents.forEach((document, documentIndex) => {
    const parsed = parseOfficialDocumentPolicyEvidence({
      eventId: `acceptance-${policy.caseId}`,
      sourceId: document.sourceId,
      provider: document.provider,
      nativeId: document.nativeId,
      canonicalUrl: document.officialLocator,
      title: policy.policyName,
      publisher: document.publisher,
      issuer: document.issuer,
      jurisdiction: document.jurisdiction,
      publicationDate: null,
      retrievedAt: `2026-09-17T12:00:0${documentIndex}.000Z`,
      contentHash: `sha256:${String(documentIndex + 1).repeat(64)}`,
      retainedText: document.evidenceText,
      representation: "recorded-official-text",
      acquisitionProvenance: "direct",
      inspectedText: "full",
      sourceRole:
        "deterministic CI recording transcribed from the cited official version; not a live request and not independent corroboration",
      documentVersionLabel: document.versionLabel,
    });
    collection = mergePolicyEvidenceCollections({
      previous: collection,
      next: parsed.collection,
      searchedKinds: POLICY_EVIDENCE_REQUIREMENT_KINDS,
    });
  });
  if (!collection) throw new Error(`${policy.caseId} has no evidence documents.`);
  const projections = projectPolicyEvidenceClaims(collection);
  return {
    collection,
    projections,
    briefing: createPolicyBriefing({
      title: policy.policyName,
      claims: projections,
      requirements: collection.requirements,
      generatedAt: "2026-09-17T12:01:00.000Z",
    }),
  };
}

function typedDate(
  projection: PolicyReviewClaimProjection,
): { date: TypedDate; affectedProvisionOrGroup?: string } | null {
  if (!projection.typedValue || typeof projection.typedValue !== "object" ||
      Array.isArray(projection.typedValue)) return null;
  const value = projection.typedValue as {
    date?: TypedDate | null;
    affectedProvisionOrGroup?: string;
  };
  return value.date ? {
    date: value.date,
    affectedProvisionOrGroup: value.affectedProvisionOrGroup,
  } : null;
}

describe("Screen 2 v0.6 content-based cross-policy acceptance", () => {
  it("freezes the required policy-family mix, provenance disclosure, and honest blockers", () => {
    expect(manifest.schemaVersion).toBe(
      "shockaudit-screen2-cross-policy-acceptance-v0.6.0",
    );
    expect(manifest.cohortDisclosure).toMatch(/not independently blinded/iu);
    expect(manifest.successRule).toMatch(/claim count.*insufficient/iu);
    expect(positiveCases).toHaveLength(12);
    expect(new Set(manifest.cases.map(({ policyName }) => policyName)).size)
      .toBe(manifest.cases.length);
    expect(positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "us-federal-statute")).toHaveLength(4);
    const federalStatutes = positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "us-federal-statute");
    expect(federalStatutes.filter(({ catalogStatus }) =>
      catalogStatus === "absent")).toHaveLength(3);
    expect(federalStatutes.every(({ federalDiscoveryPath }) =>
      JSON.stringify(federalDiscoveryPath) === JSON.stringify([
        "user_name_or_alias",
        "govinfo_search",
        "govinfo_public_law_identity",
        "congress_native_bill_identity",
        "inspected_official_text",
        "supported_candidate",
        "explicit_confirmation",
        "substantive_screen2_reconstruction",
      ]))).toBe(true);
    expect(positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "us-federal-administrative")).toHaveLength(2);
    expect(positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "us-state-statute")).toHaveLength(2);
    expect(positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "uk-statute")).toHaveLength(2);
    expect(positiveCases.filter(({ sourceFamily }) =>
      sourceFamily === "eu-directive")).toHaveLength(2);
    expect(positiveCases.filter(({ catalogStatus }) =>
      catalogStatus === "absent").length).toBeGreaterThanOrEqual(6);
    expect(positiveCases.filter(({ cohort }) => cohort === "verification").length)
      .toBeGreaterThanOrEqual(6);
    expect(manifest.cases.find(({ caseId }) =>
      caseId === "sox-2002")?.firstAttempt).toBe(
      "owner_regression_identity_only",
    );
    expect(manifest.cases.find(({ caseId }) =>
      caseId === "ccpa-ab375-2018")?.firstAttempt).toBe(
      "owner_regression_retained_excerpt_only",
    );
    expect(manifest.cases.find(({ caseId }) =>
      caseId === "california-delete-act-state-search-blocker"))
      .toMatchObject({
        catalogStatus: "absent",
        nameOnlyDiscovery: "blocked_unsupported_route",
        firstAttempt: "blocked_unsupported_state_name_search",
      });
    expect(manifest.knownBlockers.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "credentialed-federal-source-live-proof",
        "uncataloged-state-name-search",
        "host-semantic-briefing",
      ]),
    );
  });

  it.each(positiveCases)(
    "$caseId reconstructs the expected source-linked facts rather than passing on identity or counts",
    (policy) => {
      const result = reconstruct(policy);
      expect(result.collection.sources).toHaveLength(policy.documents.length);
      expect(result.collection.sources.every(({ inspectedText, contentHash }) =>
        inspectedText === "full" && /^sha256:[0-9]+$/u.test(contentHash ?? "")))
        .toBe(true);
      for (const expected of policy.expectedFacts) {
        const fact = result.projections.find(({ predicate, citation }) =>
          predicate === expected.predicate &&
          citation.exactText.toLocaleLowerCase("en-US").includes(
            expected.contains.toLocaleLowerCase("en-US"),
          ) && citation.locator.toLocaleLowerCase("en-US").includes(
            expected.locatorContains.toLocaleLowerCase("en-US"),
          ));
        expect(
          fact,
          `${policy.caseId}: ${expected.predicate} / ${expected.contains} / ${expected.locatorContains}`,
        ).toBeDefined();
        expect(fact?.citation.canonicalUrl).toBe(
          policy.documents.find(({ officialLocator }) =>
            officialLocator === fact?.citation.canonicalUrl)?.officialLocator,
        );
        expect(fact?.citation.exactText).toContain(expected.contains);
      }
      for (const expected of policy.expectedDates) {
        const dated = result.projections.map((projection) => ({
          projection,
          value: typedDate(projection),
        })).find(({ value }) =>
          value?.date.kind === expected.kind &&
          value.date.start === expected.start &&
          (!expected.affectedContains ||
            value.affectedProvisionOrGroup?.toLocaleLowerCase("en-US")
              .includes(expected.affectedContains.toLocaleLowerCase("en-US"))));
        expect(
          dated,
          `${policy.caseId}: ${expected.kind} ${expected.start} ${expected.affectedContains ?? ""}`,
        ).toBeDefined();
        expect(dated?.projection.citation.passageId)
          .toBe(dated?.value?.date.passageIds[0]);
      }
      for (const [kind, status] of Object.entries(
        policy.expectedRequirementStatuses,
      )) {
        expect(
          result.collection.requirements.find((requirement) =>
            requirement.kind === kind)?.status,
          `${policy.caseId}: requirement ${kind}`,
        ).toBe(status);
      }
      expect(result.briefing.overview).toContain(policy.policyName);
      expect(result.briefing.overviewClaimIds.length).toBeGreaterThan(0);
      expect(result.briefing.whatChanged.paragraphs.join(" "))
        .not.toMatch(/claimCount|plan\.steps\[0\]/u);
      expect([
        ...result.briefing.whatChanged.claimIds,
        ...result.briefing.coverage.claimIds,
        ...result.briefing.enforcement.claimIds,
        ...result.briefing.timeline.map(({ claimId }) => claimId),
      ].every((claimId) =>
        result.collection.claims.some(({ id }) => id === claimId)))
        .toBe(true);
      expect(policy.knownGaps.length).toBeGreaterThan(0);
    },
  );
});
