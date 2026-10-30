import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "vite";
import { expect, it } from "vitest";

import productionConfig from "../../vite.config";

it("finalizes and executes nested imports in renamed deferred production chunks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "shockaudit-deferred-build-"));
  try {
    await Promise.all(["screen-03", "screen-04"].map((name) =>
      mkdir(path.join(root, name))
    ));
    const files = {
      "package.json": '{"type":"module"}',
      "index.html": '<div id="root"></div><script type="module" src="/main.ts"></script>',
      "style.css": "body { color: black; }",
      "main.ts": `import "./style.css";
        export const shared = "shared";
        globalThis.loadScreen03 = () => import("./screen-03/Screen03.tsx");
        globalThis.loadScreen04 = () => import("./screen-04/Screen04.tsx");`,
      "screen-03/Screen03.tsx": `import { shared } from "../main";
        export async function run() {
          return shared + ":" + (await import("../HostTaskStatusPanel")).status;
        }`,
      "screen-04/Screen04.tsx": `import { shared } from "../main";
        export async function run() {
          return shared + ":" + (await import("../screen04-advanced-diagnostics")).diagnose();
        }`,
      "HostTaskStatusPanel.ts": 'import { suffix } from "./nested-helper"; export const status = "ready" + suffix;',
      "screen04-advanced-diagnostics.ts": 'import { suffix } from "./nested-helper"; export function diagnose() { return "diagnostics ran" + suffix; }',
      "nested-helper.ts": 'export const suffix = String(globalThis.fixtureSuffix ?? "");',
    };
    await Promise.all(Object.entries(files).map(([name, contents]) =>
      writeFile(path.join(root, name), contents)
    ));
    await build({
      ...productionConfig,
      configFile: false,
      root,
      logLevel: "silent",
      build: {
        ...productionConfig.build,
        outDir: "dist",
        // The Node execution below does not need the browser entry polyfill.
        modulePreload: { polyfill: false },
      },
    });
    const assets = path.join(root, "dist/assets");
    const names = await readdir(assets);
    const scripts = names.filter((name) => name.endsWith(".js"));
    for (const name of scripts) {
      const code = await readFile(path.join(assets, name), "utf8");
      expect(code, name).not.toMatch(/\b__VITE_(?:PRELOAD|IS_MODERN)__\b/u);
      for (const match of code.matchAll(/["']((?:\.\/)?(?:assets\/)?shockaudit-[^"']+\.js)(?:\?[^"']*)?["']/gu)) {
        expect(names, `${name} references ${match[1]}`).toContain(path.basename(match[1]));
      }
    }
    const screenNames = ["03", "04"].map((screen) => {
      const matches = names.filter((name) => new RegExp(`^shockaudit-screen${screen}-[a-z0-9]+\\.js$`, "u").test(name));
      expect(matches).toHaveLength(1);
      return matches[0]!;
    });
    const results = execFileSync(process.execPath, [
      "--input-type=module",
      "--eval",
      `const links = [];
       globalThis.document = {
         createElement: () => ({ relList: { supports: () => true } }),
         getElementsByTagName: () => links,
         querySelector: () => null,
         head: { appendChild: (link) => links.push(link) },
       };
       const results = [];
       for (const url of ${JSON.stringify(screenNames.map((name) => pathToFileURL(path.join(assets, name)).href))}) {
         results.push(await (await import(url)).run());
       }
       console.log(JSON.stringify({ results, preloaded: links.map((link) => link.href) }));`,
    ], { encoding: "utf8", timeout: 10_000 });
    const execution = JSON.parse(results);
    expect(execution.results).toEqual(["shared:ready", "shared:diagnostics ran"]);
    const helperName = names.find((name) => name.startsWith("shockaudit-nested-helper-"));
    expect(helperName).toBeDefined();
    expect(execution.preloaded.map((url: string) => path.basename(url))).toContain(helperName);
    for (const url of execution.preloaded) {
      expect(names, `preloaded ${url}`).toContain(path.basename(url));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
