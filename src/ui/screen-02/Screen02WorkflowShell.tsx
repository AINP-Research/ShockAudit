import { useState, type ReactNode } from "react";

import type { Screen02WorkflowState } from "../../core/screen02-workflow-types";
import {
  isScreen02StudyRelevanceProfile,
  type Screen02StudyRelevanceProfileResearcherEdits,
} from "../../core/screen02-relevance-profile";
import { fingerprintScreen02WorkflowValue } from
  "../../core/screen02-workflow-state";
import type { HostView } from "../mcp-bridge";
import { stepsByMode } from "../screen-01/content";
import { screen02ProviderNeutralCopy } from "./provider-neutral-copy";
import "./screen-02-workflow-shell.css";

export type Screen02WorkflowShellStatus =
  | "ready"
  | "opening"
  | "failed";

export type Screen02WorkflowShellProps = {
  baseline: Screen02WorkflowState["screen01Baseline"];
  hostView: HostView;
  /** Defaults to Screen 2 so every released Screen 2 caller is unchanged. */
  activeStep?: 2 | 3 | 4;
  status?: Screen02WorkflowShellStatus;
  errorMessage?: string | null;
  notice?: ReactNode;
  children?: ReactNode;
  onBack: () => void;
  onReturnToScreen2?: () => void;
  onReturnToScreen3?: () => void;
  onResumeScreen3?: () => void;
  onResumeScreen4?: () => void;
  screen3ActionLabel?: "Open Screen 3" | "Resume Screen 3";
  onRetry?: () => void;
  onRequestFullscreen: () => void | Promise<unknown>;
};

function Brand() {
  return (
    <div className="s2w-brand-lockup" aria-label="ShockAudit">
      <span className="s2w-brand-waves" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="s2w-brand-name">ShockAudit</span>
      <span className="s2w-brand-descriptor">
        Natural experiment design workspace
      </span>
    </div>
  );
}

function ConfirmedBaseline({
  baseline,
}: {
  baseline: Screen02WorkflowState["screen01Baseline"];
}) {
  const scope = baseline.scopeContract;
  const facts = [
    ["Population", scope.population],
    ["Geography", scope.geography],
    ["Study period", scope.studyPeriod],
    ["Industry", scope.industry],
    ["Event family", scope.eventFamily],
    ["Outcome", scope.outcomeFamily],
  ] as const;

  return (
    <section
      className="s2w-baseline"
      aria-labelledby="s2w-baseline-title"
    >
      <div className="s2w-baseline-heading">
        <div>
          <span>Confirmed on Screen 1</span>
          <h2 id="s2w-baseline-title">Your study boundary is ready</h2>
        </div>
        <span className="s2w-baseline-lock">Confirmed Scope Contract</span>
      </div>
      <p>{baseline.studySentence}</p>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PreparationPanel({
  baseline,
  status,
  errorMessage,
  onBack,
  onRetry,
}: Pick<
  Screen02WorkflowShellProps,
  "baseline" | "errorMessage" | "onBack" | "onRetry"
> & {
  status: Exclude<Screen02WorkflowShellStatus, "ready">;
}) {
  const opening = status === "opening";

  return (
    <main
      className="s2w-preparation"
      data-testid="screen02-preparation"
      aria-busy={opening}
    >
      <header className="s2w-preparation-title">
        <span>
          {baseline.startingPoint === "find"
            ? "Shock discovery"
            : "Known-shock audit"}
        </span>
        <h1>
          {baseline.startingPoint === "find"
            ? "Choose a feasible shock"
            : "Identify and understand your shock"}
        </h1>
      </header>

      <ConfirmedBaseline baseline={baseline} />

      {opening ? (
        <div
          className="s2w-inline-status"
          role="status"
          aria-live="polite"
        >
          <span className="s2w-status-dot" aria-hidden="true" />
          <div>
            <strong>Preparing Screen 2…</strong>
            <p>
              ShockAudit is opening the secure workspace for this confirmed
              study. Your Scope Contract remains unchanged.
            </p>
          </div>
        </div>
      ) : (
        <div className="s2w-inline-failure" role="alert">
          <strong>Screen 2 needs another attempt</strong>
          <p>
            {errorMessage
              ? screen02ProviderNeutralCopy(errorMessage)
              : "Screen 2 did not open. Your confirmed Scope Contract is still safe."}
          </p>
          <div className="s2w-failure-actions">
            {onRetry && (
              <button type="button" onClick={onRetry}>
                Retry opening Screen 2
              </button>
            )}
            <button
              type="button"
              className="s2w-secondary-action"
              onClick={onBack}
            >
              Back to Screen 1
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const profileFieldLabels = {
  industryAliases: "Industry aliases",
  subsectors: "Subsectors",
  regulatedActivities: "Regulated activities",
  contrastTerms: "Contrast terms",
  falseFriends: "Terms to exclude",
} as const;

export function screen02FindProfileFormKey(profileValue: unknown) {
  return isScreen02StudyRelevanceProfile(profileValue)
    ? fingerprintScreen02WorkflowValue(profileValue)
    : "screen02-profile-unavailable";
}

/** Shared with the deferred Find view so this editor stays in the shell. */
export function Screen02FindProfileEditor({
  industry,
  profile: profileValue,
  buttonClassName,
  onSave,
  onEditStudy,
}: {
  industry: string;
  profile: unknown;
  buttonClassName: string;
  onSave?: (edit: Screen02StudyRelevanceProfileResearcherEdits) => void;
  onEditStudy: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const profile = isScreen02StudyRelevanceProfile(profileValue)
    ? profileValue
    : null;
  const needsClarification = profile?.status === "needs-clarification";
  // These inputs deliberately keep local browser drafts until submission.
  // Remount the form when the canonical profile changes so an alternative
  // selection, host enrichment, or saved revision cannot leave stale
  // defaultValue state that a later Save would silently write back.
  const profileFormKey = screen02FindProfileFormKey(profile);
  return (
    <details
      className="s2-find-industry-interpretation"
      open={needsClarification || undefined}
    >
      <summary>
        {needsClarification
          ? "Clarify the industry before searching"
          : "Inspect or edit the study profile"}
      </summary>
      <p>
        “{industry}” is matched against source-backed event scope; broader
        cross-industry shocks stay separate.
      </p>
      {profile && needsClarification && (
        <section
          className="s2-find-profile-clarification"
          data-testid="screen02-profile-clarification"
          role="alert"
        >
          <strong>
            {profile.ambiguity?.question ??
              "Which economic activity is in scope?"}
          </strong>
          <p>
            {profile.ambiguity?.explanation ??
              "Enter a distinctive industry, product, service, or business activity."}
          </p>
          {profile.interpretationAlternatives.length > 0 && onSave && (
            <div
              className="s2-find-profile-alternatives"
              role="group"
              aria-label="Industry interpretation choices"
            >
              {profile.interpretationAlternatives.map((alternative) => (
                <button
                  key={alternative.canonicalCode}
                  className={buttonClassName}
                  type="button"
                  onClick={() => {
                    onSave({
                      canonicalIndustryLabel: alternative.canonicalLabel,
                      canonicalIndustryCode: alternative.canonicalCode,
                    });
                    setSaved(true);
                  }}
                >
                  <strong>{alternative.canonicalLabel}</strong>
                  <span>{alternative.description}</span>
                </button>
              ))}
            </div>
          )}
          <p>
            Choose an interpretation above or edit the industry clarification
            below. Candidate search stays paused until this is resolved.
          </p>
        </section>
      )}
      {profile && onSave ? (
        <form key={profileFormKey} onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const terms = (name: string) => String(data.get(name) ?? "")
            .split(",").map((value) => value.trim()).filter(Boolean);
          onSave({
            canonicalIndustryLabel:
              String(data.get("canonicalIndustryLabel") ?? "").trim(),
            industryAliases: terms("industryAliases"),
            subsectors: terms("subsectors"),
            regulatedActivities: terms("regulatedActivities"),
            contrastTerms: terms("contrastTerms"),
            falseFriends: terms("falseFriends"),
          });
          setSaved(true);
        }}>
          <label>
            Industry clarification
            <input
              name="canonicalIndustryLabel"
              defaultValue={profile.canonicalIndustryLabel}
              required
            />
          </label>
          <p>
            <strong>Study geography:</strong> {profile.sampleGeography} (fixed
            by the confirmed study)
          </p>
          {profile.canonicalIndustryCode && (
            <p>
              <strong>Canonical industry code:</strong>{" "}
              {profile.canonicalIndustryCode}
            </p>
          )}
          {Object.entries(profileFieldLabels).map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                name={field}
                defaultValue={profile[
                  field as keyof typeof profileFieldLabels
                ].join(", ")}
                aria-describedby="s2-find-profile-list-help"
              />
            </label>
          ))}
          <p id="s2-find-profile-list-help">
            Separate terms with commas; add, revise, or remove terms before
            saving.
          </p>
          <button className={buttonClassName} type="submit">Save profile</button>
          {saved && (
            <p role="status">Profile update submitted for this Screen 2 run.</p>
          )}
        </form>
      ) : (
        <p role="status">
          The editable relevance profile is unavailable for this run. Refresh
          Screen 2 before editing.
        </p>
      )}
      <button
        className={buttonClassName}
        type="button"
        onClick={onEditStudy}
      >
        Open full Screen 1 editor
      </button>
    </details>
  );
}

export default function Screen02WorkflowShell({
  baseline,
  hostView,
  activeStep = 2,
  status = "ready",
  errorMessage = null,
  notice = null,
  children,
  onBack,
  onReturnToScreen2,
  onReturnToScreen3,
  onResumeScreen3,
  onResumeScreen4,
  screen3ActionLabel = "Resume Screen 3",
  onRetry,
  onRequestFullscreen,
}: Screen02WorkflowShellProps) {
  const steps = stepsByMode[baseline.startingPoint];

  return (
    <div
      className="s2w-shell"
      data-testid="screen02-workflow-shell"
      data-status={status}
    >
      <header className="s2w-app-header">
        <Brand />
        <div className="s2w-header-actions">
          {hostView.canSendMessage && (
            <span className="s2w-composer-status">
              <span aria-hidden="true">✦</span>
              <span className="s2w-composer-label">
                Guided review available
              </span>
            </span>
          )}
          {hostView.canFullscreen && hostView.displayMode !== "fullscreen" && (
            <button
              className="s2w-fullscreen-button"
              type="button"
              onClick={() => void onRequestFullscreen()}
            >
              <span className="s2w-fullscreen-label-long">Fullscreen</span>
              <span className="s2w-fullscreen-label-short" aria-hidden="true">
                ⛶
              </span>
            </button>
          )}
          <a
            className="s2w-version-badge"
            href={`https://github.com/AINP-Research/ShockAudit/commit/${__SHOCKAUDIT_COMMIT__}`}
            target="_blank"
            rel="noreferrer"
            title="Open this exact source-code version on GitHub"
          >
            <span className="s2w-version-label-long">
              v{__SHOCKAUDIT_VERSION__} ·{" "}
            </span>
            {__SHOCKAUDIT_COMMIT__}
          </a>
        </div>
      </header>

      <div className="s2w-workspace-body">
        <aside className="s2w-progress-rail" aria-label="ShockAudit workflow">
          <ol>
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const completed = stepNumber < activeStep;
              const active = stepNumber === activeStep;
              const resumesScreen3 =
                activeStep === 2 && stepNumber === 3 && Boolean(onResumeScreen3);
              const resumesScreen4 =
                activeStep === 3 && stepNumber === 4 && Boolean(onResumeScreen4);
              const resumable = resumesScreen3 || resumesScreen4;
              const unavailable = stepNumber > activeStep && !resumable;
              const completedDestination =
                stepNumber === 1
                  ? onBack
                  : stepNumber === 2
                    ? onReturnToScreen2
                    : stepNumber === 3
                      ? onReturnToScreen3
                    : undefined;
              return (
                <li
                  className={
                    completed
                      ? "s2w-step--completed"
                      : active
                        ? "s2w-step--active"
                        : resumable
                          ? "s2w-step--resumable"
                        : "s2w-step--unavailable"
                  }
                  key={step}
                >
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-disabled={active ? true : undefined}
                    aria-label={`Step ${stepNumber}: ${step}${
                      completed
                        ? `, complete; return to Screen ${stepNumber}`
                        : active
                          ? ", current"
                          : resumable
                            ? `, available; ${resumesScreen4
                                ? "open Screen 4"
                                : screen3ActionLabel === "Open Screen 3"
                                  ? "open Screen 3"
                                  : "resume Screen 3"}`
                          : ", unavailable"
                    }`}
                    disabled={unavailable}
                    onClick={
                      completed
                        ? completedDestination
                        : resumable
                          ? resumesScreen4
                            ? onResumeScreen4
                            : onResumeScreen3
                          : undefined
                    }
                  >
                    <span className="s2w-step-number" aria-hidden="true">
                      {completed ? "✓" : stepNumber}
                    </span>
                    <span className="s2w-step-label">{step}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="s2w-content-column">
          <div className="s2w-mobile-progress" aria-label="Workflow progress">
            <button
              type="button"
              onClick={
                activeStep === 4 && onReturnToScreen3
                  ? onReturnToScreen3
                  : activeStep === 3 && onReturnToScreen2
                    ? onReturnToScreen2
                    : onBack
              }
            >
              <span aria-hidden="true">←</span>
              Screen {activeStep - 1}
            </button>
            <span>Step {activeStep} of {steps.length}</span>
            <strong>{steps[activeStep - 1]}</strong>
            {activeStep === 2 && onResumeScreen3 && (
              <button type="button" onClick={onResumeScreen3}>
                {screen3ActionLabel} <span aria-hidden="true">→</span>
              </button>
            )}
            {activeStep === 3 && onResumeScreen4 && (
              <button type="button" onClick={onResumeScreen4}>
                Open Screen 4 <span aria-hidden="true">→</span>
              </button>
            )}
          </div>

          {notice}
          {status === "ready" ? (
            <div className="s2w-ready-content">{children}</div>
          ) : (
            <PreparationPanel
              baseline={baseline}
              status={status}
              errorMessage={errorMessage}
              onBack={onBack}
              onRetry={onRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
}
