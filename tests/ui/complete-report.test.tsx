import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { completeReportFixture } from "../fixtures/complete-report";
import { createScreen6CurrentPlan, screen6RetainedEventInvestigation, screen6StateWithEventSource } from "../../src/core/six-screen/screen6-current-plan";
import { createScreen6DesignMapProjection } from "../../src/core/six-screen/screen6-design-map";
import { currentStudyDesignAdvice, currentStudyDesignSelection, currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext, SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION } from "../../src/core/six-screen/study-design-advice";
import { fingerprintSixScreenValue } from "../../src/core/six-screen/canonical";
import { decideStudyDesignAdvice, openScreen4 } from "../../src/core/six-screen/workflow";
import { createCompleteReport } from "../../src/ui/six-screen/complete-report-data";
import { generateCompleteReportPdf } from "../../src/ui/six-screen/complete-report-pdf";
import { Screen6CurrentPlanPanel } from "../../src/ui/six-screen/Screen6CurrentPlanPanel";
import { openScreenWithCanonicalRecovery, screen4EntryMatchesSelection, savedStudyDesignDecisionMatchesRequest,
  StudyDesignAdvicePanel } from "../../src/ui/six-screen/SixScreenApp";
import { SixScreenWorkflowResponseError } from "../../src/ui/six-screen/workflow-response";
import type { SixScreenWorkflowPrivateSnapshot } from "../../src/worker/six-screen-workflow-runtime";
import { SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS } from "../../src/core/six-screen/screen5-mechanism";
import { SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT } from "../../src/worker/screen5-mechanism-contract";
import { downloadCompleteReport } from "../../src/ui/six-screen/complete-report";

describe("complete research report and current design handoff", () => {
  it("allows a method selection after an earlier no-selection decision and shows saving feedback", () => {
    const initial = completeReportFixture(), advice = currentStudyDesignAdvice(initial)!;
    const state = decideStudyDesignAdvice(initial, { expectedRevision: initial.revision,
      adviceId: advice.adviceId, expectedAdviceFingerprint: advice.adviceFingerprint,
      decision: { mode: "no_selection" }, rationale: "Keep comparison choice open.", selectedAt: "2026-09-30T10:01:00.000Z" }).state;
    const workspace = { advice, timing: currentProposedTreatmentTiming(state),
      entryContext: currentScreen3StudyEntryContext(state), selection: currentStudyDesignSelection(state),
      methodLibraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION, contextualization: null } as never;
    const props = { workspace, disabled: false, onDecide: vi.fn(), onEdit: vi.fn() };
    const html = renderToStaticMarkup(<StudyDesignAdvicePanel {...props} />);
    const buttons = [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/gu)]
      .filter((match) => match[2] === "Use this comparison for review");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button[1]).not.toContain("disabled");
    const saving = renderToStaticMarkup(<StudyDesignAdvicePanel {...props}
      disabled pendingSelectionId={advice.options[0]!.optionId} />);
    expect(saving).toContain("Saving comparison…");
    expect(saving).toContain('aria-busy="true"');
    expect(props.onDecide).not.toHaveBeenCalled();
  });
  it("verifies the exact saved comparison after an interrupted selection response", () => {
    const state = completeReportFixture(), advice = currentStudyDesignAdvice(state)!;
    const input = { adviceId: advice.adviceId, expectedAdviceFingerprint: advice.adviceFingerprint,
      decision: { mode: "selected" as const, optionId: advice.options[0]!.optionId },
      rationale: "Use this comparison for review." };
    const after = decideStudyDesignAdvice(state, { expectedRevision: state.revision,
      ...input, selectedAt: "2026-09-30T10:01:00.000Z" }).state;
    const snapshot = (value: typeof state) => ({ state: value, revision: value.revision }) as SixScreenWorkflowPrivateSnapshot;
    expect(savedStudyDesignDecisionMatchesRequest(snapshot(state), snapshot(after), input)).toBe(true);
    expect(savedStudyDesignDecisionMatchesRequest(snapshot(state), snapshot(state), input)).toBe(false);
    expect(savedStudyDesignDecisionMatchesRequest(snapshot(state), snapshot(after), { ...input,
      decision: { mode: "no_selection" } })).toBe(false);
  });

  it("exports a saved partial source list without changing the canonical placeholder", () => {
    const state = completeReportFixture(), source = state.studyFirstEventInvestigations![0]!;
    const partial = structuredClone(source);
    partial.occurrences = []; partial.status = "planned";
    state.studyFirstEventInvestigations = [partial];
    const original = JSON.stringify(state);
    const view = screen6StateWithEventSource(state, { investigation: partial,
      documentedOccurrences: source.occurrences });
    const plan = createScreen6CurrentPlan(view), designMap = createScreen6DesignMapProjection(plan);
    const report = createCompleteReport({ state, plan, designMap, eventWorkspace: {
      investigation: partial, documentedOccurrences: source.occurrences,
      interpretationQueue: null } as never });
    for (const event of source.occurrences) expect(JSON.stringify(report.sections[2])).toContain(event.title);
    expect(JSON.stringify(state)).toBe(original);
    expect(plan.upstream.otherEvents?.status).toBe("running");
    const mismatched = { ...partial, snapshotId: "not-bound-to-this-workflow" };
    expect(screen6StateWithEventSource(state, { investigation: mismatched })).toBe(state);
  });

  it("keeps earlier named leads when a newer same-context scan finishes empty", () => {
    const state = completeReportFixture(), saved = state.studyFirstEventInvestigations![0]!;
    const { investigationFingerprint: _, ...prior } = saved;
    const body = { ...prior, snapshotId: "newer-empty-source-scan", previousSnapshotId: saved.snapshotId,
      ordinal: saved.ordinal + 1, status: "completed_partial" as const, occurrences: [], analyses: [] };
    state.studyFirstEventInvestigations!.push({ ...body, investigationFingerprint: fingerprintSixScreenValue(body) });
    const plan = createScreen6CurrentPlan(state), designMap = createScreen6DesignMapProjection(plan);
    expect(screen6RetainedEventInvestigation(state)).toBe(saved);
    expect(plan.upstream.otherEvents?.contextFit).toBe("same_study_earlier_scan");
    const report = createCompleteReport({ state, plan, designMap });
    for (const event of saved.occurrences) {
      expect(JSON.stringify(designMap.panels.find((panel) => panel.id === "events"))).toContain(event.title);
      expect(JSON.stringify(report.sections[2])).toContain(event.title);
    }
    expect(JSON.stringify(report.sections[2])).toContain("earlier saved scan");
  });
  it("carries every retained event name after a comparison changes while review is running", () => {
    const initial = completeReportFixture();
    const saved = initial.studyFirstEventInvestigations!.at(-1)!;
    const advice = currentStudyDesignAdvice(initial)!;
    const selected = decideStudyDesignAdvice(initial, { expectedRevision: initial.revision,
      adviceId: advice.adviceId, expectedAdviceFingerprint: advice.adviceFingerprint,
      decision: { mode: "selected", optionId: advice.options[0]!.optionId },
      rationale: "Reconsidered comparison after the source scan.", selectedAt: "2026-09-30T10:01:00.000Z" });
    const next = openScreen4(selected.state, { expectedRevision: selected.state.revision,
      openedAt: "2026-09-30T10:02:00.000Z" }).state;
    expect(next.studyFirstEventInvestigations!.at(-1)!.occurrences).toHaveLength(0);
    expect(screen6RetainedEventInvestigation(next)).toStrictEqual(saved);
    const plan = createScreen6CurrentPlan(next);
    expect(plan.upstream.otherEvents?.contextFit).toBe("same_study_earlier_design");
    const map = createScreen6DesignMapProjection(plan);
    const text = JSON.stringify(map.panels.find((item) => item.id === "events"));
    for (const occurrence of saved.occurrences) expect(text).toContain(occurrence.title);
    expect(text).not.toContain("Return to Screen 4 and retain");
  });

  it("accepts a recovered Screen 4 entry only when it matches the selected comparison", async () => {
    const failure = new SixScreenWorkflowResponseError("response_contract_invalid", "Interrupted response", {} as never);
    const open = vi.fn(async () => { throw failure; });
    const good = { state: { activeScreen: 4, runId: "selected-design" } } as SixScreenWorkflowPrivateSnapshot;
    await expect(openScreenWithCanonicalRecovery({ targetScreen: 4, open,
      recover: async () => good, acceptRecovered: (saved) => saved.state.runId === "selected-design" }))
      .resolves.toEqual({ snapshot: good, recovered: true });
    expect(open).toHaveBeenCalledTimes(1);
    await expect(openScreenWithCanonicalRecovery({ targetScreen: 4, open,
      recover: async () => good, acceptRecovered: () => false })).rejects.toBe(failure);
  });

  it("rejects an old Screen 4 entry after Select this comparison creates a new binding", () => {
    const old = completeReportFixture();
    const advice = currentStudyDesignAdvice(old)!;
    const before = decideStudyDesignAdvice(old, { expectedRevision: old.revision,
      adviceId: advice.adviceId, expectedAdviceFingerprint: advice.adviceFingerprint,
      decision: { mode: "selected", optionId: advice.options[0]!.optionId },
      rationale: "New comparison decision", selectedAt: "2026-09-30T10:01:00.000Z" }).state;
    const after = openScreen4(before, { expectedRevision: before.revision,
      openedAt: "2026-09-30T10:02:00.000Z" }).state;
    const snapshot = (state: typeof old) => ({ revision: state.revision, state }) as SixScreenWorkflowPrivateSnapshot;
    expect(screen4EntryMatchesSelection(snapshot(before), snapshot(before))).toBe(false);
    expect(screen4EntryMatchesSelection(snapshot(before), snapshot(after))).toBe(true);
    expect(screen4EntryMatchesSelection(snapshot(before), snapshot(old))).toBe(false);
  });

  it.each([0, 6, 10])("keeps all %i alternatives, citations and study content in the report", (count) => {
    const state = completeReportFixture(count), plan = createScreen6CurrentPlan(state);
    const designMap = createScreen6DesignMapProjection(plan);
    const report = createCompleteReport({ state, plan, designMap, generatedAt: "2026-09-30T10:00:00.000Z" });
    expect(report.sections).toHaveLength(5);
    const text = JSON.stringify(report.sections);
    expect(text).toContain("Return on assets");
    for (const event of state.studyFirstEventInvestigations!.at(-1)!.occurrences) expect(text).toContain(event.title);
    for (const mechanism of state.studyFirstMechanismRuns![0]!.planning!.plan!.candidates) expect(text).toContain(mechanism.conceptLabel);
    expect(report.references.filter((item) => item.key.startsWith("L"))).toHaveLength(count);
    expect(text).not.toMatch(/continue to|search coverage|Assessment saved\./iu);
    expect(text).not.toContain("Regression discontinuity");
  });

  it("downloads a real PDF with Unicode fonts, source links and a vector design figure", () => {
    const state = completeReportFixture(10), plan = createScreen6CurrentPlan(state);
    const report = createCompleteReport({ state, plan, designMap: createScreen6DesignMapProjection(plan),
      generatedAt: "2026-09-30T10:00:00.000Z" });
    report.sections[2]!.blocks.push({ title: "Long assessment pagination", text:
      "Synthetic extended assessment: café, β, § and ROA. A proposed pathway remains conditional. ".repeat(180) });
    const bytes = generateCompleteReportPdf(report);
    const raw = new TextDecoder().decode(bytes);
    expect(raw.startsWith("%PDF-1.7")).toBe(true);
    expect(raw).toContain("/ToUnicode");
    expect(raw).toContain("/Subtype /Link");
    expect(raw).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(raw).toContain("/Outlines");
    const markup = renderToStaticMarkup(<Screen6CurrentPlanPanel plan={plan} workflowState={state} />);
    expect(markup).toContain("Create PDF");
    expect(markup).toContain("Create Word");
    expect(markup).not.toContain("Export full JSON record");
    expect(markup).toContain("six-report-export");
    expect(markup).not.toContain("Export readable plan");
    if (process.env.SHOCKAUDIT_REPORT_QA_PATH) writeFileSync(process.env.SHOCKAUDIT_REPORT_QA_PATH, bytes);
  });

  it("requests broad theoretical coverage while preserving the zero-to-ten contract", () => {
    expect(SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS).toBe(10);
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).toContain("four to six distinct alternatives");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).toContain("Do not stop at exactly three");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).toContain("at least eight broad pathway lenses");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).toContain("zero to ten");
    expect(SCREEN5_MECHANISM_PLANNING_SYSTEM_PROMPT).toContain("Never fill a quota");
  });

  it("hands a PDF download to the browser without changing saved research or making an API call", async () => {
    const state = completeReportFixture(), original = JSON.stringify(state);
    const plan = createScreen6CurrentPlan(state), designMap = createScreen6DesignMapProjection(plan);
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild } });
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, "fetch");
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:report-download");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      await downloadCompleteReport({ state, plan, designMap });
      expect(createUrl.mock.calls[0]![0]).toBeInstanceOf(Blob);
      expect((createUrl.mock.calls[0]![0] as Blob).type).toBe("application/pdf");
      expect(anchor.download).toMatch(/^ShockAudit-Complete-Report-.*\.pdf$/u);
      expect(anchor.href).toBe("blob:report-download");
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect(appendChild).toHaveBeenCalledWith(anchor);
      expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).toBe(original);
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(revoke).toHaveBeenCalledWith("blob:report-download");
    } finally {
      vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    }
  });
});
