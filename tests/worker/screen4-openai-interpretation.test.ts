import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { StudyFirstEventInvestigation } from
  "../../src/core/six-screen/study-first-event-investigation";
import {
  prepareScreen4Interpretation,
  requestScreen4Interpretation,
  parseSavedScreen4InterpretationReceipt,
  validateScreen4Interpretation,
  SCREEN4_OPENAI_INTERPRETATION_INPUT_CEILING,
  SCREEN4_OPENAI_INTERPRETATION_OUTPUT_CEILING,
  SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
  Screen4InterpretationValidationError,
} from "../../src/worker/screen4-openai-interpretation";
import { Screen5OpenAIProviderError } from
  "../../src/worker/screen5-openai-provider";

const at = "2026-09-24T12:00:00.000Z";
const firstId = "event-federal-credit";
const secondId = "event-california-design";
const firstSourceId = "fr-2023-12345";
const secondSourceId = "ca-2022-design-act";

function investigation(): StudyFirstEventInvestigation {
  const contextFingerprint = fingerprintSixScreenValue("study-bound-screen4");
  const event = (id: string, sourceId: string, title: string) => ({
    id, title,
    description: `${title} was documented in the original source.`,
    eventFamily: "Regulation",
    sourceNativeId: sourceId,
    formalIdentifiers: [sourceId],
    geography: { status: "provider_reported", labels: ["United States"] },
    typedDates: [{ kind: "effective", value: "2023-08-29",
      precision: "day", sourceId }],
    evidence: [{ sourceId, title, publisher: "Official publisher",
      locator: `https://www.federalregister.gov/d/${sourceId}`,
      publishedDate: "2023-05-31", evidenceRole: "occurrence_metadata",
      factText: `The original source documents ${title} and its date.` }],
  });
  const analysis = (eventId: string, sourceId: string) => ({
    eventId,
    relationshipType: "potential_independent_event",
    relationshipEvidence: { status: "not_established" },
    documentedFactRefs: [sourceId],
    documentEventDistinction: {
      documentRole: "official_rule_or_notice",
      dateRoleStatus: "distinct_dates_documented",
    },
    eligibility: { status: "qualifying" },
  });
  return {
    status: "completed",
    investigationFingerprint: fingerprintSixScreenValue("completed-screen4"),
    context: {
      contextFingerprint,
      study: {
        population: "U.S. public manufacturers",
        analysisUnit: "firm-year",
        geography: ["United States", "California"],
        industry: ["Manufacturing"],
        period: { start: "2010", end: "2025" },
        outcome: "Firm performance",
        outcomeMeasure: "ROA",
        policySideConcept: "Customer knowledge",
        intendedConstruct: "obsolete saved construct",
        initialExplanation: "Customer response",
        proposedTreatment: "California firms",
        proposedComparison: "Non-California firms",
      },
      timing: { mode: "year", year: 2023, precision: "year" },
      policy: {
        officialTitle: "California Consumer Privacy Act",
        formalIdentifiers: ["AB 375"],
        issuingJurisdiction: "California",
        episode: "enactment",
        versionScope: "2018 enactment",
      },
    },
    plan: { planFingerprint: fingerprintSixScreenValue("screen4-plan") },
    occurrences: [
      event(firstId, firstSourceId,
        "Small Business Lending Under Regulation B"),
      event(secondId, secondSourceId,
        "California Age-Appropriate Design Code Act"),
    ],
    analyses: [analysis(firstId, firstSourceId),
      analysis(secondId, secondSourceId)],
    presentation: {
      status: "events_available",
      visibleEventIds: [firstId, secondId],
      coverage: { limitation: "State and federal routes searched; firm exposure unknown." },
    },
  } as unknown as StudyFirstEventInvestigation;
}

function assessment() {
  return {
    what_it_is:
      "The source documents a dated requirement affecting a specified activity.",
    why_it_may_matter:
      "If sampled manufacturers depend on affected credit markets, financing costs could change ROA.",
    what_to_check_next:
      "Map borrowing markets and implementation dates to California and non-California firms.",
  };
}

function wire(
  prepared: ReturnType<typeof prepareScreen4Interpretation>,
) {
  return {
    assessments: Object.fromEntries(prepared.packet.events.map((event) =>
      [event.slot_id, assessment()])),
  };
}

function providerResponse(content: unknown) {
  return new Response(JSON.stringify({
    id: "resp_screen4_test", object: "response", status: "completed",
    model: "gpt-6-luna", service_tier: "default",
    output: [{ id: "msg_screen4_test", type: "message", role: "assistant",
      status: "completed", content: [{ type: "output_text", annotations: [],
        text: JSON.stringify(content) }] }],
    usage: { input_tokens: 250, input_tokens_details: { cached_tokens: 20 },
      output_tokens: 140, output_tokens_details: { reasoning_tokens: 40 },
      total_tokens: 390 },
  }), { headers: { "content-type": "application/json",
    "x-request-id": "req-screen4-test" } });
}

describe("Screen 4 bounded OpenAI event interpretation", () => {
  it("admits four visible events even when every retained source has maximum text", () => {
    const current = investigation();
    const sourceText = "Documented source proposition. ".repeat(500)
      .slice(0, 12_000);
    const occurrences = Array.from({ length: 4 }, (_, eventIndex) => {
      const id = `event-maximum-${eventIndex + 1}`;
      const evidence = Array.from({ length: 6 }, (_, sourceIndex) => ({
        sourceId: `source-maximum-${eventIndex + 1}-${sourceIndex + 1}`,
        title: `Official source ${eventIndex + 1}.${sourceIndex + 1}`,
        publisher: "Official publisher",
        locator: `https://example.gov/${eventIndex + 1}/${sourceIndex + 1}`,
        publishedDate: "2023-05-31",
        authorityTier: 1 as const,
        retrievedAt: at,
        evidenceRole: "occurrence_metadata" as const,
        factText: sourceText,
      }));
      return {
        ...structuredClone(current.occurrences[0]!),
        id,
        title: `Maximum source event ${eventIndex + 1}`,
        sourceNativeId: `maximum-${eventIndex + 1}`,
        formalIdentifiers: [`MAX-${eventIndex + 1}`],
        typedDates: [{ kind: "effective" as const, value: "2023-08-29",
          precision: "day" as const, sourceId: evidence[0]!.sourceId }],
        evidence,
      };
    });
    current.occurrences = occurrences;
    current.analyses = occurrences.map((event) => ({
      ...structuredClone(current.analyses[0]!),
      eventId: event.id,
      documentedFactRefs: event.evidence.map(({ sourceId }) => sourceId),
    }));
    current.presentation!.visibleEventIds = occurrences.map(({ id }) => id);

    const prepared = prepareScreen4Interpretation({
      investigation: current,
      eventIds: current.presentation!.visibleEventIds,
    });

    expect(prepared.prepared.inputEstimate).toBeLessThanOrEqual(
      SCREEN4_OPENAI_INTERPRETATION_INPUT_CEILING,
    );
    expect(prepared.packet.events).toHaveLength(4);
    expect(prepared.packet.events.every(({ sources }) =>
      sources.every(({ fact_text }) =>
        fact_text === null || fact_text.length < 12_000))).toBe(true);
  });

  it("prepares one exact v23 envelope from the current study and source packet", () => {
    const prepared = prepareScreen4Interpretation({
      investigation: investigation(), eventIds: [firstId, secondId],
    });
    const body = JSON.parse(prepared.prepared.immutableRequestBody);
    expect(prepared.prepared).toMatchObject({
      taskType: "screen4_event_interpretation",
      inputCeiling: SCREEN4_OPENAI_INTERPRETATION_INPUT_CEILING,
      outputCeiling: SCREEN4_OPENAI_INTERPRETATION_OUTPUT_CEILING,
      authorizationMaximum: SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
    });
    expect(prepared.prepared.inputEstimate).toBeLessThan(
      SCREEN4_OPENAI_INTERPRETATION_INPUT_CEILING * 0.75,
    );
    expect(body).toMatchObject({
      model: "gpt-6-luna", reasoning: { effort: "medium" },
      max_output_tokens: 24_000, store: false, stream: false,
      text: { format: { name: "screen4_openai_event_descriptions_v3",
        strict: true } },
    });
    expect(body.instructions).toContain("four or five compact sentences");
    expect(body.instructions).toContain("Do not invent foreign operations");
    expect(prepared.packet.study.theoretical_construct_of_shock)
      .toBe("Customer knowledge");
    expect(JSON.stringify(prepared.packet)).not.toContain(
      "obsolete saved construct",
    );
    expect(prepared.packet.events.map(({ slot_id }) => slot_id))
      .toEqual(["event_1", "event_2"]);
    expect(JSON.stringify(prepared.packet)).not.toContain(firstId);
    expect(prepared.slotBindings).toEqual([
      { slotId: "event_1", eventId: firstId, sourceIds: [firstSourceId] },
      { slotId: "event_2", eventId: secondId,
        sourceIds: [secondSourceId] },
    ]);
    expect(Object.isFrozen(prepared.packet.events[0])).toBe(true);
  });

  it("rejects unadmitted events, incomplete slots and unsupported certainty", () => {
    const current = investigation();
    expect(() => prepareScreen4Interpretation({
      investigation: current, eventIds: [firstId, "unscreened-event"],
    })).toThrow(Screen4InterpretationValidationError);
    expect(() => prepareScreen4Interpretation({
      investigation: current,
      eventIds: [firstId, secondId, firstId],
    })).toThrow(Screen4InterpretationValidationError);
    const prepared = prepareScreen4Interpretation({
      investigation: current, eventIds: [firstId, secondId],
    });
    const good = wire(prepared);
    const normalized = validateScreen4Interpretation(good, prepared);
    expect(normalized.event_assessments.map(({ event_id }) => event_id))
      .toEqual([firstId, secondId]);
    expect(normalized.event_assessments[0]!.what_it_is.source_ids)
      .toEqual([firstSourceId]);
    expect(normalized.event_assessments[0]!.why_it_may_matter.source_ids)
      .toEqual([]);
    const missing = structuredClone(good);
    delete missing.assessments.event_2;
    expect(() => validateScreen4Interpretation(missing, prepared))
      .toThrow(Screen4InterpretationValidationError);
    const certain = structuredClone(good);
    certain.assessments.event_1!.why_it_may_matter =
      "This was a confounder of the study's effect.";
    expect(() => validateScreen4Interpretation(certain, prepared))
      .toThrow(Screen4InterpretationValidationError);
    const extra = { ...good, invented_score: 1 };
    expect(() => validateScreen4Interpretation(extra, prepared))
      .toThrow(Screen4InterpretationValidationError);
  });

  it("canonicalizes prose bounds and preserves server-owned event bindings", () => {
    const prepared = prepareScreen4Interpretation({
      investigation: investigation(), eventIds: [firstId, secondId],
    });
    const varied = wire(prepared);
    for (const item of Object.values(varied.assessments)) {
      item.why_it_may_matter =
        `  ${item.why_it_may_matter}   ${"detail ".repeat(300)}`;
      item.what_to_check_next =
        `  ${item.what_to_check_next}   ${"specific check ".repeat(150)}`;
    }
    const normalized = validateScreen4Interpretation(varied, prepared);
    expect(normalized.event_assessments.map(({ event_id }) => event_id))
      .toEqual([firstId, secondId]);
    expect(normalized.event_assessments[0]!.why_it_may_matter.text.length)
      .toBe(1_400);
    expect(normalized.event_assessments[0]!.what_it_is.source_ids)
      .toEqual([firstSourceId]);
    expect(normalized.event_assessments[0]!.why_it_may_matter.source_ids)
      .toEqual([]);
    expect(normalized.event_assessments[0]!.what_to_check_next.length)
      .toBe(900);
  });

  it("dispatches the exact admitted body, saves its receipt, and replays locally", async () => {
    const prepared = prepareScreen4Interpretation({
      investigation: investigation(), eventIds: [firstId],
    });
    const order: string[] = [];
    const onReceipt = vi.fn(async () => { order.push("receipt"); });
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      order.push("fetch");
      expect(init?.body).toBe(prepared.prepared.immutableRequestBody);
      return providerResponse(wire(prepared));
    });
    const result = await requestScreen4Interpretation({
      apiKey: "sk-test-screen4-key-1234567890",
      fetch, prepared, now: () => at,
      onDispatch: async () => { order.push("dispatch"); },
      onReceipt,
    });
    expect(order).toEqual(["dispatch", "fetch", "receipt"]);
    expect(result.wire).toEqual(
      validateScreen4Interpretation(wire(prepared), prepared),
    );
    expect(result.usage).toMatchObject({
      promptTokens: 250, completionTokens: 140,
      reasoningTokens: 40, cachedPromptTokens: 20,
    });
    expect(parseSavedScreen4InterpretationReceipt({
      receipt: result.receipt, prepared,
    })).toEqual(result.wire);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves the safe source path and receipt on failed model validation", async () => {
    const prepared = prepareScreen4Interpretation({
      investigation: investigation(), eventIds: [firstId],
    });
    const bad = wire(prepared);
    delete bad.assessments.event_1;
    const saved = vi.fn(async () => {});
    try {
      await requestScreen4Interpretation({
        apiKey: "sk-test-screen4-key-1234567890",
        fetch: vi.fn(async () => providerResponse(bad)),
        prepared, now: () => at,
        onReceipt: saved,
      });
      throw new Error("Expected provider validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(Screen5OpenAIProviderError);
      const providerError = error as Screen5OpenAIProviderError;
      expect(providerError.detail).toMatchObject({
        code: "provider_schema_invalid",
        dispatched: true,
        validationIssues: [{ code: "invalid_batch_envelope", path: "$" }],
      });
      expect(providerError.detail.receipt).toBeTruthy();
      expect(saved).toHaveBeenCalledTimes(1);
    }
  });
});
