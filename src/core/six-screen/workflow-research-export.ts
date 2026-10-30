import {
  fingerprintSixScreenValue,
} from "./canonical";
import {
  requireCanonicalInstant,
  type SixScreenWorkflowState,
} from "./contracts";
import {
  createScreen6ResearchExportBundle,
  type Screen6ResearchExportBundle,
  type Screen6ResearchExportFile,
} from "./screen6-research-export";
import {
  currentScreen6ResearchExport,
  currentStudyFirstMechanismRunForState,
} from "./workflow";
import {
  createScreen6CurrentPlan,
  screen6CompatibleInputFingerprints,
} from "./screen6-current-plan";
import { SHOCKAUDIT_VERSION } from "../shockaudit-version";

export const SIX_SCREEN_PARTIAL_EXPORT_VERSION =
  "shockaudit-partial-research-export-v1" as const;
export const SIX_SCREEN_PARTIAL_EXPORT_MANIFEST_VERSION =
  "shockaudit-partial-research-export-manifest-v1" as const;
export const SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION =
  "shockaudit-partial-research-export-bundle-v1" as const;

const PARTIAL_EXPORT_MAX_BYTES = 2_000_000;

type ExportFile = Screen6ResearchExportFile;

export type WorkflowResearchExportAvailability = {
  available: boolean;
  completenessStatus: "complete" | "partial" | "unavailable";
  source: "screen6_final_export" | "current_partial_snapshot" | "unavailable";
  includedModules: string[];
  excludedOrUnassessedEvidence: string[];
};

export type PartialResearchExportManifest = {
  schemaVersion: typeof SIX_SCREEN_PARTIAL_EXPORT_MANIFEST_VERSION;
  applicationVersion: typeof SHOCKAUDIT_VERSION;
  exportSchemaVersion: typeof SIX_SCREEN_PARTIAL_EXPORT_VERSION;
  bundleFormat: typeof SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION;
  completenessStatus: "partial";
  workflowSnapshot: {
    runId: string;
    revision: number;
    stateFingerprint: string;
    currentArtifactSnapshotIds: string[];
  };
  includedModules: string[];
  excludedOrUnassessedEvidence: string[];
  files: Array<{
    name: string;
    mediaType: ExportFile["mediaType"];
    byteLength: number;
    contentFingerprint: string;
  }>;
  payloadFileCount: number;
  payloadByteLength: number;
  sourceExcerptPolicy:
    "exact_source_excerpts_omitted_references_and_hashes_retained";
  privateDataPolicy:
    "no_tokens_capabilities_credentials_private_restoration_hidden_reasoning_or_raw_user_data";
  fingerprintSemantics:
    "integrity_coordinate_detects_change_not_source_truth_or_signature";
  exportedAt: string;
  manifestFingerprint: string;
};

export type PartialResearchExportBundle = {
  schemaVersion: typeof SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION;
  exportId: string;
  exportFingerprint: string;
  completenessStatus: "partial";
  manifest: PartialResearchExportManifest;
  files: ExportFile[];
};

export type WorkflowResearchExportBundle =
  | Screen6ResearchExportBundle
  | PartialResearchExportBundle;

const SENSITIVE_KEY = /^(?:accessToken|authorization|apiKey|capabilityToken|credential|credentials|hiddenReasoning|privateContent|rawData|secret|token)$/iu;
const URL_KEY = /(?:canonicalUrl|requestUrl|attemptedUrl|landingPageUrl|pdfUrl|locator|stableLocator)$/u;
const SENSITIVE_QUERY_PARAMETER =
  /^(?:api[_-]?key|key|token|access[_-]?token|authorization)$/iu;

function textBytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function csv(rows: Array<Array<string | number | null>>) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function sanitizedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (url.protocol !== "https:") return "omitted_unsafe_locator";
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_PARAMETER.test(name)) url.searchParams.delete(name);
  }
  return url.toString();
}

function sanitizeForDefaultExport(value: unknown, key = ""): unknown {
  if (value === null || typeof value === "number" ||
    typeof value === "boolean") return value;
  if (typeof value === "string") {
    return URL_KEY.test(key) ? sanitizedUrl(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDefaultExport(item));
  }
  if (typeof value !== "object") return null;
  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (SENSITIVE_KEY.test(childKey)) continue;
    output[childKey] = childKey === "exactText"
      ? "omitted_from_default_export"
      : sanitizeForDefaultExport(childValue, childKey);
  }
  return output;
}

function currentArtifactIds(state: SixScreenWorkflowState, screen: 2 | 3 | 4 | 5 | 6) {
  return state.artifacts.filter((artifact) =>
    artifact.screen === screen && artifact.status === "current"
  ).map(({ snapshotId }) => snapshotId);
}

function currentLockedEventCard(state: SixScreenWorkflowState) {
  const currentIds = new Set(currentArtifactIds(state, 2));
  return [...(state.policyEventCardReviews ?? [])].reverse().find((review) =>
    review.status === "locked" && review.lockedEventCard &&
    currentIds.has(review.lockedEventCard.snapshotId)
  )?.lockedEventCard ?? null;
}

function identityResolved(state: SixScreenWorkflowState) {
  return Boolean(
    state.confirmedShock ||
      (state.lastIdentityResolution?.status === "resolved" &&
        state.candidates.length),
  );
}

function moduleAvailability(state: SixScreenWorkflowState) {
  const eventCard = currentLockedEventCard(state);
  const current3 = new Set(currentArtifactIds(state, 3));
  const current4 = new Set(currentArtifactIds(state, 4));
  const current5 = new Set(currentArtifactIds(state, 5));
  const current6 = new Set(currentArtifactIds(state, 6));
  const designSet = [...(state.causalDesignSets ?? [])].reverse().find(
    ({ snapshotId }) => current3.has(snapshotId),
  ) ?? null;
  const designDecision = [...(state.causalDesignDecisions ?? [])].reverse()
    .find(({ designSetSnapshotId }) => designSet?.snapshotId === designSetSnapshotId) ?? null;
  const coevent = Boolean(
    (state.coEventSearchExecutions ?? []).some(({ snapshotId }) =>
      current4.has(snapshotId)) ||
      (state.coEventSearchMatrices ?? []).some(({ snapshotId }) =>
        current4.has(snapshotId)),
  );
  const mechanism = Boolean(
    (state.mechanismReviews ?? []).some(({ snapshotId }) =>
      current5.has(snapshotId)) ||
    (state.mechanismSynthesisInputPackets ?? []).some(({ snapshotId }) =>
      current5.has(snapshotId)) ||
      (state.mechanismLiteraturePlans ?? []).some(({ snapshotId }) =>
        current5.has(snapshotId)),
  );
  const mechanismReview = Boolean(
    (state.mechanismReviews ?? []).some(({ snapshotId }) =>
      current5.has(snapshotId)) &&
    (state.predictionMatrices ?? []).some(({ snapshotId }) =>
      current5.has(snapshotId)),
  );
  const credibility = Boolean(
    (state.screen6UncertaintyProfiles ?? []).some(({ snapshotId }) =>
      current6.has(snapshotId)),
  );
  return {
    eventCard,
    designSet,
    designDecision,
    coevent,
    mechanism,
    mechanismReview,
    credibility,
  };
}

export function workflowResearchExportAvailability(
  state: SixScreenWorkflowState,
): WorkflowResearchExportAvailability {
  if (!identityResolved(state)) {
    return {
      available: false,
      completenessStatus: "unavailable",
      source: "unavailable",
      includedModules: ["study"],
      excludedOrUnassessedEvidence: [
        "Identity resolution has not produced a reviewable or confirmed policy record.",
      ],
    };
  }
  const finalExport = currentScreen6ResearchExport(state);
  if (finalExport) {
    return {
      available: true,
      completenessStatus: finalExport.completeness.status,
      source: "screen6_final_export",
      includedModules: [...finalExport.completeness.includedModules],
      excludedOrUnassessedEvidence:
        [...finalExport.completeness.excludedOrUnassessedEvidence],
    };
  }
  const modules = moduleAvailability(state);
  const includedModules = [
    "study",
    state.confirmedShock ? "confirmed_identity" : "resolved_identity_candidates",
    ...(modules.eventCard ? ["reviewed_event_card"] : []),
    ...(modules.designSet ? ["causal_comparison"] : []),
    ...(modules.coevent ? ["coevent_search"] : []),
    ...(modules.mechanismReview
      ? ["mechanism_review_and_predictions"]
      : modules.mechanism
      ? ["mechanism_literature"]
      : []),
    ...(modules.credibility ? ["credibility_planning"] : []),
  ];
  const excludedOrUnassessedEvidence = [
    ...(!state.confirmedShock
      ? ["A policy identity is resolved for review but has not been confirmed by the researcher."]
      : []),
    ...(!modules.eventCard ? ["Screen 2 reviewed Event Card is not current."] : []),
    ...(!modules.designSet ? ["Screen 3 causal comparison is not current."] : []),
    ...(modules.designSet && !modules.designDecision
      ? ["Screen 3 has no current researcher comparison decision."]
      : []),
    ...(!modules.coevent ? ["Screen 4 co-event work is not current."] : []),
    ...(!modules.mechanism ? ["Screen 5 mechanism literature work is not current."] : []),
    ...(modules.mechanism && !modules.mechanismReview
      ? ["Screen 5 has no current researcher-authored mechanism review and prediction matrix."]
      : []),
    ...(!modules.credibility ? ["Screen 6 credibility planning is not current."] : []),
    "No current immutable Screen 6 final export is available; this is a partial current-snapshot record.",
  ];
  return {
    available: true,
    completenessStatus: "partial",
    source: "current_partial_snapshot",
    includedModules,
    excludedOrUnassessedEvidence,
  };
}

function sourceRows(state: SixScreenWorkflowState) {
  const rows = new Map<string, Array<string | number | null>>();
  for (const candidate of state.candidates) {
    for (const source of candidate.identitySources) {
      const id = `screen1:${source.id}`;
      rows.set(id, [
        id, 1, source.id, "identity_reference", source.title,
        sanitizedUrl(source.locator), source.publisher, source.authorityTier,
        source.publishedDate, source.retrievedAt, "metadata_and_reference_only",
      ]);
    }
  }
  for (const claim of state.policyReview?.claims ?? []) {
    const source = claim.citation;
    const id = `screen2:${source.sourceId}:${source.passageId}`;
    rows.set(id, [
      id, 2, source.sourceId, "reviewed_policy_evidence_reference",
      source.sourceTitle, sanitizedUrl(source.canonicalUrl), source.sourceRole,
      source.locator, null, null, "exact_excerpt_omitted",
    ]);
  }
  for (const candidate of state.coEventCandidates ?? []) {
    for (const source of candidate.evidence) {
      const id = `screen4:${source.sourceId}`;
      rows.set(id, [
        id, 4, source.sourceId, "coevent_occurrence_metadata", source.title,
        sanitizedUrl(source.locator), source.publisher,
        `authority_tier_${source.authorityTier}`, source.publishedDate,
        source.retrievedAt, "metadata_and_reference_only",
      ]);
    }
  }
  for (const record of state.scholarlyMetadataRecords ?? []) {
    const id = `screen5:${record.id}`;
    rows.set(id, [
      id, 5, record.id, "scholarly_metadata_lead", record.title,
      sanitizedUrl(record.stableLocator), record.publisher, record.providerId,
      record.publishedDate, record.source.retrievedAt,
      "metadata_and_reference_only",
    ]);
  }
  for (const acquisition of state.scholarlyDocumentAcquisitions ?? []) {
    if (!acquisition.document) continue;
    const document = acquisition.document;
    const id = `screen5:${document.sourceId}`;
    rows.set(id, [
      id, 5, document.sourceId, "inspected_scholarly_document_reference",
      document.title, sanitizedUrl(document.canonicalUrl),
      document.sourceFamily, document.versionLabel, null, document.retrievedAt,
      "exact_excerpt_omitted",
    ]);
  }
  return [...rows.values()];
}

function claimRows(state: SixScreenWorkflowState) {
  const rows: Array<Array<string | number | null>> = [];
  for (const claim of state.policyReview?.claims ?? []) {
    rows.push([
      `screen2:${claim.claimId}`, 2, claim.claimId, "reviewed_policy_claim",
      claim.statement, claim.supportStatus, claim.citation.sourceId,
      claim.citation.passageId, claim.qualification,
    ]);
  }
  for (const candidate of state.coEventCandidates ?? []) {
    rows.push([
      `screen4:${candidate.id}`, 4, candidate.id,
      "coevent_occurrence_record", candidate.title,
      candidate.occurrenceStatus,
      candidate.evidence.map(({ sourceId }) => sourceId).join(";"), "",
      candidate.claimBoundary,
    ]);
  }
  for (const extraction of state.scholarlyClaimExtractions ?? []) {
    const latestReview = [...(state.scholarlyClaimReviews ?? [])].reverse().find(
      ({ extractionReference }) =>
        extractionReference.extractionId === extraction.id,
    );
    rows.push([
      `screen5:${extraction.id}`, 5, extraction.id,
      "researcher_authored_scholarly_claim",
      extraction.fields.theoreticalProposition ??
        extraction.fields.relevantResultOrQualification ??
        "Structured scholarly claim without a proposition statement",
      latestReview?.decision ?? "unreviewed", extraction.documentReference.documentId,
      extraction.passageReference.passageId, extraction.claimBoundary,
    ]);
  }
  for (const review of state.mechanismReviews ?? []) {
    for (const mechanism of review.mechanisms) {
      rows.push([
        `screen5:${review.snapshotId}:${mechanism.id}`,
        5,
        mechanism.id,
        "researcher_mechanism_hypothesis",
        `${mechanism.label}: ${mechanism.causalSequence.join(" → ")}`,
        mechanism.decision,
        mechanism.acceptedClaimReferences.map(({ extractionId }) =>
          extractionId).join(";"),
        "",
        review.claimBoundary,
      ]);
    }
  }
  for (const boundary of state.screen6ConditionalClaimBoundaries ?? []) {
    rows.push([
      `screen6:${boundary.snapshotId}`, 6, boundary.snapshotId,
      "prospective_conditional_claim", boundary.intendedClaim.prospectiveStatement,
      boundary.intendedClaim.relationshipToCurrentDesign, "", "",
      boundary.claimBoundary,
    ]);
  }
  return rows;
}

function readableReport(input: {
  state: SixScreenWorkflowState;
  availability: WorkflowResearchExportAvailability;
  exportedAt: string;
}) {
  const { state, availability, exportedAt } = input;
  const identity = state.confirmedShock?.officialTitle ??
    state.candidates.find(({ id }) => id === state.displayedCandidateId)
      ?.officialTitle ?? "Identity awaiting researcher confirmation";
  const included = availability.includedModules.map((item) =>
    `- ${item.replaceAll("_", " ")}`).join("\n");
  const omitted = availability.excludedOrUnassessedEvidence.map((item) =>
    `- ${item}`).join("\n");
  const plan = createScreen6CurrentPlan(state);
  const compatibleChallengeFingerprints = new Set(
    screen6CompatibleInputFingerprints(plan),
  );
  const hasCurrentChallenge = (state.screen6Personalizations ?? []).some(
    (item) => compatibleChallengeFingerprints.has(item.inputFingerprint) &&
      item.status === "completed" && Boolean(item.supplement));
  return `# ShockAudit partial research record\n\n` +
    `Exported: ${exportedAt}.\n\n` +
    `Workflow: ${state.runId}, revision ${state.revision}.\n\n` +
    `Study: ${state.study.id}, revision ${state.study.revision}.\n\n` +
    `Policy identity: ${identity}.\n\n` +
    `Outcome: ${state.study.outcome ?? "not recorded"}.\n\n` +
    `Theoretical construct of the shock: ${state.study.policySideConcept ?? "not recorded"}.\n\n` +
    `Finalized focal mechanism: ${plan.study.focalMechanism ?? "not yet finalized"}.\n\n` +
    `Study-specific challenge plan: ${hasCurrentChallenge
      ? "saved; see currentStudySpecificGuidance in credibility-plan.json"
      : "not yet generated; general checks are in credibility-plan.json"}.\n\n` +
    `## Included modules\n\n${included}\n\n` +
    `## Unresolved or unassessed work\n\n${omitted}\n\n` +
    `## Export boundary\n\n` +
    `This is a partial source-linked current-snapshot record, not a treatment-effect estimate, proof of an identifying assumption, aggregate score, universal badge, attribution upgrade, or causal certificate. Exact source excerpts, credentials, access tokens, signed capabilities, private restoration state, hidden reasoning and raw user data are omitted by default.\n`;
}

function partialFiles(input: {
  state: SixScreenWorkflowState;
  availability: WorkflowResearchExportAvailability;
  exportedAt: string;
}) {
  const { state, availability, exportedAt } = input;
  const lockedEventCard = currentLockedEventCard(state);
  const currentMechanismRun = currentStudyFirstMechanismRunForState(state);
  const currentChallengePlan = createScreen6CurrentPlan(state);
  const compatibleChallengeFingerprints = new Set(
    screen6CompatibleInputFingerprints(currentChallengePlan),
  );
  const currentChallengeResult = [...(state.screen6Personalizations ?? [])]
    .reverse().find((item) => compatibleChallengeFingerprints.has(
      item.inputFingerprint) && item.status === "completed" &&
      item.supplement) ?? null;
  const report = readableReport(input);
  return [
    {
      name: "design-record.md",
      mediaType: "text/markdown" as const,
      content: report,
    },
    {
      name: "README.md",
      mediaType: "text/markdown" as const,
      content:
        `# ShockAudit partial research export\n\n` +
        `Status: partial. Generated from workflow revision ${state.revision}.\n\n` +
        `Read manifest.json before reuse. Exact source excerpts and private authorization material are omitted by default. Missing modules remain explicit and no fingerprint certifies source truth.\n`,
    },
    {
      name: "study.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport(state.study)),
    },
    {
      name: "confirmed-shock.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        status: state.confirmedShock ? "confirmed" : "identity_review",
        confirmedShock: state.confirmedShock,
        displayedCandidate: state.candidates.find(({ id }) =>
          id === state.displayedCandidateId) ?? null,
      })),
    },
    {
      name: "event-card.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        status: lockedEventCard ? "reviewed_event_card" : "not_assessed",
        eventCard: lockedEventCard,
        reviewHistory: state.policyEventCardReviews ?? [],
      })),
    },
    {
      name: "designs.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        designSets: state.causalDesignSets ?? [],
        decisions: state.causalDesignDecisions ?? [],
      })),
    },
    {
      name: "coevents.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        searchMatrices: state.coEventSearchMatrices ?? [],
        executionPlans: state.coEventExecutionPlans ?? [],
        executions: state.coEventSearchExecutions ?? [],
        candidates: state.coEventCandidates ?? [],
        discoveryLeads: state.coEventDiscoveryLeads ?? [],
        occurrenceReviews: state.coEventOccurrenceReviews ?? [],
        duplicateReviews: state.coEventDuplicateReviews ?? [],
        relationReviews: state.coEventRelationReviews ?? [],
        lifecycleHandoffs: state.coEventPolicyLifecycleHandoffs ?? [],
      })),
    },
    {
      name: "mechanisms.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        literaturePlans: state.mechanismLiteraturePlans ?? [],
        executionPlans: state.mechanismLiteratureExecutionPlans ?? [],
        executions: state.mechanismLiteratureExecutions ?? [],
        metadataRecords: state.scholarlyMetadataRecords ?? [],
        evidencePackets: state.scholarlyEvidencePackets ?? [],
        documentAcquisitions: state.scholarlyDocumentAcquisitions ?? [],
        passagePackets: state.scholarlyPassagePackets ?? [],
        claimExtractions: state.scholarlyClaimExtractions ?? [],
        claimReviews: state.scholarlyClaimReviews ?? [],
        claimPackets: state.scholarlyClaimPackets ?? [],
        synthesisInputPackets: state.mechanismSynthesisInputPackets ?? [],
        mechanismReviews: state.mechanismReviews ?? [],
        predictionMatrices: state.predictionMatrices ?? [],
        semanticSynthesis: {
          status: "not_available_in_partial_export",
        },
        currentDirectComparison: currentMechanismRun ? {
          inputFingerprint: currentMechanismRun.input.inputFingerprint,
          focal: {
            proposedMechanism: currentMechanismRun.input.proposedMechanism,
            theoreticalPerspective:
              currentMechanismRun.input.theoreticalPerspective,
          },
          proposals: currentMechanismRun.planning?.plan?.candidates ?? [],
          comparison: currentMechanismRun.providerExecution?.comparison ?? null,
          status: currentMechanismRun.providerExecution?.phase ??
            currentMechanismRun.status,
        } : null,
      })),
    },
    {
      name: "credibility-plan.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        uncertaintyProfiles: state.screen6UncertaintyProfiles ?? [],
        diagnosticPlans: state.screen6DiagnosticPlans ?? [],
        diagnosticResults: state.screen6DiagnosticResults ?? [],
        diagnosticResultReviews:
          state.screen6DiagnosticResultReviews ?? [],
        conditionalClaimBoundaries:
          state.screen6ConditionalClaimBoundaries ?? [],
        researchPlanningDispositions:
          state.screen6ResearchPlanningDispositions ?? [],
        currentChallengePlan: {
          inputFingerprint: currentChallengePlan.inputFingerprint,
          snapshotRefs: currentChallengePlan.snapshotRefs,
          status: currentChallengePlan.status,
          study: currentChallengePlan.study,
          dimensions: currentChallengePlan.dimensions,
          priorities: currentChallengePlan.priorities,
          boundary: currentChallengePlan.boundary,
          gaps: currentChallengePlan.gaps,
        },
        currentStudySpecificGuidance: currentChallengeResult?.supplement ?? null,
        currentGuidanceInputFingerprint:
          currentChallengeResult?.inputFingerprint ?? null,
        currentGuidanceStatus: currentChallengeResult
          ? currentChallengeResult.inputFingerprint ===
              currentChallengePlan.inputFingerprint
            ? "validated_model_contextualization"
            : "validated_compatible_v24_contextualization"
          : "general_checks_only",
        finalExport: null,
      })),
    },
    {
      name: "sources.csv",
      mediaType: "text/csv" as const,
      content: csv([
        [
          "id", "screen", "source_id", "role", "title", "locator",
          "publisher", "source_detail", "published_date", "retrieved_at",
          "exported_content",
        ],
        ...sourceRows(state),
      ]),
    },
    {
      name: "claims.csv",
      mediaType: "text/csv" as const,
      content: csv([
        [
          "id", "screen", "claim_id", "kind", "statement",
          "review_status", "source_ids", "passage_ids", "qualification",
        ],
        ...claimRows(state),
      ]),
    },
    {
      name: "search-manifest.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        identityResolution: state.lastIdentityResolution,
        policy: state.policyReview
          ? {
              status: state.policyReview.status,
              plan: state.policyReview.plan,
              attemptedSources: state.policyReview.attemptedSources,
              unresolved: state.policyReview.unresolved,
            }
          : { status: "not_assessed" },
        coevents: {
          matrices: state.coEventSearchMatrices ?? [],
          executions: state.coEventSearchExecutions ?? [],
        },
        mechanisms: {
          plans: state.mechanismLiteraturePlans ?? [],
          executions: state.mechanismLiteratureExecutions ?? [],
          reviews: state.mechanismReviews ?? [],
          predictionMatrices: state.predictionMatrices ?? [],
        },
      })),
    },
    {
      name: "decisions.json",
      mediaType: "application/json" as const,
      content: json(sanitizeForDefaultExport({
        candidateDecisions: state.candidateDecisions,
        eventCardReviews: state.policyEventCardReviews ?? [],
        causalDesignDecisions: state.causalDesignDecisions ?? [],
        coEventOccurrenceReviews: state.coEventOccurrenceReviews ?? [],
        coEventDuplicateReviews: state.coEventDuplicateReviews ?? [],
        coEventRelationReviews: state.coEventRelationReviews ?? [],
        scholarlyClaimReviews: state.scholarlyClaimReviews ?? [],
        mechanismReviews: state.mechanismReviews ?? [],
        diagnosticResultReviews: state.screen6DiagnosticResultReviews ?? [],
        researchPlanningDispositions:
          state.screen6ResearchPlanningDispositions ?? [],
        workflowChanges: state.changeLog,
        workflowArtifacts: state.artifacts,
        exportAvailability: availability,
        exportedAt,
      })),
    },
  ] satisfies ExportFile[];
}

export function createWorkflowResearchExportBundle(input: {
  state: SixScreenWorkflowState;
  exportedAt: string;
}): WorkflowResearchExportBundle {
  requireCanonicalInstant(input.exportedAt, "Research export createdAt");
  const availability = workflowResearchExportAvailability(input.state);
  if (!availability.available) {
    throw new Error(
      "A partial research export is available only after policy identity resolution.",
    );
  }
  const finalExport = currentScreen6ResearchExport(input.state);
  if (finalExport) return createScreen6ResearchExportBundle(finalExport);

  const files = partialFiles({ ...input, availability });
  const payloadByteLength = files.reduce((total, file) =>
    total + textBytes(file.content), 0);
  if (payloadByteLength > PARTIAL_EXPORT_MAX_BYTES) {
    throw new Error("The partial research export exceeds its bounded size.");
  }
  const stateFingerprint = fingerprintSixScreenValue(input.state);
  const manifestBody = {
    schemaVersion: SIX_SCREEN_PARTIAL_EXPORT_MANIFEST_VERSION,
    applicationVersion: SHOCKAUDIT_VERSION,
    exportSchemaVersion: SIX_SCREEN_PARTIAL_EXPORT_VERSION,
    bundleFormat: SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION,
    completenessStatus: "partial" as const,
    workflowSnapshot: {
      runId: input.state.runId,
      revision: input.state.revision,
      stateFingerprint,
      currentArtifactSnapshotIds: input.state.artifacts.filter(({ status }) =>
        status === "current").map(({ snapshotId }) => snapshotId),
    },
    includedModules: [...availability.includedModules],
    excludedOrUnassessedEvidence:
      [...availability.excludedOrUnassessedEvidence],
    files: files.map((file) => ({
      name: file.name,
      mediaType: file.mediaType,
      byteLength: textBytes(file.content),
      contentFingerprint: fingerprintSixScreenValue(file.content),
    })),
    payloadFileCount: files.length,
    payloadByteLength,
    sourceExcerptPolicy:
      "exact_source_excerpts_omitted_references_and_hashes_retained" as const,
    privateDataPolicy:
      "no_tokens_capabilities_credentials_private_restoration_hidden_reasoning_or_raw_user_data" as const,
    fingerprintSemantics:
      "integrity_coordinate_detects_change_not_source_truth_or_signature" as const,
    exportedAt: input.exportedAt,
  };
  const manifest: PartialResearchExportManifest = {
    ...manifestBody,
    manifestFingerprint: fingerprintSixScreenValue(manifestBody),
  };
  const filesWithManifest = [
    ...files,
    {
      name: "manifest.json",
      mediaType: "application/json" as const,
      content: json(manifest),
    },
  ];
  const exportId = `partial:${input.state.runId}:${input.state.revision}`;
  const body = {
    schemaVersion: SIX_SCREEN_PARTIAL_EXPORT_BUNDLE_VERSION,
    exportId,
    completenessStatus: "partial" as const,
    manifest,
    files: filesWithManifest,
  };
  return {
    ...body,
    exportFingerprint: fingerprintSixScreenValue(body),
  };
}
