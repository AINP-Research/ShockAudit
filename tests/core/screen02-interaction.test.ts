import { describe, expect, it } from "vitest";

import {
  SCREEN_02_MAX_PREFERENCE_CRITERIA,
  SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS,
  SCREEN_02_MAX_SEARCH_ROUNDS,
  applyScreen02SearchRound,
  beginScreen02InteractionRequest,
  clearScreen02InteractionRequest,
  createScreen02Session,
  lockScreen02Choice,
  markScreen02InteractionRequestAwaitingResponse,
  rejectScreen02Item,
  restartScreen02Session,
  restoreScreen02Session,
  selectScreen02Item,
  serializeDeterministicJson,
  serializeScreen01StudyContext,
  unmetRequiredCriteriaIdsForScreen02Item,
  unlockScreen02Choice,
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
  Screen02PreferenceCriterion,
  Screen02Session,
  Screen02Source,
} from "../../src/core/screen02-types";

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
    resolvedKeys: [
      "population",
      "assignmentLevel",
      "outcomeFrequency",
    ],
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
    channel: "official-primary",
    retrievedAt: "2026-07-29T12:00:00Z",
  };
}

const interactionAssessmentProfiles = [
  {
    feature: "facility emissions-intensity disclosure threshold",
    population: "plants exceeding a documented emissions threshold",
    external:
      "the environmental agency initiated a mandatory emissions disclosure after a public rulemaking",
    exposure:
      "facility emissions filings can be joined to plant-owning firms",
    timing:
      "the first mandatory reporting year follows a dated compliance deadline",
    variation:
      "threshold crossings distinguish covered plants from lower-emitting facilities",
    mechanism:
      "monitoring investment and pollution-control capital allocation",
  },
  {
    feature: "machine-safety certification requirement",
    population: "manufacturers placing certified industrial machinery on the market",
    external:
      "the product-safety authority imposed certification following accident investigations",
    exposure:
      "certification registers identify machine models and their manufacturers",
    timing:
      "model certification applies from a published market-entry date",
    variation:
      "covered machine classes differ from exempt replacement parts",
    mechanism:
      "product redesign, testing expense, and launch delays",
  },
  {
    feature: "federal procurement accessibility clause",
    population: "suppliers bidding on covered federal technology contracts",
    external:
      "the procurement office added accessibility terms to federal solicitations",
    exposure:
      "award and solicitation records can link accessibility clauses to suppliers",
    timing:
      "the clause starts with a specified procurement-cycle date",
    variation:
      "federal contractors face the clause while commercial-only suppliers may not",
    mechanism:
      "accessible-product engineering and bidding costs",
  },
  {
    feature: "cybersecurity incident notification mandate",
    population: "operators of designated critical manufacturing systems",
    external:
      "the security agency issued mandatory incident reporting after statutory authorization",
    exposure:
      "designated-operator lists and notification filings can identify covered firms",
    timing:
      "a statutory notification clock begins on the operative mandate date",
    variation:
      "critical-system designations create coverage differences across manufacturers",
    mechanism:
      "security staffing, downtime management, and disclosure risk",
  },
  {
    feature: "industrial motor energy-efficiency standard",
    population: "producers of motor classes listed in the efficiency schedule",
    external:
      "the energy department set minimum efficiency levels through standards rulemaking",
    exposure:
      "model test reports can connect regulated motors to producers",
    timing:
      "the standard applies by motor model year after a transition period",
    variation:
      "horsepower bands and exempt specialty motors create differential coverage",
    mechanism:
      "component substitution, engineering effort, and production cost",
  },
  {
    feature: "employee biometric-data retention limit",
    population: "manufacturers using biometric timekeeping or access systems",
    external:
      "the privacy regulator adopted retention limits for workplace biometric records",
    exposure:
      "vendor contracts and privacy notices can reveal firm use of biometric systems",
    timing:
      "deletion and consent duties begin on separate published compliance dates",
    variation:
      "firms using biometric systems differ from badge-only employers",
    mechanism:
      "workforce-system replacement and privacy compliance expense",
  },
  {
    feature: "dual-use component export-license expansion",
    population: "manufacturers shipping listed components to controlled destinations",
    external:
      "the export authority expanded the control list through a national-security order",
    exposure:
      "license applications and product codes can link controlled shipments to exporters",
    timing:
      "the control-list amendment has a dated license requirement and wind-down window",
    variation:
      "destination and component codes differentiate controlled from unrestricted exports",
    mechanism:
      "market access, licensing delay, and customer substitution",
  },
  {
    feature: "overtime classification salary threshold",
    population: "manufacturers employing salaried staff below the new threshold",
    external:
      "the labor department revised a nationwide salary test through formal rulemaking",
    exposure:
      "payroll salary bands can identify workers and firms crossing the threshold",
    timing:
      "the salary test takes effect on a specified payroll compliance date",
    variation:
      "pre-rule salary bands create differential workforce exposure",
    mechanism:
      "labor cost, scheduling, and managerial staffing choices",
  },
] as const;

function interactionAssessmentProfile(id: string) {
  const candidateNumber = Number(
    id.match(/candidate-(\d+)$/)?.[1] ?? "",
  );
  const fallbackIndex = [...id].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const index = Number.isFinite(candidateNumber) && candidateNumber > 0
    ? candidateNumber - 1
    : fallbackIndex;
  return interactionAssessmentProfiles[
    index % interactionAssessmentProfiles.length
  ]!;
}

function findProposal(
  id: string,
  displayName = `Interactive regulation ${id}`,
): Screen02FindProposal {
  const source = officialSource(`source-${id}`);
  const profile = interactionAssessmentProfile(id);
  source.title = `Official ${profile.feature} record covering ${profile.population} for ${displayName}`;
  return {
    id,
    mode: "find",
    kind: "event",
    title: displayName,
    description: `${displayName} documents a ${profile.feature} in an official regulatory record.`,
    origin: "newly-discovered",
    provisionalDates: ["2019-07-01"],
    affectedPopulation: "U.S. exchange-listed manufacturing firms",
    requiredVariables: ["Firm assignment", "Effective date"],
    outcomeLink: {
      text: `${displayName}'s ${profile.feature} could affect Profitability through ${profile.mechanism}, although Screen 3 must verify the proposed pathway.`,
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: ["Screen 3 must verify the operative rule and date."],
    reasons: [
      `${displayName} appears because the official ${profile.feature} record places a dated manufacturer-facing regulation inside the locked scope while preserving its provisional evidence status.`,
    ],
    event: {
      displayName,
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. exchange-listed manufacturing firms"],
    },
    sources: [source],
    assessments: {
      externalShockPlausibility: {
        category: "plausible",
        reason: `For ${displayName}, ${profile.external}; residual anticipation and selection still require verification.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      populationApplicability: {
        category: "documented-direct",
        sourceEstablishedPopulation: {
          text: profile.population,
          evidenceSourceIds: [source.id],
        },
        reason: `${displayName} documents direct coverage of ${profile.population} in the attached official source.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      outcomePathway: {
        category: "source-anchored-specific",
        reason: `${displayName}'s ${profile.feature} gives a source-anchored Profitability pathway through ${profile.mechanism}, while the direction and magnitude remain untested.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      exposureObservability: {
        category: "observable-with-linkage",
        reason: `For ${displayName}, ${profile.exposure}; ownership linkage remains necessary.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      timeSupport: {
        category: "adequate",
        reason: `For ${displayName}, ${profile.timing}, supporting a bounded pre/post window.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      variation: {
        category: "usable",
        reason: `For ${displayName}, ${profile.variation}, yielding a candidate-specific comparison lead.`,
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
    },
  };
}

function retainedDecisionForFindProposal(
  proposal: Screen02FindProposal,
  criterionIds: string[] = [],
) {
  const profile = interactionAssessmentProfile(proposal.id);
  return {
    itemId: proposal.id,
    decision: "retained" as const,
    criterionIds,
    reason: `${proposal.title} remains in the comparison because its documented ${profile.feature} fits the locked manufacturing regulation scope; the evidence is still preliminary.`,
  };
}

function auditProposal(): Screen02AuditProposal {
  const source = officialSource("ccpa-formal-source");
  source.title =
    "Official CCPA statutory threshold coverage record for qualifying firms";
  return {
    id: "ccpa-formal-source-backed",
    mode: "audit",
    kind: "representation",
    representationType: "formal-eligibility",
    title: "CCPA formal eligibility",
    description:
      "A source-backed representation of the exact known shock.",
    candidateConstruct:
      "California Consumer Privacy Act formal eligibility",
    operationalization:
      "An indicator for source-documented statutory coverage.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Firms covered by the statutory criteria",
    requiredVariables: ["Coverage criteria", "Effective date"],
    outcomeLink: {
      text:
        "An AI-generated hypothesis links formal CCPA eligibility to innovation.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: [
      "The exact eligibility clauses remain provisional until Screen 3.",
    ],
    reasons: [
      "The source supplies a plausible formal-assignment representation.",
    ],
    sources: [source],
    assessments: {
      externalShockPlausibility: {
        category: "plausible",
        reason:
          "The statutory rule appears externally imposed on covered firms, while exogeneity still requires verification.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      populationApplicability: {
        category: "documented-conditional",
        sourceEstablishedPopulation: {
          text: "Qualifying firms that satisfy the CCPA statutory thresholds",
          evidenceSourceIds: [source.id],
        },
        reason:
          "The CCPA statutory criteria document conditional coverage of qualifying firms rather than all technology firms in the Screen 1 study population.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
        unresolved: [
          "Screen 3 must verify which study firms satisfy the statutory thresholds and exemptions.",
        ],
      },
      exposureObservability: {
        category: "observable-with-linkage",
        reason:
          "The statutory criteria appear linkable to covered firms.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      timeSupport: {
        category: "adequate",
        reason:
          "The source supplies a bounded date inside the confirmed study period.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
      variation: {
        category: "usable",
        reason:
          "The statutory coverage rule implies a plausible comparison.",
        evidenceSourceIds: [source.id],
        method: "ai-rubric",
      },
    },
  };
}

function criterion(
  id: string,
  kind: Screen02PreferenceCriterion["kind"],
  text: string,
  exactRequest: string,
): Screen02PreferenceCriterion {
  return {
    id,
    kind,
    text,
    source: "ai-interpretation",
    exactRequest,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function testFingerprint(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(
    serializeDeterministicJson(value),
  )) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function nativeParentForAi(
  proposals: Screen02FindProposal[],
  retrievedAt = "2026-07-29T11:57:59Z",
) {
  const initial = createScreen02Session(confirmedFindContext());
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "find-more",
    exactRequest:
      "Retrieve the candidate records before running comparative AI assessment.",
    retrievedAt,
    proposals,
    interpretationSource: "researcher-structured",
    stage: "native-retrieval",
  });
}

function reviewNativeProposals(
  nativeProposals: Screen02FindProposal[],
  reviewedProposals: Screen02FindProposal[],
) {
  const parent = nativeParentForAi(nativeProposals);
  return applyScreen02SearchRound(parent, {
    expectedRevision: parent.revision,
    requestType: "refine",
    exactRequest:
      "Apply a source-grounded comparative population review.",
    retrievedAt: "2026-07-29T11:58:02Z",
    proposals: reviewedProposals,
    interpretationSource: "ai-interpretation",
    stage: "ai-review",
    parentRoundId: parent.interaction.searchRounds.at(-1)!.id,
    semanticDecisions: reviewedProposals.map((proposal) =>
      retainedDecisionForFindProposal(proposal),
    ),
  });
}

function findSessionWithResult(id = "initial-find-result") {
  const initial = createScreen02Session(confirmedFindContext());
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "find-more",
    exactRequest: "Find source-backed candidate shocks.",
    retrievedAt: "2026-07-29T11:59:00Z",
    proposals: [findProposal(id)],
  });
}

describe("Screen 2 v2 interaction and decision contract", () => {
  it("permits eight complete native-retrieval and AI-review pairs in one run", () => {
    let session = createScreen02Session(confirmedFindContext());

    for (let searchIndex = 1; searchIndex <= 8; searchIndex += 1) {
      const proposals = Array.from({ length: 8 }, (_, index) => {
        const proposal = findProposal(
          `search-${searchIndex}-candidate-${index + 1}`,
          `EventCode${searchIndex}X${index + 1}`,
        );
        const eventDate = `${2013 + searchIndex}-${String(
          index + 1,
        ).padStart(2, "0")}-01`;
        proposal.event.eventDate = eventDate;
        proposal.provisionalDates = [eventDate];
        proposal.sources[0]!.publishedDate = eventDate;
        return proposal;
      });
      const nativeCriteria = (
        ["require", "prefer", "avoid"] as const
      ).map((kind, index) => ({
        id: `native-${searchIndex}-${index}`,
        kind,
        text: `${kind} native criterion ${searchIndex}`,
        source: "researcher" as const,
        exactRequest: `Native retrieval ${searchIndex}.`,
      }));
      session = applyScreen02SearchRound(session, {
        expectedRevision: session.revision,
        requestType: "find-more",
        exactRequest: `Native retrieval ${searchIndex}.`,
        retrievedAt: "2026-07-29T11:58:00Z",
        proposals,
        criteria: nativeCriteria,
        interpretationSource: "researcher-structured",
        stage: "native-retrieval",
      });
      const parentRoundId =
        session.interaction.searchRounds.at(-1)!.id;
      session = applyScreen02SearchRound(session, {
        expectedRevision: session.revision,
        requestType: "refine",
        exactRequest: `AI review ${searchIndex}.`,
        retrievedAt: "2026-07-29T11:58:01Z",
        proposals,
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId,
        semanticDecisions: proposals.map((proposal) =>
          retainedDecisionForFindProposal(proposal),
        ),
      });
    }

    expect(session.interaction.searchRounds).toHaveLength(17);
    expect(SCREEN_02_MAX_SEARCH_ROUNDS).toBe(33);
    expect(SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS).toBe(8);
    expect(session.interaction.preferences.criteria).toHaveLength(24);
    expect(SCREEN_02_MAX_PREFERENCE_CRITERIA).toBe(48);
    expect(session.items).toHaveLength(64);
    expect(() =>
      applyScreen02SearchRound(session, {
        expectedRevision: session.revision,
        requestType: "find-more",
        exactRequest: "A ninth researcher search exceeds the run limit.",
        retrievedAt: "2026-07-29T11:58:02Z",
        proposals: [],
      }),
    ).toThrow(
      `at most ${SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS} researcher search or proposal rounds`,
    );
  }, 30_000);

  it("requires all six AI-rubric dimensions only for AI-interpreted proposals", () => {
    const complete = findProposal("complete-ai-review");
    const incomplete: Screen02FindProposal = {
      ...complete,
      id: "incomplete-ai-review",
      assessments: {
        externalShockPlausibility:
          complete.assessments!.externalShockPlausibility,
        populationApplicability:
          complete.assessments!.populationApplicability,
        outcomePathway:
          complete.assessments!.outcomePathway,
        exposureObservability:
          complete.assessments!.exposureObservability,
        variation: complete.assessments!.variation,
      },
    };

    const completeParent = nativeParentForAi([complete]);
    const completed = applyScreen02SearchRound(completeParent, {
      expectedRevision: completeParent.revision,
      requestType: "refine",
      exactRequest: "Apply a complete AI review.",
      retrievedAt: "2026-07-29T11:58:02Z",
      proposals: [complete],
      interpretationSource: "ai-interpretation",
      stage: "ai-review",
      parentRoundId:
        completeParent.interaction.searchRounds.at(-1)!.id,
      semanticDecisions: [retainedDecisionForFindProposal(complete)],
    });
    const completedItem = completed.items.find(
      (item) => item.id === complete.id,
    );
    expect(
      [
        "exposureObservability",
        "timeSupport",
        "variation",
      ].map(
        (component) =>
          completedItem!.scorecard.componentDetails[
            component as
              | "exposureObservability"
              | "timeSupport"
              | "variation"
          ].method,
      ),
    ).toEqual(["ai-rubric", "ai-rubric", "ai-rubric"]);

    const incompleteParent = nativeParentForAi([incomplete]);
    expect(() =>
      applyScreen02SearchRound(incompleteParent, {
        expectedRevision: incompleteParent.revision,
        requestType: "refine",
        exactRequest: "Apply an incomplete AI review.",
        retrievedAt: "2026-07-29T11:58:03Z",
        proposals: [incomplete],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId:
          incompleteParent.interaction.searchRounds.at(-1)!.id,
        semanticDecisions: [
          retainedDecisionForFindProposal(incomplete),
        ],
      }),
    ).toThrow("proposals[0] is missing timeSupport");

    const unsupportedExternality = findProposal(
      "unsupported-externality",
    );
    unsupportedExternality.assessments = {
      ...unsupportedExternality.assessments,
      externalShockPlausibility: {
        ...unsupportedExternality.assessments!
          .externalShockPlausibility!,
        evidenceSourceIds: [],
      },
    };
    const unsupportedParent = nativeParentForAi([
      findProposal("unsupported-externality"),
    ]);
    expect(() =>
      applyScreen02SearchRound(unsupportedParent, {
        expectedRevision: unsupportedParent.revision,
        requestType: "refine",
        exactRequest: "Apply an unsupported known externality judgment.",
        retrievedAt: "2026-07-29T11:58:03Z",
        proposals: [unsupportedExternality],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId:
          unsupportedParent.interaction.searchRounds.at(-1)!.id,
        semanticDecisions: [
          retainedDecisionForFindProposal(unsupportedExternality),
        ],
      }),
    ).toThrow(/source evidence/i);

    const templatedOutcome = findProposal("templated-outcome");
    templatedOutcome.outcomeLink = {
      text: "A deterministic connector template.",
      status: "system-template",
    };
    const templatedParent = nativeParentForAi([templatedOutcome]);
    expect(() =>
      applyScreen02SearchRound(templatedParent, {
        expectedRevision: templatedParent.revision,
        requestType: "refine",
        exactRequest: "Attempt to retain a templated outcome link.",
        retrievedAt: "2026-07-29T11:58:03Z",
        proposals: [templatedOutcome],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId:
          templatedParent.interaction.searchRounds.at(-1)!.id,
        semanticDecisions: [
          retainedDecisionForFindProposal(templatedOutcome),
        ],
      }),
    ).toThrow(/candidate-specific, outcome-blind AI hypothesis/i);

    expect(() =>
      applyScreen02SearchRound(
        createScreen02Session(confirmedFindContext()),
        {
        expectedRevision: 0,
        requestType: "user-source",
        exactRequest:
          "Retain a partial researcher-structured assessment for compatibility.",
        retrievedAt: "2026-07-29T11:58:04Z",
        proposals: [incomplete],
        interpretationSource: "researcher-structured",
        },
      ),
    ).not.toThrow();
  });

  it("preserves native population facts while retaining distinct source-established populations", () => {
    const firstNative = findProposal(
      "population-distinct-candidate-1",
      "AlphaPolicyCode",
    );
    const secondNative = findProposal(
      "population-distinct-candidate-2",
      "BetaPolicyCode",
    );
    secondNative.event.eventDate = "2020-03-01";
    secondNative.provisionalDates = ["2020-03-01"];
    secondNative.sources[0]!.publishedDate = "2020-03-01";
    const nativePopulationFacts = new Map(
      [firstNative, secondNative].map((proposal) => [
        proposal.id,
        {
          affectedPopulation: proposal.affectedPopulation,
          eventPopulations: clone(proposal.event.populations),
        },
      ]),
    );
    const reviewed = reviewNativeProposals(
      [firstNative, secondNative],
      [clone(firstNative), clone(secondNative)],
    );
    const firstItem = reviewed.items.find(
      (item) => item.id === firstNative.id,
    );
    const secondItem = reviewed.items.find(
      (item) => item.id === secondNative.id,
    );

    expect(firstItem).toMatchObject({
      affectedPopulation: nativePopulationFacts.get(firstNative.id)!
        .affectedPopulation,
    });
    expect(secondItem).toMatchObject({
      affectedPopulation: nativePopulationFacts.get(secondNative.id)!
        .affectedPopulation,
    });
    expect(firstItem?.mode).toBe("find");
    expect(secondItem?.mode).toBe("find");
    if (firstItem?.mode !== "find" || secondItem?.mode !== "find") {
      throw new Error("Expected reviewed find-mode items.");
    }
    expect(firstItem.event.populations).toEqual(
      nativePopulationFacts.get(firstNative.id)!.eventPopulations,
    );
    expect(secondItem.event.populations).toEqual(
      nativePopulationFacts.get(secondNative.id)!.eventPopulations,
    );
    expect(
      firstItem.populationApplicability?.sourceEstablishedPopulation,
    ).toEqual({
      text: "plants exceeding a documented emissions threshold",
      evidenceSourceIds: [firstNative.sources[0]!.id],
    });
    expect(
      secondItem.populationApplicability?.sourceEstablishedPopulation,
    ).toEqual({
      text:
        "manufacturers placing certified industrial machinery on the market",
      evidenceSourceIds: [secondNative.sources[0]!.id],
    });
    expect(
      firstItem.populationApplicability?.sourceEstablishedPopulation?.text,
    ).not.toBe(
      secondItem.populationApplicability?.sourceEstablishedPopulation?.text,
    );
  });

  it("allows identical source-established population text when each candidate cites its own evidence", () => {
    const firstNative = findProposal(
      "population-shared-candidate-1",
      "First Covered Manufacturer Rule",
    );
    const secondNative = findProposal(
      "population-shared-candidate-2",
      "Second Covered Manufacturer Rule",
    );
    secondNative.event.eventDate = "2020-04-01";
    secondNative.provisionalDates = ["2020-04-01"];
    secondNative.sources[0]!.publishedDate = "2020-04-01";
    const sharedSourceDescription =
      confirmedFindContext().scopeContract.population;
    for (const proposal of [firstNative, secondNative]) {
      proposal.description = `${proposal.description} The cited record identifies ${sharedSourceDescription} as the covered population.`;
      proposal.sources[0]!.title = `${proposal.sources[0]!.title}; coverage includes ${sharedSourceDescription}`;
    }
    const reviewedProposals = [clone(firstNative), clone(secondNative)];
    for (const proposal of reviewedProposals) {
      proposal.assessments!.populationApplicability!.sourceEstablishedPopulation = {
        text: sharedSourceDescription,
        evidenceSourceIds: [proposal.sources[0]!.id],
      };
    }

    const reviewed = reviewNativeProposals(
      [firstNative, secondNative],
      reviewedProposals,
    );
    const populationRecords = reviewedProposals.map((proposal) =>
      reviewed.items.find((item) => item.id === proposal.id)
        ?.populationApplicability?.sourceEstablishedPopulation,
    );

    expect(populationRecords.map((record) => record?.text)).toEqual([
      sharedSourceDescription,
      sharedSourceDescription,
    ]);
    expect(
      populationRecords.map((record) => record?.evidenceSourceIds),
    ).toEqual([
      [firstNative.sources[0]!.id],
      [secondNative.sources[0]!.id],
    ]);
  });

  it("requires an explicit source-established population and limits null to unknown applicability", () => {
    const nativeProposal = findProposal(
      "population-required-candidate-1",
      "OrionManufacturingDirective",
    );
    const missing = clone(nativeProposal);
    delete (
      missing.assessments!.populationApplicability as Partial<
        NonNullable<
          NonNullable<Screen02FindProposal["assessments"]>["populationApplicability"]
        >
      >
    ).sourceEstablishedPopulation;

    expect(() =>
      reviewNativeProposals([nativeProposal], [missing]),
    ).toThrow(
      /sourceEstablishedPopulation must be a cited population record or null/i,
    );

    const knownWithNull = clone(nativeProposal);
    knownWithNull.assessments!.populationApplicability!.sourceEstablishedPopulation =
      null;
    expect(() =>
      reviewNativeProposals([nativeProposal], [knownWithNull]),
    ).toThrow(/may be null only when population applicability is unknown/i);
  });

  it("rejects source-established population evidence that is unattached or absent from applicability evidence", () => {
    const nativeProposal = findProposal(
      "population-evidence-candidate-1",
      "Population Evidence Linkage Rule",
    );
    const unattached = clone(nativeProposal);
    unattached.assessments!.populationApplicability!.evidenceSourceIds = [
      "unattached-population-source",
    ];
    unattached.assessments!.populationApplicability!.sourceEstablishedPopulation = {
      text: "facilities named by an unattached population source",
      evidenceSourceIds: ["unattached-population-source"],
    };
    expect(() =>
      reviewNativeProposals([nativeProposal], [unattached]),
    ).toThrow(
      /source that is not attached|attached source ids|share source-derived population terms/i,
    );

    const missingFromApplicability = clone(nativeProposal);
    const attachedPopulationSource = officialSource(
      "attached-population-only-source",
    );
    missingFromApplicability.sources.push(attachedPopulationSource);
    missingFromApplicability.assessments!.populationApplicability!.sourceEstablishedPopulation = {
      text: "facilities documented by the second attached source",
      evidenceSourceIds: [attachedPopulationSource.id],
    };
    expect(() =>
      reviewNativeProposals(
        [nativeProposal],
        [missingFromApplicability],
      ),
    ).toThrow(/also listed on populationApplicability|unrelated evidence/i);
  });

  it("rejects omission or mutation of a native source during AI review", () => {
    const nativeProposal = findProposal(
      "native-source-integrity-candidate-1",
      "Native Source Integrity Rule",
    );
    const omitted = clone(nativeProposal);
    omitted.sources = [];
    expect(() =>
      reviewNativeProposals([nativeProposal], [omitted]),
    ).toThrow(/preserve every native source record exactly/i);

    const mutated = clone(nativeProposal);
    mutated.sources[0]!.title =
      `${mutated.sources[0]!.title} with an AI-authored factual change`;
    expect(() =>
      reviewNativeProposals([nativeProposal], [mutated]),
    ).toThrow(/preserve every native source record exactly/i);
  });

  it("accepts a unique additional host-located source while preserving the native source", () => {
    const nativeProposal = findProposal(
      "native-source-append-candidate-1",
      "Native Source Append Rule",
    );
    const reviewedProposal = clone(nativeProposal);
    const additionalSource = officialSource(
      "unique-host-source-native-source-append",
    );
    additionalSource.title =
      "Supplemental official compliance calendar for covered manufacturers";
    reviewedProposal.sources.push(additionalSource);

    const reviewed = reviewNativeProposals(
      [nativeProposal],
      [reviewedProposal],
    );
    const retained = reviewed.items.find(
      (item) => item.id === nativeProposal.id,
    );

    expect(retained?.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        nativeProposal.sources[0]!.id,
        additionalSource.id,
      ]),
    );
    expect(retained?.sources).toHaveLength(2);
  });

  it("rejects duplicate source ids before candidate evidence is merged", () => {
    const nativeProposal = findProposal(
      "duplicate-source-id-candidate-1",
      "Duplicate Source Identifier Rule",
    );
    const duplicated = clone(nativeProposal);
    duplicated.sources.push(clone(duplicated.sources[0]!));

    expect(() =>
      reviewNativeProposals([nativeProposal], [duplicated]),
    ).toThrow(/sources contains a duplicate source id/i);
  });

  it("rejects one candidate reusing the same assessment paragraph across dimensions", () => {
    const nativeProposal = findProposal(
      "repeated-dimensions-candidate-1",
      "Dimension-Specific Evidence Rule",
    );
    const reviewedProposal = clone(nativeProposal);
    const profile = interactionAssessmentProfile(nativeProposal.id);
    const repeatedParagraph = `${reviewedProposal.title}'s ${profile.feature} official record identifies a dated compliance threshold for covered manufacturers, but linked implementation files are still needed to judge Profitability feasibility and this candidate-specific natural-experiment design.`;
    for (const assessment of Object.values(
      reviewedProposal.assessments ?? {},
    )) {
      assessment.reason = repeatedParagraph;
    }

    expect(() =>
      reviewNativeProposals([nativeProposal], [reviewedProposal]),
    ).toThrow(/repeats the same assessment narrative used for/i);
  });

  it("restores a legacy schema-2.0 session whose stored population assessment predates sourceEstablishedPopulation", () => {
    const legacy = clone(
      findSessionWithResult("legacy-source-population-candidate-1"),
    );
    expect(legacy.schemaVersion).toBe("2.0");

    for (const item of legacy.items) {
      delete item.populationApplicability
        ?.sourceEstablishedPopulation;
    }

    const replacementVersionIds = new Map<string, string>();
    for (const version of legacy.interaction.itemVersions) {
      delete version.item.populationApplicability
        ?.sourceEstablishedPopulation;
      const fingerprint = testFingerprint({
        ...clone(version.item),
        rank: 1,
      });
      const replacementVersionId = `item-version-${fingerprint.replace(
        ":",
        "-",
      )}`;
      replacementVersionIds.set(
        version.versionId,
        replacementVersionId,
      );
      version.itemFingerprint = fingerprint;
      version.versionId = replacementVersionId;
    }
    for (const round of legacy.interaction.searchRounds) {
      round.assessedItemVersionIds = round.assessedItemVersionIds.map(
        (versionId) =>
          replacementVersionIds.get(versionId) ?? versionId,
      );
      round.activeItemVersionIds = round.activeItemVersionIds.map(
        (versionId) =>
          replacementVersionIds.get(versionId) ?? versionId,
      );
    }

    const restored = restoreScreen02Session(legacy);
    expect(restored).not.toBeNull();
    expect(
      Object.hasOwn(
        restored!.items[0]!.populationApplicability!,
        "sourceEstablishedPopulation",
      ),
    ).toBe(false);
  });

  it("preserves parent criteria and explicit unknown judgments through a native-to-AI merge", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const nativeProposal = findProposal(
      "native-unknown-review",
      "Manufacturing Reporting Rule",
    );
    nativeProposal.assessments = undefined;
    nativeProposal.outcomeLink = {
      text:
        "System-generated provisional template: regulatory exposure may affect the focal outcome, but no candidate-specific mechanism has been assessed.",
      status: "system-template",
    };
    const nativeCriterion: Screen02PreferenceCriterion = {
      id: "prefer-manufacturing-rule",
      kind: "prefer",
      text: "Manufacturing-specific rules",
      source: "researcher",
      exactRequest:
        "Rank manufacturing-specific rules higher.",
    };
    const native = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Find candidate manufacturing rules.",
      retrievedAt: "2026-07-29T11:58:05Z",
      proposals: [nativeProposal],
      criteria: [nativeCriterion],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const parentRound = native.interaction.searchRounds.at(-1)!;
    const nativeItem = native.items.find(
      (item) => item.id === nativeProposal.id,
    );
    if (!nativeItem) {
      throw new Error("The native item was not retained.");
    }
    expect(nativeItem.outcomeLink).toEqual(
      nativeProposal.outcomeLink,
    );

    const aiProposal = findProposal(
      nativeProposal.id,
      nativeProposal.event.displayName,
    );
    aiProposal.sources = clone(nativeItem.sources);
    aiProposal.assessments = {
      externalShockPlausibility: {
        category: "unknown",
        reason: `${nativeProposal.title}'s official record does not reveal whether covered manufacturers influenced the rule's facility emissions threshold.`,
        evidenceSourceIds: [],
        unresolved: [
          `Check the ${nativeProposal.title} rulemaking docket for manufacturer-authored threshold language and agency responses.`,
        ],
        method: "ai-rubric",
      },
      populationApplicability: {
        category: "unknown",
        sourceEstablishedPopulation: null,
        reason: `${nativeProposal.title} does not identify which facility emissions thresholds and ownership rules place manufacturing firms inside legal coverage.`,
        evidenceSourceIds: [],
        unresolved: [
          `Map ${nativeProposal.title} facility thresholds and covered plants to the Screen 1 manufacturing-firm population.`,
        ],
        method: "ai-rubric",
      },
      outcomePathway: {
        category: "unclear",
        reason: `${nativeProposal.title}'s facility emissions-intensity disclosure threshold could alter Profitability through monitoring investment, but the available source does not establish that pathway.`,
        evidenceSourceIds: [nativeItem.sources[0]!.id],
        unresolved: [
          `Trace ${nativeProposal.title} facility monitoring requirements into firm-level capital expenditure before claiming a Profitability pathway.`,
        ],
        method: "ai-rubric",
      },
      exposureObservability: {
        category: "unknown",
        reason: `${nativeProposal.title}'s source lists facility reporting but supplies no tested plant-to-parent identifier for firm-level exposure.`,
        evidenceSourceIds: [nativeItem.sources[0]!.id],
        unresolved: [
          `Test whether ${nativeProposal.title} facility identifiers map uniquely to historical firm identifiers.`,
        ],
        method: "ai-rubric",
      },
      timeSupport: {
        category: "unknown",
        reason: `${nativeProposal.title}'s publication date does not distinguish legal effect from the first mandatory emissions filing.`,
        evidenceSourceIds: [nativeItem.sources[0]!.id],
        unresolved: [
          `Verify the first binding ${nativeProposal.title} filing deadline and any facility transition periods.`,
        ],
        method: "ai-rubric",
      },
      variation: {
        category: "unknown",
        reason: `${nativeProposal.title} describes emissions thresholds without showing populated firm counts above and below each cutoff.`,
        evidenceSourceIds: [nativeItem.sources[0]!.id],
        unresolved: [
          `Measure ${nativeProposal.title} covered and exempt facility counts before treating its threshold as comparison variation.`,
        ],
        method: "ai-rubric",
      },
    };
    const researcherPromotionProposal = clone(aiProposal);
    researcherPromotionProposal.outcomeLink = {
      text:
        "Researcher-structured caller label that must not promote a template into an AI hypothesis.",
      status: "ai-hypothesis",
    };
    const researcherPromotionAttempt = applyScreen02SearchRound(
      native,
      {
        expectedRevision: native.revision,
        requestType: "user-source",
        exactRequest:
          "Attempt to promote a caller-labeled hypothesis without an authoritative AI child round.",
        retrievedAt: "2026-07-29T11:58:05.500Z",
        proposals: [researcherPromotionProposal],
        interpretationSource: "researcher-structured",
        stage: "researcher-assessment",
      },
    );
    expect(
      researcherPromotionAttempt.items.find(
        (item) => item.id === nativeProposal.id,
      )?.outcomeLink,
    ).toEqual(nativeProposal.outcomeLink);
    const reviewed = applyScreen02SearchRound(native, {
      expectedRevision: native.revision,
      requestType: "refine",
      exactRequest: "Complete the preliminary AI review.",
      retrievedAt: "2026-07-29T11:58:06Z",
      proposals: [aiProposal],
      interpretationSource: "ai-interpretation",
      stage: "ai-review",
      parentRoundId: parentRound.id,
      semanticDecisions: [
        {
          itemId: nativeProposal.id,
          decision: "retained",
          criterionIds: [],
          reason: `${nativeProposal.title} remains eligible because its facility emissions-intensity disclosure threshold fits the locked manufacturing regulation scope, although every empirical dimension remains inconclusive.`,
        },
      ],
    });
    const reviewedItem = reviewed.items.find(
      (item) => item.id === nativeProposal.id,
    );
    const reviewedRound =
      reviewed.interaction.searchRounds.at(-1)!;

    expect(reviewedRound.preferenceCriteriaIds).toEqual([
      nativeCriterion.id,
    ]);
    expect(
      [
        "exposureObservability",
        "timeSupport",
        "variation",
      ].map(
        (key) =>
          reviewedItem!.scorecard.componentDetails[
            key as
              | "exposureObservability"
              | "timeSupport"
              | "variation"
          ],
      ),
    ).toEqual([
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
    ]);
    expect(
      reviewedItem!.scorecard.components.exposureObservability,
    ).toBeNull();
    expect(reviewedItem!.scorecard.components.timeSupport).toBeNull();
    expect(reviewedItem!.scorecard.components.variation).toBeNull();
    expect(reviewedItem!.externalShockPlausibility).toMatchObject({
      method: "ai-rubric",
      category: "unknown",
      evidenceSourceIds: [],
      unresolved: [
        `Check the ${nativeProposal.title} rulemaking docket for manufacturer-authored threshold language and agency responses.`,
      ],
    });
    expect(reviewedItem!.outcomeLink).toEqual(
      aiProposal.outcomeLink,
    );

    const nativeRefresh = applyScreen02SearchRound(reviewed, {
      expectedRevision: reviewed.revision,
      requestType: "find-more",
      exactRequest:
        "Refresh the same native candidate without downgrading its AI hypothesis.",
      retrievedAt: "2026-07-29T11:58:07Z",
      proposals: [nativeProposal],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const nativeRefreshRound =
      nativeRefresh.interaction.searchRounds.at(-1)!;
    expect(
      nativeRefresh.items.find(
        (item) => item.id === nativeProposal.id,
      )?.outcomeLink,
    ).toEqual(aiProposal.outcomeLink);

    const refreshedAiProposal = clone(aiProposal);
    const refreshedProfile = interactionAssessmentProfile(
      nativeProposal.id,
    );
    refreshedAiProposal.outcomeLink = {
      text: `${nativeProposal.title}'s ${refreshedProfile.feature} may affect Profitability through ${refreshedProfile.mechanism}, subject to Screen 3 verification.`,
      status: "ai-hypothesis",
    };
    const reviewedAgain = applyScreen02SearchRound(nativeRefresh, {
      expectedRevision: nativeRefresh.revision,
      requestType: "refine",
      exactRequest: "Refresh the authoritative preliminary AI review.",
      retrievedAt: "2026-07-29T11:58:08Z",
      proposals: [refreshedAiProposal],
      interpretationSource: "ai-interpretation",
      stage: "ai-review",
      parentRoundId: nativeRefreshRound.id,
      semanticDecisions: [
        {
          itemId: nativeProposal.id,
          decision: "retained",
          criterionIds: [],
          reason: `${nativeProposal.title} remains eligible after refresh because its documented facility emissions-intensity threshold still fits the locked manufacturing regulation scope and period.`,
        },
      ],
    });
    const reviewedAgainRound =
      reviewedAgain.interaction.searchRounds.at(-1)!;
    expect(
      reviewedAgain.items.find(
        (item) => item.id === nativeProposal.id,
      )?.outcomeLink,
    ).toEqual(refreshedAiProposal.outcomeLink);

    const researcherOverwriteProposal = clone(
      refreshedAiProposal,
    );
    researcherOverwriteProposal.outcomeLink = {
      text:
        "Researcher-structured caller label that must not overwrite the authoritative AI hypothesis.",
      status: "ai-hypothesis",
    };
    const researcherOverwriteAttempt = applyScreen02SearchRound(
      reviewedAgain,
      {
        expectedRevision: reviewedAgain.revision,
        requestType: "user-source",
        exactRequest:
          "Attempt to overwrite the authoritative AI hypothesis from a researcher-structured round.",
        retrievedAt: "2026-07-29T11:58:09Z",
        proposals: [researcherOverwriteProposal],
        interpretationSource: "researcher-structured",
        stage: "researcher-assessment",
      },
    );
    const researcherOverwriteRound =
      researcherOverwriteAttempt.interaction.searchRounds.at(-1)!;
    expect(
      researcherOverwriteAttempt.items.find(
        (item) => item.id === nativeProposal.id,
      )?.outcomeLink,
    ).toEqual(refreshedAiProposal.outcomeLink);

    const outcomeLinkForRound = (
      round: Screen02Session["interaction"]["searchRounds"][number],
    ) => {
      const versionId = round.assessedItemVersionIds.find(
        (candidateVersionId) =>
          researcherOverwriteAttempt.interaction.itemVersions.find(
            (version) =>
              version.versionId === candidateVersionId &&
              version.itemId === nativeProposal.id,
          ),
      );
      return researcherOverwriteAttempt.interaction.itemVersions.find(
        (version) => version.versionId === versionId,
      )?.item.outcomeLink;
    };
    expect(outcomeLinkForRound(parentRound)).toEqual(
      nativeProposal.outcomeLink,
    );
    expect(outcomeLinkForRound(reviewedRound)).toEqual(
      aiProposal.outcomeLink,
    );
    expect(outcomeLinkForRound(nativeRefreshRound)).toEqual(
      aiProposal.outcomeLink,
    );
    expect(outcomeLinkForRound(reviewedAgainRound)).toEqual(
      refreshedAiProposal.outcomeLink,
    );
    expect(outcomeLinkForRound(researcherOverwriteRound)).toEqual(
      refreshedAiProposal.outcomeLink,
    );
    expect(
      researcherOverwriteAttempt.interaction.itemVersions.some(
        (version) =>
          version.itemId === nativeProposal.id &&
          version.item.outcomeLink.text ===
            researcherOverwriteProposal.outcomeLink.text,
      ),
    ).toBe(false);
    expect(
      restoreScreen02Session(researcherOverwriteAttempt),
    ).not.toBeNull();
    expect(restoreScreen02Session(reviewed)).not.toBeNull();
    const criteriaTampered = clone(reviewed);
    criteriaTampered.interaction.searchRounds.at(-1)!
      .preferenceCriteriaIds = [];
    expect(restoreScreen02Session(criteriaTampered)).toBeNull();
  });

  it("requires every exclusion citation to be a strict parent criterion", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const nativeProposal = findProposal("strict-exclusion-parent");
    const strictCriterion: Screen02PreferenceCriterion = {
      id: "avoid-strict-exclusion",
      kind: "avoid",
      text: "Exclude candidates rejected by semantic review",
      source: "researcher",
      exactRequest: "Do not show unsuitable candidates.",
    };
    const preferCriterion: Screen02PreferenceCriterion = {
      id: "prefer-strict-exclusion",
      kind: "prefer",
      text: "Manufacturing-specific candidates",
      source: "researcher",
      exactRequest: "Rank manufacturing-specific candidates higher.",
    };
    const native = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Find and rank candidate rules.",
      retrievedAt: "2026-07-29T11:58:07Z",
      proposals: [nativeProposal],
      criteria: [strictCriterion, preferCriterion],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const parentRound = native.interaction.searchRounds.at(-1)!;

    expect(() =>
      applyScreen02SearchRound(native, {
        expectedRevision: native.revision,
        requestType: "refine",
        exactRequest: "Complete the semantic review.",
        retrievedAt: "2026-07-29T11:58:08Z",
        proposals: [],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId: parentRound.id,
        semanticDecisions: [
          {
            itemId: nativeProposal.id,
            decision: "excluded",
            criterionIds: [
              strictCriterion.id,
              preferCriterion.id,
            ],
            reason:
              "This invalid decision mixes an exclusion and a ranking preference.",
          },
        ],
      }),
    ).toThrow(/only-include\/do-not-show criterion/i);
  });

  it("allows an auditable locked-scope exclusion when optional criteria are blank", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const nativeProposal = findProposal(
      "locked-scope-mismatch",
      "Aviation Transition Rule",
    );
    const native = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Find candidates without optional refinements.",
      retrievedAt: "2026-07-29T11:58:08Z",
      proposals: [nativeProposal],
      criteria: [],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const parentRound = native.interaction.searchRounds.at(-1)!;

    const reviewed = applyScreen02SearchRound(native, {
      expectedRevision: native.revision,
      requestType: "refine",
      exactRequest: "Complete the semantic review.",
      retrievedAt: "2026-07-29T11:58:09Z",
      proposals: [],
      interpretationSource: "ai-interpretation",
      stage: "ai-review",
      parentRoundId: parentRound.id,
      semanticDecisions: [
        {
          itemId: nativeProposal.id,
          decision: "excluded",
          criterionIds: [],
          scopeMismatchFields: ["industry"],
          reason:
            "The aviation-only rule does not match the locked manufacturing industry.",
        },
      ],
    });

    expect(
      reviewed.interaction.searchRounds.at(-1),
    ).toMatchObject({
      itemIdsRetained: [],
      semanticDecisions: [
        {
          itemId: nativeProposal.id,
          decision: "excluded",
          criterionIds: [],
          scopeMismatchFields: ["industry"],
        },
      ],
    });
    expect(restoreScreen02Session(reviewed)).not.toBeNull();
  });

  it("rejects AI decisions that contradict the final canonical result set", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const nativeProposal = findProposal(
      "canonical-decision-parent",
      "Canonical Manufacturing Rule",
    );
    const strictCriterion: Screen02PreferenceCriterion = {
      id: "avoid-canonical-decision",
      kind: "avoid",
      text: "Exclude candidates rejected by expert semantic review",
      source: "researcher",
      exactRequest: "Do not show semantically unsuitable candidates.",
    };
    const native = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Find candidate rules.",
      retrievedAt: "2026-07-29T11:58:09Z",
      proposals: [nativeProposal],
      criteria: [strictCriterion],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const parentRound = native.interaction.searchRounds.at(-1)!;
    const alias = findProposal(
      "canonical-decision-alias",
      nativeProposal.event.displayName,
    );

    expect(() =>
      applyScreen02SearchRound(native, {
        expectedRevision: native.revision,
        requestType: "refine",
        exactRequest: "Complete the semantic review.",
        retrievedAt: "2026-07-29T11:58:10Z",
        proposals: [alias],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId: parentRound.id,
        semanticDecisions: [
          {
            itemId: nativeProposal.id,
            decision: "excluded",
            criterionIds: [strictCriterion.id],
            reason:
              "The parent candidate was excluded, so an alias must not reintroduce it.",
          },
        ],
      }),
    ).toThrow(/clusters with native candidate/i);

    const exactNative = findProposal(
      nativeProposal.id,
      nativeProposal.event.displayName,
    );
    const rewrittenAlias = findProposal(
      "canonical-retained-rewrite-alias",
      nativeProposal.event.displayName,
    );
    rewrittenAlias.title = "AI-Rewritten Rule Title";
    rewrittenAlias.description = "AI-rewritten description.";
    expect(() =>
      applyScreen02SearchRound(native, {
        expectedRevision: native.revision,
        requestType: "refine",
        exactRequest: "Attempt a source-backed alias rewrite.",
        retrievedAt: "2026-07-29T11:58:10Z",
        proposals: [exactNative, rewrittenAlias],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId: parentRound.id,
        semanticDecisions: [
          {
            itemId: nativeProposal.id,
            decision: "retained",
            criterionIds: [],
            reason:
              "The exact native candidate remains eligible; the alias must not rewrite it.",
          },
        ],
      }),
    ).toThrow(/clusters with native candidate/i);

    const outOfScope = findProposal(
      nativeProposal.id,
      nativeProposal.event.displayName,
    );
    outOfScope.event.geographies = ["Canada"];
    expect(() =>
      applyScreen02SearchRound(native, {
        expectedRevision: native.revision,
        requestType: "refine",
        exactRequest: "Complete the semantic review.",
        retrievedAt: "2026-07-29T11:58:11Z",
        proposals: [outOfScope],
        interpretationSource: "ai-interpretation",
        stage: "ai-review",
        parentRoundId: parentRound.id,
        semanticDecisions: [
          {
            itemId: nativeProposal.id,
            decision: "retained",
            criterionIds: [],
            reason:
              "This invalid retained decision is removed by the fixed geography gate.",
          },
        ],
      }),
    ).toThrow(/preserve the native candidate's factual/i);
  });

  it("starts Screen 2 over without changing one byte of the confirmed Screen 1 baseline", () => {
    const initial = findSessionWithResult("reset-lock");
    const locked = lockScreen02Choice(
      selectScreen02Item(initial, initial.items[0]!.id),
    );
    const baselineBefore = JSON.stringify(locked.screen01Baseline);

    const restarted = restartScreen02Session(
      locked,
      "screen02-run-reset-test",
    );

    expect(JSON.stringify(restarted.screen01Baseline)).toBe(
      baselineBefore,
    );
    expect(restarted.screen01Fingerprint).toBe(
      locked.screen01Fingerprint,
    );
    expect(restarted.runId).toBe("screen02-run-reset-test");
    expect(restarted.runId).not.toBe(locked.runId);
    expect(restarted.revision).toBe(0);
    expect(restarted.selectedItemId).toBeNull();
    expect(restarted.lockedChoice).toBeNull();
    expect(restarted.interaction.preferences.criteria).toEqual([]);
    expect(restarted.interaction.preferenceAssessments).toEqual([]);
    expect(restarted.interaction.pendingRequest).toBeNull();
    expect(restarted.interaction.interactionRequestHistory).toEqual([]);
    expect(restarted.interaction.rejections).toEqual([]);
    expect(restarted.interaction.selectionHistory).toEqual([]);
    expect(restarted.interaction.searchRounds).toHaveLength(1);
    expect(restarted.interaction.searchRounds[0]?.requestType).toBe(
      "initial",
    );
    expect(restarted.items).toEqual([]);
  });

  it("persists an exact pending UI request before send and clears it only on error or its authoritative revision", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const exactText =
      "Prioritize options with an official source and a public threshold.";
    const criteria = [
      { kind: "require" as const, text: "At least one official source" },
      { kind: "prefer" as const, text: "Public eligibility threshold" },
    ];
    const pending = beginScreen02InteractionRequest(initial, {
      id: "interaction-request-001",
      requestType: "refine",
      exactText,
      criteria,
    });

    expect(pending.revision).toBe(initial.revision);
    expect(pending.interaction.pendingRequest).toEqual({
      id: "interaction-request-001",
      baseRevision: initial.revision,
      expectedRevision: initial.revision + 1,
      requestType: "refine",
      status: "sending",
      exactText,
      criteria,
    });
    expect(
      restoreScreen02Session(JSON.parse(JSON.stringify(pending)))
        ?.interaction.pendingRequest,
    ).toStrictEqual(pending.interaction.pendingRequest);
    expect(
      pending.interaction.interactionRequestHistory.map(
        (event) => event.action,
      ),
    ).toEqual(["recorded"]);

    const awaiting = markScreen02InteractionRequestAwaitingResponse(
      pending,
      "interaction-request-001",
    );
    expect(awaiting.interaction.pendingRequest?.status).toBe(
      "awaiting-response",
    );
    expect(
      awaiting.interaction.interactionRequestHistory.map(
        (event) => event.action,
      ),
    ).toEqual(["recorded", "sent"]);

    const afterError = clearScreen02InteractionRequest(
      awaiting,
      "interaction-request-001",
    );
    expect(afterError.interaction.pendingRequest).toBeNull();
    expect(afterError.revision).toBe(initial.revision);
    expect(
      afterError.interaction.interactionRequestHistory.at(-1),
    ).toMatchObject({
      action: "send-failed",
      requestId: "interaction-request-001",
      exactText,
      criteria,
    });
    expect(restoreScreen02Session(clone(afterError))).not.toBeNull();
    const forgedFailureHistory = clone(afterError);
    forgedFailureHistory.interaction.interactionRequestHistory.at(
      -1,
    )!.exactText = "A different request";
    expect(restoreScreen02Session(forgedFailureHistory)).toBeNull();

    const authoritative = applyScreen02SearchRound(awaiting, {
      expectedRevision: awaiting.revision,
      requestType: "refine",
      exactRequest: exactText,
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [findProposal("pending-response")],
      criteria: [
        criterion(
          "require-official-pending",
          "require",
          criteria[0].text,
          exactText,
        ),
        criterion(
          "prefer-threshold-pending",
          "prefer",
          criteria[1].text,
          exactText,
        ),
      ],
      interpretationSource: "researcher-structured",
    });
    expect(authoritative.revision).toBe(
      pending.interaction.pendingRequest?.expectedRevision,
    );
    expect(authoritative.interaction.pendingRequest).toBeNull();
    expect(
      authoritative.interaction.interactionRequestHistory.at(-1),
    ).toMatchObject({
      action: "reconciled",
      requestId: "interaction-request-001",
      exactText,
      criteria,
    });

    expect(() =>
      applyScreen02SearchRound(awaiting, {
        expectedRevision: awaiting.revision,
        requestType: "find-more",
        exactRequest: "A different request",
        retrievedAt: "2026-07-29T12:00:01Z",
        proposals: [findProposal("wrong-response")],
      }),
    ).toThrow(
      "The authoritative Screen 2 response does not match the persisted pending request.",
    );
  });

  it("reports an unmatched inclusion preference without using lexical fit as a scientific gate", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const exactRequest =
      "Require an orbital satellite sensor in every acceptable option.";
    const refined = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest,
      retrievedAt: "2026-07-29T12:00:02Z",
      proposals: [findProposal("require-blocked")],
      criteria: [
        criterion(
          "require-orbital-sensor",
          "require",
          "orbital satellite sensor",
          exactRequest,
        ),
      ],
      interpretationSource: "researcher-structured",
    });
    const candidate = refined.items.find(
      (item) => item.id === "require-blocked",
    );
    if (!candidate) throw new Error("Expected retained candidate.");

    expect(
      unmetRequiredCriteriaIdsForScreen02Item(refined, candidate.id),
    ).toEqual(["require-orbital-sensor"]);
    const selected = selectScreen02Item(refined, candidate.id);
    expect(selected.selectedItemId).toBe(candidate.id);
    expect(lockScreen02Choice(selected).lockedChoice?.itemId).toBe(
      candidate.id,
    );
  });

  it("preserves the exact Screen 1 baseline through preferences, multiple rounds, and rejection history", () => {
    const baseline = confirmedFindContext();
    const baselineJson = serializeScreen01StudyContext(baseline);
    const initial = createScreen02Session(baseline);
    const exactRequest =
      "Prefer threshold-based national policies and avoid proprietary data.";
    const firstRound = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest,
      retrievedAt: "2026-07-29T12:01:00Z",
      proposals: [
        findProposal(
          "threshold-round-one",
          "National threshold disclosure rule",
        ),
      ],
      criteria: [
        criterion(
          "prefer-threshold",
          "prefer",
          "threshold-based national policy",
          exactRequest,
        ),
        criterion(
          "avoid-proprietary",
          "avoid",
          "proprietary data",
          exactRequest,
        ),
      ],
      interpretationSource: "researcher-structured",
    });
    const rejectedId = firstRound.items.find(
      (item) => item.id === "threshold-round-one",
    )!.id;
    const rejected = rejectScreen02Item(
      firstRound,
      rejectedId,
      "This option does not match the mechanism I want to study.",
    );
    const secondRound = applyScreen02SearchRound(rejected, {
      expectedRevision: rejected.revision,
      requestType: "find-more",
      exactRequest: "Find more options under those same criteria.",
      retrievedAt: "2026-07-29T12:02:00Z",
      proposals: [
        findProposal(
          "threshold-round-two",
          "National threshold reporting mandate",
        ),
      ],
    });

    for (const session of [initial, firstRound, rejected, secondRound]) {
      expect(
        serializeScreen01StudyContext(session.screen01Baseline),
      ).toBe(baselineJson);
      expect(session.screen01Fingerprint).toBe(
        initial.screen01Fingerprint,
      );
    }
    expect(secondRound.interaction.searchRounds).toHaveLength(3);
    expect(
      secondRound.interaction.searchRounds.map(
        (round) => round.requestType,
      ),
    ).toEqual(["initial", "refine", "find-more"]);
    expect(secondRound.interaction.preferences.criteria).toHaveLength(2);
    expect(secondRound.interaction.preferences.requests).toEqual([
      expect.objectContaining({
        exactText: exactRequest,
        interpretationSource: "researcher-structured",
      }),
    ]);
    expect(secondRound.interaction.rejections).toEqual([
      expect.objectContaining({
        itemId: rejectedId,
        source: "researcher",
      }),
    ]);
    expect(secondRound.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        rejectedId,
        "threshold-round-one",
        "threshold-round-two",
      ]),
    );
  });

  it("treats each search response as the complete current result set while retaining an audit ledger", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const firstRequest = "Rank energy-sector events higher.";
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest: firstRequest,
      retrievedAt: "2026-07-29T12:02:10Z",
      proposals: [
        findProposal("first-energy", "Energy sector reporting rule"),
        findProposal("first-general", "General reporting rule"),
      ],
      criteria: [
        criterion(
          "prefer-energy-first",
          "prefer",
          "energy sector",
          firstRequest,
        ),
      ],
    });
    const firstRound = first.interaction.searchRounds.at(-1)!;
    expect(firstRound.preferenceCriteriaIds).toEqual([
      "prefer-energy-first",
    ]);
    expect(firstRound.itemIdsRetained).toEqual(
      firstRound.discovery.rankings.map((ranking) => ranking.proposalId),
    );

    const reviewed = selectScreen02Item(
      first,
      firstRound.itemIdsRetained[0]!,
    );
    const second = applyScreen02SearchRound(reviewed, {
      expectedRevision: reviewed.revision,
      requestType: "find-more",
      exactRequest: "Search again with no optional refinements.",
      retrievedAt: "2026-07-29T12:02:20Z",
      proposals: [
        findProposal("second-only", "Second-round disclosure rule"),
      ],
      criteria: [],
    });
    const secondRound = second.interaction.searchRounds.at(-1)!;
    expect(secondRound.preferenceCriteriaIds).toEqual([]);
    expect(secondRound.itemIdsRetained).toEqual(["second-only"]);
    expect(second.interaction.preferenceAssessments).toEqual([]);
    expect(second.selectedItemId).toBeNull();
    expect(second.interaction.selectionHistory.at(-1)).toMatchObject({
      action: "cleared",
      reason:
        "The prior selection is not present in the newest Screen 2 result set.",
    });
    expect(second.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "first-energy",
        "first-general",
        "second-only",
      ]),
    );

    const empty = applyScreen02SearchRound(second, {
      expectedRevision: second.revision,
      requestType: "find-more",
      exactRequest: "No eligible candidates were found.",
      retrievedAt: "2026-07-29T12:02:30Z",
      proposals: [],
      criteria: [],
    });
    expect(
      empty.interaction.searchRounds.at(-1)?.itemIdsRetained,
    ).toEqual([]);
    expect(empty.items.length).toBeGreaterThan(0);
    expect(restoreScreen02Session(clone(empty))).not.toBeNull();
  });

  it("limits none-fit rejection to the immediately visible result set", () => {
    const datedProposal = (id: string, eventDate: string) => {
      const proposal = findProposal(id);
      proposal.event.eventDate = eventDate;
      proposal.provisionalDates = [eventDate];
      proposal.sources[0]!.publishedDate = eventDate;
      return proposal;
    };
    const initial = createScreen02Session(confirmedFindContext());
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Run the first search.",
      retrievedAt: "2026-07-29T12:02:31Z",
      proposals: [
        datedProposal("earlier-one", "2018-01-01"),
        datedProposal("earlier-two", "2018-06-01"),
      ],
    });
    const second = applyScreen02SearchRound(first, {
      expectedRevision: first.revision,
      requestType: "find-more",
      exactRequest: "Run the second search.",
      retrievedAt: "2026-07-29T12:02:32Z",
      proposals: [
        datedProposal("current-one", "2019-01-01"),
        datedProposal("current-two", "2019-06-01"),
      ],
    });
    const rejected = applyScreen02SearchRound(second, {
      expectedRevision: second.revision,
      requestType: "none-fit",
      exactRequest: "None of the current shocks fit.",
      retrievedAt: "2026-07-29T12:02:33Z",
      proposals: [],
    });

    expect(
      rejected.interaction.rejections.map(
        (rejection) => rejection.itemId,
      ).sort(),
    ).toEqual(["current-one", "current-two"]);
    const rediscovered = applyScreen02SearchRound(rejected, {
      expectedRevision: rejected.revision,
      requestType: "find-more",
      exactRequest: "Rediscover an earlier candidate.",
      retrievedAt: "2026-07-29T12:02:34Z",
      proposals: [datedProposal("earlier-one", "2018-01-01")],
    });
    expect(
      rediscovered.interaction.searchRounds.at(-1)?.itemIdsRetained,
    ).toEqual(["earlier-one"]);
  });

  it("preserves the host model's explicit candidate order after semantic interpretation", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const exactRequest = "Rank energy-sector events higher.";
    const proposals = [
      findProposal(
        "z-ai-first-general",
        "General reporting rule selected first by the semantic review",
      ),
      findProposal(
        "a-ai-second-energy",
        "Energy sector reporting rule selected second by the semantic review",
      ),
    ];
    const preference = criterion(
      "prefer-energy-ai-order",
      "prefer",
      "energy sector",
      exactRequest,
    );
    const native = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest,
      retrievedAt: "2026-07-29T12:02:34Z",
      proposals,
      criteria: [preference],
      interpretationSource: "researcher-structured",
      stage: "native-retrieval",
    });
    const reviewed = applyScreen02SearchRound(native, {
      expectedRevision: native.revision,
      requestType: "refine",
      exactRequest: "Apply the comparative AI ordering.",
      retrievedAt: "2026-07-29T12:02:35Z",
      interpretationSource: "ai-interpretation",
      stage: "ai-review",
      parentRoundId: native.interaction.searchRounds.at(-1)!.id,
      proposals,
      semanticDecisions: proposals.map((proposal) =>
        retainedDecisionForFindProposal(proposal),
      ),
    });
    const round = reviewed.interaction.searchRounds.at(-1)!;

    expect(round.itemIdsRetained).toEqual([
      "z-ai-first-general",
      "a-ai-second-energy",
    ]);
    expect(
      round.discovery.rankings.map((ranking) => ranking.proposalId),
    ).toEqual(["z-ai-first-general", "a-ai-second-energy"]);
  });

  it("hard-excludes only direct do-not-show matches and leaves negated language for semantic clarification", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const directRequest = "Do not show finance sector shocks.";
    const direct = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest: directRequest,
      retrievedAt: "2026-07-29T12:02:40Z",
      proposals: [
        {
          ...findProposal(
            "finance-direct",
            "Finance sector taxation mandate",
          ),
          description:
            "A capital-markets tax mandate with a documented implementation date.",
          provisionalDates: ["2018-01-01"],
          event: {
            displayName: "Finance sector taxation mandate",
            eventDate: "2018-01-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [
              "U.S. exchange-listed manufacturing firms",
            ],
          },
        },
        {
          ...findProposal(
            "energy-direct",
            "Energy production emergency order",
          ),
          description:
            "An energy-production order with a documented implementation date.",
          provisionalDates: ["2021-01-01"],
          event: {
            displayName: "Energy production emergency order",
            eventDate: "2021-01-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [
              "U.S. exchange-listed manufacturing firms",
            ],
          },
        },
      ],
      criteria: [
        criterion(
          "avoid-finance-direct",
          "avoid",
          "finance sector",
          directRequest,
        ),
      ],
    });
    expect(
      direct.interaction.searchRounds.at(-1)?.itemIdsRetained,
    ).toEqual(["energy-direct"]);
    expect(
      direct.interaction.searchRounds
        .at(-1)
        ?.manifest.exclusions.some(
          (entry) =>
            entry.proposalId === "finance-direct" &&
            entry.reason.includes("explicit do-not-show criterion"),
        ),
    ).toBe(true);

    const ambiguousRequest =
      "Avoid non-financial-related shocks.";
    const ambiguous = applyScreen02SearchRound(direct, {
      expectedRevision: direct.revision,
      requestType: "refine",
      exactRequest: ambiguousRequest,
      retrievedAt: "2026-07-29T12:02:50Z",
      proposals: [
        {
          ...findProposal(
            "finance-ambiguous",
            "Financial institution solvency directive",
          ),
          description:
            "A bank-solvency directive with a documented compliance date.",
          provisionalDates: ["2022-01-01"],
          event: {
            displayName:
              "Financial institution solvency directive",
            eventDate: "2022-01-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [
              "U.S. exchange-listed manufacturing firms",
            ],
          },
        },
      ],
      criteria: [
        criterion(
          "avoid-negated-ambiguous",
          "avoid",
          "non-financial-related shock",
          ambiguousRequest,
        ),
      ],
    });
    expect(
      ambiguous.interaction.searchRounds.at(-1)?.itemIdsRetained,
    ).toEqual(["finance-ambiguous"]);
    expect(
      ambiguous.interaction.preferenceAssessments[0]?.reasons.some(
        (reason) => reason.includes("left it unevaluated"),
      ),
    ).toBe(true);
  });

  it("rejects a stale search response before it can overwrite newer state", () => {
    const initial = createScreen02Session(confirmedFindContext());

    expect(() =>
      applyScreen02SearchRound(initial, {
        expectedRevision: initial.revision + 1,
        requestType: "find-more",
        exactRequest: "This response was generated from stale state.",
        retrievedAt: "2026-07-29T12:03:00Z",
        proposals: [findProposal("stale-response")],
      }),
    ).toThrow(
      `Stale Screen 2 response: expected revision ${initial.revision}, received ${initial.revision + 1}.`,
    );
  });

  it("keeps selection tentative until explicit lock and blocks refresh or late responses after lock", () => {
    const initial = findSessionWithResult("lockable-result");
    const selected = selectScreen02Item(initial, initial.items[0]!.id);

    expect(selected.selectedItemId).toBe(initial.items[0]!.id);
    expect(selected.lockedChoice).toBeNull();
    expect(
      selected.interaction.selectionHistory.at(-1)?.action,
    ).toBe("selected");

    const locked = lockScreen02Choice(selected);
    expect(locked.lockedChoice).toMatchObject({
      status: "locked",
      itemId: selected.selectedItemId,
      mode: "find",
      knownShockAnchor: null,
      primaryRepresentationType: null,
      primaryConstruct: null,
      baselineFingerprint: initial.screen01Fingerprint,
      downstreamStatus: "screen-03-ready",
    });
    expect(
      locked.interaction.selectionHistory.at(-1)?.action,
    ).toBe("locked");

    expect(() =>
      applyScreen02SearchRound(locked, {
        expectedRevision: locked.revision,
        requestType: "find-more",
        exactRequest: "A late response that must not replace the lock.",
        retrievedAt: "2026-07-29T12:04:00Z",
        proposals: [findProposal("late-response")],
      }),
    ).toThrow(
      "The shock is locked. Unlock it before requesting another Screen 2 search round.",
    );
  });

  it("requires a real located source before an option can be locked", () => {
    const initial = createScreen02Session(confirmedAuditContext());
    const sourceFree = {
      ...auditProposal(),
      id: "audit-source-free-event-match",
      representationType: "whole-package" as const,
      title: "California Consumer Privacy Act",
      candidateConstruct:
        "California Consumer Privacy Act unresolved event identity",
      operationalization:
        "Locate and verify a controlling source before Screen 3.",
      origin: "unsupported-lead" as const,
      sources: [],
      assessments: undefined,
    };
    const searched = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Resolve the named shock without inventing evidence.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [sourceFree],
    });
    const selected = selectScreen02Item(
      searched,
      sourceFree.id,
    );

    expect(selected.lockedChoice).toBeNull();
    expect(() => lockScreen02Choice(selected)).toThrow(
      "This option cannot be locked until at least one non-fictional source is located and the option passes the Screen 2 gate.",
    );
  });

  it("hands a source-backed lead to Screen 3 with unknown methods as verification work", () => {
    const proposal = {
      ...findProposal("reconnaissance-lead"),
      likelyServiceLevel: "event-reconnaissance" as const,
      assessments: undefined,
      outcomeLink: {
        text: "A preliminary mechanism must be verified in Screen 3.",
        status: "system-template" as const,
      },
    };
    const searched = applyScreen02SearchRound(
      createScreen02Session(confirmedFindContext()),
      {
        expectedRevision: 0,
        requestType: "find-more",
        stage: "native-retrieval",
        exactRequest: "Find a source-backed native lead.",
        retrievedAt: "2026-07-29T12:03:30Z",
        proposals: [proposal],
      },
    );
    const item = searched.items.find(
      (candidate) => candidate.id === proposal.id,
    );
    if (!item) throw new Error("Expected the reconnaissance lead.");

    expect(item.sourceSummary.uniqueSourceCount).toBe(1);
    expect(item.evidenceStatus).not.toBe("complete");
    const locked = lockScreen02Choice(
      selectScreen02Item(searched, item.id),
    );
    expect(locked.lockedChoice?.itemId).toBe(item.id);
  });

  it("records a researcher override when strict native criteria remain unverified", () => {
    const exactRequest = "Only include actions with a binding threshold.";
    const searched = applyScreen02SearchRound(
      createScreen02Session(confirmedFindContext()),
      {
        expectedRevision: 0,
        requestType: "refine",
        stage: "native-retrieval",
        exactRequest,
        retrievedAt: "2026-07-29T12:03:45Z",
        proposals: [findProposal("strict-override")],
        criteria: [
          criterion(
            "require-binding-threshold",
            "require",
            "binding threshold",
            exactRequest,
          ),
        ],
        interpretationSource: "researcher-structured",
      },
    );
    const locked = lockScreen02Choice(
      selectScreen02Item(searched, "strict-override"),
    );

    expect(
      locked.interaction.selectionHistory.at(-1)?.reason,
    ).toContain("overriding unverified strict criteria");
    expect(
      locked.interaction.selectionHistory.at(-1)?.reason,
    ).toContain("require-binding-threshold");
  });

  it("increments downstream invalidation when an explicit lock is reopened", () => {
    const initial = findSessionWithResult("unlockable-result");
    const locked = lockScreen02Choice(
      selectScreen02Item(initial, initial.items[0]!.id),
    );
    const unlocked = unlockScreen02Choice(
      locked,
      "The researcher wants to compare one additional option.",
    );

    expect(unlocked.lockedChoice).toBeNull();
    expect(unlocked.selectedItemId).toBe(locked.selectedItemId);
    expect(unlocked.revision).toBe(locked.revision + 1);
    expect(unlocked.interaction.downstreamInvalidationCount).toBe(
      locked.interaction.downstreamInvalidationCount + 1,
    );
    expect(
      unlocked.interaction.selectionHistory.at(-1),
    ).toMatchObject({
      action: "unlocked",
      itemId: locked.selectedItemId,
    });
  });

  it("locks the exact named Audit shock while keeping its primary representation provisional", () => {
    const initial = createScreen02Session(confirmedAuditContext());
    const sourced = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "user-source",
      exactRequest:
        "Use this official source to assess formal CCPA eligibility.",
      retrievedAt: "2026-07-29T12:05:00Z",
      proposals: [auditProposal()],
    });
    const representation = sourced.items.find(
      (item) =>
        item.mode === "audit" &&
        item.representationType === "formal-eligibility",
    );
    if (!representation || representation.mode !== "audit") {
      throw new Error("Source-backed Audit representation was not retained.");
    }

    expect(representation.provisional).toBe(true);
    const locked = lockScreen02Choice(
      selectScreen02Item(sourced, representation.id),
    );

    expect(locked.lockedChoice).toMatchObject({
      mode: "audit",
      shockName: "California Consumer Privacy Act",
      knownShockAnchor: "California Consumer Privacy Act",
      primaryRepresentationType: "formal-eligibility",
      primaryConstruct:
        "California Consumer Privacy Act formal eligibility",
      downstreamStatus: "screen-03-ready",
    });
    expect(locked.screen01Baseline.knownShock).toBe(
      "California Consumer Privacy Act",
    );
    expect(
      locked.items.find(
        (item) => item.id === locked.lockedChoice?.itemId,
      )?.provisional,
    ).toBe(true);
  });

  it("retains distinct representations inside the same Audit family across rounds", () => {
    const initial = createScreen02Session(confirmedAuditContext());
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Assess formal statutory eligibility.",
      retrievedAt: "2026-07-29T12:10:00Z",
      proposals: [auditProposal()],
    });
    const thresholdSource = officialSource("ccpa-threshold-source");
    const thresholdProposal: Screen02AuditProposal = {
      ...auditProposal(),
      id: "ccpa-historical-threshold",
      title: "CCPA historical revenue-threshold eligibility",
      candidateConstruct:
        "California Consumer Privacy Act historical revenue-threshold eligibility",
      operationalization:
        "An indicator based on the source-verified historical revenue threshold.",
      sources: [thresholdSource],
      assessments: {
        exposureObservability: {
          category: "observable-with-linkage",
          reason:
            "The historical threshold appears linkable to firm financial records.",
          evidenceSourceIds: [thresholdSource.id],
          method: "ai-rubric",
        },
        variation: {
          category: "usable",
          reason:
            "The historical threshold implies a distinct assignment contrast.",
          evidenceSourceIds: [thresholdSource.id],
          method: "ai-rubric",
        },
      },
    };
    const second = applyScreen02SearchRound(first, {
      expectedRevision: first.revision,
      requestType: "find-more",
      exactRequest:
        "Find another formal representation using historical thresholds.",
      retrievedAt: "2026-07-29T12:15:00Z",
      proposals: [thresholdProposal],
    });

    const formalRepresentations = second.items.filter(
      (item) =>
        item.mode === "audit" &&
        item.representationType === "formal-eligibility",
    );
    expect(formalRepresentations).toHaveLength(2);
    expect(
      formalRepresentations.map((item) =>
        item.mode === "audit" ? item.candidateConstruct : "",
      ),
    ).toContain(
      "California Consumer Privacy Act historical revenue-threshold eligibility",
    );
  });

  it("uses the same fuzzy consolidation rule within and across rounds", () => {
    const initial = findSessionWithResult("history-result");
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Assess the full event name.",
      retrievedAt: "2026-07-29T12:20:00Z",
      proposals: [
        findProposal(
          "ncta-long",
          "National Corporate Transparency Act",
        ),
      ],
    });
    const second = applyScreen02SearchRound(first, {
      expectedRevision: first.revision,
      requestType: "find-more",
      exactRequest: "Assess the acronym-bearing event name.",
      retrievedAt: "2026-07-29T12:21:00Z",
      proposals: [
        findProposal(
          "ncta-short",
          "National Corporate Transparency Act (NCTA)",
        ),
      ],
    });

    expect(
      second.items.filter((item) =>
        item.title.includes("National Corporate Transparency Act"),
      ),
    ).toHaveLength(1);
    expect(
      second.interaction.searchRounds.at(-1)?.duplicateProposalIds,
    ).toContain("ncta-short");
  });

  it("rejects raw proposal overflow and cross-round id reuse", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const duplicates = Array.from({ length: 41 }, (_, index) =>
      findProposal(`duplicate-${index}`, "Same Federal Rule"),
    );
    expect(() =>
      applyScreen02SearchRound(initial, {
        expectedRevision: initial.revision,
        requestType: "find-more",
        exactRequest: "A caller supplied too many duplicate records.",
        retrievedAt: "2026-07-29T12:22:00Z",
        proposals: duplicates,
      }),
    ).toThrow("at most 40 raw proposals per search round");

    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Assess the first event.",
      retrievedAt: "2026-07-29T12:23:00Z",
      proposals: [
        findProposal("reused-proposal-id", "National Disclosure Rule"),
      ],
    });
    expect(() =>
      applyScreen02SearchRound(first, {
        expectedRevision: first.revision,
        requestType: "find-more",
        exactRequest: "A distinct event reused the same id.",
        retrievedAt: "2026-07-29T12:24:00Z",
        proposals: [
          findProposal(
            "reused-proposal-id",
            "Federal Industrial Energy Standard",
          ),
        ],
      }),
    ).toThrow("was already assigned to a different candidate");
  });

  it("preserves immutable assessed and active card versions across merges", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const eventName = "National Evidence Preservation Rule";
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Assess the first source.",
      retrievedAt: "2026-07-29T12:25:00Z",
      proposals: [findProposal("version-one", eventName)],
    });
    const firstRound = first.interaction.searchRounds.at(-1)!;
    const firstActiveVersionId =
      firstRound.activeItemVersionIds.find((versionId) => {
        const version = first.interaction.itemVersions.find(
          (entry) => entry.versionId === versionId,
        );
        return version?.item.id === "version-one";
      });
    const firstSnapshot = first.interaction.itemVersions.find(
      (version) => version.versionId === firstActiveVersionId,
    );
    expect(firstSnapshot?.item.sources).toHaveLength(1);

    const second = applyScreen02SearchRound(first, {
      expectedRevision: first.revision,
      requestType: "find-more",
      exactRequest: "Assess a second source for the same event.",
      retrievedAt: "2026-07-29T12:26:00Z",
      proposals: [findProposal("version-two", `${eventName} (NEPR)`)],
    });
    const current = second.items.find(
      (item) => item.id === "version-one",
    );
    expect(current?.sources).toHaveLength(2);
    expect(
      second.interaction.itemVersions.find(
        (version) => version.versionId === firstActiveVersionId,
      ),
    ).toStrictEqual(firstSnapshot);
    expect(
      second.interaction.searchRounds[1]?.activeItemVersionIds,
    ).toContain(firstActiveVersionId);
    expect(
      second.interaction.searchRounds.at(-1)?.activeItemVersionIds,
    ).not.toContain(firstActiveVersionId);
    expect(restoreScreen02Session(clone(second))).not.toBeNull();
  });

  it("enforces cumulative history bounds before returning a session", () => {
    const initial = findSessionWithResult("history-bound-result");
    let withQuestions = initial;
    for (let round = 1; round <= 3; round += 1) {
      withQuestions = applyScreen02SearchRound(withQuestions, {
        expectedRevision: withQuestions.revision,
        requestType: "find-more",
        exactRequest: `Defer Screen 3 questions in round ${round}.`,
        retrievedAt: `2026-07-29T12:3${round}:00Z`,
        proposals: [],
        deferredQuestions: Array.from(
          { length: 30 },
          (_, index) => ({
            exactRequest: `Question ${round}-${index}?`,
            reason: "Exact event details belong in Screen 3.",
          }),
        ),
      });
    }
    expect(() =>
      applyScreen02SearchRound(withQuestions, {
        expectedRevision: withQuestions.revision,
        requestType: "find-more",
        exactRequest: "This batch would exceed the cumulative bound.",
        retrievedAt: "2026-07-29T12:34:00Z",
        proposals: [],
        deferredQuestions: Array.from(
          { length: 30 },
          (_, index) => ({
            exactRequest: `Overflow question ${index}?`,
            reason: "Exact event details belong in Screen 3.",
          }),
        ),
      }),
    ).toThrow("cannot retain more than 100 deferred");

    let selected = initial;
    for (let index = 0; index < 100; index += 1) {
      selected = selectScreen02Item(selected, selected.items[0]!.id);
    }
    expect(restoreScreen02Session(clone(selected))).not.toBeNull();
    expect(() =>
      selectScreen02Item(selected, selected.items[0]!.id),
    ).toThrow("selection history has reached its limit");
  });

  it("rejects preference assessments that cite nonexistent criteria", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const refined = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest: "Prefer threshold rules.",
      retrievedAt: "2026-07-29T12:40:00Z",
      proposals: [findProposal("assessment-integrity")],
      criteria: [
        criterion(
          "prefer-threshold-integrity",
          "prefer",
          "threshold rule",
          "Prefer threshold rules.",
        ),
      ],
    });
    const forged = clone(refined);
    forged.interaction.preferenceAssessments[0]!.matchedCriteriaIds = [
      "criterion-does-not-exist",
    ];
    expect(restoreScreen02Session(forged)).toBeNull();
  });

  it("rejects unknown top-level, interaction, nested-history, and lock fields on restoration", () => {
    const initial = findSessionWithResult("strict-field-result");
    const locked = lockScreen02Choice(
      selectScreen02Item(initial, initial.items[0]!.id),
    );

    const extraSession = clone(locked) as typeof locked & {
      injected?: string;
    };
    extraSession.injected = "unknown";
    expect(restoreScreen02Session(extraSession)).toBeNull();

    const extraInteraction = clone(locked) as typeof locked & {
      interaction: typeof locked.interaction & { injected?: string };
    };
    extraInteraction.interaction.injected = "unknown";
    expect(restoreScreen02Session(extraInteraction)).toBeNull();

    const extraRound = clone(locked) as typeof locked & {
      interaction: typeof locked.interaction & {
        searchRounds: Array<
          (typeof locked.interaction.searchRounds)[number] & {
            injected?: string;
          }
        >;
      };
    };
    extraRound.interaction.searchRounds[0]!.injected = "unknown";
    expect(restoreScreen02Session(extraRound)).toBeNull();

    const extraLock = clone(locked) as typeof locked & {
      lockedChoice: NonNullable<typeof locked.lockedChoice> & {
        injected?: string;
      };
    };
    extraLock.lockedChoice.injected = "unknown";
    expect(restoreScreen02Session(extraLock)).toBeNull();
  });
});
