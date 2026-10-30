import { describe, expect, it, vi } from "vitest";

import { probeConfiguredSixScreenSources } from
  "../../src/worker/six-screen-source-capability-probes";

const at = "2026-09-17T17:00:00.000Z";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("live six-screen source capability probes", () => {
  it("enables only operation-shaped responses and never puts credentials in URLs", async () => {
    const secrets = {
      govInfoApiKey: "[redacted-govinfo-probe-test-value]",
      congressApiKey: "[redacted-congress-probe-test-value]",
      regulationsApiKey: "[redacted-regulations-probe-test-value]",
      openStatesApiKey: "[redacted-openstates-probe-test-value]",
      openAlexApiKey: "[redacted-openalex-probe-test-value]",
    };
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetch = vi.fn(async (
      request: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(request);
      requests.push({ url, headers: new Headers(init?.headers) });
      const host = new URL(url).hostname;
      if (host === "api.govinfo.gov") {
        return json({
          results: [{
            collectionCode: "PLAW",
            packageId: "PLAW-115publ391",
          }],
        });
      }
      if (host === "api.congress.gov") {
        return json({
          bill: {
            congress: 115,
            type: "S",
            number: "756",
            title: "First Step Act of 2018",
            laws: [{ type: "Public Law", number: "115-391" }],
          },
        });
      }
      if (host === "api.regulations.gov") {
        return json({
          data: [{
            id: "FERC-2018-03708",
            attributes: {
              title: "Electric Storage Participation in Markets",
              frDocNum: "2018-03708",
            },
          }],
        });
      }
      if (host === "api.openalex.org") {
        return json({
          meta: { count: 1, page: 1, per_page: 1 },
          results: [{
            id: "https://openalex.org/W1234567890",
            doi: "https://doi.org/10.1234/probe.1",
            display_name: "Difference in differences for public policy",
            authorships: [{ author: { display_name: "Ada Analyst" } }],
            publication_year: 2025,
            publication_date: "2025-01-01",
            primary_location: null,
            best_oa_location: null,
            type: "article",
            language: "en",
            is_retracted: false,
          }],
        });
      }
      if (host === "v3.openstates.org") {
        return json({
          results: [{
            id: "ocd-jurisdiction/country:us/state:ca/government",
            name: "California",
          }],
        });
      }
      if (host === "api.crossref.org") {
        return json({
          message: {
            items: [{
              DOI: "10.1234/probe.2",
              title: ["Difference in differences for public policy"],
              author: [{ given: "Grace", family: "Researcher" }],
              publisher: "Research Publisher",
              "container-title": ["Policy Methods"],
              published: { "date-parts": [[2025, 1, 1]] },
              type: "journal-article",
              URL: "https://doi.org/10.1234/probe.2",
            }],
          },
        });
      }
      throw new Error(`Unexpected probe ${url}`);
    });

    const probes = await probeConfiguredSixScreenSources({
      fetch,
      now: () => at,
      secrets,
      includeCrossref: true,
      cacheTtlMs: 0,
    });

    expect(Object.keys(probes).sort()).toEqual([
      "congress_gov",
      "crossref",
      "govinfo",
      "openalex",
      "openstates",
      "regulations_gov",
    ]);
    expect(Object.values(probes).every(({ outcome }) => outcome === "success"))
      .toBe(true);
    expect(requests).toHaveLength(6);
    const serializedUrls = requests.map(({ url }) => url).join("\n");
    for (const secret of Object.values(secrets)) {
      expect(serializedUrls).not.toContain(secret);
      expect(JSON.stringify(probes)).not.toContain(secret);
    }
    expect(requests.find(({ url }) => url.includes("api.govinfo.gov"))!
      .headers.get("x-api-key")).toBe(secrets.govInfoApiKey);
    expect(requests.find(({ url }) => url.includes("api.openalex.org"))!
      .headers.get("authorization")).toBe(
        `Bearer ${secrets.openAlexApiKey}`,
      );
    expect(requests.find(({ url }) => url.includes("v3.openstates.org"))!
      .headers.get("x-api-key")).toBe(secrets.openStatesApiKey);
    expect(requests.find(({ url }) => url.includes("api.regulations.gov"))!
      .url).toContain("page%5Bsize%5D=5");
  });

  it("distinguishes authentication rejection from configuration", async () => {
    const probes = await probeConfiguredSixScreenSources({
      fetch: vi.fn(async () => json({ error: "unauthorized" }, 401)),
      now: () => at,
      secrets: { congressApiKey: "[redacted-invalid-congress-test-value]" },
      cacheTtlMs: 0,
    });

    expect(probes.congress_gov).toMatchObject({
      outcome: "auth_required",
      httpStatus: 401,
    });
  });

  it("does not treat HTTP 200 or an empty provider payload as a successful probe", async () => {
    const probes = await probeConfiguredSixScreenSources({
      fetch: vi.fn(async () => json({ results: [] })),
      now: () => at,
      secrets: { govInfoApiKey: "[redacted-configured-govinfo-test-value]" },
      cacheTtlMs: 0,
    });

    expect(probes.govinfo).toMatchObject({
      outcome: "failure",
      httpStatus: 200,
    });
  });

  it("reports a safe failure stage without returning transport details or credentials", async () => {
    const secret = "[redacted-openstates-diagnostic-test-value]";
    const probes = await probeConfiguredSixScreenSources({
      fetch: vi.fn(async () => {
        throw new Error(
          `This host has no reviewed fixed official-source adapter: ${secret}`,
        );
      }),
      now: () => at,
      secrets: { openStatesApiKey: secret },
      cacheTtlMs: 0,
    });

    expect(probes.openstates).toMatchObject({
      outcome: "failure",
      httpStatus: null,
    });
    expect(probes.openstates?.note).toContain(
      "Failure stage: source-route-policy.",
    );
    expect(JSON.stringify(probes)).not.toContain(secret);
  });
});
