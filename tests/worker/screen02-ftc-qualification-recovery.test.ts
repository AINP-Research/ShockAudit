import { describe, expect, it, vi } from "vitest";

import {
  completeScreen02FindDiscovery,
  beginScreen02FindDiscovery,
} from "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  continueScreen02FindCandidate,
  screen02FindCandidateSelectionGate,
  selectScreen02FindCandidate,
} from "../../src/core/screen02-workflow-state";
import { buildScreen02WorkflowHandoff } from
  "../../src/core/screen02-workflow-handoff";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { FEDERAL_REGISTER_API_ENDPOINT } from
  "../../src/worker/screen02-connectors";
import {
  discoverCanonicalScreen02Find,
  type ShockAuditEnv,
} from "../../src/worker/server";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";

const openedAt = "2026-09-07T12:00:00.000Z";
const searchStartedAt = "2026-09-07T12:00:01.000Z";
const retrievedAt = "2026-09-07T12:00:02.000Z";
const completedAt = "2026-09-07T12:00:03.000Z";
const selectedAt = "2026-09-07T12:00:04.000Z";
const continuedAt = "2026-09-07T12:00:05.000Z";
const handoffAt = "2026-09-07T12:00:06.000Z";
const actionTitle =
  "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program";
const actionPath =
  "/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program";
const actionUrl = `https://www.ftc.gov${actionPath}`;
const approvalLetterTitle =
  "Commission Letter Approving the Entertainment Software Rating Board Privacy Certified Kids Seal Requirements (As Modified and Attached As Exhibit A)";
const approvalLetterUrl =
  "https://www.ftc.gov/system/files/attachments/press-releases/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program/p024526_commission_letter_approving_modified_esrb_program_and_exhibit_a.pdf";

const ftcListing = `<!doctype html><html><body>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 1 of 1</div></div>
<article class="node node--type-press-release node--view-mode-search-result">
  <div class="node__content"><div class="group">
    <h3 class="node-title"><a href="${actionPath}">${actionTitle}</a></h3>
    <div class="field field--name-field-date"><div class="field__item"><time datetime="2018-08-14T12:00:00Z">August 14, 2018</time></div></div>
    <div class="field field--name-body field--type-text-with-summary"><div class="field__items"><div class="field__item">The Federal Trade Commission approved changes to a video game industry self-regulatory program aimed at ensuring compliance with the Children’s Online Privacy Protection Act Rule.</div></div></div>
  </div></div>
</article>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 1 of 1</div></div>
</body></html>`;

const ftcDetail = `<!doctype html><html><head><title>${actionTitle}</title></head>
<body><main><h1>${actionTitle}</h1>
<p>The Federal Trade Commission approved changes to a video game industry self-regulatory program aimed at ensuring compliance with the Children’s Online Privacy Protection Act Rule.</p>
<p>The Rule requires operators of commercial websites and online services directed to children under 13 to obtain parental consent before collecting, using, or disclosing personal information.</p>
<p>The revised guidelines approved by the Commission include changes addressing personal information, audio recordings, and geolocation requirements for the covered program.</p>
<p><a href="${approvalLetterUrl}">${approvalLetterTitle}</a></p>
</main></body></html>`;

function endpoint(url: URL, expected: string) {
  const target = new URL(expected);
  return url.origin === target.origin && url.pathname === target.pathname;
}

function successfulEmptyFederalRegisterResponse() {
  return new Response(JSON.stringify({ count: 0, results: [] }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function qualifiedFederalRegisterResponse() {
  return new Response(JSON.stringify({
    count: 1,
    results: [{
      document_number: "2019-54321",
      title: "Connected Factory Cybersecurity Requirements",
      type: "Rule",
      abstract:
        "The final rule requires public manufacturing firms and connected-device manufacturers in the United States to implement cybersecurity controls and reporting safeguards.",
      html_url:
        "https://www.federalregister.gov/documents/2019/05/01/2019-54321/connected-factory-cybersecurity-requirements",
      publication_date: "2019-05-01",
      effective_on: "2020-01-01",
      agencies: [{ name: "Department of Commerce" }],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function discoveryState(industry: string, runId: string) {
  return createScreen02FindState(
    confirmedWorkflowFindContext(industry, {
      eventDescriptor: "regulatory shock",
      studyPeriod: "2014–2022",
      outcomeFamily: "Profitability",
    }),
    runId,
    openedAt,
  );
}

describe("Screen 2 qualification-aware FTC recovery", () => {
  it("runs one FTC-owned recovery only after the ordinary Federal Register fan-out leaves a qualified shortfall", async () => {
    const requested: URL[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
      requested.push(url);

      if (endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)) {
        return successfulEmptyFederalRegisterResponse();
      }
      if (endpoint(url, FTC_PRESS_RELEASES_ENDPOINT)) {
        return new Response(ftcListing, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url.toString() === actionUrl) {
        return new Response(ftcDetail, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    });
    const initial = discoveryState(
      "Video gaming",
      "ftc-qualification-recovery-run",
    );
    const state = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "ftc-qualification-recovery-request",
      searchRoundId: "ftc-qualification-recovery-round",
      candidateSetSnapshotId: "ftc-qualification-recovery-set",
      exactRequest: "Find source-backed U.S. video gaming regulations.",
      at: searchStartedAt,
    });

    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
        SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "ftc-qualification-recovery-round",
        at: retrievedAt,
        exactRequest: "Find source-backed U.S. video gaming regulations.",
        maximumCandidates: 1,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Use the bounded provider-neutral source plan.",
        },
      },
    );
    const federalRegisterRequests = requested.filter((url) =>
      endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)
    );
    const ftcSearchRequests = requested.filter((url) =>
      endpoint(url, FTC_PRESS_RELEASES_ENDPOINT)
    );
    expect(federalRegisterRequests.length).toBeGreaterThanOrEqual(12);
    expect(federalRegisterRequests.length).toBeLessThanOrEqual(16);
    expect(requested.slice(0, federalRegisterRequests.length).every((url) =>
      endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)
    )).toBe(true);
    expect(ftcSearchRequests).toHaveLength(1);
    expect(requested.indexOf(ftcSearchRequests[0]!)).toBeGreaterThan(
      Math.max(...federalRegisterRequests.map((url) => requested.indexOf(url))),
    );

    const recoveryRequest = ftcSearchRequests[0]!;
    expect(recoveryRequest.searchParams.get("search")).toBe("video game");
    expect(recoveryRequest.searchParams.has("items_per_page")).toBe(false);
    expect(recoveryRequest.searchParams.get("date_range[min]")).toBe(
      "2014-01-01",
    );
    expect(recoveryRequest.searchParams.get("date_range[max]")).toBe(
      "2022-12-31",
    );

    expect(
      discovery.candidates,
      JSON.stringify(discovery.manifest.exclusions, null, 2),
    ).toHaveLength(1);
    expect(discovery.candidates[0]).toMatchObject({
      identity: {
        canonicalTitle: actionTitle,
        issuer: "Federal Trade Commission",
        issuingJurisdiction: "United States",
      },
      qualification: {
        eligible: true,
        classification: "direct",
        substantiveOverview: { passed: true },
      },
    });
    expect(
      discovery.candidates[0]?.qualification?.substantiveOverview
        .importantTiming,
    ).toBe("Agency announcement date: 2018-08-14.");
    const groundedFtcPassages = discovery.candidates[0]?.qualification
      ?.substantiveOverview.sourceGrounding.coordinates
      .map((coordinate) => coordinate.text)
      .join(" ") ?? "";
    expect(groundedFtcPassages).toMatch(
      /approved changes to a video game industry self-regulatory program/i,
    );
    expect(groundedFtcPassages).toMatch(
      /Rule requires operators of commercial websites and online services directed to children under 13/i,
    );
    expect(groundedFtcPassages).toContain(
      "Jurisdiction: United States. Agency announcement date: 2018-08-14.",
    );
    expect(requested.some((url) => url.toString() === actionUrl)).toBe(true);
    const primaryReference = discovery.sources.find((source) =>
      source.locator === approvalLetterUrl
    );
    expect(primaryReference).toMatchObject({
      title: approvalLetterTitle,
      publisher: "Federal Trade Commission",
      authorityTier: 1,
      channel: "official-controlling-primary-reference-unparsed",
    });
    expect(primaryReference).not.toHaveProperty("evidenceText");
    expect(discovery.candidates[0]?.sourceIds).toContain(primaryReference?.id);
    expect(discovery.candidates[0]?.qualification?.evidenceSourceIds)
      .not.toContain(primaryReference?.id);
    expect(
      discovery.candidates[0]?.qualification?.substantiveOverview
        .sourceGrounding.coordinates.some((coordinate) =>
          coordinate.sourceId === primaryReference?.id
        ),
    ).toBe(false);
    expect(discovery.candidates[0]?.limitations).toContainEqual(
      expect.stringMatching(
        /controlling primary record is a PDF.*did not retrieve or parse.*Screen 3 must verify exact passages/is,
      ),
    );

    const recoveryQuery = discovery.manifest.queryMatrix.find((query) =>
      query.query.startsWith(FTC_PRESS_RELEASES_ENDPOINT)
    );
    expect(recoveryQuery).toMatchObject({
      id: expect.stringMatching(/qualification-recovery/i),
      purpose: expect.stringMatching(
        /one serialized FTC-owned discovery request because common qualification retained fewer than 1 candidate/i,
      ),
    });
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "ftc-press-releases-html-v1 diagnostics",
        status: "searched",
        note: expect.stringMatching(/bounded requests: 1/i),
      }),
    );
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: expect.stringMatching(/exact retrieval funnel/i),
        status: "searched",
        note: expect.stringMatching(
          /overall retrieval stop: qualification-recovery-completed.*initial general-route stop: routes-exhausted.*qualification-recovery phase: completed/is,
        ),
      }),
    );
    expect(discovery.manifest.stoppingRule.note).toMatch(
      /overall retrieval stop: qualification-recovery-completed.*qualification-recovery phase: completed/is,
    );
    expect(discovery.manifest.funnel).toMatchObject({
      qualifiedCandidates: 1,
      displayedCandidates: 1,
    });
    expect(discovery.manifest.outcomeValuesInspected).toBe(false);

    const completed = completeScreen02FindDiscovery(state, {
      discoveryRequestId: "ftc-qualification-recovery-request",
      at: completedAt,
      sources: discovery.sources,
      candidates: discovery.candidates,
      manifest: discovery.manifest,
    });
    const persisted = completed.candidates[0]!;
    expect(
      screen02FindCandidateSelectionGate(
        completed,
        persisted.candidateSnapshotId,
      ),
    ).toEqual({ eligible: true, reasons: [] });
    const selected = selectScreen02FindCandidate(
      completed,
      persisted.candidateSnapshotId,
      "ftc-qualification-recovery-selection",
      selectedAt,
      "Select the source-qualified FTC action for downstream verification.",
    );
    const continued = continueScreen02FindCandidate(
      selected,
      "ftc-qualification-recovery-continuation",
      continuedAt,
      "Carry the selected FTC action to Screen 3 without inspecting outcomes.",
    );
    const handoff = buildScreen02WorkflowHandoff(
      continued,
      "0.6.2",
      handoffAt,
    );
    expect(handoff).toMatchObject({
      mode: "find",
      destinationScreen: "screen-03",
      producerAppVersion: "0.6.2",
      outcomeValuesInspected: false,
      decision: {
        candidateSnapshotId: persisted.candidateSnapshotId,
        selectionDecisionId: "ftc-qualification-recovery-selection",
        continuationDecisionId: "ftc-qualification-recovery-continuation",
      },
      event: {
        identity: {
          canonicalTitle: actionTitle,
          issuer: "Federal Trade Commission",
          issuingJurisdiction: "United States",
        },
        preliminaryQualification: {
          eligible: true,
          classification: "direct",
          substantiveOverview: { passed: true },
        },
      },
    });
    expect(
      handoff.sources.some(
        (source) =>
          source.locator === actionUrl &&
          source.evidenceText?.includes("requires operators"),
      ),
      JSON.stringify(handoff.sources, null, 2),
    ).toBe(true);
    expect(handoff.sources).toContainEqual(
      expect.objectContaining({
        locator: approvalLetterUrl,
        authorityTier: 1,
        channel: "official-controlling-primary-reference-unparsed",
      }),
    );
    expect(
      handoff.sources.find((source) => source.locator === approvalLetterUrl),
    ).not.toHaveProperty("evidenceText");
    expect(
      handoff.history.searchManifests.some(
        (manifest) =>
          manifest.outcomeValuesInspected === false &&
          manifest.queryMatrix.some((entry) =>
            entry.returnedRecordIds.includes(persisted.candidateId)
          ),
      ),
    ).toBe(true);
  });

  it("records a failed FTC recovery as its own terminal retrieval phase", async () => {
    const requested: URL[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
      requested.push(url);
      if (endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)) {
        return successfulEmptyFederalRegisterResponse();
      }
      if (endpoint(url, FTC_PRESS_RELEASES_ENDPOINT)) {
        return new Response(
          "<!doctype html><html><body><h1>Request interstitial</h1></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    const state = discoveryState(
      "Video gaming",
      "ftc-qualification-recovery-failure-run",
    );

    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "ftc-qualification-recovery-failure-round",
        at: retrievedAt,
        exactRequest: "Find source-backed U.S. video gaming regulations.",
        maximumCandidates: 1,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Use the bounded provider-neutral source plan.",
        },
      },
    );

    expect(requested.filter((url) =>
      endpoint(url, FTC_PRESS_RELEASES_ENDPOINT)
    )).toHaveLength(1);
    expect(discovery.candidates).toHaveLength(1);
    expect(discovery.candidates[0]?.qualification?.candidateAdmission)
      .toMatchObject({
        displayEvidence: { supported: true },
        relevance: { recommended: true },
      });
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: expect.stringContaining("Public event index"),
        status: "searched",
      }),
    );
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "ftc-press-releases-html-v1 diagnostics",
        status: "failed",
        note: expect.stringMatching(/invalid response/i),
      }),
    );
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: expect.stringMatching(/exact retrieval funnel/i),
        status: "failed",
        note: expect.stringMatching(
          /overall retrieval stop: qualification-recovery-failed.*initial general-route stop: routes-exhausted.*qualification-recovery phase: failed/is,
        ),
      }),
    );
    expect(discovery.manifest.stoppingRule.note).toMatch(
      /overall retrieval stop: qualification-recovery-failed.*qualification-recovery phase: failed/is,
    );
    expect(discovery.manifest.retrievalExecution).toMatchObject({
      schemaVersion: "screen-02-retrieval-execution-v2",
      qualificationRecovery: {
        status: "failed",
        stoppingReason: "qualification-recovery-failed",
      },
    });
  });

  it("does not call FTC when the initial qualified pool already meets the requested maximum", async () => {
    const requested: URL[] = [];
    let federalRegisterRequestCount = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
      requested.push(url);
      if (endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)) {
        federalRegisterRequestCount += 1;
        return federalRegisterRequestCount === 1
          ? qualifiedFederalRegisterResponse()
          : successfulEmptyFederalRegisterResponse();
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    const state = discoveryState(
      "Manufacturing",
      "ftc-recovery-not-needed-run",
    );

    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "ftc-recovery-not-needed-round",
        at: retrievedAt,
        exactRequest: "Find source-backed U.S. manufacturing regulations.",
        maximumCandidates: 1,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Use the bounded provider-neutral source plan.",
        },
      },
    );

    expect(requested.filter((url) =>
      endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)
    ).length).toBeGreaterThanOrEqual(12);
    expect(requested.filter((url) =>
      endpoint(url, FEDERAL_REGISTER_API_ENDPOINT)
    ).length).toBeLessThanOrEqual(16);
    expect(requested.some((url) =>
      endpoint(url, FTC_PRESS_RELEASES_ENDPOINT)
    )).toBe(false);
    expect(discovery.candidates).toHaveLength(1);
    expect(discovery.candidates[0]?.qualification?.eligible).toBe(true);
    expect(discovery.manifest.queryMatrix.some((query) =>
      query.query.startsWith(FTC_PRESS_RELEASES_ENDPOINT)
    )).toBe(false);
    expect(discovery.manifest.outcomeValuesInspected).toBe(false);
  });
});
