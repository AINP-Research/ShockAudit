import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateProductQualification } from "./check-product-qualification.mjs";

const evidenceDirectory = process.env.SHOCKAUDIT_QUALIFICATION_DIR?.trim();
if (!evidenceDirectory) {
  throw new Error(
    "Post-deployment acceptance requires SHOCKAUDIT_QUALIFICATION_DIR to point to the reviewed, checksum-bound qualification bundle.",
  );
}
const root = resolve(evidenceDirectory);
const result = await validateProductQualification(root);
if (result.issues.length > 0) {
  throw new Error(
    `Post-deployment acceptance is incomplete because product qualification has ${result.issues.length} unresolved issue(s): ${result.issues.slice(0, 3).join(" | ")}`,
  );
}
const manifest = JSON.parse(
  await readFile(resolve(root, "qualification-manifest.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
}).trim();
if (manifest?.candidate?.commit?.toLowerCase() !== head.toLowerCase()) {
  throw new Error(
    `Post-deployment acceptance evidence names commit ${String(manifest?.candidate?.commit)}, which does not equal HEAD ${head}.`,
  );
}
console.log(
  `Verified post-deployment acceptance for exact commit ${head} with ${result.artifactCount} checksum-bound artifacts.`,
);
