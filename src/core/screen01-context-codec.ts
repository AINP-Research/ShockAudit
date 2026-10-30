import type {
  Ambiguity,
  ScopeAlignmentAcknowledgment,
  Screen01StudyContext,
} from "./scope-types";
import { fieldKeys, type ScopeContract } from "./scope-types";

function cloneAmbiguity(ambiguity: Ambiguity): Ambiguity {
  return {
    ...ambiguity,
    choices: ambiguity.choices?.map((choice) => ({ ...choice })),
  };
}

function cloneAcknowledgment(
  acknowledgment: ScopeAlignmentAcknowledgment,
): ScopeAlignmentAcknowledgment {
  return { ...acknowledgment };
}

function producerOrderedScopeContract(
  scope: ScopeContract,
): ScopeContract {
  return Object.fromEntries(
    fieldKeys.map((key) => [key, scope[key]]),
  ) as ScopeContract;
}

/**
 * Reconstructs the Screen 1 handoff in the property order used by every
 * released producer. Object property order is not semantically meaningful,
 * but retaining this producer order preserves existing released fingerprints
 * while normalizing any legally reordered JSON received from a host bridge.
 */
export function canonicalizeScreen01StudyContext(
  context: Screen01StudyContext,
): Screen01StudyContext {
  const acknowledgedDifferences = context.acknowledgedDifferences?.map(
    cloneAcknowledgment,
  );
  return {
    schemaVersion: context.schemaVersion,
    appVersion: context.appVersion,
    sourceScreen: context.sourceScreen,
    startingPoint: context.startingPoint,
    studySentence: context.studySentence,
    contractSourceSentence: context.contractSourceSentence,
    knownShock: context.knownShock,
    scopeContract: producerOrderedScopeContract(context.scopeContract),
    resolvedKeys: [...context.resolvedKeys],
    ...(acknowledgedDifferences?.length
      ? { acknowledgedDifferences }
      : {}),
    unresolvedDecisions: context.unresolvedDecisions.map(cloneAmbiguity),
    scopeDirty: context.scopeDirty,
    confirmed: context.confirmed,
    readyForLaterScreens: context.readyForLaterScreens,
    revision: context.revision,
  };
}
