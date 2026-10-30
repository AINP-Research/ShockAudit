import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import Screen02WorkflowShell from "../../src/ui/screen-02/Screen02WorkflowShell";
import type { HostView } from "../../src/ui/mcp-bridge";

const hostView: HostView = {
  connected: true,
  embedded: true,
  displayMode: "fullscreen",
  canFullscreen: false,
  canSendMessage: true,
  canRequestAiReview: true,
};

function baseline(mode: "find" | "audit" = "find") {
  const initial = createInitialState(mode);
  return buildScreen01StudyContext(
    { ...initial, confirmed: true },
    [],
  );
}

function renderShell(
  status: "ready" | "opening" | "failed",
  mode: "find" | "audit" = "find",
) {
  return renderToStaticMarkup(
    <Screen02WorkflowShell
      baseline={baseline(mode)}
      hostView={hostView}
      status={status}
      errorMessage="The canonical opener did not return a usable result."
      onBack={vi.fn()}
      onRetry={vi.fn()}
      onRequestFullscreen={vi.fn()}
    >
      <main data-testid="canonical-child">Canonical Screen 2</main>
    </Screen02WorkflowShell>,
  );
}

function visibleText(markup: string) {
  return markup.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function expectProviderNeutral(markup: string) {
  expect(visibleText(markup)).not.toMatch(
    /\b(?:ChatGPT|host|model|MCP|inference|fallback|provider|reasoning|tool|AI)\b/iu,
  );
}

describe("Screen02WorkflowShell", () => {
  it("renders one complete desktop workflow rail with only Screen 1 actionable", () => {
    const html = renderShell("ready");

    expect(html.match(/<li/g)).toHaveLength(7);
    expect(html).toContain(
      'aria-label="Step 1: Describe study, complete; return to Screen 1"',
    );
    expect(html).toContain(
      'aria-label="Step 2: Choose feasible shock, current"',
    );
    expect(html).toContain('aria-current="step"');
    expect(html.match(/disabled=""/g)).toHaveLength(5);
    expect(html).toContain('data-testid="canonical-child"');
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain("Guided review available");
    expectProviderNeutral(html);
  });

  it("renders the responsive mobile back control and Audit-specific Step 2 copy", () => {
    const html = renderShell("ready", "audit");

    expect(html).toContain('class="s2w-mobile-progress"');
    expect(html).toContain("Step 2 of 7");
    expect(html).toContain("Represent known shock");
    expect(html).toContain("Screen 1</button>");
  });

  it("keeps the confirmed baseline visible with a compact inline opening status", () => {
    const html = renderShell("opening");

    expect(html).toContain('data-testid="screen02-preparation"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Preparing Screen 2…");
    expect(html).toContain("Your study boundary is ready");
    expect(html).toContain(baseline().studySentence);
    expect(html).not.toContain('data-testid="canonical-child"');
    expect(html.match(/<main/g)).toHaveLength(1);
  });

  it("keeps the same shell and baseline around an inline retryable failure", () => {
    const html = renderShell("failed");

    expect(html).toContain('data-status="failed"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Screen 2 needs another attempt");
    expect(html).toContain(
      "The canonical opener did not return a usable result.",
    );
    expect(html).toContain("Retry opening Screen 2");
    expect(html).toContain("Back to Screen 1");
    expect(html).toContain("Your study boundary is ready");
  });

  it("keeps implementation-specific opener errors out of visible copy", () => {
    const html = renderToStaticMarkup(
      <Screen02WorkflowShell
        baseline={baseline()}
        hostView={hostView}
        status="failed"
        errorMessage="The ChatGPT host model MCP provider fallback reasoning tool failed."
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onRequestFullscreen={vi.fn()}
      />,
    );

    expect(html).toContain("assisted review");
    expect(html).toContain("alternate path");
    expectProviderNeutral(html);
  });

  it("makes the combined Screen 4 available only from the Screen 3 gate", () => {
    const html = renderToStaticMarkup(
      <Screen02WorkflowShell
        baseline={baseline()}
        hostView={hostView}
        activeStep={3}
        onBack={vi.fn()}
        onReturnToScreen2={vi.fn()}
        onResumeScreen4={vi.fn()}
        onRequestFullscreen={vi.fn()}
      >
        <main>Locked Event Card</main>
      </Screen02WorkflowShell>,
    );

    expect(html).toContain(
      'aria-label="Step 4: Audit exposure in your sample, available; open Screen 4"',
    );
    expect(html).toContain("Open Screen 4");
    expect(html).toContain("Step 3 of 7");
  });

  it("renders Screen 4 as the current combined workflow step", () => {
    const html = renderToStaticMarkup(
      <Screen02WorkflowShell
        baseline={baseline()}
        hostView={hostView}
        activeStep={4}
        onBack={vi.fn()}
        onReturnToScreen2={vi.fn()}
        onReturnToScreen3={vi.fn()}
        onRequestFullscreen={vi.fn()}
      >
        <main>Exposure audit</main>
      </Screen02WorkflowShell>,
    );

    expect(html).toContain(
      'aria-label="Step 4: Audit exposure in your sample, current"',
    );
    expect(html).toContain("Screen 3</button>");
    expect(html).toContain("Step 4 of 7");
  });
});
