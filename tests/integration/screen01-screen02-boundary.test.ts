import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmScopeContract } from "../../src/core/screen01-service";
import { screen02ContextMarkdown } from "../../src/core/screen02-context-markdown";
import {
  applyScreen02SearchRound,
  createScreen02Session,
  fingerprintScreen01StudyContext,
  fingerprintScreen02Session,
  lockScreen02Choice,
  rejectScreen02Item,
  restoreScreen02Session,
  selectScreen02Item,
  serializeScreen01StudyContext,
  serializeScreen02Session,
} from "../../src/core/screen02-service";
import { restoreScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import {
  decisionKeys,
  fieldKeys,
  type Mode,
  type ScopeContract,
  type Screen01StudyContext,
  type Screen01WidgetSnapshot,
} from "../../src/core/scope-types";
import {
  screen02ScoreComponentKeys,
  type Screen02AuditProposal,
  type Screen02FindProposal,
  type Screen02Session,
} from "../../src/core/screen02-types";
import {
  SCREEN_02_MAX_MODEL_CONTEXT_CHARACTERS,
  buildScreen02ModelContextUpdate,
  screen03HandoffContextMatchesSession,
  ShockAuditBridge,
} from "../../src/ui/mcp-bridge";

const RELEASED_SCREEN_01_VERSION = "0.1.1";
const KNOWN_SHOCK = "California Consumer Privacy Act";

afterEach(() => {
  vi.unstubAllGlobals();
});

function confirmedScreen01Context(mode: Mode): Screen01StudyContext {
  const sentence =
    mode === "find"
      ? "Find a regulatory shock affecting annual profitability among U.S. exchange-listed manufacturing firms with firm-level assignment and firm-level analysis from 2014 to 2022."
      : "Audit whether the California Consumer Privacy Act affected annual profitability among U.S. exchange-listed technology firms with firm-level assignment and firm-level analysis from 2017 to 2023.";
  const scope: ScopeContract =
    mode === "find"
      ? {
          population: "U.S. exchange-listed manufacturing firms",
          assignmentLevel: "Firm",
          analysisLevel: "Firm",
          geography: "United States",
          industry: "Manufacturing",
          studyPeriod: "2014–2022",
          eventFamily: "Regulation",
          outcomeFamily: "Profitability",
          outcomeFrequency: "Annual",
        }
      : {
          population: "U.S. exchange-listed technology firms",
          assignmentLevel: "Firm",
          analysisLevel: "Firm",
          geography: "United States",
          industry: "Technology",
          studyPeriod: "2017–2023",
          eventFamily: "Regulation",
          outcomeFamily: "Profitability",
          outcomeFrequency: "Annual",
        };
  const confirmation = confirmScopeContract({
    revision: mode === "find" ? 11 : 12,
    mode,
    sentence,
    contractSourceSentence: sentence,
    scope,
    knownShock: mode === "audit" ? KNOWN_SHOCK : "",
    resolvedKeys:
      mode === "audit" ? [...decisionKeys] : [...fieldKeys],
    scopeDirty: false,
  });
  if (!confirmation.ok) {
    throw new Error(`Test context did not confirm: ${confirmation.error}`);
  }
  return {
    ...buildScreen01StudyContext(
      confirmation.state,
      confirmation.ambiguities,
    ),
    appVersion: RELEASED_SCREEN_01_VERSION,
  };
}

function expectDeeplyFrozen(
  value: unknown,
  seen = new WeakSet<object>(),
) {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    expectDeeplyFrozen(nested, seen);
  }
}

function sourceBackedFindProposal(): Screen02FindProposal {
  return {
    id: "find-source-backed-boundary-candidate",
    mode: "find",
    kind: "event",
    title: "Source-backed regulatory candidate",
    description:
      "A deterministic source-backed plant compliance threshold directive for the immutable-boundary test. The cited directive covers manufacturing firms operating covered plants and imposes monitoring-system compliance duties.",
    origin: "newly-discovered",
    provisionalDates: ["2019-07-01"],
    affectedPopulation:
      "U.S. exchange-listed manufacturing firms",
    requiredVariables: [
      "Firm exposure",
      "Regulatory effective date",
    ],
    outcomeLink: {
      text:
        "The immutable-boundary plant compliance threshold directive could change firm monitoring costs and Profitability, subject to later causal verification.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: [
      "The exact assignment rule still requires passage verification.",
    ],
    reasons: [
      "The immutable-boundary candidate remains because its plant compliance threshold directive is dated inside the locked manufacturing regulation scope and has a traceable source record.",
    ],
    event: {
      displayName: "Source-backed regulatory candidate",
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: [
        "U.S. exchange-listed manufacturing firms",
      ],
    },
    sources: [
      {
        id: "boundary-official-source",
        title: "Official regulatory record",
        locator:
          "https://example.test/official-regulatory-record",
        publisher: "Official regulator",
        publishedDate: "2019-07-01",
        authorityTier: 1,
        channel: "official-primary",
      },
    ],
    assessments: {
      externalShockPlausibility: {
        category: "plausible",
        evidenceSourceIds: ["boundary-official-source"],
        reason:
          "The immutable-boundary regulatory candidate appears as an agency-imposed plant reporting mandate, while manufacturer influence on its drafting remains unverified.",
      },
      populationApplicability: {
        category: "documented-direct",
        evidenceSourceIds: ["boundary-official-source"],
        sourceEstablishedPopulation: {
          text: "Manufacturing firms operating covered plants",
          evidenceSourceIds: ["boundary-official-source"],
        },
        reason:
          "The immutable-boundary fixture documents direct coverage of the manufacturing-firm study population.",
      },
      outcomePathway: {
        category: "source-anchored-specific",
        evidenceSourceIds: ["boundary-official-source"],
        reason:
          "The immutable-boundary plant compliance threshold directive supplies a source-anchored Profitability pathway through monitoring systems and recurring facility compliance costs.",
      },
      exposureObservability: {
        category: "observable-with-linkage",
        evidenceSourceIds: ["boundary-official-source"],
        reason:
          "The immutable-boundary record defines plant permit identifiers that can be cross-walked to manufacturing parents for exposure measurement.",
      },
      timeSupport: {
        category: "adequate",
        evidenceSourceIds: ["boundary-official-source"],
        reason:
          "The immutable-boundary record separates its 2019-07-01 compliance start from the earlier publication date.",
      },
      variation: {
        category: "usable",
        evidenceSourceIds: ["boundary-official-source"],
        reason:
          "The immutable-boundary candidate applies a facility-capacity cutoff that can create cross-firm assignment differences.",
      },
    },
  };
}

function priorFindProposal(): Screen02FindProposal {
  const proposal = sourceBackedFindProposal();
  return {
    ...proposal,
    id: "find-prior-boundary-candidate",
    title: "2016 plant emissions reporting rule",
    description:
      "A distinct earlier source-backed candidate retained only in the reproducibility ledger after a later search. The cited rule covers manufacturing firms operating covered emissions plants and imposes pollutant-volume filing duties.",
    provisionalDates: ["2016-04-01"],
    outcomeLink: {
      text:
        "The 2016-04-01 plant emissions reporting rule could change monitoring investment and Profitability through pollutant-volume filing duties.",
      status: "ai-hypothesis",
    },
    event: {
      ...proposal.event,
      displayName: "2016 Plant Emissions Reporting Rule",
      eventDate: "2016-04-01",
    },
    sources: [
      {
        ...proposal.sources[0]!,
        id: "boundary-prior-official-source",
        title: "Official 2016 plant emissions rule",
        locator:
          "https://example.test/official-2016-plant-emissions-rule",
        publishedDate: "2016-04-01",
      },
    ],
    reasons: [
      "The 2016 plant emissions candidate remains because its pollutant-volume filing duties predate the later option and fit the locked manufacturing regulation scope.",
    ],
    assessments: {
      externalShockPlausibility: {
        ...proposal.assessments!.externalShockPlausibility!,
        reason:
          "The 2016 plant emissions rule was issued by an environmental regulator after a pollution-monitoring review; firm anticipation still needs checking.",
        evidenceSourceIds: ["boundary-prior-official-source"],
      },
      populationApplicability: {
        ...proposal.assessments!.populationApplicability!,
        reason:
          "The plant emissions source documents direct coverage of the manufacturing-firm study population.",
        evidenceSourceIds: ["boundary-prior-official-source"],
        sourceEstablishedPopulation: {
          text: "Manufacturing firms operating covered emissions plants",
          evidenceSourceIds: ["boundary-prior-official-source"],
        },
      },
      outcomePathway: {
        category: "source-anchored-specific",
        reason:
          "The 2016 plant emissions rule supplies a Profitability pathway through monitoring equipment investment and pollutant-volume filing operations.",
        evidenceSourceIds: ["boundary-prior-official-source"],
      },
      exposureObservability: {
        ...proposal.assessments!.exposureObservability!,
        reason:
          "The plant emissions rule assigns facility registry numbers that can be linked to public manufacturing parents.",
        evidenceSourceIds: ["boundary-prior-official-source"],
      },
      timeSupport: {
        ...proposal.assessments!.timeSupport!,
        reason:
          "The 2016 plant emissions record dates the first mandatory monitoring quarter separately from publication.",
        evidenceSourceIds: ["boundary-prior-official-source"],
      },
      variation: {
        ...proposal.assessments!.variation!,
        reason:
          "The plant emissions rule differentiates covered facilities by pollutant volume and installation class.",
        evidenceSourceIds: ["boundary-prior-official-source"],
      },
    },
  };
}

function selectableFindSession(
  context: Screen01StudyContext,
): Screen02Session {
  const initial = createScreen02Session(context);
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "refine",
    exactRequest:
      "Require an official source and prefer a clearly bounded regulatory event.",
    retrievedAt: "2026-07-29T13:00:00Z",
    proposals: [sourceBackedFindProposal()],
    criteria: [
      {
        id: "require-official-source",
        kind: "require",
        text: "official source",
        source: "ai-interpretation",
        exactRequest:
          "Require an official source and prefer a clearly bounded regulatory event.",
      },
      {
        id: "prefer-bounded-event",
        kind: "prefer",
        text: "bounded regulatory event",
        source: "ai-interpretation",
        exactRequest:
          "Require an official source and prefer a clearly bounded regulatory event.",
      },
    ],
    interpretationSource: "ai-interpretation",
  });
}

function sourceBackedAuditProposal(): Screen02AuditProposal {
  return {
    id: "audit-source-backed-boundary-match",
    mode: "audit",
    kind: "representation",
    representationType: "whole-package",
    title: "California Consumer Privacy Act",
    description:
      "A source-backed event-identity match for the exact Audit anchor.",
    candidateConstruct:
      "California Consumer Privacy Act resolved event identity",
    operationalization:
      "Confirm authority, operative dates, coverage, and passages in Screen 3 before constructing an empirical representation.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation:
      "U.S. exchange-listed technology firms potentially covered by the statute",
    requiredVariables: ["Statutory coverage", "Operative date"],
    outcomeLink: {
      text:
        "An outcome-blind hypothesis links the regulation to profitability.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: [
      "Screen 3 must verify the event record and any empirical representation.",
    ],
    reasons: ["An official source supports the provisional event identity."],
    sources: [
      {
        id: "audit-boundary-official-source",
        title: "California Consumer Privacy Act official text",
        locator:
          "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml",
        publisher: "California Legislative Information",
        publishedDate: "2018-06-28",
        authorityTier: 1,
        channel: "official-primary",
      },
    ],
  };
}

function selectableAuditSession(
  context: Screen01StudyContext,
): Screen02Session {
  const initial = createScreen02Session(context);
  const proposal = sourceBackedAuditProposal();
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest: "Resolve the exact known shock to an official event record.",
    retrievedAt: "2026-08-08T18:00:00Z",
    proposals: [proposal],
    shockEvidence: {
      status: "shock-level-reconnaissance",
      anchorShock: KNOWN_SHOCK,
      matchMethod: "exact-name-or-controlled-alias",
      proposalIds: [proposal.id],
      candidateNames: [proposal.title],
      sources: proposal.sources,
      provisionalDates: proposal.provisionalDates,
      affectedPopulations: [proposal.affectedPopulation],
      note:
        "The official record supports provisional event-identity resolution; Screen 3 must verify it.",
    },
  });
}

function screen01SnapshotFromContext(
  context: Screen01StudyContext,
): Screen01WidgetSnapshot {
  const state = {
    revision: context.revision,
    mode: context.startingPoint,
    sentence: context.studySentence,
    contractSourceSentence: context.contractSourceSentence,
    scope: { ...context.scopeContract },
    knownShock: context.knownShock,
    resolvedKeys: [...context.resolvedKeys],
    scopeDirty: context.scopeDirty,
    confirmed: context.confirmed,
  };
  return {
    state,
    draftsByMode: { [context.startingPoint]: state },
    ambiguities: context.unresolvedDecisions.map((ambiguity) => ({
      ...ambiguity,
      choices: ambiguity.choices?.map((choice) => ({ ...choice })),
    })),
    studyContext: context,
  };
}

function exactJsonFromMarkdown(
  markdown: string,
  label: string,
): string {
  const prefix = `- ${label}: `;
  const line = markdown
    .split("\n")
    .find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    throw new Error(`Missing exact JSON handoff line: ${label}.`);
  }
  const encodedJsonString = line.slice(prefix.length);
  const exactJson = JSON.parse(encodedJsonString);
  if (typeof exactJson !== "string") {
    throw new Error(`${label} did not contain an encoded JSON string.`);
  }
  return exactJson;
}

describe("immutable Screen 1 to Screen 2 boundary", () => {
  it("preserves a user-defined Chinese public-firm scope while matching equivalent Screen 2 wording", () => {
    const sentence =
      "Find a regulatory shock affecting annual profitability among Chinese public firms with firm-level assignment and firm-level analysis across all industries from 2014 to 2022.";
    const confirmation = confirmScopeContract({
      revision: 21,
      mode: "find",
      sentence,
      contractSourceSentence: sentence,
      scope: {
        population: "Chinese public firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "China",
        industry: "All industries",
        studyPeriod: "2014–2022",
        eventFamily: "Regulation",
        outcomeFamily: "Profitability",
        outcomeFrequency: "Annual",
      },
      knownShock: "",
      resolvedKeys: [...fieldKeys],
      scopeDirty: false,
    });
    if (!confirmation.ok) {
      throw new Error(`Non-U.S. context did not confirm: ${confirmation.error}`);
    }
    const context = buildScreen01StudyContext(
      confirmation.state,
      confirmation.ambiguities,
    );
    const exactBaseline = serializeScreen01StudyContext(context);
    const proposal: Screen02FindProposal = {
      id: "china-public-firm-candidate",
      mode: "find",
      kind: "event",
      title: "China public-company regulation",
      description:
        "The final regulation requires Chinese public companies to change documented reporting practices beginning in 2019.",
      nativeIdentity: {
        formalIdentifier: "China Regulation 2019-07",
        issuer: "Official regulator",
        issuingJurisdiction: "China",
        status: "Final regulation",
      },
      origin: "newly-discovered",
      provisionalDates: ["2019-07-01"],
      affectedPopulation: "Chinese public companies",
      requiredVariables: ["Firm exposure", "Effective date"],
      outcomeLink: {
        text: "An AI hypothesis links exposure to profitability.",
        status: "ai-hypothesis",
      },
      likelyServiceLevel: "assisted-audit",
      limitations: ["The exact rule still requires passage verification."],
      reasons: ["The candidate uses an equivalent population description."],
      event: {
        displayName: "China public-company regulation",
        eventDate: "2019-07-01",
        eventFamily: "Regulation",
        geographies: ["China"],
        populations: ["Chinese public companies"],
      },
      sources: [
        {
          id: "china-official-source",
          title: "Official regulatory record",
          locator: "https://example.test/china-regulation",
          publisher: "Official regulator",
          publishedDate: "2019-07-01",
          authorityTier: 1,
          channel: "official-primary",
          evidenceText:
            "China public-company regulation, China Regulation 2019-07, applies in China and requires Chinese public companies to change documented reporting practices. The regulation became effective on 2019-07-01.",
        },
      ],
      assessments: {
        exposureObservability: {
          category: "observable-with-linkage",
          reason:
            "The official record defines a linkable firm-level exposure.",
        },
        timeSupport: {
          category: "adequate",
          reason:
            "The official record identifies a bounded effective date.",
        },
        variation: {
          category: "usable",
          reason:
            "The official record supports cross-firm assignment variation.",
        },
      },
    };

    const initial = createScreen02Session(context);
    const searched = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest:
        "Find a source-backed candidate for Chinese public firms.",
      retrievedAt: "2026-07-30T18:00:00Z",
      proposals: [proposal],
    });
    const candidate = searched.items.find(
      (item) => item.id === proposal.id,
    );
    expect(candidate).toBeDefined();
    expect(
      candidate?.hardFilters.every((filter) => filter.status === "pass"),
    ).toBe(true);
    const locked = lockScreen02Choice(
      selectScreen02Item(searched, proposal.id),
    );
    const lockedJson = serializeScreen02Session(locked);
    const restored = restoreScreen02Session(JSON.parse(lockedJson));

    expect(restored).not.toBeNull();
    expect(serializeScreen02Session(restored!)).toBe(lockedJson);
    expect(restored?.selectedItemId).toBe(proposal.id);
    expect(restored?.lockedChoice?.itemId).toBe(proposal.id);
    expect(restored?.screen01Fingerprint).toBe(
      fingerprintScreen01StudyContext(context),
    );
    expect(restored?.screen01Baseline.scopeContract).toMatchObject({
      population: "Chinese public firms",
      geography: "China",
    });
    expect(
      serializeScreen01StudyContext(restored!.screen01Baseline),
    ).toBe(exactBaseline);
    const structured = buildScreen02ModelContextUpdate(
      { structuredContent: {} },
      "The structured context must preserve the exact baseline.",
      restored!,
    );
    const contextSession = restoreScreen02StateEnvelope(
      structured!.structuredContent!.sessionState,
    );
    expect(contextSession).not.toBeNull();
    expect(
      serializeScreen01StudyContext(contextSession!.screen01Baseline),
    ).toBe(exactBaseline);
  });

  it.each([
    "0.2.0",
    "0.2.1",
    "0.2.2",
    "0.2.3",
    "0.2.4",
    "0.2.5",
    "0.2.6",
    "0.2.7",
    "0.2.8",
    "0.2.9",
    "0.2.10",
    "0.2.11",
    "0.2.12",
    "0.2.13",
    "0.2.14",
    "0.2.15",
    "0.2.16",
    "0.2.17",
    "0.2.18",
    "0.2.19",
    "0.2.20",
    "0.2.21",
    "0.2.22",
    "0.2.23",
  ])(
    "preserves a v%s baseline through Screen 2 and ChatGPT context without rewriting provenance",
    (producerVersion) => {
      const inbound = {
        ...confirmedScreen01Context("find"),
        appVersion: producerVersion,
      };
      const exactBaseline = serializeScreen01StudyContext(inbound);
      const created = createScreen02Session(inbound);
      const restored = restoreScreen02Session(
        JSON.parse(serializeScreen02Session(created)),
      );

      expect(restored).not.toBeNull();
      expect(
        serializeScreen01StudyContext(restored!.screen01Baseline),
      ).toBe(exactBaseline);
      expect(restored!.screen01Baseline.appVersion).toBe(producerVersion);

      const structured = buildScreen02ModelContextUpdate(
        { structuredContent: {} },
        "The structured baseline must remain authoritative.",
        restored!,
      );
      const contextSession = restoreScreen02StateEnvelope(
        structured?.structuredContent?.sessionState,
      );
      expect(contextSession?.screen01Baseline).toStrictEqual(inbound);
      expect(
        serializeScreen01StudyContext(
          contextSession!.screen01Baseline,
        ),
      ).toBe(exactBaseline);
    },
  );

  it.each(["find", "audit"] as const)(
    "preserves the exact %s baseline through creation, selection, serialization, and restoration",
    (mode) => {
      const inbound = confirmedScreen01Context(mode);
      const inboundJson = JSON.parse(
        JSON.stringify(inbound),
      ) as Screen01StudyContext;
      const inboundCanonical = serializeScreen01StudyContext(inbound);
      const session =
        mode === "find"
          ? selectableFindSession(inbound)
          : selectableAuditSession(inbound);

      expect(session.screen01Baseline).toStrictEqual(inboundJson);
      expect(session.screen01Baseline).not.toBe(inbound);
      expect(
        serializeScreen01StudyContext(session.screen01Baseline),
      ).toBe(inboundCanonical);
      expect(session.screen01Baseline.appVersion).toBe(
        RELEASED_SCREEN_01_VERSION,
      );
      expect(session.screen01Fingerprint).toBe(
        fingerprintScreen01StudyContext(inbound),
      );
      expectDeeplyFrozen(session);
      expectDeeplyFrozen(session.screen01Baseline);
      expect(session.items.length).toBeGreaterThan(0);

      expect(() => {
        (
          session.screen01Baseline.scopeContract as {
            population: string;
          }
        ).population = "Mutated population";
      }).toThrow(TypeError);

      const selectedId = session.items[0].id;
      const selected = selectScreen02Item(session, selectedId);
      expect(selected.selectedItemId).toBe(selectedId);
      expect(
        serializeScreen01StudyContext(selected.screen01Baseline),
      ).toBe(inboundCanonical);
      expect(selected.screen01Fingerprint).toBe(
        session.screen01Fingerprint,
      );

      const serializedSession = serializeScreen02Session(selected);
      const serializedFingerprint =
        fingerprintScreen02Session(selected);
      const restored = restoreScreen02Session(
        JSON.parse(serializedSession),
      );

      expect(restored).not.toBeNull();
      expect(serializeScreen02Session(restored!)).toBe(
        serializedSession,
      );
      expect(fingerprintScreen02Session(restored!)).toBe(
        serializedFingerprint,
      );
      expect(restored!.selectedItemId).toBe(selectedId);
      expect(restored!.screen01Baseline).toStrictEqual(inboundJson);
      expect(
        serializeScreen01StudyContext(restored!.screen01Baseline),
      ).toBe(inboundCanonical);
      expect(restored!.screen01Baseline.appVersion).toBe(
        RELEASED_SCREEN_01_VERSION,
      );
      expectDeeplyFrozen(restored);
      expectDeeplyFrozen(restored!.screen01Baseline);
    },
  );

  it("preserves full interaction history and one explicit lock exactly through widget restoration, both model-context forms, and the later-screen handoff", async () => {
    const inbound = confirmedScreen01Context("find");
    const assessed = selectableFindSession(inbound);
    const priorSearch = applyScreen02SearchRound(assessed, {
      expectedRevision: assessed.revision,
      requestType: "find-more",
      exactRequest:
        "Review one distinct earlier event before returning to the preferred candidate.",
      retrievedAt: "2026-07-29T13:00:30Z",
      proposals: [priorFindProposal()],
      interpretationSource: "ai-interpretation",
    });
    const priorOption = priorSearch.items.find(
      (item) => item.id === "find-prior-boundary-candidate",
    );
    if (!priorOption) {
      throw new Error("The earlier candidate was not retained.");
    }
    const rejected = rejectScreen02Item(
      priorSearch,
      priorOption.id,
      "The researcher prefers the newly sourced bounded event.",
    );
    const refreshed = applyScreen02SearchRound(rejected, {
      expectedRevision: rejected.revision,
      requestType: "find-more",
      exactRequest:
        "Check one more pass before I lock the source-backed option.",
      retrievedAt: "2026-07-29T13:01:00Z",
      proposals: [sourceBackedFindProposal()],
      interpretationSource: "ai-interpretation",
    });
    const selected = selectScreen02Item(
      refreshed,
      "find-source-backed-boundary-candidate",
    );
    const locked = lockScreen02Choice(selected);
    const baselineJson = serializeScreen01StudyContext(inbound);
    const lockedSessionJson = serializeScreen02Session(locked);
    const screen01Snapshot = screen01SnapshotFromContext(inbound);
    const screen01SnapshotJson = JSON.stringify(screen01Snapshot);
    let savedWidgetState: Record<string, unknown> | undefined;

    vi.stubGlobal("window", {
      openai: {
        widgetState: { screen01: screen01Snapshot },
        setWidgetState: async (value: Record<string, unknown>) => {
          savedWidgetState = value;
        },
      },
    });

    await new ShockAuditBridge().saveScreen02State(locked);

    expect(savedWidgetState).toBeDefined();
    const savedPrivateState = savedWidgetState?.privateContent as
      | Record<string, unknown>
      | undefined;
    expect(JSON.stringify(savedPrivateState?.screen01)).toBe(
      screen01SnapshotJson,
    );
    expect(
      restoreScreen02StateEnvelope(
        (savedPrivateState?.screen02 as { sessionState?: unknown })
          ?.sessionState,
      ),
    ).toMatchObject({
      runId: locked.runId,
      revision: locked.revision,
      lockedChoice: locked.lockedChoice,
    });
    expect(
      JSON.stringify(savedPrivateState?.screen02).length,
    ).toBeLessThan(
      lockedSessionJson.length,
    );

    vi.stubGlobal("window", {
      openai: { widgetState: savedWidgetState },
    });
    const restored =
      new ShockAuditBridge().getInitialScreen02Session();
    if (!restored) {
      throw new Error("Selected Screen 2 session did not restore.");
    }

    expect(serializeScreen02Session(restored)).toBe(
      lockedSessionJson,
    );
    expect(
      serializeScreen01StudyContext(restored.screen01Baseline),
    ).toBe(baselineJson);
    expect(restored.selectedItemId).toBe(locked.selectedItemId);
    expect(restored.lockedChoice).toStrictEqual(locked.lockedChoice);
    expect(restored.interaction).toStrictEqual(locked.interaction);
    expect(restored.interaction.searchRounds).toHaveLength(4);
    expect(restored.interaction.preferences.criteria).toHaveLength(2);
    expect(restored.interaction.rejections).toEqual([
      expect.objectContaining({ itemId: priorOption.id }),
    ]);

    const markdown = screen02ContextMarkdown(restored);
    const textOnly = buildScreen02ModelContextUpdate(
      { text: {} },
      markdown,
      restored,
    );

    expect(textOnly?.structuredContent).toBeUndefined();
    const textContext = JSON.parse(
      textOnly!.content![0]!.text,
    ) as { screen?: string; sessionState?: unknown };
    expect(textContext.screen).toBe("screen-02");
    const textSession = restoreScreen02StateEnvelope(
      textContext.sessionState,
    );
    expect(serializeScreen02Session(textSession!)).toBe(
      lockedSessionJson,
    );
    expect(textOnly!.content![0]!.text.length).toBeLessThan(
      lockedSessionJson.length,
    );

    const structuredOnly = buildScreen02ModelContextUpdate(
      { structuredContent: {} },
      "This fallback must not replace structured data.",
      restored,
    );
    if (!structuredOnly?.structuredContent) {
      throw new Error(
        "Structured Screen 2 model context was not created.",
      );
    }
    const laterScreenContext = structuredOnly.structuredContent;

    expect(structuredOnly.content).toBeUndefined();
    expect(laterScreenContext.screen).toBe("screen-02");
    expect(laterScreenContext).not.toHaveProperty("screen02Output");
    expect(laterScreenContext).not.toHaveProperty(
      "screen01StudyContext",
    );
    expect(laterScreenContext.screen03Handoff).toMatchObject({
      schemaVersion: "screen-03-handoff-context-v1",
      fullHandoffSchemaVersion: "screen-02-to-screen-03-v1",
      sourceScreen: "screen-02",
      destinationScreen: "screen-03",
      runId: locked.runId,
      revision: locked.revision,
      mode: "find",
      screen01Fingerprint: locked.screen01Fingerprint,
      lock: {
        itemId: locked.lockedChoice?.itemId,
        itemFingerprint: locked.lockedChoice?.itemFingerprint,
      },
      lockedEvent: {
        id: locked.lockedChoice?.itemId,
        mode: "find",
        kind: "event",
      },
      outcomeValuesInspected: false,
      historySummary: {
        fullHistoryLocation: "sessionState",
      },
    });
    expect(
      laterScreenContext.screen03Handoff?.screen01Baseline,
    ).toStrictEqual(locked.screen01Baseline);
    expect(
      laterScreenContext.screen03Handoff?.unresolved.verificationTasks.length,
    ).toBeGreaterThan(0);
    expect(laterScreenContext).not.toHaveProperty("reviewContext");
    expect(
      screen03HandoffContextMatchesSession(
        laterScreenContext.screen03Handoff,
        restored,
      ),
    ).toBe(true);
    expect(JSON.stringify(laterScreenContext).length).toBeLessThanOrEqual(
      SCREEN_02_MAX_MODEL_CONTEXT_CHARACTERS,
    );
    const laterScreenSession = restoreScreen02StateEnvelope(
      laterScreenContext.sessionState,
    );
    if (!laterScreenSession) {
      throw new Error(
        "Separated later-screen context did not reconstruct a valid session.",
      );
    }
    expect(serializeScreen02Session(laterScreenSession)).toBe(
      lockedSessionJson,
    );
    expect(
      serializeScreen01StudyContext(
        laterScreenSession.screen01Baseline,
      ),
    ).toBe(baselineJson);
    expect(laterScreenSession.lockedChoice).toStrictEqual(
      locked.lockedChoice,
    );
    expect(laterScreenSession.interaction).toStrictEqual(
      locked.interaction,
    );
  });

  it("keeps Find discovery distinct from source-backed resolution of the exact Audit anchor", () => {
    const blankFind = createScreen02Session(
      confirmedScreen01Context("find"),
    );
    const find = selectableFindSession(
      confirmedScreen01Context("find"),
    );
    const auditBaseline = confirmedScreen01Context("audit");
    const blankAudit = createScreen02Session(auditBaseline);
    const audit = selectableAuditSession(auditBaseline);

    expect(find.mode).toBe("find");
    expect(find.screen01Baseline.knownShock).toBe("");
    expect(blankFind.items).toEqual([]);
    expect(blankFind.selectedItemId).toBeNull();
    expect(find.items.length).toBeGreaterThan(0);
    expect(
      find.items.every(
        (item) => item.mode === "find" && item.kind === "event",
      ),
    ).toBe(true);

    expect(audit.mode).toBe("audit");
    expect(audit.screen01Baseline.knownShock).toBe(KNOWN_SHOCK);
    expect(blankAudit.items).toEqual([]);
    expect(audit.items.length).toBeGreaterThan(0);
    for (const item of audit.items) {
      expect(item.mode).toBe("audit");
      expect(item.kind).toBe("representation");
      if (item.mode === "audit") {
        expect(item.representationType).toBe("whole-package");
        expect(item.anchorShock).toBe(KNOWN_SHOCK);
        expect(item.anchorShock).toBe(auditBaseline.knownShock);
        expect(item.sourceSummary.uniqueSourceCount).toBeGreaterThan(0);
        expect(item.operationalization).toContain("Screen 3");
      }
    }
  });

  it("uses identical metric keys in both branches and preserves unknown as null rather than zero", () => {
    const findItem = selectableFindSession(
      confirmedScreen01Context("find"),
    ).items[0];
    const auditItem = selectableAuditSession(
      confirmedScreen01Context("audit"),
    ).items[0];

    for (const item of [findItem, auditItem]) {
      expect(Object.keys(item.scorecard.components).sort()).toEqual(
        [...screen02ScoreComponentKeys].sort(),
      );
      expect(Object.keys(item.scorecard.componentReasons).sort()).toEqual(
        [...screen02ScoreComponentKeys].sort(),
      );
    }
    const unknownKeys = screen02ScoreComponentKeys.filter(
      (key) => auditItem.scorecard.components[key] === null,
    );
    expect(unknownKeys.length).toBeGreaterThan(0);
    for (const key of unknownKeys) {
      expect(auditItem.scorecard.components[key]).toBeNull();
      expect(auditItem.scorecard.components[key]).not.toBe(0);
      expect(auditItem.scorecard.componentReasons[key]).toContain(
        "Unknown",
      );
    }
    expect(auditItem.scorecard.overall).toBeNull();
    expect(auditItem.scorecard.overall).not.toBe(0);
  });
});
