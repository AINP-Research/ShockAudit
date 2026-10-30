import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
} from "./contracts";
import {
  validateScreen6DiagnosticPlanInput,
  type Screen6DiagnosticCard,
  type Screen6DiagnosticPlan,
} from "./screen6-diagnostic-plan";

export const SIX_SCREEN_DIAGNOSTIC_RESULT_INPUT_VERSION =
  "screen-06-diagnostic-result-input-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_IMPORT_ARTIFACT_VERSION =
  "screen-06-diagnostic-import-artifact-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_RESULT_VERSION =
  "screen-06-diagnostic-result-v1" as const;
export const SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_VERSION =
  "screen-06-diagnostic-result-review-v1" as const;

export const SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_RECORDS = 96;
export const SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_PER_CARD = 8;
export const SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_MAX_RECORDS = 96;
export const SIX_SCREEN_DIAGNOSTIC_RESULT_COLLECTION_MAX_BYTES = 4_000_000;

const RESULT_BOUNDARY =
  "This record preserves a researcher-supplied diagnostic result and its provenance. It does not reproduce the calculation, interpret the result, establish an identifying assumption, tune the design, create an aggregate score, certify a causal claim, or create a conditional claim boundary, disposition, CredibilityPlan export, or Design Record.";
const REVIEW_BOUNDARY =
  "This explicit researcher review may mark a concern reduced, inconclusive, or in need of revision. A reduced concern does not prove the identifying assumption. The review cannot tune the design automatically, upgrade attribution, create an aggregate score or certificate, or create a conditional claim boundary, disposition, CredibilityPlan export, or Design Record.";

export type Screen6DiagnosticResultKind =
  | "quantitative"
  | "qualitative_or_documentary";

export type Screen6DiagnosticResultConsiderationStatus =
  | "assessed"
  | "not_assessed"
  | "not_applicable";

export type Screen6DiagnosticResultConsideration = {
  status: Screen6DiagnosticResultConsiderationStatus;
  description: string | null;
};

export type Screen6ReportedStatistic = {
  label: string;
  estimate: number;
  standardError: number | null;
  confidenceInterval: {
    levelPercent: number;
    lower: number;
    upper: number;
  } | null;
  pValue: number | null;
};

export type Screen6DiagnosticCovariance = {
  status: "supplied" | "not_supplied" | "not_applicable";
  dimension: number | null;
  values: number[];
};

export type Screen6ImportedDiagnosticArtifact = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_IMPORT_ARTIFACT_VERSION;
  artifactId: string;
  artifactName: string;
  producer: string;
  methodName: string;
  methodVersion: string;
  generatedAt: string;
  payloadFingerprint: string;
};

export type Screen6DiagnosticResultProvenanceInput =
  | {
      kind: "user_reported";
      sourceDescription: string;
    }
  | {
      kind: "imported_validated_artifact";
      artifact: Screen6ImportedDiagnosticArtifact;
    }
  | {
      kind: "reviewed_local_routine";
      routineId: string;
      routineVersion: string;
      executionId: string;
    };

export type Screen6DiagnosticResultInput = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_RESULT_INPUT_VERSION;
  resultKind: Screen6DiagnosticResultKind;
  provenance: Screen6DiagnosticResultProvenanceInput;
  summary: string;
  reportedStatistics: Screen6ReportedStatistic[];
  covariance: Screen6DiagnosticCovariance;
  uncertaintyContext: Screen6DiagnosticResultConsideration;
  specificationContext: string;
  power: Screen6DiagnosticResultConsideration;
  multipleTesting: Screen6DiagnosticResultConsideration;
  sampleComposition: Screen6DiagnosticResultConsideration;
  precision: Screen6DiagnosticResultConsideration;
  postInspectionChange: {
    status: "reported" | "none_reported" | "not_assessed";
    description: string | null;
  };
  inputFingerprint: string;
};

export type Screen6DiagnosticResult = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_RESULT_VERSION;
  id: string;
  ordinal: number;
  binding: {
    profileSnapshotId: string;
    profileFingerprint: string;
    planSnapshotId: string;
    planFingerprint: string;
    diagnosticInputFingerprint: string;
    cardId: string;
    cardFingerprint: string;
    libraryEntryId: Screen6DiagnosticCard["libraryEntryId"];
    libraryFingerprint: string;
  };
  previousResult: {
    resultId: string;
    resultFingerprint: string;
  } | null;
  input: Screen6DiagnosticResultInput;
  resultPayloadFingerprint: string;
  provenance: {
    kind: "user_reported" | "imported_validated_artifact";
    displayLabel: string;
    artifactValidation:
      | "not_applicable"
      | "schema_and_payload_fingerprint_validated";
    calculationReproducibility:
      | "not_reproducible_from_submission"
      | "not_established_by_import_validation";
    localRoutineExecution: "not_performed";
  };
  reviewReadiness: {
    status: "complete_for_researcher_review" | "incomplete_context";
    gaps: string[];
  };
  interpretationStatus: "awaiting_researcher_review";
  actor: "researcher";
  preparation: {
    networkRequests: 0;
    modelCalls: 0;
    localRoutineCalls: 0;
  };
  nonOutputs: {
    assumptionEstablished: false;
    diagnosticPass: null;
    aggregateScore: null;
    universalBadge: null;
    certification: "not_available";
    conditionalClaimBoundary: null;
    disposition: null;
    credibilityPlanExport: null;
    designRecord: null;
  };
  claimBoundary: typeof RESULT_BOUNDARY;
  submittedAt: string;
  resultFingerprint: string;
};

export type Screen6DiagnosticResultReviewDecision =
  | "concern_reduced"
  | "inconclusive"
  | "revision_needed";

export type Screen6DiagnosticResultReview = {
  schemaVersion: typeof SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_VERSION;
  id: string;
  ordinal: number;
  resultReference: {
    resultId: string;
    resultFingerprint: string;
    planSnapshotId: string;
    planFingerprint: string;
    cardId: string;
    libraryEntryId: Screen6DiagnosticCard["libraryEntryId"];
  };
  decision: Screen6DiagnosticResultReviewDecision;
  rationale: string;
  followUpActions: string[];
  actor: "researcher";
  reviewedAt: string;
  assumptionEstablished: false;
  automaticDesignMutation: "none";
  attributionUpgrade: "none";
  aggregateScore: null;
  certification: "not_available";
  conditionalClaimBoundary: null;
  disposition: null;
  credibilityPlanExport: null;
  designRecord: null;
  claimBoundary: typeof REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

type ResultInputDraft = Omit<
  Screen6DiagnosticResultInput,
  "schemaVersion" | "inputFingerprint"
>;
type ResultBody = Omit<Screen6DiagnosticResult, "resultFingerprint">;
type ReviewBody = Omit<Screen6DiagnosticResultReview, "reviewFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, maximum = 2_000) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(
      `${label} must be non-empty canonical text within ${maximum} characters.`,
    );
  }
  return value;
}

function requireFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function textList(
  values: readonly string[],
  label: string,
  maximumEntries: number,
  maximumText = 1_000,
) {
  if (
    values.length > maximumEntries ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, maximumText));
  return [...values];
}

function normalizeConsideration(
  value: Screen6DiagnosticResultConsideration,
  label: string,
): Screen6DiagnosticResultConsideration {
  if (![
    "assessed",
    "not_assessed",
    "not_applicable",
  ].includes(value.status)) throw new Error(`${label} status is invalid.`);
  if (value.status === "not_assessed") {
    if (value.description !== null) {
      throw new Error(`${label} cannot contain an unassessed description.`);
    }
  } else {
    if (value.description === null) {
      throw new Error(`${label} requires a description or applicability reason.`);
    }
    requireText(value.description, `${label} description`, 2_000);
  }
  return structuredClone(value);
}

function normalizeStatistics(values: readonly Screen6ReportedStatistic[]) {
  if (values.length > 32) {
    throw new Error("Screen 6 reported statistics exceed the 32-entry limit.");
  }
  const labels = new Set<string>();
  return values.map((value) => {
    requireText(value.label, "Screen 6 statistic label", 500);
    if (labels.has(value.label)) {
      throw new Error("Screen 6 statistic labels must be unique.");
    }
    labels.add(value.label);
    requireFinite(value.estimate, "Screen 6 statistic estimate");
    if (value.standardError !== null) {
      requireFinite(value.standardError, "Screen 6 statistic standard error");
      if (value.standardError < 0) {
        throw new Error("Screen 6 statistic standard error cannot be negative.");
      }
    }
    if (value.confidenceInterval) {
      const interval = value.confidenceInterval;
      requireFinite(interval.levelPercent, "Screen 6 confidence level");
      requireFinite(interval.lower, "Screen 6 confidence lower bound");
      requireFinite(interval.upper, "Screen 6 confidence upper bound");
      if (
        interval.levelPercent <= 0 || interval.levelPercent >= 100 ||
        interval.lower > interval.upper ||
        value.estimate < interval.lower || value.estimate > interval.upper
      ) throw new Error("Screen 6 confidence interval is invalid.");
    }
    if (value.pValue !== null) {
      requireFinite(value.pValue, "Screen 6 statistic p-value");
      if (value.pValue < 0 || value.pValue > 1) {
        throw new Error("Screen 6 statistic p-value must be between zero and one.");
      }
    }
    return structuredClone(value);
  });
}

function normalizeCovariance(value: Screen6DiagnosticCovariance) {
  if (![
    "supplied",
    "not_supplied",
    "not_applicable",
  ].includes(value.status)) throw new Error("Screen 6 covariance status is invalid.");
  if (value.status !== "supplied") {
    if (value.dimension !== null || value.values.length > 0) {
      throw new Error("An unsupplied covariance matrix cannot contain values.");
    }
    return structuredClone(value);
  }
  if (
    value.dimension === null || !Number.isSafeInteger(value.dimension) ||
    value.dimension < 1 || value.dimension > 20 ||
    value.values.length !== value.dimension * value.dimension
  ) throw new Error("Screen 6 covariance matrix dimensions are invalid.");
  value.values.forEach((entry) =>
    requireFinite(entry, "Screen 6 covariance entry")
  );
  for (let row = 0; row < value.dimension; row += 1) {
    const diagonal = value.values[row * value.dimension + row]!;
    if (diagonal < 0) {
      throw new Error("Screen 6 covariance diagonal cannot be negative.");
    }
    for (let column = row + 1; column < value.dimension; column += 1) {
      const left = value.values[row * value.dimension + column]!;
      const right = value.values[column * value.dimension + row]!;
      const tolerance = 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
      if (Math.abs(left - right) > tolerance) {
        throw new Error("Screen 6 covariance matrix must be symmetric.");
      }
    }
  }
  const factor = Array.from(
    { length: value.dimension },
    () => Array<number>(value.dimension!).fill(0),
  );
  for (let row = 0; row < value.dimension; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let residual = value.values[row * value.dimension + column]!;
      for (let prior = 0; prior < column; prior += 1) {
        residual -= factor[row]![prior]! * factor[column]![prior]!;
      }
      const tolerance = 1e-10 * Math.max(
        1,
        Math.abs(value.values[row * value.dimension + row]!),
        Math.abs(value.values[column * value.dimension + column]!),
      );
      if (row === column) {
        if (residual < -tolerance) {
          throw new Error(
            "Screen 6 covariance matrix must be positive semidefinite.",
          );
        }
        factor[row]![column] = Math.sqrt(Math.max(0, residual));
      } else if (factor[column]![column]! > tolerance) {
        factor[row]![column] = residual / factor[column]![column]!;
      } else if (Math.abs(residual) > tolerance) {
        throw new Error(
          "Screen 6 covariance matrix must be positive semidefinite.",
        );
      }
    }
  }
  return structuredClone(value);
}

function normalizePostInspectionChange(
  value: Screen6DiagnosticResultInput["postInspectionChange"],
) {
  if (![
    "reported",
    "none_reported",
    "not_assessed",
  ].includes(value.status)) {
    throw new Error("Screen 6 post-inspection-change status is invalid.");
  }
  if (value.status === "reported") {
    if (value.description === null) {
      throw new Error("A reported post-inspection change needs a description.");
    }
    requireText(
      value.description,
      "Screen 6 post-inspection-change description",
      2_000,
    );
  } else if (value.description !== null) {
    throw new Error("An unreported post-inspection change cannot contain details.");
  }
  return structuredClone(value);
}

function evidenceBody(input: ResultInputDraft | Screen6DiagnosticResultInput) {
  return {
    resultKind: input.resultKind,
    summary: input.summary,
    reportedStatistics: input.reportedStatistics,
    covariance: input.covariance,
    uncertaintyContext: input.uncertaintyContext,
    specificationContext: input.specificationContext,
    power: input.power,
    multipleTesting: input.multipleTesting,
    sampleComposition: input.sampleComposition,
    precision: input.precision,
    postInspectionChange: input.postInspectionChange,
  };
}

function inputBody(input: Screen6DiagnosticResultInput): ResultInputDraft {
  const {
    schemaVersion: _schemaVersion,
    inputFingerprint: _inputFingerprint,
    ...body
  } = input;
  return body;
}

function normalizeEvidence(input: ResultInputDraft) {
  if (![
    "quantitative",
    "qualitative_or_documentary",
  ].includes(input.resultKind)) throw new Error("Screen 6 result kind is invalid.");
  requireText(input.summary, "Screen 6 diagnostic result summary", 4_000);
  requireText(
    input.specificationContext,
    "Screen 6 diagnostic specification context",
    4_000,
  );
  const reportedStatistics = normalizeStatistics(input.reportedStatistics);
  const covariance = normalizeCovariance(input.covariance);
  if (input.resultKind === "quantitative" && reportedStatistics.length === 0) {
    throw new Error("A quantitative Screen 6 result requires a reported estimate.");
  }
  if (
    input.resultKind === "qualitative_or_documentary" &&
    (reportedStatistics.length > 0 || covariance.status !== "not_applicable")
  ) {
    throw new Error(
      "A qualitative or documentary Screen 6 result cannot contain quantitative statistics or covariance.",
    );
  }
  if (
    input.resultKind === "quantitative" &&
    covariance.status === "supplied" &&
    covariance.dimension !== reportedStatistics.length
  ) {
    throw new Error(
      "The Screen 6 covariance dimension must match the reported-estimate vector.",
    );
  }
  return {
    resultKind: input.resultKind,
    summary: input.summary,
    reportedStatistics,
    covariance,
    uncertaintyContext: normalizeConsideration(
      input.uncertaintyContext,
      "Screen 6 uncertainty context",
    ),
    specificationContext: input.specificationContext,
    power: normalizeConsideration(input.power, "Screen 6 power assessment"),
    multipleTesting: normalizeConsideration(
      input.multipleTesting,
      "Screen 6 multiple-testing assessment",
    ),
    sampleComposition: normalizeConsideration(
      input.sampleComposition,
      "Screen 6 sample-composition assessment",
    ),
    precision: normalizeConsideration(
      input.precision,
      "Screen 6 precision assessment",
    ),
    postInspectionChange: normalizePostInspectionChange(
      input.postInspectionChange,
    ),
  };
}

function normalizeProvenance(
  provenance: Screen6DiagnosticResultProvenanceInput,
  payloadFingerprint: string,
): Screen6DiagnosticResultProvenanceInput {
  if (provenance.kind === "reviewed_local_routine") {
    throw new Error(
      "No reviewed pinned Screen 6 local diagnostic routine is enabled.",
    );
  }
  if (provenance.kind === "user_reported") {
    requireText(
      provenance.sourceDescription,
      "Screen 6 user-reported result source",
      2_000,
    );
    return structuredClone(provenance);
  }
  if (provenance.kind !== "imported_validated_artifact") {
    throw new Error("Screen 6 diagnostic-result provenance is invalid.");
  }
  const artifact = provenance.artifact;
  if (artifact.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_IMPORT_ARTIFACT_VERSION) {
    throw new Error("Screen 6 imported diagnostic artifact version is invalid.");
  }
  requireBoundedIdentifier(artifact.artifactId, "Screen 6 imported artifact id");
  requireText(artifact.artifactName, "Screen 6 imported artifact name", 500);
  requireText(artifact.producer, "Screen 6 imported artifact producer", 500);
  requireText(artifact.methodName, "Screen 6 imported artifact method", 500);
  requireText(
    artifact.methodVersion,
    "Screen 6 imported artifact method version",
    200,
  );
  requireCanonicalInstant(
    artifact.generatedAt,
    "Screen 6 imported artifact generatedAt",
  );
  requireFingerprint(
    artifact.payloadFingerprint,
    "Screen 6 imported artifact payload fingerprint",
  );
  if (artifact.payloadFingerprint !== payloadFingerprint) {
    throw new Error(
      "The imported artifact payload fingerprint does not match the supplied diagnostic result.",
    );
  }
  return structuredClone(provenance);
}

export function createScreen6DiagnosticResultInput(
  input: ResultInputDraft,
): Screen6DiagnosticResultInput {
  const normalized = normalizeEvidence(input);
  const resultPayloadFingerprint = fingerprintSixScreenValue(normalized);
  const provenance = normalizeProvenance(
    input.provenance,
    resultPayloadFingerprint,
  );
  const body = {
    schemaVersion: SIX_SCREEN_DIAGNOSTIC_RESULT_INPUT_VERSION,
    ...normalized,
    provenance,
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  };
}

export function screen6DiagnosticResultPayloadFingerprint(
  input: Screen6DiagnosticResultInput,
) {
  validateScreen6DiagnosticResultInput(input);
  return fingerprintSixScreenValue(evidenceBody(input));
}

export function validateScreen6DiagnosticResultInput(
  input: Screen6DiagnosticResultInput,
) {
  const recreated = createScreen6DiagnosticResultInput(inputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_RESULT_INPUT_VERSION ||
    !sameSixScreenValue(input, recreated)
  ) throw new Error("Screen 6 diagnostic-result input is invalid or noncanonical.");
  requireFingerprint(
    input.inputFingerprint,
    "Screen 6 diagnostic-result input fingerprint",
  );
  return input;
}

function cardForResult(plan: Screen6DiagnosticPlan, cardId: string) {
  const card = plan.cards.find(({ id }) => id === cardId);
  if (!card) throw new Error("The Screen 6 diagnostic card is not in this plan.");
  return card;
}

function reviewReadiness(
  card: Screen6DiagnosticCard,
  input: Screen6DiagnosticResultInput,
) {
  const gaps = card.missingPrerequisites.map((value) =>
    `Planned-card prerequisite remains unresolved: ${value}`
  );
  if (
    (card.category === "statistical_test" ||
      card.category === "sensitivity_analysis") &&
    input.resultKind !== "quantitative"
  ) {
    gaps.push(
      "This statistical or sensitivity card requires quantitative estimates before its concern can be reduced.",
    );
  }
  if (input.resultKind === "quantitative") {
    const hasPerEstimateUncertainty = input.reportedStatistics.every(
      ({ standardError, confidenceInterval }) =>
        standardError !== null || confidenceInterval !== null,
    );
    if (!hasPerEstimateUncertainty && input.covariance.status !== "supplied") {
      gaps.push("Uncertainty is not supplied for one or more reported estimates.");
    }
    if (input.uncertaintyContext.status === "not_assessed") {
      gaps.push("The uncertainty context has not been assessed.");
    }
    if (
      [
        "did-pre-treatment-dynamics-v1",
        "did-parallel-trends-sensitivity-v1",
        "did-staggered-adoption-v1",
      ].includes(card.libraryEntryId) &&
      input.reportedStatistics.length > 1 &&
      input.covariance.status !== "supplied"
    ) {
      gaps.push(
        "A multi-estimate DiD or event-time result needs its covariance matrix for joint interpretation.",
      );
    }
    if (
      input.covariance.status === "supplied" &&
      input.covariance.dimension !== input.reportedStatistics.length
    ) {
      gaps.push(
        "The covariance dimension does not match the number of reported estimates.",
      );
    }
  }
  for (const [label, consideration] of [
    ["Power", input.power],
    ["Multiple testing", input.multipleTesting],
    ["Sample composition", input.sampleComposition],
    ["Precision", input.precision],
  ] as const) {
    if (consideration.status === "not_assessed") {
      gaps.push(`${label} has not been assessed for interpretation.`);
    }
  }
  if (input.postInspectionChange.status === "not_assessed") {
    gaps.push(
      "Post-result changes to the design, sample, measure, or theory have not been assessed.",
    );
  }
  const unique = [...new Set(gaps)];
  return {
    status: unique.length
      ? "incomplete_context" as const
      : "complete_for_researcher_review" as const,
    gaps: unique,
  };
}

function resultProvenance(
  input: Screen6DiagnosticResultInput,
): Screen6DiagnosticResult["provenance"] {
  return input.provenance.kind === "user_reported"
    ? {
        kind: "user_reported",
        displayLabel: "User-reported result",
        artifactValidation: "not_applicable",
        calculationReproducibility: "not_reproducible_from_submission",
        localRoutineExecution: "not_performed",
      }
    : {
        kind: "imported_validated_artifact",
        displayLabel: "Imported artifact with validated schema and payload fingerprint",
        artifactValidation: "schema_and_payload_fingerprint_validated",
        calculationReproducibility:
          "not_established_by_import_validation",
        localRoutineExecution: "not_performed",
      };
}

function expectedResultBody(input: {
  id: string;
  cardId: string;
  plan: Screen6DiagnosticPlan;
  resultInput: Screen6DiagnosticResultInput;
  priorResults: readonly Screen6DiagnosticResult[];
  submittedAt: string;
}): ResultBody {
  requireBoundedIdentifier(input.id, "Screen 6 diagnostic-result id");
  requireCanonicalInstant(input.submittedAt, "Screen 6 diagnostic-result time");
  validateScreen6DiagnosticPlanInput(input.plan.diagnosticInput);
  validateScreen6DiagnosticResultInput(input.resultInput);
  if (Date.parse(input.submittedAt) < Date.parse(input.plan.createdAt)) {
    throw new Error("A Screen 6 diagnostic result predates its diagnostic plan.");
  }
  if (
    input.resultInput.provenance.kind === "imported_validated_artifact" &&
    Date.parse(input.resultInput.provenance.artifact.generatedAt) >
      Date.parse(input.submittedAt)
  ) {
    throw new Error(
      "A Screen 6 imported diagnostic artifact cannot postdate its result record.",
    );
  }
  const card = cardForResult(input.plan, input.cardId);
  const sameCard = input.priorResults.filter((result) =>
    result.binding.planSnapshotId === input.plan.snapshotId &&
    result.binding.cardId === card.id
  );
  if (sameCard.length >= SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_PER_CARD) {
    throw new Error("Screen 6 diagnostic-result history for this card reached capacity.");
  }
  const previous = sameCard.at(-1) ?? null;
  const lastResult = input.priorResults.at(-1);
  if (
    lastResult &&
    Date.parse(input.submittedAt) < Date.parse(lastResult.submittedAt)
  ) {
    throw new Error("Screen 6 diagnostic-result history is not chronological.");
  }
  const payloadFingerprint = screen6DiagnosticResultPayloadFingerprint(
    input.resultInput,
  );
  return {
    schemaVersion: SIX_SCREEN_DIAGNOSTIC_RESULT_VERSION,
    id: input.id,
    ordinal: input.priorResults.length + 1,
    binding: {
      profileSnapshotId: input.plan.binding.profileSnapshotId,
      profileFingerprint: input.plan.binding.profileFingerprint,
      planSnapshotId: input.plan.snapshotId,
      planFingerprint: input.plan.planFingerprint,
      diagnosticInputFingerprint: input.plan.diagnosticInput.inputFingerprint,
      cardId: card.id,
      cardFingerprint: fingerprintSixScreenValue(card),
      libraryEntryId: card.libraryEntryId,
      libraryFingerprint: card.libraryFingerprint,
    },
    previousResult: previous
      ? {
          resultId: previous.id,
          resultFingerprint: previous.resultFingerprint,
        }
      : null,
    input: structuredClone(input.resultInput),
    resultPayloadFingerprint: payloadFingerprint,
    provenance: resultProvenance(input.resultInput),
    reviewReadiness: reviewReadiness(card, input.resultInput),
    interpretationStatus: "awaiting_researcher_review",
    actor: "researcher",
    preparation: {
      networkRequests: 0,
      modelCalls: 0,
      localRoutineCalls: 0,
    },
    nonOutputs: {
      assumptionEstablished: false,
      diagnosticPass: null,
      aggregateScore: null,
      universalBadge: null,
      certification: "not_available",
      conditionalClaimBoundary: null,
      disposition: null,
      credibilityPlanExport: null,
      designRecord: null,
    },
    claimBoundary: RESULT_BOUNDARY,
    submittedAt: input.submittedAt,
  };
}

export function createScreen6DiagnosticResult(input: {
  id: string;
  cardId: string;
  plan: Screen6DiagnosticPlan;
  resultInput: Screen6DiagnosticResultInput;
  priorResults: readonly Screen6DiagnosticResult[];
  actor: "researcher_ui" | "model" | "system";
  submittedAt: string;
}): Screen6DiagnosticResult {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can record a Screen 6 diagnostic result.",
    );
  }
  if (input.priorResults.length >= SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_RECORDS) {
    throw new Error("Screen 6 diagnostic-result history reached capacity.");
  }
  const body = expectedResultBody(input);
  return validateScreen6DiagnosticResult({
    ...body,
    resultFingerprint: fingerprintSixScreenValue(body),
  }, input.plan, input.priorResults);
}

function resultBody(result: Screen6DiagnosticResult): ResultBody {
  const { resultFingerprint: _resultFingerprint, ...body } = result;
  return body;
}

export function validateScreen6DiagnosticResult(
  result: Screen6DiagnosticResult,
  plan: Screen6DiagnosticPlan,
  priorResults: readonly Screen6DiagnosticResult[],
) {
  const expected = expectedResultBody({
    id: result.id,
    cardId: result.binding.cardId,
    plan,
    resultInput: result.input,
    priorResults,
    submittedAt: result.submittedAt,
  });
  if (
    result.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_RESULT_VERSION ||
    result.resultFingerprint !== fingerprintSixScreenValue(resultBody(result)) ||
    !sameSixScreenValue(resultBody(result), expected) ||
    result.nonOutputs.assumptionEstablished !== false ||
    result.nonOutputs.diagnosticPass !== null ||
    result.nonOutputs.aggregateScore !== null ||
    result.nonOutputs.certification !== "not_available" ||
    result.preparation.networkRequests !== 0 ||
    result.preparation.modelCalls !== 0 ||
    result.preparation.localRoutineCalls !== 0
  ) throw new Error("Screen 6 diagnostic result is invalid.");
  requireFingerprint(
    result.resultFingerprint,
    "Screen 6 diagnostic-result fingerprint",
  );
  return result;
}

function expectedReviewBody(input: {
  id: string;
  result: Screen6DiagnosticResult;
  priorReviews: readonly Screen6DiagnosticResultReview[];
  decision: Screen6DiagnosticResultReviewDecision;
  rationale: string;
  followUpActions: readonly string[];
  reviewedAt: string;
}): ReviewBody {
  requireBoundedIdentifier(input.id, "Screen 6 diagnostic-result review id");
  requireCanonicalInstant(input.reviewedAt, "Screen 6 diagnostic-result review time");
  requireText(input.rationale, "Screen 6 diagnostic-result review rationale", 4_000);
  if (![
    "concern_reduced",
    "inconclusive",
    "revision_needed",
  ].includes(input.decision)) throw new Error("Screen 6 result-review decision is invalid.");
  const existing = input.priorReviews.filter((review) =>
    review.resultReference.resultId === input.result.id
  );
  if (existing.length) {
    throw new Error("A Screen 6 diagnostic result can be reviewed only once.");
  }
  if (Date.parse(input.reviewedAt) < Date.parse(input.result.submittedAt)) {
    throw new Error("A Screen 6 diagnostic-result review predates its result.");
  }
  const lastReview = input.priorReviews.at(-1);
  if (
    lastReview &&
    Date.parse(input.reviewedAt) < Date.parse(lastReview.reviewedAt)
  ) {
    throw new Error("Screen 6 diagnostic-result review history is not chronological.");
  }
  if (
    input.decision === "concern_reduced" &&
    input.result.reviewReadiness.status !== "complete_for_researcher_review"
  ) {
    throw new Error(
      "An incomplete Screen 6 result cannot support a reduced-concern review.",
    );
  }
  const followUpActions = textList(
    input.followUpActions,
    "Screen 6 diagnostic follow-up action",
    16,
    1_000,
  );
  if (input.decision === "revision_needed" && followUpActions.length === 0) {
    throw new Error("A revision-needed review requires at least one specified action.");
  }
  return {
    schemaVersion: SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_VERSION,
    id: input.id,
    ordinal: input.priorReviews.length + 1,
    resultReference: {
      resultId: input.result.id,
      resultFingerprint: input.result.resultFingerprint,
      planSnapshotId: input.result.binding.planSnapshotId,
      planFingerprint: input.result.binding.planFingerprint,
      cardId: input.result.binding.cardId,
      libraryEntryId: input.result.binding.libraryEntryId,
    },
    decision: input.decision,
    rationale: input.rationale,
    followUpActions,
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    assumptionEstablished: false,
    automaticDesignMutation: "none",
    attributionUpgrade: "none",
    aggregateScore: null,
    certification: "not_available",
    conditionalClaimBoundary: null,
    disposition: null,
    credibilityPlanExport: null,
    designRecord: null,
    claimBoundary: REVIEW_BOUNDARY,
  };
}

export function createScreen6DiagnosticResultReview(input: {
  id: string;
  result: Screen6DiagnosticResult;
  priorReviews: readonly Screen6DiagnosticResultReview[];
  decision: Screen6DiagnosticResultReviewDecision;
  rationale: string;
  followUpActions: readonly string[];
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can review a Screen 6 diagnostic result.",
    );
  }
  if (
    input.priorReviews.length >=
      SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_MAX_RECORDS
  ) throw new Error("Screen 6 diagnostic-result review history reached capacity.");
  const body = expectedReviewBody(input);
  return validateScreen6DiagnosticResultReview({
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  }, input.result, input.priorReviews);
}

function reviewBody(review: Screen6DiagnosticResultReview): ReviewBody {
  const { reviewFingerprint: _reviewFingerprint, ...body } = review;
  return body;
}

export function validateScreen6DiagnosticResultReview(
  review: Screen6DiagnosticResultReview,
  result: Screen6DiagnosticResult,
  priorReviews: readonly Screen6DiagnosticResultReview[],
) {
  const expected = expectedReviewBody({
    id: review.id,
    result,
    priorReviews,
    decision: review.decision,
    rationale: review.rationale,
    followUpActions: review.followUpActions,
    reviewedAt: review.reviewedAt,
  });
  if (
    review.schemaVersion !== SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_VERSION ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    !sameSixScreenValue(reviewBody(review), expected) ||
    review.assumptionEstablished !== false ||
    review.automaticDesignMutation !== "none" ||
    review.attributionUpgrade !== "none" ||
    review.aggregateScore !== null ||
    review.certification !== "not_available"
  ) throw new Error("Screen 6 diagnostic-result review is invalid.");
  requireFingerprint(
    review.reviewFingerprint,
    "Screen 6 diagnostic-result review fingerprint",
  );
  return review;
}

export function validateScreen6DiagnosticResultCollections(input: {
  plans: readonly Screen6DiagnosticPlan[];
  results: readonly Screen6DiagnosticResult[];
  reviews: readonly Screen6DiagnosticResultReview[];
}) {
  if (
    input.results.length > SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_RECORDS ||
    input.reviews.length > SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_MAX_RECORDS ||
    bytes({ results: input.results, reviews: input.reviews }) >
      SIX_SCREEN_DIAGNOSTIC_RESULT_COLLECTION_MAX_BYTES
  ) throw new Error("Stored Screen 6 result history exceeds its bounded contract.");
  const resultIds = new Set<string>();
  const occupiedIds = new Set(input.plans.flatMap((plan) => [
    plan.snapshotId,
    plan.binding.profileSnapshotId,
  ]));
  const resultInputs = new Set<string>();
  const priorResults: Screen6DiagnosticResult[] = [];
  for (const result of input.results) {
    if (resultIds.has(result.id) || occupiedIds.has(result.id)) {
      throw new Error("Stored Screen 6 diagnostic-result ids must be unique.");
    }
    const plan = input.plans.find(({ snapshotId }) =>
      snapshotId === result.binding.planSnapshotId
    );
    if (!plan) throw new Error("Stored Screen 6 diagnostic result lost its plan.");
    const inputCoordinate = fingerprintSixScreenValue({
      planSnapshotId: plan.snapshotId,
      cardId: result.binding.cardId,
      inputFingerprint: result.input.inputFingerprint,
    });
    if (resultInputs.has(inputCoordinate)) {
      throw new Error("Stored Screen 6 result inputs must be unique per card.");
    }
    validateScreen6DiagnosticResult(result, plan, priorResults);
    resultIds.add(result.id);
    occupiedIds.add(result.id);
    resultInputs.add(inputCoordinate);
    priorResults.push(result);
  }
  const reviewIds = new Set<string>();
  const priorReviews: Screen6DiagnosticResultReview[] = [];
  for (const review of input.reviews) {
    if (reviewIds.has(review.id) || occupiedIds.has(review.id)) {
      throw new Error("Stored Screen 6 diagnostic-result review ids must be unique.");
    }
    const result = input.results.find(({ id }) =>
      id === review.resultReference.resultId
    );
    if (!result) {
      throw new Error("Stored Screen 6 diagnostic-result review lost its result.");
    }
    validateScreen6DiagnosticResultReview(review, result, priorReviews);
    reviewIds.add(review.id);
    occupiedIds.add(review.id);
    priorReviews.push(review);
  }
  return input;
}

export function latestScreen6DiagnosticResultsForPlan(
  results: readonly Screen6DiagnosticResult[],
  plan: Screen6DiagnosticPlan,
) {
  const latest = new Map<string, Screen6DiagnosticResult>();
  for (const result of results) {
    if (result.binding.planSnapshotId === plan.snapshotId) {
      latest.set(result.binding.cardId, result);
    }
  }
  return plan.cards.flatMap((card) => {
    const result = latest.get(card.id);
    return result ? [result] : [];
  });
}

export function reviewsForScreen6DiagnosticResults(
  reviews: readonly Screen6DiagnosticResultReview[],
  results: readonly Screen6DiagnosticResult[],
) {
  const resultIds = new Set(results.map(({ id }) => id));
  return reviews.filter((review) =>
    resultIds.has(review.resultReference.resultId)
  );
}
