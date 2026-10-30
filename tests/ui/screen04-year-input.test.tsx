import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Screen04YearInput, {
  screen04YearDraft,
} from "../../src/ui/screen-04/Screen04YearInput";

describe("Screen 4 year input", () => {
  it("preserves every incremental draft while publishing only a four-digit year", () => {
    const expected = [
      { draft: "2", value: null, valid: false },
      { draft: "20", value: null, valid: false },
      { draft: "202", value: null, valid: false },
      { draft: "2020", value: 2020, valid: true },
    ];

    let typed = "";
    expect([..."2020"].map((character) => {
      typed += character;
      return screen04YearDraft(typed);
    })).toEqual(expected);
  });

  it("supports deletion, paste or autofill replacement, and bounded validation", () => {
    expect(screen04YearDraft("")).toEqual({
      draft: "",
      value: null,
      valid: false,
    });
    expect(screen04YearDraft("2018")).toEqual({
      draft: "2018",
      value: 2018,
      valid: true,
    });
    expect(screen04YearDraft("999").valid).toBe(false);
    expect(screen04YearDraft("10000").valid).toBe(false);
    expect(screen04YearDraft("20a0").valid).toBe(false);
  });

  it("renders a keyboard and autofill friendly controlled text field", () => {
    const html = renderToStaticMarkup(
      <Screen04YearInput
        required
        value={2020}
        onValueChange={vi.fn()}
        aria-label="Treatment year"
      />,
    );

    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('pattern="[0-9]{4}"');
    expect(html).toContain('value="2020"');
  });
});
