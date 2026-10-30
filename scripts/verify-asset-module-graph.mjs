function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Extract relative JavaScript module specifiers emitted by the production
 * bundler. Both static imports (`from "..."` and `import "..."`) and literal
 * dynamic imports (`import("...")`) are included.
 */
export function localJavaScriptModuleSpecifiers(source) {
  assert(typeof source === "string", "A JavaScript module body is required.");
  const specifiers = [];
  const patterns = [
    /\bfrom\s*["']([^"'\r\n]+)["']/gu,
    /\bimport\s*(?:\(\s*)?["']([^"'\r\n]+)["']/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (
        (specifier.startsWith("./") ||
          specifier.startsWith("../") ||
          specifier.startsWith("/")) &&
        /\.js(?:\?|$)/u.test(specifier)
      ) {
        specifiers.push(specifier);
      }
    }
  }
  return [...new Set(specifiers)].sort();
}

function assertModuleUrl(
  url,
  { publicOrigin, expectedCommitShort, expectedReleaseLabel },
) {
  const parsed = new URL(url);
  assert(
    parsed.origin === publicOrigin &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hash === "",
    `The module graph escaped the production asset origin: ${url}`,
  );
  const stableAppUrl =
    `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`;
  const commitBoundPattern = new RegExp(
    `^/assets/shockaudit-[A-Za-z0-9-]+-${expectedCommitShort}\\.js$`,
    "u",
  );
  assert(
    parsed.href === stableAppUrl ||
      (parsed.search === "" && commitBoundPattern.test(parsed.pathname)),
    `The module graph referenced an unversioned or cross-build JavaScript asset: ${parsed.href}`,
  );
}

/**
 * Fetch and validate every relative JavaScript import reachable from a
 * commit-bound entry module. Cycles are expected in the shared runtime graph
 * and are bounded by the visited set.
 */
export async function verifyAssetModuleGraph({
  entryUrl,
  publicOrigin,
  expectedCommitShort,
  expectedReleaseLabel,
  requiredEntrySpecifiers = [],
  fetchModule,
}) {
  assert(
    typeof fetchModule === "function",
    "A module-graph fetch function is required.",
  );
  const policy = {
    publicOrigin,
    expectedCommitShort,
    expectedReleaseLabel,
  };
  const pending = [new URL(entryUrl).href];
  const visited = new Set();
  const edges = [];
  let entrySpecifiers = null;

  while (pending.length > 0) {
    const moduleUrl = pending.shift();
    if (visited.has(moduleUrl)) continue;
    assertModuleUrl(moduleUrl, policy);
    const source = await fetchModule(moduleUrl);
    assert(
      typeof source === "string" &&
        source.length > 0 &&
        !source.toLowerCase().includes("<!doctype html"),
      `The module graph returned an empty or HTML body for ${moduleUrl}.`,
    );
    visited.add(moduleUrl);

    const specifiers = localJavaScriptModuleSpecifiers(source);
    if (moduleUrl === new URL(entryUrl).href) entrySpecifiers = specifiers;
    for (const specifier of specifiers) {
      const dependencyUrl = new URL(specifier, moduleUrl).href;
      assertModuleUrl(dependencyUrl, policy);
      edges.push({
        from: new URL(moduleUrl).pathname,
        to: `${new URL(dependencyUrl).pathname}${new URL(dependencyUrl).search}`,
      });
      if (!visited.has(dependencyUrl)) pending.push(dependencyUrl);
    }
  }

  assert(entrySpecifiers !== null, "The module-graph entry was not visited.");
  for (const requiredSpecifier of requiredEntrySpecifiers) {
    assert(
      entrySpecifiers.includes(requiredSpecifier),
      `The primary Screen 2 Find chunk omitted required import ${requiredSpecifier}.`,
    );
  }

  return {
    entryPath: new URL(entryUrl).pathname,
    modulePaths: [...visited]
      .map((url) => `${new URL(url).pathname}${new URL(url).search}`)
      .sort(),
    edges: edges.sort((left, right) =>
      `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`)
    ),
  };
}
