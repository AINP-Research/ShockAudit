export type Mode = "find" | "audit";

export type FieldKey =
  | "population"
  | "assignmentLevel"
  | "analysisLevel"
  | "geography"
  | "industry"
  | "studyPeriod"
  | "eventFamily"
  | "outcomeFamily"
  | "outcomeFrequency";

export type DecisionKey = FieldKey | "knownShock";

export type ScopeContract = Record<FieldKey, string>;

export type ScopeAlignmentStatus =
  | "aligned"
  | "possible-mismatch"
  | "not-inferable-from-sentence"
  | "allowed-to-remain-unspecified"
  | "researcher-acknowledged-difference";

/**
 * Acknowledgements are bound to both the current sentence and the retained
 * field value. Editing either input therefore reopens the comparison instead
 * of carrying a stale exception into a different study boundary.
 */
export type ScopeAlignmentAcknowledgment = {
  key: FieldKey;
  sentence: string;
  scopeValue: string;
};

export type ScopeFieldAlignment = {
  key: FieldKey;
  status: ScopeAlignmentStatus;
  sentenceValue: string;
  scopeValue: string;
  suggestedValue?: string;
};

export type ScopeAlignmentResult = {
  version: "screen-01-alignment-v1";
  fields: ScopeFieldAlignment[];
  blockingMismatches: ScopeFieldAlignment[];
  acknowledgedDifferences: ScopeAlignmentAcknowledgment[];
  alignedForConfirmation: boolean;
};

export type Ambiguity = {
  key: DecisionKey;
  title: string;
  question: string;
  choices?: Array<{ label: string; value: string; recommended?: boolean }>;
};

export type Screen01State = {
  revision: number;
  mode: Mode;
  sentence: string;
  contractSourceSentence: string;
  scope: ScopeContract;
  knownShock: string;
  resolvedKeys: DecisionKey[];
  acknowledgedDifferences?: ScopeAlignmentAcknowledgment[];
  scopeDirty: boolean;
  confirmed: boolean;
};

export type LegacyScreen01State = Omit<
  Screen01State,
  "revision" | "contractSourceSentence"
>;

export const fieldKeys: FieldKey[] = [
  "population",
  "assignmentLevel",
  "analysisLevel",
  "geography",
  "industry",
  "studyPeriod",
  "eventFamily",
  "outcomeFamily",
  "outcomeFrequency",
];

export const decisionKeys: DecisionKey[] = [...fieldKeys, "knownShock"];

export const SCREEN_01_CONTEXT_SCHEMA_VERSION = "1.0" as const;

/**
 * Canonical handoff from Screen 1 to ChatGPT and every later ShockAudit screen.
 * It deliberately includes both the research inputs and their validation
 * status so downstream steps never have to reconstruct or guess the scope.
 */
export type Screen01StudyContext = {
  schemaVersion: typeof SCREEN_01_CONTEXT_SCHEMA_VERSION;
  appVersion: string;
  sourceScreen: "screen-01";
  startingPoint: Mode;
  studySentence: string;
  contractSourceSentence: string;
  knownShock: string;
  scopeContract: ScopeContract;
  resolvedKeys: DecisionKey[];
  acknowledgedDifferences?: ScopeAlignmentAcknowledgment[];
  unresolvedDecisions: Ambiguity[];
  scopeDirty: boolean;
  confirmed: boolean;
  readyForLaterScreens: boolean;
  revision: number;
};

export type Screen01WidgetSnapshot = {
  state: Screen01State;
  draftsByMode: Partial<Record<Mode, Screen01State>>;
  ambiguities: Ambiguity[];
  studyContext: Screen01StudyContext;
};
