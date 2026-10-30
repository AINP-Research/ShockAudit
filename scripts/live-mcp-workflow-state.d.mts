export type LiveWorkflowSnapshot = {
  mode?: string;
  runId: string;
  revision: number;
  stateFingerprint: string;
  stateEnvelope: unknown;
};

export function readCanonicalWorkflowState(
  snapshot: LiveWorkflowSnapshot,
  expectedMode: "find" | "audit",
): Record<string, unknown>;

export function sameCanonicalJsonValue(left: unknown, right: unknown): boolean;

export function fingerprintCanonicalJsonValue(value: unknown): string;

export function screen02ContextBridgeMismatches(
  manifest: unknown,
  label?: string,
): string[];

export function screen02HandoffCanonicalMismatches(
  state: Record<string, unknown>,
  handoff: unknown,
): string[];

export function assertScreen02HandoffMatchesCanonicalState(
  state: Record<string, unknown>,
  handoff: unknown,
  label?: string,
): void;

export const serverAssessmentFallbackReasons: readonly [
  "inference-timeout",
  "inference-error",
  "response-invalid",
  "draft-rejected",
  "completion-unavailable",
  "canonical-rejected",
  "local-fixed",
];

export type ServerAssessmentFallbackReason =
  (typeof serverAssessmentFallbackReasons)[number];

export function readServerAssessmentFallbackReason(
  request: unknown,
  expectedMode: "find" | "audit",
): ServerAssessmentFallbackReason;

export function firstActiveAuditMatchSnapshotId(
  snapshot: LiveWorkflowSnapshot,
): string;
