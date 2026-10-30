import worker from "../../src/worker/index";
import {
  FEDERAL_REGISTER_API_ENDPOINT,
  OPEN_FEMA_API_ENDPOINT,
  type Screen02ConnectorFetch,
} from "../../src/worker/screen02-connectors";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { GDELT_DOC_API_ENDPOINT } from "../../src/worker/contextual-discovery";
import {
  EU_CELLAR_SPARQL_ENDPOINT,
  SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES,
  UK_LEGISLATION_ATOM_ENDPOINT,
} from "../../src/worker/screen02-global-connectors";
import type { ShockAuditEnv } from "../../src/worker/server";
import { readScreen02BoundedResponseText } from "../../src/worker/screen02-bounded-response";
import {
  screen02ProductionPeerBoundFetch,
  SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
} from "../../src/worker/screen02-secure-transport";
import { InMemoryScreen02WorkflowStore } from "../../src/worker/screen02-workflow-store";
import { InMemoryScreen03WorkflowStore } from "../../src/worker/screen03-workflow-store";
import { SixScreenEvidenceStore } from "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from "../../src/worker/six-screen-research-task-store";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { SCREEN02_BROWSER_FIXTURE_NOW_ISO } from "./fixture-clock";

type BrowserFixtureEnv = {
  ASSETS: Fetcher;
};

const canonicalWorkflowStore = new InMemoryScreen02WorkflowStore();
const canonicalScreen03WorkflowStore = new InMemoryScreen03WorkflowStore();
const sixScreenStorage = new InMemorySixScreenWorkflowStorage();
const sixScreenWorkflowStore = new SixScreenWorkflowStore(sixScreenStorage);
const sixScreenResearchTaskStore = new SixScreenResearchTaskStore(
  sixScreenStorage,
);
const sixScreenEvidenceStore = new SixScreenEvidenceStore(sixScreenStorage);
let browserFixtureSigningKey: string | undefined;
const OFFICIAL_TRANSPORT_PROBE_PATH =
  "/__browser-fixture/official-transport-probe";
const OFFICIAL_TRANSPORT_PROBE_UPSTREAM_URL =
  "https://www.legislation.gov.uk/all/2023/data.feed?title=Procurement%20Act%202023";
const OFFICIAL_TRANSPORT_PROBE_TIMEOUT_MS = 20_000;
const OFFICIAL_TRANSPORT_PROBE_XML_CONTENT_TYPES = new Set([
  "application/atom+xml",
  "application/xml",
  "text/xml",
]);
const EXPECTED_GAMING_QUERY_TERMS = new Set([
  "video game",
  "video gaming",
  "video game console",
  "interactive entertainment",
  "game software",
  "online game",
]);

const EXPECTED_CURRENT_GAMING_QUERY_TERMS = new Set([
  "Video gaming",
  "computer games",
  "game developer",
  "downloadable game content",
  "game development",
  "free to play",
  "app distribution",
  "Video gaming united states us usa united states of america",
  "Video gaming united states us federal us states",
  "Video gaming us usa united states of america",
  "Video gaming regulation",
  "Video gaming regulation 2014 2022",
  "Video gaming Regulation official title identifier issuing authority",
  "Video gaming Regulation enacted adopted effective commencement date",
  "Video gaming Regulation covered entities eligibility threshold exemption",
]);

const EXPECTED_ENERGY_QUERY_TERMS = new Set([
  "Energy",
  "electric power",
  "electric utility",
  "electricity",
  "energy distribution",
  "energy sector",
  "Energy united states us usa united states of america",
  "Energy united states us federal us states",
  "Energy us usa united states of america",
  "Energy regulation",
  "Energy regulation 2014 2022",
  "Energy eligibility threshold",
  "Energy Regulation official title identifier issuing authority",
  "Energy Regulation enacted adopted effective commencement date",
  "Energy Regulation covered entities eligibility threshold exemption",
]);

const EXPECTED_MANUFACTURING_QUERY_TERMS = new Set([
  "Manufacturing",
  "Manufacturing California consumer privacy business thresholds",
  "Manufacturing consumer data privacy regulation technology firms",
  "advanced manufacturing",
  "factory operator",
  "industrial product",
  "assembly",
  "industrial production",
  "Manufacturing united states us usa united states of america",
  "Manufacturing united states us federal us states",
  "Manufacturing us usa united states of america",
  "Manufacturing regulation",
  "Manufacturing regulation 2014 2022",
  "Manufacturing eligibility threshold",
  "Manufacturing Regulation official title identifier issuing authority",
  "Manufacturing Regulation enacted adopted effective commencement date",
  "Manufacturing Regulation covered entities eligibility threshold exemption",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms official title identifier issuing authority",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms enacted adopted effective commencement date",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms covered entities eligibility threshold exemption",
]);

const EXPECTED_TECHNOLOGY_QUERY_TERMS = new Set([
  "Technology",
  "connected device",
  "data protection",
  "personal data",
  "personal information",
  "Technology California consumer privacy business thresholds",
  "Technology consumer data privacy regulation technology firms",
  "Technology united states us usa united states of america",
  "Technology united states us federal us states",
  "Technology us usa united states of america",
  "Technology regulation",
  "Technology eligibility threshold",
  "Technology reporting disclosure",
  "Technology licensing permit",
  "Technology safety standard",
  "Technology market access restriction",
  "Technology tax fee assessment",
  "Technology Regulation official title identifier issuing authority",
  "Technology Regulation enacted adopted effective commencement date",
  "Technology Regulation covered entities eligibility threshold exemption",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms official title identifier issuing authority",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms enacted adopted effective commencement date",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms covered entities eligibility threshold exemption",
]);

const EXPECTED_CCPA_AUDIT_EXPANDED_QUERY_TERMS = new Set([
  "California Consumer Privacy Act California Legislature official title identifier issuing authority",
  "California Consumer Privacy Act California Legislature enacted adopted effective commencement date",
  "California Consumer Privacy Act California Legislature covered entities eligibility threshold exemption",
]);

const EXPECTED_STUDY_FIRST_EVENT_QUERY_TERMS = new Set([
  "Manufacturing industry California firms non-california firms regulation requirement",
  "Manufacturing industry California firms non-california firms market financing industry",
  "California firms non-california firms Manufacturing industry compliance supply",
  "Firm performance Manufacturing industry reporting classification",
]);

const EXPECTED_FTC_RECOVERY_SCOPES = new Set([
  "video game\u00002014-01-01\u00002022-12-31",
  "energy\u00002014-01-01\u00002022-12-31",
  "manufacturing\u00002014-01-01\u00002022-12-31",
  "technology\u00002016-01-01\u00002020-12-31",
  "technology\u00002017-01-01\u00002023-12-31",
]);

const EXPECTED_FEDERAL_REGISTER_FIELDS = [
  "document_number",
  "title",
  "type",
  "abstract",
  "action",
  "excerpts",
  "html_url",
  "pdf_url",
  "raw_text_url",
  "body_html_url",
  "publication_date",
  "effective_on",
  "agencies",
] as const;

// These are exact request/response contracts for the browser journeys. The
// title fields are bounded reviewed fixture labels, not downloaded live data.
function expectedCellarQuery(
  titleTerms: readonly string[],
  startDate: string,
  endDate: string,
  celexId?: string,
) {
  return [
    "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
    "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>",
    "SELECT DISTINCT ?work ?celex ?title ?date ?type WHERE {",
    "  ?work cdm:work_date_document ?date .",
    "  ?work cdm:work_id_document ?celex .",
    "  ?expression cdm:expression_belongs_to_work ?work ;",
    "    cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;",
    "    cdm:expression_title ?title .",
    "  OPTIONAL { ?work cdm:resource_legal_type ?type . }",
    `  FILTER(?date >= "${startDate}"^^xsd:date && ?date <= "${endDate}"^^xsd:date)`,
    celexId
      ? `  FILTER(STR(?celex) = "${celexId}")`
      : `  FILTER(${titleTerms.map((term) =>
          `CONTAINS(LCASE(STR(?title)), LCASE("${term}"))`
        ).join(" || ")})`,
    "}",
    "ORDER BY DESC(?date)",
    "LIMIT 5",
  ].join("\n");
}

const electricityCellarRecord = {
  work: {
    value: "http://publications.europa.eu/resource/cellar/electricity-market-design",
  },
  celex: { value: "32024R1747" },
  title: { value: "Electricity Market Design Regulation" },
  date: { value: "2024-06-13" },
  type: {
    value: "http://publications.europa.eu/resource/authority/resource-type/REG",
  },
};
const gdprCellarRecord = {
  work: {
    value: "http://publications.europa.eu/resource/celex/32016R0679",
  },
  celex: { value: "32016R0679" },
  title: { value: "General Data Protection Regulation" },
  date: { value: "2016-04-27" },
  type: {
    value: "http://publications.europa.eu/resource/authority/resource-type/REG",
  },
};
const expectedCellarRecords = new Map([
  [
    expectedCellarQuery(["electricity"], "2021-01-01", "2024-12-31"),
    electricityCellarRecord,
  ],
  [
    expectedCellarQuery([], "2012-01-01", "2026-12-31", "32016R0679"),
    gdprCellarRecord,
  ],
  // Screen 3 bounds legal research to the 2015–2023 study period plus
  // three years, and CELLAR keeps the first eight unique title terms.
  ...[
    "announcement", "enactment", "effective", "implementation",
    "enforcement", "amendment",
  ].map((stageTerm) => [
    expectedCellarQuery(
      ["regulation", "2016", "679", "gdpr", "general", "data", "protection", stageTerm],
      "2012-01-01",
      "2026-12-31",
    ),
    gdprCellarRecord,
  ] as const),
]);

const federalRegisterRecords = [
  {
    title: "Casino Slot Machine Reporting Rule",
    abstract:
      "Casino wagering operators must report slot machine and gambling receipts.",
    document_number: "2015-91001",
    publication_date: "2015-02-01",
  },
  {
    title: "Commercial Fishery Electronic Reporting Rule",
    abstract:
      "Commercial fishing vessels must submit electronic catch records.",
    document_number: "2015-91002",
    publication_date: "2015-03-01",
  },
  {
    title: "PlayStation Import Licensing Rule",
    abstract:
      "Import licensing requirements for PlayStation video game hardware.",
    document_number: "2013-91003",
    publication_date: "2013-12-15",
  },
  {
    title: "Xbox Network Access Rule",
    abstract:
      "Network access requirements for Xbox online game services.",
    document_number: "2017-91004",
    publication_date: "2017-01-15",
  },
  {
    title: "Video Game Consumer Disclosure Rule",
    abstract:
      "Requires sellers to place standardized software and downloadable content notices in digital storefronts before purchase, changing storefront information design and the presentation of monetization experiments. The record does not identify obligated publishers, distributors, or storefront operators and supplies no firm-level compliance records or rollout date.",
    document_number: "2014-92001",
    publication_date: "2014-04-10",
  },
  {
    title: "Interactive Entertainment Accessibility Standards",
    abstract:
      "Applies accessibility requirements to covered interactive entertainment products and redirects interface engineering toward accessible controls and reusable interface capabilities. Product conformance reports identify covered products, but developer, publisher, platform, and corporate-parent linkage is required.",
    document_number: "2014-92002",
    publication_date: "2014-09-18",
  },
  {
    title: "Game Software Privacy Safeguards",
    abstract:
      "Applies privacy safeguards to game software services that operate player accounts and profiles. The safeguards constrain data collection and personalization experiments; historical privacy notices identify service-level controllers that require linkage to corporate parents.",
    document_number: "2015-92003",
    publication_date: "2015-01-22",
  },
  {
    title: "Console Gaming Energy Labeling Requirements",
    abstract:
      "Applies energy-label requirements to covered video game console products. Model-level labels and test records report power-use ratings that may require efficiency engineering and component selection; model ownership must be linked to manufacturers.",
    document_number: "2015-92004",
    publication_date: "2015-06-30",
  },
  {
    title: "Online Game Children's Data Protection Rule",
    abstract:
      "Applies to online game services directed to children or known to have young users and requires age assurance, parental consent, and child-directed feature design controls. Archived service flows rather than firm-level treatment flags show compliance.",
    document_number: "2016-92005",
    publication_date: "2016-03-14",
  },
  {
    title: "Video Gaming Digital Purchase Notice",
    abstract:
      "Applies to video-gaming marketplace operators and requires disclosures before digital purchases. The required notices reshape checkout interfaces, refund expectations, and monetization experiments; archived checkout flows show implementation, while publishers are implicated only through a covered storefront role.",
    document_number: "2016-92006",
    publication_date: "2016-10-05",
  },
] as const;

// The canonical Manufacturing browser journey deliberately receives no
// Federal Register hit. Its positive result must come from a reviewed real
// source (currently California SB 327), never a made-up official citation.
const manufacturingRecords = [] as const;

const order841Title =
  "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
const order841LandingPage =
  "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
const order841BodyHtml =
  "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
const order841RawText =
  "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt";
const order841Records = [{
  document_number: "2018-03708",
  title: order841Title,
  type: "Rule",
  action: "Final rule.",
  abstract:
    "The Federal Energy Regulatory Commission is amending its regulations to remove barriers to electric storage participation in capacity, energy, and ancillary service markets operated by regional transmission organizations and independent system operators.",
  html_url: order841LandingPage,
  pdf_url:
    "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
  body_html_url: order841BodyHtml,
  raw_text_url: order841RawText,
  publication_date: "2018-03-06",
  effective_on: "2018-06-04",
  agencies: [{ name: "Federal Energy Regulatory Commission" }],
}] as const;

const order841Document = `<!doctype html>
<html lang="en"><head><title>${order841Title}</title></head>
<body><main>
<h1>AGENCY:</h1><p>Federal Energy Regulatory Commission.</p>
<h1>ACTION:</h1><p>Final rule.</p>
<h1>SUMMARY:</h1><p>This final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources.</p>
<p>The participation model permits electric storage resources to participate in capacity, energy, and ancillary service markets while recognizing their physical and operational characteristics.</p>
<h1>DATES:</h1><p>This final rule is effective June 4, 2018.</p>
<p>[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]</p>
</main></body></html>`;

const ftcGamingActionTitle =
  "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program";
const ftcGamingActionPath =
  "/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program";
const ftcGamingActionUrl = `https://www.ftc.gov${ftcGamingActionPath}`;
const ftcGamingApprovalLetterTitle =
  "Commission Letter Approving the Entertainment Software Rating Board Privacy Certified Kids Seal Requirements (As Modified and Attached As Exhibit A)";
const ftcGamingApprovalLetterUrl =
  "https://www.ftc.gov/system/files/attachments/press-releases/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program/p024526_commission_letter_approving_modified_esrb_program_and_exhibit_a.pdf";
const ftcGamingListingDocument = `<!doctype html><html><body>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 1 of 1</div></div>
<article class="node node--type-press-release node--view-mode-search-result">
  <div class="node__content"><div class="group">
    <h3 class="node-title"><a href="${ftcGamingActionPath}">${ftcGamingActionTitle}</a></h3>
    <div class="field field--name-field-date"><div class="field__item"><time datetime="2018-08-14T12:00:00Z">August 14, 2018</time></div></div>
    <div class="field field--name-body field--type-text-with-summary"><div class="field__items"><div class="field__item">The Federal Trade Commission approved changes to a video game industry self-regulatory program aimed at ensuring compliance with the Children’s Online Privacy Protection Act Rule.</div></div></div>
  </div></div>
</article>
<div class="view-results-info"><div class="view-summary">Displaying 1 - 1 of 1</div></div>
</body></html>`;
const ftcGamingActionDocument = `<!doctype html><html><head><title>${ftcGamingActionTitle}</title></head>
<body><main><h1>${ftcGamingActionTitle}</h1>
<p>The Federal Trade Commission approved changes to a video game industry self-regulatory program aimed at ensuring compliance with the Children’s Online Privacy Protection Act Rule.</p>
<p>The Rule requires operators of commercial websites and online services directed to children under 13 to obtain parental consent before collecting, using, or disclosing personal information.</p>
<p>The revised guidelines approved by the Commission include changes addressing personal information, audio recordings, and geolocation requirements for the covered program.</p>
<p><a href="${ftcGamingApprovalLetterUrl}">${ftcGamingApprovalLetterTitle}</a></p>
</main></body></html>`;

// Screen 3 browser acceptance needs deterministic controlling-text excerpts,
// not live web pages. Only these exact, already-reviewed fixture locators are
// served; every other URL still falls through to the strict rejection below.
const ccpaStatuteDocument = `<!doctype html>
<html lang="en"><head><title>California Consumer Privacy Act of 2018</title></head>
<body><main>
<h1>California Consumer Privacy Act of 2018</h1>
<p>Formal identifier: AB 375.</p>
<p>AB 375 was enacted and approved on June 28, 2018 (2018-06-28).</p>
<p>The title became effective and operative on January 1, 2020 (2020-01-01).</p>
<p>The official record concerns California, United States.</p>
<p>The California Consumer Privacy Act established consumer rights and requires covered businesses to implement disclosure, deletion, opt-out, and nondiscrimination duties.</p>
<p>The original AB 375 business definition covered qualifying for-profit legal entities doing business in California that collected consumers' personal information, determined the purposes and means of processing it, and met at least one historical threshold: annual gross revenue over $25 million; annually buying, receiving, selling, or sharing for commercial purposes the personal information of 50,000 or more consumers, households, or devices; or deriving 50 percent or more of annual revenue from selling consumers' personal information.</p>
<p>U.S. technology firms that do business in California, collect California consumers' personal information, alone or jointly determine the purposes and means of its processing, meet at least one historical statutory threshold, and are not otherwise exempt are a covered subset of those businesses.</p>
<p>Coverage must distinguish California business nexus, the historical threshold version, personal-information activity, and statutory exemptions; the act did not automatically cover every United States technology firm.</p>
</main></body></html>`;

const ccpaInitiativeDocument = `<!doctype html>
<html lang="en"><head><title>Proposed initiative enters circulation: new consumer privacy rights</title></head>
<body><main>
<h1>Proposed initiative enters circulation: new consumer privacy rights</h1>
<p>The California Secretary of State recorded the proposed consumer-privacy initiative as entering circulation on December 18, 2017 (2017-12-18).</p>
<p>This circulation date is an early public milestone. It is not the June 28, 2018 enactment of AB 375 or the January 1, 2020 operative date of the California Consumer Privacy Act.</p>
</main></body></html>`;

const ccpaOfficialOverviewDocument = `<!doctype html>
<html lang="en"><head><title>California Consumer Privacy Act (CCPA)</title></head>
<body><main>
<h1>California Consumer Privacy Act (CCPA)</h1>
<p>The California Consumer Privacy Act gives California consumers more control over the personal information that businesses collect about them.</p>
<p>The law provides rights to know, delete, opt out of sale or sharing, correct inaccurate information, limit the use of sensitive personal information, and avoid discrimination for exercising those rights.</p>
<p>The law applies to qualifying for-profit businesses doing business in California, subject to the applicable statutory thresholds and exemptions.</p>
<p>The California Privacy Rights Act later amended the CCPA, expanded consumer rights, and added protections beginning January 1, 2023.</p>
</main></body></html>`;

const ccpaInitialReasonsDocument = `<!doctype html>
<html lang="en"><head><title>Initial Statement of Reasons for California Consumer Privacy Act Regulations</title></head>
<body><main>
<h1>Initial Statement of Reasons for California Consumer Privacy Act Regulations</h1>
<p>The California Department of Justice described proposed implementation rules for the California Consumer Privacy Act and the consumer requests and business processes addressed by those rules.</p>
<p>The administrative record concerns implementation. It does not replace the statute's June 28, 2018 enactment date or January 1, 2020 operative date.</p>
<p>Firm-level research must reconstruct the historical business thresholds, exemptions, California nexus, and personal-information activity before classifying an organization as covered.</p>
</main></body></html>`;

const ccpaRegulatorPressReleaseDocument = `<!doctype html>
<html lang="en"><head><title>Attorney General submits CCPA regulations for approval</title></head>
<body><main>
<h1>Attorney General submits CCPA regulations for approval</h1>
<p>The California Consumer Privacy Act was signed into law on June 28, 2018.</p>
<p>The California Consumer Privacy Act went into effect on January 1, 2020 and will be enforced starting July 1, 2020.</p>
<p>The regulations provide implementation guidance for covered businesses.</p>
</main></body></html>`;

const gdprDocument = `<!doctype html>
<html lang="en"><head><title>Regulation (EU) 2016/679</title></head>
<body><main>
<h1>General Data Protection Regulation — Regulation (EU) 2016/679</h1>
<p>The regulation was enacted and published on May 4, 2016 (2016-05-04).</p>
<p>It became applicable and effective on May 25, 2018 (2018-05-25).</p>
<p>The regulation applies to covered controllers and processors and requires specified safeguards for personal data.</p>
</main></body></html>`;

const euNonFinancialReportingDirectiveDocument = `<!doctype html>
<html lang="en"><head><title>Directive 2014/95/EU</title></head>
<body><main>
<h1>Directive 2014/95/EU on Non-Financial Reporting</h1>
<p>The directive was adopted and published on November 15, 2014 (2014-11-15).</p>
<p>It applies to financial years beginning on January 1, 2017 (2017-01-01).</p>
<p>The directive applies to large public-interest entities and parent undertakings exceeding 500 employees.</p>
<p>Covered entities must publish a non-financial statement addressing environmental, social, employee, human-rights, and anti-corruption matters.</p>
<p>Member states must implement the directive in national law, and specified subsidiary exemptions may apply.</p>
</main></body></html>`;

const coloradoPrivacyActDocument = `<!doctype html>
<html lang="en"><head><title>Colorado Privacy Act</title></head>
<body><main>
<h1>Colorado Privacy Act</h1>
<p>Formal identifier: SB21-190.</p>
<p>The Colorado Privacy Act was approved on July 7, 2021 and became effective on July 1, 2023 (2023-07-01).</p>
<p>The official record concerns Colorado, United States.</p>
<p>The act requires controllers conducting business in Colorado or producing products or services intentionally targeted to Colorado residents to honor consumer rights and implement data-protection duties when a statutory processing threshold is met.</p>
<p>Controllers conducting business in Colorado or targeting Colorado residents that meet statutory thresholds are the affected population described by this act.</p>
<p>A technology company is covered only when the controller, Colorado-nexus, processing-threshold, and exemption rules apply; sector or public-company status alone does not establish coverage.</p>
</main></body></html>`;

const connecticutDataPrivacyActDocument = `<!doctype html>
<html lang="en"><head><title>Connecticut Data Privacy Act</title></head>
<body><main>
<h1>Connecticut Data Privacy Act</h1>
<p>Formal identifier: Chapter 743jj.</p>
<p>The Connecticut Data Privacy Act became effective on July 1, 2023 (2023-07-01).</p>
<p>The official record concerns Connecticut, United States.</p>
<p>The act requires qualifying controllers conducting business in Connecticut or targeting Connecticut residents to honor consumer rights and implement personal-data governance duties, and it imposes direct contractual, confidentiality, deletion-or-return, compliance-information, subcontractor, and assessment duties on their processors.</p>
<p>Controllers or processors conducting business in Connecticut or targeting Connecticut residents that meet statutory thresholds are the affected population described by the act.</p>
<p>A technology company is covered only when the controller-or-processor role, Connecticut nexus, threshold, and exemption rules apply; technology or public-company status by itself is insufficient.</p>
</main></body></html>`;

const virginiaConsumerDataProtectionDocument = `<!doctype html>
<html lang="en"><head><title>Virginia Consumer Data Protection Act</title></head>
<body><main>
<h1>Virginia Consumer Data Protection Act</h1>
<p>Formal identifier: Chapter 35.</p>
<p>The Virginia Consumer Data Protection Act provisions became effective on January 1, 2023 (2023-01-01).</p>
<p>The official record concerns Virginia, United States.</p>
<p>Virginia Acts of Assembly Chapter 35 enacted and established a new consumer-data framework; it requires controllers and processors to follow consumer-rights, controller-responsibility, processor-duty, data-protection-assessment, and Attorney General enforcement provisions.</p>
<p>Controllers or processors conducting business in Virginia or targeting Virginia residents that meet statutory thresholds are the affected population described by the act.</p>
<p>A technology company is covered only when the controller-or-processor role, Virginia nexus, threshold, and exemption rules apply; industry or listing status alone does not prove coverage.</p>
</main></body></html>`;

const utahConsumerPrivacyActDocument = `<!doctype html>
<html lang="en"><head><title>Utah Consumer Privacy Act | S.B. 227 Consumer Privacy Act — Enrolled</title></head>
<body><main>
<h1>Utah Consumer Privacy Act</h1>
<p>The Utah Consumer Privacy Act became effective on December 31, 2023 (2023-12-31).</p>
<p>The official record concerns Utah, United States.</p>
<p>The act requires qualifying controllers and processors doing business in Utah or targeting Utah residents to implement consumer privacy duties when its revenue prerequisite and one of its alternative processing-volume conditions are met.</p>
<p>Controllers and processors subject to the Utah Consumer Privacy Act are the affected population described by the act.</p>
<p>Coverage requires at least $25 million in annual revenue and either processing data of at least 100,000 consumers, or processing data of at least 25,000 consumers while deriving more than half of gross revenue from personal-data sales, subject to exemptions.</p>
<p>A technology company is covered only when the Utah nexus, revenue threshold, one alternative processing threshold, data activity, and exemption rules apply; technology or public-company status alone is insufficient.</p>
</main></body></html>`;

const connectedDevicesLawDocument = `<!doctype html>
<html lang="en"><head><title>California Security of Connected Devices Law</title></head>
<body><main>
<h1>California Security of Connected Devices Law</h1>
<p>Formal identifier: SB 327.</p>
<p>The California Security of Connected Devices Law is the connected-device security title enacted by SB 327.</p>
<p>SB 327 was approved and chaptered on September 28, 2018 (2018-09-28).</p>
<p>The Security of Connected Devices title became operative on January 1, 2020 (2020-01-01).</p>
<p>The official record concerns California, United States.</p>
<p>The law requires a manufacturer of a covered connected device sold or offered for sale in California to equip the device with a reasonable security feature appropriate to the device and the information it handles.</p>
<p>Manufacturers of connected devices sold or offered for sale in California are the affected population described by the law.</p>
<p>Technology and hardware firms require product-level manufacturer, connectivity, California-market, and exclusion evidence before organization-level coverage can be assigned.</p>
</main></body></html>`;

const digitalMarketsActDocument = `<!doctype html>
<html lang="en"><head><title>EU Digital Markets Act | Regulation (EU) 2022/1925</title></head>
<body><main>
<h1>EU Digital Markets Act</h1>
<p>The EU Digital Markets Act entered into force on November 1, 2022 and became applicable on May 2, 2023 (2023-05-02).</p>
<p>The official record concerns the European Union.</p>
<p>The regulation requires designated gatekeepers providing covered core platform services to comply with specified conduct, interoperability, and data-use obligations.</p>
<p>The regulation describes covered platform-service gatekeepers operating in the European Union.</p>
<p>Some large technology platforms serving EU users may become designated under the regulation.</p>
<p>Providers of core platform services that meet the legal conditions and are designated as gatekeepers, irrespective of the provider's place of establishment.</p>
<p>It applies to covered core platform services provided or offered by gatekeepers to business users established in the European Union or end users established or located there, irrespective of the gatekeeper's place of establishment or residence; designation must still be verified.</p>
<p>A technology platform is covered only after the service category, European Union reach, gatekeeper designation, and applicable compliance date are verified.</p>
</main></body></html>`;

const euEtsDirectiveDocument = `<!doctype html>
<html lang="en"><head><title>Directive 2003/87/EC establishing a scheme for greenhouse gas emission allowance trading</title></head>
<body><main>
<h1>Directive 2003/87/EC</h1>
<p>The directive was adopted on October 13, 2003 and published on October 25, 2003 (2003-10-25).</p>
<p>It establishes a European Union greenhouse-gas emission allowance trading scheme whose first trading period began on January 1, 2005 (2005-01-01).</p>
<p>It requires covered installations carrying out listed activities to hold a permit, monitor and report emissions, and surrender allowances corresponding to verified emissions.</p>
<p>Coverage depends on the Annex I activity and capacity thresholds and applies at installation and operator level rather than automatically to every manufacturing firm.</p>
</main></body></html>`;

const euEtsCommissionOverviewDocument = `<!doctype html>
<html lang="en"><head><title>About the EU Emissions Trading System</title></head>
<body><main>
<h1>About the EU Emissions Trading System</h1>
<p>The European Commission records that the EU Emissions Trading System was launched in 2005 (2005-01-01).</p>
<p>The cap-and-trade system covers emissions from electricity and heat generation, industrial manufacturing, aviation, and—since 2024—maritime transport.</p>
<p>The system requires covered companies to monitor and report emissions annually and surrender enough allowances to account for those emissions.</p>
<p>Phase 1 covered carbon-dioxide emissions from power generators and energy-intensive industries; exact exposure still depends on the applicable installation, activity, and phase rules.</p>
</main></body></html>`;

const secConflictMineralsGuideDocument = `<!doctype html>
<html lang="en"><head><title>Conflict Minerals Disclosure — A Small Entity Compliance Guide</title></head>
<body><main>
<h1>Conflict Minerals Disclosure</h1>
<p>The Securities and Exchange Commission adopted the conflict-minerals rule on August 22, 2012, and the rule took effect on November 13, 2012 (2012-11-13).</p>
<p>The rule applies to companies filing under Exchange Act Sections 13(a) or 15(d) when conflict minerals are necessary to the functionality or production of a product they manufacture or contract to manufacture.</p>
<p>The rule requires covered companies to perform the prescribed country-of-origin inquiry and, when applicable, due diligence and Form SD or Conflict Minerals Report disclosures.</p>
<p>Manufacturing-sector membership alone does not establish coverage; reporting status and product-level mineral necessity must be verified.</p>
</main></body></html>`;

const euElectricityMarketDesignDocument = `<!doctype html>
<html lang="en"><head><title>Electricity Market Design Regulation</title></head>
<body><main>
<h1>Electricity Market Design Regulation</h1>
<p>Regulation (EU) 2024/1747 was adopted on June 13, 2024 (2024-06-13).</p>
<p>The regulation updates European Union electricity-market rules for market participants and electricity suppliers.</p>
<p>It strengthens consumer contracting information, supports long-term power purchase agreements, and changes market-design safeguards during electricity price crises.</p>
<p>Member-state implementation and organization-level exposure still depend on the applicable provision and national market role.</p>
</main></body></html>`;

const ukElectricityMarketReformDocument = `<!doctype html>
<html lang="en"><head><title>Electricity Market Reform Act 2023</title></head>
<body><main>
<h1>Electricity Market Reform Act 2023</h1>
<p>The Act was enacted on October 26, 2023 (2023-10-26).</p>
<p>It establishes United Kingdom electricity-market reform duties concerning electricity supply, market governance, and energy-system investment.</p>
<p>Commencement, territorial extent, and the coverage of an individual electricity firm require provision-level verification.</p>
</main></body></html>`;

const officialDocumentFixtures = new Map<string, string>([
  [order841LandingPage, order841Document],
  [order841BodyHtml, order841Document],
  [order841RawText, order841Document],
  [ftcGamingActionUrl, ftcGamingActionDocument],
  [
    "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
    ccpaInitiativeDocument,
  ],
  [
    "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
    ccpaStatuteDocument,
  ],
  ["https://oag.ca.gov/privacy/ccpa", ccpaOfficialOverviewDocument],
  ["https://oag.ca.gov/privacy/ccpa/regs", ccpaStatuteDocument],
  [
    "https://oag.ca.gov/sites/all/files/agweb/pdfs/privacy/ccpa-isor-appendices.pdf",
    ccpaInitialReasonsDocument,
  ],
  [
    "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
    ccpaRegulatorPressReleaseDocument,
  ],
  [
    "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    gdprDocument,
  ],
  [
    "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
    gdprDocument,
  ],
  [
    "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679",
    gdprDocument,
  ],
  [
    "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32014L0095",
    euNonFinancialReportingDirectiveDocument,
  ],
  [
    "https://leg.colorado.gov/bills/sb21-190?exec=1ba5018",
    coloradoPrivacyActDocument,
  ],
  [
    "https://www.cga.ct.gov/2023/pub/chap_743jj.htm",
    connecticutDataPrivacyActDocument,
  ],
  [
    "https://legacylis.virginia.gov/cgi-bin/legp604.exe?212+ful+CHAP0035+hil",
    virginiaConsumerDataProtectionDocument,
  ],
  [
    "https://le.utah.gov/~2022/bills/sbillenr/SB0227.htm",
    utahConsumerPrivacyActDocument,
  ],
  [
    "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB327",
    connectedDevicesLawDocument,
  ],
  [
    "https://eur-lex.europa.eu/eli/reg/2022/1925/oj/eng",
    digitalMarketsActDocument,
  ],
  [
    "https://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri=CELEX%3A32003L0087%3Aen%3AHTML",
    euEtsDirectiveDocument,
  ],
  [
    "https://climate.ec.europa.eu/eu-action/carbon-markets/about-eu-ets_en",
    euEtsCommissionOverviewDocument,
  ],
  [
    "https://www.sec.gov/files/conflict-minerals-disclosure-small-entity-compliance-guide.htm",
    secConflictMineralsGuideDocument,
  ],
  [
    "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1747",
    euElectricityMarketDesignDocument,
  ],
  [
    "https://www.legislation.gov.uk/ukpga/2023/52",
    ukElectricityMarketReformDocument,
  ],
]);

const ccpaStatuteFixtureUrl =
  "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375";
const ccpaRegulationsFixtureUrl = "https://oag.ca.gov/privacy/ccpa/regs";
const revisableCcpaFixtureUrls = new Set([
  ccpaStatuteFixtureUrl,
  ccpaRegulationsFixtureUrl,
]);
let screen03EvidenceRevision = 0;

export function advanceBrowserFixtureScreen03Evidence() {
  screen03EvidenceRevision += 1;
  return screen03EvidenceRevision;
}

function revisedOfficialDocument(url: string, document: string) {
  // Find and Audit share one sequential browser-fixture process. Alternate a
  // structural source delta so every explicit advance changes the normalized
  // packet instead of changing only an ignored fixture counter.
  if (
    !revisableCcpaFixtureUrls.has(url) ||
    screen03EvidenceRevision % 2 === 0
  ) {
    return document;
  }
  return document.replace(
    "<h1>California Consumer Privacy Act of 2018</h1>",
    `<h1>California Consumer Privacy Act of 2018</h1>\n<p>The official historical-coverage record was refreshed in deterministic browser fixture revision ${screen03EvidenceRevision}; contemporaneous business records remain necessary for unit-level classification.</p>`,
  );
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  throw new Error(
    "Browser connector fixture rejects Request inputs; connector calls must expose their complete init envelope.",
  );
}

function exactRequestInitKeys(
  init: RequestInit | undefined,
  expected: readonly string[],
) {
  if (!init) return false;
  const actual = Object.keys(init).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function exactRequestHeaders(
  init: RequestInit | undefined,
  expected: Readonly<Record<string, string>>,
) {
  if (!init) return false;
  const actual = [...new Headers(init.headers).entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en-US")
  );
  const wanted = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right, "en-US")
  );
  return actual.length === wanted.length && actual.every(
    ([name, value], index) =>
      name === wanted[index]?.[0] && value === wanted[index]?.[1],
  );
}

function hasLiveAbortSignal(signal: AbortSignal | null | undefined) {
  return signal !== null && signal !== undefined &&
    signal.aborted === false &&
    typeof signal.addEventListener === "function";
}

function isExpectedBoundedGetTransport(
  init: RequestInit | undefined,
  accept: string,
  additionalHeaders: Readonly<Record<string, string>> = {},
) {
  return exactRequestInitKeys(init, [
    "method",
    "headers",
    "redirect",
    "cache",
    "signal",
  ]) &&
    exactRequestHeaders(init, { accept, ...additionalHeaders }) &&
    init?.method === "GET" &&
    init.redirect === "manual" &&
    init.cache === "no-store" &&
    hasLiveAbortSignal(init.signal);
}

function hasExactSearchParameters(
  url: URL,
  names: readonly string[],
) {
  const expected = new Set(names);
  return [...url.searchParams.keys()].every((name) => expected.has(name)) &&
    names.every((name) => url.searchParams.getAll(name).length === 1) &&
    [...url.searchParams.keys()].length === names.length;
}

function isExpectedOfficialDocumentTransport(init: RequestInit | undefined) {
  const screen02Overview =
    exactRequestInitKeys(init, ["headers", "redirect", "cache", "signal"]) &&
    exactRequestHeaders(init, {
      accept: "text/html, text/plain;q=0.9",
      "cache-control": "no-store",
        "user-agent": "ShockAudit/0.6.2 substantive-overview retrieval",
    }) &&
    init?.redirect === "manual" &&
    init.cache === "no-store" &&
    hasLiveAbortSignal(init.signal);
  const screen03Research =
    exactRequestInitKeys(init, [
      "method",
      "headers",
      "redirect",
      "cache",
      "signal",
    ]) &&
    exactRequestHeaders(init, {
      accept:
        "text/html, application/xhtml+xml, application/xml;q=0.95, text/xml;q=0.95, application/atom+xml;q=0.95, application/json;q=0.9, application/ld+json;q=0.9, text/plain;q=0.85, application/pdf;q=0.8",
      "accept-encoding": "identity",
      "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
    }) &&
    init?.method === "GET" &&
    init.redirect === "manual" &&
    init.cache === "no-store" &&
    hasLiveAbortSignal(init.signal);
  const researcherAudit =
    exactRequestInitKeys(init, [
      "method",
      "headers",
      "redirect",
      "cache",
      "signal",
    ]) &&
    exactRequestHeaders(init, {
      accept: "text/html, text/plain;q=0.9, application/pdf;q=0.5",
    }) &&
    init?.method === "GET" &&
    init.redirect === "manual" &&
    init.cache === "no-store" &&
    hasLiveAbortSignal(init.signal);
  const sixScreenPolicy =
    exactRequestInitKeys(init, [
      "method",
      "headers",
      "redirect",
      "cache",
      "signal",
    ]) &&
    exactRequestHeaders(init, {
      accept: "text/html, text/plain;q=0.9",
      "cache-control": "no-store",
      "user-agent": "ShockAudit six-screen policy retrieval",
    }) &&
    init?.method === "GET" &&
    init.redirect === "manual" &&
    init.cache === "no-store" &&
    hasLiveAbortSignal(init.signal);
  return screen02Overview || screen03Research || researcherAudit ||
    sixScreenPolicy;
}

/**
 * Browser acceptance must never depend on an external service. This fixture is
 * deliberately fail-closed: an unexpected connector, query, date, type, or
 * pool size throws instead of falling through to globalThis.fetch.
 */
export const deterministicConnectorFetch: Screen02ConnectorFetch = async (
  input,
  init,
) => {
  const url = requestUrl(input);
  if (url.username || url.password) {
    throw new Error(
      `Browser connector fixture rejected URL credentials: ${url.origin}${url.pathname}`,
    );
  }
  const exactDocumentUrl = `${url.origin}${url.pathname}${url.search}`;
  const document = officialDocumentFixtures.get(exactDocumentUrl);
  if (document !== undefined) {
    if (!isExpectedOfficialDocumentTransport(init)) {
      throw new Error(
        `Browser connector fixture rejected unexpected official-document transport: ${url.toString()}`,
      );
    }
    return new Response(revisedOfficialDocument(exactDocumentUrl, document), {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    });
  }
  if (`${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT) {
    const query = url.searchParams.get("query") ?? "";
    const record = expectedCellarRecords.get(query);
    if (
      !isExpectedBoundedGetTransport(
        init,
        "application/json, application/geo+json, application/sparql-results+json",
      ) ||
      !hasExactSearchParameters(url, ["query", "format"]) ||
      url.searchParams.get("format") !==
        "application/sparql-results+json" ||
      record === undefined
    ) {
      throw new Error(
        `Browser EU CELLAR fixture rejected unexpected request: ${url.toString()}`,
      );
    }
    return new Response(
      JSON.stringify({
        results: {
          bindings: [record],
        },
      }),
      {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }
  if (url.origin === new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin) {
    if (
      !isExpectedBoundedGetTransport(
        init,
        "application/atom+xml, application/xml, text/xml",
        { "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT },
      ) ||
      !hasExactSearchParameters(url, ["title"]) ||
      url.pathname !== "/all/2021-2024/data.feed" ||
      url.searchParams.get("title") !== "Electricity Regulation" ||
      new Headers(init?.headers).get("user-agent") !==
        SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT
    ) {
      throw new Error(
        `Browser UK electricity fixture rejected unexpected request: ${url.toString()}`,
      );
    }
    return new Response(
      `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
        <entry>
          <id>https://www.legislation.gov.uk/id/ukpga/2023/52</id>
          <title>Electricity Market Reform Act 2023</title>
          <ukm:EnactmentDate Date="2023-10-26"/>
          <link rel="alternate" href="https://www.legislation.gov.uk/ukpga/2023/52"/>
        </entry>
      </feed>`,
      {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/atom+xml; charset=utf-8",
        },
      },
    );
  }
  if (`${url.origin}${url.pathname}` === OPEN_FEMA_API_ENDPOINT) {
    const expectedFilter =
      "declarationDate ge '2010-01-01T00:00:00.000Z' and declarationDate le '2022-12-31T23:59:59.999Z'";
    const expectedSelect = [
      "disasterNumber", "state", "declarationType", "declarationDate",
      "incidentType", "declarationTitle", "incidentBeginDate",
      "incidentEndDate", "designatedArea", "id", "lastRefresh",
    ].join(",");
    if (
      !isExpectedBoundedGetTransport(init, "application/json") ||
      !hasExactSearchParameters(url, [
        "$filter", "$select", "$top", "$orderby", "$format",
      ]) ||
      url.searchParams.get("$filter") !== expectedFilter ||
      url.searchParams.get("$select") !== expectedSelect ||
      url.searchParams.get("$top") !== "6" ||
      url.searchParams.get("$orderby") !== "declarationDate desc" ||
      url.searchParams.get("$format") !== "json"
    ) {
      throw new Error(
        `Browser OpenFEMA fixture rejected unexpected request: ${url.toString()}`,
      );
    }
    return new Response(JSON.stringify({
      DisasterDeclarationsSummaries: [{
        disasterNumber: 4482,
        state: "CA",
        declarationType: "DR",
        declarationDate: "2020-03-22T00:00:00.000Z",
        incidentType: "Biological",
        declarationTitle: "COVID-19 pandemic",
        incidentBeginDate: "2020-01-20T00:00:00.000Z",
        incidentEndDate: "2023-05-11T00:00:00.000Z",
        designatedArea: "Statewide",
        id: "fixture-fema-4482-ca",
        lastRefresh: "2026-09-20T00:00:00.000Z",
      }],
    }), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    });
  }
  const expectedGdeltEndpoint = new URL(GDELT_DOC_API_ENDPOINT);
  if (
    url.origin === expectedGdeltEndpoint.origin &&
    url.pathname === expectedGdeltEndpoint.pathname
  ) {
    const query = url.searchParams.get("query");
    const isAuditExpansion =
      query === "California Consumer Privacy Act" &&
      url.searchParams.get("maxrecords") === "1" &&
      url.searchParams.get("startdatetime") === "20250808000000" &&
      url.searchParams.get("enddatetime") === "20260809235959";
    const isScreen03Refresh =
      (query === "California Consumer Privacy Act" ||
        query === "California Consumer Privacy Act of 2018") &&
      url.searchParams.get("maxrecords") === "5" &&
      ["20250808000000", "20250809000000"].includes(
        url.searchParams.get("startdatetime") ?? "",
      ) &&
      url.searchParams.get("enddatetime") === "20260809235959";
    if (
      !isExpectedBoundedGetTransport(init, "application/json") ||
      !hasExactSearchParameters(url, [
        "query",
        "mode",
        "format",
        "sort",
        "maxrecords",
        "startdatetime",
        "enddatetime",
      ]) ||
      url.searchParams.get("mode") !== "artlist" ||
      url.searchParams.get("format") !== "json" ||
      url.searchParams.get("sort") !== "datedesc" ||
      (!isAuditExpansion && !isScreen03Refresh)
    ) {
      throw new Error(
        `Browser contextual fixture rejected unexpected request: ${url.toString()}`,
      );
    }
    // GDELT is a tier-6 locator index, never candidate evidence. An empty,
    // successful fixture exercises the exact transport without manufacturing
    // a contextual article or promoting metadata into acceptance evidence.
    return new Response(JSON.stringify({ articles: [] }), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    });
  }
  const expectedFtcEndpoint = new URL(FTC_PRESS_RELEASES_ENDPOINT);
  if (
    url.origin === expectedFtcEndpoint.origin &&
    url.pathname === expectedFtcEndpoint.pathname
  ) {
    const search = url.searchParams.get("search") ?? "";
    const from = url.searchParams.get("date_range[min]") ?? "";
    const through = url.searchParams.get("date_range[max]") ?? "";
    const expectedScope = `${search}\u0000${from}\u0000${through}`;
    if (
      !exactRequestInitKeys(init, [
        "method",
        "headers",
        "redirect",
        "cache",
        "signal",
      ]) ||
      !exactRequestHeaders(init, {
        accept: "text/html",
        "user-agent": "ShockAudit/0.6.2 source discovery",
      }) ||
      init?.method !== "GET" ||
      init.redirect !== "manual" ||
      init.cache !== "no-store" ||
      !hasLiveAbortSignal(init.signal) ||
      !hasExactSearchParameters(url, [
        "search",
        "date_range[min]",
        "date_range[max]",
        "field_competition_topics",
        "field_consumer_protection_topics",
        "field_industry_target_id",
      ]) ||
      url.searchParams.has("items_per_page") ||
      url.searchParams.get("field_competition_topics") !== "All" ||
      url.searchParams.get("field_consumer_protection_topics") !== "All" ||
      url.searchParams.get("field_industry_target_id") !== "All" ||
      !EXPECTED_FTC_RECOVERY_SCOPES.has(expectedScope)
    ) {
      throw new Error(
        `Browser FTC recovery fixture rejected unexpected request: ${url.toString()}`,
      );
    }
    const responseBody = expectedScope ===
        "video game\u00002014-01-01\u00002022-12-31"
      ? ftcGamingListingDocument
      : "<!doctype html><html lang=\"en\"><body><main><div class=\"view-empty\">No results found.</div></main></body></html>";
    // The gaming response is a frozen replay of the reviewed FTC record. All
    // other accepted scopes exercise an honestly empty route; query terms are
    // never promoted into candidate evidence.
    return new Response(
      responseBody,
      {
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html; charset=utf-8",
        },
      },
    );
  }
  const expectedEndpoint = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  const transportHeaders = new Headers(init?.headers);
  if (
    !exactRequestInitKeys(init, [
      "method",
      "headers",
      "redirect",
      "cache",
      "signal",
    ]) ||
    !exactRequestHeaders(init, { accept: "application/json" }) ||
    (init?.method ?? "").toLocaleUpperCase("en-US") !== "GET" ||
    transportHeaders.get("accept") !== "application/json" ||
    init?.redirect !== "manual" ||
    init?.cache !== "no-store" ||
    !hasLiveAbortSignal(init.signal)
  ) {
    throw new Error(
      `Browser connector fixture rejected unexpected Federal Register transport: ${url.toString()}`,
    );
  }
  const documentTypes = url.searchParams.getAll("conditions[type][]");
  const query = url.searchParams.get("conditions[term]") ?? "";
  const from = url.searchParams.get("conditions[publication_date][gte]");
  const through = url.searchParams.get("conditions[publication_date][lte]");
  const fields = url.searchParams.getAll("fields[]");
  const scalarParameterNames = [
    "conditions[term]",
    "conditions[publication_date][gte]",
    "conditions[publication_date][lte]",
    "per_page",
    "order",
  ] as const;
  const allowedParameterNames = new Set([
    ...scalarParameterNames,
    "conditions[type][]",
    "fields[]",
  ]);
  const exactParameters =
    [...url.searchParams.keys()].every((name) =>
      allowedParameterNames.has(name)
    ) &&
    scalarParameterNames.every((name) =>
      url.searchParams.getAll(name).length === 1
    ) &&
    fields.length === EXPECTED_FEDERAL_REGISTER_FIELDS.length &&
    fields.every((field, index) =>
      field === EXPECTED_FEDERAL_REGISTER_FIELDS[index]
    );
  const commonRequest =
    url.origin === expectedEndpoint.origin &&
    url.pathname === expectedEndpoint.pathname &&
    exactParameters &&
    url.searchParams.get("order") === "relevance";
  const canonicalFindDocumentTypes =
    documentTypes.length === 3 &&
    documentTypes[0] === "RULE" &&
    documentTypes[1] === "PRORULE" &&
    documentTypes[2] === "NOTICE";
  const canonicalAuditDocumentTypes =
    documentTypes.length === 3 &&
    documentTypes[0] === "RULE" &&
    documentTypes[1] === "PRORULE" &&
    documentTypes[2] === "NOTICE";
  const isGamingRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    EXPECTED_GAMING_QUERY_TERMS.has(query) &&
    from === "2014-01-01" &&
    through === "2016-12-31" &&
    url.searchParams.get("per_page") === "5";
  const isCurrentGamingRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    EXPECTED_CURRENT_GAMING_QUERY_TERMS.has(query) &&
    from === "2014-01-01" &&
    through === "2022-12-31" &&
    url.searchParams.get("per_page") === "5";
  const isEnergyRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    EXPECTED_ENERGY_QUERY_TERMS.has(query) &&
    from === "2014-01-01" &&
    through === "2022-12-31" &&
    url.searchParams.get("per_page") === "5";
  const isManufacturingRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    EXPECTED_MANUFACTURING_QUERY_TERMS.has(query) &&
    from === "2014-01-01" &&
    through === "2022-12-31" &&
    url.searchParams.get("per_page") === "5";
  const isPrivacyFindRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    (EXPECTED_TECHNOLOGY_QUERY_TERMS.has(query) ||
      (from === "2016-01-01" && through === "2020-12-31" &&
        query === "Technology regulation 2016 2020") ||
      (from === "2017-01-01" && through === "2023-12-31" &&
        query === "Technology regulation 2017 2023")) &&
    ((from === "2016-01-01" && through === "2020-12-31") ||
      (from === "2017-01-01" && through === "2023-12-31")) &&
    url.searchParams.get("per_page") === "5";
  const isCcpaAuditRequest =
    commonRequest &&
    canonicalAuditDocumentTypes &&
    query === "California Consumer Privacy Act" &&
    from === "2015-01-01" &&
    through === "2021-12-31" &&
    url.searchParams.get("per_page") === "12";
  const isCcpaAuditExpandedRequest =
    commonRequest &&
    canonicalAuditDocumentTypes &&
    EXPECTED_CCPA_AUDIT_EXPANDED_QUERY_TERMS.has(query) &&
    from === "2015-01-01" &&
    through === "2021-12-31" &&
    url.searchParams.get("per_page") === "12";
  const isSixScreenOrder841IdentityRequest =
    commonRequest &&
    canonicalAuditDocumentTypes &&
    query === "2018-03708" &&
    from === "2016-01-01" &&
    through === "2020-12-31" &&
    url.searchParams.get("per_page") === "3";
  const isStudyFirstEventRequest =
    commonRequest &&
    canonicalFindDocumentTypes &&
    EXPECTED_STUDY_FIRST_EVENT_QUERY_TERMS.has(query) &&
    from === "2010-01-01" &&
    through === "2022-12-31" &&
    url.searchParams.get("per_page") === "6";

  if (
    !isGamingRequest &&
    !isCurrentGamingRequest &&
    !isEnergyRequest &&
    !isManufacturingRequest &&
    !isPrivacyFindRequest &&
    !isCcpaAuditRequest &&
    !isCcpaAuditExpandedRequest &&
    !isSixScreenOrder841IdentityRequest &&
    !isStudyFirstEventRequest
  ) {
    throw new Error(
      `Browser connector fixture rejected unexpected request: ${url.toString()}`,
    );
  }

  const selectedRecords = isGamingRequest
    ? federalRegisterRecords
    : isEnergyRequest || isSixScreenOrder841IdentityRequest
      ? order841Records
      : manufacturingRecords;
  const matchingRecords = selectedRecords.filter((record) =>
    typeof from === "string" &&
    typeof through === "string" &&
    record.publication_date >= from &&
    record.publication_date <= through
  );
  const pageSize = Number(url.searchParams.get("per_page"));
  return new Response(
    JSON.stringify({
      count: matchingRecords.length,
      results: matchingRecords.slice(0, pageSize).map((record) => ({
        ...record,
        type: "type" in record ? record.type : "Rule",
        html_url: "html_url" in record
          ? record.html_url
          : `https://www.federalregister.gov/d/${record.document_number}`,
        agencies: "agencies" in record
          ? record.agencies
          : [{ name: "Browser Fixture Agency" }],
      })),
    }),
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
};

async function runOfficialTransportProbe() {
  const response = await screen02ProductionPeerBoundFetch(
    OFFICIAL_TRANSPORT_PROBE_UPSTREAM_URL,
    {
      method: "GET",
      headers: {
        accept: "application/atom+xml, application/xml, text/xml",
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(OFFICIAL_TRANSPORT_PROBE_TIMEOUT_MS),
    },
  );
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]!.trim().toLocaleLowerCase(
    "en-US",
  );
  if (
    response.status !== 200 ||
    !OFFICIAL_TRANSPORT_PROBE_XML_CONTENT_TYPES.has(mediaType)
  ) {
    throw new Error(
      "The official transport probe did not return a successful Atom/XML response.",
    );
  }
  const body = await readScreen02BoundedResponseText(
    response,
    SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES,
  );
  if (!/<feed(?:\s|>)/iu.test(body)) {
    throw new Error(
      "The official transport probe response did not contain an Atom feed root.",
    );
  }
  const bytes = new TextEncoder().encode(body);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes),
  );
  const sha256 = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return new Response(
    JSON.stringify({
      upstreamUrl: OFFICIAL_TRANSPORT_PROBE_UPSTREAM_URL,
      status: response.status,
      contentType,
      byteCount: bytes.byteLength,
      sha256,
    }),
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

export default {
  fetch(request, env, context) {
    const requestUrl = new URL(request.url);
    if (
      request.method === "GET" &&
      requestUrl.pathname === OFFICIAL_TRANSPORT_PROBE_PATH &&
      requestUrl.search === ""
    ) {
      return runOfficialTransportProbe();
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname ===
        "/__browser-fixture/advance-screen03-evidence"
    ) {
      return new Response(
        JSON.stringify({ revision: advanceBrowserFixtureScreen03Evidence() }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }
    browserFixtureSigningKey ??= crypto.randomUUID().replaceAll("-", "");
    const fixtureEnv: ShockAuditEnv = {
      ASSETS: env.ASSETS,
      CONNECTOR_FETCH: deterministicConnectorFetch,
      NOW: () => SCREEN02_BROWSER_FIXTURE_NOW_ISO,
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_WORKFLOW_STORE: canonicalWorkflowStore,
      SCREEN03_WORKFLOW_STORE: canonicalScreen03WorkflowStore,
      SIX_SCREEN_WORKFLOW_STORE: sixScreenWorkflowStore,
      SIX_SCREEN_RESEARCH_TASK_STORE: sixScreenResearchTaskStore,
      SIX_SCREEN_EVIDENCE_STORE: sixScreenEvidenceStore,
      SCREEN02_WORKFLOW_SIGNING_KEY_ID: "screen02-browser-fixture-v1",
      SCREEN02_WORKFLOW_SIGNING_KEY: browserFixtureSigningKey,
      SCREEN02_HOST_ASSESSMENT_DEADLINE_MS: 0,
      SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
    };
    return worker.fetch(request, fixtureEnv, context);
  },
} satisfies ExportedHandler<BrowserFixtureEnv>;
