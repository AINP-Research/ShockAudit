import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { expect, it, vi } from "vitest";
import { createBrowserEventCardFixture, browserEventCardFixtureRunId as runId,
  browserEventCardFixtureAccessToken as accessToken } from "../browser/six-screen-event-card-review-fixture";
import { completeReportFixture } from "../fixtures/complete-report";
import { openScreen3, decideStudyDesignAdvice } from "../../src/core/six-screen/workflow";
import { currentStudyDesignAdvice } from "../../src/core/six-screen/study-design-advice";
import { fingerprintSixScreenValue } from "../../src/core/six-screen/canonical";
import { SixScreenWorkflowRuntime } from "../../src/worker/six-screen-workflow-runtime";
import { SixScreenWorkflowStore, InMemorySixScreenWorkflowStorage } from "../../src/worker/six-screen-workflow-store";
import { registerSixScreenWorkflowTools } from "../../src/worker/six-screen-tools";
import { SixScreenResearchTaskStore } from "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from "../../src/worker/six-screen-evidence-store";

it.each(["empty", "records"])("serializes the first Screen 4 source scan after selecting a study comparison (%s)", async (sourceMode) => {
  const at = "2026-09-30T10:00:00.000Z";
  const fixture = createBrowserEventCardFixture();
  const { revision: _, ...study } = completeReportFixture().study;
  let state = openScreen3(fixture.state, { expectedRevision: fixture.state.revision,
    study, proposedTiming: { mode: "year", year: 2020, milestoneReference: null }, openedAt: at }).state;
  const advice = currentStudyDesignAdvice(state)!;
  const method = advice.options.find((option) => option.family === "difference_in_differences")!;
  state = decideStudyDesignAdvice(state, { expectedRevision: state.revision,
    adviceId: advice.adviceId, expectedAdviceFingerprint: advice.adviceFingerprint,
    decision: { mode: "selected", optionId: method.optionId },
    rationale: "Use this comparison for review.", selectedAt: at }).state;
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({ state, accessToken, createInputFingerprint: fingerprintSixScreenValue("screen34-contract"),
    createdAt: at, expiresAt: "2026-10-01T10:00:00.000Z" });
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (sourceMode === "records" && url.includes("/full_text/")) return new Response(
      "<html><main><p>The final manufacturing consumer data privacy reporting rule takes effect in 2021. Public firms must disclose credit-market and customer data use to investors.</p></main></html>",
      { headers: { "content-type": "text/html" } });
    const results = sourceMode === "empty" ? [] : Array.from({ length: 6 }, (_, index) => ({
      document_number: `2021-${12340 + index}`, title: `Manufacturing credit-market and consumer privacy reporting rule ${index + 1}`,
      type: "Rule", action: "Final rule.", abstract: "The commission changed a lending and consumer data reporting requirement for public manufacturing firms.",
      excerpts: ["Public manufacturers must report credit-market and consumer data practices."],
      html_url: `https://www.federalregister.gov/documents/2021/05/10/2021-${12340 + index}/example`,
      raw_text_url: `https://www.federalregister.gov/documents/full_text/html/2021/05/10/2021-${12340 + index}.html`,
      publication_date: "2021-05-10", effective_on: "2021-06-10", agencies: [{ name: "Federal fixture agency" }],
    }));
    return new Response(JSON.stringify({ count: results.length, results, data: [], DisasterDeclarationsSummaries: [] }),
      { headers: { "content-type": "application/json" } });
  });
  const runtime = new SixScreenWorkflowRuntime({ store, taskStore: new SixScreenResearchTaskStore(storage),
    evidenceStore: new SixScreenEvidenceStore(storage), signingKey: "screen34-contract-signing-key-longer-than-thirty-two-bytes",
    now: () => at, fetch });
  const server = new McpServer({ name: "screen34-contract", version: "1.0.0" });
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "screen34-contract", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const response = await client.callTool({ name: "mutate_six_screen_workflow_v1",
      arguments: { runId, accessToken, mutation: { action: "open_screen_4",
        expectedRevision: state.revision, operationId: "screen34-contract-first-open" } } });
    expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ activeScreen: 4 });
  } finally { await client.close(); await server.close(); }
});
