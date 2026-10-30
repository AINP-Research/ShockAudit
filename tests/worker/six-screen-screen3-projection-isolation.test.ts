import { describe, expect, it, vi } from "vitest";

const diagnosticLibraryFault = vi.hoisted(() => ({
  armed: false,
  triggered: 0,
}));

vi.mock("../../src/core/six-screen/screen6-diagnostic-plan", async (
  importOriginal,
) => {
  const actual = await importOriginal<typeof import(
    "../../src/core/six-screen/screen6-diagnostic-plan"
  )>();
  return {
    ...actual,
    screen6ReviewedDiagnosticLibrary: () => {
      const library = actual.screen6ReviewedDiagnosticLibrary();
      if (!diagnosticLibraryFault.armed) return library;
      diagnosticLibraryFault.armed = false;
      diagnosticLibraryFault.triggered += 1;
      return library.filter(({ id }) => id !== "timing-anticipation-v1");
    },
  };
});

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

class PostCommitProjectionFaultStorage extends
  InMemorySixScreenWorkflowStorage {
  private armAfterNextWorkflowWrite = false;

  armProjectionFaultAfterNextWorkflowWrite() {
    this.armAfterNextWorkflowWrite = true;
  }

  override async put(key: string, value: unknown) {
    await super.put(key, value);
    if (
      this.armAfterNextWorkflowWrite &&
      key.startsWith("six-screen-workflow-v1:")
    ) {
      this.armAfterNextWorkflowWrite = false;
      diagnosticLibraryFault.armed = true;
    }
  }
}

describe("Screen 2 to Screen 3 projection isolation", () => {
  it("returns the committed Screen 3 start when an unrelated Screen 6 check is unavailable", async () => {
    diagnosticLibraryFault.armed = false;
    diagnosticLibraryFault.triggered = 0;
    const fixture = createBrowserEventCardFixture();
    const storage = new PostCommitProjectionFaultStorage();
    const store = new SixScreenWorkflowStore(storage);
    const evidenceStore = new SixScreenEvidenceStore(storage);
    const taskStore = new SixScreenResearchTaskStore(storage);
    await store.create({
      state: fixture.state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue(
        "screen-3-post-commit-projection-isolation",
      ),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-26T12:00:00.000Z",
    });
    const runtime = new SixScreenWorkflowRuntime({
      store,
      evidenceStore,
      taskStore,
      signingKey:
        "screen-3-projection-isolation-test-key-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(41),
      fetch: vi.fn(async () => {
        throw new Error("Projection isolation must not make a source request.");
      }),
    });
    const authentication = { runId, accessToken };
    const operationId = "screen-3-post-commit-projection-isolation";
    storage.armProjectionFaultAfterNextWorkflowWrite();

    let opened: Awaited<ReturnType<typeof runtime.openScreen3>> | undefined;
    let failure: unknown;
    try {
      opened = await runtime.openScreen3(authentication, {
        expectedRevision: fixture.state.revision,
        operationId,
        study: {
          ...fixture.state.study,
          policySideConcept: "Information transparency",
          initialExplanation:
            "The rule could change information available to market participants.",
          proposedTreatment: "California firms",
          proposedComparison: "Non-California firms",
        },
        proposedTiming: {
          mode: "year",
          year: 2020,
          milestoneReference: null,
        },
      });
    } catch (caught) {
      failure = caught;
    }

    const saved = await store.read(authentication);
    expect(saved.outcome).toBe("found");
    if (saved.outcome !== "found") throw new Error("Expected saved workflow.");
    const replay = saved.record.operationReplays.find((entry) =>
      entry.operationId === operationId);
    expect(replay).toMatchObject({
      operationKind: "open_screen_3",
      committedRevision: saved.record.state.revision,
      result: {
        runId,
        workflowRevision: saved.record.state.revision,
        adviceFingerprint: expect.stringMatching(/^fnv1a64:/u),
      },
    });
    expect(saved.record.state.activeScreen).toBe(3);
    expect(diagnosticLibraryFault.triggered).toBe(1);
    expect(failure).toBeUndefined();
    expect(opened).toMatchObject({
      replayed: false,
      mutationOutcome: "changed",
      projection: {
        activeScreen: 3,
        screen6CurrentPlan: {
          gaps: expect.arrayContaining([
            expect.stringMatching(
              /timing-anticipation-v1.*not added.*remains unresolved/iu,
            ),
          ]),
        },
      },
      result: replay?.result,
    });
  });
});
