import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { openScreen3, openScreen4 } from "../../src/core/six-screen/workflow";
import { screen3ContextualPacket, SCREEN3_CONTEXTUALIZER_VERSION,
  SCREEN3_DESIGN_DIMENSIONS } from
  "../../src/worker/screen3-contextualizer";
import { screen3LegacyContextualPacket } from
  "../../src/worker/screen3-legacy-packet";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

describe("Screen 3 durable contextualization", () => {
  it("saves a sourced critique and reopens the same scientific task offline", async () => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study: {
        population: "U.S. public firms", analysisUnit: "firm-year",
        geography: ["United States", "California"], industry: ["Retail"],
        period: { start: "2010", end: "2025" },
        outcome: "Firm performance", outcomeMeasure: "ROA",
        intendedConstruct: "Firm performance",
        policySideConcept: "Transparency",
        initialExplanation: "Customer response",
        proposedTreatment: "California firms",
        proposedComparison: "Non-California firms",
        resultsPreviouslyInspected: "not_disclosed",
      },
      proposedTiming: { mode: "year", year: 2023,
        milestoneReference: null },
      openedAt: "2026-09-24T12:00:00.000Z",
    });
    const advice = opened.state.studyDesignAdvices!.at(-1)!;
    const packet = screen3ContextualPacket(opened.state, advice);
    const sourceClaimId = packet.policy.claims.find((claim) =>
      claim.kind === "coverage_condition")!.id;
    const wire = {
      schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
      concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension, index) => ({
        issue_id: dimension.id,
        specific_heading: dimension.heading,
        status_label: index === 0 ? "Treatment clock needs review" :
          "Requires design evidence",
        relevant_fact_or_proposal: index === 0
          ? "The retained policy source describes coverage conditions and the proposed 2023 treatment clock."
          : `The saved proposal supplies inputs for ${dimension.heading.toLowerCase()}.`,
        why_it_matters: "This condition can change the interpretation of the California comparison and firm-performance outcome.",
        unresolved_question: "What does the firm-level evidence show?",
        next_check: "Compare dated firm operations and group-period records with the saved rule.",
        check_limit: "This check does not prove comparable untreated outcomes.",
        priority: index < 2 ? "high" as const : "medium" as const,
        priority_reason: "The geographic comparison depends on this condition.",
        documentary_claim_ids: index === 0 ? [sourceClaimId] : [],
        researcher_input_fields: ["proposedTreatment"],
      })),
      synthesis_limit: "Coverage alone does not establish comparable outcomes.",
    };
    const laterView = openScreen4(opened.state, {
      expectedRevision: opened.state.revision,
      openedAt: "2026-09-24T12:00:01.000Z",
    });
    expect(laterView.state.activeScreen).toBe(4);
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    await store.create({ state: laterView.state, accessToken,
      createInputFingerprint: fingerprintSixScreenValue("screen3-recovery"),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-25T12:00:00.000Z" });
    const providerFetch = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_screen3_sourced", object: "response", status: "completed",
      model: "gpt-6-luna", service_tier: "default",
      output: [{ id: "msg_screen3_sourced", type: "message",
        role: "assistant", status: "completed", content: [{
          type: "output_text", annotations: [], text: JSON.stringify(wire),
        }] }],
      usage: { input_tokens: 1_500, output_tokens: 600,
        total_tokens: 2_100,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 120 } },
    }), { headers: { "content-type": "application/json" } }));
    const sourceFetch = vi.fn(async () => {
      throw new Error("No source request is needed for the saved critique.");
    });
    let tick = 41;
    const runtime = new SixScreenWorkflowRuntime({
      store, signingKey: "screen-3-runtime-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: sourceFetch,
      screen5OpenAIMode: "local-preview",
      screen5OpenAIApiKey: "test-key-never-projected",
      screen5OpenAIFetch: providerFetch,
      screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    });
    const authentication = { runId, accessToken };
    const first = await runtime.personalizeScreen3(authentication, {
      expectedRevision: laterView.state.revision,
      operationId: "screen3-sourced-critique",
      expectedAdviceFingerprint: advice.adviceFingerprint,
    });
    expect(first.projection.causalComparisonWorkspace.studyFirst.contextualization)
      .toMatchObject({ status: "completed", supplement: wire,
        dispatchState: "dispatched", failureCode: null });
    expect(first.privateSnapshot.state.activeScreen).toBe(4);
    expect(first.privateSnapshot.state.screen3Contextualizations?.[0])
      .toMatchObject({ status: "completed", dispatchState: "dispatched",
        receipt: { providerResponseId: "resp_screen3_sourced" } });
    // Recreate the exact durable state left by the previous strict local
    // validator: the provider receipt is saved, but harmless ordering,
    // duplicate references, and prose-length variation quarantined it.
    const recoverableWire = {
      ...wire,
      concerns: wire.concerns.map((item) => ({
        ...item,
        why_it_matters: `${item.why_it_matters} ${"detail ".repeat(140)}`,
        researcher_input_fields: [
          ...item.researcher_input_fields,
          ...item.researcher_input_fields,
        ],
      })).reverse(),
    };
    const recoverableText = JSON.stringify(recoverableWire);
    const quarantined = await store.mutate({
      runId, accessToken, expectedRevision: first.privateSnapshot.revision,
      operationId: "screen3-test-saved-benign-wire-variation",
      operationKind: "test_screen3_saved_benign_wire_variation",
      inputFingerprint: fingerprintSixScreenValue("saved-benign-wire"),
      updatedAt: browserEventCardFixtureAt(tick++),
    }, (state) => {
      const saved = state.screen3Contextualizations!.at(-1)!;
      saved.status = "validation_failed";
      saved.supplement = null;
      saved.failureCode = "local_receipt_validation_failed";
      saved.failureStage = "model_output";
      saved.error = "Screen 3 saved response did not pass local validation.";
      saved.receipt!.finalContent = recoverableText;
      saved.receipt!.contentFingerprint = fingerprintSixScreenValue(
        recoverableText,
      );
      const at = browserEventCardFixtureAt(tick++);
      saved.updatedAt = at;
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: "Synthetic saved Screen 3 receipt awaiting local recheck." });
      return { state, result: null };
    });
    expect(quarantined.outcome).toBe("updated");
    if (quarantined.outcome !== "updated") {
      throw new Error("Expected the saved receipt fixture to update.");
    }
    const offline = new SixScreenWorkflowRuntime({
      store, signingKey: "screen-3-runtime-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++), fetch: sourceFetch,
    });
    const reopened = await offline.personalizeScreen3(authentication, {
      expectedRevision: quarantined.record.state.revision,
      operationId: "screen3-reopen-without-provider",
      expectedAdviceFingerprint: advice.adviceFingerprint,
    });
    expect(reopened.projection.causalComparisonWorkspace.studyFirst.contextualization)
      .toMatchObject({ status: "completed", retryEligibility: "none" });
    const restoredConcern = (reopened.privateSnapshot.state
      .screen3Contextualizations?.at(-1)?.supplement as typeof wire)
      .concerns[0]!;
    expect(restoredConcern).toMatchObject({ issue_id: "treatment_year_fit",
      researcher_input_fields: ["proposedTreatment"] });
    expect(restoredConcern.why_it_matters.length).toBe(750);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(sourceFetch).not.toHaveBeenCalled();

    // Recreate a v23 saved artifact with its exact historical packet binding.
    // A read-only open must show it without dispatching a v3 request.
    const legacyWire = {
      concerns: [{ rule_id: advice.warnings[0]!.ruleId,
        study_specific_reason: "The proposed groups require eligibility mapping.",
        known_from_sources: "The retained source describes covered operators.",
        unresolved_question: "Which firms met the historical rule?",
        next_check: "Compare dated firm activity with the admitted rule.",
        documentary_claim_ids: [sourceClaimId],
        researcher_input_fields: ["proposedTreatment"] }],
      synthesis_limit: "This older critique does not establish exposure.",
    };
    const legacyPacketFingerprint = fingerprintSixScreenValue(
      screen3LegacyContextualPacket(reopened.privateSnapshot.state, advice));
    const legacy = await store.mutate({
      runId, accessToken, expectedRevision: reopened.privateSnapshot.revision,
      operationId: "screen3-test-v23-compatibility",
      operationKind: "test_screen3_v23_packet_compatibility",
      inputFingerprint: fingerprintSixScreenValue("v23-packet-compatibility"),
      updatedAt: browserEventCardFixtureAt(tick++),
    }, (state) => {
      const saved = state.screen3Contextualizations![0]!;
      saved.packetFingerprint = legacyPacketFingerprint;
      saved.supplement = legacyWire;
      const oldText = JSON.stringify(legacyWire);
      saved.receipt!.finalContent = oldText;
      saved.receipt!.contentFingerprint = fingerprintSixScreenValue(oldText);
      // Contextualization retains the raw receipt (status received) even
      // after its separately validated supplement was saved.
      saved.receipt!.wireFingerprint = null;
      const at = browserEventCardFixtureAt(tick++);
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: "Synthetic v23 packet-bound saved critique." });
      return { state, result: null };
    });
    expect(legacy.outcome).toBe("updated");
    if (legacy.outcome !== "updated") throw new Error("Expected legacy variant.");
    const oldRead = await offline.status(authentication);
    expect(oldRead.projection.causalComparisonWorkspace.studyFirst.contextualization)
      .toMatchObject({ status: "completed", supplement: legacyWire });
    expect(providerFetch).toHaveBeenCalledTimes(1);

    // The source snapshot ID can remain the same while reviewed claim content
    // changes. The exact admitted packet, rather than its snapshot ID alone,
    // must control any subsequent use of the model attempt.
    const snapshotFingerprint = reopened.privateSnapshot.state.policyReview
      ?.evidenceSnapshotFingerprint;
    const changed = await store.mutate({
      runId, accessToken, expectedRevision: legacy.record.state.revision,
      operationId: "screen3-same-snapshot-review-change",
      operationKind: "test_screen3_same_snapshot_review_change",
      inputFingerprint: fingerprintSixScreenValue("review-claim-edited"),
      updatedAt: browserEventCardFixtureAt(tick++),
    }, (state) => {
      const claim = state.policyReview!.claims.find((item) =>
        item.claimId === sourceClaimId)!;
      claim.statement += " The retained wording was revised after authorization.";
      const at = browserEventCardFixtureAt(tick++);
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: "Synthetic same-snapshot claim revision for recovery test." });
      return { state, result: null };
    });
    expect(changed.outcome).toBe("updated");
    if (changed.outcome !== "updated") throw new Error("Expected edited review.");
    expect(changed.record.state.policyReview?.evidenceSnapshotFingerprint)
      .toBe(snapshotFingerprint);
    const revised = await runtime.personalizeScreen3(authentication, {
      expectedRevision: changed.record.state.revision,
      operationId: "screen3-new-task-after-review-changed",
      expectedAdviceFingerprint: advice.adviceFingerprint,
    });
    expect(revised.privateSnapshot.state.screen3Contextualizations)
      .toHaveLength(2);
    const [archived, current] = revised.privateSnapshot.state
      .screen3Contextualizations!;
    expect(archived.adviceFingerprint).toBe(current.adviceFingerprint);
    expect(archived.packetFingerprint).not.toBe(current.packetFingerprint);
    expect(archived.id).not.toBe(current.id);
    expect(archived).toMatchObject({ status: "completed",
      attemptOrdinal: 1 });
    expect(current).toMatchObject({ status: "completed",
      attemptOrdinal: 1 });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });
});
