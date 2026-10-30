import { describe, expect, it, vi } from "vitest";

import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import { createPolicyBriefing } from
  "../../src/core/six-screen/policy-review";
import { acquireScreen02ComplementaryPolicyEvidence } from
  "../../src/worker/screen02-complementary-evidence-acquisition";

const retrievedAt = "2026-09-17T16:30:00.000Z";
const TEST_CONGRESS_HEADER_VALUE = "[redacted-congress-test-value]";
const TEST_OPENSTATES_HEADER_VALUE = "[redacted-openstates-test-value]";

const statutes = [
  {
    id: "cures",
    title: "21st Century Cures Act",
    congress: 114,
    type: "hr",
    number: 34,
    explanation:
      "The 21st Century Cures Act requires federal health agencies to modernize medical-product development and establishes new research and data-sharing programs.",
  },
  {
    id: "respect-marriage",
    title: "Respect for Marriage Act",
    congress: 117,
    type: "hr",
    number: 8404,
    explanation:
      "The Respect for Marriage Act requires federal recognition of a marriage valid where entered and establishes protections for religious organizations.",
  },
  {
    id: "first-step",
    title: "First Step Act of 2018",
    congress: 115,
    type: "s",
    number: 756,
    explanation:
      "The First Step Act of 2018 requires a federal risk-and-needs assessment system and authorizes earned-time credits for eligible prisoners.",
  },
] as const;

function confirmedStatute(input: typeof statutes[number]) {
  const source = {
    id: `congress-${input.id}`,
    title: input.title,
    locator:
      `https://www.congress.gov/bill/${input.congress}th-congress/${input.type === "hr" ? "house-bill" : "senate-bill"}/${input.number}`,
    publisher: "Congress.gov",
    publishedDate: "2020-01-01",
    authorityTier: "tier-1",
    retrievedAt,
    provider: "Congress.gov",
    nativeId: `${input.congress}/${input.type}/${input.number}`,
    routeId: "congress_public_law_bill_text",
    routeVersion: "congress-public-law-identity-v1",
    accessStatus: "retained_passage",
    inspectedText: "partial",
    contentHash: "sha256:identity",
    retainedText: `Congress.gov identifies ${input.title}.`,
  };
  const candidate = {
    id: `identity-${input.id}`,
    officialTitle: input.title,
    aliases: [],
    formalIdentifiers: [
      `${input.type.toUpperCase()} ${input.number} (${input.congress}th Congress)`,
    ],
    issuer: "United States Congress",
    issuingJurisdiction: "United States",
    identitySources: [source],
  };
  return {
    candidates: [candidate],
    confirmedShock: {
      id: `confirmed-${input.id}`,
      officialTitle: candidate.officialTitle,
      aliases: candidate.aliases,
      formalIdentifiers: candidate.formalIdentifiers,
      issuer: candidate.issuer,
      issuingJurisdiction: candidate.issuingJurisdiction,
      confirmation: { candidateId: candidate.id },
    },
  } as unknown as SixScreenWorkflowState;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Screen 2 complementary explanatory evidence", () => {
  it("retains a delayed Federal Register abstract as independent introductory evidence", async () => {
    vi.useFakeTimers();
    try {
      const title =
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
      const exactApi =
        "https://www.federalregister.gov/api/v1/documents/2018-03708.json";
      const exactText =
        "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt";
      const candidate = {
        id: "identity-ferc-order-841",
        officialTitle: title,
        aliases: ["FERC Order 841"],
        formalIdentifiers: ["2018-03708"],
        issuer: "Federal Energy Regulatory Commission",
        issuingJurisdiction: "United States",
        identitySources: [{
          id: "fr-2018-03708-text",
          title,
          locator: exactText,
          publisher: "Federal Register",
          publishedDate: "2018-03-06",
          authorityTier: "tier-1",
          retrievedAt,
          provider: "federal-register",
          nativeId: "2018-03708",
          routeId: "exact_federal_register_document",
          routeVersion: "six-screen-federal-register-policy-v4",
          accessStatus: "retained_passage",
          inspectedText: "partial",
          contentHash: "sha256:identity",
          retainedText: "FERC Order 841 identifies the confirmed federal rule.",
        }],
      };
      const workflow = {
        candidates: [candidate],
        confirmedShock: {
          id: "confirmed-ferc-order-841",
          officialTitle: candidate.officialTitle,
          aliases: candidate.aliases,
          formalIdentifiers: candidate.formalIdentifiers,
          issuer: candidate.issuer,
          issuingJurisdiction: candidate.issuingJurisdiction,
          confirmation: { candidateId: candidate.id },
        },
      } as unknown as SixScreenWorkflowState;
      const fetch = vi.fn((
        request: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const url = String(request);
        if (url === exactApi) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve(json({
              document_number: "2018-03708",
              title,
              abstract:
                "The Federal Energy Regulatory Commission is amending its regulations under the Federal Power Act to remove barriers to electric-storage participation in organized wholesale markets.",
              agencies: [{ name: "Federal Energy Regulatory Commission" }],
              html_url:
                "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
              publication_date: "2018-03-06",
            })), 9_000);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            }, { once: true });
          });
        }
        if (url.startsWith("https://api.gdeltproject.org/")) {
          return Promise.resolve(json({ articles: [] }));
        }
        return Promise.resolve(new Response("not available", { status: 503 }));
      });

      const pending = acquireScreen02ComplementaryPolicyEvidence({
        workflow,
        fetch,
        retrievedAt,
        documentNumber: "2018-03708",
      });
      await vi.advanceTimersByTimeAsync(9_000);
      const result = await pending;

      expect(result.status).toBe("partial");
      expect(result.parsed!.projections).toEqual(expect.arrayContaining([
        expect.objectContaining({
          predicate: "policy_explanation",
          statement: expect.stringContaining("is amending its regulations"),
          citation: expect.objectContaining({
            provider: "Federal Register API",
            canonicalUrl:
              "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
          }),
        }),
      ]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses at most one exact-record retry for an exact Federal Register document identity", async () => {
    const title =
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
    const exactApi =
      "https://www.federalregister.gov/api/v1/documents/2018-03708.json";
    const exactText =
      "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt";
    const identitySource = (input: {
      id: string;
      locator: string;
      routeId: string;
    }) => ({
      ...input,
      title,
      publisher: "Federal Register",
      publishedDate: "2018-03-06",
      authorityTier: "tier-1",
      retrievedAt,
      provider: "federal-register",
      nativeId: "2018-03708",
      routeVersion: "test-route-v1",
      accessStatus: "retained_passage" as const,
      inspectedText: "partial" as const,
      contentHash: "sha256:identity",
      retainedText: "FERC Order 841 identifies the confirmed federal rule.",
    });
    const candidate = {
      id: "identity-ferc-order-841-retry",
      officialTitle: title,
      aliases: ["FERC Order 841"],
      formalIdentifiers: ["2018-03708"],
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      identitySources: [
        identitySource({
          id: "fr-2018-03708-text",
          locator: exactText,
          routeId: "exact_federal_register_document",
        }),
      ],
    };
    const workflow = {
      candidates: [candidate],
      confirmedShock: {
        id: "confirmed-ferc-order-841-retry",
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        issuingJurisdiction: candidate.issuingJurisdiction,
        confirmation: { candidateId: candidate.id },
      },
    } as unknown as SixScreenWorkflowState;
    let exactApiAttempts = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === exactApi) {
        exactApiAttempts += 1;
        if (exactApiAttempts === 1) {
          return new Response("temporarily unavailable", { status: 503 });
        }
        return json({
          document_number: "2018-03708",
          title,
          abstract:
            "The Federal Energy Regulatory Commission is amending its regulations under the Federal Power Act to remove barriers to electric-storage participation in organized wholesale markets.",
          agencies: [{ name: "Federal Energy Regulatory Commission" }],
          html_url:
            "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
          publication_date: "2018-03-06",
        });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      return new Response("not available", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: "2018-03708",
    });

    expect(result.status).toBe("partial");
    expect(exactApiAttempts).toBe(2);
    expect(result.usage.sourceQueries).toBe(3);
    expect(result.attemptedSources.filter((url) => url === exactApi))
      .toHaveLength(1);
    expect(fetch.mock.calls.filter(([request]) => String(request) === exactApi))
      .toHaveLength(2);
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        statement: expect.stringContaining("is amending its regulations"),
        citation: expect.objectContaining({ provider: "Federal Register API" }),
      }),
    ]));
  });

  it("uses the exact-ID retained official abstract only after both fresh requests fail", async () => {
    const title =
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
    const exactApi =
      "https://www.federalregister.gov/api/v1/documents/2018-03708.json";
    const exactText =
      "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt";
    const candidate = {
      id: "identity-ferc-order-841-retained",
      officialTitle: title,
      aliases: ["FERC Order 841"],
      formalIdentifiers: ["2018-03708"],
      issuer: "Federal Energy Regulatory Commission",
      issuingJurisdiction: "United States",
      identitySources: [{
        id: "fr-2018-03708-text",
        title,
        locator: exactText,
        publisher: "Federal Register",
        publishedDate: "2018-03-06",
        authorityTier: "tier-1",
        retrievedAt,
        provider: "federal-register",
        nativeId: "2018-03708",
        routeId: "exact_federal_register_document",
        routeVersion: "six-screen-federal-register-policy-v4",
        accessStatus: "retained_passage" as const,
        inspectedText: "partial" as const,
        contentHash: "sha256:exact-document",
        retainedText: "FERC Order 841 identifies the confirmed federal rule.",
      }, {
        id: "fr-2018-03708-api-evidence",
        title: `${title} — Federal Register API record`,
        locator: exactApi,
        publisher: "Federal Register",
        publishedDate: "2018-03-06",
        authorityTier: "tier-2",
        retrievedAt,
        provider: "Federal Register API",
        nativeId: "2018-03708",
        routeId: "federal_register_api_excerpt",
        routeVersion: "six-screen-federal-register-policy-v4",
        accessStatus: "retained_passage" as const,
        inspectedText: "abstract" as const,
        contentHash: "fnv1a64:0123456789abcdef",
        retainedText:
          `${title}. Federal Register document 2018-03708. The Federal Energy Regulatory Commission is amending its regulations under the Federal Power Act to remove barriers to electric-storage participation in organized wholesale markets.`,
      }],
    };
    const workflow = {
      candidates: [candidate],
      confirmedShock: {
        id: "confirmed-ferc-order-841-retained",
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        issuingJurisdiction: candidate.issuingJurisdiction,
        confirmation: { candidateId: candidate.id },
      },
    } as unknown as SixScreenWorkflowState;
    let exactApiAttempts = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === exactApi) {
        exactApiAttempts += 1;
        return new Response("temporarily unavailable", { status: 503 });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      return new Response("not available", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: "2018-03708",
    });

    expect(exactApiAttempts).toBe(2);
    expect(result.status).toBe("partial");
    expect(result.usage).toMatchObject({
      sourceQueries: 3,
      metadataRecords: 1,
      usefulDocuments: 1,
    });
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        statement: expect.stringContaining("is amending its regulations"),
        citation: expect.objectContaining({
          provider: "Federal Register API",
          canonicalUrl: exactApi,
        }),
      }),
    ]));

    const mismatchedCandidate = {
      ...candidate,
      identitySources: [
        candidate.identitySources[0]!,
        { ...candidate.identitySources[1]!, nativeId: "2018-00000" },
      ],
    };
    const rejected = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: {
        ...workflow,
        candidates: [mismatchedCandidate],
      } as unknown as SixScreenWorkflowState,
      fetch,
      retrievedAt,
      documentNumber: "2018-03708",
    });
    expect(rejected).toMatchObject({
      status: "waiting_source",
      failureCode: "source_unavailable",
      parsed: null,
    });
  });

  it.each(statutes)(
    "retrieves inspected Congress.gov explanation for uncataloged $title without completing precise legal requirements",
    async (policy) => {
      const requests: Array<{ url: string; headers: Headers }> = [];
      const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(request),
          headers: new Headers(init?.headers),
        });
        if (String(request).startsWith("https://api.gdeltproject.org/")) {
          return json({ articles: [] });
        }
        return json({
          request: {
            congress: policy.congress,
            billType: policy.type.toUpperCase(),
            billNumber: String(policy.number),
          },
          summaries: [{
            actionDate: "2020-01-01",
            actionDesc: "Public Law",
            updateDate: "2020-01-02",
            versionCode: "49",
            text: `<p>${policy.explanation}</p>`,
          }],
        });
      });

      const result = await acquireScreen02ComplementaryPolicyEvidence({
        workflow: confirmedStatute(policy),
        fetch,
        retrievedAt,
        documentNumber: null,
        congressApiKey: TEST_CONGRESS_HEADER_VALUE,
      });

      expect(result).toMatchObject({
        status: "partial",
        failureCode: null,
        usage: { sourceQueries: 2, usefulDocuments: 1, transportHops: 2 },
      });
      expect(requests).toHaveLength(2);
      expect(requests[0]!.url).toContain(
        `/v3/bill/${policy.congress}/${policy.type}/${policy.number}/summaries?format=json`,
      );
      expect(requests[0]!.url).not.toContain(TEST_CONGRESS_HEADER_VALUE);
      expect(requests[0]!.headers.get("x-api-key")).toBe(
        TEST_CONGRESS_HEADER_VALUE,
      );
      const explanation = result.parsed!.projections.find(({ predicate }) =>
        predicate === "policy_explanation");
      expect(explanation).toMatchObject({
        supportStatus: "direct",
        citation: {
          provider: "Congress.gov",
          sourceTitle: "Congressional Research Service via Congress.gov",
          documentType: "official explanatory material",
          author: "Congressional Research Service legislative analysts",
          publicationDate: "2020-01-02",
          inspectedText: "partial",
        },
      });
      expect(explanation!.statement).toContain(policy.title);
      expect(result.parsed!.collection.requirements.every(({ status }) =>
        status === "not_yet_searched")).toBe(true);
      const briefing = createPolicyBriefing({
        title: policy.title,
        claims: result.parsed!.projections,
        requirements: result.parsed!.collection.requirements,
        generatedAt: retrievedAt,
      });
      expect(briefing.overview).toContain(explanation!.statement);
      expect(briefing.overview).not.toContain(
        "inspected, identity-bound explanatory evidence",
      );
      expect(briefing.unresolvedQuestions.length).toBeGreaterThan(0);
    },
  );

  it("resolves a GovInfo public law through Congress.gov before requesting its summary", async () => {
    const candidate = {
      id: "identity-dodd-frank",
      officialTitle: "Dodd-Frank Wall Street Reform and Consumer Protection Act",
      aliases: ["Dodd-Frank Act"],
      formalIdentifiers: ["Public Law 111-203"],
      issuer: "United States Congress",
      issuingJurisdiction: "United States",
      identitySources: [{
        id: "source-dodd-frank",
        title: "Public Law 111-203",
        locator: "https://www.govinfo.gov/app/details/PLAW-111publ203",
        publisher: "U.S. Government Publishing Office",
        publishedDate: "2010-07-21",
        authorityTier: "tier-1",
        retrievedAt,
        provider: "GovInfo",
        nativeId: "PLAW-111publ203",
        routeId: "reviewed_official_document",
        accessStatus: "retained_passage",
        inspectedText: "partial",
        contentHash: "sha256:dodd-frank-identity",
        retainedText: "Public Law 111-203 is the Dodd-Frank Wall Street Reform and Consumer Protection Act.",
      }],
    };
    const workflow = {
      candidates: [candidate],
      confirmedShock: {
        id: "confirmed-dodd-frank",
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        issuingJurisdiction: candidate.issuingJurisdiction,
        confirmation: { candidateId: candidate.id },
      },
    } as unknown as SixScreenWorkflowState;
    const requested: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requested.push(url);
      if (url.includes("/v3/law/111/pub/203")) {
        return json({
          bill: {
            congress: 111,
            type: "HR",
            number: 4173,
            title: candidate.officialTitle,
          },
        });
      }
      if (url.includes("/v3/bill/111/hr/4173/summaries")) {
        const oversizedBackground =
          "Additional administrative background remains subject to implementing rules. "
            .repeat(5_000);
        return json({
          request: { congress: 111, billType: "HR", billNumber: "4173" },
          summaries: [{
            actionDate: "2010-07-21",
            actionDesc: "Public Law",
            updateDate: "2010-07-22",
            versionCode: "49",
            text: `<p>The Dodd-Frank Wall Street Reform and Consumer Protection Act establishes a new framework for financial stability and consumer financial protection. It creates new supervisory and reporting requirements for banks, designated nonbank financial companies, securities-market participants, and consumer-finance providers. Applicability varies by institutional type, activity, asset threshold, and the implementing rule. The Act also establishes authorities to oversee systemic risk and resolve certain failing financial companies.</p><p>${oversizedBackground}</p>`,
          }],
        });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      return new Response("not available", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: null,
      congressApiKey: TEST_CONGRESS_HEADER_VALUE,
    });

    expect(requested).toEqual(expect.arrayContaining([
      expect.stringContaining("/v3/law/111/pub/203"),
      expect.stringContaining("/v3/bill/111/hr/4173/summaries"),
    ]));
    expect(result.status).toBe("partial");
    expect(result.parsed!.projections.map(({ statement }) => statement))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("banks, designated nonbank financial companies"),
        expect.stringContaining("Applicability varies"),
      ]));
  });

  it("uses Open States metadata when a state legislature blocks direct document retrieval", async () => {
    const officialPage =
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202120220SB331";
    const candidate = {
      id: "identity-california-sb-331",
      officialTitle: "California Silenced No More Act",
      aliases: ["Silenced No More Act"],
      formalIdentifiers: ["SB 331", "Chapter 638, Statutes of 2021"],
      issuer: "California Legislature",
      issuingJurisdiction: "California, United States",
      instrumentType: "state legislation",
      typedDates: [{
        start: "2021-10-07",
        end: null,
        precision: "day",
        kind: "adoption",
        passageIds: [],
      }],
      identitySources: [{
        id: "source-california-sb-331",
        title: "California Senate Bill 331",
        locator: officialPage,
        publisher: "California Legislative Information",
        publishedDate: "2021-10-07",
        authorityTier: "tier-1",
        retrievedAt,
        provider: "California Legislative Information",
        nativeId: "SB 331",
        routeId: "reviewed_official_document",
        accessStatus: "retained_passage",
        inspectedText: "partial",
        contentHash: "sha256:california-sb-331-identity",
        retainedText:
          "California Senate Bill 331 was chaptered as the Silenced No More Act and became operative January 1, 2022.",
      }],
    };
    const workflow = {
      candidates: [candidate],
      confirmedShock: {
        id: "confirmed-california-sb-331",
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        issuingJurisdiction: candidate.issuingJurisdiction,
        confirmation: { candidateId: candidate.id },
      },
    } as unknown as SixScreenWorkflowState;
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.startsWith("https://v3.openstates.org/bills")) {
        const page = new URL(url).searchParams.get("page");
        if (page === "1") {
          return json({ results: [{
            id: "ocd-bill/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            session: "2025-2026",
            jurisdiction: {
              id: "ocd-jurisdiction/country:us/state:ca/government",
              name: "California",
              classification: "state",
            },
            from_organization: {
              id: "ocd-organization/california-legislature",
              name: "California Legislature",
              classification: "legislature",
            },
            identifier: "SB 331",
            title: "Health care coverage: timely access to care",
            classification: ["bill"],
            openstates_url: "https://openstates.org/ca/bills/20252026/SB331/",
            first_action_date: "2025-02-10",
            latest_action_date: "2025-09-10",
            abstracts: [{
              note: "Legislative summary",
              abstract:
                "Existing law regulates health care service plans and makes a willful violation a crime.",
            }],
            actions: [{
              id: "action-sb331-2025",
              description: "Passed Senate",
              date: "2025-09-10",
              classification: ["passage"],
              order: 1,
            }],
            sources: [],
            versions: [],
            documents: [],
          }] });
        }
        return json({ results: [{
          id: "ocd-bill/11111111-2222-3333-4444-555555555555",
          session: "2021-2022",
          jurisdiction: {
            id: "ocd-jurisdiction/country:us/state:ca/government",
            name: "California",
            classification: "state",
          },
          from_organization: {
            id: "ocd-organization/california-legislature",
            name: "California Legislature",
            classification: "legislature",
          },
          identifier: "SB 331",
          title: "Silenced No More Act",
          classification: ["bill"],
          openstates_url: "https://openstates.org/ca/bills/20212022/SB331/",
          first_action_date: "2021-02-09",
          latest_action_date: "2021-10-07",
          latest_action_description: "Chaptered by Secretary of State",
          abstracts: [{
            note: "Legislative summary",
            abstract:
              "The Silenced No More Act prohibits an employer from using settlement or nondisparagement provisions to prevent disclosure of factual information about unlawful workplace discrimination, harassment, or retaliation. It applies to covered employment agreements entered on or after January 1, 2022, subject to stated statutory exceptions.",
          }],
          actions: [{
            id: "action-sb331-chaptered",
            description: "Chaptered by Secretary of State as Chapter 638",
            date: "2021-10-07",
            classification: ["became-law"],
            order: 1,
          }],
          sources: [{ url: officialPage, note: "Official bill text" }],
          versions: [],
          documents: [],
        }] });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      return new Response("direct legislature page blocked", { status: 403 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: null,
      openStatesApiKey: TEST_OPENSTATES_HEADER_VALUE,
    });

    expect(result.status).toBe("partial");
    expect(result.parsed!.projections.map(({ statement }) => statement))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("prohibits an employer"),
        expect.stringContaining("applies to covered employment agreements"),
      ]));
    expect(result.parsed!.collection.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: "Open States API",
        documentType: "official explanatory material",
      }),
    ]));
    const openStatesRequests = requests.filter(({ url }) =>
      url.startsWith("https://v3.openstates.org/bills"));
    expect(openStatesRequests).toHaveLength(2);
    expect(openStatesRequests.map(({ url }) =>
      new URL(url).searchParams.get("page"))).toEqual(["1", "2"]);
    const openStatesRequest = openStatesRequests[0];
    expect(new URL(openStatesRequest!.url).searchParams.get("identifier"))
      .toBe("SB 331");
    expect(new URL(openStatesRequest!.url).searchParams.has("identifiers"))
      .toBe(false);
    expect(openStatesRequest?.headers.get("x-api-key")).toBe(
      TEST_OPENSTATES_HEADER_VALUE,
    );
    expect(openStatesRequest?.url).not.toContain(TEST_OPENSTATES_HEADER_VALUE);
  });

  it("keeps an inspected specialist explanation when the preferred API fails", async () => {
    const policy = statutes[1];
    const article =
      "https://www.brookings.edu/articles/respect-for-marriage-act-explained";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.congress.gov")) return json({ error: "down" }, 503);
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [{
          url: article,
          title: "Respect for Marriage Act explained",
          seendate: "20260916T120000Z",
          language: "English",
          sourcecountry: "United States",
        }] });
      }
      if (url === article) {
        return new Response(`<!doctype html><html><head>
          <meta property="og:title" content="Respect for Marriage Act explained">
          <meta name="author" content="Jordan Analyst">
          <meta property="article:published_time" content="2026-09-16T12:00:00Z">
        </head><body><main><h1>Respect for Marriage Act explained</h1>
          <p>The Respect for Marriage Act requires the federal government to recognize a marriage that was valid in the jurisdiction where it was entered.</p>
          <p>The law also provides protections for nonprofit religious organizations.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      fetch,
      retrievedAt,
      documentNumber: null,
      congressApiKey: TEST_CONGRESS_HEADER_VALUE,
    });

    expect(result.status).toBe("partial");
    const claim = result.parsed!.projections.find(({ predicate }) =>
      predicate === "policy_explanation")!;
    expect(claim).toMatchObject({
      supportStatus: "indirect",
      citation: {
        provider: "www.brookings.edu",
        documentType: "attributed specialist analysis",
        author: "Jordan Analyst",
        publicationDate: "2026-09-16",
      },
    });
    expect(claim.citation.exactText).toContain("requires the federal government");
    expect(result.parsed!.collection.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
    expect(fetch.mock.calls.some(([request]) => String(request) === article))
      .toBe(true);
  });

  it("combines an official API explanation with a separately inspected outside analysis", async () => {
    const policy = statutes[2];
    const article =
      "https://www.reuters.com/world/us/first-step-act-implementation-analysis";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.congress.gov")) {
        return json({
          request: {
            congress: policy.congress,
            billType: policy.type.toUpperCase(),
            billNumber: String(policy.number),
          },
          summaries: [{
            actionDate: "2018-12-21",
            actionDesc: "Public Law",
            updateDate: "2018-12-22",
            versionCode: "49",
            text: `<p>${policy.explanation}</p>`,
          }],
        });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [{
          url: article,
          title: "First Step Act implementation analysis",
          seendate: "20260916T120000Z",
          language: "English",
          sourcecountry: "United States",
        }] });
      }
      if (url === article) {
        return new Response(`<!doctype html><html><head>
          <meta property="og:title" content="First Step Act implementation analysis">
          <meta name="author" content="Taylor Reporter">
          <meta property="article:published_time" content="2026-09-16T12:00:00Z">
        </head><body><main>
          <p>The First Step Act of 2018 created earned-time credits and directed federal agencies to implement a risk-and-needs assessment system.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      fetch,
      retrievedAt,
      documentNumber: null,
      congressApiKey: TEST_CONGRESS_HEADER_VALUE,
    });

    expect(result.status).toBe("partial");
    expect(result.parsed!.collection.sources.map(({ provider }) => provider))
      .toEqual(expect.arrayContaining(["Congress.gov", "www.reuters.com"]));
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        supportStatus: "direct",
        citation: expect.objectContaining({ provider: "Congress.gov" }),
      }),
      expect.objectContaining({
        predicate: "policy_explanation",
        supportStatus: "indirect",
        citation: expect.objectContaining({
          provider: "www.reuters.com",
          author: "Taylor Reporter",
          publicationDate: "2026-09-16",
        }),
      }),
    ]));
    expect(result.parsed!.collection.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
  });

  it("isolates a failed controlling page from a successful official implementation page", async () => {
    const policy = statutes[2];
    const implementationPage =
      "https://www.justice.gov/first-step-act/implementation-progress";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === implementationPage) {
        return new Response(`<!doctype html><html><head>
          <meta name="author" content="United States Department of Justice">
          <meta name="date" content="2025-04-10">
        </head><body><main><h1>First Step Act of 2018 implementation progress</h1>
          <p>The Department of Justice implements the First Step Act of 2018 through a risk-and-needs assessment system and reports program participation.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("upstream parser unavailable", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      fetch,
      retrievedAt,
      documentNumber: null,
      supportingEvidenceLeads: [{
        url: implementationPage,
        sourceType: "implementation_record",
        reasonForRetrieval:
          "Researcher supplied an official implementation page for inspection.",
      }],
    });

    expect(result.status).toBe("partial");
    expect(result.parsed!.projections[0]).toMatchObject({
      predicate: "policy_explanation",
      citation: {
        documentType: "official implementation record",
        author: "United States Department of Justice",
        publicationDate: "2025-04-10",
      },
    });
    expect(result.parsed!.projections[0]!.qualification)
      .toMatch(/controlling instrument/iu);
    expect(result.parsed!.collection.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
  });

  it("reaches a later official explanation when earlier controlling identity pages fail", async () => {
    const overview = "https://oag.ca.gov/privacy/ccpa";
    const initiative =
      "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39";
    const bill =
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375";
    const pdf =
      "https://oag.ca.gov/sites/all/files/agweb/pdfs/privacy/ccpa-isor-appendices.pdf";
    const identitySources = [
      {
        id: "ccpa-initiative",
        title: "Proposed initiative enters circulation: new consumer privacy rights",
        locator: initiative,
      },
      {
        id: "ccpa-bill",
        title: "California Assembly Bill 375, Chapter 55",
        locator: bill,
      },
      {
        id: "ccpa-isor",
        title: "Initial Statement of Reasons for CCPA Regulations",
        locator: pdf,
      },
      {
        id: "ccpa-overview",
        title: "California Consumer Privacy Act (CCPA) overview",
        locator: overview,
      },
    ].map((source) => ({
      ...source,
      publisher: "State of California",
      publishedDate: "2018-06-29",
      authorityTier: "tier-1",
      retrievedAt,
      routeId: "reviewed_official_document",
      accessStatus: "retained_passage" as const,
      inspectedText: "partial" as const,
      retainedText: `${source.title} identifies the California Consumer Privacy Act.`,
    }));
    const workflow = {
      candidates: [{
        id: "identity-ccpa",
        officialTitle: "California Consumer Privacy Act",
        aliases: ["CCPA"],
        formalIdentifiers: ["AB 375"],
        issuer: "State of California",
        issuingJurisdiction: "California, United States",
        identitySources,
      }],
      confirmedShock: {
        id: "confirmed-ccpa",
        officialTitle: "California Consumer Privacy Act",
        aliases: ["CCPA"],
        formalIdentifiers: ["AB 375"],
        issuer: "State of California",
        issuingJurisdiction: "California, United States",
        confirmation: { candidateId: "identity-ccpa" },
      },
    } as unknown as SixScreenWorkflowState;
    const requested: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requested.push(url);
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      if (url === overview) {
        return new Response(`<!doctype html><html><head>
          <title>California Consumer Privacy Act (CCPA) overview</title>
        </head><body><main>
          <p>The California Consumer Privacy Act gives consumers more control over personal information and requires qualifying businesses to honor rights to know, delete, and opt out of sale or sharing.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("controlling page unavailable", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: null,
    });

    expect(result.status).toBe("partial");
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        citation: expect.objectContaining({
          canonicalUrl: overview,
          provider: "oag.ca.gov",
        }),
      }),
    ]));
    expect(requested).toContain(overview);
    expect(requested).toContain(initiative);
    expect(requested).not.toContain(bill);
    expect(requested).not.toContain(pdf);
    expect(requested.indexOf(overview)).toBeLessThan(
      requested.indexOf(initiative),
    );
  });

  it("never turns a discovery snippet into evidence when the underlying page cannot be inspected", async () => {
    const policy = statutes[0];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.congress.gov")) return json({ error: "down" }, 503);
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [{
          url: "https://www.reuters.com/world/us/cures-act-story",
          title: "21st Century Cures Act changes research",
          seendate: "20260916T120000Z",
          language: "English",
          sourcecountry: "United States",
        }] });
      }
      return new Response("not available", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      fetch,
      retrievedAt,
      documentNumber: null,
      congressApiKey: TEST_CONGRESS_HEADER_VALUE,
    });

    expect(result.status).toBe("waiting_source");
    expect(result.parsed).toBeNull();
    expect(result.limitation).toMatch(/does not block/iu);
  });

  it("retains an exact tier-1 UK identity passage as a transparent introductory fallback", async () => {
    const locator =
      "https://www.legislation.gov.uk/ukpga/2023/54/section/1/data.xml";
    const retainedText =
      "Procurement Act 2023. This Act establishes requirements for contracting authorities and applies to covered public contracts. Contracting authorities must have regard to delivering value for money and acting with integrity.";
    const candidate = {
      id: "identity-procurement-act-2023",
      officialTitle: "Procurement Act 2023",
      aliases: [],
      formalIdentifiers: ["ukpga/2023/54"],
      issuer: "United Kingdom Parliament",
      issuingJurisdiction: "United Kingdom",
      identitySources: [{
        id: "uk-legislation-procurement-section-1",
        title: "Procurement Act 2023",
        locator,
        publisher: "The National Archives",
        publishedDate: "2023-10-26",
        authorityTier: "tier-1",
        retrievedAt,
        provider: "uk-legislation",
        nativeId: "ukpga/2023/54",
        routeId: "uk_legislation_document",
        routeVersion: "screen-01-official-policy-document-v1",
        accessStatus: "retained_passage",
        inspectedText: "partial",
        contentHash: "sha256:procurement-identity",
        retainedText,
      }],
    };
    const workflow = {
      candidates: [candidate],
      confirmedShock: {
        id: "confirmed-procurement-act-2023",
        officialTitle: candidate.officialTitle,
        aliases: candidate.aliases,
        formalIdentifiers: candidate.formalIdentifiers,
        issuer: candidate.issuer,
        issuingJurisdiction: candidate.issuingJurisdiction,
        confirmation: { candidateId: candidate.id },
      },
    } as unknown as SixScreenWorkflowState;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      if (url === locator) {
        return new Response(`<Legislation><Body>${retainedText}</Body></Legislation>`, {
          headers: { "content-type": "application/xml" },
        });
      }
      return new Response("not available", { status: 503 });
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow,
      fetch,
      retrievedAt,
      documentNumber: null,
    });

    expect(result).toMatchObject({
      status: "partial",
      failureCode: null,
      usage: {
        sourceQueries: 1,
        metadataRecords: 1,
        documentAttempts: 1,
        usefulDocuments: 1,
      },
    });
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_explanation",
        statement: expect.stringContaining(
          "establishes requirements for contracting authorities",
        ),
        citation: expect.objectContaining({
          provider: "uk-legislation",
          canonicalUrl: locator,
          sourceRole: expect.stringMatching(/retained during Screen 1/iu),
        }),
      }),
    ]));
    expect(result.attemptedSources).toEqual(expect.arrayContaining([locator]));
  });

  it("does not promote an untrusted retained identity excerpt into introductory evidence", async () => {
    const policy = confirmedStatute(statutes[0]);
    policy.candidates[0]!.identitySources[0]!.authorityTier = "tier-3";
    policy.candidates[0]!.identitySources[0]!.retainedText =
      "The 21st Century Cures Act requires federal agencies to modernize medical-product development and establishes new research programs.";
    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: policy,
      fetch: vi.fn(async (request: RequestInfo | URL) =>
        String(request).startsWith("https://api.gdeltproject.org/")
          ? json({ articles: [] })
          : new Response("not available", { status: 503 })),
      retrievedAt,
      documentNumber: null,
    });

    expect(result).toMatchObject({
      status: "waiting_source",
      parsed: null,
    });
  });

  it("rejects an inspected explanatory page that is not bound to the confirmed policy", async () => {
    const policy = statutes[2];
    const unrelated =
      "https://www.brookings.edu/articles/an-unrelated-sentencing-policy";
    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      retrievedAt,
      documentNumber: null,
      supportingEvidenceLeads: [{
        url: unrelated,
        sourceType: "specialist_analysis",
        reasonForRetrieval: "Researcher supplied this page for inspection.",
      }],
      fetch: vi.fn(async () => new Response(`<!doctype html><html><head>
        <title>An unrelated sentencing policy</title>
        <meta name="author" content="Casey Researcher">
        <meta name="date" content="2026-09-16">
      </head><body><main>
        <p>The Second Chance Act authorizes reentry grants and establishes a federal coordinating council.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html" },
      })),
    });

    expect(result).toMatchObject({
      status: "waiting_source",
      parsed: null,
      failureCode: "wrong_document",
    });
  });
  it("independently verifies a model-discovered page before retaining its explanation", async () => {
    const policy = statutes[1];
    const discoveredUrl =
      "https://policy.example.org/respect-for-marriage-act-explained";
    const fixedFetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.congress.gov")) {
        return json({ error: "temporarily unavailable" }, 503);
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return json({ articles: [] });
      }
      return new Response("not available", { status: 503 });
    });
    const publicWebFetch = vi.fn(async (request: RequestInfo | URL) => {
      expect(String(request)).toBe(discoveredUrl);
      return new Response(`<!doctype html><html><head>
        <title>Respect for Marriage Act explained</title>
        <meta name="author" content="Policy Research Center">
      </head><body><main>
        <p>The Respect for Marriage Act requires federal and state governments to recognize a marriage that was valid where it was entered.</p>
        <p>The law applies to marriages between two individuals and preserves stated protections for nonprofit religious organizations.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    });
    const discoverAdditionalSources = vi.fn(async (request) => {
      expect(request).toMatchObject({
        officialTitle: policy.title,
        missingSections: expect.arrayContaining([
          "what_changed",
          "coverage",
        ]),
      });
      return {
        attempted: true,
        urls: [discoveredUrl],
        responseBytes: 512,
      };
    });

    const result = await acquireScreen02ComplementaryPolicyEvidence({
      workflow: confirmedStatute(policy),
      fetch: fixedFetch,
      publicWebFetch,
      discoverAdditionalSources,
      retrievedAt,
      documentNumber: null,
      congressApiKey: TEST_CONGRESS_HEADER_VALUE,
    });

    expect(result.status).toBe("partial");
    expect(discoverAdditionalSources).toHaveBeenCalledOnce();
    expect(publicWebFetch).toHaveBeenCalledOnce();
    expect(result.usage.providerCostUnits).toEqual({
      openai_web_search: 1,
    });
    expect(result.parsed!.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        supportStatus: "indirect",
        statement: expect.stringContaining(
          "requires federal and state governments",
        ),
        citation: expect.objectContaining({
          provider: "policy.example.org",
          documentType: "attributed specialist analysis",
          canonicalUrl: discoveredUrl,
        }),
      }),
      expect.objectContaining({
        statement: expect.stringContaining("applies to marriages"),
      }),
    ]));
    expect(result.limitation).toMatch(
      /independently fetched, identity-bound, and parsed/iu,
    );
  });

});
