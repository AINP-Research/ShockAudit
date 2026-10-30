import { alignScopeContractToSentence } from "./scope-alignment";
import type {
  Ambiguity,
  DecisionKey,
  Mode,
  ScopeAlignmentAcknowledgment,
  ScopeAlignmentResult,
  ScopeContract,
  Screen01State,
} from "./scope-types";
import { fieldKeys } from "./scope-types";
import {
  getAmbiguities,
  validateSentence,
  validateScopeInputLines,
  validateStudyPeriod,
} from "./scope-validation";

export type ConfirmScopeInput = {
  revision: number;
  mode: Mode;
  sentence: string;
  contractSourceSentence: string;
  scope: ScopeContract;
  knownShock: string;
  resolvedKeys: DecisionKey[];
  acknowledgedDifferences?: ScopeAlignmentAcknowledgment[];
  scopeDirty: boolean;
};

export type ConfirmScopeResult = {
  ok: boolean;
  error: string;
  state: Screen01State;
  ambiguities: Ambiguity[];
};

export type ConfirmScopeContractResult = ConfirmScopeResult & {
  alignment: ScopeAlignmentResult;
};

export function confirmScopeContract(
  input: ConfirmScopeInput,
): ConfirmScopeContractResult {
  const sentence = input.sentence.trim();
  const scope = Object.fromEntries(
    fieldKeys.map((key) => [key, input.scope[key].trim()]),
  ) as ScopeContract;
  const knownShock =
    input.mode === "audit" ? input.knownShock.trim() : "";
  const allowedResolvedKeys = new Set<DecisionKey>([
    ...fieldKeys,
    ...(input.mode === "audit" ? (["knownShock"] as const) : []),
  ]);
  const resolvedKeys = [...new Set(input.resolvedKeys)].filter((key) =>
    allowedResolvedKeys.has(key),
  );

  const sentenceError = validateSentence(sentence);
  const contractSourceSentence = input.contractSourceSentence.trim();
  const scopeInputError = validateScopeInputLines({
    sentence,
    scope,
    mode: input.mode,
    knownShock,
  });
  const periodError = validateStudyPeriod(scope.studyPeriod);
  const ambiguities = getAmbiguities({
    scope,
    mode: input.mode,
    sentence,
    knownShock,
    resolvedKeys,
  });
  const alignment = alignScopeContractToSentence({
    sentence,
    scope,
    acknowledgedDifferences: input.acknowledgedDifferences,
  });
  const alignmentError = alignment.blockingMismatches.length
    ? `Resolve ${alignment.blockingMismatches.length} description and Scope Contract ${
        alignment.blockingMismatches.length === 1 ? "mismatch" : "mismatches"
      } before confirming the scope.`
    : "";

  const error =
    sentenceError ||
    scopeInputError ||
    periodError ||
    (ambiguities.length
      ? `Resolve ${ambiguities.length} scope ${
          ambiguities.length === 1 ? "decision" : "decisions"
        } before confirming the scope.`
      : "") ||
    alignmentError;
  const confirmed = !error;

  return {
    ok: confirmed,
    error,
    ambiguities,
    alignment,
    state: {
      revision: input.revision,
      mode: input.mode,
      sentence,
      contractSourceSentence: confirmed ? sentence : contractSourceSentence,
      scope,
      knownShock,
      resolvedKeys,
      acknowledgedDifferences: alignment.acknowledgedDifferences,
      scopeDirty: confirmed ? false : input.scopeDirty,
      confirmed,
    },
  };
}
