import { execFileSync } from "node:child_process";

function fail(message) {
  throw new Error(message);
}

export function resolveExpectedBuildMarker({
  env = process.env,
  readGitMarker = () => execFileSync(
    "git",
    ["rev-parse", "--short=7", "HEAD"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim(),
} = {}) {
  const configuredCommit = Object.prototype.hasOwnProperty.call(
    env,
    "SHOCKAUDIT_EXPECTED_COMMIT",
  )
    ? String(env.SHOCKAUDIT_EXPECTED_COMMIT ?? "").trim()
    : null;
  const cloudflareCommit = Object.prototype.hasOwnProperty.call(
    env,
    "WORKERS_CI_COMMIT_SHA",
  )
    ? String(env.WORKERS_CI_COMMIT_SHA ?? "").trim()
    : null;

  if (configuredCommit !== null) {
    if (!/^[0-9a-f]{40}$/u.test(configuredCommit)) {
      fail(
        "SHOCKAUDIT_EXPECTED_COMMIT must be the full lowercase 40-hex release commit.",
      );
    }
  }
  if (cloudflareCommit !== null) {
    if (!/^[0-9a-f]{40}$/u.test(cloudflareCommit)) {
      fail(
        "WORKERS_CI_COMMIT_SHA must be the full lowercase 40-hex Cloudflare build commit.",
      );
    }
  }
  if (
    configuredCommit !== null &&
    cloudflareCommit !== null &&
    configuredCommit !== cloudflareCommit
  ) {
    fail(
      "SHOCKAUDIT_EXPECTED_COMMIT and WORKERS_CI_COMMIT_SHA identify different release commits.",
    );
  }

  const expectedCommit = configuredCommit ?? cloudflareCommit;
  if (expectedCommit !== null) return expectedCommit.slice(0, 7);

  if (env.CI === "true" || env.GITHUB_ACTIONS === "true") {
    fail(
      "SHOCKAUDIT_EXPECTED_COMMIT or WORKERS_CI_COMMIT_SHA is required by the CI release build gate.",
    );
  }
  try {
    const gitMarker = readGitMarker();
    if (!/^[0-9a-f]{7}$/u.test(gitMarker)) {
      fail("The local Git HEAD did not resolve to a seven-character commit marker.");
    }
    return gitMarker;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "The local Git HEAD did not resolve to a seven-character commit marker."
    ) {
      throw error;
    }
    return "local";
  }
}

export function assertExpectedBuildMarker(actualMarker, expectedMarker) {
  if (actualMarker !== expectedMarker) {
    fail(
      `The built asset marker ${actualMarker ?? "missing"} does not match expected HEAD marker ${expectedMarker}. Refusing stale or cross-commit dist output.`,
    );
  }
}
