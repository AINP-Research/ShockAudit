import { useState, type FormEvent } from "react";

import type { StudyContext } from "../../core/six-screen/contracts";
import type {
  MechanismLiteraturePlanInput,
  MechanismSuppliedWorkInput,
} from "../../core/six-screen/mechanism-literature-plan";
import type {
  ScholarlyDocumentAccessBasis,
  ScholarlyDocumentInspectionInput,
  ScholarlyDocumentInspectionMode,
  ScholarlyPassagePurpose,
} from "../../core/six-screen/mechanism-scholarly-document";
import type {
  ScholarlyClaimFields,
  ScholarlyClaimFieldsDraft,
  ScholarlyClaimReviewDecision,
  ScholarlyContextualFitAssessment,
  ScholarlyEvidenceLevel,
} from "../../core/six-screen/mechanism-scholarly-claim-review";
import type {
  MechanismCardDraft,
  MechanismClaimReference,
  MechanismReviewDraft,
  PredictionRowDraft,
} from "../../core/six-screen/mechanism-review";
import type { MechanismLiteratureWorkspace } from
  "../../worker/six-screen-workflow-runtime";

type Draft = {
  explanationMode: "stated" | "undecided";
  explanation: string;
  suppliedWorks: string;
  preferredConstructs: string;
  feasibleDataSources: string;
  knownAlternativeAccounts: string;
};

type InspectionDraft = {
  targetId: string;
  exactDocumentUrl: string;
  accessBasis: ScholarlyDocumentAccessBasis;
  inspectionMode: ScholarlyDocumentInspectionMode;
  exactPassage: string;
  passagePurpose: ScholarlyPassagePurpose;
  qualification: string;
};

type ClaimFieldsDraft = {
  theoreticalProposition: string;
  empiricalSetting: string;
  levelOfAnalysis: string;
  measuredVariables: string;
  relevantResultOrQualification: string;
  contextualFitAssessment: ScholarlyContextualFitAssessment;
  contextualFitRationale: string;
  evidenceLevel: ScholarlyEvidenceLevel;
};

type ClaimDraft = ClaimFieldsDraft & { passageId: string };

type ClaimReviewDraft = {
  extractionId: string;
  decision: ScholarlyClaimReviewDecision["mode"];
  rationale: string;
  correction: ClaimFieldsDraft;
};

function emptyMechanism(id: string): MechanismCardDraft {
  return {
    id,
    label: "",
    role: id === "mechanism-1" ? "focal" : "rival",
    decision: "retained",
    causalSequence: [],
    theoreticalAnchor: "",
    policyConnection: "",
    contextualFit: "",
    uncertainty: "",
    evidenceLevel: "researcher_hypothesis",
    acceptedClaimReferences: [],
    researcherRationale: "",
  };
}

function emptyPrediction(
  id: string,
  mechanismIds: readonly string[],
): PredictionRowDraft {
  return {
    id,
    observation: "",
    feasibleMeasure: "",
    timing: "",
    dataSource: "",
    feasibility: "feasible_with_additional_data",
    priority: "medium",
    assumptions: [],
    patterns: mechanismIds.map((mechanismId) => ({
      mechanismId,
      direction: "ambiguous",
      detail: "",
    })),
  };
}

function initialMechanismReview(
  workspace: MechanismLiteratureWorkspace,
): MechanismReviewDraft {
  if (workspace.mechanismReview && workspace.predictionMatrix) {
    return {
      intendedClaim: workspace.mechanismReview.intendedClaim,
      focalMechanismId: workspace.mechanismReview.focalMechanismId,
      mechanisms: structuredClone(workspace.mechanismReview.mechanisms),
      predictions: structuredClone(workspace.predictionMatrix.rows),
      overallRationale: workspace.mechanismReview.overallRationale,
    };
  }
  const mechanisms = [emptyMechanism("mechanism-1"), emptyMechanism("mechanism-2")];
  return {
    intendedClaim: "compare_mechanisms_without_identification",
    focalMechanismId: null,
    mechanisms,
    predictions: [emptyPrediction(
      "prediction-1",
      mechanisms.map(({ id }) => id),
    )],
    overallRationale: "",
  };
}

function lines(value: string) {
  return [...new Set(value.split("\n").map((item) => item.trim()).filter(
    Boolean,
  ))];
}

function suppliedWork(value: string, index: number): MechanismSuppliedWorkInput {
  const kind = /^10\.\d{4,9}\/[\S]+$/iu.test(value)
    ? "doi" as const
    : /^(?:https:\/\/openalex\.org\/)?W\d+$/u.test(value)
      ? "openalex_id" as const
      : /^https:\/\//iu.test(value)
        ? "url" as const
        : "citation" as const;
  return {
    id: `researcher-work-${index + 1}`,
    kind,
    value,
  };
}

function draftFrom(
  workspace: MechanismLiteratureWorkspace,
  study: StudyContext,
): Draft {
  const input = workspace.plan?.input;
  const stated = input?.explanation.mode === "stated"
    ? input.explanation.text
    : study.initialExplanation;
  return {
    explanationMode: stated ? "stated" : "undecided",
    explanation: stated ?? "",
    suppliedWorks: input?.suppliedWorks.map(({ value }) => value).join("\n") ??
      "",
    preferredConstructs: input?.preferredConstructs.join("\n") ?? "",
    feasibleDataSources: input?.feasibleDataSources.join("\n") ?? "",
    knownAlternativeAccounts:
      input?.knownAlternativeAccounts.join("\n") ?? "",
  };
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function emptyClaimFields(): ClaimFieldsDraft {
  return {
    theoreticalProposition: "",
    empiricalSetting: "",
    levelOfAnalysis: "",
    measuredVariables: "",
    relevantResultOrQualification: "",
    contextualFitAssessment: "uncertain",
    contextualFitRationale: "",
    evidenceLevel: "established_theoretical_argument",
  };
}

function draftFromClaimFields(fields: ScholarlyClaimFields): ClaimFieldsDraft {
  return {
    theoreticalProposition: fields.theoreticalProposition ?? "",
    empiricalSetting: fields.empiricalSetting ?? "",
    levelOfAnalysis: fields.levelOfAnalysis ?? "",
    measuredVariables: fields.measuredVariables.join("\n"),
    relevantResultOrQualification:
      fields.relevantResultOrQualification ?? "",
    contextualFitAssessment: fields.contextualFit.assessment,
    contextualFitRationale: fields.contextualFit.rationale,
    evidenceLevel: fields.evidenceLevel,
  };
}

function claimFieldsFromDraft(draft: ClaimFieldsDraft): ScholarlyClaimFieldsDraft {
  const optional = (value: string) => value.trim() || null;
  return {
    theoreticalProposition: optional(draft.theoreticalProposition),
    empiricalSetting: optional(draft.empiricalSetting),
    levelOfAnalysis: optional(draft.levelOfAnalysis),
    measuredVariables: lines(draft.measuredVariables),
    relevantResultOrQualification:
      optional(draft.relevantResultOrQualification),
    contextualFit: {
      assessment: draft.contextualFitAssessment,
      rationale: draft.contextualFitRationale.trim(),
    },
    evidenceLevel: draft.evidenceLevel,
  };
}

function ClaimFieldsEditor(props: {
  prefix: string;
  value: ClaimFieldsDraft;
  disabled: boolean;
  onChange: (value: ClaimFieldsDraft) => void;
}) {
  function update<K extends keyof ClaimFieldsDraft>(
    key: K,
    value: ClaimFieldsDraft[K],
  ) {
    props.onChange({ ...props.value, [key]: value });
  }
  return (
    <div className="six-scholarly-claim-fields">
      <label className="six-field">
        <span>Theoretical proposition</span>
        <textarea
          value={props.value.theoreticalProposition}
          maxLength={4_000}
          disabled={props.disabled}
          placeholder="Record the proposition stated or supported by this exact passage"
          onChange={(event) => update(
            "theoreticalProposition",
            event.target.value,
          )}
        />
      </label>
      <div className="six-grid">
        <label className="six-field">
          <span>Empirical setting</span>
          <textarea
            value={props.value.empiricalSetting}
            maxLength={2_000}
            disabled={props.disabled}
            onChange={(event) => update("empiricalSetting", event.target.value)}
          />
        </label>
        <label className="six-field">
          <span>Level of analysis</span>
          <input
            value={props.value.levelOfAnalysis}
            maxLength={1_000}
            disabled={props.disabled}
            onChange={(event) => update("levelOfAnalysis", event.target.value)}
          />
        </label>
        <label className="six-field">
          <span>Measured variables</span>
          <textarea
            value={props.value.measuredVariables}
            maxLength={12_000}
            disabled={props.disabled}
            placeholder="One measured variable per line"
            onChange={(event) => update(
              "measuredVariables",
              event.target.value,
            )}
          />
        </label>
      </div>
      <label className="six-field">
        <span>Relevant result or qualification</span>
        <textarea
          value={props.value.relevantResultOrQualification}
          maxLength={4_000}
          disabled={props.disabled}
          onChange={(event) => update(
            "relevantResultOrQualification",
            event.target.value,
          )}
        />
      </label>
      <div className="six-grid">
        <label className="six-field">
          <span>Contextual fit</span>
          <select
            value={props.value.contextualFitAssessment}
            disabled={props.disabled}
            onChange={(event) => update(
              "contextualFitAssessment",
              event.target.value as ScholarlyContextualFitAssessment,
            )}
          >
            <option value="focal_setting">Focal setting</option>
            <option value="adjacent_setting">Adjacent setting</option>
            <option value="different_setting">Different setting</option>
            <option value="theory_only">Theory only</option>
            <option value="uncertain">Uncertain</option>
          </select>
        </label>
        <label className="six-field">
          <span>Evidence level</span>
          <select
            value={props.value.evidenceLevel}
            disabled={props.disabled}
            onChange={(event) => update(
              "evidenceLevel",
              event.target.value as ScholarlyEvidenceLevel,
            )}
          >
            <option value="established_theoretical_argument">
              Established theoretical argument
            </option>
            <option value="empirical_evidence_different_setting">
              Empirical evidence — different setting
            </option>
            <option value="empirical_evidence_focal_setting">
              Empirical evidence — focal setting
            </option>
            <option value="agency_or_stakeholder_expectation">
              Agency or stakeholder expectation
            </option>
          </select>
        </label>
      </div>
      <label className="six-field">
        <span>Contextual-fit rationale</span>
        <textarea
          id={`${props.prefix}-contextual-fit-rationale`}
          required
          value={props.value.contextualFitRationale}
          maxLength={2_000}
          disabled={props.disabled}
          placeholder="Explain how this source context fits—or differs from—the focal study"
          onChange={(event) => update(
            "contextualFitRationale",
            event.target.value,
          )}
        />
      </label>
    </div>
  );
}

export function MechanismLiteraturePlanPanel(props: {
  workspace: MechanismLiteratureWorkspace;
  study: StudyContext;
  disabled: boolean;
  canContinue: boolean;
  canInspect: boolean;
  canExtractClaim: boolean;
  canReviewClaim: boolean;
  canPrepareSynthesisInput: boolean;
  canSaveMechanismReview: boolean;
  onSave: (input: Omit<
    MechanismLiteraturePlanInput,
    "schemaVersion" | "inputFingerprint"
  >) => Promise<void>;
  onContinue: () => Promise<void>;
  onInspect: (input: Omit<
    ScholarlyDocumentInspectionInput,
    "schemaVersion" | "inputFingerprint"
  >) => Promise<void>;
  onExtractClaim: (input: {
    passageId: string;
    expectedPassageFingerprint: string;
    fields: ScholarlyClaimFieldsDraft;
  }) => Promise<void>;
  onReviewClaim: (input: {
    extractionId: string;
    expectedExtractionFingerprint: string;
    decision: ScholarlyClaimReviewDecision;
    rationale: string;
  }) => Promise<void>;
  onPrepareSynthesisInput: (
    expectedClaimPacketFingerprint: string,
  ) => Promise<void>;
  onSaveMechanismReview: (input: {
    expectedSynthesisInputFingerprint: string;
    draft: MechanismReviewDraft;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() =>
    draftFrom(props.workspace, props.study));
  const [inspection, setInspection] = useState<InspectionDraft>(() => {
    const first = props.workspace.documentTargets[0];
    return {
      targetId: first?.id ?? "",
      exactDocumentUrl: first?.routeRequirement === "exact_url_available"
        ? first.retainedLocator ?? ""
        : "",
      accessBasis: "not_confirmed",
      inspectionMode: "partial_text",
      exactPassage: "",
      passagePurpose: "theoretical_proposition",
      qualification: "",
    };
  });
  const eligibleAcquisitions = props.workspace.documentAcquisitions.filter(
    (acquisition) => acquisition.passage?.detailedClaimUse ===
      "eligible_for_later_researcher_review",
  );
  const latestReviewByExtraction = new Map(
    props.workspace.claimReviews.map((review) => [
      review.extractionReference.extractionId,
      review,
    ]),
  );
  const reviewableExtractions = props.workspace.claimExtractions.filter(
    (extraction) => {
      const review = latestReviewByExtraction.get(extraction.id);
      return !review || review.decision === "deferred";
    },
  );
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(() => ({
    passageId: eligibleAcquisitions[0]?.passage?.id ?? "",
    ...emptyClaimFields(),
  }));
  const [claimReview, setClaimReview] = useState<ClaimReviewDraft>(() => ({
    extractionId: reviewableExtractions[0]?.id ?? "",
    decision: "accepted",
    rationale: "",
    correction: reviewableExtractions[0]
      ? draftFromClaimFields(reviewableExtractions[0].fields)
      : emptyClaimFields(),
  }));
  const [mechanismReview, setMechanismReview] = useState<MechanismReviewDraft>(
    () => initialMechanismReview(props.workspace),
  );
  const plan = props.workspace.plan;
  const execution = props.workspace.execution;
  const retainedInspectionModes = props.workspace.documentAcquisitions.flatMap(
    ({ document }) => document ? [document.inspectionStatus] : [],
  );
  const scholarlyTextStatus = retainedInspectionModes.includes("partial_text")
    ? retainedInspectionModes.includes("abstract_only")
      ? "partial text and abstract inspected"
      : "partial text inspected"
    : retainedInspectionModes.includes("abstract_only")
      ? "abstract only"
      : "not inspected";
  const testedMetadataProvider = plan?.providerCapabilities.some((provider) =>
    ["openalex", "crossref"].includes(provider.id) &&
    provider.searchRecords && provider.tested && provider.enabled &&
    provider.status === "healthy");
  const claimHasContent = Boolean(
    claimDraft.theoreticalProposition.trim() ||
    claimDraft.empiricalSetting.trim() || claimDraft.levelOfAnalysis.trim() ||
    claimDraft.measuredVariables.trim() ||
    claimDraft.relevantResultOrQualification.trim(),
  );

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateInspection<K extends keyof InspectionDraft>(
    key: K,
    value: InspectionDraft[K],
  ) {
    setInspection((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const works = lines(draft.suppliedWorks).map(suppliedWork);
    await props.onSave({
      explanation: draft.explanationMode === "stated"
        ? { mode: "stated", text: draft.explanation.trim() }
        : { mode: "undecided", text: null },
      suppliedWorks: works,
      preferredConstructs: lines(draft.preferredConstructs),
      feasibleDataSources: lines(draft.feasibleDataSources),
      knownAlternativeAccounts: lines(draft.knownAlternativeAccounts),
    });
  }

  async function submitInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetId = inspection.targetId ||
      props.workspace.documentTargets[0]?.id;
    if (!targetId) return;
    await props.onInspect({
      targetId,
      exactDocumentUrl: inspection.exactDocumentUrl.trim() || null,
      accessBasis: inspection.accessBasis,
      inspectionMode: inspection.inspectionMode,
      exactPassage: inspection.exactPassage.trim() || null,
      passagePurpose: inspection.passagePurpose,
      qualification: inspection.qualification.trim() || null,
    });
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passageId = claimDraft.passageId ||
      eligibleAcquisitions[0]?.passage?.id;
    const acquisition = eligibleAcquisitions.find(({ passage }) =>
      passage?.id === passageId
    );
    if (!passageId || !acquisition?.passage) return;
    await props.onExtractClaim({
      passageId,
      expectedPassageFingerprint:
        acquisition.passage.passageFingerprint,
      fields: claimFieldsFromDraft(claimDraft),
    });
  }

  async function submitClaimReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const extractionId = claimReview.extractionId ||
      reviewableExtractions[0]?.id;
    const extraction = reviewableExtractions.find(({ id }) =>
      id === extractionId
    );
    if (!extractionId || !extraction) return;
    const decision: ScholarlyClaimReviewDecision =
      claimReview.decision === "corrected"
        ? {
            mode: "corrected",
            correction: claimFieldsFromDraft(claimReview.correction),
          }
        : { mode: claimReview.decision };
    await props.onReviewClaim({
      extractionId,
      expectedExtractionFingerprint: extraction.extractionFingerprint,
      decision,
      rationale: claimReview.rationale.trim(),
    });
  }

  function nextId(prefix: "mechanism" | "prediction", ids: string[]) {
    let ordinal = ids.length + 1;
    while (ids.includes(`${prefix}-${ordinal}`)) ordinal += 1;
    return `${prefix}-${ordinal}`;
  }

  function addMechanism() {
    setMechanismReview((current) => {
      if (current.mechanisms.length >= 4) return current;
      const id = nextId("mechanism", current.mechanisms.map((item) => item.id));
      return {
        ...current,
        mechanisms: [...current.mechanisms, emptyMechanism(id)],
        predictions: current.predictions.map((prediction) => ({
          ...prediction,
          patterns: [...prediction.patterns, {
            mechanismId: id,
            direction: "ambiguous" as const,
            detail: "",
          }],
        })),
      };
    });
  }

  function removeMechanism(id: string) {
    setMechanismReview((current) => {
      if (current.mechanisms.length <= 1) return current;
      return {
        ...current,
        focalMechanismId: current.focalMechanismId === id
          ? null
          : current.focalMechanismId,
        mechanisms: current.mechanisms.filter((item) => item.id !== id),
        predictions: current.predictions.map((prediction) => ({
          ...prediction,
          patterns: prediction.patterns.filter(({ mechanismId }) =>
            mechanismId !== id),
        })),
      };
    });
  }

  function updateMechanism(
    id: string,
    update: (value: MechanismCardDraft) => MechanismCardDraft,
  ) {
    setMechanismReview((current) => ({
      ...current,
      mechanisms: current.mechanisms.map((item) =>
        item.id === id ? update(item) : item),
    }));
  }

  function addPrediction() {
    setMechanismReview((current) => {
      if (current.predictions.length >= 12) return current;
      const id = nextId(
        "prediction",
        current.predictions.map((item) => item.id),
      );
      return {
        ...current,
        predictions: [...current.predictions, emptyPrediction(
          id,
          current.mechanisms.map(({ id: mechanismId }) => mechanismId),
        )],
      };
    });
  }

  function updatePrediction(
    id: string,
    update: (value: PredictionRowDraft) => PredictionRowDraft,
  ) {
    setMechanismReview((current) => ({
      ...current,
      predictions: current.predictions.map((item) =>
        item.id === id ? update(item) : item),
    }));
  }

  function claimReferenceKey(reference: MechanismClaimReference) {
    return `${reference.extractionId}:${reference.reviewId}`;
  }

  function acceptedClaimReference(index: number): MechanismClaimReference {
    const claim = props.workspace.synthesisInputPacket!
      .acceptedScholarlyClaims[index]!;
    return {
      extractionId: claim.extractionReference.extractionId,
      extractionFingerprint: claim.extractionReference.extractionFingerprint,
      reviewId: claim.reviewReference.reviewId,
      reviewFingerprint: claim.reviewReference.reviewFingerprint,
    };
  }

  async function submitMechanismReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const packet = props.workspace.synthesisInputPacket;
    if (!packet) return;
    const activeIds = new Set(mechanismReview.mechanisms.filter(
      ({ decision }) => decision !== "rejected",
    ).map(({ id }) => id));
    const draft: MechanismReviewDraft = {
      ...mechanismReview,
      focalMechanismId: mechanismReview.focalMechanismId &&
          mechanismReview.mechanisms.find(({ id }) =>
            id === mechanismReview.focalMechanismId)?.decision === "retained"
        ? mechanismReview.focalMechanismId
        : null,
      predictions: mechanismReview.predictions.map((prediction) => ({
        ...prediction,
        patterns: prediction.patterns.filter(({ mechanismId }) =>
          activeIds.has(mechanismId)),
      })),
    };
    await props.onSaveMechanismReview({
      expectedSynthesisInputFingerprint: packet.packetFingerprint,
      draft,
    });
  }

  return (
    <>
      <section className="six-card six-mechanism-plan">
        <p className="six-kicker">
          {plan ? "Saved literature plan" : "Screen 5 documentary start"}
        </p>
        <h2>
          {plan
            ? `Literature plan for ${plan.policy.officialTitle}`
            : "Define the mechanism question before searching"}
        </h2>
        <p>
          This step records your initial explanation or an explicit undecided
          state, then saves three distinct literature-search branches. It does
          not generate theory cards or imply that a search has run.
        </p>

        {plan ? (
          <>
            <dl className="six-review-facts">
              <div>
                <dt>Initial position</dt>
                <dd>{readable(plan.input.explanation.mode)}</dd>
              </div>
              <div>
                <dt>Results inspected before alternatives</dt>
                <dd>{readable(plan.study.resultsPreviouslyInspected)}</dd>
              </div>
              <div>
                <dt>Reviewed policy premises</dt>
                <dd>{plan.policyPremises.length}</dd>
              </div>
              <div>
                <dt>Researcher-supplied works</dt>
                <dd>{readable(plan.evidenceStatus.suppliedWorks)}</dd>
              </div>
              <div>
                <dt>Scholarly metadata</dt>
                <dd>{readable(
                  execution?.evidenceStatus.scholarlyMetadata ??
                    plan.evidenceStatus.scholarlyMetadata,
                )}</dd>
              </div>
              <div>
                <dt>Scholarly text inspection</dt>
                <dd>{scholarlyTextStatus}</dd>
              </div>
            </dl>

            <ol className="six-mechanism-branches">
              {plan.rows.map((row) => (
                <li key={row.id}>
                  <div>
                    <div className="six-mechanism-branch-heading">
                      <span>{readable(row.branch)}</span>
                      <small data-status={row.outcome.status}>
                        {readable(row.outcome.status)}
                      </small>
                    </div>
                    <strong>{row.question}</strong>
                  </div>
                  <p>
                    <b>Search concepts:</b> {row.queryConcepts.join(" · ")}
                  </p>
                  <p>
                    <b>Routes:</b> {row.providers.map((provider) =>
                      `${provider.id} (${readable(provider.capabilityStatus)})`
                    ).join(" · ")}
                  </p>
                  <small>{row.outcome.note}</small>
                </li>
              ))}
            </ol>

            <div className="six-source-boundary">
              <h3>Source-access boundary</h3>
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Current state</th>
                    <th>What it can establish now</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.providerCapabilities.map((provider) => (
                    <tr key={provider.id}>
                      <td>{provider.provider}</td>
                      <td>{readable(provider.status)}</td>
                      <td>{provider.limitation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="six-literature-execution" aria-label="Scholarly metadata execution">
              <div className="six-mechanism-branch-heading">
                <h3>Scholarly evidence packet</h3>
                <small data-status={execution?.status ?? "not_started"}>
                  {readable(execution?.status ?? "not_started")}
                </small>
              </div>
              {execution ? (
                <>
                  <dl className="six-review-facts">
                    <div>
                      <dt>Provider queries</dt>
                      <dd>{execution.actualSearchBoundary.sourceQueries}</dd>
                    </div>
                    <div>
                      <dt>Metadata records received</dt>
                      <dd>{execution.actualSearchBoundary.metadataRecords}</dd>
                    </div>
                    <div>
                      <dt>Metadata leads retained</dt>
                      <dd>{execution.scholarlyMetadataRecordIds.length}</dd>
                    </div>
                    <div>
                      <dt>Full texts inspected</dt>
                      <dd>0</dd>
                    </div>
                  </dl>
                  {props.workspace.attempts.length ? (
                    <ol className="six-mechanism-branches">
                      {props.workspace.attempts.map((attempt) => (
                        <li key={attempt.id}>
                          <div className="six-mechanism-branch-heading">
                            <strong>{readable(attempt.branch)}</strong>
                            <small data-status={attempt.outcome}>
                              {readable(attempt.outcome)}
                            </small>
                          </div>
                          <p>{attempt.note}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>
                      No provider route was executed. The saved capability
                      boundary is not a no-match result.
                    </p>
                  )}
                  {props.workspace.metadataRecords.length ? (
                    <div className="six-metadata-leads">
                      <h4>Scholarly metadata leads</h4>
                      <ul>
                        {props.workspace.metadataRecords.map((record) => (
                          <li key={record.id}>
                            <a href={record.stableLocator} target="_blank" rel="noreferrer">
                              {record.title}
                            </a>
                            <span>
                              {record.authors.length
                                ? record.authors.join(", ")
                                : "Authors not returned"}
                              {record.publicationYear
                                ? ` · ${record.publicationYear}`
                                : " · Year not returned"}
                            </span>
                            <small>
                              {record.providerId === "openalex"
                                ? "OpenAlex work/location metadata"
                                : "Crossref bibliographic metadata"}
                              {" · detailed claim support not eligible"}
                            </small>
                            {record.openAccessLocationMetadata?.locations.length
                              ? (
                                <div className="six-reported-locations">
                                  <small>
                                    {record.openAccessLocationMetadata.locations.length}
                                    {" unvisited reported location(s) · no link followed"}
                                  </small>
                                  <ul>
                                    {record.openAccessLocationMetadata.locations.map(
                                      (location, index) => (
                                        <li key={`${record.id}-location-${index}`}>
                                          <span>
                                            {location.sourceName ??
                                              "OpenAlex reported location"}
                                          </span>
                                          {location.landingPageUrl ? (
                                            <a
                                              href={location.landingPageUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              reported landing page
                                            </a>
                                          ) : null}
                                          {location.pdfUrl ? (
                                            <a
                                              href={location.pdfUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              reported PDF
                                            </a>
                                          ) : null}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )
                              : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="six-policy-qualification">
                    {props.workspace.evidencePacket?.claimBoundary ??
                      execution.claimBoundary}
                  </p>
                </>
              ) : (
                <p>
                  The saved plan has not executed. Only a configured, tested,
                  healthy OpenAlex or Crossref metadata route can make a request
                  in this slice.
                </p>
              )}
              {props.canContinue ? (
                <div className="six-actions">
                  <button
                    type="button"
                    className="six-primary"
                    disabled={props.disabled}
                    onClick={() => void props.onContinue()}
                  >
                    {testedMetadataProvider
                      ? "Run next scholarly metadata step"
                      : "Record current source-access boundary"}
                  </button>
                  <small>
                    One action runs at most one tested metadata query. It does
                    not fetch an abstract, article, appendix, or cited passage.
                  </small>
                </div>
              ) : null}
            </section>

            {execution?.status === "complete" ? (
              <section
                className="six-literature-execution six-scholarly-inspection"
                aria-label="Exact scholarly passage inspection"
              >
                <div className="six-mechanism-branch-heading">
                  <h3>Exact scholarly passage inspection</h3>
                  <small data-status={props.workspace.passagePacket
                    ? "passages_retained"
                    : "not_started"}
                  >
                    {props.workspace.passagePacket
                      ? `${props.workspace.passagePacket.passageReferences.length} passage(s)`
                      : "not started"}
                  </small>
                </div>
                <p>
                  Select one saved lead, provide its exact document URL, confirm
                  your access basis, and paste one exact passage to locate. The
                  adapter makes at most one request to a configured, tested host;
                  it follows no DOI redirect, metadata link, citation, or embedded
                  resource and retains no full article text.
                </p>

                {props.workspace.documentTargets.length ? (
                  <form
                    className="six-scholarly-inspection-form"
                    onSubmit={submitInspection}
                  >
                    <label className="six-field">
                      <span>Saved scholarly lead</span>
                      <select
                        value={inspection.targetId}
                        disabled={props.disabled}
                        onChange={(event) => {
                          const selected = props.workspace.documentTargets.find(
                            ({ id }) => id === event.target.value,
                          );
                          setInspection((current) => ({
                            ...current,
                            targetId: event.target.value,
                            exactDocumentUrl:
                              selected?.routeRequirement === "exact_url_available"
                                ? selected.retainedLocator ?? ""
                                : "",
                          }));
                        }}
                      >
                        {props.workspace.documentTargets.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.title ?? target.doi ?? target.retainedLocator ??
                              `${readable(target.originKind)} lead`}
                          </option>
                        ))}
                      </select>
                      <small>
                        DOI, OpenAlex, and Crossref entries bind identity or
                        discovery metadata only; they still require a
                        researcher-supplied exact document URL.
                      </small>
                    </label>
                    <label className="six-field">
                      <span>Exact document URL</span>
                      <input
                        type="url"
                        inputMode="url"
                        pattern="https://.*"
                        value={inspection.exactDocumentUrl}
                        maxLength={2_048}
                        disabled={props.disabled}
                        placeholder="https://tested.example/article"
                        onChange={(event) => updateInspection(
                          "exactDocumentUrl",
                          event.target.value,
                        )}
                      />
                    </label>
                    <div className="six-grid">
                      <label className="six-field">
                        <span>Access basis</span>
                        <select
                          value={inspection.accessBasis}
                          disabled={props.disabled}
                          onChange={(event) => updateInspection(
                            "accessBasis",
                            event.target.value as ScholarlyDocumentAccessBasis,
                          )}
                        >
                          <option value="not_confirmed">Not confirmed</option>
                          <option value="open_access">Open access</option>
                          <option value="researcher_authorized_access">
                            I am authorized to access it
                          </option>
                        </select>
                      </label>
                      <label className="six-field">
                        <span>Text inspected</span>
                        <select
                          value={inspection.inspectionMode}
                          disabled={props.disabled}
                          onChange={(event) => updateInspection(
                            "inspectionMode",
                            event.target.value as ScholarlyDocumentInspectionMode,
                          )}
                        >
                          <option value="partial_text">Partial article text</option>
                          <option value="abstract_only">Abstract only</option>
                        </select>
                      </label>
                      <label className="six-field">
                        <span>Passage purpose</span>
                        <select
                          value={inspection.passagePurpose}
                          disabled={props.disabled}
                          onChange={(event) => updateInspection(
                            "passagePurpose",
                            event.target.value as ScholarlyPassagePurpose,
                          )}
                        >
                          <option value="theoretical_proposition">
                            Theoretical proposition
                          </option>
                          <option value="empirical_result_or_qualification">
                            Empirical result or qualification
                          </option>
                          <option value="empirical_setting_or_measure">
                            Empirical setting or measure
                          </option>
                          <option value="boundary_condition">Boundary condition</option>
                          <option value="contrary_evidence">Contrary evidence</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                    <label className="six-field">
                      <span>Exact passage to locate</span>
                      <textarea
                        value={inspection.exactPassage}
                        maxLength={4_000}
                        disabled={props.disabled}
                        placeholder="Paste one exact passage from the document"
                        onChange={(event) => updateInspection(
                          "exactPassage",
                          event.target.value,
                        )}
                      />
                      <small>
                        The normalized passage must occur exactly once. Abstract
                        text is recorded but cannot support a detailed claim.
                      </small>
                    </label>
                    <label className="six-field">
                      <span>Researcher qualification (optional)</span>
                      <textarea
                        value={inspection.qualification}
                        maxLength={1_400}
                        disabled={props.disabled}
                        placeholder="State how this passage may—or may not—bear on the study"
                        onChange={(event) => updateInspection(
                          "qualification",
                          event.target.value,
                        )}
                      />
                    </label>
                    <div className="six-actions">
                      <button
                        type="submit"
                        className="six-primary"
                        disabled={props.disabled || !props.canInspect ||
                          (inspection.accessBasis !== "not_confirmed" &&
                            Boolean(inspection.exactDocumentUrl.trim()) &&
                            !inspection.exactPassage.trim())}
                      >
                        {inspection.accessBasis === "not_confirmed"
                          ? "Record rights boundary"
                          : !inspection.exactDocumentUrl.trim()
                            ? "Record exact-URL requirement"
                            : !inspection.exactPassage.trim()
                              ? "Add exact passage to inspect"
                              : "Inspect exact document passage"}
                      </button>
                      <small>
                        Missing rights, URL, source configuration, or capability
                        proof is saved as a typed zero-request outcome.
                      </small>
                    </div>
                  </form>
                ) : (
                  <p>
                    No scholarly lead is available. Revise the literature plan
                    with an exact DOI or URL before attempting inspection.
                  </p>
                )}

                {props.workspace.documentAcquisitions.length ? (
                  <div className="six-scholarly-history">
                    <h4>Inspection history</h4>
                    <ol className="six-mechanism-branches">
                      {props.workspace.documentAcquisitions.map((acquisition) => (
                        <li key={acquisition.id}>
                          <div className="six-mechanism-branch-heading">
                            <strong>Attempt {acquisition.ordinal}</strong>
                            <small data-status={acquisition.outcome}>
                              {readable(acquisition.outcome)}
                            </small>
                          </div>
                          <p>{acquisition.note}</p>
                          {acquisition.document && acquisition.passage ? (
                            <div className="six-scholarly-passage">
                              <a
                                href={acquisition.document.canonicalUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {acquisition.document.title}
                              </a>
                              <small>
                                {readable(acquisition.document.inspectionStatus)} · {acquisition.passage.locator}
                              </small>
                              <blockquote>{acquisition.passage.exactText}</blockquote>
                              <small>{acquisition.passage.qualification}</small>
                              <small>
                                Source hash: {acquisition.document.normalizedTextHash}
                              </small>
                              <small>
                                Passage hash: {acquisition.passage.quoteHash}
                              </small>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <p className="six-policy-qualification">
                  {props.workspace.passagePacket?.claimBoundary ??
                    "No scholarly passage has been inspected. Mechanism generation remains blocked."}
                </p>
              </section>
            ) : null}

            {eligibleAcquisitions.length ||
                props.workspace.claimExtractions.length ? (
              <section
                className="six-literature-execution six-scholarly-claims"
                aria-label="Structured scholarly claim review"
              >
                <div className="six-mechanism-branch-heading">
                  <h3>Structured scholarly claim review</h3>
                  <small data-status={
                    props.workspace.claimPacket?.detailedClaims.status ??
                      "not_started"
                  }>
                    {props.workspace.claimPacket
                      ? `${props.workspace.claimPacket.detailedClaims.acceptedCount} accepted`
                      : "not started"}
                  </small>
                </div>
                <p>
                  You—not an automated model—author each structured extraction
                  from one retained partial-text passage. A separate explicit
                  decision then accepts, rejects, defers, or corrects it. The
                  exact quote and document/version lineage remain unchanged.
                </p>

                {eligibleAcquisitions.length ? (
                  <form
                    className="six-scholarly-inspection-form"
                    onSubmit={submitClaim}
                  >
                    <h4>Author a claim extraction</h4>
                    <label className="six-field">
                      <span>Eligible exact passage</span>
                      <select
                        value={(claimDraft.passageId ||
                          eligibleAcquisitions[0]?.passage?.id) ?? ""}
                        disabled={props.disabled}
                        onChange={(event) => setClaimDraft((current) => ({
                          ...current,
                          passageId: event.target.value,
                        }))}
                      >
                        {eligibleAcquisitions.map((acquisition) => (
                          <option
                            key={acquisition.passage!.id}
                            value={acquisition.passage!.id}
                          >
                            {acquisition.document!.title} · passage {acquisition.ordinal}
                          </option>
                        ))}
                      </select>
                      <small>
                        Abstract-only and metadata-only records never appear in
                        this list.
                      </small>
                    </label>
                    {eligibleAcquisitions.map((acquisition) =>
                      acquisition.passage?.id ===
                          (claimDraft.passageId ||
                            eligibleAcquisitions[0]?.passage?.id)
                        ? (
                            <blockquote key={acquisition.passage!.id}>
                              {acquisition.passage!.exactText}
                            </blockquote>
                          )
                        : null)}
                    <ClaimFieldsEditor
                      prefix="scholarly-extraction"
                      value={claimDraft}
                      disabled={props.disabled}
                      onChange={(value) => setClaimDraft((current) => ({
                        ...current,
                        ...value,
                      }))}
                    />
                    <div className="six-actions">
                      <button
                        type="submit"
                        className="six-primary"
                        disabled={props.disabled || !props.canExtractClaim ||
                          !claimHasContent ||
                          !claimDraft.contextualFitRationale.trim()}
                      >
                        Save researcher-authored extraction
                      </button>
                      <small>
                        Saving does not accept the claim or create a mechanism.
                      </small>
                    </div>
                  </form>
                ) : null}

                {props.workspace.claimExtractions.length ? (
                  <div className="six-scholarly-history">
                    <h4>Extraction and review history</h4>
                    <ol className="six-mechanism-branches">
                      {props.workspace.claimExtractions.map((extraction) => {
                        const latest = latestReviewByExtraction.get(extraction.id);
                        const fields = latest?.finalFields ?? extraction.fields;
                        return (
                          <li key={extraction.id}>
                            <div className="six-mechanism-branch-heading">
                              <strong>Claim {extraction.ordinal}</strong>
                              <small data-status={latest?.decision ?? "unreviewed"}>
                                {readable(latest?.decision ?? "unreviewed")}
                              </small>
                            </div>
                            <blockquote>
                              {extraction.passageReference.exactText}
                            </blockquote>
                            <dl className="six-review-facts">
                              <div>
                                <dt>Theoretical proposition</dt>
                                <dd>{fields.theoreticalProposition ?? "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Empirical setting</dt>
                                <dd>{fields.empiricalSetting ?? "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Level of analysis</dt>
                                <dd>{fields.levelOfAnalysis ?? "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Measured variables</dt>
                                <dd>{fields.measuredVariables.length
                                  ? fields.measuredVariables.join(" · ")
                                  : "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Result or qualification</dt>
                                <dd>{fields.relevantResultOrQualification ??
                                  "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Contextual fit</dt>
                                <dd>{readable(fields.contextualFit.assessment)}</dd>
                              </div>
                              <div>
                                <dt>Evidence level</dt>
                                <dd>{readable(fields.evidenceLevel)}</dd>
                              </div>
                            </dl>
                            <p>{fields.contextualFit.rationale}</p>
                            {latest ? <small>{latest.rationale}</small> : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}

                {reviewableExtractions.length ? (
                  <form
                    className="six-scholarly-inspection-form"
                    onSubmit={submitClaimReview}
                  >
                    <h4>Review an extraction</h4>
                    <label className="six-field">
                      <span>Pending extraction</span>
                      <select
                        value={(claimReview.extractionId ||
                          reviewableExtractions[0]?.id) ?? ""}
                        disabled={props.disabled}
                        onChange={(event) => {
                          const extraction = reviewableExtractions.find(
                            ({ id }) => id === event.target.value,
                          );
                          setClaimReview((current) => ({
                            ...current,
                            extractionId: event.target.value,
                            correction: extraction
                              ? draftFromClaimFields(extraction.fields)
                              : current.correction,
                          }));
                        }}
                      >
                        {reviewableExtractions.map((extraction) => (
                          <option key={extraction.id} value={extraction.id}>
                            Claim {extraction.ordinal} · {readable(
                              extraction.fields.evidenceLevel,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="six-field">
                      <span>Decision</span>
                      <select
                        value={claimReview.decision}
                        disabled={props.disabled}
                        onChange={(event) => {
                          const decision = event.target.value as
                            ScholarlyClaimReviewDecision["mode"];
                          const extraction = reviewableExtractions.find(
                            ({ id }) => id === (claimReview.extractionId ||
                              reviewableExtractions[0]?.id),
                          );
                          setClaimReview((current) => ({
                            ...current,
                            decision,
                            correction: decision === "corrected" && extraction
                              ? draftFromClaimFields(extraction.fields)
                              : current.correction,
                          }));
                        }}
                      >
                        <option value="accepted">Accept</option>
                        <option value="rejected">Reject</option>
                        <option value="deferred">Defer</option>
                        <option value="corrected">Correct and accept</option>
                      </select>
                    </label>
                    {claimReview.decision === "corrected" ? (
                      <ClaimFieldsEditor
                        prefix="scholarly-correction"
                        value={claimReview.correction}
                        disabled={props.disabled}
                        onChange={(correction) => setClaimReview((current) => ({
                          ...current,
                          correction,
                        }))}
                      />
                    ) : null}
                    <label className="six-field">
                      <span>Review rationale</span>
                      <textarea
                        required
                        value={claimReview.rationale}
                        maxLength={2_000}
                        disabled={props.disabled}
                        onChange={(event) => setClaimReview((current) => ({
                          ...current,
                          rationale: event.target.value,
                        }))}
                      />
                    </label>
                    <div className="six-actions">
                      <button
                        type="submit"
                        className="six-primary"
                        disabled={props.disabled || !props.canReviewClaim ||
                          !claimReview.rationale.trim()}
                      >
                        Record explicit researcher decision
                      </button>
                      <small>
                        Reject and defer create no accepted premise. Correct
                        preserves both the original and final fields.
                      </small>
                    </div>
                  </form>
                ) : null}

                <p className="six-policy-qualification">
                  {props.workspace.claimPacket?.claimBoundary ??
                    "No structured scholarly claim has been authored. Mechanism generation remains blocked."}
                </p>
              </section>
            ) : null}

            {props.workspace.claimPacket?.acceptedClaimReferences.length ? (
              <section
                className="six-literature-execution six-scholarly-claims"
                aria-label="Frozen mechanism synthesis inputs"
              >
                <div className="six-mechanism-branch-heading">
                  <h3>Frozen synthesis inputs</h3>
                  <small data-status={
                    props.workspace.synthesisInputPacket
                      ? "inputs_frozen"
                      : "not_prepared"
                  }>
                    {props.workspace.synthesisInputPacket
                      ? "inputs frozen · synthesis blocked"
                      : "not prepared"}
                  </small>
                </div>
                {props.workspace.synthesisInputPacket ? (() => {
                  const packet = props.workspace.synthesisInputPacket;
                  return (
                    <>
                      <p>
                        Fixed software froze only accepted or corrected claims
                        and the already reviewed policy and study context. It
                        made {packet.preparation.networkRequests} network
                        requests and {packet.preparation.modelCalls} model calls.
                      </p>
                      <dl className="six-review-facts">
                        <div>
                          <dt>Study outcome</dt>
                          <dd>{packet.study.outcome}</dd>
                        </div>
                        <div>
                          <dt>Intended construct</dt>
                          <dd>{packet.study.intendedConstruct}</dd>
                        </div>
                        <div>
                          <dt>Starting explanation</dt>
                          <dd>{packet.researcherContext.initialExplanation.mode ===
                              "stated"
                            ? packet.researcherContext.initialExplanation.text
                            : "Researcher explicitly undecided"}</dd>
                        </div>
                        <div>
                          <dt>Known alternatives</dt>
                          <dd>{packet.researcherContext.knownAlternativeAccounts
                            .length
                            ? packet.researcherContext.knownAlternativeAccounts
                              .join(" · ")
                            : "None recorded"}</dd>
                        </div>
                      </dl>
                      <h4>Reviewed policy premises</h4>
                      <ul>
                        {packet.policyPremises.map((premise) => (
                          <li key={premise.claimId}>
                            {premise.effectiveStatement}
                          </li>
                        ))}
                      </ul>
                      <h4>Accepted source-linked scholarly claims</h4>
                      <ol className="six-mechanism-branches">
                        {packet.acceptedScholarlyClaims.map((claim) => (
                          <li key={claim.reviewReference.reviewId}>
                            <div className="six-mechanism-branch-heading">
                              <strong>{readable(
                                claim.reviewedFields.evidenceLevel,
                              )}</strong>
                              <small data-status={claim.reviewReference.decision}>
                                {readable(claim.reviewReference.decision)}
                              </small>
                            </div>
                            <blockquote>
                              {claim.sourceLineage.passageReference.exactText}
                            </blockquote>
                            <p>{claim.reviewedFields.theoreticalProposition ??
                              claim.reviewedFields
                                .relevantResultOrQualification ??
                              "No proposition or result recorded"}</p>
                            <small>
                              {claim.sourceLineage.documentReference.title} · {claim.sourceLineage.passageReference.locator}
                            </small>
                            <small>
                              Passage hash: {claim.sourceLineage
                                .passageReference.quoteHash}
                            </small>
                          </li>
                        ))}
                      </ol>
                      <p>
                        Constraints: {readable(
                          packet.knownConstraints.designReview,
                        )}; {readable(packet.knownConstraints.coEventReview)};
                        comparison-specific co-event relation {readable(
                          packet.knownConstraints.coEventRelationAnalysis,
                        )}; bounded exact partial text only.
                      </p>
                      <p className="six-policy-qualification">
                        {packet.claimBoundary}
                      </p>
                    </>
                  );
                })() : (
                  <>
                    <p>
                      Freeze the current accepted or corrected scholarly claims,
                      their exact source lineage, reviewed policy premises,
                      study outcome and construct, starting explanation, and
                      known alternatives. Rejected, deferred, abstract-only,
                      and metadata-only material will be excluded.
                    </p>
                    <div className="six-actions">
                      <button
                        type="button"
                        className="six-primary"
                        disabled={props.disabled ||
                          !props.canPrepareSynthesisInput}
                        onClick={() => void props.onPrepareSynthesisInput(
                          props.workspace.claimPacket!.packetFingerprint,
                        )}
                      >
                        Freeze reviewed synthesis inputs
                      </button>
                      <small>
                        This action makes no network or model call and creates no
                        theory card, mechanism, prediction, measure, or estimate.
                      </small>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {props.workspace.synthesisInputPacket ? (
              <form
                className="six-literature-execution six-mechanism-review"
                aria-label="Mechanism review and prediction matrix"
                onSubmit={submitMechanismReview}
              >
                <div className="six-mechanism-branch-heading">
                  <div>
                    <h3>Mechanism review and prediction matrix</h3>
                    <p>
                      Record one to four hypotheses, then state observable
                      patterns for every non-rejected hypothesis. These are
                      researcher judgments bound to the frozen scholarly packet.
                    </p>
                  </div>
                  <small data-status={props.workspace.mechanismReview
                    ? "reviewed"
                    : "researcher_input_required"}
                  >
                    {props.workspace.mechanismReview
                      ? `revision ${props.workspace.mechanismReview.ordinal}`
                      : "researcher input required"}
                  </small>
                </div>

                <div className="six-grid">
                  <label className="six-field">
                    <span>Intended theoretical claim</span>
                    <select
                      value={mechanismReview.intendedClaim}
                      disabled={props.disabled}
                      onChange={(event) => setMechanismReview((current) => ({
                        ...current,
                        intendedClaim: event.target.value as
                          MechanismReviewDraft["intendedClaim"],
                      }))}
                    >
                      <option value="total_effect_only">
                        Total policy effect only
                      </option>
                      <option value="compare_mechanisms_without_identification">
                        Compare plausible mechanisms
                      </option>
                      <option value="seek_unique_mechanism_evidence">
                        Seek evidence for a unique mechanism
                      </option>
                    </select>
                  </label>
                  <label className="six-field">
                    <span>Focal retained mechanism</span>
                    <select
                      value={mechanismReview.focalMechanismId ?? ""}
                      disabled={props.disabled}
                      onChange={(event) => setMechanismReview((current) => ({
                        ...current,
                        focalMechanismId: event.target.value || null,
                      }))}
                    >
                      <option value="">No unique focal mechanism</option>
                      {mechanismReview.mechanisms.filter(({ decision }) =>
                        decision === "retained").map((mechanism) => (
                          <option key={mechanism.id} value={mechanism.id}>
                            {mechanism.label || readable(mechanism.id)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="six-scholarly-history">
                  <div className="six-mechanism-branch-heading">
                    <h4>Mechanism cards</h4>
                    <button
                      type="button"
                      className="six-secondary"
                      disabled={props.disabled ||
                        mechanismReview.mechanisms.length >= 4}
                      onClick={addMechanism}
                    >
                      Add mechanism
                    </button>
                  </div>
                  {mechanismReview.mechanisms.map((mechanism, index) => (
                    <fieldset key={mechanism.id} className="six-mechanism-card-editor">
                      <legend>Mechanism {index + 1}</legend>
                      <div className="six-grid">
                        <label className="six-field">
                          <span>Short label</span>
                          <input
                            required
                            value={mechanism.label}
                            maxLength={200}
                            disabled={props.disabled}
                            onChange={(event) => updateMechanism(
                              mechanism.id,
                              (current) => ({
                                ...current,
                                label: event.target.value,
                              }),
                            )}
                          />
                        </label>
                        <label className="six-field">
                          <span>Relationship</span>
                          <select
                            value={mechanism.role}
                            disabled={props.disabled}
                            onChange={(event) => updateMechanism(
                              mechanism.id,
                              (current) => ({
                                ...current,
                                role: event.target.value as MechanismCardDraft["role"],
                              }),
                            )}
                          >
                            <option value="focal">Focal pathway</option>
                            <option value="rival">Rival mechanism</option>
                            <option value="complementary">Complementary pathway</option>
                            <option value="offsetting">Offsetting pathway</option>
                            <option value="independent_coevent">Independent co-event explanation</option>
                            <option value="measurement_alternative">Measurement alternative</option>
                          </select>
                        </label>
                        <label className="six-field">
                          <span>Researcher decision</span>
                          <select
                            value={mechanism.decision}
                            disabled={props.disabled}
                            onChange={(event) => updateMechanism(
                              mechanism.id,
                              (current) => ({
                                ...current,
                                decision: event.target.value as
                                  MechanismCardDraft["decision"],
                              }),
                            )}
                          >
                            <option value="retained">Retain</option>
                            <option value="rejected">Reject</option>
                            <option value="deferred">Defer</option>
                          </select>
                        </label>
                        <label className="six-field">
                          <span>Evidence level</span>
                          <select
                            value={mechanism.evidenceLevel}
                            disabled={props.disabled}
                            onChange={(event) => updateMechanism(
                              mechanism.id,
                              (current) => ({
                                ...current,
                                evidenceLevel: event.target.value as
                                  MechanismCardDraft["evidenceLevel"],
                              }),
                            )}
                          >
                            <option value="researcher_hypothesis">Researcher hypothesis</option>
                            <option value="partially_source_grounded">Partially source grounded</option>
                            <option value="source_grounded">Source grounded</option>
                          </select>
                        </label>
                      </div>
                      <label className="six-field">
                        <span>Causal sequence</span>
                        <textarea
                          required
                          value={mechanism.causalSequence.join("\n")}
                          maxLength={6_000}
                          disabled={props.disabled}
                          placeholder="One step per line, from policy change to outcome"
                          onChange={(event) => updateMechanism(
                            mechanism.id,
                            (current) => ({
                              ...current,
                              causalSequence: lines(event.target.value),
                            }),
                          )}
                        />
                        <small>Two to six distinct steps are required.</small>
                      </label>
                      <div className="six-grid">
                        {([
                          ["theoreticalAnchor", "Theoretical anchor"],
                          ["policyConnection", "Connection to the policy"],
                          ["contextualFit", "Fit to this study"],
                          ["uncertainty", "Key uncertainty"],
                          ["researcherRationale", "Decision rationale"],
                        ] as const).map(([field, label]) => (
                          <label className="six-field" key={field}>
                            <span>{label}</span>
                            <textarea
                              required
                              value={mechanism[field]}
                              maxLength={4_000}
                              disabled={props.disabled}
                              onChange={(event) => updateMechanism(
                                mechanism.id,
                                (current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }),
                              )}
                            />
                          </label>
                        ))}
                      </div>
                      <fieldset className="six-source-claim-selector">
                        <legend>Accepted scholarly support</legend>
                        {props.workspace.synthesisInputPacket!
                          .acceptedScholarlyClaims.map((claim, claimIndex) => {
                            const reference = acceptedClaimReference(claimIndex);
                            const key = claimReferenceKey(reference);
                            const checked = mechanism.acceptedClaimReferences
                              .some((value) => claimReferenceKey(value) === key);
                            return (
                              <label key={key}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={props.disabled}
                                  onChange={() => updateMechanism(
                                    mechanism.id,
                                    (current) => ({
                                      ...current,
                                      acceptedClaimReferences: checked
                                        ? current.acceptedClaimReferences.filter(
                                          (value) =>
                                            claimReferenceKey(value) !== key,
                                        )
                                        : [...current.acceptedClaimReferences,
                                          reference],
                                    }),
                                  )}
                                />
                                <span>{claim.reviewedFields
                                  .theoreticalProposition ??
                                  claim.reviewedFields
                                    .relevantResultOrQualification ??
                                  `Accepted claim ${claimIndex + 1}`}</span>
                              </label>
                            );
                          })}
                        <small>
                          A source-grounded card requires at least one exact
                          accepted-claim reference. Unlinked cards remain
                          researcher hypotheses.
                        </small>
                      </fieldset>
                      <button
                        type="button"
                        className="six-secondary"
                        disabled={props.disabled ||
                          mechanismReview.mechanisms.length <= 1}
                        onClick={() => removeMechanism(mechanism.id)}
                      >
                        Remove this mechanism
                      </button>
                    </fieldset>
                  ))}
                </div>

                <div className="six-scholarly-history">
                  <div className="six-mechanism-branch-heading">
                    <h4>Observable prediction matrix</h4>
                    <button
                      type="button"
                      className="six-secondary"
                      disabled={props.disabled ||
                        mechanismReview.predictions.length >= 12}
                      onClick={addPrediction}
                    >
                      Add prediction
                    </button>
                  </div>
                  {mechanismReview.predictions.map((prediction, index) => (
                    <fieldset key={prediction.id} className="six-prediction-editor">
                      <legend>Prediction {index + 1}</legend>
                      <label className="six-field">
                        <span>Observable implication</span>
                        <textarea
                          required
                          value={prediction.observation}
                          maxLength={4_000}
                          disabled={props.disabled}
                          onChange={(event) => updatePrediction(
                            prediction.id,
                            (current) => ({
                              ...current,
                              observation: event.target.value,
                            }),
                          )}
                        />
                      </label>
                      <div className="six-grid">
                        {([
                          ["feasibleMeasure", "Measure"],
                          ["timing", "Timing"],
                          ["dataSource", "Data source"],
                        ] as const).map(([field, label]) => (
                          <label className="six-field" key={field}>
                            <span>{label}</span>
                            <textarea
                              required
                              value={prediction[field]}
                              maxLength={4_000}
                              disabled={props.disabled}
                              onChange={(event) => updatePrediction(
                                prediction.id,
                                (current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }),
                              )}
                            />
                          </label>
                        ))}
                        <label className="six-field">
                          <span>Feasibility</span>
                          <select
                            value={prediction.feasibility}
                            disabled={props.disabled}
                            onChange={(event) => updatePrediction(
                              prediction.id,
                              (current) => ({
                                ...current,
                                feasibility: event.target.value as
                                  PredictionRowDraft["feasibility"],
                              }),
                            )}
                          >
                            <option value="feasible_now">Feasible now</option>
                            <option value="feasible_with_additional_data">Needs additional data</option>
                            <option value="not_currently_feasible">Not currently feasible</option>
                          </select>
                        </label>
                        <label className="six-field">
                          <span>Priority</span>
                          <select
                            value={prediction.priority}
                            disabled={props.disabled}
                            onChange={(event) => updatePrediction(
                              prediction.id,
                              (current) => ({
                                ...current,
                                priority: event.target.value as
                                  PredictionRowDraft["priority"],
                              }),
                            )}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </label>
                      </div>
                      <label className="six-field">
                        <span>Assumptions</span>
                        <textarea
                          value={prediction.assumptions.join("\n")}
                          maxLength={8_000}
                          disabled={props.disabled}
                          placeholder="One assumption per line"
                          onChange={(event) => updatePrediction(
                            prediction.id,
                            (current) => ({
                              ...current,
                              assumptions: lines(event.target.value),
                            }),
                          )}
                        />
                      </label>
                      <div className="six-prediction-patterns">
                        {mechanismReview.mechanisms.filter(({ decision }) =>
                          decision !== "rejected").map((mechanism) => {
                            const pattern = prediction.patterns.find(
                              ({ mechanismId }) => mechanismId === mechanism.id,
                            ) ?? {
                              mechanismId: mechanism.id,
                              direction: "ambiguous" as const,
                              detail: "",
                            };
                            return (
                              <div key={mechanism.id} className="six-prediction-pattern">
                                <strong>{mechanism.label || readable(mechanism.id)}</strong>
                                <label className="six-field">
                                  <span>Expected direction</span>
                                  <select
                                    value={pattern.direction}
                                    disabled={props.disabled}
                                    onChange={(event) => updatePrediction(
                                      prediction.id,
                                      (current) => ({
                                        ...current,
                                        patterns: [
                                          ...current.patterns.filter(
                                            ({ mechanismId }) =>
                                              mechanismId !== mechanism.id,
                                          ),
                                          {
                                            ...pattern,
                                            direction: event.target.value as
                                              PredictionRowDraft["patterns"][number]["direction"],
                                          },
                                        ],
                                      }),
                                    )}
                                  >
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                    <option value="no_change">No change</option>
                                    <option value="nonlinear">Nonlinear</option>
                                    <option value="ambiguous">Ambiguous</option>
                                    <option value="not_applicable">Not applicable</option>
                                  </select>
                                </label>
                                <label className="six-field">
                                  <span>Pattern and interpretation</span>
                                  <textarea
                                    required
                                    value={pattern.detail}
                                    maxLength={4_000}
                                    disabled={props.disabled}
                                    onChange={(event) => updatePrediction(
                                      prediction.id,
                                      (current) => ({
                                        ...current,
                                        patterns: [
                                          ...current.patterns.filter(
                                            ({ mechanismId }) =>
                                              mechanismId !== mechanism.id,
                                          ),
                                          {
                                            ...pattern,
                                            detail: event.target.value,
                                          },
                                        ],
                                      }),
                                    )}
                                  />
                                </label>
                              </div>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        className="six-secondary"
                        disabled={props.disabled ||
                          mechanismReview.predictions.length <= 1}
                        onClick={() => setMechanismReview((current) => ({
                          ...current,
                          predictions: current.predictions.filter(({ id }) =>
                            id !== prediction.id),
                        }))}
                      >
                        Remove this prediction
                      </button>
                    </fieldset>
                  ))}
                </div>

                <label className="six-field">
                  <span>Overall review rationale</span>
                  <textarea
                    required
                    value={mechanismReview.overallRationale}
                    maxLength={4_000}
                    disabled={props.disabled}
                    onChange={(event) => setMechanismReview((current) => ({
                      ...current,
                      overallRationale: event.target.value,
                    }))}
                  />
                </label>
                <div className="six-actions">
                  <button
                    type="submit"
                    className="six-primary"
                    disabled={props.disabled || !props.canSaveMechanismReview}
                  >
                    {props.workspace.mechanismReview
                      ? "Save revised mechanism review"
                      : "Save mechanism review and prediction matrix"}
                  </button>
                  <small>
                    Fixed software validates lineage and selects a compact set
                    of feasible predictions by pair coverage. It does not invent
                    any mechanism, pattern, measure, or effect.
                  </small>
                </div>

                {props.workspace.mechanismReview &&
                    props.workspace.predictionMatrix ? (
                  <div className="six-policy-qualification">
                    <strong>Current compact evidence plan</strong>
                    <p>
                      Selected prediction rows: {props.workspace.predictionMatrix
                        .compactEvidencePlan.selectedPredictionIds.join(", ") ||
                        "none"}. Covered pairs: {props.workspace.predictionMatrix
                          .compactEvidencePlan.coveredPairCount} of {props.workspace
                          .predictionMatrix.compactEvidencePlan.totalPairCount}.
                    </p>
                    <p>{props.workspace.mechanismReview.claimBoundary}</p>
                    <p>{props.workspace.predictionMatrix.claimBoundary}</p>
                  </div>
                ) : null}
              </form>
            ) : null}

            <details>
              <summary>Current limitations</summary>
              <ul>
                {plan.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </details>
            <p className="six-policy-qualification">{plan.claimBoundary}</p>
          </>
        ) : null}
      </section>

      <form className="six-card six-mechanism-intake" onSubmit={submit}>
        <p className="six-kicker">
          {plan ? "Revise the plan" : "Researcher input"}
        </p>
        <h2>Your starting explanation</h2>
        <label className="six-field">
          <span>Current position</span>
          <select
            value={draft.explanationMode}
            disabled={props.disabled}
            onChange={(event) => update(
              "explanationMode",
              event.target.value as Draft["explanationMode"],
            )}
          >
            <option value="stated">I have an initial explanation</option>
            <option value="undecided">I have not selected a mechanism</option>
          </select>
        </label>
        {draft.explanationMode === "stated" ? (
          <label className="six-field">
            <span>Initial explanation in ordinary language</span>
            <textarea
              value={draft.explanation}
              required
              maxLength={4_000}
              disabled={props.disabled}
              onChange={(event) => update("explanation", event.target.value)}
            />
            <small>
              This text is timestamped as the starting explanation. It is not
              treated as a supported mechanism.
            </small>
          </label>
        ) : null}
        <div className="six-grid">
          <label className="six-field">
            <span>Relevant works you want included</span>
            <textarea
              value={draft.suppliedWorks}
              maxLength={12_000}
              disabled={props.disabled}
              placeholder="One DOI, OpenAlex ID, URL, or citation per line"
              onChange={(event) => update("suppliedWorks", event.target.value)}
            />
            <small>These remain uninspected leads until their text is obtained and reviewed.</small>
          </label>
          <label className="six-field">
            <span>Preferred constructs</span>
            <textarea
              value={draft.preferredConstructs}
              maxLength={8_000}
              disabled={props.disabled}
              placeholder="One construct per line"
              onChange={(event) => update(
                "preferredConstructs",
                event.target.value,
              )}
            />
          </label>
          <label className="six-field">
            <span>Feasible data sources</span>
            <textarea
              value={draft.feasibleDataSources}
              maxLength={8_000}
              disabled={props.disabled}
              placeholder="One source per line"
              onChange={(event) => update(
                "feasibleDataSources",
                event.target.value,
              )}
            />
          </label>
          <label className="six-field">
            <span>Known alternative accounts</span>
            <textarea
              value={draft.knownAlternativeAccounts}
              maxLength={8_000}
              disabled={props.disabled}
              placeholder="One alternative per line"
              onChange={(event) => update(
                "knownAlternativeAccounts",
                event.target.value,
              )}
            />
          </label>
        </div>
        <p className="six-policy-qualification">
          Prior-results disclosure: {readable(props.study.resultsPreviouslyInspected)}.
          Change this only through the saved study context so later revisions
          remain visible.
        </p>
        <div className="six-actions">
          <button
            type="submit"
            className="six-primary"
            disabled={props.disabled ||
              (draft.explanationMode === "stated" &&
                !draft.explanation.trim())}
          >
            {plan ? "Save revised literature plan" : "Save literature plan"}
          </button>
          <small>
            Saving records the plan only. Provider queries, full-text review,
            mechanism analysis, and researcher decisions remain separate steps.
          </small>
        </div>
      </form>
    </>
  );
}
