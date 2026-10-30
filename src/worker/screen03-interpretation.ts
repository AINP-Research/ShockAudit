import type { Screen02WorkflowHandoff } from "../core/screen02-workflow-handoff";
import {
  fingerprintScreen03ProposalForInterpretation,
  requireScreen03ResearchPacket,
  requireScreen03VerificationState,
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  screen03PassageProvidesDirectSupport,
  type Screen03AnyProposal,
  type Screen03Interpretation,
  type Screen03InterpretationBlock,
  type Screen03ResearchPacket,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import { screen03EvidenceTextHasUnsafeInstruction } from "./screen03-evidence-synthesis";

export const SCREEN_03_INTERPRETATION_PROTOCOL_VERSION =
  "screen-03-interpretation-v1" as const;
export const SCREEN_03_INTERPRETATION_TIMEOUT_MS = 15_000;
export const SCREEN_03_INTERPRETATION_MAX_PROPOSALS = 40;
export const SCREEN_03_INTERPRETATION_MAX_PASSAGES = 40;
export const SCREEN_03_INTERPRETATION_MAX_KEY_POINTS = 6;
export const SCREEN_03_INTERPRETATION_MAX_REFERENCES = 4;
export const SCREEN_03_INTERPRETATION_MAX_REQUEST_BYTES = 24_000;
export const SCREEN_03_INTERPRETATION_MAX_BLOCK_CHARACTERS = 360;
export const SCREEN_03_HOST_DRAFT_MAX_PROPOSALS = 12;
export const SCREEN_03_HOST_DRAFT_MAX_PASSAGES = 18;

const MAX_PASSAGE_TEXT = 700;
const MAX_SOURCE_PROPOSAL_VALUE = 2_000;
const MAX_PROPOSAL_VALUE = 480;
const MAX_BLOCK_TEXT = SCREEN_03_INTERPRETATION_MAX_BLOCK_CHARACTERS;
const MAX_EXPLANATION_TEXT = 280;
const MAX_LIMITATION_TEXT = 300;
const MAX_LIMITATIONS = 6;
const MAX_MODEL_RESPONSE_BYTES = 16_000;
// A single bounded legal claim can carry a short statutory list. Keep the
// complete 480-character proposal allowance here so a later item in an exact
// list (for example, a second historical eligibility threshold) is not
// silently removed before the host sees it. The total model-context payload
// remains independently capped and reduced below.
const MAX_MODEL_CLAIM_TEXT = MAX_PROPOSAL_VALUE;
const MAX_MODEL_EVIDENCE_TEXT = 320;

export const SCREEN_03_INTERPRETATION_CAVEAT =
  "Any study connection is a preliminary, outcome-blind hypothesis. It does not establish causation, effect direction, or effect size." as const;

const UNAVAILABLE_SAMPLE_CONNECTION =
  "Plain-language sample relevance is unavailable; review the source-backed coverage claims.";
const UNAVAILABLE_OUTCOME_CONNECTION =
  "Outcome relevance is unavailable; use the cited event record and selected outcome family to form a hypothesis.";

const FORBIDDEN_INTERPRETATION_CLAIM =
  /\b(?:p[- ]?value|statistical(?:ly)? significant|effect estimate|realized outcome|observed (?:effect|outcome)|proves? causality|causal validity|causally valid|as-if random|exogeneity|exogenous(?:ly)?(?: assignment)?|random assignment|legally verified|verified legal (?:status|coverage|eligibility)|definitively covered|confirmed operative date)\b/iu;
const CATEGORICAL_OUTCOME_CLAIM =
  /\b(?:(?:will|does|did)\s+(?:cause|increase|decrease|improve|reduce|change|affect)|caused|resulted in|led to|had an? (?:effect|impact))\b/iu;
const OUTCOME_DIRECTION_OR_MAGNITUDE_CLAIM =
  /\b(?:increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|improv(?:e|es|ed|ing)|reduc(?:e|es|ed|ing)|rais(?:e|es|ed|ing)|lower(?:s|ed|ing)?|ris(?:e|es|ing)|rose|fall(?:s|ing)?|fell|grow(?:s|ing)?|grew|shrink(?:s|ing)?|shrank|boost(?:s|ed|ing)?|worsen(?:s|ed|ing)?|positive|negative|larger|smaller|substantial|material|negligible|strong|weak|sizeable|sizable|magnitude|percentage(?:[- ]point)?|basis[- ]point)\b/iu;
const MODAL_OUTCOME_LANGUAGE =
  /\b(?:may|might|could|possible|possibly|potential|potentially|plausible|hypothesis|hypothesized|uncertain|unclear)\b/iu;
const URL_TEXT = /(?:https?:\/\/|www\.|mailto:)/iu;
const HTML_TEXT = /<\/?[a-z][^>]*>/iu;
const MARKDOWN_TEXT =
  /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)|```|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*|__/u;

type Screen03InterpretationStudyContext = Screen03Interpretation["studyContext"];
type EvidenceItem = Screen03ResearchPacket["evidence"][number];
type Passage = EvidenceItem["passages"][number];
type Screen03InterpretationEvidencePacket = Pick<
  Screen03ResearchPacket,
  "evidence" | "proposals"
>;

export type Screen03InterpretationRequestPassage = {
  passageId: string;
  evidenceId: string;
  sourceId: string | null;
  text: string;
};

export type Screen03InterpretationRequestProposal = {
  proposalId: string;
  proposalFingerprint: string;
  group: Screen03AnyProposal["group"];
  label: string;
  value: string;
  critical: boolean;
  ownPassageIds: string[];
  allowedPassageIds: string[];
  sourceDiversityAvailable: boolean;
};

export type Screen03InterpretationRequest = {
  protocolVersion: typeof SCREEN_03_INTERPRETATION_PROTOCOL_VERSION;
  event: {
    canonicalTitle: string;
    eventType: string;
    issuingJurisdiction: string | null;
  };
  studyContext: Screen03InterpretationStudyContext;
  proposals: Screen03InterpretationRequestProposal[];
  passages: Screen03InterpretationRequestPassage[];
  constraints: {
    maximumKeyPoints: number;
    maximumReferencesPerItem: number;
    citationsRestrictedToProposalAllowlists: true;
    citeOwnPassageForEveryProposalReference: true;
    useTwoEvidenceItemsWhenAvailable: true;
    plainTextOnly: true;
    conditionalOutcomeLanguageOnly: true;
    nonCanonicalResearcherOrientationOnly: true;
  };
  outcomeValuesInspected: false;
};

export type Screen03Interpreter = (
  request: Screen03InterpretationRequest,
  options: { signal: AbortSignal },
) => Promise<unknown>;

type ModelBlock = {
  text: string;
  proposalIds: string[];
};

type ModelClaimExplanation = {
  proposalId: string;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function normalizedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedToken(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function boundedStringArray(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string[] {
  return Array.isArray(value) && value.length >= minimum &&
    value.length <= maximum && value.every((item) =>
      typeof item === "string" && item.length > 0 && item.length <= 160 &&
      item.trim() === item
    ) && new Set(value).size === value.length;
}

function digitTokens(value: string) {
  return value.match(/\p{N}+/gu) ?? [];
}

function hasOnlySupportedDigits(value: string, allowedText: readonly string[]) {
  const allowed = new Set(allowedText.flatMap(digitTokens));
  return digitTokens(value).every((token) => allowed.has(token));
}

function safePlainText(
  value: unknown,
  maximum: number,
  allowedDigitText: readonly string[],
  options: {
    requireModalOutcome?: boolean;
    outcomeFamily?: string;
  } = {},
): value is string {
  if (
    typeof value !== "string" || value.length === 0 ||
    value.length > maximum || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value) || URL_TEXT.test(value) ||
    HTML_TEXT.test(value) || MARKDOWN_TEXT.test(value) ||
    screen03EvidenceTextHasUnsafeInstruction(value) ||
    FORBIDDEN_INTERPRETATION_CLAIM.test(value) ||
    !hasOnlySupportedDigits(value, allowedDigitText)
  ) {
    return false;
  }
  const mentionsOutcome = options.outcomeFamily !== undefined &&
    options.outcomeFamily !== "Unspecified" &&
    containsNormalizedPhrase(value, options.outcomeFamily);
  if (
    (options.requireModalOutcome || mentionsOutcome) &&
    (
      !MODAL_OUTCOME_LANGUAGE.test(value) ||
      CATEGORICAL_OUTCOME_CLAIM.test(value) ||
      OUTCOME_DIRECTION_OR_MAGNITUDE_CLAIM.test(value)
    )
  ) {
    return false;
  }
  return true;
}

function safeDataText(value: string, maximum: number, fallback: string) {
  const normalized = normalizedText(value, maximum);
  if (
    normalized.length === 0 || URL_TEXT.test(normalized) ||
    HTML_TEXT.test(normalized) || MARKDOWN_TEXT.test(normalized) ||
    screen03EvidenceTextHasUnsafeInstruction(normalized)
  ) {
    return fallback;
  }
  return normalized;
}

function compactEligibilityListClaim(proposal: Screen03AnyProposal) {
  if (proposal.value.length > MAX_SOURCE_PROPOSAL_VALUE) {
    return normalizedText(proposal.value, MAX_SOURCE_PROPOSAL_VALUE);
  }
  const normalized = normalizedText(
    proposal.value,
    MAX_SOURCE_PROPOSAL_VALUE,
  );
  if (
    proposal.group !== "eligibility" || normalized.length <= MAX_BLOCK_TEXT
  ) return normalized;

  const separator = normalized.indexOf(":");
  if (separator < 0) return normalized;
  const lead = normalized.slice(0, separator);
  const list = normalized.slice(separator + 1).trim();
  const label = normalizedText(proposal.label, 160)
    .replace(/[.:;\s]+$/u, "")
    .trim();
  const items = list.split(";").map((item) => item.trim());
  // A compact label plus the complete source list is preferable to blindly
  // cutting a later numeric criterion. Keep this transformation narrow: only
  // a complete threshold list whose items each identify their own number can
  // omit the preceding explanation. A separate coverage point retains the
  // affected population and other applicability conditions.
  if (
    !/\bthresholds?\b/iu.test(label) || items.length < 3 ||
    !items.every((item) => /\d/u.test(item)) ||
    !/[.!?]$/u.test(list)
  ) return normalized;
  const version = /\boriginal\b/iu.test(lead)
    ? "Original"
    : null;
  const compactLabel = version === null
    ? label
    : `${version} ${label[0]!.toLocaleLowerCase("en-US")}${label.slice(1)}`;
  const compact = `${compactLabel}: ${list}`;
  return compact.length <= MAX_BLOCK_TEXT ? compact : normalized;
}

function directActivePassage(
  item: EvidenceItem,
  passage: Passage,
  proposal: Screen03AnyProposal,
) {
  return screen03EvidenceItemProvidesAuthoritativeDirectSupport(item) &&
    passage.locator !== null &&
    screen03PassageProvidesDirectSupport(passage, proposal) &&
    !screen03EvidenceTextHasUnsafeInstruction(passage.text);
}

function proposalGroups(packet: Screen03InterpretationEvidencePacket) {
  // Every factual review card, including timeline milestones, can receive
  // reader help. Required-variable items remain an informational checklist.
  return [
    ...packet.proposals.identity,
    ...packet.proposals.overview,
    ...packet.proposals.component,
    ...packet.proposals.eligibility,
    ...packet.proposals.amendment,
    ...packet.proposals.timeline,
  ];
}

export { fingerprintScreen03ProposalForInterpretation };

type OwnedPassage = Screen03InterpretationRequestPassage;

function sourceOwnerId(passage: Screen03InterpretationRequestPassage) {
  return passage.sourceId ?? passage.evidenceId;
}

type ProposalDraft = {
  proposal: Screen03AnyProposal;
  order: number;
  own: OwnedPassage[];
};

function evidenceOwnerMatches(
  proposal: Screen03AnyProposal,
  item: EvidenceItem,
) {
  return proposal.sourceIds.includes(item.id) ||
    (item.sourceId !== null && proposal.sourceIds.includes(item.sourceId));
}

function boundedProposalDrafts(packet: Screen03InterpretationEvidencePacket) {
  const passageById = new Map<string, {
    owned: OwnedPassage;
    item: EvidenceItem;
    passage: Passage;
  }>();
  for (const item of packet.evidence) {
    for (const passage of item.passages) {
      passageById.set(passage.id, {
        owned: {
          passageId: passage.id,
          evidenceId: item.id,
          sourceId: item.sourceId,
          text: normalizedText(passage.text, MAX_PASSAGE_TEXT),
        },
        item,
        passage,
      });
    }
  }
  return proposalGroups(packet)
    .map((proposal, order): ProposalDraft | null => {
      if (
        proposal.support !== "direct" ||
        proposal.reviewStatus === "rejected" ||
        proposal.reviewStatus === "edited" ||
        screen03EvidenceTextHasUnsafeInstruction(proposal.value)
      ) {
        return null;
      }
      const own = unique(proposal.passageIds)
        .map((passageId) => passageById.get(passageId))
        .filter((entry) =>
          entry !== undefined &&
          entry.owned.text.length > 0 &&
          evidenceOwnerMatches(proposal, entry.item) &&
          directActivePassage(entry.item, entry.passage, proposal)
        )
        .map((entry) => entry!.owned);
      return own.length > 0 ? { proposal, order, own } : null;
    })
    .filter((draft): draft is ProposalDraft => draft !== null)
    .sort((left, right) =>
      Number(right.proposal.critical) - Number(left.proposal.critical) ||
      left.order - right.order
    )
    .slice(0, SCREEN_03_INTERPRETATION_MAX_PROPOSALS);
}

function buildBoundedPassageSelection(drafts: readonly ProposalDraft[]) {
  const selected = new Map<string, OwnedPassage>();
  const add = (passage: OwnedPassage | undefined) => {
    if (!passage || selected.has(passage.passageId)) return;
    if (selected.size < SCREEN_03_INTERPRETATION_MAX_PASSAGES) {
      selected.set(passage.passageId, passage);
    }
  };

  for (const draft of drafts) add(draft.own[0]);
  for (const draft of drafts) {
    const firstOwner = draft.own[0] === undefined
      ? undefined
      : sourceOwnerId(draft.own[0]);
    add(draft.own.find((passage) => sourceOwnerId(passage) !== firstOwner));
  }
  for (const draft of drafts) {
    for (const passage of draft.own) add(passage);
  }
  return selected;
}

function studyContextFromHandoff(
  handoff: Screen02WorkflowHandoff,
): Screen03InterpretationStudyContext {
  const scope = handoff.screen01Baseline.scopeContract;
  return {
    population: scope.population,
    geography: scope.geography,
    industry: scope.industry,
    studyPeriod: scope.studyPeriod,
    outcomeFamily: scope.outcomeFamily,
  };
}

type Screen03InterpretationRequestContext = Pick<
  Screen03InterpretationRequest,
  "event" | "studyContext"
>;

function canonicalRequestContext(
  event: {
    canonicalTitle: string;
    eventType: string;
    issuingJurisdiction: string | null;
  },
  studyContext: Screen03InterpretationStudyContext,
): Screen03InterpretationRequestContext {
  return {
    event: {
      canonicalTitle: safeDataText(
        event.canonicalTitle,
        240,
        "The selected event",
      ),
      eventType: safeDataText(event.eventType, 120, "event"),
      issuingJurisdiction: event.issuingJurisdiction === null
        ? null
        : safeDataText(event.issuingJurisdiction, 160, "Unspecified"),
    },
    studyContext: {
      population: safeDataText(studyContext.population, 240, "Unspecified"),
      geography: safeDataText(studyContext.geography, 160, "Unspecified"),
      industry: safeDataText(studyContext.industry, 200, "Unspecified"),
      studyPeriod: safeDataText(studyContext.studyPeriod, 160, "Unspecified"),
      outcomeFamily: safeDataText(
        studyContext.outcomeFamily,
        240,
        "Unspecified",
      ),
    },
  };
}

function requestContextFromHandoff(
  handoff: Screen02WorkflowHandoff,
): Screen03InterpretationRequestContext {
  return canonicalRequestContext(
    handoff.event.identity,
    studyContextFromHandoff(handoff),
  );
}

function buildScreen03InterpretationRequestForContext(
  packet: Screen03InterpretationEvidencePacket,
  context: Screen03InterpretationRequestContext,
): Screen03InterpretationRequest {
  const drafts = boundedProposalDrafts(packet);
  const selected = buildBoundedPassageSelection(drafts);
  const requestProposals = drafts.map(({ proposal, own }) => {
    const selectedOwn = own.filter((passage) =>
      selected.has(passage.passageId)
    );
    const prioritizedAllowed: OwnedPassage[] = [];
    const addAllowed = (passage: OwnedPassage | undefined) => {
      if (
        passage &&
        !prioritizedAllowed.some(
          (candidate) => candidate.passageId === passage.passageId,
        ) &&
        prioritizedAllowed.length < SCREEN_03_INTERPRETATION_MAX_REFERENCES
      ) {
        prioritizedAllowed.push(passage);
      }
    };
    addAllowed(selectedOwn[0]);
    addAllowed(selectedOwn.find(
      (passage) =>
        selectedOwn[0] !== undefined &&
        sourceOwnerId(passage) !== sourceOwnerId(selectedOwn[0]),
    ));
    for (const passage of selectedOwn) addAllowed(passage);
    const allowedPassageIds = prioritizedAllowed.map(
      (passage) => passage.passageId,
    );
    const allowedOwners = new Set(
      allowedPassageIds.map((passageId) =>
        sourceOwnerId(selected.get(passageId)!)
      ),
    );
    return {
      proposalId: proposal.id,
      proposalFingerprint:
        fingerprintScreen03ProposalForInterpretation(proposal),
      group: proposal.group,
      label: safeDataText(proposal.label, 160, "Source-backed claim"),
      value: safeDataText(
        compactEligibilityListClaim(proposal),
        MAX_PROPOSAL_VALUE,
        "See the cited source passage.",
      ),
      critical: proposal.critical,
      ownPassageIds: allowedPassageIds,
      allowedPassageIds,
      sourceDiversityAvailable: allowedOwners.size >= 2,
    };
  });
  return {
    protocolVersion: SCREEN_03_INTERPRETATION_PROTOCOL_VERSION,
    event: context.event,
    studyContext: context.studyContext,
    proposals: requestProposals,
    passages: [...selected.values()].map(
      ({ passageId, evidenceId, sourceId, text }) => ({
        passageId,
        evidenceId,
        sourceId,
        text,
      }),
    ),
    constraints: {
      maximumKeyPoints: SCREEN_03_INTERPRETATION_MAX_KEY_POINTS,
      maximumReferencesPerItem: SCREEN_03_INTERPRETATION_MAX_REFERENCES,
      citationsRestrictedToProposalAllowlists: true,
      citeOwnPassageForEveryProposalReference: true,
      useTwoEvidenceItemsWhenAvailable: true,
      plainTextOnly: true,
      conditionalOutcomeLanguageOnly: true,
      nonCanonicalResearcherOrientationOnly: true,
    },
    outcomeValuesInspected: false,
  };
}

export function buildScreen03InterpretationRequest(
  packet: Screen03InterpretationEvidencePacket,
  handoff: Screen02WorkflowHandoff,
): Screen03InterpretationRequest {
  return buildScreen03InterpretationRequestForContext(
    packet,
    requestContextFromHandoff(handoff),
  );
}

type Screen03HostDraftSemanticTopic =
  | "what"
  | "rights"
  | "duties"
  | "coverage"
  | "timing"
  | "enforcement"
  | "later-changes";

const HOST_DRAFT_SEMANTIC_TOPICS: readonly Screen03HostDraftSemanticTopic[] = [
  "what",
  "rights",
  "duties",
  "coverage",
  "timing",
  "enforcement",
  "later-changes",
];

const HOST_DRAFT_GENERIC_GROUPS: readonly Screen03AnyProposal["group"][] = [
  "identity",
  "overview",
  "component",
  "eligibility",
  "timeline",
  "amendment",
];

function hostDraftSemanticTopics(
  proposal: Screen03InterpretationRequestProposal,
) {
  const text = `${proposal.label} ${proposal.value}`;
  const topics = new Set<Screen03HostDraftSemanticTopic>();
  if (
    proposal.group === "identity" || proposal.group === "overview" ||
    /\b(?:act|law|regulation|rule|program|policy|order|statute|what|purpose|establish|create|introduc|change)\w*\b/iu.test(text)
  ) topics.add("what");
  if (
    /\b(?:right|access|delete|deletion|opt[- ]?out|correct|limit|non[- ]?discrimination|protect|entitl)\w*\b/iu.test(text)
  ) topics.add("rights");
  if (
    proposal.group === "component" ||
    /\b(?:duty|must|required|requirement|obligation|prohibit|compliance|disclos|notify|notice|collect|use|share|sell|sale)\w*\b/iu.test(text)
  ) topics.add("duties");
  if (
    proposal.group === "eligibility" ||
    /\b(?:appl|cover|coverage|scope|eligible|threshold|business|organization|exempt|qualif)\w*\b/iu.test(text)
  ) topics.add("coverage");
  if (
    proposal.group === "timeline" ||
    /\b(?:effective|enacted|approved|adopted|operative|implementation|deadline|date|timing|begin|commenc)\w*\b/iu.test(text)
  ) topics.add("timing");
  if (
    /\b(?:enforc|penalt|fine|violation|remed|lawsuit|action|regulator|attorney general)\w*\b/iu.test(text)
  ) topics.add("enforcement");
  if (
    proposal.group === "amendment" ||
    /\b(?:amend|later|expand|update|revision|successor|supersed|phase[- ]?in)\w*\b/iu.test(text)
  ) topics.add("later-changes");
  return topics;
}

function numericEligibilityThreshold(
  proposal: Screen03InterpretationRequestProposal,
) {
  const text = `${proposal.label} ${proposal.value}`;
  const labelDeclaresThreshold = /\bthreshold\w*\b/iu.test(proposal.label);
  const boundedQuantity =
    /(?:[$€£]\s*\d[\d,.]*(?:\s*(?:million|billion|thousand))?|\d[\d,.]*\s*(?:(?:or|and)\s+(?:more|fewer|less)\s+|full[- ]time(?:\s+equivalent)?\s+)?(?:%|percent|million|billion|thousand|employees?|consumers?|households?|devices?|records?|businesses?))/iu;
  return proposal.group === "eligibility" &&
    /\b(?:threshold|revenue|consumer|employee|household|device|record|business|percent|percentage)\w*\b/iu.test(
      text,
    ) &&
    (
      boundedQuantity.test(proposal.value) ||
      (labelDeclaresThreshold && /\p{N}/u.test(proposal.value))
    );
}

function explicitlyVersionedThreshold(
  proposal: Screen03InterpretationRequestProposal,
) {
  const text = `${proposal.label} ${proposal.value}`;
  return /\b(?:original|as amended|amended|later|current)\b/iu.test(text) ||
    (
      /\b(?:as of|effective|beginning|from|in effect|operative)\b/iu.test(text) &&
      /\b(?:19|20)\d{2}(?:-\d{2}-\d{2})?\b/u.test(text)
    );
}

function normalizedEligibilityClaim(
  proposal: Screen03InterpretationRequestProposal,
) {
  return proposal.value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ")
    .trim();
}

function preferredNumericEligibilityThreshold(
  proposals: readonly Screen03InterpretationRequestProposal[],
) {
  const candidates = proposals.filter(numericEligibilityThreshold);
  const versioned = candidates.find(explicitlyVersionedThreshold);
  if (versioned) return versioned;
  const distinctClaims = new Set(
    candidates.map(normalizedEligibilityClaim).filter((claim) =>
      claim.length > 0
    ),
  );
  return distinctClaims.size === 1 ? candidates[0] : undefined;
}

function hostDraftSemanticCandidates(request: Screen03InterpretationRequest) {
  const preferredThreshold = preferredNumericEligibilityThreshold(
    request.proposals,
  );
  return request.proposals.filter((proposal) => {
    if (!numericEligibilityThreshold(proposal)) return true;
    // Detail extraction deliberately uses the same generic label for every
    // threshold claim. Keep claims that identify their own version; otherwise
    // retain at most one when every numeric candidate repeats the same full
    // claim text. Comparator, currency, unit, and conjunction changes make a
    // claim distinct. The host remains bound to its server-derived citations.
    return explicitlyVersionedThreshold(proposal) ||
      proposal.proposalId === preferredThreshold?.proposalId;
  });
}

function compactHostDraftRequest(request: Screen03InterpretationRequest) {
  const candidates = hostDraftSemanticCandidates(request);
  const selected: Screen03InterpretationRequestProposal[] = [];
  const selectedIds = new Set<string>();
  const add = (proposal: Screen03InterpretationRequestProposal | undefined) => {
    if (
      !proposal || selectedIds.has(proposal.proposalId) ||
      selected.length >= SCREEN_03_HOST_DRAFT_MAX_PROPOSALS
    ) return;
    selectedIds.add(proposal.proposalId);
    selected.push(proposal);
  };

  for (const topic of HOST_DRAFT_SEMANTIC_TOPICS) {
    const topicCandidates = topic === "coverage"
      ? [...candidates].sort((left, right) =>
          Number(
            right.group === "eligibility" &&
              !numericEligibilityThreshold(right),
          ) - Number(
            left.group === "eligibility" &&
              !numericEligibilityThreshold(left),
          )
        )
      : candidates;
    add(topicCandidates.find((proposal) =>
      hostDraftSemanticTopics(proposal).has(topic)
    ));
  }
  // Generic coverage is the safer first briefing point, but retain one
  // explicitly dated/versioned threshold or a single distinct undated claim.
  // Conflicting undated thresholds remain outside the model task.
  add(preferredNumericEligibilityThreshold(candidates));
  for (const group of HOST_DRAFT_GENERIC_GROUPS) {
    add(candidates.find((proposal) => proposal.group === group));
  }
  for (const proposal of candidates) {
    if (hostDraftSemanticTopics(proposal).size > 0) add(proposal);
  }
  for (const proposal of candidates) add(proposal);

  const passageById = new Map(
    request.passages.map((passage) => [passage.passageId, passage]),
  );
  const selectedPassageIds = new Set<string>();
  const addPassage = (passageId: string | undefined) => {
    if (
      passageId !== undefined && passageById.has(passageId) &&
      selectedPassageIds.size < SCREEN_03_HOST_DRAFT_MAX_PASSAGES
    ) selectedPassageIds.add(passageId);
  };
  for (const proposal of selected) addPassage(proposal.ownPassageIds[0]);
  for (const proposal of selected) {
    const first = proposal.ownPassageIds[0];
    const firstPassage = first === undefined ? undefined : passageById.get(first);
    const firstOwner = firstPassage?.sourceId ?? firstPassage?.evidenceId;
    addPassage(proposal.ownPassageIds.find((passageId) => {
      const passage = passageById.get(passageId);
      return passage !== undefined &&
        (passage.sourceId ?? passage.evidenceId) !== firstOwner;
    }));
  }
  for (const proposal of selected) {
    for (const passageId of proposal.ownPassageIds) addPassage(passageId);
  }

  const proposals = selected.map((proposal) => {
    const ownPassageIds = proposal.ownPassageIds.filter((passageId) =>
      selectedPassageIds.has(passageId)
    );
    const allowedPassageIds = proposal.allowedPassageIds.filter((passageId) =>
      selectedPassageIds.has(passageId)
    );
    const owners = new Set(ownPassageIds.map((passageId) => {
      const passage = passageById.get(passageId)!;
      return passage.sourceId ?? passage.evidenceId;
    }));
    return {
      ...proposal,
      ownPassageIds,
      allowedPassageIds,
      sourceDiversityAvailable: owners.size >= 2,
    };
  }).filter((proposal) => proposal.ownPassageIds.length > 0);

  return {
    ...request,
    proposals,
    passages: request.passages.filter((passage) =>
      selectedPassageIds.has(passage.passageId)
    ),
  };
}

export function buildScreen03HostDraftRequest(
  packet: Screen03InterpretationEvidencePacket,
  handoff: Screen02WorkflowHandoff,
): Screen03InterpretationRequest;
export function buildScreen03HostDraftRequest(
  state: Screen03VerificationState,
  handoff?: Screen02WorkflowHandoff,
): Screen03InterpretationRequest;
export function buildScreen03HostDraftRequest(
  input: Screen03InterpretationEvidencePacket | Screen03VerificationState,
  handoff?: Screen02WorkflowHandoff,
): Screen03InterpretationRequest {
  if ("eventIdentity" in input && "upstream" in input) {
    const state = requireScreen03VerificationState(input);
    const stateStudyContext = state.interpretation?.studyContext;
    if (!stateStudyContext) {
      throw new Error(
        "Screen 3 cannot reconstruct host reader help without its canonical study context.",
      );
    }
    const context = canonicalRequestContext(
      state.eventIdentity,
      stateStudyContext,
    );
    if (handoff) {
      if (
        state.upstream.handoffFingerprint !==
          handoff.integrity.handoffFingerprint ||
        state.upstream.eventFingerprint !== handoff.integrity.eventFingerprint ||
        JSON.stringify(context) !== JSON.stringify(requestContextFromHandoff(handoff))
      ) {
        throw new Error(
          "Screen 3 host reader-help context no longer matches its authenticated handoff.",
        );
      }
    }
    return compactHostDraftRequest(
      buildScreen03InterpretationRequestForContext(state, context),
    );
  }
  if (!handoff) {
    throw new Error("Screen 3 host reader help requires its authenticated handoff.");
  }
  return compactHostDraftRequest(
    buildScreen03InterpretationRequestForContext(
      input,
      requestContextFromHandoff(handoff),
    ),
  );
}

class Screen03InterpretationResponseError extends Error {
  override readonly name = "Screen03InterpretationResponseError";
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalProposalPassageIds(
  proposal: Screen03InterpretationRequestProposal,
  passageById: ReadonlyMap<
    string,
    Screen03InterpretationRequestPassage
  >,
) {
  const first = proposal.ownPassageIds.find((passageId) =>
    passageById.has(passageId)
  );
  if (first === undefined) return [];
  const selected = [first];
  if (proposal.sourceDiversityAvailable) {
    const firstOwner = sourceOwnerId(passageById.get(first)!);
    const corroborating = proposal.ownPassageIds.find((passageId) =>
      passageById.has(passageId) &&
      sourceOwnerId(passageById.get(passageId)!) !== firstOwner
    );
    if (corroborating !== undefined) selected.push(corroborating);
  }
  return selected;
}

export function buildScreen03HostDraftModelContext(
  request: Screen03InterpretationRequest,
) {
  const passageById = new Map(
    request.passages.map((passage) => [passage.passageId, passage]),
  );
  const claims = request.proposals.map((proposal) => {
    const claim = normalizedText(proposal.value, MAX_MODEL_CLAIM_TEXT);
    const seenEvidence = new Set<string>();
    const evidence = canonicalProposalPassageIds(proposal, passageById)
      .map((passageId) =>
        normalizedText(
          passageById.get(passageId)?.text ?? "",
          MAX_MODEL_EVIDENCE_TEXT,
        )
      )
      .filter((text) => {
        const token = normalizedToken(text);
        if (
          token.length === 0 || token === normalizedToken(claim) ||
          seenEvidence.has(token)
        ) return false;
        seenEvidence.add(token);
        return true;
      });
    return {
      proposalId: proposal.proposalId,
      group: proposal.group,
      label: proposal.label,
      claim,
      evidence,
    };
  });
  const payload = {
    event: request.event,
    studyContext: request.studyContext,
    claims,
  };
  let serialized = JSON.stringify(payload);
  while (utf8ByteLength(serialized) > SCREEN_03_INTERPRETATION_MAX_REQUEST_BYTES) {
    const excess = utf8ByteLength(serialized) -
      SCREEN_03_INTERPRETATION_MAX_REQUEST_BYTES;
    const evidenceCount = claims.reduce(
      (count, item) => count + item.evidence.length,
      0,
    );
    if (evidenceCount > 0) {
      const reduction = Math.ceil(excess / evidenceCount) + 8;
      for (const item of claims) {
        item.evidence = item.evidence
          .map((text) => text.slice(0, Math.max(0, text.length - reduction)))
          .filter((text) => text.length >= 40);
      }
    } else {
      const reducible = claims.filter((item) => item.claim.length > 80);
      if (reducible.length === 0) break;
      const reduction = Math.ceil(excess / reducible.length) + 8;
      for (const item of reducible) {
        item.claim = item.claim.slice(
          0,
          Math.max(80, item.claim.length - reduction),
        );
      }
    }
    serialized = JSON.stringify(payload);
  }
  if (utf8ByteLength(serialized) > SCREEN_03_INTERPRETATION_MAX_REQUEST_BYTES) {
    throw new Error("The bounded Screen 3 interpretation request is too large.");
  }
  return payload;
}

function referencedTexts(
  passageIds: readonly string[],
  passages: ReadonlyMap<string, Screen03InterpretationRequestPassage>,
) {
  return passageIds
    .map((passageId) => passages.get(passageId)?.text)
    .filter((text): text is string => text !== undefined);
}

function textIsParaphrase(text: string, sourceText: readonly string[]) {
  const normalized = normalizedToken(text);
  if (normalized.length === 0) return false;
  const outputWords = normalized.split(" ");
  const outputWordCount = outputWords.length;
  return sourceText.every((source) => {
    const normalizedSource = normalizedToken(source);
    if (normalized === normalizedSource) return false;
    const sourceWords = normalizedSource.split(" ");
    const sourceWordCount = sourceWords.length;
    // A heading or stock lead-in wrapped around a copied claim is not a
    // plain-language explanation. Avoid applying this containment rule to
    // very short labels or identifiers; exact equality is still rejected.
    if (
      Math.min(outputWordCount, sourceWordCount) >= 6 &&
      (normalized.includes(normalizedSource) ||
        normalizedSource.includes(normalized))
    ) {
      return false;
    }

    // Also reject a copied claim with only a leading word removed or another
    // small edge edit. Containment alone misses that failure mode even though
    // most of the source wording remains a single uninterrupted run.
    const minimumWordCount = Math.min(outputWordCount, sourceWordCount);
    if (minimumWordCount < 8) return true;
    let previous = new Array(sourceWordCount + 1).fill(0);
    let longestSharedRun = 0;
    for (const outputWord of outputWords) {
      const current = new Array(sourceWordCount + 1).fill(0);
      for (let index = 1; index <= sourceWordCount; index += 1) {
        if (outputWord === sourceWords[index - 1]) {
          current[index] = previous[index - 1] + 1;
          longestSharedRun = Math.max(longestSharedRun, current[index]);
        }
      }
      previous = current;
    }
    return longestSharedRun < Math.max(
      6,
      Math.ceil(minimumWordCount * 0.75),
    );
  });
}

const GROUNDING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "backed",
  "but",
  "by",
  "can",
  "claim",
  "cited",
  "could",
  "define",
  "describes",
  "did",
  "do",
  "does",
  "for",
  "from",
  "gives",
  "had",
  "has",
  "have",
  "how",
  "help",
  "hypothesis",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "language",
  "may",
  "might",
  "more",
  "must",
  "new",
  "of",
  "on",
  "or",
  "over",
  "places",
  "plain",
  "point",
  "practical",
  "key",
  "related",
  "relevant",
  "research",
  "sample",
  "shall",
  "should",
  "states",
  "source",
  "that",
  "terms",
  "the",
  "their",
  "them",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "under",
  "untested",
  "was",
  "way",
  "were",
  "what",
  "while",
  "which",
  "will",
  "with",
  "without",
  "would",
]);

/**
 * A deliberately small plain-language equivalence table. These aliases cover
 * common explanation words without turning the validator into an inference
 * engine. Grounding still requires multiple distinct concepts from the exact
 * cited proposal/passages and a material share of the generated sentence.
 */
const GROUNDING_TOKEN_ALIASES: Readonly<Record<string, string>> = {
  activities: "processing",
  activity: "processing",
  applies: "apply",
  application: "apply",
  applications: "apply",
  ask: "request",
  asks: "request",
  asked: "request",
  asking: "request",
  businesses: "business",
  categories: "category",
  companies: "business",
  company: "business",
  collected: "collect",
  collecting: "collect",
  collects: "collect",
  consumers: "consumer",
  covered: "cover",
  covering: "cover",
  coverage: "cover",
  data: "information",
  deleted: "delete",
  deletes: "delete",
  deleting: "delete",
  details: "information",
  disclosed: "disclose",
  discloses: "disclose",
  disclosing: "disclose",
  duties: "duty",
  explain: "disclose",
  explained: "disclose",
  explains: "disclose",
  explaining: "disclose",
  exemptions: "exception",
  firms: "business",
  gathered: "collect",
  gathering: "collect",
  gathers: "collect",
  individuals: "consumer",
  kinds: "category",
  obligations: "duty",
  organizations: "business",
  people: "consumer",
  persons: "consumer",
  reason: "purpose",
  reasons: "purpose",
  remove: "delete",
  removed: "delete",
  removes: "delete",
  removing: "delete",
  requests: "request",
  requested: "request",
  requesting: "request",
  residents: "consumer",
  responsibilities: "duty",
  rights: "right",
  seek: "request",
  seeking: "request",
  seeks: "request",
  sought: "request",
  types: "category",
  used: "use",
  uses: "use",
  using: "use",
  why: "purpose",
};

const HOST_GROUNDING_MINIMUM_SUPPORT_RATIO = 0.55;
const HOST_STUDY_GROUNDING_MINIMUM_SUPPORT_RATIO = 0.45;
const HOST_SNAPSHOT_GROUNDING_MINIMUM_SUPPORT_RATIO = 0.4;
const HOST_SNAPSHOT_CONNECTIVE_TOKENS = new Set([
  "broadly",
  "essentially",
  "generally",
  "overall",
  "simply",
  "together",
]);

function groundingTokens(value: string) {
  return unique(
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 3 && !GROUNDING_STOP_WORDS.has(token))
      .map((token) => GROUNDING_TOKEN_ALIASES[token] ?? token) ?? [],
  );
}

function groundingClauses(value: string) {
  return value
    .split(
      /(?:[.!?;:()[\]{}]+|,\s*|\s*[\u2013\u2014]\s*|\s+-\s+|\s+(?:(?:as a result|such as)|and|or|nor|but|yet|while|whereas|although|though|however|because|since|so|therefore|thus|hence|plus|including|excluding|namely|meaning)\s+)/iu,
    )
    .map((clause) => clause.trim())
    .filter((clause) => groundingTokens(clause).length > 0);
}

function hasSubstantiveGrounding(
  text: string,
  evidenceText: readonly string[],
  contextText: readonly string[] = [],
  minimumSupportRatio = HOST_GROUNDING_MINIMUM_SUPPORT_RATIO,
  allowSnapshotConnectives = false,
) {
  const outputTokens = groundingTokens(text);
  const evidenceTokens = new Set(evidenceText.flatMap(groundingTokens));
  const contextTokens = new Set(contextText.flatMap(groundingTokens));
  if (outputTokens.length === 0 || evidenceTokens.size === 0) return false;

  const evidenceMatches = outputTokens.filter((token) =>
    evidenceTokens.has(token)
  );
  const supportedMatches = outputTokens.filter((token) =>
    evidenceTokens.has(token) || contextTokens.has(token)
  );
  const minimumEvidenceMatches = Math.min(2, evidenceTokens.size);
  if (
    evidenceMatches.length < minimumEvidenceMatches ||
    supportedMatches.length / outputTokens.length < minimumSupportRatio
  ) {
    return false;
  }

  // Whole-sentence density alone is insufficient: a model could repeat enough
  // source vocabulary to hide a separate unsupported assertion after a comma
  // or conjunction. Check every substantive clause independently. A clause
  // made entirely from signed study-context labels is allowed (for example,
  // an introductory "For California technology firms" phrase), but every
  // other clause must carry its own evidence concept and support density.
  return groundingClauses(text).every((clause) => {
    const clauseTokens = groundingTokens(clause);
    if (
      allowSnapshotConnectives && clauseTokens.length > 0 &&
      clauseTokens.every((token) => HOST_SNAPSHOT_CONNECTIVE_TOKENS.has(token))
    ) return true;
    const clauseEvidenceMatches = clauseTokens.filter((token) =>
      evidenceTokens.has(token)
    );
    const clauseSupportedMatches = clauseTokens.filter((token) =>
      evidenceTokens.has(token) || contextTokens.has(token)
    );
    if (
      clauseEvidenceMatches.length === 0 &&
      clauseTokens.every((token) => contextTokens.has(token))
    ) {
      return true;
    }
    return clauseEvidenceMatches.length >= 1 &&
      clauseSupportedMatches.length / clauseTokens.length >= minimumSupportRatio;
  });
}

function groundingContextText(request: Screen03InterpretationRequest) {
  return [
    request.event.canonicalTitle,
    request.event.eventType,
    request.event.issuingJurisdiction ?? "",
    ...Object.values(request.studyContext),
  ];
}

function containsNormalizedPhrase(value: string, phrase: string) {
  const normalizedPhrase = normalizedToken(phrase);
  return normalizedPhrase.length === 0 ||
    normalizedToken(value).includes(normalizedPhrase);
}

function canonicalReferences(
  proposalIds: readonly string[],
  request: Screen03InterpretationRequest,
) {
  const proposalById = new Map(
    request.proposals.map((proposal) => [proposal.proposalId, proposal]),
  );
  const passageById = new Map(
    request.passages.map((passage) => [passage.passageId, passage]),
  );
  const proposals = proposalIds.map((proposalId) =>
    proposalById.get(proposalId)
  );
  if (proposals.some((proposal) => proposal === undefined)) return null;

  const passageIds: string[] = [];
  const addPassage = (passageId: string | undefined) => {
    if (
      passageId !== undefined && passageById.has(passageId) &&
      !passageIds.includes(passageId) &&
      passageIds.length < SCREEN_03_INTERPRETATION_MAX_REFERENCES
    ) {
      passageIds.push(passageId);
    }
  };
  const selectedByProposal = proposals.map((proposal) =>
    canonicalProposalPassageIds(proposal!, passageById)
  );
  for (const selected of selectedByProposal) addPassage(selected[0]);
  if (
    selectedByProposal.some((selected) =>
      !selected.some((passageId) => passageIds.includes(passageId))
    )
  ) return null;

  // A second source is attached only when it directly owns the same proposal;
  // a merely same-group passage is not treated as corroboration.
  for (const selected of selectedByProposal) addPassage(selected[1]);
  return {
    proposalIds: [...proposalIds],
    passageIds,
    evidenceIds: unique(passageIds.map(
      (passageId) => passageById.get(passageId)!.evidenceId,
    )),
  };
}

function serverOwnedStudyFallbackBlock(
  kind: "sample" | "outcome",
  request: Screen03InterpretationRequest,
): Screen03InterpretationBlock | null {
  const preferredGroups = kind === "sample"
    ? ["eligibility", "identity", "overview", "component", "amendment"]
    : ["component", "amendment", "overview", "identity", "eligibility"];
  const proposal = preferredGroups
    .map((group) =>
      request.proposals.find((candidate) => candidate.group === group)
    )
    .find((candidate) => candidate !== undefined) ?? request.proposals[0];
  if (!proposal) return null;
  const references = canonicalReferences([proposal.proposalId], request);
  if (!references) return null;
  return {
    text: kind === "sample"
      ? "How these claims relate to the selected sample remains unclear; review the cited coverage and event claims directly."
      : "How these claims may relate to the selected outcome remains an untested research-design hypothesis.",
    ...references,
  };
}

function restoreModelBlock(
  value: unknown,
  request: Screen03InterpretationRequest,
  options: {
    requireModalOutcome?: boolean;
    requireStudyLabel?: "sample" | "outcome";
    requireSubstantiveGrounding?: boolean;
    groundingMinimumSupportRatio?: number;
    allowSnapshotConnectives?: boolean;
  } = {},
): Screen03InterpretationBlock | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["text", "proposalIds"]) ||
    !boundedStringArray(
      value.proposalIds,
      1,
      SCREEN_03_INTERPRETATION_MAX_REFERENCES,
    )
  ) {
    return null;
  }
  const proposalIds = value.proposalIds;
  const text = value.text;
  const references = canonicalReferences(proposalIds, request);
  if (!references) return null;
  const passageIds = references.passageIds;
  const passageById = new Map(
    request.passages.map((passage) => [passage.passageId, passage]),
  );
  const proposalById = new Map(
    request.proposals.map((proposal) => [proposal.proposalId, proposal]),
  );
  const proposals = proposalIds.map((id) => proposalById.get(id)!);
  const sourceText = referencedTexts(passageIds, passageById);
  const paraphraseSources = options.requireSubstantiveGrounding
    ? [
        ...sourceText,
        ...proposals.flatMap((proposal) => [proposal.label, proposal.value]),
      ]
    : sourceText;
  const allowedDigitText = [
    ...sourceText,
    ...Object.values(request.studyContext),
    ...proposals.flatMap((proposal) => [proposal!.label, proposal!.value]),
  ];
  if (
    !safePlainText(text, MAX_BLOCK_TEXT, allowedDigitText, {
      requireModalOutcome: options.requireModalOutcome,
      outcomeFamily: request.studyContext.outcomeFamily,
    }) || !textIsParaphrase(text, paraphraseSources) ||
    (options.requireSubstantiveGrounding &&
      !hasSubstantiveGrounding(
        text,
        [
          ...sourceText,
          ...proposals.flatMap((proposal) => [proposal.label, proposal.value]),
        ],
        groundingContextText(request),
        options.groundingMinimumSupportRatio ??
          (options.requireStudyLabel
            ? HOST_STUDY_GROUNDING_MINIMUM_SUPPORT_RATIO
            : HOST_GROUNDING_MINIMUM_SUPPORT_RATIO),
        options.allowSnapshotConnectives ?? false,
      ))
  ) {
    return null;
  }
  if (
    options.requireStudyLabel === "outcome" &&
    request.studyContext.outcomeFamily !== "Unspecified" &&
    !containsNormalizedPhrase(text, request.studyContext.outcomeFamily)
  ) {
    return null;
  }
  if (options.requireStudyLabel === "sample") {
    const labels = [
      request.studyContext.population,
      request.studyContext.industry,
      request.studyContext.geography,
    ].filter((label) => label !== "Unspecified");
    if (
      labels.length > 0 &&
      !labels.some((label) => containsNormalizedPhrase(text, label))
    ) {
      return null;
    }
  }
  return {
    text,
    ...references,
  };
}

function restoreClaimExplanation(
  value: unknown,
  request: Screen03InterpretationRequest,
  requireSubstantiveGrounding = false,
): Screen03Interpretation["claimExplanations"][number] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["proposalId", "text"]) ||
    typeof value.proposalId !== "string"
  ) {
    return null;
  }
  const text = value.text;
  const proposal = request.proposals.find(
    (candidate) => candidate.proposalId === value.proposalId,
  );
  if (!proposal) return null;
  const references = canonicalReferences([proposal.proposalId], request);
  if (!references) return null;
  const passageIds = references.passageIds;
  const passageById = new Map(
    request.passages.map((passage) => [passage.passageId, passage]),
  );
  const sourceText = referencedTexts(passageIds, passageById);
  if (
    !safePlainText(
      text,
      MAX_EXPLANATION_TEXT,
      [
        ...sourceText,
        ...Object.values(request.studyContext),
        proposal.label,
        proposal.value,
      ],
      { outcomeFamily: request.studyContext.outcomeFamily },
    ) ||
    !textIsParaphrase(text, [...sourceText, proposal.value]) ||
    (requireSubstantiveGrounding &&
      !hasSubstantiveGrounding(
        text,
        [...sourceText, proposal.label, proposal.value],
      ))
  ) {
    return null;
  }
  return {
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
    text,
    passageIds: references.passageIds,
    evidenceIds: references.evidenceIds,
  };
}

function requiredHostSnapshotBreadth(
  request: Screen03InterpretationRequest,
) {
  const distinctProposalIds = new Set(
    request.proposals.map((proposal) => proposal.proposalId),
  );
  const distinctGroups = new Set(
    request.proposals
      .map((proposal) => proposal.group)
      .filter((group) => group !== "identity"),
  );
  // Sparse evidence can support a useful one- or two-point briefing. Once the
  // bounded packet contains at least three independently reviewable claims
  // spanning more than one topic group, require the model to provide the
  // practical breadth promised by the task instead of collapsing everything
  // into one repetitive bullet.
  const keyPointCount = distinctProposalIds.size >= 3 &&
      distinctGroups.size >= 2
    ? 3
    : 1;
  return {
    keyPointCount,
    groupCount: keyPointCount > 1 ? Math.min(3, distinctGroups.size) : 0,
  };
}

function modelGlobalAllowedText(request: Screen03InterpretationRequest) {
  return [
    request.event.canonicalTitle,
    request.event.eventType,
    request.event.issuingJurisdiction ?? "",
    ...Object.values(request.studyContext),
    ...request.proposals.flatMap((proposal) => [proposal.label, proposal.value]),
    ...request.passages.map((passage) => passage.text),
  ];
}

function restoreScreen03InterpretationForOrigin(
  value: unknown,
  request: Screen03InterpretationRequest,
  origin: "workers-ai" | "chatgpt-host",
  studyContext: Screen03InterpretationStudyContext,
): Screen03Interpretation | null {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return null;
  }
  const hostDraft = origin === "chatgpt-host";
  if (
    typeof serialized !== "string" ||
    utf8ByteLength(serialized) > MAX_MODEL_RESPONSE_BYTES || !isRecord(value) ||
    !Object.keys(value).every((key) =>
      ["snapshot", "studyRelevance", "claimExplanations"].includes(key)
    ) ||
    !Object.prototype.hasOwnProperty.call(value, "snapshot") ||
    !isRecord(value.snapshot) ||
    !hasExactKeys(value.snapshot, ["intro", "keyPoints"]) ||
    !Array.isArray(value.snapshot.keyPoints) ||
    value.snapshot.keyPoints.length < 1 ||
    value.snapshot.keyPoints.length > SCREEN_03_INTERPRETATION_MAX_KEY_POINTS
  ) {
    return null;
  }
  const claimExplanationCandidates = Array.isArray(value.claimExplanations)
    ? value.claimExplanations
    : hostDraft && !Object.prototype.hasOwnProperty.call(
        value,
        "claimExplanations",
      )
      ? []
      : null;
  if (
    claimExplanationCandidates === null ||
    claimExplanationCandidates.length > SCREEN_03_INTERPRETATION_MAX_PROPOSALS
  ) return null;
  const studyRelevance = isRecord(value.studyRelevance)
    ? value.studyRelevance
    : {};
  const providedStudyRelevance = isRecord(value.studyRelevance);
  const requireSubstantiveGrounding = hostDraft;
  const intro = restoreModelBlock(value.snapshot.intro, request, {
    requireSubstantiveGrounding,
    ...(hostDraft
      ? {
          groundingMinimumSupportRatio:
            HOST_SNAPSHOT_GROUNDING_MINIMUM_SUPPORT_RATIO,
          allowSnapshotConnectives: true,
        }
      : {}),
  });
  if (!intro) return null;
  const keyPoints: Screen03InterpretationBlock[] = [];
  let omittedInvalidReaderHelp = false;
  for (const candidate of value.snapshot.keyPoints) {
    const restored = restoreModelBlock(candidate, request, {
      requireSubstantiveGrounding,
      ...(hostDraft
        ? {
            groundingMinimumSupportRatio:
              HOST_SNAPSHOT_GROUNDING_MINIMUM_SUPPORT_RATIO,
            allowSnapshotConnectives: true,
          }
        : {}),
    });
    if (
      !restored || keyPoints.some((item) => item.text === restored.text)
    ) {
      omittedInvalidReaderHelp = true;
      continue;
    }
    keyPoints.push(restored);
  }
  const requiredSnapshotBreadth = hostDraft
    ? requiredHostSnapshotBreadth(request)
    : { keyPointCount: 1, groupCount: 0 };
  const coveredKeyPointProposalIds = new Set(
    keyPoints.flatMap((point) => point.proposalIds),
  );
  const proposalGroupById = new Map(
    request.proposals.map((proposal) => [proposal.proposalId, proposal.group]),
  );
  const coveredKeyPointGroups = new Set(
    [...coveredKeyPointProposalIds]
      .map((proposalId) => proposalGroupById.get(proposalId))
      .filter((group) => group !== undefined && group !== "identity"),
  );
  if (
    keyPoints.length < requiredSnapshotBreadth.keyPointCount ||
    coveredKeyPointProposalIds.size < requiredSnapshotBreadth.keyPointCount ||
    coveredKeyPointGroups.size < requiredSnapshotBreadth.groupCount
  ) return null;
  let sampleConnection = restoreModelBlock(
    studyRelevance.sampleConnection,
    request,
    { requireStudyLabel: "sample", requireSubstantiveGrounding },
  );
  let outcomeConnection = restoreModelBlock(
    studyRelevance.outcomeConnection,
    request,
    {
      requireModalOutcome: true,
      requireStudyLabel: "outcome",
      requireSubstantiveGrounding,
    },
  );
  if (!sampleConnection) {
    sampleConnection = serverOwnedStudyFallbackBlock("sample", request);
    if (!hostDraft || providedStudyRelevance) omittedInvalidReaderHelp = true;
  }
  if (!outcomeConnection) {
    outcomeConnection = serverOwnedStudyFallbackBlock("outcome", request);
    if (!hostDraft || providedStudyRelevance) omittedInvalidReaderHelp = true;
  }
  if (!sampleConnection || !outcomeConnection) return null;
  const claimExplanations: Screen03Interpretation["claimExplanations"] = [];
  const explainedProposalIds = new Set<string>();
  for (const candidate of claimExplanationCandidates) {
    const restored = restoreClaimExplanation(
      candidate,
      request,
      requireSubstantiveGrounding,
    );
    if (!restored || explainedProposalIds.has(restored.proposalId)) {
      omittedInvalidReaderHelp = true;
      continue;
    }
    explainedProposalIds.add(restored.proposalId);
    claimExplanations.push(restored);
  }
  if (!hostDraft && explainedProposalIds.size !== request.proposals.length) {
    omittedInvalidReaderHelp = true;
  }
  return {
    protocolVersion: SCREEN_03_INTERPRETATION_PROTOCOL_VERSION,
    origin,
    nonCanonical: true,
    studyContext,
    snapshot: {
      intro,
      keyPoints,
    },
    studyRelevance: {
      sampleConnection,
      outcomeConnection,
      caveat: SCREEN_03_INTERPRETATION_CAVEAT,
    },
    claimExplanations,
    limitations: omittedInvalidReaderHelp
      ? [
        "Some generated reader help was omitted after independent validation. Exact source-backed claims remain authoritative.",
      ]
      : [],
    outcomeValuesInspected: false,
  };
}

/** Restore a previously persisted legacy Workers AI draft. */
export function restoreScreen03Interpretation(
  value: unknown,
  request: Screen03InterpretationRequest,
  handoff: Screen02WorkflowHandoff,
): Screen03Interpretation | null {
  return restoreScreen03InterpretationForOrigin(
    value,
    request,
    "workers-ai",
    studyContextFromHandoff(handoff),
  );
}

/**
 * Validate an untrusted ChatGPT-host draft and derive all evidence references
 * from the signed request. The model cannot supply canonical citation IDs.
 */
export function restoreScreen03HostInterpretation(
  value: unknown,
  request: Screen03InterpretationRequest,
): Screen03Interpretation | null {
  return restoreScreen03InterpretationForOrigin(
    value,
    request,
    "chatgpt-host",
    request.studyContext,
  );
}

function fallbackReferences(
  sourceIds: readonly string[],
  packet: Screen03ResearchPacket,
  request: Screen03InterpretationRequest,
) {
  const evidenceIds = new Set(
    packet.evidence
      .filter(
        (item) =>
          item.status !== "changed" &&
          (sourceIds.includes(item.id) ||
            (item.sourceId !== null && sourceIds.includes(item.sourceId))),
      )
      .map((item) => item.id),
  );
  const selectedPassages = request.passages.filter(
    (passage) =>
      evidenceIds.has(passage.evidenceId) &&
      request.proposals.some((proposal) =>
        proposal.ownPassageIds.includes(passage.passageId)
      ),
  );
  const distinctPassages: Screen03InterpretationRequestPassage[] = [];
  const selectedSources = new Set<string>();
  for (const passage of selectedPassages) {
    const owner = sourceOwnerId(passage);
    if (selectedSources.has(owner)) continue;
    selectedSources.add(owner);
    distinctPassages.push(passage);
    if (distinctPassages.length >= 2) break;
  }
  const passageIds = distinctPassages.map((passage) => passage.passageId);
  const proposalIds = unique(
    distinctPassages.flatMap((passage) =>
      request.proposals
        .filter((proposal) =>
          proposal.ownPassageIds.includes(passage.passageId)
        )
        .map((proposal) => proposal.proposalId)
        .slice(0, 1)
    ),
  );
  return {
    proposalIds,
    passageIds,
    evidenceIds: distinctPassages.map((passage) => passage.evidenceId),
  };
}

const BRIEFING_RIGHTS =
  /\b(?:right|rights|access|delete|deletion|opt[- ]?out|non[- ]?discrimination|protect(?:ion|ed)?|entitl(?:e|ed|ement))\b/iu;
const BRIEFING_DUTIES =
  /\b(?:duty|duties|must|required|requirement|obligation|prohibit(?:s|ed|ion)?|compliance|disclos(?:e|ure)|notify|notification|report(?:ing)?|standard)\b/iu;
const BRIEFING_ENFORCEMENT =
  /\b(?:enforc(?:e|ed|ement)|penalt(?:y|ies)|fine|remed(?:y|ies)|violation|regulator|attorney general)\b/iu;
const BRIEFING_PRACTICAL_TIMING =
  /\b(?:effective|operative|application|appl(?:y|ies|ied)|compliance|commenc(?:e|es|ed|ement)|takes? effect|went into effect)\b/iu;
const BRIEFING_SUBSTANTIVE_ACTION =
  /\b(?:appl(?:y|ies|ied)|chang(?:e|es|ed)|control(?:s|led)?|creat(?:e|es|ed)|establish(?:es|ed)?|expand(?:s|ed)?|giv(?:e|es|en)|govern(?:s|ed)?|grant(?:s|ed)?|limit(?:s|ed)?|protect(?:s|ed)?|prohibit(?:s|ed)?|regulat(?:e|es|ed)|requir(?:e|es|ed)|set(?:s)?|strengthen(?:s|ed)?|support(?:s|ed)?|update(?:s|d)?)\b/iu;

function boundedBriefingText(...parts: string[]) {
  const compact = parts.join(" ").replace(/\s+/gu, " ").trim();
  if (compact.length <= MAX_BLOCK_TEXT) return compact;
  const candidate = compact.slice(0, MAX_BLOCK_TEXT - 1);
  const wordBoundary = candidate.lastIndexOf(" ");
  return `${candidate
    .slice(0, Math.max(80, wordBoundary))
    .replace(/[,:;.-]+$/u, "")
    .trim()}…`;
}

function briefingClaimText(
  proposal: Screen03InterpretationRequestProposal,
) {
  const beforeShareControl = proposal.value.split(
    /\bSHARE\s+THIS\s*:/iu,
    1,
  )[0] ?? "";
  let text = beforeShareControl
    .replace(
      /^(?:key (?:duties|rights|timing)|duties|requirements|rights|protections|who or what is covered|what changed|event identity|enforcement|later changes)(?:\s+or\s+\w+)?\s*:\s*/iu,
      "",
    )
    .replace(/\s+Date Published\s*:[^.]*\.?\s*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return "";

  if (proposal.group === "timeline" && /^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    const label = proposal.label
      .replace(/[.:;\s]+$/u, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (label) {
      text = /\bdate$/iu.test(label)
        ? `${label} is ${text}`
        : `${label} on ${text}`;
    }
  }
  return boundedBriefingText(
    /[.!?]$/u.test(text) ? text : `${text}.`,
  );
}

/**
 * Produce immediate reader help from the same active, directly supported
 * proposals that back the review cards. This is deliberately deterministic:
 * a slow or rejected model response can improve the wording later, but it can
 * never leave the main event briefing empty.
 */
function sourceDerivedBriefing(
  request: Screen03InterpretationRequest,
): Screen03Interpretation["snapshot"] {
  const usable = request.proposals.filter((proposal) =>
    briefingClaimText(proposal).length > 0
  );
  const firstInGroup = (group: Screen03InterpretationRequestProposal["group"]) =>
    usable.find((proposal) => proposal.group === group);
  const substantiveInGroup = (
    group: Screen03InterpretationRequestProposal["group"],
  ) => usable.find((proposal) =>
    proposal.group === group &&
    BRIEFING_SUBSTANTIVE_ACTION.test(
      `${proposal.label} ${briefingClaimText(proposal)}`,
    )
  );
  const identity = firstInGroup("identity");
  // Search pages often emit a title/jurisdiction/date sentence as the first
  // overview. Prefer a supported statement about what the event actually does
  // so source order cannot recreate a metadata-only briefing.
  const substantiveLead = substantiveInGroup("overview") ??
    substantiveInGroup("component");
  const lead = substantiveLead ??
    firstInGroup("overview") ??
    firstInGroup("component") ??
    firstInGroup("eligibility") ?? firstInGroup("amendment") ??
    firstInGroup("timeline") ?? identity ?? usable[0];
  const introProposalIds = unique(
    [lead?.proposalId].filter(
      (value): value is string => value !== undefined,
    ),
  );
  const leadReferences = introProposalIds.length > 0
    ? canonicalReferences(introProposalIds, request)
    : null;
  const intro = {
    // The panel heading already supplies the canonical event title. Keep the
    // prose itself strictly extractive so a component passage cannot appear to
    // support uncited event-type or jurisdiction metadata.
    text: introProposalIds.length > 0
      ? boundedBriefingText(
        ...introProposalIds.map((proposalId) =>
          briefingClaimText(request.proposals.find((proposal) =>
            proposal.proposalId === proposalId
          )!)
        ),
      )
      : "No directly supported overview is available yet.",
    ...(leadReferences ?? {
      proposalIds: [],
      passageIds: [],
      evidenceIds: [],
    }),
  };

  const usedProposalIds = new Set([
    ...introProposalIds,
    ...(identity && identity.proposalId !== lead?.proposalId
      ? [identity.proposalId]
      : []),
  ]);
  const usedValues = new Set(
    introProposalIds.map((proposalId) =>
      normalizedToken(
        briefingClaimText(request.proposals.find((proposal) =>
          proposal.proposalId === proposalId
        )!),
      )
    ),
  );
  const points: Screen03InterpretationBlock[] = [];
  const pointCandidates = substantiveLead
    ? usable.filter((proposal) =>
      proposal.group !== "overview" ||
      BRIEFING_SUBSTANTIVE_ACTION.test(
        `${proposal.label} ${briefingClaimText(proposal)}`,
      ) ||
      !/(?:\bevent metadata\b|\bSHARE\s+THIS\b|\bDate Published\b)/iu.test(
        `${proposal.label} ${proposal.value}`,
      )
    )
    : usable;
  const addPoint = (
    proposal: Screen03InterpretationRequestProposal | undefined,
  ) => {
    if (!proposal || usedProposalIds.has(proposal.proposalId)) return;
    const pointText = briefingClaimText(proposal);
    const normalizedValue = normalizedToken(pointText);
    if (!normalizedValue || usedValues.has(normalizedValue)) return;
    const references = canonicalReferences([proposal.proposalId], request);
    if (!references) return;
    usedProposalIds.add(proposal.proposalId);
    usedValues.add(normalizedValue);
    points.push({
      text: pointText,
      ...references,
    });
  };
  const unusedInGroup = (
    group: Screen03InterpretationRequestProposal["group"],
    preferred?: RegExp,
  ) => pointCandidates.find((proposal) =>
    proposal.group === group && !usedProposalIds.has(proposal.proposalId) &&
    (!preferred || preferred.test(`${proposal.label} ${briefingClaimText(proposal)}`))
  );

  // The lead normally explains what the event is or changed. Prioritize the
  // practical dimensions readers most often need in the remaining slots.
  addPoint(
    unusedInGroup("component", BRIEFING_RIGHTS) ??
      unusedInGroup("component", BRIEFING_DUTIES) ??
      unusedInGroup("component"),
  );
  addPoint(
    pointCandidates.find((proposal) =>
      proposal.group === "eligibility" &&
      !usedProposalIds.has(proposal.proposalId) &&
      !numericEligibilityThreshold(proposal)
    ) ?? unusedInGroup("eligibility"),
  );
  // Readers normally need the date on which the rule actually applied more
  // than a second announcement or enactment milestone. Earlier dates can
  // still enter the remaining source-backed slots.
  addPoint(
    unusedInGroup("timeline", BRIEFING_PRACTICAL_TIMING) ??
      unusedInGroup("timeline"),
  );
  addPoint(
    unusedInGroup("amendment", BRIEFING_ENFORCEMENT) ??
      pointCandidates.find((proposal) =>
        !usedProposalIds.has(proposal.proposalId) &&
        BRIEFING_ENFORCEMENT.test(`${proposal.label} ${briefingClaimText(proposal)}`)
      ) ?? unusedInGroup("amendment"),
  );
  // Keep one explicitly versioned numeric threshold alongside the general
  // coverage point. A single distinct undated claim is also safe to prioritize;
  // conflicting undated variants remain excluded from this slot.
  addPoint(preferredNumericEligibilityThreshold(
    pointCandidates.filter((proposal) =>
      !usedProposalIds.has(proposal.proposalId)
    ),
  ));
  for (const group of [
    "component",
    "overview",
    "eligibility",
    "timeline",
    "amendment",
    "identity",
  ] as const) {
    for (const proposal of pointCandidates) {
      if (points.length >= SCREEN_03_INTERPRETATION_MAX_KEY_POINTS) break;
      if (proposal.group === group) addPoint(proposal);
    }
  }
  return {
    intro,
    keyPoints: points.slice(0, SCREEN_03_INTERPRETATION_MAX_KEY_POINTS),
  };
}

function fallbackInterpretation(
  packet: Screen03ResearchPacket,
  handoff: Screen02WorkflowHandoff,
  request: Screen03InterpretationRequest,
): Screen03Interpretation {
  const assessment = handoff.preliminaryAssessment;
  const completed = !("status" in assessment);
  const globalAllowedText = modelGlobalAllowedText(request);
  const reusableStudyFit = completed && safePlainText(
    assessment.studyFit.explanation,
    MAX_BLOCK_TEXT,
    globalAllowedText,
    { outcomeFamily: request.studyContext.outcomeFamily },
  )
    ? assessment.studyFit
    : null;
  const reusableOutcomePathway = completed && safePlainText(
    assessment.outcomePathway.explanation,
    MAX_BLOCK_TEXT,
    globalAllowedText,
    {
      requireModalOutcome: true,
      outcomeFamily: request.studyContext.outcomeFamily,
    },
  ) && containsNormalizedPhrase(
    assessment.outcomePathway.explanation,
    request.studyContext.outcomeFamily,
  )
    ? assessment.outcomePathway
    : null;
  const reused = reusableStudyFit !== null || reusableOutcomePathway !== null;
  const studyFitReferences = reusableStudyFit
    ? fallbackReferences(reusableStudyFit.evidenceSourceIds, packet, request)
    : { proposalIds: [], passageIds: [], evidenceIds: [] };
  const outcomeReferences = reusableOutcomePathway
    ? fallbackReferences(
      reusableOutcomePathway.evidenceSourceIds,
      packet,
      request,
    )
    : { proposalIds: [], passageIds: [], evidenceIds: [] };
  const briefing = sourceDerivedBriefing(request);
  return {
    protocolVersion: SCREEN_03_INTERPRETATION_PROTOCOL_VERSION,
    origin: reused ? "screen02-reuse" : "unavailable",
    nonCanonical: true,
    studyContext: studyContextFromHandoff(handoff),
    snapshot: briefing,
    studyRelevance: {
      sampleConnection: {
        text: reusableStudyFit?.explanation ?? UNAVAILABLE_SAMPLE_CONNECTION,
        ...studyFitReferences,
      },
      outcomeConnection: {
        text: reusableOutcomePathway?.explanation ??
          UNAVAILABLE_OUTCOME_CONNECTION,
        ...outcomeReferences,
      },
      caveat: SCREEN_03_INTERPRETATION_CAVEAT,
    },
    claimExplanations: [],
    limitations: [
      reused
        ? "The concise event briefing was assembled from active directly supported claims; the bounded Screen 2 study assessment supplies the separate study-relevance context."
        : "The concise event briefing was assembled deterministically from active directly supported claims while ChatGPT wording was unavailable. Exact passages remain authoritative.",
    ],
    outcomeValuesInspected: false,
  };
}

type Screen03InterpretationFailure =
  | "timeout"
  | "aborted"
  | "response-invalid"
  | "draft-rejected"
  | "draft-partial"
  | "inference-error";

function classifyInterpretationFailure(
  error: unknown,
): Exclude<
  Screen03InterpretationFailure,
  "draft-rejected" | "draft-partial"
> {
  if (error instanceof Screen03InterpretationResponseError) {
    return "response-invalid";
  }
  const name = isRecord(error) && typeof error.name === "string"
    ? error.name
    : "";
  const message = isRecord(error) && typeof error.message === "string"
    ? error.message
    : "";
  if (name === "AbortError" && /timed out/iu.test(message)) return "timeout";
  if (name === "AbortError") return "aborted";
  return "inference-error";
}

function reportInterpretationFailure(
  failure: Screen03InterpretationFailure,
  elapsedMs: number,
  proposalCount: number,
  acceptedExplanationCount: number,
) {
  const durationBucket = elapsedMs < 1_000
    ? "under-1s"
    : elapsedMs < 5_000
      ? "1s-to-5s"
      : elapsedMs < 15_000
        ? "5s-to-15s"
        : "15s-or-more";
  console.error("ShockAudit Screen 3 interpretation did not fully validate.", {
    failure,
    proposalCount,
    acceptedExplanationCount,
    durationBucket,
  });
}

async function invokeBoundedInterpreter(
  interpreter: Screen03Interpreter,
  request: Screen03InterpretationRequest,
  parentSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (controller.signal.aborted) {
      throw new DOMException("Screen 3 interpretation aborted", "AbortError");
    }
    return await Promise.race([
      interpreter(request, { signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new DOMException(
              "Screen 3 interpretation timed out",
              "AbortError",
            ),
          );
        }, SCREEN_03_INTERPRETATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

type InterpretableResearchPacket = Screen03ResearchPacket & {
  interpretation?: Screen03Interpretation;
};

/**
 * Enrich a final packet without changing any canonical evidence or proposal.
 * Missing, late, failed, or invalid inference always degrades to a bounded
 * informational fallback and never changes research coverage or lock gates.
 */
export async function interpretScreen03Packet(input: {
  packet: Screen03ResearchPacket;
  handoff: Screen02WorkflowHandoff;
  interpreter?: Screen03Interpreter;
  signal?: AbortSignal;
}): Promise<Screen03ResearchPacket> {
  const { interpretation: _prior, ...packetWithoutInterpretation } =
    input.packet as InterpretableResearchPacket;
  const packet = requireScreen03ResearchPacket(packetWithoutInterpretation);
  if (
    packet.upstreamEventFingerprint !==
      input.handoff.integrity.eventFingerprint
  ) {
    return packet;
  }
  const request = buildScreen03InterpretationRequest(packet, input.handoff);
  let interpretation = fallbackInterpretation(packet, input.handoff, request);
  if (
    input.interpreter && request.proposals.length > 0 &&
    request.passages.length > 0
  ) {
    const startedAt = Date.now();
    try {
      const candidate = await invokeBoundedInterpreter(
        input.interpreter,
        request,
        input.signal,
      );
      const restored = restoreScreen03Interpretation(
        candidate,
        request,
        input.handoff,
      );
      if (restored) {
        interpretation = restored;
        if (restored.limitations.length > 0) {
          reportInterpretationFailure(
            "draft-partial",
            Date.now() - startedAt,
            request.proposals.length,
            restored.claimExplanations.length,
          );
        }
      } else {
        reportInterpretationFailure(
          "draft-rejected",
          Date.now() - startedAt,
          request.proposals.length,
          0,
        );
      }
    } catch (error) {
      // Noncanonical orientation is always fail-soft.
      reportInterpretationFailure(
        classifyInterpretationFailure(error),
        Date.now() - startedAt,
        request.proposals.length,
        0,
      );
    }
  }
  return {
    ...packet,
    interpretation,
  } as Screen03ResearchPacket;
}

export const enrichScreen03PacketWithInterpretation = interpretScreen03Packet;
