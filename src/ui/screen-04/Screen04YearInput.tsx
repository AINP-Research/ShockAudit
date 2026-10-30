import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";

const minimumYear = 1000;
const maximumYear = 9999;

export type Screen04YearDraft = {
  draft: string;
  value: number | null;
  valid: boolean;
};

/**
 * Keep the text the researcher entered separate from the validated numeric
 * value. A controlled numeric field must not erase the intermediate `2`,
 * `20`, or `202` states while the researcher is entering `2020`.
 */
export function screen04YearDraft(value: string): Screen04YearDraft {
  const parsed = /^\d{4}$/u.test(value) ? Number(value) : Number.NaN;
  const valid = Number.isInteger(parsed) &&
    parsed >= minimumYear && parsed <= maximumYear;
  return {
    draft: value,
    value: valid ? parsed : null,
    valid,
  };
}

type Screen04YearInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  invalid?: boolean;
};

export default function Screen04YearInput({
  value,
  onValueChange,
  invalid = false,
  required = false,
  ...inputProps
}: Screen04YearInputProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [showDraftError, setShowDraftError] = useState(false);
  const editingRef = useRef(false);
  const messageId = `${useId()}-message`;

  useEffect(() => {
    // Parent updates caused by this field must not replace an incomplete local
    // draft with an empty string. External restoration/reset still synchronizes
    // whenever the field is not being edited.
    if (!editingRef.current) {
      setDraft(value === null ? "" : String(value));
    }
  }, [value]);

  function publish(nextDraft: string) {
    const next = screen04YearDraft(nextDraft);
    editingRef.current = true;
    setDraft(next.draft);
    setShowDraftError(false);
    if (next.value !== value) onValueChange(next.value);
  }

  function validateDraft() {
    editingRef.current = false;
    const result = screen04YearDraft(draft);
    setShowDraftError(!result.valid && draft.length > 0);
    if (result.value !== value) onValueChange(result.value);
  }

  const draftError = showDraftError && !screen04YearDraft(draft).valid;
  const describedBy = [inputProps["aria-describedby"], draftError ? messageId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <>
      <input
        {...inputProps}
        type="text"
        inputMode="numeric"
        pattern="[0-9]{4}"
        required={required}
        value={draft}
        aria-describedby={describedBy}
        aria-invalid={invalid || draftError || undefined}
        onFocus={() => {
          editingRef.current = true;
        }}
        onChange={(event) => publish(event.currentTarget.value)}
        onBlur={validateDraft}
      />
      {draftError && (
        <span
          id={messageId}
          className="s4-inline-message s4-inline-message--error"
          data-testid="screen04-year-message"
        >
          <strong>Enter a four-digit year</strong>
          Use a year from 1000 to 9999.
        </span>
      )}
    </>
  );
}
