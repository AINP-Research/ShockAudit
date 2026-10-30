import { describe, expect, it, vi } from "vitest";

import {
  assessStudyFirstMechanismInput,
  createStudyFirstMechanismInput,
} from "../../src/core/six-screen/study-first-mechanism-comparison";
import {
  currentStudyFirstEventInvestigation,
} from "../../src/core/six-screen/study-first-event-investigation";
import {
  openScreen3,
  openScreen4,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { executeStudyFirstMechanismDiscovery } from
  "../../src/worker/screen05-study-first-mechanism";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

const study: StudyContextDraft = {
  population: "U.S. public manufacturers",
  analysisUnit: "firm-year",
  geography: ["United States", "California"],
  industry: ["Manufacturing"],
  period: { start: "2010", end: "2025" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection",
  initialExplanation: "Through increased customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

function context() {
  const fixture = createBrowserEventCardFixture();
  const screen3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study,
    proposedTiming: {
      mode: "year",
      year: 2023,
      milestoneReference: null,
    },
    openedAt: "2026-09-20T20:00:00.000Z",
  });
  const screen4 = openScreen4(screen3.state, {
    expectedRevision: screen3.state.revision,
    openedAt: "2026-09-20T20:00:01.000Z",
  });
  const investigation = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations:
      screen4.state.studyFirstEventInvestigations,
    confirmedShock: screen4.state.confirmedShock,
    study: screen4.state.study,
    entryContext: screen4.state.screen3StudyEntryContexts!.at(-1)!,
    timing: screen4.state.proposedTreatmentTimings!.at(-1)!,
    advice: screen4.state.studyDesignAdvices!.at(-1)!,
    selection: null,
  });
  if (!investigation) throw new Error("Missing study-first context fixture.");
  return investigation.context;
}

function openAlexRecord(withAbstract = true) {
  return {
    id: "https://openalex.org/W1234567890",
    doi: "https://doi.org/10.1234/MECHANISM.1",
    display_name: "Privacy governance and customer response",
    authorships: [{ author: { display_name: "Ada Researcher" } }],
    publication_year: 2024,
    publication_date: "2024-03-01",
    primary_location: {
      is_oa: true,
      landing_page_url: "https://journal.example/mechanism-1",
      pdf_url: null,
      version: "publishedVersion",
      license: "cc-by",
      source: {
        display_name: "Journal of Organizational Response",
        type: "journal",
        host_organization_name: "Research Publisher",
      },
    },
    best_oa_location: null,
    type: "article",
    language: "en",
    is_retracted: false,
    abstract_inverted_index: withAbstract
      ? {
          Privacy: [0],
          controls: [1],
          may: [2],
          increase: [3],
          customer: [4],
          trust: [5],
        }
      : null,
    content_urls: { pdf: null, grobid_xml: null },
  };
}

function crossrefRecord(withAbstract = true) {
  return {
    DOI: "10.1234/mechanism.1",
    title: ["Privacy governance and customer response"],
    author: [{ given: "Ada", family: "Researcher" }],
    publisher: "Research Publisher",
    "container-title": ["Journal of Organizational Response"],
    "published-online": { "date-parts": [[2024, 3, 1]] },
    type: "journal-article",
    URL: "https://doi.org/10.1234/mechanism.1",
    abstract: withAbstract
      ? "<jats:p>Privacy controls may increase customer trust.</jats:p>"
      : undefined,
  };
}

function sourceFetch(input: { withAbstract?: boolean; crossrefFails?: boolean } = {}) {
  return vi.fn(async (request: RequestInfo | URL) => {
    const url = String(request);
    if (url.includes("api.openalex.org")) {
      return new Response(JSON.stringify({
        meta: { count: 1 },
        results: [openAlexRecord(input.withAbstract !== false)],
      }), { headers: { "content-type": "application/json" } });
    }
    if (input.crossrefFails) return new Response(null, { status: 503 });
    return new Response(JSON.stringify({
      message: { items: [crossrefRecord(input.withAbstract !== false)] },
    }), { headers: { "content-type": "application/json" } });
  });
}

describe("study-first Screen 5 scholarly mechanism discovery", () => {
  it("preserves exact researcher text, inspects real abstract fields, and deduplicates provider identities", async () => {
    const frozen = context();
    const mechanismInput = createStudyFirstMechanismInput({
      id: "screen5-input-1",
      revision: 1,
      contextFingerprint: frozen.contextFingerprint,
      theoreticalPerspective: null,
      proposedMechanism:
        "Firms improve privacy controls, which increases customer trust and may improve performance.",
      savedAt: "2026-09-20T20:00:02.000Z",
    });
    const assessment = assessStudyFirstMechanismInput({
      theoreticalPerspective: mechanismInput.theoreticalPerspective,
      proposedMechanism: mechanismInput.proposedMechanism,
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    });
    const fetch = sourceFetch();
    const result = await executeStudyFirstMechanismDiscovery({
      id: "screen5-run-1",
      ordinal: 1,
      previousRunId: null,
      context: frozen,
      mechanismInput,
      inputAssessment: assessment,
      fetch,
      now: () => "2026-09-20T20:00:03.000Z",
    });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({
      status: "scholarly_evidence_ready",
      input: {
        theoreticalPerspective: null,
        proposedMechanism: mechanismInput.proposedMechanism,
      },
      hostComparison: { status: "available_via_signed_host_task" },
      works: [{
        doi: "10.1234/mechanism.1",
        access: {
          level: "abstract_inspected",
          abstractText: "Privacy controls may increase customer trust.",
        },
      }],
    });
    expect(result.works).toHaveLength(1);
    expect(result.works[0]!.providerIds.map(({ provider }) => provider).sort())
      .toEqual(["crossref", "openalex"]);
    expect(result.searchPlan.publicationWindowRule).toBe(
      "study_period_does_not_limit_scholarship_publication_year",
    );
    expect(result.searchPlan.providerOperationCeiling).toBe(4);
    expect(result.attempts.map(({ intent }) => intent)).toEqual([
      "focal_process",
      "analogous_process",
      "same_outcome_rival",
      "boundary_or_distinguishing_observation",
    ]);
    expect(result.phases).toMatchObject({
      retrieval: "complete",
      synthesis: "pending",
      validation: "pending",
    });
  });

  it("keeps a provider failure partial and metadata-only evidence unable to start synthesis", async () => {
    const frozen = context();
    const mechanismInput = createStudyFirstMechanismInput({
      id: "screen5-input-2",
      revision: 1,
      contextFingerprint: frozen.contextFingerprint,
      theoreticalPerspective: "Organizational adaptation",
      proposedMechanism:
        "Managers change data practices, which may alter customer acquisition costs.",
      savedAt: "2026-09-20T20:00:02.000Z",
    });
    const result = await executeStudyFirstMechanismDiscovery({
      id: "screen5-run-2",
      ordinal: 1,
      previousRunId: null,
      context: frozen,
      mechanismInput,
      inputAssessment: assessStudyFirstMechanismInput({
        theoreticalPerspective: mechanismInput.theoreticalPerspective,
        proposedMechanism: mechanismInput.proposedMechanism,
        policyTitle: frozen.policy.officialTitle,
        outcome: frozen.study.outcome,
      }),
      fetch: sourceFetch({ withAbstract: false, crossrefFails: true }),
      now: () => "2026-09-20T20:00:03.000Z",
    });

    expect(result.status).toBe("retrieval_partial");
    expect(result.works.every(({ access }) =>
      access.level === "metadata_only")).toBe(true);
    expect(result.hostComparison).toMatchObject({ status: "not_started" });
    expect(result.hostComparison.limitation).toMatch(/No scholarly abstract/iu);
  });

  it("saves a theory-only clarification without making a source request", async () => {
    const frozen = context();
    const mechanismInput = createStudyFirstMechanismInput({
      id: "screen5-input-3",
      revision: 1,
      contextFingerprint: frozen.contextFingerprint,
      theoreticalPerspective: null,
      proposedMechanism: "Agency theory",
      savedAt: "2026-09-20T20:00:02.000Z",
    });
    const assessment = assessStudyFirstMechanismInput({
      theoreticalPerspective: null,
      proposedMechanism: mechanismInput.proposedMechanism,
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    });
    const fetch = sourceFetch();
    const result = await executeStudyFirstMechanismDiscovery({
      id: "screen5-run-3",
      ordinal: 1,
      previousRunId: null,
      context: frozen,
      mechanismInput,
      inputAssessment: assessment,
      fetch,
      now: () => "2026-09-20T20:00:03.000Z",
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.status).toBe("needs_clarification");
    expect(result.input.proposedMechanism).toBe("Agency theory");
    expect(result.inputAssessment.clarification).toMatch(
      /who responds.*what they do or perceive/iu,
    );
  });

  it("accepts a concise or non-English process without requiring a narrow English verb pattern", () => {
    const frozen = context();
    expect(assessStudyFirstMechanismInput({
      theoreticalPerspective: null,
      proposedMechanism: "Costs reduce margins",
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    }).status).toBe("ready");
    expect(assessStudyFirstMechanismInput({
      theoreticalPerspective: null,
      proposedMechanism: "Costs → margins",
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    }).status).toBe("ready");
    expect(assessStudyFirstMechanismInput({
      theoreticalPerspective: null,
      proposedMechanism:
        "Beschränkter Datenzugang verändert die Kundengewinnung",
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    }).status).toBe("ready");
    expect(assessStudyFirstMechanismInput({
      theoreticalPerspective: null,
      proposedMechanism: "Customer trust",
      policyTitle: frozen.policy.officialTitle,
      outcome: frozen.study.outcome,
    }).status).toBe("needs_clarification");
  });
});
