import { readFileSync } from "node:fs";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Screen03LoadBoundary, {
  Screen03LoadFailure,
} from "../../src/ui/screen-03/screen03-load-boundary";

function elementWithTestId(
  node: ReactNode,
  testId: string,
): ReactElement | null {
  if (!isValidElement(node)) return null;
  const props = node.props as {
    children?: ReactNode;
    "data-testid"?: string;
  };
  if (props["data-testid"] === testId) return node;
  for (const child of Children.toArray(props.children)) {
    const found = elementWithTestId(child, testId);
    if (found) return found;
  }
  return null;
}

describe("Screen 3 lazy-load recovery", () => {
  it("offers a latest-app reload without discarding the saved workflow", () => {
    const reload = vi.fn();
    const failure = Screen03LoadFailure({ onReload: reload });
    const html = renderToStaticMarkup(failure);
    expect(html).toContain("Screen 3 could not load");
    expect(html).toContain("saved ShockAudit workflow is still intact");
    expect(html).toContain("Reload this ShockAudit card");
    expect(html).toContain("open the latest ShockAudit card");
    expect(Screen03LoadBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });

    const button = elementWithTestId(failure, "screen03-load-reload");
    expect(button).not.toBeNull();
    (button!.props as { onClick: () => void }).onClick();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps static lazy loading and reloads without clearing workflow state", () => {
    const appSource = readFileSync(
      new URL("../../src/ui/App.tsx", import.meta.url),
      "utf8",
    );
    expect(appSource).toContain(
      'const Screen03 = lazy(() => import("./screen-03/Screen03"));',
    );
    expect(appSource).not.toContain("@vite-ignore");
    expect(appSource).not.toContain("screen03RetryModuleUrl");
    expect(appSource).not.toContain("loadScreen03Module");

    const boundaryStart = appSource.indexOf("<Screen03LoadBoundary");
    const boundaryEnd = appSource.indexOf(
      "</Screen03LoadBoundary>",
      boundaryStart,
    );
    expect(boundaryStart).toBeGreaterThan(-1);
    expect(boundaryEnd).toBeGreaterThan(boundaryStart);
    const boundarySource = appSource.slice(boundaryStart, boundaryEnd);
    expect(boundarySource).toContain(
      "onReload={() => window.location.reload()}",
    );
    expect(boundarySource).toContain("state={screen03Workflow}");
    expect(boundarySource).not.toContain("setScreen03Workflow");
    expect(boundarySource).not.toContain("clearScreen03Workflow");
  });
});
