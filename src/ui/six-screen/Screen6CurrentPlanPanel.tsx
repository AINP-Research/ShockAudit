import { useState } from "react";
import type { SixScreenWorkflowState } from "../../core/six-screen/contracts";
import type { SixScreenFileDownloader, SixScreenDownloadResult } from "./file-download";

import { createScreen6DesignMapProjection, type Screen6DesignMapPanel,
  type Screen6DesignMapProjection } from
  "../../core/six-screen/screen6-design-map";
import { screen6CompatibleInputFingerprints, screen6LocalDimensionSummaries,
  type Screen6CurrentPlan } from
  "../../core/six-screen/screen6-current-plan";
import { SCREEN6_CONTEXTUALIZATION_WIRE_VERSION,
  type Screen6Contextualization } from
  "../../worker/screen6-contextualizer";
import type { Screen6PublicPersonalization } from
  "../../worker/six-screen-workflow-runtime";
import type { StudyFirstEventInvestigationWorkspace } from
  "../../worker/six-screen-workflow-runtime";

type Personalization = Screen6PublicPersonalization;

function personalizationMatchesPlan(plan: Screen6CurrentPlan,
  personalization: Personalization | null): personalization is Personalization {
  return Boolean(personalization?.status === "completed" &&
    screen6CompatibleInputFingerprints(plan).includes(
      personalization.inputFingerprint));
}

function screen6ReferenceInfo(plan: Screen6CurrentPlan, id: string) {
  const policy = plan.upstream.policyEvidence;
  const milestone = policy.chronology.find((item) => item.id === id);
  const claim = policy.claims.find((item) => item.id === id ||
    item.sourceId === id) ?? policy.claims.find((item) =>
    milestone?.claimIds.includes(item.id) || milestone?.sourceIds.includes(
      item.sourceId));
  if (claim) return {
    label: `${claim.sourceTitle || "Policy source"} — ${milestone?.label ?? "policy proposition"}`,
    url: claim.sourceUrl || null,
    id,
  };
  const occurrence = plan.upstream.otherEvents?.occurrences.find((item) =>
    item.id === id || item.sourceIds.includes(id));
  return { label: occurrence?.title ?? "Saved evidence reference",
    url: null, id };
}

/** The view and the exported report use the same field-by-field guidance.
 * A missing historical field falls back to reviewed plan text with its origin. */
export function screen6EffectiveGuidance(plan: Screen6CurrentPlan,
  personalization: Personalization | null) {
  const supplement = personalizationMatchesPlan(plan, personalization)
    ? personalization.supplement as Partial<Screen6Contextualization> : null;
  const additions = new Map<string, Screen6Contextualization["priorities"][number]>(
    (Array.isArray(supplement?.priorities)
    ? supplement.priorities : []).map((item) =>
    [item.diagnostic_id, item] as const));
  const field = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim()
      ? { text: value, origin: "model_contextualization" as const }
      : { text: fallback, origin: "reviewed_plan" as const };
  // Historical v1 supplements predate dimension summaries. Their priority
  // guidance remains readable while this column uses a local current-plan
  // projection, without spending another model request.
  const modelDimensions: Map<Screen6Contextualization["dimension_summaries"][number]["dimension_id"],
    Screen6Contextualization["dimension_summaries"][number]> =
    supplement?.schema_version ===
      SCREEN6_CONTEXTUALIZATION_WIRE_VERSION &&
      Array.isArray(supplement.dimension_summaries)
      ? new Map(supplement.dimension_summaries.map((item) =>
        [item.dimension_id, item] as const)) : new Map();
  const dimensions = screen6LocalDimensionSummaries(plan).map((local) => {
    const added = modelDimensions.get(local.dimensionId);
    return {
      id: local.dimensionId,
      state: plan.dimensions.find((item) => item.id === local.dimensionId)?.state ??
        "Review pending",
      title: field(added?.title, local.title),
      knownBasis: field(added?.known_basis, local.knownBasis),
      specificConcern: field(added?.specific_concern, local.specificConcern),
      nextCheck: field(added?.next_check, local.nextCheck),
      materialLimit: field(added?.material_limit, local.materialLimit),
      sourceRefs: added?.source_refs ?? local.sourceRefs,
      inputRefs: added?.input_refs ?? local.inputRefs,
    };
  });
  const cards = plan.priorities.map((card) => {
    const added = additions.get(card.id);
    return { ...card,
      priorityReason: field(added?.priority_reason, card.reason),
      studyQuestion: field(added?.study_specific_question,
        plan.dimensions.find((dimension) => card.dimensionIds.includes(
          dimension.id))?.concern ?? card.reason),
      practicalCheck: field(added?.contextual_procedure, card.procedure[0] ?? "Specify a suitable check."),
      dataNeeds: field(added?.data_needs, card.prerequisites.join("; ")),
      concerningPattern: field(added?.concerning_pattern, card.concern.join("; ")),
      alternativeExplanation: field(added?.alternative_explanation, card.alternatives.join("; ")),
      reassuranceLimit: field(added?.reassurance_limit, card.limits[0] ?? "The check does not establish causality on its own."),
      nextAction: field(added?.next_action, card.response[0] ?? "Review the finding before proceeding."),
    };
  }).sort((a, b) => {
    const order = supplement?.priorities?.map((item) => item.diagnostic_id) ?? [];
    const rank = (id: string) => {
      const index = order.indexOf(id);
      return index === -1 ? order.length + plan.priorities.findIndex(
        (item) => item.id === id) : index;
    };
    return rank(a.id) - rank(b.id);
  });
  const boundary = supplement?.claim_boundary;
  return { dimensions, cards, boundary: {
    plannedTarget: field(boundary?.planned_target, plan.boundary.plannedTarget),
    requiredAssumptions: field(boundary?.required_assumptions,
      plan.boundary.requiredAssumptions.join("; ")),
    strongerClaims: field(boundary?.stronger_claims_not_established,
      plan.boundary.unsupportedClaims.join("; ")),
    nextAction: field(boundary?.next_action, plan.boundary.nextAction),
  }, gaps: [...new Set([...plan.gaps, ...(supplement?.remaining_gaps ?? [])])],
    basis: supplement ? "validated_model_contextualization" : "reviewed_library_plan",
    profileBasis: modelDimensions.size === plan.dimensions.length
      ? "validated_model_contextualization" : "local_current_plan" };
}


export function screen6ReadablePlanText(plan: Screen6CurrentPlan,
  personalization: Personalization | null,
  historicalPersonalization: Personalization | null = null) {
  const guidance = screen6EffectiveGuidance(plan, personalization);
  const lines = [
    "SHOCKAUDIT · STUDY DESIGN CHALLENGE PLAN",
    `Policy: ${plan.study.policy}`,
    `Study: ${plan.study.population ?? "Population unspecified"}; ${plan.study.requestedPeriod.start ?? "?"}–${plan.study.requestedPeriod.end ?? "?"}`,
    `Theoretical construct of the shock: ${plan.study.policySideConcept ?? "Not specified"}`,
    `Finalized focal mechanism: ${plan.study.focalMechanism ?? "Not yet finalized"}`,
    "Plan only. No diagnostic tests have been run by ShockAudit.",
    `Guidance: ${guidance.basis.replaceAll("_", " ")}.`, "",
    "UNCERTAINTY PROFILE", ...guidance.dimensions.map((item) =>
      `${item.title.text} — ${item.state}. ${item.knownBasis.text}\n  Concern: ${item.specificConcern.text}\n  Next check: ${item.nextCheck.text}\n  Limit: ${item.materialLimit.text}\n  Source/proposition basis: ${item.sourceRefs.map((id: string) => {
        const info = screen6ReferenceInfo(plan, id);
        return `${info.label} [${info.id}]${info.url ? ` ${info.url}` : ""}`;
      }).join("; ") || "None recorded"}\n  Researcher input refs: ${item.inputRefs.join(", ") || "None recorded"}\n  Guidance origin: ${item.title.origin}.`),
    "", "PRIORITIES", ...guidance.cards.map((card, index) =>
      `${index + 1}. ${card.label}\n  Why here: ${card.priorityReason.text}\n  Study question: ${card.studyQuestion.text}\n  Check: ${card.practicalCheck.text}\n  Data needed: ${card.dataNeeds.text}\n  Concerning pattern: ${card.concerningPattern.text}\n  Other explanation: ${card.alternativeExplanation.text}\n  Limit: ${card.reassuranceLimit.text}\n  Next: ${card.nextAction.text}`),
    "", "CONDITIONAL CLAIM BOUNDARY",
    `Planned target: ${guidance.boundary.plannedTarget.text}`,
    `Required assumptions: ${guidance.boundary.requiredAssumptions.text}`,
    `Stronger claims not established: ${guidance.boundary.strongerClaims.text}`,
    `Next action: ${guidance.boundary.nextAction.text}`,
    "", "REMAINING GAPS", ...guidance.gaps.map((gap) => `• ${gap}`),
    "", "Original passages, source mappings, and saved responses are in the full JSON record.",
  ];
  if (historicalPersonalization?.status === "completed") {
    const previous = historicalPersonalization.supplement as
      Partial<Screen6Contextualization> | null;
    lines.push("", "ARCHIVED MODEL GUIDANCE — PRIOR PLAN VERSION",
      "These saved comments belong to an earlier plan. The current uncertainty profile and priorities above are based on the current plan and its own model result, if any.");
    if (Array.isArray(previous?.priorities)) lines.push(...previous.priorities.map(
      (item, index) => `${index + 1}. ${plan.priorities.find((card) =>
        card.id === item.diagnostic_id)?.label ?? "Earlier priority"}\n  Why here: ${item.priority_reason}\n  Next: ${item.next_action}`));
  }
  return `${lines.join("\n")}\n`;
}

function downloadReadablePlan(plan: Screen6CurrentPlan,
  personalization: Personalization | null,
  historicalPersonalization: Personalization | null = null) {
  const url = URL.createObjectURL(new Blob([screen6ReadablePlanText(
    plan, personalization, historicalPersonalization)],
    { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shockaudit-design-plan-${plan.inputFingerprint.replaceAll(":", "-")}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function DesignMapIcon({ id }: { id: Screen6DesignMapPanel["id"] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    {id === "institutional" ? <>
      <path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </> : id === "exposure" ? <>
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" />
    </> : id === "counterfactual" ? <>
      <path d="M5 6h4a3 3 0 0 1 3 3v9" />
      <path d="M19 6h-4a3 3 0 0 0-3 3" />
      <path d="m5 6 2-2M5 6l2 2M19 6l-2-2M19 6l-2 2" />
    </> : id === "measurement" ? <>
      <path d="M5 20V11M11 20V5M17 20v-7M3 20h18" />
    </> : id === "events" ? <>
      <path d="M12 3 2.8 20h18.4z" /><path d="M12 9v5M12 17h.01" />
    </> : <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
    </>}
  </svg>;
}

/**
 * Legacy props remain optional so historical tests and host integrations can
 * render the deterministic plan while they migrate. They are intentionally
 * ignored: Screen 6 never dispatches or displays model personalization.
 */
export function Screen6CurrentPlanPanel(props: {
  plan: Screen6CurrentPlan;
  designMap?: Screen6DesignMapProjection;
  workflowState?: SixScreenWorkflowState;
  eventWorkspace?: StudyFirstEventInvestigationWorkspace;
  onDownloadFile?: SixScreenFileDownloader;
  personalization?: Personalization | null;
  historicalPersonalization?: Personalization | null;
  disabled?: boolean;
  unavailableReason?: string | null;
  onPersonalize?: () => Promise<void>;
  personalizationBusy?: boolean;
  authorizationDetails?: string;
}) {
  const { plan } = props;
  // Screen 6 is deliberately deterministic: opening and rendering this panel
  // never dispatches a model request. It projects the reviewed local plan.
  const guidance = screen6EffectiveGuidance(plan, null);
  const designMap = props.designMap ?? createScreen6DesignMapProjection(plan);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [exportError, setExportError] = useState("");
  const [reportDownload, setReportDownload] = useState<SixScreenDownloadResult | null>(null);
  async function exportCompleteReport(format: "pdf" | "docx") {
    if (!props.workflowState || exporting) return;
    setExporting(format);
    setExportError("");
    setReportDownload(null);
    try {
      const { downloadCompleteReport } = await import("./complete-report");
      setReportDownload(await downloadCompleteReport({ state: props.workflowState, plan, designMap,
        eventWorkspace: props.eventWorkspace },
        props.onDownloadFile, format));
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message
        : "The report could not be downloaded. Try exporting again.");
    } finally {
      setExporting(null);
    }
  }
  const guidanceReport = <div className="six-current-plan-guidance">
    <div className="six-current-plan-section-label">
      <h3>Priority challenge plan</h3>
      <p>These checks are derived directly from the saved policy evidence,
        comparison, alternative shocks, and mechanism review.</p>
    </div>
    <div className="six-current-plan-columns">
      <section aria-label="Ten uncertainty dimensions" className="six-current-plan-profile">
        <h3>Uncertainty profile</h3>
        <ol>
          {guidance.dimensions.map((dimension) => (
            <li key={dimension.id}>
              <div className="six-current-plan-dimension-heading">
                <span>{dimension.title.text}</span>
                <small>{dimension.state}</small>
              </div>
              <p>{dimension.specificConcern.text}</p>
              <details>
                <summary>Basis, next check, limit and references</summary>
                <p><strong>Known basis.</strong> {dimension.knownBasis.text}</p>
                <p><strong>Next check.</strong> {dimension.nextCheck.text}</p>
                <p><strong>Limit.</strong> {dimension.materialLimit.text}</p>
                <p><strong>Saved source or proposition basis.</strong></p>
                {dimension.sourceRefs.length ? <ul>{dimension.sourceRefs.map((id: string) => {
                  const info = screen6ReferenceInfo(plan, id);
                  return <li key={id}>{info.url
                    ? <a href={info.url} target="_blank" rel="noreferrer">{info.label}</a>
                    : info.label} <small>({id})</small></li>;
                })}</ul> : <p>No source proposition is attached to this summary.</p>}
                <p><strong>Researcher input fields.</strong> {dimension.inputRefs.join(", ") || "None recorded"}</p>
                <small>{dimension.knownBasis.origin.replaceAll("_", " ")} guidance.</small>
              </details>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Planned diagnostic checks" className="six-current-plan-priorities">
        <h3>What to examine</h3>
        <ol>
          {guidance.cards.slice(0, 5).map((card) => (
            <li key={card.id}>
              <div className="six-current-plan-priority-title">
                <strong>{card.label}</strong>
                <small>Planned · {card.category.replaceAll("_", " ")}</small>
              </div>
              <p><strong>Why here.</strong> {card.priorityReason.text}</p>
              <p><strong>Check.</strong> {card.practicalCheck.text}</p>
              <p><strong>Limit.</strong> {card.reassuranceLimit.text}</p>
              <details>
                <summary>Procedure, evidence and interpretation details</summary>
                <dl>
                  <dt>Study question</dt><dd>{card.studyQuestion.text}</dd>
                  <dt>What is needed</dt><dd>{card.dataNeeds.text}</dd>
                  <dt>What to examine</dt><dd>{card.practicalCheck.text}</dd>
                  <dt>What raises concern</dt><dd>{card.concerningPattern.text}</dd>
                  <dt>Other interpretations</dt><dd>{card.alternativeExplanation.text}</dd>
                  <dt>What reassurance cannot establish</dt><dd>{card.reassuranceLimit.text}</dd>
                  <dt>If concern remains</dt><dd>{card.nextAction.text}</dd>
                  <dt>Reviewed procedure</dt><dd><ul>{card.procedure.map((step) => <li key={step}>{step}</li>)}</ul></dd>
                  <dt>Other responses, when applicable</dt><dd><ul>{card.response.slice(1).map((step) => <li key={step}>{step}</li>)}</ul></dd>
                  <dt>Reviewed limits</dt><dd><ul>{card.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul></dd>
                  <dt>Reviewed method references</dt><dd>{card.references.join(", ") || "Policy eligibility documents and study design"}</dd>
                  <dt>Saved source or assumption IDs</dt><dd>{card.evidenceRefs?.join(", ") || "Researcher proposal; no source ID established"}</dd>
                  <dt>Guidance origin</dt><dd>{card.priorityReason.origin.replaceAll("_", " ")}; question {card.studyQuestion.origin.replaceAll("_", " ")}; check {card.practicalCheck.origin.replaceAll("_", " ")}; limit {card.reassuranceLimit.origin.replaceAll("_", " ")}; action {card.nextAction.origin.replaceAll("_", " ")}.</dd>
                </dl>
              </details>
            </li>
          ))}
        </ol>
        {guidance.cards.length > 5 ? <details>
          <summary>{guidance.cards.length - 5} additional planned checks</summary>
          <ol>{guidance.cards.slice(5).map((card) => <li key={card.id}>
            <strong>{card.label}</strong>
            <p>{card.priorityReason.text}</p>
            <p><strong>Check.</strong> {card.practicalCheck.text}</p>
            <p><strong>Limit.</strong> {card.reassuranceLimit.text}</p>
            <p><strong>Next.</strong> {card.nextAction.text}</p>
          </li>)}</ol>
        </details> : null}
      </section>
    </div>
    <section className="six-current-plan-boundary" aria-label="Conditional claim boundary">
      <h3>Conditional claim boundary</h3>
      <p><strong>Planned target.</strong> {guidance.boundary.plannedTarget.text}</p>
      <p><strong>Required assumptions.</strong> {guidance.boundary.requiredAssumptions.text}</p>
      <p><strong>Stronger claims not established.</strong> {guidance.boundary.strongerClaims.text}</p>
      <p><strong>Next action.</strong> {guidance.boundary.nextAction.text}</p>
      <small>{plan.boundary.recommendation} is planning advice, not a researcher decision.</small>
    </section>
    {guidance.gaps.length ? (
      <details className="six-current-plan-gaps">
        <summary>{guidance.gaps.length} remaining prerequisites and limits</summary>
        <ul>{guidance.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
      </details>
    ) : null}
  </div>;
  return (
    <section className="six-current-plan six-design-map"
      aria-label="Visual design dependency map">
      <header className="six-design-map-header">
        <p className="six-kicker">Screen 6</p>
        <h2>YOUR DESIGN MAP</h2>
        <p>See how the pieces of your proposed natural experiment fit
          together, what they depend on, and what still needs your attention.</p>
      </header>

      <dl className="six-design-map-summary" aria-label="Study summary">
        {designMap.summary.map((item) => <div key={item.label}>
          <dt>{item.label}</dt><dd>{item.value}</dd>
        </div>)}
      </dl>

      <p className="six-design-map-legend">
        <span aria-hidden="true" />
        Connections show how each study component informs the proposed
        comparison; they do not represent causal findings.
      </p>

      <section className="six-design-map-canvas"
        aria-label="Design dependency relationships">
        <svg className="six-design-map-connectors" viewBox="0 0 1000 720"
          preserveAspectRatio="none" aria-hidden="true">
          <g>
            <path d="M500 175 C500 230 500 255 500 300" />
            <path d="M235 360 C335 360 365 350 410 350" />
            <path d="M235 585 C350 585 360 460 420 405" />
            <path d="M765 175 C660 175 640 260 585 310" />
            <path d="M765 360 C665 360 635 350 590 350" />
            <path d="M765 585 C650 585 640 460 580 405" />
          </g>
        </svg>

        {designMap.panels.map((item) => <article key={item.id}
          className={`six-design-map-card six-design-map-card--${item.id}`}
          data-state={item.state}>
          <div className="six-design-map-card-heading">
            <span><DesignMapIcon id={item.id} /></span>
            <div><h3>{item.title}</h3><small>{item.statusLabel}</small></div>
          </div>
          <dl>{item.rows.map((row, index) => <div key={`${row.label}-${index}`}
            data-state={row.state}>
            <dt>{row.label}</dt><dd>{row.value}</dd>
          </div>)}</dl>
          <p className="six-design-map-card-relation">
            <strong>Role in the design</strong>{item.relation}
          </p>
        </article>)}

        <section className="six-design-map-center"
          data-state={designMap.comparison.state}
          aria-label="Your proposed comparison">
          <p>YOUR PROPOSED COMPARISON</p>
          <h3>{designMap.comparison.method}</h3>
          <dl>
            <div><dt>Treatment</dt><dd>{designMap.comparison.treatment}</dd></div>
            <div><dt>Comparison</dt><dd>{designMap.comparison.comparisonGroup}</dd></div>
            <div><dt>Timing</dt><dd>{designMap.comparison.timing}</dd></div>
            <div><dt>Outcome target</dt><dd>{designMap.comparison.outcomeTarget}</dd></div>
          </dl>
          <small>{designMap.comparison.note}</small>
        </section>
      </section>

      <div className="six-design-map-lower">
        <section className="six-design-map-attention"
          aria-labelledby="screen6-attention-heading">
          <p className="six-kicker">Review next</p>
          <h3 id="screen6-attention-heading">Key Dependencies Requiring Attention</h3>
          <ul>{designMap.attention.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="six-design-map-boundary"
          aria-labelledby="screen6-boundary-heading">
          <p className="six-kicker">Interpretation limit</p>
          <h3 id="screen6-boundary-heading">Current Claim Boundary</h3>
          <p><strong>Planned target.</strong>{" "}
            {designMap.boundary.plannedTarget}</p>
          <details>
            <summary>Assumptions and claims not established</summary>
            <h4>Required assumptions</h4>
            <ul>{designMap.boundary.requiredAssumptions.map((item) =>
              <li key={item}>{item}</li>)}</ul>
            <h4>Not established here</h4>
            <ul>{designMap.boundary.unsupportedClaims.map((item) =>
              <li key={item}>{item}</li>)}</ul>
          </details>
          <p><strong>Next action.</strong> {designMap.boundary.nextAction}</p>
        </section>
      </div>

      <details id="screen6-detailed-checks" className="six-design-map-details">
        <summary>Detailed design checks</summary>
        {guidanceReport}
      </details>
      <div className="six-actions six-design-map-actions">
        {(["pdf", "docx"] as const).map((format) => <button key={format}
          type="button" className={format === "pdf" ? "six-report-export" : "six-report-export six-secondary"}
          disabled={Boolean(exporting) || !props.workflowState}
          aria-busy={exporting === format}
          onClick={() => void exportCompleteReport(format)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 14h8M8 17h5" />
          </svg>
          <strong>{exporting === format ? `Preparing ${format === "pdf" ? "PDF" : "Word"}…`
            : format === "pdf" ? "Create PDF" : "Create Word"}</strong>
        </button>)}
      </div>
      {exportError ? <p role="alert" className="six-report-export-error">{exportError}</p> : null}
      {reportDownload ? <p role="status" className="six-report-export-status">
        {reportDownload.status === "requested" ? "Report download requested." : <>
          Your report is ready. <a href={reportDownload.url} download={reportDownload.fileName}
            target="_blank" rel="noreferrer" onClick={(event) => {
              if (window.openai?.openExternal) {
                event.preventDefault();
                void Promise.resolve(window.openai.openExternal({ href: reportDownload.url }))
                  .catch(() => setExportError("The download link could not be opened. Export again to prepare a new link."));
              }
            }}>Download {reportDownload.fileName.endsWith(".docx") ? "Word report" : "PDF report"}</a>
        </>}
      </p> : null}

    </section>
  );
}
