import { describe, expect, it } from "vitest";

import {
  alignScopeContractToSentence,
  createScopeAlignmentAcknowledgment,
  SCREEN_01_ALIGNMENT_VERSION,
} from "../../src/core/scope-alignment";
import { draftScope } from "../../src/core/scope-extractor";

const videoGamingSentence =
  "Find a regulatory shock affecting U.S. public video gaming firms between 2014 and 2022 that may influence firm innovation.";

describe("Screen 1 sentence/Scope Contract alignment", () => {
  it("returns one versioned result covering all nine fields", () => {
    const result = alignScopeContractToSentence({
      sentence: videoGamingSentence,
      scope: draftScope(videoGamingSentence),
    });

    expect(result.version).toBe(SCREEN_01_ALIGNMENT_VERSION);
    expect(result.fields).toHaveLength(9);
    expect(result.blockingMismatches).toEqual([]);
    expect(result.alignedForConfirmation).toBe(true);
    expect(
      result.fields.find((field) => field.key === "industry")?.status,
    ).toBe("aligned");
    expect(
      result.fields.find((field) => field.key === "assignmentLevel")?.status,
    ).toBe("allowed-to-remain-unspecified");
  });

  it("normalizes equivalent geography, industry, period, and population wording", () => {
    const scope = {
      ...draftScope(videoGamingSentence),
      population: "Public companies",
      geography: "U.S.",
      industry: "Interactive entertainment",
      studyPeriod: "2014 to 2022",
    };
    const result = alignScopeContractToSentence({
      sentence: videoGamingSentence,
      scope,
    });

    expect(result.blockingMismatches).toEqual([]);
    expect(result.alignedForConfirmation).toBe(true);
  });

  it("reports a high-confidence industry mismatch with a direct suggestion", () => {
    const result = alignScopeContractToSentence({
      sentence: videoGamingSentence,
      scope: {
        ...draftScope(videoGamingSentence),
        industry: "Manufacturing",
      },
    });

    expect(result.blockingMismatches).toEqual([
      expect.objectContaining({
        key: "industry",
        status: "possible-mismatch",
        sentenceValue: "Video gaming",
        scopeValue: "Manufacturing",
        suggestedValue: "Video gaming",
      }),
    ]);
    expect(result.alignedForConfirmation).toBe(false);
  });

  it("does not block a valid researcher value the parser cannot infer", () => {
    const sentence =
      "Find a plausible external event affecting firms between 2014 and 2022 with measurable outcomes.";
    const result = alignScopeContractToSentence({
      sentence,
      scope: {
        population: "Public firms",
        assignmentLevel: "Not specified",
        analysisLevel: "Firm",
        geography: "Belgium",
        industry: "Semiconductors",
        studyPeriod: "2014–2022",
        eventFamily: "Regulation",
        outcomeFamily: "Innovation",
        outcomeFrequency: "Not specified",
      },
    });

    expect(result.blockingMismatches).toEqual([]);
    expect(
      result.fields.find((field) => field.key === "industry")?.status,
    ).toBe("not-inferable-from-sentence");
  });

  it("treats vague region language as not inferable instead of a geography mismatch", () => {
    const sentence =
      "Find a regulatory shock affecting public firms in selected regions between 2014 and 2022 that may influence innovation.";
    const scope = {
      ...draftScope(sentence),
      geography: "Belgium",
    };
    const result = alignScopeContractToSentence({ sentence, scope });

    expect(
      result.fields.find((field) => field.key === "geography"),
    ).toMatchObject({
      status: "not-inferable-from-sentence",
      sentenceValue: "Not specified",
      scopeValue: "Belgium",
    });
    expect(
      result.blockingMismatches.some((field) => field.key === "geography"),
    ).toBe(false);
  });

  it("does not confuse employees at public firms with a firm population", () => {
    const result = alignScopeContractToSentence({
      sentence: videoGamingSentence,
      scope: {
        ...draftScope(videoGamingSentence),
        population: "Employees at public firms",
      },
    });

    expect(
      result.blockingMismatches.find((field) => field.key === "population"),
    ).toMatchObject({
      status: "possible-mismatch",
      sentenceValue: "Public firms",
      scopeValue: "Employees at public firms",
    });
  });

  it("binds an acknowledgement to the current sentence and retained value", () => {
    const scope = {
      ...draftScope(videoGamingSentence),
      industry: "Manufacturing",
    };
    const acknowledgment = createScopeAlignmentAcknowledgment({
      key: "industry",
      sentence: videoGamingSentence,
      scopeValue: scope.industry,
    });
    const accepted = alignScopeContractToSentence({
      sentence: videoGamingSentence,
      scope,
      acknowledgedDifferences: [acknowledgment],
    });

    expect(accepted.alignedForConfirmation).toBe(true);
    expect(
      accepted.fields.find((field) => field.key === "industry")?.status,
    ).toBe("researcher-acknowledged-difference");
    expect(accepted.acknowledgedDifferences).toHaveLength(1);

    expect(
      alignScopeContractToSentence({
        sentence: videoGamingSentence.replace("U.S.", "Canadian"),
        scope,
        acknowledgedDifferences: [acknowledgment],
      }).fields.find((field) => field.key === "industry")?.status,
    ).toBe("possible-mismatch");
    expect(
      alignScopeContractToSentence({
        sentence: videoGamingSentence,
        scope: { ...scope, industry: "Healthcare" },
        acknowledgedDifferences: [acknowledgment],
      }).fields.find((field) => field.key === "industry")?.status,
    ).toBe("possible-mismatch");
  });
});
