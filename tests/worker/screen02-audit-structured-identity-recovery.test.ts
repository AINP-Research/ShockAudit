import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  readEurLexDocumentIdentity,
  readUkLegislationDocumentIdentity,
} from "../../src/worker/official-document-html";
import { describe, expect, it } from "vitest";
import worker from "../../src/worker/index";
import type { ShockAuditEnv } from "../../src/worker/server";
import { InMemoryScreen02WorkflowStore } from "../../src/worker/screen02-workflow-store";
import { confirmScopeContract, createInitialState } from "../../src/core/screen01-service";
import { decisionKeys } from "../../src/core/scope-types";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import {
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
  SCREEN_02_WORKFLOW_META_KEY,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import { restoreScreen02AuditState } from "../../src/core/screen02-workflow-state";



function studyContext(title: string) {
  const sentence = `Audit whether the ${title} affected innovation among U.S. publicly listed technology firms from 2022 to 2025.`;
  const initial = createInitialState("audit", sentence);
  const confirmed = confirmScopeContract({
    ...initial,
    sentence,
    contractSourceSentence: sentence,
    knownShock: title,
    scope: {
      population: "U.S. publicly listed technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2022–2025",
      eventFamily: /hurricane/i.test(title) ? "Disaster" : "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!confirmed.ok) throw new Error(confirmed.error);
  return buildScreen01StudyContext(confirmed.state, confirmed.ambiguities);
}

function productionHarness(sourceLocator: string, body: string, officialRows: unknown[] = []) {
  let requestId = 0;
  const env: ShockAuditEnv = {
    ASSETS: {
      fetch: async () => new Response("<html><body></body></html>", {
        headers: { "content-type": "text/html" },
      }),
    } as unknown as ShockAuditEnv["ASSETS"],
    CONNECTOR_FETCH: async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return url === sourceLocator
        ? new Response(body, {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        : new Response(JSON.stringify({ count: officialRows.length, results: officialRows }), {
            headers: { "content-type": "application/json" },
          });
    },
    NOW: () => "2026-09-06T18:00:00.000Z",
    SCREEN02_SEARCH_EXPANSION_MODE: "off",
    SCREEN02_WORKFLOW_STORE: new InMemoryScreen02WorkflowStore(),
    SCREEN02_WORKFLOW_SIGNING_KEY_ID: "researcher-source-regression",
    SCREEN02_WORKFLOW_SIGNING_KEY: crypto.randomUUID().replaceAll("-", ""),
    SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
  };
  return async (name: string, args: Record<string, unknown>) => {
    const response = await worker.fetch(new Request("http://localhost/mcp", {
      method: "POST",
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } }),
    }) as never, env as never, { waitUntil: () => undefined, passThroughOnException: () => undefined } as never);
    expect(response.status).toBe(200);
    const text = await response.text();
    const data = response.headers.get("content-type")?.includes("text/event-stream")
      ? text.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
      : text;
    if (!data) throw new Error("Missing MCP response data");
    return JSON.parse(data) as { result?: { isError?: boolean; content?: unknown; _meta?: Record<string, unknown> } };
  };
}


const dmaTitle = "Regulation (EU) 2022/1925 of the European Parliament and of the Council on contestable and fair markets in the digital sector (Digital Markets Act)";
const dmaUrl = "https://eur-lex.europa.eu/eli/reg/2022/1925/oj";
const dmaBody = `<html lang="en"><head><title>Regulation - 2022/1925 - EN - EUR-Lex</title><meta name="WT.z_docID" content="32022R1925"><meta property="eli:title" lang="en" content="${dmaTitle}"></head><body><div class="eli-container"><div class="eli-main-title">${dmaTitle}</div><p>Gatekeepers shall allow business users to promote offers to end users.</p></div></body></html>`;
const ukUrl =
  "https://www.legislation.gov.uk/ukpga/2018/12/contents/enacted";
const ukBody = `<html lang="en"><head>
  <title>Data Protection Act 2018</title>
  <link rel="canonical" href="https://www.legislation.gov.uk/ukpga/2018/12/contents">
  <meta name="DC.title" content="Data Protection Act 2018">
  <meta name="Legislation.year" content="2018">
</head><body>
  <h1 id="pageTitle" class="pageTitle">Data Protection Act 2018</h1>
  <section id="openingOptions"><h3>You have chosen to open the Whole Act</h3>
  <h3>You have chosen to open the Whole Act without Schedules</h3></section>
  <div id="content"><p>This Act makes provision for the regulation of the processing of information relating to individuals and requires controllers to safeguard personal data.</p></div>
</body></html>`;

function snapshotOf(result: Awaited<ReturnType<ReturnType<typeof productionHarness>>>) {
  expect(result.result?.isError, JSON.stringify(result.result?.content)).not.toBe(true);
  const snapshot = restoreScreen02WorkflowClientSnapshot(result.result?._meta?.[SCREEN_02_WORKFLOW_META_KEY]);
  if (!snapshot) throw new Error("Missing canonical Audit snapshot");
  return snapshot;
}

async function audit(input: {
  shockName: string; distinguishingFeature: string; sourceLocator: string; body: string;
  officialRows?: unknown[]; clarification?: string;
}) {
  const call = productionHarness(input.sourceLocator, input.body, input.officialRows);
  let snapshot = snapshotOf(await call(SCREEN_02_WORKFLOW_CREATE_TOOL_V023, {
    schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION, operationId: "identity-create",
    studyContext: studyContext(input.shockName),
  }));
  let n = 0;
  const mutate = async (action: string, payload: Record<string, unknown>) => {
    const result = await call("mutate_screen02_workflow_v021", {
      schemaVersion: "screen-02-workflow-action-v1", operationId: `identity-${++n}`,
      runId: snapshot.runId, accessToken: snapshot.accessToken, expectedRevision: snapshot.revision,
      expectedStateFingerprint: snapshot.stateFingerprint, action, payload,
    });
    if (!result.result?.isError) snapshot = snapshotOf(result);
    return result;
  };
  await mutate("audit-revise-anchor", { fields: {
    shockName: input.shockName,
    jurisdiction: input.sourceLocator.includes("europa.eu")
      ? "European Union"
      : input.sourceLocator.includes("legislation.gov.uk")
        ? "United Kingdom"
        : "United States",
    issuingAuthority: input.sourceLocator.includes("europa.eu")
      ? "European Parliament and Council"
      : input.sourceLocator.includes("legislation.gov.uk")
        ? "UK Parliament"
        : "Securities and Exchange Commission",
    approximateYear: input.sourceLocator.includes("legislation.gov.uk")
      ? "2018"
      : "2023",
    versionType: "original", distinguishingFeature: input.distinguishingFeature,
    sourceLocator: input.sourceLocator, clarification: input.clarification ?? "Resolve this exact source-backed instrument.",
  }, reason: "Supply a structured identity anchor." });
  const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
  if (state.mode !== "audit") throw new Error("Expected Audit");
  const set = state.matchSets.find((item) => item.matchSetSnapshotId === state.activeMatchSetSnapshotId)!;
  const matches = state.possibleMatches.filter((item) => set.possibleMatchSnapshotIds.includes(item.matchSnapshotId));
  return { state, matches, mutate, current: () => snapshot };
}

describe("Audit source-native structured identity recovery", () => {
  it("confirms a legislation.gov.uk record despite unrelated Act headings in page controls", async () => {
    const run = await audit({
      shockName: "Data Protection Act 2018",
      distinguishingFeature: "2018 chapter 12",
      sourceLocator: ukUrl,
      body: ukBody,
      clarification:
        "Resolve the United Kingdom Act as the national instrument, not the EU GDPR itself.",
    });
    const match = run.matches.find(
      (item) => item.identity.canonicalTitle === "Data Protection Act 2018",
    )!;
    expect(match).toBeDefined();
    expect(match.relationship).toBe("exact");
    snapshotOf(await run.mutate("audit-open", {
      matchSnapshotId: match.matchSnapshotId,
    }));
    snapshotOf(await run.mutate("audit-confirm", {
      matchSnapshotId: match.matchSnapshotId,
      reason: "Confirm the exact source-bound United Kingdom Act after dossier review.",
    }));
    snapshotOf(await run.mutate("audit-continue", {}));
    expect(run.current().handoff).toBeDefined();
  });

  it.each([
    [
      "a different canonical record",
      ukBody.replace("/ukpga/2018/12/contents\"", "/ukpga/2018/13/contents\""),
    ],
    [
      "a contradictory native title",
      ukBody.replace(
        'name="DC.title" content="Data Protection Act 2018"',
        'name="DC.title" content="Freedom of Information Act 2000"',
      ),
    ],
    [
      "a contradictory native year",
      ukBody.replace('name="Legislation.year" content="2018"',
        'name="Legislation.year" content="2019"'),
    ],
  ])("rejects legislation.gov.uk identity with %s", (_label, body) => {
    expect(readUkLegislationDocumentIdentity(body, ukUrl)).toBeUndefined();
  });

  it.each([
    [
      "a different canonical record",
      ukBody.replace("/ukpga/2018/12/contents\"", "/ukpga/2018/13/contents\""),
    ],
    [
      "a contradictory native title",
      ukBody.replace(
        'name="DC.title" content="Data Protection Act 2018"',
        'name="DC.title" content="Freedom of Information Act 2000"',
      ),
    ],
    [
      "a contradictory native year",
      ukBody.replace('name="Legislation.year" content="2018"',
        'name="Legislation.year" content="2019"'),
    ],
  ])("keeps a UK page with %s uncertain and rejects confirmation", async (
    _label,
    body,
  ) => {
    const run = await audit({
      shockName: "Data Protection Act 2018",
      distinguishingFeature: "2018 chapter 12",
      sourceLocator: ukUrl,
      body,
      clarification: "Resolve this exact United Kingdom Act.",
    });
    const match = run.matches.find((item) =>
      item.sourceIds.some((sourceId) =>
        run.state.sources.find((source) => source.id === sourceId)
          ?.locator === ukUrl
      )
    )!;
    expect(match).toBeDefined();
    expect(match.relationship).toBe("uncertain");
    snapshotOf(await run.mutate("audit-open", {
      matchSnapshotId: match.matchSnapshotId,
    }));
    const confirmation = await run.mutate("audit-confirm", {
      matchSnapshotId: match.matchSnapshotId,
      reason: "Attempt confirmation after inspecting the contradictory source.",
    });
    expect(confirmation.result?.isError).toBe(true);
  });

  it("confirms and hands off an ELI identity using its source-present identifier, without recalling the excluded GDPR", async () => {
    const run = await audit({ shockName: "EU Digital Markets Act", distinguishingFeature: "Regulation (EU) 2022/1925", sourceLocator: dmaUrl, body: dmaBody, clarification: "Resolve the Digital Markets Act, not the GDPR." });
    expect(run.matches.some((item) => item.identity.canonicalTitle === "General Data Protection Regulation")).toBe(false);
    const match = run.matches.find((item) => item.identity.canonicalTitle.includes("2022/1925"))!;
    expect(match.identity.formalIdentifier).toBe("Regulation (EU) 2022/1925");
    expect(match.relationship).toBe("exact");
    snapshotOf(await run.mutate("audit-open", { matchSnapshotId: match.matchSnapshotId }));
    snapshotOf(await run.mutate("audit-confirm", { matchSnapshotId: match.matchSnapshotId, reason: "Inspect and confirm the source-bound exact instrument." }));
    snapshotOf(await run.mutate("audit-continue", {}));
    expect(run.current().handoff).toBeDefined();
  });

  it("uses an actual official title matching the distinguishing field when the everyday anchor differs", async () => {
    const title = "Cybersecurity Risk Management, Strategy, Governance, and Incident Disclosure";
    const run = await audit({ shockName: "SEC Cybersecurity Disclosure Rules", distinguishingFeature: title,
      sourceLocator: "https://www.sec.gov/rules/cybersecurity", body: `<html><head><title>${title}</title></head><body><h1>${title}</h1><p>Public companies must disclose material cybersecurity incidents.</p></body></html>`,
    });
    const match = run.matches.find((item) => item.identity.canonicalTitle === title)!;
    expect(match.relationship).toBe("exact");
    snapshotOf(await run.mutate("audit-open", { matchSnapshotId: match.matchSnapshotId }));
    snapshotOf(await run.mutate("audit-confirm", { matchSnapshotId: match.matchSnapshotId, reason: "Confirm the actual source title identified in the structured anchor." }));
  });


  it("binds a Federal Register formal title independently of the inaccessible or unrelated researcher page", async () => {
    const title = "Cybersecurity Risk Management, Strategy, Governance, and Incident Disclosure";
    const run = await audit({ shockName: "SEC Cybersecurity Disclosure Rules", distinguishingFeature: title,
      sourceLocator: "https://www.sec.gov/rules/unavailable", body: "<html><title>Access unavailable</title></html>",
      officialRows: [{ title, type: "Rule", abstract: "Public companies must disclose material cybersecurity incidents.", document_number: "2023-16194", publication_date: "2023-08-04", effective_on: "2023-09-05", html_url: "https://www.federalregister.gov/d/2023-16194", agencies: [{ name: "Securities and Exchange Commission" }] }],
    });
    const match = run.matches.find((item) => item.identity.canonicalTitle === title)!;
    expect(match.relationship).toBe("exact");
    snapshotOf(await run.mutate("audit-open", { matchSnapshotId: match.matchSnapshotId }));
    snapshotOf(await run.mutate("audit-confirm", { matchSnapshotId: match.matchSnapshotId, reason: "Confirm the source-returned title identified in the anchor." }));
  });

  it.each([
    ["Utah Consumer Privacy Act", "S.B. 227", "https://le.utah.gov/~2022/bills/static/SB0227.html", "utah-bill.html.gz", "S.B. 227 Consumer Privacy Act"],
    ["Hurricane Harvey", "2017 Atlantic hurricane", "https://www.nhc.noaa.gov/archive/2017/al09/al092017.public_a.023.shtml", "harvey-advisory.html.gz", "Hurricane HARVEY"],
  ])("confirms %s from an unambiguous own heading in the actual captured response", async (shockName, distinguishingFeature, sourceLocator, fixture, title) => {
    const body = gunzipSync(readFileSync(new URL(`../fixtures/screen02-audit-source-recovery/${fixture}`, import.meta.url))).toString("utf8");
    const run = await audit({ shockName, distinguishingFeature, sourceLocator, body });
    const match = run.matches.find((item) => item.identity.canonicalTitle === title)!;
    expect(match).toBeDefined();
    expect(match.relationship).toBe("exact");
    const source = run.state.sources.find((item) => match.sourceIds.includes(item.id))!;
    expect(source.evidenceText).toBeTruthy();
    expect(source.authorityTier).toBe(6);
    snapshotOf(await run.mutate("audit-open", { matchSnapshotId: match.matchSnapshotId }));
    snapshotOf(await run.mutate("audit-confirm", { matchSnapshotId: match.matchSnapshotId, reason: "Confirm the source-bound title and identifier after dossier review." }));
    snapshotOf(await run.mutate("audit-continue", {}));
    expect(run.current().handoff).not.toBeNull();
  });


  it("does not recall an excluded instrument from the distinguishing feature", async () => {
    const run = await audit({ shockName: "EU Digital Markets Act", distinguishingFeature: "Regulation (EU) 2022/1925, not the GDPR", sourceLocator: dmaUrl, body: dmaBody });
    expect(run.matches.some((item) => item.identity.canonicalTitle === "General Data Protection Regulation")).toBe(false);
  });

  it("preserves the affirmative meaning of not only in catalog recall", async () => {
    const run = await audit({ shockName: "EU Digital Markets Act", distinguishingFeature: "Regulation (EU) 2022/1925", sourceLocator: dmaUrl, body: dmaBody, clarification: "Compare not only the GDPR but also the requested act." });
    expect(run.matches.some((item) => item.identity.canonicalTitle === "General Data Protection Regulation")).toBe(true);
  });

  it("does not select a subordinate event heading from an ambiguous document index", async () => {
    const run = await audit({ shockName: "Hurricane Harvey", distinguishingFeature: "2017 Atlantic hurricane", sourceLocator: "https://www.nhc.noaa.gov/archive/index.html", body: "<html><title></title><body><h2>Hurricane HARVEY</h2><h2>Hurricane IRMA</h2></body></html>" });
    expect(run.matches.every((item) => item.relationship === "uncertain")).toBe(true);
  });

  it.each([
    ["contradictory ELI and CELEX selectors", `${dmaUrl}?uri=CELEX:32016R0679`, dmaBody],
    ["ambiguous duplicate CELEX selectors", `${dmaUrl}?uri=CELEX:32022R1925&uri=CELEX:32016R0679`, dmaBody],
    ["same formal identifier but a contradictory own title", dmaUrl, dmaBody.replace("<div class=\"eli-main-title\">" + dmaTitle, "<div class=\"eli-main-title\">" + dmaTitle.replace("Digital Markets Act", "Unrelated Measure"))],
    ["an instrument referenced only in a repeal heading", dmaUrl, dmaBody.replace("<div class=\"eli-main-title\">", "<div class=\"eli-main-title\">Repeal of ")],
  ])("rejects native identity for %s", (_label, url, body) => {
    expect(readEurLexDocumentIdentity(body, url)).toBeUndefined();
  });

  it.each([
    ["mixed own headings for different bill identifiers", "https://le.utah.gov/~2022/bills/static/SB0227.html", "<html><title>SB0227</title><main><h3>S.B. 227 Consumer Privacy Act</h3><h3>S.B. 228 Unrelated Act</h3></main></html>", "S.B. 227"],
    ["contradictory bill title and own heading", "https://le.utah.gov/~2022/bills/static/SB0227.html", "<html><title>SB0227</title><main><h3>S.B. 228 Unrelated Act</h3></main></html>", "S.B. 227"],
    ["wrong requested year", dmaUrl.replace("2022/1925", "2021/1925"), dmaBody, "Regulation (EU) 2022/1925"],
    ["contradictory native ID", dmaUrl, dmaBody.replace("32022R1925", "32016R0679"), "Regulation (EU) 2022/1925"],
    ["contradictory native title", dmaUrl, dmaBody.replace('content="Regulation (EU) 2022/1925', 'content="Regulation (EU) 2021/1925'), "Regulation (EU) 2022/1925"],
    ["a researcher-only asserted identifier", dmaUrl, dmaBody, "Regulation (EU) 2021/1925"],
  ])("keeps %s uncertain and rejects its actual confirmation", async (_label, sourceLocator, body, distinguishingFeature) => {
    const run = await audit({ shockName: "Unestablished market instrument", sourceLocator, body, distinguishingFeature });
    const match = run.matches.find((item) => item.sourceIds.some((id) => run.state.sources.find((source) => source.id === id)?.locator === sourceLocator))!;
    expect(match.relationship).toBe("uncertain");
    snapshotOf(await run.mutate("audit-open", { matchSnapshotId: match.matchSnapshotId }));
    const result = await run.mutate("audit-confirm", { matchSnapshotId: match.matchSnapshotId, reason: "Attempt confirmation of an uncertain identity." });
    expect(result.result?.isError).toBe(true);
    expect(JSON.stringify(result.result?.content)).toContain("active source-backed match and sufficient completed dossier");
    expect(run.current().handoff).toBeNull();
  });
});
