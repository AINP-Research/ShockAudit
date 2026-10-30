import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SixScreenWorkflowProblemError,
  decodeSixScreenWorkflowProblemText,
} from
  "../../src/core/six-screen/workflow-problem";
import type { StudyContextDraft } from
  "../../src/core/six-screen/workflow";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";

const runId = `sa6r_${"r".repeat(43)}`;
const accessToken = `sa6a_${"a".repeat(43)}`;
const privateStudyText = "PRIVATE-STUDY-TEXT-MUST-NOT-LEAK";

const study: StudyContextDraft = {
  population: "California firms",
  analysisUnit: "Firm-year",
  geography: ["California", "United States"],
  industry: [],
  period: { start: "2018", end: "2024" },
  outcome: "Firm performance",
  outcomeMeasure: "ROA",
  intendedConstruct: null,
  policySideConcept: "Transparency enhancement",
  initialExplanation: null,
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

const connected: Array<{ client: Client; server: McpServer }> = [];

async function registeredHarness(runtime: SixScreenWorkflowRuntime) {
  const server = new McpServer(
    { name: "workflow-problem-integration", version: "1.0.0" },
  );
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "problem-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return client;
}

async function runtimeHarness() {
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  let tick = 0;
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "workflow-problem-test-signing-key-at-least-thirty-two-bytes",
    now: () => new Date(Date.parse("2026-09-25T12:00:00.000Z") +
      tick++).toISOString(),
    fetch: vi.fn(async () => {
      throw new Error("No source call is authorized in this test.");
    }),
  });
  const created = await runtime.create({
    operationId: "problem-integration-create",
    shockInput: "Synthetic policy",
    study,
  });
  return {
    runtime,
    store,
    auth: {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    },
    created,
  };
}

function decodedProblem(result: Awaited<ReturnType<Client["callTool"]>>) {
  const text = result.content.find((item) => item.type === "text")?.text;
  expect(typeof text).toBe("string");
  return decodeSixScreenWorkflowProblemText(String(text));
}

afterEach(async () => {
  await Promise.all(connected.splice(0).map(async ({ client, server }) => {
    await client.close();
    await server.close();
  }));
});

describe("registered six-screen workflow problem transport", () => {
  it("rejects invalid Screen 3 timing inside the callback with a safe field path before runtime", async () => {
    const openScreen3 = vi.fn();
    const runtime = { openScreen3 } as unknown as SixScreenWorkflowRuntime;
    const client = await registeredHarness(runtime);

    const listed = await client.listTools();
    const definition = listed.tools.find(({ name }) =>
      name === "mutate_six_screen_workflow_v1");
    expect(definition?.inputSchema).toMatchObject({
      type: "object",
      required: ["runId", "accessToken", "mutation"],
      additionalProperties: false,
    });

    const response = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId,
        accessToken,
        mutation: {
          action: "open_screen_3",
          expectedRevision: 4,
          operationId: "screen3-invalid-year",
          study: { ...study, population: privateStudyText },
          proposedTiming: {
            mode: "year",
            year: "2020",
            milestoneReference: null,
          },
        },
      },
    });

    expect(response.isError).toBe(true);
    expect(decodedProblem(response)).toMatchObject({
      code: "request_contract",
      stage: "request_validation",
      action: "open_screen_3",
      screen: 3,
      expectedRevision: 4,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      fieldIssues: [{
        fieldPath: "proposedTiming.year",
        code: "invalid_type",
      }],
    });
    expect(JSON.stringify(response)).not.toContain(privateStudyText);
    expect(JSON.stringify(response)).not.toContain(accessToken);
    expect(openScreen3).not.toHaveBeenCalled();
  });

  it("encodes outer wire rejection instead of returning the SDK validation prose", async () => {
    const updateStudy = vi.fn();
    const runtime = { updateStudy } as unknown as SixScreenWorkflowRuntime;
    const client = await registeredHarness(runtime);
    const response = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId: "not-a-run-id",
        accessToken,
        mutation: {
          action: "update_study",
          expectedRevision: 0,
          operationId: "outer-contract-rejection",
          study,
        },
      },
    });

    expect(response.isError).toBe(true);
    expect(decodedProblem(response)).toMatchObject({
      code: "request_contract",
      stage: "request_validation",
      action: "update_study",
      screen: 1,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      fieldIssues: [{ fieldPath: "runId", code: "invalid_format" }],
    });
    expect(JSON.stringify(response)).not.toContain("not-a-run-id");
    expect(updateStudy).not.toHaveBeenCalled();
  });

  it("marks invalid post-runtime serialization as committed and records model dispatch certainty", async () => {
    const personalizeScreen3 = vi.fn(async () => ({
      projection: {
        statusMessage: privateStudyText,
        undeclaredProjection: true,
      },
      privateSnapshot: { revision: 7, accessToken },
      mutationOutcome: "changed",
    }));
    const runtime = {
      personalizeScreen3,
    } as unknown as SixScreenWorkflowRuntime;
    const client = await registeredHarness(runtime);
    const response = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        runId,
        accessToken,
        mutation: {
          action: "personalize_screen3_advice",
          expectedRevision: 6,
          operationId: "screen3-postcommit-contract",
          expectedAdviceFingerprint: "fnv1a64:1111111111111111",
        },
      },
    });

    expect(response.isError).toBe(true);
    expect(decodedProblem(response)).toMatchObject({
      code: "response_contract",
      stage: "serialization",
      action: "personalize_screen3_advice",
      screen: 3,
      expectedRevision: 6,
      actualRevision: 7,
      commitCertainty: "committed",
      dispatchCertainty: "dispatched",
      recovery: "check_status",
      safeCauseCodes: ["response_contract_invalid"],
    });
    expect(personalizeScreen3).toHaveBeenCalledOnce();
    expect(JSON.stringify(response)).not.toContain(privateStudyText);
    expect(JSON.stringify(response)).not.toContain(accessToken);
  });

  it("preserves typed stale and operation-identity failures through the registered MCP result", async () => {
    const fixture = await runtimeHarness();
    const client = await registeredHarness(fixture.runtime);
    const stale = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        ...fixture.auth,
        mutation: {
          action: "update_study",
          expectedRevision: 99,
          operationId: "typed-stale-operation",
          study,
        },
      },
    });
    expect(decodedProblem(stale)).toMatchObject({
      code: "revision_conflict",
      stage: "revision_check",
      expectedRevision: 99,
      actualRevision: 0,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "guarded_rebase",
      safeCauseCodes: ["stale_revision"],
    });

    const first = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        ...fixture.auth,
        mutation: {
          action: "update_study",
          expectedRevision: 0,
          operationId: "typed-operation-conflict",
          study: { ...study, outcomeMeasure: "ROA" },
        },
      },
    });
    expect(first.isError).not.toBe(true);
    const conflict = await client.callTool({
      name: "mutate_six_screen_workflow_v1",
      arguments: {
        ...fixture.auth,
        mutation: {
          action: "update_study",
          expectedRevision: 0,
          operationId: "typed-operation-conflict",
          study: { ...study, outcomeMeasure: "EBITDA margin" },
        },
      },
    });
    expect(decodedProblem(conflict)).toMatchObject({
      code: "operation_identity_conflict",
      stage: "revision_check",
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["operation_conflict"],
    });
  });

  it("transports bounded authorization failures for each long-running screen action", async () => {
    const fixture = await runtimeHarness();
    const client = await registeredHarness(fixture.runtime);
    const wrongToken = `sa6a_${"z".repeat(43)}`;
    const missingRun = `sa6r_${"x".repeat(43)}`;
    const cases = [
      {
        screen: 4,
        action: "open_screen_4",
        mutation: {
          action: "open_screen_4",
          expectedRevision: 0,
          operationId: "typed-open-screen4-auth",
        },
      },
      {
        screen: 5,
        action: "authorize_study_first_mechanism_job",
        mutation: {
          action: "authorize_study_first_mechanism_job",
          expectedRevision: 0,
          operationId: "typed-authorize-screen5-auth",
          expectedExecutionFingerprint: "fnv1a64:1111111111111111",
        },
      },
      {
        screen: 5,
        action: "advance_study_first_mechanism_job",
        mutation: {
          action: "advance_study_first_mechanism_job",
          expectedRevision: 0,
          operationId: "typed-advance-screen5-auth",
          retry: false,
        },
      },
      {
        screen: 6,
        action: "personalize_screen6_plan",
        mutation: {
          action: "personalize_screen6_plan",
          expectedRevision: 0,
          operationId: "typed-personalize-screen6-auth",
          expectedPlanFingerprint: "fnv1a64:2222222222222222",
        },
      },
    ] as const;

    for (const target of cases) {
      for (const [auth, cause] of [
        [{ runId: fixture.auth.runId, accessToken: wrongToken },
          "authorization_failed"],
        [{ runId: missingRun, accessToken: fixture.auth.accessToken },
          "run_unavailable"],
      ] as const) {
        const response = await client.callTool({
          name: "mutate_six_screen_workflow_v1",
          arguments: { ...auth, mutation: target.mutation },
        });
        expect(response.isError).toBe(true);
        expect(decodedProblem(response)).toMatchObject({
          code: "authorization",
          stage: "authorization",
          action: target.action,
          screen: target.screen,
          expectedRevision: 0,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "reconnect",
          safeCauseCodes: [cause],
        });
        expect(JSON.stringify(response)).not.toContain(auth.accessToken);
        expect(JSON.stringify(response)).not.toContain(auth.runId);
      }
    }
  });
});

describe("six-screen runtime problem staging", () => {
  it("marks a projection exception after a durable mutation as committed", async () => {
    const fixture = await runtimeHarness();
    const projectionInternals = fixture.runtime as unknown as {
      projectionWithScreen5Readiness: () => Promise<never>;
    };
    projectionInternals.projectionWithScreen5Readiness = vi.fn(async () => {
      throw new Error(privateStudyText);
    });

    let caught: unknown;
    try {
      await fixture.runtime.updateStudy(fixture.auth, {
        expectedRevision: 0,
        operationId: "postcommit-projection-failure",
        study: { ...study, outcomeMeasure: "Operating margin" },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "projection_failure",
      stage: "projection",
      action: "update_study",
      screen: 1,
      expectedRevision: 0,
      actualRevision: 1,
      commitCertainty: "committed",
      dispatchCertainty: "not_dispatched",
      recovery: "restore_local_artifact",
      safeCauseCodes: ["projection_failed"],
    });
    expect(JSON.stringify(caught)).not.toContain(privateStudyText);

    const saved = await fixture.store.read(fixture.auth);
    expect(saved).toMatchObject({
      outcome: "found",
      record: {
        state: { revision: 1, study: { outcomeMeasure: "Operating margin" } },
      },
    });
  });

  it("classifies missing and unauthorized mutation targets without leaking credentials", async () => {
    const fixture = await runtimeHarness();
    const wrongToken = `sa6a_${"z".repeat(43)}`;
    const missingRun = `sa6r_${"x".repeat(43)}`;
    for (const [authentication, cause] of [
      [{ runId: fixture.auth.runId, accessToken: wrongToken },
        "authorization_failed"],
      [{ runId: missingRun, accessToken: fixture.auth.accessToken },
        "run_unavailable"],
    ] as const) {
      let caught: unknown;
      try {
        await fixture.runtime.updateStudy(authentication, {
          expectedRevision: 0,
          operationId: `auth-${cause}`,
          study,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
      expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
        code: "authorization",
        stage: "authorization",
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        safeCauseCodes: [cause],
      });
      expect(JSON.stringify(caught)).not.toContain(authentication.accessToken);
      expect(JSON.stringify(caught)).not.toContain(authentication.runId);
    }
  });
});
