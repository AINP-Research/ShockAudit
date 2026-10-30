import {
  useState,
  type FormEvent,
} from "react";

import { fingerprintSixScreenValue } from
  "../../core/six-screen/canonical";
import type {
  Screen6DiagnosticCard,
  Screen6DiagnosticPlanInput,
  Screen6ResearcherReportedConcern,
} from "../../core/six-screen/screen6-diagnostic-plan";
import type {
  Screen6DiagnosticResult,
  Screen6DiagnosticResultConsideration,
  Screen6DiagnosticResultInput,
  Screen6DiagnosticResultReview,
  Screen6DiagnosticResultReviewDecision,
} from "../../core/six-screen/screen6-diagnostic-result";
import type {
  Screen6ClaimBoundaryInput,
  Screen6ConditionalClaimBoundary,
  Screen6ResearchPlanningDisposition,
  Screen6ResearchPlanningDispositionDecision,
} from "../../core/six-screen/screen6-claim-boundary";
import {
  createScreen6ResearchExportBundle,
  type Screen6ResearchExport,
} from "../../core/six-screen/screen6-research-export";
import type {
  Screen6PrerequisiteReport,
} from "../../core/six-screen/workflow";
import type {
  Screen6UncertaintyWorkspace,
} from "../../worker/six-screen-workflow-runtime";

type DiagnosticInputDraft = {
  preStatus: "available" | "unavailable" | "not_assessed";
  preCount: string;
  preDescription: string;
  postStatus: "available" | "unavailable" | "not_assessed";
  postCount: string;
  postDescription: string;
  frequencyStatus: "known" | "not_assessed";
  outcomeFrequency: string;
  assignmentStatus: "described" | "not_assessed";
  assignmentDescription: string;
  timingPattern:
    | "single_time"
    | "staggered"
    | "rolling_or_continuous"
    | "not_assessed";
  dependence:
    | "independent_units"
    | "grouped_or_clustered"
    | "not_assessed";
  independentGroupCount: string;
  groupingVariables: string;
  variablesStatus: "available" | "none_identified" | "not_assessed";
  feasibleVariables: string;
  constraintsStatus: "reported" | "none_reported" | "not_assessed";
  practicalConstraints: string;
  reportedConcerns: Screen6ResearcherReportedConcern[];
};

type DiagnosticResultInputDraft = Omit<
  Screen6DiagnosticResultInput,
  "schemaVersion" | "inputFingerprint"
>;

type ResultDraft = {
  resultKind: "quantitative" | "qualitative_or_documentary";
  provenanceKind: "user_reported" | "imported_validated_artifact";
  sourceDescription: string;
  artifactId: string;
  artifactName: string;
  producer: string;
  methodName: string;
  methodVersion: string;
  generatedAt: string;
  payloadFingerprint: string;
  summary: string;
  reportedStatistics: string;
  covarianceStatus: "supplied" | "not_supplied" | "not_applicable";
  covarianceDimension: string;
  covarianceValues: string;
  uncertaintyStatus: Screen6DiagnosticResultConsideration["status"];
  uncertaintyDescription: string;
  specificationContext: string;
  powerStatus: Screen6DiagnosticResultConsideration["status"];
  powerDescription: string;
  multipleTestingStatus: Screen6DiagnosticResultConsideration["status"];
  multipleTestingDescription: string;
  sampleCompositionStatus: Screen6DiagnosticResultConsideration["status"];
  sampleCompositionDescription: string;
  precisionStatus: Screen6DiagnosticResultConsideration["status"];
  precisionDescription: string;
  postInspectionStatus: "reported" | "none_reported" | "not_assessed";
  postInspectionDescription: string;
};

const CONCERNS: Array<{
  id: Screen6ResearcherReportedConcern;
  label: string;
}> = [
  {
    id: "remaining_trend_concern",
    label: "Remaining counterfactual-trend concern",
  },
  {
    id: "announcement_before_implementation",
    label: "Announcement or information exposure before implementation",
  },
  { id: "staggered_adoption", label: "Staggered adoption or eligibility" },
  { id: "relevant_coevent", label: "Potentially relevant co-event" },
  {
    id: "comparison_contamination",
    label: "Comparison contamination or spillovers",
  },
  {
    id: "package_component_ambiguity",
    label: "Package or component ambiguity",
  },
  {
    id: "outcome_or_sample_discontinuity",
    label: "Outcome or sample discontinuity",
  },
  { id: "proposed_negative_control", label: "Proposed negative control" },
  {
    id: "group_level_assignment_or_dependence",
    label: "Group-level assignment or dependence",
  },
  { id: "unique_mechanism_claim", label: "Unique mechanism claim" },
];

function emptyDraft(): DiagnosticInputDraft {
  return {
    preStatus: "not_assessed",
    preCount: "",
    preDescription: "",
    postStatus: "not_assessed",
    postCount: "",
    postDescription: "",
    frequencyStatus: "not_assessed",
    outcomeFrequency: "",
    assignmentStatus: "not_assessed",
    assignmentDescription: "",
    timingPattern: "not_assessed",
    dependence: "not_assessed",
    independentGroupCount: "",
    groupingVariables: "",
    variablesStatus: "not_assessed",
    feasibleVariables: "",
    constraintsStatus: "not_assessed",
    practicalConstraints: "",
    reportedConcerns: [],
  };
}

function list(value: string) {
  return value.split(/[\n,]/u).map((item) => item.trim()).filter(Boolean);
}

function nullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function integer(value: string) {
  return value.trim() ? Number.parseInt(value, 10) : null;
}

function emptyResultDraft(card: Screen6DiagnosticCard): ResultDraft {
  const quantitative = card.category === "statistical_test" ||
    card.category === "sensitivity_analysis";
  return {
    resultKind: quantitative ? "quantitative" : "qualitative_or_documentary",
    provenanceKind: "user_reported",
    sourceDescription: "Researcher-entered result from the stated analysis",
    artifactId: "",
    artifactName: "",
    producer: "",
    methodName: "",
    methodVersion: "",
    generatedAt: "",
    payloadFingerprint: "",
    summary: "",
    reportedStatistics: "",
    covarianceStatus: quantitative ? "not_supplied" : "not_applicable",
    covarianceDimension: "",
    covarianceValues: "",
    uncertaintyStatus: "not_assessed",
    uncertaintyDescription: "",
    specificationContext: "",
    powerStatus: "not_assessed",
    powerDescription: "",
    multipleTestingStatus: "not_assessed",
    multipleTestingDescription: "",
    sampleCompositionStatus: "not_assessed",
    sampleCompositionDescription: "",
    precisionStatus: "not_assessed",
    precisionDescription: "",
    postInspectionStatus: "not_assessed",
    postInspectionDescription: "",
  };
}

function requiredNumber(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function optionalNumber(value: string, label: string) {
  return value.trim() ? requiredNumber(value, label) : null;
}

function consideration(
  status: Screen6DiagnosticResultConsideration["status"],
  description: string,
): Screen6DiagnosticResultConsideration {
  return {
    status,
    description: status === "not_assessed" ? null : nullable(description),
  };
}

function reportedStatistics(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map(
    (line, index) => {
      const [label = "", estimate = "", standardError = "", lower = "",
        upper = "", pValue = ""] = line.split("|").map((item) =>
        item.trim()
      );
      if (!label) throw new Error(`Statistic row ${index + 1} needs a label.`);
      if (Boolean(lower) !== Boolean(upper)) {
        throw new Error(
          `Statistic row ${index + 1} needs both confidence bounds or neither.`,
        );
      }
      return {
        label,
        estimate: requiredNumber(estimate, `Statistic row ${index + 1} estimate`),
        standardError: optionalNumber(
          standardError,
          `Statistic row ${index + 1} standard error`,
        ),
        confidenceInterval: lower && upper
          ? {
              levelPercent: 95,
              lower: requiredNumber(lower, `Statistic row ${index + 1} lower bound`),
              upper: requiredNumber(upper, `Statistic row ${index + 1} upper bound`),
            }
          : null,
        pValue: optionalNumber(pValue, `Statistic row ${index + 1} p-value`),
      };
    },
  );
}

function diagnosticResultInput(draft: ResultDraft): DiagnosticResultInputDraft {
  const quantitative = draft.resultKind === "quantitative";
  const statistics = quantitative
    ? reportedStatistics(draft.reportedStatistics)
    : [];
  const covarianceStatus = quantitative
    ? draft.covarianceStatus
    : "not_applicable" as const;
  const resultPayload = {
    resultKind: draft.resultKind,
    summary: draft.summary.trim(),
    reportedStatistics: statistics,
    covariance: {
      status: covarianceStatus,
      dimension: covarianceStatus === "supplied"
        ? requiredNumber(draft.covarianceDimension, "Covariance dimension")
        : null,
      values: covarianceStatus === "supplied"
        ? draft.covarianceValues.split(/[\s,]+/u).filter(Boolean).map(
            (value) => requiredNumber(value, "Covariance entry"),
          )
        : [],
    },
    uncertaintyContext: consideration(
      draft.uncertaintyStatus,
      draft.uncertaintyDescription,
    ),
    specificationContext: draft.specificationContext.trim(),
    power: consideration(draft.powerStatus, draft.powerDescription),
    multipleTesting: consideration(
      draft.multipleTestingStatus,
      draft.multipleTestingDescription,
    ),
    sampleComposition: consideration(
      draft.sampleCompositionStatus,
      draft.sampleCompositionDescription,
    ),
    precision: consideration(draft.precisionStatus, draft.precisionDescription),
    postInspectionChange: {
      status: draft.postInspectionStatus,
      description: draft.postInspectionStatus === "reported"
        ? nullable(draft.postInspectionDescription)
        : null,
    },
  };
  const provenance: DiagnosticResultInputDraft["provenance"] =
    draft.provenanceKind === "user_reported"
      ? {
          kind: "user_reported",
          sourceDescription: draft.sourceDescription.trim(),
        }
      : {
          kind: "imported_validated_artifact",
          artifact: {
            schemaVersion: "screen-06-diagnostic-import-artifact-v1",
            artifactId: draft.artifactId.trim(),
            artifactName: draft.artifactName.trim(),
            producer: draft.producer.trim(),
            methodName: draft.methodName.trim(),
            methodVersion: draft.methodVersion.trim(),
            generatedAt: new Date(draft.generatedAt).toISOString(),
            payloadFingerprint: draft.payloadFingerprint.trim(),
          },
        };
  return { ...resultPayload, provenance };
}

function draftFromInput(
  input: Screen6DiagnosticPlanInput | null,
): DiagnosticInputDraft {
  if (!input) return emptyDraft();
  return {
    preStatus: input.preTreatmentPeriods.status,
    preCount: input.preTreatmentPeriods.count === null
      ? ""
      : String(input.preTreatmentPeriods.count),
    preDescription: input.preTreatmentPeriods.description ?? "",
    postStatus: input.postTreatmentPeriods.status,
    postCount: input.postTreatmentPeriods.count === null
      ? ""
      : String(input.postTreatmentPeriods.count),
    postDescription: input.postTreatmentPeriods.description ?? "",
    frequencyStatus: input.outcomeFrequency.status,
    outcomeFrequency: input.outcomeFrequency.value ?? "",
    assignmentStatus: input.assignmentStructure.status,
    assignmentDescription: input.assignmentStructure.description ?? "",
    timingPattern: input.assignmentStructure.timingPattern,
    dependence: input.assignmentStructure.dependence,
    independentGroupCount:
      input.assignmentStructure.independentGroupCount === null
        ? ""
        : String(input.assignmentStructure.independentGroupCount),
    groupingVariables: input.assignmentStructure.groupingVariables.join(", "),
    variablesStatus: input.feasibleDiagnosticVariables.status,
    feasibleVariables: input.feasibleDiagnosticVariables.values.join(", "),
    constraintsStatus: input.practicalConstraints.status,
    practicalConstraints: input.practicalConstraints.values.join("\n"),
    reportedConcerns: [...input.reportedConcerns],
  };
}

function planInput(
  draft: DiagnosticInputDraft,
): Omit<Screen6DiagnosticPlanInput, "schemaVersion" | "inputFingerprint"> {
  const assignmentDescribed = draft.assignmentStatus === "described";
  const grouped = assignmentDescribed &&
    draft.dependence === "grouped_or_clustered";
  return {
    preTreatmentPeriods: {
      status: draft.preStatus,
      count: draft.preStatus === "available"
        ? integer(draft.preCount)
        : draft.preStatus === "unavailable" ? 0 : null,
      description: draft.preStatus === "not_assessed"
        ? null
        : nullable(draft.preDescription),
    },
    postTreatmentPeriods: {
      status: draft.postStatus,
      count: draft.postStatus === "available"
        ? integer(draft.postCount)
        : draft.postStatus === "unavailable" ? 0 : null,
      description: draft.postStatus === "not_assessed"
        ? null
        : nullable(draft.postDescription),
    },
    outcomeFrequency: {
      status: draft.frequencyStatus,
      value: draft.frequencyStatus === "known"
        ? nullable(draft.outcomeFrequency)
        : null,
    },
    assignmentStructure: {
      status: draft.assignmentStatus,
      description: assignmentDescribed
        ? nullable(draft.assignmentDescription)
        : null,
      timingPattern: assignmentDescribed
        ? draft.timingPattern
        : "not_assessed",
      dependence: assignmentDescribed
        ? draft.dependence
        : "not_assessed",
      independentGroupCount: grouped
        ? integer(draft.independentGroupCount)
        : null,
      groupingVariables: grouped ? list(draft.groupingVariables) : [],
    },
    feasibleDiagnosticVariables: {
      status: draft.variablesStatus,
      values: draft.variablesStatus === "available"
        ? list(draft.feasibleVariables)
        : [],
    },
    practicalConstraints: {
      status: draft.constraintsStatus,
      values: draft.constraintsStatus === "reported"
        ? list(draft.practicalConstraints)
        : [],
    },
    reportedConcerns: [...draft.reportedConcerns],
  };
}

function DiagnosticInputForm(props: {
  initialInput: Screen6DiagnosticPlanInput | null;
  disabled: boolean;
  canSave: boolean;
  onSave: (
    input: Omit<
      Screen6DiagnosticPlanInput,
      "schemaVersion" | "inputFingerprint"
    >,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftFromInput(props.initialInput));
  const update = <K extends keyof DiagnosticInputDraft>(
    name: K,
    value: DiagnosticInputDraft[K],
  ) => setDraft((current) => ({ ...current, [name]: value }));
  const toggleConcern = (id: Screen6ResearcherReportedConcern) => {
    update(
      "reportedConcerns",
      draft.reportedConcerns.includes(id)
        ? draft.reportedConcerns.filter((value) => value !== id)
        : [...draft.reportedConcerns, id],
    );
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onSave(planInput(draft));
  }
  return (
    <form className="six-policy-plan" onSubmit={(event) => void submit(event)}>
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Researcher-owned inputs</p>
          <h3>Plan the identification challenges</h3>
        </div>
        <span>No results requested</span>
      </div>
      <p>
        Record what is actually available. “Not assessed” remains a visible gap;
        it is never interpreted as favorable evidence.
      </p>

      <fieldset className="six-fieldset">
        <legend>Available periods</legend>
        <div className="six-field-grid">
          <label className="six-field">
            <span>Pre-treatment availability</span>
            <select
              value={draft.preStatus}
              onChange={(event) => update(
                "preStatus",
                event.target.value as DiagnosticInputDraft["preStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <label className="six-field">
            <span>Number of pre-treatment periods</span>
            <input
              type="number"
              min="1"
              max="10000"
              required={draft.preStatus === "available"}
              disabled={draft.preStatus !== "available"}
              value={draft.preCount}
              onChange={(event) => update("preCount", event.target.value)}
            />
          </label>
          <label className="six-field">
            <span>Pre-treatment period summary</span>
            <input
              type="text"
              maxLength={1_000}
              disabled={draft.preStatus === "not_assessed"}
              value={draft.preDescription}
              onChange={(event) => update(
                "preDescription",
                event.target.value,
              )}
              placeholder="For example, 2016–2019"
            />
          </label>
          <label className="six-field">
            <span>Post-treatment availability</span>
            <select
              value={draft.postStatus}
              onChange={(event) => update(
                "postStatus",
                event.target.value as DiagnosticInputDraft["postStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <label className="six-field">
            <span>Number of post-treatment periods</span>
            <input
              type="number"
              min="1"
              max="10000"
              required={draft.postStatus === "available"}
              disabled={draft.postStatus !== "available"}
              value={draft.postCount}
              onChange={(event) => update("postCount", event.target.value)}
            />
          </label>
          <label className="six-field">
            <span>Post-treatment period summary</span>
            <input
              type="text"
              maxLength={1_000}
              disabled={draft.postStatus === "not_assessed"}
              value={draft.postDescription}
              onChange={(event) => update(
                "postDescription",
                event.target.value,
              )}
              placeholder="For example, 2020–2023"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="six-fieldset">
        <legend>Outcome and assignment structure</legend>
        <div className="six-field-grid">
          <label className="six-field">
            <span>Outcome frequency status</span>
            <select
              value={draft.frequencyStatus}
              onChange={(event) => update(
                "frequencyStatus",
                event.target.value as DiagnosticInputDraft["frequencyStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="known">Known</option>
            </select>
          </label>
          <label className="six-field">
            <span>Outcome frequency</span>
            <input
              type="text"
              maxLength={500}
              required={draft.frequencyStatus === "known"}
              disabled={draft.frequencyStatus !== "known"}
              value={draft.outcomeFrequency}
              onChange={(event) => update(
                "outcomeFrequency",
                event.target.value,
              )}
              placeholder="For example, monthly"
            />
          </label>
          <label className="six-field">
            <span>Assignment structure status</span>
            <select
              value={draft.assignmentStatus}
              onChange={(event) => update(
                "assignmentStatus",
                event.target.value as DiagnosticInputDraft["assignmentStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="described">Described</option>
            </select>
          </label>
          <label className="six-field">
            <span>Assignment or group structure</span>
            <input
              type="text"
              maxLength={2_000}
              required={draft.assignmentStatus === "described"}
              disabled={draft.assignmentStatus !== "described"}
              value={draft.assignmentDescription}
              onChange={(event) => update(
                "assignmentDescription",
                event.target.value,
              )}
              placeholder="State where policy exposure varies"
            />
          </label>
          <label className="six-field">
            <span>Assignment timing</span>
            <select
              disabled={draft.assignmentStatus !== "described"}
              value={draft.timingPattern}
              onChange={(event) => update(
                "timingPattern",
                event.target.value as DiagnosticInputDraft["timingPattern"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="single_time">Single time</option>
              <option value="staggered">Staggered</option>
              <option value="rolling_or_continuous">Rolling or continuous</option>
            </select>
          </label>
          <label className="six-field">
            <span>Dependence structure</span>
            <select
              disabled={draft.assignmentStatus !== "described"}
              value={draft.dependence}
              onChange={(event) => update(
                "dependence",
                event.target.value as DiagnosticInputDraft["dependence"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="independent_units">Independent units</option>
              <option value="grouped_or_clustered">Grouped or clustered</option>
            </select>
          </label>
          <label className="six-field">
            <span>Independent group count</span>
            <input
              type="number"
              min="1"
              max="1000000"
              disabled={draft.dependence !== "grouped_or_clustered"}
              value={draft.independentGroupCount}
              onChange={(event) => update(
                "independentGroupCount",
                event.target.value,
              )}
            />
          </label>
          <label className="six-field">
            <span>Grouping variables</span>
            <input
              type="text"
              maxLength={2_000}
              disabled={draft.dependence !== "grouped_or_clustered"}
              value={draft.groupingVariables}
              onChange={(event) => update(
                "groupingVariables",
                event.target.value,
              )}
              placeholder="Comma-separated"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="six-fieldset">
        <legend>Feasibility and constraints</legend>
        <div className="six-field-grid">
          <label className="six-field">
            <span>Diagnostic-variable status</span>
            <select
              value={draft.variablesStatus}
              onChange={(event) => update(
                "variablesStatus",
                event.target.value as DiagnosticInputDraft["variablesStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="available">Variables available</option>
              <option value="none_identified">None identified</option>
            </select>
          </label>
          <label className="six-field">
            <span>Feasible diagnostic variables</span>
            <textarea
              maxLength={8_000}
              required={draft.variablesStatus === "available"}
              disabled={draft.variablesStatus !== "available"}
              value={draft.feasibleVariables}
              onChange={(event) => update(
                "feasibleVariables",
                event.target.value,
              )}
              placeholder="Comma- or line-separated"
            />
          </label>
          <label className="six-field">
            <span>Constraint status</span>
            <select
              value={draft.constraintsStatus}
              onChange={(event) => update(
                "constraintsStatus",
                event.target.value as DiagnosticInputDraft["constraintsStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="reported">Constraints reported</option>
              <option value="none_reported">No constraints reported</option>
            </select>
          </label>
          <label className="six-field">
            <span>Practical constraints</span>
            <textarea
              maxLength={10_000}
              required={draft.constraintsStatus === "reported"}
              disabled={draft.constraintsStatus !== "reported"}
              value={draft.practicalConstraints}
              onChange={(event) => update(
                "practicalConstraints",
                event.target.value,
              )}
              placeholder="One constraint per line"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="six-fieldset">
        <legend>Concerns already identified by the researcher</legend>
        <p>
          Select only concerns you currently have. Leaving an item unchecked
          does not record that the concern is absent.
        </p>
        <div className="six-choice-grid">
          {CONCERNS.map((concern) => (
            <label key={concern.id} className="six-choice">
              <input
                type="checkbox"
                checked={draft.reportedConcerns.includes(concern.id)}
                onChange={() => toggleConcern(concern.id)}
              />
              <span>{concern.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="six-actions">
        <button
          type="submit"
          className="six-primary"
          disabled={props.disabled || !props.canSave}
        >
          {props.initialInput
            ? "Save revised diagnostic plan"
            : "Create planned diagnostic cards"}
        </button>
      </div>
      <small>
        This action uses fixed reviewed rules only. It makes no source request,
        model call, or diagnostic calculation.
      </small>
    </form>
  );
}

function ConsiderationControl(props: {
  label: string;
  status: Screen6DiagnosticResultConsideration["status"];
  description: string;
  onStatus: (value: Screen6DiagnosticResultConsideration["status"]) => void;
  onDescription: (value: string) => void;
}) {
  return (
    <div className="six-field-grid">
      <label className="six-field">
        <span>{props.label}</span>
        <select
          value={props.status}
          onChange={(event) => props.onStatus(
            event.target.value as Screen6DiagnosticResultConsideration["status"],
          )}
        >
          <option value="not_assessed">Not assessed</option>
          <option value="assessed">Assessed</option>
          <option value="not_applicable">Not applicable</option>
        </select>
      </label>
      <label className="six-field">
        <span>{props.label} context or applicability reason</span>
        <textarea
          maxLength={2_000}
          required={props.status !== "not_assessed"}
          disabled={props.status === "not_assessed"}
          value={props.description}
          onChange={(event) => props.onDescription(event.target.value)}
        />
      </label>
    </div>
  );
}

function DiagnosticResultForm(props: {
  card: Screen6DiagnosticCard;
  planFingerprint: string;
  disabled: boolean;
  canRecord: boolean;
  revisionOf: Screen6DiagnosticResult | null;
  onRecord: (input: {
    cardId: string;
    expectedPlanFingerprint: string;
    expectedCardFingerprint: string;
    resultInput: DiagnosticResultInputDraft;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => emptyResultDraft(props.card));
  const [inputError, setInputError] = useState("");
  const update = <K extends keyof ResultDraft>(
    key: K,
    value: ResultDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInputError("");
    try {
      await props.onRecord({
        cardId: props.card.id,
        expectedPlanFingerprint: props.planFingerprint,
        expectedCardFingerprint: fingerprintSixScreenValue(props.card),
        resultInput: diagnosticResultInput(draft),
      });
    } catch (caught) {
      setInputError(caught instanceof Error ? caught.message : String(caught));
    }
  }
  const quantitative = draft.resultKind === "quantitative";
  return (
    <form className="six-fieldset" onSubmit={(event) => void submit(event)}>
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Researcher result intake</p>
          <h4>{props.revisionOf ? "Record an immutable result revision" : "Record a result"}</h4>
        </div>
        <span>No calculation will run</span>
      </div>
      <p>
        Enter only the result actually observed. Screenshots and pasted
        coefficients remain user-reported; import validation does not establish
        calculation reproducibility.
      </p>
      {inputError ? (
        <div className="six-alert six-alert--error" role="alert">
          {inputError}
        </div>
      ) : null}
      <div className="six-field-grid">
        <label className="six-field">
          <span>Result type</span>
          <select
            value={draft.resultKind}
            onChange={(event) => {
              const resultKind = event.target.value as ResultDraft["resultKind"];
              setDraft((current) => ({
                ...current,
                resultKind,
                covarianceStatus: resultKind === "quantitative"
                  ? "not_supplied"
                  : "not_applicable",
              }));
            }}
          >
            <option value="quantitative">Quantitative</option>
            <option value="qualitative_or_documentary">
              Qualitative or documentary
            </option>
          </select>
        </label>
        <label className="six-field">
          <span>Provenance</span>
          <select
            value={draft.provenanceKind}
            onChange={(event) => update(
              "provenanceKind",
              event.target.value as ResultDraft["provenanceKind"],
            )}
          >
            <option value="user_reported">User reported</option>
            <option value="imported_validated_artifact">
              Imported validated artifact
            </option>
          </select>
        </label>
      </div>

      {draft.provenanceKind === "user_reported" ? (
        <label className="six-field">
          <span>Source description</span>
          <textarea
            required
            maxLength={2_000}
            value={draft.sourceDescription}
            onChange={(event) => update("sourceDescription", event.target.value)}
          />
        </label>
      ) : (
        <fieldset className="six-fieldset">
          <legend>Imported artifact identity</legend>
          <div className="six-field-grid">
            {([
              ["artifactId", "Artifact ID"],
              ["artifactName", "Artifact name"],
              ["producer", "Producer"],
              ["methodName", "Method name"],
              ["methodVersion", "Method version"],
            ] as const).map(([key, label]) => (
              <label className="six-field" key={key}>
                <span>{label}</span>
                <input
                  required
                  type="text"
                  maxLength={key === "methodVersion" ? 200 : 500}
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
            <label className="six-field">
              <span>Artifact generated at</span>
              <input
                required
                type="datetime-local"
                value={draft.generatedAt}
                onChange={(event) => update("generatedAt", event.target.value)}
              />
            </label>
            <label className="six-field">
              <span>Embedded payload fingerprint</span>
              <input
                required
                type="text"
                pattern="fnv1a64:[0-9a-f]{16}"
                value={draft.payloadFingerprint}
                onChange={(event) => update(
                  "payloadFingerprint",
                  event.target.value,
                )}
              />
            </label>
          </div>
        </fieldset>
      )}

      <label className="six-field">
        <span>Result summary</span>
        <textarea
          required
          maxLength={4_000}
          value={draft.summary}
          onChange={(event) => update("summary", event.target.value)}
        />
      </label>

      {quantitative ? (
        <fieldset className="six-fieldset">
          <legend>Estimates and uncertainty</legend>
          <label className="six-field">
            <span>
              One statistic per line: label | estimate | standard error |
              95% lower | 95% upper | p-value
            </span>
            <textarea
              required
              maxLength={12_000}
              value={draft.reportedStatistics}
              onChange={(event) => update(
                "reportedStatistics",
                event.target.value,
              )}
              placeholder="Lead -1 | 0.04 | 0.03 | -0.02 | 0.10 | 0.18"
            />
          </label>
          <div className="six-field-grid">
            <label className="six-field">
              <span>Covariance matrix</span>
              <select
                value={draft.covarianceStatus}
                onChange={(event) => update(
                  "covarianceStatus",
                  event.target.value as ResultDraft["covarianceStatus"],
                )}
              >
                <option value="not_supplied">Not supplied</option>
                <option value="supplied">Supplied</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </label>
            <label className="six-field">
              <span>Matrix dimension</span>
              <input
                type="number"
                min="1"
                max="20"
                required={draft.covarianceStatus === "supplied"}
                disabled={draft.covarianceStatus !== "supplied"}
                value={draft.covarianceDimension}
                onChange={(event) => update(
                  "covarianceDimension",
                  event.target.value,
                )}
              />
            </label>
          </div>
          <label className="six-field">
            <span>Row-major covariance values</span>
            <textarea
              required={draft.covarianceStatus === "supplied"}
              disabled={draft.covarianceStatus !== "supplied"}
              value={draft.covarianceValues}
              onChange={(event) => update(
                "covarianceValues",
                event.target.value,
              )}
              placeholder="0.01, 0, 0, 0.02"
            />
          </label>
        </fieldset>
      ) : null}

      <label className="six-field">
        <span>Specification context</span>
        <textarea
          required
          maxLength={4_000}
          value={draft.specificationContext}
          onChange={(event) => update(
            "specificationContext",
            event.target.value,
          )}
        />
      </label>

      <fieldset className="six-fieldset">
        <legend>Interpretive context</legend>
        <ConsiderationControl
          label="Uncertainty"
          status={draft.uncertaintyStatus}
          description={draft.uncertaintyDescription}
          onStatus={(value) => update("uncertaintyStatus", value)}
          onDescription={(value) => update("uncertaintyDescription", value)}
        />
        <ConsiderationControl
          label="Power"
          status={draft.powerStatus}
          description={draft.powerDescription}
          onStatus={(value) => update("powerStatus", value)}
          onDescription={(value) => update("powerDescription", value)}
        />
        <ConsiderationControl
          label="Multiple testing"
          status={draft.multipleTestingStatus}
          description={draft.multipleTestingDescription}
          onStatus={(value) => update("multipleTestingStatus", value)}
          onDescription={(value) => update("multipleTestingDescription", value)}
        />
        <ConsiderationControl
          label="Sample composition"
          status={draft.sampleCompositionStatus}
          description={draft.sampleCompositionDescription}
          onStatus={(value) => update("sampleCompositionStatus", value)}
          onDescription={(value) => update(
            "sampleCompositionDescription",
            value,
          )}
        />
        <ConsiderationControl
          label="Precision"
          status={draft.precisionStatus}
          description={draft.precisionDescription}
          onStatus={(value) => update("precisionStatus", value)}
          onDescription={(value) => update("precisionDescription", value)}
        />
      </fieldset>

      <fieldset className="six-fieldset">
        <legend>Changes after inspecting results</legend>
        <div className="six-field-grid">
          <label className="six-field">
            <span>Change status</span>
            <select
              value={draft.postInspectionStatus}
              onChange={(event) => update(
                "postInspectionStatus",
                event.target.value as ResultDraft["postInspectionStatus"],
              )}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="none_reported">None reported</option>
              <option value="reported">Change reported</option>
            </select>
          </label>
          <label className="six-field">
            <span>Design, sample, measure, or theory change</span>
            <textarea
              required={draft.postInspectionStatus === "reported"}
              disabled={draft.postInspectionStatus !== "reported"}
              maxLength={2_000}
              value={draft.postInspectionDescription}
              onChange={(event) => update(
                "postInspectionDescription",
                event.target.value,
              )}
            />
          </label>
        </div>
      </fieldset>

      <div className="six-actions">
        <button
          type="submit"
          className="six-primary"
          disabled={props.disabled || !props.canRecord}
        >
          {props.revisionOf ? "Record result revision" : "Record result"}
        </button>
      </div>
      <small>
        This action records supplied evidence only. It performs zero network,
        model, or local diagnostic-routine calls.
      </small>
    </form>
  );
}

function ResultReviewForm(props: {
  result: Screen6DiagnosticResult;
  disabled: boolean;
  canReview: boolean;
  onReview: (input: {
    resultId: string;
    expectedResultFingerprint: string;
    decision: Screen6DiagnosticResultReviewDecision;
    rationale: string;
    followUpActions: string[];
  }) => Promise<void>;
}) {
  const [decision, setDecision] = useState<
    Screen6DiagnosticResultReviewDecision
  >("inconclusive");
  const [rationale, setRationale] = useState("");
  const [followUpActions, setFollowUpActions] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onReview({
      resultId: props.result.id,
      expectedResultFingerprint: props.result.resultFingerprint,
      decision,
      rationale: rationale.trim(),
      followUpActions: list(followUpActions),
    });
  }
  return (
    <form onSubmit={(event) => void submit(event)}>
      <fieldset className="six-fieldset">
        <legend>Separate researcher interpretation</legend>
      <div className="six-field-grid">
        <label className="six-field">
          <span>Interpretation</span>
          <select
            value={decision}
            onChange={(event) => setDecision(
              event.target.value as Screen6DiagnosticResultReviewDecision,
            )}
          >
            <option
              value="concern_reduced"
              disabled={props.result.reviewReadiness.status !==
                "complete_for_researcher_review"}
            >
              Concern reduced
            </option>
            <option value="inconclusive">Inconclusive</option>
            <option value="revision_needed">Revision needed</option>
          </select>
        </label>
        <label className="six-field">
          <span>Rationale</span>
          <textarea
            required
            maxLength={4_000}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
      </div>
      <label className="six-field">
        <span>Follow-up actions (one per line)</span>
        <textarea
          required={decision === "revision_needed"}
          maxLength={8_000}
          value={followUpActions}
          onChange={(event) => setFollowUpActions(event.target.value)}
        />
      </label>
      <div className="six-actions">
        <button
          type="submit"
          className="six-primary"
          disabled={props.disabled || !props.canReview}
        >
          Record interpretation
        </button>
      </div>
        <small>
          “Concern reduced” never proves an identifying assumption and is
          unavailable while required context remains incomplete.
        </small>
      </fieldset>
    </form>
  );
}

function DiagnosticResultRecord(props: {
  result: Screen6DiagnosticResult;
  review: Screen6DiagnosticResultReview | null;
}) {
  const { result, review } = props;
  return (
    <section className="six-fieldset" aria-label="Recorded diagnostic result">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Immutable supplied result</p>
          <h4>{result.provenance.displayLabel}</h4>
        </div>
        <span>{result.reviewReadiness.status.replaceAll("_", " ")}</span>
      </div>
      <p>{result.input.summary}</p>
      <dl>
        <div>
          <dt>Calculation reproducibility</dt>
          <dd>{result.provenance.calculationReproducibility.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Artifact validation</dt>
          <dd>{result.provenance.artifactValidation.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Result payload fingerprint</dt>
          <dd>{result.resultPayloadFingerprint}</dd>
        </div>
        <div>
          <dt>Specification context</dt>
          <dd>{result.input.specificationContext}</dd>
        </div>
        <div>
          <dt>Reported estimates</dt>
          <dd>
            {result.input.reportedStatistics.length
              ? result.input.reportedStatistics.map((statistic) =>
                  `${statistic.label}: ${statistic.estimate}`).join("; ")
              : "No quantitative estimate supplied."}
          </dd>
        </div>
        <div>
          <dt>Interpretation</dt>
          <dd>{review ? review.decision.replaceAll("_", " ") : "Awaiting researcher review"}</dd>
        </div>
      </dl>
      {result.reviewReadiness.gaps.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Context gaps block a reduced-concern interpretation</strong>
          <ul>
            {result.reviewReadiness.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      ) : null}
      {review ? (
        <div className="six-alert">
          <strong>Researcher review: {review.decision.replaceAll("_", " ")}</strong>
          <p>{review.rationale}</p>
          {review.followUpActions.length ? (
            <ul>{review.followUpActions.map((action) => <li key={action}>{action}</li>)}</ul>
          ) : null}
          <small>{review.claimBoundary}</small>
        </div>
      ) : null}
      <small>{result.claimBoundary}</small>
    </section>
  );
}

function DiagnosticCard(props: {
  card: Screen6DiagnosticCard;
  planFingerprint: string;
  result: Screen6DiagnosticResult | null;
  review: Screen6DiagnosticResultReview | null;
  disabled: boolean;
  canRecord: boolean;
  canReview: boolean;
  onRecord: (input: {
    cardId: string;
    expectedPlanFingerprint: string;
    expectedCardFingerprint: string;
    resultInput: DiagnosticResultInputDraft;
  }) => Promise<void>;
  onReview: (input: {
    resultId: string;
    expectedResultFingerprint: string;
    decision: Screen6DiagnosticResultReviewDecision;
    rationale: string;
    followUpActions: string[];
  }) => Promise<void>;
}) {
  const card = props.card;
  return (
    <article
      className="six-policy-plan six-diagnostic-card"
      data-status={card.status}
    >
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">
            Priority {card.priorityRank} · {card.category.replaceAll("_", " ")}
          </p>
          <h3>{card.label}</h3>
        </div>
        <span>
          {card.blocking ? "Blocking concern" : "Priority"} · {props.result
            ? props.review ? props.review.decision.replaceAll("_", " ") : "review pending"
            : "planned"}
        </span>
      </div>
      <p><strong>Why triggered:</strong> {card.triggerReasons.join(" ")}</p>
      <dl>
        <div>
          <dt>Exact concern</dt>
          <dd>{card.exactConcern}</dd>
        </div>
        <div>
          <dt>Policy, design, or co-event basis</dt>
          <dd>{card.policyDesignOrCoEventBasis}</dd>
        </div>
        <div>
          <dt>Required data</dt>
          <dd>{card.requiredData.join("; ")}</dd>
        </div>
        <div>
          <dt>Procedure</dt>
          <dd>{card.procedure.join(" ")}</dd>
        </div>
        <div>
          <dt>Patterns that would raise concern</dt>
          <dd>{card.patternsRaisingConcern.join("; ")}</dd>
        </div>
        <div>
          <dt>Alternative explanations</dt>
          <dd>{card.alternativeExplanations.join("; ")}</dd>
        </div>
        <div>
          <dt>Response if concern remains</dt>
          <dd>{card.responseIfConcernRemains.join("; ")}</dd>
        </div>
        <div>
          <dt>Interpretive limits</dt>
          <dd>{card.interpretiveLimits.join(" ")}</dd>
        </div>
        <div>
          <dt>Method references</dt>
          <dd>{card.sourceReferences.join(", ")}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>
            {props.result
              ? "A provenance-explicit result is retained below."
              : "Not supplied or calculated. This card is planned only."}
          </dd>
        </div>
      </dl>
      {card.missingPrerequisites.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Evidence still needed</strong>
          <ul>
            {card.missingPrerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.result ? (
        <>
          <DiagnosticResultRecord result={props.result} review={props.review} />
          {!props.review ? (
            <ResultReviewForm
              result={props.result}
              disabled={props.disabled}
              canReview={props.canReview}
              onReview={props.onReview}
            />
          ) : null}
          <details>
            <summary>Record a later immutable result revision</summary>
            <DiagnosticResultForm
              key={props.result.id}
              card={card}
              planFingerprint={props.planFingerprint}
              disabled={props.disabled}
              canRecord={props.canRecord}
              revisionOf={props.result}
              onRecord={props.onRecord}
            />
          </details>
        </>
      ) : (
        <DiagnosticResultForm
          card={card}
          planFingerprint={props.planFingerprint}
          disabled={props.disabled}
          canRecord={props.canRecord}
          revisionOf={null}
          onRecord={props.onRecord}
        />
      )}
    </article>
  );
}

type ClaimBoundaryInputDraft = Omit<
  Screen6ClaimBoundaryInput,
  "schemaVersion" | "inputFingerprint"
>;

function ClaimBoundaryForm(props: {
  planFingerprint: string;
  initialInput: ClaimBoundaryInputDraft;
  disabled: boolean;
  canSave: boolean;
  onSave: (input: {
    expectedPlanFingerprint: string;
    claimInput: ClaimBoundaryInputDraft;
  }) => Promise<void>;
}) {
  const [intendedClaimLevel, setIntendedClaimLevel] = useState(
    props.initialInput.intendedClaimLevel,
  );
  const [targetDescription, setTargetDescription] = useState(
    props.initialInput.targetDescription,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    void props.onSave({
      expectedPlanFingerprint: props.planFingerprint,
      claimInput: {
        intendedClaimLevel,
        targetDescription: targetDescription.trim(),
      },
    });
  }
  return (
    <form onSubmit={submit} aria-label="Conditional claim boundary form">
      <fieldset className="six-fieldset" disabled={props.disabled}>
        <legend>Define the intended claim</legend>
        <p>
          Choose the claim level the study is intended to support. The saved
          statement remains prospective and will retain every current gap.
        </p>
        <div className="six-form-grid">
          <label className="six-field">
            <span>Intended claim level</span>
            <select
              value={intendedClaimLevel}
              onChange={(event) => setIntendedClaimLevel(
                event.target.value as ClaimBoundaryInputDraft[
                  "intendedClaimLevel"
                ],
              )}
            >
              <option value="package_effect">Package effect</option>
              <option value="component_specific_effect">
                Component-specific effect
              </option>
              <option value="mechanism_specific_effect">
                Mechanism-specific effect
              </option>
            </select>
          </label>
          <label className="six-field">
            <span>Target to place after “intended to estimate”</span>
            <textarea
              required
              maxLength={2_000}
              value={targetDescription}
              onChange={(event) => setTargetDescription(event.target.value)}
              placeholder="the effect of legal eligibility for the policy package on the stated outcome"
            />
          </label>
        </div>
        <div className="six-actions">
          <button
            type="submit"
            className="six-primary"
            disabled={!props.canSave || !targetDescription.trim()}
          >
            Save conditional claim boundary
          </button>
        </div>
        <small>
          Saving this boundary does not state that the policy caused the
          outcome and does not create a score, certificate, or final export.
        </small>
      </fieldset>
    </form>
  );
}

function ResearchPlanningDispositionForm(props: {
  boundary: Screen6ConditionalClaimBoundary;
  disabled: boolean;
  canRecord: boolean;
  onRecord: (input: {
    expectedBoundaryFingerprint: string;
    decision: Screen6ResearchPlanningDispositionDecision;
    rationale: string;
    specifiedRevisions: string[];
  }) => Promise<void>;
}) {
  const [decision, setDecision] = useState<
    Screen6ResearchPlanningDispositionDecision | ""
  >("");
  const [rationale, setRationale] = useState("");
  const [specifiedRevisions, setSpecifiedRevisions] = useState("");
  const canProceed = props.boundary.intendedClaim.relationshipToCurrentDesign ===
    "matches_current_design_target";
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!decision) return;
    void props.onRecord({
      expectedBoundaryFingerprint: props.boundary.boundaryFingerprint,
      decision,
      rationale: rationale.trim(),
      specifiedRevisions: decision === "revise_specified_parts_first"
        ? list(specifiedRevisions)
        : [],
    });
  }
  return (
    <form onSubmit={submit} aria-label="Research planning disposition form">
      <fieldset className="six-fieldset" disabled={props.disabled}>
        <legend>Record the research-planning disposition</legend>
        <div className="six-form-grid">
          <label className="six-field">
            <span>Disposition</span>
            <select
              required
              value={decision}
              onChange={(event) => setDecision(
                event.target.value as
                  Screen6ResearchPlanningDispositionDecision | "",
              )}
            >
              <option value="">Choose a disposition</option>
              <option
                value="proceed_with_documented_analysis_plan"
                disabled={!canProceed}
              >
                Proceed with the documented analysis plan
              </option>
              <option value="revise_specified_parts_first">
                Revise specified parts first
              </option>
              <option value="current_information_insufficient_for_intended_claim">
                Current information is insufficient for the intended claim
              </option>
            </select>
          </label>
          <label className="six-field">
            <span>Rationale</span>
            <textarea
              required
              maxLength={4_000}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
            />
          </label>
        </div>
        {decision === "revise_specified_parts_first" ? (
          <label className="six-field">
            <span>Specified revisions (one per line)</span>
            <textarea
              required
              maxLength={10_000}
              value={specifiedRevisions}
              onChange={(event) => setSpecifiedRevisions(event.target.value)}
            />
          </label>
        ) : null}
        {!canProceed ? (
          <div className="six-alert six-alert--warning">
            “Proceed” is unavailable because the intended claim does not match
            a current established design target. Revise the target or record
            revision needed or insufficient information.
          </div>
        ) : null}
        <div className="six-actions">
          <button
            type="submit"
            className="six-primary"
            disabled={
              !props.canRecord || !decision || !rationale.trim() ||
              (decision === "revise_specified_parts_first" &&
                !specifiedRevisions.trim())
            }
          >
            Record planning disposition
          </button>
        </div>
        <small>
          This is a research-planning recommendation, not causal
          certification. It will not change the design automatically.
        </small>
      </fieldset>
    </form>
  );
}

function ConditionalClaimBoundaryRecord(props: {
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition | null;
  disabled: boolean;
  canRecordDisposition: boolean;
  onRecordDisposition: (input: {
    expectedBoundaryFingerprint: string;
    decision: Screen6ResearchPlanningDispositionDecision;
    rationale: string;
    specifiedRevisions: string[];
  }) => Promise<void>;
}) {
  const { boundary, disposition } = props;
  return (
    <section className="six-policy-plan" aria-label="Conditional claim boundary">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Prospective conditional boundary</p>
          <h3>{boundary.intendedClaim.claimLevel.replaceAll("_", " ")}</h3>
        </div>
        <span>
          {boundary.intendedClaim.relationshipToCurrentDesign.replaceAll("_", " ")}
        </span>
      </div>
      <div className="six-alert">
        <strong>Permitted prospective statement</strong>
        <p>{boundary.intendedClaim.prospectiveStatement}</p>
      </div>
      <dl>
        <div>
          <dt>Current design target</dt>
          <dd>{boundary.currentDesignTarget.basis}</dd>
        </div>
        <div>
          <dt>Attribution ceiling</dt>
          <dd>{boundary.intendedClaim.attributionCeiling}</dd>
        </div>
        <div>
          <dt>Results-aware</dt>
          <dd>{boundary.intendedClaim.resultsAware ? "Yes" : "No diagnostic result supplied"}</dd>
        </div>
        <div>
          <dt>Method library</dt>
          <dd>{boundary.methodLibrary.version}</dd>
        </div>
      </dl>

      <section aria-label="Claim level requirements">
        <p className="six-kicker">What each claim level requires</p>
        <div className="six-policy-claims">
          {boundary.claimLevels.map((level) => (
            <article key={level.claimLevel}>
              <p className="six-kicker">
                {level.relationshipToCurrentDesign.replaceAll("_", " ")}
              </p>
              <h4>{level.claimLevel.replaceAll("_", " ")}</h4>
              <ul>
                {level.assumptionsOrEvidenceRequired.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {boundary.unassessedModules.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Unassessed or partial modules</strong>
          <ul>
            {boundary.unassessedModules.map((module) => (
              <li key={module.module}>
                {module.module.replaceAll("_", " ")}: {module.limitation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="six-alert six-alert--warning">
        <strong>
          {boundary.unresolvedHighConsequenceIssues.length} unresolved
          high-consequence issue{boundary.unresolvedHighConsequenceIssues.length === 1 ? "" : "s"}
        </strong>
        {boundary.unresolvedHighConsequenceIssues.length ? (
          <ul>
            {boundary.unresolvedHighConsequenceIssues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        ) : <p>None recorded in the current bounded lineage.</p>}
      </div>

      <details>
        <summary>Diagnostic status at this boundary</summary>
        <ul>
          {boundary.diagnosticStatuses.map((status) => (
            <li key={status.cardId}>
              <strong>{status.label}</strong>: {status.status.replaceAll("_", " ")}
              {status.reviewRationale ? ` — ${status.reviewRationale}` : ""}
            </li>
          ))}
        </ul>
      </details>

      {disposition ? (
        <div className="six-alert">
          <strong>
            Researcher disposition: {disposition.decision.replaceAll("_", " ")}
          </strong>
          <p>{disposition.rationale}</p>
          {disposition.specifiedRevisions.length ? (
            <ul>
              {disposition.specifiedRevisions.map((revision) => (
                <li key={revision}>{revision}</li>
              ))}
            </ul>
          ) : null}
          <small>{disposition.claimBoundary}</small>
        </div>
      ) : (
        <ResearchPlanningDispositionForm
          boundary={boundary}
          disabled={props.disabled}
          canRecord={props.canRecordDisposition}
          onRecord={props.onRecordDisposition}
        />
      )}
      <small>{boundary.claimBoundary}</small>
    </section>
  );
}

function downloadResearchExport(record: Screen6ResearchExport) {
  const bundle = createScreen6ResearchExportBundle(record);
  const blob = new Blob(
    [`${JSON.stringify(bundle, null, 2)}\n`],
    { type: "application/json" },
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `shockaudit-${record.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function ResearchExportPanel(props: {
  record: Screen6ResearchExport | null;
  disposition: Screen6ResearchPlanningDisposition;
  disabled: boolean;
  canCreate: boolean;
  onCreate: (input: {
    expectedDispositionFingerprint: string;
  }) => Promise<void>;
}) {
  if (!props.record) {
    return (
      <section className="six-policy-plan" aria-label="Screen 6 research export">
        <div className="six-card-heading">
          <div>
            <p className="six-kicker">Explicit finalization action</p>
            <h3>Create the source-linked research record</h3>
          </div>
          <span>Not created</span>
        </div>
        <p>
          Freeze the current CredibilityPlan, results-inspection history,
          proposed revisions, final DesignRecord, and source-linked decision
          trail. Partial and unassessed work will remain labeled.
        </p>
        <div className="six-actions">
          <button
            type="button"
            className="six-primary"
            disabled={props.disabled || !props.canCreate}
            onClick={() => void props.onCreate({
              expectedDispositionFingerprint:
                props.disposition.dispositionFingerprint,
            })}
          >
            Create source-linked design record
          </button>
        </div>
        <small>
          This deterministic export makes no network, model, or diagnostic
          routine calls. It is a research-planning record, not causal
          certification.
        </small>
      </section>
    );
  }

  const record = props.record;
  const fileNames = [
    ...record.manifest.files.map(({ name }) => name),
    "manifest.json",
  ];
  return (
    <section className="six-policy-plan" aria-label="Screen 6 research export">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Immutable source-linked export</p>
          <h3>{record.readableReport.title}</h3>
        </div>
        <span>{record.completeness.status}</span>
      </div>
      <div className="six-policy-summary" aria-label="Research export summary">
        <div>
          <strong>{fileNames.length}</strong>
          <span>bundle files</span>
        </div>
        <div>
          <strong>{record.sourceLinkedDecisionTrail.sources.length}</strong>
          <span>source references</span>
        </div>
        <div>
          <strong>{record.sourceLinkedDecisionTrail.claims.length}</strong>
          <span>claim records</span>
        </div>
        <div>
          <strong>{record.sourceLinkedDecisionTrail.decisions.length}</strong>
          <span>researcher decisions</span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Design record status</dt>
          <dd>{record.designRecord.recordStatus.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Diagnostic method library</dt>
          <dd>{record.credibilityPlan.methodLibrary.version}</dd>
        </div>
        <div>
          <dt>Export fingerprint</dt>
          <dd>{record.exportFingerprint}</dd>
        </div>
        <div>
          <dt>Source excerpt policy</dt>
          <dd>
            Exact excerpts are omitted by default; source, document, passage,
            hash, and artifact references remain where available.
          </dd>
        </div>
      </dl>
      {record.completeness.excludedOrUnassessedEvidence.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Partial or unassessed evidence</strong>
          <ul>
            {record.completeness.excludedOrUnassessedEvidence.map((item) => (
              <li key={item}>{item.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {record.completeness.unresolvedItems.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Unresolved items retained</strong>
          <ul>
            {record.completeness.unresolvedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details>
        <summary>Source-linked report and export files</summary>
        <ul>{fileNames.map((name) => <li key={name}>{name}</li>)}</ul>
        <pre>{record.readableReport.markdown}</pre>
      </details>
      <div className="six-actions">
        <button
          type="button"
          className="six-secondary"
          onClick={() => downloadResearchExport(record)}
        >
          Download portable JSON bundle
        </button>
      </div>
      <small>{record.claimBoundary}</small>
    </section>
  );
}

export function Screen6UncertaintyPanel(props: {
  workspace: Screen6UncertaintyWorkspace;
  limitations: Screen6PrerequisiteReport["limitations"];
  disabled: boolean;
  canInitialize: boolean;
  canSaveDiagnosticPlan: boolean;
  canRecordDiagnosticResult: boolean;
  canReviewDiagnosticResult: boolean;
  canSaveConditionalClaimBoundary: boolean;
  canRecordResearchPlanningDisposition: boolean;
  canCreateResearchExport: boolean;
  onInitialize: () => Promise<void>;
  onSaveDiagnosticPlan: (
    input: Omit<
      Screen6DiagnosticPlanInput,
      "schemaVersion" | "inputFingerprint"
    >,
  ) => Promise<void>;
  onRecordDiagnosticResult: (input: {
    cardId: string;
    expectedPlanFingerprint: string;
    expectedCardFingerprint: string;
    resultInput: DiagnosticResultInputDraft;
  }) => Promise<void>;
  onReviewDiagnosticResult: (input: {
    resultId: string;
    expectedResultFingerprint: string;
    decision: Screen6DiagnosticResultReviewDecision;
    rationale: string;
    followUpActions: string[];
  }) => Promise<void>;
  onSaveConditionalClaimBoundary: (input: {
    expectedPlanFingerprint: string;
    claimInput: ClaimBoundaryInputDraft;
  }) => Promise<void>;
  onRecordResearchPlanningDisposition: (input: {
    expectedBoundaryFingerprint: string;
    decision: Screen6ResearchPlanningDispositionDecision;
    rationale: string;
    specifiedRevisions: string[];
  }) => Promise<void>;
  onCreateResearchExport: (input: {
    expectedDispositionFingerprint: string;
  }) => Promise<void>;
}) {
  const profile = props.workspace.profile;
  const diagnosticPlan = props.workspace.diagnosticPlan;
  if (!profile) {
    return (
      <section className="six-card" aria-label="Screen 6 uncertainty profile">
        <div className="six-card-heading">
          <div>
            <p className="six-kicker">Current-snapshot foundation</p>
            <h2>Initialize the uncertainty profile</h2>
          </div>
          <span>Ten dimensions · no aggregate score</span>
        </div>
        <p>
          Fixed software will bind the current study and policy identity plus
          every available Screen 2–5 snapshot. Missing work stays visible and
          no area will be labeled satisfactory.
        </p>
        {props.limitations.length ? (
          <div className="six-alert six-alert--warning">
            <strong>Gaps that will be carried forward</strong>
            <ul>
              {props.limitations.map((gap) => (
                <li key={gap.code}>{gap.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="six-actions">
          <button
            type="button"
            className="six-primary"
            disabled={props.disabled || !props.canInitialize}
            onClick={() => void props.onInitialize()}
          >
            Initialize ten-dimension profile
          </button>
        </div>
        <small>{props.workspace.claimBoundary}</small>
      </section>
    );
  }

  const notAssessed = diagnosticPlan
    ? diagnosticPlan.dimensions.filter(({ state }) =>
        state === "not_assessed").length
    : profile.dimensions.filter(({ state }) =>
        state === "not_assessed").length;
  const evidenceNeeded = diagnosticPlan
    ? diagnosticPlan.dimensions.filter(({ state }) =>
        state === "evidence_needed").length
    : profile.dimensions.filter(({ state }) =>
        state === "evidence_needed").length;
  const planned = diagnosticPlan?.dimensions.filter(({ state }) =>
    state === "planned").length ?? 0;
  const primaryCards = diagnosticPlan?.cards.filter(({ displayTier }) =>
    displayTier === "primary") ?? [];
  const additionalCards = diagnosticPlan?.cards.filter(({ displayTier }) =>
    displayTier === "additional") ?? [];
  const resultsByCard = new Map(
    props.workspace.diagnosticResults.map((result) => [
      result.binding.cardId,
      result,
    ]),
  );
  const reviewsByResult = new Map(
    props.workspace.diagnosticResultReviews.map((review) => [
      review.resultReference.resultId,
      review,
    ]),
  );
  const initialClaimInput: ClaimBoundaryInputDraft = {
    intendedClaimLevel:
      diagnosticPlan?.designContext.policyTarget === "policy_component"
        ? "component_specific_effect"
        : "package_effect",
    targetDescription:
      `the effect of ${profile.study.proposedTreatment ?? profile.policy.officialTitle} on ${profile.study.outcome ?? "the stated outcome"}`,
  };

  return (
    <section className="six-card" aria-label="Screen 6 uncertainty profile">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">
            {diagnosticPlan ? "Prospective challenge plan" : "Immutable gap inventory"}
          </p>
          <h2>Identification uncertainty remains separated</h2>
        </div>
        <span>
          Profile revision {profile.ordinal}
          {diagnosticPlan ? ` · plan revision ${diagnosticPlan.ordinal}` : ""}
        </span>
      </div>

      <div className="six-policy-summary" aria-label="Uncertainty profile summary">
        <div><strong>{profile.dimensions.length}</strong><span>dimensions</span></div>
        <div><strong>{planned}</strong><span>planned</span></div>
        <div><strong>{notAssessed}</strong><span>not assessed</span></div>
        <div><strong>{evidenceNeeded}</strong><span>evidence needed</span></div>
      </div>

      {diagnosticPlan ? (
        <div className="six-alert six-alert--warning">
          <strong>
            {props.workspace.diagnosticResults.length
              ? `${props.workspace.diagnosticResults.length} current result${props.workspace.diagnosticResults.length === 1 ? "" : "s"} retained.`
              : "No diagnostic results exist."}
          </strong>{" "}
          Results and interpretations remain separate; none establishes an
          assumption, produces an aggregate score, or creates a certificate.
        </div>
      ) : (
        <div className="six-alert six-alert--warning">
          <strong>No diagnostics or results exist yet.</strong>{" "}
          Upstream evidence is context for planning, not a Screen 6 diagnostic
          result or causal certification.
        </div>
      )}

      {!diagnosticPlan ? (
        <DiagnosticInputForm
          initialInput={null}
          disabled={props.disabled}
          canSave={props.canSaveDiagnosticPlan}
          onSave={props.onSaveDiagnosticPlan}
        />
      ) : (
        <>
          <section className="six-policy-plan" aria-label="Diagnostic plan status">
            <div className="six-card-heading">
              <div>
                <p className="six-kicker">Reviewed method library</p>
                <h3>{diagnosticPlan.priorityPlan.primaryCardCount} priority cards</h3>
              </div>
              <span>
                {diagnosticPlan.methodLibrary.entryCount} reviewed entries ·{" "}
                {diagnosticPlan.priorityPlan.additionalCardCount} additional
              </span>
            </div>
            <p>
              Ranked by identification consequence, recorded feasibility, and
              reviewed-library order. The library version and fingerprint are
              frozen into this plan.
            </p>
            {diagnosticPlan.diagnosticInputGaps.length ? (
              <div className="six-alert six-alert--warning">
                <strong>Diagnostic-input gaps remain</strong>
                <ul>
                  {diagnosticPlan.diagnosticInputGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {diagnosticPlan.methodSupport.issueList.length ? (
              <div className="six-alert six-alert--warning">
                <strong>Method boundary</strong>
                <ul>
                  {diagnosticPlan.methodSupport.issueList.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-label="Priority diagnostic cards">
            <p className="six-kicker">Compact priority plan</p>
            {primaryCards.length
              ? primaryCards.map((card) => (
                  <DiagnosticCard
                    key={card.id}
                    card={card}
                    planFingerprint={diagnosticPlan.planFingerprint}
                    result={resultsByCard.get(card.id) ?? null}
                    review={(() => {
                      const result = resultsByCard.get(card.id);
                      return result
                        ? reviewsByResult.get(result.id) ?? null
                        : null;
                    })()}
                    disabled={props.disabled}
                    canRecord={props.canRecordDiagnosticResult}
                    canReview={props.canReviewDiagnosticResult}
                    onRecord={props.onRecordDiagnosticResult}
                    onReview={props.onReviewDiagnosticResult}
                  />
                ))
              : (
                <div className="six-alert six-alert--warning">
                  <strong>No reviewed diagnostic trigger is active.</strong>{" "}
                  Save a selected comparison or a researcher-reported concern;
                  the app will not invent an estimator prescription.
                </div>
              )}
          </section>

          {additionalCards.length ? (
            <details>
              <summary>{additionalCards.length} additional planned cards</summary>
              {additionalCards.map((card) => (
                <DiagnosticCard
                  key={card.id}
                  card={card}
                  planFingerprint={diagnosticPlan.planFingerprint}
                  result={resultsByCard.get(card.id) ?? null}
                  review={(() => {
                    const result = resultsByCard.get(card.id);
                    return result
                      ? reviewsByResult.get(result.id) ?? null
                      : null;
                  })()}
                  disabled={props.disabled}
                  canRecord={props.canRecordDiagnosticResult}
                  canReview={props.canReviewDiagnosticResult}
                  onRecord={props.onRecordDiagnosticResult}
                  onReview={props.onReviewDiagnosticResult}
                />
              ))}
            </details>
          ) : null}

          <details>
            <summary>Revise researcher-owned diagnostic inputs</summary>
            <DiagnosticInputForm
              initialInput={diagnosticPlan.diagnosticInput}
              disabled={props.disabled}
              canSave={props.canSaveDiagnosticPlan}
              onSave={props.onSaveDiagnosticPlan}
            />
          </details>
        </>
      )}

      {diagnosticPlan ? (
        props.workspace.conditionalClaimBoundary ? (
          <>
            <ConditionalClaimBoundaryRecord
              boundary={props.workspace.conditionalClaimBoundary}
              disposition={props.workspace.researchPlanningDisposition}
              disabled={props.disabled}
              canRecordDisposition={
                props.canRecordResearchPlanningDisposition
              }
              onRecordDisposition={
                props.onRecordResearchPlanningDisposition
              }
            />
            {props.workspace.researchPlanningDisposition ? (
              <ResearchExportPanel
                record={props.workspace.researchExport}
                disposition={props.workspace.researchPlanningDisposition}
                disabled={props.disabled}
                canCreate={props.canCreateResearchExport}
                onCreate={props.onCreateResearchExport}
              />
            ) : null}
            <details>
              <summary>Revise the intended claim boundary</summary>
              <ClaimBoundaryForm
                planFingerprint={diagnosticPlan.planFingerprint}
                initialInput={{
                  intendedClaimLevel:
                    props.workspace.conditionalClaimBoundary.input
                      .intendedClaimLevel,
                  targetDescription:
                    props.workspace.conditionalClaimBoundary.input
                      .targetDescription,
                }}
                disabled={props.disabled}
                canSave={props.canSaveConditionalClaimBoundary}
                onSave={props.onSaveConditionalClaimBoundary}
              />
            </details>
          </>
        ) : (
          <ClaimBoundaryForm
            planFingerprint={diagnosticPlan.planFingerprint}
            initialInput={initialClaimInput}
            disabled={props.disabled}
            canSave={props.canSaveConditionalClaimBoundary}
            onSave={props.onSaveConditionalClaimBoundary}
          />
        )
      ) : null}

      <section className="six-policy-plan" aria-label="Upstream module status">
        <div className="six-card-heading">
          <div>
            <p className="six-kicker">Bound inputs</p>
            <h3>Available work and visible omissions</h3>
          </div>
          <span>Current at initialization</span>
        </div>
        <ul>
          {profile.upstreamModules.map((module) => (
            <li key={module.module} data-status={module.availability}>
              <div>
                <strong>{module.module.replaceAll("_", " ")}</strong>
                <span>{module.availability.replaceAll("_", " ")}</span>
              </div>
              {module.limitation ? <p>{module.limitation}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="six-policy-claims" aria-label="Ten uncertainty dimensions">
        {diagnosticPlan
          ? diagnosticPlan.dimensions.map((dimension) => (
              <article key={dimension.dimension}>
                <p className="six-kicker">
                  {dimension.state.replaceAll("_", " ")}
                </p>
                <h3>{dimension.label}</h3>
                <dl>
                  <div>
                    <dt>Planned diagnostic cards</dt>
                    <dd>
                      {dimension.diagnosticCardIds.length
                        ? dimension.diagnosticCardIds.map((id) =>
                            diagnosticPlan.cards.find((card) =>
                              card.id === id)?.label ?? id).join("; ")
                        : "No reviewed trigger selected a card for this dimension."}
                    </dd>
                  </div>
                  <div>
                    <dt>Unresolved limitations</dt>
                    <dd>{dimension.unresolvedLimitations.join(" ")}</dd>
                  </div>
                  <div>
                    <dt>Result</dt>
                    <dd>
                      {dimension.diagnosticCardIds.flatMap((id) => {
                        const result = resultsByCard.get(id);
                        if (!result) return [];
                        const review = reviewsByResult.get(result.id);
                        return [
                          `${result.input.summary} — ${review
                            ? review.decision.replaceAll("_", " ")
                            : "awaiting researcher review"}`,
                        ];
                      }).join("; ") || "Not supplied or calculated."}
                    </dd>
                  </div>
                </dl>
              </article>
            ))
          : profile.dimensions.map((dimension) => (
              <article key={dimension.dimension}>
                <p className="six-kicker">
                  {dimension.state.replaceAll("_", " ")}
                </p>
                <h3>{dimension.label}</h3>
                <p>{dimension.concern}</p>
                <dl>
                  <div>
                    <dt>Source or assumption</dt>
                    <dd>{dimension.sourceOrAssumption}</dd>
                  </div>
                  <div>
                    <dt>Current evidence</dt>
                    <dd>{dimension.currentEvidence ?? "No current upstream snapshot."}</dd>
                  </div>
                  <div>
                    <dt>Proposed diagnostic</dt>
                    <dd>Not planned in this foundation.</dd>
                  </div>
                  <div>
                    <dt>Unresolved limitation</dt>
                    <dd>{dimension.unresolvedLimitation}</dd>
                  </div>
                  <div>
                    <dt>Response</dt>
                    <dd>Not recorded.</dd>
                  </div>
                </dl>
              </article>
            ))}
      </div>

      <details>
        <summary>{profile.gaps.length} initialization gaps retained in history</summary>
        <ul>
          {profile.gaps.map((gap) => <li key={gap.code}>{gap.message}</li>)}
        </ul>
      </details>

      <p className="six-policy-pause">
        {diagnosticPlan?.claimBoundary ?? props.workspace.claimBoundary}
      </p>
    </section>
  );
}
