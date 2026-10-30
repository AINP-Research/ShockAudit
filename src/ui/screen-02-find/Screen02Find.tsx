import {
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import {
  SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  screen02AssessmentUnavailableScreen03Checks,
  type Screen02AssessmentLifecycleStatus,
  type Screen02CriterionKind,
  type Screen02FindState,
  type Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";
import {
  screen02FindAssessmentUnavailableContinuationGate,
} from "../../core/screen02-workflow-state";
import {
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
} from "../../core/screen02-find-workflow";
import {
  buildScreen02StudyRelevanceProfile,
  type Screen02StudyRelevanceProfileResearcherEdits,
} from "../../core/screen02-relevance-profile";
import {
  criterionFindingCopy,
  criterionKindCopy,
  formatDateLead,
  readableChannel,
  screen02FindCopy,
  sourceAuthorityLabel,
} from "./content";
import {
  buildScreen02FindViewModel,
  screen02FindCoverageSummary,
  type Screen02FindCandidateView,
  type Screen02FindCriterionView,
} from "./find-view-model";
import Screen02WorkflowReset from "../screen-02/Screen02WorkflowReset";
import { Screen02FindProfileEditor } from "../screen-02/Screen02WorkflowShell";
import ContextLeads from "../screen-02/ContextLeads";
import {
  screen02UnavailableAssessmentAcknowledgment,
  screen02UnavailableAssessmentReason,
  screen02TemporaryWorkflowRetention,
} from "../screen-02/content";
import "./screen-02-find.css";
import type { HostTaskStatus } from "../host-task/HostTaskStatusPanel";
import type { HostReasoningMode } from "../host-task/host-task-client";

const secondaryButtonClassName =
  "s2-find-button s2-find-button--secondary";

const activeAssessmentStatuses = new Set([
  "prepared",
  "message-delivered",
  "draft-received",
  "validating",
]);

const findPurpose =
  "Search documented sources for candidate shocks that fit your confirmed study. Review the evidence, compare candidates, and choose one for verification.";

const candidateListHelp =
  "Every candidate is screened against the same scope, evidence, relevance, and exposure requirements. Ranking is preliminary; Screen 3 independently verifies the event.";

const assessmentStatusCopy: Record<
  Screen02AssessmentLifecycleStatus,
  string
> = {
  prepared: "Preparing the source-backed assessment…",
  "message-delivered": "Reviewing this candidate for your study…",
  "draft-received": "The preliminary assessment arrived. Checking it…",
  validating: "Checking the assessment against the source packet…",
  partial: "Part of the assessment is ready. Only the missing items need another try.",
  completed: "Assessment ready.",
  "service-unavailable":
    "The brief assessment is unavailable. You may still choose a source-backed candidate and continue with extra verification.",
  "delivery-rejected":
    "The brief assessment could not start in this view. You may still choose a source-backed candidate and continue with extra verification.",
  "no-tool-submission": "The preliminary assessment did not arrive yet.",
  "validation-failed":
    "The preliminary assessment was incomplete or could not be checked.",
  "timed-out": "Interpretation timed out.",
  superseded: "A newer search or identity is active.",
  "retry-exhausted": "Assessment could not be completed after three attempts.",
};

const widerSearchStatusCopy: Record<
  HostTaskStatus["phase"],
  { title: string; message: string }
> = {
  idle: {
    title: "Wider search",
    message: "A wider search can look for additional relevant sources and candidates.",
  },
  starting: {
    title: "Starting wider search",
    message: "Preparing the expanded search request…",
  },
  waiting: {
    title: "Wider search in progress",
    message: "Looking for additional relevant sources and candidates…",
  },
  applying: {
    title: "Updating search results",
    message: "Checking and applying the additional search results…",
  },
  completed: {
    title: "Wider search complete",
    message: "The wider search finished. Any validated suggestions appear below.",
  },
  "timed-out": {
    title: "Wider search took too long",
    message: "The wider search did not finish within the time limit. Your current results are unchanged.",
  },
  failed: {
    title: "Wider search could not finish",
    message: "The wider search could not be completed. Your current results are unchanged.",
  },
};

export type Screen02FindSearchCriterionDraft = {
  kind: Screen02CriterionKind;
  text: string;
};

export type Screen02FindSearchPhase =
  | "idle"
  | "searching"
  | "completed"
  | "completed-empty"
  | "incomplete"
  | "cancelled"
  | "delivery-failure";

export type Screen02FindSearchState = {
  operationId: string | null;
  phase: Screen02FindSearchPhase;
  message: string;
  startedRevision: number | null;
  settledRevision: number | null;
  visibleCandidateCount: number;
  errorCode: string | null;
  recovery: "none" | "retry" | "reset" | "preserved-results";
  elapsedLabel?: string;
};

export type Screen02StudyRelevanceProfileResearcherEdit =
  Screen02StudyRelevanceProfileResearcherEdits;

export type Screen02FindProps = {
  state: Screen02FindState;
  busy?: boolean;
  searchState?: Screen02FindSearchState | null;
  chatGptPlanningAvailable?: boolean;
  hostReasoningMode?: HostReasoningMode;
  onSearch: (criteria: Screen02FindSearchCriterionDraft[]) => void;
  onAskChatGPT?: (criteria: Screen02FindSearchCriterionDraft[]) => void;
  hostTaskStatus?: HostTaskStatus | null;
  hostReviewDetails?: ReactNode;
  onCheckHostTask?: () => void;
  onRetryHostTask?: () => void;
  onOpenCandidate: (candidateSnapshotId: string) => void;
  onRemoveCandidate: (
    candidateSnapshotId: string,
    reason: string,
  ) => void;
  onRetryCandidate?: (candidateSnapshotId: string) => void;
  onOverrideCriterion?: (findingId: string, reason: string) => void;
  onSelectCandidate: (candidateSnapshotId: string) => void;
  onClearSelection: () => void;
  onContinue: () => void;
  onContinueWithoutAssessment?: (
    reason: string,
    acknowledgment: string,
  ) => void;
  onSaveRelevanceProfile?: (
    edit: Screen02StudyRelevanceProfileResearcherEdit,
  ) => void;
  onEditStudy: () => void;
  onReset: () => void;
  onAddSource?: () => void;
};

const criterionKinds: Screen02CriterionKind[] = [
  "only-include",
  "rank-higher",
  "do-not-show",
];

type FindStudyScope = Screen02FindState["screen01Baseline"]["scopeContract"];

function geographyWithArticle(geography: string) {
  if (/^the\s/i.test(geography)) return geography;
  return /^(United States|United Kingdom|European Union|Netherlands|Philippines|Bahamas|Dominican Republic)$/i.test(
    geography,
  )
    ? `the ${geography}`
    : geography;
}

function formatExposureVariable(
  variable: string,
  study: Pick<FindStudyScope, "population" | "geography" | "studyPeriod">,
  profile: Screen02FindState["relevanceProfile"],
) {
  const geography = profile?.sampleGeography.trim() || study.geography.trim();
  return `For ${study.population.trim()} in ${
    geographyWithArticle(geography)
  } during ${study.studyPeriod.trim()}, how can “${
    variable.trim()
  }” be determined for each study unit?`;
}

function formatAssessmentText(text: string) {
  return text
    .replace(/\bScreen 3 verification\b/gi, "later confirmation")
    .replace(/\bScreen 3\b/gi, "the next verification step")
    .replace(
      /\b(?:current\s+)?territorial-scope lead\b/gi,
      "current evidence about geographic coverage",
    )
    .replace(/\b(?:current\s+)?source lead\b/gi, "online-source evidence")
    .replace(/\bunit-level\b/gi, "study-unit");
}

function usedConservativeFixedFallback(
  request: Screen02FindCandidateView["assessmentRequest"],
) {
  return Boolean(
    request?.lifecycle.some((event) =>
      event.note ===
        SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE ||
      /fixed fallback/i.test(event.note ?? ""),
    ),
  );
}

function formatVerificationCaveat(
  limitation: string,
  row: Screen02FindCandidateView,
  study: FindStudyScope,
) {
  const title = candidateShortTitle(row);
  const date = candidateDate(row);

  if (
    /discovery anchor|catalog date.*not automatically|not automatically (?:the )?(?:correct )?treatment date/i.test(
      limitation,
    )
  ) {
    return `For ${title}, confirm whether ${date} is the date that actually changed exposure for ${study.population}; it may only be a publication or record date.`;
  }
  if (
    /study population is broader|demonstrably covered|does not establish (?:unit|organization)-level|unit-level exposure|organization-level applicability/i.test(
      limitation,
    )
  ) {
    return `For ${title}, confirm which ${study.population} in ${geographyWithArticle(study.geography)} were actually affected and whether exposure varies across the sample.`;
  }
  if (
    /no sample-specific exposure|no defensible .*exposed population|sample variation (?:has|have) not been/i.test(
      limitation,
    )
  ) {
    return `For ${title}, confirm which study units were exposed and whether there is usable exposure variation during ${study.studyPeriod}.`;
  }
  if (/threshold|exemption|exception|derogation|eligibility/i.test(limitation)) {
    return `For ${title}, reconstruct the coverage thresholds and exemptions that applied during ${study.studyPeriod}; today's rules or summaries may differ.`;
  }
  if (
    /multiple provisions|different (?:effective|implementation|compliance)|implementation clock|phase|commencement|operative date/i.test(
      limitation,
    )
  ) {
    return `For ${title}, identify the specific provision and date that could change exposure during ${study.studyPeriod}; different parts of the event may begin at different times.`;
  }
  if (
    /transposition|member state|national (?:date|rule|implementation|enforcement)/i.test(
      limitation,
    )
  ) {
    return `For ${title}, confirm the jurisdiction-specific rule and start date that applied to each study unit; national implementation may differ.`;
  }
  if (
    /installation|facility|product-level|ownership|linkage|assignment unit/i.test(
      limitation,
    )
  ) {
    return `For ${title}, confirm that each ${study.analysisLevel.toLocaleLowerCase("en-US")} in the sample can be linked to the covered entity, activity, or location.`;
  }
  if (/court|guidance|amendment|later rule/i.test(limitation)) {
    return `For ${title}, check whether court decisions, guidance, or amendments changed the applicable rule during ${study.studyPeriod}.`;
  }
  if (
    /hazard|footprint|intensity|alert level|affected-country|disaster/i.test(
      limitation,
    )
  ) {
    return `For ${title}, verify each study unit's location, timing, and intensity of exposure rather than treating the broad event area as exposure.`;
  }
  return `For ${title}, verify the relevant date, coverage rule, and exposure of ${study.population} during ${study.studyPeriod}; the current online record does not settle these study-specific details.`;
}

function candidateShortTitle(row: Screen02FindCandidateView) {
  return (
    row.candidate.identity.commonNames[0] ??
    row.candidate.identity.canonicalTitle
  );
}

function candidateDate(row: Screen02FindCandidateView) {
  const lead = row.candidate.dateLeads[0];
  return lead
    ? `${lead.label}: ${formatDateLead(lead.date)}`
    : "Date not yet established";
}

function candidateStatus(row: Screen02FindCandidateView) {
  if (row.candidate.qualification?.eligible === true && !row.assessmentRequest) {
    return `${qualificationClassLabel[row.candidate.qualification.classification]} · Source-backed candidate`;
  }
  return row.assessmentRequest
    ? assessmentStatusCopy[row.assessmentRequest.status]
    : assessmentStatusCopy.prepared;
}

function CandidateRow({
  row,
  onOpen,
}: {
  row: Screen02FindCandidateView;
  onOpen: () => void;
}) {
  const status = candidateStatus(row);
  return (
    <li className="s2-find-candidate-list__item">
      <button
        className={`s2-find-candidate-row ${
          row.opened ? "s2-find-candidate-row--open" : ""
        } ${row.selected ? "s2-find-candidate-row--selected" : ""}`}
        type="button"
        aria-pressed={row.opened}
        aria-controls="s2-find-candidate-detail"
        onClick={onOpen}
      >
        <span className="s2-find-candidate-row__heading">
          <strong>{candidateShortTitle(row)}</strong>
          {row.selected && <b>Chosen</b>}
        </span>
        <span className="s2-find-candidate-row__date">
          {candidateDate(row)}
        </span>
        <span className="s2-find-candidate-row__status">{status}</span>
        <span className="s2-find-candidate-row__source">
          {sourceAuthorityLabel(row.sources)}
        </span>
        <span className="s2-find-candidate-row__concern">
          <small>What changed</small>
          <span>{row.candidate.description.text}</span>
        </span>
        {row.assessment?.mainConcern && (
          <span className="s2-find-candidate-row__concern">
            <small>Main concern</small>
            <span>{formatAssessmentText(row.assessment.mainConcern)}</span>
          </span>
        )}
        <span className="sr-only">
          . Open details for {row.candidate.identity.canonicalTitle}.
        </span>
      </button>
    </li>
  );
}

function SourceLink({
  source,
  assessmentUseLabel = null,
}: {
  source: Screen02WorkflowSource;
  assessmentUseLabel?: string | null;
}) {
  const linked = /^https?:\/\//i.test(source.locator);
  return (
    <li className="s2-find-source">
      <span>
        {linked ? (
          <a href={source.locator} target="_blank" rel="noreferrer">
            {source.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <strong>{source.title}</strong>
        )}
        <small>
          {source.publisher}
          {source.publishedDate ? ` · ${source.publishedDate}` : ""}
        </small>
        {assessmentUseLabel && <small>{assessmentUseLabel}</small>}
      </span>
      <b>{sourceAuthorityLabel([source])}</b>
    </li>
  );
}

const relatedDiscoveryProviderLabel = {
  "general-web": "Web",
  scholarly: "Scholarly",
  "public-reference": "Public reference",
} as const;

function RelatedDiscoveryLink({
  link,
}: {
  link: Screen02FindCandidateView["relatedDiscoveryLinks"][number];
}) {
  function openRelatedSearch(event: ReactMouseEvent<HTMLAnchorElement>) {
    const openExternal = window.openai?.openExternal;
    if (!openExternal) return;
    event.preventDefault();
    void Promise.resolve(
      openExternal({ href: link.locator, redirectUrl: false }),
    ).catch(() => {
      window.open(link.locator, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <li className="s2-find-source s2-find-source--related-search">
      <span>
        <a
          href={link.locator}
          target="_blank"
          rel="noreferrer"
          onClick={openRelatedSearch}
        >
          {link.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <small>{relatedDiscoveryProviderLabel[link.provider]}</small>
      </span>
    </li>
  );
}

function Assessment({
  row,
  study,
  onRetry,
}: {
  row: Screen02FindCandidateView;
  study: FindStudyScope;
  onRetry?: () => void;
}) {
  const assessment = row.assessment;
  const request = row.assessmentRequest;
  const fixedFallback = usedConservativeFixedFallback(request);
  const assessmentUnavailable = Boolean(
    !assessment &&
      request &&
      [
        "delivery-rejected",
        "no-tool-submission",
        "validation-failed",
        "timed-out",
        "service-unavailable",
        "retry-exhausted",
      ].includes(request.status),
  );
  const status = request
    ? assessmentStatusCopy[request.status]
    : assessmentStatusCopy.prepared;
  const assessmentPending = !assessment &&
    (!request || activeAssessmentStatuses.has(request.status));
  const retryAvailable =
    request !== null &&
    [
      "delivery-rejected",
      "no-tool-submission",
      "validation-failed",
      "partial",
      "timed-out",
    ].includes(request.status) &&
    (request.status === "delivery-rejected"
      ? request.lifecycle.filter((event) => event.status === "prepared").length < 3
      : request.attempt < 3);
  return (
    <section
      className="s2-find-assessment"
      aria-labelledby={`s2-find-assessment-${row.candidate.candidateSnapshotId}`}
    >
      <div className="s2-find-section-heading">
        <div>
          <span className="s2-find-provenance">
            {fixedFallback
              ? "Source-derived preliminary assessment"
              : assessment
                ? "Preliminary source-linked interpretation"
                : assessmentUnavailable
                  ? "Source-backed candidate · Assessment unavailable"
                  : "Assessment in progress"}
          </span>
          <h3 id={`s2-find-assessment-${row.candidate.candidateSnapshotId}`}>
            Early research assessment
          </h3>
          <p>
            {fixedFallback
              ? "The interpretive review did not arrive before the bounded deadline, so this conservative aid was assembled from the source-linked candidate and your confirmed study. It still requires verification."
              : assessment
                ? "This candidate-specific first look uses the sources already found and your confirmed study. It is preliminary; later screens perform the rigorous checks."
                : assessmentUnavailable
                  ? "The official-source record is still available, but the preliminary assessment could not be completed. Retry once or continue with the clearly listed extra checks."
                  : "This source-backed candidate is being assessed against your confirmed study. The result appears here automatically."}
          </p>
        </div>
      </div>

      <p
        className="s2-find-status"
        role="status"
        aria-busy={assessmentPending || undefined}
      >
        {assessmentPending && (
          <span className="s2-find-spinner" aria-hidden="true" />
        )}
        <span>{status}</span>
      </p>

      {assessment ? (
        <div className="s2-find-assessment-grid">
          <article className="s2-find-assessment-component">
            <h4>How this shock may affect your sample</h4>
            <p className="s2-find-assessment-context">
              <strong>Chosen sample:</strong> {study.population} ·{" "}
              {study.industry} · {study.geography}
              {" · "}
              {study.studyPeriod}
            </p>
            <p>
              {assessment.studyFit
                ? formatAssessmentText(assessment.studyFit.explanation)
                : "The preliminary assessment has not yet established how this shock may reach the chosen sample."}
            </p>
            {assessment.mainConcern && (
              <p>
                <strong>Key uncertainty:</strong>{" "}
                {formatAssessmentText(assessment.mainConcern)}
              </p>
            )}
          </article>
          <article className="s2-find-assessment-component">
            <h4>How this shock may affect {study.outcomeFamily}</h4>
            <p className="s2-find-assessment-context">
              <strong>Chosen outcome:</strong> {study.outcomeFamily}
            </p>
            <p>
              {assessment.outcomePathway
                ? formatAssessmentText(assessment.outcomePathway.explanation)
                : `The preliminary assessment has not yet established how this shock may affect ${study.outcomeFamily}.`}
            </p>
            <p className="s2-find-outcome-hypothesis-note">
              Any pathways shown here are hypotheses to investigate, not
              observed or established causal effects. Their direction and
              magnitude still need to be tested.
            </p>
          </article>
        </div>
      ) : (
        <p className="s2-find-assessment__waiting">
          {assessmentUnavailable
            ? "The source-backed facts are ready. The brief assessment did not arrive, so no interpretation is being claimed. You can retry or continue to Screen 3 with every mandatory check preserved."
            : "The source-backed facts are ready now. The preliminary assessment is in progress, and this section will fill automatically when the checked result arrives."}
        </p>
      )}

      {retryAvailable && onRetry && (
        <button
          className={secondaryButtonClassName}
          type="button"
          onClick={onRetry}
        >
          {request?.status === "delivery-rejected"
            ? "Try the brief assessment again"
            : "Retry missing assessment parts"}
        </button>
      )}
    </section>
  );
}

function CriterionFinding({
  entry,
  sources,
  onOverride,
}: {
  entry: Screen02FindCriterionView;
  sources: readonly Screen02WorkflowSource[];
  onOverride?: (findingId: string, reason: string) => void;
}) {
  const { criterion, finding } = entry;
  const latestOverride = finding?.overrides.at(-1) ?? null;
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const evidence =
    finding?.evidenceSourceIds.flatMap((sourceId) => {
      const source = sourcesById.get(sourceId);
      return source ? [source] : [];
    }) ?? [];
  const canOverride =
    criterion.kind !== "rank-higher" &&
    finding?.result === "unclear" &&
    Boolean(onOverride);

  function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finding || !onOverride) return;
    const reasonControl = event.currentTarget.elements.namedItem(
      "override-reason",
    );
    const reason =
      reasonControl instanceof HTMLTextAreaElement
        ? reasonControl.value.trim()
        : "";
    if (reason) onOverride(finding.findingId, reason);
  }

  return (
    <li className="s2-find-criterion-finding">
      <div>
        <strong>{criterionKindCopy[criterion.kind].short}</strong>
        <span>{criterion.text}</span>
      </div>
      <p>
        <b>
          {finding
            ? criterionFindingCopy[finding.result]
            : "Assessment pending"}
        </b>
        {finding ? ` — ${finding.reason}` : ""}
      </p>
      {finding && (
        <section className="s2-find-criterion-evidence">
          <h4>Evidence for this finding</h4>
          {evidence.length > 0 ? (
            <ul className="s2-find-source-list">
              {evidence.map((source) => (
                <SourceLink key={source.id} source={source} />
              ))}
            </ul>
          ) : (
            <p>
              No source was cited; this finding records an evidence gap or
              technical failure.
            </p>
          )}
        </section>
      )}
      {latestOverride && (
        <p className="s2-find-researcher-decision">
          <strong>Researcher decision</strong>
          Allowed for screening with this recorded reason: {latestOverride.reason}
        </p>
      )}
      {canOverride && (
        <details className="s2-find-inline-form">
          <summary>Document an override for this screening decision</summary>
          <form onSubmit={submitOverride}>
            <label>
              Reason for the override
              <textarea name="override-reason" required />
            </label>
            <button className="s2-find-button" type="submit">
              Record override
            </button>
          </form>
        </details>
      )}
    </li>
  );
}

function CriteriaFindings({
  row,
  onOverride,
}: {
  row: Screen02FindCandidateView;
  onOverride?: (findingId: string, reason: string) => void;
}) {
  if (row.criteria.length === 0) return null;
  return (
    <section className="s2-find-detail-section">
      <h3>Criteria findings</h3>
      <ul className="s2-find-criterion-findings">
        {row.criteria.map((entry) => (
          <CriterionFinding
            key={`${entry.criterion.criterionId}:${entry.criterion.version}`}
            entry={entry}
            sources={row.sources}
            onOverride={onOverride}
          />
        ))}
      </ul>
    </section>
  );
}

function candidateOriginLabel(
  origin: Screen02FindState["candidates"][number]["origin"],
) {
  const labels: Record<typeof origin, string> = {
    "registry-reviewed":
      "Previously reviewed registry event with attached source records.",
    "newly-discovered": "Newly discovered source-backed event lead.",
    "user-provided": "Researcher-provided event lead.",
    "unsupported-lead": "Unsupported event lead; evidence is still required.",
  };
  return labels[origin];
}

const qualificationClassLabel = {
  direct: "Direct",
  adjacent: "Adjacent",
  broad: "Cross-industry",
  mismatch: "Mismatch",
} as const;

const exposureStatusLabel = {
  documented: "Documented exposure path",
  plausible: "Plausible exposure path",
  unclear: "Exposure path unclear",
  infeasible: "Exposure construction infeasible",
} as const;

function CandidateDetail({
  row,
  study,
  profile,
  onRemove,
  onRetry,
  onOverride,
  onChoose,
}: {
  row: Screen02FindCandidateView | null;
  study: FindStudyScope;
  profile: Screen02FindState["relevanceProfile"];
  onRemove: (candidateSnapshotId: string, reason: string) => void;
  onRetry?: (candidateSnapshotId: string) => void;
  onOverride?: (findingId: string, reason: string) => void;
  onChoose: (candidateSnapshotId: string) => void;
}) {
  if (!row) {
    return (
      <section
        id="s2-find-candidate-detail"
        className="s2-find-detail s2-find-detail--empty"
      >
        <strong>No candidate is open.</strong>
        <p>Open a factual candidate record to compare its early assessment.</p>
      </section>
    );
  }

  const { candidate } = row;
  const fixedFallback = usedConservativeFixedFallback(
    row.assessmentRequest,
  );
  const broadCoverage = candidate.broadCoverage.map((claim) => claim.text);
  const assessmentSourceIds = new Set(
    row.assessment?.evidenceSourceIds ?? [],
  );
  const admissionVerificationNeed =
    candidate.qualification?.candidateAdmission?.screen3VerificationNeeds[0];
  const verificationCaveats = admissionVerificationNeed
    ? [admissionVerificationNeed]
    : Array.from(
        new Set(
          candidate.limitations.map((limitation) =>
            formatVerificationCaveat(limitation, row, study),
          ),
        ),
      );
  const gateReasonId = `s2-find-gate-${candidate.candidateSnapshotId}`;
  const choiceWaitingForAssessment = row.selectionGate.reasons.some(
    (reason) => /still running/i.test(reason),
  );

  function submitRemoval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reasonControl = event.currentTarget.elements.namedItem(
      "removal-reason",
    );
    const reason =
      reasonControl instanceof HTMLTextAreaElement
        ? reasonControl.value.trim()
        : "";
    if (reason) onRemove(candidate.candidateSnapshotId, reason);
  }

  return (
    <article
      id="s2-find-candidate-detail"
      className="s2-find-detail"
      aria-labelledby={`s2-find-detail-title-${candidate.candidateSnapshotId}`}
    >
      <header className="s2-find-detail__header">
        <div>
          <h2 id={`s2-find-detail-title-${candidate.candidateSnapshotId}`}>
            {candidate.identity.canonicalTitle}
          </h2>
          {candidate.identity.formalIdentifier && (
            <p>{candidate.identity.formalIdentifier}</p>
          )}
        </div>
        <span className="s2-find-badge">
          {sourceAuthorityLabel(row.sources)}
        </span>
      </header>

      <section className="s2-find-factual-record">
        <span className="s2-find-provenance">
          Source-backed fact · Provisional
        </span>
        <h3>{candidate.qualification ? "Qualified candidate overview" : "What happened"}</h3>
        {candidate.qualification ? (
          <dl className="s2-find-overview-grid">
            <div>
              <dt>What the shock is</dt>
              <dd>{candidate.qualification.substantiveOverview.whatTheShockIs}</dd>
            </div>
            <div>
              <dt>What changed</dt>
              <dd>{candidate.qualification.substantiveOverview.whatChanged}</dd>
            </div>
            <div>
              <dt>Who may be affected</dt>
              <dd>{candidate.qualification.substantiveOverview.whoMayBeAffected}</dd>
            </div>
            <div>
              <dt>Important timing</dt>
              <dd>{candidate.qualification.substantiveOverview.importantTiming}</dd>
            </div>
            <div>
              <dt>Why it may matter for this study</dt>
              <dd>{candidate.qualification.substantiveOverview.whyItMayMatterForStudy}</dd>
            </div>
            <div>
              <dt>Main uncertainty</dt>
              <dd>{candidate.qualification.substantiveOverview.mainUncertainty}</dd>
            </div>
          </dl>
        ) : (
          <>
            <p>{candidate.description.text}</p>
            <dl>
              <div>
                <dt>Issuing authority</dt>
                <dd>{candidate.identity.issuer ?? "Not yet established"}</dd>
              </div>
              <div>
                <dt>Issuing jurisdiction</dt>
                <dd>{candidate.identity.issuingJurisdiction ?? "Not yet established"}</dd>
              </div>
              <div>
                <dt>Main date lead</dt>
                <dd>{candidateDate(row)}</dd>
              </div>
              <div>
                <dt>Who may be affected</dt>
                <dd>{broadCoverage.join(" ") || "Not yet established from the online sources."}</dd>
              </div>
              <div>
                <dt>Record provenance</dt>
                <dd>{candidateOriginLabel(candidate.origin)}</dd>
              </div>
              <div>
                <dt>Event status</dt>
                <dd>{candidate.identity.status ?? "Not yet established"}</dd>
              </div>
            </dl>
          </>
        )}
        <div className="s2-find-factual-notes">
          <section>
            <h4>Information needed to identify affected units</h4>
            {candidate.apparentExposureVariables.length > 0 ? (
              <ul>
                {candidate.apparentExposureVariables.map((variable) => (
                  <li key={variable}>
                    {formatExposureVariable(variable, study, profile)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                The online sources do not yet identify what information is
                needed to determine exposure.
              </p>
            )}
          </section>
          <section>
            <h4>One verification need for Screen 3</h4>
            {verificationCaveats.length > 0 ? (
              <ul>
                {verificationCaveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            ) : (
              <p>
                Confirm the event date, covered units, and exposure measure for
                this study before treating the shock as verified.
              </p>
            )}
          </section>
        </div>
      </section>

      {candidate.qualification && (
        <section
          className="s2-find-detail-section s2-find-qualification"
          aria-labelledby={`s2-find-qualification-${candidate.candidateSnapshotId}`}
        >
          <span className="s2-find-provenance">
            Source-backed qualification · Preliminary
          </span>
          <h3 id={`s2-find-qualification-${candidate.candidateSnapshotId}`}>
            Why this candidate is shown
          </h3>
          <dl className="s2-find-qualification__grid">
            <div>
              <dt>Industry relationship</dt>
              <dd>
                {qualificationClassLabel[candidate.qualification.classification]}
              </dd>
            </div>
            <div>
              <dt>Exposure feasibility</dt>
              <dd>
                {exposureStatusLabel[
                  candidate.qualification.exposureFeasibility.status
                ]}
              </dd>
            </div>
            <div>
              <dt>Source quality</dt>
              <dd>{candidate.qualification.sourceQuality.status}</dd>
            </div>
          </dl>
          <details className="s2-find-qualification__diagnostics">
            <summary>Ranking diagnostics</summary>
            <dl>
              <div>
                <dt>Qualification score</dt>
                <dd>{candidate.qualification.ranking.totalScore} / 100</dd>
              </div>
            </dl>
            <p>
              This qualification score orders source-backed candidates; it is not an
              event fact or a verification result.
            </p>
          </details>
          <p>{candidate.qualification.industryFit.explanation}</p>
          <p>{candidate.qualification.exposureFeasibility.explanation}</p>
          <p className="s2-find-outcome-hypothesis-note">
            {candidate.qualification.outcomeFit.explanation}
          </p>
          <p>
            This qualification and overview screen source-backed candidates;
            they do not verify the event, treatment date, covered units, or
            Event Card. Screen 3 performs that independent verification.
          </p>
        </section>
      )}

      {(row.assessmentRequest ||
        row.assessment ||
        !row.candidate.qualification) && (
        <Assessment
          row={row}
          study={study}
          onRetry={
            onRetry ? () => onRetry(candidate.candidateSnapshotId) : undefined
          }
        />
      )}

      <CriteriaFindings row={row} onOverride={onOverride} />

      <section className="s2-find-detail-section">
        <h3>Online sources</h3>
        <p>
          Review the records attached to this candidate and three additional
          searches related to the shock.
        </p>
        <ul className="s2-find-source-list">
          {row.sources.length > 0 ? (
            row.sources.map((source) => (
              <SourceLink
                key={source.id}
                source={source}
                assessmentUseLabel={
                  assessmentSourceIds.has(source.id)
                    ? fixedFallback
                      ? "Used in the source-derived assessment"
                      : "Used in the preliminary assessment"
                    : null
                }
              />
            ))
          ) : (
            <li className="s2-find-source">
              <span>No attached record is available for this lead yet.</span>
            </li>
          )}
          {row.relatedDiscoveryLinks.map((link) => (
            <RelatedDiscoveryLink key={link.relatedLinkId} link={link} />
          ))}
        </ul>
      </section>

      <footer className="s2-find-detail-actions">
        {row.selected ? (
          <p className="s2-find-disabled-reason">
            Undo the tentative choice before removing this candidate from the
            comparison.
          </p>
        ) : (
          <details className="s2-find-inline-form">
            <summary>Remove from comparison</summary>
            <form onSubmit={submitRemoval}>
              <label>
                Reason
                <textarea name="removal-reason" required />
              </label>
              <button
                className={secondaryButtonClassName}
                type="submit"
              >
                Remove from comparison
              </button>
            </form>
          </details>
        )}
        <div>
          <button
            className="s2-find-button"
            type="button"
            disabled={!row.selectionGate.eligible || row.selected}
            aria-describedby={
              !row.selectionGate.eligible ? gateReasonId : undefined
            }
            onClick={() => onChoose(candidate.candidateSnapshotId)}
          >
            {choiceWaitingForAssessment && (
              <span className="s2-find-spinner" aria-hidden="true" />
            )}
            {row.selected ? "Chosen" : screen02FindCopy.choose}
          </button>
          {!row.selectionGate.eligible && row.selectionGate.visibleReason && (
            <p id={gateReasonId} className="s2-find-disabled-reason">
              {row.selectionGate.visibleReason}
            </p>
          )}
        </div>
      </footer>
    </article>
  );
}

function SearchOperationStatus({
  searchState,
}: {
  searchState: Screen02FindSearchState;
}) {
  const searchActive = searchState.phase === "searching";
  return (
    <p
      className={`s2-find-search-status s2-find-search-status--${searchState.phase}`}
      data-testid="screen02-find-search-status"
      role="status"
      aria-busy={searchActive || undefined}
    >
      {searchActive && (
        <span className="s2-find-spinner" aria-hidden="true" />
      )}
      <span>
        <strong>{searchState.message}</strong>
        {searchState.elapsedLabel ? ` ${searchState.elapsedLabel}` : ""}
      </span>
    </p>
  );
}

function SearchWorkspace({
  criteria,
  blank,
  searchState,
  chatGptPlanningAvailable,
  hostTaskBusy,
  profileReady,
  onSearch,
  onAskChatGPT,
  onAddSource,
}: {
  criteria: Screen02FindCandidateView["criteria"][number]["criterion"][];
  blank: boolean;
  searchState?: Screen02FindSearchState | null;
  chatGptPlanningAvailable: boolean;
  hostTaskBusy: boolean;
  profileReady: boolean;
  onSearch: Screen02FindProps["onSearch"];
  onAskChatGPT?: Screen02FindProps["onAskChatGPT"];
  onAddSource?: () => void;
}) {
  const searchActive = searchState?.phase === "searching";
  const initialInputs = useMemo(() => {
    const values: Record<Screen02CriterionKind, string> = {
      "only-include": "",
      "rank-higher": "",
      "do-not-show": "",
    };
    for (const kind of criterionKinds) {
      values[kind] = criteria
        .filter((criterion) => criterion.kind === kind)
        .map((criterion) => criterion.text)
        .join("\n");
    }
    return values;
  }, [criteria]);
  const [inputs, setInputs] = useState(initialInputs);

  function currentDrafts() {
    return criterionKinds.flatMap((kind) =>
      inputs[kind]
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ kind, text })),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileReady) return;
    const drafts = currentDrafts();
    onSearch(drafts);
  }

  const recovery = searchState && [
    "incomplete",
    "cancelled",
    "delivery-failure",
  ].includes(searchState.phase)
    ? {
        guidance: searchState.phase === "incomplete"
          ? "Some supported source routes did not finish. Existing candidate cards remain available while you retry the bounded search."
          : searchState.phase === "cancelled"
            ? "This search stopped when the Screen 2 run changed. Any prior candidate cards remain available; start another search when the replacement is ready."
            : "The result could not be safely applied. Existing candidate cards remain available; retry the source search, or use Reset Screen 2 above if the problem continues.",
        action: searchState.phase === "incomplete"
          ? "Retry incomplete search"
          : searchState.phase === "cancelled"
            ? "Start another source search"
            : "Retry source search",
      }
    : null;

  return (
    <>
      <details
        className="s2-find-search"
        open={blank || searchActive}
      >
        <summary>
          {blank ? "Optional search guidance" : "Search guidance and different shocks"}
        </summary>
        <form onSubmit={submit}>
          <p>
            All fields may be left blank. Put each separate condition on its own
            line. A later search excludes shocks already returned in this run.
          </p>
          <p>
            <strong>How this works:</strong>{" "}
            ShockAudit searches its reviewed records and supported public
            sources. Attached sources support event facts and eligibility. After
            reviewing the first results, you can search more widely when that
            option is available.
          </p>
          <div className="s2-find-search-grid">
            {criterionKinds.map((kind) => (
              <label key={kind}>
                <strong>{criterionKindCopy[kind].label}</strong>
                <span>{criterionKindCopy[kind].help}</span>
                <textarea
                  value={inputs[kind]}
                  placeholder={criterionKindCopy[kind].placeholder}
                  disabled={searchActive || !profileReady}
                  onChange={(event) =>
                    setInputs((current) => ({
                      ...current,
                      [kind]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {searchState?.phase === "searching" && (
            <SearchOperationStatus searchState={searchState} />
          )}
          {!profileReady && (
            <p
              id="s2-find-profile-search-blocked"
              className="s2-find-search-status"
              data-testid="screen02-profile-search-blocked"
              role="alert"
            >
              Clarify the industry interpretation in the study profile before
              finding candidate shocks.
            </p>
          )}
          {chatGptPlanningAvailable && onAskChatGPT && !blank && (
            <p
              id="s2-find-wider-search-disclosure"
              className="s2-find-assisted-disclosure"
              data-testid="screen02-wider-search-disclosure"
            >
              <strong>Before you search more widely:</strong>{" "}
              Bounded assisted reasoning uses the confirmed study context,
              candidate facts, and source references shown here. Suggestions
              must still pass source retrieval and qualification checks.
            </p>
          )}
          <div className="s2-find-search-actions">
            <button
              className="s2-find-button"
              type="submit"
              disabled={searchActive || !profileReady}
              aria-describedby={
                profileReady ? undefined : "s2-find-profile-search-blocked"
              }
              aria-busy={searchActive || undefined}
            >
              {searchActive
                ? "Finding candidate shocks from sources…"
                : blank
                  ? "Find candidate shocks"
                  : "Find different shocks from sources"}
            </button>
            {chatGptPlanningAvailable && onAskChatGPT && !blank && (
              <button
                className={secondaryButtonClassName}
                type="button"
                disabled={searchActive || hostTaskBusy || !profileReady}
                aria-describedby="s2-find-wider-search-disclosure"
                aria-busy={hostTaskBusy || undefined}
                onClick={() => {
                  onAskChatGPT(currentDrafts());
                }}
              >
                Search more widely
              </button>
            )}
            {onAddSource && (
              <button
                className={secondaryButtonClassName}
                type="button"
                disabled={searchActive}
                onClick={onAddSource}
              >
                Add a source
              </button>
            )}
          </div>
        </form>
      </details>
      {searchState &&
        searchState.phase !== "idle" &&
        searchState.phase !== "searching" && (
          recovery ? (
            <section
              className="s2-find-search-recovery"
              data-testid="screen02-find-search-recovery"
              aria-label="Source search recovery"
            >
              <SearchOperationStatus searchState={searchState} />
              <p>{recovery.guidance}</p>
              <button
                className={secondaryButtonClassName}
                type="button"
                disabled={!profileReady}
                onClick={() => onSearch(currentDrafts())}
              >
                {recovery.action}
              </button>
            </section>
          ) : (
            <SearchOperationStatus searchState={searchState} />
          )
        )}
    </>
  );
}

function SearchRecord({
  activeSet,
  excludedCount,
}: {
  activeSet: NonNullable<
    ReturnType<typeof buildScreen02FindViewModel>["activeSet"]
  >;
  excludedCount: number;
}) {
  const manifest = activeSet.manifest;
  const displayedCount = activeSet.candidateSnapshotIds.length;
  const funnel = manifest.funnel;
  const providerNeutralRecordText = (value: string) =>
    value
      .replace(
        /ChatGPT must identify and disclose suitable jurisdiction-specific administrative sources/giu,
        "A suitable jurisdiction-specific administrative source must be identified and disclosed",
      )
      .replace(
        /ChatGPT must identify and disclose suitable jurisdiction-specific sources/giu,
        "A suitable jurisdiction-specific source must be identified and disclosed",
      )
      .replace(/Use bounded ChatGPT-planned vocabulary/giu, "Use bounded supplemental vocabulary")
      .replace(/Host-assisted discovery required:\s*yes\.?/giu, "Additional source discovery is required.")
      .replace(/Host-assisted discovery required:\s*no\.?/giu, "No additional source discovery is required.")
      .replace(/\bhost[- ]global discovery\b/giu, "Supplemental source search")
      .replace(/\bhost[- ]proposed\b/giu, "supplemental")
      .replace(/\bhost[- ]assisted\b/giu, "supplemental")
      .replace(/\bMCP Apps\b/giu, "the workspace")
      .replace(/\bChatGPT\b/giu, "the wider search")
      .replace(/\bMCP\b/giu, "workspace")
      .replace(/\bhosts\b/giu, "supplemental searches")
      .replace(/\bhost\b/giu, "supplemental search")
      .replace(/\bmodels\b/giu, "reviews")
      .replace(/\bmodel\b/giu, "review")
      .replace(/\bproviders\b/giu, "sources")
      .replace(/\bprovider\b/giu, "source")
      .replace(/\bfallbacks\b/giu, "alternate paths")
      .replace(/\bfallback\b/giu, "alternate path");
  const visibleQuery = (value: string) =>
    /^No (?:optional )?ChatGPT query expansion applied\.?$/iu.test(value.trim())
      ? "No supplemental query expansion applied."
      : value;
  return (
    <section className="s2-find-coverage">
      <p>{screen02FindCopy.coverage}</p>
      <details>
        <summary>How this search was conducted</summary>
        <dl>
          <div>
            <dt>Search request</dt>
            <dd>{manifest.exactRequest}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{manifest.retrievedAt}</dd>
          </div>
          <div>
            <dt>Stopping rule</dt>
            <dd>{providerNeutralRecordText(manifest.stoppingRule.note)}</dd>
          </div>
        </dl>
        {funnel ? (
          <>
            <p className="s2-find-search-funnel">
              <strong>Search funnel:</strong>{" "}
              {funnel.sourceRecordsRetrieved} source records →{" "}
              {funnel.uniqueEventLeads} unique leads →{" "}
              {funnel.evaluatedUniqueLeads} evaluated →{" "}
              {funnel.hardScopePassed} hard scope →{" "}
              {funnel.sourceQualityPassed} source quality →{" "}
              {funnel.substantiveInformationPassed} substantive →{" "}
              {funnel.relevancePassed} relevant →{" "}
              {funnel.exposureFeasibilityPassed} exposure-feasible →{" "}
              <strong>{funnel.displayedCandidates} displayed</strong>.
            </p>
            <dl className="s2-find-search-funnel-details">
              <div>
                <dt>Deduplication</dt>
                <dd>{funnel.duplicatesRemoved} duplicate records removed</dd>
              </div>
              <div>
                <dt>Relevance classes</dt>
                <dd>
                  {funnel.directCandidates} direct ·{" "}
                  {funnel.adjacentCandidates} adjacent ·{" "}
                  {funnel.broadCandidates} broad ·{" "}
                  {funnel.mismatchCandidates} mismatch
                </dd>
              </div>
              <div>
                <dt>Deeper retrieval</dt>
                <dd>{funnel.deeperRetrievalAttempts} bounded attempts</dd>
              </div>
              <div>
                <dt>Additional search contribution</dt>
                <dd>
                  {funnel.hostContribution > 0
                    ? `${funnel.hostContribution} validated retrieval contribution${funnel.hostContribution === 1 ? "" : "s"}`
                    : "None in this search"}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="s2-find-search-funnel">
            Detailed funnel counts were not stored for this historical search.
            {" "}<strong>{displayedCount} candidates were displayed.</strong>
          </p>
        )}
        {displayedCount < SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES && (
          <div className="s2-find-search-shortfall" role="status">
            <strong>Why the list is short</strong>
            <p>
              The bounded search found {displayedCount} displayable candidate{displayedCount === 1 ? "" : "s"}.
              {funnel
                ? ` The recorded gates reduced ${funnel.evaluatedUniqueLeads} evaluated leads to ${funnel.qualifiedCandidates} qualified candidates.`
                : ""}{" "}
              Review the documented exclusions and route limits below. You can
              broaden the relevance profile, add a direct source, or refine the
              event-family and exposure terms before searching again.
            </p>
          </div>
        )}
        <h3>Source routes</h3>
        <ul>
          {manifest.channels.map((channel, index) => (
            <li key={`${channel.channel}:${index}`}>
              <strong>{providerNeutralRecordText(readableChannel(channel.channel))}</strong>
              <span>
                {channel.status.replace("-", " ")} · {providerNeutralRecordText(channel.note)}
              </span>
            </li>
          ))}
        </ul>
        <ContextLeads
          leads={manifest.contextLeads}
          note="These secondary-source leads may explain announcements or implementation, but they do not confirm a shock or date."
        />
        {manifest.queryMatrix.length > 0 && (
          <>
            <h3>Queries</h3>
            <ul>
              {manifest.queryMatrix.map((query) => (
                <li key={query.id}>
                  <strong>{providerNeutralRecordText(query.purpose)}</strong>
                  <span>{visibleQuery(query.query)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {manifest.exclusions.length > 0 && (
          <>
            <h3>Documented exclusions</h3>
            <ul className="s2-find-exclusion-list">
              {manifest.exclusions.map((exclusion, index) => (
                <li key={`${exclusion.recordId}:${index}`}>
                  <strong>Excluded lead {index + 1}</strong>
                  <span>{providerNeutralRecordText(exclusion.reason)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {excludedCount > 0 && (
          <p>
            {excludedCount} retained candidate{excludedCount === 1 ? " is" : "s are"}
            {" "}excluded from the current comparison by the displayed
            criteria findings.
          </p>
        )}
      </details>
    </section>
  );
}

function DecisionStrip({
  row,
  onClear,
  onContinue,
  unavailableAssessmentEligible,
  onContinueWithoutAssessment,
}: {
  row: Screen02FindCandidateView | null;
  onClear: () => void;
  onContinue: () => void;
  unavailableAssessmentEligible: boolean;
  onContinueWithoutAssessment?: Screen02FindProps["onContinueWithoutAssessment"];
}) {
  const canContinue = Boolean(row?.gate.eligible);
  const canContinueWithExtraChecks = Boolean(
    row &&
      !canContinue &&
      unavailableAssessmentEligible &&
      onContinueWithoutAssessment,
  );
  const reasonId = "s2-find-continuation-reason";
  const continueToScreen03 = () => {
    if (canContinue) {
      onContinue();
      return;
    }
    if (canContinueWithExtraChecks && onContinueWithoutAssessment) {
      onContinueWithoutAssessment(
        screen02UnavailableAssessmentReason,
        screen02UnavailableAssessmentAcknowledgment,
      );
    }
  };
  return (
    <section className="s2-find-decision" aria-live="polite">
      <div>
        <span className="s2-find-provenance">Researcher decision</span>
        <h2>
          {row ? row.candidate.identity.canonicalTitle : screen02FindCopy.noSelection}
        </h2>
        <p>{screen02FindCopy.decisionWarning}</p>
        {row && !canContinue && row.gate.visibleReason && (
          <p id={reasonId} className="s2-find-disabled-reason">
            {row.gate.visibleReason}
          </p>
        )}
      </div>
      <div className="s2-find-decision__actions">
        {row && (
          <button
            className={secondaryButtonClassName}
            type="button"
            onClick={onClear}
          >
            Undo choice
          </button>
        )}
        <button
          className="s2-find-button"
          type="button"
          disabled={!canContinue && !canContinueWithExtraChecks}
          aria-describedby={
            row && !canContinue && !canContinueWithExtraChecks
              ? reasonId
              : undefined
          }
          onClick={continueToScreen03}
        >
          {canContinueWithExtraChecks
            ? "Continue to Screen 3 with extra checks"
            : screen02FindCopy.continue}
        </button>
      </div>
      {row &&
        !canContinue &&
        unavailableAssessmentEligible &&
        onContinueWithoutAssessment && (
          <details className="s2-find-assessment-exception">
            <summary>What the extra checks mean</summary>
            <p>
              The preliminary assessment did not arrive. You can still continue
              with this source-backed candidate. Choosing the visible
              extra-checks button records that limitation and requires Screen 3
              to complete every check below.
            </p>
            <ul>
              {screen02AssessmentUnavailableScreen03Checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </details>
        )}
    </section>
  );
}

function safeSearchTraceToken(value: string | null | undefined) {
  return value && value.length <= 200 && /^[a-z0-9._:-]+$/iu.test(value)
    ? value
    : undefined;
}

export default function Screen02Find({
  state,
  busy = false,
  searchState = null,
  chatGptPlanningAvailable = true,
  hostReasoningMode,
  onSearch,
  onAskChatGPT,
  hostTaskStatus,
  hostReviewDetails,
  onCheckHostTask,
  onRetryHostTask,
  onOpenCandidate,
  onRemoveCandidate,
  onRetryCandidate,
  onOverrideCriterion,
  onSelectCandidate,
  onClearSelection,
  onContinue,
  onContinueWithoutAssessment,
  onSaveRelevanceProfile,
  onEditStudy,
  onReset,
  onAddSource,
}: Screen02FindProps) {
  const view = buildScreen02FindViewModel(state);
  const study = state.screen01Baseline.scopeContract;
  const relevanceProfile = state.relevanceProfile ??
    buildScreen02StudyRelevanceProfile({
      scopeFingerprint: state.screen01Fingerprint,
      originalIndustryText: study.industry,
      sampleGeography: study.geography,
      studyPeriod: study.studyPeriod,
      eventFamily: study.eventFamily,
      at: state.createdAt,
    });
  const blank = view.status === "blank";
  const sealed = state.decision.continuedRevision !== null;
  const unavailableAssessmentGate =
    screen02FindAssessmentUnavailableContinuationGate(state);
  const hostReasoningAvailable = hostReasoningMode === undefined
    ? chatGptPlanningAvailable
    : hostReasoningMode === "full" || hostReasoningMode === "screen02-only";
  const hostTaskBusy = Boolean(
    hostTaskStatus &&
      ["starting", "waiting", "applying"].includes(hostTaskStatus.phase),
  );
  const widerSearchStatus = hostTaskStatus
    ? widerSearchStatusCopy[hostTaskStatus.phase]
    : null;
  const profileReady = relevanceProfile.status === "ready";
  const aggregate =
    view.assessmentCounts.total === 0
      ? "No assessments requested"
      : `${view.assessmentCounts.ready} of ${view.assessmentCounts.total} assessments ready`;
  const failedSearchChannelCount =
    view.activeSet?.manifest.channels.filter(
      (channel) => channel.status === "failed",
    ).length ?? 0;
  const retrievalFailureCount =
    view.activeSet?.manifest.funnel?.retrievalFailures ?? 0;
  const incompleteSearch = view.status === "incomplete";
  const coverage = screen02FindCoverageSummary(state);
  const searchPhase = searchState?.phase ?? "idle";

  return (
    <main
      className="s2-find"
      data-testid="screen02-find"
      data-search-phase={searchPhase}
      data-search-operation-id={safeSearchTraceToken(
        searchState?.operationId,
      )}
      data-search-started-revision={searchState?.startedRevision ?? undefined}
      data-search-settled-revision={searchState?.settledRevision ?? undefined}
      data-search-visible-candidates={
        searchState?.visibleCandidateCount ?? view.comparison.length
      }
      data-search-error-code={safeSearchTraceToken(searchState?.errorCode)}
      data-search-recovery={searchState?.recovery ?? "none"}
    >
      <header className="s2-find-header">
        <div>
          <span className="s2-find-badge">{screen02FindCopy.eyebrow}</span>
          <h1>{screen02FindCopy.title}</h1>
          <p>{findPurpose}</p>
        </div>
        <span
          className="s2-find-badge s2-find-badge--status"
          data-testid="screen02-find-assessment-count"
          role="status"
          aria-live="polite"
        >
          {aggregate}
        </span>
      </header>

      <section className="s2-find-study" aria-labelledby="s2-find-study-title">
        <div className="s2-find-section-heading">
          <div>
            <h2 id="s2-find-study-title">{screen02FindCopy.studyTitle}</h2>
            <p>{state.screen01Baseline.studySentence}</p>
          </div>
          <div className="s2-find-study__actions">
            <button
              className={secondaryButtonClassName}
              type="button"
              onClick={onEditStudy}
            >
              Edit on Screen 1
            </button>
            <Screen02WorkflowReset
              mode="find"
              buttonClassName="s2-find-button s2-find-button--quiet"
              onReset={onReset}
            />
          </div>
        </div>
        <dl className="s2-find-study-grid">
          <div>
            <dt>Population</dt>
            <dd>{study.population}</dd>
          </div>
          <div>
            <dt>Study geography</dt>
            <dd>{study.geography}</dd>
          </div>
          <div>
            <dt>Study period</dt>
            <dd>{study.studyPeriod}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{study.industry}</dd>
          </div>
          <div>
            <dt>Event family</dt>
            <dd>{study.eventFamily}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{study.outcomeFamily}</dd>
          </div>
        </dl>
        <Screen02FindProfileEditor
          industry={study.industry}
          profile={relevanceProfile}
          buttonClassName={secondaryButtonClassName}
          onSave={onSaveRelevanceProfile}
          onEditStudy={onEditStudy}
        />
        {view.criteria.length > 0 && (
          <dl className="s2-find-active-criteria">
            {view.criteria.map((criterion) => (
              <div key={`${criterion.criterionId}:${criterion.version}`}>
                <dt>{criterionKindCopy[criterion.kind].short}</dt>
                <dd>{criterion.text}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {hostTaskStatus && onCheckHostTask && (
        <section className="s2-find-host-task" aria-labelledby="s2-find-host-task-title">
          <div>
            <h2 id="s2-find-host-task-title">{widerSearchStatus?.title}</h2>
            <p role="status" aria-live="polite">
              {widerSearchStatus?.message}
            </p>
            {hostReviewDetails}
          </div>
          <div>
            <button type="button" disabled={busy} onClick={onCheckHostTask}>
              Check for result
            </button>
            {onRetryHostTask &&
              ["failed", "timed-out"].includes(hostTaskStatus.phase) &&
              hostTaskStatus.retryCount === 0 && (
                <button type="button" disabled={busy} onClick={onRetryHostTask}>
                  Retry once
                </button>
              )}
          </div>
        </section>
      )}

      {sealed && (
        <section
          className="s2-find-sealed"
          data-testid="screen02-find-sealed"
          role="status"
        >
          <h2>Screen 2 choice sealed</h2>
          <p>
            This provisional event has been handed to Screen 3. The comparison
            remains visible as a read-only decision record. Undo this choice to
            reopen the same comparison and choose another candidate without
            resetting your Screen 2 work.
          </p>
          <button
            className={secondaryButtonClassName}
            type="button"
            data-testid="screen02-find-reopen-choice"
            onClick={onClearSelection}
          >
            Undo choice
          </button>
        </section>
      )}

      <fieldset
        className="s2-find-workspace-lock"
        disabled={sealed || busy}
        aria-busy={busy || undefined}
      >
        <legend className="sr-only">
          {sealed ? "Read-only completed Screen 2 Find workspace" : "Screen 2 Find workspace"}
        </legend>
        <SearchWorkspace
          key={view.activeSet?.candidateSetSnapshotId ?? "blank"}
          criteria={view.criteria}
          blank={blank}
          searchState={searchState}
          chatGptPlanningAvailable={hostReasoningAvailable}
          hostTaskBusy={hostTaskBusy}
          profileReady={profileReady}
          onSearch={onSearch}
          onAskChatGPT={onAskChatGPT}
          onAddSource={onAddSource}
        />

        {!blank && (
          <>
          {view.status === "partial" && (
            <section className="s2-find-aggregate-notice" role="status">
              <strong>
                {view.assessmentCounts.ready} assessments are ready. ShockAudit
                is still assessing {view.assessmentCounts.pending}.
              </strong>
              <p>
                Completed assessments will not be changed. You may make a
                choice as soon as that candidate’s assessment and required
                criteria finish; the controls will stay stable while other
                results arrive.
              </p>
            </section>
          )}

          {view.comparison.length > 0 && coverage.incomplete && (
            <section
              className="s2-find-aggregate-notice"
              data-testid="screen02-find-incomplete-coverage"
              role="status"
              aria-labelledby="s2-find-incomplete-coverage-title"
            >
              <strong id="s2-find-incomplete-coverage-title">
                Results available — source coverage incomplete
              </strong>
              <p>
                {coverage.failedRouteCount > 0 && (
                  <>
                    {coverage.failedRouteCount} source route
                    {coverage.failedRouteCount === 1 ? "" : "s"} failed. {" "}
                  </>
                )}
                {coverage.retrievalFailureCount > 0 && (
                  <>
                    {coverage.retrievalFailureCount} deeper retrieval attempt
                    {coverage.retrievalFailureCount === 1 ? "" : "s"} failed. {" "}
                  </>
                )}
                {coverage.stoppingRuleNotMet &&
                  coverage.failedRouteCount === 0 &&
                  coverage.retrievalFailureCount === 0 && (
                    <>The recorded stopping rule was not met. </>
                  )}
                The visible candidates remain available to review, but this run
                does not establish complete source coverage. Check the coverage
                record before deciding whether to search again.
              </p>
            </section>
          )}

          {view.comparison.length > 0 ? (
            <section
              className="s2-find-comparison"
              aria-labelledby="s2-find-candidates-title"
            >
              <div className="s2-find-comparison__heading">
                <h2 id="s2-find-candidates-title">
                  {screen02FindCopy.listTitle}
                </h2>
                <p>{candidateListHelp}</p>
              </div>
              <div className="s2-find-comparison__workspace">
                <div className="s2-find-qualified-sections" aria-label="Candidate shocks">
                  {view.bestMatches.length > 0 && (
                    <section aria-labelledby="s2-find-best-matches-title">
                      <h3 id="s2-find-best-matches-title">
                        Best matches for your industry and study
                      </h3>
                      <ol className="s2-find-candidate-list">
                        {view.bestMatches.map((row) => (
                          <CandidateRow
                            key={row.candidate.candidateSnapshotId}
                            row={{
                              ...row,
                              opened:
                                view.opened?.candidate.candidateSnapshotId ===
                                row.candidate.candidateSnapshotId,
                            }}
                            onOpen={() =>
                              onOpenCandidate(row.candidate.candidateSnapshotId)
                            }
                          />
                        ))}
                      </ol>
                    </section>
                  )}
                  {view.broaderMatches.length > 0 && (
                    <section aria-labelledby="s2-find-broader-matches-title">
                      <h3 id="s2-find-broader-matches-title">
                        Broader shocks that may also affect your firms
                      </h3>
                      <p>
                        These source-backed shocks may reach organizations
                        across industries, but the current records do not
                        directly establish your industry boundary.
                      </p>
                      <ol className="s2-find-candidate-list">
                        {view.broaderMatches.map((row) => (
                          <CandidateRow
                            key={row.candidate.candidateSnapshotId}
                            row={{
                              ...row,
                              opened:
                                view.opened?.candidate.candidateSnapshotId ===
                                row.candidate.candidateSnapshotId,
                            }}
                            onOpen={() =>
                              onOpenCandidate(row.candidate.candidateSnapshotId)
                            }
                          />
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
                <CandidateDetail
                  key={
                    view.opened?.candidate.candidateSnapshotId ??
                    "no-open-candidate"
                  }
                  row={view.opened}
                  study={study}
                  profile={relevanceProfile}
                  onRemove={onRemoveCandidate}
                  onRetry={onRetryCandidate}
                  onOverride={onOverrideCriterion}
                  onChoose={onSelectCandidate}
                />
              </div>
            </section>
          ) : (
            <section
              className="s2-find-no-result"
              role="status"
              data-testid="screen02-find-search-outcome"
              data-search-outcome={incompleteSearch ? "incomplete" : "complete-empty"}
            >
              <h2>
                {incompleteSearch
                  ? "Search incomplete"
                  : "Search completed with no qualified candidates"}
              </h2>
              {incompleteSearch ? (
                <p>
                  {failedSearchChannelCount > 0 && (
                    <>
                      {failedSearchChannelCount} source route
                      {failedSearchChannelCount === 1 ? "" : "s"} failed. {" "}
                    </>
                  )}
                  {retrievalFailureCount > 0 && (
                    <>
                      {retrievalFailureCount} deeper retrieval attempt
                      {retrievalFailureCount === 1 ? "" : "s"} failed. {" "}
                    </>
                  )}
                  Part of the source search could not be completed, so this run
                  cannot support a complete no-match conclusion. This does not
                  prove that no suitable event exists. Review the failed routes
                  below, revise the search guidance, or try the search again.
                </p>
              ) : (
                <p>
                  The bounded search finished, but no candidate met the displayed
                  qualification requirements. This does not prove that no
                  suitable event exists. Review the documented exclusions, revise
                  the search guidance, or return to Screen 1.
                </p>
              )}
              <div className="s2-find-search-actions">
                {!incompleteSearch &&
                  view.activeSet?.candidateSnapshotIds.length === 0 && (
                    <button
                      className={secondaryButtonClassName}
                      type="button"
                      data-testid="screen02-find-retry-empty-search"
                      disabled={busy || !profileReady}
                      onClick={() =>
                        onSearch(view.criteria.map(({ kind, text }) => ({
                          kind,
                          text,
                        })))
                      }
                    >
                      Retry search
                    </button>
                  )}
                <button
                  className={secondaryButtonClassName}
                  type="button"
                  onClick={onEditStudy}
                >
                  Revise scope on Screen 1
                </button>
              </div>
            </section>
          )}

          {view.unassessedLeads.length > 0 && (
            <section className="s2-find-unassessed" aria-labelledby="s2-find-unassessed-title">
              <h2 id="s2-find-unassessed-title">Unassessed leads</h2>
              <p>
                Their assessments could not be completed, but the factual
                records remain available. Review a record to choose it and
                continue with the listed extra checks.
              </p>
              <ul>
                {view.unassessedLeads.map((row) => (
                  <li key={row.candidate.candidateSnapshotId}>
                    <strong>{row.candidate.identity.canonicalTitle}</strong>
                    <span>{candidateStatus(row)}</span>
                    <button
                      className={secondaryButtonClassName}
                      type="button"
                      onClick={() =>
                        onOpenCandidate(row.candidate.candidateSnapshotId)
                      }
                    >
                      Review factual record
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!sealed && (
            <DecisionStrip
              row={view.selected}
              onClear={onClearSelection}
              onContinue={onContinue}
              unavailableAssessmentEligible={
                unavailableAssessmentGate.eligible
              }
              onContinueWithoutAssessment={onContinueWithoutAssessment}
            />
          )}

          {view.activeSet && (
            <SearchRecord
              activeSet={view.activeSet}
              excludedCount={view.excluded.length}
            />
          )}
          </>
        )}
      </fieldset>
      <aside
        className="s2-find-retention"
        aria-label="Temporary workflow data retention"
      >
        <strong>Temporary workflow data</strong>
        <p>{screen02TemporaryWorkflowRetention}</p>
      </aside>
    </main>
  );
}
