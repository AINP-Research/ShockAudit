/**
 * Screen 2 official-source transport and an injected peer-binding test seam.
 *
 * The normal Fetch API does not expose the connected peer address, so it
 * cannot prove that the address validated before a request is the address
 * actually used by the transport. This module resolves every request hop,
 * validates the complete A/AAAA answer set, connects to one validated literal
 * address, observes that socket's peer, and only then starts TLS for the
 * original hostname and writes the HTTP request.
 *
 * The injected socket seam below describes the guarantee that would be needed
 * for generic destinations. Current Workers sockets cannot supply that
 * guarantee, so production does not call it; production is restricted to the
 * exact reviewed fixed-source adapter at the end of this module.
 */

import { readScreen02BoundedResponseText } from "./screen02-bounded-response";

export type Screen02ResolvedAddresses = {
  ipv4: readonly string[];
  ipv6: readonly string[];
  /**
   * Typed CNAME targets returned by the resolver. The transport, rather than
   * the resolver implementation, follows these names so alias depth, loops,
   * aborts, and the complete public-address set remain fail-closed.
   */
  aliases?: readonly string[];
};

export type Screen02AddressResolver = (
  hostname: string,
  signal?: AbortSignal,
) => Promise<Screen02ResolvedAddresses>;

export type Screen02SocketInfo = {
  remoteAddress?: string;
};

export type Screen02TransportSocket = {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  readonly opened: Promise<Screen02SocketInfo>;
  startTls(options: { expectedServerHostname: string }): Screen02TransportSocket;
  close(): Promise<void>;
};

export type Screen02SocketConnector = (
  address: { hostname: string; port: number },
  options: { secureTransport: "starttls"; allowHalfOpen: boolean },
) => Screen02TransportSocket;

export type Screen02SecureTransportDependencies = {
  resolve: Screen02AddressResolver;
  connect: Screen02SocketConnector;
};

const MAXIMUM_RESPONSE_HEADER_BYTES = 128 * 1024;
const MAXIMUM_RESPONSE_BODY_BYTES = 2 * 1024 * 1024;
const MAXIMUM_RESPONSE_WIRE_BYTES =
  MAXIMUM_RESPONSE_HEADER_BYTES + MAXIMUM_RESPONSE_BODY_BYTES + 64 * 1024;
const MAXIMUM_DNS_ALIAS_HOPS = 8;
const MAXIMUM_DNS_JSON_BYTES = 64 * 1024;
export const SCREEN_02_DNS_JSON_ENDPOINT =
  "https://cloudflare-dns.com/dns-query";
export const SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT =
  "ShockAudit research-design tool (+https://shockaudit.ainp-research.workers.dev/)";

export const SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS = [
  "crsreports.congress.gov",
  "home.treasury.gov",
  "www.cms.gov",
  "www.commerce.gov",
  "www.consumerfinance.gov",
  "www.dhs.gov",
  "www.dol.gov",
  "www.eeoc.gov",
  "www.energy.gov",
  "www.epa.gov",
  "www.fda.gov",
  "www.hhs.gov",
  "www.justice.gov",
  "www.loc.gov",
  "www.transportation.gov",
  "www.treasury.gov",
  "www.whitehouse.gov",
] as const;

export const SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS = [
  "americanbar.org",
  "apnews.com",
  "brookings.edu",
  "hls.harvard.edu",
  "law.stanford.edu",
  "lawfaremedia.org",
  "rand.org",
  "reuters.com",
  "www.americanbar.org",
  "www.apnews.com",
  "www.bbc.com",
  "www.brookings.edu",
  "www.lawfaremedia.org",
  "www.rand.org",
  "www.reuters.com",
] as const;

/**
 * Exact publishers already reviewed by the source catalog or the bounded
 * Screen 3 document adapters. Generic researcher-chosen hosts are excluded:
 * the current Workers socket API cannot independently attest the connected
 * peer and cannot set SNI when startTLS follows a connection to an IP literal.
 */
const SCREEN_02_FIXED_OFFICIAL_FETCH_HOSTS = new Set([
  ...SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS,
  ...SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS,
  "api.congress.gov",
  "api.crossref.org",
  "api.gdeltproject.org",
  "api.govinfo.gov",
  "api.openalex.org",
  "v3.openstates.org",
  "api.regulations.gov",
  "apnews.com",
  "americanbar.org",
  "boe.es",
  "climate.ec.europa.eu",
  "commission.europa.eu",
  "congress.gov",
  "brookings.edu",
  "diariodarepublica.pt",
  "digital-markets-act.ec.europa.eu",
  "dre.pt",
  "earthquake.usgs.gov",
  "elaw.klri.re.kr",
  "elaws.e-gov.go.jp",
  "eur-lex.europa.eu",
  "federalregister.gov",
  "fema.gov",
  "ftc.gov",
  "gdacs.org",
  "gesetze-im-internet.de",
  "govinfo.gov",
  "hls.harvard.edu",
  "indiacode.nic.in",
  "irishstatutebook.ie",
  "japaneselawtranslation.go.jp",
  "laws-lois.justice.gc.ca",
  "law.stanford.edu",
  "lawfaremedia.org",
  "leg.colorado.gov",
  "le.utah.gov",
  "legacylis.virginia.gov",
  "legislation.gov.uk",
  "leginfo.legislature.ca.gov",
  "legifrance.gouv.fr",
  "oag.ca.gov",
  "publications.europa.eu",
  "rand.org",
  "reuters.com",
  "vig.cdn.sos.ca.gov",
  "www.boe.es",
  "www.americanbar.org",
  "www.bbc.com",
  "www.brookings.edu",
  "www.cga.ct.gov",
  "www.congress.gov",
  "www.dre.pt",
  "www.federalregister.gov",
  "www.fema.gov",
  "www.ftc.gov",
  "www.gdacs.org",
  "www.gesetze-im-internet.de",
  "www.govinfo.gov",
  "www.indiacode.nic.in",
  "www.irishstatutebook.ie",
  "www.irs.gov",
  "www.japaneselawtranslation.go.jp",
  "www.legifrance.gouv.fr",
  "www.legislation.gov.uk",
  "www.lawfaremedia.org",
  "www.nhc.noaa.gov",
  "www.oag.ca.gov",
  "www.rand.org",
  "www.sec.gov",
  "www.sos.ca.gov",
  "www.reuters.com",
]);

const GOVINFO_API_HOST = "api.govinfo.gov";
const CONGRESS_API_HOST = "api.congress.gov";
const REGULATIONS_API_HOST = "api.regulations.gov";
const OPENSTATES_API_HOST = "v3.openstates.org";
const OPENALEX_API_HOST = "api.openalex.org";
const GOVINFO_SEARCH_REQUEST_MAX_BYTES = 4 * 1024;

function validBoundedCredential(value: string | null) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validBearerCredential(value: string | null) {
  return value?.startsWith("Bearer ") === true &&
    validBoundedCredential(value.slice("Bearer ".length));
}

function exactCongressApiRequest(url: URL, method: string, body: BodyInit | null | undefined) {
  if (method !== "GET" || body || url.hash) return false;
  if ([...url.searchParams.keys()].some((name) => name !== "format")) {
    return false;
  }
  if (url.searchParams.get("format") !== "json") return false;
  return /^\/v3\/law\/\d{1,3}\/(?:pub|priv)\/\d{1,4}$/u.test(url.pathname) ||
    /^\/v3\/bill\/\d{1,3}\/(?:hr|s|hjres|sjres)\/\d{1,6}\/(?:text|summaries)$/u
      .test(url.pathname);
}

function exactRegulationsApiRequest(
  url: URL,
  method: string,
  body: BodyInit | null | undefined,
) {
  if (method !== "GET" || body || url.hash) return false;
  if (/^\/v4\/(?:documents|dockets)\/[A-Za-z0-9._-]{3,100}$/u.test(url.pathname)) {
    return !url.search;
  }
  if (!/^\/v4\/(?:documents|dockets)$/u.test(url.pathname)) return false;
  const allowed = new Set(["filter[searchTerm]", "page[size]", "sort"]);
  if ([...url.searchParams.keys()].some((name) => !allowed.has(name))) return false;
  const term = url.searchParams.get("filter[searchTerm]") ?? "";
  const size = url.searchParams.get("page[size]") ?? "";
  const sort = url.searchParams.get("sort");
  return term.length >= 2 && term.length <= 300 &&
    !/[\u0000-\u001f\u007f]/u.test(term) && size === "5" &&
    (sort === null || ["postedDate", "-postedDate"].includes(sort));
}

const OPENSTATES_BILL_INCLUDES = new Set([
  "abstracts",
  "actions",
  "documents",
  "other_identifiers",
  "other_titles",
  "sources",
  "versions",
]);

function exactOpenStatesApiRequest(
  url: URL,
  method: string,
  body: BodyInit | null | undefined,
) {
  if (method !== "GET" || body || url.hash) return false;
  if (url.pathname === "/jurisdictions") {
    return [...url.searchParams.keys()].every((name) =>
      name === "classification" || name === "per_page"
    ) &&
      url.searchParams.getAll("classification").length === 1 &&
      url.searchParams.get("classification") === "state" &&
      url.searchParams.getAll("per_page").length === 1 &&
      url.searchParams.get("per_page") === "1";
  }
  if (url.pathname !== "/bills") return false;
  const scalarNames = [
    "q", "identifiers", "jurisdiction", "sort", "page", "per_page",
  ];
  const allowedNames = new Set([...scalarNames, "include"]);
  if ([...url.searchParams.keys()].some((name) => !allowedNames.has(name)) ||
      scalarNames.some((name) => url.searchParams.getAll(name).length > 1)) {
    return false;
  }
  const query = url.searchParams.get("q");
  const identifier = url.searchParams.get("identifiers");
  if (Boolean(query) === Boolean(identifier)) return false;
  if (query && (query.length > 240 || /[\u0000-\u001f\u007f]/u.test(query))) {
    return false;
  }
  if (identifier &&
      !/^(?:A|AB|ACR|AJR|AR|H|HB|HCR|HF|HJR|HR|S|SB|SCR|SF|SJR|SR|LB|LD) \d+[A-Z]?$/iu
        .test(identifier)) return false;
  const jurisdiction = url.searchParams.get("jurisdiction");
  if (jurisdiction &&
      (jurisdiction.length > 120 || /[\u0000-\u001f\u007f]/u.test(jurisdiction))) {
    return false;
  }
  const includes = url.searchParams.getAll("include");
  if (includes.length !== OPENSTATES_BILL_INCLUDES.size ||
      new Set(includes).size !== includes.length ||
      includes.some((value) => !OPENSTATES_BILL_INCLUDES.has(value))) {
    return false;
  }
  return ["latest_action_desc", "updated_desc"].includes(
    url.searchParams.get("sort") ?? "",
  ) && /^(?:1|2|3)$/u.test(url.searchParams.get("page") ?? "") &&
    /^(?:[1-9]|10)$/u.test(url.searchParams.get("per_page") ?? "");
}

const OPENALEX_SELECTED_FIELDS = [
  "id", "doi", "display_name", "authorships", "publication_year",
  "publication_date", "primary_location", "best_oa_location", "type",
  "language", "is_retracted", "abstract_inverted_index", "content_urls",
].join(",");

function exactOpenAlexApiRequest(
  url: URL,
  method: string,
  body: BodyInit | null | undefined,
) {
  if (method !== "GET" || body || url.hash || url.pathname !== "/works") {
    return false;
  }
  const allowed = new Set(["search", "per_page", "select"]);
  if ([...url.searchParams.keys()].some((name) => !allowed.has(name))) return false;
  const search = url.searchParams.get("search") ?? "";
  return search.length >= 1 && search.length <= 600 &&
    !/[\u0000-\u001f\u007f]/u.test(search) &&
    /^[1-5]$/u.test(url.searchParams.get("per_page") ?? "") &&
    url.searchParams.get("select") === OPENALEX_SELECTED_FIELDS;
}

function exactGovInfoReadPath(pathname: string) {
  if (/^\/packages\/PLAW-\d{1,3}(?:publ|priv)\d{1,4}\/(?:summary|htm)$/u
      .test(pathname)) return true;
  const match = /^\/packages\/([^/]+)\/granules\/([^/]+)\/(summary|htm|xml)$/u
    .exec(pathname);
  if (!match) return false;
  const [, packageId, granuleId, representation] = match;
  if (
    /^FR-\d{4}-\d{2}-\d{2}$/u.test(packageId!) &&
    /^\d{4}-\d{4,6}$/u.test(granuleId!)
  ) return representation === "summary" || representation === "htm";
  const cfrPackage = /^CFR-\d{4}-title(?:[1-9]|[1-4]\d|50)-vol[1-9]\d*$/u;
  return cfrPackage.test(packageId!) &&
    granuleId!.startsWith(`${packageId}-sec`) &&
    /^CFR-\d{4}-title(?:[1-9]|[1-4]\d|50)-vol[1-9]\d*-sec\d{1,4}-\d+[a-z0-9-]*$/iu
      .test(granuleId!) && representation === "xml";
}

function exactGovInfoHistoricalSearchBody(value: BodyInit | null | undefined) {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > GOVINFO_SEARCH_REQUEST_MAX_BYTES
  ) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false;
  }
  const body = parsed as Record<string, unknown>;
  if (
    Object.keys(body).sort().join(",") !==
      "historical,offsetMark,pageSize,query,sorts" ||
    body.pageSize !== "2" || body.offsetMark !== "*" ||
    body.historical !== true || !Array.isArray(body.sorts) ||
    body.sorts.length !== 1
  ) return false;
  const sort = body.sorts[0];
  if (
    typeof sort !== "object" || sort === null || Array.isArray(sort) ||
    Object.keys(sort).sort().join(",") !== "field,sortOrder" ||
    (sort as Record<string, unknown>).field !== "publishdate" ||
    (sort as Record<string, unknown>).sortOrder !== "DESC"
  ) return false;
  if (typeof body.query !== "string") return false;
  const query = /^collection:\(CFR\) cfrtitlenum:(?:[1-9]|[1-4]\d|50) cfrpartnum:(\d{1,4}) cfrsectionnum:(\d{1,4})\.\d+[a-z0-9-]* publishdate:\d{4}-\d{2}-\d{2}$/iu
    .exec(body.query);
  return Boolean(query && query[1] === query[2] && Number(query[1]) >= 1);
}

function exactGovInfoPublicLawSearchBody(value: BodyInit | null | undefined) {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > GOVINFO_SEARCH_REQUEST_MAX_BYTES
  ) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false;
  }
  const body = parsed as Record<string, unknown>;
  if (
    Object.keys(body).sort().join(",") !==
      "offsetMark,pageSize,query,resultLevel,sorts" ||
    body.pageSize !== "10" ||
    (body.offsetMark !== "*" &&
      (typeof body.offsetMark !== "string" ||
        !/^[A-Za-z0-9+/_-]{8,256}={0,2}$/u.test(body.offsetMark))) ||
    body.resultLevel !== "package" || !Array.isArray(body.sorts) ||
    body.sorts.length !== 1
  ) return false;
  const sort = body.sorts[0];
  if (
    typeof sort !== "object" || sort === null || Array.isArray(sort) ||
    Object.keys(sort).sort().join(",") !== "field,sortOrder" ||
    (sort as Record<string, unknown>).field !== "score" ||
    (sort as Record<string, unknown>).sortOrder !== "DESC"
  ) return false;
  if (typeof body.query !== "string" || body.query.length > 340) return false;
  // The optional native publication window is used by Screen 4; Screen 1's
  // older name search remains within the same exact public-law allowlist.
  const match = /^collection:\(PLAW\) (?:publishdate:range\((\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\) )?"([\s\S]+)"$/u
    .exec(body.query);
  return Boolean(
    match && (!match[1] || match[1] <= match[2]!) &&
    match[3]!.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(match[3]!) &&
    !/\bcollection\s*:/iu.test(match[3]!),
  );
}

class Screen02DnsResolutionError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "alias-limit"
      | "alias-loop"
      | "malformed-answer"
      | "no-address"
      | "not-found"
      | "resolver-failure",
  ) {
    super(message);
    this.name = "Screen02DnsResolutionError";
  }
}

type ParsedAddress = {
  family: 4 | 6;
  bytes: Uint8Array;
  normalized: string;
};

function parseIpv4(value: string): ParsedAddress | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    bytes[index] = octet;
  }
  return { family: 4, bytes, normalized: [...bytes].join(".") };
}

function ipv6Words(parts: readonly string[]): number[] | null {
  const words: number[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (part.includes(".")) {
      if (index !== parts.length - 1) return null;
      const ipv4 = parseIpv4(part);
      if (!ipv4) return null;
      words.push(
        (ipv4.bytes[0]! << 8) | ipv4.bytes[1]!,
        (ipv4.bytes[2]! << 8) | ipv4.bytes[3]!,
      );
      continue;
    }
    if (!/^[0-9a-f]{1,4}$/iu.test(part)) return null;
    words.push(Number.parseInt(part, 16));
  }
  return words;
}

function parseIpv6(value: string): ParsedAddress | null {
  if (!value || value.includes("%") || value.includes("[")) return null;
  const compression = value.indexOf("::");
  if (compression !== -1 && compression !== value.lastIndexOf("::")) {
    return null;
  }
  const leftText = compression === -1 ? value : value.slice(0, compression);
  const rightText = compression === -1 ? "" : value.slice(compression + 2);
  const left = ipv6Words(leftText ? leftText.split(":") : []);
  const right = ipv6Words(rightText ? rightText.split(":") : []);
  if (!left || !right) return null;
  let words: number[];
  if (compression === -1) {
    if (left.length !== 8) return null;
    words = left;
  } else {
    if (left.length + right.length >= 8) return null;
    words = [
      ...left,
      ...Array<number>(8 - left.length - right.length).fill(0),
      ...right,
    ];
  }
  const bytes = new Uint8Array(16);
  for (let index = 0; index < words.length; index += 1) {
    bytes[index * 2] = words[index]! >>> 8;
    bytes[index * 2 + 1] = words[index]! & 0xff;
  }
  return {
    family: 6,
    bytes,
    normalized: words.map((word) => word.toString(16).padStart(4, "0")).join(":"),
  };
}

function parseAddress(value: string): ParsedAddress | null {
  return parseIpv4(value) ?? parseIpv6(value);
}

function canonicalDnsHostname(value: string) {
  if (typeof value !== "string") return null;
  const withoutRootDot = value.trim().replace(/\.$/u, "").toLowerCase();
  if (
    !withoutRootDot ||
    withoutRootDot.length > 253 ||
    parseAddress(withoutRootDot) ||
    withoutRootDot.includes(":")
  ) return null;
  const labels = withoutRootDot.split(".");
  if (
    labels.some(
      (label) =>
        label.length < 1 || label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
    )
  ) return null;
  return withoutRootDot;
}

/**
 * Normalize the actual `resolve4()` / `resolve6()` representation currently
 * produced by Workers/workerd. Workerd projects every DoH answer-section
 * `data` value into both APIs without filtering the RR type, so a CNAME can
 * appear beside an address. Classify by the value itself and retain names as
 * aliases rather than ever attempting to parse a CNAME as an IP address.
 *
 * @internal Exported for captured-runtime response regression coverage.
 */
export function screen02NormalizeWorkerdAddressAnswers(
  records: readonly (string | { address: string })[],
): Screen02ResolvedAddresses {
  const ipv4: string[] = [];
  const ipv6: string[] = [];
  const aliases: string[] = [];
  for (const record of records) {
    const value = typeof record === "string"
      ? record
      : record && typeof record === "object" &&
          typeof record.address === "string"
        ? record.address
        : "";
    const address = parseAddress(value);
    if (address) {
      (address.family === 4 ? ipv4 : ipv6).push(value);
      continue;
    }
    const alias = canonicalDnsHostname(value);
    if (alias) {
      aliases.push(alias);
      continue;
    }
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS returned a malformed answer record.",
      "malformed-answer",
    );
  }
  return {
    ipv4: [...new Set(ipv4)],
    ipv6: [...new Set(ipv6)],
    aliases: [...new Set(aliases)],
  };
}

function matchesPrefix(
  address: Uint8Array,
  prefix: readonly number[],
  bits: number,
) {
  const wholeBytes = Math.floor(bits / 8);
  const remainder = bits % 8;
  for (let index = 0; index < wholeBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  if (remainder === 0) return true;
  const mask = (0xff << (8 - remainder)) & 0xff;
  return (address[wholeBytes]! & mask) === (prefix[wholeBytes]! & mask);
}

const IPV4_SPECIAL_PREFIXES: readonly [readonly number[], number][] = [
  [[0], 8],
  [[10], 8],
  [[100, 64], 10],
  [[127], 8],
  [[169, 254], 16],
  [[172, 16], 12],
  [[192, 0, 0], 24],
  [[192, 0, 2], 24],
  [[192, 31, 196], 24],
  [[192, 52, 193], 24],
  [[192, 88, 99], 24],
  [[192, 168], 16],
  [[192, 175, 48], 24],
  [[198, 18], 15],
  [[198, 51, 100], 24],
  [[198, 97, 38], 24],
  [[203, 0, 113], 24],
  [[224], 4],
  [[240], 4],
];

const IPV6_SPECIAL_PREFIXES: readonly [readonly number[], number][] = [
  // IETF protocol assignments. Blocking the complete allocation is a
  // conservative fail-closed choice for document retrieval; ordinary public
  // web origins do not need these special-purpose addresses.
  [[0x20, 0x01, 0x00], 23],
  // The only generally routable IPv6 allocation is 2000::/3. These entries
  // reject special-purpose ranges inside that allocation as well.
  [[0x20, 0x01, 0x00, 0x00], 32], // TEREDO
  [[0x20, 0x01, 0x00, 0x02], 48], // benchmarking
  [[0x20, 0x01, 0x00, 0x10], 28], // ORCHID (legacy)
  [[0x20, 0x01, 0x00, 0x20], 28], // ORCHIDv2
  [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
  [[0x20, 0x02], 16], // deprecated 6to4
  [[0x26, 0x20, 0x00, 0x4f, 0x80, 0x00], 48], // AS112 direct delegation
  [[0x3f, 0xff, 0x00], 20], // documentation
];

function publiclyRoutable(address: ParsedAddress) {
  if (address.family === 4) {
    return !IPV4_SPECIAL_PREFIXES.some(([prefix, bits]) =>
      matchesPrefix(address.bytes, prefix, bits));
  }
  if (!matchesPrefix(address.bytes, [0x20], 3)) return false;
  return !IPV6_SPECIAL_PREFIXES.some(([prefix, bits]) =>
    matchesPrefix(address.bytes, prefix, bits));
}

function validatedAnswerSet(answers: Screen02ResolvedAddresses) {
  const declared = [
    ...answers.ipv4.map((address) => ({ address, family: 4 as const })),
    ...answers.ipv6.map((address) => ({ address, family: 6 as const })),
  ];
  if (declared.length === 0) {
    throw new Error("Screen 2 secure transport DNS answer set contained no A or AAAA records.");
  }
  const parsed = declared.map(({ address, family }) => {
    const candidate = parseAddress(address);
    if (!candidate || candidate.family !== family) {
      throw new Error("Screen 2 secure transport DNS returned a malformed address.");
    }
    if (!publiclyRoutable(candidate)) {
      throw new Error(
        "Screen 2 secure transport rejected a private or special-use DNS answer.",
      );
    }
    return candidate;
  });
  return [...new Map(parsed.map((address) => [address.normalized, address])).values()];
}

async function resolveValidatedAnswerSet(
  hostname: string,
  resolver: Screen02AddressResolver,
  signal: AbortSignal | undefined,
) {
  const initial = canonicalDnsHostname(hostname);
  if (!initial) {
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport received a malformed DNS hostname.",
      "malformed-answer",
    );
  }
  const pending = [initial];
  const queued = new Set(pending);
  const visited = new Set<string>();
  const ipv4: string[] = [];
  const ipv6: string[] = [];
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (visited.has(current)) {
      throw new Screen02DnsResolutionError(
        "Screen 2 secure transport DNS returned an alias loop.",
        "alias-loop",
      );
    }
    visited.add(current);
    if (visited.size > MAXIMUM_DNS_ALIAS_HOPS + 1) {
      throw new Screen02DnsResolutionError(
        "Screen 2 secure transport DNS exceeded the bounded alias limit.",
        "alias-limit",
      );
    }
    let resolved: Screen02ResolvedAddresses;
    try {
      resolved = await resolveWithAbort(
        signal ? resolver(current, signal) : resolver(current),
        signal,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Screen02DnsResolutionError) throw error;
      throw new Screen02DnsResolutionError(
        "Screen 2 secure transport DNS resolver failed.",
        "resolver-failure",
      );
    }
    if (
      !resolved || !Array.isArray(resolved.ipv4) ||
      !Array.isArray(resolved.ipv6) ||
      (resolved.aliases !== undefined && !Array.isArray(resolved.aliases))
    ) {
      throw new Screen02DnsResolutionError(
        "Screen 2 secure transport DNS returned a malformed result shape.",
        "malformed-answer",
      );
    }
    // Validate every address immediately, including answers returned beside
    // an alias. A mixed unsafe answer can never become safe by following only
    // the convenient record.
    const currentAddresses = validatedAnswerSetAllowingAliases(resolved);
    for (const address of currentAddresses) {
      (address.family === 4 ? ipv4 : ipv6).push(address.normalized);
    }
    for (const rawAlias of resolved.aliases ?? []) {
      const alias = canonicalDnsHostname(rawAlias);
      if (!alias) {
        throw new Screen02DnsResolutionError(
          "Screen 2 secure transport DNS returned a malformed alias.",
          "malformed-answer",
        );
      }
      // A resolver response that already contains a usable address has
      // completed the alias chain. Workerd includes both the CNAME and the
      // terminal A/AAAA data in that response, so following the name again
      // would spend another DNS subrequest and could turn a valid answer into
      // a false failure if a later family lookup is transiently unavailable.
      if (currentAddresses.length > 0) continue;
      if (visited.has(alias)) {
        throw new Screen02DnsResolutionError(
          "Screen 2 secure transport DNS returned an alias loop.",
          "alias-loop",
        );
      }
      if (!queued.has(alias)) {
        if (queued.size > MAXIMUM_DNS_ALIAS_HOPS) {
          throw new Screen02DnsResolutionError(
            "Screen 2 secure transport DNS exceeded the bounded alias limit.",
            "alias-limit",
          );
        }
        queued.add(alias);
        pending.push(alias);
      }
    }
  }
  if (ipv4.length === 0 && ipv6.length === 0) {
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS answer set contained no usable A or AAAA records.",
      "no-address",
    );
  }
  return validatedAnswerSet({ ipv4, ipv6 });
}

function validatedAnswerSetAllowingAliases(answers: Screen02ResolvedAddresses) {
  if (answers.ipv4.length === 0 && answers.ipv6.length === 0) return [];
  return validatedAnswerSet(answers);
}

function peerAddress(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const direct = parseAddress(trimmed);
  if (direct) return direct;
  const bracketed = trimmed.match(/^\[([^\]]+)\](?::[0-9]{1,5})?$/u);
  if (bracketed) return parseIpv6(bracketed[1]!);
  const withPort = trimmed.match(/^([^:]+):([0-9]{1,5})$/u);
  return withPort ? parseIpv4(withPort[1]!) : null;
}

function abortError() {
  const error = new Error("Screen 2 secure transport request was aborted.");
  error.name = "AbortError";
  return error;
}

async function resolveWithAbort(
  promise: Promise<Screen02ResolvedAddresses>,
  signal: AbortSignal | undefined,
) {
  if (!signal) return promise;
  if (signal.aborted) throw abortError();
  return new Promise<Screen02ResolvedAddresses>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function awaitWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  socket: Screen02TransportSocket,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    void socket.close().catch(() => undefined);
    throw abortError();
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      void socket.close().catch(() => undefined);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function requestHeaders(input: HeadersInit | undefined, hostname: string) {
  const supplied = new Headers(input);
  const headers = new Headers();
  for (const name of [
    "accept",
    "accept-language",
    "accept-max-cs-size",
    "cache-control",
    "user-agent",
  ]) {
    const value = supplied.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("host", hostname);
  headers.set("connection", "close");
  headers.set("accept-encoding", "identity");
  return [...headers].map(([name, value]) => `${name}: ${value}\r\n`).join("");
}

function findSequence(bytes: Uint8Array, sequence: readonly number[], from = 0) {
  outer: for (let index = from; index <= bytes.length - sequence.length; index += 1) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (bytes[index + offset] !== sequence[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function parseChunkedBody(bytes: Uint8Array) {
  const chunks: Uint8Array[] = [];
  let bodyBytes = 0;
  let offset = 0;
  while (true) {
    const lineEnd = findSequence(bytes, [13, 10], offset);
    if (lineEnd === -1) throw new Error("Secure HTTP response had a truncated chunk size.");
    const line = new TextDecoder().decode(bytes.slice(offset, lineEnd));
    const sizeToken = line.split(";", 1)[0]!.trim();
    if (!/^[0-9a-f]+$/iu.test(sizeToken)) {
      throw new Error("Secure HTTP response declared an invalid chunk size.");
    }
    const size = Number.parseInt(sizeToken, 16);
    if (!Number.isSafeInteger(size)) {
      throw new Error("Secure HTTP response declared an unsafe chunk size.");
    }
    offset = lineEnd + 2;
    if (size === 0) {
      const trailerEnd = findSequence(bytes, [13, 10, 13, 10], offset);
      const immediateEnd = bytes[offset] === 13 && bytes[offset + 1] === 10;
      if (trailerEnd === -1 && !immediateEnd) {
        throw new Error("Secure HTTP response had truncated trailers.");
      }
      const consumed = immediateEnd ? offset + 2 : trailerEnd + 4;
      if (consumed !== bytes.length) {
        throw new Error("Secure HTTP response had bytes after its chunked message.");
      }
      break;
    }
    if (offset + size + 2 > bytes.length ||
        bytes[offset + size] !== 13 || bytes[offset + size + 1] !== 10) {
      throw new Error("Secure HTTP response had a truncated chunk.");
    }
    bodyBytes += size;
    if (bodyBytes > MAXIMUM_RESPONSE_BODY_BYTES) {
      throw new Error("Secure HTTP response exceeded the body-size limit.");
    }
    chunks.push(bytes.slice(offset, offset + size));
    offset += size + 2;
  }
  const body = new Uint8Array(bodyBytes);
  let destination = 0;
  for (const chunk of chunks) {
    body.set(chunk, destination);
    destination += chunk.length;
  }
  return body;
}

function responseFromWire(bytes: Uint8Array) {
  const headerEnd = findSequence(bytes, [13, 10, 13, 10]);
  if (headerEnd === -1 || headerEnd > MAXIMUM_RESPONSE_HEADER_BYTES) {
    throw new Error("Secure HTTP response had missing or oversized headers.");
  }
  const headerText = new TextDecoder().decode(bytes.slice(0, headerEnd));
  const lines = headerText.split("\r\n");
  const statusLine = lines.shift() ?? "";
  const statusMatch = statusLine.match(/^HTTP\/1\.[01] ([0-9]{3})(?: ([^\r\n]*))?$/u);
  if (!statusMatch) throw new Error("Secure HTTP response had an invalid status line.");
  const status = Number(statusMatch[1]);
  if (status < 200 || status > 599) {
    throw new Error("Secure HTTP response used an unsupported informational status.");
  }
  const headers = new Headers();
  for (const line of lines) {
    if (/^[ \t]/u.test(line)) {
      throw new Error("Secure HTTP response used obsolete folded headers.");
    }
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error("Secure HTTP response had a malformed header.");
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/iu.test(name)) {
      throw new Error("Secure HTTP response had an invalid header name.");
    }
    headers.append(name, value);
  }
  const encoding = headers.get("content-encoding")?.trim().toLowerCase();
  if (encoding && encoding !== "identity") {
    throw new Error("Secure HTTP response ignored identity content encoding.");
  }
  const bodyWire = bytes.slice(headerEnd + 4);
  const transferEncoding = headers.get("transfer-encoding")?.toLowerCase();
  const contentLength = headers.get("content-length");
  if (transferEncoding && contentLength) {
    throw new Error(
      "Secure HTTP response declared conflicting transfer and content lengths.",
    );
  }
  let body: Uint8Array;
  if (transferEncoding) {
    if (transferEncoding !== "chunked") {
      throw new Error("Secure HTTP response used an unsupported transfer encoding.");
    }
    body = parseChunkedBody(bodyWire);
  } else {
    if (contentLength) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength)) {
        throw new Error("Secure HTTP response declared an invalid content length.");
      }
      const expected = Number(contentLength);
      if (!Number.isSafeInteger(expected) || expected !== bodyWire.length) {
        throw new Error("Secure HTTP response body did not match its content length.");
      }
    }
    body = bodyWire;
  }
  if (body.length > MAXIMUM_RESPONSE_BODY_BYTES) {
    throw new Error("Secure HTTP response exceeded the body-size limit.");
  }
  const bodyAllowed = ![204, 205, 304].includes(status);
  if (!bodyAllowed && body.length !== 0) {
    throw new Error("Secure HTTP response included a forbidden response body.");
  }
  return new Response(bodyAllowed ? Uint8Array.from(body).buffer : null, {
    status,
    statusText: (statusMatch[2] ?? "").slice(0, 128),
    headers,
  });
}

async function readResponse(
  socket: Screen02TransportSocket,
  signal: AbortSignal | undefined,
) {
  const reader = socket.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await awaitWithAbort(reader.read(), signal, socket);
      if (result.done) break;
      total += result.value.length;
      if (total > MAXIMUM_RESPONSE_WIRE_BYTES) {
        throw new Error("Secure HTTP response exceeded the wire-size limit.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return responseFromWire(bytes);
}

export async function screen02PeerBoundHttpsFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  dependencies: Screen02SecureTransportDependencies,
): Promise<Response> {
  const signal = init?.signal ?? undefined;
  const url = new URL(typeof input === "string" || input instanceof URL
    ? input.toString()
    : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET"))
    .toUpperCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      method !== "GET" || init?.body) {
    throw new Error(
      "Screen 2 secure transport accepts only credential-free default-port HTTPS GET requests.",
    );
  }
  if (init?.redirect && init.redirect !== "manual") {
    throw new Error("Screen 2 secure transport requires manual redirect handling.");
  }
  if (signal?.aborted) throw abortError();
  const literalIpv4 = parseIpv4(url.hostname);
  let answers: ParsedAddress[];
  if (literalIpv4) {
    // WHATWG URL parsing has already canonicalized legacy IPv4 spellings.
    // A public literal is the complete address set, so do not submit it as a
    // DNS name. It still passes the ordinary public-address, peer, and TLS
    // checks below.
    answers = validatedAnswerSet({ ipv4: [literalIpv4.normalized], ipv6: [] });
  } else {
    answers = await resolveValidatedAnswerSet(
      url.hostname,
      dependencies.resolve,
      signal,
    );
  }
  const selected = answers[0]!;
  let socket = dependencies.connect(
    { hostname: selected.normalized, port: 443 },
    { secureTransport: "starttls", allowHalfOpen: false },
  );
  try {
    const opened = await awaitWithAbort(socket.opened, signal, socket);
    const observedPeer = peerAddress(opened.remoteAddress);
    if (!observedPeer || observedPeer.normalized !== selected.normalized) {
      throw new Error(
        "Screen 2 secure transport could not prove that the observed peer matched the validated DNS answer.",
      );
    }
    socket = socket.startTls({ expectedServerHostname: url.hostname });
    const tlsOpened = await awaitWithAbort(socket.opened, signal, socket);
    const tlsPeer = peerAddress(tlsOpened.remoteAddress);
    if (tlsPeer && tlsPeer.normalized !== selected.normalized) {
      throw new Error(
        "Screen 2 secure transport observed a different peer after TLS upgrade.",
      );
    }
    const headers = init?.headers ??
      (input instanceof Request ? input.headers : undefined);
    const request = `${method} ${url.pathname || "/"}${url.search} HTTP/1.1\r\n` +
      requestHeaders(headers, url.hostname) + "\r\n";
    const writer = socket.writable.getWriter();
    try {
      await awaitWithAbort(writer.write(new TextEncoder().encode(request)), signal, socket);
    } finally {
      writer.releaseLock();
    }
    return await readResponse(socket, signal);
  } finally {
    await socket.close().catch(() => undefined);
  }
}

type Screen02DnsJsonFamily = {
  family: 4 | 6;
  label: "A" | "AAAA";
  type: 1 | 28;
};

type Screen02DnsJsonFamilyResult = Screen02ResolvedAddresses & {
  outcome: "found" | "no-data" | "not-found";
};

const SCREEN_02_DNS_JSON_FAMILIES: readonly Screen02DnsJsonFamily[] = [
  { family: 4, label: "A", type: 1 },
  { family: 6, label: "AAAA", type: 28 },
];

function screen02DnsJsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function malformedDnsJson(): never {
  throw new Screen02DnsResolutionError(
    "Screen 2 secure transport DNS returned a malformed typed answer.",
    "malformed-answer",
  );
}

function screen02ParseDnsJsonFamily(
  value: unknown,
  hostname: string,
  family: Screen02DnsJsonFamily,
): Screen02DnsJsonFamilyResult {
  const payload = screen02DnsJsonObject(value);
  if (!payload || !Number.isInteger(payload.Status) ||
    (payload.TC !== undefined && typeof payload.TC !== "boolean")) {
    return malformedDnsJson();
  }
  if (payload.TC === true) {
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS returned a truncated typed answer.",
      "resolver-failure",
    );
  }
  if (payload.Status === 3) {
    return { outcome: "not-found", ipv4: [], ipv6: [], aliases: [] };
  }
  if (payload.Status !== 0) {
    throw new Screen02DnsResolutionError(
      `Screen 2 secure transport DNS resolver returned status ${payload.Status}.`,
      "resolver-failure",
    );
  }
  if (!Array.isArray(payload.Question) || payload.Question.length !== 1) {
    return malformedDnsJson();
  }
  const question = screen02DnsJsonObject(payload.Question[0]);
  if (!question || canonicalDnsHostname(String(question.name ?? "")) !== hostname ||
    question.type !== family.type) {
    return malformedDnsJson();
  }
  if (payload.Answer === undefined) {
    return { outcome: "no-data", ipv4: [], ipv6: [], aliases: [] };
  }
  if (!Array.isArray(payload.Answer)) return malformedDnsJson();
  if (payload.Answer.length === 0) {
    return { outcome: "no-data", ipv4: [], ipv6: [], aliases: [] };
  }

  const aliases = new Map<string, string>();
  const addresses = new Map<string, string[]>();
  for (const rawAnswer of payload.Answer) {
    const answer = screen02DnsJsonObject(rawAnswer);
    const name = canonicalDnsHostname(String(answer?.name ?? ""));
    const type = answer?.type;
    const ttl = answer?.TTL;
    const data = typeof answer?.data === "string" ? answer.data : "";
    if (!answer || !name || !Number.isInteger(ttl) || Number(ttl) < 0) {
      return malformedDnsJson();
    }
    if (type === 5) {
      const alias = canonicalDnsHostname(data);
      const existing = aliases.get(name);
      if (!alias || (existing !== undefined && existing !== alias)) {
        return malformedDnsJson();
      }
      aliases.set(name, alias);
      continue;
    }
    if (type !== family.type) return malformedDnsJson();
    const address = parseAddress(data);
    if (!address || address.family !== family.family) return malformedDnsJson();
    const values = addresses.get(name) ?? [];
    values.push(address.normalized);
    addresses.set(name, values);
  }

  let current = hostname;
  const chain = new Set<string>();
  const traversedAliases: string[] = [];
  for (let depth = 0; depth <= MAXIMUM_DNS_ALIAS_HOPS; depth += 1) {
    if (chain.has(current)) {
      throw new Screen02DnsResolutionError(
        "Screen 2 secure transport DNS returned an alias loop.",
        "alias-loop",
      );
    }
    chain.add(current);
    const currentAddresses = addresses.get(current) ?? [];
    const alias = aliases.get(current);
    if (currentAddresses.length > 0) {
      if (alias || [...addresses.keys()].some((name) => !chain.has(name)) ||
        [...aliases.keys()].some((name) => !chain.has(name))) {
        return malformedDnsJson();
      }
      return {
        outcome: "found",
        ipv4: family.family === 4 ? currentAddresses : [],
        ipv6: family.family === 6 ? currentAddresses : [],
        aliases: traversedAliases,
      };
    }
    if (!alias) {
      if ([...addresses.keys()].some((name) => !chain.has(name)) ||
        [...aliases.keys()].some((name) => !chain.has(name))) {
        return malformedDnsJson();
      }
      return {
        outcome: "no-data",
        ipv4: [],
        ipv6: [],
        aliases: current === hostname ? [] : [current],
      };
    }
    traversedAliases.push(alias);
    current = alias;
  }
  throw new Screen02DnsResolutionError(
    "Screen 2 secure transport DNS exceeded the bounded alias limit.",
    "alias-limit",
  );
}

async function screen02FetchDnsJsonFamily(
  hostname: string,
  family: Screen02DnsJsonFamily,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
) {
  const url = new URL(SCREEN_02_DNS_JSON_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", family.label);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/dns-json" },
      redirect: "manual",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS resolver transport failed.",
      "resolver-failure",
    );
  }
  if (!response.ok || response.status !== 200) {
    throw new Screen02DnsResolutionError(
      `Screen 2 secure transport DNS resolver returned HTTP ${response.status}.`,
      "resolver-failure",
    );
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .toLocaleLowerCase("en-US");
  if (!contentType.includes("application/dns-json")) {
    return malformedDnsJson();
  }
  let text: string;
  try {
    text = await readScreen02BoundedResponseText(
      response,
      MAXIMUM_DNS_JSON_BYTES,
    );
  } catch {
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS resolver response exceeded its byte limit.",
      "resolver-failure",
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return malformedDnsJson();
  }
  return screen02ParseDnsJsonFamily(payload, hostname, family);
}

/**
 * Resolve typed A and AAAA data through Cloudflare's documented DNS-JSON
 * endpoint. The endpoint is fixed (never researcher-controlled), requests are
 * bounded and non-redirecting, and the requested destination still uses the
 * peer-bound socket/TLS transport below.
 *
 * @internal Exported so recorded production-shaped DNS responses exercise the
 * real adapter rather than a permanently-successful address stub.
 */
export async function screen02ResolveCloudflareDnsJson(
  hostname: string,
  fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<Screen02ResolvedAddresses> {
  const canonical = canonicalDnsHostname(hostname);
  if (!canonical) return malformedDnsJson();
  const results = await Promise.all(
    SCREEN_02_DNS_JSON_FAMILIES.map((family) =>
      screen02FetchDnsJsonFamily(canonical, family, fetchImpl, signal)
    ),
  );
  if (results.some((result) => result.outcome === "not-found")) {
    if (!results.every((result) => result.outcome === "not-found")) {
      return malformedDnsJson();
    }
    throw new Screen02DnsResolutionError(
      "Screen 2 secure transport DNS reported a nonexistent hostname.",
      "not-found",
    );
  }
  return {
    ipv4: [...new Set(results.flatMap((result) => result.ipv4))],
    ipv6: [...new Set(results.flatMap((result) => result.ipv6))],
    aliases: [...new Set(results.flatMap((result) => result.aliases ?? []))],
  };
}

export async function screen02ProductionPeerBoundFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchImpl: typeof fetch = globalThis.fetch,
) {
  const url = new URL(typeof input === "string" || input instanceof URL
    ? input.toString()
    : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET"))
    .toUpperCase();
  const hostname = url.hostname.toLocaleLowerCase("en-US");
  const supplied = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const govInfoApiRequest = hostname === GOVINFO_API_HOST;
  const govInfoRequestAllowed = govInfoApiRequest && !url.search && !url.hash &&
    validBoundedCredential(supplied.get("x-api-key")) &&
    ((method === "GET" && !init?.body && exactGovInfoReadPath(url.pathname)) ||
      (method === "POST" && url.pathname === "/search" &&
        (exactGovInfoHistoricalSearchBody(init?.body) ||
          exactGovInfoPublicLawSearchBody(init?.body))));
  const congressApiRequest = hostname === CONGRESS_API_HOST;
  const congressRequestAllowed = congressApiRequest &&
    validBoundedCredential(supplied.get("x-api-key")) &&
    exactCongressApiRequest(url, method, init?.body);
  const regulationsApiRequest = hostname === REGULATIONS_API_HOST;
  const regulationsRequestAllowed = regulationsApiRequest &&
    validBoundedCredential(supplied.get("x-api-key")) &&
    exactRegulationsApiRequest(url, method, init?.body);
  const openStatesApiRequest = hostname === OPENSTATES_API_HOST;
  const openStatesRequestAllowed = openStatesApiRequest &&
    validBoundedCredential(supplied.get("x-api-key")) &&
    exactOpenStatesApiRequest(url, method, init?.body);
  const openAlexApiRequest = hostname === OPENALEX_API_HOST;
  const authorization = supplied.get("authorization");
  const openAlexRequestAllowed = openAlexApiRequest &&
    (authorization === null || validBearerCredential(authorization)) &&
    supplied.get("x-api-key") === null &&
    exactOpenAlexApiRequest(url, method, init?.body);
  const credentialedApiRequest = govInfoApiRequest || congressApiRequest ||
    regulationsApiRequest || openStatesApiRequest || openAlexApiRequest;
  const credentialedApiRequestAllowed = govInfoRequestAllowed ||
    congressRequestAllowed || regulationsRequestAllowed ||
    openStatesRequestAllowed || openAlexRequestAllowed;
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    (credentialedApiRequest
      ? !credentialedApiRequestAllowed
      : method !== "GET" || Boolean(init?.body))
  ) {
    throw new Error(
      "ShockAudit official-source transport accepts credential-free default-port HTTPS GET requests plus exact credentialed GovInfo, Congress.gov, Regulations.gov, and Open States routes and the exact bounded OpenAlex route.",
    );
  }
  if (init?.redirect && init.redirect !== "manual") {
    throw new Error(
      "Screen 2 official-source transport requires manual redirect handling.",
    );
  }
  if (!SCREEN_02_FIXED_OFFICIAL_FETCH_HOSTS.has(hostname)) {
    throw new Error(
      "Screen 2 generic peer-bound HTTPS capability is unavailable in the current Workers socket runtime; this host has no reviewed fixed official-source adapter.",
    );
  }
  const headers = new Headers();
  for (const name of [
    "accept",
    "accept-language",
    "accept-max-cs-size",
    "cache-control",
  ]) {
    const value = supplied.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "user-agent",
    supplied.get("user-agent") ?? SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
  );
  if (govInfoApiRequest) {
    headers.set("x-api-key", supplied.get("x-api-key")!);
    if (method === "POST") headers.set("content-type", "application/json");
  }
  if (congressApiRequest || regulationsApiRequest || openStatesApiRequest) {
    headers.set("x-api-key", supplied.get("x-api-key")!);
  }
  if (openAlexApiRequest && authorization !== null) {
    headers.set("authorization", authorization);
  }
  headers.set("accept-encoding", "identity");
  // This ordinary Worker fetch is deliberately limited to the exact reviewed
  // publisher set above. Redirects remain visible to, and are revalidated by,
  // the calling connector/document adapter. It is not used as a generic SSRF
  // bypass or represented as an independently peer-attested socket.
  return fetchImpl(url, {
    method,
    headers,
    ...(method === "POST" ? { body: init!.body } : {}),
    redirect: "manual",
    cache: "no-store",
    signal: init?.signal ?? (input instanceof Request ? input.signal : undefined),
  });
}
