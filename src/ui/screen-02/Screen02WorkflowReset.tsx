import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import "./screen-02-workflow-reset.css";

export type Screen02WorkflowResetProps = {
  mode: "find" | "audit";
  buttonClassName: string;
  onReset: () => void;
};

function focusOnNextFrame(element: HTMLElement | null) {
  if (!element) return;
  if (typeof globalThis.requestAnimationFrame === "function") {
    globalThis.requestAnimationFrame(() => element.focus());
    return;
  }
  element.focus();
}

/**
 * Canonical Screen 2 runs inside an embedded app where native confirm dialogs
 * are not guaranteed to be available. Keep the destructive confirmation in
 * the document so keyboard, pointer, and assistive-technology users all reach
 * the same reset path.
 */
export default function Screen02WorkflowReset({
  mode,
  buttonClassName,
  onReset,
}: Screen02WorkflowResetProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) focusOnNextFrame(cancelRef.current);
  }, [open]);

  function close() {
    setOpen(false);
    focusOnNextFrame(triggerRef.current);
  }

  function confirm() {
    setOpen(false);
    onReset();
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  return (
    <>
      <button
        ref={triggerRef}
        className={buttonClassName}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Reset Screen 2
      </button>
      {open && (
        <div
          className="s2w-reset-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            className="s2w-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={trapFocus}
          >
            <span className="s2w-reset-kicker">Keep Screen 1 unchanged</span>
            <h2 id={titleId}>Reset Screen 2?</h2>
            <p id={descriptionId}>
              {mode === "find"
                ? "This clears the Screen 2 criteria, results, candidate review, assessment progress, and chosen shock. It starts a blank Find run while preserving the confirmed Screen 1 study exactly."
                : "This clears the Screen 2 source search, possible-match review, assessment progress, and confirmation decision. It starts a fresh Audit run while preserving the exact known-shock anchor and confirmed Screen 1 study."}
            </p>
            <div className="s2w-reset-dialog__actions">
              <button
                ref={cancelRef}
                className="s2w-reset-dialog__cancel"
                type="button"
                onClick={close}
              >
                Cancel
              </button>
              <button
                className="s2w-reset-dialog__confirm"
                type="button"
                aria-label="Confirm reset Screen 2"
                onClick={confirm}
              >
                Reset Screen 2
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
