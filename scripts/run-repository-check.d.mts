export function selectRepositoryCheck(
  environment?: Record<string, string | undefined>,
): "check:full" | "check:cloudflare";

export function runRepositoryCheck(
  environment?: NodeJS.ProcessEnv,
): number;
