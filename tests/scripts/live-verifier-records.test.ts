import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

// The production live gate is a plain Node ESM script rather than TypeScript.
// @ts-expect-error The verifier helper intentionally has no generated types.
import { connectorRouteCompleted, findConnectorRouteDiagnostics, hasExpectedEvidenceProvider, isScreen02FindPlanningRequest, sameRecords } from "../../scripts/live-verifier-records.mjs";
import { fingerprintScreen03VerifierState } from "../../scripts/live-verifier-screen03.mjs";
import {
  assertScreen02HandoffMatchesCanonicalState,
  fingerprintCanonicalJsonValue,
  screen02ContextBridgeMismatches,
  screen02HandoffCanonicalMismatches,
} from "../../scripts/live-mcp-workflow-state.mjs";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  fingerprintScreen02FindCandidateSet,
  requireScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  createScreen03LoadingState,
  fingerprintScreen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
} from "../core/screen02-workflow-fixtures";

const expectedCriteria = [
  {
    id: "criterion-1",
    kind: "require",
    text: "initiated by goverment",
    source: "researcher",
    exactRequest: "Find candidate shocks initiated by goverment.",
  },
];

describe("live verifier semantic record comparison", () => {
  it("uses the public provider provenance field instead of display labels", () => {
    const claims = [{
      citation: {
        provider: "Regulations.gov",
        sourceTitle: "U.S. General Services Administration",
        sourceRole:
          "official administrative-docket metadata used only for identity",
      },
    }];

    expect(hasExpectedEvidenceProvider(claims, "Regulations.gov")).toBe(true);
    expect(hasExpectedEvidenceProvider(claims, "Federal Register API"))
      .toBe(false);
  });

  it("does not accept provider text copied into display-only citation fields", () => {
    expect(hasExpectedEvidenceProvider([{
      citation: {
        sourceTitle: "Regulations.gov",
        sourceRole: "Regulations.gov administrative metadata",
      },
    }], "Regulations.gov")).toBe(false);
  });

  it("retains the v0.5.2 resource in the independent v0.6 compatibility ledger", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(verifier).toContain(
      '"ui://shockaudit/workspace-v0.5.2.html"',
    );
    expect(verifier.indexOf('"ui://shockaudit/workspace-v0.5.2.html"'))
      .toBeLessThan(
        verifier.indexOf('"ui://shockaudit/workspace-v0.6.2.html"'),
      );
  });

  it("checks that the retired skills surface fails closed", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(verifier).toContain("async function verifyNoCurrentSkillsSurface()");
    expect(verifier).toContain(
      '"The current MCP server still advertised the retired skills extension."',
    );
    expect(verifier).toContain('["skills/list", {}]');
    expect(verifier).toContain(
      '["skills/get", { uri: "skill://shockaudit/retired" }]',
    );
    expect(verifier).toContain('methods: "method-not-found"');
    expect(verifier).not.toContain("Do not use for a current v0.3.17 run");
  });

  it("requires the v2 source register and the reviewed official-document route", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(verifier).toContain('register.schemaVersion === "shockaudit-source-register-v4"');
    expect(verifier).toContain("register.sourceCount === 18");
    expect(verifier).toContain('"OPENSTATES_API_KEY"');
    expect(verifier).toContain('"openstates"');
    expect(verifier).toContain('"retire_six_screen_workflow_v1"');
    expect(verifier).toContain(
      "register.entries.reviewed_official_documents?.implemented === true",
    );
    expect(verifier).toContain(
      "register.entries.reviewed_official_documents?.operations",
    );
    expect(verifier).toContain("?.resolveIdentity === true");
    expect(verifier).toContain("?.fetchRepresentation === true");
  });

  it("checks the Order 841 official title without replacing it with an alias", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(verifier).toContain(
      'expectedTitle: "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators"',
    );
    expect(verifier).toContain(
      'expectedAlias: "FERC Order 841 Electric Storage Participation Rule"',
    );
  });

  it("recognizes a flat production Find planning request for receipt accounting", () => {
    expect(
      isScreen02FindPlanningRequest({
        mode: "find-discovery-plan",
        draftContract: {
          schemaVersion: "screen-02-find-assessment-draft-v1",
          requestedPartIds: ["queryTerms", "rationale"],
        },
      }),
    ).toBe(true);
  });

  it("accepts identical criterion records with a different object-key order", () => {
    const reordered = [
      {
        exactRequest: "Find candidate shocks initiated by goverment.",
        id: "criterion-1",
        kind: "require",
        source: "researcher",
        text: "initiated by goverment",
      },
    ];

    expect(sameRecords(reordered, expectedCriteria)).toBe(true);
  });

  it("rejects a changed value", () => {
    expect(
      sameRecords(
        [{ ...expectedCriteria[0], text: "initiated by government" }],
        expectedCriteria,
      ),
    ).toBe(false);
  });

  it("rejects missing or extra keys", () => {
    const { source: _source, ...missingSource } = expectedCriteria[0];
    expect(sameRecords([missingSource], expectedCriteria)).toBe(false);
    expect(
      sameRecords(
        [{ ...expectedCriteria[0], unexpected: true }],
        expectedCriteria,
      ),
    ).toBe(false);
  });

  it("keeps record and array order meaningful", () => {
    const second = { ...expectedCriteria[0], id: "criterion-2" };
    expect(
      sameRecords([second, expectedCriteria[0]], [expectedCriteria[0], second]),
    ).toBe(false);
  });
});

describe("live verifier Screen 3 CAS coordinates", () => {
  it("fingerprints the complete canonical state rather than its inner integrity domain", () => {
    const state = createScreen03LoadingState(
      buildScreen02WorkflowHandoff(
        buildReadyFindState(),
        "0.3.13",
        "2026-08-13T17:00:00.000Z",
      ),
      "2026-08-13T17:00:01.000Z",
    );

    expect(fingerprintScreen03VerifierState(state)).toBe(
      fingerprintScreen03VerificationState(state),
    );
    expect(fingerprintScreen03VerifierState(state)).not.toBe(
      state.integrity.stateFingerprint,
    );
  });

  it("reviews timeline claims but not required-variable prompts before lock", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );
    const factualHelper = verifier.slice(
      verifier.indexOf("function screen03FactualProposals(state)"),
      verifier.indexOf("function screen03InterpretationOrigin"),
    );

    expect(factualHelper).toContain("state.proposals.timeline");
    expect(factualHelper).not.toContain("requiredVariable");
  });
});

function resignVerifierHandoff(handoff: any) {
  handoff.integrity.eventFingerprint = fingerprintCanonicalJsonValue(
    handoff.event,
  );
  handoff.integrity.historyFingerprint = fingerprintCanonicalJsonValue(
    handoff.history,
  );
  const { handoffFingerprint: _ignored, ...integrity } = handoff.integrity;
  handoff.integrity.handoffFingerprint = fingerprintCanonicalJsonValue({
    ...handoff,
    integrity,
  });
  return handoff;
}

describe("live verifier independent Screen 2 handoff comparison", () => {
  it.each([
    ["event", (handoff: any) => {
      handoff.event.identity.canonicalTitle = "Consistently wrong event";
    }],
    ["preliminaryAssessment", (handoff: any) => {
      handoff.preliminaryAssessment.mainConcern =
        "Consistently wrong assessment";
    }],
    ["criteriaFindings", (handoff: any) => {
      handoff.criteriaFindings.push({ fabricated: true });
    }],
    ["history", (handoff: any) => {
      handoff.history.decisions = handoff.history.decisions.slice(1);
    }],
    ["sources", (handoff: any) => {
      handoff.sources[0].title = "Consistently wrong source";
      const { sourceFingerprint: _ignored, ...source } = handoff.sources[0];
      handoff.sources[0].sourceFingerprint =
        fingerprintCanonicalJsonValue(source);
    }],
    ["provenance", (handoff: any) => {
      handoff.provenance.candidateFingerprint =
        "fnv1a64:0000000000000000";
    }],
  ])("rejects a self-consistent wrong %s projection", (field, mutate) => {
    const state = buildReadyFindState();
    const handoff = structuredClone(buildScreen02WorkflowHandoff(
      state,
      "0.4.08",
      "2026-09-08T20:00:00.000Z",
    ));
    mutate(handoff);
    resignVerifierHandoff(handoff);
    expect(screen02HandoffCanonicalMismatches(state, handoff).join(" "))
      .toContain(`handoff.${field}`);
    expect(() => assertScreen02HandoffMatchesCanonicalState(state, handoff))
      .toThrow(/canonical Screen 2 evidence/iu);
  });

  it("accepts independently reconstructed Find and Audit handoffs", () => {
    for (const state of [buildReadyFindState(), buildReadyAuditState()]) {
      const handoff = buildScreen02WorkflowHandoff(
        state,
        "0.4.08",
        "2026-09-08T20:00:00.000Z",
      );
      expect(screen02HandoffCanonicalMismatches(state, handoff)).toEqual([]);
    }
  });

  it("matches the producer's consolidated repeated-exclusion history", () => {
    const candidate = cloneFixture(buildReadyFindState());
    const candidateSet = candidate.candidateSets[0]!;
    candidateSet.manifest.exclusions.push(
      {
        recordId: "bounded-exclusion-record",
        reason: "Excluded at the bounded raw-pool allowance.",
      },
      {
        recordId: "bounded-exclusion-record",
        reason: "Retained outside the final qualified-candidate limit.",
      },
    );
    candidateSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(candidateSet);
    const state = requireScreen02FindState(candidate);
    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.6.2",
      "2026-09-11T16:00:00.000Z",
    );

    expect(
      handoff.history.searchManifests[0]!.exclusions.filter(
        (exclusion) =>
          exclusion.recordId === "bounded-exclusion-record",
      ),
    ).toHaveLength(1);
    expect(screen02HandoffCanonicalMismatches(state, handoff)).toEqual([]);
  });
});

describe("live verifier contextual-to-official bridge validation", () => {
  const manifest = () => ({
    contextLeads: [{
      id: "context-lead",
      title: "Study cites Federal Register 2020-12345",
    }],
    queryMatrix: [{
      id: "bridge-query",
      query:
        "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=2020-12345",
      returnedRecordIds: ["2020-12345"],
    }],
    contextBridges: [{
      schemaVersion: "screen-02-context-official-bridge-v1",
      contextualLeadId: "context-lead",
      bridgeQueryId: "bridge-query",
      formalIdentifier: "2020-12345",
      returnedOfficialRecordIds: ["2020-12345"],
      status: "corroborated",
    }],
  });

  it("accepts an exact title/query/result binding", () => {
    expect(screen02ContextBridgeMismatches(manifest())).toEqual([]);
  });

  it.each([
    ["lead", (value: any) => {
      value.contextLeads[0].title = "Study cites Federal Register 2020-54321";
    }],
    ["query", (value: any) => {
      value.queryMatrix[0].query =
        "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=2020-54321";
    }],
    ["result", (value: any) => {
      value.queryMatrix[0].returnedRecordIds = [];
    }],
    ["status", (value: any) => {
      value.contextBridges[0].status = "no-corroboration";
    }],
    ["coordinate", (value: any) => {
      value.contextBridges[0].bridgeQueryId = " bridge-query";
      value.queryMatrix[0].id = " bridge-query";
    }],
  ])("rejects a bridge with a changed %s binding", (_kind, mutate) => {
    const value = manifest();
    mutate(value);
    expect(screen02ContextBridgeMismatches(value).length).toBeGreaterThan(0);
  });
});

describe("live verifier connector diagnostics", () => {
  it("uses the stable connector diagnostic channel instead of a display label", () => {
    const diagnostics = findConnectorRouteDiagnostics(
      {
        channels: [
          {
            channel:
              "Federal Register API v1 · rules, proposed rules, and notices",
            status: "searched",
          },
          {
            channel: "federal-register-api-v1 diagnostics",
            status: "searched",
            note: "Two bounded requests completed.",
          },
        ],
        queryMatrix: [
          {
            id: "federal-register-native-01",
            query:
              "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=video+game",
            returnedRecordIds: ["2026-12345"],
          },
          {
            id: "federal-register-native-02",
            query:
              "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=interactive+entertainment",
            returnedRecordIds: [],
          },
          {
            id: "reviewed-event-registry",
            query: "screen-02-event-registry-v1",
            returnedRecordIds: [],
          },
        ],
      },
      "federal-register-api-v1",
      "https://www.federalregister.gov/api/v1/documents.json",
    );

    expect(diagnostics.channel).toMatchObject({
      status: "searched",
      note: "Two bounded requests completed.",
    });
    expect(
      diagnostics.queries.map((query: { id: string }) => query.id),
    ).toEqual([
      "federal-register-native-01",
      "federal-register-native-02",
    ]);
    expect(connectorRouteCompleted(diagnostics)).toBe(true);
  });

  it.each([
    {
      name: "retired display label without aggregate diagnostics",
      channels: [
        {
          channel: "Federal Register API v1 · final rules",
          status: "searched",
        },
      ],
      returnedRecordIds: [],
    },
    {
      name: "failed aggregate diagnostics",
      channels: [
        {
          channel: "federal-register-api-v1 diagnostics",
          status: "failed",
        },
      ],
      returnedRecordIds: [],
    },
    {
      name: "missing returned-record array",
      channels: [
        {
          channel: "federal-register-api-v1 diagnostics",
          status: "searched",
        },
      ],
      returnedRecordIds: undefined,
    },
  ])("rejects $name", ({ channels, returnedRecordIds }) => {
    const query = {
      id: "federal-register-native-01",
      query:
        "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=video+game",
      ...(returnedRecordIds === undefined
        ? {}
        : { returnedRecordIds }),
    };
    const diagnostics = findConnectorRouteDiagnostics(
      {
        channels,
        queryMatrix: [query],
      },
      "federal-register-api-v1",
      "https://www.federalregister.gov/api/v1/documents.json",
    );

    expect(connectorRouteCompleted(diagnostics)).toBe(false);
  });
});
