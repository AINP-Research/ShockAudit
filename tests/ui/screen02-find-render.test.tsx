import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createScreen02FindState,
  prepareScreen02AssessmentRequest,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  applyScreen02FindCandidateSourceFallback,
  applyScreen02FindCriterionDraftReceipt,
  applyScreen02FindCandidateDraftReceipt,
  createScreen02FindDraftReceipt,
  markScreen02FindRequestsDelivered,
  openScreen02FindCandidate,
  prepareScreen02FindAssessmentJobs,
  replaceScreen02FindCriteria,
  screen02FindRequestProof,
} from "../../src/core/screen02-find-workflow";
import {
  applyReviewedScreen02FindDiscovery,
  buildScreen02SearchFunnel,
} from "../../src/core/screen02-find-discovery";
import {
  screen02FindAssessmentPartIds,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import Screen02Find from "../../src/ui/screen-02-find/Screen02Find";
import Screen02HostReviewDetails from
  "../../src/ui/host-task/Screen02HostReviewDetails";
import {
  SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
} from "../../src/ui/host-task/screen02-host-post-render";
import { screen02HostReviewSummary } from
  "../../src/ui/host-task/host-task-client";
import {
  buildScreen02StudyRelevanceProfile,
  mergeScreen02StudyRelevanceProfileResearcherEdits,
  mergeScreen02StudyRelevanceProfileHostAdditions,
} from "../../src/core/screen02-relevance-profile";
import { screen02FindProfileFormKey } from
  "../../src/ui/screen-02/Screen02WorkflowShell";
import { screen02FindCopy } from "../../src/ui/screen-02-find/content";
import {
  buildScreen02FindViewModel,
  screen02FindTerminalNotice,
} from "../../src/ui/screen-02-find/find-view-model";
import {
  buildFindFactsState,
  buildFixedQualifiedFindState,
  buildReadyFindState,
  confirmedWorkflowFindContext,
  fixtureAt,
  workflowSource,
} from "../core/screen02-workflow-fixtures";

function callbacks() {
  return {
    onSearch: vi.fn(),
    onOpenCandidate: vi.fn(),
    onRemoveCandidate: vi.fn(),
    onRetryCandidate: vi.fn(),
    onOverrideCriterion: vi.fn(),
    onSelectCandidate: vi.fn(),
    onClearSelection: vi.fn(),
    onContinue: vi.fn(),
    onContinueWithoutAssessment: vi.fn(),
    onSaveRelevanceProfile: vi.fn(),
    onEditStudy: vi.fn(),
    onReset: vi.fn(),
  };
}

function assessmentUnavailableState() {
  let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
    jobId: "ui-find-unavailable-job",
    requestId: "ui-find-unavailable-request",
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "ui-find-unavailable-request",
    status: "delivery-rejected",
    at: "2026-08-09T18:00:03.000Z",
    actor: "chatgpt-host",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  state = selectScreen02FindCandidate(
    state,
    "gdpr-candidate-snapshot-v1",
    "ui-find-unavailable-selection",
    "2026-08-09T18:00:04.000Z",
    "Researcher tentatively selected the source-backed candidate after terminal delivery failure.",
  );
  return state;
}

function renderState(state: Screen02FindState) {
  return renderToStaticMarkup(
    <Screen02Find state={state} {...callbacks()} />,
  );
}

function visibleText(markup: string) {
  return markup.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function expectProviderNeutral(markup: string) {
  expect(visibleText(markup)).not.toMatch(
    /\b(?:ChatGPT|host|model|MCP|fallback)\b/iu,
  );
}

function readyState(selected = false, partial = false) {
  const requestId = "ui-find-assessment-request-1";
  let state = prepareScreen02FindAssessmentJobs(
    buildFindFactsState(),
    {
      candidate: [
        {
          candidateSnapshotId: "gdpr-candidate-snapshot-v1",
          jobId: "ui-find-assessment-job-1",
          requestId,
        },
      ],
      criteria: [],
    },
    "2026-08-09T18:00:02.000Z",
  );
  state = markScreen02FindRequestsDelivered(state, [requestId], {
    at: "2026-08-09T18:00:03.000Z",
    delivered: true,
  });
  const request = state.assessmentRequests.find(
    (candidateRequest) => candidateRequest.requestId === requestId,
  );
  if (!request) throw new Error("Expected the prepared Find assessment request.");
  const receipt = createScreen02FindDraftReceipt({
    receiptId: "ui-find-assessment-receipt-1",
    kind: "find-candidate",
    receivedAt: "2026-08-09T18:00:04.000Z",
    submissions: [
      {
        requestId,
        requestProof: screen02FindRequestProof(request),
        draft: {
          studyFit: {
            category: "strong",
            explanation:
              "GDPR's application date falls within the study period and its territorial-scope lead makes the foreign-issued event potentially relevant to U.S. firms.",
            evidenceSourceIds: ["gdpr-official"],
          },
          outcomePathway: {
            category: "plausible",
            explanation:
              "Privacy compliance duties may redirect data and engineering resources and alter product experimentation linked to innovation.",
            evidenceSourceIds: ["gdpr-official"],
          },
          measurementPotential: {
            category: "possible",
            explanation:
              "EU establishment, EU-facing services, and monitoring activity provide possible public exposure indicators, subject to Screen 3 verification.",
            evidenceSourceIds: ["gdpr-official"],
          },
          ...(partial
            ? {}
            : {
                mainConcern:
                  "The U.S. technology-firm population is broader than firms demonstrably covered by the current territorial-scope lead.",
              }),
          nextChecks: [
            "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
            "Determine whether exposure varies sufficiently across sampled firms.",
          ],
        },
      },
    ],
  });
  const applied = applyScreen02FindCandidateDraftReceipt(state, receipt);
  expect(applied.results).toEqual([
    expect.objectContaining({
      requestId,
      status: partial ? "partial" : "completed",
    }),
  ]);
  state = openScreen02FindCandidate(applied.state, {
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    decisionId: "ui-open-gdpr",
    at: "2026-08-09T18:00:05.000Z",
  });
  return selected
    ? selectScreen02FindCandidate(
        state,
        "gdpr-candidate-snapshot-v1",
        "ui-select-gdpr",
        "2026-08-09T18:00:06.000Z",
        "Researcher tentatively selected the source-backed candidate.",
      )
    : state;
}

function fixedFallbackState() {
  const requestId = "ui-find-ccpa-fixed-fallback-request";
  let state = buildFindFactsState({
    candidate: "ccpa",
    outcomeFamily: "Profitability",
  });
  const candidate = state.candidates[0];
  if (!candidate) throw new Error("Expected the CCPA Find candidate.");
  state = prepareScreen02AssessmentRequest(state, {
    jobId: "ui-find-ccpa-fixed-fallback-job",
    requestId,
    mode: "find-candidate",
    candidateSnapshotId: candidate.candidateSnapshotId,
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  }) as Screen02FindState;
  state = markScreen02FindRequestsDelivered(state, [requestId], {
    at: "2026-08-09T18:00:03.000Z",
    delivered: true,
  });
  state = applyScreen02FindCandidateSourceFallback(
    state,
    requestId,
    "2026-08-09T18:00:04.000Z",
  ).state;
  return openScreen02FindCandidate(state, {
    candidateSnapshotId: candidate.candidateSnapshotId,
    decisionId: "ui-open-ccpa-fixed-fallback",
    at: "2026-08-09T18:00:05.000Z",
  });
}

function temporarilyUnavailableState() {
  let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
    jobId: "ui-find-temporary-unavailable-job",
    requestId: "ui-find-temporary-unavailable-request",
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-09T18:00:02.000Z",
  });
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "ui-find-temporary-unavailable-request",
    status: "delivery-rejected",
    at: "2026-08-09T18:00:03.000Z",
    actor: "chatgpt-host",
  });
  if (state.mode !== "find") throw new Error("Expected Find state.");
  return state;
}

function emptyOutcomeState(options: {
  failedChannel?: boolean;
  retrievalFailures?: number;
} = {}) {
  const state = structuredClone(buildFindFactsState());
  const activeSet = state.candidateSets.find(
    (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  if (!activeSet) throw new Error("Expected an active Find candidate set.");
  const retrievalFailures = options.retrievalFailures ?? 0;
  activeSet.candidateSnapshotIds = [];
  activeSet.ordering = [];
  activeSet.manifest.queryMatrix = activeSet.manifest.queryMatrix.map((query) => ({
    ...query,
    returnedRecordIds: [],
  }));
  activeSet.manifest.channels = [{
    channel: "official-primary",
    status: options.failedChannel ? "failed" : "searched",
    note: options.failedChannel
      ? "The official route could not be searched."
      : "The official route was searched.",
    retrievedAt: options.failedChannel ? null : activeSet.manifest.retrievedAt,
  }];
  activeSet.manifest.funnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved: 0,
    uniqueEventLeads: 0,
    qualifications: [],
    displayedCandidates: 0,
    deeperRetrievalAttempts: retrievalFailures,
    retrievalFailures,
  });
  activeSet.manifest.stoppingRule = {
    rule: "Stop after the bounded routes finish.",
    status: options.failedChannel || retrievalFailures > 0 ? "not-met" : "met",
    note: options.failedChannel || retrievalFailures > 0
      ? "At least one search route did not finish."
      : "The bounded routes finished without a qualified candidate.",
  };
  state.decision.openedCandidateSnapshotId = null;
  state.decision.tentativeSelectionSnapshotId = null;
  return state;
}

function factsWithIndependentCriterion() {
  const withCriterion = replaceScreen02FindCriteria(
    buildFindFactsState(),
    [
      {
        criterionId: "government-imposed",
        kind: "only-include",
        text: "Government-imposed changes",
        exactRequest: "Only include government-imposed changes.",
        source: "researcher",
      },
    ],
    {
      at: "2026-08-09T18:00:10.000Z",
      successorCandidateSetSnapshotId: "find-candidate-set-with-criterion-v1",
      reason: "Researcher added an optional screening condition.",
    },
  );
  return openScreen02FindCandidate(withCriterion, {
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    decisionId: "open-gdpr-with-criterion",
    at: "2026-08-09T18:00:11.000Z",
  });
}

function factsWithResolvedCriterion() {
  const requestId = "ui-government-criterion-request";
  let state = replaceScreen02FindCriteria(
    buildFindFactsState(),
    [
      {
        criterionId: "government-imposed",
        kind: "only-include",
        text: "Government-imposed changes",
        exactRequest: "Only include government-imposed changes.",
        source: "researcher",
      },
    ],
    {
      at: "2026-08-09T18:01:00.000Z",
      successorCandidateSetSnapshotId: "find-candidate-set-resolved-criterion",
      reason: "Add the approved strict criterion.",
    },
  );
  state = prepareScreen02FindAssessmentJobs(
    state,
    {
      candidate: [
        {
          candidateSnapshotId: "gdpr-candidate-snapshot-v1",
          jobId: "ui-resolved-candidate-job",
          requestId: "ui-resolved-candidate-request",
        },
      ],
      criteria: [
        {
          candidateSnapshotId: "gdpr-candidate-snapshot-v1",
          criterionId: "government-imposed",
          criterionVersion: 1,
          jobId: "ui-government-criterion-job",
          requestId,
        },
      ],
    },
    "2026-08-09T18:01:01.000Z",
  );
  state = markScreen02FindRequestsDelivered(state, [requestId], {
    at: "2026-08-09T18:01:02.000Z",
    delivered: true,
  });
  const request = state.assessmentRequests.find(
    (candidateRequest) => candidateRequest.requestId === requestId,
  );
  if (!request) throw new Error("Expected the prepared criterion request.");
  const applied = applyScreen02FindCriterionDraftReceipt(
    state,
    createScreen02FindDraftReceipt({
      receiptId: "ui-government-criterion-receipt",
      kind: "find-criterion",
      receivedAt: "2026-08-09T18:01:03.000Z",
      submissions: [
        {
          requestId,
          requestProof: screen02FindRequestProof(request),
          draft: {
            result: "meets",
            reason:
              "The official regulation is a binding public measure imposed by the European Parliament and Council.",
            evidenceSourceIds: ["gdpr-official"],
          },
        },
      ],
    }),
  );
  return openScreen02FindCandidate(applied.state, {
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    decisionId: "ui-open-resolved-criterion",
    at: "2026-08-09T18:01:04.000Z",
  });
}

describe("isolated Stage 3 Screen 2 Find UI", () => {
  it("renders the exact Stage 0 hierarchy and a blank optional search", () => {
    const blank = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "ui-blank-find-run",
      fixtureAt,
    );
    const html = renderState({
      ...blank,
      relevanceProfile: buildScreen02StudyRelevanceProfile({
        scopeFingerprint: blank.screen01Fingerprint,
        originalIndustryText: blank.screen01Baseline.scopeContract.industry,
        sampleGeography: blank.screen01Baseline.scopeContract.geography,
        studyPeriod: blank.screen01Baseline.scopeContract.studyPeriod,
        eventFamily: blank.screen01Baseline.scopeContract.eventFamily,
        at: fixtureAt,
      }),
    } as Screen02FindState);

    expect(html).toContain(screen02FindCopy.eyebrow);
    expect(html).toContain(`<h1>${screen02FindCopy.title}</h1>`);
    expect(html).toContain(
      "Search documented sources for candidate shocks that fit your confirmed study.",
    );
    expect(html).toContain(screen02FindCopy.studyTitle);
    expect(html).toContain("Edit on Screen 1");
    expect(html).toContain("Reset Screen 2");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Reset Screen 2?");
    expect(html).toContain("Only include shocks that…");
    expect(html).toContain("Rank higher shocks that…");
    expect(html).toContain("Do not show shocks that…");
    expect(html).toContain("All fields may be left blank");
    expect(html).toContain("Find candidate shocks");
    expect(html).toContain("Inspect or edit the study profile");
    expect(html).toContain('name="industryAliases"');
    expect(html).toContain("Save profile");
    expect(html).toContain("Open full Screen 1 editor");
    expect(html).not.toContain("Plan with ChatGPT and find candidate shocks");
    expect(html).toContain("Temporary workflow data");
    expect(html).toContain("Inactive runs expire within");
    expect(html).not.toContain("Candidate shocks</h2>");
    expect(html).not.toContain("Criteria findings");
    expectProviderNeutral(html);
  });

  it("offers keyboard-native clarification choices and blocks an ambiguous search", () => {
    const blank = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "ui-ambiguous-profile-run",
      fixtureAt,
    );
    const state = {
      ...blank,
      relevanceProfile: buildScreen02StudyRelevanceProfile({
        scopeFingerprint: blank.screen01Fingerprint,
        originalIndustryText: "Gaming",
        sampleGeography: blank.screen01Baseline.scopeContract.geography,
        studyPeriod: blank.screen01Baseline.scopeContract.studyPeriod,
        eventFamily: blank.screen01Baseline.scopeContract.eventFamily,
        at: fixtureAt,
      }),
    } as Screen02FindState;
    const html = renderState(state);

    expect(html).toContain('data-testid="screen02-profile-clarification"');
    expect(html).toContain("Which kind of gaming is in scope?");
    expect(html).toContain("Video gaming");
    expect(html).toContain("Gambling and wagering");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Industry interpretation choices"');
    expect(html).toContain('data-testid="screen02-profile-search-blocked"');
    const findButton = html.match(
      /<button class="s2-find-button"[^>]*>Find candidate shocks<\/button>/u,
    )?.[0];
    expect(findButton).toBeDefined();
    expect(findButton).toContain('disabled=""');
    expect(findButton).toContain(
      'aria-describedby="s2-find-profile-search-blocked"',
    );
  });

  it("remounts profile inputs after an interpretation choice so Save cannot replay stale defaults", () => {
    const blank = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "ui-profile-alternative-remount-run",
      fixtureAt,
    );
    const ambiguous = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: blank.screen01Fingerprint,
      originalIndustryText: "Gaming",
      sampleGeography: blank.screen01Baseline.scopeContract.geography,
      studyPeriod: blank.screen01Baseline.scopeContract.studyPeriod,
      eventFamily: blank.screen01Baseline.scopeContract.eventFamily,
      at: fixtureAt,
    });
    const videoGaming = ambiguous.interpretationAlternatives.find(
      (alternative) => alternative.canonicalLabel === "Video gaming",
    );
    expect(videoGaming).toBeDefined();
    const resolved = mergeScreen02StudyRelevanceProfileResearcherEdits(
      ambiguous,
      {
        canonicalIndustryLabel: videoGaming!.canonicalLabel,
        canonicalIndustryCode: videoGaming!.canonicalCode,
      },
      "2026-08-09T18:00:01.000Z",
    );

    expect(screen02FindProfileFormKey(resolved)).not.toBe(
      screen02FindProfileFormKey(ambiguous),
    );
    const html = renderState({
      ...blank,
      relevanceProfile: resolved,
    } as Screen02FindState);
    expect(html).toContain('name="canonicalIndustryLabel" value="Video gaming"');
    expect(html).toContain(
      `name="industryAliases" value="${resolved.industryAliases.join(", ")}"`,
    );
    expect(html).toContain(videoGaming!.canonicalCode);
  });

  it("derives the deterministic profile for a compatible profile-less state", () => {
    const compatible = structuredClone(createScreen02FindState(
      confirmedWorkflowFindContext(),
      "ui-profileless-run",
      fixtureAt,
    ));
    delete (compatible as unknown as Record<string, unknown>).relevanceProfile;
    const html = renderState(compatible);

    expect(html).not.toContain('data-testid="screen02-profile-search-blocked"');
    expect(html).toContain("Inspect or edit the study profile");
    const findButton = html.match(
      /<button class="s2-find-button"[^>]*>Find candidate shocks<\/button>/u,
    )?.[0];
    expect(findButton).toBeDefined();
    expect(findButton).not.toContain('disabled=""');
  });

  it("renders a source-backed card with an accessible pending assessment and stable disabled choice", () => {
    const html = renderState(buildFindFactsState());

    expect(html).toContain(screen02FindCopy.listTitle);
    expect(html).toContain(
      "Every candidate is screened against the same scope, evidence, relevance, and exposure requirements.",
    );
    expect(html).toContain("General Data Protection Regulation");
    expect(html).toContain("Source-backed fact · Provisional");
    expect(html).toContain("What happened");
    expect(html).toContain("Issuing authority");
    expect(html).toContain("Issuing jurisdiction");
    expect(html).toContain("Main date lead");
    expect(html).toContain("Who may be affected");
    expect(html).toContain("Preparing the source-backed assessment…");
    expect(html).toContain(
      "The source-backed facts are ready now.",
    );
    expect(html).toContain(
      '<p class="s2-find-status" role="status" aria-busy="true"><span class="s2-find-spinner" aria-hidden="true"></span>',
    );
    const chooseButton = html.match(
      /<button class="s2-find-button" type="button"[^>]*>[\s\S]*?Investigate this shock<\/button>/,
    )?.[0];
    expect(chooseButton).toBeDefined();
    expect(chooseButton).toContain('disabled=""');
    expect(chooseButton).toContain(
      'aria-describedby="s2-find-gate-gdpr-candidate-snapshot-v1"',
    );
    expect(chooseButton).toContain(
      '<span class="s2-find-spinner" aria-hidden="true"></span>',
    );
    expect(html).toContain(
      "Choose becomes available when this candidate’s assessment and required criteria finish.",
    );
    expect(html).toContain(
      "The card remains available to review while the assessment is in progress.",
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Continue to Screen 3: Verify event<\/button>/,
    );
    expectProviderNeutral(html);
  });

  it("renders the exact direct/adjacent and broad qualification sections", () => {
    const historicalBest = renderState(buildFindFactsState());
    expect(historicalBest).toContain(
      "Best matches for your industry and study",
    );

    const qualified = buildFixedQualifiedFindState(
      "ui-qualified-sections-run",
    );
    const deterministicView = buildScreen02FindViewModel(qualified);
    const deterministicHtml = renderState(qualified);
    expect(deterministicView.status).toBe("ready");
    expect(deterministicView.assessmentCounts).toEqual({
      ready: 0,
      total: 0,
      pending: 0,
    });
    expect(deterministicHtml).toContain("No assessments requested");
    expect(deterministicHtml).toContain("Direct · Source-backed candidate");
    expect(deterministicHtml).not.toContain("Assessment in progress");
    expect(deterministicHtml).not.toContain("Preparing assessment");
    expect(deterministicHtml).not.toContain("s2-find-aggregate-notice");
    expect(deterministicHtml).not.toContain("s2-find-assessment\"");

    const broadState = structuredClone(qualified);
    const broadCandidate = broadState.candidates[0];
    if (!broadCandidate?.qualification) {
      throw new Error("Expected one fixed-qualified UI candidate.");
    }
    broadCandidate.qualification = {
      ...broadCandidate.qualification,
      classification: "broad",
      section: "broader",
      industryFit: {
        ...broadCandidate.qualification.industryFit,
        explanation:
          "Attached source-derived facts establish a broad cross-industry pathway for the confirmed study population.",
      },
    };
    const html = renderState(broadState);

    expect(html).toContain(
      "Broader shocks that may also affect your firms",
    );
    expect(html).toContain(
      "Source-backed qualification · Preliminary",
    );
    expect(html).toContain("Why this candidate is shown");
    expect(html).toContain("Qualification score");
    expect(html).toContain(
      "Screen 3 performs that independent verification",
    );
    expectProviderNeutral(deterministicHtml);
    expectProviderNeutral(html);
  });

  it("pauses workflow controls while a canonical mutation is pending", () => {
    const busy = renderToStaticMarkup(
      <Screen02Find state={readyState()} busy {...callbacks()} />,
    );
    const idle = renderState(readyState());

    expect(busy).toContain(
      'class="s2-find-workspace-lock" disabled="" aria-busy="true"',
    );
    expect(idle).not.toContain(
      'class="s2-find-workspace-lock" disabled=""',
    );
    expect(idle).toMatch(
      /<button(?![^>]*disabled)[^>]*>Investigate this shock<\/button>/,
    );
  });

  it("keeps ordinary search copy provider-neutral when wider search is unavailable", () => {
    const blank = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "ui-no-model-find-run",
      fixtureAt,
    );
    const html = renderToStaticMarkup(
      <Screen02Find
        state={blank}
        {...callbacks()}
        chatGptPlanningAvailable={false}
      />,
    );

    expect(html).toContain("Find candidate shocks");
    expect(html).toContain(
      "ShockAudit searches its reviewed records and supported public sources.",
    );
    expect(html).not.toContain("Wider search is unavailable in this view.");
    expect(html).not.toContain("Search more widely");
    expectProviderNeutral(html);
  });

  it("gates the wider-search action on Screen 2-capable host modes and keeps its label neutral", () => {
    const sourceBacked = buildFindFactsState();
    const disabled = renderToStaticMarkup(
      <Screen02Find
        state={sourceBacked}
        {...callbacks()}
        hostReasoningMode="disabled"
        onAskChatGPT={vi.fn()}
      />,
    );
    const full = renderToStaticMarkup(
      <Screen02Find
        state={sourceBacked}
        {...callbacks()}
        hostReasoningMode="full"
        onAskChatGPT={vi.fn()}
      />,
    );
    const screen02Only = renderToStaticMarkup(
      <Screen02Find
        state={sourceBacked}
        {...callbacks()}
        hostReasoningMode="screen02-only"
        onAskChatGPT={vi.fn()}
      />,
    );

    expect(disabled).not.toContain('data-testid="screen02-host-reasoning-unavailable"');
    expect(disabled).not.toContain(
      "Search more widely",
    );
    expect(full).toContain("Search more widely");
    expect(full).toContain('data-testid="screen02-wider-search-disclosure"');
    expect(full).toContain("Before you search more widely:");
    expect(full).toContain(
      "Bounded assisted reasoning uses the confirmed study context, candidate facts, and source references shown here.",
    );
    expect(full).toContain(
      'aria-describedby="s2-find-wider-search-disclosure"',
    );
    expect(full).not.toContain('data-testid="screen02-host-reasoning-unavailable"');
    expect(screen02Only).toContain("Search more widely");
    expect(screen02Only).toContain(
      'data-testid="screen02-wider-search-disclosure"',
    );
    expect(screen02Only).not.toContain(
      'data-testid="screen02-host-reasoning-unavailable"',
    );
    expectProviderNeutral(disabled);
    expectProviderNeutral(full);
    expectProviderNeutral(screen02Only);
  });

  it("distinguishes a completed empty search from an incomplete search", () => {
    const completedState = emptyOutcomeState();
    const failedChannelState = emptyOutcomeState({ failedChannel: true });
    const failedRetrievalState = emptyOutcomeState({ retrievalFailures: 1 });
    const completed = renderState(completedState);
    const failedChannel = renderState(failedChannelState);
    const failedRetrieval = renderState(failedRetrievalState);

    expect(buildScreen02FindViewModel(completedState).status).toBe(
      "no-suitable-candidate",
    );
    expect(screen02FindTerminalNotice(completedState)).toMatchObject({
      status: "info",
      message: expect.stringContaining("completed with no qualified candidates"),
    });
    expect(completed).toContain('data-search-outcome="complete-empty"');
    expect(completed).toContain(
      "Search completed with no qualified candidates",
    );
    expect(completed).toContain(
      "The bounded search finished, but no candidate met the displayed qualification requirements.",
    );
    expect(completed).toContain("This does not prove that no suitable event exists.");
    expect(completed).toContain(
      'data-testid="screen02-find-retry-empty-search"',
    );
    expect(completed).toContain("Retry search");
    expect(completed).not.toContain("Search more widely");
    expect(completed).toContain(screen02FindCopy.noSelection);
    expect(completed).not.toContain("Search incomplete");

    expect(buildScreen02FindViewModel(failedChannelState).status).toBe(
      "incomplete",
    );
    expect(screen02FindTerminalNotice(failedChannelState)).toMatchObject({
      status: "warning",
      message: expect.stringContaining("cannot support a complete no-match conclusion"),
    });
    expect(failedChannel).toContain('data-search-outcome="incomplete"');
    expect(failedChannel).toContain("Search incomplete");
    expect(failedChannel).toContain("1 source route failed.");
    expect(failedChannel).toContain(
      "this run cannot support a complete no-match conclusion",
    );
    expect(failedChannel).toContain(
      "This does not prove that no suitable event exists.",
    );
    expect(failedChannel).not.toContain(
      'data-testid="screen02-find-retry-empty-search"',
    );

    expect(buildScreen02FindViewModel(failedRetrievalState).status).toBe(
      "incomplete",
    );
    expect(failedRetrieval).toContain("1 deeper retrieval attempt failed.");
    expectProviderNeutral(completed);
    expectProviderNeutral(failedChannel);
    expectProviderNeutral(failedRetrieval);
  });

  it("keeps surviving candidate cards visible beside an incomplete-coverage warning", () => {
    const state = structuredClone(readyState());
    const active = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    if (!active) throw new Error("Expected a current candidate set.");
    active.manifest.channels[0] = {
      ...active.manifest.channels[0]!,
      status: "failed",
      retrievedAt: null,
      note: "The official route could not be completed.",
    };
    active.manifest.funnel = buildScreen02SearchFunnel({
      sourceRecordsRetrieved: state.candidates.length,
      uniqueEventLeads: state.candidates.length,
      qualifications: state.candidates.flatMap((candidate) =>
        candidate.qualification ? [candidate.qualification] : []
      ),
      displayedCandidates: active.candidateSnapshotIds.length,
      deeperRetrievalAttempts: 0,
      retrievalFailures: 1,
    });

    const html = renderState(state);
    const notice = screen02FindTerminalNotice(state);

    expect(notice).toMatchObject({
      status: "warning",
      message: expect.stringContaining("candidates are available"),
    });
    expect(html).toContain('data-testid="screen02-find-incomplete-coverage"');
    expect(html).toContain("Results available — source coverage incomplete");
    expect(html).toContain("1 source route failed.");
    expect(html).toContain("1 deeper retrieval attempt failed.");
    expect(html).toContain("General Data Protection Regulation");
    expect(html.indexOf("source coverage incomplete")).toBeLessThan(
      html.indexOf('class="s2-find-comparison"'),
    );
    expectProviderNeutral(html);
  });

  it("renders a validated structured host review without changing source eligibility", () => {
    const state = structuredClone(buildFindFactsState());
    const activeSet = state.candidateSets.find((set) =>
      set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId
    );
    if (!activeSet) throw new Error("Expected a current candidate set.");
    activeSet.manifest.funnel = buildScreen02SearchFunnel({
      sourceRecordsRetrieved: state.candidates.length,
      uniqueEventLeads: state.candidates.length,
      qualifications: state.candidates.flatMap((candidate) =>
        candidate.qualification ? [candidate.qualification] : []
      ),
      displayedCandidates: activeSet.candidateSnapshotIds.length,
      hostContribution: 2,
    });
    const hostReview = screen02HostReviewSummary({
      schemaVersion: "shockaudit-screen02-host-review-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      review: {
        schemaVersion: "screen-02-pool-host-review-v1",
        taskId: "host-task-one",
        capability: "screen-02-pool-review",
        profileAdditions: { services: ["privacy engineering"] },
        candidateReviews: [{
          candidateId: "gdpr-candidate-snapshot-v1",
          proposedClass: "adjacent",
          industryBridge:
            "Privacy engineering connects the sourced processing duties to the study industry.",
          profileTermsUsed: ["privacy engineering"],
          sourceIdsUsed: ["gdpr-official"],
          sourceSpansUsed: [{
            sourceId: "gdpr-official",
            text: "personal data processing",
          }],
          sampleConnection:
            "EU-facing sampled firms may differ in their documented covered activity.",
          outcomePathway:
            "Preliminary compliance work may redirect engineering resources.",
          mainMismatchOrUncertainty:
            "Organization-level coverage still requires fixed source verification.",
          needsFollowUpRetrieval: true,
          rankingAdjustment: 2,
        }],
        followUpQueries: ["official gdpr implementation source"],
        officialSourceLeads: [],
        conciseRationale: "One bounded follow-up may improve source coverage.",
        hostModel: "host_model_not_exposed",
      },
      enrichedProfile: mergeScreen02StudyRelevanceProfileHostAdditions(
        state.relevanceProfile!,
        { services: ["privacy engineering"] },
        "2026-08-09T18:10:05.000Z",
        {
          promptVersion: "screen02-host-review-prompt-v1",
          taskId: "host-task:screen02-one",
          inputFingerprint: "fnv1a64:0000000000000001",
        },
      ),
      rankings: [{
        candidateId: "gdpr-candidate-snapshot-v1",
        classification: "direct",
        eligible: true,
        baseScore: 80,
        proposedClass: "adjacent",
        eligibilityUnchanged: true,
        rankingAdjustment: 2,
        totalScore: 82,
      }],
      outcomeValuesInspected: false,
    });
    expect(hostReview).not.toBeNull();
    const html = renderToStaticMarkup(
      <Screen02Find
        state={state}
        {...callbacks()}
        hostReasoningMode="full"
        hostTaskStatus={{
          taskId: "host-task-one",
          phase: "completed",
          title: "Optional ChatGPT relevance review",
          message: "ChatGPT review received and validated.",
          retryCount: 0,
        }}
        hostReviewDetails={<Screen02HostReviewDetails
          review={hostReview!}
          candidates={state.candidates}
        />}
        onCheckHostTask={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="screen02-host-review-result"');
    expect(html).toContain("Wider search complete");
    expect(html).toContain(
      "The wider search finished. Any validated suggestions appear below.",
    );
    expect(html).toContain("official gdpr implementation source");
    expect(html).toContain("Suggested class — not eligibility");
    expect(html).toContain("Adjacent");
    expect(html).toContain("Privacy engineering connects");
    expect(html).toContain("EU-facing sampled firms");
    expect(html).toContain("Preliminary compliance work");
    expect(html).toContain("Organization-level coverage still requires");
    expect(html).toContain("Additional source retrieval was suggested.");
    expect(html).toContain(
      "These are preliminary search suggestions, not source facts.",
    );
    expect(html).toContain("cannot establish eligibility");
    expect(html).toContain("2 validated retrieval contributions");
    expect(html).not.toContain("2 accepted query terms");
    expectProviderNeutral(html);

    const pendingHtml = renderToStaticMarkup(
      <Screen02Find
        state={state}
        {...callbacks()}
        hostReasoningMode="full"
        hostTaskStatus={{
          taskId: "host-task-one",
          phase: "applying",
          title: "Optional wider search",
          message: "Applying the exact validated review.",
          retryCount: 0,
        }}
        hostReviewDetails={<Screen02HostReviewDetails
          review={hostReview!}
          candidates={state.candidates}
          reconciliationMarker={{
            schemaVersion:
              SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
            runId: state.runId,
            taskId: "host-task-one",
            resultId: "host-result-one",
            expectedParentRevision: state.revision - 1,
            workflowRevision: state.revision,
            workflowStateFingerprint: "fnv1a64:0011223344556677",
            applicationFingerprint: "fnv1a64:1122334455667788",
            resultFingerprint: "fnv1a64:2233445566778899",
            operationId: "screen02-refresh:one",
          }}
        />}
        onCheckHostTask={vi.fn()}
      />,
    );
    expect(pendingHtml).toContain("Updating search results");
    expect(pendingHtml).toContain(
      `data-host-result-render-marker="${SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION}"`,
    );
    expect(pendingHtml).toMatch(/<details[^>]* open=""/u);
    expect(pendingHtml).toContain("official gdpr implementation source");
  });

  it("shows profile-scoped exposure questions without event-specific UI copy", () => {
    const html = renderState(buildFindFactsState());

    expect(html).toContain("Record provenance");
    expect(html).toContain(
      "Previously reviewed registry event with attached source records.",
    );
    expect(html).not.toContain("refreshed from official sources");
    expect(html).toContain("Event status");
    expect(html).toContain("In force");
    expect(html).toContain("Information needed to identify affected units");
    expect(html).toContain(
      "For U.S. publicly listed technology firms in the United States during 2016–2020, how can “EU-facing goods or services” be determined for each study unit?",
    );
    expect(html).not.toContain(
      "Did the organization offer goods or services to people in the European Union?",
    );
    expect(html).not.toContain(
      "Did the organization do business in California during the relevant period?",
    );
    expect(html).not.toContain("Apparent exposure variables");
    expect(html).toContain("One verification need for Screen 3");
    expect(html).toContain(
      "For GDPR, confirm which U.S. publicly listed technology firms in the United States were actually affected",
    );
    expect(html).not.toContain("current source lead");
    expect(html).not.toContain("Known limitations");
  });

  it("renders a brief sample and outcome assessment with the chosen study scope", () => {
    const state = readyState();
    const html = renderState(state);
    const view = buildScreen02FindViewModel(state);

    expect(view.comparison[0]?.gate.eligible).toBe(true);
    expect(html).not.toContain("Promising to verify");
    expect(html).toContain("Early research assessment");
    expect(html).toContain(
      "This candidate-specific first look uses the sources already found and your confirmed study.",
    );
    expect(html).toContain("How this shock may affect your sample");
    expect(html).toContain("Chosen sample:");
    expect(html).toContain("U.S. publicly listed technology firms");
    expect(html).toContain("Technology");
    expect(html).toContain("United States");
    expect(html).toContain("2016–2020");
    expect(html).not.toContain("Study fit:");
    expect(html).not.toContain("Measurement potential:");
    expect(html).toContain("How this shock may affect Innovation");
    expect(html).toContain("Chosen outcome:");
    expect(html).toContain(
      "Any pathways shown here are hypotheses to investigate, not observed or established causal effects.",
    );
    expect(html).toContain("Their direction and magnitude still need to be tested.");
    expect(html).not.toContain("Outcome pathway:");
    expect(html.match(/s2-find-assessment-component/g)).toHaveLength(2);
    expect(html).not.toContain("What may identify exposure");
    expect(html).not.toContain(
      "EU establishment, EU-facing services, and monitoring activity provide possible public exposure indicators",
    );
    expect(html).toContain("Online sources");
    expect(html).toContain("Preliminary source-linked interpretation");
    expect(html).not.toContain("Fixed computation");
    expect(html).toMatch(
      /<button(?![^>]*disabled)[^>]*>Investigate this shock<\/button>/,
    );
    expect(html).not.toContain("/100");
    expect(html).not.toContain("Full audit");
    expect(html).not.toContain("Likely service");
    expect(html).not.toContain("What to check next");
    expect(html).not.toContain("Evidence used here");
    expect(html).not.toContain("Preliminary assessment not completed");
    expectProviderNeutral(html);
  });

  it("keeps factual coverage unknown while the preliminary interpretation remains separate", () => {
    const state = structuredClone(readyState());
    const candidate = state.candidates[0];
    if (!candidate) throw new Error("Expected the GDPR candidate.");
    candidate.broadCoverage = [];
    const html = renderState(state);

    expect(html).toContain("Not yet established from the online sources.");
    expect(html).toContain("How this shock may affect your sample");
    expect(html).toContain("Preliminary source-linked interpretation");
    expectProviderNeutral(html);
  });

  it("labels the saved source-derived assessment without exposing its recovery mechanism", () => {
    const html = renderState(fixedFallbackState());

    expect(html).toContain("Source-derived preliminary assessment");
    expect(html).toContain("did not arrive before the bounded deadline");
    expect(html).toContain("Used in the source-derived assessment");
    expect(html).toContain(
      "California Consumer Privacy Act could plausibly affect Profitability",
    );
    expect(html).toContain("compliance, technology, and data-governance costs");
    expect(html).toContain("data-enabled products, advertising, and revenue");
    expect(html).toContain("fines, litigation, and other legal exposure");
    expect(html).toContain("trust, retention, or loss-avoidance benefits");
    expect(html).toContain("not an observed or established causal effect");
    expect(html).toContain("direction and magnitude for Profitability remain unknown");
    expect(html).not.toContain("bounded sources do not establish how");
    expect(html).not.toContain("Preliminary source-linked interpretation");
    expect(html).not.toContain("Used in the preliminary assessment");
    expectProviderNeutral(html);
  });

  it("uses simple temporary-unavailable and retry copy for a rejected delivery", () => {
    const html = renderState(temporarilyUnavailableState());

    expect(html).toContain(
      "The brief assessment could not start in this view.",
    );
    expect(html).toContain("Try the brief assessment again");
    expect(html).not.toContain("The assessment request could not be sent");
    expect(html).not.toContain("Retry sending this assessment");
    expectProviderNeutral(html);
  });

  it("lists every candidate URL even when the assessment did not cite it", () => {
    const state = structuredClone(readyState());
    const candidate = state.candidates[0];
    if (!candidate) throw new Error("Expected the GDPR candidate.");
    const backgroundSource = workflowSource("gdpr-background", {
      title: "European Commission GDPR overview",
      locator: "https://commission.europa.eu/law/law-topic/data-protection_en",
      publisher: "European Commission",
      authorityTier: 2,
    });
    state.sources.push(backgroundSource);
    candidate.sourceIds.push(backgroundSource.id);
    const html = renderState(state);

    expect(html).toContain("Online sources");
    expect(html).toContain("Regulation (EU) 2016/679");
    expect(html).toContain("European Commission GDPR overview");
    expect(html).toContain("Used in the preliminary assessment");
  });

  it("combines three related searches with the factual Online sources list", () => {
    const state = readyState();
    const html = renderState(state);
    const view = buildScreen02FindViewModel(state);
    const row = view.opened;
    if (!row) throw new Error("Expected an opened candidate.");

    expect(row.relatedDiscoveryLinks).toHaveLength(3);
    expect(html.match(/<h3>Online sources<\/h3>/g)).toHaveLength(1);
    expect(html).not.toContain("3 more related links");
    expect(html).not.toMatch(/not evidence/i);
    expect(html).toContain(
      "Review the records attached to this candidate and three additional searches related to the shock.",
    );
    expect(html).toContain("Web search for General Data Protection Regulation");
    expect(html).toContain(
      "Scholarly search for General Data Protection Regulation",
    );
    expect(html).toContain(
      "Public-reference search for General Data Protection Regulation",
    );
    expect(state.sources).toHaveLength(1);
    const onlineSourcesMarkup = html.match(
      /<h3>Online sources<\/h3>([\s\S]*?)<\/section>/,
    )?.[1];
    expect(onlineSourcesMarkup).toBeDefined();
    expect(onlineSourcesMarkup).toContain("Regulation (EU) 2016/679");
    for (const link of row.relatedDiscoveryLinks) {
      expect(state.sources.some((source) => source.locator === link.locator)).toBe(
        false,
      );
      expect(onlineSourcesMarkup).toContain(
        link.locator.replaceAll("&", "&amp;"),
      );
    }
  });

  it("keeps the concise main concern but removes the three categorical labels from the candidate row", () => {
    const html = renderState(readyState());
    const rowMarkup = html.match(
      /<button class="s2-find-candidate-row[^>]*>([\s\S]*?)<\/button>/,
    )?.[1];

    expect(rowMarkup).toBeDefined();
    expect(rowMarkup).not.toContain("Assessment comparison");
    expect(rowMarkup).not.toContain("Study fit");
    expect(rowMarkup).not.toContain("Outcome pathway");
    expect(rowMarkup).not.toContain("Measurement potential");
    expect(rowMarkup).toContain("Main concern");
    expect(rowMarkup).toContain(
      "The U.S. technology-firm population is broader than firms demonstrably covered by the current evidence about geographic coverage.",
    );
  });

  it("offers a targeted retry when validation accepts only part of an assessment", () => {
    const html = renderState(readyState(false, true));

    expect(html).toContain(
      "Part of the assessment is ready. Only the missing items need another try.",
    );
    expect(html).toContain("Retry missing assessment parts");
  });

  it("keeps criteria findings independent from candidate assessment completion", () => {
    const state = factsWithIndependentCriterion();
    const html = renderState(state);
    const row = buildScreen02FindViewModel(state).comparison[0];

    expect(row?.criteria).toHaveLength(1);
    expect(row?.criteria[0]?.finding).toBeNull();
    expect(row?.gate.eligible).toBe(false);
    expect(html).toContain("Only include");
    expect(html).toContain("Government-imposed changes");
    expect(html).toContain("Criteria findings");
    expect(html).toContain("Assessment pending");
    expect(html).not.toContain("Match with your added criteria");
  });

  it("renders each resolved criterion finding with its cited source and authority label", () => {
    const html = renderState(factsWithResolvedCriterion());
    const sourceOccurrences = html.match(/Regulation \(EU\) 2016\/679/g) ?? [];

    expect(html).toContain("Evidence for this finding");
    expect(html).toContain("The official regulation is a binding public measure");
    expect(sourceOccurrences.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Official Journal of the European Union");
    expect(html).toContain("Official primary source");
  });

  it("separates the tentative decision from continuation and removal", () => {
    const html = renderState(readyState(true));

    expect(html).toContain("Researcher decision");
    expect(html).toContain("General Data Protection Regulation");
    expect(html).toContain(screen02FindCopy.decisionWarning);
    expect(html).toContain("Undo choice");
    expect(html).toContain(screen02FindCopy.continue);
    expect(html).toContain(
      "Undo the tentative choice before removing this candidate",
    );
    expect(html).not.toContain("<summary>Remove from comparison</summary>");
    const continueButton = html.match(
      /<button class="s2-find-button" type="button"[^>]*>Continue to Screen 3: Verify event<\/button>/,
    )?.[0];
    expect(continueButton).toBeDefined();
    expect(continueButton).not.toContain("disabled");
  });

  it("offers a one-click source-backed handoff with mandatory checks when assessment delivery is unavailable", () => {
    const html = renderState(assessmentUnavailableState());

    expect(html).toContain("Continue to Screen 3 with extra checks");
    expect(html).toContain("What the extra checks mean");
    expect(html).toContain("Choosing the visible extra-checks button records that limitation");
    expect(html).toContain("Source-backed candidate · Assessment unavailable");
    expect(html).toContain("no interpretation is being claimed");
    expect(html).not.toContain("Preliminary source-linked interpretation");
    expect(html).not.toContain("Assessment in progress");
    expect(html).toContain("Verify study fit against the confirmed Screen 1 scope.");
    expect(html).not.toContain('name="assessmentUnavailableReason"');
    expect(html).not.toContain('name="assessmentUnavailableAcknowledgment"');
    expect(html).not.toContain("Record exception and continue");
    const continueButton = html.match(
      /<button class="s2-find-button" type="button"[^>]*>Continue to Screen 3 with extra checks<\/button>/,
    )?.[0];
    expect(continueButton).toBeDefined();
    expect(continueButton).not.toContain("disabled");
    expectProviderNeutral(html);
  });

  it("keeps coverage honest and technical identifiers out of the visible record", () => {
    const html = renderState(readyState());

    expect(html).toContain(screen02FindCopy.coverage);
    expect(html).toContain("How this search was conducted");
    expect(html).toContain("Source routes");
    expect(html).not.toContain("Retrieval formula");
    expect(html).not.toContain("Stored score");
    expect(html).not.toContain("Search protocol</dt>");
    expect(html).not.toContain("AI-rubric");
    expect(html).not.toContain("Tier 6");
  });

  it("projects technical search provenance as provider-neutral visible copy", () => {
    const state = structuredClone(readyState());
    const active = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )!;
    active.manifest.stoppingRule.note =
      "Native stage complete. Host-assisted stage: ChatGPT provider fallback completed.";
    active.manifest.channels.push({
      channel: "host-global-discovery",
      status: "not-searched",
      retrievedAt: null,
      note:
        "The ChatGPT host used an MCP provider fallback. Host-assisted discovery required: yes.",
    });
    active.manifest.queryMatrix[0] = {
      ...active.manifest.queryMatrix[0]!,
      query: "No ChatGPT query expansion applied.",
      purpose:
        "Use bounded ChatGPT-planned vocabulary through the host model and MCP provider fallback.",
    };
    active.manifest.exclusions.push({
      recordId: "host-official-lead-private-technical-id",
      reason:
        "Host metadata alone cannot create a candidate through an MCP fallback.",
    });

    const html = renderState(state);

    expect(html).toContain("Supplemental source search");
    expect(html).toContain("Additional source discovery is required.");
    expect(html).toContain("Use bounded supplemental vocabulary");
    expect(html).toContain("No supplemental query expansion applied.");
    expect(html).toContain("Excluded lead 1");
    expect(html).not.toContain("host-official-lead-private-technical-id");
    expectProviderNeutral(html);
    expect(active.manifest.channels.at(-1)?.channel).toBe(
      "host-global-discovery",
    );
    expect(active.manifest.queryMatrix[0]?.query).toBe(
      "No ChatGPT query expansion applied.",
    );
  });

  it("shows contextual results in a separate non-confirming lane", () => {
    const state = structuredClone(readyState());
    const active = state.candidateSets.find(
      (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    )!;
    active.manifest.contextLeads = [{
      id: "context-lead-1",
      title: "Regulator discusses the implementation timetable",
      locator: "https://news.example.test/implementation",
      publisher: "news.example.test",
      publishedDate: "2026-08-01",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Context only; direct evidence is required.",
    }];
    const html = renderState(state);

    expect(html).toContain("Context to verify");
    expect(html).toContain("do not confirm a shock or date");
    expect(html).toContain("Unverified secondary lead");
    expect(html).toContain("Find this title");
    expect(html).toContain("https://www.google.com/search?q=");
    expect(html).not.toContain("href=\"https://news.example.test");
  });

  it("renders every documented manifest exclusion without technical record IDs", () => {
    const discovered = applyReviewedScreen02FindDiscovery(
      createScreen02FindState(
        confirmedWorkflowFindContext(),
        "ui-find-exclusion-run",
        "2026-08-10T18:10:00.000Z",
      ),
      {
        discoveryRequestId: "ui-find-exclusion-discovery",
        candidateSetSnapshotId: "ui-find-exclusion-set",
        searchRoundId: "ui-find-exclusion-round",
        at: "2026-08-10T18:10:01.000Z",
        exactRequest: "Find one bounded privacy-regulation candidate.",
        maximumCandidates: 1,
      },
    );
    const html = renderState(discovered);
    const exclusion = discovered.candidateSets[0]?.manifest.exclusions[0];
    if (!exclusion) throw new Error("Expected a documented exclusion.");

    expect(html).toContain("Documented exclusions");
    expect(html).toContain("Excluded lead 1");
    expect(html).not.toContain(exclusion.recordId);
    expect(html.replaceAll("&#x27;", "'")).toContain(exclusion.reason);
  });

  it("keeps repeat-search status and elapsed text visible in an open disclosure", () => {
    const html = renderToStaticMarkup(
      <Screen02Find
        state={buildFindFactsState()}
        {...callbacks()}
        searchState={{
          operationId: "screen02-ui-render-search",
          phase: "searching",
          message: "Searching the bounded reviewed registry…",
          startedRevision: 4,
          settledRevision: null,
          visibleCandidateCount: 1,
          errorCode: null,
          recovery: "preserved-results",
          elapsedLabel: "12 seconds elapsed.",
        }}
      />,
    );

    expect(html).toMatch(/<details class="s2-find-search" open="">/);
    expect(html).toContain("Searching the bounded reviewed registry…");
    expect(html).toContain("12 seconds elapsed.");
    expect(html).toContain("Finding candidate shocks from sources…");
    expect(html).toContain(
      '<p class="s2-find-search-status s2-find-search-status--searching" data-testid="screen02-find-search-status" role="status" aria-busy="true"><span class="s2-find-spinner" aria-hidden="true"></span>',
    );
    expect(html).toContain('data-search-phase="searching"');
    expect(html).toContain(
      'data-search-operation-id="screen02-ui-render-search"',
    );
    expect(html).toContain('data-search-visible-candidates="1"');
    expect(html).not.toContain("screen02-workflow-");
    expect(html).toContain(
      '<button class="s2-find-button" type="submit" disabled="" aria-busy="true">Finding candidate shocks from sources…</button>',
    );
    expectProviderNeutral(html);
  });

  it("keeps prior cards visible and removes the spinner after a delivery failure", () => {
    const html = renderToStaticMarkup(
      <Screen02Find
        state={readyState()}
        {...callbacks()}
        searchState={{
          operationId: "screen02-ui-delivery-failure",
          phase: "delivery-failure",
          message:
            "The search result could not be safely applied. Previous results remain available.",
          startedRevision: 4,
          settledRevision: null,
          visibleCandidateCount: 1,
          errorCode: "result-metadata-timeout",
          recovery: "preserved-results",
        }}
      />,
    );

    expect(html).toContain('data-search-phase="delivery-failure"');
    expect(html).toContain('data-search-error-code="result-metadata-timeout"');
    expect(html).toContain('data-search-recovery="preserved-results"');
    expect(html).toContain("General Data Protection Regulation");
    expect(html).toContain("Previous results remain available.");
    expect(html).toContain('data-testid="screen02-find-search-recovery"');
    expect(html).toContain('aria-label="Source search recovery"');
    expect(html).toContain("Existing candidate cards remain available");
    expect(html).toContain(">Retry source search</button>");
    expect(html).toContain(
      '</details><section class="s2-find-search-recovery"',
    );
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain('class="s2-find-spinner"');
  });

  it.each([
    {
      phase: "incomplete" as const,
      message: "Search completed with incomplete source coverage.",
      recovery: "retry" as const,
      guidance: "Some supported source routes did not finish.",
      action: "Retry incomplete search",
    },
    {
      phase: "cancelled" as const,
      message: "Search cancelled because this Screen 2 run changed.",
      recovery: "reset" as const,
      guidance: "This search stopped when the Screen 2 run changed.",
      action: "Start another source search",
    },
  ])("keeps $phase recovery visible outside collapsed search controls", ({
    phase,
    message,
    recovery,
    guidance,
    action,
  }) => {
    const html = renderToStaticMarkup(
      <Screen02Find
        state={readyState()}
        {...callbacks()}
        searchState={{
          operationId: `screen02-ui-${phase}-recovery`,
          phase,
          message,
          startedRevision: 4,
          settledRevision: phase === "incomplete" ? 5 : null,
          visibleCandidateCount: 1,
          errorCode: phase === "cancelled" ? "stale-result" : null,
          recovery,
        }}
      />,
    );

    expect(html).toContain(`data-search-phase="${phase}"`);
    expect(html).toContain('data-testid="screen02-find-search-recovery"');
    expect(html).toContain(guidance);
    expect(html).toContain(`>${action}</button>`);
    expect(html).toContain("General Data Protection Regulation");
    expect(html).toContain(
      '</details><section class="s2-find-search-recovery"',
    );
    expect(html).not.toContain('class="s2-find-spinner"');
  });

  it("does not expose unsafe operation or error text in DOM correlation attributes", () => {
    const html = renderToStaticMarkup(
      <Screen02Find
        state={buildFindFactsState()}
        {...callbacks()}
        searchState={{
          operationId: "secret?token=do-not-expose",
          phase: "cancelled",
          message: "Search cancelled.",
          startedRevision: 4,
          settledRevision: null,
          visibleCandidateCount: 1,
          errorCode: "failure with private detail",
          recovery: "reset",
        }}
      />,
    );

    expect(html).toContain('data-search-phase="cancelled"');
    expect(html).not.toContain("data-search-operation-id");
    expect(html).not.toContain("data-search-error-code");
    expect(html).not.toContain("secret?token");
    expect(html).not.toContain("private detail");
  });

  it("renders a continued Find handoff as an explicitly sealed workspace", () => {
    const state = buildReadyFindState();
    const html = renderState(state);
    const busyHtml = renderToStaticMarkup(
      <Screen02Find state={state} busy {...callbacks()} />,
    );

    expect(html).toContain("Screen 2 choice sealed");
    expect(html).toContain('data-testid="screen02-find-sealed"');
    expect(html).toMatch(/<fieldset class="s2-find-workspace-lock" disabled="">/);
    expect(html).toContain("read-only decision record");
    expect(html).toContain(
      "choose another candidate without resetting your Screen 2 work",
    );
    expect(html).toMatch(
      /<button class="s2-find-button s2-find-button--secondary" type="button" data-testid="screen02-find-reopen-choice">Undo choice<\/button>/,
    );
    expect(html.match(/Undo choice/g)).toHaveLength(1);
    expect(busyHtml).toMatch(
      /<button class="s2-find-button s2-find-button--secondary" type="button" data-testid="screen02-find-reopen-choice">Undo choice<\/button>/,
    );
    expect(html.indexOf('data-testid="screen02-find-reopen-choice"')).toBeLessThan(
      html.indexOf('<fieldset class="s2-find-workspace-lock"'),
    );
  });

  it("uses a separate responsive namespace with focus, reduced-motion, and forced-color treatment", () => {
    const css = readFileSync(
      new URL(
        "../../src/ui/screen-02-find/screen-02-find.css",
        import.meta.url,
      ),
      "utf8",
    );
    const globalCss = readFileSync(
      new URL("../../src/ui/global.css", import.meta.url),
      "utf8",
    );

    expect(css).toContain(".s2-find-comparison__workspace");
    expect(css).not.toContain(".s2-find-candidate-row__assessment");
    expect(css).toContain(".s2-find-candidate-row__concern");
    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(".s2-find a:focus-visible");
    expect(globalCss).toContain(".s2-find-spinner,");
    expect(globalCss).toContain("@keyframes shockaudit-spin");
    expect(globalCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.s2-find-spinner,[\s\S]*?animation:\s*none;/,
    );
    expect(css).toMatch(
      /\.s2-find-coverage details:not\(\[open\]\) > :not\(summary\)\s*\{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.s2-find-coverage li\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(css).not.toContain(".s2-candidate-detail");
  });

  it("keys candidate detail by immutable candidate identity so removal drafts cannot cross candidates", () => {
    const source = readFileSync(
      new URL(
        "../../src/ui/screen-02-find/Screen02Find.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain(
      "view.opened?.candidate.candidateSnapshotId ??",
    );
    expect(source).toContain('"no-open-candidate"');
  });
});
