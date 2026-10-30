import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  acceptanceCase,
  syntheticFixture,
  syntheticMutation,
} from "./ph1-fixture-adapter";

const source = readFileSync(new URL(
  "../../src/ui/six-screen/SixScreenApp.tsx",
  import.meta.url,
), "utf8");

function sourceBetween(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find source region ${start} … ${end}.`);
  }
  return source.slice(startIndex, endIndex);
}

describe("PH1 UI contract acceptance", () => {
  it("AC032 / FX06 / FX14 / MU13 scopes transient notices to their originating screen", () => {
    expect(acceptanceCase("AC032").fixture_ids).toEqual(
      expect.arrayContaining(["FX06", "FX14"]),
    );
    expect(syntheticMutation("MU13").id).toBe("MU13");

    const appState = sourceBetween(
      "type WorkflowScreenNumber =",
      "const viewEditVersion = useRef",
    );
    expect(appState).toContain(
      "Partial<Record<WorkflowScreenNumber, string>>",
    );
    expect(appState).toContain("screenNotices[viewScreen]");
    expect(appState).toContain("setScreenNotices");
    expect(appState).not.toContain(
      'const [notice, setNotice] = useState("")',
    );
  });

  it("AC037 / FX01 / FX17 / MU09 / MU10 groups citations by document version identity", () => {
    expect(acceptanceCase("AC037").fixture_ids).toEqual(
      expect.arrayContaining(["FX01", "FX17"]),
    );
    expect(syntheticMutation("MU09").id).toBe("MU09");
    expect(syntheticMutation("MU10").id).toBe("MU10");

    const citationGrouping = sourceBetween(
      "function PolicyClaimSources",
      "function PolicyBriefingSectionView",
    );
    expect.soft(citationGrouping).toContain(
      "claim.citation.documentVersionId",
    );
    expect.soft(citationGrouping).not.toContain(
      "claim.citation.canonicalUrl,\n      claim.citation.versionLabel",
    );
  });

  it("AC054 / FX12 acknowledges direct Screen 5 work before the provider completes", () => {
    expect(acceptanceCase("AC054").fixture_ids).toContain("FX12");
    expect(syntheticFixture("FX12").id).toBe("FX12");

    const labels = sourceBetween(
      "function screen5DirectActionLabel",
      "function localScreen5RecoveryStage",
    );
    const handler = sourceBetween(
      "async function advanceDirectScreen5",
      "async function continueToScreen5",
    );
    expect(labels).toContain("Generating alternative mechanisms…");
    expect(labels).toContain("Retrieving scholarship…");
    expect(handler.indexOf("setScreen5DirectAction(initialActionStage)"))
      .toBeLessThan(handler.indexOf("await mutate"));
    expect(source).toContain('className="six-direct-action-status"');
  });

  it("AC055 / FX11 distinguishes ready, retrieval, and rate-limit wait labels", () => {
    expect(acceptanceCase("AC055").fixture_ids).toContain("FX11");
    expect(syntheticFixture("FX11").id).toBe("FX11");

    const labels = sourceBetween(
      "function directScreen5StatusLabel",
      "function screen5DispositionIsInactive",
    );
    expect(labels).toMatch(
      /phase === "plan_ready"[\s\S]*literature checks not started/u,
    );
    expect(labels).toMatch(
      /phase === "retrieving"[\s\S]*Retrieving scholarship/u,
    );
    expect(labels).toMatch(
      /phase === "waiting_for_rate_limit"[\s\S]*waiting/iu,
    );
    expect(labels).not.toMatch(
      /phase === "plan_ready" \|\|[\s\S]{0,80}phase === "retrieving"/u,
    );
  });
});
