export interface ReleaseTestAssertionResult {
  status: string;
  fullName: string;
}

export interface ReleaseTestFileResult {
  name: string;
  status?: string;
  assertionResults?: ReleaseTestAssertionResult[];
}

export interface ReleaseTestReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults?: ReleaseTestFileResult[];
}

export interface ReleaseTestBaseline {
  schemaVersion?: string;
  minimumTotalTests?: number;
  expectedFailureCount?: number;
  expectedFailures?: string[];
}

export function releaseTestFailureKeys(
  report: ReleaseTestReport,
): string[];

export function validateReleaseTestReport(
  report: ReleaseTestReport,
  baseline: ReleaseTestBaseline,
): { issues: string[]; actual: string[] };
