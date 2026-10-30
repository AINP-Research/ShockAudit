import worker, { ShockAuditMcp } from "../../src/worker/index";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { StudyContextDraft } from
  "../../src/core/six-screen/workflow";
import { SixScreenWorkflowStore } from
  "../../src/worker/six-screen-workflow-store";
import type { ShockAuditEnv } from "../../src/worker/server";
import {
  browserEventCardFixtureAccessToken,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const MCP_RUNTIME_OBJECT_NAME = "shockaudit-mcp-v1";
const FIXTURE_PATH = "/__persistence-fixture/screen3-handoff";
const FIXTURE_SCHEMA_VERSION = "screen3-handoff-persistence-fixture-v1";
const FIXTURE_OPERATION_ID = "screen3-handoff-persistence-open-v1";
const FIXTURE_OPERATION_KIND = "open_screen_3";
const DROP_RESPONSE_HEADER = "x-shockaudit-test-drop-open-screen3-response";
const SOURCE_CALL_COUNTER_KEY =
  "__shockaudit-test:screen3-handoff-source-call-count";

type PersistenceFixtureEnv = ShockAuditEnv & {
  MCP_RUNTIME: DurableObjectNamespace;
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function fixtureStudy(): StudyContextDraft {
  return {
    population: "Covered market operators",
    analysisUnit: "Operator",
    geography: ["United States"],
    industry: ["Energy"],
    period: { start: "2019", end: "2023" },
    outcome: "Market participation",
    outcomeMeasure: "Annual participation rate",
    intendedConstruct: "Historical wording retained for migration only",
    policySideConcept: "Policy-induced participation",
    initialExplanation:
      "The proposed pathway is a change in participation incentives.",
    proposedTreatment: "Covered market operators",
    proposedComparison: "Otherwise comparable uncovered market operators",
    resultsPreviouslyInspected: "no",
  };
}

function openScreen3Payload(study = fixtureStudy()) {
  return {
    study,
    proposedTiming: {
      mode: "year" as const,
      year: 2020,
      milestoneReference: null,
    },
  };
}

function openScreen3RuntimePayload(
  payload: ReturnType<typeof openScreen3Payload>,
) {
  return { ...payload, clarifications: null };
}

async function isDroppedOpenScreen3Request(request: Request) {
  if (request.headers.get(DROP_RESPONSE_HEADER) !== "true") return false;
  try {
    const body = await request.clone().json() as {
      method?: unknown;
      params?: { name?: unknown; arguments?: {
        mutation?: { action?: unknown; operationId?: unknown };
      } };
    };
    return body.method === "tools/call" &&
      body.params?.name === "mutate_six_screen_workflow_v1" &&
      body.params.arguments?.mutation?.action === FIXTURE_OPERATION_KIND &&
      body.params.arguments.mutation.operationId === FIXTURE_OPERATION_ID;
  } catch {
    return false;
  }
}

/**
 * Test-only Durable Object wrapper. It seeds one validated synthetic workflow
 * into the production SixScreenWorkflowStore, and otherwise delegates every
 * request to the production ShockAuditMcp implementation. The controlled
 * response-loss branch waits for that implementation to finish and consume
 * its finite response before replacing only the delivery with HTTP 502.
 */
export class ShockAuditPersistenceMcp extends ShockAuditMcp {
  private readonly fixtureState: DurableObjectState;

  constructor(state: DurableObjectState, env: PersistenceFixtureEnv) {
    const guardedEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async () => {
        const current = await state.storage.get<number>(SOURCE_CALL_COUNTER_KEY)
          ?? 0;
        await state.storage.put(SOURCE_CALL_COUNTER_KEY, current + 1);
        throw new Error(
          "The persistence fixture forbids every source transport.",
        );
      },
    };
    super(state, guardedEnv);
    this.fixtureState = state;
  }

  override async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === FIXTURE_PATH) {
      const fixture = createBrowserEventCardFixture();
      const study = fixtureStudy();
      const store = new SixScreenWorkflowStore(this.fixtureState.storage);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.parse(now) + 60 * 60 * 1_000)
        .toISOString();
      const created = await store.create({
        state: fixture.state,
        accessToken: browserEventCardFixtureAccessToken,
        createInputFingerprint: fingerprintSixScreenValue({
          fixture: FIXTURE_SCHEMA_VERSION,
          runId: fixture.state.runId,
        }),
        createdAt: now,
        expiresAt,
      });
      if (created.outcome !== "created" && created.outcome !== "replayed") {
        return json({ error: "fixture_seed_conflict" }, 409);
      }
      const payload = openScreen3Payload();
      const changedPayload = openScreen3Payload({
        ...study,
        outcome: "Changed outcome that must conflict with the saved receipt",
      });
      return json({
        schemaVersion: FIXTURE_SCHEMA_VERSION,
        runId: fixture.state.runId,
        accessToken: browserEventCardFixtureAccessToken,
        revision: fixture.state.revision,
        stateFingerprint: created.record.stateFingerprint,
        operationId: FIXTURE_OPERATION_ID,
        operationKind: FIXTURE_OPERATION_KIND,
        payload,
        inputFingerprint: fingerprintSixScreenValue(
          openScreen3RuntimePayload(payload),
        ),
        changedPayload,
        changedInputFingerprint: fingerprintSixScreenValue(
          openScreen3RuntimePayload(changedPayload),
        ),
      });
    }
    if (request.method === "GET" && url.pathname === FIXTURE_PATH) {
      return json({
        schemaVersion: FIXTURE_SCHEMA_VERSION,
        sourceCalls:
          await this.fixtureState.storage.get<number>(SOURCE_CALL_COUNTER_KEY)
            ?? 0,
      });
    }
    const dropResponse = await isDroppedOpenScreen3Request(request);
    const response = await super.fetch(request);
    if (!dropResponse) return response;
    const completedBody = await response.arrayBuffer();
    const completedText = new TextDecoder().decode(completedBody);
    if (response.status < 200 || response.status >= 300 ||
        completedText.includes('"isError":true')) {
      return new Response(completedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return json({
      error: "controlled_delivery_loss_after_durable_commit",
    }, 502);
  }
}

export default {
  async fetch(
    request: Request,
    env: PersistenceFixtureEnv,
    context: ExecutionContext,
  ) {
    const url = new URL(request.url);
    if (url.pathname === FIXTURE_PATH) {
      const objectId = env.MCP_RUNTIME.idFromName(MCP_RUNTIME_OBJECT_NAME);
      return env.MCP_RUNTIME.get(objectId).fetch(request);
    }
    return worker.fetch(request as never, env, context);
  },
} satisfies ExportedHandler<PersistenceFixtureEnv>;
