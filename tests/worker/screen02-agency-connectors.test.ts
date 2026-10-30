import { describe, expect, it, vi } from "vitest";

import {
  FTC_PRESS_RELEASES_ENDPOINT,
  fetchFtcPressReleaseProposals,
  parseFtcPressReleaseListing,
} from "../../src/worker/screen02-agency-connectors";

const FTC_GAMING_LISTING = `<!doctype html><html><body>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 2 of 2</div></div>
<article about="/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program" class="node node--type-press-release node--view-mode-search-result node--45688">
  <div class="node__content"><div class="group">
    <h3 class="node-title"><a href="/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program">FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program</a></h3>
    <div class="field field--name-field-date"><div class="field__item"><time datetime="2018-08-14T12:00:00Z">August 14, 2018</time></div></div>
    <div class="field field--name-body field--type-text-with-summary"><div class="field__items"><div class="field__item">The Federal Trade Commission approved changes to a video game industry self-regulatory program aimed at ensuring compliance with the Children’s Online Privacy Protection Act Rule.</div></div></div>
  </div></div>
</article>
<article class="node node--type-press-release node--view-mode-search-result">
  <div><h3 class="node-title"><a href="/news-events/news/press-releases/2018/04/ftc-seeks-comment-proposed-modifications-video-game-industry-self-regulatory-program-approved-under">FTC Seeks Comment on Proposed Modifications to Video Game Industry Self-Regulatory Program</a></h3>
  <time datetime="2018-04-02T12:00:00Z">April 2, 2018</time>
  <div class="field field--name-body field--type-text-with-summary"><div><div>The Federal Trade Commission is seeking public comment on proposals to modify a video game industry self-regulatory program.</div></div></div></div>
</article>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 2 of 2</div></div>
</body></html>`;

function connectorInput(fetch: typeof globalThis.fetch) {
  return {
    fetch,
    retrievedAt: "2026-09-07T00:00:00.000Z",
    startDate: "2014-01-01",
    endDate: "2022-12-31",
    population: "U.S. public firms",
    outcomeFamily: "Profitability",
    query: "video game",
    workflowMode: "find" as const,
  };
}

describe("FTC official-announcement connector", () => {
  it("parses the observed server-rendered listing contract without trusting the query as evidence", () => {
    const parsed = parseFtcPressReleaseListing(FTC_GAMING_LISTING, 20);
    expect(parsed).toMatchObject({
      invalidRecordsDropped: 0,
      reportedTotal: 2,
      limitReached: false,
      records: [
        expect.objectContaining({
          title:
            "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program",
          publishedDate: "2018-08-14",
          locator:
            "https://www.ftc.gov/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program",
          summary: expect.stringContaining(
            "Children’s Online Privacy Protection Act Rule",
          ),
        }),
        expect.objectContaining({ publishedDate: "2018-04-02" }),
      ],
    });
  });

  it("applies the record limit after ignoring non-result layout articles", () => {
    const layout = Array.from(
      { length: 20 },
      (_value, index) =>
        `<article class="layout-card"><h2>Navigation card ${index}</h2></article>`,
    ).join("");
    const parsed = parseFtcPressReleaseListing(
      FTC_GAMING_LISTING.replace("<body>", `<body>${layout}`),
      2,
    );

    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]?.title).toContain("FTC Approves Modifications");
    expect(parsed.invalidRecordsDropped).toBe(0);
  });

  it("requires both observed result classes and uses the source-reported total for limitReached", () => {
    const impostor = `<article class="node node--type-press-release">
      <h3 class="node-title"><a href="/news-events/news/press-releases/2018/01/not-a-search-result">Not a search result</a></h3>
    </article>`;
    const parsed = parseFtcPressReleaseListing(
      FTC_GAMING_LISTING
        .replace("<body>", `<body>${impostor}`)
        .replaceAll("Displaying 1 - 2 of 2", "Displaying 1 - 2 of 23"),
      2,
    );

    expect(parsed.records).toHaveLength(2);
    expect(parsed.reportedTotal).toBe(23);
    expect(parsed.limitReached).toBe(true);
  });

  it("retrieves a bounded, date-filtered FTC query and retains explicit approval announcements but not proposals", async () => {
    const fetch = vi.fn(async (
      _request: RequestInfo | URL,
      _init?: RequestInit,
    ) =>
      new Response(FTC_GAMING_LISTING, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
    const result = await fetchFtcPressReleaseProposals(connectorInput(fetch));

    expect(fetch).toHaveBeenCalledTimes(1);
    const request = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(`${request.origin}${request.pathname}`).toBe(
      FTC_PRESS_RELEASES_ENDPOINT,
    );
    expect(request.searchParams.get("search")).toBe("video game");
    expect(request.searchParams.get("date_range[min]")).toBe("2014-01-01");
    expect(request.searchParams.get("date_range[max]")).toBe("2022-12-31");
    expect(request.searchParams.has("items_per_page")).toBe(false);
    expect(request.searchParams.get("field_competition_topics")).toBe("All");
    expect(request.searchParams.get("field_consumer_protection_topics")).toBe("All");
    expect(request.searchParams.get("field_industry_target_id")).toBe("All");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      mode: "find",
      title:
        "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program",
      nativeIdentity: {
        issuer: "Federal Trade Commission",
        issuingJurisdiction: "United States",
        status: "Official agency announcement lead",
      },
      affectedPopulation:
        "Unknown — returned source metadata did not establish organizational population coverage.",
      sources: [
        expect.objectContaining({
          authorityTier: 2,
          publisher: "Federal Trade Commission",
          evidenceText: expect.stringContaining(
            "video game industry self-regulatory program",
          ),
        }),
      ],
    });
    expect(result.proposals[0]?.sources[0]?.evidenceText).toContain(
      "COPPA Safe Harbor Program. Jurisdiction: United States. " +
        "Agency announcement date: 2018-08-14.",
    );
    expect(result.proposals[0]?.limitations).toContain(
      "The announcement date is only a public information-event anchor, not adoption, implementation, effectiveness, enforcement, or organization-level treatment.",
    );
    expect(result.diagnostics).toMatchObject({
      connector: "ftc-press-releases-html-v1",
      recordsReceived: 2,
      recordsAccepted: 2,
      proposalsReturned: 1,
      limitReached: false,
      failureKind: "none",
      outcomeValuesInspected: false,
    });
    expect(result.diagnostics.channels[0]?.note).toContain(
      "Complaint, suit, proposal, comment, hearing, and event-only announcements were not promoted",
    );
    const acceptedRecordId = parseFtcPressReleaseListing(
      FTC_GAMING_LISTING,
      20,
    ).records[0]?.recordId;
    expect(result.proposalBindings).toEqual([{
      proposalId: result.proposals[0]?.id,
      queryId: result.diagnostics.queryMatrix[0]?.id,
      returnedRecordIds: [acceptedRecordId],
      sourceIds: result.proposals[0]?.sources.map((source) => source.id),
    }]);
  });

  it("fails closed on a text/html interstitial with no recognized results contract", async () => {
    const fetch = vi.fn(async () =>
      new Response(
        "<!doctype html><html><body><h1>Please wait</h1><article><h3 class=\"node-title\">Checking your browser</h3></article></body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      )
    );
    const result = await fetchFtcPressReleaseProposals(connectorInput(fetch));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.proposals).toEqual([]);
    expect(result.proposalBindings).toEqual([]);
    expect(result.diagnostics.failureKind).toBe("invalid-response");
  });

  it.each([
    ["missing", undefined],
    ["lookalike", "text/html-malformed"],
    ["xhtml", "application/xhtml+xml"],
  ])("rejects %s MIME instead of sniffing HTML", async (_label, contentType) => {
    const headers = new Headers();
    if (contentType) headers.set("content-type", contentType);
    const result = await fetchFtcPressReleaseProposals(
      connectorInput(async () =>
        new Response(FTC_GAMING_LISTING, { status: 200, headers })
      ),
    );

    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.failureKind).toBe("invalid-response");
  });

  it("starts the network timeout only after source-policy admission", async () => {
    const fetch = vi.fn(async () =>
      new Response(FTC_GAMING_LISTING, {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const result = await fetchFtcPressReleaseProposals({
      ...connectorInput(fetch),
      timeoutMs: 20,
      beforeRequest: async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
      },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.failureKind).toBe("none");
    expect(result.proposals).toHaveLength(1);
  });

  it("does not dispatch a queued recovery request after its parent deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
    try {
      const fetch = vi.fn(async () =>
        new Response(FTC_GAMING_LISTING, {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );
      const resultPromise = fetchFtcPressReleaseProposals({
        ...connectorInput(fetch),
        absoluteDeadlineAt: Date.now() + 45,
        beforeRequest: (_url, signal) =>
          new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve(), { once: true });
          }),
      });

      await vi.advanceTimersByTimeAsync(46);
      const result = await resultPromise;

      expect(fetch).not.toHaveBeenCalled();
      expect(result.proposals).toEqual([]);
      expect(result.diagnostics.failureKind).toBe("timeout");
      expect(result.diagnostics.channels[0]?.note).toMatch(
        /parent operation deadline/i,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not enter crawl admission after an already-expired deadline", async () => {
    const fetch = vi.fn(async () =>
      new Response(FTC_GAMING_LISTING, {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const beforeRequest = vi.fn(async () => undefined);
    const result = await fetchFtcPressReleaseProposals({
      ...connectorInput(fetch),
      absoluteDeadlineAt: Date.now() - 1,
      beforeRequest,
    });

    expect(beforeRequest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(result.diagnostics.failureKind).toBe("timeout");
  });

  it("propagates parent cancellation while crawl admission is pending", async () => {
    const fetch = vi.fn(async () =>
      new Response(FTC_GAMING_LISTING, {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const parent = new AbortController();
    let admissionStarted!: () => void;
    const enteredAdmission = new Promise<void>((resolve) => {
      admissionStarted = resolve;
    });
    const admissionSignal: { value: AbortSignal | null } = { value: null };
    const resultPromise = fetchFtcPressReleaseProposals({
      ...connectorInput(fetch),
      signal: parent.signal,
      beforeRequest: (_url, signal) => {
        admissionSignal.value = signal;
        admissionStarted();
        return new Promise<void>(() => undefined);
      },
    });

    await enteredAdmission;
    parent.abort();
    const result = await resultPromise;

    expect(admissionSignal.value?.aborted).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.diagnostics.failureKind).toBe("timeout");
  });

  it("aborts an in-flight recovery response at the parent deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
    try {
      const requestSignal: { value: AbortSignal | null } = { value: null };
      const fetch = vi.fn((_request: RequestInfo | URL, init?: RequestInit) => {
        requestSignal.value = init?.signal ?? null;
        return new Promise<Response>(() => undefined);
      });
      const resultPromise = fetchFtcPressReleaseProposals({
        ...connectorInput(fetch),
        absoluteDeadlineAt: Date.now() + 45,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(46);
      const result = await resultPromise;

      expect(requestSignal.value?.aborted).toBe(true);
      expect(result.proposals).toEqual([]);
      expect(result.diagnostics.failureKind).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed on proposal, complaint, and suit announcements without explicit current finality", async () => {
    const row = (
      slug: string,
      title: string,
      summary: string,
      day: string,
    ) => `<article class="node node--type-press-release node--view-mode-search-result">
      <h3 class="node-title"><a href="/news-events/news/press-releases/2018/08/${slug}">${title}</a></h3>
      <time datetime="2018-08-${day}T12:00:00Z">August ${day}, 2018</time>
      <div class="field field--name-body"><div><div>${summary}</div></div></div>
    </article>`;
    const listing = `<!doctype html><body>
      <div class="view-summary">Displaying 1 - 3 of 3</div>
      ${row(
        "approved-final-order",
        "FTC Approves Final Order Resolving Proposed Acquisition Concerns",
        "The Federal Trade Commission approved the final order after public comment.",
        "14",
      )}
      ${row(
        "sues-company",
        "FTC Sues Example Company Over Privacy Practices",
        "The Federal Trade Commission filed suit alleging violations.",
        "15",
      )}
      ${row(
        "files-complaint",
        "FTC Files Complaint Challenging Example Transaction",
        "The Commission's complaint seeks an adjudicative order.",
        "16",
      )}
    </body>`;
    const result = await fetchFtcPressReleaseProposals(
      connectorInput(async () =>
        new Response(listing, {
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      ),
    );

    expect(result.proposals.map((candidate) => candidate.title)).toEqual([
      "FTC Approves Final Order Resolving Proposed Acquisition Concerns",
    ]);
    expect(result.proposals[0]?.limitations.join(" ")).toMatch(
      /public information-event anchor|announcement date/i,
    );
  });

  it("does not fetch when scheduler admission aborts", async () => {
    const fetch = vi.fn(async () =>
      new Response(FTC_GAMING_LISTING, {
        headers: { "content-type": "text/html" },
      })
    );
    const result = await fetchFtcPressReleaseProposals({
      ...connectorInput(fetch),
      beforeRequest: async () => {
        const error = new Error("Queued request aborted.");
        error.name = "AbortError";
        throw error;
      },
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.failureKind).toBe("timeout");
  });

  it("derives distinct record IDs from each full canonical URL", () => {
    const sharedSuffix = "shared-tail-".repeat(10);
    const article = (prefix: string, day: string) => `
      <article class="node node--type-press-release node--view-mode-search-result">
        <h3 class="node-title"><a href="/news-events/news/press-releases/2018/08/${prefix}-${sharedSuffix}">FTC Approves ${prefix} Safeguards</a></h3>
        <time datetime="2018-08-${day}T12:00:00Z">August ${day}, 2018</time>
        <div class="field field--name-body"><div><div>The Federal Trade Commission approved ${prefix} safeguards.</div></div></div>
      </article>`;
    const parsed = parseFtcPressReleaseListing(`<!doctype html><body>
      <div class="view-summary">Displaying 1 - 2 of 2</div>
      ${article("alpha", "14")}${article("bravo", "15")}
    </body>`, 2);

    expect(parsed.records).toHaveLength(2);
    expect(new Set(parsed.records.map((record) => record.recordId)).size).toBe(2);
  });

  it("rejects an encoded FTC request that exceeds the 2,048-character URL bound", async () => {
    const fetch = vi.fn(async () =>
      new Response(FTC_GAMING_LISTING, {
        headers: { "content-type": "text/html" },
      })
    );

    await expect(fetchFtcPressReleaseProposals({
      ...connectorInput(fetch),
      query: "界".repeat(240),
    })).rejects.toThrow(/2048-character URL limit/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails the FTC route independently on unexpected content without manufacturing a lead", async () => {
    const result = await fetchFtcPressReleaseProposals(
      connectorInput(async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      ),
    );
    expect(result.proposals).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      connector: "ftc-press-releases-html-v1",
      failureKind: "invalid-response",
      outcomeValuesInspected: false,
    });
  });

  it("drops off-domain and malformed result records", () => {
    const hostile = FTC_GAMING_LISTING.replaceAll(
      "/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program",
      "https://attacker.example/action",
    );
    const parsed = parseFtcPressReleaseListing(hostile, 1);
    expect(parsed.records).toEqual([]);
    expect(parsed.invalidRecordsDropped).toBe(1);
  });
});
