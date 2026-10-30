import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { minify } from "terser";
import { defineConfig } from "vitest/config";

import {
  SHOCKAUDIT_RELEASE_LABEL,
  SHOCKAUDIT_UI_BUILD_LABEL,
} from "./src/version.ts";
import { SIX_SCREEN_REPLACEMENT_BUILD } from
  "./src/core/six-screen/replacement-build.ts";

function currentCommit() {
  if (process.env.WORKERS_CI_COMMIT_SHA) {
    return process.env.WORKERS_CI_COMMIT_SHA.slice(0, 7);
  }

  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "local";
  }
}

const buildCommit = currentCommit();

const selfContainedLocalPreview =
  process.env.npm_lifecycle_event === "build:local-preview" ||
  process.env.SHOCKAUDIT_SELF_CONTAINED_UI === "1";

export default defineConfig({
  base: "/",
  resolve: {
    alias: [
      {
        // The pinned MCP SDK namespace-imports zod/v4. Limit that exact
        // browser import to its exercised runtime surface so unused locale
        // modules do not become part of the stable entrypoint.
        find: /^zod\/v4$/u,
        replacement: fileURLToPath(
          new URL("./src/ui/zod-v4-runtime.ts", import.meta.url),
        ),
      },
    ],
  },
  plugins: [
    react(),
    {
      // Preserve the fixed per-asset release ceilings after Vite's normal
      // production pass; the independent artifact verifier remains authoritative.
      name: "shockaudit-release-second-pass-minify",
      apply: "build",
      enforce: "post",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          let versionedHtml = html;
          for (const assetName of [
            "shockaudit-app.js",
            "shockaudit-app.css",
          ]) {
            const doubleQuoted = `"/assets/${assetName}"`;
            const singleQuoted = `'/assets/${assetName}'`;
            const referenceCount =
              versionedHtml.split(doubleQuoted).length - 1 +
              versionedHtml.split(singleQuoted).length - 1;
            if (referenceCount !== 1) {
              throw new Error(
                `Expected one unversioned ${assetName} HTML reference, received ${referenceCount}.`,
              );
            }
            versionedHtml = versionedHtml
              .replaceAll(
                doubleQuoted,
                `"/assets/${assetName}?v=${SHOCKAUDIT_UI_BUILD_LABEL}"`,
              )
              .replaceAll(
                singleQuoted,
                `'/assets/${assetName}?v=${SHOCKAUDIT_UI_BUILD_LABEL}'`,
              );
          }
          if (selfContainedLocalPreview) {
            versionedHtml = versionedHtml.replace(
              "<head>",
              '<head>\n    <meta name="shockaudit-ui-delivery" content="self-contained" />',
            );
          }
          return versionedHtml;
        },
      },
      generateBundle: {
        // Vite resolves dynamic-import preload markers during generateBundle.
        // Finish that chunk analysis before minifying and emitting renamed
        // Screen 3/4 assets, which later chunk-only hooks cannot transform.
        order: "post",
        async handler(_options, bundle) {
          const sixScreenReplacement = SIX_SCREEN_REPLACEMENT_BUILD;
          if (selfContainedLocalPreview) {
            // Vite/Rolldown already performs the normal production minification.
            // Do not run the release-only two-pass Terser convergence step over
            // the entire single local bundle: on Windows this can make the
            // private preview appear frozen for minutes without improving the
            // host-compatibility proof.
            return;
          }
          const deferredRenames = new Map<string, string>();
          const deferredScreenCounts = new Map([
            ["03", 0],
            ["04", 0],
          ]);

          for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            const moduleIds = Object.keys(output.modules).map((moduleId) =>
              moduleId.replaceAll("\\", "/")
            );
            const screenNumbers = ["03", "04"].filter((screenNumber) =>
              moduleIds.some((moduleId) =>
                moduleId.endsWith(
                  `/screen-${screenNumber}/Screen${screenNumber}.tsx`,
                )
              )
            );
            if (screenNumbers.length === 0) continue;
            if (screenNumbers.length !== 1) {
              throw new Error(
                `A deferred chunk cannot contain both Screen 3 and Screen 4 entries: ${JSON.stringify(moduleIds)}.`,
              );
            }
            const screenNumber = screenNumbers[0];
            const desiredFileName =
              `assets/shockaudit-screen${screenNumber}-${buildCommit}.js`;
            deferredRenames.set(output.fileName, desiredFileName);
            deferredScreenCounts.set(
              screenNumber,
              (deferredScreenCounts.get(screenNumber) ?? 0) + 1,
            );
          }

          for (const [screenNumber, count] of deferredScreenCounts) {
            if (!sixScreenReplacement && count !== 1) {
              throw new Error(
                `Expected exactly one deferred Screen ${Number(screenNumber)} chunk before release minification, received ${count}.`,
              );
            }
          }

          for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            for (const [originalFileName, desiredFileName] of deferredRenames) {
              const originalBaseName = originalFileName.split("/").at(-1);
              const desiredBaseName = desiredFileName.split("/").at(-1);
              if (!originalBaseName || !desiredBaseName) continue;
              output.code = output.code.replaceAll(
                originalBaseName,
                desiredBaseName,
              );
            }
            output.imports = output.imports.map(
              (fileName) => deferredRenames.get(fileName) ?? fileName,
            );
            output.dynamicImports = output.dynamicImports.map(
              (fileName) => deferredRenames.get(fileName) ?? fileName,
            );
          }

          for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            // Both the direct shell and MCP resource load the stable entry with
            // ?v=<release>. Qualify every lazy chunk's direct shared-entry import
            // identically; otherwise a Screen 2/3/4 route can create a second
            // module identity and execute the bootstrap twice.
            const entryReferences = [
              ...output.code.matchAll(
                /(["'])\.\/shockaudit-app\.js\1/g,
              ),
            ];
            if (entryReferences.length > 1) {
              throw new Error(
                `Expected at most one shared-entry import in ${output.fileName}, received ${entryReferences.length}.`,
              );
            }
            if (
              deferredRenames.has(output.fileName) &&
              entryReferences.length !== 1
            ) {
              throw new Error(
                `Expected one deferred-screen shared-entry import in ${output.fileName}, received ${entryReferences.length}.`,
              );
            }
            if (entryReferences.length === 1) {
              output.code = output.code.replace(
                /(["'])\.\/shockaudit-app\.js\1/g,
                (_reference, quote: string) =>
                  `${quote}./shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}${quote}`,
              );
            }
            const options = {
              compress: { passes: 3 },
              mangle: true,
              module: true,
            } as const;
            const compressed = await minify(output.code, options);
            if (!compressed.code) continue;
            // A convergence pass safely folds aliases exposed by the first pass.
            // This uses the same conservative options (no unsafe transforms).
            const tightened = await minify(compressed.code, options);
            output.code = tightened.code ?? compressed.code;
          }

          for (const [originalFileName, desiredFileName] of deferredRenames) {
            const output = bundle[originalFileName];
            if (!output || output.type !== "chunk" || bundle[desiredFileName]) {
              throw new Error(
                `Could not emit the deterministic deferred chunk ${desiredFileName}.`,
              );
            }
            this.emitFile({
              type: "asset",
              fileName: desiredFileName,
              source: output.code,
            });
            delete bundle[originalFileName];
          }
        },
      },
    },
  ],
  define: {
    __SHOCKAUDIT_COMMIT__: JSON.stringify(buildCommit),
    __SHOCKAUDIT_VERSION__: JSON.stringify(SHOCKAUDIT_RELEASE_LABEL),
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // Keep all styles in the stable, version-qualified stylesheet. Deferring
    // only Screen 3 and Screen 4 JavaScript avoids a second asynchronous CSS failure
    // surface while retaining the startup JavaScript ceiling.
    cssCodeSplit: false,
    // The MCP resource contract exposes one stable startup entrypoint. Screen
    // 3 and Screen 4 are separate deferred, commit-bound chunks so Screen 1/2
    // retain an independent startup ceiling. verify-build-artifact budgets all
    // stable entries, deferred screens, and the single pure diagnostic chunk;
    // every other JavaScript or stylesheet artifact is rejected.
    // The self-contained Windows/Local Preview intentionally folds deferred
    // UI and the verified large-state hydration client into one file. Keep the
    // release warning aligned with its unchanged aggregate budget while giving
    // that separately verified local artifact narrow measured headroom.
    chunkSizeWarningLimit: Math.floor((
      (selfContainedLocalPreview ? 1_332 : 1_310) * 1024
    ) / 1_000),
    rolldownOptions: {
      output: {
        codeSplitting: selfContainedLocalPreview ? false : {
          groups: [
            {
              // The deterministic Screen 2 -> 3 receipt, compact status, and
              // typed failure contracts are shared by the bridge and the
              // workspace. Keep them in one explicit preload so the stable
              // entry retains its existing per-file ceiling; the unchanged
              // aggregate startup budget still charges every delivered byte.
              name: "screen3-handoff-contract",
              test: (moduleId) =>
                /[\\/]src[\\/]core[\\/]six-screen[\\/](?:action-policy|contracts|operation-status|study-design-advice|workflow-problem)\.ts$/u
                  .test(moduleId),
              includeDependenciesRecursively: false,
              priority: 4,
            },
            {
              // Canonical workflow addressing, the Screen 5 run contract, and
              // protected host-task transport form one dependency-light state
              // boundary shared by Worker and UI. Keep it as an explicit
              // preload while charging it to the unchanged startup total.
              name: "screen5-state-contract",
              test: (moduleId) =>
                /[\\/]src[\\/]core[\\/](?:host-task-transport|six-screen[\\/](?:canonical|model-task-profiles|screen5-mechanism|screen5-historical-record|study-first-event-investigation|study-first-mechanism-comparison|workflow-response-contract))\.ts$/u
                  .test(moduleId),
              includeDependenciesRecursively: false,
              priority: 3,
            },
            {
              // Keep the shared UI/runtime seam in one deterministic preload.
              // Explicitly absorb framework, workflow-state, and compressed
              // recovery transport modules that Rolldown would otherwise emit
              // as unnamed startup dependencies, while the
              // compatibility/scoring engine stays separate.
              name: "screen02-runtime",
              test: (moduleId) =>
                /[\\/]src[\\/]core[\\/]screen02-(?:state-envelope|workflow-state|workflow-types)\.ts$/u
                  .test(moduleId) ||
                /[\\/]src[\\/]core[\\/]scope-types\.ts$/u
                  .test(moduleId) ||
                /[\\/]src[\\/]core[\\/]six-screen[\\/]recovery-snapshot\.ts$/u
                  .test(moduleId) ||
                /[\\/]node_modules[\\/]react[\\/]/u.test(moduleId),
              includeDependenciesRecursively: false,
              priority: 2,
            },
            {
              // Keep reusable relevance, qualification compatibility, and
              // synchronous bridge validation in one named, budgeted preload.
              name: "screen02-engine",
              test: (moduleId) =>
                /[\\/]src[\\/]core[\\/]screen02-(?:context-bridge|deterministic-json|discovery|discovery-contract|document-acquisition|event-name|formal-identifier|native-industry-relevance|qualification|qualification-codec|relevance-profile|service|shock-glance|source-grounding|state-capacity|types)\.ts$/u
                  .test(moduleId) ||
                /[\\/]src[\\/]core[\\/](?:reviewed-event-aliases|scope-alignment|scope-extractor|scope-validation|screen01-context-codec|screen01-scope-confirmation|shockaudit-version|study-context)\.ts$/u
                  .test(moduleId) ||
                /[\\/]node_modules[\\/]fflate[\\/]/u.test(moduleId),
              includeDependenciesRecursively: false,
              priority: 1,
            },
          ],
        },
        entryFileNames: "assets/shockaudit-app.js",
        chunkFileNames: `assets/shockaudit-[name]-${buildCommit}.js`,
        assetFileNames: (assetInfo) =>
          assetInfo.names.some((name) => name.endsWith(".css"))
            ? "assets/shockaudit-app.css"
            : "assets/shockaudit-[name][extname]",
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // The integration and Worker suites exercise several crypto-heavy paths.
    // Leave headroom so parallel transforms cannot starve network-budget and
    // crypto-heavy runtime cases on clean CI machines. The bounded runtime
    // journeys share CPU-heavy integrity validation. Use an explicit bound so
    // container CPU quotas cannot be oversubscribed by a large host-reported
    // processor count.
    maxWorkers: 2,
    testTimeout: 15_000,
  },
});
