import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createMechanismLiteraturePlanInput } from
  "../../src/core/six-screen/mechanism-literature-plan";
import { openScreen5 } from
  "../../src/core/six-screen/workflow";
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
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";
import { createHistoricalMechanismPlan } from
  "../fixtures/archived-legacy-screen5-plan";

const planInput = {
  explanation: {
    mode: "stated" as const,
    text: "Participation rules may change organizational response.",
  },
  suppliedWorks: [],
  preferredConstructs: [],
  feasibleDataSources: [],
  knownAlternativeAccounts: [],
};

async function legacyRuntime(withSavedPlan = false) {
  const fixture = createLockedBrowserEventCardFixture();
  const opened = openScreen5(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(22),
  });
  const sourceRegister = buildSixScreenSourceRegister();
  const archived = withSavedPlan
      ? createHistoricalMechanismPlan(opened.state, {
        snapshotId: "saved-historical-literature-plan",
        planInput: createMechanismLiteraturePlanInput(planInput),
        capabilities: {
          openalex: sourceRegister.openalex,
          crossref: sourceRegister.crossref,
        },
        createdAt: browserEventCardFixtureAt(23),
      })
    : null;
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  const evidenceStore = new SixScreenEvidenceStore(storage);
  const taskStore = new SixScreenResearchTaskStore(storage);
  await store.create({
    state: archived?.state ?? opened.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("historical-read-only-fixture"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-20T12:00:00.000Z",
  });
  await evidenceStore.create({
    runId,
    accessToken,
    snapshot: fixture.evidenceSnapshot,
    collection: fixture.collection,
    expiresAt: "2026-09-20T12:00:00.000Z",
  });
  const fetch = vi.fn(async () => {
    throw new Error("Historical read-only admission dispatched a source request.");
  });
  let tick = 30;
  const createRuntime = () => new SixScreenWorkflowRuntime({
    store,
    evidenceStore,
    taskStore,
    signingKey: "[synthetic-test-signing-value-32-bytes]",
    now: () => browserEventCardFixtureAt(tick++),
    fetch,
    autoProbeSourceCapabilities: true,
  });
  return {
    runtime: createRuntime(),
    createRuntime,
    authentication: { runId, accessToken },
    savedPlan: archived?.plan ?? null,
    fetch,
  };
}

describe("read-only historical Screen 5 runtime", () => {
  it("keeps a locked legacy Event Card navigable while declining new planning and source work", async () => {
    const target = await legacyRuntime();
    const initial = await target.runtime.status(target.authentication);
    expect(initial.projection).toMatchObject({
      activeScreen: 5,
      canSaveMechanismLiteraturePlan: false,
      screen5Prerequisites: {
        ready: true,
        handoffKind: "legacy_event_card",
        legacyExecutionAvailable: false,
      },
    });
    const revision = initial.privateSnapshot.revision;
    await expect(target.runtime.saveMechanismLiteraturePlan(
      target.authentication, {
        expectedRevision: revision,
        operationId: "new-historical-plan-declined",
        planInput,
      },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    await expect(target.runtime.continueMechanismLiteratureSearch(
      target.authentication, {
        expectedRevision: revision,
        operationId: "new-historical-retrieval-declined",
      },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    await expect(target.runtime.inspectScholarlyDocument(
      target.authentication, {
        expectedRevision: revision,
        operationId: "new-historical-inspection-declined",
        inspectionInput: {
          targetId: "historical-document-target",
          exactDocumentUrl: "https://fixtures.example/document",
          accessBasis: "open_access",
          inspectionMode: "partial_text",
          exactPassage: "A historical saved passage.",
          passagePurpose: "theoretical_proposition",
          qualification: "Historical source route read only.",
        },
      },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    const reopened = await target.createRuntime().status(target.authentication);
    expect(reopened.privateSnapshot.revision).toBe(revision);
    expect(reopened.projection.mechanismLiteratureWorkspace.plan).toBeNull();
    expect(target.fetch).not.toHaveBeenCalled();
  });

  it("shows a validated saved historical plan after reopening without dispatch or mutation", async () => {
    const target = await legacyRuntime(true);
    const before = await target.runtime.status(target.authentication);
    expect(before.projection.mechanismLiteratureWorkspace.plan?.planFingerprint)
      .toBe(target.savedPlan?.planFingerprint);
    expect(before.projection.canSaveMechanismLiteraturePlan).toBe(false);
    expect(before.projection.canContinueMechanismLiteratureSearch).toBe(false);
    await expect(target.runtime.continueMechanismLiteratureSearch(
      target.authentication, {
        expectedRevision: before.privateSnapshot.revision,
        operationId: "archived-plan-no-new-metadata",
      },
    )).rejects.toThrow(/historical Screen 5 literature route is read-only/u);
    const after = await target.createRuntime().status(target.authentication);
    expect(after.privateSnapshot.revision).toBe(before.privateSnapshot.revision);
    expect(after.projection.mechanismLiteratureWorkspace.plan?.planFingerprint)
      .toBe(target.savedPlan?.planFingerprint);
    expect(target.fetch).not.toHaveBeenCalled();
  });
});
