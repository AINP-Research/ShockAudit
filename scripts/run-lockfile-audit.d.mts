export type LockfileAuditMode = "runtime" | "full";

export type LockfileAuditClassification = {
  outcome: "clean" | "vulnerabilities" | "fatal" | "retryable";
  exitCode: number;
};

export function auditArguments(mode: LockfileAuditMode): string[];

export function auditFetchTimeoutMs(mode: LockfileAuditMode): number;

export function auditAttemptTimeoutMs(mode: LockfileAuditMode): number;

export function classifyAuditAttempt(input: {
  status: number | null;
  stdout: string;
}): LockfileAuditClassification;

export function runLockfileAudit(mode: LockfileAuditMode): Promise<number>;
