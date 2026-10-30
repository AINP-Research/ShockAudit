import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";

import {
  isRetainedFederalRegisterApiPlanSource,
  SixScreenWorkflowRuntime,
} from "../../src/worker/six-screen-workflow-runtime";
import {
  SixScreenWorkflowStore,
  type SixScreenWorkflowStorage,
  type SixScreenWorkflowStorageTransaction,
} from "../../src/worker/six-screen-workflow-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";

class MemoryStorage implements SixScreenWorkflowStorage {
  readonly values = new Map<string, unknown>();

  async get(key: string) {
    return structuredClone(this.values.get(key));
  }

  async put(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string) {
    return this.values.delete(key);
  }

  async list(input: { prefix: string; limit?: number }) {
    return new Map(
      [...this.values.entries()]
        .filter(([key]) => key.startsWith(input.prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, input.limit),
    );
  }

  async transaction<T>(callback: (
    transaction: SixScreenWorkflowStorageTransaction,
  ) => Promise<T>) {
    return callback(this);
  }
}

const times = Array.from({ length: 40 }, (_, index) =>
  new Date(Date.parse("2026-09-12T10:00:00.000Z") + index * 1_000)
    .toISOString()
);

function runtime(input: {
  fetch?: typeof fetch;
  times?: string[];
  govInfoApiKey?: string;
  regulationsApiKey?: string;
  openStatesApiKey?: string;
} = {}) {
  const storage = new MemoryStorage();
  const store = new SixScreenWorkflowStore(storage);
  const taskStore = new SixScreenResearchTaskStore(storage);
  const evidenceStore = new SixScreenEvidenceStore(storage);
  const queuedTimes = [...(input.times ?? times)];
  const fetchImpl = input.fetch ?? (async (request: RequestInfo | URL) => {
    if (!String(request).includes("/api/v1/documents")) {
      return new Response(
        "<!doctype html><html><body><main><p>This final rule requires hospitals to implement disclosure requirements and publish standard charges.</p><p>This final rule is effective January 1, 2020.</p><p>[FR Doc. 2019-24931 Filed 11-26-19; 8:45 am]</p></main></body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    return new Response(JSON.stringify({
      count: 1,
      results: [{
        document_number: "2019-24931",
        title: "Hospital Transparency Final Rule",
        type: "Rule",
        abstract: "Hospitals must publish standard charges.",
        action: "Final rule.",
        excerpts: ["Hospitals must publish standard charges."],
        html_url:
          "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example",
        pdf_url:
          "https://www.govinfo.gov/content/pkg/FR-2019-11-27/pdf/2019-24931.pdf",
        raw_text_url:
          "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html",
        publication_date: "2019-11-27",
        effective_on: "2020-01-01",
        agencies: [{ name: "Centers for Medicare & Medicaid Services" }],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return {
    storage,
    store,
    taskStore,
    evidenceStore,
    runtime: new SixScreenWorkflowRuntime({
      store,
      taskStore,
      evidenceStore,
      signingKey: "test-signing-key-with-at-least-thirty-two-characters-123456",
      now: () => queuedTimes.shift() ?? times.at(-1)!,
      fetch: fetchImpl,
      ...(input.govInfoApiKey
        ? { govInfoApiKey: input.govInfoApiKey }
        : {}),
      ...(input.regulationsApiKey
        ? { regulationsApiKey: input.regulationsApiKey }
        : {}),
      ...(input.openStatesApiKey
        ? { openStatesApiKey: input.openStatesApiKey }
        : {}),
      monotonicNow: (() => {
        let value = 0;
        return () => (value += 5);
      })(),
    }),
  };
}

const createInput = {
  operationId: "create-1",
  shockInput: "Hospital Transparency Rule",
  study: {
    population: "Hospitals",
    analysisUnit: "Hospital",
    geography: ["United States"],
    industry: ["Health care"],
    period: { start: "2018", end: "2025" },
    outcome: "Operating margin",
    intendedConstruct: "Organizational resilience",
    initialExplanation: null,
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "no" as const,
  },
  requestedJurisdiction: "United States",
  approximateYear: "2019",
  intendedEpisode: "final rule",
};

describe("retained Federal Register API plan-source classification", () => {
  it("requires the exact document identity and inspected retained passage", () => {
    const documentNumber = "2019-24931";
    const source = {
      id: "fr-2019-24931-api-evidence",
      title: "Hospital Price Transparency — Federal Register API record",
      locator:
        "https://www.federalregister.gov/api/v1/documents/2019-24931.json",
      publisher: "Federal Register",
      publishedDate: "2019-11-27",
      authorityTier: "tier-2",
      retrievedAt: "2026-09-18T12:00:00.000Z",
      provider: "Federal Register API",
      nativeId: documentNumber,
      routeId: "federal_register_api_excerpt",
      routeVersion: "six-screen-federal-register-policy-v4",
      accessStatus: "retained_passage" as const,
      inspectedText: "abstract" as const,
      contentHash: "fnv1a64:0123456789abcdef",
      retainedText:
        "Hospital Price Transparency. Federal Register document 2019-24931. This final rule establishes requirements for hospitals to make standard charges public.",
      limitation: null,
    };
    expect(isRetainedFederalRegisterApiPlanSource(source, documentNumber))
      .toBe(true);
    expect(isRetainedFederalRegisterApiPlanSource({
      ...source,
      nativeId: "2019-00000",
    }, documentNumber)).toBe(false);
    expect(isRetainedFederalRegisterApiPlanSource({
      ...source,
      locator:
        "https://www.federalregister.gov/api/v1/documents/2019-00000.json",
    }, documentNumber)).toBe(false);
    expect(isRetainedFederalRegisterApiPlanSource({
      ...source,
      inspectedText: "metadata_only",
    }, documentNumber)).toBe(false);
    expect(isRetainedFederalRegisterApiPlanSource({
      ...source,
      contentHash: null,
    }, documentNumber)).toBe(false);
    expect(isRetainedFederalRegisterApiPlanSource({
      ...source,
      retainedText:
        "This retained text is substantive but names Federal Register document 2019-00000 instead of the confirmed record.",
    }, documentNumber)).toBe(false);
  });
});

describe("durable six-screen workflow", () => {
  it("derives stable private coordinates and replays the same create operation", async () => {
    const fixture = runtime();
    const first = await fixture.runtime.create(createInput);
    const replay = await fixture.runtime.create(createInput);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.privateSnapshot.runId).toBe(first.privateSnapshot.runId);
    expect(replay.privateSnapshot.accessToken).toBe(
      first.privateSnapshot.accessToken,
    );
    expect(replay.privateSnapshot.accessToken).not.toContain("test-signing-key");
    expect(first.projection).not.toHaveProperty("accessToken");
  });

  it("rejects create-operation reuse with different inputs", async () => {
    const fixture = runtime();
    await fixture.runtime.create(createInput);
    await expect(fixture.runtime.create({
      ...createInput,
      shockInput: "A different rule",
    })).rejects.toThrow(/reused for different input/u);
  });

  it("keeps possession tokens hash-only in storage and rejects a wrong token", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const serialized = JSON.stringify([...fixture.storage.values.values()]);
    expect(serialized).not.toContain(created.privateSnapshot.accessToken);
    await expect(fixture.runtime.status({
      runId: created.privateSnapshot.runId,
      accessToken: `sa6a_${"A".repeat(43)}`,
    })).rejects.toThrow(/unauthorized/u);
  });

  it("retires an authenticated run and preserves it after a rejected request", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const token = created.privateSnapshot.accessToken;
    const wrongToken = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    await expect(fixture.runtime.retire({
      runId: created.privateSnapshot.runId,
      accessToken: wrongToken,
    })).rejects.toThrow(/unauthorized/iu);
    await expect(fixture.runtime.status({
      runId: created.privateSnapshot.runId,
      accessToken: token,
    })).resolves.toBeDefined();

    await expect(fixture.runtime.retire({
      runId: created.privateSnapshot.runId,
      accessToken: token,
    })).resolves.toMatchObject({
      schemaVersion: "shockaudit-six-screen-retirement-v1",
      runId: created.privateSnapshot.runId,
      retired: true,
      outcomeValuesInspected: false,
    });
    await expect(fixture.runtime.status({
      runId: created.privateSnapshot.runId,
      accessToken: token,
    })).rejects.toThrow(/unavailable or expired/iu);
    expect([...fixture.storage.values.keys()].some((key) =>
      key.includes(created.privateSnapshot.runId)
    )).toBe(false);
  });

  it("persists identity resolution, exact confirmation, and the Screen 2 gate", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    await expect(fixture.runtime.openScreen2(auth, {
      expectedRevision: 0,
      operationId: "open-too-soon",
    })).rejects.toMatchObject({
      name: "SixScreenWorkflowProblemError",
      problem: {
        code: "execution_failure",
        action: "open_screen_2",
        screen: 2,
        expectedRevision: 0,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
      },
    });

    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-1",
    });
    expect(resolved.projection).toMatchObject({
      revision: 2,
      status: "identity_review",
      candidates: [{
        selected: true,
        episode: "adoption or final rule",
        formalIdentifiers: ["2019-24931"],
      }],
    });
    const taskCoordinate = fingerprintSixScreenValue("resolve-1").slice(
      "fnv1a64:".length,
    );
    const persistedTask = await fixture.taskStore.read({
      ...auth,
      taskId: `identity-task-${taskCoordinate}`,
    });
    expect(persistedTask.outcome).toBe("found");
    if (persistedTask.outcome !== "found") throw new Error("Expected task.");
    expect(persistedTask.record.task).toMatchObject({
      state: "completed",
      profileName: "identity-standard",
      usage: {
        sourceQueries: 2,
        metadataRecords: 1,
        usefulDocuments: 1,
        providerCostUnits: {},
      },
      reserved: { sourceQueries: 0, metadataRecords: 0 },
    });
    const candidate = resolved.projection.candidates[0]!;
    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: 2,
      operationId: "confirm-1",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    expect(confirmed.projection.statusMessage).toBe(
      "Shock confirmed — adoption or final rule.",
    );
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: 3,
      operationId: "open-2",
    });
    expect(opened.projection.activeScreen).toBe(2);
    expect(opened.result).toMatchObject({
      confirmedShock: {
        id: candidate.id,
        confirmation: { actor: "researcher" },
      },
    });
    const restored = await fixture.runtime.status(auth);
    expect(restored.projection).toMatchObject({
      activeScreen: 2,
      status: "shock_confirmed",
      canOpenScreen2: true,
    });

    const screen3Input = {
      expectedRevision: restored.projection.revision,
      operationId: "open-screen-3-visible-candidate",
      study: {
        ...createInput.study,
        initialExplanation:
          "How did the transparency rule affect hospital operating margins?",
      },
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
    };
    const screen3 = await fixture.runtime.openScreen3(auth, screen3Input);
    expect(screen3).toMatchObject({
      replayed: false,
      mutationOutcome: "changed",
      projection: {
        activeScreen: 3,
        study: {
          initialExplanation:
            "How did the transparency rule affect hospital operating margins?",
        },
      },
    });
    const replayedScreen3 = await fixture.runtime.openScreen3(
      auth,
      screen3Input,
    );
    expect(replayedScreen3).toMatchObject({
      replayed: true,
      mutationOutcome: "replayed",
      privateSnapshot: { revision: screen3.privateSnapshot.revision },
    });
    expect(replayedScreen3.privateSnapshot.state.studyDesignAdvices).toHaveLength(
      1,
    );
  });

  it("admits and records an Open States query in a durable identity task", async () => {
    const fixture = runtime({
      openStatesApiKey: "openstates-runtime-test-key",
      fetch: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(request));
        expect(url.origin).toBe("https://v3.openstates.org");
        expect(url.searchParams.get("identifier")).toBe("S 9999");
        expect(url.searchParams.get("jurisdiction")).toBe("New York");
        expect(url.searchParams.get("per_page")).toBe("10");
        expect(new Headers(init?.headers).get("x-api-key"))
          .toBe("openstates-runtime-test-key");
        return new Response(JSON.stringify({ results: [{
          id: "ocd-bill/123e4567-e89b-12d3-a456-426614174001",
          session: "2021-2022",
          jurisdiction: {
            id: "ocd-jurisdiction/country:us/state:ny/government",
            name: "New York",
            classification: "state",
          },
          from_organization: {
            id: "ocd-organization/new-york-senate",
            name: "New York State Senate",
            classification: "upper",
          },
          identifier: "S 9999",
          title: "Clean Energy Accountability Act",
          classification: ["bill"],
          openstates_url:
            "https://openstates.org/ny/bills/2021-2022/S9999/",
          first_action_date: "2021-02-01",
          latest_action_date: "2021-06-10",
          abstracts: [{
            abstract:
              "Requires specified energy reporting by covered entities.",
            note: "summary",
          }],
          actions: [{
            id: "action-ny-1",
            description: "Introduced",
            date: "2021-02-01",
            classification: ["introduction"],
            order: 1,
          }],
          sources: [{
            url: "https://www.nysenate.gov/legislation/bills/2021/S9999",
            note: "Official bill page",
          }],
          versions: [],
          documents: [],
        }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-openstates",
      shockInput: "S 9999",
      requestedJurisdiction: "NY",
      approximateYear: "2021",
      intendedEpisode: "Introduction",
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };

    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-openstates",
    });

    expect(resolved.projection).toMatchObject({
      status: "identity_review",
      candidates: [expect.objectContaining({
        officialTitle: "Clean Energy Accountability Act",
        issuingJurisdiction: "New York",
        formalIdentifiers: ["S 9999", "Session 2021-2022"],
      })],
    });
    const taskCoordinate = fingerprintSixScreenValue("resolve-openstates")
      .slice("fnv1a64:".length);
    const persistedTask = await fixture.taskStore.read({
      ...auth,
      taskId: `identity-task-${taskCoordinate}`,
    });
    expect(persistedTask.outcome).toBe("found");
    if (persistedTask.outcome !== "found") throw new Error("Expected task.");
    expect(persistedTask.record.task).toMatchObject({
      state: "completed",
      usage: { providerCostUnits: { openstates: 1 } },
      reserved: { providerCostUnits: {} },
    });
  });

  it("does not spend live-provider budget for a reviewed state-policy hit", async () => {
    const requests: URL[] = [];
    const fixture = runtime({
      openStatesApiKey: "openstates-runtime-test-key",
      fetch: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(request));
        expect(url.origin).toBe("https://v3.openstates.org");
        expect(new Headers(init?.headers).get("x-api-key"))
          .toBe("openstates-runtime-test-key");
        requests.push(url);
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-ccpa-aliases",
      shockInput: "California Consumer Privacy Act",
      requestedJurisdiction: "California",
      approximateYear: "2018",
      intendedEpisode: "Implementation",
      officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };

    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-ccpa-aliases",
    });

    expect(resolved.projection.status).toBe("identity_review");
    expect(resolved.projection.candidates[0]?.officialTitle).toBe(
      "California Consumer Privacy Act",
    );
    expect(requests).toHaveLength(0);
    const taskCoordinate = fingerprintSixScreenValue("resolve-ccpa-aliases")
      .slice("fnv1a64:".length);
    const persistedTask = await fixture.taskStore.read({
      ...auth,
      taskId: `identity-task-${taskCoordinate}`,
    });
    expect(persistedTask.outcome).toBe("found");
    if (persistedTask.outcome !== "found") throw new Error("Expected task.");
    expect(persistedTask.record.task).toMatchObject({
      state: "completed",
      usage: { providerCostUnits: {} },
      reserved: { providerCostUnits: {} },
    });
  });

  it("preserves the named CCPA study through explicit confirmation and a usable retained-document Screen 2 handoff", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.govinfo.gov/search")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            collectionCode: "PLAW",
            title: "Sarbanes-Oxley Act of 2002",
            packageId: "PLAW-107publ204",
            dateIssued: "2002-07-30",
            resultLink:
              "https://api.govinfo.gov/packages/PLAW-107publ204/summary",
            governmentAuthor: ["United States Congress"],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("PLAW-107publ204")) {
        return new Response(`<!doctype html><html><body><main>
          <p>Public Law 107-204</p>
          <p>This Act may be cited as the Sarbanes-Oxley Act of 2002.</p>
          <p>Each covered issuer shall maintain internal control over financial reporting.</p>
          <p>The Securities and Exchange Commission may enforce this Act.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      if (!url.includes("leginfo.legislature.ca.gov")) {
        return new Response("unavailable", { status: 404 });
      }
      return new Response(`<!doctype html><html><body><main>
        <h1>California Consumer Privacy Act</h1>
        <p>Assembly Bill 375 (AB 375).</p>
        <p>Business means a legal entity doing business in California that has annual gross revenues in excess of 25,000,000 dollars, annually buys or sells the personal information of 50,000 or more consumers, or derives 50 percent or more of annual revenues from selling consumers' personal information.</p>
        <p>A business shall disclose the categories and specific pieces of personal information it has collected about a consumer.</p>
        <p>This title does not apply to medical information governed by the Confidentiality of Medical Information Act.</p>
        <p>The Act was enacted on June 28, 2018, and becomes operative on January 1, 2020.</p>
        <p>The Attorney General may bring a civil action to enforce this title.</p>
        <p>A consumer may recover statutory damages of not less than 100 dollars and not greater than 750 dollars per consumer per incident.</p>
        <p>The consumer shall provide notice and the business has 30 days to cure the violation.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    });
    const fixture = runtime({
      fetch,
      govInfoApiKey: "test-govinfo-key",
      times: Array.from({ length: 120 }, (_, index) =>
        new Date(Date.parse("2026-09-12T10:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      operationId: "create-ccpa-screen1-regression",
      shockInput: "California Consumer Privacy Act",
      officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
      requestedJurisdiction: "California",
      approximateYear: "2018",
      intendedEpisode: "Implementation",
      study: {
        population: "US public firms",
        analysisUnit: "firm-year",
        geography: ["United States"],
        industry: ["Manufacturing industry"],
        period: { start: "2010", end: "2022" },
        outcome: "Firm performance",
        outcomeMeasure: null,
        intendedConstruct: "Customer protection",
        policySideConcept: null,
        initialExplanation: "How customer protection affects firm performance",
        proposedTreatment: "California firms",
        proposedComparison: "non-california firms",
        resultsPreviouslyInspected: "no",
      },
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    expect(created.privateSnapshot.state.study).toMatchObject({
      outcome: "Firm performance",
      outcomeMeasure: null,
      intendedConstruct: "Customer protection",
      policySideConcept: null,
      proposedTreatment: "California firms",
      proposedComparison: "non-california firms",
    });

    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-ccpa-screen1-regression",
    });
    expect(resolved.resolution.status).toBe("resolved");
    expect(resolved.projection.candidates).toHaveLength(1);
    const candidate = resolved.projection.candidates[0]!;
    expect(candidate).toMatchObject({
      officialTitle: "California Consumer Privacy Act",
      aliases: expect.arrayContaining(["CCPA"]),
      issuingJurisdiction: "California, United States",
      instrumentType: "state legislation",
      episode: "start of requirements",
      materialMismatches: [],
    });
    expect(candidate.identitySources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        locator: "https://oag.ca.gov/privacy/ccpa",
        routeId: "reviewed_official_document",
        accessStatus: "retained_passage",
      }),
      expect.objectContaining({
        locator: expect.stringContaining("leginfo.legislature.ca.gov"),
        routeId: "reviewed_official_document",
        accessStatus: "retained_passage",
      }),
    ]));
    const descriptionWords = candidate.displayedDescription.split(/\s+/u);
    expect(descriptionWords.length).toBeGreaterThanOrEqual(80);
    expect(descriptionWords.length).toBeLessThanOrEqual(120);

    const confirmInput = {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-ccpa-screen1-regression",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    };
    const confirmed = await fixture.runtime.confirmShock(auth, confirmInput);
    const replayedConfirmation = await fixture.runtime.confirmShock(
      auth,
      confirmInput,
    );
    expect(replayedConfirmation.replayed).toBe(true);
    expect(replayedConfirmation.privateSnapshot.state.confirmedShock?.confirmation)
      .toEqual(confirmed.privateSnapshot.state.confirmedShock?.confirmation);

    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-ccpa-screen1-regression",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-ccpa-screen1-regression",
    });
    expect(introduction.review.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "operative_change" }),
      expect.objectContaining({ predicate: "coverage_condition" }),
    ]));
    expect(introduction.review.progress.continuationMode)
      .toBe("automatic_standard");
    expect(introduction.review.plan.steps.find(({ sourceRoute }) =>
      sourceRoute === "complementary_policy_explanations"))
      .toMatchObject({ status: "not_needed", attempts: 0 });
    const researched = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "research-ccpa-screen1-regression-controlling",
    });
    expect(researched.review).toMatchObject({
      status: "partial",
      documentNumber: null,
      sourceCount: expect.any(Number),
      passageCount: expect.any(Number),
      plan: {
        instrumentFamily: "official_document",
        nextStepId: null,
        steps: [
          expect.objectContaining({
            sourceRoute: "confirmed_official_document",
            status: "searched",
            attempts: 1,
          }),
          expect.objectContaining({
            sourceRoute: "complementary_policy_explanations",
            status: "not_needed",
            attempts: 0,
          }),
          expect.objectContaining({
            sourceRoute: "official_document_relationships",
            status: "blocked",
          }),
        ],
      },
      claims: expect.arrayContaining([
        expect.objectContaining({ predicate: "operative_change" }),
        expect.objectContaining({ predicate: "coverage_condition" }),
        expect.objectContaining({ predicate: "legal_effect_date" }),
        expect.objectContaining({ predicate: "exemption_rule" }),
        expect.objectContaining({ predicate: "enforcement_authority" }),
        expect.objectContaining({ predicate: "penalty" }),
      ]),
      briefing: expect.objectContaining({
        mode: "deterministic_source_reconstruction",
        overview: expect.stringContaining("California Consumer Privacy Act"),
      }),
    });
    expect(researched.review.taskId).toBe(introduction.review.taskId);
    expect(researched.review.progress.chargedDocumentAttempts)
      .toBeGreaterThanOrEqual(
        introduction.review.progress.chargedDocumentAttempts,
      );
    expect(researched.review.unresolved).toEqual(expect.arrayContaining([
      "previous_baseline",
      "version",
    ]));
    expect(researched.review.attemptedSources).toEqual(expect.arrayContaining([
      expect.stringContaining("leginfo.legislature.ca.gov"),
    ]));
    const reopened = await fixture.runtime.status(auth);
    expect(reopened.projection).toMatchObject({
      activeScreen: 2,
      confirmedShock: { identityFingerprint: candidate.identityFingerprint },
      policyReview: {
        evidenceSnapshotId: researched.review.evidenceSnapshotId,
      },
    });
    const beforeLegacyRepair = await fixture.store.read(auth);
    expect(beforeLegacyRepair.outcome).toBe("found");
    if (beforeLegacyRepair.outcome !== "found") throw new Error("missing run");
    const legacyInvalidatedAt = "2026-09-12T10:00:30.000Z";
    const legacyMutation = await fixture.store.mutate({
      ...auth,
      expectedRevision: beforeLegacyRepair.record.state.revision,
      operationId: "simulate-legacy-study-invalidation",
      operationKind: "test_legacy_study_invalidation",
      inputFingerprint: fingerprintSixScreenValue("legacy-study-invalidation"),
      updatedAt: legacyInvalidatedAt,
    }, (state) => {
      state.policyReview = {
        ...state.policyReview!,
        artifactStatus: "out_of_date",
        invalidatedAt: legacyInvalidatedAt,
        invalidationReason: "The researcher changed a study field used by this result.",
      };
      state.artifacts = state.artifacts.map((artifact) =>
        artifact.screen === 2 && artifact.status === "current"
          ? {
              ...artifact,
              status: "out_of_date" as const,
              invalidatedAt: legacyInvalidatedAt,
              invalidationReason:
                "The researcher changed a study field used by this result.",
            }
          : artifact);
      state.revision += 1;
      state.updatedAt = legacyInvalidatedAt;
      state.changeLog.push({
        revision: state.revision,
        at: legacyInvalidatedAt,
        summary: "Simulated a saved pre-repair study invalidation.",
      });
      return { state, result: null };
    });
    expect(legacyMutation.outcome).toBe("updated");
    if (legacyMutation.outcome !== "updated") {
      throw new Error("legacy invalidation was not saved");
    }
    const recovered = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: legacyMutation.record.state.revision,
      operationId: "recover-ccpa-after-study-invalidation",
    });
    expect(recovered.review).toMatchObject({
      taskId: researched.review.taskId,
      identityFingerprint: candidate.identityFingerprint,
      evidenceSnapshotId: researched.review.evidenceSnapshotId,
      artifactStatus: "current",
      invalidatedAt: null,
      invalidationReason: null,
    });
    expect(recovered.review.claims).toEqual(researched.review.claims);

    const switchedToSox = await fixture.runtime.updateShock(auth, {
      expectedRevision: recovered.projection.revision,
      operationId: "switch-ccpa-to-sox",
      shockInput: "Sarbanes-Oxley Act of 2002",
      officialIdentifier: "Public Law 107-204",
      requestedJurisdiction: "United States",
      approximateYear: "2002",
      intendedEpisode: "enactment",
    });
    const resolvedSox = await fixture.runtime.resolveShock(auth, {
      expectedRevision: switchedToSox.projection.revision,
      operationId: "resolve-sox-round-trip",
    });
    expect(
      resolvedSox.projection.candidates,
      JSON.stringify(resolvedSox.resolution),
    ).not.toHaveLength(0);
    const soxCandidate = resolvedSox.projection.candidates.find(({ officialTitle }) =>
      /Sarbanes.Oxley/iu.test(officialTitle))!;
    expect(soxCandidate).toBeDefined();
    const confirmedSox = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedSox.projection.revision,
      operationId: "confirm-sox-round-trip",
      candidateId: soxCandidate.id,
      displayedIdentityFingerprint: soxCandidate.identityFingerprint,
      sourceSnapshotId: soxCandidate.sourceSnapshotId,
      sourceSnapshotFingerprint: soxCandidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedSox.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedSox.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedSox.projection.identityRevision,
    });
    const openedSox = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedSox.projection.revision,
      operationId: "open-sox-round-trip",
    });
    const researchedSox = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: openedSox.projection.revision,
      operationId: "research-sox-round-trip",
    });
    expect(researchedSox.review.identityFingerprint)
      .toBe(soxCandidate.identityFingerprint);

    const switchedBack = await fixture.runtime.updateShock(auth, {
      expectedRevision: researchedSox.projection.revision,
      operationId: "switch-sox-back-to-ccpa",
      shockInput: "California Consumer Privacy Act",
      officialIdentifier: null,
      requestedJurisdiction: "California",
      approximateYear: "2018",
      intendedEpisode: "Implementation",
    });
    const restoredCcpaSource = await fixture.runtime.addSource(auth, {
      expectedRevision: switchedBack.projection.revision,
      operationId: "restore-ccpa-source-round-trip",
      sourceUrl: "https://oag.ca.gov/privacy/ccpa",
    });
    const resolvedAgain = await fixture.runtime.resolveShock(auth, {
      expectedRevision: restoredCcpaSource.projection.revision,
      operationId: "resolve-ccpa-round-trip",
    });
    const ccpaAgain = resolvedAgain.projection.candidates.find(({ officialTitle }) =>
      officialTitle === "California Consumer Privacy Act")!;
    expect(ccpaAgain).toBeDefined();
    const confirmedAgain = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedAgain.projection.revision,
      operationId: "confirm-ccpa-round-trip",
      candidateId: ccpaAgain.id,
      displayedIdentityFingerprint: ccpaAgain.identityFingerprint,
      sourceSnapshotId: ccpaAgain.sourceSnapshotId,
      sourceSnapshotFingerprint: ccpaAgain.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedAgain.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedAgain.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedAgain.projection.identityRevision,
    });
    const reopenedCcpa = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedAgain.projection.revision,
      operationId: "reopen-ccpa-round-trip",
    });
    const fetchesBeforeReuse = fetch.mock.calls.length;
    const returnedCcpa = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: reopenedCcpa.projection.revision,
      operationId: "reuse-ccpa-round-trip",
    });
    expect(returnedCcpa.review).toMatchObject({
      taskId: researched.review.taskId,
      identityFingerprint: ccpaAgain.identityFingerprint,
      evidenceSnapshotId: researched.review.evidenceSnapshotId,
      artifactStatus: "current",
    });
    expect(returnedCcpa.review.claims).toEqual(researched.review.claims);
    expect(fetch.mock.calls.length).toBe(fetchesBeforeReuse);

    let completedCcpa = returnedCcpa;
    for (let step = 0; completedCcpa.review.plan.nextStepId; step += 1) {
      expect(step).toBeLessThan(12);
      completedCcpa = await fixture.runtime.continuePolicyResearch(auth, {
        expectedRevision: completedCcpa.projection.revision,
        operationId:
          `complete-returned-ccpa-${completedCcpa.review.plan.nextStepId}`,
      });
    }
    expect(completedCcpa.review.plan.nextStepId).toBeNull();

    const revisitSox = await fixture.runtime.updateShock(auth, {
      expectedRevision: completedCcpa.projection.revision,
      operationId: "revisit-sox-after-complete-ccpa",
      shockInput: "Sarbanes-Oxley Act of 2002",
      officialIdentifier: "Public Law 107-204",
      requestedJurisdiction: "United States",
      approximateYear: "2002",
      intendedEpisode: "enactment",
    });
    const resolvedSoxAgain = await fixture.runtime.resolveShock(auth, {
      expectedRevision: revisitSox.projection.revision,
      operationId: "resolve-revisited-sox",
    });
    const soxAgain = resolvedSoxAgain.projection.candidates.find(
      ({ officialTitle }) => /Sarbanes.Oxley/iu.test(officialTitle),
    )!;
    const confirmedSoxAgain = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedSoxAgain.projection.revision,
      operationId: "confirm-revisited-sox",
      candidateId: soxAgain.id,
      displayedIdentityFingerprint: soxAgain.identityFingerprint,
      sourceSnapshotId: soxAgain.sourceSnapshotId,
      sourceSnapshotFingerprint: soxAgain.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedSoxAgain.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedSoxAgain.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedSoxAgain.projection.identityRevision,
    });
    const reopenedSox = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedSoxAgain.projection.revision,
      operationId: "reopen-revisited-sox",
    });
    const fetchesBeforeSoxReuse = fetch.mock.calls.length;
    const returnedSox = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: reopenedSox.projection.revision,
      operationId: "reuse-revisited-sox",
    });
    expect(returnedSox.review.taskId).toBe(researchedSox.review.taskId);
    expect(returnedSox.review.claims).toEqual(researchedSox.review.claims);
    expect(fetch.mock.calls.length).toBe(fetchesBeforeSoxReuse);

    const finalCcpaSwitch = await fixture.runtime.updateShock(auth, {
      expectedRevision: returnedSox.projection.revision,
      operationId: "switch-final-ccpa",
      shockInput: "California Consumer Privacy Act",
      officialIdentifier: null,
      requestedJurisdiction: "California",
      approximateYear: "2018",
      intendedEpisode: "Implementation",
    });
    const finalCcpaSource = await fixture.runtime.addSource(auth, {
      expectedRevision: finalCcpaSwitch.projection.revision,
      operationId: "restore-final-ccpa-source",
      sourceUrl: "https://oag.ca.gov/privacy/ccpa",
    });
    const resolvedFinalCcpa = await fixture.runtime.resolveShock(auth, {
      expectedRevision: finalCcpaSource.projection.revision,
      operationId: "resolve-final-ccpa",
    });
    const finalCcpa = resolvedFinalCcpa.projection.candidates.find(
      ({ officialTitle }) => officialTitle === "California Consumer Privacy Act",
    )!;
    const confirmedFinalCcpa = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedFinalCcpa.projection.revision,
      operationId: "confirm-final-ccpa",
      candidateId: finalCcpa.id,
      displayedIdentityFingerprint: finalCcpa.identityFingerprint,
      sourceSnapshotId: finalCcpa.sourceSnapshotId,
      sourceSnapshotFingerprint: finalCcpa.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedFinalCcpa.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedFinalCcpa.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedFinalCcpa.projection.identityRevision,
    });
    const reopenedFinalCcpa = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedFinalCcpa.projection.revision,
      operationId: "reopen-final-ccpa",
    });
    const fetchesBeforeCompletedReuse = fetch.mock.calls.length;
    const returnedCompletedCcpa = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: reopenedFinalCcpa.projection.revision,
      operationId: "reuse-completed-ccpa",
    });
    expect(returnedCompletedCcpa.review.taskId).toBe(researched.review.taskId);
    expect(returnedCompletedCcpa.review.claims).toEqual(
      completedCcpa.review.claims,
    );
    expect(returnedCompletedCcpa.review.plan.nextStepId).toBeNull();
    expect(fetch.mock.calls.length).toBe(fetchesBeforeCompletedReuse);
    expect(fetch).toHaveBeenCalled();
  });

  it("restores SOX evidence after a same-workspace FERC Order 841 cycle", async () => {
    const orderTitle =
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
    const orderApi =
      "https://www.federalregister.gov/api/v1/documents/2018-03708.json";
    const orderUrl =
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("api.govinfo.gov/search")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            collectionCode: "PLAW",
            title: "Sarbanes-Oxley Act of 2002",
            packageId: "PLAW-107publ204",
            dateIssued: "2002-07-30",
            resultLink:
              "https://api.govinfo.gov/packages/PLAW-107publ204/summary",
            governmentAuthor: ["United States Congress"],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("PLAW-107publ204")) {
        return new Response(`<!doctype html><html><body><main>
          <p>Public Law 107-204</p>
          <p>This Act may be cited as the Sarbanes-Oxley Act of 2002.</p>
          <p>Each covered issuer shall maintain internal control over financial reporting.</p>
          <p>The Securities and Exchange Commission may enforce this Act.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === orderApi) {
        return new Response(JSON.stringify({
          document_number: "2018-03708",
          title: orderTitle,
          abstract:
            "The Federal Energy Regulatory Commission is amending its regulations under the Federal Power Act to remove barriers to electric-storage participation in organized wholesale markets.",
          agencies: [{ name: "Federal Energy Regulatory Commission" }],
          html_url: orderUrl,
          publication_date: "2018-03-06",
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return new Response(JSON.stringify({ articles: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not available", { status: 503 });
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      govInfoApiKey: "test-govinfo-key",
      times: Array.from({ length: 100 }, (_, index) =>
        new Date(Date.parse("2026-09-13T10:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-sox-ferc-sox",
      shockInput: "Sarbanes-Oxley Act of 2002",
      officialIdentifier: "Public Law 107-204",
      requestedJurisdiction: "United States",
      approximateYear: "2002",
      intendedEpisode: "enactment",
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolvedSox = await fixture.runtime.resolveShock(auth, {
      expectedRevision: created.projection.revision,
      operationId: "resolve-initial-sox-ferc-sox",
    });
    const sox = resolvedSox.projection.candidates.find(({ officialTitle }) =>
      /Sarbanes.Oxley/iu.test(officialTitle))!;
    const confirmedSox = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedSox.projection.revision,
      operationId: "confirm-initial-sox-ferc-sox",
      candidateId: sox.id,
      displayedIdentityFingerprint: sox.identityFingerprint,
      sourceSnapshotId: sox.sourceSnapshotId,
      sourceSnapshotFingerprint: sox.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedSox.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedSox.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedSox.projection.identityRevision,
    });
    const openedSox = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedSox.projection.revision,
      operationId: "open-initial-sox-ferc-sox",
    });
    const researchedSox = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: openedSox.projection.revision,
      operationId: "research-initial-sox-ferc-sox",
    });

    const switchedFerc = await fixture.runtime.updateShock(auth, {
      expectedRevision: researchedSox.projection.revision,
      operationId: "switch-sox-to-ferc",
      shockInput: "FERC Order 841",
      officialIdentifier: "2018-03708",
      requestedJurisdiction: "United States",
      approximateYear: "2018",
      intendedEpisode: "final rule",
    });
    const resolvedFerc = await fixture.runtime.resolveShock(auth, {
      expectedRevision: switchedFerc.projection.revision,
      operationId: "resolve-sox-to-ferc",
    });
    const ferc = resolvedFerc.projection.candidates.find(({ officialTitle }) =>
      officialTitle === orderTitle)!;
    expect(ferc).toBeDefined();
    const confirmedFerc = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedFerc.projection.revision,
      operationId: "confirm-sox-to-ferc",
      candidateId: ferc.id,
      displayedIdentityFingerprint: ferc.identityFingerprint,
      sourceSnapshotId: ferc.sourceSnapshotId,
      sourceSnapshotFingerprint: ferc.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedFerc.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedFerc.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedFerc.projection.identityRevision,
    });
    const openedFerc = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedFerc.projection.revision,
      operationId: "open-sox-to-ferc",
    });
    const researchedFerc = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: openedFerc.projection.revision,
      operationId: "research-sox-to-ferc",
    });
    expect(researchedFerc.review).toMatchObject({
      documentNumber: "2018-03708",
      identityFingerprint: ferc.identityFingerprint,
    });

    const switchedBack = await fixture.runtime.updateShock(auth, {
      expectedRevision: researchedFerc.projection.revision,
      operationId: "switch-ferc-back-to-sox",
      shockInput: "Sarbanes-Oxley Act of 2002",
      officialIdentifier: "Public Law 107-204",
      requestedJurisdiction: "United States",
      approximateYear: "2002",
      intendedEpisode: "enactment",
    });
    const resolvedSoxAgain = await fixture.runtime.resolveShock(auth, {
      expectedRevision: switchedBack.projection.revision,
      operationId: "resolve-ferc-back-to-sox",
    });
    const soxAgain = resolvedSoxAgain.projection.candidates.find(
      ({ officialTitle }) => /Sarbanes.Oxley/iu.test(officialTitle),
    )!;
    const confirmedSoxAgain = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolvedSoxAgain.projection.revision,
      operationId: "confirm-ferc-back-to-sox",
      candidateId: soxAgain.id,
      displayedIdentityFingerprint: soxAgain.identityFingerprint,
      sourceSnapshotId: soxAgain.sourceSnapshotId,
      sourceSnapshotFingerprint: soxAgain.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolvedSoxAgain.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolvedSoxAgain.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolvedSoxAgain.projection.identityRevision,
    });
    const reopenedSox = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmedSoxAgain.projection.revision,
      operationId: "reopen-ferc-back-to-sox",
    });
    const fetchesBeforeReuse = fetch.mock.calls.length;
    const returnedSox = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: reopenedSox.projection.revision,
      operationId: "reuse-ferc-back-to-sox",
    });
    expect(returnedSox.review).toMatchObject({
      taskId: researchedSox.review.taskId,
      identityFingerprint: soxAgain.identityFingerprint,
      evidenceSnapshotId: researchedSox.review.evidenceSnapshotId,
    });
    expect(returnedSox.review.claims).toEqual(researchedSox.review.claims);
    expect(fetch.mock.calls.length).toBe(fetchesBeforeReuse);
  });

  it("produces a Procurement Act introduction from the retained exact UK identity passage", async () => {
    const title = "Procurement Act 2023";
    const locator =
      "https://www.legislation.gov.uk/ukpga/2023/54/section/1/data.xml";
    const retainedText =
      "Procurement Act 2023. This Act establishes requirements for contracting authorities and applies to covered public contracts. Contracting authorities must have regard to delivering value for money and acting with integrity.";
    const requested: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requested.push(url);
      if (url.includes("/data.feed")) {
        return new Response(`<?xml version="1.0"?><feed
          xmlns="http://www.w3.org/2005/Atom"
          xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
          <entry>
            <id>https://www.legislation.gov.uk/id/ukpga/2023/54</id>
            <title>${title}</title>
            <ukm:EnactmentDate Date="2023-10-26" />
            <link rel="alternate" href="https://www.legislation.gov.uk/ukpga/2023/54" />
          </entry>
        </feed>`, {
          headers: { "content-type": "application/atom+xml" },
        });
      }
      if (url === locator) {
        return new Response(
          `<Legislation><Title>${title}</Title><Body>${retainedText}</Body></Legislation>`,
          { headers: { "content-type": "application/xml" } },
        );
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return new Response(JSON.stringify({ articles: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not available", { status: 503 });
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      times: Array.from({ length: 40 }, (_, index) =>
        new Date(Date.parse("2026-09-18T21:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-procurement-act-name-only",
      shockInput: title,
      requestedJurisdiction: null,
      approximateYear: null,
      intendedEpisode: null,
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-procurement-act-name-only",
    });
    const candidate = resolved.projection.candidates.find(({ officialTitle }) =>
      officialTitle === title)!;
    expect(candidate).toMatchObject({
      formalIdentifiers: ["ukpga/2023/54"],
      identitySources: [expect.objectContaining({
        routeId: "uk_legislation_document",
        locator,
        accessStatus: "retained_passage",
        retainedText: expect.stringContaining(
          "establishes requirements for contracting authorities",
        ),
      })],
    });
    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-procurement-act-name-only",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-procurement-act-name-only",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-procurement-act-name-only",
    });

    expect(introduction.review).toMatchObject({
      status: "partial",
      evidenceSnapshotId: expect.any(String),
      sourceCount: 1,
      passageCount: expect.any(Number),
      plan: {
        instrumentFamily: "official_document",
        steps: expect.arrayContaining([
          expect.objectContaining({
            sourceRoute: "confirmed_official_document",
            status: "searched",
            attempts: 1,
          }),
          expect.objectContaining({
            sourceRoute: "complementary_policy_explanations",
            status: "not_started",
          }),
        ]),
      },
      claims: expect.arrayContaining([
        expect.objectContaining({ predicate: "operative_change" }),
        expect.objectContaining({ predicate: "coverage_condition" }),
      ]),
    });
    const explained = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "research-procurement-act-explanation",
    });
    expect(explained.review).toMatchObject({
      claims: expect.arrayContaining([
        expect.objectContaining({
          predicate: "policy_explanation",
          statement: expect.stringContaining(
            "establishes requirements for contracting authorities",
          ),
          citation: expect.objectContaining({
            provider: "uk-legislation",
            canonicalUrl: locator,
            sourceRole: expect.stringMatching(/retained during Screen 1/iu),
          }),
        }),
      ]),
    });
    expect(explained.review.plan.steps.find(({ sourceRoute }) =>
      sourceRoute === "complementary_policy_explanations"))
      .toMatchObject({ status: "searched", attempts: 1 });
    expect(requested.filter((url) => url === locator)).toHaveLength(3);
  });

  it("persists GovInfo fallback evidence through the authenticated Screen 2 runtime", async () => {
    const bodyHtml =
      "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html";
    const govInfoSummary =
      "https://api.govinfo.gov/packages/FR-2019-11-27/granules/2019-24931/summary";
    const govInfoHtml =
      "https://api.govinfo.gov/packages/FR-2019-11-27/granules/2019-24931/htm";
    const policyBody = `<!doctype html><html><body><main>
      <p>This final rule requires hospitals to publish standard charges.</p>
      <p>This final rule is effective January 1, 2020.</p>
      <p>Hospitals must implement the disclosure requirements within 60 days.</p>
      <p>[FR Doc. 2019-24931 Filed 11-26-19; 8:45 am]</p>
    </main></body></html>`;
    let federalDocumentReads = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url.includes("/api/v1/documents")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: "2019-24931",
            title: "Hospital Transparency Final Rule",
            type: "Rule",
            abstract: "Hospitals must publish standard charges.",
            action: "Final rule.",
            excerpts: ["Hospitals must publish standard charges."],
            html_url:
              "https://www.federalregister.gov/documents/2019/11/27/2019-24931/hospital-transparency-final-rule",
            body_html_url: bodyHtml,
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2019-11-27/pdf/2019-24931.pdf",
            publication_date: "2019-11-27",
            effective_on: "2020-01-01",
            agencies: [{
              name: "Centers for Medicare & Medicaid Services",
            }],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("federalregister.gov/documents/full_text/")) {
        federalDocumentReads += 1;
        if (federalDocumentReads === 1) {
          return new Response(policyBody, {
            headers: { "content-type": "text/html" },
          });
        }
        return new Response("temporary outage", { status: 503 });
      }
      if (url === govInfoSummary) {
        expect(new Headers(init?.headers).get("x-api-key")).toBe(
          "runtime-govinfo-secret",
        );
        return new Response(JSON.stringify({
          collectionCode: "FR",
          dateIssued: "2019-11-27",
          packageId: "FR-2019-11-27",
          granuleId: "2019-24931",
          download: { txtLink: govInfoHtml },
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === govInfoHtml) {
        expect(new Headers(init?.headers).get("x-api-key")).toBe(
          "runtime-govinfo-secret",
        );
        return new Response(policyBody, {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const fixture = runtime({
      fetch,
      govInfoApiKey: "runtime-govinfo-secret",
    });
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-govinfo-runtime",
    });
    const candidate = resolved.projection.candidates[0]!;
    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-govinfo-runtime",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-govinfo-runtime",
    });
    const researched = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-govinfo-runtime",
    });
    expect(researched.review).toMatchObject({
      status: "partial",
      sourceCount: 1,
      plan: { nextStepId: "fr-coverage-2019-24931" },
      progress: {
        searchedSteps: 1,
        totalSteps: 5,
        retainedDocuments: 1,
        chargedDocumentAttempts: expect.any(Number),
      },
      attemptedSources: expect.arrayContaining([govInfoSummary, govInfoHtml]),
    });
    const retained = await fixture.evidenceStore.read({
      ...auth,
      snapshotId: researched.review.evidenceSnapshotId!,
    });
    expect(retained.outcome).toBe("found");
    if (retained.outcome !== "found") throw new Error("Expected evidence.");
    expect(retained.collection.sources).toEqual([
      expect.objectContaining({
        provider: "govinfo",
        canonicalUrl: govInfoHtml,
        contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        inspectedText: "full",
      }),
    ]);
    expect(JSON.stringify([...fixture.storage.values.values()])).not.toContain(
      "runtime-govinfo-secret",
    );
  });

  it("routes a reviewed Federal Register catalog identity through the exact federal-rule plan", async () => {
    const title =
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
    const exactApi =
      "https://www.federalregister.gov/api/v1/documents/2018-03708.json";
    const canonicalUrl =
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
    const requested: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requested.push(url);
      if (url === exactApi) {
        return new Response(JSON.stringify({
          document_number: "2018-03708",
          title,
          abstract:
            "The Federal Energy Regulatory Commission is amending its regulations under the Federal Power Act to remove barriers to electric-storage participation in organized wholesale markets.",
          agencies: [{ name: "Federal Energy Regulatory Commission" }],
          html_url: canonicalUrl,
          publication_date: "2018-03-06",
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return new Response(JSON.stringify({ articles: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not available", { status: 503 });
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      times: Array.from({ length: 40 }, (_, index) =>
        new Date(Date.parse("2026-09-17T22:30:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-reviewed-order-841",
      shockInput: "FERC Order 841",
      approximateYear: "2018",
      intendedEpisode: "Adoption or final rule",
      study: {
        ...createInput.study,
        population:
          "Regional transmission organizations and independent system operators",
        analysisUnit: "Market operator",
        industry: ["Energy"],
        outcome: "Storage participation",
      },
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-reviewed-order-841",
    });
    const candidate = resolved.projection.candidates.find((item) =>
      item.officialTitle === title)!;
    expect(candidate).toMatchObject({
      instrumentType: "federal administrative rule",
      formalIdentifiers: expect.arrayContaining(["2018-03708"]),
      identitySources: expect.arrayContaining([
        expect.objectContaining({
          routeId: "reviewed_official_document",
          locator: canonicalUrl,
        }),
      ]),
    });
    expect(candidate.identitySources.some(({ routeId }) =>
      routeId === "exact_federal_register_document")).toBe(false);

    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-reviewed-order-841",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-reviewed-order-841",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-reviewed-order-841",
    });

    expect(introduction.review).toMatchObject({
      status: "partial",
      documentNumber: "2018-03708",
      plan: {
        instrumentFamily: "federal_rule",
        steps: expect.arrayContaining([
          expect.objectContaining({
            sourceRoute: "complementary_policy_explanations",
            status: "searched",
            attempts: 1,
          }),
          expect.objectContaining({
            sourceRoute: "confirmed_federal_register_record",
            status: "not_started",
          }),
        ]),
      },
      claims: expect.arrayContaining([
        expect.objectContaining({
          predicate: "policy_explanation",
          statement: expect.stringContaining("is amending its regulations"),
          citation: expect.objectContaining({
            provider: "Federal Register API",
            canonicalUrl,
          }),
        }),
      ]),
    });
    expect(introduction.review.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
    expect(requested).toContain(exactApi);
  });

  it("routes the retained Hospital Price Transparency API abstract through the federal-rule introductory plan", async () => {
    const title =
      "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS Policy Changes and Payment Rates and Ambulatory Surgical Center Payment System Policy Changes and Payment Rates. Price Transparency Requirements for Hospitals To Make Standard Charges Public";
    const documentNumber = "2019-24931";
    const exactApi =
      `https://www.federalregister.gov/api/v1/documents/${documentNumber}.json`;
    const abstract =
      "This final rule establishes requirements for hospitals operating in the United States to establish, update, and make public a list of their standard charges for the items and services that they provide. These actions are necessary to promote price transparency in health care and public access to hospital standard charges. By disclosing hospital standard charges, we believe the public (including patients, employers, clinicians, and other third parties) will have the information necessary to make";
    const requested: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      requested.push(url);
      if (url.includes("/api/v1/documents.json")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: documentNumber,
            title,
            type: "Rule",
            abstract,
            action: "Final rule.",
            html_url:
              "https://www.federalregister.gov/documents/2019/11/27/2019-24931/medicare-and-medicaid-programs-cy-2020-hospital-outpatient-pps-policy-changes-and-payment-rates-and",
            body_html_url:
              "https://www.federalregister.gov/documents/full_text/html/2019/11/27/2019-24931.html",
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2019/11/27/2019-24931.txt",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2019-11-27/pdf/2019-24931.pdf",
            publication_date: "2019-11-27",
            effective_on: "2021-01-01",
            agencies: [{ name: "Health and Human Services Department" }],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("https://api.gdeltproject.org/")) {
        return new Response(JSON.stringify({ articles: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.startsWith("https://api.regulations.gov/v4/documents?")) {
        return new Response(JSON.stringify({
          data: [{
            id: "CMS-2019-0150-0001",
            type: "documents",
            attributes: {
              title: "Hospital Price Transparency Requirements",
              documentType: "Rule",
              docketId: "CMS-2019-0150",
              agencyId: "CMS",
              frDocNum: documentNumber,
              postedDate: "2019-11-27T00:00:00Z",
              effectiveDate: "2021-01-01T00:00:00Z",
              commentStartDate: "2019-08-09T00:00:00Z",
              commentEndDate: "2019-09-27T00:00:00Z",
              withdrawn: false,
            },
          }],
        }), { headers: { "content-type": "application/vnd.api+json" } });
      }
      if (url ===
          "https://api.regulations.gov/v4/documents/CMS-2019-0150-0001") {
        return new Response(JSON.stringify({
          data: {
            id: "CMS-2019-0150-0001",
            type: "documents",
            attributes: {
              title: "Hospital Price Transparency Requirements",
              documentType: "Rule",
              docketId: "CMS-2019-0150",
              agencyId: "CMS",
              frDocNum: documentNumber,
              postedDate: "2019-11-27T00:00:00Z",
              effectiveDate: "2021-01-01T00:00:00Z",
              commentStartDate: "2019-08-09T00:00:00Z",
              commentEndDate: "2019-09-27T00:00:00Z",
              withdrawn: false,
            },
          },
        }), { headers: { "content-type": "application/vnd.api+json" } });
      }
      return new Response("temporarily unavailable", { status: 503 });
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      regulationsApiKey: "runtime-regulations-secret",
      times: Array.from({ length: 40 }, (_, index) =>
        new Date(Date.parse("2026-09-18T12:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-hospital-price-transparency-name-only",
      shockInput: "Hospital Price Transparency Final Rule",
      requestedJurisdiction: null,
      approximateYear: null,
      intendedEpisode: null,
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-hospital-price-transparency-name-only",
    });
    const candidate = resolved.projection.candidates[0]!;
    expect(candidate).toMatchObject({
      officialTitle: title,
      instrumentType: "Rule",
      formalIdentifiers: [documentNumber],
      identitySources: expect.arrayContaining([
        expect.objectContaining({
          routeId: "federal_register_api_excerpt",
          nativeId: documentNumber,
          locator: exactApi,
          accessStatus: "retained_passage",
          inspectedText: "abstract",
          retainedText: expect.stringContaining(
            "establishes requirements for hospitals",
          ),
        }),
      ]),
    });
    expect(candidate.identitySources.some(({ routeId }) =>
      routeId === "exact_federal_register_document")).toBe(false);

    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-hospital-price-transparency-name-only",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-hospital-price-transparency-name-only",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-hospital-price-transparency-name-only",
    });

    expect(introduction.review).toMatchObject({
      status: "partial",
      documentNumber,
      plan: {
        instrumentFamily: "federal_rule",
        steps: expect.arrayContaining([
          expect.objectContaining({
            sourceRoute: "complementary_policy_explanations",
            status: "searched",
            attempts: 1,
          }),
          expect.objectContaining({
            sourceRoute: "confirmed_federal_register_record",
            status: "not_started",
          }),
        ]),
      },
      claims: expect.arrayContaining([
        expect.objectContaining({
          predicate: "policy_explanation",
          statement: expect.stringContaining(
            "establishes requirements for hospitals",
          ),
          citation: expect.objectContaining({
            provider: "Federal Register API",
            canonicalUrl: exactApi,
          }),
        }),
      ]),
    });
    expect(introduction.review.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
    expect(requested.filter((url) => url === exactApi)).toHaveLength(2);

    const core = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "continue-hospital-price-transparency-core",
    });
    const coverage = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: core.projection.revision,
      operationId: "continue-hospital-price-transparency-coverage",
    });
    const enforcement = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: coverage.projection.revision,
      operationId: "continue-hospital-price-transparency-enforcement",
    });
    const administrative = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: enforcement.projection.revision,
      operationId: "continue-hospital-price-transparency-regulations",
    });

    expect(administrative.review).toMatchObject({
      documentNumber,
      identityFingerprint: candidate.identityFingerprint,
      plan: {
        documentNumber,
        instrumentFamily: "federal_rule",
        steps: expect.arrayContaining([
          expect.objectContaining({
            sourceRoute: "regulations_gov_docket",
            status: "searched",
            attempts: 1,
          }),
        ]),
      },
      claims: expect.arrayContaining([
        expect.objectContaining({
          predicate: "historical_version_change",
          citation: expect.objectContaining({
            provider: "Regulations.gov",
          }),
        }),
      ]),
    });
    const regulationsClaim = administrative.review.claims.find(({ citation }) =>
      citation.provider === "Regulations.gov");
    expect(regulationsClaim?.citation).toMatchObject({
      provider: "Regulations.gov",
      sourceTitle: "U.S. General Services Administration",
      sourceRole: expect.stringContaining(
        "official administrative-docket metadata",
      ),
    });
    expect(regulationsClaim?.citation.sourceTitle)
      .not.toBe("Regulations.gov");
    expect(regulationsClaim?.citation.sourceRole)
      .not.toContain("Regulations.gov");
    expect(requested).toEqual(expect.arrayContaining([
      expect.stringContaining("https://api.regulations.gov/v4/documents?"),
      "https://api.regulations.gov/v4/documents/CMS-2019-0150-0001",
    ]));
  });

  it("retains Order 841's delayed implementation fact through acquisition, evidence storage, replay, and compact projection", async () => {
    const bodyHtml =
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
    const policyBody = `<!doctype html><html><head><title>Order 841</title></head><body><main>
      <p>18 CFR Part 35</p>
      <h1>SUMMARY:</h1>
      <p>This final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources.</p>
      <h1>DATES:</h1><p>This final rule is effective June 4, 2018.</p>
      <p>As discussed further below, each RTO/ISO must file the tariff changes needed to implement the requirements of this Final Rule within 270 days of the publication date of this Final Rule in the Federal Register.</p>
      <p>We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.</p>
      <p>This Final Rule requires each RTO/ISO to implement market rules applicable to electric storage resources, as defined herein, that voluntarily seek to participate in the RTO/ISO markets; this Final Rule does not require electric storage resources to participate in those markets.</p>
      <p>We clarify that this Final Rule does not exempt an electric storage resource that is participating in RTO/ISO capacity markets from any applicable penalties for non-performance.</p>
      <p>In consideration of the foregoing, the Commission amends Part 35, Chapter I, Title 18, Code of Federal Regulations, as follows:</p>
      <p>2. Amend § 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:</p>
      <p>[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]</p>
    </main></body></html>`;
    const ecfrXml = (paragraphs: string[]) => `<?xml version="1.0"?>
      <DIV5 N="35" TYPE="PART" hierarchy_metadata="{&amp;quot;path&amp;quot;:&amp;quot;/on/_SUBSTITUTE_DATE_/title-18/part-35&amp;quot;,&amp;quot;citation&amp;quot;:&amp;quot;18 CFR Part 35&amp;quot;}">
        <DIV8 N="35.28" TYPE="SECTION">
          ${paragraphs.map((value) => `<P>${value}</P>`).join("\n")}
        </DIV8>
      </DIV5>`;
    const historicalBoundary =
      "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.";
    const historicalAddition =
      "(9) Electric storage resources. Each Commission-approved independent system operator and regional transmission organization must have tariff provisions providing a participation model for electric storage resources.";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("/api/v1/documents.json")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: "2018-03708",
            title: "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
            type: "Rule",
            action: "Final rule.",
            abstract: "The Commission is amending its regulations to remove barriers to electric storage participation.",
            html_url: "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
            body_html_url: bodyHtml,
            raw_text_url: "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
            pdf_url: "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
            publication_date: "2018-03-06",
            effective_on: "2018-06-04",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === bodyHtml) {
        return new Response(policyBody, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url.includes("/api/versioner/v1/versions/title-18.json?part=35")) {
        return new Response(JSON.stringify({
          content_versions: [{
            date: "2018-06-04",
            amendment_date: "2018-06-04",
            issue_date: "2018-06-04",
            identifier: "35.28",
            name: "§ 35.28 Non-discriminatory open access transmission tariff.",
            part: "35",
            substantive: true,
            removed: false,
            subpart: null,
            title: "18",
            type: "section",
          }],
          meta: {
            title: "18",
            result_count: "1",
            issue_date: { gte: "2018-06-03", lte: "2018-06-11" },
            latest_amendment_date: "2018-06-04",
            latest_issue_date: "2018-06-04",
          },
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/full/2018-06-03/title-18.xml?part=35")) {
        return new Response(ecfrXml([historicalBoundary]), {
          headers: { "content-type": "application/xml" },
        });
      }
      if (url.includes("/full/2018-06-04/title-18.xml?part=35")) {
        return new Response(ecfrXml([
          historicalBoundary,
          historicalAddition,
        ]), {
          headers: { "content-type": "application/xml" },
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      times: Array.from({ length: 60 }, (_, index) =>
        new Date(Date.parse("2026-09-12T12:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-order-841",
      shockInput: "FERC Order 841 (2018-03708)",
      approximateYear: "2018",
      intendedEpisode: "final rule",
      study: {
        ...createInput.study,
        population: "Regional transmission organizations and independent system operators",
        industry: ["Electric power markets"],
      },
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-order-841",
    });
    const candidate = resolved.projection.candidates[0]!;
    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-order-841",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-order-841",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-order-841",
    });
    expect(introduction.review.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "policy_explanation" }),
    ]));
    expect(introduction.review.requirements.every(({ status }) =>
      status === "not_yet_searched")).toBe(true);
    const researched = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "research-order-841-controlling",
    });
    expect(researched.projection.policyReview).toMatchObject({
      status: "partial",
      documentNumber: "2018-03708",
      sourceCount: expect.any(Number),
      passageCount: expect.any(Number),
      claimCount: expect.any(Number),
      failureCode: null,
      plan: {
        nextStepId: "fr-coverage-2018-03708",
        steps: [
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
        ],
      },
      progress: {
        searchedSteps: 2,
        totalSteps: 5,
        chargedDocumentAttempts: expect.any(Number),
        interruptedOperations: 0,
      },
    });
    expect(researched.projection).toMatchObject({
      canResearchPolicy: false,
      canContinuePolicy: true,
    });
    const policy = researched.projection.policyReview!;
    const effective = policy.claims.find(
      ({ predicate }) => predicate === "legal_effect_date",
    )!;
    const implementation = policy.claims.find(
      ({ predicate }) => predicate === "implementation_schedule",
    )!;
    expect(effective.typedValue).toEqual({
      date: "2018-06-04",
      stage: "legal_effect",
    });
    expect(implementation.typedValue).toEqual({
      filingDeadlineDaysAfterPublication: 270,
      implementationWindowDaysAfterFilingDeadline: 365,
      anchor: "filing_deadline",
    });
    expect(implementation.citation.exactText).toContain(
      "a further 365 days from that date to implement the tariff provisions",
    );
    expect(implementation.qualification).toContain(
      "not the rule's legal-effective date",
    );
    expect(policy.evidenceSnapshotId).toBeTruthy();
    const visible = await fixture.evidenceStore.readVisibleClaim({
      ...auth,
      snapshotId: policy.evidenceSnapshotId!,
    }, implementation.claimId);
    expect(visible).toMatchObject({
      outcome: "found",
      claim: {
        citations: [{
          exactText: implementation.citation.exactText,
          canonicalUrl: bodyHtml,
          sourceRole: expect.stringContaining("official Federal Register"),
        }],
      },
    });
    const retained = await fixture.evidenceStore.read({
      ...auth,
      snapshotId: policy.evidenceSnapshotId!,
    });
    expect(retained).toMatchObject({
      outcome: "found",
      collection: {
        sources: expect.arrayContaining([
          expect.objectContaining({
            provider: "govinfo",
            accessStatus: "available_metadata",
            inspectedText: "metadata_only",
            role: expect.stringContaining("legal-edition locator"),
          }),
        ]),
      },
    });
    const freshRuntime = new SixScreenWorkflowRuntime({
      store: fixture.store,
      taskStore: fixture.taskStore,
      evidenceStore: fixture.evidenceStore,
      signingKey: "test-signing-key-with-at-least-thirty-two-characters-123456",
      now: () => "2026-09-12T12:01:00.000Z",
      fetch: fetch as typeof globalThis.fetch,
    });
    const fetchCallsBeforeReplay = fetch.mock.calls.length;
    const replayed = await freshRuntime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "research-order-841-controlling",
    });
    expect(replayed.review).toEqual(policy);
    expect(replayed.projection.revision).toBe(researched.projection.revision);
    expect(fetch).toHaveBeenCalledTimes(fetchCallsBeforeReplay);

    let releaseInterrupted: ((response: Response) => void) | null = null;
    const interruptedFetch = vi.fn(() => new Promise<Response>((resolve) => {
      releaseInterrupted = resolve;
    }));
    const interruptedRuntime = new SixScreenWorkflowRuntime({
      store: fixture.store,
      taskStore: fixture.taskStore,
      evidenceStore: fixture.evidenceStore,
      signingKey: "test-signing-key-with-at-least-thirty-two-characters-123456",
      now: () => "2026-09-12T12:00:20.000Z",
      fetch: interruptedFetch,
    });
    const interrupted = interruptedRuntime.continuePolicyResearch(auth, {
      expectedRevision: researched.projection.revision,
      operationId: "continue-order-841",
    });
    await vi.waitFor(() => expect(interruptedFetch).toHaveBeenCalledTimes(1));
    await expect(interruptedRuntime.continuePolicyResearch(auth, {
      expectedRevision: researched.projection.revision,
      operationId: "continue-order-841",
    })).rejects.toThrow(/already running/u);
    expect(interruptedFetch).toHaveBeenCalledTimes(1);
    const reservedTask = await fixture.taskStore.read({
      ...auth,
      taskId: policy.taskId,
    });
    expect(reservedTask).toMatchObject({
      outcome: "found",
      record: { task: { state: "running", reserved: { documentAttempts: 2 } } },
    });
    const recoveryRuntime = new SixScreenWorkflowRuntime({
      store: fixture.store,
      taskStore: fixture.taskStore,
      evidenceStore: fixture.evidenceStore,
      signingKey: "test-signing-key-with-at-least-thirty-two-characters-123456",
      now: () => "2026-09-12T12:10:00.000Z",
      fetch: fetch as typeof globalThis.fetch,
    });
    const continued = await recoveryRuntime.continuePolicyResearch(auth, {
      expectedRevision: researched.projection.revision,
      operationId: "continue-order-841-recovered",
    });
    expect(continued.review).toMatchObject({
      status: "partial",
      passageCount: 11,
      claimCount: 11,
      plan: {
        nextStepId: "fr-enforcement-2018-03708",
        steps: [
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
        ],
      },
      progress: {
        searchedSteps: 3,
        totalSteps: 5,
        retainedDocuments: 2,
        chargedDocumentAttempts: 6,
        interruptedOperations: 1,
      },
      requirements: expect.arrayContaining([
        expect.objectContaining({ kind: "coverage", status: "supported" }),
        expect.objectContaining({ kind: "exemption", status: "supported" }),
        expect.objectContaining({
          kind: "previous_baseline",
          status: "not_yet_searched",
        }),
        expect.objectContaining({ kind: "version", status: "not_yet_searched" }),
      ]),
      unresolved: [
        "previous_baseline",
        "version",
        "enforcement",
        "penalty",
      ],
    });
    expect(continued.projection.canContinuePolicy).toBe(true);
    const exemption = continued.review.claims.find(
      ({ predicate }) => predicate === "exemption_rule",
    )!;
    expect(exemption.typedValue).toEqual({
      documentNumber: "2018-03708",
      disposition: "not_exempt",
    });
    expect(exemption.citation.exactText).toContain("does not exempt");
    const continuedEvidence = await fixture.evidenceStore.readVisibleClaim({
      ...auth,
      snapshotId: continued.review.evidenceSnapshotId!,
    }, exemption.claimId);
    expect(continuedEvidence).toMatchObject({
      outcome: "found",
      claim: {
        citations: [{ exactText: exemption.citation.exactText }],
      },
    });
    const task = await fixture.taskStore.read({
      ...auth,
      taskId: policy.taskId,
    });
    expect(task).toMatchObject({
      outcome: "found",
      record: {
        task: {
          state: "queued",
          profileName: "policy-standard",
          usage: { documentAttempts: 6, usefulDocuments: 4 },
          reserved: { documentAttempts: 0, receivedBytes: 0 },
          pendingWorkIds: ["fr-enforcement-2018-03708"],
          completedWorkIds: [
            "explanatory-context-2018-03708",
            "fr-core-2018-03708",
            "fr-coverage-2018-03708",
          ],
          operations: expect.arrayContaining([
            expect.objectContaining({ status: "ambiguous" }),
          ]),
        },
      },
    });
    releaseInterrupted!(new Response(policyBody, {
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
    await expect(interrupted).rejects.toThrow(/persistence failed \(stale\)/u);
    const continuedReplay = await recoveryRuntime.continuePolicyResearch(auth, {
      expectedRevision: researched.projection.revision,
      operationId: "continue-order-841-recovered",
    });
    expect(continuedReplay.review).toEqual(continued.review);
    expect(continuedReplay.projection.revision).toBe(
      continued.projection.revision,
    );
    expect(fetch).toHaveBeenCalledTimes(8);

    const enforcement = await recoveryRuntime.continuePolicyResearch(auth, {
      expectedRevision: continued.projection.revision,
      operationId: "continue-order-841-enforcement",
    });
    expect(enforcement.review).toMatchObject({
      status: "partial",
      claimCount: 11,
      plan: {
        nextStepId: "fr-context-2018-03708",
        steps: [
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({
            sourceRoute: "confirmed_federal_register_record",
            status: "searched",
            attempts: 1,
          }),
          expect.objectContaining({ status: "not_started", attempts: 0 }),
        ],
      },
      progress: { searchedSteps: 4, totalSteps: 5 },
      requirements: expect.arrayContaining([
        expect.objectContaining({
          kind: "enforcement",
          status: "searched_not_found",
        }),
        expect.objectContaining({
          kind: "penalty",
          status: "searched_not_found",
        }),
      ]),
    });

    const historical = await recoveryRuntime.continuePolicyResearch(auth, {
      expectedRevision: enforcement.projection.revision,
      operationId: "continue-order-841-history",
    });
    expect(historical.review).toMatchObject({
      status: "partial",
      sourceCount: 6,
      passageCount: 13,
      claimCount: 13,
      plan: {
        nextStepId: null,
        steps: [
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({
            sourceRoute: "federal_register_ecfr_history",
            status: "searched",
            attempts: 1,
          }),
        ],
      },
      progress: {
        searchedSteps: 5,
        totalSteps: 5,
        retainedDocuments: 5,
        chargedDocumentAttempts: 11,
        interruptedOperations: 1,
      },
      requirements: expect.arrayContaining([
        expect.objectContaining({
          kind: "previous_baseline",
          status: "supported",
        }),
        expect.objectContaining({ kind: "version", status: "supported" }),
      ]),
      unresolved: ["enforcement", "penalty"],
    });
    expect(historical.projection.canContinuePolicy).toBe(false);
    const previousBaseline = historical.review.claims.find(
      ({ predicate }) => predicate === "previous_baseline",
    )!;
    const historicalVersion = historical.review.claims.find(
      ({ predicate }) => predicate === "historical_version_change",
    )!;
    expect(previousBaseline).toMatchObject({
      statement: expect.stringContaining("Market Violation"),
      typedValue: { asOf: "2018-06-03", comparedWith: "2018-06-04" },
      citation: { canonicalUrl: expect.stringContaining("2018-06-03") },
    });
    expect(historicalVersion).toMatchObject({
      statement: expect.stringContaining("participation model for electric storage"),
      typedValue: {
        baselineAsOf: "2018-06-03",
        effectiveAsOf: "2018-06-04",
        changed: true,
      },
      citation: { canonicalUrl: expect.stringContaining("2018-06-04") },
    });
    const restoredHistory = await recoveryRuntime.status(auth);
    expect(restoredHistory.projection.policyReview).toEqual(historical.review);
    const retainedHistory = await fixture.evidenceStore.readVisibleClaim({
      ...auth,
      snapshotId: historical.review.evidenceSnapshotId!,
    }, historicalVersion.claimId);
    expect(retainedHistory).toMatchObject({
      outcome: "found",
      claim: {
        citations: [{
          exactText: historicalVersion.citation.exactText,
          canonicalUrl: historicalVersion.citation.canonicalUrl,
        }],
      },
    });
    const retainedHistorySnapshot = await fixture.evidenceStore.read({
      ...auth,
      snapshotId: historical.review.evidenceSnapshotId!,
    });
    expect(retainedHistorySnapshot).toMatchObject({
      outcome: "found",
      collection: {
        sources: expect.arrayContaining([expect.objectContaining({
          provider: "ecfr",
          canonicalUrl: expect.stringContaining(
            "/api/versioner/v1/versions/title-18.json?part=35",
          ),
          accessStatus: "available_metadata",
          inspectedText: "metadata_only",
          contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        })]),
        documentVersions: expect.arrayContaining([expect.objectContaining({
          representation: "ecfr-content-version-metadata-json",
          contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        })]),
      },
    });
    const completedTask = await fixture.taskStore.read({
      ...auth,
      taskId: policy.taskId,
    });
    expect(completedTask).toMatchObject({
      outcome: "found",
      record: {
        task: {
          state: "partial",
          usage: { documentAttempts: 11, usefulDocuments: 9 },
          pendingWorkIds: [],
          completedWorkIds: [
            "explanatory-context-2018-03708",
            "fr-core-2018-03708",
            "fr-coverage-2018-03708",
            "fr-enforcement-2018-03708",
            "fr-context-2018-03708",
          ],
        },
      },
    });
    const historicalReplay = await recoveryRuntime.continuePolicyResearch(auth, {
      expectedRevision: enforcement.projection.revision,
      operationId: "continue-order-841-history",
    });
    expect(historicalReplay.review).toEqual(historical.review);
    expect(historicalReplay.projection.revision).toBe(
      historical.projection.revision,
    );
    expect(fetch).toHaveBeenCalledTimes(13);
    const initialReplayAfterContinuation = await recoveryRuntime.researchPolicy(
      auth,
      {
        expectedRevision: opened.projection.revision,
        operationId: "research-order-841",
      },
    );
    expect(initialReplayAfterContinuation.review).toEqual(introduction.review);
    expect(initialReplayAfterContinuation.projection.revision).toBe(
      historical.projection.revision,
    );
    expect(initialReplayAfterContinuation.projection.policyReview).toEqual(
      historical.review,
    );
    expect(fetch).toHaveBeenCalledTimes(13);
    await expect(recoveryRuntime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "unrecognized-stale-policy-action",
    })).rejects.toThrow(/Stale six-screen workflow mutation/u);
  });

  it("commits and replays an immutable amendment fallback when adjacent-date eCFR is unavailable", async () => {
    const bodyHtml =
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
    const instruction =
      "Amend \u00a7 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:";
    const policyBody = `<!doctype html><html><head><title>Order 841</title></head><body><main>
      <p>18 CFR Part 35</p>
      <p>This final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources.</p>
      <p>This final rule is effective June 4, 2018.</p>
      <p>Each RTO/ISO must file the tariff changes needed to implement the requirements of this Final Rule within 270 days of the publication date of this Final Rule in the Federal Register.</p>
      <p>We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.</p>
      <p>This Final Rule requires each RTO/ISO to implement market rules applicable to electric storage resources that voluntarily seek to participate in the RTO/ISO markets.</p>
      <p>This Final Rule does not exempt a participating electric storage resource from applicable penalties for non-performance.</p>
      <p>In consideration of the foregoing, the Commission amends Part 35, Chapter I, Title 18, Code of Federal Regulations, as follows:</p>
      <p>2. ${instruction}</p>
      <p>[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]</p>
    </main></body></html>`;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.includes("/api/v1/documents.json")) {
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: "2018-03708",
            title: "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
            type: "Rule",
            action: "Final rule.",
            abstract: "The Commission is amending its regulations to remove barriers to electric storage participation.",
            html_url: "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
            body_html_url: bodyHtml,
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
            publication_date: "2018-03-06",
            effective_on: "2018-06-04",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === bodyHtml) {
        return new Response(policyBody, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (
        url.includes("www.ecfr.gov/api/versioner/v1/versions/") ||
        url.includes("www.ecfr.gov/api/versioner/v1/full/")
      ) {
        return new Response("historical representation unavailable", {
          status: 404,
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const fixture = runtime({
      fetch: fetch as typeof globalThis.fetch,
      times: Array.from({ length: 80 }, (_, index) =>
        new Date(Date.parse("2026-09-12T14:00:00.000Z") + index * 1_000)
          .toISOString()),
    });
    const created = await fixture.runtime.create({
      ...createInput,
      operationId: "create-order-841-fallback",
      shockInput: "FERC Order 841 (2018-03708)",
      approximateYear: "2018",
      intendedEpisode: "final rule",
      study: {
        ...createInput.study,
        population: "Regional transmission organizations and independent system operators",
        industry: ["Electric power markets"],
      },
    });
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const resolved = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-order-841-fallback",
    });
    const candidate = resolved.projection.candidates[0]!;
    const confirmed = await fixture.runtime.confirmShock(auth, {
      expectedRevision: resolved.projection.revision,
      operationId: "confirm-order-841-fallback",
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        resolved.privateSnapshot.state.originalRequestFingerprint,
      currentRequestFingerprint:
        resolved.privateSnapshot.state.currentRequestFingerprint,
      identityRevision: resolved.projection.identityRevision,
    });
    const opened = await fixture.runtime.openScreen2(auth, {
      expectedRevision: confirmed.projection.revision,
      operationId: "open-order-841-fallback",
    });
    const introduction = await fixture.runtime.researchPolicy(auth, {
      expectedRevision: opened.projection.revision,
      operationId: "research-order-841-fallback",
    });
    const core = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: introduction.projection.revision,
      operationId: "continue-order-841-fallback-core",
    });
    const coverage = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: core.projection.revision,
      operationId: "continue-order-841-fallback-coverage",
    });
    const previousSnapshotId = coverage.review.evidenceSnapshotId!;
    const enforcement = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: coverage.projection.revision,
      operationId: "continue-order-841-fallback-enforcement",
    });
    const historical = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: enforcement.projection.revision,
      operationId: "continue-order-841-fallback-history",
    });

    expect(new Set([
      introduction.review.taskId,
      core.review.taskId,
      coverage.review.taskId,
      enforcement.review.taskId,
      historical.review.taskId,
    ])).toEqual(new Set([introduction.review.taskId]));
    expect([
      introduction,
      core,
      coverage,
      enforcement,
      historical,
    ].map(({ review }) => review.progress.chargedDocumentAttempts))
      .toEqual([...[
        introduction,
        core,
        coverage,
        enforcement,
        historical,
      ].map(({ review }) => review.progress.chargedDocumentAttempts)]
        .sort((left, right) => left - right));
    expect(historical.review.progress.continuationMode)
      .toBe("automatic_standard");

    expect(historical.review).toMatchObject({
      status: "partial",
      failureCode: null,
      sourceCount: expect.any(Number),
      passageCount: expect.any(Number),
      claimCount: expect.any(Number),
      plan: {
        nextStepId: null,
        steps: [
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({ status: "searched", attempts: 1 }),
          expect.objectContaining({
            sourceRoute: "federal_register_ecfr_history",
            status: "searched",
            attempts: 1,
          }),
        ],
      },
      requirements: expect.arrayContaining([
        expect.objectContaining({
          kind: "previous_baseline",
          status: "inaccessible",
        }),
        expect.objectContaining({ kind: "version", status: "inaccessible" }),
      ]),
      unresolved: [
        "previous_baseline",
        "version",
        "enforcement",
        "penalty",
      ],
    });
    expect(historical.projection.canContinuePolicy).toBe(false);
    expect(historical.review.evidenceSnapshotId).not.toBe(previousSnapshotId);
    const fallbackClaim = historical.review.claims.find(
      ({ predicate }) => predicate === "contemporaneous_amendment_record",
    )!;
    expect(fallbackClaim).toMatchObject({
      typedValue: {
        cfrCoordinates: [{ title: "18", part: "35" }],
        historicalVersionEstablished: false,
        legalEditionEstablished: false,
        fallbackReason: "historical_date_unavailable",
      },
      citation: {
        exactText: instruction,
        canonicalUrl: bodyHtml,
      },
    });
    expect(fallbackClaim.qualification).toContain(
      "does not establish the immediately preceding codified text",
    );
    expect(historical.review.limitation).toContain(
      "no current CFR text was substituted",
    );
    expect(await fixture.evidenceStore.readVisibleClaim({
      ...auth,
      snapshotId: historical.review.evidenceSnapshotId!,
    }, fallbackClaim.claimId)).toMatchObject({
      outcome: "found",
      claim: { citations: [{ exactText: instruction }] },
    });
    const prior = await fixture.evidenceStore.read({
      ...auth,
      snapshotId: previousSnapshotId,
    });
    expect(prior.outcome).toBe("found");
    if (prior.outcome !== "found") throw new Error("Expected prior evidence.");
    expect(prior.collection.claims).not.toContainEqual(
      expect.objectContaining({ predicate: "contemporaneous_amendment_record" }),
    );
    const replay = await fixture.runtime.continuePolicyResearch(auth, {
      expectedRevision: coverage.projection.revision,
      operationId: "continue-order-841-fallback-history",
    });
    expect(replay.review).toEqual(historical.review);
    expect(replay.projection.revision).toBe(historical.projection.revision);
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(7);
    const task = await fixture.taskStore.read({
      ...auth,
      taskId: historical.review.taskId,
    });
    expect(task).toMatchObject({
      outcome: "found",
      record: {
        task: {
          state: "partial",
          usage: {
            documentAttempts: expect.any(Number),
            usefulDocuments: expect.any(Number),
          },
          pendingWorkIds: [],
          completedWorkIds: [
            "explanatory-context-2018-03708",
            "fr-core-2018-03708",
            "fr-coverage-2018-03708",
            "fr-enforcement-2018-03708",
            "fr-context-2018-03708",
          ],
        },
      },
    });
  });

  it("replays a completed identity operation without repeating its bounded query variants", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      count: 0,
      results: [],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const fixture = runtime({ fetch: fetch as typeof globalThis.fetch });
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const first = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-once",
    });
    const replay = await fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-once",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(replay.resolution).toEqual(first.resolution);
    expect(replay.privateSnapshot.revision).toBe(first.privateSnapshot.revision);
  });

  it("does not duplicate an in-flight provider request during its saved lease", async () => {
    const releases: Array<(response: Response) => void> = [];
    const fetch = vi.fn(() => new Promise<Response>((resolve) => {
      releases.push(resolve);
    }));
    const fixture = runtime({ fetch: fetch as typeof globalThis.fetch });
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const first = fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-in-flight",
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await expect(fixture.runtime.resolveShock(auth, {
      expectedRevision: 0,
      operationId: "resolve-in-flight",
    })).rejects.toThrow(/already running/u);
    expect(fetch).toHaveBeenCalledTimes(1);
    releases[0]!(new Response(JSON.stringify({ count: 0, results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    releases[1]!(new Response(JSON.stringify({ count: 0, results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await expect(first).resolves.toMatchObject({
      projection: { status: "identity_input" },
      resolution: { status: "not_resolved" },
    });
  });

  it("records, returns, and replays a validated unchanged mutation without a scientific revision", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const before = await fixture.store.read(auth);
    if (before.outcome !== "found") throw new Error("Expected workflow.");
    const unchanged = await fixture.runtime.updateStudy(auth, {
      expectedRevision: created.privateSnapshot.revision,
      operationId: "unchanged-study-update",
      study: createInput.study,
    });
    expect(unchanged).toMatchObject({
      changed: false,
      replayed: false,
      mutationOutcome: "unchanged",
      privateSnapshot: { revision: 0 },
    });
    expect(unchanged.privateSnapshot.state.changeLog).toEqual([]);
    expect(unchanged.privateSnapshot.state.artifacts).toEqual([]);

    const after = await fixture.store.read(auth);
    if (after.outcome !== "found") throw new Error("Expected workflow.");
    expect(after.record.state).toEqual(before.record.state);
    expect(after.record.generation).toBe(before.record.generation + 1);
    expect(after.record.operationReplays.at(-1)).toMatchObject({
      operationId: "unchanged-study-update",
      committedRevision: 0,
      mutationOutcome: "unchanged",
    });

    const replay = await fixture.runtime.updateStudy(auth, {
      expectedRevision: created.privateSnapshot.revision,
      operationId: "unchanged-study-update",
      study: createInput.study,
    });
    expect(replay).toMatchObject({
      changed: false,
      replayed: true,
      mutationOutcome: "replayed",
      privateSnapshot: { revision: 0 },
    });
  });

  it("still rejects a different run and changed content at the stored revision", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const baseInput = {
      ...auth,
      expectedRevision: 0,
      operationKind: "contract-test",
      inputFingerprint: fingerprintSixScreenValue({ value: "same" }),
      updatedAt: "2026-09-12T11:00:00.000Z",
    };
    await expect(fixture.store.mutate({
      ...baseInput,
      operationId: "same-revision-content-change",
    }, (state) => ({
      state: { ...state, currentShockInput: "silently changed" },
      result: null,
    }))).rejects.toThrow(/without advancing its scientific revision/u);
    await expect(fixture.store.mutate({
      ...baseInput,
      operationId: "different-run-change",
    }, (state) => ({
      state: { ...state, runId: "run-other" },
      result: null,
    }))).rejects.toThrow(/cannot change its workflow run/u);
  });

  it("rejects stale state writes while a status read remains mutation-free", async () => {
    const fixture = runtime();
    const created = await fixture.runtime.create(createInput);
    const auth = {
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    };
    const before = await fixture.runtime.status(auth);
    const after = await fixture.runtime.status(auth);
    expect(after.privateSnapshot).toEqual(before.privateSnapshot);
    await fixture.runtime.updateShock(auth, {
      expectedRevision: 0,
      operationId: "update-1",
      shockInput: "Hospital Price Transparency final rule",
      requestedJurisdiction: "United States",
      approximateYear: "2019",
      intendedEpisode: "final rule",
    });
    await expect(fixture.runtime.updateShock(auth, {
      expectedRevision: 0,
      operationId: "stale-update",
      shockInput: "Another rule",
    })).rejects.toMatchObject({
      name: "SixScreenWorkflowProblemError",
      problem: {
        code: "revision_conflict",
        action: "update_shock",
        expectedRevision: 0,
        actualRevision: 1,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "guarded_rebase",
      },
    });
  });

  it("cleans up expired workflows without touching unexpired records", async () => {
    const fixture = runtime({
      times: [
        "2026-09-12T10:00:00.000Z",
        "2026-09-12T10:00:01.000Z",
      ],
    });
    const created = await fixture.runtime.create(createInput);
    expect((await fixture.runtime.status({
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    })).projection.runId).toBe(created.projection.runId);
    const early = await fixture.store.cleanupExpired(
      "2026-09-13T09:59:59.000Z",
    );
    expect(early.deleted).toBe(0);
    const expired = await fixture.store.cleanupExpired(
      "2026-09-13T10:00:00.000Z",
    );
    expect(expired.deleted).toBe(1);
    await expect(fixture.runtime.status({
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    })).rejects.toThrow(/unavailable or expired/u);
  });
});
