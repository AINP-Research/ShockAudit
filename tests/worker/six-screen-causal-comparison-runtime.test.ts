import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

describe("durable Screen 3 causal-comparison runtime", () => {
  it("persists a source-linked Design Set and researcher decision across status reads", async () => {
    const fixture = createBrowserEventCardFixture();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    const evidenceStore = new SixScreenEvidenceStore(storage);
    const taskStore = new SixScreenResearchTaskStore(storage);
    await store.create({
      state: fixture.state,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue(
        "screen-3-runtime-fixture",
      ),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    await evidenceStore.create({
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
      snapshot: fixture.evidenceSnapshot,
      collection: fixture.collection,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    let tick = 6;
    let coEventProviderCalls = 0;
    let lifecycleDocumentCalls = 0;
    const runtime = new SixScreenWorkflowRuntime({
      store,
      evidenceStore,
      taskStore,
      signingKey: "screen-3-runtime-test-key-with-more-than-thirty-two-bytes",
      now: () => browserEventCardFixtureAt(tick++),
      fetch: async (request) => {
        if (String(request).includes("/documents/full_text/")) {
          lifecycleDocumentCalls += 1;
          if (lifecycleDocumentCalls <= 2) {
            return new Response(null, { status: 503 });
          }
          return new Response(`<!doctype html><html><body><main>
            <p>This implementation order cites focal rule 2020-12345 and retains a later schedule for review.</p>
            <p>[FR Doc. 2021-54321 Filed 6-18-21; 8:45 am]</p>
          </main></body></html>`, {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        }
        coEventProviderCalls += 1;
        if (coEventProviderCalls === 1) {
          return new Response(null, { status: 503 });
        }
        return new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: "2021-54321",
            title: "Capacity Market Reliability Implementation Rule",
            type: "Rule",
            abstract:
              "The commission reported a capacity-market implementation change.",
            action: "Final rule.",
            excerpts: ["A capacity-market implementation change was reported."],
            html_url:
              "https://www.federalregister.gov/documents/2021/06/21/2021-54321/example",
            publication_date: "2021-06-21",
            effective_on: "2021-07-21",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const authentication = {
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
    };

    let workflowRevision = fixture.state.revision;
    let reviewOutcome = await runtime.beginPolicyEventCardReview(
      authentication,
      {
        expectedRevision: workflowRevision,
        operationId: "screen-3-runtime-review",
      },
    );
    workflowRevision = reviewOutcome.privateSnapshot.revision;
    let review = reviewOutcome.review;
    for (const claim of review.claimReviews) {
      reviewOutcome = await runtime.reviewPolicyEventCardClaim(
        authentication,
        {
          expectedRevision: workflowRevision,
          operationId: `screen-3-runtime-claim-${claim.claimId}`,
          reviewId: review.id,
          expectedReviewRevision: review.revision,
          expectedReviewFingerprint: review.reviewFingerprint,
          claimId: claim.claimId,
          decision: "accepted",
          rationale:
            "Retain this exact source-linked premise for conditional comparison construction.",
        },
      );
      workflowRevision = reviewOutcome.privateSnapshot.revision;
      review = reviewOutcome.review;
    }
    const clock = await runtime.decidePolicyTreatmentClock(
      authentication,
      {
        expectedRevision: workflowRevision,
        operationId: "screen-3-runtime-clock",
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        decision: { mode: "no_selection" },
        rationale:
          "No retained legal clock yet establishes unit-level policy treatment.",
      },
    );
    workflowRevision = clock.privateSnapshot.revision;
    review = clock.review;
    const locked = await runtime.lockPolicyEventCard(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-3-runtime-lock",
      reviewId: review.id,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      rationale:
        "Lock the reviewed evidence while preserving the unresolved treatment clock.",
    });
    workflowRevision = locked.privateSnapshot.revision;
    expect(locked.projection.screen3Prerequisites).toMatchObject({
      ready: true,
      currentEventCardSnapshotId: locked.eventCard.snapshotId,
    });

    const opened = await runtime.openScreen3(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-3-runtime-open",
    });
    workflowRevision = opened.privateSnapshot.revision;
    expect(opened.projection).toMatchObject({
      activeScreen: 3,
      canBuildCausalComparison: true,
    });
    const built = await runtime.buildCausalComparison(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-3-runtime-build",
      comparisonInput: {
        policyTarget: "full_policy_package",
        targetDetail: null,
        targetClaimIds: ["claim-operative"],
        variationClaimIds: ["claim-coverage"],
        assignmentUnit: "Operator",
        proposedTreatedGroup: "Covered market operators",
        proposedComparisonGroup:
          "Otherwise comparable uncovered market operators",
        dataAvailability: "partially_available",
        dataFrequency: "annual",
        historicalEligibilityFields: ["historical_coverage_status"],
        designConstraints: [],
      },
    });
    workflowRevision = built.privateSnapshot.revision;
    const designSet = built.projection.causalComparisonWorkspace.designSet!;
    expect(designSet).toMatchObject({
      status: "options_available",
      binding: {
        eventCardReference: {
          eventCardSnapshotId: locked.eventCard.snapshotId,
        },
      },
      options: [{
        family: "difference_in_differences",
        supportingEvidence: expect.arrayContaining([
          expect.objectContaining({
            claimId: "claim-coverage",
            passageIds: ["passage-coverage"],
            sourceIds: ["source-provider-neutral-official-fixture"],
          }),
        ]),
      }],
    });
    expect(designSet.options[0]!.unsupportedClaims.join(" ")).toMatch(
      /parallel trends|caused/iu,
    );

    const decided = await runtime.decideCausalComparison(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-3-runtime-decision",
      designSetSnapshotId: designSet.snapshotId,
      expectedDesignSetFingerprint: designSet.designSetFingerprint,
      decision: {
        mode: "selected",
        optionId: designSet.options[0]!.id,
      },
      rationale:
        "Carry the conditional comparison forward while testing every stated assumption.",
    });
    expect(decided.projection).toMatchObject({
      activeScreen: 3,
      canDecideCausalComparison: false,
      causalComparisonWorkspace: {
        designSet: { snapshotId: designSet.snapshotId },
        decision: {
          actor: "researcher",
          decision: "selected",
          selectedDesign: {
            status: "selected_for_review",
            sourceOptionStatus: "needs_institutional_review",
          },
        },
      },
    });

    workflowRevision = decided.privateSnapshot.revision;
    const screen4 = await runtime.openScreen4(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-4-runtime-open",
    });
    workflowRevision = screen4.privateSnapshot.revision;
    expect(screen4.projection).toMatchObject({
      activeScreen: 4,
      canOpenScreen4: true,
      canSaveCoEventSearchMatrix: true,
      screen4Prerequisites: {
        ready: true,
        mode: "targeted",
        currentDesignSetSnapshotId: designSet.snapshotId,
        currentDesignDecisionSnapshotId:
          decided.projection.causalComparisonWorkspace.decision!.snapshotId,
      },
    });
    const matrixOutcome = await runtime.saveCoEventSearchMatrix(
      authentication,
      {
        expectedRevision: workflowRevision,
        operationId: "screen-4-runtime-matrix",
        scopeInput: {
          anticipationLookback: { amount: 18, unit: "months" },
          contextLookforward: { amount: 1, unit: "years" },
          knownCoEvents: ["Regional reimbursement reform"],
          importantEntities: [
            { kind: "regulator", label: "Regional market regulator" },
          ],
          includeMeasurementChanges: true,
        },
      },
    );
    expect(matrixOutcome.projection).toMatchObject({
      activeScreen: 4,
      statusMessage: expect.stringMatching(/retrieval.*not run/iu),
      coEventSearchWorkspace: {
        matrix: {
          mode: "targeted",
          rows: expect.arrayContaining([
            expect.objectContaining({
              branch: "comparison_spillover",
              outcome: { status: "not_started", candidateCount: 0, note: null },
            }),
          ]),
          execution: {
            status: "planned",
            executedRowIds: [],
            unavailableProviderIds: [],
            unavailableLanguages: [],
            actualSearchBoundary: null,
          },
        },
        revisions: [expect.objectContaining({
          ordinal: 1,
          mode: "targeted",
          rowCount: 6,
          artifactStatus: "current",
        })],
      },
    });

    workflowRevision = matrixOutcome.privateSnapshot.revision;
    const attempted = await runtime.continueCoEventSearch(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-4-runtime-provider-step",
    });
    expect(attempted.projection).toMatchObject({
      activeScreen: 4,
      canContinueCoEventSearch: true,
      coEventSearchWorkspace: {
        executionPlan: {
          sourceQueryCeiling: 24,
          metadataCandidateCeiling: 100,
          continuationMode: "panel_driven",
        },
        execution: {
          status: "active",
          attempt: {
            providerId: "federal_register",
            outcome: "source_unavailable",
            failureCode: expect.any(String),
            candidateOccurrenceIds: [],
          },
          actualSearchBoundary: {
            sourceQueries: 1,
            retainedCandidateCount: 0,
            stopReason: null,
          },
          semanticRelationAnalysis: {
            status: "blocked",
            reason: "genuine_intelligence_path_unverified",
          },
        },
        attempts: [expect.objectContaining({
          outcome: "source_unavailable",
        })],
        candidates: [],
      },
    });
    expect(attempted.projection.statusMessage).toMatch(
      /bounded provider outcome.*continue explicitly/iu,
    );
    const replayed = await runtime.continueCoEventSearch(authentication, {
      expectedRevision: workflowRevision,
      operationId: "screen-4-runtime-provider-step",
    });
    expect(replayed.replayed).toBe(true);
    expect(replayed.privateSnapshot.revision).toBe(
      attempted.privateSnapshot.revision,
    );

    const restored = await runtime.status(authentication);
    expect(restored.projection.causalComparisonWorkspace).toEqual(
      decided.projection.causalComparisonWorkspace,
    );
    expect(restored.projection.coEventSearchWorkspace).toEqual(
      attempted.projection.coEventSearchWorkspace,
    );
    expect(restored.privateSnapshot.state.causalDesignSets).toHaveLength(1);
    expect(restored.privateSnapshot.state.causalDesignDecisions).toHaveLength(1);
    expect(restored.privateSnapshot.state.coEventSearchMatrices).toHaveLength(1);
    expect(restored.privateSnapshot.state.coEventExecutionPlans).toHaveLength(1);
    expect(restored.privateSnapshot.state.coEventSearchExecutions).toHaveLength(1);

    const found = await runtime.continueCoEventSearch(authentication, {
      expectedRevision: attempted.privateSnapshot.revision,
      operationId: "screen-4-runtime-provider-candidate",
    });
    const candidate = found.projection.coEventSearchWorkspace.candidates[0]!;
    expect(candidate).toMatchObject({
      title: "Capacity Market Reliability Implementation Rule",
      occurrenceStatus: "source_metadata_documented",
      relationToComparison: { status: "not_assessed" },
    });
    expect(found.projection.canReviewCoEventOccurrence).toBe(true);
    const reviewed = await runtime.reviewCoEventOccurrence(authentication, {
      expectedRevision: found.privateSnapshot.revision,
      operationId: "screen-4-runtime-occurrence-review",
      candidateId: candidate.id,
      expectedCandidateFingerprint: candidate.candidateFingerprint,
      decision: {
        mode: "corrected",
        correction: {
          title: "Capacity Market Reliability Effective Rule",
          typedDates: [{ kind: "effective", value: "2021-07-21" }],
          affectedActivityOrPopulationLabels: ["Regional market operators"],
          geographyLabels: [],
        },
      },
      rationale:
        "Keep this researcher correction separate from immutable provider metadata.",
    });
    expect(reviewed.projection.coEventSearchWorkspace).toMatchObject({
      candidates: [expect.objectContaining({
        id: candidate.id,
        title: candidate.title,
      })],
      occurrenceReviews: [expect.objectContaining({
        decision: "corrected",
        correction: expect.objectContaining({
          provenance: "researcher_supplied",
        }),
        relationAssessment: expect.objectContaining({
          status: "not_assessed",
        }),
      })],
    });
    const replayedReview = await runtime.reviewCoEventOccurrence(
      authentication,
      {
        expectedRevision: found.privateSnapshot.revision,
        operationId: "screen-4-runtime-occurrence-review",
        candidateId: candidate.id,
        expectedCandidateFingerprint: candidate.candidateFingerprint,
        decision: {
          mode: "corrected",
          correction: {
            title: "Capacity Market Reliability Effective Rule",
            typedDates: [{ kind: "effective", value: "2021-07-21" }],
            affectedActivityOrPopulationLabels: ["Regional market operators"],
            geographyLabels: [],
          },
        },
        rationale:
          "Keep this researcher correction separate from immutable provider metadata.",
      },
    );
    expect(replayedReview.replayed).toBe(true);
    expect(replayedReview.privateSnapshot.revision).toBe(
      reviewed.privateSnapshot.revision,
    );

    const occurrenceReview =
      reviewed.projection.coEventSearchWorkspace.occurrenceReviews.at(-1)!;
    const routed = await runtime.routeCoEventPolicyStageToScreen2(
      authentication,
      {
        expectedRevision: reviewed.privateSnapshot.revision,
        operationId: "screen-4-runtime-policy-stage-handoff",
        candidateId: candidate.id,
        expectedCandidateFingerprint: candidate.candidateFingerprint,
        expectedOccurrenceReviewId: occurrenceReview.id,
        expectedOccurrenceReviewFingerprint:
          occurrenceReview.reviewFingerprint,
        stageKind: "implementation_delay",
        rationale:
          "This retained implementation record may be a later stage of the focal policy and needs source-grounded Event Card review.",
      },
    );
    expect(routed.projection).toMatchObject({
      activeScreen: 2,
      statusMessage: expect.stringMatching(
        /source-preserving Event Card revision.*possible focal-policy stage/iu,
      ),
      canOpenScreen3: true,
      canOpenScreen4: false,
      policyEventCardWorkspace: {
        availability: "ready",
        reviewStatus: "pending_revision",
        activeReview: {
          status: "in_review",
          ordinal: 2,
          lockedEventCard: null,
        },
      },
      coEventSearchWorkspace: {
        matrix: null,
        execution: null,
        candidates: [],
        policyLifecycleHandoffs: [expect.objectContaining({
          handoff: expect.objectContaining({
            proposedStage: {
              kind: "implementation_delay",
              status: "researcher_proposed_for_review",
            },
            preservesSourceOccurrence: true,
            preservesPriorEventCard: true,
            independentEventClassification: "not_assessed",
            relationToComparison: expect.objectContaining({
              status: "not_assessed",
            }),
          }),
          candidate: expect.objectContaining({
            id: candidate.id,
            title: candidate.title,
          }),
          occurrenceReview: expect.objectContaining({
            id: occurrenceReview.id,
            decision: "corrected",
            correction: expect.objectContaining({
              provenance: "researcher_supplied",
            }),
          }),
          targetReviewStatus: "pending_event_card_review",
        })],
      },
    });
    expect(routed.privateSnapshot.state.coEventCandidates).toContainEqual(
      candidate,
    );
    expect(routed.handoff.claimBoundary).toMatch(
      /does not verify.*does not create an independent co-event/iu,
    );
    expect(routed.privateSnapshot.state.artifacts.filter(
      ({ screen }) => screen === 3 || screen === 4,
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ screen: 3, status: "out_of_date" }),
      expect.objectContaining({ screen: 4, status: "out_of_date" }),
    ]));

    const restoredAfterHandoff = await runtime.status(authentication);
    expect(restoredAfterHandoff.projection).toEqual(routed.projection);
    const replayedHandoff = await runtime.routeCoEventPolicyStageToScreen2(
      authentication,
      {
        expectedRevision: reviewed.privateSnapshot.revision,
        operationId: "screen-4-runtime-policy-stage-handoff",
        candidateId: candidate.id,
        expectedCandidateFingerprint: candidate.candidateFingerprint,
        expectedOccurrenceReviewId: occurrenceReview.id,
        expectedOccurrenceReviewFingerprint:
          occurrenceReview.reviewFingerprint,
        stageKind: "implementation_delay",
        rationale:
          "This retained implementation record may be a later stage of the focal policy and needs source-grounded Event Card review.",
      },
    );
    expect(replayedHandoff.replayed).toBe(true);
    expect(replayedHandoff.privateSnapshot.revision).toBe(
      routed.privateSnapshot.revision,
    );
    expect(replayedHandoff.handoff).toEqual(routed.handoff);

    const targetReviewBeforeAcquisition = structuredClone(
      routed.privateSnapshot.state.policyEventCardReviews!.at(-1),
    );
    const artifactsBeforeAcquisition = structuredClone(
      routed.privateSnapshot.state.artifacts,
    );
    const unavailable = await runtime.acquirePolicyLifecycleStageDocument(
      authentication,
      {
        expectedRevision: routed.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-document-unavailable",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
      },
    );
    expect(unavailable.acquisition).toMatchObject({
      ordinal: 1,
      outcome: "source_unavailable",
      failureCode: "source_unavailable",
      source: null,
      usage: { documentAttempts: 2, usefulDocuments: 0 },
    });
    expect(unavailable.projection.policyLifecycleStageReviewWorkspace)
      .toMatchObject({
        entries: [expect.objectContaining({
          canAcquire: true,
          canRetry: true,
          canDispose: false,
        })],
      });
    expect(unavailable.privateSnapshot.state.policyEventCardReviews!.at(-1))
      .toEqual(targetReviewBeforeAcquisition);
    expect(unavailable.privateSnapshot.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );

    const acquired = await runtime.acquirePolicyLifecycleStageDocument(
      authentication,
      {
        expectedRevision: unavailable.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-document-retry",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
      },
    );
    expect(acquired.acquisition).toMatchObject({
      ordinal: 2,
      outcome: "document_retained",
      failureCode: null,
      chronologyMutation: "none",
      eventCardMutation: "none",
      source: {
        nativeDocumentNumber: "2021-54321",
        focalPolicyReferenceStatus: "exact_identifier_found",
        inspectedText: "partial",
      },
    });
    expect(acquired.projection).toMatchObject({
      activeScreen: 2,
      statusMessage: expect.stringMatching(
        /retained bounded exact official-document passages/iu,
      ),
      policyLifecycleStageReviewWorkspace: {
        entries: [expect.objectContaining({
          handoffId: routed.handoff.id,
          canAcquire: false,
          canRetry: false,
          canDispose: true,
          latestAcquisition: expect.objectContaining({
            id: acquired.acquisition.id,
            outcome: "document_retained",
          }),
          latestDisposition: null,
        })],
      },
    });
    expect(acquired.privateSnapshot.state.policyEventCardReviews!.at(-1))
      .toEqual(targetReviewBeforeAcquisition);
    expect(acquired.privateSnapshot.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );

    const replayedAcquisition =
      await runtime.acquirePolicyLifecycleStageDocument(authentication, {
        expectedRevision: unavailable.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-document-retry",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
      });
    expect(replayedAcquisition.replayed).toBe(true);
    expect(replayedAcquisition.acquisition).toEqual(acquired.acquisition);
    expect(replayedAcquisition.privateSnapshot.revision).toBe(
      acquired.privateSnapshot.revision,
    );
    await expect(runtime.acquirePolicyLifecycleStageDocument(authentication, {
      expectedRevision: unavailable.privateSnapshot.revision,
      operationId: "screen-2-runtime-policy-stage-document-retry",
      handoffId: routed.handoff.id,
      expectedHandoffFingerprint: "fnv1a64:0000000000000000",
    })).rejects.toThrow(/replay is invalid/iu);

    const disposed = await runtime.reviewPolicyLifecycleStageDocument(
      authentication,
      {
        expectedRevision: acquired.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-disposition",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
        acquisitionId: acquired.acquisition.id,
        expectedAcquisitionFingerprint:
          acquired.acquisition.acquisitionFingerprint,
        decision: "accepted_for_event_card_review",
        rationale:
          "The exact focal-policy identifier appears in the retained official passage; accept it for later Event Card review without changing the card yet.",
      },
    );
    expect(disposed.disposition).toMatchObject({
      decision: "accepted_for_event_card_review",
      legalVerificationStatus: "researcher_decision_not_legal_verification",
      chronologyMutation: "none",
      eventCardMutation: "none",
    });
    expect(disposed.projection).toMatchObject({
      statusMessage: expect.stringMatching(
        /researcher's accepted for event card review decision/iu,
      ),
      policyLifecycleStageReviewWorkspace: {
        entries: [expect.objectContaining({
          latestDisposition: expect.objectContaining({
            decision: "accepted_for_event_card_review",
          }),
        })],
      },
    });
    expect(disposed.privateSnapshot.state.policyEventCardReviews!.at(-1))
      .toEqual(targetReviewBeforeAcquisition);
    expect(disposed.privateSnapshot.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );
    const restoredAfterDisposition = await runtime.status(authentication);
    expect(restoredAfterDisposition.projection).toEqual(disposed.projection);

    const stageEntry = disposed.projection.policyLifecycleStageReviewWorkspace!
      .entries[0]!;
    expect(stageEntry).toMatchObject({
      canProposeRevision: true,
      canReviewRevision: false,
      latestProposal: null,
      sourceDateOptions: expect.arrayContaining([
        expect.objectContaining({
          origin: "publication_metadata",
          typedDate: expect.objectContaining({
            start: "2021-06-21",
            kind: "publication",
          }),
        }),
      ]),
      chronologyStageOptions: ["implementation"],
    });
    const publicationDate = stageEntry.sourceDateOptions.find(
      ({ origin }) => origin === "publication_metadata",
    )!;
    const proposed = await runtime.proposePolicyLifecycleStageRevision(
      authentication,
      {
        expectedRevision: disposed.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-proposal",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
        dispositionId: disposed.disposition.id,
        expectedDispositionFingerprint:
          disposed.disposition.dispositionFingerprint,
        chronologyStage: "implementation",
        sourceDateId: publicationDate.id,
        rationale:
          "Propose this official publication-dated record as an implementation stage without retyping the date.",
      },
    );
    expect(proposed.proposal).toMatchObject({
      stage: {
        chronologyStage: "implementation",
        sourceDateId: publicationDate.id,
        sourceTypedDate: expect.objectContaining({
          start: "2021-06-21",
          kind: "publication",
        }),
      },
      chronologyMutation: "proposal_only",
      eventCardMutation: "proposal_only",
    });
    expect(proposed.projection.policyLifecycleStageReviewWorkspace)
      .toMatchObject({
        entries: [expect.objectContaining({
          canDispose: false,
          canProposeRevision: false,
          canReviewRevision: true,
          latestProposal: expect.objectContaining({
            id: proposed.proposal.id,
          }),
          latestProposalReview: null,
        })],
      });
    expect(proposed.privateSnapshot.state.policyEventCardReviews!.at(-1))
      .toEqual(targetReviewBeforeAcquisition);
    expect(proposed.privateSnapshot.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );
    const replayedProposal =
      await runtime.proposePolicyLifecycleStageRevision(authentication, {
        expectedRevision: disposed.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-proposal",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
        dispositionId: disposed.disposition.id,
        expectedDispositionFingerprint:
          disposed.disposition.dispositionFingerprint,
        chronologyStage: "implementation",
        sourceDateId: publicationDate.id,
        rationale:
          "Propose this official publication-dated record as an implementation stage without retyping the date.",
      });
    expect(replayedProposal.replayed).toBe(true);
    expect(replayedProposal.proposal).toEqual(proposed.proposal);

    const proposalReview =
      await runtime.reviewPolicyLifecycleStageRevision(authentication, {
        expectedRevision: proposed.privateSnapshot.revision,
        operationId: "screen-2-runtime-policy-stage-proposal-review",
        proposalId: proposed.proposal.id,
        expectedProposalFingerprint: proposed.proposal.proposalFingerprint,
        decision: "accepted_for_event_card_revision",
        rationale:
          "Accept this source-bound proposal only for inclusion by the later explicit Event Card lock.",
      });
    expect(proposalReview.review).toMatchObject({
      decision: "accepted_for_event_card_revision",
      chronologyMutation: "none",
      eventCardMutation: "none",
    });
    expect(proposalReview.privateSnapshot.state.policyEventCardReviews!.at(-1))
      .toEqual(targetReviewBeforeAcquisition);
    expect(proposalReview.privateSnapshot.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );
    expect(proposalReview.projection.policyLifecycleStageReviewWorkspace)
      .toMatchObject({
        entries: [expect.objectContaining({
          canReviewRevision: false,
          latestProposalReview: expect.objectContaining({
            decision: "accepted_for_event_card_revision",
          }),
        })],
      });

    let revisionForLock = proposalReview.privateSnapshot.revision;
    let reviewForLock = proposalReview.privateSnapshot.state
      .policyEventCardReviews!.at(-1)!;
    for (const claim of reviewForLock.claimReviews) {
      const decision = await runtime.reviewPolicyEventCardClaim(
        authentication,
        {
          expectedRevision: revisionForLock,
          operationId: `screen-2-runtime-policy-stage-claim-${claim.claimId}`,
          reviewId: reviewForLock.id,
          expectedReviewRevision: reviewForLock.revision,
          expectedReviewFingerprint: reviewForLock.reviewFingerprint,
          claimId: claim.claimId,
          decision: "accepted",
          rationale:
            "Accept this unchanged evidence-bound claim in the new Event Card revision.",
        },
      );
      revisionForLock = decision.privateSnapshot.revision;
      reviewForLock = decision.review;
    }
    const stageClock = await runtime.decidePolicyTreatmentClock(
      authentication,
      {
        expectedRevision: revisionForLock,
        operationId: "screen-2-runtime-policy-stage-clock",
        reviewId: reviewForLock.id,
        expectedReviewRevision: reviewForLock.revision,
        expectedReviewFingerprint: reviewForLock.reviewFingerprint,
        decision: { mode: "no_selection" },
        rationale:
          "Do not convert the accepted lifecycle stage into an automatic study treatment clock.",
      },
    );
    revisionForLock = stageClock.privateSnapshot.revision;
    reviewForLock = stageClock.review;
    const stageLocked = await runtime.lockPolicyEventCard(authentication, {
      expectedRevision: revisionForLock,
      operationId: "screen-2-runtime-policy-stage-lock",
      reviewId: reviewForLock.id,
      expectedReviewRevision: reviewForLock.revision,
      expectedReviewFingerprint: reviewForLock.reviewFingerprint,
      rationale:
        "Lock the reviewed revision with the separately accepted lifecycle-stage proposal.",
    });
    expect(stageLocked.eventCard.lifecycleStageRevisions).toEqual([
      expect.objectContaining({
        proposalReference: expect.objectContaining({
          proposalId: proposed.proposal.id,
        }),
        reviewReference: expect.objectContaining({
          reviewId: proposalReview.review.id,
          decision: "accepted_for_event_card_revision",
        }),
        sourceDateId: publicationDate.id,
        inclusionStatus: "included_by_explicit_event_card_lock",
      }),
    ]);
    expect(stageLocked.eventCard.chronology.absoluteClocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: proposed.proposal.stage.clockId,
          stage: "implementation",
        }),
      ]),
    );
    expect(stageLocked.privateSnapshot.state.policyEventCardReviews!.at(-2)!
      .lockedEventCard).toEqual(
        routed.privateSnapshot.state.policyEventCardReviews!.at(-2)!
          .lockedEventCard,
      );
    const restoredAfterStageLock = await runtime.status(authentication);
    expect(restoredAfterStageLock.projection.policyEventCardWorkspace)
      .toMatchObject({
        activeReview: {
          status: "locked",
          lockedEventCard: {
            lifecycleStageRevisions: [expect.objectContaining({
              proposalReference: { proposalId: proposed.proposal.id,
                proposalFingerprint: proposed.proposal.proposalFingerprint },
            })],
          },
        },
      });
  // This exhaustive fixture performs the complete review, lock, comparison,
  // decision, co-event, and lifecycle-revision sequence. It takes about
  // 57 seconds in isolation on the managed runner, so leave contention margin
  // without changing any application or transport deadline.
  }, 90_000);
});
