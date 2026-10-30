export const STAGE1_EVIDENCE_SCHEMA_VERSION =
  "screen02-stage1-evidence-v1" as const;
export const STAGE1_REQUEST_SCHEMA_VERSION =
  "screen02-stage1-request-v1" as const;
export const STAGE1_DRAFT_SCHEMA_VERSION =
  "screen02-stage1-draft-v1" as const;
export const STAGE1_RESULT_SCHEMA_VERSION =
  "screen02-stage1-result-v1" as const;
export const STAGE1_PROOF_KIND =
  "screen02-stage1-assessment-proof" as const;
export const STAGE1_DRAFT_TOOL =
  "submit_stage1_assessment_draft" as const;
export const STAGE1_PROOF_TIMEOUT_MS = 120_000;

export const stage1StudyFitCategories = [
  "strong",
  "mixed",
  "weak",
  "unclear",
] as const;
export const stage1OutcomePathwayCategories = [
  "plausible",
  "limited",
  "unsupported",
  "unclear",
] as const;
export const stage1MeasurementPotentialCategories = [
  "possible",
  "difficult",
  "implausible",
  "unclear",
] as const;

export type Stage1StudyFitCategory =
  (typeof stage1StudyFitCategories)[number];
export type Stage1OutcomePathwayCategory =
  (typeof stage1OutcomePathwayCategories)[number];
export type Stage1MeasurementPotentialCategory =
  (typeof stage1MeasurementPotentialCategories)[number];

export type Stage1EvidencePacket = {
  schemaVersion: typeof STAGE1_EVIDENCE_SCHEMA_VERSION;
  study: {
    population: string;
    studyGeography: string;
    industry: string;
    period: string;
    outcomeFamily: string;
    eventFamily: string;
  };
  candidate: {
    id: string;
    candidateSnapshotId: string;
    title: string;
    formalIdentifier: string;
    commonNames: string[];
    eventType: string;
    issuingAuthority: string;
    issuingJurisdiction: string;
    mainDateLead: string;
    broadApparentCoverage: string;
    apparentExposureVariables: string[];
    limitations: string[];
  };
  sources: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string;
    authority: "official-primary" | "official-metadata";
  }>;
  claims: Array<{
    id: string;
    sourceId: string;
    fact: string;
  }>;
  candidateFingerprint: string;
};

type Stage1EvidencePacketWithoutFingerprint = Omit<
  Stage1EvidencePacket,
  "candidateFingerprint"
>;

export type Stage1AssessmentRequest = {
  schemaVersion: typeof STAGE1_REQUEST_SCHEMA_VERSION;
  kind: typeof STAGE1_PROOF_KIND;
  requestId: string;
  candidateId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  requestProof: string;
  allowedEvidenceSourceIds: string[];
  requiredTool: typeof STAGE1_DRAFT_TOOL;
  preparedAt: string;
};

export type Stage1AssessmentComponent<Category extends string> = {
  category: Category;
  explanation: string;
  evidenceSourceIds: string[];
};

export type Stage1AssessmentDraft = {
  studyFit: Stage1AssessmentComponent<Stage1StudyFitCategory>;
  outcomePathway: Stage1AssessmentComponent<Stage1OutcomePathwayCategory>;
  measurementPotential: Stage1AssessmentComponent<Stage1MeasurementPotentialCategory>;
  mainConcern: string;
  nextChecks: string[];
};

export type Stage1AssessmentDraftInput = {
  schemaVersion: typeof STAGE1_DRAFT_SCHEMA_VERSION;
  requestId: string;
  candidateId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  requestProof: string;
  draft: unknown;
};

export type Stage1OverallJudgment =
  | "promising-to-verify"
  | "worth-exploring"
  | "low-priority"
  | "not-enough-evidence";

export type Stage1LifecycleEvent = {
  state:
    | "prepared"
    | "message-delivered"
    | "draft-received"
    | "validating"
    | "completed"
    | "validation-failed"
    | "timed-out";
  actor: "mcp-server" | "fixed-core" | "chatgpt-host";
  at: string;
};

export type Stage1CompletedAssessment = {
  method: "ai-preliminary";
  studyFit: Stage1AssessmentComponent<Stage1StudyFitCategory>;
  outcomePathway: Stage1AssessmentComponent<Stage1OutcomePathwayCategory>;
  measurementPotential: Stage1AssessmentComponent<Stage1MeasurementPotentialCategory>;
  mainConcern: string;
  nextChecks: string[];
  overallJudgment: Stage1OverallJudgment;
  overallJudgmentMethod: "fixed-computation";
};

export type Stage1AssessmentResult = {
  schemaVersion: typeof STAGE1_RESULT_SCHEMA_VERSION;
  kind: typeof STAGE1_PROOF_KIND;
  requestId: string;
  candidateId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  requestProof: string;
  status: "completed" | "rejected";
  lifecycle: Stage1LifecycleEvent[];
  assessment?: Stage1CompletedAssessment;
  rejectionReasons: string[];
  selectionGate: {
    eligible: boolean;
    reasons: string[];
  };
  candidateBeforeFingerprint: string;
  candidateAfterFingerprint: string;
  draftFingerprint: string;
  appliedResultFingerprint: string;
  receiptId: string;
};

export type Stage1ProofOpenResult = {
  schemaVersion: typeof STAGE1_RESULT_SCHEMA_VERSION;
  kind: typeof STAGE1_PROOF_KIND;
  phase: "prepared";
  request: Stage1AssessmentRequest;
  packet: Stage1EvidencePacket;
  lifecycle: [Stage1LifecycleEvent];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function serializeStage1Canonical(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function stage1Fingerprint(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(
    serializeStage1Canonical(value),
  )) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

const stage1PacketBase: Stage1EvidencePacketWithoutFingerprint = {
  schemaVersion: STAGE1_EVIDENCE_SCHEMA_VERSION,
  study: {
    population: "U.S. publicly listed technology firms",
    studyGeography: "United States",
    industry: "Technology",
    period: "2016–2020",
    outcomeFamily: "Innovation",
    eventFamily: "Government-imposed regulatory change",
  },
  candidate: {
    id: "registry-eu-gdpr-2018",
    candidateSnapshotId: "candidate-snapshot-gdpr-find-v1",
    title: "EU General Data Protection Regulation",
    formalIdentifier: "Regulation (EU) 2016/679",
    commonNames: ["General Data Protection Regulation", "GDPR"],
    eventType: "Regulation",
    issuingAuthority: "European Parliament and Council",
    issuingJurisdiction: "European Union",
    mainDateLead: "2018-05-25",
    broadApparentCoverage:
      "EU establishments and qualifying non-EU controllers or processors under the territorial-scope lead in Article 3.",
    apparentExposureVariables: [
      "EU establishment",
      "EU-facing goods or services",
      "Monitoring of people in the EU",
    ],
    limitations: [
      "The study population is broader than organizations demonstrably covered by the territorial-scope lead.",
      "Firm-level exposure and usable variation remain unverified until later screens.",
    ],
  },
  sources: [
    {
      id: "source-eu-gdpr-regulation-2016-679",
      title: "Regulation (EU) 2016/679, Official Journal text",
      publisher: "Official Journal of the European Union",
      url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
      authority: "official-primary",
    },
    {
      id: "source-eu-gdpr-celex-metadata",
      title: "Regulation (EU) 2016/679, EUR-Lex metadata",
      publisher: "EUR-Lex",
      url: "https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32016R0679",
      authority: "official-metadata",
    },
  ],
  claims: [
    {
      id: "claim-gdpr-application-date",
      sourceId: "source-eu-gdpr-regulation-2016-679",
      fact:
        "Article 99 states that the regulation applies from 25 May 2018.",
    },
    {
      id: "claim-gdpr-territorial-scope",
      sourceId: "source-eu-gdpr-regulation-2016-679",
      fact:
        "Article 3 provides territorial-scope leads involving EU establishments and some offering or monitoring activities directed to people in the EU.",
    },
    {
      id: "claim-gdpr-formal-identity",
      sourceId: "source-eu-gdpr-celex-metadata",
      fact:
        "EUR-Lex identifies the instrument as Regulation (EU) 2016/679 of the European Parliament and Council.",
    },
  ],
};

function deepFreezeStage1Value<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreezeStage1Value(nested);
    }
    Object.freeze(value);
  }
  return value;
}

// Clone before freezing so the exported packet shares no nested references
// with the private fingerprint basis used for before/after invariants.
const stage1PacketClone = JSON.parse(
  JSON.stringify(stage1PacketBase),
) as Stage1EvidencePacketWithoutFingerprint;
export const STAGE1_GDPR_PACKET: Stage1EvidencePacket =
  deepFreezeStage1Value({
    ...stage1PacketClone,
    candidateFingerprint: stage1Fingerprint(stage1PacketBase),
  });

function requestProofFields(
  request: Omit<Stage1AssessmentRequest, "requestProof">,
) {
  return {
    schemaVersion: request.schemaVersion,
    kind: request.kind,
    requestId: request.requestId,
    candidateId: request.candidateId,
    candidateSnapshotId: request.candidateSnapshotId,
    candidateFingerprint: request.candidateFingerprint,
    allowedEvidenceSourceIds: request.allowedEvidenceSourceIds,
    requiredTool: request.requiredTool,
  };
}

export function createStage1ProofRequest(
  preparedAt: string,
  requestId: string,
): Stage1AssessmentRequest {
  if (
    !/^stage1-proof-[A-Za-z0-9-]{8,100}$/.test(requestId) ||
    requestId.length > 120
  ) {
    throw new Error("Stage 1 proof requestId is invalid.");
  }
  if (!Number.isFinite(Date.parse(preparedAt))) {
    throw new Error("Stage 1 proof preparedAt is invalid.");
  }
  const base: Omit<Stage1AssessmentRequest, "requestProof"> = {
    schemaVersion: STAGE1_REQUEST_SCHEMA_VERSION,
    kind: STAGE1_PROOF_KIND,
    requestId,
    candidateId: STAGE1_GDPR_PACKET.candidate.id,
    candidateSnapshotId:
      STAGE1_GDPR_PACKET.candidate.candidateSnapshotId,
    candidateFingerprint: STAGE1_GDPR_PACKET.candidateFingerprint,
    allowedEvidenceSourceIds: STAGE1_GDPR_PACKET.sources.map(
      (source) => source.id,
    ),
    requiredTool: STAGE1_DRAFT_TOOL,
    preparedAt,
  };
  return {
    ...base,
    requestProof: stage1Fingerprint(requestProofFields(base)),
  };
}

export function createStage1ProofOpenResult(
  preparedAt: string,
  requestId: string,
): Stage1ProofOpenResult {
  const request = createStage1ProofRequest(preparedAt, requestId);
  return {
    schemaVersion: STAGE1_RESULT_SCHEMA_VERSION,
    kind: STAGE1_PROOF_KIND,
    phase: "prepared",
    request,
    packet: STAGE1_GDPR_PACKET,
    lifecycle: [
      {
        state: "prepared",
        actor: "mcp-server",
        at: preparedAt,
      },
    ],
  };
}

export function buildStage1ProofModelContext(
  open: Stage1ProofOpenResult,
) {
  return {
    schemaVersion: "screen02-stage1-model-context-v1",
    purpose:
      "Assess one immutable candidate for the isolated Screen 2 Stage 1 handshake proof.",
    request: open.request,
    study: open.packet.study,
    candidate: open.packet.candidate,
    claims: open.packet.claims,
    sources: open.packet.sources,
    allowedCategories: {
      studyFit: stage1StudyFitCategories,
      outcomePathway: stage1OutcomePathwayCategories,
      measurementPotential: stage1MeasurementPotentialCategories,
    },
    requiredDraftFields: [
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ],
    exclusions: [
      "Do not submit an overall score or overall judgment.",
      "Do not rewrite candidate facts, sources, dates, or populations.",
      "Do not inspect or claim realized outcomes, causal validity, exogeneity, or a completed design.",
      "Use only the allowed source IDs and leave a component unclear when the packet cannot support it.",
    ],
  };
}

export function buildStage1ProofPrompt(
  request: Stage1AssessmentRequest,
) {
  return [
    "Assess the exact ShockAudit Stage 1 candidate supplied in model context.",
    `Call ${STAGE1_DRAFT_TOOL} exactly once with schemaVersion ${STAGE1_DRAFT_SCHEMA_VERSION}, requestId ${request.requestId}, candidateId ${request.candidateId}, candidateSnapshotId ${request.candidateSnapshotId}, candidateFingerprint ${request.candidateFingerprint}, and requestProof ${request.requestProof}.`,
    "Submit only studyFit, outcomePathway, measurementPotential, mainConcern, and one or two nextChecks. Each component must contain one allowed category, a concise explanation, and only source IDs from the packet.",
    "Do not submit an overall score or judgment and do not resubmit candidate facts. A prose-only answer does not complete this proof.",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
) {
  const keys = Object.keys(value);
  return (
    keys.length === allowed.length &&
    keys.every((key) => allowed.includes(key))
  );
}

function validateNarrative(
  value: unknown,
  label: string,
  minimum = 30,
  maximum = 800,
) {
  if (typeof value !== "string") return `${label} must be text.`;
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    return `${label} must contain ${minimum}–${maximum} characters.`;
  }
  if (
    /\b(?:p[- ]?value|statistical(?:ly)? significant|effect estimate|realized outcome|proves? causality|causally valid|as-if random|exogenous assignment)\b/i.test(
      trimmed,
    )
  ) {
    return `${label} makes an outcome or causal-validity claim that Screen 2 must not make.`;
  }
  return null;
}

function validateEvidenceIds(
  value: unknown,
  label: string,
  allowedIds: Set<string>,
  allowEmpty: boolean,
) {
  if (!Array.isArray(value)) return `${label} must be an array.`;
  if (
    value.some((item) => typeof item !== "string") ||
    new Set(value).size !== value.length
  ) {
    return `${label} must contain unique source IDs.`;
  }
  if (!allowEmpty && value.length === 0) {
    return `${label} must cite at least one attached source.`;
  }
  if (!value.every((item) => allowedIds.has(String(item)))) {
    return `${label} cites a source that is not attached to this candidate.`;
  }
  return null;
}

function validateComponent<Category extends string>(
  value: unknown,
  label: string,
  categories: readonly Category[],
  allowedIds: Set<string>,
) {
  const errors: string[] = [];
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "category",
      "explanation",
      "evidenceSourceIds",
    ])
  ) {
    return {
      errors: [
        `${label} must contain only category, explanation, and evidenceSourceIds.`,
      ],
      component: null,
    };
  }
  if (!categories.includes(value.category as Category)) {
    errors.push(`${label}.category is not allowed.`);
  }
  const narrativeError = validateNarrative(
    value.explanation,
    `${label}.explanation`,
  );
  if (narrativeError) errors.push(narrativeError);
  const evidenceError = validateEvidenceIds(
    value.evidenceSourceIds,
    `${label}.evidenceSourceIds`,
    allowedIds,
    value.category === "unclear",
  );
  if (evidenceError) errors.push(evidenceError);
  if (errors.length > 0) return { errors, component: null };
  return {
    errors,
    component: {
      category: value.category as Category,
      explanation: (value.explanation as string).trim(),
      evidenceSourceIds: [...(value.evidenceSourceIds as string[])],
    },
  };
}

function deriveOverallJudgment(
  draft: Stage1AssessmentDraft,
): Stage1OverallJudgment {
  if (
    draft.studyFit.category === "unclear" ||
    draft.outcomePathway.category === "unclear" ||
    draft.measurementPotential.category === "unclear"
  ) {
    return "not-enough-evidence";
  }
  if (
    draft.studyFit.category === "strong" &&
    draft.outcomePathway.category === "plausible" &&
    draft.measurementPotential.category === "possible"
  ) {
    return "promising-to-verify";
  }
  if (
    draft.studyFit.category === "weak" ||
    draft.outcomePathway.category === "unsupported" ||
    draft.measurementPotential.category === "implausible"
  ) {
    return "low-priority";
  }
  return "worth-exploring";
}

function validateRequestIdentity(input: Stage1AssessmentDraftInput) {
  const errors: string[] = [];
  if (input.schemaVersion !== STAGE1_DRAFT_SCHEMA_VERSION) {
    errors.push("The draft schema version is not supported.");
  }
  if (!/^stage1-proof-[A-Za-z0-9-]{8,100}$/.test(input.requestId)) {
    errors.push("The request ID is invalid.");
  }
  if (input.candidateId !== STAGE1_GDPR_PACKET.candidate.id) {
    errors.push("The draft does not target the prepared candidate.");
  }
  if (
    input.candidateSnapshotId !==
    STAGE1_GDPR_PACKET.candidate.candidateSnapshotId
  ) {
    errors.push("The draft does not target the prepared candidate snapshot.");
  }
  if (
    input.candidateFingerprint !==
    STAGE1_GDPR_PACKET.candidateFingerprint
  ) {
    errors.push("The immutable candidate fingerprint does not match.");
  }
  let reconstructed: Stage1AssessmentRequest | null = null;
  try {
    reconstructed = createStage1ProofRequest(
      "1970-01-01T00:00:00.000Z",
      input.requestId,
    );
  } catch {
    // The request-id error above is the user-facing reason.
  }
  if (
    typeof input.requestProof !== "string" ||
    !/^fnv1a64:[0-9a-f]{16}$/.test(input.requestProof) ||
    !reconstructed ||
    input.requestProof !== reconstructed.requestProof
  ) {
    errors.push("The request proof is malformed or does not match the request.");
  }
  return errors;
}

/**
 * Validate and deterministically apply one model-generated draft. The
 * immutable packet is reconstructed from code; the model cannot resubmit or
 * change factual candidate fields.
 */
export function evaluateStage1AssessmentDraft(
  input: Stage1AssessmentDraftInput,
  observedAt: string,
): Stage1AssessmentResult {
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("Stage 1 proof observedAt is invalid.");
  }
  const errors = validateRequestIdentity(input);
  const allowedIds = new Set(
    STAGE1_GDPR_PACKET.sources.map((source) => source.id),
  );
  let draft: Stage1AssessmentDraft | null = null;
  if (
    !isRecord(input.draft) ||
    !exactKeys(input.draft, [
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ])
  ) {
    errors.push(
      "The draft must contain only studyFit, outcomePathway, measurementPotential, mainConcern, and nextChecks.",
    );
  } else {
    const studyFit = validateComponent(
      input.draft.studyFit,
      "studyFit",
      stage1StudyFitCategories,
      allowedIds,
    );
    const outcomePathway = validateComponent(
      input.draft.outcomePathway,
      "outcomePathway",
      stage1OutcomePathwayCategories,
      allowedIds,
    );
    const measurementPotential = validateComponent(
      input.draft.measurementPotential,
      "measurementPotential",
      stage1MeasurementPotentialCategories,
      allowedIds,
    );
    errors.push(
      ...studyFit.errors,
      ...outcomePathway.errors,
      ...measurementPotential.errors,
    );
    const concernError = validateNarrative(
      input.draft.mainConcern,
      "mainConcern",
    );
    if (concernError) errors.push(concernError);
    if (
      !Array.isArray(input.draft.nextChecks) ||
      input.draft.nextChecks.length < 1 ||
      input.draft.nextChecks.length > 2 ||
      input.draft.nextChecks.some((item) => typeof item !== "string") ||
      new Set(input.draft.nextChecks).size !== input.draft.nextChecks.length
    ) {
      errors.push("nextChecks must contain one or two distinct text items.");
    } else {
      for (const [index, check] of input.draft.nextChecks.entries()) {
        const checkError = validateNarrative(
          check,
          `nextChecks[${index}]`,
          20,
          500,
        );
        if (checkError) errors.push(checkError);
      }
    }
    if (
      errors.length === 0 &&
      studyFit.component &&
      outcomePathway.component &&
      measurementPotential.component
    ) {
      draft = {
        studyFit: studyFit.component,
        outcomePathway: outcomePathway.component,
        measurementPotential: measurementPotential.component,
        mainConcern: (input.draft.mainConcern as string).trim(),
        nextChecks: (input.draft.nextChecks as string[]).map((item) =>
          item.trim(),
        ),
      };
    }
  }

  const draftFingerprint = stage1Fingerprint(input.draft);
  const candidateBeforeFingerprint = stage1Fingerprint(
    stage1PacketBase,
  );
  const candidateAfterFingerprint = stage1Fingerprint(
    stage1PacketBase,
  );
  const assessment: Stage1CompletedAssessment | undefined = draft
    ? {
        method: "ai-preliminary",
        ...draft,
        overallJudgment: deriveOverallJudgment(draft),
        overallJudgmentMethod: "fixed-computation",
      }
    : undefined;
  const status = assessment ? "completed" : "rejected";
  const selectionGate = assessment
    ? {
        eligible: true,
        reasons: [
          "The candidate snapshot is active and unchanged.",
          "All three assessment components passed fixed validation.",
          "The isolated proof contains no optional strict criteria.",
          "Choosing would remain tentative and would not verify treatment, exposure, or causal validity.",
        ],
      }
    : {
        eligible: false,
        reasons: [
          "A valid matching model draft has not completed fixed validation.",
        ],
      };
  const resultBasis = {
    schemaVersion: STAGE1_RESULT_SCHEMA_VERSION,
    requestId: input.requestId,
    candidateId: input.candidateId,
    candidateSnapshotId: input.candidateSnapshotId,
    candidateFingerprint: input.candidateFingerprint,
    requestProof: input.requestProof,
    status,
    assessment,
    rejectionReasons: [...errors],
    selectionGate,
    candidateBeforeFingerprint,
    candidateAfterFingerprint,
    draftFingerprint,
  };
  const appliedResultFingerprint = stage1Fingerprint(resultBasis);
  const receiptId = `stage1-receipt-${stage1Fingerprint({
    requestId: input.requestId,
    appliedResultFingerprint,
  }).slice("fnv1a64:".length)}`;
  return {
    schemaVersion: STAGE1_RESULT_SCHEMA_VERSION,
    kind: STAGE1_PROOF_KIND,
    requestId: input.requestId,
    candidateId: input.candidateId,
    candidateSnapshotId: input.candidateSnapshotId,
    candidateFingerprint: input.candidateFingerprint,
    requestProof: input.requestProof,
    status,
    lifecycle: [
      {
        state: "draft-received",
        actor: "mcp-server",
        at: observedAt,
      },
      {
        state: "validating",
        actor: "fixed-core",
        at: observedAt,
      },
      {
        state: status === "completed" ? "completed" : "validation-failed",
        actor: "fixed-core",
        at: observedAt,
      },
    ],
    assessment,
    rejectionReasons: [...errors],
    selectionGate,
    candidateBeforeFingerprint,
    candidateAfterFingerprint,
    draftFingerprint,
    appliedResultFingerprint,
    receiptId,
  };
}

export function isStage1ProofOpenResult(
  value: unknown,
): value is Stage1ProofOpenResult {
  if (!isRecord(value)) return false;
  if (
    !exactKeys(value, [
      "schemaVersion",
      "kind",
      "phase",
      "request",
      "packet",
      "lifecycle",
    ]) ||
    value.schemaVersion !== STAGE1_RESULT_SCHEMA_VERSION ||
    value.kind !== STAGE1_PROOF_KIND ||
    value.phase !== "prepared" ||
    !isRecord(value.request) ||
    !isRecord(value.packet) ||
    !Array.isArray(value.lifecycle) ||
    value.lifecycle.length !== 1
  ) {
    return false;
  }
  const request = value.request;
  if (
    typeof request.requestId !== "string" ||
    typeof request.preparedAt !== "string"
  ) {
    return false;
  }
  let expectedRequest: Stage1AssessmentRequest;
  try {
    expectedRequest = createStage1ProofRequest(
      request.preparedAt,
      request.requestId,
    );
  } catch {
    return false;
  }
  const lifecycle = value.lifecycle[0];
  return (
    serializeStage1Canonical(request) ===
      serializeStage1Canonical(expectedRequest) &&
    serializeStage1Canonical(value.packet) ===
      serializeStage1Canonical(STAGE1_GDPR_PACKET) &&
    isRecord(lifecycle) &&
    exactKeys(lifecycle, ["state", "actor", "at"]) &&
    lifecycle.state === "prepared" &&
    lifecycle.actor === "mcp-server" &&
    lifecycle.at === request.preparedAt
  );
}

export function isStage1AssessmentResult(
  value: unknown,
): value is Stage1AssessmentResult {
  if (!isRecord(value)) return false;
  const allowedResultKeys = [
    "schemaVersion",
    "kind",
    "requestId",
    "candidateId",
    "candidateSnapshotId",
    "candidateFingerprint",
    "requestProof",
    "status",
    "lifecycle",
    "assessment",
    "rejectionReasons",
    "selectionGate",
    "candidateBeforeFingerprint",
    "candidateAfterFingerprint",
    "draftFingerprint",
    "appliedResultFingerprint",
    "receiptId",
  ] as const;
  const requiredResultKeys = allowedResultKeys.filter(
    (key) => key !== "assessment",
  );
  if (
    Object.keys(value).some(
      (key) => !(allowedResultKeys as readonly string[]).includes(key),
    ) ||
    requiredResultKeys.some((key) => !(key in value)) ||
    value.schemaVersion !== STAGE1_RESULT_SCHEMA_VERSION ||
    value.kind !== STAGE1_PROOF_KIND ||
    (value.status !== "completed" && value.status !== "rejected") ||
    typeof value.requestId !== "string" ||
    typeof value.candidateId !== "string" ||
    typeof value.candidateSnapshotId !== "string" ||
    typeof value.candidateFingerprint !== "string" ||
    typeof value.requestProof !== "string" ||
    !Array.isArray(value.lifecycle) ||
    value.lifecycle.length !== 3 ||
    !Array.isArray(value.rejectionReasons) ||
    value.rejectionReasons.some((reason) => typeof reason !== "string") ||
    !isRecord(value.selectionGate) ||
    !exactKeys(value.selectionGate, ["eligible", "reasons"]) ||
    typeof value.selectionGate.eligible !== "boolean" ||
    !Array.isArray(value.selectionGate.reasons) ||
    value.selectionGate.reasons.some(
      (reason) => typeof reason !== "string",
    ) ||
    typeof value.candidateBeforeFingerprint !== "string" ||
    typeof value.candidateAfterFingerprint !== "string" ||
    typeof value.draftFingerprint !== "string" ||
    typeof value.appliedResultFingerprint !== "string" ||
    typeof value.receiptId !== "string"
  ) {
    return false;
  }

  let expectedRequest: Stage1AssessmentRequest;
  try {
    expectedRequest = createStage1ProofRequest(
      "1970-01-01T00:00:00.000Z",
      value.requestId,
    );
  } catch {
    return false;
  }
  if (
    value.candidateId !== expectedRequest.candidateId ||
    value.candidateSnapshotId !== expectedRequest.candidateSnapshotId ||
    value.candidateFingerprint !== expectedRequest.candidateFingerprint ||
    value.requestProof !== expectedRequest.requestProof
  ) {
    return false;
  }

  const expectedLifecycle = [
    ["draft-received", "mcp-server"],
    ["validating", "fixed-core"],
    [
      value.status === "completed" ? "completed" : "validation-failed",
      "fixed-core",
    ],
  ] as const;
  if (
    value.lifecycle.some((event, index) => {
      if (
        !isRecord(event) ||
        !exactKeys(event, ["state", "actor", "at"]) ||
        typeof event.at !== "string" ||
        !Number.isFinite(Date.parse(event.at))
      ) {
        return true;
      }
      return (
        event.state !== expectedLifecycle[index]![0] ||
        event.actor !== expectedLifecycle[index]![1]
      );
    })
  ) {
    return false;
  }

  const allowedIds = new Set(
    STAGE1_GDPR_PACKET.sources.map((source) => source.id),
  );
  let assessment: Stage1CompletedAssessment | undefined;
  if (value.status === "completed") {
    if (
      !isRecord(value.assessment) ||
      !exactKeys(value.assessment, [
        "method",
        "studyFit",
        "outcomePathway",
        "measurementPotential",
        "mainConcern",
        "nextChecks",
        "overallJudgment",
        "overallJudgmentMethod",
      ]) ||
      value.assessment.method !== "ai-preliminary" ||
      value.assessment.overallJudgmentMethod !== "fixed-computation" ||
      value.rejectionReasons.length !== 0 ||
      value.selectionGate.eligible !== true
    ) {
      return false;
    }
    const studyFit = validateComponent(
      value.assessment.studyFit,
      "studyFit",
      stage1StudyFitCategories,
      allowedIds,
    );
    const outcomePathway = validateComponent(
      value.assessment.outcomePathway,
      "outcomePathway",
      stage1OutcomePathwayCategories,
      allowedIds,
    );
    const measurementPotential = validateComponent(
      value.assessment.measurementPotential,
      "measurementPotential",
      stage1MeasurementPotentialCategories,
      allowedIds,
    );
    if (
      studyFit.errors.length > 0 ||
      outcomePathway.errors.length > 0 ||
      measurementPotential.errors.length > 0 ||
      !studyFit.component ||
      !outcomePathway.component ||
      !measurementPotential.component ||
      validateNarrative(value.assessment.mainConcern, "mainConcern") ||
      !Array.isArray(value.assessment.nextChecks) ||
      value.assessment.nextChecks.length < 1 ||
      value.assessment.nextChecks.length > 2 ||
      value.assessment.nextChecks.some(
        (check) =>
          typeof check !== "string" ||
          Boolean(validateNarrative(check, "nextCheck", 20, 500)),
      ) ||
      new Set(value.assessment.nextChecks).size !==
        value.assessment.nextChecks.length
    ) {
      return false;
    }
    assessment = {
      method: "ai-preliminary",
      studyFit: studyFit.component,
      outcomePathway: outcomePathway.component,
      measurementPotential: measurementPotential.component,
      mainConcern: (value.assessment.mainConcern as string).trim(),
      nextChecks: (value.assessment.nextChecks as string[]).map((check) =>
        check.trim(),
      ),
      overallJudgment: value.assessment
        .overallJudgment as Stage1OverallJudgment,
      overallJudgmentMethod: "fixed-computation",
    };
    if (
      assessment.overallJudgment !== deriveOverallJudgment(assessment)
    ) {
      return false;
    }
  } else if (
    value.assessment !== undefined ||
    value.rejectionReasons.length === 0 ||
    value.selectionGate.eligible !== false
  ) {
    return false;
  }

  const expectedCandidateFingerprint = stage1Fingerprint(stage1PacketBase);
  if (
    value.candidateBeforeFingerprint !== expectedCandidateFingerprint ||
    value.candidateAfterFingerprint !== expectedCandidateFingerprint ||
    !/^fnv1a64:[0-9a-f]{16}$/.test(value.draftFingerprint)
  ) {
    return false;
  }
  const resultBasis = {
    schemaVersion: STAGE1_RESULT_SCHEMA_VERSION,
    requestId: value.requestId,
    candidateId: value.candidateId,
    candidateSnapshotId: value.candidateSnapshotId,
    candidateFingerprint: value.candidateFingerprint,
    requestProof: value.requestProof,
    status: value.status,
    assessment,
    rejectionReasons: value.rejectionReasons,
    selectionGate: value.selectionGate,
    candidateBeforeFingerprint: value.candidateBeforeFingerprint,
    candidateAfterFingerprint: value.candidateAfterFingerprint,
    draftFingerprint: value.draftFingerprint,
  };
  const appliedResultFingerprint = stage1Fingerprint(resultBasis);
  const receiptId = `stage1-receipt-${stage1Fingerprint({
    requestId: value.requestId,
    appliedResultFingerprint,
  }).slice("fnv1a64:".length)}`;
  return (
    value.appliedResultFingerprint === appliedResultFingerprint &&
    value.receiptId === receiptId
  );
}
