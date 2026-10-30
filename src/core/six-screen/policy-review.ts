import type {
  Claim,
  EvidenceRequirement,
  Passage,
  PolicyBriefing,
  PolicyEvidenceRequirementKind,
  PolicyInterpretation,
  PolicyReviewClaimProjection,
  TypedDate,
} from "./contracts";
import { SIX_SCREEN_POLICY_INTERPRETATION_SCHEMA_VERSION } from
  "./contracts";
import { fingerprintSixScreenValue } from "./canonical";
import { validateEvidenceCollection, type EvidenceCollection } from "./evidence";
import {
  POLICY_EVIDENCE_CORE_KINDS,
  POLICY_EVIDENCE_COVERAGE_KINDS,
  POLICY_EVIDENCE_ENFORCEMENT_KINDS,
  POLICY_EVIDENCE_REQUIREMENT_KINDS,
  type FederalRegisterPolicyEvidenceFocus,
} from "./policy-evidence-plan";
import {
  assessPolicyTextQuality,
  isPolicyPageBoilerplateText,
  normalizePolicyEvidenceText,
} from "./policy-text-normalization";
import {
  cleanPolicyPresentationText,
  isCompletePolicyPresentationSentence,
} from "./policy-presentation";

export const FEDERAL_REGISTER_POLICY_PARSER_VERSION =
  "federal-register-visible-policy-v6" as const;

export type FederalRegisterPolicyEvidenceInput = {
  eventId: string;
  documentNumber: string;
  canonicalUrl: string;
  title: string;
  issuer: string;
  publicationDate: string | null;
  retrievedAt: string;
  contentHash: string;
  representation: "html" | "text";
  parsedText: string;
  focus: FederalRegisterPolicyEvidenceFocus;
  sourceProvider?: "federal-register" | "govinfo";
  legalEditionUrl?: string;
};

export type ParsedPolicyEvidence = {
  collection: EvidenceCollection;
  projections: PolicyReviewClaimProjection[];
  unresolved: string[];
  status: "ready" | "partial";
};

export type ParsedFederalRegisterPolicyEvidence = ParsedPolicyEvidence;

export type OfficialDocumentPolicyEvidenceInput = {
  eventId: string;
  sourceId: string;
  provider: string;
  nativeId: string | null;
  canonicalUrl: string;
  title: string;
  publisher: string;
  issuer: string;
  jurisdiction: string;
  publicationDate: string | null;
  retrievedAt: string;
  contentHash: string;
  retainedText: string;
  representation?: string;
  acquisitionProvenance?: "direct" | "third_party" | "upload";
  inspectedText?: "full" | "partial";
  sourceRole?: string;
  documentVersionLabel?: string;
  searchedRequirementKinds?: readonly PolicyEvidenceRequirementKind[];
  missingRequirementStatus?: Extract<
    EvidenceRequirement["status"],
    "searched_not_found" | "source_unavailable" | "not_yet_searched"
  >;
};

export type ParsedOfficialDocumentPolicyEvidence = ParsedPolicyEvidence;

type TextSpan = { text: string; start: number; end: number };

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function legalAbbreviationBefore(text: string, end: number) {
  return /(?:(?:\p{L}\.){2,}|\b(?:u\.s\.c|u\.s|e\.g|i\.e|no|nos|sec|secs|art|arts|ch|vol|inc|corp|co|ltd|dept|et\s+seq|et\s+al)\.)$/iu
    .test(text.slice(Math.max(0, end - 24), end));
}

const MAX_NESTED_SENTENCE_CHARACTERS = 1_200;

function sentenceSpans(text: string) {
  const values: TextSpan[] = [];
  let cursor = 0;
  const push = (end: number) => {
    const raw = text.slice(cursor, end);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) {
      const start = cursor + leading;
      values.push({ text: trimmed, start, end: start + trimmed.length });
    }
    cursor = end;
  };
  let roundDepth = 0;
  let squareDepth = 0;
  let curlyDepth = 0;
  const resetGroupingDepth = () => {
    roundDepth = 0;
    squareDepth = 0;
    curlyDepth = 0;
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === "(") roundDepth += 1;
    if (character === "[") squareDepth += 1;
    if (character === "{") curlyDepth += 1;
    if (character === ")") roundDepth = Math.max(0, roundDepth - 1);
    if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    if (character === "}") curlyDepth = Math.max(0, curlyDepth - 1);
    const nested = roundDepth + squareDepth + curlyDepth > 0;
    const recoverFromMalformedGrouping = nested &&
      index - cursor >= MAX_NESTED_SENTENCE_CHARACTERS;
    if (text[index] === "\n") {
      if (nested && !recoverFromMalformedGrouping) continue;
      push(index);
      cursor = index + 1;
      if (recoverFromMalformedGrouping) resetGroupingDepth();
      continue;
    }
    if (!".!?".includes(character) ||
        (nested && !recoverFromMalformedGrouping) ||
        (character === "." && legalAbbreviationBefore(text, index + 1))) {
      continue;
    }
    let end = index + 1;
    while (end < text.length && "]}'\"”’".includes(text[end]!)) end += 1;
    const next = text[end];
    if (next !== undefined && !/\s/u.test(next)) continue;
    push(end);
    if (recoverFromMalformedGrouping) resetGroupingDepth();
    index = end - 1;
  }
  push(text.length);
  return values;
}

function firstMatching(
  spans: readonly TextSpan[],
  predicate: (text: string) => boolean,
) {
  return spans.find(({ text }) => predicate(text)) ?? null;
}

function bestMatching(
  spans: readonly TextSpan[],
  predicate: (text: string) => boolean,
  score: (text: string) => number,
) {
  return spans.filter(({ text }) => predicate(text))
    .sort((left, right) => score(right.text) - score(left.text))[0] ?? null;
}

function operativeSpan(spans: readonly TextSpan[]) {
  return firstMatching(spans, (text) =>
    /\b(?:requires?|must|amend(?:s|ed|ing)?|establish(?:es|ed|ing)?)\b/iu.test(text) &&
    /\b(?:tariff|participation model|storage resources?|regulations?|requirements?)\b/iu.test(text) &&
    !/\bwithin\s+\d{1,4}\s+days\b/iu.test(text)
  );
}

function effectiveSpan(spans: readonly TextSpan[]) {
  return firstMatching(spans, (text) =>
    /\b(?:is|are|shall be|becomes?)\s+effective\b/iu.test(text) &&
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/iu.test(text)
  );
}

function implementationSpan(spans: readonly TextSpan[], parsedText: string) {
  const filingIndex = spans.findIndex(({ text }) =>
    /\b(?:must|shall|required to|require[^.]{0,100}\bto)\b/iu.test(text) &&
    /\b(?:file|submit)\b/iu.test(text) &&
    /\bwithin\s+\d{1,4}\s+days\b/iu.test(text)
  );
  if (filingIndex >= 0) {
    const filing = spans[filingIndex]!;
    const next = spans[filingIndex + 1];
    if (
      next && /\b(?:implement|implementation)\b/iu.test(next.text) &&
      /\b\d{1,4}\s+days\b/iu.test(next.text)
    ) {
      return {
        text: parsedText.slice(filing.start, next.end),
        start: filing.start,
        end: next.end,
      };
    }
    return filing;
  }
  return firstMatching(spans, (text) =>
    /\b(?:implement|implementation)\b/iu.test(text) &&
    /\b(?:within|further)\s+\d{1,4}\s+days\b/iu.test(text)
  );
}

function isPolicyDiscussionSentence(text: string) {
  return /\b(?:comments?|commenters?|request for information|for example|beyond the scope|we (?:considered|did not propose|proposed|requested|sought)|other compliance matters)\b/iu
    .test(text);
}

function coverageSpan(spans: readonly TextSpan[]) {
  const formalCondition = firstMatching(spans, (text) =>
    !isPolicyDiscussionSentence(text) &&
    /\b(?:appl(?:y|ies|icable)|eligible|qualif(?:y|ies|ication)|voluntarily)\b/iu.test(text) &&
    /\b(?:organizations?|entities|resources?|operators?|RTOs?|ISOs?|firms?|businesses?|facilities|hospitals?|institutions?)\b/iu.test(text) &&
    /\b(?:market|service|activity|tariff|rule|requirement|participation|capacity|energy|ancillary)\w*\b/iu.test(text)
  );
  return formalCondition ?? firstMatching(spans, (text) =>
    !isPolicyDiscussionSentence(text) &&
    /\b(?:requires?|must|shall|appl(?:y|ies|icable)|eligible|qualif(?:y|ies|ication)|participat(?:e|es|ing|ion))\b/iu.test(text) &&
    /\b(?:organizations?|entities|resources?|operators?|RTOs?|ISOs?|firms?|businesses?|facilities|hospitals?|institutions?)\b/iu.test(text) &&
    /\b(?:market|service|activity|tariff|rule|requirement|participation|capacity|energy|ancillary)\w*\b/iu.test(text)
  ) ?? firstMatching(spans, (text) =>
    !isPolicyDiscussionSentence(text) &&
    /\brequirements?\s+for\b/iu.test(text) &&
    /\b(?:organizations?|entities|resources?|operators?|firms?|businesses?|facilities|hospitals?|institutions?)\b/iu.test(text) &&
    /\b(?:operating|participating|providing|engaged|located|established)\b/iu.test(text)
  );
}

function exemptionSpan(spans: readonly TextSpan[]) {
  return firstMatching(spans, (text) =>
    !isPolicyDiscussionSentence(text) &&
    /\b(?:exempt(?:s|ed|ion)?|exception|exclude(?:s|d)?|does not apply|grandfather(?:s|ed|ing)?)\b/iu.test(text) &&
    /\b(?:rule|requirement|criteria|penalt(?:y|ies)|market|resource|organization|entity|facility|business)\w*\b/iu.test(text)
  );
}

function enforcementSpan(spans: readonly TextSpan[]) {
  const authority =
    /\b(?:attorney general|district attorney|commission|secretary|agency|authority|court|CMS|OFCOM)\b/iu;
  const directPower =
    /\b(?:shall|may|will|is authorized to|has authority to)\b.{0,220}\b(?:enforc(?:e|es|ed|ing)|bring (?:a civil )?action|investigat(?:e|es|ed|ing)|assess(?:es|ed|ing)?|impos(?:e|es|ed|ing)|seek (?:an? )?(?:injunction|penalty|relief))\b/iu;
  return bestMatching(
    spans,
    (text) =>
      !isPolicyDiscussionSentence(text) && authority.test(text) &&
      (directPower.test(text) ||
        /\b(?:enforces|investigates|assesses|imposes)\b/iu.test(text)),
    (text) =>
      (new RegExp(
          `${authority.source}\\s+(?:shall|may|will|is authorized to|has authority to)\\b`,
          "iu",
        ).test(text)
        ? 20
        : 0) +
      (/\b(?:identified as noncompliant|fails? to|violation of|this part)\b/iu
          .test(text)
        ? 6
        : 0) -
      (/\b(?:as we describe|we (?:may|will|are))\b/iu.test(text) ? 8 : 0),
  );
}

function penaltySpan(spans: readonly TextSpan[]) {
  return firstMatching(spans, (text) =>
    !isPolicyDiscussionSentence(text) &&
    /(?:\$\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*\s+(?:dollars?|percent|years?|months?)\b)/iu.test(text) &&
    /\b(?:civil|administrative|criminal)?\s*(?:penalt(?:y|ies)|fine(?:d|s)?|damages|imprison(?:ed|ment)|forfeit)\b/iu.test(text) &&
    ( /\b(?:maximum|minimum)\b.{0,180}\b(?:penalt(?:y|ies)|fine(?:s)?)\b/iu
        .test(text) ||
      /\b(?:shall|may|will)\b.{0,100}\b(?:impos(?:e|ed)|assess(?:ed)?|subject to|liable for)\b/iu
        .test(text) ||
      /\b(?:penalt(?:y|ies)|fine(?:s)?)\b.{0,140}\b(?:shall|may|will|subject to|liable for|is|are)\b/iu
        .test(text))
  );
}

function effectiveDate(text: string) {
  const match = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/iu.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1]!.toLocaleLowerCase("en-US")];
  const day = Number(match[2]);
  if (!month || day < 1 || day > 31) return null;
  return `${match[3]}-${month}-${day.toString().padStart(2, "0")}`;
}

function implementationSchedule(text: string) {
  const filing = /\bwithin\s+(\d{1,4})\s+days\s+of\s+(?:the\s+)?publication\b/iu.exec(text);
  const further = /\b(?:a\s+)?further\s+(\d{1,4})\s+days\s+from\s+that\s+date\s+to\s+implement\b/iu.exec(text);
  const direct = /\bimplement[^.]{0,160}?within\s+(\d{1,4})\s+days\b/iu.exec(text);
  return {
    filingDeadlineDaysAfterPublication: filing ? Number(filing[1]) : null,
    implementationWindowDaysAfterFilingDeadline: further
      ? Number(further[1])
      : !filing && direct
        ? Number(direct[1])
        : null,
    anchor: further
      ? "filing_deadline"
      : filing
        ? "publication"
        : "stated_implementation_schedule",
  };
}

function projection(
  claim: Claim,
  passage: Passage,
  input: FederalRegisterPolicyEvidenceInput,
): PolicyReviewClaimProjection {
  const source = federalRegisterPolicySource(input.sourceProvider);
  return {
    claimId: claim.id,
    predicate: claim.predicate as PolicyReviewClaimProjection["predicate"],
    statement: claim.statement,
    typedValue: structuredClone(claim.typedValue),
    supportStatus: claim.supportStatus,
    qualification: passage.qualification,
    citation: {
      passageId: passage.id,
      exactText: passage.exactText,
      locator: passage.locator,
      documentVersionId: passage.documentVersionId,
      sourceId: passage.sourceId,
      sourceTitle: input.title,
      canonicalUrl: input.canonicalUrl,
      sourceRole: source.role,
      inspectedText: "full",
    },
  };
}

function federalRegisterPolicySource(
  provider: FederalRegisterPolicyEvidenceInput["sourceProvider"] =
    "federal-register",
) {
  return provider === "govinfo"
    ? {
        provider,
        idPrefix: "govinfo-fr",
        publisher: "U.S. Government Publishing Office",
        role:
          "official GovInfo Federal Register HTML representation; exact text retrieved from the confirmed GPO granule without treating a second representation as independent corroboration",
        versionLabel: "GovInfo Federal Register representation",
      }
    : {
        provider,
        idPrefix: "fr",
        publisher: "Federal Register",
        role:
          "official Federal Register published-text representation; controlling edition separately verifiable on GovInfo",
        versionLabel: "Published representation",
      };
}

const POLICY_REQUIREMENT_DEFINITIONS: ReadonlyArray<{
  kind: PolicyEvidenceRequirementKind;
  predicate: PolicyReviewClaimProjection["predicate"] | null;
  description: string;
  criticality: EvidenceRequirement["criticality"];
}> = [
  {
    kind: "operative_change",
    predicate: "operative_change",
    description: "Retain the rule's operative change from the published text.",
    criticality: "critical",
  },
  {
    kind: "previous_baseline",
    predicate: "previous_baseline",
    description: "Establish the documented preceding rule or practice without assuming that no prior regulation existed.",
    criticality: "material",
  },
  {
    kind: "coverage",
    predicate: "coverage_condition",
    description: "Retain the formal organizational, activity, eligibility, or threshold conditions stated in the controlling instrument.",
    criticality: "critical",
  },
  {
    kind: "exemption",
    predicate: "exemption_rule",
    description: "Retain explicit exemptions, exclusions, non-exemptions, or grandfathering without inferring that none exist.",
    criticality: "critical",
  },
  {
    kind: "temporal_stage",
    predicate: "legal_effect_date",
    description: "Retain the legal-effective date as its own policy stage.",
    criticality: "critical",
  },
  {
    kind: "version",
    predicate: "historical_version_change",
    description: "Identify the historically relevant regulatory version rather than silently substituting current text.",
    criticality: "material",
  },
  {
    kind: "implementation",
    predicate: "implementation_schedule",
    description: "Retain any later compliance or implementation schedule without collapsing it into legal effect.",
    criticality: "critical",
  },
  {
    kind: "enforcement",
    predicate: "enforcement_authority",
    description:
      "Identify the enforcing authority and any stated remedy, trigger, or cure process without treating a generic enforcement reference as a complete rule.",
    criticality: "material",
  },
  {
    kind: "penalty",
    predicate: "penalty",
    description:
      "Retain provision-specific sanctions with amount or range, unit, currency, trigger, qualification, and valid period when the source states them.",
    criticality: "material",
  },
];

export function unsearchedFederalRegisterPolicyRequirements(
  documentNumber: string,
): EvidenceRequirement[] {
  return POLICY_REQUIREMENT_DEFINITIONS.map((value) => ({
    id: `fr-requirement-${documentNumber}-${value.kind}`,
    kind: value.kind,
    description: value.description,
    status: "not_yet_searched",
    criticality: value.criticality,
    supportingClaimIds: [],
  }));
}

export function unsearchedOfficialDocumentPolicyRequirements(
  sourceId: string,
): EvidenceRequirement[] {
  return POLICY_REQUIREMENT_DEFINITIONS.map((value) => ({
    id: `official-requirement-${sourceId}-${value.kind}`.slice(0, 200),
    kind: value.kind,
    description: value.description,
    status: "not_yet_searched",
    criticality: value.criticality,
    supportingClaimIds: [],
  }));
}

function provisionLocator(text: string, start: number, fallback: string) {
  const prefix = text.slice(Math.max(0, start - 20_000), start);
  const matches = [...prefix.matchAll(
    /\b(?:(?:section|sec\.|article|chapter|part|schedule|regulation|reg\.|§)\s+(?:\d+[A-Za-z0-9().-]*|[IVXLC]+)|title\s+(?:[IVXLC]+|\d+[A-Za-z]?))(?![A-Za-z0-9])/giu,
  )];
  return matches.at(-1)?.[0] ?? fallback;
}

function policyStatementCore(value: string) {
  return cleanPolicyPresentationText(value)
    .replace(/^\s*(?:\([0-9ivxlcdm]+\)\s*)+/iu, "")
    .trim();
}

function hasBalancedPolicyGrouping(value: string) {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["(", ")"], ["[", "]"], ["{", "}"],
  ];
  return pairs.every(([open, close]) => {
    let depth = 0;
    for (const character of value) {
      if (character === open) depth += 1;
      if (character === close) {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  });
}

function hasIndependentPolicyMeaning(value: string) {
  const text = policyStatementCore(value);
  return text.split(/\s+/u).length >= 4 && hasBalancedPolicyGrouping(text) &&
    !isPolicyPageBoilerplateText(text) &&
    !isPolicyDiscussionSentence(text) &&
    !/^(?:and|but|or|that|which|who|whose)\b(?:\s|,)/iu.test(text) &&
    !/^(?:shall|must|may|need not|required to|prohibited from)\b/iu.test(text) &&
    !/\b(?:the following|the earliest of)\s*[:—–-]?\s*[.!?]?$/iu.test(text) &&
    !/^(?:as used in|for purposes of)\s+(?:this|the)\s+(?:act|title|section|part)\b.{0,100}\bfollowing definitions?\b/iu
      .test(text) &&
    /\b(?:am|amended|applies|approved|are|authorized|be|become|becomes|became|begins?|can|commences?|continues?|does|effective|enacted|exceeds?|has|have|implemented|includes?|is|may|means|must|need|provides?|published|repealed|requires?|shall|signed|starts?|superseded|takes?|was|were|will)\b/iu
      .test(text) &&
    !/^(?:definitions?|exemptions?|exceptions?|implementation|compliance|modification of exemption)\s*[.!?]?$/iu
      .test(text);
}

function definedCoverageTerm(value: string) {
  const text = policyStatementCore(value);
  const match = /\bthe term\s+([^,;:]{1,80}?)\s+means\b/iu.exec(text) ??
    /^([^,;:]{1,80}?)\s+(?:means|includes?)\b/iu.exec(text);
  if (!match) return null;
  const term = normalizedBriefingText(match[1]!);
  if (!term ||
      /^(?:the )?(?:act|agency|board|commission|department|regulation|rule|secretary|section|title)$/u
        .test(term) || /\bdate$/u.test(term)) return null;
  return term;
}

function statesFormalCoverage(value: string) {
  const text = policyStatementCore(value);
  const applicability = /\b(?:this (?:act|title|section|regulation|rule)|the requirements?)\s+(?:shall\s+)?appl(?:y|ies)\s+to\b|\bapplies to\b|\bsubject to (?:this|the)\b/iu
    .test(text);
  return hasIndependentPolicyMeaning(text) &&
    (applicability || Boolean(definedCoverageTerm(text))) &&
    !/\b(?:this\s+)?(?:guidance|faq|frequently asked questions?|page|website|consumer\s+(?:shopping\s+)?(?:explanation|guide|tool))\s+appl(?:y|ies)\s+to\b/iu
      .test(text) &&
    !/\bshall apply from\b/iu.test(text) &&
    !/\bconsumers?\b.{0,80}\bshould\s+(?:follow up|contact|ask|check)\b/iu
      .test(text);
}

function statesExpressException(value: string) {
  const text = policyStatementCore(value);
  if (!hasIndependentPolicyMeaning(text)) return false;
  return /\b(?:does not apply to|shall not apply to)\b/iu.test(text) ||
    /\b(?:exempts?|exempted)\b.{0,100}\bfrom\b/iu.test(text) ||
    /\b(?:except(?: for)?|excluding|excludes?|grandfathers?|grandfathered)\b\s+\S/iu
      .test(text) ||
    /\b(?:exception|exemption|exclusion)\b.{0,120}\b(?:applies?|available|covers?|for|from|to|under)\b/iu
      .test(text);
}

function statesPriorPolicyBaseline(value: string) {
  const text = policyStatementCore(value);
  if (!hasIndependentPolicyMeaning(text) ||
      /\b(?:period|year|date)\s+prior to\b/iu.test(text)) return false;
  return /\b(?:prior|previous|preexisting|existing)\s+(?:law|rule|regulation|requirement|practice|standard|regime)\b/iu.test(text) ||
    /\b(?:law|rule|regulation|requirement|practice|standard|regime)\s+(?:previously|required|allowed|prohibited|in force before)\b/iu.test(text) ||
    /\b(?:supersedes?|repeals?|replaces?|replaced)\b/iu.test(text) ||
    /\bbefore (?:the )?(?:effective date|enactment|amendment)\b.{0,160}\b(?:law|rule|regulation|requirement|practice|standard)\b/iu
      .test(text);
}

function statesImplementationSchedule(value: string) {
  const text = policyStatementCore(value);
  return hasIndependentPolicyMeaning(text) &&
    ( /\bcomes? into force\b|\b(?:within|not later than|no later than)\s+\d+\s+(?:days|months|years)\b/iu
        .test(text) ||
      /\b(?:comply|compliance|implementation|implement|commencement|phase[- ]?in|transition period)\b.{0,180}\b(?:begins?|starts?|by|within|after|before|from|on)\b/iu
        .test(text)) &&
    !/^.{0,80}\benforcement\b.{0,80}$/iu.test(text);
}

function boundedMatches(
  spans: readonly TextSpan[],
  predicate: (text: string) => boolean,
  maximum = 4,
) {
  return spans.filter(({ text }) => predicate(text)).slice(0, maximum);
}

function dateValue(text: string): Omit<TypedDate, "kind" | "passageIds"> | null {
  const iso = /\b((?:18|19|20|21)\d{2})-(\d{2})-(\d{2})\b/u.exec(text);
  if (iso) return {
    start: iso[0], end: null, precision: "day",
  };
  const written = new RegExp(
    `\\b(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2}),?\\s+((?:18|19|20|21)\\d{2})\\b`,
    "iu",
  ).exec(text);
  if (written) {
    const day = Number(written[2]);
    const month = MONTHS[written[1]!.toLocaleLowerCase("en-US")];
    if (month && day >= 1 && day <= 31) return {
      start: `${written[3]}-${month}-${String(day).padStart(2, "0")}`,
      end: null,
      precision: "day",
    };
  }
  const dayFirstWritten = new RegExp(
    `\\b(\\d{1,2})\\s+(${Object.keys(MONTHS).join("|")})\\s+((?:18|19|20|21)\\d{2})\\b`,
    "iu",
  ).exec(text);
  if (dayFirstWritten) {
    const day = Number(dayFirstWritten[1]);
    const month = MONTHS[dayFirstWritten[2]!.toLocaleLowerCase("en-US")];
    if (month && day >= 1 && day <= 31) return {
      start: `${dayFirstWritten[3]}-${month}-${String(day).padStart(2, "0")}`,
      end: null,
      precision: "day",
    };
  }
  const monthYear = new RegExp(
    `\\b(${Object.keys(MONTHS).join("|")})\\s+((?:18|19|20|21)\\d{2})\\b`,
    "iu",
  ).exec(text);
  if (monthYear) return {
    start: `${monthYear[2]}-${MONTHS[monthYear[1]!.toLocaleLowerCase("en-US")]}`,
    end: null,
    precision: "month",
  };
  const year = /\b((?:18|19|20|21)\d{2})\b/u.exec(text);
  return year
    ? { start: year[1]!, end: null, precision: "year" }
    : null;
}

type DatedStage = {
  date: Omit<TypedDate, "kind" | "passageIds">;
  kind: TypedDate["kind"];
  start: number;
  end: number;
};

const DATE_STAGE_PATTERNS: ReadonlyArray<{
  kind: TypedDate["kind"];
  source: string;
}> = [
  { kind: "initiation", source: "\\b(?:initiat(?:e|ed|ion)|introduced)\\b" },
  { kind: "announcement", source: "\\b(?:announc(?:e|ed|ement)|propos(?:e|ed|al))\\b" },
  { kind: "adoption", source: "\\b(?:adopt(?:ed|ion)|enact(?:ed|ment)|approved|signed into law)\\b" },
  { kind: "publication", source: "\\b(?:published|publication|filed)\\b" },
  { kind: "scheduled_effect", source: "\\b(?:scheduled|would|was to) (?:become |take )?effect(?:ive)?\\b" },
  { kind: "injunction", source: "\\b(?:enjoin(?:ed|ing)?|injunction)\\b" },
  { kind: "invalidation", source: "\\b(?:vacat(?:e|ed|ur)|set aside|held unlawful|invalidat(?:e|ed|ion))\\b" },
  { kind: "withdrawal", source: "\\b(?:withdraw(?:n|al)?|rescinded)\\b" },
  { kind: "supersession", source: "\\b(?:supersed(?:e|ed|ing)|replaced by)\\b" },
  { kind: "enforcement", source: "\\b(?:enforcement begins?|enforced from|commence enforcement|enforceable)\\b" },
  { kind: "legal_effect", source: "\\b(?:effective|operative|takes? effect|came into force|comes? into force|shall apply from)\\b" },
  { kind: "implementation", source: "\\b(?:actual implementation|implemented|implementation began|rolled out)\\b" },
  { kind: "compliance", source: "\\b(?:compliance|comply|implementation|implement|deadline)\\b" },
  { kind: "amendment", source: "\\b(?:amend(?:ed|ment)|revis(?:ed|ion))\\b" },
  { kind: "suspension", source: "\\b(?:suspend(?:ed|sion))\\b" },
  { kind: "repeal", source: "\\b(?:repeal(?:ed)?|remov(?:e|ed|al) from (?:the )?(?:code of federal regulations|cfr))\\b" },
];

/** Bind each date to the nearest independently stated legal-stage term. */
function datedStages(text: string): DatedStage[] {
  const stages = DATE_STAGE_PATTERNS.flatMap(({ kind, source }) =>
    [...text.matchAll(new RegExp(source, "giu"))].map((match) => ({
      kind,
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })))
  ;
  if (!stages.length) return [];
  const monthNames = Object.keys(MONTHS).join("|");
  const datePattern = new RegExp(
    `\\b(?:${monthNames})\\s+\\d{1,2},?\\s+(?:18|19|20|21)\\d{2}\\b|` +
      `\\b\\d{1,2}\\s+(?:${monthNames})\\s+(?:18|19|20|21)\\d{2}\\b|` +
      `\\b(?:18|19|20|21)\\d{2}-\\d{2}-\\d{2}\\b|` +
      `\\b(?:${monthNames})\\s+(?:18|19|20|21)\\d{2}\\b`,
    "giu",
  );
  const values: DatedStage[] = [];
  for (const match of text.matchAll(datePattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const date = dateValue(match[0]);
    if (!date) continue;
    const nearest = stages.map((stage) => ({
      stage,
      distance: stage.end <= start
        ? start - stage.end
        : end <= stage.start
          ? stage.start - end
          : 0,
    })).filter(({ distance }) => distance <= 180)
      .sort((left, right) => left.distance - right.distance ||
        left.stage.start - right.stage.start)[0]?.stage;
    if (nearest) {
      const local = text.slice(Math.max(0, start - 120),
        Math.min(text.length, end + 120));
      const cutoffOrDefinition =
        /\b(?:on or before|before or on|as of|first sale|first offer|eligib|qualif|means|definition|threshold|born|employed|issued|outstanding)\b/iu
          .test(local) &&
        !/\b(?:shall|will|does|did|became|becomes?|takes?|took|comes?|came)\s+(?:be\s+)?(?:effective|operative|into force)|\beffective\s+(?:on|as of|from)\b/iu
          .test(local);
      if (nearest.kind === "legal_effect" && cutoffOrDefinition) continue;
      values.push({ date, kind: nearest.kind, start, end });
    }
  }
  return [...new Map(values.map((value) => [
    `${value.kind}|${value.date.start}|${value.date.end}|${value.date.precision}`,
    value,
  ])).values()];
}

function relativeEnactmentLegalEffectSpan(
  spans: readonly TextSpan[],
  retainedText: string,
) {
  for (let index = 0; index < spans.length; index += 1) {
    for (let width = 1; width <= 3 && index + width <= spans.length; width += 1) {
      const first = spans[index]!;
      const last = spans[index + width - 1]!;
      const text = retainedText.slice(first.start, last.end);
      if (
        /\b(?:effective date|shall apply|takes? effect|becomes? effective)\b/iu
          .test(text) &&
        /\b(?:on(?: or after)?|from|as of)\s+(?:the\s+)?date of (?:the\s+)?enactment of (?:this|the)\s+(?:act|section)\b/iu
          .test(text)
      ) {
        return { text, start: first.start, end: last.end };
      }
    }
  }
  return null;
}

function matchingAdoptionDateSpan(
  spans: readonly TextSpan[],
  expectedDate: string | null,
) {
  if (!expectedDate || !/^\d{4}-\d{2}-\d{2}$/u.test(expectedDate)) return null;
  return spans.find((span) =>
    datedStages(span.text).some(({ date, kind }) =>
      kind === "adoption" && date.precision === "day" &&
      date.start === expectedDate)
  ) ?? null;
}

function relativeSchedule(text: string) {
  const match = /\b(?:not later than|no later than|within)\s+(\d{1,4})\s+(days?|months?|years?)\s+(?:after|from|following)\s+([^.;]{2,180})/iu
    .exec(text) ??
    /\b(\d{1,4})\s+(days?|months?|years?)\s+(?:after|from|following)\s+([^.;]{2,180})/iu
      .exec(text);
  if (!match) return null;
  return {
    amount: Number(match[1]),
    unit: match[2]!.toLocaleLowerCase("en-US").replace(/s$/u, ""),
    anchorText: match[3]!.trim(),
  };
}

function affectedGroup(text: string, coordinate = text.length) {
  const clauseStart = Math.max(
    text.lastIndexOf(";", coordinate),
    text.lastIndexOf(",", coordinate),
    text.lastIndexOf(".", coordinate),
  ) + 1;
  const clauseEndCandidates = [
    text.indexOf(";", coordinate),
    text.indexOf(".", coordinate),
  ].filter((value) => value >= 0);
  const clauseEnd = clauseEndCandidates.length
    ? Math.min(...clauseEndCandidates)
    : text.length;
  const clause = text.slice(clauseStart, clauseEnd).trim();
  const explicit = /\b(?:for|to)\s+(?:(?:an?|the)\s+)?([^,;]{2,100}?)(?=\s+(?:must|shall|is|are|begins?|starts?|takes?|comes?|on\b|from\b)|[,;]|$)/iu
    .exec(clause)?.[1];
  if (explicit) return explicit.replace(/\s+/gu, " ").trim();
  const actor = /^([^,;]{2,100}?)\s+(?:must|shall|is|are)\b/iu.exec(clause)?.[1];
  return actor?.replace(/\s+/gu, " ").trim() ?? null;
}

function penaltyValue(text: string) {
  const moneyValues = [...text.matchAll(
    /(?:([$€£])\s*([\d,]+(?:\.\d+)?)|\b([\d,]+(?:\.\d+)?)\s*(dollars?|euros?|pounds?))\b/giu,
  )];
  const money = moneyValues[0];
  const symbolCurrency: Record<string, string> = {
    $: "USD", "€": "EUR", "£": "GBP",
  };
  const amount = money
    ? Number((money[2] ?? money[3] ?? "").replaceAll(",", ""))
    : null;
  const amounts = moneyValues.map((value) =>
    Number((value[2] ?? value[3] ?? "").replaceAll(",", "")))
    .filter(Number.isFinite);
  const currency = money?.[1]
    ? symbolCurrency[money[1]]
    : money?.[4]?.toLocaleLowerCase("en-US").startsWith("euro")
      ? "EUR"
      : money?.[4]?.toLocaleLowerCase("en-US").startsWith("pound")
        ? "GBP"
        : money?.[4]
          ? "USD"
          : null;
  const unit = /\bper\s+([A-Za-z][A-Za-z -]{1,60}?)(?=\s+(?:and|or)\s+[$€£]|\s*[$€£]|[.;,]|$)/iu
    .exec(text)?.[1]
    ?.trim() ?? null;
  const multiplier = /\b(?:not more than|up to|maximum of)?\s*(\d+(?:\.\d+)?)\s+times\b/iu
    .exec(text)?.[1];
  const cure = /\b(?:cure|notice|opportunity to correct|within\s+\d+\s+days)\b/iu
    .test(text)
    ? text
    : null;
  return {
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    amounts,
    minimumAmount: amounts.length ? Math.min(...amounts) : null,
    maximumAmount: amounts.length ? Math.max(...amounts) : null,
    currency,
    unit,
    multiplier: multiplier ? Number(multiplier) : null,
    trigger: /\b(?:violation|offense|failure|knowing|intentional)\w*\b/iu
      .exec(text)?.[0] ?? null,
    qualificationOrCure: cure,
  };
}

/**
 * Reconstructs independently supported policy facts from one immutable source
 * representation. There is deliberately no first-sentence fallback: a title,
 * enactment sentence, or generic mention of covered entities is not an
 * operative change or an eligibility rule.
 */
export function parseOfficialDocumentPolicyEvidence(
  input: OfficialDocumentPolicyEvidenceInput,
): ParsedOfficialDocumentPolicyEvidence {
  const retainedText = normalizePolicyEvidenceText(input.retainedText);
  const textQuality = assessPolicyTextQuality(retainedText);
  if (!retainedText || retainedText.length > 2_000_000) {
    throw new Error("Official-document text is empty or exceeds the two-megabyte parser bound.");
  }
  if (!textQuality.accepted) {
    throw new Error(
      `Official-document text failed the legal-text quality gate (${textQuality.reason}).`,
    );
  }
  const spans = sentenceSpans(retainedText);
  const coordinate = input.contentHash.replace(/[^A-Za-z0-9]/gu, "").slice(-16) ||
    "retained";
  const sourceId = `official-source-${input.sourceId}-${coordinate}`.slice(0, 200);
  const documentVersionId =
    `official-document-${input.sourceId}-${coordinate}`.slice(0, 200);
  const passages: Passage[] = [];
  const claims: Claim[] = [];
  const claimIndex = new Map<string, number>();
  const addClaim = (
    predicate: PolicyReviewClaimProjection["predicate"],
    span: TextSpan,
    label: string,
    qualification: string,
    typedValue: unknown,
    unresolvedCrossReferences: string[] = [],
    statementOverride?: string,
  ) => {
    const index = (claimIndex.get(predicate) ?? 0) + 1;
    claimIndex.set(predicate, index);
    const passageId =
      `official-passage-${input.sourceId}-${coordinate}-${predicate}-${index}`.slice(0, 200);
    const claimId =
      `official-claim-${input.sourceId}-${coordinate}-${predicate}-${index}`.slice(0, 200);
    passages.push({
      id: passageId,
      sourceId,
      documentVersionId,
      locator: provisionLocator(retainedText, span.start, label),
      exactText: span.text,
      startOffset: span.start,
      endOffset: span.end,
      qualification,
      unresolvedCrossReferences,
    });
    claims.push({
      id: claimId,
      eventId: input.eventId,
      predicate,
      typedValue,
      statement: statementOverride ?? span.text,
      scope: `${input.title}; ${input.documentVersionLabel ?? "retrieved official representation"}`,
      supportingPassageIds: [passageId],
      opposingPassageIds: [],
      supportStatus: "direct",
      reviewStatus: "unreviewed",
      criticalFor: ["screen-2-policy-briefing"],
    });
  };

  // Public laws frequently state their policy purpose in an opening
  // "To ..." clause. Retain that clause as orientation while keeping the
  // exact source text and operative provisions separate.
  const purposeSpans = spans.filter((span, index) => {
    const text = policyStatementCore(span.text);
    return index < 80 && text.length >= 35 && text.length <= 1_000 &&
      !isPolicyPageBoilerplateText(text) &&
      (/^to\s+(?:promote|provide|protect|establish|improve|prevent|require|authorize|amend|regulate|create|reduce|ensure|restore|reform)\b/iu
        .test(text) ||
        /\b(?:purpose|purposes|objective|objectives) of (?:this|the) (?:act|title|law)\b/iu
          .test(text));
  }).slice(0, 2);
  for (const span of purposeSpans) {
    const sourceText = policyStatementCore(span.text);
    const purpose = sourceText.replace(/^to\s+/iu, "")
      .replace(/[.:;—–-]+$/u, "").trim();
    const statement = /^to\s+/iu.test(sourceText)
      ? `${input.title} was enacted to ${purpose.charAt(0).toLocaleLowerCase("en-US")}${purpose.slice(1)}.`
      : cleanedBriefingStatement(sourceText);
    addClaim(
      "policy_explanation",
      span,
      "Stated policy purpose",
      "This official purpose clause provides high-level orientation; the operative provisions control the specific duties, coverage, and timing.",
      { nativeId: input.nativeId, purpose: span.text },
      [],
      statement,
    );
  }

  const obligations = boundedMatches(spans, (text) =>
    hasIndependentPolicyMeaning(text) &&
    /\b(?:requires?|must|shall|required to|prohibited from|may not|is entitled to|has the right to|duty to)\b/iu.test(text) &&
    !/\b(?:shall be effective|shall take effect|shall apply from|shall be enacted)\b/iu.test(text) &&
    !/\b(?:short title|may be cited|shall be cited|title shall be)\b/iu.test(text) &&
    !/\b(?:this (?:act|title|section|regulation|rule)|the requirements?)\s+shall\s+apply\s+to\b/iu.test(text) &&
    !/\b(?:shall not apply|does not apply)\b/iu.test(text) &&
    !/\b(?:as used in|for purposes of)\s+(?:this|the)\s+(?:act|title|section|part)\b.{0,120}\bdefinitions?\b/iu.test(text) &&
    !/\bshall be subject to\b.{0,100}\b(?:fine(?:s)?|penalt(?:y|ies))\b/iu.test(text),
  6);
  for (const span of obligations) addClaim(
    "operative_change",
    span,
    "Substantive obligation or right",
    "The passage supports this stated duty, prohibition, or right. It does not by itself establish every covered entity or the empirical treatment date.",
    {
      nativeId: input.nativeId,
      component: provisionLocator(retainedText, span.start, "unlabeled provision"),
      modality: /\bmay not|prohibited\b/iu.test(span.text)
        ? "prohibition"
        : /\b(?:is entitled to|has the right to)\b/iu.test(span.text)
          ? "right"
          : "obligation",
      text: span.text,
    },
  );

  const formalCoverage = boundedMatches(spans, statesFormalCoverage, 5);
  for (const span of formalCoverage) addClaim(
    "coverage_condition",
    span,
    "Formal applicability or entity condition",
    "This is a stated legal applicability condition; organization-level exposure still requires facts about each unit and the historically applicable version.",
    { nativeId: input.nativeId, condition: span.text, logicalStructure: /\bor\b/iu.test(span.text) ? "or_or_mixed" : /\band\b/iu.test(span.text) ? "and_or_mixed" : "single_or_unresolved" },
  );

  const territorial = boundedMatches(spans, (text) =>
    hasIndependentPolicyMeaning(text) &&
    /\b(?:(?:does|conducts?|doing) business in|established in|resident(?:s)? of|in this state|in (?:the )?European Union|within (?:the )?(?:state|territory|union|united states)|interstate or foreign commerce|links? to (?:the )?United Kingdom|targets? (?:residents|consumers)|offers? goods or services to|monitors? the behavior of)\b/iu.test(text),
  4);
  for (const span of territorial) addClaim(
    "territorial_nexus",
    span,
    "Territorial nexus",
    "The source states a territorial nexus; headquarters or incorporation alone is not treated as exposure.",
    { nativeId: input.nativeId, nexus: span.text },
  );

  const thresholds = boundedMatches(spans, (text) =>
    hasIndependentPolicyMeaning(text) &&
    /(?:[$€£]\s?[\d,.]+|\b\d[\d,.]*\s+(?:consumers?|households?|persons?|records?|employees?|kW|percent|per cent)\b)/iu.test(text) &&
    /\b(?:annual gross revenue|threshold|at least|or more|more than|fewer than|less than|not less than|exceeds?|minimum size)\b/iu.test(text) &&
    !/\b(?:penalt(?:y|ies)|fine(?:d|s)?|damages|imprison(?:ed|ment)|forfeit)\b/iu.test(text),
  5);
  for (const span of thresholds) addClaim(
    "threshold_condition",
    span,
    "Eligibility threshold",
    "Threshold logic is retained as stated. AND/OR structure and measurement period must be reviewed before classifying any organization.",
    { nativeId: input.nativeId, condition: span.text, logicalStructure: /\bor\b/iu.test(span.text) ? "or_or_mixed" : /\band\b/iu.test(span.text) ? "and_or_mixed" : "unresolved" },
  );

  const exemptions = boundedMatches(spans, statesExpressException, 5);
  for (const span of exemptions) addClaim(
    "exemption_rule",
    span,
    "Exemption or exclusion",
    "Only this express exception, exclusion, or non-applicability rule is supported; silence elsewhere is not evidence of no exemption.",
    { nativeId: input.nativeId, disposition: "express_exception_or_exclusion" },
  );

  const baseline = boundedMatches(spans, statesPriorPolicyBaseline, 4);
  for (const span of baseline) addClaim(
    "previous_baseline",
    span,
    "Documented prior rule or practice",
    "This supports only the stated prior rule or change relationship; it does not imply that no other prior regulation existed.",
    { nativeId: input.nativeId, relation: "stated_prior_or_amended_rule" },
  );

  const implementation = boundedMatches(spans, statesImplementationSchedule, 5);
  for (const span of implementation) {
    const dated = datedStages(span.text).find(({ kind }) =>
      kind === "compliance" || kind === "legal_effect");
    addClaim(
      "implementation_schedule",
      span,
      "Commencement or compliance schedule",
      "A commencement or compliance stage is distinct from enactment, publication, enforcement, and the researcher's eventual treatment clock.",
      {
        nativeId: input.nativeId,
        stage: "implementation_or_commencement",
        date: dated
          ? { ...dated.date, kind: dated.kind, passageIds: [] }
          : null,
        relativeRule: relativeSchedule(span.text),
        affectedProvisionOrGroup:
          affectedGroup(span.text, dated?.start ?? 0) ??
          provisionLocator(
            retainedText,
            span.start,
            "instrument-wide or unresolved",
          ),
      },
    );
    if (dated) {
      const claim = claims.at(-1)!;
      (claim.typedValue as { date: TypedDate }).date.passageIds = [
        claim.supportingPassageIds[0]!,
      ];
    }
  }

  const authorities = boundedMatches(spans, (text) =>
    hasIndependentPolicyMeaning(text) &&
    /\b(?:attorney general|district attorney|commission|secretary|supervisory authority|agency|prosecutor|court|CMS|OFCOM)\b/iu.test(text) &&
    /\b(?:shall|may|is authorized to|has authority to)\b.{0,160}\b(?:enforce|investigate|bring (?:a civil )?action|(?:assess|impose)\s+(?:an?\s+)?(?:(?:civil|administrative|criminal|monetary|money)\s+){0,3}(?:sanctions?|fines?|penalt(?:y|ies))|seek (?:an? )?(?:injunction|penalty|relief)|prosecute)\b/iu.test(text) &&
    !/\b(?:report|study|recommend|revise|promulgate|rulemaking)\b/iu.test(text),
  5);
  for (const span of authorities) addClaim(
    "enforcement_authority",
    span,
    "Enforcement authority",
    "The passage identifies an authority and an enforcement power; it does not establish every remedy or sanction.",
    { nativeId: input.nativeId, authorityText: span.text },
  );

  const remedies = boundedMatches(spans, (text) =>
    hasIndependentPolicyMeaning(text) &&
    /\b(?:injunctive relief|injunction|restitution|actual damages|statutory damages|private right of action|civil action|cease and desist|corrective order|equitable relief)\b/iu.test(text),
  5);
  for (const span of remedies) addClaim(
    "remedy",
    span,
    "Remedy",
    "The remedy is provision-specific and may have prerequisites or a limited valid period.",
    { nativeId: input.nativeId, remedyText: span.text },
  );

  const penalties = spans.flatMap((span, index) => {
    if (
      !hasIndependentPolicyMeaning(span.text) ||
      !/\b(?:penalt(?:y|ies)|fine(?:d|s)?|damages|imprison(?:ed|ment)|forfeit(?:ure)?)\b/iu
        .test(span.text) ||
      !/(?:[$€£]\s*[\d,]+|\b[\d,]+\s+(?:dollars?|euros?|pounds?|percent|per cent|years?|months?|times)\b|\b(?:shall|may)\s+(?:lay down|impose|assess)|\b(?:liable|punishable)\b)/iu
        .test(span.text)
    ) return [];
    const next = spans[index + 1];
    return [next &&
        /\b(?:cure|notice|opportunity to correct|within\s+\d+\s+days)\b/iu
          .test(next.text)
      ? {
          text: retainedText.slice(span.start, next.end),
          start: span.start,
          end: next.end,
        }
      : span];
  }).slice(0, 6);
  for (const span of penalties) addClaim(
    "penalty",
    span,
    "Penalty or sanction",
    "This sanction is retained with only the amount, unit, trigger, and qualification that the cited passage expressly states.",
    {
      nativeId: input.nativeId,
      sanctionType: /\bimprisonment\b/iu.test(span.text)
        ? "imprisonment"
        : /\b(?:damages)\b/iu.test(span.text)
          ? "damages"
          : /\b(?:fine(?:s)?|penalt(?:y|ies))\b/iu.test(span.text)
            ? "monetary_or_delegated_penalty"
            : "other_sanction",
      ...penaltyValue(span.text),
      validPeriod: dateValue(span.text),
    },
  );

  const stagedDates = spans.flatMap((span) => datedStages(span.text).map(
    (dated) => ({ span, dated }),
  )).slice(0, 12);
  for (const { span, dated } of stagedDates) {
    const kind = dated.kind;
    const value: TypedDate = {
      ...dated.date,
      kind,
      passageIds: [],
    };
    addClaim(
      kind === "legal_effect" ? "legal_effect_date" : "policy_date",
      span,
      `${kind.replaceAll("_", " ")} date`,
      "The legal stage is preserved separately and is not automatically the study intervention date.",
      {
        nativeId: input.nativeId,
        date: value,
        affectedProvisionOrGroup:
          affectedGroup(span.text, dated.start) ??
          provisionLocator(
            retainedText,
            span.start,
            "instrument-wide or unresolved",
          ),
      },
    );
    const passageId = claims.at(-1)!.supportingPassageIds[0]!;
    (claims.at(-1)!.typedValue as { date: TypedDate }).date.passageIds = [passageId];
  }

  if (!claims.some(({ predicate }) => predicate === "legal_effect_date")) {
    const relativeEffect = relativeEnactmentLegalEffectSpan(spans, retainedText);
    const sourceDate = input.publicationDate?.slice(0, 10) ?? null;
    const adoptionDate = matchingAdoptionDateSpan(spans, sourceDate);
    if (relativeEffect && adoptionDate && sourceDate) {
      const index = (claimIndex.get("legal_effect_date") ?? 0) + 1;
      claimIndex.set("legal_effect_date", index);
      const effectPassageId =
        `official-passage-effect-rule-${input.sourceId}-${coordinate}-${index}`
          .slice(0, 200);
      const datePassageId =
        `official-passage-effect-date-${input.sourceId}-${coordinate}-${index}`
          .slice(0, 200);
      const claimId =
        `official-claim-${input.sourceId}-${coordinate}-legal_effect_date-${index}`
          .slice(0, 200);
      const qualification =
        "The same official document expressly anchors applicability to enactment and records the matching approval date; this legal stage is not automatically the research treatment date.";
      passages.push({
        id: effectPassageId,
        sourceId,
        documentVersionId,
        locator: provisionLocator(
          retainedText,
          relativeEffect.start,
          "Relative legal-effect provision",
        ),
        exactText: relativeEffect.text,
        startOffset: relativeEffect.start,
        endOffset: relativeEffect.end,
        qualification,
        unresolvedCrossReferences: [],
      }, {
        id: datePassageId,
        sourceId,
        documentVersionId,
        locator: provisionLocator(
          retainedText,
          adoptionDate.start,
          "Official approval date",
        ),
        exactText: adoptionDate.text,
        startOffset: adoptionDate.start,
        endOffset: adoptionDate.end,
        qualification,
        unresolvedCrossReferences: [],
      });
      const date: TypedDate = {
        start: sourceDate,
        end: null,
        precision: "day",
        kind: "legal_effect",
        passageIds: [effectPassageId, datePassageId],
      };
      claims.push({
        id: claimId,
        eventId: input.eventId,
        predicate: "legal_effect_date",
        typedValue: {
          nativeId: input.nativeId,
          date,
          affectedProvisionOrGroup: provisionLocator(
            retainedText,
            relativeEffect.start,
            "instrument-wide or unresolved",
          ),
          relativeAnchor: "date_of_enactment",
        },
        statement: `${relativeEffect.text} ${adoptionDate.text}`,
        scope: `${input.title}; ${input.documentVersionLabel ?? "retrieved official representation"}`,
        supportingPassageIds: [effectPassageId, datePassageId],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2-policy-briefing"],
      });
    }
  }

  const idsFor = (...predicates: string[]) => claims.filter(({ predicate }) =>
    predicates.includes(predicate)).map(({ id }) => id);
  const searched = new Set(input.searchedRequirementKinds ??
    POLICY_EVIDENCE_REQUIREMENT_KINDS);
  const missingStatus = input.missingRequirementStatus ?? "searched_not_found";
  const statusFor = (
    kind: PolicyEvidenceRequirementKind,
    claimIds: string[],
    partial = false,
  ): EvidenceRequirement["status"] => claimIds.length
    ? partial ? "partially_supported" : "supported"
    : searched.has(kind) ? missingStatus : "not_yet_searched";
  const coverageIds = idsFor(
    "coverage_condition", "territorial_nexus", "threshold_condition",
  );
  const coverageSubrequirements = [
    ["entity-activity", "Entity or activity condition", idsFor("coverage_condition")],
    ["territorial-nexus", "Territorial nexus", idsFor("territorial_nexus")],
    ["threshold-logic", "Threshold and AND/OR logic", idsFor("threshold_condition")],
  ] as const;
  const enforcementIds = idsFor("enforcement_authority", "remedy");
  const claimIdsByKind = new Map<PolicyEvidenceRequirementKind, string[]>([
    ["operative_change", idsFor("operative_change")],
    ["previous_baseline", idsFor("previous_baseline")],
    ["coverage", coverageIds],
    ["exemption", idsFor("exemption_rule")],
    ["temporal_stage", idsFor("legal_effect_date")],
    ["version", idsFor("historical_version_change")],
    ["implementation", idsFor("implementation_schedule")],
    ["enforcement", enforcementIds],
    ["penalty", idsFor("penalty")],
  ]);
  const requirements: EvidenceRequirement[] = POLICY_REQUIREMENT_DEFINITIONS.map(
    (definition) => {
      const supportingClaimIds = claimIdsByKind.get(definition.kind) ?? [];
      const partial = definition.kind === "coverage"
        ? coverageSubrequirements.filter(([, , ids]) => ids.length).length < 3
        : definition.kind === "enforcement"
          ? !idsFor("enforcement_authority").length || !idsFor("remedy").length
          : definition.kind === "penalty"
            ? claims.filter(({ predicate }) => predicate === "penalty")
              .every(({ typedValue }) => {
                const value = typedValue as {
                  amounts?: number[];
                  amount?: number | null;
                };
                return !value.amounts?.length && value.amount === null;
              })
          : false;
      return {
        id: `official-requirement-${input.sourceId}-${definition.kind}`.slice(0, 200),
        kind: definition.kind,
        description: definition.description,
        status: statusFor(definition.kind, supportingClaimIds, partial),
        criticality: definition.criticality,
        supportingClaimIds,
        ...(definition.kind === "coverage"
          ? {
              subrequirements: coverageSubrequirements.map(([id, label, ids]) => ({
                id: `official-${input.sourceId}-coverage-${id}`.slice(0, 200),
                label,
                status: statusFor("coverage", [...ids]),
                supportingClaimIds: [...ids],
              })),
            }
          : {}),
      };
    },
  );
  const legalVersionDates = claims.flatMap((claim): TypedDate[] => {
    if (claim.predicate !== "legal_effect_date" && claim.predicate !== "policy_date") {
      return [];
    }
    const value = claim.typedValue as { date?: TypedDate };
    return value.date ? [structuredClone(value.date)] : [];
  });
  const parserVersion = "official-document-structured-policy-v8";
  const collection: EvidenceCollection = {
    sources: [{
      id: sourceId,
      provider: input.provider,
      nativeId: input.nativeId ?? input.sourceId,
      canonicalUrl: input.canonicalUrl,
      publisher: input.publisher,
      issuer: input.issuer,
      author: null,
      jurisdiction: input.jurisdiction,
      role: input.sourceRole ?? (input.acquisitionProvenance === "direct"
        ? "direct official policy representation acquired for Screen 2"
        : "reviewed source description retained at identity resolution; not original document bytes"),
      documentType: "official policy document",
      language: "en",
      publicationDate: input.publicationDate,
      legalVersionDates,
      retrievedAt: input.retrievedAt,
      documentVersionId,
      contentHash: input.contentHash,
      acquisitionProvenance: input.acquisitionProvenance ?? "third_party",
      accessStatus: input.inspectedText === "full" ? "parsed_text" : "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion,
      textQualityStatus: input.inspectedText === "full"
        ? "bounded full representation parsed by independent fact category"
        : "partial retained text; omissions remain not-yet-established",
      inspectedText: input.inspectedText ?? "partial",
    }],
    documentVersions: [{
      id: documentVersionId,
      sourceId,
      representation: input.representation ?? "retained-official-text",
      language: "en",
      versionLabel: input.documentVersionLabel ??
        "Official-document text retained at identity resolution",
      retrievedAt: input.retrievedAt,
      contentHash: input.contentHash,
      parserVersion,
      parsedTextLength: retainedText.length,
    }],
    passages,
    claims,
    conflicts: [],
    requirements,
  };
  validateEvidenceCollection(
    collection,
    new Map([[documentVersionId, retainedText]]),
  );
  const unresolved = requirements
    .filter(({ status }) => status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  return {
    collection,
    projections: projectPolicyEvidenceClaims(collection),
    unresolved,
    status: unresolved.length ? "partial" : "ready",
  };
}

/** Deterministic focused parser for one saved evidence-plan step. */
export function parseFederalRegisterPolicyEvidence(
  input: FederalRegisterPolicyEvidenceInput,
): ParsedFederalRegisterPolicyEvidence {
  const source = federalRegisterPolicySource(input.sourceProvider);
  const parsedText = normalizePolicyEvidenceText(input.parsedText);
  const quality = assessPolicyTextQuality(parsedText);
  if (!quality.accepted) {
    throw new Error(
      `Federal Register text failed the legal-text quality gate (${quality.reason}).`,
    );
  }
  const spans = sentenceSpans(parsedText);
  const core = [
    {
      predicate: "operative_change" as const,
      span: operativeSpan(spans),
      locator: "Operative change",
      qualification: null,
    },
    {
      predicate: "legal_effect_date" as const,
      span: effectiveSpan(spans),
      locator: "DATES — legal effect",
      qualification:
        "Legal effectiveness does not establish when every regulated market implemented the tariff changes.",
    },
    {
      predicate: "implementation_schedule" as const,
      span: implementationSpan(spans, parsedText),
      locator: "Compliance and implementation schedule",
      qualification:
        "This schedule is anchored to filing and implementation steps after publication; it is not the rule's legal-effective date or proof of one uniform market treatment date.",
    },
  ];
  const coverage = [
    {
      predicate: "coverage_condition" as const,
      span: coverageSpan(spans),
      locator: "Formal coverage condition",
      qualification:
        "This passage states a formal coverage condition; it does not establish which units in the researcher's sample satisfy that condition.",
    },
    {
      predicate: "exemption_rule" as const,
      span: exemptionSpan(spans),
      locator: "Exemption or non-exemption provision",
      qualification:
        "This passage retains an explicit exemption or non-exemption rule; sample-level exposure still requires the complete applicable provisions.",
    },
  ];
  const enforcement = [
    {
      predicate: "enforcement_authority" as const,
      span: enforcementSpan(spans),
      locator: "Enforcement authority or remedy",
      qualification:
        "The passage must identify both an authority and an enforcement power; a generic use of the word enforcement is not enough.",
    },
    {
      predicate: "penalty" as const,
      span: penaltySpan(spans),
      locator: "Penalty or sanction",
      qualification:
        "Only the stated amount, unit, trigger, and qualification are retained; sanctions are not assumed to apply instrument-wide.",
    },
  ];
  // Each focused step inspects the complete exact representation. Retain
  // supported facts from earlier plan stages when a later exact-record step
  // succeeds so a transient source failure cannot make already-inspected
  // operative or coverage text disappear. Future stages remain untouched,
  // and absent facts are never inferred from another focus.
  const selected = input.focus === "core"
    ? core
    : input.focus === "coverage_exemptions"
      ? [...core, ...coverage]
      : [...core, ...coverage, ...enforcement];
  const contentCoordinate = input.contentHash.slice(-12);
  const sourceId =
    `${source.idPrefix}-source-${input.documentNumber}-${input.representation}-${contentCoordinate}`;
  const documentVersionId =
    `${source.idPrefix}-document-${input.documentNumber}-${input.representation}-${contentCoordinate}`;
  const legalEditionSourceId = `govinfo-source-${input.documentNumber}`;
  const legalEditionDocumentId = `govinfo-document-${input.documentNumber}`;
  const passages: Passage[] = [];
  const claims: Claim[] = [];
  for (const value of selected) {
    if (!value.span) continue;
    const passageId =
      `${source.idPrefix}-passage-${input.documentNumber}-${contentCoordinate}-${value.predicate}`;
    const claimId =
      `${source.idPrefix}-claim-${input.documentNumber}-${contentCoordinate}-${value.predicate}`;
    const typedValue = value.predicate === "legal_effect_date"
      ? { date: effectiveDate(value.span.text), stage: "legal_effect" }
      : value.predicate === "implementation_schedule"
        ? implementationSchedule(value.span.text)
        : value.predicate === "coverage_condition"
          ? {
              documentNumber: input.documentNumber,
              status: "stated_formal_coverage_condition",
            }
          : value.predicate === "exemption_rule"
            ? {
                documentNumber: input.documentNumber,
                disposition: /\b(?:does\s+not|not)\s+exempt\b/iu.test(value.span.text)
                  ? "not_exempt"
                  : "stated_exemption_or_exception",
              }
            : value.predicate === "enforcement_authority"
              ? {
                  documentNumber: input.documentNumber,
                  authorityText: value.span.text,
                }
              : value.predicate === "penalty"
                ? {
                    documentNumber: input.documentNumber,
                    ...penaltyValue(value.span.text),
                  }
            : { documentNumber: input.documentNumber, stage: "operative_text" };
    passages.push({
      id: passageId,
      sourceId,
      documentVersionId,
      locator: value.locator,
      exactText: value.span.text,
      startOffset: value.span.start,
      endOffset: value.span.end,
      qualification: value.qualification,
      unresolvedCrossReferences: [],
    });
    claims.push({
      id: claimId,
      eventId: input.eventId,
      predicate: value.predicate,
      typedValue,
      statement: value.span.text,
      scope: `Federal Register document ${input.documentNumber}`,
      supportingPassageIds: [passageId],
      opposingPassageIds: [],
      supportStatus: "direct",
      reviewStatus: "unreviewed",
      criticalFor: ["screen-2"],
    });
  }
  const passageByPredicate = new Map(
    selected.flatMap(({ predicate, span }) => span
      ? [[predicate, passages.find(({ id }) => id.endsWith(predicate))!]] as const
      : []),
  );
  const claimByPredicate = new Map(
    claims.map((claim) => [claim.predicate, claim]),
  );
  const effectivePassage = passageByPredicate.get("legal_effect_date");
  const legalVersionDates: TypedDate[] = effectivePassage
    ? [{
        start: effectiveDate(effectivePassage.exactText),
        end: null,
        precision: effectiveDate(effectivePassage.exactText) ? "day" : "unknown",
        kind: "legal_effect",
        passageIds: [effectivePassage.id],
      }]
    : [];
  const searchedKinds = new Set<PolicyEvidenceRequirementKind>(
    input.focus === "core"
      ? POLICY_EVIDENCE_CORE_KINDS
      : input.focus === "coverage_exemptions"
        ? POLICY_EVIDENCE_COVERAGE_KINDS
        : POLICY_EVIDENCE_ENFORCEMENT_KINDS,
  );
  const requirements: EvidenceRequirement[] = POLICY_REQUIREMENT_DEFINITIONS.map((value) => {
    const claim = value.predicate
      ? claimByPredicate.get(value.predicate)
      : undefined;
    return {
      id: `fr-requirement-${input.documentNumber}-${value.kind}`,
      kind: value.kind,
      description: value.description,
      status: claim
        ? "supported"
        : searchedKinds.has(value.kind)
          ? "searched_not_found"
          : "not_yet_searched",
      criticality: value.criticality,
      supportingClaimIds: claim ? [claim.id] : [],
    };
  });
  const collection: EvidenceCollection = {
    sources: [
      {
        id: sourceId,
        provider: source.provider,
        nativeId: input.documentNumber,
        canonicalUrl: input.canonicalUrl,
        publisher: source.publisher,
        issuer: input.issuer,
        author: null,
        jurisdiction: "United States",
        role: source.role,
        documentType: "administrative rule",
        language: "en",
        publicationDate: input.publicationDate,
        legalVersionDates,
        retrievedAt: input.retrievedAt,
        documentVersionId,
        contentHash: input.contentHash,
        acquisitionProvenance: "direct",
        accessStatus: "retained_passage",
        rightsStatus: "public-government-record",
        parserVersion: FEDERAL_REGISTER_POLICY_PARSER_VERSION,
        textQualityStatus: "visible-text parsed; exact retained spans",
        inspectedText: "full",
      },
      ...(input.legalEditionUrl && source.provider !== "govinfo"
        ? [{
            id: legalEditionSourceId,
            provider: "govinfo",
            nativeId: input.documentNumber,
            canonicalUrl: input.legalEditionUrl,
            publisher: "U.S. Government Publishing Office",
            issuer: input.issuer,
            author: null,
            jurisdiction: "United States",
            role:
              "controlling Federal Register legal-edition locator; not retrieved in this slice",
            documentType: "official publication",
            language: "en",
            publicationDate: input.publicationDate,
            legalVersionDates: [],
            retrievedAt: input.retrievedAt,
            documentVersionId: legalEditionDocumentId,
            contentHash: null,
            acquisitionProvenance: "direct" as const,
            accessStatus: "available_metadata" as const,
            rightsStatus: "public-government-record",
            parserVersion: null,
            textQualityStatus: "locator retained; content not inspected",
            inspectedText: "metadata_only" as const,
          }]
        : []),
    ],
    documentVersions: [
      {
        id: documentVersionId,
        sourceId,
        representation: input.representation,
        language: "en",
        versionLabel: `${source.versionLabel} for FR Doc. ${input.documentNumber}`,
        retrievedAt: input.retrievedAt,
        contentHash: input.contentHash,
        parserVersion: FEDERAL_REGISTER_POLICY_PARSER_VERSION,
        parsedTextLength: parsedText.length,
      },
      ...(input.legalEditionUrl && source.provider !== "govinfo"
        ? [{
            id: legalEditionDocumentId,
            sourceId: legalEditionSourceId,
            representation: "pdf-locator",
            language: "en",
            versionLabel: "Federal Register legal edition",
            retrievedAt: input.retrievedAt,
            contentHash: null,
            parserVersion: null,
            parsedTextLength: null,
          }]
        : []),
    ],
    passages,
    claims,
    conflicts: [],
    requirements,
  };
  validateEvidenceCollection(
    collection,
    new Map([[documentVersionId, parsedText]]),
  );
  const unresolved = requirements
    .filter(({ kind, status }) => searchedKinds.has(
      kind as PolicyEvidenceRequirementKind,
    ) && status !== "supported")
    .map(({ kind }) => kind);
  return {
    collection,
    projections: claims.map((claim) => projection(
      claim,
      passages.find(({ id }) => id === claim.supportingPassageIds[0])!,
      input,
    )),
    unresolved,
    status: unresolved.length ? "partial" : "ready",
  };
}

function unionById<T extends { id: string }>(
  previous: readonly T[],
  next: readonly T[],
) {
  const values = new Map(previous.map((value) => [value.id, value]));
  for (const value of next) if (!values.has(value.id)) values.set(value.id, value);
  return [...values.values()].map((value) => structuredClone(value));
}

function detectedLegalEffectConflicts(
  collection: EvidenceCollection,
) {
  const passageById = new Map(
    collection.passages.map((passage) => [passage.id, passage]),
  );
  const sourceById = new Map(
    collection.sources.map((source) => [source.id, source]),
  );
  const groups = new Map<string, Claim[]>();
  for (const claim of collection.claims) {
    if (claim.predicate !== "legal_effect_date" ||
        !claim.typedValue || typeof claim.typedValue !== "object" ||
        Array.isArray(claim.typedValue)) continue;
    const typedValue = claim.typedValue as Record<string, unknown>;
    if (!typedValue.date || typeof typedValue.date !== "object" ||
        Array.isArray(typedValue.date)) continue;
    const date = typedValue.date as Partial<TypedDate>;
    if (date.kind !== "legal_effect") continue;
    const affected = typeof typedValue.affectedProvisionOrGroup === "string"
      ? typedValue.affectedProvisionOrGroup.toLocaleLowerCase("en-US")
        .replace(/\s+/gu, " ").trim()
      : "instrument-wide or unresolved";
    const key = `${claim.eventId}|${date.kind}|${affected}`;
    const values = groups.get(key) ?? [];
    values.push(claim);
    groups.set(key, values);
  }
  return [...groups.entries()].flatMap(([key, claims]) => {
    const valueFingerprints = new Set(claims.map((claim) => {
      const typed = claim.typedValue as { date: TypedDate };
      return fingerprintSixScreenValue({
        start: typed.date.start,
        end: typed.date.end,
        precision: typed.date.precision,
      });
    }));
    const sourceIds = new Set(claims.flatMap((claim) =>
      claim.supportingPassageIds.map((passageId) =>
        passageById.get(passageId)?.sourceId).filter(Boolean)));
    if (valueFingerprints.size < 2 || sourceIds.size < 2) return [];
    const ordered = [...claims].sort((left, right) =>
      left.id.localeCompare(right.id));
    const coordinate = fingerprintSixScreenValue({
      key,
      claimIds: ordered.map(({ id }) => id),
    }).replace("fnv1a64:", "");
    return [{
      id: `policy-date-conflict-${coordinate}`,
      eventId: ordered[0]!.eventId,
      predicate: "legal_effect_date",
      claimIds: ordered.map(({ id }) => id),
      competingValues: ordered.map(({ typedValue }) =>
        structuredClone(typedValue)),
      scopes: ordered.map(({ scope }) => scope),
      sourceRoles: ordered.map((claim) => {
        const passage = passageById.get(claim.supportingPassageIds[0] ?? "");
        return sourceById.get(passage?.sourceId ?? "")?.role ??
          "source role unavailable";
      }),
      kind: "stage_or_version" as const,
      resolution: null,
      reviewStatus: "unreviewed" as const,
    }];
  });
}

export function mergePolicyEvidenceCollections(input: {
  previous: EvidenceCollection | null;
  next: EvidenceCollection;
  searchedKinds: readonly PolicyEvidenceRequirementKind[];
}) {
  if (!input.previous) return validateEvidenceCollection(input.next);
  const searched = new Set(input.searchedKinds);
  const requirementByKind = new Map(
    input.previous.requirements.map((requirement) =>
      [requirement.kind, structuredClone(requirement)]),
  );
  const rank: Record<EvidenceRequirement["status"], number> = {
    conflicting: 90,
    supported: 80,
    partially_supported: 70,
    source_unavailable: 60,
    inaccessible: 55,
    unparsed: 50,
    unsupported_route: 45,
    searched_not_found: 40,
    not_found: 35,
    not_applicable: 30,
    not_yet_searched: 0,
  };
  for (const requirement of input.next.requirements) {
    if (
      !searched.has(requirement.kind as PolicyEvidenceRequirementKind) &&
      requirement.status !== "supported"
    ) continue;
    const previous = requirementByKind.get(requirement.kind);
    if (!previous) {
      requirementByKind.set(requirement.kind, structuredClone(requirement));
      continue;
    }
    const preferred = rank[requirement.status] > rank[previous.status]
      ? requirement
      : previous;
    const subrequirements = new Map(
      (previous.subrequirements ?? []).map((value) => [value.label, value]),
    );
    for (const value of requirement.subrequirements ?? []) {
      const prior = subrequirements.get(value.label);
      subrequirements.set(value.label, !prior || rank[value.status] > rank[prior.status]
        ? value
        : {
            ...prior,
            supportingClaimIds: [...new Set([
              ...prior.supportingClaimIds,
              ...value.supportingClaimIds,
            ])],
          });
    }
    requirementByKind.set(requirement.kind, {
      ...structuredClone(preferred),
      supportingClaimIds: [...new Set([
        ...previous.supportingClaimIds,
        ...requirement.supportingClaimIds,
      ])],
      ...(subrequirements.size
        ? { subrequirements: [...subrequirements.values()].map((value) =>
            structuredClone(value)) }
        : {}),
    });
  }
  const collection: EvidenceCollection = {
    sources: unionById(input.previous.sources, input.next.sources),
    documentVersions: unionById(
      input.previous.documentVersions,
      input.next.documentVersions,
    ),
    passages: unionById(input.previous.passages, input.next.passages),
    claims: unionById(input.previous.claims, input.next.claims),
    conflicts: unionById(input.previous.conflicts, input.next.conflicts),
    requirements: POLICY_EVIDENCE_REQUIREMENT_KINDS.map((kind) => {
      const requirement = requirementByKind.get(kind);
      if (!requirement) {
        throw new Error(`Policy evidence collection omitted ${kind}.`);
      }
      return structuredClone(requirement);
    }),
  };
  const detectedConflicts = detectedLegalEffectConflicts(collection);
  if (detectedConflicts.length) {
    collection.conflicts = unionById(collection.conflicts, detectedConflicts);
    const conflictedClaimIds = new Set(
      detectedConflicts.flatMap(({ claimIds }) => claimIds),
    );
    for (const claim of collection.claims) {
      if (!conflictedClaimIds.has(claim.id)) continue;
      const opposing = collection.claims.filter((candidate) =>
        candidate.id !== claim.id && conflictedClaimIds.has(candidate.id))
        .flatMap(({ supportingPassageIds }) => supportingPassageIds);
      claim.supportStatus = "conflicting";
      claim.opposingPassageIds = [...new Set([
        ...claim.opposingPassageIds,
        ...opposing,
      ])];
    }
    const temporal = collection.requirements.find(({ kind }) =>
      kind === "temporal_stage");
    if (temporal) {
      temporal.status = "conflicting";
      temporal.supportingClaimIds = [...new Set([
        ...temporal.supportingClaimIds,
        ...conflictedClaimIds,
      ])];
    }
  }
  return validateEvidenceCollection(collection);
}

const POLICY_PROJECTION_PREDICATES = new Set<
  PolicyReviewClaimProjection["predicate"]
>([
  "policy_explanation",
  "operative_change",
  "substantive_obligation",
  "legal_effect_date",
  "policy_date",
  "implementation_schedule",
  "coverage_condition",
  "territorial_nexus",
  "threshold_condition",
  "exemption_rule",
  "enforcement_authority",
  "remedy",
  "penalty",
  "previous_baseline",
  "historical_version_change",
  "contemporaneous_amendment_record",
]);

export function projectPolicyEvidenceClaims(collection: EvidenceCollection) {
  validateEvidenceCollection(collection);
  const passageById = new Map(collection.passages.map((value) => [value.id, value]));
  const documentById = new Map(
    collection.documentVersions.map((value) => [value.id, value]),
  );
  const sourceById = new Map(collection.sources.map((value) => [value.id, value]));
  return collection.claims.flatMap((claim): PolicyReviewClaimProjection[] => {
    if (!POLICY_PROJECTION_PREDICATES.has(
      claim.predicate as PolicyReviewClaimProjection["predicate"],
    )) return [];
    const passage = passageById.get(claim.supportingPassageIds[0] ?? "");
    const document = passage
      ? documentById.get(passage.documentVersionId)
      : undefined;
    const source = document ? sourceById.get(document.sourceId) : undefined;
    if (!passage || !document || !source) return [];
    return [{
      claimId: claim.id,
      predicate: claim.predicate as PolicyReviewClaimProjection["predicate"],
      statement: claim.statement,
      typedValue: structuredClone(claim.typedValue),
      supportStatus: claim.supportStatus,
      qualification: passage.qualification,
      citation: {
        passageId: passage.id,
        exactText: passage.exactText,
        locator: passage.locator,
        documentVersionId: document.id,
        sourceId: source.id,
        sourceTitle: source.publisher,
        provider: source.provider,
        canonicalUrl: source.canonicalUrl,
        sourceRole: source.role,
        documentType: source.documentType,
        author: source.author,
        publicationDate: source.publicationDate,
        versionLabel: document.versionLabel,
        inspectedText: source.inspectedText,
      },
    }];
  });
}

function uniqueClaimStatements(
  claims: readonly PolicyReviewClaimProjection[],
  predicates: readonly PolicyReviewClaimProjection["predicate"][],
) {
  const accepted = new Set(predicates);
  const values: PolicyReviewClaimProjection[] = [];
  for (const claim of claims) {
    if (!accepted.has(claim.predicate)) continue;
    const key = normalizedBriefingText(cleanedBriefingStatement(claim.statement));
    if (!key || values.some((candidate) =>
      candidate.predicate === claim.predicate &&
      normalizedBriefingText(cleanedBriefingStatement(candidate.statement)) === key
    )) continue;
    values.push(claim);
  }
  return values;
}

function normalizedBriefingText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function focusBriefingStatement(value: string) {
  let text = policyStatementCore(value);
  text = text.replace(
    /^(?:(?:sec(?:tion)?\.?)\s+(?:\d+[A-Za-z]?)(?:\([^)]+\))*\s*[.—–:-]\s*)+/iu,
    "",
  );
  const amendatoryPrefix = /^.{1,180}?\bis amended by\b[^:]{0,260}:\s*["“]?\s*(?:\([0-9ivxlcdm]+\)\s*)?/iu;
  if (amendatoryPrefix.test(text)) text = text.replace(amendatoryPrefix, "");
  text = text.replace(
    /^(?:as used in|for purposes of)\s+(?:this|the)\s+(?:act|title|section|part)\b[^:]{0,180}\bfollowing definitions?\s+shall apply\s*:\s*(?=\S)/iu,
    "",
  ).replace(/^["“]\s*/u, "").replace(/\s*["”]\s*$/u, "").trim();
  return cleanPolicyPresentationText(text);
}

function cleanedBriefingStatement(value: string) {
  const cleaned = focusBriefingStatement(value)
    .replace(
      /^(?:summary|dates?|effective date|compliance dates?)\s*:\s*/iu,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();
  if (!cleaned || /[.!?][\]"')]*$/u.test(cleaned)) return cleaned;
  if (/(?:[:;,]|[—–-])$/u.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}

function uniqueBriefingFacts(
  claims: readonly PolicyReviewClaimProjection[],
) {
  const facts = new Map<string, { text: string; claimIds: string[] }>();
  for (const { claimId, statement } of claims) {
    const cleaned = cleanedBriefingStatement(statement);
    const key = normalizedBriefingText(cleaned);
    if (!key) continue;
    const existing = facts.get(key);
    if (existing) {
      existing.claimIds.push(claimId);
      continue;
    }
    facts.set(key, { text: cleaned, claimIds: [claimId] });
  }
  return [...facts.values()];
}

function boundedOverview(
  facts: readonly { text: string; claimIds: string[] }[],
  maximumWords = 150,
) {
  const selected: typeof facts[number][] = [];
  let words = 0;
  for (const fact of facts) {
    const factWords = fact.text.trim().split(/\s+/u).length;
    if (factWords > 80 || words + factWords > maximumWords) {
      continue;
    }
    selected.push(fact);
    words += factWords;
  }
  return {
    text: selected.map(({ text }) => text).join(" "),
    claimIds: [...new Set(selected.flatMap(({ claimIds }) => claimIds))],
  };
}

function overviewClause(value: string) {
  return /^[A-Z][a-z]/u.test(value)
    ? value.charAt(0).toLocaleLowerCase("en-US") + value.slice(1)
    : value;
}

function timelineAffectedGroup(claim: PolicyReviewClaimProjection) {
  if (!claim.typedValue || typeof claim.typedValue !== "object" ||
      Array.isArray(claim.typedValue)) return "";
  const value = claim.typedValue as Record<string, unknown>;
  return typeof value.affectedProvisionOrGroup === "string"
    ? normalizedBriefingText(value.affectedProvisionOrGroup)
    : "";
}

function timelinePriority(kind: TypedDate["kind"]) {
  const order: Partial<Record<TypedDate["kind"], number>> = {
    adoption: 0,
    publication: 1,
    scheduled_effect: 2,
    legal_effect: 3,
    compliance: 4,
    implementation: 5,
    enforcement: 6,
    amendment: 7,
    injunction: 8,
    invalidation: 9,
    withdrawal: 10,
    suspension: 11,
    repeal: 12,
    supersession: 13,
  };
  return order[kind] ?? 10;
}

function timelineLabel(kind: TypedDate["kind"]) {
  const labels: Partial<Record<TypedDate["kind"], string>> = {
    announcement: "Announced",
    adoption: "Law adopted",
    publication: "Published",
    scheduled_effect: "Scheduled to take effect",
    legal_effect: "Requirements take effect",
    compliance: "Compliance begins",
    implementation: "Implemented",
    enforcement: "Enforcement begins",
    amendment: "Amended",
    injunction: "Stayed or enjoined",
    invalidation: "Invalidated or vacated",
    withdrawal: "Withdrawn",
    suspension: "Suspended",
    repeal: "Repealed",
    supersession: "Superseded",
  };
  return labels[kind] ?? kind.replaceAll("_", " ");
}

function questionLikeStatement(value: string) {
  return /\?\s*$/u.test(value) ||
    /^(?:can|could|do|does|did|how|is|are|may|should|was|were|what|when|where|which|who|why|will|would)\b/iu
      .test(value);
}

function leadingSubclauseFragment(value: string) {
  const text = value.replace(/^[\s([{"']+/u, "").trim();
  return /^(?:and|but|or|that|which|who|whose)\b(?:\s|,)/iu.test(text);
}

function coherentBriefingClaim(claim: PolicyReviewClaimProjection) {
  const statement = cleanedBriefingStatement(claim.statement);
  return Boolean(statement) && isCompletePolicyPresentationSentence(statement) &&
    hasIndependentPolicyMeaning(statement) &&
    !questionLikeStatement(statement) && !leadingSubclauseFragment(statement);
}

function establishesEnforcementAuthority(
  claim: PolicyReviewClaimProjection,
) {
  if (claim.predicate !== "enforcement_authority") return true;
  const text = normalizedBriefingText(claim.statement);
  const adviceOnly = /\b(?:may|can) (?:request|seek|obtain) (?:(?:an?|the) )?(?:advice|guidance|opinion)\b/u
    .test(text);
  const enforcementAct = /\b(?:administer|authority to|bring (?:a )?(?:civil )?action|commence|enforce|enforcement|investigat|institute|impose|prosecut|seek (?:an? )?injunction)\w*\b/u
    .test(text);
  return !adviceOnly || enforcementAct;
}

function timelineStatement(
  claim: PolicyReviewClaimProjection,
  date: TypedDate,
) {
  const rawGroup = timelineAffectedGroup(claim);
  const group = rawGroup && rawGroup.length <= 90 &&
      !/^(?:instrument[\s-]+wide(?:\s+or\s+unresolved)?|unresolved|unlabeled\s+provision)$/iu
        .test(rawGroup)
    ? ` for ${rawGroup.replace(/[.:;—–-]+$/u, "").trim()}`
    : "";
  const statements: Partial<Record<TypedDate["kind"], string>> = {
    initiation: "The policy process began.",
    announcement: "The policy was announced.",
    adoption: "The policy was enacted or formally adopted.",
    publication: "The official policy text was published.",
    scheduled_effect: `The policy was scheduled to take effect${group}.`,
    legal_effect: `The cited provisions took legal effect${group}.`,
    compliance: `Compliance began${group}.`,
    implementation: `Implementation began${group}.`,
    enforcement: `Enforcement began${group}.`,
    amendment: `The policy was amended${group}.`,
    injunction: `The cited provisions were stayed or enjoined${group}.`,
    invalidation: `The cited provisions were invalidated or vacated${group}.`,
    withdrawal: `The policy was withdrawn${group}.`,
    suspension: `The cited provisions were suspended${group}.`,
    repeal: `The cited provisions were repealed${group}.`,
    supersession: `The cited provisions were superseded${group}.`,
  };
  return statements[date.kind] ?? `${timelineLabel(date.kind)}.`;
}

function briefingDate(claim: PolicyReviewClaimProjection): TypedDate | null {
  if (!claim.typedValue || typeof claim.typedValue !== "object" ||
      Array.isArray(claim.typedValue)) return null;
  const value = claim.typedValue as Record<string, unknown>;
  if (value.date && typeof value.date === "object" &&
      !Array.isArray(value.date)) {
    const date = value.date as Partial<TypedDate>;
    if (
      (typeof date.start === "string" || date.start === null) &&
      (typeof date.end === "string" || date.end === null) &&
      typeof date.precision === "string" && typeof date.kind === "string"
    ) return structuredClone(date as TypedDate);
  }
  if (typeof value.date === "string") {
    const stage = value.stage === "legal_effect" ? "legal_effect" : "other";
    return {
      start: value.date,
      end: null,
      precision: typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/u
          .test(value.date)
        ? "day"
        : typeof value.date === "string" && /^\d{4}$/u.test(value.date)
          ? "year"
          : "unknown",
      kind: stage,
      passageIds: [claim.citation.passageId],
    };
  }
  return null;
}

function isOperationalImplementationDuty(
  claim: PolicyReviewClaimProjection,
) {
  if (claim.predicate !== "implementation_schedule") return false;
  const text = normalizedBriefingText(claim.statement);
  if (!text) return false;
  const date = briefingDate(claim);
  if (date?.start) return false;
  const value = claim.typedValue && typeof claim.typedValue === "object" &&
      !Array.isArray(claim.typedValue)
    ? claim.typedValue as Record<string, unknown>
    : {};
  const relative = value.relativeRule && typeof value.relativeRule === "object" &&
      !Array.isArray(value.relativeRule)
    ? value.relativeRule as Record<string, unknown>
    : {};
  const anchor = typeof relative.anchorText === "string"
    ? normalizedBriefingText(relative.anchorText)
    : "";
  if (/\b(?:enactment|publication|effective date|promulgation|filing deadline)\b/u
      .test(`${anchor} ${text}`)) return false;
  return (
    /\b(?:consumer|customer|applicant|complainant|data subject)\b/u.test(text) &&
    /\b(?:request|application|complaint|receipt|receiv|respond|disclose|deliver|delete|provide)\w*\b/u
      .test(text)
  ) ||
    /\b(?:on|upon|after|following) (?:each |a |the )?(?:request|application|complaint|receipt)\b/u
      .test(text) ||
    /\b(?:homepage|web page|website)\b/u.test(text);
}

function plainBriefingLabel(value: string) {
  const key = normalizedBriefingText(value);
  const labels: Readonly<Record<string, string>> = {
    "prior baseline": "Before this policy",
    "new requirement": "What the policy changed",
    "operative change": "What the policy changed",
    exemption: "Who or what is not covered",
    exception: "Who or what is not covered",
    "exception or exclusion": "Who or what is not covered",
    "covered entity or activity": "Who or what is covered",
    "coverage condition": "Who or what is covered",
    "qualifying threshold": "Who meets the threshold",
    "territorial nexus": "Where it applies",
    implementation: "Rollout or compliance timing",
    "enforcing authority": "Who enforces it",
    remedy: "What enforcement can require",
    penalty: "Possible penalty",
  };
  return labels[key] ?? value;
}

function hybridPolicyBriefing(input: {
  deterministic: PolicyBriefing;
  interpretation: PolicyInterpretation | null | undefined;
  claims: readonly PolicyReviewClaimProjection[];
}): PolicyBriefing {
  const interpretation = input.interpretation;
  if (!interpretation ||
      interpretation.schemaVersion !==
        SIX_SCREEN_POLICY_INTERPRETATION_SCHEMA_VERSION ||
      interpretation.method !== "openai_bounded_claim_synthesis") {
    return input.deterministic;
  }
  const claimById = new Map(input.claims.map((claim) =>
    [claim.claimId, claim]));
  const validIds = (ids: readonly string[]) => ids.length > 0 &&
    ids.length <= 8 && new Set(ids).size === ids.length &&
    ids.every((id) => claimById.has(id));
  const text = (value: string, maximum: number) => {
    const normalized = cleanPolicyPresentationText(value)
      .normalize("NFKC").replace(/\s+/gu, " ").trim();
    return normalized && normalized.length <= maximum &&
        !/<\/?[A-Za-z][^>]{0,500}>|&(?:lt|#0*60|#x0*3c);/iu.test(normalized)
      ? normalized
      : null;
  };
  const overview = text(interpretation.overview, 1_800);
  if (!overview || !isCompletePolicyPresentationSentence(overview) ||
      !validIds(interpretation.overviewClaimIds)) {
    return input.deterministic;
  }
  const section = (
    key: "whatChanged" | "coverage" | "enforcement",
    supplied: PolicyInterpretation["whatChanged"],
  ): PolicyBriefing[typeof key] => {
    const base = input.deterministic[key];
    const findings = supplied.slice(0, 8).flatMap((finding) => {
      const label = text(finding.label, 100);
      const findingText = text(finding.text, 1_300);
      if (!label || !findingText || !validIds(finding.claimIds) ||
          !isCompletePolicyPresentationSentence(findingText)) return [];
      return [{
        label: plainBriefingLabel(label),
        text: findingText,
        claimIds: [...finding.claimIds],
      }];
    });
    const safeFindings = findings.length ? findings : (base.findings ?? []);
    const finalFindings = safeFindings.length ? safeFindings : [{
      label: `${base.title} gap`,
      text: "The normalized source evidence did not support a reliable finding for this section.",
      claimIds: [],
    }];
    return {
      ...base,
      claimIds: finalFindings.flatMap(({ claimIds }) => claimIds),
      paragraphs: finalFindings.map(({ label, text: value }) =>
        `${label}: ${value}`),
      findings: finalFindings,
      status: finalFindings.some(({ claimIds }) => claimIds.length > 0)
        ? base.status
        : "unresolved",
    };
  };
  const timelineIds = new Set(interpretation.acceptedTimelineClaimIds.filter(
    (id) => claimById.has(id) && [
      "legal_effect_date", "policy_date", "implementation_schedule",
    ].includes(claimById.get(id)!.predicate),
  ));
  const keepTimeline = (item: PolicyBriefing["timeline"][number]) =>
    (item.claimIds ?? [item.claimId]).some((id) => timelineIds.has(id));
  const selectedTimeline = input.deterministic.timeline.filter(keepTimeline);
  const selectedLaterTimeline = input.deterministic.laterTimeline
    ?.filter(keepTimeline);
  const unresolvedQuestions = [
    ...interpretation.unresolvedQuestions.flatMap((value) => {
      const normalized = text(value, 600);
      return normalized ? [normalized] : [];
    }),
    ...input.deterministic.unresolvedQuestions,
  ].filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 6);
  return {
    ...input.deterministic,
    mode: "hybrid_validated_interpretation" as const,
    overview,
    overviewClaimIds: [...interpretation.overviewClaimIds],
    timeline: selectedTimeline.length
      ? selectedTimeline : input.deterministic.timeline,
    laterTimeline: selectedLaterTimeline?.length
      ? selectedLaterTimeline : input.deterministic.laterTimeline,
    undatedTimelineClaimIds:
      input.deterministic.undatedTimelineClaimIds.filter((id) =>
        timelineIds.has(id)),
    whatChanged: section("whatChanged", interpretation.whatChanged),
    coverage: section("coverage", interpretation.coverage),
    enforcement: section("enforcement", interpretation.enforcement),
    unresolvedQuestions,
    generatedAt: interpretation.generatedAt,
  };
}

/** Create the content-first Screen 2 projection from cited claims only. */
export function createPolicyBriefing(input: {
  title: string;
  claims: readonly PolicyReviewClaimProjection[];
  requirements: readonly Pick<EvidenceRequirement, "kind" | "status">[];
  generatedAt: string;
  studyPeriod?: { start: string | null; end: string | null };
  interpretation?: PolicyInterpretation | null;
}): PolicyBriefing {
  const explanations = uniqueClaimStatements(input.claims, [
    "policy_explanation",
  ]).filter(coherentBriefingClaim);
  const substantiveObligations = uniqueClaimStatements(input.claims, [
    "operative_change", "substantive_obligation",
  ]).filter(coherentBriefingClaim);
  const operationalDuties = uniqueClaimStatements(input.claims, [
    "implementation_schedule",
  ]).filter((claim) =>
    coherentBriefingClaim(claim) && isOperationalImplementationDuty(claim));
  const obligations = [...substantiveObligations, ...operationalDuties];
  const baseline = uniqueClaimStatements(input.claims, ["previous_baseline"])
    .filter(coherentBriefingClaim);
  const coverage = uniqueClaimStatements(input.claims, [
    "coverage_condition", "territorial_nexus", "threshold_condition",
    "exemption_rule",
  ]).filter(coherentBriefingClaim);
  const enforcement = uniqueClaimStatements(input.claims, [
    "implementation_schedule", "enforcement_authority", "remedy", "penalty",
  ]).filter((claim) =>
    coherentBriefingClaim(claim) &&
    !isOperationalImplementationDuty(claim) &&
    establishesEnforcementAuthority(claim));
  const timing = input.claims.filter((claim) =>
    coherentBriefingClaim(claim) &&
    !isOperationalImplementationDuty(claim) && briefingDate(claim));
  const overviewClaims = [
    ...explanations.slice(0, 1),
    ...baseline.slice(0, 1),
    ...obligations,
    ...coverage,
    ...timing.slice(0, 4),
    ...enforcement,
  ].filter((claim, index, values) =>
    values.findIndex(({ claimId }) => claimId === claim.claimId) === index);
  const overviewFacts = uniqueBriefingFacts(overviewClaims);
  const overviewQualifications: Array<{
    text: string;
    claimIds: string[];
  }> = [];
  if (obligations.length) overviewQualifications.push({
    text: "These cited duties establish what the policy required; their effects on the study outcome remain a separate empirical question.",
    claimIds: obligations.slice(0, 2).map(({ claimId }) => claimId),
  });
  if (coverage.length) overviewQualifications.push({
    text: "The stated coverage and exception conditions must be applied to historical unit facts before assigning treatment in the study.",
    claimIds: coverage.slice(0, 3).map(({ claimId }) => claimId),
  });
  if (timing.length) overviewQualifications.push({
    text: "The cited dates describe distinct legal stages; none alone establishes actual implementation by every covered unit or selects the study treatment clock.",
    claimIds: timing.slice(0, 3).map(({ claimId }) => claimId),
  });
  if (!baseline.length && obligations.length) overviewQualifications.push({
    text: "Because the prior baseline is not yet established, any claim about how far the focal episode departed from earlier law remains partial.",
    claimIds: obligations.slice(0, 1).map(({ claimId }) => claimId),
  });
  const overviewCandidates = [
    ...overviewFacts,
    ...overviewQualifications,
  ];
  let qualifiedOverview = boundedOverview(overviewCandidates);
  let overview = qualifiedOverview.text;
  if (overview && !normalizedBriefingText(overview)
      .includes(normalizedBriefingText(input.title))) {
    const prefix = `Under ${input.title}, `;
    const prefixWords = prefix.trim().split(/\s+/u).length;
    qualifiedOverview = boundedOverview(
      overviewCandidates,
      Math.max(1, 150 - prefixWords),
    );
    overview = qualifiedOverview.text
      ? `${prefix}${overviewClause(qualifiedOverview.text)}`
      : "";
  }
  overview ||=
    `${input.title} is confirmed, but the sources reviewed so far do not yet explain its main policy change reliably.`;
  const statusFor = (kind: EvidenceRequirement["kind"]) =>
    input.requirements.find((value) => value.kind === kind)?.status ??
      "not_yet_searched";
  const sectionStatus = (
    claimIds: readonly string[],
    kinds: readonly EvidenceRequirement["kind"][],
    visibleForKind?: Partial<Record<EvidenceRequirement["kind"], boolean>>,
  ): PolicyBriefing["whatChanged"]["status"] => {
    if (kinds.some((kind) => statusFor(kind) === "conflicting")) {
      return "conflicting";
    }
    if (!claimIds.length) return "unresolved";
    if (kinds.some((kind) =>
      statusFor(kind) === "supported" && visibleForKind?.[kind] === false
    )) return "partial";
    return kinds.every((kind) =>
        ["supported", "not_applicable"].includes(statusFor(kind)))
      ? "supported"
      : "partial";
  };
  const finding = (
    label: string,
    claim: PolicyReviewClaimProjection,
  ) => ({
    label,
    text: cleanedBriefingStatement(claim.statement),
    claimIds: [claim.claimId],
  });
  const whatChangedFindings = [
    ...baseline.slice(0, 2).map((claim) => finding("Before this policy", claim)),
    ...substantiveObligations.slice(0, 3)
      .map((claim) => finding("What the policy changed", claim)),
    ...operationalDuties.slice(0, 2)
      .map((claim) => finding("Ongoing requirement", claim)),
  ];
  if (!baseline.length) {
    whatChangedFindings.unshift({
      label: "Before this policy",
      text: "The sources reviewed so far do not clearly state the rule or practice that applied before this policy.",
      claimIds: [],
    });
  }
  if (!substantiveObligations.length && !operationalDuties.length) {
    whatChangedFindings.push({
      label: "What changed",
      text: "The sources reviewed so far do not clearly state the policy's main new requirement, right, or prohibition.",
      claimIds: [],
    });
  }
  const coverageLabels: Partial<Record<
    PolicyReviewClaimProjection["predicate"], string
  >> = {
    coverage_condition: "Who or what is covered",
    territorial_nexus: "Where it applies",
    threshold_condition: "Who meets the threshold",
    exemption_rule: "Who or what is not covered",
  };
  const coverageFindings = coverage.slice(0, 6).map((claim) =>
    finding(coverageLabels[claim.predicate] ?? "Coverage condition", claim));
  if (!coverage.some(({ predicate }) => predicate !== "exemption_rule")) {
    coverageFindings.unshift({
      label: "Who is covered",
      text: "The sources reviewed so far do not clearly identify which organizations, people, or activities the policy covers.",
      claimIds: [],
    });
  }
  const enforcementLabels: Partial<Record<
    PolicyReviewClaimProjection["predicate"], string
  >> = {
    implementation_schedule: "Rollout or compliance timing",
    enforcement_authority: "Who enforces it",
    remedy: "What enforcement can require",
    penalty: "Possible penalty",
  };
  const enforcementFindings: Array<{
    label: string;
    text: string;
    claimIds: string[];
  }> = ([
    "implementation_schedule", "enforcement_authority", "remedy", "penalty",
  ] as const).flatMap((predicate) => {
    const claim = enforcement.find((candidate) =>
      candidate.predicate === predicate
    );
    return claim
      ? [finding(enforcementLabels[predicate]!, claim)]
      : [];
  });
  if (!enforcementFindings.length) {
    const missing = [
      statusFor("implementation") !== "not_applicable" ? "a separate rollout or compliance schedule" : null,
      statusFor("enforcement") !== "not_applicable" ? "who enforces these provisions and what action they can take" : null,
      statusFor("penalty") !== "not_applicable" ? "any specific penalty and when it applies" : null,
    ].filter((value): value is string => Boolean(value));
    const missingText = missing.length < 2
      ? missing[0] ?? "a separate implementation or enforcement provision"
      : `${missing.slice(0, -1).join(", ")}, or ${missing.at(-1)}`;
    enforcementFindings.push({
      label: "What is not yet confirmed",
      text: missing.length
        ? `The sources reviewed so far do not clearly state ${missingText}.`
        : "The reviewed sources do not identify a separate implementation or enforcement provision for this policy.",
      claimIds: [],
    });
  }
  const whatChangedClaimIds = whatChangedFindings.flatMap(({ claimIds }) =>
    claimIds);
  const coverageClaimIds = coverageFindings.flatMap(({ claimIds }) => claimIds);
  const enforcementClaimIds = enforcementFindings.flatMap(({ claimIds }) =>
    claimIds);
  const questionForRequirement = (
    kind: EvidenceRequirement["kind"],
    status: EvidenceRequirement["status"],
  ) => {
    if (status === "conflicting") {
      return `Resolve which controlling source and historical version governs the ${kind.replaceAll("_", " ")} finding before relying on it.`;
    }
    const questions: Partial<Record<EvidenceRequirement["kind"], string>> = {
      operative_change:
        "What main requirement, right, or prohibition did this policy create?",
      previous_baseline:
        "What rule or practice applied before this policy?",
      coverage:
        "Which organizations, people, or activities were covered during the study period?",
      exemption:
        "Were any otherwise similar groups excluded or exempt during the study period?",
      temporal_stage:
        "Which date marks adoption, legal effect, compliance, and actual implementation?",
      implementation:
        "Did rollout or compliance begin on a separate schedule, and did timing vary across groups?",
      enforcement:
        "Who enforced the relevant provisions, and what action could that authority take?",
      penalty:
        "Did the relevant provisions specify a penalty, and what triggered it?",
    };
    return questions[kind] ??
      `Establish the unresolved ${kind.replaceAll("_", " ")} fact from an approved controlling source.`;
  };
  const unresolvedQuestions = input.requirements.filter(({ status }) =>
    status !== "supported" && status !== "not_applicable")
    .map(({ kind, status }) => questionForRequirement(kind, status)).slice(0, 3);
  const timingByBase = new Map<string, Array<{
    claim: PolicyReviewClaimProjection;
    date: TypedDate;
    group: string;
  }>>();
  const laterTimingByBase = new Map<string, Array<{
    claim: PolicyReviewClaimProjection;
    date: TypedDate;
    group: string;
  }>>();
  for (const claim of timing) {
    const date = briefingDate(claim);
    if (!date?.start) continue;
    const endYear = Number(input.studyPeriod?.end?.slice(0, 4));
    const dateYear = Number(date.start.slice(0, 4));
    const base = [date.kind, date.start, date.end ?? "", date.precision].join(":");
    const target = Number.isFinite(endYear) && Number.isFinite(dateYear) &&
        dateYear > endYear
      ? laterTimingByBase
      : timingByBase;
    const entries = target.get(base) ?? [];
    entries.push({ claim, date, group: timelineAffectedGroup(claim) });
    target.set(base, entries);
  }
  const projectTimeline = (
    grouped: typeof timingByBase,
    maximum: number,
  ) => {
    const byMilestone = new Map<
      string,
      PolicyBriefing["timeline"][number]
    >();
    for (const [base, entries] of grouped) {
      const groups = new Set(entries.map(({ group }) => group).filter(Boolean));
      const preserveGroups = groups.size > 1 &&
        entries.every(({ group }) => group);
      for (const { claim, date, group } of entries) {
        const key = preserveGroups ? `${base}:${group}` : base;
        const existing = byMilestone.get(key);
        if (existing) {
          existing.claimIds = [...new Set([
            ...(existing.claimIds ?? [existing.claimId]),
            claim.claimId,
          ])];
          if (questionLikeStatement(existing.statement) &&
              !questionLikeStatement(claim.statement)) {
            existing.statement = timelineStatement(claim, date);
            existing.qualification = claim.qualification;
          }
          continue;
        }
        byMilestone.set(key, {
          claimId: claim.claimId,
          claimIds: [claim.claimId],
          label: timelineLabel(date.kind),
          date,
          statement: timelineStatement(claim, date),
          qualification: claim.qualification,
        });
      }
    }
    return [...byMilestone.values()]
      .sort((left, right) =>
        timelinePriority(left.date.kind) - timelinePriority(right.date.kind) ||
        (left.date.start ?? "9999").localeCompare(
          right.date.start ?? "9999",
        ) || left.label.localeCompare(right.label, "en-US"))
      .slice(0, maximum)
      .sort((left, right) =>
        (left.date.start ?? "9999").localeCompare(
          right.date.start ?? "9999",
        ) || timelinePriority(left.date.kind) -
          timelinePriority(right.date.kind) ||
        left.label.localeCompare(right.label, "en-US"));
  };
  const timeline = projectTimeline(timingByBase, 5);
  const laterTimeline = projectTimeline(laterTimingByBase, 4);
  const deterministic: PolicyBriefing = {
    mode: "deterministic_source_reconstruction",
    overview,
    overviewClaimIds: qualifiedOverview.claimIds,
    timeline,
    laterTimeline,
    undatedTimelineClaimIds: input.claims.filter((claim) =>
      (claim.predicate === "implementation_schedule" ||
        claim.predicate === "policy_date") &&
      !isOperationalImplementationDuty(claim) && !briefingDate(claim))
      .map(({ claimId }) => claimId),
    whatChanged: {
      title: "What changed",
      claimIds: whatChangedClaimIds,
      paragraphs: whatChangedFindings.map(({ label, text }) =>
        `${label}: ${text}`),
      findings: whatChangedFindings,
      status: sectionStatus(whatChangedClaimIds, [
        "operative_change", "previous_baseline",
      ], {
        operative_change: obligations.length > 0,
        previous_baseline: baseline.length > 0,
      }),
    },
    coverage: {
      title: "Who is formally covered",
      claimIds: coverageClaimIds,
      paragraphs: coverageFindings.map(({ label, text }) => `${label}: ${text}`),
      findings: coverageFindings,
      status: sectionStatus(coverageClaimIds, ["coverage", "exemption"], {
        coverage: coverage.some(({ predicate }) =>
          predicate !== "exemption_rule"),
        exemption: coverage.some(({ predicate }) =>
          predicate === "exemption_rule"),
      }),
    },
    enforcement: {
      title: "Implementation and enforcement",
      claimIds: enforcementClaimIds,
      paragraphs: enforcementFindings.map(({ label, text }) =>
        `${label}: ${text}`),
      findings: enforcementFindings,
      status: sectionStatus(enforcementClaimIds, [
        "implementation", "enforcement", "penalty",
      ], {
        implementation: enforcement.some(({ predicate }) =>
          predicate === "implementation_schedule"),
        enforcement: enforcement.some(({ predicate }) =>
          predicate === "enforcement_authority") &&
          enforcement.some(({ predicate }) => predicate === "remedy"),
        penalty: enforcement.some(({ predicate }) => predicate === "penalty"),
      }),
    },
    unresolvedQuestions,
    generatedAt: input.generatedAt,
  };
  return hybridPolicyBriefing({
    deterministic,
    interpretation: input.interpretation,
    claims: input.claims,
  });
}
