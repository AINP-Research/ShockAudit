import { describe, expect, it } from "vitest";

import {
  applyScreen02AuditDossierDraftReceipt,
  buildScreen02AuditAssessmentPacket,
  buildScreen02AuditDossierPacket,
  markScreen02AuditRequestDelivered,
  reconsiderScreen02AuditIdentity,
} from "../../src/core/screen02-audit-workflow";
import {
  prepareScreen02AssessmentRequest,
  requireScreen02AuditState,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  screen02AuditAssessmentPartIds,
  screen02AuditDossierPartIds,
  type Screen02AuditState,
} from "../../src/core/screen02-workflow-types";
import {
  applyCanonicalScreen02AuditReceipt,
} from "../../src/worker/screen02-workflow-controller";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
  buildScreen02AuditAssessmentSourcePacket,
  createScreen02AuditAssessmentCapability,
  createSignedScreen02AuditNormalizedReceipt,
  inspectScreen02AuditReceiptDisposition,
  normalizeScreen02AuditModelDraft,
  verifyScreen02AuditAssessmentCapability,
  verifySignedScreen02AuditNormalizedReceipt,
  type Screen02AuditSigningConfig,
} from "../../src/worker/screen02-audit-assessment-security";
import {
  buildAuditIdentityState,
  cloneFixture,
} from "../core/screen02-workflow-fixtures";

const signingConfig: Screen02AuditSigningConfig = {
  keyId: "stage4-audit-test-key",
  key: "0123456789abcdef0123456789abcdef",
};
const dossierRequestId = "audit-dossier-security-request-1";
const assessmentRequestId = "audit-confirmed-security-request-1";
const dossierIssuedAt = "2026-08-09T18:11:00.000Z";
const assessmentIssuedAt = "2026-08-09T18:12:00.000Z";

function unconfirmedAuditMatchState() {
  const raw = cloneFixture(buildAuditIdentityState());
  raw.revision += 1;
  raw.updatedAt = "2026-08-09T18:10:59.000Z";
  raw.dossiers = [];
  raw.identityDecisions = [];
  raw.confirmedIdentity = null;
  raw.assessments = [];
  raw.assessmentRequests = [];
  raw.continuationHistory = [];
  return requireScreen02AuditState(raw);
}

function preparedDossierState() {
  return prepareScreen02AssessmentRequest(unconfirmedAuditMatchState(), {
    mode: "audit-dossier",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    jobId: "audit-dossier-security-job-1",
    requestId: dossierRequestId,
    attempt: 1,
    requestedPartIds: [...screen02AuditDossierPartIds],
    at: dossierIssuedAt,
  }) as Screen02AuditState;
}

function preparedAssessmentState(
  requestedPartIds: string[] = [...screen02AuditAssessmentPartIds],
) {
  return prepareScreen02AssessmentRequest(buildAuditIdentityState(), {
    mode: "audit-confirmed-event",
    identitySnapshotId: "ccpa-identity-snapshot-v1",
    jobId: "audit-confirmed-security-job-1",
    requestId: assessmentRequestId,
    attempt: 1,
    requestedPartIds,
    at: assessmentIssuedAt,
  }) as Screen02AuditState;
}

function validDossierDraft() {
  const claim = (text: string) => ({
    text,
    evidenceSourceIds: ["ccpa-official"],
    uncertainty: "Screen 3 must verify the operative details and study relevance.",
  });
  return {
    atAGlance: [
      claim(
        "The possible match is the California Consumer Privacy Act of 2018, commonly called the CCPA.",
      ),
    ],
    whatHappened: claim(
      "California enacted a consumer privacy statute that created consumer rights and duties for covered businesses.",
    ),
    whatChanged: [
      claim(
        "The statute introduced consumer rights and data governance duties that distinguish this event identity.",
      ),
    ],
    timeline: [
      {
        date: "2018-06-28",
        label: "Enactment date lead",
        stage: "enactment",
        evidenceSourceIds: ["ccpa-official"],
        uncertainty: "Screen 3 must verify the focal empirical event clock.",
      },
    ],
    broadCoverage: [
      claim(
        "Some for-profit entities doing business in California may fall within the broad statutory coverage description.",
      ),
    ],
    keyComponents: [
      claim(
        "Consumer rights, disclosure duties, and data governance obligations distinguish this statute from related events.",
      ),
    ],
    relatedVersions: [
      {
        relationship: "amendment",
        identity: {
          canonicalTitle: "California Privacy Rights Act",
          commonNames: ["CPRA"],
          formalIdentifier: "Proposition 24",
          issuer: "California electorate",
          issuingJurisdiction: "California, United States",
          eventType: "Ballot initiative",
          status: "Related later amendment",
        },
        evidenceSourceIds: ["ccpa-official"],
        note:
          "This is a related later version lead and is not merged into the confirmed 2018 identity.",
      },
    ],
    unresolvedFacts: [
      "The focal event stage and organization-level historical coverage remain unverified.",
    ],
  };
}

function validAssessmentDraft() {
  return {
    studyFit: {
      category: "strong",
      explanation:
        "The source-backed date leads fall inside the confirmed study period and the statute may reach firms in the study population.",
      evidenceSourceIds: ["ccpa-official"],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy compliance duties may redirect engineering resources and alter product experimentation linked to the confirmed outcome family.",
      evidenceSourceIds: ["ccpa-official"],
    },
    coverageRelation: {
      category: "mixed",
      explanation:
        "The confirmed study population is broader than covered businesses, so historical organization-level classification remains necessary.",
      evidenceSourceIds: ["ccpa-official"],
    },
    measurementPotential: {
      category: "difficult",
      explanation:
        "Public disclosures may provide exposure indicators, although organization-level California activity may be incomplete.",
      evidenceSourceIds: ["ccpa-official"],
    },
    mainConcern:
      "Different event stages and related amendments could be collapsed without later fixed verification.",
    nextChecks: [
      "Verify the event stage that best matches the proposed organizational response.",
      "Locate historical indicators needed to classify covered organizations.",
    ],
  };
}

async function issueDossierCapability(state = preparedDossierState()) {
  return createScreen02AuditAssessmentCapability(
    {
      state,
      requestId: dossierRequestId,
      capabilityId: "audit-dossier-security-capability-1",
      issuedAt: dossierIssuedAt,
    },
    signingConfig,
  );
}

async function issueAssessmentCapability(
  state = preparedAssessmentState(),
) {
  return createScreen02AuditAssessmentCapability(
    {
      state,
      requestId: assessmentRequestId,
      capabilityId: "audit-confirmed-security-capability-1",
      issuedAt: assessmentIssuedAt,
    },
    signingConfig,
  );
}

async function signAssessmentDraft(
  draft: unknown,
  state = preparedAssessmentState(),
  receiptId = "audit-confirmed-security-receipt-1",
) {
  const issued = await issueAssessmentCapability(state);
  return createSignedScreen02AuditNormalizedReceipt(
    {
      submission: {
        schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
        capabilityToken: issued.capabilityToken,
        requestId: assessmentRequestId,
        draft,
      },
      receiptId,
      receivedAt: "2026-08-09T18:12:01.000Z",
    },
    signingConfig,
  );
}

describe("Screen 2 Audit authenticated model boundary", () => {
  it("normalizes direct dossier citations without tokens and preserves retry-safe gap handling", () => {
    const claim = {
      text: "California Consumer Privacy Act is the source-backed possible identity under review.",
      evidenceSourceIds: ["ccpa-official"],
      uncertainty: "The exact operative version remains provisional pending researcher review.",
    };
    const context = {
      mode: "audit-dossier" as const,
      requestedPartIds: ["atAGlance", "unresolvedFacts"],
      allowedEvidenceSourceIds: ["ccpa-official"],
    };
    const normalized = normalizeScreen02AuditModelDraft(
      {
        atAGlance: [claim],
        unresolvedFacts: [
          "Evidence gap — timeline: The bounded source does not establish a complete event timeline.",
        ],
      },
      context,
    );
    expect(normalized.failures).toEqual([]);
    expect(normalized.normalizedDraft).toMatchObject({
      atAGlance: [{ sourceIds: ["ccpa-official"] }],
    });
    expect(normalized.normalizedDraft).not.toHaveProperty(
      "atAGlance.0.evidenceSourceIds",
    );

    for (const invalidClaim of [
      { ...claim, evidenceSourceIds: ["outside-packet"] },
      {
        text: claim.text,
        sourceIds: ["ccpa-official"],
        uncertainty: claim.uncertainty,
      },
    ]) {
      expect(
        normalizeScreen02AuditModelDraft(
          { atAGlance: [invalidClaim], unresolvedFacts: ["A bounded unresolved fact remains for researcher review."] },
          context,
        ).acceptedPartIds,
      ).not.toContain("atAGlance");
    }

    const missingGap = normalizeScreen02AuditModelDraft(
      {
        timeline: [],
        unresolvedFacts: [
          "The bounded packet still requires researcher review of exact event clocks.",
        ],
      },
      {
        mode: "audit-dossier",
        requestedPartIds: ["timeline", "unresolvedFacts"],
        allowedEvidenceSourceIds: ["ccpa-official"],
      },
    );
    expect(missingGap.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partId: "timeline",
          codes: ["empty-section-needs-explicit-evidence-gap"],
        }),
        expect.objectContaining({
          partId: "unresolvedFacts",
          codes: ["missing-empty-section-evidence-gap:timeline"],
        }),
      ]),
    );
    expect(
      normalizeScreen02AuditModelDraft(
        { timeline: [] },
        {
          mode: "audit-dossier",
          requestedPartIds: ["timeline"],
          allowedEvidenceSourceIds: ["ccpa-official"],
        },
      ),
    ).toMatchObject({ acceptedPartIds: ["timeline"], failures: [] });
  });

  it("issues distinct immutable dossier and confirmed-event packet modes", async () => {
    const dossierState = preparedDossierState();
    const dossier = await issueDossierCapability(dossierState);
    expect(dossier.capability).toMatchObject({
      mode: "audit-dossier",
      requestId: dossierRequestId,
      dossierSnapshotId: null,
      dossierFingerprint: null,
      confirmationSnapshotId: null,
      confirmationFingerprint: null,
      allowedEvidenceSourceIds: ["ccpa-official"],
      requestedPartIds: screen02AuditDossierPartIds,
    });
    expect(dossier.sourcePacket).toMatchObject({
      mode: "audit-dossier",
      outcomeValuesInspected: false,
    });
    expect(dossier.sourcePacket).not.toHaveProperty("study");
    expect(dossier.sourcePacket).not.toHaveProperty("dossier");
    expect(dossier.sourcePacket).not.toHaveProperty("confirmation");
    const { mode: dossierMode, ...dossierPacket } = dossier.sourcePacket;
    expect(dossierMode).toBe("audit-dossier");
    expect(dossierPacket).toEqual(
      buildScreen02AuditDossierPacket(dossierState, dossierRequestId),
    );
    expect(Object.isFrozen(dossier.sourcePacket)).toBe(true);
    expect(Object.isFrozen(dossier.sourcePacket.sources)).toBe(true);

    const assessmentState = preparedAssessmentState();
    const confirmed = await issueAssessmentCapability(assessmentState);
    expect(confirmed.capability).toMatchObject({
      mode: "audit-confirmed-event",
      requestId: assessmentRequestId,
      dossierSnapshotId: "ccpa-dossier-v1",
      confirmationSnapshotId: "ccpa-confirmation-snapshot-1",
      allowedEvidenceSourceIds: ["ccpa-official"],
      requestedPartIds: screen02AuditAssessmentPartIds,
    });
    expect(confirmed.capability.dossierFingerprint).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/,
    );
    expect(confirmed.capability.confirmationFingerprint).toMatch(
      /^fnv1a64:[0-9a-f]{16}$/,
    );
    expect(confirmed.sourcePacket).toMatchObject({
      mode: "audit-confirmed-event",
      study: {
        population: "U.S. publicly listed technology firms",
        outcomeFamily: "Innovation",
      },
      dossier: { dossierSnapshotId: "ccpa-dossier-v1" },
      confirmation: {
        confirmationSnapshotId: "ccpa-confirmation-snapshot-1",
      },
      outcomeValuesInspected: false,
    });
    const { mode: assessmentMode, ...assessmentPacket } =
      confirmed.sourcePacket;
    expect(assessmentMode).toBe("audit-confirmed-event");
    expect(assessmentPacket).toEqual(
      buildScreen02AuditAssessmentPacket(
        assessmentState,
        assessmentRequestId,
      ),
    );
  });

  it("authenticates exact HMAC capability bindings and rejects tampering, wrong keys, and expiry", async () => {
    const issued = await issueAssessmentCapability();
    const verified = await verifyScreen02AuditAssessmentCapability(
      issued.capabilityToken,
      signingConfig,
      "2026-08-09T18:12:01.000Z",
    );
    expect(verified).toMatchObject({
      runId: "workflow-audit-run",
      stateRevision: expect.any(Number),
      stateFingerprint: expect.stringMatching(/^fnv1a64:[0-9a-f]{16}$/),
      packetFingerprint: issued.sourcePacket.packetFingerprint,
      anchorRevisionId:
        issued.sourcePacket.anchor.activeRevision.anchorRevisionId,
      matchSetSnapshotId: "ccpa-match-set-v1",
      matchSnapshotId: issued.sourcePacket.match.matchSnapshotId,
      identitySnapshotId: issued.sourcePacket.match.identitySnapshotId,
    });

    const final = issued.capabilityToken.at(-1)!;
    const tampered = `${issued.capabilityToken.slice(0, -1)}${
      final === "A" ? "B" : "A"
    }`;
    await expect(
      verifyScreen02AuditAssessmentCapability(
        tampered,
        signingConfig,
        "2026-08-09T18:12:01.000Z",
      ),
    ).rejects.toThrow(/authentication failed|canonical base64url/);
    await expect(
      verifyScreen02AuditAssessmentCapability(
        issued.capabilityToken,
        {
          keyId: signingConfig.keyId,
          key: "abcdef0123456789abcdef0123456789",
        },
        "2026-08-09T18:12:01.000Z",
      ),
    ).rejects.toThrow(/authentication failed/);
    await expect(
      verifyScreen02AuditAssessmentCapability(
        issued.capabilityToken,
        signingConfig,
        "2026-08-09T18:14:00.000Z",
      ),
    ).rejects.toThrow(/not active/);
    await expect(
      verifyScreen02AuditAssessmentCapability(
        issued.capabilityToken,
        signingConfig,
        "2026-08-09T18:20:01.000Z",
      ),
    ).rejects.toThrow(/not active/);
  });

  it("rejects every dossier packet after any identity is confirmed", () => {
    expect(() =>
      buildScreen02AuditAssessmentSourcePacket(
        buildAuditIdentityState(),
        "ccpa-dossier-request-1",
      ),
    ).toThrow(/cannot be issued after any identity confirmation/);
  });

  it("normalizes dossier claims to fixed-core draft shapes and signs only bounded output", async () => {
    const prepared = preparedDossierState();
    const issued = await issueDossierCapability(prepared);
    const signed = await createSignedScreen02AuditNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: dossierRequestId,
          draft: validDossierDraft(),
        },
        receiptId: "audit-dossier-security-receipt-1",
        receivedAt: "2026-08-09T18:11:01.000Z",
      },
      signingConfig,
    );
    expect(signed.acceptedPartIds).toEqual(screen02AuditDossierPartIds);
    expect(signed.payload.validationFailures).toEqual([]);
    expect(signed.receipt.submissions[0]?.draft).toMatchObject({
      atAGlance: [
        {
          sourceIds: ["ccpa-official"],
        },
      ],
      timeline: [
        {
          sourceIds: ["ccpa-official"],
        },
      ],
    });
    await expect(
      verifySignedScreen02AuditNormalizedReceipt(
        signed.receiptToken,
        signingConfig,
      ),
    ).resolves.toMatchObject({ acceptedPartIds: screen02AuditDossierPartIds });

    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: dossierRequestId,
      at: "2026-08-09T18:11:00.500Z",
      delivered: true,
    });
    const applied = applyScreen02AuditDossierDraftReceipt(
      delivered,
      signed.receipt,
    );
    expect(applied.results).toEqual([
      expect.objectContaining({
        requestId: dossierRequestId,
        status: "completed",
        acceptedPartIds: screen02AuditDossierPartIds,
      }),
    ]);
    expect(applied.state.dossiers.at(-1)).toMatchObject({
      status: "completed",
      atAGlance: [
        {
          id: `${dossierRequestId}:atAGlance:1`,
          sourceIds: ["ccpa-official"],
          status: "provisional",
        },
      ],
      timeline: [
        {
          id: `${dossierRequestId}:timeline:1`,
          sourceIds: ["ccpa-official"],
          status: "provisional",
        },
      ],
    });
  });

  it("accepts empty dossier sections when each one has an explicit evidence gap", async () => {
    const prepared = preparedDossierState();
    const issued = await issueDossierCapability(prepared);
    const draft = {
      ...validDossierDraft(),
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
      unresolvedFacts: [
        "Evidence gap — whatChanged: The bounded source does not establish a change summary.",
        "Evidence gap — timeline: The bounded source does not establish a complete event timeline.",
        "Evidence gap — broadCoverage: The bounded source does not establish historical organization-level coverage.",
        "Evidence gap — keyComponents: The bounded source does not establish a component inventory.",
        "Evidence gap — relatedVersions: The bounded source does not establish related version identities.",
      ],
    };
    const signed = await createSignedScreen02AuditNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: dossierRequestId,
          draft,
        },
        receiptId: "audit-dossier-security-generic-receipt",
        receivedAt: "2026-08-09T18:11:01.000Z",
      },
      signingConfig,
    );
    expect(signed.acceptedPartIds).toEqual(screen02AuditDossierPartIds);
    expect(signed.receipt.submissions[0]?.draft).toMatchObject({
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: dossierRequestId,
      at: "2026-08-09T18:11:00.500Z",
      delivered: true,
    });
    const applied = applyScreen02AuditDossierDraftReceipt(
      delivered,
      signed.receipt,
    );
    expect(applied.results[0]).toMatchObject({ status: "completed" });
    expect(applied.state.dossiers.at(-1)).toMatchObject({
      status: "completed",
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });
  });

  it("signs and verifies a partial dossier when one empty section lacks its explicit gap", async () => {
    const prepared = preparedDossierState();
    const issued = await issueDossierCapability(prepared);
    const draft = {
      ...validDossierDraft(),
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
      unresolvedFacts: [
        "Evidence gap — whatChanged: The bounded source does not establish a complete change summary.",
        "Evidence gap — broadCoverage: The bounded source does not establish historical organization-level coverage.",
        "Evidence gap — keyComponents: The bounded source does not establish a complete component inventory.",
        "Evidence gap — relatedVersions: The bounded source does not establish related version identities.",
        "The bounded packet still requires researcher review of exact event clocks.",
      ],
    };
    const signed = await createSignedScreen02AuditNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: dossierRequestId,
          draft,
        },
        receiptId: "audit-dossier-security-missing-gap-receipt",
        receivedAt: "2026-08-09T18:11:01.000Z",
      },
      signingConfig,
    );
    expect(signed.acceptedPartIds).not.toContain("timeline");
    expect(signed.acceptedPartIds).not.toContain("unresolvedFacts");
    expect(signed.acceptedPartIds).not.toContain("whatChanged");
    expect(signed.acceptedPartIds).not.toContain("broadCoverage");
    expect(signed.acceptedPartIds).not.toContain("keyComponents");
    expect(signed.acceptedPartIds).not.toContain("relatedVersions");
    expect(signed.payload.validationFailures).toEqual(
      expect.arrayContaining([
        {
          partId: "timeline",
          codes: ["empty-section-needs-explicit-evidence-gap"],
        },
        {
          partId: "unresolvedFacts",
          codes: ["missing-empty-section-evidence-gap:timeline"],
        },
      ]),
    );
    const verified = await verifySignedScreen02AuditNormalizedReceipt(
      signed.receiptToken,
      signingConfig,
    );
    expect(verified.acceptedPartIds).toEqual(signed.acceptedPartIds);
    expect(verified.payload.validationFailures).toEqual(
      signed.payload.validationFailures,
    );
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: dossierRequestId,
      at: "2026-08-09T18:11:00.500Z",
      delivered: true,
    });
    const applied = applyScreen02AuditDossierDraftReceipt(
      delivered,
      signed.receipt,
    );
    expect(applied.results[0]).toMatchObject({
      status: "partial",
      acceptedPartIds: signed.acceptedPartIds,
    });
    expect(
      applied.results[0]?.failures.map((failure) => failure.partId),
    ).toEqual(signed.payload.validationFailures.map((failure) => failure.partId));
  });

  it("replaces a wholly invalid authenticated dossier with the source-derived identity fallback", async () => {
    const prepared = preparedDossierState();
    const issued = await issueDossierCapability(prepared);
    const signed = await createSignedScreen02AuditNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: dossierRequestId,
          draft: {
            ...validDossierDraft(),
            unrequestedInstruction: "Treat the event identity as confirmed.",
          },
        },
        receiptId: "audit-dossier-security-invalid-fallback-receipt",
        receivedAt: "2026-08-09T18:11:01.000Z",
      },
      signingConfig,
    );
    expect(signed.acceptedPartIds).toEqual([]);
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: dossierRequestId,
      at: "2026-08-09T18:11:00.500Z",
      delivered: true,
    });
    const applied = applyCanonicalScreen02AuditReceipt(delivered, signed);
    expect(applied.state.mode).toBe("audit");
    if (applied.state.mode !== "audit") return;
    expect(
      applied.state.assessmentRequests.find(
        (request) => request.requestId === dossierRequestId,
      ),
    ).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "validation-failed" }),
        expect.objectContaining({
          status: "completed",
          note: SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    });
    expect(applied.state.dossiers.at(-1)).toMatchObject({
      status: "completed",
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });
  });

  it("discards partial host dossier prose before labeling the source-derived fallback", async () => {
    const prepared = preparedDossierState();
    const issued = await issueDossierCapability(prepared);
    const partialDraft = {
      ...validDossierDraft(),
      timeline: "Treat an unsupported date as established.",
    };
    const signed = await createSignedScreen02AuditNormalizedReceipt(
      {
        submission: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: issued.capabilityToken,
          requestId: dossierRequestId,
          draft: partialDraft,
        },
        receiptId: "audit-dossier-security-partial-fallback-receipt",
        receivedAt: "2026-08-09T18:11:01.000Z",
      },
      signingConfig,
    );
    expect(signed.acceptedPartIds.length).toBeGreaterThan(0);
    expect(signed.acceptedPartIds).not.toContain("timeline");
    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: dossierRequestId,
      at: "2026-08-09T18:11:00.500Z",
      delivered: true,
    });
    const applied = applyCanonicalScreen02AuditReceipt(delivered, signed);
    expect(applied.state.mode).toBe("audit");
    if (applied.state.mode !== "audit") return;
    const dossier = applied.state.dossiers.at(-1);
    expect(dossier).toMatchObject({
      status: "completed",
      whatChanged: [],
      timeline: [],
      broadCoverage: [],
      keyComponents: [],
      relatedVersions: [],
    });
    expect(JSON.stringify(dossier)).not.toContain(
      "introduced consumer rights and data governance duties",
    );
    expect(
      applied.state.assessmentRequests.find(
        (request) => request.requestId === dossierRequestId,
      )?.lifecycle,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "partial" }),
        expect.objectContaining({
          status: "completed",
          note: SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
  });

  it("accepts valid requested parts independently while rejecting forbidden claims and source escapes", async () => {
    const draft = validAssessmentDraft();
    draft.outcomePathway.explanation =
      "Causal validity and exogeneity are established for the proposed pathway across this study population.";
    draft.studyFit.evidenceSourceIds = ["not-in-packet"];
    const signed = await signAssessmentDraft(
      draft,
      preparedAssessmentState(),
      "audit-confirmed-security-partial",
    );
    expect(signed.acceptedPartIds).toEqual([
      "coverageRelation",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
    ]);
    expect(signed.payload.validationFailures).toEqual([
      {
        partId: "studyFit",
        codes: ["evidence-outside-source-packet"],
      },
      {
        partId: "outcomePathway",
        codes: ["forbidden-outcome-causal-or-verified-claim"],
      },
    ]);
    expect(signed.receipt.submissions[0]?.draft).not.toHaveProperty("studyFit");
    expect(signed.receipt.submissions[0]?.draft).not.toHaveProperty(
      "outcomePathway",
    );

    const legalDraft = validAssessmentDraft();
    legalDraft.coverageRelation.explanation =
      "Verified legal eligibility makes the sampled organizations definitively covered by this statute for the proposed analysis.";
    const legal = await signAssessmentDraft(
      legalDraft,
      preparedAssessmentState(),
      "audit-confirmed-security-legal-claim",
    );
    expect(legal.payload.validationFailures).toContainEqual({
      partId: "coverageRelation",
      codes: ["forbidden-outcome-causal-or-verified-claim"],
    });
    expect(legal.receipt.submissions[0]?.draft).not.toHaveProperty(
      "coverageRelation",
    );
  });

  it("keeps workflow state, baseline, facts, sources, and overall judgment outside the model-facing submission", async () => {
    const issued = await issueAssessmentCapability();
    await expect(
      createSignedScreen02AuditNormalizedReceipt(
        {
          submission: {
            schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: issued.capabilityToken,
            requestId: assessmentRequestId,
            draft: validAssessmentDraft(),
            state: preparedAssessmentState(),
          },
          receiptId: "audit-confirmed-security-root-escape",
          receivedAt: "2026-08-09T18:12:01.000Z",
        },
        signingConfig,
      ),
    ).rejects.toThrow(/strict root contract/);

    const signed = await signAssessmentDraft(
      {
        ...validAssessmentDraft(),
        overallJudgment: "worth-exploring",
      },
      preparedAssessmentState(),
      "audit-confirmed-security-judgment-escape",
    );
    expect(signed.acceptedPartIds).toEqual([]);
    expect(signed.payload.validationFailures).toHaveLength(
      screen02AuditAssessmentPartIds.length,
    );
    expect(signed.receipt.submissions[0]?.draft).toEqual({});
  });

  it("exposes explicit awaiting-delivery, apply, and stale race dispositions", async () => {
    const prepared = preparedAssessmentState();
    const signed = await signAssessmentDraft(validAssessmentDraft(), prepared);
    expect(inspectScreen02AuditReceiptDisposition(prepared, signed)).toMatchObject({
      disposition: "awaiting-delivery",
    });

    const delivered = markScreen02AuditRequestDelivered(prepared, {
      requestId: assessmentRequestId,
      at: "2026-08-09T18:12:00.500Z",
      delivered: true,
    });
    expect(inspectScreen02AuditReceiptDisposition(delivered, signed)).toMatchObject({
      disposition: "apply",
    });

    const stale = reconsiderScreen02AuditIdentity(delivered, {
      decisionId: "audit-confirmed-security-reconsideration-1",
      at: "2026-08-09T18:12:01.500Z",
      reason:
        "The researcher reopened identity review after finding a material version ambiguity.",
    });
    expect(inspectScreen02AuditReceiptDisposition(stale, signed)).toMatchObject({
      disposition: "stale",
    });
  });
});
