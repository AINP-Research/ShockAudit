import { describe, expect, it } from "vitest";

import { modeCopy } from "../../src/ui/screen-01/content";
import {
  canonicalKnownShockName,
  draftScope,
  extractKnownShock,
  hasMultipleKnownShockCandidates,
} from "../../src/core/scope-extractor";

describe("Scope extraction", () => {
  it("drafts all nine fields from the Find sample", () => {
    expect(draftScope(modeCopy.find.sample)).toEqual({
      population: "Public firms",
      assignmentLevel: "Not specified",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Manufacturing",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Not specified",
    });
  });

  it("drafts the Audit sample and extracts its known shock", () => {
    expect(draftScope(modeCopy.audit.sample)).toEqual({
      population: "Public firms",
      assignmentLevel: "Not specified",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2017–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    });
    expect(extractKnownShock(modeCopy.audit.sample)).toBe(
      "California Consumer Privacy Act",
    );
  });

  it("drafts the user-facing CCPA Find study boundary without inventing a known shock", () => {
    const sentence =
      "Find a regulatory shock affecting U.S. publicly listed technology firms from 2017 to 2023 that may affect annual profitability.";

    expect(draftScope(sentence)).toEqual({
      population: "Public firms",
      assignmentLevel: "Not specified",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2017–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    });
    expect(extractKnownShock(sentence)).toBe("");
  });

  it("recognizes investment only when it appears in the outcome role", () => {
    const energySentence =
      "Find a regulation affecting U.S. publicly listed energy firms from 2014 to 2022 that may influence investment.";
    expect(draftScope(energySentence).outcomeFamily).toBe("Investment");

    const industryOnlySentence =
      "Find a regulation affecting U.S. investment firms from 2014 to 2022.";
    expect(draftScope(industryOnlySentence).outcomeFamily).toBe(
      "Not specified",
    );
  });

  it("keeps an explicit study period separate from a named shock's year", () => {
    const sentence =
      "Audit whether the California Consumer Privacy Act of 2018 affected annual profitability among U.S. public technology firms from 2017 to 2023.";

    expect(draftScope(sentence).studyPeriod).toBe("2017–2023");
    expect(extractKnownShock(sentence)).toBe(
      "California Consumer Privacy Act",
    );
  });

  it("does not silently choose between two different study-period ranges", () => {
    const sentence =
      "Audit whether the California Consumer Privacy Act of 2018 affected firms from 2017 to 2023 compared with records from 2019 to 2024.";

    expect(draftScope(sentence).studyPeriod).toBe("Not specified");
  });

  it("recognizes named and generic shocks", () => {
    expect(
      extractKnownShock(
        "Audit whether GDPR changed innovation among European firms from 2016 to 2022.",
      ),
    ).toBe("General Data Protection Regulation");
    expect(
      extractKnownShock(
        "Audit whether the New York pay-transparency law affected hiring among firms.",
      ),
    ).toBe("New York Pay-transparency Law");
  });

  it.each([
    ["CCPA", "California Consumer Privacy Act"],
    ["California Privacy Rights Act of 2020", "California Privacy Rights Act"],
    ["CPRA", "California Privacy Rights Act"],
    ["GDPR", "General Data Protection Regulation"],
    ["Sarbanes-Oxley Act of 2002", "Sarbanes–Oxley Act"],
    ["SOX", "Sarbanes–Oxley Act"],
  ])(
    "resolves the reviewed alias %s through curated event data",
    (alias, canonicalName) => {
      expect(canonicalKnownShockName(alias)).toBe(canonicalName);
      const sentence =
        `Audit whether ${alias} affected annual innovation among U.S. public technology firms from 2016 to 2022.`;
      expect(extractKnownShock(sentence)).toBe(canonicalName);
      expect(draftScope(sentence).eventFamily).toBe("Regulation");
    },
  );

  it("keeps unfamiliar named regulations on the generic extraction path", () => {
    const sentence =
      "Audit whether the New Zealand Fair Pay Agreements Act affected annual employment among public firms from 2016 to 2022.";
    expect(extractKnownShock(sentence)).toBe(
      "New Zealand Fair Pay Agreements Act",
    );
    expect(draftScope(sentence).eventFamily).toBe("Regulation");
    expect(canonicalKnownShockName("GDPRx modernization program")).toBe("");
  });

  it("marks information outside the current rule set as not specified", () => {
    const scope = draftScope(
      "Explore an external disruption involving organizations over a suitable period.",
    );
    expect(scope.geography).toBe("Not specified");
    expect(scope.industry).toBe("Not specified");
    expect(scope.studyPeriod).toBe("Not specified");
  });

  it("infers assignment level and outcome frequency only from explicit cues", () => {
    const explicit = draftScope(
      "Find a state-level shock affecting quarterly profitability among U.S. firms between 2014 and 2022.",
    );
    expect(explicit.assignmentLevel).toBe("State");
    expect(explicit.outcomeFrequency).toBe("Quarterly");

    const implicit = draftScope(
      "Find a regulatory shock affecting U.S. firms between 2014 and 2022 that may influence profitability.",
    );
    expect(implicit.assignmentLevel).toBe("Not specified");
    expect(implicit.outcomeFrequency).toBe("Not specified");

    const conflicting = draftScope(
      "Find a shock affecting both annual and quarterly profitability among U.S. firms between 2014 and 2022.",
    );
    expect(conflicting.outcomeFrequency).toBe("Not specified");
  });

  it.each([
    ["companies", "Firms", "Firm"],
    ["public manufacturing firms", "Public firms", "Firm"],
    ["private firms", "Private firms", "Firm"],
    ["hospitals", "Hospitals", "Organization"],
    ["universities", "Universities", "Organization"],
  ])(
    "does not treat United States as a state-level cue for %s",
    (units, population, analysisLevel) => {
      const scope = draftScope(
        `Find a regulatory shock affecting ${units} in the United States between 2014 and 2022.`,
      );
      expect(scope.population).toBe(population);
      expect(scope.analysisLevel).toBe(analysisLevel);
      expect(scope.geography).toBe("United States");
    },
  );

  it.each([
    ["video gaming firms", "Video gaming"],
    ["video game companies", "Video gaming"],
    ["interactive entertainment firms", "Video gaming"],
    ["gambling firms", "Gambling and casinos"],
    ["casino companies", "Gambling and casinos"],
  ])("recognizes an explicit gaming-sector phrase: %s", (units, expected) => {
    const scope = draftScope(
      `Find a regulatory shock affecting U.S. public ${units} between 2014 and 2022 that may influence profitability.`,
    );
    expect(scope.industry).toBe(expected);
  });

  it.each(["gaming firms", "gmaing firms"])(
    "leaves an ambiguous or misspelled gaming sector for clarification: %s",
    (units) => {
      const scope = draftScope(
        `Find a regulatory shock affecting U.S. public ${units} between 2014 and 2022 that may influence profitability.`,
      );
      expect(scope.industry).toBe("Not specified");
    },
  );

  it.each([
    "private nonfinancial firms",
    "private U.S. firms",
    "privately held companies",
    "companies that are private",
  ])("preserves common explicit private-firm boundaries: %s", (populationPhrase) => {
    const scope = draftScope(
      `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022.`,
    );
    expect(scope.population).toBe("Private firms");
    expect(scope.analysisLevel).toBe("Firm");
  });

  it.each([
    ["Chinese public firms", "Public firms", "China"],
    ["Chinese private firms", "Private firms", "China"],
    ["UK public firms", "Public firms", "United Kingdom"],
    ["Thai public firms", "Public firms", "Thailand"],
    ["Thai private firms", "Private firms", "Thailand"],
    ["public firms in Thailand", "Public firms", "Thailand"],
    ["private firms in Thailand", "Private firms", "Thailand"],
  ])(
    "preserves non-U.S. ownership and geography with later firm-level clauses: %s",
    (populationPhrase, population, geography) => {
      const scope = draftScope(
        `Find a regulatory shock affecting annual profitability among ${populationPhrase} with firm-level assignment and firm-level analysis from 2014 to 2022.`,
      );
      expect(scope.population).toBe(population);
      expect(scope.analysisLevel).toBe("Firm");
      expect(scope.geography).toBe(geography);
    },
  );

  it.each([
    ["firms in Thailand", "Thailand"],
    ["companies based in Kenya", "Kenya"],
    ["organizations headquartered in Brazil", "Brazil"],
    ["firms in Northern Europe", "Northern Europe"],
  ])(
    "infers a free-text geography from an explicit population location: %s",
    (populationPhrase, geography) => {
      expect(
        draftScope(
          `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022.`,
        ).geography,
      ).toBe(geography);
    },
  );

  it.each([
    "Find a shock with country-level assignment and firm-level analysis between 2014 and 2022.",
    "Find a shock with firm-level analysis and country-level assignment between 2014 and 2022.",
    "Find a shock where assignment is at the country level and observations are at the firm level between 2014 and 2022.",
    "Find a shock where observations are at the firm level and assignment occurs at the country level between 2014 and 2022.",
  ])("keeps assignment and analysis roles separate: %s", (sentence) => {
    const scope = draftScope(sentence);
    expect(scope.assignmentLevel).toBe("Country");
    expect(scope.analysisLevel).toBe("Firm");
    expect(scope.population).toBe("Firms");
  });

  it.each([
    ["state-level", "State"],
    ["region-level", "Region"],
    ["individual-level", "Individual"],
  ])(
    "preserves %s assignment with firm-level analysis",
    (assignmentPhrase, assignmentLevel) => {
      const scope = draftScope(
        `Find a shock with ${assignmentPhrase} assignment and firm-level analysis between 2014 and 2022.`,
      );
      expect(scope.assignmentLevel).toBe(assignmentLevel);
      expect(scope.analysisLevel).toBe("Firm");
    },
  );

  it.each([
    "Canadian firms listed on U.S. exchanges",
    "European firms reporting outcomes in U.S. dollars",
  ])("leaves conflicting geography cues unresolved: %s", (populationPhrase) => {
    const scope = draftScope(
      `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022.`,
    );
    expect(scope.geography).toBe("Not specified");
  });

  it.each([
    [
      "Find a shock where treatment varies by state for firms between 2014 and 2022.",
      "State",
    ],
    [
      "Find a shock where assignment occurs at the firm level for companies between 2014 and 2022.",
      "Firm",
    ],
    [
      "Find a shock where exposure is assigned at the country level for firms between 2014 and 2022.",
      "Country",
    ],
  ])(
    "recognizes reversed assignment wording without deleting the population: %s",
    (sentence, assignmentLevel) => {
      const scope = draftScope(sentence);
      expect(scope.assignmentLevel).toBe(assignmentLevel);
      expect(scope.population).toBe("Firms");
      expect(scope.analysisLevel).toBe("Firm");
    },
  );

  it.each([
    "Find a regulatory shock affecting firms in selected states between 2014 and 2022.",
    "Find a regulatory shock affecting companies across U.S. states between 2014 and 2022.",
    "Find a regulatory shock affecting organizations in selected states between 2014 and 2022.",
  ])("does not mistake a population's geography for the population: %s", (sentence) => {
    const scope = draftScope(sentence);
    expect(["Firms", "Organizations"]).toContain(scope.population);
    expect(["Firm", "Organization"]).toContain(scope.analysisLevel);
  });

  it.each([
    "publicly listed U.S. firms",
    "public nonfinancial firms",
    "public U.S. exchange-listed firms",
    "publicly held companies",
    "companies that are public",
    "U.S.-listed firms",
    "exchange-listed firms",
  ])("recognizes common public-firm wording: %s", (populationPhrase) => {
    const scope = draftScope(
      `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022.`,
    );
    expect(scope.population).toBe("Public firms");
    expect(scope.analysisLevel).toBe("Firm");
  });

  it.each([
    ["publicly available data on private firms", "Private firms", "Firm"],
    ["publicly accessible records for companies", "Firms", "Firm"],
    ["public scrutiny of private firms", "Private firms", "Firm"],
    ["public concern about firms", "Firms", "Firm"],
    ["public pressure on firms", "Firms", "Firm"],
    ["employees at public firms", "Employees", "Individual"],
    ["workers in public companies", "Employees", "Individual"],
    ["public opinion regarding firms", "Firms", "Firm"],
    ["public backlash against firms", "Firms", "Firm"],
    ["public debate over firms", "Firms", "Firm"],
    ["a database that listed private firms", "Private firms", "Firm"],
    ["a report listed risks for firms", "Firms", "Firm"],
    ["a source listed several firms", "Firms", "Firm"],
  ])(
    "does not mistake public-context wording for the target population: %s",
    (populationPhrase, population, analysisLevel) => {
      const scope = draftScope(
        `Find a regulatory shock using ${populationPhrase} between 2014 and 2022.`,
      );
      expect(scope.population).toBe(population);
      expect(scope.analysisLevel).toBe(analysisLevel);
    },
  );

  it("recognizes explicit analysis levels independently of population words", () => {
    const stateAnalysis = draftScope(
      "Find a regulatory shock with state-level analysis among firms between 2014 and 2022.",
    );
    expect(stateAnalysis.population).toBe("Firms");
    expect(stateAnalysis.analysisLevel).toBe("State");

    const industryAnalysis = draftScope(
      "Find a regulatory shock with industry-level analysis between 2014 and 2022.",
    );
    expect(industryAnalysis.population).toBe("Industries");
    expect(industryAnalysis.analysisLevel).toBe("Industry");

    const crossLevel = draftScope(
      "Find a shock with firm-level assignment and country-level analysis between 2014 and 2022.",
    );
    expect(crossLevel.assignmentLevel).toBe("Firm");
    expect(crossLevel.analysisLevel).toBe("Country");
  });

  it("does not infer entities from words that merely contain their spelling", () => {
    const scope = draftScope(
      "The affirmative report states that companion organizations in the countryside experienced a disruption between 2014 and 2022.",
    );
    expect(scope.population).toBe("Organizations");
    expect(scope.analysisLevel).toBe("Organization");
  });

  it("leaves conflicting explicit analysis levels unresolved", () => {
    const scope = draftScope(
      "Find a shock using both firm-level analysis and country-level analysis between 2014 and 2022.",
    );
    expect(scope.analysisLevel).toBe("Not specified");
  });

  it("still recognizes an explicit state-government population", () => {
    const scope = draftScope(
      "Find a policy shock affecting U.S. state governments between 2014 and 2022.",
    );
    expect(scope.population).toBe("States");
    expect(scope.analysisLevel).toBe("State");
  });

  it("recognizes common unpunctuated geography aliases", () => {
    expect(
      draftScope(
        "Find a regulatory shock affecting companies in the US between 2014 and 2022.",
      ).geography,
    ).toBe("United States");
    expect(
      draftScope(
        "Find a regulatory shock affecting companies in the UK between 2014 and 2022.",
      ).geography,
    ).toBe("United Kingdom");
    expect(
      draftScope(
        "Find a regulatory shock affecting companies in the EU between 2014 and 2022.",
      ).geography,
    ).toBe("European Union");
  });

  it.each([
    ["US public firms", "United States"],
    ["US manufacturing firms", "United States"],
    ["US-listed firms", "United States"],
    ["U.S.-listed firms", "United States"],
    ["UK public companies", "United Kingdom"],
    ["EU technology firms", "European Union"],
    ["US-based firms", "United States"],
    ["U.S.-based firms", "United States"],
    ["UK-based companies", "United Kingdom"],
    ["EU-based companies", "European Union"],
    ["American public companies", "United States"],
  ])(
    "recognizes geography abbreviations used as noun modifiers: %s",
    (populationPhrase, geography) => {
      expect(
        draftScope(
          `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022.`,
        ).geography,
      ).toBe(geography);
    },
  );

  it("keeps an explicit study window when the sentence also names an event year", () => {
    const scope = draftScope(
      "Audit whether a 2018 regulation affected U.S. firms from 2014 to 2022.",
    );
    expect(scope.studyPeriod).toBe("2014–2022");
  });

  it.each([
    "Find a regulatory shock affecting non-U.S. public firms between 2014 and 2022 that influences profitability.",
    "Find a regulatory shock affecting public firms outside of the U.S. between 2014 and 2022 that influences profitability.",
  ])("does not invert an excluded U.S. geography: %s", (sentence) => {
    expect(draftScope(sentence).geography).toBe("Not specified");
  });

  it("does not silently include an excluded population or industry", () => {
    expect(
      draftScope(
        "Find a regulatory shock affecting firms other than public companies in Canada between 2014 and 2022 that influences profitability.",
      ).population,
    ).toBe("Not specified");
    expect(
      draftScope(
        "Find a regulatory shock affecting no public firms in Canada between 2014 and 2022 that influences profitability.",
      ).population,
    ).toBe("Not specified");
    expect(
      draftScope(
        "Find a regulatory shock affecting firms in all industries except manufacturing between 2014 and 2022 that influences profitability.",
      ).industry,
    ).toBe("Not specified");
  });

  it("uses the event clause rather than population or data nouns", () => {
    expect(
      draftScope(
        "Find a regulatory shock affecting court filings among U.S. public firms from 2014 to 2022 that may influence profitability.",
      ).eventFamily,
    ).toBe("Regulation");
    expect(
      draftScope(
        "Find a market shock affecting U.S. law firms from 2014 to 2022 that may influence profitability.",
      ).eventFamily,
    ).toBe("Market");
  });

  it.each([
    "technology adoption",
    "banking relationships",
    "energy efficiency",
    "healthcare spending",
    "retail investor reactions",
    "manufacturing productivity",
  ])("does not turn an outcome phrase into the industry: %s", (outcome) => {
    const scope = draftScope(
      `Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that may influence ${outcome}.`,
    );
    expect(scope.industry).toBe("Not specified");
  });

  it("does not equate patent litigation with innovation", () => {
    expect(
      draftScope(
        "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that may influence patent litigation.",
      ).outcomeFamily,
    ).toBe("Not specified");
  });

  it("does not interpret geographic coverage as state assignment", () => {
    expect(
      draftScope(
        "Find a uniform federal regulation affecting firms across states between 2014 and 2022 that influences profitability.",
      ).assignmentLevel,
    ).toBe("Country");
  });

  it.each([
    ["patent-level analysis", "Patent"],
    ["transaction-level analysis", "Transaction"],
    ["establishment-level data", "Establishment"],
    ["plant-level outcomes", "Plant"],
  ])("preserves an explicit non-firm analysis unit: %s", (phrase, expected) => {
    expect(
      draftScope(
        `Find a regulatory shock affecting U.S. firms with ${phrase} between 2014 and 2022 that influences profitability.`,
      ).analysisLevel,
    ).toBe(expected);
  });

  it.each([
    "daily news coverage",
    "an annual conference",
    "quarterly regulatory updates",
  ])("does not infer outcome frequency from another role: %s", (phrase) => {
    expect(
      draftScope(
        `Find a regulatory shock announced through ${phrase} affecting U.S. firms between 2014 and 2022 that influences profitability.`,
      ).outcomeFrequency,
    ).toBe("Not specified");
  });

  it.each([
    "Audit whether CCPA, not GDPR, changed profitability among U.S. firms.",
    "Audit whether either CCPA or GDPR changed profitability among U.S. firms.",
    "Audit the effect of CCPA rather than GDPR on U.S. firms.",
  ])("requires one focal shock rather than extracting a contrast: %s", (sentence) => {
    expect(extractKnownShock(sentence)).toBe("");
  });

  it.each([
    [
      "Find a regulatory shock affecting firms not in the U.S. between 2014 and 2022 that influences profitability.",
      "geography",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting firms that are not public companies in Canada between 2014 and 2022 that influences profitability.",
      "population",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting exchange-listed firms apart from U.S. firms between 2014 and 2022 that influences profitability.",
      "geography",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting exchange-listed firms without U.S. firms between 2014 and 2022 that influences profitability.",
      "geography",
      "Not specified",
    ],
    [
      "Find a shock affecting all firms but public companies in Canada between 2014 and 2022 that influences profitability.",
      "population",
      "Not specified",
    ],
    [
      "Find a shock affecting firms in all industries but manufacturing between 2014 and 2022 that influences innovation.",
      "industry",
      "Not specified",
    ],
    [
      "Find a shock affecting firms in all industries save manufacturing between 2014 and 2022 that influences innovation.",
      "industry",
      "Not specified",
    ],
  ] as const)(
    "does not carry an explicitly excluded boundary: %s",
    (sentence, key, expected) => {
      expect(draftScope(sentence)[key]).toBe(expected);
    },
  );

  it.each(["North", "Latin", "Central", "South"])(
    "does not reinterpret %s American as United States",
    (region) => {
      expect(
        draftScope(
          `Find a regulatory shock affecting ${region} American public firms between 2014 and 2022 that influences profitability.`,
        ).geography,
      ).toBe("Not specified");
    },
  );

  it.each([
    [
      "Find a regulatory shock affecting U.S. firms connected to the ruling party between 2014 and 2022 that influences profitability.",
      "eventFamily",
      "Regulation",
    ],
    [
      "Find a policy change affecting U.S. firms that sell earthquake insurance between 2014 and 2022 and measure profitability.",
      "eventFamily",
      "Policy",
    ],
    [
      "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that influences technology adoption among firms.",
      "industry",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that influences firms investment in technology.",
      "industry",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that influences energy efficiency in firms.",
      "industry",
      "Not specified",
    ],
    [
      "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that influences healthcare spending by firms.",
      "industry",
      "Not specified",
    ],
  ] as const)(
    "keeps target and context nouns out of unrelated fields: %s",
    (sentence, key, expected) => {
      expect(draftScope(sentence)[key]).toBe(expected);
    },
  );

  it.each([
    "Find a national policy implemented across states affecting firms between 2014 and 2022 that influences profitability.",
    "Find a national law enacted across states affecting firms between 2014 and 2022 that influences profitability.",
    "Find a nationwide regulation adopted across states affecting firms between 2014 and 2022 that influences profitability.",
  ])("preserves national assignment despite cross-state coverage: %s", (sentence) => {
    expect(draftScope(sentence).assignmentLevel).toBe("Country");
  });

  it.each([
    ["claim-level analysis", "Claim"],
    ["contract-level data", "Contract"],
    ["order-level observations", "Order"],
    ["product-level analysis", "Product"],
    ["alliance-level analysis", "Alliance"],
    ["dyad-level analysis", "Dyad"],
    ["city-level analysis", "City"],
    ["municipality-level data", "Municipality"],
  ])("preserves the explicit analysis unit %s", (phrase, expected) => {
    expect(
      draftScope(
        `Find a regulatory shock affecting U.S. firms using ${phrase} between 2014 and 2022 that influences profitability.`,
      ).analysisLevel,
    ).toBe(expected);
  });

  it.each([
    [
      "Find a regulatory shock affecting U.S. firms where the units of analysis are patents between 2014 and 2022.",
      "Patent",
    ],
    [
      "Find a regulatory shock affecting U.S. firms where the unit of observation is a transaction between 2014 and 2022.",
      "Transaction",
    ],
    [
      "Find a regulatory shock affecting U.S. firms with analysis conducted at the plant level between 2014 and 2022.",
      "Plant",
    ],
  ])("recognizes explicit analysis-role syntax: %s", (sentence, expected) => {
    expect(draftScope(sentence).analysisLevel).toBe(expected);
  });

  it.each([
    "Find a regulatory shock affecting U.S. public firms between 2014 and 2022 that influences profitability, using daily news coverage as a control.",
    "Find a policy shock affecting U.S. public firms between 2014 and 2022 that influences profitability during an annual conference period.",
  ])("does not treat a contextual frequency as outcome frequency: %s", (sentence) => {
    expect(draftScope(sentence).outcomeFrequency).toBe("Not specified");
  });

  it("recognizes a frequency attached directly to the outcome", () => {
    const scope = draftScope(
      "Find a regulatory shock affecting U.S. public firms between 2014 and 2022, with daily profitability outcomes.",
    );
    expect(scope.outcomeFamily).toBe("Profitability");
    expect(scope.outcomeFrequency).toBe("Daily");
  });

  it.each([
    "U.S. public relations firms",
    "U.S. public accounting firms",
    "U.S. public utility companies",
    "U.S. public benefit corporations",
    "U.S. private equity firms",
  ])("does not infer ownership from an industry label: %s", (populationPhrase) => {
    expect(
      draftScope(
        `Find a regulatory shock affecting ${populationPhrase} between 2014 and 2022 that influences profitability.`,
      ).population,
    ).toBe("Firms");
  });

  it.each([
    "Audit whether Hurricane Katrina and Hurricane Rita affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.",
    "Audit whether Hurricane Katrina alongside Hurricane Rita affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.",
    "Audit whether Hurricane Katrina or Hurricane Rita affected U.S. exchange-listed manufacturing firms from 2014 to 2022 and influenced profitability.",
    "Audit whether the New York pay-transparency law and the California pay-transparency law affected hiring among U.S. firms.",
    "Audit whether CCPA and the Virginia Consumer Data Protection Act changed profitability among U.S. firms.",
    "Audit whether CPRA alongside SOX affected innovation among U.S. public firms.",
  ])("requires exactly one named shock: %s", (sentence) => {
    expect(hasMultipleKnownShockCandidates(sentence)).toBe(true);
    expect(extractKnownShock(sentence)).toBe("");
  });
});
