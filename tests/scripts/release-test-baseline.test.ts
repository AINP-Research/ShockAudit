import { describe, expect, it } from "vitest";

import {
  releaseTestFailureKeys,
  validateReleaseTestReport,
} from "../../scripts/run-release-test-baseline.mjs";

const baseline = {
  schemaVersion: "shockaudit-release-test-baseline-v1",
  minimumTotalTests: 2,
  expectedFailureCount: 1,
  expectedFailures: [
    "tests/example.test.ts :: example suite retained expectation",
  ],
};

function report(fullName = "example suite retained expectation") {
  return {
    numTotalTests: 2,
    numFailedTests: 1,
    testResults: [{
      name: `${process.cwd()}/tests/example.test.ts`,
      status: "failed",
      assertionResults: [{ status: "failed", fullName }],
    }],
  };
}

describe("release test baseline", () => {
  it("accepts only the exact pinned failure set", () => {
    expect(releaseTestFailureKeys(report())).toEqual(
      baseline.expectedFailures,
    );
    expect(validateReleaseTestReport(report(), baseline).issues).toEqual([]);
  });

  it("rejects any additional failure", () => {
    const changed = report("example suite new regression");
    const result = validateReleaseTestReport(changed, baseline);
    expect(result.issues.join("\n")).toContain("Unexpected release-test failures");
  });

  it("requires explicit cleanup when a pinned failure changes or passes", () => {
    const changed = report("example suite new regression");
    const result = validateReleaseTestReport(changed, baseline);
    expect(result.issues.join("\n")).toContain("Baseline failures changed or passed");
  });
});
