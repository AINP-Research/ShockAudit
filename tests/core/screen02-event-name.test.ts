import { describe, expect, it } from "vitest";

import { screen02EventWordingMatches } from "../../src/core/screen02-event-name";

describe("screen02EventWordingMatches", () => {
  it("preserves exact wording across punctuation and an optional trailing year", () => {
    expect(screen02EventWordingMatches(
      "Global Market-Resilience Act of 2021",
      "Global Market Resilience Act",
    )).toBe(true);
  });

  it("supports a bounded initialism without an event-specific alias table", () => {
    expect(screen02EventWordingMatches(
      "GMRA",
      "Global Market Resilience Act",
    )).toBe(true);
  });

  it("does not collapse materially different event names", () => {
    expect(screen02EventWordingMatches(
      "Global Market Resilience Act",
      "Global Maritime Resilience Act",
    )).toBe(false);
  });
});
