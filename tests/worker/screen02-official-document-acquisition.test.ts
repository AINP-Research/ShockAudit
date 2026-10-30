import { describe, expect, it, vi } from "vitest";

import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import { acquireScreen02OfficialDocumentPolicy } from
  "../../src/worker/screen02-official-document-acquisition";

const retrievedAt = "2026-09-17T12:00:00.000Z";
const sourceLocator =
  "https://www.govinfo.gov/content/pkg/PLAW-120publ7/html/PLAW-120publ7.htm";

function workflow(retainedText =
  "The General Policy Act was enacted on January 10, 2026.") {
  const candidate = {
    id: "identity-general-policy",
    officialTitle: "General Policy Act",
    aliases: ["GPA"],
    formalIdentifiers: ["Public Law 120-7", "PLAW-120publ7"],
    issuer: "United States Congress",
    issuingJurisdiction: "United States",
    identitySources: [{
      id: "govinfo-PLAW-120publ7-html",
      title: "General Policy Act",
      locator: sourceLocator,
      publisher: "U.S. Government Publishing Office",
      publishedDate: "2026-01-10",
      authorityTier: "tier-1",
      retrievedAt,
      provider: "GovInfo",
      nativeId: "PLAW-120publ7",
      routeId: "govinfo_public_law",
      routeVersion: "govinfo-public-law-name-discovery-v2",
      accessStatus: "retained_passage",
      inspectedText: "partial",
      contentHash: "sha256:identity-seed",
      retainedText,
    }],
  };
  return {
    candidates: [candidate],
    confirmedShock: {
      id: "confirmed-general-policy",
      officialTitle: candidate.officialTitle,
      aliases: candidate.aliases,
      formalIdentifiers: candidate.formalIdentifiers,
      issuer: candidate.issuer,
      issuingJurisdiction: candidate.issuingJurisdiction,
      confirmation: { candidateId: candidate.id },
    },
  } as unknown as SixScreenWorkflowState;
}

function html(body: string, links = "") {
  return `<!doctype html><html><body><main><h1>General Policy Act</h1>` +
    `<p>Public Law 120-7</p>${body}${links}</main></body></html>`;
}

const allRequirements = [
  "operative_change", "previous_baseline", "coverage", "exemption",
  "temporal_stage", "version", "implementation", "enforcement", "penalty",
] as const;

describe("Screen 2 official-document acquisition", () => {
  it("converts a GovInfo details page to the clean official full-text representation", async () => {
    const state = workflow();
    state.candidates[0]!.identitySources[0]!.locator =
      "https://www.govinfo.gov/app/details/PLAW-120publ7";
    const fetch = vi.fn(async () => new Response(html(
      "<p>A covered operator shall publish an annual report.</p>",
    ), { headers: { "content-type": "text/html" } }));
    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: state,
      fetch,
      retrievedAt,
      focus: "controlling_document",
      searchedRequirementKinds: allRequirements,
    });
    expect(fetch).toHaveBeenCalledWith(sourceLocator, expect.any(Object));
    expect(result.parsed?.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "operative_change" }),
    ]));
  });

  it("uses a metadata-only Open States locator and opens California bill text directly", async () => {
    const state = workflow();
    const candidate = state.candidates[0]!;
    candidate.officialTitle = "California Silenced No More Act";
    candidate.aliases = ["Silenced No More Act"];
    candidate.formalIdentifiers = ["SB 331", "Chapter 638"];
    candidate.issuer = "California Legislature";
    candidate.issuingJurisdiction = "California, United States";
    const navigation =
      "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202120220SB331";
    const billText =
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202120220SB331";
    candidate.identitySources = [{
      ...candidate.identitySources[0]!,
      id: "openstates-official-sb331",
      title: "SB 331 official legislature source",
      locator: navigation,
      publisher: "California Legislature",
      provider: "Official state legislature",
      nativeId: "SB 331",
      routeId: "openstates_official_source_locator",
      accessStatus: "available_metadata",
      inspectedText: "metadata_only",
      contentHash: null,
      retainedText: null,
    }];
    state.confirmedShock!.officialTitle = candidate.officialTitle;
    state.confirmedShock!.aliases = candidate.aliases;
    state.confirmedShock!.formalIdentifiers = candidate.formalIdentifiers;
    state.confirmedShock!.issuer = candidate.issuer;
    state.confirmedShock!.issuingJurisdiction = candidate.issuingJurisdiction;
    const fetch = vi.fn(async () => new Response(`<!doctype html><html><body>
      <main><h1>SB 331 Settlement and nondisparagement agreements</h1>
      <p>SB 331, Chapter 638.</p>
      <p>An employer shall not require an employee to sign a nondisparagement agreement that denies the employee the right to disclose information about unlawful acts in the workplace.</p>
      <p>This act shall become operative on January 1, 2022.</p></main>
      </body></html>`, {
        headers: { "content-type": "text/html" },
      }));

    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: state,
      fetch,
      retrievedAt,
      focus: "controlling_document",
      searchedRequirementKinds: allRequirements,
    });

    expect(fetch).toHaveBeenCalledWith(billText, expect.any(Object));
    expect(result.parsed?.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "operative_change" }),
      expect.objectContaining({
        predicate: "legal_effect_date",
        typedValue: expect.objectContaining({
          date: expect.objectContaining({
            start: "2022-01-01",
            kind: "legal_effect",
          }),
        }),
      }),
    ]));
  });

  it("expands a UK identity fragment to the supplied enacted Act for the policy briefing", async () => {
    const state=workflow();
    state.officialSourceLocators=["https://www.legislation.gov.uk/ukpga/2017/10/enacted"];
    state.candidates[0]!.identitySources[0]!.locator="https://www.legislation.gov.uk/ukpga/2017/10/section/1/data.xml";
    const urls:string[]=[];
    const result=await acquireScreen02OfficialDocumentPolicy({workflow:state,retrievedAt,focus:"controlling_document",searchedRequirementKinds:allRequirements,
      fetch:async input=>{ urls.push(String(input)); return new Response(html("<p>The General Policy Act requires covered drink producers to report levy payments.</p>"),{headers:{"content-type":"text/html"}}); }});
    expect(urls[0]).toBe("https://www.legislation.gov.uk/ukpga/2017/10/enacted/data.xml");
    expect(result.parsed?.collection.sources.some(source=>source.canonicalUrl.endsWith("/enacted/data.xml"))).toBe(true);
  });
  it("keeps dense relationship pages within the reserved resource limits", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => new Response(html(
      "<p>The General Policy Act requires covered operators to report and permits civil penalties.</p>",
      String(input) === sourceLocator ? Array.from({ length: 80 }, (_, i) =>
        `<a href="/policy/enforcement-${i}">Penalties and enforcement ${i}</a>`).join("") : "",
    ), { headers: { "content-type": "text/html" } }));
    const result = await acquireScreen02OfficialDocumentPolicy({ workflow: workflow(), fetch,
      retrievedAt, focus: "related_sources", searchedRequirementKinds: ["enforcement", "penalty"] });
    expect(result.usage.metadataRecords).toBeLessThanOrEqual(24);
    expect(result.usage.usefulDocuments).toBeLessThanOrEqual(4);
    expect(result.usage.documentAttempts).toBeLessThanOrEqual(6);
    expect(result.parsed?.projections.length).toBeGreaterThan(0);
  });
  it("fetches and parses the full controlling representation beyond the identity seed", async () => {
    const fetch = vi.fn(async () => new Response(html([
      "<p>Section 2. A covered operator means an entity doing business in the United States that controls at least 50,000 records.</p>",
      "<p>Section 3. A covered operator shall provide each person access to the person's records.</p>",
      "<p>Section 4. This title does not apply to a nonprofit research institution.</p>",
      "<p>The Act was enacted on January 10, 2026, and becomes effective on July 1, 2026.</p>",
      "<p>The Attorney General may bring a civil action to enforce this title.</p>",
      "<p>A civil penalty of $4,000 per violation may be assessed.</p>",
    ].join("")), {
      status: 200,
      headers: { "content-type": "text/html" },
    }));

    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: workflow(),
      fetch,
      retrievedAt,
      focus: "controlling_document",
      searchedRequirementKinds: allRequirements,
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      usage: {
        documentAttempts: 1,
        usefulDocuments: 1,
        transportHops: 1,
      },
    });
    expect(result.parsed!.collection.sources[0]).toMatchObject({
      canonicalUrl: sourceLocator,
      acquisitionProvenance: "direct",
      inspectedText: "full",
      accessStatus: "parsed_text",
    });
    const predicates = new Set(result.parsed!.projections.map(({ predicate }) =>
      predicate));
    for (const predicate of [
      "operative_change", "coverage_condition", "territorial_nexus",
      "threshold_condition", "exemption_rule", "legal_effect_date",
      "enforcement_authority", "penalty",
    ] as const) expect(predicates.has(predicate)).toBe(true);
    expect(result.parsed!.projections.find(({ predicate }) =>
      predicate === "exemption_rule")!.citation.exactText)
      .toContain("nonprofit research institution");
    expect(result.parsed!.projections.every(({ citation }) =>
      citation.inspectedText === "full")).toBe(true);
  });

  it("sniffs USLM returned as text/plain and never exposes legal markup", async () => {
    const uslm = `<uslm:document xmlns:uslm="http://xml.house.gov/schemas/uslm/1.0">
      <uslm:main><uslm:section><uslm:header>GENERAL POLICY ACT</uslm:header>
      <uslm:text>Public Law 120-7.</uslm:text>
      <uslm:text>A covered operator means an entity doing business in the United States.</uslm:text>
      <uslm:text>A covered operator shall provide each person access to the person's records.</uslm:text>
      <uslm:text>This Act becomes effective on July 1, 2026.</uslm:text>
      </uslm:section></uslm:main></uslm:document>`;
    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: workflow(),
      fetch: async () => new Response(uslm, {
        headers: { "content-type": "text/plain" },
      }),
      retrievedAt,
      focus: "controlling_document",
      searchedRequirementKinds: allRequirements,
    });
    expect(result.parsed?.collection.documentVersions[0]?.representation)
      .toBe("xml");
    expect(result.parsed?.projections.length).toBeGreaterThan(0);
    expect(result.parsed?.projections.every((claim) =>
      !/<\/?(?:uslm:)?[A-Za-z][^>]*>/u.test(
        `${claim.statement} ${claim.citation.exactText}`,
      ))).toBe(true);
  });

  it("follows only a source-native relationship selected for an unresolved gap", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === sourceLocator) return new Response(html(
        "<p>A covered operator shall publish an annual report.</p>",
        '<a href="/content/pkg/PLAW-120publ7/html/PLAW-120publ7-penalties.htm">Penalties and enforcement</a>' +
          '<a href="https://example.com/commentary">Commentary</a>',
      ), { headers: { "content-type": "text/html" } });
      if (url.endsWith("PLAW-120publ7-penalties.htm")) {
        return new Response(html(
          "<p>The Attorney General may bring a civil action to enforce the General Policy Act.</p>" +
          "<p>A civil penalty of $8,000 per intentional violation may be assessed.</p>",
        ), { headers: { "content-type": "text/html" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: workflow(),
      fetch,
      retrievedAt,
      focus: "related_sources",
      searchedRequirementKinds: ["enforcement", "penalty"],
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(([value]) =>
      String(value).includes("example.com"))).toBe(false);
    expect(result.usage).toMatchObject({
      sourceQueries: 1,
      metadataRecords: 1,
      documentAttempts: 2,
      usefulDocuments: 2,
    });
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "enforcement_authority" }),
      expect.objectContaining({ predicate: "penalty" }),
    ]));
    expect(result.parsed!.collection.sources[0]!.role)
      .toMatch(/source-native related official document/iu);
  });

  it("reports an empty related-source route as unsupported so the plan can continue", async () => {
    const fetch = vi.fn(async () => new Response(html(
      "<p>A covered operator shall publish an annual report.</p>",
    ), {
      headers: { "content-type": "text/html" },
    }));

    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: workflow(),
      fetch,
      retrievedAt,
      focus: "related_sources",
      searchedRequirementKinds: ["enforcement", "penalty"],
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "unsupported_format",
      parsed: null,
      unresolved: ["enforcement", "penalty"],
      usage: {
        sourceQueries: 1,
        metadataRecords: 0,
        documentAttempts: 1,
        usefulDocuments: 1,
      },
    });
  });

  it("labels an excerpt fallback and does not claim missing sections were searched", async () => {
    const fetch = vi.fn(async () => new Response(
      "<!doctype html><html><body><main><h1>Unrelated Water Notice</h1>" +
        "<p>This page describes a different instrument without the confirmed identifier.</p>" +
        "</main></body></html>",
      { headers: { "content-type": "text/html" } },
    ));

    const result = await acquireScreen02OfficialDocumentPolicy({
      workflow: workflow(
        "A controller shall provide a consumer access to personal data.",
      ),
      fetch,
      retrievedAt,
      focus: "controlling_document",
      searchedRequirementKinds: allRequirements,
    });

    expect(result).toMatchObject({
      status: "partial",
      limitation: expect.stringMatching(/identity excerpt/iu),
      usage: { documentAttempts: 1, usefulDocuments: 1 },
    });
    expect(result.parsed!.collection.sources[0]).toMatchObject({
      acquisitionProvenance: "third_party",
      inspectedText: "partial",
      accessStatus: "retained_passage",
    });
    expect(result.parsed!.collection.requirements.find(({ kind }) =>
      kind === "operative_change")!.status).toBe("supported");
    expect(result.parsed!.collection.requirements.find(({ kind }) =>
      kind === "penalty")!.status).toBe("source_unavailable");
  });
});
