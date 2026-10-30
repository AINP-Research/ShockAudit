export function resolveExpectedBuildMarker(options?: {
  env?: Record<string, string | undefined>;
  readGitMarker?: () => string;
}): string;

export function assertExpectedBuildMarker(
  actualMarker: string | undefined,
  expectedMarker: string,
): void;
