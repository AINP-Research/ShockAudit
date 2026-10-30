import { describe, expect, it } from "vitest";

import {
  confirmScopeContract,
  createInitialState,
  draftScopeContract,
  scopeContextMarkdown,
} from "../../src/core/screen01-service";
import { createScopeAlignmentAcknowledgment } from "../../src/core/scope-alignment";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import type { Screen01State } from "../../src/core/scope-types";

describe("Screen 1 service", () => {
  function completeFindState(): Screen01State {
    const initial = createInitialState();
    return {
      ...initial,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed firms",
        assignmentLevel: "Firm",
        outcomeFrequency: "Annual",
      },
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "outcomeFrequency",
      ],
    };
  }

  it("creates the exact default Find state", () => {
    const state = createInitialState();
    expect(state.mode).toBe("find");
    expect(state.scope.studyPeriod).toBe("2014–2022");
    expect(state.confirmed).toBe(false);
  });

  it("returns a transparent validation error for an incomplete sentence", () => {
    const result = draftScopeContract({
      mode: "find",
      sentence: "Too short.",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("at least 20");
  });

  it("confirms a fully resolved Scope Contract", () => {
    const result = confirmScopeContract(completeFindState());

    expect(result.ok).toBe(true);
    expect(result.state.confirmed).toBe(true);
    expect(result.ambiguities).toEqual([]);
  });

  it("does not confirm blank required fields", () => {
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "   ",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.state.confirmed).toBe(false);
    expect(result.ambiguities[0]?.key).toBe("population");
  });

  it("does not confirm overlong Scope Contract values", () => {
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        industry: "x".repeat(201),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("200 characters or fewer");
  });

  it("accepts a generic public-firm population when geography is separate", () => {
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "Public firms",
      },
      resolvedKeys: [...initial.resolvedKeys, "population"],
    });

    expect(result.ok).toBe(true);
    expect(result.state.confirmed).toBe(true);
    expect(result.state.scope.population).toBe("Public firms");
    expect(result.state.scope.geography).toBe("United States");
    expect(result.ambiguities).toEqual([]);
  });

  it("confirms search-essential video-gaming scope while deferring design-dependent fields", () => {
    const sentence =
      "Find a regulatory shock affecting public video gaming firms in the United States from 2014 to 2022 that may influence profitability.";
    const draft = draftScopeContract({ mode: "find", sentence });

    expect(draft.state.scope).toMatchObject({
      population: "Public firms",
      geography: "United States",
      industry: "Video gaming",
      assignmentLevel: "Not specified",
      outcomeFrequency: "Not specified",
    });
    const result = confirmScopeContract(draft.state);
    expect(result.ok).toBe(true);
    expect(result.ambiguities).toEqual([]);
    expect(result.state.scope).toStrictEqual(draft.state.scope);
  });

  it("does not confirm a population containing a guided placeholder", () => {
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "Exchange-listed firms in the selected geography",
      },
      resolvedKeys: [...initial.resolvedKeys, "population", "geography"],
    });

    expect(result.ok).toBe(false);
    expect(result.ambiguities.some((issue) => issue.key === "population")).toBe(
      true,
    );
  });

  it("does not use scopeDirty as an independent blocker", () => {
    const result = confirmScopeContract({
      ...completeFindState(),
      scopeDirty: true,
    });

    expect(result.ok).toBe(true);
    expect(result.state.confirmed).toBe(true);
    expect(result.state.scopeDirty).toBe(false);
  });

  it("rejects high-confidence differences after the sentence changes", () => {
    const result = confirmScopeContract({
      ...completeFindState(),
      sentence:
        "Find a regulatory shock affecting Canadian hospitals from 2014 to 2022 that influences employment.",
      scopeDirty: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("description and Scope Contract");
    expect(result.alignment.blockingMismatches.length).toBeGreaterThan(0);
  });

  it("rejects a semantically mismatched contract even if freshness metadata is forged", () => {
    const sentence =
      "Find a regulatory shock affecting Canadian hospitals from 2014 to 2022 that influences employment.";
    const result = confirmScopeContract({
      ...completeFindState(),
      sentence,
      contractSourceSentence: sentence,
      scopeDirty: false,
    });

    expect(result.ok).toBe(false);
    expect(
      result.alignment.blockingMismatches.some(
        (issue) => issue.key === "population",
      ),
    ).toBe(true);
    expect(
      result.alignment.blockingMismatches.some(
        (issue) => issue.key === "geography",
      ),
    ).toBe(true);
    expect(
      result.alignment.blockingMismatches.some(
        (issue) => issue.key === "outcomeFamily",
      ),
    ).toBe(true);
  });

  it("confirms the exact manufacturing-to-video-gaming manual alignment", () => {
    const original =
      "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm innovation.";
    const sentence = original.replace(
      "manufacturing firms",
      "video gaming firms",
    );
    const initial = createInitialState("find", original);
    const result = confirmScopeContract({
      ...initial,
      revision: 2,
      sentence,
      scope: { ...initial.scope, industry: "Video gaming" },
      resolvedKeys: ["industry"],
      scopeDirty: true,
    });

    expect(result.ok).toBe(true);
    expect(result.alignment.blockingMismatches).toEqual([]);
    expect(result.state).toMatchObject({
      sentence,
      contractSourceSentence: sentence,
      scopeDirty: false,
      confirmed: true,
      resolvedKeys: ["industry"],
      scope: { industry: "Video gaming" },
    });
    expect(
      buildScreen01StudyContext(result.state, result.ambiguities)
        .readyForLaterScreens,
    ).toBe(true);
  });

  it("canonicalizes harmless outer whitespace during confirmation", () => {
    const sentence =
      "Find a regulatory shock affecting U.S. public video gaming firms between 2014 and 2022 that may influence firm innovation.";
    const initial = createInitialState("find", sentence);
    const result = confirmScopeContract({
      ...initial,
      sentence: `  ${sentence}  `,
      contractSourceSentence: `  ${initial.contractSourceSentence}  `,
      scope: Object.fromEntries(
        Object.entries(initial.scope).map(([key, value]) => [
          key,
          `  ${value}  `,
        ]),
      ) as typeof initial.scope,
    });

    expect(result.ok).toBe(true);
    expect(result.state.sentence).toBe(sentence);
    expect(result.state.contractSourceSentence).toBe(sentence);
    expect(Object.values(result.state.scope).every((value) => value === value.trim()))
      .toBe(true);
  });

  it("blocks a real mismatch until the researcher acknowledges it", () => {
    const sentence =
      "Find a regulatory shock affecting U.S. public video gaming firms between 2014 and 2022 that may influence firm innovation.";
    const initial = createInitialState("find", sentence);
    const mismatch = {
      ...initial,
      scope: { ...initial.scope, industry: "Manufacturing" },
      resolvedKeys: ["industry" as const],
      scopeDirty: true,
    };

    const blocked = confirmScopeContract(mismatch);
    expect(blocked.ok).toBe(false);
    expect(blocked.alignment.blockingMismatches).toHaveLength(1);

    const acknowledgment = createScopeAlignmentAcknowledgment({
      key: "industry",
      sentence,
      scopeValue: "Manufacturing",
    });
    const confirmed = confirmScopeContract({
      ...mismatch,
      acknowledgedDifferences: [acknowledgment],
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.state.acknowledgedDifferences).toEqual([
      acknowledgment,
    ]);
    expect(
      buildScreen01StudyContext(confirmed.state, confirmed.ambiguities)
        .acknowledgedDifferences,
    ).toEqual([acknowledgment]);
  });

  it("allows assignment and analysis to differ in a cross-level design", () => {
    const initial = completeFindState();
    const sentence =
      "Find a regulatory shock with country-level assignment and firm-level analysis among U.S. exchange-listed manufacturing firms from 2014 to 2022 that influences profitability.";
    const result = confirmScopeContract({
      ...initial,
      sentence,
      contractSourceSentence: sentence,
      scope: {
        ...initial.scope,
        assignmentLevel: "Country",
        analysisLevel: "Firm",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.state.confirmed).toBe(true);
  });

  it("rejects placeholders and wrong-domain values", () => {
    const placeholder = confirmScopeContract({
      ...completeFindState(),
      scope: {
        ...completeFindState().scope,
        industry: "TBD",
      },
    });
    expect(placeholder.ok).toBe(false);
    expect(placeholder.ambiguities.some((issue) => issue.key === "industry")).toBe(
      true,
    );

    const wrongDomain = confirmScopeContract({
      ...completeFindState(),
      scope: {
        ...completeFindState().scope,
        outcomeFrequency: "Firm",
      },
    });
    expect(wrongDomain.ok).toBe(false);
    expect(
      wrongDomain.ambiguities.some(
        (issue) => issue.key === "outcomeFrequency",
      ),
    ).toBe(true);
  });

  it("requires a specifically named shock in Audit mode", () => {
    const initial = createInitialState("audit");
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed firms",
        assignmentLevel: "Firm",
      },
      knownShock: "TBD",
      resolvedKeys: ["population", "assignmentLevel", "knownShock"],
    });

    expect(result.ok).toBe(false);
    expect(result.ambiguities[0]?.key).toBe("knownShock");
  });

  it.each([
    "The event",
    "A policy",
    "Some shock",
    "A new law",
    "The policy change",
    "The court ruling",
    "A regulatory shock",
    "The judicial decision",
    "A natural disaster",
    "The infrastructure outage",
    "The pandemic",
    "A market disruption",
    "A policy reform",
    "A tax reform",
    "The economic crisis",
    "A government policy",
    "A legal change",
    "A mass shooting",
    "A tornado",
    "A drought",
    "A tsunami",
    "A terrorist attack",
    "A data breach",
    "A power outage",
    "A labor strike",
    "A war",
    "A protest",
    "A lockdown",
    "A disease outbreak",
    "A New York law",
    "A Texas court ruling",
    "A federal law in 2018",
  ])(
    "rejects a generic named shock: %s",
    (knownShock) => {
      const initial = createInitialState("audit");
      const result = confirmScopeContract({
        ...initial,
        scope: {
          ...initial.scope,
          population: "U.S. exchange-listed firms",
          assignmentLevel: "Firm",
        },
        knownShock,
        resolvedKeys: ["population", "assignmentLevel", "knownShock"],
      });

      expect(result.ok).toBe(false);
      expect(result.ambiguities[0]?.key).toBe("knownShock");
    },
  );

  it.each([
    "a severe tornado",
    "a deadly mass shooting",
    "a major data breach",
    "a hurricane in Florida",
    "a labor strike in Chicago",
    "a federal privacy law",
    "a state minimum wage law",
    "the 2019 Florida hurricane",
  ])(
    "rejects a descriptive category that still does not name one event: %s",
    (knownShock) => {
      const sentence = `Audit whether ${knownShock} affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.`;
      const initial = draftScopeContract({ mode: "audit", sentence }).state;
      const result = confirmScopeContract({
        ...initial,
        sentence,
        contractSourceSentence: sentence,
        scope: {
          ...initial.scope,
          population: "U.S. exchange-listed manufacturing firms",
          assignmentLevel: "State",
          eventFamily:
            /\b(?:tornado|hurricane)\b/i.test(knownShock)
              ? "Disaster"
              : initial.scope.eventFamily,
          outcomeFrequency: "Annual",
        },
        knownShock,
        resolvedKeys: [
          "population",
          "assignmentLevel",
          "outcomeFrequency",
          "knownShock",
        ],
        scopeDirty: false,
      });

      expect(result.ok).toBe(false);
      expect(result.ambiguities[0]?.key).toBe("knownShock");
      expect(result.ambiguities[0]?.title).toBe(
        "Which known shock should be audited?",
      );
    },
  );

  it.each([
    "Hurricane Katrina and Hurricane Rita",
    "Hurricane Katrina alongside Hurricane Rita",
    "Hurricane Katrina or Hurricane Rita",
  ])(
    "rejects multiple focal events even when copied into Known shock: %s",
    (knownShock) => {
      const sentence = `Audit whether ${knownShock} affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.`;
      const initial = draftScopeContract({ mode: "audit", sentence }).state;
      const result = confirmScopeContract({
        ...initial,
        sentence,
        contractSourceSentence: sentence,
        scope: {
          ...initial.scope,
          population: "U.S. exchange-listed manufacturing firms",
          assignmentLevel: "State",
          eventFamily: "Disaster",
          outcomeFrequency: "Annual",
        },
        knownShock,
        resolvedKeys: [
          "population",
          "assignmentLevel",
          "outcomeFrequency",
          "knownShock",
        ],
        scopeDirty: false,
      });

      expect(result.ok).toBe(false);
      expect(result.ambiguities[0]?.key).toBe("knownShock");
    },
  );

  it("rejects a different noncanonical shock than the sentence names", () => {
    const sentence =
      "Audit whether Hurricane Katrina affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.";
    const initial = draftScopeContract({ mode: "audit", sentence }).state;
    const result = confirmScopeContract({
      ...initial,
      sentence,
      contractSourceSentence: sentence,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed manufacturing firms",
        assignmentLevel: "State",
        eventFamily: "Disaster",
        outcomeFrequency: "Annual",
      },
      knownShock: "Hurricane Rita",
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "outcomeFrequency",
        "knownShock",
      ],
      scopeDirty: false,
    });

    expect(result.ok).toBe(false);
    expect(
      result.ambiguities.find((issue) => issue.key === "knownShock")?.title,
    ).toBe("Known shock does not match the study sentence");
  });

  it("does not block valid researcher values the parser cannot infer", () => {
    const sentence =
      "Find a plausible natural experiment for a study between 2014 and 2022 with measurable outcomes.";
    const result = confirmScopeContract({
      ...completeFindState(),
      sentence,
      contractSourceSentence: sentence,
      scopeDirty: false,
    });

    expect(result.ok).toBe(true);
    expect(result.alignment.blockingMismatches).toEqual([]);
  });

  it("accepts an event label that also contains an outcome word", () => {
    const sentence =
      "Find an employment law shock affecting U.S. exchange-listed manufacturing firms from 2014 to 2022 that influences profitability.";
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      sentence,
      contractSourceSentence: sentence,
      scope: {
        ...initial.scope,
        eventFamily: "Employment law",
      },
      scopeDirty: false,
    });

    expect(result.ok).toBe(true);
  });

  it("accepts an outcome label that also contains an event word", () => {
    const sentence =
      "Find a regulatory shock affecting U.S. exchange-listed manufacturing firms from 2014 to 2022 that influences regulatory compliance.";
    const initial = completeFindState();
    const result = confirmScopeContract({
      ...initial,
      sentence,
      contractSourceSentence: sentence,
      scope: {
        ...initial.scope,
        outcomeFamily: "Regulatory compliance",
      },
      scopeDirty: false,
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    ["industry", "Manufacturing and Healthcare"],
    ["eventFamily", "Regulation and Disaster"],
    ["outcomeFamily", "Profitability and Employment"],
  ] as const)(
    "rejects an extra %s family that the study sentence does not contain",
    (key, value) => {
      const initial = completeFindState();
      const result = confirmScopeContract({
        ...initial,
        scope: {
          ...initial.scope,
          [key]: value,
        },
        scopeDirty: false,
      });

      expect(result.ok).toBe(false);
      expect(
        result.alignment.blockingMismatches.some(
          (issue) => issue.key === key,
        ),
      ).toBe(
        true,
      );
    },
  );

  it("confirms a complete Chinese private-firm scope without public-listing guidance", () => {
    const sentence =
      "Find a regulatory shock affecting annual profitability among Chinese private manufacturing firms with firm-level assignment and firm-level analysis from 2014 to 2022.";
    const result = confirmScopeContract({
      revision: 8,
      mode: "find",
      sentence,
      contractSourceSentence: sentence,
      scope: {
        population: "Chinese private firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "China",
        industry: "Manufacturing",
        studyPeriod: "2014–2022",
        eventFamily: "Regulation",
        outcomeFamily: "Profitability",
        outcomeFrequency: "Annual",
      },
      knownShock: "",
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "analysisLevel",
        "geography",
        "industry",
        "studyPeriod",
        "eventFamily",
        "outcomeFamily",
        "outcomeFrequency",
      ],
      scopeDirty: false,
    });

    expect(result.ok).toBe(true);
    expect(result.ambiguities).toEqual([]);
    expect(result.state.scope).toMatchObject({
      population: "Chinese private firms",
      geography: "China",
    });
  });

  it("reconciles a recognized known shock with the sentence and event family", () => {
    const initial = createInitialState("audit");
    const result = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed technology firms",
        assignmentLevel: "Firm",
        eventFamily: "Disaster",
      },
      knownShock: "General Data Protection Regulation",
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "knownShock",
        "eventFamily",
      ],
    });

    expect(result.ok).toBe(false);
    expect(
      result.ambiguities.some((issue) => issue.key === "knownShock"),
    ).toBe(true);
    expect(
      result.ambiguities.some((issue) => issue.key === "eventFamily"),
    ).toBe(true);
  });

  it("describes the current screen for the ChatGPT composer", () => {
    const state = createInitialState("audit");
    const markdown = scopeContextMarkdown(
      buildScreen01StudyContext(state, []),
    );
    expect(markdown).toContain("Screen: 1 of 8");
    expect(markdown).toContain("California Consumer Privacy Act");
    expect(markdown).toContain('Assignment level: "Not specified"');
    expect(markdown).toContain('Outcome frequency: "Annual"');
  });
});
