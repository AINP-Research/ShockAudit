import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";

import {
  confirmScopeContract,
  createInitialState,
  type ConfirmScopeResult,
} from "../../core/screen01-service";
import {
  alignScopeContractToSentence,
  createScopeAlignmentAcknowledgment,
} from "../../core/scope-alignment";
import { buildScreen01StudyContext } from "../../core/study-context";
import type {
  Ambiguity,
  FieldKey,
  Mode,
  ScopeFieldAlignment,
  Screen01State,
  Screen01StudyContext,
} from "../../core/scope-types";
import {
  canConfirmScope,
  getAmbiguities,
  isPlaceholderValue,
  validateSentence,
  validateScopeInputLines,
  validateStudyPeriod,
} from "../../core/scope-validation";
import {
  sameResearchInputs,
  type HostView,
} from "../mcp-bridge";
import {
  fieldMeta,
  modeCopy,
  nextStepCopy,
  screenCopy,
  stepsByMode,
} from "./content";

type Props = {
  state: Screen01State;
  onStateChange: Dispatch<SetStateAction<Screen01State>>;
  draftsByMode: Partial<Record<Mode, Screen01State>>;
  onRememberDraft: (mode: Mode, state: Screen01State) => void;
  hostView: HostView;
  onSaveState: (
    state: Screen01State,
    ambiguities: Ambiguity[],
  ) => void | Promise<void>;
  onConfirm: (state: Screen01State) => Promise<ConfirmScopeResult>;
  onOpenNext: (context: Screen01StudyContext) => Promise<boolean>;
  onRequestFullscreen: () => Promise<boolean>;
};

const screen02OpenFailureBase =
  "Screen 2 did not open. Refresh the ShockAudit connection and try again; your confirmed Scope Contract is still safe.";

export function screen02OpenFailureMessage(error?: unknown) {
  const diagnostic =
    error instanceof Error
      ? error.message.match(/\[SA-S2-[A-Z0-9-]+\]/)?.[0]
      : undefined;
  return diagnostic
    ? `${screen02OpenFailureBase} Reference: ${diagnostic}.`
    : screen02OpenFailureBase;
}

export default function Screen01({
  state,
  onStateChange: setState,
  draftsByMode,
  onRememberDraft,
  hostView,
  onSaveState,
  onConfirm,
  onOpenNext,
  onRequestFullscreen,
}: Props) {
  const [editorKey, setEditorKey] = useState<FieldKey | "knownShock" | null>(
    null,
  );
  const [editorValue, setEditorValue] = useState("");
  const [editorError, setEditorError] = useState("");
  const [resolverOpen, setResolverOpen] = useState(false);
  const [screenTwoNotice, setScreenTwoNotice] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openingScreenTwo, setOpeningScreenTwo] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [helpFieldKey, setHelpFieldKey] = useState<FieldKey | null>(null);
  const editorInputRef = useRef<HTMLInputElement>(null);
  const resolverFirstOptionRef = useRef<HTMLButtonElement>(null);
  const fieldHelpCloseRef = useRef<HTMLButtonElement>(null);
  const ambiguityRef = useRef<HTMLDivElement>(null);
  const sentenceInputRef = useRef<HTMLTextAreaElement>(null);
  const alignmentRef = useRef<HTMLDivElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const latestStateRef = useRef(state);
  const latestSaveRef = useRef<{
    state: Screen01State;
    ambiguities: Ambiguity[];
    onSaveState: Props["onSaveState"];
  } | null>(null);
  latestStateRef.current = state;

  const sentenceError = validateSentence(state.sentence);
  const ambiguities = useMemo(
    () =>
      getAmbiguities({
        scope: state.scope,
        mode: state.mode,
        sentence: state.sentence,
        knownShock: state.knownShock,
        resolvedKeys: state.resolvedKeys,
      }),
    [
      state.knownShock,
      state.mode,
      state.resolvedKeys,
      state.scope,
      state.sentence,
    ],
  );
  const currentAmbiguity = ambiguities[0];
  latestSaveRef.current = { state, ambiguities, onSaveState };
  const studyPeriodValue = state.scope.studyPeriod.trim();
  const studyPeriodError =
    studyPeriodValue && studyPeriodValue !== "Not specified"
      ? validateStudyPeriod(studyPeriodValue)
      : "";
  const scopeInputError = validateScopeInputLines({
    sentence: state.sentence,
    scope: state.scope,
    mode: state.mode,
    knownShock: state.knownShock,
  });
  const alignment = useMemo(
    () =>
      alignScopeContractToSentence({
        sentence: state.sentence,
        scope: state.scope,
        acknowledgedDifferences: state.acknowledgedDifferences,
      }),
    [
      state.acknowledgedDifferences,
      state.scope,
      state.sentence,
    ],
  );
  const alignmentMismatches = alignment.blockingMismatches.filter(
    (mismatch) =>
      !ambiguities.some((ambiguity) => ambiguity.key === mismatch.key),
  );
  const canConfirm = canConfirmScope({
    sentenceError,
    scopeError: scopeInputError || studyPeriodError,
    ambiguities,
    alignment,
    confirmed: state.confirmed,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void onSaveState(state, ambiguities);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ambiguities, onSaveState, state]);

  useEffect(
    () => () => {
      const latest = latestSaveRef.current;
      if (latest) {
        void latest.onSaveState(latest.state, latest.ambiguities);
      }
    },
    [],
  );

  useEffect(() => {
    if (editorKey) {
      window.setTimeout(() => editorInputRef.current?.focus(), 20);
    }
  }, [editorKey]);

  useEffect(() => {
    if (resolverOpen) {
      window.setTimeout(() => resolverFirstOptionRef.current?.focus(), 20);
    }
  }, [resolverOpen]);

  useEffect(() => {
    if (helpFieldKey) {
      window.setTimeout(() => fieldHelpCloseRef.current?.focus(), 20);
    }
  }, [helpFieldKey]);

  const gateMessage = state.confirmed
    ? "Screen 1 is complete."
    : sentenceError
      ? sentenceError
      : scopeInputError
        ? scopeInputError
      : studyPeriodError
          ? studyPeriodError
          : ambiguities.length > 0
            ? `Resolve ${ambiguities.length} scope ${
                ambiguities.length === 1 ? "decision" : "decisions"
              } to continue.`
            : alignment.blockingMismatches.length > 0
              ? `Review ${alignment.blockingMismatches.length} description and Scope Contract ${
                  alignment.blockingMismatches.length === 1
                    ? "difference"
                    : "differences"
                } to continue.`
              : "All required scope decisions are complete.";

  function resetCompletion(nextState: Screen01State): Screen01State {
    return {
      ...nextState,
      revision: nextState.revision + 1,
      confirmed: false,
    };
  }

  function changeMode(nextMode: Mode) {
    if (nextMode === state.mode) return;
    onRememberDraft(state.mode, state);
    setState(draftsByMode[nextMode] ?? createInitialState(nextMode));
    setScreenTwoNotice(false);
    setConfirmationError("");
  }

  function handleModeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentMode: Mode,
  ) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const nextMode: Mode = currentMode === "find" ? "audit" : "find";
    changeMode(nextMode);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-mode="${nextMode}"]`)
        ?.focus();
    });
  }

  function updateSentence(value: string) {
    setState((current) =>
      resetCompletion({
        ...current,
        sentence: value,
        acknowledgedDifferences: [],
        scopeDirty: true,
      }),
    );
    setScreenTwoNotice(false);
    setConfirmationError("");
  }

  function rememberDialogTrigger() {
    if (document.activeElement instanceof HTMLElement) {
      dialogTriggerRef.current = document.activeElement;
    }
  }

  function restoreDialogTrigger() {
    window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
  }

  function trapDialogFocus(
    event: ReactKeyboardEvent<HTMLElement>,
    close: () => void,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openEditor(key: FieldKey | "knownShock", rememberTrigger = true) {
    if (rememberTrigger) rememberDialogTrigger();
    setEditorKey(key);
    setEditorValue(key === "knownShock" ? state.knownShock : state.scope[key]);
    setEditorError("");
  }

  function closeEditor() {
    setEditorKey(null);
    setEditorError("");
    restoreDialogTrigger();
  }

  function closeResolver(restoreTrigger = true) {
    setResolverOpen(false);
    if (restoreTrigger) restoreDialogTrigger();
  }

  function openFieldHelp(key: FieldKey) {
    rememberDialogTrigger();
    setHelpFieldKey(key);
  }

  function closeFieldHelp() {
    setHelpFieldKey(null);
    restoreDialogTrigger();
  }

  function saveEditor() {
    if (!editorKey) return;
    const value = editorValue.trim();
    if (!value) {
      setEditorError("Enter a value before saving.");
      return;
    }
    if (value.length > 200) {
      setEditorError("Keep this value at 200 characters or fewer.");
      return;
    }

    if (editorKey === "studyPeriod") {
      const periodError = validateStudyPeriod(value);
      if (periodError) {
        setEditorError(periodError);
        return;
      }
    }

    setState((current) => {
      const resolvedKeys = current.resolvedKeys.includes(editorKey)
        ? current.resolvedKeys
        : [...current.resolvedKeys, editorKey];

      if (editorKey === "knownShock") {
        return resetCompletion({
          ...current,
          knownShock: value,
          resolvedKeys,
        });
      }

      return resetCompletion({
        ...current,
        scope: { ...current.scope, [editorKey]: value },
        resolvedKeys,
        acknowledgedDifferences: current.acknowledgedDifferences?.filter(
          (acknowledgment) => acknowledgment.key !== editorKey,
        ),
      });
    });
    setConfirmationError("");
    setScreenTwoNotice(false);
    closeEditor();
  }

  function applyResolution(value: string) {
    if (!currentAmbiguity || currentAmbiguity.key === "knownShock") return;
    const key = currentAmbiguity.key;
    setState((current) =>
      resetCompletion({
        ...current,
        scope: { ...current.scope, [key]: value },
        resolvedKeys: current.resolvedKeys.includes(key)
          ? current.resolvedKeys
          : [...current.resolvedKeys, key],
        acknowledgedDifferences: current.acknowledgedDifferences?.filter(
          (acknowledgment) => acknowledgment.key !== key,
        ),
      }),
    );
    closeResolver();
    setConfirmationError("");
  }

  function useAlignmentSuggestion(mismatch: ScopeFieldAlignment) {
    if (!mismatch.suggestedValue) return;
    setState((current) =>
      resetCompletion({
        ...current,
        scope: {
          ...current.scope,
          [mismatch.key]: mismatch.suggestedValue ?? current.scope[mismatch.key],
        },
        resolvedKeys: current.resolvedKeys.includes(mismatch.key)
          ? current.resolvedKeys
          : [...current.resolvedKeys, mismatch.key],
        acknowledgedDifferences: current.acknowledgedDifferences?.filter(
          (acknowledgment) => acknowledgment.key !== mismatch.key,
        ),
      }),
    );
    setConfirmationError("");
    setScreenTwoNotice(false);
  }

  function keepScopeContractValue(mismatch: ScopeFieldAlignment) {
    setState((current) => {
      const acknowledgment = createScopeAlignmentAcknowledgment({
        key: mismatch.key,
        sentence: current.sentence,
        scopeValue: current.scope[mismatch.key],
      });
      return resetCompletion({
        ...current,
        acknowledgedDifferences: [
          ...(current.acknowledgedDifferences ?? []).filter(
            (candidate) => candidate.key !== mismatch.key,
          ),
          acknowledgment,
        ],
      });
    });
    setConfirmationError("");
    setScreenTwoNotice(false);
  }

  function resolveCurrentAmbiguity() {
    if (!currentAmbiguity) return;
    rememberDialogTrigger();
    setResolverOpen(true);
  }

  async function confirmScope() {
    if (confirming || state.confirmed) return;
    if (!canConfirm) {
      setConfirmationError(gateMessage);
      if (sentenceError) {
        sentenceInputRef.current?.focus();
      } else if (currentAmbiguity) {
        ambiguityRef.current?.focus();
      } else if (studyPeriodError) {
        openEditor("studyPeriod", false);
      } else if (alignment.blockingMismatches.length > 0) {
        alignmentRef.current?.focus();
      }
      return;
    }
    setConfirming(true);
    setConfirmationError("");
    const submittedState = state;
    try {
      const result = await onConfirm(submittedState);
      if (
        latestStateRef.current.revision !== submittedState.revision ||
        !sameResearchInputs(latestStateRef.current, submittedState)
      ) {
        setConfirmationError(
          "Your study changed while ShockAudit was checking it. Review the latest draft and confirm again.",
        );
        return;
      }
      if (!result.ok) {
        setConfirmationError(result.error);
        return;
      }
      const expectedConfirmation = confirmScopeContract(submittedState);
      if (!expectedConfirmation.ok) {
        setConfirmationError(expectedConfirmation.error);
        return;
      }
      const expectedConfirmedState = expectedConfirmation.state;
      if (
        result.state.revision !== submittedState.revision ||
        !sameResearchInputs(expectedConfirmedState, result.state) ||
        !result.state.confirmed
      ) {
        setConfirmationError(
          "Your study changed while ShockAudit was checking it. Review the latest draft and confirm again.",
        );
        return;
      }
      setState(result.state);
      setScreenTwoNotice(false);
    } catch {
      setConfirmationError(
        "ShockAudit could not verify the scope. Please try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function continueToScreen02() {
    if (!state.confirmed || openingScreenTwo) return;
    setOpeningScreenTwo(true);
    setScreenTwoNotice(false);
    setConfirmationError("");
    const context = buildScreen01StudyContext(state, ambiguities);
    try {
      const opened = await onOpenNext(context);
      if (!opened) {
        setConfirmationError(screen02OpenFailureMessage());
        return;
      }
      setScreenTwoNotice(true);
    } catch (error) {
      setConfirmationError(screen02OpenFailureMessage(error));
    } finally {
      setOpeningScreenTwo(false);
    }
  }

  const editorLabel =
    editorKey === "knownShock"
      ? "Known shock"
      : fieldMeta.find((field) => field.key === editorKey)?.label;
  const editorField =
    editorKey === "knownShock"
      ? null
      : fieldMeta.find((field) => field.key === editorKey);
  const activeHelpField = fieldMeta.find(
    (field) => field.key === helpFieldKey,
  );
  const resolverField =
    currentAmbiguity?.key === "knownShock"
      ? null
      : fieldMeta.find((field) => field.key === currentAmbiguity?.key);

  return (
    <main className="workspace-shell">
      <header className="app-header">
        <div className="brand-lockup" aria-label="ShockAudit">
          <span className="brand-waves" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">ShockAudit</span>
          <span className="brand-descriptor">{screenCopy.eyebrow}</span>
        </div>
        <div className="header-actions">
          {hostView.connected && (
            <span
              className="composer-status"
              title="Use the normal ChatGPT composer for questions about this screen"
            >
              <span aria-hidden="true">✦</span>
              ChatGPT composer available
            </span>
          )}
          {hostView.canFullscreen && hostView.displayMode !== "fullscreen" && (
            <button
              className="fullscreen-button"
              type="button"
              onClick={() => void onRequestFullscreen()}
            >
              Fullscreen
            </button>
          )}
          <a
            className="version-badge"
            href={`https://github.com/AINP-Research/ShockAudit/commit/${__SHOCKAUDIT_COMMIT__}`}
            target="_blank"
            rel="noreferrer"
            title="Open this exact source-code version on GitHub"
          >
            v{__SHOCKAUDIT_VERSION__} · {__SHOCKAUDIT_COMMIT__}
          </a>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="progress-rail" aria-label="ShockAudit workflow">
          <ol>
            {stepsByMode[state.mode].map((step, index) => {
              const stepNumber = index + 1;
              const active = stepNumber === 1;
              const completed = state.confirmed && active;
              const unlocked = state.confirmed && stepNumber === 2;
              return (
                <li
                  className={`${active ? "active" : ""} ${
                    completed ? "completed" : ""
                  } ${unlocked ? "unlocked" : ""}`}
                  key={step}
                >
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-disabled={
                      (!active && !unlocked) ||
                      (unlocked && openingScreenTwo)
                    }
                    disabled={unlocked && openingScreenTwo}
                    aria-label={`Step ${stepNumber}: ${step}${
                      completed
                        ? ", complete"
                        : unlocked
                          ? ", available next"
                          : ""
                    }`}
                    onClick={() => {
                      if (unlocked && !openingScreenTwo) {
                        void continueToScreen02();
                      }
                    }}
                    tabIndex={active || unlocked ? 0 : -1}
                  >
                    <span className="step-number" aria-hidden="true">
                      {completed ? "✓" : stepNumber}
                    </span>
                    <span className="step-label">{step}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="main-workspace">
          <div className="mobile-progress" aria-label="Workflow progress">
            <span>Step 1 of 8</span>
            <strong>Describe study</strong>
          </div>

          <div className="title-block">
            <h1>{screenCopy.title}</h1>
            <p>{screenCopy.subtitle}</p>
          </div>

          <section className="workflow-section">
            <div className="section-heading">
              <span aria-hidden="true">1</span>
              <h2>{screenCopy.chooseStartingPoint}</h2>
            </div>
            <div
              className="mode-grid"
              role="radiogroup"
              aria-label="Starting point"
            >
              {(["find", "audit"] as Mode[]).map((item) => {
                const selected = state.mode === item;
                return (
                  <button
                    className={`mode-card ${selected ? "selected" : ""}`}
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-mode={item}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => changeMode(item)}
                    onKeyDown={(event) => handleModeKeyDown(event, item)}
                  >
                    <span className={`mode-icon ${item}`} aria-hidden="true">
                      {item === "find" ? (
                        <span className="search-mark" />
                      ) : (
                        <span>▤</span>
                      )}
                    </span>
                    <span className="mode-copy">
                      <strong>{modeCopy[item].title}</strong>
                      <span>{modeCopy[item].description}</span>
                    </span>
                    <span className="selection-check" aria-hidden="true">
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="workflow-section description-section">
            <div className="section-heading">
              <span aria-hidden="true">2</span>
              <h2>{modeCopy[state.mode].sectionTitle}</h2>
            </div>
            <div className="study-input">
              <label className="sr-only" htmlFor="study-sentence">
                Study description
              </label>
              <textarea
                ref={sentenceInputRef}
                id="study-sentence"
                value={state.sentence}
                onChange={(event) => updateSentence(event.target.value)}
                maxLength={350}
                aria-invalid={Boolean(sentenceError)}
                aria-describedby={
                  sentenceError ? "sentence-error" : "sentence-help"
                }
              />
              <span className="edit-glyph" aria-hidden="true">
                ✎
              </span>
            </div>
            <div className="description-meta">
              <span
                id={sentenceError ? "sentence-error" : "sentence-help"}
                className={sentenceError ? "input-error" : ""}
              >
                {sentenceError || screenCopy.sentenceHelp}
              </span>
              <span className="description-actions">
                <span>{state.sentence.length}/350</span>
              </span>
            </div>
          </section>

          <section className="workflow-section contract-section">
            <div className="section-heading">
              <span aria-hidden="true">3</span>
              <h2>{screenCopy.reviewContract}</h2>
            </div>
            <p className="contract-help">{screenCopy.contractHelp}</p>

            {state.mode === "audit" && (
              <button
                className={`known-shock-row ${
                  !state.knownShock ? "needs-decision" : ""
                }`}
                type="button"
                onClick={() => openEditor("knownShock")}
              >
                <span>
                  <small>Known shock</small>
                  <strong>{state.knownShock || "Not specified"}</strong>
                </span>
                <span className="pencil-button" aria-hidden="true">
                  ✎
                </span>
              </button>
            )}

            <div className="contract-card">
              <div className="contract-grid">
                {fieldMeta.map((field) => {
                  const fieldAmbiguity = ambiguities.find(
                    (ambiguity) => ambiguity.key === field.key,
                  );
                  const fieldAlignment = alignment.fields.find(
                    (candidate) => candidate.key === field.key,
                  );
                  const hasAlignmentMismatch =
                    fieldAlignment?.status === "possible-mismatch";
                  const isMissing =
                    Boolean(fieldAmbiguity) &&
                    isPlaceholderValue(state.scope[field.key]);
                  const fieldStatus = fieldAmbiguity
                    ? isMissing
                      ? "Missing"
                      : "Needs clarification"
                    : hasAlignmentMismatch
                      ? "May not match"
                      : fieldAlignment?.status ===
                          "researcher-acknowledged-difference"
                        ? "Difference kept"
                    : "Accepted";
                  const canCompleteLater =
                    !fieldAmbiguity &&
                    (field.key === "assignmentLevel" ||
                      field.key === "outcomeFrequency") &&
                    isPlaceholderValue(state.scope[field.key]);
                  return (
                    <div
                      className={`contract-field ${
                        fieldAmbiguity || hasAlignmentMismatch
                          ? "ambiguous"
                          : "accepted"
                      }`}
                      key={field.key}
                    >
                      <span className="field-heading">
                        <small className="field-label">
                          {field.label}
                          {(fieldAmbiguity || hasAlignmentMismatch) && (
                            <>
                              <span
                                className="ambiguity-dot"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                , {fieldAmbiguity
                                  ? "needs a decision"
                                  : "may not match the description"}
                              </span>
                            </>
                          )}
                        </small>
                        <span
                          className={`field-status field-status-${fieldStatus
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {fieldStatus}
                        </span>
                        <button
                          className="field-help-button"
                          type="button"
                          onClick={() => openFieldHelp(field.key)}
                          aria-label={`Explain ${field.label}`}
                          aria-haspopup="dialog"
                          title={`What is ${field.label.toLowerCase()}?`}
                        >
                          ?
                        </button>
                      </span>
                      <button
                        className="field-value-button"
                        type="button"
                        title={state.scope[field.key]}
                        onClick={() => openEditor(field.key)}
                        aria-label={`Edit ${field.label}: ${
                          state.scope[field.key]
                        }. Status: ${fieldStatus}`}
                      >
                        <strong>{state.scope[field.key]}</strong>
                        <span className="pencil-button" aria-hidden="true">
                          ✎
                        </span>
                      </button>
                      {canCompleteLater && (
                        <small className="field-deferral">
                          Can complete later
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>

              {currentAmbiguity && (
                <div
                  className="ambiguity-panel"
                  ref={ambiguityRef}
                  tabIndex={-1}
                  role="region"
                  aria-labelledby="scope-decision-title"
                >
                  <span className="question-icon" aria-hidden="true">
                    !
                  </span>
                  <span className="ambiguity-copy">
                    <strong id="scope-decision-title">
                      {currentAmbiguity.key === "knownShock"
                        ? "Known shock needs a decision"
                        : `${
                            fieldMeta.find(
                              (field) =>
                                field.key === currentAmbiguity.key,
                            )?.label ?? "Scope field"
                          } needs a decision`}
                    </strong>
                    <span>
                      {screenCopy.decisionNotice}
                      {ambiguities.length > 1
                        ? ` ${ambiguities.length - 1} more scope ${
                            ambiguities.length - 1 === 1
                              ? "decision remains"
                              : "decisions remain"
                          }.`
                        : ""}
                    </span>
                  </span>
                  <span className="ambiguity-actions">
                    <button type="button" onClick={resolveCurrentAmbiguity}>
                      Resolve with guidance
                    </button>
                  </span>
                </div>
              )}
            </div>

            {alignmentMismatches.length > 0 && (
              <div
                className="alignment-review"
                ref={alignmentRef}
                tabIndex={-1}
                role="region"
                aria-label="Description and Scope Contract differences"
              >
                {alignmentMismatches.map((mismatch) => {
                  const label =
                    fieldMeta.find((field) => field.key === mismatch.key)
                      ?.label ?? "Scope field";
                  return (
                    <section className="alignment-warning" key={mismatch.key}>
                      <div>
                        <strong>{label} may not match your description</strong>
                        <p>
                          Your description refers to {mismatch.sentenceValue},
                          while the Scope Contract currently says {mismatch.scopeValue}.
                        </p>
                      </div>
                      <div className="alignment-actions">
                        {mismatch.suggestedValue && (
                          <button
                            type="button"
                            onClick={() => useAlignmentSuggestion(mismatch)}
                          >
                            Use {mismatch.suggestedValue}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => keepScopeContractValue(mismatch)}
                        >
                          Keep my Scope Contract value
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {!sentenceError &&
              !studyPeriodError &&
              ambiguities.length === 0 &&
              alignment.alignedForConfirmation && (
                <div className="alignment-success" role="status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>
                      Your description and Scope Contract are aligned.
                    </strong>
                    {alignment.acknowledgedDifferences.length > 0 && (
                      <small>
                        Your intentional Scope Contract difference is preserved.
                      </small>
                    )}
                  </div>
                </div>
              )}

            {state.confirmed && (
              <div className="confirmation-and-continue">
                <div className="confirmation-strip" role="status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>{screenCopy.confirmed}</strong>
                    <p>{nextStepCopy[state.mode].confirmedDetail}</p>
                  </div>
                </div>
                <button
                  className="continue-screen-two"
                  type="button"
                  onClick={() => void continueToScreen02()}
                  disabled={openingScreenTwo}
                  aria-busy={openingScreenTwo}
                >
                  {openingScreenTwo
                    ? "Opening Screen 2…"
                    : "Continue to shock feasibility"}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            {screenTwoNotice && (
              <div className="screen-two-notice" role="status">
                {nextStepCopy[state.mode].screenTwoNotice}
                <button type="button" onClick={() => setScreenTwoNotice(false)}>
                  Dismiss
                </button>
              </div>
            )}

            {confirmationError && (
              <p className="confirmation-error" role="alert">
                {confirmationError}
              </p>
            )}

            <div className="confirm-row">
              <span
                id="scope-confirmation-gate"
                className={
                  ambiguities.length ||
                  alignment.blockingMismatches.length ||
                  sentenceError
                    ? "blocked"
                    : ""
                }
              >
                {gateMessage}
              </span>
              <button
                className={state.confirmed ? "confirmed" : ""}
                type="button"
                onClick={() => void confirmScope()}
                disabled={confirming || state.confirmed}
                data-blocked={!canConfirm && !state.confirmed ? "true" : undefined}
                aria-describedby="scope-confirmation-gate"
              >
                {confirming
                  ? "Checking scope…"
                  : state.confirmed
                    ? screenCopy.confirmed
                    : !canConfirm && Boolean(sentenceError)
                      ? screenCopy.fixDescription
                    : !canConfirm && ambiguities.length > 0
                        ? `Review ${ambiguities.length} remaining ${
                            ambiguities.length === 1 ? "choice" : "choices"
                          }`
                        : !canConfirm && alignment.blockingMismatches.length > 0
                          ? `Review ${alignment.blockingMismatches.length} alignment ${
                              alignment.blockingMismatches.length === 1
                                ? "difference"
                                : "differences"
                            }`
                        : screenCopy.confirmScope}
              </button>
            </div>
          </section>
        </section>
      </div>

      {editorKey && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeEditor();
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            onKeyDown={(event) => trapDialogFocus(event, closeEditor)}
          >
            <span className="dialog-kicker">Scope Contract</span>
            <h2 id="edit-dialog-title">Edit {editorLabel}</h2>
            <p>
              Use the exact boundary you want ShockAudit to carry into later
              screens. ShockAudit will check that it is specific and consistent
              with the study description.
            </p>
            {editorField && (
              <div className="field-help-decision">
                <strong>What belongs here</strong>
                <p>{editorField.decisionPrompt}</p>
                <small>{editorField.example}</small>
              </div>
            )}
            <label htmlFor="field-editor">{editorLabel}</label>
            <input
              ref={editorInputRef}
              id="field-editor"
              value={editorValue}
              maxLength={200}
              onChange={(event) => {
                setEditorValue(event.target.value);
                setEditorError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveEditor();
              }}
              aria-invalid={Boolean(editorError)}
              aria-describedby={editorError ? "editor-error" : undefined}
            />
            {editorError && (
              <span className="dialog-error" id="editor-error">
                {editorError}
              </span>
            )}
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={closeEditor}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={saveEditor}>
                Save value
              </button>
            </div>
          </section>
        </div>
      )}

      {activeHelpField && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeFieldHelp();
          }}
        >
          <section
            className="dialog field-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-help-dialog-title"
            onKeyDown={(event) => trapDialogFocus(event, closeFieldHelp)}
          >
            <span className="dialog-kicker">Scope concept</span>
            <h2 id="field-help-dialog-title">
              What is {activeHelpField.label.toLowerCase()}?
            </h2>
            <p>{activeHelpField.concept}</p>
            <div className="field-help-decision">
              <strong>What you decide here</strong>
              <p>{activeHelpField.decisionPrompt}</p>
              <small>{activeHelpField.example}</small>
            </div>
            <div className="dialog-actions">
              <button
                ref={fieldHelpCloseRef}
                type="button"
                className="primary"
                onClick={closeFieldHelp}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {resolverOpen && currentAmbiguity && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeResolver();
          }}
        >
          <section
            className="dialog resolver-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolver-dialog-title"
            onKeyDown={(event) => trapDialogFocus(event, () => closeResolver())}
          >
            <span className="dialog-kicker">Boundary guidance</span>
            <h2 id="resolver-dialog-title">{currentAmbiguity.title}</h2>
            <p>{currentAmbiguity.question}</p>
            {resolverField && (
              <div className="resolver-context">
                <strong>{resolverField.label}</strong>
                <p>{resolverField.concept}</p>
              </div>
            )}
            <div className="resolution-options">
              {currentAmbiguity.choices?.map((choice, index) => (
                <button
                  ref={index === 0 ? resolverFirstOptionRef : undefined}
                  type="button"
                  key={choice.value}
                  onClick={() => applyResolution(choice.value)}
                >
                  <span>
                    <strong>{choice.label}</strong>
                    {choice.recommended && (
                      <small>Recommended for this study</small>
                    )}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              <button
                ref={
                  currentAmbiguity.choices?.length
                    ? undefined
                    : resolverFirstOptionRef
                }
                className="manual-choice"
                type="button"
                onClick={() => {
                  closeResolver(false);
                  openEditor(currentAmbiguity.key, false);
                }}
              >
                <span>
                  <strong>
                    {currentAmbiguity.choices?.length
                      ? currentAmbiguity.key === "population"
                        ? "Use my own population definition"
                        : "Use my own value"
                      : `Specify ${
                          currentAmbiguity.key === "knownShock"
                            ? "the known shock"
                            : resolverField?.label.toLowerCase()
                        }`}
                  </strong>
                  <small>
                    {currentAmbiguity.key === "knownShock"
                      ? "Name the event in your own words"
                      : resolverField?.decisionPrompt}
                  </small>
                </span>
                <span aria-hidden="true">✎</span>
              </button>
            </div>
            <button
              type="button"
              className="dialog-close"
              onClick={() => closeResolver()}
            >
              Cancel
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
