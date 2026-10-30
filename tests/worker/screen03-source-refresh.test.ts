import { expect, it } from "vitest";

import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { fingerprintScreen02WorkflowState } from "../../src/core/screen02-workflow-state";
import {
  buildScreen03StateFromResearch,
  refreshScreen03StateFromResearch,
  restoreScreen03VerificationState,
} from "../../src/core/screen03-workflow";
import { researchScreen03Evidence } from "../../src/worker/screen03-evidence-service";
import {
  createInitialScreen02WorkflowState,
  applyScreen02WorkflowAction,
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
} from "../../src/worker/screen02-workflow-controller";
import { confirmedWorkflowAuditContext } from "../core/screen02-workflow-fixtures";
import {
  deterministicConnectorFetch,
  advanceBrowserFixtureScreen03Evidence,
} from "../browser/fixture-worker";

it("refreshes real Audit research when both official CCPA sources remove a passage", async () => {
  let tick = 0;
  const options = {
    now: () => new Date(Date.parse("2026-09-01T11:00:00.000Z") + tick++ * 1000).toISOString(),
    createId: (kind: string) => `source-refresh-${kind}-${tick++}`,
    signingConfig: null,
    legacyHostAssessments: false,
  };
  let audit = createInitialScreen02WorkflowState(
    confirmedWorkflowAuditContext(), "source-refresh-audit", options.now(), options,
  );
  if (audit.mode !== "audit") throw new Error("Expected Audit");
  const match = audit.possibleMatches.find((candidate) =>
    candidate.identity.canonicalTitle.includes("California Consumer Privacy Act")
  );
  expect(match).toBeDefined();
  for (const action of ["audit-open", "audit-confirm", "audit-continue"] as const) {
    audit = (await applyScreen02WorkflowAction(audit, {
      schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
      operationId: `source-refresh-${action}`, runId: audit.runId,
      accessToken: "fixture-controller-token", expectedRevision: audit.revision,
      expectedStateFingerprint: fingerprintScreen02WorkflowState(audit), action,
      payload: action === "audit-continue" ? {} : {
        matchSnapshotId: match!.matchSnapshotId, reason: "Explicit fixture review",
      },
    }, options)).state;
  }
  const handoff = buildScreen02WorkflowHandoff(audit, "0.4.04", "2026-09-01T12:00:00.000Z");
  const revision = advanceBrowserFixtureScreen03Evidence();
  expect(revision % 2).toBe(1);
  const odd = await researchScreen03Evidence({
    handoff, retrievedAt: "2026-09-01T12:00:01.000Z", fetch: deterministicConnectorFetch,
  });
  const state = buildScreen03StateFromResearch(handoff, odd, "2026-09-01T12:00:02.000Z");
  expect(advanceBrowserFixtureScreen03Evidence()).toBe(revision + 1);
  const even = await researchScreen03Evidence({
    handoff, retrievedAt: "2026-09-01T12:00:03.000Z", fetch: deterministicConnectorFetch,
  });
  const refreshed = refreshScreen03StateFromResearch(state, handoff, even, "2026-09-01T12:00:04.000Z");
  expect(refreshed.status).toBe("reviewing");
  expect(refreshed.revision).toBeGreaterThan(state.revision);
  const changedRecords = refreshed.sourceChanges!.filter((record) =>
    record.trigger === "research-refresh"
  );
  expect(changedRecords).toHaveLength(2);
  for (const record of changedRecords) {
    expect(record.staleEvidenceIds).toHaveLength(1);
    expect(record.staleProposals.length).toBeGreaterThan(0);
    const archived = refreshed.evidence.find((item) => record.staleEvidenceIds.includes(item.id))!;
    const active = refreshed.evidence.find((item) => item.status !== "changed" && item.sourceId === archived.sourceId)!;
    expect(archived.passages.length).toBeGreaterThan(active.passages.length);
    expect(archived.status).toBe("changed");
    expect(archived.passages.every((passage) => passage.status === "stale")).toBe(true);
  }
  expect(restoreScreen03VerificationState(JSON.parse(JSON.stringify(refreshed))))
    .toEqual(refreshed);
});
