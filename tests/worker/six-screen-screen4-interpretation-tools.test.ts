import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { createElement } from "react";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { modelTaskProfile } from
  "../../src/core/six-screen/model-task-profiles";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { decodeSixScreenWorkflowProblemText } from
  "../../src/core/six-screen/workflow-problem";
import { knownObservedProviderHttpFailure,
  screen4InterpretationAttemptIds,
  validateScreen4InterpretationAttempts } from
  "../../src/core/six-screen/screen4-interpretation-queue";
import { restoreSixScreenWorkflowToolResponse } from
  "../../src/ui/six-screen/workflow-response";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { StudyFirstEventInvestigationPanel } from
  "../../src/ui/six-screen/SixScreenApp";
import { createScreen6DesignMapProjection } from "../../src/core/six-screen/screen6-design-map";
import { createCompleteReport } from "../../src/ui/six-screen/complete-report-data";
import { generateCompleteReportPdf } from "../../src/ui/six-screen/complete-report-pdf";
import { SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY } from
  "../../src/core/six-screen/metadata-keys";
import {
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
  type SixScreenWorkflowResponseContract,
} from "../../src/core/six-screen/workflow-response-contract";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import type { StudyFirstEventInvestigationWorkspace } from
  "../../src/worker/six-screen-workflow-runtime";
import { SixScreenWorkflowStore, InMemorySixScreenWorkflowStorage } from
  "../../src/worker/six-screen-workflow-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { Screen4AssessmentStore } from
  "../../src/worker/screen4-assessment-store";
import { SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES } from
  "../../src/worker/screen5-openai-transport";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";

const createTool = "create_six_screen_workflow_v1";
const getTool = "get_six_screen_workflow_v1";
const mutateTool = "mutate_six_screen_workflow_v1";
const connected: Array<{ client: Client; server: McpServer }> = [];

type ToolWire = {
  isError?: boolean;
  content: Array<{ type?: string; text?: string }>;
  structuredContent: Record<string, unknown>;
  _meta: Record<string, unknown>;
};

function serialized(value: unknown): ToolWire {
  return JSON.parse(JSON.stringify(value)) as ToolWire;
}

function accepted(value: unknown, toolName: string) {
  const wire = serialized(value);
  expect(wire.isError, JSON.stringify(wire.content)).not.toBe(true);
  const restored = restoreSixScreenWorkflowToolResponse({
    structuredContent: wire.structuredContent,
    metadata: wire._meta,
    trace: {
      toolName,
      bridgePath: "mcp-app",
      metadataKeys: Object.keys(wire._meta),
      structuredContentKeys: Object.keys(wire.structuredContent),
    },
  });
  return { wire, ...restored };
}

function providerResponse(value: unknown) {
  return new Response(JSON.stringify({
    id: "resp_screen4_registered_tool_fixture",
    object: "response",
    status: "completed",
    model: "gpt-6-luna",
    service_tier: "default",
    output: [{
      id: "msg_screen4_registered_tool_fixture",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{
        type: "output_text", annotations: [], text: JSON.stringify(value),
      }],
    }],
    usage: {
      input_tokens: 250,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 150,
      output_tokens_details: { reasoning_tokens: 40 },
      total_tokens: 400,
    },
  }), {
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-screen4-registered-tool-fixture",
    },
  });
}

async function harness(
  outcomes: Array<"success" | "unknown" | "rate_limited"> = ["success"],
  now: () => string = () => "2026-09-24T12:00:00.000Z",
  federalCount = 1,
  options: { failWorkflowFinalizationOnce?: boolean;
    compactAssessmentStore?: boolean } = {},
) {
  const sourceFetch = vi.fn(async (request: RequestInfo | URL) => {
    const url = String(request);
    if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(url)) {
      return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/v1/documents")) {
      const results = Array.from({ length: federalCount }, (_, index) => {
        const documentNumber = `2021-${12340 + index}`;
        const day = String(10 + index).padStart(2, "0");
        return {
          document_number: documentNumber,
          title: `Manufacturing credit-market reporting rule ${index + 1}`,
          type: "Rule",
          abstract:
            "A federal agency changed lending requirements for manufacturing credit markets.",
          action: "Final rule.",
          excerpts: [
            "The rule changed lending requirements for manufacturing credit markets.",
          ],
          html_url:
            `https://www.federalregister.gov/documents/2021/05/${day}/${documentNumber}/example`,
          raw_text_url:
            `https://www.federalregister.gov/documents/full_text/html/2021/05/${day}/${documentNumber}.html`,
          publication_date: `2021-05-${day}`,
          effective_on: `2021-06-${day}`,
          agencies: [{ name: "Federal fixture agency" }],
        };
      });
      return new Response(JSON.stringify({ count: federalCount, results }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("federalregister.gov")) {
      return new Response(
        "<!doctype html><html><body><main><p>This final rule changes lending requirements for manufacturing credit markets.</p><p>This rule is effective June 10, 2021.</p></main></body></html>",
        { headers: { "content-type": "text/html" } },
      );
    }
    return new Response("Controlled unavailable source", { status: 503 });
  });
  let modelInvocation = 0;
  const modelFetch = vi.fn(async (_request: RequestInfo | URL,
    init?: RequestInit) => {
    const outcome = outcomes[modelInvocation++] ?? "success";
    if (outcome === "unknown") {
      throw new TypeError("Controlled network loss after dispatch");
    }
    if (outcome === "rate_limited") {
      return new Response(JSON.stringify({ error: {
        code: "rate_limit_exceeded",
        message: "Controlled rate limit",
      } }), { status: 429,
        headers: { "content-type": "application/json" } });
    }
    const body = JSON.parse(String(init?.body));
    expect(body.text.format.name)
      .toBe("screen4_openai_event_descriptions_v3");
    const packet = JSON.parse(body.input[0].content[0].text) as {
      events: Array<{ slot_id: string }>;
    };
    return providerResponse({
      assessments: Object.fromEntries(packet.events.map((event) =>
        [event.slot_id, {
          what_it_is:
            "An official source documents the stated event.",
          why_it_may_matter:
            "If sampled firms encounter the change, their operations or financing and measured performance could change.",
          what_to_check_next:
            "Map the documented activity and dates to sampled firms.",
        }])),
    });
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const ledger = new Screen5OpenAILedgerStore(storage);
  const taskStore = new SixScreenResearchTaskStore(storage);
  const workflowStore = new SixScreenWorkflowStore(storage);
  if (options.failWorkflowFinalizationOnce) {
    let fail = true;
    const mutate = workflowStore.mutate.bind(workflowStore);
    vi.spyOn(workflowStore, "mutate").mockImplementation(async (
      input,
      updater,
    ) => {
      if (fail && input.operationKind ===
          "commit_study_first_event_investigation") {
        fail = false;
        throw new Error(
          "Controlled interruption after the aggregate checkpoint was saved.",
        );
      }
      return mutate(input, updater);
    });
  }
  const runtime = new SixScreenWorkflowRuntime({
    store: workflowStore,
    taskStore,
    evidenceStore: new SixScreenEvidenceStore(storage),
    signingKey: "registered-screen4-tool-test-key-more-than-thirty-two-bytes",
    now,
    fetch: sourceFetch,
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "test-key-never-projected",
    screen5OpenAIFetch: modelFetch,
    screen5OpenAILedgerStore: ledger,
    ...(options.compactAssessmentStore
      ? { screen4AssessmentStore: new Screen4AssessmentStore(storage) }
      : {}),
  });
  const server = new McpServer(
    { name: "screen4-registered-tool-test", version: "1.0.0" },
    { instructions: "Test the registered Screen 4 tool mutation." },
  );
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return { client, sourceFetch, modelFetch, ledger, taskStore, workflowStore };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
});

async function preparedScreen4(
  { client, sourceFetch, modelFetch }: Pick<
    Awaited<ReturnType<typeof harness>>,
    "client" | "sourceFetch" | "modelFetch"
  >,
) {
    const study = {
      population: "U.S. public manufacturers",
      analysisUnit: "firm-year",
      geography: ["United States", "California"],
      industry: ["Manufacturing"],
      period: { start: "2018", end: "2025" },
      outcome: "Firm performance",
      outcomeMeasure: "Return on assets",
      intendedConstruct: "Organizational performance",
      policySideConcept: "Customer protection",
      initialExplanation: "Through customer confidence.",
      proposedTreatment: "California firms",
      proposedComparison: "Non-California firms",
      resultsPreviouslyInspected: "not_disclosed",
    };
    const created = accepted(await client.callTool({
      name: createTool,
      arguments: {
        operationId: "screen4-tool-create",
        shockInput: "California Consumer Privacy Act",
        officialIdentifier: null,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
        study,
      },
    }), createTool);
    const auth = {
      runId: created.snapshot.runId,
      accessToken: created.snapshot.accessToken,
    };
    const initialSourceCalls = sourceFetch.mock.calls.length;
    accepted(await client.callTool({ name: getTool, arguments: auth }), getTool);
    expect(sourceFetch).toHaveBeenCalledTimes(initialSourceCalls);
    expect(modelFetch).not.toHaveBeenCalled();

    const resolved = accepted(await client.callTool({
      name: mutateTool,
      arguments: {
        ...auth,
        mutation: {
          action: "resolve_shock",
          expectedRevision: created.snapshot.revision,
          operationId: "screen4-tool-resolve",
        },
      },
    }), mutateTool);
    const candidate = (resolved.wire.structuredContent.candidates as Array<{
      id: string;
      identityFingerprint: string;
      sourceSnapshotId: string;
      sourceSnapshotFingerprint: string;
    }>)[0]!;
    expect(candidate).toBeDefined();
    const confirmed = accepted(await client.callTool({
      name: mutateTool,
      arguments: {
        ...auth,
        mutation: {
          action: "confirm_shock",
          expectedRevision: resolved.snapshot.revision,
          operationId: "screen4-tool-confirm",
          candidateId: candidate.id,
          displayedIdentityFingerprint: candidate.identityFingerprint,
          sourceSnapshotId: candidate.sourceSnapshotId,
          sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
          originalRequestFingerprint:
            resolved.snapshot.state.originalRequestFingerprint,
          currentRequestFingerprint:
            resolved.snapshot.state.currentRequestFingerprint,
          identityRevision: resolved.wire.structuredContent.identityRevision,
        },
      },
    }), mutateTool);
    const opened3 = accepted(await client.callTool({
      name: mutateTool,
      arguments: {
        ...auth,
        mutation: {
          action: "open_screen_3",
          expectedRevision: confirmed.snapshot.revision,
          operationId: "screen4-tool-open3",
          study,
          proposedTiming: {
            mode: "year", year: 2020, milestoneReference: null,
          },
        },
      },
    }), mutateTool);
    return { auth, opened3, sourceFetch, modelFetch };
}

async function openedScreen4(
  fixture: Pick<Awaited<ReturnType<typeof harness>>,
    "client" | "sourceFetch" | "modelFetch">,
) {
    const { client } = fixture;
    const { auth, opened3, sourceFetch, modelFetch } = await preparedScreen4(
      fixture,
    );
    const opened4 = accepted(await client.callTool({
      name: mutateTool,
      arguments: {
        ...auth,
        mutation: {
          action: "open_screen_4",
          expectedRevision: opened3.snapshot.revision,
          operationId: "screen4-tool-open4",
        },
      },
    }), mutateTool);
    const investigation = opened4.snapshot.state
      .studyFirstEventInvestigations?.at(-1);
    expect(investigation?.presentation?.visibleEventIds.length)
      .toBeGreaterThan(0);
    expect(modelFetch).not.toHaveBeenCalled();

    return { auth, opened4, investigation };
}

describe("registered Screen 4 analysis mutation", () => {
  it.each(["tokens", "attempts"] as const)(
    "restores a Screen 4 blocked by %s through extended renewal without rescanning or inference",
    async (limit) => {
      const fixture = await harness(["success"],
        () => "2026-10-17T14:00:00.000Z", 1,
        { compactAssessmentStore: true });
      const { client, ledger, sourceFetch, modelFetch } = fixture;
      const { auth, opened3 } = await preparedScreen4(fixture);
      const opened4 = accepted(await client.callTool({ name: mutateTool,
        arguments: { ...auth, mutation: {
          action: "open_screen_4", expectedRevision: opened3.snapshot.revision,
          operationId: "screen4-before-renewal",
        } },
      }), mutateTool);
      if (limit === "attempts") {
        await ledger.reserve({ reservationId: "old:unknown", jobId: "old",
          stage: "planning", reservedTokens: 1_000,
          now: "2026-10-17T14:00:00.000Z" });
        await ledger.recordDispatch({ reservationId: "old:unknown",
          now: "2026-10-17T14:00:00.000Z" });
      }
      await ledger.updatePolicy({ acknowledgedByOwner: true,
        maximumAttempts: 1, maximumTokens: 55_000,
        reasonCode: "owner_test_cap", now: "2026-10-17T14:00:00.000Z" });
      const blocked = accepted(await client.callTool({
        name: getTool, arguments: auth,
      }), getTool);
      const workspace = (response: typeof blocked) => response.wire.structuredContent
        .studyFirstEventInvestigationWorkspace as StudyFirstEventInvestigationWorkspace;
      expect(workspace(blocked).interpretationQueue?.readiness.canDispatch).toBe(false);
      expect(workspace(blocked).interpretationQueue?.readiness.blocker)
        .toContain("Model usage allowance above");
      const sourceCount = sourceFetch.mock.calls.length;
      const prior = await ledger.summary();
      const mutation = { action: "renew_model_allowance", acknowledgedByOwner: true,
        allowanceWindow: "extended", expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-extended-renewal" };
      const renewed = accepted(await client.callTool({ name: mutateTool,
        arguments: { ...auth, mutation } }), mutateTool);
      expect(workspace(renewed).interpretationQueue?.readiness).toMatchObject({
        canDispatch: true, blocker: null, availableAttempts: 800,
        availableTokens: 20_000_000,
      });
      expect(renewed.snapshot.state.study).toEqual(opened4.snapshot.state.study);
      expect(workspace(renewed).investigation?.investigationFingerprint)
        .toBe(workspace(blocked).investigation?.investigationFingerprint);
      const extended = await ledger.summary();
      expect(extended).toMatchObject({ tokensConsumed: prior.tokensConsumed,
        tokensHeld: prior.tokensHeld, attemptsReserved: prior.attemptsReserved });
      accepted(await client.callTool({ name: mutateTool,
        arguments: { ...auth, mutation } }), mutateTool);
      expect(await ledger.summary()).toEqual(extended);
      expect(sourceFetch).toHaveBeenCalledTimes(sourceCount);
      expect(modelFetch).not.toHaveBeenCalled();
      const analyzed = accepted(await client.callTool({ name: mutateTool,
        arguments: { ...auth, mutation: {
          action: "analyze_study_first_events",
          expectedRevision: renewed.snapshot.revision,
          operationId: "screen4-assess-after-renewal",
          expectedInvestigationFingerprint:
            workspace(renewed).investigation!.investigationFingerprint,
        } },
      }), mutateTool);
      expect(modelFetch).toHaveBeenCalledTimes(1);
      expect(workspace(analyzed).interpretationQueue?.completedCount).toBeGreaterThan(0);
      expect(sourceFetch).toHaveBeenCalledTimes(sourceCount);
    },
    45_000,
  );

  it("advertises the standard workflow projection for Screen 4 assessment", async () => {
    const { client } = await harness();
    const mutationTool = (await client.listTools()).tools.find(({ name }) =>
      name === mutateTool);
    expect(mutationTool).toBeDefined();
    const properties = mutationTool?.outputSchema?.properties as
      Record<string, unknown> | undefined;
    expect(properties).toHaveProperty("schemaVersion");
    expect(properties).not.toHaveProperty("screen4Assessment");
  });

  it("never retries body or model-output failures as observed HTTP rejections", () => {
    expect(knownObservedProviderHttpFailure({
      failureCode: "http_error", failureStage: "response_body",
    })).toBe(false);
    expect(knownObservedProviderHttpFailure({
      failureCode: "http_error", failureStage: "model_output",
    })).toBe(false);
    expect(knownObservedProviderHttpFailure({
      failureCode: "openai_rate_limited", failureStage: "response_headers",
    })).toBe(true);
    expect(knownObservedProviderHttpFailure({
      failureCode: "http_error", failureStage: null,
    })).toBe(true);
  });

  it("completes every bounded source step and local finalization in one explicit action", async () => {
    const fixture = await harness(["success"]);
    const { sourceFetch, modelFetch } = fixture;
    const { opened4, investigation } = await openedScreen4(fixture);
    expect(investigation?.status).toMatch(/completed/u);
    const workspace = opened4.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        discoveryTask: { state: string; nextAction: string;
          completedStepCount: number; pendingStepCount: number;
          totalStepCount: number };
      };
    expect(workspace.discoveryTask).toMatchObject({
      state: expect.stringMatching(/^complete/u),
      nextAction: "none",
      pendingStepCount: 0,
    });
    expect(workspace.discoveryTask.completedStepCount)
      .toBe(workspace.discoveryTask.totalStepCount);
    expect(sourceFetch).toHaveBeenCalled();
    expect(modelFetch).not.toHaveBeenCalled();
  });

  it("assesses the projected shortlist from the compact store and joins every result by event ID", async () => {
    const fixture = await harness(
      ["success", "success", "success"],
      () => "2026-09-24T12:00:00.000Z",
      10,
      { compactAssessmentStore: true },
    );
    const { client, modelFetch, workflowStore } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const opened4 = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-compact-open",
      } },
    }), mutateTool);
    const workspace = opened4.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { status: string; investigationFingerprint: string;
          presentation: { visibleEventIds: string[] } };
        interpretationQueue: { status: string; results: Array<{
          eventId: string }>; diagnosis: unknown };
      };
    expect(workspace.investigation.status).toMatch(/completed/u);
    expect(workspace.investigation.presentation.visibleEventIds.length)
      .toBeGreaterThan(0);
    expect(workspace.interpretationQueue.status).toBe("ready");
    expect(workspace.interpretationQueue.diagnosis).not.toBeNull();
    expect(modelFetch).not.toHaveBeenCalled();

    const before = await workflowStore.read(auth);
    expect(before.outcome).toBe("found");
    if (before.outcome !== "found") throw new Error("workflow unavailable");
    expect(before.record.state.studyFirstEventInvestigations?.at(-1)?.status)
      .toBe("planned");
    expect(before.record.state.revision).toBe(opened4.snapshot.revision);

    const batchCount = Math.ceil(
      workspace.investigation.presentation.visibleEventIds.length / 4,
    );
    let analyzed = opened4;
    for (let batch = 0; batch < batchCount; batch += 1) {
      analyzed = accepted(await client.callTool({
        name: mutateTool,
        arguments: { ...auth, mutation: {
          action: "analyze_study_first_events",
          expectedRevision: opened4.snapshot.revision,
          operationId: `screen4-compact-assess-${batch + 1}`,
          expectedInvestigationFingerprint:
            workspace.investigation.investigationFingerprint,
        } },
      }), mutateTool);
      const checkpoint = analyzed.wire.structuredContent
        .studyFirstEventInvestigationWorkspace as typeof workspace;
      expect(modelFetch).toHaveBeenCalledTimes(batch + 1);
      expect(checkpoint.interpretationQueue.results).toHaveLength(
        Math.min((batch + 1) * 4,
          workspace.investigation.presentation.visibleEventIds.length),
      );
      expect(checkpoint.interpretationQueue.status).toBe(
        batch + 1 === batchCount ? "completed" : "partial",
      );
    }
    const assessed = analyzed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as typeof workspace;
    expect(assessed.interpretationQueue.status).toBe("completed");
    expect(assessed.interpretationQueue.diagnosis).toBeNull();
    expect(assessed.interpretationQueue.results.map(({ eventId }) => eventId))
      .toEqual(
        workspace.investigation.presentation.visibleEventIds,
      );
    expect(analyzed.snapshot.revision).toBe(opened4.snapshot.revision);
  });

  it("opens Screen 5 after every compact Screen 4 assessment is saved", async () => {
    const fixture = await harness(
      ["success", "success", "success"],
      () => "2026-09-24T12:00:00.000Z",
      10,
      { compactAssessmentStore: true },
    );
    const { client } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const opened4 = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-open5-compact-open",
      } },
    }), mutateTool);
    const initialWorkspace = opened4.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { investigationFingerprint: string;
          presentation: { visibleEventIds: string[] } };
      };
    const investigation = initialWorkspace.investigation;
    const visibleEventIds = investigation.presentation.visibleEventIds;
    let current = opened4;
    for (let batch = 0; batch < Math.ceil(visibleEventIds.length / 4);
      batch += 1) {
      current = accepted(await client.callTool({
        name: mutateTool,
        arguments: { ...auth, mutation: {
          action: "analyze_study_first_events",
          expectedRevision: current.snapshot.revision,
          operationId: `screen4-open5-assessment-${batch + 1}`,
          expectedInvestigationFingerprint:
            investigation.investigationFingerprint,
        } },
      }), mutateTool);
    }
    const assessedWorkspace = current.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { status: string; snapshotId: string };
        interpretationQueue: { status: string; completedCount: number };
      };
    expect(assessedWorkspace.investigation.status).toMatch(/completed/u);
    expect(assessedWorkspace.interpretationQueue).toMatchObject({
      status: "completed",
      completedCount: visibleEventIds.length,
    });
    const readiness = current.wire.structuredContent.screen5Prerequisites as {
      ready: boolean;
      currentCoEventSnapshotId: string | null;
      limitations: Array<{ code: string; message: string }>;
    };
    expect(readiness.ready).toBe(true);
    expect(readiness.currentCoEventSnapshotId).toBe(
      assessedWorkspace.investigation.snapshotId,
    );
    expect(readiness.limitations.map(({ message }) => message).join(" "))
      .not.toMatch(/investigation is pending/iu);

    const opened5 = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_5",
        expectedRevision: current.snapshot.revision,
        operationId: "screen4-open5-after-compact-assessment",
      } },
    }), mutateTool);
    expect(opened5.snapshot.state.activeScreen).toBe(5);
    expect(opened5.wire.structuredContent.screen5Prerequisites)
      .toMatchObject({ ready: true });
    const opened6 = accepted(await client.callTool({ name: mutateTool,
      arguments: { ...auth, mutation: { action: "open_screen_6",
        expectedRevision: opened5.snapshot.revision,
        operationId: "screen6-retains-compact-screen4-results" } } }), mutateTool);
    // The durable source/assessment stores supply the displayed result; the
    // canonical workflow intentionally still holds its small placeholder.
    expect(opened6.snapshot.state.studyFirstEventInvestigations!.at(-1)!.status).toBe("planned");
    const eventWorkspace = opened6.projection.studyFirstEventInvestigationWorkspace;
    const events = eventWorkspace.investigation!.occurrences;
    expect(events).toHaveLength(10);
    const plan = opened6.projection.screen6CurrentPlan;
    const designMap = createScreen6DesignMapProjection(plan);
    const report = createCompleteReport({ state: opened6.snapshot.state, plan,
      designMap, eventWorkspace });
    const panelText = JSON.stringify(designMap.panels.find((panel) => panel.id === "events"));
    const eventReport = JSON.stringify(report.sections[2]);
    for (const event of events) {
      expect(panelText).toContain(event.title);
      expect(eventReport).toContain(event.title);
    }
    expect(eventReport).toContain("If sampled firms encounter the change");
    expect(eventReport).toContain("Map the documented activity and dates to sampled firms.");
    expect(eventReport).not.toContain("No named alternative shock");
    expect(report.sections[2]!.blocks.find((block) => block.table)?.table?.rows).toHaveLength(10);
    expect(fixture.modelFetch).toHaveBeenCalledTimes(Math.ceil(visibleEventIds.length / 4));
    if (process.env.SHOCKAUDIT_COMPACT_REPORT_QA_PATH) {
      writeFileSync(process.env.SHOCKAUDIT_COMPACT_REPORT_QA_PATH, generateCompleteReportPdf(report));
    }
  });

  it("shows the exact compact assessment stage when the provider rejects the request", async () => {
    const fixture = await harness(
      ["rate_limited"],
      () => "2026-09-24T12:00:00.000Z",
      1,
      { compactAssessmentStore: true },
    );
    const { client, modelFetch } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const opened4 = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-compact-diagnostic-open",
      } },
    }), mutateTool);
    const before = opened4.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { investigationFingerprint: string };
      };
    const analyzed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-compact-diagnostic-assess",
        expectedInvestigationFingerprint:
          before.investigation.investigationFingerprint,
      } },
    }), mutateTool);
    const queue = (analyzed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        interpretationQueue: { status: string; diagnostic: {
          code: string; dispatchState: string } | null; diagnosis: {
          currentStep: string; steps: Array<{
            id: string; status: string; detail: string }> } | null };
      }).interpretationQueue;
    expect(modelFetch).toHaveBeenCalledTimes(1);
    expect(queue.status).toBe("failed");
    expect(queue.diagnostic).toMatchObject({
      code: "openai_rate_limited",
      dispatchState: "dispatched",
    });
    expect(queue.diagnosis?.currentStep).toBe("provider_dispatch");
    expect(queue.diagnosis?.steps.find(({ id }) =>
      id === "provider_dispatch")).toMatchObject({
        status: "failed",
        detail: expect.stringContaining("openai_rate_limited"),
      });
  });

  it("attaches a saved aggregate after final workflow delivery was interrupted", async () => {
    const fixture = await harness(
      ["success"],
      () => "2026-09-24T12:00:00.000Z",
      1,
      { failWorkflowFinalizationOnce: true },
    );
    const { client, sourceFetch, modelFetch, taskStore } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const interrupted = serialized(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-finalization-interrupted",
      } },
    }));
    expect(interrupted.isError).toBe(true);
    const saved = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    const savedWorkspace = saved.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { status: string; occurrences: unknown[] };
        discoveryTask: { taskId: string; state: string; stage: string;
          nextAction: string;
          completedStepCount: number; totalStepCount: number };
        documentedOccurrences: unknown[];
      };
    expect(savedWorkspace.investigation.status).toMatch(/completed/u);
    expect(savedWorkspace.discoveryTask).toMatchObject({
      state: "complete",
      stage: "complete",
      nextAction: "none",
    });
    expect(savedWorkspace.discoveryTask.completedStepCount)
      .toBe(savedWorkspace.discoveryTask.totalStepCount);
    expect(savedWorkspace.investigation.occurrences.length).toBeGreaterThan(0);
    expect(savedWorkspace.documentedOccurrences).toHaveLength(0);
    const taskAuthentication = {
      ...auth, taskId: savedWorkspace.discoveryTask.taskId,
    };
    const taskRead = await taskStore.read(taskAuthentication);
    expect(taskRead.outcome).toBe("found");
    if (taskRead.outcome !== "found") throw new Error("Task fixture missing.");
    const aggregate = [...taskRead.record.operationReplays].reverse().find(
      ({ operationKind }) =>
        operationKind === "commit_study_first_event_scan",
    );
    expect(aggregate).toBeDefined();
    const invalidAggregate = structuredClone(aggregate!.result) as {
      checkpointFingerprint: string;
    };
    invalidAggregate.checkpointFingerprint =
      fingerprintSixScreenValue("controlled-invalid-aggregate");
    const appended = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: taskRead.record.task.revision,
      operationId: "screen4-append-invalid-aggregate",
      operationKind: "commit_study_first_event_scan",
      inputFingerprint: fingerprintSixScreenValue(
        "screen4-append-invalid-aggregate",
      ),
      updatedAt: "2026-09-24T12:00:01.000Z",
    }, (task) => {
      task.revision += 1;
      task.updatedAt = "2026-09-24T12:00:01.000Z";
      return { task, result: invalidAggregate };
    });
    expect(appended.outcome).toBe("updated");
    const rebuildReady = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(rebuildReady.wire.structuredContent
      .studyFirstEventInvestigationWorkspace).toMatchObject({
        discoveryTask: {
          state: "partial",
          stage: "local_processing",
          nextAction: "resume",
        },
      });
    const sourceCalls = sourceFetch.mock.calls.length;

    const recovered = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: rebuildReady.snapshot.revision,
        operationId: "screen4-attach-saved-aggregate",
      } },
    }), mutateTool);
    const current = recovered.snapshot.state.studyFirstEventInvestigations!
      .at(-1)!;
    expect(current.status).toMatch(/completed/u);
    expect(current.presentation?.visibleEventIds.length).toBeGreaterThan(0);
    const recoveredWorkspace = recovered.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        discoveryTask: { state: string; nextAction: string };
        interpretationQueue: { status: string; totalCount: number };
      };
    expect(recoveredWorkspace.discoveryTask).toMatchObject({
      state: expect.stringMatching(/^complete/u),
      nextAction: "none",
    });
    expect(recoveredWorkspace.interpretationQueue).toMatchObject({
      status: "ready",
      totalCount: current.presentation!.visibleEventIds.length,
    });
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).not.toHaveBeenCalled();
  });

  it("assesses a recovered source result without repeating source discovery", async () => {
    const fixture = await harness(
      ["success"],
      () => "2026-09-24T12:00:00.000Z",
      3,
      { failWorkflowFinalizationOnce: true },
    );
    const { client, sourceFetch, modelFetch } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const interrupted = serialized(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-source-delivery-interrupted",
      } },
    }));
    expect(interrupted.isError).toBe(true);

    const recovered = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    const workspace = recovered.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as unknown as
        StudyFirstEventInvestigationWorkspace;
    const investigation = workspace.investigation!;
    expect(investigation.status).toMatch(/completed/u);
    expect(investigation.presentation?.visibleEventIds.length)
      .toBeGreaterThan(0);
    expect(workspace.discoveryTask).toMatchObject({
      state: "complete",
      stage: "complete",
      nextAction: "none",
    });
    expect(workspace.interpretationQueue).toMatchObject({
      status: "ready",
      totalCount: investigation.presentation!.visibleEventIds.length,
    });
    const sourceCalls = sourceFetch.mock.calls.length;

    const assessed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: recovered.snapshot.revision,
        operationId: "screen4-assess-recovered-source-result",
        expectedInvestigationFingerprint:
          investigation.investigationFingerprint,
      } },
    }), mutateTool);
    const assessedWorkspace = assessed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as unknown as
        StudyFirstEventInvestigationWorkspace;
    expect(
      assessedWorkspace.interpretationQueue,
      JSON.stringify(assessedWorkspace.interpretationQueue),
    ).toMatchObject({
      status: "completed",
      completedCount: investigation.presentation!.visibleEventIds.length,
    });
    const rendered = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace: assessedWorkspace, disabled: false,
        onAnalyze: () => undefined },
    ));
    expect(rendered).toContain("Alternative shocks");
    expect(rendered).toContain("Why it may matter");
    expect(rendered).toContain("What should you check next");
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).toHaveBeenCalled();
  });

  it("attaches a saved aggregate when historical Screen 4 entries fill the bound", async () => {
    const fixture = await harness(
      ["success"],
      () => "2026-09-24T12:00:00.000Z",
      1,
      { failWorkflowFinalizationOnce: true },
    );
    const { client, sourceFetch, modelFetch, workflowStore } = fixture;
    const { auth, opened3 } = await preparedScreen4(fixture);
    const interrupted = serialized(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: opened3.snapshot.revision,
        operationId: "screen4-bound-finalization-interrupted",
      } },
    }));
    expect(interrupted.isError).toBe(true);
    const saved = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    const padded = await workflowStore.mutate({
      ...auth,
      expectedRevision: saved.snapshot.revision,
      operationId: "screen4-fill-history-bound",
      operationKind: "test_fill_screen4_history",
      inputFingerprint: fingerprintSixScreenValue("fill-screen4-history"),
      updatedAt: "2026-09-24T12:00:01.000Z",
    }, (state) => {
      const planned = state.studyFirstEventInvestigations!.at(-1)!;
      const clones = Array.from({ length: 23 }, (_, index) => {
        const { investigationFingerprint: _fingerprint, ...body } =
          structuredClone(planned);
        const cloneBody = {
          ...body,
          snapshotId: `screen4-bounded-history-${index + 1}`,
          ordinal: index + 1,
        };
        return {
          ...cloneBody,
          investigationFingerprint: fingerprintSixScreenValue(cloneBody),
        };
      });
      state.studyFirstEventInvestigations = [...clones, planned];
      state.revision += 1;
      state.updatedAt = "2026-09-24T12:00:01.000Z";
      return { state, result: null };
    });
    expect(padded.outcome).toBe("updated");
    const atBound = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(atBound.snapshot.state.studyFirstEventInvestigations).toHaveLength(24);
    const sourceCalls = sourceFetch.mock.calls.length;

    const recovered = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: atBound.snapshot.revision,
        operationId: "screen4-attach-at-history-bound",
      } },
    }), mutateTool);
    const current = recovered.snapshot.state.studyFirstEventInvestigations!
      .at(-1)!;
    expect(current.status).toMatch(/completed/u);
    expect(current.presentation?.visibleEventIds.length).toBeGreaterThan(0);
    expect(recovered.snapshot.state.studyFirstEventInvestigations)
      .toHaveLength(24);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).not.toHaveBeenCalled();

    const assessed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: recovered.snapshot.revision,
        operationId: "screen4-assess-after-history-bound-recovery",
        expectedInvestigationFingerprint: current.investigationFingerprint,
      } },
    }), mutateTool);
    const assessedWorkspace = assessed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as unknown as
        StudyFirstEventInvestigationWorkspace;
    expect(assessedWorkspace.interpretationQueue).toMatchObject({
      status: "completed",
      completedCount: current.presentation!.visibleEventIds.length,
    });
    const rendered = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace: assessedWorkspace, disabled: false,
        onAnalyze: () => undefined },
    ));
    expect(rendered).toContain("Alternative shocks");
    expect(rendered).toContain("Why it may matter");
    expect(rendered).toContain("What should you check next");
    expect(rendered).toContain("sampled firms");
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).toHaveBeenCalled();
  });

  it("keeps a high-yield completed source workspace bounded and assessment-ready", async () => {
    const fixture = await harness(
      ["success"],
      () => "2026-09-24T12:00:00.000Z",
      55,
    );
    const { opened4, investigation } = await openedScreen4(fixture);
    expect(investigation?.status).toMatch(/completed/u);
    const workspace = opened4.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        investigation: { occurrences: unknown[];
          presentation: { visibleEventIds: string[] } };
        documentedOccurrences: unknown[];
        interpretationQueue: { status: string; totalCount: number };
      };
    expect(workspace.investigation.presentation.visibleEventIds.length)
      .toBeGreaterThan(0);
    expect(workspace.investigation.presentation.visibleEventIds.length)
      .toBeLessThanOrEqual(10);
    expect(workspace.interpretationQueue).toMatchObject({
      status: "ready",
      totalCount: workspace.investigation.presentation.visibleEventIds.length,
    });
    expect(new TextEncoder().encode(JSON.stringify(
      opened4.wire.structuredContent,
    )).byteLength).toBeLessThanOrEqual(350_000);
    expect(workspace.investigation.occurrences.length).toBeLessThanOrEqual(10);
    expect(workspace.documentedOccurrences.length).toBeLessThanOrEqual(10);
    const rendered = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      {
        workspace: workspace as unknown as
          StudyFirstEventInvestigationWorkspace,
        disabled: false,
        onAnalyze: () => undefined,
      },
    ));
    expect(rendered).toContain("Assess relevance to my study");
    expect(rendered).toContain("Alternative shocks");
    expect(rendered).toContain("Source documented · assessment pending");
    expect(rendered).not.toContain("Why it may matter");
  });

  it("renders assessed alternative shocks when ChatGPT preserves only structured state chunks", async () => {
    const fixture = await harness(
      ["success", "success"],
      () => "2026-09-24T12:00:00.000Z",
      55,
    );
    const { client, sourceFetch, modelFetch, workflowStore } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const analyzed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-structured-chunk-assessment",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalled();

    // Force the same large canonical-state branch reached by the user's
    // mature Screen 4 workspace. The padding is valid private audit-log data;
    // it never enters the public projection or model request.
    let seed = 0x6d2b79f5;
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const noise = (length: number) => {
      let value = "";
      for (let index = 0; index < length; index += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        value += alphabet[seed >>> 26];
      }
      return value;
    };
    const padded = await workflowStore.mutate({
      ...auth,
      expectedRevision: analyzed.snapshot.revision,
      operationId: "screen4-structured-chunk-padding",
      operationKind: "test_screen4_structured_chunk_transport",
      inputFingerprint: fingerprintSixScreenValue(
        "screen4-structured-chunk-padding",
      ),
      updatedAt: "2026-09-24T12:00:01.000Z",
    }, (state) => {
      const revision = state.revision + 1;
      state.changeLog.push(...Array.from({ length: 90 }, (_, index) => ({
        revision,
        at: "2026-09-24T12:00:01.000Z",
        summary: `transport-fixture-${index}:${noise(4_096)}`,
      })));
      state.revision = revision;
      state.updatedAt = "2026-09-24T12:00:01.000Z";
      return { state, result: null };
    });
    expect(padded.outcome).toBe("updated");

    const sourceCalls = sourceFetch.mock.calls.length;
    const modelCalls = modelFetch.mock.calls.length;
    const callTool = vi.fn(async (name: string,
      args: Record<string, unknown>) => {
      const wire = serialized(await client.callTool({
        name, arguments: args,
      }));
      return name === SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL
        // Reproduce the observed host: nested app-call metadata and ordinary
        // text are absent, while declared structuredContent survives.
        ? { structuredContent: wire.structuredContent }
        : wire;
    });
    vi.stubGlobal("window", { openai: { callTool } });
    const bridge = new SixScreenBridge();
    const response = await bridge.callToolWithMetadata(getTool, auth);
    const contract = response.metadata[
      SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY
    ] as SixScreenWorkflowResponseContract;
    expect(contract.statePayloadMode).toBe("chunked");
    expect(callTool.mock.calls.filter(([name]) =>
      name === SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL).length)
      .toBe(contract.stateChunkCount);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).toHaveBeenCalledTimes(modelCalls);

    const restored = restoreSixScreenWorkflowToolResponse(response);
    expect(restored.snapshot.revision).toBe(analyzed.snapshot.revision + 1);
    const workspace = response.structuredContent
      .studyFirstEventInvestigationWorkspace as unknown as
        StudyFirstEventInvestigationWorkspace;
    expect(workspace.interpretationQueue).toMatchObject({
      status: "completed",
      completedCount: investigation!.presentation!.visibleEventIds.length,
    });
    const rendered = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace, disabled: false, onAnalyze: () => undefined },
    ));
    expect(rendered).toContain("Alternative shocks");
    expect(rendered).toContain("What it is");
    expect(rendered).toContain("Why it may matter");
    expect(rendered).toContain("What should you check next");
    expect(rendered).toContain("sampled firms");
  });

  it("rechecks a quarantined saved event response locally without a second model call", async () => {
    const fixture = await harness(["success"]);
    const { client, modelFetch, workflowStore } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const first = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-create-saved-response-for-local-recheck",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    const batchCount = Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4,
    );
    expect(modelFetch).toHaveBeenCalledTimes(batchCount);
    const firstAttempt = first.snapshot.state.screen4InterpretationAttempts!
      .at(-1)!;
    expect(firstAttempt).toMatchObject({ status: "completed",
      receipt: expect.any(Object) });
    const varied = JSON.parse(firstAttempt.receipt!.finalContent) as {
      assessments: Record<string, {
        why_it_may_matter: string;
        what_to_check_next: string;
      }>;
    };
    for (const item of Object.values(varied.assessments)) {
      item.why_it_may_matter += ` ${"study detail ".repeat(120)}`;
      item.what_to_check_next += ` ${"specific check ".repeat(60)}`;
    }
    const variedContent = JSON.stringify(varied);
    const quarantined = await workflowStore.mutate({
      ...auth,
      expectedRevision: first.snapshot.revision,
      operationId: "screen4-save-benign-quarantined-response",
      operationKind: "test_screen4_saved_benign_wire_variation",
      inputFingerprint: fingerprintSixScreenValue(
        "screen4-saved-benign-wire-variation",
      ),
      updatedAt: "2026-09-24T12:00:02.000Z",
    }, (state) => {
      const saved = state.screen4InterpretationAttempts!.at(-1)!;
      saved.status = "validation_failed";
      saved.result = null;
      saved.failureCode = "local_receipt_validation_failed";
      saved.failureStage = "model_output";
      saved.error =
        "Screen 4 saved response failed local validation at a presentation bound.";
      saved.receipt!.finalContent = variedContent;
      saved.receipt!.contentFingerprint = fingerprintSixScreenValue(
        variedContent,
      );
      saved.receipt!.wireFingerprint = null;
      saved.updatedAt = "2026-09-24T12:00:02.000Z";
      state.revision += 1;
      state.updatedAt = "2026-09-24T12:00:02.000Z";
      state.changeLog.push({ revision: state.revision,
        at: state.updatedAt,
        summary: "Synthetic saved Screen 4 response awaiting local recheck." });
      return { state, result: null };
    });
    expect(quarantined.outcome).toBe("updated");

    const recheckReady = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(recheckReady.wire.structuredContent
      .studyFirstEventInvestigationWorkspace).toMatchObject({
        interpretationQueue: {
          status: "partial",
          retryEligibility: "local_revalidation",
        },
      });
    const recovered = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: recheckReady.snapshot.revision,
        operationId: "screen4-recheck-saved-response-locally",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(recovered.wire.structuredContent
      .studyFirstEventInvestigationWorkspace).toMatchObject({
        interpretationQueue: {
          status: "completed",
          retryEligibility: "none",
          completedCount: investigation!.presentation!.visibleEventIds.length,
        },
      });
    const restored = recovered.snapshot.state.screen4InterpretationAttempts!
      .at(-1)!.result as {
        event_assessments: Array<{
          why_it_may_matter: { text: string; source_ids: string[] };
          what_to_check_next: string;
        }>;
    };
    expect(restored.event_assessments[0]!.why_it_may_matter.text.length)
      .toBeLessThanOrEqual(1_400);
    expect(restored.event_assessments[0]!.why_it_may_matter.text)
      .toMatch(/…$/u);
    expect(restored.event_assessments[0]!.why_it_may_matter.source_ids)
      .toEqual([]);
    expect(restored.event_assessments[0]!.what_to_check_next.length)
      .toBeLessThanOrEqual(900);
    expect(restored.event_assessments[0]!.what_to_check_next)
      .toMatch(/…$/u);
    expect(modelFetch).toHaveBeenCalledTimes(batchCount);
  });

  it("does not turn a local receipt recheck into authorization for a later batch", async () => {
    const fixture = await harness(
      ["success", "success", "success"],
      () => "2026-09-24T12:00:00.000Z",
      5,
    );
    const { client, modelFetch, workflowStore } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    expect(investigation!.presentation!.visibleEventIds.length)
      .toBeGreaterThan(4);
    const batchCount = Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4,
    );
    const first = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-complete-two-batches-before-recheck",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(batchCount);
    expect(first.snapshot.state.screen4InterpretationAttempts)
      .toHaveLength(batchCount);
    const firstBatch = first.snapshot.state.screen4InterpretationAttempts![0]!;
    const varied = JSON.parse(firstBatch.receipt!.finalContent) as {
      assessments: Record<string, { why_it_may_matter: string }>;
    };
    for (const item of Object.values(varied.assessments)) {
      item.why_it_may_matter += ` ${"detail ".repeat(140)}`;
    }
    const variedContent = JSON.stringify(varied);
    const quarantined = await workflowStore.mutate({
      ...auth,
      expectedRevision: first.snapshot.revision,
      operationId: "screen4-keep-only-quarantined-first-batch",
      operationKind: "test_screen4_local_recheck_authorization_boundary",
      inputFingerprint: fingerprintSixScreenValue(
        "screen4-local-recheck-authorization-boundary",
      ),
      updatedAt: "2026-09-24T12:00:03.000Z",
    }, (state) => {
      const saved = state.screen4InterpretationAttempts![0]!;
      saved.status = "validation_failed";
      saved.result = null;
      saved.failureCode = "local_receipt_validation_failed";
      saved.failureStage = "model_output";
      saved.error = "Saved first batch awaits local revalidation.";
      saved.receipt!.finalContent = variedContent;
      saved.receipt!.contentFingerprint = fingerprintSixScreenValue(
        variedContent,
      );
      saved.receipt!.wireFingerprint = null;
      saved.updatedAt = "2026-09-24T12:00:03.000Z";
      state.screen4InterpretationAttempts = [saved];
      state.revision += 1;
      state.updatedAt = "2026-09-24T12:00:03.000Z";
      state.changeLog.push({ revision: state.revision,
        at: state.updatedAt,
        summary: "Synthetic first Screen 4 batch awaiting local recheck." });
      return { state, result: null };
    });
    expect(quarantined.outcome).toBe("updated");
    const ready = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    const rechecked = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: ready.snapshot.revision,
        operationId: "screen4-local-recheck-only",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(batchCount);
    expect(rechecked.wire.structuredContent
      .studyFirstEventInvestigationWorkspace).toMatchObject({
        interpretationQueue: {
          status: "partial",
          retryEligibility: "new_request",
          completedCount: 4,
          totalCount: investigation!.presentation!.visibleEventIds.length,
        },
      });

    const completed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: rechecked.snapshot.revision,
        operationId: "screen4-authorize-remaining-batch",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(
      batchCount + Math.max(0, batchCount - 1),
    );
    expect(completed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace).toMatchObject({
        interpretationQueue: {
          status: "completed",
          retryEligibility: "none",
          completedCount: investigation!.presentation!.visibleEventIds.length,
        },
      });
  });

  it("commits and assesses a refreshed saved scan that reuses the same scientific plan", async () => {
    const fixture = await harness();
    const { client, sourceFetch, modelFetch } = fixture;
    const { auth, opened4, investigation: first } = await openedScreen4(fixture);
    const firstSourceCalls = sourceFetch.mock.calls.length;
    expect(first?.status).toMatch(/completed/u);

    const refreshed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "refresh_study_first_events",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-refresh-same-plan-regression",
        expectedInvestigationFingerprint: first!.investigationFingerprint,
      } },
    }), mutateTool);
    const current = refreshed.snapshot.state.studyFirstEventInvestigations!.at(-1)!;
    expect(current.snapshotId).not.toBe(first!.snapshotId);
    expect(current.plan.planFingerprint).toBe(first!.plan.planFingerprint);
    expect(current.status).toMatch(/completed/u);
    expect(current.presentation?.visibleEventIds.length).toBeGreaterThan(0);
    expect(sourceFetch.mock.calls.length).toBeGreaterThan(firstSourceCalls);
    expect(modelFetch).not.toHaveBeenCalled();
    const sourceWorkspace = refreshed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        discoveryTask: { state: string; nextAction: string;
          pendingStepCount: number };
        interpretationQueue: { status: string; totalCount: number };
      };
    expect(sourceWorkspace.discoveryTask).toMatchObject({
      state: expect.stringMatching(/^complete/u),
      nextAction: "none",
      pendingStepCount: 0,
    });
    expect(sourceWorkspace.interpretationQueue).toMatchObject({
      status: "ready",
      totalCount: current.presentation!.visibleEventIds.length,
    });

    const assessed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: refreshed.snapshot.revision,
        operationId: "screen4-assess-refreshed-same-plan-regression",
        expectedInvestigationFingerprint: current.investigationFingerprint,
      } },
    }), mutateTool);
    const assessedWorkspace = assessed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        interpretationQueue: { status: string; completedCount: number;
          results: Array<{ eventId: string; outcomePathway: string;
            nextCheck: string }> };
      };
    expect(assessedWorkspace.interpretationQueue).toMatchObject({
      status: "completed",
      completedCount: current.presentation!.visibleEventIds.length,
    });
    expect(assessedWorkspace.interpretationQueue.results).toEqual(
      expect.arrayContaining([expect.objectContaining({
        eventId: expect.any(String),
        outcomePathway: expect.stringContaining("performance"),
        nextCheck: expect.stringContaining("sampled firms"),
      })]),
    );
    expect(modelFetch).toHaveBeenCalledTimes(Math.ceil(
      current.presentation!.visibleEventIds.length / 4,
    ));
    const rendered = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      {
        workspace: assessed.wire.structuredContent
          .studyFirstEventInvestigationWorkspace as unknown as
            StudyFirstEventInvestigationWorkspace,
        disabled: false,
        onAnalyze: () => undefined,
      },
    ));
    const visibleTitle = current.occurrences.find(({ id }) =>
      id === current.presentation!.visibleEventIds[0])!.title;
    expect(rendered).toContain("Alternative shocks");
    expect(rendered).toContain(visibleTitle);
    expect(rendered).toContain("Why it may matter");
    expect(rendered).toContain("What should you check next");
    expect(rendered).toContain("sampled firms");
  });

  it("rebinds saved planned source steps after a method-only choice without fetching", async () => {
    const fixture = await harness();
    const { client, sourceFetch, modelFetch } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    expect(investigation?.status).toMatch(/completed/u);
    const advice = opened4.snapshot.state.studyDesignAdvices!.at(-1)!;
    const sourceCallsAfterFirstStep = sourceFetch.mock.calls.length;
    const decided = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "decide_study_design_advice",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-method-only-decision",
        adviceId: advice.adviceId,
        expectedAdviceFingerprint: advice.adviceFingerprint,
        decision: { mode: "selected", optionId: advice.options[0]!.optionId },
        rationale: "Retain this optional method choice for review.",
      } },
    }), mutateTool);
    const rebound = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4",
        expectedRevision: decided.snapshot.revision,
        operationId: "screen4-method-only-reopen",
      } },
    }), mutateTool);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterFirstStep);
    expect(modelFetch).not.toHaveBeenCalled();
    const workspace = rebound.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        discoveryTask: { completedStepCount: number; nextAction: string };
        investigation: { occurrences: unknown[] };
        documentedOccurrences: unknown[];
      };
    expect(workspace.discoveryTask).toMatchObject({
      nextAction: "none",
    });
    expect(workspace.discoveryTask.completedStepCount).toBeGreaterThan(1);
    expect(workspace.investigation.occurrences.length).toBeGreaterThan(0);
    expect(workspace.documentedOccurrences).toHaveLength(0);
    expect(rebound.snapshot.state.studyFirstEventInvestigations!.at(-1)!
      .snapshotId).not.toBe(investigation!.snapshotId);
  });

  it("delivers the first source scan after selecting a comparison on Screen 3", async () => {
    const fixture = await harness(["success"], undefined, 12);
    const { auth, opened3 } = await preparedScreen4(fixture);
    const advice = opened3.snapshot.state.studyDesignAdvices!.at(-1)!;
    const selected = accepted(await fixture.client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "decide_study_design_advice",
        expectedRevision: opened3.snapshot.revision,
        operationId: "select-comparison-before-first-event-scan",
        adviceId: advice.adviceId,
        expectedAdviceFingerprint: advice.adviceFingerprint,
        decision: { mode: "selected", optionId: advice.options[0]!.optionId },
        rationale: "Use this comparison for review.",
      } },
    }), mutateTool);
    const opened4 = accepted(await fixture.client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_4", expectedRevision: selected.snapshot.revision,
        operationId: "first-event-scan-with-selected-comparison",
      } },
    }), mutateTool);
    expect(opened4.snapshot.state.activeScreen).toBe(4);
    expect(opened4.snapshot.state.studyFirstEventInvestigations!.at(-1)!
      .presentation!.visibleEventIds.length).toBeGreaterThan(0);
    expect(fixture.modelFetch).not.toHaveBeenCalled();
  });

  it("assesses the same current shortlist after visiting Screen 5 without reopening or rescanning Screen 4", async () => {
    const fixture = await harness();
    const { client, sourceFetch, modelFetch } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const opened5 = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "open_screen_5",
        expectedRevision: opened4.snapshot.revision,
        operationId: "screen4-tool-open5-before-relevance",
      } },
    }), mutateTool);
    expect(opened5.snapshot.state.activeScreen).toBe(5);
    const sourceCalls = sourceFetch.mock.calls.length;
    const assessed = accepted(await client.callTool({
      name: mutateTool,
      arguments: { ...auth, mutation: {
        action: "analyze_study_first_events",
        expectedRevision: opened5.snapshot.revision,
        operationId: "screen4-tool-assess-after-local-return",
        expectedInvestigationFingerprint:
          investigation!.investigationFingerprint,
      } },
    }), mutateTool);
    expect(assessed.snapshot.state.activeScreen).toBe(5);
    expect(assessed.snapshot.state.screen4InterpretationAttempts?.at(-1))
      .toMatchObject({ status: "completed" });
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCalls);
    expect(modelFetch).toHaveBeenCalledTimes(Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4,
    ));
  });

  it("creates, reads, analyzes, rejects undeclared fields, and reopens without fetches", async () => {
    const { client, sourceFetch, modelFetch } = await harness();
    const { auth, opened4, investigation } = await openedScreen4({
      client, sourceFetch, modelFetch,
    });
    const mutation = {
      action: "analyze_study_first_events",
      expectedRevision: opened4.snapshot.revision,
      operationId: "screen4-tool-analyze",
      expectedInvestigationFingerprint: investigation!.investigationFingerprint,
    };
    const sourceCallsBeforeInvalid = sourceFetch.mock.calls.length;
    const invalid = serialized(await client.callTool({
      name: mutateTool,
      arguments: {
        ...auth,
        mutation: { ...mutation, inventedProviderParameter: "ignore" },
      },
    }));
    expect(invalid.isError).toBe(true);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsBeforeInvalid);
    expect(modelFetch).not.toHaveBeenCalled();

    const analyzed = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation },
    }), mutateTool);
    const batchCount = Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4,
    );
    expect(modelFetch).toHaveBeenCalledTimes(batchCount);
    const providerBodies = modelFetch.mock.calls.map(([, init]) =>
      String(init?.body));
    const admittedPackets = providerBodies.map((body) => {
      const request = JSON.parse(body);
      const packet = JSON.parse(request.input[0].content[0].text) as {
        events: Array<{ slot_id: string }>;
      };
      const bytes = new TextEncoder().encode(body).byteLength;
      const inputEstimate = Math.ceil(bytes / 3.5) + 256;
      expect(bytes).toBeLessThanOrEqual(SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES);
      expect(inputEstimate).toBeLessThanOrEqual(
        modelTaskProfile("screen4_event_interpretation").inputCeiling);
      expect(packet.events.length).toBeGreaterThan(0);
      expect(packet.events.length).toBeLessThanOrEqual(4);
      expect(packet.events.map(({ slot_id }) => slot_id)).toEqual(
        packet.events.map((_, index) => `event_${index + 1}`),
      );
      return { slots: packet.events.map(({ slot_id }) => slot_id),
        bytes, inputEstimate };
    });
    expect(admittedPackets.reduce((total, packet) =>
      total + packet.slots.length, 0))
      .toBe(investigation!.presentation!.visibleEventIds.length);
    expect(admittedPackets).toHaveLength(Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4));
    const attempts = analyzed.snapshot.state.screen4InterpretationAttempts ?? [];
    expect(attempts).toHaveLength(batchCount);
    expect(attempts.map(({ status }) => status))
      .toEqual(Array.from({ length: batchCount }, () => "completed"));
    expect(attempts.flatMap(({ eventIds }) => eventIds))
      .toEqual(investigation!.presentation!.visibleEventIds);
    const queue = (analyzed.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        interpretationQueue: {
          status: string;
          completedCount: number;
          totalCount: number;
          results: Array<{ eventId: string; sourceIds: string[] }>;
        };
      }).interpretationQueue;
    expect(queue).toMatchObject({
      status: "completed",
      completedCount: investigation!.presentation!.visibleEventIds.length,
      totalCount: investigation!.presentation!.visibleEventIds.length,
    });
    expect(queue.results.map(({ eventId }) => eventId))
      .toEqual(investigation!.presentation!.visibleEventIds);
    for (const item of queue.results) {
      const sourceIds = new Set(investigation!.occurrences.find(
        (event) => event.id === item.eventId)!.evidence.map(
          ({ sourceId }) => sourceId));
      expect(item.sourceIds.length).toBeGreaterThan(0);
      expect(item.sourceIds.every((sourceId) => sourceIds.has(sourceId)))
        .toBe(true);
    }
    const sourceCallsAfterAnalysis = sourceFetch.mock.calls.length;
    const modelCallsAfterAnalysis = modelFetch.mock.calls.length;

    const reopened = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(reopened.snapshot.stateFingerprint)
      .toBe(analyzed.snapshot.stateFingerprint);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterAnalysis);
    expect(modelFetch).toHaveBeenCalledTimes(modelCallsAfterAnalysis);

    const replayed = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation },
    }), mutateTool);
    expect(replayed.snapshot.stateFingerprint)
      .toBe(analyzed.snapshot.stateFingerprint);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterAnalysis);
    expect(modelFetch).toHaveBeenCalledTimes(modelCallsAfterAnalysis);
  });

  it("keeps a known 429 rejection held and requires a fresh explicit mutation to retry", async () => {
    const fixture = await harness(["rate_limited", "success"]);
    const { client, sourceFetch, modelFetch, ledger } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const firstMutation = {
      action: "analyze_study_first_events",
      expectedRevision: opened4.snapshot.revision,
      operationId: "screen4-tool-rate-limited",
      expectedInvestigationFingerprint: investigation!.investigationFingerprint,
    };
    const first = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation: firstMutation },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(1);
    expect(first.snapshot.state.screen4InterpretationAttempts).toMatchObject([{
      status: "failed", dispatchState: "dispatched",
      failureCode: "openai_rate_limited", failureStage: "response_headers",
      attemptOrdinal: 1, receipt: null,
    }]);
    const heldAfterFirst = await ledger.summary();
    expect(heldAfterFirst).toMatchObject({
      attemptsReserved: 1, attemptsHeld: 1, attemptsSettled: 0,
    });
    const savedFailure = first.snapshot.state.screen4InterpretationAttempts![0]!;
    for (const failureStage of ["response_body", "model_output"] as const) {
      const identifiers = screen4InterpretationAttemptIds({
        taskFingerprint: savedFailure.taskFingerprint,
        batchIndex: savedFailure.batchIndex,
        attemptOrdinal: 2,
      });
      expect(() => validateScreen4InterpretationAttempts({
        runId: auth.runId,
        investigations: [investigation!],
        attempts: [{ ...savedFailure, failureCode: "http_error", failureStage }, {
          ...savedFailure,
          ...identifiers,
          attemptOrdinal: 2,
          claimOperationId: null,
          status: "pending",
          dispatchState: "not_dispatched",
          failureCode: null,
          failureStage: null,
          receipt: null,
          result: null,
          error: null,
        }],
      })).toThrow("Stored Screen 4 interpretation attempt is invalid");
    }
    const sourcesBeforeRead = sourceFetch.mock.calls.length;
    accepted(await client.callTool({ name: getTool, arguments: auth }), getTool);
    expect(modelFetch).toHaveBeenCalledTimes(1);
    expect(sourceFetch).toHaveBeenCalledTimes(sourcesBeforeRead);

    const secondMutation = {
      ...firstMutation,
      expectedRevision: first.snapshot.revision,
      operationId: "screen4-tool-retry-after-rate-limit",
    };
    const second = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation: secondMutation },
    }), mutateTool);
    const successfulBatchCount = Math.ceil(
      investigation!.presentation!.visibleEventIds.length / 4,
    );
    expect(modelFetch).toHaveBeenCalledTimes(1 + successfulBatchCount);
    const attempts = second.snapshot.state.screen4InterpretationAttempts!;
    expect(attempts).toHaveLength(1 + successfulBatchCount);
    expect(attempts[0]).toMatchObject({
      status: "failed", dispatchState: "dispatched",
      failureCode: "openai_rate_limited", failureStage: "response_headers",
      attemptOrdinal: 1, receipt: null,
    });
    expect(attempts[1]).toMatchObject({
      status: "completed", dispatchState: "dispatched",
      batchIndex: 0, attemptOrdinal: 2,
    });
    expect(attempts.slice(1).every(({ status }) => status === "completed"))
      .toBe(true);
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 1 + successfulBatchCount,
      attemptsHeld: 1,
      attemptsSettled: successfulBatchCount,
    });
    const sourceCallsAfterRetry = sourceFetch.mock.calls.length;
    const reopened = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(reopened.snapshot.stateFingerprint)
      .toBe(second.snapshot.stateFingerprint);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterRetry);
    expect(modelFetch).toHaveBeenCalledTimes(1 + successfulBatchCount);
  });

  it("observes an unknown dispatched outcome without repeating the provider request", async () => {
    const fixture = await harness(["unknown"]);
    const { client, sourceFetch, modelFetch, ledger } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const mutation = {
      action: "analyze_study_first_events",
      expectedRevision: opened4.snapshot.revision,
      operationId: "screen4-tool-outcome-unknown",
      expectedInvestigationFingerprint: investigation!.investigationFingerprint,
    };
    const first = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(1);
    expect(first.snapshot.state.screen4InterpretationAttempts).toMatchObject([{
      status: "outcome_unknown", dispatchState: "dispatched",
      attemptOrdinal: 1, receipt: null,
    }]);
    const queue = (first.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        interpretationQueue: {
          status: string; retryEligibility: string;
        };
      }).interpretationQueue;
    expect(queue).toMatchObject({
      status: "outcome_unknown", retryEligibility: "observe",
    });
    expect(await ledger.summary()).toMatchObject({
      attemptsReserved: 1, attemptsHeld: 1, attemptsSettled: 0,
    });
    const sourceCallsAfterFirst = sourceFetch.mock.calls.length;
    const reopened = accepted(await client.callTool({
      name: getTool, arguments: auth,
    }), getTool);
    expect(reopened.snapshot.stateFingerprint)
      .toBe(first.snapshot.stateFingerprint);
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterFirst);
    expect(modelFetch).toHaveBeenCalledTimes(1);

    const replayed = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation },
    }), mutateTool);
    expect(replayed.snapshot.stateFingerprint)
      .toBe(first.snapshot.stateFingerprint);
    const newMutation = {
      ...mutation,
      expectedRevision: first.snapshot.revision,
      operationId: "screen4-tool-observe-unknown",
    };
    const observed = serialized(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation: newMutation },
    }));
    expect(observed.isError).toBe(true);
    const problemText = Array.isArray(observed.content)
      ? observed.content.find((item) => item && typeof item === "object" &&
        "type" in item && item.type === "text" && "text" in item)
      : null;
    expect(problemText).toBeTruthy();
    expect(decodeSixScreenWorkflowProblemText(String(
      (problemText as { text: unknown }).text,
    ))).toMatchObject({
      code: "external_outcome_unknown",
      stage: "execution",
      action: "analyze_study_first_events",
      screen: 4,
      expectedRevision: first.snapshot.revision,
      actualRevision: first.snapshot.revision,
      commitCertainty: "unknown",
      dispatchCertainty: "unknown",
      recovery: "observe_external",
      safeCauseCodes: ["external_outcome_unknown"],
    });
    expect(sourceFetch).toHaveBeenCalledTimes(sourceCallsAfterFirst);
    expect(modelFetch).toHaveBeenCalledTimes(1);
  });

  it("reclaims a stalled pre-dispatch claim after its grace period and fences the old owner", async () => {
    let clock = Date.parse("2026-09-24T12:00:00.000Z");
    const fixture = await harness(["success"], () =>
      new Date(clock).toISOString());
    const { client, sourceFetch, modelFetch, ledger } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const realInitialize = ledger.initialize.bind(ledger);
    let reportClaimed: () => void = () => undefined;
    let releaseOld: () => void = () => undefined;
    const claimed = new Promise<void>((resolve) => {
      reportClaimed = resolve;
    });
    const stalled = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    vi.spyOn(ledger, "initialize").mockImplementationOnce(async (input) => {
      reportClaimed();
      await stalled;
      return realInitialize(input);
    });
    const firstMutation = {
      action: "analyze_study_first_events",
      expectedRevision: opened4.snapshot.revision,
      operationId: "screen4-tool-stalled-owner",
      expectedInvestigationFingerprint: investigation!.investigationFingerprint,
    };
    const oldCall = client.callTool({
      name: mutateTool, arguments: { ...auth, mutation: firstMutation },
    });
    try {
      await claimed;
      const pending = accepted(await client.callTool({
        name: getTool, arguments: auth,
      }), getTool);
      const pendingClaim = pending.snapshot.state
        .screen4InterpretationAttempts?.[0]?.claimOperationId;
      expect(pendingClaim).toMatch(/^screen4-assessment-/u);
      expect(pending.snapshot.state.screen4InterpretationAttempts)
        .toMatchObject([{
          status: "pending", dispatchState: "not_dispatched",
        }]);
      expect(modelFetch).not.toHaveBeenCalled();
      const sourcesBeforeRecovery = sourceFetch.mock.calls.length;

      clock += 360_001;
      const recoverable = accepted(await client.callTool({
        name: getTool, arguments: auth,
      }), getTool);
      const queue = (recoverable.wire.structuredContent
        .studyFirstEventInvestigationWorkspace as {
          interpretationQueue: { status: string;
            retryEligibility: string; readiness: { canDispatch: boolean } };
        }).interpretationQueue;
      expect(queue).toMatchObject({ status: "ready",
        retryEligibility: "new_request",
        readiness: { canDispatch: true } });
      expect(sourceFetch).toHaveBeenCalledTimes(sourcesBeforeRecovery);
      expect(modelFetch).not.toHaveBeenCalled();

      const recovered = accepted(await client.callTool({
        name: mutateTool,
        arguments: {
          ...auth,
          mutation: {
            ...firstMutation,
            expectedRevision: recoverable.snapshot.revision,
            operationId: "screen4-tool-recovered-owner",
          },
        },
      }), mutateTool);
      const batchCount = Math.ceil(
        investigation!.presentation!.visibleEventIds.length / 4,
      );
      expect(modelFetch).toHaveBeenCalledTimes(batchCount);
      const recoveredAttempts = recovered.snapshot.state
        .screen4InterpretationAttempts!;
      expect(recoveredAttempts).toHaveLength(batchCount);
      expect(recoveredAttempts[0]).toMatchObject({
        status: "completed", dispatchState: "dispatched",
        attemptOrdinal: 1,
      });
      expect(recoveredAttempts.every(({ status }) => status === "completed"))
        .toBe(true);
      expect(recovered.snapshot.state.screen4InterpretationAttempts?.[0]
        ?.claimOperationId).not.toBe(pendingClaim);
      releaseOld();
      accepted(await oldCall, mutateTool);
      expect(modelFetch).toHaveBeenCalledTimes(batchCount);
      expect(sourceFetch).toHaveBeenCalledTimes(sourcesBeforeRecovery);
      const reopened = accepted(await client.callTool({
        name: getTool, arguments: auth,
      }), getTool);
      expect(reopened.snapshot.stateFingerprint)
        .toBe(recovered.snapshot.stateFingerprint);
      expect(await ledger.summary()).toMatchObject({
        attemptsReserved: batchCount,
        attemptsSettled: batchCount,
        attemptsHeld: 0,
      });
    } finally {
      releaseOld();
      await oldCall.catch(() => undefined);
    }
  });

  it("completes a high-yield relevance-bounded queue in one explicit action", async () => {
    const fixture = await harness(
      ["success", "success", "success"], undefined, 5,
    );
    const { client, sourceFetch, modelFetch } = fixture;
    const { auth, opened4, investigation } = await openedScreen4(fixture);
    const visibleEventIds = investigation!.presentation!.visibleEventIds;
    expect(visibleEventIds.length).toBeGreaterThan(8);
    expect(visibleEventIds.length).toBeLessThanOrEqual(10);
    const mutation = {
      action: "analyze_study_first_events",
      expectedRevision: opened4.snapshot.revision,
      operationId: "screen4-tool-five-events-first",
      expectedInvestigationFingerprint: investigation!.investigationFingerprint,
    };
    const sourcesBefore = sourceFetch.mock.calls.length;
    const first = accepted(await client.callTool({
      name: mutateTool, arguments: { ...auth, mutation },
    }), mutateTool);
    expect(modelFetch).toHaveBeenCalledTimes(Math.ceil(
      visibleEventIds.length / 4,
    ));
    expect(first.snapshot.state.screen4InterpretationAttempts).toMatchObject([
      { batchIndex: 0, status: "completed", eventIds:
        investigation!.presentation!.visibleEventIds.slice(0, 4) },
      { batchIndex: 1, status: "completed", eventIds:
        investigation!.presentation!.visibleEventIds.slice(4, 8) },
      { batchIndex: 2, status: "completed", eventIds:
        investigation!.presentation!.visibleEventIds.slice(8) },
    ]);
    expect(first.snapshot.state.screen4InterpretationAttempts).toHaveLength(3);
    const completeQueue = (first.wire.structuredContent
      .studyFirstEventInvestigationWorkspace as {
        interpretationQueue: { status: string;
          retryEligibility: string; completedCount: number;
          totalCount: number; results: Array<{ eventId: string }> };
      }).interpretationQueue;
    expect(completeQueue).toMatchObject({
      status: "completed",
      completedCount: visibleEventIds.length,
      totalCount: visibleEventIds.length,
    });
    expect(completeQueue.results.map(({ eventId }) => eventId))
      .toEqual(investigation!.presentation!.visibleEventIds);
    expect(sourceFetch).toHaveBeenCalledTimes(sourcesBefore);
  });

});
