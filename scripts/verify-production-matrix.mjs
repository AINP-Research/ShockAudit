import { createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SIX_SCREEN_REPLACEMENT_BUILD } from
  "../src/core/six-screen/replacement-build.ts";
import {
  assertScreen02HandoffMatchesCanonicalState,
  readCanonicalWorkflowState,
  sameCanonicalJsonValue,
  screen02ContextBridgeMismatches,
} from "./live-mcp-workflow-state.mjs";
import { driveFindSearchToTerminal } from "./find-search-continuation.mjs";
import { fingerprintScreen03VerifierState } from "./live-verifier-screen03.mjs";
import { verifyAssetModuleGraph } from "./verify-asset-module-graph.mjs";

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const versionSource = await readFile(
  new URL("../src/version.ts", import.meta.url),
  "utf8",
);
const releaseLabelMatch = versionSource.match(
  /SHOCKAUDIT_UI_BUILD_LABEL\s*=\s*"([^"]+)"/u,
);
if (!releaseLabelMatch) {
  throw new Error("Could not read the current ShockAudit UI build label.");
}

const expectedVersion = packageMetadata.version;
const expectedReleaseLabel = releaseLabelMatch[1];
const expectedResourceUri =
  `ui://shockaudit/workspace-v${expectedReleaseLabel}.html`;
const defaultEvidenceDir = fileURLToPath(
  new URL("../artifacts/production-matrix/", import.meta.url),
);
const defaultBaseUrl = "https://shockaudit.ainp-research.workers.dev";
const manifestUrl = new URL("./production-matrix-cases.json", import.meta.url);
const caseManifestText = await readFile(manifestUrl, "utf8");
const caseManifest = JSON.parse(caseManifestText);
const inputManifestSha256 = createHash("sha256").update(caseManifestText).digest("hex");

const workflowMetaKey = "shockaudit/screen02-workflow-v021";
const workflowCorrelationMetaKey =
  "shockaudit/screen02-workflow-correlation-v1";
const hostReasoningMetaKey = "shockaudit/hostReasoning";
const screen03HostNativeDefaultMetaKey =
  "shockaudit/screen03HostNativeDefault";
const workflowCreateTool = "create_screen02_workflow_v024";
const workflowMutationTool = "mutate_screen02_workflow_v024";
const screen03OpenTool = "open_screen03_workflow_v030";
const screen03MutationTool = "mutate_screen03_workflow_v030";
const workflowCreateSchemaVersion = "screen-02-workflow-create-v2";
const workflowMutationSchemaVersion = "screen-02-workflow-action-v2";
const screen03OpenSchemaVersion = "screen-03-workflow-open-v1";
const screen03MutationSchemaVersion = "screen-03-workflow-mutation-v1";
const screen03ResultSchemaVersion = "screen-03-workflow-result-v1";
const evidenceSchemaVersion = "shockaudit-production-matrix-evidence-v2";
const checkpointSchemaVersion =
  "shockaudit-production-matrix-case-checkpoint-v2";
const scopeKeys = [
  "population",
  "assignmentLevel",
  "analysisLevel",
  "geography",
  "industry",
  "studyPeriod",
  "eventFamily",
  "outcomeFamily",
  "outcomeFrequency",
];
const decisionKeys = [...scopeKeys, "knownShock"];
const reviewedScreen02PositiveBindings = Object.freeze({
  "s2-us-video-gaming-regulation": Object.freeze({
    canonicalTitle: "FTC ESRB COPPA Safe Harbor Modifications",
    formalIdentifier: "ESRB COPPA Safe Harbor Program modifications",
    issuer: "Federal Trade Commission",
    issuingJurisdiction: "United States",
    sourceLocator:
      "https://www.ftc.gov/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program",
    identityPassages: [
      "FTC ESRB COPPA Safe Harbor Modifications",
    ],
    industryBridgePassages: [
      "video game industry self-regulatory program",
    ],
    populationBridgePassages: [
      "Participating video-game companies may rely on approved safe-harbor guidelines",
    ],
  }),
  "s2-us-energy-regulation": Object.freeze({
    canonicalTitle: "FERC Order 841 Electric Storage Participation Rule",
    formalIdentifier:
      "Order No. 841; 83 FR 9580; FR Doc. 2018-03708",
    issuer: "Federal Energy Regulatory Commission",
    issuingJurisdiction: "United States",
    sourceLocator:
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
    identityPassages: [
      "FERC Order 841 Electric Storage Participation Rule",
      "FR Doc. 2018-03708",
    ],
    industryBridgePassages: [
      "wholesale-market participation models for electric storage resources",
    ],
    populationBridgePassages: [
      "regional transmission organizations and independent system operators",
    ],
  }),
});
const screen03ProposalGroupKeys = [
  "identity",
  "overview",
  "timeline",
  "component",
  "eligibility",
  "amendment",
  "requiredVariable",
];
const requestTimeoutMs = 60_000;
const caseTimeoutMs = 6 * 60_000;
const protocolHeaders = { "MCP-Protocol-Version": "2025-06-18" };
export const executionFlags = Object.freeze({
  simulated: true,
  signedIn: false,
  humanInteraction: false,
  genuineHostEvidence: false,
  hostSubmissions: 0,
  formalQualification: false,
});

function assert(condition, message, code = "matrix-contract-assertion") {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasExactKeys(value, keys) {
  return isRecord(value) &&
    sameJson(Object.keys(value).sort(), [...keys].sort());
}

function serializeDeterministicJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeDeterministicJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeDeterministicJson(value[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Value is not deterministic JSON.");
}

const sensitiveEvidenceKeys = new Set([
  "accessToken",
  "capability",
  "capabilityToken",
  "receiptToken",
  "responseKey",
  "stateEnvelope",
  "sealedSnapshot",
  "sealedState",
  "rawState",
  "snapshot",
  "assessmentBatch",
  "sourcePacket",
  "modelContext",
  "draft",
  "payload",
  "interpretation",
]);
const sensitiveIdentifierKey = /^(?:(?:run|request|receipt|task|result|operation|source|evidence|proposal|candidate|match|confirmation|dossier|assessment|decision)(?:Snapshot)?Ids?|.*Fingerprint)$/u;
const privateNarrativeIdentifiers = new Set();

function rememberPrivateIdentifiers(value, key = "") {
  if (typeof value === "string") {
    if ((key === "id" || /(?:Ids?|Fingerprint)$/u.test(key)) &&
        key !== "caseId" && value.length >= 8) {
      privateNarrativeIdentifiers.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => rememberPrivateIdentifiers(item, key));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([entryKey, item]) => rememberPrivateIdentifiers(item, entryKey));
  }
}

export function sanitizeText(value) {
  let sanitized = String(value);
  for (const identifier of privateNarrativeIdentifiers) {
    sanitized = sanitized.split(identifier).join("[identifier-redacted]");
  }
  return sanitized
    .replace(/\bfnv1a64:[0-9a-f]{16}\b/giu, "[fingerprint-redacted]")
    .replace(/\bscreen0[1-4]-(?:evidence|source|proposal|claim|decision|candidate|match|workflow)-[A-Za-z0-9_-]+\b/gu, "[identifier-redacted]")
    .replace(/\bs2a_[A-Za-z0-9_-]{20,128}\b/gu, "[access-token-redacted]")
    .replace(/\bs2r_[A-Za-z0-9_-]{20,128}\b/gu, "[run-id-redacted]")
    .replace(
      /\bsa(?:1|2[fa]|3h)-(?:capability|receipt)-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
      "[signed-token-redacted]",
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu,
      "[identifier-redacted]",
    )
    .replace(
      /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/gu,
      "[signed-value-redacted]",
    );
}

export function sanitizeEvidence(value, key = "") {
  if (
    sensitiveEvidenceKeys.has(key) ||
    (key !== "caseId" && sensitiveIdentifierKey.test(key))
  ) {
    return "[redacted]";
  }
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidence(item));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, item]) => [
      entryKey,
      sanitizeEvidence(item, entryKey),
    ]),
  );
}

function safeErrorMessage(error) {
  return sanitizeText(error instanceof Error ? error.message : String(error))
    .slice(0, 800);
}

function publicFailureText(result) {
  const text = Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === "text")
      .map((item) => String(item.text ?? "")).join(" ")
    : "";
  return sanitizeText(text)
    .replace(/\b(?:Bearer\s+)[^\s,;]+/giu, "Bearer [redacted]")
    .replace(/(?:"?(?:accessToken|responseKey|capabilityToken|stateEnvelope|sealedState|rawState)"?\s*[:=]\s*)(?:"[^"\n]*"|[^\s,;}]+)/giu, "[private-value-redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/gu, "[opaque-value-redacted]")
    .slice(0, 800);
}

export function createCaseProgress() {
  return { operation: null, lastSuccessfulStep: null, completedSteps: [], observations: {} };
}

let activeCaseProgress = null;
let persistActiveCaseProgress = null;

export async function recordCaseProgress(operation, { completed = false, observations } = {}) {
  if (!activeCaseProgress) return;
  activeCaseProgress.operation = operation;
  if (completed) {
    activeCaseProgress.lastSuccessfulStep = operation;
    activeCaseProgress.completedSteps = [
      ...activeCaseProgress.completedSteps, operation,
    ].slice(-60);
  }
  if (observations) {
    Object.assign(activeCaseProgress.observations, sanitizeEvidence(observations));
  }
  if (persistActiveCaseProgress) await persistActiveCaseProgress(activeCaseProgress);
}

export function projectCaseFailure(error, progress = createCaseProgress()) {
  return sanitizeEvidence({
    failure: safeErrorMessage(error),
    failureCode: typeof error?.code === "string" ? error.code : "matrix-unexpected-error",
    publicFailureMessage: error?.publicFailureMessage ?? null,
    operation: progress.operation,
    lastSuccessfulStep: progress.lastSuccessfulStep,
    completedSteps: [...progress.completedSteps],
    observations: progress.observations,
  });
}

function validateScope(scope, label) {
  assert(
    hasExactKeys(scope, scopeKeys),
    `${label} must contain exactly the nine Scope Contract fields.`,
  );
  for (const key of scopeKeys) {
    assert(
      typeof scope[key] === "string" &&
        scope[key].trim() === scope[key] &&
        scope[key].length > 0 &&
        scope[key].length <= 300,
      `${label}.${key} must be bounded nonempty text.`,
    );
  }
}

function rejectOutputOrBranchFields(value, path = "manifest") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectOutputOrBranchFields(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    assert(
      (key === "expectedMode" || !/^(?:expected|observed|actual|result|qualification)/iu.test(key)) &&
        !/branch/iu.test(key),
      `${path}.${key} is not permitted in the input-only case manifest.`,
    );
    rejectOutputOrBranchFields(item, `${path}.${key}`);
  }
}

export function validateCaseManifest(value) {
  assert(
    isRecord(value) &&
      value.schemaVersion === "shockaudit-production-matrix-input-v2" &&
      typeof value.description === "string" &&
      Array.isArray(value.screen2) &&
      Array.isArray(value.screen3),
    "Production matrix input manifest has the wrong root contract.",
  );
  assert(value.screen2.length === 11, "Screen 2 matrix must contain 11 cases.");
  assert(value.screen3.length === 11, "Screen 3 matrix must contain 11 cases.");
  rejectOutputOrBranchFields(value);

  const ids = new Set();
  const validateCommon = (item, suite) => {
    assert(isRecord(item), `${suite} case must be an object.`);
    assert(
      typeof item.caseId === "string" &&
        new RegExp(`^s${suite === "screen2" ? "2" : "3"}-[a-z0-9-]+$`, "u")
          .test(item.caseId) &&
        !ids.has(item.caseId),
      `${suite} case has a missing, malformed, or duplicate caseId.`,
    );
    ids.add(item.caseId);
    assert(
      typeof item.label === "string" && item.label.length > 2 &&
        typeof item.sentence === "string" && item.sentence.length > 20,
      `${item.caseId} must have a label and study sentence.`,
    );
    validateScope(item.scope, `${item.caseId}.scope`);
    assert(
      ["positive-journey", "honest-shortfall", "negative-evidence"].includes(item.expectedMode) &&
        isRecord(item.acceptance) && typeof item.acceptance.reason === "string" &&
        item.acceptance.reason.length >= 30 &&
        Array.isArray(item.acceptance.reviewBasis) && item.acceptance.reviewBasis.length > 0 &&
        item.acceptance.reviewBasis.every((entry) => typeof entry === "string" && entry.length > 20) &&
        Array.isArray(item.acceptance.sourceLocators) &&
        item.acceptance.sourceLocators.every((entry) => {
          try { const url = new URL(entry); return url.protocol === "https:" && !url.username && !url.password; }
          catch { return false; }
        }),
      `${item.caseId} lacks a prospectively reviewed acceptance mode.`,
    );
    if (item.expectedMode === "positive-journey") {
      assert(item.acceptance.sourceLocators.length > 0, `${item.caseId} positive inputs need a reviewed source locator.`);
      const requiredClasses = item.acceptance.requiredCandidateClassifications;
      assert(
        requiredClasses === undefined ||
          (Array.isArray(requiredClasses) && requiredClasses.length > 0 &&
            new Set(requiredClasses).size === requiredClasses.length &&
            requiredClasses.every((classification) =>
              ["direct", "adjacent", "broad"].includes(classification)
            )),
        `${item.caseId} has an invalid required candidate-classification contract.`,
      );
      const reviewedBinding = reviewedScreen02PositiveBindings[item.caseId];
      if (reviewedBinding) {
        assert(
          sameJson(item.acceptance.requiredCandidateEvidence, reviewedBinding) &&
            item.acceptance.sourceLocators.includes(
              reviewedBinding.sourceLocator,
            ),
          `${item.caseId} changed its independently reviewed candidate-evidence binding.`,
        );
      } else {
        assert(
          item.acceptance.requiredCandidateEvidence === undefined,
          `${item.caseId} declares an unreviewed candidate-evidence binding.`,
        );
      }
    }
  };

  for (const item of value.screen2) {
    validateCommon(item, "screen2");
    assert(
      typeof item.repeatSearch === "boolean" && item.expectedMode !== "negative-evidence",
      `${item.caseId}.repeatSearch must be boolean.`,
    );
    if (item.expectedMode === "honest-shortfall") {
      assert(
        ["unsupported-native-route", "no-scope-qualified-candidate"].includes(item.acceptance.shortfallCondition) &&
          Array.isArray(item.acceptance.allowedStops) && item.acceptance.allowedStops.length > 0 &&
          item.acceptance.allowedStops.every((stop) => [
            "unsupported", "routes-exhausted", "raw-target", "raw-max",
            "query-budget", "source-failure", "invalid",
          ].includes(stop)),
        `${item.caseId} must declare the reviewed shortfall condition and stopping bounds.`,
      );
    }
  }
  assert(
    value.screen2.filter((item) => item.repeatSearch).length === 1,
    "Screen 2 matrix must contain exactly one cached-repeat probe.",
  );

  const scenarios = new Set([
    "gdpr",
    "ccpa",
    "another-eu",
    "us-state",
    "us-federal",
    "non-eu-national",
    "disaster",
    "secondary-start",
    "structured-metadata",
    "inaccessible-pdf",
    "saved-run-restoration",
  ]);
  const seenScenarios = new Set();
  for (const item of value.screen3) {
    validateCommon(item, "screen3");
    assert(
      item.expectedMode === (item.scenario === "inaccessible-pdf" ? "negative-evidence" : "positive-journey"),
      `${item.caseId} must preserve its positive journey or source-bound negative evidence intent.`,
    );
    assert(
      isRecord(item.anchor) &&
        hasExactKeys(item.anchor, [
          "shockName",
          "jurisdiction",
          "issuingAuthority",
          "approximateYear",
          "versionType",
          "distinguishingFeature",
          "sourceLocator",
          "clarification",
        ]),
      `${item.caseId}.anchor has the wrong input contract.`,
    );
    assert(
      [
        "unspecified",
        "original",
        "amendment",
        "implementing-rule",
        "enforcement-action",
      ].includes(item.anchor.versionType),
      `${item.caseId}.anchor.versionType is invalid.`,
    );
    for (const [key, entry] of Object.entries(item.anchor)) {
      assert(
        entry === null ||
          (typeof entry === "string" &&
            entry.trim() === entry &&
            entry.length > 0 &&
            entry.length <= 2_000),
        `${item.caseId}.anchor.${key} is invalid.`,
      );
    }
    if (item.anchor.sourceLocator !== null) {
      const url = new URL(item.anchor.sourceLocator);
      assert(
        url.protocol === "https:" && !url.username && !url.password,
        `${item.caseId} source locator must be a credential-free HTTPS URL.`,
      );
    }
    assert(
      Array.isArray(item.targetTerms) &&
        item.targetTerms.length > 0 &&
        item.targetTerms.length <= 6 &&
        item.targetTerms.every(
          (entry) => typeof entry === "string" && entry.length > 1,
        ),
      `${item.caseId}.targetTerms is invalid.`,
    );
    assert(
      scenarios.has(item.scenario) && !seenScenarios.has(item.scenario),
      `${item.caseId}.scenario is missing, unknown, or duplicated.`,
    );
    seenScenarios.add(item.scenario);
    assert(
      ["identity", "overview", "timeline", "component", "eligibility", "amendment"]
        .includes(item.claimGroup),
      `${item.caseId}.claimGroup is invalid.`,
    );
  }
  assert(
    seenScenarios.size === scenarios.size,
    "Screen 3 matrix does not cover every required scenario once.",
  );
  return value;
}

function usage() {
  return [
    "Usage: node scripts/verify-production-matrix.mjs [options]",
    "",
    "Options:",
    "  --suite <screen2|screen3|all>  Select a bounded suite (default: all).",
    "  --case <manifest-id>            Run one manifest case inside the suite.",
    "  --wait [seconds]                Wait for the exact deployment (flag default: 600).",
    "  --evidence-dir <path>           Write sanitized per-case checkpoints here.",
    "  --list                          List manifest cases without network access.",
    "  --help                          Show this help without network access.",
    "",
    "Environment:",
    "  SHOCKAUDIT_EXPECTED_COMMIT  Required full 40-hex production commit.",
    "  SHOCKAUDIT_BASE_URL         HTTPS Worker origin (default: production).",
    "",
    "Each case is sequential and bounded to six minutes; each request is bounded to 60 seconds.",
  ].join("\n");
}

export function parseArguments(argv) {
  const parsed = {
    help: false,
    list: false,
    suite: "all",
    caseId: null,
    waitSeconds: 0,
    evidenceDir: defaultEvidenceDir,
  };
  const takeValue = (index, name) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a value.`);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
    } else if (argument === "--list") {
      parsed.list = true;
    } else if (argument === "--suite") {
      parsed.suite = takeValue(index, "--suite");
      index += 1;
    } else if (argument.startsWith("--suite=")) {
      parsed.suite = argument.slice("--suite=".length);
    } else if (argument === "--case") {
      parsed.caseId = takeValue(index, "--case");
      index += 1;
    } else if (argument.startsWith("--case=")) {
      parsed.caseId = argument.slice("--case=".length);
    } else if (argument === "--wait") {
      const candidate = argv[index + 1];
      if (candidate !== undefined && !candidate.startsWith("--")) {
        parsed.waitSeconds = Number(candidate);
        index += 1;
      } else {
        parsed.waitSeconds = 600;
      }
    } else if (argument.startsWith("--wait=")) {
      parsed.waitSeconds = Number(argument.slice("--wait=".length));
    } else if (argument === "--evidence-dir") {
      parsed.evidenceDir = resolve(takeValue(index, "--evidence-dir"));
      index += 1;
    } else if (argument.startsWith("--evidence-dir=")) {
      const value = argument.slice("--evidence-dir=".length);
      if (!value) throw new Error("--evidence-dir requires a value.");
      parsed.evidenceDir = resolve(value);
    } else {
      throw new Error(`Unknown option ${argument}.`);
    }
  }
  assert(
    ["screen2", "screen3", "all"].includes(parsed.suite),
    "--suite must be screen2, screen3, or all.",
  );
  assert(
    parsed.caseId === null || /^s[23]-[a-z0-9-]+$/u.test(parsed.caseId),
    "--case must be a manifest case identifier.",
  );
  assert(
    Number.isFinite(parsed.waitSeconds) &&
      parsed.waitSeconds >= 0 &&
      parsed.waitSeconds <= 3_600,
    "--wait must be a number from 0 through 3600 seconds.",
  );
  return parsed;
}

export function selectCases(manifest, suite, caseId) {
  validateCaseManifest(manifest);
  const available = [
    ...(suite === "screen2" || suite === "all"
      ? manifest.screen2.map((item) => ({ suite: "screen2", input: item }))
      : []),
    ...(suite === "screen3" || suite === "all"
      ? manifest.screen3.map((item) => ({ suite: "screen3", input: item }))
      : []),
  ];
  if (caseId === null) return available;
  const selected = available.filter((item) => item.input.caseId === caseId);
  assert(
    selected.length === 1,
    `Case ${caseId} is not present in suite ${suite}.`,
  );
  return selected;
}

let baseUrl = "";
let publicOrigin = "";
let expectedCommit = "";
let expectedCommitShort = "";
let activeCaseDeadline = null;

function configureTarget() {
  const configuredCommit = process.env.SHOCKAUDIT_EXPECTED_COMMIT ?? "";
  assert(
    /^[0-9a-f]{40}$/iu.test(configuredCommit),
    "SHOCKAUDIT_EXPECTED_COMMIT must be the full 40-hex production commit.",
  );
  expectedCommit = configuredCommit.toLowerCase();
  expectedCommitShort = expectedCommit.slice(0, 7);

  const configuredBaseUrl = (
    process.env.SHOCKAUDIT_BASE_URL ?? defaultBaseUrl
  ).replace(/\/+$/u, "");
  let parsed;
  try {
    parsed = new URL(configuredBaseUrl);
  } catch {
    throw new Error("SHOCKAUDIT_BASE_URL must be a valid URL.");
  }
  assert(
    parsed.protocol === "https:" || parsed.hostname === "localhost",
    "SHOCKAUDIT_BASE_URL must be HTTPS or localhost.",
  );
  assert(
    parsed.pathname === "/" && !parsed.search && !parsed.hash &&
      !parsed.username && !parsed.password,
    "SHOCKAUDIT_BASE_URL must be a credential-free origin.",
  );
  baseUrl = configuredBaseUrl;
  publicOrigin = parsed.origin;
}

function remainingRequestTime() {
  if (activeCaseDeadline === null) return requestTimeoutMs;
  const remaining = activeCaseDeadline - Date.now();
  assert(remaining > 0, "The six-minute case deadline expired.");
  return Math.min(requestTimeoutMs, remaining);
}

async function timedFetch(url, init = {}) {
  return fetch(url, {
    redirect: "error",
    ...init,
    signal: AbortSignal.timeout(remainingRequestTime()),
  });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function parseMcpPayload(text, contentType) {
  if (!contentType.includes("text/event-stream")) return JSON.parse(text);
  const payloads = [];
  for (const block of text.split(/\r?\n\r?\n/u)) {
    const data = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      payloads.push(JSON.parse(data));
    } catch {
      // Ignore non-JSON SSE status events; the JSON-RPC result is required below.
    }
  }
  assert(payloads.length > 0, "MCP SSE response contained no JSON-RPC payload.");
  return payloads.at(-1);
}

let nextRpcId = 1;

async function mcpCall(method, params = {}, pathname = "/mcp") {
  const response = await timedFetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...protocolHeaders,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextRpcId++, method, params }),
  });
  const text = await response.text();
  assert(
    response.ok,
    `${pathname} ${method} returned HTTP ${response.status}.`,
  );
  let payload;
  try {
    payload = parseMcpPayload(text, response.headers.get("content-type") ?? "");
  } catch {
    throw new Error(`${pathname} ${method} returned an unreadable response.`);
  }
  if (payload?.error) {
    throw new Error(
      `${pathname} ${method} returned JSON-RPC error ${payload.error.code ?? "unknown"}: ${sanitizeText(payload.error.message ?? "unknown error")}`,
    );
  }
  assert(
    Object.prototype.hasOwnProperty.call(payload ?? {}, "result"),
    `${pathname} ${method} returned no JSON-RPC result.`,
  );
  return payload.result;
}

async function initialize(pathname = "/mcp") {
  const result = await mcpCall(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "ShockAudit production matrix verifier",
        version: expectedVersion,
      },
    },
    pathname,
  );
  assert(
    result?.serverInfo?.name === "ShockAudit" &&
      result?.serverInfo?.version === expectedVersion,
    `${pathname} initialized the wrong ShockAudit release.`,
  );
  return result;
}

async function callTool(name, argumentsValue) {
  return mcpCall("tools/call", { name, arguments: argumentsValue });
}

export function assertToolSuccess(result, label) {
  assert(isRecord(result), `${label} returned no tool result.`, "mcp-tool-result-missing");
  if (result.isError === true) {
    const error = new Error(`${label} returned a tool-level error.`);
    error.code = "mcp-tool-error";
    error.publicFailureMessage = publicFailureText(result);
    throw error;
  }
}

function assertToolError(result, pattern, label) {
  assert(result?.isError === true, `${label} did not fail closed.`);
  const message = Array.isArray(result.content)
    ? result.content.map((item) => item?.text ?? "").join(" ")
    : "";
  assert(pattern.test(message), `${label} returned the wrong rejection.`);
}

export function assertScreen03EvidenceGuardRejection(result, label) {
  const expected = "Accepted or edited fields require active direct passage support; otherwise reject them or leave them unresolved.";
  const message = publicFailureText(result).trim();
  if (result?.isError !== true || message !== expected) {
    const error = new Error(`${label} did not observe the direct-evidence Confirm guard.`);
    error.code = "screen3-confirm-rejection-wrong-cause";
    error.publicFailureMessage = message;
    throw error;
  }
}

const responseKeys = new Map();

function responseKeyFields(operationId) {
  const raw = randomBytes(32);
  const responseKey = raw.toString("base64url");
  const responseKeyId = createHash("sha256").update(raw).digest("base64url");
  responseKeys.set(operationId, {
    raw: Buffer.from(raw),
    responseKey,
    responseKeyId,
  });
  raw.fill(0);
  return { responseKeyId, responseKey };
}

function decryptSealedValue(sealed, schemaVersion, expectedKind) {
  assert(
    isRecord(sealed) &&
      sealed.schemaVersion === schemaVersion &&
      sealed.algorithm === "A256GCM" &&
      sealed.kind === expectedKind &&
      typeof sealed.operationId === "string" &&
      /^[A-Za-z0-9_-]{43}$/u.test(sealed.keyId ?? "") &&
      /^[A-Za-z0-9_-]{16}$/u.test(sealed.iv ?? "") &&
      /^[A-Za-z0-9_-]+$/u.test(sealed.ciphertext ?? ""),
    "A canonical workflow returned an invalid sealed value.",
  );
  const key = responseKeys.get(sealed.operationId);
  assert(
    key?.responseKeyId === sealed.keyId,
    "A sealed value used the wrong response-key binding.",
  );
  const encrypted = Buffer.from(sealed.ciphertext, "base64url");
  assert(encrypted.byteLength > 16, "A sealed value omitted ciphertext.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key.raw,
    Buffer.from(sealed.iv, "base64url"),
  );
  decipher.setAAD(
    Buffer.from(
      serializeDeterministicJson({
        schemaVersion: sealed.schemaVersion,
        algorithm: sealed.algorithm,
        kind: sealed.kind,
        operationId: sealed.operationId,
        keyId: sealed.keyId,
      }),
    ),
  );
  decipher.setAuthTag(encrypted.subarray(encrypted.byteLength - 16));
  const plaintext = Buffer.concat([
    decipher.update(encrypted.subarray(0, encrypted.byteLength - 16)),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext);
  assert(
    plaintext === serializeDeterministicJson(parsed),
    "A sealed value contained non-deterministic JSON.",
  );
  key.raw.fill(0);
  responseKeys.delete(sealed.operationId);
  return parsed;
}

function requireExperimentalOff(value, label) {
  assert(
    isRecord(value) &&
      value.mode === "experimental-off" &&
      value.enabled === false &&
      Number.isSafeInteger(value.genuineTraceCount) &&
      value.genuineTraceCount >= 0 &&
      sameJson(value.availableTaskTypes, []),
    `${label} did not advertise exact experimental-off host mode.`,
  );
  return value;
}

function assertScreen02Boundary(result, mode, expectedOutcome, expectedKind) {
  assertToolSuccess(result, `Screen 2 ${mode} ${expectedOutcome}`);
  const snapshot = result?._meta?.[workflowMetaKey];
  const correlation = result?._meta?.[workflowCorrelationMetaKey];
  const sealed = result?.structuredContent?.sealedSnapshot;
  const summary = isRecord(result?.structuredContent)
    ? Object.fromEntries(
        Object.entries(result.structuredContent).filter(
          ([key]) => key !== "sealedSnapshot",
        ),
      )
    : null;
  assert(
    isRecord(snapshot) &&
      snapshot.schemaVersion === "screen-02-workflow-client-v1" &&
      snapshot.mode === mode &&
      Number.isSafeInteger(snapshot.revision) &&
      /^fnv1a64:[0-9a-f]{16}$/u.test(snapshot.stateFingerprint ?? "") &&
      isRecord(snapshot.stateEnvelope),
    `Screen 2 ${mode} returned an invalid private snapshot.`,
  );
  assert(
    isRecord(summary) &&
      summary.schemaVersion === "screen-02-workflow-summary-v1" &&
      summary.screen === "screen-02" &&
      summary.mode === mode &&
      summary.outcome === expectedOutcome &&
      summary.assessmentAvailable === false &&
      summary.preparedRequestCount === 0 &&
      summary.deliveredRequestCount === 0,
    `Screen 2 ${mode} returned the wrong fixed-core summary.`,
  );
  assert(
    isRecord(correlation) &&
      correlation.kind === expectedKind &&
      correlation.mode === mode &&
      correlation.runId === snapshot.runId &&
      correlation.revision === snapshot.revision &&
      correlation.stateFingerprint === snapshot.stateFingerprint &&
      sealed?.operationId === correlation.operationId,
    `Screen 2 ${mode} returned inconsistent workflow coordinates.`,
  );
  if (expectedKind === "open") {
    requireExperimentalOff(
      result?._meta?.[hostReasoningMetaKey],
      "Screen 2 open",
    );
    assert(
      result?._meta?.[screen03HostNativeDefaultMetaKey] === false,
      "Screen 2 open enabled the retired Screen 3 host-native path.",
    );
  }
  const decrypted = decryptSealedValue(
    sealed,
    "screen-02-workflow-sealed-result-v1",
    expectedKind,
  );
  assert(
    serializeDeterministicJson(decrypted) ===
      serializeDeterministicJson(snapshot),
    `Screen 2 ${mode} sealed a different snapshot.`,
  );
  const publicBoundary = JSON.stringify({
    content: result.content,
    structuredContent: result.structuredContent,
  });
  assert(
    !publicBoundary.includes(snapshot.accessToken) &&
      !publicBoundary.includes(snapshot.runId),
    `Screen 2 ${mode} crossed its public/private boundary.`,
  );
  return { summary, snapshot };
}

function screen03ParentInput(snapshot, operationId) {
  requireCurrentScreen02HandoffRetrieval(snapshot?.handoff, {
    caseId: "Screen 3 parent handoff",
  });
  assert(
    isRecord(snapshot?.handoff?.integrity) &&
      typeof snapshot.handoff.producerAppVersion === "string" &&
      typeof snapshot.handoff.integrity.handoffFingerprint === "string",
    "Screen 3 requires a canonical Screen 2 continuation handoff.",
  );
  return {
    operationId,
    ...responseKeyFields(operationId),
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    expectedHandoffProducerAppVersion: snapshot.handoff.producerAppVersion,
    expectedHandoffFingerprint: snapshot.handoff.integrity.handoffFingerprint,
  };
}

function screen03OpenInput(snapshot, operationId) {
  return {
    schemaVersion: screen03OpenSchemaVersion,
    ...screen03ParentInput(snapshot, operationId),
  };
}

function screen03MutationInput(snapshot, state, operationId, action) {
  return {
    schemaVersion: screen03MutationSchemaVersion,
    ...screen03ParentInput(snapshot, operationId),
    expectedScreen03Revision: state.revision,
    expectedScreen03StateFingerprint: fingerprintScreen03VerifierState(state),
    action,
  };
}

function assertScreen03Boundary(
  result,
  parentSnapshot,
  expectedOutcome,
  expectedKind,
  label,
) {
  assertToolSuccess(result, label);
  const summary = result?.structuredContent;
  assert(
    isRecord(summary) &&
      summary.schemaVersion === screen03ResultSchemaVersion &&
      summary.screen === "screen-03" &&
      summary.outcome === expectedOutcome &&
      summary.ok === (expectedOutcome !== "conflict") &&
      typeof summary.message === "string" &&
      summary.sealedState?.kind === expectedKind,
    `${label} returned the wrong compact Screen 3 summary.`,
  );
  const state = decryptSealedValue(
    summary.sealedState,
    "screen-03-workflow-sealed-result-v1",
    expectedKind,
  );
  assert(
    state?.schemaVersion === "screen-03-verification-state-v1" &&
      state.releaseLabel === "v0.3.17" &&
      state.runId === parentSnapshot.runId &&
      state.upstream?.runId === parentSnapshot.runId &&
      state.upstream?.handoffFingerprint ===
        parentSnapshot.handoff?.integrity?.handoffFingerprint &&
      Number.isSafeInteger(state.revision) &&
      ["loading", "reviewing", "locked"].includes(state.status) &&
      Array.isArray(state.evidence) &&
      isRecord(state.proposals) &&
      isRecord(state.researchCoverage) &&
      state.outcomeValuesInspected === false &&
      state.researchCoverage.outcomeValuesInspected === false &&
      /^fnv1a64:[0-9a-f]{16}$/u.test(
        state.integrity?.stateFingerprint ?? "",
      ),
    `${label} decrypted an invalid Screen 3 state.`,
  );
  assert(
    screen03ProposalGroupKeys.every((key) => Array.isArray(state.proposals[key])),
    `${label} omitted a Screen 3 proposal group.`,
  );
  const publicBoundary = JSON.stringify({
    content: result.content,
    structuredContent: result.structuredContent,
  });
  assert(
    !publicBoundary.includes(parentSnapshot.accessToken) &&
      !publicBoundary.includes(parentSnapshot.runId),
    `${label} crossed its public/private boundary.`,
  );
  return { summary, state };
}

function operationId(caseId, suffix) {
  return `matrix-${caseId}-${suffix}-${randomUUID()}`;
}

function mutationInput(snapshot, caseId, suffix, action, payload = {}) {
  const id = operationId(caseId, suffix);
  return {
    schemaVersion: workflowMutationSchemaVersion,
    operationId: id,
    ...responseKeyFields(id),
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    action,
    payload,
  };
}

function retirementInput(snapshot) {
  return {
    schemaVersion: "screen-02-workflow-retire-v1",
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
  };
}

async function retireSnapshot(snapshot) {
  if (!snapshot) return "not-created";
  const result = await callTool(
    "retire_screen02_workflow_v021",
    retirementInput(snapshot),
  );
  assertToolSuccess(result, "Screen 2 retirement");
  assert(
    ["retired", "already-absent"].includes(
      result?.structuredContent?.outcome,
    ),
    "Screen 2 retirement returned the wrong outcome.",
  );
  return result.structuredContent.outcome;
}

async function retireCaseSnapshot(snapshot, primaryFailure) {
  try {
    await retireSnapshot(snapshot);
  } catch (error) {
    if (!primaryFailure) throw error;
    // A cleanup error must not replace the already established product or
    // verifier failure, or erase the last completed product operation.
    await recordCaseProgress(activeCaseProgress?.operation ?? "case:cleanup", {
      observations: { cleanupFailure: projectCaseFailure(error) },
    });
  }
}

async function readHealth() {
  const response = await timedFetch(`${baseUrl}/health`, {
    headers: { accept: "application/json" },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // The contract assertion below reports a bounded, non-body diagnostic.
  }
  assert(response.ok && isRecord(body), `/health returned HTTP ${response.status}.`);
  return body;
}

function assertHealth(health) {
  assert(
    health.ok === true &&
      health.ready === true &&
      health.service === "ShockAudit" &&
      health.version === expectedVersion &&
      health.uiResourceUri === expectedResourceUri &&
      health.readiness?.status === "ready" &&
      health.readiness?.mode === "integrated" &&
      health.readiness?.mcpRuntime === "durable-object" &&
      health.readiness?.reasoning === "chatgpt-host" &&
      health.readiness?.code === "READY",
    "/health did not advertise the expected ready integrated release.",
  );
}

function extractAssetUrls(html) {
  const urls = [];
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"'<>]+)["']/giu)) {
    try {
      const url = new URL(match[1], publicOrigin);
      if (url.pathname.startsWith("/assets/")) urls.push(url.href);
    } catch {
      // Invalid HTML references do not become assets and fail the exact set below.
    }
  }
  return urls.sort();
}

async function fetchAsset(url, kind) {
  const response = await timedFetch(url);
  assert(response.ok, `${kind} asset was unavailable.`);
  const contentType = response.headers.get("content-type") ?? "";
  assert(
    kind === "JavaScript"
      ? contentType.includes("javascript")
      : contentType.includes("text/css"),
    `${kind} asset returned the wrong content type.`,
  );
  assert(
    response.headers.get("access-control-allow-origin") === "*" &&
      response.headers.get("cross-origin-resource-policy") === "cross-origin" &&
      response.headers.get("cache-control")?.includes("no-store") &&
      response.headers.get("x-content-type-options") === "nosniff",
    `${kind} asset returned unsafe headers.`,
  );
  return response.text();
}

async function expectedAssetMarkerActive() {
  try {
    const response = await timedFetch(
      `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`,
    );
    return response.ok && (await response.text()).includes(expectedCommitShort);
  } catch {
    return false;
  }
}

async function waitForExpectedDeployment(waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1_000;
  while (true) {
    try {
      const health = await readHealth();
      assertHealth(health);
      if (await expectedAssetMarkerActive()) return health;
    } catch (error) {
      if (waitSeconds === 0 || Date.now() >= deadline) throw error;
    }
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for the exact production asset marker.");
    }
    await wait(Math.min(10_000, Math.max(1, deadline - Date.now())));
  }
}

async function verifyDeploymentGate(waitSeconds) {
  const health = await waitForExpectedDeployment(waitSeconds);
  await initialize("/mcp");
  await initialize("/mcp/");

  const listedResources = await mcpCall("resources/list");
  const resources = listedResources?.resources ?? [];
  assert(
    resources.some(
      (resource) =>
        resource?.uri === expectedResourceUri &&
        resource?.mimeType === "text/html;profile=mcp-app",
    ),
    "resources/list omitted the current MCP App resource.",
  );
  const resource = await mcpCall("resources/read", { uri: expectedResourceUri });
  const content = resource?.contents?.[0];
  assert(
    content?.uri === expectedResourceUri &&
      content?.mimeType === "text/html;profile=mcp-app" &&
      typeof content?.text === "string" &&
      content.text.includes('<div id="root">'),
    "resources/read returned the wrong current UI resource.",
  );
  const hostMetadata = requireExperimentalOff(
    content?._meta?.[hostReasoningMetaKey],
    "Current UI resource",
  );

  const listedTools = await mcpCall("tools/list");
  const tools = listedTools?.tools;
  assert(Array.isArray(tools), "tools/list returned no catalog.");
  const names = new Set(tools.map((tool) => tool?.name));
  const required = [
    "confirm_scope_contract",
    workflowCreateTool,
    workflowMutationTool,
    "retire_screen02_workflow_v021",
    screen03OpenTool,
    screen03MutationTool,
    "create_six_screen_workflow_v1",
    "get_six_screen_workflow_v1",
    "get_six_screen_operation_status_v1",
    "get_six_screen_recovery_snapshot_v1",
    "mutate_six_screen_workflow_v1",
  ];
  assert(
    required.every((name) => names.has(name)),
    "tools/list omitted a production-matrix core tool.",
  );
  const forbiddenInOffMode = [
    "prepare_shockaudit_host_task",
    "get_shockaudit_host_task_status",
    "record_shockaudit_host_message_delivery",
    "record_shockaudit_host_panel_reconciliation",
    "cancel_shockaudit_host_task",
    "submit_screen02_search_review",
    "submit_screen03_evidence_mapping",
    "submit_screen03_overview",
  ];
  assert(
    forbiddenInOffMode.every((name) => !names.has(name)),
    "The production catalog exposed a generic host task while experimental-off.",
  );

  const assetUrls = extractAssetUrls(content.text);
  const startupPreloadPaths = [
    `/assets/shockaudit-rolldown-runtime-${expectedCommitShort}.js`,
    `/assets/shockaudit-screen02-runtime-${expectedCommitShort}.js`,
    `/assets/shockaudit-screen02-engine-${expectedCommitShort}.js`,
    `/assets/shockaudit-screen3-handoff-contract-${expectedCommitShort}.js`,
    `/assets/shockaudit-screen5-state-contract-${expectedCommitShort}.js`,
  ];
  const expectedAssetUrls = [
    `${publicOrigin}/assets/shockaudit-app.css?v=${expectedReleaseLabel}`,
    `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`,
    ...startupPreloadPaths.map((assetPath) => `${publicOrigin}${assetPath}`),
  ].sort();
  assert(
    sameJson(assetUrls, expectedAssetUrls),
    "The UI resource did not reference exactly the versioned app/CSS and five declared commit-bound preloads.",
  );
  const assetContents = new Map(await Promise.all(expectedAssetUrls.map(
    async (assetUrl) => [
      assetUrl,
      await fetchAsset(
        assetUrl,
        new URL(assetUrl).pathname.endsWith(".css") ? "CSS" : "JavaScript",
      ),
    ],
  )));
  const cssUrl = `${publicOrigin}/assets/shockaudit-app.css?v=${expectedReleaseLabel}`;
  const javascriptUrl = `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`;
  const css = assetContents.get(cssUrl) ?? "";
  const javascript = assetContents.get(javascriptUrl) ?? "";
  assert(css.length > 0 && javascript.includes(expectedCommitShort),
    "The startup assets omitted the expected commit marker.");
  for (const preloadPath of startupPreloadPaths) {
    const preload = assetContents.get(`${publicOrigin}${preloadPath}`) ?? "";
    assert(
      javascript.includes(`./${preloadPath.split("/").at(-1)}`) &&
        preload.length > 0 &&
        !preload.toLowerCase().includes("<!doctype html"),
      `The ${preloadPath} preload was empty, resolved to HTML, or was not bound to the expected commit by the startup module.`,
    );
  }
  const deferredPaths = [];
  let screen02FindModuleGraph = {
    entryPath: null,
    modulePaths: [],
    edges: [],
  };
  const legacyDeferredChunks = [
    {
      label: "Screen 2 Find",
      fileStem: "Screen02Find",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
      primaryFind: true,
    },
    {
      label: "Screen 2 Audit",
      fileStem: "Screen02Audit",
      requiredImport:
        `./shockaudit-screen02-runtime-${expectedCommitShort}.js`,
    },
    {
      label: "Screen 3",
      fileStem: "screen03",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
    {
      label: "Screen 4",
      fileStem: "screen04",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
    {
      label: "host-reasoning audit",
      fileStem: "host-reasoning-audit",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
  ];
  if (SIX_SCREEN_REPLACEMENT_BUILD) {
    assert(
      javascript.includes("create_six_screen_workflow_v1") &&
        javascript.includes("shockaudit-six-screen-public-v1"),
      "The startup asset did not contain the adopted six-screen workflow contract.",
    );
    for (const { label, fileStem } of legacyDeferredChunks) {
      assert(
        !new RegExp(
          `\\./shockaudit-${fileStem}-(?:[0-9a-f]{7}|local)\\.js`,
          "u",
        ).test(javascript),
        `The six-screen replacement startup unexpectedly referenced the retired ${label} chunk.`,
      );
    }
  } else {
    let screen02FindChunkUrl = "";
    for (
      const {
        label,
        fileStem,
        requiredImport,
        primaryFind = false,
      } of legacyDeferredChunks
    ) {
      const expectedPath =
        `/assets/shockaudit-${fileStem}-${expectedCommitShort}.js`;
      assert(
        javascript.includes(
          `./shockaudit-${fileStem}-${expectedCommitShort}.js`,
        ),
        `The startup asset did not bind ${label} to the expected commit.`,
      );
      const deferredUrl = `${publicOrigin}${expectedPath}`;
      if (primaryFind) screen02FindChunkUrl = deferredUrl;
      const deferred = await fetchAsset(
        deferredUrl,
        "JavaScript",
      );
      assert(
        deferred.length > 0 &&
          deferred.includes(requiredImport),
        `The ${label} asset did not share its exact startup module.`,
      );
      assetContents.set(deferredUrl, deferred);
      deferredPaths.push(expectedPath);
    }
    assert(
      screen02FindChunkUrl !== "",
      "The primary Screen 2 Find lazy chunk was not resolved.",
    );
    screen02FindModuleGraph = await verifyAssetModuleGraph({
      entryUrl: screen02FindChunkUrl,
      publicOrigin,
      expectedCommitShort,
      expectedReleaseLabel,
      requiredEntrySpecifiers: [
        `./shockaudit-screen02-runtime-${expectedCommitShort}.js`,
        `./shockaudit-screen02-engine-${expectedCommitShort}.js`,
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
      ],
      fetchModule: async (moduleUrl) => {
        if (assetContents.has(moduleUrl)) return assetContents.get(moduleUrl);
        const body = await fetchAsset(moduleUrl, "JavaScript");
        assetContents.set(moduleUrl, body);
        return body;
      },
    });
  }
  return {
    artifactProfile: SIX_SCREEN_REPLACEMENT_BUILD
      ? "six-screen-replacement"
      : "legacy-deferred",
    version: expectedVersion,
    releaseLabel: expectedReleaseLabel,
    resourceUri: expectedResourceUri,
    expectedCommit,
    assetCommitMarker: expectedCommitShort,
    commitBinding:
      "full expected SHA supplied; deployed build contract exposes its deterministic seven-character asset marker",
    assetPaths: [...new Set([
      "/assets/shockaudit-app.css",
      "/assets/shockaudit-app.js",
      ...startupPreloadPaths,
      ...deferredPaths,
      ...screen02FindModuleGraph.modulePaths.map(
        (path) => new URL(path, publicOrigin).pathname,
      ),
    ])].sort(),
    screen02FindModuleGraph: {
      entryPath: screen02FindModuleGraph.entryPath,
      modulePaths: screen02FindModuleGraph.modulePaths,
      edgeCount: screen02FindModuleGraph.edges.length,
    },
    mcpEndpoints: ["/mcp", "/mcp/"],
    hostMode: hostMetadata.mode,
    hostToolsExposed: 0,
  };
}

async function confirmedContext(input, mode) {
  await recordCaseProgress("screen1:confirm-scope");
  const knownShock = mode === "audit" ? input.anchor.shockName : "";
  const result = await callTool("confirm_scope_contract", {
    revision: 1,
    mode,
    sentence: input.sentence,
    contractSourceSentence: input.sentence,
    scope: input.scope,
    knownShock,
    resolvedKeys: mode === "audit" ? decisionKeys : scopeKeys,
    acknowledgedDifferences: [],
    scopeDirty: false,
  });
  const context = result?.structuredContent?.studyContext;
  await recordCaseProgress("screen1:validate-confirmation", {
    observations: { scopeConfirmation: projectScopeConfirmation(input, result) },
  });
  assertConfirmedContext(input, mode, result);
  await recordCaseProgress("screen1:confirm-scope", { completed: true });
  return context;
}

export function projectScopeConfirmation(input, result) {
  const context = result?.structuredContent?.studyContext;
  return sanitizeEvidence({
    requestedScope: input.scope,
    returnedScope: context?.scopeContract ?? null,
    confirmed: context?.confirmed ?? null,
    readyForLaterScreens: context?.readyForLaterScreens ?? null,
    unresolvedDecisions: (context?.unresolvedDecisions ?? []).map((item) => ({
      key: item.key, title: item.title, question: item.question,
    })),
    publicMessage: publicFailureText(result),
  });
}

export function assertConfirmedContext(input, mode, result) {
  assertToolSuccess(result, `${input.caseId} Scope Contract confirmation`);
  const context = result?.structuredContent?.studyContext;
  assert(
    isRecord(context),
    `${input.caseId} returned no Scope Contract context.`,
    "scope-confirmation-context-missing",
  );
  assert(
    sameCanonicalJsonValue(context.scopeContract, input.scope),
    `${input.caseId} changed the requested Scope Contract.`,
    "scope-contract-changed",
  );
  assert(
    context.confirmed === true && context.readyForLaterScreens === true,
    `${input.caseId} Scope Contract confirmation was refused: ${publicFailureText(result)}`,
    "scope-confirmation-refused",
  );
  const knownShock = mode === "audit" ? input.anchor.shockName : "";
  assert(
    context?.schemaVersion === "1.0" &&
      context?.appVersion === expectedVersion &&
      context?.startingPoint === mode &&
      context?.studySentence === input.sentence &&
      context?.knownShock === knownShock &&
      sameJson(context.resolvedKeys, mode === "audit" ? decisionKeys : scopeKeys) &&
      sameJson(context.unresolvedDecisions, []) &&
      context.scopeDirty === false &&
      context.confirmed === true &&
      context.readyForLaterScreens === true,
    `${input.caseId} returned an inconsistent confirmed Scope Contract boundary.`,
    "scope-confirmation-boundary-invalid",
  );
  return context;
}

async function createWorkflow(input, mode) {
  const context = await confirmedContext(input, mode);
  await recordCaseProgress(`screen2:${mode}:create`);
  const id = operationId(input.caseId, "create");
  const result = await callTool(workflowCreateTool, {
    schemaVersion: workflowCreateSchemaVersion,
    operationId: id,
    ...responseKeyFields(id),
    initialState: "standard",
    studyContext: context,
  });
  const opened = assertScreen02Boundary(result, mode, "created", "open");
  await recordCaseProgress(`screen2:${mode}:create`, {
    completed: true,
    observations: { screen2: projectScreen02Diagnostics(readCanonicalWorkflowState(opened.snapshot, mode), mode, opened.snapshot) },
  });
  return opened;
}

async function applyScreen02Mutation(snapshot, input, suffix, action, payload) {
  const operation = `screen2:${snapshot.mode}:${action}:${suffix}`;
  await recordCaseProgress(operation);
  const result = await callTool(
    workflowMutationTool,
    mutationInput(snapshot, input.caseId, suffix, action, payload),
  );
  const applied = assertScreen02Boundary(result, snapshot.mode, "applied", "mutation");
  await recordCaseProgress(operation, {
    completed: true,
    observations: { screen2: projectScreen02Diagnostics(readCanonicalWorkflowState(applied.snapshot, snapshot.mode), snapshot.mode, applied.snapshot) },
  });
  return applied;
}

async function completeScreen02FindSearch(
  started,
  input,
  suffix,
  onSnapshot,
) {
  return driveFindSearchToTerminal({
    current: started,
    readState: (current) =>
      readCanonicalWorkflowState(current.snapshot, "find"),
    continueSearch: async (current, { continuationIndex }) => {
      const continued = await applyScreen02Mutation(
        current.snapshot,
        input,
        `${suffix}-continue-${continuationIndex}`,
        "find-search-continue",
        {},
      );
      onSnapshot(continued.snapshot);
      return continued;
    },
    label: `${input.caseId} ${suffix}`,
  });
}

function activeFindSet(state) {
  const active = state.candidateSets.find(
    (item) => item.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  assert(active?.status === "active", "Find returned no active candidate set.");
  return active;
}

function sourceHost(locator) {
  try {
    const url = new URL(locator);
    return url.hostname.toLowerCase();
  } catch {
    return "unparseable";
  }
}

function groupCounts(items, valueFor) {
  const counts = new Map();
  for (const item of items) {
    const value = valueFor(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function projectContextLeads(leads) {
  return (leads ?? []).map((lead) => ({
    title: lead.title,
    locator: lead.locator,
    publisher: lead.publisher,
    sourceRole: lead.sourceRole,
    status: lead.status,
  }));
}

function projectContextBridges(bridges) {
  return (bridges ?? []).map((bridge) => ({
    formalIdentifier: bridge.formalIdentifier,
    status: bridge.status,
    returnedOfficialRecordCount:
      bridge.returnedOfficialRecordIds?.length ?? 0,
  }));
}

export function projectAuditStartingSource(state) {
  const anchor = state.anchor?.revisions?.find(
    (item) => item.anchorRevisionId === state.anchor.activeRevisionId,
  );
  const active = state.matchSets?.find(
    (item) => item.matchSetSnapshotId === state.activeMatchSetSnapshotId,
  );
  return {
    anchorLocator: anchor?.fields?.sourceLocator ?? null,
    contextLeads: projectContextLeads(active?.manifest?.contextLeads),
  };
}

// This projection deliberately contains no workflow coordinates or raw state.
// It is captured before candidate and scenario acceptance assertions run.
export function projectScreen02Diagnostics(state, mode, authenticatedSnapshot = null) {
  rememberPrivateIdentifiers(state);
  const sets = mode === "find" ? state.candidateSets : state.matchSets;
  const active = (sets ?? []).find((item) => mode === "find"
    ? item.candidateSetSnapshotId === state.activeCandidateSetSnapshotId
    : item.matchSetSnapshotId === state.activeMatchSetSnapshotId);
  const manifest = active?.manifest;
  const activeIds = new Set(mode === "find"
    ? active?.candidateSnapshotIds ?? []
    : active?.possibleMatchSnapshotIds ?? []);
  const entries = mode === "find" ? state.candidates ?? [] : state.possibleMatches ?? [];
  const selected = entries.filter((item) => activeIds.has(mode === "find"
    ? item.candidateSnapshotId : item.matchSnapshotId));
  return sanitizeEvidence({
    mode,
    startingSource: mode === "audit" ? projectAuditStartingSource(state) : null,
    contextBridges: projectContextBridges(manifest?.contextBridges),
    activeSetStatus: active?.status ?? null,
    activeReferenceCount: activeIds.size,
    activeResolvedCount: selected.length,
    orderingCount: active?.ordering?.length ?? null,
    continuationReady: authenticatedSnapshot === null ? null :
      authenticatedSnapshot.handoff?.destinationScreen === "screen-03",
    funnel: manifest?.funnel ? { ...manifest.funnel } : null,
    stoppingRule: manifest?.stoppingRule ? { ...manifest.stoppingRule } : null,
    sourceRoutes: (manifest?.channels ?? []).map(({ channel, status, note }) => ({ channel, status, note })),
    queryMatrix: (manifest?.queryMatrix ?? []).map(({ query, purpose, returnedRecordIds }) => ({
      query, purpose, returnedRecordCount: returnedRecordIds?.length ?? 0,
    })),
    candidates: selected.slice(0, 60).map((item) => ({
      title: item.identity?.canonicalTitle ?? null,
      formalIdentifier: item.identity?.formalIdentifier ?? null,
      issuer: item.identity?.issuer ?? null,
      jurisdiction: item.identity?.issuingJurisdiction ?? null,
      relationship: item.relationship ?? null,
      sourceCount: item.sourceIds?.length ?? 0,
      qualification: item.qualification ? {
        eligible: item.qualification.eligible,
        classification: item.qualification.classification,
        lane: item.qualification.lane,
        section: item.qualification.section,
        exclusionCodes: [...(item.qualification.exclusionCodes ?? [])],
        explanation: item.qualification.explanation,
        evidenceSourceCount: item.qualification.evidenceSourceIds?.length ?? 0,
      } : null,
    })),
    exclusions: (manifest?.exclusions ?? []).slice(0, 120).map((item) => ({
      reason: item.reason,
      // SearchExclusion carries no title; use only a retained candidate with
      // the same canonical identity, otherwise report the missing title.
      title: entries.find((entry) => entry.candidateId === item.recordId)?.identity?.canonicalTitle ?? null,
      qualification: item.qualification ? {
        eligible: item.qualification.eligible,
        classification: item.qualification.classification,
        lane: item.qualification.lane,
        exclusionCodes: [...(item.qualification.exclusionCodes ?? [])],
        explanation: item.qualification.explanation,
      } : null,
    })),
    sources: (state.sources ?? []).slice(0, 100).map((item) => ({
      title: item.title,
      locator: item.locator,
      channel: item.channel,
      authorityTier: item.authorityTier,
    })),
    outcomeValuesInspected: state.outcomeValuesInspected,
  });
}

export function qualificationLaneIndex(state) {
  const active = activeFindSet(state);
  return new Map([
    ...state.candidates.filter((item) => item.qualification).map((item) => [
      item.candidateId, item.qualification.lane,
    ]),
    ...active.manifest.exclusions.filter((item) => item.qualification).map((item) => [
      item.recordId, item.qualification.lane,
    ]),
  ]);
}

export function isPersistedQualificationReuseReason(reason) {
  return /persisted qualification was reused without another (?:assisted-reasoning|provider or host) request/iu
    .test(reason);
}

export function assertPreservedCacheLanes(firstLanes, reusedEntries, caseId) {
  assert(
    reusedEntries.every((entry) => firstLanes.has(entry.candidateId) &&
      firstLanes.get(entry.candidateId) === entry.lane),
    `${caseId} changed an original source lane during qualification cache reuse.`,
    "qualification-cache-source-lane-changed",
  );
}

export function requireScreen02RetrievalBudget(
  manifest,
  {
    caseId = "Screen 2",
    generalLegal = true,
    allowUnsupportedRoute = false,
    allowedCandidateIds = null,
    allowedSourceIds = null,
    candidateSourceIds = null,
    sourcesById = null,
  } = {},
) {
  const execution = manifest?.retrievalExecution;
  const bridgeIssues = screen02ContextBridgeMismatches(
    manifest,
    `${caseId} manifest`,
  );
  assert(
    bridgeIssues.length === 0,
    `${caseId} has invalid contextual-to-official bridge evidence: ${bridgeIssues.join(" ")}`,
    "find-context-official-bridge-invalid",
  );
  assert(
    manifest?.protocolVersion === "screen-02-search-protocol-v4" &&
      hasExactKeys(execution, [
        "schemaVersion", "limits", "baseline", "qualificationRecovery",
        "aggregate", "documentAcquisitions", "outcomeValuesInspected",
      ]) &&
      execution.schemaVersion === "screen-02-retrieval-execution-v2" &&
      execution.outcomeValuesInspected === false,
    `${caseId} did not retain a typed v4 retrieval execution.`,
    "find-retrieval-execution-absent",
  );
  const limits = execution.limits;
  assert(
    hasExactKeys(limits, [
      "rawCandidateTarget", "rawCandidateMaximum",
      "qualifiedCandidateTarget", "minimumGeneralQueryVariants",
      "maximumGeneralQueryVariants", "maximumBaselineRounds",
      "maximumDocumentAcquisitions", "maximumDocumentRedirects",
      "documentRequestTimeoutMs", "documentRunTimeoutMs",
      "documentMaximumBytes", "documentTotalBytes", "documentConcurrency",
    ]) && limits.rawCandidateTarget === 40 &&
      limits.rawCandidateMaximum === 60 &&
      limits.qualifiedCandidateTarget === 10 &&
      limits.minimumGeneralQueryVariants === 12 &&
      limits.maximumGeneralQueryVariants === 16 &&
      limits.maximumBaselineRounds === 2 &&
      limits.maximumDocumentAcquisitions === 24 &&
      limits.maximumDocumentRedirects === 3 &&
      limits.documentRequestTimeoutMs === 3_000 &&
      limits.documentRunTimeoutMs === 45_000 &&
      limits.documentMaximumBytes === 2 * 1024 * 1024 &&
      limits.documentTotalBytes === 6 * 1024 * 1024 &&
      limits.documentConcurrency === 2,
    `${caseId} changed the fixed retrieval limits.`,
    "find-retrieval-limits-invalid",
  );
  const metricKeys = [
    "queriesPlanned", "queriesAttempted", "queriesSucceeded", "queriesFailed",
    "roundsExecuted", "recordsReceived", "proposalsGenerated",
    "uniqueProposalsGenerated",
  ];
  const validMetrics = (value) => {
    if (!isRecord(value) || !metricKeys.every((key) =>
      Number.isSafeInteger(value[key]) && value[key] >= 0
    )) return false;
    return value.queriesSucceeded + value.queriesFailed ===
      value.queriesAttempted &&
    value.queriesAttempted <= value.queriesPlanned &&
    (value.queriesAttempted === 0
      ? value.roundsExecuted === 0
      : value.roundsExecuted > 0 &&
        value.roundsExecuted <= value.queriesAttempted) &&
    value.uniqueProposalsGenerated <= value.proposalsGenerated &&
    value.proposalsGenerated <= value.recordsReceived &&
    (value.queriesSucceeded > 0 ||
      (value.recordsReceived === 0 && value.proposalsGenerated === 0 &&
        value.uniqueProposalsGenerated === 0));
  };
  const baseline = execution.baseline;
  const stopReasons = [
    "raw-max", "raw-target", "query-budget", "routes-exhausted",
    "source-failure", "unsupported", "invalid",
  ];
  const budget = {
    rawCandidateTarget: limits.rawCandidateTarget,
    rawCandidateMaximum: limits.rawCandidateMaximum,
    qualifiedCandidateTarget: limits.qualifiedCandidateTarget,
    queryVariantsPlanned: baseline?.queriesPlanned,
    minimumQueryVariants: limits.minimumGeneralQueryVariants,
    maximumQueryVariants: limits.maximumGeneralQueryVariants,
    queryRequestsExecuted: execution.aggregate?.queriesAttempted,
    roundsExecuted: execution.aggregate?.roundsExecuted,
    maximumRounds: limits.maximumBaselineRounds +
      (execution.qualificationRecovery ? 1 : 0),
    recordsReceived: execution.aggregate?.recordsReceived,
    proposalsGenerated: execution.aggregate?.proposalsGenerated,
    uniqueProposalsGenerated: execution.aggregate?.uniqueProposalsGenerated,
    stoppingReason: baseline?.stoppingReason,
    documentLimits: {
      maximumAcquisitions: limits.maximumDocumentAcquisitions,
      maximumRedirects: limits.maximumDocumentRedirects,
      requestTimeoutMs: limits.documentRequestTimeoutMs,
      runTimeoutMs: limits.documentRunTimeoutMs,
      maximumBytes: limits.documentMaximumBytes,
      totalBytes: limits.documentTotalBytes,
      concurrency: limits.documentConcurrency,
    },
    baseline,
    qualificationRecovery: execution.qualificationRecovery,
    aggregate: execution.aggregate,
    documentAcquisitions: execution.documentAcquisitions,
  };
  assert(
    hasExactKeys(baseline, [
      "phase", "status", "queryIds", "stoppingReason", ...metricKeys,
    ]) && baseline.phase === "baseline" && validMetrics(baseline) &&
      stopReasons.includes(baseline.stoppingReason) &&
      ["completed", "failed", "unsupported", "invalid"].includes(
        baseline.status,
      ) && Array.isArray(baseline.queryIds) &&
      baseline.queryIds.length === baseline.queriesAttempted &&
      new Set(baseline.queryIds).size === baseline.queryIds.length &&
      baseline.queryIds.every((id) =>
        typeof id === "string" && id.trim() === id &&
          id.length > 0 && id.length <= 300 &&
          !/[\u0000-\u001f\u007f]/u.test(id)
      ) && baseline.queriesPlanned <= limits.maximumGeneralQueryVariants &&
      baseline.queriesAttempted <= limits.maximumGeneralQueryVariants &&
      baseline.roundsExecuted <= limits.maximumBaselineRounds,
    `${caseId} has an invalid typed baseline retrieval phase.`,
    "find-retrieval-baseline-invalid",
  );
  const b = baseline;
  const stopIsValid =
    (b.stoppingReason === "raw-max" && b.status === "completed" &&
      b.uniqueProposalsGenerated >= limits.rawCandidateMaximum &&
      b.queriesAttempted > 0 && b.queriesSucceeded > 0) ||
    (b.stoppingReason === "raw-target" && b.status === "completed" &&
      b.uniqueProposalsGenerated >= limits.rawCandidateTarget &&
      b.uniqueProposalsGenerated < limits.rawCandidateMaximum &&
      b.queriesAttempted > 0 && b.queriesSucceeded > 0) ||
    (b.stoppingReason === "query-budget" && b.status === "completed" &&
      b.uniqueProposalsGenerated < limits.rawCandidateTarget &&
      b.queriesPlanned === limits.maximumGeneralQueryVariants &&
      b.queriesAttempted === b.queriesPlanned &&
      b.roundsExecuted === limits.maximumBaselineRounds &&
      b.queriesSucceeded > 0) ||
    (b.stoppingReason === "routes-exhausted" && b.status === "completed" &&
      b.uniqueProposalsGenerated < limits.rawCandidateTarget &&
      b.queriesAttempted > 0 && b.queriesAttempted === b.queriesPlanned &&
      b.queriesPlanned < limits.maximumGeneralQueryVariants &&
      b.queriesSucceeded > 0) ||
    (b.stoppingReason === "source-failure" && b.status === "failed" &&
      b.queriesAttempted > 0 && b.queriesAttempted === b.queriesPlanned &&
      b.queriesSucceeded === 0 && b.queriesFailed === b.queriesAttempted &&
      b.recordsReceived === 0 && b.proposalsGenerated === 0 &&
      b.uniqueProposalsGenerated === 0) ||
    (["unsupported", "invalid"].includes(b.stoppingReason) &&
      b.status === b.stoppingReason && metricKeys.every((key) => b[key] === 0) &&
      b.queryIds.length === 0);
  assert(
    stopIsValid,
    `${caseId} has a stop reason inconsistent with its numeric execution.`,
    "find-retrieval-stop-invalid",
  );
  const recovery = execution.qualificationRecovery;
  if (recovery !== null) {
    assert(
      hasExactKeys(recovery, [
        "phase", "status", "queryIds", "stoppingReason", ...metricKeys,
      ]) &&
        recovery.phase === "qualification-recovery" &&
        ["completed", "failed"].includes(recovery.status) &&
        validMetrics(recovery) && recovery.queriesPlanned === 1 &&
        recovery.queriesAttempted === 1 && recovery.roundsExecuted === 1 &&
        Array.isArray(recovery.queryIds) && recovery.queryIds.length === 1 &&
        typeof recovery.queryIds[0] === "string" &&
        recovery.queryIds[0].trim() === recovery.queryIds[0] &&
        recovery.queryIds[0].length > 0 &&
        recovery.queryIds[0].length <= 300 &&
        !/[\u0000-\u001f\u007f]/u.test(recovery.queryIds[0]) &&
        (recovery.status === "completed"
          ? recovery.stoppingReason === "qualification-recovery-completed" &&
            recovery.queriesSucceeded === 1 && recovery.queriesFailed === 0
          : recovery.stoppingReason === "qualification-recovery-failed" &&
            recovery.queriesSucceeded === 0 && recovery.queriesFailed === 1 &&
            recovery.recordsReceived === 0 && recovery.proposalsGenerated === 0 &&
            recovery.uniqueProposalsGenerated === 0),
      `${caseId} did not retain exactly one valid qualification-recovery request.`,
      "find-retrieval-recovery-invalid",
    );
  }
  const aggregate = execution.aggregate;
  assert(
    hasExactKeys(aggregate, [...metricKeys, "terminal"]) &&
      aggregate.terminal === true && validMetrics(aggregate) &&
      metricKeys.filter((key) => key !== "uniqueProposalsGenerated")
        .every((key) => aggregate[key] ===
          baseline[key] + (recovery?.[key] ?? 0)) &&
      aggregate.uniqueProposalsGenerated >= Math.max(
        baseline.uniqueProposalsGenerated,
        recovery?.uniqueProposalsGenerated ?? 0,
      ) && aggregate.uniqueProposalsGenerated <=
        baseline.uniqueProposalsGenerated +
          (recovery?.uniqueProposalsGenerated ?? 0),
    `${caseId} has inconsistent terminal retrieval aggregates.`,
    "find-retrieval-aggregate-invalid",
  );
  const matrixQueryIds = Array.isArray(manifest.queryMatrix)
    ? manifest.queryMatrix.map((query) => query?.id)
    : [];
  const executionQueryIds = [
    ...baseline.queryIds,
    ...(recovery?.queryIds ?? []),
  ];
  assert(
    matrixQueryIds.every((id) => typeof id === "string") &&
      new Set(matrixQueryIds).size === matrixQueryIds.length &&
      new Set(executionQueryIds).size === executionQueryIds.length &&
      executionQueryIds.every((id) => matrixQueryIds.includes(id)),
    `${caseId} retrieval phases are not bound to unique query-matrix IDs.`,
    "find-retrieval-query-binding-invalid",
  );
  const sanitizedAcquisitionUrl = (value) => {
    if (typeof value !== "string" || value.length === 0 ||
      value.length > 2_048) return false;
    try {
      const url = new URL(value);
      if (!(url.protocol === "https:" && !url.username && !url.password &&
        !url.search && !url.hash && !url.port && Boolean(url.hostname) &&
        !url.hostname.endsWith("."))) return false;
      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
      if (
        !hostname.includes(".") || hostname.includes(":") ||
        hostname === "localhost" || hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") || hostname.endsWith(".internal") ||
        hostname.endsWith(".home.arpa")
      ) return false;
      const ipv4 = hostname.match(
        /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u,
      );
      if (!ipv4) return true;
      const octets = ipv4.slice(1).map(Number);
      if (octets.some((octet) => octet < 0 || octet > 255)) return false;
      const [first, second, third] = octets;
      return !(
        first === 0 || first === 10 || first === 127 || first >= 224 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 0 && third === 0) ||
        (first === 192 && second === 0 && third === 2) ||
        (first === 192 && second === 168) ||
        (first === 198 && (second === 18 || second === 19)) ||
        (first === 198 && second === 51 && third === 100) ||
        (first === 203 && second === 0 && third === 113)
      );
    } catch {
      return false;
    }
  };
  const sanitizedSourceLocator = (value) => {
    if (typeof value !== "string" || value.length === 0 ||
      value.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !url.hostname ||
        url.hostname.endsWith(".") || url.port) return null;
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      const sanitized = url.toString();
      return sanitizedAcquisitionUrl(sanitized) ? sanitized : null;
    } catch {
      return null;
    }
  };
  const decodedPathSegments = (url) => {
    try {
      return url.pathname.split("/").filter(Boolean).map((segment) =>
        decodeURIComponent(segment)
      );
    } catch {
      return [];
    }
  };
  const federalDocumentId = (url) => {
    const host = url.hostname.toLocaleLowerCase("en-US");
    const segments = decodedPathSegments(url);
    let candidate;
    if (["federalregister.gov", "www.federalregister.gov"].includes(host)) {
      if (segments[0]?.toLocaleLowerCase("en-US") === "d") {
        candidate = segments[1];
      } else if (segments[0]?.toLocaleLowerCase("en-US") === "documents" &&
        segments[1]?.toLocaleLowerCase("en-US") === "full_text") {
        candidate = segments[6]?.replace(/\.(?:html?|txt|xml)$/iu, "");
      } else if (segments[0]?.toLocaleLowerCase("en-US") === "documents") {
        candidate = segments[4];
      }
    } else if (["govinfo.gov", "www.govinfo.gov"].includes(host) &&
      segments[0]?.toLocaleLowerCase("en-US") === "content" &&
      segments[1]?.toLocaleLowerCase("en-US") === "pkg" &&
      /^FR-\d{4}-\d{2}-\d{2}$/iu.test(segments[2] ?? "") &&
      /^(?:html|pdf|text|xml)$/iu.test(segments[3] ?? "")) {
      candidate = segments[4]?.replace(/\.(?:html?|pdf|txt|xml)$/iu, "");
    }
    return candidate && /^[a-z0-9][a-z0-9-]{2,79}$/iu.test(candidate)
      ? candidate
      : null;
  };
  const acquisitionHostnameIsProducerAllowed = (host) => {
    const restrictedOfficialRoots = [
      "ftc.gov", "federalregister.gov", "govinfo.gov",
    ];
    const restrictedAlias = restrictedOfficialRoots.some((root) =>
      host.endsWith(`.${root}`) && host !== `www.${root}`
    );
    const official = !restrictedAlias && (
      [
        "ftc.gov", "www.ftc.gov",
        "federalregister.gov", "www.federalregister.gov",
        "govinfo.gov", "www.govinfo.gov",
      ].includes(host) ||
      host.endsWith(".gov") || host.endsWith(".gov.uk") ||
      host === "eur-lex.europa.eu" || host.endsWith(".europa.eu") ||
      host === "gdacs.org" || host.endsWith(".gdacs.org")
    );
    const contextualRoots = [
      "reuters.com", "apnews.com", "brookings.edu", "rand.org",
      "americanbar.org", "lawfaremedia.org", "harvard.edu", "stanford.edu",
    ];
    const contextual = contextualRoots.some((root) =>
      host === root || host.endsWith(`.${root}`)
    );
    return host !== "europa.eu" && (official || contextual);
  };
  const acquisitionUrlsShareAuthority = (left, right) => {
    const leftHost = left.hostname.toLocaleLowerCase("en-US");
    const rightHost = right.hostname.toLocaleLowerCase("en-US");
    if (!acquisitionHostnameIsProducerAllowed(leftHost) ||
      !acquisitionHostnameIsProducerAllowed(rightHost)) return false;
    const federalRegisterHosts = new Set([
      "federalregister.gov", "www.federalregister.gov",
    ]);
    const govInfoHosts = new Set(["govinfo.gov", "www.govinfo.gov"]);
    const leftIsFederalRegister = federalRegisterHosts.has(leftHost);
    const rightIsFederalRegister = federalRegisterHosts.has(rightHost);
    const leftIsGovInfo = govInfoHosts.has(leftHost);
    const rightIsGovInfo = govInfoHosts.has(rightHost);
    const leftIsFederal = leftIsFederalRegister || leftIsGovInfo;
    const rightIsFederal = rightIsFederalRegister || rightIsGovInfo;
    if (leftIsFederal || rightIsFederal) {
      if (!leftIsFederal || !rightIsFederal) return false;
      const leftId = federalDocumentId(left);
      const rightId = federalDocumentId(right);
      const crossesFamily = leftIsFederalRegister !== rightIsFederalRegister;
      if (crossesFamily) return leftId !== null && rightId === leftId;
      return leftId === null || rightId === leftId;
    }
    if (leftHost === rightHost) return true;
    const withoutWww = (host) => host.replace(/^www\./u, "");
    if (withoutWww(leftHost) === withoutWww(rightHost)) return true;
    const isEuropa = (host) =>
      host === "eur-lex.europa.eu" || host.endsWith(".europa.eu");
    return isEuropa(leftHost) && isEuropa(rightHost);
  };
  const acquisitionMatchesSource = (item, source) => {
    const sourceLocator = sanitizedSourceLocator(source?.locator);
    if (!sourceLocator || (sourceLocator !== item.requestedUrl &&
      sourceLocator !== item.finalUrl)) return false;
    const sourceUrl = new URL(sourceLocator);
    const traceUrls = [
      item.requestedUrl,
      ...item.redirectChain.flatMap((hop) => [hop.fromUrl, hop.toUrl]),
      ...(item.finalUrl ? [item.finalUrl] : []),
    ];
    return traceUrls.every((url) =>
      acquisitionUrlsShareAuthority(sourceUrl, new URL(url))
    ) && traceUrls.slice(1).every((url, index) =>
      acquisitionUrlsShareAuthority(
        new URL(traceUrls[index]),
        new URL(url),
      )
    );
  };
  const validAcquisition = (item) => {
    if (!hasExactKeys(item, [
      "schemaVersion", "acquisitionId", "candidateId", "sourceId", "level",
      "requestedUrl", "redirectChain", "finalUrl", "httpStatus", "mediaType",
      "receivedBytes", "latencyMs", "parserPath", "parserOutcome", "outcome",
      "failureReason",
    ]) || item.schemaVersion !== "screen-02-document-acquisition-v1" ||
      typeof item.acquisitionId !== "string" || item.acquisitionId.length === 0 ||
      typeof item.candidateId !== "string" || item.candidateId.length === 0 ||
      !(item.sourceId === null || (typeof item.sourceId === "string" &&
        item.sourceId.length > 0)) ||
      !["host-official", 2, 3, 4].includes(item.level) ||
      !sanitizedAcquisitionUrl(item.requestedUrl) ||
      !(item.finalUrl === null || sanitizedAcquisitionUrl(item.finalUrl)) ||
      !(item.httpStatus === null || (Number.isSafeInteger(item.httpStatus) &&
        item.httpStatus >= 100 && item.httpStatus <= 599)) ||
      ![null, "text/html", "text/plain"].includes(item.mediaType) ||
      !Number.isSafeInteger(item.receivedBytes) || item.receivedBytes < 0 ||
      item.receivedBytes > 2 * 1024 * 1024 + 1 ||
      !Number.isSafeInteger(item.latencyMs) || item.latencyMs < 0 ||
      // This spans queueing and redirect requests; each request's 3-second
      // controller is verified separately from the persisted run trace.
      item.latencyMs > 45_001 ||
      !["official-html-visible-text", "official-plain-text", "not-run"]
        .includes(item.parserPath) ||
      !["parsed", "empty", "rejected", "not-run"].includes(
        item.parserOutcome,
      ) || !["succeeded", "failed"].includes(item.outcome) ||
      !(item.failureReason === null || (typeof item.failureReason === "string" &&
        item.failureReason.length > 0 && item.failureReason.length <= 500)) ||
      !Array.isArray(item.redirectChain) || item.redirectChain.length > 3) {
      return false;
    }
    let expectedFrom = item.requestedUrl;
    const visited = new Set([expectedFrom]);
    for (const hop of item.redirectChain) {
      if (!hasExactKeys(hop, ["status", "fromUrl", "toUrl"]) ||
        ![301, 302, 303, 307, 308].includes(hop.status) ||
        !sanitizedAcquisitionUrl(hop.fromUrl) ||
        !sanitizedAcquisitionUrl(hop.toUrl) ||
        hop.fromUrl !== expectedFrom || visited.has(hop.toUrl)) return false;
      visited.add(hop.toUrl);
      expectedFrom = hop.toUrl;
    }
    if ((item.finalUrl === null && item.redirectChain.length > 0) ||
      (item.finalUrl !== null && item.finalUrl !== expectedFrom)) return false;
    return item.outcome === "succeeded"
      ? item.failureReason === null && item.finalUrl !== null &&
        item.httpStatus >= 200 && item.httpStatus < 300 &&
        item.mediaType !== null && item.parserPath !== "not-run" &&
        item.parserOutcome === "parsed" &&
        item.receivedBytes <= limits.documentMaximumBytes &&
        item.latencyMs <= limits.documentRunTimeoutMs
      : typeof item.failureReason === "string" &&
        item.parserOutcome !== "parsed";
  };
  const acquisitions = execution.documentAcquisitions;
  assert(
    Array.isArray(acquisitions) &&
      acquisitions.length <= limits.maximumDocumentAcquisitions &&
      acquisitions.every(validAcquisition) &&
      acquisitions.reduce((sum, item) => sum + item.receivedBytes, 0) <=
        limits.documentTotalBytes + 1 &&
      acquisitions.filter((item) => item.outcome === "succeeded")
        .reduce((sum, item) => sum + item.receivedBytes, 0) <=
          limits.documentTotalBytes &&
      new Set(acquisitions.map((item) => item?.acquisitionId)).size ===
        acquisitions.length &&
      (allowedCandidateIds === null || acquisitions.every((item) =>
        allowedCandidateIds.has(item.candidateId))) &&
      (candidateSourceIds === null || acquisitions.every((item) => {
        const candidateSources = candidateSourceIds.get(item.candidateId);
        return item.sourceId === null ||
          (allowedSourceIds === null || allowedSourceIds.has(item.sourceId)) &&
          candidateSources !== undefined &&
          candidateSources.has(item.sourceId);
      })) && acquisitions.every((item) => item.sourceId === null ||
        sourcesById !== null && sourcesById.has(item.sourceId) &&
          acquisitionMatchesSource(item, sourcesById.get(item.sourceId))),
    `${caseId} has an invalid document-acquisition account.`,
    "find-document-acquisition-account-invalid",
  );
  const funnel = manifest.funnel;
  assert(
    isRecord(funnel) &&
      funnel.schemaVersion === "screen-02-search-funnel-v2" &&
      Number.isSafeInteger(funnel.sourceRecordsRetrieved) &&
      Number.isSafeInteger(funnel.uniqueEventLeads) &&
      Number.isSafeInteger(funnel.deeperRetrievalAttempts) &&
      funnel.sourceRecordsRetrieved >= aggregate.recordsReceived &&
      funnel.uniqueEventLeads >= aggregate.uniqueProposalsGenerated &&
      funnel.deeperRetrievalAttempts === acquisitions.length,
    `${caseId} has a search funnel inconsistent with its retrieval execution.`,
    "find-retrieval-funnel-execution-invalid",
  );
  const exceptionalZero = allowUnsupportedRoute &&
    baseline.stoppingReason === "unsupported";
  const retainedTargetMet =
    funnel.qualifiedCandidates >= limits.qualifiedCandidateTarget &&
    funnel.displayedCandidates >= limits.qualifiedCandidateTarget;
  assert(
    exceptionalZero || retainedTargetMet || !generalLegal ||
      (baseline.queriesPlanned >= limits.minimumGeneralQueryVariants &&
        baseline.queriesPlanned <= limits.maximumGeneralQueryVariants),
    `${caseId} neither met the retained qualified-candidate target nor executed the required bounded 12–16-query general-legal range.`,
    "find-retrieval-general-legal-budget-invalid",
  );
  return budget;
}

export function requireCurrentScreen02HandoffRetrieval(
  handoff,
  { caseId = "Screen 2 handoff" } = {},
) {
  const manifests = handoff?.history?.searchManifests;
  assert(
    isRecord(handoff) &&
      handoff.schemaVersion === "screen-02-to-screen-03-event-v4" &&
      handoff.sourceScreen === "screen-02" &&
      handoff.destinationScreen === "screen-03" &&
      ["find", "audit"].includes(handoff.mode) &&
      Array.isArray(manifests) && manifests.length > 0 &&
      manifests.at(-1)?.protocolVersion === "screen-02-search-protocol-v4",
    `${caseId} handoff is not backed by a current v4 Screen 2 retrieval.`,
    "screen02-handoff-current-retrieval-absent",
  );
  const sources = Array.isArray(handoff.sources) ? handoff.sources : [];
  const sourcesById = new Map(sources.map((source) => [source?.id, source]));
  const eventSourceIds = Array.isArray(handoff.event?.sourceIds)
    ? handoff.event.sourceIds
    : [];
  const selectedCandidateId = handoff.mode === "find"
    ? handoff.event?.preliminaryQualification?.candidateId
    : null;
  assert(
    sourcesById.size === sources.length,
    `${caseId} handoff has no unique carried-source binding.`,
    "screen02-handoff-source-binding-invalid",
  );
  const candidateSourceIds = handoff.mode === "find" &&
      typeof selectedCandidateId === "string" && selectedCandidateId.length > 0
    ? new Map([[selectedCandidateId, new Set(eventSourceIds)]])
    : null;
  for (const manifest of manifests) {
    if (manifest?.protocolVersion !== "screen-02-search-protocol-v4") continue;
    requireScreen02RetrievalBudget(manifest, {
      caseId,
      generalLegal: false,
      allowUnsupportedRoute: true,
      allowedSourceIds: new Set(sourcesById.keys()),
      candidateSourceIds,
      sourcesById,
    });
  }
  return handoff;
}

export function assertScreen02Acceptance(input, observation) {
  const { funnel, displayed, discoveryStatus, stoppingRule, retrievalBudget, exclusions, decision, handoff, sourceRoutes } = observation;
  assert(sameCanonicalJsonValue(observation.scope, input.scope), `${input.caseId} changed the requested Scope Contract.`, "scope-contract-changed");
  assert(["completed", "completed-empty"].includes(discoveryStatus) &&
    ["met", "not-met"].includes(stoppingRule?.status) &&
    typeof stoppingRule.note === "string" && stoppingRule.note.trim().length > 30,
  `${input.caseId} has no terminal bounded discovery explanation.`, "find-nonterminal-discovery");
  if (input.expectedMode === "positive-journey") {
    assert(funnel.qualifiedCandidates > 0 && displayed > 0 && discoveryStatus === "completed",
      `${input.caseId} positive journey has no qualified candidate.`, "find-positive-candidate-absent");
    return { mode: input.expectedMode, discovery: "qualified-candidates", journey: "required-not-yet-attempted" };
  }
  assert(input.expectedMode === "honest-shortfall", `${input.caseId} has no supported Find acceptance mode.`, "find-acceptance-mode-invalid");
  assert(funnel.qualifiedCandidates === 0 && funnel.displayedCandidates === 0 && displayed === 0 &&
    discoveryStatus === "completed-empty" && funnel.hardScopePassed === 0 &&
    exclusions.length >= funnel.evaluatedUniqueLeads &&
    exclusions.every((entry) => !entry.qualification ||
      (entry.qualification.eligible === false &&
        entry.qualification.exclusionCodes.some((code) => [
          "hard-scope-mismatch",
          "hard-scope-insufficient-evidence",
          "industry-mismatch",
          "insufficient-source-quality",
          "excluded-insufficient-substantive-information",
        ].includes(code)))),
  `${input.caseId} did not establish its reviewed zero-qualified scope shortfall without filler.`, "find-shortfall-evidence-inconsistent");
  assert(input.acceptance?.allowedStops?.includes(retrievalBudget.stoppingReason) &&
    (input.acceptance.shortfallCondition !== "unsupported-native-route" ||
      (retrievalBudget.stoppingReason === "unsupported" &&
        retrievalBudget.queryRequestsExecuted === 0)),
  `${input.caseId} stopped outside its reviewed source-coverage bounds.`, "find-shortfall-stop-unjustified");
  assert(Array.isArray(sourceRoutes), `${input.caseId} did not retain source-route status for shortfall acceptance.`, "find-shortfall-source-status-absent");
  const unsupportedNative = input.acceptance.shortfallCondition === "unsupported-native-route";
  const isRequiredRoute = (route) =>
    (route.channel.endsWith(" diagnostics") && route.channel !== "Screen 2 exact retrieval funnel and stopping diagnostics") ||
    route.channel.startsWith("Screen 2 exact retrieval funnel · ") || route.channel.endsWith(" · official") ||
    (!unsupportedNative && route.channel === "Bounded substantive-information retrieval ladder");
  if (unsupportedNative) {
    assert(sourceRoutes.some((route) => route.channel === "Coverage limitation · national-primary-source-not-configured" &&
      route.status === "not-searched" && typeof route.note === "string" && route.note.length > 20),
    `${input.caseId} lacks the explicit native-source coverage limitation.`, "find-shortfall-coverage-limitation-absent");
  }
  const failedRoutes = sourceRoutes.filter((route) => route.status === "failed");
  const sourceFailures = failedRoutes.filter(isRequiredRoute);
  assert(sourceFailures.length === 0,
    `${input.caseId} cannot establish honest shortfall while required source retrieval failed: ${sourceFailures.map((route) => route.channel).join(", ")}.`,
    "find-shortfall-source-failure");
  assert(decision.openedCandidateSnapshotId === null && decision.tentativeSelectionSnapshotId === null &&
    decision.continuedRevision === null && handoff === null,
  `${input.caseId} shortfall created a false selection or Screen 3 handoff.`, "find-shortfall-false-handoff");
  return { mode: input.expectedMode, discovery: "completed-empty", qualificationTargetMet: false,
    stoppingRuleStatus: stoppingRule.status, reason: stoppingRule.note,
    stoppingReason: retrievalBudget.stoppingReason, selection: "absent", handoff: "absent",
    nonNativeRejectedLeadRetrievalLimits: failedRoutes.map(({ channel, note }) => ({ channel, note })) };
}

function normalizedEvidencePassage(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function hasReviewedScreen02CandidateEvidence(
  input,
  candidate,
  sourcesById,
) {
  const binding = input.acceptance?.requiredCandidateEvidence;
  if (!binding) return true;
  if (!candidate || candidate.identity?.canonicalTitle !== binding.canonicalTitle ||
    candidate.identity?.formalIdentifier !== binding.formalIdentifier ||
    candidate.identity?.issuer !== binding.issuer ||
    candidate.identity?.issuingJurisdiction !== binding.issuingJurisdiction) {
    return false;
  }
  const source = candidate.sourceIds
    .map((sourceId) => sourcesById.get(sourceId))
    .find((item) => item?.locator === binding.sourceLocator);
  if (!source || typeof source.evidenceText !== "string") return false;
  const sourceText = normalizedEvidencePassage(source.evidenceText);
  const coordinates = candidate.qualification?.substantiveOverview
    ?.sourceGrounding?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  const groundedTexts = coordinates
    .filter((coordinate) => coordinate?.sourceId === source.id &&
      coordinate?.polarity === "affirmative")
    .map((coordinate) => normalizedEvidencePassage(coordinate.text));
  const normalizedTitle = normalizedEvidencePassage(binding.canonicalTitle);
  const titleTokens = normalizedTitle.split(" ").filter(Boolean);
  const sourceHasAll = (passages, minimumLength = 20) =>
    passages.every((passage) => {
      const normalized = normalizedEvidencePassage(passage);
      return normalized.length >= minimumLength && sourceText.includes(normalized);
    });
  const groundedHasAll = (passages, minimumLength = 20) =>
    passages.every((passage) => {
      const normalized = normalizedEvidencePassage(passage);
      return normalized.length >= minimumLength &&
        groundedTexts.some((grounded) => grounded.includes(normalized));
    });
  const requiredIdentityFacts = [
    binding.canonicalTitle,
    binding.issuer,
    binding.issuingJurisdiction,
    binding.formalIdentifier,
  ].filter((value) => typeof value === "string" && value.length > 0);
  const strictTextIdentity = sourceHasAll(requiredIdentityFacts, 2) &&
    groundedHasAll(requiredIdentityFacts, 2);
  const retainedSourceMetadataIdentity =
    typeof source.title === "string" && source.title.trim().length > 0 &&
    normalizedEvidencePassage(source.publisher) ===
      normalizedEvidencePassage(binding.issuer) &&
    typeof source.publishedDate === "string" &&
    typeof source.channel === "string" && source.channel.trim().length > 0;
  const identityGrounded = sourceHasAll(binding.identityPassages, 8) &&
    groundedHasAll(binding.identityPassages, 8) &&
    (strictTextIdentity || retainedSourceMetadataIdentity) &&
    coordinates.some((coordinate) =>
      coordinate?.sourceId === source.id &&
      coordinate?.polarity === "affirmative" &&
      Array.isArray(coordinate.matchedIdentityTerms) &&
      coordinate.matchedIdentityTerms.some((term) => {
        const normalizedTerm = normalizedEvidencePassage(term);
        return normalizedTerm.length > 0 &&
          (normalizedTitle.includes(normalizedTerm) ||
            titleTokens.some((token) => token.startsWith(normalizedTerm) ||
              normalizedTerm.startsWith(token)));
      })
    );
  // Source-grounding coordinates are a bounded set of the strongest extracts,
  // so a later bridge sentence can be omitted even when the same exact source
  // is bound to all three qualification facets. Keep identity coordinate-bound,
  // and require each bridge verbatim in that source plus facet/source binding.
  const industryPresent = sourceHasAll(binding.industryBridgePassages);
  const populationPresent = sourceHasAll(binding.populationBridgePassages);
  const industrySourceBound = candidate.qualification?.industryFit
    ?.evidenceSourceIds?.includes(source.id);
  const overviewSourceBound = candidate.qualification?.substantiveOverview
    ?.evidenceSourceIds?.includes(source.id);
  const qualificationSourceBound = candidate.qualification?.evidenceSourceIds
    ?.includes(source.id);
  return identityGrounded && industryPresent && populationPresent &&
    industrySourceBound && overviewSourceBound && qualificationSourceBound;
}

export function projectScreen02Result(input, snapshot) {
  const state = readCanonicalWorkflowState(snapshot, "find");
  assert(
    sameCanonicalJsonValue(state.screen01Baseline.scopeContract, input.scope),
    `${input.caseId} changed the requested Scope Contract.`,
  );
  const active = activeFindSet(state);
  const activeIds = new Set(active.candidateSnapshotIds);
  const byId = new Map(
    state.candidates.map((candidate) => [candidate.candidateSnapshotId, candidate]),
  );
  const order = [...active.ordering].sort((left, right) => left.rank - right.rank);
  const sourcesById = new Map(state.sources.map((source) => [source.id, source]));
  const displayed = order
    .map((entry) => ({ entry, candidate: byId.get(entry.candidateSnapshotId) }))
    .filter(({ candidate }) => candidate && activeIds.has(candidate.candidateSnapshotId));
  assert(
    (input.expectedMode === "honest-shortfall" || displayed.length > 0) &&
      displayed.length === active.candidateSnapshotIds.length &&
      displayed.length === order.length && activeIds.size === active.candidateSnapshotIds.length &&
      new Set(order.map((entry) => entry.candidateSnapshotId)).size === order.length &&
      displayed.length <= 10,
    `${input.caseId} returned an empty, inconsistent, or unbounded candidate list.`,
    "find-display-contract-failed",
  );
  for (const { candidate } of displayed) {
    assert(
      candidate.qualification?.eligible === true &&
        candidate.qualification.classification !== "mismatch" &&
        candidate.qualification.evidenceSourceIds.length > 0 &&
        (candidate.qualification.classification === "broad"
          ? candidate.qualification.section === "broader"
          : candidate.qualification.section === "best-match"),
      `${input.caseId} displayed a candidate that failed fixed qualification.`,
    );
  }
  const requiredCandidateClassifications =
    input.acceptance?.requiredCandidateClassifications ?? [];
  assert(
    requiredCandidateClassifications.length === 0 || displayed.some(
      ({ candidate }) =>
        requiredCandidateClassifications.includes(
          candidate.qualification?.classification,
        ) &&
        candidate.qualification?.substantiveOverview?.passed === true &&
        candidate.qualification.evidenceSourceIds.some((sourceId) =>
          candidate.sourceIds.includes(sourceId) &&
          typeof sourcesById.get(sourceId)?.evidenceText === "string" &&
          sourcesById.get(sourceId).evidenceText.trim().length > 0
        ) && hasReviewedScreen02CandidateEvidence(
          input,
          candidate,
          sourcesById,
        ),
    ),
    `${input.caseId} has no substantive source-backed candidate in its required classification set.`,
    "find-required-candidate-classification-absent",
  );
  const funnel = active.manifest?.funnel;
  const retrievalBudget = requireScreen02RetrievalBudget(active.manifest, {
    caseId: input.caseId,
    generalLegal: /\b(?:regulation|law|policy|statute|legislation)\b/iu.test(
      input.scope.eventFamily,
    ),
    allowUnsupportedRoute: input.expectedMode === "honest-shortfall" &&
      input.acceptance?.shortfallCondition === "unsupported-native-route",
    allowedCandidateIds: new Set([
      ...displayed.map(({ candidate }) => candidate.candidateId),
      ...active.manifest.exclusions.map((exclusion) => exclusion.recordId),
      ...active.manifest.exclusions.map((exclusion) =>
        `host-lead-${exclusion.recordId}`.slice(0, 200)
      ),
      ...active.manifest.queryMatrix.flatMap((query) =>
        query.returnedRecordIds
      ),
    ]),
    allowedSourceIds: new Set(sourcesById.keys()),
    candidateSourceIds: new Map(displayed.map(({ candidate }) => [
      candidate.candidateId,
      new Set(candidate.sourceIds),
    ])),
    sourcesById,
  });
  assert(
    funnel?.schemaVersion === "screen-02-search-funnel-v2" &&
      funnel.displayedCandidates === displayed.length &&
      Number.isInteger(funnel.displayedCandidates) && funnel.displayedCandidates >= 0 &&
      Number.isInteger(funnel.qualifiedCandidates) && funnel.qualifiedCandidates >= 0 &&
      funnel.qualifiedCandidates >= funnel.displayedCandidates &&
      funnel.evaluatedUniqueLeads >= funnel.qualifiedCandidates &&
      funnel.sourceRecordsRetrieved >= funnel.uniqueEventLeads &&
      funnel.uniqueEventLeads >= funnel.evaluatedUniqueLeads &&
      funnel.evaluatedUniqueLeads <= 60 &&
      funnel.hardScopePassed + funnel.hardScopeDemonstratedMismatch +
          funnel.hardScopeInsufficientEvidence + funnel.hardScopeMixed ===
        funnel.evaluatedUniqueLeads &&
      Number.isSafeInteger(funnel.retrievalFailures) &&
      funnel.retrievalFailures >= 0 &&
      funnel.hostContribution === 0 &&
      !active.manifest.hostReviewApplication &&
      active.manifest.outcomeValuesInspected === false &&
      state.outcomeValuesInspected === false &&
      state.assessmentRequests.length === 0 &&
      active.manifest.queryMatrix.length > 0,
    `${input.caseId} did not complete the fixed, outcome-blind funnel in experimental-off mode.`,
    "find-qualification-funnel-failed",
  );

  const discovery = state.discoveryRequests.find((request) =>
    request.candidateSetSnapshotId === active.candidateSetSnapshotId);
  const acceptance = assertScreen02Acceptance(input, {
    scope: state.screen01Baseline.scopeContract,
    funnel, displayed: displayed.length, discoveryStatus: discovery?.status,
    stoppingRule: active.manifest.stoppingRule, retrievalBudget,
    exclusions: active.manifest.exclusions, decision: state.decision,
    sourceRoutes: active.manifest.channels,
    handoff: snapshot.handoff ?? null,
  });

  const candidates = displayed.map(({ entry, candidate }) => {
    const qualification = candidate.qualification;
    const sourceHosts = [...new Set(
      candidate.sourceIds
        .map((id) => sourcesById.get(id)?.locator)
        .filter((locator) => typeof locator === "string")
        .map(sourceHost),
    )].sort();
    return {
      candidateId: candidate.candidateId,
      rank: entry.rank,
      title: candidate.identity.canonicalTitle,
      formalIdentifier: candidate.identity.formalIdentifier,
      issuer: candidate.identity.issuer,
      jurisdiction: candidate.identity.issuingJurisdiction,
      eventType: candidate.identity.eventType,
      origin: candidate.origin,
      classification: qualification.classification,
      section: qualification.section,
      lane: qualification.lane,
      cacheReused:
        /Reused the persisted deterministic qualification/iu.test(
          qualification.ranking.explanation,
        ),
      qualificationReason: qualification.explanation,
      orderingReason: entry.reason,
      sourceCount: candidate.sourceIds.length,
      sourceHosts,
      limitations: [...candidate.limitations],
    };
  });
  const candidateHosts = [...new Set(
    candidates.flatMap((candidate) => candidate.sourceHosts),
  )].sort();
  const queryMatrix = active.manifest.queryMatrix.map((query) => ({
    query: query.query,
    purpose: query.purpose,
    returnedRecordCount: query.returnedRecordIds.length,
  }));
  const sourceRoutes = active.manifest.channels.map((channel) => ({
    channel: channel.channel,
    status: channel.status,
    note: channel.note,
  }));
  const exclusions = groupCounts(
    active.manifest.exclusions,
    (entry) => entry.qualification?.exclusionCodes?.join(",") || entry.reason,
  ).map(({ value, count }) => ({ reason: value, count }));
  const reusedCandidateEntries = candidates
    .filter((candidate) => candidate.cacheReused)
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      lane: candidate.lane,
    }));
  const reusedExclusionEntries = active.manifest.exclusions
    .filter((entry) => isPersistedQualificationReuseReason(entry.reason))
    .flatMap((entry) => entry.qualification?.lane
      ? [{ candidateId: entry.recordId, lane: entry.qualification.lane }]
      : []);
  const cacheReuseEntries = [
    ...reusedCandidateEntries,
    ...reusedExclusionEntries,
  ];
  const cacheReuseLanes = cacheReuseEntries.map((entry) => entry.lane);
  const cacheReuseCount = cacheReuseLanes.length;
  return {
    scope: { ...input.scope },
    expectedMode: input.expectedMode,
    acceptance,
    activeReferenceCount: active.candidateSnapshotIds.length,
    activeResolvedCount: displayed.length,
    continuationReady: snapshot.handoff?.destinationScreen === "screen-03",
    queryMatrix,
    sourceRoutes,
    funnel: { ...funnel },
    retrievalBudget,
    contextBridges: projectContextBridges(active.manifest.contextBridges),
    exclusions,
    candidates,
    diversity: {
      jurisdictions: [...new Set(candidates.map((item) => item.jurisdiction).filter(Boolean))].sort(),
      issuers: [...new Set(candidates.map((item) => item.issuer).filter(Boolean))].sort(),
      eventTypes: [...new Set(candidates.map((item) => item.eventType).filter(Boolean))].sort(),
      origins: [...new Set(candidates.map((item) => item.origin))].sort(),
      sourceHosts: candidateHosts,
      sections: groupCounts(candidates, (candidate) => candidate.section ?? "none")
        .map(({ value, count }) => ({ section: value, count })),
    },
    hostLifecycle: {
      mode: "experimental-off",
      lifecycle: "not-attempted-mode-off",
      firstAttempt: "not-attempted",
      retry: "not-attempted",
      secondRoundAdditions: 0,
      modelSubmissions: 0,
    },
    shortfall: {
      targetCandidateCount: 10,
      displayedCandidateCount: candidates.length,
      count: Math.max(0, 10 - candidates.length),
      stoppingRuleStatus: active.manifest.stoppingRule.status,
      stoppingRuleNote: active.manifest.stoppingRule.note,
    },
    fixedOnlyUsability: {
      serverWorkflowCompleted: true,
      terminalStatus: active.manifest.stoppingRule.status,
      candidateInspectionContractAvailable: candidates.length > 0,
      browserInteraction: "not-tested-by-this-script",
      humanUsabilityJudgment: "not-claimed",
    },
    cacheReuseCount,
    cacheReuseEntries,
    cacheReuseLanes,
    outcomeValuesInspected: false,
  };
}

export function assertFindPositiveHandoff(input, snapshot, selectedId) {
  requireCurrentScreen02HandoffRetrieval(snapshot?.handoff, {
    caseId: input.caseId,
  });
  const state = readCanonicalWorkflowState(snapshot, "find");
  const selected = state.candidates.find((candidate) =>
    candidate.candidateSnapshotId === selectedId
  );
  const requiredCandidateClassifications =
    input.acceptance?.requiredCandidateClassifications ?? [];
  const handoffSourcesById = new Map(
    (snapshot.handoff?.sources ?? []).map((source) => [source.id, source]),
  );
  assert(input.expectedMode === "positive-journey" &&
    selected?.sourceIds.length > 0 &&
    (requiredCandidateClassifications.length === 0 ||
      (selected.qualification?.eligible === true &&
        requiredCandidateClassifications.includes(
          selected.qualification.classification,
        ) && selected.qualification.substantiveOverview?.passed === true &&
        selected.qualification.evidenceSourceIds.some((sourceId) =>
          selected.sourceIds.includes(sourceId) &&
          typeof handoffSourcesById.get(sourceId)?.evidenceText === "string" &&
          handoffSourcesById.get(sourceId).evidenceText.trim().length > 0
        ) && hasReviewedScreen02CandidateEvidence(
          input,
          selected,
          handoffSourcesById,
        ))) &&
    state.decision.tentativeSelectionSnapshotId === selectedId && state.decision.continuedRevision !== null &&
    snapshot.handoff?.mode === "find" && snapshot.handoff.destinationScreen === "screen-03" &&
    snapshot.handoff.decision?.candidateSnapshotId === selectedId &&
    snapshot.handoff.provenance?.candidateSnapshotId === selectedId &&
    snapshot.handoff.sources?.length > 0 &&
    (requiredCandidateClassifications.length === 0 ||
      snapshot.handoff.event?.preliminaryQualification?.classification ===
        selected.qualification?.classification) &&
    sameCanonicalJsonValue(snapshot.handoff.screen01Baseline?.scopeContract, input.scope),
  `${input.caseId} did not produce a handoff for its exact qualified selection and Scope Contract.`, "find-positive-handoff-invalid");
  assertScreen02HandoffMatchesCanonicalState(
    state,
    snapshot?.handoff,
    `${input.caseId} Find handoff`,
  );
}

async function runScreen2Case(input) {
  let latestSnapshot = null;
  let primaryFailure = null;
  try {
    const opened = await createWorkflow(input, "find");
    latestSnapshot = opened.snapshot;
    const first = await applyScreen02Mutation(
      latestSnapshot,
      input,
      "search-1",
      "find-search",
      { criteria: [] },
    );
    latestSnapshot = first.snapshot;
    const completedFirst = await completeScreen02FindSearch(
      first,
      input,
      "search-1",
      (snapshot) => {
        latestSnapshot = snapshot;
      },
    );
    latestSnapshot = completedFirst.current.snapshot;
    await recordCaseProgress("screen2:find:validate-first-search");
    const firstProjection = {
      ...projectScreen02Result(input, latestSnapshot),
      clientContinuation: {
        continuationCalls: completedFirst.continuationCalls,
        completedToolCallCount: completedFirst.completedToolCallCount,
        terminalStatus: completedFirst.terminalStatus,
      },
    };
    const firstLanes = qualificationLaneIndex(readCanonicalWorkflowState(latestSnapshot, "find"));
    await recordCaseProgress("screen2:find:validate-first-search", {
      completed: true, observations: { firstSearch: firstProjection },
    });
    let observations = firstProjection;
    if (input.repeatSearch) {
      const repeated = await applyScreen02Mutation(latestSnapshot, input, "search-2", "find-search", { criteria: [] });
      latestSnapshot = repeated.snapshot;
      const completedRepeated = await completeScreen02FindSearch(
        repeated,
        input,
        "search-2",
        (snapshot) => {
          latestSnapshot = snapshot;
        },
      );
      latestSnapshot = completedRepeated.current.snapshot;
      await recordCaseProgress("screen2:find:validate-repeat-search");
      const repeatedProjection = {
        ...projectScreen02Result(input, latestSnapshot),
        clientContinuation: {
          continuationCalls: completedRepeated.continuationCalls,
          completedToolCallCount: completedRepeated.completedToolCallCount,
          terminalStatus: completedRepeated.terminalStatus,
        },
      };
      assert(repeatedProjection.cacheReuseCount > 0, `${input.caseId} did not exercise deterministic qualification cache reuse.`);
      assert(repeatedProjection.cacheReuseLanes.every((lane) => lane !== "cached-candidate"),
        `${input.caseId} replaced source provenance with a cache marker.`);
      assertPreservedCacheLanes(firstLanes, repeatedProjection.cacheReuseEntries, input.caseId);
      await recordCaseProgress("screen2:find:validate-repeat-search", {
        completed: true, observations: { repeatedSearch: repeatedProjection },
      });
      observations = { firstSearch: firstProjection, repeatedSearch: repeatedProjection,
        cache: { repeatedExactScope: true, cachedCandidateCount: repeatedProjection.cacheReuseCount,
          preservedSourceLanes: repeatedProjection.cacheReuseLanes, providerCacheInternals: "not-claimed" } };
    }
    if (input.expectedMode === "positive-journey") {
      const state = readCanonicalWorkflowState(latestSnapshot, "find");
      const active = activeFindSet(state);
      const requiredCandidateClassifications =
        input.acceptance?.requiredCandidateClassifications ?? [];
      const selectedId = [...active.ordering]
        .sort((left, right) => left.rank - right.rank)
        .map((entry) => entry.candidateSnapshotId)
        .find((candidateSnapshotId) => {
          if (requiredCandidateClassifications.length === 0) return true;
          const candidate = state.candidates.find((item) =>
            item.candidateSnapshotId === candidateSnapshotId
          );
          return candidate?.qualification?.eligible === true &&
            requiredCandidateClassifications.includes(
              candidate.qualification.classification,
            ) && candidate.qualification.substantiveOverview?.passed === true &&
            candidate.qualification.evidenceSourceIds.some((sourceId) =>
              candidate.sourceIds.includes(sourceId) &&
              state.sources.some((source) =>
                source.id === sourceId &&
                typeof source.evidenceText === "string" &&
                source.evidenceText.trim().length > 0
              )
            ) && hasReviewedScreen02CandidateEvidence(
              input,
              candidate,
              new Map(state.sources.map((source) => [source.id, source])),
            );
        });
      const selected = state.candidates.find((candidate) => candidate.candidateSnapshotId === selectedId);
      assert(selected?.qualification?.eligible === true && active.candidateSnapshotIds.includes(selectedId),
        `${input.caseId} positive journey has no active qualified selection.`, "find-positive-candidate-absent");
      for (const [suffix, action, payload] of [
        ["candidate", "find-open", { candidateSnapshotId: selectedId }],
        ["selection", "find-select", { candidateSnapshotId: selectedId }],
        ["continue", "find-continue", {}],
      ]) {
        const changed = await applyScreen02Mutation(latestSnapshot, input, suffix, action, payload);
        latestSnapshot = changed.snapshot;
      }
      assertFindPositiveHandoff(input, latestSnapshot, selectedId);
      await recordCaseProgress("screen2:find:verify-handoff", { completed: true });
      const opened = await callTool(screen03OpenTool, screen03OpenInput(latestSnapshot, operationId(input.caseId, "screen3-open")));
      const screen3 = assertScreen03Boundary(opened, latestSnapshot, "opened", "open", `${input.caseId} positive Find Screen 3`);
      assert(screen3.state.status === "reviewing" && screen3.state.researchCoverage.status !== "pending" &&
        sameCanonicalJsonValue(screen3.state.eventIdentity, latestSnapshot.handoff.event.identity),
        `${input.caseId} did not open the selected event in terminal Screen 3 review.`, "find-screen3-review-failed");
      const journey = { selection: "server-selected-qualified-candidate", handoff: "verified-exact-selection-and-scope",
        selectedClassification: selected.qualification.classification, selectedSection: selected.qualification.section,
        screen3: projectScreen03State(screen3.state) };
      observations = { ...observations, journey };
      await recordCaseProgress("screen2:find:screen3-open", { completed: true, observations: { journey } });
    }
    return { observations, scenarioPredicate: { status: "passed", mode: input.expectedMode,
      rule: input.expectedMode === "honest-shortfall"
        ? "Reviewed bounded zero-qualified shortfall; no filler, selection or handoff"
        : "Qualified source-backed discovery, actual selection, exact handoff and terminal Screen 3 review" } };
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    await retireCaseSnapshot(latestSnapshot, primaryFailure);
  }
}

function normalizeMatchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\b([hs])\s*\.?\s*b\s*\.?\s*0*(\d+)\b/giu, "$1b $2")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function identityText(identity) {
  return [
    identity?.canonicalTitle,
    ...(identity?.commonNames ?? []),
    identity?.formalIdentifier,
    identity?.issuer,
    identity?.issuingJurisdiction,
  ].map(normalizeMatchText).filter(Boolean).join(" | ");
}

export function targetMatches(identity, targetTerms) {
  const haystack = ` ${identityText(identity)} `;
  return targetTerms.some((term) => haystack.includes(` ${normalizeMatchText(term)} `));
}

function activeAuditMatch(state, input) {
  const active = state.matchSets.find(
    (item) => item.matchSetSnapshotId === state.activeMatchSetSnapshotId,
  );
  assert(active?.status === "active", `${input.caseId} has no active Audit match set.`);
  const sourcesById = new Map(state.sources.map((source) => [source.id, source]));
  const activeMatches = state.possibleMatches.filter((match) =>
    active.possibleMatchSnapshotIds.includes(match.matchSnapshotId)
  );
  requireScreen02RetrievalBudget(active.manifest, {
    caseId: input.caseId,
    generalLegal: false,
    allowedCandidateIds: new Set([
      ...activeMatches.map((match) => match.matchId),
      ...active.manifest.exclusions.map((exclusion) => exclusion.recordId),
      ...active.manifest.exclusions.map((exclusion) =>
        `host-lead-${exclusion.recordId}`.slice(0, 200)
      ),
      ...active.manifest.queryMatrix.flatMap((query) => query.returnedRecordIds),
    ]),
    allowedSourceIds: new Set(sourcesById.keys()),
    candidateSourceIds: new Map(activeMatches.map((match) => [
      match.matchId,
      new Set(match.sourceIds),
    ])),
    sourcesById,
  });
  const activeIds = new Set(active.possibleMatchSnapshotIds);
  const matches = state.possibleMatches.filter(
    (match) => activeIds.has(match.matchSnapshotId) &&
      targetMatches(match.identity, input.targetTerms),
  );
  assert(
    matches.length > 0,
    `${input.caseId} found no active match satisfying its semantic target predicate.`,
    "audit-target-match-absent",
  );
  const relationOrder = new Map([
    ["exact", 0],
    ["supported-alias", 1],
    ["original", 2],
    ["amendment", 3],
    ["implementing-rule", 4],
    ["enforcement-action", 5],
    ["related-event", 6],
    ["uncertain", 7],
  ]);
  return [...matches].sort(
    (left, right) =>
      (relationOrder.get(left.relationship) ?? 99) -
      (relationOrder.get(right.relationship) ?? 99),
  )[0];
}

function allScreen03Proposals(state) {
  return screen03ProposalGroupKeys.flatMap((key) => state.proposals[key] ?? []);
}

function factualScreen03Proposals(state) {
  return allScreen03Proposals(state).filter(
    (proposal) => proposal.group !== "required-variable",
  );
}

function evidenceByReference(state, reference) {
  return state.evidence.find(
    (evidence) => evidence.id === reference || evidence.sourceId === reference,
  );
}

function passageProjection(state, proposal) {
  const passageIds = new Set(proposal.passageIds ?? []);
  return state.evidence.flatMap((evidence) =>
    evidence.passages
      .filter((passage) => passageIds.has(passage.id))
      .map((passage) => ({
        sourceTitle: evidence.title,
        sourcePlatform: evidence.channel || evidence.publisher,
        authorityTier: evidence.authorityTier,
        locator: passage.locator ?? evidence.locator,
        basis: passage.basis,
        officialField: passage.officialField ?? null,
        passageNumber: passage.number,
        exactPassage: passage.text,
      })),
  );
}

export function projectScreen03State(state) {
  rememberPrivateIdentifiers(state);
  const proposals = factualScreen03Proposals(state).map((proposal) => ({
    group: proposal.group,
    label: proposal.label,
    value: proposal.value,
    stage: proposal.group === "timeline" ? proposal.stage : null,
    support: proposal.support,
    reviewStatus: proposal.reviewStatus,
    uncertainty: proposal.uncertainty,
    passages: passageProjection(state, proposal),
  }));
  return {
    eventIdentity: { ...state.eventIdentity },
    contextLeads: projectContextLeads(state.contextLeads),
    initialSources: state.evidence.map((evidence) => ({
      title: evidence.title,
      sourcePlatform: evidence.channel || evidence.publisher,
      publisher: evidence.publisher,
      locator: evidence.locator,
      authorityTier: evidence.authorityTier,
      status: evidence.status,
      passageCount: evidence.passages.length,
      passageBases: [...new Set(evidence.passages.map((passage) => passage.basis))].sort(),
      officialFields: [...new Set(
        evidence.passages.map((passage) => passage.officialField).filter(Boolean),
      )].sort(),
    })),
    research: {
      status: state.researchCoverage.status,
      queries: state.researchCoverage.queries.map((query) => ({
        query: query.query,
        purpose: query.purpose,
        returnedEvidenceCount: query.returnedEvidenceIds.length,
      })),
      channels: state.researchCoverage.channels.map((channel) => ({
        channel: channel.channel,
        status: channel.status,
        note: channel.note,
      })),
      routes: [...state.researchCoverage.routes],
      stages: [...state.researchCoverage.stages],
      languages: [...state.researchCoverage.languages],
      authorityTiers: [...state.researchCoverage.authorityTiers],
      gaps: [...state.researchCoverage.gaps],
      recordsReviewed: state.researchCoverage.recordsReviewed,
      activeEvidenceCount: state.researchCoverage.activeEvidenceCount,
      stoppingRule: { ...state.researchCoverage.stoppingRule },
    },
    proposals,
    supportCounts: groupCounts(proposals, (proposal) => proposal.support)
      .map(({ value, count }) => ({ support: value, count })),
    outcomeValuesInspected: false,
  };
}

function identityOfficialField(label) {
  const value = String(label).trim().toLocaleLowerCase("en-US");
  if (/^canonical (?:event )?title$/u.test(value)) return "canonical-title";
  if (/^(?:verified )?common names?$/u.test(value)) return "common-name";
  if (/^formal identifier$/u.test(value)) return "formal-identifier";
  if (/^(?:issuer|issuing authority)$/u.test(value)) return "issuer";
  if (/^issuing jurisdiction$/u.test(value)) return "issuing-jurisdiction";
  if (/^(?:current )?status$/u.test(value)) return "status";
  if (/^event type$/u.test(value)) return "event-type";
  return null;
}

export function pdfContentLimitation(input, observation) {
  const locator = input.anchor?.sourceLocator;
  const evidence = observation.initial.initialSources;
  const matching = evidence.filter((source) => source.locator === locator);
  const documentBases = new Set(["official-document-passage", "official-guidance-passage", "source-excerpt"]);
  const hasDocumentContent = matching.some((source) => source.passageBases.some((basis) => documentBases.has(basis)));
  const locatorBoundGaps = observation.initial.research.gaps.filter((gap) =>
    typeof gap === "string" && gap.endsWith(`Locator: ${locator}`) &&
    /inaccessible|unavailable|failed|timeout|too large|size limit|conversion failed|could not convert|conversion was not attempted/iu.test(gap));
  return { locator, sourceObserved: matching.length > 0, hasDocumentContent, locatorBoundGaps,
    contentUnavailable: matching.length > 0 && !hasDocumentContent && locatorBoundGaps.length > 0 };
}

export function evaluateScreen03Scenario(input, observation) {
  const reasons = [];
  const identity = observation.initial.eventIdentity;
  const proposals = observation.initial.proposals;
  const evidence = observation.initial.initialSources;
  const research = observation.initial.research;
  const directInClaimGroup = proposals.some(
    (proposal) =>
      proposal.group === input.claimGroup &&
      proposal.support === "direct" &&
      proposal.passages.length > 0,
  );
  if (!targetMatches(identity, input.targetTerms)) {
    reasons.push("Screen 3 identity does not satisfy the case target terms.");
  }
  if (research.status === "pending") {
    reasons.push("Screen 3 research remained pending.");
  }
  if (input.expectedMode === "positive-journey" &&
      observation.actions.confirm !== "server-accepted-direct-supported-probe") {
    reasons.push("The positive evidence journey did not record an actual supported Confirm.");
  }
  switch (input.scenario) {
    case "gdpr":
    case "ccpa":
      if (!directInClaimGroup) {
        reasons.push("The named-law claim group has no active direct passage.");
      }
      break;
    case "another-eu":
      if (!/european union|\beu\b/iu.test(identity?.issuingJurisdiction ?? "") ||
          /general data protection|gdpr/iu.test(identityText(identity))) {
        reasons.push("The event is not a distinct EU instrument.");
      }
      if (!directInClaimGroup) reasons.push("The EU claim group lacks direct support.");
      break;
    case "us-state":
      if (!/utah|state/iu.test(identityText(identity))) {
        reasons.push("The event is not the requested United States state law.");
      }
      if (!directInClaimGroup) reasons.push("The state-law claim group lacks direct support.");
      break;
    case "us-federal":
      if (!/securities and exchange|\bsec\b|federal/iu.test(identityText(identity))) {
        reasons.push("The event is not the requested United States federal rule.");
      }
      if (!directInClaimGroup) reasons.push("The federal claim group lacks direct support.");
      break;
    case "non-eu-national":
      if (!/united kingdom|uk parliament/iu.test(identityText(identity)) ||
          /european union/iu.test(identity?.issuingJurisdiction ?? "")) {
        reasons.push("The event is not a non-EU national instrument.");
      }
      if (!directInClaimGroup) reasons.push("The national claim group lacks direct support.");
      break;
    case "disaster":
      if (!/hurricane|disaster|cyclone/iu.test(
        `${identity?.canonicalTitle ?? ""} ${identity?.eventType ?? ""}`,
      )) {
        reasons.push("The event is not a disaster.");
      }
      if (!directInClaimGroup) reasons.push("The disaster clock lacks direct support.");
      break;
    case "secondary-start": {
      const startingLocator = input.anchor?.sourceLocator;
      const contextLeads = [
        ...(observation.startingSource?.contextLeads ?? []),
        ...(observation.initial.contextLeads ?? []),
      ];
      const secondaryRetained = typeof startingLocator === "string" &&
        startingLocator.startsWith("https://") &&
        (observation.startingSource?.anchorLocator === startingLocator ||
          contextLeads.some((lead) => lead.locator === startingLocator &&
            lead.sourceRole === "contextual-secondary" && lead.status === "unverified"));
      if (!secondaryRetained) {
        reasons.push("The supplied secondary starting URL was not retained in the actual anchor or unverified context.");
      }
      const officialBases = new Set([
        "official-record-field", "official-document-passage", "official-guidance-passage",
      ]);
      const officialIdentity = proposals.some((proposal) =>
        proposal.group === "identity" && proposal.support === "direct" &&
        proposal.passages.some((passage) => passage.locator !== startingLocator &&
          passage.authorityTier <= 2 && officialBases.has(passage.basis) &&
          evidence.some((source) => source.locator === passage.locator &&
            source.authorityTier <= 2 && ["carried", "retrieved"].includes(source.status))));
      if (!officialIdentity) reasons.push("No active official source directly supports the later identity.");
      const promotedSource = evidence.some((source) => source.locator === startingLocator &&
        (source.authorityTier <= 2 || source.passageBases.some((basis) =>
          officialBases.has(basis) || ["source-metadata", "contextual-secondary"].includes(basis))));
      const promotedClaim = proposals.some((proposal) => proposal.support === "direct" &&
        proposal.passages.some((passage) => passage.locator === startingLocator &&
          (proposal.group === "identity" || passage.authorityTier <= 2 ||
            officialBases.has(passage.basis) || ["source-metadata", "contextual-secondary"].includes(passage.basis))));
      if (promotedSource || promotedClaim) {
        reasons.push("The secondary discovery lead was promoted to evidence or direct identity support.");
      }
      if (!directInClaimGroup) reasons.push("The official upgrade did not directly support identity.");
      break;
    }
    case "structured-metadata":
      if (!proposals.some(
        (proposal) =>
          proposal.group === "identity" &&
          proposal.support === "direct" &&
          identityOfficialField(proposal.label) !== null &&
          proposal.passages.some((passage) =>
            passage.basis === "official-record-field" &&
            passage.officialField === identityOfficialField(proposal.label) &&
            passage.authorityTier <= 2 &&
            evidence.some((source) => source.locator === passage.locator &&
              ["carried", "retrieved"].includes(source.status) && source.authorityTier <= 2 &&
              source.passageBases.includes("official-record-field") &&
              source.officialFields.includes(passage.officialField))),
      )) {
        reasons.push("No identity proposal is bound to its structured official field.");
      }
      break;
    case "inaccessible-pdf": {
      const limitation = pdfContentLimitation(input, observation);
      if (!limitation.sourceObserved) reasons.push("The exact scenario PDF source did not reach Screen 3.");
      if (!limitation.contentUnavailable) reasons.push("The exact PDF lacks a locator-bound content limitation, or document text was available.");
      if (observation.actions.confirm !== "server-rejected-unsupported-probe" ||
          observation.actions.confirmProbe?.sourceLocator !== limitation.locator ||
          !["indirect", "unsupported", "conflicting"].includes(observation.actions.confirmProbe?.support)) {
        reasons.push("No actual rejected Confirm was observed for an unsupported claim linked to the exact PDF.");
      }
      break;
    }
    case "saved-run-restoration":
      if (observation.actions.restoration !== "restored-exact-decision") {
        reasons.push("The saved Screen 3 decision did not restore exactly.");
      }
      break;
    default:
      reasons.push("Unknown scenario predicate.");
  }
  return {
    status: reasons.length === 0 ? "passed" : "failed",
    reasons,
  };
}

async function applyScreen03Mutation(parentSnapshot, state, input, suffix, action) {
  const operation = `screen3:${action.type}:${suffix}`;
  await recordCaseProgress(operation);
  const id = operationId(input.caseId, suffix);
  const result = await callTool(
    screen03MutationTool,
    screen03MutationInput(parentSnapshot, state, id, action),
  );
  const applied = assertScreen03Boundary(
    result,
    parentSnapshot,
    "applied",
    "mutation",
    `${input.caseId} Screen 3 ${suffix}`,
  );
  assert(
    applied.state.revision > state.revision,
    `${input.caseId} Screen 3 ${suffix} did not advance the state.`,
  );
  await recordCaseProgress(operation, {
    completed: true, observations: { screen3: projectScreen03State(applied.state) },
  });
  return applied.state;
}

function proposalById(state, proposalId) {
  return allScreen03Proposals(state).find((proposal) => proposal.id === proposalId);
}

async function exerciseScreen03Actions(parentSnapshot, initialState, input) {
  let state = initialState;
  const factual = factualScreen03Proposals(state);
  const preferred = factual.filter((proposal) => proposal.group === input.claimGroup);
  const direct = [...preferred, ...factual].find(
    (proposal) =>
      proposal.support === "direct" &&
      Array.isArray(proposal.passageIds) &&
      proposal.passageIds.length > 0,
  );
  const unsupported = [...preferred, ...factual].find(
    (proposal) => proposal.support !== "direct",
  );
  const negative = input.expectedMode === "negative-evidence";
  const sourceBoundUnsupported = [...preferred, ...factual].find((proposal) =>
    proposal.support !== "direct" && proposal.sourceIds.some((reference) =>
      evidenceByReference(state, reference)?.locator === input.anchor?.sourceLocator));
  const chosen = negative ? sourceBoundUnsupported : direct ?? unsupported;
  assert(chosen, `${input.caseId} returned no factual proposal for action probes.`);
  const actions = {
    confirm: "not-attempted",
    confirmProbe: { support: chosen.support, label: chosen.label,
      sourceLocator: negative ? input.anchor.sourceLocator : null },
    correct: "not-executed-requires-reviewer-supplied-supported-value",
    unresolved: "not-attempted",
    reject: "not-attempted",
    restoration: "not-attempted",
    sourceChange: "not-applicable",
    uiControls: "not-tested-by-this-script",
    humanDecision: "not-claimed",
    hostMapping: "not-invoked-experimental-off",
  };

  let decidedState;
  if (chosen.support === "direct" && chosen.passageIds.length > 0) {
    state = await applyScreen03Mutation(
      parentSnapshot,
      state,
      input,
      "accept",
      {
        type: "review-field",
        proposalId: chosen.id,
        decision: "accept",
        reason:
          "Automated simulated matrix probe: the current server marked this proposal directly supported; no human judgment is claimed.",
      },
    );
    assert(
      proposalById(state, chosen.id)?.reviewStatus === "accepted",
      `${input.caseId} did not persist the simulated supported confirmation.`,
    );
    actions.confirm = "server-accepted-direct-supported-probe";
    decidedState = state;
  } else {
    await recordCaseProgress("screen3:review-field:unsupported-accept");
    const id = operationId(input.caseId, "unsupported-accept");
    const rejected = await callTool(
      screen03MutationTool,
      screen03MutationInput(parentSnapshot, state, id, {
        type: "review-field",
        proposalId: chosen.id,
        decision: "accept",
        reason:
          "Automated negative probe: unsupported evidence must not be confirmable; no human judgment is claimed.",
      }),
    );
    assertScreen03EvidenceGuardRejection(rejected, `${input.caseId} unsupported Screen 3 confirmation`);
    actions.confirm = "server-rejected-unsupported-probe";
    await recordCaseProgress("screen3:review-field:unsupported-accept", {
      completed: true, observations: { confirm: actions.confirm },
    });
    state = await applyScreen03Mutation(
      parentSnapshot,
      state,
      input,
      "unresolved-initial",
      {
        type: "review-field",
        proposalId: chosen.id,
        decision: "unresolved",
        reason:
          "Automated simulated matrix probe records that no direct passage is available; no human judgment is claimed.",
      },
    );
    actions.unresolved = "server-persisted-simulated-probe";
    decidedState = state;
  }

  const restoreId = operationId(input.caseId, "restore");
  await recordCaseProgress("screen3:restore");
  const restoredResult = await callTool(
    screen03OpenTool,
    screen03OpenInput(parentSnapshot, restoreId),
  );
  const restored = assertScreen03Boundary(
    restoredResult,
    parentSnapshot,
    "restored",
    "open",
    `${input.caseId} Screen 3 restoration`,
  );
  assert(
    restored.state.revision === decidedState.revision &&
      restored.state.integrity.stateFingerprint ===
        decidedState.integrity.stateFingerprint &&
      proposalById(restored.state, chosen.id)?.reviewStatus ===
        proposalById(decidedState, chosen.id)?.reviewStatus,
    `${input.caseId} did not restore the exact Screen 3 decision.`,
  );
  actions.restoration = "restored-exact-decision";
  await recordCaseProgress("screen3:restore", {
    completed: true, observations: { restoration: actions.restoration },
  });
  state = restored.state;

  if (proposalById(state, chosen.id)?.reviewStatus !== "unresolved") {
    state = await applyScreen03Mutation(
      parentSnapshot,
      state,
      input,
      "unresolved",
      {
        type: "review-field",
        proposalId: chosen.id,
        decision: "unresolved",
        reason:
          "Automated simulated matrix probe exercises unresolved persistence; no human judgment is claimed.",
      },
    );
    assert(
      proposalById(state, chosen.id)?.reviewStatus === "unresolved",
      `${input.caseId} did not persist unresolved status.`,
    );
    actions.unresolved = "server-persisted-simulated-probe";
  }
  state = await applyScreen03Mutation(
    parentSnapshot,
    state,
    input,
    "reject",
    {
      type: "review-field",
      proposalId: chosen.id,
      decision: "reject",
      reason:
        "Automated simulated matrix probe exercises rejection persistence; no human judgment is claimed.",
    },
  );
  assert(
    proposalById(state, chosen.id)?.reviewStatus === "rejected",
    `${input.caseId} did not persist rejection status.`,
  );
  actions.reject = "server-persisted-simulated-probe";

  const sourceReference = chosen.sourceIds.find(
    (reference) => evidenceByReference(state, reference),
  );
  const evidence = sourceReference
    ? evidenceByReference(state, sourceReference)
    : null;
  if (evidence) {
    const changedFingerprint = evidence.contentFingerprint ===
        "fnv1a64:0000000000000000"
      ? "fnv1a64:0000000000000001"
      : "fnv1a64:0000000000000000";
    state = await applyScreen03Mutation(
      parentSnapshot,
      state,
      input,
      "source-change",
      {
        type: "mark-source-changed",
        sourceId: evidence.id,
        contentFingerprint: changedFingerprint,
        reason:
          "Automated synthetic source-change probe invalidates the prior evidence binding; it does not claim an observed publisher change.",
      },
    );
    const changed = proposalById(state, chosen.id);
    assert(
      changed?.reviewStatus === "proposed" && changed?.support === "unsupported",
      `${input.caseId} source-change probe did not reopen the linked decision.`,
    );
    actions.sourceChange = "synthetic-probe-reopened-linked-decision";
  }
  return { state, actions };
}

async function runScreen3Case(input) {
  let latestSnapshot = null;
  let primaryFailure = null;
  try {
    const opened = await createWorkflow(input, "audit");
    latestSnapshot = opened.snapshot;
    const revised = await applyScreen02Mutation(
      latestSnapshot,
      input,
      "anchor",
      "audit-revise-anchor",
      {
        fields: input.anchor,
        reason:
          "Automated simulated matrix probe applies the input-only anchor; no human identity judgment is claimed.",
      },
    );
    latestSnapshot = revised.snapshot;
    const revisedState = readCanonicalWorkflowState(latestSnapshot, "audit");
    const startingSource = projectAuditStartingSource(revisedState);
    await recordCaseProgress("screen2:audit:select-semantic-match");
    const selectedMatch = activeAuditMatch(revisedState, input);
    await recordCaseProgress("screen2:audit:select-semantic-match", { completed: true });

    const dossier = await applyScreen02Mutation(
      latestSnapshot,
      input,
      "dossier",
      "audit-open",
      { matchSnapshotId: selectedMatch.matchSnapshotId },
    );
    latestSnapshot = dossier.snapshot;
    const confirmed = await applyScreen02Mutation(
      latestSnapshot,
      input,
      "confirm",
      "audit-confirm",
      {
        matchSnapshotId: selectedMatch.matchSnapshotId,
        reason:
          "Automated simulated matrix probe selects the semantically matched input event; no human judgment is claimed.",
      },
    );
    latestSnapshot = confirmed.snapshot;
    const continued = await applyScreen02Mutation(
      latestSnapshot,
      input,
      "continue",
      "audit-continue",
      {},
    );
    latestSnapshot = continued.snapshot;
    assert(
      continued.summary.continuationReady === true &&
        latestSnapshot.handoff?.destinationScreen === "screen-03" &&
        latestSnapshot.handoff?.mode === "audit",
      `${input.caseId} did not produce a Screen 3 handoff.`,
    );
    assertScreen02HandoffMatchesCanonicalState(
      readCanonicalWorkflowState(latestSnapshot, "audit"),
      latestSnapshot.handoff,
      `${input.caseId} Audit handoff`,
    );

    const openId = operationId(input.caseId, "screen3-open");
    await recordCaseProgress("screen3:open");
    const screen03Result = await callTool(
      screen03OpenTool,
      screen03OpenInput(latestSnapshot, openId),
    );
    const screen03 = assertScreen03Boundary(
      screen03Result,
      latestSnapshot,
      "opened",
      "open",
      `${input.caseId} Screen 3 open`,
    );
    assert(
      screen03.state.status === "reviewing" &&
        screen03.state.researchCoverage.status !== "pending" &&
        screen03.state.briefing === undefined &&
        screen03.state.interpretation?.origin !== "chatgpt-host",
      `${input.caseId} entered a nonterminal or retired host-native Screen 3 path.`,
    );
    const initial = projectScreen03State(screen03.state);
    await recordCaseProgress("screen3:open", {
      completed: true, observations: { initial, screen3: initial },
    });
    const exercised = await exerciseScreen03Actions(
      latestSnapshot,
      screen03.state,
      input,
    );
    const observations = {
      startingSource,
      matchedEvent: {
        title: selectedMatch.identity.canonicalTitle,
        relationship: selectedMatch.relationship,
        relationshipReason: selectedMatch.relationshipReason,
        sourceCount: selectedMatch.sourceIds.length,
      },
      initial,
      actions: exercised.actions,
      final: {
        researchStatus: exercised.state.researchCoverage.status,
        status: exercised.state.status,
        outcomeValuesInspected: exercised.state.outcomeValuesInspected,
      },
      hostLifecycle: {
        mode: "experimental-off",
        currentHostPath: "not-invoked",
        modelSubmissions: 0,
      },
    };
    const scenarioPredicate = evaluateScreen03Scenario(input, observations);
    await recordCaseProgress("screen3:scenario-predicate", {
      observations: { ...observations, scenarioPredicate },
    });
    assert(
      scenarioPredicate.status === "passed",
      `${input.caseId} scenario predicate failed: ${scenarioPredicate.reasons.join(" ")}`,
      "screen3-scenario-predicate-failed",
    );
    await recordCaseProgress("screen3:scenario-predicate", { completed: true });
    return { observations, scenarioPredicate };
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    await retireCaseSnapshot(latestSnapshot, primaryFailure);
  }
}

async function writeJsonAtomic(pathname, value) {
  await mkdir(resolve(pathname, ".."), { recursive: true });
  const temporary = `${pathname}.tmp-${process.pid}-${randomUUID()}`;
  const sanitized = sanitizeEvidence(value);
  const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;
  assert(
    !/\bs2[ar]_[A-Za-z0-9_-]{20,128}\b/u.test(serialized) &&
      !/"(?:accessToken|responseKey|stateEnvelope|sealedState|rawState)"\s*:/u.test(serialized),
    "Refusing to write an unsanitized matrix checkpoint.",
  );
  await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, pathname);
}

function baseCheckpoint(selected, status, startedAt) {
  return {
    schemaVersion: checkpointSchemaVersion,
    caseId: selected.input.caseId,
    suite: selected.suite,
    label: selected.input.label,
    expectedMode: selected.input.expectedMode,
    acceptanceReview: selected.input.acceptance,
    inputManifestSha256,
    status,
    expectedCommit,
    endpoint: publicOrigin,
    version: expectedVersion,
    releaseLabel: expectedReleaseLabel,
    flags: { ...executionFlags },
    startedAt,
  };
}

export async function runSelectedCase(selected, evidenceDir, executeCase = async (item) =>
  item.suite === "screen2" ? runScreen2Case(item.input) : runScreen3Case(item.input)) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const pathname = resolve(
    evidenceDir,
    "cases",
    `${selected.input.caseId}.json`,
  );
  activeCaseProgress = createCaseProgress();
  privateNarrativeIdentifiers.clear();
  persistActiveCaseProgress = async (progress) => writeJsonAtomic(pathname, {
    ...baseCheckpoint(selected, "running", startedAt),
    updatedAt: new Date().toISOString(),
    ...progress,
  });
  await persistActiveCaseProgress(activeCaseProgress);
  activeCaseDeadline = started + caseTimeoutMs;
  try {
    const result = await executeCase(selected);
    const finished = Date.now();
    const checkpoint = {
      ...baseCheckpoint(selected, "passed", startedAt),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      scenarioPredicate: result.scenarioPredicate,
      observations: result.observations,
      operation: activeCaseProgress.operation,
      lastSuccessfulStep: activeCaseProgress.lastSuccessfulStep,
      completedSteps: [...activeCaseProgress.completedSteps],
      limitations: [
        "This is an automated, simulated MCP contract probe, not a signed-in ChatGPT-host run.",
        "No mouse, keyboard, accessibility, visual, or human-usability judgment is represented.",
        "No simulated review action is formal product-qualification evidence.",
      ],
    };
    await writeJsonAtomic(pathname, checkpoint);
    return checkpoint;
  } catch (error) {
    const finished = Date.now();
    const checkpoint = {
      ...baseCheckpoint(selected, "failed", startedAt),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      ...projectCaseFailure(error, activeCaseProgress),
      scenarioPredicate: { status: "failed" },
      limitations: [
        "Failure is fail-closed; no qualification result was populated.",
      ],
    };
    await writeJsonAtomic(pathname, checkpoint);
    return checkpoint;
  } finally {
    activeCaseDeadline = null;
    activeCaseProgress = null;
    persistActiveCaseProgress = null;
    privateNarrativeIdentifiers.clear();
  }
}

export function summarizeModeResults(cases) {
  return Object.fromEntries(["positive-journey", "honest-shortfall", "negative-evidence"].map((mode) => {
    const entries = cases.filter((item) => item.expectedMode === mode);
    return [mode, { total: entries.length, passed: entries.filter((item) => item.status === "passed").length,
      failed: entries.filter((item) => item.status === "failed").length }];
  }));
}

async function run(argv) {
  const manifest = validateCaseManifest(caseManifest);
  const options = parseArguments(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.list) {
    console.log(JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      cases: [
        ...manifest.screen2.map((item) => ({ suite: "screen2", caseId: item.caseId })),
        ...manifest.screen3.map((item) => ({ suite: "screen3", caseId: item.caseId })),
      ],
    }, null, 2));
    return 0;
  }
  const selected = selectCases(manifest, options.suite, options.caseId);
  configureTarget();
  await mkdir(resolve(options.evidenceDir, "cases"), { recursive: true });
  const started = Date.now();
  const summaryPath = resolve(options.evidenceDir, "matrix-summary.json");
  const summary = {
    schemaVersion: evidenceSchemaVersion,
    status: "running",
    suite: options.suite,
    selectedCase: options.caseId,
    expectedCommit,
    endpoint: publicOrigin,
    version: expectedVersion,
    releaseLabel: expectedReleaseLabel,
    flags: { ...executionFlags },
    startedAt: new Date(started).toISOString(),
    caseTimeoutMs,
    requestTimeoutMs,
    selectedCount: selected.length,
    inputManifestSha256,
    modeCounts: summarizeModeResults([]),
    deploymentGate: null,
    cases: [],
  };
  await writeJsonAtomic(summaryPath, summary);
  try {
    summary.deploymentGate = await verifyDeploymentGate(options.waitSeconds);
  } catch (error) {
    summary.status = "failed";
    summary.failure = safeErrorMessage(error);
    summary.finishedAt = new Date().toISOString();
    await writeJsonAtomic(summaryPath, summary);
    throw error;
  }

  for (const item of selected) {
    console.log(`Production matrix: ${item.input.caseId} started.`);
    const checkpoint = await runSelectedCase(item, options.evidenceDir);
    summary.cases.push({
      caseId: checkpoint.caseId,
      suite: checkpoint.suite,
      expectedMode: checkpoint.expectedMode,
      status: checkpoint.status,
      durationMs: checkpoint.durationMs,
      scenarioPredicate: checkpoint.scenarioPredicate.status,
    });
    summary.modeCounts = summarizeModeResults(summary.cases);
    await writeJsonAtomic(summaryPath, summary);
    console.log(`Production matrix: ${item.input.caseId} ${checkpoint.status}.`);
  }
  const failed = summary.cases.filter((item) => item.status !== "passed");
  summary.status = failed.length === 0 ? "passed" : "failed";
  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Date.now() - started;
  summary.passedCount = summary.cases.length - failed.length;
  summary.failedCount = failed.length;
  summary.formalQualificationPopulated = false;
  await writeJsonAtomic(summaryPath, summary);
  return failed.length === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Production matrix failed: ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    });
}
