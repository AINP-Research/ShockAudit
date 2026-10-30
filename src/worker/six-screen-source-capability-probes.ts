import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  buildCrossrefLiteratureRequest,
  discoverCrossrefLiteratureMetadata,
} from "./screen05-crossref-literature";
import {
  buildOpenAlexLiteratureRequest,
  discoverOpenAlexLiteratureMetadata,
} from "./screen05-openalex-literature";
import {
  congressPublicLawIdentityResponseMatches,
} from "./screen01-congress-statute-identity";
import type {
  SixScreenCapabilityProbe,
  SixScreenSourceId,
} from "./six-screen-source-register";

const PROBE_TIMEOUT_MS = 8_000;
const PROBE_MAXIMUM_BYTES = 256 * 1024;
const PROBE_CACHE_MS = 5 * 60 * 1_000;
const PROBE_QUERY = "difference in differences public policy";

type SecretInput = {
  govInfoApiKey?: string;
  congressApiKey?: string;
  regulationsApiKey?: string;
  openStatesApiKey?: string;
  openAlexApiKey?: string;
};

type ProbeMap = Partial<Record<SixScreenSourceId, SixScreenCapabilityProbe>>;

let cached: null | {
  configured: string;
  expiresAt: number;
  probes: ProbeMap;
} = null;
let pending: null | {
  configured: string;
  promise: Promise<ProbeMap>;
} = null;

function validSecret(value: string | undefined) {
  if (!value) return false;
  const bytes = new TextEncoder().encode(value).byteLength;
  return bytes >= 1 && bytes <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function configuredFingerprint(secrets: SecretInput, includeCrossref: boolean) {
  return [
    includeCrossref ? "crossref" : "",
    validSecret(secrets.govInfoApiKey) ? "govinfo" : "",
    validSecret(secrets.congressApiKey) ? "congress" : "",
    validSecret(secrets.regulationsApiKey) ? "regulations" : "",
    validSecret(secrets.openStatesApiKey) ? "openstates" : "",
    validSecret(secrets.openAlexApiKey) ? "openalex" : "",
  ].join("|");
}

function outcomeForStatus(status: number | null) {
  if (status === 401 || status === 403) return "auth_required" as const;
  if (status === 429) return "rate_limited" as const;
  return "failure" as const;
}

function record(input: {
  at: string;
  endpoint: string;
  status: number | null;
  success: boolean;
  note: string;
}): SixScreenCapabilityProbe {
  return {
    at: input.at,
    endpoint: input.endpoint,
    outcome: input.success ? "success" : outcomeForStatus(input.status),
    httpStatus: input.status,
    note: input.note,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transportFailureCode(error: unknown, timedOut: boolean) {
  if (timedOut) return "timeout";
  const message = error instanceof Error
    ? error.message.toLocaleLowerCase("en-US")
    : "";
  if (/reviewed fixed official-source adapter|exact credentialed/iu.test(message)) {
    return "source-route-policy";
  }
  if (/private|publicly routable|network policy|not allowed/iu.test(message)) {
    return "outbound-network-policy";
  }
  if (/invalid[^.]*header|header[^.]*invalid/iu.test(message)) {
    return "request-header";
  }
  if (/\b(?:dns|resolve|hostname)\b/iu.test(message)) return "dns";
  if (/\b(?:tls|certificate|ssl)\b/iu.test(message)) return "tls";
  if (/\b(?:fetch|network|connect)\b/iu.test(message)) return "network";
  return "runtime";
}

async function boundedJsonProbe(input: {
  fetch: Screen02ConnectorFetch;
  at: string;
  endpoint: string;
  requestUrl: string;
  init: RequestInit;
  validate: (value: unknown) => boolean;
  successNote: string;
  failureNote: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  let status: number | null = null;
  try {
    const response = await input.fetch(input.requestUrl, {
      ...input.init,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    status = response.status;
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    if (!response.ok || (contentType && !contentType.includes("json"))) {
      await response.body?.cancel("Capability probe response rejected")
        .catch(() => undefined);
      return record({
        at: input.at,
        endpoint: input.endpoint,
        status,
        success: false,
        note: input.failureNote,
      });
    }
    let value: unknown;
    try {
      value = JSON.parse(await readScreen02BoundedResponseText(
        response,
        PROBE_MAXIMUM_BYTES,
      ));
    } catch {
      return record({
        at: input.at,
        endpoint: input.endpoint,
        status,
        success: false,
        note: input.failureNote,
      });
    }
    return record({
      at: input.at,
      endpoint: input.endpoint,
      status,
      success: input.validate(value),
      note: input.validate(value) ? input.successNote : input.failureNote,
    });
  } catch (error) {
    return record({
      at: input.at,
      endpoint: input.endpoint,
      status,
      success: false,
      note: `${input.failureNote} Failure stage: ${
        transportFailureCode(error, controller.signal.aborted)
      }.`,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function probeGovInfo(
  fetch: Screen02ConnectorFetch,
  at: string,
  apiKey: string,
) {
  const endpoint = "https://api.govinfo.gov/search";
  return boundedJsonProbe({
    fetch,
    at,
    endpoint,
    requestUrl: endpoint,
    init: {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: 'collection:(PLAW) "First Step Act"',
        pageSize: "10",
        offsetMark: "*",
        resultLevel: "package",
        sorts: [{ field: "score", sortOrder: "DESC" }],
      }),
    },
    validate: (value) =>
      isRecord(value) && Array.isArray(value.results) &&
      value.results.some((item) =>
        isRecord(item) && item.packageId === "PLAW-115publ391" &&
        item.collectionCode === "PLAW"
      ),
    successNote:
      "The documented public-law search returned the expected native First Step Act package identity.",
    failureNote:
      "The public-law search did not return a validated expected package identity.",
  });
}

async function probeCongress(
  fetch: Screen02ConnectorFetch,
  at: string,
  apiKey: string,
) {
  const endpoint = "https://api.congress.gov/v3/law/115/pub/391";
  return boundedJsonProbe({
    fetch,
    at,
    endpoint,
    requestUrl: `${endpoint}?format=json`,
    init: {
      method: "GET",
      headers: { accept: "application/json", "x-api-key": apiKey },
    },
    validate: (value) =>
      congressPublicLawIdentityResponseMatches(value, "PLAW-115publ391"),
    successNote:
      "The documented exact-law route bound Public Law 115-391 to a supported native bill identity.",
    failureNote:
      "The exact-law route did not return a validated native bill identity for Public Law 115-391.",
  });
}

async function probeRegulationsGov(
  fetch: Screen02ConnectorFetch,
  at: string,
  apiKey: string,
) {
  const endpoint = "https://api.regulations.gov/v4/documents";
  const url = new URL(endpoint);
  url.searchParams.set("filter[searchTerm]", "2018-03708");
  // Regulations.gov's published v4 contract permits page sizes from 5 to 250.
  url.searchParams.set("page[size]", "5");
  url.searchParams.set("sort", "-postedDate");
  return boundedJsonProbe({
    fetch,
    at,
    endpoint,
    requestUrl: url.toString(),
    init: {
      method: "GET",
      headers: {
        accept: "application/vnd.api+json, application/json",
        "x-api-key": apiKey,
      },
    },
    validate: (value) =>
      isRecord(value) && Array.isArray(value.data) &&
      value.data.some((item) => {
        if (!isRecord(item) || !isRecord(item.attributes)) return false;
        const attributes = item.attributes;
        return attributes.frDocNum === "2018-03708" ||
          attributes.frDocumentNumber === "2018-03708" ||
          (typeof attributes.title === "string" &&
            /electric storage participation/iu.test(attributes.title));
      }),
    successNote:
      "The bounded administrative-document search returned an identity-bound Order 841 record.",
    failureNote:
      "The administrative-document search did not return a validated Order 841 record.",
  });
}

async function probeOpenAlex(
  fetch: Screen02ConnectorFetch,
  at: string,
  apiKey: string,
) {
  const endpoint = "https://api.openalex.org/works";
  let status: number | null = null;
  const result = await discoverOpenAlexLiteratureMetadata({
    fetch: async (request, init) => {
      const response = await fetch(request, init);
      status = response.status;
      return response;
    },
    query: PROBE_QUERY,
    retrievedAt: at,
    apiKey,
    resultLimit: 1,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  const success = result.diagnostics.status === "searched" &&
    result.records.length > 0;
  return record({
    at,
    endpoint,
    status,
    success,
    note: success
      ? "The bounded work-search route returned validated scholarly metadata."
      : "The work-search route did not return validated scholarly metadata.",
  });
}

async function probeCrossref(fetch: Screen02ConnectorFetch, at: string) {
  const endpoint = "https://api.crossref.org/v1/works";
  let status: number | null = null;
  const result = await discoverCrossrefLiteratureMetadata({
    fetch: async (request, init) => {
      const response = await fetch(request, init);
      status = response.status;
      return response;
    },
    query: PROBE_QUERY,
    retrievedAt: at,
    resultLimit: 1,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  const success = result.diagnostics.status === "searched" &&
    result.records.length > 0;
  return record({
    at,
    endpoint,
    status,
    success,
    note: success
      ? "The bounded bibliographic-search route returned validated scholarly metadata."
      : "The bibliographic-search route did not return validated scholarly metadata.",
  });
}

async function probeOpenStates(
  fetch: Screen02ConnectorFetch,
  at: string,
  apiKey: string,
) {
  const endpoint =
    "https://v3.openstates.org/jurisdictions?classification=state&per_page=1";
  return boundedJsonProbe({
    fetch,
    at,
    endpoint,
    requestUrl: endpoint,
    init: {
      method: "GET",
      headers: { accept: "application/json", "x-api-key": apiKey },
    },
    validate: (value) =>
      isRecord(value) && Array.isArray(value.results) &&
      value.results.some((item) =>
        isRecord(item) && typeof item.id === "string" &&
        typeof item.name === "string"
      ),
    successNote:
      "The bounded jurisdiction request returned validated Open States metadata.",
    failureNote:
      "The Open States jurisdiction request did not return validated metadata.",
  });
}

/**
 * Runs bounded, operation-specific live probes. Secrets are used only in
 * request headers and neither keys nor provider payloads are returned.
 */
export async function probeConfiguredSixScreenSources(input: {
  fetch: Screen02ConnectorFetch;
  now: () => string;
  secrets?: SecretInput;
  includeCrossref?: boolean;
  existingProbes?: ProbeMap;
  cacheTtlMs?: number;
}): Promise<ProbeMap> {
  const secrets = input.secrets ?? {};
  const includeCrossref = input.includeCrossref ?? false;
  const fingerprint = configuredFingerprint(secrets, includeCrossref);
  const cacheTtlMs = input.cacheTtlMs ?? PROBE_CACHE_MS;
  const existing = input.existingProbes ?? {};
  const needs = {
    govinfo: validSecret(secrets.govInfoApiKey) && !existing.govinfo,
    congress: validSecret(secrets.congressApiKey) && !existing.congress_gov,
    regulations: validSecret(secrets.regulationsApiKey) &&
      !existing.regulations_gov,
    openstates: validSecret(secrets.openStatesApiKey) && !existing.openstates,
    openalex: validSecret(secrets.openAlexApiKey) && !existing.openalex,
    crossref: includeCrossref && !existing.crossref,
  };
  if (!Object.values(needs).some(Boolean)) return { ...existing };
  const nowMs = Date.now();
  if (
    cacheTtlMs > 0 && cached?.configured === fingerprint &&
    cached.expiresAt > nowMs
  ) return { ...cached.probes, ...existing };
  if (
    cacheTtlMs > 0 && pending?.configured === fingerprint
  ) {
    return { ...(await pending.promise), ...existing };
  }
  const execute = async () => {
    const at = input.now();
    const entries = await Promise.all([
      needs.govinfo
        ? probeGovInfo(input.fetch, at, secrets.govInfoApiKey!)
          .then((probe) => ["govinfo", probe] as const)
        : null,
      needs.congress
        ? probeCongress(input.fetch, at, secrets.congressApiKey!)
          .then((probe) => ["congress_gov", probe] as const)
        : null,
      needs.regulations
        ? probeRegulationsGov(input.fetch, at, secrets.regulationsApiKey!)
          .then((probe) => ["regulations_gov", probe] as const)
        : null,
      needs.openstates
        ? probeOpenStates(input.fetch, at, secrets.openStatesApiKey!)
          .then((probe) => ["openstates", probe] as const)
        : null,
      needs.openalex
        ? probeOpenAlex(input.fetch, at, secrets.openAlexApiKey!)
          .then((probe) => ["openalex", probe] as const)
        : null,
      needs.crossref
        ? probeCrossref(input.fetch, at)
          .then((probe) => ["crossref", probe] as const)
        : null,
    ]);
    const probes = Object.fromEntries(entries.filter(
      (entry): entry is Exclude<typeof entry, null> => entry !== null,
    )) as ProbeMap;
    return { ...probes, ...existing };
  };
  const current = { configured: fingerprint, promise: execute() };
  pending = current;
  try {
    const probes = await current.promise;
    if (cacheTtlMs > 0) {
      cached = {
        configured: fingerprint,
        expiresAt: Date.now() + cacheTtlMs,
        probes,
      };
    }
    return probes;
  } finally {
    if (pending === current) pending = null;
  }
}

export const SIX_SCREEN_CAPABILITY_PROBE_REQUESTS = {
  govinfo: "https://api.govinfo.gov/search",
  congress_gov: "https://api.congress.gov/v3/law/115/pub/391?format=json",
  regulations_gov:
    "https://api.regulations.gov/v4/documents?filter%5BsearchTerm%5D=2018-03708&page%5Bsize%5D=5&sort=-postedDate",
  openstates:
    "https://v3.openstates.org/jurisdictions?classification=state&per_page=1",
  openalex: buildOpenAlexLiteratureRequest({
    query: PROBE_QUERY,
    resultLimit: 1,
  }),
  crossref: buildCrossrefLiteratureRequest({
    query: PROBE_QUERY,
    resultLimit: 1,
  }),
} as const;
