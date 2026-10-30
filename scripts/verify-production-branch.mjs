import { execFileSync } from "node:child_process";

const cloudflareBuild = process.env.WORKERS_CI === "1";
let branch = process.env.WORKERS_CI_BRANCH?.trim() ?? "";
const expectedCommit = (
  process.env.SHOCKAUDIT_EXPECTED_COMMIT ??
  process.env.WORKERS_CI_COMMIT_SHA ??
  ""
).trim();

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

if (!cloudflareBuild && !branch) {
  try {
    branch = git(["branch", "--show-current"]);
  } catch {
    branch = "";
  }
}

if (branch !== "main") {
  throw new Error(
    branch
      ? `Refusing a production ShockAudit deploy from branch ${branch}; merge to main or use wrangler versions upload for a preview.`
      : "Refusing a production ShockAudit deploy because the source branch could not be verified as main.",
  );
}

let head = "";
try {
  head = git(["rev-parse", "HEAD"]);
} catch {
  throw new Error(
    "Refusing a production ShockAudit deploy because the exact source commit could not be resolved.",
  );
}

if (!expectedCommit) {
  throw new Error(
    "Refusing a production ShockAudit deploy without SHOCKAUDIT_EXPECTED_COMMIT (or WORKERS_CI_COMMIT_SHA).",
  );
}

if (head !== expectedCommit) {
  throw new Error(
    `Refusing a production ShockAudit deploy: checked-out HEAD ${head} does not equal expected commit ${expectedCommit}.`,
  );
}

if (!cloudflareBuild) {
  const dirty = git(["status", "--porcelain"]);
  if (dirty) {
    throw new Error(
      "Refusing a production ShockAudit deploy from a working tree with uncommitted changes.",
    );
  }

  let mainHead = "";
  try {
    mainHead = git(["rev-parse", "refs/remotes/origin/main"]);
  } catch {
    throw new Error(
      "Refusing a production ShockAudit deploy because refs/remotes/origin/main is unavailable; fetch and retry.",
    );
  }
  if (mainHead !== head) {
    throw new Error(
      `Refusing a production ShockAudit deploy: HEAD ${head} is not the fetched origin/main ${mainHead}.`,
    );
  }
}

console.log(`Verified production deployment source: main at exact commit ${head}.`);
