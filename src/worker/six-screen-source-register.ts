import {
  validateSourceCapability,
  type SourceCapability,
} from "../core/six-screen/capabilities";
import { SIX_SCREEN_ECFR_HISTORY_ADAPTER_VERSION } from
  "./screen02-ecfr-history-acquisition";
import { SIX_SCREEN_GOVINFO_ANNUAL_CFR_ADAPTER_VERSION } from
  "./screen02-govinfo-cfr-annual-acquisition";
import { SIX_SCREEN_CROSSREF_LITERATURE_PROTOCOL_VERSION } from
  "./screen05-crossref-literature";
import { SIX_SCREEN_OPENALEX_LITERATURE_PROTOCOL_VERSION } from
  "./screen05-openalex-literature";
import { SCREEN_01_GOVINFO_STATUTE_DISCOVERY_VERSION } from
  "./screen01-govinfo-statute-discovery";
import { SCREEN_01_CONGRESS_STATUTE_IDENTITY_VERSION } from
  "./screen01-congress-statute-identity";
import { SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION } from
  "./screen02-regulations-gov-acquisition";
import { SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION } from
  "./screen02-complementary-evidence-acquisition";
import {
  SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS,
  SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS,
} from "./screen02-secure-transport";
import { CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION } from
  "./contextual-discovery";
import { OPENSTATES_BILL_ADAPTER_VERSION } from "./openstates-bills";

export const SIX_SCREEN_SOURCE_REGISTER_VERSION =
  "shockaudit-source-register-v4" as const;

export type SixScreenSourceId =
  | "federal_register"
  | "reviewed_official_documents"
  | "govinfo"
  | "ecfr"
  | "regulations_gov"
  | "congress_gov"
  | "legiscan"
  | "openstates"
  | "eu_cellar"
  | "uk_legislation"
  | "tavily"
  | "brave"
  | "openalex"
  | "crossref"
  | "gdelt"
  | "openfema"
  | "usgs"
  | "gdacs";

export const SIX_SCREEN_SECRET_NAMES = [
  "GOVINFO_API_KEY",
  "CONGRESS_API_KEY",
  "REGULATIONS_API_KEY",
  "LEGISCAN_API_KEY",
  "OPENSTATES_API_KEY",
  "TAVILY_API_KEY",
  "BRAVE_API_KEY",
  "OPENALEX_API_KEY",
] as const;

export type SixScreenSecretName =
  (typeof SIX_SCREEN_SECRET_NAMES)[number];

type Definition = Omit<
  SourceCapability,
  "configured" | "tested" | "enabled" | "status" | "lastHarmlessProbe"
> & { secretName: SixScreenSecretName | null };

const definitions: Record<SixScreenSourceId, Definition> = {
  federal_register: {
    provider: "Federal Register",
    adapterVersion: "six-screen-federal-register-policy-v4",
    implemented: true,
    secretName: null,
    permittedHosts: ["www.federalregister.gov", "federalregister.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["administrative_rule", "notice", "presidential_document"],
    historicalCoverage: "Provider metadata plus exact-record published HTML/text, source-native CFR coordinates, and exact contemporaneous amendatory instructions retained when bounded codified history is unavailable.",
    authentication: "none",
    operations: {
      resolveIdentity: true,
      searchRecords: true,
      getRecord: true,
      listRepresentations: true,
      fetchRepresentation: true,
    },
    supportedFormats: ["json", "html", "text"],
    ratePolicy: "No paid route; bounded per-task and per-publisher requests.",
    limitation: "The bounded exact-record route recognizes operative, legal-effect, implementation-schedule, formal-coverage, explicit exemption, CFR title/part coordinates, and exact amendatory instructions. Those instructions do not establish a codified historical version or legal edition; broader reconstruction still requires later adapters and review.",
  },
  reviewed_official_documents: {
    provider: "Reviewed documentary and explanatory routes",
    adapterVersion:
      `screen-01-reviewed-official-document-index-v1+${SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION}`,
    implemented: true,
    secretName: null,
    permittedHosts: [
      "leg.colorado.gov",
      "legacylis.virginia.gov",
      "leginfo.legislature.ca.gov",
      "oag.ca.gov",
      "www.federalregister.gov",
      "www.ftc.gov",
      "www.leg.state.nv.us",
      "www.legislation.gov.uk",
      ...SCREEN_02_COMPLEMENTARY_OFFICIAL_PAGE_HOSTS,
      ...SCREEN_02_COMPLEMENTARY_SPECIALIST_PAGE_HOSTS,
    ],
    jurisdictions: [
      "United States",
      "United States states",
      "United Kingdom",
    ],
    languages: ["en"],
    documentFamilies: [
      "state_legislation",
      "statute",
      "official_guidance",
      "official_document",
      "official_explanation",
      "implementation_record",
      "specialist_analysis",
    ],
    historicalCoverage:
      "Reviewed, source-bound records plus bounded identity-matched official explanations, implementation pages, and attributed specialist analysis. Screen 2 preserves authorship, publication date, source role, version scope, and exact inspected passages independently of controlling-document parsing.",
    authentication: "none",
    operations: {
      resolveIdentity: true,
      searchRecords: true,
      getRecord: true,
      listRepresentations: true,
      fetchRepresentation: true,
    },
    supportedFormats: ["html", "text"],
    ratePolicy:
      "The build-validated retained index is searched within the cumulative Screen 1 limits; no live provider request or quota is consumed during navigation.",
    limitation:
      "Only reviewed hosts and inspected identity-bound pages are retained. Explanatory material supplies orientation only: it cannot complete precise historical coverage, exemptions, enforcement, sanctions, legal version, or treatment timing, and remains distinct from controlling-text reconstruction.",
  },
  govinfo: {
    provider: "GovInfo",
    adapterVersion:
      `${SCREEN_01_GOVINFO_STATUTE_DISCOVERY_VERSION}+govinfo-federal-register-exact-granule-v1+${SIX_SCREEN_GOVINFO_ANNUAL_CFR_ADAPTER_VERSION}`,
    implemented: true,
    secretName: "GOVINFO_API_KEY",
    permittedHosts: ["api.govinfo.gov", "www.govinfo.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["statute", "administrative_rule", "official_publication"],
    historicalCoverage: "Documented package-level public-law discovery with original HTML identity validation; exact Federal Register granule retrieval; and one exact historical annual-CFR section selected only after a metadata-bound eCFR delta.",
    authentication: "server_secret",
    operations: { resolveIdentity: true, searchRecords: true, getRecord: true, listRepresentations: true, fetchRepresentation: true },
    supportedFormats: ["json", "html", "xml"],
    ratePolicy: "Credential-gated bounded package search and exact-record reads; the key is sent only in a server header and cumulative task limits still apply.",
    limitation: "The public-law route validates package identity and the original HTML but does not silently substitute later codification or implementing rules. The Federal Register/CFR route remains exact-record and does not parse PDFs or search arbitrary history.",
  },
  ecfr: {
    provider: "eCFR",
    adapterVersion: SIX_SCREEN_ECFR_HISTORY_ADAPTER_VERSION,
    implemented: true,
    secretName: null,
    permittedHosts: ["www.ecfr.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["administrative_rule"],
    historicalCoverage: "A bounded content-version metadata window binds one substantive amendment date to an exact section set and its eCFR issue-date metadata, then compares the complete requested CFR part immediately before and on the confirmed legal-effective date.",
    authentication: "none",
    operations: { resolveIdentity: false, searchRecords: false, getRecord: true, listRepresentations: true, fetchRepresentation: true },
    supportedFormats: ["json", "xml"],
    ratePolicy: "No paid route; one bounded content-version metadata read and at most two bounded point-in-time XML reads after the exact Federal Register coordinate anchor.",
    limitation: "The route supports one unambiguous CFR title/part, one same-week issue window for an exact substantive amendment date, and two bounded snapshots. It rejects inconsistent version dates, does not substitute current text or search arbitrary history, and does not establish the official legal edition.",
  },
  regulations_gov: {
    provider: "Regulations.gov",
    adapterVersion: SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION,
    implemented: true,
    secretName: "REGULATIONS_API_KEY",
    permittedHosts: ["api.regulations.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["docket", "implementation_record", "stakeholder_submission"],
    historicalCoverage: "Bounded document search followed by one exact document-detail read; retained fields are limited to administrative-record identity, docket binding, Federal Register coordinates, document type, and provider-reported stage dates.",
    authentication: "server_secret",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: true, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["json"],
    ratePolicy: "One bounded document search and at most three exact detail attempts per dedicated Screen 2 docket step; the key is sent only in the X-Api-Key server header.",
    limitation: "Administrative metadata can establish a docket/document binding and provider-reported stages, but is never controlling legal text and cannot by itself establish implementation, enforcement, sanctions, or sample exposure.",
  },
  congress_gov: {
    provider: "Congress.gov",
    adapterVersion:
      `${SCREEN_01_CONGRESS_STATUTE_IDENTITY_VERSION}+${SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION}`,
    implemented: true,
    secretName: "CONGRESS_API_KEY",
    permittedHosts: ["api.congress.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["bill", "statute", "amendment"],
    historicalCoverage: "After GovInfo name discovery supplies exact public-law coordinates, the documented law endpoint binds those coordinates to a native bill identity, the bill-text endpoint supplies an exact official representation for inspection, and the native bill-summary endpoint can supply an attributed CRS introduction whose stage and date remain explicit.",
    authentication: "server_secret",
    operations: { resolveIdentity: true, searchRecords: false, getRecord: true, listRepresentations: true, fetchRepresentation: true },
    supportedFormats: ["json", "html", "xml", "text"],
    ratePolicy: "Exact public-law, native bill-text, and native bill-summary metadata reads only, followed by bounded inspected representations; the key is sent only in the X-Api-Key server header.",
    limitation: "Congress.gov is not represented as providing free-text statute search. GovInfo remains the name-discovery and original public-law evidence route. A CRS summary is attributed explanatory material, never silently substituted for enacted text or precise historical legal conditions.",
  },
  legiscan: {
    provider: "LegiScan",
    adapterVersion: "not-implemented",
    implemented: false,
    secretName: "LEGISCAN_API_KEY",
    permittedHosts: ["api.legiscan.com"],
    jurisdictions: ["United States states"],
    languages: ["en"],
    documentFamilies: ["bill", "statute", "amendment"],
    historicalCoverage: "Not yet implemented or measured in the Worker.",
    authentication: "server_secret",
    operations: { resolveIdentity: false, searchRecords: false, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: [],
    ratePolicy: "No request until an approved account and adapter are present.",
    limitation: "State legislative adapter is not implemented.",
  },
  openstates: {
    provider: "Open States",
    adapterVersion: OPENSTATES_BILL_ADAPTER_VERSION,
    implemented: true,
    secretName: "OPENSTATES_API_KEY",
    permittedHosts: ["v3.openstates.org", "openstates.org"],
    jurisdictions: ["United States states", "District of Columbia", "Puerto Rico"],
    languages: ["en"],
    documentFamilies: ["bill", "statute", "amendment", "legislative_history"],
    historicalCoverage:
      "Nationwide state-legislative bill discovery across bounded alias variants and older result pages, with identifiers, abstracts, actions, versions, documents, and official legislature locators. Screen 1 may separately inspect one linked public legislature page for identity text.",
    authentication: "server_secret",
    operations: {
      resolveIdentity: true,
      searchRecords: true,
      getRecord: true,
      listRepresentations: true,
      fetchRepresentation: false,
    },
    supportedFormats: ["json"],
    ratePolicy:
      "Credential-gated searches use at most three ordered name variants or three older pages, ten records per request, and a shared task ceiling; the key is sent only in a server header.",
    limitation:
      "Open States is a discovery and legislative-history source. Linked official state documents remain controlling for exact text, legal effect, and historical version.",
  },
  eu_cellar: {
    provider: "EU CELLAR",
    adapterVersion: "screen-01-official-policy-document-v1+legacy-eu-cellar-metadata-v1",
    implemented: true,
    secretName: null,
    permittedHosts: ["publications.europa.eu", "eur-lex.europa.eu"],
    jurisdictions: ["European Union"],
    languages: ["en"],
    documentFamilies: ["eu_instrument"],
    historicalCoverage: "Official CELLAR title metadata plus one bounded current EUR-Lex text representation for identity and initial Screen 2 briefing; historical expressions and national transposition remain unresolved.",
    authentication: "none",
    operations: { resolveIdentity: true, searchRecords: true, getRecord: true, listRepresentations: true, fetchRepresentation: true },
    supportedFormats: ["sparql-json", "html"],
    ratePolicy: "Bounded public metadata reads and at most two permitted official-content attempts per candidate within the shared Screen 1 budget.",
    limitation: "English title search and bounded current official text support identity and an initial briefing only. Historical expressions, consolidated-version completeness, implementation, and national transposition are not established.",
  },
  uk_legislation: {
    provider: "UK Legislation",
    adapterVersion: "screen-01-official-policy-document-v1+legacy-uk-legislation-feed-v1",
    implemented: true,
    secretName: null,
    permittedHosts: ["www.legislation.gov.uk"],
    jurisdictions: ["United Kingdom"],
    languages: ["en"],
    documentFamilies: ["statute", "regulation"],
    historicalCoverage: "Official title-feed metadata plus a bounded legislation.gov.uk XML or HTML representation for identity and initial Screen 2 briefing; point-in-time completeness remains unresolved.",
    authentication: "none",
    operations: { resolveIdentity: true, searchRecords: true, getRecord: true, listRepresentations: true, fetchRepresentation: true },
    supportedFormats: ["atom", "xml", "html"],
    ratePolicy: "Bounded public feed reads and at most two permitted official-content attempts per candidate within the shared Screen 1 budget.",
    limitation: "The current route retains bounded official text for identity and an initial briefing. Commencement, territorial extent, amendments, revised text, and point-in-time completeness still require review.",
  },
  tavily: {
    provider: "Tavily",
    adapterVersion: "not-implemented",
    implemented: false,
    secretName: "TAVILY_API_KEY",
    permittedHosts: ["api.tavily.com"],
    jurisdictions: ["supplemental"],
    languages: ["multi"],
    documentFamilies: ["discovery_lead"],
    historicalCoverage: "Not applicable until approved configuration and adapter implementation.",
    authentication: "server_secret",
    operations: { resolveIdentity: false, searchRecords: false, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: [],
    ratePolicy: "No automatic escalation, generated answer, images, pay-as-you-go, or unreserved credits.",
    limitation: "Supplemental search is not configured or implemented.",
  },
  brave: {
    provider: "Brave Search",
    adapterVersion: "not-implemented",
    implemented: false,
    secretName: "BRAVE_API_KEY",
    permittedHosts: ["api.search.brave.com"],
    jurisdictions: ["supplemental"],
    languages: ["multi"],
    documentFamilies: ["discovery_lead"],
    historicalCoverage: "Optional alternative only.",
    authentication: "server_secret",
    operations: { resolveIdentity: false, searchRecords: false, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: [],
    ratePolicy: "No request before separate configuration review.",
    limitation: "Optional fallback is not configured or implemented.",
  },
  openalex: {
    provider: "OpenAlex",
    adapterVersion: SIX_SCREEN_OPENALEX_LITERATURE_PROTOCOL_VERSION,
    implemented: true,
    secretName: "OPENALEX_API_KEY",
    permittedHosts: ["api.openalex.org"],
    jurisdictions: ["scholarly"],
    languages: ["multi"],
    documentFamilies: [
      "scholarly_metadata",
      "scholarly_abstract",
      "open_location_metadata",
    ],
    historicalCoverage: "Work identity, author, venue, publication-date, retraction flag, provider-supplied reconstructed abstract, content-URL metadata, and reported open-location metadata; no location or full-text retrieval.",
    authentication: "server_secret",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["json"],
    ratePolicy: "One bounded authenticated work search per branch; the installed key is sent only in the documented Bearer header and never in a URL. No retry, paging, citation expansion, paid escalation, or unreserved usage.",
    limitation: "The legacy Screen 5 executor requires the configured server-side OpenAlex gate and a successful operation-shaped probe. Study-first discovery may use the reviewed anonymous route. Only a returned abstract is evidence text; metadata and reported locations remain unvisited leads, and no full text is inferred.",
  },
  crossref: {
    provider: "Crossref",
    adapterVersion:
      `crossref-contextual-discovery-v1+${SIX_SCREEN_CROSSREF_LITERATURE_PROTOCOL_VERSION}`,
    implemented: true,
    secretName: null,
    permittedHosts: ["api.crossref.org"],
    jurisdictions: ["scholarly"],
    languages: ["multi"],
    documentFamilies: ["scholarly_metadata", "scholarly_abstract"],
    historicalCoverage: "Bibliographic identity, author, venue, publication date, member-deposited abstract, and deposited update metadata; no full-text retrieval.",
    authentication: "none",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: true, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["json"],
    ratePolicy: "Bounded metadata reads using the retained polite client route.",
    limitation: "Only an abstract actually returned in the Crossref member deposit is evidence text. Metadata-only records support no detailed claim, and no linked full text is fetched or inferred.",
  },
  gdelt: {
    provider: "GDELT DOC 2.0",
    adapterVersion: CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION,
    implemented: true,
    secretName: null,
    permittedHosts: ["api.gdeltproject.org"],
    jurisdictions: ["supplemental"],
    languages: ["multi"],
    documentFamilies: ["discovery_lead"],
    historicalCoverage:
      "A bounded recent ArticleList lookup returns discovery metadata only; Screen 2 may retain a claim only after separately fetching an approved underlying page and validating it against the confirmed policy identity.",
    authentication: "none",
    operations: {
      resolveIdentity: false,
      searchRecords: true,
      getRecord: false,
      listRepresentations: false,
      fetchRepresentation: false,
    },
    supportedFormats: ["json"],
    ratePolicy:
      "One bounded recent ArticleList request with at most five leads; no article snippet is evidence and only reviewed underlying hosts can be inspected.",
    limitation:
      "GDELT is a discovery index, not a policy authority or evidence host. A title, snippet, or HTTP success never becomes a Screen 2 claim.",
  },
  openfema: {
    provider: "OpenFEMA",
    adapterVersion: "legacy-openfema-disaster-v1",
    implemented: true,
    secretName: null,
    permittedHosts: ["www.fema.gov"],
    jurisdictions: ["United States"],
    languages: ["en"],
    documentFamilies: ["hazard_event"],
    historicalCoverage: "Provider disaster declaration records.",
    authentication: "none",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["json"],
    ratePolicy: "Bounded co-event reads only; never focal-policy discovery.",
    limitation: "Reserved for relevant Screen 4 event occurrence.",
  },
  usgs: {
    provider: "USGS",
    adapterVersion: "legacy-usgs-earthquake-v1",
    implemented: true,
    secretName: null,
    permittedHosts: ["earthquake.usgs.gov"],
    jurisdictions: ["global"],
    languages: ["en"],
    documentFamilies: ["hazard_event"],
    historicalCoverage: "Provider earthquake catalog coverage.",
    authentication: "none",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["geojson"],
    ratePolicy: "Bounded co-event reads only; never focal-policy discovery.",
    limitation: "Reserved for relevant Screen 4 event occurrence.",
  },
  gdacs: {
    provider: "GDACS",
    adapterVersion: "legacy-gdacs-event-v1",
    implemented: true,
    secretName: null,
    permittedHosts: ["www.gdacs.org"],
    jurisdictions: ["global"],
    languages: ["en"],
    documentFamilies: ["hazard_event"],
    historicalCoverage: "Provider event-feed coverage.",
    authentication: "none",
    operations: { resolveIdentity: false, searchRecords: true, getRecord: false, listRepresentations: false, fetchRepresentation: false },
    supportedFormats: ["geojson"],
    ratePolicy: "Bounded co-event reads only; never focal-policy discovery.",
    limitation: "Reserved for relevant Screen 4 event occurrence.",
  },
};

export type SixScreenCapabilityProbe = NonNullable<
  SourceCapability["lastHarmlessProbe"]
>;

export function buildSixScreenSourceRegister(input: {
  configuredSecrets?: Partial<Record<SixScreenSecretName, boolean>>;
  probes?: Partial<Record<SixScreenSourceId, SixScreenCapabilityProbe>>;
} = {}) {
  return Object.fromEntries(
    (Object.entries(definitions) as [SixScreenSourceId, Definition][]).map(
      ([id, definition]) => {
        const configured = definition.secretName === null ||
          input.configuredSecrets?.[definition.secretName] === true;
        const probe = input.probes?.[id] ?? null;
        const tested = probe !== null;
        const requiresCredential = definition.secretName !== null;
        const enabled = definition.implemented && configured &&
          (probe?.outcome === "success" ||
            (!requiresCredential && probe === null));
        const status = !configured
          ? "not_configured" as const
          : !definition.implemented
            ? "policy_blocked" as const
            : probe?.outcome === "success"
              ? "healthy" as const
              : probe?.outcome === "rate_limited"
                ? "quota_exhausted" as const
                : probe?.outcome === "failure"
                  ? "degraded" as const
                  : probe?.outcome === "auth_required"
                  ? "degraded" as const
                    : requiresCredential
                      ? "configured_not_tested" as const
                      : "enabled_not_tested" as const;
        const { secretName: _secretName, ...publicDefinition } = definition;
        const capability: SourceCapability = {
          ...publicDefinition,
          configured,
          tested,
          enabled,
          status,
          lastHarmlessProbe: probe,
        };
        return [id, validateSourceCapability(capability)];
      },
    ),
  ) as Record<SixScreenSourceId, SourceCapability>;
}
