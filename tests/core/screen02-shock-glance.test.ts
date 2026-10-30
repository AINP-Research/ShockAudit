import { describe, expect, it } from "vitest";

import {
  SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION,
  SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES,
  assembleScreen02AuditShockGlance,
  assembleScreen02AuditShockGlanceForDossier,
  assembleScreen02FindShockGlance,
  assembleScreen02ShockGlanceFromHandoff,
  buildScreen02ShockGlance,
  requireScreen02ShockGlance,
  resolveScreen02ShockGlance,
  restoreScreen02ShockGlance,
  upsertScreen02ShockGlance,
} from "../../src/core/screen02-shock-glance";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { createScreen03LoadingState } from "../../src/core/screen03-workflow";
import {
  fingerprintScreen02FindCandidateSet,
  fingerprintScreen02WorkflowValue,
  continueScreen02FindCandidate,
  finalizeScreen02FindCandidateAssessmentRequest,
  prepareScreen02AssessmentRequest,
  requireScreen02AuditState,
  requireScreen02FindState,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import { screen02FindAssessmentPartIds } from "../../src/core/screen02-workflow-types";
import type { Screen02FindState } from "../../src/core/screen02-workflow-types";
import {
  buildFindFactsState,
  buildAuditIdentityState,
  buildFixedQualifiedFindState,
  buildReadyAuditState,
  buildReadyFindState,
  cloneFixture,
} from "./screen02-workflow-fixtures";

const glanceAt = "2026-08-09T20:00:00.000Z";

function qualifiedReadyFindState() {
  const qualified = buildFixedQualifiedFindState(
    "qualified-shock-glance-find-run",
  );
  const candidate = qualified.candidates[0]!;
  let state = prepareScreen02AssessmentRequest(
    qualified,
    {
      jobId: "qualified-find-assessment-job",
      requestId: "qualified-find-assessment-request",
      mode: "find-candidate",
      candidateSnapshotId: candidate.candidateSnapshotId,
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T18:00:02.000Z",
    },
  ) as Screen02FindState;
  for (const transition of [
    {
      status: "message-delivered" as const,
      at: "2026-08-09T18:00:03.000Z",
      actor: "chatgpt-host" as const,
    },
    {
      status: "draft-received" as const,
      at: "2026-08-09T18:00:04.000Z",
      actor: "chatgpt-host" as const,
      receiptId: "qualified-find-assessment-receipt",
    },
    {
      status: "validating" as const,
      at: "2026-08-09T18:00:05.000Z",
      actor: "fixed-core" as const,
    },
  ]) {
    state = transitionScreen02AssessmentRequest(state, {
      requestId: "qualified-find-assessment-request",
      ...transition,
    }) as Screen02FindState;
  }
  const assessment = cloneFixture(buildReadyFindState().assessments[0]!);
  assessment.requestId = "qualified-find-assessment-request";
  assessment.recordedAt = "2026-08-09T18:00:06.000Z";
  state = finalizeScreen02FindCandidateAssessmentRequest(state, {
    requestId: "qualified-find-assessment-request",
    status: "completed",
    at: assessment.recordedAt,
    note: "The qualified handoff fixture passed fixed validation.",
    acceptedPartIds: [...screen02FindAssessmentPartIds],
    failures: [],
    assessment,
  });
  state = selectScreen02FindCandidate(
    state,
    candidate.candidateSnapshotId,
    "qualified-find-selection",
    "2026-08-09T18:00:08.000Z",
    "Researcher selected the qualified candidate.",
  );
  return continueScreen02FindCandidate(
    state,
    "qualified-find-continuation",
    "2026-08-09T18:00:09.000Z",
    "Researcher continued the qualified candidate to Screen 3.",
  );
}

describe("Screen 2 shock glance v1", () => {
  it("restores only the strict bounded schema", () => {
    const glance = assembleScreen02FindShockGlance(
      buildFindFactsState(),
      "gdpr-candidate-snapshot-v1",
      glanceAt,
    );

    expect(glance.schemaVersion).toBe(
      SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION,
    );
    expect(restoreScreen02ShockGlance(glance)).toEqual(glance);
    expect(Object.isFrozen(requireScreen02ShockGlance(glance))).toBe(true);

    expect(
      restoreScreen02ShockGlance({ ...glance, unknownField: true }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({
        ...glance,
        summary: "This is not a complete sentence",
      }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({
        ...glance,
        keyPoints: ["One substantive point remains valid for a sparse event."],
      }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({
        ...glance,
        keyPoints: [],
      }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({
        ...glance,
        keyPoints: Array.from(
          { length: 6 },
          (_, index) => `Substantive point ${index + 1} is separately stated.`,
        ),
      }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({
        ...glance,
        importantCaveat: `${"word ".repeat(61).trim()}.`,
      }),
    ).toBeNull();
    expect(
      restoreScreen02ShockGlance({ ...glance, sourceIds: [] }),
    ).toBeNull();
  });

  it("assembles the same readable Find orientation deterministically", () => {
    const state = buildFindFactsState();
    const first = assembleScreen02FindShockGlance(
      state,
      "gdpr-candidate-snapshot-v1",
      glanceAt,
    );
    const second = assembleScreen02FindShockGlance(
      state,
      "gdpr-candidate-snapshot-v1",
      glanceAt,
    );

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      runId: "workflow-find-run",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      selectedEventId: "gdpr-candidate-snapshot-v1",
      origin: "fixed-source-derived",
      sourceIds: ["gdpr-official"],
    });
    expect(first.summary).toContain("GDPR is a regulation");
    expect(first.keyPoints).toEqual([
      "EU establishments and some qualifying non-EU controllers or processors may be covered.",
      "Attached source records support orientation but do not yet settle the Event Card.",
      "Organization-level exposure must be established separately from broad coverage.",
    ]);
    expect(first.whoIsAffected).toContain("EU establishments");
    expect(first.keyTiming).toContain("2018-05-25");
    expect(first.importantCaveat).toContain("confirmation on Screen 3");
    expect(JSON.stringify(first)).not.toContain("undefined");
  });

  it("preserves an explicit population uncertainty for a qualified event", () => {
    const state = cloneFixture(buildFixedQualifiedFindState(
      "qualified-missing-population-glance-run",
    ));
    const candidate = state.candidates[0]!;
    if (!candidate.qualification) {
      throw new Error("Expected a fixed candidate qualification.");
    }
    candidate.qualification.substantiveOverview.whoMayBeAffected = "";

    const glance = assembleScreen02FindShockGlance(
      state,
      candidate.candidateSnapshotId,
      glanceAt,
    );

    expect(glance.whoIsAffected).toBe(
      "The retained Screen 2 evidence does not yet establish which organizations or people may be affected.",
    );
    expect(restoreScreen02ShockGlance(glance)).toEqual(glance);
  });

  it("assembles the Audit dossier with ordered timing and separate amendments", () => {
    const state = buildReadyAuditState();
    const glance = assembleScreen02AuditShockGlance(
      state,
      "ccpa-match-snapshot-v1",
      glanceAt,
    );

    expect(glance).toMatchObject({
      runId: "workflow-audit-run",
      candidateSnapshotId: "ccpa-match-snapshot-v1",
      selectedEventId: "ccpa-identity-snapshot-v1",
      origin: "fixed-source-derived",
      sourceIds: ["ccpa-official"],
    });
    expect(glance.summary).toContain("consumer-privacy statute");
    expect(glance.keyPoints.join(" ")).toContain(
      "California Privacy Rights Act",
    );
    expect(glance.keyTiming.indexOf("2018-06-28")).toBeLessThan(
      glance.keyTiming.indexOf("2020-01-01"),
    );
    expect(glance.whoIsAffected).toContain("may be covered");
  });

  it("produces a useful identity-based orientation when detail is incomplete", () => {
    const raw = cloneFixture(buildFindFactsState());
    const candidate = raw.candidates[0]!;
    const base = {
      ...candidate,
      dateLeads: [],
      broadCoverage: [],
      apparentExposureVariables: [],
      limitations: [],
    };
    const {
      candidateFingerprint: _oldFingerprint,
      ...candidateWithoutFingerprint
    } = base;
    raw.candidates[0] = {
      ...candidateWithoutFingerprint,
      candidateFingerprint:
        fingerprintScreen02WorkflowValue(candidateWithoutFingerprint),
    };
    const activeSet = raw.candidateSets.find(
      (set) => set.candidateSetSnapshotId === raw.activeCandidateSetSnapshotId,
    )!;
    activeSet.candidateSetFingerprint =
      fingerprintScreen02FindCandidateSet(activeSet);

    const glance = assembleScreen02FindShockGlance(
      raw,
      candidate.candidateSnapshotId,
      glanceAt,
    );
    expect(glance.summary).toContain("GDPR is a regulation");
    expect(glance.keyPoints).toHaveLength(3);
    expect(glance.whoIsAffected).toContain("does not yet establish");
    expect(glance.keyTiming).toContain("does not yet establish");
    expect(glance.importantCaveat).toContain("require confirmation");
    expect(glance.keyPoints.join(" ")).not.toMatch(
      /formal identifier|event status|possible exposure indicators|exogeneity|causal mechanism|realized effects/iu,
    );
  });

  it("derives rich CCPA Find points only from coordinated retained rights and duties", () => {
    const glance = assembleScreen02FindShockGlance(
      buildFindFactsState({ candidate: "ccpa" }),
      "ccpa-candidate-snapshot-v1",
      glanceAt,
    );
    const visible = [glance.summary, ...glance.keyPoints].join(" ");

    expect(glance.summary).toContain("gives California consumers privacy rights");
    expect(glance.keyPoints).toEqual(expect.arrayContaining([
      "The CCPA gives California consumers privacy rights.",
      "Data-use and disclosure obligations apply to covered businesses.",
      "Deletion and opt-out obligations apply to covered businesses.",
    ]));
    expect(glance.keyPoints.length).toBeGreaterThanOrEqual(3);
    expect(visible).not.toMatch(
      /Screen 2|Screen 3|formal identifier|event status|possible exposure indicators|exogeneity|causal mechanism|realized effects/iu,
    );
  });

  it("stores a bound glance by the time Find and Audit continue", () => {
    const find = buildReadyFindState();
    const audit = buildReadyAuditState();

    expect(find.shockGlances).toHaveLength(1);
    expect(find.shockGlances?.[0]?.candidateSnapshotId).toBe(
      find.decision.tentativeSelectionSnapshotId,
    );
    expect(audit.shockGlances).toHaveLength(1);
    expect(audit.shockGlances?.[0]?.candidateSnapshotId).toBe(
      audit.confirmedIdentity?.matchSnapshotId,
    );
  });

  it("stores the fixed Find glance when assessment completes, before selection", () => {
    let state = prepareScreen02AssessmentRequest(buildFindFactsState(), {
      jobId: "preselection-glance-job",
      requestId: "preselection-glance-request",
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-09T18:00:02.000Z",
    }) as Screen02FindState;
    for (const transition of [
      {
        status: "message-delivered" as const,
        at: "2026-08-09T18:00:03.000Z",
        actor: "chatgpt-host" as const,
      },
      {
        status: "draft-received" as const,
        at: "2026-08-09T18:00:04.000Z",
        actor: "chatgpt-host" as const,
        receiptId: "preselection-glance-receipt",
      },
      {
        status: "validating" as const,
        at: "2026-08-09T18:00:05.000Z",
        actor: "fixed-core" as const,
      },
    ]) {
      state = transitionScreen02AssessmentRequest(state, {
        requestId: "preselection-glance-request",
        ...transition,
      }) as Screen02FindState;
    }
    const fixtureAssessment = cloneFixture(
      buildReadyFindState().assessments[0]!,
    );
    fixtureAssessment.requestId = "preselection-glance-request";
    fixtureAssessment.recordedAt = "2026-08-09T18:00:06.000Z";
    state = finalizeScreen02FindCandidateAssessmentRequest(state, {
      requestId: "preselection-glance-request",
      status: "completed",
      at: fixtureAssessment.recordedAt,
      note: "The assessment passed fixed validation.",
      acceptedPartIds: [...screen02FindAssessmentPartIds],
      failures: [],
      assessment: fixtureAssessment,
    });

    expect(state.decision.tentativeSelectionSnapshotId).toBeNull();
    expect(state.shockGlances).toHaveLength(1);
    expect(state.shockGlances?.[0]?.candidateSnapshotId).toBe(
      fixtureAssessment.candidateSnapshotId,
    );
  });

  it("assembles and validates an Audit match+dossier glance before confirmation", () => {
    const raw = cloneFixture(buildAuditIdentityState());
    const match = raw.possibleMatches[0]!;
    const dossier = raw.dossiers[0]!;
    raw.identityDecisions = [];
    raw.confirmedIdentity = null;
    raw.shockGlances = [];
    const preconfirmation = requireScreen02AuditState(raw);
    const glance = assembleScreen02AuditShockGlanceForDossier(
      preconfirmation,
      match.matchSnapshotId,
      dossier.dossierSnapshotId,
      glanceAt,
    );
    const withGlance = requireScreen02AuditState({
      ...preconfirmation,
      shockGlances: upsertScreen02ShockGlance(
        preconfirmation.shockGlances,
        glance,
      ),
    });

    expect(withGlance.confirmedIdentity).toBeNull();
    expect(withGlance.shockGlances).toEqual([glance]);
    expect(glance.selectedEventId).toBe(match.identitySnapshotId);
  });

  it("upserts one candidate without dropping other bounded candidate glances", () => {
    const first = assembleScreen02FindShockGlance(
      buildFindFactsState(),
      "gdpr-candidate-snapshot-v1",
      glanceAt,
    );
    const second = requireScreen02ShockGlance({
      ...first,
      candidateSnapshotId: "second-candidate-snapshot",
      candidateFingerprint: "fnv1a64:1111111111111111",
      selectedEventId: "second-candidate-snapshot",
      eventFingerprint: "fnv1a64:2222222222222222",
    });
    const upgradedFirst = requireScreen02ShockGlance({
      ...first,
      origin: "chatgpt-host",
      updatedAt: "2026-08-09T20:00:01.000Z",
    });

    const two = upsertScreen02ShockGlance([first], second);
    expect(two.map((entry) => entry.candidateSnapshotId)).toEqual([
      first.candidateSnapshotId,
      second.candidateSnapshotId,
    ]);
    expect(upsertScreen02ShockGlance(two, upgradedFirst)).toEqual([
      upgradedFirst,
      second,
    ]);
    expect(() => upsertScreen02ShockGlance(two, second, 1)).toThrow(
      /capacity/i,
    );
    expect(SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES).toBe(80);
  });

  it("keeps old states readable when the optional glance is absent", () => {
    const oldFind = cloneFixture(buildFindFactsState());
    delete oldFind.shockGlances;
    const restored = requireScreen02FindState(oldFind);

    expect(restored.shockGlances).toBeUndefined();
    const glance = assembleScreen02FindShockGlance(
      restored,
      "gdpr-candidate-snapshot-v1",
      glanceAt,
    );
    expect(glance.origin).toBe("fixed-source-derived");
  });

  it("reconstructs from an authenticated old continued state with no glance", () => {
    const oldState = cloneFixture(buildReadyFindState());
    delete oldState.shockGlances;
    const restored = requireScreen02FindState(oldState);
    const handoff = buildScreen02WorkflowHandoff(
      restored,
      "0.3.15",
      restored.updatedAt,
    );
    const glance = resolveScreen02ShockGlance(restored, handoff);

    expect(glance).not.toBeNull();
    expect(glance?.origin).toBe("fixed-source-derived");
    expect(glance?.eventFingerprint).toBe(handoff.integrity.eventFingerprint);
  });

  it("rejects stale, foreign-run, and rebound glances in canonical state", () => {
    const selected = cloneFixture(buildReadyFindState());
    const original = selected.shockGlances?.[0];
    if (!original) throw new Error("Expected a stored Find glance.");

    expect(
      requireScreen02FindState.bind(null, {
        ...selected,
        shockGlances: [{ ...original, runId: "another-run" }],
      }),
    ).toThrow(/canonical contract/i);
    expect(
      requireScreen02FindState.bind(null, {
        ...selected,
        shockGlances: [
          {
            ...original,
            candidateFingerprint: "fnv1a64:0000000000000000",
          },
        ],
      }),
    ).toThrow(/canonical contract/i);
    expect(
      requireScreen02FindState.bind(null, {
        ...selected,
        shockGlances: [
          {
            ...original,
            eventFingerprint: "fnv1a64:0000000000000000",
          },
        ],
      }),
    ).toThrow(/canonical contract/i);
  });

  it("resolves the stored glance only for the exact current parent and handoff", () => {
    const state = buildReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.3.16",
      state.updatedAt,
    );
    const stored = state.shockGlances?.[0];

    expect(resolveScreen02ShockGlance(state, handoff)).toEqual(stored);
    expect(buildScreen02ShockGlance(state, handoff)).toEqual(stored);
    expect(
      resolveScreen02ShockGlance(
        { ...state, runId: "stale-parent" } as Screen02FindState,
        handoff,
      ),
    ).toBeNull();
  });

  it("carries the qualified six-part overview into Screen 3 without fingerprint fallback", () => {
    const state = qualifiedReadyFindState();
    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.4.03",
      state.updatedAt,
    );
    const stored = state.shockGlances?.[0];
    if (!stored) throw new Error("Expected a stored qualified orientation.");

    expect(handoff.event.preliminaryQualification).toMatchObject({
      eligible: true,
      substantiveOverview: {
        passed: true,
        whatTheShockIs: expect.any(String),
        whatChanged: expect.any(String),
        whoMayBeAffected: expect.any(String),
        importantTiming: expect.any(String),
        whyItMayMatterForStudy: expect.any(String),
        mainUncertainty: expect.any(String),
      },
    });
    expect(stored.eventFingerprint).toBe(handoff.integrity.eventFingerprint);

    const resolved = resolveScreen02ShockGlance(
      state,
      handoff,
      "2026-08-09T20:00:01.000Z",
    );
    expect(resolved).toEqual(stored);
    expect(resolved?.updatedAt).toBe(stored.updatedAt);
    expect(resolved?.updatedAt).not.toBe("2026-08-09T20:00:01.000Z");
    expect(resolved?.summary).toContain("General Data Protection Regulation");
    expect(resolved?.keyPoints.join(" ")).toMatch(
      /change personal-data processing|research-design hypothesis|Main uncertainty/i,
    );

    const screen03 = createScreen03LoadingState(
      handoff,
      "2026-08-09T20:00:02.000Z",
      resolved ?? undefined,
    );
    expect(screen03.orientation).toMatchObject({
      provenance: "screen-02-qualified-preliminary",
      initial: stored,
      current: stored,
    });
  });

  it("reconstructs the same bound fallback from an unchanged v4 handoff", () => {
    const state = buildReadyAuditState();
    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.3.16",
      state.updatedAt,
    );
    const fallback = assembleScreen02ShockGlanceFromHandoff(handoff);

    expect(fallback.eventFingerprint).toBe(handoff.integrity.eventFingerprint);
    expect(fallback.candidateSnapshotId).toBe(
      handoff.provenance.mode === "audit"
        ? handoff.provenance.matchSnapshotId
        : "",
    );
    expect(fallback.selectedEventId).toBe(handoff.event.identitySnapshotId);
    expect(fallback.sourceIds.every((id) => handoff.event.sourceIds.includes(id)))
      .toBe(true);
  });
});
