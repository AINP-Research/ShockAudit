import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import {
  SixScreenWorkflowProblemError,
  createSixScreenWorkflowProblem,
} from
  "../../src/core/six-screen/workflow-problem";
import type { PolicyReview } from
  "../../src/core/six-screen/contracts";
import { INITIAL_CAUSAL_METHOD_LIBRARY } from
  "../../src/core/six-screen/causal-comparison";
import {
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
  STUDY_DESIGN_METHOD_LIBRARY,
  createProposedTreatmentTiming,
  createScreen3StudyEntryContext,
  createStudyDesignAdvice,
} from "../../src/core/six-screen/study-design-advice";
import type { PolicyReviewedEventCard } from
  "../../src/core/six-screen/policy-event-card-review";
import {
  createFederalRegisterPolicyEvidencePlan,
  recordPolicyEvidencePlanAttempt,
} from "../../src/core/six-screen/policy-evidence-plan";
import {
  createPolicyBriefing,
  unsearchedFederalRegisterPolicyRequirements,
} from "../../src/core/six-screen/policy-review";
import { workflowResearchExportAvailability } from
  "../../src/core/six-screen/workflow-research-export";
import {
  applyPolicyReview,
  applyIdentityResolution,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  decideStudyDesignAdvice,
  openScreen2,
  openScreen3,
  refineStudyDesignAdvice,
} from "../../src/core/six-screen/workflow";
import type {
  CausalComparisonWorkspace,
  CoEventSearchWorkspace,
  PolicyEventCardWorkspace,
  PolicyLifecycleStageReviewWorkspace,
  StudyFirstEventInvestigationWorkspace,
  StudyFirstMechanismWorkspace,
  Screen6PublicPersonalization,
  SixScreenWorkflowPublicProjection,
} from
  "../../src/worker/six-screen-workflow-runtime";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createFrozenV24Screen6Fixture,
  createLockedBrowserEventCardFixture,
  frozenV24Screen6InputFingerprint,
} from "../browser/six-screen-event-card-review-fixture";
import SixScreenApp, {
  CausalComparisonPanel,
  CoEventSearchPanel,
  EventCardReviewPanel,
  IntelligenceProofPanel,
  message,
  openScreenWithCanonicalRecovery,
  PolicyLifecycleHandoffPanel,
  ResearchExportDrawer,
  Screen3StudyDetailsForm,
  StudyHandoffPanel,
  StudyDesignAdvicePanel,
  StudyFirstEventInvestigationPanel,
  StudyFirstMechanismPanel,
  analysisFailureDescriptor,
  analysisArtifactRecovered,
  cleanPolicyOverviewText,
  advanceScreen4AssessmentQueue,
  screen5AnalysisArtifactRecovered,
  studyFirstEventAnalysisMutation,
  reconcilePolicyResearchStep,
  prerequisiteBlockerMessages,
  policyTimelineItems,
  screen3RdRuleDraftFromSnapshot,
  screen3SubmissionBaseMatches,
  screen3HandoffOperationCoordinates,
  screen3OperationStatusDisposition,
  isTerminalScreen3RebuildProblem,
  proofCoordinatesMatchSnapshot,
  studyFirstHostCoordinatesMatchSnapshot,
  screen3StudyContextBlockers,
  shouldApplyCanonicalDraftRefresh,
  validateVisibleScreen3Draft,
  workflowSnapshotResponseDisposition,
} from
  "../../src/ui/six-screen/SixScreenApp";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { Screen6CurrentPlanPanel } from
  "../../src/ui/six-screen/Screen6CurrentPlanPanel";
import { SCREEN3_CONTEXTUALIZER_VERSION, SCREEN3_DESIGN_DIMENSIONS } from
  "../../src/worker/screen3-contextualizer";

const browserWindow: Record<string, unknown> = { openai: {} };
browserWindow.parent = browserWindow;
(globalThis as unknown as { window: Record<string, unknown> }).window =
  browserWindow;

function setWidgetState(value: Record<string, unknown>) {
  window.openai = { widgetState: value };
}

function confirmedSnapshot(withPolicy = false) {
  const documentNumber = withPolicy ? "2018-03708" : "2019-24931";
  const officialTitle = withPolicy
    ? "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators"
    : "Hospital Price Transparency Requirements";
  const publicationDate = withPolicy ? "2018-03-06" : "2019-11-27";
  const sourceLocator = withPolicy
    ? "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and"
    : "https://www.federalregister.gov/documents/2019/11/27/2019-24931/example";
  const identitySources = [{
    id: `source-${documentNumber}`,
    title: officialTitle,
    locator: sourceLocator,
    publisher: "Federal Register",
    publishedDate: publicationDate,
    authorityTier: "primary",
    retrievedAt: "2026-09-12T10:00:02.000Z",
  }];
  let state = createSixScreenWorkflow({
    runId: "six-screen-ui-run",
    studyId: "six-screen-ui-study",
    study: {
      population: withPolicy ? "RTOs and ISOs" : "Hospitals",
      analysisUnit: withPolicy ? "Market operator" : "Hospital",
      geography: ["United States"],
      industry: [withPolicy ? "Electric power" : "Health care"],
      period: { start: "2018", end: "2025" },
      outcome: "Operating margin",
      intendedConstruct: "Organizational resilience",
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: withPolicy
      ? "FERC Order 841 (2018-03708)"
      : "Hospital price transparency rule",
    createdAt: "2026-09-12T10:00:00.000Z",
  });
  const begun = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "ui-identity-request",
    requestedAt: "2026-09-12T10:00:01.000Z",
  });
  state = applyIdentityResolution(begun.state, {
    expectedRevision: 1,
    request: begun.request,
    candidates: [{
      id: `identity-${documentNumber}`,
      officialTitle,
      aliases: withPolicy ? ["Order 841"] : [],
      issuer: withPolicy
        ? "Federal Energy Regulatory Commission"
        : "Centers for Medicare & Medicaid Services",
      issuingJurisdiction: "United States",
      instrumentType: "final rule",
      formalIdentifiers: [documentNumber],
      episode: "final rule",
      versionScope: "published final rule",
      typedDates: [{
        start: publicationDate,
        end: null,
        precision: "day",
        kind: "publication",
        passageIds: [],
      }],
      identitySourceIds: [`source-${documentNumber}`],
      sourceSnapshotId: `identity-source-${documentNumber}`,
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription: "Official metadata identifies this final-rule episode.",
      matchExplanation: "The supplied title and official identifier match.",
      materialMismatches: [],
      retrievedAt: "2026-09-12T10:00:02.000Z",
    }],
    appliedAt: "2026-09-12T10:00:02.000Z",
  });
  const candidate = state.candidates[0]!;
  state = confirmDisplayedShock(state, {
    expectedRevision: 2,
    candidateId: candidate.id,
    displayedIdentityFingerprint: candidate.identityFingerprint,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    identityRevision: state.identityRevision,
    interactionId: "ui-confirm-interaction",
    decisionId: "ui-confirm-decision",
    actor: "researcher_ui",
    confirmedAt: "2026-09-12T10:00:03.000Z",
  });
  state = openScreen2(state, {
    expectedRevision: 3,
    openedAt: "2026-09-12T10:00:04.000Z",
  }).state;
  if (withPolicy) {
    const sourceUrl =
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
    const afterExplanation = recordPolicyEvidencePlanAttempt(
      createFederalRegisterPolicyEvidencePlan({
        id: "policy-plan-ui-order-841",
        identityFingerprint: state.confirmedShock!.identityFingerprint,
        documentNumber: "2018-03708",
        createdAt: "2026-09-12T10:00:04.000Z",
      }),
      {
        stepId: "explanatory-context-2018-03708",
        attemptedAt: "2026-09-12T10:00:04.000Z",
        outcome: "searched",
        failureCode: null,
        note: "An independent official explanation was inspected.",
      },
    );
    const plan = recordPolicyEvidencePlanAttempt(
      afterExplanation,
      {
        stepId: "fr-core-2018-03708",
        attemptedAt: "2026-09-12T10:00:04.000Z",
        outcome: "searched",
        failureCode: null,
        note: "The published rule and timing step was searched.",
      },
    );
    const requirements = unsearchedFederalRegisterPolicyRequirements(
      "2018-03708",
    ).map((requirement) => ({
      kind: requirement.kind as PolicyReview["requirements"][number]["kind"],
      description: requirement.description,
      status: requirement.kind === "temporal_stage" ||
          requirement.kind === "implementation"
        ? "supported" as const
        : requirement.kind === "operative_change"
          ? "not_found" as const
          : requirement.status,
      criticality: requirement.criticality,
    }));
    state = applyPolicyReview(state, {
      expectedRevision: 4,
      appliedAt: "2026-09-12T10:00:05.000Z",
      review: {
        protocolVersion: "screen-02-federal-register-policy-v2",
        taskId: "policy-task-ui-order-841",
        status: "partial",
        failureCode: null,
        documentNumber: "2018-03708",
        identityFingerprint: state.confirmedShock!.identityFingerprint,
        evidenceSnapshotId: "policy-evidence-ui-order-841",
        evidenceSnapshotFingerprint: fingerprintSixScreenValue("ui-evidence"),
        artifactStatus: "current",
        sourceCount: 1,
        passageCount: 2,
        claimCount: 2,
        claims: [
          {
            claimId: "claim-effective",
            predicate: "legal_effect_date",
            statement: "This final rule is effective June 4, 2018.",
            typedValue: { date: "2018-06-04", stage: "legal_effect" },
            supportStatus: "direct",
            qualification: "Legal effect does not establish implementation.",
            citation: {
              passageId: "passage-effective",
              exactText: "This final rule is effective June 4, 2018.",
              locator: "DATES — legal effect",
              documentVersionId: "document-order-841",
              sourceId: "source-order-841",
              sourceTitle: "Order 841",
              canonicalUrl: sourceUrl,
              sourceRole: "official Federal Register representation",
              inspectedText: "full",
            },
          },
          {
            claimId: "claim-implementation",
            predicate: "implementation_schedule",
            statement: "We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.",
            typedValue: {
              filingDeadlineDaysAfterPublication: 270,
              implementationWindowDaysAfterFilingDeadline: 365,
              anchor: "filing_deadline",
            },
            supportStatus: "direct",
            qualification: "This is not the rule's legal-effective date.",
            citation: {
              passageId: "passage-implementation",
              exactText: "We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.",
              locator: "Compliance and implementation schedule",
              documentVersionId: "document-order-841",
              sourceId: "source-order-841",
              sourceTitle: "Order 841",
              canonicalUrl: sourceUrl,
              sourceRole: "official Federal Register representation",
              inspectedText: "full",
            },
          },
        ],
        plan,
        progress: {
          searchedSteps: 2,
          totalSteps: 5,
          retainedDocuments: 1,
          chargedDocumentAttempts: 1,
          interruptedOperations: 0,
          receivedBytes: 480,
          activeResearchMs: 5,
          continuationMode: "panel_driven",
        },
        requirements,
        attemptedSources: [sourceUrl],
        unresolved: requirements
          .filter(({ status }) => status !== "supported")
          .map(({ kind }) => kind),
        limitation: "The coverage and exemptions step remains available.",
        researchedAt: "2026-09-12T10:00:04.000Z",
        invalidatedAt: null,
        invalidationReason: null,
      },
    });
  }
  return {
    schemaVersion: "shockaudit-six-screen-private-v1" as const,
    runId: state.runId,
    accessToken: `sa6a_${"a".repeat(43)}`,
    revision: state.revision,
    stateFingerprint: fingerprintSixScreenValue(state),
    state,
  };
}

function contentFirstPolicySnapshot() {
  const snapshot = confirmedSnapshot(true);
  const review = snapshot.state.policyReview!;
  const sourceUrl =
    "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
  review.claims.push(...([
    {
      claimId: "claim-policy-explanation",
      predicate: "policy_explanation",
      statement:
        "Order 841 explains how electric storage resources may participate in organized wholesale electric markets.",
      typedValue: { sourceType: "official_explanation" },
      supportStatus: "direct",
      qualification:
        "This introduction does not verify precise coverage, exemptions, enforcement, or timing.",
      citation: {
        passageId: "passage-policy-explanation",
        exactText:
          "Order 841 explains how electric storage resources may participate in organized wholesale electric markets.",
        locator: "Official explanatory passage 1",
        documentVersionId: "document-order-841-explanation",
        sourceId: "source-order-841-explanation",
        sourceTitle: "Federal Energy Regulatory Commission",
        provider: "Federal Register API",
        canonicalUrl: sourceUrl,
        sourceRole: "identity-bound official explanation",
        documentType: "official explanatory material",
        author: "Federal Energy Regulatory Commission",
        publicationDate: "2018-03-06",
        versionLabel: "Official abstract for FR Doc. 2018-03708",
        inspectedText: "partial",
      },
    },
    {
      claimId: "claim-operative-model",
      predicate: "operative_change",
      statement:
        "Each RTO and ISO must establish a participation model for electric storage resources.",
      typedValue: {
        component: "participation model",
        modality: "obligation",
      },
      supportStatus: "direct",
      qualification:
        "This establishes the tariff duty, not which study units were exposed.",
      citation: {
        passageId: "passage-operative-model",
        exactText:
          "Each RTO and ISO must establish a participation model for electric storage resources.",
        locator: "18 CFR 35.28(b)(9)",
        documentVersionId: "document-order-841",
        sourceId: "source-order-841",
        sourceTitle: "Order 841",
        canonicalUrl: sourceUrl,
        sourceRole: "official Federal Register final-rule text",
        inspectedText: "full",
      },
    },
    {
      claimId: "claim-formal-coverage",
      predicate: "coverage_condition",
      statement:
        "The rule applies to each RTO and ISO operating an organized wholesale electric market.",
      typedValue: { condition: "RTO or ISO operating an organized market" },
      supportStatus: "direct",
      qualification:
        "Formal coverage does not assign exposure to a particular organization-year.",
      citation: {
        passageId: "passage-formal-coverage",
        exactText:
          "The rule applies to each RTO and ISO operating an organized wholesale electric market.",
        locator: "Applicability",
        documentVersionId: "document-order-841",
        sourceId: "source-order-841",
        sourceTitle: "Order 841",
        canonicalUrl: sourceUrl,
        sourceRole: "official Federal Register final-rule text",
        inspectedText: "full",
      },
    },
    {
      claimId: "claim-ferc-enforcement",
      predicate: "enforcement_authority",
      statement:
        "The Commission may enforce compliance with the filed tariff requirements.",
      typedValue: { authority: "Federal Energy Regulatory Commission" },
      supportStatus: "direct",
      qualification:
        "The cited passage does not establish one instrument-wide monetary penalty.",
      citation: {
        passageId: "passage-ferc-enforcement",
        exactText:
          "The Commission may enforce compliance with the filed tariff requirements.",
        locator: "Enforcement authority",
        documentVersionId: "document-order-841",
        sourceId: "source-order-841",
        sourceTitle: "Order 841",
        canonicalUrl: sourceUrl,
        sourceRole: "official Federal Register final-rule text",
        inspectedText: "full",
      },
    },
  ] as PolicyReview["claims"]));
  review.claimCount = review.claims.length;
  review.passageCount = review.claims.length;
  review.sourceCount = 2;
  review.requirements = review.requirements.map((requirement) => ({
    ...requirement,
    status: requirement.kind === "operative_change"
      ? "supported"
      : requirement.kind === "coverage" || requirement.kind === "enforcement"
        ? "partially_supported"
        : requirement.status,
  }));
  review.unresolved = review.requirements.filter(({ status }) =>
    status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  review.briefing = createPolicyBriefing({
    title: snapshot.state.confirmedShock!.officialTitle,
    claims: review.claims,
    requirements: review.requirements,
    generatedAt: "2026-09-12T10:00:06.000Z",
  });
  snapshot.stateFingerprint = fingerprintSixScreenValue(snapshot.state);
  return snapshot;
}

function historicalPolicySnapshot() {
  const snapshot = confirmedSnapshot(true);
  const review = snapshot.state.policyReview!;
  const afterCoverage = recordPolicyEvidencePlanAttempt(review.plan, {
    stepId: "fr-coverage-2018-03708",
    attemptedAt: "2026-09-12T10:00:05.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Coverage and exemptions searched.",
  });
  const afterEnforcement = recordPolicyEvidencePlanAttempt(afterCoverage, {
    stepId: "fr-enforcement-2018-03708",
    attemptedAt: "2026-09-12T10:00:06.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Enforcement and sanctions searched.",
  });
  review.plan = recordPolicyEvidencePlanAttempt(afterEnforcement, {
    stepId: "fr-context-2018-03708",
    attemptedAt: "2026-09-12T10:00:07.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Point-in-time versions saved.",
  });
  const baselineUrl =
    "https://www.ecfr.gov/api/versioner/v1/full/2018-06-03/title-18.xml?part=35";
  const effectiveUrl =
    "https://www.ecfr.gov/api/versioner/v1/full/2018-06-04/title-18.xml?part=35";
  review.claims.push(
    {
      claimId: "claim-previous-baseline",
      predicate: "previous_baseline",
      statement:
        "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
      typedValue: {
        cfrTitle: "18",
        cfrPart: "35",
        asOf: "2018-06-03",
        comparedWith: "2018-06-04",
      },
      supportStatus: "direct",
      qualification:
        "This is the nearest unchanged paragraph at the pre-effective amendment boundary.",
      citation: {
        passageId: "passage-previous-baseline",
        exactText:
          "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.",
        locator: "18 CFR 35.28 — 2018-06-03 point-in-time boundary",
        documentVersionId: "document-18-35-2018-06-03",
        sourceId: "source-18-35-2018-06-03",
        sourceTitle: "Electronic Code of Federal Regulations",
        canonicalUrl: baselineUrl,
        sourceRole: "official eCFR point-in-time source",
        inspectedText: "full",
      },
    },
    {
      claimId: "claim-historical-version-change",
      predicate: "historical_version_change",
      statement:
        "(9) Electric storage resources. Each regional transmission organization must provide a participation model for electric storage resources.",
      typedValue: {
        cfrTitle: "18",
        cfrPart: "35",
        baselineAsOf: "2018-06-03",
        effectiveAsOf: "2018-06-04",
        changed: true,
      },
      supportStatus: "direct",
      qualification:
        "This requested-part comparison uses the effective-date snapshot, not current text.",
      citation: {
        passageId: "passage-historical-version-change",
        exactText:
          "(9) Electric storage resources. Each regional transmission organization must provide a participation model for electric storage resources.",
        locator: "18 CFR 35.28 — 2018-06-04 point-in-time addition",
        documentVersionId: "document-18-35-2018-06-04",
        sourceId: "source-18-35-2018-06-04",
        sourceTitle: "Electronic Code of Federal Regulations",
        canonicalUrl: effectiveUrl,
        sourceRole: "official eCFR point-in-time source",
        inspectedText: "full",
      },
    },
  );
  review.claimCount = review.claims.length;
  review.sourceCount = 3;
  review.passageCount = 4;
  review.progress = {
    ...review.progress,
    searchedSteps: 5,
    retainedDocuments: 3,
    chargedDocumentAttempts: 4,
    receivedBytes: 1_024,
    activeResearchMs: 15,
  };
  review.requirements = review.requirements.map((requirement) =>
    requirement.kind === "previous_baseline" || requirement.kind === "version"
      ? { ...requirement, status: "supported" }
      : requirement
  );
  review.unresolved = review.requirements
    .filter(({ status }) => status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  review.limitation = "Coverage and operative gaps remain explicit.";
  review.researchedAt = "2026-09-12T10:00:07.000Z";
  snapshot.stateFingerprint = fingerprintSixScreenValue(snapshot.state);
  return snapshot;
}

function historicalFallbackSnapshot() {
  const snapshot = confirmedSnapshot(true);
  const review = snapshot.state.policyReview!;
  const afterCoverage = recordPolicyEvidencePlanAttempt(review.plan, {
    stepId: "fr-coverage-2018-03708",
    attemptedAt: "2026-09-12T10:00:05.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Coverage and exemptions searched.",
  });
  const afterEnforcement = recordPolicyEvidencePlanAttempt(afterCoverage, {
    stepId: "fr-enforcement-2018-03708",
    attemptedAt: "2026-09-12T10:00:06.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Enforcement and sanctions searched.",
  });
  review.plan = recordPolicyEvidencePlanAttempt(afterEnforcement, {
    stepId: "fr-context-2018-03708",
    attemptedAt: "2026-09-12T10:00:07.000Z",
    outcome: "searched",
    failureCode: null,
    note: "Contemporaneous amendatory fallback saved.",
  });
  const sourceUrl =
    "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html";
  const instruction =
    "Amend \u00a7 35.28 by adding paragraph (b)(9) and revising paragraph (g)(9) to read as follows:";
  review.claims.push({
    claimId: "claim-contemporaneous-amendment",
    predicate: "contemporaneous_amendment_record",
    statement: `Contemporaneous amendatory instruction for 18 CFR Part 35: ${instruction}`,
    typedValue: {
      cfrCoordinates: [{ title: "18", part: "35" }],
      historicalVersionEstablished: false,
      legalEditionEstablished: false,
    },
    supportStatus: "direct",
    qualification:
      "This instruction does not establish the immediately preceding or effective-date codified version.",
    citation: {
      passageId: "passage-contemporaneous-amendment",
      exactText: instruction,
      locator: "Contemporaneous amendatory instruction 1",
      documentVersionId: "document-order-841",
      sourceId: "source-order-841",
      sourceTitle: "Federal Register",
      canonicalUrl: sourceUrl,
      sourceRole: "official contemporaneous amendatory text; not a codified CFR version",
      inspectedText: "full",
    },
  });
  review.claimCount = review.claims.length;
  review.passageCount += 1;
  review.progress = {
    ...review.progress,
    searchedSteps: 5,
    chargedDocumentAttempts: 2,
  };
  review.requirements = review.requirements.map((requirement) =>
    requirement.kind === "previous_baseline" || requirement.kind === "version"
      ? { ...requirement, status: "inaccessible" }
      : requirement
  );
  review.unresolved = review.requirements
    .filter(({ status }) => status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  review.limitation =
    "The adjacent-date eCFR version was unavailable; no current CFR text was substituted.";
  review.researchedAt = "2026-09-12T10:00:06.000Z";
  snapshot.stateFingerprint = fingerprintSixScreenValue(snapshot.state);
  return snapshot;
}

function eventCardWorkspaceFixture() {
  const review = {
    id: "review-ui-1",
    seriesId: "review-ui-1",
    ordinal: 1,
    revision: 1,
    status: "in_review",
    binding: { evidenceSnapshotId: "evidence-ui-1" },
    supersedes: null,
    claimReviews: [{
      claimId: "claim-ui-effective",
      claimProjectionFingerprint: fingerprintSixScreenValue("claim-ui-effective"),
      predicate: "legal_effect_date",
      sourceStatement: "The final rule is effective June 4, 2018.",
      sourceTypedValue: { date: "2018-06-04", stage: "legal_effect" },
      scope: "Confirmed final-rule episode",
      supportStatus: "direct",
      sourceReviewStatus: "unreviewed",
      criticalFor: ["screen-2-chronology"],
      conflictIds: [],
      lineages: [{
        direction: "supporting",
        passageId: "passage-ui-effective",
        documentVersionId: "document-ui-order-841",
        sourceId: "source-ui-order-841",
      }],
      decision: "corrected",
      effectiveStatement:
        "For this study, legal effect remains separate from implementation.",
      effectiveTypedValue: null,
      statementOrigin: "researcher_supplied",
      rationale: "Keep the legal and implementation clocks separate.",
      decidedAt: "2026-09-12T10:00:07.000Z",
      decisionEventId: "claim-decision-ui-1",
    }],
    treatmentClockDecision: {
      mode: "unreviewed",
      candidateId: null,
      rationale: null,
      decidedAt: null,
      decisionEventId: null,
    },
    changeHistory: [{
      id: "claim-decision-ui-1",
      revision: 1,
      kind: "claim_decision",
      actor: "researcher",
      at: "2026-09-12T10:00:07.000Z",
      projectionFingerprint: fingerprintSixScreenValue("projection-ui"),
      operationFingerprint: fingerprintSixScreenValue("operation-ui"),
      claimId: "claim-ui-effective",
      previous: {},
      next: {},
      summary:
        "Researcher corrected the legal-effect claim; the edit remains researcher-supplied.",
    }],
    lockedEventCard: null,
    createdAt: "2026-09-12T10:00:06.000Z",
    updatedAt: "2026-09-12T10:00:07.000Z",
    reviewFingerprint: fingerprintSixScreenValue("review-ui"),
  };
  return {
    schemaVersion: "screen-02-policy-event-card-workspace-v1",
    availability: "ready",
    unavailableReason: null,
    reviewStatus: "in_review",
    activeReview: review,
    revisions: [{
      reviewId: review.id,
      seriesId: review.seriesId,
      ordinal: 1,
      status: "in_review",
      evidenceSnapshotId: "evidence-ui-1",
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      supersedesReviewId: null,
      eventCardSnapshotId: null,
      changes: [{
        revision: 1,
        kind: "claim_decision",
        at: review.updatedAt,
        summary:
          "Researcher corrected the legal-effect claim; the edit remains researcher-supplied.",
      }],
    }],
    projection: {
      chronology: {
        absoluteClocks: [{
          id: "clock-ui-effective",
          label: "Legal effect",
          timing: {
            mode: "absolute",
            start: "2018-06-04",
            end: null,
            precision: "day",
          },
          qualifications: ["Legal effect does not establish implementation."],
          hasUnresolvedConflict: false,
        }],
        relativeClocks: [],
        undatedClocks: [],
      },
      treatmentClockReview: {
        candidates: [{
          id: "treatment-ui-effective",
          label: "Legal effect",
          timing: {
            mode: "absolute",
            start: "2018-06-04",
            end: null,
            precision: "day",
          },
          qualification:
            "A legal-effective date is not automatically the study treatment date.",
        }],
      },
      sourcePanel: {
        sourceCount: 1,
        sources: [{
          sourceId: "source-ui-order-841",
          publisher: "Federal Register",
          role: "controlling legal text",
          canonicalUrl:
            "https://www.federalregister.gov/documents/2018/03/06/2018-03708/example",
          inspectedText: "full",
          passages: [{
            passageId: "passage-ui-effective",
            locator: "DATES",
            exactText: "This final rule is effective June 4, 2018.",
            qualification: "This is not the implementation date.",
          }],
        }],
      },
    },
  } as unknown as PolicyEventCardWorkspace;
}

function causalComparisonPanelFixture() {
  const evidence = {
    claimId: "claim-ui-coverage",
    predicate: "coverage_condition",
    statement: "The requirement applies to operators serving the covered market.",
    decision: "accepted" as const,
    statementOrigin: "evidence_claim" as const,
    supportStatus: "direct" as const,
    passageIds: ["passage-ui-coverage"],
    documentVersionIds: ["document-ui-policy"],
    sourceIds: ["source-ui-policy"],
    conflictIds: [],
  };
  const option = {
    id: "design-option-ui",
    methodLibraryEntryId: "did-reviewed-v1" as const,
    family: "difference_in_differences" as const,
    label: "Coverage-based change-over-time comparison",
    status: "needs_data" as const,
    treatmentDefinition: "Covered operators under the reviewed policy package.",
    comparisonDefinition: "Otherwise comparable uncovered operators.",
    assignmentUnit: "Operator",
    analysisUnit: "Operator",
    timingDefinition: "No treatment clock was selected in Screen 2.",
    estimand: "A conditional change in market participation.",
    factualVariation: evidence.statement,
    supportingEvidence: [evidence],
    identifyingAssumptions: ["Counterfactual outcome trends are comparable."],
    importantThreats: ["Policy anticipation and spillovers"],
    missingPrerequisites: ["Specify the assignment-data frequency."],
    dataRequirements: ["Repeated operator observations."],
    unsupportedClaims: ["This option does not establish causal validity."],
    eligibilityRule: null,
    optionFingerprint: fingerprintSixScreenValue("option-ui"),
  };
  const eventCard = {
    snapshotId: "event-card-ui-current",
    reviewOrdinal: 1,
    treatmentClock: {
      mode: "no_selection",
      candidate: null,
      rationale: "No legal clock establishes treatment.",
      decidedAt: "2026-09-12T10:00:08.000Z",
      decisionEventId: "clock-decision-ui",
    },
    chronology: {
      absoluteClocks: [],
      relativeClocks: [],
      undatedClocks: [],
    },
    claims: [{
      ...evidence,
      claimProjectionFingerprint: fingerprintSixScreenValue("claim-ui"),
      sourceStatement: evidence.statement,
      sourceTypedValue: { population: "covered operators" },
      effectiveStatement: evidence.statement,
      effectiveTypedValue: { population: "covered operators" },
      scope: "Organizational coverage",
      sourceReviewStatus: "unreviewed",
      criticalFor: ["screen-3"],
      conflictIds: [],
      lineages: [{
        direction: "supporting",
        passageId: evidence.passageIds[0],
        documentVersionId: evidence.documentVersionIds[0],
        sourceId: evidence.sourceIds[0],
      }],
      rationale: "Retain the coverage premise.",
      decidedAt: "2026-09-12T10:00:07.000Z",
      decisionEventId: "claim-decision-ui",
    }],
  } as unknown as PolicyReviewedEventCard;
  const workspace = {
    schemaVersion: "screen-03-causal-comparison-workspace-v1",
    methodLibraryVersion: "screen-03-causal-method-library-v1",
    methodLibrary: INITIAL_CAUSAL_METHOD_LIBRARY,
    designSet: {
      snapshotId: "design-set-ui-current",
      ordinal: 1,
      options: [option],
      excludedMethods: [{
        methodLibraryEntryId: "threshold-reviewed-v1",
        reason: "No complete structured threshold rule was selected.",
        relatedClaimIds: [evidence.claimId],
      }],
    },
    decision: null,
    revisions: [{
      designSetSnapshotId: "design-set-ui-current",
      ordinal: 1,
      createdAt: "2026-09-12T10:00:09.000Z",
      eventCardSnapshotId: "event-card-ui-current",
      optionCount: 1,
      artifactStatus: "current",
      decision: "not_decided",
      selectedOptionLabel: null,
    }],
  } as unknown as CausalComparisonWorkspace;
  return { eventCard, workspace };
}

afterEach(() => setWidgetState({}));

describe("six-screen replacement app", () => {
  it("removes workflow-status prose from the policy overview", () => {
    expect(cleanPolicyOverviewText(
      "The acquired official representations support a substantive partial briefing. Consequential missing or partial requirements remain queued or explicitly unresolved. The law expanded coverage.",
    )).toBe("The law expanded coverage.");
  });

  it("adds confirmed identity dates to the visible Screen 2 chronology", () => {
    const snapshot = contentFirstPolicySnapshot();
    const review = snapshot.state.policyReview!;
    const identity = snapshot.state.confirmedShock!;
    const items = policyTimelineItems(review, {
      ...identity,
      typedDates: [...identity.typedDates, {
        start: "2020-07-01",
        end: null,
        precision: "day",
        kind: "enforcement",
        passageIds: [],
      }],
    });
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        date: expect.objectContaining({
          start: "2020-07-01",
          kind: "enforcement",
        }),
        origin: "confirmed_identity",
      }),
    ]));
  });

  function completedNextPolicyStep() {
    const before = confirmedSnapshot(true);
    const stepId = before.state.policyReview!.plan.nextStepId!;
    const after = structuredClone(before);
    const step = after.state.policyReview!.plan.steps.find(({ id }) =>
      id === stepId
    )!;
    step.status = "searched";
    after.state.policyReview!.plan.nextStepId =
      after.state.policyReview!.plan.steps.find(({ status }) =>
        status === "not_started"
      )?.id ?? null;
    after.state.policyReview!.progress.searchedSteps += 1;
    after.state.revision += 1;
    after.revision += 1;
    after.stateFingerprint = fingerprintSixScreenValue(after.state);
    return { before, after, stepId };
  }

  it("reconciles a lost research receipt from canonical state without repeating retrieval", async () => {
    const { before, after, stepId } = completedNextPolicyStep();
    const mutate = vi.fn(async () => {
      throw new Error("The workspace response was interrupted.");
    });
    const refresh = vi.fn(async () => after);

    await expect(reconcilePolicyResearchStep({
      before,
      stepId,
      mutate,
      refresh,
    })).resolves.toBe(after);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("replaces a stale research response with the canonical committed step", async () => {
    const { before, after, stepId } = completedNextPolicyStep();
    const mutate = vi.fn(async () => structuredClone(before));
    const refresh = vi.fn(async () => after);

    await expect(reconcilePolicyResearchStep({
      before,
      stepId,
      mutate,
      refresh,
    })).resolves.toBe(after);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("accepts a bounded waiting-source checkpoint as a committed research attempt", async () => {
    const { before, stepId } = completedNextPolicyStep();
    const checkpoint = structuredClone(before);
    const step = checkpoint.state.policyReview!.plan.steps.find(({ id }) =>
      id === stepId
    )!;
    step.status = "waiting_source";
    step.attempts += 1;
    step.lastAttemptedAt = "2026-09-12T10:00:08.000Z";
    step.failureCode = "source_unavailable";
    step.note =
      "The complementary source route did not return eligible material.";
    checkpoint.state.policyReview!.plan.updatedAt =
      "2026-09-12T10:00:08.000Z";
    checkpoint.state.policyReview!.plan.nextStepId = stepId;
    checkpoint.state.revision += 1;
    checkpoint.revision += 1;
    checkpoint.stateFingerprint = fingerprintSixScreenValue(checkpoint.state);
    const mutate = vi.fn(async () => checkpoint);
    const refresh = vi.fn(async () => structuredClone(before));

    await expect(reconcilePolicyResearchStep({
      before,
      stepId,
      mutate,
      refresh,
    })).resolves.toBe(checkpoint);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not replay research when canonical state cannot be read", async () => {
    const { before, stepId } = completedNextPolicyStep();
    const mutate = vi.fn(async () => {
      throw new Error("The workspace response was interrupted.");
    });
    const refresh = vi.fn(async () => {
      throw new Error("Canonical read unavailable.");
    });

    await expect(reconcilePolicyResearchStep({
      before,
      stepId,
      mutate,
      refresh,
    })).rejects.toThrow(/did not retry the mutation/iu);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not replay research across a concurrent canonical revision", async () => {
    const { before, stepId } = completedNextPolicyStep();
    const concurrent = structuredClone(before);
    concurrent.revision += 1;
    concurrent.state.revision += 1;
    concurrent.state.updatedAt = "2026-09-12T10:00:08.000Z";
    concurrent.stateFingerprint = fingerprintSixScreenValue(concurrent.state);
    const mutate = vi.fn(async () => structuredClone(before));
    const refresh = vi.fn(async () => concurrent);

    await expect(reconcilePolicyResearchStep({
      before,
      stepId,
      mutate,
      refresh,
    })).rejects.toThrow(/changed without completing this research step/iu);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("pauses a lost source receipt when canonical state shows no completed step", async () => {
    const { before, stepId } = completedNextPolicyStep();
    const mutate = vi.fn(async () => {
      throw new Error("The workspace response was interrupted.");
    });
    const refresh = vi.fn(async () => structuredClone(before));
    await expect(reconcilePolicyResearchStep({
      before, stepId, mutate, refresh,
    })).rejects.toThrow(/without automatically repeating the source request/iu);
    expect(mutate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("recovers same-revision Screen 4 source checkpoints but not view-only changes", () => {
    const snapshot = confirmedSnapshot(true);
    const beforeProjection = {
      runId: snapshot.runId,
      activeScreen: 3,
      studyFirstEventInvestigationWorkspace: {
        investigation: {
          snapshotId: "screen4-planned-ui",
          previousSnapshotId: null,
          investigationFingerprint: "fnv1a64:1111111111111111",
          plan: { planFingerprint: "fnv1a64:2222222222222222" },
        },
        discoveryTask: {
          taskId: "screen4-discovery-task-ui",
          state: "not_started",
          stage: "preparation",
          nextAction: "start",
          completedStepCount: 0,
          totalStepCount: 2,
          pendingStepCount: 2,
          queryCount: 0,
          documentCount: 0,
          recordsReceived: 0,
          recordsAccepted: 0,
          stopReason: null,
          continuationMode: "panel_driven",
          continuationDisclosure: "One explicit action advances one source step.",
        },
        documentedOccurrences: [],
      },
    } as unknown as SixScreenWorkflowPublicProjection;
    const checkpointProjection = structuredClone(beforeProjection);
    checkpointProjection.activeScreen = 4;
    Object.assign(
      checkpointProjection.studyFirstEventInvestigationWorkspace.discoveryTask!,
      {
        state: "partial",
        stage: "source_retrieval",
        nextAction: "resume",
        completedStepCount: 1,
        pendingStepCount: 1,
        queryCount: 1,
        documentCount: 3,
        recordsReceived: 3,
        recordsAccepted: 1,
        stopReason: "bounded_step_complete",
      },
    );
    const viewOnlyProjection = structuredClone(beforeProjection);
    viewOnlyProjection.activeScreen = 4;
    const mutation = {
      action: "open_screen_4",
      expectedInvestigationFingerprint: "fnv1a64:1111111111111111",
    };

    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      mutation,
      beforeProjection,
      checkpointProjection,
    )).toBe(true);
    const completedProjection = structuredClone(beforeProjection);
    completedProjection.activeScreen = 4;
    Object.assign(
      completedProjection.studyFirstEventInvestigationWorkspace.investigation!,
      {
        snapshotId: "screen4-completed-ui",
        previousSnapshotId: "screen4-planned-ui",
        investigationFingerprint: "fnv1a64:3333333333333333",
        status: "completed",
        presentation: {
          status: "completed_zero_events",
          visibleEventIds: [],
          overflowEventIds: [],
          coverage: { limitation: "Bounded source scan completed." },
          completedAt: "2026-09-27T12:00:00.000Z",
          presentationFingerprint: "fnv1a64:4444444444444444",
        },
      },
    );
    Object.assign(
      completedProjection.studyFirstEventInvestigationWorkspace.discoveryTask!,
      {
        state: "complete_zero",
        stage: "complete",
        nextAction: "none",
        completedStepCount: 2,
        pendingStepCount: 0,
        stopReason: "Bounded source scan completed.",
      },
    );
    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      { action: "open_screen_4" },
      beforeProjection,
      completedProjection,
    )).toBe(true);
    const firstOpenProjection = structuredClone(beforeProjection);
    firstOpenProjection.studyFirstEventInvestigationWorkspace.discoveryTask =
      null;
    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      { action: "open_screen_4" },
      firstOpenProjection,
      completedProjection,
    )).toBe(true);
    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      mutation,
      beforeProjection,
      viewOnlyProjection,
    )).toBe(false);
    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      {
        action: "refresh_study_first_events",
        expectedInvestigationFingerprint: "fnv1a64:1111111111111111",
      },
      beforeProjection,
      checkpointProjection,
    )).toBe(true);
  });

  it("recovers same-revision compact Screen 4 assessment progress by event ID", () => {
    const snapshot = confirmedSnapshot(true);
    const investigationFingerprint = "fnv1a64:1111111111111111";
    const taskFingerprint = "fnv1a64:2222222222222222";
    const eventIds = ["alternative-event-1", "alternative-event-2"];
    const beforeProjection = {
      runId: snapshot.runId,
      studyFirstEventInvestigationWorkspace: {
        investigation: {
          investigationFingerprint,
          presentation: { visibleEventIds: eventIds },
        },
        interpretationQueue: {
          taskFingerprint,
          status: "ready",
          retryEligibility: "new_request",
          results: [],
          error: null,
          diagnostic: null,
          diagnosis: {
            currentStep: "packet_preparation",
            batchNumber: 1,
            batchCount: 1,
            steps: [{ id: "source_manifest", status: "complete",
              detail: "Two displayed event IDs are frozen." }],
          },
          completedCount: 0,
          totalCount: 2,
        },
      },
    } as unknown as SixScreenWorkflowPublicProjection;
    const recoveredProjection = structuredClone(beforeProjection);
    Object.assign(
      recoveredProjection.studyFirstEventInvestigationWorkspace
        .interpretationQueue!,
      {
        status: "partial",
        retryEligibility: "new_request",
        completedCount: 1,
        results: [{
          eventId: eventIds[0],
          relationshipType: "potential_independent_event",
          documentedChange: "The source documents a new disclosure rule.",
          outcomePathway: "The rule may alter reporting costs.",
          nextCheck: "Map coverage to the proposed groups.",
          sourceIds: ["source-1"],
        }],
        diagnosis: {
          currentStep: "packet_preparation",
          batchNumber: 1,
          batchCount: 1,
          steps: [{ id: "source_manifest", status: "complete",
            detail: "Two displayed event IDs are frozen." }],
        },
      },
    );
    const mutation = {
      action: "analyze_study_first_events",
      expectedInvestigationFingerprint: investigationFingerprint,
    };

    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      mutation,
      beforeProjection,
      recoveredProjection,
    )).toBe(true);
    expect(analysisArtifactRecovered(
      snapshot,
      snapshot,
      mutation,
      beforeProjection,
      beforeProjection,
    )).toBe(false);
  });

  it("advances all ten displayed Screen 4 assessments from one UI action", async () => {
    const eventIds = Array.from({ length: 10 }, (_, index) =>
      `alternative-event-${index + 1}`);
    const initialQueue = {
      taskFingerprint: "fnv1a64:1111111111111111",
      status: "ready",
      retryEligibility: "new_request",
      results: [],
      error: null,
      diagnostic: null,
      diagnosis: null,
      completedCount: 0,
      totalCount: eventIds.length,
      readiness: {
        canDispatch: true,
        blocker: null,
        batchCount: 3,
        maximumReservationTokens: 168_000,
        nextReservationTokens: 56_000,
        availableTokens: 800_000,
        availableAttempts: 37,
      },
    } as NonNullable<
      StudyFirstEventInvestigationWorkspace["interpretationQueue"]
    >;
    const advance = vi.fn(async (current: typeof initialQueue) => {
      const completedCount = Math.min(
        current.completedCount + 4,
        eventIds.length,
      );
      return {
        ...current,
        status: completedCount === eventIds.length
          ? "completed" as const : "partial" as const,
        retryEligibility: completedCount === eventIds.length
          ? "none" as const : "new_request" as const,
        completedCount,
        results: eventIds.slice(0, completedCount).map((eventId) => ({
          eventId,
          relationshipType: "potential_independent_event" as const,
          documentedChange: `Documented change for ${eventId}.`,
          outcomePathway: `Outcome pathway for ${eventId}.`,
          nextCheck: `Next check for ${eventId}.`,
          sourceIds: [`source-${eventId}`],
        })),
      };
    });

    const completed = await advanceScreen4AssessmentQueue({
      initialQueue,
      advance,
    });

    expect(advance).toHaveBeenCalledTimes(3);
    expect(completed.status).toBe("completed");
    expect(completed.completedCount).toBe(10);
    expect(completed.results.map(({ eventId }) => eventId)).toEqual(eventIds);
  });

  it("recovers Screen 5 output only from the attempted frozen job lineage", () => {
    type RecoveryRun = NonNullable<Parameters<
      typeof screen5AnalysisArtifactRecovered
    >[0]["beforeRun"]>;
    const before = {
      id: "screen5-run-before",
      previousRunId: "screen5-run-earlier",
      runFingerprint: "fnv1a64:1111111111111111",
      context: { contextFingerprint: "fnv1a64:2222222222222222" },
      input: {
        id: "screen5-input-1",
        revision: 1,
        inputFingerprint: "fnv1a64:3333333333333333",
      },
      theoreticalProblem: {
        problemFingerprint: "fnv1a64:4444444444444444",
      },
      planning: {
        status: "available_via_direct_provider",
        plan: null,
      },
      providerExecution: {
        id: "screen5-job-1",
        provider: "openai",
        modelRequested: "gpt-6-luna",
        pilotId: "screen5-openai-local-v1",
        createdAt: "2026-09-25T15:00:00.000Z",
        inputFingerprint: "fnv1a64:3333333333333333",
        problemFingerprint: "fnv1a64:4444444444444444",
        comparison: null,
      },
    } as unknown as RecoveryRun;
    const recovered = {
      ...structuredClone(before),
      id: "screen5-run-plan-saved",
      previousRunId: before.id,
      runFingerprint: "fnv1a64:5555555555555555",
      planning: {
        status: "completed",
        plan: { planFingerprint: "fnv1a64:6666666666666666" },
      },
    } as unknown as RecoveryRun;

    expect(screen5AnalysisArtifactRecovered({
      beforeRun: before,
      afterRun: recovered,
      afterRuns: [before, recovered],
      operationId: "advance-screen5-attempt-1",
    })).toBe(true);

    const newerInput = structuredClone(recovered);
    newerInput.id = "screen5-run-newer-input";
    newerInput.previousRunId = recovered.id;
    newerInput.runFingerprint = "fnv1a64:7777777777777777";
    newerInput.input.id = "screen5-input-2";
    newerInput.input.revision = 2;
    newerInput.input.inputFingerprint = "fnv1a64:8888888888888888";
    newerInput.providerExecution!.id = "screen5-job-2";
    newerInput.providerExecution!.inputFingerprint =
      "fnv1a64:8888888888888888";
    expect(screen5AnalysisArtifactRecovered({
      beforeRun: before,
      afterRun: newerInput,
      afterRuns: [before, recovered, newerInput],
      operationId: "advance-screen5-attempt-1",
    })).toBe(false);
  });

  it("recovers a durable Screen 5 validation receipt without another request", () => {
    type RecoveryRun = NonNullable<Parameters<
      typeof screen5AnalysisArtifactRecovered
    >[0]["beforeRun"]>;
    const before = {
      id: "screen5-run-before-receipt",
      previousRunId: null,
      runFingerprint: "fnv1a64:1111111111111111",
      context: { contextFingerprint: "fnv1a64:2222222222222222" },
      input: {
        id: "screen5-input-1",
        revision: 1,
        inputFingerprint: "fnv1a64:3333333333333333",
      },
      theoreticalProblem: {
        problemFingerprint: "fnv1a64:4444444444444444",
      },
      planning: {
        status: "completed",
        plan: { planFingerprint: "fnv1a64:5555555555555555" },
      },
      providerExecution: {
        id: "screen5-job-1",
        provider: "openai",
        modelRequested: "gpt-6-luna",
        pilotId: "screen5-openai-local-v1",
        createdAt: "2026-10-18T15:00:00.000Z",
        inputFingerprint: "fnv1a64:3333333333333333",
        problemFingerprint: "fnv1a64:4444444444444444",
        comparison: null,
        attempts: [],
      },
    } as unknown as RecoveryRun;
    const recovered = structuredClone(before);
    recovered.id = "screen5-run-receipt-saved";
    recovered.previousRunId = before.id;
    recovered.runFingerprint = "fnv1a64:6666666666666666";
    recovered.providerExecution!.attempts = [{
      id: "screen5-assessment-attempt-1",
      stage: "assessment",
      status: "failed",
      errorCode: "provider_schema_invalid",
      responseReceipt: {
        status: "quarantined",
        contentFingerprint: "fnv1a64:7777777777777777",
        validationIssues: [{
          code: "disposition_card_mismatch",
          path: "$.dispositions",
          validationRevision: "assessment-v4-bounds-r1",
        }],
      },
    }] as never;

    expect(screen5AnalysisArtifactRecovered({
      beforeRun: before,
      afterRun: recovered,
      afterRuns: [before, recovered],
      operationId: "advance-screen5-attempt-1",
    })).toBe(true);
  });

  it("does not let an unrelated tab or replacement Screen 5 job satisfy an old attempt", () => {
    type RecoveryRun = NonNullable<Parameters<
      typeof screen5AnalysisArtifactRecovered
    >[0]["beforeRun"]>;
    const before = {
      id: "screen5-run-before",
      previousRunId: null,
      runFingerprint: "fnv1a64:1111111111111111",
      context: { contextFingerprint: "fnv1a64:2222222222222222" },
      input: {
        id: "screen5-input-1",
        revision: 1,
        inputFingerprint: "fnv1a64:3333333333333333",
      },
      theoreticalProblem: {
        problemFingerprint: "fnv1a64:4444444444444444",
      },
      planning: { status: "available_via_direct_provider", plan: null },
      providerExecution: {
        id: "screen5-job-1",
        provider: "openai",
        modelRequested: "gpt-6-luna",
        pilotId: "screen5-openai-local-v1",
        createdAt: "2026-09-25T15:00:00.000Z",
        inputFingerprint: "fnv1a64:3333333333333333",
        problemFingerprint: "fnv1a64:4444444444444444",
        comparison: null,
      },
    } as unknown as RecoveryRun;
    const unrelatedTab = {
      ...structuredClone(before),
      id: "screen5-run-other-tab",
      previousRunId: null,
      runFingerprint: "fnv1a64:5555555555555555",
      planning: {
        status: "completed",
        plan: { planFingerprint: "fnv1a64:6666666666666666" },
      },
    } as unknown as RecoveryRun;
    expect(screen5AnalysisArtifactRecovered({
      beforeRun: before,
      afterRun: unrelatedTab,
      afterRuns: [before, unrelatedTab],
      operationId: "advance-screen5-attempt-1",
    })).toBe(false);

    const replacementJob = structuredClone(unrelatedTab);
    replacementJob.previousRunId = before.id;
    replacementJob.providerExecution!.id = "screen5-job-replacement";
    expect(screen5AnalysisArtifactRecovered({
      beforeRun: before,
      afterRun: replacementJob,
      afterRuns: [before, replacementJob],
      operationId: "advance-screen5-attempt-1",
    })).toBe(false);
  });

  it("hides a proof result after any frozen workflow coordinate changes", () => {
    const eventCardFingerprint = fingerprintSixScreenValue("proof-card");
    const state = {
      revision: 7,
      artifacts: [{
        screen: 2,
        status: "current",
        snapshotId: "proof-card-snapshot",
      }],
      policyEventCardReviews: [{
        status: "locked",
        lockedEventCard: {
          snapshotId: "proof-card-snapshot",
          eventCardFingerprint,
        },
      }],
    };
    const snapshot = {
      runId: "proof-run",
      revision: 7,
      state,
    };
    const coordinates = {
      runId: "proof-run",
      expectedParentRevision: 7,
      expectedScopeFingerprint: fingerprintSixScreenValue(state),
      expectedEventFingerprint: eventCardFingerprint,
    };
    expect(proofCoordinatesMatchSnapshot(
      coordinates as never,
      snapshot as never,
    )).toBe(true);
    expect(proofCoordinatesMatchSnapshot(
      { ...coordinates, expectedParentRevision: 8 } as never,
      snapshot as never,
    )).toBe(false);
    expect(proofCoordinatesMatchSnapshot(
      {
        ...coordinates,
        expectedScopeFingerprint: fingerprintSixScreenValue("changed-state"),
      } as never,
      snapshot as never,
    )).toBe(false);
    expect(proofCoordinatesMatchSnapshot(
      {
        ...coordinates,
        expectedEventFingerprint: fingerprintSixScreenValue("changed-card"),
      } as never,
      snapshot as never,
    )).toBe(false);
  });

  it("rejects a Screen 5 host result after any frozen generation changes", () => {
    const eventFingerprint = fingerprintSixScreenValue("screen5-event");
    const state = { revision: 11, activeScreen: 5 };
    const snapshot = {
      runId: "screen5-coordinate-run",
      revision: 11,
      state,
    };
    const coordinates = {
      runId: "screen5-coordinate-run",
      expectedParentRevision: 11,
      expectedScopeFingerprint: fingerprintSixScreenValue(state),
      expectedEventFingerprint: eventFingerprint,
    };
    expect(studyFirstHostCoordinatesMatchSnapshot(
      coordinates as never,
      snapshot as never,
    )).toBe(true);
    expect(studyFirstHostCoordinatesMatchSnapshot(
      { ...coordinates, runId: "stale-run" } as never,
      snapshot as never,
    )).toBe(false);
    expect(studyFirstHostCoordinatesMatchSnapshot(
      { ...coordinates, expectedParentRevision: 12 } as never,
      snapshot as never,
    )).toBe(false);
    expect(studyFirstHostCoordinatesMatchSnapshot(
      {
        ...coordinates,
        expectedScopeFingerprint: fingerprintSixScreenValue("stale-state"),
      } as never,
      snapshot as never,
    )).toBe(false);
    expect(studyFirstHostCoordinatesMatchSnapshot(
      coordinates as never,
      snapshot as never,
      fingerprintSixScreenValue("different-event"),
    )).toBe(false);
  });

  it("keeps the proof harness hidden unless exact full host mode is advertised", () => {
    const common = {
      ready: true,
      busy: null,
      entries: {},
      notice: "",
      disabled: false,
      onRun: () => undefined,
    } as const;
    expect(renderToStaticMarkup(createElement(IntelligenceProofPanel, {
      ...common,
      mode: "disabled",
    }))).toBe("");

    const html = renderToStaticMarkup(createElement(IntelligenceProofPanel, {
      ...common,
      mode: "full",
    }));
    expect(html).toContain("Developer acceptance harness · proof only");
    expect(html).toContain("Run factual round trip");
    expect(html).toContain("Run mechanism round trip");
    expect(html).toContain("cannot change the Event Card");
    expect(html).toContain(
      "A persisted fixture or local submission is not signed-in evidence",
    );
  });

  it("renders the adopted navigation with only Screen 1 initially available", () => {
    setWidgetState({});
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Your study and policy");
    expect(html).toContain("Understand the policy");
    expect(html).toContain("Compare explanations");
    expect(html).toContain("Design summary");
    expect(html).toContain("not assessed");
    expect(html).toContain("Find my policy");
    expect(html).toContain("Confirm a source-supported policy on Screen 1 first.");
    expect(html).not.toContain("[object Object]");
    expect(html).toContain("Start a new search");
    expect(html).toContain("Study details");
    expect(html).not.toContain("Find mode");
    expect((html.match(/required=""/gu) ?? [])).toHaveLength(1);
    const navigation = html.slice(
      html.indexOf('<nav class="six-steps"'),
      html.indexOf("</nav>") + "</nav>".length,
    );
    expect((navigation.match(/disabled=""/gu) ?? [])).toHaveLength(5);
  });

  it("renders the shared identity-onward partial-export drawer", () => {
    const snapshot = confirmedSnapshot(true);
    const availability = workflowResearchExportAvailability(snapshot.state);
    const html = renderToStaticMarkup(createElement(ResearchExportDrawer, {
      open: true,
      state: snapshot.state,
      availability,
      onClose: () => undefined,
      onDownload: () => undefined,
    }));
    expect(html).toContain("Shared report drawer");
    expect(html).toContain("Partial current-snapshot export");
    expect(html).toContain("confirmed identity");
    expect(html).toContain("Download current research bundle (.json)");
    expect(html).toContain("not a causal certificate");
    expect(html).toContain(`revision ${snapshot.state.revision}`);
  });

  it("keeps an old saved workflow read-only and exposes a sanitized export action", () => {
    setWidgetState({
      privateContent: {
        screen01: { population: "Hospitals" },
        screen02: { selectedCandidateId: "legacy-candidate" },
      },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Legacy run preserved");
    expect(html).toContain("read-only and exportable");
    expect(html).toContain("Export saved run (.json)");
    expect(html).toContain("will not be converted into a confirmed shock");
  });

  it("keeps a locked legacy Event Card readable without restoring its old navigation gate", () => {
    const fixture = createLockedBrowserEventCardFixture();
    setWidgetState({
      privateContent: {
        sixScreenWorkflow: {
          schemaVersion: "shockaudit-six-screen-private-v1",
          runId: browserEventCardFixtureRunId,
          accessToken: browserEventCardFixtureAccessToken,
          revision: fixture.state.revision,
          state: fixture.state,
          stateFingerprint: fingerprintSixScreenValue(fixture.state),
          issuedAt: browserEventCardFixtureCreatedAt,
        },
      },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));

    expect(html).toContain("Historical Event Card decisions (preserved)");
    expect(html).toContain("is not a Screen 3 prerequisite");
    expect(html).toContain("accepted:");
    expect(html).toContain("Your study for the next step");
    expect(html).not.toContain("Source-claim approval is not required");
    expect(html).toContain("You can edit again the study information saved for later screens.");
    expect(html).not.toContain('aria-label="Policy Event Card review"');
  });

  it("restores a canonical confirmed run into automatic bounded Screen 2 research", () => {
    setWidgetState({
      privateContent: { sixScreenWorkflow: confirmedSnapshot() },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Confirmed policy episode");
    expect(html).toContain("Understand the policy change");
    expect(html).toContain("Hospital Price Transparency Requirements");
    expect(html).toContain("Preparing the search");
    expect(html).toContain("bounded evidence plan will start automatically");
    expect(html).toContain("Your study for the next step");
    expect(html).toContain("Continue to comparison guidance");
    expect(html).not.toContain("Build source-supported policy briefing");
    expect(html).not.toContain("Add explanatory source pages");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("Resolve policy identity");
  });

  it("identifies only the genuinely missing study input before the Screen 3 handoff", () => {
    const snapshot = confirmedSnapshot(true);
    expect(screen3StudyContextBlockers(snapshot.state.study)).toEqual([{
      code: "study_question",
      message: "State the intended policy-effect question or explanation.",
    }]);
  });

  it("validates the visible UI draft independently of older saved blockers", () => {
    const snapshot = confirmedSnapshot(true);
    const form = {
      shockInput: snapshot.state.originalShockInput,
      officialSource: "",
      requestedJurisdiction: "United States",
      approximateYear: "2018",
      intendedEpisode: "final rule",
      population: snapshot.state.study.population!,
      analysisUnit: snapshot.state.study.analysisUnit!,
      geography: snapshot.state.study.geography.join(", "),
      industry: snapshot.state.study.industry.join(", "),
      periodStart: snapshot.state.study.period.start!,
      periodEnd: snapshot.state.study.period.end!,
      outcome: snapshot.state.study.outcome!,
      outcomeMeasure: "",
      intendedConstruct: snapshot.state.study.intendedConstruct ?? "",
      policySideConcept: "",
      initialExplanation: "How did Order 841 affect operating margins?",
      proposedTreatment: "",
      proposedComparison: "",
      resultsPreviouslyInspected:
        snapshot.state.study.resultsPreviouslyInspected,
    };

    expect(snapshot.state.study.initialExplanation).toBeNull();
    expect(validateVisibleScreen3Draft(form, {
      mode: "undecided",
      year: "",
    })).toMatchObject({ ready: true, issues: [] });
  });

  it("preserves a dirty draft when canonical evidence arrives", () => {
    expect(shouldApplyCanonicalDraftRefresh(3, 3)).toBe(true);
    expect(shouldApplyCanonicalDraftRefresh(3, 4)).toBe(false);
  });

  it("prefills known study values in the compact missing-input form", () => {
    const snapshot = confirmedSnapshot(true);
    const form = {
      shockInput: snapshot.state.originalShockInput,
      officialSource: "",
      requestedJurisdiction: "United States",
      approximateYear: "2018",
      intendedEpisode: "final rule",
      population: snapshot.state.study.population!,
      analysisUnit: snapshot.state.study.analysisUnit!,
      geography: snapshot.state.study.geography.join(", "),
      industry: snapshot.state.study.industry.join(", "),
      periodStart: snapshot.state.study.period.start!,
      periodEnd: snapshot.state.study.period.end!,
      outcome: snapshot.state.study.outcome!,
      outcomeMeasure: "",
      intendedConstruct: snapshot.state.study.intendedConstruct ?? "",
      policySideConcept: "",
      initialExplanation: "",
      proposedTreatment: "",
      proposedComparison: "",
      resultsPreviouslyInspected: snapshot.state.study.resultsPreviouslyInspected,
    };
    const html = renderToStaticMarkup(createElement(Screen3StudyDetailsForm, {
      form,
      disabled: false,
      onChange: () => undefined,
      onSubmit: () => undefined,
    }));

    expect(html).toContain('value="RTOs and ISOs"');
    expect(html).toContain('value="Market operator"');
    expect(html).toContain('value="United States"');
    expect(html).toContain('value="2018"');
    expect(html).toContain('value="2025"');
    expect(html).toContain("How the shock affects the outcome (i.e., mechanism)");
    expect(html).toContain("Theoretical construct of the shock");
    expect(html).not.toContain('name="intendedConstruct"');
    expect(html).toContain("Use this prior wording for the shock construct");
  });

  it("renders Screen 3 warnings as read-only disclosure with no mutation action", () => {
    const study = {
      id: "study-warning-ui",
      revision: 1,
      population: "Public firms",
      analysisUnit: "firm-year",
      geography: ["United States"],
      industry: ["Manufacturing"],
      period: { start: "2015", end: "2025" },
      outcome: "Firm performance",
      outcomeMeasure: "ROA",
      intendedConstruct: "Organizational performance",
      policySideConcept: "Transparency",
      initialExplanation: "How does transparency affect firm performance?",
      proposedTreatment: "Proposed affected firms",
      proposedComparison: "Proposed comparison firms",
      resultsPreviouslyInspected: "not_disclosed" as const,
      createdAt: "2026-09-19T12:00:00.000Z",
      updatedAt: "2026-09-19T12:00:00.000Z",
    };
    const timing = createProposedTreatmentTiming({
      value: { mode: "year", year: 2020, milestoneReference: null },
      identityFingerprint: "fnv1a64:1111111111111111",
      revision: 1,
      createdAt: "2026-09-19T12:00:00.000Z",
    });
    const entryContext = createScreen3StudyEntryContext({
      identityFingerprint: timing.identityFingerprint,
      study,
      timing,
      policyReview: null,
      excludedLegacyRejectedClaimIds: [],
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      createdAt: "2026-09-19T12:00:00.000Z",
    });
    const advice = createStudyDesignAdvice({
      study,
      timing,
      entryContext,
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      createdAt: "2026-09-19T12:00:00.000Z",
    });
    const before = fingerprintSixScreenValue(advice);
    const onRefine = vi.fn();
    const onDecide = vi.fn();
    const workspace = {
      methodLibraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
      methodLibrary: STUDY_DESIGN_METHOD_LIBRARY,
      timing,
      entryContext,
      advice,
      contextualization: null,
      selection: null,
      defaultClarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      revisions: [],
    };
    const html = renderToStaticMarkup(createElement(StudyDesignAdvicePanel, {
      workspace,
      disabled: false,
      onContextualize: () => undefined,
      onRefine,
      onDecide,
      onEdit: () => undefined,
    }));
    const warningStart = html.indexOf(
      'aria-label="Study-specific design assessment"',
    );
    const warningEnd = html.indexOf("six-general-design-checks", warningStart);
    const warningMarkup = html.slice(warningStart, warningEnd);

    expect(warningStart).toBeGreaterThan(-1);
    expect(warningMarkup).toContain("Not yet generated");
    expect(warningMarkup).toContain("Generate study-specific assessment");
    expect(warningMarkup).not.toContain("Treatment-year fit");
    expect(warningMarkup).not.toContain("Pre/post time support");
    expect(warningMarkup).not.toContain("Anticipation and advance notice");
    expect(warningMarkup).not.toContain("As-if random assignment");
    expect(warningMarkup).not.toContain("Interference and SUTVA");
    expect(warningMarkup).not.toContain("Composition, attrition and selection");
    expect(warningMarkup).toContain("No model assessment is displayed yet");
    expect(warningMarkup).not.toContain("six-design-concern-heading");
    expect(html).toContain("Method assumptions and next checks");
    expect(warningMarkup).not.toMatch(/approve|dismiss|resolve warning/iu);
    expect(html).toContain("Why this method");
    expect(html).toContain("Suggested specification");
    expect(html).toContain("Y_it = α_i + λ_t + β(A_i × Post_t) + ε_it");
    expect(html).toContain("Assumptions to examine");
    expect(html).toContain("Data requirements");
    expect(html).toContain("Estimator and inference considerations");
    expect(html).toContain("Specific missing information");
    expect(html).toContain("Proposed pathway:");
    expect(html).not.toContain("D01 ·");
    expect(html).not.toContain("library only");
    expect(html).not.toContain("Policy evidence status:");
    expect(html.indexOf("Suggested specification")).toBeLessThan(
      html.indexOf("Technical qualifications and sources"),
    );
    const firstWarning = advice.warnings[0]!;
    const critiqueHtml = renderToStaticMarkup(createElement(
      StudyDesignAdvicePanel, {
        workspace: {
          ...workspace,
          contextualization: {
            id: "screen3-critique-fixture",
            inputFingerprint: advice.adviceFingerprint,
            status: "completed",
            retryEligibility: "none",
            dispatchState: "dispatched",
            failureCode: null,
            failureStage: null,
            supplement: {
              schema_version: SCREEN3_CONTEXTUALIZER_VERSION,
              concerns: SCREEN3_DESIGN_DIMENSIONS.map((dimension, index) => ({
                issue_id: dimension.id,
                specific_heading: dimension.heading,
                status_label: index === 0
                  ? "Treatment clock needs review" : "Requires design evidence",
                relevant_fact_or_proposal: index === 0
                  ? "The official notice describes the coverage condition and the researcher proposes a 2020 treatment boundary."
                  : `The saved study supplies inputs for ${dimension.heading.toLowerCase()}.`,
                why_it_matters: index === 0
                  ? "The proposed groups require a coverage and policy-stage check."
                  : "This dimension can change the interpretation of the proposed comparison.",
                unresolved_question: "What does the firm-level evidence show?",
                next_check: "Match dated firm and period records against the saved proposal.",
                check_limit: "This map cannot establish comparable untreated outcomes.",
                priority: index < 2 ? "high" as const : "medium" as const,
                priority_reason: "The proposed exposure contrast depends on this condition.",
                documentary_claim_ids: index === 0
                  ? ["claim-coverage-fixture"] : [],
                researcher_input_fields: ["proposedTreatment"],
              })),
              synthesis_limit: "Exposure remains unverified.",
            },
            error: null,
            providerResponseId: "response-fixture",
            usage: null,
          },
        },
        policyReview: {
          claims: [{
            claimId: "claim-coverage-fixture",
            supportStatus: "direct",
            citation: {
              sourceId: "source-coverage-fixture",
              documentVersionId: "version-coverage-fixture",
              sourceTitle: "Official coverage notice",
              canonicalUrl: "https://example.gov/coverage",
              publicationDate: "2020-01-01",
              versionLabel: "2020 version",
            },
          }],
        } as unknown as PolicyReview,
        disabled: false,
        onContextualize: () => undefined,
        onRefine,
        onDecide,
        onEdit: () => undefined,
      },
    ));
    const bespokeRegion = critiqueHtml.slice(
      critiqueHtml.indexOf('id="screen3-study-specific-assessment"'),
      critiqueHtml.indexOf("six-general-design-checks"),
    );
    expect(bespokeRegion).toContain("Treatment-year fit");
    expect(bespokeRegion).not.toContain(`<h4>${firstWarning.message}</h4>`);
    expect(critiqueHtml).toContain(
      "The proposed groups require a coverage and policy-stage check.",
    );
    expect(critiqueHtml).toContain("Researcher proposal: Proposed affected group");
    expect(critiqueHtml).toContain("Official coverage notice");
    expect(critiqueHtml).toContain("https://example.gov/coverage");
    expect(critiqueHtml).toContain("Exposure remains unverified.");
    expect(bespokeRegion).toContain("ChatGPT API · study-specific assessment");
    expect(bespokeRegion).toContain("Six structured checks to carry into the design");
    expect(bespokeRegion).not.toContain("Saved study-specific assessment");
    expect(bespokeRegion).not.toContain("Local method framework · not model output");
    expect(bespokeRegion).toContain("Treatment-year fit");
    expect(bespokeRegion).toContain("Pre/post time support");
    expect(bespokeRegion).toContain("Anticipation and advance notice");
    expect(bespokeRegion).toContain("As-if random assignment");
    expect(bespokeRegion).toContain("Interference and SUTVA");
    expect(bespokeRegion).toContain("Composition, attrition and selection");
    expect(bespokeRegion.match(/Treatment-year fit/gu)).toHaveLength(1);
    expect(critiqueHtml).not.toContain("Generate study-specific assessment");
    expect(critiqueHtml).not.toContain("six-design-contextual-critique");
    const failedTask = {
      id: "screen3-critique-failed-fixture",
      inputFingerprint: advice.adviceFingerprint,
      status: "failed" as const,
      retryEligibility: "new_request" as const,
      dispatchState: "not_dispatched" as const,
      failureCode: "input_too_large",
      failureStage: "admission" as const,
      supplement: null,
      error: "Local input ceiling was exceeded before dispatch.",
      providerResponseId: null,
      usage: null,
    };
    const failedHtml = renderToStaticMarkup(createElement(
      StudyDesignAdvicePanel, {
        workspace: { ...workspace, contextualization: failedTask },
        disabled: false,
        onContextualize: () => undefined,
        modelAuthorizationDetails: "Reserves up to 48,000 tokens.",
        onRefine, onDecide, onEdit: () => undefined,
      },
    ));
    expect(failedHtml).toContain("Generate study-specific assessment (new attempt)");
    expect(failedHtml).toContain("Reserves up to 48,000 tokens.");
    expect(failedHtml).toContain("Why the assessment stopped");
    expect(failedHtml).toContain("stopped before dispatch");
    const rejectedHtml = renderToStaticMarkup(createElement(
      StudyDesignAdvicePanel, {
        workspace: { ...workspace, contextualization: {
          ...failedTask, dispatchState: "dispatched",
          failureCode: "http_error",
          failureStage: "response_headers",
          error: "Known provider rejection (http_error).",
        } },
        disabled: false, onRefine, onDecide, onEdit: () => undefined,
      },
    ));
    expect(rejectedHtml).toContain("provider rejected the request");
    const receiptHtml = renderToStaticMarkup(createElement(
      StudyDesignAdvicePanel, {
        workspace: { ...workspace, contextualization: {
          ...failedTask, status: "validation_failed",
          dispatchState: "dispatched", failureCode: "local_receipt_validation_failed",
          failureStage: "model_output",
          retryEligibility: "local_revalidation",
          error: "Saved response did not pass local validation.",
        } },
        disabled: false, onContextualize: () => undefined,
        onRefine, onDecide, onEdit: () => undefined,
      },
    ));
    expect(receiptHtml).toContain("Saved response failed local validation");
    expect(receiptHtml).toContain("Recheck saved response");
    const pendingHtml = renderToStaticMarkup(createElement(
      StudyDesignAdvicePanel, {
        workspace: { ...workspace, contextualization: {
          ...failedTask, status: "pending", retryEligibility: "observe",
          dispatchState: "dispatched", failureCode: null, failureStage: null,
          error: null,
        } },
        disabled: false, onRefine, onDecide, onEdit: () => undefined,
        onContextualize: () => undefined,
      },
    ));
    expect(pendingHtml).not.toContain("Generate study-specific assessment (new attempt)");
    expect(pendingHtml).toContain("Reviewing your policy and proposed comparison");
    expect(onRefine).not.toHaveBeenCalled();
    expect(onDecide).not.toHaveBeenCalled();
    expect(fingerprintSixScreenValue(advice)).toBe(before);
  });

  it("V02/E07 renders the study-first event list and six read-only inspector sections without review controls", () => {
    const occurrence = {
      schemaVersion: "screen-04-coevent-candidate-v1" as const,
      id: "documented-event-1",
      providerId: "federal_register" as const,
      sourceNativeId: "2021-12345",
      title: "Documented market reporting rule",
      description: "The official record documents a reporting-rule change.",
      eventFamily: "overlapping_policy",
      formalIdentifiers: ["2021-12345"],
      typedDates: [{
        kind: "effective" as const,
        value: "2021-06-21",
        precision: "day" as const,
        sourceId: "source-event-1",
      }],
      affectedActivityOrPopulation: {
        status: "not_established" as const,
        labels: [] as [],
      },
      geography: {
        status: "provider_reported" as const,
        labels: ["United States"],
      },
      evidence: [{
        sourceId: "source-event-1",
        title: "Official market reporting rule",
        locator: "https://www.federalregister.gov/d/2021-12345",
        publisher: "Federal Register",
        publishedDate: "2021-05-20",
        authorityTier: 1 as const,
        retrievedAt: "2026-09-20T15:00:02.000Z",
        evidenceRole: "occurrence_metadata" as const,
        factText:
          "The official record distinguishes publication from the effective date.",
      }],
      occurrenceStatus: "source_metadata_documented" as const,
      relationToComparison: {
        status: "not_assessed" as const,
        reason: "genuine_intelligence_path_unverified" as const,
      },
      reusableAcrossDesignRevisions: true as const,
      version: 1 as const,
      recordedAt: "2026-09-20T15:00:02.000Z",
      claimBoundary: "Occurrence fields only.",
      candidateFingerprint: "fnv1a64:1111111111111111",
    };
    const analysis = {
      schemaVersion: "screen-04-study-first-conditional-analysis-v2" as const,
      id: "analysis-event-1",
      eventId: occurrence.id,
      branchRoles: ["overlapping_policy" as const],
      interpretationMode: "conditional_library_only" as const,
      relationshipType: "potential_independent_event" as const,
      relationshipStatus: "hypothetical" as const,
      documentEventDistinction: {
        documentRole: "official_rule_or_notice" as const,
        publicationDate: "2021-05-20",
        substantiveOccurrenceDate: "2021-06-21",
        dateRoleStatus: "distinct_dates_documented" as const,
        explanation:
          "The source distinguishes publication on 2021-05-20 from the recorded substantive date 2021-06-21.",
      },
      whatHappened: "An official record documents the reporting-rule change.",
      documentedFactRefs: ["source-event-1"],
      whyRelevant: "Its timing makes it worth inspecting without establishing sample exposure.",
      studyInputRefs: [],
      outcomePathway: "If it changed reporting costs, it could affect the selected outcome.",
      comparisonImplication: "It matters only if exposure differs across the proposed groups.",
      temporalInterpretation: "The date falls inside the proposed study window.",
      requiredExposureAssumptions: ["The event reaches sampled units."],
      directionStatus: "unknown" as const,
      uncertainties: ["No dataset was uploaded."],
      nextChecks: ["Verify historical exposure for both groups."],
      supportingPassageRefs: [],
      contradictions: [],
      executionProvenance: {
        libraryVersion: "screen-04-study-first-conditional-analysis-v2" as const,
        semanticRouteStatus: "unavailable" as const,
      },
      analysisFingerprint: "fnv1a64:2222222222222222",
    };
    const readyQueue = {
      status: "ready",
      retryEligibility: "new_request",
      results: [],
      error: null,
      completedCount: 0,
      totalCount: 1,
      readiness: {
        canDispatch: true,
        blocker: null,
        batchCount: 1,
        maximumReservationTokens: 56_000,
        nextReservationTokens: 56_000,
        availableTokens: 800_000,
        availableAttempts: 37,
      },
    };
    const workspace = {
      investigation: {
        schemaVersion: "screen-04-study-first-investigation-v1" as const,
        snapshotId: "investigation-complete-1",
        ordinal: 2,
        previousSnapshotId: "investigation-planned-1",
        context: {
          study: {
            population: "U.S. public manufacturers",
            proposedTreatment: "California firms",
            proposedComparison: "Non-California firms",
          },
          groupsPresent: true,
          effectiveScope: {
            occurrenceStart: "2018-01-01",
            occurrenceEnd: "2025-12-31",
          },
        },
        plan: { steps: [] },
        status: "completed" as const,
        attempts: [],
        occurrences: [occurrence],
        analyses: [analysis],
        presentation: {
          status: "events_available" as const,
          visibleEventIds: [occurrence.id],
          overflowEventIds: [],
          coverage: {
            limitation: "Bounded official-source coverage completed.",
          },
          completedAt: "2026-09-20T15:00:03.000Z",
          presentationFingerprint: "fnv1a64:3333333333333333",
        },
        startedAt: "2026-09-20T15:00:01.000Z",
        completedAt: "2026-09-20T15:00:03.000Z",
        investigationFingerprint: "fnv1a64:4444444444444444",
      },
      interpretationQueue: readyQueue,
      latestScreen5Handoff: null,
      revisions: [],
      claimBoundary: "Occurrence and conditional interpretation stay separate.",
    } as unknown as StudyFirstEventInvestigationWorkspace;
    const before = fingerprintSixScreenValue(workspace);
    const onAnalyze = vi.fn();
    const onRefresh = vi.fn();
    const html = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      {
        workspace,
        refreshAvailable: true,
        onRefresh,
        hostEntries: {},
        onAnalyze,
      },
    ));

    expect(html).not.toContain("Events found");
    expect(html).toContain("Study-specific event assessment — Not assessed");
    expect(html).not.toContain("Why it may matter");
    expect(html).not.toContain("What to check next");
    expect(html).toContain("1 alternative shock found");
    expect(html).toContain("Alternative shocks");
    expect(html).toContain("Documented market reporting rule");
    expect(html).toContain("Source documented · assessment pending");
    expect(html).toContain("Source record");
    expect(html).not.toContain("The source record is saved");
    expect(html).not.toContain(
      "Verify the event date, affected activity and",
    );
    expect(html).not.toContain("What is documented");
    expect(html).not.toContain("<h4>Implications for your proposed comparison</h4>");
    expect(html).toContain("Evidence and general screening notes");
    expect(html).toContain("https://www.federalregister.gov/d/2021-12345");
    expect(html).not.toContain("Relevance pending");
    expect(html).toContain("Assess relevance to my study");
    expect(html).not.toContain("Interpretation available");
    expect(html).toContain("ChatGPT will add the three assessment sections");
    expect(html).not.toContain("This click authorizes at most");
    expect(html).not.toContain("The maximum across the remaining queue is");
    expect(html).toContain("Refresh other-event search");
    expect(html).toContain("earlier result in history");
    expect(html).toContain("Search coverage and remaining gaps");
    expect(html).not.toContain("Assess this event with signed-in ChatGPT");
    expect(html).not.toMatch(/Retain as|Reject with reason|Your classification/iu);
    expect(onAnalyze).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(fingerprintSixScreenValue(workspace)).toBe(before);
    const currentSourceHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace, refreshAvailable: false, onRefresh },
    ));
    expect(currentSourceHtml).not.toContain("Refresh other-event search");
    const refreshingHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace, refreshAvailable: true, refreshBusy: true, onRefresh },
    ));
    expect(refreshingHtml).toContain("Refreshing other-event search…");
    expect(refreshingHtml).toMatch(
      /disabled=""[^>]*>Refreshing other-event search…<\/button>/u,
    );
    const busyHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      { workspace, interpretationBusy: true, onAnalyze },
    ));
    expect(busyHtml).toContain("Assessing event relevance…");
    expect(busyHtml).toMatch(
      /disabled=""[^>]*>Assessing event relevance…<\/button>/u,
    );
    const onResumeSource = vi.fn();
    const savedSourceHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel,
      {
        workspace: {
          ...workspace,
          investigation: {
            ...workspace.investigation!,
            status: "planned",
          },
          discoveryTask: {
            taskId: "screen4-source-ui-one-action",
            state: "partial",
            stage: "local_processing",
            nextAction: "resume",
            completedStepCount: 9,
            totalStepCount: 10,
            pendingStepCount: 0,
            queryCount: 8,
            documentCount: 0,
            recordsReceived: 65,
            recordsAccepted: 2,
            stopReason: "Saved source checkpoints await local aggregation.",
            continuationMode: "panel_driven",
            continuationDisclosure:
              "The saved checkpoint can be completed without repeating retrieval.",
          },
          documentedOccurrences: [occurrence],
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onResumeSource,
        onAnalyze,
      },
    ));
    expect(savedSourceHtml).toContain(
      "Finish source results",
    );
    expect(savedSourceHtml).toContain(
      "It does not call ChatGPT",
    );
    expect(savedSourceHtml).not.toContain("assess relevance");
    expect(onResumeSource).not.toHaveBeenCalled();
    expect(studyFirstEventAnalysisMutation({
      expectedRevision: 12,
      operationId: "screen4-ui-analysis-test",
      expectedInvestigationFingerprint:
        workspace.investigation!.investigationFingerprint,
    })).toEqual({
      action: "analyze_study_first_events",
      expectedRevision: 12,
      operationId: "screen4-ui-analysis-test",
      expectedInvestigationFingerprint:
        workspace.investigation!.investigationFingerprint,
    });
    const validatedResult = {
      eventId: occurrence.id,
      relationshipType: "measurement_or_sample_change",
      documentedChange: "The source documents a reporting requirement.",
      outcomePathway: "Administrative effort may affect return on assets.",
      nextCheck:
        "Map the documented coverage rule to sampled firms.",
      sourceIds: ["source-event-1"],
    };
    const completedHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...workspace,
          interpretationQueue: {
            ...readyQueue, status: "completed",
            retryEligibility: "none", completedCount: 1,
            results: [validatedResult],
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(completedHtml).toContain("Source record");
    expect(completedHtml).toContain(
      "An official record documents the reporting-rule change.",
    );
    expect(completedHtml.indexOf("Source record")).toBeLessThan(
      completedHtml.indexOf("The source documents a reporting requirement."),
    );
    expect(completedHtml).toContain("The source documents a reporting requirement.");
    expect(completedHtml).toContain("Alternative shocks");
    expect(completedHtml).toContain("Why it may matter");
    expect(completedHtml).toContain("What should you check next");
    expect(completedHtml).toContain("Study-specific event assessment — Assessed");
    expect(completedHtml).toContain("1 of 1 events assessed");
    expect(completedHtml).toContain("Provisional relationship:");
    expect(completedHtml).toContain("measurement or sample change");
    expect(completedHtml).toContain(
      "Administrative effort may affect return on assets.");
    expect(completedHtml).toContain("https://www.federalregister.gov/d/2021-12345");
    expect(completedHtml).not.toContain(
      ">Assess relevance to my study</button>");
    const lowRelevanceHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...workspace,
          interpretationQueue: {
            ...readyQueue, status: "completed",
            retryEligibility: "none", completedCount: 1,
            results: [{ ...validatedResult,
              relationshipType: "uncertain",
              outcomePathway:
                "The record does not document a route to the saved outcome.",
            }],
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(lowRelevanceHtml).toContain("1 of 1 events assessed");
    expect(lowRelevanceHtml).toContain(
      "The record does not document a route to the saved outcome.");
    expect(lowRelevanceHtml).not.toContain(
      ">Assess relevance to my study</button>");
    const secondOccurrence = {
      ...occurrence,
      id: "documented-event-2",
      title: "Second documented event",
      candidateFingerprint: "fnv1a64:5555555555555555",
    };
    const partialWorkspace = {
      ...workspace,
      investigation: {
        ...workspace.investigation,
        occurrences: [occurrence, secondOccurrence],
        analyses: [analysis, {
          ...analysis, id: "analysis-event-2",
          eventId: secondOccurrence.id,
          analysisFingerprint: "fnv1a64:6666666666666666",
        }],
        presentation: {
          ...workspace.investigation!.presentation,
          visibleEventIds: [occurrence.id, secondOccurrence.id],
        },
      },
      interpretationQueue: {
        ...readyQueue,
        status: "partial",
        completedCount: 1,
        totalCount: 2,
        results: [validatedResult],
      },
    } as unknown as StudyFirstEventInvestigationWorkspace;
    const partialHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: partialWorkspace,
        onAnalyze,
      },
    ));
    expect(partialHtml).toContain("1 of 2 events assessed");
    expect(partialHtml).toContain("Study-specific event assessment — Partially assessed");
    expect(partialHtml).toContain(
      "The source documents a reporting requirement.");
    expect(partialHtml).toContain("One action completes the remaining assessments");
    expect(partialHtml).toContain(
      "All source-documented shocks remain visible below");
    expect(partialHtml).not.toContain("This action may reserve up to");
    expect(partialHtml).toContain(">Assess relevance to my study</button>");
    expect(partialHtml).not.toContain(">Continue relevance assessment</button>");
    const reclaimedHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...partialWorkspace,
          interpretationQueue: {
            ...partialWorkspace.interpretationQueue!,
            readiness: {
              ...partialWorkspace.interpretationQueue!.readiness,
              nextReservationTokens: 0,
            },
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(reclaimedHtml).toContain(
      "One action completes the remaining assessments");
    expect(reclaimedHtml).not.toContain("reservation");
    expect(reclaimedHtml).not.toContain("tokens are reserved");
    expect(reclaimedHtml).toContain(">Assess relevance to my study</button>");
    const failedHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...workspace,
          interpretationQueue: {
            ...readyQueue, status: "validation_failed",
            retryEligibility: "local_revalidation",
            diagnostic: { taskType: "screen4_event_interpretation",
              stage: "validation", code: "invalid_cited_section",
              dispatchState: "dispatched", receiptSaved: true,
              issuePaths: ["$.event_assessments[0].what_it_is"] },
            error: "Saved response needs a local source-ID recheck.",
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(failedHtml).toContain("Recheck saved event response");
    expect(failedHtml).toContain("Saved response needs a local source-ID recheck.");
    expect(failedHtml).toContain("no new provider request");
    expect(failedHtml).toContain("Documented market reporting rule");
    expect(failedHtml).toContain("Source record");
    expect(failedHtml).toContain("Source documented · assessment pending");
    expect(failedHtml).not.toContain("What is documented");
    expect(failedHtml).toContain(
      "Study-specific event assessment — Saved response needs checking");
    const unknownHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...workspace,
          interpretationQueue: {
            ...readyQueue, status: "outcome_unknown",
            retryEligibility: "observe",
            error: "Dispatch outcome needs reconciliation.",
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(unknownHtml).not.toContain(
      ">Assess relevance to my study</button>");
    expect(unknownHtml).toContain("provider outcome is unknown");
    const unavailableHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace: {
          ...workspace,
          interpretationQueue: {
            ...readyQueue,
            readiness: { ...readyQueue.readiness,
              canDispatch: false,
              blocker: "The local OpenAI model is not configured." },
          },
        } as unknown as StudyFirstEventInvestigationWorkspace,
        onAnalyze,
      },
    ));
    expect(unavailableHtml).toContain(
      "Study-specific event assessment — Local model unavailable");
    expect(unavailableHtml).not.toContain("What is documented");
    const isolatedHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace, onAnalyze, analysisRecoveryBlocked: true,
      },
    ));
    expect(isolatedHtml).toContain(
      "Saved optional analysis needs local recovery");
    expect(isolatedHtml).not.toContain("What is documented");
    expect(isolatedHtml).toMatch(
      /disabled=""[^>]*>Assess relevance to my study<\/button>/u);
    const historicalResult = {
      schemaVersion: "shockaudit-screen04-study-event-assessment-result-v2",
      intelligenceKind: "study_event_assessment",
      origin: "chatgpt-host",
      nonCanonical: true,
      taskInputFingerprint: "fnv1a64:1111111111111111",
      contextFingerprintInspected: "fnv1a64:1111111111111111",
      eventFingerprintInspected: "fnv1a64:1111111111111111",
      sourcePoolFingerprintInspected: "fnv1a64:1111111111111111",
      screeningDisposition: "unresolved",
      relationshipType: "uncertain",
      focalRelation: {
        status: "unresolved", targetInstrument: null, sourceIds: [],
        explanation: "The exact focal relation remains unresolved.",
      },
      documentedChange: "Earlier host summary.",
      relevanceArgument:
        "Earlier host assessment cannot verify firm exposure.",
      comparisonImplication: "The earlier proposed contrast was conditional.",
      argumentLinks: [],
      dimensionalFit: {
        populationOrActivity: "unknown", analysisLevel: "unknown",
        geography: "unknown", industry: "unknown",
        temporalContrast: "unknown", outcomeOrMeasure: "unknown",
        groupDifferential: "unknown",
      },
      timingRole: "An earlier date comparison was proposed.",
      materialLimitations: ["Historical host assessment only."],
      nextChecks: ["Verify the firm-level source rule."],
      sourceIds: ["source-event-1"],
      causalStatus: "conditional_assessment_not_classification",
      scientificMutation: "none", researcherDecision: "none",
      outcomeValuesInspected: false,
      hostModel: "host_model_not_exposed",
    };
    const historicalHtml = renderToStaticMarkup(createElement(
      StudyFirstEventInvestigationPanel, {
        workspace, onAnalyze,
        hostEntries: {
          [`screen04-study-event-assessment:${occurrence.id}`]: {
            coordinates: {
              expectedEventFingerprint: fingerprintSixScreenValue({
                occurrenceFingerprint: occurrence.candidateFingerprint,
                analysisFingerprint: analysis.analysisFingerprint,
              }),
            },
            task: { result: historicalResult },
          },
        } as never,
      },
    ));
    expect(historicalHtml).toContain(
      "earlier signed-host assessment");
    expect(historicalHtml).toContain(
      "Earlier host assessment cannot verify firm exposure.");
    expect(historicalHtml).toContain("Assess relevance to my study");
    expect(historicalHtml).not.toContain("Validated synthesis · read only");
  });

  it("opens study-first Screen 5 with an optional theory and required process form without running a search", () => {
    const onCompare = vi.fn();
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace: {
          schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
          currentInput: null,
          currentRun: null,
          previousCompatibleRun: null,
          revisions: [],
          claimBoundary: "No mechanism search has run.",
        },
        study: confirmedSnapshot().state.study,
        context: null,
        disabled: false,
        hostReasoningMode: "full",
        onCompare,
      },
    ));

    expect(html).toContain("Compare explanations");
    expect(html).toContain(
      "The pathways interpret the saved policy through your selected study construct",
    );
    expect(html).toContain("Theoretical perspective");
    expect(html).toContain("optional");
    expect(html).toContain("Process mechanism to investigate");
    expect(html).toContain("Generate study-specific mechanisms");
    expect(html).toContain("Alternative mechanisms — Not yet generated");
    expect(html).toContain("starts the bounded literature check");
    expect(html).toContain("No mechanism search has run");
    expect(html).not.toContain("Focal process and suggested alternatives");
    expect(onCompare).not.toHaveBeenCalled();
  });

  it("restores an unsaved Screen 5 draft without replacing it with the finalized input", () => {
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace: {
          schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
          currentInput: {
            inputFingerprint: "fnv1a64:2222222222222222",
            revision: 2,
            theoreticalPerspective: "information economics",
            proposedMechanism: "Finalized data-access mechanism.",
          },
          currentRun: null,
          previousCompatibleRun: null,
          revisions: [],
          claimBoundary: "The prior result is stale after a context change.",
        } as unknown as StudyFirstMechanismWorkspace,
        study: confirmedSnapshot().state.study,
        context: null,
        initialDraft: {
          schemaVersion: "screen-05-mechanism-draft-v1",
          runId: "run-ui",
          baseInputFingerprint: "fnv1a64:2222222222222222",
          theoreticalPerspective: "resource dependence",
          proposedMechanism: "Unsaved supplier-response draft.",
        },
        onCompare: vi.fn(),
      },
    ));

    expect(html).toContain('value="resource dependence"');
    expect(html).toContain("Unsaved supplier-response draft.");
    expect(html).not.toContain(">Finalized data-access mechanism.</textarea>");
    expect(html).toContain("Unsaved draft preserved");
    expect(html).toContain("finalized input revision 2");
    expect(html).toContain("Saved focal: “Finalized data-access mechanism.”");
  });

  it("keeps finalized focal wording visible after revised study context without generating alternatives", () => {
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace: {
          schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
          currentInput: {
            inputFingerprint: "fnv1a64:2222222222222222",
            revision: 2,
            theoreticalPerspective: "information economics",
            proposedMechanism: "Finalized data-access mechanism.",
          },
          currentRun: null,
          previousCompatibleRun: null,
          revisions: [],
          claimBoundary: "Earlier analysis is historical.",
        } as unknown as StudyFirstMechanismWorkspace,
        study: confirmedSnapshot().state.study,
        context: null,
        onCompare: vi.fn(),
      },
    ));
    expect(html).toContain("Your finalized focal mechanism");
    expect(html).toContain("Finalized data-access mechanism.");
    expect(html).toContain("Generate for revised study");
    expect(html).toContain("Alternative mechanisms — Not yet generated");
    expect(html).not.toContain("Generate alternative mechanisms");
  });

  it("persists an intentionally cleared Screen 5 draft separately from finalized workflow state", async () => {
    const snapshot = confirmedSnapshot();
    setWidgetState({ privateContent: { sixScreenWorkflow: snapshot } });
    const writes = vi.fn(async (state) => {
      window.openai!.widgetState = state;
    });
    window.openai!.setWidgetState = writes;
    const bridge = new SixScreenBridge();

    await bridge.saveScreen5MechanismDraft({
      schemaVersion: "screen-05-mechanism-draft-v1",
      runId: snapshot.runId,
      baseInputFingerprint: "fnv1a64:2222222222222222",
      theoreticalPerspective: "",
      proposedMechanism: "",
    });

    expect(writes).toHaveBeenCalledTimes(1);
    expect(bridge.getInitialScreen5MechanismDraft(snapshot.runId)).toEqual({
      schemaVersion: "screen-05-mechanism-draft-v1",
      runId: snapshot.runId,
      baseInputFingerprint: "fnv1a64:2222222222222222",
      theoreticalPerspective: "",
      proposedMechanism: "",
    });
    expect(new SixScreenBridge().getInitialScreen5MechanismDraft(
      snapshot.runId,
    )?.proposedMechanism).toBe("");
    expect(window.openai!.widgetState).toMatchObject({
      privateContent: { sixScreenWorkflow: snapshot },
    });
  });

  it("renders a saved direct-provider comparison without any Screen 5 host control", () => {
    const workspace = {
      schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
      currentInput: {
        inputFingerprint: "fnv1a64:2222222222222222",
        revision: 1,
        theoreticalPerspective: null,
        proposedMechanism:
          "Privacy controls increase perceived protection and customer retention.",
      },
      currentRun: {
        id: "screen5-direct-complete",
        runFingerprint: "fnv1a64:3333333333333333",
        context: {
          contextFingerprint: "fnv1a64:1111111111111111",
          policy: {
            officialTitle: "California Consumer Privacy Act",
            episode: "start of requirements",
          },
          timing: { mode: "year", year: 2020, precision: "year" },
          methodSelection: null,
        },
        input: {
          revision: 1,
          inputFingerprint: "fnv1a64:2222222222222222",
          theoreticalPerspective: null,
          proposedMechanism:
            "Privacy controls increase perceived protection and customer retention.",
        },
        inputAssessment: { status: "ready", clarification: null },
        theoreticalProblem: {
          theoreticalChange: { originalText: "Customer protection increases" },
          outcome: { concept: "Firm performance", measure: "Return on assets" },
        },
        planning: {
          status: "completed",
          origin: "groq",
          taskId: null,
          resultId: null,
          providerAttemptId: "direct-plan-1",
          plan: { candidates: [{ id: "candidate-1" }] },
          limitation: "Provisional plan.",
        },
        providerExecution: {
          phase: "completed",
          modelRequested: "openai/gpt-oss-120b",
          comparison: {
            summary:
              "Trust and compliance costs may coexist; intermediate outcomes distinguish them.",
            bibliography: [{ evidenceId: "e1",
              title: "Data Privacy: Effects on Customer and Firm Performance",
              authors: ["Kelly D. Martin"], publicationYear: 2017,
              citationLabel: "Unverified saved label, 1900",
              claimBoundary: "Abstract-level support only.",
              stableLocators: ["https://example.test/work-1"] }],
            mechanisms: [
              {
                id: "mechanism-trust",
                concept: "Customer trust",
                relation: "focal",
                chain: ["Privacy control", "Perceived protection", "Retention"],
                direction: { mechanismResponse: "increase",
                  outcomeImplication: "decrease", basis: "analyst_inference",
                  condition: "Retention costs exceed gains." },
                sourceCheckStatus: "checked_relevant_text",
                argument: [{
                  text: "Transparency and control may reduce perceived vulnerability.",
                  evidenceIds: ["e1"],
                  citations: ["Martin et al., 2017"],
                  supportStatus: "source_linked",
                  basis: "inspected_proposition",
                }],
                fit: "Matches the proposed customer pathway.",
                limit: "The source does not test CCPA effects in this sample.",
                theory: null,
                theoryBasis: "not_assigned",
              },
              {
                id: "mechanism-cost",
                concept: "Perceived-vulnerability response",
                relation: "competing",
                chain: ["Privacy controls", "Perceived vulnerability", "Customer response"],
                argument: [{
                  text: "Privacy controls may reduce perceived customer vulnerability.",
                  evidenceIds: ["e1"],
                  citations: ["Martin, 2017"],
                  supportStatus: "source_linked",
                  basis: "inspected_proposition",
                }],
                fit: "The customer response could precede the firm-year outcome.",
                limit: "The source does not establish the proposed sample transfer.",
                theory: null,
                theoryBasis: "not_assigned",
              },
              {
                id: "mechanism-analogy",
                concept: "Unverified analogy",
                relation: "competing",
                chain: ["Privacy controls", "Generic response", "Firm performance"],
                argument: [{
                  text: "A different setting may have a related response.",
                  evidenceIds: ["e1"],
                  citations: ["Martin, 2017"],
                  supportStatus: "analytical_hypothesis",
                  basis: "study_transfer",
                }],
                fit: "Transfer to this setting has not been established.",
                limit: "No inspected proposition supports this pathway.",
                theory: null,
                theoryBasis: "not_assigned",
              },
            ],
            predictions: [{
              id: "prediction-cost",
              observation: "Privacy-related staffing",
              measure: "Dated privacy hiring records",
              level: "Firm-year",
              timing: "Near adjustment",
              patterns: [
                {
                  mechanismId: "mechanism-trust",
                  detail: "No unique increase is required.",
                },
                {
                  mechanismId: "mechanism-cost",
                  detail: "Staffing should increase if costs operate.",
                },
                {
                  mechanismId: "mechanism-analogy",
                  detail: "The analogy does not establish a distinct prediction.",
                },
              ],
              caution: "Other staffing changes may share this pattern.",
            }],
            gaps: ["Direct sample-specific evidence remains absent."],
          },
          budgetSnapshot: {
            attemptsReserved: 2,
            maximumAttempts: 12,
            tokensCommitted: 4_600,
            maximumTokens: 100_000,
          },
        },
        works: [{
          id: "work-1",
          title: "Data Privacy: Effects on Customer and Firm Performance",
          authors: ["Kelly D. Martin"],
          publicationYear: 2017,
          publicationVenue: "Journal of Marketing",
          stableLocators: ["https://example.test/work-1"],
          versionCaveat: null,
          updateOrRetraction: {
            retractedFlag: "not_checked",
            updateRelations: [],
          },
          access: {
            level: "abstract_inspected",
            abstractText: "Transparency and control may reduce vulnerability.",
            abstractSource: "crossref_member_deposit",
            reportedOpenLocations: [],
          },
          claimBoundary: "Abstract-level support only.",
        }],
        attempts: [],
        phases: {
          retrieval: "complete",
          textInspection: "complete",
          screening: "complete",
          synthesis: "complete",
          validation: "complete",
          presentation: "complete",
        },
        status: "scholarly_evidence_ready",
        hostComparison: { limitation: "No host task was used." },
      },
      previousCompatibleRun: null,
      revisions: [],
      claimBoundary: "Conditional synthesis only.",
    } as unknown as StudyFirstMechanismWorkspace;
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace,
        study: confirmedSnapshot().state.study,
        context: null,
        hostReasoningMode: "disabled",
        onCompare: vi.fn(),
      },
    ));

    expect(html).toContain("Competing and complementary mechanisms");
    expect(html).toContain("Your finalized focal mechanism");
    expect(html).toContain("Source-supported alternative mechanisms (1)");
    expect(html).toContain("Customer trust");
    expect(html).toContain("Perceived-vulnerability response");
    expect(html).toContain("Martin, 2017");
    expect(html).toContain("(Martin, 2017)");
    expect(html).toContain("Relevant scholarly support:");
    expect(html).toContain("Kelly D. Martin");
    expect(html).toContain("Journal of Marketing");
    expect(html).toContain("Literature and source access (1)");
    expect(html).not.toContain("Unverified saved label, 1900");
    expect(html).toContain("Firm performance (Return on assets) may decrease");
    expect(html).toContain("Firm performance · Return on assets");
    expect(html).toContain("Evidence checked · Linked proposition only");
    expect(html).toContain("full policy-to-outcome pathway has not been tested");
    expect(html).toContain("Access/claim limit: Abstract-level support only.");
    expect(html).not.toContain("No inspected scholarly source is attached");
    expect(html).toContain("Compare observable predictions");
    expect(html).toContain("Privacy-related staffing");
    expect(html).toContain('data-label="Customer trust"');
    expect(html).toContain(
      'data-label="Perceived-vulnerability response"',
    );
    expect(html).toContain("Hypotheses withheld from source-supported cards (1)");
    expect(html).not.toContain("<h4>Unverified analogy</h4>");
    expect(html).not.toContain('data-label="Unverified analogy"');
    expect(html).toContain('data-label="Measurement boundary"');
    expect(html).not.toContain("Start or resume Stage A");
    expect(html).not.toContain("signed host");
  });

  it("shows saved Stage A hypotheses while keeping source support pending", () => {
    const focal =
      "Reduced customer-data access changes customer acquisition and firm performance.";
    const workspace = {
      schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
      currentInput: {
        inputFingerprint: "fnv1a64:2222222222222222",
        revision: 1,
        theoreticalPerspective: null,
        proposedMechanism: focal,
      },
      currentRun: {
        id: "screen5-stage-a-only",
        runFingerprint: "fnv1a64:3333333333333333",
        context: {
          contextFingerprint: "fnv1a64:1111111111111111",
          policy: {
            officialTitle: "California Consumer Privacy Act",
            episode: "start of requirements",
          },
          timing: { mode: "year", year: 2020, precision: "year" },
          methodSelection: null,
        },
        input: {
          revision: 1,
          inputFingerprint: "fnv1a64:2222222222222222",
          theoreticalPerspective: null,
          proposedMechanism: focal,
        },
        inputAssessment: { status: "ready", clarification: null },
        theoreticalProblem: {
          theoreticalChange: {
            originalText: "Customer protection increases",
          },
          outcome: { concept: "Firm performance", measure: "Return on assets" },
        },
        planning: {
          status: "completed",
          origin: "groq",
          taskId: null,
          resultId: null,
          providerAttemptId: "direct-plan-stage-a",
          plan: {
            candidates: [{
              id: "cost-adjustment",
              conceptLabel: "Compliance-resource adjustment",
              actor: "Firm",
              processNodes: [
                "New privacy duties",
                "Staff and systems effort",
                "Operating cost",
                "Firm performance",
              ],
              condition: "Implementation effort is economically material.",
              contextualConditions: [],
              distinctionFromFocal:
                "Unlike M0, this process changes internal resources without requiring acquisition effects.",
              perspective: null,
              perspectiveOrigin: "not_assigned",
              relationToFocal: "unresolved",
              hypothesisStatus: "provisional",
            }],
          },
          limitation: "Provisional mechanisms require source checking.",
        },
        providerExecution: {
          phase: "plan_ready",
          modelRequested: "openai/gpt-oss-120b",
          comparison: null,
          attempts: [],
          budgetSnapshot: null,
        },
        works: [],
        attempts: [],
        phases: {
          retrieval: "not_started",
          textInspection: "not_started",
          screening: "not_started",
          synthesis: "pending",
          validation: "pending",
          presentation: "partial",
        },
        status: "planning_ready",
        hostComparison: { limitation: "No host task was used." },
      },
      previousCompatibleRun: null,
      revisions: [],
      claimBoundary: "Provisional only.",
    } as unknown as StudyFirstMechanismWorkspace;
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace,
        study: confirmedSnapshot().state.study,
        context: null,
        hostReasoningMode: "disabled",
        onCompare: vi.fn(),
      },
    ));

    expect(html).toContain("Evidence check pending");
    expect(html).toContain("Alternative mechanisms generated");
    expect(html).toContain("Researcher-proposed process");
    expect(html).toContain(focal);
    expect(html).toContain("Compliance-resource adjustment");
    expect(html).toContain("Generated alternative mechanisms (1)");
    expect(html).toContain("Generated hypothesis · evidence check pending");
    expect(html).toContain(
      "No ChatGPT-suggested citation is stored for this earlier run",
    );
    expect(html).toContain("Literature and source access (0)");
    expect(html).not.toContain("Comparison stopped");
    expect(html).not.toContain("provider schema invalid");
    expect(html).not.toContain("Directions describe proposed pathways");
    expect(html).not.toContain("Breadth review");
    expect(html).not.toContain("Execution and accounting details");
    expect(html).not.toContain("Search coverage and remaining gaps");

    const authorizedHtml = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace: {
          ...workspace,
          executionReadiness: {
            schemaVersion: "screen-05-execution-readiness-v2",
            selectedBackend: "openai",
            provider: "openai",
            model: "gpt-6-luna",
            route: "direct",
            configuration: "ready",
            missingSettings: [],
            keyPresent: true,
            credentialStatus: "last_success",
            ledgerState: "valid",
            allowance: null,
            authorization: "not_applicable",
            authorizedStages: ["planning", "assessment"],
            activeOrigin: "openai",
            activeExecutionId: "screen5-stage-a-only-job",
            migration: "prepared",
            canEnsure: false,
            canAdvanceWithoutInference: true,
            canDispatch: false,
            serverObservedAt: null,
            nextAction: "resume_direct_job",
          },
        } as unknown as StudyFirstMechanismWorkspace,
        study: confirmedSnapshot().state.study,
        context: null,
        hostReasoningMode: "disabled",
        onCompare: vi.fn(),
        onAdvanceProvider: vi.fn(),
      },
    ));
    expect(authorizedHtml).toContain(
      "Finishing the requested mechanism and literature checks",
    );
    expect(authorizedHtml).not.toContain(">Check supporting literature</button>");
    expect(authorizedHtml).not.toContain(">Continue evidence checks</button>");
  });

  it("offers in-tool authorization for the current revised mechanism job", () => {
    const workspace = {
      schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
      currentInput: {
        inputFingerprint: "fnv1a64:2222222222222222",
        revision: 2,
        theoreticalPerspective: "information economics",
        proposedMechanism:
          "Reduced customer-data access changes acquisition costs.",
      },
      currentRun: {
        id: "screen5-revised-input-run",
        runFingerprint: "fnv1a64:3333333333333333",
        context: {
          contextFingerprint: "fnv1a64:1111111111111111",
          policy: {
            officialTitle: "California Consumer Privacy Act",
            episode: "start of requirements",
          },
          timing: { mode: "year", year: 2020, precision: "year" },
          methodSelection: null,
        },
        input: {
          inputFingerprint: "fnv1a64:2222222222222222",
          revision: 2,
          theoreticalPerspective: "information economics",
          proposedMechanism:
            "Reduced customer-data access changes acquisition costs.",
        },
        inputAssessment: { status: "ready", clarification: null },
        theoreticalProblem: {
          theoreticalChange: {
            originalText: "Customer data access decreases",
          },
        },
        planning: {
          status: "available_via_direct_provider",
          origin: "openai",
          taskId: null,
          resultId: null,
          providerAttemptId: null,
          plan: null,
          limitation: "Planning has not started.",
        },
        providerExecution: {
          id: "screen5-openai-job-revised-input",
          provider: "openai",
          phase: "planning_queued",
          attempts: [{
            id: "screen5-openai-attempt-1",
            stage: "planning",
            ordinal: 1,
            status: "succeeded",
            reservedTokens: 14_000,
            estimatedInputTokens: 2_000,
            maxCompletionTokens: 12_000,
            startedAt: "2026-09-23T12:00:00.000Z",
            completedAt: "2026-09-23T12:00:01.234Z",
            providerRequestId: "req_screen5_openai_test",
            providerResponseId: "resp_screen5_openai_test",
            serviceTier: "default",
            latencyMs: 1_234,
            modelRequested: "gpt-6-luna",
            modelObserved: "gpt-6-luna-2026-09-01",
            finishReason: "completed",
            usage: {
              promptTokens: 1_000,
              cachedPromptTokens: 200,
              completionTokens: 700,
              reasoningTokens: 300,
              totalTokens: 1_700,
            },
          }],
          comparison: null,
          modelRequested: "gpt-6-luna",
          settings: {
            reasoningEffort: "medium",
            includeReasoning: false,
            stream: false,
            serviceTier: "default",
            store: false,
          },
          budgetSnapshot: {
            attemptsReserved: 1,
            maximumAttempts: 12,
            tokensCommitted: 14_000,
            maximumTokens: 200_000,
          },
          lastError: null,
          retryCount: 0,
          nextEligibleAt: null,
        },
        status: "planning_ready",
        works: [],
        attempts: [],
        phases: {
          retrieval: "not_started",
          textInspection: "not_started",
          screening: "not_started",
          synthesis: "pending",
          validation: "pending",
          presentation: "partial",
        },
        hostComparison: {
          status: "not_started",
          limitation: "The direct comparison has not started.",
        },
      },
      previousCompatibleRun: null,
      executionReadiness: {
        schemaVersion: "screen-05-execution-readiness-v1",
        selectedBackend: "openai",
        provider: "openai",
        model: "gpt-6-luna",
        route: "direct",
        configuration: "ready",
        missingSettings: [],
        keyPresent: true,
        credentialStatus: "not_tested",
        ledgerState: "valid",
        allowance: {
          maximumAttempts: 12,
          maximumTokens: 200_000,
          conservativePriorAttempts: 0,
          conservativePriorTokens: 0,
          localAttemptsReserved: 0,
          localObservedTokens: 1_700,
          localHeldTokens: 0,
          remainingAttempts: 11,
          remainingTokens: 198_300,
        },
        authorization: "required",
        authorizedStages: [],
        activeOrigin: "openai",
        activeExecutionId: "screen5-openai-job-revised-input",
        migration: "prepared",
        canEnsure: false,
        canAdvanceWithoutInference: false,
        canDispatch: false,
        nextAction: "request_execution_authorization",
      },
      revisions: [],
      claimBoundary: "The comparison remains conditional.",
    } as unknown as StudyFirstMechanismWorkspace;
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace,
        study: confirmedSnapshot().state.study,
        context: null,
        hostReasoningMode: "disabled",
        onCompare: vi.fn(),
        onAdvanceProvider: vi.fn(),
      },
    ));

    expect(html).toContain("Ready for confirmation");
    expect(html).toContain("no PowerShell ID is needed");
    expect(html).toContain("Generate alternative mechanisms");
    expect(html).toContain('class="six-screen5-execution-primary"');
    expect(html).not.toContain("Execution and accounting details");
    expect(html).not.toContain("provider: OpenAI");
    expect(html).not.toContain("model: gpt-6-luna");
    expect(html).not.toContain("1,000 input tokens (200 cached)");
    expect(html).not.toContain("no PowerShell command is needed");
    expect(html).not.toContain("Resume saved direct comparison");
  });

  it("keeps a pending historical Stage A task read-only without restoring the retired host route", () => {
    const runFingerprint = "fnv1a64:3333333333333333";
    const workspace = {
      schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
      currentInput: {
        inputFingerprint: "fnv1a64:2222222222222222",
        revision: 1,
        theoreticalPerspective: null,
        proposedMechanism:
          "It reduces access to customer information and understanding.",
      },
      currentRun: {
        id: "screen5-pending-plan",
        runFingerprint,
        context: {
          contextFingerprint: "fnv1a64:1111111111111111",
          policy: { officialTitle: "California Consumer Privacy Act" },
        },
        input: {
          revision: 1,
          inputFingerprint: "fnv1a64:2222222222222222",
          theoreticalPerspective: null,
          proposedMechanism:
            "It reduces access to customer information and understanding.",
        },
        inputAssessment: { status: "ready", clarification: null },
        planning: {
          status: "available_via_signed_host_task",
          taskId: null,
          resultId: null,
          plan: null,
          limitation: "Stage A must finish before retrieval.",
        },
        status: "planning_ready",
        works: [],
        attempts: [],
        phases: {
          retrieval: "not_started",
          textInspection: "not_started",
          screening: "not_started",
          synthesis: "pending",
          validation: "pending",
          presentation: "partial",
        },
        hostComparison: {
          status: "planning_required",
          taskId: null,
          limitation: "Evidence synthesis waits for Stage A.",
        },
      },
      previousCompatibleRun: null,
      revisions: [],
      claimBoundary: "The host result remains conditional.",
    } as never;
    const planningHostEntry = {
      coordinates: {
        selectedEventId: "screen5-pending-plan",
        expectedEventFingerprint: runFingerprint,
      },
      task: {
        status: "awaiting-submission",
        result: null,
      },
    } as never;
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace,
        study: confirmedSnapshot().state.study,
        context: null,
        hostReasoningMode: "full",
        planningHostEntry,
        planningHostNotice:
          "The signed task is still awaiting submission.",
        onCompare: vi.fn(),
      },
    ));

    expect(html).toContain("Generation unavailable");
    expect(html).toContain(
      "will not prepare, deliver, restore, or poll a signed host task",
    );
    expect(html).toContain("Copy safe diagnostic summary");
    expect(html).toContain("The signed task is still awaiting submission.");
    expect(html).toContain("not started");
    expect(html).not.toContain("Stage A · awaiting submission");
    expect(html).not.toContain("Check saved task now");
    expect(html).not.toContain("Retrieval did not complete");
  });

  it("renders source-level evidence but ignores historical host synthesis on the OpenAI-only route", () => {
    const fingerprint = (digit: string) => `fnv1a64:${digit.repeat(16)}`;
    const context = {
      policy: { officialTitle: "California Consumer Privacy Act" },
      contextFingerprint: fingerprint("1"),
    };
    const workspace = {
      schemaVersion: "screen-05-study-first-mechanism-workspace-v1",
      currentInput: {
        inputFingerprint: fingerprint("2"),
        revision: 1,
        theoreticalPerspective: null,
        proposedMechanism:
          "Firms improve privacy controls, which may increase customer trust.",
      },
      currentRun: {
        id: "screen5-run-ui",
        runFingerprint: fingerprint("3"),
        context,
        input: {
          inputFingerprint: fingerprint("2"),
          revision: 1,
          theoreticalPerspective: null,
          proposedMechanism:
            "Firms improve privacy controls, which may increase customer trust.",
        },
        inputAssessment: { status: "ready", clarification: null },
        status: "scholarly_evidence_ready",
        works: [{
          id: "work-trust",
          title: "Privacy governance and customer response",
          authors: ["Ada Researcher"],
          publicationYear: 2024,
          publicationVenue: "Journal of Organizational Response",
          stableLocators: ["https://doi.org/10.1234/example"],
          versionCaveat: "Only the deposited abstract was inspected.",
          updateOrRetraction: {
            retractedFlag: "not_checked",
            updateRelations: [],
          },
          access: {
            level: "abstract_inspected",
            abstractText:
              "Privacy controls may increase customer trust.",
            abstractSource: "crossref_member_deposit",
            reportedOpenLocations: [],
          },
          claimBoundary:
            "Only this abstract was inspected; no firm-performance effect was established.",
        }],
        attempts: [{
          provider: "crossref",
          query: "privacy customer trust",
          status: "completed",
          recordsReceived: 1,
          abstractsInspected: 1,
          failureReason: null,
        }],
        hostComparison: {
          status: "available_via_signed_host_task",
          limitation: "Conditional synthesis only.",
        },
      },
      previousCompatibleRun: null,
      revisions: [],
      claimBoundary:
        "Researcher input, provider evidence, and host synthesis remain separate.",
    } as unknown as StudyFirstMechanismWorkspace;
    const result = {
      schemaVersion: "shockaudit-screen05-study-mechanism-comparison-result-v2",
      intelligenceKind: "study_mechanism_comparison",
      origin: "chatgpt-host",
      nonCanonical: true,
      taskInputFingerprint: fingerprint("4"),
      contextFingerprintInspected: fingerprint("1"),
      mechanismRunFingerprintInspected: fingerprint("3"),
      sourcePoolFingerprintInspected: fingerprint("5"),
      focal: {
        id: "mechanism-focal",
        conceptLabel: "Customer trust pathway",
        perspective: null,
        perspectiveOrigin: "not_assigned",
        processChain: [
          "Privacy controls become more credible",
          "Customer trust may rise",
          "Retention may change",
        ],
        connectedArgument:
          "More credible privacy controls may raise trust and retention, which could reach firm performance under a defensible aggregation link.",
        fitToStudy:
          "This could reach firm performance only if customer responses aggregate to the firm-year outcome.",
        evidenceStatus: "source_linked",
        propositions: [{
          workId: "work-trust",
          supportedStatement:
            "Privacy controls may increase customer trust.",
          sourceRole: "theoretical",
          transferLimit:
            "The abstract does not study public manufacturers.",
        }],
        materialTransferLimit:
          "The abstract does not establish a CCPA effect in public manufacturers.",
        relationToFocal: "focal",
      },
      alternatives: [{
        id: "mechanism-cost",
        conceptLabel: "Compliance-cost pathway",
        perspective: null,
        perspectiveOrigin: "analyst_suggested",
        processChain: [
          "New obligations require organizational effort",
          "Operating costs may rise",
        ],
        connectedArgument:
          "Organizational effort may raise operating costs and affect performance without a customer-trust response.",
        fitToStudy:
          "A firm-year cost channel could affect the same performance outcome.",
        evidenceStatus: "analytical_hypothesis",
        propositions: [],
        materialTransferLimit:
          "No cost measure or effect estimate was inspected.",
        relationToFocal: "competing_same_pattern",
      }],
      predictionMatrix: [{
        id: "prediction-retention",
        observationConcept: "Customer trust and retention",
        candidateMeasure: "Validated customer trust or retention measure",
        dataSource: null,
        timing: "After credible privacy-control changes",
        level: "Customer linked to firm",
        aggregationRequirement: "Aggregate linked customer responses to firm-year",
        conditions: "Requires a defensible aggregation link",
        feasibility: "unknown",
        distinction: "distinguishing",
        propositionWorkIds: ["work-trust"],
        patterns: [{
          mechanismId: "mechanism-focal",
          expectedPattern: "Trust could improve before firm performance.",
        }, {
          mechanismId: "mechanism-cost",
          expectedPattern: "No unique trust prediction.",
        }],
      }],
      overallQualification:
        "A total-effect design alone would not identify either mechanism.",
      evidenceLimitations: [
        "Only one abstract was inspected; feasibility remains unknown.",
      ],
      causalStatus: "conditional_comparison_not_mediation_estimate",
      scientificMutation: "none",
      researcherDecision: "none",
      outcomeValuesInspected: false,
      hostModel: "host_model_not_exposed",
    };
    const hostEntry = {
      coordinates: {
        selectedEventId: "screen5-run-ui",
        expectedEventFingerprint: fingerprint("3"),
      },
      task: { result, status: "applied" },
    } as never;
    const before = fingerprintSixScreenValue(workspace);
    const html = renderToStaticMarkup(createElement(
      StudyFirstMechanismPanel,
      {
        workspace,
        study: confirmedSnapshot().state.study,
        context: context as never,
        hostReasoningMode: "full",
        hostEntry,
        onCompare: vi.fn(),
      },
    ));

    expect(html).toContain("Privacy governance and customer response");
    expect(html).toContain("Abstract inspected");
    expect(html).toContain("Generation unavailable");
    expect(html).toContain("Literature and source access (1)");
    expect(html).toContain(
      "The stored signed-host result did not match the current evidence binding and was not rendered.",
    );
    expect(html).not.toContain("Customer trust pathway");
    expect(html).not.toContain("Compliance-cost pathway");
    expect(html).not.toContain("Compare observable predictions");
    expect(html).not.toContain("No unique trust prediction");
    expect(html).not.toContain("Check saved task now");
    expect(html).not.toMatch(/Retain|Reject|Approve all/iu);
    expect(fingerprintSixScreenValue(workspace)).toBe(before);
  });

  it("renders structured navigation blockers as readable messages", () => {
    const summary = prerequisiteBlockerMessages([{
      message:
        "Lock a researcher-reviewed Event Card for the current policy in Screen 2.",
    }]);
    expect(summary).toBe(
      "Lock a researcher-reviewed Event Card for the current policy in Screen 2.",
    );
    expect(summary).not.toContain("[object Object]");
  });

  it("restores exact source-linked timing claims without collapsing legal effect into implementation", () => {
    setWidgetState({
      privateContent: { sixScreenWorkflow: confirmedSnapshot(true) },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Timing is not one date");
    expect(html).toContain("Legal effect and the later implementation schedule");
    expect(html).toContain("a further 365 days");
    expect(html).toContain("not the rule&#x27;s legal-effective date");
    expect(html).toContain("Compliance and implementation schedule");
    expect(html).toContain("https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html");
    expect(html).toContain("Saved evidence plan");
    expect(html).toContain("Published rule and timing");
    expect(html).toContain("Formal coverage and exemptions");
    expect(html).toContain("Prior baseline and historical versions");
    expect(html).toContain("Automatic standard plan");
    expect(html).not.toContain("Research unresolved questions more deeply");
    expect(html).toContain("Reading status never spends budget");
    expect(html).toContain("document attempts charged");
  });

  it("renders the substantive policy briefing before secondary evidence diagnostics", () => {
    setWidgetState({
      privateContent: { sixScreenWorkflow: contentFirstPolicySnapshot() },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    const briefing = html.indexOf("Source-linked policy briefing");
    const diagnostics = html.indexOf(
      "Sources, exact passages, and research activity",
    );

    expect(briefing).toBeGreaterThan(-1);
    expect(diagnostics).toBeGreaterThan(briefing);
    expect(html).toContain("Policy episode overview");
    expect(html).toContain("official explanatory material");
    expect(html).toContain("Federal Energy Regulatory Commission");
    expect(html).toContain("2018-03-06");
    expect(html).toContain("Official abstract for FR Doc. 2018-03708");
    expect(html).toContain("Distinct legal stages");
    expect(html).toContain("legal effect");
    expect(html).toContain("What changed");
    expect(html).toContain("Who is formally covered");
    expect(html).toContain("Implementation and enforcement");
    expect(html).toContain("aria-label=\"Evidence 1:");
    expect(html).toContain("Open Order 841");
    expect(html).toContain(
      "Each RTO and ISO must establish a participation model",
    );
    expect(html).toContain(
      "The rule applies to each RTO and ISO operating an organized wholesale electric market",
    );
    expect(html).toContain("More evidence needed");
    expect(html).toContain("Inspect exact passage and source");
    expect(html).not.toContain("Research unresolved questions more deeply");
    expect(html).not.toContain("Gate receipt persisted");
    expect(html).not.toContain("No coherent policy overview");
    expect(html).not.toContain(
      "Explanatory material is context only. Formal coverage",
    );
    expect(html).toContain("Screen 2 → Screen 3");
    expect(html).toContain("Continue to comparison guidance");
    expect(html).not.toContain("Review and continue");
  });

  it("does not let an older canonical response replace a newer selection", () => {
    const current = confirmedSnapshot(true);
    const older = structuredClone(current);
    older.revision -= 1;
    older.state.revision -= 1;
    older.stateFingerprint = fingerprintSixScreenValue(older.state);

    expect(workflowSnapshotResponseDisposition(current, older)).toBe(
      "obsolete",
    );

    const wrongAuthorization = structuredClone(current);
    wrongAuthorization.accessToken = `sa6a_${"b".repeat(43)}`;
    expect(() =>
      workflowSnapshotResponseDisposition(current, wrongAuthorization)
    ).toThrow("changed its authorization binding");
  });

  it("retries a Screen 3 handoff only across unrelated canonical progress", () => {
    const submitted = confirmedSnapshot(true);
    const policyProgress = structuredClone(submitted);
    policyProgress.revision += 1;
    policyProgress.state.revision += 1;
    policyProgress.stateFingerprint = fingerprintSixScreenValue(
      policyProgress.state,
    );

    expect(screen3SubmissionBaseMatches(submitted, policyProgress)).toBe(true);

    const laterConfirmation = structuredClone(policyProgress);
    laterConfirmation.state.identityRevision += 1;
    laterConfirmation.stateFingerprint = fingerprintSixScreenValue(
      laterConfirmation.state,
    );
    expect(screen3SubmissionBaseMatches(submitted, laterConfirmation)).toBe(
      false,
    );

    const concurrentStudyEdit = structuredClone(policyProgress);
    concurrentStudyEdit.state.study.revision += 1;
    concurrentStudyEdit.state.study.outcome = "Employment";
    concurrentStudyEdit.stateFingerprint = fingerprintSixScreenValue(
      concurrentStudyEdit.state,
    );

    expect(screen3SubmissionBaseMatches(submitted, concurrentStudyEdit)).toBe(
      false,
    );
  });

  it("blocks a guarded Screen 3 rebase after clarification-only guidance changes", () => {
    const base = confirmedSnapshot(true);
    const study = {
      ...base.state.study,
      policySideConcept: "market access rules",
      initialExplanation:
        "Expanded access may change operator operating margins.",
      proposedTreatment: "operators after 2020",
      proposedComparison: "operators before 2020",
    };
    const opened = openScreen3(base.state, {
      expectedRevision: base.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      openedAt: "2026-09-25T20:00:00.000Z",
    }).state;
    const submitted = {
      ...base,
      revision: opened.revision,
      state: opened,
      stateFingerprint: fingerprintSixScreenValue(opened),
    };
    const refined = refineStudyDesignAdvice(opened, {
      expectedRevision: opened.revision,
      clarifications: {
        ...EMPTY_STUDY_DESIGN_CLARIFICATIONS,
        moderator: "baseline storage penetration",
        moderatorTime: "baseline",
      },
      refinedAt: "2026-09-25T20:01:00.000Z",
    }).state;
    const concurrent = {
      ...submitted,
      revision: refined.revision,
      state: refined,
      stateFingerprint: fingerprintSixScreenValue(refined),
    };
    const payload = {
      study,
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
    };

    expect(screen3SubmissionBaseMatches(submitted, concurrent)).toBe(false);
    expect(screen3HandoffOperationCoordinates(submitted, payload).operationId)
      .not.toBe(
        screen3HandoffOperationCoordinates(concurrent, payload).operationId,
      );
  });

  it("blocks a guarded Screen 3 rebase after a researcher method choice", () => {
    const base = confirmedSnapshot(true);
    const study = {
      ...base.state.study,
      policySideConcept: "market access rules",
      initialExplanation: "Expanded access may change operating margins.",
      proposedTreatment: "operators after 2020",
      proposedComparison: "operators before 2020",
    };
    const opened = openScreen3(base.state, {
      expectedRevision: base.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
      openedAt: "2026-09-25T20:00:00.000Z",
    }).state;
    const submitted = {
      ...base,
      revision: opened.revision,
      state: opened,
      stateFingerprint: fingerprintSixScreenValue(opened),
    };
    const advice = opened.studyDesignAdvices!.at(-1)!;
    const decided = decideStudyDesignAdvice(opened, {
      expectedRevision: opened.revision,
      adviceId: advice.adviceId,
      expectedAdviceFingerprint: advice.adviceFingerprint,
      decision: { mode: "no_selection" },
      rationale: "Keep the method undecided pending diagnostics.",
      selectedAt: "2026-09-25T20:01:00.000Z",
    }).state;
    const concurrent = {
      ...submitted,
      revision: decided.revision,
      state: decided,
      stateFingerprint: fingerprintSixScreenValue(decided),
    };
    const payload = {
      study,
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
      clarifications: EMPTY_STUDY_DESIGN_CLARIFICATIONS,
    };

    expect(screen3SubmissionBaseMatches(submitted, concurrent)).toBe(false);
    expect(screen3HandoffOperationCoordinates(submitted, payload).operationId)
      .not.toBe(
        screen3HandoffOperationCoordinates(concurrent, payload).operationId,
      );
  });

  it("restores an RD draft only from advice bound to the current Screen 3 entry", () => {
    const base = confirmedSnapshot(true);
    const study = {
      ...base.state.study,
      policySideConcept: "market access rules",
      initialExplanation: "Eligibility changes access to wholesale markets.",
      proposedTreatment: "operators meeting the cutoff",
      proposedComparison: "operators below the cutoff",
    };
    const priorRd = {
      runningVariable: "installed storage capacity",
      cutoff: "100",
      operator: ">=" as const,
      assignmentRule: "Operators at or above 100 MW are eligible.",
      treatmentTarget: "eligibility" as const,
      assignmentRelation: "sharp" as const,
      verification: "researcher_reported" as const,
      otherConditions: null,
      bindingStatus: "binding" as const,
      probabilityJump: "researcher_reported" as const,
    };
    const currentRd = {
      ...priorRd,
      cutoff: "150",
      assignmentRule: "Operators at or above 150 MW are eligible.",
    };
    const opened = openScreen3(base.state, {
      expectedRevision: base.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: { rd: priorRd },
      openedAt: "2026-09-25T20:00:00.000Z",
    });
    const refined = refineStudyDesignAdvice(opened.state, {
      expectedRevision: opened.state.revision,
      clarifications: { rd: currentRd },
      refinedAt: "2026-09-25T20:01:00.000Z",
    });
    const current = {
      ...base,
      revision: refined.state.revision,
      state: refined.state,
      stateFingerprint: fingerprintSixScreenValue(refined.state),
    };
    expect(screen3RdRuleDraftFromSnapshot(current)).toEqual(currentRd);

    const latestAdviceMissing = structuredClone(current);
    latestAdviceMissing.state.studyDesignAdvices =
      latestAdviceMissing.state.studyDesignAdvices?.filter(
        ({ adviceId }) => adviceId !== refined.advice.adviceId,
      );
    latestAdviceMissing.stateFingerprint = fingerprintSixScreenValue(
      latestAdviceMissing.state,
    );
    expect(screen3RdRuleDraftFromSnapshot(latestAdviceMissing)).toBeNull();

    const changedStudy = structuredClone(current);
    changedStudy.state.study.revision += 1;
    changedStudy.state.study.outcome = "Employment";
    changedStudy.stateFingerprint = fingerprintSixScreenValue(
      changedStudy.state,
    );
    expect(screen3RdRuleDraftFromSnapshot(changedStudy)).toBeNull();
  });

  it("preserves one unambiguous legacy RD draft without entry history", () => {
    const base = confirmedSnapshot(true);
    const study = {
      ...base.state.study,
      policySideConcept: "market access rules",
      initialExplanation: "Eligibility changes access to wholesale markets.",
      proposedTreatment: "operators meeting the cutoff",
      proposedComparison: "operators below the cutoff",
    };
    const rd = {
      runningVariable: "installed storage capacity",
      cutoff: "100",
      operator: ">=" as const,
      assignmentRule: "Operators at or above 100 MW are eligible.",
      treatmentTarget: "eligibility" as const,
      assignmentRelation: "sharp" as const,
      verification: "researcher_reported" as const,
      otherConditions: null,
      bindingStatus: "binding" as const,
      probabilityJump: "researcher_reported" as const,
    };
    const opened = openScreen3(base.state, {
      expectedRevision: base.state.revision,
      study,
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: { rd },
      openedAt: "2026-09-25T20:00:00.000Z",
    });
    const legacy = {
      ...base,
      revision: opened.state.revision,
      state: structuredClone(opened.state),
      stateFingerprint: fingerprintSixScreenValue(opened.state),
    };
    legacy.state.screen3StudyEntryContexts = [];
    expect(screen3RdRuleDraftFromSnapshot(legacy)).toEqual(rd);

    legacy.state.studyDesignAdvices!.push(structuredClone(
      legacy.state.studyDesignAdvices![0]!,
    ));
    expect(screen3RdRuleDraftFromSnapshot(legacy)).toBeNull();
  });

  it("uses stable Screen 3 operation coordinates across remounts and operational progress", () => {
    const submitted = confirmedSnapshot(true);
    const payload = {
      study: submitted.state.study,
      proposedTiming: {
        mode: "year" as const,
        year: 2020,
        milestoneReference: null,
      },
      clarifications: { rd: null },
    };
    const first = screen3HandoffOperationCoordinates(submitted, payload);
    expect(screen3HandoffOperationCoordinates(
      structuredClone(submitted),
      structuredClone(payload),
    )).toEqual(first);

    const operationalProgress = structuredClone(submitted);
    operationalProgress.revision += 1;
    operationalProgress.state.revision += 1;
    operationalProgress.stateFingerprint = fingerprintSixScreenValue(
      operationalProgress.state,
    );
    expect(screen3HandoffOperationCoordinates(
      operationalProgress,
      payload,
    )).toEqual(first);

    expect(screen3HandoffOperationCoordinates(submitted, {
      ...payload,
      proposedTiming: { ...payload.proposedTiming, year: 2021 },
    }).operationId).not.toBe(first.operationId);

    const changedEvidence = structuredClone(submitted);
    changedEvidence.state.policyReview!.claims[0]!.statement +=
      " Materially revised.";
    expect(screen3HandoffOperationCoordinates(
      changedEvidence,
      payload,
    ).operationId).not.toBe(first.operationId);
  });

  it("maps exact operation status without treating history or invalid display as current", () => {
    const base = {
      lookup: "committed",
      destination: {
        screen: 3,
        state: "current",
        displayReady: true,
        localRebuildAvailable: false,
        safeCode: "screen3_guidance_current",
      },
    } as Parameters<typeof screen3OperationStatusDisposition>[0];
    expect(screen3OperationStatusDisposition(base)).toBe("restore_current");
    expect(screen3OperationStatusDisposition({
      ...base,
      lookup: "unknown_or_expired",
    })).toBe("outcome_unknown");
    expect(screen3OperationStatusDisposition({
      ...base,
      lookup: "conflict",
    })).toBe("operation_conflict");
    expect(screen3OperationStatusDisposition({
      ...base,
      destination: {
        ...base.destination,
        state: "historical",
        displayReady: false,
      },
    })).toBe("saved_historical");
    expect(screen3OperationStatusDisposition({
      ...base,
      destination: {
        ...base.destination,
        state: "locally_recoverable",
        displayReady: false,
        localRebuildAvailable: true,
      },
    })).toBe("local_rebuild_required");
  });

  it("makes unchanged invalid local rebuild input terminal instead of looping", () => {
    const invalidBinding = createSixScreenWorkflowProblem({
      code: "core_state_invalid",
      action: "rebuild_screen3_guidance",
      operationId: "screen3-rebuild-invalid-binding",
      screen: 3,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      safeCauseCodes: ["screen3_rebuild_binding_invalid"],
    });
    expect(isTerminalScreen3RebuildProblem(invalidBinding)).toBe(true);
    expect(isTerminalScreen3RebuildProblem(createSixScreenWorkflowProblem({
      code: "delivery_failure",
      action: "rebuild_screen3_guidance",
      operationId: "screen3-rebuild-delivery-loss",
      screen: 3,
      commitCertainty: "unknown",
      dispatchCertainty: "not_dispatched",
      safeCauseCodes: ["delivery_interrupted"],
    }))).toBe(false);
  });

  it("renders handoff work separately from field validation and keeps navigation readable", () => {
    const form = {
      shockInput: "FERC Order 841",
      officialSource: "",
      requestedJurisdiction: "United States",
      approximateYear: "2018",
      intendedEpisode: "final rule",
      population: "RTOs and ISOs",
      analysisUnit: "Market operator",
      geography: "United States",
      industry: "Electric power",
      periodStart: "2018",
      periodEnd: "2025",
      outcome: "Operating margin",
      outcomeMeasure: "margin",
      intendedConstruct: "",
      policySideConcept: "market access rules",
      initialExplanation: "",
      proposedTreatment: "operators after 2020",
      proposedComparison: "operators before 2020",
      resultsPreviouslyInspected: "no" as const,
    };
    const recovery = {
      schemaVersion: "screen-03-handoff-recovery-v1" as const,
      runId: `sa6r_${"r".repeat(43)}`,
      operationId: "screen3-open-0011223344556677",
      operationKind: "open_screen_3" as const,
      inputFingerprint: "fnv1a64:0011223344556677",
      dependencyFingerprint: "fnv1a64:1122334455667788",
      state: "pending" as const,
    };
    const common = {
      form,
      timing: { mode: "year" as const, year: "2020" },
      issues: [],
      showErrors: true,
      submissionError: "",
      ready: true,
      disabled: false,
      connected: true,
      canCancel: true,
      onChange: () => undefined,
      onTimingChange: () => undefined,
      rdRule: null,
      onRdRuleChange: () => undefined,
      onBack: () => undefined,
      onCancel: () => undefined,
      onContinue: () => undefined,
      onCheckSavedStatus: () => undefined,
    };
    const saving = renderToStaticMarkup(createElement(StudyHandoffPanel, {
      ...common,
      handoffTask: {
        ...recovery,
        stage: "saving",
        message: "Saving without external work.",
        problem: null,
      },
    }));
    expect(saving).toContain("aria-busy=\"true\"");
    expect(saving).toContain(
      "Saving study and opening comparison guidance…",
    );
    expect(saving).toMatch(
      /<button type="button" class="six-secondary">Back<\/button>/u,
    );

    const failed = renderToStaticMarkup(createElement(StudyHandoffPanel, {
      ...common,
      handoffTask: {
        ...recovery,
        state: "outcome_unknown",
        stage: "outcome_unknown",
        message: "The commit outcome is unknown; no resend was made.",
        problem: null,
      },
    }));
    expect(failed).toContain("id=\"screen3-handoff-task-alert\"");
    expect(failed).toContain("Check saved status");
    expect(failed).not.toContain("Review the highlighted study details.");
    expect(failed).not.toContain("model request");

    const rebuild = renderToStaticMarkup(createElement(StudyHandoffPanel, {
      ...common,
      handoffTask: {
        ...recovery,
        state: "committed_display_pending",
        stage: "local_rebuild_required",
        message: "The saved local artifact can be restored.",
        problem: null,
      },
      onRestoreComparisonGuidance: () => undefined,
    }));
    expect(rebuild).toContain("Restore comparison guidance");
    expect(rebuild).not.toContain("Check saved status");

    const disconnectedRebuild = renderToStaticMarkup(createElement(
      StudyHandoffPanel,
      {
        ...common,
        connected: false,
        handoffTask: {
          ...recovery,
          state: "local_rebuild_required",
          stage: "local_rebuild_required",
          message: "The saved local artifact can be restored.",
          problem: null,
        },
        onRestoreComparisonGuidance: () => undefined,
      },
    ));
    expect(disconnectedRebuild).toMatch(
      /<button type="button" class="six-secondary" disabled="">Restore comparison guidance<\/button>/u,
    );
  });

  it("classifies coordinate validation separately from transport interruption", () => {
    expect(fingerprintSixScreenValue(
      "The canonical workflow response failed its state coordinates.",
    )).toBe("fnv1a64:7a3b401bcd0ad06f");
    const current = confirmedSnapshot(true);
    const invalid = structuredClone(current);
    invalid.stateFingerprint = "fnv1a64:ffffffffffffffff";
    try {
      workflowSnapshotResponseDisposition(current, invalid);
      throw new Error("Expected a state-fingerprint rejection.");
    } catch (caught) {
      expect(caught).toMatchObject({
        code: "state_fingerprint",
        diagnostic: {
          failure: "state_fingerprint",
          comparisons: {
            incomingRunEqualsStateRun: true,
            incomingRevisionEqualsStateRevision: true,
            incomingFingerprintEqualsStateFingerprint: false,
          },
        },
      });
      const visible = message(caught);
      expect(visible).toMatch(/state fingerprint did not match/iu);
      expect(visible).toMatch(/\[SA-[0-9A-F]{8}\]/u);
      expect(visible).not.toMatch(/response was interrupted|retry the same action to reconcile/iu);
    }
  });

  it("opens a committed Screen 5 navigation through canonical recovery without resending it", async () => {
    const before = confirmedSnapshot(true);
    before.state.activeScreen = 4;
    before.stateFingerprint = fingerprintSixScreenValue(before.state);
    const after = structuredClone(before);
    after.revision += 1;
    after.state.revision += 1;
    after.state.activeScreen = 5;
    after.stateFingerprint = fingerprintSixScreenValue(after.state);
    const failure = new SixScreenWorkflowProblemError(
      createSixScreenWorkflowProblem({
        code: "response_contract",
        action: "open_screen_5",
        operationId: "screen5-navigation-response-failed",
        screen: 5,
        expectedRevision: before.revision,
        actualRevision: after.revision,
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
        recovery: "check_status",
        safeCauseCodes: ["response_contract_invalid"],
      }),
    );
    const open = vi.fn(async () => Promise.reject(failure));
    const recover = vi.fn(async () => after);

    const result = await openScreenWithCanonicalRecovery({
      targetScreen: 5,
      open,
      recover,
    });

    expect(result).toEqual({ snapshot: after, recovered: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("does not hide an uncommitted Screen 5 navigation failure", async () => {
    const failure = new SixScreenWorkflowProblemError(
      createSixScreenWorkflowProblem({
        code: "revision_conflict",
        action: "open_screen_5",
        operationId: "screen5-navigation-not-committed",
        screen: 5,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "guarded_rebase",
        safeCauseCodes: ["stale_revision"],
      }),
    );
    const recover = vi.fn(async () => confirmedSnapshot(true));
    await expect(openScreenWithCanonicalRecovery({
      targetScreen: 5,
      open: async () => Promise.reject(failure),
      recover,
    })).rejects.toBe(failure);
    expect(recover).not.toHaveBeenCalled();
  });

  it("retains a typed initiating stage while canonical status is checked", () => {
    const descriptor = analysisFailureDescriptor(
      new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
        code: "provider_rejected",
        action: "personalize_screen6_plan",
        operationId: "typed-screen6-operation",
        screen: 6,
        stage: "execution",
        commitCertainty: "not_committed",
        dispatchCertainty: "dispatched",
        recovery: "none",
        safeCauseCodes: ["provider_rejected"],
      })),
    );

    expect(descriptor).toEqual({
      failureStage: "execution",
      failureCode: "provider_rejected",
      dispatchCertainty: "dispatched",
    });
  });

  it("renders bounded researcher decisions, correction provenance, timing choice, and revision history", () => {
    const workspace = eventCardWorkspaceFixture();
    const html = renderToStaticMarkup(createElement(EventCardReviewPanel, {
      workspace,
      restoredReview: null,
      disabled: false,
      onBegin: async () => undefined,
      onClaim: async () => undefined,
      onClock: async () => undefined,
      onLock: async () => undefined,
    }));
    expect(html).toContain("Review the handoff to Screen 3");
    expect(html).toContain("Intended episode");
    expect(html).toContain("Policy components");
    expect(html).toContain("Server-reconstructed chronology");
    expect(html).toContain("The final rule is effective June 4, 2018");
    expect(html).toContain("Researcher-supplied correction");
    expect(html).toContain("does not inherit its typed value or support status");
    expect(html).toContain("Continue without selecting a treatment clock");
    expect(html).not.toContain("No coherent policy overview");
    expect(html).toContain("Event Card revision history");
    expect(html).toContain("the edit remains researcher-supplied");
    expect(html).toContain("This is not the implementation date");
  });

  it("renders a source-linked Identification Map without claiming causal validity", () => {
    const fixture = causalComparisonPanelFixture();
    const html = renderToStaticMarkup(createElement(CausalComparisonPanel, {
      workspace: fixture.workspace,
      eventCard: fixture.eventCard,
      policyReview: null,
      study: {
        population: "Covered market operators",
        analysisUnit: "Operator",
        geography: ["United States"],
        industry: ["Energy"],
        period: { start: "2019", end: "2023" },
        outcome: "Market participation",
        intendedConstruct: "Policy-induced participation",
        initialExplanation: "How does the policy affect market participation?",
        proposedTreatment: "Covered operators",
        proposedComparison: "Uncovered operators",
        resultsPreviouslyInspected: "no",
        id: "study-ui",
        revision: 1,
        createdAt: "2026-09-12T10:00:00.000Z",
        updatedAt: "2026-09-12T10:00:00.000Z",
      },
      disabled: false,
      onBuild: async () => undefined,
      onDecide: async () => undefined,
    }));
    expect(html).toContain("Identification Map");
    expect(html).toContain("Coverage-based change-over-time comparison");
    expect(html).toContain("Source-linked variation");
    expect(html).toContain("passage-ui-coverage");
    expect(html).toContain("Assumptions");
    expect(html).toContain("Claims this option does not support");
    expect(html).toContain("I do not yet have a defensible comparison");
    expect(html).toContain("do not certify");
    expect(html).toContain("Initial reviewed method library");
    expect(html).toContain("Comparison revision history");
  });

  it("renders an inspectable Screen 4 matrix without implying retrieval or causal relevance", () => {
    const workspace = {
      schemaVersion: "screen-04-coevent-search-workspace-v1",
      matrix: {
        ordinal: 1,
        modeLabel: "Contextual event scan — comparison not specified.",
        scope: {
          studyPeriod: { start: "2019", end: "2023" },
          anticipationLookback: { amount: 1, unit: "years" },
          contextLookforward: { amount: 6, unit: "months" },
        },
        rows: [{
          id: "coevent-search-comparison-spillover",
          branch: "comparison_spillover",
          question:
            "Which spillover routes should be checked if a comparison group is specified later?",
          affectedGroups: [{ role: "population", label: "Market operators" }],
          eventFamily: "spillovers and comparison contamination",
          geographyOrMarket: ["United States", "Energy"],
          providers: [
            { id: "crossref", availability: "not_checked" },
            { id: "brave", availability: "not_checked" },
          ],
          queryTerms: ["Market operators", "spillover substitution contamination"],
          plannedLimit: 12,
          outcome: { status: "not_started", candidateCount: 0, note: null },
        }],
        claimBoundary:
          "This saved matrix is a deterministic search plan, not an executed search, exhaustive event list, relevance finding, causal diagnosis, or instruction to add controls.",
      },
      executionPlan: null,
      execution: null,
      attempts: [],
      candidates: [],
      discoveryLeads: [],
      occurrenceReviews: [],
      duplicateReviews: [],
      relationReviews: [],
      policyLifecycleHandoffs: [],
      revisions: [{
        matrixSnapshotId: "coevent-matrix-ui",
        ordinal: 1,
        createdAt: "2026-09-13T10:00:00.000Z",
        mode: "contextual",
        rowCount: 5,
        executionStatus: "planned",
        artifactStatus: "current",
      }],
      executionRevisions: [],
    } as unknown as CoEventSearchWorkspace;
    const html = renderToStaticMarkup(createElement(CoEventSearchPanel, {
      workspace,
      mode: "contextual",
      modeLabel: "Contextual event scan — comparison not specified.",
      disabled: false,
      canContinue: false,
      onSave: async () => undefined,
      onContinue: async () => undefined,
      onReviewOccurrence: async () => undefined,
      onReviewDuplicate: async () => undefined,
      onReviewRelation: async () => undefined,
      onRoutePolicyStage: async () => undefined,
    }));

    expect(html).toContain("Inspect the search boundary before retrieval");
    expect(html).toContain("Contextual event scan — comparison not specified.");
    expect(html).toContain("Saved search matrix");
    expect(html).toContain("comparison spillover");
    expect(html).toContain("availability not checked");
    expect(html).toContain("Retrieval has not run");
    expect(html).toContain("not an executed search");
    expect(html).toContain("Search-matrix revision history");

    const executedWorkspace = structuredClone(workspace) as
      CoEventSearchWorkspace;
    executedWorkspace.executionPlan = {
      searchPeriod: { start: "2018-01-01", end: "2023-06-30" },
      sourceQueryCeiling: 24,
      metadataCandidateCeiling: 100,
      steps: [{
        id: "coevent-step-comparison-spillover-crossref",
        provider: "Crossref",
        branch: "comparison_spillover",
        capabilityStatus: "enabled_not_tested",
        initialStatus: "pending",
        statusNote: null,
      }],
      claimBoundary: "Capability status is not a search result.",
    } as CoEventSearchWorkspace["executionPlan"];
    executedWorkspace.execution = {
      status: "active",
      completedStepIds: ["coevent-step-comparison-spillover-crossref"],
      remainingStepIds: ["coevent-step-comparison-spillover-brave"],
      actualSearchBoundary: {
        periodStart: "2018-01-01",
        periodEnd: "2023-06-30",
        sourceQueries: 1,
        metadataRecords: 1,
        searchedProviderIds: ["crossref"],
        stopReason: null,
      },
      unavailableProviderIds: ["brave"],
    } as CoEventSearchWorkspace["execution"];
    executedWorkspace.attempts = [{
      id: "coevent-attempt-ui",
      stepId: "coevent-step-comparison-spillover-crossref",
      providerId: "crossref",
      outcome: "discovery_leads_only",
      note: "Crossref returned one bibliographic lead; none is occurrence evidence.",
      recordsReceived: 1,
      recordsAccepted: 1,
      usage: { sourceQueries: 1 },
    }] as CoEventSearchWorkspace["attempts"];
    executedWorkspace.candidates = [{
      id: "coevent-candidate-ui",
      candidateFingerprint: "fnv1a64:1111111111111111",
      title: "Documented market closure",
      description: "Provider metadata records the closure.",
      typedDates: [{ kind: "event", value: "2021-04-02" }],
      affectedActivityOrPopulation: {
        status: "not_established",
        labels: [],
      },
      geography: {
        status: "provider_reported",
        labels: ["United States"],
      },
      evidence: [{
        sourceId: "coevent-source-ui",
        locator: "https://example.gov/coevent",
        publisher: "Official register",
        title: "Market closure notice",
      }],
      claimBoundary:
        "This record supports occurrence only; causal relevance is not assessed.",
    }, {
      id: "coevent-candidate-ui-second",
      candidateFingerprint: "fnv1a64:2222222222222222",
      title: "Documented market closure notice",
      description: "A second provider representation records the closure.",
      typedDates: [{ kind: "publication", value: "2021-04-03" }],
      affectedActivityOrPopulation: {
        status: "not_established",
        labels: [],
      },
      geography: {
        status: "provider_reported",
        labels: ["United States"],
      },
      evidence: [{
        sourceId: "coevent-source-ui-second",
        locator: "https://example.gov/coevent-notice",
        publisher: "Second official register",
        title: "Market closure notice copy",
      }],
      claimBoundary:
        "This record supports occurrence only; causal relevance is not assessed.",
    }] as CoEventSearchWorkspace["candidates"];
    executedWorkspace.occurrenceReviews = [{
      id: "coevent-occurrence-review-ui",
      ordinal: 1,
      candidateReference: { candidateId: "coevent-candidate-ui" },
      decision: "corrected",
      reviewedAt: "2026-09-14T10:00:00.000Z",
      rationale: "Keep the researcher correction separate from source metadata.",
      correction: {
        title: "Researcher-corrected market closure",
        typedDates: [{ kind: "effective", value: "2021-04", precision: "month" }],
        affectedActivityOrPopulationLabels: ["Regional operators"],
        geographyLabels: [],
        limitation:
          "Researcher-supplied corrections do not alter or upgrade source metadata.",
      },
    }] as unknown as CoEventSearchWorkspace["occurrenceReviews"];
    executedWorkspace.duplicateReviews = [{
      id: "coevent-duplicate-review-ui",
      ordinal: 1,
      members: [
        { candidateId: "coevent-candidate-ui" },
        { candidateId: "coevent-candidate-ui-second" },
      ],
      decision: "distinct_stage",
      rationale: "These are linked stages rather than copies to collapse.",
      reviewedAt: "2026-09-14T10:01:00.000Z",
    }] as unknown as CoEventSearchWorkspace["duplicateReviews"];
    executedWorkspace.relationReviews = [{
      id: "coevent-relation-review-ui",
      ordinal: 1,
      binding: { candidateId: "coevent-candidate-ui" },
      decision: "retained",
      relation: {
        category: "independent_concurrent_event",
        priority: "high",
        affectedGroupRoles: ["unknown"],
        plausibleOutcomePathway:
          "The closure could alter participation independently of the focal policy.",
        differentialRelevance:
          "Historical eligibility may differ within the study population.",
        assumptions: ["The occurrence overlaps the study window."],
        unresolvedQuestions: ["Which organizations were exposed?"],
        proposedResponses: ["Obtain historical exposure evidence."],
      },
      rationale:
        "Retain this researcher-authored concern pending exposure evidence.",
      reviewedAt: "2026-09-14T10:00:30.000Z",
    }] as unknown as CoEventSearchWorkspace["relationReviews"];
    executedWorkspace.discoveryLeads = [{
      id: "coevent-lead-ui",
      locator: "https://doi.org/10.1234/example",
      title: "A contextual study",
      publisher: "Research publisher",
      publishedDate: "2022-04-02",
      limitation:
        "The publication date is not an event date; occurrence is not established.",
    }] as CoEventSearchWorkspace["discoveryLeads"];
    const executedHtml = renderToStaticMarkup(createElement(
      CoEventSearchPanel,
      {
        workspace: executedWorkspace,
        mode: "contextual",
        modeLabel: "Contextual event scan — comparison not specified.",
        disabled: false,
        canContinue: true,
        onSave: async () => undefined,
        onContinue: async () => undefined,
        onReviewOccurrence: async () => undefined,
        onReviewDuplicate: async () => undefined,
        onReviewRelation: async () => undefined,
        onRoutePolicyStage: async () => undefined,
      },
    ));
    expect(executedHtml).toContain("Run next bounded provider step");
    expect(executedHtml).toContain("Outage is not no match");
    expect(executedHtml).toContain("discovery leads only");
    expect(executedHtml).toContain(
      "Occurrence evidence + separate researcher relation review",
    );
    expect(executedHtml).toContain(
      "Relation judgments are not occurrence facts",
    );
    expect(executedHtml).toContain("Occurrence not established");
    expect(executedHtml).toContain("paused after one provider step");
    expect(executedHtml).toContain("Review this occurrence record");
    expect(executedHtml).toContain("Researcher-supplied correction");
    expect(executedHtml).toContain("Classify relation to the comparison");
    expect(executedHtml).toContain("independent concurrent event");
    expect(executedHtml).toContain("semantic assistance not used");
    expect(executedHtml).toContain("does not add a regression control");
    expect(executedHtml).toContain("Duplicate and policy-stage review");
    expect(executedHtml).toContain("Source records stay retained");
    expect(executedHtml).toContain("Deduplicate copies as one event");
    expect(executedHtml).toContain("distinct stage");
    expect(executedHtml).toContain(
      "Could this belong to the focal policy lifecycle?",
    );
    expect(executedHtml).toContain(
      "Send possible policy stage to Screen 2",
    );

    const lifecycleWorkspace = structuredClone(executedWorkspace);
    lifecycleWorkspace.policyLifecycleHandoffs = [{
      handoff: {
        id: "coevent-policy-lifecycle-handoff-ui",
        proposedStage: {
          kind: "litigation_or_court_order",
          status: "researcher_proposed_for_review",
        },
        focalPolicyReference: {
          eventCardReference: {
            reviewOrdinal: 1,
            eventCardSnapshotId: "policy-event-card-ui",
          },
        },
        destination: { policyEventCardReviewOrdinal: 2 },
        rationale:
          "The order may postpone the focal rule and needs source-grounded review.",
        routedAt: "2026-09-14T10:02:00.000Z",
        claimBoundary:
          "This is a possible policy stage only; relation and causal relevance remain unassessed.",
      },
      candidate: executedWorkspace.candidates[0],
      occurrenceReview: executedWorkspace.occurrenceReviews[0],
      targetReviewStatus: "pending_event_card_review",
    }] as unknown as CoEventSearchWorkspace["policyLifecycleHandoffs"];
    const pendingStageWorkspace = {
      schemaVersion: "screen-02-policy-lifecycle-stage-workspace-v1",
      entries: [{
        handoffId: "coevent-policy-lifecycle-handoff-ui",
        handoffFingerprint: "fnv1a64:4444444444444444",
        targetPolicyEventCardReviewId: "policy-event-card-review-two",
        candidateProviderId: "federal_register",
        adapterAvailability: "ready",
        acquisitions: [],
        latestAcquisition: null,
        dispositions: [],
        latestDisposition: null,
        proposals: [],
        latestProposal: null,
        proposalReviews: [],
        latestProposalReview: null,
        chronologyStageOptions: ["announcement", "legal_effect", "suspension"],
        sourceDateOptions: [],
        canAcquire: true,
        canRetry: false,
        canDispose: false,
        canProposeRevision: false,
        canReviewRevision: false,
      }],
      claimBoundary:
        "Official-document acquisition and researcher disposition are preserved separately. Neither action silently changes chronology or the Event Card.",
    } as unknown as PolicyLifecycleStageReviewWorkspace;
    const lifecycleHtml = renderToStaticMarkup(createElement(
      PolicyLifecycleHandoffPanel,
      {
        workspace: lifecycleWorkspace,
        stageWorkspace: pendingStageWorkspace,
        onAcquire: async () => undefined,
        onDisposition: async () => undefined,
      },
    ));
    expect(lifecycleHtml).toContain("Screen 4 → Screen 2 review handoff");
    expect(lifecycleHtml).toContain("Researcher proposed · not verified");
    expect(lifecycleHtml).toContain(
      "The prior Event Card and source occurrence remain unchanged",
    );
    expect(lifecycleHtml).toContain("Researcher routing rationale");
    expect(lifecycleHtml).toContain("Researcher-supplied occurrence correction");
    expect(lifecycleHtml).toContain("pending event card review");
    expect(lifecycleHtml).toContain("Acquire official stage document");
    expect(lifecycleHtml).toContain(
      "Acquire and dispose the official stage document",
    );

    const retainedSource = {
      title: "Capacity Market Reliability Implementation Rule",
      canonicalUrl:
        "https://www.federalregister.gov/documents/2021/06/21/2021-54321/example",
      nativeDocumentNumber: "2021-54321",
      focalPolicyReferenceStatus: "exact_identifier_found",
      retainedPassages: [{
        id: "policy-lifecycle-passage-ui-1",
        exactText:
          "This implementation order cites focal rule 2020-12345 and retains a later schedule for review.",
        locator: "visible text offsets 0-96",
        qualification:
          "The exact identifier context is retained for researcher review; mention alone does not establish legal effect.",
      }],
    };
    const acquisition = {
      id: "policy-lifecycle-acquisition-ui",
      acquisitionFingerprint: "fnv1a64:5555555555555555",
      outcome: "document_retained",
      limitation:
        "Only bounded exact passages are retained for disposition.",
      source: retainedSource,
    };
    const retainedStageWorkspace = structuredClone(pendingStageWorkspace) as
      unknown as PolicyLifecycleStageReviewWorkspace;
    Object.assign(retainedStageWorkspace.entries[0]!, {
      acquisitions: [acquisition],
      latestAcquisition: acquisition,
      dispositions: [{
        id: "policy-lifecycle-disposition-ui",
        dispositionFingerprint: "fnv1a64:6666666666666666",
        decision: "accepted_for_event_card_review",
        rationale:
          "The exact focal identifier supports later Event Card review.",
      }],
      latestDisposition: {
        id: "policy-lifecycle-disposition-ui",
        dispositionFingerprint: "fnv1a64:6666666666666666",
        decision: "accepted_for_event_card_review",
        rationale:
          "The exact focal identifier supports later Event Card review.",
      },
      canAcquire: false,
      canDispose: true,
      canProposeRevision: true,
      chronologyStageOptions: ["announcement", "legal_effect", "suspension"],
      sourceDateOptions: [{
        id: "policy-lifecycle-source-date-ui",
        origin: "publication_metadata",
        label: "publication · 2021-06-21",
        typedDate: { start: "2021-06-21", kind: "publication" },
      }],
    });
    const retainedLifecycleHtml = renderToStaticMarkup(createElement(
      PolicyLifecycleHandoffPanel,
      {
        workspace: lifecycleWorkspace,
        stageWorkspace: retainedStageWorkspace,
        onAcquire: async () => undefined,
        onDisposition: async () => undefined,
        onProposeRevision: async () => undefined,
        onReviewRevision: async () => undefined,
      },
    ));
    expect(retainedLifecycleHtml).toContain("Immutable official document");
    expect(retainedLifecycleHtml).toContain("Federal Register 2021-54321");
    expect(retainedLifecycleHtml).toContain("exact identifier found");
    expect(retainedLifecycleHtml).toContain("2020-12345");
    expect(retainedLifecycleHtml).toContain("Latest researcher disposition");
    expect(retainedLifecycleHtml).toContain("accepted for event card review");
    expect(retainedLifecycleHtml).toContain(
      "Researcher decision—not legal verification",
    );
    expect(retainedLifecycleHtml).toContain(
      "Save stage-document disposition",
    );
    expect(retainedLifecycleHtml).toContain(
      "Propose one chronology stage for later review",
    );
    expect(retainedLifecycleHtml).toContain("Select a stage");
    expect(retainedLifecycleHtml).toContain(
      "Select source metadata or undated",
    );
    expect(retainedLifecycleHtml).toContain("Save immutable stage proposal");

    const proposedStageWorkspace = structuredClone(retainedStageWorkspace);
    Object.assign(proposedStageWorkspace.entries[0]!, {
      proposals: [{ id: "policy-lifecycle-proposal-ui" }],
      latestProposal: {
        id: "policy-lifecycle-proposal-ui",
        proposalFingerprint: "fnv1a64:7777777777777777",
        rationale:
          "The bounded official source supports a separately reviewed suspension proposal.",
        stage: {
          chronologyStage: "suspension",
          statement:
            "The researcher proposes reviewing the order as a suspension stage.",
          timing: {
            mode: "absolute",
            start: "2021-06-21",
            end: null,
            precision: "day",
          },
          sourceTypedDate: {
            start: "2021-06-21",
            kind: "publication",
          },
        },
      },
      proposalReviews: [],
      latestProposalReview: null,
      canDispose: false,
      canProposeRevision: false,
      canReviewRevision: true,
    });
    const proposedLifecycleHtml = renderToStaticMarkup(createElement(
      PolicyLifecycleHandoffPanel,
      {
        workspace: lifecycleWorkspace,
        stageWorkspace: proposedStageWorkspace,
        onProposeRevision: async () => undefined,
        onReviewRevision: async () => undefined,
      },
    ));
    expect(proposedLifecycleHtml).toContain(
      "Immutable lifecycle-stage proposal",
    );
    expect(proposedLifecycleHtml).toContain("Separate proposal decision");
    expect(proposedLifecycleHtml).toContain("Select a decision");
    expect(proposedLifecycleHtml).toContain("Save proposal decision");
  });

  it("renders restored pre-effective and effective-date eCFR evidence without current text", () => {
    setWidgetState({
      privateContent: { sixScreenWorkflow: historicalPolicySnapshot() },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Historical version retained");
    expect(html).toContain("pre-effective boundary and effective-date addition");
    expect(html).toContain("previous baseline");
    expect(html).toContain("historical version change");
    expect(html).toContain("2018-06-03 point-in-time boundary");
    expect(html).toContain("2018-06-04 point-in-time addition");
    expect(html).toContain("https://www.ecfr.gov/api/versioner/v1/full/2018-06-03/title-18.xml?part=35");
    expect(html).not.toContain("/current/title-18");
  });

  it("labels the contemporaneous amendment as a limited historical fallback", () => {
    setWidgetState({
      privateContent: { sixScreenWorkflow: historicalFallbackSnapshot() },
    });
    const html = renderToStaticMarkup(createElement(SixScreenApp));
    expect(html).toContain("Historical fallback retained");
    expect(html).toContain("contemporaneous amendment record");
    expect(html).toContain("Amend \u00a7 35.28");
    expect(html).toContain("does not establish either adjacent-date CFR version");
    expect(html).toContain("No current CFR text was substituted");
  });

  it("keeps navigation and unrelated study inputs available during model tasks", () => {
    const source = readFileSync(new URL(
      "../../src/ui/six-screen/SixScreenApp.tsx",
      import.meta.url,
    ), "utf8");
    const handler = (start: string, end: string) => source.slice(
      source.indexOf(`async function ${start}`),
      source.indexOf(`async function ${end}`),
    );
    const screen3 = handler("personalizeScreen3Advice", "initializeScreen6Profile");
    const screen4 = handler("analyzeStudyFirstEvents", "continueToScreen5");
    const screen6 = handler("personalizeScreen6Plan", "personalizeScreen3Advice");
    for (const taskHandler of [screen3, screen4, screen6]) {
      expect(taskHandler).not.toContain("setBusy(true)");
      expect(taskHandler).not.toContain("setBusy(false)");
      expect(taskHandler).toContain("markModelTaskBusy");
    }
    expect(screen4).toContain('action: "analyze_study_first_events"');
    expect(screen4).toContain("await mutate(currentSnapshot");
    expect(screen4).toContain("advanceScreen4AssessmentQueue");
    expect(screen4).not.toContain("compact");
    expect(screen4).not.toContain("getScreen4AssessmentStatus");
    expect(source).not.toContain("Renew local model allowance");
    expect(source).not.toContain("six-model-allowance-renewal");
    expect(source).toContain('directActionStage={screen5DirectAction}');
    expect(source).toContain('onClick={() => void navigateToScreen(');
  });

  it("requires the exact v3 operation binding for direct mutation responses only", () => {
    const source = readFileSync(new URL(
      "../../src/ui/six-screen/SixScreenApp.tsx",
      import.meta.url,
    ), "utf8");
    const mutateSource = source.slice(
      source.indexOf("async function mutate("),
      source.indexOf("function reconcileCanonicalAfterFailure("),
    );
    expect(mutateSource).toContain(
      "sixScreenWorkflowMutationRequestBinding(mutation)",
    );
    expect(mutateSource).toContain(
      "acceptToolResponse(response, expectedOperationBinding)",
    );
    const pushedResultSource = source.slice(
      source.indexOf("hostToolResultHandlerRef.current ="),
      source.indexOf("hostToolCancellationHandlerRef.current ="),
    );
    expect(pushedResultSource).toContain("acceptToolResponse(response)");
    expect(pushedResultSource).not.toContain("expectedOperationBinding");
  });

  it("reports Screen 5 reconciliation as compatible state, not a proven exact receipt", () => {
    const source = readFileSync(new URL(
      "../../src/ui/six-screen/SixScreenApp.tsx",
      import.meta.url,
    ), "utf8");
    const recoverySource = source.slice(
      source.indexOf("if (analysisArtifactRecovered("),
      source.indexOf("if (recovered.revision > snapshot.revision)"),
    );
    expect(recoverySource).toContain(
      "Saved compatible Screen 5 task state recovered",
    );
    expect(recoverySource).not.toContain("exact operation receipt");
  });

  it("renders a validated compatible v24 Screen 6 result as current", () => {
    const plan = createScreen6CurrentPlan(
      createFrozenV24Screen6Fixture().state,
    );
    const legacyFingerprint = frozenV24Screen6InputFingerprint;
    expect(plan.legacyInputFingerprints).toContain(legacyFingerprint);
    const personalization: Screen6PublicPersonalization = {
      id: "compatible-v24-screen6",
      inputFingerprint: legacyFingerprint,
      status: "completed",
      retryEligibility: "none",
      dispatchState: "dispatched",
      failureCode: null,
      failureStage: null,
      supplement: {
        priorities: [{
          diagnostic_id: plan.priorities[0]!.id,
          priority_reason: "COMPATIBLE_V24_PRIORITY",
          next_action: "Inspect the preserved compatible check.",
        }],
        claim_boundary: null,
        remaining_gaps: [],
      },
      error: null,
      providerResponseId: "resp-compatible-v24",
      usage: null,
    };
    const html = renderToStaticMarkup(Screen6CurrentPlanPanel({
      plan,
      personalization,
      disabled: false,
      unavailableReason: null,
      onPersonalize: async () => undefined,
    }));
    expect(html).toContain("COMPATIBLE_V24_PRIORITY");
    expect(html).toContain("Prioritized checks for this study");
    expect(html).not.toContain("Generate study-specific challenge plan");
    expect(html).not.toContain("Not yet generated");
  });

  it("distinguishes Screen 6 admission, provider and uncertain failures", () => {
    const plan = createScreen6CurrentPlan(confirmedSnapshot(true).state);
    const renderFailure = (overrides: Partial<Screen6PublicPersonalization>) =>
      renderToStaticMarkup(Screen6CurrentPlanPanel({
        plan,
        personalization: {
          id: "screen6-failure",
          inputFingerprint: plan.inputFingerprint,
          status: "failed",
          retryEligibility: "observe",
          dispatchState: "unknown",
          failureCode: "network_error",
          failureStage: "network",
          supplement: null,
          error: "Controlled failure fixture.",
          providerResponseId: null,
          usage: null,
          ...overrides,
        },
        disabled: false,
        unavailableReason: null,
        onPersonalize: async () => undefined,
      }));
    const beforeDispatch = renderFailure({
      dispatchState: "not_dispatched",
      failureCode: "input_too_large",
      failureStage: "admission",
      retryEligibility: "new_request",
    });
    const rejected = renderFailure({
      dispatchState: "dispatched",
      failureCode: "http_error",
      failureStage: "response_headers",
      retryEligibility: "new_request",
    });
    const uncertain = renderFailure({
      dispatchState: "dispatched",
      failureCode: "network_error",
      failureStage: "network",
      retryEligibility: "observe",
    });
    expect(beforeDispatch).toContain("stopped before dispatch");
    expect(beforeDispatch).not.toContain("provider rejected");
    expect(rejected).toContain("provider rejected");
    expect(uncertain).toContain("provider outcome is unknown");
    expect(uncertain).not.toContain("provider rejected");
  });
});
