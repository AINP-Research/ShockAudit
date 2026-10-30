import { describe, expect, it, vi } from "vitest";

import {
  buildScreen02IndustryRelevanceProfile,
  mergeScreen02StudyRelevanceProfileHostAdditions,
  type Screen02PoolHostOfficialSourceLead,
} from "../../src/core/screen02-relevance-profile";
import type { Screen02CandidateReviewInfluenceMap } from
  "../../src/core/screen02-qualification";
import type {
  Screen02FindProposal,
  Screen02Source,
} from "../../src/core/screen02-types";
import { buildScreen02FindDiscoveryFromProposals } from
  "../../src/core/screen02-find-discovery";
import { buildScreen02NativeQueryPlan } from
  "../../src/core/screen02-discovery";
import { EU_CELLAR_SPARQL_ENDPOINT } from
  "../../src/worker/screen02-global-connectors";
import { screen02FindRelevanceProfile } from
  "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  requireScreen02FindState,
} from
  "../../src/core/screen02-workflow-state";
import {
  discoverCanonicalScreen02Find,
  createScreen02SubstantiveEnrichmentRuntime,
  retrieveScreen02HostOfficialSourceLeads,
  scheduleScreen02HostQueryVariants,
  screen02ChangedHostReviewCandidateIds,
  screen02FreshRouteSourceVersions,
  type ShockAuditEnv,
} from "../../src/worker/server";
import {
  buildFindFactsState,
  confirmedWorkflowFindContext,
  workflowManifest,
} from "../core/screen02-workflow-fixtures";

const retrievedAt = "2026-09-03T12:00:00.000Z";

function lead(
  overrides: Partial<Screen02PoolHostOfficialSourceLead> = {},
): Screen02PoolHostOfficialSourceLead {
  return {
    url: "https://agency.gov/laws/proposed-record",
    title: "Host-proposed legal record",
    issuingBody: "Host-proposed issuing body",
    jurisdiction: "Host-proposed jurisdiction",
    reasonForRetrieval: "Retrieve the official operative text.",
    candidateIdIfKnown: null,
    ...overrides,
  };
}

function env(fetch: typeof globalThis.fetch): ShockAuditEnv {
  return { CONNECTOR_FETCH: fetch } as unknown as ShockAuditEnv;
}

function officialHtml(body: string) {
  return new Response(
    `<!doctype html><html><head><title>Official regulation</title></head>` +
      `<body><main>${body}</main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

describe("Screen 2 host-proposed official-source retrieval", () => {
  it("rejects an unresolved relevance profile before any connector I/O", async () => {
    const state = structuredClone(createScreen02FindState(
      confirmedWorkflowFindContext("Video gaming"),
      "ambiguous-profile-retrieval-run",
      retrievedAt,
    ));
    const ambiguous = buildScreen02IndustryRelevanceProfile("Gaming");
    state.relevanceProfile = {
      ...state.relevanceProfile!,
      status: ambiguous.status,
      canonicalIndustryCode: ambiguous.canonicalIndustryCode,
      ambiguity: ambiguous.ambiguity,
      interpretationAlternatives: ambiguous.interpretationAlternatives,
    };
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(discoverCanonicalScreen02Find(
      env(fetch),
      state,
      {
        searchRoundId: "ambiguous-profile-retrieval-round",
        at: retrievedAt,
        exactRequest: "Find source-backed candidate shocks.",
        maximumCandidates: 10,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Use deterministic retrieval only.",
        },
      },
    )).rejects.toThrow(/kind of gaming|clarify/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch non-official or private-network source leads", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const resolutions = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [
        lead({ url: "https://publisher.example/regulation" }),
        lead({ url: "https://127.0.0.1/private-regulation" }),
      ],
      retrievedAt,
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(resolutions).toHaveLength(2);
    expect(resolutions.every((resolution) =>
      resolution.status === "rejected" && resolution.source === null
    )).toBe(true);
    expect(resolutions.map((resolution) => resolution.reason).join(" "))
      .toMatch(/official HTTPS allowlist/i);
  });

  it("rejects terminal-dot hosts and custom ports before connector I/O", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const results = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [
        lead({ url: "https://agency.gov./laws/example" }),
        lead({ url: "https://agency.gov:8443/laws/example" }),
      ],
      retrievedAt,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(JSON.stringify(results)).not.toContain("8443/laws");
  });

  it("bounded-fetches an allowlisted official lead only for its exact current candidate", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const extractedOverview =
      `The ${candidate.identity.canonicalTitle} governs covered business ` +
      "activity and has applied to companies under documented statutory " +
      "requirements since the official operative date.";
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) =>
      officialHtml(
        `<h1>${candidate.identity.canonicalTitle}</h1>` +
          `<p>${candidate.identity.formalIdentifier}. Issuer: ` +
          `${candidate.identity.issuer}. Jurisdiction: ` +
          `${candidate.identity.issuingJurisdiction}.</p>` +
          `<p>${extractedOverview}</p>`,
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://agency.gov/laws/proposed-record",
      expect.objectContaining({
        redirect: "manual",
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          accept: "text/html, text/plain;q=0.9",
        }),
      }),
    );
    expect(resolution).toMatchObject({
      candidateId: candidate.candidateId,
      status: "verified",
      source: {
        channel: "host-proposed-official-source-verified",
        authorityTier: 1,
        locator: "https://agency.gov/laws/proposed-record",
      },
    });
    expect(resolution?.source?.evidenceText).toContain(extractedOverview);
    expect(resolution?.leadFingerprint).toMatch(/^fnv1a64:[a-f0-9]{16}$/u);
    expect(resolution?.contentFingerprint).toMatch(/^fnv1a64:[a-f0-9]{16}$/u);
    expect(resolution?.proposal).toBeNull();
  });

  it("rejects redirects outside the official allowlist and unusable content", async () => {
    const redirectFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://publisher.example/copied-regulation" },
      }));
    const [redirected] = await retrieveScreen02HostOfficialSourceLeads(
      env(redirectFetch),
      buildFindFactsState(),
      [lead()],
      retrievedAt,
    );
    expect(redirectFetch).toHaveBeenCalledOnce();
    expect(redirected).toMatchObject({ status: "rejected", source: null });
    expect(redirected?.source).toBeNull();
    expect(redirected?.reason).toMatch(/redirect escaped.*allowlist/i);

    const contentFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/x-text/html" },
      }));
    const [badContent] = await retrieveScreen02HostOfficialSourceLeads(
      env(contentFetch),
      buildFindFactsState(),
      [lead()],
      retrievedAt,
    );
    expect(contentFetch).toHaveBeenCalledOnce();
    expect(badContent).toMatchObject({ status: "rejected", source: null });
    expect(badContent?.source).toBeNull();
    expect(badContent?.reason).toMatch(/supported HTML or text content type/i);

    const missingContentTypeFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        new TextEncoder().encode(
          "<html><body><main>Official legal text with enough visible words " +
            "to otherwise pass the bounded substantive response check.</main></body></html>",
        ),
        { status: 200 },
      ));
    const [missingContentType] =
      await retrieveScreen02HostOfficialSourceLeads(
        env(missingContentTypeFetch),
        buildFindFactsState(),
        [lead()],
        retrievedAt,
      );
    expect(missingContentTypeFetch).toHaveBeenCalledOnce();
    expect(missingContentType).toMatchObject({
      status: "rejected",
      source: null,
    });
    expect(missingContentType?.reason).toMatch(
      /declare a supported HTML or text content type/i,
    );
  });

  it("records a sanitized same-family redirect chain and final response", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).includes("proposed-record")) {
        return new Response(null, {
          status: 302,
          headers: { location: "/laws/final-record?signature=private" },
        });
      }
      return new Response(
        `<!doctype html><html><body><main>` +
          `<h1>Marketplace Records Act 2025</h1>` +
          `<p>Formal identifier: Law No. 7744. Issuer: Commerce Authority. Jurisdiction: Example ` +
          `Republic. The Act requires marketplace businesses to retain ` +
          `records. It became effective January 1, 2025.</p>` +
          `</main></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    });
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/laws/proposed-record?token=private",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
      runtime,
    );
    expect(result.status).toBe("verified");
    expect(result.url).toBe("https://agency.gov/laws/final-record");
    expect(result.source?.locator).toBe(
      "https://agency.gov/laws/final-record",
    );
    expect(runtime.documentAcquisitions).toContainEqual(expect.objectContaining({
      candidateId: result.candidateId,
      requestedUrl: "https://agency.gov/laws/proposed-record",
      redirectChain: [{
        status: 302,
        fromUrl: "https://agency.gov/laws/proposed-record",
        toUrl: "https://agency.gov/laws/final-record",
      }],
      finalUrl: "https://agency.gov/laws/final-record",
      httpStatus: 200,
      mediaType: "text/html",
      outcome: "succeeded",
    }));
    expect(JSON.stringify({ result, acquisitions: runtime.documentAcquisitions }))
      .not.toMatch(/token=private|signature=private/u);
  });

  it("bounds a single oversized response in the persisted acquisition record", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
      new Uint8Array(2 * 1024 * 1024 + 64),
      { headers: { "content-type": "text/plain" } },
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({ url: "https://agency.gov/laws/oversized-record" })],
      retrievedAt,
      runtime,
    );

    expect(result).toMatchObject({ status: "rejected", retrieved: false });
    expect(runtime.documentAcquisitions).toContainEqual(
      expect.objectContaining({
        receivedBytes: 2 * 1024 * 1024 + 1,
        outcome: "failed",
        parserOutcome: "rejected",
      }),
    );
  });

  it("records the sanitized attempted redirect destination when the next hop fails", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).includes("initial-record")) {
        return new Response(null, {
          status: 302,
          headers: { location: "/laws/final-record?signature=private" },
        });
      }
      throw new Error("The redirected network request failed.");
    });
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({ url: "https://agency.gov/laws/initial-record?token=private" })],
      retrievedAt,
      runtime,
    );

    expect(result).toMatchObject({ status: "rejected", retrieved: false });
    expect(runtime.documentAcquisitions).toContainEqual(
      expect.objectContaining({
        finalUrl: "https://agency.gov/laws/final-record",
        redirectChain: [{
          status: 302,
          fromUrl: "https://agency.gov/laws/initial-record",
          toUrl: "https://agency.gov/laws/final-record",
        }],
        outcome: "failed",
      }),
    );
    expect(JSON.stringify({ result, acquisitions: runtime.documentAcquisitions }))
      .not.toMatch(/token=private|signature=private/u);
  });

  it("rejects a query-only redirect that collapses to a sanitized self-hop", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    let cancelled = false;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("redirect body"));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { status: 302, headers: { location: "?token=second" } },
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/laws/query-loop?token=first",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
      runtime,
    );

    expect(result).toMatchObject({ status: "rejected", retrieved: false });
    expect(fetch).toHaveBeenCalledOnce();
    expect(cancelled).toBe(true);
    expect(runtime.documentAcquisitions).toContainEqual(expect.objectContaining({
      requestedUrl: "https://agency.gov/laws/query-loop",
      redirectChain: [],
      finalUrl: "https://agency.gov/laws/query-loop",
      outcome: "failed",
    }));
  });

  it("rejects a sanitized redirect cycle before fetching its repeated destination", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    const cancelled: string[] = [];
    const redirect = (name: string, location: string) => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`${name} body`));
        },
        cancel() {
          cancelled.push(name);
        },
      }),
      { status: 302, headers: { location } },
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).includes("/laws/cycle-a")
        ? redirect("a", "/laws/cycle-b")
        : redirect("b", "/laws/cycle-a?retry=private")
    );
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/laws/cycle-a",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
      runtime,
    );

    expect(result).toMatchObject({ status: "rejected", retrieved: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cancelled).toEqual(["a", "b"]);
    expect(runtime.documentAcquisitions).toContainEqual(expect.objectContaining({
      redirectChain: [{
        status: 302,
        fromUrl: "https://agency.gov/laws/cycle-a",
        toUrl: "https://agency.gov/laws/cycle-b",
      }],
      finalUrl: "https://agency.gov/laws/cycle-b",
      outcome: "failed",
    }));
    expect(JSON.stringify({ result, acquisitions: runtime.documentAcquisitions }))
      .not.toContain("retry=private");
  });

  it("never treats host title metadata as candidate identity evidence", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      officialHtml(
        "This official page contains general institutional publication notices " +
          "and administrative contact information but names no event, regulation, " +
          "formal identifier, operative rule, or affected population.",
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({
        title: candidate.identity.canonicalTitle,
        candidateIdIfKnown: candidate.candidateSnapshotId,
        reasonForRetrieval: "The host asserts this is the named event text.",
      })],
      retrievedAt,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(resolution).toMatchObject({
      candidateId: candidate.candidateSnapshotId,
      status: "rejected",
      source: null,
      overview: null,
    });
    expect(resolution?.source).toBeNull();
    expect(resolution?.reason).toMatch(/did not establish the exact identity/i);

    const [unboundResolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: null })],
      retrievedAt,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(unboundResolution).toMatchObject({
      candidateId: null,
      status: "rejected",
      source: null,
      overview: null,
    });
    expect(unboundResolution?.source).toBeNull();
    expect(unboundResolution?.reason).toMatch(
      /fixed parsing could not derive.*host metadata alone cannot create a candidate/i,
    );
  });

  it("rejects a same-title official page issued by a conflicting agency", async () => {
    const state = structuredClone(buildFindFactsState());
    const candidate = state.candidates[0]!;
    // Exercise issuer binding independently of the formal-identifier check.
    candidate.identity.formalIdentifier = null;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>${candidate.identity.canonicalTitle}</h1>` +
      `<p>Issuer: Federal Energy Regulatory Commission. Jurisdiction: ` +
      `United States. This regulation requires covered energy businesses ` +
      `to file market notices and became effective January 1, 2020.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );
    expect(result).toMatchObject({ status: "rejected", source: null });
    expect(result?.reason).toMatch(/exact identity/i);
  });

  it("rejects a same-title page on an unrelated official host when response identity coordinates are absent", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>${candidate.identity.canonicalTitle}</h1>` +
      `<p>This regulation requires covered businesses to publish notices and ` +
      `became effective January 1, 2020, but the response identifies no ` +
      `formal instrument, issuer, jurisdiction, or candidate source locator.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({
        url: "https://commerce.gov/laws/unrelated-same-title-page",
        candidateIdIfKnown: candidate.candidateSnapshotId,
      })],
      retrievedAt,
    );

    expect(result).toMatchObject({ status: "rejected", source: null });
    expect(result?.reason).toMatch(/exact identity/i);
  });

  it("rejects exact locator and title when the response provides no identity coordinate", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const source = state.sources.find((item) =>
      candidate.sourceIds.includes(item.id)
    )!;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>${candidate.identity.canonicalTitle}</h1>` +
      `<p>Jurisdiction: ${candidate.identity.issuingJurisdiction}. This page ` +
      `states general requirements for covered businesses but provides no ` +
      `formal identifier or issuer.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({
        url: source.locator,
        candidateIdIfKnown: candidate.candidateSnapshotId,
      })],
      retrievedAt,
    );

    expect(result).toMatchObject({ status: "rejected", source: null });
    expect(result?.reason).toMatch(/exact identity/i);
  });

  it.each([
    "International Trade Commission",
    "Federal Trade Appeals Commission",
  ])("does not token-match Federal Trade Commission to %s", async (
    observedIssuer,
  ) => {
    const state = structuredClone(buildFindFactsState());
    const candidate = state.candidates[0]!;
    candidate.identity.formalIdentifier = null;
    candidate.identity.issuer = "Federal Trade Commission";
    candidate.identity.issuingJurisdiction = "United States";
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>${candidate.identity.canonicalTitle}</h1>` +
      `<p>Issuer: ${observedIssuer}. Jurisdiction: United States. ` +
      `This regulation requires covered businesses to publish notices.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );

    expect(result).toMatchObject({ status: "rejected", source: null });
    expect(result?.reason).toMatch(/exact identity/i);
  });

  it.each([
    ["Federal Trade Commission", "FTC"],
    ["U.S. Securities and Exchange Commission", "SEC"],
    ["US Securities and Exchange Commission", "SEC"],
    ["Federal Energy Regulatory Commission (FERC)", "FERC"],
    ["U.S. Federal Energy Regulatory Commission (FERC)", "FERC"],
  ])("retains curated institution identity %s as %s", async (
    expectedIssuer,
    observedIssuer,
  ) => {
    const state = structuredClone(buildFindFactsState());
    const candidate = state.candidates[0]!;
    candidate.identity.formalIdentifier = null;
    candidate.identity.issuer = expectedIssuer;
    candidate.identity.issuingJurisdiction = "United States";
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>${candidate.identity.canonicalTitle}</h1>` +
      `<p>Issuer: ${observedIssuer}. Jurisdiction: United States. This regulation requires ` +
      `covered businesses to publish notices and retain compliance records.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );

    expect(result).toMatchObject({
      status: "verified",
      source: { channel: "host-proposed-official-source-verified" },
    });
  });

  it("exact-matches a visible official title after standard entity decoding", async () => {
    const state = structuredClone(buildFindFactsState());
    const candidate = state.candidates[0]!;
    candidate.identity.canonicalTitle = "Marché Access Rule No. 42";
    candidate.identity.commonNames = [];
    candidate.identity.formalIdentifier = null;
    candidate.identity.issuer = "Federal Trade Commission";
    candidate.identity.issuingJurisdiction = "United States";
    const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
      `<h1>March&eacute; Access Rule No. 42 &#x2013; Official legal text</h1>` +
        `<p>Issuer: FTC. Jurisdiction: United States. This rule requires ` +
        `covered businesses to publish access terms.</p>`,
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );
    expect(result).toMatchObject({ status: "verified" });
  });

  it("does not bind a candidate from an incidental alias mention in another document", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const alias = candidate.identity.commonNames[0]!;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      officialHtml(
        `<h1>Online Market Records Regulation 2026</h1>` +
          `<p>This regulation requires covered marketplace operators to retain ` +
          `transaction records and publish access notices. A background list ` +
          `mentions ${alias}, consumer privacy rules, and several unrelated ` +
          `international instruments for comparison only.</p>`,
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(resolution).toMatchObject({
      candidateId: candidate.candidateSnapshotId,
      status: "rejected",
      source: null,
      proposal: null,
    });
    expect(resolution?.reason).toMatch(/did not establish the exact identity/i);

    const ccpaState = buildFindFactsState({ candidate: "ccpa" });
    const ccpa = ccpaState.candidates[0]!;
    const partialTitleFetch = vi.fn<typeof globalThis.fetch>(async () =>
      officialHtml(
        `<h1>Privacy Act</h1><p>This Privacy Act requires covered entities ` +
          `to publish notices. It mentions the California Consumer Privacy Act ` +
          `only as one of several separate comparison statutes.</p>`,
      ));
    const [partialTitle] = await retrieveScreen02HostOfficialSourceLeads(
      env(partialTitleFetch),
      ccpaState,
      [lead({ candidateIdIfKnown: ccpa.candidateSnapshotId })],
      retrievedAt,
    );
    expect(partialTitle).toMatchObject({
      status: "rejected",
      source: null,
      proposal: null,
    });
  });

  it("rejects a containing repeal title but retains an exact segmented page title", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const identity = `<p>${candidate.identity.formalIdentifier}. Issuer: ` +
      `${candidate.identity.issuer}. Jurisdiction: ` +
      `${candidate.identity.issuingJurisdiction}. This regulation requires ` +
      `covered businesses to publish notices and retain compliance records.</p>`;
    const repealFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><head><title>` +
          `${candidate.identity.canonicalTitle} | Official legal text</title>` +
          `</head><body><main><h1>Repeal of ` +
          `${candidate.identity.canonicalTitle}</h1>${identity}</main></body></html>`,
        { headers: { "content-type": "text/html" } },
      ));
    const [repeal] = await retrieveScreen02HostOfficialSourceLeads(
      env(repealFetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );
    expect(repeal).toMatchObject({ status: "rejected", source: null });

    for (const suffix of ["Repeal notice", "Amending regulation"]) {
      const siblingFetch = vi.fn<typeof globalThis.fetch>(async () =>
        new Response(
          `<!doctype html><html><head><title>` +
            `${candidate.identity.canonicalTitle} | ${suffix}</title>` +
            `</head><body><main>${identity}</main></body></html>`,
          { headers: { "content-type": "text/html" } },
        ));
      const [sibling] = await retrieveScreen02HostOfficialSourceLeads(
        env(siblingFetch),
        state,
        [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
        retrievedAt,
      );
      expect(sibling).toMatchObject({ status: "rejected", source: null });
    }

    const segmentedFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><head><title>` +
          `${candidate.identity.canonicalTitle} | Official legal text</title>` +
          `</head><body><main>${identity}</main></body></html>`,
        { headers: { "content-type": "text/html" } },
      ));
    const [segmented] = await retrieveScreen02HostOfficialSourceLeads(
      env(segmentedFetch),
      state,
      [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
      retrievedAt,
    );
    expect(segmented).toMatchObject({
      status: "verified",
      source: { channel: "host-proposed-official-source-verified" },
    });
  });

  it("binds only response-own formal fields and ignores referenced instruments", async () => {
    const state = buildFindFactsState();
    const candidate = state.candidates[0]!;
    const resolve = async (facts: string) => {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => officialHtml(
        `<h1>${candidate.identity.canonicalTitle}</h1><p>${facts} ` +
          `This regulation requires covered businesses to publish notices.</p>`,
      ));
      return (await retrieveScreen02HostOfficialSourceLeads(
        env(fetch),
        state,
        [lead({ candidateIdIfKnown: candidate.candidateSnapshotId })],
        retrievedAt,
      ))[0]!;
    };

    const citedOther = await resolve(
      `Formal identifier: ${candidate.identity.formalIdentifier}. This ` +
        `instrument cites Directive 2014/95/EU for background`,
    );
    expect(citedOther).toMatchObject({ status: "verified" });

    const wrongOwn = await resolve(
      `Formal identifier: Directive 2014/95/EU. For background it cites ` +
        `${candidate.identity.formalIdentifier}`,
    );
    expect(wrongOwn).toMatchObject({ status: "rejected", source: null });

    const backgroundOnly = await resolve(
      `For background this index cites ${candidate.identity.formalIdentifier}, ` +
        `but states no response-native formal identifier or issuer`,
    );
    expect(backgroundOnly).toMatchObject({
      status: "rejected",
      source: null,
    });
  });

  it("rejects an unbound page whose apparent identity exists only in metadata", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><head>` +
          `<meta name="citation_title" content="Digital Commerce Act 2025">` +
          `<meta name="description" content="Act No. 9911 requires businesses and is effective 2025-01-01.">` +
          `</head><body><nav>Official publication portal</nav></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/laws/digital-commerce-act",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(resolution).toMatchObject({
      status: "rejected",
      retrieved: true,
      source: null,
      proposal: null,
    });
  });

  it("derives an unbound law identity only from visible official content", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><head><title>Commerce publications</title></head>` +
          `<body><main><h1>Digital Market Access Act 2025</h1>` +
          `<p>Formal identifier: Law No. 4821. Issuing authority: Department of Commerce. ` +
          `Jurisdiction: Example Republic. The Act requires online marketplace ` +
          `operators and covered businesses to publish access terms and preserve ` +
          `transaction records. It became effective January 1, 2025.</p></main></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://commerce.gov/laws/digital-market-access-act",
        title: "Host invented a different regulation title",
        issuingBody: "Host invented ministry",
        jurisdiction: "Host invented jurisdiction",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(resolution).toMatchObject({
      status: "verified",
      retrieved: true,
      source: { authorityTier: 1 },
      proposal: {
        title: "Digital Market Access Act 2025",
        nativeIdentity: {
          formalIdentifier: "Law No. 4821",
          issuer: "Department of Commerce",
          issuingJurisdiction: "Example Republic",
        },
      },
    });
    expect(resolution?.candidateId).toBe(resolution?.proposal?.id);
    expect(resolution?.proposal?.title).not.toContain("Host invented");
    expect(JSON.stringify(resolution?.proposal)).not.toContain(
      "Host invented",
    );
  });

  it("does not collapse a segmented relationship title into an unbound base event", async () => {
    const retrieve = async (title: string) => {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
        `<!doctype html><html><body><main><h1>${title}</h1>` +
          `<p>Formal identifier: Law No. 4821. Issuing authority: Department ` +
          `of Commerce. Jurisdiction: Example Republic. The regulation was ` +
          `adopted and requires covered marketplace operators to publish ` +
          `access terms. It became effective January 1, 2025.</p>` +
          `</main></body></html>`,
        { headers: { "content-type": "text/html" } },
      ));
      return (await retrieveScreen02HostOfficialSourceLeads(
        env(fetch),
        buildFindFactsState(),
        [lead({
          url: "https://commerce.gov/laws/segmented-market-access",
          candidateIdIfKnown: null,
        })],
        retrievedAt,
      ))[0]!;
    };

    for (const title of [
      "Digital Market Access Act 2025 | Repeal notice",
      "Amending regulation | Digital Market Access Act 2025",
    ]) {
      expect(await retrieve(title)).toMatchObject({
        status: "rejected",
        source: null,
        proposal: null,
      });
    }
    expect(await retrieve(
      "Digital Market Access Act 2025 | Official legal text",
    )).toMatchObject({
      status: "verified",
      proposal: { title: "Digital Market Access Act 2025" },
    });
  });

  it("rejects an unbound same-title event without a source-native or formal identifier", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
      `<!doctype html><html><body><main>` +
        `<h1>Marketplace Access Act 2025</h1>` +
        `<p>The Act was enacted and requires marketplace operators and ` +
        `covered businesses to publish access terms. It became effective ` +
        `January 1, 2025.</p></main></body></html>`,
      { headers: { "content-type": "text/html" } },
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://commerce.gov/laws/unresolved-marketplace-access",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(result).toMatchObject({
      status: "rejected",
      retrieved: true,
      candidateId: null,
      source: null,
      proposal: null,
    });
  });

  it("rejects an unbound page with competing formal identifiers", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
      `<!doctype html><html><body><main>` +
        `<h1>Marketplace Access Act 2025</h1>` +
        `<p>Formal identifier: Law No. 1234. Formal identifier: Law No. 9999. The Act was enacted and requires ` +
        `marketplace operators and covered businesses to publish access ` +
        `terms. It became effective January 1, 2025.</p>` +
        `</main></body></html>`,
      { headers: { "content-type": "text/html" } },
    ));
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://commerce.gov/laws/competing-identities",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(result).toMatchObject({
      status: "rejected",
      retrieved: true,
      candidateId: null,
      source: null,
      proposal: null,
    });
  });

  it("rejects unbound bill pages without both operative status and a labelled operative date", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const introduced = String(input).endsWith("/bills/introduced-marketplace-bill");
      return new Response(
        `<!doctype html><html><body><main>` +
          `<h1>Assembly Bill ${introduced ? "1234" : "4321"} — Marketplace Records Bill</h1>` +
          (introduced
            ? `<p>Assembly Bill 1234 was introduced 2025-01-15 and, if enacted, ` +
              `would require online marketplace operators and covered businesses ` +
              `to retain transaction records. The bill is effective January 1, ` +
              `2026 if enacted, and remains under committee review.</p>`
            : `<p>Assembly Bill 4321 was enacted on 2025-06-01. The law requires ` +
              `online marketplace operators and covered businesses to retain ` +
              `transaction records, but this page states no effective or operative date.</p>`) +
          `</main></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    });
    const results = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [
        lead({
          url: "https://agency.gov/bills/introduced-marketplace-bill",
          candidateIdIfKnown: null,
        }),
        lead({
          url: "https://agency.gov/bills/enacted-without-operative-date",
          candidateIdIfKnown: null,
        }),
      ],
      retrievedAt,
    );

    expect(results).toHaveLength(2);
    expect(results.every((result) =>
      result.status === "rejected" && result.source === null &&
      result.proposal === null
    )).toBe(true);
  });

  it("rejects an unbound draft regulation despite a proposed date and controlling language", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><body><main>` +
          `<h1>Draft Online Market Records Regulation 2027</h1>` +
          `<p>The proposed regulation would require online marketplace ` +
          `operators and covered businesses to retain transaction records. ` +
          `The draft is effective January 1, 2027 if adopted, and its ` +
          `publication date is 2026-09-01.</p>` +
          `</main></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/regulations/draft-market-records-rule",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(resolution).toMatchObject({
      status: "rejected",
      retrieved: true,
      source: null,
      proposal: null,
    });
  });

  it("uses a labelled operative date for an enacted unbound bill", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        `<!doctype html><html><body><main>` +
          `<h1>Assembly Bill 5678 — Marketplace Access Bill</h1>` +
          `<p>Assembly Bill 5678 was enacted by the legislature. The measure ` +
          `became effective January 1, 2026. It requires online marketplace ` +
          `operators and covered businesses to publish access terms and retain ` +
          `transaction records for regulatory inspection.</p>` +
          `</main></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ));
    const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({
        url: "https://agency.gov/bills/enacted-marketplace-access-bill",
        candidateIdIfKnown: null,
      })],
      retrievedAt,
    );

    expect(resolution).toMatchObject({
      status: "verified",
      proposal: {
        nativeIdentity: { status: "In force" },
        event: { eventDate: "2026-01-01" },
        provisionalDates: ["2026-01-01"],
      },
    });
  });

  it("uses fixed path and content rules to distinguish primary and explanatory official pages", async () => {
    const body =
      `<!doctype html><html><body><main>` +
      `<h1>Online Seller Records Act 2026</h1>` +
      `<p>Formal identifier: Act No. 7314. Jurisdiction: Example State. The Act requires ` +
      `online sellers and marketplace operators to keep transaction records ` +
      `and provide notices to consumers. It is effective 2026-02-01.</p>` +
      `</main></body></html>`;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "text/html" },
      }));
    const results = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [
        lead({
          url: "https://agency.gov/laws/online-seller-records-act",
          candidateIdIfKnown: null,
        }),
        lead({
          url: "https://agency.gov/guidance/online-seller-records-act-fact-sheet",
          candidateIdIfKnown: null,
        }),
      ],
      retrievedAt,
    );

    expect(results.map((result) => result.status)).toEqual([
      "verified",
      "verified",
    ]);
    expect(results.map((result) => result.source?.authorityTier)).toEqual([
      1,
      2,
    ]);
    expect(results[1]?.source?.authorityAssessment?.reason).toMatch(
      /not promoted to a controlling primary record/i,
    );
  });

  it("content-versions the same official URL so workflow source fingerprints change", async () => {
    const page = (requirement: string) =>
      `<!doctype html><html><body><main>` +
      `<h1>Marketplace Records Act 2025</h1>` +
      `<p>Formal identifier: Act No. 9912. Jurisdiction: Example State. The Act requires ` +
      `marketplace operators and covered businesses to ${requirement}. ` +
      `It became effective January 1, 2025.</p></main></body></html>`;
    const retrieve = async (requirement: string) => {
      const fetch = vi.fn<typeof globalThis.fetch>(async () =>
        new Response(page(requirement), {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      const [resolution] = await retrieveScreen02HostOfficialSourceLeads(
        env(fetch),
        buildFindFactsState(),
        [lead({
          url: "https://agency.gov/laws/marketplace-records-act",
          candidateIdIfKnown: null,
        })],
        retrievedAt,
      );
      if (!resolution?.proposal) throw new Error("Expected parsed proposal.");
      return resolution;
    };
    const first = await retrieve("retain transaction records for three years");
    const second = await retrieve("retain transaction records for seven years");
    expect(first.candidateId).toBe(second.candidateId);
    expect(first.source?.id).not.toBe(second.source?.id);
    expect(first.source?.evidenceText).not.toBe(second.source?.evidenceText);
    expect(first.contentFingerprint).not.toBe(second.contentFingerprint);
    expect(first.leadFingerprint).toBe(second.leadFingerprint);

    const empty = createScreen02FindState(
      confirmedWorkflowFindContext("All industries", {
        eventDescriptor: "business regulation",
        studyPeriod: "2024–2026",
      }),
      "source-version-run",
      "2026-09-03T11:59:00.000Z",
    );
    const discoveryFor = (
      proposal: NonNullable<typeof first.proposal>,
      suffix: string,
    ) => {
      const manifest = workflowManifest(
        "Find the bounded source-version candidate.",
      );
      manifest.retrievedAt = retrievedAt;
      manifest.queryMatrix[0]!.returnedRecordIds = [proposal.id];
      return buildScreen02FindDiscoveryFromProposals(empty, {
        searchRoundId: `source-version-round-${suffix}`,
        at: retrievedAt,
        proposals: [proposal],
        manifest,
        resultOrigins: [{
          proposalId: proposal.id,
          origins: [{
            kind: "query-result",
            retrievalLane: "host-official",
            evidenceRole: "identity",
            producerRecordId: proposal.id,
            queryId: "query-1",
            returnedRecordIds: [proposal.id],
            sourceIds: proposal.sources.map((source) => source.id),
          }],
        }],
      });
    };
    const firstDiscovery = discoveryFor(first.proposal!, "a");
    const secondDiscovery = discoveryFor(second.proposal!, "b");
    expect(firstDiscovery.sources[0]?.sourceFingerprint).not.toBe(
      secondDiscovery.sources[0]?.sourceFingerprint,
    );
    expect(firstDiscovery.candidates[0]?.sourceIds).not.toEqual(
      secondDiscovery.candidates[0]?.sourceIds,
    );
  });

  it("keeps same-title unbound records distinct by source-native coordinates", async () => {
    const retrieve = async (url: string, lawNumber: string, issuer: string) => {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(
        `<!doctype html><html><body><main>` +
          `<h1>Marketplace Access Act 2025</h1>` +
          `<p>Formal identifier: Law No. ${lawNumber}. Issuer: ${issuer}. Jurisdiction: Example ` +
          `Republic. The Act requires marketplace operators and covered ` +
          `businesses to publish access terms. It became effective January ` +
          `1, 2025.</p></main></body></html>`,
        { headers: { "content-type": "text/html" } },
      ));
      return (await retrieveScreen02HostOfficialSourceLeads(
        env(fetch),
        buildFindFactsState(),
        [lead({ url, candidateIdIfKnown: null })],
        retrievedAt,
      ))[0]!;
    };
    const first = await retrieve(
      "https://commerce.gov/laws/marketplace-access-a",
      "4101",
      "Department of Commerce",
    );
    const second = await retrieve(
      "https://trade.gov/laws/marketplace-access-b",
      "9822",
      "Trade Authority",
    );
    expect(first.status).toBe("verified");
    expect(second.status).toBe("verified");
    expect(first.candidateId).not.toBe(second.candidateId);
  });

  it("shares the 24-document cap and concurrency two across host batches", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    let active = 0;
    let peak = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return officialHtml(
        "This official publication page contains bounded administrative text " +
          "but does not establish a legal-event identity.",
      );
    });
    for (let batch = 0; batch < 4; batch += 1) {
      await retrieveScreen02HostOfficialSourceLeads(
        env(fetch),
        buildFindFactsState(),
        Array.from({ length: 8 }, (_unused, index) => lead({
          url: `https://agency.gov/laws/batch-${batch}-record-${index}`,
          reasonForRetrieval: `Retrieve bounded record ${batch}-${index}.`,
        })),
        retrievedAt,
        runtime,
      );
    }
    expect(fetch).toHaveBeenCalledTimes(24);
    expect(runtime.documentsAttempted).toBe(24);
    expect(runtime.documentAcquisitions).toHaveLength(24);
    expect(runtime.peakConcurrentDocumentRequests).toBe(2);
    expect(peak).toBe(2);
  });

  it("invalidates a failed candidate/source/level cache entry", async () => {
    const runtime = createScreen02SubstantiveEnrichmentRuntime();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("temporary source failure"))
      .mockResolvedValueOnce(officialHtml(
        "This official publication contains bounded administrative text only.",
      ));
    const inputLead = lead({ url: "https://agency.gov/laws/retry-record" });
    await retrieveScreen02HostOfficialSourceLeads(
      env(fetch), buildFindFactsState(), [inputLead], retrievedAt, runtime,
    );
    await retrieveScreen02HostOfficialSourceLeads(
      env(fetch), buildFindFactsState(), [inputLead], retrievedAt, runtime,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(runtime.documentAcquisitions.map((entry) => entry.outcome))
      .toEqual(["failed", "succeeded"]);
  });

  it("performs no connector I/O after the shared deadline is exhausted", async () => {
    let now = 2;
    const runtime = createScreen02SubstantiveEnrichmentRuntime(() => now);
    runtime.deadlineStartedAt = 0;
    runtime.deadlineAt = 1;
    const fetch = vi.fn<typeof globalThis.fetch>();
    const [result] = await retrieveScreen02HostOfficialSourceLeads(
      env(fetch),
      buildFindFactsState(),
      [lead({ url: "https://agency.gov/laws/late-record" })],
      retrievedAt,
      runtime,
    );
    now += 1;
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "rejected", retrieved: false });
    expect(runtime.documentAcquisitions).toHaveLength(1);
    expect(runtime.documentAcquisitions[0]).toMatchObject({
      outcome: "failed",
      parserPath: "not-run",
      failureReason: expect.stringMatching(/deadline/i),
    });
  });

  it("keeps an immutable reviewed source while retaining fresh same-id route evidence", () => {
    const reviewed = {
      id: "official-record-stable-id",
      title: "Official legal record",
      locator: "https://agency.gov/laws/official-record",
      publisher: "agency.gov",
      publishedDate: "2025-01-01",
      authorityTier: 1,
      channel: "official-primary",
      retrievedAt: "2026-09-03T11:00:00.000Z",
      evidenceText: "The prior immutable official record text.",
    } satisfies Screen02Source;
    const refreshed = {
      ...reviewed,
      retrievedAt,
      evidenceText:
        "The newly retrieved official record text contains a changed requirement.",
    } satisfies Screen02Source;

    const additions = screen02FreshRouteSourceVersions(
      [reviewed],
      [refreshed],
    );

    expect(additions).toHaveLength(1);
    expect(additions[0]).toMatchObject({
      locator: reviewed.locator,
      evidenceText: refreshed.evidenceText,
    });
    expect(additions[0]?.id).not.toBe(reviewed.id);
    expect(reviewed.evidenceText).toBe(
      "The prior immutable official record text.",
    );
    expect(screen02FreshRouteSourceVersions(
      [reviewed],
      [{ ...reviewed, retrievedAt }],
    )).toEqual([]);

    const reviewedProposal = {
      id: "reviewed-candidate",
      sources: [reviewed],
    } as Screen02FindProposal;
    expect(screen02ChangedHostReviewCandidateIds(
      [reviewedProposal],
      new Map([[reviewedProposal.id, [
        { ...refreshed, id: "content-addressed-refresh-id" },
      ]]]),
    )).toEqual([reviewedProposal.id]);
    expect(screen02ChangedHostReviewCandidateIds(
      [reviewedProposal],
      new Map([[reviewedProposal.id, [{ ...reviewed, retrievedAt }]]]),
    )).toEqual([]);
  });

  it("invalidates stale host review and ranking influence when official content changes", async () => {
    const state = buildFindFactsState({ candidate: "ccpa" });
    const candidate = state.candidates[0]!;
    const priorSource = state.sources[0]!;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).startsWith(priorSource.locator.split("?")[0]!)) {
        return new Response(
          `<!doctype html><html><body><main>` +
            `<h1>${candidate.identity.canonicalTitle}</h1>` +
            `<p>${candidate.identity.formalIdentifier}. The California ` +
            `Consumer Privacy Act requires covered ` +
            `businesses to provide consumer-data notices and privacy rights. ` +
            `Issuer: California Legislature. Jurisdiction: California. ` +
            `This freshly retrieved body contains changed official content and ` +
            `became effective January 1, 2020.</p>` +
            `</main></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    // This intentionally malformed value would fail common qualification if
    // the stale review survived source-change invalidation.
    const staleReview = new Map([
      [candidate.candidateId, { invalid: true }],
    ]) as unknown as Screen02CandidateReviewInfluenceMap;
    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
        SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "changed-source-host-review-round",
        at: retrievedAt,
        exactRequest: "Refresh the reviewed candidate from its official URL.",
        maximumCandidates: 10,
        queryPlanning: {
          origin: "chatgpt-host",
          queryTerms: [],
          rationale: "Verify whether the official source body changed.",
          requestId: "changed-source-host-task",
          receiptId: "changed-source-host-result",
          officialSourceLeads: [lead({
            url: priorSource.locator,
            candidateIdIfKnown: candidate.candidateSnapshotId,
          })],
          rankingAdjustments: [{
            candidateId: candidate.candidateId,
            adjustment: 3,
          }],
          qualificationProfile: screen02FindRelevanceProfile(state),
          candidateReviewInfluenceById: staleReview,
        },
      },
    );

    const auditedSourceId = discovery.officialSourceLeadAudit?.[0]
      ?.resultingSourceId;
    const refreshedQualification = discovery.manifest.exclusions
      .map((entry) => entry.qualification)
      .find((qualification) =>
        auditedSourceId && qualification?.evidenceSourceIds.includes(
          auditedSourceId,
        )
      );
    expect(refreshedQualification).toBeDefined();
    expect(refreshedQualification?.hostReviewInfluence).toBeUndefined();
    expect(refreshedQualification?.ranking.explanation).not.toMatch(
      /validated host pool review applied/i,
    );
    expect(state.sources[0]).toEqual(priorSource);
    expect(discovery.officialSourceLeadAudit?.[0]).toMatchObject({
      verificationStatus: "verified",
      contentFingerprint: expect.stringMatching(/^fnv1a64:[a-f0-9]{16}$/u),
      resultingSourceId: expect.any(String),
    });
    expect(discovery.manifest.retrievalExecution?.documentAcquisitions)
      .toContainEqual(expect.objectContaining({
        schemaVersion: "screen-02-document-acquisition-v1",
        candidateId: candidate.candidateId,
        // The refreshed source informed requalification but was not retained
        // because this current candidate was already shown. Low-artifact
        // persistence therefore keeps the candidate-bound trace without a
        // dangling source reference.
        sourceId: null,
        level: "host-official",
        requestedUrl: priorSource.locator.split("?", 1)[0],
        outcome: "succeeded",
        parserPath: "official-html-visible-text",
        parserOutcome: "parsed",
      }));
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "Host review source-refresh invalidation",
        status: "searched",
        note: expect.stringMatching(
          /prior immutable source version remains.*stale host candidate-review and ranking influence was not applied/i,
        ),
      }),
    );
  });

  it("confines host-added profile vocabulary to retrieval instead of qualification", async () => {
    const state = buildFindFactsState({ candidate: "ccpa" });
    const qualificationProfile = screen02FindRelevanceProfile(state);
    const retrievalProfile = mergeScreen02StudyRelevanceProfileHostAdditions(
      qualificationProfile,
      { industryAliases: ["consumer privacy"] },
      retrievedAt,
      {
        promptVersion: "screen02-host-source-lead-test-v1",
        taskId: "screen02-host-source-lead-task",
        inputFingerprint: "fnv1a64:0000000000000003",
      },
    );
    const enrichedState = {
      ...structuredClone(state),
      relevanceProfile: retrievalProfile,
      revision: state.revision + 1,
      updatedAt: retrievedAt,
    } as typeof state;
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const input = {
      searchRoundId: "pre-host-qualification-profile-round",
      at: retrievedAt,
      exactRequest: "Use host vocabulary for recall without changing eligibility.",
      maximumCandidates: 10,
      queryPlanning: {
        origin: "chatgpt-host" as const,
        queryTerms: [],
        rationale: "Search with one added phrase only.",
        requestId: "pre-host-profile-task",
        receiptId: "pre-host-profile-result",
        officialSourceLeads: [],
        rankingAdjustments: [],
        qualificationProfile,
      },
    };
    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
        SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
      } as unknown as ShockAuditEnv,
      enrichedState,
      input,
    );

    const ccpaQualification = discovery.manifest.exclusions
      .map((entry) => entry.qualification)
      .find((qualification) =>
        qualification?.candidateId === "registry-us-california-ccpa-2020"
      );
    expect(ccpaQualification).toMatchObject({
      classification: "mismatch",
      eligible: false,
    });
    expect(ccpaQualification?.industryFit.matchedDirectTerms).not.toContain(
      "consumer privacy",
    );

    await expect(discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
        SCREEN02_PUBLIC_EVENT_INDEX_MODE: "off",
      } as unknown as ShockAuditEnv,
      enrichedState,
      {
        ...input,
        searchRoundId: "invalid-enriched-qualification-profile-round",
        queryPlanning: {
          ...input.queryPlanning,
          qualificationProfile: retrievalProfile,
        },
      },
    )).rejects.toThrow(/pre-host|additive predecessor/i);
  });

  it("recomputes prior-shown qualifications for migrated or noncanonical profile caches", async () => {
    const at = "2026-09-03T12:30:00.000Z";
    const exactRequest = "Find a source-backed technology regulation.";
    const initial = buildFindFactsState();
    const documentNumber = "2019-12345";
    const title = "Technology Data-Security Investment Rule";
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
      if (`${url.origin}${url.pathname}` ===
          "https://www.federalregister.gov/api/v1/documents.json") {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: documentNumber,
            title,
            type: "Rule",
            abstract:
              `On January 1, 2020, Federal Register document ${documentNumber}, the ${title}, applies to U.S. publicly listed technology firms, including software publishers, and requires each covered firm to change data-security controls and investment practices.`,
            action: "Final rule.",
            publication_date: "2019-06-01",
            effective_on: "2020-01-01",
            html_url:
              `https://www.federalregister.gov/documents/2019/06/01/${documentNumber}/technology-data-security-investment-rule`,
            agencies: [{ name: "Federal Technology Commission" }],
          }],
        }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        `<!doctype html><html><head><title>${title}</title></head><body><main>` +
          `<h1>${title}</h1><p>Federal Register document ${documentNumber}.</p>` +
          `<h2>AGENCY:</h2><p>Federal Technology Commission.</p>` +
          `<p>Issuing authority: Federal Technology Commission. ` +
          `Issuing jurisdiction: United States.</p>` +
          `<h1>ACTION:</h1><p>Final rule.</p>` +
          `<h1>SUMMARY:</h1><p>Federal Register document ${documentNumber}, ` +
          `${title}, applies to U.S. publicly listed technology firms, ` +
          `including software publishers, and requires each covered firm to ` +
          `change data-security controls and investment practices.</p>` +
          `<h1>DATES:</h1>` +
          `<p>Effective January 1, 2020.</p></main></body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    });
    const environment = {
      CONNECTOR_FETCH: fetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
    } as unknown as ShockAuditEnv;
    const discovery = await discoverCanonicalScreen02Find(
      environment,
      initial,
      {
        searchRoundId: "prior-shown-cache-round-1",
        at,
        exactRequest,
        maximumCandidates: 10,
        queryPlanning: {
          origin: "fixed-fallback",
          reason: "Use deterministic retrieval only.",
        },
      },
    );
    expect(
      discovery.candidates.length,
      JSON.stringify(discovery.manifest.exclusions, null, 2),
    ).toBeGreaterThan(0);
    const discoveredCandidate = discovery.candidates.find((candidate) =>
      candidate.candidateId === `fr-${documentNumber}`
    ) ?? discovery.candidates[0]!;
    expect(discoveredCandidate.qualification).toBeDefined();
    const persisted = structuredClone(initial);
    const priorCandidate = persisted.candidates[0]!;
    const candidateFacts = {
      ...structuredClone(discoveredCandidate),
      candidateSnapshotId: priorCandidate.candidateSnapshotId,
      searchRoundId: priorCandidate.searchRoundId,
    };
    persisted.candidates = [{
      ...candidateFacts,
      candidateFingerprint: fingerprintScreen02WorkflowValue(candidateFacts),
    }];
    persisted.sources = discovery.sources.filter((source) =>
      discoveredCandidate.sourceIds.includes(source.id)
    );
    const persistedSet = persisted.candidateSets[0]!;
    const persistedBinding = persistedSet.manifest.retainedResultBinding!;
    persistedSet.manifest.retainedResultBinding = {
      ...persistedBinding,
      results: [{
        ...persistedBinding.results[0]!,
        recordId: discoveredCandidate.candidateId,
        snapshotId: priorCandidate.candidateSnapshotId,
        sourceIds: [...discoveredCandidate.sourceIds],
        qualificationLane: discoveredCandidate.qualification?.lane ?? null,
        origins: persistedBinding.results[0]!.origins.map((origin) => ({
          ...origin,
          sourceIds: [...discoveredCandidate.sourceIds],
        })),
      }],
    };
    persistedSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(persistedSet);
    persisted.updatedAt = at;
    persisted.revision += 1;
    const canonicalPersisted = requireScreen02FindState(persisted);
    const candidateId = canonicalPersisted.candidates[0]!.candidateId;

    const rerun = (state: typeof canonicalPersisted, searchRoundId: string) =>
      discoverCanonicalScreen02Find(environment, state, {
        searchRoundId,
        at,
        exactRequest,
        maximumCandidates: 10,
        queryPlanning: {
          origin: "fixed-fallback" as const,
          reason: "Use deterministic retrieval only.",
        },
      });
    const refreshCandidateFingerprint = (state: typeof canonicalPersisted) => {
      const candidate = state.candidates.find((entry) =>
        entry.candidateId === candidateId
      )!;
      const { candidateFingerprint: _candidateFingerprint, ...facts } =
        candidate;
      candidate.candidateFingerprint =
        fingerprintScreen02WorkflowValue(facts);
    };

    const reusable = structuredClone(canonicalPersisted);
    const reusableQualification = reusable.candidates.find((candidate) =>
      candidate.candidateId === candidateId
    )!.qualification!;
    reusableQualification.explanation = "CANONICAL-CACHE-SENTINEL";
    refreshCandidateFingerprint(reusable);
    const reusableResult = await rerun(
      requireScreen02FindState(reusable),
      "prior-shown-cache-round-reusable",
    );
    const reusableExclusion = reusableResult.manifest.exclusions.find(
      (entry) => entry.recordId === candidateId,
    );
    expect(reusableExclusion?.reason).toMatch(
      /persisted qualification was reused/i,
    );
    expect(reusableExclusion?.qualification?.explanation).toContain(
      "CANONICAL-CACHE-SENTINEL",
    );

    const legacyV4 = structuredClone(canonicalPersisted);
    const legacyV4Qualification = legacyV4.candidates.find((candidate) =>
      candidate.candidateId === candidateId
    )!.qualification!;
    legacyV4Qualification.cacheKey = legacyV4Qualification.cacheKey.replace(
      ":grounding:screen-02-source-grounding-v1:policy-v4",
      ":grounding:screen-02-source-grounding-v1:policy-v3",
    );
    legacyV4Qualification.explanation = "LEGACY-V4-CACHE-SENTINEL";
    refreshCandidateFingerprint(legacyV4);
    const canonicalLegacyV4 = requireScreen02FindState(legacyV4);
    const legacyV4Result = await rerun(
      canonicalLegacyV4,
      "prior-shown-cache-round-legacy-v4",
    );
    const legacyV4Exclusion = legacyV4Result.manifest.exclusions.find(
      (entry) => entry.recordId === candidateId,
    );
    expect(legacyV4Exclusion?.reason).toMatch(
      /fixed qualification was recomputed/i,
    );
    expect(legacyV4Exclusion?.qualification?.cacheKey).toContain(
      ":grounding:screen-02-source-grounding-v1:policy-v4",
    );
    expect(legacyV4Exclusion?.qualification?.explanation).not.toContain(
      "LEGACY-V4-CACHE-SENTINEL",
    );

    const migrated = structuredClone(canonicalPersisted);
    const migratedQualification = migrated.candidates.find((candidate) =>
      candidate.candidateId === candidateId
    )!.qualification!;
    migratedQualification.explanation = "MIGRATED-CACHE-SENTINEL";
    migratedQualification.migrationProvenance = {
      schemaVersion: "screen-02-candidate-qualification-migration-v1",
      fromVersion: "screen-02-candidate-qualification-v3",
      method: "derived-retained-v3-disposition",
      sourceEvidenceReconstructed: false,
    };
    refreshCandidateFingerprint(migrated);
    const canonicalMigrated = requireScreen02FindState(migrated);
    const migratedResult = await rerun(
      canonicalMigrated,
      "prior-shown-cache-round-migrated",
    );
    const migratedExclusion = migratedResult.manifest.exclusions.find(
      (entry) => entry.recordId === candidateId,
    );
    expect(migratedExclusion?.reason).toMatch(/fixed qualification was recomputed/i);
    expect(migratedExclusion?.qualification).not.toHaveProperty(
      "migrationProvenance",
    );
    expect(migratedExclusion?.qualification?.explanation).not.toContain(
      "MIGRATED-CACHE-SENTINEL",
    );

    const noncanonical = structuredClone(canonicalPersisted);
    noncanonical.relevanceProfile!.origin = "researcher-edited";
    noncanonical.relevanceProfile!.industryAliases = [
      ...noncanonical.relevanceProfile!.industryAliases,
      "technology services",
    ];
    const noncanonicalQualification = noncanonical.candidates.find(
      (candidate) => candidate.candidateId === candidateId,
    )!.qualification!;
    noncanonicalQualification.explanation = "NONCANONICAL-CACHE-SENTINEL";
    refreshCandidateFingerprint(noncanonical);
    const canonicalNoncanonical = requireScreen02FindState(noncanonical);
    const noncanonicalResult = await rerun(
      canonicalNoncanonical,
      "prior-shown-cache-round-noncanonical",
    );
    const noncanonicalExclusion = noncanonicalResult.manifest.exclusions.find(
      (entry) => entry.recordId === candidateId,
    );
    expect(noncanonicalExclusion?.reason).toMatch(
      /fixed qualification was recomputed/i,
    );
    expect(noncanonicalExclusion?.qualification?.explanation).not.toContain(
      "NONCANONICAL-CACHE-SENTINEL",
    );
    expect(noncanonicalExclusion?.qualification?.cacheKey).not.toBe(
      noncanonicalQualification.cacheKey,
    );
  });

  it("audits the fetched lead, exact content, and persisted workflow source chain", async () => {
    const proposedUrl = "https://commerce.gov/laws/platform-notice-act";
    const state = buildFindFactsState();
    const industry = state.screen01Baseline.scopeContract.industry;
    const geography = state.screen01Baseline.scopeContract.geography;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input) === proposedUrl) {
        return new Response(
          `<!doctype html><html><body><main>` +
            `<h1>Platform Notice Act 2019</h1>` +
            `<p>Formal identifier: Act No. 8765. Issuing authority: Department of Commerce. ` +
            `Jurisdiction: ${geography}. The Act requires U.S. publicly listed ${industry} ` +
            `companies and software marketplace operators to publish access ` +
            `notices and retain transaction records. It became effective ` +
            `January 1, 2019.</p></main></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const proposedLead = lead({
      url: proposedUrl,
      title: "Untrusted host title",
      issuingBody: "Untrusted host issuer",
      jurisdiction: "Untrusted host jurisdiction",
      candidateIdIfKnown: null,
    });
    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "official-lead-audit-round",
        at: retrievedAt,
        exactRequest: "Retrieve and qualify one official legal record.",
        maximumCandidates: 10,
        queryPlanning: {
          origin: "chatgpt-host",
          queryTerms: [],
          rationale: "Check one bounded official locator.",
          requestId: "official-lead-audit-task",
          receiptId: "official-lead-audit-result",
          officialSourceLeads: [proposedLead],
          rankingAdjustments: [],
          qualificationProfile: screen02FindRelevanceProfile(state),
        },
      },
    );

    expect(discovery.officialSourceLeadAudit).toHaveLength(1);
    const audit = discovery.officialSourceLeadAudit?.[0];
    expect(
      audit,
      JSON.stringify(discovery.manifest.exclusions, null, 2),
    ).toMatchObject({
      leadFingerprint: expect.stringMatching(/^fnv1a64:[a-f0-9]{16}$/u),
      contentFingerprint: expect.stringMatching(/^fnv1a64:[a-f0-9]{16}$/u),
      verificationStatus: "verified",
      resultingSourceId: expect.any(String),
      resultingSourceFingerprint: expect.stringMatching(
        /^fnv1a64:[a-f0-9]{16}$/u,
      ),
      resultingSourceStatus: "persisted",
    });
    expect(discovery.sources).toContainEqual(expect.objectContaining({
      id: audit?.resultingSourceId,
      sourceFingerprint: audit?.resultingSourceFingerprint,
      evidenceText: expect.stringContaining("Act No. 8765"),
    }));
    expect(discovery.manifest.queryMatrix).toContainEqual(
      expect.objectContaining({
        query: proposedUrl,
        returnedRecordIds: [
          expect.stringMatching(/^host-official-event-/u),
        ],
      }),
    );
  });

  it("executes accepted host query variants inside the bounded on-mode native slice", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const terms = [
      "cloud marketplace eligibility threshold",
      "software publisher reporting duty",
      "app distribution market access",
      "data processor licensing rule",
    ];
    const state = buildFindFactsState();
    const industry = state.screen01Baseline.scopeContract.industry;
    const preHostPlan = buildScreen02NativeQueryPlan({
      industry,
      assistantTerms: terms,
      studyProfile: screen02FindRelevanceProfile(state),
    });
    const firstTwoHostVariants = preHostPlan.variants.filter((variant) =>
      variant.strategy === "chatgpt-query-expansion"
    ).slice(0, 2);
    const fixedVariants = preHostPlan.variants.filter((variant) =>
      variant.strategy !== "chatgpt-query-expansion"
    );
    const fullNativePlan = {
      ...preHostPlan,
      variants: [
        ...fixedVariants,
        ...Array.from({ length: 16 }, (_, index) => ({
          id: `filled-fixed-${index + 1}`,
          query: `${industry} bounded fixed vocabulary ${index + 1}`,
          purpose: "Fill the ordinary native query budget for this regression.",
          strategy: "industry-alias" as const,
        })),
        ...firstTwoHostVariants,
      ].slice(0, 14).concat(firstTwoHostVariants),
    };
    expect(fullNativePlan.variants).toHaveLength(16);
    expect(fullNativePlan.variants.filter((variant) =>
      variant.strategy === "chatgpt-query-expansion"
    )).toHaveLength(2);
    const rescheduled = scheduleScreen02HostQueryVariants({
      nativeQueryPlan: fullNativePlan,
      primaryQuery: industry,
      assistantTerms: terms,
    });
    expect(rescheduled).toHaveLength(16);
    expect(rescheduled.filter((variant) =>
      variant.strategy === "chatgpt-query-expansion"
    )).toHaveLength(4);
    const discovery = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      state,
      {
        searchRoundId: "host-query-execution-round",
        at: retrievedAt,
        exactRequest: "Run one bounded host-assisted discovery round.",
        maximumCandidates: 10,
        queryPlanning: {
          origin: "chatgpt-host",
          queryTerms: terms,
          rationale: "Use distinct official-search vocabulary.",
          requestId: "host-query-execution-task",
          receiptId: "host-query-execution-result",
          officialSourceLeads: [],
          rankingAdjustments: [],
          qualificationProfile: screen02FindRelevanceProfile(state),
        },
      },
    );

    expect(discovery.hostQueryExecution).toEqual({
      submittedTerms: [...terms].sort((left, right) =>
        left.localeCompare(right, "en-US")),
      plannedTerms: expect.arrayContaining(terms),
      executedTerms: expect.arrayContaining(terms),
      skipped: [],
    });
    expect(discovery.hostQueryExecution?.plannedTerms).toHaveLength(4);
    expect(discovery.hostQueryExecution?.executedTerms).toHaveLength(4);
    const executedHostQueries = discovery.manifest.queryMatrix.filter(
      (query) =>
        query.purpose.includes("vocabulary to improve official-record recall"),
    );
    expect(executedHostQueries).toHaveLength(4);
    const executedTerms = executedHostQueries.map((query) =>
      new URL(query.query).searchParams.get("conditions[term]") ?? ""
    );
    for (const term of terms) {
      expect(executedTerms).toContain(`${industry} ${term}`);
    }
    expect(discovery.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "Assisted query-vocabulary execution",
        status: "searched",
        note: expect.stringContaining(
          "Submitted 4, planned 4, executed 4, and skipped 0",
        ),
      }),
    );
  });

  it("uses an untrusted foreign issuer lead for route recall but requires fetched domestic applicability", async () => {
    const candidateId = "eu-law-32019r0042";
    const candidateTitle =
      "Regulation (EU) 2019/42 on Video Game Cross-Border Accessibility";
    const hintedLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3AROUTE-HINT";
    const run = async (sourceSupportsDomesticApplicability: boolean) => {
      const state = createScreen02FindState(
        confirmedWorkflowFindContext("Video gaming", {
          eventDescriptor: "regulatory shock",
          studyPeriod: "2014–2022",
        }),
        `foreign-route-${sourceSupportsDomesticApplicability ? "bound" : "unbound"}`,
        retrievedAt,
      );
      const requested: URL[] = [];
      const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
        const url = input instanceof URL
          ? input
          : new URL(typeof input === "string" ? input : input.url);
        requested.push(url);
        if (url.pathname.includes("/api/v1/documents")) {
          return new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json" },
          });
        }
        if (`${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT) {
          return new Response(JSON.stringify({
            results: {
              bindings: [{
                work: {
                  value:
                    "http://publications.europa.eu/resource/cellar/video-game-cross-border",
                },
                celex: { value: "32019R0042" },
                title: { value: candidateTitle },
                date: { value: "2019-06-06" },
                type: {
                  value:
                    "http://publications.europa.eu/resource/authority/resource-type/REG",
                },
              }],
            },
          }), { headers: { "content-type": "application/json" } });
        }
        if (url.toString() === hintedLocator) {
          return new Response("Not found", { status: 404 });
        }
        if (url.searchParams.get("uri") === "CELEX:32019R0042") {
          const applicability = sourceSupportsDomesticApplicability
            ? "The regulation has extraterritorial reach and applies to U.S. publicly listed video gaming firms and other foreign organizations regardless of their location when they offer goods or services to residents."
            : "The regulation applies to video game publishers established in the European Union.";
          return new Response(
            `<!doctype html><html lang="en"><head><title>${candidateTitle}</title><meta name="WT.z_docID" content="32019R0042"><meta property="eli:title" lang="en" content="${candidateTitle}"></head><body><main><div class="eli-container"><div class="eli-main-title">${candidateTitle}</div><p>Issuing jurisdiction: European Union.</p><p>${applicability}</p><p>The final regulation requires covered video game publishers to change accessibility controls. It became effective on 2019-09-01.</p></div></main></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      });
      const discovery = await discoverCanonicalScreen02Find(
        env(fetch),
        state,
        {
          searchRoundId:
            `foreign-route-${sourceSupportsDomesticApplicability ? "bound" : "unbound"}-round`,
          at: retrievedAt,
          exactRequest: "Find source-backed cross-border video game regulations.",
          maximumCandidates: 10,
          queryPlanning: {
            origin: "chatgpt-host",
            queryTerms: [],
            rationale:
              "Use one possible issuing jurisdiction only to diversify official repositories.",
            requestId:
              `foreign-route-${sourceSupportsDomesticApplicability ? "bound" : "unbound"}-task`,
            receiptId:
              `foreign-route-${sourceSupportsDomesticApplicability ? "bound" : "unbound"}-result`,
            officialSourceLeads: [lead({
              url: hintedLocator,
              title: "Untrusted EU applicability lead",
              issuingBody: "European institution",
              jurisdiction: "European Union",
              candidateIdIfKnown: null,
            })],
            rankingAdjustments: [],
            qualificationProfile: screen02FindRelevanceProfile(state),
          },
        },
      );
      return { discovery, requested };
    };

    const withoutPassage = await run(false);
    expect(withoutPassage.requested.some((url) =>
      `${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT
    )).toBe(true);
    expect(withoutPassage.discovery.candidates.some((candidate) =>
      candidate.candidateId === candidateId
    )).toBe(false);
    expect(withoutPassage.discovery.manifest.exclusions).toContainEqual(
      expect.objectContaining({
        recordId: candidateId,
        qualification: expect.objectContaining({
          eligible: false,
          hardScope: expect.objectContaining({
            blockingKeys: expect.arrayContaining(["geography"]),
          }),
        }),
      }),
    );

    const withPassage = await run(true);
    expect(withPassage.requested.some((url) =>
      `${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT
    )).toBe(true);
    expect(
      withPassage.discovery.candidates,
      JSON.stringify(withPassage.discovery.manifest.exclusions, null, 2),
    ).toContainEqual(
      expect.objectContaining({
        candidateId,
        qualification: expect.objectContaining({
          classification: "direct",
          eligible: true,
          hardScope: expect.objectContaining({ passed: true }),
        }),
      }),
    );
  });
});
