import type {
  Screen02AuditProposal,
  Screen02FindProposal,
} from "./screen02-types";
import {
  distinctiveScreen02ResearchTerms,
} from "./screen02-relevance-profile";
import {
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
} from "./screen02-public-event-index";

export const SCREEN_02_EVENT_REGISTRY_VERSION =
  "screen-02-reviewed-events-2026-09-11-v7" as const;

const REGISTRY_REVIEW_DATE = "2026-07-29";
const REGISTRY_EXPANSION_REVIEW_DATE = "2026-09-03";
/**
 * Every reviewed record uses the same conservative topical prefilter. Named
 * records never bypass it. Final eligibility still belongs to the common
 * hard-scope and relevance qualifier.
 */
export function reviewedScreen02RegistryProposalMatchesResearchText(
  proposal: Screen02FindProposal,
  researchText: string,
) {
  const researchTerms = distinctiveScreen02ResearchTerms(researchText);
  if (researchTerms.length === 0) return false;
  const candidateText = [
    proposal.title,
    proposal.description,
    proposal.event.displayName,
    ...proposal.event.populations,
    proposal.affectedPopulation,
    ...proposal.requiredVariables,
    ...proposal.sources.map((source) => source.title),
  ].join(" ").toLocaleLowerCase("en-US");
  const normalizedCandidate = candidateText
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return researchTerms.some((term) =>
    ` ${normalizedCandidate} `.includes(` ${term} `) ||
    (term.length >= 5 && normalizedCandidate.includes(term.slice(0, -1)))
  );
}

function provisionalRegistryAssessments(): NonNullable<
  Screen02FindProposal["assessments"]
> {
  return {
    exposureObservability: {
      value: null,
      reason:
        "Unknown at registry stage: the official source identifies the event, but unit-level exposure fields and linkability have not been verified.",
    },
    timeSupport: {
      value: null,
      reason:
        "Unknown until the event clock is compared with the confirmed Screen 1 study period and outcome frequency.",
    },
    variation: {
      value: null,
      reason:
        "Unknown until Screen 3 verifies assignment rules and Screen 4 inspects the researcher's actual sample.",
    },
  };
}

type ReviewedRegulatoryCandidateInput = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  geographies: string[];
  populations: string[];
  provisionalDates: string[];
  affectedPopulation: string;
  requiredVariables: string[];
  limitations: string[];
  reasons: string[];
  nativeIdentity?: NonNullable<Screen02FindProposal["nativeIdentity"]>;
  source: Screen02FindProposal["sources"][number];
};

function reviewedRegulatoryCandidate(
  input: ReviewedRegulatoryCandidateInput,
): Screen02FindProposal {
  return {
    id: input.id,
    mode: "find",
    kind: "event",
    title: input.title,
    description: input.description,
    ...(input.nativeIdentity
      ? { nativeIdentity: { ...input.nativeIdentity } }
      : {}),
    event: {
      displayName: input.title,
      eventDate: input.eventDate,
      eventFamily: "Regulation",
      geographies: input.geographies,
      populations: input.populations,
    },
    origin: "registry-reviewed",
    provisionalDates: input.provisionalDates,
    affectedPopulation: input.affectedPopulation,
    requiredVariables: input.requiredVariables,
    outcomeLink: {
      text:
        "AI hypothesis: privacy, security, disclosure, or digital-market obligations may affect compliance costs, product design, data practices, revenue channels, governance, or legal exposure.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      ...input.limitations,
      "The registry does not establish unit-level legal exposure, treatment timing, or usable comparison variation.",
    ],
    reasons: input.reasons,
    sources: [{
      ...input.source,
      retrievedAt: REGISTRY_EXPANSION_REVIEW_DATE,
    }],
    assessments: provisionalRegistryAssessments(),
  };
}

/**
 * A deliberately small discovery registry, not an exhaustive event catalog.
 *
 * Each record has been checked against the linked official primary material.
 * The registry supports candidate discovery only: dates, affected populations,
 * required variables, and outcome links remain provisional until the later
 * evidence, data-mapping, and exposure-construction screens approve them.
 */
const LEGACY_REVIEWED_SCREEN02_EVENT_REGISTRY: readonly Screen02FindProposal[] =
  [
    {
      id: "registry-us-sarbanes-oxley-2002",
      mode: "find",
      kind: "event",
      title: "Sarbanes-Oxley Act of 2002",
      description:
        "A U.S. corporate-governance and disclosure reform enacted on July 30, 2002. This registry record identifies the statute; provision-specific treatment clocks and issuer coverage still require verification.",
      event: {
        displayName: "Sarbanes-Oxley Act of 2002",
        eventDate: "2002-07-30",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: [
          "U.S. public companies",
          "SEC-reporting issuers",
          "Companies filing periodic reports under Exchange Act Sections 13(a) or 15(d)",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2002-07-30", "2003-08-14"],
      affectedPopulation:
        "Public companies and other securities-market actors covered by particular provisions. Exact issuer, provision, exemption, and compliance-date coverage remains provisional.",
      requiredVariables: [
        "SEC reporting status",
        "Applicable Sarbanes-Oxley provision",
        "Provision-specific compliance date",
        "Issuer category or exemption status",
      ],
      outcomeLink: {
        text: "AI hypothesis: governance, certification, audit, and internal-control obligations may affect reporting practices, compliance costs, executive behavior, or capital-market outcomes.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "The statute contains multiple provisions and implementation clocks; July 30, 2002 is not automatically the correct treatment date.",
        "The registry has not established which provision matches a researcher's construct.",
        "Unit-level exposure and usable comparison variation have not been assessed.",
      ],
      reasons: [
        "The statute and enactment date are documented by the U.S. Government Publishing Office.",
        "The SEC final rule provides one official implementation clock for Section 404, but later screens must decide whether that provision is focal.",
      ],
      sources: [
        {
          id: "source-us-sox-public-law-107-204",
          title: "Public Law 107-204: Sarbanes-Oxley Act of 2002",
          locator: "https://www.govinfo.gov/link/plaw/107/public/204",
          publisher: "U.S. Government Publishing Office",
          publishedDate: "2002-07-30",
          authorityTier: 1,
          channel: "official-primary-statute",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-sox-section-404-final-rule",
          title:
            "Management's Report on Internal Control Over Financial Reporting and Certification of Disclosure",
          locator:
            "https://www.sec.gov/rules-regulations/2003/03/managements-report-internal-control-over-financial-reporting-certification-disclosure-exchange-act",
          publisher: "U.S. Securities and Exchange Commission",
          publishedDate: "2003-06-18",
          authorityTier: 1,
          channel: "official-primary-final-rule",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-us-sec-conflict-minerals-2012",
      mode: "find",
      kind: "event",
      title: "SEC Conflict Minerals Disclosure Rule",
      description:
        "A U.S. securities disclosure rule adopted in 2012 for specified SEC-reporting issuers whose manufactured products use necessary conflict minerals. Coverage and reporting obligations are conditional, not universal.",
      event: {
        displayName: "SEC Conflict Minerals Disclosure Rule",
        eventDate: "2012-11-13",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: [
          "SEC-reporting issuers",
          "U.S. public firms using necessary conflict minerals in manufactured products",
          "Domestic and foreign reporting companies covered by Exchange Act Sections 13(a) or 15(d)",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2012-08-22", "2012-11-13", "2013-01-01"],
      affectedPopulation:
        "Issuers filing under Exchange Act Sections 13(a) or 15(d) when conflict minerals are necessary to the functionality or production of products they manufacture or contract to manufacture.",
      requiredVariables: [
        "Exchange Act reporting status",
        "Manufacturing or contracting-to-manufacture status",
        "Product-level conflict-mineral necessity",
        "Reporting calendar year",
      ],
      outcomeLink: {
        text: "AI hypothesis: supply-chain due diligence and disclosure duties may affect sourcing, supplier relationships, compliance costs, or product strategy.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "Product-level mineral necessity and contracting-to-manufacture judgments may be difficult to observe from firm-level archival data.",
        "Court decisions and subsequent SEC guidance may affect the operative disclosure treatment.",
        "No sample-specific exposure or variation has been established.",
      ],
      reasons: [
        "The SEC final rule documents adoption, effective date, initial reporting period, and conditional issuer coverage.",
        "The compliance guide provides official administrative explanation but does not replace Screen 3 source verification.",
      ],
      sources: [
        {
          id: "source-us-sec-conflict-minerals-final-rule",
          title: "Final Rule: Conflict Minerals, Release No. 34-67716",
          locator:
            "https://www.sec.gov/files/rules/final/2012/34-67716.pdf",
          publisher: "U.S. Securities and Exchange Commission",
          publishedDate: "2012-08-22",
          authorityTier: 1,
          channel: "official-primary-final-rule",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-sec-conflict-minerals-guide",
          title: "Conflict Minerals Disclosure: Small Entity Compliance Guide",
          locator:
            "https://www.sec.gov/files/conflict-minerals-disclosure-small-entity-compliance-guide.htm",
          publisher: "U.S. Securities and Exchange Commission",
          publishedDate: "2012-11-13",
          authorityTier: 2,
          channel: "official-administrative-guidance",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-us-tax-cuts-jobs-act-2017",
      mode: "find",
      kind: "event",
      title: "Tax Cuts and Jobs Act of 2017",
      description:
        "A broad U.S. federal tax reform enacted on December 22, 2017. The act changed multiple business-tax provisions, so any study must isolate the provision and effective clock relevant to its construct.",
      event: {
        displayName: "Tax Cuts and Jobs Act of 2017",
        eventDate: "2017-12-22",
        eventFamily: "Tax",
        geographies: ["United States"],
        populations: [
          "U.S. corporations",
          "U.S. businesses and business owners",
          "U.S. public firms subject to federal taxation",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2017-12-22", "2018-01-01"],
      affectedPopulation:
        "U.S. businesses and taxpayers affected by particular provisions; corporate-rate, international-tax, pass-through, and investment provisions have different rules.",
      requiredVariables: [
        "Taxpayer and entity classification",
        "Applicable statutory provision",
        "Taxable-year start date",
        "Provision-specific tax base or eligibility fields",
      ],
      outcomeLink: {
        text: "AI hypothesis: changes in corporate and business taxation may affect investment, financing, organizational form, international activity, or firm performance.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "The act is a compound reform; an enactment-date indicator may conflate provisions with different effective dates and affected populations.",
        "Firm-specific tax exposure cannot be inferred from public-company status alone.",
        "No provision-specific comparison group or sample variation has been verified.",
      ],
      reasons: [
        "The enacted public law documents the December 22, 2017 enactment date.",
        "Official IRS material confirms that the corporate-rate change generally applies to taxable years beginning after December 31, 2017.",
      ],
      sources: [
        {
          id: "source-us-tcja-public-law-115-97",
          title: "Public Law 115-97",
          locator: "https://www.govinfo.gov/link/plaw/115/public/97",
          publisher: "U.S. Government Publishing Office",
          publishedDate: "2017-12-22",
          authorityTier: 1,
          channel: "official-primary-statute",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-tcja-irs-notice-2019-33",
          title: "IRS Notice 2019-33",
          locator: "https://www.irs.gov/pub/irs-drop/n-19-33.pdf",
          publisher: "Internal Revenue Service",
          publishedDate: null,
          authorityTier: 2,
          channel: "official-administrative-guidance",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-us-california-ccpa-2020",
      mode: "find",
      kind: "event",
      title: "California Consumer Privacy Act",
      description:
        "A California privacy statute approved in 2018 with major provisions beginning January 1, 2020. It imposes obligations on qualifying for-profit businesses, including U.S. technology firms that do business in California, collect California consumers' personal information, alone or jointly determine the purposes and means of its processing, meet at least one historical statutory threshold, and are not otherwise exempt.",
      nativeIdentity: {
        formalIdentifier: "AB 375",
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      event: {
        displayName: "California Consumer Privacy Act of 2018",
        eventDate: "2020-01-01",
        eventFamily: "Regulation",
        geographies: ["California, United States"],
        populations: [
          "Qualifying for-profit businesses doing business in California",
          "California-covered businesses",
          "U.S. technology firms that do business in California, collect California consumers' personal information, alone or jointly determine the purposes and means of its processing, meet at least one historical statutory threshold, and are not otherwise exempt",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2017-12-18", "2018-06-28", "2020-01-01"],
      affectedPopulation:
        "For-profit legal entities doing business in California that collect consumers' personal information, alone or jointly determine the purposes and means of its processing, meet a statutory threshold, and are not otherwise exempt; the historical threshold version must be reconstructed.",
      requiredVariables: [
        "California business nexus",
        "Historical statutory threshold fields",
        "Personal-information activity",
        "Applicable exemption",
        "Effective compliance period",
      ],
      outcomeLink: {
        text: "AI hypothesis: privacy rights and compliance obligations may affect data practices, digital strategy, innovation, customer relationships, or compliance investment.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "Thresholds and exemptions have changed; current summaries cannot be used automatically for a historical 2020 treatment.",
        "Doing business in California and handling California consumer data may not be observable in standard firm panels.",
        "The registry has not established unit-level legal or realized exposure.",
      ],
      reasons: [
        "The California Secretary of State documents that the precursor consumer-privacy ballot initiative entered circulation on December 18, 2017; this is an early public-discussion milestone, not the introduction date of AB 375.",
        "The enrolled bill documents approval on June 28, 2018 and the January 1, 2020 beginning date.",
        "California Department of Justice implementation material confirms that qualifying businesses faced new obligations.",
      ],
      sources: [
        {
          id: "source-us-california-ccpa-initiative-circulation",
          title:
            "Proposed initiative enters circulation: new consumer privacy rights",
          locator:
            "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
          publisher: "California Secretary of State",
          publishedDate: "2017-12-18",
          authorityTier: 1,
          channel: "official-ballot-initiative-announcement",
          retrievedAt: "2026-08-14",
        },
        {
          id: "source-us-california-ccpa-ab375",
          title: "California Assembly Bill 375, Chapter 55",
          locator:
            "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
          publisher: "California Legislative Information",
          publishedDate: "2018-06-29",
          authorityTier: 1,
          channel: "official-primary-statute",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-california-ccpa-isor",
          title:
            "Initial Statement of Reasons for California Consumer Privacy Act Regulations",
          locator:
            "https://oag.ca.gov/sites/all/files/agweb/pdfs/privacy/ccpa-isor-appendices.pdf",
          publisher: "California Department of Justice",
          publishedDate: "2019-10-11",
          authorityTier: 2,
          channel: "official-administrative-record",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-california-ccpa-oag-overview",
          title: "California Consumer Privacy Act (CCPA)",
          locator: "https://oag.ca.gov/privacy/ccpa",
          publisher: "California Department of Justice",
          publishedDate: null,
          authorityTier: 1,
          channel: "official-guidance-overview",
          retrievedAt: "2026-09-16",
          evidenceText:
            "The California Department of Justice identifies the California Consumer Privacy Act as a California law that gives consumers more control over personal information collected by businesses. Its official overview describes rights to know, delete, opt out of sale or sharing, correct inaccurate information, limit use of sensitive personal information, and receive nondiscriminatory treatment, while distinguishing the law from later amendments and implementing regulations.",
        },
        {
          id: "source-us-california-ccpa-oag-implementation",
          title:
            "Attorney General submits CCPA regulations for approval",
          locator:
            "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
          publisher: "California Department of Justice",
          publishedDate: "2020-06-02",
          authorityTier: 2,
          channel: "official-regulator-press-release",
          retrievedAt: "2026-08-13",
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-eu-gdpr-2018",
      mode: "find",
      kind: "event",
      title: "General Data Protection Regulation",
      description:
        "An EU regulation governing personal-data processing that became applicable on May 25, 2018. Its territorial reach and controller/processor rules require source-specific exposure reconstruction.",
      event: {
        displayName: "General Data Protection Regulation (EU) 2016/679",
        eventDate: "2018-05-25",
        eventFamily: "Regulation",
        geographies: ["European Union", "European Economic Area"],
        populations: [
          "Organizations acting as personal-data controllers or processors in scope of the GDPR",
          "Firms offering goods or services to, or monitoring, people in the European Union when the territorial rule applies",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2016-05-04", "2018-05-25"],
      affectedPopulation:
        "Controllers and processors within the regulation's material and territorial scope, including some organizations outside the EU. Exact scope depends on processing activity and exemptions.",
      requiredVariables: [
        "Controller or processor status",
        "Personal-data processing activity",
        "EU establishment or territorial nexus",
        "Applicable derogation or exemption",
        "Compliance date",
      ],
      outcomeLink: {
        text: "AI hypothesis: data-protection obligations may affect digital innovation, data governance, organizational design, market entry, or compliance investment.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "EU location alone does not establish organizational exposure.",
        "National supervisory and enforcement differences may create additional clocks or treatment versions.",
        "Required processing and territorial-nexus variables may be unavailable in standard archival datasets.",
      ],
      reasons: [
        "Article 99 of the official regulation states that it applies from May 25, 2018.",
        "The legal text supplies the controlling starting point, but later screens must verify the relevant scope provisions.",
      ],
      sources: [
        {
          id: "source-eu-gdpr-regulation-2016-679",
          title: "Regulation (EU) 2016/679",
          locator:
            "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
          publisher: "Official Journal of the European Union",
          publishedDate: "2016-05-04",
          authorityTier: 1,
          channel: "official-primary-regulation",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-eu-nfrd-2017",
      mode: "find",
      kind: "event",
      title: "EU Non-Financial Reporting Directive",
      description:
        "An EU directive introducing non-financial disclosure requirements for specified large public-interest entities, with national rules applying to financial years beginning in 2017.",
      event: {
        displayName: "Directive 2014/95/EU on Non-Financial Reporting",
        eventDate: "2017-01-01",
        eventFamily: "Regulation",
        geographies: ["European Union"],
        populations: [
          "Large public-interest entities in the European Union exceeding 500 employees",
          "Public-interest parent undertakings of large groups exceeding 500 employees",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2014-11-15", "2017-01-01"],
      affectedPopulation:
        "Large public-interest entities and qualifying public-interest parent undertakings exceeding the directive's employee criterion, subject to national transposition and specified exemptions.",
      requiredVariables: [
        "Public-interest-entity status",
        "Large-undertaking or large-group status",
        "Average employee count",
        "Member-state transposition",
        "Financial-year start",
        "Subsidiary exemption status",
      ],
      outcomeLink: {
        text: "AI hypothesis: mandatory non-financial reporting may affect disclosure strategy, sustainability practices, governance, stakeholder engagement, or capital-market outcomes.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "A directive requires member-state transposition, so national dates and rules may differ.",
        "Public-interest status and group exemptions must be reconstructed rather than inferred from size alone.",
        "Actual disclosure exposure and sample variation remain unverified.",
      ],
      reasons: [
        "The official directive identifies the covered entity classes and the 2017 financial-year application boundary.",
        "National transposition remains a Screen 3 verification task.",
      ],
      sources: [
        {
          id: "source-eu-nfrd-directive-2014-95",
          title: "Directive 2014/95/EU",
          locator:
            "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32014L0095",
          publisher: "Official Journal of the European Union",
          publishedDate: "2014-11-15",
          authorityTier: 1,
          channel: "official-primary-directive",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    reviewedRegulatoryCandidate({
      id: "registry-us-colorado-privacy-act-2023",
      title: "Colorado Privacy Act",
      description:
        "Colorado's comprehensive consumer-privacy law became effective on July 1, 2023. Coverage turns on Colorado business or targeting activity and statutory processing thresholds.",
      eventDate: "2023-07-01",
      geographies: ["Colorado, United States"],
      populations: [
        "Controllers conducting business in Colorado or targeting Colorado residents that meet statutory thresholds",
        "Technology firms processing Colorado consumers' personal data",
      ],
      provisionalDates: ["2021-07-07", "2023-07-01"],
      affectedPopulation:
        "Controllers doing business in Colorado or producing products or services intentionally targeted to Colorado residents when the applicable statutory processing threshold is met.",
      requiredVariables: [
        "Colorado business or targeting nexus",
        "Consumer-volume threshold",
        "Revenue and personal-data-sale fields",
        "Entity and data exemptions",
        "Applicable compliance date",
      ],
      limitations: [
        "Colorado nexus, consumer counts, and exemptions may not be observable in standard public-company datasets.",
      ],
      reasons: [
        "The Colorado General Assembly's official session-law record identifies the July 1, 2023 effective date.",
      ],
      nativeIdentity: {
        formalIdentifier: "SB21-190",
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      source: {
        id: "source-us-colorado-sb21-190",
        title: "SB21-190 Protect Personal Data Privacy",
        locator: "https://leg.colorado.gov/bills/sb21-190?exec=1ba5018",
        publisher: "Colorado General Assembly",
        publishedDate: "2021-07-07",
        authorityTier: 1,
        channel: "official-primary-session-law",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-us-connecticut-data-privacy-act-2023",
      title: "Connecticut Data Privacy Act",
      description:
        "Connecticut's consumer-data privacy provisions became effective on July 1, 2023 for covered controllers and processors, subject to statutory thresholds and exemptions.",
      eventDate: "2023-07-01",
      geographies: ["Connecticut, United States"],
      populations: [
        "Controllers or processors conducting business in Connecticut or targeting Connecticut residents that meet statutory thresholds",
        "Technology firms processing Connecticut consumers' personal data",
      ],
      provisionalDates: ["2022-05-10", "2023-07-01"],
      affectedPopulation:
        "Persons conducting business in Connecticut or producing products or services targeted to Connecticut residents when a statutory processing threshold is met.",
      requiredVariables: [
        "Connecticut business or targeting nexus",
        "Consumer-volume threshold",
        "Personal-data-sale revenue share",
        "Entity and data exemptions",
        "Applicable compliance date",
      ],
      limitations: [
        "Historical thresholds, covered data, and exemptions must be reconstructed from the operative statutory version.",
      ],
      reasons: [
        "The Connecticut General Assembly's official codification marks the core consumer-data privacy provisions effective July 1, 2023.",
      ],
      nativeIdentity: {
        formalIdentifier: "Chapter 743jj",
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      source: {
        id: "source-us-connecticut-chapter-743jj-2023",
        title: "Chapter 743jj — Consumer Data Privacy and Online Monitoring",
        locator: "https://www.cga.ct.gov/2023/pub/chap_743jj.htm",
        publisher: "Connecticut General Assembly",
        publishedDate: null,
        authorityTier: 1,
        channel: "official-primary-code",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-us-virginia-consumer-data-protection-2023",
      title: "Virginia Consumer Data Protection Act",
      description:
        "Virginia's Consumer Data Protection Act became effective on January 1, 2023 for covered controllers and processors, with threshold-based scope and specified exemptions.",
      eventDate: "2023-01-01",
      geographies: ["Virginia, United States"],
      populations: [
        "Controllers or processors conducting business in Virginia or targeting Virginia residents that meet statutory thresholds",
        "Technology firms processing Virginia consumers' personal data",
      ],
      provisionalDates: ["2021-03-02", "2023-01-01"],
      affectedPopulation:
        "Persons conducting business in Virginia or producing products or services targeted to Virginia residents when the applicable consumer-processing or data-sale threshold is met.",
      requiredVariables: [
        "Virginia business or targeting nexus",
        "Consumer-volume threshold",
        "Revenue from personal-data sales",
        "Entity and data exemptions",
        "Applicable compliance date",
      ],
      limitations: [
        "Current codification may include later amendments, so Screen 3 must reconstruct the version operative in 2023.",
      ],
      reasons: [
        "Virginia Acts of Assembly Chapter 35 enacted the Consumer Data Protection Act with a January 1, 2023 effective date.",
      ],
      nativeIdentity: {
        formalIdentifier: "Chapter 35",
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      source: {
        id: "source-us-virginia-chapter-35-2021",
        title: "Virginia Acts of Assembly Chapter 35 (2021 Special Session I)",
        locator: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?212+ful+CHAP0035+hil",
        publisher: "Virginia General Assembly",
        publishedDate: "2021-03-02",
        authorityTier: 1,
        channel: "official-primary-session-law",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-us-utah-consumer-privacy-act-2023",
      title: "Utah Consumer Privacy Act",
      description:
        "Utah's Consumer Privacy Act took effect on December 31, 2023, creating consumer rights and controller and processor duties for businesses meeting its statutory scope.",
      eventDate: "2023-12-31",
      geographies: ["Utah, United States"],
      populations: [
        "Controllers and processors subject to the Utah Consumer Privacy Act",
        "Technology firms processing Utah consumers' personal data that meet statutory scope conditions",
      ],
      provisionalDates: ["2022-03-24", "2023-12-31"],
      affectedPopulation:
        "Controllers and processors doing business in Utah or targeting Utah residents with at least $25 million in annual revenue and either the consumer-volume threshold or the smaller-volume plus data-sale-revenue threshold, subject to exemptions.",
      requiredVariables: [
        "Utah business or targeting nexus",
        "Annual revenue threshold",
        "Consumer-volume threshold",
        "Revenue from personal-data sales",
        "Entity and data exemptions",
      ],
      limitations: [
        "The revenue prerequisite, alternative scope thresholds, and exemptions require firm-level legal and data-processing facts that public panels may omit.",
      ],
      reasons: [
        "The Utah Legislature's enrolled S.B. 227 states that the act takes effect on December 31, 2023.",
      ],
      source: {
        id: "source-us-utah-sb227-enrolled",
        title: "S.B. 227 Consumer Privacy Act — Enrolled",
        locator: "https://le.utah.gov/~2022/bills/sbillenr/SB0227.htm",
        publisher: "Utah State Legislature",
        publishedDate: null,
        authorityTier: 1,
        channel: "official-primary-enrolled-bill",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-us-sec-cybersecurity-disclosure-2023",
      title: "SEC Cybersecurity Disclosure Rules",
      description:
        "The SEC adopted standardized cybersecurity incident and risk-management disclosures for public companies in 2023; the final rules became effective on September 5, 2023 with later compliance dates.",
      eventDate: "2023-09-05",
      geographies: ["United States"],
      populations: [
        "Public companies subject to Exchange Act reporting requirements",
        "Domestic registrants and foreign private issuers with applicable SEC filings",
      ],
      provisionalDates: ["2023-07-26", "2023-09-05", "2023-12-18"],
      affectedPopulation:
        "SEC registrants subject to the amended Form 8-K, Form 6-K, Regulation S-K, and Form 20-F disclosure requirements, with compliance timing varying by filing and issuer category.",
      requiredVariables: [
        "SEC registrant and filer status",
        "Issuer category",
        "Fiscal-year end",
        "Applicable disclosure form",
        "Compliance-date classification",
      ],
      limitations: [
        "Rule effectiveness and the several initial compliance dates are distinct clocks and cannot be collapsed into one treatment date.",
      ],
      reasons: [
        "The SEC's official final-rule page records adoption on July 26, 2023, effectiveness on September 5, 2023, and form-specific compliance dates.",
      ],
      source: {
        id: "source-us-sec-cybersecurity-final-rule-2023",
        title: "Cybersecurity Risk Management, Strategy, Governance, and Incident Disclosure",
        locator: "https://www.sec.gov/rules-regulations/2023/07/s7-09-22",
        publisher: "U.S. Securities and Exchange Commission",
        publishedDate: "2023-07-26",
        authorityTier: 1,
        channel: "official-primary-final-rule",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-us-california-iot-security-2020",
      title: "California Security of Connected Devices Law",
      description:
        "California's connected-device security law became operative on January 1, 2020 and requires manufacturers of covered connected devices to equip them with reasonable security features.",
      eventDate: "2020-01-01",
      geographies: ["California, United States"],
      populations: [
        "Manufacturers of connected devices sold or offered for sale in California",
        "Technology and hardware firms producing internet-connected devices for the California market",
      ],
      provisionalDates: ["2018-09-28", "2020-01-01"],
      affectedPopulation:
        "Manufacturers, or firms contracting for manufacture on their behalf, of covered internet- or Bluetooth-connected devices sold or offered for sale in California, subject to statutory exclusions.",
      requiredVariables: [
        "Connected-device manufacturer status",
        "California sale or offer-for-sale nexus",
        "Device connectivity and authentication features",
        "Federal-law and health-data exclusions",
        "Operative compliance period",
      ],
      limitations: [
        "Product-level connected-device and security-feature facts may not map cleanly to firm-level archival observations.",
      ],
      reasons: [
        "The chaptered California bill text states that the connected-device security title becomes operative on January 1, 2020.",
      ],
      nativeIdentity: {
        formalIdentifier: "SB 327",
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      source: {
        id: "source-us-california-sb327-connected-devices",
        title: "SB-327 Information privacy: connected devices",
        locator:
          "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB327",
        publisher: "California Legislative Information",
        publishedDate: "2018-09-28",
        authorityTier: 1,
        channel: "official-primary-statute",
      },
    }),
    reviewedRegulatoryCandidate({
      id: "registry-eu-digital-markets-act-2023",
      title: "EU Digital Markets Act",
      description:
        "The EU Digital Markets Act became applicable on May 2, 2023, establishing designation procedures and obligations for gatekeepers providing covered core platform services.",
      eventDate: "2023-05-02",
      geographies: ["European Union"],
      populations: [
        "Designated gatekeepers providing core platform services in the European Union",
        "Large technology platforms offering covered services to EU business users or end users",
      ],
      provisionalDates: ["2022-11-01", "2023-05-02"],
      affectedPopulation:
        "Providers of core platform services that meet the legal conditions and are designated as gatekeepers, irrespective of the provider's place of establishment.",
      requiredVariables: [
        "Core platform service category",
        "Gatekeeper designation",
        "EU business-user or end-user reach",
        "Designation and compliance dates",
        "Service-specific obligations",
      ],
      limitations: [
        "General applicability, gatekeeper designation, and the later obligation-compliance deadline are separate treatment stages.",
      ],
      reasons: [
        "The official EU regulation and Commission implementation timeline identify May 2, 2023 as the general application date.",
      ],
      source: {
        id: "source-eu-digital-markets-act-2022-1925",
        title: "Regulation (EU) 2022/1925 — Digital Markets Act",
        locator: "https://eur-lex.europa.eu/eli/reg/2022/1925/oj/eng",
        publisher: "Official Journal of the European Union",
        publishedDate: "2022-10-12",
        authorityTier: 1,
        channel: "official-primary-regulation",
      },
    }),
    {
      id: "registry-eu-emissions-trading-2005",
      mode: "find",
      kind: "event",
      title: "Launch of the EU Emissions Trading System",
      description:
        "The EU launched its cap-and-trade emissions system in 2005 for covered installations in power generation and emissions-intensive industry. Installation coverage and allocation rules vary by phase.",
      event: {
        displayName: "EU Emissions Trading System, Phase 1",
        eventDate: "2005-01-01",
        eventFamily: "Regulation",
        geographies: ["European Union"],
        populations: [
          "Operators of covered power and industrial installations in the European Union",
          "Firms owning covered EU ETS installations",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2003-10-25", "2005-01-01"],
      affectedPopulation:
        "Operators and owners of installations within covered activities and capacity thresholds. Firm-level exposure requires installation-to-owner linkage and phase-specific rules.",
      requiredVariables: [
        "Covered installation identifier",
        "Activity and capacity threshold",
        "Member state",
        "Installation ownership by period",
        "Verified emissions or allowance position",
        "Trading phase",
      ],
      outcomeLink: {
        text: "AI hypothesis: carbon pricing and allowance obligations may affect investment, technology adoption, production, ownership, or competitive strategy.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "The legal assignment unit is often the installation, not the firm.",
        "Installation-to-parent ownership histories may be incomplete or require researcher confirmation.",
        "Allocation, coverage, and market design differ across trading phases and member states.",
      ],
      reasons: [
        "Directive 2003/87/EC establishes the trading scheme.",
        "The European Commission records that the EU ETS was launched in 2005.",
      ],
      sources: [
        {
          id: "source-eu-ets-directive-2003-87",
          title: "Directive 2003/87/EC",
          locator:
            "https://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri=CELEX%3A32003L0087%3Aen%3AHTML",
          publisher: "Official Journal of the European Union",
          publishedDate: "2003-10-25",
          authorityTier: 1,
          channel: "official-primary-directive",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-eu-ets-commission-overview",
          title: "About the EU Emissions Trading System",
          locator:
            "https://climate.ec.europa.eu/eu-action/carbon-markets/about-eu-ets_en",
          publisher: "European Commission",
          publishedDate: null,
          authorityTier: 2,
          channel: "official-administrative-overview",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
    {
      id: "registry-us-hurricane-harvey-2017",
      mode: "find",
      kind: "event",
      title: "Hurricane Harvey",
      description:
        "A Category 4 hurricane that made landfall on the Texas coast on August 25, 2017 and produced prolonged flooding. Organizational exposure depends on location, timing, and the form of operational or network contact.",
      event: {
        displayName: "Hurricane Harvey",
        eventDate: "2017-08-25",
        eventFamily: "Disaster",
        geographies: [
          "Texas, United States",
          "United States Gulf Coast",
        ],
        populations: [
          "Organizations with facilities or operations in affected Texas and Gulf Coast areas",
          "Firms with employees, suppliers, customers, or assets exposed to Hurricane Harvey",
        ],
      },
      origin: "registry-reviewed",
      provisionalDates: ["2017-08-23", "2017-08-25", "2017-09-15"],
      affectedPopulation:
        "Organizations with direct physical, workforce, customer, supplier, or infrastructure exposure in affected areas. The relevant exposure channel and geography must be defined by the study.",
      requiredVariables: [
        "Geocoded organizational unit or network tie",
        "Exposure date and duration",
        "Hazard or damage intensity",
        "Facility-to-firm or network linkage",
        "Pre-event organizational location",
      ],
      outcomeLink: {
        text: "AI hypothesis: severe physical disruption and flooding may affect operations, supply chains, workforce behavior, disclosure, investment, or organizational adaptation.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "Headquarters location alone may not represent operational, employee, supplier, or customer exposure.",
        "Landfall, rainfall, flooding, declaration, and recovery are different clocks.",
        "Hazard intensity and organization linkage have not been mapped to any researcher sample.",
      ],
      reasons: [
        "The National Hurricane Center report documents the storm period and landfall.",
        "FEMA records the federal disaster incident period for Texas.",
      ],
      sources: [
        {
          id: "source-us-harvey-nhc-report",
          title: "Tropical Cyclone Report: Hurricane Harvey",
          locator:
            "https://www.nhc.noaa.gov/data/tcr/AL092017_Harvey.pdf",
          publisher: "National Hurricane Center",
          publishedDate: "2018-05-09",
          authorityTier: 1,
          channel: "official-primary-event-report",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
        {
          id: "source-us-harvey-fema-4332",
          title: "Texas Hurricane Harvey (DR-4332-TX)",
          locator: "https://www.fema.gov/disaster/4332",
          publisher: "Federal Emergency Management Agency",
          publishedDate: "2017-08-25",
          authorityTier: 1,
          channel: "official-primary-disaster-declaration",
          retrievedAt: REGISTRY_REVIEW_DATE,
        },
      ],
      assessments: provisionalRegistryAssessments(),
    },
  ];

const PUBLIC_SCREEN02_EVENT_IDS = new Set(
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.map((proposal) => proposal.id),
);
const LEGACY_SCREEN02_EVENT_BY_ID = new Map(
  LEGACY_REVIEWED_SCREEN02_EVENT_REGISTRY.map((proposal) => [
    proposal.id,
    proposal,
  ]),
);

function mergePublicIndexEvidence(proposal: Screen02FindProposal) {
  const legacy = LEGACY_SCREEN02_EVENT_BY_ID.get(proposal.id);
  if (!legacy) return proposal;
  // Preserve reviewed source order while enriching a shared stable source ID
  // with the current public-index evidence passage. Source order is part of
  // the deterministic evidence plan; replacing the whole array would change
  // which official representation is attempted first.
  const currentById = new Map(proposal.sources.map((source) => [
    source.id,
    source,
  ]));
  const sources = [
    ...legacy.sources.map((source) => ({
      ...source,
      ...currentById.get(source.id),
    })),
    ...proposal.sources.filter((source) =>
      !legacy.sources.some((candidate) => candidate.id === source.id)
    ),
  ];
  return {
    ...legacy,
    nativeIdentity: proposal.nativeIdentity,
    ...(proposal.relationshipEvidenceSourceIds
      ? {
          relationshipEvidenceSourceIds: [
            ...proposal.relationshipEvidenceSourceIds,
          ],
        }
      : {}),
    provisionalDates: [...new Set([
      ...legacy.provisionalDates,
      ...proposal.provisionalDates,
    ])],
    limitations: [...new Set([
      ...legacy.limitations,
      ...proposal.limitations,
    ])],
    reasons: [...new Set([...legacy.reasons, ...proposal.reasons])],
    sources,
  } satisfies Screen02FindProposal;
}

/**
 * The complete discovery registry includes the repository-managed public
 * event index. The ordinary production path searches this index explicitly;
 * this combined export supports exact-ID lookup and shared-source reuse. A
 * public-index record replaces a same-id legacy record so the evidence ledger,
 * date roles, and candidate identity stay singular.
 */
export const SCREEN02_DISCOVERY_EVENT_REGISTRY: readonly Screen02FindProposal[] =
  [
    ...LEGACY_REVIEWED_SCREEN02_EVENT_REGISTRY.filter((proposal) =>
      !PUBLIC_SCREEN02_EVENT_IDS.has(proposal.id)
    ),
    ...PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.map(mergePublicIndexEvidence),
  ];

/**
 * Preserve the reviewed-registry contract for compatibility and focused core
 * tests. The ordinary production discovery path explicitly opts into the
 * larger repository-managed discovery registry above.
 */
export const REVIEWED_SCREEN02_EVENT_REGISTRY: readonly Screen02FindProposal[] =
  LEGACY_REVIEWED_SCREEN02_EVENT_REGISTRY;

/**
 * These records exist only so the deterministic core can be exercised without
 * implying that ShockAudit has located a real event. They must never be
 * presented as factual candidates or paired with invented source citations.
 */
export const DEFAULT_FIND_DEMONSTRATION_PROPOSALS: readonly Screen02FindProposal[] =
  [
    {
      id: "demo-find-us-regulation-2019",
      mode: "find",
      kind: "event",
      title: "Fictional demonstration: 2019 disclosure rule",
      description:
        "A fictional record used only to demonstrate Screen 2 filtering and ranking. It is not a real shock candidate.",
      event: {
        displayName: "Fictional 2019 U.S. Manufacturing Disclosure Rule",
        eventDate: "2019-07-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: [
          "U.S. public manufacturing firms",
          "U.S. exchange-listed manufacturing firms",
        ],
      },
      origin: "fictional-demonstration",
      provisionalDates: ["2019-07-01"],
      affectedPopulation: "U.S. public manufacturing firms",
      requiredVariables: [
        "Fictional assignment indicator",
        "Fictional event date",
      ],
      outcomeLink: {
        text: "A demonstration-only hypothesis links the fictional rule to firm profitability.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "stop",
      limitations: [
        "This is a fictional demonstration record and cannot support a real study.",
        "No sources have been located because the event does not exist.",
      ],
      reasons: [
        "Included only to exercise deterministic filtering and display logic.",
      ],
      sources: [],
      fictionalDemo: true,
    },
    {
      id: "demo-find-eu-disaster-2020",
      mode: "find",
      kind: "event",
      title: "Fictional demonstration: 2020 regional disruption",
      description:
        "A fictional record used only to prove that incompatible candidates are removed by hard filters. It is not a real shock candidate.",
      event: {
        displayName: "Fictional 2020 Northern Europe Port Disruption",
        eventDate: "2020-03-15",
        eventFamily: "Disaster",
        geographies: ["Northern Europe"],
        populations: ["Northern European shipping firms"],
      },
      origin: "fictional-demonstration",
      provisionalDates: ["2020-03-15"],
      affectedPopulation: "Northern European shipping firms",
      requiredVariables: [
        "Fictional disruption indicator",
        "Fictional event date",
      ],
      outcomeLink: {
        text: "A demonstration-only hypothesis links the fictional disruption to firm outcomes.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "stop",
      limitations: [
        "This is a fictional demonstration record and cannot support a real study.",
        "No sources have been located because the event does not exist.",
      ],
      reasons: [
        "Included only to verify that hard filters exclude an incompatible record.",
      ],
      sources: [],
      fictionalDemo: true,
    },
  ];

export function defaultAuditRepresentationProposals(
  knownShock: string,
): Screen02AuditProposal[] {
  return [
    {
      id: "audit-whole-package",
      mode: "audit",
      kind: "representation",
      representationType: "whole-package",
      title: "Whole shock package",
      description:
        "Treat the complete named shock as the candidate treatment package.",
      candidateConstruct: `${knownShock} package exposure`,
      operationalization: `A provisional indicator for whether a unit falls within the complete ${knownShock} package.`,
      origin: "unsupported-lead",
      provisionalDates: [],
      affectedPopulation:
        "Not yet established from source-backed eligibility evidence.",
      requiredVariables: [
        "Source-backed package boundary",
        "Unit-level package exposure",
      ],
      outcomeLink: {
        text: `It is an AI-generated hypothesis that exposure to the complete ${knownShock} package could affect the confirmed outcome family.`,
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "No source has yet established the package boundary.",
        "No defensible date or exposed population has yet been located.",
      ],
      reasons: [
        "The whole package is a possible representation, not a verified treatment definition.",
      ],
      sources: [],
    },
    {
      id: "audit-formal-eligibility",
      mode: "audit",
      kind: "representation",
      representationType: "formal-eligibility",
      title: "Formal eligibility or assignment",
      description:
        "Represent the shock through the rule that formally assigns units to exposure.",
      candidateConstruct: `${knownShock} formal assignment`,
      operationalization: `A provisional indicator or dose based on the formal eligibility, jurisdiction, threshold, or assignment rule of ${knownShock}.`,
      origin: "unsupported-lead",
      provisionalDates: [],
      affectedPopulation:
        "Not yet established from source-backed assignment rules.",
      requiredVariables: [
        "Formal eligibility rule",
        "Unit-level eligibility or assignment",
      ],
      outcomeLink: {
        text: `It is an AI-generated hypothesis that formal assignment under ${knownShock} could affect the confirmed outcome family.`,
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "No controlling source has yet established an assignment rule.",
        "Eligibility may not equal realized exposure.",
      ],
      reasons: [
        "Formal assignment is a candidate representation that requires documentary verification.",
      ],
      sources: [],
    },
    {
      id: "audit-phase-clock",
      mode: "audit",
      kind: "representation",
      representationType: "phase-clock",
      title: "Shock phase or clock",
      description:
        "Separate announcement, adoption, effective, implementation, and enforcement timing when those dates may differ.",
      candidateConstruct: `${knownShock} timing phase`,
      operationalization: `A provisional phase-specific measure anchored to one documented clock for ${knownShock}.`,
      origin: "unsupported-lead",
      provisionalDates: [],
      affectedPopulation:
        "Not yet established for any documented implementation phase.",
      requiredVariables: [
        "Documented phase dates",
        "Unit-level phase exposure",
      ],
      outcomeLink: {
        text: `It is an AI-generated hypothesis that a documented phase of ${knownShock} could affect the confirmed outcome family.`,
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "No announcement, adoption, effective, implementation, or enforcement date has yet been verified.",
        "Selecting a clock after inspecting outcomes would be inappropriate.",
      ],
      reasons: [
        "Different clocks can imply different treatment definitions and must be audited before selection.",
      ],
      sources: [],
    },
    {
      id: "audit-realized-exposure",
      mode: "audit",
      kind: "representation",
      representationType: "realized-exposure",
      title: "Realized exposure or intensity",
      description:
        "Represent how strongly each unit actually encountered the named shock rather than formal assignment alone.",
      candidateConstruct: `${knownShock} realized exposure intensity`,
      operationalization: `A provisional continuous or ordered measure of realized exposure to ${knownShock}.`,
      origin: "unsupported-lead",
      provisionalDates: [],
      affectedPopulation:
        "Not yet established from source-backed exposure evidence.",
      requiredVariables: [
        "Unit-level realized exposure",
        "Documented exposure timing",
      ],
      outcomeLink: {
        text: `It is an AI-generated hypothesis that realized exposure intensity to ${knownShock} could affect the confirmed outcome family.`,
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "No realized-exposure measure or source has yet been located.",
        "Realized exposure may be endogenous to unit behavior.",
      ],
      reasons: [
        "Intensity may capture heterogeneous exposure but is not automatically a valid assignment measure.",
      ],
      sources: [],
    },
  ];
}
