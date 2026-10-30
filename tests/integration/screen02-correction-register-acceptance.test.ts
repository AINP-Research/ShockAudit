import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import correctionRegisterJson from
  "../fixtures/screen02-correction-case-register.v0.6.2.json";
import additionalCalibrationJson from
  "../fixtures/screen02-correction-additional-calibration.v0.6.2.json";
import reconstructionCasesJson from
  "../fixtures/screen02-policy-reconstruction-cases.v0.6.0.json";
import { POLICY_EVIDENCE_REQUIREMENT_KINDS } from
  "../../src/core/six-screen/policy-evidence-plan";
import {
  createPolicyBriefing,
  mergePolicyEvidenceCollections,
  parseOfficialDocumentPolicyEvidence,
  projectPolicyEvidenceClaims,
} from "../../src/core/six-screen/policy-review";
import type { PolicyReviewClaimProjection, TypedDate } from
  "../../src/core/six-screen/contracts";

type AdditionalCase = {
  caseId: string;
  policyName: string;
  sourceFamily: string;
  documents: Array<{
    sourceId: string;
    provider: string;
    publisher: string;
    issuer: string;
    jurisdiction: string;
    nativeId: string;
    officialLocator: string;
    versionLabel: string;
    evidenceText: string;
  }>;
  expectedFacts: Array<{
    predicate: PolicyReviewClaimProjection["predicate"];
    contains: string;
  }>;
  expectedDates: Array<{ kind: TypedDate["kind"]; start: string }>;
  forbiddenCoverageFragments: string[];
};

const correctionRegister = correctionRegisterJson as {
  schemaVersion: string;
  documentStatus: string;
  frozenAt: string;
  rosterFrozen: boolean;
  minimums: Record<string, number>;
  validationIsolation: {
    selectedBeforeCandidateTuning: boolean;
    rule: string;
  };
  sourceSnapshots: Array<{ path: string; sha256: string }>;
  cases: Array<{
    caseId: string;
    split: "calibration" | "reserved_validation";
    inputNameOnly: string;
    confirmedIdentity: string;
    domain: string;
    catalogStatus: string;
    expectedAutomaticPositive: boolean;
    oracleReference?: string;
    oracleSources?: string[];
    mustShow: string[];
    mustFlag: string[];
    mustNotAssert: string[];
  }>;
};

const additionalCalibration = additionalCalibrationJson as {
  schemaVersion: string;
  frozenAt: string;
  provenance: string;
  cases: AdditionalCase[];
};

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

function reconstruct(policy: AdditionalCase) {
  let collection = null as ReturnType<
    typeof parseOfficialDocumentPolicyEvidence
  >["collection"] | null;
  policy.documents.forEach((document, documentIndex) => {
    const parsed = parseOfficialDocumentPolicyEvidence({
      eventId: `correction-${policy.caseId.toLocaleLowerCase("en-US")}`,
      sourceId: document.sourceId,
      provider: document.provider,
      nativeId: document.nativeId,
      canonicalUrl: document.officialLocator,
      title: policy.policyName,
      publisher: document.publisher,
      issuer: document.issuer,
      jurisdiction: document.jurisdiction,
      publicationDate: null,
      retrievedAt: `2026-09-17T23:57:0${documentIndex}.000Z`,
      contentHash: `sha256:${String(documentIndex + 3).repeat(64)}`,
      retainedText: document.evidenceText,
      representation: "recorded-official-text",
      acquisitionProvenance: "direct",
      inspectedText: "full",
      sourceRole:
        "deterministic CI recording from the primary official source frozen in the correction register; not a live request or human legal review",
      documentVersionLabel: document.versionLabel,
    });
    collection = mergePolicyEvidenceCollections({
      previous: collection,
      next: parsed.collection,
      searchedKinds: POLICY_EVIDENCE_REQUIREMENT_KINDS,
    });
  });
  if (!collection) throw new Error(`${policy.caseId} has no evidence.`);
  const claims = projectPolicyEvidenceClaims(collection);
  return {
    collection,
    claims,
    briefing: createPolicyBriefing({
      title: policy.policyName,
      claims,
      requirements: collection.requirements,
      generatedAt: "2026-09-17T23:58:00.000Z",
    }),
  };
}

function projectedDate(claim: PolicyReviewClaimProjection) {
  if (!claim.typedValue || typeof claim.typedValue !== "object" ||
      Array.isArray(claim.typedValue)) return null;
  const date = (claim.typedValue as { date?: unknown }).date;
  return date && typeof date === "object" && !Array.isArray(date)
    ? date as TypedDate
    : null;
}

describe("Screen 2 correction frozen calibration and held-out register", () => {
  it("preserves the pre-tuning roster, split, source hashes, and validation isolation", () => {
    expect(correctionRegister).toMatchObject({
      schemaVersion: "shockaudit-screen2-correction-case-register-v1",
      documentStatus: "FROZEN_BEFORE_CORRECTION_TUNING",
      rosterFrozen: true,
      validationIsolation: { selectedBeforeCandidateTuning: true },
    });
    expect(correctionRegister.cases).toHaveLength(12);
    expect(new Set(correctionRegister.cases.map(({ caseId }) => caseId)).size)
      .toBe(12);
    expect(correctionRegister.cases.filter(({ split }) =>
      split === "calibration")).toHaveLength(6);
    expect(correctionRegister.cases.filter(({ split }) =>
      split === "reserved_validation")).toHaveLength(6);
    expect(correctionRegister.cases.filter(({ domain }) =>
      domain !== "privacy").length).toBeGreaterThanOrEqual(6);
    expect(correctionRegister.cases.filter(({ expectedAutomaticPositive }) =>
      expectedAutomaticPositive).length).toBeGreaterThanOrEqual(8);
    expect(correctionRegister.validationIsolation.rule).toMatch(
      /must not be used to tune/iu,
    );
    for (const snapshot of correctionRegister.sourceSnapshots) {
      expect(sha256(snapshot.path), snapshot.path).toBe(snapshot.sha256);
    }

    const existingIds = new Set(
      reconstructionCasesJson.cases.map(({ caseId }) => caseId),
    );
    const additionalIds = new Set(
      additionalCalibration.cases.map(({ caseId }) => caseId),
    );
    for (const policy of correctionRegister.cases) {
      const referenced = policy.oracleReference?.split("#")[1];
      expect(
        referenced ? existingIds.has(referenced) : additionalIds.has(policy.caseId),
        `${policy.caseId} has no frozen source-derived oracle`,
      ).toBe(true);
      expect(policy.mustShow.length).toBeGreaterThan(0);
      expect(policy.mustFlag.length).toBeGreaterThan(0);
      expect(policy.mustNotAssert.length).toBeGreaterThan(0);
    }
  });

  it.each(additionalCalibration.cases)(
    "$caseId reconstructs its missing calibration oracle without guidance or threshold leakage",
    (policy) => {
      const result = reconstruct(policy);
      for (const expected of policy.expectedFacts) {
        expect(result.claims.some(({ predicate, citation }) =>
          predicate === expected.predicate &&
          citation.exactText.toLocaleLowerCase("en-US").includes(
            expected.contains.toLocaleLowerCase("en-US"),
          )), `${policy.caseId}: ${expected.predicate} ${expected.contains}; ` +
            JSON.stringify(result.claims.map(({ predicate, citation }) => ({
              predicate,
              text: citation.exactText,
            }))))
          .toBe(true);
      }
      for (const expected of policy.expectedDates) {
        expect(result.claims.some((claim) => {
          const date = projectedDate(claim);
          return date?.kind === expected.kind && date.start === expected.start;
        }), `${policy.caseId}: ${expected.kind} ${expected.start}`).toBe(true);
      }
      const coverageText = result.claims.filter(({ predicate }) =>
        predicate === "coverage_condition").map(({ citation }) =>
          citation.exactText.toLocaleLowerCase("en-US")).join(" ");
      for (const forbidden of policy.forbiddenCoverageFragments) {
        expect(coverageText).not.toContain(
          forbidden.toLocaleLowerCase("en-US"),
        );
      }
      const overviewWords = result.briefing.overview.trim().split(/\s+/u);
      expect(overviewWords.length).toBeGreaterThanOrEqual(90);
      expect(overviewWords.length).toBeLessThanOrEqual(150);
      expect(result.briefing.timeline.length).toBeLessThanOrEqual(6);
      expect(result.briefing.unresolvedQuestions.length).toBeLessThanOrEqual(3);
      expect([
        ...result.briefing.overviewClaimIds,
        ...result.briefing.whatChanged.claimIds,
        ...result.briefing.coverage.claimIds,
        ...result.briefing.enforcement.claimIds,
        ...result.briefing.timeline.flatMap(({ claimId, claimIds }) =>
          claimIds ?? [claimId]),
      ].every((claimId) => result.claims.some(({ claimId: id }) =>
        id === claimId))).toBe(true);
    },
  );
});
