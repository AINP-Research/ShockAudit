import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import packageMetadata from "../../package.json";

const repositoryRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);
const verifierPath = join(
  repositoryRoot,
  "scripts",
  "verify-stage6-evidence.mjs",
);
const candidateCommit = "1".repeat(40);
const candidateEndpoint = "https://shockaudit-stage6-candidate.example.test";
const artifactHash = `sha256:${"a".repeat(64)}`;
const observedAt = "2026-08-11T18:00:00.000Z";
const candidateVersion = packageMetadata.version;
const caseIds = [
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
] as const;
const fixedFallbackControlIds = [
  "FF1-find-fixed-fallback",
  "FF2-audit-fixed-fallback",
] as const;
const legacyUnavailableControlIds = [
  "U1-find-assessment-unavailable",
  "U2-audit-assessment-unavailable",
] as const;
const mandatoryScreen03Checks = [
  "Verify study fit against the confirmed Screen 1 scope.",
  "Verify the outcome pathway without inspecting realized outcome values.",
  "Verify the event version, timing, and source-backed factual record.",
  "Verify the covered population, geography, and organization-level exposure boundary.",
  "Verify measurement feasibility and the availability of pre-event exposure indicators.",
  "Document the main validity concern and every unresolved source gap.",
] as const;

type CaseId = (typeof caseIds)[number];
type FixedFallbackControlId = (typeof fixedFallbackControlIds)[number];
type LegacyUnavailableControlId = (typeof legacyUnavailableControlIds)[number];
type JsonRecord = Record<string, unknown>;

const temporaryDirectories = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories.clear();
});

function runVerifier(evidenceDirectory: string) {
  const result = spawnSync(process.execPath, [verifierPath, evidenceDirectory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    error: result.error,
  };
}

function runManifest(caseId: CaseId): JsonRecord {
  const mode = caseId.startsWith("F") ? "find" : "audit";
  const seriesAttempt = Number.parseInt(caseId.slice(1), 10);
  const isGoldPath = caseId === "F1" || caseId === "A1";
  return {
    schemaVersion: "shockaudit-stage6-run-evidence-v1",
    caseId,
    mode,
    result: "pass",
    startedAt: observedAt,
    completedAt: observedAt,
    endpointClass: "isolated-candidate",
    endpoint: candidateEndpoint,
    targetReleaseVersion: candidateVersion,
    appVersion: candidateVersion,
    workflowVersion: "2.1",
    commit: candidateCommit,
    chatgptSurface: "signed-in ChatGPT web",
    model: "displayed test model",
    freshConversation: true,
    seriesAttempt,
    consecutiveSeries: true,
    faultOverlay: isGoldPath ? "none" : `stage6-${caseId.toLowerCase()}-fault`,
    assessmentCompletion: {
      path: caseId === "F3" ? "fixed-fallback" : "chatgpt-host",
      origin: caseId === "F3" ? "fixed-fallback" : "chatgpt-host",
      hostFollowUpMessageUsed: true,
      compatibilitySubmitToolUsed: caseId !== "F3",
      model: caseId === "F3" ? "fixed-core" : "chatgpt-host",
      requestStatus: "completed",
      fallbackTriggerStatus:
        caseId === "F3" ? "no-tool-submission" : null,
      lateReceiptNonMutating: caseId === "F3" ? true : null,
      completedAt: observedAt,
    },
    screen01ToScreen02: {
      scopeConfirmed: true,
      actionLabel: "Continue to shock feasibility",
      openedOnFirstAttempt: true,
      expectedMode: mode,
      observedMode: mode,
      screen2Visible: true,
      diagnosticReferencesAbsent: true,
      diagnosticReferences: [],
      baselinePreserved: true,
      firstNativeAction: {
        name: mode === "find" ? "find-search" : "audit-open",
        passed: true,
        observedAt,
      },
    },
    finalGate: {
      name: mode === "find" ? "find-continuation" : "audit-continuation",
      passed: true,
      observedAt,
    },
    faultDemonstrated: !isGoldPath,
    outcomeValuesInspected: false,
    scoresOrCausalClaimsPresent: false,
    redactions: {
      accessTokensAbsent: true,
      capabilityTokensAbsent: true,
      signingMaterialAbsent: true,
      responseKeysAbsent: true,
      stateEnvelopesAbsent: true,
      rawRunIdsAbsent: true,
      verifiedBy: "Release reviewer",
      verifiedAt: observedAt,
    },
    artifactHashes: [artifactHash],
  };
}

function negativeSecurityControl(): JsonRecord {
  return {
    schemaVersion: "shockaudit-stage6-negative-security-evidence-v1",
    controlId: "N1-private-state-nondisclosure",
    result: "pass",
    startedAt: observedAt,
    completedAt: observedAt,
    endpointClass: "isolated-candidate",
    endpoint: candidateEndpoint,
    targetReleaseVersion: candidateVersion,
    appVersion: candidateVersion,
    workflowVersion: "2.1",
    commit: candidateCommit,
    chatgptSurface: "signed-in ChatGPT web",
    model: "displayed test model",
    freshConversation: true,
    observations: {
      assistantTextAbsent: true,
      modelContextAbsent: true,
      publicToolOutputAbsent: true,
      copiedToolArgumentsAbsent: true,
    },
    reviewer: "Release reviewer",
    reviewedAt: observedAt,
    artifactHashes: [artifactHash],
  };
}

function fixedFallbackControl(
  controlId: FixedFallbackControlId,
): JsonRecord {
  const mode = controlId.startsWith("FF1") ? "find" : "audit";
  return {
    schemaVersion: "shockaudit-stage6-fixed-fallback-evidence-v1",
    controlId,
    mode,
    result: "pass",
    startedAt: observedAt,
    completedAt: observedAt,
    endpointClass: "isolated-candidate",
    endpoint: candidateEndpoint,
    targetReleaseVersion: candidateVersion,
    appVersion: candidateVersion,
    workflowVersion: "2.1",
    commit: candidateCommit,
    chatgptSurface: "signed-in ChatGPT web",
    model: "displayed test model",
    reasoningProvider: "chatgpt-host",
    openAiApiUsed: false,
    cloudflareWorkersAiUsed: false,
    freshConversation: true,
    faultMethod: `private signed-in ${mode} fixed-fallback exercise`,
    publicFaultHookAdded: false,
    hiddenPromptTypedByResearcher: false,
    canonicalEvidence: {
      requestMode: mode === "find" ? "find-candidate" : "audit-confirmed-event",
      fallbackTriggerStatus:
        mode === "find" ? "no-tool-submission" : "delivery-rejected",
      requestStatus: "completed",
      completionOrigin: "fixed-fallback",
      completionActor: "fixed-core",
      currentTargetBound: true,
      allRequestedPartsAccepted: true,
      unresolvedPartCount: 0,
      allFallbackCategoriesUnclear: true,
      acceptedHostPartCount: mode === "find" ? 1 : 0,
      acceptedHostPartsPreserved: true,
      fallbackFilledOnlyUnresolvedParts: true,
      sourceFactsAndScopeUnchanged: true,
      lateReceiptNonMutating: true,
      chatgptAuthorshipClaimed: false,
      sanitizedRequestIdHash: artifactHash,
      sanitizedStateHash: artifactHash,
    },
    continuation: {
      targetGate:
        mode === "find"
          ? "find-assessed-source-backed-selection"
          : "audit-assessed-confirmed-event",
      targetGatePassed: true,
      ordinaryContinuationUsed: true,
      extraChecksContinuationUsed: false,
      finalGatePassed: true,
      observedAt,
    },
    handoff: {
      schemaVersion: "screen-02-to-screen-03-event-v4",
      dispositionStatus: "assessed",
      assessmentCompletionOrigin: "fixed-fallback",
      dossierCompletionOrigin: mode === "find" ? null : "fixed-fallback",
      sanitizedHandoffHash: artifactHash,
    },
    outcomeValuesInspected: false,
    scoresOrCausalClaimsPresent: false,
    redactions: {
      accessTokensAbsent: true,
      capabilityTokensAbsent: true,
      signingMaterialAbsent: true,
      responseKeysAbsent: true,
      stateEnvelopesAbsent: true,
      rawRunIdsAbsent: true,
      verifiedBy: "Release reviewer",
      verifiedAt: observedAt,
    },
    artifactHashes: [artifactHash],
  };
}

function legacyAssessmentUnavailableControl(
  controlId: LegacyUnavailableControlId,
): JsonRecord {
  const mode = controlId.startsWith("U1") ? "find" : "audit";
  const serviceUnavailable = mode === "find";
  return {
    schemaVersion: "shockaudit-stage6-assessment-unavailable-evidence-v1",
    legacyCompatibilityOnly: true,
    controlId,
    mode,
    result: "pass",
    startedAt: observedAt,
    completedAt: observedAt,
    endpointClass: "isolated-candidate",
    endpoint: candidateEndpoint,
    targetReleaseVersion: candidateVersion,
    appVersion: candidateVersion,
    workflowVersion: "2.1",
    commit: candidateCommit,
    chatgptSurface: "signed-in ChatGPT web",
    model: "displayed test model",
    freshConversation: true,
    faultMethod: `private signed-in ${mode} availability exercise`,
    publicFaultHookAdded: false,
    canonicalEvidence: {
      terminalStatus: serviceUnavailable
        ? "service-unavailable"
        : "timed-out",
      deliveryAttempts: serviceUnavailable ? 1 : 3,
      transportFailureOnly: !serviceUnavailable,
      terminalStatusPersisted: true,
      currentTargetBound: true,
      pendingOrValidatingAbsent: true,
      semanticValidationFailureAbsent: true,
      affectedRequestCount: 1,
      affectedRequestIdsHash: artifactHash,
      sanitizedStateHash: artifactHash,
    },
    continuation: {
      action:
        mode === "find"
          ? "find-continue-without-assessment"
          : "audit-continue-without-assessment",
      targetGate:
        mode === "find"
          ? "find-source-backed-tentative-selection"
          : "audit-source-backed-confirmed-identity-and-dossier",
      targetGatePassed: true,
      researcherReasonProvided: true,
      researcherAcknowledgmentProvided: true,
      researcherReasonHash: artifactHash,
      researcherAcknowledgmentHash: artifactHash,
      finalGatePassed: true,
      observedAt,
    },
    handoff: {
      schemaVersion: "screen-02-to-screen-03-event-v4",
      dispositionStatus: "unavailable",
      validAssessmentReceiptPresent: false,
      sanitizedHandoffHash: artifactHash,
      fabricatedAssessmentFieldsAbsent: {
        assessmentIdAbsent: true,
        judgmentAbsent: true,
        componentsAbsent: true,
        assessmentEvidenceClaimsAbsent: true,
      },
      mandatoryScreen03Checks: [...mandatoryScreen03Checks],
    },
    outcomeValuesInspected: false,
    scoresOrCausalClaimsPresent: false,
    redactions: {
      accessTokensAbsent: true,
      capabilityTokensAbsent: true,
      signingMaterialAbsent: true,
      responseKeysAbsent: true,
      stateEnvelopesAbsent: true,
      rawRunIdsAbsent: true,
      verifiedBy: "Release reviewer",
      verifiedAt: observedAt,
    },
    artifactHashes: [artifactHash],
  };
}

async function evidenceBundle(
  mutate?: (
    manifests: Map<CaseId, JsonRecord>,
    control: JsonRecord,
    fixedFallbackControls: Map<FixedFallbackControlId, JsonRecord>,
  ) => void,
) {
  const directory = await mkdtemp(
    join(tmpdir(), "shockaudit-stage6-evidence-test-"),
  );
  temporaryDirectories.add(directory);
  const manifests = new Map(
    caseIds.map((caseId) => [caseId, runManifest(caseId)]),
  );
  const control = negativeSecurityControl();
  const fixedFallbackControls = new Map(
    fixedFallbackControlIds.map((controlId) => [
      controlId,
      fixedFallbackControl(controlId),
    ]),
  );
  mutate?.(manifests, control, fixedFallbackControls);
  await Promise.all([
    ...[...manifests].map(([caseId, manifest]) =>
      writeFile(
        join(directory, `${caseId}.json`),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      ),
    ),
    writeFile(
      join(directory, "N1.json"),
      `${JSON.stringify(control, null, 2)}\n`,
      "utf8",
    ),
    ...[...fixedFallbackControls].map(([controlId, fixedFallback]) =>
      writeFile(
        join(directory, `${controlId}.json`),
        `${JSON.stringify(fixedFallback, null, 2)}\n`,
        "utf8",
      ),
    ),
  ]);
  return directory;
}

describe("Stage 6 signed-in evidence verifier", () => {
  it("accepts ten ordinary cases plus FF1, FF2, and N1 for one frozen candidate", async () => {
    const directory = await evidenceBundle();

    const result = runVerifier(directory);

    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(
      "Stage 6 evidence validation/redaction passed for 13 files",
    );
  });

  it("accepts a valid legacy unavailable-handoff record as optional compatibility evidence", async () => {
    const directory = await evidenceBundle();
    const legacy = legacyAssessmentUnavailableControl(
      "U1-find-assessment-unavailable",
    );
    await writeFile(
      join(directory, "legacy-U1.json"),
      `${JSON.stringify(legacy, null, 2)}\n`,
      "utf8",
    );

    const result = runVerifier(directory);

    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(
      "Stage 6 evidence validation/redaction passed for 14 files",
    );
  });

  it("requires both fixed-fallback controls in addition to all ten ordinary cases", async () => {
    const directory = await evidenceBundle(
      (_manifests, _control, fixedFallbackControls) => {
        fixedFallbackControls.delete("FF2-audit-fixed-fallback");
      },
    );
    await writeFile(
      join(directory, "legacy-U2.json"),
      `${JSON.stringify(
        legacyAssessmentUnavailableControl(
          "U2-audit-assessment-unavailable",
        ),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "missing passing FF2-audit-fixed-fallback fixed-fallback control",
    );
    expect(result.output).not.toContain(
      "missing signed-in acceptance manifest for",
    );
  });

  it("requires F3 to record fixed fallback rather than an impossible host retry completion", async () => {
    const directory = await evidenceBundle((manifests) => {
      const completion = manifests.get("F3")!
        .assessmentCompletion as JsonRecord;
      completion.path = "chatgpt-host";
      completion.origin = "chatgpt-host";
      completion.compatibilitySubmitToolUsed = true;
      completion.model = "chatgpt-host";
    });

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "assessmentCompletion.path is not the required fixed-fallback path",
    );
  });

  it("rejects unsupported triggers, incomplete requests, or unresolved fallback parts", async () => {
    const directory = await evidenceBundle(
      (_manifests, _control, fixedFallbackControls) => {
        const find = fixedFallbackControls.get("FF1-find-fixed-fallback")!;
        const findCanonical = find.canonicalEvidence as JsonRecord;
        findCanonical.fallbackTriggerStatus = "message-delivered";
        findCanonical.requestStatus = "validating";
        const audit = fixedFallbackControls.get("FF2-audit-fixed-fallback")!;
        const auditCanonical = audit.canonicalEvidence as JsonRecord;
        auditCanonical.unresolvedPartCount = 1;
        auditCanonical.allRequestedPartsAccepted = false;
      },
    );

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "fallbackTriggerStatus is not a supported canonical fallback trigger",
    );
    expect(result.output).toContain(
      "does not record completed fixed-core/fixed-fallback completion",
    );
    expect(result.output).toContain("canonicalEvidence.unresolvedPartCount is not zero");
    expect(result.output).toContain(
      "canonicalEvidence.allRequestedPartsAccepted is not true",
    );
  });

  it("rejects lost target binding, the wrong ordinary gate, or extra-check continuation", async () => {
    const directory = await evidenceBundle(
      (_manifests, _control, fixedFallbackControls) => {
        const find = fixedFallbackControls.get("FF1-find-fixed-fallback")!;
        (find.canonicalEvidence as JsonRecord).currentTargetBound = false;
        const audit = fixedFallbackControls.get("FF2-audit-fixed-fallback")!;
        const continuation = audit.continuation as JsonRecord;
        continuation.targetGate = "audit-source-backed-confirmed-identity-and-dossier";
        continuation.extraChecksContinuationUsed = true;
      },
    );

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "canonicalEvidence.currentTargetBound is not true",
    );
    expect(result.output).toContain(
      "fixed-fallback continuation targetGate is invalid",
    );
    expect(result.output).toContain(
      "continuation.extraChecksContinuationUsed must be false",
    );
  });

  it("rejects overwritten host parts, ChatGPT authorship, or an unavailable handoff", async () => {
    const directory = await evidenceBundle(
      (_manifests, _control, fixedFallbackControls) => {
        const find = fixedFallbackControls.get("FF1-find-fixed-fallback")!;
        const findCanonical = find.canonicalEvidence as JsonRecord;
        findCanonical.acceptedHostPartsPreserved = false;
        findCanonical.fallbackFilledOnlyUnresolvedParts = false;
        findCanonical.chatgptAuthorshipClaimed = true;
        const audit = fixedFallbackControls.get("FF2-audit-fixed-fallback")!;
        const handoff = audit.handoff as JsonRecord;
        handoff.dispositionStatus = "unavailable";
      },
    );

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "canonicalEvidence.acceptedHostPartsPreserved is not true",
    );
    expect(result.output).toContain(
      "canonicalEvidence.fallbackFilledOnlyUnresolvedParts is not true",
    );
    expect(result.output).toContain(
      "canonicalEvidence.chatgptAuthorshipClaimed must be false",
    );
    expect(result.output).toContain(
      "fixed-fallback handoff is not the assessed v4 fixed-fallback contract",
    );
  });

  it("rejects a manifest from a different candidate commit", async () => {
    const directory = await evidenceBundle((manifests) => {
      manifests.get("F3")!.commit = "2".repeat(40);
    });

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "commit does not match the frozen candidate",
    );
  });

  it("rejects a manifest from a different candidate endpoint", async () => {
    const directory = await evidenceBundle((manifests) => {
      manifests.get("A4")!.endpoint =
        "https://different-stage6-candidate.example.test";
    });

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "endpoint does not match the frozen candidate",
    );
  });

  it("binds fixed-fallback controls to the same frozen candidate as the ordinary series", async () => {
    const directory = await evidenceBundle(
      (_manifests, _control, fixedFallbackControls) => {
        fixedFallbackControls.get("FF1-find-fixed-fallback")!.commit =
          "2".repeat(40);
      },
    );

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "commit does not match the frozen candidate",
    );
  });

  it("rejects Audit evidence with a bad assessment path, Find action, and final gate", async () => {
    const directory = await evidenceBundle((manifests) => {
      const audit = manifests.get("A1")!;
      (audit.assessmentCompletion as JsonRecord).path = "host-message";
      const transition = audit.screen01ToScreen02 as JsonRecord;
      (transition.firstNativeAction as JsonRecord).name = "find-search";
      (audit.finalGate as JsonRecord).name = "find-continuation";
    });

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "assessmentCompletion.path is not the required chatgpt-host path",
    );
    expect(result.output).toContain(
      "first native Screen 2 action is invalid for mode",
    );
    expect(result.output).toContain("finalGate.name does not match mode");
  });

  it("rejects a manifest without first-attempt Screen 1 to Screen 2 evidence", async () => {
    const directory = await evidenceBundle((manifests) => {
      delete manifests.get("F2")!.screen01ToScreen02;
    });

    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "screen01ToScreen02.openedOnFirstAttempt is not true",
    );
    expect(result.output).toContain(
      "first native Screen 2 action did not pass",
    );
  });
});
