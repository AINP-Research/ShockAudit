import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { screen02AssessmentUnavailableScreen03Checks } from "../../src/core/screen02-workflow-types";
import type { Screen03BriefingLifecycle } from "../../src/core/screen03-briefing";
import {
  fingerprintScreen03ProposalForInterpretation,
  type Screen03Proposal,
  type Screen03TimelineProposal,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import Screen03 from "../../src/ui/screen-03/Screen03";

const at = "2026-08-12T18:00:00.000Z";

function proposal(
  id: string,
  group: Screen03Proposal["group"],
  label: string,
  value: string,
): Screen03Proposal {
  return {
    id,
    group,
    label,
    value,
    critical: true,
    reviewStatus: "accepted",
    editedValue: null,
    support: "direct",
    sourceIds: ["evidence-1"],
    passageIds: ["passage-1"],
    uncertainty: null,
  };
}

function timelineProposal(
  template: Screen03TimelineProposal,
  id: string,
  stage: Screen03TimelineProposal["stage"],
  date: string,
  label: string,
): Screen03TimelineProposal {
  return { ...template, id, stage, date, label, value: date };
}

function state(): Screen03VerificationState {
  return {
    schemaVersion: "screen-03-verification-state-v1",
    releaseLabel: "v0.3.13",
    status: "reviewing",
    runId: "screen03-render-run",
    revision: 3,
    createdAt: at,
    updatedAt: at,
    upstream: {
      schemaVersion: "screen-02-to-screen-03-event-v4",
      runId: "screen02-render-run",
      eventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    eventIdentity: {
      canonicalTitle: "Illustrative Clean Manufacturing Rule",
      commonNames: ["ICMR"],
      formalIdentifier: "Rule 42",
      issuer: "Illustrative Standards Agency",
      issuingJurisdiction: "Exampleland",
      eventType: "regulation",
      status: "in force",
    },
    researchCoverage: {
      status: "completed",
      queries: [
        {
          id: "query-1",
          query: "Rule 42 effective date amendment",
          purpose: "Find operative timing and later changes.",
          returnedEvidenceIds: ["evidence-1"],
        },
      ],
      channels: [
        {
          channel: "official-register",
          status: "searched",
          note: "Operative record retrieved.",
          retrievedAt: at,
        },
      ],
      routes: ["exact identifier", "stage-specific follow-up"],
      stages: ["enactment", "effective", "amendment"],
      languages: ["English"],
      authorityTiers: [1],
      gaps: ["No prepublication consultation record was retrieved."],
      recordsReviewed: 4,
      activeEvidenceCount: 1,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after operative text and timing records are passage-linked.",
        status: "met",
        note: "All declared critical stages have primary support.",
      },
      outcomeValuesInspected: false,
    },
    evidence: [
      {
        id: "evidence-1",
        sourceId: "source-1",
        title: "Illustrative Rule 42 — Official Record",
        locator: "https://example.test/rule-42",
        publisher: "Illustrative Standards Agency",
        publishedDate: "2024-01-10",
        retrievedAt: at,
        authorityTier: 1,
        channel: "official-register · source role: official record",
        contentFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        language: "English",
        status: "retrieved",
        passages: [
          {
            id: "passage-1",
            number: 1,
            text: [
              "Rule 42 issued by the Illustrative Standards Agency.",
              "The reporting standard changed for covered plants.",
              "Covered plants use the revised reporting standard.",
              "Plants meeting the rule's stated coverage definition.",
              "No source-supported delay was found in the bounded record set.",
              "The rule applies from 1 July 2024.",
            ].join(" "),
            locator: "Section 8",
            basis: "source-excerpt",
          },
        ],
      },
    ],
    proposals: {
      identity: [
        proposal(
          "identity-1",
          "identity",
          "Formal identity",
          "Rule 42 issued by the Illustrative Standards Agency",
        ),
      ],
      overview: [
        proposal(
          "overview-1",
          "overview",
          "What changed",
          "The reporting standard changed for covered plants.",
        ),
      ],
      timeline: [
        {
          id: "timeline-1",
          group: "timeline",
          label: "Operative start",
          value: "2024-07-01",
          date: "2024-07-01",
          stage: "effective",
          critical: true,
          reviewStatus: "accepted",
          editedValue: null,
          support: "direct",
          sourceIds: ["evidence-1"],
          passageIds: ["passage-1"],
          uncertainty: null,
        },
      ],
      component: [
        proposal(
          "component-1",
          "component",
          "Reporting component",
          "Covered plants use the revised reporting standard.",
        ),
      ],
      eligibility: [
        proposal(
          "eligibility-1",
          "eligibility",
          "Covered unit",
          "Plants meeting the rule's stated coverage definition.",
        ),
      ],
      amendment: [
        proposal(
          "amendment-1",
          "amendment",
          "Later amendment",
          "No source-supported delay was found in the bounded record set.",
        ),
      ],
      requiredVariable: [
        proposal(
          "variable-1",
          "required-variable",
          "Coverage indicator",
          "Plant coverage under Rule 42 on each observation date.",
        ),
      ],
    },
    contradictions: [],
    focalClock: {
      selectedProposalId: "timeline-1",
      alternativeProposalIds: [],
    },
    history: [],
    lockedEventCard: null,
    outcomeValuesInspected: false,
    integrity: { stateFingerprint: "fnv1a64:3333333333333333" },
  };
}

function currentOrientationState(
  origin: "chatgpt-host" | "fixed-source-derived" = "fixed-source-derived",
) {
  const screenState = state();
  screenState.releaseLabel = "v0.3.17";
  const glance = {
    schemaVersion: "screen-02-shock-glance-v1" as const,
    runId: screenState.upstream.runId,
    candidateSnapshotId: "candidate-snapshot-1",
    candidateFingerprint: "fnv1a64:4444444444444444",
    selectedEventId: "selected-event-1",
    eventFingerprint: screenState.upstream.eventFingerprint,
    origin,
    summary:
      "Rule 42 changes reporting duties for covered manufacturing plants while exact coverage remains under review.",
    keyPoints: [
      "Covered plants use a revised reporting standard.",
      "The retained record identifies a new operative reporting duty.",
      "Later amendments remain part of the detailed evidence review.",
    ],
    whoIsAffected:
      "Manufacturing plants meeting the rule's broad coverage definition.",
    keyTiming: "The retained record identifies 1 July 2024 as an important date.",
    importantCaveat:
      "Exact thresholds, exemptions, operative dates, and later amendments require confirmation on Screen 3.",
    sourceIds: ["source-1"],
    createdAt: at,
    updatedAt: at,
  };
  screenState.orientation = {
    schemaVersion: "screen-03-orientation-state-v1",
    upstreamEventFingerprint: screenState.upstream.eventFingerprint,
    initial: { ...glance, keyPoints: [...glance.keyPoints], sourceIds: [...glance.sourceIds] },
    current: glance,
    provenance: "screen-02-preliminary",
    refinements: [],
  };
  return screenState;
}

function withWorkersInterpretation(
  screenState: Screen03VerificationState,
): Screen03VerificationState {
  const cardProposals = [
    ...screenState.proposals.identity,
    ...screenState.proposals.overview,
    ...screenState.proposals.timeline,
    ...screenState.proposals.component,
    ...screenState.proposals.eligibility,
    ...screenState.proposals.amendment,
  ];
  screenState.interpretation = {
    protocolVersion: "screen-03-interpretation-v1",
    origin: "workers-ai",
    nonCanonical: true,
    studyContext: {
      population: "Publicly listed companies",
      geography: "California",
      industry: "Consumer-facing industries",
      studyPeriod: "2018–2024",
      outcomeFamily: "Profitability",
    },
    snapshot: {
      intro: {
        text:
          "The California Consumer Privacy Act gives California residents practical control over personal information held by businesses.",
        proposalIds: ["component-1", "overview-1"],
        passageIds: ["passage-1", "passage-2"],
        evidenceIds: ["evidence-1", "evidence-2"],
      },
      keyPoints: [
        {
          text: "People can ask what personal information a business collects and how it uses or shares that information.",
          proposalIds: ["component-1"],
          passageIds: ["passage-1"],
          evidenceIds: ["evidence-1", "evidence-2"],
        },
        {
          text: "People can request access to or deletion of covered personal information.",
          proposalIds: ["component-1"],
          passageIds: ["passage-1", "passage-2"],
          evidenceIds: ["evidence-1", "evidence-2"],
        },
        {
          text: "People can opt out of certain sales or sharing of their personal information.",
          proposalIds: ["overview-1"],
          passageIds: ["passage-2"],
          evidenceIds: ["evidence-2"],
        },
        {
          text: "Businesses may not discriminate against people for exercising these privacy rights.",
          proposalIds: ["eligibility-1"],
          passageIds: ["passage-2"],
          evidenceIds: ["evidence-2"],
        },
      ],
    },
    studyRelevance: {
      sampleConnection: {
        text: "California-facing public companies may differ in whether the Act applies, so business coverage can help define the treated sample without assuming every company is exposed.",
        proposalIds: ["eligibility-1"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
      outcomeConnection: {
        text: "Privacy-request operations and limits on data practices could change compliance costs or revenue channels, making profitability a plausible outcome to investigate.",
        proposalIds: ["component-1", "overview-1"],
        passageIds: ["passage-1", "passage-2"],
        evidenceIds: ["evidence-1", "evidence-2"],
      },
      caveat:
        "This interpretation does not establish exposure, a causal mechanism, effect direction, or effect size.",
    },
    claimExplanations: cardProposals.map((item) => ({
      proposalId: item.id,
      proposalFingerprint: fingerprintScreen03ProposalForInterpretation(item),
      text: item.id === "component-1"
        ? "A business must let a consumer submit a verifiable privacy request without first making an account."
        : `In practical terms, this claim describes ${item.label.toLocaleLowerCase("en-US")}.`,
      passageIds: ["passage-1"],
      evidenceIds: ["evidence-1"],
    })),
    limitations: [
      "The explanation does not determine organization-level coverage.",
    ],
    outcomeValuesInspected: false,
  };
  return screenState;
}

function ccpaState(): Screen03VerificationState {
  const screenState = state();
  screenState.eventIdentity.canonicalTitle =
    "California Consumer Privacy Act";
  screenState.eventIdentity.commonNames = ["CCPA"];
  screenState.eventIdentity.formalIdentifier = "Cal. Civ. Code § 1798.100 et seq.";
  screenState.eventIdentity.issuer = "California Legislature";
  screenState.eventIdentity.issuingJurisdiction = "California";
  screenState.evidence[0] = {
    ...screenState.evidence[0]!,
    title: "California Consumer Privacy Act — statutory text",
    locator: "https://leginfo.legislature.ca.gov/ccpa",
    publisher: "California Legislative Information",
    publishedDate: "2018-06-28",
    passages: [{
      ...screenState.evidence[0]!.passages[0]!,
      text: "The business shall not require the consumer to create an account with the business in order to make a verifiable request.",
    }],
  };
  screenState.evidence.push({
    ...screenState.evidence[0],
    id: "evidence-2",
    sourceId: "source-2",
    title: "California Consumer Privacy Act overview",
    locator: "https://oag.ca.gov/privacy/ccpa",
    publisher: "California Department of Justice",
    publishedDate: "2024-03-13",
    contentFingerprint:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    channel: "official-guidance · source role: explanatory official guidance",
    passages: [{
      id: "passage-2",
      number: 2,
      text: "Consumers have rights to know, delete, opt out, correct, limit, and receive equal treatment.",
      locator: "Consumer rights overview",
      basis: "source-excerpt",
    }],
  });
  screenState.researchCoverage.activeEvidenceCount = 2;
  screenState.proposals.component[0]!.value =
    "The business shall not require the consumer to create an account with the business in order to make a verifiable request.";
  screenState.proposals.overview[0]!.value =
    "Consumers may exercise access, deletion, and opt-out rights.";
  screenState.proposals.eligibility[0]!.value =
    "The Act applies to businesses meeting its statutory coverage conditions.";
  screenState.proposals.identity[0]!.value =
    "The California Consumer Privacy Act is a California privacy law.";
  screenState.evidence[0]!.passages[0]!.text = [
    "The business shall not require the consumer to create an account with the business in order to make a verifiable request.",
    screenState.proposals.identity[0]!.value,
    screenState.proposals.overview[0]!.value,
    screenState.proposals.eligibility[0]!.value,
    screenState.proposals.amendment[0]!.value,
    "The record applies from 1 July 2024.",
  ].join(" ");
  return withWorkersInterpretation(screenState);
}

function withHostNativeBriefing(
  screenState: Screen03VerificationState,
): Screen03VerificationState {
  const content = {
    schemaVersion: "screen-03-host-briefing-content-v1" as const,
    briefingStatus: "evidence-insufficient" as const,
    title: "CCPA in plain language",
    oneSentenceSummary:
      "The CCPA gives California residents practical control over personal information held by covered businesses.",
    whatTheShockIs: "A California consumer privacy law.",
    whatChanged: "It added rights to know, delete, correct, limit, and opt out.",
    whyItMatters: "Covered businesses must change data practices and request handling.",
    whoIsAffected: "California consumers and covered for-profit businesses.",
    eligibilityThresholdsAndExemptions:
      "Coverage depends on statutory business thresholds and exemptions.",
    importantTimingAndTreatmentStages:
      "The law became operative in 2020 and later amendments have separate timing.",
    enforcementAndPenalties:
      "Regulators can enforce covered duties and statutory penalties.",
    laterChanges: "The CPRA later expanded the privacy regime.",
    plausiblePathwayToResearcherOutcome:
      "Compliance operations could change costs or revenue channels relevant to profitability.",
    unresolvedUncertainties: [
      "Material uncertainty remains across the bounded evidence.",
    ],
    acknowledgedMissingEvidenceIds: ["gap-coverage", "gap-amendments"],
    acknowledgedConflictIds: [],
    sectionEvidenceIds: {
      oneSentenceSummary: ["evidence-1", "evidence-2"],
      whatTheShockIs: ["evidence-1"],
      whatChanged: ["evidence-2"],
      whyItMatters: ["evidence-1"],
      whoIsAffected: ["evidence-2"],
      eligibilityThresholdsAndExemptions: ["evidence-1"],
      importantTimingAndTreatmentStages: ["evidence-1"],
      enforcementAndPenalties: ["evidence-1"],
      laterChanges: ["evidence-2"],
    },
    conciseRationale:
      "The briefing separates source-grounded facts from the outcome pathway hypothesis.",
    hostModel: "host_model_not_exposed",
  };
  const proposal = {
    schemaVersion: "screen-03-host-briefing-proposal-v1" as const,
    proposalId: "briefing-proposal-1",
    contentHash: `sha256:${"1".repeat(64)}`,
    content,
    provenance: {
      origin: "chatgpt_host" as const,
      briefingSchemaVersion: "screen-03-host-briefing-content-v1" as const,
      skillVersion: "screen3-shock-briefing-v1" as const,
      workflowVersion: "screen3-host-native-v1" as const,
      packetId: "briefing-packet-1",
      packetHash: `sha256:${"2".repeat(64)}`,
      eventFingerprint: screenState.upstream.eventFingerprint,
      sourceRevision: screenState.revision,
      sourceStateFingerprint: screenState.integrity.stateFingerprint,
      evidenceIds: ["evidence-1", "evidence-2"],
      uncertaintySnapshot: [
        {
          kind: "missing-evidence" as const,
          id: "gap-coverage",
          description: "Organization-level coverage still requires direct verification.",
        },
        {
          kind: "missing-evidence" as const,
          id: "gap-amendments",
          description: "The bounded packet does not exhaust every later amendment.",
        },
      ],
      generatedAt: at,
      hostModel: "host_model_not_exposed",
    },
  };
  screenState.briefing = {
    schemaVersion: "screen-03-host-briefing-lifecycle-v1",
    safeRunRef: `s3ref_${"A".repeat(43)}`,
    proposals: [proposal],
    decisions: [],
    activeProposalId: proposal.proposalId,
    confirmed: null,
    confirmedIsCurrent: false,
  } satisfies Screen03BriefingLifecycle;
  return screenState;
}

function render(
  screenState: Screen03VerificationState,
  errorMessage?: string,
  busy = false,
  researchBusy = false,
) {
  return renderToStaticMarkup(
    <Screen03
      state={screenState}
      busy={busy}
      researchBusy={researchBusy}
      errorMessage={errorMessage}
      onRetryResearch={vi.fn()}
      onFindDirectSupport={vi.fn()}
      onReviewField={vi.fn()}
      onReviewAll={vi.fn()}
      onLockEventCard={vi.fn()}
      onBack={vi.fn()}
    />,
  );
}

function buttonTag(html: string, testId: string) {
  return html.match(
    new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`),
  )?.[0] ?? "";
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

describe("Screen03", () => {
  it("renders the current saved orientation as an immediate compact accessible overview", () => {
    const html = renderToStaticMarkup(
      <Screen03
        state={currentOrientationState()}
        hostReasoningStatus="waiting"
        onRequestHostReasoning={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );

    expect(html).toContain(
      'aria-labelledby="s3-brief-title" data-testid="screen03-understand-shock"',
    );
    expect(brief).toContain("Brief overview");
    expect(brief).toContain('<h2 id="s3-brief-title">Understand this shock</h2>');
    expect(brief).toContain(
      '<h3 id="s3-orientation-event-title" class="s3-orientation__title">Illustrative Clean Manufacturing Rule</h3>',
    );
    expect(brief).toContain(
      "Manufacturing plants meeting the rule&#x27;s broad coverage definition.",
    );
    expect(brief).toContain(
      "Covered plants use a revised reporting standard.",
    );
    expect(visibleText(brief)).toMatch(
      /(?:What it does|What changed|What it did|Main effects|Key requirements)/u,
    );
    expect(brief).toContain('data-testid="screen03-orientation-key-points"');
    const keyPointList = brief.slice(
      brief.indexOf('data-testid="screen03-orientation-key-points"'),
      brief.indexOf("</ul>", brief.indexOf('data-testid="screen03-orientation-key-points"')),
    );
    const keyPointCount = keyPointList.match(/<li>/g)?.length ?? 0;
    expect(keyPointCount).toBeGreaterThanOrEqual(1);
    expect(keyPointCount).toBeLessThanOrEqual(5);
    expect(brief).not.toContain("Who is broadly affected");
    expect(brief).not.toContain("Important timing");
    expect(brief).not.toContain("Important caveat or later change");
    expect(brief).not.toContain("Main sources");
    expect(brief).not.toContain('href="https://example.test/rule-42"');
    expect(brief).not.toContain("s3-event-status");
    expect(brief).not.toContain(
      'data-testid="screen03-orientation-provenance"',
    );
    expect(brief).not.toContain("Preliminary Screen 2 overview");
    expect(brief).not.toContain(
      'data-testid="screen03-orientation-guardrail"',
    );
    expect(brief).not.toContain(
      "This orientation is not the verified Event Card.",
    );
    expect(brief).not.toContain("s3-orientation__details");
    expect(brief).not.toContain("s3-orientation__sources");
    expect(html).toContain('href="https://example.test/rule-42"');
    expect(html).toContain("Illustrative Rule 42 — Official Record");
    expect(brief).not.toContain('data-testid="screen03-request-host-reasoning"');
    expect(brief).not.toContain("Request sent to ChatGPT");
    expect(brief).not.toContain("s3-spinner");
    expect(brief).not.toContain("factual fallback");
    expect(brief).not.toContain("deterministic software");
  });

  it("keeps preliminary, qualified, and reviewed provenance internal", () => {
    const expectInternalProvenance = (brief: string) => {
      for (const label of [
        "ChatGPT-assisted",
        "source-derived",
        "Preliminary Screen 2 overview",
        "Preliminary qualified Screen 2 overview",
        "Researcher-reviewed orientation",
        "source-linked and noncanonical",
      ]) {
        expect(brief).not.toContain(label);
      }
      expect(brief).not.toContain(
        'data-testid="screen03-orientation-provenance"',
      );
    };

    const hostState = currentOrientationState("chatgpt-host");
    const hostAssisted = render(hostState);
    const hostBrief = hostAssisted.slice(
      hostAssisted.indexOf('data-testid="screen03-understand-shock"'),
      hostAssisted.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(hostState.orientation!.current.origin).toBe("chatgpt-host");
    expect(hostState.orientation!.provenance).toBe("screen-02-preliminary");
    expectInternalProvenance(hostBrief);

    const qualified = currentOrientationState("fixed-source-derived");
    qualified.orientation!.provenance = "screen-02-qualified-preliminary";
    const qualifiedHtml = render(qualified);
    const qualifiedBrief = qualifiedHtml.slice(
      qualifiedHtml.indexOf('data-testid="screen03-understand-shock"'),
      qualifiedHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(qualified.orientation!.provenance).toBe(
      "screen-02-qualified-preliminary",
    );
    expectInternalProvenance(qualifiedBrief);

    const refined = currentOrientationState("chatgpt-host");
    refined.orientation!.provenance = "screen-03-reviewed";
    refined.orientation!.refinements = [{
      id: "orientation-refinement-1",
      at,
      decision: "accept",
      proposalId: "overview-1",
      fieldsUsed: ["overview-1"],
      reason: "Researcher confirmed the directly supported overview.",
      previousGlanceFingerprint: "fnv1a64:5555555555555555",
      nextGlanceFingerprint: "fnv1a64:6666666666666666",
    }];
    const refinedHtml = render(refined);
    const refinedBrief = refinedHtml.slice(
      refinedHtml.indexOf('data-testid="screen03-understand-shock"'),
      refinedHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(refined.orientation!.provenance).toBe("screen-03-reviewed");
    expectInternalProvenance(refinedBrief);
    expect(refinedBrief).not.toContain("Updated from researcher-confirmed");
    expect(refinedBrief).toContain("Brief overview");
  });

  it("keeps workflow and research-method language out of the visible compact panel", () => {
    const operational = currentOrientationState();
    operational.evidence = operational.evidence.map((item) => ({
      ...item,
      passages: [],
    }));
    operational.orientation!.current = {
      ...operational.orientation!.current,
      summary:
        "Screen 2 records the formal identifier and event status for the selected event.",
      keyPoints: [
        "Screen 2 retains provisional timing leads for the study-relevant event clock.",
        "Possible exposure indicators do not establish exogeneity or a causal mechanism.",
        "Fixed software says this source-derived preliminary orientation does not establish realized effects.",
      ],
      whoIsAffected:
        "Screen 3 must verify the selected regulation before using the handoff.",
    };

    const html = render(operational);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    const text = visibleText(brief).toLocaleLowerCase("en-US");
    for (const excluded of [
      "screen 2 records",
      "screen 2 retains",
      "screen 3",
      "provisional timing leads",
      "formal identifier",
      "possible exposure indicators",
      "study-relevant event clock",
      "does not establish exogeneity",
      "causal mechanism",
      "realized effects",
      "fixed software",
      "source-derived preliminary orientation",
    ]) {
      expect(text).not.toContain(excluded);
    }
    expect(brief).toContain('data-testid="screen03-orientation-summary"');
    expect(brief).not.toContain('data-testid="screen03-orientation-key-points"');
    expect(brief).not.toContain("s3-orientation-points-title");
    expect(visibleText(brief)).toContain("ICMR is a regulation.");
    expect(brief).not.toContain("<li>");
  });

  it("keeps a saved v0.3.15 resource on the historical briefing path", () => {
    const historical = currentOrientationState();
    historical.releaseLabel = "v0.3.15";
    const html = renderToStaticMarkup(
      <Screen03
        state={historical}
        onRequestHostReasoning={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );

    expect(brief).not.toContain("Brief overview");
    expect(brief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(brief).toContain('data-testid="screen03-request-host-reasoning"');
  });

  it("presents CCPA as a short plain-language paragraph and five substantive rights and duties", () => {
    const ccpa = ccpaState();
    ccpa.releaseLabel = "v0.3.17";
    const baseOrientation = currentOrientationState().orientation!;
    const glance = {
      ...baseOrientation.current,
      summary:
        "The CCPA is a California privacy law that gives residents more control over how certain businesses collect, use, sell, and share their personal information.",
      keyPoints: [
        "Consumers can learn what personal information a business collects and shares.",
        "Consumers can request deletion of certain personal information.",
        "Consumers can opt out of certain sales or sharing.",
        "Covered businesses must provide privacy notices and respond to consumer requests.",
        "Later amendments expanded some consumer rights and business obligations.",
      ],
      whoIsAffected:
        "It applies to certain for-profit businesses doing business in California.",
      sourceIds: ["source-1", "source-2"],
    };
    ccpa.orientation = {
      ...baseOrientation,
      upstreamEventFingerprint: ccpa.upstream.eventFingerprint,
      initial: { ...glance, keyPoints: [...glance.keyPoints], sourceIds: [...glance.sourceIds] },
      current: glance,
    };

    const html = render(ccpa);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(brief).toContain("California Consumer Privacy Act");
    expect(brief).toContain(
      "The CCPA is a California privacy law that gives residents more control",
    );
    expect(brief).toContain("What it does");
    expect(brief).toContain(
      "Consumers can request deletion of certain personal information.",
    );
    expect(brief).toContain(
      "Covered businesses must provide privacy notices and respond to consumer requests.",
    );
    expect(brief.match(/<li>/gu)).toHaveLength(5);
    expect(brief).not.toContain("Cal. Civ. Code");
    expect(brief).not.toContain("California Legislative Information");
    expect(brief).not.toContain("California Department of Justice");
    expect(html).toContain("California Legislative Information");
    expect(html).toContain("California Department of Justice");
  });

  it("shows all six unavailable-assessment checks as separate nonblocking reminders", () => {
    const unavailable = state();
    unavailable.proposals.requiredVariable = [
      ...screen02AssessmentUnavailableScreen03Checks.map((value, index) => ({
        id: `carried:assessment-unavailable-check:${index + 1}`,
        group: "required-variable" as const,
        label: "Required assessment check",
        value,
        critical: true,
        reviewStatus: "proposed" as const,
        editedValue: null,
        support: "unsupported" as const,
        sourceIds: [],
        passageIds: [],
        uncertainty:
          "ChatGPT's preliminary assessment was unavailable on Screen 2; the researcher must mark this check Checked or Unresolved.",
      })),
      ...unavailable.proposals.requiredVariable.map((proposal) => ({
        ...proposal,
        critical: false,
      })),
    ];

    const pending = render(unavailable);
    expect(pending).toContain(
      "Additional checks to keep in mind",
    );
    expect(pending.match(/data-testid="screen03-assessment-check-\d+"/g))
      .toHaveLength(6);
    for (const check of screen02AssessmentUnavailableScreen03Checks) {
      expect(pending).toContain(check);
    }
    expect(pending).toContain(
      "These reminders were carried forward because the preliminary Screen 2 assessment was unavailable",
    );
    expect(pending).toContain(
      "They do not change the verified Event Card and do not block continuation.",
    );
    expect(buttonTag(pending, "screen03-save-event-card"))
      .not.toContain("disabled");
    expect(pending).not.toContain("screen03-assessment-check-1-checked");
    expect(pending).not.toContain("screen03-assessment-check-1-unresolved");
    expect(pending).toContain("Ready to save the verified Event Card");
    expect(pending).toContain('data-testid="screen03-actionability-variable-1"');
  });

  it("renders friendly ChatGPT-host create, refresh, and waiting states", () => {
    const host = ccpaState();
    host.interpretation!.origin = "chatgpt-host";
    const renderHost = (
      screenState: Screen03VerificationState,
      status: "complete" | "waiting" | "unavailable",
    ) =>
      renderToStaticMarkup(
        <Screen03
          state={screenState}
          hostReasoningStatus={status}
          onRequestHostReasoning={vi.fn()}
          onRetryResearch={vi.fn()}
          onReviewField={vi.fn()}
          onReviewAll={vi.fn()}
          onLockEventCard={vi.fn()}
          onBack={vi.fn()}
        />,
      );

    const complete = renderHost(host, "complete");
    expect(complete).toContain("ChatGPT-generated source-linked overview");
    expect(complete).toContain("Ask ChatGPT to prepare the shock briefing");
    expect(complete).toContain(
      "One visible turn requests the evidence packet, host reasoning, and a new result card; this earlier card remains a snapshot.",
    );

    const waiting = renderHost(state(), "waiting");
    expect(waiting).toContain("Request sent to ChatGPT…");
    expect(buttonTag(waiting, "screen03-request-host-reasoning"))
      .toContain('aria-busy="true"');
    expect(buttonTag(waiting, "screen03-request-host-reasoning"))
      .toContain("disabled");
    expect(waiting).toContain("s3-spinner");
    expect(waiting).toContain(
      "This card remains an unchanged factual fallback. ChatGPT must read the bounded packet, then render the proposal in a new ShockAudit card in the conversation.",
    );
    expect(waiting).toContain(
      "Source-linked factual summary — no ChatGPT interpretation",
    );
    expect(waiting).toContain('data-testid="screen03-factual-summary-guardrail"');
    const waitingBrief = waiting.slice(
      waiting.indexOf('data-testid="screen03-understand-shock"'),
      waiting.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(waitingBrief).not.toContain("Source-backed orientation");
    expect(waitingBrief).not.toContain('data-testid="screen03-source-backed-summary"');
    expect(waitingBrief).toContain("The reporting standard changed for covered plants.");
    expect(waitingBrief).not.toContain("Plain-language interpretation unavailable");

    const unavailable = renderHost(state(), "unavailable");
    expect(unavailable).toContain("Ask ChatGPT to prepare the shock briefing");
    expect(buttonTag(unavailable, "screen03-request-host-reasoning"))
      .not.toContain("disabled");
    expect(unavailable).toContain('data-testid="screen03-factual-summary-guardrail"');
    const unavailableBrief = unavailable.slice(
      unavailable.indexOf('data-testid="screen03-understand-shock"'),
      unavailable.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(unavailableBrief).toContain("The reporting standard changed for covered plants.");
    expect(unavailableBrief).not.toContain("Source-backed orientation");
    expect(unavailableBrief).not.toContain("Plain-language interpretation unavailable");
    expect(unavailableBrief).not.toContain('role="alert"');
    expect(unavailableBrief).not.toContain("s3-alert--error");
  });

  it("renders every lifecycle proposal field, linked evidence, and explicit review actions", () => {
    const host = withHostNativeBriefing(ccpaState());
    const html = renderToStaticMarkup(
      <Screen03
        state={host}
        hostBriefingDecision="proposed"
        onRequestHostReasoning={vi.fn()}
        onReviewHostBriefing={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    for (const text of [
      "CCPA in plain language",
      "The CCPA gives California residents practical control",
      "A California consumer privacy law.",
      "It added rights to know, delete, correct, limit, and opt out.",
      "Covered businesses must change data practices and request handling.",
      "California consumers and covered for-profit businesses.",
      "Coverage depends on statutory business thresholds and exemptions.",
      "The law became operative in 2020",
      "Regulators can enforce covered duties and statutory penalties.",
      "The CPRA later expanded the privacy regime.",
      "Compliance operations could change costs or revenue channels",
      "Material uncertainty remains across the bounded evidence.",
      "The briefing separates source-grounded facts",
    ]) expect(brief).toContain(text);
    expect(brief).toContain(
      "ChatGPT host proposal — researcher review required",
    );
    expect(brief).toContain(
      "ChatGPT interpretation: plausible pathway to the researcher outcome",
    );
    expect(brief).toContain('data-testid="screen03-host-briefing-citations-summary"');
    expect(brief).toContain('data-testid="screen03-host-briefing-citations-whatChanged"');
    expect(brief).toContain('aria-label="Source 1: California Consumer Privacy Act — statutory text"');
    expect(brief).toContain('aria-label="Source 2: California Consumer Privacy Act overview"');
    expect(brief).toContain('data-testid="screen03-confirm-host-briefing"');
    expect(brief).toContain('data-testid="screen03-reject-host-briefing"');
    expect(brief).toContain("Revise briefing");
    expect(brief).toContain("Save revision and confirm");
    expect(brief).toContain(
      "ChatGPT interpretation — not a verified event fact and not proof of the true mechanism",
    );
    expect(brief).toContain("Linked evidence remains read-only");
    expect(brief).toContain("Packet-recorded gaps and conflicts");
    expect(brief).toContain(
      "Organization-level coverage still requires direct verification.",
    );
    expect(brief).toContain(
      "The bounded packet does not exhaust every later amendment.",
    );
    expect(brief).toContain(
      'data-testid="screen03-briefing-revision-read-only-status"',
    );
    expect(brief).not.toContain('name="briefingStatus"');
  });

  it("shows the deterministic fallback and an explicit status after host proposal rejection", () => {
    const rejected = withHostNativeBriefing(ccpaState());
    const proposal = rejected.briefing!.proposals[0]!;
    rejected.briefing!.activeProposalId = null;
    rejected.briefing!.decisions.push({
      schemaVersion: "screen-03-host-briefing-decision-v1",
      decisionId: "briefing-decision-reject-1",
      proposalId: proposal.proposalId,
      action: "reject",
      reason: "Researcher rejected the proposal.",
      decidedAt: at,
      contentHash: null,
      content: null,
    });
    const html = renderToStaticMarkup(
      <Screen03
        state={rejected}
        hostBriefingDecision="rejected"
        onRequestHostReasoning={vi.fn()}
        onReviewHostBriefing={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(brief).toContain(
      "Source-linked factual summary — no ChatGPT interpretation",
    );
    expect(brief).toContain('data-testid="screen03-host-briefing-rejected"');
    expect(brief).toContain("Researcher rejected the latest ChatGPT host proposal");
    expect(brief).not.toContain("CCPA in plain language");
    expect(brief).not.toContain('data-testid="screen03-confirm-host-briefing"');
  });

  it("never presents a legacy overview as the latest rejected host proposal", () => {
    const rejected = withHostNativeBriefing(ccpaState());
    rejected.interpretation!.origin = "chatgpt-host";
    const proposal = rejected.briefing!.proposals[0]!;
    rejected.briefing!.activeProposalId = null;
    rejected.briefing!.decisions.push({
      schemaVersion: "screen-03-host-briefing-decision-v1",
      decisionId: "briefing-decision-mixed-reject-1",
      proposalId: proposal.proposalId,
      action: "reject",
      reason: "Researcher rejected the new lifecycle proposal.",
      decidedAt: at,
      contentHash: null,
      content: null,
    });
    const html = renderToStaticMarkup(
      <Screen03
        state={rejected}
        hostBriefingDecision="rejected"
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(brief).toContain(
      "Source-linked factual summary — no ChatGPT interpretation",
    );
    expect(brief).toContain("Researcher rejected the latest ChatGPT host proposal");
    expect(brief).not.toContain(
      "gives California residents practical control over personal information held by businesses",
    );
  });

  it("keeps a researcher-confirmed lifecycle briefing visibly distinct", () => {
    const confirmed = withHostNativeBriefing(ccpaState());
    const proposal = confirmed.briefing!.proposals[0]!;
    const decision = {
      schemaVersion: "screen-03-host-briefing-decision-v1" as const,
      decisionId: "briefing-decision-confirm-1",
      proposalId: proposal.proposalId,
      action: "confirm" as const,
      reason: "Researcher confirmed the proposal.",
      decidedAt: at,
      contentHash: proposal.contentHash,
      content: proposal.content,
    };
    confirmed.briefing!.decisions.push(decision);
    confirmed.briefing!.confirmed = {
      proposalId: proposal.proposalId,
      decisionId: decision.decisionId,
      contentHash: proposal.contentHash,
      content: proposal.content,
      confirmedAt: at,
    };
    confirmed.briefing!.confirmedIsCurrent = true;
    const html = renderToStaticMarkup(
      <Screen03
        state={confirmed}
        hostBriefingDecision="confirmed"
        onRequestHostReasoning={vi.fn()}
        onReviewHostBriefing={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(html).toContain("Researcher-confirmed ChatGPT host briefing");
    expect(html).toContain("Researcher confirmed this briefing");
    expect(html).not.toContain('data-testid="screen03-confirm-host-briefing"');
  });

  it("shows a researcher revision as current while preserving the proposal separately", () => {
    const revised = withHostNativeBriefing(ccpaState());
    const proposal = revised.briefing!.proposals[0]!;
    const content = {
      ...proposal.content,
      title: "Researcher-revised CCPA briefing",
      whatChanged: "Researcher-corrected description of the privacy rights.",
    };
    const decision = {
      schemaVersion: "screen-03-host-briefing-decision-v1" as const,
      decisionId: "briefing-decision-revise-1",
      proposalId: proposal.proposalId,
      action: "revise" as const,
      reason: "The researcher corrected two bounded text fields.",
      decidedAt: at,
      contentHash: `sha256:${"3".repeat(64)}`,
      content,
    };
    revised.briefing!.decisions.push(decision);
    revised.briefing!.confirmed = {
      proposalId: proposal.proposalId,
      decisionId: decision.decisionId,
      contentHash: decision.contentHash,
      content,
      confirmedAt: at,
    };
    revised.briefing!.confirmedIsCurrent = true;

    const html = renderToStaticMarkup(
      <Screen03
        state={revised}
        hostBriefingDecision="revised"
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(html).toContain("Researcher-revised ChatGPT host briefing");
    expect(html).toContain("Researcher revised and confirmed this briefing");
    expect(html).toContain("Researcher-revised CCPA briefing");
    expect(html).toContain("Researcher-corrected description");
    expect(html).not.toContain('data-testid="screen03-confirm-host-briefing"');
  });

  it("does not display a prior confirmed briefing after its source packet becomes stale", () => {
    const stale = withHostNativeBriefing(ccpaState());
    const proposal = stale.briefing!.proposals[0]!;
    stale.briefing!.confirmed = {
      proposalId: proposal.proposalId,
      decisionId: "briefing-decision-stale-1",
      contentHash: proposal.contentHash,
      content: proposal.content,
      confirmedAt: at,
    };
    stale.briefing!.confirmedIsCurrent = false;
    stale.briefing!.activeProposalId = null;

    const html = render(stale);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(brief).toContain(
      "Source-linked factual summary — no ChatGPT interpretation",
    );
    expect(brief).not.toContain("CCPA in plain language");
  });

  it("puts chronology and a source-disclosed CCPA snapshot before claim review", () => {
    const host = ccpaState();
    host.interpretation!.origin = "chatgpt-host";
    const html = render(host);

    expect(html).toContain("Verify what changed and when");
    expect(html).toContain("California Consumer Privacy Act");
    expect(html).toContain("When the shock unfolded");
    expect(html).toContain("ChatGPT-generated source-linked overview · research aid");
    expect(html).toContain("Understand this shock");
    expect(html).toContain(
      "gives California residents practical control over personal information",
    );
    expect(html).toContain("People can ask what personal information");
    expect(html).toContain("request access to or deletion");
    expect(html).toContain("opt out of certain sales or sharing");
    expect(html).toContain("may not discriminate");
    expect(html).toContain("Why this may matter for your study");
    expect(html).toContain('data-testid="screen03-study-relevance"');
    expect(html).toContain("Publicly listed companies");
    expect(html).toContain("Profitability");
    expect(html).toContain("California");
    expect(html).toContain("2018–2024");
    expect(html).toContain("Connection to your sample");
    expect(html).toContain(
      "ChatGPT interpretation: plausible pathway to Profitability",
    );
    expect(html).toContain('data-testid="screen03-briefing-citations-intro"');
    expect(html).toContain('aria-label="Source 1: California Consumer Privacy Act — statutory text"');
    expect(html).toContain('aria-label="Source 2: California Consumer Privacy Act overview"');
    expect(html).not.toContain("Sources for this briefing");
    expect(html).toContain("California Legislative Information");
    expect(html).toContain("California Department of Justice");
    expect(html).toContain("published 2018-06-28");
    expect(html).toContain(
      "Start with the short explanation, then confirm the exact claims",
    );
    expect(html).toContain("Deterministic status · no hidden score");
    expect(html).toContain("This limited search is not exhaustive");
    expect(html).toContain("What changed");
    expect(html).toContain("Who or what is covered");
    expect(html).toContain("2024-07-01");
    expect(html).toContain("The Act applies to businesses meeting its statutory coverage conditions");
    expect(html).toContain("No source-supported delay was found");
    expect(html).toContain("Plant coverage under Rule 42");
    expect(html).toContain("California Consumer Privacy Act — statutory text");
    expect(html).toContain("The business shall not require the consumer");
    expect(html).toContain("Passage #1");
    expect(html).toContain("Official record · authority tier 1 · published 2018-06-28");
    expect(html).toContain("Open source record");
    expect(html).toContain("Planning aid · no decision required");
    expect(html).toContain("They are not evidence claims");
    expect(html).toContain('data-testid="screen03-actionability-variable-1"');
    expect(html).not.toContain('data-testid="screen03-review-variable-1"');
    expect(html).toContain("Ready to save the verified Event Card");
    expect(html).toContain("No outcome values were inspected");

    const timelineIndex = html.indexOf('data-testid="screen03-timeline"');
    const briefIndex = html.indexOf('class="s3-section s3-brief"');
    const reviewIndex = html.indexOf('aria-labelledby="s3-event-facts-title"');
    const mapIndex = html.indexOf('data-testid="screen03-coverage-map"');
    expect(timelineIndex).toBeGreaterThan(0);
    expect(timelineIndex).toBeLessThan(briefIndex);
    expect(briefIndex).toBeLessThan(mapIndex);
    expect(reviewIndex).toBeLessThan(mapIndex);

    const brief = html.slice(briefIndex, reviewIndex);
    expect(brief).not.toContain(
      "The business shall not require the consumer to create an account",
    );
  });

  it("presents related online sources as leads that require passage review", () => {
    const screenState = state();
    screenState.contextLeads = [{
      id: "context-1",
      title: "Discussion of the implementation timetable",
      locator: "https://press.example.test/timetable",
      publisher: "press.example.test",
      publishedDate: "2026-08-01",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Context only.",
    }];
    const html = render(screenState);

    expect(html).toContain("Related online sources · inspect before use");
    expect(html).toContain("Additional sources to review");
    expect(html).toContain(
      "may support a claim when their page contains a relevant passage",
    );
    expect(html).toContain(
      "A title or search result alone is not treated as evidence",
    );
    expect(html).toContain("Find this title");
    expect(html).toContain("https://www.google.com/search?q=");
    expect(html).not.toContain("href=\"https://press.example.test");
  });

  it("keeps research failures and empty evidence visible without implying completion", () => {
    const loading = state();
    loading.status = "loading";
    loading.researchCoverage.status = "pending";
    loading.researchCoverage.stoppingRule.status = "not-met";
    loading.evidence = [];
    loading.proposals = {
      identity: [],
      overview: [],
      timeline: [],
      component: [],
      eligibility: [],
      amendment: [],
      requiredVariable: [],
    };
    loading.focalClock.selectedProposalId = null;

    const html = render(loading, "The official register timed out.");
    expect(html).toContain("ShockAudit could not complete this Screen 3 action");
    expect(html).toContain("Checking the event across supported online records");
    expect(html).toContain("No evidence items are available");
    expect(html).toContain("Finish the checks before saving");
    expect(html).toContain('data-testid="screen03-refresh-research"');
    expect(html).toContain('aria-label="Refresh bounded supported-source research"');
    expect(html).not.toContain("Ready to save the verified Event Card");
  });

  it("keeps all six lifecycle stages in a separate gap row when no dates are found", () => {
    const empty = state();
    empty.proposals.timeline = [];
    empty.focalClock.selectedProposalId = null;

    const html = render(empty);
    for (const label of [
      "Announcement / discussion",
      "Enactment / publication",
      "Effective / application",
      "Implementation / compliance",
      "Enforcement / penalty",
      "Amendment / delay / repeal",
    ]) expect(html).toContain(label);
    expect(html.match(/data-testid="screen03-stage-placeholder-/g)).toHaveLength(6);
    expect(html.match(/No directly supported date found/g)).toHaveLength(6);
    expect(html).toContain("It does not mean the stage never occurred");
    expect(html).toContain('role="region" aria-label="Scrollable shock timeline"');
  });

  it("orders displayed dates chronologically and explains repeated precise stages", () => {
    const ordered = state();
    const template = ordered.proposals.timeline[0]!;
    const corrected = timelineProposal(
      template,
      "timeline-corrected",
      "occurrence",
      "2014-12-01",
      "Charter renewed",
    );
    corrected.reviewStatus = "edited";
    corrected.editedValue = "2014-04-05";
    ordered.proposals.timeline = [
      timelineProposal(template, "timeline-late", "announcement", "2014-10-27", "Deadline extension notice"),
      timelineProposal(template, "timeline-rulemaking", "rulemaking", "2014-09-10", "Rulemaking publication"),
      timelineProposal(template, "timeline-early", "announcement", "2014-09-10", "Initial notice"),
      timelineProposal(template, "timeline-effective", "effective", "2014-05-27", "Application date"),
      corrected,
    ];
    ordered.focalClock.selectedProposalId = "timeline-late";

    const html = render(ordered);
    const positions = [
      "timeline-corrected",
      "timeline-effective",
      "timeline-early",
      "timeline-rulemaking",
      "timeline-late",
    ].map((id) => html.indexOf(`data-testid="screen03-stage-${id}"`));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(html).toContain("Shock occurrence");
    expect(html).toContain("Rulemaking / publication");
    expect(html).toContain("Milestone 1 of 2 in this stage");
    expect(html).toContain("Milestone 2 of 2 in this stage");
    expect(html).toContain("Dates run earliest to latest");
    expect(html).toContain('data-date-stage="rulemaking"');
    const correctedStart = html.indexOf(
      'data-testid="screen03-stage-timeline-corrected"',
    );
    const correctedCard = html.slice(
      correctedStart,
      html.indexOf("</li>", correctedStart),
    );
    expect(correctedCard).toContain(
      '<span class="s3-time-card__claim-label">Previously corrected date</span>',
    );
    expect(correctedCard).not.toContain(">Claim to check<");
    expect(correctedCard).toContain(`data-testid="screen03-review-timeline-corrected"`);
  });

  it("keeps a lifecycle gap when its only dated card lacks direct support", () => {
    const weak = state();
    weak.proposals.timeline[0]!.support = "indirect";
    weak.focalClock.selectedProposalId = null;

    const html = render(weak);
    const timelineEnd = html.indexOf("</ol>");
    const effectiveGap = html.indexOf(
      'data-testid="screen03-stage-placeholder-effective"',
    );
    expect(html).toContain('data-testid="screen03-stage-timeline-1"');
    expect(effectiveGap).toBeGreaterThan(timelineEnd);
    expect(html).toContain("no directly supported date");
  });

  it("connects the shock to the frozen sample and outcome without making a causal claim", () => {
    const host = ccpaState();
    host.interpretation!.origin = "chatgpt-host";
    const html = render(host);
    const relevanceStart = html.indexOf('data-testid="screen03-study-relevance"');
    const relevance = html.slice(
      relevanceStart,
      html.indexOf("</section>", relevanceStart),
    );

    expect(relevanceStart).toBeGreaterThan(0);
    expect(relevance).toContain("Publicly listed companies");
    expect(relevance).toContain("Consumer-facing industries");
    expect(relevance).toContain("Privacy-request operations");
    expect(relevance).toContain("compliance costs or revenue channels");
    expect(relevance).toContain("Profitability");
    expect(relevance).toContain("research-design hypothesis");
    expect(relevance).toContain(
      "does not establish exposure, a causal mechanism, effect direction, or effect size",
    );
  });

  it("keeps the exact confirmable value primary and labels reader help as noncanonical", () => {
    const current = ccpaState();
    current.interpretation!.origin = "chatgpt-host";
    current.proposals.component[0]!.reviewStatus = "proposed";
    const html = render(current);
    const fieldStart = html.indexOf('data-testid="screen03-field-component-1"');
    const field = html.slice(fieldStart, html.indexOf("</article>", fieldStart));
    const timelineStart = html.indexOf('data-testid="screen03-stage-timeline-1"');
    const timelineCard = html.slice(
      timelineStart,
      html.indexOf("</li>", timelineStart),
    );

    expect(fieldStart).toBeGreaterThan(0);
    expect(field).toContain("Claim to check");
    expect(field).toContain(
      "The business shall not require the consumer to create an account",
    );
    expect(field).toContain(
      "A business must let a consumer submit a verifiable privacy request without first making an account.",
    );
    expect(field.indexOf(
      "The business shall not require the consumer to create an account",
    )).toBeLessThan(field.indexOf(
      "A business must let a consumer submit a verifiable privacy request without first making an account.",
    ));
    expect(field).toContain(
      "Interpretive help — not the value Confirm will accept",
    );
    expect(field).toContain("ChatGPT-assisted wording");
    expect(field).toContain("grounded in 1 linked online source");
    expect(field).not.toContain("Source-derived proposal wording");
    expect(field).toMatch(
      /data-testid="screen03-confirm-component-1"(?![^>]*disabled)/u,
    );
    expect(field).toContain('data-testid="screen03-evidence-component-1"');
    expect(field).toContain('data-testid="screen03-review-component-1"');
    expect(timelineCard).toContain(
      "In practical terms, this claim describes operative start.",
    );
    expect(timelineCard).toContain(
      "Interpretive help — not the date Confirm will accept",
    );
    expect(timelineCard).toContain(
      '<span class="s3-time-card__claim-label">Source-linked date</span>',
    );
    expect(timelineCard).toContain("ChatGPT-assisted wording");
    expect(timelineCard).toContain("Confirmed");
    expect(timelineCard).toContain('data-testid="screen03-review-timeline-1"');
    expect(html).not.toContain('data-testid="screen03-plain-language-');
    expect(html).not.toContain(">In plain language<");
    expect(html).not.toContain("Explanation sources");
  });

  it("uses a deterministic cited fallback unless a current ChatGPT-host result exists", () => {
    const absent = render(state());
    const absentBrief = absent.slice(
      absent.indexOf('data-testid="screen03-understand-shock"'),
      absent.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(absentBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(absentBrief).toContain("The reporting standard changed for covered plants.");

    const reuse = ccpaState();
    reuse.interpretation!.origin = "screen02-reuse";
    const reuseHtml = render(reuse);
    const reuseBrief = reuseHtml.slice(
      reuseHtml.indexOf('data-testid="screen03-understand-shock"'),
      reuseHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(reuseBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(reuseBrief).not.toContain("gives California residents practical control");
    expect(reuseBrief).not.toContain('data-testid="screen03-briefing-citations-intro"');
    expect(reuseBrief).not.toContain("Sources for this briefing");

    const workers = ccpaState();
    const workersHtml = render(workers);
    const workersBrief = workersHtml.slice(
      workersHtml.indexOf('data-testid="screen03-understand-shock"'),
      workersHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(workersBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(workersBrief).not.toContain("gives California residents practical control");
    expect(workersBrief).not.toContain('data-testid="screen03-briefing-citations-intro"');

    const unavailable = ccpaState();
    unavailable.interpretation!.origin = "unavailable";
    const unavailableHtml = renderToStaticMarkup(
      <Screen03
        state={unavailable}
        hostReasoningStatus="unavailable"
        onRequestHostReasoning={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const unavailableBrief = unavailableHtml.slice(
      unavailableHtml.indexOf('data-testid="screen03-understand-shock"'),
      unavailableHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(unavailableBrief).not.toContain("gives California residents practical control");
    expect(unavailableBrief).toContain("Ask ChatGPT to prepare the shock briefing");
    expect(unavailableBrief).toContain(
      'data-testid="screen03-factual-summary-guardrail"',
    );

    const waitingHtml = renderToStaticMarkup(
      <Screen03
        state={reuse}
        hostReasoningStatus="waiting"
        onRequestHostReasoning={vi.fn()}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const waitingBrief = waitingHtml.slice(
      waitingHtml.indexOf('data-testid="screen03-understand-shock"'),
      waitingHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(waitingBrief).not.toContain("gives California residents practical control");
    expect(waitingBrief).toContain("Request sent to ChatGPT…");
    expect(waitingBrief).toContain(
      'data-testid="screen03-factual-summary-guardrail"',
    );

    const uncited = ccpaState();
    uncited.interpretation!.origin = "chatgpt-host";
    uncited.interpretation!.snapshot.keyPoints[0]!.passageIds = [];
    const uncitedHtml = render(uncited);
    const uncitedBrief = uncitedHtml.slice(
      uncitedHtml.indexOf('data-testid="screen03-understand-shock"'),
      uncitedHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(uncitedBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(uncitedBrief).not.toContain(
      "gives California residents practical control",
    );

    const host = ccpaState();
    host.interpretation!.origin = "chatgpt-host";
    const hostHtml = render(host);
    const hostBrief = hostHtml.slice(
      hostHtml.indexOf('data-testid="screen03-understand-shock"'),
      hostHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(hostBrief).toContain("ChatGPT-generated source-linked overview");
    expect(hostBrief).toContain("gives California residents practical control");
    expect(hostBrief).toContain('data-testid="screen03-briefing-citations-intro"');
  });

  it("excludes unreviewed direct proposals from the deterministic factual fallback", () => {
    const pending = state();
    for (const group of [
      pending.proposals.identity,
      pending.proposals.overview,
      pending.proposals.timeline,
      pending.proposals.component,
      pending.proposals.eligibility,
      pending.proposals.amendment,
    ]) {
      for (const claim of group) claim.reviewStatus = "proposed";
    }
    pending.proposals.overview[0]!.value =
      "UNREVIEWED DIRECT PROPOSAL MUST NOT APPEAR";

    const html = render(pending);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );

    expect(brief).toContain(
      "Source-linked factual summary — no ChatGPT interpretation",
    );
    expect(brief).toContain(
      "No directly supported Event Card field is available for a factual summary yet.",
    );
    expect(brief).not.toContain("UNREVIEWED DIRECT PROPOSAL MUST NOT APPEAR");
  });

  it("renders readable point headings with source links beside every generated block", () => {
    const host = ccpaState();
    host.interpretation!.origin = "chatgpt-host";
    host.proposals.component.push(
      proposal(
        "component-rights",
        "component",
        "Consumer access rights",
        "Consumers have a right to access covered personal information.",
      ),
      proposal(
        "component-duties",
        "component",
        "Business notification duty",
        "Covered businesses must notify consumers about data practices.",
      ),
      proposal(
        "component-purpose",
        "component",
        "Core practical effect",
        "The law changes how covered personal information may be handled.",
      ),
    );
    host.interpretation!.snapshot.keyPoints = [
      {
        text: "Consumers can ask to see covered personal information.",
        proposalIds: ["component-rights"],
        passageIds: ["passage-2"],
        evidenceIds: ["evidence-2"],
      },
      {
        text: "Covered businesses have notification duties.",
        proposalIds: ["component-duties"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
      {
        text: "The coverage rules identify which businesses must comply.",
        proposalIds: ["eligibility-1"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
      {
        text: "The principal requirements became operative on the stated date.",
        proposalIds: ["timeline-1"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
      {
        text: "Later changes and enforcement can alter ongoing obligations.",
        proposalIds: ["amendment-1"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
      {
        text: "In practice, the law changes covered data handling.",
        proposalIds: ["component-purpose"],
        passageIds: ["passage-1"],
        evidenceIds: ["evidence-1"],
      },
    ];

    const html = render(host);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );

    expect(brief).toContain("Rights and protections");
    expect(brief).toContain("Duties and requirements");
    expect(brief).toContain("Who is covered");
    expect(brief).toContain("Key timing");
    expect(brief).toContain("Enforcement and later changes");
    expect(brief).toContain("What it does");
    expect(brief).toContain('data-testid="screen03-briefing-citations-intro"');
    for (let index = 1; index <= 6; index += 1) {
      expect(brief).toContain(
        `data-testid="screen03-briefing-citations-point-${index}"`,
      );
    }
    expect(brief).toContain(
      'aria-label="Source 1: California Consumer Privacy Act — statutory text"',
    );
    expect(brief).toContain(
      'aria-label="Source 2: California Consumer Privacy Act overview"',
    );
    expect(brief).not.toContain("Sources for this briefing");
  });

  it("hides stale generated prose and rebuilds only the deterministic factual fallback", () => {
    const rejected = ccpaState();
    rejected.interpretation!.origin = "chatgpt-host";
    rejected.proposals.overview[0]!.reviewStatus = "rejected";
    const rejectedHtml = render(rejected);
    const rejectedBrief = rejectedHtml.slice(
      rejectedHtml.indexOf('data-testid="screen03-understand-shock"'),
      rejectedHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(rejectedBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(rejectedBrief).not.toContain(
      "gives California residents practical control over personal information",
    );
    expect(rejectedBrief).not.toContain(
      "Consumers may exercise access, deletion, and opt-out rights.",
    );
    expect(rejectedBrief).not.toContain("Sources for this briefing");

    const edited = ccpaState();
    edited.interpretation!.origin = "chatgpt-host";
    edited.proposals.component[0]!.reviewStatus = "edited";
    edited.proposals.component[0]!.editedValue =
      "The business shall not require the consumer to create an account with the business";
    const editedHtml = render(edited);
    const editedBrief = editedHtml.slice(
      editedHtml.indexOf('data-testid="screen03-understand-shock"'),
      editedHtml.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(editedBrief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(editedBrief).toContain(
      "The business shall not require the consumer to create an account with the business",
    );
    expect(editedHtml).toContain(
      "The business shall not require the consumer to create an account with the business",
    );
  });

  it("keeps verified timeline review visible while the separate briefing is not ready", () => {
    const timelineOnly = state();
    const html = render(timelineOnly);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );

    expect(brief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(brief).toContain("2024-07-01");
    expect(brief).toContain("Illustrative Rule 42 — Official Record");
    expect(html).toContain('data-testid="screen03-timeline"');
    expect(html).toContain("2024-07-01");
    expect(html).toContain("Illustrative Rule 42 — Official Record");
  });

  it("rejects a stale per-claim explanation after its proposal fingerprint changes", () => {
    const stale = ccpaState();
    const explanation = stale.interpretation!.claimExplanations.find(
      (item) => item.proposalId === "component-1",
    )!;
    explanation.proposalFingerprint = "fnv1a64:0000000000000000";

    const html = render(stale);
    const fieldStart = html.indexOf('data-testid="screen03-field-component-1"');
    const field = html.slice(fieldStart, html.indexOf("</article>", fieldStart));
    expect(field).not.toContain("s3-field__reader-help");
    expect(field).not.toContain("Source-derived proposal wording");
    expect(html).not.toContain(
      "A business must let a consumer submit a verifiable privacy request without first making an account.",
    );
    expect(html).toContain(
      "The business shall not require the consumer to create an account",
    );
  });

  it("falls back to the dated claim without an unavailable timeline companion", () => {
    const stale = ccpaState();
    const explanation = stale.interpretation!.claimExplanations.find(
      (item) => item.proposalId === "timeline-1",
    )!;
    explanation.proposalFingerprint = "fnv1a64:0000000000000000";

    const html = render(stale);
    const timelineStart = html.indexOf(
      'data-testid="screen03-stage-timeline-1"',
    );
    const timelineCard = html.slice(
      timelineStart,
      html.indexOf("</li>", timelineStart),
    );

    expect(timelineCard).not.toContain("s3-time-card__reader-help");
    expect(timelineCard).not.toContain("No current plain-language explanation");
    expect(timelineCard).not.toContain(
      "In practical terms, this claim describes operative start.",
    );
    expect(timelineCard).toContain('<time dateTime="2024-07-01">2024-07-01</time>');
  });

  it("allows rejected and unresolved critical proposals as preserved limitations", () => {
    const reviewed = state();
    reviewed.proposals.overview[0]!.reviewStatus = "rejected";
    reviewed.proposals.overview[0]!.support = "unsupported";
    reviewed.proposals.eligibility[0]!.reviewStatus = "unresolved";
    reviewed.proposals.eligibility[0]!.support = "conflicting";

    const html = render(reviewed);
    expect(html).toContain("Marked not correct");
    expect(html).toContain("Needs more evidence");
    expect(buttonTag(html, "screen03-reject-overview-1")).toContain(
      'aria-label="Marked not correct: What changed"',
    );
    expect(buttonTag(html, "screen03-unresolved-eligibility-1")).toContain(
      'aria-label="Needs more evidence: Covered unit"',
    );
    expect(html).toContain("Ready to save the verified Event Card");
    expect(html).toContain("and limitations");
  });

  it("makes confirmation visibly change from available to saved and prevents a duplicate", () => {
    const proposed = state();
    proposed.proposals.component[0]!.reviewStatus = "proposed";
    const before = render(proposed);
    const beforeConfirm = buttonTag(before, "screen03-confirm-component-1");
    expect(beforeConfirm).toContain('aria-pressed="false"');
    expect(beforeConfirm).toContain('aria-label="Confirm Reporting component"');
    expect(beforeConfirm).not.toContain("disabled");
    expect(before).toContain(">Confirm</button>");
    expect(before).toContain("No decision saved yet.");

    const after = render(state());
    const afterConfirm = buttonTag(after, "screen03-confirm-component-1");
    expect(afterConfirm).toContain('aria-pressed="true"');
    expect(afterConfirm).toContain('aria-label="Confirmed: Reporting component"');
    expect(afterConfirm).toContain("disabled");
    expect(after).toContain("✓ Confirmed</button>");
    expect(after).toContain("Saved: Confirmed.");
    expect(buttonTag(after, "screen03-reject-component-1")).not.toContain(
      "disabled",
    );
    expect(after).toContain('role="status" aria-live="polite"');

    const corrected = state();
    corrected.proposals.component[0]!.reviewStatus = "edited";
    corrected.proposals.component[0]!.editedValue =
      "Covered plants use the corrected standard.";
    const correctedHtml = render(corrected);
    const correctAgain = buttonTag(
      correctedHtml,
      "screen03-correct-component-1",
    );
    expect(correctAgain).toContain(
      'aria-label="Correct Reporting component again"',
    );
    expect(correctAgain).not.toContain("disabled");
  });

  it("marks a preserved targeted-search success stale after its claim or evidence binding changes", () => {
    const invalidated = state();
    const claim = invalidated.proposals.component[0]!;
    invalidated.directSupportSearches = [{
      id: "screen03-direct-support:fnv1a64:7777777777777777",
      proposalId: claim.id,
      claimFingerprint: fingerprintScreen03ProposalForInterpretation(claim),
      resultBindingFingerprint: "fnv1a64:8888888888888888",
      searchedAt: at,
      previousSupport: "direct",
      resultingSupport: "direct",
      resultingConfirmable: true,
      outcome: "direct-support-found",
      evidenceIds: ["evidence-1"],
      passageIds: ["passage-1"],
      queryIds: ["query-1"],
      note: "The old targeted search found active direct support.",
    }];
    claim.reviewStatus = "proposed";
    claim.support = "unsupported";
    claim.sourceIds = [];
    claim.passageIds = [];
    invalidated.evidence[0]!.status = "changed";

    const html = render(invalidated);
    const statusStart = html.indexOf(
      'data-testid="screen03-direct-support-result-component-1"',
    );
    const status = html.slice(statusStart, html.indexOf("</p>", statusStart));
    expect(status).toContain('data-outcome="stale"');
    expect(status).toContain("previous targeted-search result is no longer current");
    expect(status).toContain("Search the official sources again");
    expect(status).not.toContain("old targeted search found active direct support");
    expect(status).not.toContain("relevant official source recorded");
  });

  it("removes confirmation-explanation toggles while preserving alternative decisions", () => {
    const unsupported = state();
    unsupported.proposals.component[0]!.reviewStatus = "proposed";
    unsupported.proposals.component[0]!.support = "unsupported";
    unsupported.proposals.component[0]!.passageIds = [];
    unsupported.proposals.component[0]!.sourceIds = [];
    const unsupportedHtml = render(unsupported);

    expect(unsupportedHtml).not.toContain("screen03-confirm-unavailable-");
    expect(unsupportedHtml).not.toContain("Why can’t I confirm?");
    expect(unsupportedHtml).not.toContain("What is missing?");
    expect(unsupportedHtml).toContain(
      'data-testid="screen03-confirm-guidance-component-1"',
    );
    expect(unsupportedHtml).toContain(
      "Confirm becomes available when an official field or quoted passage directly supports this claim.",
    );
    expect(unsupportedHtml).toContain(
      'data-testid="screen03-find-direct-support-component-1"',
    );
    expect(buttonTag(unsupportedHtml, "screen03-confirm-component-1"))
      .toContain("disabled");
    expect(buttonTag(unsupportedHtml, "screen03-confirm-component-1"))
      .toContain('aria-describedby=');
    expect(buttonTag(unsupportedHtml, "screen03-correct-component-1"))
      .toContain("disabled");
    expect(buttonTag(unsupportedHtml, "screen03-correct-component-1"))
      .toContain("aria-describedby=");
    expect(buttonTag(unsupportedHtml, "screen03-unresolved-component-1"))
      .not.toContain("disabled");
    expect(buttonTag(unsupportedHtml, "screen03-reject-component-1"))
      .not.toContain("disabled");

    const mismatched = state();
    mismatched.proposals.component[0]!.reviewStatus = "proposed";
    mismatched.proposals.component[0]!.value =
      "A different complete claim that does not appear in the quotation.";
    const mismatchedHtml = render(mismatched);
    expect(mismatchedHtml).toContain(
      'data-testid="screen03-confirm-guidance-component-1"',
    );
    expect(buttonTag(mismatchedHtml, "screen03-confirm-component-1"))
      .toContain("disabled");
    expect(buttonTag(mismatchedHtml, "screen03-correct-component-1"))
      .not.toContain("disabled");
    expect(buttonTag(mismatchedHtml, "screen03-unresolved-component-1"))
      .not.toContain("disabled");
    expect(buttonTag(mismatchedHtml, "screen03-reject-component-1"))
      .not.toContain("disabled");
  });

  it("offers direct-only bulk confirmation and reports confirmed versus still-reviewable claims", () => {
    const reviewed = render(state());
    expect(reviewed).toContain("Confirm directly supported claims");
    expect(reviewed).toContain(
      "Confirm every visible claim that has active direct official support.",
    );
    expect(reviewed).toContain(
      "Indirect, unsupported, stale, and conflicting claims stay unchanged",
    );
    expect(buttonTag(reviewed, "screen03-confirm-all")).toContain("disabled");
    expect(buttonTag(reviewed, "screen03-unconfirm-all")).not.toContain(
      "disabled",
    );
    expect(reviewed).toContain("6 confirmed");
    expect(reviewed).toContain("0 still need review");

    const pending = state();
    pending.proposals.component[0]!.reviewStatus = "proposed";
    const pendingHtml = render(pending);
    expect(buttonTag(pendingHtml, "screen03-confirm-all")).not.toContain(
      "disabled",
    );
    expect(buttonTag(pendingHtml, "screen03-unconfirm-all")).not.toContain(
      "disabled",
    );
    expect(pendingHtml).toContain("5 confirmed");
    expect(pendingHtml).toContain("1 still needs review");
    expect(pendingHtml).toContain("Go to the next undecided claim");
    const pendingCardStart = pendingHtml.indexOf(
      'id="screen03-factual-claim-component-1"',
    );
    const pendingCard = pendingHtml.slice(
      pendingCardStart,
      pendingHtml.indexOf("</article>", pendingCardStart),
    );
    expect(pendingCard).toContain('tabindex="-1"');
    expect(pendingCard).toContain('data-testid="screen03-review-component-1"');
  });

  it("counts exactly the visible pending factual decision cards", () => {
    const pending = state();
    pending.proposals.identity[0]!.reviewStatus = "proposed";
    pending.proposals.amendment[0]!.reviewStatus = "proposed";
    pending.proposals.timeline[0]!.reviewStatus = "proposed";
    pending.proposals.requiredVariable[0]!.reviewStatus = "proposed";

    const html = render(pending);
    expect(html).toContain("3 confirmed");
    expect(html).toContain("3 still need review");
    expect(html.match(/No decision saved yet\./g)).toHaveLength(3);
    expect(html).toContain(
      "3 factual claims still need decisions. The next is in “Event identity and summary”.",
    );
    expect(html).toContain('id="screen03-factual-claim-identity-1"');
    expect(html).toContain('data-testid="screen03-next-undecided-claim"');
    expect(html).toContain('data-testid="screen03-review-timeline-1"');
    expect(html).not.toContain('data-testid="screen03-review-variable-1"');
  });

  it("keeps decisions visible but disabled while saving without claiming to research", () => {
    const proposed = state();
    proposed.proposals.component[0]!.reviewStatus = "proposed";
    const html = render(proposed, undefined, true, false);

    expect(html).toContain("Saving your review");
    expect(html).not.toContain("Checking the event across official records");
    expect(html).not.toContain("Research in progress");
    expect(html).toContain('data-testid="screen03-review-component-1"');
    expect(buttonTag(html, "screen03-confirm-component-1")).toContain(
      "disabled",
    );
  });

  it("keeps review controls visible and disabled while source research runs", () => {
    const proposed = state();
    proposed.proposals.component[0]!.reviewStatus = "proposed";
    const html = render(proposed, undefined, false, true);

    expect(html).toContain("Research in progress");
    expect(html).toContain('data-testid="screen03-review-component-1"');
    expect(buttonTag(html, "screen03-confirm-component-1")).toContain("disabled");
    expect(buttonTag(html, "screen03-unresolved-component-1")).toContain("disabled");
  });

  it("requires every claim decision without requiring a main study date", () => {
    const pending = state();
    pending.proposals.amendment[0]!.reviewStatus = "proposed";
    pending.proposals.amendment[0]!.critical = false;
    pending.proposals.timeline[0]!.reviewStatus = "rejected";

    const html = render(pending);
    expect(html).toContain(
      "One claim in “Later changes and enforcement” still needs your decision.",
    );
    expect(html).not.toContain("main study date");
    expect(html).toContain("Finish the checks before saving");
    expect(html).not.toContain("Ready to save the verified Event Card");
  });

  it("does not count informational downstream inputs as pending decisions", () => {
    const informational = state();
    informational.proposals.requiredVariable[0]!.reviewStatus = "proposed";

    const html = render(informational);
    expect(html).toContain("Ready to save the verified Event Card");
    expect(html).not.toContain("still needs your decision");
    expect(html).not.toContain('data-testid="screen03-review-variable-1"');
  });

  it("keeps date-order anomalies internal and nonblocking", () => {
    const warning = state();
    warning.contradictions = [{
      id: "date-order-warning",
      kind: "date-order",
      proposalIds: ["timeline-1"],
      summary: "An implementation date appears before publication.",
      status: "unresolved",
      resolution: null,
    }];

    const html = render(warning);
    expect(html).not.toContain("Nonblocking timing warning");
    expect(html).not.toContain("Source conflicts and timeline warnings");
    expect(html).not.toContain("An implementation date appears before publication.");
    expect(html).toContain("Ready to save the verified Event Card");
    expect(html).not.toContain("Resolve 1 source contradiction");
  });

  it("does not expose an internal source conflict or ask the researcher to resolve it", () => {
    const conflicted = state();
    conflicted.proposals.timeline.push(timelineProposal(
      conflicted.proposals.timeline[0]!,
      "timeline-uncontested",
      "implementation",
      "2024-07-01",
      "Uncontested implementation date",
    ));
    conflicted.contradictions = [{
      id: "timeline-source-conflict",
      kind: "source-conflict",
      proposalIds: ["timeline-1"],
      summary: "Official records report competing effective dates.",
      status: "unresolved",
      resolution: null,
    }];

    const html = render(conflicted);
    expect(html).not.toContain("Sources disagree");
    expect(html).not.toContain("Official records report competing effective dates.");
    expect(html).not.toContain("Source conflicts and timeline warnings");
    expect(html).not.toContain("How should later analysis handle this conflict?");
    expect(html).not.toContain("screen03-save-resolution-");
    expect(html).toContain('data-testid="screen03-stage-timeline-uncontested"');
    expect(html).toContain("Ready to save the verified Event Card");
  });

  it("does not turn carried or indirect identity details into a verified fact", () => {
    const fallback = state();
    for (const claim of [
      ...fallback.proposals.overview,
      ...fallback.proposals.identity,
    ]) {
      claim.reviewStatus = "proposed";
      claim.support = "indirect";
    }

    const html = render(fallback);
    const brief = html.slice(
      html.indexOf('data-testid="screen03-understand-shock"'),
      html.indexOf('aria-labelledby="s3-event-facts-title"'),
    );
    expect(brief).toContain('data-testid="screen03-factual-summary-guardrail"');
    expect(brief).not.toContain(
      "The reporting standard changed for covered plants.",
    );
    expect(brief).not.toContain(
      "Rule 42 issued by the Illustrative Standards Agency",
    );
    expect(html).not.toContain("Source-backed orientation");
    expect(html).not.toContain("Plain-language interpretation unavailable");
    expect(html).not.toContain('data-testid="screen03-plain-language-');
    expect(html).toContain('data-testid="screen03-confirm-guidance-identity-1"');
    expect(html).not.toContain("Confirmed from direct evidence");
  });

  it("does not treat metadata or changed-source passages as active direct support", () => {
    const unsupported = state();
    unsupported.evidence[0]!.passages[0]!.basis = "source-metadata";

    const metadataHtml = render(unsupported);
    expect(metadataHtml).toContain(
      "Confirm one directly supported identity claim.",
    );
    expect(metadataHtml).not.toContain("main study date");

    unsupported.evidence[0]!.passages[0]!.basis = "source-excerpt";
    unsupported.evidence[0]!.status = "changed";
    const changedHtml = render(unsupported);
    expect(changedHtml).toContain(
      "Confirm one directly supported identity claim.",
    );
    expect(changedHtml).not.toContain("Ready to save the verified Event Card");
  });

  it("uses bounded supported-source refresh language without claiming an exhaustive record refresh", () => {
    const html = render(state());
    expect(html).toContain("Check for updated sources");
    expect(html).toContain("Refresh bounded supported-source research");
    expect(html).not.toContain("Refresh bounded official-source research");
    expect(html).not.toContain("Refresh official records");
  });

  it("includes responsive, reduced-motion, and forced-color safeguards", () => {
    const css = readFileSync(
      new URL("../../src/ui/screen-03/screen-03.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("@media (max-width: 680px)");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain(":focus-visible");
    expect(css).toMatch(/\.s3 a\s*\{[^}]*color: var\(--blue\);/);
    expect(css).toContain(".s3-action--saved-accept");
    expect(css).toContain(".s3-review__status--accepted");
    expect(css).toContain(".s3-action--saved:disabled");
    expect(css).toContain("[data-theme=\"dark\"] .s3");
    expect(css).toContain(".s3-orientation__content");
    expect(css).toContain(".s3-orientation__summary");
    expect(css).toContain(".s3-orientation__points ul");
    expect(css).not.toContain(".s3-orientation__details");
    expect(css).not.toContain(".s3-orientation__sources");
    expect(css).not.toContain(".s3-orientation__provenance");
    expect(css).not.toContain(".s3-orientation__guardrail");
  });

  it("exposes stable browser hooks, field-specific names, inline citations, and keyboard timeline semantics", () => {
    const html = render(state());

    expect(html).toContain('data-testid="screen03"');
    expect(html).toContain('data-screen03-status="reviewing"');
    expect(html).toContain('data-testid="screen03-timeline"');
    expect(html).toContain('data-testid="screen03-stage-timeline-1"');
    expect(html).toContain('data-testid="screen03-review-timeline-1"');
    expect(html).not.toContain('data-testid="screen03-main-date-timeline-1"');
    expect(html).toContain('data-testid="screen03-bulk-review"');
    expect(html).toContain('data-testid="screen03-confirm-all"');
    expect(html).toContain("Confirm directly supported claims");
    expect(html).toContain('data-testid="screen03-unconfirm-all"');
    expect(html).toContain('data-testid="screen03-field-component-1"');
    expect(html).toContain('data-testid="screen03-review-component-1"');
    expect(html).toContain('data-testid="screen03-evidence-component-1"');
    expect(html).toContain('data-testid="screen03-finish-gate"');
    expect(html).toContain('data-testid="screen04-entry-gate"');
    expect(html).toContain("Finish verifying the shock first");
    expect(html).toContain(
      "Resolve all visible factual claims and lock the Event Card before auditing exposure in your sample.",
    );
    expect(html).toContain('data-status="ready"');
    expect(html).toContain('role="region" aria-label="Scrollable shock timeline"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('aria-label="Main study date: Operative start"');
    expect(html).toContain('aria-label="Confirmed: Reporting component"');
    expect(html).toContain('aria-label="Correct Reporting component"');
    expect(html).toContain(
      'aria-label="Mark Reporting component as needing more evidence"',
    );
    expect(html).toContain(
      'aria-label="Read cited evidence for Reporting component"',
    );
    expect(html).toContain('role="status" aria-live="polite"');
  });

  it("marks the locked UI state without exposing review controls", () => {
    const locked = state();
    locked.status = "locked";

    const html = render(locked);
    expect(html).toContain('data-screen03-status="locked"');
    expect(html).toContain(
      'data-testid="screen03-finish-gate" data-status="locked"',
    );
    expect(html).toContain("Verified Event Card saved");
    expect(html).not.toContain('data-testid="screen04-entry-gate"');
    expect(html).not.toContain('data-testid="screen03-bulk-review"');
    expect(html).not.toContain('data-testid="screen03-review-component-1"');
  });

  it("shows generic optional actions only in full host-reasoning mode", () => {
    const optional = currentOrientationState();
    optional.evidence[0]!.channel = "official-register";
    optional.proposals.identity[0]!.support = "indirect";
    optional.proposals.identity[0]!.reviewStatus = "proposed";
    const props = {
      state: optional,
      onRetryResearch: vi.fn(),
      onReviewField: vi.fn(),
      onReviewAll: vi.fn(),
      onLockEventCard: vi.fn(),
      onBack: vi.fn(),
      onRequestEvidenceMapping: vi.fn(),
      onRequestOverviewImprovement: vi.fn(),
    };

    const enabled = renderToStaticMarkup(
      <Screen03 {...props} hostReasoningMode="full" />,
    );
    expect(enabled).toContain(
      'data-testid="screen03-request-evidence-mapping"',
    );
    expect(enabled).toContain(
      'data-testid="screen03-request-overview-improvement"',
    );
    expect(enabled).not.toContain(
      'data-testid="screen03-host-reasoning-unavailable"',
    );

    const disabled = renderToStaticMarkup(
      <Screen03 {...props} hostReasoningMode="disabled" />,
    );
    expect(disabled).toContain(
      'data-testid="screen03-host-reasoning-unavailable"',
    );
    expect(disabled).toContain("unavailable in this release");
    expect(disabled).not.toContain(
      'data-testid="screen03-request-evidence-mapping"',
    );
    expect(disabled).not.toContain(
      'data-testid="screen03-request-overview-improvement"',
    );

    const screen02Only = renderToStaticMarkup(
      <Screen03 {...props} hostReasoningMode="screen02-only" />,
    );
    expect(screen02Only).toContain(
      'data-testid="screen03-host-reasoning-unavailable"',
    );
    expect(screen02Only).not.toContain(
      'data-testid="screen03-request-evidence-mapping"',
    );
    expect(screen02Only).not.toContain(
      'data-testid="screen03-request-overview-improvement"',
    );
  });

  it("keeps a validated overview suggestion separate from the fixed orientation", () => {
    const optional = currentOrientationState();
    const baseline = render(optional);
    const originalSummary = baseline.match(
      /<p class="s3-orientation__summary" data-testid="screen03-orientation-summary">[^<]*<\/p>/u,
    )?.[0];
    expect(originalSummary).toBeDefined();
    const html = renderToStaticMarkup(
      <Screen03
        state={optional}
        hostReasoningMode="full"
        hostOverviewResult={{
          schemaVersion: "shockaudit-screen03-host-overview-result-v1",
          origin: "chatgpt-host",
          nonCanonical: true,
          summary: "Validated optional wording for the selected event.",
          keyPoints: ["A supported optional point."],
          uncertainties: ["The exact coverage boundary remains uncertain."],
          sourceIds: ["source-1"],
          conciseRationale: "Uses the bounded supported facts.",
          hostModel: "host_model_not_exposed",
          stateFingerprintInspected: "fnv1a64:0011223344556677",
          outcomeValuesInspected: false,
        }}
        onRetryResearch={vi.fn()}
        onReviewField={vi.fn()}
        onReviewAll={vi.fn()}
        onLockEventCard={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain(originalSummary!);
    expect(html).toContain(
      'data-testid="screen03-host-overview-suggestion"',
    );
    expect(html).toContain("Validated optional wording · noncanonical");
    expect(html).toContain("does not replace the fixed orientation");
  });
});
