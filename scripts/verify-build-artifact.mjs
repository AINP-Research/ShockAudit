import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { SHOCKAUDIT_UI_BUILD_LABEL } from "../src/version.ts";
import { SIX_SCREEN_REPLACEMENT_BUILD } from
  "../src/core/six-screen/replacement-build.ts";
import {
  assertExpectedBuildMarker,
  resolveExpectedBuildMarker,
} from "./build-artifact-commit.mjs";

const assetBudgets = {
  "shockaudit-app.js": {
    // v109's box-quality, visible synthesis status, and one bounded repair
    // path add a measured
    // ~3 KiB raw / <1 KiB gzip delta to the v96 app artifact.
    // Keep narrow cross-platform headroom here while the unchanged aggregate
    // ceiling below continues to charge every startup byte.
    raw: 1_216 * 1024,
    gzip: 306 * 1024,
  },
  "shockaudit-app.css": {
    // All Screen 1–4 styles remain in one stable stylesheet so deferred
    // JavaScript loads cannot introduce a second CSS failure surface.
    raw: 176 * 1024,
    gzip: 30 * 1024,
  },
};

const startupAggregateBudget = {
  // Preserve the prior stable-entrypoint ceiling across the app and its
  // module-preloaded runtime; code splitting must not disguise startup growth.
  raw: 1_310 * 1024,
  gzip: 340 * 1024,
};

const startupChunkBudgets = {
  // React plus the shared Screen 2 state/restoration seam. v0.4.08's legacy
  // state migration adds a small measured compression delta without changing
  // the raw or aggregate startup ceilings.
  "screen02-runtime": { raw: 136 * 1024, gzip: 35 * 1024 },
  // v0.4.08 adds qualification-v3/funnel-v2 logic plus deterministic,
  // fingerprint-preserving migration of v0.4.06 saved states. Keep that
  // measured growth explicit while the unchanged aggregate startup ceiling
  // still prevents code splitting from hiding total startup expansion.
  "screen02-engine": { raw: 232 * 1024, gzip: 68 * 1024 },
};

const startupSupportChunkBudgets = {
  // Screen 2 -> 3 recovery adds a bounded receipt/status/error contract used
  // by both bridge paths. It remains a startup preload and is therefore also
  // charged to the unchanged aggregate startup ceiling below.
  "screen3-handoff-contract": { raw: 30 * 1024, gzip: 9 * 1024 },
  // Shared canonical state and Screen 5 run contracts are an explicit startup
  // preload inside the unchanged aggregate startup budget. The provider
  // checkpoint, migration lineage, and validation contract remain within this
  // named ownership boundary. v15 adds truthful OpenAI receipt/settings fields
  // and legacy-Groq readers. The measured compressed ceiling and unchanged
  // aggregate startup ceiling still constrain delivered growth.
  // The shared v23 model profiles live here to avoid a circular app-entry
  // preload. Keep the aggregate startup ceiling unchanged.
  // v29's compact workspace-response contract retains bounded encoding and
  // fingerprint fields. The current cross-platform bundle measures just under
  // 32 KiB raw; keep narrow headroom while the compressed and aggregate startup
  // ceilings remain unchanged.
  "screen5-state-contract": { raw: 33 * 1024, gzip: 9 * 1024 },
  // Rolldown emits this helper for the explicit runtime/engine boundary. It is
  // part of (and charged to) the runtime budget below, never an independent
  // avenue for hiding startup growth.
  "rolldown-runtime": { raw: 1 * 1024, gzip: 1 * 1024 },
};

const requiredDeferredChunkBudgets = {
  "HostTaskStatusPanel": { raw: 2 * 1024, gzip: 1 * 1024 },
  // v0.4.04 adds the bounded ambiguity-resolution panel to this deferred
  // screen. Fresh output is 48.12 KiB raw / 13.14 KiB gzip.
  "Screen02Find": { raw: 49 * 1024, gzip: 14 * 1024 },
  // Audit identity review is not needed by the stable shell or Find mode.
  "Screen02Audit": { raw: 56 * 1024, gzip: 15 * 1024 },
  // Small UI dependencies shared only by deferred evidence routes.
  "ContextLeads": { raw: 1 * 1024, gzip: 1 * 1024 },
  "Screen02WorkflowReset": { raw: 4 * 1024, gzip: 2 * 1024 },
  // Strict host-audit validation is loaded only at the Screen 4 entry gate.
  "host-reasoning-audit": { raw: 24 * 1024, gzip: 7 * 1024 },
};

const replacementDeferredChunkBudgets = {
  // The complete PDF exporter and its embedded Unicode fonts load only on an
  // explicit export click. Font bytes are self-contained for Windows/MCP use
  // and do not increase any startup ceiling.
  "complete-report": { raw: 760 * 1024, gzip: 550 * 1024 },
  // The readable current Screen 6 plan is not needed until the researcher
  // opens Screen 6. The measured v25 candidate is 23,011 raw / 6,446 gzip
  // bytes; keep a narrow independent ceiling without charging or raising the
  // unchanged startup aggregate budget.
  "Screen6CurrentPlanPanel": { raw: 24 * 1024, gzip: 7 * 1024 },
  // The historical Screen 6 result editor is loaded only when the researcher
  // expands earlier records and remains separate from the current-plan chunk.
  "Screen6UncertaintyPanel": { raw: 54 * 1024, gzip: 11 * 1024 },
};

const deferredScreenChunkBudgets = {
  "03": {
    // Screen 3 remains deliberately deferred from the stable startup
    // entrypoint. v0.4.04 adds claim-targeted evidence controls and typed
    // provenance while retaining a small independent ceiling.
    raw: 60 * 1024,
    gzip: 18 * 1024,
  },
  "04": {
    // Retained v0.4.03 Screen 4 code includes controlled year fields, optional
    // coverage language, exact crosswalk mappings, bounded combined scenarios, and the
    // reader-facing diagnostic report adapter. The computational diagnostic
    // engine remains behind a second lazy boundary, so this does not raise the
    // startup ceiling.
    raw: 116 * 1024,
    gzip: 30 * 1024,
  },
};

const advancedDiagnosticChunkBudget = {
  // Retained fixed, outcome-blind Screen 4 diagnostic calculations only.
  // Together with the adapter, the two lazy tiers remain bounded below 152 KiB raw
  // and 40 KiB gzip; neither is loaded by Screens 1–3.
  raw: 36 * 1024,
  gzip: 10 * 1024,
};

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const indexPath = path.join(projectRoot, "dist", "index.html");
const assetsPath = path.join(projectRoot, "dist", "assets");
const html = await readFile(indexPath, "utf8");
const htmlBytes = Buffer.byteLength(html);

if (htmlBytes > 8 * 1024) {
  throw new Error(
    `dist/index.html is ${htmlBytes} bytes; the MCP bootstrap must remain below 8 KiB.`,
  );
}
if (!html.includes('<div id="root">')) {
  throw new Error("dist/index.html does not contain the ShockAudit root.");
}

const assetPattern = /\/assets\/([^"'<> ]+)/g;
const assetNames = [...html.matchAll(assetPattern)].map(
  (match) => match[1].split("?")[0],
);
const startupChunkNames = {};
for (const logicalName of Object.keys(startupChunkBudgets)) {
  const chunkNames = assetNames.filter((name) =>
    new RegExp(
      `^shockaudit-${logicalName}-(?:[0-9a-f]{7}|local)\\.js$`,
    ).test(name)
  );
  if (chunkNames.length !== 1) {
    throw new Error(
      `dist/index.html must module-preload exactly one commit-bound ${logicalName} chunk; received ${JSON.stringify(chunkNames)}.`,
    );
  }
  startupChunkNames[logicalName] = chunkNames[0];
}
const startupSupportChunkNames = {};
for (const logicalName of Object.keys(startupSupportChunkBudgets)) {
  const chunkNames = assetNames.filter((name) =>
    new RegExp(
      `^shockaudit-${logicalName}-(?:[0-9a-f]{7}|local)\\.js$`,
    ).test(name)
  );
  if (chunkNames.length !== 1) {
    throw new Error(
      `dist/index.html must load exactly one commit-bound ${logicalName} runtime support chunk; received ${JSON.stringify(chunkNames)}.`,
    );
  }
  startupSupportChunkNames[logicalName] = chunkNames[0];
}
if (
  JSON.stringify(assetNames.sort()) !==
  JSON.stringify(
    [
      "shockaudit-app.css",
      "shockaudit-app.js",
      ...Object.values(startupChunkNames),
      ...Object.values(startupSupportChunkNames),
    ].sort(),
  )
) {
  throw new Error(
    `dist/index.html must load only the version-qualified ShockAudit app/CSS, the two declared startup preloads, and their bounded runtime support; received ${JSON.stringify(assetNames)}.`,
  );
}
for (const assetName of ["shockaudit-app.js", "shockaudit-app.css"]) {
  const qualifiedReference =
    `/assets/${assetName}?v=${SHOCKAUDIT_UI_BUILD_LABEL}`;
  if (
    !html.includes(qualifiedReference) ||
    html.includes(`"/assets/${assetName}"`) ||
    html.includes(`'/assets/${assetName}'`)
  ) {
    throw new Error(
      `dist/index.html must load ${assetName} through exactly the current version-qualified module URL.`,
    );
  }
}

const emittedAssetNames = (await readdir(assetsPath)).sort();
const deferredChunkNames = {};
if (!SIX_SCREEN_REPLACEMENT_BUILD) {
  for (const screenNumber of Object.keys(deferredScreenChunkBudgets)) {
    const chunkNames = emittedAssetNames.filter((name) =>
      new RegExp(
        `^shockaudit-screen${screenNumber}-(?:[0-9a-f]{7}|local)\\.js$`,
      ).test(name),
    );
    if (chunkNames.length !== 1) {
      throw new Error(
        `The legacy build must emit exactly one commit-bound Screen ${Number(screenNumber)} JavaScript chunk; received ${JSON.stringify(chunkNames)}.`,
      );
    }
    deferredChunkNames[screenNumber] = chunkNames[0];
  }
}
const requiredDeferredChunkNames = {};
if (!SIX_SCREEN_REPLACEMENT_BUILD) {
  for (const logicalName of Object.keys(requiredDeferredChunkBudgets)) {
    const chunkNames = emittedAssetNames.filter((name) =>
      new RegExp(
        `^shockaudit-${logicalName}-(?:[0-9a-f]{7}|local)\\.js$`,
      ).test(name),
    );
    if (chunkNames.length !== 1) {
      throw new Error(
        `The legacy build must emit exactly one commit-bound ${logicalName} chunk; received ${JSON.stringify(chunkNames)}.`,
      );
    }
    requiredDeferredChunkNames[logicalName] = chunkNames[0];
  }
}
const expectedAssetNames = [
  "shockaudit-app.css",
  "shockaudit-app.js",
  ...Object.values(startupChunkNames),
  ...Object.values(startupSupportChunkNames),
  ...Object.values(deferredChunkNames),
  ...Object.values(requiredDeferredChunkNames),
  ...emittedAssetNames.filter((name) =>
    /^shockaudit-screen04-advanced-diagnostics-(?:[0-9a-f]{7}|local)\.js$/u
      .test(name)
  ),
].sort();
const advancedDiagnosticChunkNames = emittedAssetNames.filter((name) =>
  /^shockaudit-screen04-advanced-diagnostics-(?:[0-9a-f]{7}|local)\.js$/u
    .test(name)
);
const replacementDeferredChunkNames = {};
if (SIX_SCREEN_REPLACEMENT_BUILD) {
  for (const logicalName of Object.keys(replacementDeferredChunkBudgets)) {
    const chunkNames = emittedAssetNames.filter((name) =>
      new RegExp(
        `^shockaudit-${logicalName}-(?:[0-9a-f]{7}|local)\\.js$`,
      ).test(name)
    );
    if (chunkNames.length !== 1) {
      throw new Error(
        `The replacement build must emit exactly one commit-bound ${logicalName} chunk; received ${JSON.stringify(chunkNames)}.`,
      );
    }
    replacementDeferredChunkNames[logicalName] = chunkNames[0];
  }
}
expectedAssetNames.push(...Object.values(replacementDeferredChunkNames));
expectedAssetNames.sort();
if (!SIX_SCREEN_REPLACEMENT_BUILD && advancedDiagnosticChunkNames.length !== 1) {
  throw new Error(
    `The build must emit exactly one commit-bound Screen 4 advanced-diagnostics chunk; received ${JSON.stringify(advancedDiagnosticChunkNames)}.`,
  );
}
if (
  JSON.stringify(emittedAssetNames) !==
  JSON.stringify(expectedAssetNames)
) {
  throw new Error(
    `dist/assets must contain only the stable app/CSS and exactly declared startup/deferred chunks; received ${JSON.stringify(emittedAssetNames)}.`,
  );
}

const commitBoundMarkers = [
  ...Object.values(startupChunkNames),
  ...Object.values(startupSupportChunkNames),
  ...Object.values(deferredChunkNames),
  ...Object.values(requiredDeferredChunkNames),
  ...Object.values(replacementDeferredChunkNames),
  ...advancedDiagnosticChunkNames,
].map((assetName) =>
  assetName.match(/-([0-9a-f]{7}|local)\.js$/u)?.[1]
);
if (
  commitBoundMarkers.some((marker) => !marker) ||
  new Set(commitBoundMarkers).size !== 1
) {
  throw new Error(
    `Every commit-bound JavaScript asset must use one common build marker; received ${JSON.stringify(commitBoundMarkers)}.`,
  );
}
const buildMarker = commitBoundMarkers[0];
const expectedBuildMarker = resolveExpectedBuildMarker();
assertExpectedBuildMarker(buildMarker, expectedBuildMarker);

const mainJavaScript = await readFile(
  path.join(assetsPath, "shockaudit-app.js"),
  "utf8",
);
if (!buildMarker || !mainJavaScript.includes(buildMarker)) {
  throw new Error(
    `The stable JavaScript entrypoint must expose the common ${buildMarker ?? "missing"} build marker.`,
  );
}
if (
  SIX_SCREEN_REPLACEMENT_BUILD &&
  (
    !mainJavaScript.includes("create_six_screen_workflow_v1") ||
    !mainJavaScript.includes("shockaudit-six-screen-public-v1")
  )
) {
  throw new Error(
    "The replacement entrypoint must contain the six-screen workflow tool and public-state contract markers.",
  );
}
for (const [logicalName, chunkName] of Object.entries({
  ...startupChunkNames,
  ...startupSupportChunkNames,
})) {
  const pattern = new RegExp(
    `shockaudit-${logicalName}-(?:[0-9a-f]{7}|local)\\.js`,
    "gu",
  );
  const references = [
    ...new Set([...mainJavaScript.matchAll(pattern)].map((match) => match[0])),
  ];
  if (references.length !== 1 || references[0] !== chunkName) {
    throw new Error(
      `The stable JavaScript entrypoint must reference exactly the emitted ${logicalName} preload; received ${JSON.stringify(references)}.`,
    );
  }
}
if (!SIX_SCREEN_REPLACEMENT_BUILD) {
  const screen02AuditChunkName = requiredDeferredChunkNames.Screen02Audit;
  const screen02AuditReferences = [
    ...new Set(
      [...mainJavaScript.matchAll(
        /shockaudit-Screen02Audit-(?:[0-9a-f]{7}|local)\.js/gu,
      )].map((match) => match[0]),
    ),
  ];
  if (
    screen02AuditReferences.length !== 1 ||
    screen02AuditReferences[0] !== screen02AuditChunkName
  ) {
    throw new Error(
      `The stable JavaScript entrypoint must reference exactly the emitted Screen 2 Audit chunk; received ${JSON.stringify(screen02AuditReferences)}.`,
    );
  }
}
for (const [screenNumber, chunkName] of Object.entries(deferredChunkNames)) {
  const referencedChunks = [
    ...new Set(
      [...mainJavaScript.matchAll(
        new RegExp(
          `shockaudit-screen${screenNumber}-(?:[0-9a-f]{7}|local)\\.js`,
          "g",
        ),
      )].map((match) => match[0]),
    ),
  ];
  if (referencedChunks.length !== 1 || referencedChunks[0] !== chunkName) {
    throw new Error(
      `The stable JavaScript entrypoint must reference exactly the emitted Screen ${Number(screenNumber)} chunk; received ${JSON.stringify(referencedChunks)}.`,
    );
  }

  const chunkContents = await readFile(
    path.join(assetsPath, chunkName),
    "utf8",
  );
  if (
    !chunkContents.includes(
      `./shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
    ) ||
    /from["']\.\/shockaudit-app\.js["']/.test(chunkContents)
  ) {
    throw new Error(
      `The Screen ${Number(screenNumber)} chunk must share the exact version-qualified startup module instead of executing an unqualified duplicate.`,
    );
  }
}
if (SIX_SCREEN_REPLACEMENT_BUILD) {
  const main = await readFile(path.join(assetsPath, "shockaudit-app.js"), "utf8");
  for (const [logicalName, chunkName] of
    Object.entries(replacementDeferredChunkNames)) {
    const deferred = await readFile(path.join(assetsPath, chunkName), "utf8");
    const owner = logicalName === "complete-report"
      ? await readFile(path.join(assetsPath,
          replacementDeferredChunkNames.Screen6CurrentPlanPanel), "utf8")
      : main;
    if (!owner.includes(chunkName) ||
      !deferred.includes(`./shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`)) {
      throw new Error(
        `The deferred ${logicalName} chunk must load from the exact paired UI build.`,
      );
    }
  }
}
for (const assetName of emittedAssetNames.filter((name) => name.endsWith(".js"))) {
  const chunkContents = await readFile(path.join(assetsPath, assetName), "utf8");
  if (
    /(?:GROQ|OPENAI)_API_KEY|api\.groq\.com\/openai\/v1\/chat\/completions|api\.openai\.com\/v1\/responses/u.test(
      chunkContents,
    )
  ) {
    throw new Error(
      `${assetName} contains a server-only provider credential or endpoint marker.`,
    );
  }
  if (/\b__VITE_(?:PRELOAD|IS_MODERN)__\b/u.test(chunkContents)) {
    throw new Error(
      `${assetName} contains an unresolved Vite runtime marker; dynamic imports must be finalized before release.`,
    );
  }
  if (assetName === "shockaudit-app.js") continue;
  if (/from["']\.\/shockaudit-app\.js["']/.test(chunkContents)) {
    throw new Error(
      `${assetName} imported the stable app without its release qualifier.`,
    );
  }
}
if (!SIX_SCREEN_REPLACEMENT_BUILD) {
  for (const logicalName of ["Screen02Find", "host-reasoning-audit"]) {
    const assetName = requiredDeferredChunkNames[logicalName];
    const chunkContents = await readFile(path.join(assetsPath, assetName), "utf8");
    if (!chunkContents.includes(
      `./shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}`,
    )) {
      throw new Error(
        `${assetName} must share the exact version-qualified stable app module.`,
      );
    }
  }
}
if (!SIX_SCREEN_REPLACEMENT_BUILD) {
  const screen04Chunk = await readFile(
    path.join(assetsPath, deferredChunkNames["04"]),
    "utf8",
  );
  const advancedDiagnosticReferences = [
    ...new Set(
      [...screen04Chunk.matchAll(
        /shockaudit-screen04-advanced-diagnostics-(?:[0-9a-f]{7}|local)\.js/gu,
      )].map((match) => match[0]),
    ),
  ];
  if (
    advancedDiagnosticReferences.length !== 1 ||
    advancedDiagnosticReferences[0] !== advancedDiagnosticChunkNames[0]
  ) {
    throw new Error(
      `The Screen 4 chunk must reference exactly the emitted advanced-diagnostics chunk; received ${JSON.stringify(advancedDiagnosticReferences)}.`,
    );
  }
}

const verifiedSizes = [];
let startupRawBytes = 0;
let startupGzipBytes = 0;
let runtimeOwnedRawBytes = 0;
let runtimeOwnedGzipBytes = 0;
for (const assetName of emittedAssetNames) {
  const assetPath = path.join(
    projectRoot,
    "dist",
    "assets",
    assetName,
  );
  const metadata = await stat(assetPath);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`Missing or empty built asset: ${assetName}`);
  }
  const screenNumber = Object.entries(deferredChunkNames)
    .find(([, chunkName]) => chunkName === assetName)?.[0];
  const requiredDeferredName = Object.entries(requiredDeferredChunkNames)
    .find(([, chunkName]) => chunkName === assetName)?.[0];
  const startupChunkName = Object.entries(startupChunkNames)
    .find(([, chunkName]) => chunkName === assetName)?.[0];
  const startupSupportChunkName = Object.entries(startupSupportChunkNames)
    .find(([, chunkName]) => chunkName === assetName)?.[0];
  const replacementDeferredName = Object.entries(replacementDeferredChunkNames)
    .find(([, chunkName]) => chunkName === assetName)?.[0];
  const budget = screenNumber
    ? deferredScreenChunkBudgets[screenNumber]
    : requiredDeferredName
      ? requiredDeferredChunkBudgets[requiredDeferredName]
      : startupChunkName
        ? startupChunkBudgets[startupChunkName]
      : startupSupportChunkName
        ? startupSupportChunkBudgets[startupSupportChunkName]
      : replacementDeferredName
        ? replacementDeferredChunkBudgets[replacementDeferredName]
      : assetName === advancedDiagnosticChunkNames[0]
      ? advancedDiagnosticChunkBudget
      : assetBudgets[assetName];
  const contents = await readFile(assetPath);
  const gzipBytes = gzipSync(contents, { level: 9 }).byteLength;
  if (
    !budget ||
    metadata.size > budget.raw ||
    gzipBytes > budget.gzip
  ) {
    throw new Error(
      `${assetName} exceeded its release budget: ${metadata.size}/${
        budget?.raw ?? 0
      } raw bytes and ${gzipBytes}/${budget?.gzip ?? 0} gzip bytes.`,
    );
  }
  if (
    assetName === "shockaudit-app.js" ||
    startupChunkName !== undefined ||
    startupSupportChunkName !== undefined
  ) {
    startupRawBytes += metadata.size;
    startupGzipBytes += gzipBytes;
  }
  if (
    startupChunkName === "screen02-runtime" ||
    startupSupportChunkName !== undefined
  ) {
    runtimeOwnedRawBytes += metadata.size;
    runtimeOwnedGzipBytes += gzipBytes;
  }
  verifiedSizes.push({
    assetName,
    rawBytes: metadata.size,
    gzipBytes,
  });
}
const runtimeBudget = startupChunkBudgets["screen02-runtime"];
if (
  runtimeOwnedRawBytes > runtimeBudget.raw ||
  runtimeOwnedGzipBytes > runtimeBudget.gzip
) {
  throw new Error(
    `The dependency-inclusive Screen 2 runtime exceeded its release budget: ${runtimeOwnedRawBytes}/${runtimeBudget.raw} raw bytes and ${runtimeOwnedGzipBytes}/${runtimeBudget.gzip} gzip bytes.`,
  );
}
if (
  startupRawBytes > startupAggregateBudget.raw ||
  startupGzipBytes > startupAggregateBudget.gzip
) {
  throw new Error(
    `The aggregate startup JavaScript exceeded its unchanged release budget: ${startupRawBytes}/${startupAggregateBudget.raw} raw bytes and ${startupGzipBytes}/${startupAggregateBudget.gzip} gzip bytes.`,
  );
}

console.log(
  SIX_SCREEN_REPLACEMENT_BUILD
    ? `Verified six-screen replacement artifact (${htmlBytes} byte bootstrap; ${startupRawBytes} raw/${startupGzipBytes} gzip startup JavaScript): ${JSON.stringify(verifiedSizes)}.`
    : `Verified lightweight MCP bootstrap (${htmlBytes} bytes), two named startup preloads plus bounded runtime support (${startupRawBytes} raw/${startupGzipBytes} gzip JavaScript; dependency-inclusive runtime ${runtimeOwnedRawBytes} raw/${runtimeOwnedGzipBytes} gzip), declared commit-bound deferred chunks, one chunk each for Screen 2 Audit, Screen 3, and Screen 4, and one bounded Screen 4 advanced-diagnostics chunk: ${JSON.stringify(verifiedSizes)}.`,
);
