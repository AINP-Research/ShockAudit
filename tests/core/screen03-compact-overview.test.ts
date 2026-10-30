import { describe, expect, it } from "vitest";

import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { screen02FindCandidateFromProposal } from "../../src/core/screen02-find-discovery";
import { REVIEWED_SCREEN02_EVENT_REGISTRY } from "../../src/core/screen02-registry";
import {
  continueScreen02FindCandidate,
  finalizeScreen02FindCandidateAssessmentRequest,
  prepareScreen02AssessmentRequest,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  createScreen03LoadingState,
  type Screen03Proposal,
  type Screen03ReleaseLabel,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  projectScreen03CompactOverview,
  type Screen03CompactOverview,
} from "../../src/core/screen03-compact-overview";
import {
  screen02FindAssessmentPartIds,
  type Screen02EventIdentity,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import {
  buildFindFactsState,
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
} from "./screen02-workflow-fixtures";

const visibleExclusions = /Screen 2|Screen 3|provisional timing leads|formal identifier|possible exposure indicators|study-relevant event clock|does not establish exogeneity|causal mechanism|realized effects|fixed software|source-derived preliminary orientation|candidate snapshot|event fingerprint|handoff|researcher-reviewed|remain qualified until their fields are resolved|share this|date published|bounded coverage description|organization-level eligibility|later classification task|cited record|public participation|submits? proposed regulations? for approval/iu;

function words(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function visibleText(overview: Screen03CompactOverview) {
  return [
    overview.title,
    overview.summary,
    overview.sectionLabel,
    ...overview.keyPoints,
  ].join(" ");
}

function openedAuditState() {
  const screen02 = buildReadyAuditState();
  const handoff = buildScreen02WorkflowHandoff(
    screen02,
    "0.3.16",
    screen02.updatedAt,
  );
  return createScreen03LoadingState(
    handoff,
    new Date(Date.parse(handoff.builtAt) + 1_000).toISOString(),
  );
}

function openedFindState() {
  const requestId = "ccpa-find-assessment-request";
  let screen02 = prepareScreen02AssessmentRequest(
    buildFindFactsState({ candidate: "ccpa" }),
    {
      jobId: "ccpa-find-assessment-job",
      requestId,
      mode: "find-candidate",
      candidateSnapshotId: "ccpa-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T18:00:02.000Z",
    },
  ) as Screen02FindState;
  for (const transition of [
    {
      status: "message-delivered" as const,
      at: "2026-08-09T18:00:03.000Z",
      actor: "chatgpt-host" as const,
    },
    {
      status: "draft-received" as const,
      at: "2026-08-09T18:00:04.000Z",
      actor: "chatgpt-host" as const,
      receiptId: "ccpa-find-assessment-receipt",
    },
    {
      status: "validating" as const,
      at: "2026-08-09T18:00:05.000Z",
      actor: "fixed-core" as const,
    },
  ]) {
    screen02 = transitionScreen02AssessmentRequest(screen02, {
      requestId,
      ...transition,
    }) as Screen02FindState;
  }
  const assessment = cloneFixture(buildReadyFindState().assessments[0]!);
  assessment.assessmentId = "ccpa-find-assessment";
  assessment.candidateSnapshotId = "ccpa-candidate-snapshot-v1";
  assessment.requestId = requestId;
  if (
    !assessment.studyFit ||
    !assessment.outcomePathway ||
    !assessment.measurementPotential
  ) {
    throw new Error("The ready Find fixture must contain all assessment parts.");
  }
  assessment.studyFit.evidenceSourceIds = ["ccpa-official"];
  assessment.outcomePathway.evidenceSourceIds = ["ccpa-official"];
  assessment.measurementPotential.evidenceSourceIds = ["ccpa-official"];
  assessment.evidenceSourceIds = ["ccpa-official"];
  assessment.recordedAt = "2026-08-09T18:00:06.000Z";
  screen02 = finalizeScreen02FindCandidateAssessmentRequest(screen02, {
    requestId,
    status: "completed",
    at: assessment.recordedAt,
    note: "The CCPA fixture assessment passed fixed validation.",
    acceptedPartIds: [...screen02FindAssessmentPartIds],
    failures: [],
    assessment,
  });
  screen02 = selectScreen02FindCandidate(
    screen02,
    "ccpa-candidate-snapshot-v1",
    "ccpa-find-selection",
    "2026-08-09T18:00:08.000Z",
    "The researcher selected the CCPA candidate.",
  );
  screen02 = continueScreen02FindCandidate(
    screen02,
    "ccpa-find-continuation",
    "2026-08-09T18:00:09.000Z",
    "The researcher continued to formal event verification.",
  );
  const handoff = buildScreen02WorkflowHandoff(
    screen02,
    "0.3.16",
    screen02.updatedAt,
  );
  return createScreen03LoadingState(
    handoff,
    new Date(Date.parse(handoff.builtAt) + 1_000).toISOString(),
  );
}

function proposal(
  group: Screen03Proposal["group"],
  id: string,
  label: string,
  value: string,
): Screen03Proposal {
  return {
    id,
    group,
    label,
    value,
    critical: false,
    reviewStatus: "proposed",
    editedValue: null,
    support: "indirect",
    sourceIds: ["fixture-source"],
    passageIds: [],
    uncertainty: null,
  };
}

function projectionFixture(input: {
  title: string;
  eventType: string;
  summary: string;
  keyPoints: string[];
  coverage?: string;
  formalIdentifier?: string | null;
  status?: string | null;
  amendments?: Array<{ label: string; value: string }>;
  origin?: "chatgpt-host" | "fixed-source-derived";
  commonNames?: string[];
}) {
  const state = cloneFixture(openedAuditState());
  state.evidence = state.evidence.map((item) => ({
    ...item,
    passages: [],
  }));
  const identity: Screen02EventIdentity = {
    canonicalTitle: input.title,
    commonNames: input.commonNames ?? [],
    formalIdentifier: input.formalIdentifier ?? null,
    issuer: null,
    issuingJurisdiction: null,
    eventType: input.eventType,
    status: input.status ?? null,
  };
  const glance = {
    ...state.orientation!.current,
    origin: input.origin ?? "fixed-source-derived",
    summary: input.summary,
    keyPoints: [...input.keyPoints],
    whoIsAffected:
      input.coverage ??
      "The retained record does not add a separate substantive coverage fact.",
  };
  state.eventIdentity = identity;
  state.orientation = {
    ...state.orientation!,
    initial: cloneFixture(glance),
    current: cloneFixture(glance),
  };
  state.proposals.overview = [
    proposal("overview", "fixture-overview", "What happened", input.summary),
  ];
  state.proposals.component = input.keyPoints.map((value, index) =>
    proposal(
      "component",
      `fixture-component-${index + 1}`,
      "Substantive change",
      value,
    )
  );
  state.proposals.eligibility = input.coverage
    ? [proposal(
        "eligibility",
        "fixture-coverage",
        "Coverage",
        input.coverage,
      )]
    : [];
  state.proposals.amendment = (input.amendments ?? []).map(
    (amendment, index) =>
      proposal(
        "amendment",
        `fixture-amendment-${index + 1}`,
        amendment.label,
        amendment.value,
      ),
  );
  return state as Screen03VerificationState;
}

describe("Screen 3 compact reader overview projection", () => {
  it("projects the actual CCPA Audit handoff as concise rights-and-duties prose", () => {
    const state = openedAuditState();
    const before = JSON.stringify(state);
    const first = projectScreen03CompactOverview(state);
    const second = projectScreen03CompactOverview(state);

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      title: "California Consumer Privacy Act of 2018",
      sectionLabel: "What it does",
    });
    expect(first!.summary).toContain("consumer-privacy statute");
    expect(first!.keyPoints.length).toBeGreaterThanOrEqual(3);
    expect(first!.keyPoints.length).toBeLessThanOrEqual(5);
    expect(first!.keyPoints.join(" ")).toMatch(/consumer rights/iu);
    expect(first!.keyPoints.join(" ")).toMatch(/disclosure duties/iu);
    expect(first!.keyPoints).toContain(
      "California Privacy Rights Act is a related amendment.",
    );
    expect(visibleText(first!)).not.toMatch(visibleExclusions);
    expect(visibleText(first!)).not.toMatch(/AB 375|In force/iu);
    expect(words(visibleText(first!))).toBeLessThanOrEqual(200);
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.orientation!.current.origin).toBe("fixed-source-derived");
    expect(state.orientation!.current.sourceIds).toEqual(["ccpa-official"]);
    expect(state.evidence).toHaveLength(1);
  });

  it("keeps the rich actual CCPA Find description as three or more supported points", () => {
    const overview = projectScreen03CompactOverview(openedFindState());

    expect(overview).not.toBeNull();
    expect(overview!.summary).toContain(
      "gives California consumers privacy rights",
    );
    expect(overview!.keyPoints).toEqual(expect.arrayContaining([
      "Data-use and disclosure obligations apply to covered businesses.",
      "Deletion and opt-out obligations apply to covered businesses.",
      "Some for-profit businesses doing business in California and meeting statutory thresholds may be covered.",
    ]));
    expect(overview!.keyPoints.length).toBeGreaterThanOrEqual(3);
    expect(visibleText(overview!)).not.toMatch(visibleExclusions);
    expect(visibleText(overview!)).not.toMatch(
      /California Civil Code|In force/iu,
    );
  });

  it("keeps strict v1 compatibility fillers internally but projects fewer than three sparse substantive points", () => {
    const screen02 = buildReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      screen02,
      "0.3.16",
      screen02.updatedAt,
    );
    const state = createScreen03LoadingState(
      handoff,
      new Date(Date.parse(handoff.builtAt) + 1_000).toISOString(),
    );
    const overview = projectScreen03CompactOverview(state);

    expect(state.orientation!.current.keyPoints).toHaveLength(3);
    expect(state.orientation!.current.keyPoints.join(" ")).toMatch(
      /Attached source records|Organization-level exposure/iu,
    );
    expect(overview).not.toBeNull();
    expect(overview!.keyPoints.length).toBeLessThan(3);
    expect(visibleText(overview!)).not.toMatch(
      /Attached source records|Organization-level exposure|Event Card/iu,
    );
  });

  it.each([
    {
      name: "another privacy regulation",
      state: projectionFixture({
        title: "General Data Protection Regulation",
        eventType: "Regulation",
        summary:
          "The GDPR is a European privacy regulation that strengthened individual control over personal data and imposed common responsibilities on organizations that determine or carry out data processing.",
        keyPoints: [
          "People can obtain information about how organizations use their personal data.",
          "Organizations must identify a lawful basis for covered processing activities.",
          "Organizations must protect personal data and respond to qualifying individual requests.",
          "Some serious data breaches require notification to regulators and affected people.",
        ],
        coverage:
          "It applies to organizations established in the European Union and to some organizations outside it that target or monitor people there.",
      }),
      label: "What it does",
    },
    {
      name: "financial or governance regulation",
      state: projectionFixture({
        title: "Cybersecurity Risk Management Disclosure Rules",
        eventType: "Securities regulation",
        summary:
          "These securities rules require public companies to give investors more consistent information about material cybersecurity incidents and about the governance and risk-management processes used to address cybersecurity threats.",
        keyPoints: [
          "Public companies must disclose material cybersecurity incidents on the specified reporting form.",
          "Annual reports must describe processes for assessing and managing material cybersecurity risks.",
          "Annual reports must explain board oversight and management responsibilities for cybersecurity risks.",
        ],
        coverage:
          "The requirements apply to public companies that file the specified reports with the securities regulator.",
      }),
      label: "Key requirements",
    },
    {
      name: "non-regulatory disruption",
      state: projectionFixture({
        title: "Regional Electricity Grid Failure",
        eventType: "Infrastructure disruption",
        summary:
          "A severe grid failure interrupted electricity supply across the region, forcing homes, public services, and businesses to operate without reliable power until system operators restored generation and transmission capacity.",
        keyPoints: [
          "Electricity service stopped across multiple parts of the affected region.",
          "Businesses faced temporary shutdowns and interruptions to equipment, communications, and logistics.",
          "Restoration occurred in stages as operators returned generation and network capacity to service.",
        ],
        coverage:
          "Organizations connected to the affected regional grid experienced the direct service interruption.",
      }),
      label: "Main effects",
    },
    {
      name: "multi-stage event",
      state: projectionFixture({
        title: "Non-Financial Reporting Directive",
        eventType: "Directive",
        summary:
          "The directive introduced common non-financial reporting requirements for certain large European companies, with adoption into national law followed by application to company reports in a later reporting period.",
        keyPoints: [
          "Covered companies must report specified environmental, social, employee, human-rights, and anti-corruption information.",
          "Member states first incorporated the directive into their national legal frameworks.",
          "Company-level reporting duties applied in a later stage after national implementation.",
        ],
        coverage:
          "The reporting requirements focus on certain large public-interest entities that meet the applicable employee criterion.",
      }),
      label: "Key requirements",
    },
  ])("generalizes to $name without workflow prose", ({ state, label }) => {
    const overview = projectScreen03CompactOverview(state);

    expect(overview).not.toBeNull();
    expect(overview!.sectionLabel).toBe(label);
    expect(overview!.keyPoints.length).toBeGreaterThanOrEqual(3);
    expect(overview!.keyPoints.length).toBeLessThanOrEqual(5);
    expect(overview!.keyPoints.every((point) => words(point) <= 25)).toBe(true);
    expect(words(visibleText(overview!))).toBeGreaterThanOrEqual(80);
    expect(words(visibleText(overview!))).toBeLessThanOrEqual(200);
    expect(visibleText(overview!)).not.toMatch(visibleExclusions);
  });

  it("uses fewer than three points for genuinely sparse disruption evidence", () => {
    const state = projectionFixture({
      title: "Mountain Pass Closure",
      eventType: "Transport disruption",
      summary:
        "A landslide closed the only road through the mountain pass.",
      keyPoints: [
        "Freight traffic could not use the closed route.",
      ],
    });
    const overview = projectScreen03CompactOverview(state);

    expect(overview).not.toBeNull();
    expect(overview!.sectionLabel).toBe("Main effects");
    expect(overview!.keyPoints).toEqual([
      "Freight traffic could not use the closed route.",
    ]);
    expect(visibleText(overview!)).not.toMatch(/preliminary|verify|source/iu);
  });

  it("reserves a substantive coverage sentence as a bullet when every saved key point is operational", () => {
    const state = projectionFixture({
      title: "Regional Water Use Restriction",
      eventType: "Regulation",
      summary:
        "The restriction changed permitted water use during a severe regional drought.",
      keyPoints: [
        "The retained record identifies a new operative duty.",
        "Attached source records remain available for Screen 3 review.",
        "Organization-level exposure requires verification.",
      ],
      coverage:
        "Farms and industrial facilities in the affected watersheds had to follow the restriction.",
    });
    const overview = projectScreen03CompactOverview(state);

    expect(overview).not.toBeNull();
    expect(overview!.summary).toBe(
      "The restriction changed permitted water use during a severe regional drought.",
    );
    expect(overview!.keyPoints).toEqual([
      "Farms and industrial facilities in the affected watersheds had to follow the restriction.",
    ]);
    expect(visibleText(overview!)).not.toMatch(visibleExclusions);
  });

  it("filters refinement filler and keeps promoted coverage bullets within 25 words", () => {
    const state = projectionFixture({
      title: "California Consumer Privacy Act of 2018",
      eventType: "Privacy legislation",
      summary: "California Consumer Privacy Act is a privacy legislation.",
      keyPoints: [
        "Only researcher-reviewed, directly supported facts replace preliminary wording here.",
        "Coverage, timing, and later changes remain qualified until their fields are resolved.",
        "The act created consumer disclosure, deletion, opt-out, and nondiscrimination rights and corresponding compliance duties for covered businesses.",
      ],
      coverage:
        "Coverage must distinguish California business nexus, the historical threshold version, personal-information activity, and statutory exemptions; the act did not automatically cover every United States technology firm.",
    });
    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.keyPoints).toEqual([
      "The act created consumer disclosure, deletion, opt-out, and nondiscrimination rights and corresponding compliance duties for covered businesses.",
    ]);
    expect(overview.keyPoints.every((point) => words(point) <= 25)).toBe(true);
    expect(visibleText(overview)).not.toMatch(visibleExclusions);
    expect(overview.keyPoints.join(" ")).not.toMatch(
      /did not automatically cover every United States technology firm/iu,
    );
  });

  it("partitions an already validated summary when saved points are operational without admitting raw evidence", () => {
    const state = projectionFixture({
      title: "California Consumer Privacy Act of 2018",
      eventType: "Privacy legislation",
      summary:
        "California enacted a consumer privacy statute that created rights and duties for covered businesses.",
      keyPoints: [
        "The selected identity remains subject to factual verification on Screen 3.",
        "Attached source records support orientation but do not yet settle the Event Card.",
        "Organization-level exposure must be established separately from broad coverage.",
      ],
      coverage:
        "The retained Screen 2 record does not yet establish exactly which organizations or people are covered.",
      formalIdentifier: "AB 375",
    });
    state.evidence[0]!.title = "California Consumer Privacy Act (CCPA)";
    state.evidence[0]!.publisher = "California Department of Justice";
    state.evidence[0]!.passages = [
      {
        id: "ccpa-procedural-passage",
        number: 1,
        text:
          "The bill would require the Attorney General to, on or before July 1, 2020, solicit broad public participation and adopt regulations.",
        locator: null,
        basis: "source-excerpt",
      },
      {
        id: "ccpa-source-metadata",
        number: 2,
        text: "Source metadata requires readers to visit the website for more information.",
        locator: null,
        basis: "source-metadata",
      },
    ];

    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe(
      "California enacted a consumer privacy statute.",
    );
    expect(overview.keyPoints).toEqual([
      "The statute created rights and duties for covered businesses.",
    ]);
    expect(visibleText(overview)).not.toMatch(visibleExclusions);
    expect(visibleText(overview)).not.toMatch(
      /Attorney General|public participation|adopt regulations|Source metadata/iu,
    );
  });

  it("projects the observed live CCPA route without page metadata or regulator-process headlines", () => {
    const state = projectionFixture({
      title: "California Consumer Privacy Act",
      commonNames: ["CCPA"],
      eventType: "Privacy regulation",
      summary: "SHARE THIS: Date Published: 06/29/2018 04:00 AM.",
      keyPoints: [
        "This bill would enact the California Consumer Privacy Act of 2018.",
        "The bill would require the Attorney General to solicit public participation for the purpose of adopting regulations, as specified.",
        "The time period to provide the required information may be extended once by an additional 45 days when reasonably necessary.",
        "Attorney General Becerra Submits Proposed Regulations for Approval Under the California Consumer Privacy Act | State of California - Department.",
        "The regulations establish procedures for compliance and exercise.",
      ],
    });

    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe("CCPA is a privacy regulation.");
    expect(overview.keyPoints).toEqual([
      "This bill would enact the California Consumer Privacy Act of 2018.",
      "The time period to provide the required information may be extended once by an additional 45 days when reasonably necessary.",
      "The regulations establish procedures for compliance and exercise.",
    ]);
    expect(visibleText(overview)).not.toMatch(visibleExclusions);
    expect(visibleText(overview)).not.toContain("|");
  });

  it("projects the observed live GDPR Audit route as a short explanation without verifier filler", () => {
    const state = projectionFixture({
      title: "General Data Protection Regulation",
      commonNames: ["GDPR"],
      eventType: "Data-protection regulation",
      summary:
        "GDPR is a data-protection regulation. General Data Protection Regulation has a bounded coverage description, while organization-level eligibility remains a later classification task.",
      keyPoints: [
        "General Data Protection Regulation introduced documented duties or rights that may distinguish it from related events.",
        "General Data Protection Regulation includes documented operating components that users can inspect against the cited record.",
      ],
    });

    const overview = projectScreen03CompactOverview(state)!;

    expect(overview).toEqual({
      title: "General Data Protection Regulation",
      summary: "GDPR is a data-protection regulation.",
      keyPoints: [],
      sectionLabel: "What it does",
    });
    expect(visibleText(overview)).not.toMatch(visibleExclusions);
  });

  it.each([
    "California adopted a privacy law that lawmakers enacted in 2018.",
    "A regulation that covered firms opposed.",
  ])("declines an unsafe relative-clause partition: %s", (summary) => {
    const state = projectionFixture({
      title: "Illustrative Privacy Measure",
      eventType: "Privacy regulation",
      summary,
      keyPoints: [
        "The selected identity remains subject to factual verification on Screen 3.",
        "Attached source records support orientation but do not yet settle the Event Card.",
        "Organization-level exposure must be established separately from broad coverage.",
      ],
      coverage:
        "The retained Screen 2 record does not yet establish exactly which organizations or people are covered.",
    });

    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe(summary);
    expect(overview.keyPoints).toEqual([]);
    expect(visibleText(overview)).not.toMatch(
      /The law lawmakers|The regulation covered firms opposed/iu,
    );
  });

  it("shows at most one material later amendment and does not create an amendment box", () => {
    const state = projectionFixture({
      title: "Consumer Data Rights Act",
      eventType: "Privacy law",
      summary:
        "The law gives consumers rights over personal data and requires covered businesses to explain and limit specified uses of that information.",
      keyPoints: [
        "Consumers may ask covered businesses for information about retained personal data.",
        "Covered businesses must respond to qualifying consumer requests.",
        "A later amendment expanded specified consumer rights.",
      ],
      amendments: [
        {
          label: "amendment: Consumer Data Rights Amendment",
          value: "A later amendment expanded specified consumer rights.",
        },
        {
          label: "amendment: Second Consumer Data Amendment",
          value: "A second amendment revised implementation details.",
        },
      ],
    });
    const overview = projectScreen03CompactOverview(state)!;

    expect(
      overview.keyPoints.filter((point) => /amendment/iu.test(point)),
    ).toHaveLength(1);
    expect(Object.keys(overview).sort()).toEqual([
      "keyPoints",
      "sectionLabel",
      "summary",
      "title",
    ]);
  });

  it("sanitizes saved v0.3.16 operational prose as whole sentences and deduplicates article variants", () => {
    const state = projectionFixture({
      title: "Rule 42 Reporting Standard",
      eventType: "Financial regulation",
      formalIdentifier: "Rule 42",
      status: "In force",
      summary:
        "Rule 42 Reporting Standard is the selected regulation issued by the reporting authority. Covered companies must follow a revised reporting standard for specified annual disclosures.",
      keyPoints: [
        "Covered plants use a revised reporting standard.",
        "The retained record identifies a new operative reporting duty.",
        "Later amendments remain part of the detailed evidence review.",
        "Covered plants use the revised reporting standard.",
        "No source-supported delay was found in the bounded record set.",
      ],
    });
    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe(
      "Covered companies must follow a revised reporting standard for specified annual disclosures.",
    );
    expect(overview.keyPoints).toEqual([
      "Covered plants use a revised reporting standard.",
    ]);
    expect(visibleText(overview)).not.toMatch(
      /selected regulation|retained record|detailed evidence review|bounded record set|source-supported/iu,
    );
  });

  it.each([
    {
      id: "registry-eu-gdpr-2018",
      naturalSummary:
        "An EU regulation governing personal-data processing that became applicable on May 25, 2018.",
    },
    {
      id: "registry-us-sarbanes-oxley-2002",
      naturalSummary:
        "A U.S. corporate-governance and disclosure reform enacted on July 30, 2002.",
    },
  ])("keeps the natural first sentence and removes actual $id registry workflow prose", ({
    id,
    naturalSummary,
  }) => {
    const registryProposal = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
      (proposal) => proposal.id === id,
    );
    if (!registryProposal) throw new Error(`Missing registry fixture ${id}.`);
    const candidate = screen02FindCandidateFromProposal(
      registryProposal,
      "registry-projection-round",
      "2026-08-22T10:00:00.000Z",
    );
    const firstSource = registryProposal.sources[0]!;
    const state = projectionFixture({
      title: candidate.identity.canonicalTitle,
      eventType: candidate.identity.eventType,
      summary: candidate.description.text,
      keyPoints: [
        ...candidate.broadCoverage.map((claim) => claim.text),
        `${firstSource.title}.`,
        `${firstSource.publisher}.`,
        `Read more at ${firstSource.locator}.`,
      ],
      coverage: candidate.broadCoverage[0]?.text,
      formalIdentifier: candidate.identity.formalIdentifier,
      status: candidate.identity.status,
    });
    state.evidence[0]!.title = firstSource.title;
    state.evidence[0]!.publisher = firstSource.publisher;
    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe(naturalSummary);
    expect(visibleText(overview)).not.toMatch(
      /registry record|requires? verification|exposure reconstruction|treatment clocks?|coverage remains provisional/iu,
    );
    expect(overview.keyPoints).not.toContain(`${firstSource.title}.`);
    expect(overview.keyPoints).not.toContain(`${firstSource.publisher}.`);
    expect(visibleText(overview)).not.toMatch(/https?:\/\//iu);
  });

  it("never leaks raw proposed or accepted proposal values that are absent from orientation.current", () => {
    const state = projectionFixture({
      title: "Bounded Reporting Rule",
      eventType: "Financial regulation",
      summary:
        "The rule changed specified annual reporting duties for covered companies.",
      keyPoints: [
        "Covered companies must use the revised annual reporting format.",
        "The rule adds a specified governance disclosure.",
        "The reporting duty applies to qualifying annual filings.",
      ],
    });
    state.proposals.overview.push(proposal(
      "overview",
      "sentinel-proposed-overview",
      "Unreviewed overview",
      "SENTINEL proposed overview must never enter the reader projection.",
    ));
    state.proposals.component.push(proposal(
      "component",
      "sentinel-proposed-component",
      "Unreviewed component",
      "SENTINEL proposed component must never enter the reader projection.",
    ));
    state.proposals.eligibility.push({
      ...proposal(
        "eligibility",
        "sentinel-accepted-not-refined",
        "Accepted but absent from current orientation",
        "SENTINEL accepted value must not bypass orientation refinement.",
      ),
      reviewStatus: "accepted",
    });

    expect(visibleText(projectScreen03CompactOverview(state)!)).not.toContain(
      "SENTINEL",
    );
  });

  it("rejects overlong single-sentence clauses instead of truncating them into new claims", () => {
    const overlong = `A retained statement ${Array.from(
      { length: 90 },
      (_, index) => `detail${index + 1}`,
    ).join(" ")}.`;
    const state = projectionFixture({
      title: "Sparse Governance Change",
      eventType: "Governance regulation",
      summary: overlong,
      keyPoints: [
        overlong,
        "Covered organizations changed one annual governance filing.",
      ],
    });
    const overview = projectScreen03CompactOverview(state)!;

    expect(overview.summary).toBe(
      "Sparse Governance Change is a governance regulation.",
    );
    expect(overview.keyPoints).toEqual([
      "Covered organizations changed one annual governance filing.",
    ]);
    expect(visibleText(overview)).not.toContain("detail25");
  });

  it("preserves the v0.3.14/v0.3.15 briefing path but compacts saved v0.3.16 and later state", () => {
    const state = cloneFixture(openedAuditState());
    const v0314 = cloneFixture(state);
    const v0315 = cloneFixture(state);
    const v0317 = cloneFixture(state);
    v0314.releaseLabel = "v0.3.14";
    v0315.releaseLabel = "v0.3.15";
    v0317.releaseLabel = "v0.3.17" as Screen03ReleaseLabel;

    expect(projectScreen03CompactOverview(v0314)).toBeNull();
    expect(projectScreen03CompactOverview(v0315)).toBeNull();
    expect(projectScreen03CompactOverview(state)).not.toBeNull();
    expect(projectScreen03CompactOverview(v0317)).not.toBeNull();
  });

  it("uses the same compact structure for validated ChatGPT wording while preserving origin", () => {
    const state = projectionFixture({
      title: "Consumer Privacy Rule",
      eventType: "Privacy regulation",
      summary:
        "The rule gives consumers more control over specified uses and disclosures of personal information by covered organizations.",
      keyPoints: [
        "Consumers may obtain information about specified uses of their personal information.",
        "Covered organizations must respond to qualifying privacy requests.",
        "Specified disclosures require the safeguards described by the rule.",
      ],
      origin: "chatgpt-host",
    });
    const overview = projectScreen03CompactOverview(state)!;

    expect(Object.keys(overview).sort()).toEqual([
      "keyPoints",
      "sectionLabel",
      "summary",
      "title",
    ]);
    expect(state.orientation!.current.origin).toBe("chatgpt-host");
    expect(visibleText(overview)).not.toMatch(/ChatGPT|source-derived/iu);
  });
});
