import { describe, expect, it, vi } from "vitest";

import { fetchScreen02OverviewDocument } from "../../src/worker/server";
import {
  SCREEN_02_DNS_JSON_ENDPOINT,
  screen02NormalizeWorkerdAddressAnswers,
  screen02PeerBoundHttpsFetch,
  screen02ProductionPeerBoundFetch,
  screen02ResolveCloudflareDnsJson,
  SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
  type Screen02AddressResolver,
  type Screen02SocketConnector,
  type Screen02TransportSocket,
} from "../../src/worker/screen02-secure-transport";

const encoder = new TextEncoder();
const TEST_GOVINFO_HEADER_VALUE = "[redacted-govinfo-test-value]";
const TEST_CONGRESS_HEADER_VALUE = "[redacted-congress-test-value]";
const TEST_REGULATIONS_HEADER_VALUE = "[redacted-regulations-test-value]";
const TEST_OPENSTATES_HEADER_VALUE = "[redacted-openstates-test-value]";
const TEST_OPENALEX_HEADER_VALUE = "[redacted-openalex-test-value]";
const TEST_STRIPPED_HEADER_VALUE = "[redacted-strip-test-value]";

function urlWithRedactedCredential(base: string, name: string) {
  const url = new URL(base);
  url.searchParams.set(name, "[redacted]");
  return url.toString();
}

function responseWire(
  status: number,
  statusText: string,
  headers: Record<string, string> = {},
  body = "",
) {
  const bodyBytes = encoder.encode(body);
  const allHeaders = {
    "content-length": String(bodyBytes.length),
    ...headers,
  };
  return encoder.encode(
    `HTTP/1.1 ${status} ${statusText}\r\n` +
    Object.entries(allHeaders).map(([name, value]) => `${name}: ${value}\r\n`)
      .join("") +
    `\r\n${body}`,
  );
}

function emptyReadable() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

function socketFixture(input: {
  peer?: string;
  tlsPeer?: string;
  response: Uint8Array;
  written: string[];
  tlsNames: string[];
  closed: string[];
}): Screen02TransportSocket {
  const secure: Screen02TransportSocket = {
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(input.response);
        controller.close();
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(value) {
        input.written.push(new TextDecoder().decode(value));
      },
    }),
    opened: Promise.resolve({ remoteAddress: input.tlsPeer }),
    startTls() {
      throw new Error("TLS must be upgraded exactly once.");
    },
    async close() {
      input.closed.push("tls");
    },
  };
  return {
    readable: emptyReadable(),
    writable: new WritableStream<Uint8Array>(),
    opened: Promise.resolve({ remoteAddress: input.peer }),
    startTls({ expectedServerHostname }) {
      input.tlsNames.push(expectedServerHostname);
      return secure;
    },
    async close() {
      input.closed.push("tcp");
    },
  };
}

function dependencies(input: {
  resolve: Screen02AddressResolver;
  responses?: Uint8Array[];
  peers?: Array<string | undefined>;
}) {
  const connections: Array<{ hostname: string; port: number }> = [];
  const options: Array<{ secureTransport: string; allowHalfOpen: boolean }> = [];
  const written: string[] = [];
  const tlsNames: string[] = [];
  const closed: string[] = [];
  const connect = vi.fn<Screen02SocketConnector>((address, socketOptions) => {
    const index = connections.length;
    connections.push(address);
    options.push(socketOptions);
    return socketFixture({
      peer: input.peers?.[index],
      tlsPeer: input.peers?.[index],
      response: input.responses?.[index] ?? responseWire(200, "OK", {}, "ok"),
      written,
      tlsNames,
      closed,
    });
  });
  return {
    dependencies: { resolve: input.resolve, connect },
    connect,
    connections,
    options,
    written,
    tlsNames,
    closed,
  };
}

describe("Screen 2 peer-bound HTTPS transport", () => {
  it("parses captured typed A/AAAA DNS-JSON responses and preserves the CNAME separately", async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, init });
      const type = url.searchParams.get("type");
      const payload = type === "A"
        ? {
            Status: 0,
            TC: false,
            RD: true,
            RA: true,
            AD: false,
            CD: false,
            Question: [{ name: "eur-lex.europa.eu", type: 1 }],
            Answer: [
              {
                name: "eur-lex.europa.eu",
                type: 5,
                TTL: 27,
                data: "eur-lex.op-tech.publications.europa.eu.",
              },
              ...["52.222.205.123", "52.222.205.55", "52.222.205.30", "52.222.205.107"]
                .map((data) => ({
                  name: "eur-lex.op-tech.publications.europa.eu",
                  type: 1,
                  TTL: 27,
                  data,
                })),
            ],
          }
        : {
            Status: 0,
            TC: false,
            RD: true,
            RA: true,
            AD: false,
            CD: false,
            Question: [{ name: "eur-lex.europa.eu", type: 28 }],
            Answer: [{
              name: "eur-lex.europa.eu",
              type: 5,
              TTL: 60,
              data: "eur-lex.op-tech.publications.europa.eu.",
            }],
          };
      return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/dns-json" },
      });
    };

    await expect(screen02ResolveCloudflareDnsJson(
      "eur-lex.europa.eu",
      fetchImpl,
    )).resolves.toEqual({
      ipv4: ["52.222.205.123", "52.222.205.55", "52.222.205.30", "52.222.205.107"],
      ipv6: [],
      aliases: ["eur-lex.op-tech.publications.europa.eu"],
    });
    expect(requests).toHaveLength(2);
    expect(requests.map(({ url }) => `${url.origin}${url.pathname}`))
      .toEqual([SCREEN_02_DNS_JSON_ENDPOINT, SCREEN_02_DNS_JSON_ENDPOINT]);
    expect(requests.map(({ url }) => url.searchParams.get("type")))
      .toEqual(["A", "AAAA"]);
    for (const { init } of requests) {
      expect(init).toMatchObject({ method: "GET", redirect: "manual", cache: "no-store" });
      expect(new Headers(init?.headers).get("accept")).toBe("application/dns-json");
    }
  });

  it("distinguishes typed DNS NODATA, NXDOMAIN, malformed, and resolver transport failures", async () => {
    const response = (status: number, questionType: number, answer?: unknown[]) =>
      new Response(JSON.stringify({
        Status: status,
        TC: false,
        Question: [{ name: "www.example.com", type: questionType }],
        ...(answer ? { Answer: answer } : {}),
      }), { headers: { "content-type": "application/dns-json" } });
    const ipv4Only: typeof fetch = async (input) => {
      const type = new URL(String(input)).searchParams.get("type");
      return type === "A"
        ? response(0, 1, [{
            name: "www.example.com",
            type: 1,
            TTL: 60,
            data: "93.184.216.34",
          }])
        : response(0, 28);
    };
    await expect(screen02ResolveCloudflareDnsJson(
      "www.example.com",
      ipv4Only,
    )).resolves.toEqual({ ipv4: ["93.184.216.34"], ipv6: [], aliases: [] });

    const nxdomain: typeof fetch = async (input) => response(
      3,
      new URL(String(input)).searchParams.get("type") === "A" ? 1 : 28,
    );
    await expect(screen02ResolveCloudflareDnsJson(
      "www.example.com",
      nxdomain,
    )).rejects.toThrow(/nonexistent hostname/i);

    const malformed: typeof fetch = async (input) => response(
      0,
      new URL(String(input)).searchParams.get("type") === "A" ? 1 : 28,
      [{ name: "unrelated.example", type: 1, TTL: 60, data: "93.184.216.34" }],
    );
    await expect(screen02ResolveCloudflareDnsJson(
      "www.example.com",
      malformed,
    )).rejects.toThrow(/malformed typed answer/i);

    await expect(screen02ResolveCloudflareDnsJson(
      "www.example.com",
      async () => { throw new Error("network unavailable"); },
    )).rejects.toThrow(/resolver transport failed/i);
  });

  it("uses native fetch only for exact reviewed official hosts and keeps generic hosts capability-failed", async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return new Response("official", { headers: { "content-type": "text/html" } });
    };
    const response = await screen02ProductionPeerBoundFetch(
      "https://www.legislation.gov.uk/ukpga/2018/12/contents/enacted",
      {
        redirect: "manual",
        headers: {
          accept: "text/html",
          "accept-language": "en",
          "accept-max-cs-size": "2097152",
          authorization: TEST_STRIPPED_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    expect(await response.text()).toBe("official");
    expect(requests).toHaveLength(1);
    expect(requests[0]!.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    const headers = new Headers(requests[0]!.init?.headers);
    expect(headers.get("user-agent")).toBe(SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT);
    expect(headers.get("accept-language")).toBe("en");
    expect(headers.get("accept-max-cs-size")).toBe("2097152");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();

    for (const locator of [
      "https://commission.europa.eu/law/law-topic/data-protection/legal-framework-eu-data-protection_en",
      "https://digital-markets-act.ec.europa.eu/about-dma_en",
    ]) {
      const reviewed = await screen02ProductionPeerBoundFetch(
        locator,
        { redirect: "manual" },
        fetchImpl,
      );
      expect(await reviewed.text()).toBe("official");
    }

    await expect(screen02ProductionPeerBoundFetch(
      "https://researcher.example/report",
      { redirect: "manual" },
      fetchImpl,
    )).rejects.toThrow(/capability is unavailable.*no reviewed fixed official-source adapter/i);
    expect(requests).toHaveLength(3);
  });

  it("permits only reviewed complementary explanation and discovery hosts without forwarding credentials", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(request), init });
      return new Response("ok");
    });
    for (const url of [
      "https://www.justice.gov/first-step-act/implementation-progress",
      "https://www.brookings.edu/articles/policy-analysis",
      "https://api.gdeltproject.org/api/v2/doc/doc?query=policy&mode=artlist&format=json&maxrecords=5",
    ]) {
      await screen02ProductionPeerBoundFetch(url, {
        redirect: "manual",
        headers: {
          authorization: TEST_STRIPPED_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
          "x-api-key": TEST_STRIPPED_HEADER_VALUE,
        },
      }, fetchImpl);
    }
    expect(requests).toHaveLength(3);
    expect(requests.every(({ init }) => {
      const headers = new Headers(init?.headers);
      return !headers.has("authorization") && !headers.has("cookie") &&
        !headers.has("x-api-key");
    })).toBe(true);
  });

  it("permits only exact credentialed GovInfo reads and bounded CFR or public-law search bodies", async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return new Response("official", {
        headers: { "content-type": "application/json" },
      });
    };
    const searchBody = JSON.stringify({
      query:
        "collection:(CFR) cfrtitlenum:18 cfrpartnum:35 cfrsectionnum:35.28 publishdate:2018-04-01",
      pageSize: "2",
      offsetMark: "*",
      historical: true,
      sorts: [{ field: "publishdate", sortOrder: "DESC" }],
    });
    await screen02ProductionPeerBoundFetch(
      "https://api.govinfo.gov/search",
      {
        method: "POST",
        body: searchBody,
        redirect: "manual",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": TEST_GOVINFO_HEADER_VALUE,
          authorization: TEST_STRIPPED_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    await screen02ProductionPeerBoundFetch(
      "https://api.govinfo.gov/packages/CFR-2018-title18-vol1/granules/CFR-2018-title18-vol1-sec35-28/xml",
      {
        method: "GET",
        redirect: "manual",
        headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
      },
      fetchImpl,
    );
    const publicLawSearchBody = JSON.stringify({
      query: 'collection:(PLAW) "Administrative Procedure Act"',
      pageSize: "10",
      offsetMark: "*",
      resultLevel: "package",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    });
    await screen02ProductionPeerBoundFetch(
      "https://api.govinfo.gov/search",
      {
        method: "POST",
        body: publicLawSearchBody,
        redirect: "manual",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": TEST_GOVINFO_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    await screen02ProductionPeerBoundFetch(
      "https://api.govinfo.gov/search",
      {
        method: "POST",
        body: publicLawSearchBody.replace('"offsetMark":"*"',
          '"offsetMark":"SAFE12345678"'),
        redirect: "manual",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": TEST_GOVINFO_HEADER_VALUE,
        },
      }, fetchImpl,
    );
    expect(requests).toHaveLength(4);
    expect(requests[0]!.init).toMatchObject({
      method: "POST",
      body: searchBody,
      redirect: "manual",
      cache: "no-store",
    });
    const searchHeaders = new Headers(requests[0]!.init?.headers);
    expect(searchHeaders.get("x-api-key")).toBe(TEST_GOVINFO_HEADER_VALUE);
    expect(searchHeaders.get("content-type")).toBe("application/json");
    expect(searchHeaders.get("authorization")).toBeNull();
    expect(searchHeaders.get("cookie")).toBeNull();
    expect(requests[2]!.init).toMatchObject({
      method: "POST",
      body: publicLawSearchBody,
      redirect: "manual",
      cache: "no-store",
    });

    for (const [url, init] of [
      [
        "https://api.govinfo.gov/search",
        {
          method: "POST",
          body: JSON.stringify({ query: "collection:(CFR)" }),
          headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
        },
      ],
      [
        "https://api.govinfo.gov/search",
        {
          method: "POST",
          body: JSON.stringify({
            query: 'collection:(PLAW) "Act\" collection:(BILLS)"',
            pageSize: "10",
            offsetMark: "*",
            resultLevel: "package",
            sorts: [{ field: "score", sortOrder: "DESC" }],
          }),
          headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
        },
      ],
      [
        "https://api.govinfo.gov/search",
        {
          method: "POST",
          body: publicLawSearchBody.replace('"offsetMark":"*"',
            '"offsetMark":"unsafe cursor&api_key=exposed"'),
          headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
        },
      ],
      [
        "https://api.govinfo.gov/collections",
        { method: "GET", headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE } },
      ],
      [
        urlWithRedactedCredential(
          "https://api.govinfo.gov/packages/CFR-2018-title18-vol1/granules/CFR-2018-title18-vol1-sec35-28/xml",
          "api_key",
        ),
        { method: "GET", headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE } },
      ],
      [
        "https://api.govinfo.gov/packages/CFR-2018-title18-vol1/granules/CFR-2018-title18-vol1-sec35-28/xml",
        { method: "GET" },
      ],
    ] as const) {
      await expect(screen02ProductionPeerBoundFetch(url, init, fetchImpl))
        .rejects.toThrow(/exact credentialed GovInfo/i);
    }
    expect(requests).toHaveLength(4);
  });

  it("SRC4-02 permits only a valid public-law publication window with a bounded cursor", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", {
      headers: { "content-type": "application/json" },
    }));
    const body = (range: string) => JSON.stringify({
      query: `collection:(PLAW) publishdate:range(${range}) "consumer data"`,
      pageSize: "10", offsetMark: "SAFE12345678",
      resultLevel: "package",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    });
    await screen02ProductionPeerBoundFetch("https://api.govinfo.gov/search", {
      method: "POST", body: body("2018-01-01,2025-12-31"),
      headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
    }, fetchImpl);
    for (const bad of ["2025-12-31,2018-01-01",
      "2018-01-01,2025-12-31) collection:(BILLS"] as const) {
      await expect(screen02ProductionPeerBoundFetch(
        "https://api.govinfo.gov/search", {
          method: "POST", body: body(bad),
          headers: { "x-api-key": TEST_GOVINFO_HEADER_VALUE },
        }, fetchImpl,
      )).rejects.toThrow(/exact credentialed GovInfo/iu);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("forwards credentials only on exact reviewed Congress.gov, Regulations.gov, and OpenAlex routes", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(request), init });
      return new Response("{}", { headers: { "content-type": "application/json" } });
    });
    await screen02ProductionPeerBoundFetch(
      "https://api.congress.gov/v3/law/118/pub/42?format=json",
      {
        method: "GET",
        redirect: "manual",
        headers: {
          "x-api-key": TEST_CONGRESS_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    await screen02ProductionPeerBoundFetch(
      "https://api.congress.gov/v3/bill/118/hr/1234/summaries?format=json",
      {
        method: "GET",
        redirect: "manual",
        headers: {
          "x-api-key": TEST_CONGRESS_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    await screen02ProductionPeerBoundFetch(
      "https://api.regulations.gov/v4/documents?filter%5BsearchTerm%5D=2019-24931&page%5Bsize%5D=5&sort=-postedDate",
      {
        method: "GET",
        redirect: "manual",
        headers: {
          "x-api-key": TEST_REGULATIONS_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    const openAlex = new URL("https://api.openalex.org/works");
    openAlex.searchParams.set("search", "policy implementation evidence");
    openAlex.searchParams.set("per_page", "5");
    openAlex.searchParams.set("select", [
      "id", "doi", "display_name", "authorships", "publication_year",
      "publication_date", "primary_location", "best_oa_location", "type",
      "language", "is_retracted", "abstract_inverted_index", "content_urls",
    ].join(","));
    await screen02ProductionPeerBoundFetch(
      openAlex,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          authorization: `Bearer ${TEST_OPENALEX_HEADER_VALUE}`,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    await screen02ProductionPeerBoundFetch(
      openAlex,
      { method: "GET", redirect: "manual" },
      fetchImpl,
    );

    expect(requests).toHaveLength(5);
    const [congress, congressSummary, regulations, openalex, anonymousOpenalex] = requests.map(({ init }) =>
      new Headers(init?.headers));
    expect(congress!.get("x-api-key")).toBe(TEST_CONGRESS_HEADER_VALUE);
    expect(congressSummary!.get("x-api-key")).toBe(TEST_CONGRESS_HEADER_VALUE);
    expect(regulations!.get("x-api-key")).toBe(TEST_REGULATIONS_HEADER_VALUE);
    expect(openalex!.get("authorization")).toBe(
      `Bearer ${TEST_OPENALEX_HEADER_VALUE}`,
    );
    expect(anonymousOpenalex!.get("authorization")).toBeNull();
    expect([congress, congressSummary, regulations, openalex, anonymousOpenalex].every((headers) =>
      !headers!.has("cookie"))).toBe(true);

    for (const [url, init] of [
      [
        "https://api.congress.gov/v3/bill?query=Sarbanes-Oxley&format=json",
        { method: "GET", headers: { "x-api-key": TEST_CONGRESS_HEADER_VALUE } },
      ],
      [
        "https://api.congress.gov/v3/bill/118/hr/1234/summaries?format=xml",
        { method: "GET", headers: { "x-api-key": TEST_CONGRESS_HEADER_VALUE } },
      ],
      [
        "https://api.regulations.gov/v4/comments",
        { method: "GET", headers: { "x-api-key": TEST_REGULATIONS_HEADER_VALUE } },
      ],
      [
        "https://api.openalex.org/works?search=policy&per_page=50",
        { method: "GET", headers: { authorization: TEST_STRIPPED_HEADER_VALUE } },
      ],
      [
        openAlex.toString(),
        { method: "GET", headers: { authorization: "Basic [redacted]" } },
      ],
    ] as const) {
      await expect(screen02ProductionPeerBoundFetch(url, init, fetchImpl))
        .rejects.toThrow(/exact bounded/iu);
    }
    expect(requests).toHaveLength(5);
  });

  it("forwards the Open States key only on the bounded jurisdiction probe and bill search", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(request), init });
      return new Response('{"results":[]}', {
        headers: { "content-type": "application/json" },
      });
    });
    await screen02ProductionPeerBoundFetch(
      "https://v3.openstates.org/jurisdictions?classification=state&per_page=1",
      {
        method: "GET",
        redirect: "manual",
        headers: {
          "x-api-key": TEST_OPENSTATES_HEADER_VALUE,
          cookie: TEST_STRIPPED_HEADER_VALUE,
        },
      },
      fetchImpl,
    );
    const bills = new URL("https://v3.openstates.org/bills");
    bills.searchParams.set("identifiers", "AB 5");
    bills.searchParams.set("jurisdiction", "California");
    for (const include of ["abstracts", "other_titles", "other_identifiers",
      "actions", "sources", "documents", "versions"]) {
      bills.searchParams.append("include", include);
    }
    bills.searchParams.set("sort", "latest_action_desc");
    bills.searchParams.set("page", "1");
    bills.searchParams.set("per_page", "6");
    await screen02ProductionPeerBoundFetch(bills, {
      method: "GET",
      redirect: "manual",
      headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE },
    }, fetchImpl);
    bills.searchParams.set("page", "2");
    await screen02ProductionPeerBoundFetch(bills, {
      method: "GET",
      redirect: "manual",
      headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE },
    }, fetchImpl);

    expect(requests).toHaveLength(3);
    expect(requests.every(({ init }) => {
      const headers = new Headers(init?.headers);
      return headers.get("x-api-key") === TEST_OPENSTATES_HEADER_VALUE &&
        !headers.has("cookie");
    })).toBe(true);

    for (const [url, init] of [
      [
        "https://v3.openstates.org/jurisdictions?classification=country&per_page=1",
        { method: "GET", headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE } },
      ],
      [
        "https://v3.openstates.org/bills?identifiers=AB+5&jurisdiction=California&per_page=50",
        { method: "GET", headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE } },
      ],
      [
        bills.toString().replace("page=2", "page=4"),
        { method: "GET", headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE } },
      ],
      [
        urlWithRedactedCredential(
          "https://v3.openstates.org/jurisdictions?classification=state&per_page=1",
          "apikey",
        ),
        { method: "GET", headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE } },
      ],
      [
        "https://v3.openstates.org/people?jurisdiction=California",
        { method: "GET", headers: { "x-api-key": TEST_OPENSTATES_HEADER_VALUE } },
      ],
      [
        "https://v3.openstates.org/jurisdictions?classification=state&per_page=1",
        { method: "GET" },
      ],
    ] as const) {
      await expect(screen02ProductionPeerBoundFetch(url, init, fetchImpl))
        .rejects.toThrow(/exact credentialed.*Open States/iu);
    }
    expect(requests).toHaveLength(3);
  });

  it("writes HTTP only after a public answer and matching observed peer", async () => {
    const resolve = vi.fn<Screen02AddressResolver>(async () => ({
      ipv4: ["93.184.216.34"],
      ipv6: ["2606:2800:220:1:248:1893:25c8:1946"],
    }));
    const fixture = dependencies({
      resolve,
      peers: ["93.184.216.34:443"],
      responses: [responseWire(200, "OK", {
        "content-type": "text/plain",
      }, "public result")],
    });

    const response = await screen02PeerBoundHttpsFetch(
      "https://example.com/report?q=one",
      { redirect: "manual", headers: { accept: "text/plain" } },
      fixture.dependencies,
    );

    expect(await response.text()).toBe("public result");
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith("example.com");
    expect(fixture.connections).toEqual([
      { hostname: "93.184.216.34", port: 443 },
    ]);
    expect(fixture.options).toEqual([
      { secureTransport: "starttls", allowHalfOpen: false },
    ]);
    expect(fixture.tlsNames).toEqual(["example.com"]);
    expect(fixture.written).toHaveLength(1);
    expect(fixture.written[0]).toContain("GET /report?q=one HTTP/1.1\r\n");
    expect(fixture.written[0]).toContain("host: example.com\r\n");
    expect(fixture.written[0]).toContain("accept-encoding: identity\r\n");
  });

  it("treats a canonical public IPv4 URL literal as its complete address set", async () => {
    const resolve = vi.fn<Screen02AddressResolver>();
    const fixture = dependencies({
      resolve,
      peers: ["8.8.8.8:443"],
      responses: [responseWire(200, "OK", {
        "content-type": "text/plain",
      }, "literal result")],
    });

    const response = await screen02PeerBoundHttpsFetch(
      "https://8.8.8.8/report",
      { redirect: "manual" },
      fixture.dependencies,
    );

    expect(await response.text()).toBe("literal result");
    expect(resolve).not.toHaveBeenCalled();
    expect(fixture.connections).toEqual([{ hostname: "8.8.8.8", port: 443 }]);
    expect(fixture.tlsNames).toEqual(["8.8.8.8"]);
  });

  it("supports a public IPv6-only resolved peer", async () => {
    const address = "2606:2800:0220:0001:0248:1893:25c8:1946";
    const fixture = dependencies({
      resolve: async () => ({ ipv4: [], ipv6: [address] }),
      peers: [`[${address}]:443`],
      responses: [responseWire(200, "OK", {
        "content-type": "text/plain",
      }, "ipv6 result")],
    });

    const response = await screen02PeerBoundHttpsFetch(
      "https://example.com/report",
      { redirect: "manual" },
      fixture.dependencies,
    );

    expect(await response.text()).toBe("ipv6 result");
    expect(fixture.connections).toEqual([{ hostname: address, port: 443 }]);
    expect(fixture.tlsNames).toEqual(["example.com"]);
  });

  it("normalizes the captured workerd address-answer shape without treating a CNAME as an address", () => {
    expect(screen02NormalizeWorkerdAddressAnswers([
      "edge.example.net.",
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ])).toEqual({
      ipv4: ["93.184.216.34"],
      ipv6: ["2606:2800:220:1:248:1893:25c8:1946"],
      aliases: ["edge.example.net"],
    });
    expect(screen02NormalizeWorkerdAddressAnswers([
      { address: "93.184.216.34" },
    ])).toEqual({
      ipv4: ["93.184.216.34"],
      ipv6: [],
      aliases: [],
    });
  });

  it("follows a bounded typed CNAME and validates the alias address before opening a socket", async () => {
    const resolve = vi.fn<Screen02AddressResolver>(async (hostname) =>
      hostname === "www.example.com"
        ? { ipv4: [], ipv6: [], aliases: ["edge.example.net."] }
        : { ipv4: ["93.184.216.34"], ipv6: [], aliases: [] });
    const fixture = dependencies({
      resolve,
      peers: ["93.184.216.34"],
    });

    await screen02PeerBoundHttpsFetch(
      "https://www.example.com/report",
      { redirect: "manual" },
      fixture.dependencies,
    );

    expect(resolve.mock.calls.map(([hostname]) => hostname)).toEqual([
      "www.example.com",
      "edge.example.net",
    ]);
    expect(fixture.connections).toEqual([
      { hostname: "93.184.216.34", port: 443 },
    ]);
    // TLS continues to authenticate the original HTTP origin, never the DNS
    // alias or selected address literal.
    expect(fixture.tlsNames).toEqual(["www.example.com"]);
  });

  it("rejects alias loops, malformed aliases, and unsafe alias answers before opening a socket", async () => {
    const cases: Array<Screen02AddressResolver> = [
      async (hostname) => ({
        ipv4: [],
        ipv6: [],
        aliases: [hostname === "www.example.com" ? "edge.example.net" : "www.example.com"],
      }),
      async () => ({ ipv4: [], ipv6: [], aliases: ["127.0.0.1"] }),
      async (hostname) => hostname === "www.example.com"
        ? { ipv4: [], ipv6: [], aliases: ["edge.example.net"] }
        : { ipv4: ["10.0.0.8"], ipv6: [], aliases: [] },
    ];
    for (const resolve of cases) {
      const fixture = dependencies({ resolve });
      await expect(screen02PeerBoundHttpsFetch(
        "https://www.example.com/report",
        { redirect: "manual" },
        fixture.dependencies,
      )).rejects.toThrow(/alias loop|malformed alias|private|special-use/i);
      expect(fixture.connect).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["mixed public/private", { ipv4: ["93.184.216.34", "127.0.0.1"], ipv6: [] }],
    ["current-network IPv4", { ipv4: ["0.1.2.3"], ipv6: [] }],
    ["private 10/8 IPv4", { ipv4: ["10.1.2.3"], ipv6: [] }],
    ["shared-space IPv4", { ipv4: ["100.64.0.1"], ipv6: [] }],
    ["loopback IPv4", { ipv4: ["127.0.0.1"], ipv6: [] }],
    ["link-local IPv4", { ipv4: ["169.254.1.1"], ipv6: [] }],
    ["private 172/12 IPv4", { ipv4: ["172.31.255.254"], ipv6: [] }],
    ["IETF protocol IPv4", { ipv4: ["192.0.0.1"], ipv6: [] }],
    ["AS112 IPv4", { ipv4: ["192.31.196.1"], ipv6: [] }],
    ["AMT IPv4", { ipv4: ["192.52.193.1"], ipv6: [] }],
    ["deprecated relay IPv4", { ipv4: ["192.88.99.1"], ipv6: [] }],
    ["private 192/16 IPv4", { ipv4: ["192.168.1.1"], ipv6: [] }],
    ["direct-delegation IPv4", { ipv4: ["192.175.48.1"], ipv6: [] }],
    ["benchmark IPv4", { ipv4: ["198.18.0.1"], ipv6: [] }],
    ["documentation 198 IPv4", { ipv4: ["198.51.100.1"], ipv6: [] }],
    ["shared anycast IPv4", { ipv4: ["198.97.38.1"], ipv6: [] }],
    ["documentation 203 IPv4", { ipv4: ["203.0.113.1"], ipv6: [] }],
    ["multicast IPv4", { ipv4: ["224.0.0.1"], ipv6: [] }],
    ["reserved IPv4", { ipv4: ["240.0.0.1"], ipv6: [] }],
    ["private IPv6", { ipv4: [], ipv6: ["fd00::1"] }],
    ["mapped IPv4", { ipv4: [], ipv6: ["::ffff:127.0.0.1"] }],
    ["loopback IPv6", { ipv4: [], ipv6: ["::1"] }],
    ["link-local IPv6", { ipv4: [], ipv6: ["fe80::1"] }],
    ["IETF protocol IPv6", { ipv4: [], ipv6: ["2001:2::1"] }],
    ["documentation IPv6", { ipv4: [], ipv6: ["2001:db8::1"] }],
    ["deprecated 6to4 IPv6", { ipv4: [], ipv6: ["2002:c000:0201::1"] }],
    ["documentation IPv4", { ipv4: ["192.0.2.2"], ipv6: [] }],
    ["empty", { ipv4: [], ipv6: [] }],
  ])("rejects a %s DNS answer set before opening a socket", async (
    _label,
    answers,
  ) => {
    const fixture = dependencies({ resolve: async () => answers });
    await expect(screen02PeerBoundHttpsFetch(
      "https://example.com/report",
      { redirect: "manual" },
      fixture.dependencies,
    )).rejects.toThrow(/DNS answer|private|special-use/i);
    expect(fixture.connect).not.toHaveBeenCalled();
  });

  it("fails closed on resolver errors before opening a socket", async () => {
    const fixture = dependencies({
      resolve: async () => {
        throw new Error("SERVFAIL");
      },
    });
    await expect(screen02PeerBoundHttpsFetch(
      "https://example.com/report",
      { redirect: "manual" },
      fixture.dependencies,
    )).rejects.toThrow(/DNS resolver failed/i);
    expect(fixture.connect).not.toHaveBeenCalled();
  });

  it("honors abort while DNS resolution is pending", async () => {
    const controller = new AbortController();
    const fixture = dependencies({
      resolve: () => new Promise<never>(() => undefined),
    });
    const request = screen02PeerBoundHttpsFetch(
      "https://example.com/report",
      { redirect: "manual", signal: controller.signal },
      fixture.dependencies,
    );
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fixture.connect).not.toHaveBeenCalled();
  });

  it.each([undefined, "93.184.216.35", "[2606:2800:220:1::1]:443"])(
    "rejects a missing or mismatched peer before TLS or HTTP: %s",
    async (peer) => {
      const fixture = dependencies({
        resolve: async () => ({ ipv4: ["93.184.216.34"], ipv6: [] }),
        peers: [peer],
      });
      await expect(screen02PeerBoundHttpsFetch(
        "https://example.com/report",
        { redirect: "manual" },
        fixture.dependencies,
      )).rejects.toThrow(/observed peer matched/i);
      expect(fixture.tlsNames).toEqual([]);
      expect(fixture.written).toEqual([]);
      expect(fixture.closed).toEqual(["tcp"]);
    },
  );

  it("re-resolves a validated redirect and rejects a private second-hop answer", async () => {
    const initial =
      "https://www.ftc.gov/news-events/news/press-releases/2018/08/example-action";
    const redirected =
      "https://ftc.gov/news-events/news/press-releases/2018/08/example-action";
    const resolve = vi.fn<Screen02AddressResolver>(async (hostname) =>
      hostname === "www.ftc.gov"
        ? { ipv4: ["93.184.216.34"], ipv6: [] }
        : { ipv4: ["10.0.0.9"], ipv6: [] });
    const fixture = dependencies({
      resolve,
      peers: ["93.184.216.34"],
      responses: [responseWire(301, "Moved Permanently", {
        location: redirected,
      })],
    });
    const fetchImpl = (request: RequestInfo | URL, init?: RequestInit) =>
      screen02PeerBoundHttpsFetch(request, init, fixture.dependencies);

    await expect(fetchScreen02OverviewDocument(fetchImpl, initial)).rejects
      .toThrow(/private or special-use DNS answer/i);
    expect(resolve.mock.calls.map(([hostname]) => hostname)).toEqual([
      "www.ftc.gov",
      "ftc.gov",
    ]);
    expect(fixture.connect).toHaveBeenCalledOnce();
    expect(fixture.written).toHaveLength(1);
  });

  it("rejects ambiguous HTTP framing and closes the TLS socket", async () => {
    const ambiguous = encoder.encode(
      "HTTP/1.1 200 OK\r\ncontent-length: 0\r\ntransfer-encoding: chunked\r\n\r\n0\r\n\r\n",
    );
    const fixture = dependencies({
      resolve: async () => ({ ipv4: ["93.184.216.34"], ipv6: [] }),
      peers: ["93.184.216.34"],
      responses: [ambiguous],
    });
    await expect(screen02PeerBoundHttpsFetch(
      "https://example.com/report",
      { redirect: "manual" },
      fixture.dependencies,
    )).rejects.toThrow(/conflicting transfer and content lengths/i);
    expect(fixture.closed).toEqual(["tls"]);
  });
});
