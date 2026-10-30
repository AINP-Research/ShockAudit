import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SyntaxKind } from "typescript/unstable/ast";
import { createScanner } from "typescript/unstable/ast/scanner";
import { describe, expect, it } from "vitest";

type AcceptanceLevel =
  | "controlled"
  | "browser_controlled"
  | "local_persistence"
  | "owner_host"
  | "live_quality"
  | "delivery";

type EvidenceStatus =
  | "FULL_AUTOMATED"
  | "PARTIAL"
  | "BROWSER_BLOCKED"
  | "LOCAL_PERSISTENCE_PENDING"
  | "OWNER_BLOCKED"
  | "LIVE_NOT_RUN"
  | "DELIVERY_NOT_AUTHORIZED";

type EvidenceClass =
  | "EXECUTABLE"
  | "SSR_SUPPORT"
  | "STATIC_SUPPORT"
  | "DISCOVERED_NOT_RUN"
  | "IN_MEMORY_ONLY";

interface EvidenceReference {
  path: string;
  testName: string;
  class: EvidenceClass;
}

interface EvidenceCase {
  id: string;
  level: AcceptanceLevel;
  status: EvidenceStatus;
  evidence: EvidenceReference[];
  gap: string | null;
}

interface EvidenceManifest {
  catalog: { path: string; caseCount: number };
  statusDefinitions: Record<string, string>;
  evidenceClasses: Record<string, string>;
  cases: EvidenceCase[];
}

interface AcceptanceCatalog {
  cases: Array<{ id: string; level: AcceptanceLevel }>;
}

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL("./acceptance-evidence.json", import.meta.url), "utf8"),
) as EvidenceManifest;

const expectedIds = Array.from(
  { length: 85 },
  (_, index) => `AC${String(index + 1).padStart(3, "0")}`,
);

const approvedStatuses = [
  "BROWSER_BLOCKED",
  "DELIVERY_NOT_AUTHORIZED",
  "FULL_AUTOMATED",
  "LIVE_NOT_RUN",
  "LOCAL_PERSISTENCE_PENDING",
  "OWNER_BLOCKED",
  "PARTIAL",
] as const satisfies readonly EvidenceStatus[];

const approvedEvidenceClasses = [
  "DISCOVERED_NOT_RUN",
  "EXECUTABLE",
  "IN_MEMORY_ONLY",
  "SSR_SUPPORT",
  "STATIC_SUPPORT",
] as const satisfies readonly EvidenceClass[];

const gatedStatusByLevel: Partial<Record<AcceptanceLevel, EvidenceStatus>> = {
  browser_controlled: "BROWSER_BLOCKED",
  owner_host: "OWNER_BLOCKED",
  live_quality: "LIVE_NOT_RUN",
  delivery: "DELIVERY_NOT_AUTHORIZED",
};

const stringLiteralCache = new Map<string, Set<string>>();

function sourceStringLiterals(path: string): Set<string> {
  const cached = stringLiteralCache.get(path);
  if (cached) return cached;

  const scanner = createScanner(true, undefined, readFileSync(path, "utf8"));
  const literals = new Set<string>();
  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFile; token = scanner.scan()) {
    if (
      token === SyntaxKind.StringLiteral ||
      token === SyntaxKind.NoSubstitutionTemplateLiteral
    ) {
      literals.add(scanner.getTokenValue());
    }
  }
  stringLiteralCache.set(path, literals);
  return literals;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isCredibleTestTitle(path: string, testName: string): boolean {
  const source = readFileSync(path, "utf8");
  if (source.includes(JSON.stringify(testName))) return true;
  const literals = sourceStringLiterals(path);
  if (literals.has(testName)) return true;

  for (const template of literals) {
    if (!/%[sdifjo]/u.test(template)) continue;
    const pattern = new RegExp(
      `^${escapeRegExp(template).replace(/%[sdifjo]/gu, "(.+?)")}$`,
      "u",
    );
    const match = pattern.exec(testName);
    if (match && match.slice(1).every((value) => literals.has(value))) return true;
  }
  return false;
}

describe("acceptance evidence manifest", () => {
  it("covers AC001 through AC085 exactly once and matches the source catalog", () => {
    const ids = manifest.cases.map(({ id }) => id);
    expect(ids).toEqual(expectedIds);
    expect(new Set(ids).size).toBe(expectedIds.length);

    const catalogPath = resolve(repositoryRoot, manifest.catalog.path);
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as AcceptanceCatalog;
    expect(manifest.catalog.caseCount).toBe(expectedIds.length);
    expect(catalog.cases).toHaveLength(expectedIds.length);
    expect(catalog.cases.map(({ id }) => id)).toEqual(expectedIds);

    const catalogLevels = new Map(
      catalog.cases.map(({ id, level }) => [id, level]),
    );
    for (const acceptanceCase of manifest.cases) {
      expect(
        acceptanceCase.level,
        `${acceptanceCase.id} level must match the source catalog`,
      ).toBe(catalogLevels.get(acceptanceCase.id));
    }
  });

  it("uses only the approved status and evidence-class vocabularies", () => {
    expect(Object.keys(manifest.statusDefinitions).sort()).toEqual(
      [...approvedStatuses].sort(),
    );
    expect(Object.keys(manifest.evidenceClasses).sort()).toEqual(
      [...approvedEvidenceClasses].sort(),
    );

    for (const acceptanceCase of manifest.cases) {
      expect(approvedStatuses, acceptanceCase.id).toContain(acceptanceCase.status);
      if (acceptanceCase.status === "FULL_AUTOMATED") {
        expect(acceptanceCase.gap ?? "", `${acceptanceCase.id} gap`).toBe("");
      } else {
        expect(acceptanceCase.gap?.trim().length ?? 0,
          `${acceptanceCase.id} gap`).toBeGreaterThan(0);
      }
      for (const evidence of acceptanceCase.evidence) {
        expect(approvedEvidenceClasses, acceptanceCase.id).toContain(evidence.class);
      }

      if (acceptanceCase.status === "FULL_AUTOMATED") {
        expect(acceptanceCase.evidence.length, acceptanceCase.id).toBeGreaterThan(0);
        expect(
          acceptanceCase.evidence.every(({ class: evidenceClass }) =>
            evidenceClass === "EXECUTABLE",
          ),
          `${acceptanceCase.id} may only be fully automated by executable evidence`,
        ).toBe(true);
      }
    }
  });

  it("resolves every evidence path and exact declared test title", () => {
    for (const acceptanceCase of manifest.cases) {
      for (const evidence of acceptanceCase.evidence) {
        const absolutePath = resolve(repositoryRoot, evidence.path);
        const pathWithinRepository = relative(repositoryRoot, absolutePath);
        expect(
          isAbsolute(pathWithinRepository) || pathWithinRepository.startsWith(".."),
          `${acceptanceCase.id}: ${evidence.path} must stay within the repository`,
        ).toBe(false);
        expect(
          statSync(absolutePath).isFile(),
          `${acceptanceCase.id}: ${evidence.path} must be a file`,
        ).toBe(true);
        expect(
          /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(evidence.path),
          `${acceptanceCase.id}: ${evidence.path} must identify a test file`,
        ).toBe(true);
        expect(
          isCredibleTestTitle(absolutePath, evidence.testName),
          `${acceptanceCase.id}: ${evidence.testName} must be a source string or credible inline-each expansion in ${evidence.path}`,
        ).toBe(true);
      }
    }
  });

  it("keeps environment-gated cases in their explicit non-pass states", () => {
    for (const acceptanceCase of manifest.cases) {
      const requiredStatus = gatedStatusByLevel[acceptanceCase.level];
      if (!requiredStatus) continue;
      expect(
        acceptanceCase.status,
        `${acceptanceCase.id} (${acceptanceCase.level}) cannot pass without its external gate`,
      ).toBe(requiredStatus);
      expect(acceptanceCase.status).not.toBe("FULL_AUTOMATED");
    }
  });
});
