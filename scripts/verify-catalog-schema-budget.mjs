import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = resolve(root, "docs/qualification");
const maximumSchemaBytes = 32 * 1024;
const maximumCombinedSchemaBytes = 128 * 1024;
const maximumBenchmarkBytes = 256 * 1024;
const issues = [];

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else output.push(path);
  }
  return output;
}

const schemaFiles = (await filesBelow(schemaRoot)).filter((path) => path.endsWith(".schema.json"));
let combined = 0;
for (const path of schemaFiles) {
  const bytes = await readFile(path);
  combined += bytes.byteLength;
  if (bytes.byteLength > maximumSchemaBytes) {
    issues.push(`${relative(root, path)}: ${bytes.byteLength} bytes exceeds ${maximumSchemaBytes}`);
  }
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (parsed?.type !== "object" || parsed?.additionalProperties !== false) {
      issues.push(`${relative(root, path)}: root must be a closed object schema`);
    }
  } catch (error) {
    issues.push(`${relative(root, path)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}
if (combined > maximumCombinedSchemaBytes) issues.push(`combined schema bytes ${combined} exceed ${maximumCombinedSchemaBytes}`);

const benchmarkFiles = (await filesBelow(resolve(root, "tests/benchmarks/fixtures"))).filter((path) => path.endsWith(".json"));
for (const path of benchmarkFiles) {
  const bytes = await readFile(path);
  if (bytes.byteLength > maximumBenchmarkBytes) issues.push(`${relative(root, path)}: benchmark exceeds ${maximumBenchmarkBytes} bytes`);
  try { JSON.parse(bytes.toString("utf8")); } catch (error) {
    issues.push(`${relative(root, path)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

const catalogTest = await readFile(resolve(root, "tests/worker/mcp-http.test.ts"), "utf8");
if (!catalogTest.includes(".toBeLessThan(64 * 1024)")) {
  issues.push("tests/worker/mcp-http.test.ts: missing 64 KiB serialized tools/list budget assertion");
}

if (issues.length > 0) {
  console.error(`Catalog/schema budget failed (${issues.length} issue${issues.length === 1 ? "" : "s"}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Catalog/schema budget passed: ${schemaFiles.length} closed schemas, ${combined}/${maximumCombinedSchemaBytes} combined bytes; tools/list remains capped at 64 KiB by its runtime contract test.`);
}
