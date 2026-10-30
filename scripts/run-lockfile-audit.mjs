import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MODES = new Set(["runtime", "full"]);
const MAX_ATTEMPTS = 3;
const RUNTIME_FETCH_TIMEOUT_MS = 120_000;
const FULL_FETCH_TIMEOUT_MS = 300_000;
const ATTEMPT_TIMEOUT_GRACE_MS = 50_000;
const RETRY_DELAY_MS = 2_000;

export function auditFetchTimeoutMs(mode) {
  if (!MODES.has(mode)) {
    throw new Error("Audit mode must be either runtime or full.");
  }
  return mode === "runtime"
    ? RUNTIME_FETCH_TIMEOUT_MS
    : FULL_FETCH_TIMEOUT_MS;
}

export function auditAttemptTimeoutMs(mode) {
  return auditFetchTimeoutMs(mode) + ATTEMPT_TIMEOUT_GRACE_MS;
}

export function auditArguments(mode) {
  const fetchTimeoutMs = auditFetchTimeoutMs(mode);
  return [
    "audit",
    "--package-lock-only",
    ...(mode === "runtime"
      ? ["--omit=dev", "--include=prod", "--include=optional", "--include=peer"]
      : ["--include=prod", "--include=dev", "--include=optional", "--include=peer"]),
    "--audit-level=moderate",
    "--json",
    "--fetch-retries=0",
    `--fetch-timeout=${fetchTimeoutMs}`,
    "--registry=https://registry.npmjs.org/",
    "--loglevel=http",
  ];
}

function validVulnerabilityCounts(value) {
  if (!value || typeof value !== "object") return false;
  return ["info", "low", "moderate", "high", "critical", "total"].every(
    (severity) => Number.isInteger(value[severity]) && value[severity] >= 0,
  );
}

export function classifyAuditAttempt({ status, stdout }) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { outcome: "retryable", exitCode: status ?? 1 };
  }
  const counts = report?.metadata?.vulnerabilities;
  if (!validVulnerabilityCounts(counts)) {
    return { outcome: "retryable", exitCode: status ?? 1 };
  }
  if (counts.moderate + counts.high + counts.critical > 0) {
    return { outcome: "vulnerabilities", exitCode: status || 1 };
  }
  if (status === 0) return { outcome: "clean", exitCode: 0 };
  return { outcome: "fatal", exitCode: status ?? 1 };
}

export async function runLockfileAudit(mode) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const attemptTimeoutMs = auditAttemptTimeoutMs(mode);
  let finalExitCode = 1;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.error(`Running ${mode} lockfile audit (${attempt}/${MAX_ATTEMPTS}).`);
    const result = spawnSync(npmCommand, auditArguments(mode), {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: attemptTimeoutMs,
      windowsHide: true,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    const classification = classifyAuditAttempt({
      status: result.status,
      stdout: result.stdout ?? "",
    });
    finalExitCode = classification.exitCode;
    if (classification.outcome === "clean") return 0;
    if (classification.outcome !== "retryable") return finalExitCode;
    if (attempt < MAX_ATTEMPTS) {
      console.error(
        "The npm audit did not return a valid report; retrying in a fresh process.",
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return finalExitCode || 1;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  process.exitCode = await runLockfileAudit(process.argv[2]);
}
