import { describe, expect, it } from "vitest";

import { evaluateScreen03Scenario, projectAuditStartingSource } from "../../scripts/verify-production-matrix.mjs";
import { createScreen02AuditState } from "../../src/core/screen02-workflow-state";
import { reviseScreen02AuditAnchor } from "../../src/core/screen02-audit-workflow";
import { confirmedWorkflowAuditContext, fixtureAt } from "../core/screen02-workflow-fixtures";

const secondaryLocator = "https://en.wikipedia.org/wiki/California_Consumer_Privacy_Act";
const officialLocator = "https://oag.ca.gov/privacy/ccpa";
const input = {
  scenario: "secondary-start", claimGroup: "identity",
  targetTerms: ["California Consumer Privacy Act"],
  anchor: { sourceLocator: secondaryLocator },
};

function observation() {
  const initial = createScreen02AuditState(confirmedWorkflowAuditContext(), "private-start-run", fixtureAt);
  const revised = reviseScreen02AuditAnchor(initial, {
    anchorRevisionId: "private-start-anchor", successorMatchSetSnapshotId: "private-start-matches",
    decisionId: "private-start-decision", fields: { sourceLocator: secondaryLocator },
    at: fixtureAt, reason: "Use this secondary URL only as an unverified discovery starting point.",
  });
  return {
    startingSource: projectAuditStartingSource(revised),
    initial: {
      eventIdentity: { canonicalTitle: "California Consumer Privacy Act" },
      contextLeads: [] as Array<{ locator: string; sourceRole: string; status: string }>,
      initialSources: [{
        locator: officialLocator, authorityTier: 2, status: "retrieved",
        passageBases: ["official-guidance-passage"],
      }],
      proposals: [{
        group: "identity", support: "direct", passages: [{
          locator: officialLocator, authorityTier: 2, basis: "official-guidance-passage",
        }],
      }],
      research: { status: "completed" },
    },
  };
}

describe("secondary-start production predicate preserves the evidence boundary", () => {
  it("accepts actual anchor retention plus later direct official identity without requiring secondary evidence", () => {
    const actual = observation();
    expect(actual.startingSource.anchorLocator).toBe(secondaryLocator);
    expect(JSON.stringify(actual.startingSource)).not.toMatch(/private-start/u);
    expect(actual.initial.initialSources.some((source) => source.locator === secondaryLocator)).toBe(false);
    expect(evaluateScreen03Scenario(input, actual)).toEqual({ status: "passed", reasons: [] });
  });

  it("also accepts actual unverified context retention but not the requested URL alone", () => {
    const actual = observation();
    actual.startingSource.anchorLocator = null;
    expect(evaluateScreen03Scenario(input, actual).status).toBe("failed");
    actual.initial.contextLeads.push({ locator: secondaryLocator, sourceRole: "contextual-secondary", status: "unverified" });
    expect(evaluateScreen03Scenario(input, actual).status).toBe("passed");
    actual.initial.contextLeads[0]!.locator = "https://en.wikipedia.org/wiki/Unrelated_event";
    expect(evaluateScreen03Scenario(input, actual).status).toBe("failed");
  });

  it("rejects promoted secondary metadata even when separate official direct support exists", () => {
    const actual = observation();
    actual.initial.initialSources.push({
      locator: secondaryLocator, authorityTier: 6, status: "carried", passageBases: ["source-metadata"],
    });
    const result = evaluateScreen03Scenario(input, actual);
    expect(result.status).toBe("failed");
    expect(result.reasons).toContain("The secondary discovery lead was promoted to evidence or direct identity support.");
  });

  it("rejects secondary direct identity and inactive or generic official metadata", () => {
    for (const change of ["secondary-identity", "changed-source", "generic-metadata"]) {
      const actual = observation();
      if (change === "secondary-identity") {
        actual.initial.proposals[0]!.passages[0]!.locator = secondaryLocator;
      } else if (change === "changed-source") {
        actual.initial.initialSources[0]!.status = "changed";
      } else {
        actual.initial.proposals[0]!.passages[0]!.basis = "source-metadata";
      }
      expect(evaluateScreen03Scenario(input, actual).status, change).toBe("failed");
    }
  });
});
