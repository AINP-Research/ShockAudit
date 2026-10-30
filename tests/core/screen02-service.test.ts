import { describe, expect, it } from "vitest";
import { gzipSync } from "fflate";

import { screen02ContextMarkdown } from "../../src/core/screen02-context-markdown";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT,
  applyScreen02PreliminaryAssessmentRound,
  applyScreen02SearchRound,
  assessScreen02Items,
  createScreen02Session,
  deduplicateScreen02Sources,
  evaluateFindHardFilters,
  fingerprintScreen01StudyContext,
  lockScreen02Choice,
  rejectScreen02Item,
  restoreScreen02Session,
  scoreScreen02Feasibility,
  screen02MaterialTimingFacts,
  sourceResolvesFindHardFilterReview,
  selectScreen02Item,
  serializeScreen01StudyContext,
  serializeScreen02Session,
  summarizeScreen02Sources,
} from "../../src/core/screen02-service";
import {
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
  SCREEN_02_STATE_ENVELOPE_ENCODING,
  SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
  buildScreen02ReviewContext,
  buildScreen02SessionSummary,
  decodeScreen02StateEnvelope,
  encodeScreen02StateEnvelope,
  restoreScreen02StateEnvelope,
  screen02EnvelopeIdentity,
  type Screen02StateEnvelope,
} from "../../src/core/screen02-state-envelope";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  SOURCE_AUTHORITY_TIERS,
  type Screen02AssessmentInput,
  type Screen02AuditProposal,
  type Screen02ComponentReasons,
  type Screen02ComponentScores,
  type Screen02FindProposal,
  type Screen02Source,
} from "../../src/core/screen02-types";
import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import {
  buildScreen01StudyContext,
  requireReadyScreen01Context,
} from "../../src/core/study-context";
import {
  decisionKeys,
  type Screen01StudyContext,
} from "../../src/core/scope-types";
import {
  SCREEN02_DISCOVERY_FORMULA_VERSION,
  buildInitialScreen02DiscoveryQuery,
} from "../../src/core/screen02-discovery-contract";
import { buildScreen02DiscoveryQuery } from
  "../../src/core/screen02-discovery";
import { Screen02StateCapacityError } from
  "../../src/core/screen02-state-capacity";

function confirmedFindContext(): Screen01StudyContext {
  const initial = createInitialState("find");
  const result = confirmScopeContract({
    ...initial,
    revision: 4,
    scope: {
      ...initial.scope,
      population: "U.S. exchange-listed manufacturing firms",
      assignmentLevel: "Firm",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [
      "population",
      "assignmentLevel",
      "outcomeFrequency",
    ],
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

function confirmedAuditContext(): Screen01StudyContext {
  const initial = createInitialState("audit");
  const sentence =
    "Audit whether the California Consumer Privacy Act changed weekly innovation among U.S. exchange-listed technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";
  const result = confirmScopeContract({
    ...initial,
    revision: 7,
    sentence,
    contractSourceSentence: sentence,
    knownShock: "California Consumer Privacy Act",
    scope: {
      population: "U.S. exchange-listed technology firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Weekly",
    },
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

function confirmedChinesePublicContext(): Screen01StudyContext {
  const sentence =
    "Find a regulatory shock affecting annual profitability among Chinese public firms with firm-level assignment and firm-level analysis across all industries from 2014 to 2022.";
  const result = confirmScopeContract({
    revision: 8,
    mode: "find",
    sentence,
    contractSourceSentence: sentence,
    scope: {
      population: "Chinese public firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "China",
      industry: "All industries",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    },
    knownShock: "",
    resolvedKeys: [...decisionKeys],
    scopeDirty: false,
  });
  if (!result.ok) throw new Error(result.error);
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

function sharedFindFields() {
  return {
    origin: "newly-discovered" as const,
    provisionalDates: ["Effective date: 2019-07-01"],
    affectedPopulation: "U.S. exchange-listed manufacturing firms",
    requiredVariables: ["Assignment", "Event date"],
    outcomeLink: {
      text: "An AI hypothesis links exposure to profitability.",
      status: "ai-hypothesis" as const,
    },
    likelyServiceLevel: "assisted-audit" as const,
    limitations: ["Assignment evidence still requires researcher review."],
    reasons: ["The event appears to match the confirmed study boundary."],
  };
}

function findProposal(
  id: string,
  overrides: Partial<Screen02FindProposal> = {},
): Screen02FindProposal {
  return {
    id,
    mode: "find",
    kind: "event",
    title: `Candidate ${id}`,
    description: "A bounded test candidate.",
    ...sharedFindFields(),
    event: {
      displayName: `Candidate ${id}`,
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. exchange-listed manufacturing firms"],
    },
    sources: [],
    ...overrides,
  };
}

function source(
  id: string,
  authorityTier: 1 | 2 | 3 | 4 | 5 | 6,
  locator = `https://example.test/${id}`,
): Screen02Source {
  return {
    id,
    title: `Source ${id}`,
    locator,
    publisher: "Example authority",
    publishedDate: "2019-01-01",
    authorityTier,
    channel: "official-primary",
  };
}

function findEvidenceSource(
  proposalId: string,
  evidenceText: string,
  identityAction = "was adopted",
) {
  return {
    ...source(`${proposalId}-source`, 1),
    evidenceText: `Candidate ${proposalId} ${identityAction}. ${evidenceText}`,
  };
}

function auditProposal(
  overrides: Partial<Screen02AuditProposal> = {},
): Screen02AuditProposal {
  return {
    id: "audit-external",
    mode: "audit",
    kind: "representation",
    representationType: "formal-eligibility",
    title: "Formal assignment",
    description: "A source-backed candidate assignment definition.",
    candidateConstruct:
      "California Consumer Privacy Act formal assignment",
    operationalization:
      "An indicator based on source-documented formal eligibility.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Covered firms",
    requiredVariables: ["Formal eligibility", "Effective date"],
    outcomeLink: {
      text: "An AI hypothesis links formal assignment to innovation.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: ["Formal assignment may differ from realized exposure."],
    reasons: ["The source describes an eligibility rule."],
    sources: [source("audit-source", 1)],
    ...overrides,
  };
}

function auditIdentityMatchProposal(
  id = "audit-ccpa-event-match",
): Screen02AuditProposal {
  return auditProposal({
    id,
    representationType: "whole-package",
    title: "California Consumer Privacy Act",
    description:
      "A provisional source-backed identity match for the exact known-shock anchor.",
    candidateConstruct:
      "California Consumer Privacy Act: resolved event identity",
    operationalization:
      "Confirm the event identity, authority, dates, coverage, and source passages in Screen 3 before constructing an empirical representation.",
    origin: "newly-discovered",
    limitations: [
      "This card establishes an event-identity lead only; Screen 3 must verify every empirical representation.",
    ],
    reasons: [
      "The official record matched the exact known-shock anchor.",
      "No outcome values were inspected.",
    ],
    sources: [
      source(
        `${id}-source`,
        1,
        `https://leginfo.legislature.ca.gov/${id}`,
      ),
    ],
  });
}

function auditSessionWithIdentityMatch(
  id = "audit-ccpa-event-match",
) {
  const opened = createScreen02Session(confirmedAuditContext());
  return applyScreen02SearchRound(opened, {
    expectedRevision: opened.revision,
    requestType: "find-more",
    stage: "native-retrieval",
    exactRequest:
      "Resolve the exact known shock to a source-backed event identity.",
    retrievedAt: "2026-07-29T12:00:00Z",
    proposals: [auditIdentityMatchProposal(id)],
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function legacyFingerprint(serialized: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function reverseObjectPropertyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectPropertyOrder);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, item]) => [key, reverseObjectPropertyOrder(item)]),
    );
  }
  return value;
}

function deterministicHighEntropy(seed: number, length: number) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let state = seed >>> 0;
  let output = "";
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output += alphabet[state & 63];
  }
  return output;
}

function highEntropySource(index: number): Screen02Source {
  const value = (field: number, length: number) =>
    deterministicHighEntropy(100_000 + index * 10 + field, length);
  return {
    id: `entropy-source-${index}`,
    title: value(1, 2_000),
    locator: `https://example.test/${index}/${value(2, 2_000)}`,
    publisher: value(3, 500),
    publishedDate: "2019-01-01",
    authorityTier: 4,
    authorityAssessment: {
      method: "researcher-confirmed",
      reason: value(4, 2_000),
      policyVersion: "screen-02-source-policy-v1",
    },
    channel: value(5, 500),
    retrievedAt: "2026-08-08T12:00:00Z",
  };
}

function envelopeForJson(json: string): Screen02StateEnvelope {
  const raw = new TextEncoder().encode(json);
  const compressed = gzipSync(raw, { level: 6, mtime: 0 });
  return {
    schemaVersion: SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
    encoding: SCREEN_02_STATE_ENVELOPE_ENCODING,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: legacyFingerprint(json),
    payload: Buffer.from(compressed).toString("base64url"),
  };
}

function findSessionWithResult(id = "initial-find-result") {
  const initial = createScreen02Session(confirmedFindContext());
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "find-more",
    exactRequest: "Find source-backed candidate shocks.",
    retrievedAt: "2026-07-29T11:59:00Z",
    proposals: [
      findProposal(id, {
        sources: [source(`${id}-source`, 1)],
      }),
    ],
  });
}

function nativeFindSessionWithResult() {
  const initial = createScreen02Session(confirmedFindContext());
  return applyScreen02SearchRound(initial, {
    expectedRevision: initial.revision,
    requestType: "find-more",
    exactRequest: "Prefer source-backed regulatory candidates.",
    retrievedAt: "2026-07-29T12:05:00Z",
    stage: "native-retrieval",
    criteria: [
      {
        id: "criterion-official-source",
        kind: "prefer",
        text: "Prefer official primary sources.",
        source: "researcher",
        exactRequest: "Prefer source-backed regulatory candidates.",
      },
    ],
    proposals: [
      findProposal("native-find-result", {
        sources: [source("native-find-result-source", 1)],
      }),
    ],
  });
}

describe("Screen 2 immutable core", () => {
  it("creates both Find and Audit branches with empty initial result sets", () => {
    const find = createScreen02Session(confirmedFindContext());
    expect(find.mode).toBe("find");
    expect(find.items).toEqual([]);
    expect(find.selectedItemId).toBeNull();
    expect(find.interaction.itemVersions).toEqual([]);
    expect(find.interaction.searchRounds).toHaveLength(1);
    expect(find.interaction.searchRounds[0]).toMatchObject({
      id: "round-000",
      requestType: "initial",
      proposalIdsReceived: [],
      itemIdsRetained: [],
      itemIdsAdded: [],
    });

    const audit = createScreen02Session(confirmedAuditContext());
    expect(audit.mode).toBe("audit");
    expect(audit.items).toEqual([]);
    expect(audit.selectedItemId).toBeNull();
    expect(audit.lockedChoice).toBeNull();
    expect(audit.interaction.itemVersions).toEqual([]);
    expect(audit.interaction.searchRounds).toHaveLength(1);
    expect(audit.interaction.searchRounds[0]).toMatchObject({
      id: "round-000",
      requestType: "initial",
      proposalIdsReceived: [],
      itemIdsRetained: [],
      itemIdsAdded: [],
    });
    expect(audit.screen01Baseline.knownShock).toBe(
      "California Consumer Privacy Act",
    );
  });

  it.each([
    ["Find", confirmedFindContext],
    ["Audit", confirmedAuditContext],
  ])(
    "keeps the extracted empty %s bootstrap byte-equivalent to generic discovery and assessment",
    (_mode, contextFactory) => {
      const context = contextFactory();
      const expectedAssessment = assessScreen02Items(context, []);
      const session = createScreen02Session(context);
      const initialRound = session.interaction.searchRounds[0]!;
      const initialQuery = buildInitialScreen02DiscoveryQuery(context);

      expect(initialQuery).toBe(buildScreen02DiscoveryQuery(context));
      expect(session.searchManifest).toStrictEqual(
        expectedAssessment.searchManifest,
      );
      expect(initialRound.manifest).toStrictEqual(
        expectedAssessment.searchManifest,
      );
      expect(initialRound.discovery).toStrictEqual({
        formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
        query: initialQuery,
        rankings: [],
        clusters: [],
      });
    },
  );

  it("deep-clones and recursively freezes the Screen 1 baseline", () => {
    const context = confirmedAuditContext();
    const session = createScreen02Session(context);

    expect(session.screen01Baseline).not.toBe(context);
    expect(session.screen01Baseline.scopeContract).not.toBe(
      context.scopeContract,
    );
    expect(Object.isFrozen(session.screen01Baseline)).toBe(true);
    expect(Object.isFrozen(session.screen01Baseline.scopeContract)).toBe(
      true,
    );
    expect(Object.isFrozen(session.screen01Baseline.resolvedKeys)).toBe(
      true,
    );
    expect(() => {
      (
        session.screen01Baseline.scopeContract as {
          population: string;
        }
      ).population = "Changed population";
    }).toThrow(TypeError);
    expect(context.scopeContract.population).toBe(
      "U.S. exchange-listed technology firms",
    );
  });

  it("does not allow fictional, hard-fail, or Stop items to unlock Screen 3", () => {
    const find = createScreen02Session(confirmedFindContext());
    const withDemonstration = applyScreen02SearchRound(find, {
      expectedRevision: find.revision,
      requestType: "find-more",
      exactRequest: "Include the disclosed fictional test fixture.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [
        findProposal("fictional-fixture", {
          origin: "fictional-demonstration",
          likelyServiceLevel: "stop",
          fictionalDemo: true,
        }),
      ],
    });
    const demonstration = withDemonstration.items.find(
      (item) => item.id === "fictional-fixture",
    );
    expect(demonstration).toMatchObject({
      evidenceStatus: "fictional-demonstration",
      likelyServiceLevel: "stop",
    });

    expect(() =>
      selectScreen02Item(withDemonstration, demonstration!.id),
    ).toThrow(
      "A fictional, hard-fail, or Stop option cannot be selected for Screen 3.",
    );

    const forgedSelection = clone(withDemonstration);
    forgedSelection.selectedItemId = demonstration!.id;
    expect(restoreScreen02Session(forgedSelection)).toBeNull();
  });

  it("rejects any inbound context that differs from its canonical form", () => {
    const context = confirmedAuditContext();
    const withExtraProperty = {
      ...context,
      screen02InjectedValue: "must not survive",
    } as Screen01StudyContext;
    expect(() => createScreen02Session(withExtraProperty)).toThrow(
      "changed during revalidation",
    );

    const forged = {
      ...context,
      scopeContract: {
        ...context.scopeContract,
        assignmentLevel: "Planet",
      },
    };
    expect(() => createScreen02Session(forged)).toThrow(
      "failed server-equivalent revalidation",
    );
  });

  it("preserves exact Screen 1 equality through create, select, serialize, and restore", () => {
    const context = confirmedAuditContext();
    const inbound = serializeScreen01StudyContext(context);
    const exactInboundJson = JSON.stringify(context);
    const fingerprint = fingerprintScreen01StudyContext(context);
    const created = createScreen02Session(context);
    const searched = applyScreen02SearchRound(created, {
      expectedRevision: created.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest:
        "Resolve the exact known shock to a source-backed event identity.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [auditIdentityMatchProposal()],
    });
    const selected = selectScreen02Item(
      searched,
      "audit-ccpa-event-match",
    );

    expect(serializeScreen01StudyContext(created.screen01Baseline)).toBe(
      inbound,
    );
    expect(JSON.stringify(created.screen01Baseline)).toBe(exactInboundJson);
    expect(serializeScreen01StudyContext(searched.screen01Baseline)).toBe(
      inbound,
    );
    expect(serializeScreen01StudyContext(selected.screen01Baseline)).toBe(
      inbound,
    );
    expect(JSON.stringify(selected.screen01Baseline)).toBe(exactInboundJson);
    expect(created.screen01Fingerprint).toBe(fingerprint);
    expect(selected.screen01Fingerprint).toBe(fingerprint);

    const serialized = serializeScreen02Session(selected);
    const restored = restoreScreen02Session(JSON.parse(serialized));
    expect(restored).not.toBeNull();
    expect(restored?.selectedItemId).toBe("audit-ccpa-event-match");
    expect(restored?.items[0]?.sourceSummary.uniqueSourceCount).toBe(1);
    expect(serializeScreen02Session(restored as typeof selected)).toBe(
      serialized,
    );
    expect(
      serializeScreen01StudyContext(restored!.screen01Baseline),
    ).toBe(inbound);
    expect(JSON.stringify(restored!.screen01Baseline)).toBe(
      exactInboundJson,
    );
  });

  it("selects and locks a source-backed Audit event match without preselecting an empirical representation", () => {
    const searched = auditSessionWithIdentityMatch();
    const match = searched.items[0];

    expect(searched.items).toHaveLength(1);
    expect(searched.selectedItemId).toBeNull();
    expect(searched.lockedChoice).toBeNull();
    expect(match).toMatchObject({
      id: "audit-ccpa-event-match",
      mode: "audit",
      title: "California Consumer Privacy Act",
      sourceSummary: { uniqueSourceCount: 1 },
    });
    expect(match?.kind).toBe("representation");
    if (match?.kind !== "representation") {
      throw new Error("Expected the v2 Audit compatibility card shape.");
    }
    expect(match.candidateConstruct).toContain("resolved event identity");
    expect(match.operationalization).toContain("Screen 3");
    expect(match.operationalization).toContain(
      "constructing an empirical representation",
    );

    const selected = selectScreen02Item(searched, match.id);
    expect(selected.selectedItemId).toBe(match.id);
    expect(selected.lockedChoice).toBeNull();

    const locked = lockScreen02Choice(selected);
    expect(locked.lockedChoice).toMatchObject({
      status: "locked",
      itemId: match.id,
      mode: "audit",
      shockName: "California Consumer Privacy Act",
      knownShockAnchor: "California Consumer Privacy Act",
      downstreamStatus: "screen-03-ready",
    });
    expect(
      locked.interaction.selectionHistory.map((event) => event.action),
    ).toEqual(["selected", "locked"]);
    expect(
      locked.interaction.selectionHistory.at(-1)?.reason,
    ).toContain("shock for Screen 3 evidence verification");
  });

  it("normalizes legal property reordering without changing the v0.2.14 Screen 1 fingerprint", () => {
    const produced = {
      ...confirmedAuditContext(),
      appVersion: "0.2.14",
    };
    const producerJson = JSON.stringify(produced);
    const reordered = reverseObjectPropertyOrder(
      produced,
    ) as Screen01StudyContext;

    expect(JSON.stringify(reordered)).not.toBe(producerJson);
    expect(requireReadyScreen01Context(reordered)).toStrictEqual(produced);
    expect(JSON.stringify(requireReadyScreen01Context(reordered))).toBe(
      producerJson,
    );
    expect(serializeScreen01StudyContext(reordered)).toBe(producerJson);
    expect(fingerprintScreen01StudyContext(reordered)).toBe(
      legacyFingerprint(producerJson),
    );

    const session = createScreen02Session(reordered);
    expect(JSON.stringify(session.screen01Baseline)).toBe(producerJson);
    expect(session.screen01Fingerprint).toBe(
      legacyFingerprint(producerJson),
    );
  });

  it("round-trips a canonical compact Screen 2 state envelope independent of property order", () => {
    const session = nativeFindSessionWithResult();
    const envelope = encodeScreen02StateEnvelope(session);
    const reordered = reverseObjectPropertyOrder(session) as typeof session;

    expect(Object.keys(envelope)).toEqual([
      "schemaVersion",
      "encoding",
      "uncompressedBytes",
      "compressedBytes",
      "checksum",
      "payload",
    ]);
    expect(envelope).toEqual(encodeScreen02StateEnvelope(reordered));
    expect(envelope.payload.length).toBeLessThan(envelope.uncompressedBytes);
    expect(envelope.payload).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = decodeScreen02StateEnvelope(clone(envelope));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(serializeScreen02Session(decoded.session)).toBe(
      serializeScreen02Session(session),
    );
    expect(decoded.envelope).toEqual(envelope);
    expect(restoreScreen02StateEnvelope(envelope)).not.toBeNull();
    expect(screen02EnvelopeIdentity(decoded.envelope)).toBe(
      screen02EnvelopeIdentity(envelope),
    );
  });

  it("builds a typed summary and bounded AI review context without duplicating history", () => {
    const session = nativeFindSessionWithResult();
    const summary = buildScreen02SessionSummary(session);
    const review = buildScreen02ReviewContext(session);

    expect(summary).toMatchObject({
      runId: session.runId,
      revision: session.revision,
      latestRoundId: "round-001",
      stage: "native-retrieval",
      sessionLocation: "state-envelope",
      pendingRequestReconciled: true,
      outcomeValuesInspected: false,
    });
    expect(summary.currentItems).toEqual([
      { id: "native-find-result", title: "Candidate native-find-result" },
    ]);
    expect(review).toMatchObject({
      runId: session.runId,
      revision: session.revision,
      rootNativeRoundId: "round-001",
      assessmentParentRoundId: "round-001",
      stage: "native-retrieval",
      outcomeValuesInspected: false,
    });
    expect(review.criteria.map((criterion) => criterion.id)).toEqual([
      "criterion-official-source",
    ]);
    expect(review.currentCandidates.map((candidate) => candidate.id)).toEqual([
      "native-find-result",
    ]);
    expect("interaction" in review).toBe(false);
    expect("itemVersions" in review).toBe(false);
    expect("searchRounds" in review).toBe(false);
    expect(JSON.stringify(review).length).toBeLessThan(
      serializeScreen02Session(session).length,
    );
  });

  it("accepts compact assessments independently while preserving native candidates", () => {
    const opened = createScreen02Session(confirmedFindContext());
    const native = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Find two source-backed regulatory candidates.",
      retrievedAt: "2026-08-09T12:00:00Z",
      proposals: [
        findProposal("first-candidate", {
          sources: [source("first-candidate-source", 1)],
        }),
        findProposal("second-candidate", {
          sources: [source("second-candidate-source", 2)],
        }),
      ],
    });
    const root = native.interaction.searchRounds.at(-1)!;
    const assessed = applyScreen02PreliminaryAssessmentRound(native, {
      expectedRevision: native.revision,
      exactRequest: "Add concise preliminary assessments.",
      retrievedAt: "2026-08-09T12:01:00Z",
      rootNativeRoundId: root.id,
      assessmentParentRoundId: root.id,
      assessments: [
        {
          itemId: "first-candidate",
          judgment: "promising-to-verify",
          studyFit:
            "The first candidate matches the confirmed regulatory event and manufacturing-firm study boundary.",
          affectedPopulation: "U.S. manufacturing firms described by the source",
          outcomeMechanism:
            "The first candidate regulation could change compliance costs and thereby influence Profitability.",
          mainConcern:
            "The official source does not yet establish firm-level exposure timing with enough precision.",
          evidenceSourceIds: ["first-candidate-source"],
          nextChecks: [
            "Verify the operative date and covered-firm definition in the official record.",
          ],
        },
        {
          judgment: "worth-exploring",
          studyFit:
            "This otherwise plausible entry omitted the candidate identifier entirely.",
        },
        {
          itemId: 42,
          judgment: "worth-exploring",
          studyFit:
            "This otherwise plausible entry supplied a non-string candidate identifier.",
        },
      ],
    });

    expect(assessed.interaction.searchRounds.at(-1)).toMatchObject({
      stage: "preliminary-assessment",
      assessmentParentRoundId: root.id,
      rootNativeRoundId: root.id,
      itemIdsRetained: root.itemIdsRetained,
      assessmentResults: [
        { itemId: "first-candidate", status: "assessed" },
        { itemId: "second-candidate", status: "needs-retry" },
      ],
    });
    expect(
      assessed.items.find((item) => item.id === "first-candidate")
        ?.preliminaryAssessment,
    ).toMatchObject({
      schemaVersion: "screen02-preliminary-assessment-v1",
      method: "ai-preliminary",
      judgment: "promising-to-verify",
      rootNativeRoundId: root.id,
      assessedAtRevision: assessed.revision,
    });
    expect(
      assessed.items.find((item) => item.id === "second-candidate")
        ?.preliminaryAssessment,
    ).toBeUndefined();
    expect(
      assessed.interaction.searchRounds.at(-1)?.itemIdsRetained,
    ).toEqual(root.itemIdsRetained);
    expect(
      assessed.items.find((item) => item.id === "first-candidate")?.title,
    ).toBe(
      native.items.find((item) => item.id === "first-candidate")?.title,
    );
    expect(restoreScreen02Session(clone(assessed))).not.toBeNull();
    const rejectedRetry = rejectScreen02Item(
      assessed,
      "second-candidate",
      "The researcher removed this failed candidate from consideration.",
    );
    expect(() => buildScreen02ReviewContext(rejectedRetry)).toThrow(
      "no candidate that currently needs",
    );
  });

  it("retries only missing compact assessments and preserves prior success", () => {
    const opened = createScreen02Session(confirmedFindContext());
    const native = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Find source-backed regulatory candidates.",
      retrievedAt: "2026-08-09T12:00:00Z",
      proposals: [
        findProposal("first-candidate", {
          sources: [source("first-candidate-source", 1)],
        }),
        findProposal("second-candidate", {
          sources: [source("second-candidate-source", 2)],
        }),
      ],
    });
    const root = native.interaction.searchRounds.at(-1)!;
    const partial = applyScreen02PreliminaryAssessmentRound(native, {
      expectedRevision: native.revision,
      exactRequest: "Add the available assessment.",
      retrievedAt: "2026-08-09T12:01:00Z",
      rootNativeRoundId: root.id,
      assessmentParentRoundId: root.id,
      assessments: [
        {
          itemId: "first-candidate",
          judgment: "worth-exploring",
          studyFit:
            "The first candidate matches the regulatory scope and the manufacturing-firm population.",
          affectedPopulation: "U.S. manufacturing firms described by the source",
          outcomeMechanism:
            "The first candidate regulation could alter compliance spending and then affect Profitability.",
          mainConcern:
            "The current source leaves the assignment timing and covered-firm boundary uncertain.",
          evidenceSourceIds: ["first-candidate-source"],
          nextChecks: [
            "Verify the effective date and covered-firm definition in the official source.",
          ],
        },
      ],
    });
    const firstAssessmentRevision = partial.items.find(
      (item) => item.id === "first-candidate",
    )?.preliminaryAssessment?.assessedAtRevision;
    const acceptedFirstAssessment = clone(
      partial.items.find((item) => item.id === "first-candidate")!
        .preliminaryAssessment,
    );
    const selectedPartial = selectScreen02Item(partial, "first-candidate");
    const firstRetryParent = selectedPartial.interaction.searchRounds.at(-1)!;
    const adversarialRetry = applyScreen02PreliminaryAssessmentRound(
      selectedPartial,
      {
        expectedRevision: selectedPartial.revision,
        exactRequest:
          "Attempt to replace an accepted assessment while the missing candidate remains invalid.",
        retrievedAt: "2026-08-09T12:02:00Z",
        rootNativeRoundId: root.id,
        assessmentParentRoundId: firstRetryParent.id,
        assessments: [
          {
            itemId: "first-candidate",
            judgment: "low-priority",
            studyFit:
              "This replacement deliberately changes the accepted first-candidate judgment despite its established study fit.",
            affectedPopulation:
              "A deliberately changed population description for U.S. manufacturing firms",
            outcomeMechanism:
              "The first candidate regulation could instead change administrative staffing and affect Profitability.",
            mainConcern:
              "This deliberately different concern must never replace the accepted append-only assessment.",
            evidenceSourceIds: ["first-candidate-source"],
            nextChecks: [
              "This replacement check must be ignored for the already accepted candidate.",
            ],
          },
          {
            itemId: "second-candidate",
            judgment: "low-priority",
            studyFit: "Still too short",
          },
        ],
      },
    );
    expect(
      adversarialRetry.items.find((item) => item.id === "first-candidate")
        ?.preliminaryAssessment,
    ).toEqual(acceptedFirstAssessment);
    expect(
      adversarialRetry.interaction.searchRounds.at(-1)?.assessmentResults,
    ).toEqual([
      {
        itemId: "first-candidate",
        status: "assessed",
        reason:
          "The previously accepted compact assessment remains current; a resubmitted replacement was ignored.",
      },
      expect.objectContaining({
        itemId: "second-candidate",
        status: "needs-retry",
      }),
    ]);

    const retryParent = adversarialRetry.interaction.searchRounds.at(-1)!;
    const completed = applyScreen02PreliminaryAssessmentRound(adversarialRetry, {
      expectedRevision: adversarialRetry.revision,
      exactRequest: "Use the final retry for the missing candidate only.",
      retrievedAt: "2026-08-09T12:02:00Z",
      rootNativeRoundId: root.id,
      assessmentParentRoundId: retryParent.id,
      assessments: [
        {
          itemId: "first-candidate",
          judgment: "promising-to-verify",
          studyFit:
            "A second replacement attempt again targets the already accepted first-candidate assessment.",
          affectedPopulation:
            "Another deliberately changed manufacturing-firm population description",
          outcomeMechanism:
            "The first candidate regulation could redirect capital spending and affect Profitability.",
          mainConcern:
            "This replacement also must be ignored without weakening the prior accepted result.",
          evidenceSourceIds: ["first-candidate-source"],
          nextChecks: [
            "Ignore this replacement task for the already accepted candidate.",
          ],
        },
        {
          itemId: "second-candidate",
          judgment: "low-priority",
          studyFit:
            "The second candidate falls inside the regulatory scope but has weaker population alignment.",
          affectedPopulation: "Manufacturing firms described by the second source",
          outcomeMechanism:
            "The second candidate regulation may change reporting burdens and indirectly affect Profitability.",
          mainConcern:
            "The second source does not yet establish comparable exposure timing across eligible firms.",
          evidenceSourceIds: ["second-candidate-source"],
          nextChecks: [
            "Confirm the operative date and whether covered firms can be identified consistently.",
          ],
        },
      ],
    });

    expect(
      completed.interaction.searchRounds.at(-1)?.assessmentResults,
    ).toEqual([
      {
        itemId: "first-candidate",
        status: "assessed",
        reason:
          "The previously accepted compact assessment remains current; a resubmitted replacement was ignored.",
      },
      {
        itemId: "second-candidate",
        status: "assessed",
        reason: "The compact preliminary assessment was accepted.",
      },
    ]);
    expect(
      completed.items.find((item) => item.id === "first-candidate")
        ?.preliminaryAssessment?.assessedAtRevision,
    ).toBe(firstAssessmentRevision);
    expect(
      completed.items.find((item) => item.id === "first-candidate")
        ?.preliminaryAssessment,
    ).toEqual(acceptedFirstAssessment);
    expect(
      completed.items.find((item) => item.id === "second-candidate")
        ?.preliminaryAssessment?.assessedAtRevision,
    ).toBe(completed.revision);
    expect(completed.selectedItemId).toBe("first-candidate");
    expect(restoreScreen02Session(clone(completed))).not.toBeNull();
    expect(
      completed.interaction.searchRounds.filter(
        (round) =>
          round.stage === "preliminary-assessment" &&
          round.rootNativeRoundId === root.id,
      ),
    ).toHaveLength(SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT);
    expect(() =>
      applyScreen02PreliminaryAssessmentRound(completed, {
        expectedRevision: completed.revision,
        exactRequest: "A fourth compact round must exceed the per-root cap.",
        retrievedAt: "2026-08-09T12:03:00Z",
        rootNativeRoundId: root.id,
        assessmentParentRoundId:
          completed.interaction.searchRounds.at(-1)!.id,
        assessments: [{ itemId: "first-candidate" }],
      }),
    ).toThrow(
      `at most ${SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT} preliminary-assessment rounds per native result set`,
    );
    const forgedFourthRound = clone(completed);
    const forgedParent = forgedFourthRound.interaction.searchRounds.at(-1)!;
    forgedFourthRound.revision += 1;
    forgedFourthRound.interaction.searchRounds.push({
      ...clone(forgedParent),
      id: `round-${String(
        forgedFourthRound.interaction.searchRounds.length,
      ).padStart(3, "0")}`,
      revision: forgedFourthRound.revision,
      exactRequest: "Forged fourth preliminary-assessment round.",
      assessmentParentRoundId: forgedParent.id,
    });
    expect(restoreScreen02Session(forgedFourthRound)).toBeNull();

    const refreshedNative = applyScreen02SearchRound(completed, {
      expectedRevision: completed.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Refresh the native candidate facts.",
      retrievedAt: "2026-08-09T12:03:00Z",
      proposals: [
        findProposal("first-candidate", {
          sources: [source("first-candidate-source", 1)],
        }),
        findProposal("second-candidate", {
          sources: [source("second-candidate-source", 2)],
        }),
      ],
    });
    expect(
      refreshedNative.interaction.searchRounds.at(-1)?.stage,
    ).toBe("native-retrieval");
    expect(
      refreshedNative.items
        .filter((item) => ["first-candidate", "second-candidate"].includes(item.id))
        .every((item) => item.preliminaryAssessment === undefined),
    ).toBe(true);

    const forged = clone(completed);
    forged.interaction.searchRounds.at(-1)!.assessmentResults![0]!.status =
      "needs-retry";
    expect(restoreScreen02Session(forged)).toBeNull();
  });

  it("records an honest not-enough-evidence assessment for a source-free lead", () => {
    const opened = createScreen02Session(confirmedFindContext());
    const native = applyScreen02SearchRound(opened, {
      expectedRevision: opened.revision,
      requestType: "find-more",
      stage: "native-retrieval",
      exactRequest: "Retain a source-free reconnaissance lead.",
      retrievedAt: "2026-08-09T12:00:00Z",
      proposals: [findProposal("source-free-candidate")],
    });
    const root = native.interaction.searchRounds.at(-1)!;
    const assessed = applyScreen02PreliminaryAssessmentRound(native, {
      expectedRevision: native.revision,
      exactRequest: "Assess the current evidence honestly.",
      retrievedAt: "2026-08-09T12:01:00Z",
      rootNativeRoundId: root.id,
      assessmentParentRoundId: root.id,
      assessments: [
        {
          itemId: "source-free-candidate",
          judgment: "not-enough-evidence",
          studyFit:
            "The source-free candidate is only a provisional regulation lead inside the broad study boundary.",
          affectedPopulation: null,
          outcomeMechanism: null,
          mainConcern:
            "No attached source currently establishes the event, covered population, or operative requirements.",
          evidenceSourceIds: [],
          nextChecks: [
            "Locate an official event record before evaluating this candidate further.",
          ],
        },
      ],
    });

    expect(
      assessed.interaction.searchRounds.at(-1)?.assessmentResults,
    ).toEqual([
      {
        itemId: "source-free-candidate",
        status: "assessed",
        reason: "The compact preliminary assessment was accepted.",
      },
    ]);
    expect(assessed.items[0]?.preliminaryAssessment).toMatchObject({
      judgment: "not-enough-evidence",
      affectedPopulation: null,
      outcomeMechanism: null,
      evidenceSourceIds: [],
      rootNativeRoundId: root.id,
    });
    expect(restoreScreen02Session(clone(assessed))).not.toBeNull();
  });

  it("rejects malformed, noncanonical, corrupt, and oversized Screen 2 envelopes diagnostically", () => {
    const session = nativeFindSessionWithResult();
    const envelope = encodeScreen02StateEnvelope(session);

    expect(decodeScreen02StateEnvelope(null)).toMatchObject({
      ok: false,
      code: "envelope-absent",
    });
    expect(
      decodeScreen02StateEnvelope({ ...envelope, extra: true }),
    ).toMatchObject({ ok: false, code: "envelope-shape" });
    expect(
      decodeScreen02StateEnvelope({
        ...envelope,
        schemaVersion: "unsupported",
      }),
    ).toMatchObject({ ok: false, code: "envelope-schema" });
    expect(
      decodeScreen02StateEnvelope({ ...envelope, payload: `${envelope.payload}=` }),
    ).toMatchObject({ ok: false, code: "envelope-base64" });
    expect(
      decodeScreen02StateEnvelope({
        ...envelope,
        compressedBytes: envelope.compressedBytes + 1,
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });
    expect(
      decodeScreen02StateEnvelope({
        ...envelope,
        checksum: envelope.checksum.endsWith("0")
          ? `${envelope.checksum.slice(0, -1)}1`
          : `${envelope.checksum.slice(0, -1)}0`,
      }),
    ).toMatchObject({ ok: false, code: "envelope-checksum" });
    expect(
      decodeScreen02StateEnvelope({
        ...envelope,
        payload: "A".repeat(SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS + 1),
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });

    const noncanonicalJson = JSON.stringify(session);
    expect(noncanonicalJson).not.toBe(serializeScreen02Session(session));
    expect(
      decodeScreen02StateEnvelope(envelopeForJson(noncanonicalJson)),
    ).toMatchObject({ ok: false, code: "envelope-noncanonical" });

    const canonicalJson = serializeScreen02Session(session);
    const duplicateKeyJson = `{"revision":0,${canonicalJson.slice(1)}`;
    expect(
      decodeScreen02StateEnvelope(envelopeForJson(duplicateKeyJson)),
    ).toMatchObject({ ok: false, code: "envelope-noncanonical" });

    const compressed = Buffer.from(envelope.payload, "base64url");
    const truncated = compressed.subarray(0, compressed.length - 1);
    const truncatedResult = decodeScreen02StateEnvelope({
      ...envelope,
      compressedBytes: truncated.byteLength,
      payload: truncated.toString("base64url"),
    });
    expect(truncatedResult.ok).toBe(false);
    if (!truncatedResult.ok) {
      expect(["envelope-gzip", "envelope-size"]).toContain(
        truncatedResult.code,
      );
    }

    const plain = new TextEncoder().encode("not a gzip stream");
    expect(
      decodeScreen02StateEnvelope({
        ...envelope,
        uncompressedBytes: plain.byteLength,
        compressedBytes: plain.byteLength,
        payload: Buffer.from(plain).toString("base64url"),
      }),
    ).toMatchObject({ ok: false, code: "envelope-gzip" });

    expect(restoreScreen02StateEnvelope({ ...envelope, payload: "bad!" })).toBeNull();
  });

  it("round-trips Unicode candidate text without normalization or loss", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const unicodeTitle = "中国监管法规 — café — Δοκιμή";
    const session = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Preserve multilingual candidate metadata.",
      retrievedAt: "2026-07-29T11:59:00Z",
      proposals: [
        findProposal("unicode-candidate", {
          title: unicodeTitle,
          description: "多语言 source description with naïve UTF-8 text.",
          sources: [source("unicode-source", 1)],
        }),
      ],
    });

    const restored = restoreScreen02StateEnvelope(
      encodeScreen02StateEnvelope(session),
    );
    expect(restored?.items[0]?.title).toBe(unicodeTitle);
    expect(serializeScreen02Session(restored!)).toBe(
      serializeScreen02Session(session),
    );
  });

  it("rejects a source-rich mutation before valid state can outgrow its transport envelope", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const prior = serializeScreen02Session(initial);
    const input = (sourceCount: number) => ({
      expectedRevision: initial.revision,
      requestType: "user-source" as const,
      exactRequest: "Audit the supplied high-entropy source records.",
      retrievedAt: "2026-08-08T15:00:00.000Z",
      proposals: [
        findProposal("capacity-source-candidate", {
          sources: Array.from({ length: sourceCount }, (_, index) =>
            highEntropySource(index),
          ),
        }),
      ],
    });

    const nearLimit = applyScreen02SearchRound(initial, input(17));
    const nearLimitEnvelope = encodeScreen02StateEnvelope(nearLimit);
    expect(nearLimitEnvelope.compressedBytes).toBeGreaterThan(
      SCREEN_02_MAX_COMPRESSED_STATE_BYTES * 0.9,
    );
    expect(nearLimitEnvelope.compressedBytes).toBeLessThanOrEqual(
      SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
    );

    let capacityError: unknown;
    try {
      applyScreen02SearchRound(initial, input(20));
    } catch (error) {
      capacityError = error;
    }
    expect(capacityError).toBeInstanceOf(Screen02StateCapacityError);
    expect(capacityError).toMatchObject({ code: "compressed-capacity" });
    expect((capacityError as Error).message).toMatch(
      /state-envelope transport limit.*prior valid state was preserved/i,
    );
    expect(serializeScreen02Session(initial)).toBe(prior);
    expect(new TextEncoder().encode(prior).byteLength).toBeLessThan(
      SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
    );
    expect(() => encodeScreen02StateEnvelope(initial)).not.toThrow();
  });

  it("stops a gzip expansion before it can exceed the raw Screen 2 state cap", () => {
    const oversizedRaw = new TextEncoder().encode(
      "x".repeat(SCREEN_02_MAX_CANONICAL_SESSION_BYTES + 1),
    );
    const compressed = gzipSync(oversizedRaw, { level: 6, mtime: 0 });
    const forged = compressed.slice();
    const footer = forged.byteLength - 4;
    forged[footer] = 1;
    forged[footer + 1] = 0;
    forged[footer + 2] = 0;
    forged[footer + 3] = 0;

    expect(
      decodeScreen02StateEnvelope({
        schemaVersion: SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
        encoding: SCREEN_02_STATE_ENVELOPE_ENCODING,
        uncompressedBytes: 1,
        compressedBytes: forged.byteLength,
        checksum: "fnv1a64:0000000000000000",
        payload: Buffer.from(forged).toString("base64url"),
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });
  });

  it("restores a v0.2.2 session without a run id into its deterministic initial run", () => {
    const current = createScreen02Session(confirmedFindContext());
    const legacy = clone(current) as Partial<typeof current>;
    delete legacy.runId;

    const restored = restoreScreen02Session(legacy);

    expect(restored).not.toBeNull();
    expect(restored?.runId).toBe(current.runId);
    expect(restored?.screen01Baseline).toStrictEqual(
      current.screen01Baseline,
    );

    expect(
      restoreScreen02Session({ ...clone(current), runId: null }),
    ).toBeNull();
    expect(
      restoreScreen02Session({ ...clone(current), runId: 42 }),
    ).toBeNull();
  });

  it("is deterministic across repeated session creation", () => {
    const context = confirmedAuditContext();
    expect(
      serializeScreen02Session(createScreen02Session(context)),
    ).toBe(serializeScreen02Session(createScreen02Session(clone(context))));
  });

  it("keeps every unsupported metric null rather than converting unknown to zero", () => {
    const proposal = findProposal("unsupported", {
      assessments: {
        exposureObservability: {
          category: "directly-observable",
          reason: "Caller supplied a rubric category without a source.",
        },
        timeSupport: {
          category: "ample",
          reason: "Caller supplied a rubric category without a source.",
        },
        variation: {
          category: "strong",
          reason: "Caller supplied a rubric category without a source.",
        },
      },
    });
    const assessed = assessScreen02Items(confirmedFindContext(), [
      proposal,
    ]);
    const scorecard = assessed.items[0]?.scorecard;

    expect(scorecard?.components).toEqual({
      scopeFit: null,
      sourceAuthority: null,
      exposureObservability: null,
      timeSupport: null,
      variation: null,
    });
    expect(scorecard?.overall).toBeNull();
    expect(scorecard?.coverage.knownWeight).toBe(0);
    expect(assessed.searchManifest.coverage.status).toBe(
      "reconnaissance",
    );
  });

  it("deduplicates sources and derives authority totals from the six-tier scale", () => {
    expect(Object.keys(SOURCE_AUTHORITY_TIERS)).toHaveLength(6);
    const duplicateWeak = source(
      "duplicate-weak",
      5,
      "https://example.test/rule/#overview",
    );
    const duplicateStrong = source(
      "duplicate-strong",
      1,
      "HTTPS://EXAMPLE.TEST/rule",
    );
    const unique = deduplicateScreen02Sources([
      duplicateWeak,
      duplicateStrong,
    ]);
    const summary = summarizeScreen02Sources([
      duplicateWeak,
      duplicateStrong,
    ]);

    expect(unique).toHaveLength(1);
    expect(unique[0]?.id).toBe("duplicate-strong");
    expect(summary).toMatchObject({
      uniqueSourceCount: 1,
      strongestAuthorityTier: 1,
      authorityScore: 100,
    });
    expect(summary.byAuthorityTier[1]).toBe(1);
    expect(() =>
      deduplicateScreen02Sources([
        source("conflicting-id", 1, "https://example.test/first"),
        source("conflicting-id", 2, "https://example.test/second"),
      ]),
    ).toThrow("Duplicate Screen 2 source id");

    const assessed = assessScreen02Items(confirmedFindContext(), [
      findProposal("dedup-card", {
        sources: [duplicateWeak, duplicateStrong],
        assessments: {
          exposureObservability: {
            category: "observable-with-linkage",
            reason: "The located source defines observable exposure.",
          },
          timeSupport: {
            category: "limited",
            reason: "The located source documents one treatment date.",
          },
          variation: {
            category: "uncertain",
            reason: "The located source supports limited cross-unit variation.",
          },
        },
      }),
    ]);
    expect(assessed.items[0]?.sourceSummary.uniqueSourceCount).toBe(1);
    expect(
      assessed.items[0]?.scorecard.componentDetails.timeSupport
        .method,
    ).toBe("ai-rubric");
    // The source rows establish authority, but contain no source-bound scope
    // facts; the current common qualification contract therefore retains the
    // conservative review-level scope component instead of awarding 100.
    expect(assessed.items[0]?.scorecard.overall).toBe(75.8);
  });

  it("uses fixed versioned weights without reweighting incomplete evidence", () => {
    const components: Screen02ComponentScores = {
      scopeFit: 100,
      sourceAuthority: null,
      exposureObservability: 80,
      timeSupport: null,
      variation: 40,
    };
    const reasons = Object.fromEntries(
      Object.keys(components).map((key) => [
        key,
        components[key as keyof typeof components] === null
          ? "Unknown from current evidence."
          : "Known from current evidence.",
      ]),
    ) as Screen02ComponentReasons;
    const score = scoreScreen02Feasibility(components, reasons);

    expect(score.formulaVersion).toBe("screen-02-feasibility-v2");
    expect(score.overall).toBeNull();
    expect(score.overallRange).toEqual({
      minimum: 50,
      maximum: 90,
    });
    expect(score.coverage).toMatchObject({
      knownComponents: 3,
      totalComponents: 5,
      knownWeight: 0.6,
      knownWeightPercent: 60,
    });
    expect(score.reason).toContain("without silently reweighting");

    const knownZero = scoreScreen02Feasibility(
      {
        scopeFit: null,
        sourceAuthority: null,
        exposureObservability: null,
        timeSupport: null,
        variation: 0,
      },
      {
        scopeFit: "Unknown.",
        sourceAuthority: "Unknown.",
        exposureObservability: "Unknown.",
        timeSupport: "Unknown.",
        variation: "Known absence of useful variation.",
      },
    );
    expect(knownZero.overall).toBeNull();
    expect(knownZero.overallRange).toEqual({
      minimum: 0,
      maximum: 90,
    });
    expect(knownZero.coverage.knownComponents).toBe(1);
  });

  it("maps AI rubric categories deterministically and rejects unexplained AI numbers", () => {
    const unstructuredAiNumber = findProposal("ai-number", {
      sources: [source("ai-number-source", 2)],
      assessments: {
        exposureObservability: {
          value: 78,
          reason: "A model supplied a direct number.",
        },
      },
    });
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [
        unstructuredAiNumber,
      ]),
    ).toThrow("AI assessments must use a published rubric category");

    const categorized = assessScreen02Items(confirmedFindContext(), [
      findProposal("ai-category", {
        sources: [source("ai-category-source", 2)],
        assessments: {
          exposureObservability: {
            category: "observable-with-linkage",
            reason:
              "The evidence appears linkable to the confirmed unit under the published rubric.",
          },
        },
      }),
    ]);
    expect(
      categorized.items[0]?.scorecard.components
        .exposureObservability,
    ).toBe(80);
    expect(
      categorized.items[0]?.scorecard.componentDetails
        .exposureObservability.method,
    ).toBe("ai-rubric");
  });

  it("applies all four Find hard filters before ranking and logs exclusions", () => {
    const assessed = assessScreen02Items(confirmedFindContext(), [
      findProposal("matching", {
        sources: [
          findEvidenceSource(
            "matching",
            "Issuing jurisdiction: United States. The rule applies to U.S. exchange-listed manufacturing firms. Effective date: 2019-07-01",
          ),
        ],
      }),
      findProposal("wrong-boundary", {
        provisionalDates: ["Incident began: 2030-01-01"],
        sources: [
          findEvidenceSource(
            "wrong-boundary",
            "Issuing jurisdiction: Northern Europe. Incident began: 2030-01-01. Affected population: Shipping firms.",
            "occurred on 2030-01-01",
          ),
        ],
        event: {
          displayName: "Wrong-boundary event",
          eventDate: "2030-01-01",
          eventFamily: "Disaster",
          geographies: ["Northern Europe"],
          populations: ["Shipping firms"],
        },
      }),
      findProposal("qualifier-loss", {
        sources: [
          findEvidenceSource("qualifier-loss", "Effective date: 2019-07-01"),
        ],
        event: {
          displayName: "Broader manufacturing event",
          eventDate: "2019-07-01",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: ["Manufacturing firms"],
        },
      }),
      findProposal("deregulation", {
        event: {
          displayName: "Deregulation event",
          eventDate: "2019-07-01",
          eventFamily: "Deregulation",
          geographies: ["United States"],
          populations: [
            "U.S. exchange-listed manufacturing firms",
          ],
        },
      }),
    ]);

    expect(assessed.items.map((item) => item.id)).toEqual([
      "matching",
      "qualifier-loss",
    ]);
    expect(assessed.items[0]?.hardFilters).toHaveLength(4);
    expect(
      assessed.items[0]?.hardFilters.every(
        (filter) => filter.status === "pass",
      ),
      JSON.stringify(assessed.items[0]?.hardFilters),
    ).toBe(true);
    expect(
      new Set(
        assessed.searchManifest.exclusions.map((entry) => entry.filter),
      ),
    ).toEqual(
      new Set(["geography", "studyPeriod", "eventFamily"]),
    );
    expect(
      assessed.items
        .find((item) => item.id === "qualifier-loss")
        ?.hardFilters.find((filter) => filter.key === "population"),
    ).toMatchObject({
      status: "review",
    });
    expect(
      assessed.searchManifest.exclusions.some(
        (entry) => entry.proposalId === "qualifier-loss",
      ),
    ).toBe(false);
    expect(
      assessed.searchManifest.exclusions.find(
        (entry) =>
          entry.proposalId === "deregulation" &&
          entry.filter === "eventFamily",
      )?.reason,
    ).toContain("does not match");
  });

  it.each([
    "Adopted: 2021-01-01",
    "Enacted: 2021-01-01",
    "Enforcement begins: 2021-01-01",
    "Effective date: 2021-01-01",
    "Entry into force: 2021-01-01",
    "Application begins: 2021-01-01",
    "Implementation begins: 2021-01-01",
    "Amendment effective: 2021-01-01",
    "Phase 1 begins: 2021-01-01",
    "Declaration date: 2021-01-01",
    "Incident began: 2021-01-01",
    "Landfall: 2021-01-01",
    "GDACS event start: 2021-01-01",
    "USGS event date: 2021-01-01",
  ])(
    "uses the labeled material date for study-period compatibility: %s",
    (provisionalDate) => {
      const baseContext = confirmedFindContext();
      const context = {
        ...baseContext,
        scopeContract: {
          ...baseContext.scopeContract,
          studyPeriod: "2020–2022",
        },
      };
      const filters = evaluateFindHardFilters(
        findProposal(`material-date-${provisionalDate}`, {
          provisionalDates: [provisionalDate],
          sources: [
            findEvidenceSource(
              `material-date-${provisionalDate}`,
              provisionalDate,
            ),
          ],
          event: {
            displayName: "Earlier publication with in-period treatment",
            eventDate: "2018-01-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: ["U.S. exchange-listed manufacturing firms"],
          },
        }),
        context,
      );

      expect(
        filters.find((filter) => filter.key === "studyPeriod"),
      ).toMatchObject({
        status: "pass",
        reason: expect.stringMatching(/labeled material event date/i),
      });
    },
  );

  it.each([
    "Regulation (EC) No 45/2001 and other Union legal acts applicable to such processing of personal data shall be adapted to the principles and rules of this Regulation in accordance with Article 98.",
    "Directive 2000/31/EC establishes applicable intermediary obligations.",
    "Decision (EU) 2020/1234 establishes applicable conditions.",
    "Act No. 17/2019 establishes applicable conditions.",
  ])("does not convert a formal instrument identifier into treatment timing: %s", (text) => {
    const proposal = findProposal("identifier-timing", {
      sources: [findEvidenceSource("identifier-timing", text)],
    });
    expect(screen02MaterialTimingFacts(proposal)).toEqual([]);
  });

  it.each([
    [
      "Regulation (EC) No 45/2001",
      "Regulation (EC) No 45/2001 shall apply from 25 May 2018.",
    ],
    [
      "Directive 2000/31/EC",
      "Directive 2000/31/EC became effective on 2018-05-25.",
    ],
    [
      "Decision (EU) 2020/1234",
      "Decision (EU) 2020/1234 was enacted on 25/05/2018.",
    ],
    [
      "Act No. 17/2019",
      "Act No. 17/2019 became effective in 2018.",
    ],
  ])("retains actual transition dates beside a formal identifier: %s", (title, text) => {
    const proposal = findProposal("calendar-timing", {
      title,
      event: {
        displayName: title,
        eventDate: "2019-07-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: ["U.S. exchange-listed manufacturing firms"],
      },
      sources: [{
        ...source("calendar-timing-source", 1),
        evidenceText: text,
      }],
    });
    expect(screen02MaterialTimingFacts(proposal).map((fact) => fact.year)).toEqual([2018]);
  });

  it("rejects a candidate whose labeled treatment begins after the study period", () => {
    const baseContext = confirmedFindContext();
    const context = {
      ...baseContext,
      scopeContract: {
        ...baseContext.scopeContract,
        studyPeriod: "2020–2022",
      },
    };
    const filters = evaluateFindHardFilters(
      findProposal("post-period-treatment", {
        provisionalDates: ["Effective date: 2025-01-01"],
        sources: [
          findEvidenceSource(
            "post-period-treatment",
            "Effective date: 2025-01-01",
          ),
        ],
        event: {
          displayName: "Published before a later treatment",
          eventDate: "2021-01-01",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: ["U.S. exchange-listed manufacturing firms"],
        },
      }),
      context,
    );

    expect(
      filters.find((filter) => filter.key === "studyPeriod"),
    ).toMatchObject({
      status: "fail",
      reason: expect.stringMatching(/begins after the confirmed period/i),
    });
  });

  it.each([
    "Publication date: 2021-01-01",
    "Document date: 2021-01-01",
    "The rule remained in force as of 2021-01-01",
    "The law continued to be effective through 2021-12-31",
    "No effective date was established in 2021",
    "The effective date was not established in 2021",
  ])(
    "does not treat documentary or continued-force timing as a material shock: %s",
    (dateLead) => {
      const baseContext = confirmedFindContext();
      const context = {
        ...baseContext,
        scopeContract: {
          ...baseContext.scopeContract,
          studyPeriod: "2020–2022",
        },
      };
      const filters = evaluateFindHardFilters(
        findProposal(`nonmaterial-date-${dateLead.split(":", 1)[0]}`, {
          provisionalDates: [dateLead],
          sources: [
            findEvidenceSource(
              `nonmaterial-date-${dateLead.split(":", 1)[0]}`,
              dateLead,
            ),
          ],
          event: {
            displayName: "Documentary timing only",
            eventDate: "2021-01-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: ["U.S. exchange-listed manufacturing firms"],
          },
        }),
        context,
      );

      expect(
        filters.find((filter) => filter.key === "studyPeriod"),
      ).toMatchObject({
        status: "review",
        reason: expect.stringMatching(/publication dates and continued-force/i),
      });
    },
  );

  it("binds each material date to its local clause instead of borrowing an in-period publication year", () => {
    const baseContext = confirmedFindContext();
    const context = {
      ...baseContext,
      scopeContract: {
        ...baseContext.scopeContract,
        studyPeriod: "2020–2022",
      },
    };
    const outside = evaluateFindHardFilters(
      findProposal("mixed-publication-effective-outside", {
        provisionalDates: [
          "Publication date: 2021-01-01; Effective date: 2025-01-01",
        ],
        sources: [
          findEvidenceSource(
            "mixed-publication-effective-outside",
            "Publication date: 2021-01-01; Effective date: 2025-01-01",
          ),
        ],
      }),
      context,
    );
    const inside = evaluateFindHardFilters(
      findProposal("mixed-publication-effective-inside", {
        provisionalDates: [
          "Publication date: 2018-01-01; Effective date: 2021-01-01",
        ],
        sources: [
          findEvidenceSource(
            "mixed-publication-effective-inside",
            "Publication date: 2018-01-01; Effective date: 2021-01-01",
          ),
        ],
      }),
      context,
    );

    expect(outside.find((filter) => filter.key === "studyPeriod")?.status).toBe(
      "fail",
    );
    expect(inside.find((filter) => filter.key === "studyPeriod")?.status).toBe(
      "pass",
    );
  });

  it.each([
    [
      "Chinese public firms",
      "China",
      "public companies in China",
      "China",
    ],
    [
      "Chinese public firms",
      "China",
      "Public companies",
      "China",
    ],
    [
      "public companies in China",
      "China",
      "Chinese public firms",
      "China",
    ],
    [
      "Thai private firms",
      "Thailand",
      "private companies in Thailand",
      "Thailand",
    ],
    [
      "private companies in Thailand",
      "Thailand",
      "Thai private firms",
      "Thailand",
    ],
    [
      "UK public firms",
      "United Kingdom",
      "public companies in the United Kingdom",
      "United Kingdom",
    ],
  ])(
    "matches equivalent non-U.S. population wording without rewriting Screen 1: %s",
    (population, geography, candidatePopulation, candidateGeography) => {
      const context = {
        ...confirmedFindContext(),
        scopeContract: {
          ...confirmedFindContext().scopeContract,
          population,
          geography,
        },
      };
      const before = serializeScreen01StudyContext(context);
      const filters = evaluateFindHardFilters(
        findProposal(`equivalent-${geography}`, {
          event: {
            displayName: `Equivalent ${geography} event`,
            eventDate: "2019-07-01",
            eventFamily: "Regulation",
            geographies: [candidateGeography],
            populations: [candidatePopulation],
          },
        }),
        context,
      );

      expect(
        filters.find((filter) => filter.key === "geography")?.status,
      ).toBe("pass");
      expect(
        filters.find((filter) => filter.key === "population")?.status,
      ).toBe("pass");
      expect(serializeScreen01StudyContext(context)).toBe(before);
    },
  );

  it("treats a confirmed worldwide geography as inclusive of country-specific events", () => {
    const context = {
      ...confirmedFindContext(),
      scopeContract: {
        ...confirmedFindContext().scopeContract,
        population: "Public firms worldwide",
        geography: "Worldwide",
      },
    };
    const filters = evaluateFindHardFilters(
      findProposal("worldwide-thailand-event", {
        event: {
          displayName: "Thailand earthquake",
          eventDate: "2019-07-01",
          eventFamily: "Regulation",
          geographies: ["Thailand"],
          populations: ["Public firms worldwide"],
        },
      }),
      context,
    );

    expect(
      filters.find((filter) => filter.key === "geography")?.status,
    ).toBe("pass");
    expect(
      filters.find((filter) => filter.key === "population")?.status,
    ).toBe("pass");
  });

  it("preserves non-Latin boundaries and rejects an unrelated U.S. candidate", () => {
    const context = {
      ...confirmedFindContext(),
      scopeContract: {
        ...confirmedFindContext().scopeContract,
        population: "中国上市公司",
        geography: "中国",
        eventFamily: "监管法规",
      },
    };
    const matching = evaluateFindHardFilters(
      findProposal("matching-chinese-script", {
        event: {
          displayName: "中国监管法规",
          eventDate: "2019-07-01",
          eventFamily: "监管法规",
          geographies: ["China"],
          populations: ["中国上市公司"],
        },
      }),
      context,
    );
    expect(
      matching
        .filter((filter) => filter.key !== "studyPeriod")
        .every((filter) => filter.status === "pass"),
    ).toBe(true);

    const unrelated = evaluateFindHardFilters(
      findProposal("unrelated-us-regulation"),
      context,
    );
    expect(
      Object.fromEntries(
        unrelated.map((filter) => [filter.key, filter.status]),
      ),
    ).toMatchObject({
      geography: "fail",
      population: "review",
      eventFamily: "fail",
    });

    const thaiContext = {
      ...confirmedFindContext(),
      scopeContract: {
        ...confirmedFindContext().scopeContract,
        population: "Thai public firms",
        geography: "ไทย",
      },
    };
    const thai = evaluateFindHardFilters(
      findProposal("thai-country-alias", {
        event: {
          displayName: "Thailand flood",
          eventDate: "2019-07-01",
          eventFamily: "Regulation",
          geographies: ["Thailand"],
          populations: ["Thai public firms"],
        },
      }),
      thaiContext,
    );
    expect(
      thai.find((filter) => filter.key === "geography")?.status,
    ).toBe("pass");
  });

  it("keeps connector-echoed population applicability at review rather than pass", () => {
    const unverified = evaluateFindHardFilters(
      findProposal("connector-population-unknown", {
        event: {
          displayName: "Connector discovery lead",
          eventDate: "2019-07-01",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: [
            "U.S. exchange-listed manufacturing firms (potential applicability only; coverage unverified)",
          ],
        },
      }),
      confirmedFindContext(),
    );
    expect(
      unverified.find((filter) => filter.key === "population"),
    ).toMatchObject({
      status: "review",
      reason: expect.stringMatching(/applicability as unverified/i),
    });

    const documented = evaluateFindHardFilters(
      findProposal("documented-population-match"),
      confirmedFindContext(),
    );
    expect(
      documented.find((filter) => filter.key === "population")
        ?.status,
    ).toBe("pass");
  });

  it.each([
    "This rule does not apply to U.S. exchange-listed manufacturing firms",
    "U.S. exchange-listed manufacturing firms are not covered",
    "No U.S. exchange-listed manufacturing firms are covered",
  ])(
    "fails a hard population boundary stated as a negation: %s",
    (candidatePopulation) => {
      const filters = evaluateFindHardFilters(
        findProposal(`negated-population-${candidatePopulation}`, {
          event: {
            displayName: "Population exclusion",
            eventDate: "2019-07-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [candidatePopulation],
          },
        }),
        confirmedFindContext(),
      );

      expect(
        filters.find((filter) => filter.key === "population")?.status,
      ).toBe("fail");
    },
  );

  it("resolves provisional population only from an authoritative sentence naming organizational units", () => {
    const candidate = findProposal("source-described-manufacturers", {
      title: "Manufacturing Facility Product-Safety Rule",
      description:
        "Rule published in the Federal Register on 2019-03-15. The final rule requires public manufacturing firms and covered manufacturers to change product-safety controls. Applicability to the requested organizational population is provisional.",
      event: {
        displayName: "Manufacturing Facility Product-Safety Rule",
        eventDate: "2019-03-15",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      sources: [{
        ...source("source-described-manufacturers", 2),
        title: "Manufacturing Facility Product-Safety Rule",
        evidenceText:
          "Manufacturing Facility Product-Safety Rule. The final rule requires public manufacturing firms and covered manufacturers to change product-safety controls.",
      }],
    });

    expect(
      sourceResolvesFindHardFilterReview(
        candidate,
        confirmedFindContext(),
        "population",
      ),
    ).toBe(true);
    expect(
      evaluateFindHardFilters(candidate, confirmedFindContext()).find(
        (filter) => filter.key === "population",
      )?.status,
    ).toBe("review");
  });

  it("does not borrow timing, geography, disaster, or population facts from unrelated retained source text", () => {
    const candidate = findProposal("unrelated-retained-evidence", {
      title: "Proposed Manufacturing Emergency Rule",
      description:
        "The proposed candidate claims a manufacturing emergency took effect in 2021.",
      event: {
        displayName: "Proposed Manufacturing Emergency Rule",
        eventDate: "2021-01-01",
        eventFamily: "Disaster",
        geographies: ["European Union"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      requiredVariables: ["Organization-to-event location linkage"],
      sources: [{
        ...source("unrelated-retained-evidence", 1),
        // Matching source-title metadata cannot bind this different record's
        // substantive facts to the proposed candidate identity.
        title: "Proposed Manufacturing Emergency Rule",
        evidenceText:
          "Different Flood Declaration. The flood occurred in the European Union and affected manufacturers. Declaration date: 2021-01-01.",
      }],
    });
    const filters = evaluateFindHardFilters(candidate, {
      ...confirmedFindContext(),
      scopeContract: {
        ...confirmedFindContext().scopeContract,
        eventFamily: "Disaster",
        studyPeriod: "2020–2022",
      },
    });

    expect(filters.find((filter) => filter.key === "studyPeriod")?.status)
      .toBe("review");
    expect(filters.find((filter) => filter.key === "geography")?.status)
      .toBe("review");
    expect(filters.find((filter) => filter.key === "population")?.status)
      .toBe("review");
    expect(sourceResolvesFindHardFilterReview(
      candidate,
      confirmedFindContext(),
      "geography",
    )).toBe(false);
    expect(sourceResolvesFindHardFilterReview(
      candidate,
      confirmedFindContext(),
      "population",
    )).toBe(false);
  });

  it("requires a source-grounded disaster surface and keeps the organization join provisional", () => {
    const baseContext = confirmedFindContext();
    const context = {
      ...baseContext,
      scopeContract: {
        ...baseContext.scopeContract,
        population: "Thai publicly listed firms",
        geography: "Thailand",
        studyPeriod: "2020–2024",
        eventFamily: "Earthquake disaster",
      },
    };
    const base = findProposal("northern-thailand-earthquake", {
      title: "Northern Thailand Earthquake",
      event: {
        displayName: "Northern Thailand Earthquake",
        eventDate: "2024-08-10",
        eventFamily: "Earthquake disaster",
        geographies: ["Thailand"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      provisionalDates: ["GDACS event start: 2024-08-10"],
      requiredVariables: [],
      sources: [{
        ...source("northern-thailand-earthquake", 3),
        evidenceText:
          "Northern Thailand Earthquake was recorded beginning 2024-08-10. Countries reported: Thailand.",
      }],
    });
    const withUngroundedVariable = {
      ...base,
      requiredVariables: ["Organization-to-event location linkage"],
    };
    const withGroundedSurface = {
      ...base,
      requiredVariables: [
        "Hazard-footprint coordinates",
        "Organization-to-event-footprint location linkage",
      ],
      sources: [{
        ...source("northern-thailand-earthquake", 3),
        evidenceText:
          "Northern Thailand Earthquake was recorded beginning 2024-08-10; Hazard-footprint coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
      }],
    };
    const withGroundedEventPoint = {
      ...base,
      requiredVariables: [
        "Event point coordinates",
        "Hazard footprint or intensity",
        "Organization-to-event-footprint location linkage",
      ],
      sources: [{
        ...source("northern-thailand-earthquake", 3),
        evidenceText:
          "Northern Thailand Earthquake was recorded beginning 2024-08-10; Event point coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
      }],
    };

    expect(sourceResolvesFindHardFilterReview(base, context, "population"))
      .toBe(false);
    expect(sourceResolvesFindHardFilterReview(
      withUngroundedVariable,
      context,
      "population",
    )).toBe(false);
    expect(sourceResolvesFindHardFilterReview(
      withGroundedSurface,
      context,
      "population",
    )).toBe(true);
    expect(sourceResolvesFindHardFilterReview(
      withGroundedEventPoint,
      context,
      "population",
    )).toBe(true);
    for (const negatedOccurrence of [
      "Northern Thailand Earthquake was not recorded beginning 2024-08-10; Hazard-footprint coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
      "No Northern Thailand earthquake occurred beginning 2024-08-10; Hazard-footprint coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
    ]) {
      expect(sourceResolvesFindHardFilterReview(
        {
          ...withGroundedSurface,
          sources: [{
            ...withGroundedSurface.sources[0]!,
            evidenceText: negatedOccurrence,
          }],
        },
        context,
        "population",
      )).toBe(false);
    }
    for (const unsupportedOccurrence of [
      "Northern Thailand Earthquake failed to occur beginning 2024-08-10; Event point coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
      "Northern Thailand Earthquake was falsely reported as occurring beginning 2024-08-10; Event point coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
      "Northern Thailand Earthquake; Event point coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand.",
    ]) {
      expect(sourceResolvesFindHardFilterReview(
        {
          ...withGroundedEventPoint,
          sources: [{
            ...withGroundedEventPoint.sources[0]!,
            evidenceText: unsupportedOccurrence,
          }],
        },
        context,
        "population",
      )).toBe(false);
    }
    expect(evaluateFindHardFilters(base, context).find(
      (filter) => filter.key === "population",
    )).toEqual(evaluateFindHardFilters(withUngroundedVariable, context).find(
      (filter) => filter.key === "population",
    ));
  });

  it.each([
    "The final rule requires banks that finance manufacturing firms to revise lending disclosures.",
    "The final rule requires financial companies that serve manufacturing firms to revise lending disclosures.",
  ])(
    "does not infer regulated manufacturing population from a contextual mention: %s",
    (description) => {
      const baseContext = confirmedFindContext();
      const context = {
        ...baseContext,
        scopeContract: {
          ...baseContext.scopeContract,
          population: "Manufacturing firms",
        },
      };
      const candidate = findProposal("banks-financing-manufacturers", {
        description:
          `${description} Applicability to the requested organizational population is provisional.`,
        event: {
          displayName: "Bank lending disclosure rule",
          eventDate: "2019-03-15",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
        },
        affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
        sources: [source("banks-financing-manufacturers", 2)],
      });

      expect(
        sourceResolvesFindHardFilterReview(candidate, context, "population"),
      ).toBe(false);
    },
  );

  it.each([
    ["Public firms", "Public banks and depository institutions"],
    ["Public firms", "Public electric utilities and power producers"],
    ["Public firms", "Public manufacturers"],
    ["Private firms", "Private banks"],
    ["Private firms", "Private utilities"],
    ["Private firms", "Private manufacturers"],
  ])(
    "resolves a generic ownership-qualified organizational scope from %s to %s",
    (requiredPopulation, candidatePopulation) => {
      const baseContext = confirmedFindContext();
      const context = {
        ...baseContext,
        scopeContract: {
          ...baseContext.scopeContract,
          population: requiredPopulation,
        },
      };
      const candidate = findProposal(`owned-${candidatePopulation}`, {
        title: "Ownership-qualified organizational rule",
        affectedPopulation: candidatePopulation,
        event: {
          displayName: "Ownership-qualified organizational rule",
          eventDate: "2019-03-15",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: [candidatePopulation],
        },
        sources: [{
          ...source(`owned-${candidatePopulation}`, 2),
          title: "Ownership-qualified organizational rule",
          evidenceText:
            `Ownership-qualified organizational rule. The final ownership-qualified organizational rule requires ${candidatePopulation} to change organization-level reporting.`,
        }],
      });

      expect(
        sourceResolvesFindHardFilterReview(candidate, context, "population"),
      ).toBe(true);
    },
  );

  it.each([
    ["Public firms", "Private banks"],
    ["Private firms", "Public electric utilities"],
    ["Public firms", "Private manufacturers"],
  ])(
    "does not resolve conflicting ownership from %s to %s",
    (requiredPopulation, candidatePopulation) => {
      const baseContext = confirmedFindContext();
      const context = {
        ...baseContext,
        scopeContract: {
          ...baseContext.scopeContract,
          population: requiredPopulation,
        },
      };
      const candidate = findProposal(`ownership-conflict-${candidatePopulation}`, {
        affectedPopulation: candidatePopulation,
        event: {
          displayName: "Ownership-conflicting organizational rule",
          eventDate: "2019-03-15",
          eventFamily: "Regulation",
          geographies: ["United States"],
          populations: [candidatePopulation],
        },
        sources: [source(`ownership-conflict-${candidatePopulation}`, 2)],
      });

      expect(
        sourceResolvesFindHardFilterReview(candidate, context, "population"),
      ).toBe(false);
    },
  );

  it("does not infer population from connector boilerplate, a generic title, or wildlife managers", () => {
    const base = {
      event: {
        displayName: "Generic Manufacturing Rule",
        eventDate: "2019-03-15",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      sources: [source("population-negative", 2)],
    };
    const boilerplate = findProposal("population-boilerplate", {
      ...base,
      title: "Generic Manufacturing Firms Rule",
      description:
        "Rule published in the Federal Register on 2019-03-15. Applicability to the requested organizational population is provisional.",
    });
    const wildlife = findProposal("population-wildlife", {
      ...base,
      title: "Manufacturing Wildlife Habitat Rule",
      description:
        "The rule requires wildlife refuge managers to change habitat conservation plans beginning in 2019.",
    });

    for (const candidate of [boilerplate, wildlife]) {
      expect(
        sourceResolvesFindHardFilterReview(
          candidate,
          confirmedFindContext(),
          "population",
        ),
      ).toBe(false);
      expect(
        evaluateFindHardFilters(candidate, confirmedFindContext()).find(
          (filter) => filter.key === "population",
        )?.status,
      ).toBe("review");
    }
  });

  it("does not use a population sentence to excuse unsupported cross-jurisdiction scope", () => {
    const candidate = findProposal("unsupported-foreign-manufacturing", {
      title: "Foreign Manufacturing Rule",
      description:
        "The rule requires public manufacturing firms and covered manufacturers to change product-safety controls.",
      event: {
        displayName: "Foreign Manufacturing Rule",
        eventDate: "2019-03-15",
        eventFamily: "Regulation",
        geographies: ["European Union"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      sources: [{
        ...source("unsupported-foreign-manufacturing", 1),
        title: "Foreign Manufacturing Rule",
        evidenceText:
          "Foreign Manufacturing Rule. Issuing jurisdiction: European Union. The rule requires public manufacturing firms and covered manufacturers to change product-safety controls.",
      }],
    });
    const filters = evaluateFindHardFilters(
      candidate,
      confirmedFindContext(),
    );

    expect(
      sourceResolvesFindHardFilterReview(
        candidate,
        confirmedFindContext(),
        "population",
      ),
    ).toBe(true);
    expect(
      sourceResolvesFindHardFilterReview(
        candidate,
        confirmedFindContext(),
        "geography",
      ),
    ).toBe(false);
    expect(filters.find((filter) => filter.key === "geography")?.status).toBe(
      "fail",
    );
  });

  it.each([
    ["Chinese private firms", "China", "fail"],
    ["public relations companies in China", "China", "review"],
    ["Chinese firms", "China", "review"],
    ["Thai public firms", "Thailand", "review"],
    ["non-public firms in China", "China", "fail"],
    ["non-Chinese public firms", "China", "fail"],
    ["public firms outside China", "China", "fail"],
  ])(
    "does not pass a materially different population boundary: %s",
    (candidatePopulation, candidateGeography, expectedStatus) => {
      const context = {
        ...confirmedFindContext(),
        scopeContract: {
          ...confirmedFindContext().scopeContract,
          population: "Chinese public firms",
          geography: "China",
        },
      };
      const filters = evaluateFindHardFilters(
        findProposal(`different-${candidateGeography}`, {
          event: {
            displayName: `Different ${candidateGeography} event`,
            eventDate: "2019-07-01",
            eventFamily: "Regulation",
            geographies: [candidateGeography],
            populations: [candidatePopulation],
          },
        }),
        context,
      );

      expect(
        filters.find((filter) => filter.key === "population")?.status,
      ).toBe(expectedStatus);
      if (expectedStatus === "fail") {
        const assessed = assessScreen02Items(
          confirmedChinesePublicContext(),
          [
          findProposal(`excluded-${candidateGeography}`, {
            event: {
              displayName: `Excluded ${candidateGeography} event`,
              eventDate: "2019-07-01",
              eventFamily: "Regulation",
              geographies: [candidateGeography],
              populations: [candidatePopulation],
            },
          }),
          ],
        );
        expect(assessed.items).toHaveLength(0);
        expect(
          assessed.searchManifest.exclusions.some(
            (entry) => entry.filter === "population",
          ),
        ).toBe(true);
      }
      if (candidateGeography === "Thailand") {
        expect(
          filters.find((filter) => filter.key === "geography")?.status,
        ).toBe("fail");
      }
    },
  );

  it("keeps an Audit representation visible with explicit review or fail reasons", () => {
    const proposal = auditProposal({
      hardFilterEvidence: {
        geography: {
          key: "geography",
          status: "fail",
          reason:
            "The source describes coverage outside the confirmed geography.",
        },
      },
    });
    const assessed = assessScreen02Items(confirmedAuditContext(), [
      proposal,
    ]);
    const item = assessed.items[0];

    expect(item).toBeDefined();
    expect(item?.kind).toBe("representation");
    if (item?.kind !== "representation") return;
    expect(item.anchorShock).toBe("California Consumer Privacy Act");
    expect(
      item.hardFilters.find((filter) => filter.key === "geography"),
    ).toMatchObject({ status: "fail" });
    expect(
      item.hardFilters.filter((filter) => filter.status === "review"),
    ).toHaveLength(3);
    expect(item.scorecard.components.scopeFit).toBe(0);
    expect(item.likelyServiceLevel).toBe("stop");

    const initial = createScreen02Session(confirmedAuditContext());
    const restored = restoreScreen02Session(applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "user-source",
      exactRequest: "Assess the source-backed representation.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [proposal],
    }));
    expect(
      restored?.items.some(
        (entry) => entry.scorecard.components.scopeFit === 0,
      ),
    ).toBe(true);
  });

  it("records an honest no-results manifest without inspecting outcomes", () => {
    const assessed = assessScreen02Items(confirmedFindContext(), []);

    expect(assessed.items).toEqual([]);
    expect(assessed.searchManifest.queryMatrix.length).toBeGreaterThan(0);
    expect(assessed.searchManifest.channels.length).toBeGreaterThan(0);
    expect(assessed.searchManifest.hardFilters.map((entry) => entry.key)).toEqual(
      ["geography", "studyPeriod", "population", "eventFamily"],
    );
    expect(assessed.searchManifest.exclusions).toEqual([]);
    expect(assessed.searchManifest.stoppingRule.status).toBe(
      "not-started",
    );
    expect(assessed.searchManifest.coverage).toMatchObject({
      status: "no-results",
      proposalsReceived: 0,
      itemsRetained: 0,
      uniqueSourcesLocated: 0,
    });
    expect(assessed.searchManifest.coverage.reason).toContain(
      "not evidence that no feasible shock exists",
    );
    expect(assessed.searchManifest.outcomeValuesInspected).toBe(false);
  });

  it("rejects caller-supplied derived totals and unbounded proposal lists", () => {
    const proposal = {
      ...findProposal("derived-total"),
      sourceSummary: { uniqueSourceCount: 999 },
    };
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [
        proposal as Screen02FindProposal,
      ]),
    ).toThrow("is derived");

    const tooMany = Array.from({ length: 41 }, (_, index) =>
      findProposal(`proposal-${index}`),
    );
    expect(() =>
      assessScreen02Items(confirmedFindContext(), tooMany),
    ).toThrow("at most 40");
  });

  it("rejects unknown fields at every direct core proposal boundary", () => {
    const extraProposal = {
      ...findProposal("extra-proposal"),
      injected: "must not be silently stripped",
    } as Screen02FindProposal;
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [extraProposal]),
    ).toThrow("proposals[0].injected is not a recognized Screen 2 field");

    const extraEvent = findProposal("extra-event", {
      event: {
        ...findProposal("event-source").event,
        injected: "must not be silently stripped",
      } as Screen02FindProposal["event"],
    });
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [extraEvent]),
    ).toThrow("proposals[0].event.injected is not a recognized Screen 2 field");

    const extraAssessment = findProposal("extra-assessment", {
      assessments: {
        exposureObservability: {
          category: "observable-with-linkage",
          reason: "A source-backed assessment.",
          injected: "must not be silently stripped",
        } as Screen02AssessmentInput,
      },
    });
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [extraAssessment]),
    ).toThrow(
      "proposals[0].assessments.exposureObservability.injected is not a recognized Screen 2 field",
    );
  });

  it("restores only integrity-valid sessions and preserves selection", () => {
    const context = confirmedAuditContext();
    const searched = auditSessionWithIdentityMatch();
    const selected = selectScreen02Item(
      searched,
      "audit-ccpa-event-match",
    );
    const validClone = clone(selected);
    expect(restoreScreen02Session(validClone)?.selectedItemId).toBe(
      "audit-ccpa-event-match",
    );

    const badFingerprint = clone(selected);
    badFingerprint.screen01Fingerprint = "fnv1a64:0000000000000000";
    expect(restoreScreen02Session(badFingerprint)).toBeNull();

    const badAnchor = clone(selected);
    const representation = badAnchor.items[0];
    if (representation?.kind === "representation") {
      representation.anchorShock = "A different shock";
    }
    expect(restoreScreen02Session(badAnchor)).toBeNull();

    const badSelection = clone(selected);
    badSelection.selectedItemId = "missing-item";
    expect(restoreScreen02Session(badSelection)).toBeNull();

    const badEvidenceStatus = clone(selected);
    badEvidenceStatus.items[0]!.evidenceStatus = "assessed";
    expect(restoreScreen02Session(badEvidenceStatus)).toBeNull();

    const badServiceLevel = clone(selected);
    badServiceLevel.items[0]!.likelyServiceLevel = "full-audit";
    expect(restoreScreen02Session(badServiceLevel)).toBeNull();

    const badRanks = clone(selected);
    badRanks.items[0]!.rank = 2;
    expect(restoreScreen02Session(badRanks)).toBeNull();

    const badCoverageReason = clone(selected);
    badCoverageReason.searchManifest.coverage.reason =
      "A contradictory coverage explanation.";
    expect(restoreScreen02Session(badCoverageReason)).toBeNull();

    const badSourceTotal = clone(selected);
    badSourceTotal.items[0]!.sourceSummary.uniqueSourceCount = 99;
    expect(restoreScreen02Session(badSourceTotal)).toBeNull();

    const extraSessionField = clone(selected) as typeof selected & {
      injected?: string;
    };
    extraSessionField.injected = "Unrecognized session field";
    expect(restoreScreen02Session(extraSessionField)).toBeNull();

    const extraNestedItem = clone(selected) as typeof selected & {
      items: Array<
        (typeof selected.items)[number] & {
          outcomeLink: { injected?: string };
        }
      >;
    };
    extraNestedItem.items[0]!.outcomeLink.injected =
      "Unrecognized model-context field";
    expect(restoreScreen02Session(extraNestedItem)).toBeNull();

    const extraCoverage = clone(selected) as typeof selected & {
      searchManifest: typeof selected.searchManifest & {
        coverage: typeof selected.searchManifest.coverage & {
          injected?: string;
        };
      };
    };
    extraCoverage.searchManifest.coverage.injected =
      "Unrecognized coverage field";
    expect(restoreScreen02Session(extraCoverage)).toBeNull();

    const initialAudit = createScreen02Session(context);
    const sourced = restoreScreen02Session(
      applyScreen02SearchRound(initialAudit, {
        expectedRevision: initialAudit.revision,
        requestType: "user-source",
        exactRequest: "Assess this source-backed representation.",
        retrievedAt: "2026-07-29T12:00:00Z",
        proposals: [auditProposal()],
      }),
    );
    expect(sourced).not.toBeNull();

    const badAuthority = clone(sourced!);
    const authorityItem = badAuthority.items[0]!;
    authorityItem.scorecard = scoreScreen02Feasibility(
      {
        ...authorityItem.scorecard.components,
        sourceAuthority: 0,
      },
      authorityItem.scorecard.componentReasons,
    );
    expect(restoreScreen02Session(badAuthority)).toBeNull();

    const badScopeFit = clone(sourced!);
    const scopeItem = badScopeFit.items[0]!;
    scopeItem.scorecard = scoreScreen02Feasibility(
      {
        ...scopeItem.scorecard.components,
        scopeFit: 100,
      },
      scopeItem.scorecard.componentReasons,
    );
    expect(restoreScreen02Session(badScopeFit)).toBeNull();
  });

  it("rejects forged score mappings and unattached score evidence", () => {
    const supportingSource = source("rubric-source", 1);
    const contradictory = findProposal("contradictory-rubric", {
      sources: [supportingSource],
      assessments: {
        exposureObservability: {
          category: "directly-observable",
          value: 17,
          reason: "This numeric value contradicts the published category.",
          evidenceSourceIds: [supportingSource.id],
          method: "ai-rubric",
        },
      },
    });
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [contradictory]),
    ).toThrow(
      "value contradicts the fixed mapping for its rubric category",
    );

    const unattached = findProposal("unattached-rubric-evidence", {
      sources: [supportingSource],
      assessments: {
        variation: {
          category: "usable",
          reason: "The cited id is not attached to this proposal.",
          evidenceSourceIds: ["not-an-attached-source"],
          method: "ai-rubric",
        },
      },
    });
    expect(() =>
      assessScreen02Items(confirmedFindContext(), [unattached]),
    ).toThrow("cites a source that is not attached to the proposal");
  });

  it("rejects substitute-shock and fictional Audit proposals", () => {
    const substitute = auditProposal({
      title: "GDPR formal eligibility",
      description: "A source-backed representation of the GDPR.",
      candidateConstruct:
        "General Data Protection Regulation formal eligibility",
      operationalization:
        "An indicator for organizations covered by GDPR Article 3.",
    });
    expect(() =>
      assessScreen02Items(confirmedAuditContext(), [substitute]),
    ).toThrow(
      "does not preserve the exact known-shock anchor from Screen 1",
    );

    const fictional = auditProposal({
      origin: "fictional-demonstration",
    });
    expect(() =>
      assessScreen02Items(confirmedAuditContext(), [fictional]),
    ).toThrow(
      "cannot use fictional-demonstration provenance in Audit mode",
    );
  });

  it("strictly restores manifests, revisions, selection history, and locks", () => {
    const initial = findSessionWithResult("strict-restore");
    const extraRoundManifest = clone(initial) as typeof initial & {
      interaction: typeof initial.interaction & {
        searchRounds: Array<
          (typeof initial.interaction.searchRounds)[number] & {
            manifest: { injected?: string };
          }
        >;
      };
    };
    extraRoundManifest.interaction.searchRounds[0]!.manifest.injected =
      "unrecognized";
    expect(restoreScreen02Session(extraRoundManifest)).toBeNull();

    const negativeRound = clone(initial);
    negativeRound.interaction.searchRounds[0]!.revision = -7;
    expect(restoreScreen02Session(negativeRound)).toBeNull();

    const arbitraryInvalidation = clone(initial);
    arbitraryInvalidation.interaction.downstreamInvalidationCount = 999;
    expect(restoreScreen02Session(arbitraryInvalidation)).toBeNull();

    const locked = lockScreen02Choice(
      selectScreen02Item(initial, initial.items[0]!.id),
    );
    const missingHistory = clone(locked);
    missingHistory.interaction.selectionHistory = [];
    expect(restoreScreen02Session(missingHistory)).toBeNull();

    const negativeLockRevision = clone(locked);
    negativeLockRevision.lockedChoice!.lockedAtRevision = -1;
    expect(restoreScreen02Session(negativeLockRevision)).toBeNull();

    const scopeRevision = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "refine",
      exactRequest: "Change the locked geography.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [],
      scopeRevision: {
        exactRequest: "Change the locked geography.",
        conflictingFields: ["geography"],
        reason: "Geography is a locked Screen 1 field.",
      },
    });
    const malformedScopeRevision = clone(scopeRevision) as unknown as {
      interaction: {
        pendingScopeRevision: {
          revision: unknown;
        };
      };
    };
    malformedScopeRevision.interaction.pendingScopeRevision!.revision =
      "not-a-number";
    expect(restoreScreen02Session(malformedScopeRevision)).toBeNull();
  });

  it("supports the documented source bound and rejects operations that would exceed it", () => {
    const initial = createScreen02Session(confirmedFindContext());
    const manySources = Array.from({ length: 40 }, (_, index) =>
      source(
        `bounded-source-${index}`,
        1,
        `https://example.test/bounded/${index}`,
      ),
    );
    const bounded = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "Assess a source-rich candidate.",
      retrievedAt: "2026-07-29T12:00:00Z",
      proposals: [
        findProposal("source-rich", {
          title: "National source-rich disclosure rule",
          event: {
            displayName: "National source-rich disclosure rule",
            eventDate: "2019-07-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [
              "U.S. exchange-listed manufacturing firms",
            ],
          },
          sources: manySources,
        }),
      ],
    });
    expect(restoreScreen02Session(clone(bounded))).not.toBeNull();

    const evidenceSources = (prefix: string) =>
      Array.from({ length: 30 }, (_, index) =>
        source(
          `${prefix}-${index}`,
          1,
          `https://example.test/${prefix}/${index}`,
        ),
      );
    const first = applyScreen02SearchRound(initial, {
      expectedRevision: initial.revision,
      requestType: "find-more",
      exactRequest: "First evidence tranche.",
      retrievedAt: "2026-07-29T12:01:00Z",
      proposals: [
        findProposal("merge-a", {
          title: "National evidence consolidation rule",
          event: {
            displayName: "National evidence consolidation rule",
            eventDate: "2019-07-01",
            eventFamily: "Regulation",
            geographies: ["United States"],
            populations: [
              "U.S. exchange-listed manufacturing firms",
            ],
          },
          sources: evidenceSources("merge-a-source"),
        }),
      ],
    });
    expect(() =>
      applyScreen02SearchRound(first, {
        expectedRevision: first.revision,
        requestType: "find-more",
        exactRequest: "Second evidence tranche.",
        retrievedAt: "2026-07-29T12:02:00Z",
        proposals: [
          findProposal("merge-b", {
            title: "National evidence consolidation rule",
            event: {
              displayName: "National evidence consolidation rule",
              eventDate: "2019-07-01",
              eventFamily: "Regulation",
              geographies: ["United States"],
              populations: [
                "U.S. exchange-listed manufacturing firms",
              ],
            },
            sources: evidenceSources("merge-b-source"),
          }),
        ],
      }),
    ).toThrow("would exceed the 50-source per-candidate limit");
  });

  it("labels fixed weekly time support using weekly periods", () => {
    const assessed = assessScreen02Items(confirmedAuditContext(), [
      auditProposal(),
    ]);
    expect(
      assessed.items[0]?.scorecard.componentReasons.timeSupport,
    ).toContain("weekly periods");
    expect(
      assessed.items[0]?.scorecard.componentReasons.timeSupport,
    ).not.toContain("annual periods");
  });

  it("renders both parity information and the immutable-boundary warning", () => {
    const session = createScreen02Session(confirmedAuditContext());
    const markdown = screen02ContextMarkdown(session);
    const outputPrefix = "- Exact Screen02 output JSON: ";
    const outputLine = markdown
      .split("\n")
      .find((line) => line.startsWith(outputPrefix));
    const embeddedOutput = JSON.parse(
      outputLine!.slice(outputPrefix.length),
    ) as string;
    const parsedOutput = JSON.parse(embeddedOutput) as Record<
      string,
      unknown
    >;
    const {
      screen01Baseline: _screen01Baseline,
      ...expectedOutput
    } = clone(session);

    expect(markdown).toContain("Screen: 2 of 8");
    expect(markdown).toContain(
      'Exact known-shock anchor: "California Consumer Privacy Act"',
    );
    expect(markdown).toContain(
      "Candidate type: Source-backed event matches for the exact known-shock anchor",
    );
    expect(markdown).toContain("Items retained: 0");
    expect(markdown).toContain("Selected item: None");
    expect(markdown).toContain("Locked choice for Screen 3: None");
    expect(markdown).toContain("Unique located sources: 0");
    expect(markdown).not.toContain("Scope-fit score:");
    expect(markdown).not.toContain("Candidate representation:");
    expect(markdown).toContain("Outcome values inspected: No");
    expect(markdown).toContain("Exact Screen01StudyContext JSON:");
    expect(markdown).toContain(
      'Population: "U.S. exchange-listed technology firms"',
    );
    expect(markdown).toContain('Geography: "United States"');
    expect(markdown).toContain('Study period: "2015–2023"');
    expect(markdown).toContain('Event family: "Regulation"');
    expect(markdown).toContain(
      "Treat the frozen Screen 1 baseline as immutable",
    );
    expect(outputLine).toBeDefined();
    expect(parsedOutput).toStrictEqual(expectedOutput);
    expect(parsedOutput).not.toHaveProperty("screen01Baseline");
  });
});
