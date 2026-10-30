import type {
  Stage1OverallJudgment,
} from "../../core/stage1-assessment-proof";
import type {
  HostView,
  Stage1ProofWidgetSnapshot,
} from "../mcp-bridge";

type Stage1AssessmentProofProps = {
  snapshot: Stage1ProofWidgetSnapshot;
  hostView: HostView;
  onRequestAssessment: () => void;
  onRequestFullscreen: () => Promise<boolean>;
};

const statusCopy: Record<
  Stage1ProofWidgetSnapshot["status"],
  { title: string; detail: string }
> = {
  prepared: {
    title: "Preparing the assessment…",
    detail:
      "The source-backed candidate is ready. No model assessment has been requested yet.",
  },
  sending: {
    title: "Preparing the assessment…",
    detail:
      "ShockAudit is sharing the bounded evidence packet and posting the visible request.",
  },
  "message-delivered": {
    title: "Assessment requested. Waiting for ChatGPT…",
    detail:
      "The host accepted the follow-up message. This confirms delivery only; completion still requires the matching model-only tool receipt.",
  },
  completed: {
    title: "Assessment ready.",
    detail:
      "A matching model tool call was observed, validated, and applied by fixed code.",
  },
  rejected: {
    title: "The assessment response was incomplete or invalid.",
    detail:
      "The model called the expected tool, but fixed validation rejected one or more fields. Candidate facts remain unchanged.",
  },
  "delivery-rejected": {
    title: "The assessment request was not confirmed as sent.",
    detail:
      "The host rejected delivery or did not acknowledge it within the safety window. The factual candidate remains available and no completed proof is recorded.",
  },
  "timed-out": {
    title: "The assessment timed out.",
    detail:
      "The follow-up message was delivered, but no matching assessment tool receipt was observed within 120 seconds.",
  },
};

function judgmentLabel(value: Stage1OverallJudgment) {
  return {
    "promising-to-verify": "Promising to verify",
    "worth-exploring": "Worth exploring",
    "low-priority": "Low priority",
    "not-enough-evidence": "Not enough evidence",
  }[value];
}

function categoryLabel(value: string) {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default function Stage1AssessmentProof({
  snapshot,
  hostView,
  onRequestAssessment,
  onRequestFullscreen,
}: Stage1AssessmentProofProps) {
  const { open, result } = snapshot;
  const { request, packet } = open;
  const copy = statusCopy[snapshot.status];
  const assessment = result?.assessment;
  const requestPending = ["sending", "message-delivered"].includes(
    snapshot.status,
  );
  const canRequest =
    hostView.canRequestAiReview &&
    !requestPending &&
    snapshot.status !== "completed";

  return (
    <main className="stage1-proof-shell">
      <header className="stage1-proof-header">
        <div>
          <span className="stage1-proof-kicker">
            Screen 2 · v0.2.21 development proof
          </span>
          <h1>Stage 1 assessment handshake</h1>
          <p>
            One immutable candidate tests whether a real ChatGPT turn can
            produce a bounded assessment tool call. This is not the rebuilt
            Find or Audit interface.
          </p>
        </div>
        {hostView.embedded && hostView.displayMode !== "fullscreen" && (
          <button
            type="button"
            className="stage1-proof-secondary"
            onClick={() => void onRequestFullscreen()}
            disabled={!hostView.canFullscreen}
          >
            Open fullscreen
          </button>
        )}
      </header>

      <section className="stage1-proof-boundary" aria-label="Scope boundary">
        <strong>Boundary</strong>
        <span>
          Screen 2 identifies and preliminarily evaluates the event. Screen 3
          verifies what changed, when it changed, and which organizations were
          formally covered.
        </span>
      </section>

      <section className="stage1-proof-study" aria-labelledby="proof-study">
        <div className="stage1-proof-section-heading">
          <span>Source-backed fact</span>
          <h2 id="proof-study">Confirmed study and candidate</h2>
        </div>
        <dl className="stage1-proof-facts">
          <div>
            <dt>Study</dt>
            <dd>
              {packet.study.population}; {packet.study.period}; {packet.study.outcomeFamily}
            </dd>
          </div>
          <div>
            <dt>Study geography</dt>
            <dd>{packet.study.studyGeography}</dd>
          </div>
          <div>
            <dt>Candidate</dt>
            <dd>{packet.candidate.title}</dd>
          </div>
          <div>
            <dt>Issuer and jurisdiction</dt>
            <dd>
              {packet.candidate.issuingAuthority}; {packet.candidate.issuingJurisdiction}
            </dd>
          </div>
          <div>
            <dt>Main date lead</dt>
            <dd>{packet.candidate.mainDateLead} · provisional</dd>
          </div>
          <div>
            <dt>Broad apparent coverage</dt>
            <dd>{packet.candidate.broadApparentCoverage}</dd>
          </div>
        </dl>
        <div className="stage1-proof-claims">
          <h3>Evidence packet</h3>
          <ul>
            {packet.claims.map((claim) => (
              <li key={claim.id}>{claim.fact}</li>
            ))}
          </ul>
        </div>
        <div className="stage1-proof-sources">
          {packet.sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.title}
              <span>{source.publisher}</span>
            </a>
          ))}
        </div>
      </section>

      <section
        className={`stage1-proof-status stage1-proof-status-${snapshot.status}`}
        aria-live="polite"
      >
        <div>
          <span className="stage1-proof-status-dot" aria-hidden="true" />
          <div>
            <strong>{copy.title}</strong>
            <p>{copy.detail}</p>
          </div>
        </div>
        {!assessment && (
          <button
            type="button"
            onClick={onRequestAssessment}
            disabled={!canRequest}
          >
            {snapshot.status === "rejected" ||
            snapshot.status === "delivery-rejected" ||
            snapshot.status === "timed-out"
              ? "Start a fresh proof request"
              : requestPending
                ? "Waiting for tool receipt"
                : "Request assessment from ChatGPT"}
          </button>
        )}
      </section>

      {assessment && result && (
        <section
          className="stage1-proof-assessment"
          aria-labelledby="proof-assessment"
        >
          <div className="stage1-proof-section-heading">
            <span>AI preliminary interpretation</span>
            <h2 id="proof-assessment">Early research assessment</h2>
          </div>
          <div className="stage1-proof-judgment">
            <span>Fixed computation</span>
            <strong>{judgmentLabel(assessment.overallJudgment)}</strong>
            <p>
              Derived from the three categorical findings. ChatGPT did not
              submit this label or a numerical score.
            </p>
          </div>
          <div className="stage1-proof-components">
            {[
              ["Study fit", assessment.studyFit],
              ["Outcome pathway", assessment.outcomePathway],
              ["Measurement potential", assessment.measurementPotential],
            ].map(([label, component]) => {
              const finding = component as typeof assessment.studyFit;
              return (
                <article key={String(label)}>
                  <span>{String(label)}</span>
                  <strong>{categoryLabel(finding.category)}</strong>
                  <p>{finding.explanation}</p>
                </article>
              );
            })}
          </div>
          <div className="stage1-proof-concern">
            <h3>Main concern</h3>
            <p>{assessment.mainConcern}</p>
            <h3>What to check next</h3>
            <ol>
              {assessment.nextChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ol>
          </div>
          <div className="stage1-proof-gate">
            <span>Fixed computation</span>
            <strong>
              {result.selectionGate.eligible
                ? "Eligible for tentative selection"
                : "Not eligible for selection"}
            </strong>
            <p>
              This gate does not verify timing, formal coverage, exposure, or
              causal validity.
            </p>
          </div>
        </section>
      )}

      {result?.status === "rejected" && (
        <section className="stage1-proof-errors" aria-label="Validation errors">
          <h2>Fixed validation findings</h2>
          <ul>
            {result.rejectionReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="stage1-proof-receipt">
        <summary>Proof identity and receipt</summary>
        <dl>
          <div>
            <dt>Request ID</dt>
            <dd>{request.requestId}</dd>
          </div>
          <div>
            <dt>Request correlation fingerprint</dt>
            <dd>{request.requestProof}</dd>
          </div>
          <div>
            <dt>Candidate snapshot</dt>
            <dd>{request.candidateSnapshotId}</dd>
          </div>
          <div>
            <dt>Candidate fingerprint</dt>
            <dd>{request.candidateFingerprint}</dd>
          </div>
          {snapshot.messageDeliveredAt && (
            <div>
              <dt>Message delivered</dt>
              <dd>{snapshot.messageDeliveredAt}</dd>
            </div>
          )}
          {result && (
            <>
              <div>
                <dt>Receipt ID</dt>
                <dd>{result.receiptId}</dd>
              </div>
              <div>
                <dt>Draft fingerprint</dt>
                <dd>{result.draftFingerprint}</dd>
              </div>
              <div>
                <dt>Applied result fingerprint</dt>
                <dd>{result.appliedResultFingerprint}</dd>
              </div>
            </>
          )}
        </dl>
      </details>
    </main>
  );
}
