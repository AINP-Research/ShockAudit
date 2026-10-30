import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const approvedOpenAIBoundary = new Map([
  ["src/worker/screen5-openai-transport.ts", [
    "api.openai.com",
    "api.openai.com",
  ]],
  ["src/worker/server.ts", [
    "OPENAI_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_API_KEY",
  ]],
  ["src/worker/six-screen-workflow-runtime.ts", [
    "OPENAI_API_KEY",
    "OPENAI_API_KEY",
  ]],
]);
const checks = [
  ["src", /api\.openai\.com|OPENAI_API_KEY|new\s+OpenAI\s*\(/giu, "OpenAI API inference"],
  ["src", /(?:env\.)?AI\.(?:run|models)|WorkersAI\s*\(/gu, "Cloudflare Workers AI inference"],
  ["src/ui", /requestSampling|sampling\/createMessage|channel:\s*["']mcp-sampling["']/gu, "MCP sampling"],
  ["src", /OmniGPT|omnigpt|localhost.*(?:model|inference)/giu, "OmniGPT or localhost model gateway"],
  ["src", /from\s+["'](?:playwright|playwright-core|patchright|puppeteer)["']/gu, "consumer-session browser automation dependency"],
  ["src", /chatgpt.{0,80}(?:cookie|sessionStorage|localStorage|querySelector|getElementById)|(?:querySelector|getElementById).{0,80}chatgpt/giu, "ChatGPT DOM/session capture"],
  ["src/core/screen02-qualification.ts", /function\s+industryLexicon\s*\(|VIDEO_GAME_DIRECT_TERMS|MANUFACTURING_DIRECT_TERMS|BANKING_DIRECT_TERMS|ENERGY_DIRECT_TERMS/gu, "named-industry qualification algorithm branch"],
  ["src/core/scope-extractor.ts", /\b(?:ccpa|gdpr|cpra|sox)\b|california\s+consumer\s+privacy\s+act|california\s+privacy\s+rights\s+act|general\s+data\s+protection\s+regulation|sarbanes[-–]oxley/giu, "named-event scope-extraction decision logic"],
  ["src/core/screen02-find-workflow.ts", /\b(?:ccpa|gdpr|cpra|sox)\b|california\s+consumer\s+privacy\s+act|california\s+privacy\s+rights\s+act|general\s+data\s+protection\s+regulation|sarbanes[-–]oxley/giu, "named-event Find workflow decision logic"],
  ["src/core/screen02-audit-discovery.ts", /familySignals|family:\s*["']ccpa["']\s*\|\s*["']gdpr["']/giu, "named-event audit-discovery routing branch"],
  ["src/core/screen02-workflow-state.ts", /reviewedCcpaAnchorNames|exactCcpaWording|explicitCcpaYear/gu, "candidate-title workflow exception"],
  ["src/core/screen02-workflow-handoff.ts", /auditOriginalWordingMatchesBaseline|\["ccpa",\s*"california consumer privacy act"\]/gu, "event-title handoff exception"],
  ["src/worker/server.ts", /const\s+controlledAliases\s*=\s*\[/gu, "named-event server decision table"],
];
const issues = [];
const approvedLocalPreviewOpenAIFiles = new Set();

for (const [relativePath, expectedMatches] of approvedOpenAIBoundary) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  const actualMatches = [...source.matchAll(
    /api\.openai\.com|OPENAI_API_KEY|new\s+OpenAI\s*\(/giu,
  )].map((match) => match[0]);
  if (JSON.stringify(actualMatches) !== JSON.stringify(expectedMatches)) {
    issues.push(
      `${relativePath}: approved OpenAI boundary changed; expected ${JSON.stringify(expectedMatches)}, received ${JSON.stringify(actualMatches)}`,
    );
    continue;
  }
  approvedLocalPreviewOpenAIFiles.add(relativePath);
}

async function walk(path) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(child));
    else if (/\.(?:ts|tsx|js|jsx|mjs|jsonc)$/u.test(entry.name)) files.push(child);
  }
  return files;
}

for (const [scope, pattern, description] of checks) {
  const scopePath = resolve(root, scope);
  const candidates = /\.[a-z]+$/iu.test(scope) ? [scopePath] : await walk(scopePath);
  for (const path of candidates) {
    const text = await readFile(path, "utf8");
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const relativePath = relative(root, path);
      if (
        description === "OpenAI API inference" &&
        approvedLocalPreviewOpenAIFiles.has(relativePath)
      ) continue;
      const line = text.slice(0, match.index).split("\n").length;
      issues.push(`${relativePath}:${line}: ${description}: ${JSON.stringify(match[0].slice(0, 120))}`);
    }
  }
}

const productionConfig = await readFile(resolve(root, "wrangler.jsonc"), "utf8");
for (const [pattern, description] of [
  [/"ai"\s*:/giu, "Workers AI binding"],
  [/OMNIGPT/giu, "prohibited model gateway"],
  [/"name"\s*:\s*"shockaudit-stage6/gu, "candidate Worker identity"],
]) {
  if (pattern.test(productionConfig)) issues.push(`wrangler.jsonc: ${description}`);
}
const requiredSecretNames = ["OPENAI_API_KEY", "OPENSTATES_API_KEY"];
const requiredSecretList = productionConfig.match(
  /"secrets"\s*:\s*\{[\s\S]*?"required"\s*:\s*\[([\s\S]*?)\][\s\S]*?\}/u,
)?.[1] ?? "";
for (const secretName of requiredSecretNames) {
  const escapedName = secretName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const occurrences = productionConfig.match(new RegExp(escapedName, "gu")) ?? [];
  if (
    occurrences.length !== 1 ||
    !new RegExp(`"${escapedName}"`, "u").test(requiredSecretList) ||
    new RegExp(`"${escapedName}"\\s*:`, "u").test(productionConfig)
  ) {
    issues.push(
      `wrangler.jsonc: ${secretName} must appear exactly once as a required encrypted secret name and never as a value binding`,
    );
  }
}
if (!/"SHOCKAUDIT_SCREEN5_OPENAI_MODE"\s*:\s*"production"/u
  .test(productionConfig)) {
  issues.push("wrangler.jsonc: production OpenAI runtime mode is not enabled");
}

const packageFile = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
for (const name of Object.keys(packageFile.scripts ?? {})) {
  if (/deploy:candidate/u.test(name)) issues.push(`package.json: current script ${name} deploys a prohibited candidate Worker`);
}
const ci = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
if (/wrangler\.stage6-(?:on-)?preview\.jsonc/u.test(ci)) {
  issues.push(".github/workflows/ci.yml: current CI references a historical candidate-Worker config");
}

if (issues.length > 0) {
  console.error(`Prohibited production-path audit failed (${issues.length} hit${issues.length === 1 ? "" : "s"}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Prohibited production-path audit passed: the exact OpenAI boundary is unchanged, production requires its encrypted provider keys and explicit runtime mode, and no other paid inference, sampling, consumer-session automation, named-industry bypass, or named-event exception is present.");
}
