import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

const expectedCommit = process.env.SHOCKAUDIT_EXPECTED_COMMIT?.trim() ?? "";
if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(expectedCommit)) {
  throw new Error(
    "Refusing a Stage 6 candidate deploy without SHOCKAUDIT_EXPECTED_COMMIT set to the recorded full candidate commit.",
  );
}

let head;
let tree;
let status;
try {
  head = git(["rev-parse", "HEAD"]);
  tree = git(["rev-parse", "HEAD^{tree}"]);
  status = git([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
} catch {
  throw new Error(
    "Refusing a Stage 6 candidate deploy because the Git commit, tree, or worktree status could not be verified.",
  );
}

if (head.toLowerCase() !== expectedCommit.toLowerCase()) {
  throw new Error(
    `Refusing a Stage 6 candidate deploy because HEAD ${head} does not equal SHOCKAUDIT_EXPECTED_COMMIT ${expectedCommit}.`,
  );
}
if (status) {
  throw new Error(
    "Refusing a Stage 6 candidate deploy from a dirty worktree. Commit or remove every tracked and untracked change, rebuild, and rerun all gates.",
  );
}

const profile = process.env.SHOCKAUDIT_CANDIDATE_PROFILE?.trim() || "shadow";
if (!['shadow', 'on'].includes(profile)) {
  throw new Error("SHOCKAUDIT_CANDIDATE_PROFILE must be shadow or on.");
}
const candidateFile = profile === "on"
  ? "../config/previews/wrangler.stage6-on-preview.jsonc"
  : "../config/previews/wrangler.stage6-preview.jsonc";
const candidateName = profile === "on"
  ? "shockaudit-stage6-on-candidate"
  : "shockaudit-stage6-candidate";
const candidateConfig = await readFile(
  new URL(candidateFile, import.meta.url),
  "utf8",
);
const productionConfig = await readFile(
  new URL("../wrangler.jsonc", import.meta.url),
  "utf8",
);
if (
  !new RegExp(`"name"\\s*:\\s*"${candidateName}"`).test(candidateConfig) ||
  !new RegExp(`"SCREEN02_SEARCH_EXPANSION_MODE"\\s*:\\s*"${profile}"`).test(candidateConfig) ||
  !/"workers_dev"\s*:\s*true/.test(candidateConfig) ||
  /"routes?"\s*:/.test(candidateConfig) ||
  /"script_name"\s*:/.test(candidateConfig) ||
  /STAGE1_PREVIEW_ONLY|SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT|SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP/.test(
    candidateConfig,
  )
) {
  throw new Error(
    "Refusing a Stage 6 candidate deploy because the candidate config is not the isolated workers.dev-only profile.",
  );
}
if (
  !/"name"\s*:\s*"shockaudit"/.test(productionConfig) ||
  /"name"\s*:\s*"shockaudit-stage6-candidate"/.test(productionConfig)
) {
  throw new Error(
    "Refusing a Stage 6 candidate deploy because production and candidate Worker identities could not be distinguished.",
  );
}

console.log(
  `Verified clean isolated Stage 6 ${profile} candidate source: commit ${head}, tree ${tree}.`,
);
