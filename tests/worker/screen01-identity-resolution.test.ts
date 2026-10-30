import { describe, expect, it, vi } from "vitest";

import { createSixScreenWorkflow } from
  "../../src/core/six-screen/workflow";
import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import { resolveScreen01FederalRegisterIdentity } from
  "../../src/worker/screen01-identity-resolution";
import { acquireScreen02ComplementaryPolicyEvidence } from
  "../../src/worker/screen02-complementary-evidence-acquisition";
import { preferredScreen02OfficialDocumentSource } from
  "../../src/worker/screen02-official-document-acquisition";

const now = "2026-09-12T10:00:00.000Z";

function workflow(overrides: Record<string, unknown> = {}) {
  return createSixScreenWorkflow({
    runId: "run-identity",
    studyId: "study-identity",
    study: {
      population: "Hospitals",
      analysisUnit: "Hospital",
      geography: ["United States"],
      industry: ["Health care"],
      period: { start: "2018", end: "2025" },
      outcome: "Operating margin",
      intendedConstruct: "Organizational resilience",
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: "Hospital Transparency Rule",
    requestedJurisdiction: "United States",
    approximateYear: "2019",
    intendedEpisode: "final rule",
    createdAt: now,
    ...overrides,
  });
}

function federalRecord(overrides: Record<string, unknown> = {}) {
  return {
    document_number: "2019-24931",
    title: "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS",
    type: "Rule",
    abstract: "This final rule includes requirements for hospitals to make public a list of standard charges.",
    action: "Final rule.",
    excerpts: ["Hospitals must make public their standard charges."],
    html_url:
      "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example",
    pdf_url:
      "https://www.govinfo.gov/content/pkg/FR-2019-11-27/pdf/2019-24931.pdf",
    raw_text_url:
      "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html",
    body_html_url:
      "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html",
    publication_date: "2019-11-27",
    effective_on: "2020-01-01",
    agencies: [{ name: "Centers for Medicare & Medicaid Services" }],
    ...overrides,
  };
}

function federalFetch(records: Array<Record<string, unknown>>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/v1/documents")) {
      return new Response(JSON.stringify({ count: records.length, results: records }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const documentNumber = records.find(({ document_number }) =>
      url.includes(String(document_number))
    )?.document_number ?? "2019-24931";
    return new Response(
      `<!doctype html><html><body><main><h1>Official policy text</h1><p>Hospitals must publish standard charges under this final rule.</p><p>[FR Doc. ${documentNumber} Filed 11-26-19; 8:45 am]</p></main></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  });
}

function ukAtomEntry(input: {
  title: string;
  year: string;
  number: string;
  type?: string;
}) {
  const type = input.type ?? "ukpga";
  const locator = `https://www.legislation.gov.uk/${type}/${input.year}/${input.number}`;
  return `<entry>
    <id>https://www.legislation.gov.uk/id/${type}/${input.year}/${input.number}</id>
    <title>${input.title}</title>
    <ukm:EnactmentDate Date="${input.year}-10-26" />
    <link rel="alternate" href="${locator}" />
  </entry>`;
}

function ukFetch(entries: string[], documents: Record<string, {
  status?: number;
  text: string;
}>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/data.feed")) {
      return new Response(
        `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">${entries.join("")}</feed>`,
        { status: 200, headers: { "content-type": "application/atom+xml" } },
      );
    }
    const document = Object.entries(documents).find(([path]) =>
      url.includes(path)
    )?.[1];
    return new Response(document?.text ?? "Unavailable", {
      status: document ? document.status ?? 200 : 404,
      headers: { "content-type": "application/xml" },
    });
  });
}

function euFetch(input: { title: string; celex: string; date: string }) {
  return vi.fn(async (request: RequestInfo | URL) => {
    const url = String(request);
    if (url.includes("publications.europa.eu")) {
      return new Response(JSON.stringify({
        results: {
          bindings: [{
            celex: { value: input.celex },
            title: { value: input.title },
            date: { value: input.date },
            type: { value: "http://publications.europa.eu/resource/authority/resource-type/DIR" },
          }],
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(
      `<html><body><main><h1>${input.title}</h1><p>This Directive establishes reporting requirements for covered undertakings and applies from 2024.</p></main></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  });
}

describe("Screen 1 reusable identity resolution", () => {
  it("matches an enacted or section UK URL to the same instrument without matching another Act", async () => {
    const fetch = ukFetch([ukAtomEntry({ title: "Finance Act 2017", year: "2017", number: "10" })], {
      "/ukpga/2017/10": { text: "<Legislation><Title>Finance Act 2017</Title><Body>This Act establishes the Soft Drinks Industry Levy for chargeable products and provides requirements for liable producers.</Body></Legislation>" },
    });
    for (const suffix of ["enacted", "section/25", "contents"]) {
      const result = await resolveScreen01FederalRegisterIdentity({ workflow: workflow({
        shockInput: "Finance Act 2017", requestedJurisdiction: "United Kingdom", approximateYear: "2017", intendedEpisode: null,
        officialSourceLocators: [`https://www.legislation.gov.uk/ukpga/2017/10/${suffix}`],
      }), fetch, retrievedAt: now });
      expect(result.status).toBe("resolved");
      expect(result.candidates[0]?.officialTitle).toBe("Finance Act 2017");
    }
    const wrong = await resolveScreen01FederalRegisterIdentity({ workflow: workflow({
      shockInput: "Finance Act 2017", requestedJurisdiction: "United Kingdom", approximateYear: "2017", intendedEpisode: null,
      officialSourceLocators: ["https://www.legislation.gov.uk/ukpga/2017/32/enacted"],
    }), fetch, retrievedAt: now });
    expect(wrong.candidates).toHaveLength(0);
  });
  it("returns at most three source-bound identity candidates without causal ranking", async () => {
    const fetch = federalFetch([
        federalRecord(),
        federalRecord({
          document_number: "2019-25000",
          title: "Hospital Transparency Proposed Rule",
          type: "Proposed Rule",
          publication_date: "2019-12-01",
          effective_on: null,
        }),
        federalRecord({
          document_number: "2020-00001",
          title: "Hospital Transparency Notice",
          type: "Notice",
          publication_date: "2020-01-02",
          effective_on: null,
        }),
      ]);
    let monotonic = 100;
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow(),
      fetch,
      retrievedAt: now,
      monotonicNow: () => (monotonic += 5),
    });

    expect(result.status).toBe("resolved");
    expect(result.candidates).toHaveLength(2);
    expect(result.outcomeValuesInspected).toBe(false);
    expect(result.usage).toMatchObject({
      sourceQueries: 2,
      documentAttempts: 2,
      usefulDocuments: 2,
      transportHops: 2,
      providerCostUnits: {},
    });
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS",
      issuer: "Centers for Medicare & Medicaid Services",
      issuingJurisdiction: "United States",
      formalIdentifiers: ["2019-24931"],
      episode: "adoption or final rule",
      identitySourceIds: expect.arrayContaining([
        expect.stringContaining("fr-2019-24931"),
      ]),
      identitySources: expect.arrayContaining([
        expect.objectContaining({
          locator: expect.stringContaining("federalregister.gov/documents/full_text"),
          authorityTier: "tier-1",
        }),
      ]),
      materialMismatches: [],
    });
    expect(result.candidates[0]!.typedDates).toEqual([
      expect.objectContaining({ kind: "publication", start: "2019-11-27" }),
      expect.objectContaining({ kind: "legal_effect", start: "2020-01-01" }),
    ]);
    const requested = new URL(String(fetch.mock.calls[0]![0]));
    expect(requested.searchParams.get("conditions[term]")).toBe(
      "Hospital Transparency Rule",
    );
    expect(requested.searchParams.get("per_page")).toBe("10");
  });

  it("uses an exact supplied Federal Register identifier before a title search", async () => {
    const fetch = federalFetch([federalRecord()]);
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        officialSourceLocators: [
          "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example",
        ],
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    const requested = new URL(String(fetch.mock.calls[0]![0]));
    expect(requested.searchParams.get("conditions[term]")).toBe("2019-24931");
  });

  it("reports an unsupported jurisdiction without substituting a U.S. rule", async () => {
    const fetch = vi.fn();
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({ requestedJurisdiction: "Canada" }),
      fetch,
      retrievedAt: now,
    });
    expect(result).toMatchObject({
      status: "unsupported_for_request",
      candidates: [],
      attemptedSources: ["Reviewed official-document registry and public index"],
      usage: { sourceQueries: 1 },
    });
    expect(result.limitation).toMatch(/No policy from a different jurisdiction was substituted/u);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("distinguishes a source outage from a completed search with no result", async () => {
    const outage = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow(),
      fetch: async () => new Response("unavailable", { status: 503 }),
      retrievedAt: now,
    });
    expect(outage.status).toBe("source_unavailable");
    expect(outage.limitation).toMatch(/not an empty search result/u);

    const empty = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow(),
      fetch: async () => new Response(JSON.stringify({ count: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      retrievedAt: now,
    });
    expect(empty.status).toBe("not_resolved");
    expect(empty.limitation).toMatch(/No similar policy was substituted/u);
  });

  it("runs a result-capped name search when the approximate year is omitted", async () => {
    const fetch = federalFetch([federalRecord()]);
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({ approximateYear: null }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    const request = new URL(String(fetch.mock.calls[0]![0]));
    expect(request.searchParams.get("conditions[publication_date][gte]")).toBe(
      "1994-01-01",
    );
    expect(request.searchParams.get("conditions[publication_date][lte]")).toBe(
      "2026-09-12",
    );
    expect(request.searchParams.get("per_page")).toBe("10");
  });

  it("ranks a foundational name-only final rule ahead of later updates within the fixed document budget", async () => {
    const laterUpdates = Array.from({ length: 8 }, (_value, index) =>
      federalRecord({
        document_number: `202${index}-1000${index}`,
        title:
          `Medicare Program: Hospital Price Transparency Update ${index + 1}`,
        abstract:
          "This final rule revises, updates, and refines existing Hospital Price Transparency requirements.",
        action: "Final rule with comment period.",
        publication_date: `202${index}-11-16`,
        effective_on: `202${index + 1}-01-01`,
      })
    );
    const foundational = federalRecord({
      title:
        "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS Policy Changes and Payment Rates and Ambulatory Surgical Center Payment System Policy Changes and Payment Rates. Price Transparency Requirements for Hospitals To Make Standard Charges Public",
      abstract:
        "This final rule establishes requirements for hospitals operating in the United States to make public a list of their standard charges and promote price transparency.",
      action: "Final rule.",
    });
    const fetch = federalFetch([...laterUpdates, foundational]);
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Hospital Price Transparency Final Rule",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]).toMatchObject({
      officialTitle: foundational.title,
      formalIdentifiers: ["2019-24931"],
    });
    expect(result.candidates[0]!.identitySources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        routeId: "exact_federal_register_document",
        nativeId: "2019-24931",
      }),
      expect.objectContaining({
        routeId: "federal_register_api_excerpt",
        nativeId: "2019-24931",
        accessStatus: "retained_passage",
        inspectedText: "abstract",
        retainedText: expect.stringContaining(
          "establishes requirements for hospitals",
        ),
      }),
    ]));
    expect(String(fetch.mock.calls[1]![0])).toContain("2019-24931");
    expect(result.usage.documentAttempts).toBeLessThanOrEqual(8);
    expect(result.usage.usefulDocuments).toBeLessThanOrEqual(2);

    const candidate = result.candidates[0]!;
    const continued = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: {
        candidates: [candidate],
        confirmedShock: {
          id: "confirmed-hospital-price-transparency",
          officialTitle: candidate.officialTitle,
          aliases: candidate.aliases,
          formalIdentifiers: candidate.formalIdentifiers,
          issuer: candidate.issuer,
          issuingJurisdiction: candidate.issuingJurisdiction,
          confirmation: { candidateId: candidate.id },
        },
      } as unknown as SixScreenWorkflowState,
      fetch: vi.fn(async (request: RequestInfo | URL) =>
        String(request).startsWith("https://api.gdeltproject.org/")
          ? new Response(JSON.stringify({ articles: [] }), {
              headers: { "content-type": "application/json" },
            })
          : new Response("Screen 2 source unavailable", { status: 503 })),
      retrievedAt: now,
      documentNumber: "2019-24931",
    });
    expect(continued.status).toBe("partial");
    expect(continued.parsed?.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        statement: expect.stringContaining(
          "establishes requirements for hospitals",
        ),
        citation: expect.objectContaining({
          provider: "Federal Register API",
          canonicalUrl:
            "https://www.federalregister.gov/api/v1/documents/2019-24931.json",
        }),
      }),
    ]));
  });

  it("retains bounded official API evidence when exact Federal Register representations are unavailable", async () => {
    const foundational = federalRecord({
      title:
        "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS Policy Changes and Payment Rates and Ambulatory Surgical Center Payment System Policy Changes and Payment Rates. Price Transparency Requirements for Hospitals To Make Standard Charges Public",
      abstract:
        "This final rule establishes requirements for hospitals operating in the United States to make public a list of their standard charges and promote price transparency.",
      excerpts:
        "This final rule requires hospitals to make public their standard charges and explains the adopted price-transparency requirements.",
      action: "Final rule.",
    });
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/v1/documents")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [foundational],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Representation unavailable", { status: 503 });
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Hospital Price Transparency Final Rule",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      officialTitle: foundational.title,
      formalIdentifiers: ["2019-24931"],
    });
    expect(result.candidates[0]!.identitySources[0]).toMatchObject({
      routeId: "federal_register_api_excerpt",
      accessStatus: "retained_passage",
      inspectedText: "abstract",
      locator:
        "https://www.federalregister.gov/api/v1/documents/2019-24931.json",
      retainedText: expect.stringContaining(
        "establishes requirements for hospitals",
      ),
    });
    expect(preferredScreen02OfficialDocumentSource(result.candidates[0]!))
      .toMatchObject({ routeId: "federal_register_api_excerpt" });
    expect(result.usage).toMatchObject({
      metadataRecords: 1,
      documentAttempts: 2,
      usefulDocuments: 1,
    });
  });

  it("does not promote query-highlight metadata without a substantive official abstract", async () => {
    const metadataOnly = federalRecord({
      abstract: null,
      action: null,
      excerpts:
        "Highlighted query terms alone are not stable exact-record evidence.",
      effective_on: null,
      agencies: [{ name: "CMS" }],
    });
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/v1/documents")
        ? new Response(JSON.stringify({ count: 1, results: [metadataOnly] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response("Representation unavailable", { status: 503 })
    );
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result).toMatchObject({
      status: "not_resolved",
      candidates: [],
      usage: { documentAttempts: 2, usefulDocuments: 0 },
    });
  });

  it("retries one transient Federal Register metadata timeout within the shared query budget", async () => {
    let metadataCalls = 0;
    const stable = federalFetch([federalRecord()]);
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/v1/documents") && metadataCalls++ === 0) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return stable(input);
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow(),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(metadataCalls).toBe(2);
    expect(result.usage).toMatchObject({
      sourceQueries: 3,
      usefulDocuments: 1,
    });
    expect(result.usage.sourceQueries).toBeLessThanOrEqual(8);
  });

  it.each([
    "California Consumer Privacy Act",
    "CCPA",
    "Californa Consumer Privacy Act",
  ])("identifies CCPA from the name %s without a URL or exact year", async (name) => {
    const fetch = vi.fn();
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: name,
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: "Not sure yet",
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "California Consumer Privacy Act",
      issuingJurisdiction: "California, United States",
      instrumentType: "state legislation",
    });
    expect(result.candidates[0]!.identitySources[0]).toMatchObject({
      routeId: "reviewed_official_document",
      accessStatus: "retained_passage",
    });
    expect(result.candidates[0]!.typedDates).toEqual(expect.arrayContaining([
      expect.objectContaining({ start: "2018-06-28", kind: "adoption" }),
      expect.objectContaining({ start: "2020-01-01", kind: "legal_effect" }),
      expect.objectContaining({ start: "2020-07-01", kind: "enforcement" }),
      expect.objectContaining({
        start: "2023-01-01",
        kind: "amendment",
        label: "CPRA amendments became operative",
      }),
    ]));
    expect(result.usage).toMatchObject({
      sourceQueries: 1,
      usefulDocuments: expect.any(Number),
    });
    expect(result.usage.usefulDocuments).toBeLessThanOrEqual(4);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the supplied CCPA OAG page and preserves usable Screen 2 text", async () => {
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "California Consumer Privacy Act",
        requestedJurisdiction: "California",
        approximateYear: "2018",
        intendedEpisode: "Implementation",
        officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]!.identitySources[0]).toMatchObject({
      locator: "https://oag.ca.gov/privacy/ccpa",
      inspectedText: "partial",
    });
    expect(result.candidates[0]!.identitySources[0]!.retainedText).toMatch(
      /consumer privacy act/iu,
    );
    expect(result.candidates[0]!.materialMismatches).toEqual([]);
  });

  it("classifies a retained Federal Register final rule as a federal administrative rule", async () => {
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "FERC Order 841",
        requestedJurisdiction: "United States",
        approximateYear: "2018",
        intendedEpisode: "Adoption or final rule",
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]).toMatchObject({
      officialTitle:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      issuingJurisdiction: "United States",
      instrumentType: "federal administrative rule",
      formalIdentifiers: ["Order No. 841", "83 FR 9580", "2018-03708"],
    });
    expect(result.candidates[0]!.aliases).toContain(
      "FERC Order 841 Electric Storage Participation Rule",
    );
  });

  it("keeps an exact reviewed alias ahead of loose Federal Register results", async () => {
    const fetch = federalFetch([
      federalRecord({
        document_number: "2018-25584",
        title: "Non-Discriminatory Open Access Transmission Tariff; Corrections",
        type: "Rule",
        abstract: "This document corrects a federal transmission tariff rule.",
        publication_date: "2018-11-26",
      }),
      federalRecord({
        document_number: "2019-08241",
        title: "Interstate and Intrastate Natural Gas Pipelines; Rate Changes Relating to Federal Income Tax Rate",
        type: "Rule",
        abstract: "This document concerns pipeline rate changes.",
        publication_date: "2019-04-26",
      }),
      federalRecord({
        document_number: "2019-03402",
        title: "Reform of Generator Interconnection Procedures and Agreements",
        type: "Rule",
        abstract: "This document concerns generator interconnection procedures.",
        publication_date: "2019-03-06",
      }),
    ]);
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "FERC Order 841",
        requestedJurisdiction: "United States",
        approximateYear: "2018",
        intendedEpisode: "Adoption or final rule",
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.candidates[0]).toMatchObject({
      officialTitle:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      formalIdentifiers: ["Order No. 841", "83 FR 9580", "2018-03708"],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps later legal-status milestones distinct from a scheduled effective date", async () => {
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "FTC Non-Compete Clause Rule",
        requestedJurisdiction: "United States",
        approximateYear: "2024",
        intendedEpisode: "Final rule",
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]?.typedDates).toEqual(expect.arrayContaining([
      expect.objectContaining({ start: "2024-08-20", kind: "invalidation" }),
      expect.objectContaining({ start: "2024-09-04", kind: "scheduled_effect" }),
      expect.objectContaining({ start: "2026-02-12", kind: "repeal" }),
    ]));
  });

  it("resolves every coauthor-reported not-found policy from the reviewed index", async () => {
    const cases = [
      ["California SB 1383 — Expansion of Family and Medical Leave", "California"],
      ["California SB 826 — Women on Corporate Boards", "California"],
      ["Illinois Artificial Intelligence Video Interview Act", "Illinois"],
      ["NYC Fair Workweek Law", "New York City"],
      ["NYC Local Law 144 — Automated Employment Decision Tools", "New York City"],
      ["NYC Congestion Pricing Program (2025)", "New York"],
      ["Oregon Fair Work Week Act", "Oregon"],
      ["SEC Executive Compensation Clawback Rule (Rule 10D-1)", "United States"],
      ["State Salary History Bans", "United States"],
      ["SEC Climate-Related Disclosure Final Rule", "United States"],
      ["Washington My Health My Data Act", "Washington"],
    ] as const;
    for (const [shockInput, requestedJurisdiction] of cases) {
      const result = await resolveScreen01FederalRegisterIdentity({
        workflow: workflow({
          shockInput,
          requestedJurisdiction,
          approximateYear: null,
          intendedEpisode: null,
        }),
        fetch: vi.fn(async () => new Response("unavailable", { status: 503 })),
        retrievedAt: "2026-10-28T00:00:00.000Z",
      });
      expect(result.status, shockInput).toBe("resolved");
      expect(result.candidates[0]?.officialTitle, shockInput).toBe(shockInput);
    }
  });

  it("identifies an independently selected state law through the same contract", async () => {
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Colorado Privacy Act",
        requestedJurisdiction: "Colorado",
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Colorado Privacy Act",
      issuingJurisdiction: "Colorado, United States",
    });
    expect(result.candidates[0]!.formalIdentifiers).toContain("SB21-190");
  });

  it("resolves an uncataloged state bill through Open States", async () => {
    const fetch = vi.fn(async (_request: RequestInfo | URL,
      init?: RequestInit) => new Response(JSON.stringify({ results: [{
        id: "ocd-bill/123e4567-e89b-12d3-a456-426614174001",
        session: "2021-2022",
        jurisdiction: {
          id: "ocd-jurisdiction/country:us/state:ny/government",
          name: "New York",
          classification: "state",
        },
        from_organization: {
          id: "ocd-organization/new-york-senate",
          name: "New York State Senate",
          classification: "upper",
        },
        identifier: "S 9999",
        title: "Clean Energy Accountability Act",
        classification: ["bill"],
        openstates_url: "https://openstates.org/ny/bills/2021-2022/S9999/",
        first_action_date: "2021-02-01",
        latest_action_date: "2021-06-10",
        abstracts: [{
          abstract: "Requires specified energy reporting by covered entities.",
          note: "summary",
        }],
        actions: [{ id: "action-ny-1", description: "Introduced",
          date: "2021-02-01", classification: ["introduction"], order: 1 }],
        sources: [{
          url: "https://www.nysenate.gov/legislation/bills/2021/S9999",
          note: "Official bill page",
        }],
        versions: [],
        documents: [],
      }] }), {
        headers: { "content-type": "application/json" },
        status: new Headers(init?.headers).get("x-api-key") ===
            "openstates-integration-test-key" ? 200 : 401,
      }));
    const publicWebFetch = vi.fn(async () => new Response(
      "<title>Clean Energy Accountability Act</title>" +
      "<h1>Clean Energy Accountability Act</h1>",
      { headers: { "content-type": "text/html" } },
    ));
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "S 9999",
        officialIdentifier: "S 9999",
        requestedJurisdiction: "NY",
        approximateYear: "2021",
        intendedEpisode: null,
      }),
      fetch,
      publicWebFetch,
      openStatesApiKey: "openstates-integration-test-key",
      retrievedAt: now,
    });

    expect(result).toMatchObject({
      status: "resolved",
      attemptedSources: [
        "Reviewed official-document registry and public index",
        "Open States",
        "Open States linked official legislature page",
      ],
      candidates: [expect.objectContaining({
        officialTitle: "Clean Energy Accountability Act",
        issuingJurisdiction: "New York",
        formalIdentifiers: ["S 9999", "Session 2021-2022"],
        materialMismatches: [],
      })],
    });
    expect(result.candidates[0]?.identitySources).toEqual(
      expect.arrayContaining([expect.objectContaining({
        provider: "Official state legislature",
        routeId: "openstates_official_page_identity",
        accessStatus: "retained_passage",
      })]),
    );
    expect(publicWebFetch).toHaveBeenCalledTimes(1);
    const request = new URL(String(fetch.mock.calls[0]![0]));
    expect(request.origin).toBe("https://v3.openstates.org");
    expect(request.searchParams.get("jurisdiction")).toBe("New York");
    expect(request.searchParams.get("identifier")).toBe("S 9999");
    expect(request.searchParams.get("per_page")).toBe("10");
    expect(request.searchParams.has("session")).toBe(false);
  });

  it("cold-starts an uncataloged UK Act by name and retains official text for Screen 2", async () => {
    const fetch = ukFetch([
      ukAtomEntry({ title: "Procurement Act 2023", year: "2023", number: "54" }),
    ], {
      "/ukpga/2023/54": {
        text: `<Legislation><Title>Procurement Act 2023</Title><Preamble>An Act to make provision about procurement.</Preamble><Body>This Act establishes requirements for contracting authorities and applies to covered public contracts. The provisions come into force in accordance with commencement regulations.</Body></Legislation>`,
      },
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Procurement Act 2023",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      govInfoApiKey: "configured-govinfo-key",
      openStatesApiKey: "configured-openstates-key",
      retrievedAt: now,
    });
    expect(result).toMatchObject({
      status: "resolved",
      attemptedSources: [
        "Reviewed official-document registry and public index",
        "UK legislation.gov.uk",
      ],
      candidates: [expect.objectContaining({
        officialTitle: "Procurement Act 2023",
        issuingJurisdiction: "United Kingdom",
        instrumentType: "UK legislation",
        formalIdentifiers: ["ukpga/2023/54"],
      })],
      usage: {
        sourceQueries: 2,
        metadataRecords: 1,
        documentAttempts: 1,
        usefulDocuments: 1,
      },
    });
    expect(result.candidates[0]!.identitySources[0]).toMatchObject({
      routeId: "uk_legislation_document",
      accessStatus: "retained_passage",
      inspectedText: "partial",
    });
    expect(result.candidates[0]!.displayedDescription).toMatch(
      /contracting authorities/iu,
    );
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      "/all/2023/data.feed",
    );
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain(
      "/all/2020-2026/data.feed",
    );
    expect(String(fetch.mock.calls[1]?.[0])).toBe(
      "https://www.legislation.gov.uk/ukpga/2023/54/section/1/data.xml",
    );
  });

  it("routes a name-only U.S. Act-of-year title to GovInfo before state catalogs", async () => {
    const fetch = vi.fn(async (_request: RequestInfo | URL) =>
      new Response("Unavailable", { status: 503 }));
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Example Amendments Act of 2008",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      govInfoApiKey: "configured-govinfo-key",
      openStatesApiKey: "configured-openstates-key",
      retrievedAt: now,
    });

    expect(result.attemptedSources[1]).toBe("GovInfo public-law search");
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.govinfo.gov/search",
    );
  });

  it("checks the native UK route when a strong reviewed hit leaves stage or version open", async () => {
    const fetch = ukFetch([
      ukAtomEntry({
        title: "Insurance Act 2015",
        year: "2015",
        number: "4",
      }),
    ], {
      "/ukpga/2015/4": {
        text: "<Legislation><Title>Insurance Act 2015</Title><Body>The Insurance Act 2015 establishes reforms concerning disclosure, representations, warranties, fraudulent claims, and remedies in business insurance contracts.</Body></Legislation>",
      },
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Insurance Act 2015",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.attemptedSources).toContain("UK legislation.gov.uk");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Insurance Act 2015",
      issuingJurisdiction: "United Kingdom",
      formalIdentifiers: ["ukpga/2015/4"],
    });
  });

  it("cold-starts an uncataloged EU Directive by name through CELLAR and EUR-Lex", async () => {
    const fetch = euFetch({
      title: "Corporate Sustainability Reporting Directive",
      celex: "32022L2464",
      date: "2022-12-14",
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Corporate Sustainability Reporting Directive",
        requestedJurisdiction: null,
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Corporate Sustainability Reporting Directive",
      issuingJurisdiction: "European Union",
      instrumentType: "Directive",
      formalIdentifiers: ["32022L2464"],
      identitySources: [expect.objectContaining({
        routeId: "eu_legal_document",
        provider: "eu-cellar",
      })],
    });
    expect(result.attemptedSources).toContain(
      "EU Publications Office CELLAR",
    );
  });

  it("keeps identity results invariant when only outcome, industry, and proposed comparison change", async () => {
    const baseline = workflow({
      shockInput: "California Consumer Privacy Act",
      requestedJurisdiction: null,
      approximateYear: null,
      intendedEpisode: null,
    });
    const altered = structuredClone(baseline);
    altered.study.outcome = "A different outcome that must not affect identity";
    altered.study.industry = ["A different industry"];
    altered.study.proposedComparison = "A different proposed comparison";
    const [first, second] = await Promise.all([
      resolveScreen01FederalRegisterIdentity({
        workflow: baseline,
        fetch: vi.fn(),
        retrievedAt: now,
      }),
      resolveScreen01FederalRegisterIdentity({
        workflow: altered,
        fetch: vi.fn(),
        retrievedAt: now,
      }),
    ]);
    expect(first.outcomeValuesInspected).toBe(false);
    expect(second.outcomeValuesInspected).toBe(false);
    expect(second.candidates).toEqual(first.candidates);
    expect(second.attemptedSources).toEqual(first.attemptedSources);
  });

  it("preserves same-title UK instruments from different years and native identities", async () => {
    const fetch = ukFetch([
      ukAtomEntry({ title: "Public Safety Act", year: "2022", number: "10" }),
      ukAtomEntry({ title: "Public Safety Act", year: "2023", number: "11" }),
    ], {
      "/ukpga/2022/10": {
        text: "<Legislation><Title>Public Safety Act</Title><Body>The Public Safety Act 2022 establishes public safety duties for covered authorities.</Body></Legislation>",
      },
      "/ukpga/2023/11": {
        text: "<Legislation><Title>Public Safety Act</Title><Body>The Public Safety Act 2023 establishes separate public safety duties for covered authorities.</Body></Legislation>",
      },
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Public Safety Act",
        requestedJurisdiction: "United Kingdom",
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map(({ formalIdentifiers }) => formalIdentifiers))
      .toEqual(expect.arrayContaining([
        ["ukpga/2022/10"],
        ["ukpga/2023/11"],
      ]));
    expect(new Set(result.candidates.map(({ identitySourceIds }) =>
      identitySourceIds[0]
    )).size).toBe(2);
  });

  it("rejects a UK content redirect that leaves the exact instrument identity", async () => {
    const attempted: string[] = [];
    const fetch = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      attempted.push(url);
      expect(init?.redirect).toBe("manual");
      if (url.includes("/data.feed")) {
        return new Response(
          `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">${
            ukAtomEntry({
              title: "Procurement Act 2023",
              year: "2023",
              number: "54",
            })
          }</feed>`,
          { status: 200, headers: { "content-type": "application/atom+xml" } },
        );
      }
      if (url.endsWith("/data.xml")) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://www.legislation.gov.uk/ukpga/2023/50/data.xml",
          },
        });
      }
      return new Response("Unavailable", {
        status: 503,
        headers: { "content-type": "text/plain" },
      });
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Procurement Act 2023",
        requestedJurisdiction: "United Kingdom",
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result).toMatchObject({
      status: "source_unavailable",
      candidates: [],
    });
    expect(result.limitation).toMatch(/same approved instrument identity/iu);
    expect(attempted).not.toContain(
      "https://www.legislation.gov.uk/ukpga/2023/50/data.xml",
    );
  });

  it("examines later provider leads when the first three have no usable text", async () => {
    const entries = [
      ukAtomEntry({ title: "Public Contract Rules 2020", year: "2020", number: "1", type: "uksi" }),
      ukAtomEntry({ title: "Public Contract Rules 2021", year: "2021", number: "2", type: "uksi" }),
      ukAtomEntry({ title: "Public Contract Rules 2022", year: "2022", number: "3", type: "uksi" }),
      ukAtomEntry({ title: "Public Contract Rules 2023", year: "2023", number: "4", type: "uksi" }),
    ];
    const fetch = ukFetch(entries, {
      "/uksi/2020/1": { status: 503, text: "Unavailable" },
      "/uksi/2021/2": { status: 503, text: "Unavailable" },
      "/uksi/2022/3": { status: 503, text: "Unavailable" },
      "/uksi/2023/4": {
        text: "<Legislation><Title>Public Contract Rules 2023</Title><Body>These Regulations amend public contract requirements and apply to contracting authorities from 2023.</Body></Legislation>",
      },
    });
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "Public Contract Rules",
        requestedJurisdiction: "United Kingdom",
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch,
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]!.officialTitle).toBe(
      "Public Contract Rules 2023",
    );
    expect(result.usage).toMatchObject({
      metadataRecords: 4,
      documentAttempts: 7,
      usefulDocuments: 1,
    });
  });

  it("rejects a conflicting official locator but treats an unavailable helper webpage as optional", async () => {
    const conflicting = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "California Consumer Privacy Act",
        requestedJurisdiction: null,
        officialSourceLocators: ["https://leg.colorado.gov/bills/sb21-190"],
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(conflicting.status).toBe("not_resolved");
    expect(conflicting.limitation).toMatch(/while the entered name/iu);

    const unsupported = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "California Consumer Privacy Act",
        requestedJurisdiction: null,
        officialSourceLocators: ["https://example.gov/unavailable-target"],
      }),
      fetch: vi.fn(),
      retrievedAt: now,
    });
    expect(unsupported.status).toBe("resolved");
    expect(unsupported.candidates[0]?.officialTitle).toBe(
      "California Consumer Privacy Act",
    );
    expect(unsupported.limitation).toMatch(/optional webpage/iu);
    expect(unsupported.usage.sourceQueries).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["Dodd frank act", "Dodd-Frank Wall Street Reform and Consumer Protection Act"],
    ["Tax cuts and jobs act", "Tax Cuts and Jobs Act of 2017"],
    ["Family and Medical Leave Act (FMLA) of 1993", "Family and Medical Leave Act of 1993"],
    ["National Minimum Drinking Age Act of 1984", "National Minimum Drinking Age Act of 1984"],
    ["Social Security Amendments of 1965 — Medicare", "Social Security Amendments of 1965 — Medicare"],
    ["California Silenced No More Act", "California Silenced No More Act"],
    ["State-Level Pay Transparency Laws (2021–2025)", "State-Level Pay Transparency Laws (2021–2025)"],
    ["State-Level Paid Sick Leave Mandates (2021–2025)", "State-Level Paid Sick Leave Mandates (2021–2025)"],
    ["New York State Paid Family Leave Law (2016)", "New York State Paid Family Leave Law"],
    ["Colorado Equal Pay for Equal Work Act", "Colorado Equal Pay for Equal Work Act"],
    ["Washington Paid Family and Medical Leave Act", "Washington Paid Family and Medical Leave Act"],
  ])("resolves the expanded U.S. policy catalog entry %s", async (
    shockInput,
    expectedTitle,
  ) => {
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput,
        requestedJurisdiction: "United States",
        approximateYear: null,
        intendedEpisode: null,
      }),
      fetch: vi.fn(async () => new Response("Unavailable", { status: 503 })),
      govInfoApiKey: "configured-govinfo-key",
      openStatesApiKey: "configured-openstates-key",
      retrievedAt: now,
    });
    expect(result.status).toBe("resolved");
    expect(result.candidates[0]?.officialTitle).toBe(expectedTitle);
    expect(result.candidates[0]?.identitySources).not.toHaveLength(0);
    expect(result.attemptedSources).toEqual([
      "Reviewed official-document registry and public index",
    ]);
  });

  it("ranks an exact multi-state family name ahead of loose live transparency matches", async () => {
    const fetch = federalFetch([
      federalRecord({
        document_number: "2023-24293",
        title: "Hospital Price Transparency Final Rule",
        publication_date: "2023-11-22",
        effective_on: "2024-01-01",
      }),
      federalRecord({
        document_number: "2023-20385",
        title: "Financial Value Transparency and Gainful Employment",
        publication_date: "2023-10-10",
        effective_on: "2024-07-01",
      }),
    ]);
    const result = await resolveScreen01FederalRegisterIdentity({
      workflow: workflow({
        shockInput: "State-Level Pay Transparency Laws (2021–2025)",
        requestedJurisdiction: "United States states",
        approximateYear: "2021-2025",
        intendedEpisode: "Implementation",
      }),
      fetch,
      retrievedAt: now,
    });

    expect(result.status).toBe("resolved");
    expect(result.candidates[0]?.officialTitle).toBe(
      "State-Level Pay Transparency Laws (2021–2025)",
    );
  });
});
