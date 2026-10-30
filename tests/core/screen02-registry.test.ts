import { describe, expect, it } from "vitest";

import { deduplicateScreen02Proposals } from "../../src/core/screen02-discovery";
import {
  REVIEWED_SCREEN02_EVENT_REGISTRY,
  SCREEN_02_EVENT_REGISTRY_VERSION,
  reviewedScreen02RegistryProposalMatchesResearchText,
} from "../../src/core/screen02-registry";

const officialHosts = new Set([
  "climate.ec.europa.eu",
  "digital-markets-act.ec.europa.eu",
  "eur-lex.europa.eu",
  "law.lis.virginia.gov",
  "legacylis.virginia.gov",
  "le.utah.gov",
  "leg.colorado.gov",
  "leginfo.legislature.ca.gov",
  "lis.virginia.gov",
  "oag.ca.gov",
  "www.cga.ct.gov",
  "www.sos.ca.gov",
  "www.fema.gov",
  "www.federalregister.gov",
  "www.ftc.gov",
  "www.govinfo.gov",
  "www.irs.gov",
  "www.leg.state.nv.us",
  "www.legislation.gov.uk",
  "www.nhc.noaa.gov",
  "www.sec.gov",
]);

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

describe("reviewed Screen 2 event registry", () => {
  it("applies one topical prefilter to old and newer named records", () => {
    const ccpa = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) => record.id === "registry-us-california-ccpa-2020",
    );
    const gdpr = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) => record.id === "registry-eu-gdpr-2018",
    );
    expect(ccpa).toBeDefined();
    expect(gdpr).toBeDefined();
    expect(
      reviewedScreen02RegistryProposalMatchesResearchText(
        ccpa!,
        "Manufacturing product safety",
      ),
    ).toBe(false);
    expect(
      reviewedScreen02RegistryProposalMatchesResearchText(
        gdpr!,
        "Electric utility grid investment",
      ),
    ).toBe(false);
  });

  it("publishes a versioned, diverse registry of at least eight real events", () => {
    expect(SCREEN_02_EVENT_REGISTRY_VERSION).toMatch(
      /^screen-02-reviewed-events-\d{4}-\d{2}-\d{2}-v\d+$/,
    );
    expect(REVIEWED_SCREEN02_EVENT_REGISTRY.length).toBeGreaterThanOrEqual(
      8,
    );

    const ids = REVIEWED_SCREEN02_EVENT_REGISTRY.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "registry-us-sarbanes-oxley-2002",
        "registry-us-tax-cuts-jobs-act-2017",
        "registry-us-california-ccpa-2020",
        "registry-eu-gdpr-2018",
        "registry-eu-nfrd-2017",
        "registry-eu-emissions-trading-2005",
        "registry-us-hurricane-harvey-2017",
      ]),
    );

    expect(
      REVIEWED_SCREEN02_EVENT_REGISTRY.some(
        (record) => record.event.eventFamily === "Tax",
      ),
    ).toBe(true);
    expect(
      REVIEWED_SCREEN02_EVENT_REGISTRY.some(
        (record) => record.event.eventFamily === "Disaster",
      ),
    ).toBe(true);
  });

  it("keeps every real record distinct from fictional demonstrations", () => {
    for (const record of REVIEWED_SCREEN02_EVENT_REGISTRY) {
      expect(record.mode).toBe("find");
      expect(record.kind).toBe("event");
      expect(record.origin).toBe("registry-reviewed");
      expect(record.fictionalDemo).toBeUndefined();
      expect(record.id).not.toContain("demo");
      expect(record.title.toLocaleLowerCase("en-US")).not.toContain(
        "fictional",
      );
      expect(record.sources.length).toBeGreaterThan(0);
      expect(
        record.sources.every((source) => source.isFictionalDemo === undefined),
      ).toBe(true);
    }
  });

  it("keeps at least ten distinct source-linked regulations available for the 2017–2023 Find comparison", () => {
    const inPeriodRegulations = REVIEWED_SCREEN02_EVENT_REGISTRY.filter(
      (record) =>
        record.event.eventFamily === "Regulation" &&
        [record.event.eventDate, ...record.provisionalDates].some(
          (date) => date >= "2017-01-01" && date <= "2023-12-31",
        ),
    );
    const distinct = deduplicateScreen02Proposals(inPeriodRegulations)
      .proposals;

    expect(inPeriodRegulations.length).toBeGreaterThanOrEqual(10);
    expect(distinct).toHaveLength(inPeriodRegulations.length);
    expect(distinct.every((record) => record.sources.length > 0)).toBe(true);
  });

  it("uses only located official sources with stable identifiers", () => {
    const sourcesById = new Map<string, string>();
    for (const record of REVIEWED_SCREEN02_EVENT_REGISTRY) {
      for (const source of record.sources) {
        const locator = new URL(source.locator);
        expect(locator.protocol).toBe("https:");
        expect(officialHosts.has(locator.hostname)).toBe(true);
        expect(source.authorityTier).toBeLessThanOrEqual(2);
        expect(source.channel).toMatch(/^official-/);
        const serialized = JSON.stringify(source);
        const prior = sourcesById.get(source.id);
        if (prior !== undefined) expect(serialized).toBe(prior);
        sourcesById.set(source.id, serialized);
      }
    }
    expect(sourcesById.size).toBeGreaterThanOrEqual(10);
  });

  it("keeps a bounded official CCPA implementation source when the controlling pages are slow or oversized", () => {
    const ccpa = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) => record.id === "registry-us-california-ccpa-2020",
    );
    expect(ccpa?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-us-california-ccpa-oag-overview",
          title: "California Consumer Privacy Act (CCPA)",
          locator: "https://oag.ca.gov/privacy/ccpa",
          publisher: "California Department of Justice",
          publishedDate: null,
          authorityTier: 1,
          channel: "official-guidance-overview",
          retrievedAt: "2026-09-16",
          evidenceText: expect.stringContaining(
            "gives consumers more control over personal information",
          ),
        }),
        expect.objectContaining({
          id: "source-us-california-ccpa-oag-implementation",
          title: "Attorney General submits CCPA regulations for approval",
          locator:
            "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
          publisher: "California Department of Justice",
          publishedDate: "2020-06-02",
          authorityTier: 2,
          channel: "official-regulator-press-release",
          retrievedAt: "2026-08-13",
        }),
      ]),
    );
  });

  it("uses the canonical California bill-text page for the reviewed connected-devices law", () => {
    const connectedDevices = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) =>
        record.id === "registry-us-california-iot-security-2020",
    );

    expect(connectedDevices?.sources).toContainEqual(
      expect.objectContaining({
        id: "source-us-california-sb327-connected-devices",
        title: "SB-327 Information privacy: connected devices",
        locator:
          "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB327",
        publisher: "California Legislative Information",
        publishedDate: "2018-09-28",
        authorityTier: 1,
        channel: "official-primary-statute",
      }),
    );
    expect(
      connectedDevices?.sources.some((source) =>
        source.locator.includes("billVersionsCompareClient.xhtml")
      ),
    ).toBe(false);
  });

  it("binds Virginia to the 2021 enactment rather than a later amendment", () => {
    const virginia = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) =>
        record.id === "registry-us-virginia-consumer-data-protection-2023",
    );

    expect(virginia?.sources).toContainEqual(
      expect.objectContaining({
        id: "source-us-virginia-chapter-35-2021",
        title:
          "Virginia Acts of Assembly Chapter 35 (2021 Special Session I)",
        locator:
          "https://legacylis.virginia.gov/cgi-bin/legp604.exe?212+ful+CHAP0035+hil",
        publishedDate: "2021-03-02",
        authorityTier: 1,
        channel: "official-primary-session-law",
      }),
    );
    expect(JSON.stringify(virginia)).not.toContain("HB381");
    expect(JSON.stringify(virginia)).not.toContain("CHAP0423");
  });

  it("records the source-checkable technology subset of CCPA coverage", () => {
    const ccpa = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) => record.id === "registry-us-california-ccpa-2020",
    );

    expect(ccpa?.event.populations).toContain(
      "U.S. technology firms that do business in California, collect California consumers' personal information, alone or jointly determine the purposes and means of its processing, meet at least one historical statutory threshold, and are not otherwise exempt",
    );
  });

  it("records the authoritative precursor-initiative circulation milestone without inventing a January 3 CCPA announcement", () => {
    const ccpa = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (record) => record.id === "registry-us-california-ccpa-2020",
    );
    expect(ccpa?.provisionalDates).toEqual([
      "2017-12-18",
      "2018-06-28",
      "2020-01-01",
    ]);
    expect(ccpa?.provisionalDates).not.toContain("2018-01-03");
    expect(ccpa?.sources).toContainEqual(
      expect.objectContaining({
        id: "source-us-california-ccpa-initiative-circulation",
        locator:
          "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
        publisher: "California Secretary of State",
        publishedDate: "2017-12-18",
        authorityTier: 1,
        channel: "official-ballot-initiative-announcement",
      }),
    );
    expect(ccpa?.reasons.join(" ")).toMatch(
      /precursor.+entered circulation.+not the introduction date of AB 375/i,
    );
  });

  it("stores valid event, provisional, publication, and review dates", () => {
    for (const record of REVIEWED_SCREEN02_EVENT_REGISTRY) {
      expect(isValidIsoDate(record.event.eventDate)).toBe(true);
      expect(record.provisionalDates).toContain(record.event.eventDate);
      for (const date of record.provisionalDates) {
        expect(isValidIsoDate(date)).toBe(true);
      }
      for (const source of record.sources) {
        if (source.publishedDate !== null) {
          expect(isValidIsoDate(source.publishedDate)).toBe(true);
        }
        if (source.retrievedAt !== undefined) {
          expect(isValidIsoDate(source.retrievedAt)).toBe(true);
        }
      }
    }
  });

  it("keeps measurement and exposure judgments provisional", () => {
    for (const record of REVIEWED_SCREEN02_EVENT_REGISTRY) {
      expect(record.likelyServiceLevel).toBe("event-reconnaissance");
      expect(record.limitations.length).toBeGreaterThan(0);
      expect(record.requiredVariables.length).toBeGreaterThan(0);
      expect(record.outcomeLink.status).toBe("ai-hypothesis");
      expect(record.assessments?.exposureObservability?.value).toBeNull();
      expect(record.assessments?.timeSupport?.value).toBeNull();
      expect(record.assessments?.variation?.value).toBeNull();
    }
  });
});
