import { describe, expect, it } from "vitest";

import {
  createCoEventCandidateOccurrence,
} from "../../src/core/six-screen/co-event-execution";
import type { CoEventProviderId } from
  "../../src/core/six-screen/co-event-search";
import {
  createCoEventDuplicateReview,
  createCoEventOccurrenceReview,
  latestCoEventDuplicateReview,
  latestCoEventOccurrenceReview,
  validateCoEventDuplicateReview,
  validateCoEventOccurrenceReview,
  validateCoEventReviewCollections,
} from "../../src/core/six-screen/co-event-occurrence-review";

function candidate(input: {
  id: string;
  providerId: CoEventProviderId;
  title: string;
  date: string;
  recordedAt: string;
}) {
  const sourceId = `source-${input.id}`;
  return createCoEventCandidateOccurrence({
    id: input.id,
    providerId: input.providerId,
    sourceNativeId: `native-${input.id}`,
    title: input.title,
    description: `${input.title} was reported in provider metadata.`,
    eventFamily: "independent market change",
    formalIdentifiers: [`FORMAL-${input.id}`],
    typedDates: [{
      kind: "event",
      value: input.date,
      precision: input.date.length === 10
        ? "day"
        : input.date.length === 7
          ? "month"
          : "year",
      sourceId,
    }],
    geography: {
      status: "provider_reported",
      labels: ["United States"],
    },
    evidence: [{
      sourceId,
      title: `${input.title} metadata`,
      locator: `https://example.test/${input.id}`,
      publisher: input.providerId,
      publishedDate: input.date,
      authorityTier: 2,
      retrievedAt: input.recordedAt,
      evidenceRole: "occurrence_metadata",
    }],
    recordedAt: input.recordedAt,
  });
}

describe("Screen 4 occurrence and duplicate review", () => {
  const first = candidate({
    id: "coevent-review-first",
    providerId: "federal_register",
    title: "Regional reliability rule",
    date: "2021-05-20",
    recordedAt: "2026-09-14T09:00:00.000Z",
  });
  const second = candidate({
    id: "coevent-review-second",
    providerId: "gdacs",
    title: "Regional reliability rule announcement",
    date: "2021-05-21",
    recordedAt: "2026-09-14T09:00:01.000Z",
  });

  it("retains immutable evidence while recording append-only researcher corrections", () => {
    const original = structuredClone(first);
    const retained = createCoEventOccurrenceReview({
      reviewId: "coevent-occurrence-review-1",
      candidate: first,
      previousReview: null,
      decision: { mode: "retained" },
      rationale:
        "Retain the source-documented occurrence for later comparison-specific review.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:01:00.000Z",
    });
    const corrected = createCoEventOccurrenceReview({
      reviewId: "coevent-occurrence-review-2",
      candidate: first,
      previousReview: retained,
      decision: {
        mode: "corrected",
        correction: {
          title: "Regional reliability implementation rule",
          typedDates: [{ kind: "effective", value: "2021-06" }],
          affectedActivityOrPopulationLabels: ["Regional market operators"],
          geographyLabels: ["Mid-Atlantic United States"],
        },
      },
      rationale:
        "Record the researcher's interpretation separately from the provider metadata.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:02:00.000Z",
    });

    expect(first).toEqual(original);
    expect(corrected).toMatchObject({
      ordinal: 2,
      previousReview: {
        reviewId: retained.id,
        reviewFingerprint: retained.reviewFingerprint,
      },
      decision: "corrected",
      correction: {
        provenance: "researcher_supplied",
        typedDates: [{
          kind: "effective",
          value: "2021-06",
          precision: "month",
        }],
      },
      reusableAcrossDesignRevisions: true,
      relationAssessment: {
        status: "not_assessed",
        reason: "genuine_intelligence_path_unverified",
      },
    });
    expect(corrected.correction?.limitation).toMatch(
      /do not alter or upgrade.*source metadata/iu,
    );
    expect(latestCoEventOccurrenceReview(
      [retained, corrected],
      first.id,
    )).toEqual(corrected);
    expect(() => validateCoEventReviewCollections({
      candidates: [first, second],
      occurrenceReviews: [retained, corrected],
      duplicateReviews: [],
    })).not.toThrow();

    const changed = structuredClone(corrected);
    changed.correction!.title = "Unreviewed replacement";
    expect(() => validateCoEventOccurrenceReview(changed, first, retained))
      .toThrow(/invalid|changed/iu);
  });

  it("rejects inferred or non-substantive occurrence corrections", () => {
    expect(() => createCoEventOccurrenceReview({
      reviewId: "coevent-occurrence-review-model",
      candidate: first,
      previousReview: null,
      decision: { mode: "deferred" },
      rationale: "The model should not own this action.",
      actor: "model",
      reviewedAt: "2026-09-14T09:03:00.000Z",
    })).toThrow(/explicit researcher UI action/iu);

    expect(() => createCoEventOccurrenceReview({
      reviewId: "coevent-occurrence-review-unchanged",
      candidate: first,
      previousReview: null,
      decision: {
        mode: "corrected",
        correction: {
          title: first.title,
          typedDates: first.typedDates.map(({ kind, value }) => ({
            kind,
            value,
          })),
          affectedActivityOrPopulationLabels: [],
          geographyLabels: [...first.geography.labels],
        },
      },
      rationale: "This does not actually change the retained metadata.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:04:00.000Z",
    })).toThrow(/must differ/iu);

    expect(() => createCoEventOccurrenceReview({
      reviewId: "coevent-occurrence-review-invalid-date-kind",
      candidate: first,
      previousReview: null,
      decision: {
        mode: "corrected",
        correction: {
          title: null,
          typedDates: [{
            kind: "causal_effect",
            value: "2021-06-01",
          }],
          affectedActivityOrPopulationLabels: [],
          geographyLabels: [],
        },
      } as unknown as Parameters<
        typeof createCoEventOccurrenceReview
      >[0]["decision"],
      rationale: "An unrecognized date kind cannot enter stored review state.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:04:01.000Z",
    })).toThrow(/date kind is invalid/iu);
  });

  it("links duplicate representations without collapsing distinct stages or evidence", () => {
    const originalCandidates = structuredClone([first, second]);
    const sameEvent = createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-review-1",
      leftCandidate: second,
      rightCandidate: first,
      previousReview: null,
      decision: {
        mode: "same_event_representation",
        canonicalCandidateId: first.id,
      },
      rationale:
        "Treat these as two metadata representations of one occurrence while retaining both records.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:05:00.000Z",
    });
    const distinctStage = createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-review-2",
      leftCandidate: first,
      rightCandidate: second,
      previousReview: sameEvent,
      decision: { mode: "distinct_stage" },
      rationale:
        "On review, the announcement and effective rule are distinct stages and must remain linked but separate.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:06:00.000Z",
    });

    expect([first, second]).toEqual(originalCandidates);
    expect(sameEvent).toMatchObject({
      decision: "same_event_representation",
      canonicalCandidateId: first.id,
      preservesAllCandidateRecords: true,
      relationAssessment: { status: "not_assessed" },
    });
    expect(distinctStage).toMatchObject({
      ordinal: 2,
      decision: "distinct_stage",
      canonicalCandidateId: null,
      previousReview: { reviewId: sameEvent.id },
    });
    expect(distinctStage.members.map(({ candidateId }) => candidateId))
      .toEqual([first.id, second.id].sort());
    expect(latestCoEventDuplicateReview(
      [sameEvent, distinctStage],
      second.id,
      first.id,
    )).toEqual(distinctStage);
    expect(() => validateCoEventReviewCollections({
      candidates: [first, second],
      occurrenceReviews: [],
      duplicateReviews: [sameEvent, distinctStage],
    })).not.toThrow();
    expect(() => validateCoEventReviewCollections({
      candidates: [first, second],
      occurrenceReviews: [],
      duplicateReviews: [distinctStage, sameEvent],
    })).toThrow(/predecessor|unexpected/iu);
  });

  it("rejects self-pairs, nonmember canonical records, and pair tampering", () => {
    expect(() => createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-self",
      leftCandidate: first,
      rightCandidate: first,
      previousReview: null,
      decision: { mode: "different_event" },
      rationale: "A record cannot be compared with itself.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:07:00.000Z",
    })).toThrow(/two different candidates/iu);
    expect(() => createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-outsider",
      leftCandidate: first,
      rightCandidate: second,
      previousReview: null,
      decision: {
        mode: "same_event_representation",
        canonicalCandidateId: "coevent-outsider",
      },
      rationale: "The canonical record must be one of the reviewed pair.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:08:00.000Z",
    })).toThrow(/belong to the pair/iu);

    const review = createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-tamper",
      leftCandidate: first,
      rightCandidate: second,
      previousReview: null,
      decision: { mode: "deferred" },
      rationale: "Retain both records while their stage relationship is checked.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:09:00.000Z",
    });
    const changed = structuredClone(review);
    changed.members[0].candidateFingerprint = second.candidateFingerprint;
    expect(() => validateCoEventDuplicateReview(
      changed,
      [first, second],
      null,
    )).toThrow(/invalid|changed|does not match/iu);
  });

  it("uses one canonical pair order for mixed-case candidate identifiers", () => {
    const upper = candidate({
      id: "coevent-A",
      providerId: "federal_register",
      title: "Upper-case identifier record",
      date: "2021-05-22",
      recordedAt: "2026-09-14T09:10:00.000Z",
    });
    const lower = candidate({
      id: "coevent-a",
      providerId: "gdacs",
      title: "Lower-case identifier record",
      date: "2021-05-23",
      recordedAt: "2026-09-14T09:10:01.000Z",
    });
    const review = createCoEventDuplicateReview({
      reviewId: "coevent-duplicate-mixed-case",
      leftCandidate: upper,
      rightCandidate: lower,
      previousReview: null,
      decision: { mode: "different_event" },
      rationale:
        "Mixed-case identifiers must resolve to the same stored pair in either input order.",
      actor: "researcher_ui",
      reviewedAt: "2026-09-14T09:11:00.000Z",
    });

    expect(latestCoEventDuplicateReview(
      [review],
      lower.id,
      upper.id,
    )).toEqual(review);
  });
});
