import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createScreen02AuditState,
  prepareScreen02AssessmentRequest,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  screen02AuditAssessmentPartIds,
  type Screen02AuditState,
  type Screen02IdentityDecision,
  type Screen02IdentityDecisionAction,
} from "../../src/core/screen02-workflow-types";
import Screen02Audit from "../../src/ui/screen-02-audit/Screen02Audit";
import {
  buildScreen02AuditViewModel,
  isRetryableAuditRequest,
} from "../../src/ui/screen-02-audit/audit-view-model";
import {
  lifecycleCopy,
  screen02AuditCopy,
} from "../../src/ui/screen-02-audit/content";
import { screen02ProviderNeutralCopy } from
  "../../src/ui/screen-02/provider-neutral-copy";
import {
  buildAuditIdentityState,
  buildReadyAuditState,
  cloneFixture,
  confirmedWorkflowAuditContext,
  fixtureAt,
  workflowManifest,
} from "../core/screen02-workflow-fixtures";

function callbacks() {
  return {
    onReviseAnchor: vi.fn(),
    onOpenMatch: vi.fn(),
    onConfirmMatch: vi.fn(),
    onChooseRelatedVersion: vi.fn(),
    onRejectMatch: vi.fn(),
    onNoMatch: vi.fn(),
    onRetryDossier: vi.fn(),
    onRetryAssessment: vi.fn(),
    onContinue: vi.fn(),
    onContinueWithoutAssessment: vi.fn(),
    onReconsiderIdentity: vi.fn(),
    onEditStudy: vi.fn(),
    onReset: vi.fn(),
    onAddSource: vi.fn(),
  };
}

function assessmentUnavailableState() {
  let state = prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    jobId: "ui-audit-unavailable-job",
    requestId: "ui-audit-unavailable-request",
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    attempt: 1,
    requestedPartIds: [...screen02AuditAssessmentPartIds],
    at: "2026-08-09T18:10:09.000Z",
  });
  if (state.mode !== "audit") throw new Error("Expected Audit state.");
  state = transitionScreen02AssessmentRequest(state, {
    requestId: "ui-audit-unavailable-request",
    status: "delivery-rejected",
    at: "2026-08-09T18:10:10.000Z",
    actor: "chatgpt-host",
  });
  if (state.mode !== "audit") throw new Error("Expected Audit state.");
  return state;
}

function fixedFallbackAssessmentState() {
  const state = cloneFixture(buildReadyAuditState());
  const request = state.assessmentRequests.find(
    (candidateRequest) =>
      candidateRequest.target.mode === "audit-confirmed-event",
  );
  const assessment = state.assessments[0];
  if (!request || !assessment) {
    throw new Error("Expected a completed Audit assessment fixture.");
  }
  request.lifecycle.push({
    status: "message-delivered",
    at: "2026-08-09T18:10:14.500Z",
    actor: "fixed-core",
    note: "Workers AI did not return a usable result; fixed fallback selected.",
  });
  assessment.studyFit = {
    category: "unclear",
    explanation:
      "The fixed fallback could not establish fit with the chosen sample.",
    evidenceSourceIds: ["ccpa-official"],
  };
  assessment.outcomePathway = {
    category: "unclear",
    explanation:
      "The fixed fallback could not establish an outcome pathway.",
    evidenceSourceIds: ["ccpa-official"],
  };
  assessment.coverageRelation = {
    category: "unclear",
    explanation:
      "The fixed fallback could not establish which study units were covered.",
    evidenceSourceIds: ["ccpa-official"],
  };
  assessment.measurementPotential = {
    category: "unclear",
    explanation:
      "The fixed fallback could not establish a dependable exposure measure.",
    evidenceSourceIds: ["ccpa-official"],
  };
  assessment.mainConcern =
    "Coverage, timing, and measurement all require verification.";
  assessment.nextChecks = [
    "Verify the event facts and exposure boundary against the online sources.",
  ];
  assessment.overallJudgment = "not-enough-evidence";
  return state;
}

function renderState(
  state: Screen02AuditState,
  openedMatchSnapshotId: string | null = null,
) {
  return renderToStaticMarkup(
    <Screen02Audit
      state={state}
      openedMatchSnapshotId={openedMatchSnapshotId}
      {...callbacks()}
    />,
  );
}

function visibleText(markup: string) {
  return markup.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function expectProviderNeutral(markup: string) {
  expect(visibleText(markup)).not.toMatch(
    /\b(?:ChatGPT|host|model|MCP|inference|fallback|provider|reasoning|tool|AI)\b/iu,
  );
}

function blankState() {
  return createScreen02AuditState(
    confirmedWorkflowAuditContext(),
    "ui-blank-audit-run",
    fixtureAt,
  );
}

describe("Screen02Audit pending canonical mutations", () => {
  it("pauses Audit workflow controls until the mutation settles", () => {
    const busy = renderToStaticMarkup(
      <Screen02Audit state={buildAuditIdentityState()} busy {...callbacks()} />,
    );
    const idle = renderState(buildAuditIdentityState());

    expect(busy).toContain(
      'class="s2-audit-workspace-lock" disabled="" aria-busy="true"',
    );
    expect(idle).not.toContain(
      'class="s2-audit-workspace-lock" disabled=""',
    );
  });
});

function unconfirmedDossierState() {
  const state = cloneFixture(buildAuditIdentityState());
  state.confirmedIdentity = null;
  state.identityDecisions = [];
  state.assessments = [];
  state.continuationHistory = [];
  state.assessmentRequests = state.assessmentRequests.filter(
    (request) => request.target.mode === "audit-dossier",
  );
  return state;
}

function pendingDossierState() {
  const state = unconfirmedDossierState();
  state.dossiers = [];
  const request = state.assessmentRequests.find(
    (candidateRequest) => candidateRequest.target.mode === "audit-dossier",
  );
  const prepared = request?.lifecycle.find(
    (event) => event.status === "prepared",
  );
  if (!request || !prepared) {
    throw new Error("Expected the prepared dossier request fixture.");
  }
  request.status = "prepared";
  request.updatedAt = prepared.at;
  request.acceptedPartIds = [];
  request.failures = [];
  request.receiptIds = [];
  request.lifecycle = [prepared];
  return state;
}

function decisionForActiveMatch(
  state: Screen02AuditState,
  action: Screen02IdentityDecisionAction,
  suffix: string,
): Screen02IdentityDecision {
  const match = state.possibleMatches[0];
  if (!match) throw new Error("Expected an active possible match.");
  return {
    decisionId: `ui-${suffix}-decision`,
    action,
    actor: "researcher",
    anchorRevisionId: state.anchor.activeRevisionId,
    matchSnapshotId: match.matchSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    dossierSnapshotId: null,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: null,
    at: `2026-08-09T18:20:0${suffix.length}.000Z`,
    reason: `UI fixture ${action} reason.`,
  };
}

function noMatchDecision(
  state: Screen02AuditState,
  at: string,
): Screen02IdentityDecision {
  return {
    decisionId: `ui-no-match-${at}`,
    action: "no-match",
    actor: "researcher",
    anchorRevisionId: state.anchor.activeRevisionId,
    matchSnapshotId: null,
    identitySnapshotId: null,
    dossierSnapshotId: null,
    confirmationSnapshotId: null,
    confirmationFingerprint: null,
    reversesDecisionId: null,
    at,
    reason: "The retained records resolve a different version of the shock.",
  };
}

function addVersionAlternative(state: Screen02AuditState) {
  const match = state.possibleMatches[0];
  const set = state.matchSets.find(
    (candidateSet) =>
      candidateSet.matchSetSnapshotId === state.activeMatchSetSnapshotId,
  );
  if (!match || !set) {
    throw new Error("Expected an active possible match set.");
  }
  const alternative = cloneFixture(match);
  alternative.matchId = "cpra-amendment-match";
  alternative.matchSnapshotId = "cpra-amendment-match-snapshot-v1";
  alternative.identitySnapshotId = "cpra-amendment-identity-snapshot-v1";
  alternative.matchFingerprint = "fnv1a64:0000000000000001";
  alternative.identity = {
    ...alternative.identity,
    canonicalTitle: "California Privacy Rights Act amendment",
    commonNames: ["CPRA amendment"],
    formalIdentifier: "Proposition 24",
  };
  alternative.relationship = "amendment";
  alternative.relationshipReason =
    "This is a later amendment that may be the intended version.";
  state.possibleMatches.push(alternative);
  set.possibleMatchSnapshotIds.push(alternative.matchSnapshotId);
  return alternative.matchSnapshotId;
}

function expectActionDisabled(html: string, label: string) {
  const labelIndex = html.indexOf(label);
  expect(labelIndex).toBeGreaterThan(-1);
  const buttonIndex = html.lastIndexOf("<button", labelIndex);
  const buttonTag = html.slice(buttonIndex, html.indexOf(">", buttonIndex));
  expect(buttonTag).toContain('disabled=""');
}

function partialDossierState(attempt: 1 | 2 | 3) {
  const state = unconfirmedDossierState();
  state.dossiers[0]!.status = "partial";
  state.dossiers[0]!.whatHappened = null;
  const request = state.assessmentRequests.find(
    (candidateRequest) => candidateRequest.target.mode === "audit-dossier",
  );
  if (!request) throw new Error("Expected the fixture dossier request.");
  request.status = "partial";
  request.attempt = attempt;
  request.acceptedPartIds = ["atAGlance", "timeline"];
  return state;
}

function noMatchState() {
  const state = cloneFixture(blankState());
  state.revision = 1;
  state.updatedAt = "2026-08-09T18:20:01.000Z";
  state.activeMatchSetSnapshotId = "ui-empty-match-set";
  state.matchSets = [
    {
      matchSetSnapshotId: "ui-empty-match-set",
      matchSetFingerprint: "fnv1a64:0000000000000001",
      anchorRevisionId: state.anchor.activeRevisionId,
      possibleMatchSnapshotIds: [],
      manifest: workflowManifest(
        "Resolve the named shock under the bounded identity protocol.",
      ),
      status: "active",
      supersededBySnapshotId: null,
    },
  ];
  return state;
}

describe("isolated Stage 4 Screen 2 Audit UI", () => {
  it("renders the exact identify copy, preserved wording, structured anchor, four phases, and common boundary", () => {
    const html = renderState(blankState());

    expect(html).toContain(screen02AuditCopy.eyebrow);
    expect(html).toContain(`<h1>${screen02AuditCopy.identifyTitle}</h1>`);
    expect(html).toContain(screen02AuditCopy.identifyPurpose);
    expect(html).toContain("Identify");
    expect(html).toContain("Understand");
    expect(html).toContain("Confirm or correct");
    expect(html).toContain("Assess");
    expect(html).toContain("Original wording");
    expect(html).toContain("California Consumer Privacy Act");
    expect(html).toContain("Reset Screen 2");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Reset Screen 2?");
    expect(html).toContain("Known-shock anchor");
    expect(html).toContain("Correct the match or add an official URL");
    expect(html).toContain("Add an official URL");
    expect(html).toContain("Upload a document");
    expect(html).toContain(
      'aria-label="Upload an official shock document"',
    );
    expect(html).toContain('aria-describedby="s2-audit-document-help"');
    expect(html).toContain("PDF text is not treated as extracted evidence");
    expect(html).toContain("Document upload is unavailable in this view");
    expect(html).toContain('accept=".pdf,.txt,.html,.htm,.xhtml,application/pdf,text/plain,text/html,application/xhtml+xml"');
    expect(html).toContain('id="s2-audit-source-locator"');
    expect(html).toContain("Reason for this revision");
    expect(html).toContain(screen02AuditCopy.boundary);
    expect(html).toContain("Temporary workflow data");
    expect(html).toContain("Inactive runs expire within");
    expect(html).not.toContain(screen02AuditCopy.assessmentTitle);
    expect(html).not.toContain(screen02AuditCopy.confirm);
    expect(lifecycleCopy.partial).toBe(
      "Part of the review is ready. Only the missing items need another try.",
    );
    expect(lifecycleCopy.superseded).toBe(
      "A newer search or identity is active.",
    );
    expectProviderNeutral(html);
  });

  it("shows active possible matches and one match-specific dossier before confirmation", () => {
    const state = unconfirmedDossierState();
    const html = renderState(state, "ccpa-match-snapshot-v1");
    const view = buildScreen02AuditViewModel(
      state,
      "ccpa-match-snapshot-v1",
    );

    expect(view.phase).toBe("confirm-or-correct");
    expect(view.opened?.match.matchSnapshotId).toBe(
      "ccpa-match-snapshot-v1",
    );
    expect(view.opened?.confirmationGate).toEqual(
      expect.objectContaining({ eligible: true, reasons: [] }),
    );
    expect(html).toContain(screen02AuditCopy.listTitle);
    expect(html).toContain("Identity search record");
    expect(html).toContain("How this identity search was conducted");
    expect(html).toContain("Official primary sources");
    expect(html).toContain(screen02AuditCopy.listHelp);
    expect(html).toContain("Exact match");
    expect(html).toContain("Earliest online-source date: 28 Jun 2018");
    expect(html).toContain("At a glance");
    expect(html).toContain("What happened");
    expect(html).toContain("What changed");
    expect(html).toContain("Preliminary timeline");
    expect(html).toContain("Who may be affected");
    expect(html).toContain("Key components");
    expect(html).toContain("Related versions");
    expect(html).toContain("Unresolved facts");
    expect(html).toContain("Online sources");
    expect(html).toContain("Source-linked provisional dossier");
    expect(html).toContain(
      "validation does not prove that every sentence follows from a source",
    );
    expect(html).toContain("How this shock may relate to your study");
    expect(html).toContain("Preliminary interpretation only");
    expect(html).toContain("Organization-level eligibility remains unknown until Screen 3.");
    expect(html).toContain("California Privacy Rights Act");
    expect(html).toContain("Official primary source");
    expect(html).toContain("Reason for the identity decision");
    expect(html).toContain(screen02AuditCopy.confirm);
    expect(html).toContain(screen02AuditCopy.relatedVersion);
    expect(html).toContain(screen02AuditCopy.reject);
    expect(html).not.toContain(screen02AuditCopy.assessmentTitle);
    expectProviderNeutral(html);
  });

  it("shows accessible visual progress while the dossier and confirmed-event assessment are pending", () => {
    const dossierHtml = renderState(
      pendingDossierState(),
      "ccpa-match-snapshot-v1",
    );
    const assessmentHtml = renderState(buildAuditIdentityState());

    expect(dossierHtml).toContain(
      '<section id="s2-audit-match-detail" class="s2-audit-dossier" role="status">',
    );
    expect(dossierHtml).toContain(
      '<p class="s2-audit-working-status" aria-busy="true"><span class="s2-audit-spinner" aria-hidden="true"></span>',
    );
    expect(dossierHtml).toContain(
      "Getting the source-backed review ready…",
    );
    expect(assessmentHtml).toContain(
      '<div class="s2-audit-assessment-status" role="status" aria-live="polite" aria-busy="true"><span class="s2-audit-spinner" aria-hidden="true"></span>',
    );
    expect(assessmentHtml).toContain(
      "Identity confirmed. Preparing the confirmed-shock assessment…",
    );
  });

  it("keeps contextual leads separate from confirmable Audit identities", () => {
    const state = cloneFixture(buildAuditIdentityState());
    const active = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    )!;
    active.manifest.contextLeads = [{
      id: "audit-context-lead-1",
      title: "Press discussion of compliance timing",
      locator: "https://news.example.test/compliance",
      publisher: "news.example.test",
      publishedDate: "2026-08-02",
      sourceRole: "contextual-secondary",
      status: "unverified",
      note: "Context only; direct evidence is required.",
    }];
    const html = renderState(state);

    expect(html).toContain("Context to verify");
    expect(html).toContain("cannot establish the event&#x27;s identity or operative date");
    expect(html).toContain("Unverified secondary lead");
    expect(html).toContain("Find this title");
    expect(html).toContain("https://www.google.com/search?q=");
    expect(html).not.toContain("href=\"https://news.example.test");
  });

  it("makes a failed researcher URL visible with its search route and exclusion reason", () => {
    const state = unconfirmedDossierState();
    const revision = state.anchor.revisions.find(
      (candidate) => candidate.anchorRevisionId === state.anchor.activeRevisionId,
    );
    const set = state.matchSets.find(
      (candidate) =>
        candidate.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    );
    if (!revision || !set) throw new Error("Expected an active Audit snapshot.");
    revision.fields.sourceLocator = "https://official.example.invalid/act.pdf";
    set.manifest.channels.push({
      channel: "researcher-provided-url",
      status: "failed",
      note: "The server returned an unsupported content type: application/pdf.",
      retrievedAt: fixtureAt,
    });
    set.manifest.queryMatrix.push({
      id: "failed-url-query",
      query: revision.fields.sourceLocator,
      purpose: "Attempt to inspect the exact researcher-provided URL.",
      returnedRecordIds: [],
    });
    set.manifest.exclusions.push({
      recordId: "failed-researcher-url",
      reason: "The server returned an unsupported content type: application/pdf.",
    });

    const html = renderState(state);

    expect(html).toContain("The supplied URL could not be inspected");
    expect(html).toContain("Researcher-provided official URL");
    expect(html).toContain("Documented exclusions");
    expect(html).toContain("Excluded lead 1");
    expect(html).not.toContain("failed-researcher-url");
    expect(html).toContain("unsupported content type: application/pdf");
    expect(html).toContain("<details open=\"\">");
  });

  it("renders partial dossiers safely, blocks confirmation, and offers only an allowed targeted retry", () => {
    const retryable = partialDossierState(2);
    const exhausted = partialDossierState(3);
    const retryableView = buildScreen02AuditViewModel(retryable);
    const exhaustedView = buildScreen02AuditViewModel(exhausted);
    const retryableHtml = renderState(retryable);
    const exhaustedHtml = renderState(exhausted);

    expect(retryableView.opened?.dossier?.whatHappened).toBeNull();
    expect(retryableView.opened?.confirmationGate.eligible).toBe(false);
    expect(retryableView.opened?.confirmationGate.visibleReason).toBe(
      "Confirm becomes available after the match-specific dossier is complete.",
    );
    expect(isRetryableAuditRequest(retryableView.opened?.dossierRequest ?? null)).toBe(true);
    expect(isRetryableAuditRequest(exhaustedView.opened?.dossierRequest ?? null)).toBe(false);
    expect(retryableHtml).toContain(
      "This source-linked provisional explanation is not ready yet.",
    );
    expect(retryableHtml).toContain(
      "Part of the review is ready. Only the missing items need another try.",
    );
    expect(retryableHtml).toContain("Retry missing dossier parts");
    expect(retryableHtml).toContain(
      "Confirm becomes available after the match-specific dossier is complete.",
    );
    expect(retryableHtml).toContain(
      "Review the source-backed dossier first. The confirmation button will become available automatically when its required sections are ready.",
    );
    expect(exhaustedHtml).not.toContain("Retry missing dossier parts");
  });

  it("mirrors the core confirmation gate for uncertainty, prior decisions, and explicit dossier unknowns", () => {
    const uncertain = unconfirmedDossierState();
    uncertain.possibleMatches[0]!.relationship = "uncertain";
    const rejected = unconfirmedDossierState();
    rejected.identityDecisions.push(
      decisionForActiveMatch(rejected, "rejected", "rejected"),
    );
    const related = unconfirmedDossierState();
    const relatedMatchId = related.possibleMatches[0]!.matchSnapshotId;
    const alternativeMatchId = addVersionAlternative(related);
    related.identityDecisions.push(
      decisionForActiveMatch(related, "related-version", "related"),
    );
    const missingUnknowns = unconfirmedDossierState();
    missingUnknowns.dossiers[0]!.unresolvedFacts = [];

    expect(
      buildScreen02AuditViewModel(uncertain).opened?.confirmationGate,
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        visibleReason:
          "The relationship to the search anchor remains uncertain.",
      }),
    );
    expect(
      buildScreen02AuditViewModel(rejected).opened?.confirmationGate,
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        visibleReason:
          "This possible match was rejected. Revise the anchor or choose another active match.",
      }),
    );
    expect(
      buildScreen02AuditViewModel(rejected).opened?.disposition,
    ).toBe("rejected");
    const rejectedHtml = renderState(rejected);
    expect(rejectedHtml).toContain(">Rejected</b>");
    expectActionDisabled(rejectedHtml, screen02AuditCopy.confirm);
    expectActionDisabled(rejectedHtml, screen02AuditCopy.relatedVersion);
    expectActionDisabled(rejectedHtml, screen02AuditCopy.reject);
    const relatedView = buildScreen02AuditViewModel(related);
    expect(relatedView.opened?.confirmationGate).toEqual(
      expect.objectContaining({
        eligible: false,
      }),
    );
    expect(relatedView.matches.map((row) => row.match.matchSnapshotId)).toEqual(
      [alternativeMatchId, relatedMatchId],
    );
    expect(relatedView.opened?.match.matchSnapshotId).toBe(alternativeMatchId);
    expect(relatedView.matches[1]?.disposition).toBe("related-version");
    expect(relatedView.matches[1]?.confirmationGate.visibleReason).toBe(
      "This record was marked as a related version. Choose the intended version before confirmation.",
    );
    const relatedHtml = renderState(related, relatedMatchId);
    expect(relatedHtml).toContain("Marked related version");
    expect(relatedHtml).toContain(
      "This record was marked as a related version. Choose the intended version before confirmation.",
    );
    expectActionDisabled(relatedHtml, screen02AuditCopy.confirm);
    expectActionDisabled(relatedHtml, screen02AuditCopy.relatedVersion);
    expectActionDisabled(relatedHtml, screen02AuditCopy.reject);
    expect(
      buildScreen02AuditViewModel(missingUnknowns).opened?.confirmationGate,
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        visibleReason:
          "The dossier must state its unresolved facts before confirmation.",
      }),
    );
  });

  it("shows the exact no-match state without claiming that the event does not exist", () => {
    const html = renderState(noMatchState());
    const view = buildScreen02AuditViewModel(noMatchState());

    expect(view.noMatch).toBe(true);
    expect(html).toContain(screen02AuditCopy.noResult);
    expect(html).toContain(
      "This does not establish that the shock does not exist.",
    );
    expect(html).toContain("Record no match under this protocol");
    expect(html).toContain("Correct the match or add an official URL");
    expect(html).not.toContain(screen02AuditCopy.assessmentTitle);
  });

  it("seals every row after a current-snapshot no-match while retaining the no-result revision path", () => {
    const state = unconfirmedDossierState();
    addVersionAlternative(state);
    const currentDecision = noMatchDecision(
      state,
      "2026-08-09T18:20:09.000Z",
    );
    state.identityDecisions.push(currentDecision);
    const view = buildScreen02AuditViewModel(state);
    const html = renderState(state, state.possibleMatches[0]!.matchSnapshotId);

    expect(view.noMatch).toBe(true);
    expect(view.currentNoMatchDecision?.decisionId).toBe(
      currentDecision.decisionId,
    );
    expect(view.matches.every((row) =>
      row.currentNoMatchDecision?.decisionId === currentDecision.decisionId &&
      !row.confirmationGate.eligible
    )).toBe(true);
    expect(html).toContain("Snapshot closed · no match");
    expect(html).toContain(screen02AuditCopy.noResult);
    expect(html).toContain(
      "The retained records resolve a different version of the shock.",
    );
    expect(html).toContain("Correct the match or add an official URL");
    expect(html).toContain("Add an official URL");
    expectActionDisabled(html, screen02AuditCopy.confirm);
    expectActionDisabled(html, screen02AuditCopy.relatedVersion);
    expectActionDisabled(html, screen02AuditCopy.reject);

    const staleState = unconfirmedDossierState();
    staleState.identityDecisions.push(
      noMatchDecision(staleState, "2026-08-09T17:59:59.000Z"),
    );
    const staleView = buildScreen02AuditViewModel(staleState);
    expect(staleView.noMatch).toBe(false);
    expect(staleView.currentNoMatchDecision).toBeNull();
    expect(staleView.opened?.confirmationGate.eligible).toBe(true);
  });

  it("does not expose the research assessment until identity is explicitly confirmed", () => {
    const unconfirmedHtml = renderState(unconfirmedDossierState());
    const confirmedState = buildAuditIdentityState();
    const confirmedHtml = renderState(confirmedState);
    const view = buildScreen02AuditViewModel(confirmedState);

    expect(unconfirmedHtml).not.toContain(screen02AuditCopy.assessmentTitle);
    expect(view.phase).toBe("assess");
    expect(view.confirmedIdentity?.confirmationSnapshotId).toBe(
      "ccpa-confirmation-snapshot-1",
    );
    expect(confirmedHtml).toContain(screen02AuditCopy.assessmentTitle);
    expect(confirmedHtml).toContain(screen02AuditCopy.assessmentPurpose);
    expect(confirmedHtml).toContain("Identity confirmed by researcher");
    expect(confirmedHtml).toContain(
      "Identity confirmed. Preparing the confirmed-shock assessment…",
    );
    expect(confirmedHtml).toContain(
      "Continue becomes available after the confirmed-shock assessment is complete.",
    );
    expect(confirmedHtml).toContain("Reconsider identity");
    expect(confirmedHtml).toContain(
      "Reconsider identity before revising the anchor or adding a source.",
    );
    expect(confirmedHtml).toContain("<fieldset disabled=\"\">");
    expect(confirmedHtml).toContain(
      'type="button" disabled="" aria-describedby="s2-audit-anchor-edit-lock"',
    );
    expect(confirmedHtml).not.toContain(screen02AuditCopy.listHelp);
  });

  it("offers a one-click source-bound handoff with mandatory checks when assessment delivery is unavailable", () => {
    const html = renderState(assessmentUnavailableState());

    expect(html).toContain("Continue to Screen 3 with extra checks");
    expect(html).toContain("What the extra checks mean");
    expect(html).toContain("Choosing the visible extra-checks button records that limitation");
    expect(html).toContain("Source-backed event · Assessment unavailable");
    expect(html).toContain("No interpretation is being claimed");
    expect(html).not.toContain("Source-linked preliminary interpretation");
    expect(html).toContain("Verify the event version, timing, and source-backed factual record.");
    expect(html).not.toContain('name="assessmentUnavailableReason"');
    expect(html).not.toContain('name="assessmentUnavailableAcknowledgment"');
    expect(html).not.toContain("Record exception and continue");
    const continueButton = html.match(
      /<button class="s2-audit-button" type="button"[^>]*>Continue to Screen 3 with extra checks<\/button>/,
    )?.[0];
    expect(continueButton).toBeDefined();
    expect(continueButton).not.toContain("disabled");
    expectProviderNeutral(html);
  });

  it("renders a concise sample-and-outcome assessment with categorical levels and sealed continuation", () => {
    const state = buildReadyAuditState();
    const html = renderState(state);
    const view = buildScreen02AuditViewModel(state);

    expect(view.assessment?.status).toBe("completed");
    expect(view.alreadyContinued).toBe(true);
    expect(view.continuationGate.eligible).toBe(false);
    expect(html).toContain("Fixed computation");
    expect(html).toContain("Worth exploring");
    expect(html).toContain("How this shock may reach U.S. publicly listed technology firms · strong");
    expect(html).toContain("How it may affect Innovation · plausible");
    expect(html).toContain("What would need to be observed · difficult");
    expect(html).toContain("Source-linked preliminary interpretation");
    expect(html).toContain("Main feasibility concern");
    expect(html).toContain("Several event clocks and later amendments");
    expect(html).toContain("Next checks");
    expect(html).toContain("Online sources used for event facts");
    expect(html).toContain("Event sent to verification");
    expect(html).toContain("Screen 2 identity sealed");
    expect(html).toContain('data-testid="screen02-audit-sealed"');
    expect(html).toMatch(/<fieldset class="s2-audit-workspace-lock" disabled="">/);
    expect(html).toContain("read-only for this run");
    expect(html).toContain(
      "This confirmed event has already continued to the common Screen 3 handoff.",
    );
    expect(html).toContain(screen02AuditCopy.boundary);
    expectProviderNeutral(html);
  });

  it("labels a saved conservative source-derived assessment without exposing implementation provenance", () => {
    const html = renderState(fixedFallbackAssessmentState());

    expect(html).toContain("Conservative source-derived preliminary assessment");
    expect(html).toContain("Source-derived assessment for your study");
    expect(html).toContain("Unclear — verify before use.");
    expect(html).toContain("source-derived summary preserved");
    expect(html).toContain("How this shock may reach U.S. publicly listed technology firms · unclear");
    expect(html).not.toContain("Source-linked preliminary interpretation");
    expect(html).not.toContain(screen02AuditCopy.assessmentTitle);
    expectProviderNeutral(html);
  });

  it("projects technical Audit provenance as provider-neutral visible copy", () => {
    const state = unconfirmedDossierState();
    const active = state.matchSets.find(
      (set) => set.matchSetSnapshotId === state.activeMatchSetSnapshotId,
    )!;
    active.manifest.stoppingRule.note =
      "ChatGPT host model used an MCP provider fallback reasoning tool.";
    active.manifest.channels.push({
      channel: "chatgpt-host-discovery",
      status: "not-searched",
      retrievedAt: null,
      note: "The host model provider fallback did not return a tool result.",
    });
    active.manifest.queryMatrix.push({
      id: "provider-neutral-audit-query",
      query: "No ChatGPT model query was returned by the MCP host.",
      purpose: "Use host reasoning with a provider fallback tool.",
      returnedRecordIds: [],
    });
    active.manifest.exclusions.push({
      recordId: "host-model-fallback-record",
      reason: "Host model inference alone cannot establish identity.",
    });

    const html = renderState(state);

    expect(html).toContain("Supplemental source discovery");
    expect(html).toContain("alternate path");
    expect(html).toContain("Excluded lead 1");
    expect(html).not.toContain("host-model-fallback-record");
    expectProviderNeutral(html);
    expect(active.manifest.channels.at(-1)?.channel).toBe(
      "chatgpt-host-discovery",
    );
    expect(active.manifest.exclusions.at(-1)?.recordId).toBe(
      "host-model-fallback-record",
    );
  });

  it("projects fixed dossier wording without duplicate or ungrammatical provenance", () => {
    const copy = screen02ProviderNeutralCopy(
      "Source-derived fixed fallback, not a ChatGPT interpretation; this fallback does not confirm the identity or add substantive event facts.",
    );

    expect(copy).toBe(
      "Source-derived alternative, not an assisted interpretation; this alternate path does not confirm the identity or add substantive event facts.",
    );
    expectProviderNeutral(`<p>${copy}</p>`);
  });

  it("does not rewrite source facts that legitimately discuss AI models or tools", () => {
    const fact =
      "The rule covers AI models, inference tools, and host-country reporting duties.";
    expect(screen02ProviderNeutralCopy(fact)).toBe(fact);
  });

  it("keeps the stylesheet namespaced, responsive, focus-visible, reduced-motion aware, and free of Find selectors", () => {
    const css = readFileSync(
      new URL(
        "../../src/ui/screen-02-audit/screen-02-audit.css",
        import.meta.url,
      ),
      "utf8",
    );
    const globalCss = readFileSync(
      new URL("../../src/ui/global.css", import.meta.url),
      "utf8",
    );

    expect(css).toContain(".s2-audit {");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".s2-audit-button:disabled");
    expect(css).toContain(".s2-audit .s2-audit-sr-only");
    expect(globalCss).toContain(".s2-audit-spinner,");
    expect(globalCss).toContain("@keyframes shockaudit-spin");
    expect(globalCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.s2-audit-spinner,[\s\S]*?animation:\s*none;/,
    );
    expect(css).toMatch(
      /\.s2-audit \.s2-audit-match-list > li\s*\{[^}]*display:\s*block;/s,
    );
    expect(css).not.toContain(".s2-find");
    expect(globalCss).toContain("--danger: #b33232;");
    expect(globalCss).toContain("--danger: #ff8e8e;");
  });

  it("uses dedicated visible help for every reason-gated Audit action", () => {
    const identityHtml = renderState(unconfirmedDossierState());
    const confirmedHtml = renderState(buildAuditIdentityState());

    expect(identityHtml).toContain(
      "Add one short reason above to enable the identity buttons.",
    );
    expect(identityHtml).toContain(
      'aria-describedby="s2-audit-action-reason-ccpa-match-snapshot-v1-help"',
    );
    expect(identityHtml).toContain(
      "Enter a reason before recording that no retained record matches.",
    );
    expect(identityHtml).toContain(
      'aria-describedby="s2-audit-no-match-reason-help"',
    );
    expect(confirmedHtml).toContain(
      "Enter a reason before returning to the possible matches.",
    );
    expect(confirmedHtml).toContain(
      'aria-describedby="s2-audit-reconsider-reason-help"',
    );
  });

  it("keys a dossier by immutable match identity so decision drafts cannot cross matches", () => {
    const source = readFileSync(
      new URL(
        "../../src/ui/screen-02-audit/Screen02Audit.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain(
      "key={view.opened.match.matchSnapshotId}",
    );
    expect(source).not.toContain(
      'aria-describedby="s2-audit-no-match-reason"',
    );
    expect(source).not.toContain(
      'aria-describedby="s2-audit-reconsider-reason"',
    );
  });
});
