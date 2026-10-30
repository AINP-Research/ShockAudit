import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import { fieldKeys } from "../../src/core/scope-types";
import Screen01, {
  screen02OpenFailureMessage,
} from "../../src/ui/screen-01/Screen01";
import {
  fieldMeta,
  nextStepCopy,
} from "../../src/ui/screen-01/content";
import { SHOCKAUDIT_RELEASE_LABEL } from "../../src/version";

describe("Screen 1 rendered interface", () => {
  it("preserves a safe Screen 2 diagnostic code in the visible retry message", () => {
    expect(
      screen02OpenFailureMessage(
        new Error(
          "Private workflow delivery failed. [SA-S2-RESULT-METADATA-TIMEOUT]",
        ),
      ),
    ).toContain("Reference: [SA-S2-RESULT-METADATA-TIMEOUT]");
    expect(screen02OpenFailureMessage(new Error("internal detail"))).toBe(
      "Screen 2 did not open. Refresh the ShockAudit connection and try again; your confirmed Scope Contract is still safe.",
    );
  });

  it("provides concept and decision guidance for every Scope Contract field", () => {
    expect(fieldMeta).toHaveLength(9);
    expect(fieldMeta.map((field) => field.key).sort()).toEqual(
      [...fieldKeys].sort(),
    );
    for (const field of fieldMeta) {
      expect(field.concept.length).toBeGreaterThan(30);
      expect(field.decisionPrompt.length).toBeGreaterThan(30);
      expect(field.example).toMatch(/^Example/);
    }
    const analysisHelp = fieldMeta.find(
      (field) => field.key === "analysisLevel",
    );
    expect(analysisHelp?.example).toContain("employee, firm, county, or country");
    expect(analysisHelp?.example).not.toContain("firm-year");
    expect(analysisHelp?.example).not.toContain("county-month");
  });

  it("renders the chosen wizard direction and all nine Scope Contract fields", () => {
    const html = renderToStaticMarkup(
      <Screen01
        state={createInitialState()}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
          canRequestAiReview: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain("Describe your study");
    expect(html).toContain("Find a shock");
    expect(html).toContain("Audit a known shock");
    expect(html).toContain('data-mode="find" tabindex="0"');
    expect(html).toContain('data-mode="audit" tabindex="-1"');
    expect(html).toContain('aria-label="Step 1: Describe study"');
    expect(html).toContain(
      'aria-label="Step 2: Choose feasible shock"',
    );
    expect(html).toContain(
      "Describe your study in your own words. ShockAudit compares that description with nine editable scope fields and flags only meaningful differences.",
    );
    expect(html).toContain("Review the Scope Contract");
    expect(html.match(/class=\"contract-field/g)).toHaveLength(9);
    expect(html.match(/class=\"field-help-button\"/g)).toHaveLength(9);
    expect(html).toContain(
      "Population identifies who or what is studied. Geography identifies where those units and eligible shocks are located or governed.",
    );
    expect(html.match(/field-status-accepted/g)).toHaveLength(9);
    expect(html).toContain("Geography: United States. Status: Accepted");
    expect(html.match(/Can complete later/g)).toHaveLength(2);
    expect(html).toContain("All required scope decisions are complete.");
    expect(html).not.toContain("Resolve with guidance");
    expect(html).not.toContain("Which public firms are included in this study?");
    expect(html).not.toContain("What does “Public firms” mean here?");
    expect(html).toContain("ChatGPT composer available");
    expect(html).not.toContain("Ask ChatGPT");
    expect(html).toContain(`v${SHOCKAUDIT_RELEASE_LABEL}`);
  });

  it("uses Audit-specific wording without leaking shock-discovery copy", () => {
    const audit = createInitialState("audit");
    const confirmedAudit = confirmScopeContract({
      ...audit,
      scope: {
        ...audit.scope,
        population: "U.S. exchange-listed firms",
        assignmentLevel: "Firm",
      },
      resolvedKeys: ["population", "assignmentLevel"],
    }).state;
    const html = renderToStaticMarkup(
      <Screen01
        state={confirmedAudit}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain(
      'aria-label="Step 2: Represent known shock, available next"',
    );
    expect(html).not.toContain(
      'aria-label="Step 2: Choose feasible shock"',
    );
    expect(html).toContain(
      "Known-shock representation assessment is now unlocked for this study.",
    );
    expect(html).not.toContain("Shock discovery is now unlocked");
    expect(nextStepCopy.audit.screenTwoNotice).toContain(
      "exact known-shock anchor ready for identity review",
    );
    expect(nextStepCopy.audit.screenTwoNotice).not.toContain(
      "shock-discovery workflow",
    );
  });

  it("marks Screen 1 complete without marking unlocked Screen 2 complete", () => {
    const initial = createInitialState();
    const confirmed = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed firms",
        assignmentLevel: "Firm",
        outcomeFrequency: "Annual",
      },
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "outcomeFrequency",
      ],
    }).state;
    const html = renderToStaticMarkup(
      <Screen01
        state={confirmed}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain(
      'aria-label="Step 1: Describe study, complete"',
    );
    expect(html).toContain(
      'aria-label="Step 2: Choose feasible shock, available next"',
    );
    expect(html).toContain(
      '<span class="step-number" aria-hidden="true">✓</span>',
    );
    const stepTwo = html.split(
      'aria-label="Step 2: Choose feasible shock, available next"',
    )[1];
    expect(stepTwo?.slice(0, 220)).toContain(
      '<span class="step-number" aria-hidden="true">2</span>',
    );
  });

  it("shows a prominent responsive continuation action only after confirmation", () => {
    const initial = createInitialState();
    const unconfirmedHtml = renderToStaticMarkup(
      <Screen01
        state={initial}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );
    const confirmation = confirmScopeContract({
      ...initial,
      scope: {
        ...initial.scope,
        population: "U.S. exchange-listed firms",
        assignmentLevel: "Firm",
        outcomeFrequency: "Annual",
      },
      resolvedKeys: [
        "population",
        "assignmentLevel",
        "outcomeFrequency",
      ],
    });
    if (!confirmation.ok) throw new Error(confirmation.error);
    const confirmedHtml = renderToStaticMarkup(
      <Screen01
        state={confirmation.state}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(unconfirmedHtml).not.toContain(
      "Continue to shock feasibility",
    );
    const continueButton = confirmedHtml.match(
      /<button class="continue-screen-two"[^>]*>/,
    )?.[0];
    expect(continueButton).toBeDefined();
    expect(continueButton).not.toContain("disabled");
    expect(confirmedHtml).toContain("Continue to shock feasibility");

    const css = readFileSync(
      new URL(
        "../../src/ui/screen-01/screen-01.css",
        import.meta.url,
      ),
      "utf8",
    );
    const mobileStart = css.indexOf("@media (max-width: 620px)");
    const mobileEnd = css.indexOf(
      "@media (prefers-reduced-motion",
      mobileStart,
    );
    expect(mobileStart).toBeGreaterThan(-1);
    expect(mobileEnd).toBeGreaterThan(mobileStart);
    const mobileCss = css.slice(mobileStart, mobileEnd);
    expect(mobileCss).toMatch(
      /\.confirmation-and-continue\s*\{\s*grid-template-columns:\s*1fr;\s*\}/,
    );
    expect(mobileCss).toMatch(
      /\.continue-screen-two\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/,
    );
  });

  it("allows a manually aligned edited sentence without a ChatGPT drafting action", () => {
    const original =
      "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm innovation.";
    const sentence = original.replace(
      "manufacturing firms",
      "video gaming firms",
    );
    const initial = createInitialState("find", original);
    const aligned = {
      ...initial,
      sentence,
      scope: { ...initial.scope, industry: "Video gaming" },
      resolvedKeys: ["industry" as const],
      scopeDirty: true,
      confirmed: false,
    };
    const html = renderToStaticMarkup(
      <Screen01
        state={aligned}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
          canRequestAiReview: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain(
      "Your description and Scope Contract are aligned.",
    );
    expect(html).toContain("Confirm scope");
    expect(html).not.toContain("data-blocked=\"true\"");
    expect(html).not.toContain("scope fields with ChatGPT");
    expect(html).not.toContain("ChatGPT is drafting your scope");
    expect(html).not.toContain("Creating your scope draft");
  });

  it("shows one actionable industry warning for a real mismatch", () => {
    const sentence =
      "Find a regulatory shock affecting U.S. public video gaming firms between 2014 and 2022 that may influence firm innovation.";
    const mismatch = createInitialState(
      "find",
      sentence.replace("video gaming", "manufacturing"),
    );
    const html = renderToStaticMarkup(
      <Screen01
        state={{ ...mismatch, sentence, scopeDirty: true }}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
          canRequestAiReview: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("Not called during server rendering.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain("Industry may not match your description");
    expect(html).toContain(
      "Your description refers to Video gaming, while the Scope Contract currently says Manufacturing.",
    );
    expect(html).toContain("Use Video gaming");
    expect(html).toContain("Keep my Scope Contract value");
    expect(html).toContain("Review 1 alignment difference");
    const confirmButton = html.match(
      /<button[^>]*data-blocked="true"[^>]*aria-describedby="scope-confirmation-gate"[^>]*>/,
    )?.[0];
    expect(confirmButton).toBeDefined();
    expect(confirmButton).not.toContain("disabled");
  });

  it("keeps the client confirmation gate closed for a restored multiline field", () => {
    const state = createInitialState();
    const html = renderToStaticMarkup(
      <Screen01
        state={{
          ...state,
          scope: { ...state.scope, industry: "Manufacturing\nTechnology" },
        }}
        onStateChange={() => undefined}
        draftsByMode={{}}
        onRememberDraft={() => undefined}
        hostView={{
          connected: true,
          embedded: true,
          displayMode: "fullscreen",
          canFullscreen: true,
        }}
        onSaveState={() => undefined}
        onConfirm={async () => {
          throw new Error("The blocked client gate must not call confirmation.");
        }}
        onOpenNext={async () => true}
        onRequestFullscreen={async () => true}
      />,
    );

    expect(html).toContain(
      "Keep the study sentence and each Scope Contract value on one line.",
    );
    expect(html).toContain('data-blocked="true"');
  });
});
