import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const assets = path.join(dist, "assets");
const html = await readFile(path.join(dist, "index.html"), "utf8");

function fail(message) {
  throw new Error(`Local preview artifact check failed: ${message}`);
}

if (!html.includes('<meta name="shockaudit-ui-delivery" content="self-contained" />')) {
  fail("dist/index.html is missing the self-contained delivery marker.");
}
if (!html.includes('<div id="root">')) {
  fail("dist/index.html is missing the ShockAudit root.");
}
if (/rel=["']modulepreload["']/u.test(html)) {
  fail("the local preview still emits modulepreload tags.");
}

const references = [...html.matchAll(/\/assets\/([^"'<> ]+)/gu)]
  .map((match) => match[1].split("?")[0])
  .sort();
const expectedReferences = ["shockaudit-app.css", "shockaudit-app.js"];
if (JSON.stringify(references) !== JSON.stringify(expectedReferences)) {
  fail(`expected only the stable app and stylesheet references, received ${JSON.stringify(references)}.`);
}

const emitted = (await readdir(assets)).sort();
const emittedJs = emitted.filter((name) => name.endsWith(".js"));
const emittedCss = emitted.filter((name) => name.endsWith(".css"));
if (JSON.stringify(emittedJs) !== JSON.stringify(["shockaudit-app.js"])) {
  fail(`expected one JavaScript bundle, received ${JSON.stringify(emittedJs)}.`);
}
if (JSON.stringify(emittedCss) !== JSON.stringify(["shockaudit-app.css"])) {
  fail(`expected one stylesheet, received ${JSON.stringify(emittedCss)}.`);
}

const jsPath = path.join(assets, "shockaudit-app.js");
const cssPath = path.join(assets, "shockaudit-app.css");
const [js, css, jsStat, cssStat] = await Promise.all([
  readFile(jsPath, "utf8"),
  readFile(cssPath, "utf8"),
  stat(jsPath),
  stat(cssPath),
]);
if (!jsStat.isFile() || jsStat.size === 0 || !cssStat.isFile() || cssStat.size === 0) {
  fail("the local preview app or stylesheet is empty.");
}
if (/shockaudit-[A-Za-z0-9_-]+-(?:[0-9a-f]{7}|local)\.js/u.test(js)) {
  fail("the single local bundle still references a commit-bound JavaScript chunk.");
}
const totalBytes = Buffer.byteLength(html) + Buffer.byteLength(js) + Buffer.byteLength(css);
if (totalBytes > 8 * 1024 * 1024) {
  fail(`the self-contained component source is ${totalBytes} bytes, above the 8 MiB local source ceiling.`);
}
const encodedPayloadBytes =
  4 * Math.ceil(Buffer.byteLength(js) / 3) +
  4 * Math.ceil(Buffer.byteLength(css) / 3);
const projectedResourceBytes =
  Buffer.byteLength(html) + encodedPayloadBytes + 16 * 1024;
if (projectedResourceBytes > 14 * 1024 * 1024) {
  fail(
    `the projected base64 MCP component is ${projectedResourceBytes} bytes, above the 14 MiB local response ceiling.`,
  );
}

console.log(
  `Verified self-contained local ChatGPT preview artifact: ${jsStat.size} JS bytes, ${cssStat.size} CSS bytes, ${totalBytes} source bytes, ${projectedResourceBytes} projected MCP bytes.`,
);
