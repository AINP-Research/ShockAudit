import { describe, expect, it } from "vitest";

import {
  SCREEN_02_WORKFLOW_META_KEY,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  decryptScreen02WorkflowClientSnapshot,
  exportScreen02ResponseKeyMaterial,
  generateScreen02ResponseKeyMaterial,
  type Screen02SealedResultKind,
} from "../../src/core/screen02-sealed-result";
import { REVIEWED_SCREEN02_EVENT_REGISTRY } from
  "../../src/core/screen02-registry";
import { ShockAuditMcp } from "../../src/worker/index";
import { UK_LEGISLATION_ATOM_ENDPOINT } from
  "../../src/worker/screen02-global-connectors";
import type { ShockAuditEnv } from "../../src/worker/server";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";

const financialServicesActTitle = "Financial Services Act 2012";
const financialServicesActLocator =
  "https://www.legislation.gov.uk/ukpga/2012/21";
const financialServicesActRecordId =
  "http://www.legislation.gov.uk/id/ukpga/2012/21";

const financialServicesAtom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
  <title>UK Legislation matching Financial services</title>
  <updated>2026-09-10T00:00:00Z</updated>
  <entry>
    <id>${financialServicesActRecordId}</id>
    <title>${financialServicesActTitle}</title>
    <updated>2012-12-19T00:00:00Z</updated>
    <ukm:EnactmentDate Date="2012-12-19"/>
    <ukm:DocumentMainType Value="UnitedKingdomPublicGeneralAct"/>
    <link rel="alternate" type="text/html"
          href="${financialServicesActLocator}"/>
  </entry>
</feed>`;

// Representative bounded visible text from an official legislation page.
// It establishes identity, enactment/commencement, regulator functions, and
// covered-entity duties, but deliberately claims no investment outcome.
const financialServicesActHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>${financialServicesActTitle}</title>
    <link rel="canonical" href="${financialServicesActLocator}/contents">
    <meta name="DC.title" content="${financialServicesActTitle}">
    <meta name="Legislation.year" content="2012">
  </head>
  <body>
    <main>
      <h1>${financialServicesActTitle}</h1>
      <p>Official identifier: ukpga/2012/21.</p>
      <p>Issuer: Parliament of the United Kingdom.</p>
      <p>Jurisdiction: United Kingdom.</p>
      <p>Status: In force.</p>
      <p>The Financial Services Act 2012 was enacted on 2012-12-19.</p>
      <p>The Act establishes functions for the Financial Conduct Authority and the Prudential Regulation Authority in the regulation of financial services.</p>
      <p>Covered United Kingdom financial services firms and authorised persons must comply with rules made under the statutory framework.</p>
      <p>Effective date: 2013-04-01. The relevant regulatory provisions came into force on 2013-04-01.</p>
      <p>The official record does not establish an investment outcome or that every firm in the research population is covered.</p>
    </main>
  </body>
</html>`;

type ToolPayload = {
  error?: unknown;
  result?: {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
};

function mcpRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify(body),
  });
}

async function readMcpPayload(response: Response) {
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body.split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) throw new Error(`MCP response contained no SSE data: ${body}`);
    return JSON.parse(data) as ToolPayload;
  }
  return JSON.parse(body) as ToolPayload;
}

function workflowSnapshot(payload: ToolPayload) {
  const snapshot = restoreScreen02WorkflowClientSnapshot(
    payload.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY],
  );
  if (!snapshot) {
    throw new Error(
      `MCP result did not contain a valid private workflow snapshot: ${JSON.stringify(payload.result?.content)}`,
    );
  }
  return snapshot;
}

function durableObjectStateHarness() {
  const records = new Map<string, unknown>();
  const clone = <T>(value: T) => structuredClone(value);
  const storage = {
    get: async (key: string) =>
      records.has(key) ? clone(records.get(key)) : undefined,
    list: async ({
      prefix = "",
      limit = Number.POSITIVE_INFINITY,
    }: {
      prefix?: string;
      limit?: number;
    }) => new Map(
      [...records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, limit)
        .map(([key, value]) => [key, clone(value)]),
    ),
    transaction: async <T>(
      callback: (transaction: DurableObjectTransaction) => Promise<T>,
    ) => {
      const writes = new Map<string, unknown>();
      const deletions = new Set<string>();
      const transaction = {
        get: async (key: string) => {
          const value = deletions.has(key)
            ? undefined
            : writes.has(key)
              ? writes.get(key)
              : records.get(key);
          return value === undefined ? undefined : clone(value);
        },
        put: async (key: string, value: unknown) => {
          deletions.delete(key);
          writes.set(key, clone(value));
        },
        delete: async (key: string) => {
          writes.delete(key);
          deletions.add(key);
        },
      } as unknown as DurableObjectTransaction;
      const result = await callback(transaction);
      for (const key of deletions) records.delete(key);
      for (const [key, value] of writes) records.set(key, value);
      return result;
    },
    setAlarm: async () => undefined,
    deleteAlarm: async () => undefined,
  } as unknown as DurableObjectStorage;
  return {
    state: {
      storage,
      waitUntil: () => undefined,
    } as unknown as DurableObjectState,
  };
}

function ukFinancialServicesContext() {
  const base = confirmedWorkflowFindContext("Financial services", {
    studyPeriod: "2010–2020",
    outcomeFamily: "Investment",
    eventDescriptor: "regulation",
  });
  const sentence =
    "Find a regulation affecting United Kingdom financial services firms from 2010 to 2020 that may influence investment.";
  return {
    ...base,
    studySentence: sentence,
    contractSourceSentence: sentence,
    scopeContract: {
      ...base.scopeContract,
      population: "United Kingdom financial services firms",
      geography: "United Kingdom",
    },
    revision: base.revision + 1,
  };
}

describe("Screen 2 UK financial-services discovery acceptance", () => {
  it("persists one positive official result, displays and selects its card, and hands it to Screen 3", async () => {
    const durable = durableObjectStateHarness();
    const catalogRequests: Array<{ url: URL; init?: RequestInit }> = [];
    const documentRequests: Array<{ url: URL; init?: RequestInit }> = [];
    const unavailableReviewedDocuments: URL[] = [];
    const unexpectedRequests: string[] = [];
    const reviewedRegistryLocators = new Set(
      REVIEWED_SCREEN02_EVENT_REGISTRY.flatMap((proposal) =>
        proposal.sources.map((source) => source.locator)
      ),
    );
    const connectorFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> =
      async (input, init) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        if (
          url.origin === new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin &&
          url.pathname.endsWith("/data.feed")
        ) {
          catalogRequests.push({ url, init });
          return new Response(financialServicesAtom, {
            headers: {
              "content-type": "application/atom+xml; charset=utf-8",
            },
          });
        }
        if (url.toString() === financialServicesActLocator) {
          documentRequests.push({ url, init });
          return new Response(financialServicesActHtml, {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "last-modified": "Wed, 19 Dec 2012 12:00:00 GMT",
            },
          });
        }
        if (reviewedRegistryLocators.has(url.toString())) {
          unavailableReviewedDocuments.push(url);
          return new Response(
            "Focused UK acceptance replay does not include this unrelated reviewed document.",
            { status: 404, headers: { "content-type": "text/plain" } },
          );
        }
        unexpectedRequests.push(url.toString());
        throw new Error(`Unexpected UK acceptance request: ${url}`);
      };

    let now = "2026-09-10T12:00:00.000Z";
    const env = {
      ASSETS: {
        fetch: async () => new Response(
          "<!doctype html><html><body><div id=\"root\"></div></body></html>",
          { headers: { "content-type": "text/html" } },
        ),
      },
      CONNECTOR_FETCH: connectorFetch,
      NOW: () => now,
      SCREEN02_SEARCH_MONOTONIC_NOW: Date.now,
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
      SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
      SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen02-uk-acceptance-v1",
      SCREEN02_WORKFLOW_SIGNING_KEY:
        "ShockAudit-UK-financial-services-acceptance-signing-key-v1",
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: undefined,
    } as unknown as ShockAuditEnv;
    let rpcId = 0;
    const callTool = async (
      name: string,
      args: Record<string, unknown>,
    ) => {
      rpcId += 1;
      // Each public call gets a fresh runtime instance. The successful journey
      // therefore depends on the shared Durable Object records, including the
      // private continuation checkpoint, rather than isolate-local state.
      const response = await new ShockAuditMcp(durable.state, env as never)
        .fetch(mcpRequest({
          jsonrpc: "2.0",
          id: rpcId,
          method: "tools/call",
          params: { name, arguments: args },
        }));
      expect(response.status).toBe(200);
      const payload = await readMcpPayload(response);
      expect(payload.error).toBeUndefined();
      expect(
        payload.result?.isError,
        JSON.stringify(payload.result?.content),
      ).not.toBe(true);
      return payload;
    };
    const callSealedTool = async (
      name: string,
      args: Record<string, unknown>,
      operationId: string,
      kind: Screen02SealedResultKind,
    ) => {
      const responseKey = await generateScreen02ResponseKeyMaterial();
      const exportedResponseKey =
        await exportScreen02ResponseKeyMaterial(responseKey);
      const payload = await callTool(name, {
        ...args,
        responseKeyId: exportedResponseKey.keyId,
        responseKey: exportedResponseKey.key,
      });
      const snapshot = await decryptScreen02WorkflowClientSnapshot(
        payload.result?.structuredContent?.sealedSnapshot,
        { operationId, kind, responseKey },
      );
      expect(workflowSnapshot(payload)).toEqual(snapshot);
      return { payload, snapshot };
    };
    const mutate = (
      current: Screen02WorkflowClientSnapshot,
      operationId: string,
      action: string,
      payload: Record<string, unknown> = {},
    ) => callSealedTool(
      "mutate_screen02_workflow_v024",
      {
        schemaVersion: "screen-02-workflow-action-v2",
        operationId,
        runId: current.runId,
        accessToken: current.accessToken,
        expectedRevision: current.revision,
        expectedStateFingerprint: current.stateFingerprint,
        action,
        payload,
      },
      operationId,
      "mutation",
    );

    const openOperationId = "uk-financial-services-open";
    const { snapshot: opened } = await callSealedTool(
      "create_screen02_workflow_v024",
      {
        schemaVersion: "screen-02-workflow-create-v2",
        operationId: openOperationId,
        studyContext: ukFinancialServicesContext(),
      },
      openOperationId,
      "open",
    );

    now = "2026-09-10T12:00:01.000Z";
    const { snapshot: searching } = await mutate(
      opened,
      "uk-financial-services-search",
      "find-search",
      { criteria: [] },
    );
    const searchingState = stateFromScreen02WorkflowClientSnapshot(searching);
    expect(searchingState.mode).toBe("find");
    if (searchingState.mode !== "find") throw new Error("Expected Find mode.");
    expect(searchingState.discoveryRequests.at(-1)?.status).toBe("searching");
    expect(catalogRequests).toHaveLength(0);

    let latest = searching;
    let terminal: Screen02WorkflowClientSnapshot | null = null;
    let continuationCalls = 0;
    for (let index = 1; index <= 12; index += 1) {
      now = `2026-09-10T12:00:${String(index + 1).padStart(2, "0")}.000Z`;
      const { snapshot } = await mutate(
        latest,
        `uk-financial-services-continue-${index}`,
        "find-search-continue",
      );
      continuationCalls += 1;
      const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
      if (state.mode !== "find") throw new Error("Expected Find mode.");
      if (state.discoveryRequests.at(-1)?.status === "searching") {
        latest = snapshot;
        continue;
      }
      terminal = snapshot;
      break;
    }

    expect(continuationCalls).toBeGreaterThan(0);
    expect(terminal).not.toBeNull();
    if (!terminal) throw new Error("The UK search did not reach terminal state.");
    const terminalState = stateFromScreen02WorkflowClientSnapshot(terminal);
    if (terminalState.mode !== "find") throw new Error("Expected Find mode.");
    expect(terminalState.discoveryRequests.at(-1)?.status).toBe("completed");
    const activeSet = terminalState.candidateSets.find(
      (set) =>
        set.candidateSetSnapshotId === terminalState.activeCandidateSetSnapshotId,
    );
    expect(activeSet).toBeDefined();
    const displayedCards = activeSet!.candidateSnapshotIds.map(
      (candidateSnapshotId) => terminalState.candidates.find(
        (candidate) => candidate.candidateSnapshotId === candidateSnapshotId,
      ),
    ).filter((candidate) => candidate !== undefined);
    expect(displayedCards).toHaveLength(1);
    const card = displayedCards[0]!;
    expect(card.identity).toMatchObject({
      canonicalTitle: financialServicesActTitle,
      formalIdentifier: "ukpga/2012/21",
      issuingJurisdiction: "United Kingdom",
      eventType: "Regulation",
    });
    expect(["direct", "adjacent"]).toContain(
      card.qualification?.classification,
    );
    expect(card.qualification).toMatchObject({
      eligible: true,
      hardScope: { passed: true, blockingKeys: [] },
      substantiveOverview: { passed: true },
      sourceQuality: { status: "high" },
    });
    const cardSources = terminalState.sources.filter((source) =>
      card.sourceIds.includes(source.id)
    );
    expect(cardSources).toContainEqual(expect.objectContaining({
      locator: financialServicesActLocator,
      publisher: "The National Archives, legislation.gov.uk",
      authorityTier: 2,
      evidenceText: expect.stringMatching(
        /financial services firms.*must comply/iu,
      ),
    }));
    expect(activeSet?.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining("uk-legislation"),
        query: expect.stringContaining("legislation.gov.uk"),
        returnedRecordIds: [financialServicesActRecordId],
      }),
    );
    expect(activeSet?.manifest.outcomeValuesInspected).toBe(false);

    expect(catalogRequests).toHaveLength(1);
    expect(catalogRequests[0]?.url.pathname).toBe(
      "/all/2010-2020/data.feed",
    );
    expect(catalogRequests[0]?.url.searchParams.get("title")).toBe(
      "Financial services",
    );
    expect(
      new Headers(catalogRequests[0]?.init?.headers).get("user-agent"),
    ).toMatch(/^ShockAudit research-design tool \(\+https:\/\//u);
    expect(documentRequests).toHaveLength(1);
    expect(unavailableReviewedDocuments.length).toBeGreaterThan(0);
    expect(unavailableReviewedDocuments.every((url) =>
      reviewedRegistryLocators.has(url.toString())
    )).toBe(true);
    expect(unexpectedRequests).toEqual([]);

    now = "2026-09-10T12:00:20.000Z";
    const { snapshot: selected } = await mutate(
      terminal,
      "uk-financial-services-select",
      "find-select",
      { candidateSnapshotId: card.candidateSnapshotId },
    );
    const selectedState = stateFromScreen02WorkflowClientSnapshot(selected);
    if (selectedState.mode !== "find") throw new Error("Expected Find mode.");
    expect(selectedState.decision.tentativeSelectionSnapshotId).toBe(
      card.candidateSnapshotId,
    );

    now = "2026-09-10T12:00:21.000Z";
    const { snapshot: continued } = await mutate(
      selected,
      "uk-financial-services-screen03-handoff",
      "find-continue",
    );
    expect(continued.handoff).toMatchObject({
      mode: "find",
      producerAppVersion: "0.6.2",
      outcomeValuesInspected: false,
      decision: {
        candidateSnapshotId: card.candidateSnapshotId,
      },
      event: {
        identity: {
          canonicalTitle: financialServicesActTitle,
          formalIdentifier: "ukpga/2012/21",
          issuingJurisdiction: "United Kingdom",
        },
        preliminaryQualification: {
          eligible: true,
          substantiveOverview: { passed: true },
        },
      },
    });
    expect(continued.handoff?.sources).toContainEqual(expect.objectContaining({
      locator: financialServicesActLocator,
      evidenceText: expect.stringMatching(/came into force/iu),
    }));
    expect(catalogRequests).toHaveLength(1);
    expect(documentRequests).toHaveLength(1);
  }, 60_000);
});
