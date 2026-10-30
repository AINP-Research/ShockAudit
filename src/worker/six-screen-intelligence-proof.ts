import { z } from "zod";

import {
  fingerprintHostReasoningValue,
  type HostReasoningTask,
  type HostReasoningTaskType,
} from "../core/host-reasoning-task";
import type { SixScreenWorkflowState } from "../core/six-screen/contracts";

export const SIX_SCREEN_POLICY_FACT_PROOF_TASK =
  "six-screen-policy-fact-proof" as const;
export const SIX_SCREEN_MECHANISM_PROOF_TASK =
  "six-screen-mechanism-proof" as const;
export const SIX_SCREEN_INTELLIGENCE_PROOF_TASK_TYPES = [
  SIX_SCREEN_POLICY_FACT_PROOF_TASK,
  SIX_SCREEN_MECHANISM_PROOF_TASK,
] as const;
export type SixScreenIntelligenceProofTaskType =
  (typeof SIX_SCREEN_INTELLIGENCE_PROOF_TASK_TYPES)[number];

export const SIX_SCREEN_POLICY_FACT_PROOF_SUBMISSION_SCHEMA_VERSION =
  "six-screen-policy-fact-proof-submission-v1" as const;
export const SIX_SCREEN_MECHANISM_PROOF_SUBMISSION_SCHEMA_VERSION =
  "six-screen-mechanism-proof-submission-v1" as const;
export const SIX_SCREEN_POLICY_FACT_PROOF_RESULT_SCHEMA_VERSION =
  "shockaudit-six-screen-policy-fact-proof-result-v1" as const;
export const SIX_SCREEN_MECHANISM_PROOF_RESULT_SCHEMA_VERSION =
  "shockaudit-six-screen-mechanism-proof-result-v1" as const;
export const SIX_SCREEN_POLICY_FACT_PROOF_PROMPT_VERSION =
  "six-screen-policy-fact-proof-prompt-v1" as const;
export const SIX_SCREEN_MECHANISM_PROOF_PROMPT_VERSION =
  "six-screen-mechanism-proof-prompt-v1" as const;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u);
const fingerprint = z.string().regex(
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u,
);
const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const uniqueIdentifiers = (maximum: number) => z.array(identifier).max(maximum)
  .refine((values) => new Set(values).size === values.length, {
    message: "Identifiers must be unique.",
  });
const hostModel = z.literal("host_model_not_exposed");

export const sixScreenProofSourceFactSchema = z.object({
  claimId: identifier,
  predicate: text(120),
  decision: z.enum(["accepted", "corrected"]),
  statementOrigin: z.enum(["evidence_claim", "researcher_supplied"]),
  effectiveStatement: text(1_200),
  sourceStatement: text(1_200),
  sourceId: identifier,
  sourceTitle: text(300),
  passageId: identifier,
  documentVersionId: identifier,
  locator: text(1_000),
  exactPassageExcerpt: text(2_000),
  qualification: text(600).nullable(),
  sourceSupportBoundary: z.literal(
    "The citation supports only the source statement; a researcher correction is not upgraded to source support.",
  ),
}).strict();

const commonFacts = {
  proofPurpose: z.literal("signed_in_round_trip"),
  proofOnly: z.literal(true),
  scientificMutation: z.literal("none"),
  policy: z.object({
    eventId: identifier,
    officialTitle: text(300),
    issuer: text(200),
    issuingJurisdiction: text(200),
    eventCardSnapshotId: identifier,
    eventCardFingerprint: fingerprint,
  }).strict(),
  evidence: z.object({
    snapshotId: identifier,
    snapshotFingerprint: fingerprint,
    sourceFacts: z.array(sixScreenProofSourceFactSchema).min(1).max(12),
  }).strict(),
  limitations: z.array(text(500)).max(12),
} as const;

export const sixScreenPolicyFactProofFactsSchema = z.object({
  schemaVersion: z.literal("shockaudit-six-screen-policy-fact-proof-facts-v1"),
  ...commonFacts,
  taskQuestion: z.literal(
    "State one bounded factual finding established by the reviewed source packet and identify any qualification.",
  ),
}).strict();

export const sixScreenMechanismProofFactsSchema = z.object({
  schemaVersion: z.literal("shockaudit-six-screen-mechanism-proof-facts-v1"),
  ...commonFacts,
  taskQuestion: z.literal(
    "Propose a clearly labeled mechanism hypothesis connecting the reviewed policy premise to the stated outcome without claiming an estimated effect.",
  ),
  study: z.object({
    population: text(300),
    outcome: text(300),
    initialExplanation: text(1_000),
    proposedTreatment: text(300).nullable(),
    proposedComparison: text(300).nullable(),
  }).strict(),
  scholarlySupportStatus: z.literal("not_supplied_in_frozen_packet"),
}).strict();

export const sixScreenProofReferenceSchema = z.object({
  claimId: identifier,
  sourceId: identifier,
  passageId: identifier,
}).strict();

function uniqueReferences(
  references: Array<z.infer<typeof sixScreenProofReferenceSchema>>,
) {
  return new Set(references.map((reference) =>
    `${reference.claimId}\u0000${reference.sourceId}\u0000${reference.passageId}`
  )).size === references.length;
}

export const sixScreenPolicyFactProofProposalSchema = z.object({
  answer: text(1_000),
  references: z.array(sixScreenProofReferenceSchema).length(1)
    .refine(uniqueReferences, { message: "Proof references must be unique." }),
  uncertainties: z.array(text(400)).max(4),
  hostModel,
}).strict();

export const sixScreenMechanismProofProposalSchema = z.object({
  mechanismHypothesis: text(1_200),
  steps: z.array(text(500)).min(2).max(5),
  assumptions: z.array(text(400)).min(1).max(6),
  alternativeExplanations: z.array(text(400)).max(4),
  references: z.array(sixScreenProofReferenceSchema).length(1)
    .refine(uniqueReferences, { message: "Proof references must be unique." }),
  scholarlySupportStatus: z.literal("not_supplied_in_frozen_packet"),
  causalStatus: z.literal("hypothesis_not_estimate"),
  hostModel,
}).strict();

const normalizedCommon = {
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  proofOnly: z.literal(true),
  taskInputFingerprint: fingerprint,
  eventCardFingerprintInspected: fingerprint,
  sourcePoolFingerprintInspected: fingerprint,
  references: z.array(sixScreenProofReferenceSchema).min(1).max(8),
  sourceIdsReferenced: uniqueIdentifiers(12),
  scientificMutation: z.literal("none"),
  researcherDecision: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
} as const;

export const sixScreenPolicyFactProofResultSchema = z.object({
  schemaVersion: z.literal(
    SIX_SCREEN_POLICY_FACT_PROOF_RESULT_SCHEMA_VERSION,
  ),
  intelligenceKind: z.literal("policy_fact_extraction"),
  ...normalizedCommon,
  answer: text(1_000),
  uncertainties: z.array(text(600)).max(5),
  hostModel,
}).strict();

export const sixScreenMechanismProofResultSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_MECHANISM_PROOF_RESULT_SCHEMA_VERSION),
  intelligenceKind: z.literal("mechanism_proposal"),
  ...normalizedCommon,
  mechanismHypothesis: text(1_200),
  steps: z.array(text(500)).min(2).max(5),
  assumptions: z.array(text(640)).min(1).max(7),
  alternativeExplanations: z.array(text(400)).max(4),
  scholarlySupportStatus: z.literal("not_supplied_in_frozen_packet"),
  causalStatus: z.literal("hypothesis_not_estimate"),
  hostModel,
}).strict();

export type SixScreenPolicyFactProofFacts = z.infer<
  typeof sixScreenPolicyFactProofFactsSchema
>;
export type SixScreenMechanismProofFacts = z.infer<
  typeof sixScreenMechanismProofFactsSchema
>;
export type SixScreenPolicyFactProofProposal = z.infer<
  typeof sixScreenPolicyFactProofProposalSchema
>;
export type SixScreenMechanismProofProposal = z.infer<
  typeof sixScreenMechanismProofProposalSchema
>;

function bounded(value: string, maximum: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  if (!clean) throw new Error("An intelligence-proof fact is empty.");
  return clean.slice(0, maximum).trimEnd();
}

function currentLockedEventCard(state: SixScreenWorkflowState) {
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 2 && status === "current"
    ).map(({ snapshotId }) => snapshotId),
  );
  return [...(state.policyEventCardReviews ?? [])].reverse().find((review) =>
    review.status === "locked" && review.lockedEventCard !== null &&
    currentArtifactIds.has(review.lockedEventCard.snapshotId)
  )?.lockedEventCard ?? null;
}

export function buildSixScreenIntelligenceProofContext(
  stateValue: SixScreenWorkflowState,
  taskType: SixScreenIntelligenceProofTaskType,
) {
  const state = structuredClone(stateValue);
  const event = state.confirmedShock;
  const policyReview = state.policyReview;
  const eventCard = currentLockedEventCard(state);
  if (!event || !policyReview || !eventCard ||
      policyReview.artifactStatus !== "current" ||
      !policyReview.evidenceSnapshotId ||
      !policyReview.evidenceSnapshotFingerprint ||
      eventCard.binding.identityFingerprint !== event.identityFingerprint ||
      eventCard.binding.evidenceSnapshotId !== policyReview.evidenceSnapshotId ||
      eventCard.binding.evidenceSnapshotFingerprint !==
        policyReview.evidenceSnapshotFingerprint) {
    throw new Error(
      "A current locked Event Card and matching evidence snapshot are required for intelligence proof.",
    );
  }
  const reviewByClaimId = new Map(
    eventCard.claims.map((claim) => [claim.claimId, claim]),
  );
  const sourceFacts = policyReview.claims.flatMap((claim) => {
    const reviewed = reviewByClaimId.get(claim.claimId);
    if (!reviewed ||
        (reviewed.decision !== "accepted" && reviewed.decision !== "corrected")) {
      return [];
    }
    if (!reviewed.lineages.some((lineage) =>
      lineage.direction === "supporting" &&
      lineage.sourceId === claim.citation.sourceId &&
      lineage.passageId === claim.citation.passageId &&
      lineage.documentVersionId === claim.citation.documentVersionId
    )) return [];
    return [{
      claimId: claim.claimId,
      predicate: bounded(claim.predicate, 120),
      decision: reviewed.decision,
      statementOrigin: reviewed.statementOrigin,
      effectiveStatement: bounded(reviewed.effectiveStatement, 1_200),
      sourceStatement: bounded(reviewed.sourceStatement, 1_200),
      sourceId: claim.citation.sourceId,
      sourceTitle: bounded(claim.citation.sourceTitle, 300),
      passageId: claim.citation.passageId,
      documentVersionId: claim.citation.documentVersionId,
      locator: bounded(claim.citation.locator, 1_000),
      exactPassageExcerpt: bounded(claim.citation.exactText, 2_000),
      qualification: claim.qualification
        ? bounded(claim.qualification, 600)
        : null,
      sourceSupportBoundary:
        "The citation supports only the source statement; a researcher correction is not upgraded to source support." as const,
    }];
  }).slice(0, 12);
  if (!sourceFacts.some(({ decision }) => decision === "accepted")) {
    throw new Error(
      "Intelligence proof requires at least one explicitly accepted source-linked claim.",
    );
  }
  const base = {
    proofPurpose: "signed_in_round_trip" as const,
    proofOnly: true as const,
    scientificMutation: "none" as const,
    policy: {
      eventId: event.id,
      officialTitle: bounded(event.officialTitle, 300),
      issuer: bounded(event.issuer, 200),
      issuingJurisdiction: bounded(event.issuingJurisdiction, 200),
      eventCardSnapshotId: eventCard.snapshotId,
      eventCardFingerprint: eventCard.eventCardFingerprint,
    },
    evidence: {
      snapshotId: policyReview.evidenceSnapshotId,
      snapshotFingerprint: policyReview.evidenceSnapshotFingerprint,
      sourceFacts,
    },
    limitations: [
      ...eventCard.limitations.map(({ summary }) => summary),
      ...policyReview.unresolved.map((item) => `Unresolved: ${item}`),
    ].slice(0, 12).map((item) => bounded(item, 500)),
  };
  const facts = taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
    ? sixScreenPolicyFactProofFactsSchema.parse({
        schemaVersion: "shockaudit-six-screen-policy-fact-proof-facts-v1",
        ...base,
        taskQuestion:
          "State one bounded factual finding established by the reviewed source packet and identify any qualification.",
      })
    : sixScreenMechanismProofFactsSchema.parse({
        schemaVersion: "shockaudit-six-screen-mechanism-proof-facts-v1",
        ...base,
        taskQuestion:
          "Propose a clearly labeled mechanism hypothesis connecting the reviewed policy premise to the stated outcome without claiming an estimated effect.",
        study: {
          population: bounded(state.study.population ?? "Unspecified population", 300),
          outcome: bounded(state.study.outcome ?? "Unspecified outcome", 300),
          initialExplanation: bounded(
            state.study.initialExplanation ?? "No initial explanation supplied.",
            1_000,
          ),
          proposedTreatment: state.study.proposedTreatment
            ? bounded(state.study.proposedTreatment, 300)
            : null,
          proposedComparison: state.study.proposedComparison
            ? bounded(state.study.proposedComparison, 300)
            : null,
        },
        scholarlySupportStatus: "not_supplied_in_frozen_packet",
      });
  return {
    facts,
    allowedSourceIds: [...new Set(
      sourceFacts.map(({ sourceId }) => sourceId),
    )].sort(),
    selectedEventId: event.id,
    eventFingerprint: eventCard.eventCardFingerprint,
  };
}

function referenceKey(reference: z.infer<typeof sixScreenProofReferenceSchema>) {
  return `${reference.claimId}\u0000${reference.sourceId}\u0000${reference.passageId}`;
}

const stopWords = new Set([
  "about", "after", "among", "before", "being", "could", "from", "have",
  "into", "other", "policy", "should", "their", "there", "these", "this",
  "through", "under", "which", "with", "would",
]);

function tokens(value: string) {
  return new Set((value.normalize("NFKC").toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((token) => !stopWords.has(token)));
}

function overlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

const causalCertainty =
  /\b(?:proves?|proved|guarantees?|certainly|definitively|caused?|establishes? the causal effect|estimated effect is)\b/iu;
const hypothesisLanguage =
  /\b(?:may|might|could|hypothes(?:is|es|ized?|izing)|plausible|plausibly|potential|potentially)\b/iu;

export function validateAndNormalizeSixScreenIntelligenceProof(input: {
  task: HostReasoningTask;
  currentState: SixScreenWorkflowState;
  boundedFacts: unknown;
  proposal: unknown;
}) {
  if (!SIX_SCREEN_INTELLIGENCE_PROOF_TASK_TYPES.includes(
    input.task.taskType as SixScreenIntelligenceProofTaskType,
  )) throw new Error("The task is not a six-screen intelligence proof.");
  const taskType = input.task.taskType as SixScreenIntelligenceProofTaskType;
  const current = buildSixScreenIntelligenceProofContext(
    input.currentState,
    taskType,
  );
  const facts = taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
    ? sixScreenPolicyFactProofFactsSchema.parse(input.boundedFacts)
    : sixScreenMechanismProofFactsSchema.parse(input.boundedFacts);
  if (
    fingerprintHostReasoningValue(current.facts) !==
      fingerprintHostReasoningValue(facts) ||
    input.task.inputFingerprint !== fingerprintHostReasoningValue(facts) ||
    input.task.selectedEventId !== current.selectedEventId ||
    input.task.eventFingerprint !== current.eventFingerprint ||
    input.task.sourcePoolFingerprint !==
      fingerprintHostReasoningValue(current.allowedSourceIds)
  ) throw new Error("The frozen proof packet is no longer current.");

  const sourceFacts = facts.evidence.sourceFacts;
  const referenceFacts = new Map(sourceFacts.map((fact) => [
    referenceKey(fact),
    fact,
  ]));
  const proposal = taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
    ? sixScreenPolicyFactProofProposalSchema.parse(input.proposal)
    : sixScreenMechanismProofProposalSchema.parse(input.proposal);
  if (proposal.references.some((reference) =>
    !referenceFacts.has(referenceKey(reference))
  )) throw new Error("The proof proposal cites a fact outside its frozen packet.");
  const referencedFacts = proposal.references.map((reference) =>
    referenceFacts.get(referenceKey(reference))!
  );
  if (referencedFacts.some(({ decision }) => decision !== "accepted")) {
    throw new Error(
      "The proof proposal must cite one explicitly accepted source fact.",
    );
  }
  const sourceQualifications = [...new Set(referencedFacts.flatMap((fact) =>
    fact.qualification ? [fact.qualification] : []
  ))];
  const sourceIdsReferenced = [...new Set(
    proposal.references.map(({ sourceId }) => sourceId),
  )].sort();
  const referencedText = proposal.references.map((reference) => {
    const fact = referenceFacts.get(referenceKey(reference))!;
    return `${fact.sourceStatement} ${fact.exactPassageExcerpt}`;
  }).join(" ");
  const citedTokens = tokens(referencedText);

  if (taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK) {
    const factual = sixScreenPolicyFactProofProposalSchema.parse(proposal);
    if (causalCertainty.test(factual.answer) ||
        overlapCount(tokens(factual.answer), citedTokens) < 2) {
      throw new Error(
        "The factual proof answer is not bounded to its cited source facts.",
      );
    }
    return sixScreenPolicyFactProofResultSchema.parse({
      schemaVersion: SIX_SCREEN_POLICY_FACT_PROOF_RESULT_SCHEMA_VERSION,
      intelligenceKind: "policy_fact_extraction",
      origin: "chatgpt-host",
      nonCanonical: true,
      proofOnly: true,
      taskInputFingerprint: input.task.inputFingerprint,
      eventCardFingerprintInspected: input.task.eventFingerprint,
      sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
      answer: factual.answer,
      references: factual.references,
      // Source qualifications are fixed packet facts, so the normalized
      // result retains them even if the model omits them from its proposal.
      uncertainties: [...new Set([
        ...sourceQualifications,
        ...factual.uncertainties,
      ])],
      sourceIdsReferenced,
      scientificMutation: "none",
      researcherDecision: "none",
      hostModel: factual.hostModel,
      outcomeValuesInspected: false,
    });
  }

  const mechanism = sixScreenMechanismProofProposalSchema.parse(proposal);
  const mechanismText = [mechanism.mechanismHypothesis, ...mechanism.steps]
    .join(" ");
  const mechanismFacts = sixScreenMechanismProofFactsSchema.parse(facts);
  const studyTokens = tokens(
    `${mechanismFacts.study.population} ${mechanismFacts.study.outcome} ${mechanismFacts.study.initialExplanation}`,
  );
  if (
    causalCertainty.test(mechanismText) ||
    !hypothesisLanguage.test(mechanism.mechanismHypothesis) ||
    overlapCount(tokens(mechanismText), citedTokens) < 1 ||
    overlapCount(tokens(mechanismText), studyTokens) < 1
  ) throw new Error(
    "The mechanism proof must remain a grounded hypothesis tied to the stated study context.",
  );
  return sixScreenMechanismProofResultSchema.parse({
    schemaVersion: SIX_SCREEN_MECHANISM_PROOF_RESULT_SCHEMA_VERSION,
    intelligenceKind: "mechanism_proposal",
    origin: "chatgpt-host",
    nonCanonical: true,
    proofOnly: true,
    taskInputFingerprint: input.task.inputFingerprint,
    eventCardFingerprintInspected: input.task.eventFingerprint,
    sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
    mechanismHypothesis: mechanism.mechanismHypothesis,
    steps: mechanism.steps,
    assumptions: [...new Set([
      ...sourceQualifications.map((qualification) =>
        `Source qualification: ${qualification}`
      ),
      ...mechanism.assumptions,
    ])],
    alternativeExplanations: mechanism.alternativeExplanations,
    references: mechanism.references,
    sourceIdsReferenced,
    scholarlySupportStatus: mechanism.scholarlySupportStatus,
    causalStatus: mechanism.causalStatus,
    scientificMutation: "none",
    researcherDecision: "none",
    hostModel: mechanism.hostModel,
    outcomeValuesInspected: false,
  });
}

export function isSixScreenIntelligenceProofTask(
  taskType: HostReasoningTaskType,
): taskType is SixScreenIntelligenceProofTaskType {
  return SIX_SCREEN_INTELLIGENCE_PROOF_TASK_TYPES.includes(
    taskType as SixScreenIntelligenceProofTaskType,
  );
}
