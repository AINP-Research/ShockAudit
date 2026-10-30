import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type GateId = `G${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
type CaseStatus = "NOT_RUN" | "PARTIAL";
type GateStatus =
  | "NOT_RUN"
  | "IN_PROGRESS"
  | "PASS"
  | "BLOCKED_BROWSER"
  | "BLOCKED_OWNER_HOST"
  | "LIVE_NOT_RUN"
  | "PUBLICATION_NOT_AUTHORIZED";

interface CatalogCase {
  id: string;
  required_gates: GateId[];
  initial_status: "NOT_RUN";
}

interface Catalog {
  schema_version: string;
  package_id: string;
  status: "NOT_RUN";
  case_count: number;
  cases: CatalogCase[];
}

interface EvidenceDefinition {
  path: string;
  testName: string;
  class: "EXECUTABLE_NOT_FINAL_GATE";
}

interface ExecutionRecord {
  id: string;
  gate: GateId;
  result: "PASS" | "FAIL";
  kind: string;
  command: string;
  testedCommit: string;
  testedTree: string;
  artifactPaths: string[];
  authorizationRef?: string;
  browserEngine?: string;
  processRestartObserved?: boolean;
  providerCalls?: number;
  sourceCalls?: number;
  semanticReview?: boolean;
  nonForce?: boolean;
  readbackCommit?: string;
  readbackTree?: string;
}

interface EvidenceManifest {
  schema: string;
  packageId: string;
  candidate: {
    repository: string;
    branch: string;
    state: "DIRTY" | "CLEAN_FROZEN";
    baselineCommit: string;
    baselineTree: string;
    testedCommit: string | null;
    testedTree: string | null;
    publicationStatus: "NOT_AUTHORIZED_FOR_NEW_TREE" | "AUTHORIZED" | "PUBLISHED";
  };
  packageSources: Array<{
    role: string;
    path: string;
    sha256: string;
  }>;
  statusDefinitions: Record<CaseStatus, string>;
  gateStatusDefinitions: Record<GateStatus, string>;
  gates: Record<GateId, {
    status: GateStatus;
    evidenceRecordIds: string[];
    limitation: string;
  }>;
  evidenceDefinitions: Record<string, EvidenceDefinition>;
  executionRecords: ExecutionRecord[];
  cases: Array<{
    id: string;
    requiredGates: GateId[];
    status: CaseStatus;
    evidenceIds: string[];
  }>;
}

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const evidencePath = new URL("./v26-handoff-evidence.json", import.meta.url);
const manifest = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceManifest;
const expectedCaseIds = Array.from(
  { length: 80 },
  (_, index) => `AC${String(index + 1).padStart(3, "0")}`,
);
const expectedGateIds = Array.from(
  { length: 9 },
  (_, index) => `G${index}` as GateId,
);

function absoluteRepositoryPath(path: string): string {
  const absolute = resolve(repositoryRoot, path);
  const withinRepository = relative(repositoryRoot, absolute);
  expect(
    isAbsolute(withinRepository) || withinRepository.startsWith(".."),
    `${path} must stay within the repository`,
  ).toBe(false);
  return absolute;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function exactCandidate(record: ExecutionRecord): void {
  expect(manifest.candidate.state).toBe("CLEAN_FROZEN");
  expect(manifest.candidate.testedCommit).toMatch(/^[0-9a-f]{40}$/u);
  expect(manifest.candidate.testedTree).toMatch(/^[0-9a-f]{40}$/u);
  expect(record.testedCommit).toBe(manifest.candidate.testedCommit);
  expect(record.testedTree).toBe(manifest.candidate.testedTree);
}

describe("v26 handoff acceptance evidence", () => {
  it("pins the current 80-case package sources by exact hash", () => {
    expect(manifest.packageId).toBe("shockaudit-local-handoff-recovery-2026-09-25-r1");
    expect(manifest.packageSources.map(({ role }) => role)).toEqual([
      "acceptance_catalog",
      "synthetic_fixtures",
      "action_policy_traceability",
    ]);

    for (const source of manifest.packageSources) {
      const absolute = absoluteRepositoryPath(source.path);
      expect(statSync(absolute).isFile(), source.path).toBe(true);
      expect(sha256(absolute), source.path).toBe(source.sha256);
    }
  });

  it("covers AC001 through AC080 exactly and preserves catalog gates", () => {
    const catalogSource = manifest.packageSources.find(
      ({ role }) => role === "acceptance_catalog",
    );
    expect(catalogSource).toBeDefined();
    const catalog = JSON.parse(
      readFileSync(absoluteRepositoryPath(catalogSource!.path), "utf8"),
    ) as Catalog;

    expect(catalog.schema_version).toBe("shockaudit-handoff-acceptance-spec-v1");
    expect(catalog.package_id).toBe(manifest.packageId);
    expect(catalog.status).toBe("NOT_RUN");
    expect(catalog.case_count).toBe(80);
    expect(catalog.cases.map(({ id }) => id)).toEqual(expectedCaseIds);
    expect(catalog.cases.every(({ initial_status }) => initial_status === "NOT_RUN")).toBe(true);

    expect(manifest.cases.map(({ id }) => id)).toEqual(expectedCaseIds);
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(80);
    const catalogById = new Map(catalog.cases.map((entry) => [entry.id, entry]));
    for (const acceptanceCase of manifest.cases) {
      expect(acceptanceCase.requiredGates, acceptanceCase.id).toEqual(
        catalogById.get(acceptanceCase.id)?.required_gates,
      );
      expect(["NOT_RUN", "PARTIAL"], acceptanceCase.id).toContain(
        acceptanceCase.status,
      );
      if (acceptanceCase.status === "PARTIAL") {
        expect(acceptanceCase.evidenceIds.length, acceptanceCase.id).toBeGreaterThan(0);
      } else {
        expect(acceptanceCase.evidenceIds, acceptanceCase.id).toEqual([]);
      }
    }
  });

  it("resolves every declared executable evidence path and exact test title", () => {
    const definitions = new Set(Object.keys(manifest.evidenceDefinitions));
    for (const acceptanceCase of manifest.cases) {
      for (const evidenceId of acceptanceCase.evidenceIds) {
        expect(definitions, `${acceptanceCase.id}: ${evidenceId}`).toContain(evidenceId);
      }
    }

    for (const [evidenceId, evidence] of Object.entries(manifest.evidenceDefinitions)) {
      const absolute = absoluteRepositoryPath(evidence.path);
      expect(statSync(absolute).isFile(), evidenceId).toBe(true);
      expect(/\.test\.[cm]?[jt]sx?$/u.test(evidence.path), evidenceId).toBe(true);
      expect(
        readFileSync(absolute, "utf8").includes(JSON.stringify(evidence.testName)),
        `${evidenceId}: exact title must exist in ${evidence.path}`,
      ).toBe(true);
    }
  });

  it("keeps every gate explicit and binds claimed evidence to known records", () => {
    expect(Object.keys(manifest.gates)).toEqual(expectedGateIds);
    const records = new Map(manifest.executionRecords.map((record) => [record.id, record]));
    expect(records.size).toBe(manifest.executionRecords.length);

    for (const record of records.values()) {
      expect(record.command.trim().length, record.id).toBeGreaterThan(0);
      expect(record.artifactPaths.length, record.id).toBeGreaterThan(0);
      for (const artifactPath of record.artifactPaths) {
        expect(statSync(absoluteRepositoryPath(artifactPath)).isFile(), record.id).toBe(true);
      }
    }

    for (const gateId of expectedGateIds) {
      const gate = manifest.gates[gateId];
      expect(gate.limitation.trim().length, gateId).toBeGreaterThan(0);
      for (const recordId of gate.evidenceRecordIds) {
        const record = records.get(recordId);
        expect(record, `${gateId}: ${recordId}`).toBeDefined();
        expect(record?.gate, recordId).toBe(gateId);
      }
      if (gate.status === "PASS") {
        expect(gate.evidenceRecordIds.length, gateId).toBeGreaterThan(0);
        expect(
          gate.evidenceRecordIds.some((id) => records.get(id)?.result === "PASS"),
          gateId,
        ).toBe(true);
      }
    }
  });

  it("does not turn an in-progress dirty worktree into a frozen or published candidate", () => {
    if (manifest.candidate.state !== "DIRTY") return;
    expect(manifest.candidate.testedCommit).toBeNull();
    expect(manifest.candidate.testedTree).toBeNull();
    expect([
      "NOT_AUTHORIZED_FOR_NEW_TREE",
      "AUTHORIZED",
    ]).toContain(manifest.candidate.publicationStatus);
    expect(manifest.gates.G5.status).not.toBe("PASS");
    if (manifest.candidate.publicationStatus === "AUTHORIZED") {
      expect(manifest.gates.G8.status).toBe("IN_PROGRESS");
    } else {
      expect(manifest.gates.G8.status).toBe("PUBLICATION_NOT_AUTHORIZED");
    }
  });

  it("rejects browser, persistence, owner, live, and publication passes without exact evidence", () => {
    const passRecords = (gate: GateId): ExecutionRecord[] =>
      manifest.gates[gate].evidenceRecordIds
        .map((id) => manifest.executionRecords.find((record) => record.id === id))
        .filter((record): record is ExecutionRecord => record?.result === "PASS");

    if (manifest.gates.G3.status === "PASS") {
      const browser = passRecords("G3").find((record) => record.kind === "browser");
      expect(browser).toBeDefined();
      exactCandidate(browser!);
      expect(browser!.browserEngine?.trim().length ?? 0).toBeGreaterThan(0);
      expect(browser!.artifactPaths.length).toBeGreaterThan(0);
    }

    if (manifest.gates.G4.status === "PASS") {
      const persistence = passRecords("G4").find(
        (record) => record.kind === "local_persistence",
      );
      expect(persistence).toBeDefined();
      exactCandidate(persistence!);
      expect(persistence!.processRestartObserved).toBe(true);
      expect(persistence!.artifactPaths.length).toBeGreaterThan(0);
    }

    if (manifest.gates.G6.status === "PASS") {
      const owner = passRecords("G6").find((record) => record.kind === "owner_host");
      expect(owner).toBeDefined();
      exactCandidate(owner!);
      expect(owner!.authorizationRef?.trim().length ?? 0).toBeGreaterThan(0);
      expect(owner!.artifactPaths.length).toBeGreaterThan(0);
    }

    if (manifest.gates.G7.status === "PASS") {
      const live = passRecords("G7").find((record) => record.kind === "live_quality");
      expect(live).toBeDefined();
      exactCandidate(live!);
      expect(live!.authorizationRef?.trim().length ?? 0).toBeGreaterThan(0);
      expect((live!.providerCalls ?? 0) + (live!.sourceCalls ?? 0)).toBeGreaterThan(0);
      expect(live!.semanticReview).toBe(true);
    }

    if (manifest.gates.G8.status === "PASS" || manifest.candidate.publicationStatus === "PUBLISHED") {
      const publication = passRecords("G8").find(
        (record) => record.kind === "publication",
      );
      expect(publication).toBeDefined();
      exactCandidate(publication!);
      expect(publication!.authorizationRef?.trim().length ?? 0).toBeGreaterThan(0);
      expect(publication!.nonForce).toBe(true);
      expect(publication!.readbackCommit).toBe(manifest.candidate.testedCommit);
      expect(publication!.readbackTree).toBe(manifest.candidate.testedTree);
    }
  });
});
