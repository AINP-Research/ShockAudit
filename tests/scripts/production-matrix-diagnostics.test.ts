import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertConfirmedContext,
  assertPreservedCacheLanes,
  assertToolSuccess,
  projectCaseFailure,
  projectScopeConfirmation,
  projectScreen02Diagnostics,
  projectScreen02Result,
  qualificationLaneIndex,
  recordCaseProgress,
  runSelectedCase,
  sanitizeText,
} from "../../scripts/verify-production-matrix.mjs";
import { confirmScopeContract } from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { createScreen02FindState } from "../../src/core/screen02-workflow-state";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import { beginScreen02FindDiscovery, completeScreen02FindDiscovery } from "../../src/core/screen02-find-workflow";
import { buildScreen02SearchFunnel } from "../../src/core/screen02-find-discovery";
import {
  buildScreen02RetainedResultBinding,
  buildScreen02RetrievalExecution,
} from "../../src/core/screen02-workflow-types";
import {
  buildFixedQualifiedFindState,
  confirmedWorkflowFindContext,
  fixtureAt,
  workflowManifest,
} from "../core/screen02-workflow-fixtures";

function emptyCompletedSearch() {
  const context = confirmedWorkflowFindContext();
  const initial = createScreen02FindState(context, "private-run", fixtureAt);
  const request = {
    discoveryRequestId: "private-request",
    searchRoundId: "private-round",
    candidateSetSnapshotId: "private-set",
    exactRequest: "Find a source-qualified privacy regulation.",
    at: fixtureAt,
  };
  const manifest = workflowManifest(request.exactRequest);
  manifest.queryMatrix[0]!.returnedRecordIds = [];
  manifest.funnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved: 0, uniqueEventLeads: 0,
    qualifications: [], displayedCandidates: 0,
  });
  manifest.retrievalExecution = buildScreen02RetrievalExecution({
    baseline: {
      phase: "baseline",
      status: "completed",
      queryIds: [manifest.queryMatrix[0]!.id],
      stoppingReason: "routes-exhausted",
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      roundsExecuted: 1,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    },
  });
  manifest.retainedResultBinding = buildScreen02RetainedResultBinding(
    "find",
    { sourceRecordsRetrieved: 0, uniqueEventLeads: 0 },
    [],
  );
  const state = completeScreen02FindDiscovery(beginScreen02FindDiscovery(initial, request), {
    discoveryRequestId: request.discoveryRequestId, at: fixtureAt,
    sources: [], candidates: [], manifest,
  });
  const stateEnvelope = encodeScreen02FindWorkflowStateEnvelope(state);
  return {
    state,
    input: { caseId: "s2-offline-empty", expectedMode: "positive-journey", scope: context.scopeContract },
    snapshot: {
      mode: "find", runId: state.runId, revision: state.revision,
      stateFingerprint: stateEnvelope.checksum, stateEnvelope,
    },
  };
}

describe("production matrix failure diagnostics", () => {
  it("reports continuation only from the authenticated snapshot and distinguishes unobserved state", () => {
    const { state } = emptyCompletedSearch();
    expect(projectScreen02Diagnostics(state, "find").continuationReady).toBeNull();
    expect(projectScreen02Diagnostics(state, "find", { handoff: null }).continuationReady).toBe(false);
    expect(projectScreen02Diagnostics(state, "find", { handoff: { destinationScreen: "screen-03" } }).continuationReady).toBe(true);
  });
  it("retains completed empty-search counts and last operation without passing its unchanged positive predicate", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "shockaudit-matrix-diagnostic-"));
    try {
      const { state, input, snapshot } = emptyCompletedSearch();
      const selected = { suite: "screen2" as const, input: { ...input, label: "Offline empty search" } };
      const checkpoint = await runSelectedCase(selected, directory, async () => {
        await recordCaseProgress("screen2:find:find-search:search-1", {
          completed: true, observations: { screen2: projectScreen02Diagnostics(state, "find") },
        });
        const running = JSON.parse(await readFile(path.join(directory, "cases", `${input.caseId}.json`), "utf8"));
        expect(running.status).toBe("running");
        expect(running.observations.screen2.funnel.displayedCandidates).toBe(0);
        await recordCaseProgress("screen2:find:validate-first-search");
        projectScreen02Result(input, snapshot);
        throw new Error("The positive-count assertion unexpectedly passed.");
      });
      expect(checkpoint.status).toBe("failed");
      expect(checkpoint.failureCode, checkpoint.failure).toBe("find-display-contract-failed");
      expect(checkpoint.lastSuccessfulStep).toBe("screen2:find:find-search:search-1");
      expect(checkpoint.operation).toBe("screen2:find:validate-first-search");
      const diagnostic = checkpoint.observations.screen2 as ReturnType<typeof projectScreen02Diagnostics>;
      expect(diagnostic.funnel).toMatchObject({
        sourceRecordsRetrieved: 0, qualifiedCandidates: 0, displayedCandidates: 0,
      });
      expect(diagnostic.sourceRoutes[0]!.status).toBe("searched");
      const text = await readFile(path.join(directory, "cases", `${input.caseId}.json`), "utf8");
      expect(text).not.toMatch(/private-run|private-request|private-round|private-set|stateEnvelope|sealedState|rawState/u);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("distinguishes an actual producer confirmation refusal from scope alteration", () => {
    const base = confirmedWorkflowFindContext();
    const input = {
      caseId: "s2-offline-refusal", sentence: base.studySentence,
      scope: { ...base.scopeContract, analysisLevel: "Not specified" },
    };
    const confirmation = confirmScopeContract({
      revision: 1, mode: "find", sentence: input.sentence,
      contractSourceSentence: input.sentence, scope: input.scope,
      knownShock: "", resolvedKeys: base.resolvedKeys,
      acknowledgedDifferences: [], scopeDirty: false,
    });
    expect(confirmation.ok).toBe(false);
    const result = {
      content: [{ type: "text", text: confirmation.error }],
      structuredContent: { studyContext: buildScreen01StudyContext(confirmation.state, confirmation.ambiguities) },
    };
    const projection = projectScopeConfirmation(input, result);
    expect(projection.returnedScope).toEqual(input.scope);
    expect(projection.unresolvedDecisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "analysisLevel" }),
    ]));
    expect(() => assertConfirmedContext(input, "find", result))
      .toThrow(expect.objectContaining({ code: "scope-confirmation-refused" }));
    result.structuredContent.studyContext.scopeContract.geography = "Changed geography";
    expect(() => assertConfirmedContext(input, "find", result))
      .toThrow(expect.objectContaining({ code: "scope-contract-changed" }));
  });

  it("retains bounded public tool errors while excluding sealed payloads, identifiers and response keys", () => {
    const secret = "a".repeat(43);
    let caught;
    try {
      assertToolSuccess({
        isError: true,
        content: [{ type: "text", text: `Evidence contract failed. responseKey=${secret} run s2r_${"b".repeat(43)} ${"detail ".repeat(300)}` }],
        structuredContent: { sealedState: secret },
        _meta: { accessToken: secret },
      }, "Screen 2 audit revise-anchor");
    } catch (error) { caught = error; }
    const failure = projectCaseFailure(caught);
    expect(failure.failureCode).toBe("mcp-tool-error");
    expect(failure.publicFailureMessage).toContain("Evidence contract failed.");
    expect(failure.publicFailureMessage!.length).toBeLessThanOrEqual(800);
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(JSON.stringify(failure)).not.toContain("b".repeat(43));
    expect(JSON.stringify(failure)).not.toMatch(/sealedState|accessToken/u);
  });

  it("redacts identifiers and fingerprints embedded in diagnostic prose without erasing evidence categories", () => {
    const message = "Source screen03-evidence-reviewed-gdpr-regulation-2016-679-bd92d937 changed and requires renewed retrieval and review. Fingerprint fnv1a64:1234567890abcdef.";
    expect(sanitizeText(message)).toBe(
      "Source [identifier-redacted] changed and requires renewed retrieval and review. Fingerprint [fingerprint-redacted].",
    );
    const state = structuredClone(buildFixedQualifiedFindState());
    const source = state.sources[0]!;
    projectScreen02Diagnostics(state, "find");
    expect(sanitizeText(`The retained source ${source.id} changed.`)).toBe(
      "The retained source [identifier-redacted] changed.",
    );
    expect(sanitizeText("source-metadata; source-quality-failed; Regulation (EU) 2016/679"))
      .toBe("source-metadata; source-quality-failed; Regulation (EU) 2016/679");
  });

  it("compares cached exclusions and displayed entries to their original source lanes", () => {
    const state = structuredClone(buildFixedQualifiedFindState());
    const first = state.candidates[0]!;
    const active = state.candidateSets.find((item) => item.candidateSetSnapshotId === state.activeCandidateSetSnapshotId)!;
    active.manifest.exclusions.push({
      recordId: "excluded-private-candidate", reason: "Fixed qualification rejected this lead.",
      qualification: { ...first.qualification!, candidateId: "excluded-private-candidate", lane: "official-source" },
    });
    const firstLanes = qualificationLaneIndex(state);
    const entries = [
      { candidateId: first.candidateId, lane: first.qualification!.lane },
      { candidateId: "excluded-private-candidate", lane: "official-source" },
    ];
    expect(() => assertPreservedCacheLanes(firstLanes, entries, "s2-cache")).not.toThrow();
    expect(() => assertPreservedCacheLanes(firstLanes, [
      { ...entries[1]!, lane: "reviewed-registry" },
    ], "s2-cache")).toThrow(expect.objectContaining({ code: "qualification-cache-source-lane-changed" }));
    expect(() => assertPreservedCacheLanes(firstLanes, [
      { candidateId: "never-evaluated", lane: "official-source" },
    ], "s2-cache")).toThrow(/changed an original source lane/u);
  });
});
