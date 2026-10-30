import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCREEN_02_SEARCH_EXPANSION_BUDGETS,
  SCREEN_02_SEARCH_EXPANSION_VERSION,
  buildScreen02AuditSearchResearchPlan,
  buildScreen02FindSearchResearchPlan,
  executeScreen02SearchExpansion,
  type Screen02SearchQueryVariant,
  type Screen02SearchRecordInput,
} from "../../src/worker/screen02-search-expansion";

const retrievedAt = "2026-08-13T16:00:00.000Z";

type ResultValue = {
  label: string;
};

function record(input: {
  id: string;
  title: string;
  jurisdiction?: string | null;
  formalIdentifier?: string | null;
  issuer?: string | null;
  treatmentAssignmentSignature?: string | null;
  semanticEventKey?: string | null;
  locator?: string | null;
  directSupport?: boolean;
}): Screen02SearchRecordInput<ResultValue> {
  return {
    recordId: input.id,
    canonicalIdentity: input.title,
    identityAliases: [],
    formalIdentifier: input.formalIdentifier ?? null,
    issuer: input.issuer ?? null,
    issuingJurisdiction: input.jurisdiction ?? null,
    treatmentAssignmentSignature:
      input.treatmentAssignmentSignature ?? null,
    semanticEventKey: input.semanticEventKey ?? null,
    locator: input.locator ?? null,
    directSupport: input.directSupport ?? false,
    value: { label: input.title },
  };
}

function findPlan(input: {
  expandedStages?: Array<"identity" | "timing" | "coverage" | "implementation">;
  supplemental?: boolean;
  resultsPerQuery?: number;
}) {
  return buildScreen02FindSearchResearchPlan({
    eventFamily: "Regulation",
    industry: "Manufacturing",
    topicTerms: ["supply chains"],
    maximumExpandedQueries: 4,
    resultsPerQuery: input.resultsPerQuery,
    sources: [
      {
        sourceId: "official-register",
        role: "official",
        baselineQueries: [
          {
            query: "manufacturing regulation",
            purpose: "Released native query.",
          },
        ],
        expandedStages: input.expandedStages,
      },
      ...(input.supplemental
        ? [
            {
              sourceId: "supplemental-index",
              role: "supplemental" as const,
              baselineQueries: [],
              expandedStages: ["timing" as const],
            },
          ]
        : []),
    ],
  });
}

function auditPlan(input: {
  expandedStages?: Array<"identity" | "timing" | "coverage" | "implementation">;
  resultsPerQuery?: number;
}) {
  return buildScreen02AuditSearchResearchPlan({
    eventFamily: "Privacy regulation",
    identity: {
      canonicalName: "California Consumer Privacy Act",
      aliases: ["CCPA"],
      formalIdentifier: "AB 375",
      issuer: "California Legislature",
      issuingJurisdiction: "California, United States",
    },
    jurisdictionAliases: ["California"],
    maximumExpandedQueries: 4,
    resultsPerQuery: input.resultsPerQuery,
    sources: [
      {
        sourceId: "official-legislation",
        role: "official",
        baselineQueries: [
          {
            query: "California Consumer Privacy Act",
            purpose: "Released exact-anchor query.",
          },
        ],
        expandedStages: input.expandedStages,
      },
    ],
  });
}

async function run(
  plan: ReturnType<
    | typeof buildScreen02FindSearchResearchPlan
    | typeof buildScreen02AuditSearchResearchPlan
  >,
  execute: (
    query: Screen02SearchQueryVariant,
  ) => Promise<readonly Screen02SearchRecordInput<ResultValue>[]>,
) {
  return executeScreen02SearchExpansion({
    plan,
    retrievedAt,
    execute,
  });
}

describe("Screen 2 guarded shared search expansion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([2, 4, 6])(
    "covers lifecycle stages before duplication and allocates fairly across %i sources",
    (sourceCount) => {
      const plan = buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        industry: "Manufacturing",
        maximumExpandedQueries: 6,
        sources: Array.from({ length: sourceCount }, (_, index) => ({
          sourceId: `source-${index + 1}`,
          role: index === sourceCount - 1 && sourceCount === 6
            ? "context" as const
            : "official" as const,
          baselineQueries: [{ query: `baseline ${index + 1}` }],
          expandedStages: [
            "identity" as const,
            "timing" as const,
            "coverage" as const,
            "implementation" as const,
          ],
        })),
      });

      expect(plan.expanded.slice(0, 4).map((query) => query.stage)).toEqual([
        "identity",
        "timing",
        "coverage",
        "implementation",
      ]);
      const allocations = Array.from({ length: sourceCount }, (_, index) =>
        plan.expanded.filter((query) => query.sourceId === `source-${index + 1}`)
          .length
      );
      expect(Math.max(...allocations) - Math.min(...allocations)).toBeLessThanOrEqual(1);
      if (sourceCount <= plan.expanded.length) {
        expect(allocations.every((count) => count > 0)).toBe(true);
      }
      if (sourceCount === 6) {
        expect(plan.expanded.at(-1)).toEqual(
          expect.objectContaining({
            sourceId: "source-6",
            sourceRole: "context",
          }),
        );
      }
    },
  );

  it("aborts a never-resolving expansion at one total deadline and preserves baseline", async () => {
    vi.useFakeTimers();
    const plan = findPlan({ expandedStages: ["timing", "coverage"] });
    const baseline = record({ id: "baseline-deadline", title: "Baseline Rule" });
    const expansionSignals: AbortSignal[] = [];
    const pending = executeScreen02SearchExpansion({
      plan,
      retrievedAt,
      deadlineMs: 50,
      execute: async (query, options) => {
        if (query.stage === "baseline") return [baseline];
        expansionSignals.push(options.signal);
        return new Promise<readonly Screen02SearchRecordInput<ResultValue>[]>(
          () => undefined,
        );
      },
    });

    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;
    expect(result.values).toEqual([baseline.value]);
    expect(expansionSignals[0]?.aborted).toBe(true);
    expect(result.comparison.expansionFaultFallbackUsed).toBe(true);
    expect(result.queryTelemetry.filter((item) => item.stage !== "baseline"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          failureKind: "timeout",
          error: expect.stringMatching(/deadline|abort/i),
        }),
      ]));
  });

  it("reports context separately and never calls it a recovered candidate", async () => {
    const plan = buildScreen02FindSearchResearchPlan({
      eventFamily: "Regulation",
      industry: "Manufacturing",
      maximumExpandedQueries: 1,
      sources: [
        {
          sourceId: "official-register",
          role: "official",
          baselineQueries: [{ query: "manufacturing regulation" }],
          expandedStages: [],
        },
        {
          sourceId: "context-index",
          role: "context",
          baselineQueries: [],
          expandedStages: ["implementation"],
        },
      ],
    });
    const context = record({
      id: "context-only",
      title: "A secondary article about implementation",
    });
    const result = await run(plan, async (query) =>
      query.sourceRole === "context" ? [context] : []
    );

    expect(result.records).toHaveLength(1);
    expect(result.comparison.expanded).toMatchObject({
      recordsAccepted: 0,
      contextLeadCount: 1,
    });
    expect(result.comparison.selectedRecords).toBe(0);
    expect(result.comparison.zeroResultRecovered).toBe(false);
    expect(result.comparison.selection).toBe("empty");
  });

  describe("Find", () => {
    it("keeps baseline parity when no expansion stage is enabled", async () => {
      const plan = findPlan({});
      const baseline = record({
        id: "baseline-rule",
        title: "Baseline Manufacturing Rule",
        jurisdiction: "United States",
        locator: "https://official.example/rule",
      });

      const result = await run(plan, async () => [baseline]);

      expect(plan.version).toBe(SCREEN_02_SEARCH_EXPANSION_VERSION);
      expect(plan.expanded).toEqual([]);
      expect(result.values).toEqual([baseline.value]);
      expect(result.records).toEqual([
        expect.objectContaining({
          recordId: baseline.recordId,
          sourceRole: "official",
          firstSeenStage: "baseline",
          disposition: "authoritative",
        }),
      ]);
      expect(result.comparison).toEqual(
        expect.objectContaining({
          baselineRecordsPreserved: 1,
          selectedRecords: 1,
          zeroResultRecovered: false,
          selection: "baseline-only",
          outcomeValuesInspected: false,
        }),
      );
    });

    it("recovers a bounded candidate when the baseline returns zero", async () => {
      const plan = findPlan({ expandedStages: ["timing"] });
      const recovered = record({
        id: "expanded-effective-date",
        title: "Expanded Manufacturing Reporting Rule",
        jurisdiction: "United States",
        directSupport: true,
      });

      const result = await run(plan, async (query) =>
        query.stage === "baseline" ? [] : [recovered],
      );

      expect(result.records.map((item) => item.recordId)).toEqual([
        recovered.recordId,
      ]);
      expect(result.records[0]).toEqual(
        expect.objectContaining({
          firstSeenStage: "timing",
          disposition: "authoritative",
        }),
      );
      expect(result.comparison.zeroResultRecovered).toBe(true);
      expect(result.comparison.selection).toBe("expanded-recovery");
      expect(result.manifestSupplement.queryMatrix).toHaveLength(2);
    });

    it("never lets duplicate or lead-only expansion remove an official baseline hit", async () => {
      const plan = findPlan({
        expandedStages: ["timing"],
        supplemental: true,
      });
      const baseline = record({
        id: "official-rule",
        title: "Supply Chain Reporting Rule",
        jurisdiction: "United States",
        locator: "https://official.example/Rule?id=1",
      });
      const duplicate = record({
        id: "supplemental-duplicate",
        title: baseline.canonicalIdentity,
        jurisdiction: baseline.issuingJurisdiction,
        locator: "https://official.example/Rule?id=1#summary",
      });
      const lead = record({
        id: "supplemental-lead",
        title: "Later Supply Chain Rule",
        jurisdiction: "United States",
      });

      const result = await run(plan, async (query) => {
        if (query.stage === "baseline") return [baseline];
        return query.sourceRole === "supplemental"
          ? [duplicate, lead]
          : [];
      });

      expect(result.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
        lead.recordId,
      ]);
      expect(result.records[0]?.disposition).toBe("authoritative");
      expect(result.records[1]?.disposition).toBe("lead-only");
      expect(result.comparison.baselineRecordsPreserved).toBe(1);
      expect(result.comparison.expanded.duplicateDrops).toBe(1);
      expect(result.comparison.selection).toBe("baseline-plus-expanded");
    });

    it("keeps distinct formal treatment versions while deduplicating exact formal identities and locators", async () => {
      const plan = findPlan({ expandedStages: ["timing"] });
      const baseline = record({
        id: "orchid-proposal",
        title: "Orchid Platform Duties Instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2019/101",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=phase:2019-02-01",
        locator: "https://official.example/orchid/proposal",
      });
      const finalVersion = record({
        id: "orchid-final",
        title: baseline.canonicalIdentity,
        jurisdiction: baseline.issuingJurisdiction,
        formalIdentifier: "OU 2020/202",
        issuer: baseline.issuer,
        treatmentAssignmentSignature: "timing=phase:2020-06-01",
        locator: "https://official.example/orchid/final",
      });
      const sameFormalIdentity = record({
        id: "orchid-proposal-second-query",
        title: "Drifted proposal title",
        jurisdiction: baseline.issuingJurisdiction,
        formalIdentifier: "ou-2019-101",
        issuer: baseline.issuer,
        treatmentAssignmentSignature: baseline.treatmentAssignmentSignature,
        locator: "https://official.example/orchid/proposal-copy",
      });
      const sameLocator = record({
        id: "orchid-final-same-locator",
        title: "Another catalog rendering",
        jurisdiction: baseline.issuingJurisdiction,
        formalIdentifier: "OU 2022/303",
        issuer: baseline.issuer,
        treatmentAssignmentSignature: "timing=phase:2022-09-01",
        locator: "https://official.example/orchid/final#details",
      });
      const expanded = [finalVersion, sameFormalIdentity, sameLocator];
      const execute = (records: typeof expanded) => run(plan, async (query) =>
        query.stage === "baseline" ? [baseline] : records
      );

      const forward = await execute(expanded);
      const reversed = await execute([...expanded].reverse());
      expect(forward.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
        finalVersion.recordId,
        sameLocator.recordId,
      ]);
      expect(reversed.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
        finalVersion.recordId,
        sameLocator.recordId,
      ]);
      expect(forward.comparison.expanded.duplicateDrops).toBe(1);
      expect(reversed.comparison.expanded.duplicateDrops).toBe(1);
    });

    it("retains conflicting rich California bill coordinates before clustering", async () => {
      const plan = findPlan({});
      const version = (id: string, formalIdentifier: string) => record({
        id,
        title: "California Consumer Privacy Act",
        jurisdiction: "California, United States",
        formalIdentifier,
        issuer: "California Legislature",
      });
      const chapter55 = version(
        "ab-375-chapter-55",
        "AB 375, Chapter 55, Statutes of 2018",
      );
      const chapter56 = version(
        "ab-375-chapter-56",
        "AB 375, Chapter 56, Statutes of 2024",
      );

      const result = await run(plan, async () => [chapter56, chapter55]);

      expect(result.records.map((item) => item.recordId)).toEqual([
        chapter55.recordId,
        chapter56.recordId,
      ]);
      expect(result.queryTelemetry[0]?.duplicateDrops).toBe(0);
    });

    it("does not collapse unrelated local identifiers before issuer-aware proposal clustering", async () => {
      const plan = findPlan({});
      const commerce = record({
        id: "commerce-order-12",
        title: "Commerce reporting waiver",
        jurisdiction: "Example Republic",
        formalIdentifier: "Order 12",
        issuer: "Commerce Department",
      });
      const energy = record({
        id: "energy-order-12",
        title: "Energy rationing direction",
        jurisdiction: "Example Republic",
        formalIdentifier: "order-12",
        issuer: "Energy Commission",
      });

      const result = await run(plan, async () => [energy, commerce]);
      expect(result.records.map((item) => item.recordId)).toEqual([
        commerce.recordId,
        energy.recordId,
      ]);
      expect(result.queryTelemetry.reduce(
        (sum, item) => sum + item.duplicateDrops,
        0,
      )).toBe(0);
    });

    it("retains exact formal identities with different treatment signatures", async () => {
      const plan = findPlan({});
      const firstPhase = record({
        id: "orchid-phase-one",
        title: "Orchid Platform Duties Instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/404",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=phase:2020-04-01",
        locator: "https://official.example/orchid/coverage-order",
      });
      const secondPhase = record({
        id: "orchid-phase-two",
        title: "Orchid Platform Duties Instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "ou-2020-404",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=phase:2021-04-01",
        locator: "https://official.example/orchid/coverage-order#phase-two",
      });

      const result = await run(plan, async () => [secondPhase, firstPhase]);
      expect(result.records.map((item) => item.recordId)).toEqual([
        firstPhase.recordId,
        secondPhase.recordId,
      ]);
    });

    it("retains scoped identities attributed to different known issuers", async () => {
      const plan = findPlan({});
      const national = record({
        id: "shared-native-record",
        title: "National energy instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/12",
        issuer: "National Energy Commission",
        treatmentAssignmentSignature: "timing=operative-start:2021-01-01",
        locator: "https://official.example/orchid/shared-record",
      });
      const regional = record({
        id: national.recordId,
        title: "Regional energy instrument",
        jurisdiction: national.issuingJurisdiction,
        formalIdentifier: national.formalIdentifier,
        issuer: "Regional Energy Commission",
        treatmentAssignmentSignature: national.treatmentAssignmentSignature,
        locator: national.locator,
      });

      const result = await run(plan, async () => [regional, national]);
      expect(result.records.map((item) => item.issuer)).toEqual([
        "National Energy Commission",
        "Regional Energy Commission",
      ]);
      expect(result.queryTelemetry[0]?.duplicateDrops).toBe(0);
    });

    it("retains one native record and locator when concrete assignments differ", async () => {
      const plan = findPlan({});
      const first = record({
        id: "shared-phase-record",
        title: "Orchid phased instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/44",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=phase:2021-01-01",
        locator: "https://official.example/orchid/phases",
      });
      const second = record({
        id: first.recordId,
        title: first.canonicalIdentity,
        jurisdiction: first.issuingJurisdiction,
        formalIdentifier: first.formalIdentifier,
        issuer: first.issuer,
        treatmentAssignmentSignature: "timing=phase:2022-01-01",
        locator: first.locator,
      });

      const result = await run(plan, async () => [second, first]);
      expect(result.records.map((item) => item.treatmentAssignmentSignature))
        .toEqual([
          "timing=phase:2021-01-01",
          "timing=phase:2022-01-01",
        ]);
    });

    it("retains identifierless same-title versions when assignment signatures differ", async () => {
      const plan = findPlan({});
      const first = record({
        id: "idless-phase-one",
        title: "Orchid Emergency Coverage Order",
        jurisdiction: "Orchid Union",
        issuer: "Orchid Emergency Authority",
        treatmentAssignmentSignature: "timing=phase:2020-04-01",
        locator: "https://official.example/orchid/emergency-order",
      });
      const second = record({
        id: "idless-phase-two",
        title: first.canonicalIdentity,
        jurisdiction: first.issuingJurisdiction,
        issuer: first.issuer,
        treatmentAssignmentSignature: "timing=phase:2021-04-01",
        locator: "https://official.example/orchid/emergency-order#phase-two",
      });

      const result = await run(plan, async () => [second, first]);
      expect(result.records.map((item) => item.recordId)).toEqual([
        first.recordId,
        second.recordId,
      ]);
    });

    it("selects the same deterministic valid prefix from an over-cap response permutation", async () => {
      const plan = findPlan({ resultsPerQuery: 3 });
      const records = ["echo", "alpha", "delta", "bravo", "charlie"].map(
        (id) => record({ id, title: `${id} regulation` }),
      );
      const forward = await run(plan, async () => records);
      const reversed = await run(plan, async () => [...records].reverse());

      expect(forward.records.map((item) => item.recordId)).toEqual([
        "alpha",
        "bravo",
        "charlie",
      ]);
      expect(reversed.records.map((item) => item.recordId)).toEqual(
        forward.records.map((item) => item.recordId),
      );
      expect(forward.queryTelemetry[0]).toMatchObject({
        recordsReturned: 5,
        recordsWithinBudget: 3,
        overBudgetRecordsDropped: 2,
      });
    });

    it("resolves exact identity-key ties by canonical payload order", async () => {
      const plan = findPlan({});
      const shared = record({
        id: "same-native-record",
        title: "Orchid Platform Duties Instrument",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/404",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=operative-start:2021-01-01",
        semanticEventKey: "same-platform-duties-event",
        locator: "https://official.example/orchid/platform-duties",
        directSupport: true,
      });
      const alpha = { ...shared, value: { label: "alpha-value" } };
      const zulu = { ...shared, value: { label: "zulu-value" } };

      const forward = await run(plan, async () => [alpha, zulu]);
      const reversed = await run(plan, async () => [zulu, alpha]);

      expect(forward.values).toEqual([{ label: "alpha-value" }]);
      expect(reversed.values).toEqual(forward.values);
      expect(forward.queryTelemetry[0]?.duplicateDrops).toBe(1);
      expect(reversed.queryTelemetry[0]?.duplicateDrops).toBe(1);
    });

    it("deduplicates and filters before applying the usable per-query cap", async () => {
      const find = findPlan({ resultsPerQuery: 3 });
      const duplicates = ["a", "b", "c"].map((suffix) => record({
        id: `duplicate-${suffix}`,
        title: `Duplicate rendering ${suffix}`,
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/001",
        issuer: "Orchid Council",
        treatmentAssignmentSignature: "timing=operative-start:2021-01-01",
        locator: `https://official.example/orchid/duplicate-${suffix}`,
      }));
      const unique = ["002", "003", "004"].map((serial) => record({
        id: `unique-${serial}`,
        title: `Unique instrument ${serial}`,
        jurisdiction: "Orchid Union",
        formalIdentifier: `OU 2020/${serial}`,
        issuer: "Orchid Council",
      }));
      const findResult = await run(find, async () => [
        ...unique,
        ...duplicates,
      ]);
      expect(findResult.records).toHaveLength(3);
      expect(findResult.records.map((item) => item.formalIdentifier)).toEqual([
        "OU 2020/001",
        "OU 2020/002",
        "OU 2020/003",
      ]);
      expect(findResult.queryTelemetry[0]).toMatchObject({
        recordsWithinBudget: 3,
        duplicateDrops: 2,
        overBudgetRecordsDropped: 1,
      });

      const audit = auditPlan({
        expandedStages: ["identity"],
        resultsPerQuery: 2,
      });
      const outOfScope = ["001", "002", "003"].map((serial) => record({
        id: `unrelated-${serial}`,
        title: `Unrelated instrument ${serial}`,
        jurisdiction: "Nevada",
        formalIdentifier: `AA 2020/${serial}`,
        issuer: "Unrelated Authority",
      }));
      const matching = ["first", "second"].map((suffix) => record({
        id: `ccpa-${suffix}`,
        title: `California Consumer Privacy Act ${suffix}`,
        jurisdiction: "California",
        issuer: "California Legislature",
      }));
      const auditResult = await run(audit, async (query) =>
        query.stage === "baseline" ? [] : [...outOfScope, ...matching]
      );
      expect(auditResult.records.map((item) => item.recordId)).toEqual([
        "ccpa-first",
        "ccpa-second",
      ]);
      expect(auditResult.queryTelemetry.find((item) => item.stage === "identity"))
        .toMatchObject({
          recordsWithinBudget: 2,
          identityFilterDrops: 3,
          overBudgetRecordsDropped: 0,
        });
    });

    it("canonicalizes CELEX aliases before the merged-record cap", async () => {
      const plan = findPlan({});
      const result = await run(plan, async () => [
        record({
          id: "celex-prefixed",
          title: "Digital content directive",
          jurisdiction: "EU",
          formalIdentifier: "CELEX: 32019L0770",
          locator: "https://eur-lex.example/celex-prefixed",
        }),
        record({
          id: "celex-lower",
          title: "Directive relative aux contenus numériques",
          jurisdiction: "EU",
          formalIdentifier: "32019l0770",
          locator: "https://eur-lex.example/celex-lower",
        }),
      ]);

      expect(result.records).toHaveLength(1);
      expect(result.queryTelemetry[0]?.duplicateDrops).toBe(1);
    });

    it("deduplicates repeated semantic events before preserving an expanded unique result", async () => {
      const plan = buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        industry: "Manufacturing",
        maximumExpandedQueries: 1,
        resultsPerQuery: 20,
        sources: [{
          sourceId: "official-register",
          role: "official",
          baselineQueries: ["first", "second", "third"].map((query) => ({
            query: `manufacturing regulation ${query}`,
          })),
          expandedStages: ["identity"],
        }],
      });
      const result = await run(plan, async (query) =>
        query.stage === "baseline"
          ? Array.from({ length: 20 }, (_, index) => record({
              id: `${query.id}-${index}`,
              title: "Sparse repeated event",
              jurisdiction: "Orchid Union",
              semanticEventKey: "stable-sparse-event",
            }))
          : [record({
              id: "expanded-unique",
              title: "Unique expanded event",
              jurisdiction: "Orchid Union",
              semanticEventKey: "stable-expanded-event",
            })]
      );

      expect(result.records.map((item) => item.recordId)).toEqual([
        expect.stringMatching(/baseline-01-0$/),
        "expanded-unique",
      ]);
      expect(result.queryTelemetry.reduce(
        (sum, item) => sum + item.duplicateDrops,
        0,
      )).toBe(59);
      expect(result.queryTelemetry.reduce(
        (sum, item) => sum + item.mergedCapDrops,
        0,
      )).toBe(0);
    });

    it("namespaces semantic event keys by official identity", async () => {
      const plan = findPlan({});
      const shared = {
        title: "Orchid Market Coverage Order",
        jurisdiction: "Orchid Union",
        issuer: "Orchid Council",
        semanticEventKey: "same-event-shape",
      } as const;
      const result = await run(plan, async () => [
        record({
          id: "orchid-order-12",
          formalIdentifier: "Order 12",
          ...shared,
        }),
        record({
          id: "orchid-order-99",
          formalIdentifier: "Order 99",
          ...shared,
        }),
      ]);

      expect(result.records.map((item) => item.recordId)).toEqual([
        "orchid-order-12",
        "orchid-order-99",
      ]);
      expect(result.queryTelemetry[0]?.duplicateDrops).toBe(0);
    });

    it("does not let a shared issue locator collapse distinct formal records", async () => {
      const plan = findPlan({});
      const result = await run(plan, async () => [
        record({
          id: "issue-order-1",
          title: "First issue order",
          jurisdiction: "Orchid Union",
          issuer: "Orchid Council",
          formalIdentifier: "OU 2020/1",
          locator: "https://gazette.example/issue/2020-04",
        }),
        record({
          id: "issue-order-2",
          title: "Second issue order",
          jurisdiction: "Orchid Union",
          issuer: "Orchid Council",
          formalIdentifier: "OU 2020/2",
          locator: "https://gazette.example/issue/2020-04",
        }),
      ]);

      expect(result.records).toHaveLength(2);
      expect(result.queryTelemetry[0]?.duplicateDrops).toBe(0);
    });

    it("isolates malformed provider rows without discarding valid siblings", async () => {
      const plan = findPlan({});
      const valid = record({ id: "valid-row", title: "Valid official row" });
      const result = await run(plan, async () => [
        null,
        { ...valid, identityAliases: ["valid", 42] },
        valid,
      ] as unknown as readonly Screen02SearchRecordInput<ResultValue>[]);

      expect(result.records.map((item) => item.recordId)).toEqual(["valid-row"]);
      expect(result.queryTelemetry[0]).toMatchObject({
        status: "searched",
        invalidRecordsDropped: 2,
      });
    });

    it("collapses totally sparse repeats before they can starve expansion", async () => {
      const plan = buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        industry: "Manufacturing",
        maximumExpandedQueries: 1,
        resultsPerQuery: 20,
        sources: [{
          sourceId: "official-register",
          role: "official",
          baselineQueries: ["first", "second", "third"].map((query) => ({
            query: `sparse baseline ${query}`,
          })),
          expandedStages: ["identity"],
        }],
      });
      const result = await run(plan, async (query) =>
        query.stage === "baseline"
          ? Array.from({ length: 20 }, (_, index) => record({
              id: `${query.id}-sparse-${index}`,
              title: "Unresolved repeated instrument",
            }))
          : [record({
              id: "expanded-distinct",
              title: "Expanded distinct instrument",
              formalIdentifier: "OU 2020/77",
              issuer: "Orchid Council",
              jurisdiction: "Orchid Union",
            })]
      );

      expect(result.records).toHaveLength(2);
      expect(result.records.some((item) =>
        item.recordId === "expanded-distinct"
      )).toBe(true);
      expect(result.queryTelemetry.reduce(
        (sum, item) => sum + item.duplicateDrops,
        0,
      )).toBe(59);
    });

    it("allocates an over-cap baseline fairly across official sources", async () => {
      const plan = buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        industry: "Manufacturing",
        maximumExpandedQueries: 4,
        resultsPerQuery: 8,
        sources: ["a", "b", "c"].map((suffix) => ({
          sourceId: `source-${suffix}`,
          role: "official" as const,
          baselineQueries: [1, 2, 3, 4].map((index) => ({
            query: `${suffix} baseline ${index}`,
          })),
          expandedStages: ["identity" as const],
        })),
      });
      const result = await run(plan, async (query) => Array.from(
        { length: query.resultLimit },
        (_, index) => record({
          id: `${query.id}-${index}`,
          title: `${query.id} result ${index}`,
          formalIdentifier: `${query.sourceId.toUpperCase()} ${index}/${query.id}`,
          issuer: `${query.sourceId} authority`,
          jurisdiction: "Orchid Union",
        }),
      ));
      const bySource = Object.fromEntries(["source-a", "source-b", "source-c"]
        .map((sourceId) => [
          sourceId,
          result.records.filter((item) => item.sourceId === sourceId).length,
        ]));

      expect(bySource).toEqual({
        "source-a": 20,
        "source-b": 20,
        "source-c": 20,
      });
    });

    it("uses issuer and assignment signature as deterministic cap tie-breakers", async () => {
      const plan = findPlan({ resultsPerQuery: 1 });
      const first = record({
        id: "shared-record",
        title: "Shared identity",
        jurisdiction: "Orchid Union",
        formalIdentifier: "OU 2020/88",
        issuer: "Alpha Authority",
        treatmentAssignmentSignature: "timing=phase:2021-01-01",
        locator: "https://official.example/orchid/shared",
      });
      const second = record({
        id: first.recordId,
        title: first.canonicalIdentity,
        jurisdiction: first.issuingJurisdiction,
        formalIdentifier: first.formalIdentifier,
        issuer: "Beta Authority",
        treatmentAssignmentSignature: "timing=phase:2022-01-01",
        locator: first.locator,
      });

      const forward = await run(plan, async () => [second, first]);
      const reversed = await run(plan, async () => [first, second]);
      expect(forward.records.map((item) => item.issuer)).toEqual([
        "Alpha Authority",
      ]);
      expect(reversed.records.map((item) => item.issuer)).toEqual([
        "Alpha Authority",
      ]);
    });

    it("falls back to the baseline when an expanded Find query faults", async () => {
      const plan = findPlan({ expandedStages: ["timing", "coverage"] });
      const baseline = record({
        id: "baseline-survives",
        title: "Baseline Rule",
      });

      const result = await run(plan, async (query) => {
        if (query.stage === "baseline") return [baseline];
        throw new Error("supplemental service unavailable");
      });

      expect(result.values).toEqual([baseline.value]);
      expect(result.comparison.expansionFaultFallbackUsed).toBe(true);
      expect(result.comparison.selection).toBe("baseline-only");
      expect(
        result.queryTelemetry.filter((item) => item.stage !== "baseline"),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            error: expect.stringContaining("supplemental service unavailable"),
          }),
        ]),
      );
    });
  });

  describe("Audit", () => {
    it("preserves the exact named-shock baseline when expansion is disabled", async () => {
      const plan = auditPlan({});
      const baseline = record({
        id: "ccpa-baseline",
        title: "California Consumer Privacy Act",
        formalIdentifier: "AB 375",
        jurisdiction: "California, United States",
      });

      const result = await run(plan, async () => [baseline]);

      expect(result.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
      ]);
      expect(result.comparison.baseline.uniqueRecordsSelected).toBe(1);
      expect(result.comparison.baselineRecordsPreserved).toBe(1);
      expect(result.comparison.selection).toBe("baseline-only");
    });

    it("recovers an exact identity from a zero-result Audit baseline", async () => {
      const plan = auditPlan({ expandedStages: ["identity"] });
      const recovered = record({
        id: "ccpa-expanded",
        title: "California Consumer Privacy Act of 2018",
        formalIdentifier: "AB 375",
        jurisdiction: "California, United States",
        directSupport: true,
      });

      const result = await run(plan, async (query) =>
        query.stage === "baseline" ? [] : [recovered],
      );

      expect(result.records.map((item) => item.recordId)).toEqual([
        recovered.recordId,
      ]);
      expect(result.comparison.zeroResultRecovered).toBe(true);
      expect(result.comparison.selection).toBe("expanded-recovery");
    });

    it("applies identity and jurisdiction guards before the baseline cap", async () => {
      const plan = auditPlan({ resultsPerQuery: 2 });
      const matching = ["first", "second"].map((suffix) => record({
        id: `ccpa-${suffix}`,
        title: `California Consumer Privacy Act ${suffix}`,
        formalIdentifier: "AB 375",
        issuer: "California Legislature",
        jurisdiction: "California, United States",
        treatmentAssignmentSignature:
          `timing=phase:${suffix === "first" ? "2020" : "2021"}-01-01`,
      }));
      const wrongIdentity = record({
        id: "unrelated-gdpr",
        title: "General Data Protection Regulation",
        formalIdentifier: "Regulation (EU) 2016/679",
        issuer: "European Parliament and Council",
        jurisdiction: "European Union",
      });
      const wrongJurisdiction = record({
        id: "ccpa-texas",
        title: "California Consumer Privacy Act",
        formalIdentifier: "AB 375",
        issuer: "California Legislature",
        jurisdiction: "Texas, United States",
      });

      const result = await run(plan, async () => [
        wrongIdentity,
        wrongJurisdiction,
        ...matching,
      ]);

      expect(result.records.map((item) => item.recordId)).toEqual([
        "ccpa-first",
        "ccpa-second",
      ]);
      expect(result.queryTelemetry[0]).toMatchObject({
        recordsWithinBudget: 2,
        recordsAccepted: 2,
        identityFilterDrops: 1,
        jurisdictionFilterDrops: 1,
        overBudgetRecordsDropped: 0,
      });
      expect(result.comparison.baseline.uniqueRecordsSelected).toBe(2);
      expect(result.comparison.baselineRecordsPreserved).toBe(2);
    });

    it("does not let a matching title hide a conflicting European namespace", async () => {
      const plan = buildScreen02AuditSearchResearchPlan({
        eventFamily: "Privacy regulation",
        identity: {
          canonicalName: "General Data Protection Regulation",
          aliases: ["GDPR"],
          formalIdentifier: "Regulation (EU) 2016/679",
          issuer: "European Parliament and Council",
          issuingJurisdiction: "European Union",
        },
        jurisdictionAliases: ["EU"],
        sources: [{
          sourceId: "eu-official",
          role: "official",
          baselineQueries: [{ query: "General Data Protection Regulation" }],
        }],
      });
      const wrongNamespace = record({
        id: "same-title-ec-coordinate",
        title: "General Data Protection Regulation",
        formalIdentifier: "Regulation (EC) 2016/679",
        issuer: "European Parliament and Council",
        jurisdiction: "European Union",
      });

      const result = await run(plan, async () => [wrongNamespace]);

      expect(result.records).toEqual([]);
      expect(result.queryTelemetry[0]).toMatchObject({
        identityFilterDrops: 1,
        recordsAccepted: 0,
      });
    });

    it("does not let a bare alias rescue a conflicting richer formal coordinate", async () => {
      const plan = buildScreen02AuditSearchResearchPlan({
        eventFamily: "Consumer regulation",
        identity: {
          canonicalName: "California Consumer Privacy Act",
          aliases: ["AB 375"],
          formalIdentifier: "AB 375, Chapter 55, Statutes of 2018",
          issuer: "California Legislature",
          issuingJurisdiction: "California, United States",
        },
        jurisdictionAliases: ["California"],
        sources: [{
          sourceId: "california-legislation",
          role: "official",
          baselineQueries: [{ query: "California Consumer Privacy Act" }],
        }],
      });
      const wrongChapter = record({
        id: "ccpa-wrong-chapter",
        title: "California Consumer Privacy Act",
        formalIdentifier: "AB 375, Chapter 56, Statutes of 2024",
        issuer: "California Legislature",
        jurisdiction: "California, United States",
      });

      const result = await run(plan, async () => [wrongChapter]);

      expect(result.records).toEqual([]);
      expect(result.queryTelemetry[0]).toMatchObject({
        identityFilterDrops: 1,
        recordsAccepted: 0,
      });
    });

    it("canonicalizes exact local identifier forms before Audit deduplication", async () => {
      const plan = buildScreen02AuditSearchResearchPlan({
        eventFamily: "Consumer regulation",
        identity: {
          canonicalName: "Orchid Consumer Rule",
          aliases: [],
          formalIdentifier: "Order No. 123",
          issuer: "Orchid Council",
          issuingJurisdiction: "Orchid Union",
        },
        jurisdictionAliases: ["Orchid Union"],
        sources: [{
          sourceId: "orchid-gazette",
          role: "official",
          baselineQueries: [{ query: "Orchid Consumer Rule" }],
        }],
      });
      const identifier = (
        id: string,
        title: string,
        formalIdentifier: string,
      ) => record({
        id,
        title,
        formalIdentifier,
        issuer: "Orchid Council",
        jurisdiction: "Orchid Union",
        treatmentAssignmentSignature: "timing=operative-start:2020-01-01",
      });
      const labeled = identifier(
        "orchid-order-labeled",
        "Official catalog entry",
        "Order No. 123",
      );
      const compact = identifier(
        "orchid-order-compact",
        "Gazette rendering",
        "Order 123",
      );

      const forward = await run(plan, async () => [labeled, compact]);
      const reversed = await run(plan, async () => [compact, labeled]);

      expect(forward.records).toHaveLength(1);
      expect(reversed.records.map((item) => item.recordId)).toEqual(
        forward.records.map((item) => item.recordId),
      );
      expect(forward.queryTelemetry[0]?.duplicateDrops).toBe(1);
      expect(reversed.queryTelemetry[0]?.duplicateDrops).toBe(1);
    });

    it("filters expanded identity and jurisdiction drift without regressing the Audit baseline", async () => {
      const plan = auditPlan({
        expandedStages: ["identity", "timing", "coverage"],
      });
      const baseline = record({
        id: "ccpa-official",
        title: "California Consumer Privacy Act",
        formalIdentifier: "AB 375",
        issuer: "California Legislature",
        jurisdiction: "California, United States",
      });
      const wrongIdentity = record({
        id: "gdpr",
        title: "General Data Protection Regulation",
        formalIdentifier: "Regulation (EU) 2016/679",
        jurisdiction: "European Union",
      });
      const wrongJurisdiction = record({
        id: "ccpa-texas",
        title: "California Consumer Privacy Act",
        formalIdentifier: "AB 375",
        jurisdiction: "Texas, United States",
      });
      const duplicate = record({
        id: "ccpa-second-query",
        title: "California Consumer Privacy Act of 2018",
        formalIdentifier: "AB 375",
        issuer: "California Legislature",
        jurisdiction: "California, United States",
      });

      const result = await run(plan, async (query) =>
        query.stage === "baseline"
          ? [baseline]
          : [wrongIdentity, wrongJurisdiction, duplicate],
      );

      expect(result.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
      ]);
      expect(result.comparison.baselineRecordsPreserved).toBe(1);
      expect(result.comparison.expanded.identityFilterDrops).toBeGreaterThan(0);
      expect(result.comparison.expanded.jurisdictionFilterDrops).toBeGreaterThan(0);
      expect(result.comparison.expanded.duplicateDrops).toBeGreaterThan(0);
      expect(result.comparison.selection).toBe("baseline-only");
    });

    it("contains Audit expansion faults and publishes bounded comparison telemetry", async () => {
      const plan = auditPlan({
        expandedStages: ["identity", "timing", "coverage", "implementation"],
      });
      const baseline = record({
        id: "ccpa-safe-fallback",
        title: "California Consumer Privacy Act",
        jurisdiction: "California, United States",
      });

      const result = await run(plan, async (query) => {
        if (query.stage === "baseline") return [baseline];
        throw new Error("expanded connector timeout");
      });

      expect(plan.budgets.expandedQueries).toBeLessThanOrEqual(
        SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumExpandedQueries,
      );
      expect(plan.budgets.totalQueries).toBeLessThanOrEqual(
        SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumTotalQueries,
      );
      expect(result.records.map((item) => item.recordId)).toEqual([
        baseline.recordId,
      ]);
      expect(result.comparison.expansionFaultFallbackUsed).toBe(true);
      expect(result.comparison.expanded.queriesFailed).toBe(
        plan.expanded.length,
      );
      expect(result.manifestSupplement.channels.at(-1)).toEqual(
        expect.objectContaining({
          channel: expect.stringContaining("baseline-versus-expanded"),
          note: expect.stringContaining("Baseline preserved: 1"),
        }),
      );
    });
  });

  it("rejects plans that exceed fixed query and result budgets", () => {
    expect(() =>
      buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        resultsPerQuery:
          SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumResultsPerQuery + 1,
        sources: [
          {
            sourceId: "official",
            role: "official",
            baselineQueries: [{ query: "regulation" }],
          },
        ],
      }),
    ).toThrow("resultsPerQuery");

    expect(() =>
      buildScreen02FindSearchResearchPlan({
        eventFamily: "Regulation",
        sources: [
          {
            sourceId: "official",
            role: "official",
            baselineQueries: Array.from(
              {
                length:
                  SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumBaselineQueries + 1,
              },
              (_, index) => ({ query: `regulation ${index}` }),
            ),
          },
        ],
      }),
    ).toThrow("unique baseline queries");
  });

  it("caps the shared two-round plan at 16 requests and 60 merged raw records", async () => {
    const plan = buildScreen02FindSearchResearchPlan({
      eventFamily: "Regulation",
      industry: "Manufacturing",
      maximumExpandedQueries: 16,
      resultsPerQuery: 20,
      sources: [
        {
          sourceId: "official-register",
          role: "official",
          baselineQueries: Array.from({ length: 12 }, (_, index) => ({
            query: `materially distinct regulation query ${index + 1}`,
          })),
          expandedStages: [
            "identity",
            "timing",
            "coverage",
            "implementation",
          ],
        },
      ],
    });

    expect(plan.baseline).toHaveLength(12);
    expect(plan.expanded).toHaveLength(4);
    expect(plan.budgets).toMatchObject({
      totalQueries: 16,
      maximumMergedRecords: 60,
      rawCandidateTarget: 40,
      qualifiedCandidateTarget: 10,
      maximumRounds: 2,
    });

    const result = await run(plan, async (query) =>
      Array.from({ length: query.resultLimit }, (_, index) => record({
        id: `${query.id}-${index}`,
        title: `${query.query} result ${index}`,
      }))
    );
    expect(result.records).toHaveLength(60);
    expect(
      result.queryTelemetry.reduce(
        (sum, item) => sum + item.mergedCapDrops,
        0,
      ),
    ).toBeGreaterThan(0);
    expect(
      result.manifestSupplement.channels.some((channel) =>
        channel.note.includes("raw maximum 60")
      ),
    ).toBe(true);
  });

  it("runs a bounded context-only Audit plan when no native issuer route exists", async () => {
    const plan = buildScreen02AuditSearchResearchPlan({
      eventFamily: "Regulation",
      identity: {
        canonicalName: "Unresolved Privacy Measure",
      },
      maximumExpandedQueries: 1,
      sources: [
        {
          sourceId: "host-context-search-v1",
          role: "context",
          baselineQueries: [],
          expandedStages: ["implementation"],
        },
      ],
    });

    expect(plan.baseline).toEqual([]);
    expect(plan.expanded).toHaveLength(1);
    const result = await run(plan, async () => [
      record({
        id: "context-only-lead",
        title: "Unresolved Privacy Measure",
        directSupport: false,
      }),
    ]);

    expect(result.records).toEqual([
      expect.objectContaining({
        recordId: "context-only-lead",
        disposition: "lead-only",
      }),
    ]);
    expect(result.comparison).toMatchObject({
      baselineRecordsPreserved: 0,
      expanded: { contextLeadCount: 1 },
      selectedRecords: 0,
    });
  });

  it("revalidates fixed budgets at execution even if a plan object is tampered with", async () => {
    const plan = findPlan({ expandedStages: ["timing"] });
    const unsafePlan = {
      ...plan,
      expanded: Array.from(
        {
          length:
            SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumExpandedQueries + 1,
        },
        (_, index) => ({
          ...plan.expanded[0]!,
          id: `tampered-${index}`,
        }),
      ),
      budgets: {
        ...plan.budgets,
        expandedQueries:
          SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumExpandedQueries + 1,
        totalQueries:
          SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumExpandedQueries + 2,
      },
    };

    await expect(
      executeScreen02SearchExpansion({
        plan: unsafePlan,
        retrievedAt,
        execute: async () => [],
      }),
    ).rejects.toThrow("fixed query budget");
  });
});
