import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../../src/ui/App.tsx", import.meta.url),
  "utf8",
);

describe("host-task lifecycle reconciliation wiring", () => {
  it("rechecks canonical state on focus and visible-tab restoration", () => {
    expect(appSource).toContain('window.addEventListener("focus", reconcileVisibleTask)');
    expect(appSource).toContain('document.addEventListener("visibilitychange", reconcileVisibleTask)');
    expect(appSource).toContain('document.visibilityState === "hidden"');
    expect(appSource).toContain('mutateWorkflow("refresh", {}, {');
    expect(appSource).toContain('openScreen03Workflow(screen02WorkflowRef.current, false)');
  });

  it("reopens Screen 3 through a canonical read even from a saved non-loading child", () => {
    const start = appSource.indexOf("function openOrResumeScreen03FromScreen2()");
    const end = appSource.indexOf("async function mutateScreen03", start);
    const reopen = appSource.slice(start, end);
    expect(reopen).toContain("void openScreen03Workflow(parent, false)");
    expect(reopen).not.toContain('child.status === "loading"');
  });

  it("retires only Screen 3 host tasks when the selected event is invalidated", () => {
    const retireStart = appSource.indexOf(
      "function retireScreen03HostReasoningTasks(",
    );
    const retireEnd = appSource.indexOf(
      "function clearScreen03HostDraftTimeout()",
      retireStart,
    );
    const retirement = appSource.slice(retireStart, retireEnd);
    expect(retirement).toContain("screen03HostReasoningTaskTypes");
    expect(retirement).toContain("bridge.forgetHostReasoningTasks(");
    expect(retirement).toContain("bridge.cancelHostReasoningTask({");

    const invalidationStart = appSource.indexOf(
      "function invalidateScreen03Sibling()",
    );
    const invalidationEnd = appSource.indexOf(
      "async function acceptScreen03HostDraftReceipt(",
      invalidationStart,
    );
    const invalidation = appSource.slice(invalidationStart, invalidationEnd);
    expect(invalidation).toContain("screen03LifecycleGenerationRef.current += 1");
    expect(invalidation).toContain("retireScreen03HostReasoningTasks(");
    expect(invalidation).not.toContain("retireHostReasoningTasks(");
  });

  it("guards late preparation, delivery, and status responses by task identity", () => {
    expect(appSource).toContain("const startOperation = Symbol(taskType)");
    expect(appSource).toContain("!startIsCurrent()");
    expect(appSource).toContain(
      "!hostReasoningTaskEntryIsCurrent(taskType, prepared.taskId)",
    );
    expect(appSource).toContain("const entryIsCurrent = () =>");
    expect(appSource).toContain("if (!entryIsCurrent()) return true");
  });

  it("defers Screen 2 acknowledgement through the exact post-render persistence barrier", () => {
    const compact = appSource.replace(/\s+/gu, " ");
    const reconcile = compact.slice(
      compact.indexOf("async function reconcileHostReasoningTaskInternal("),
      compact.indexOf("async function startHostReasoningTask("),
    );
    const appliedScreen02 = reconcile.slice(
      reconcile.indexOf(
        'if (taskType === "screen02-search-review") {',
        reconcile.indexOf('result.task.status === "applied"'),
      ),
      reconcile.indexOf(
        '} else if (taskType === "screen03-evidence-mapping")',
      ),
    );
    expect(reconcile).toContain(
      "if (screen02HostResultReconciliationIsCurrent(pending, false)) { return false; }",
    );
    expect(reconcile).toContain(
      "if (screen02HostResultAcknowledgementInFlightRef.current !== null) { return false; }",
    );
    expect(appliedScreen02).toContain(
      'if (result.task.panelReconciliation.status === "reconciled") { return true; }',
    );
    expect(appliedScreen02).toContain(
      "screen02HostReviewSummary(result.task.result)",
    );
    const commit = appliedScreen02.indexOf(
      "commitWorkflowSnapshot(refreshed, { navigate: true, persist: false, })",
    );
    const stage = appliedScreen02.indexOf(
      "stageScreen02HostResultAcknowledgement({",
    );
    expect(commit).toBeGreaterThanOrEqual(0);
    expect(stage).toBeGreaterThan(commit);
    const stagedBarrier = appliedScreen02.slice(
      appliedScreen02.indexOf(
        "// Keep the reconciler deadline alive while the mounted panel",
        stage,
      ),
      appliedScreen02.indexOf("} finally {", stage),
    );
    expect(stagedBarrier).toContain("return false;");
    expect(stagedBarrier).not.toContain("return true;");
    expect(appliedScreen02).not.toContain(
      "acknowledgeHostReasoningTaskResult(",
    );

    const painted = compact.slice(
      compact.indexOf("function screen02HostResultMarkerPainted("),
      compact.indexOf("function screen02HostResultMarkerRemoved("),
    );
    expect(painted.indexOf("persistScreen02WorkflowWidgetSnapshot({"))
      .toBeLessThan(
        painted.indexOf("acknowledgeHostReasoningTaskResult("),
      );
    expect(painted).toContain("marker.operationId");
    expect(painted).toContain(
      'acknowledgement.task.panelReconciliation.status === "reconciled"',
    );
    expect(painted).toContain(
      "fingerprintHostReasoningValue(acknowledgement.task.result) === marker.resultFingerprint",
    );
    expect(painted).toContain(
      "if (!screen02HostResultReconciliationIsCurrent(pending, true))",
    );

    const render = compact.slice(
      compact.indexOf("const currentGenericHostTaskReview ="),
      compact.indexOf("const hostTaskStatus =", compact.indexOf(
        "const currentGenericHostTaskReview =",
      )),
    );
    expect(render).toContain(
      'genericHostTaskEntry?.task?.status === "applied"',
    );
    expect(render).toContain("screen02HostReviewApplicationIsCurrent(");
    expect(render).not.toContain('ui.phase === "completed"');
    expect(compact).toContain(
      "reconciliationMarker={currentGenericHostTaskMarker}",
    );
  });

  it("keeps an unresolved acknowledgement lease across stale-marker cleanup", () => {
    const compact = appSource.replace(/\s+/gu, " ");
    const clear = compact.slice(
      compact.indexOf("function clearScreen02HostResultReconciliation("),
      compact.indexOf("function screen02HostResultReconciliationIsCurrent("),
    );
    const stage = compact.slice(
      compact.indexOf("function stageScreen02HostResultAcknowledgement("),
      compact.indexOf("function screen02HostResultMarkerPainted("),
    );
    expect(clear).not.toContain(
      "screen02HostResultAcknowledgementInFlightRef.current = null",
    );
    expect(stage).toContain(
      "if (screen02HostResultAcknowledgementInFlightRef.current !== null) { return false; }",
    );
  });
});
