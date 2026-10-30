import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  createStudyFirstMechanismPlan,
  createStudyFirstScholarlyWork,
} from "../../src/core/six-screen/study-first-mechanism-comparison";
import {
  SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION,
  SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
  createScreen5MechanismAssessmentBatchPlan,
  createScreen5MechanismComparison,
  createScreen5MechanismEvidencePacket,
  screen5MechanismComparisonDisplayState,
  type Screen5MechanismComparison,
  type Screen5MechanismComparisonWire,
} from "../../src/core/six-screen/screen5-mechanism";
import {
  HISTORICAL_SCREEN5_MODEL,
  HISTORICAL_SCREEN5_PROVIDER,
  HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION,
  HISTORICAL_SCREEN5_V1_COMPARISON_VERSION,
  HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION,
} from "../../src/core/six-screen/screen5-historical-record";
import { compileStudyFirstMechanismQueries } from
  "../../src/worker/screen05-study-first-mechanism";
import {
  buildCrossrefLiteratureRequest,
  SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS,
} from "../../src/worker/screen05-crossref-literature";
import {
  buildOpenAlexLiteratureRequest,
  SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS,
} from "../../src/worker/screen05-openalex-literature";
import { sanitizeScreen5ProviderText } from
  "../../src/worker/screen05-provider-text";
import { rateLimitFromHeaders, validateScreen5MechanismComparisonWire } from
  "../../src/worker/screen5-mechanism-contract";

const now = "2026-09-22T12:00:00.000Z";

function plan(candidateCount: number) {
  const candidates = Array.from({ length: candidateCount }, (_value, index) => ({
    id: `candidate-${index + 1}`,
    conceptLabel: `Distinct process ${index + 1}`,
    actor: `Actor ${index + 1}`,
    processNodes: ["Policy change", `Response ${index + 1}`, "Outcome"],
    contextualConditions: [`Condition ${index + 1}`],
    condition: `Condition ${index + 1}`,
    distinctionFromFocal: `Distinct pathway ${index + 1}`,
    perspective: null,
    perspectiveOrigin: "analyst_suggested" as const,
    relationToFocal: "unresolved" as const,
    hypothesisStatus: "provisional" as const,
  }));
  const candidateNeeds = candidates.map((candidate, index) => ({
    id: `need-${index + 1}`,
    candidateId: candidate.id,
    propositionToInvestigate: `Evidence for process ${index + 1}`,
    purpose: "support" as const,
    priority: "medium" as const,
  }));
  return createStudyFirstMechanismPlan({
    conceptualQuestion: "How could X reach Y through distinct processes?",
    relationshipInterpretation: {
      theoreticalChange: "Customer protection",
      direction: "unknown",
      outcomeEndpoint: "Firm performance",
      policyToConstructQualification: "Researcher proposed.",
      sourceFieldRefs: ["study.policySideConcept"],
    },
    candidates,
    supplementaryAccounts: [],
    evidenceNeeds: [
      ...candidateNeeds,
      {
        id: "need-direct",
        candidateId: null,
        propositionToInvestigate: "Open X-Y evidence",
        purpose: "distinguish" as const,
        priority: "high" as const,
      },
      {
        id: "need-challenge",
        candidateId: null,
        propositionToInvestigate: "Contrary evidence",
        purpose: "challenge" as const,
        priority: "high" as const,
      },
    ],
    queryIntents: [
      {
        id: "query-direct",
        intent: "direct_x_y_open_ended",
        conceptGroups: [["customer protection"], ["firm performance"]],
        scopeTerms: ["firms"],
        evidenceNeedIds: ["need-direct"],
        candidateIds: [],
      },
      {
        id: "query-challenge",
        intent: "contrary_or_boundary",
        conceptGroups: [["privacy regulation"], ["boundary condition"]],
        scopeTerms: ["firms"],
        evidenceNeedIds: ["need-challenge"],
        candidateIds: [],
      },
      ...candidates.map((candidate, index) => ({
        id: `query-${index + 1}`,
        intent: "alternative_pathway" as const,
        conceptGroups: [[candidate.conceptLabel], ["firm performance"]],
        scopeTerms: ["organizations"],
        evidenceNeedIds: [`need-${index + 1}`],
        candidateIds: [candidate.id],
      })),
    ],
    limitations: ["Provisional search scaffold."],
  });
}

function evidence(mechanismPlan: ReturnType<typeof plan>) {
  const work = createStudyFirstScholarlyWork({
    id: "work-one",
    providerIds: [{ provider: "crossref", nativeId: "10.1000/test" }],
    doi: "10.1000/test",
    title: "Privacy regulation and organizational response",
    authors: ["A. Researcher"],
    publicationYear: 2024,
    publicationVenue: "Journal of Privacy Research",
    publisher: "Research Publisher",
    workType: "article",
    stableLocators: ["https://doi.org/10.1000/test"],
    versionCaveat: null,
    updateOrRetraction: { retractedFlag: "not_checked", updateRelations: [] },
    access: {
      level: "abstract_inspected",
      abstractText:
        "Privacy regulation can change organizational responses and customer relationships.",
      abstractSource: "crossref_member_deposit",
      reportedOpenLocations: [],
    },
    claimBoundary: "Only the deposited abstract was inspected.",
  });
  return createScreen5MechanismEvidencePacket({
    id: "packet-v13",
    plan: mechanismPlan,
    works: [work],
    createdAt: now,
  });
}

function wireForBatch(
  batch: ReturnType<typeof createScreen5MechanismAssessmentBatchPlan>["batches"][number],
): Screen5MechanismComparisonWire {
  const ids = [...(batch.includeFocal ? ["m0"] : []), ...batch.candidateIds];
  return {
    mechanisms: ids.map((candidateId) => ({
      candidate_id: candidateId,
      concept: candidateId === "m0" ? "Researcher focal process" : candidateId,
      relation: candidateId === "m0" ? "focal" : "competing",
      chain: ["Policy change", `Response ${candidateId}`, "Outcome"],
      direction: {
        mechanism_response: "uncertain",
        outcome_implication: "uncertain",
        basis: "source_explicit",
        condition: "The intermediate response occurs in the saved setting.",
      },
      argument: [{
        text: "The inspected abstract supports only a bounded proposition.",
        evidence_ids: ["e1"],
        basis: "inspected_proposition" as const,
      }],
      fit: "The process can be observed at the saved unit.",
      limit: "The source does not test the proposed policy episode.",
      theory: null,
      theory_basis: "not_assigned",
    })),
    row_definitions: batch.includeFocal ? [{
      row_id: "row-one",
      observation: "Intermediate response",
      measure: "A dated direct measure",
      level: "firm-period",
      timing: "after the policy change",
      caution: "A shared response is not identifying.",
    }] : [],
    cells: ids.map((candidateId) => ({
      row_id: "row-one",
      candidate_id: candidateId,
      status: "prediction" as const,
      text: `Observe the response for ${candidateId}.`,
      evidence_ids: ["e1"],
    })),
    dispositions: batch.candidateIds.map((candidateId) => ({
      candidate_id: candidateId,
      status: "retained" as const,
      reason: "The pathway remains distinct and assessable.",
      merged_into: null,
    })),
    summary: `Saved batch ${batch.index}.`,
    gaps: ["Sample-specific evidence remains limited."],
  };
}

describe("Screen 5 v13 bounded assessment contract", () => {
  it("plans one focal-only batch for zero candidates and five for ten", () => {
    const emptyPlan = plan(0);
    const emptyPacket = evidence(emptyPlan);
    const empty = createScreen5MechanismAssessmentBatchPlan({
      executionId: "job-empty",
      problemFingerprint: fingerprintSixScreenValue("problem-empty"),
      inputFingerprint: fingerprintSixScreenValue("input-empty"),
      plan: emptyPlan,
      evidencePacket: emptyPacket,
    });
    expect(empty.batches).toHaveLength(1);
    expect(empty.batches[0]).toMatchObject({
      candidateIds: [],
      includeFocal: true,
    });

    const fullPlan = plan(10);
    const fullPacket = evidence(fullPlan);
    const full = createScreen5MechanismAssessmentBatchPlan({
      executionId: "job-full",
      problemFingerprint: fingerprintSixScreenValue("problem-full"),
      inputFingerprint: fingerprintSixScreenValue("input-full"),
      plan: fullPlan,
      evidencePacket: fullPacket,
    });
    expect(full.batches).toHaveLength(5);
    expect(full.batches.flatMap(({ candidateIds }) => candidateIds))
      .toEqual(fullPlan.candidates.map(({ id }) => id));
  });

  it("merges five validated batches into eleven stable cards and keyed cells", () => {
    const mechanismPlan = plan(10);
    const packet = evidence(mechanismPlan);
    const batchPlan = createScreen5MechanismAssessmentBatchPlan({
      executionId: "job-eleven",
      problemFingerprint: fingerprintSixScreenValue("problem-eleven"),
      inputFingerprint: fingerprintSixScreenValue("input-eleven"),
      plan: mechanismPlan,
      evidencePacket: packet,
    });
    const batchWires = batchPlan.batches.map((batch) => {
      const wire = wireForBatch(batch);
      validateScreen5MechanismComparisonWire(wire, new Set(["e1"]), {
        candidateIds: batch.candidateIds,
        includeFocal: batch.includeFocal,
        rowIds: batch.includeFocal ? [] : ["row-one"],
        allowedMergeTargets: mechanismPlan.candidates.map(({ id }) => id),
      });
      return { batchId: batch.id, wire };
    });
    const comparison = createScreen5MechanismComparison({
      id: "comparison-eleven",
      problemFingerprint: fingerprintSixScreenValue("problem-eleven"),
      focalText: "Exact researcher-finalized focal text.",
      plan: mechanismPlan,
      evidencePacket: packet,
      batchPlan,
      batchWires,
      modelObserved: "openai/gpt-oss-120b",
      createdAt: now,
    });
    expect(comparison.mechanisms).toHaveLength(11);
    expect(comparison.mechanisms[0]).toMatchObject({
      concept: "Exact researcher-finalized focal text.",
      support: "component_supported",
      sourceCheckStatus: "checked_relevant_text",
    });
    expect(comparison.predictions[0]?.patterns).toHaveLength(11);
    expect(comparison.predictions[0]?.patterns.every(({ citations }) =>
      citations?.length === 1)).toBe(true);
    expect(comparison.completion).toMatchObject({
      status: "completed",
      completedBatchCount: 5,
      totalBatchCount: 5,
    });

    const duplicate = structuredClone(batchWires);
    duplicate[0]!.wire.mechanisms[2]!.concept =
      duplicate[0]!.wire.mechanisms[1]!.concept;
    duplicate[0]!.wire.mechanisms[2]!.chain =
      [...duplicate[0]!.wire.mechanisms[1]!.chain];
    expect(() => createScreen5MechanismComparison({
      id: "comparison-duplicate",
      problemFingerprint: fingerprintSixScreenValue("problem-eleven"),
      plan: mechanismPlan,
      evidencePacket: packet,
      batchPlan,
      batchWires: duplicate,
      modelObserved: "openai/gpt-oss-120b",
      createdAt: now,
    })).toThrow(/explicit merge/u);
  });

  it("covers all ten candidates in four provider-specific operations", () => {
    const mechanismPlan = plan(10);
    const queries = compileStudyFirstMechanismQueries({
      context: {
        policy: { officialTitle: "California privacy requirements" },
        study: {
          outcome: "Firm performance",
          outcomeMeasure: "Return on assets",
          industry: ["Manufacturing"],
          analysisUnit: "firm-year",
          geography: ["California"],
        },
      } as never,
      mechanismInput: {
        proposedMechanism: "Protection changes customer trust and retention.",
        theoreticalPerspective: null,
      } as never,
      mechanismPlan,
    });
    expect(queries).toHaveLength(4);
    expect(new Set(queries.flatMap(({ candidateIds = [] }) => candidateIds)))
      .toEqual(new Set(mechanismPlan.candidates.map(({ id }) => id)));
    expect(queries.filter(({ provider }) => provider === "openalex")
      .some(({ query }) => query.includes(" OR ") && query.includes(" AND ")))
      .toBe(true);
    expect(queries.filter(({ provider }) => provider === "crossref")
      .every(({ query }) => !query.includes(" OR ") && !query.includes(" AND ")))
      .toBe(true);
    expect(queries.every(({ query }) => query.length <= 260)).toBe(true);
    for (const query of queries) {
      const requestUrl = query.provider === "openalex"
        ? buildOpenAlexLiteratureRequest({ query: query.query, resultLimit: 3 })
        : buildCrossrefLiteratureRequest({ query: query.query, resultLimit: 3 });
      const maximum = query.provider === "openalex"
        ? SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumRequestUrlCharacters
        : SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumRequestUrlCharacters;
      expect(requestUrl.length).toBeLessThanOrEqual(maximum);
    }
  });

  it("keeps missing rate headers unknown and anchors relative resets freshly", () => {
    expect(rateLimitFromHeaders(new Headers(), now)).toEqual({
      retryAfterAt: null,
      tokenResetAt: null,
      remainingTokens: null,
    });
    const headers = new Headers({
      "retry-after": "2",
      "x-ratelimit-reset-tokens": "1m",
      "x-ratelimit-remaining-tokens": "0",
    });
    expect(rateLimitFromHeaders(headers, "2026-09-22T12:00:05.000Z"))
      .toEqual({
        retryAfterAt: "2026-09-22T12:00:07.000Z",
        tokenResetAt: "2026-09-22T12:01:05.000Z",
        remainingTokens: 0,
      });
  });

  it("decodes title entities as inert text and adapts legacy results on read", () => {
    expect(sanitizeScreen5ProviderText(
      "Growing Tensions &amp; Privacy &lt;br&gt; <em>Study</em>",
      200,
    )).toBe("Growing Tensions & Privacy <br> Study");

    const mechanismPlan = plan(2);
    const packet = evidence(mechanismPlan);
    const batchPlan = createScreen5MechanismAssessmentBatchPlan({
      executionId: "job-legacy",
      problemFingerprint: fingerprintSixScreenValue("problem-legacy"),
      inputFingerprint: fingerprintSixScreenValue("input-legacy"),
      plan: mechanismPlan,
      evidencePacket: packet,
    });
    const current = createScreen5MechanismComparison({
      id: "comparison-current",
      problemFingerprint: fingerprintSixScreenValue("problem-legacy"),
      plan: mechanismPlan,
      evidencePacket: packet,
      batchPlan,
      batchWires: [{
        batchId: batchPlan.batches[0]!.id,
        wire: wireForBatch(batchPlan.batches[0]!),
      }],
      modelObserved: "openai/gpt-oss-120b",
      createdAt: now,
    });
    const { comparisonFingerprint: _fingerprint, ...currentBody } = current;
    const legacyBody = {
      ...currentBody,
      schemaVersion: HISTORICAL_SCREEN5_V1_COMPARISON_VERSION,
      provider: HISTORICAL_SCREEN5_PROVIDER,
      modelRequested: HISTORICAL_SCREEN5_MODEL,
      modelObserved: HISTORICAL_SCREEN5_MODEL,
      promptVersion: HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION,
      wireVersion: HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION,
      completion: undefined,
      dispositions: undefined,
      batchSummaries: undefined,
    };
    const legacy = {
      ...legacyBody,
      comparisonFingerprint: fingerprintSixScreenValue(legacyBody),
    } as Screen5MechanismComparison;
    expect(screen5MechanismComparisonDisplayState(legacy).completionStatus)
      .toBe("completed");
    expect(current.promptVersion).toBe(SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION);
    expect(current.wireVersion).toBe(SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION);
  });
});
