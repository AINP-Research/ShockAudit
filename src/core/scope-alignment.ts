import { draftScope } from "./scope-extractor";
import type {
  FieldKey,
  ScopeAlignmentAcknowledgment,
  ScopeAlignmentResult,
  ScopeContract,
  ScopeFieldAlignment,
} from "./scope-types";
import { fieldKeys } from "./scope-types";
import {
  fieldMatchesSentenceDraft,
  isPlaceholderValue,
} from "./scope-validation";

export const SCREEN_01_ALIGNMENT_VERSION =
  "screen-01-alignment-v1" as const;

const allowedUnspecifiedFields = new Set<FieldKey>([
  "assignmentLevel",
  "outcomeFrequency",
]);

function normalizeComparable(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createScopeAlignmentAcknowledgment(input: {
  key: FieldKey;
  sentence: string;
  scopeValue: string;
}): ScopeAlignmentAcknowledgment {
  return {
    key: input.key,
    sentence: input.sentence.trim().replace(/\s+/g, " "),
    scopeValue: input.scopeValue.trim().replace(/\s+/g, " "),
  };
}

function acknowledgmentMatches(
  acknowledgment: ScopeAlignmentAcknowledgment,
  key: FieldKey,
  sentence: string,
  scopeValue: string,
) {
  return (
    acknowledgment.key === key &&
    normalizeComparable(acknowledgment.sentence) ===
      normalizeComparable(sentence) &&
    normalizeComparable(acknowledgment.scopeValue) ===
      normalizeComparable(scopeValue)
  );
}

export function alignScopeContractToSentence(input: {
  sentence: string;
  scope: ScopeContract;
  acknowledgedDifferences?: ScopeAlignmentAcknowledgment[];
}): ScopeAlignmentResult {
  const sentence = input.sentence.trim();
  const sentenceScope = draftScope(sentence);
  const acknowledgments = input.acknowledgedDifferences ?? [];
  const acceptedAcknowledgments: ScopeAlignmentAcknowledgment[] = [];

  const fields = fieldKeys.map<ScopeFieldAlignment>((key) => {
    const sentenceValue = sentenceScope[key].trim();
    const scopeValue = input.scope[key].trim();

    if (
      allowedUnspecifiedFields.has(key) &&
      isPlaceholderValue(scopeValue)
    ) {
      return {
        key,
        status: "allowed-to-remain-unspecified",
        sentenceValue,
        scopeValue,
      };
    }

    if (isPlaceholderValue(sentenceValue)) {
      return {
        key,
        status: "not-inferable-from-sentence",
        sentenceValue,
        scopeValue,
      };
    }

    if (fieldMatchesSentenceDraft(key, sentenceValue, scopeValue)) {
      return {
        key,
        status: "aligned",
        sentenceValue,
        scopeValue,
      };
    }

    const acknowledged = acknowledgments.some((candidate) =>
      acknowledgmentMatches(candidate, key, sentence, scopeValue),
    );
    if (acknowledged) {
      acceptedAcknowledgments.push(
        createScopeAlignmentAcknowledgment({ key, sentence, scopeValue }),
      );
      return {
        key,
        status: "researcher-acknowledged-difference",
        sentenceValue,
        scopeValue,
        suggestedValue: sentenceValue,
      };
    }

    return {
      key,
      status: "possible-mismatch",
      sentenceValue,
      scopeValue,
      suggestedValue: sentenceValue,
    };
  });
  const blockingMismatches = fields.filter(
    (field) => field.status === "possible-mismatch",
  );

  return {
    version: SCREEN_01_ALIGNMENT_VERSION,
    fields,
    blockingMismatches,
    acknowledgedDifferences: acceptedAcknowledgments,
    alignedForConfirmation: blockingMismatches.length === 0,
  };
}
