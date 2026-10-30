import { describe, expect, it } from "vitest";

import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
} from "../../src/core/host-reasoning-task";
import { fingerprintScreen03Value } from "../../src/core/screen03-workflow";
import {
  SCREEN_04_AUDIT_ENGINE_VERSION,
  compareScreen04AuditScenarios,
  runScreen04Audit,
  type Screen04AuditInput,
} from "../../src/core/screen04-audit";
import { SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION } from "../../src/core/screen04-event-card-binding";
import { SCREEN_04_AUDIT_LIMITS } from "../../src/core/screen04-feasibility";
import {
  SCREEN_04_RULE_AST_VERSION,
  type Screen04ExposureRulePlan,
} from "../../src/core/screen04-rule-ast";
import { SHOCKAUDIT_VERSION } from "../../src/version";
import {
  HostReasoningTaskStore,
  InMemoryHostReasoningTaskStoreBackend,
} from "../../src/worker/host-reasoning-task-store";

function eventCardBinding(withCompilerLimitation = false) {
  const withoutFingerprint = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: "screen02-run",
      mode: "find" as const,
      selectedEventId: "selected-event",
      selectedEventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    screen03: {
      runId: "screen03-run",
      stateFingerprint: "fnv1a64:3333333333333333",
    },
    eventCard: {
      id: "screen03:screen03-run:event-card",
      version: "locked-at:2026-08-23T12:00:00.000Z",
      fingerprint: "fnv1a64:4444444444444444",
      lockedAt: "2026-08-23T12:00:00.000Z",
    },
    verifiedShockName: "Verified privacy law",
    verifiedTimeline: [{
      proposalId: "effective-date",
      label: "Effective date",
      stage: "effective" as const,
      proposedDate: "2020-01-01",
      resolvedDate: "2020-01-01",
      sourceIds: ["official-date"],
      passageIds: ["official-date:passage"],
    }],
    focalClock: {
      selected: null,
      alternatives: [],
    },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [],
    unresolvedLimitations: {
      gaps: [],
      unknownProposalIds: [],
      rejectedProposalIds: [],
      unsupportedProposalIds: [],
      uncertainties: [],
    },
    compilerLimitations: withCompilerLimitation
      ? [{
          code: "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED" as const,
          message: "The locked Event Card lacks a typed historical threshold.",
        }]
      : [],
    linkedEvidenceIds: ["official-rule"],
  };
  return {
    ...withoutFingerprint,
    bindingFingerprint: fingerprintScreen03Value(withoutFingerprint),
  };
}

function locationPlan(): Screen04ExposureRulePlan {
  return {
    schemaVersion: SCREEN_04_RULE_AST_VERSION,
    components: [{
      componentId: "substantive-duty",
      componentLabel: "Substantive duty",
      exposureVersion: "original",
      exposureStartYear: 2020,
      evidenceIds: ["official-rule"],
      expression: {
        kind: "categorical-equals",
        requirementId: "operating-location",
        csvColumn: "operating_state",
        value: "CA",
      },
    }],
  };
}

const controls = Array.from({ length: 20 }, (_, index) => `control_${index + 1}`);
const header = ["GVKEY", "year", "treated", "operating_state", ...controls];
const controlValues = controls.map((_, index) => `secret-${index + 1}`);
const cleanCsv = [
  header.join(","),
  ["001", "2019", "1", "CA", ...controlValues].join(","),
  ["001", "2020", "1", "CA", ...controlValues].join(","),
  ["002", "2019", "0", "NV", ...controlValues].join(","),
  ["002", "2020", "0", "NV", ...controlValues].join(","),
].join("\n");

function auditInput(csvText = cleanCsv): Screen04AuditInput {
  return {
    csvText,
    eventCardBinding: eventCardBinding(),
    mappings: {
      structure: {
        unitIdentifier: "GVKEY",
        year: "year",
        treatmentGroup: "treated",
        researcherTreatmentYear: 2020,
        treatedValue: "1",
        comparisonValue: "0",
      },
      verifiedTimelineProposalId: "effective-date",
      optional: {
        organizationName: null,
        existingPostPeriod: null,
        existingUnitPeriodTreatment: null,
      },
      eventRequirements: {
        "operating-location": "operating_state",
      },
    },
    exposurePlan: locationPlan(),
    auditLimitations: [],
    missingRequirementIds: [],
  };
}

async function hostReasoningAuditBundle() {
  const boundedInput = {
    facts: ["Official source-backed bounded fact."],
    accessCredential: "PRIVATE SCREEN 4 TEST ACCESS CREDENTIAL",
    conversationContent: "PRIVATE SCREEN 4 TEST CONVERSATION",
  };
  const task = createHostReasoningTask({
    taskId: "screen4-audit-task",
    taskType: "screen02-search-review",
    screen: "screen-02",
    runId: "screen02-run",
    candidateId: null,
    candidatePoolId: "candidate-pool",
    selectedEventId: null,
    claimGroupId: null,
    scopeFingerprint: fingerprintHostReasoningValue("scope"),
    candidatePoolFingerprint: fingerprintHostReasoningValue("candidate-pool"),
    eventFingerprint: null,
    sourcePoolFingerprint: fingerprintHostReasoningValue(["official-rule"]),
    inputFingerprint: fingerprintHostReasoningValue(boundedInput),
    promptVersion: "screen02-search-review-prompt-v1",
    workflowVersion: "host-workflow-v1",
    requiredSubmissionSchemaVersion:
      "screen02-search-review-submission-v1",
    createdAt: "2026-09-03T00:00:00.000Z",
    expiresAt: "2026-09-03T00:05:00.000Z",
    retryCount: 0,
    appVersion: "0.4.4",
    uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
    hostModel: "host_model_not_exposed",
  });
  const store = new HostReasoningTaskStore(
    new InMemoryHostReasoningTaskStoreBackend(),
  );
  await store.prepare({
    task,
    boundedInput,
    allowedSourceIds: ["official-rule"],
    operationId: "screen4-audit-prepare",
  });
  await store.recordMessage({
    taskId: task.taskId,
    operationId: "screen4-audit-message",
    channel: "ui/message",
    accepted: true,
    requestedAt: "2026-09-03T00:00:01.000Z",
    resolvedAt: "2026-09-03T00:00:02.000Z",
  });
  await store.applySubmission({
    taskId: task.taskId,
    operationId: "screen4-audit-submission",
    capabilityId: "screen4-private-capability",
    submissionFingerprint: fingerprintHostReasoningValue("submission"),
    proposal: {
      schemaVersion: "shockaudit-screen02-host-review-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      review: {
        schemaVersion: "screen-02-pool-host-review-v1",
        taskId: "screen4-audit-task",
        capability: "screen-02-pool-review",
        profileAdditions: { services: ["PRIVATE PROFILE ADDITION"] },
        candidateReviews: [{
          candidateId: "candidate-audit",
          proposedClass: "direct",
          industryBridge: "PRIVATE SCREEN 4 TEST REASONING",
          profileTermsUsed: ["bounded term"],
          sourceIdsUsed: ["official-rule"],
          sourceSpansUsed: [{
            sourceId: "official-rule",
            text: "PRIVATE SCREEN 4 TEST SOURCE SPAN",
          }],
          sampleConnection: "PRIVATE SAMPLE CONNECTION",
          outcomePathway: "PRIVATE OUTCOME PATHWAY",
          mainMismatchOrUncertainty: "PRIVATE UNCERTAINTY",
          needsFollowUpRetrieval: false,
          rankingAdjustment: 0,
        }],
        followUpQueries: ["PRIVATE FOLLOW-UP QUERY"],
        officialSourceLeads: [{
          url: "https://example.gov/official-rule",
          title: "PRIVATE SOURCE TITLE",
          issuingBody: "PRIVATE ISSUING BODY",
          jurisdiction: "PRIVATE JURISDICTION",
          reasonForRetrieval: "PRIVATE RETRIEVAL REASON",
          candidateIdIfKnown: "candidate-audit",
        }],
        conciseRationale: "PRIVATE SCREEN 4 TEST RATIONALE",
        hostModel: "host_model_not_exposed",
      },
      enrichedProfile: { private: "PRIVATE ENRICHED PROFILE" },
      rankings: [{ private: "PRIVATE RANKING" }],
      outcomeValuesInspected: false,
    },
    sourceIdsReferenced: ["official-rule"],
    resultId: "screen4-audit-result",
    receivedAt: "2026-09-03T00:00:03.000Z",
    appliedAt: "2026-09-03T00:00:04.000Z",
  });
  return store.exportRunAuditBundle("screen02-run");
}

describe("Screen 4 Stage B deterministic audit", () => {
  it("processes only selected fields, classifies an annual panel, and creates three deterministic exports", async () => {
    const result = await runScreen04Audit(auditInput());

    expect(result.publicResult).toMatchObject({
      applicationVersion: SHOCKAUDIT_VERSION,
      overallStatus: "exposure-coding-is-executable",
      selectedColumns: ["GVKEY", "year", "treated", "operating_state"],
      rowCount: 4,
      unitCount: 2,
      classificationCounts: {
        exposed: 1,
        unexposed: 1,
        unknown: 0,
        not_applicable: 2,
        total: 4,
      },
      issues: [],
    });
    expect(JSON.stringify(result.publicResult)).not.toContain("control_1");
    expect(result.auditedExposureExport.content).not.toContain("secret-1");
    expect(result.auditReportExport.content).not.toContain("control_1");
    expect(result.auditedExposureExport.content).toContain(
      "001,2020,1,2020,exposed,exposed,substantive-duty:exposed,original,substantive-duty:2020,SCREEN04_COMPONENT_EXPOSED,At least one operative typed Event Card component rule was satisfied.",
    );
    expect(result.auditedExposureExport.content.split("\r\n")[0]!.split(","))
      .toEqual([
        "unit_id",
        "time",
        "researcher_treatment_group",
        "researcher_treatment_year",
        "audited_exposure",
        "classification_status",
        "exposure_components",
        "exposure_versions",
        "exposure_starts",
        "classification_reason_code",
        "classification_reason",
        "event_card_id",
        "event_card_version",
        "event_card_fingerprint",
        "screen04_rule_version",
        "screen04_engine_version",
        "shockaudit_application_version",
      ]);
    expect(result.auditedExposureExport.content).toContain(
      `${SCREEN_04_AUDIT_ENGINE_VERSION},${SHOCKAUDIT_VERSION}`,
    );
    expect(result.affectedCasesExport.rowCount).toBe(0);
    expect(result.auditReportExport.mediaType).toBe(
      "application/json;charset=utf-8",
    );
    expect(JSON.parse(result.auditReportExport.content)).toMatchObject({
      applicationVersion: SHOCKAUDIT_VERSION,
      eventCardUnresolvedLimitations: {
        gaps: [],
        unknownProposalIds: [],
        rejectedProposalIds: [],
        unsupportedProposalIds: [],
        uncertainties: [],
      },
      auditLimitations: [],
      calculationVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
      resultFingerprint: result.publicResult.resultFingerprint,
    });
  });

  it("optionally includes only sanitized host-task lifecycle provenance in the JSON audit report", async () => {
    const legacy = await runScreen04Audit(auditInput());
    const explicitLegacy = await runScreen04Audit({
      ...auditInput(),
      hostReasoningTaskAudit: undefined,
    });
    expect(explicitLegacy.auditReportExport.content).toBe(
      legacy.auditReportExport.content,
    );
    expect(JSON.parse(legacy.auditReportExport.content)).not.toHaveProperty(
      "hostReasoningTaskAudit",
    );

    const hostReasoningTaskAudit = await hostReasoningAuditBundle();
    const withAudit = await runScreen04Audit({
      ...auditInput(),
      hostReasoningTaskAudit,
    });
    expect(withAudit.publicResult).toEqual(legacy.publicResult);
    expect(withAudit.auditReportExport.fingerprint).not.toBe(
      legacy.auditReportExport.fingerprint,
    );
    const report = JSON.parse(withAudit.auditReportExport.content) as Record<
      string,
      unknown
    >;
    expect(report.hostReasoningTaskAudit).toMatchObject({
      schemaVersion: "shockaudit-host-reasoning-run-audit-bundle-v1",
      type: "host-reasoning-run-audit-bundle",
      runId: "screen02-run",
      includedTaskCount: 1,
      truncated: false,
      outcomeValuesInspected: false,
      tasks: [expect.objectContaining({
        schemaVersion: "shockaudit-host-reasoning-task-audit-bundle-v1",
        type: "host-reasoning-task-audit-bundle",
        task: expect.objectContaining({
          taskId: "screen4-audit-task",
          status: "applied",
        }),
        message: expect.objectContaining({
          channel: "ui/message",
          disposition: "accepted",
        }),
        application: expect.objectContaining({ disposition: "applied" }),
        outcomeValuesInspected: false,
      })],
    });
    const serialized = JSON.stringify(report.hostReasoningTaskAudit);
    for (const forbidden of [
      "PRIVATE SCREEN 4 TEST ACCESS CREDENTIAL",
      "PRIVATE SCREEN 4 TEST CONVERSATION",
      "PRIVATE SCREEN 4 TEST CAPABILITY",
      "PRIVATE SCREEN 4 TEST SIGNATURE",
      "PRIVATE SCREEN 4 TEST REASONING",
      "PRIVATE SCREEN 4 TEST SOURCE SPAN",
      "PRIVATE SAMPLE CONNECTION",
      "PRIVATE OUTCOME PATHWAY",
      "PRIVATE FOLLOW-UP QUERY",
      "PRIVATE SCREEN 4 TEST RATIONALE",
      "PRIVATE ENRICHED PROFILE",
      "PRIVATE RANKING",
      "PRIVATE SCREEN 4 TEST OBJECT COORDINATE",
      "screen4-private-capability",
      "operationReplays",
      "boundedInput",
    ]) expect(serialized).not.toContain(forbidden);

    await expect(runScreen04Audit({
      ...auditInput(),
      hostReasoningTaskAudit: {
        ...hostReasoningTaskAudit,
        runId: "another-run",
      },
    })).rejects.toThrow(/host-task audit provenance does not match/i);

    const tampered = structuredClone(hostReasoningTaskAudit);
    (tampered.tasks[0] as Record<string, unknown>).signature =
      "PRIVATE INJECTED SIGNATURE";
    await expect(runScreen04Audit({
      ...auditInput(),
      hostReasoningTaskAudit: tampered,
    })).rejects.toThrow(/private host-task material/i);
  });

  it("makes compiler gaps and null requirement mappings deterministically partial", async () => {
    const input = auditInput();
    input.eventCardBinding = eventCardBinding(true);
    input.mappings.eventRequirements = {
      ...input.mappings.eventRequirements,
      "historical-revenue": null,
    };
    input.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [{
        ...locationPlan().components[0]!,
        expression: {
          kind: "all",
          rules: [
            locationPlan().components[0]!.expression,
            {
              kind: "numeric-threshold",
              requirementId: "historical-revenue",
              csvColumn: "revenue_2017_millions",
              operator: ">",
              threshold: 25,
              thresholdUnit: "USD millions",
              sourceUnit: "USD millions",
            },
          ],
        },
      }],
    };

    const first = await runScreen04Audit(input);
    const second = await runScreen04Audit(input);
    expect(second).toEqual(first);
    expect(first.publicResult).toMatchObject({
      overallStatus: "partial-audit-only",
      unassessedRequirementIds: ["historical-revenue"],
      classificationCounts: { unknown: 2 },
    });
    expect(first.publicResult.issues.map((item) => item.findingCode)).toEqual(
      expect.arrayContaining([
        "SCREEN04_EXPOSURE_UNKNOWN",
        "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED",
        "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
      ]),
    );
    expect(first.publicResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        findingCode: "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED",
        affectedCaseCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
      expect.objectContaining({
        findingCode: "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
        affectedCaseCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    ]));
    const forcedRows = first.affectedCasesExport.content
      .trimEnd()
      .split("\r\n")
      .filter((line) =>
        line.includes("SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED") ||
        line.includes("SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED")
      );
    expect(forcedRows).toHaveLength(4);
    expect(forcedRows.every((line) => line.split(",")[1] === "2020")).toBe(true);
    expect(first.auditReportExport.content).toContain(
      '"overallStatus"',
    );
    expect(first.auditedExposureExport.content).toContain(
      "Full exposure is held unknown because an unresolved Event Card compiler, audit, or missing-requirement boundary remains.",
    );
    expect(JSON.parse(first.auditReportExport.content)).toMatchObject({
      auditLimitations: [expect.objectContaining({
        code: "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED",
        message: "The locked Event Card lacks a typed historical threshold.",
        requirementId: null,
      })],
    });
    expect(first.publicResult.resultFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("runs a structural-only empty plan as an honest partial audit", async () => {
    const input = auditInput();
    input.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [],
    };
    input.mappings.eventRequirements = {};

    const first = await runScreen04Audit(input);
    const second = await runScreen04Audit(input);
    expect(second).toEqual(first);
    expect(first.publicResult).toMatchObject({
      overallStatus: "partial-audit-only",
      selectedColumns: ["GVKEY", "year", "treated"],
      classificationCounts: {
        exposed: 0,
        unexposed: 0,
        unknown: 2,
        not_applicable: 2,
        total: 4,
      },
    });
    expect(first.publicResult.completedAuditDimensions).toEqual([
      "exact-header-mapping",
      "annual-unit-year-structure",
      "treatment-group-consistency",
      "treatment-year-alignment",
    ]);
    expect(first.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_EXPOSURE_RULE_NOT_EXECUTABLE",
        severity: "blocking",
        affectedCaseCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    );
    expect(first.publicResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        findingCode: "SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN",
        affectedCaseCount: 1,
      }),
      expect.objectContaining({
        findingCode: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN",
        affectedCaseCount: 1,
      }),
      expect.objectContaining({
        findingCode: "SCREEN04_UNKNOWN_EXPOSURE_DOMINATES_VARIATION",
        affectedCaseCount: 2,
      }),
    ]));
    expect(first.auditedExposureExport.content).toContain(
      'SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN,"No explicitly typed Event Card exposure component was available, so full exposure remains unknown."',
    );
    expect(JSON.parse(first.auditReportExport.content)).toMatchObject({
      auditLimitations: [expect.objectContaining({
        code: "SCREEN04_EXPOSURE_RULE_NOT_EXECUTABLE",
        requirementId: null,
      })],
      overallStatus: "partial-audit-only",
    });
  });

  it("finds miscoded treated and comparison cases with exact affected exports", async () => {
    const input = auditInput([
      "GVKEY,year,treated,operating_state",
      "001,2020,1,NV",
      "002,2020,0,CA",
    ].join("\n"));
    const result = await runScreen04Audit(input);

    expect(result.publicResult.overallStatus).toBe("proceed-with-repairs");
    expect(result.publicResult.issues.map((item) => [
      item.findingCode,
      item.affectedCaseCount,
    ])).toEqual([
      ["SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED", 1],
      ["SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED", 1],
      ["SCREEN04_TREATED_UNIT_NO_PRE_EXPOSURE_PERIOD", 1],
    ]);
    expect(result.affectedCasesExport.rowCount).toBe(3);
    expect(result.affectedCasesExport.content).toContain(
      "SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED",
    );
  });

  it("requires explicit exact rule mappings and a locked timeline choice", async () => {
    const caseMismatch = auditInput();
    caseMismatch.mappings.structure.unitIdentifier = "gvkey";
    await expect(runScreen04Audit(caseMismatch)).rejects.toMatchObject({
      code: "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
    });

    const wrongTimeline = auditInput();
    wrongTimeline.mappings.verifiedTimelineProposalId = "announcement-date";
    await expect(runScreen04Audit(wrongTimeline)).rejects.toThrow(
      /locked Event Card/u,
    );
  });

  it("validates plausible years, identifier formats, organization continuity, and annual gaps", async () => {
    await expect(runScreen04Audit(auditInput([
      "GVKEY,year,treated,operating_state",
      "001,0999,1,CA",
      "002,0999,0,NV",
    ].join("\n")))).rejects.toMatchObject({
      code: "SCREEN04_INVALID_ANNUAL_TIME",
    });

    const mixedIdentifiers = await runScreen04Audit(auditInput([
      "GVKEY,year,treated,operating_state",
      "001,2019,1,CA",
      "001,2020,1,CA",
      "ABC,2019,0,NV",
      "ABC,2020,0,NV",
    ].join("\n")));
    expect(mixedIdentifiers.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_MIXED_UNIT_IDENTIFIER_FORMATS",
        affectedCaseCount: 4,
        affectedUnitCount: 2,
      }),
    );

    const organizationInput = auditInput([
      "GVKEY,year,treated,org_name,operating_state",
      "A,2019,1,Acme,CA",
      "A,2020,1,Acme,CA",
      "B,2019,1,Acme,CA",
      "B,2020,1,Acme,CA",
      "C,2019,0,Other,NV",
      "C,2020,0,Other,NV",
    ].join("\n"));
    organizationInput.mappings.optional.organizationName = "org_name";
    const organization = await runScreen04Audit(organizationInput);
    expect(organization.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_ORGANIZATION_IDENTIFIER_CHANGES",
        affectedCaseCount: 4,
        affectedUnitCount: 2,
      }),
    );

    const gaps = await runScreen04Audit(auditInput([
      "GVKEY,year,treated,operating_state",
      "A,2018,1,CA",
      "A,2020,1,CA",
      "B,2018,0,NV",
      "B,2019,0,NV",
      "B,2020,0,NV",
    ].join("\n")));
    expect(gaps.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_MISSING_WITHIN_UNIT_YEARS",
        affectedCaseCount: 1,
        affectedUnitCount: 1,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    );
    const gapRows = gaps.affectedCasesExport.content
      .trimEnd()
      .split("\r\n")
      .filter((line) => line.includes("SCREEN04_MISSING_WITHIN_UNIT_YEARS"));
    expect(gapRows).toHaveLength(1);
    expect(gapRows[0]!.split(",").slice(0, 2)).toEqual(["A", "2020"]);
  });

  it("hardens formula-like identifiers in both row-level exports", async () => {
    const result = await runScreen04Audit(auditInput([
      "GVKEY,year,treated,operating_state",
      "=1+1,2020,1,NV",
      "@cmd,2020,0,CA",
    ].join("\n")));
    expect(result.auditedExposureExport.content).toContain("'=1+1,2020");
    expect(result.affectedCasesExport.content).toContain("'@cmd,2020");
  });

  it("checks optional indicators only with explicit value semantics", async () => {
    const input = auditInput([
      "GVKEY,year,treated,operating_state,post,combined",
      "A,2019,1,CA,0,0",
      "A,2020,1,CA,0,0",
      "B,2019,0,NV,0,0",
      "B,2020,0,NV,1,0",
    ].join("\n"));
    input.mappings.optional.existingPostPeriod = "post";
    input.mappings.optional.existingUnitPeriodTreatment = "combined";
    input.indicatorValueMappings = {
      existingPostPeriod: { prePeriodValue: "0", postPeriodValue: "1" },
      existingUnitPeriodTreatment: {
        unexposedValue: "0",
        exposedValue: "1",
      },
    };
    const checked = await runScreen04Audit(input);
    expect(checked.publicResult.selectedColumns).toEqual([
      "GVKEY",
      "year",
      "treated",
      "post",
      "combined",
      "operating_state",
    ]);
    expect(checked.publicResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        findingCode: "SCREEN04_EXISTING_POST_PERIOD_MISMATCH",
        affectedCaseCount: 1,
      }),
      expect.objectContaining({
        findingCode: "SCREEN04_EXISTING_TREATMENT_MISMATCH",
        affectedCaseCount: 1,
      }),
    ]));

    const unconfirmed = auditInput([
      "GVKEY,year,treated,operating_state,post",
      "A,2019,1,CA,private-pre",
      "A,2020,1,CA,private-post",
      "B,2019,0,NV,private-pre",
      "B,2020,0,NV,private-post",
    ].join("\n"));
    unconfirmed.mappings.optional.existingPostPeriod = "post";
    const skipped = await runScreen04Audit(unconfirmed);
    expect(skipped.publicResult.selectedColumns).not.toContain("post");
    expect(skipped.auditedExposureExport.content).not.toContain("private-");
    expect(JSON.parse(skipped.auditReportExport.content).unassessedAuditChecks)
      .toContainEqual(expect.objectContaining({
        code: "SCREEN04_EXISTING_POST_PERIOD_VALUES_NOT_CONFIRMED",
      }));
  });

  it("propagates numeric unit mismatch and detects unresolved values near a typed threshold", async () => {
    const thresholdInput = (csvText: string, sourceUnit = "USD") => {
      const input = auditInput(csvText);
      input.exposurePlan = {
        schemaVersion: SCREEN_04_RULE_AST_VERSION,
        components: [{
          componentId: "revenue-threshold",
          componentLabel: "Revenue threshold",
          exposureVersion: "original",
          exposureStartYear: 2020,
          evidenceIds: ["official-rule"],
          expression: {
            kind: "numeric-threshold",
            requirementId: "revenue-threshold",
            csvColumn: "revenue",
            operator: ">=",
            threshold: 1_000_000,
            thresholdUnit: "USD",
            sourceUnit,
          },
        }],
      };
      input.mappings.eventRequirements = { "revenue-threshold": "revenue" };
      return input;
    };
    const mismatch = await runScreen04Audit(thresholdInput([
      "GVKEY,year,treated,revenue",
      "001,2019,1,150",
      "001,2020,1,150",
      "002,2019,0,80",
      "002,2020,0,80",
    ].join("\n"), "USD thousands"));
    expect(mismatch.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_RULE_UNIT_MISMATCH",
        severity: "blocking",
        affectedCaseCount: 2,
        affectedUnitCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    );
    const mismatchRows = mismatch.affectedCasesExport.content
      .trimEnd()
      .split("\r\n")
      .filter((line) => line.includes("SCREEN04_RULE_UNIT_MISMATCH"));
    expect(mismatchRows).toHaveLength(2);
    expect(mismatchRows.every((line) => line.split(",")[1] === "2020"))
      .toBe(true);

    const near = await runScreen04Audit(thresholdInput([
      "GVKEY,year,treated,revenue",
      "001,2019,1,1000000",
      "001,2020,1,",
      "002,2019,0,999999",
      "002,2020,0,",
    ].join("\n")));
    expect(near.publicResult).toMatchObject({
      overallStatus: "proceed-with-repairs",
      classificationCounts: { unknown: 2 },
    });
    expect(near.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_UNKNOWN_NEAR_THRESHOLD",
        severity: "major",
        affectedCaseCount: 2,
      }),
    );

    const boundary = await runScreen04Audit(thresholdInput([
      "GVKEY,year,treated,revenue",
      "001,2019,1,900000",
      "001,2020,1,1000000",
      "002,2019,0,900000",
      "002,2020,0,1000000",
    ].join("\n")));
    expect(boundary.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_EXACT_THRESHOLD_BOUNDARY",
        severity: "warning",
        affectedCaseCount: 2,
      }),
    );
  });

  it("keeps prototype-like selected columns and requirement IDs inert", async () => {
    const input = auditInput([
      "GVKEY,year,treated,constructor",
      "001,2019,1,100",
      "001,2020,1,",
      "002,2019,0,100",
      "002,2020,0,",
    ].join("\n"));
    input.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [{
        componentId: "toString",
        componentLabel: "Prototype safety threshold",
        exposureVersion: "original",
        exposureStartYear: 2020,
        evidenceIds: ["official-rule"],
        expression: {
          kind: "numeric-threshold",
          requirementId: "__proto__",
          csvColumn: "constructor",
          operator: ">=",
          threshold: 100,
          thresholdUnit: "count",
          sourceUnit: "count",
        },
      }],
    };
    const mappings = Object.create(null) as Record<string, string>;
    mappings["__proto__"] = "constructor";
    input.mappings.eventRequirements = mappings;

    const result = await runScreen04Audit(input);
    expect(result.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_UNKNOWN_NEAR_THRESHOLD",
        affectedCaseCount: 2,
      }),
    );
    expect(result.auditedExposureExport.content).toContain(
      "toString:2020,SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
    );
    expect(Object.prototype).not.toHaveProperty("100");
  });

  it("detects a reversal only when the typed plan explicitly declares permanence", async () => {
    const input = auditInput([
      "GVKEY,year,treated,operating_state",
      "A,2019,1,NV",
      "A,2020,1,CA",
      "A,2021,1,NV",
      "B,2019,0,NV",
      "B,2020,0,NV",
      "B,2021,0,NV",
    ].join("\n"));
    input.exposurePlan = {
      ...locationPlan(),
      exposurePersistence: "permanent-once-exposed",
    };

    const result = await runScreen04Audit(input);
    expect(result.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_EXPOSURE_STATUS_REVERSED",
        affectedCaseCount: 1,
        affectedUnitCount: 1,
        affectedPeriodStart: 2021,
        affectedPeriodEnd: 2021,
      }),
    );
  });

  it("names amendment contamination and mechanical exposure-variation failures", async () => {
    const amendment = auditInput([
      "GVKEY,year,treated,original,amendment",
      "001,2019,1,no,no",
      "001,2020,1,yes,yes",
      "001,2021,1,yes,yes",
      "002,2019,0,no,no",
      "002,2020,0,no,no",
      "002,2021,0,no,yes",
    ].join("\n"));
    amendment.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [
        {
          componentId: "original",
          componentLabel: "Original coverage",
          exposureVersion: "original",
          exposureStartYear: 2020,
          evidenceIds: ["official-rule"],
          expression: {
            kind: "categorical-equals",
            requirementId: "original",
            csvColumn: "original",
            value: "yes",
          },
        },
        {
          componentId: "amendment",
          componentLabel: "Later coverage",
          exposureVersion: "amendment-2021",
          exposureStartYear: 2021,
          evidenceIds: ["official-amendment"],
          expression: {
            kind: "categorical-equals",
            requirementId: "amendment",
            csvColumn: "amendment",
            value: "yes",
          },
        },
      ],
    };
    amendment.mappings.eventRequirements = {
      original: "original",
      amendment: "amendment",
    };
    const amended = await runScreen04Audit(amendment);
    expect(amended.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_COMPARISON_CONTAMINATED_AFTER_AMENDMENT",
        affectedCaseCount: 1,
        affectedUnitCount: 1,
        affectedPeriodStart: 2021,
        affectedPeriodEnd: 2021,
      }),
    );
    const amendmentAffectedRows = amended.affectedCasesExport.content
      .trimEnd()
      .split("\r\n")
      .filter((line) =>
        line.includes("SCREEN04_COMPARISON_CONTAMINATED_AFTER_AMENDMENT")
      );
    expect(amendmentAffectedRows).toHaveLength(1);
    expect(amendmentAffectedRows[0]!.split(",").slice(0, 2)).toEqual([
      "002",
      "2021",
    ]);
    const auditedLines = amended.auditedExposureExport.content
      .trimEnd()
      .split("\r\n");
    const auditedHeaders = auditedLines[0]!.split(",");
    const versionIndex = auditedHeaders.indexOf("exposure_versions");
    const amendedRows = auditedLines.slice(1).map((line) => line.split(","));
    const row = (unitId: string, year: string) => amendedRows.find(
      (values) => values[0] === unitId && values[1] === year,
    )!;
    expect(row("001", "2019")[versionIndex]).toBe("");
    expect(row("001", "2020")[versionIndex]).toBe("original");
    expect(row("001", "2021")[versionIndex]).toBe(
      "original;amendment-2021",
    );

    const plan = locationPlan();
    const variationCases = await Promise.all([
      runScreen04Audit({
        ...auditInput([
          "GVKEY,year,treated,operating_state",
          "001,2019,1,NV",
          "001,2020,1,CA",
          "002,2019,0,NV",
          "002,2020,0,CA",
        ].join("\n")),
        exposurePlan: plan,
      }),
      runScreen04Audit({
        ...auditInput([
          "GVKEY,year,treated,operating_state",
          "001,2019,1,NV",
          "001,2020,1,NV",
          "002,2019,0,NV",
          "002,2020,0,NV",
        ].join("\n")),
        exposurePlan: plan,
      }),
      runScreen04Audit({
        ...auditInput([
          "GVKEY,year,treated,operating_state",
          "001,2021,1,CA",
          "001,2022,1,CA",
          "002,2021,0,CA",
          "002,2022,0,CA",
        ].join("\n")),
        exposurePlan: plan,
      }),
    ]);
    expect(variationCases[0]!.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_ALL_UNITS_EXPOSED_AFTER_TREATMENT_YEAR",
        affectedCaseCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    );
    expect(variationCases[1]!.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_NO_EXPOSED_UNITS",
        affectedCaseCount: 2,
        affectedPeriodStart: 2020,
        affectedPeriodEnd: 2020,
      }),
    );
    for (const [result, code] of [
      [variationCases[0]!, "SCREEN04_ALL_UNITS_EXPOSED_AFTER_TREATMENT_YEAR"],
      [variationCases[1]!, "SCREEN04_NO_EXPOSED_UNITS"],
    ] as const) {
      const affectedRows = result.affectedCasesExport.content
        .trimEnd()
        .split("\r\n")
        .filter((line) => line.includes(code));
      expect(affectedRows).toHaveLength(2);
      expect(affectedRows.every((line) => line.split(",")[1] === "2020"))
        .toBe(true);
    }
    expect(variationCases[2]!.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_SAMPLE_STARTS_AFTER_UNIVERSAL_EXPOSURE",
        affectedCaseCount: 4,
      }),
    );
    expect(variationCases[2]!.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_TREATED_UNIT_NO_PRE_EXPOSURE_PERIOD",
        affectedCaseCount: 2,
        affectedUnitCount: 1,
      }),
    );
  });

  it("distinguishes collapsed from perfectly bundled typed components", async () => {
    const componentInput = (
      csvText: string,
      complianceStart: number,
    ) => {
      const input = auditInput(csvText);
      input.exposurePlan = {
        schemaVersion: SCREEN_04_RULE_AST_VERSION,
        components: [
          {
            componentId: "disclosure",
            componentLabel: "Disclosure",
            exposureVersion: "package-v1",
            exposureStartYear: 2020,
            evidenceIds: ["official-rule"],
            expression: {
              kind: "categorical-equals",
              requirementId: "disclosure",
              csvColumn: "disclosure",
              value: "yes",
            },
          },
          {
            componentId: "compliance",
            componentLabel: "Compliance",
            exposureVersion: "package-v2",
            exposureStartYear: complianceStart,
            evidenceIds: ["official-rule"],
            expression: {
              kind: "categorical-equals",
              requirementId: "compliance",
              csvColumn: "compliance",
              value: "yes",
            },
          },
        ],
      };
      input.mappings.eventRequirements = {
        disclosure: "disclosure",
        compliance: "compliance",
      };
      input.mappings.optional.existingUnitPeriodTreatment = "treated";
      return input;
    };
    const collapsed = await runScreen04Audit(componentInput([
      "GVKEY,year,treated,disclosure,compliance",
      "001,2019,1,no,no",
      "001,2020,1,yes,no",
      "002,2019,0,no,no",
      "002,2020,0,no,no",
    ].join("\n"), 2021));
    expect(collapsed.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_COMPONENTS_COLLAPSED",
        severity: "major",
        affectedCaseCount: 4,
      }),
    );

    const bundledInput = componentInput([
      "GVKEY,year,treated,disclosure,compliance",
      "001,2019,1,no,no",
      "001,2020,1,yes,yes",
      "002,2019,0,no,no",
      "002,2020,0,no,no",
    ].join("\n"), 2020);
    bundledInput.exposurePlan = {
      ...bundledInput.exposurePlan,
      components: bundledInput.exposurePlan.components.map((item) => ({
        ...item,
        exposureVersion: "package-v1",
      })),
    };
    const bundled = await runScreen04Audit(bundledInput);
    expect(bundled.publicResult).toMatchObject({
      overallStatus: "proceed-with-repairs",
    });
    expect(bundled.publicResult.issues).toContainEqual(
      expect.objectContaining({
        findingCode: "SCREEN04_COMPONENTS_PERFECTLY_BUNDLED",
        severity: "warning",
        affectedCaseCount: 4,
      }),
    );
  });

  it("compares two named source-supported scenarios without selecting one from outcomes", async () => {
    const csvText = [
      "GVKEY,year,treated,narrow,broad",
      "001,2019,1,no,no",
      "001,2020,1,no,yes",
      "002,2019,0,no,no",
      "002,2020,0,no,yes",
    ].join("\n");
    const scenario = (
      requirementId: string,
      csvColumn: string,
    ) => {
      const input = auditInput(csvText);
      input.exposurePlan = {
        schemaVersion: SCREEN_04_RULE_AST_VERSION,
        components: [{
          componentId: requirementId,
          componentLabel: requirementId,
          exposureVersion: "scenario",
          exposureStartYear: 2020,
          evidenceIds: [`evidence-${requirementId}`],
          expression: {
            kind: "categorical-equals",
            requirementId,
            csvColumn,
            value: "yes",
          },
        }],
      };
      input.mappings.eventRequirements = { [requirementId]: csvColumn };
      return input;
    };
    const comparison = await compareScreen04AuditScenarios({
      baseline: {
        scenarioId: "narrow",
        label: "Narrow eligibility",
        evidenceIds: ["evidence-narrow"],
        input: scenario("narrow", "narrow"),
      },
      alternative: {
        scenarioId: "broad",
        label: "Broad eligibility",
        evidenceIds: ["evidence-broad"],
        input: scenario("broad", "broad"),
      },
    });
    expect(comparison).toMatchObject({
      changedCaseCount: 2,
      changedUnitCount: 2,
      overallStatus: "proceed-with-repairs",
      issue: {
        findingCode: "SCREEN04_SCENARIO_CLASSIFICATION_CHANGED",
        severity: "warning",
        affectedCaseCount: 2,
      },
      comparisonContamination: {
        baselineExposedComparisonCaseCount: 0,
        alternativeExposedComparisonCaseCount: 1,
        changedComparisonCaseCount: 1,
        direction: "alternative-increases",
      },
      exposureVariation: {
        baseline: {
          exposedCaseCount: 0,
          unexposedCaseCount: 2,
          hasUsableExposureVariation: false,
        },
        alternative: {
          exposedCaseCount: 2,
          unexposedCaseCount: 0,
          hasUsableExposureVariation: false,
        },
      },
      researcherCodingAgreement: {
        baseline: {
          agreementCaseCount: 1,
          mismatchCaseCount: 1,
          treatedAuditedUnexposedCaseCount: 1,
          comparisonAuditedExposedCaseCount: 0,
        },
        alternative: {
          agreementCaseCount: 1,
          mismatchCaseCount: 1,
          treatedAuditedUnexposedCaseCount: 0,
          comparisonAuditedExposedCaseCount: 1,
        },
        direction: "unchanged",
      },
    });
    expect(comparison.affectedCasesExport.rowCount).toBe(2);
    expect(comparison.resultFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("compares distinct source-supported timeline choices from the same Event Card", async () => {
    const originalBinding = eventCardBinding();
    const { bindingFingerprint: _ignored, ...bindingWithoutFingerprint } =
      originalBinding;
    const expandedWithoutFingerprint = {
      ...bindingWithoutFingerprint,
      verifiedTimeline: [
        ...bindingWithoutFingerprint.verifiedTimeline,
        {
          proposalId: "announcement-date",
          label: "Announcement date",
          stage: "announcement" as const,
          proposedDate: "2019-01-01",
          resolvedDate: "2019-01-01",
          sourceIds: ["official-announcement"],
          passageIds: ["official-announcement:passage"],
        },
      ],
    };
    const expandedBinding = {
      ...expandedWithoutFingerprint,
      bindingFingerprint: fingerprintScreen03Value(expandedWithoutFingerprint),
    };
    const csvText = [
      "GVKEY,year,treated,operating_state",
      "A,2018,1,NV",
      "A,2019,1,CA",
      "A,2020,1,CA",
      "B,2018,0,NV",
      "B,2019,0,NV",
      "B,2020,0,NV",
    ].join("\n");
    const scenarioInput = (proposalId: string, startYear: number) => {
      const input = auditInput(csvText);
      input.eventCardBinding = expandedBinding;
      input.mappings.verifiedTimelineProposalId = proposalId;
      input.exposurePlan = {
        ...locationPlan(),
        components: locationPlan().components.map((component) => ({
          ...component,
          exposureStartYear: startYear,
        })),
      };
      return input;
    };
    const comparison = await compareScreen04AuditScenarios({
      baseline: {
        scenarioId: "implementation",
        label: "Implementation timing",
        evidenceIds: ["official-date"],
        input: scenarioInput("effective-date", 2020),
      },
      alternative: {
        scenarioId: "announcement",
        label: "Announcement timing",
        evidenceIds: ["official-announcement"],
        input: scenarioInput("announcement-date", 2019),
      },
    });

    expect(comparison).toMatchObject({
      baselineTimelineProposalId: "effective-date",
      alternativeTimelineProposalId: "announcement-date",
      changedCaseCount: 2,
      changesByStatus: [
        { from: "not_applicable", to: "exposed", count: 1 },
        { from: "not_applicable", to: "unexposed", count: 1 },
      ],
    });
  });

  it("completes deterministically at the measured 20,000-row boundary", async () => {
    const additionalFields = Array.from(
      { length: 12 },
      (_, index) => `typed_field_${index + 1}`,
    );
    const lines = [[
      "GVKEY",
      "year",
      "treated",
      "operating_state",
      ...additionalFields,
    ].join(",")];
    for (let unit = 0; unit < 10_000; unit += 1) {
      const id = String(unit).padStart(5, "0");
      const treated = unit % 2 === 0 ? "1" : "0";
      const state = treated === "1" ? "CA" : "NV";
      const row = [id, "2019", treated, state, ...additionalFields.map(() => "yes")];
      lines.push(row.join(","));
      row[1] = "2020";
      lines.push(row.join(","));
    }
    const csvText = lines.join("\n");
    expect(new TextEncoder().encode(csvText).byteLength).toBeLessThanOrEqual(
      SCREEN_04_AUDIT_LIMITS.maximumFileBytes,
    );
    const input = auditInput(csvText);
    input.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [{
        ...locationPlan().components[0]!,
        expression: {
          kind: "all",
          rules: [
            locationPlan().components[0]!.expression,
            ...additionalFields.map((field) => ({
              kind: "categorical-equals" as const,
              requirementId: field,
              csvColumn: field,
              value: "yes",
            })),
          ],
        },
      }],
    };
    input.mappings.eventRequirements = {
      "operating-location": "operating_state",
      ...Object.fromEntries(additionalFields.map((field) => [field, field])),
    };
    const started = performance.now();
    const result = await runScreen04Audit(input);
    const elapsedMs = performance.now() - started;

    expect(result.publicResult).toMatchObject({
      rowCount: 20_000,
      unitCount: 10_000,
      overallStatus: "exposure-coding-is-executable",
      classificationCounts: {
        exposed: 5_000,
        unexposed: 5_000,
        not_applicable: 10_000,
      },
    });
    expect(result.publicResult.selectedColumns).toHaveLength(
      SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns,
    );
    expect(elapsedMs).toBeLessThan(5_000);
  }, 10_000);

  it("bounds a representative 20,000-row partial audit with amplified affected exports", async () => {
    const additionalFields = Array.from(
      { length: 12 },
      (_, index) => `typed_field_${index + 1}`,
    );
    const lines = [[
      "GVKEY",
      "year",
      "treated",
      "operating_state",
      ...additionalFields,
    ].join(",")];
    for (let unit = 0; unit < 10_000; unit += 1) {
      const id = String(unit).padStart(5, "0");
      const treated = unit % 2 === 0 ? "1" : "0";
      const state = treated === "1" ? "CA" : "NV";
      const row = [id, "2020", treated, state, ...additionalFields.map(() => "yes")];
      lines.push(row.join(","));
      row[1] = "2021";
      lines.push(row.join(","));
    }
    const csvText = lines.join("\n");
    const inputBytes = new TextEncoder().encode(csvText).byteLength;
    expect(inputBytes).toBeLessThanOrEqual(
      SCREEN_04_AUDIT_LIMITS.maximumFileBytes,
    );
    const input = auditInput(csvText);
    input.exposurePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [{
        ...locationPlan().components[0]!,
        expression: {
          kind: "all",
          rules: [
            locationPlan().components[0]!.expression,
            ...additionalFields.map((field) => ({
              kind: "categorical-equals" as const,
              requirementId: field,
              csvColumn: field,
              value: "yes",
            })),
          ],
        },
      }],
    };
    input.mappings.eventRequirements = {
      "operating-location": "operating_state",
      ...Object.fromEntries(additionalFields.map((field) => [field, field])),
    };
    const { bindingFingerprint: _ignored, ...withoutFingerprint } =
      eventCardBinding();
    const withCompilerLimitations = {
      ...withoutFingerprint,
      compilerLimitations: [
        {
          code: "SCREEN04_ASSIGNMENT_UNIT_NOT_MACHINE_TYPED" as const,
          message: "Assignment unit is not machine typed.",
        },
        {
          code: "SCREEN04_GEOGRAPHIC_RULE_NOT_MACHINE_TYPED" as const,
          message: "Geographic exposure is not machine typed.",
        },
        {
          code: "SCREEN04_THRESHOLD_RULE_NOT_MACHINE_TYPED" as const,
          message: "Threshold exposure is not machine typed.",
        },
        {
          code: "SCREEN04_EXEMPTION_RULE_NOT_MACHINE_TYPED" as const,
          message: "Exemption precedence is not machine typed.",
        },
      ],
    };
    input.eventCardBinding = {
      ...withCompilerLimitations,
      bindingFingerprint: fingerprintScreen03Value(withCompilerLimitations),
    };

    const started = performance.now();
    const first = await runScreen04Audit(input);
    const elapsedMs = performance.now() - started;
    const second = await runScreen04Audit(input);

    expect(first.publicResult).toMatchObject({
      rowCount: 20_000,
      unitCount: 10_000,
      overallStatus: "partial-audit-only",
      classificationCounts: {
        exposed: 0,
        unexposed: 0,
        unknown: 20_000,
        not_applicable: 0,
        total: 20_000,
      },
    });
    expect(first.publicResult.selectedColumns).toHaveLength(
      SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns,
    );
    expect(first.publicResult.issues).toHaveLength(9);
    expect(first.affectedCasesExport.rowCount).toBe(150_000);
    expect(first.affectedCasesExport.content.trimEnd().split("\r\n"))
      .toHaveLength(150_001);
    // Export size is intentionally not constrained by the upload limit: one
    // input row can appear once per independently reason-coded finding.
    expect(new TextEncoder().encode(first.affectedCasesExport.content).byteLength)
      .toBeGreaterThan(inputBytes);
    expect(second.publicResult.resultFingerprint).toBe(
      first.publicResult.resultFingerprint,
    );
    expect(second.affectedCasesExport).toMatchObject({
      rowCount: first.affectedCasesExport.rowCount,
      fingerprint: first.affectedCasesExport.fingerprint,
    });
    expect(elapsedMs).toBeLessThan(5_000);
  }, 15_000);
});
