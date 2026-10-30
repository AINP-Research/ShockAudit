import type { Screen02WorkflowHandoff } from "../core/screen02-workflow-handoff";
import {
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  type Screen03EvidenceSourceRole as CoreScreen03EvidenceSourceRole,
  type Screen03PassageBasis,
  type Screen03ResearchPacket,
} from "../core/screen03-workflow";
import {
  screen03ClaimQualityScore,
  screen03ClaimsAreEquivalent,
  screen03CompleteExtractiveStatements,
  screen03ExtractiveClaimIsComplete,
} from "./screen03-claim-quality";

export const SCREEN_03_SYNTHESIS_PROTOCOL_VERSION =
  "screen-03-evidence-synthesis-v1" as const;
export const SCREEN_03_SYNTHESIS_MAX_CLAIMS = 10;
export const SCREEN_03_SYNTHESIS_MAX_COMPONENT_CLAIMS = 3;
export const SCREEN_03_SYNTHESIS_MAX_EVIDENCE = 5;
export const SCREEN_03_SYNTHESIS_MAX_PASSAGES = 20;
export const SCREEN_03_SYNTHESIS_MAX_REFERENCES = 5;
export const SCREEN_03_SYNTHESIS_MAX_PASSAGE_TEXT = 1_600;
export const SCREEN_03_SYNTHESIS_TIMEOUT_MS = 3_500;

export const SCREEN_03_RESEARCH_STAGE_PLAN = [
  {
    id: "announcement-discussion",
    label: "announcement/discussion",
    queryTerms: ["announcement", "proposal", "notice", "consultation"],
  },
  {
    id: "enactment-publication",
    label: "enactment/publication",
    queryTerms: ["enactment", "adoption", "publication", "signed", "final rule"],
  },
  {
    id: "effective-application",
    label: "effective/application",
    queryTerms: ["effective", "application", "applies", "commencement", "in force"],
  },
  {
    id: "implementation-compliance",
    label: "implementation/compliance",
    queryTerms: ["implementation", "compliance", "phase in", "deadline", "guidance"],
  },
  {
    id: "enforcement-penalty",
    label: "enforcement/penalty",
    queryTerms: ["enforcement", "penalty", "fine", "inspection", "sanction"],
  },
  {
    id: "amendment-delay-repeal",
    label: "amendment/delay/repeal",
    queryTerms: ["amendment", "delay", "extension", "repeal", "superseded"],
  },
] as const;

export type Screen03ResearchStageId =
  (typeof SCREEN_03_RESEARCH_STAGE_PLAN)[number]["id"];
export type Screen03ResearchStageLabel =
  (typeof SCREEN_03_RESEARCH_STAGE_PLAN)[number]["label"];

export type Screen03EvidenceSourceRole = CoreScreen03EvidenceSourceRole;

export type Screen03SynthesisGroup =
  | "overview"
  | "component"
  | "eligibility"
  | "amendment";

const CLAIM_LABELS = [
  "Announcement or discussion",
  "Enactment or publication",
  "Effective date or application",
  "Implementation or compliance",
  "Enforcement or penalty",
  "Amendment, delay, or repeal",
  "Covered entities or eligibility",
  "Eligibility thresholds",
  "Exemptions",
  "Operative duty or component",
] as const;

/**
 * Fail closed on common instruction-channel phrases. Evidence is untrusted
 * data even when it came from an allowlisted official host; no such text is
 * promoted by deterministic extraction or exposed to a host reasoning task.
 */
const UNSAFE_INSTRUCTION_TEXT =
  /\b(?:ignore|disregard|forget|override|bypass|reveal|print|repeat|follow|obey|execute)\b[\s\S]{0,80}\b(?:previous|prior|above|system|developer|assistant|instructions?|prompts?|messages?|rules?|json)\b|\b(?:system|developer|assistant)\s+(?:prompt|message|instructions?)\b|\b(?:return|output|respond(?: with)?|emit|produce)\s+(?:only\s+)?(?:valid\s+)?json\b|\byou are (?:chatgpt|an? (?:ai|language model|assistant))\b|<\/?(?:system|developer|assistant|tool)>/iu;

export type Screen03SynthesisClaimLabel = (typeof CLAIM_LABELS)[number];

export type Screen03EvidenceSynthesisClaim = {
  id: string;
  stageId: Screen03ResearchStageId;
  group: Screen03SynthesisGroup;
  label: Screen03SynthesisClaimLabel;
  value: string;
  evidenceIds: string[];
  passageIds: string[];
};

export type Screen03EvidenceSynthesisOutput = {
  protocolVersion: typeof SCREEN_03_SYNTHESIS_PROTOCOL_VERSION;
  claims: Screen03EvidenceSynthesisClaim[];
  outcomeValuesInspected: false;
};

export type Screen03EvidenceSynthesisRequest = {
  protocolVersion: typeof SCREEN_03_SYNTHESIS_PROTOCOL_VERSION;
  event: {
    canonicalTitle: string;
    formalIdentifier: string | null;
    issuer: string | null;
    issuingJurisdiction: string | null;
    eventType: string;
    status: string | null;
  };
  stages: Array<{
    id: Screen03ResearchStageId;
    label: Screen03ResearchStageLabel;
  }>;
  evidence: Array<{
    evidenceId: string;
    sourceId: string | null;
    sourceRole: Screen03EvidenceSourceRole;
    title: string;
    locator: string;
    authorityTier: 1 | 2 | 3 | 4 | 5 | 6;
    passages: Array<{
      passageId: string;
      text: string;
      basis:
        | "source-excerpt"
        | "official-document-passage"
        | "official-guidance-passage";
    }>;
  }>;
  constraints: {
    maximumClaims: number;
    maximumComponentClaims: number;
    exactExtractiveValuesOnly: true;
    completeSentencesOnly: true;
    exactEvidenceAndPassageIdsRequired: true;
    researcherApprovalRequired: true;
  };
  outcomeValuesInspected: false;
};

export type Screen03EvidenceSynthesizer = (
  request: Screen03EvidenceSynthesisRequest,
  options: { signal: AbortSignal },
) => Promise<unknown>;

export type Screen03EvidenceSynthesisResult = {
  request: Screen03EvidenceSynthesisRequest;
  output: Screen03EvidenceSynthesisOutput;
  mode: "model-validated" | "deterministic-fallback";
  gap: string | null;
  modelStatus:
    | "not-configured"
    | "validated"
    | "invalid-response"
    | "failed"
    | "timed-out";
  modelClaimCount: number;
  fallbackClaimCount: number;
};

type EvidenceItem = Screen03ResearchPacket["evidence"][number];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function boundedTrimmedString(
  value: unknown,
  maximum: number,
): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maximum && value.trim() === value;
}

function uniqueBoundedStringArray(
  value: unknown,
  maximum: number,
): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= maximum &&
    value.every((item) => boundedTrimmedString(item, 120)) &&
    new Set(value).size === value.length;
}

function directPassage(passage: EvidenceItem["passages"][number]) {
  return passage.locator !== null &&
    substantivePassageBasis(passage.basis);
}

function substantivePassageBasis(basis: Screen03PassageBasis) {
  return basis === "source-excerpt" ||
    basis === "official-document-passage" ||
    basis === "official-guidance-passage";
}

export function screen03EvidenceSourceRole(input: {
  sourceRole?: Screen03EvidenceSourceRole;
  channel: string;
  locator: string;
  publisher: string;
  title: string;
}): Screen03EvidenceSourceRole {
  if (input.sourceRole !== undefined) return input.sourceRole;
  const haystack = normalizedToken(
    `${input.channel} ${input.publisher} ${input.title} ${input.locator}`,
  );
  if (/researcher supplied|user supplied/.test(haystack)) {
    return "researcher-supplied-record";
  }
  if (/source role related secondary record/.test(haystack)) {
    return "related-secondary-record";
  }
  if (
    /ballot initiative announcement|precursor initiative|source role precursor official record/.test(
      haystack,
    )
  ) {
    return "precursor-official-record";
  }
  if (/source role related official record|related formal identifier/.test(haystack)) {
    return "related-official-record";
  }
  if (/federal register/.test(haystack)) return "official-publication-record";
  if (/fema|disaster declaration/.test(haystack)) {
    return "administrative-declaration-record";
  }
  if (/usgs|earthquake catalog|geological survey/.test(haystack)) {
    return "scientific-hazard-record";
  }
  if (/gdacs|global disaster alert/.test(haystack)) {
    return "institutional-hazard-record";
  }
  if (/press release|news release|official regulator communication/.test(haystack)) {
    return "official-record";
  }
  if (/eur lex|cellar|legislation gov|gazette|statute|regulation|legal/.test(haystack)) {
    return "controlling-legal-record";
  }
  return "official-record";
}

export function buildScreen03EvidenceSynthesisRequest(
  handoff: Screen02WorkflowHandoff,
  evidence: readonly EvidenceItem[],
): Screen03EvidenceSynthesisRequest {
  let remainingPassages = SCREEN_03_SYNTHESIS_MAX_PASSAGES;
  const boundedEvidence = evidence
    .filter(screen03EvidenceItemProvidesAuthoritativeDirectSupport)
    .filter(
      (item) =>
        ![
          "precursor-official-record",
          "related-official-record",
        ].includes(screen03EvidenceSourceRole(item)),
    )
    .slice(0, SCREEN_03_SYNTHESIS_MAX_EVIDENCE)
    .map((item) => {
      const passages = item.passages
        .filter(directPassage)
        .slice(0, remainingPassages)
        .map((passage) => ({
          passageId: passage.id,
          text: normalizedText(
            passage.text,
            SCREEN_03_SYNTHESIS_MAX_PASSAGE_TEXT,
          ),
          basis: passage.basis as
            | "source-excerpt"
            | "official-document-passage"
            | "official-guidance-passage",
        }))
        .filter(
          (passage) =>
            passage.text.length > 0 && safeEvidenceText(passage.text),
        );
      remainingPassages -= passages.length;
      return {
        evidenceId: item.id,
        sourceId: item.sourceId,
        sourceRole: screen03EvidenceSourceRole(item),
        title: item.title,
        locator: item.locator,
        authorityTier: item.authorityTier,
        passages,
      };
    })
    .filter((item) => item.passages.length > 0);
  return {
    protocolVersion: SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
    event: {
      canonicalTitle: handoff.event.identity.canonicalTitle,
      formalIdentifier: handoff.event.identity.formalIdentifier,
      issuer: handoff.event.identity.issuer,
      issuingJurisdiction: handoff.event.identity.issuingJurisdiction,
      eventType: handoff.event.identity.eventType,
      status: handoff.event.identity.status,
    },
    stages: SCREEN_03_RESEARCH_STAGE_PLAN.map((stage) => ({
      id: stage.id,
      label: stage.label,
    })),
    evidence: boundedEvidence,
    constraints: {
      maximumClaims: SCREEN_03_SYNTHESIS_MAX_CLAIMS,
      maximumComponentClaims: SCREEN_03_SYNTHESIS_MAX_COMPONENT_CLAIMS,
      exactExtractiveValuesOnly: true,
      completeSentencesOnly: true,
      exactEvidenceAndPassageIdsRequired: true,
      researcherApprovalRequired: true,
    },
    outcomeValuesInspected: false,
  };
}

const LABEL_GROUPS: Record<Screen03SynthesisClaimLabel, Screen03SynthesisGroup> = {
  "Announcement or discussion": "overview",
  "Enactment or publication": "overview",
  "Effective date or application": "component",
  "Implementation or compliance": "component",
  "Enforcement or penalty": "component",
  "Amendment, delay, or repeal": "amendment",
  "Covered entities or eligibility": "eligibility",
  "Eligibility thresholds": "eligibility",
  Exemptions: "eligibility",
  "Operative duty or component": "component",
};

const LABEL_STAGES: Record<Screen03SynthesisClaimLabel, Screen03ResearchStageId> = {
  "Announcement or discussion": "announcement-discussion",
  "Enactment or publication": "enactment-publication",
  "Effective date or application": "effective-application",
  "Implementation or compliance": "implementation-compliance",
  "Enforcement or penalty": "enforcement-penalty",
  "Amendment, delay, or repeal": "amendment-delay-repeal",
  "Covered entities or eligibility": "effective-application",
  "Eligibility thresholds": "effective-application",
  Exemptions: "effective-application",
  "Operative duty or component": "implementation-compliance",
};

export function screen03EvidenceTextHasUnsafeInstruction(value: string) {
  return UNSAFE_INSTRUCTION_TEXT.test(value);
}

function safeEvidenceText(value: string) {
  return !screen03EvidenceTextHasUnsafeInstruction(value);
}

export function restoreScreen03EvidenceSynthesis(
  value: unknown,
  request: Screen03EvidenceSynthesisRequest,
): Screen03EvidenceSynthesisOutput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, [
      "protocolVersion",
      "claims",
      "outcomeValuesInspected",
    ]) ||
    value.protocolVersion !== SCREEN_03_SYNTHESIS_PROTOCOL_VERSION ||
    value.outcomeValuesInspected !== false ||
    !Array.isArray(value.claims) ||
    value.claims.length > SCREEN_03_SYNTHESIS_MAX_CLAIMS) {
    return null;
  }
  const evidenceById = new Map(
    request.evidence.map((item) => [item.evidenceId, item]),
  );
  const passageById = new Map(
    request.evidence.flatMap((item) =>
      item.passages.map((passage) => [
        passage.passageId,
        { passage, evidenceId: item.evidenceId },
      ] as const)
    ),
  );
  const claims: Screen03EvidenceSynthesisClaim[] = [];
  const claimIds = new Set<string>();
  for (const candidate of value.claims) {
    if (!isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "id",
        "stageId",
        "group",
        "label",
        "value",
        "evidenceIds",
        "passageIds",
      ]) ||
      !boundedTrimmedString(candidate.id, 100) ||
      claimIds.has(candidate.id) ||
      !SCREEN_03_RESEARCH_STAGE_PLAN.some((stage) => stage.id === candidate.stageId) ||
      !["overview", "component", "eligibility", "amendment"].includes(
        candidate.group as string,
      ) ||
      !CLAIM_LABELS.includes(candidate.label as Screen03SynthesisClaimLabel) ||
      !boundedTrimmedString(candidate.value, 1_600) ||
      !uniqueBoundedStringArray(
        candidate.evidenceIds,
        SCREEN_03_SYNTHESIS_MAX_REFERENCES,
      ) ||
      !uniqueBoundedStringArray(
        candidate.passageIds,
        SCREEN_03_SYNTHESIS_MAX_REFERENCES,
      )) {
      return null;
    }
    const label = candidate.label as Screen03SynthesisClaimLabel;
    if (LABEL_GROUPS[label] !== candidate.group ||
      LABEL_STAGES[label] !== candidate.stageId) {
      return null;
    }
    const evidenceIds = candidate.evidenceIds as string[];
    const passageIds = candidate.passageIds as string[];
    if (evidenceIds.some((id) => !evidenceById.has(id))) return null;
    const cited = passageIds.map((id) => passageById.get(id));
    if (cited.some((item) => item === undefined)) return null;
    if (cited.some((item) => !evidenceIds.includes(item!.evidenceId))) {
      return null;
    }
    if (evidenceIds.some((id) => !cited.some((item) => item!.evidenceId === id))) {
      return null;
    }
    const semanticRule = DETERMINISTIC_RULES.find(
      (rule) => rule.label === label,
    );
    if (!semanticRule ||
      !safeEvidenceText(candidate.value) ||
      normalizedToken(candidate.value).length < 3 ||
      !screen03ExtractiveClaimIsComplete(candidate.value) ||
      !semanticRule.pattern.test(normalizedToken(candidate.value)) ||
      cited.some((item) =>
        !safeEvidenceText(item!.passage.text) ||
        !screen03CompleteExtractiveStatements(item!.passage.text).includes(
          candidate.value as string,
        )
      )) {
      return null;
    }
    claimIds.add(candidate.id);
    claims.push({
      id: candidate.id,
      stageId: candidate.stageId as Screen03ResearchStageId,
      group: candidate.group as Screen03SynthesisGroup,
      label,
      value: candidate.value,
      evidenceIds: [...evidenceIds],
      passageIds: [...passageIds],
    });
  }
  return {
    protocolVersion: SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
    claims,
    outcomeValuesInspected: false,
  };
}

type DeterministicRule = {
  stageId: Screen03ResearchStageId;
  group: Screen03SynthesisGroup;
  label: Screen03SynthesisClaimLabel;
  pattern: RegExp;
};

const DETERMINISTIC_RULES: readonly DeterministicRule[] = [
  {
    stageId: "announcement-discussion",
    group: "overview",
    label: "Announcement or discussion",
    pattern: /\b(?:announc\w*|propos\w*|notice|consult\w*|discussion)\b/u,
  },
  {
    stageId: "enactment-publication",
    group: "overview",
    label: "Enactment or publication",
    pattern: /\b(?:enact\w*|adopt\w*|publish\w*|publication|signed|final rule)\b/u,
  },
  {
    stageId: "effective-application",
    group: "component",
    label: "Effective date or application",
    pattern: /\b(?:effective|appl\w*|commenc\w*|in force|operative)\b/u,
  },
  {
    stageId: "implementation-compliance",
    group: "component",
    label: "Implementation or compliance",
    pattern: /\b(?:implement\w*|compliance|phase[ -]?in|deadline|guidance)\b/u,
  },
  {
    stageId: "enforcement-penalty",
    group: "component",
    label: "Enforcement or penalty",
    pattern: /\b(?:enforc\w*|penalt\w*|fines?|inspection|sanction\w*)\b/u,
  },
  {
    stageId: "amendment-delay-repeal",
    group: "amendment",
    label: "Amendment, delay, or repeal",
    pattern: /\b(?:amend\w*|delay\w*|extension\w*|repeal\w*|supersed\w*)\b/u,
  },
  {
    stageId: "effective-application",
    group: "eligibility",
    label: "Eligibility thresholds",
    pattern: /\b(?:threshold|at least|more than|exceed\w*)\b/u,
  },
  {
    stageId: "effective-application",
    group: "eligibility",
    label: "Exemptions",
    pattern: /\b(?:exempt\w*|exception\w*|does not apply|shall not apply)\b/u,
  },
  {
    stageId: "effective-application",
    group: "eligibility",
    label: "Covered entities or eligibility",
    pattern: /^(?!.*\bsubject to limitation\b).*\b(?:covered entit\w*|eligible|applies to|applicable to|(?:business\w*|entit\w*|organizations?|persons?|firms?|plants?|facilities|operators?|employers?|units?)\s+(?:is|are|remain\w*)?\s*subject to)\b/u,
  },
  {
    stageId: "implementation-compliance",
    group: "component",
    label: "Operative duty or component",
    pattern:
      /\b(?:shall|must|required to|prohibit\w*|dut\w*|obligation\w*|(?:(?:the )?(?:act|bill|law|regulation|rule|policy|program|reform)|it)\s+(?:updates?|strengthens?|supports?|changes?)\b[\s\S]{0,160}\b(?:rules?|requirements?|information|agreements?|safeguards?|protections?|programs?|markets?|services?|access|coverage|process(?:es|ing)?))\b/u,
  },
];

function passageStatements(text: string) {
  return screen03CompleteExtractiveStatements(text, 24)
    .map((statement) => normalizedText(statement, 1_600));
}

function deterministicSynthesis(
  request: Screen03EvidenceSynthesisRequest,
): Screen03EvidenceSynthesisOutput {
  const claims: Screen03EvidenceSynthesisClaim[] = [];
  const seen = new Set<string>();
  // The request already bounds evidence, passages, statement length, and rule
  // count. Do not apply the smaller output cap to raw rule hits: one sentence
  // can match several labels that collapse to one claim, and those duplicates
  // must not prevent later distinct statements from being considered.
  for (const item of request.evidence) {
    for (const passage of item.passages) {
      for (const statement of passageStatements(passage.text)) {
        const normalizedStatement = normalizedToken(statement);
        if (!safeEvidenceText(passage.text) || !safeEvidenceText(statement)) {
          continue;
        }
        for (const rule of DETERMINISTIC_RULES) {
          if (!rule.pattern.test(normalizedStatement)) {
            continue;
          }
          const key = `${rule.label}:${normalizedStatement}:${item.evidenceId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          claims.push({
            id: `screen03-extractive-${claims.length + 1}-${passage.passageId}`
              .slice(0, 100),
            stageId: rule.stageId,
            group: rule.group,
            label: rule.label,
            value: statement,
            evidenceIds: [item.evidenceId],
            passageIds: [passage.passageId],
          });
        }
      }
    }
  }
  return consolidateSynthesisClaims({
    protocolVersion: SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
    claims,
    outcomeValuesInspected: false,
  });
}

function synthesisLabelPriority(label: Screen03SynthesisClaimLabel) {
  switch (label) {
    case "Operative duty or component":
      return 0;
    case "Effective date or application":
    case "Announcement or discussion":
    case "Enactment or publication":
      return 10;
    case "Implementation or compliance":
    case "Enforcement or penalty":
    case "Amendment, delay, or repeal":
    case "Covered entities or eligibility":
    case "Eligibility thresholds":
    case "Exemptions":
      return 20;
  }
}

function synthesisClaimScore(claim: Screen03EvidenceSynthesisClaim) {
  return screen03ClaimQualityScore(claim.value) +
    synthesisLabelPriority(claim.label);
}

/**
 * One complete sentence can match several lexical stage rules. Show it once,
 * under the most specific label, and merge references only when the exact
 * displayed sentence is present in every cited passage.
 */
function consolidateSynthesisClaims(
  output: Screen03EvidenceSynthesisOutput,
): Screen03EvidenceSynthesisOutput {
  const distinct: Screen03EvidenceSynthesisClaim[] = [];
  for (const candidate of output.claims) {
    const priorIndex = distinct.findIndex(
      (prior) =>
        prior.group === candidate.group &&
        screen03ClaimsAreEquivalent(prior.value, candidate.value),
    );
    if (priorIndex < 0) {
      distinct.push(candidate);
      continue;
    }
    const prior = distinct[priorIndex]!;
    const exactValue = prior.value === candidate.value;
    const preferred = synthesisClaimScore(candidate) > synthesisClaimScore(prior)
      ? candidate
      : prior;
    const mergedEvidenceIds = [
      ...new Set([...prior.evidenceIds, ...candidate.evidenceIds]),
    ];
    const mergedPassageIds = [
      ...new Set([...prior.passageIds, ...candidate.passageIds]),
    ];
    distinct[priorIndex] = exactValue &&
        mergedEvidenceIds.length <= SCREEN_03_SYNTHESIS_MAX_REFERENCES &&
        mergedPassageIds.length <= SCREEN_03_SYNTHESIS_MAX_REFERENCES
      ? {
          ...preferred,
          evidenceIds: mergedEvidenceIds,
          passageIds: mergedPassageIds,
        }
      : preferred;
  }

  const component = distinct
    .filter((claim) => claim.group === "component")
    .sort((left, right) =>
      synthesisClaimScore(right) - synthesisClaimScore(left) ||
      left.id.localeCompare(right.id)
    )
    .slice(0, SCREEN_03_SYNTHESIS_MAX_COMPONENT_CLAIMS);
  const nonComponent = distinct.filter((claim) => claim.group !== "component");
  return {
    ...output,
    claims: [...nonComponent, ...component].slice(0, SCREEN_03_SYNTHESIS_MAX_CLAIMS),
  };
}

function mergeValidatedAndDeterministicClaims(
  validated: Screen03EvidenceSynthesisOutput,
  fallback: Screen03EvidenceSynthesisOutput,
): Screen03EvidenceSynthesisOutput {
  return consolidateSynthesisClaims({
    protocolVersion: SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
    claims: [...validated.claims, ...fallback.claims],
    outcomeValuesInspected: false,
  });
}

async function invokeBoundedSynthesizer(
  synthesizer: Screen03EvidenceSynthesizer,
  request: Screen03EvidenceSynthesisRequest,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      synthesizer(request, { signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DOMException("Screen 3 synthesis timed out", "AbortError"));
        }, SCREEN_03_SYNTHESIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function synthesizeScreen03Evidence(input: {
  handoff: Screen02WorkflowHandoff;
  evidence: readonly EvidenceItem[];
  synthesizer?: Screen03EvidenceSynthesizer;
}): Promise<Screen03EvidenceSynthesisResult> {
  const request = buildScreen03EvidenceSynthesisRequest(
    input.handoff,
    input.evidence,
  );
  const fallback = deterministicSynthesis(request);
  const complete = (
    output: Screen03EvidenceSynthesisOutput,
    mode: Screen03EvidenceSynthesisResult["mode"],
    gap: string | null,
    modelStatus: Screen03EvidenceSynthesisResult["modelStatus"],
    modelClaimCount = 0,
  ): Screen03EvidenceSynthesisResult => ({
    request,
    output,
    mode,
    gap,
    modelStatus,
    modelClaimCount,
    fallbackClaimCount: fallback.claims.length,
  });
  if (!input.synthesizer) {
    return complete(
      fallback,
      "deterministic-fallback",
      "The optional bounded semantic synthesizer was not configured; deterministic exact-passage extraction was used.",
      "not-configured",
    );
  }
  try {
    const candidate = await invokeBoundedSynthesizer(
      input.synthesizer,
      request,
    );
    const restored = restoreScreen03EvidenceSynthesis(candidate, request);
    if (!restored) {
      return complete(
        fallback,
        "deterministic-fallback",
        "The optional synthesis response failed the exact evidence/passage contract; deterministic exact-passage extraction was used.",
        "invalid-response",
      );
    }
    const merged = mergeValidatedAndDeterministicClaims(restored, fallback);
    return complete(
      merged,
      "model-validated",
      null,
      "validated",
      restored.claims.length,
    );
  } catch (error) {
    const reason = normalizedText(
      error instanceof Error ? error.message : String(error),
      240,
    );
    return complete(
      fallback,
      "deterministic-fallback",
      `The optional synthesis call failed${reason ? ` (${reason})` : ""}; deterministic exact-passage extraction was used.`,
      error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)
        ? "timed-out"
        : "failed",
    );
  }
}
