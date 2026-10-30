import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FULL_CHECK = "check:full";
const CLOUDFLARE_CHECK = "check:cloudflare";

export function selectRepositoryCheck(environment = process.env) {
  const managedCommit = environment.WORKERS_CI_COMMIT_SHA?.trim();
  if (!managedCommit) return FULL_CHECK;
  if (!/^[0-9a-f]{40}$/u.test(managedCommit)) {
    throw new Error(
      "WORKERS_CI_COMMIT_SHA must be the lowercase 40-character commit supplied by Cloudflare Workers Builds.",
    );
  }
  return CLOUDFLARE_CHECK;
}

export function runRepositoryCheck(environment = process.env) {
  const script = selectRepositoryCheck(environment);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", script], {
    env: environment,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Repository check terminated by ${result.signal}.`);
  }
  return result.status ?? 1;
}

const invokedDirectly = process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  process.exitCode = runRepositoryCheck();
}
