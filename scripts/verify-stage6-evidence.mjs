import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "artifacts/stage6");
const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const expectedReleaseVersion = packageMetadata.version;
const supportedExtensions = new Set([
  ".csv",
  ".har",
  ".html",
  ".json",
  ".jsonl",
  ".log",
  ".md",
  ".svg",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const ignoredTemplateNames = new Set([
  "STAGE-6-ACCEPTANCE-INDEX.template.md",
  "STAGE-6-ASSESSMENT-UNAVAILABLE-CONTROL.template.json",
  "STAGE-6-FIXED-FALLBACK-CONTROL.template.json",
  "STAGE-6-NEGATIVE-SECURITY-CONTROL.template.json",
  "STAGE-6-RUN-MANIFEST.template.json",
]);
const expectedCaseIds = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
];
const expectedFixedFallbackControls = new Map([
  ["FF1-find-fixed-fallback", "find"],
  ["FF2-audit-fixed-fallback", "audit"],
]);
const fixedFallbackTriggerStatuses = new Set([
  "partial",
  "delivery-rejected",
  "service-unavailable",
  "no-tool-submission",
  "validation-failed",
  "retry-exhausted",
]);
const legacyAssessmentUnavailableControls = new Map([
  ["U1-find-assessment-unavailable", "find"],
  ["U2-audit-assessment-unavailable", "audit"],
]);
const assessmentUnavailableTerminalStatuses = new Set([
  "service-unavailable",
  "delivery-rejected",
  "no-tool-submission",
  "timed-out",
  "retry-exhausted",
]);
const mandatoryAssessmentUnavailableScreen03Checks = [
  "Verify study fit against the confirmed Screen 1 scope.",
  "Verify the outcome pathway without inspecting realized outcome values.",
  "Verify the event version, timing, and source-backed factual record.",
  "Verify the covered population, geography, and organization-level exposure boundary.",
  "Verify measurement feasibility and the availability of pre-event exposure indicators.",
  "Document the main validity concern and every unresolved source gap.",
];
const forbidden = [
  {
    label: "raw Screen 2 access token",
    pattern: /s2a_[A-Za-z0-9_-]{43,128}/g,
  },
  {
    label: "raw Screen 2 run identifier",
    pattern: /s2r_[A-Za-z0-9_-]{43,128}/g,
  },
  {
    label: "signed capability or receipt token",
    pattern: /sa2[fa]-(?:capability|receipt)-v1\.[A-Za-z0-9_-]{20,}/g,
  },
  {
    label: "accessToken field",
    pattern: /["']accessToken["']\s*:/g,
  },
  {
    label: "capabilityToken field",
    pattern: /["']capabilityToken["']\s*:/g,
  },
  {
    label: "receiptToken field",
    pattern: /["']receiptToken["']\s*:/g,
  },
  {
    label: "complete stateEnvelope field",
    pattern: /["']stateEnvelope["']\s*:/g,
  },
  {
    label: "ephemeral Screen 2 response key field",
    pattern: /["']responseKey["']\s*:/g,
  },
  {
    label: "assigned signing-key material",
    pattern:
      /["']?SCREEN02_WORKFLOW_(?:PREVIOUS_)?SIGNING_KEY["']?\s*(?:=|:)/g,
  },
  {
    label: "assigned signing-key identifier",
    pattern:
      /["']?SCREEN02_WORKFLOW_(?:PREVIOUS_)?SIGNING_KEY_ID["']?\s*(?:=|:)/g,
  },
];

async function filesUnder(directory) {
  const contentFiles = [];
  const artifactFiles = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await filesUnder(path);
      contentFiles.push(...nested.contentFiles);
      artifactFiles.push(...nested.artifactFiles);
    } else if (entry.isFile()) {
      artifactFiles.push(path);
      if (
        supportedExtensions.has(extname(entry.name).toLowerCase()) &&
        !ignoredTemplateNames.has(basename(entry.name))
      ) {
        contentFiles.push(path);
      }
    }
  }
  return { contentFiles, artifactFiles };
}

let evidence;
try {
  evidence = await filesUnder(root);
} catch (error) {
  throw new Error(
    `Stage 6 evidence directory is unavailable: ${root}. ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

const { contentFiles: files, artifactFiles } = evidence;
if (files.length === 0) {
  throw new Error(
    `Stage 6 evidence directory contains no non-template JSON, Markdown, or text files: ${root}.`,
  );
}

const issues = [];
const manifestsByCase = new Map();
const fixedFallbackControlsById = new Map();
const assessmentUnavailableControlsById = new Map();
let passingNegativeSecurityControls = 0;
let sharedCandidateIdentity = null;

function recordCandidateIdentity(parsed, label) {
  const identity = {
    targetReleaseVersion: parsed.targetReleaseVersion,
    appVersion: parsed.appVersion,
    workflowVersion: parsed.workflowVersion,
    commit: parsed.commit,
    endpointClass: parsed.endpointClass,
    endpoint: parsed.endpoint,
  };
  if (!sharedCandidateIdentity) {
    sharedCandidateIdentity = { ...identity, label };
    return;
  }
  for (const key of Object.keys(identity)) {
    if (identity[key] !== sharedCandidateIdentity[key]) {
      issues.push(
        `${label}: ${key} does not match the frozen candidate recorded in ${sharedCandidateIdentity.label}`,
      );
    }
  }
}

function isCanonicalTimestamp(value) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function isFullCommit(value) {
  return (
    typeof value === "string" &&
    /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)
  );
}

function isArtifactHash(value) {
  return (
    typeof value === "string" && /^sha256:[0-9a-f]{64}$/i.test(value)
  );
}
for (const file of artifactFiles) {
  const artifactName = relative(root, file);
  for (const check of forbidden) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(artifactName)) {
      issues.push(`${artifactName}: ${check.label} in artifact filename`);
    }
  }
}

for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const check of forbidden) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(text)) {
      issues.push(`${relative(root, file)}: ${check.label}`);
    }
  }
  if (extname(file).toLowerCase() !== ".json") continue;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    issues.push(
      `${relative(root, file)}: invalid JSON (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
    continue;
  }
  const label = relative(root, file);
  if (
    parsed?.schemaVersion ===
    "shockaudit-stage6-negative-security-evidence-v1"
  ) {
    if (parsed.controlId !== "N1-private-state-nondisclosure") {
      issues.push(`${label}: negative security controlId is invalid`);
    }
    if (parsed.result !== "pass") {
      issues.push(`${label}: negative security control did not pass`);
    }
    if (
      parsed.targetReleaseVersion !== expectedReleaseVersion ||
      parsed.workflowVersion !== "2.1"
    ) {
      issues.push(
        `${label}: negative security control targets the wrong release`,
      );
    }
    if (!isFullCommit(parsed.commit)) {
      issues.push(
        `${label}: negative security control commit is not full length`,
      );
    }
    if (
      parsed.endpointClass !== "isolated-candidate" ||
      typeof parsed.endpoint !== "string" ||
      parsed.endpoint.length < 8 ||
      parsed.endpoint.includes("REDACT_ORIGIN")
    ) {
      issues.push(
        `${label}: negative security control does not identify the isolated candidate endpoint`,
      );
    }
    if (parsed.appVersion !== expectedReleaseVersion) {
      issues.push(
        `${label}: negative security control appVersion is not the candidate package version`,
      );
    }
    if (parsed.freshConversation !== true) {
      issues.push(
        `${label}: negative security control was not run in a fresh conversation`,
      );
    }
    if (!isCanonicalTimestamp(parsed.completedAt)) {
      issues.push(
        `${label}: negative security control has no canonical completion time`,
      );
    }
    if (
      typeof parsed.reviewer !== "string" ||
      parsed.reviewer.trim().length < 2 ||
      parsed.reviewer === "OPERATOR_OR_REVIEWER"
    ) {
      issues.push(`${label}: negative security control reviewer is not completed`);
    }
    if (!isCanonicalTimestamp(parsed.reviewedAt)) {
      issues.push(
        `${label}: negative security control reviewedAt is not canonical`,
      );
    }
    for (const key of [
      "assistantTextAbsent",
      "modelContextAbsent",
      "publicToolOutputAbsent",
      "copiedToolArgumentsAbsent",
    ]) {
      if (parsed.observations?.[key] !== true) {
        issues.push(`${label}: observations.${key} is not true`);
      }
    }
    if (
      !Array.isArray(parsed.artifactHashes) ||
      parsed.artifactHashes.length === 0 ||
      !parsed.artifactHashes.every(isArtifactHash)
    ) {
      issues.push(
        `${label}: negative security control requires sanitized artifact hashes`,
      );
    }
    if (parsed.result === "pass") passingNegativeSecurityControls += 1;
    recordCandidateIdentity(parsed, label);
    continue;
  }
  if (
    parsed?.schemaVersion ===
    "shockaudit-stage6-fixed-fallback-evidence-v1"
  ) {
    const expectedMode = expectedFixedFallbackControls.get(parsed.controlId);
    if (!expectedMode) {
      issues.push(`${label}: fixed-fallback controlId is invalid`);
    } else if (fixedFallbackControlsById.has(parsed.controlId)) {
      issues.push(
        `${label}: duplicate fixed-fallback controlId ${parsed.controlId}; first seen in ${fixedFallbackControlsById.get(
          parsed.controlId,
        )}`,
      );
    } else {
      fixedFallbackControlsById.set(parsed.controlId, label);
    }
    if (parsed.mode !== expectedMode) {
      issues.push(`${label}: fixed-fallback control mode does not match controlId`);
    }
    if (parsed.result !== "pass") {
      issues.push(`${label}: fixed-fallback control did not pass`);
    }
    if (
      parsed.targetReleaseVersion !== expectedReleaseVersion ||
      parsed.workflowVersion !== "2.1" ||
      parsed.appVersion !== expectedReleaseVersion
    ) {
      issues.push(`${label}: fixed-fallback control targets the wrong release`);
    }
    if (!isFullCommit(parsed.commit)) {
      issues.push(`${label}: fixed-fallback control commit is not full length`);
    }
    if (
      parsed.endpointClass !== "isolated-candidate" ||
      typeof parsed.endpoint !== "string" ||
      parsed.endpoint.length < 8 ||
      parsed.endpoint.includes("REDACT_ORIGIN")
    ) {
      issues.push(
        `${label}: fixed-fallback control does not identify the isolated candidate endpoint`,
      );
    }
    if (parsed.freshConversation !== true) {
      issues.push(`${label}: fixed-fallback control was not run in a fresh conversation`);
    }
    for (const key of ["startedAt", "completedAt"]) {
      if (!isCanonicalTimestamp(parsed[key])) {
        issues.push(`${label}: fixed-fallback control ${key} is not canonical`);
      }
    }
    for (const key of ["chatgptSurface", "model"]) {
      if (
        typeof parsed[key] !== "string" ||
        parsed[key].trim().length < 3 ||
        parsed[key].includes("SIGNED_IN_SURFACE") ||
        parsed[key].includes("DISPLAYED_MODEL")
      ) {
        issues.push(`${label}: fixed-fallback control ${key} is not completed`);
      }
    }
    if (
      parsed.reasoningProvider !== "chatgpt-host" ||
      parsed.openAiApiUsed !== false ||
      parsed.cloudflareWorkersAiUsed !== false
    ) {
      issues.push(
        `${label}: fixed-fallback control does not preserve the current host/fixed-core provider boundary`,
      );
    }
    if (
      typeof parsed.faultMethod !== "string" ||
      parsed.faultMethod.trim().length < 3 ||
      parsed.faultMethod.includes("DOCUMENTED_PRIVATE_OPERATOR_METHOD")
    ) {
      issues.push(`${label}: fixed-fallback control faultMethod is not completed`);
    }
    if (
      parsed.publicFaultHookAdded !== false ||
      parsed.hiddenPromptTypedByResearcher !== false
    ) {
      issues.push(
        `${label}: fixed-fallback control used a public fault hook or researcher-typed hidden prompt`,
      );
    }

    const canonical = parsed.canonicalEvidence;
    const expectedRequestMode =
      expectedMode === "find" ? "find-candidate" : "audit-confirmed-event";
    if (canonical?.requestMode !== expectedRequestMode) {
      issues.push(
        `${label}: canonicalEvidence.requestMode does not match the fixed-fallback mode`,
      );
    }
    if (!fixedFallbackTriggerStatuses.has(canonical?.fallbackTriggerStatus)) {
      issues.push(
        `${label}: canonicalEvidence.fallbackTriggerStatus is not a supported canonical fallback trigger`,
      );
    }
    if (
      canonical?.requestStatus !== "completed" ||
      canonical?.completionOrigin !== "fixed-fallback" ||
      canonical?.completionActor !== "fixed-core"
    ) {
      issues.push(
        `${label}: canonicalEvidence does not record completed fixed-core/fixed-fallback completion`,
      );
    }
    for (const key of [
      "currentTargetBound",
      "allRequestedPartsAccepted",
      "allFallbackCategoriesUnclear",
      "acceptedHostPartsPreserved",
      "fallbackFilledOnlyUnresolvedParts",
      "sourceFactsAndScopeUnchanged",
      "lateReceiptNonMutating",
    ]) {
      if (canonical?.[key] !== true) {
        issues.push(`${label}: canonicalEvidence.${key} is not true`);
      }
    }
    if (canonical?.unresolvedPartCount !== 0) {
      issues.push(`${label}: canonicalEvidence.unresolvedPartCount is not zero`);
    }
    if (
      !Number.isInteger(canonical?.acceptedHostPartCount) ||
      canonical.acceptedHostPartCount < 0 ||
      canonical.acceptedHostPartCount > 6
    ) {
      issues.push(`${label}: canonicalEvidence.acceptedHostPartCount is not bounded`);
    }
    if (canonical?.chatgptAuthorshipClaimed !== false) {
      issues.push(
        `${label}: canonicalEvidence.chatgptAuthorshipClaimed must be false`,
      );
    }
    for (const key of ["sanitizedRequestIdHash", "sanitizedStateHash"]) {
      if (!isArtifactHash(canonical?.[key])) {
        issues.push(`${label}: canonicalEvidence.${key} is not sanitized`);
      }
    }

    const continuation = parsed.continuation;
    const expectedTargetGate =
      expectedMode === "find"
        ? "find-assessed-source-backed-selection"
        : "audit-assessed-confirmed-event";
    if (continuation?.targetGate !== expectedTargetGate) {
      issues.push(`${label}: fixed-fallback continuation targetGate is invalid`);
    }
    for (const key of [
      "targetGatePassed",
      "ordinaryContinuationUsed",
      "finalGatePassed",
    ]) {
      if (continuation?.[key] !== true) {
        issues.push(`${label}: continuation.${key} is not true`);
      }
    }
    if (continuation?.extraChecksContinuationUsed !== false) {
      issues.push(
        `${label}: continuation.extraChecksContinuationUsed must be false`,
      );
    }
    if (!isCanonicalTimestamp(continuation?.observedAt)) {
      issues.push(`${label}: fixed-fallback continuation observedAt is not canonical`);
    }

    const handoff = parsed.handoff;
    if (
      handoff?.schemaVersion !== "screen-02-to-screen-03-event-v4" ||
      handoff?.dispositionStatus !== "assessed" ||
      handoff?.assessmentCompletionOrigin !== "fixed-fallback"
    ) {
      issues.push(
        `${label}: fixed-fallback handoff is not the assessed v4 fixed-fallback contract`,
      );
    }
    if (
      (expectedMode === "find" && handoff?.dossierCompletionOrigin !== null) ||
      (expectedMode === "audit" &&
        !["chatgpt-host", "fixed-fallback"].includes(
          handoff?.dossierCompletionOrigin,
        ))
    ) {
      issues.push(
        `${label}: fixed-fallback handoff has the wrong mode-specific dossier origin`,
      );
    }
    if (!isArtifactHash(handoff?.sanitizedHandoffHash)) {
      issues.push(`${label}: fixed-fallback handoff hash is not recorded`);
    }
    if (parsed.outcomeValuesInspected !== false) {
      issues.push(`${label}: fixed-fallback control outcomeValuesInspected must be false`);
    }
    if (parsed.scoresOrCausalClaimsPresent !== false) {
      issues.push(
        `${label}: fixed-fallback control scoresOrCausalClaimsPresent must be false`,
      );
    }
    const redactions = parsed.redactions;
    for (const key of [
      "accessTokensAbsent",
      "capabilityTokensAbsent",
      "signingMaterialAbsent",
      "responseKeysAbsent",
      "stateEnvelopesAbsent",
      "rawRunIdsAbsent",
    ]) {
      if (redactions?.[key] !== true) {
        issues.push(`${label}: redactions.${key} is not true`);
      }
    }
    if (
      typeof redactions?.verifiedBy !== "string" ||
      redactions.verifiedBy.trim().length < 2 ||
      redactions.verifiedBy === "OPERATOR_OR_REVIEWER"
    ) {
      issues.push(
        `${label}: fixed-fallback control redactions.verifiedBy is not completed`,
      );
    }
    if (!isCanonicalTimestamp(redactions?.verifiedAt)) {
      issues.push(
        `${label}: fixed-fallback control redactions.verifiedAt is not canonical`,
      );
    }
    if (
      !Array.isArray(parsed.artifactHashes) ||
      parsed.artifactHashes.length === 0 ||
      !parsed.artifactHashes.every(isArtifactHash)
    ) {
      issues.push(
        `${label}: fixed-fallback control requires sanitized artifact hashes`,
      );
    }
    recordCandidateIdentity(parsed, label);
    continue;
  }
  if (
    parsed?.schemaVersion ===
    "shockaudit-stage6-assessment-unavailable-evidence-v1"
  ) {
    const expectedMode = legacyAssessmentUnavailableControls.get(
      parsed.controlId,
    );
    if (parsed.legacyCompatibilityOnly !== true) {
      issues.push(
        `${label}: assessment-unavailable evidence must be labeled legacyCompatibilityOnly`,
      );
    }
    if (!expectedMode) {
      issues.push(`${label}: assessment-unavailable controlId is invalid`);
    } else if (assessmentUnavailableControlsById.has(parsed.controlId)) {
      issues.push(
        `${label}: duplicate assessment-unavailable controlId ${parsed.controlId}; first seen in ${assessmentUnavailableControlsById.get(
          parsed.controlId,
        )}`,
      );
    } else {
      assessmentUnavailableControlsById.set(parsed.controlId, label);
    }
    if (parsed.mode !== expectedMode) {
      issues.push(
        `${label}: assessment-unavailable control mode does not match controlId`,
      );
    }
    if (parsed.result !== "pass") {
      issues.push(`${label}: assessment-unavailable control did not pass`);
    }
    if (
      parsed.targetReleaseVersion !== expectedReleaseVersion ||
      parsed.workflowVersion !== "2.1"
    ) {
      issues.push(
        `${label}: assessment-unavailable control targets the wrong release`,
      );
    }
    if (parsed.appVersion !== expectedReleaseVersion) {
      issues.push(
        `${label}: assessment-unavailable control appVersion is not the candidate package version`,
      );
    }
    if (!isFullCommit(parsed.commit)) {
      issues.push(
        `${label}: assessment-unavailable control commit is not full length`,
      );
    }
    if (
      parsed.endpointClass !== "isolated-candidate" ||
      typeof parsed.endpoint !== "string" ||
      parsed.endpoint.length < 8 ||
      parsed.endpoint.includes("REDACT_ORIGIN")
    ) {
      issues.push(
        `${label}: assessment-unavailable control does not identify the isolated candidate endpoint`,
      );
    }
    if (parsed.freshConversation !== true) {
      issues.push(
        `${label}: assessment-unavailable control was not run in a fresh conversation`,
      );
    }
    if (!isCanonicalTimestamp(parsed.startedAt)) {
      issues.push(
        `${label}: assessment-unavailable control has no canonical start time`,
      );
    }
    if (!isCanonicalTimestamp(parsed.completedAt)) {
      issues.push(
        `${label}: assessment-unavailable control has no canonical completion time`,
      );
    }
    for (const key of ["chatgptSurface", "model"]) {
      if (
        typeof parsed[key] !== "string" ||
        parsed[key].trim().length < 3 ||
        parsed[key].includes("SIGNED_IN_SURFACE") ||
        parsed[key].includes("DISPLAYED_MODEL")
      ) {
        issues.push(
          `${label}: assessment-unavailable control ${key} is not completed`,
        );
      }
    }
    if (
      typeof parsed.faultMethod !== "string" ||
      parsed.faultMethod.trim().length < 3 ||
      parsed.faultMethod.includes("DOCUMENTED_PRIVATE_OPERATOR_METHOD")
    ) {
      issues.push(
        `${label}: assessment-unavailable control faultMethod is not completed`,
      );
    }
    if (parsed.publicFaultHookAdded !== false) {
      issues.push(
        `${label}: assessment-unavailable control must not add a public fault hook`,
      );
    }

    const canonical = parsed.canonicalEvidence;
    if (
      !assessmentUnavailableTerminalStatuses.has(canonical?.terminalStatus)
    ) {
      issues.push(
        `${label}: canonicalEvidence.terminalStatus is not a permitted unavailable or transport-terminal status`,
      );
    }
    if (
      !Number.isInteger(canonical?.deliveryAttempts) ||
      canonical.deliveryAttempts < 1 ||
      canonical.deliveryAttempts > 3
    ) {
      issues.push(
        `${label}: canonicalEvidence.deliveryAttempts is not bounded`,
      );
    }
    if (
      canonical?.terminalStatus !== "service-unavailable" &&
      canonical?.deliveryAttempts !== 3
    ) {
      issues.push(
        `${label}: transport-only continuation was not backed by all three bounded delivery attempts`,
      );
    }
    if (
      canonical?.terminalStatus !== "service-unavailable" &&
      canonical?.transportFailureOnly !== true
    ) {
      issues.push(
        `${label}: exhausted continuation is not transport-only`,
      );
    }
    for (const key of [
      "terminalStatusPersisted",
      "currentTargetBound",
      "pendingOrValidatingAbsent",
      "semanticValidationFailureAbsent",
    ]) {
      if (canonical?.[key] !== true) {
        issues.push(`${label}: canonicalEvidence.${key} is not true`);
      }
    }
    if (
      !Number.isInteger(canonical?.affectedRequestCount) ||
      canonical.affectedRequestCount < 1 ||
      canonical.affectedRequestCount > 80
    ) {
      issues.push(
        `${label}: canonicalEvidence.affectedRequestCount is not bounded`,
      );
    }
    if (!isArtifactHash(canonical?.affectedRequestIdsHash)) {
      issues.push(
        `${label}: canonicalEvidence.affectedRequestIdsHash is not sanitized`,
      );
    }
    if (!isArtifactHash(canonical?.sanitizedStateHash)) {
      issues.push(
        `${label}: canonicalEvidence.sanitizedStateHash is not recorded`,
      );
    }

    const continuation = parsed.continuation;
    const expectedAction =
      expectedMode === "find"
        ? "find-continue-without-assessment"
        : "audit-continue-without-assessment";
    const expectedTargetGate =
      expectedMode === "find"
        ? "find-source-backed-tentative-selection"
        : "audit-source-backed-confirmed-identity-and-dossier";
    if (continuation?.action !== expectedAction) {
      issues.push(
        `${label}: assessment-unavailable continuation action does not match mode`,
      );
    }
    if (
      continuation?.targetGate !== expectedTargetGate ||
      continuation?.targetGatePassed !== true
    ) {
      issues.push(
        `${label}: assessment-unavailable continuation did not pass the source-backed mode gate`,
      );
    }
    for (const key of [
      "researcherReasonProvided",
      "researcherAcknowledgmentProvided",
      "finalGatePassed",
    ]) {
      if (continuation?.[key] !== true) {
        issues.push(`${label}: continuation.${key} is not true`);
      }
    }
    if (!isCanonicalTimestamp(continuation?.observedAt)) {
      issues.push(
        `${label}: assessment-unavailable continuation observedAt is not canonical`,
      );
    }
    for (const key of ["researcherReasonHash", "researcherAcknowledgmentHash"]) {
      if (!isArtifactHash(continuation?.[key])) {
        issues.push(`${label}: continuation.${key} is not sanitized`);
      }
    }

    const handoff = parsed.handoff;
    if (
      handoff?.schemaVersion !== "screen-02-to-screen-03-event-v4" ||
      handoff?.dispositionStatus !== "unavailable"
    ) {
      issues.push(
        `${label}: assessment-unavailable handoff is not the explicit v4 unavailable contract`,
      );
    }
    if (handoff?.validAssessmentReceiptPresent !== false) {
      issues.push(
        `${label}: assessment-unavailable handoff records a valid assessment receipt`,
      );
    }
    if (!isArtifactHash(handoff?.sanitizedHandoffHash)) {
      issues.push(
        `${label}: assessment-unavailable handoff hash is not recorded`,
      );
    }
    if (
      !Array.isArray(handoff?.mandatoryScreen03Checks) ||
      handoff.mandatoryScreen03Checks.length !==
        mandatoryAssessmentUnavailableScreen03Checks.length ||
      handoff.mandatoryScreen03Checks.some(
        (check, index) =>
          check !== mandatoryAssessmentUnavailableScreen03Checks[index],
      )
    ) {
      issues.push(
        `${label}: assessment-unavailable handoff does not carry the exact mandatory Screen 3 checks`,
      );
    }
    for (const key of [
      "assessmentIdAbsent",
      "judgmentAbsent",
      "componentsAbsent",
      "assessmentEvidenceClaimsAbsent",
    ]) {
      if (handoff?.fabricatedAssessmentFieldsAbsent?.[key] !== true) {
        issues.push(
          `${label}: handoff.fabricatedAssessmentFieldsAbsent.${key} is not true`,
        );
      }
    }
    if (parsed.outcomeValuesInspected !== false) {
      issues.push(
        `${label}: assessment-unavailable control outcomeValuesInspected must be false`,
      );
    }
    if (parsed.scoresOrCausalClaimsPresent !== false) {
      issues.push(
        `${label}: assessment-unavailable control scoresOrCausalClaimsPresent must be false`,
      );
    }
    const redactions = parsed.redactions;
    for (const key of [
      "accessTokensAbsent",
      "capabilityTokensAbsent",
      "signingMaterialAbsent",
      "responseKeysAbsent",
      "stateEnvelopesAbsent",
      "rawRunIdsAbsent",
    ]) {
      if (redactions?.[key] !== true) {
        issues.push(`${label}: redactions.${key} is not true`);
      }
    }
    if (
      typeof redactions?.verifiedBy !== "string" ||
      redactions.verifiedBy.trim().length < 2 ||
      redactions.verifiedBy === "OPERATOR_OR_REVIEWER"
    ) {
      issues.push(
        `${label}: assessment-unavailable control redactions.verifiedBy is not completed`,
      );
    }
    if (!isCanonicalTimestamp(redactions?.verifiedAt)) {
      issues.push(
        `${label}: assessment-unavailable control redactions.verifiedAt is not canonical`,
      );
    }
    if (
      !Array.isArray(parsed.artifactHashes) ||
      parsed.artifactHashes.length === 0 ||
      !parsed.artifactHashes.every(isArtifactHash)
    ) {
      issues.push(
        `${label}: assessment-unavailable control requires sanitized artifact hashes`,
      );
    }
    recordCandidateIdentity(parsed, label);
    continue;
  }
  if (parsed?.schemaVersion !== "shockaudit-stage6-run-evidence-v1") {
    continue;
  }
  if (!/^(?:F[1-5]|A[1-5])$/.test(parsed.caseId)) {
    issues.push(`${label}: caseId is not a Stage 6 case`);
  } else if (manifestsByCase.has(parsed.caseId)) {
    issues.push(
      `${label}: duplicate caseId ${parsed.caseId}; first seen in ${manifestsByCase.get(
        parsed.caseId,
      )}`,
    );
  } else {
    manifestsByCase.set(parsed.caseId, label);
  }
  const expectedMode = parsed.caseId?.startsWith("F") ? "find" : "audit";
  if (parsed.mode !== expectedMode) {
    issues.push(`${label}: mode does not match caseId`);
  }
  if (parsed.result !== "pass") {
    issues.push(`${label}: signed-in acceptance case did not pass`);
  }
  if (
    parsed.targetReleaseVersion !== expectedReleaseVersion ||
    parsed.workflowVersion !== "2.1"
  ) {
    issues.push(
      `${label}: manifest targets the wrong release or workflow schema`,
    );
  }
  if (parsed.appVersion !== expectedReleaseVersion) {
    issues.push(
      `${label}: appVersion must equal the exact candidate package version`,
    );
  }
  if (!isFullCommit(parsed.commit)) {
    issues.push(`${label}: commit must be the full reviewed commit`);
  }
  if (
    parsed.endpointClass !== "isolated-candidate" ||
    typeof parsed.endpoint !== "string" ||
    parsed.endpoint.length < 8 ||
    parsed.endpoint.includes("REDACT_ORIGIN")
  ) {
    issues.push(`${label}: manifest does not identify the isolated candidate endpoint`);
  }
  if (parsed.freshConversation !== true) {
    issues.push(`${label}: freshConversation is not true`);
  }
  const expectedSeriesAttempt = Number.parseInt(parsed.caseId?.slice(1), 10);
  if (parsed.seriesAttempt !== expectedSeriesAttempt) {
    issues.push(`${label}: seriesAttempt does not match caseId`);
  }
  if (parsed.consecutiveSeries !== true) {
    issues.push(`${label}: consecutiveSeries is not true`);
  }
  if (!isCanonicalTimestamp(parsed.completedAt)) {
    issues.push(`${label}: completedAt is not a canonical ISO timestamp`);
  }
  if (parsed.finalGate?.passed !== true) {
    issues.push(`${label}: finalGate.passed is not true`);
  }
  const expectedFinalGate =
    expectedMode === "find"
      ? "find-continuation"
      : "audit-continuation";
  if (parsed.finalGate?.name !== expectedFinalGate) {
    issues.push(`${label}: finalGate.name does not match mode`);
  }
  if (!isCanonicalTimestamp(parsed.finalGate?.observedAt)) {
    issues.push(
      `${label}: finalGate.observedAt is not a canonical ISO timestamp`,
    );
  }
  if (
    !["F1", "A1"].includes(parsed.caseId) &&
    parsed.faultDemonstrated !== true
  ) {
    issues.push(
      `${label}: required case-specific fault was not demonstrated`,
    );
  }
  if (
    !["F1", "A1"].includes(parsed.caseId) &&
    (typeof parsed.faultOverlay !== "string" ||
      parsed.faultOverlay.length < 3 ||
      parsed.faultOverlay.includes("CASE_SPECIFIC"))
  ) {
    issues.push(`${label}: required fault overlay is not identified`);
  }
  const completion = parsed.assessmentCompletion;
  const expectsFixedFallback = parsed.caseId === "F3";
  const expectedCompletionPath = expectsFixedFallback
    ? "fixed-fallback"
    : "chatgpt-host";
  if (completion?.path !== expectedCompletionPath) {
    issues.push(
      `${label}: assessmentCompletion.path is not the required ${expectedCompletionPath} path`,
    );
  }
  if (completion?.origin !== completion?.path) {
    issues.push(`${label}: assessmentCompletion.origin does not match path`);
  }
  if (completion?.hostFollowUpMessageUsed !== true) {
    issues.push(
      `${label}: ordinary assessment completion did not prove the automatic host message`,
    );
  }
  if (
    completion?.compatibilitySubmitToolUsed !== !expectsFixedFallback
  ) {
    issues.push(
      `${label}: assessmentCompletion.compatibilitySubmitToolUsed does not match its host or fixed-fallback path`,
    );
  }
  if (
    completion?.model !== (expectsFixedFallback ? "fixed-core" : "chatgpt-host") ||
    !isCanonicalTimestamp(completion?.completedAt)
  ) {
    issues.push(`${label}: assessment completion model/time is not recorded`);
  }
  if (
    expectsFixedFallback &&
    (completion?.requestStatus !== "completed" ||
      !fixedFallbackTriggerStatuses.has(completion?.fallbackTriggerStatus) ||
      completion?.lateReceiptNonMutating !== true)
  ) {
    issues.push(
      `${label}: F3 did not record bounded completed fixed fallback and non-mutating late receipt evidence`,
    );
  }
  const transition = parsed.screen01ToScreen02;
  for (const key of [
    "scopeConfirmed",
    "openedOnFirstAttempt",
    "screen2Visible",
    "baselinePreserved",
    "diagnosticReferencesAbsent",
  ]) {
    if (transition?.[key] !== true) {
      issues.push(`${label}: screen01ToScreen02.${key} is not true`);
    }
  }
  if (transition?.actionLabel !== "Continue to shock feasibility") {
    issues.push(
      `${label}: Screen 1 transition did not use the visible Continue action`,
    );
  }
  if (
    transition?.expectedMode !== expectedMode ||
    transition?.observedMode !== expectedMode
  ) {
    issues.push(`${label}: Screen 2 mode did not match the case`);
  }
  if (
    !Array.isArray(transition?.diagnosticReferences) ||
    transition.diagnosticReferences.length !== 0
  ) {
    issues.push(`${label}: Screen 1→2 transition contains an SA-S2 reference`);
  }
  if (
    transition?.firstNativeAction?.passed !== true ||
    !isCanonicalTimestamp(transition?.firstNativeAction?.observedAt)
  ) {
    issues.push(`${label}: first native Screen 2 action did not pass`);
  }
  const allowedFirstActions =
    expectedMode === "find"
      ? new Set(["find-search", "find-open"])
      : new Set(["audit-open", "audit-revise-anchor"]);
  if (!allowedFirstActions.has(transition?.firstNativeAction?.name)) {
    issues.push(`${label}: first native Screen 2 action is invalid for mode`);
  }
  if (
    !Array.isArray(parsed.artifactHashes) ||
    parsed.artifactHashes.length === 0 ||
    !parsed.artifactHashes.every(isArtifactHash)
  ) {
    issues.push(`${label}: manifest requires sanitized artifact hashes`);
  }
  const redactions = parsed.redactions;
  for (const key of [
    "accessTokensAbsent",
    "capabilityTokensAbsent",
    "signingMaterialAbsent",
    "responseKeysAbsent",
    "stateEnvelopesAbsent",
    "rawRunIdsAbsent",
  ]) {
    if (redactions?.[key] !== true) {
      issues.push(`${label}: redactions.${key} is not true`);
    }
  }
  if (
    typeof redactions?.verifiedBy !== "string" ||
    redactions.verifiedBy.trim().length < 2 ||
    redactions.verifiedBy === "OPERATOR_OR_REVIEWER"
  ) {
    issues.push(`${label}: redactions.verifiedBy is not completed`);
  }
  if (!isCanonicalTimestamp(redactions?.verifiedAt)) {
    issues.push(
      `${label}: redactions.verifiedAt is not a canonical ISO timestamp`,
    );
  }
  if (parsed.outcomeValuesInspected !== false) {
    issues.push(`${label}: outcomeValuesInspected must be false`);
  }
  if (parsed.scoresOrCausalClaimsPresent !== false) {
    issues.push(`${label}: scoresOrCausalClaimsPresent must be false`);
  }
  recordCandidateIdentity(parsed, label);
}

for (const caseId of expectedCaseIds) {
  if (!manifestsByCase.has(caseId)) {
    issues.push(`missing signed-in acceptance manifest for ${caseId}`);
  }
}
if (passingNegativeSecurityControls < 1) {
  issues.push(
    "missing passing N1 private-state nondisclosure control from a fresh signed-in conversation",
  );
}
for (const controlId of expectedFixedFallbackControls.keys()) {
  if (!fixedFallbackControlsById.has(controlId)) {
    issues.push(
      `missing passing ${controlId} fixed-fallback control from a fresh signed-in conversation`,
    );
  }
}

if (issues.length > 0) {
  throw new Error(
    `Stage 6 evidence validation/redaction failed:\n${issues
      .map((issue) => `- ${issue}`)
      .join("\n")}`,
  );
}

console.log(
  `Stage 6 evidence validation/redaction passed for ${files.length} file${
    files.length === 1 ? "" : "s"
  } under ${root}.`,
);
