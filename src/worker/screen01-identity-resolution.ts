import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import { createIdentityCandidate, type IdentityCandidateInput } from
  "../core/six-screen/workflow";
import type {
  IdentityCandidate,
  SixScreenWorkflowState,
  TypedDate,
} from "../core/six-screen/contracts";
import { policySearchQueryVariants } from
  "../core/policy-search-query";
import {
  PUBLIC_SCREEN02_IDENTITY_ONLY_PROPOSALS,
  PUBLIC_SCREEN02_EVENT_DATE_DETAILS,
  SCREEN02_PUBLIC_EVENT_INDEX_VERSION,
} from "../core/screen02-public-event-index";
import { SCREEN02_DISCOVERY_EVENT_REGISTRY } from
  "../core/screen02-registry";
import {
  fetchFederalRegisterProposals,
  type Screen02ConnectorFetch,
  type Screen02OfficialConnectorResult,
} from "./screen02-connectors";
import {
  fetchEuCellarLegalProposals,
  fetchUkLegislationProposals,
} from "./screen02-global-connectors";
import {
  federalRegisterExactDocumentRepresentations,
  fetchRepresentation,
} from "./screen02-federal-register-acquisition";
import {
  acquireScreen01OfficialPolicyDocument,
} from "./screen01-official-policy-document";
import {
  inspectPublicIdentityWebpage,
  type Screen01WebpageInspection,
} from "./screen01-webpage-identity";
import type { Screen02FindProposal, Screen02Source } from
  "../core/screen02-types";
import {
  discoverGovInfoPublicLaws,
  govInfoPublicLawPackageFromLocator,
} from "./screen01-govinfo-statute-discovery";
import { searchOpenStatesBills } from "./openstates-bills";
import {
  usStateForScreen02Geography,
  usStateMentionForScreen02Text,
} from "./screen02-source-router";

type IdentityBoundProposal = Screen02FindProposal & {
  nativeIdentity: NonNullable<Screen02FindProposal["nativeIdentity"]>;
};

type IdentitySource = IdentityCandidate["identitySources"][number];

const SCREEN01_IDENTITY_PROPOSAL_REGISTRY = [
  ...SCREEN02_DISCOVERY_EVENT_REGISTRY,
  ...PUBLIC_SCREEN02_IDENTITY_ONLY_PROPOSALS,
] as const;

export const SCREEN_01_IDENTITY_RESOLUTION_PROTOCOL_VERSION =
  "screen-01-identity-resolution-v2" as const;
export const SCREEN_01_IDENTITY_ROUTE_VERSION =
  "screen-01-name-led-source-router-v10" as const;

export type Screen01IdentityResolutionStatus =
  | "resolved"
  | "not_resolved"
  | "not_enough_information"
  | "unsupported_for_request"
  | "source_unavailable";

export type Screen01IdentityResolutionResult = {
  protocolVersion: typeof SCREEN_01_IDENTITY_RESOLUTION_PROTOCOL_VERSION;
  status: Screen01IdentityResolutionStatus;
  candidates: IdentityCandidateInput[];
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  usage: {
    sourceQueries: number;
    metadataRecords: number;
    documentAttempts: number;
    usefulDocuments: number;
    transportHops: number;
    receivedBytes: number;
    decodedBytes: number;
    activeResearchMs: number;
    cpuMs: number;
    providerCostUnits: Record<string, number>;
  };
  outcomeValuesInspected: false;
};

const exactFederalRegisterDocumentPattern = /\b\d{4}-\d{4,6}\b/u;
const MAX_METADATA_LEADS = 20;
const MAX_VISIBLE_CANDIDATES = 3;
const MAX_VALIDATED_CANDIDATES = 4;
const MAX_RETAINED_IDENTITY_TEXT = 12_000;
const FEDERAL_IDENTITY_METADATA_ATTEMPT_TIMEOUT_MS = 12_000;

async function verifyOpenStatesOfficialIdentityPage(input: {
  candidate: IdentityCandidateInput;
  fetch: Screen02ConnectorFetch;
}) {
  const sourceIndex = input.candidate.identitySources.findIndex((source) =>
    source.authorityTier === "tier-1" &&
    source.provider === "Official state legislature"
  );
  const source = input.candidate.identitySources[sourceIndex];
  if (!source) return { candidate: input.candidate, inspection: null };
  const inspection = await inspectPublicIdentityWebpage({
    url: source.locator,
    name: input.candidate.officialTitle,
    fetch: input.fetch,
    timeoutMs: 8_000,
  });
  if (inspection.status !== "lead") {
    return { candidate: input.candidate, inspection };
  }
  const checkedSource: IdentitySource = {
    ...source,
    title: inspection.title,
    routeId: "openstates_official_page_identity",
    routeVersion: "openstates-official-page-identity-v1",
    accessStatus: "retained_passage",
    inspectedText: "abstract",
    contentHash: fingerprintSixScreenValue(inspection.excerpt),
    retainedText: inspection.excerpt,
    limitation:
      "The linked official legislature page was inspected and its identity text was retained. Screen 2 must still establish the controlling enacted text, amendments, legal effect, and historical version.",
  };
  const identitySources = input.candidate.identitySources.map((item, index) =>
    index === sourceIndex ? checkedSource : item
  );
  return {
    candidate: {
      ...input.candidate,
      identitySources,
      identitySourceIds: identitySources.map(({ id }) => id),
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      matchExplanation:
        `${input.candidate.matchExplanation} ShockAudit also inspected the linked official legislature page and retained its identity text; it did not infer legal effect from the page title alone.`,
    },
    inspection,
  };
}

type OperationalIdentityRoute =
  | "federal_register"
  | "govinfo_statute"
  | "openstates"
  | "eu_cellar"
  | "uk_legislation";

const GENERIC_NAME_WORDS = new Set([
  "a", "an", "and", "act", "bill", "code", "enactment", "final", "for",
  "law", "of", "order", "regulation", "regulations", "rule", "the", "to",
]);
const INITIALISM_IGNORED_WORDS = new Set([
  "a", "an", "and", "for", "of", "the", "to",
]);

function usage() {
  return {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
    activeResearchMs: 0,
    cpuMs: 0,
    providerCostUnits: {} as Record<string, number>,
  };
}

export function normalizePolicyIdentityText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/gu, " and ")
    .replace(/[’']/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function significantWords(value: string) {
  return normalizePolicyIdentityText(value).split(" ").filter((word) =>
    word.length > 1 && !GENERIC_NAME_WORDS.has(word)
  );
}

function stageNeutralTitle(title: string) {
  return title.replace(
    /\s+(?:enactment|amendment|final order|liability ruling|implementation)$/iu,
    "",
  ).trim();
}

function titleAliases(proposal: IdentityBoundProposal) {
  const base = stageNeutralTitle(proposal.title);
  const initials = normalizePolicyIdentityText(base).split(" ").filter((word) =>
    word && !/^\d{4}$/u.test(word) && !INITIALISM_IGNORED_WORDS.has(word)
  ).map((word) => word[0]).join("")
    .toLocaleUpperCase("en-US");
  return [...new Set([
    base,
    ...(proposal.event.displayName !== proposal.title
      ? [proposal.event.displayName]
      : []),
    ...(initials.length >= 3 && initials.length <= 12 ? [initials] : []),
    ...(proposal.nativeIdentity.formalIdentifier
      ? [proposal.nativeIdentity.formalIdentifier]
      : []),
  ].map((value) => value.trim()).filter(Boolean))];
}

function boundedLevenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  if (left.length > 160 || right.length > 160) return 161;
  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}

function nameSimilarity(query: string, names: readonly string[]) {
  const normalizedQuery = normalizePolicyIdentityText(query);
  if (!normalizedQuery) return 0;
  let best = 0;
  for (const name of names) {
    const normalizedName = normalizePolicyIdentityText(name);
    if (!normalizedName) continue;
    if (normalizedQuery === normalizedName) return 1;
    if (
      normalizedName.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedName)
    ) best = Math.max(best, 0.92);
    const distance = boundedLevenshtein(normalizedQuery, normalizedName);
    best = Math.max(
      best,
      1 - distance / Math.max(normalizedQuery.length, normalizedName.length),
    );
    const queryWords = new Set(significantWords(normalizedQuery));
    const nameWords = new Set(significantWords(normalizedName));
    const overlap = [...queryWords].filter((word) => nameWords.has(word)).length;
    const union = new Set([...queryWords, ...nameWords]).size;
    if (union) best = Math.max(best, overlap / union);
  }
  return best;
}

function nameTermCoverage(query: string, names: readonly string[]) {
  const queryWords = new Set(significantWords(query));
  if (!queryWords.size) return 0;
  let best = 0;
  for (const name of names) {
    const nameWords = new Set(significantWords(name));
    const overlap = [...queryWords].filter((word) => nameWords.has(word)).length;
    best = Math.max(best, overlap / queryWords.size);
  }
  return best;
}

function requestedStageHint(workflow: SixScreenWorkflowState) {
  const explicitStage = normalizePolicyIdentityText(
    workflow.intendedEpisode ?? "",
  );
  if (explicitStage && explicitStage !== "not sure yet") return explicitStage;
  const normalizedName = normalizePolicyIdentityText(
    workflow.currentShockInput,
  );
  if (/\bfinal rule\b/u.test(normalizedName)) return "final rule";
  if (/\bproposed rule\b/u.test(normalizedName)) return "proposed rule";
  if (/\bnotice\b/u.test(normalizedName)) return "notice";
  return "";
}

function stageRankingAdjustment(requestedStage: string, returnedStage: string) {
  const requestedTerms = requestedStage.split(" ").filter((value) =>
    value.length > 3 && !INITIALISM_IGNORED_WORDS.has(value)
  );
  const matchingStageTerms = requestedTerms.filter(
    (term) => returnedStage.includes(term),
  ).length;
  return matchingStageTerms * 80 -
    (requestedTerms.length - matchingStageTerms) * 80;
}

function lifecycleRankingAdjustment(input: {
  requestedStage: string;
  title: string;
  description: string;
  returnedStage: string;
}) {
  const lifecycleText = normalizePolicyIdentityText(
    `${input.title} ${input.description}`,
  );
  const correction = /\bcorrection\b/u.test(
    `${normalizePolicyIdentityText(input.title)} ${input.returnedStage}`,
  );
  if (input.requestedStage !== "final rule") return correction ? -80 : 0;
  const foundational =
    /\b(?:adopt(?:s|ed)?|creat(?:e|es|ed)|establish(?:es|ed)?|finaliz(?:e|es|ed)|implement(?:s|ed)?|set forth)\b/u.test(lifecycleText);
  const maintenance =
    /\b(?:amend(?:s|ed)?|correct(?:s|ed|ion)?|refin(?:e|es|ed)|revis(?:e|es|ed)|updat(?:e|es|ed))\b/u.test(lifecycleText);
  return (foundational ? 80 : 0) - (maintenance ? 25 : 0) -
    (correction ? 80 : 0);
}

function jurisdictionMatches(requested: string | null, actual: string | null) {
  if (!requested) return true;
  const requestedState = usStateForScreen02Geography(requested);
  const actualState = usStateForScreen02Geography(actual ?? "");
  if (requestedState && actualState) {
    return requestedState.code === actualState.code;
  }
  const requestedText = normalizePolicyIdentityText(requested);
  const actualText = normalizePolicyIdentityText(actual ?? "");
  const unitedStatesRequest = /^(?:united states|u s|us|usa)$/u.test(
    requestedText,
  );
  if (unitedStatesRequest && /\b(?:united states|u s states)\b/u.test(
    actualText,
  )) return true;
  return Boolean(
    requestedText && actualText &&
      (requestedText === actualText || actualText.includes(requestedText) ||
        requestedText.includes(actualText)),
  );
}

function exactFederalRegisterDocumentNumber(workflow: SixScreenWorkflowState) {
  const values = [
    workflow.currentShockInput,
    workflow.officialIdentifier ?? "",
    ...workflow.officialSourceLocators,
  ];
  for (const value of values) {
    const match = exactFederalRegisterDocumentPattern.exec(value);
    if (match) return match[0];
  }
  return null;
}

function federalRegisterDocumentNumberFromProposal(
  proposal: IdentityBoundProposal,
) {
  const formalIdentifier = proposal.nativeIdentity.formalIdentifier?.match(
    exactFederalRegisterDocumentPattern,
  )?.[0];
  if (formalIdentifier) return formalIdentifier;
  for (const source of proposal.sources) {
    const documentNumber = source.locator.match(
      /(?:\/documents\/\d{4}\/\d{2}\/\d{2}\/|\/documents\/)(\d{4}-\d{4,6})(?:\/|$)/u,
    )?.[1];
    if (documentNumber) return documentNumber;
  }
  return null;
}

function exactEuCelexIdentifier(workflow: SixScreenWorkflowState) {
  for (const value of [
    workflow.officialIdentifier ?? "",
    ...workflow.officialSourceLocators,
  ]) {
    try {
      const url = new URL(value);
      if (url.hostname === "eur-lex.europa.eu") {
        const celex = url.searchParams.get("uri")?.replace(/^CELEX:/iu, "");
        if (celex && /^[A-Za-z0-9._:/-]{1,120}$/u.test(celex)) {
          return celex.toUpperCase();
        }
      }
    } catch {
      const match = /^(?:CELEX:)?(\d[A-Za-z0-9._:/-]{3,119})$/iu.exec(
        value.trim(),
      );
      if (match) return match[1]!.toUpperCase();
    }
  }
  return null;
}

function dateWindow(approximateYear: string | null) {
  if (!approximateYear || !/^\d{4}$/u.test(approximateYear)) return null;
  const year = Number(approximateYear);
  if (year < 1800 || year > 2100) return null;
  return {
    startDate: `${year - 3}-01-01`,
    endDate: `${year + 3}-12-31`,
  };
}

function exactUkInstrumentTitleYear(value: string) {
  const normalized = normalizePolicyIdentityText(value);
  if (
    !/\b(?:act|measure|order|regulations?|rules?)\b/u.test(normalized)
  ) return null;
  return /\b((?:18|19|20)\d{2})$/u.exec(normalized)?.[1] ?? null;
}

function typedDateKind(role: string): TypedDate["kind"] {
  if (role === "announcement" || role === "proposal") return "announcement";
  if (role === "adoption" || role === "enactment") return "adoption";
  if (role === "scheduled_effect") return "scheduled_effect";
  if (role === "effective") return "legal_effect";
  if (role === "implementation") return "implementation";
  if (role === "enforcement") return "enforcement";
  if (role === "amendment") return "amendment";
  if (role === "publication") return "publication";
  if (role === "injunction") return "injunction";
  if (role === "invalidation") return "invalidation";
  if (role === "withdrawal") return "withdrawal";
  if (role === "suspension") return "suspension";
  if (role === "repeal") return "repeal";
  if (role === "supersession") return "supersession";
  return "other";
}

function formalIdentifiers(proposal: IdentityBoundProposal) {
  const values = (proposal.nativeIdentity.formalIdentifier ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) =>
      /^FR\s+Doc\.?\s+(\d{4}-\d{4,6})$/iu.exec(value)?.[1] ?? value
    );
  for (const source of proposal.sources) {
    try {
      const url = new URL(source.locator);
      if (
        (url.hostname === "federalregister.gov" ||
          url.hostname === "www.federalregister.gov")
      ) {
        const documentNumber = /^\/documents\/\d{4}\/\d{2}\/\d{2}\/(\d{4}-\d{4,6})(?:\/|$)/u
          .exec(url.pathname)?.[1];
        if (documentNumber) values.push(documentNumber);
      }
      if (url.hostname === "leginfo.legislature.ca.gov") {
        const billId = url.searchParams.get("bill_id");
        const match = /^(\d{4})(\d{4})([A-Z]+)(\d+)$/u.exec(billId ?? "");
        if (match) {
          values.push(
            `${match[3]} ${Number(match[4])} (${match[1]}–${match[2]} Reg. Sess.)`,
          );
        }
      }
      if (
        url.hostname === "www.legislation.gov.uk" ||
        url.hostname === "legislation.gov.uk"
      ) {
        const uk = /^\/(?:id\/)?(ukpga|uksi|ukla|asp|ssi|anaw|wsi|nia|nisr|ukcm|ukci)\/(\d{4})\/(\d+)(?:\/|$)/u
          .exec(`${url.pathname.replace(/\/$/u, "")}/`);
        if (uk) values.push(`${uk[1]}/${uk[2]}/${uk[3]}`);
      }
      if (url.hostname === "eur-lex.europa.eu") {
        const celex = url.searchParams.get("uri")?.replace(/^CELEX:/iu, "");
        if (celex && /^[A-Za-z0-9._:/-]{1,120}$/u.test(celex)) {
          if (!values.some((value) =>
            value.replace(/^CELEX:/iu, "").toUpperCase() ===
              celex.toUpperCase()
          )) values.push(`CELEX:${celex.toUpperCase()}`);
        }
      }
    } catch {
      // Invalid locators are rejected by the retained index validator.
    }
  }
  return [...new Set(values)];
}

function sourceFamily(source: Screen02Source, proposal: IdentityBoundProposal) {
  const jurisdiction = normalizePolicyIdentityText(
    proposal.nativeIdentity.issuingJurisdiction ?? "",
  );
  if (jurisdiction === "united kingdom") return "UK legislation";
  if (jurisdiction === "european union") {
    return proposal.event.eventFamily || "EU legal instrument";
  }
  if (/statute|legislation|session-law|enacted-bill|bill-record/iu.test(
    source.channel,
  )) {
    return jurisdiction === "united states" &&
        /\bpublic law\b/iu.test(proposal.nativeIdentity.formalIdentifier ?? "")
      ? "federal statute"
      : jurisdiction === "multiple u s states"
        ? "multi-state policy adoption series"
        : "state legislation";
  }
  if (/final-rule|proposed-rule|rulemaking|regulation/iu.test(source.channel)) {
    const federal = normalizePolicyIdentityText(
      proposal.nativeIdentity.issuingJurisdiction ?? "",
    ) === "united states" &&
      (proposal.sources.some(({ locator }) => {
        try {
          return new URL(locator).hostname === "www.federalregister.gov";
        } catch {
          return false;
        }
      }) || /\bFR\b/u.test(proposal.nativeIdentity.formalIdentifier ?? ""));
    return federal ? "federal administrative rule" : "administrative rule";
  }
  if (/enforcement|order|ruling|consent/iu.test(source.channel)) {
    return "enforcement or adjudicatory action";
  }
  return proposal.event.eventFamily;
}

function defaultIdentityWindow(
  workflow: SixScreenWorkflowState,
  route: OperationalIdentityRoute,
  retrievedAt: string,
) {
  // A terminal year is part of a UK instrument's formal title. Query that
  // exact catalog year so newer derivative instruments cannot crowd the named
  // Act, Order, Measure, Regulations, or Rules out of the bounded result set.
  const exactUkYear = route === "uk_legislation"
    ? exactUkInstrumentTitleYear(workflow.currentShockInput)
    : null;
  if (exactUkYear) {
    return {
      startDate: `${exactUkYear}-01-01`,
      endDate: `${exactUkYear}-12-31`,
    };
  }
  const clue = dateWindow(workflow.approximateYear) ??
    dateWindow(/\b(18|19|20)\d{2}\b/u.exec(workflow.currentShockInput)?.[0] ?? null);
  if (clue) return clue;
  return {
    startDate: route === "eu_cellar" ? "1952-01-01" :
      route === "uk_legislation" ? "1900-01-01" : "1994-01-01",
    endDate: retrievedAt.slice(0, 10),
  };
}

function supportedLocatorRoute(value: string): OperationalIdentityRoute | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (govInfoPublicLawPackageFromLocator(value)) return "govinfo_statute";
    if (
      url.hostname === "www.federalregister.gov" ||
      url.hostname === "federalregister.gov"
    ) return "federal_register";
    if (
      url.hostname === "www.legislation.gov.uk" ||
      url.hostname === "legislation.gov.uk"
    ) return "uk_legislation";
    if (
      url.hostname === "eur-lex.europa.eu" ||
      url.hostname === "publications.europa.eu"
    ) return "eu_cellar";
  } catch {
    // The workflow schema validates locators; retain a defensive null here.
  }
  return null;
}

function locatorIdentity(value: string) {
  try {
    const url = new URL(value);
    if (/^(?:www\.)?legislation\.gov\.uk$/u.test(url.hostname)) {
      const instrument = /^\/(?:id\/)?(ukpga|uksi|ukla|asp|ssi|anaw|wsi|nia|nisr|ukcm|ukci)\/(\d{4})\/(\d+)(?:\/|$)/u.exec(url.pathname);
      // Identity is the instrument; enacted, contents and section URLs are
      // representations. Their version/episode evidence remains separate.
      if (instrument) return `legislation.gov.uk/${instrument[1]}/${instrument[2]}/${instrument[3]}`;
    }
    const path = url.pathname.replace(/^\/id(?=\/)/u, "")
      .replace(/\/data\.xml$/u, "").replace(/\/$/u, "");
    const celex = url.searchParams.get("uri");
    return `${url.hostname.replace(/^www\./u, "")}${path}${celex ? `?uri=${celex}` : ""}`;
  } catch {
    return value;
  }
}

function proposalMatchesSuppliedLocator(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
) {
  const supplied = new Set(workflow.officialSourceLocators.map(locatorIdentity));
  return proposal.sources.some(({ locator }) =>
    supplied.has(locatorIdentity(locator))
  );
}

function identityRoutePlan(
  workflow: SixScreenWorkflowState,
  strongReadyIndexProposal: IdentityBoundProposal | null,
  govInfoConfigured: boolean,
  openStatesConfigured: boolean,
): OperationalIdentityRoute[] {
  const explicit = [...new Set(workflow.officialSourceLocators.map(
    supportedLocatorRoute,
  ).filter((value): value is OperationalIdentityRoute => value !== null))];
  if (explicit.length) return explicit.slice(0, 2);
  if (strongReadyIndexProposal) {
    const nativeRoutes = [...new Set(strongReadyIndexProposal.sources.map(
      ({ locator }) => supportedLocatorRoute(locator),
    ).filter((value): value is OperationalIdentityRoute => value !== null))];
    const jurisdiction = normalizePolicyIdentityText(
      strongReadyIndexProposal.nativeIdentity.issuingJurisdiction ?? "",
    );
    const stateRecord = jurisdiction !== "united states" &&
      (Boolean(usStateForScreen02Geography(
        strongReadyIndexProposal.nativeIdentity.issuingJurisdiction ?? "",
      )) || jurisdiction === "multiple u s states");
    // The reviewed U.S. cache already carries source-backed identity
    // evidence. Return that result immediately instead of making an exact
    // cache hit wait on a synchronous provider refresh. Explicit supported
    // locators are routed above, and uncatalogued/ambiguous names continue
    // through the live routes below, so the cache remains a fast path rather
    // than an allowlist.
    if (jurisdiction === "united states" || stateRecord) return [];
    const federalStatute = jurisdiction === "united states" &&
      (/\bpublic law\b/iu.test(
        strongReadyIndexProposal.nativeIdentity.formalIdentifier ?? "",
      ) || strongReadyIndexProposal.sources.some(({ channel }) =>
        /statute|legislation|public-law/iu.test(channel)));
    const inferred = stateRecord && openStatesConfigured
      ? ["openstates" as const]
      : federalStatute && govInfoConfigured
        ? ["govinfo_statute" as const]
        : jurisdiction === "united states"
          ? ["federal_register" as const]
          : [];
    // A reviewed hit is a low-latency cache, not an allowlist. Recheck one
    // native catalog so the cache does not hide a distinct stage, version, or
    // newer official representation.
    return [...new Set([...nativeRoutes, ...inferred])].slice(0, 1);
  }
  const jurisdiction = normalizePolicyIdentityText(
    workflow.requestedJurisdiction ?? "",
  );
  const stateHint = usStateForScreen02Geography(
    workflow.requestedJurisdiction ?? "",
  ) ?? usStateMentionForScreen02Text(workflow.currentShockInput);
  if (stateHint && openStatesConfigured) {
    return ["openstates"];
  }
  if (/\b(?:united kingdom|great britain|england|wales|scotland|northern ireland|uk)\b/u.test(jurisdiction)) {
    return ["uk_legislation"];
  }
  if (/\b(?:european union|eu)\b/u.test(jurisdiction)) {
    return ["eu_cellar"];
  }
  if (jurisdiction) {
    return /\b(?:united states|u s|us|federal)\b/u.test(jurisdiction)
      ? /\b(?:act|statute|public law)\b/u.test(
          normalizePolicyIdentityText(workflow.currentShockInput),
        )
        ? ["govinfo_statute", "federal_register"]
        : ["federal_register"]
      : openStatesConfigured
        ? ["openstates"]
        : [];
  }
  const name = normalizePolicyIdentityText(workflow.currentShockInput);
  if (/\bact\s+of\s+(?:18|19|20)\d{2}$/u.test(name)) {
    // “Act of YYYY” is a common U.S. statute-title form. Federal Register is
    // not the native catalog for statutes, and trying it first can consume the
    // request wall clock before GovInfo/Congress resolution begins.
    return govInfoConfigured
      ? ["govinfo_statute",
        ...(openStatesConfigured ? ["openstates" as const] : [])]
      : openStatesConfigured ? ["openstates"] : [];
  }
  const terminalInstrumentYear = exactUkInstrumentTitleYear(
    workflow.currentShockInput,
  );
  const terminalYearWithoutOf = terminalInstrumentYear &&
    !new RegExp(`\\bof\\s+${terminalInstrumentYear}$`, "u").test(name);
  if (terminalYearWithoutOf) {
    // UK instruments conventionally use “Instrument Type YYYY” as the formal
    // title. Try that native catalog before broad U.S. sources so configured
    // Open States/GovInfo routes cannot exhaust the bounded budget first.
    // Other catalogs remain available when the UK route returns no match.
    return [
      "uk_legislation",
      ...(govInfoConfigured ? ["govinfo_statute" as const] : []),
      ...(openStatesConfigured ? ["openstates" as const] : []),
    ];
  }
  if (openStatesConfigured && /\bstate level\b/u.test(name)) {
    return ["openstates", ...(govInfoConfigured
      ? ["govinfo_statute" as const] : []), "federal_register"];
  }
  if (openStatesConfigured &&
      /\b(?:a|ab|acr|ajr|ar|h|hb|hcr|hjr|hr|s|sb|scr|sjr|sr|lb|ld)\s*\d+[a-z]?\b/u.test(name)) {
    return ["openstates"];
  }
  if (/\b(?:directive|european union|eu)\b/u.test(name)) {
    return ["eu_cellar"];
  }
  if (/\bact(?:\s+(?:18|19|20)\d{2})?$/u.test(name)) {
    return govInfoConfigured
      ? ["govinfo_statute",
        ...(openStatesConfigured ? ["openstates" as const] : []),
        "uk_legislation"]
      : [...(openStatesConfigured ? ["openstates" as const] : []),
        "uk_legislation"];
  }
  if (/\b(?:order|final rule|proposed rule|rule)\b/u.test(name)) {
    return ["federal_register"];
  }
  if (/\bregulation(?:s)?\b/u.test(name)) {
    return ["eu_cellar", "uk_legislation"];
  }
  // With no jurisdiction or instrument-family clue, make two bounded public
  // catalog attempts rather than silently treating the request as U.S.-federal.
  return govInfoConfigured
    ? ["federal_register", "govinfo_statute",
      ...(openStatesConfigured ? ["openstates" as const] : []),
      "uk_legislation"]
    : ["federal_register",
      ...(openStatesConfigured ? ["openstates" as const] : []),
      "uk_legislation"];
}

function proposalIdentityKey(proposal: IdentityBoundProposal) {
  const identifier = normalizePolicyIdentityText(
    proposal.nativeIdentity.formalIdentifier ?? "",
  );
  const locator = proposal.sources[0]?.locator ?? "";
  return [
    normalizePolicyIdentityText(
      proposal.nativeIdentity.issuingJurisdiction ??
        proposal.event.geographies[0] ?? "",
    ),
    identifier || locator,
    normalizePolicyIdentityText(proposal.nativeIdentity.status ?? ""),
  ].join("|");
}

function providerProposalScore(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
) {
  const scored = indexScore(workflow, proposal);
  const requestedStage = requestedStageHint(workflow);
  const rawReturnedStage = normalizePolicyIdentityText(
    proposal.nativeIdentity.status ?? proposal.event.eventFamily,
  );
  const returnedStage = rawReturnedStage === "rule"
    ? "final rule"
    : rawReturnedStage;
  const coverage = nameTermCoverage(workflow.currentShockInput, [
    proposal.title,
    ...titleAliases(proposal),
  ]);
  return {
    ...scored,
    score: scored.score + coverage * 40 +
      stageRankingAdjustment(requestedStage, returnedStage) +
      lifecycleRankingAdjustment({
        requestedStage,
        title: proposal.title,
        description: proposal.description,
        returnedStage,
      }),
  };
}

function candidateIdentityScore(
  workflow: SixScreenWorkflowState,
  candidate: IdentityCandidateInput,
) {
  let score = nameSimilarity(workflow.currentShockInput, [
    candidate.officialTitle,
    ...candidate.aliases,
  ]) * 100;
  score += nameTermCoverage(workflow.currentShockInput, [
    candidate.officialTitle,
    ...candidate.aliases,
  ]) * 40;
  const requestedStage = requestedStageHint(workflow);
  const returnedStage = normalizePolicyIdentityText(candidate.episode);
  score += stageRankingAdjustment(requestedStage, returnedStage);
  score += lifecycleRankingAdjustment({
    requestedStage,
    title: candidate.officialTitle,
    description: candidate.displayedDescription,
    returnedStage,
  });
  const supplied = new Set(workflow.officialSourceLocators.map(locatorIdentity));
  if (candidate.identitySources.some(({ locator }) =>
    supplied.has(locatorIdentity(locator))
  )) score += 120;
  const identifierText = normalizePolicyIdentityText([
    workflow.currentShockInput,
    workflow.officialIdentifier ?? "",
  ].join(" "));
  if (candidate.formalIdentifiers.some((identifier) =>
    identifierText.includes(normalizePolicyIdentityText(identifier))
  )) score += 80;
  if (workflow.requestedJurisdiction) {
    score += jurisdictionMatches(
        workflow.requestedJurisdiction,
        candidate.issuingJurisdiction,
      )
      ? 15
      : -35;
  }
  score -= candidate.materialMismatches.length * 100;
  return score;
}

function exactCandidateNameMatch(
  workflow: SixScreenWorkflowState,
  candidate: IdentityCandidateInput,
) {
  const query = normalizePolicyIdentityText(workflow.currentShockInput);
  return Boolean(query) && [candidate.officialTitle, ...candidate.aliases]
    .some((name) => normalizePolicyIdentityText(name) === query);
}

function strongCandidateEntityMatch(
  workflow: SixScreenWorkflowState,
  candidate: IdentityCandidateInput,
) {
  if (exactCandidateNameMatch(workflow, candidate)) return true;
  const query = normalizePolicyIdentityText(workflow.currentShockInput);
  const queryTerms = significantWords(query);
  if (!query || query.length < 6 || !queryTerms.length) return false;
  const names = [candidate.officialTitle, ...candidate.aliases];
  return nameSimilarity(query, names) >= 0.9 &&
    nameTermCoverage(query, names) >= 0.9;
}

function sameCandidateIdentity(
  left: IdentityCandidateInput,
  right: IdentityCandidateInput,
) {
  if (
    normalizePolicyIdentityText(left.issuingJurisdiction) !==
      normalizePolicyIdentityText(right.issuingJurisdiction)
  ) return false;
  const leftIdentifiers = new Set(left.formalIdentifiers.map(
    normalizePolicyIdentityText,
  ).filter(Boolean));
  const rightIdentifiers = new Set(right.formalIdentifiers.map(
    normalizePolicyIdentityText,
  ).filter(Boolean));
  if ([...leftIdentifiers].some((value) => rightIdentifiers.has(value))) {
    return true;
  }
  if (leftIdentifiers.size || rightIdentifiers.size) return false;
  const leftSources = new Set(left.identitySources.map(({ nativeId, locator }) =>
    normalizePolicyIdentityText(nativeId ?? locatorIdentity(locator))
  ).filter(Boolean));
  const rightSources = new Set(right.identitySources.map(({ nativeId, locator }) =>
    normalizePolicyIdentityText(nativeId ?? locatorIdentity(locator))
  ).filter(Boolean));
  if ([...leftSources].some((value) => rightSources.has(value))) return true;
  if (leftSources.size || rightSources.size) return false;
  return normalizePolicyIdentityText(left.officialTitle) ===
      normalizePolicyIdentityText(right.officialTitle) &&
    normalizePolicyIdentityText(left.episode) ===
      normalizePolicyIdentityText(right.episode);
}

function proposalDescription(
  proposal: IdentityBoundProposal,
  retainedText: string,
) {
  const titleTerms = new Set(significantWords(proposal.title));
  const sentences = retainedText.split(/(?<=[.!?])\s+/u)
    .map((value) => value.trim()).filter((value) => value.length >= 20);
  const ranked = sentences.map((sentence, index) => {
    const normalizedSentence = normalizePolicyIdentityText(sentence);
    const identity = [...titleTerms].filter((term) =>
      normalizedSentence.includes(term)
    ).length;
    const substance = /\b(?:amend(?:s|ed)?|appl(?:y|ies)|commence(?:s|d)?|effective|enact(?:s|ed)?|establish(?:es|ed)?|provide(?:s|d)?|require(?:s|d)?)\b/iu.test(
      sentence,
    ) ? 4 : 0;
    return { sentence, index, score: identity * 2 + substance };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = ranked.filter(({ score }) => score > 0).slice(0, 4)
    .sort((left, right) => left.index - right.index)
    .map(({ sentence }) => sentence);
  const sourceText = selected.length ? selected.join(" ") :
    sentences.slice(0, 3).join(" ");
  return (sourceText || proposal.description).split(/\s+/u).slice(0, 120)
    .join(" ").slice(0, 1_500);
}

function dynamicTypedDates(proposal: IdentityBoundProposal): TypedDate[] {
  return proposal.event.eventDate
    ? [{
        start: proposal.event.eventDate,
        end: null,
        precision: "day",
        kind: "publication",
        passageIds: [],
      }]
    : [];
}

async function readyOfficialCatalogCandidate(input: {
  workflow: SixScreenWorkflowState;
  proposal: IdentityBoundProposal;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  maximumAttempts: number;
}) {
  const acquired = await acquireScreen01OfficialPolicyDocument({
    proposal: input.proposal,
    fetch: input.fetch,
    retrievedAt: input.retrievedAt,
    maximumAttempts: input.maximumAttempts,
  });
  if (!acquired.source?.retainedText) {
    return { ...acquired, candidate: null };
  }
  const sourceSnapshot = [acquired.source];
  const aliases = titleAliases(input.proposal);
  const jurisdiction = input.proposal.nativeIdentity.issuingJurisdiction ??
    input.proposal.event.geographies[0] ?? "Jurisdiction not established";
  const stage = input.proposal.nativeIdentity.status ??
    "published official instrument";
  const typedDates = dynamicTypedDates(input.proposal);
  const materialMismatches = [
    ...(!jurisdictionMatches(input.workflow.requestedJurisdiction, jurisdiction)
      ? [`Requested jurisdiction “${input.workflow.requestedJurisdiction}” differs from “${jurisdiction}”.`]
      : []),
    ...(input.workflow.approximateYear &&
        !typedDates.some(({ start }) => start?.startsWith(input.workflow.approximateYear!))
      ? [`The requested approximate year “${input.workflow.approximateYear}” differs from the displayed source date; the year was treated as a clue, not a hard filter.`]
      : []),
  ];
  const sourceSnapshotFingerprint = fingerprintSixScreenValue(sourceSnapshot);
  const candidate: IdentityCandidateInput = {
    id: `identity-${input.proposal.id}`.slice(0, 200),
    officialTitle: stageNeutralTitle(input.proposal.title).trim(),
    aliases: aliases.filter((value) =>
      normalizePolicyIdentityText(value) !==
        normalizePolicyIdentityText(input.proposal.title)
    ),
    issuer: (input.proposal.nativeIdentity.issuer ?? acquired.source.publisher)
      .trim(),
    issuingJurisdiction: jurisdiction.trim(),
    instrumentType: sourceFamily(input.proposal.sources[0]!, input.proposal)
      .trim(),
    formalIdentifiers: formalIdentifiers(input.proposal),
    episode: stage.trim(),
    versionScope: typedDates.length
      ? `published official instrument dated ${typedDates[0]!.start}`
      : "published official instrument; operative version requires review",
    typedDates,
    identitySourceIds: sourceSnapshot.map(({ id }) => id),
    sourceSnapshotId: `identity-source-${input.proposal.id}`.slice(0, 200),
    sourceSnapshotFingerprint,
    identitySources: sourceSnapshot,
    displayedDescription: proposalDescription(
      input.proposal,
      acquired.source.retainedText,
    ),
    matchExplanation:
      "A bounded official catalog title search returned this native record, and its permitted official text substantiated the title or formal identifier. Ranking used identity fields only—not study outcomes, industry, proposed groups, or causal suitability.",
    materialMismatches,
    retrievedAt: input.retrievedAt,
  };
  return { ...acquired, candidate };
}

function requestedStage(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
) {
  const requested = normalizePolicyIdentityText(workflow.intendedEpisode ?? "");
  const details = Object.values(
    PUBLIC_SCREEN02_EVENT_DATE_DETAILS[proposal.id] ?? {},
  );
  const roles = new Set(details.map(({ role }) => role));
  if (/implementation|start of requirements|effective|operative/u.test(requested)) {
    if (roles.has("implementation") || roles.has("effective")) {
      return "start of requirements";
    }
  }
  if (/adoption|final rule|enact/u.test(requested)) {
    if (roles.has("adoption") || roles.has("enactment")) return "adoption or enactment";
  }
  if (/enforcement/u.test(requested) && roles.has("enforcement")) return "enforcement";
  if (/proposal|announcement/u.test(requested) && roles.has("announcement")) {
    return "proposal or announcement";
  }
  return proposal.nativeIdentity.status ?? "documented policy stage";
}

function stageMaterialMismatch(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
) {
  const requested = normalizePolicyIdentityText(workflow.intendedEpisode ?? "");
  if (!requested || requested === "not sure yet") return null;
  const resolved = normalizePolicyIdentityText(requestedStage(workflow, proposal));
  const compatible = requested.split(" ").some((word) =>
    word.length > 4 && resolved.includes(word)
  ) ||
    (/implementation|start of requirements|effective|operative/u.test(requested) &&
      resolved === "start of requirements") ||
    (/adoption|final rule|enact/u.test(requested) &&
      resolved === "adoption or enactment");
  return compatible
    ? null
    : `Requested stage “${workflow.intendedEpisode}” is not established by this retained identity record; choose a different stage or inspect the available dates before confirmation.`;
}

function indexSource(
  source: Screen02Source,
  proposal: IdentityBoundProposal,
): IdentitySource {
  const retainedText = (source.evidenceText ?? "").replace(/\s+/gu, " ").trim()
    .slice(0, MAX_RETAINED_IDENTITY_TEXT);
  const retrievedAt = source.retrievedAt
    ? /^\d{4}-\d{2}-\d{2}$/u.test(source.retrievedAt)
      ? `${source.retrievedAt}T00:00:00.000Z`
      : source.retrievedAt
    : `${proposal.event.eventDate}T00:00:00.000Z`;
  return {
    id: source.id,
    title: source.title,
    locator: source.locator,
    publisher: source.publisher,
    publishedDate: source.publishedDate,
    authorityTier: `tier-${source.authorityTier}`,
    retrievedAt,
    provider: source.publisher,
    nativeId: proposal.nativeIdentity.formalIdentifier,
    routeId: "reviewed_official_document",
    routeVersion: SCREEN02_PUBLIC_EVENT_INDEX_VERSION,
    accessStatus: "retained_passage",
    inspectedText: "partial",
    contentHash: fingerprintSixScreenValue({
      sourceId: source.id,
      retainedText,
      retrievedAt,
    }),
    retainedText,
    limitation:
      "This bounded retained text supports identity and an initial Screen 2 briefing; complete provisions and historical versions still require review.",
  };
}

function indexCandidate(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
  retrievedAt: string,
  maxDocuments: number,
): IdentityCandidateInput | null {
  const relationship = new Set(proposal.relationshipEvidenceSourceIds ?? []);
  const suppliedLocators = new Set(workflow.officialSourceLocators.map(
    (value) => {
      try {
        return new URL(value).toString();
      } catch {
        return value;
      }
    },
  ));
  const primarySources = proposal.sources.filter((source) =>
    !relationship.has(source.id) && source.authorityTier <= 2 &&
    Boolean(source.evidenceText?.trim())
  ).sort((left, right) =>
    Number(suppliedLocators.has(right.locator)) -
    Number(suppliedLocators.has(left.locator))
  // Keep the best two reviewed sources when available: one can carry the
  // readable retained passage while another establishes the instrument
  // family/native statute identity. Two still leave half of the four-document
  // budget available for a native-provider version check.
  ).slice(0, Math.max(1, Math.min(2, maxDocuments)));
  if (!primarySources.length) return null;
  const sourceSnapshot = primarySources.map((source) =>
    indexSource(source, proposal)
  );
  const dates = Object.values(
    PUBLIC_SCREEN02_EVENT_DATE_DETAILS[proposal.id] ?? {},
  ).slice(0, 8).map((detail): TypedDate => ({
    start: detail.date,
    end: null,
    precision: "day",
    kind: typedDateKind(detail.role),
    label: detail.label,
    passageIds: [],
  }));
  const aliases = titleAliases(proposal);
  const jurisdiction = proposal.nativeIdentity.issuingJurisdiction ??
    proposal.event.geographies.find((value) => value !== "United States") ??
    proposal.event.geographies[0] ?? "Jurisdiction not established";
  const stageMismatch = stageMaterialMismatch(workflow, proposal);
  const yearMismatch = workflow.approximateYear && dates.length &&
      !dates.some(({ start }) => start?.startsWith(workflow.approximateYear!))
    ? `The requested approximate year “${workflow.approximateYear}” differs from the displayed source-bound dates; the year was treated as a clue, not a hard filter.`
    : null;
  const materialMismatches = [
    ...(!jurisdictionMatches(workflow.requestedJurisdiction, jurisdiction)
      ? [`Requested jurisdiction “${workflow.requestedJurisdiction}” differs from “${jurisdiction}”.`]
      : []),
    ...(stageMismatch ? [stageMismatch] : []),
    ...(yearMismatch ? [yearMismatch] : []),
  ];
  const versionScope = dates.length
    ? dates.map((date) =>
        `${date.kind.replaceAll("_", " ")} ${date.start ?? "date unresolved"}`
      ).join("; ")
    : `${proposal.nativeIdentity.status ?? "stage unresolved"}; historical version remains to be reviewed`;
  const sourceSnapshotFingerprint = fingerprintSixScreenValue(sourceSnapshot);
  const instrumentSource = primarySources.find((source) =>
    /legislation|session-law|enacted-bill|bill-record|rulemaking|regulation|enforcement|order|ruling|consent/iu.test(
      source.channel,
    )
  ) ?? primarySources[0]!;
  const federalRegisterOfficialTitle = primarySources.find((source) =>
    source.channel === "official-final-rule" &&
    /^https:\/\/(?:www\.)?federalregister\.gov\//iu.test(source.locator) &&
    source.title.trim()
  )?.title.trim();
  const officialTitle = federalRegisterOfficialTitle ??
    stageNeutralTitle(proposal.title);
  const displayedDescription = [
    proposal.description,
    ...primarySources.map(({ evidenceText }) => evidenceText ?? ""),
  ].map((value) => value.replace(/\s+/gu, " ").trim()).filter(
    (value, index, values) => value && values.indexOf(value) === index,
  ).join(" ").split(/\s+/u).slice(0, 120).join(" ");
  return {
    id: `identity-${proposal.id}`.slice(0, 200),
    officialTitle,
    aliases: aliases.filter((value) =>
      normalizePolicyIdentityText(value) !==
        normalizePolicyIdentityText(officialTitle)
    ),
    issuer: proposal.nativeIdentity.issuer ?? primarySources[0]!.publisher,
    issuingJurisdiction: jurisdiction,
    instrumentType: sourceFamily(instrumentSource, proposal),
    formalIdentifiers: formalIdentifiers(proposal),
    episode: requestedStage(workflow, proposal),
    versionScope,
    typedDates: dates,
    identitySourceIds: sourceSnapshot.map(({ id }) => id),
    sourceSnapshotId: `identity-source-${proposal.id}`.slice(0, 200),
    sourceSnapshotFingerprint,
    identitySources: sourceSnapshot,
    displayedDescription,
    matchExplanation:
      `The entered name matched this reviewed official record${aliases.length ? `, including ${aliases.join(", ")}` : ""}. Jurisdiction, source-derived identifier, stage, and dates were used only to distinguish identities; study outcomes and proposed groups were not used for ranking.`,
    materialMismatches,
    retrievedAt,
  };
}

function indexScore(
  workflow: SixScreenWorkflowState,
  proposal: IdentityBoundProposal,
) {
  const aliases = [proposal.title, ...titleAliases(proposal)];
  const similarity = nameSimilarity(workflow.currentShockInput, aliases);
  const termCoverage = nameTermCoverage(workflow.currentShockInput, aliases);
  const supplied = new Set(workflow.officialSourceLocators.map((value) => {
    try {
      return new URL(value).toString();
    } catch {
      return value;
    }
  }));
  const exactLocator = proposal.sources.some((source) => supplied.has(source.locator));
  const identifier = proposal.nativeIdentity.formalIdentifier;
  const identifierQuery = [
    workflow.currentShockInput,
    workflow.officialIdentifier ?? "",
  ].join(" ");
  const identifierMatch = identifier
    ? normalizePolicyIdentityText(identifierQuery).includes(
        normalizePolicyIdentityText(identifier),
      )
    : false;
  let score = Math.max(similarity * 100, termCoverage * 85);
  if (exactLocator) score += 120;
  if (identifierMatch) score += 80;
  if (workflow.requestedJurisdiction) {
    score += jurisdictionMatches(
        workflow.requestedJurisdiction,
        proposal.nativeIdentity.issuingJurisdiction,
      )
      ? 15
      : -35;
  }
  if (workflow.approximateYear) {
    const difference = Math.abs(
      Number(workflow.approximateYear) - Number(proposal.event.eventDate.slice(0, 4)),
    );
    if (Number.isFinite(difference)) score += difference === 0 ? 8 : difference <= 2 ? 4 : 0;
  }
  return { score, similarity, termCoverage, exactLocator, identifierMatch };
}

function statusEpisode(proposal: IdentityBoundProposal) {
  const status = proposal.nativeIdentity.status?.toLocaleLowerCase("en-US") ?? "";
  if (status.includes("proposed")) return "proposal or announcement";
  if (status.includes("final") || status === "rule") return "adoption or final rule";
  if (status.includes("notice")) return "notice or information event";
  return status || "published Federal Register episode";
}

function federalDates(proposal: IdentityBoundProposal) {
  const publication = proposal.provisionalDates.find((value) =>
    value.startsWith("Publication date: ")
  )?.slice("Publication date: ".length) ?? proposal.event.eventDate;
  const effective = proposal.provisionalDates.find((value) =>
    value.startsWith("Reported effective date: ")
  )?.slice("Reported effective date: ".length);
  return [
    ...(publication
      ? [{ start: publication, end: null, precision: "day" as const,
          kind: "publication" as const, passageIds: [] }]
      : []),
    ...(effective
      ? [{ start: effective, end: null, precision: "day" as const,
          kind: "legal_effect" as const, passageIds: [] }]
      : []),
  ];
}

async function readyFederalCandidate(input: {
  workflow: SixScreenWorkflowState;
  proposal: IdentityBoundProposal;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
}) {
  const documentNumber = federalRegisterDocumentNumberFromProposal(
    input.proposal,
  );
  if (!documentNumber) return { candidate: null, attempts: 0, hops: 0,
    receivedBytes: 0, decodedBytes: 0 };
  const episode = statusEpisode(input.proposal);
  const materialMismatches = [
    ...(!jurisdictionMatches(
        input.workflow.requestedJurisdiction,
        input.proposal.nativeIdentity.issuingJurisdiction ?? "United States",
      )
      ? [`Requested jurisdiction “${input.workflow.requestedJurisdiction}” differs from “United States”.`]
      : []),
    ...(input.workflow.intendedEpisode &&
        !normalizePolicyIdentityText(episode).includes(
          normalizePolicyIdentityText(input.workflow.intendedEpisode),
        )
      ? [`Requested stage “${input.workflow.intendedEpisode}” differs from the provider stage “${episode}”.`]
      : []),
  ];
  const relatedLocators = (excludedLocator: string): IdentitySource[] =>
    input.proposal.sources
      .filter(({ locator }) => locator !== excludedLocator)
      .slice(0, 3)
      .map((source) => ({
        id: `${source.id}-identity-metadata`.slice(0, 200),
        title: source.title,
        locator: source.locator,
        publisher: source.publisher,
        publishedDate: source.publishedDate,
        authorityTier: `tier-${source.authorityTier}`,
        retrievedAt: input.retrievedAt,
        provider: source.publisher,
        nativeId: documentNumber,
        routeId: "federal_register_related_locator",
        routeVersion: "six-screen-federal-register-policy-v4",
        accessStatus: "available_metadata",
        inspectedText: "metadata_only",
        contentHash: null,
        retainedText: null,
        limitation:
          "This related official locator is retained for document identity and later representation checks; it did not establish continuation readiness by itself.",
      }));
  const candidateFromSources = (candidateInput: {
    sourceSnapshot: IdentitySource[];
    versionScope: string;
    matchExplanation: string;
  }) => ({
    id: `identity-${input.proposal.id}`.slice(0, 200),
    officialTitle: input.proposal.title.trim(),
    aliases: titleAliases(input.proposal),
    issuer: (input.proposal.nativeIdentity.issuer ??
      "Issuer not returned in official metadata").trim(),
    issuingJurisdiction: (
      input.proposal.nativeIdentity.issuingJurisdiction ?? "United States"
    ).trim(),
    instrumentType: (
      input.proposal.nativeIdentity.status ??
        "federal administrative publication"
    ).trim(),
    formalIdentifiers: [documentNumber],
    episode,
    versionScope: candidateInput.versionScope,
    typedDates: federalDates(input.proposal),
    identitySourceIds: candidateInput.sourceSnapshot.map(({ id }) => id),
    sourceSnapshotId: `identity-source-${input.proposal.id}`.slice(0, 200),
    sourceSnapshotFingerprint: fingerprintSixScreenValue(
      candidateInput.sourceSnapshot,
    ),
    identitySources: candidateInput.sourceSnapshot,
    displayedDescription: (
      input.proposal.sources.some((source) => source.evidenceText)
        ? input.proposal.description
        : `${input.proposal.title} is identified by exact Federal Register document ${documentNumber}. Operative details remain for Screen 2 review.`
    ).replace(/\s+/gu, " ").trim().slice(0, 1_200),
    matchExplanation: candidateInput.matchExplanation,
    materialMismatches,
    retrievedAt: input.retrievedAt,
  } satisfies IdentityCandidateInput);
  const metadataEvidence = [...new Set(input.proposal.sources
    .map(({ evidenceText }) =>
      (evidenceText ?? "").replace(/\s+/gu, " ").trim()
    )
    .filter((value) => value.includes(documentNumber)))]
    .sort((left, right) => right.length - left.length)
    .find((value) => {
      const beyondIdentity = value
        .replace(input.proposal.title, " ")
        .replace(documentNumber, " ");
      return significantWords(beyondIdentity).length >= 12;
    });
  const metadataSource: IdentitySource | null = metadataEvidence
    ? (() => {
        const retainedText = metadataEvidence.slice(
          0,
          MAX_RETAINED_IDENTITY_TEXT,
        );
        return {
          id: `fr-${documentNumber}-api-evidence`,
          title: `${input.proposal.title} — Federal Register API record`,
          locator:
            `https://www.federalregister.gov/api/v1/documents/${documentNumber}.json`,
          publisher: "Federal Register",
          publishedDate: input.proposal.event.eventDate,
          authorityTier: "tier-2",
          retrievedAt: input.retrievedAt,
          provider: "Federal Register API",
          nativeId: documentNumber,
          routeId: "federal_register_api_excerpt",
          routeVersion: "six-screen-federal-register-policy-v4",
          accessStatus: "retained_passage",
          inspectedText: "abstract",
          contentHash: fingerprintSixScreenValue({
            documentNumber,
            retainedText,
            retrievedAt: input.retrievedAt,
          }),
          retainedText,
          limitation:
            "The official API's bounded abstract or search excerpt supports identity and a fail-closed initial briefing. Complete provisions and operative details remain separate exact-document questions.",
        };
      })()
    : null;
  const representations = federalRegisterExactDocumentRepresentations(
    input.proposal.sources.map(({ locator }) => locator),
    documentNumber,
  );
  if (exactFederalRegisterDocumentNumber(input.workflow) === null) {
    representations.sort((left, right) =>
      Number(right.representation === "text") -
        Number(left.representation === "text")
    );
  }
  let attempts = 0;
  let hops = 0;
  let receivedBytes = 0;
  let decodedBytes = 0;
  for (const representation of representations.slice(0, 2)) {
    attempts += 1;
    const checked = await fetchRepresentation({
      fetch: input.fetch,
      representation,
      documentNumber,
      timeoutMs: 10_000,
    });
    hops += checked.transportHops;
    receivedBytes += checked.receivedBytes;
    decodedBytes += checked.decodedBytes;
    if (!checked.ok) continue;
    const checkedSource: IdentitySource = {
      id: `fr-${documentNumber}-${checked.representation}`,
      title: input.proposal.title,
      locator: checked.canonicalUrl,
      publisher: "Federal Register",
      publishedDate: input.proposal.event.eventDate,
      authorityTier: "tier-1",
      retrievedAt: input.retrievedAt,
      provider: "federal-register",
      nativeId: documentNumber,
      routeId: "exact_federal_register_document",
      routeVersion: "six-screen-federal-register-policy-v4",
      accessStatus: "retained_passage",
      inspectedText: "partial",
      contentHash: checked.contentHash,
      retainedText: checked.parsedText.slice(0, MAX_RETAINED_IDENTITY_TEXT),
      limitation:
        "A bounded exact-record representation was checked for continuation. Screen 2 still owns substantive reconstruction.",
    };
    if (metadataSource?.retainedText) {
      decodedBytes += new TextEncoder().encode(
        metadataSource.retainedText,
      ).byteLength;
    }
    const sourceSnapshot = [
      checkedSource,
      ...(metadataSource ? [metadataSource] : []),
      ...relatedLocators(checked.canonicalUrl),
    ];
    return {
      candidate: candidateFromSources({
        sourceSnapshot,
        versionScope:
          `${episode}; exact published representation checked ${input.retrievedAt}`,
        matchExplanation:
          `Official Federal Register metadata and an exact ${documentNumber} representation support this identity. Ranking used name, issuer, identifier, jurisdiction, stage, and dates—not outcome or causal suitability.`,
      }),
      attempts,
      hops,
      receivedBytes,
      decodedBytes,
    };
  }
  if (metadataSource?.retainedText) {
    decodedBytes += new TextEncoder().encode(
      metadataSource.retainedText,
    ).byteLength;
    const sourceSnapshot = [
      metadataSource,
      ...relatedLocators(metadataSource.locator),
    ];
    return {
      candidate: candidateFromSources({
        sourceSnapshot,
        versionScope:
          `${episode}; bounded official API abstract or search excerpt retained ${input.retrievedAt}; controlling published representation remains to be reviewed`,
        matchExplanation:
          `Official Federal Register API metadata and a retained abstract or search excerpt support document ${documentNumber}. Exact published representations were unavailable during matching. Ranking used name, issuer, identifier, jurisdiction, stage, and dates—not outcome or causal suitability.`,
      }),
      attempts,
      hops,
      receivedBytes,
      decodedBytes,
    };
  }
  return { candidate: null, attempts, hops, receivedBytes, decodedBytes };
}

function suppliedLocatorConflict(
  workflow: SixScreenWorkflowState,
  ranked: Array<{
    proposal: IdentityBoundProposal;
    score: number;
    similarity: number;
    exactLocator: boolean;
  }>,
) {
  if (!workflow.officialSourceLocators.length) return null;
  const locatorCandidate = ranked.find(({ exactLocator }) => exactLocator);
  if (!locatorCandidate) return null;
  const nameCandidate = ranked.find(({ similarity }) => similarity >= 0.72);
  if (
    nameCandidate && locatorCandidate.proposal.id !== nameCandidate.proposal.id
  ) {
    return `The supplied official locator identifies “${locatorCandidate.proposal.title}”, while the entered name most closely identifies “${nameCandidate.proposal.title}”. Resolve this conflict before confirmation; neither value was overwritten.`;
  }
  return null;
}

export async function resolveScreen01Identity(input: {
  workflow: SixScreenWorkflowState;
  fetch: Screen02ConnectorFetch;
  publicWebFetch?: Screen02ConnectorFetch;
  retrievedAt: string;
  monotonicNow?: () => number;
  govInfoApiKey?: string;
  congressApiKey?: string;
  openStatesApiKey?: string;
}): Promise<Screen01IdentityResolutionResult> {
  const started = input.monotonicNow?.() ?? 0;
  const measured = usage();
  const attemptedSources: string[] = [];
  const sourceFailures: string[] = [];
  let websiteLimitation: string | null = null;
  let indexLeads = SCREEN01_IDENTITY_PROPOSAL_REGISTRY
    .filter((proposal): proposal is IdentityBoundProposal =>
      proposal.mode === "find" && proposal.nativeIdentity !== undefined
    )
    .map((proposal) => ({ proposal, ...indexScore(input.workflow, proposal) }))
    .filter(({ score, similarity, termCoverage, exactLocator, identifierMatch }) =>
      exactLocator || identifierMatch ||
      ((similarity >= 0.72 || termCoverage >= 0.75) && score >= 55)
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_METADATA_LEADS);
  measured.metadataRecords += indexLeads.length;
  measured.sourceQueries += 1;
  attemptedSources.push("Reviewed official-document registry and public index");
  const conflict = suppliedLocatorConflict(input.workflow, indexLeads);
  if (conflict) {
    measured.activeResearchMs = Math.max(
      0,
      Math.round((input.monotonicNow?.() ?? started) - started),
    );
    return {
      protocolVersion: SCREEN_01_IDENTITY_RESOLUTION_PROTOCOL_VERSION,
      status: "not_resolved",
      candidates: [],
      attemptedSources,
      unresolved: ["conflicting policy name and official locator"],
      limitation: conflict,
      usage: measured,
      outcomeValuesInspected: false,
    };
  }
  const websiteLocator = input.workflow.officialSourceLocators.find((locator) =>
    !supportedLocatorRoute(locator) &&
    !indexLeads.some(({ exactLocator }) => exactLocator));
  let website: Screen01WebpageInspection | null = null;
  if (websiteLocator) {
    website = await inspectPublicIdentityWebpage({
      url: websiteLocator,
      name: input.workflow.currentShockInput,
      fetch: input.publicWebFetch ?? input.fetch,
    });
    attemptedSources.push("Researcher-supplied public webpage");
    measured.sourceQueries += website.hops;
    measured.documentAttempts += website.hops;
    measured.transportHops += website.hops;
    measured.receivedBytes += website.receivedBytes;
    measured.decodedBytes += website.receivedBytes;
    if (website.status !== "lead") websiteLimitation = website.reason;
    const cueMatches = website.status === "lead"
      ? website.cues.flatMap((cue) =>
      SCREEN01_IDENTITY_PROPOSAL_REGISTRY
        .filter((proposal): proposal is IdentityBoundProposal =>
          proposal.mode === "find" && proposal.nativeIdentity !== undefined)
        .map((proposal) => ({ proposal, ...indexScore({
          ...input.workflow, currentShockInput: cue,
          officialSourceLocators: [],
        }, proposal) }))
        .filter(({ similarity, termCoverage, score }) =>
          (similarity >= 0.82 || termCoverage >= 0.9) && score >= 75))
      : [];
    indexLeads = [...indexLeads, ...cueMatches]
      .filter((item, index, values) => values.findIndex((other) =>
        other.proposal.id === item.proposal.id) === index)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_METADATA_LEADS);
    measured.metadataRecords += cueMatches.length;
  }
  const exactFederalIdentifier = exactFederalRegisterDocumentNumber(input.workflow);
  const exactEuIdentifier = exactEuCelexIdentifier(input.workflow);
  const suppliedRoutes = input.workflow.officialSourceLocators.map(
    supportedLocatorRoute,
  );
  const requiresExactLocatorBinding = suppliedRoutes.some((route) =>
    route !== null);
  const providerQueryVariants = policySearchQueryVariants({
    name: input.workflow.currentShockInput,
    aliases: website?.status === "lead" ? website.cues : [],
    identifiers: input.workflow.officialIdentifier
      ? [input.workflow.officialIdentifier] : [],
    urls: input.workflow.officialSourceLocators,
    maximum: 6,
  });
  const indexedCandidates: IdentityCandidateInput[] = [];
  for (const { proposal } of indexLeads) {
    if (indexedCandidates.length >= MAX_VISIBLE_CANDIDATES) break;
    const remainingDocuments = 4 - measured.usefulDocuments;
    if (remainingDocuments <= 0) break;
    const candidate = indexCandidate(
      input.workflow,
      proposal,
      input.retrievedAt,
      remainingDocuments,
    );
    if (!candidate) continue;
    indexedCandidates.push(candidate);
    measured.usefulDocuments += candidate.identitySources.length;
  }
  if (website?.status === "lead" && indexedCandidates.length) {
    for (const candidate of indexedCandidates) {
      candidate.matchExplanation +=
        " The supplied webpage identified a title or alias also found in the reviewed index. Its context was not treated as controlling legal evidence.";
    }
  }
  // An exact provider identifier should still traverse its native catalog so
  // the saved version/representation evidence is not replaced by a catalog
  // cache hit, even when the name itself has complete term coverage.
  const strongReadyIndexCandidate = exactFederalIdentifier === null &&
    exactEuIdentifier === null && indexedCandidates.length > 0 &&
    ((indexLeads[0]?.similarity ?? 0) >= 0.88 ||
      (indexLeads[0]?.termCoverage ?? 0) >= 1) &&
    !indexedCandidates[0]!.materialMismatches.length;
  const strongReadyIndexProposal = strongReadyIndexCandidate
    ? indexLeads.find(({ proposal }) =>
        `identity-${proposal.id}`.slice(0, 200) === indexedCandidates[0]!.id
      )?.proposal ?? null
    : null;
  const cachedFederalDocumentNumber = strongReadyIndexProposal
    ? federalRegisterDocumentNumberFromProposal(strongReadyIndexProposal)
    : null;
  const routes = identityRoutePlan(
    input.workflow,
    strongReadyIndexProposal,
    Boolean(input.govInfoApiKey?.trim()),
    Boolean(input.openStatesApiKey?.trim()),
  );
  const candidateValidationLimit =
    indexedCandidates.length > 0 || routes.length > 1
      ? MAX_VALIDATED_CANDIDATES
      : routes[0] === "federal_register" && requestedStageHint(input.workflow)
        ? 2
        : MAX_VISIBLE_CANDIDATES;
  const dynamicCandidates: IdentityCandidateInput[] = [];
  const seenProviderIdentities = new Set<string>();
  let suppliedDynamicLocatorMatched = false;
  routeLoop: for (const route of routes) {
    if (
      measured.sourceQueries >= 8 ||
      measured.metadataRecords >= MAX_METADATA_LEADS ||
      measured.documentAttempts >= 8 ||
      measured.usefulDocuments >= 4 ||
      indexedCandidates.length + dynamicCandidates.length >=
        candidateValidationLimit
    ) break;
    const window = defaultIdentityWindow(
      input.workflow,
      route,
      input.retrievedAt,
    );
    const remainingLeads = Math.min(
      10,
      MAX_METADATA_LEADS - measured.metadataRecords,
    );
    attemptedSources.push(route === "federal_register"
      ? "Federal Register"
      : route === "govinfo_statute"
        ? "GovInfo public-law search"
      : route === "openstates"
        ? "Open States"
      : route === "eu_cellar"
        ? "EU Publications Office CELLAR"
        : "UK legislation.gov.uk");
    if (route === "govinfo_statute") {
      const result = await discoverGovInfoPublicLaws({
        workflow: input.workflow,
        fetch: input.fetch,
        retrievedAt: input.retrievedAt,
        queryVariants: providerQueryVariants,
        ...(input.govInfoApiKey !== undefined
          ? { apiKey: input.govInfoApiKey }
          : {}),
        ...(input.congressApiKey !== undefined
          ? { congressApiKey: input.congressApiKey }
          : {}),
      });
      measured.sourceQueries += result.usage.sourceQueries;
      measured.metadataRecords += result.usage.metadataRecords;
      measured.documentAttempts += result.usage.documentAttempts;
      measured.usefulDocuments += result.usage.usefulDocuments;
      measured.transportHops += result.usage.transportHops;
      measured.receivedBytes += result.usage.receivedBytes;
      measured.decodedBytes += result.usage.decodedBytes;
      attemptedSources.push(...result.attemptedSources);
      for (const candidate of result.candidates) {
        if (indexedCandidates.length + dynamicCandidates.length >=
            candidateValidationLimit) break;
        dynamicCandidates.push(candidate);
        suppliedDynamicLocatorMatched ||= candidate.identitySources.some(
          ({ locator, nativeId }) => input.workflow.officialSourceLocators.some(
            (supplied) => locatorIdentity(supplied) === locatorIdentity(locator) ||
              (nativeId && govInfoPublicLawPackageFromLocator(supplied) ===
                nativeId),
          ),
        );
      }
      if (result.status === "source_unavailable" ||
          result.status === "not_configured") {
        sourceFailures.push(result.limitation ??
          "GovInfo public-law discovery was unavailable; this is not an empty search result.");
      }
      if (dynamicCandidates.some((candidate) =>
        strongCandidateEntityMatch(input.workflow, candidate))) {
        break routeLoop;
      }
      continue;
    }
    if (route === "openstates") {
      const remainingCandidateCapacity = Math.max(
        1,
        candidateValidationLimit - indexedCandidates.length -
          dynamicCandidates.length,
      );
      const result = await searchOpenStatesBills({
        fetch: input.fetch,
        apiKey: input.openStatesApiKey,
        query: input.workflow.currentShockInput,
        queryVariants: providerQueryVariants,
        jurisdiction: usStateForScreen02Geography(
          input.workflow.requestedJurisdiction ?? "",
        )?.name ?? usStateMentionForScreen02Text(
          input.workflow.currentShockInput,
        )?.name ?? input.workflow.requestedJurisdiction,
        approximateYear: input.workflow.approximateYear,
        retrievedAt: input.retrievedAt,
        limit: Math.min(remainingLeads, remainingCandidateCapacity),
        monotonicNow: input.monotonicNow,
      });
      measured.sourceQueries += result.usage.sourceQueries;
      measured.metadataRecords += result.usage.metadataRecords;
      measured.documentAttempts += result.usage.documentAttempts;
      measured.usefulDocuments += result.usage.usefulDocuments;
      measured.transportHops += result.usage.transportHops;
      measured.receivedBytes += result.usage.receivedBytes;
      measured.decodedBytes += result.usage.decodedBytes;
      measured.activeResearchMs += result.usage.activeResearchMs;
      measured.cpuMs += result.usage.cpuMs;
      for (const [provider, units] of Object.entries(
        result.usage.providerCostUnits,
      )) {
        measured.providerCostUnits[provider] =
          (measured.providerCostUnits[provider] ?? 0) + units;
      }
      for (const [candidateIndex, providerCandidate] of
        result.candidates.entries()) {
        if (indexedCandidates.length + dynamicCandidates.length >=
            candidateValidationLimit) break;
        let candidate = providerCandidate;
        if (candidateIndex === 0 && input.publicWebFetch &&
            measured.documentAttempts < 8) {
          const verified = await verifyOpenStatesOfficialIdentityPage({
            candidate,
            fetch: input.publicWebFetch,
          });
          candidate = verified.candidate;
          if (verified.inspection) {
            measured.sourceQueries += verified.inspection.hops;
            measured.documentAttempts += verified.inspection.hops;
            measured.transportHops += verified.inspection.hops;
            measured.receivedBytes += verified.inspection.receivedBytes;
            measured.decodedBytes += verified.inspection.receivedBytes;
            attemptedSources.push(
              "Open States linked official legislature page",
            );
          }
        }
        dynamicCandidates.push(candidate);
      }
      if (result.status !== "searched" && result.limitation) {
        sourceFailures.push(result.limitation);
      }
      if (dynamicCandidates.some((candidate) =>
        strongCandidateEntityMatch(input.workflow, candidate))) {
        break routeLoop;
      }
      continue;
    }
    measured.sourceQueries += 1;
    const exactDocumentNumber = route === "federal_register"
      ? exactFederalIdentifier ?? cachedFederalDocumentNumber
      : null;
    let result: Screen02OfficialConnectorResult;
    if (route === "federal_register") {
      const federalInput = (query: string) => ({
          fetch: input.fetch,
          retrievedAt: input.retrievedAt,
          startDate: window.startDate,
          endDate: window.endDate,
          population: "Not used for identity matching",
          outcomeFamily: "Not used for identity matching",
          query: exactDocumentNumber ?? query,
          ...(exactDocumentNumber ? { exactDocumentNumber } : {}),
          queryId: "screen01-identity-federal-register",
          queryPurpose:
            "Resolve the researcher-supplied policy identity; never rank causal suitability.",
          limit: remainingLeads,
          timeoutMs: FEDERAL_IDENTITY_METADATA_ATTEMPT_TIMEOUT_MS,
          eventFamily: input.workflow.intendedEpisode ?? "policy instrument",
          workflowMode: "audit",
        } as const);
      result = await fetchFederalRegisterProposals(
        federalInput(input.workflow.currentShockInput),
      );
      if (
        result.diagnostics.failureKind === "timeout" &&
        measured.sourceQueries < 8
      ) {
        measured.sourceQueries += 1;
        result = await fetchFederalRegisterProposals(
          federalInput(input.workflow.currentShockInput),
        );
      }
      const fallbackQuery = !exactDocumentNumber
        ? providerQueryVariants.find((value) =>
            normalizePolicyIdentityText(value) !==
              normalizePolicyIdentityText(input.workflow.currentShockInput))
        : null;
      if (
        fallbackQuery && result.diagnostics.failureKind === "none" &&
        result.proposals.length === 0 && measured.sourceQueries < 8
      ) {
        measured.sourceQueries += 1;
        result = await fetchFederalRegisterProposals(
          federalInput(fallbackQuery),
        );
      }
    } else if (route === "eu_cellar") {
      result = await fetchEuCellarLegalProposals({
            fetch: input.fetch,
            retrievedAt: input.retrievedAt,
            startDate: window.startDate,
            endDate: window.endDate,
            population: "Not used for identity matching",
            outcomeFamily: "Not used for identity matching",
            query: input.workflow.currentShockInput,
            titleMatch: "all_terms",
            ...(exactEuIdentifier ? { celexId: exactEuIdentifier } : {}),
            queryId: "screen01-identity-eu-cellar",
            queryPurpose:
              "Resolve the entered legal-instrument name in the official catalog; never rank causal suitability.",
            limit: remainingLeads,
            timeoutMs: 20_000,
          });
    } else {
      result = await fetchUkLegislationProposals({
            fetch: input.fetch,
            retrievedAt: input.retrievedAt,
            startDate: window.startDate,
            endDate: window.endDate,
            population: "Not used for identity matching",
            outcomeFamily: "Not used for identity matching",
            query: input.workflow.currentShockInput,
            queryId: "screen01-identity-uk-legislation",
            queryPurpose:
              "Resolve the entered legislation name in the official catalog; never rank causal suitability.",
            limit: remainingLeads,
            timeoutMs: 20_000,
          });
    }
    const proposals = result.proposals.filter(
      (proposal): proposal is IdentityBoundProposal =>
        proposal.mode === "find" && proposal.nativeIdentity !== undefined,
    ).slice(0, remainingLeads);
    measured.metadataRecords += proposals.length;
    if (result.diagnostics.failureKind !== "none") {
      sourceFailures.push(
        `${attemptedSources.at(-1)} retrieval failed (${result.diagnostics.failureKind}); this is not an empty search result.`,
      );
      continue;
    }
    const ranked = proposals.map((proposal) => ({
      proposal,
      ...providerProposalScore(input.workflow, proposal),
    })).sort((left, right) => right.score - left.score);
    for (const { proposal } of ranked) {
      if (
        measured.documentAttempts >= 8 ||
        measured.usefulDocuments >= 4 ||
        indexedCandidates.length + dynamicCandidates.length >=
          candidateValidationLimit
      ) break;
      const key = proposalIdentityKey(proposal);
      if (seenProviderIdentities.has(key)) continue;
      seenProviderIdentities.add(key);
      suppliedDynamicLocatorMatched ||= proposalMatchesSuppliedLocator(
        input.workflow,
        proposal,
      );
      if (route === "federal_register") {
        const checked = await readyFederalCandidate({
          workflow: input.workflow,
          proposal,
          fetch: input.fetch,
          retrievedAt: input.retrievedAt,
        });
        measured.documentAttempts += checked.attempts;
        measured.transportHops += checked.hops;
        measured.receivedBytes += checked.receivedBytes;
        measured.decodedBytes += checked.decodedBytes;
        if (checked.candidate) {
          measured.usefulDocuments += 1;
          dynamicCandidates.push(checked.candidate);
        }
        continue;
      }
      const checked = await readyOfficialCatalogCandidate({
        workflow: input.workflow,
        proposal,
        fetch: input.fetch,
        retrievedAt: input.retrievedAt,
        maximumAttempts: Math.min(2, 8 - measured.documentAttempts),
      });
      measured.documentAttempts += checked.attempts;
      measured.transportHops += checked.transportHops;
      measured.receivedBytes += checked.receivedBytes;
      measured.decodedBytes += checked.decodedBytes;
      if (checked.candidate) {
        measured.usefulDocuments += 1;
        dynamicCandidates.push(checked.candidate);
      } else if (checked.limitation) {
        sourceFailures.push(checked.limitation);
      }
    }
    if (dynamicCandidates.some((candidate) =>
      strongCandidateEntityMatch(input.workflow, candidate))) break;
  }
  if (website?.status === "lead" && !indexedCandidates.length &&
      !dynamicCandidates.length) {
    const source: IdentitySource = {
      id: `webpage-identity-${fingerprintSixScreenValue(website.url).slice(8)}`,
      title: website.title,
      locator: website.url,
      publisher: new URL(website.url).hostname,
      publishedDate: null,
      authorityTier: "tier-3",
      retrievedAt: input.retrievedAt,
      provider: "researcher-supplied webpage",
      nativeId: null,
      routeId: "public_webpage_identity_cue",
      routeVersion: "screen-01-webpage-identity-v2",
      accessStatus: "retained_passage",
      inspectedText: "abstract",
      contentHash: fingerprintSixScreenValue(website.excerpt),
      retainedText: website.excerpt,
      limitation: "This page supports a possible identity only. Operative duties, legal stage and historical version require a controlling source.",
    };
    dynamicCandidates.push({
      id: `identity-webpage-${fingerprintSixScreenValue(website.url).slice(8)}`,
      officialTitle: website.title,
      aliases: website.cues.filter((cue) => cue !== website.title).slice(0, 3),
      issuer: "Not established by this webpage",
      issuingJurisdiction: "Not established by this webpage",
      instrumentType: "Source-assisted identity lead",
      formalIdentifiers: [],
      episode: "Policy stage requires source confirmation",
      versionScope: "Official duties and historical version remain to be verified",
      typedDates: [],
      identitySourceIds: [source.id],
      sourceSnapshotId: `identity-source-${fingerprintSixScreenValue(website.url).slice(8)}`,
      sourceSnapshotFingerprint: fingerprintSixScreenValue([source]),
      identitySources: [source],
      displayedDescription: website.excerpt,
      matchExplanation: "The supplied public page identifies the entered policy name. No reviewed index record or controlling legal document was matched; confirm the intended identity and expect a limited Screen 2 until a controlling source is available.",
      materialMismatches: [],
      retrievedAt: input.retrievedAt,
    });
    measured.usefulDocuments += 1;
  }
  const supportedLocatorMatched =
    indexLeads.some(({ exactLocator }) => exactLocator) ||
    exactFederalIdentifier !== null || suppliedDynamicLocatorMatched;
  // A generic public webpage is an optional discovery aid. Failure to fetch
  // it must not suppress a source-backed name match. Exact supported official
  // locators retain the stricter same-identity binding requirement.
  const suppliedLocatorMatched = !requiresExactLocatorBinding ||
    supportedLocatorMatched;
  const preferNativeProviderCandidate = Boolean(
    (exactFederalIdentifier || exactEuIdentifier) &&
      input.workflow.officialSourceLocators.length === 0,
  );
  const candidatePool = preferNativeProviderCandidate
    ? [...dynamicCandidates, ...indexedCandidates]
    : [...indexedCandidates, ...dynamicCandidates];
  // A strong reviewed match can still be refreshed through its native live
  // catalog, but unrelated loose provider hits should not clutter—or break—the
  // exact entity result. Uncatalogued requests continue to use the full live
  // pool.
  const entityCoherentPool = strongReadyIndexCandidate
    ? candidatePool.filter((candidate) =>
        indexedCandidates.some(({ id }) => id === candidate.id) ||
        strongCandidateEntityMatch(input.workflow, candidate))
    : candidatePool;
  let quarantinedProviderCandidates = 0;
  const canonicallyValidPool = entityCoherentPool.filter((candidate) => {
    try {
      createIdentityCandidate({
        originalRequest: input.workflow.currentShockInput,
        candidateRevision: input.workflow.identityRevision,
        candidate,
      });
      return true;
    } catch {
      quarantinedProviderCandidates += 1;
      return false;
    }
  });
  const candidates = canonicallyValidPool
    .filter((candidate, index, values) =>
      values.findIndex((other) =>
        sameCandidateIdentity(other, candidate)
      ) === index
    ).sort((left, right) =>
      Number(exactCandidateNameMatch(input.workflow, right)) -
        Number(exactCandidateNameMatch(input.workflow, left)) ||
      Number(strongCandidateEntityMatch(input.workflow, right)) -
        Number(strongCandidateEntityMatch(input.workflow, left)) ||
      candidateIdentityScore(input.workflow, right) -
        candidateIdentityScore(input.workflow, left) ||
      left.id.localeCompare(right.id)
    )
    .slice(0, MAX_VISIBLE_CANDIDATES);
  measured.activeResearchMs = Math.max(
    0,
    Math.round((input.monotonicNow?.() ?? started) - started),
  );
  const suppliedUnmatched = !suppliedLocatorMatched;
  const requestedJurisdictionSupported = !input.workflow.requestedJurisdiction ||
    routes.length > 0 ||
    SCREEN01_IDENTITY_PROPOSAL_REGISTRY.some((proposal) =>
      jurisdictionMatches(
        input.workflow.requestedJurisdiction,
        proposal.nativeIdentity?.issuingJurisdiction ??
          proposal.event.geographies[0] ?? null,
      )
    );
  const unsupportedJurisdiction = !candidates.length &&
    !requestedJurisdictionSupported;
  const visibleCandidates = suppliedUnmatched ? [] : candidates;
  return {
    protocolVersion: SCREEN_01_IDENTITY_RESOLUTION_PROTOCOL_VERSION,
    status: visibleCandidates.length
      ? "resolved"
      : unsupportedJurisdiction
        ? "unsupported_for_request"
      : sourceFailures.length && routes.length > 0
        ? "source_unavailable"
        : "not_resolved",
    candidates: visibleCandidates,
    attemptedSources,
    unresolved: visibleCandidates.length
      ? []
      : unsupportedJurisdiction
        ? ["operational source route for the requested policy jurisdiction"]
      : suppliedUnmatched
        ? ["validated supported identity for the supplied official locator"]
        : ["policy identity with usable continuation evidence"],
    limitation: visibleCandidates.length
      ? `Each displayed match has source-backed identity evidence; retained official text is attached where the provider exposes a safely inspectable representation, and otherwise the official locator remains explicit for Screen 2 review. Confirmation still does not establish sample exposure, a treatment clock, or causal suitability.${quarantinedProviderCandidates ? ` ${quarantinedProviderCandidates} auxiliary provider lead${quarantinedProviderCandidates === 1 ? " was" : "s were"} omitted because it did not satisfy the canonical identity-source contract.` : ""}${websiteLimitation ? ` The optional webpage could not supply an identity cue: ${websiteLimitation}` : ""}`
      : suppliedUnmatched
        ? "The supplied official locator did not resolve to the same native identity as the entered name. Neither value was overwritten; clarify the intended policy or source before confirmation."
        : unsupportedJurisdiction
          ? `No operational source route currently covers the requested jurisdiction “${input.workflow.requestedJurisdiction}”. No policy from a different jurisdiction was substituted.`
        : sourceFailures[0] ??
          `${websiteLimitation ? `${websiteLimitation} ` : ""}No sufficiently close source-backed identity with usable continuation evidence was found. No similar policy was substituted.`,
    usage: measured,
    outcomeValuesInspected: false,
  };
}

/** Released import name retained for old callers; behavior is now multi-route. */
export const resolveScreen01FederalRegisterIdentity = resolveScreen01Identity;
