import { describe, expect, it, vi } from "vitest";

import {
  SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION,
  SCREEN_02_TO_SCREEN_03_COMPATIBLE_PRODUCER_VERSIONS,
  buildScreen02ToScreen03Handoff,
  deriveScreen03VerificationTasks,
  fingerprintScreen02ToScreen03Handoff,
  restoreScreen02ToScreen03Handoff,
  serializeScreen02ToScreen03Handoff,
} from "../../src/core/screen02-screen03-handoff";
import { restoreScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import {
  applyScreen02PreliminaryAssessmentRound,
  applyScreen02SearchRound,
  createScreen02Session,
  lockScreen02Choice,
  selectScreen02Item,
  serializeDeterministicJson,
  serializeScreen01StudyContext,
} from "../../src/core/screen02-service";
import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import {
  decisionKeys,
  type Screen01StudyContext,
} from "../../src/core/scope-types";
import type {
  Screen02AuditProposal,
  Screen02FindProposal,
  Screen02Source,
} from "../../src/core/screen02-types";
import {
  SCREEN_03_HANDOFF_CONTEXT_SCHEMA_VERSION,
  ShockAuditBridge,
  assertScreen02ModelContextFits,
  buildScreen02ModelContextUpdate,
  buildScreen03HandoffContext,
  screen03HandoffContextMatchesSession,
} from "../../src/ui/mcp-bridge";

function testFingerprintValue(value: unknown) {
  const serialized = serializeDeterministicJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function resignTestHandoff(value: Record<string, unknown>) {
  const integrity = value.integrity as Record<string, unknown>;
  const { handoffFingerprint: _handoffFingerprint, ...withoutHandoff } =
    integrity;
  integrity.handoffFingerprint = testFingerprintValue({
    ...value,
    integrity: withoutHandoff,
  });
}

function confirmedFindContext(): Screen01StudyContext {
  const initial = createInitialState("find");
  const result = confirmScopeContract({
    ...initial,
    revision: 4,
    scope: {
      ...initial.scope,
      population: "U.S. exchange-listed manufacturing firms",
      assignmentLevel: "Firm",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: ["population", "assignmentLevel", "outcomeFrequency"],
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

function confirmedAuditContext(): Screen01StudyContext {
  const initial = createInitialState("audit");
  const sentence =
    "Audit whether the California Consumer Privacy Act changed weekly innovation among U.S. exchange-listed technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";
  const result = confirmScopeContract({
    ...initial,
    revision: 7,
    sentence,
    contractSourceSentence: sentence,
    knownShock: "California Consumer Privacy Act",
    scope: {
      population: "U.S. exchange-listed technology firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Weekly",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

function officialSource(id: string): Screen02Source {
  return {
    id,
    title: `Official source ${id}`,
    locator: `https://www.sec.gov/rules/final/2019/${id}`,
    publisher: "U.S. Securities and Exchange Commission",
    publishedDate: "2019-07-01",
    authorityTier: 1,
    channel: "official-primary-rule",
    retrievedAt: "2026-08-08T18:00:00Z",
  };
}

function findProposal(): Screen02FindProposal {
  const source = officialSource("handoff-source");
  return {
    id: "handoff-event",
    mode: "find",
    kind: "event",
    title: "Manufacturing Compliance Rule",
    description:
      "A source-backed regulation retained for the Screen 3 handoff test.",
    origin: "newly-discovered",
    provisionalDates: ["2019-07-01"],
    affectedPopulation: "U.S. exchange-listed manufacturing firms",
    requiredVariables: ["Firm assignment", "Operative date"],
    outcomeLink: {
      text:
        "An AI-generated hypothesis links compliance exposure to profitability.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: [
      "Screen 3 must verify the operative rule, date, and organization-level coverage.",
    ],
    reasons: ["The official record supports a bounded regulatory lead."],
    event: {
      displayName: "Manufacturing Compliance Rule",
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. exchange-listed manufacturing firms"],
    },
    sources: [source],
    assessments: {
      externalShockPlausibility: {
        category: "plausible",
        reason:
          "The official record describes an externally imposed rule, while causal validity remains for verification.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      populationApplicability: {
        category: "documented-conditional",
        sourceEstablishedPopulation: {
          text: "Manufacturing firms satisfying the rule's statutory coverage criteria",
          evidenceSourceIds: [source.id],
        },
        reason:
          "The Manufacturing Compliance Rule documents conditional coverage based on firm-level statutory criteria.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
        unresolved: [
          "Verify which manufacturing firms satisfy the rule's coverage criteria and exemptions.",
        ],
      },
      exposureObservability: {
        category: "observable-with-linkage",
        reason: "The rule appears linkable to covered firms.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      timeSupport: {
        category: "adequate",
        reason: "The source provides a date inside the study period.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      variation: {
        category: "usable",
        reason: "The coverage rule implies a possible comparison.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
    },
  };
}

function lockedFindSession() {
  const baseline = confirmedFindContext();
  const opened = createScreen02Session(baseline, "handoff-run");
  const selectedProposal = findProposal();
  const comparisonSource = officialSource("comparison-handoff-source");
  const comparisonProposal: Screen02FindProposal = {
    ...JSON.parse(JSON.stringify(selectedProposal)),
    id: "comparison-handoff-event",
    title: "Manufacturing Export Notice",
    description:
      "A distinct candidate retained in history but not selected for Screen 3.",
    event: {
      ...selectedProposal.event,
      displayName: "Manufacturing Export Notice",
      populations: ["Manufacturing exporters"],
    },
    affectedPopulation: "Manufacturing exporters",
    sources: [comparisonSource],
    assessments: {
      externalShockPlausibility: {
        ...selectedProposal.assessments!.externalShockPlausibility!,
        evidenceSourceIds: [comparisonSource.id],
      },
      populationApplicability: {
        category: "plausible-indirect",
        sourceEstablishedPopulation: {
          text: "Manufacturing exporters named in the official notice",
          evidenceSourceIds: [comparisonSource.id],
        },
        reason:
          "The Manufacturing Export Notice may reach the study population indirectly through exporter relationships.",
        evidenceSourceIds: [comparisonSource.id],
        method: "ai-rubric",
        unresolved: [
          "Establish which focal firms participate in the relevant exporter relationships.",
        ],
      },
      exposureObservability: {
        ...selectedProposal.assessments!.exposureObservability!,
        evidenceSourceIds: [comparisonSource.id],
      },
      timeSupport: {
        ...selectedProposal.assessments!.timeSupport!,
        evidenceSourceIds: [comparisonSource.id],
      },
      variation: {
        ...selectedProposal.assessments!.variation!,
        evidenceSourceIds: [comparisonSource.id],
      },
    },
  };
  const searched = applyScreen02SearchRound(opened, {
    expectedRevision: opened.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest: "Find a source-backed regulation for handoff testing.",
    retrievedAt: "2026-08-08T18:00:00Z",
    proposals: [selectedProposal, comparisonProposal],
  });
  return {
    baseline,
    session: lockScreen02Choice(
      selectScreen02Item(searched, "handoff-event"),
    ),
  };
}

function lockedPreliminarilyAssessedFindSession() {
  const baseline = confirmedFindContext();
  const opened = createScreen02Session(
    baseline,
    "preliminary-handoff-run",
  );
  const proposal = findProposal();
  const native = applyScreen02SearchRound(opened, {
    expectedRevision: opened.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest: "Find a source-backed regulation for preliminary review.",
    retrievedAt: "2026-08-09T12:00:00Z",
    proposals: [proposal],
  });
  const rootNativeRound = native.interaction.searchRounds.at(-1)!;
  const assessed = applyScreen02PreliminaryAssessmentRound(native, {
    expectedRevision: native.revision,
    exactRequest: "Add a concise source-grounded preliminary assessment.",
    retrievedAt: "2026-08-09T12:01:00Z",
    rootNativeRoundId: rootNativeRound.id,
    assessmentParentRoundId: rootNativeRound.id,
    assessments: [
      {
        itemId: proposal.id,
        judgment: "worth-exploring",
        studyFit:
          "The Manufacturing Compliance Rule matches the confirmed regulation, manufacturing-firm population, geography, and study period.",
        affectedPopulation:
          "Manufacturing firms satisfying the rule's statutory coverage criteria",
        outcomeMechanism:
          "The Manufacturing Compliance Rule may redirect compliance spending and thereby influence Profitability.",
        mainConcern:
          "The Manufacturing Compliance Rule source does not yet establish the operative date and firm-level statutory coverage precisely.",
        evidenceSourceIds: ["handoff-source"],
        nextChecks: [
          "Verify the operative compliance date in the Manufacturing Compliance Rule.",
          "Map the Manufacturing Compliance Rule coverage criteria to each focal firm.",
        ],
      },
    ],
  });
  return {
    baseline,
    rootNativeRound,
    session: lockScreen02Choice(
      selectScreen02Item(assessed, proposal.id),
    ),
  };
}

function oversizedLockedFindSession() {
  const sourcePadding = "s".repeat(1_980);
  const sources: Screen02Source[] = Array.from(
    { length: 50 },
    (_, index) => ({
      id: `large-source-${String(index).padStart(2, "0")}`,
      title: `${String(index).padStart(2, "0")}${"T".repeat(1_998)}`,
      locator: `https://example.com/${index}/${sourcePadding}`,
      publisher: "P".repeat(500),
      publishedDate: "2019-07-01",
      authorityTier: 1,
      channel: "C".repeat(500),
      retrievedAt: "2026-08-08T18:00:00Z",
    }),
  );
  const proposal: Screen02FindProposal = {
    ...findProposal(),
    description: "D".repeat(2_000),
    provisionalDates: Array.from(
      { length: 30 },
      (_, index) => `${index}-${"d".repeat(496)}`,
    ),
    affectedPopulation: "U.S. exchange-listed manufacturing firms",
    requiredVariables: Array.from(
      { length: 30 },
      (_, index) => `${index}-${"v".repeat(496)}`,
    ),
    outcomeLink: {
      text: "O".repeat(2_000),
      status: "system-template",
    },
    limitations: Array.from(
      { length: 30 },
      (_, index) => `${index}-${"l".repeat(1_996)}`,
    ),
    reasons: Array.from(
      { length: 30 },
      (_, index) => `${index}-${"r".repeat(1_996)}`,
    ),
    event: {
      displayName: "Manufacturing Compliance Rule",
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. exchange-listed manufacturing firms"],
    },
    sources,
    assessments: undefined,
  };
  const opened = createScreen02Session(
    confirmedFindContext(),
    "oversized-context-run",
  );
  const searched = applyScreen02SearchRound(opened, {
    expectedRevision: opened.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest: "Exercise the model-context capacity boundary.",
    retrievedAt: "2026-08-08T18:00:00Z",
    proposals: [proposal],
  });
  return lockScreen02Choice(
    selectScreen02Item(searched, proposal.id),
  );
}

function auditRepresentationProposal(): Screen02AuditProposal {
  const source = officialSource("legacy-audit-source");
  return {
    id: "legacy-audit-representation",
    mode: "audit",
    kind: "representation",
    representationType: "formal-eligibility",
    title: "CCPA formal eligibility",
    description: "The current legacy Audit representation shape.",
    candidateConstruct: "California Consumer Privacy Act formal eligibility",
    operationalization: "An indicator for statutory coverage.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Firms covered by the statutory criteria",
    requiredVariables: ["Coverage criteria", "Effective date"],
    outcomeLink: {
      text: "An AI-generated hypothesis links CCPA coverage to innovation.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: ["The event identity must be confirmed in the redesigned Screen 2."],
    reasons: ["The source supports a provisional representation."],
    sources: [source],
  };
}

function auditCompatibilityProposal(
  title = "California Consumer Privacy Act",
): Screen02AuditProposal {
  const source = officialSource("audit-identity-source");
  return {
    id: "audit-ccpa-event-match",
    mode: "audit",
    kind: "representation",
    representationType: "whole-package",
    title,
    description:
      "A source-backed compatibility card for the exact known-shock event.",
    candidateConstruct:
      "California Consumer Privacy Act: resolved event identity",
    operationalization:
      "Confirm the California Consumer Privacy Act identity before constructing exposure in Screen 3.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Firms covered by the statutory criteria",
    requiredVariables: ["Coverage criteria", "Operative date"],
    outcomeLink: {
      text: "An AI-generated hypothesis links CCPA coverage to innovation.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Issuing jurisdiction and controlling dates remain for verification.",
    ],
    reasons: ["The source supports the exact known-shock identity."],
    sources: [source],
  };
}

function lockedAuditCompatibilitySession(
  title = "California Consumer Privacy Act",
) {
  const baseline = confirmedAuditContext();
  const opened = createScreen02Session(baseline, "audit-handoff-run");
  const proposal = auditCompatibilityProposal(title);
  const searched = applyScreen02SearchRound(opened, {
    expectedRevision: opened.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest: "Locate the exact known shock and its official record.",
    retrievedAt: "2026-08-08T18:00:00Z",
    proposals: [proposal],
    shockEvidence: {
      status: "shock-level-reconnaissance",
      anchorShock: baseline.knownShock,
      matchMethod: "exact-name-or-controlled-alias",
      proposalIds: [proposal.id],
      candidateNames: [proposal.title],
      sources: proposal.sources,
      provisionalDates: proposal.provisionalDates,
      affectedPopulations: [proposal.affectedPopulation],
      note:
        "The official record supports identity only; rules and exposure remain for Screen 3.",
    },
  });
  return lockScreen02Choice(
    selectScreen02Item(searched, proposal.id),
  );
}

describe("canonical Screen 2 to Screen 3 handoff", () => {
  it("carries the exact Screen 1 baseline, one locked event, sources, methods, open work, and append-only history", () => {
    const { baseline, session } = lockedFindSession();
    const handoff = buildScreen02ToScreen03Handoff(session);

    expect(handoff.schemaVersion).toBe(
      SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION,
    );
    expect(handoff.destinationScreen).toBe("screen-03");
    expect(handoff.mode).toBe("find");
    expect(serializeScreen01StudyContext(handoff.screen01Baseline)).toBe(
      serializeScreen01StudyContext(baseline),
    );
    expect(handoff.lockedEvent).toMatchObject({
      id: "handoff-event",
      kind: "event",
      event: { displayName: "Manufacturing Compliance Rule" },
      sourceSummary: { uniqueSourceCount: 1 },
      populationApplicability: {
        category: "documented-conditional",
        evidenceSourceIds: ["handoff-source"],
        sourceEstablishedPopulation: {
          text: "Manufacturing firms satisfying the rule's statutory coverage criteria",
          evidenceSourceIds: ["handoff-source"],
        },
        reason:
          "The Manufacturing Compliance Rule documents conditional coverage based on firm-level statutory criteria.",
      },
    });
    expect(handoff.lock.itemVersionId).toMatch(/^item-version-/);
    expect(handoff.lock.selectedRoundId).toBe("round-001");
    expect(handoff.sourceProvenance).toEqual([
      expect.objectContaining({
        sourceId: "handoff-source",
        introducedByRoundId: "round-001",
        roles: expect.arrayContaining([
          "event-record-lead",
          "assessment-support",
          "population-coverage",
        ]),
      }),
    ]);
    expect(handoff.methodRecord.scorecard.formulaVersion).toBe(
      session.items[0]?.scorecard.formulaVersion,
    );
    expect(handoff.methodRecord.populationApplicability).toMatchObject({
      category: "documented-conditional",
      evidenceSourceIds: ["handoff-source"],
      sourceEstablishedPopulation: {
        text: "Manufacturing firms satisfying the rule's statutory coverage criteria",
        evidenceSourceIds: ["handoff-source"],
      },
    });
    expect(handoff.lockedEvent.event.populations).toEqual([
      "U.S. exchange-listed manufacturing firms",
    ]);
    expect(handoff.lockedEvent.event.populations).not.toEqual([
      "Manufacturing firms satisfying the rule's statutory coverage criteria",
    ]);
    expect(handoff.unresolved.verificationTasks).toContainEqual(
      expect.objectContaining({
        category: "coverage",
        prompt:
          "Verify the cited eligibility or implementation conditions defining the source-described population (Manufacturing firms satisfying the rule's statutory coverage criteria) and identify which focal organizations satisfy them.",
        reason: expect.stringContaining(
          "The cited sources describe the candidate population as: Manufacturing firms satisfying the rule's statutory coverage criteria.",
        ),
        evidenceSourceIds: ["handoff-source"],
        status: "open",
      }),
    );
    const lockedAssessmentPayload = JSON.stringify({
      lockedEvent: handoff.lockedEvent,
      methodRecord: handoff.methodRecord,
      unresolved: handoff.unresolved,
    });
    expect(lockedAssessmentPayload).not.toContain(
      "Manufacturing Export Notice may reach",
    );
    expect(lockedAssessmentPayload).not.toContain(
      "comparison-handoff-source",
    );
    expect(handoff.unresolved.verificationTasks).toContainEqual(
      expect.objectContaining({
        category: "limitation",
        status: "open",
      }),
    );
    expect(handoff.history.searchRounds).toHaveLength(2);
    expect(handoff.history.selectionHistory.map((event) => event.action)).toEqual([
      "selected",
      "locked",
    ]);
    expect(handoff.outcomeValuesInspected).toBe(false);
    expect(Object.isFrozen(handoff)).toBe(true);
    expect(Object.isFrozen(handoff.screen01Baseline)).toBe(true);
  });

  it("round-trips deterministically and rejects changed event content", () => {
    const { session } = lockedFindSession();
    const handoff = buildScreen02ToScreen03Handoff(session);
    const serialized = serializeScreen02ToScreen03Handoff(handoff);
    const restored = restoreScreen02ToScreen03Handoff(JSON.parse(serialized));

    expect(restored).not.toBeNull();
    expect(serializeScreen02ToScreen03Handoff(restored)).toBe(serialized);
    expect(fingerprintScreen02ToScreen03Handoff(restored)).toBe(
      fingerprintScreen02ToScreen03Handoff(handoff),
    );

    const tampered = JSON.parse(JSON.stringify(handoff));
    tampered.lockedEvent.title = "Substituted event";
    expect(restoreScreen02ToScreen03Handoff(tampered)).toBeNull();
  });

  it("preserves and validates a compact preliminary assessment without changing the v1 handoff", () => {
    const { session, rootNativeRound } =
      lockedPreliminarilyAssessedFindSession();
    const handoff = buildScreen02ToScreen03Handoff(session);

    expect(handoff.schemaVersion).toBe("screen-02-to-screen-03-v1");
    expect(handoff.producerAppVersion).toBe("0.2.20");
    expect(handoff.lockedEvent.preliminaryAssessment).toMatchObject({
      schemaVersion: "screen02-preliminary-assessment-v1",
      method: "ai-preliminary",
      judgment: "worth-exploring",
      evidenceSourceIds: ["handoff-source"],
      rootNativeRoundId: rootNativeRound.id,
    });
    expect(handoff.methodRecord.preliminaryAssessment).toStrictEqual(
      handoff.lockedEvent.preliminaryAssessment,
    );
    expect(handoff.sourceProvenance).toContainEqual(
      expect.objectContaining({
        sourceId: "handoff-source",
        roles: expect.arrayContaining([
          "event-record-lead",
          "assessment-support",
        ]),
      }),
    );
    for (const nextCheck of
      handoff.lockedEvent.preliminaryAssessment!.nextChecks) {
      expect(handoff.unresolved.verificationTasks).toContainEqual(
        expect.objectContaining({
          category: "assignment",
          prompt: nextCheck,
          reason: expect.stringContaining(
            "does not yet establish the operative date and firm-level statutory coverage precisely",
          ),
          evidenceSourceIds: ["handoff-source"],
          status: "open",
        }),
      );
    }

    const serialized = serializeScreen02ToScreen03Handoff(handoff);
    expect(
      restoreScreen02ToScreen03Handoff(JSON.parse(serialized)),
    ).not.toBeNull();

    const wrongRoot = JSON.parse(serialized) as Record<string, unknown>;
    const lockedEvent = wrongRoot.lockedEvent as Record<string, unknown>;
    const methodRecord = wrongRoot.methodRecord as Record<string, unknown>;
    const changedAssessment = {
      ...(lockedEvent.preliminaryAssessment as Record<string, unknown>),
      rootNativeRoundId: "missing-native-round",
    };
    lockedEvent.preliminaryAssessment = changedAssessment;
    methodRecord.preliminaryAssessment = changedAssessment;
    resignTestHandoff(wrongRoot);
    expect(restoreScreen02ToScreen03Handoff(wrongRoot)).toBeNull();
  });

  it("derives open verification work from the compact preliminary assessment", () => {
    const { session } = lockedFindSession();
    const handoff = buildScreen02ToScreen03Handoff(session);
    const rootNativeRound = session.interaction.searchRounds.find(
      (round) => round.stage === "native-retrieval",
    );
    if (!rootNativeRound) {
      throw new Error("Expected a native round for preliminary assessment.");
    }
    const item = {
      ...JSON.parse(JSON.stringify(handoff.lockedEvent)),
      preliminaryAssessment: {
        schemaVersion: "screen02-preliminary-assessment-v1" as const,
        method: "ai-preliminary" as const,
        judgment: "worth-exploring" as const,
        studyFit:
          "The documented rule falls inside the confirmed industry, geography, and study period.",
        affectedPopulation:
          "Manufacturing firms satisfying the rule's statutory criteria",
        outcomeMechanism:
          "Compliance investment may redirect product-development resources and change profitability.",
        mainConcern:
          "The operative date and firm-level statutory coverage remain provisional.",
        evidenceSourceIds: ["handoff-source"],
        nextChecks: [
          "Verify the operative compliance date in the controlling rule.",
          "Map the statutory coverage criteria to each focal firm.",
        ],
        rootNativeRoundId: rootNativeRound.id,
        assessedAtRevision: session.revision,
      },
    };

    const tasks = deriveScreen03VerificationTasks(session, item);

    for (const nextCheck of item.preliminaryAssessment.nextChecks) {
      expect(tasks).toContainEqual(
        expect.objectContaining({
          category: "assignment",
          prompt: nextCheck,
          reason:
            "The preliminary assessment identified this main concern: The operative date and firm-level statutory coverage remain provisional.",
          evidenceSourceIds: ["handoff-source"],
          status: "open",
        }),
      );
    }
  });

  it("carries an explicitly unestablished population into coverage work without rewriting native event populations", () => {
    const baseline = confirmedFindContext();
    const opened = createScreen02Session(baseline, "unknown-population-run");
    const proposal = findProposal();
    proposal.assessments = {
      ...proposal.assessments,
      populationApplicability: {
        category: "unknown",
        sourceEstablishedPopulation: null,
        reason:
          "The Manufacturing Compliance Rule source identifies the rule but does not delimit the organizations subject to its statutory criteria.",
        evidenceSourceIds: [],
        method: "ai-rubric",
        unresolved: [
          "Locate the Manufacturing Compliance Rule coverage provision and identify the organizations it includes and exempts.",
        ],
      },
    };
    const searched = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Retain a candidate whose covered population is unresolved.",
      retrievedAt: "2026-08-08T18:00:00Z",
      proposals: [proposal],
    });
    const session = lockScreen02Choice(
      selectScreen02Item(searched, proposal.id),
    );

    const handoff = buildScreen02ToScreen03Handoff(session);

    expect(
      handoff.lockedEvent.populationApplicability
        ?.sourceEstablishedPopulation,
    ).toBeNull();
    expect(handoff.lockedEvent.event.populations).toEqual(
      proposal.event.populations,
    );
    expect(handoff.unresolved.verificationTasks).toContainEqual(
      expect.objectContaining({
        category: "coverage",
        prompt:
          "Locate a controlling source passage that identifies or delimits the candidate-specific affected population, then relate it to the locked study population before defining treatment.",
        reason: expect.stringContaining(
          "The current cited sources do not establish a candidate-specific affected population.",
        ),
        evidenceSourceIds: [],
      }),
    );
    expect(handoff.sourceProvenance[0]?.roles).not.toContain(
      "population-coverage",
    );
  });

  it("restores only the explicitly compatible 0.2.17 through 0.2.20 producers", () => {
    expect(SCREEN_02_TO_SCREEN_03_COMPATIBLE_PRODUCER_VERSIONS).toEqual([
      "0.2.17",
      "0.2.18",
      "0.2.19",
      "0.2.20",
    ]);
    const { session } = lockedFindSession();
    const current = JSON.parse(
      JSON.stringify(buildScreen02ToScreen03Handoff(session)),
    ) as Record<string, unknown>;

    for (const producerAppVersion of ["0.2.17", "0.2.18", "0.2.19"]) {
      const previous = JSON.parse(JSON.stringify(current)) as Record<
        string,
        unknown
      >;
      previous.producerAppVersion = producerAppVersion;
      resignTestHandoff(previous);
      expect(restoreScreen02ToScreen03Handoff(previous)).not.toBeNull();
    }

    const unsupported = JSON.parse(JSON.stringify(current)) as Record<
      string,
      unknown
    >;
    unsupported.producerAppVersion = "0.2.16";
    resignTestHandoff(unsupported);
    expect(restoreScreen02ToScreen03Handoff(unsupported)).toBeNull();
  });

  it("normalizes a tied whole-package Audit compatibility card into the same locked-event contract as Find", () => {
    const findSession = lockedFindSession().session;
    const auditSession = lockedAuditCompatibilitySession();
    const find = buildScreen02ToScreen03Handoff(findSession);
    const audit = buildScreen02ToScreen03Handoff(auditSession);

    expect(Object.keys(audit).sort()).toEqual(Object.keys(find).sort());
    expect(Object.keys(audit.lockedEvent).sort()).toEqual(
      Object.keys(find.lockedEvent).sort(),
    );
    expect(Object.keys(audit.lockedEvent.event).sort()).toEqual(
      Object.keys(find.lockedEvent.event).sort(),
    );
    expect(audit.lockedEvent).toMatchObject({
      id: "audit-ccpa-event-match",
      mode: "audit",
      kind: "event",
      event: {
        displayName: "California Consumer Privacy Act",
        eventDate: "2020-01-01",
        eventFamily: "Regulation",
        geographies: [],
        populations: ["Firms covered by the statutory criteria"],
        researcherAnchor: "California Consumer Privacy Act",
        matchMethod: "exact-name",
        identityEvidenceSourceIds: ["audit-identity-source"],
      },
    });
    expect(audit.history.itemVersions.at(-1)?.item).toMatchObject({
      mode: "audit",
      kind: "representation",
      representationType: "whole-package",
    });
    expect(audit.sourceProvenance[0]?.roles).toContain("event-identity");
    expect(restoreScreen02ToScreen03Handoff(JSON.parse(
      serializeScreen02ToScreen03Handoff(audit),
    ))).not.toBeNull();

    const alias = buildScreen02ToScreen03Handoff(
      lockedAuditCompatibilitySession("CCPA"),
    );
    expect(alias.lockedEvent.event).toMatchObject({
      displayName: "CCPA",
      researcherAnchor: "California Consumer Privacy Act",
      matchMethod: "controlled-alias",
    });

    const findContext = buildScreen03HandoffContext(find);
    const auditContext = buildScreen03HandoffContext(audit);
    expect(findContext.schemaVersion).toBe(
      SCREEN_03_HANDOFF_CONTEXT_SCHEMA_VERSION,
    );
    expect(findContext.fullHandoffSchemaVersion).toBe(
      SCREEN_02_TO_SCREEN_03_HANDOFF_SCHEMA_VERSION,
    );
    expect(Object.keys(auditContext).sort()).toEqual(
      Object.keys(findContext).sort(),
    );
    expect(Object.keys(auditContext.lockedEvent).sort()).toEqual(
      Object.keys(findContext.lockedEvent).sort(),
    );
    expect(Object.keys(auditContext.methodRecord).sort()).toEqual(
      Object.keys(findContext.methodRecord).sort(),
    );
    expect(Object.keys(auditContext.unresolved).sort()).toEqual(
      Object.keys(findContext.unresolved).sort(),
    );
    expect(Object.keys(auditContext.historySummary).sort()).toEqual(
      Object.keys(findContext.historySummary).sort(),
    );
    expect(
      screen03HandoffContextMatchesSession(auditContext, auditSession),
    ).toBe(true);

    const delivered = buildScreen02ModelContextUpdate(
      { text: {}, structuredContent: {} },
      "unused",
      auditSession,
    );
    expect(delivered?.structuredContent?.screen03Handoff).toStrictEqual(
      auditContext,
    );
    expect(delivered?.structuredContent).not.toHaveProperty(
      "reviewContext",
    );
  });

  it("rejects a whole-package Audit card when its round evidence has no overlapping identity source", () => {
    const baseline = confirmedAuditContext();
    const opened = createScreen02Session(baseline, "untied-audit-run");
    const proposal = auditCompatibilityProposal();
    const searched = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Record an intentionally untied Audit identity lead.",
      retrievedAt: "2026-08-08T18:00:00Z",
      proposals: [proposal],
      shockEvidence: {
        status: "shock-level-reconnaissance",
        anchorShock: baseline.knownShock,
        matchMethod: "exact-name-or-controlled-alias",
        proposalIds: [proposal.id],
        candidateNames: [proposal.title],
        sources: [officialSource("different-identity-source")],
        provisionalDates: proposal.provisionalDates,
        affectedPopulations: [proposal.affectedPopulation],
        note: "This deliberately does not identify the selected item source.",
      },
    });
    const locked = lockScreen02Choice(
      selectScreen02Item(searched, proposal.id),
    );

    expect(() => buildScreen02ToScreen03Handoff(locked)).toThrow(
      "not tied to exact round-level identity evidence",
    );
  });

  it("requires an explicit lock", () => {
    const opened = createScreen02Session(confirmedFindContext());
    expect(() => buildScreen02ToScreen03Handoff(opened)).toThrow(
      "explicit locked choice",
    );
  });

  it("rejects the current legacy Audit representation shape until Audit emits the common event record", () => {
    const opened = createScreen02Session(confirmedAuditContext());
    const searched = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "user-source",
      exactRequest: "Attach a source to the current Audit representation.",
      retrievedAt: "2026-08-08T18:00:00Z",
      proposals: [auditRepresentationProposal()],
    });
    const locked = lockScreen02Choice(
      selectScreen02Item(searched, "legacy-audit-representation"),
    );

    expect(() => buildScreen02ToScreen03Handoff(locked)).toThrow(
      "Legacy Audit representation items must be resolved to a source-backed event",
    );

    const context = buildScreen02ModelContextUpdate(
      { text: {}, structuredContent: {} },
      "unused",
      locked,
    );
    expect(context?.structuredContent).not.toHaveProperty(
      "screen03Handoff",
    );
    expect(context?.content?.[0]?.text).toContain(
      "Screen 3 handoff: not ready",
    );
    expect(
      restoreScreen02StateEnvelope(
        context?.structuredContent?.sessionState,
      ),
    ).toStrictEqual(locked);
  });

  it(
    "rejects an over-limit compact context before lock success and catches the same failure during background sync",
    async () => {
      const locked = oversizedLockedFindSession();
      expect(() => buildScreen02ToScreen03Handoff(locked)).not.toThrow();
      expect(() => assertScreen02ModelContextFits(locked)).toThrow(
        "Screen 2 task context exceeds",
      );

      const updateModelContext = vi.fn(async () => undefined);
      const warning = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const bridge = new ShockAuditBridge();
      (
        bridge as unknown as {
          app: {
            getHostCapabilities: () => {
              updateModelContext: { structuredContent: object };
            };
            updateModelContext: typeof updateModelContext;
          };
        }
      ).app = {
        getHostCapabilities: () => ({
          updateModelContext: { structuredContent: {} },
        }),
        updateModelContext,
      };

      await expect(
        bridge.updateScreen02ModelContext("unused", locked),
      ).resolves.toBeUndefined();
      expect(updateModelContext).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith(
        "ShockAudit Screen 2 context could not be shared with the host.",
        expect.any(Error),
      );
      warning.mockRestore();
    },
    15_000,
  );
});
