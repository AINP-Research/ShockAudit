import type { SourceCapability } from
  "../../src/core/six-screen/capabilities";
import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import {
  createMechanismLiteraturePlan,
  type MechanismLiteraturePlanInput,
} from "../../src/core/six-screen/mechanism-literature-plan";

/**
 * Seeds an already-saved v1 plan for read/validation regression tests. The
 * retired workflow mutation cannot create new plans from intendedConstruct.
 */
export function createHistoricalMechanismPlan(
  source: SixScreenWorkflowState,
  input: {
    snapshotId: string;
    planInput: MechanismLiteraturePlanInput;
    capabilities: {
      openalex: SourceCapability;
      crossref: SourceCapability;
    };
    createdAt: string;
  },
) {
  const state = structuredClone(source);
  const review = [...(state.policyEventCardReviews ?? [])].reverse().find(
    (candidate) => candidate.lockedEventCard && state.artifacts.some(
      (artifact) => artifact.screen === 2 && artifact.status === "current" &&
        artifact.snapshotId === candidate.lockedEventCard?.snapshotId,
    ),
  );
  if (!review?.lockedEventCard || !state.confirmedShock) {
    throw new Error("A current locked Event Card is needed to seed a historical plan.");
  }
  const plan = createMechanismLiteraturePlan({
    snapshotId: input.snapshotId,
    ordinal: (state.mechanismLiteraturePlans?.length ?? 0) + 1,
    planInput: input.planInput,
    study: state.study,
    confirmedShock: state.confirmedShock,
    eventCard: review.lockedEventCard,
    eventCardReview: review,
    designSet: null,
    designDecision: null,
    coEventMatrix: null,
    coEventExecution: null,
    coEventRelationReviews: [],
    coEventRelationAnalysisComplete: false,
    capabilities: input.capabilities,
    createdAt: input.createdAt,
  });
  state.mechanismLiteraturePlans = [
    ...(state.mechanismLiteraturePlans ?? []),
    plan,
  ];
  state.artifacts.push({
    snapshotId: plan.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: state.confirmedShock.identityFingerprint,
      eventCardSnapshotId: review.lockedEventCard.snapshotId,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: plan.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  return { state, plan };
}
