import { confirmScopeContract } from "./screen01-scope-confirmation";
import { alignScopeContractToSentence } from "./scope-alignment";
import type {
  Ambiguity,
  DecisionKey,
  Screen01State,
  Screen01StudyContext,
} from "./scope-types";
import {
  decisionKeys,
  SCREEN_01_CONTEXT_SCHEMA_VERSION,
} from "./scope-types";
import { SHOCKAUDIT_VERSION } from "./shockaudit-version";
import { canonicalizeScreen01StudyContext } from "./screen01-context-codec";
import { serializeDeterministicJson } from "./screen02-deterministic-json";

export { canonicalizeScreen01StudyContext } from "./screen01-context-codec";

const decisionKeySet = new Set<DecisionKey>(decisionKeys);
function isSupportedScreen01ProducerVersion(version: string) {
  if (version === "0.1.1" || version === SHOCKAUDIT_VERSION) return true;
  const match = /^0\.(2|3|4)\.(0|[1-9]\d*)$/u.exec(version);
  if (!match) return false;
  const patch = Number(match[2]);
  return match[1] === "2"
    ? patch <= 29
    : match[1] === "3"
      ? patch <= 17
      : patch <= 1;
}

export function isDecisionKey(value: unknown): value is DecisionKey {
  return typeof value === "string" && decisionKeySet.has(value as DecisionKey);
}

export function buildScreen01StudyContext(
  state: Screen01State,
  ambiguities: Ambiguity[],
): Screen01StudyContext {
  const alignment = alignScopeContractToSentence({
    sentence: state.sentence,
    scope: state.scope,
    acknowledgedDifferences: state.acknowledgedDifferences,
  });
  return canonicalizeScreen01StudyContext({
    schemaVersion: SCREEN_01_CONTEXT_SCHEMA_VERSION,
    appVersion: SHOCKAUDIT_VERSION,
    sourceScreen: "screen-01",
    startingPoint: state.mode,
    studySentence: state.sentence,
    contractSourceSentence: state.contractSourceSentence,
    knownShock: state.knownShock,
    scopeContract: state.scope,
    resolvedKeys: state.resolvedKeys,
    ...(alignment.acknowledgedDifferences.length
      ? {
          acknowledgedDifferences:
            alignment.acknowledgedDifferences,
        }
      : {}),
    unresolvedDecisions: ambiguities,
    scopeDirty: state.scopeDirty,
    confirmed: state.confirmed,
    readyForLaterScreens:
      state.confirmed &&
      !state.scopeDirty &&
      ambiguities.length === 0 &&
      alignment.alignedForConfirmation,
    revision: state.revision,
  });
}

/**
 * Later screens should call this gate before using Screen 1 inputs. The model
 * may transport the object, but only ShockAudit confirmation can make it ready.
 */
export function requireReadyScreen01Context(
  context: Screen01StudyContext,
): Screen01StudyContext {
  if (
    context.schemaVersion !== SCREEN_01_CONTEXT_SCHEMA_VERSION ||
    !isSupportedScreen01ProducerVersion(context.appVersion) ||
    context.sourceScreen !== "screen-01" ||
    !Number.isSafeInteger(context.revision) ||
    context.revision < 0 ||
    !context.confirmed ||
    context.scopeDirty ||
    context.unresolvedDecisions.length > 0 ||
    !context.readyForLaterScreens
  ) {
    throw new Error(
      "Screen 1 must be confirmed without unresolved scope decisions before continuing.",
    );
  }
  const validation = confirmScopeContract({
    revision: context.revision,
    mode: context.startingPoint,
    sentence: context.studySentence,
    contractSourceSentence: context.contractSourceSentence,
    scope: context.scopeContract,
    knownShock: context.knownShock,
    resolvedKeys: context.resolvedKeys,
    acknowledgedDifferences: context.acknowledgedDifferences,
    scopeDirty: context.scopeDirty,
  });
  if (!validation.ok) {
    throw new Error(
      "Screen 1 context failed server-equivalent revalidation and cannot continue.",
    );
  }
  const revalidated = canonicalizeScreen01StudyContext({
    ...buildScreen01StudyContext(validation.state, validation.ambiguities),
    // The producer version is part of the confirmed Screen 1 baseline. A
    // later app release may validate it, but must never rewrite it.
    appVersion: context.appVersion,
  });
  if (
    serializeDeterministicJson(revalidated) !==
      serializeDeterministicJson(context)
  ) {
    throw new Error(
      "Screen 1 context changed during revalidation and cannot continue.",
    );
  }
  return revalidated;
}
