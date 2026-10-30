import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createMechanismLiteraturePlanInput } from
  "../../src/core/six-screen/mechanism-literature-plan";
import {
  openScreen5,
} from "../../src/core/six-screen/workflow";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import type { MechanismLiteratureWorkspace } from
  "../../src/worker/six-screen-workflow-runtime";
import { MechanismLiteraturePlanPanel } from
  "../../src/ui/six-screen/MechanismLiteraturePlanPanel";
import {
  browserEventCardFixtureAt,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";
import { createHistoricalMechanismPlan } from
  "../fixtures/archived-legacy-screen5-plan";

const claimBoundary =
  "A saved literature plan is not a literature review, mechanism analysis, prediction matrix, or causal finding.";

function savedWorkspace(crossrefHealthy = false) {
  const fixture = createLockedBrowserEventCardFixture();
  const opened = openScreen5(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(22),
  });
  const sources = buildSixScreenSourceRegister(crossrefHealthy
    ? {
        probes: {
          crossref: {
            at: browserEventCardFixtureAt(22),
            endpoint: "https://api.crossref.org/v1/works",
            outcome: "success",
            httpStatus: 200,
            note: "Deterministic capability fixture.",
          },
        },
      }
    : {});
  const saved = createHistoricalMechanismPlan(opened.state, {
    snapshotId: "mechanism-literature-plan-render-fixture",
    planInput: createMechanismLiteraturePlanInput({
      explanation: {
        mode: "stated",
        text: "The participation process may reduce barriers to market entry.",
      },
      suppliedWorks: [{
        id: "researcher-work-render-fixture",
        kind: "citation",
        value: "Example Author (2026), Example study",
      }],
      preferredConstructs: ["organizational adaptation"],
      feasibleDataSources: ["dated participation filings"],
      knownAlternativeAccounts: ["concurrent market redesign"],
    }),
    capabilities: {
      openalex: sources.openalex,
      crossref: sources.crossref,
    },
    createdAt: browserEventCardFixtureAt(23),
  });
  const workspace: MechanismLiteratureWorkspace = {
    schemaVersion: "screen-05-mechanism-literature-workspace-v1",
    plan: saved.plan,
    executionPlan: null,
    execution: null,
    attempts: [],
    metadataRecords: [],
    evidencePacket: null,
    documentTargets: [],
    documentAcquisitions: [],
    passagePacket: null,
    claimExtractions: [],
    claimReviews: [],
    claimPacket: null,
    synthesisInputPacket: null,
    mechanismReview: null,
    predictionMatrix: null,
    revisions: [{
      planSnapshotId: saved.plan.snapshotId,
      ordinal: saved.plan.ordinal,
      createdAt: saved.plan.createdAt,
      explanationMode: saved.plan.input.explanation.mode,
      policyPremiseCount: saved.plan.policyPremises.length,
      artifactStatus: "current",
    }],
    executionRevisions: [],
    claimBoundary,
  };
  return { fixture, workspace };
}

describe("Screen 5 literature-plan panel", () => {
  it("renders three visibly unrun branches and the current access boundaries", () => {
    const { fixture, workspace } = savedWorkspace();
    const markup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      {
        workspace,
        study: fixture.state.study,
        disabled: false,
        canContinue: true,
        canInspect: false,
        canExtractClaim: false,
        canReviewClaim: false,
        canPrepareSynthesisInput: false,
        canSaveMechanismReview: false,
        onSave: vi.fn(async () => undefined),
        onContinue: vi.fn(async () => undefined),
        onInspect: vi.fn(async () => undefined),
        onExtractClaim: vi.fn(async () => undefined),
        onReviewClaim: vi.fn(async () => undefined),
        onPrepareSynthesisInput: vi.fn(async () => undefined),
        onSaveMechanismReview: vi.fn(async () => undefined),
      },
    ));

    expect(markup).toContain("Saved literature plan");
    expect(markup).toContain("exact policy and response");
    expect(markup).toContain("analogous intervention and process");
    expect(markup).toContain("theory contrary findings and boundaries");
    expect(markup.match(/not started/gu)).toHaveLength(4);
    expect(markup).toContain("OpenAlex");
    expect(markup).toContain("not configured");
    expect(markup).toContain("Crossref");
    expect(markup).toContain("enabled not tested");
    expect(markup).toContain("not retrieved");
    expect(markup).toContain("not inspected");
    expect(markup).toContain("Results inspected before alternatives");
    expect(markup).toContain("Saving records the plan only");
    expect(markup).toContain("Record current source-access boundary");
    expect(markup).toContain(workspace.plan!.claimBoundary);
  });

  it("offers an explicit undecided starting position before a plan exists", () => {
    const { fixture } = savedWorkspace();
    const workspace: MechanismLiteratureWorkspace = {
      schemaVersion: "screen-05-mechanism-literature-workspace-v1",
      plan: null,
      executionPlan: null,
      execution: null,
      attempts: [],
      metadataRecords: [],
      evidencePacket: null,
      documentTargets: [],
      documentAcquisitions: [],
      passagePacket: null,
      claimExtractions: [],
      claimReviews: [],
      claimPacket: null,
      synthesisInputPacket: null,
      mechanismReview: null,
      predictionMatrix: null,
      revisions: [],
      executionRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      {
        workspace,
        study: { ...fixture.state.study, initialExplanation: null },
        disabled: false,
        canContinue: false,
        canInspect: false,
        canExtractClaim: false,
        canReviewClaim: false,
        canPrepareSynthesisInput: false,
        canSaveMechanismReview: false,
        onSave: vi.fn(async () => undefined),
        onContinue: vi.fn(async () => undefined),
        onInspect: vi.fn(async () => undefined),
        onExtractClaim: vi.fn(async () => undefined),
        onReviewClaim: vi.fn(async () => undefined),
        onPrepareSynthesisInput: vi.fn(async () => undefined),
        onSaveMechanismReview: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("Define the mechanism question before searching");
    expect(markup).toContain("I have not selected a mechanism");
    expect(markup).toContain("It does not generate theory cards");
    expect(markup).toContain("Prior-results disclosure: no");
  });

  it("renders metadata leads without implying that scholarly text was inspected", () => {
    const { fixture, workspace } = savedWorkspace(true);
    workspace.execution = {
      snapshotId: "screen5-ui-execution-1",
      status: "active",
      scholarlyMetadataRecordIds: [
        "screen5-ui-record-1",
        "screen5-ui-record-2",
      ],
      actualSearchBoundary: {
        sourceQueries: 1,
        metadataRecords: 2,
        retainedMetadataRecordCount: 2,
      },
      evidenceStatus: {
        scholarlyMetadata: "retrieved",
        scholarlyText: "not_inspected",
        suppliedWorks: "not_inspected",
      },
      claimBoundary:
        "Metadata records are discovery leads, not support for a detailed claim.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["execution"]>;
    workspace.attempts = [{
      id: "screen5-ui-attempt-1",
      branch: "exact_policy_and_response",
      outcome: "metadata_leads_found",
      note: "Crossref returned one bibliographic lead; no text was requested.",
    }] as MechanismLiteratureWorkspace["attempts"];
    workspace.metadataRecords = [{
      id: "screen5-ui-record-1",
      providerId: "crossref",
      stableLocator: "https://doi.org/10.1234/adaptation.1",
      title: "Participation and organizational adaptation",
      authors: ["Ada Lovelace", "Research Consortium"],
      publicationYear: 2024,
    }, {
      id: "screen5-ui-record-2",
      providerId: "openalex",
      stableLocator: "https://openalex.org/W1234567890",
      title: "Open discovery metadata",
      authors: ["Grace Hopper"],
      publicationYear: 2025,
      openAccessLocationMetadata: {
        locations: [{
          landingPageUrl: "https://repository.example/record/1",
          pdfUrl: "https://repository.example/record/1.pdf",
        }],
      },
    }] as MechanismLiteratureWorkspace["metadataRecords"];
    workspace.evidencePacket = {
      claimBoundary:
        "This packet has metadata only and cannot support mechanism generation.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["evidencePacket"]>;

    const markup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      {
        workspace,
        study: fixture.state.study,
        disabled: false,
        canContinue: true,
        canInspect: false,
        canExtractClaim: false,
        canReviewClaim: false,
        canPrepareSynthesisInput: false,
        canSaveMechanismReview: false,
        onSave: vi.fn(async () => undefined),
        onContinue: vi.fn(async () => undefined),
        onInspect: vi.fn(async () => undefined),
        onExtractClaim: vi.fn(async () => undefined),
        onReviewClaim: vi.fn(async () => undefined),
        onPrepareSynthesisInput: vi.fn(async () => undefined),
        onSaveMechanismReview: vi.fn(async () => undefined),
      },
    ));

    expect(markup).toContain("Scholarly evidence packet");
    expect(markup).toContain("Scholarly metadata leads");
    expect(markup).toContain("Participation and organizational adaptation");
    expect(markup).toContain("Ada Lovelace, Research Consortium · 2024");
    expect(markup).toContain(
      "Crossref bibliographic metadata · detailed claim support not eligible",
    );
    expect(markup).toContain(
      "OpenAlex work/location metadata · detailed claim support not eligible",
    );
    expect(markup).toContain("1 unvisited reported location(s) · no link followed");
    expect(markup).toContain("reported landing page");
    expect(markup).toContain("reported PDF");
    expect(markup).toContain("Full texts inspected");
    expect(markup).toContain("Run next scholarly metadata step");
    expect(markup).toContain(
      "This packet has metadata only and cannot support mechanism generation.",
    );
    expect(markup).not.toMatch(/abstract inspected|full text retrieved/iu);
  });

  it("renders the exact-passage gate and preserves passage eligibility boundaries", () => {
    const { fixture, workspace } = savedWorkspace();
    workspace.execution = {
      status: "complete",
      actualSearchBoundary: {
        sourceQueries: 0,
        metadataRecords: 0,
        retainedMetadataRecordCount: 0,
      },
      scholarlyMetadataRecordIds: [],
      evidenceStatus: {
        suppliedWorks: "not_inspected",
        scholarlyMetadata: "not_retrieved",
        scholarlyText: "partially_inspected",
      },
      claimBoundary: "Metadata execution is complete; no mechanism was assessed.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["execution"]>;
    workspace.documentTargets = [{
      id: "scholarly-document-target-render-fixture",
      originKind: "doi",
      doi: "10.1234/render.1",
      title: "Participation and adaptation",
      retainedLocator: null,
      routeRequirement: "exact_document_url_required",
    }] as MechanismLiteratureWorkspace["documentTargets"];
    workspace.documentAcquisitions = [{
      id: "scholarly-document-acquisition-render-fixture",
      ordinal: 1,
      outcome: "passage_retained",
      note: "One exact passage was retained for later researcher review.",
      document: {
        canonicalUrl: "https://fixtures.example/article",
        title: "Participation and adaptation",
        inspectionStatus: "partial_text",
        normalizedTextHash:
          `sha256:${"a".repeat(64)}`,
      },
      passage: {
        id: "scholarly-passage-render-fixture",
        passageFingerprint: "fnv1a64:7777777777777777",
        locator: "normalized visible-text offsets 42-84",
        exactText: "Organizations reevaluated entry costs.",
        qualification: "Not yet reviewed as a detailed scholarly claim.",
        quoteHash: `sha256:${"b".repeat(64)}`,
        detailedClaimUse: "eligible_for_later_researcher_review",
      },
    }] as MechanismLiteratureWorkspace["documentAcquisitions"];
    workspace.passagePacket = {
      passageReferences: [{}],
      claimBoundary:
        "No detailed scholarly claim has been extracted or researcher-reviewed and no mechanism may be generated.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["passagePacket"]>;

    const markup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      {
        workspace,
        study: fixture.state.study,
        disabled: false,
        canContinue: false,
        canInspect: true,
        canExtractClaim: true,
        canReviewClaim: false,
        canPrepareSynthesisInput: false,
        canSaveMechanismReview: false,
        onSave: vi.fn(async () => undefined),
        onContinue: vi.fn(async () => undefined),
        onInspect: vi.fn(async () => undefined),
        onExtractClaim: vi.fn(async () => undefined),
        onReviewClaim: vi.fn(async () => undefined),
        onPrepareSynthesisInput: vi.fn(async () => undefined),
        onSaveMechanismReview: vi.fn(async () => undefined),
      },
    ));

    expect(markup).toContain("Exact scholarly passage inspection");
    expect(markup).toContain("researcher-supplied exact document URL");
    expect(markup).toContain("Record rights boundary");
    expect(markup).toContain("Missing rights, URL, source configuration");
    expect(markup).toContain("Organizations reevaluated entry costs.");
    expect(markup).toContain("normalized visible-text offsets 42-84");
    expect(markup).toContain(`sha256:${"a".repeat(64)}`);
    expect(markup).toContain("partial text inspected");
    expect(markup).toContain("no mechanism may be generated");
    expect(markup).toContain("Structured scholarly claim review");
    expect(markup).toContain("You—not an automated model—author");
    expect(markup).toContain("Save researcher-authored extraction");
    expect(markup).toContain("Abstract-only and metadata-only records never appear");
    expect(markup).not.toContain("full article text.</blockquote>");
  });

  it("shows separate researcher extraction and accept/reject/defer/correct review controls", () => {
    const { fixture, workspace } = savedWorkspace();
    workspace.execution = {
      status: "complete",
      actualSearchBoundary: {
        sourceQueries: 0,
        metadataRecords: 0,
        retainedMetadataRecordCount: 0,
      },
      scholarlyMetadataRecordIds: [],
      evidenceStatus: {
        suppliedWorks: "not_inspected",
        scholarlyMetadata: "not_retrieved",
        scholarlyText: "partially_inspected",
      },
      claimBoundary: "No automatic scholarly claim was created.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["execution"]>;
    workspace.documentAcquisitions = [{
      id: "scholarly-acquisition-claim-render",
      ordinal: 1,
      outcome: "passage_retained",
      note: "One eligible partial-text passage.",
      document: {
        canonicalUrl: "https://fixtures.example/article",
        title: "Participation and adaptation",
        inspectionStatus: "partial_text",
        normalizedTextHash: `sha256:${"a".repeat(64)}`,
      },
      passage: {
        id: "scholarly-passage-claim-render",
        passageFingerprint: "fnv1a64:8888888888888888",
        locator: "normalized offsets 10-49",
        exactText: "Organizations reevaluated participation costs.",
        qualification: "Adjacent setting only.",
        quoteHash: `sha256:${"b".repeat(64)}`,
        detailedClaimUse: "eligible_for_later_researcher_review",
      },
    }] as MechanismLiteratureWorkspace["documentAcquisitions"];
    workspace.passagePacket = {
      passageReferences: [{
        passageId: "scholarly-passage-claim-render",
      }],
      eligiblePassageIds: ["scholarly-passage-claim-render"],
      claimBoundary: "Eligible only for later researcher review.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["passagePacket"]>;
    workspace.claimExtractions = [{
      id: "scholarly-claim-extraction-render",
      ordinal: 1,
      extractionFingerprint: "fnv1a64:9999999999999999",
      passageReference: {
        passageId: "scholarly-passage-claim-render",
        exactText: "Organizations reevaluated participation costs.",
      },
      fields: {
        theoreticalProposition:
          "Participation rules may change organizational cost evaluation.",
        empiricalSetting: "Regulated market participants",
        levelOfAnalysis: "Organization",
        measuredVariables: ["perceived participation cost"],
        relevantResultOrQualification: "No focal-policy effect was estimated.",
        contextualFit: {
          assessment: "adjacent_setting",
          rationale: "The source studies an adjacent regulated market.",
        },
        evidenceLevel: "empirical_evidence_different_setting",
        fieldProvenance: "researcher_supplied",
      },
    }] as MechanismLiteratureWorkspace["claimExtractions"];
    workspace.claimPacket = {
      detailedClaims: {
        status: "extracted_pending_review",
        acceptedCount: 0,
      },
      acceptedClaimReferences: [],
      claimBoundary:
        "Researcher-authored claims remain separate from later mechanism synthesis.",
    } as unknown as NonNullable<MechanismLiteratureWorkspace["claimPacket"]>;

    const markup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      {
        workspace,
        study: fixture.state.study,
        disabled: false,
        canContinue: false,
        canInspect: false,
        canExtractClaim: true,
        canReviewClaim: true,
        canPrepareSynthesisInput: false,
        canSaveMechanismReview: false,
        onSave: vi.fn(async () => undefined),
        onContinue: vi.fn(async () => undefined),
        onInspect: vi.fn(async () => undefined),
        onExtractClaim: vi.fn(async () => undefined),
        onReviewClaim: vi.fn(async () => undefined),
        onPrepareSynthesisInput: vi.fn(async () => undefined),
        onSaveMechanismReview: vi.fn(async () => undefined),
      },
    ));

    expect(markup).toContain("Extraction and review history");
    expect(markup).toContain("Participation rules may change organizational cost evaluation.");
    expect(markup).toContain("empirical evidence different setting");
    expect(markup).toContain("Accept");
    expect(markup).toContain("Reject");
    expect(markup).toContain("Defer");
    expect(markup).toContain("Correct and accept");
    expect(markup).toContain("Record explicit researcher decision");
    expect(markup).toContain("Researcher-authored claims remain separate");
  });

  it("offers a deterministic accepted-input freeze and labels the frozen packet as nonsynthesis", () => {
    const { fixture, workspace } = savedWorkspace();
    workspace.claimPacket = {
      packetFingerprint: "fnv1a64:1212121212121212",
      acceptedClaimReferences: [{ extractionId: "accepted-claim" }],
    } as unknown as NonNullable<MechanismLiteratureWorkspace["claimPacket"]>;
    const props = {
      workspace,
      study: fixture.state.study,
      disabled: false,
      canContinue: false,
      canInspect: false,
      canExtractClaim: false,
      canReviewClaim: false,
      canPrepareSynthesisInput: true,
      canSaveMechanismReview: false,
      onSave: vi.fn(async () => undefined),
      onContinue: vi.fn(async () => undefined),
      onInspect: vi.fn(async () => undefined),
      onExtractClaim: vi.fn(async () => undefined),
      onReviewClaim: vi.fn(async () => undefined),
      onPrepareSynthesisInput: vi.fn(async () => undefined),
      onSaveMechanismReview: vi.fn(async () => undefined),
    };
    const pendingMarkup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      props,
    ));
    expect(pendingMarkup).toContain("Frozen synthesis inputs");
    expect(pendingMarkup).toContain("Freeze reviewed synthesis inputs");
    expect(pendingMarkup).toContain(
      "Rejected, deferred, abstract-only, and metadata-only material will be excluded.",
    );
    expect(pendingMarkup).toContain("makes no network or model call");

    workspace.synthesisInputPacket = {
      preparation: { networkRequests: 0, modelCalls: 0 },
      study: {
        outcome: fixture.state.study.outcome,
        intendedConstruct: fixture.state.study.intendedConstruct,
      },
      researcherContext: {
        initialExplanation: {
          mode: "stated",
          text: "The participation process may reduce barriers to market entry.",
        },
        knownAlternativeAccounts: ["concurrent market redesign"],
      },
      policyPremises: workspace.plan!.policyPremises,
      acceptedScholarlyClaims: [{
        extractionReference: {
          extractionId: "accepted-claim",
          extractionFingerprint: "fnv1a64:3434343434343434",
        },
        reviewReference: {
          reviewId: "accepted-review",
          reviewFingerprint: "fnv1a64:5656565656565656",
          decision: "accepted",
        },
        reviewedFields: {
          theoreticalProposition:
            "Participation rules may change organizational adaptation.",
          relevantResultOrQualification: null,
          evidenceLevel: "established_theoretical_argument",
        },
        sourceLineage: {
          documentReference: { title: "Participation and adaptation" },
          passageReference: {
            exactText: "Organizations reevaluated participation costs.",
            locator: "normalized offsets 10-49",
            quoteHash: `sha256:${"b".repeat(64)}`,
          },
        },
      }],
      knownConstraints: {
        designReview: "available",
        coEventReview: "occurrence_work_only",
        coEventRelationAnalysis: "not_assessed",
      },
      claimBoundary:
        "Frozen accepted inputs are not a mechanism, prediction, measure, or estimate.",
    } as unknown as NonNullable<
      MechanismLiteratureWorkspace["synthesisInputPacket"]
    >;
    const frozenMarkup = renderToStaticMarkup(createElement(
      MechanismLiteraturePlanPanel,
      { ...props, canPrepareSynthesisInput: false },
    ));
    expect(frozenMarkup).toContain("inputs frozen · synthesis blocked");
    expect(frozenMarkup).toContain("made 0 network requests and 0 model calls");
    expect(frozenMarkup).toContain(
      "Participation rules may change organizational adaptation.",
    );
    expect(frozenMarkup).toContain(
      "Frozen accepted inputs are not a mechanism, prediction, measure, or estimate.",
    );
  });
});
