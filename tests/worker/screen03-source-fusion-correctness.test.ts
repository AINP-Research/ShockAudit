import { describe, expect, it } from "vitest";

import {
  buildScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  applyScreen03Action,
  buildScreen03StateFromResearch,
  requireScreen03ResearchPacket,
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  type Screen03EvidenceItem,
  type Screen03Proposal,
  type Screen03ProposalGroups,
  type Screen03ResearchPacket,
  type Screen03TimelineProposal,
} from "../../src/core/screen03-workflow";
import { fingerprintScreen02WorkflowValue } from "../../src/core/screen02-workflow-state";
import type { Screen02ConnectorFetch } from "../../src/worker/screen02-connectors";
import {
  researchScreen03Evidence,
} from "../../src/worker/screen03-evidence-service";
import { screen03EvidenceSourceRole } from "../../src/worker/screen03-evidence-synthesis";
import { fuseScreen03ProposalSources } from "../../src/worker/screen03-source-fusion";
import { compileScreen03ExactExcerpts } from "../../src/worker/screen03-timeline-extraction";
import {
  buildReadyAuditState,
  buildReadyFindState,
} from "../core/screen02-workflow-fixtures";

const researchedAt = "2026-08-14T15:00:00.000Z";
const initialLocator =
  "https://www.federalregister.gov/documents/2014/09/10/2014-21513/manufacturing-council";
const followupLocator =
  "https://www.federalregister.gov/documents/2014/10/27/2014-25531/manufacturing-council";
const amendmentLocator =
  "https://www.federalregister.gov/documents/2014/10/27/2014-30001/manufacturing-council";
const repealLocator =
  "https://www.federalregister.gov/documents/2014/10/27/2014-30002/manufacturing-council";

function resealHandoff(changed: Screen02WorkflowHandoff) {
  changed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    changed.event,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function manufacturingCouncilHandoff() {
  const changed = structuredClone(buildScreen02WorkflowHandoff(
    buildReadyFindState(),
    "0.3.3",
    "2026-08-14T14:58:00.000Z",
  ));
  const sourceBase = {
    id: changed.sources[0]!.id,
    title: "Manufacturing Council",
    locator: initialLocator,
    publisher: "International Trade Administration",
    publishedDate: "2014-09-10",
    authorityTier: 2 as const,
    channel: "Federal Register API v1 · notices",
    retrievedAt: "2026-08-14T14:57:00.000Z",
    userProvided: false,
  };
  changed.sources = [{
    ...sourceBase,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
  }];
  changed.event.identity = {
    canonicalTitle: "Manufacturing Council",
    commonNames: ["U.S. Manufacturing Council"],
    formalIdentifier: "FR Doc. 2014-21513",
    issuer: "International Trade Administration",
    issuingJurisdiction: "United States",
    eventType: "Federal Register notice",
    status: "Notice of Renewal and Opportunity to Apply",
  };
  changed.event.sourceIds = [sourceBase.id];
  changed.event.description = {
    id: "manufacturing-council-description",
    text:
      "The Department renewed an advisory council and invited applications for membership.",
    sourceIds: [sourceBase.id],
    status: "provisional",
    uncertainty: "The notice is advisory and does not itself impose binding duties.",
  };
  changed.event.dateLeads = [{
    id: "manufacturing-council-initial-notice",
    date: "2014-09-10",
    label: "Initial notice publication date",
    stage: "announcement",
    sourceIds: [sourceBase.id],
    status: "provisional",
    uncertainty: "This is the publication date of the initial renewal notice.",
  }];
  changed.event.broadCoverage = [{
    id: "manufacturing-council-coverage",
    text:
      "The notice concerns candidates for membership on a federal advisory council.",
    sourceIds: [sourceBase.id],
    status: "provisional",
    uncertainty: "Membership eligibility requires researcher review.",
  }];
  changed.event.highLevelChanges = [];
  changed.event.keyComponents = [];
  changed.event.relatedVersions = [];
  changed.unresolved.provisionalClaimIds = [
    changed.event.description.id,
    ...changed.event.dateLeads.map((lead) => lead.id),
    ...changed.event.broadCoverage.map((claim) => claim.id),
  ];
  return resealHandoff(changed);
}

function incompleteAuditHandoff() {
  const changed = structuredClone(buildScreen02WorkflowHandoff(
    buildReadyAuditState(),
    "0.3.3",
    "2026-08-14T14:58:00.000Z",
  ));
  const original = changed.sources[0]!;
  const source = {
    ...original,
    locator: "https://researcher.example.test/ccpa-reviewed-source",
    authorityTier: 6 as const,
    channel: "researcher-supplied-source",
    userProvided: true,
    evidenceText:
      "The Act requires covered businesses to honor verified consumer deletion requests.",
  };
  const { sourceFingerprint: _sourceFingerprint, ...sourceInput } = source;
  changed.sources[0] = {
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  };
  changed.event.highLevelChanges[0] = {
    ...changed.event.highLevelChanges[0]!,
    text: "The bill would require the Attorney General to,",
    uncertainty: "Incomplete upstream fragment.",
  };
  changed.event.keyComponents[0] = {
    ...changed.event.keyComponents[0]!,
    text:
      "’s duty to disclose and deliver the information within 45 days of receipt of the consumer’s request.",
    uncertainty: "Incomplete upstream fragment.",
  };
  return resealHandoff(changed);
}

function federalRegisterResponse() {
  return new Response(JSON.stringify({
    count: 2,
    results: [
      {
        document_number: "2014-21513",
        title: "Manufacturing Council",
        publication_date: "2014-09-10",
        type: "Notice",
        action: "Notice of Renewal and Opportunity to Apply",
        abstract:
          "The charter was renewed and the Department invited applications for Council membership.",
        html_url: initialLocator,
        agencies: [{ name: "International Trade Administration" }],
      },
      {
        document_number: "2014-25531",
        title: "Manufacturing Council",
        publication_date: "2014-10-27",
        type: "Notice",
        action: "Extension of the application deadline",
        abstract:
          "The Department extended the deadline for membership applications.",
        html_url: followupLocator,
        agencies: [{ name: "International Trade Administration" }],
      },
    ],
  }), { headers: { "content-type": "application/json" } });
}

function manufacturingCouncilFetch(): Screen02ConnectorFetch {
  return async (input) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/api/v1/documents")) {
      return federalRegisterResponse();
    }
    if (url.toString() === initialLocator) {
      return new Response(`<!doctype html><main>
        <p>The Northwest Fruit Exporters certificate was effective on May 27, 2014.</p>
        <p>[FR Doc. 2014-21507 Filed 9-9-14]</p>
        <h1>Manufacturing Council</h1>
        <p>The Manufacturing Council charter was renewed on April 5, 2014.</p>
        <p>On September 10, 2014, the Department announced the Council renewal and invited membership applications.</p>
        <p>[FR Doc. 2014-21513 Filed 9-9-14]</p>
      </main>`, { headers: { "content-type": "text/html" } });
    }
    if (url.toString() === followupLocator) {
      return new Response(`<!doctype html><main>
        <h1>Manufacturing Council</h1>
        <p>On October 27, 2014, the Department extended the membership application deadline.</p>
        <p>[FR Doc. 2014-25531 Filed 10-24-14]</p>
      </main>`, { headers: { "content-type": "text/html" } });
    }
    throw new Error(`Unexpected Federal Register fixture route ${url}.`);
  };
}

function sameDayLifecycleFetch(): Screen02ConnectorFetch {
  return async (input) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/api/v1/documents")) {
      return new Response(JSON.stringify({
        count: 3,
        results: [
          {
            document_number: "2014-21513",
            title: "Manufacturing Council",
            publication_date: "2014-09-10",
            type: "Notice",
            action: "Notice of Renewal and Opportunity to Apply",
            abstract: "The Department renewed the Council charter.",
            html_url: initialLocator,
            agencies: [{ name: "International Trade Administration" }],
          },
          {
            document_number: "2014-30001",
            title: "Manufacturing Council",
            publication_date: "2014-10-27",
            type: "Notice",
            action: "Amendment to the Council charter",
            abstract: "The Department amended the Council charter.",
            html_url: amendmentLocator,
            agencies: [{ name: "International Trade Administration" }],
          },
          {
            document_number: "2014-30002",
            title: "Manufacturing Council",
            publication_date: "2014-10-27",
            type: "Notice",
            action: "Repeal of the Council charter",
            abstract: "The Department repealed the Council charter.",
            html_url: repealLocator,
            agencies: [{ name: "International Trade Administration" }],
          },
        ],
      }), { headers: { "content-type": "application/json" } });
    }
    if (url.toString() === initialLocator) {
      return new Response(
        `<h1>Manufacturing Council</h1><p>On September 10, 2014, the Department announced the Council renewal.</p><p>[FR Doc. 2014-21513]</p>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    if (url.toString() === amendmentLocator) {
      return new Response(
        `<h1>Manufacturing Council</h1><p>On October 27, 2014, the Department amended the Council charter.</p><p>[FR Doc. 2014-30001]</p>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    if (url.toString() === repealLocator) {
      return new Response(
        `<h1>Manufacturing Council</h1><p>On October 27, 2014, the Department repealed the Council charter.</p><p>[FR Doc. 2014-30002]</p>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    throw new Error(`Unexpected lifecycle fixture route ${url}.`);
  };
}

function emptyGroups(): Screen03ProposalGroups {
  return {
    identity: [],
    overview: [],
    timeline: [],
    component: [],
    eligibility: [],
    amendment: [],
    requiredVariable: [],
  };
}

function evidence(
  id: string,
  text: string,
  role = "official-publication-record",
  authorityTier: Screen03EvidenceItem["authorityTier"] = 2,
): Screen03EvidenceItem {
  return {
    id,
    sourceId: `source-${id}`,
    title: `Official record ${id}`,
    locator: `https://www.federalregister.gov/d/${id}`,
    publisher: "Office of the Federal Register",
    publishedDate: null,
    retrievedAt: researchedAt,
    authorityTier,
    channel: `source role: ${role.replace(/-/g, " ")}`,
    contentFingerprint: fingerprintScreen02WorkflowValue({ id, text }),
    language: "en",
    status: "retrieved",
    passages: [{
      id: `passage-${id}`,
      number: 1,
      text,
      locator: `https://www.federalregister.gov/d/${id}`,
      basis: "source-excerpt",
    }],
  };
}

function component(
  id: string,
  value: string,
  sourceId: string,
): Screen03Proposal {
  return {
    id,
    group: "component",
    label: "Operative duty or component",
    value,
    critical: true,
    reviewStatus: "proposed",
    editedValue: null,
    support: "direct",
    sourceIds: [sourceId],
    passageIds: [`passage-${sourceId}`],
    uncertainty: null,
  };
}

function timeline(
  id: string,
  label: string,
  date: string,
  sourceId: string,
  uncertainty: string | null = null,
): Screen03TimelineProposal {
  return {
    id,
    group: "timeline",
    label,
    value: date,
    date,
    stage: "effective",
    critical: true,
    reviewStatus: "proposed",
    editedValue: null,
    support: "direct",
    sourceIds: [sourceId],
    passageIds: [`passage-${sourceId}`],
    uncertainty,
  };
}

describe("Screen 3 source identity and representative fusion", () => {
  it("excludes the adjacent Northwest Fruit date and keeps three correctly staged Manufacturing Council milestones", async () => {
    const handoff = manufacturingCouncilHandoff();
    const researched = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff,
        fetch: manufacturingCouncilFetch(),
        retrievedAt: researchedAt,
      }),
    );
    const packet = compileScreen03ExactExcerpts(
      researched,
      handoff.event.identity.commonNames,
    );
    const timelineValues = packet.proposals.timeline.map((proposal) => ({
      date: proposal.date,
      stage: proposal.stage,
      label: proposal.label,
    }));

    expect(JSON.stringify(packet.evidence)).not.toMatch(/May 27, 2014|2014-05-27/);
    expect(JSON.stringify(packet.proposals)).not.toContain("2014-05-27");
    expect(timelineValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2014-09-10", stage: "announcement" }),
      expect.objectContaining({
        date: "2014-10-27",
        stage: "amendment",
        label: expect.stringMatching(/deadline|extension/i),
      }),
    ]));
    expect(
      timelineValues.map((item) => item.date).sort(),
    ).toEqual(["2014-04-05", "2014-09-10", "2014-10-27"]);
    const selected = packet.evidence.find((item) =>
      item.locator === initialLocator
    );
    expect(selected && screen03EvidenceSourceRole(selected)).toBe(
      "official-publication-record",
    );
    const related = packet.evidence.find((item) =>
      item.locator === followupLocator
    );
    expect(related && screen03EvidenceSourceRole(related)).toBe(
      "related-official-record",
    );
    expect(related?.passages.some((passage) =>
      passage.text.includes("2014-25531")
    )).toBe(true);
  });

  it("preserves distinct same-day structured amendment and repeal records before excerpt compilation", async () => {
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: manufacturingCouncilHandoff(),
        fetch: sameDayLifecycleFetch(),
        retrievedAt: researchedAt,
      }),
    );
    const sameDay = packet.proposals.timeline.filter((proposal) =>
      proposal.date === "2014-10-27"
    );

    expect(sameDay).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "amendment",
        label: "Amendment publication date",
      }),
      expect.objectContaining({
        stage: "amendment",
        label: "Repeal publication date",
      }),
    ]));
    expect(sameDay).toHaveLength(2);
    expect(packet.contradictions.some((contradiction) =>
      contradiction.proposalIds.some((id) =>
        sameDay.some((proposal) => proposal.id === id)
      )
    )).toBe(false);
  });

  it("omits incomplete and researcher-supplied Audit components plus records a gap", async () => {
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: incompleteAuditHandoff(),
        fetch: async () => new Response(JSON.stringify({
          results: { bindings: [] },
        }), { headers: { "content-type": "application/json" } }),
        retrievedAt: researchedAt,
      }),
    );
    const serialized = JSON.stringify(packet.proposals);
    expect(serialized).not.toContain(
      "The bill would require the Attorney General to,",
    );
    expect(serialized).not.toContain(
      "’s duty to disclose and deliver",
    );
    expect(packet.proposals.component).toEqual([]);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /incomplete upstream component fragments were omitted/i,
    );
  });

  it("merges exact corroboration, but preserves identity slots and same-day scoped phases", () => {
    const first = evidence(
      "a",
      "Covered businesses must file annual reports with the regulator.",
    );
    const second = evidence(
      "b",
      "Covered businesses must file annual reports with the regulator.",
    );
    const groups = emptyGroups();
    groups.identity = [
      {
        ...component("identity-title", "European Union", "a"),
        group: "identity",
        label: "Issuer",
      },
      {
        ...component("identity-jurisdiction", "European Union", "a"),
        group: "identity",
        label: "Issuing jurisdiction",
      },
    ];
    groups.component = [
      component(
        "component-a",
        "Covered businesses must file annual reports with the regulator.",
        "a",
      ),
      component(
        "component-b",
        "Covered businesses must file annual reports with the regulator.",
        "b",
      ),
    ];
    groups.timeline = [
      timeline(
        "small-phase",
        "Compliance date",
        "2020-01-01",
        "a",
        "Applies to small entities.",
      ),
      timeline(
        "large-phase",
        "Compliance date",
        "2020-01-01",
        "b",
        "Applies to large entities.",
      ),
      timeline(
        "phase-one",
        "Compliance date for Phase 1",
        "2020-01-01",
        "a",
        "The first phase covers one implementation group.",
      ),
      timeline(
        "phase-two",
        "Compliance date for Phase 2",
        "2020-01-01",
        "b",
        "The second phase covers another implementation group.",
      ),
    ];

    const fused = fuseScreen03ProposalSources(groups, [first, second]);
    expect(fused.proposals.component).toHaveLength(1);
    expect(fused.proposals.component[0]).toMatchObject({
      sourceIds: ["a", "b"],
      passageIds: ["passage-a", "passage-b"],
    });
    expect(fused.proposals.identity.map((proposal) => proposal.label)).toEqual([
      "Issuer",
      "Issuing jurisdiction",
    ]);
    expect(fused.proposals.timeline).toHaveLength(4);
    expect(fused.conflicts).toEqual([]);
  });

  it("keeps distinct duties and selects one representative for an annual-versus-quarterly overlap", () => {
    const reportingTail =
      " reports with the regulator using the approved electronic form and retain a complete copy for the next scheduled compliance review period.";
    const annualValue = `Covered businesses must file annual${reportingTail}`;
    const quarterlyValue = `Covered businesses must file quarterly${reportingTail}`;
    const annual = evidence(
      "annual",
      annualValue,
    );
    const quarterly = evidence(
      "quarterly",
      quarterlyValue,
    );
    const deletion = evidence(
      "deletion",
      "Covered businesses must delete eligible personal information after a verified request.",
    );
    const groups = emptyGroups();
    groups.component = [
      component(
        "annual-duty",
        annualValue,
        "annual",
      ),
      component(
        "quarterly-duty",
        quarterlyValue,
        "quarterly",
      ),
      component(
        "deletion-duty",
        "Covered businesses must delete eligible personal information after a verified request.",
        "deletion",
      ),
    ];

    const fused = fuseScreen03ProposalSources(
      groups,
      [annual, quarterly, deletion],
    );
    expect(fused.proposals.component).toHaveLength(2);
    const representative = fused.proposals.component.find((proposal) =>
      proposal.id === "annual-duty"
    )!;
    expect(representative).toMatchObject({ support: "conflicting" });
    expect(representative.sourceIds).toEqual(expect.arrayContaining([
      "annual",
      "quarterly",
    ]));
    expect(annual.passages[0]!.text).toContain(representative.value);
    expect(representative.value).not.toContain("quarterly");
    expect(fused.conflicts).toEqual([
      expect.objectContaining({
        representativeProposalId: "annual-duty",
        group: "component",
      }),
    ]);
    expect(fused.proposals.component).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "deletion-duty" }),
    ]));
  });

  it("selects one representative for a short 30-versus-45-day requirement", () => {
    const thirty = evidence("response-30", "Respond within 30 days.");
    const fortyFive = evidence("response-45", "Respond within 45 days.");
    const groups = emptyGroups();
    groups.component = [
      component("response-30-duty", "Respond within 30 days.", "response-30"),
      component("response-45-duty", "Respond within 45 days.", "response-45"),
    ];

    const fused = fuseScreen03ProposalSources(groups, [thirty, fortyFive]);

    expect(fused.proposals.component).toHaveLength(1);
    expect(fused.proposals.component[0]).toMatchObject({
      id: "response-30-duty",
      support: "conflicting",
    });
    expect(fused.conflicts).toHaveLength(1);
  });

  it("selects one representative for a short positive-versus-negated duty", () => {
    const required = evidence(
      "filing-required",
      "Businesses must file reports.",
    );
    const prohibited = evidence(
      "filing-prohibited",
      "Businesses must not file reports.",
    );
    const groups = emptyGroups();
    groups.component = [
      component(
        "filing-required-duty",
        "Businesses must file reports.",
        "filing-required",
      ),
      component(
        "filing-prohibited-duty",
        "Businesses must not file reports.",
        "filing-prohibited",
      ),
    ];

    const fused = fuseScreen03ProposalSources(groups, [required, prohibited]);

    expect(fused.proposals.component).toHaveLength(1);
    const representative = fused.proposals.component[0]!;
    expect(representative.id).toMatch(/^filing-(?:required|prohibited)-duty$/);
    expect(representative.support).toBe("conflicting");
    expect(representative.sourceIds).toEqual(expect.arrayContaining([
      "filing-required",
      "filing-prohibited",
    ]));
    expect(fused.conflicts).toHaveLength(1);
  });

  it("prefers the direct controlling value over an ineligible lower-authority record", () => {
    const controlling = evidence(
      "controlling-response",
      "Respond within 30 days.",
      "controlling-legal-record",
      1,
    );
    const secondary = evidence(
      "secondary-response",
      "Respond within 45 days.",
      "official-record",
      6,
    );
    const groups = emptyGroups();
    groups.component = [
      component(
        "controlling-response-duty",
        "Respond within 30 days.",
        "controlling-response",
      ),
      component(
        "secondary-response-duty",
        "Respond within 45 days.",
        "secondary-response",
      ),
    ];

    const fused = fuseScreen03ProposalSources(groups, [controlling, secondary]);

    expect(fused.proposals.component).toEqual([
      expect.objectContaining({
        id: "controlling-response-duty",
        support: "direct",
        sourceIds: ["controlling-response"],
        passageIds: ["passage-controlling-response"],
      }),
    ]);
    expect(fused.conflicts).toEqual([]);
  });

  it("ranks an official record above a related-secondary passage at the same tier", () => {
    const official = evidence(
      "official-response",
      "Respond within 30 days.",
      "official-record",
      6,
    );
    const related = evidence(
      "related-response",
      "Respond within 45 days.",
      "related-secondary-record",
      6,
    );
    const groups = emptyGroups();
    groups.component = [
      component(
        "official-response-duty",
        "Respond within 30 days.",
        "official-response",
      ),
      component(
        "related-response-duty",
        "Respond within 45 days.",
        "related-response",
      ),
    ];

    expect(screen03EvidenceSourceRole(related)).toBe(
      "related-secondary-record",
    );
    const fused = fuseScreen03ProposalSources(groups, [related, official]);

    expect(fused.proposals.component).toEqual([
      expect.objectContaining({
        id: "official-response-duty",
        sourceIds: ["official-response"],
        passageIds: ["passage-official-response"],
      }),
    ]);
    expect(fused.conflicts).toEqual([]);
  });

  it("selects one stable representative across many conflicting sources", () => {
    const tail = " under the reviewed reporting program".repeat(45);
    const frequencies = ["annual", "quarterly", "monthly", "daily"];
    const evidenceItems = frequencies.map((frequency) => evidence(
      `long-${frequency}`,
      `Covered businesses must file ${frequency} reports${tail}.`,
    ));
    const groups = emptyGroups();
    groups.component = frequencies.map((frequency) => component(
      `long-${frequency}-duty`,
      `Covered businesses must file ${frequency} reports${tail}.`,
      `long-${frequency}`,
    ));
    const fused = fuseScreen03ProposalSources(groups, evidenceItems);
    expect(fused.proposals.component).toEqual([
      expect.objectContaining({
        id: "long-annual-duty",
        support: "conflicting",
      }),
    ]);
    expect(fused.conflicts).toHaveLength(1);

    const validated = requireScreen03ResearchPacket({
      protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
      researchedAt,
      upstreamEventFingerprint: "fnv1a64:1111111111111111",
      coverage: {
        queries: [],
        channels: [],
        routes: [],
        stages: [],
        languages: ["en"],
        authorityTiers: [2],
        gaps: [],
        recordsReviewed: evidenceItems.length,
        activeEvidenceCount: evidenceItems.length,
        exhaustive: false,
        stoppingRule: { rule: "fixture", status: "met", note: "fixture" },
        outcomeValuesInspected: false,
      },
      evidence: evidenceItems,
      proposals: fused.proposals,
      contradictions: [],
      outcomeValuesInspected: false,
    });
    expect(compileScreen03ExactExcerpts(validated).contradictions).toEqual([]);
  });

  it("keeps one exact-reference representative and requires conflict resolution", () => {
    const first = evidence(
      "effective-a",
      "FR Doc. 2014-21513. Official date: January 1, 2020.",
    );
    const second = evidence(
      "effective-b",
      "FR Doc. 2014-21513. Official date: February 1, 2020.",
    );
    const groups = emptyGroups();
    groups.identity = [{
      ...component("formal-identity", "2014-21513", "effective-a"),
      group: "identity",
      label: "Formal identifier",
      sourceIds: ["effective-a", "effective-b"],
      passageIds: ["passage-effective-a", "passage-effective-b"],
    }];
    groups.timeline = [
      timeline(
        "effective-a-date",
        "Reported effective date",
        "2020-01-01",
        "effective-a",
      ),
      timeline(
        "effective-b-date",
        "Effective date or application",
        "2020-02-01",
        "effective-b",
      ),
    ];
    const fused = fuseScreen03ProposalSources(groups, [first, second]);
    expect(fused.proposals.timeline).toHaveLength(1);
    const representative = fused.proposals.timeline[0]!;
    expect(representative).toMatchObject({ support: "conflicting" });
    expect(first.passages[0]!.text).toContain("January 1, 2020");
    expect(second.passages[0]!.text).not.toContain("January 1, 2020");
    expect(fused.conflicts).toHaveLength(1);

    const handoff = manufacturingCouncilHandoff();
    const packet: Screen03ResearchPacket = {
      protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
      researchedAt,
      upstreamEventFingerprint: handoff.integrity.eventFingerprint,
      coverage: {
        queries: [],
        channels: [],
        routes: [],
        stages: ["effective/application"],
        languages: ["en"],
        authorityTiers: [2],
        gaps: [],
        recordsReviewed: 2,
        activeEvidenceCount: 2,
        exhaustive: false,
        stoppingRule: { rule: "fixture", status: "met", note: "fixture" },
        outcomeValuesInspected: false,
      },
      evidence: [first, second],
      proposals: groups,
      contradictions: [],
      outcomeValuesInspected: false,
    };
    const compiled = compileScreen03ExactExcerpts(
      requireScreen03ResearchPacket(packet),
    );
    expect(compiled.proposals.timeline).toEqual([representative]);
    expect(compiled.contradictions).toEqual([
      expect.objectContaining({
        kind: "source-conflict",
        proposalIds: [representative.id],
        status: "unresolved",
      }),
    ]);
    const compiledAgain = compileScreen03ExactExcerpts(compiled);
    expect(compiledAgain.contradictions).toEqual(compiled.contradictions);

    const state = buildScreen03StateFromResearch(
      handoff,
      compiledAgain,
      "2026-08-14T15:00:01.000Z",
    );
    expect(() => applyScreen03Action(state, {
      type: "review-field",
      proposalId: representative.id,
      decision: "accept",
      reason: "The retained passage states the representative date.",
      at: "2026-08-14T15:00:02.000Z",
    })).toThrow(/active direct passage/i);
    expect(() => applyScreen03Action(state, {
      type: "review-field",
      proposalId: representative.id,
      decision: "edit",
      editedValue: "2020-02-01",
      reason: "Attempt to substitute the discarded alternative date.",
      at: "2026-08-14T15:00:02.000Z",
    })).toThrow(/active direct passage/i);
  });
});
