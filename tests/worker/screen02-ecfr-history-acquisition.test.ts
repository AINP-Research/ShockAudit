import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  applyIdentityResolution,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  openScreen2,
} from "../../src/core/six-screen/workflow";
import {
  acquireScreen02EcfrHistoricalPolicy,
  SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES,
} from "../../src/worker/screen02-ecfr-history-acquisition";

const bodyHtml =
  "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
const baselineUrl =
  "https://www.ecfr.gov/api/versioner/v1/full/2018-06-03/title-18.xml?part=35";
const effectiveUrl =
  "https://www.ecfr.gov/api/versioner/v1/full/2018-06-04/title-18.xml?part=35";
const versionMetadataUrl =
  "https://www.ecfr.gov/api/versioner/v1/versions/title-18.json?part=35&issue_date%5Bgte%5D=2018-06-03&issue_date%5Blte%5D=2018-06-11";
const annualSearchUrl = "https://api.govinfo.gov/search";
const annualPackageId = "CFR-2018-title18-vol1";
const annualGranuleId = `${annualPackageId}-sec35-28`;
const annualXmlUrl =
  `https://api.govinfo.gov/packages/${annualPackageId}/granules/${annualGranuleId}/xml`;

function confirmedWorkflow() {
  let state = createSixScreenWorkflow({
    runId: "ecfr-history-run",
    studyId: "ecfr-history-study",
    study: {
      population: "RTOs and ISOs",
      analysisUnit: "Market operator",
      geography: ["United States"],
      industry: ["Electric power"],
      period: { start: "2017", end: "2021" },
      outcome: "Storage participation",
      intendedConstruct: "Market access",
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: "FERC Order 841 (2018-03708)",
    requestedJurisdiction: "United States",
    approximateYear: "2018",
    intendedEpisode: "final rule",
    createdAt: "2026-09-12T10:00:00.000Z",
  });
  const started = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "request-order-841-history",
    requestedAt: "2026-09-12T10:00:01.000Z",
  });
  const identitySources = [{
    id: "source-order-841",
    title: "Order 841",
    locator: bodyHtml,
    publisher: "Federal Register",
    publishedDate: "2018-03-06",
    authorityTier: "tier-2",
    retrievedAt: "2026-09-12T10:00:02.000Z",
  }];
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: "identity-order-841",
      officialTitle:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      aliases: ["Order 841"],
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      instrumentType: "Rule",
      formalIdentifiers: ["2018-03708"],
      episode: "final rule",
      versionScope: "published final rule",
      typedDates: [
        {
          start: "2018-03-06",
          end: null,
          precision: "day",
          kind: "publication",
          passageIds: [],
        },
        {
          start: "2018-06-04",
          end: null,
          precision: "day",
          kind: "legal_effect",
          passageIds: [],
        },
      ],
      identitySourceIds: ["source-order-841"],
      sourceSnapshotId: "identity-source-order-841",
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription: "The official metadata identifies Order 841.",
      matchExplanation: "The exact document number matches.",
      materialMismatches: [],
      retrievedAt: "2026-09-12T10:00:02.000Z",
    }],
    appliedAt: "2026-09-12T10:00:02.000Z",
  });
  const candidate = state.candidates[0]!;
  state = confirmDisplayedShock(state, {
    expectedRevision: 2,
    candidateId: candidate.id,
    displayedIdentityFingerprint: candidate.identityFingerprint,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    identityRevision: state.identityRevision,
    interactionId: "interaction-order-841-history",
    decisionId: "decision-order-841-history",
    actor: "researcher_ui",
    confirmedAt: "2026-09-12T10:00:03.000Z",
  });
  return openScreen2(state, {
    expectedRevision: 3,
    openedAt: "2026-09-12T10:00:04.000Z",
  }).state;
}

function federalRegisterBody() {
  return `<!doctype html><html><body><main>
    <p>18 CFR Part 35</p>
    <p>This final rule requires a participation model for electric storage resources.</p>
    <p>In consideration of the foregoing, the Commission amends Part 35, Chapter I, Title 18, Code of Federal Regulations, as follows:</p>
    <p>2. Amend \u00a7 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:</p>
    <p>[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]</p>
  </main></body></html>`;
}

function partXml(paragraphs: string[], title = "18", part = "35") {
  return `<?xml version="1.0"?>
    <DIV5 N="${part}" TYPE="PART" hierarchy_metadata="{&amp;quot;path&amp;quot;:&amp;quot;/on/_SUBSTITUTE_DATE_/title-${title}/part-${part}&amp;quot;,&amp;quot;citation&amp;quot;:&amp;quot;${title} CFR Part ${part}&amp;quot;}">
      <DIV8 N="35.28" TYPE="SECTION">
        ${paragraphs.map((value) => `<P>${value}</P>`).join("\n")}
      </DIV8>
    </DIV5>`;
}

const boundary =
  "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.";
const addition =
  "(9) Electric storage resources. Each Commission-approved independent system operator and regional transmission organization must have tariff provisions providing a participation model for electric storage resources.";

function annualSearchResult() {
  return JSON.stringify({
    count: 1,
    offsetMark: "opaque-next-page",
    results: [{
      packageId: annualPackageId,
      granuleId: annualGranuleId,
      collectionCode: "CFR",
      dateIssued: "2018-04-01",
      resultLink:
        `https://api.govinfo.gov/packages/${annualPackageId}/granules/${annualGranuleId}/summary`,
      download: { xmlLink: annualXmlUrl },
    }],
  });
}

function annualCfrXml(paragraph = boundary) {
  return `<?xml version="1.0"?>
    <CFRGRANULE>
      <CFRTITLE>18</CFRTITLE>
      <DATE>2018-04-01</DATE>
      <GRANULENUM>§ 35.28</GRANULENUM>
      <ANCESTORS><ANCESTOR LEVEL="part" IDENTIFIER="35">Part 35</ANCESTOR></ANCESTORS>
      <SECTION><SECTNO>§ 35.28</SECTNO><P>${paragraph}</P></SECTION>
    </CFRGRANULE>`;
}

function versionRecord(overrides: Record<string, unknown> = {}) {
  return {
    date: "2018-06-04",
    amendment_date: "2018-06-04",
    issue_date: "2018-06-04",
    identifier: "35.28",
    name: "§ 35.28 Non-discriminatory open access transmission tariff.",
    part: "35",
    substantive: true,
    removed: false,
    subpart: null,
    title: "18",
    type: "section",
    ...overrides,
  };
}

function versionMetadata(records = [versionRecord()]) {
  return JSON.stringify({
    content_versions: records,
    meta: {
      title: "18",
      result_count: String(records.length),
      issue_date: { gte: "2018-06-03", lte: "2018-06-11" },
      latest_amendment_date: records.at(-1)?.amendment_date ?? null,
      latest_issue_date: records.at(-1)?.issue_date ?? null,
    },
  });
}

describe("controlled eCFR historical acquisition", () => {
  it("binds exact CFR coordinates and retains two different point-in-time versions", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === bodyHtml) {
        return new Response(federalRegisterBody(), {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === versionMetadataUrl) {
        return new Response(versionMetadata(), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === baselineUrl) {
        return new Response(partXml([boundary]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === effectiveUrl) {
        return new Response(partXml([boundary, addition]), {
          headers: { "content-type": "application/xml" },
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      documentNumber: "2018-03708",
      attemptedSources: [
        bodyHtml,
        versionMetadataUrl,
        baselineUrl,
        effectiveUrl,
      ],
      usage: {
        metadataRecords: 1,
        documentAttempts: 4,
        usefulDocuments: 4,
        transportHops: 4,
      },
    });
    expect(result.parsed?.projections.map(({ predicate }) => predicate)).toEqual([
      "previous_baseline",
      "historical_version_change",
    ]);
    expect(fetch.mock.calls.map(([request]) => String(request))).not.toContain(
      "https://www.ecfr.gov/current/title-18/part-35",
    );
  });

  it("retains a later eCFR issue date without changing the legal snapshot date", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === bodyHtml) {
        return new Response(federalRegisterBody(), {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === versionMetadataUrl) {
        return new Response(versionMetadata([versionRecord({
          issue_date: "2018-06-06",
        })]), { headers: { "content-type": "application/json" } });
      }
      if (url === baselineUrl) {
        return new Response(partXml([boundary]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === effectiveUrl) {
        return new Response(partXml([boundary, addition]), {
          headers: { "content-type": "application/xml" },
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      limitation: expect.stringContaining(
        "binds the 2018-06-04 substantive amendment to eCFR issue date 2018-06-06",
      ),
      attemptedSources: [
        bodyHtml,
        versionMetadataUrl,
        baselineUrl,
        effectiveUrl,
      ],
      parsed: {
        collection: {
          sources: expect.arrayContaining([expect.objectContaining({
            canonicalUrl: versionMetadataUrl,
            accessStatus: "available_metadata",
            inspectedText: "metadata_only",
          })]),
        },
        projections: expect.arrayContaining([expect.objectContaining({
          predicate: "historical_version_change",
          typedValue: expect.objectContaining({
            effectiveAsOf: "2018-06-04",
            effectiveSnapshotAsOf: "2018-06-04",
            contentVersionIdentifiers: ["35.28"],
            contentVersionIssueDates: ["2018-06-06"],
          }),
        })]),
      },
    });
    expect(fetch.mock.calls.map(([request]) => String(request))).not.toContain(
      "https://www.ecfr.gov/current/title-18/part-35",
    );
  });

  it("retains the contemporaneous instruction when the exact version window is empty", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response(versionMetadata([]), {
            headers: { "content-type": "application/json" },
          }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      attemptedSources: [bodyHtml, versionMetadataUrl],
      unresolved: ["previous_baseline", "version"],
      parsed: {
        collection: {
          claims: [expect.objectContaining({
            predicate: "contemporaneous_amendment_record",
          })],
        },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects version metadata outside the exact CFR coordinate", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response(versionMetadata([versionRecord({ part: "36" })]), {
            headers: { "content-type": "application/json" },
          }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      attemptedSources: [bodyHtml, versionMetadataUrl],
      parsed: null,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects a metadata section not named by the contemporaneous amendment", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response(versionMetadata([versionRecord({
            identifier: "35.29",
            name: "§ 35.29 Other market rules.",
          })]), { headers: { "content-type": "application/json" } }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      attemptedSources: [bodyHtml, versionMetadataUrl],
      parsed: null,
    });
    expect(result.limitation).toContain(
      "different section than the exact contemporaneous amendatory instruction",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("saves a part-level amendment but does not query versions without a section", async () => {
    const fetch = vi.fn(async () => new Response(
      federalRegisterBody().replace(
        "Amend § 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9)",
        "Revise Part 35",
      ),
      { headers: { "content-type": "text/html" } },
    ));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      attemptedSources: [bodyHtml],
      parsed: {
        collection: {
          claims: [expect.objectContaining({
            predicate: "contemporaneous_amendment_record",
          })],
        },
      },
    });
    expect(result.limitation).toContain(
      "did not expose a section identifier",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops before XML when declared version metadata exceeds the byte ceiling", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response(versionMetadata(), {
            headers: {
              "content-type": "application/json",
              "content-length": String(
                SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES + 1,
              ),
            },
          }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "waiting_source",
      failureCode: "response_limit",
      attemptedSources: [bodyHtml, versionMetadataUrl],
      parsed: null,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects version metadata whose deprecated date differs from amendment_date", async () => {
    const records = [versionRecord({
      date: "2018-06-06",
      issue_date: "2018-06-06",
    })];
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response(versionMetadata(records), {
            headers: { "content-type": "application/json" },
          }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "unparsed",
      attemptedSources: [bodyHtml, versionMetadataUrl],
      parsed: null,
    });
    expect(result.limitation).toContain(
      "violated the documented date-to-amendment-date identity",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("persists an exact contemporaneous amendment and a typed gap when history is unavailable", async () => {
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch: async (request) => String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response("not found", { status: 404 }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      attemptedSources: [bodyHtml, versionMetadataUrl],
      unresolved: ["previous_baseline", "version"],
      parsed: {
        collection: {
          claims: [expect.objectContaining({
            predicate: "contemporaneous_amendment_record",
          })],
          requirements: expect.arrayContaining([
            expect.objectContaining({
              kind: "previous_baseline",
              status: "inaccessible",
            }),
            expect.objectContaining({ kind: "version", status: "inaccessible" }),
          ]),
        },
      },
    });
    expect(result.limitation).toContain(
      "exact contemporaneous Federal Register amendatory instruction was saved",
    );
    expect(result.limitation).toContain("no current CFR text was substituted");
  });

  it("does not convert a transient eCFR failure into a completed fallback step", async () => {
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch: async (request) => String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : new Response("temporary outage", { status: 503 }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "waiting_source",
      failureCode: "source_unavailable",
      parsed: null,
      unresolved: ["previous_baseline", "version"],
    });
  });

  it("does not fetch when the confirmed episode lacks one day-precision legal-effective date", async () => {
    const workflow = confirmedWorkflow();
    workflow.confirmedShock!.typedDates = workflow.confirmedShock!.typedDates
      .filter(({ kind }) => kind !== "legal_effect");
    const fetch = vi.fn(async () => {
      throw new Error("The route must not fetch without an exact date.");
    });
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow,
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "historical_date_unavailable",
      documentNumber: "2018-03708",
      attemptedSources: [],
      parsed: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains a shared amendatory instruction when the rule names multiple CFR parts", async () => {
    const multiPartBody = federalRegisterBody()
      .replace("18 CFR Part 35", "18 CFR Parts 35 and 385")
      .replace(
        "the Commission amends Part 35, Chapter I, Title 18, Code of Federal Regulations",
        "the Commission amends 18 CFR Parts 35 and 385",
      );
    const fetch = vi.fn(async () => new Response(multiPartBody, {
      headers: { "content-type": "text/html" },
    }));
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      attemptedSources: [bodyHtml],
      parsed: {
        collection: {
          claims: expect.arrayContaining([expect.objectContaining({
            predicate: "contemporaneous_amendment_record",
            typedValue: expect.objectContaining({
              cfrCoordinates: [
                { title: "18", part: "35" },
                { title: "18", part: "385" },
              ],
            }),
          })]),
        },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps ambiguous coordinates blocked when no amendatory instruction is present", async () => {
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch: async () => new Response(
        federalRegisterBody()
          .replace("18 CFR Part 35", "18 CFR Parts 35 and 385")
          .replace(/<p>In consideration[\s\S]*?<\/p>\s*<p>2\. Amend[\s\S]*?<\/p>/u, ""),
        { headers: { "content-type": "text/html" } },
      ),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "cfr_coordinates_unavailable",
      parsed: null,
    });
  });

  it("rejects XML whose embedded coordinate differs from the requested CFR part", async () => {
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch: async (request) => String(request) === bodyHtml
        ? new Response(federalRegisterBody(), {
            headers: { "content-type": "text/html" },
          })
        : String(request) === versionMetadataUrl
          ? new Response(versionMetadata(), {
              headers: { "content-type": "application/json" },
            })
          : new Response(partXml([boundary], "18", "36"), {
              headers: { "content-type": "application/xml" },
            }),
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      parsed: null,
    });
  });

  it("can recover the CFR coordinate and bind the selected annual section through GovInfo", async () => {
    const govInfoSummary =
      "https://api.govinfo.gov/packages/FR-2018-03-06/granules/2018-03708/summary";
    const govInfoHtml =
      "https://api.govinfo.gov/packages/FR-2018-03-06/granules/2018-03708/htm";
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url === bodyHtml) {
        return new Response("temporary Federal Register outage", { status: 503 });
      }
      if (url === govInfoSummary) {
        expect(new Headers(init?.headers).get("x-api-key")).toBe("govinfo-secret");
        return new Response(JSON.stringify({
          collectionCode: "FR",
          dateIssued: "2018-03-06",
          packageId: "FR-2018-03-06",
          granuleId: "2018-03708",
          download: { txtLink: govInfoHtml },
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === govInfoHtml) {
        expect(new Headers(init?.headers).get("x-api-key")).toBe("govinfo-secret");
        return new Response(federalRegisterBody(), {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === versionMetadataUrl) {
        return new Response(versionMetadata(), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === baselineUrl) {
        return new Response(partXml([boundary]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === effectiveUrl) {
        return new Response(partXml([boundary, addition]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === annualSearchUrl) {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-api-key")).toBe("govinfo-secret");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          query: expect.stringContaining("cfrsectionnum:35.28"),
          historical: true,
          pageSize: "2",
        });
        return new Response(annualSearchResult(), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === annualXmlUrl) {
        expect(new Headers(init?.headers).get("x-api-key")).toBe("govinfo-secret");
        return new Response(annualCfrXml(), {
          headers: { "content-type": "application/xml" },
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      govInfoApiKey: "govinfo-secret",
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      attemptedSources: [
        bodyHtml,
        govInfoSummary,
        govInfoHtml,
        versionMetadataUrl,
        baselineUrl,
        effectiveUrl,
        annualSearchUrl,
        annualXmlUrl,
      ],
      usage: {
        sourceQueries: 1,
        metadataRecords: 3,
        documentAttempts: 8,
        usefulDocuments: 6,
        transportHops: 8,
      },
      parsed: {
        projections: expect.arrayContaining([expect.objectContaining({
          predicate: "previous_baseline",
          typedValue: expect.objectContaining({
            annualEditionAsOf: "2018-04-01",
            immediatePreEffectiveAsOf: "2018-06-03",
          }),
          citation: expect.objectContaining({ canonicalUrl: annualXmlUrl }),
        })]),
      },
    });
    expect(JSON.stringify(result)).not.toContain("govinfo-secret");
  });

  it("keeps valid eCFR evidence when the optional annual route fails", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === bodyHtml) {
        return new Response(federalRegisterBody(), {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === versionMetadataUrl) {
        return new Response(versionMetadata(), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === baselineUrl) {
        return new Response(partXml([boundary]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === effectiveUrl) {
        return new Response(partXml([boundary, addition]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url === annualSearchUrl) {
        return new Response("temporary outage", { status: 503 });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const result = await acquireScreen02EcfrHistoricalPolicy({
      workflow: confirmedWorkflow(),
      fetch,
      govInfoApiKey: "govinfo-secret",
      retrievedAt: "2026-09-12T10:00:05.000Z",
    });
    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      attemptedSources: [
        bodyHtml,
        versionMetadataUrl,
        baselineUrl,
        effectiveUrl,
        annualSearchUrl,
      ],
      parsed: {
        collection: {
          sources: [
            expect.objectContaining({ provider: "ecfr" }),
            expect.objectContaining({ provider: "ecfr" }),
            expect.objectContaining({ provider: "ecfr" }),
          ],
        },
      },
    });
    expect(result.limitation).toContain("returned HTTP 503");
    expect(result.limitation).toContain("eCFR comparison remains retained");
    expect(JSON.stringify(result.parsed)).not.toContain("annual CFR edition");
  });
});
