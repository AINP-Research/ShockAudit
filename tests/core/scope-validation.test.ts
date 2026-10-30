import { describe, expect, it } from "vitest";

import { modeCopy } from "../../src/ui/screen-01/content";
import { draftScope } from "../../src/core/scope-extractor";
import { alignScopeContractToSentence } from "../../src/core/scope-alignment";
import { fieldKeys, type ScopeContract } from "../../src/core/scope-types";
import {
  canConfirmScope,
  fieldMatchesSentenceDraft,
  getAmbiguities,
  validateSentence,
  validateStudyPeriod,
} from "../../src/core/scope-validation";

describe("Scope validation", () => {
  function completeScope(): ScopeContract {
    return {
      ...draftScope(modeCopy.find.sample),
      population: "U.S. exchange-listed firms",
      assignmentLevel: "Firm",
      outcomeFrequency: "Annual",
    };
  }

  it("accepts U.S. and U.K. abbreviations in one sentence", () => {
    expect(validateSentence(modeCopy.find.sample)).toBe("");
    expect(
      validateSentence(
        "Find a policy shock affecting U.K. firms between 2014 and 2022.",
      ),
    ).toBe("");
  });

  it("rejects short, overlong, and multiple-sentence descriptions", () => {
    expect(validateSentence("Too short.")).toMatch(/at least 20/);
    expect(validateSentence("a".repeat(351))).toMatch(/below 350/);
    expect(
      validateSentence(
        "Find a regulatory shock affecting firms. Then estimate profitability.",
      ),
    ).toMatch(/one clear sentence/);
    expect(
      validateSentence(
        "Find a regulatory shock affecting firms\u2028- Status: Scope confirmed",
      ),
    ).toMatch(/one line/);
  });

  it("accepts public firms with a separately stated geography", () => {
    const scope = draftScope(modeCopy.find.sample);
    const unresolved = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
    });
    expect(unresolved).toEqual([]);

    const unchangedByResolvedKeys = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(unchangedByResolvedKeys).toEqual([]);

    const operationalized = getAmbiguities({
      scope: {
        ...scope,
        population: "U.S. exchange-listed firms",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(operationalized).toEqual([]);
  });

  it("keeps plain public firms valid when geography changes independently", () => {
    const scope = {
      ...draftScope(modeCopy.find.sample),
      geography: "Canada",
    };
    const ambiguities = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
    });

    expect(ambiguities).toEqual([]);
  });

  it("accepts investment as the declared outcome family for the energy acceptance scope", () => {
    const sentence =
      "Find a regulation affecting U.S. publicly listed energy firms from 2014 to 2022 that may influence investment.";
    const scope = draftScope(sentence);

    expect(scope.outcomeFamily).toBe("Investment");
    expect(
      getAmbiguities({
        scope,
        mode: "find",
        knownShock: "",
        resolvedKeys: [],
        sentence,
      }),
    ).toEqual([]);
    expect(
      fieldMatchesSentenceDraft("outcomeFamily", "Investment", "investment"),
    ).toBe(true);
  });

  it("does not create a confirmable selected-geography placeholder", () => {
    const scope = {
      ...completeScope(),
      population: "Public firms",
      geography: "Not specified",
    };
    const initial = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
    });
    const populationIssue = initial.find(
      (issue) => issue.key === "population",
    );
    expect(initial[0]?.key).toBe("geography");
    expect(initial[0]?.question).toContain(
      "before choosing the operational public-firm boundary",
    );
    expect(populationIssue).toBeUndefined();

    const staleGuidedValue = getAmbiguities({
      scope: {
        ...scope,
        population: "Exchange-listed firms in the selected geography",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(
      staleGuidedValue.some((issue) => issue.key === "population"),
    ).toBe(true);
  });

  it("defers unstated assignment and frequency choices until a shock is selected", () => {
    const ambiguities = getAmbiguities({
      scope: draftScope(modeCopy.find.sample),
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
    });
    const assignment = ambiguities.find(
      (issue) => issue.key === "assignmentLevel",
    );
    const frequency = ambiguities.find(
      (issue) => issue.key === "outcomeFrequency",
    );

    expect(assignment).toBeUndefined();
    expect(frequency).toBeUndefined();
  });

  it("reopens population guidance if geography contradicts a prior choice", () => {
    const scope = {
      ...draftScope(modeCopy.find.sample),
      population: "U.S. exchange-listed firms",
      geography: "Canada",
    };
    const ambiguities = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    const mismatch = ambiguities.find(
      (issue) => issue.key === "population",
    );

    expect(mismatch?.title).toBe("Population and geography do not match");
    expect(mismatch?.choices?.[0].label).toBe(
      "Public firms in Canada using my study's definition",
    );
  });

  it("puts a missing known shock first in Audit mode", () => {
    const ambiguities = getAmbiguities({
      scope: draftScope(modeCopy.find.sample),
      mode: "audit",
      knownShock: "",
      resolvedKeys: [],
    });
    expect(ambiguities[0].key).toBe("knownShock");
  });

  it("treats blank and whitespace-only fields as unresolved", () => {
    const scope = {
      ...draftScope(modeCopy.find.sample),
      population: "  ",
    };
    const ambiguities = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(ambiguities[0]?.key).toBe("population");
  });

  it.each([
    "Public firms",
    "public firms",
    "Public companies",
    "Companies that are public",
    "Publicly held companies",
    "Publicly traded firms",
    "Public corporations",
    "All firms traded in public markets",
    "Companies in the sample that are publicly traded",
    "Corporations that trade on public markets",
    "Companies with publicly traded shares",
  ])(
    "accepts a generic public-firm boundary with a separate geography: %s",
    (population) => {
      const ambiguities = getAmbiguities({
        scope: { ...completeScope(), population },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population"],
      });
      expect(
        ambiguities.some((issue) => issue.key === "population"),
      ).toBe(false);
    },
  );

  it.each([
    ["Chinese public firms", "China"],
    ["UK public firms", "United Kingdom"],
    ["Thai public firms", "Thailand"],
    ["Public firms in Thailand", "Thailand"],
  ])(
    "accepts an explicitly geography-qualified public-firm population: %s",
    (population, geography) => {
      const ambiguities = getAmbiguities({
        scope: { ...completeScope(), population, geography },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population", "geography"],
      });
      expect(
        ambiguities.some((issue) => issue.key === "population"),
      ).toBe(false);
    },
  );

  it("accepts Chinese private firms and keeps a country out of Population", () => {
    const privateFirmScope = {
      ...completeScope(),
      population: "Chinese private firms",
      geography: "China",
    };
    expect(
      getAmbiguities({
        scope: privateFirmScope,
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population", "geography"],
      }).some((issue) => issue.key === "population"),
    ).toBe(false);

    for (const geography of ["China", "Thailand"]) {
      const ambiguities = getAmbiguities({
        scope: {
          ...completeScope(),
          population: geography,
          geography,
        },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population", "geography"],
      });
      expect(ambiguities[0]).toMatchObject({
        key: "population",
        title: "Population contains the wrong type of value",
      });
      expect(ambiguities[0]?.question).toContain("geography value");
    }
  });

  it("requires a manual definition for public enterprises", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Public enterprises",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(ambiguities[0]?.key).toBe("population");
    expect(ambiguities[0]?.title).toContain("public enterprises");
    expect(ambiguities[0]?.choices).toBeUndefined();
  });

  it.each([
    "Exchange-listed public enterprises",
    "Public state-owned enterprises",
    "Public government-owned enterprises",
    "Public municipally owned enterprises",
  ])(
    "accepts an operationally specific public-enterprise boundary: %s",
    (population) => {
      const ambiguities = getAmbiguities({
        scope: {
          ...completeScope(),
          population,
        },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population"],
      });
      expect(
        ambiguities.some((issue) => issue.key === "population"),
      ).toBe(false);
    },
  );

  it.each([
    "Not specified",
    "not specified",
    "TBD",
    "Unknown",
    "Unknown population",
    "TBA",
    "Unspecified",
    "Not determined",
    "To be confirmed",
    "TBC",
    "Undecided",
    "Not available",
    "To be decided",
    "Not yet determined",
    "Not set",
    "N/A",
    "None",
    "—",
  ])("treats placeholder values as unresolved: %s", (placeholder) => {
    for (const key of fieldKeys.filter(
      (candidate) =>
        candidate !== "assignmentLevel" &&
        candidate !== "outcomeFrequency",
    )) {
      const ambiguities = getAmbiguities({
        scope: { ...completeScope(), [key]: placeholder },
        mode: "find",
        knownShock: "",
        resolvedKeys: [key],
      });
      expect(
        ambiguities.some((issue) => issue.key === key),
        `${key} accepted ${placeholder}`,
      ).toBe(true);
    }
  });

  it("asks the researcher to disambiguate gaming without silently correcting it", () => {
    const baseSentence =
      "Find a regulatory shock affecting U.S. public gmaing firms from 2014 to 2022 that may influence profitability.";
    const scope = draftScope(baseSentence);
    const ambiguities = getAmbiguities({
      scope,
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
      sentence: baseSentence,
    });
    const industryIssue = ambiguities.find(
      (issue) => issue.key === "industry",
    );

    expect(scope.industry).toBe("Not specified");
    expect(industryIssue?.title).toBe("Did you mean gaming?");
    expect(industryIssue?.choices?.map((choice) => choice.value)).toEqual([
      "Video gaming",
      "Gambling and casinos",
    ]);
  });

  it("requires a meaning for bare gaming but accepts explicit video gaming", () => {
    const gamingSentence =
      "Find a regulatory shock affecting U.S. public gaming firms from 2014 to 2022 that may influence profitability.";
    const gamingIssues = getAmbiguities({
      scope: draftScope(gamingSentence),
      mode: "find",
      knownShock: "",
      resolvedKeys: [],
      sentence: gamingSentence,
    });
    expect(
      gamingIssues.find((issue) => issue.key === "industry")?.title,
    ).toBe("Which kind of gaming is in scope?");

    const videoSentence = gamingSentence.replace("gaming", "video gaming");
    const videoScope = draftScope(videoSentence);
    expect(videoScope.industry).toBe("Video gaming");
    expect(
      getAmbiguities({
        scope: videoScope,
        mode: "find",
        knownShock: "",
        resolvedKeys: [],
        sentence: videoSentence,
      }).some((issue) => issue.key === "industry"),
    ).toBe(false);
  });

  it.each([
    ["assignmentLevel", "Annual"],
    ["assignmentLevel", "Annual firm data"],
    ["assignmentLevel", "Biannual firm data"],
    ["assignmentLevel", "Hourly firm assignment"],
    ["assignmentLevel", "Bimonthly firm"],
    ["analysisLevel", "Quarterly"],
    ["geography", "Manufacturing"],
    ["industry", "Canada"],
    ["industry", "Canada-based"],
    ["eventFamily", "Profitability"],
    ["eventFamily", "Profitability shock"],
    ["outcomeFamily", "Regulation"],
    ["outcomeFamily", "Regulatory outcome"],
    ["outcomeFrequency", "Firm"],
    ["outcomeFrequency", "Firm-year"],
    ["outcomeFrequency", "Establishment-year"],
    ["outcomeFrequency", "Hospital-year"],
    ["outcomeFrequency", "Transaction-day"],
    ["outcomeFrequency", "CEO-year"],
    ["outcomeFrequency", "Board-quarter"],
    ["outcomeFrequency", "Team-month"],
    ["outcomeFrequency", "Patent-year"],
    ["outcomeFrequency", "Director-year"],
    ["outcomeFrequency", "Manager-quarter"],
    ["outcomeFrequency", "Subsidiary-month"],
    ["outcomeFrequency", "City-year"],
    ["outcomeFrequency", "Lawsuit-day"],
  ] as const)(
    "flags a known wrong-domain value in %s",
    (key, value) => {
      const ambiguities = getAmbiguities({
        scope: { ...completeScope(), [key]: value },
        mode: "find",
        knownShock: "",
        resolvedKeys: [key],
      });
      expect(ambiguities.some((issue) => issue.key === key)).toBe(true);
    },
  );

  it("rejects a non-U.S. population paired with a U.S. geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Non-U.S. exchange-listed firms",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
  });

  it("flags population–geography contradictions across common aliases", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Canadian public firms listed on the TSX",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
  });

  it("flags a known population geography against any specific geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "U.S. exchange-listed firms",
        geography: "Germany",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
    expect(ambiguities[0]?.choices?.[0].label).toBe(
      "Public firms in Germany using my study's definition",
    );
  });

  it("reopens a generated population boundary after geography changes", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Exchange-listed firms in Germany",
        geography: "France",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
    expect(ambiguities[0]?.choices?.[0].label).toBe(
      "Public firms in France using my study's definition",
    );
  });

  it.each([
    ["German exchange-listed firms", "United States"],
    ["French public firms listed on Euronext", "Germany"],
  ])(
    "flags adjectival population geography against %s",
    (population, geography) => {
      const ambiguities = getAmbiguities({
        scope: {
          ...completeScope(),
          population,
          geography,
        },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population", "geography"],
      });
      expect(ambiguities[0]?.title).toBe(
        "Population and geography do not match",
      );
    },
  );

  it.each(["USA", "U.S.A.", "United States of America", "United States (national)"])(
    "treats %s as a United States geography alias",
    (geography) => {
      const ambiguities = getAmbiguities({
        scope: {
          ...completeScope(),
          geography,
        },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["population", "geography"],
      });
      expect(
        ambiguities.some((issue) => issue.key === "population"),
      ).toBe(false);
    },
  );

  it("flags a Spanish population against a United States geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Spanish exchange-listed firms",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
  });

  it("flags an Italian population against a United States geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Italian exchange-listed firms",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
  });

  it("accepts a qualified canonical geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "German exchange-listed firms",
        geography: "Germany (national)",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities.some((issue) => issue.key === "population")).toBe(
      false,
    );
  });

  it("accepts a nationwide canonical geography", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "German exchange-listed firms",
        geography: "Germany nationwide",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population", "geography"],
    });
    expect(ambiguities.some((issue) => issue.key === "population")).toBe(
      false,
    );
  });

  it("does not offer public-firm presets for another population type", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        population: "Canadian hospitals",
        geography: "United States",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["population"],
    });
    expect(ambiguities[0]?.title).toBe(
      "Population and geography do not match",
    );
    expect(ambiguities[0]?.choices).toBeUndefined();
  });

  it("flags multiple primary levels or observation frequencies", () => {
    const levels = getAmbiguities({
      scope: {
        ...completeScope(),
        assignmentLevel: "Country and State",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["assignmentLevel"],
    });
    expect(
      levels.find((issue) => issue.key === "assignmentLevel")?.title,
    ).toContain("more than one level");

    const frequencies = getAmbiguities({
      scope: {
        ...completeScope(),
        outcomeFrequency: "Annual and Quarterly",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["outcomeFrequency"],
    });
    expect(
      frequencies.find((issue) => issue.key === "outcomeFrequency")?.title,
    ).toContain("more than one interval");
  });

  it("treats firm and organization as one organizational level", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        assignmentLevel: "Firm or organization",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["assignmentLevel"],
    });
    expect(
      ambiguities.some((issue) => issue.key === "assignmentLevel"),
    ).toBe(false);
  });

  it.each([
    "Mine", "Sensor", "Air quality sensor", "Satellite pixel", "Watershed", "Borehole",
  ])(
    "accepts the researcher-provided custom unit %s without rewriting scope",
    (unit) => {
      const scope = Object.freeze({
        ...completeScope(),
        assignmentLevel: unit,
        analysisLevel: unit,
      });
      const original = JSON.stringify(scope);
      expect(
        getAmbiguities({ scope, mode: "find", knownShock: "", resolvedKeys: [] }),
      ).toEqual([]);
      expect(JSON.stringify(scope)).toBe(original);
      expect(fieldMatchesSentenceDraft("analysisLevel", unit, unit)).toBe(true);
    },
  );

  it.each([
    "Mine or sensor", "Sensor and firm", "Mine / country", "Sensor, satellite pixel",
  ])(
    "retains the primary-unit decision for explicit alternatives: %s",
    (unit) => {
      for (const key of ["assignmentLevel", "analysisLevel"] as const) {
        const issues = getAmbiguities({
          scope: { ...completeScope(), [key]: unit },
          mode: "find",
          knownShock: "",
          resolvedKeys: [key],
        });
        expect(issues.find((issue) => issue.key === key)?.title).toContain(
          "more than one level",
        );
      }
    },
  );

  it.each([
    "Unknown sensor", "Sensor or TBD", "Sensor or", "Unit", "Other",
    "Sensor in Canada", "Sensor (decide later)", "Hourly sensor", "Mine-year",
    "Canada", "Manufacturing", "Profitability",
  ])(
    "does not turn an ambiguous or wrong-domain value into a custom analysis unit: %s",
    (unit) => {
      const issues = getAmbiguities({
        scope: { ...completeScope(), analysisLevel: unit },
        mode: "find",
        knownShock: "",
        resolvedKeys: ["analysisLevel"],
      });
      expect(issues.some((issue) => issue.key === "analysisLevel")).toBe(true);
      expect(fieldMatchesSentenceDraft("analysisLevel", "Firm", unit)).toBe(false);
    },
  );

  it("keeps custom-unit identity and the existing sentence-alignment gate", () => {
    expect(fieldMatchesSentenceDraft("analysisLevel", "Mine", "Sensor")).toBe(false);
    expect(fieldMatchesSentenceDraft("assignmentLevel", "Firm", "Mine")).toBe(false);
    expect(
      fieldMatchesSentenceDraft("analysisLevel", "Air quality sensor", " air   quality SENSOR "),
    ).toBe(true);
    const scope = { ...completeScope(), analysisLevel: "Mine" };
    const alignment = alignScopeContractToSentence({
      sentence: modeCopy.find.sample,
      scope,
    });
    expect(
      alignment.blockingMismatches.some((field) => field.key === "analysisLevel"),
    ).toBe(true);
    expect(
      canConfirmScope({ sentenceError: "", ambiguities: [], alignment, confirmed: false }),
    ).toBe(false);
  });

  it("allows Market as an event family", () => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        eventFamily: "Market",
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["eventFamily"],
    });
    expect(ambiguities.some((issue) => issue.key === "eventFamily")).toBe(
      false,
    );
  });

  it.each([
    "Annual",
    "Quarterly",
    "Monthly",
    "Weekly",
    "Daily",
    "Hourly",
    "Event-based",
    "Every month",
    "Twice per year",
  ])("accepts a pure outcome-frequency expression: %s", (outcomeFrequency) => {
    const ambiguities = getAmbiguities({
      scope: {
        ...completeScope(),
        outcomeFrequency,
      },
      mode: "find",
      knownShock: "",
      resolvedKeys: ["outcomeFrequency"],
    });
    expect(
      ambiguities.some((issue) => issue.key === "outcomeFrequency"),
    ).toBe(false);
  });

  it.each([
    "",
    "TBD",
    "Not specified",
    "Unknown event",
    "Event TBD",
    "Event",
    "The event",
    "A policy",
    "Some shock",
    "A new law",
    "The policy change",
    "The court ruling",
    "A regulatory shock",
    "A state law",
    "The new regulation",
    "The judicial decision",
    "A natural disaster",
    "The infrastructure outage",
    "The pandemic",
    "A market disruption",
    "A policy reform",
    "A tax reform",
    "The economic crisis",
    "The financial crisis",
    "A government policy",
    "A legal change",
    "Known shock",
  ])(
    "requires a named event in Audit mode: %s",
    (knownShock) => {
      const ambiguities = getAmbiguities({
        scope: completeScope(),
        mode: "audit",
        knownShock,
        resolvedKeys: ["knownShock"],
      });
      expect(ambiguities[0]?.key).toBe("knownShock");
    },
  );

  it("uses alignment rather than scopeDirty as the confirmation gate", () => {
    const alignment = alignScopeContractToSentence({
      sentence: modeCopy.find.sample,
      scope: completeScope(),
    });
    expect(
      canConfirmScope({
        sentenceError: "",
        scopeError: "",
        ambiguities: [],
        alignment: alignScopeContractToSentence({
          sentence: modeCopy.find.sample.replace(
            "manufacturing firms",
            "video gaming firms",
          ),
          scope: completeScope(),
        }),
        confirmed: false,
      }),
    ).toBe(false);
    expect(
      canConfirmScope({
        sentenceError: "",
        scopeError: "",
        ambiguities: [],
        alignment,
        confirmed: false,
      }),
    ).toBe(true);
    expect(
      canConfirmScope({
        sentenceError: "",
        scopeError: "The start year cannot be later than the end year.",
        ambiguities: [],
        alignment,
        confirmed: false,
      }),
    ).toBe(false);
  });

  it("validates study-period boundaries", () => {
    expect(validateStudyPeriod("2022")).toMatch(/one year range/);
    expect(validateStudyPeriod("2022–2014")).toMatch(/must be earlier/);
    expect(validateStudyPeriod("2014–2018–2022")).toMatch(/one year range/);
    expect(validateStudyPeriod("2022–2022")).toMatch(/must be earlier/);
    expect(validateStudyPeriod("2014 bananas 2022")).toMatch(
      /one year range/,
    );
    expect(validateStudyPeriod("2014–2022")).toBe("");
    expect(validateStudyPeriod("from 2014 to 2022")).toBe("");
    expect(validateStudyPeriod("FY2014–FY2022")).toBe("");
  });
});
